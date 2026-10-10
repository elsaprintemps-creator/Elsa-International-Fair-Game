// Re-opens exports/cards_editable.docx and checks it, without Word:
// every card has an English and a French text box whose text reads back exactly as data/cards.json,
// the package is complete (fonts embedded, every picture present), and the pages are A4 landscape.
// Writes build/docx-check.json; exits 1 on any failure.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadProject, writeOut } from "./lib.mjs";
import { readCardTexts, normalizeText, tagOf } from "./docx-text.mjs";

const FILE = "exports/cards_editable.docx";
const { data } = loadProject();
const checks = [];
const ck = (name, ok, detail = "") => { checks.push({ name, ok: !!ok, detail: String(detail) }); console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` (${detail})` : ""}`); };

if (!existsSync(join(ROOT, FILE))) { console.error(`✗ ${FILE} is missing: run npm run build:docx`); process.exit(1); }
const { texts, duplicates, document, files } = readCardTexts(readFileSync(join(ROOT, FILE)));

const expected = data.cards.flatMap((c) => ["en", "fr"].map((lang) => ({ tag: tagOf(c, lang), want: normalizeText(lang === "en" ? c.text_en : c.text_fr) })));
const missing = expected.filter((e) => !texts.has(e.tag)).map((e) => e.tag);
ck(`Every card has its English and French text box (${expected.length})`, !missing.length && !duplicates.length && texts.size === expected.length,
  missing.length ? `missing ${missing.slice(0, 5).join(", ")}` : duplicates.length ? `duplicated ${duplicates.slice(0, 5).join(", ")}` : `${texts.size} boxes`);
const differ = expected.filter((e) => texts.has(e.tag) && texts.get(e.tag) !== e.want);
ck("Every text reads back exactly as data/cards.json (importing the untouched file changes nothing)", !differ.length,
  differ.slice(0, 3).map((e) => `${e.tag}: “${texts.get(e.tag)}” ≠ “${e.want}”`).join("; "));

const tables = (document.match(/<w:tbl>/g) || []).length;
const pages = (document.match(/<w:pageBreakBefore\/>/g) || []).length + 1;
ck(`${data.cards.length} cards drawn as Word tables, plus one layout table per page`, tables === data.cards.length + pages - 1, `${tables} tables, ${pages} pages`);
ck("Pages are A4 landscape", /<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"\/>/.test(document));

const fontTable = files.get("word/fontTable.xml")?.toString() || "";
const fontRels = files.get("word/_rels/fontTable.xml.rels")?.toString() || "";
const embeds = [...fontTable.matchAll(/<w:embed(Regular|Bold|Italic) r:id="([^"]+)"/g)];
const fontFilesOk = embeds.every(([, , id]) => { const t = (fontRels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`)) || [])[1]; return t && files.get(`word/${t}`)?.length > 10000; });
ck("Card fonts embedded (Atkinson Hyperlegible regular/bold/italic, Barlow Condensed bold/semibold/extrabold)", embeds.length === 6 && fontFilesOk, `${embeds.length} font files`);

const docRels = files.get("word/_rels/document.xml.rels")?.toString() || "";
const used = new Set([...document.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]));
const brokenImg = [...used].filter((id) => { const t = (docRels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`)) || [])[1]; return !t || !files.get(`word/${t}`)?.length; });
ck("Every picture is in the file (headers, flags, dividers, arrows, barcodes)", used.size > 0 && !brokenImg.length, `${used.size} pictures${brokenImg.length ? `, missing ${brokenImg.slice(0, 3).join(", ")}` : ""}`);

const ok = checks.every((c) => c.ok);
writeOut("build/docx-check.json", JSON.stringify({ file: FILE, ok, checks }, null, 2));
console.log(ok ? `✓ Word file: ${checks.length}/${checks.length} checks passed` : `✗ Word file: ${checks.filter((c) => !c.ok).length} check(s) failed`);
process.exit(ok ? 0 : 1);
