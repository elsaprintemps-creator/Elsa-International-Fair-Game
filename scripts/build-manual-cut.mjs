// Builds the A3 manual-cut layout from data/cards.json + config/print-settings.json (section manual_cut_a3):
// card FRONTS only, no backs, printed one-sided at the exact trim size, each card with its own cut outline.
//   build/manual_cut_A3.html     — page 1: print/cut guide + size check; then the card sheets
//   build/manual-cut-plan.json   — page → slot → card map with the exact trim box of every card (mm)
// Rendered to PDF by scripts/render-manual-cut.mjs and verified by scripts/check-manual-cut.mjs.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadProject, writeOut } from "./lib.mjs";
import { esc, head, renderFront, cardGeometry } from "../src/templates.mjs";

const { settings, data, gateMap } = loadProject();
const G = cardGeometry(settings);
const mc = settings.manual_cut_a3;
const cards = data.cards;
const f2 = (n) => +n.toFixed(3);

/* ------------------------------------------------------------- Settings */
if (!(mc.cut_gap_mm >= mc.min_cut_gap_mm)) throw new Error(`manual_cut_a3.cut_gap_mm (${mc.cut_gap_mm}) is below min_cut_gap_mm (${mc.min_cut_gap_mm}).`);
if (!(mc.cut_line_stroke_mm > 0 && 2 * mc.cut_line_stroke_mm < mc.cut_gap_mm)) throw new Error("manual_cut_a3.cut_line_stroke_mm must be > 0 and leave a blank strip between two outlines.");
if (!["auto", "portrait", "landscape"].includes(mc.orientation)) throw new Error(`Unknown manual_cut_a3.orientation "${mc.orientation}".`);
if (!["continuous", "gate-pure"].includes(mc.packing)) throw new Error(`Unknown manual_cut_a3.packing "${mc.packing}".`);

/* --------------------------------------------------------------- Layout */
// Upright cards in a centred grid; every card keeps the exact trim size, only the count per sheet changes.
function gridFor(pageW, pageH) {
  const fit = (avail, size) => Math.max(0, Math.floor((avail - 2 * mc.min_page_margin_mm + mc.cut_gap_mm) / (size + mc.cut_gap_mm)));
  const columns = fit(pageW, G.trimW), rows = fit(pageH, G.trimH);
  const blockW = columns * G.trimW + (columns - 1) * mc.cut_gap_mm;
  const blockH = rows * G.trimH + (rows - 1) * mc.cut_gap_mm;
  return { pageW, pageH, columns, rows, perSheet: columns * rows, blockW, blockH, marginX: (pageW - blockW) / 2, marginY: (pageH - blockH) / 2 };
}
const shortSide = Math.min(mc.paper_width_mm, mc.paper_height_mm), longSide = Math.max(mc.paper_width_mm, mc.paper_height_mm);
const options = { portrait: gridFor(shortSide, longSide), landscape: gridFor(longSide, shortSide) };
const minMargin = (o) => Math.min(o.marginX, o.marginY);
let orientation = mc.orientation;
if (orientation === "auto") {
  const { portrait: p, landscape: l } = options;
  orientation = l.perSheet > p.perSheet || (l.perSheet === p.perSheet && minMargin(l) >= minMargin(p)) ? "landscape" : "portrait";
}
const L = options[orientation];
if (!L.perSheet) throw new Error(`A ${G.trimW} × ${G.trimH} mm card does not fit on ${shortSide} × ${longSide} mm paper with ${mc.min_page_margin_mm} mm margins.`);
const slotBox = (i) => {
  const col = i % L.columns, row = Math.floor(i / L.columns);
  return { col, row, x: L.marginX + col * (G.trimW + mc.cut_gap_mm), y: L.marginY + row * (G.trimH + mc.cut_gap_mm), w: G.trimW, h: G.trimH };
};

/* -------------------------------------------------------------- Packing */
// Cards keep their data order (questions then answers, gate by gate), so the sheets follow the deck.
const sheets = [];
const chunk = (list, gate = null) => { for (let i = 0; i < list.length; i += L.perSheet) sheets.push({ gate, cards: list.slice(i, i + L.perSheet) }); };
if (mc.packing === "gate-pure") for (const g of data.gates) chunk(cards.filter((c) => c.gate === g.gate), g.gate);
else chunk(cards);

/** Consecutive cards of the same gate and type, e.g. "Gate A answers A17–A20". */
function contents(list) {
  const runs = [];
  for (const c of list) {
    const last = runs.at(-1);
    if (last && last.gate === c.gate && last.card_type === c.card_type) last.ids.push(c.id);
    else runs.push({ gate: c.gate, card_type: c.card_type, ids: [c.id] });
  }
  const kind = (r) => (r.card_type === "answer" ? "answers" : r.gate === "E" ? "discussion questions" : "questions");
  return runs.map((r) => `Gate ${r.gate} ${kind(r)} ${r.ids[0]}${r.ids.length > 1 ? `–${r.ids.at(-1)}` : ""}`);
}

const firstSheetPage = mc.include_instructions ? 2 : 1;
const counts = {
  questions: cards.filter((c) => c.card_type === "question").length,
  answers: cards.filter((c) => c.card_type === "answer").length,
};
const sizeTxt = `${G.trimW} × ${G.trimH} mm`;
const paperName = shortSide === 297 && longSide === 420 ? "A3" : `${shortSide} × ${longSide} mm`;

/* ------------------------------------------------------- Vector pieces */
// Cut outline: drawn entirely outside the card, so its inner edge is the exact trim line.
const sw = mc.cut_line_stroke_mm;
const outline = (b) => `<rect x="${f2(b.x - sw / 2)}" y="${f2(b.y - sw / 2)}" width="${f2(b.w + sw)}" height="${f2(b.h + sw)}"/>`;

// The measuring graphics use preserveAspectRatio="none": Chrome rounds an SVG's box to 1/64 px, and with the
// default "meet" a rounded-down 3 mm height would shrink the whole drawing (a 100 mm bar printed at 99.9 mm).

/** Ruler of `len` mm: 1 mm ticks, numbered every `every` mm. Drawn in mm units at true scale. */
function ruler(len, every = 10) {
  const pad = 4, h = 9;
  const ticks = [];
  for (let k = 0; k <= len; k++) {
    const t = k % 10 === 0 ? 4.2 : k % 5 === 0 ? 3 : 1.8;
    ticks.push(`<line x1="${pad + k}" y1="0" x2="${pad + k}" y2="${t}"/>`);
    if (k % every === 0) ticks.push(`<text x="${pad + k}" y="7.6">${k}</text>`);
  }
  return `<svg class="ruler" preserveAspectRatio="none" width="${len + 2 * pad}mm" height="${h}mm" viewBox="0 0 ${len + 2 * pad} ${h}" aria-label="${len} mm ruler"><line x1="${pad}" y1="0" x2="${pad + len}" y2="0" class="base"/>${ticks.join("")}</svg>`;
}

/** Scale bar for the sheet footer: `len` mm with end ticks and 10 mm ticks. */
function scaleBar(len) {
  const ticks = [];
  for (let k = 0; k <= len; k += 10) ticks.push(`<line x1="${k}" y1="${k === 0 || k === len ? 0 : 1}" x2="${k}" y2="3"/>`);
  return `<svg class="scalebar" preserveAspectRatio="none" width="${len}mm" height="3mm" viewBox="0 0 ${len} 3" aria-label="${len} mm scale bar"><line x1="0" y1="3" x2="${len}" y2="3"/>${ticks.join("")}</svg>`;
}

/** Test card: the same outline as on the sheets, with its two dimensions. */
function sizeCheck() {
  const pad = 9, W = G.trimW, H = G.trimH;
  const vw = W + 2 * pad + 6, vh = H + 2 * pad;
  const box = { x: pad, y: pad, w: W, h: H };
  const ah = (x, y, dx, dy) => `<path d="M${f2(x)} ${f2(y)}l${f2(dx * 1.6 - dy * 0.8)} ${f2(dy * 1.6 - dx * 0.8)}M${f2(x)} ${f2(y)}l${f2(dx * 1.6 + dy * 0.8)} ${f2(dy * 1.6 + dx * 0.8)}"/>`;
  const dimY = pad - 4, dimX = pad + W + 4;
  return `<svg class="testcard" preserveAspectRatio="none" width="${vw}mm" height="${vh}mm" viewBox="0 0 ${vw} ${vh}" aria-label="${sizeTxt} test outline">
  <g class="cut">${outline(box)}</g>
  <g class="dim"><line x1="${pad}" y1="${dimY}" x2="${pad + W}" y2="${dimY}"/>${ah(pad, dimY, 1, 0)}${ah(pad + W, dimY, -1, 0)}
    <line x1="${pad}" y1="${dimY - 1.6}" x2="${pad}" y2="${pad - 0.8}"/><line x1="${pad + W}" y1="${dimY - 1.6}" x2="${pad + W}" y2="${pad - 0.8}"/>
    <line x1="${dimX}" y1="${pad}" x2="${dimX}" y2="${pad + H}"/>${ah(dimX, pad, 0, 1)}${ah(dimX, pad + H, 0, -1)}
    <line x1="${pad + W + 0.8}" y1="${pad}" x2="${dimX + 1.6}" y2="${pad}"/><line x1="${pad + W + 0.8}" y1="${pad + H}" x2="${dimX + 1.6}" y2="${pad + H}"/></g>
  <text class="dim-lbl" x="${f2(pad + W / 2)}" y="${f2(dimY - 1.2)}">${W} mm</text>
  <text class="dim-lbl" transform="translate(${f2(dimX + 2.6)} ${f2(pad + H / 2)}) rotate(90)">${H} mm</text>
  <text class="tc-big" x="${f2(pad + W / 2)}" y="${f2(pad + H / 2 - 4)}">TEST CARD</text>
  <text class="tc-small" x="${f2(pad + W / 2)}" y="${f2(pad + H / 2 + 2)}">measure inside the line</text>
  <text class="tc-small fr" x="${f2(pad + W / 2)}" y="${f2(pad + H / 2 + 6)}">mesurez à l’intérieur du trait</text>
</svg>`;
}

/* -------------------------------------------------------------- Pages */
const pages = [];
const plan = {
  generated: new Date().toISOString(),
  output: mc.output,
  paper: paperName,
  orientation,
  page_width_mm: L.pageW,
  page_height_mm: L.pageH,
  columns: L.columns,
  rows: L.rows,
  per_sheet: L.perSheet,
  card_trim_mm: { w: G.trimW, h: G.trimH },
  cut_gap_mm: mc.cut_gap_mm,
  cut_line_stroke_mm: sw,
  margins_mm: { x: f2(L.marginX), y: f2(L.marginY) },
  min_page_margin_mm: mc.min_page_margin_mm,
  packing: mc.packing,
  ink_saver: !!mc.ink_saver,
  instructions_page: mc.include_instructions ? 1 : null,
  test_card_page: mc.include_instructions ? 1 : null,
  orientation_options: Object.fromEntries(Object.entries(options).map(([k, o]) => [k, { columns: o.columns, rows: o.rows, per_sheet: o.perSheet, margins_mm: { x: f2(o.marginX), y: f2(o.marginY) } }])),
  sheets: [],
};

if (mc.include_instructions) {
  const rows = sheets.map((s, i) => `<tr><td>${i + 1}</td><td>${firstSheetPage + i}</td><td>${s.cards.length}</td><td>${contents(s.cards).map((r) => `<span class="run">${esc(r)}</span>`).join(" · ")}</td></tr>`).join("");
  const lastPage = firstSheetPage + sheets.length - 1;
  pages.push(`<section class="page doc">
  <div class="doc-band"><span>INTERNATIONAL FAIR · AIRPORT GATES</span><span>${paperName} MANUAL-CUT SHEETS · PLANCHES À DÉCOUPER</span></div>
  <div class="doc-cols">
  <div class="doc-main">
    <h1>Card fronts to print and cut by hand</h1><p class="fr-sub">Recto des cartes à imprimer et découper à la main</p>
    <p>This file prints all <b>${cards.length} card fronts</b> (${counts.questions} question cards + ${counts.answers} answer cards) on <b>${sheets.length} ${paperName} sheets</b> (pages ${firstSheetPage}–${lastPage}), up to ${L.perSheet} per sheet, at the finished size of <b>${sizeTxt}</b>. It has <b>no card backs</b>: print one side only, then cut. Gate E has question cards only.</p>
    <h2>1 · Printer settings <span>Réglages de l’imprimante</span></h2>
    <ul>
      <li><b>Paper: ${paperName}</b> (${shortSide} × ${longSide} mm). The pages are ${orientation}; leave orientation on <i>Auto</i> or choose <i>${orientation === "landscape" ? "Landscape" : "Portrait"}</i>.</li>
      <li><b>Scale: 100&nbsp;% / “Actual size”.</b> Turn OFF “Fit to page”, “Shrink oversized pages”, “Scale to fit”. Otherwise the cards come out smaller than ${sizeTxt}. <span class="fr">Échelle 100&nbsp;% / «&nbsp;Taille réelle&nbsp;».</span></li>
      <li><b>One-sided:</b> turn two-sided printing OFF. <span class="fr">Recto seul.</span></li>
      <li><b>Colour</b>, normal quality. The cards use little ink: white headers with a thin rule, no solid backgrounds.</li>
    </ul>
    <h2>2 · Check the size first <span>Vérifiez d’abord la taille</span></h2>
    <ol>
      <li>Print <b>this page only</b> (page 1) with the settings above.</li>
      <li>With a ruler, measure the <b>test card</b>: it must be <b>${G.trimW} mm wide and ${G.trimH} mm tall</b>, measured from the inner edges of the line. The long ruler below must measure <b>${mc.ruler_mm} mm</b> from 0 to ${mc.ruler_mm}.</li>
      <li>If a measurement is off by <b>more than 1 mm</b>, the printer is scaling the page: check the scale and paper settings, print page 1 again, and only then print pages ${firstSheetPage}–${lastPage}. Each sheet also has a ${mc.scale_bar_mm} mm scale bar in its bottom margin.</li>
    </ol>
    <h2>3 · Paper <span>Papier</span></h2>
    <ul>
      <li><b>Best:</b> matte card stock, 200–250 g/m², if your printer’s bypass or manual tray accepts it (check its maximum paper weight).</li>
      <li><b>Good:</b> heavy paper, 160–200 g/m².</li>
      <li><b>Fallback:</b> ordinary 80–120 g/m² paper. The cards will be thin: glue the printed sheet onto thin card before cutting, or laminate the cut cards.</li>
      <li>Matte paper avoids glare under the fair’s lighting.</li>
    </ul>
    <h2>4 · Cut <span>Découpez</span></h2>
    <ul>
      <li><b>Tools:</b> a paper trimmer or guillotine is fastest; otherwise a metal ruler and craft knife on a cutting mat. Scissors also work.</li>
      <li>Every card has its own <b>thin outline drawn just outside the card</b>. Cut along the inner edge of the line: the line and the ${mc.cut_gap_mm} mm strip between two cards are waste.</li>
      <li>Fastest: first cut the sheet into rows through the middle of the gaps, then trim each card.</li>
      <li><b>Sorting:</b> the gate letter is top left, the card ID top right. Answer cards have a pale-yellow header labelled <b>ANSWER · RÉPONSE</b> and the same ID as their question.</li>
    </ul>
  </div>
  <div class="doc-side">
    <h2>Size check <span>Contrôle de la taille</span></h2>
    ${sizeCheck()}
    <h2>Sheet map <span>Plan des feuilles</span></h2>
    <table><thead><tr><th>Sheet</th><th>Page</th><th>Cards</th><th>Contents</th></tr></thead><tbody>${rows}</tbody></table>
  </div>
  </div>
  <div class="doc-ruler"><div class="ruler-lbl">${mc.ruler_mm} mm ruler: measure from 0 to ${mc.ruler_mm} · <span class="fr">règle de ${mc.ruler_mm} mm</span></div>${ruler(mc.ruler_mm)}</div>
</section>`);
}

const labelH = 3.4; // mm, height of the margin label rows
sheets.forEach((s, si) => {
  const page = firstSheetPage + si;
  const slots = s.cards.map((c, i) => ({ c, ...slotBox(i) }));
  const art = slots.map(({ c, x, y }, i) => `<div class="slot" data-slot="${i + 1}" data-id="${esc(c.id)}" data-type="${c.card_type}" style="left:${f2(x)}mm;top:${f2(y)}mm;width:${G.trimW}mm;height:${G.trimH}mm"><div class="art" style="left:-${G.bleed}mm;top:-${G.bleed}mm">${renderFront(c, gateMap[c.gate])}</div></div>`);
  const outlines = `<svg class="overlay" viewBox="0 0 ${L.pageW} ${L.pageH}" aria-hidden="true"><g class="cut" stroke-width="${sw}">${slots.map(outline).join("")}</g></svg>`;
  const labelBox = (top) => `left:${f2(L.marginX)}mm;width:${f2(L.blockW)}mm;top:${f2(top)}mm;height:${labelH}mm`;
  const header = `<div class="mlabel" style="${labelBox(L.marginY - 2 - labelH)}"><span data-fit-check>INTERNATIONAL FAIR · AIRPORT GATES · ${paperName} MANUAL-CUT · SHEET ${si + 1} / ${sheets.length} · FRONTS ONLY</span><span class="contents" data-fit-check>${esc(contents(s.cards).join(" · "))}</span></div>`;
  const footer = `<div class="mlabel foot" style="${labelBox(L.marginY + L.blockH + 2)}"><span data-fit-check>Print at 100&nbsp;% (actual size), one-sided · card ${sizeTxt} inside the line · imprimer à 100&nbsp;%, recto seul</span><span class="bar">${scaleBar(mc.scale_bar_mm)}<span>${mc.scale_bar_mm} mm</span></span></div>`;
  pages.push(`<section class="page sheet">${art.join("")}${outlines}${header}${footer}</section>`);
  plan.sheets.push({
    sheet: si + 1,
    page,
    gate: s.gate,
    contents: contents(s.cards),
    slots: slots.map(({ c, col, row, x, y, w, h }, i) => ({ slot: i + 1, id: c.id, card_type: c.card_type, gate: c.gate, col, row, trim_mm: { x: f2(x), y: f2(y), w, h } })),
  });
});
plan.total_pages = pages.length;
plan.card_count = sheets.reduce((n, s) => n + s.cards.length, 0);

/* ----------------------------------------------------------------- CSS */
const css = `
  @page { size: ${L.pageW}mm ${L.pageH}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: var(--c-white); }
  .page { position: relative; width: ${L.pageW}mm; height: ${L.pageH}mm; overflow: hidden; break-after: page; page-break-after: always; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  /* clip-path (not overflow) so the clip is the exact trim box: Chrome pixel-snaps overflow clips in PDFs. */
  .slot { position: absolute; clip-path: inset(0); }
  .art { position: absolute; }
  .overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
  .cut { fill: none; stroke: var(--c-navy); }
  .mlabel { position: absolute; display: flex; align-items: center; justify-content: space-between; gap: 4mm; white-space: nowrap;
    font-family: var(--font-sign); font-weight: 600; font-size: 6.6pt; letter-spacing: .06em; line-height: 1; color: var(--c-navy); }
  .mlabel > span { overflow: hidden; }
  .mlabel .contents { font-weight: 700; color: var(--c-teal-deep); }
  .mlabel.foot { text-transform: uppercase; }
  .mlabel .bar { flex: none; display: flex; align-items: flex-end; gap: 1.5mm; }
  .scalebar { display: block; stroke: var(--c-navy); stroke-width: .25; }
  .doc { box-sizing: border-box; padding: 14mm 18mm 12mm; font-family: var(--font-text); font-size: 10pt; line-height: 1.4; color: var(--c-navy); display: flex; flex-direction: column; }
  .doc-band { display: flex; justify-content: space-between; font-family: var(--font-sign); font-weight: 700; letter-spacing: .12em; font-size: 8.5pt; border-bottom: .5mm solid var(--c-turquoise); padding-bottom: 2mm; margin-bottom: 5mm; }
  .doc-cols { flex: 1; display: flex; gap: 12mm; min-height: 0; }
  .doc-main { flex: 1; min-width: 0; }
  .doc-side { flex: none; width: ${f2(Math.max(G.trimW + 24, 128))}mm; }
  .doc h1 { font-family: var(--font-sign); font-weight: 800; font-size: 26pt; line-height: 1; margin: 0; }
  .doc .fr-sub { margin: 1mm 0 3mm; font-style: italic; color: var(--c-teal-deep); }
  .doc .fr { font-style: italic; color: var(--c-teal-deep); }
  .doc h2 { font-family: var(--font-sign); font-weight: 800; font-size: 13pt; margin: 4mm 0 1.2mm; }
  .doc h2 span { font-family: var(--font-text); font-weight: 400; font-style: italic; font-size: 9pt; color: var(--c-teal-deep); margin-left: 2mm; }
  .doc-side h2:first-child { margin-top: 0; }
  .doc ul, .doc ol { margin: 0; padding-left: 5mm; }
  .doc li { margin: .7mm 0; }
  .doc p { margin: 1.5mm 0; }
  .testcard { display: block; margin: 2mm 0 3mm; }
  .testcard .cut { stroke-width: ${sw}; }
  .testcard .dim { stroke: var(--c-teal-deep); stroke-width: .2; fill: none; }
  .testcard text { font-family: var(--font-sign); text-anchor: middle; fill: var(--c-navy); }
  .testcard .dim-lbl { font-weight: 700; font-size: 3.2px; fill: var(--c-teal-deep); }
  .testcard .tc-big { font-weight: 800; font-size: 5px; letter-spacing: .3px; }
  .testcard .tc-small { font-family: var(--font-text); font-size: 2.6px; }
  .testcard .tc-small.fr { font-style: italic; fill: var(--c-teal-deep); }
  .doc table { width: 100%; border-collapse: collapse; font-size: 8.4pt; line-height: 1.25; }
  .doc th, .doc td { text-align: left; vertical-align: top; padding: .8mm 1.4mm; border-bottom: .2mm solid var(--c-turquoise-tint); }
  .doc th { font-family: var(--font-sign); font-weight: 700; letter-spacing: .06em; border-bottom: .4mm solid var(--c-navy); }
  .doc td:nth-child(-n+3), .doc td .run { white-space: nowrap; }
  .doc-ruler { flex: none; margin-top: 4mm; }
  .ruler-lbl { font-family: var(--font-sign); font-weight: 700; font-size: 8pt; letter-spacing: .06em; margin-bottom: 1mm; }
  .ruler { display: block; stroke: var(--c-navy); }
  .ruler line { stroke-width: .15; }
  .ruler .base { stroke-width: .25; }
  .ruler text { font-family: var(--font-sign); font-weight: 600; font-size: 2.6px; text-anchor: middle; fill: var(--c-navy); stroke: none; }
  ${mc.ink_saver ? readFileSync(join(ROOT, "src/cards-ink-saver.css"), "utf8") : ""}
`;
writeOut("build/manual_cut_A3.html", `${head({ title: `${paperName} manual-cut card fronts`, rel: "../", settings, extraCss: css })}<body class="${mc.ink_saver ? "ink-saver" : ""}">${pages.join("\n")}</body></html>`);
writeOut("build/manual-cut-plan.json", JSON.stringify(plan, null, 2));

console.log(`✓ build/manual_cut_A3.html — ${pages.length} pages: ${sheets.length} ${paperName} ${orientation} sheets × ${L.columns}×${L.rows} cards (${plan.card_count} fronts), gap ${mc.cut_gap_mm} mm, margins ${f2(L.marginX)} × ${f2(L.marginY)} mm`);
for (const [k, o] of Object.entries(options)) console.log(`    ${k}: ${o.columns}×${o.rows} = ${o.perSheet} per sheet, margins ${f2(o.marginX)} × ${f2(o.marginY)} mm${k === orientation ? "  ← used" : ""}`);
