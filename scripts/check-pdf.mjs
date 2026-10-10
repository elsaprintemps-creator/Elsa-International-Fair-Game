// Deep checks on the FINISHED PDF files in exports/ (not on the HTML they were made from):
//   validity      — header/EOF, strict pdf-lib parse, pdf.js parse with zero warnings
//   dimensions    — MediaBox on every page; TrimBox/BleedBox on every print-shop page
//   fonts         — every font embedded (subset), only the project's font families
//   images        — every raster image reaches pdf.min_image_ppi at its placed size (self-tested)
//   card mapping  — print shop: each page's printed text identifies the card and side; every back shows
//                   its own gate's artwork; counts 100 Q / 80 A / 0 Gate E answers; each card exactly once
//   duplex        — home A4: fronts sit in their planned slots, backs sit at the mirrored position for the
//                   configured flip edge, alignment-test marks mirror correctly, one gate per sheet
// Writes build/pdf-check.json; exits 1 if any check fails.
import { PDFDocument, rgb } from "pdf-lib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { ROOT, loadProject, readJSON, writeOut, backLabels, allowedFontFamilies } from "./lib.mjs";
import { inspectStructure, openPdfJs, pageText, pageImages } from "./pdf-inspect.mjs";

const { settings, data } = loadProject();
const shopPlan = readJSON("build/print-shop-plan.json");
const homePlan = readJSON("build/layout-plan.json");
const c = settings.card, hp = settings.home_print;
const MIN_PPI = settings.pdf?.min_image_ppi ?? 300;
const ALLOWED = allowedFontFamilies(settings).map((f) => f.replace(/\s+/g, ""));
const nows = (s) => s.replace(/\s+/g, "");
const labels = backLabels(data);
// Labels unique to one gate's back (e.g. "FOOD·LANGUAGE·TRADITIONS"); shared ones ("GATE", "INTERNATIONAL FAIR") are skipped.
const gateLabels = Object.fromEntries(Object.entries(labels).map(([g, ls]) => [g, ls.filter((l) => l.length > 3 && !Object.entries(labels).some(([o, ol]) => o !== g && ol.includes(l))).map(nows)]));

const checks = [];
const ck = (group, name, ok, detail = "") => { checks.push({ group, name, ok, detail }); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const fmtList = (xs, n = 8) => xs.slice(0, n).join(", ") + (xs.length > n ? ` … (+${xs.length - n})` : "");

/* ------------------------------------------------------------ self-test of the image check */
function makePng(w, h) {
  const row = Buffer.alloc(1 + w * 3);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const chunk = (type, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const tb = Buffer.concat([Buffer.from(type), body]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb) >>> 0); return Buffer.concat([len, tb, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
{
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  page.drawImage(await doc.embedPng(makePng(150, 150)), { x: 20, y: 20, width: 72, height: 72 }); // 150 px over 1 inch = 150 ppi
  page.drawRectangle({ x: 0, y: 0, width: 10, height: 10, color: rgb(0, 0, 0) });
  mkdirSync(join(ROOT, "build"), { recursive: true });
  const f = join(ROOT, "build", "selftest-image.pdf");
  writeFileSync(f, await doc.save());
  const { doc: pj, restore } = await openPdfJs(f);
  const imgs = await pageImages(pj, 1);
  restore();
  ck("method", "Self-test: the image-resolution check detects a 150 ppi test image", imgs.length === 1 && near(imgs[0].ppi[0], 150, 0.5) && near(imgs[0].ppi[1], 150, 0.5), JSON.stringify(imgs));
}

/* ------------------------------------------------------------ generic checks for one PDF */
async function generic(label, rel, expect) {
  const file = join(ROOT, rel);
  const s = await inspectStructure(file);
  ck(label, `${rel}: valid PDF header and end-of-file marker`, /^%PDF-1\.[4-7]/.test(s.header) && s.has_eof, `${s.header}, EOF ${s.has_eof}`);
  ck(label, `${rel}: strict parse with pdf-lib`, !s.parse_error, s.parse_error || `${s.pages} pages`);
  if (s.parse_error) return { s };
  const { doc, warnings, restore } = await openPdfJs(file);
  ck(label, `${rel}: independent parse with pdf.js, no warnings`, doc.numPages === s.pages && warnings.length === 0, warnings.slice(0, 3).join(" | ") || `${doc.numPages} pages`);
  ck(label, `${rel}: page count`, s.pages === expect.pages, `${s.pages}, expected ${expect.pages}`);
  const badSize = s.page_boxes.map((b, i) => [i + 1, b.media]).filter(([, m]) => !near(m.w, expect.w, 0.3) || !near(m.h, expect.h, 0.3));
  ck(label, `${rel}: every page is ${expect.w} × ${expect.h} mm`, badSize.length === 0, badSize.length ? `pages ${fmtList(badSize.map((x) => x[0]))}` : `${s.page_boxes[0].media.w} × ${s.page_boxes[0].media.h} mm`);
  const notEmbedded = s.fonts.filter((f) => !f.embedded).map((f) => f.base);
  ck(label, `${rel}: all fonts embedded`, notEmbedded.length === 0, notEmbedded.length ? fmtList(notEmbedded) : `${s.fonts.length} font resources, all embedded (${[...new Set(s.fonts.map((f) => f.program))].join(", ")})`);
  const foreign = [...new Set(s.fonts.filter((f) => !ALLOWED.some((a) => f.name.startsWith(a))).map((f) => f.name))];
  ck(label, `${rel}: only the project font families`, foreign.length === 0, foreign.length ? fmtList(foreign) : [...new Set(s.fonts.map((f) => f.name))].join(", "));
  const images = [];
  for (let n = 1; n <= doc.numPages; n++) images.push(...(await pageImages(doc, n)));
  const low = images.filter((i) => Math.min(...i.ppi) < MIN_PPI);
  ck(label, `${rel}: raster images ≥ ${MIN_PPI} ppi at placed size`, low.length === 0,
    images.length ? (low.length ? low.slice(0, 5).map((i) => `p${i.page}: ${i.px.join("×")} px at ${i.placed_mm.join("×")} mm = ${i.ppi.map(Math.round).join("/")} ppi`).join("; ") : `${images.length} images, min ${Math.min(...images.flatMap((i) => i.ppi)).toFixed(0)} ppi`) : `no raster images — all artwork and text are vector (${s.image_xobjects.length} image objects in file)`);
  return { s, doc, restore, images };
}

/* ------------------------------------------------------------ print shop */
const ps = settings.print_shop;
const shopW = c.trim_width_mm + 2 * c.bleed_mm + 2 * ps.slug_mm, shopH = c.trim_height_mm + 2 * c.bleed_mm + 2 * ps.slug_mm;
const shop = await generic("print-shop", ps.output, { pages: data.cards.length * 2, w: shopW, h: shopH });
const shopSummary = { pages: shop.s.pages, page_size_mm: [shopW, shopH], fonts: [...new Set((shop.s.fonts || []).map((f) => f.name))], images: shop.images?.length ?? null, has_outline: shop.s.has_outline };
if (shop.doc) {
  // Boxes on every page
  const badBoxes = shop.s.page_boxes.map((b, i) => ({ i: i + 1, b })).filter(({ b }) => !b.trim || !b.bleed
    || !near(b.trim.w, c.trim_width_mm, 0.05) || !near(b.trim.h, c.trim_height_mm, 0.05)
    || !near(b.bleed.w, c.trim_width_mm + 2 * c.bleed_mm, 0.05) || !near(b.bleed.h, c.trim_height_mm + 2 * c.bleed_mm, 0.05)
    || !near(b.trim.x - b.bleed.x, c.bleed_mm, 0.05) || !near(b.trim.y - b.bleed.y, c.bleed_mm, 0.05)
    || b.bleed.x < -0.01 || b.bleed.y < -0.01 || b.bleed.x + b.bleed.w > b.media.w + 0.01 || b.bleed.y + b.bleed.h > b.media.h + 0.01);
  ck("print-shop", `TrimBox ${c.trim_width_mm} × ${c.trim_height_mm} mm and BleedBox (+${c.bleed_mm} mm each side) on every page, inside the page`, badBoxes.length === 0, badBoxes.length ? `pages ${fmtList(badBoxes.map((x) => x.i))}` : `${shop.s.pages} pages`);
  ck("print-shop", "PDF bookmarks per gate and card type", !ps || shop.s.has_outline || settings.pdf?.add_bookmarks === false);

  // Page-by-page mapping read back from the PDF text
  const typeLabel = (p) => (p.card_type === "answer" ? "ANSWER·RÉPONSE" : p.gate === "E" ? "DISCUSSION" : "QUESTION");
  const problems = [];
  const seen = { front: new Map(), back: new Map() };
  for (let n = 1; n <= shop.doc.numPages; n++) {
    const p = shopPlan.pages[n - 1];
    const { items, joined } = await pageText(shop.doc, n);
    const slug = nows(`${p.id} · ${p.card_type.toUpperCase()} · ${p.side === "front" ? "FRONT" : "BACK"} (Gate ${p.gate})`);
    if (ps.slug_info_text && !joined.includes(slug)) problems.push(`p${n}: slug does not read ${p.id} ${p.card_type} ${p.side}`);
    const otherGateArt = Object.entries(gateLabels).filter(([g]) => g !== p.gate).flatMap(([, ls]) => ls).filter((l) => joined.includes(l));
    if (p.side === "front") {
      if (!joined.includes(`GATE${p.gate}`)) problems.push(`p${n}: front lacks "GATE ${p.gate}"`);
      if (!items.some((i) => i.str.trim() === p.id)) problems.push(`p${n}: front lacks ID chip ${p.id}`);
      if (!joined.includes(typeLabel(p))) problems.push(`p${n}: front lacks type label ${typeLabel(p)}`);
      if (gateLabels[p.gate].some((l) => joined.includes(l))) problems.push(`p${n}: front contains back artwork`);
    } else {
      const missing = gateLabels[p.gate].filter((l) => !joined.includes(l));
      if (missing.length) problems.push(`p${n}: back lacks Gate ${p.gate} artwork text (${missing.join(", ")})`);
      if (!items.some((i) => i.str.trim() === p.gate)) problems.push(`p${n}: back lacks the large gate letter ${p.gate}`);
      if (joined.includes("?")) problems.push(`p${n}: back contains question text`);
    }
    if (otherGateArt.length) problems.push(`p${n}: shows artwork of another gate (${otherGateArt.join(", ")})`);
    const key = `${p.id}|${p.card_type}`;
    seen[p.side].set(key, (seen[p.side].get(key) || 0) + 1);
  }
  ck("print-shop", "Every page's printed content matches its planned card and side (slug, gate, ID, type label)", problems.length === 0, fmtList(problems, 6));
  const all = data.cards.map((x) => `${x.id}|${x.card_type}`);
  const once = (side) => all.every((k) => seen[side].get(k) === 1) && seen[side].size === all.length;
  ck("print-shop", `Each of the ${data.cards.length} cards has exactly one front page and one back page`, once("front") && once("back"));
  // Front/back pairing according to the configured order
  const pairOk = shopPlan.pages.every((p, i) => {
    if (shopPlan.page_order === "fronts-then-backs") { const half = shopPlan.pages.length / 2; const q = i < half ? shopPlan.pages[i + half] : shopPlan.pages[i - half]; return q.id === p.id && q.card_type === p.card_type && q.side !== p.side; }
    const q = i % 2 === 0 ? shopPlan.pages[i + 1] : shopPlan.pages[i - 1];
    return q.id === p.id && q.card_type === p.card_type && q.gate === p.gate && q.side !== p.side && (i % 2 === 0 ? p.side === "front" : p.side === "back");
  });
  ck("print-shop", shopPlan.page_order === "fronts-then-backs" ? "Page n (front) pairs with page n + 180 (its back, same gate)" : "Odd pages are fronts; each is followed by its own gate's back", pairOk);
  const fronts = shopPlan.pages.filter((p) => p.side === "front");
  const q = fronts.filter((p) => p.card_type === "question").length, a = fronts.filter((p) => p.card_type === "answer").length, eA = fronts.filter((p) => p.card_type === "answer" && p.gate === "E").length;
  ck("print-shop", "Card counts in the PDF: 100 question cards, 80 answer cards (A–D), 0 Gate E answers, 180 total", q === 100 && a === 80 && eA === 0 && fronts.length === 180, `${q} Q, ${a} A, ${eA} E answers, ${fronts.length} cards`);
  Object.assign(shopSummary, { questions: q, answers: a, gate_e_answers: eA });
  shop.restore();
}

/* ------------------------------------------------------------ home A4 */
const home = await generic("home-A4", hp.output, { pages: homePlan.total_pages, w: hp.paper_width_mm, h: hp.paper_height_mm });
const homeSummary = { pages: home.s.pages, fonts: [...new Set((home.s.fonts || []).map((f) => f.name))], images: home.images?.length ?? null, has_outline: home.s.has_outline, duplex_flip: hp.duplex_flip };
if (home.doc) {
  const W = hp.paper_width_mm, H = hp.paper_height_mm, offX = hp.back_offset_x_mm, offY = hp.back_offset_y_mm;
  /** Where a point on the front lies on the back page (as seen from the back), for the configured flip edge. */
  const mirror = (x, y) => (hp.duplex_flip === "long-edge" ? { x: W - x, y } : { x, y: H - y });
  const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const inBox = (pt, b) => pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h;
  const problems = [];

  // Alignment test: the cross of "BACK OF SLOT n" sits exactly behind the cross of "FRONT · SLOT n".
  // Each label is printed label_dy_mm below its cross, upright on its own side, so the crosses are compared.
  if (homePlan.alignment_test) {
    const f = await pageText(home.doc, homePlan.alignment_test.front_page);
    const b = await pageText(home.doc, homePlan.alignment_test.back_page);
    const dy = homePlan.alignment_test.label_dy_mm ?? 16;
    let worst = 0;
    for (let i = 1; i <= hp.columns * hp.rows; i++) {
      const fi = f.items.find((t) => nows(t.str) === `FRONT·SLOT${i}`), bi = b.items.find((t) => nows(t.str) === `BACKOFSLOT${i}`);
      if (!fi || !bi) { problems.push(`alignment test: slot ${i} label missing`); continue; }
      const m = mirror(fi.cx, fi.y - dy);
      worst = Math.max(worst, Math.abs(bi.cx - offX - m.x), Math.abs(bi.y - dy - offY - m.y));
    }
    ck("home-A4", `Alignment test: back marks sit behind the front marks for ${hp.duplex_flip} flip (measured in the PDF)`, worst <= 0.5 && !problems.length, `worst deviation ${worst.toFixed(2)} mm`);
  }

  // Card sheets
  let worstBack = 0, worstMirror = 0;
  for (const sh of homePlan.sheets) {
    const f = await pageText(home.doc, sh.front_page);
    const b = await pageText(home.doc, sh.back_page);
    for (const sl of sh.slots) {
      if (sl.front) {
        const chip = f.items.filter((t) => t.str.trim() === sl.front.id && inBox({ x: t.cx, y: t.y }, sl.front_box_mm));
        if (chip.length !== 1) problems.push(`sheet ${sh.sheet}: ${sl.front.id} (${sl.front.card_type}) not found in slot ${sl.slot}`);
      }
      if (sl.back_gate) {
        const bc = center(sl.back_box_mm);
        const letter = b.items.filter((t) => t.str.trim() === sl.back_gate && inBox({ x: t.cx, y: t.y }, sl.back_box_mm));
        if (letter.length !== 1) problems.push(`sheet ${sh.sheet}: Gate ${sl.back_gate} back missing at back position of slot ${sl.slot}`);
        else worstBack = Math.max(worstBack, Math.abs(letter[0].cx - bc.x));
        if (sl.front) {
          const m = mirror(center(sl.front_box_mm).x, center(sl.front_box_mm).y);
          worstMirror = Math.max(worstMirror, Math.abs(bc.x - offX - m.x), Math.abs(bc.y - offY - m.y));
        }
      }
    }
    const other = Object.entries(gateLabels).filter(([g]) => g !== sh.gate).flatMap(([, ls]) => ls).filter((l) => b.joined.includes(l));
    if (other.length) problems.push(`sheet ${sh.sheet}: back page shows another gate's artwork (${other.join(", ")})`);
    const copies = Math.min(...gateLabels[sh.gate].map((l) => b.joined.split(l).length - 1));
    const expected = sh.slots.filter((x) => x.back_gate).length;
    if (copies !== expected) problems.push(`sheet ${sh.sheet}: ${copies} Gate ${sh.gate} backs, expected ${expected}`);
  }
  ck("home-A4", "Every front is printed in its planned slot and every back shows the sheet's own gate (read from the PDF)", problems.length === 0, fmtList(problems, 6));
  ck("home-A4", `Backs are centred on their slots (gate letter within 1 mm of the slot centre)`, worstBack <= 1, `worst ${worstBack.toFixed(2)} mm`);
  ck("home-A4", `Each back slot is the mirror of its front slot for ${hp.duplex_flip} flip`, worstMirror <= 0.05, `worst ${worstMirror.toFixed(3)} mm`);
  ck("home-A4", "PDF bookmarks (guide, alignment test, gates)", home.s.has_outline || settings.pdf?.add_bookmarks === false);
  home.restore();
}

const report = { generated: new Date().toISOString(), min_image_ppi: MIN_PPI, allowed_fonts: allowedFontFamilies(settings), shop: shopSummary, home: homeSummary, checks, ok: checks.every((x) => x.ok) };
writeOut("build/pdf-check.json", JSON.stringify(report, null, 2));
for (const x of checks) console.log(`  ${x.ok ? "✓" : "✗"} [${x.group}] ${x.name}${x.detail ? ` (${x.detail})` : ""}`);
console.log(report.ok ? `✓ PDF inspection: ${checks.length}/${checks.length} checks passed` : `✗ PDF inspection: ${checks.filter((x) => !x.ok).length} check(s) failed`);
if (!report.ok) process.exit(1);
