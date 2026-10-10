// Shared helpers for the build scripts.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BUILD = join(ROOT, "build");

// Optional env files: .env.local (machine-specific, git-ignored) wins over .env.
// Variables already set in the shell always take precedence over both files.
for (const name of [".env.local", ".env"]) {
  const p = join(ROOT, name);
  if (!existsSync(p)) continue;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(p, "utf8")))) {
    if (process.env[key] === undefined && value !== "") process.env[key] = value;
  }
}

export const readJSON = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
export function writeOut(rel, content) {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
  return p;
}

/** The card data file. CARDS_FILE (relative to the project root) lets scripts/import-edits.mjs
 *  validate a candidate file before it replaces data/cards.json. */
export const CARDS_FILE = process.env.CARDS_FILE || "data/cards.json";

export function loadProject() {
  const settings = readJSON("config/print-settings.json");
  const data = readJSON(CARDS_FILE);
  const gateMap = Object.fromEntries(data.gates.map((g) => [g.gate, g]));
  return { settings, data, gateMap };
}

/** Unicode ranges covered by the self-hosted fonts (from design/fonts.css), as [from, to] pairs. */
export function fontCoverage() {
  const css = readFileSync(join(ROOT, "design/fonts.css"), "utf8");
  const ranges = [];
  for (const m of css.matchAll(/unicode-range:\s*([^;]+);/g)) {
    for (const part of m[1].split(",")) {
      const [a, b] = part.trim().replace(/^U\+/i, "").split("-");
      ranges.push([parseInt(a, 16), parseInt(b || a, 16)]);
    }
  }
  return ranges.sort((x, y) => x[0] - y[0]);
}

/** Text labels drawn inside each gate's back SVG (e.g. "FOOD · LANGUAGE · TRADITIONS"), used to recognise backs in PDFs. */
export function backLabels(data) {
  const out = {};
  for (const g of data.gates) {
    const svg = readFileSync(join(ROOT, g.back_file), "utf8");
    out[g.gate] = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].replace(/&amp;/g, "&").trim());
  }
  return out;
}

export function launchOptions(settings) {
  return { executablePath: findBrowser(settings), headless: true, args: ["--font-render-hinting=none"] };
}

/** Font families allowed in the print PDFs and card renders (the project's own embedded fonts plus any opt-in extras). */
export function allowedFontFamilies(settings) {
  return ["Atkinson Hyperlegible", "Barlow Condensed", ...(settings.pdf?.allowed_extra_fonts || [])];
}

/** Locate a Chromium-based browser for PDF rendering. */
export function findBrowser(settings) {
  const candidates = [
    process.env.CHROME_PATH,
    settings?.browser?.executable_path,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("No Chrome/Edge/Chromium found. Set CHROME_PATH or browser.executable_path in config/print-settings.json.");
  return found;
}

export const MM_TO_PT = 72 / 25.4;
