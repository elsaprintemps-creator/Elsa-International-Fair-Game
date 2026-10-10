// Imports the question/answer text from the editable Word file (exports/cards_editable.docx) after colleagues edited it.
//   npm run import-word -- path/to/cards_editable.docx            preview + validate + replace data/cards.json
//   npm run import-word -- path/to/cards_editable.docx --dry-run  preview + validate only
// Reads the English and French text box of every card (tracked changes count as accepted), keeps the exact
// current text wherever nothing changed (so typographic quotes or non-breaking spaces never count as edits),
// then hands over to scripts/import-edits.mjs: same checks, validation, backup and replacement as editor exports.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, readJSON } from "./lib.mjs";
import { readCardTexts, normalizeText, tagOf } from "./docx-text.mjs";
import { formatCardsJSON } from "../src/data-io.mjs";

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith("--"));
if (!src) { console.error("Usage: npm run import-word -- <cards_editable.docx> [--dry-run]"); process.exit(2); }
const srcPath = resolve(process.cwd(), src);
if (!existsSync(srcPath)) { console.error(`✗ File not found: ${srcPath}`); process.exit(2); }

let texts, duplicates;
try { ({ texts, duplicates } = readCardTexts(readFileSync(srcPath))); }
catch (e) { console.error(`✗ ${basename(srcPath)} could not be read as a Word document (.docx): ${e.message}`); process.exit(1); }

const current = readJSON("data/cards.json");
const problems = [];
for (const c of current.cards) for (const lang of ["en", "fr"]) if (!texts.has(tagOf(c, lang))) problems.push(`the ${lang === "en" ? "English" : "French"} text box of ${c.id} (${c.card_type}) is missing`);
for (const t of duplicates) problems.push(`the text box ${t.replace(/\|/g, " ")} appears twice`);
if (problems.length) {
  console.error(`✗ ${basename(srcPath)} is not a complete copy of the cards file, nothing was changed:\n  - ${problems.slice(0, 15).join("\n  - ")}${problems.length > 15 ? `\n  - … and ${problems.length - 15} more` : ""}`);
  process.exit(1);
}

// Unchanged text keeps its exact current value; changed text is stored plain (straight quotes, normal spaces).
const pick = (now, fromWord) => (fromWord === normalizeText(now) ? now : fromWord);
const incoming = { ...current, cards: current.cards.map((c) => ({ ...c, text_en: pick(c.text_en, texts.get(tagOf(c, "en"))), text_fr: pick(c.text_fr, texts.get(tagOf(c, "fr"))) })) };

const tmp = join(ROOT, "build", `${basename(srcPath, ".docx")}.from-word.json`);
mkdirSync(join(ROOT, "build"), { recursive: true });
writeFileSync(tmp, formatCardsJSON(incoming), "utf8");
const r = spawnSync(process.execPath, [join(ROOT, "scripts/import-edits.mjs"), tmp, ...args.filter((a) => a === "--dry-run")], { cwd: ROOT, stdio: "inherit" });
rmSync(tmp, { force: true });
process.exit(r.status ?? 1);
