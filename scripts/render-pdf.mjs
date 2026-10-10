// Renders the two card PDFs with headless Chrome/Edge, then verifies them.
//   exports/cards_home_print_A4.pdf  ← build/home_print.html
//   exports/cards_print_shop.pdf     ← build/print_shop.html (+ TrimBox/BleedBox via pdf-lib)
// Also checks the web preview (preview/preview_gallery.html) renders the same cards, records the text-fit
// results (font sizes, overflow) and audits which fonts Chrome actually used for every piece of text.
// Deeper checks on the finished PDF files (fonts, images, page→card mapping) are in scripts/check-pdf.mjs.
import puppeteer from "puppeteer-core";
import { PDFDocument, PDFName, PDFHexString, PDFNull } from "pdf-lib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, MM_TO_PT, launchOptions, loadProject, readJSON, writeOut, fontCoverage, allowedFontFamilies } from "./lib.mjs";

const { settings, data } = loadProject();
const geo = readJSON("build/print-geometry.json");
const plan = readJSON("build/layout-plan.json");
const shopPlan = readJSON("build/print-shop-plan.json");
const opts = launchOptions(settings);
console.log("Browser:", opts.executablePath);
const ALLOWED = allowedFontFamilies(settings);
const COVER = fontCoverage();
const isCovered = (cp) => COVER.some(([a, b]) => cp >= a && cp <= b);

const browser = await puppeteer.launch(opts);

/** Every font Chrome used to draw text, per element, that is not one of the allowed families. */
async function fontAudit(page) {
  const cdp = await page.createCDPSession();
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const nodes = [];
  (function walk(n, cardId) {
    const attrs = n.attributes || [];
    const attr = (name) => (attrs.includes(name) ? attrs[attrs.indexOf(name) + 1] : null);
    const isCard = n.nodeType === 1 && /(^|\s)card(\s|$)/.test(attr("class") || "");
    const here = isCard ? (attr("data-id") || `back ${attr("data-back")}`) : cardId;
    if (n.nodeType === 1 && (n.children || []).some((c) => c.nodeType === 3 && c.nodeValue.trim())) nodes.push({ n, card: here });
    (n.children || []).forEach((c) => walk(c, here));
  })(root, null);
  const used = new Set(), foreign = [];
  for (const { n, card } of nodes) {
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: n.nodeId });
    for (const f of fonts) {
      used.add(f.familyName);
      if (ALLOWED.some((a) => f.familyName.startsWith(a))) continue;
      const text = n.children.filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join("");
      const chars = [...new Set([...text].filter((ch) => ch.trim() && !isCovered(ch.codePointAt(0))))].join("");
      foreign.push({ font: f.familyName, card, element: n.localName, chars, sample: text.trim().slice(0, 60) });
    }
  }
  await cdp.detach();
  return { families: [...used].sort(), foreign };
}

/** Distance (mm) from the trim line to every label, icon and text block of every card (fronts) and every text of
 *  every back. Measured in the print layouts, where cards are drawn unrotated at 1:1. */
async function safeAudit(page) {
  return page.evaluate((bleedMm) => {
    const PX = 96 / 25.4;
    const FRONT = ".badge, .hdr-gate, .hdr-type, .chip-label, .chip, .cat-en, .cat-fr, .body .en, .body .fr, .divider, .ftr-label, .ftr-code";
    const out = { checked: 0, worst: null, items: [] };
    document.querySelectorAll(".card").forEach((card) => {
      const r = card.getBoundingClientRect();
      const b = bleedMm * PX;
      const trim = { l: r.left + b, t: r.top + b, r: r.right - b, bt: r.bottom - b };
      const name = card.dataset.id ? `${card.dataset.id}/${card.dataset.type}` : `back ${card.dataset.back}`;
      card.querySelectorAll(card.classList.contains("back") ? "svg text" : FRONT).forEach((el) => {
        const e = el.getBoundingClientRect();
        if (!e.width || !e.height) return;
        const d = Math.min(e.left - trim.l, e.top - trim.t, trim.r - e.right, trim.bt - e.bottom) / PX;
        const cls = typeof el.className === "string" ? el.className : el.textContent.trim().slice(0, 24);
        out.checked++;
        if (!out.worst || d < out.worst.d) out.worst = { d: +d.toFixed(2), card: name, element: cls };
        out.items.push({ d, card: name, element: cls });
      });
    });
    out.items.sort((a, b2) => a.d - b2.d);
    out.items = out.items.slice(0, 40).map((x) => ({ ...x, d: +x.d.toFixed(2) }));
    return out;
  }, settings.card.bleed_mm);
}

async function open(rel, ready = () => window.__fitReport && window.__fitReport.done) {
  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(pathToFileURL(join(ROOT, rel)).href, { waitUntil: "load", timeout: 0 });
  await page.waitForFunction(ready, { timeout: 120000 });
  const fit = await page.evaluate(() => window.__fitReport);
  const missingFonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "error").map((f) => `${f.family} ${f.weight} ${f.style}`));
  const fonts = await fontAudit(page);
  return { page, fit, missingFonts, fonts, errors };
}

const results = {};

// 1. Web preview: confirms it renders identically (same templates via the browser card kit) and fits.
{
  const { page, fit, missingFonts, fonts, errors } = await open("preview/preview_gallery.html", () => document.documentElement.dataset.previewReady === "1");
  const info = await page.evaluate(() => {
    const slots = [...document.querySelectorAll("#gallery .slot")];
    return {
      fronts: document.querySelectorAll("#gallery .card.front").length,
      backs: document.querySelectorAll("#gallery .card.back").length,
      backsMatchGate: slots.every((s) => s.querySelector(".face-back .card.back")?.dataset.back === s.dataset.gate),
      frontsMatchCard: slots.every((s) => { const f = s.querySelector(".face-front .card.front"); return f && f.dataset.id === s.dataset.id && f.dataset.type === s.dataset.type; }),
      startFaceDown: slots.every((s) => s.dataset.face === "back"),
    };
  });
  results.gallery = { fit, missingFonts, fonts, errors, ...info };
  await page.close();
  console.log("✓ preview/preview_gallery.html checked");
}

// 2. Home print
{
  const out = settings.home_print.output;
  mkdirSync(dirname(join(ROOT, out)), { recursive: true });
  const { page, fit, missingFonts, fonts, errors } = await open("build/home_print.html");
  await page.pdf({ path: join(ROOT, out), preferCSSPageSize: true, printBackground: true, timeout: 0 });
  results.home = { file: out, fit, missingFonts, fonts, errors, safe: await safeAudit(page) };
  await page.close();
  console.log(`✓ ${out}`);
}

// 3. Print shop
{
  const out = settings.print_shop.output;
  mkdirSync(dirname(join(ROOT, out)), { recursive: true });
  const { page, fit, missingFonts, fonts, errors } = await open("build/print_shop.html");
  await page.pdf({ path: join(ROOT, out), preferCSSPageSize: true, printBackground: true, timeout: 0 });
  results.shop = { file: out, fit, missingFonts, fonts, errors, safe: await safeAudit(page) };
  await page.close();
  console.log(`✓ ${out}`);
}
await browser.close();

// 4. Post-process + verify
const mm = (pt) => +(pt / MM_TO_PT).toFixed(2);
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;
const c = settings.card;
const gateName = Object.fromEntries(data.gates.map((g) => [g.gate, g.name_en]));

/** Two-level PDF bookmarks: [{ title, page (1-based), children: [...] }]. */
function addOutline(pdf, items) {
  const ctx = pdf.context;
  const pages = pdf.getPages();
  const rootRef = ctx.nextRef();
  function level(list, parentRef) {
    const refs = list.map(() => ctx.nextRef());
    let visible = 0;
    list.forEach((it, i) => {
      const d = {
        Title: PDFHexString.fromText(it.title),
        Parent: parentRef,
        Dest: ctx.obj([pages[it.page - 1].ref, PDFName.of("XYZ"), PDFNull, PDFNull, PDFNull]),
      };
      if (i > 0) d.Prev = refs[i - 1];
      if (i < list.length - 1) d.Next = refs[i + 1];
      visible++;
      if (it.children && it.children.length) {
        const sub = level(it.children, refs[i]);
        Object.assign(d, { First: sub.first, Last: sub.last, Count: ctx.obj(-sub.visible) }); // children collapsed
      }
      ctx.assign(refs[i], ctx.obj(d));
    });
    return { first: refs[0], last: refs[refs.length - 1], visible };
  }
  const top = level(items, rootRef);
  ctx.assign(rootRef, ctx.obj({ Type: "Outlines", First: top.first, Last: top.last, Count: top.visible }));
  pdf.catalog.set(PDFName.of("Outlines"), rootRef);
  pdf.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
}

function shopOutline() {
  const pages = shopPlan.pages;
  const range = (list) => `p. ${list[0].page}–${list[list.length - 1].page}`;
  const kind = (t, g) => (t === "answer" ? "Answer cards" : g === "E" ? "Discussion cards" : "Question cards");
  const groupsBy = (list, keyFn) => {
    const out = [];
    for (const p of list) { const k = keyFn(p); if (!out.length || out[out.length - 1].key !== k) out.push({ key: k, pages: [] }); out[out.length - 1].pages.push(p); }
    return out;
  };
  const typeGroups = (list) => groupsBy(list, (p) => `${p.gate}|${p.card_type}`).map((g) => {
    const ids = g.pages.map((p) => p.id);
    return { title: `${kind(g.pages[0].card_type, g.pages[0].gate)} ${ids[0]}–${ids[ids.length - 1]} (${range(g.pages)})`, page: g.pages[0].page };
  });
  if (shopPlan.page_order === "fronts-then-backs") {
    return groupsBy(pages, (p) => p.side).map((s) => ({ title: `${s.key === "front" ? "Fronts" : "Backs"} (${range(s.pages)})`, page: s.pages[0].page, children: typeGroups(s.pages) }));
  }
  return groupsBy(pages, (p) => p.gate).map((g) => ({ title: `Gate ${g.key} — ${gateName[g.key]} (${range(g.pages)})`, page: g.pages[0].page, children: typeGroups(g.pages) }));
}

function homeOutline() {
  const items = [];
  if (settings.home_print.include_instructions) items.push({ title: "Print guide (read first)", page: 1 });
  if (plan.alignment_test) items.push({ title: `Alignment test (p. ${plan.alignment_test.front_page}–${plan.alignment_test.back_page})`, page: plan.alignment_test.front_page });
  for (const g of data.gates) {
    const sheets = plan.sheets.filter((s) => s.gate === g.gate);
    if (!sheets.length) continue;
    items.push({
      title: `Gate ${g.gate} — ${g.name_en} (p. ${sheets[0].front_page}–${sheets[sheets.length - 1].back_page})`, page: sheets[0].front_page,
      children: sheets.map((s) => { const ids = s.slots.filter((x) => x.front).map((x) => x.front.id + (x.front.card_type === "answer" ? " (A)" : "")); return { title: `Sheet ${s.sheet}: ${ids[0]} – ${ids[ids.length - 1]}`, page: s.front_page }; }),
    });
  }
  return items;
}

async function finalise(file, { title, subject, boxes, outline }) {
  const bytes = readFileSync(join(ROOT, file));
  const pdf = await PDFDocument.load(bytes);
  pdf.setTitle(title, { showInWindowTitleBar: true });
  pdf.setAuthor(settings.pdf?.author || "International Fair");
  pdf.setSubject(subject);
  pdf.setKeywords(["International Fair", "Airport Gates", "cards", `trim ${c.trim_width_mm}x${c.trim_height_mm} mm`, `bleed ${c.bleed_mm} mm`]);
  pdf.setCreator("international-fair-airport-cards build (Chrome/Edge + pdf-lib)");
  const pages = pdf.getPages();
  if (boxes) {
    // Artwork is placed from the top-left corner, so anchor the boxes there with the exact configured sizes
    // (Chrome may round the page size by a few hundredths of a millimetre).
    const s = settings.print_shop.slug_mm * MM_TO_PT, b = c.bleed_mm * MM_TO_PT;
    const tw = c.trim_width_mm * MM_TO_PT, th = c.trim_height_mm * MM_TO_PT;
    for (const p of pages) {
      const { height } = p.getSize();
      p.setBleedBox(s, height - s - (th + 2 * b), tw + 2 * b, th + 2 * b);
      p.setTrimBox(s + b, height - s - b - th, tw, th);
    }
  }
  if (outline && settings.pdf?.add_bookmarks !== false) addOutline(pdf, outline);
  writeFileSync(join(ROOT, file), await pdf.save());
  const reloaded = await PDFDocument.load(readFileSync(join(ROOT, file)));
  const sizes = reloaded.getPages().map((p) => [mm(p.getWidth()), mm(p.getHeight())]);
  const first = reloaded.getPages()[0];
  const trim = boxes ? first.getTrimBox() : null;
  const bleed = boxes ? first.getBleedBox() : null;
  return {
    pages: reloaded.getPageCount(),
    page_size_mm: sizes[0],
    uniform_size: sizes.every(([w, h]) => w === sizes[0][0] && h === sizes[0][1]),
    trim_box_mm: trim && [mm(trim.width), mm(trim.height)],
    bleed_box_mm: bleed && [mm(bleed.width), mm(bleed.height)],
    bytes: readFileSync(join(ROOT, file)).length,
  };
}

const size = `${c.trim_width_mm}×${c.trim_height_mm} mm`;
const homePdf = await finalise(settings.home_print.output, { title: "Airport Gates cards — home print A4", subject: `Bilingual EN/FR question cards, 5 gates, ${data.cards.length} cards on A4 (duplex, ${settings.home_print.duplex_flip} flip)`, boxes: false, outline: homeOutline() });
const shopPdf = await finalise(settings.print_shop.output, { title: `Airport Gates cards — print shop (trim ${size}, ${c.bleed_mm} mm bleed)`, subject: `Bilingual EN/FR question cards, 5 gates, ${data.cards.length} cards, 1 card side per page, ${settings.print_shop.page_order}`, boxes: settings.print_shop.set_pdf_boxes, outline: shopOutline() });

const checks = [];
const ck = (name, ok, detail = "") => checks.push({ name, ok, detail });
ck("Home PDF opens and has the expected page count", homePdf.pages === geo.home.pages, `${homePdf.pages} pages, expected ${geo.home.pages}`);
ck("Home PDF pages are A4 (210 × 297 mm)", near(homePdf.page_size_mm[0], settings.home_print.paper_width_mm) && near(homePdf.page_size_mm[1], settings.home_print.paper_height_mm) && homePdf.uniform_size, homePdf.page_size_mm.join(" × ") + " mm");
ck(`Print-shop PDF opens and has 2 pages per card (${data.cards.length * 2})`, shopPdf.pages === data.cards.length * 2, `${shopPdf.pages} pages`);
ck("Print-shop page = card + bleed + slug", near(shopPdf.page_size_mm[0], geo.shop.pageW) && near(shopPdf.page_size_mm[1], geo.shop.pageH) && shopPdf.uniform_size, shopPdf.page_size_mm.join(" × ") + " mm");
if (settings.print_shop.set_pdf_boxes) {
  ck("Print-shop TrimBox = configured trim size", near(shopPdf.trim_box_mm[0], c.trim_width_mm, 0.05) && near(shopPdf.trim_box_mm[1], c.trim_height_mm, 0.05), shopPdf.trim_box_mm.join(" × ") + " mm");
  ck("Print-shop BleedBox = trim + 2 × bleed", near(shopPdf.bleed_box_mm[0], c.trim_width_mm + 2 * c.bleed_mm, 0.05) && near(shopPdf.bleed_box_mm[1], c.trim_height_mm + 2 * c.bleed_mm, 0.05), shopPdf.bleed_box_mm.join(" × ") + " mm");
}

// Text fit across all renders
const fitCards = results.shop.fit.cards; // print-shop renders every card exactly once
const renders = [results.gallery, results.home, results.shop];
const overflow = renders.flatMap((r) => r.fit.cards).filter((x) => x.overflow);
const clipped = renders.flatMap((r) => r.fit.clipped);
ck("Every card's text fits inside the safe area (preview, home PDF, print-shop PDF)", overflow.length === 0, overflow.map((x) => `${x.id}/${x.card_type}`).join(", "));
ck("No clipped labels (header, category, footer)", clipped.length === 0, clipped.map((x) => `${x.id}/${x.card_type} ${x.element}`).join(", "));
ck("Smallest body text ≥ configured minimum", Math.min(...fitCards.map((x) => Math.min(x.en_pt, x.fr_pt))) >= settings.text_fit.min_pt - 0.01);
for (const [label, r] of [["print-shop", results.shop], ["home A4", results.home]]) {
  const w = r.safe.worst;
  ck(`Safe area (${label}): every label, icon and text block on every front and back is ≥ ${c.safe_margin_mm} mm inside the trim`,
    w && w.d >= c.safe_margin_mm - 0.05,
    `${r.safe.checked} elements measured; closest ${w.d} mm (${w.card}, ${w.element})${w.d < c.safe_margin_mm - 0.05 ? " — e.g. " + r.safe.items.filter((x) => x.d < c.safe_margin_mm - 0.05).slice(0, 4).map((x) => `${x.card} ${x.element} ${x.d} mm`).join("; ") : ""}`);
}
ck("Fonts loaded in every render", !renders.some((r) => r.missingFonts.length), renders.flatMap((r) => r.missingFonts).join(", "));
// PDFs: every glyph counts (the whole file goes to the printer). Web preview: only the card artwork counts.
const foreign = renders.flatMap((r, i) => r.fonts.foreign.map((f) => ({ ...f, render: ["preview", "home", "shop"][i] }))).filter((f) => f.render !== "preview" || f.card);
ck(`Only the project fonts are used (${ALLOWED.join(", ")}) — no system-font fallback`, foreign.length === 0,
  [...new Set(foreign.map((f) => `${f.render}: ${f.font} for ${f.card ? "card " + f.card + " " : ""}<${f.element}> ${f.chars ? `“${f.chars}”` : `“${f.sample}”`}`))].slice(0, 12).join("; "));
ck("No script errors while rendering", !renders.some((r) => r.errors.length), renders.flatMap((r) => r.errors).join("; "));
ck(`Web preview shows all ${data.cards.length} fronts`, results.gallery.fronts === data.cards.length, `${results.gallery.fronts}`);
ck("Web preview: every card has its own gate's back, front matches its ID/type, and all start face down",
  results.gallery.backs === data.cards.length && results.gallery.backsMatchGate && results.gallery.frontsMatchCard && results.gallery.startFaceDown,
  `${results.gallery.backs} backs; gate match ${results.gallery.backsMatchGate}; front match ${results.gallery.frontsMatchCard}; face down ${results.gallery.startFaceDown}`);
ck("Home print renders every card front exactly once", results.home.fit.cards.length === data.cards.length, `${results.home.fit.cards.length}`);

// Duplex mapping: every front sits over a back of its own gate.
let duplexOk = true;
const cols = plan.columns, rows = plan.rows;
for (const s of plan.sheets) for (const sl of s.slots) {
  if (!sl.front) continue;
  const exp = plan.duplex_flip === "long-edge" ? { col: cols - 1 - sl.front_pos.col, row: sl.front_pos.row } : { col: sl.front_pos.col, row: rows - 1 - sl.front_pos.row };
  if (sl.back_gate !== sl.front.gate || exp.col !== sl.back_pos.col || exp.row !== sl.back_pos.row) duplexOk = false;
}
ck(`Duplex map: every front lands on its own gate's back (${plan.duplex_flip} flip)`, duplexOk);
ck("Gate-pure sheets: one gate per sheet", plan.sheets.every((s) => s.slots.every((sl) => !sl.front || sl.front.gate === s.gate)));
// Crop marks sit in the paper margin around the card grid; with large cards (e.g. poker size + bleed, 3 across)
// that margin shrinks to almost nothing and the marks would be cut off by the printer.
{
  const hpc = settings.home_print;
  const need = hpc.crop_mark_offset_mm + hpc.crop_mark_length_mm + 3; // + ~3 mm unprintable edge on most printers
  const m = Math.min(geo.home.marginX, geo.home.marginY);
  ck("Home print: the cut marks fit on the paper (margin ≥ mark offset + length + 3 mm printer edge)", m >= need,
    m >= need ? `margins ${geo.home.marginX} × ${geo.home.marginY} mm` : `margins only ${geo.home.marginX} × ${geo.home.marginY} mm, need ${need} mm: reduce home_print.columns/rows or set include_bleed to false`);
}

const fontStats = (type) => {
  const xs = fitCards.filter((x) => x.card_type === type);
  return { min_en: Math.min(...xs.map((x) => x.en_pt)), min_fr: Math.min(...xs.map((x) => x.fr_pt)), shrunk: xs.filter((x) => x.shrunk).map((x) => x.id) };
};
const report = {
  generated: new Date().toISOString(),
  browser: opts.executablePath,
  home: homePdf,
  shop: shopPdf,
  fonts_used: Object.fromEntries(renders.map((r, i) => [["preview", "home", "shop"][i], r.fonts.families])),
  text_fit: { question: fontStats("question"), answer: fontStats("answer"), all_cards: fitCards },
  checks,
  ok: checks.every((x) => x.ok),
};
writeOut("build/pdf-report.json", JSON.stringify(report, null, 2));
for (const x of checks) console.log(`  ${x.ok ? "✓" : "✗"} ${x.name}${x.detail ? ` (${x.detail})` : ""}`);
if (!report.ok) process.exit(1);
