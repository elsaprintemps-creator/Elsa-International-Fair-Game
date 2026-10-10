// Renders build/manual_cut_A3.html to the A3 manual-cut PDF (manual_cut_a3.output) with headless Chrome/Edge.
//   1. Measures the layout in the browser: card box sizes, text fit, every text line inside its card's
//      safe area, page labels outside every card.
//   2. Sets the exact paper size as the MediaBox (Chrome rounds the page size by up to ~0.2 mm), keeping
//      the top-left corner where Chrome places the artwork.
//   3. Asks PDF viewers for no print scaling, one-sided printing and paper picked by page size
//      (ViewerPreferences: PrintScaling None, Duplex Simplex, PickTrayByPDFSize).
// Results → build/manual-cut-render.json. The finished PDF is verified separately by scripts/check-manual-cut.mjs.
import puppeteer from "puppeteer-core";
import { PDFDocument, PrintScaling, Duplex } from "pdf-lib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, MM_TO_PT, launchOptions, allowedFontFamilies, loadProject, readJSON, writeOut } from "./lib.mjs";

const { settings } = loadProject();
const mc = settings.manual_cut_a3;
const plan = readJSON("build/manual-cut-plan.json");
const opts = launchOptions(settings);
console.log("Browser:", opts.executablePath);

const browser = await puppeteer.launch(opts);
const page = await browser.newPage();
page.setDefaultTimeout(0);
await page.goto(pathToFileURL(join(ROOT, "build/manual_cut_A3.html")).href, { waitUntil: "load", timeout: 0 });
await page.waitForFunction(() => window.__fitReport && window.__fitReport.done, { timeout: 120000 });
const fit = await page.evaluate(() => window.__fitReport);
const fonts = await page.evaluate(() => ({
  missing: [...document.fonts].filter((f) => f.status === "error").map((f) => `${f.family} ${f.weight} ${f.style}`),
}));

// Geometry measured in the browser, in mm from each page's top-left corner.
const dom = await page.evaluate((stroke) => {
  const mm = (px) => px * 25.4 / 96;
  const textRects = (root) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) out.push({ text: n.textContent.trim().slice(0, 40), r, header: !!n.parentElement.closest(".hdr") });
    }
    return out;
  };
  const pages = [...document.querySelectorAll(".page")].map((p) => {
    const pr = p.getBoundingClientRect();
    return { el: p, pr, w: mm(pr.width), h: mm(pr.height), sheet: p.classList.contains("sheet") };
  });
  const result = { pages: pages.map(({ w, h, sheet }) => ({ w: +w.toFixed(3), h: +h.toFixed(3), sheet })), slots: [], labels: [], fronts: document.querySelectorAll(".card.front").length, backs: document.querySelectorAll(".card.back, [data-back]").length };
  pages.forEach(({ el, pr }, pi) => {
    const rel = (r) => ({ x: mm(r.left - pr.left), y: mm(r.top - pr.top), w: mm(r.width), h: mm(r.height) });
    const slots = [...el.querySelectorAll(".slot")].map((s) => ({ s, b: rel(s.getBoundingClientRect()) }));
    for (const { s, b } of slots) {
      let clearance = Infinity, closest = "", bodyClearance = Infinity, bodyClosest = "";
      for (const { text, r, header } of textRects(s)) {
        const t = rel(r);
        const c = Math.min(t.x - b.x, b.x + b.w - (t.x + t.w), t.y - b.y, b.y + b.h - (t.y + t.h));
        if (c < clearance) { clearance = c; closest = text; }
        if (!header && c < bodyClearance) { bodyClearance = c; bodyClosest = `${text} [${["left", "right", "top", "bottom"][[t.x - b.x, b.x + b.w - (t.x + t.w), t.y - b.y, b.y + b.h - (t.y + t.h)].indexOf(c)]}]`; }
      }
      const card = s.querySelector(".card.front");
      result.slots.push({ page: pi + 1, slot: +s.dataset.slot, id: s.dataset.id, card_type: s.dataset.type, card_rendered: !!card && card.dataset.id === s.dataset.id && card.dataset.type === s.dataset.type, box_mm: { x: +b.x.toFixed(4), y: +b.y.toFixed(4), w: +b.w.toFixed(4), h: +b.h.toFixed(4) }, min_text_clearance_mm: +clearance.toFixed(3), closest_text: closest, min_body_text_clearance_mm: +bodyClearance.toFixed(3), closest_body_text: bodyClosest });
    }
    for (const lbl of el.querySelectorAll(".mlabel")) {
      for (const { text, r } of textRects(lbl)) {
        const t = rel(r);
        const hits = slots.filter(({ b }) => t.x < b.x + b.w + stroke && t.x + t.w > b.x - stroke && t.y < b.y + b.h + stroke && t.y + t.h > b.y - stroke).map(({ s }) => s.dataset.id);
        const edge = Math.min(t.x, t.y, mm(pr.width) - t.x - t.w, mm(pr.height) - t.y - t.h);
        result.labels.push({ page: pi + 1, text, overlaps_cards: hits, min_edge_distance_mm: +edge.toFixed(2) });
      }
    }
  });
  return result;
}, mc.cut_line_stroke_mm);

mkdirSync(dirname(join(ROOT, mc.output)), { recursive: true });
await page.pdf({ path: join(ROOT, mc.output), preferCSSPageSize: true, printBackground: true, timeout: 0 });
await browser.close();

/* -------------------------------------------------------------- Post-process */
const pdf = await PDFDocument.load(readFileSync(join(ROOT, mc.output)));
const chromeSize = pdf.getPages().map((p) => [+(p.getWidth() / MM_TO_PT).toFixed(2), +(p.getHeight() / MM_TO_PT).toFixed(2)]);
pdf.setTitle(`Airport Gates cards — ${plan.paper} manual-cut sheets, fronts only (${plan.card_trim_mm.w} × ${plan.card_trim_mm.h} mm)`);
pdf.setAuthor(settings.pdf?.author || "International Fair — Airport Gates card game");
pdf.setSubject(`${plan.card_count} card fronts on ${plan.sheets.length} ${plan.paper} sheets. Print at 100 % / Actual size, one-sided, then cut along the outlines.`);
pdf.setCreator("international-fair-airport-cards build (Chrome/Edge + pdf-lib)");
const W = plan.page_width_mm * MM_TO_PT, H = plan.page_height_mm * MM_TO_PT;
for (const p of pdf.getPages()) {
  const mb = p.getMediaBox();
  const top = mb.y + mb.height; // Chrome draws from the top-left corner: keep it, trim the rounding off the right/bottom.
  p.setMediaBox(mb.x, top - H, W, H);
  p.setCropBox(mb.x, top - H, W, H);
}
const vp = pdf.catalog.getOrCreateViewerPreferences();
vp.setPrintScaling(PrintScaling.None);
vp.setDuplex(Duplex.Simplex);
vp.setPickTrayByPDFSize(true);
writeFileSync(join(ROOT, mc.output), await pdf.save());

/* ------------------------------------------------------------------- Checks */
const checks = [];
const ck = (name, ok, detail = "") => checks.push({ name, ok, detail });
const tW = plan.card_trim_mm.w, tH = plan.card_trim_mm.h;
const sizeErr = Math.max(...dom.slots.map((s) => Math.max(Math.abs(s.box_mm.w - tW), Math.abs(s.box_mm.h - tH))));
ck("Layout: every card box is exactly the trim size", dom.slots.length === plan.card_count && sizeErr < 0.01, `${dom.slots.length} boxes, max deviation ${sizeErr.toFixed(4)} mm`);
const posErr = Math.max(...dom.slots.map((s) => {
  const p = plan.sheets.find((x) => x.page === s.page)?.slots.find((x) => x.slot === s.slot);
  return p && p.id === s.id ? Math.max(Math.abs(p.trim_mm.x - s.box_mm.x), Math.abs(p.trim_mm.y - s.box_mm.y)) : Infinity;
}));
ck("Layout: every card sits at its planned position", posErr < 0.01, `max deviation ${posErr.toFixed(4)} mm`);
ck("Layout: each slot shows the card front it was planned for", dom.slots.every((s) => s.card_rendered));
ck("Layout: card fronts only — no back artwork in the document", dom.fronts === plan.card_count && dom.backs === 0, `${dom.fronts} fronts, ${dom.backs} backs`);
const overflow = fit.cards.filter((x) => x.overflow);
ck("Text fit: every card's text fits its text area", fit.cards.length === plan.card_count && overflow.length === 0, overflow.map((x) => `${x.id}/${x.card_type}`).join(", "));
ck("Text fit: no clipped labels (cards and page labels)", fit.clipped.length === 0, fit.clipped.map((x) => `${x.id || "page label"} ${x.element}`).join(", "));
ck("Text fit: smallest body text ≥ configured minimum", Math.min(...fit.cards.map((x) => Math.min(x.en_pt, x.fr_pt))) >= settings.text_fit.min_pt - 0.01, `${Math.min(...fit.cards.map((x) => Math.min(x.en_pt, x.fr_pt)))} pt`);
const minClear = Math.min(...dom.slots.map((s) => s.min_text_clearance_mm));
const worst = dom.slots.reduce((a, b) => (b.min_text_clearance_mm < a.min_text_clearance_mm ? b : a));
const minBody = Math.min(...dom.slots.map((s) => s.min_body_text_clearance_mm));
const worstBody = dom.slots.reduce((a, b) => (b.min_body_text_clearance_mm < a.min_body_text_clearance_mm ? b : a));
// 0.02 mm = a few of Chrome's layout units (1/64 px = 0.004 mm): right-aligned text can end that far past an exact mm position.
ck(`Layout: question/answer text, category and footer ≥ ${settings.card.safe_margin_mm} mm (safe margin) inside the card edge (±0.02 mm layout rounding)`, minBody >= settings.card.safe_margin_mm - 0.02, `closest: ${minBody.toFixed(3)} mm (${worstBody.id}/${worstBody.card_type}, "${worstBody.closest_body_text}")`);
ck(`Layout: all card text, header labels included, ≥ ${mc.min_text_clearance_mm} mm inside the card edge`, minClear >= mc.min_text_clearance_mm, `closest: ${minClear.toFixed(2)} mm (${worst.id}/${worst.card_type}, "${worst.closest_text}")`);
const badLabels = dom.labels.filter((l) => l.overlaps_cards.length);
ck("Layout: page labels sit outside every card", badLabels.length === 0, badLabels.map((l) => `p${l.page} "${l.text}"`).join("; "));
ck("Fonts loaded (project fonts only, no fallbacks needed)", fonts.missing.length === 0, fonts.missing.join(", "));

const report = {
  generated: new Date().toISOString(),
  browser: opts.executablePath,
  file: mc.output,
  chrome_page_size_mm: chromeSize[0],
  allowed_fonts: allowedFontFamilies(settings),
  text_fit: {
    min_en_pt: Math.min(...fit.cards.map((x) => x.en_pt)),
    min_fr_pt: Math.min(...fit.cards.map((x) => x.fr_pt)),
    shrunk: fit.cards.filter((x) => x.shrunk).map((x) => `${x.id}/${x.card_type}`),
  },
  min_text_clearance_mm: +minClear.toFixed(3),
  min_body_text_clearance_mm: +minBody.toFixed(3),
  min_text_clearance_card: `${worst.id}/${worst.card_type}`,
  min_text_clearance_text: worst.closest_text,
  min_label_edge_distance_mm: Math.min(...dom.labels.map((l) => l.min_edge_distance_mm)),
  dom,
  checks,
  ok: checks.every((x) => x.ok),
};
writeOut("build/manual-cut-render.json", JSON.stringify(report, null, 2));
console.log(`✓ ${mc.output} — ${pdf.getPageCount()} pages (Chrome page ${chromeSize[0].join(" × ")} mm → MediaBox set to ${plan.page_width_mm} × ${plan.page_height_mm} mm)`);
for (const x of checks) console.log(`  ${x.ok ? "✓" : "✗"} ${x.name}${x.detail ? ` (${x.detail})` : ""}`);
if (!report.ok) process.exit(1);
