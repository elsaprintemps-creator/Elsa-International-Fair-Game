// Independent inspection of the finished A3 manual-cut PDF (manual_cut_a3.output). It reads the PDF itself,
// not the HTML it came from:
//   pdf-lib  — page boxes (paper size), viewer preferences (print scaling, duplex), embedded fonts
//   pdf.js   — drawing operators (cut outlines, artwork clip boxes, scale references, images) and the text
//              layer (card IDs, card types, the full EN/FR card text, text positions)
// and compares everything with data/cards.json, config/print-settings.json and build/manual-cut-plan.json.
// Writes build/manual-cut-report.json and docs/QC_MANUAL_CUT_A3.md; exits 1 if any check fails.
import { readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFDict, PDFArray, PDFName } from "pdf-lib";
import { getDocument, OPS, Util } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ROOT, MM_TO_PT, loadProject, readJSON, writeOut, backLabels, allowedFontFamilies } from "./lib.mjs";

const { settings, data } = loadProject();
const mc = settings.manual_cut_a3;
const plan = readJSON("build/manual-cut-plan.json");
const render = existsSync(join(ROOT, "build/manual-cut-render.json")) ? readJSON("build/manual-cut-render.json") : null;
const file = mc.output;
const bytes = readFileSync(join(ROOT, file));
const W = settings.card.trim_width_mm, H = settings.card.trim_height_mm;
const TOL = 0.02; // mm — far below what a ruler or a printer can show; covers Chrome's 1/64 px layout units
const mm = (pt) => pt / MM_TO_PT;
const r3 = (n) => +n.toFixed(3);

const checks = [];
const ck = (group, name, ok, detail = "") => checks.push({ group, name, ok: !!ok, detail });

/* ---------------------------------------------------------------- pdf-lib */
const lib = await PDFDocument.load(bytes);
const libPages = lib.getPages();
const boxes = libPages.map((p) => {
  const m = p.getMediaBox(), c = p.getCropBox();
  return { media: [r3(mm(m.width)), r3(mm(m.height))], crop: [r3(mm(c.width)), r3(mm(c.height))], same: m.x === c.x && m.y === c.y && m.width === c.width && m.height === c.height };
});
const vp = lib.catalog.getViewerPreferences();
const viewer = { print_scaling: vp?.getPrintScaling() ?? null, duplex: vp?.getDuplex() ?? null, pick_tray_by_pdf_size: vp?.getPickTrayByPDFSize() ?? null };

const fonts = [];
for (const [, obj] of lib.context.enumerateIndirectObjects()) {
  if (!(obj instanceof PDFDict) || obj.get(PDFName.of("Type")) !== PDFName.of("Font")) continue;
  const subtype = obj.get(PDFName.of("Subtype"))?.decodeText?.() ?? String(obj.get(PDFName.of("Subtype")));
  if (subtype === "/CIDFontType0" || subtype === "/CIDFontType2" || subtype === "CIDFontType0" || subtype === "CIDFontType2") continue; // checked through their Type0 parent
  const base = String(obj.get(PDFName.of("BaseFont")) ?? "").replace(/^\//, "");
  let desc = obj.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
  const desc0 = obj.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
  if (!desc && desc0) desc = desc0.lookup(0, PDFDict).lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
  const embedded = !!desc && ["FontFile", "FontFile2", "FontFile3"].some((k) => desc.has(PDFName.of(k)));
  fonts.push({ base, subtype: String(obj.get(PDFName.of("Subtype"))), embedded, family: base.replace(/^[A-Z]{6}\+/, "") });
}
const allowed = allowedFontFamilies(settings).map((f) => f.replace(/\s+/g, ""));
const strayFonts = fonts.filter((f) => !allowed.some((a) => f.family.replace(/\s+/g, "").startsWith(a)));

/* ----------------------------------------------------------------- pdf.js */
const doc = await getDocument({ data: new Uint8Array(bytes), verbosity: 0, useSystemFonts: false }).promise;
const IMAGE_OPS = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat, OPS.paintInlineImageXObjectGroup, OPS.paintImageMaskXObjectGroup, OPS.paintSolidColorImageMask].filter((x) => x !== undefined));
const norm = (s) => String(s).normalize("NFKC").replace(/[\s   ]/g, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

/** Walks the operator list with the graphics state and returns rectangles (stroked / clip) and straight stroked lines, in mm from the page's top-left corner. */
function scan(ol, view) {
  let ctm = [1, 0, 0, 1, 0, 0], lw = 1, color = null;
  const stack = [], strokes = [], clips = [], lines = [];
  let pending = null, images = 0;
  const pt = (x, y) => { const [X, Y] = Util.applyTransform([x, y], ctm); return [mm(X - view[0]), mm(view[3] - Y)]; };
  const scale = () => Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]));
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], a = ol.argsArray[i];
    if (fn === OPS.save) stack.push([ctm, lw, color]);
    else if (fn === OPS.restore) [ctm, lw, color] = stack.pop() || [ctm, lw, color];
    else if (fn === OPS.transform) ctm = Util.transform(ctm, a);
    else if (fn === OPS.setLineWidth) lw = a[0];
    else if (fn === OPS.setGState) { for (const [k, v] of a[0]) if (k === "LW") lw = v; } // Chrome sets the line width through an ExtGState
    else if (fn === OPS.setStrokeRGBColor) color = Array.from(a);
    else if (fn === OPS.constructPath) {
      const [ops, c] = a;
      if (ops.every((o) => o === OPS.rectangle)) {
        pending = { rects: ops.map((_, k) => { const [x, y, w, h] = c.slice(4 * k, 4 * k + 4); const p1 = pt(x, y), p2 = pt(x + w, y + h); return { x: Math.min(p1[0], p2[0]), y: Math.min(p1[1], p2[1]), w: Math.abs(p2[0] - p1[0]), h: Math.abs(p2[1] - p1[1]) }; }) };
      } else if (ops.length === 2 && ops[0] === OPS.moveTo && ops[1] === OPS.lineTo) {
        const p1 = pt(c[0], c[1]), p2 = pt(c[2], c[3]);
        pending = { line: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] } };
      } else pending = null;
    } else if (fn === OPS.stroke || fn === OPS.closeStroke) {
      const lwMm = mm(lw * scale());
      if (pending?.rects) for (const r of pending.rects) strokes.push({ ...r, lw: lwMm, color });
      if (pending?.line) lines.push({ ...pending.line, lw: lwMm });
      pending = null;
    } else if (fn === OPS.clip || fn === OPS.eoClip) {
      if (pending?.rects) clips.push(...pending.rects);
    } else if (fn === OPS.endPath || fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke || fn === OPS.eoFillStroke) pending = null;
    else if (IMAGE_OPS.has(fn)) images++;
  }
  return { strokes, clips, lines, images };
}

/** Text items with their box (font ascent to descent) in mm from the top-left corner. */
async function textItems(page, view) {
  const tc = await page.getTextContent();
  return tc.items.filter((t) => t.str && t.str.trim()).map((t) => {
    const [a, b, c, d, e, f] = t.transform;
    const st = tc.styles[t.fontName] || {};
    const asc = st.ascent ?? 0.8, desc = st.descent ?? -0.2;
    const horizontal = Math.abs(b) < 1e-6 && Math.abs(c) < 1e-6 && a > 0 && d > 0;
    return { str: t.str, horizontal, x0: mm(e - view[0]), x1: mm(e - view[0] + t.width), y0: mm(view[3] - (f + asc * t.height)), y1: mm(view[3] - (f + desc * t.height)), font: st.fontFamily };
  });
}

const isOutline = (s) => Math.abs(s.w - s.lw - W) < 3 && Math.abs(s.h - s.lw - H) < 3;
const inner = (s) => ({ x: s.x + s.lw / 2, y: s.y + s.lw / 2, w: s.w - s.lw, h: s.h - s.lw });
const backOnly = [...new Set(Object.values(backLabels(data)).flat())].filter((l) => l.length > 6 && l !== "INTERNATIONAL FAIR").map(norm);

const pagesOut = [];
const found = []; // every card front recognised in the PDF
const problems = { outline_size: [], clip: [], plan: [], text_outside: [], label_overlap: [], content: [], unrecognised: [], rotated: [] };
let minClear = { v: Infinity }, minGapX = Infinity, minGapY = Infinity, minEdge = Infinity, minOutlineEdge = Infinity;
let maxTrimDev = 0, maxClipDev = 0, maxPosDev = 0;
const scaleRefs = [];
let totalImages = 0, backLabelHits = [];

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const view = page.view;
  const pw = mm(view[2] - view[0]), ph = mm(view[3] - view[1]);
  const { strokes, clips, lines, images } = scan(await page.getOperatorList(), view);
  totalImages += images;
  const items = await textItems(page, view);
  const pageText = norm(items.map((t) => t.str).join(""));
  for (const l of backOnly) if (pageText.includes(l)) backLabelHits.push(`p${p}: ${l}`);
  const sheet = plan.sheets.find((s) => s.page === p);
  const outlines = strokes.filter(isOutline).map((s) => ({ ...inner(s), lw: s.lw, color: s.color }));
  const hLines = lines.filter((l) => Math.abs(l.y1 - l.y2) < 0.001).map((l) => Math.abs(l.x2 - l.x1));
  const info = { page: p, size_mm: [r3(pw), r3(ph)], outlines: outlines.length, images, text_items: items.length };

  if (!sheet) {
    // Guide page: one test card outline at the exact size, and the long ruler.
    info.kind = "guide";
    info.test_card_mm = outlines.map((o) => [r3(o.w), r3(o.h)]);
    ck("Guide page", `Page ${p}: test card outline is exactly ${W} × ${H} mm (inside the line)`, outlines.length === 1 && Math.abs(outlines[0].w - W) <= TOL && Math.abs(outlines[0].h - H) <= TOL, info.test_card_mm.map((d) => d.join(" × ") + " mm").join(", "));
    const ruler = hLines.filter((len) => Math.abs(len - mc.ruler_mm) <= 0.5);
    scaleRefs.push({ page: p, what: `${mc.ruler_mm} mm ruler`, measured_mm: ruler.map(r3) });
    ck("Guide page", `Page ${p}: ruler line measures ${mc.ruler_mm} mm`, ruler.length === 1 && Math.abs(ruler[0] - mc.ruler_mm) <= TOL, ruler.map((x) => `${r3(x)} mm`).join(", "));
    ck("Guide page", `Page ${p}: tells the reader to print at 100 % / Actual size, one-sided, and to measure ${W} × ${H} mm`, ["Actualsize", "One-sided", `${W}mmwideand${H}mmtall`].every((s) => pageText.includes(norm(s))));
    ck("Guide page", `Page ${p}: contains no card front`, !/INTLFAIR·[A-E]\d/.test(pageText));
    pagesOut.push(info);
    continue;
  }

  info.kind = "sheet";
  info.sheet = sheet.sheet;
  // Scale bar
  const bar = hLines.filter((len) => Math.abs(len - mc.scale_bar_mm) <= 0.5);
  scaleRefs.push({ page: p, what: `${mc.scale_bar_mm} mm scale bar`, measured_mm: bar.map(r3) });
  if (!(bar.length === 1 && Math.abs(bar[0] - mc.scale_bar_mm) <= TOL)) problems.plan.push(`p${p}: scale bar ${bar.map(r3).join(", ") || "not found"}`);
  if (!pageText.includes(norm("ACTUAL SIZE"))) problems.plan.push(`p${p}: footer print instruction missing`);

  // Outlines: exact size, one per planned card, at the planned position, artwork clipped exactly at the outline.
  for (const o of outlines) {
    maxTrimDev = Math.max(maxTrimDev, Math.abs(o.w - W), Math.abs(o.h - H));
    if (Math.abs(o.w - W) > TOL || Math.abs(o.h - H) > TOL) problems.outline_size.push(`p${p}: ${r3(o.w)} × ${r3(o.h)} mm`);
    const clip = clips.filter((c) => Math.abs(c.w - W) < 1 && Math.abs(c.h - H) < 1)
      .map((c) => ({ c, d: Math.max(Math.abs(c.x - o.x), Math.abs(c.y - o.y), Math.abs(c.w - o.w), Math.abs(c.h - o.h)) }))
      .sort((a, b) => a.d - b.d)[0];
    if (!clip || clip.d > TOL) problems.clip.push(`p${p}: outline at ${r3(o.x)}, ${r3(o.y)} mm — ${clip ? `nearest clip off by ${r3(clip.d)} mm` : "no clip box"}`);
    else maxClipDev = Math.max(maxClipDev, clip.d);
    minEdge = Math.min(minEdge, o.x, o.y, pw - o.x - o.w, ph - o.y - o.h);
    minOutlineEdge = Math.min(minOutlineEdge, o.x - o.lw, o.y - o.lw, pw - o.x - o.w - o.lw, ph - o.y - o.h - o.lw);
  }
  // Gaps between neighbours (same row / same column)
  for (const a of outlines) for (const b of outlines) {
    if (Math.abs(a.y - b.y) < TOL && b.x > a.x) { const g = b.x - (a.x + a.w); if (g < W) minGapX = Math.min(minGapX, g); }
    if (Math.abs(a.x - b.x) < TOL && b.y > a.y) { const g = b.y - (a.y + a.h); if (g < H) minGapY = Math.min(minGapY, g); }
  }

  // Text: every item belongs to exactly one card (well inside it) or to no card (page labels, clear of all cards).
  const owner = (t) => outlines.findIndex((o) => { const cx = (t.x0 + t.x1) / 2, cy = (t.y0 + t.y1) / 2; return cx > o.x && cx < o.x + o.w && cy > o.y && cy < o.y + o.h; });
  const perCard = outlines.map(() => []);
  for (const t of items) {
    if (!t.horizontal) { problems.rotated.push(`p${p}: "${t.str}"`); continue; }
    const k = owner(t);
    if (k >= 0) {
      perCard[k].push(t);
      const o = outlines[k];
      const c = Math.min(t.x0 - o.x, o.x + o.w - t.x1, t.y0 - o.y, o.y + o.h - t.y1);
      if (c < minClear.v) minClear = { v: c, str: t.str, page: p };
      if (c < mc.min_text_clearance_mm) problems.text_outside.push(`p${p}: "${t.str}" ${r3(c)} mm from the edge`);
    } else {
      const hit = outlines.find((o) => t.x0 < o.x + o.w + o.lw && t.x1 > o.x - o.lw && t.y0 < o.y + o.h + o.lw && t.y1 > o.y - o.lw);
      if (hit) problems.label_overlap.push(`p${p}: "${t.str}"`);
    }
  }

  // Recognise each card from its own text and compare with the plan and the canonical data.
  outlines.forEach((o, k) => {
    const txt = norm(perCard[k].map((t) => t.str).join(""));
    const id = txt.match(/INTLFAIR·([A-E]\d{1,2})/)?.[1];
    const gate = txt.match(/GATE([A-E])/)?.[1];
    const kind = txt.includes(norm("ANSWER · RÉPONSE")) ? "answer" : txt.includes("DISCUSSION") ? "discussion" : txt.includes("QUESTION") ? "question" : null;
    const card_type = kind === "answer" ? "answer" : kind ? "question" : null;
    const slot = sheet.slots.find((s) => Math.abs(s.trim_mm.x - o.x) <= TOL && Math.abs(s.trim_mm.y - o.y) <= TOL);
    if (slot) maxPosDev = Math.max(maxPosDev, Math.abs(slot.trim_mm.x - o.x), Math.abs(slot.trim_mm.y - o.y));
    if (!id || !card_type || !gate) { problems.unrecognised.push(`p${p} outline ${k + 1}`); return; }
    found.push({ page: p, id, card_type, kind, gate });
    if (!slot || slot.id !== id || slot.card_type !== card_type) problems.plan.push(`p${p}: found ${id}/${card_type} where the plan has ${slot ? `${slot.id}/${slot.card_type}` : "no card"}`);
    if (gate !== id[0] || (kind === "discussion") !== (id[0] === "E" && card_type === "question")) problems.content.push(`${id}/${card_type}: gate or type label does not match`);
    const rec = data.cards.find((c) => c.id === id && c.card_type === card_type);
    if (!rec) problems.content.push(`${id}/${card_type}: not in data/cards.json`);
    else for (const lang of ["en", "fr"]) if (!txt.includes(norm(rec[`text_${lang}`]))) problems.content.push(`${id}/${card_type}: ${lang.toUpperCase()} text differs from data/cards.json`);
  });
  info.cards = found.filter((f) => f.page === p).map((f) => `${f.id}${f.card_type === "answer" ? "(A)" : ""}`);
  pagesOut.push(info);
}

/* ------------------------------------------------------------------ Checks */
const expPages = plan.total_pages;
const sizes = boxes.map((b) => b.media);
const isPaper = (s) => Math.abs(s[0] - plan.page_width_mm) <= TOL && Math.abs(s[1] - plan.page_height_mm) <= TOL;
const portraitPaper = [Math.min(mc.paper_width_mm, mc.paper_height_mm), Math.max(mc.paper_width_mm, mc.paper_height_mm)];
ck("Paper", `Page count = ${expPages} (${plan.instructions_page ? "1 guide page + " : ""}${plan.sheets.length} card sheets)`, doc.numPages === expPages && libPages.length === expPages, `${doc.numPages} pages`);
ck("Paper", `Every page is ${plan.paper} (${portraitPaper.join(" × ")} mm), ${plan.orientation}`, sizes.every(isPaper) && boxes.every((b) => b.same), [...new Set(sizes.map((s) => s.join(" × ")))].join(", ") + " mm (MediaBox = CropBox)");
ck("Paper", "Viewer preferences ask for no print scaling, one-sided printing and paper chosen by page size", viewer.print_scaling === "None" && viewer.duplex === "Simplex" && viewer.pick_tray_by_pdf_size === true, `PrintScaling ${viewer.print_scaling}, Duplex ${viewer.duplex}, PickTrayByPDFSize ${viewer.pick_tray_by_pdf_size}`);

const outlineTotal = pagesOut.filter((x) => x.kind === "sheet").reduce((n, x) => n + x.outlines, 0);
ck("Card size", `Every card's cut outline is exactly ${W} × ${H} mm on the inside (±${TOL} mm)`, outlineTotal === plan.card_count && problems.outline_size.length === 0, `${outlineTotal} outlines, max deviation ${r3(maxTrimDev)} mm${problems.outline_size.length ? "; " + problems.outline_size.slice(0, 5).join("; ") : ""}`);
ck("Card size", "Every card's artwork is clipped exactly at the inner edge of its outline (no mark inside the card, no gap)", problems.clip.length === 0, problems.clip.length ? problems.clip.slice(0, 5).join("; ") : `max deviation ${r3(maxClipDev)} mm`);
ck("Card size", "Every card sits at its planned position", problems.plan.length === 0 && maxPosDev <= TOL, problems.plan.slice(0, 5).join("; ") || `max deviation ${r3(maxPosDev)} mm`);
ck("Cutting", `Gap between neighbouring cards ≥ ${mc.min_cut_gap_mm} mm (configured ${mc.cut_gap_mm} mm)`, Math.min(minGapX, minGapY) >= mc.min_cut_gap_mm - TOL, `horizontal ${r3(minGapX)} mm, vertical ${r3(minGapY)} mm; blank strip between two outlines ${r3(Math.min(minGapX, minGapY) - 2 * mc.cut_line_stroke_mm)} mm`);
ck("Cutting", `Cards ≥ ${mc.min_page_margin_mm} mm from the paper edge`, minEdge >= mc.min_page_margin_mm - TOL, `card edge ${r3(minEdge)} mm, outline ${r3(minOutlineEdge)} mm from the nearest paper edge`);
ck("Cutting", "Page labels and scale bar sit outside every card; each sheet has a true-size scale bar", problems.label_overlap.length === 0 && problems.plan.length === 0, problems.label_overlap.slice(0, 5).join("; "));
ck("Text", `All card text ≥ ${mc.min_text_clearance_mm} mm inside the card edge (glyph boxes, font ascent to descent)`, problems.text_outside.length === 0 && problems.rotated.length === 0, `closest: ${r3(minClear.v)} mm ("${minClear.str}", page ${minClear.page})${problems.text_outside.length ? "; " + problems.text_outside.slice(0, 5).join("; ") : ""}`);
ck("Text", "Every card's English and French text matches data/cards.json exactly (whitespace and quote style aside)", problems.content.length === 0 && problems.unrecognised.length === 0, [...problems.unrecognised, ...problems.content].slice(0, 8).join("; "));

const key = (c) => `${c.id}/${c.card_type}`;
const expected = data.cards.map(key);
const got = found.map(key);
const dupes = got.filter((k, i) => got.indexOf(k) !== i);
const missing = expected.filter((k) => !got.includes(k));
const extra = got.filter((k) => !expected.includes(k));
const nQ = found.filter((c) => c.card_type === "question").length, nA = found.filter((c) => c.card_type === "answer").length;
ck("Cards", `All ${expected.length} card fronts present exactly once`, got.length === expected.length && !dupes.length && !missing.length && !extra.length, `${got.length} found${dupes.length ? `; duplicates ${dupes.join(", ")}` : ""}${missing.length ? `; missing ${missing.join(", ")}` : ""}${extra.length ? `; unexpected ${extra.join(", ")}` : ""}`);
ck("Cards", "100 question cards (A1–E20) and 80 answer cards (A–D only, same ID as their question)", nQ === 100 && nA === 80 && !found.some((c) => c.card_type === "answer" && c.gate === "E") && found.filter((c) => c.card_type === "answer").every((a) => found.some((q) => q.card_type === "question" && q.id === a.id)), `${nQ} questions, ${nA} answers, ${found.filter((c) => c.card_type === "answer" && c.gate === "E").length} Gate E answers`);
ck("Cards", "No card backs: no back artwork text anywhere, every card found is a front", backLabelHits.length === 0 && found.length === outlineTotal, backLabelHits.join("; ") || `${found.length} fronts / ${outlineTotal} card outlines`);
ck("Cards", "Sheets follow the planned order (data order: gate by gate, questions then answers)", pagesOut.filter((x) => x.kind === "sheet").every((x) => { const s = plan.sheets.find((y) => y.page === x.page); return x.cards.join() === s.slots.map((z) => `${z.id}${z.card_type === "answer" ? "(A)" : ""}`).join(); }));
ck("PDF", "All fonts embedded; only the project fonts are used", fonts.length > 0 && fonts.every((f) => f.embedded) && strayFonts.length === 0, `${fonts.length} font objects: ${[...new Set(fonts.map((f) => f.family))].join(", ")}${strayFonts.length ? `; unexpected ${strayFonts.map((f) => f.base).join(", ")}` : ""}`);
ck("PDF", "Vector only: no raster images", totalImages === 0, `${totalImages} image draws`);

const report = {
  generated: new Date().toISOString(),
  file,
  bytes: statSync(join(ROOT, file)).size,
  tool: "pdf.js (pdfjs-dist) + pdf-lib, reading the finished PDF",
  tolerance_mm: TOL,
  layout: { paper: plan.paper, orientation: plan.orientation, page_mm: [plan.page_width_mm, plan.page_height_mm], grid: `${plan.columns} × ${plan.rows}`, per_sheet: plan.per_sheet, sheets: plan.sheets.length, pages: plan.total_pages, cut_gap_mm: plan.cut_gap_mm, margins_mm: plan.margins_mm, packing: plan.packing, ink_saver: plan.ink_saver },
  measured: {
    page_sizes_mm: [...new Set(sizes.map((s) => s.join(" × ")))],
    trim_max_deviation_mm: r3(maxTrimDev),
    clip_max_deviation_mm: r3(maxClipDev),
    min_gap_mm: { horizontal: r3(minGapX), vertical: r3(minGapY) },
    min_card_to_paper_edge_mm: r3(minEdge),
    min_text_clearance_mm: r3(minClear.v),
    min_text_clearance_text: minClear.str,
    scale_references: scaleRefs,
  },
  viewer_preferences: viewer,
  fonts,
  pages: pagesOut,
  render_checks: render?.checks ?? null,
  checks,
  ok: checks.every((c) => c.ok) && (!render || render.ok),
};
writeOut("build/manual-cut-report.json", JSON.stringify(report, null, 2));

/* -------------------------------------------------------------- Markdown */
const tick = (ok) => (ok ? "✅" : "❌");
const groups = [...new Set(checks.map((c) => c.group))];
const sheetRows = plan.sheets.map((s) => `| ${s.sheet} | ${s.page} | ${s.slots.length} | ${s.contents.join(" · ")} |`).join("\n");
const md = `# QC — A3 manual-cut PDF (card fronts only)

_Generated by \`npm run build:a3\` on ${report.generated.slice(0, 10)}: \`scripts/check-manual-cut.mjs\` re-opens the finished PDF with pdf.js and pdf-lib and measures it; \`scripts/render-manual-cut.mjs\` checks the layout in the browser before printing._

**File:** \`${file}\` (${(report.bytes / 1024 / 1024).toFixed(2)} MB, ${doc.numPages} pages)
**Overall: ${report.ok ? "✅ all automated checks passed" : "❌ see failures below"}** (${checks.filter((c) => c.ok).length}/${checks.length} PDF checks${render ? `, ${render.checks.filter((c) => c.ok).length}/${render.checks.length} layout checks` : ""})

## Layout

| | |
|---|---|
| Paper | ${plan.paper}, ${plan.orientation} (${plan.page_width_mm} × ${plan.page_height_mm} mm) |
| Cards per sheet | ${plan.per_sheet} (${plan.columns} columns × ${plan.rows} rows) |
| Sheets | ${plan.sheets.length} card sheets${plan.instructions_page ? " + 1 guide page (page 1)" : ""} |
| Card size | ${W} × ${H} mm, no bleed, cut outline ${mc.cut_line_stroke_mm} mm drawn outside the card |
| Gap between cards | ${plan.cut_gap_mm} mm |
| Margins | ${plan.margins_mm.x} mm left/right, ${plan.margins_mm.y} mm top/bottom |
| Packing | ${plan.packing} |
| Ink saver | ${plan.ink_saver ? "on (white header with a thin rule, white answer background)" : "off (same artwork as the other PDFs)"} |
| Other orientation | ${Object.entries(plan.orientation_options).filter(([k]) => k !== plan.orientation).map(([k, o]) => `${k}: ${o.columns} × ${o.rows} = ${o.per_sheet} per sheet`).join("; ")} |

## Measured in the PDF

- Page size: ${report.measured.page_sizes_mm.join(", ")} mm on every page
- Card cut outlines (inside edge): ${W} × ${H} mm, largest deviation **${report.measured.trim_max_deviation_mm} mm** over ${outlineTotal} cards
- Artwork clip box vs. outline: largest deviation **${report.measured.clip_max_deviation_mm} mm**
- Smallest gap between cards: ${report.measured.min_gap_mm.horizontal} mm horizontal, ${report.measured.min_gap_mm.vertical} mm vertical
- Smallest distance card edge to paper edge: ${report.measured.min_card_to_paper_edge_mm} mm
- Text closest to a card edge: ${report.measured.min_text_clearance_mm} mm ("${report.measured.min_text_clearance_text}", header label; question/answer text, category and footer keep the ${settings.card.safe_margin_mm} mm safe margin${render ? `, measured ${render.min_body_text_clearance_mm} mm in the layout` : ""})
- Scale references: ${scaleRefs.map((s) => `page ${s.page} ${s.what} = ${s.measured_mm.join(", ")} mm`).filter((_, i, a) => i < 2 || i === a.length - 1).join("; ")}${scaleRefs.length > 3 ? " (all sheets checked)" : ""}
- Viewer preferences: PrintScaling = ${viewer.print_scaling}, Duplex = ${viewer.duplex}, PickTrayByPDFSize = ${viewer.pick_tray_by_pdf_size}

## PDF checks

${groups.map((g) => `**${g}**\n\n${checks.filter((c) => c.group === g).map((c) => `- ${tick(c.ok)} ${c.name}${c.detail ? ` (${c.detail})` : ""}`).join("\n")}`).join("\n\n")}
${render ? `
## Layout checks (browser, before printing)

${render.checks.map((c) => `- ${tick(c.ok)} ${c.name}${c.detail ? ` (${c.detail})` : ""}`).join("\n")}
` : ""}
## Sheet map

| Sheet | PDF page | Cards | Contents |
|---:|---:|---:|---|
${sheetRows}

## What cannot be checked automatically

These checks prove the PDF is drawn at the exact size. What comes out of the printer also depends on the print dialog (scaling) and the printer's paper feed. Before printing the full set, print page 1 and measure the test card (${W} × ${H} mm inside the line) and the ${mc.ruler_mm} mm ruler with a real ruler. The PDF asks viewers not to scale (\`PrintScaling None\`), but not every viewer or driver honours it.
`;
writeOut("docs/QC_MANUAL_CUT_A3.md", md);

for (const c of checks) console.log(`  ${tick(c.ok)} [${c.group}] ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
console.log(`${report.ok ? "✓" : "✗"} ${file} inspected: ${checks.filter((c) => c.ok).length}/${checks.length} PDF checks passed → docs/QC_MANUAL_CUT_A3.md`);
if (!report.ok) process.exit(1);
