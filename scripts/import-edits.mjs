// Safely replaces data/cards.json with a file exported from the web editor (editor/index.html).
//   npm run import-edits -- path/to/cards_2026-10-10_1432.json            preview + validate + replace
//   npm run import-edits -- path/to/cards_2026-10-10_1432.json --dry-run  preview + validate only
// Steps: 1) check the file has exactly the same cards (IDs, types, gates) as the current data;
//        2) take ONLY question/answer text from it (sources and notes stay as they are in data/cards.json);
//        3) validate the result with scripts/validate.mjs on a temporary copy;
//        4) back up the current file to data/backups/ and write the new data/cards.json.
// Nothing is changed if any step fails. Afterwards run `npm run build`.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, readJSON } from "./lib.mjs";
import { formatCardsJSON } from "../src/data-io.mjs";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const src = args.find((a) => !a.startsWith("--"));
if (!src) { console.error("Usage: npm run import-edits -- <exported-file.json> [--dry-run]"); process.exit(2); }
const srcPath = resolve(process.cwd(), src);
if (!existsSync(srcPath)) { console.error(`✗ File not found: ${srcPath}`); process.exit(2); }

let incoming;
try { incoming = JSON.parse(readFileSync(srcPath, "utf8").replace(/^﻿/, "")); }
catch (e) { console.error(`✗ ${basename(srcPath)} is not valid JSON: ${e.message}`); process.exit(1); }

const current = readJSON("data/cards.json");
const key = (c) => `${c.id}|${c.card_type}`;
const problems = [];
if (!incoming || !Array.isArray(incoming.cards)) problems.push("no “cards” list");
else {
  const cur = new Map(current.cards.map((c) => [key(c), c]));
  const seen = new Set();
  for (const c of incoming.cards) {
    const k = key(c);
    if (seen.has(k)) problems.push(`duplicate ${c.id} (${c.card_type})`);
    seen.add(k);
    if (!cur.has(k)) problems.push(`unexpected card ${c.id} (${c.card_type})`);
    else if (cur.get(k).gate !== c.gate) problems.push(`${c.id} (${c.card_type}) moved from Gate ${cur.get(k).gate} to ${c.gate}`);
    if (typeof c.text_en !== "string" || typeof c.text_fr !== "string") problems.push(`${c.id} (${c.card_type}) has no text_en/text_fr`);
  }
  for (const k of cur.keys()) if (!seen.has(k)) problems.push(`missing card ${k.replace("|", " ")}`);
}
if (problems.length) {
  console.error(`✗ ${basename(srcPath)} does not match the deck, nothing was changed:\n  - ${problems.slice(0, 15).join("\n  - ")}`);
  process.exit(1);
}

// Apply text only, keeping every other field (sources, notes, order) from the current data.
const byKey = new Map(incoming.cards.map((c) => [key(c), c]));
const changes = [];
let otherDiffs = 0;
const next = { ...current, cards: current.cards.map((c) => {
  const inc = byKey.get(key(c));
  const out = { ...c };
  for (const f of ["text_en", "text_fr"]) {
    const v = inc[f].replace(/\s*[\r\n]+\s*/g, " ").trim();
    if (v !== c[f]) { changes.push({ card: `${c.id} ${c.card_type}`, field: f === "text_fr" ? "FR" : "EN", from: c[f], to: v }); out[f] = v; }
  }
  for (const f of Object.keys(c)) if (!["text_en", "text_fr"].includes(f) && JSON.stringify(inc[f]) !== JSON.stringify(c[f])) otherDiffs++;
  return out;
}) };

console.log(`${basename(srcPath)}: ${changes.length} text change(s) in ${new Set(changes.map((x) => x.card)).size} card(s).`);
for (const ch of changes) console.log(`  • ${ch.card} [${ch.field}]\n      was: ${ch.from}\n      now: ${ch.to}`);
if (otherDiffs) console.log(`  ℹ ${otherDiffs} other field(s) (sources, notes…) differ in the file; they were NOT imported — data/cards.json keeps its own values.`);
if (!changes.length) { console.log("Nothing to import."); process.exit(0); }

// Validate on a temporary copy first.
const tmpRel = "build/_import-candidate.json";
mkdirSync(join(ROOT, "build"), { recursive: true });
writeFileSync(join(ROOT, tmpRel), formatCardsJSON(next), "utf8");
const v = spawnSync(process.execPath, [join(ROOT, "scripts/validate.mjs")], { cwd: ROOT, env: { ...process.env, CARDS_FILE: tmpRel }, encoding: "utf8" });
rmSync(join(ROOT, tmpRel), { force: true });
process.stdout.write(v.stdout);
if (v.status !== 0) { console.error("✗ The imported text fails validation (see above). data/cards.json was NOT changed. Fix the cards in the editor and export again."); process.exit(1); }

if (dry) { console.log("✓ Dry run: the file is valid. Run again without --dry-run to replace data/cards.json."); process.exit(0); }

const d = new Date(), p = (n) => String(n).padStart(2, "0");
const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
mkdirSync(join(ROOT, "data/backups"), { recursive: true });
const backup = `data/backups/cards_${stamp}.json`;
copyFileSync(join(ROOT, "data/cards.json"), join(ROOT, backup));
writeFileSync(join(ROOT, "data/cards.json"), formatCardsJSON(next), "utf8");
console.log(`✓ data/cards.json updated (${changes.length} change(s)). Previous version saved as ${backup}.`);
console.log("Next: run `npm run build` to regenerate the PDFs, the preview and the editor, then check preview/preview_gallery.html.");
