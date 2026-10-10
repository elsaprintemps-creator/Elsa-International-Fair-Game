// Writes the print specification sheet for the university print department, from the current settings
// and the automated check results (so the numbers can never drift from the files):
//   docs/PRINT_SPECIFICATIONS.md      (spec_sheet.output_md)
//   exports/print_specifications.pdf  (spec_sheet.output_pdf), A4
// One content model, two renderers (Markdown and HTML→PDF).
import puppeteer from "puppeteer-core";
import { PDFDocument } from "pdf-lib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, loadProject, readJSON, writeOut, launchOptions, allowedFontFamilies } from "./lib.mjs";
import { esc } from "../src/templates.mjs";
import { inspectStructure } from "./pdf-inspect.mjs";

const { settings, data } = loadProject();
const check = readJSON("build/pdf-check.json");
const render = readJSON("build/pdf-report.json");
const val = readJSON("build/validation-report.json");
const shopPlan = readJSON("build/print-shop-plan.json");
const homePlan = readJSON("build/layout-plan.json");
const geo = readJSON("build/print-geometry.json");
const c = settings.card, ps = settings.print_shop, hp = settings.home_print, col = settings.color || {}, spec = settings.spec_sheet;
const today = new Date().toISOString().slice(0, 10);
const art = { w: c.trim_width_mm + 2 * c.bleed_mm, h: c.trim_height_mm + 2 * c.bleed_mm };
const safe = { w: +(c.trim_width_mm - 2 * c.safe_margin_mm).toFixed(1), h: +(c.trim_height_mm - 2 * c.safe_margin_mm).toFixed(1) };
const nQ = data.cards.filter((x) => x.card_type === "question").length, nA = data.cards.length - nQ;
const fileSize = (rel) => { try { return `${(readFileSync(join(ROOT, rel)).length / 1024 / 1024).toFixed(1)} MB`; } catch { return "—"; } };
const allOk = check.ok && render.ok && val.ok;

// Palette straight from design/tokens.css
const tokens = readFileSync(join(ROOT, "design/tokens.css"), "utf8");
const hex = (name) => (tokens.match(new RegExp(`--c-${name}:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1];
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(", ");
const palette = [["Navy", "navy", "text, frames, Gate B"], ["Deep teal", "teal-deep", "French text, Gate D"], ["Turquoise", "turquoise", "Gate A, accents"], ["Yellow", "yellow", "answer cards, Gate C, accents"], ["White", "white", "card grounds"], ["Bordeaux", "bordeaux", "Gate E"], ["Turquoise tint", "turquoise-tint", "light grounds"], ["Yellow tint", "yellow-tint", "answer card ground"]]
  .map(([n, k, use]) => [n, hex(k), `${rgbOf(hex(k))}`, use]);

// Page ranges per gate / card type in the print-shop PDF
const groups = [];
for (const p of shopPlan.pages) {
  const k = `${p.side}|${p.gate}|${p.card_type}`;
  if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, pages: [] });
  groups[groups.length - 1].pages.push(p);
}
const kindName = (t, g) => (t === "answer" ? "Answer" : g === "E" ? "Discussion (question)" : "Question");
const pageRows = (() => {
  if (shopPlan.page_order === "fronts-then-backs") {
    return groups.map((g) => { const f = g.pages[0], l = g.pages[g.pages.length - 1]; return [`${f.side === "front" ? "Fronts" : "Backs"}`, `Gate ${f.gate}`, kindName(f.card_type, f.gate), `${f.id}–${l.id}`, `${f.page}–${l.page}`]; });
  }
  const byGateType = [];
  for (const p of shopPlan.pages) {
    const k = `${p.gate}|${p.card_type}`;
    if (!byGateType.length || byGateType[byGateType.length - 1].k !== k) byGateType.push({ k, pages: [] });
    byGateType[byGateType.length - 1].pages.push(p);
  }
  return byGateType.map((g) => { const f = g.pages[0], l = g.pages[g.pages.length - 1]; const ids = g.pages.filter((p) => p.side === "front"); return [`Gate ${f.gate}`, kindName(f.card_type, f.gate), `${ids[0].id}–${ids[ids.length - 1].id}`, String(ids.length), `${f.page}–${l.page}`]; });
})();

const fontsList = [...new Set(check.shop.fonts)].join(", ");
const orderText = shopPlan.page_order === "fronts-then-backs"
  ? `Pages 1–${data.cards.length} are all fronts; pages ${data.cards.length + 1}–${data.cards.length * 2} are the backs in the same card order (page n + ${data.cards.length} is the back of page n).`
  : `Front and back alternate: every odd page is a card front and the following even page is that card's back (page 1 = front of card 1, page 2 = its back, …).`;

/* ------------------------------------------------------------ content model */
// Blocks: ["p", text] ["table", head[], rows[][]] ["list", items[]] ["check", items[]] ["note", text]
// Inline markup in text: **bold** and `code`.
const S = [];
const sec = (title, ...blocks) => S.push({ title, blocks });

sec("Status",
  ["note", `**Draft for confirmation.** These files follow generic professional defaults. They have **not** been checked against the University Publications/Printing Department's own requirements yet. Please review the checklist in section 9 and tell us what to change: every value below is a setting, and the files can be regenerated within minutes.`],
  ["p", `Generated ${today} from \`config/print-settings.json\`. Automated checks: ${allOk ? "**all passed**" : "**some failed — see section 8**"} (${val.checks.filter((x) => x.ok).length}/${val.checks.length} content, ${render.checks.filter((x) => x.ok).length}/${render.checks.length} render, ${check.checks.filter((x) => x.ok).length}/${check.checks.length} PDF inspection).`],
);

sec("1. Job summary",
  ["table", ["Item", "Specification"], [
    ["Product", "Bilingual (English / French) quiz and discussion cards for the International Fair, printed both sides"],
    ["Cards per deck", `**${data.cards.length} cards**: ${nQ} question cards + ${nA} answer cards (Gates A–D). Gate E has questions only. ${data.cards.length} different fronts, ${data.gates.length} back designs (one per gate).`],
    ["Finished (trim) size", `**${c.trim_width_mm} × ${c.trim_height_mm} mm**, portrait (${c.size_name || "custom size"}; see note in section 2)`],
    ["Bleed", `**${c.bleed_mm} mm** on every edge, giving an artwork size of ${art.w} × ${art.h} mm`],
    ["Safe area", `Text and essential artwork stay at least ${c.safe_margin_mm} mm inside the trim (inner ${safe.w} × ${safe.h} mm)`],
    ["Colours", `${col.requested_output || "Full colour both sides"}. File colour space: ${col.delivered_color_space || "RGB"}. No spot colours.`],
    ["Corners", `Square in the file. Rounded corners (about ${c.preview_corner_radius_mm} mm radius, as in the previews) are optional; please advise.`],
    ["Stock and finish", "To be advised by the print department. Suggestion: 300–350 g/m² coated card (matt or silk); lamination optional"],
    ["Quantity", "Number of decks to be confirmed by the organisers"],
  ]],
);

sec("2. Card size",
  ["p", `The target size is **${c.trim_width_mm} × ${c.trim_height_mm} mm**, the size commonly reported for UNO cards by retailers and accessory makers. **This is not an official Mattel/UNO specification**: no official specification was found, and one design guide gives 56 × 88 mm instead. The game is not affiliated with UNO or Mattel; the size was simply chosen to feel like a familiar compact card.`],
  ["p", `If the department prefers a standard size it already cuts (for example poker 63.5 × 88.9 mm or bridge 57.2 × 88.9 mm), change \`card.trim_width_mm\` / \`card.trim_height_mm\` and rebuild. The card layout is defined in millimetres and adapts; all fit and print checks are rerun automatically.`],
);

sec("3. Files supplied",
  ["table", ["File", "Use", "Pages", "Page size", "Size"], [
    [`\`${ps.output}\``, "**Print-ready file.** One card side per page, bleed, crop marks, TrimBox/BleedBox set on every page, bookmarks per gate", String(check.shop.pages), `${geo.shop.pageW} × ${geo.shop.pageH} mm`, fileSize(ps.output)],
    [`\`${hp.output}\``, "Office/home printing on A4, 3 × 3 cards per sheet, duplex, with cut marks, instructions and an alignment test page", String(check.home.pages), `${hp.paper_width_mm} × ${hp.paper_height_mm} mm`, fileSize(hp.output)],
    [`\`${spec.output_pdf}\``, "This specification", "—", "A4", "—"],
    ["`data/cards.csv`", "Card text as a spreadsheet, for proofreading (not for printing)", "—", "—", fileSize("data/cards.csv")],
  ]],
  ["p", `Print-shop page layout: the ${art.w} × ${art.h} mm artwork (trim + bleed) is centred on a ${geo.shop.pageW} × ${geo.shop.pageH} mm page with an ${ps.slug_mm} mm slug. Crop marks: ${ps.crop_marks ? `${ps.crop_mark_length_mm} mm long, ${ps.crop_mark_stroke_mm} mm, 100 % black, starting ${ps.crop_mark_offset_mm} mm outside the trim (so they never touch the bleed)` : "none"}. ${ps.slug_info_text ? "A small line of text in the slug names the card, side and page; it is outside the bleed and is cut away." : ""}`],
);

sec("4. Page order and card backs",
  ["p", orderText],
  ["table", shopPlan.page_order === "fronts-then-backs" ? ["Side", "Gate", "Card type", "Card IDs", "Pages"] : ["Gate", "Card type", "Card IDs", "Cards", "Pages"], pageRows],
  ["p", `Backs: each gate has one back design, shared by all its question and answer cards (${data.gates.map((g) => `${g.gate} = ${g.name_en}`).join("; ")}). Each back page in the file is the correct design for the card in front of it (verified automatically by reading the PDF).`],
  ["p", `Orientation: backs are supplied **upright, in the same orientation as their fronts** (head to head). On the finished card the top of the back is behind the top of the front. Please mirror the back positions on the press sheet according to how the sheet is turned for the second side (work-and-turn or work-and-tumble).`],
);

sec("5. Colour",
  ["p", `The PDFs are produced by a web browser engine, which always writes **RGB** (DeviceRGB; the values below are sRGB). Please convert to CMYK with the department's profile${col.cmyk_profile ? ` (${col.cmyk_profile})` : ""}. ${col.proof_required ? "**A printed proof is requested before the full run**: the turquoise and the yellow may shift in CMYK." : ""} Crop marks are RGB 0, 0, 0 (black). The small British and French flags printed before each sentence keep their national colours.`],
  ["table", ["Colour", "Hex", "RGB", "Used for"], palette],
);

sec("6. Fonts and artwork",
  ["list", [
    `Fonts: **${allowedFontFamilies(settings).join("** and **")}** (SIL Open Font License 1.1, embedding permitted). All fonts are embedded as subsets: ${fontsList}.`,
    "All text is live (not converted to outlines) and all artwork is vector. The PDFs contain **no raster images**.",
    `Any image added later must reach at least **${settings.pdf?.min_image_ppi ?? 300} ppi** at its printed size (checked automatically).`,
    `PDF version ${(check.checks.find((x) => x.name.includes("header"))?.detail || "").split(",")[0].replace("%PDF-", "")}; standard PDF, not PDF/X. If PDF/X-1a or PDF/X-4 is required, the department's prepress step will need to convert it.`,
  ]],
);

sec("7. Office or home printing (A4 file)",
  ["list", [
    `${homePlan.sheets.length} duplex A4 sheets, ${hp.columns} × ${hp.rows} cards per sheet${hp.include_bleed ? ` with ${c.bleed_mm} mm bleed (two cuts ${2 * c.bleed_mm} mm apart between neighbouring cards)` : ""}; each sheet holds one gate only.`,
    `Print at **100 % / actual size**, two-sided, **${hp.duplex_flip === "long-edge" ? "flip on long edge" : "flip on short edge"}**. Pages 1–2 are instructions; pages ${homePlan.alignment_test ? `${homePlan.alignment_test.front_page}–${homePlan.alignment_test.back_page}` : "—"} are an alignment test to print first; cards start on page ${homePlan.first_card_page}.`,
    `Cut along the crop marks on the front side. A printer's duplex shift can be corrected with \`home_print.back_offset_x_mm\` / \`back_offset_y_mm\`.`,
  ]],
);

sec("8. Automated verification of the delivered files",
  ["p", "Checked by reading the finished PDFs with two independent PDF parsers (pdf-lib and pdf.js), plus the browser render checks:"],
  ["list", [
    ...check.checks.filter((x) => x.group !== "method").map((x) => `${x.ok ? "✓" : "✗"} ${x.name.replace(/^exports\//, "")}${x.detail && x.detail.length < 90 ? ` — ${x.detail}` : ""}`),
    ...render.checks.filter((x) => /fits|clipped|minimum|project fonts|Duplex map|Gate-pure/.test(x.name)).map((x) => `${x.ok ? "✓" : "✗"} ${x.name}`),
    `${val.ok ? "✓" : "✗"} Content: ${val.counts.questions} question cards, ${val.counts.answers} answer cards, ${val.counts.matched_pairs} matched pairs, 0 Gate E answers, ${val.counts.physical_cards} cards`,
  ]],
);

sec("9. Please confirm or tell us what to change",
  ["check", [
    `Finished size ${c.trim_width_mm} × ${c.trim_height_mm} mm is acceptable (or give the size you need).`,
    `Bleed of ${c.bleed_mm} mm is what you need (some workflows ask for 2 mm or 5 mm).`,
    `Crop marks are wanted, at ${ps.crop_mark_offset_mm} mm offset (or supply without marks for your own imposition).`,
    "An RGB PDF is accepted, or name the required format (PDF/X-1a, PDF/X-4) and CMYK profile.",
    `Page order "${shopPlan.page_order}" suits you (alternative: all fronts, then all backs).`,
    "Paper/card weight, finish, lamination and corner rounding.",
    `Cutting tolerance is within the ${c.safe_margin_mm} mm safe margin.`,
    "Quantity (number of decks) and delivery date.",
    "A printed proof before the full run.",
  ]],
  ["p", spec.contact_note || ""],
);

sec("10. How settings are changed (for the organisers)",
  ["table", ["Setting in config/print-settings.json", "Current value"], [
    ["`card.trim_width_mm` / `card.trim_height_mm`", `${c.trim_width_mm} / ${c.trim_height_mm} mm`],
    ["`card.bleed_mm`", `${c.bleed_mm} mm`],
    ["`card.safe_margin_mm`", `${c.safe_margin_mm} mm`],
    ["`print_shop.page_order`", ps.page_order],
    ["`print_shop.crop_marks` / `crop_mark_offset_mm` / `crop_mark_length_mm`", `${ps.crop_marks} / ${ps.crop_mark_offset_mm} mm / ${ps.crop_mark_length_mm} mm`],
    ["`print_shop.slug_mm`", `${ps.slug_mm} mm`],
    ["`print_shop.set_pdf_boxes`", String(ps.set_pdf_boxes)],
    ["`color.*`", "colour request printed in this sheet (the file itself is always RGB)"],
    ["`pdf.min_image_ppi` / `pdf.allowed_extra_fonts`", `${settings.pdf?.min_image_ppi} ppi / ${(settings.pdf?.allowed_extra_fonts || []).join(", ") || "none"}`],
    ["`home_print.duplex_flip` / `back_offset_*_mm`", `${hp.duplex_flip} / ${hp.back_offset_x_mm}, ${hp.back_offset_y_mm} mm`],
  ]],
  ["p", "After changing a value, run `npm run build`: it regenerates both PDFs, this sheet and the previews, and reruns every check."],
);

/* ------------------------------------------------------------ renderers */
const mdInline = (s) => s;
// ✓ / ✗ are drawn as vector marks so the PDF contains only the project fonts.
const TICK = '<svg class="mk ok" viewBox="0 0 10 10" aria-label="passed"><path d="M1.5 5.3 4 7.8 8.6 2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CROSS = '<svg class="mk bad" viewBox="0 0 10 10" aria-label="failed"><path d="M2 2l6 6M8 2 2 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const htmlInline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/✓/g, TICK).replace(/✗/g, CROSS).replace(/≥\s*/g, "at least ");
const mdCell = (s) => String(s).replace(/\|/g, "\\|");

function toMarkdown() {
  const out = [`# Print specification — International Fair "Airport Gates" cards`, "", `_Generated automatically by \`npm run build\` on ${today}. Do not edit by hand: change \`config/print-settings.json\` and rebuild._`, ""];
  for (const s of S) {
    out.push(`## ${s.title}`, "");
    for (const [kind, a, b] of s.blocks) {
      if (kind === "p" && a) out.push(mdInline(a), "");
      if (kind === "note") out.push(`> ${mdInline(a)}`, "");
      if (kind === "list") out.push(...a.map((x) => `- ${mdInline(x)}`), "");
      if (kind === "check") out.push(...a.map((x) => `- [ ] ${mdInline(x)}`), "");
      if (kind === "table") out.push(`| ${a.join(" | ")} |`, `|${a.map(() => "---").join("|")}|`, ...b.map((r) => `| ${r.map(mdCell).join(" | ")} |`), "");
    }
  }
  return out.join("\n");
}

function toHtml() {
  const body = S.map((s) => `<section><h2>${esc(s.title)}</h2>${s.blocks.map(([kind, a, b]) => {
    if (kind === "p") return a ? `<p>${htmlInline(a)}</p>` : "";
    if (kind === "note") return `<p class="note">${htmlInline(a)}</p>`;
    if (kind === "list") return `<ul>${a.map((x) => `<li>${htmlInline(x)}</li>`).join("")}</ul>`;
    if (kind === "check") return `<ul class="check">${a.map((x) => `<li>${htmlInline(x)}</li>`).join("")}</ul>`;
    if (kind === "table") return `<table><thead><tr>${a.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.map((r) => `<tr>${r.map((x) => `<td>${htmlInline(String(x))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    return "";
  }).join("")}</section>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Print specification</title>
<link rel="stylesheet" href="../design/fonts.css"><link rel="stylesheet" href="../design/tokens.css">
<style>
@page { size: A4; margin: 14mm 15mm 14mm; }
html, body { margin: 0; background: #FFFFFF; }
body { font-family: var(--font-text); font-size: 9.2pt; line-height: 1.42; color: var(--c-navy); }
header { background: var(--c-navy); color: var(--c-white); padding: 6mm 7mm 5mm; border-radius: 2mm; margin-bottom: 5mm; }
header .eb { font-family: var(--font-sign); font-weight: 700; letter-spacing: .14em; font-size: 8pt; color: var(--c-yellow); }
header h1 { margin: 1mm 0 0; font-family: var(--font-sign); font-weight: 800; font-size: 22pt; line-height: 1; }
header p { margin: 1.5mm 0 0; font-size: 9pt; color: #FFFFFF; }
h2 { font-family: var(--font-sign); font-weight: 800; font-size: 13pt; margin: 5mm 0 1.5mm; padding-bottom: .8mm; border-bottom: .5mm solid var(--c-turquoise); break-after: avoid; }
section { break-inside: auto; }
p { margin: 1.4mm 0; }
.note { padding: 2.5mm 3mm; background: var(--c-yellow-tint); border-left: 1.2mm solid var(--c-yellow); }
code { font-family: var(--font-sign); font-weight: 600; font-size: 9.4pt; letter-spacing: .02em; background: var(--c-turquoise-tint); padding: 0 .8mm; border-radius: .8mm; }
table { width: 100%; border-collapse: collapse; margin: 2mm 0; font-size: 8.6pt; break-inside: auto; }
tr { break-inside: avoid; }
th { text-align: left; font-family: var(--font-sign); font-weight: 700; letter-spacing: .05em; background: var(--c-navy); color: var(--c-white); padding: 1.2mm 1.8mm; }
td { padding: 1.1mm 1.8mm; border-bottom: .2mm solid var(--c-turquoise-tint); vertical-align: top; }
ul { margin: 1mm 0; padding-left: 5mm; }
li { margin: .7mm 0; }
ul.check { list-style: none; padding-left: 0; }
ul.check li { padding-left: 6mm; position: relative; }
.mk { display: inline-block; width: 1em; height: 1em; vertical-align: -.15em; margin-right: .2em; }
.mk.ok { color: var(--c-teal-deep); } .mk.bad { color: var(--c-bordeaux); }
ul.check li::before { content: ""; position: absolute; left: 0; top: .6mm; width: 3mm; height: 3mm; border: .35mm solid var(--c-navy); border-radius: .5mm; }
</style></head><body>
<header><div class="eb">INTERNATIONAL FAIR · AIRPORT GATES · PRINT SPECIFICATION</div><h1>Print specification — card game</h1><p>For the University Publications / Printing Department · generated ${today}</p></header>
${body}
</body></html>`;
}

writeOut(spec.output_md, toMarkdown());
writeOut("build/print_specifications.html", toHtml());

const browser = await puppeteer.launch(launchOptions(settings));
const page = await browser.newPage();
await page.goto(pathToFileURL(join(ROOT, "build/print_specifications.html")).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const outPdf = join(ROOT, spec.output_pdf);
mkdirSync(dirname(outPdf), { recursive: true });
await page.pdf({ path: outPdf, preferCSSPageSize: true, printBackground: true });
await browser.close();

const pdf = await PDFDocument.load(readFileSync(outPdf));
pdf.setTitle("Airport Gates cards — print specification", { showInWindowTitleBar: true });
pdf.setAuthor(settings.pdf?.author || "International Fair");
pdf.setSubject("Print specification for the university print department");
writeFileSync(outPdf, await pdf.save());

// The spec sheet itself: valid, every font embedded, only the project fonts.
const s = await inspectStructure(outPdf);
const notEmbedded = s.fonts.filter((f) => !f.embedded);
const allowed = allowedFontFamilies(settings).map((x) => x.replace(/\s+/g, ""));
const foreign = s.fonts.filter((f) => !allowed.some((a) => f.name.startsWith(a)));
if (s.parse_error || notEmbedded.length || foreign.length) { console.error("✗ print_specifications.pdf:", s.parse_error || [...notEmbedded, ...foreign].map((f) => f.base).join(", ")); process.exit(1); }
console.log(`✓ ${spec.output_md}`);
console.log(`✓ ${spec.output_pdf} — ${s.pages} A4 pages, ${s.fonts.length} fonts, all embedded (${[...new Set(s.fonts.map((f) => f.name))].join(", ")})`);
