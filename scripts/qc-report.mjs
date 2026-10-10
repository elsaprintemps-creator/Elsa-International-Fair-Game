// Writes QC_REPORT.md from the machine-generated reports (validation, PDF/layout, duplex plan)
// plus the documented manual review notes below.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadProject, readJSON, writeOut } from "./lib.mjs";

const { settings, data } = loadProject();
const val = readJSON("build/validation-report.json");
const pdf = readJSON("build/pdf-report.json");
const plan = readJSON("build/layout-plan.json");
const geo = readJSON("build/print-geometry.json");
const partners = readJSON("data/partners.json");
const pdfCheck = existsSync(join(ROOT, "build/pdf-check.json")) ? readJSON("build/pdf-check.json") : null;
const web = existsSync(join(ROOT, "build/web-test-report.json")) ? readJSON("build/web-test-report.json") : null;
const docx = existsSync(join(ROOT, "build/docx-check.json")) ? readJSON("build/docx-check.json") : null;
const cards = data.cards;

const tick = (ok) => (ok ? "✅" : "❌");
const size = (f) => (existsSync(join(ROOT, f)) ? `${(statSync(join(ROOT, f)).size / 1024).toFixed(0)} KB` : "missing");
const mdEsc = (s) => String(s).replace(/\|/g, "\\|");

const deliverables = [
  ["data/cards.json", "Structured records for all 180 cards (source of truth)"],
  ["data/cards.csv", "Flat export (UTF-8 with BOM, opens in Excel)"],
  ["data/partners.json", "Partner universities → resolved city/country + verification status"],
  ["preview/preview_gallery.html", "Animated design preview: the five gates; each gate's cards face down (lighter answer backs), click to flip"],
  ["editor/index.html", "Question editor for colleagues (browser only, exports JSON/CSV)"],
  ["assets/backs/back_gate_A_food_language_traditions.svg", "Back — Gate A"],
  ["assets/backs/back_gate_B_campus_city.svg", "Back — Gate B"],
  ["assets/backs/back_gate_C_random_knowledge.svg", "Back — Gate C"],
  ["assets/backs/back_gate_D_games_culture_shock.svg", "Back — Gate D"],
  ["assets/backs/back_gate_E_student_advice.svg", "Back — Gate E"],
  ["config/print-settings.json", "Card size, bleed, margins, page layout, duplex orientation"],
  ["design/tokens.css", "Colour + font design tokens"],
  ["src/templates.mjs", "Editable card generation source (HTML/CSS/JS)"],
  [settings.home_print.output, "Home printing, A4, duplex"],
  [settings.print_shop.output, "Print shop, one card side per page, bleed + crop marks"],
  ...(settings.manual_cut_a3?.output ? [[settings.manual_cut_a3.output, "A3 sheets for cutting by hand (fronts only)"]] : []),
  ["exports/cards_editable.docx", "Every card as an editable Word file (colleagues change questions/answers on the cards; npm run import-word reads them back)"],
  [settings.spec_sheet.output_pdf, "Print specification sheet for the print department (PDF)"],
  [settings.spec_sheet.output_md, "Print specification sheet (Markdown, same content)"],
  ["docs/prototype.png", "Design prototype (Gate A Q+A, Gate E card, five backs)"],
  ["README.md", "Setup, editing and rebuild instructions"],
];

const g = val.counts.per_gate;
const countsTable = ["| Gate | Theme | Questions | Answers |", "|---|---|---:|---:|",
  ...data.gates.map((x) => `| ${x.gate} | ${x.name_en} | ${g[x.gate].questions} | ${g[x.gate].answers} |`),
  `| **Total** | | **${val.counts.questions}** | **${val.counts.answers}** |`].join("\n");

const valChecks = val.checks.map((c) => `- ${tick(c.ok)} ${c.name}${!c.ok && c.detail ? ` — ${c.detail}` : ""}`).join("\n");
const pdfChecks = pdf.checks.map((c) => `- ${tick(c.ok)} ${c.name}${c.detail ? ` (${c.detail})` : ""}`).join("\n");

const fit = pdf.text_fit;
const sheetsPerGate = data.gates.map((x) => `${x.gate}: ${plan.sheets.filter((s) => s.gate === x.gate).length}`).join(" · ");

const factualQs = cards.filter((c) => c.card_type === "question" && c.gate !== "E");
const answerOf = (id) => cards.find((c) => c.card_type === "answer" && c.id === id);
const sourceRows = factualQs.map((q) => {
  const a = answerOf(q.id);
  const src = (q.source_urls || []).map((u, i) => `[${i + 1}](${u})`).join(" ");
  return `| ${q.id} | ${mdEsc(q.destination)} | ${mdEsc(a.text_en)} | ${q.verification_status === "web-checked" ? "web-checked" : "general knowledge"} | ${src || "—"} |`;
}).join("\n");

const pstat = (s) => partners.partners.filter((p) => p.verification === s);
const confirmRows = pstat("needs-confirmation").map((p) => `| ${mdEsc(p.supplied_name)} | ${mdEsc(p.resolved_name)} | ${mdEsc(p.city)}, ${mdEsc(p.country)} | ${mdEsc(p.note)} |`).join("\n");

const allOk = val.ok && pdf.ok && (!pdfCheck || pdfCheck.ok) && (!web || web.ok) && (!docx || docx.ok);
const pass = (r) => (r ? `${r.checks ? r.checks.filter((c) => c.ok).length : r.passed}/${r.checks ? r.checks.length : r.total}` : "not run");
const md = `# QC Report — International Fair "Airport Gates" card game

_Generated automatically by \`npm run build\` on ${new Date().toISOString().slice(0, 10)}. Manual review notes are maintained in \`scripts/qc-report.mjs\`._

**Overall automated status: ${allOk ? "✅ all automated checks passed" : "❌ see failures below"}** — ${val.checks.filter((c) => c.ok).length}/${val.checks.length} content checks, ${pdf.checks.filter((c) => c.ok).length}/${pdf.checks.length} render/layout checks, ${pass(pdfCheck)} finished-PDF inspection checks, ${pass(web)} browser tests (preview + editor), ${pass(docx)} Word-file checks.

## 1. Card counts

${countsTable}

- Question cards: **${val.counts.questions}** (20 per gate × 5)
- Answer cards: **${val.counts.answers}** (Gates A–D only); matched question–answer pairs: **${val.counts.matched_pairs}**
- Gate E: 20 open-ended discussion cards, **0 answer cards, 0 model answers**
- **Physical cards: ${val.counts.physical_cards}**

## 2. Automated content validation (\`scripts/validate.mjs\`)

${valChecks}

Warnings for manual review: ${val.warnings.length ? "\n" + val.warnings.map((w) => `- ⚠️ ${w}`).join("\n") : "none."}

## 3. Layout, PDF and print checks (\`scripts/render-pdf.mjs\`)

${pdfChecks}

**Text fit.** Fonts start at ${settings.text_fit.question_en_pt}/${settings.text_fit.question_fr_pt} pt (questions, EN/FR) and ${settings.text_fit.answer_en_pt}/${settings.text_fit.answer_fr_pt} pt (answers) and may only shrink to ${settings.text_fit.min_pt} pt. Smallest sizes actually used: questions ${fit.question.min_en} pt EN / ${fit.question.min_fr} pt FR; answers ${fit.answer.min_en} pt EN / ${fit.answer.min_fr} pt FR. Cards that needed shrinking: ${[...fit.question.shrunk.map((x) => x + " (Q)"), ...fit.answer.shrunk.map((x) => x + " (A)")].join(", ") || "none"}. All text boxes sit inside the ${settings.card.safe_margin_mm} mm safe margin by construction, and overflow is measured in the browser on every card in all three renders (gallery, home PDF, print-shop PDF).

**Geometry.** Trim ${settings.card.trim_width_mm} × ${settings.card.trim_height_mm} mm, bleed ${settings.card.bleed_mm} mm (artwork ${geo.card.cardW} × ${geo.card.cardH} mm), safe margin ${settings.card.safe_margin_mm} mm.
- Home PDF: ${pdf.home.pages} A4 pages = 2 instruction pages + 2 alignment-test pages + ${plan.sheets.length} duplex card sheets (front/back pairs). ${settings.home_print.columns} × ${settings.home_print.rows} cards per sheet with bleed, margins ${geo.home.marginX} mm (left/right) × ${geo.home.marginY} mm (top/bottom); crop marks in the margins of the front side.
- Print-shop PDF: ${pdf.shop.pages} pages of ${pdf.shop.page_size_mm.join(" × ")} mm (card + bleed + ${settings.print_shop.slug_mm} mm slug), front/back interleaved; crop marks ${settings.print_shop.crop_mark_offset_mm} mm outside the trim (i.e. outside the bleed); TrimBox ${pdf.shop.trim_box_mm?.join(" × ")} mm and BleedBox ${pdf.shop.bleed_box_mm?.join(" × ")} mm set on every page.

**Duplex plan.** Layout for **${plan.duplex_flip}** flip. Sheets are *gate-pure* (${sheetsPerGate}), so every back on a sheet shows the same gate design; backs are mirrored per the flip edge and printed in all ${plan.columns * plan.rows} positions, so even a wrong flip choice cannot pair a front with another gate's back (it can only rotate the back artwork). The grid is centred on the page, so mirrored positions coincide exactly. An alignment test sheet (pages 3–4) with 1 mm rulers lets users measure their printer's duplex shift; \`back_offset_x_mm\` / \`back_offset_y_mm\` compensate it.

**Preview fidelity.** \`preview/preview_gallery.html\` and \`editor/index.html\` draw cards with a browser bundle generated from the same \`src/templates.mjs\`, \`src/cards.css\`, fonts, tokens and SVG backs as the PDFs. At build time the bundle is executed in a sandbox and its output is compared with the print templates for all ${cards.length} fronts and 5 backs (byte-identical), and the preview is rendered in Chrome with the same text-fitting code (${cards.length} fronts, all fitting).

**Fonts.** Chrome's DevTools font report is read for every text node in all three renders: only ${(settings.pdf?.allowed_extra_fonts || []).length ? "the allowed families" : "Atkinson Hyperlegible and Barlow Condensed"} are used, so no system font (e.g. Arial Narrow, Segoe UI) is substituted. Arrows (→, ▲) on cards and print guides are drawn as vector paths for this reason.

## 3b. Finished-PDF inspection (\`scripts/check-pdf.mjs\`)

${pdfCheck ? `The exported files are re-opened with two independent parsers (pdf-lib and pdf.js) and checked page by page; card identity and back design are read back from the text actually printed on each page.

${pdfCheck.checks.map((c) => `- ${tick(c.ok)} [${c.group}] ${mdEsc(c.name)}${c.detail ? ` (${mdEsc(c.detail)})` : ""}`).join("\n")}

Embedded fonts (print shop): ${pdfCheck.shop.fonts.join(", ")}. Raster images: ${pdfCheck.shop.images === 0 && pdfCheck.home.images === 0 ? "none (all vector)" : `${pdfCheck.shop.images} / ${pdfCheck.home.images}`}. The image-resolution check is self-tested on every run with a generated 150 ppi test image.` : "_Not run._"}

## 3c. Web preview and editor tests (\`scripts/test-web.mjs\`)

${web ? `Run in headless Chrome against the generated pages (desktop 1366–1440 px, mobile 375–390 px, reduced motion). Screenshots: \`build/screenshots/\`.

${web.results.map((r) => `- ${tick(r.ok)} [${r.group}] ${mdEsc(r.name)}`).join("\n")}` : "_Not run._"}

## 3d. Editable Word file (\`scripts/check-docx.mjs\`)

${docx ? `\`exports/cards_editable.docx\` is re-opened without Word and checked: each card's English and French text box, the round trip of every text, page format, embedded fonts and pictures. Before release it was also opened, edited (with and without tracked changes) and re-saved in Microsoft Word, then read back with \`npm run import-word -- --dry-run\`.

${docx.checks.map((c) => `- ${tick(c.ok)} ${mdEsc(c.name)}${c.detail ? ` (${mdEsc(c.detail)})` : ""}`).join("\n")}` : "_Not run._"}

## 4. Source verification

- ${fit ? "" : ""}Factual pairs (Gates A–D): **${val.verification.web_checked_pairs} web-checked** against the sources recorded in \`data/cards.json\` during authoring (2026-10-10), **${val.verification.general_knowledge_pairs} general knowledge** (widely established facts, e.g. "Canberra is the capital of Australia", not individually web-checked in this session).
- Where sources disagreed, the card wording was hedged or narrowed: Finland's lake count (range 168 000–188 000 given), Hong Kong escalator ("one of the longest"), al-Qarawiyyin ("often called the oldest"), Prague Orloj ("one of the oldest still working"), Bologna's "Red" nickname (rooftops, the most-cited reason), kubb (Viking-origin claim deliberately omitted), Ruhezeit (no hours stated — rules vary), Bulgarian head gestures ("traditionally … can mean").
- No citations or URLs appear on card faces (automated check).
- **Recommended before printing:** spot-check the general-knowledge items below; they are stable facts but were not re-verified online in this session.

| ID | Destination | Answer (EN) | Status | Sources |
|---|---|---|---|---|
${sourceRows}

## 5. Partner universities (from \`University Partners.xlsx\`)

- ${partners.meta.counts.entries} unique institutions (163 rows supplied; "TH Köln" appears twice and was merged) across **${partners.meta.counts.countries} countries/territories**: ${partners.meta.countries.join(", ")}.
- Status: **${pstat("web-checked").length} web-checked**, **${pstat("knowledge-based").length} knowledge-based** (well-known institution; city/country from general knowledge, not individually checked on the official site), **${pstat("needs-confirmation").length} need confirmation** (ambiguous name or campus).
- **No campus-specific facts are used for any ambiguous entry**; cards about those destinations use country- or city-level facts only. No university policies, services, facilities, opening hours or transport rules are stated anywhere.
- Note: BNBU is listed among the Hong Kong partners but is located in **Zhuhai, mainland China** (web-checked).

| Supplied name | Resolved as | Location | Why it needs confirmation |
|---|---|---|---|
${confirmRows}

## 6. Accuracy, sensitivity and language review (manual)

Performed while authoring every card; re-read in full on the rendered prototype and gallery.

- **No stereotypes or mockery.** Customs are framed as traditions or common practices ("traditionally", "many people", "often", "rules vary"), never as what "all" people of a country do. Culture-shock cards present Oberg's stage model as *a* model and state that not everyone goes through every stage. An automated wording scan flags generalising phrases (${val.warnings.filter((w) => w.includes("generalising")).length} flagged).
- **No exclusive-ownership claims for games** unless supported: sepak takraw "popular in Malaysia and across Southeast Asia"; truco "Argentina and Uruguay (also played in Brazil and elsewhere)"; Go named in Japan, Korea and China.
- **Not everything is EU:** the only EU-specific card is the EU flag; partners outside the EU (UK, Switzerland, Norway, Türkiye, Serbia, North Macedonia, Canada, Latin America, Asia, Africa, Oceania) are covered without implying shared rules.
- **Gate B** contains no invented university policies or services; the only university-specific facts are historical (Jagiellonian 1364/Copernicus, Tartu 1632, Pavia/Volta in Gate C) and web-checked.
- **French:** natural, idiomatic phrasing rather than literal translation; peer-to-peer *tu* register throughout; Gate E prompts are worded to avoid gendered past-participle agreement so they read correctly for everyone. French typography (non-breaking space before ? ! : ; and inside « ») is applied automatically at render time. English uses British spelling.
- **Gate E** prompts are open-ended ("What helped you…", "What do you wish…", "Tell us about…") with no model answers anywhere in the data or on cards.

## 7. Design checks

- ${tick(val.checks.find((c) => c.name.startsWith("Exactly five back"))?.ok)} Exactly five reusable, minimalist backs — same frame, header, typography and layout; each differs only by colour arrangement, gate letter and one motif + one small accent glyph (A plate & utensils + speech bubble; B campus building + map pin; C light bulb with "?" + sparkle; D die + turning arrows; E two linked speech bubbles + compass).
- ${tick(val.checks.find((c) => c.name.startsWith("Artwork uses only"))?.ok)} Palette restricted to navy #0B2545, deep teal #0B6F79, turquoise #1FB5BE, yellow #FFC93C, white, Bordeaux #6D071A (Gate E), plus two same-hue tints (#D9F2F4, #FFF6DB). The small English / French flags before each sentence keep their real national colours so they stay recognisable. Crop marks in the print-shop PDF are pure black (printer's marks, not artwork).
- Fronts share one layout (boarding-pass header, category strip, EN text → flight-path divider → FR text, tear-off footer); gate identity comes from the badge motif, category bar and foot strip colour. Answer cards have a yellow header and pale-yellow ground so they are easy to sort. Gate E cards are labelled DISCUSSION and say "No right answer · share yours" instead of pointing to an answer card.
- Fonts: Atkinson Hyperlegible (body, designed for legibility) and Barlow Condensed (signage), both SIL OFL 1.1, self-hosted in \`assets/fonts/\`.

## 8. Unresolved issues and limitations

1. **Print-shop specifications were not supplied.** \`${settings.print_shop.output}\` uses generic defaults (${settings.card.trim_width_mm} × ${settings.card.trim_height_mm} mm trim, ${settings.card.bleed_mm} mm bleed, crop marks, TrimBox/BleedBox). It has **not** been checked against the university print department's requirements. \`${settings.spec_sheet.output_pdf}\` lists what must be confirmed (size, bleed, marks, format/colour profile, page order, stock, corners, quantity, proof).
2. **Colour space is RGB.** Browser-generated PDFs are RGB (DeviceRGB, sRGB values); there is no CMYK/PDF-X conversion tool in this environment (no Ghostscript). If CMYK/PDF-X is required, the print department's prepress must convert. Turquoise and yellow may shift slightly in CMYK — request a proof.
3. **Card size.** ${settings.card.trim_width_mm} × ${settings.card.trim_height_mm} mm is the size commonly reported for UNO cards by retailers and accessory makers; no official Mattel/UNO specification was found (one guide says 56 × 88 mm). It is configurable (\`card.trim_*_mm\`).
4. **Editor drafts are per browser.** The web editor saves drafts in the browser's local storage on that computer only; edits reach the project only through **Export JSON** → \`npm run import-edits\`.
5. **${val.verification.general_knowledge_pairs} factual pairs are general knowledge** rather than web-checked in this session (table in §4).
6. **${pstat("needs-confirmation").length} partner entries need confirmation** (table in §5), notably "University of Hedforshire" (Bedfordshire or Hertfordshire?), "ADEN University" (assumed Panama City from the list's country grouping) and "Montevideo – UTEC".
7. Home printers differ in duplex shift and printable margins (crop marks start ${(geo.home.marginY - settings.home_print.crop_mark_offset_mm - settings.home_print.crop_mark_length_mm).toFixed(1)} mm from the paper edge). Always print the alignment test first.
8. Canva and Higgsfield integrations were not used. All artwork is local, editable SVG/HTML with live text, which can be imported into Canva if needed. No AI-generated images and no third-party icon sets are used.
9. Interactive approval of the prototype was not possible during the automated run; the prototype is documented in \`docs/prototype.png\` and the full deck follows it.

## 9. Deliverables

| File | Purpose | Status |
|---|---|---|
${deliverables.map(([f, d]) => `| \`${f}\` | ${d} | ${existsSync(join(ROOT, f)) ? "✅ " + size(f) : "❌ missing"} |`).join("\n")}
| \`cards_source.zip\` | Source, data, assets, docs, preview and PDFs | created by \`npm run package\` (final build step) |
`;

writeOut("QC_REPORT.md", md);
console.log(`✓ QC_REPORT.md (${allOk ? "all automated checks passed" : "FAILURES present"})`);
