// Builds exports/cards_editable.docx: every card front as an editable Word table at its real size,
// so colleagues can change questions and answers directly on the cards (then send the file back:
// scripts/import-word.mjs reads their text into data/cards.json).
//
// Same look as the PDFs: the cards are first drawn in headless Chrome with the shared template
// (src/templates.mjs + src/cards.css), the same fonts and the same text fitting. From that render we take
//   - each card's typeset text (curly quotes, French non-breaking spaces, unbreakable short hyphenated words)
//     and its fitted font sizes (rounded down to Word's half-point steps, so the text still fits);
//   - pictures of the parts nobody edits: the header band (gate, type, card ID), flags, divider, arrows, barcode.
// Everything else is real Word: card size, colours, category line, question/answer text, footer, colour strip.
// The two card fonts are embedded (OFL TrueType files in assets/fonts/ttf/), so the file looks right without
// installing anything. Each English/French text is a content control tagged "<id>|<type>|<en|fr>".
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { ROOT, loadProject, launchOptions, writeOut } from "./lib.mjs";
import { head, renderFront } from "../src/templates.mjs";
import { flag, arrow, barcode, plane } from "../src/icons.mjs";
import { writeZip } from "./zip.mjs";
import { tagOf } from "./docx-text.mjs";

export const DOCX_OUT = "exports/cards_editable.docx";
const { settings, data, gateMap } = loadProject();
const cards = data.cards;
const DPI = 600, HEADER_DPI = 400;
const WORD_MARGIN = 3.5;   // mm of extra room kept free when sizing the Word text (see step 1)

/* ------------------------------------------------------------ geometry (mm) */
// Mirrors src/cards.css, measured from the trim edge (the Word cards have no bleed).
const TW = settings.card.trim_width_mm, TH = settings.card.trim_height_mm, SAFE = settings.card.safe_margin_mm;
const HDR_H = SAFE + 11.7;                 // header band
const BODY_TOP = SAFE + 20.9;              // top of the question/answer area
const FTR_H = 13;                          // footer stub incl. colour strip
const STRIP_H = 2.4;
const BODY_GAP = 13.6 - FTR_H;             // space between the text area and the footer
const CODE_W = 11;                         // barcode width
const ROWS = { header: HDR_H, cat: BODY_TOP - HDR_H, body: TH - FTR_H - BODY_TOP, footer: FTR_H - STRIP_H, strip: STRIP_H };
const tw = (mm) => Math.round((mm * 1440) / 25.4);   // twips
const emu = (mm) => Math.round(mm * 36000);
const ptEmu = (pt) => Math.round(pt * 12700);

// Page: A4 landscape, two rows of four cards (question next to its answer).
const PAGE = { w: 297, h: 210, top: 10, bottom: 7 };
const GAPS_PAIRS = [4, 10, 4], GAPS_SINGLE = [6, 6, 6];
const ROW_GAP = 6;
const GRID_W = 4 * TW + GAPS_PAIRS.reduce((a, b) => a + b, 0);
const SIDE = (PAGE.w - GRID_W) / 2;

/* ------------------------------------------------------------ colours (design/tokens.css) */
const C = { navy: "0B2545", teal: "0B6F79", turq: "1FB5BE", yellow: "FFC93C", white: "FFFFFF", bordeaux: "6D071A", yellowTint: "FFF6DB", turqTint: "D9F2F4", grey: "5B6B80", cut: "B8C1CC" };
const FIELD = { A: C.turq, B: C.navy, C: C.yellow, D: C.teal, E: C.bordeaux };          // --gate-X-field
const MARK = { A: C.turq, B: C.navy, C: C.yellow, D: C.teal, E: C.bordeaux };           // --g-mark (category bar)
// Footer perforation: navy at 35 % opacity over the card background.
const PERF = { white: "AAB3BE", yellowTint: "AAADA7" };

/* ------------------------------------------------------------ 1. draw the cards in Chrome */
const extraCss = `
  html, body { margin: 0; background: transparent; }
  #stage { position: absolute; left: 0; top: 0; padding: 2px; }
  .flagart .flag { display: block; width: 1.35em; height: 0.9em; border-radius: 0.12em; overflow: hidden; outline: 0.12mm solid rgba(11, 37, 69, 0.35); outline-offset: -0.12mm; }
  .flagart .flag svg { display: block; width: 100%; height: 100%; }
  .divart { width: ${TW - 2 * SAFE}mm; }
  .divart .divider { margin: 0; }
  .arrart svg { display: block; width: 15mm; height: 6.6mm; }
  .bcart { display: block; width: ${CODE_W}mm; height: 3.8mm; color: #${C.navy}; }
  .bcart svg { display: block; width: 100%; height: 100%; }`;
const html = `${head({ title: "Word card art", rel: "../", settings, extraCss })}
<body><script>window.__FIT_MANUAL__ = true;</script><div id="stage"></div></body></html>`;
mkdirSync(join(ROOT, "build"), { recursive: true });
writeFileSync(join(ROOT, "build/docx-art.html"), html, "utf8");

const browser = await puppeteer.launch(launchOptions(settings));
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 520, deviceScaleFactor: DPI / 96 });
await page.goto(pathToFileURL(join(ROOT, "build/docx-art.html")).href, { waitUntil: "load" });
await page.evaluate(() => window.CardFit.ready());

const images = new Map();          // key → PNG Buffer
const stage = (markup) => page.evaluate((m) => { document.getElementById("stage").innerHTML = m; }, markup);
/** Photograph what is on stage (or a clip inside it, in CSS px) as a PNG, transparent unless asked otherwise. */
async function shoot(key, markup, { clip, transparent = true } = {}) {
  if (markup != null) await stage(markup);
  const box = await page.evaluate((c) => {
    const el = document.getElementById("stage").firstElementChild;
    const r = el.getBoundingClientRect();
    return c ? { x: r.x + c.x, y: r.y + c.y, width: c.width, height: c.height } : { x: r.x, y: r.y, width: r.width, height: r.height };
  }, clip || null);
  images.set(key, Buffer.from(await page.screenshot({ clip: box, omitBackground: transparent, type: "png" })));
}

// Shared ornaments.
const fixedEn = settings.text_fit.question_en_pt;
for (const lang of ["en", "fr"]) await shoot(`flag-${lang}`, `<span class="flagart" style="display:inline-block;font-size:${fixedEn}pt"><span class="flag">${flag[lang]()}</span></span>`);
for (const g of data.gates) await shoot(`div-${g.gate}`, `<div class="divart gate-${g.gate}"><div class="divider">${plane()}</div></div>`);
await shoot("arr-navy", `<span class="arrart" style="display:block;color:#${C.navy}">${arrow()}</span>`);
await shoot("arr-teal", `<span class="arrart" style="display:block;color:#${C.teal}">${arrow()}</span>`);

// Each card: fit the text like the PDFs, read the typeset text and the footer code width.
// Word sets some lines a little taller than Chrome, so the text is fitted into a body WORD_MARGIN mm shorter;
// only the tightest cards come out a few tenths of a point smaller than in the PDFs.
const PX = 96 / 25.4;
const bleedPx = settings.card.bleed_mm * PX;
const typeset = new Map();
let codeTextMm = 0;
for (const card of cards) {
  let info;
  for (const margin of [WORD_MARGIN, 0]) {
    await stage(`<div>${renderFront(card, gateMap[card.gate])}</div>`);
    info = await page.evaluate((margin) => {
      const el = document.querySelector("#stage .card");
      el.querySelector(".body").style.bottom = `calc(var(--bleed) + 13.6mm + ${margin}mm)`;
      const fit = window.CardFit.fitCard(el);
      const runs = (node) => [...node.childNodes].flatMap((n) => {
        if (n.nodeType === 3) return n.nodeValue ? [{ t: n.nodeValue }] : [];
        if (n.classList.contains("flag") || n.classList.contains("opts")) return [];
        return [{ t: n.textContent, nb: n.classList.contains("nw") }];
      });
      const block = (p) => [runs(p), ...[...p.querySelectorAll(".opt")].map(runs)];
      const pt = (p) => parseFloat(getComputedStyle(p).fontSize) * 0.75;
      const en = el.querySelector(".body .en"), fr = el.querySelector(".body .fr");
      const codePx = el.querySelector(".ftr-code span").getBoundingClientRect().width;
      return { en: block(en), fr: block(fr), enPt: pt(en), frPt: pt(fr), overflow: fit.overflow, codePx };
    }, margin);
    if (!info.overflow) break;   // too tight with the Word margin: fall back to the PDF fit
  }
  if (info.overflow) throw new Error(`${card.id} ${card.card_type}: text does not fit the card (fix the text first; see npm run build).`);
  typeset.set(`${card.id}|${card.card_type}`, info);
  codeTextMm = Math.max(codeTextMm, info.codePx / PX);
  await shoot(`bc-${card.id}-${card.card_type}`, `<span class="bcart">${barcode(card.id + card.card_type)}</span>`);
}

// Header bands (gate, type, card ID) at HEADER_DPI: sharp in print, and a much smaller file.
await page.setViewport({ width: 480, height: 520, deviceScaleFactor: HEADER_DPI / 96 });
for (const card of cards) {
  await shoot(`hdr-${card.id}-${card.card_type}`, `<div>${renderFront(card, gateMap[card.gate])}</div>`,
    { clip: { x: bleedPx, y: bleedPx, width: TW * PX, height: HDR_H * PX }, transparent: false });
}
await browser.close();
// The footer code column holds the barcode and "INTL FAIR · A10" (wider than the barcode on the cards).
const CODE_COL = Math.max(CODE_W, codeTextMm + 1) + SAFE;

/* ------------------------------------------------------------ 2. WordprocessingML helpers */
const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FONT = { text: "Atkinson Hyperlegible", sign: "Barlow Condensed", signSemi: "Barlow Condensed SemiBold", signHeavy: "Barlow Condensed ExtraBold" };

function rPr(o = {}) {
  return `<w:rPr>${o.font ? `<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/>` : ""}${o.b ? "<w:b/><w:bCs/>" : ""}${o.i ? "<w:i/><w:iCs/>" : ""}${o.caps ? "<w:caps/>" : ""}${o.noProof ? "<w:noProof/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}${o.spacing ? `<w:spacing w:val="${o.spacing}"/>` : ""}${o.position ? `<w:position w:val="${o.position}"/>` : ""}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ""}${o.lang ? `<w:lang w:val="${o.lang}"/>` : ""}</w:rPr>`;
}
/** Characters a TrueType font can draw (format-4 cmap of its Windows Unicode table). */
function coverage(file) {
  const b = readFileSync(join(ROOT, "assets/fonts/ttf", file));
  const tables = {};
  for (let i = 0; i < b.readUInt16BE(4); i++) tables[b.toString("latin1", 12 + i * 16, 16 + i * 16)] = b.readUInt32BE(20 + i * 16);
  const cm = tables.cmap;
  let sub = 0;
  for (let i = 0; i < b.readUInt16BE(cm + 2); i++) if (b.readUInt16BE(cm + 4 + i * 8) === 3 && b.readUInt16BE(cm + 6 + i * 8) === 1) sub = cm + b.readUInt32BE(cm + 8 + i * 8);
  const segs = b.readUInt16BE(sub + 6) / 2, ends = sub + 14, starts = ends + segs * 2 + 2;
  return (cp) => { for (let i = 0; i < segs; i++) if (cp >= b.readUInt16BE(starts + i * 2) && cp <= b.readUInt16BE(ends + i * 2)) return true; return false; };
}
const covers = { [FONT.text]: coverage("AtkinsonHyperlegible-Regular.ttf"), [FONT.sign]: coverage("BarlowCondensed-Bold.ttf") };
covers[FONT.signSemi] = covers[FONT.signHeavy] = covers[FONT.sign];
/** Letters the font lacks as one character (e.g. "ō" in Atkinson Hyperlegible) are written as letter + combining
 *  accent, which the font has, like Chrome does on the PDF cards. Word would otherwise switch to another font. */
function drawable(text, font) {
  const has = covers[font || FONT.text];
  if (!has) return text;
  return [...text].map((ch) => {
    if (has(ch.codePointAt(0))) return ch;
    const parts = ch.normalize("NFD");
    return [...parts].every((p) => has(p.codePointAt(0))) ? parts : ch;
  }).join("");
}

/** A text run; "nb" text keeps its hyphens unbreakable (like the cards' short hyphenated words). */
function run(text, o = {}) {
  text = drawable(String(text), o.font);
  const parts = o.nb ? text.split("-") : [text];
  const body = parts.map((p, i) => (i ? "<w:noBreakHyphen/>" : "") + (p ? `<w:t xml:space="preserve">${x(p)}</w:t>` : "")).join("");
  return `<w:r>${rPr(o)}${body}</w:r>`;
}
function pPr(o = {}) {
  const spacing = `<w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}" w:line="${o.line || 240}" w:lineRule="${o.lineRule || (o.line ? "exact" : "auto")}"/>`;
  const bdr = o.barColor ? `<w:pBdr><w:left w:val="single" w:sz="${o.barSz}" w:space="${o.barSpace}" w:color="${o.barColor}"/></w:pBdr>` : "";
  const shd = o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : "";
  const tabs = o.tabRight ? `<w:tabs><w:tab w:val="right" w:pos="${o.tabRight}"/></w:tabs>` : "";
  const ind = o.left || o.hanging ? `<w:ind w:left="${o.left || 0}"${o.hanging ? ` w:hanging="${o.hanging}"` : ""}/>` : "";
  return `<w:pPr>${o.keepNext ? "<w:keepNext/>" : ""}${o.pageBreak ? "<w:pageBreakBefore/>" : ""}${bdr}${shd}${tabs}${spacing}${ind}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ""}${o.mark ? rPr(o.mark) : ""}</w:pPr>`;
}
const para = (content, o = {}) => `<w:p>${pPr(o)}${content}</w:p>`;
const TINY = { sz: 2 };
const tinyPara = () => para("", { line: 20, mark: TINY });

// Pictures: one relationship per distinct image, reused wherever it appears.
const rels = new Map();      // key → rId
let drawingId = 0;
function picture(key, wMm, hMm, descr, runOpts = {}) {
  if (!images.has(key)) throw new Error(`missing image ${key}`);
  if (!rels.has(key)) rels.set(key, `rIdImg${rels.size + 1}`);
  const id = ++drawingId, cx = typeof wMm === "object" ? wMm.emu : emu(wMm), cy = typeof hMm === "object" ? hMm.emu : emu(hMm);
  return `<w:r>${rPr({ ...runOpts, noProof: true })}<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Picture ${id}" descr="${x(descr)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${key}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rels.get(key)}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

const cellMar = (m) => `<w:tcMar><w:top w:w="${m.top || 0}" w:type="dxa"/><w:left w:w="${m.left || 0}" w:type="dxa"/><w:bottom w:w="${m.bottom || 0}" w:type="dxa"/><w:right w:w="${m.right || 0}" w:type="dxa"/></w:tcMar>`;
function cell(content, o = {}) {
  const borders = o.topBorder ? `<w:tcBorders><w:top w:val="dashed" w:sz="6" w:space="0" w:color="${o.topBorder}"/></w:tcBorders>` : "";
  const shd = o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${o.w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ""}${borders}${shd}${cellMar(o.mar || {})}${o.vAlign ? `<w:vAlign w:val="${o.vAlign}"/>` : ""}</w:tcPr>${content}</w:tc>`;
}
const row = (cells, { h, rule = "exact" } = {}) => `<w:tr><w:trPr><w:cantSplit/>${h ? `<w:trHeight w:val="${h}" w:hRule="${rule}"/>` : ""}</w:trPr>${cells}</w:tr>`;

/* ------------------------------------------------------------ 3. one card */
const LABELS = {
  question: { type: "Question", en: (id) => ["Answer", `card ${id}`], fr: (id) => ["Réponse", `carte ${id}`] },
  answer: { type: "Answer", en: (id) => ["Question", `card ${id}`], fr: (id) => ["Question", `carte ${id}`] },
  discussion: { type: "Discussion", en: () => ["No right answer · share yours"], fr: () => ["Pas de bonne réponse : raconte !"] },
};
const kindOf = (c) => (c.card_type === "answer" ? "answer" : c.gate === "E" ? "discussion" : "question");
const halfDown = (pt) => Math.floor(pt * 2 + 1e-6);            // Word sizes in half-points, never larger than the PDF
let sdtId = 1000;

function textBlock(card, lang, info, sizeHalf) {
  const kind = kindOf(card);
  const pt = sizeHalf / 2;
  const isEn = lang === "en";
  const lh = Math.round((isEn ? 1.22 : 1.25) * pt * 20);
  const font = { font: FONT.text, b: isEn, color: isEn ? C.navy : C.teal, sz: sizeHalf, lang: isEn ? "en-GB" : "fr-FR" };
  const paras = (isEn ? info.en : info.fr).map((runs, i) => {
    const text = runs.map((r) => run(r.t, { ...font, nb: r.nb })).join("");
    if (i === 0) {
      const flagRun = picture(`flag-${lang}`, { emu: ptEmu(1.35 * pt) }, { emu: ptEmu(0.9 * pt) }, isEn ? "English" : "Français", { position: -Math.round(0.2 * pt), sz: sizeHalf });
      // A space after the flag (0.35 em on the cards).
      return para(flagRun + run(" ", { ...font, spacing: Math.round(0.1 * pt * 20) }) + text, { line: lh, mark: font });
    }
    const ind = Math.round(1.3 * pt * 20);
    return para(text, { line: lh, left: ind, hanging: ind, before: i === 1 ? Math.round(0.2 * pt * 20) : 0, mark: font });
  });
  const name = `${card.id} · ${kind === "answer" ? "Answer" : kind === "discussion" ? "Discussion" : "Question"} · ${isEn ? "English" : "Français"}`;
  return `<w:sdt><w:sdtPr><w:alias w:val="${x(name)}"/><w:tag w:val="${tagOf(card, lang)}"/><w:id w:val="${++sdtId}"/><w:lock w:val="sdtLocked"/></w:sdtPr><w:sdtContent>${paras.join("")}</w:sdtContent></w:sdt>`;
}

function cardTable(card) {
  const kind = kindOf(card);
  const info = typeset.get(`${card.id}|${card.card_type}`);
  const gate = gateMap[card.gate];
  const bg = kind === "answer" ? C.yellowTint : null;
  const W = tw(TW), codeCol = tw(CODE_COL), labelCol = W - codeCol;
  const side = tw(SAFE);

  const header = row(cell(para(picture(`hdr-${card.id}-${card.card_type}`, TW, HDR_H, `Gate ${card.gate} · ${LABELS[kind].type} · card ${card.id}`, TINY), { mark: TINY }),
    { w: W, span: 2, fill: kind === "answer" ? C.yellow : C.navy }), { h: tw(ROWS.header) });

  const catPara = (text, o) => para(run(text, { ...o, noProof: true }), { line: o.line, barColor: MARK[card.gate], barSz: 24, barSpace: 6, left: tw(1.1 + 2), mark: o });
  const category = row(cell(
    catPara(gate.short_en, { font: FONT.sign, b: true, caps: true, sz: 13, spacing: 5, color: C.navy, line: Math.round(6.4 * 1.15 * 20), lang: "en-GB" }) +
    catPara(gate.short_fr, { font: FONT.text, i: true, sz: 12, color: C.teal, line: Math.round(5.9 * 1.2 * 20), lang: "fr-FR" }),
    { w: W, span: 2, fill: bg, mar: { top: tw(1.6), left: side, right: side } }), { h: tw(ROWS.cat) });

  const enHalf = halfDown(info.enPt), frHalf = halfDown(info.frPt);
  const divider = para(picture(`div-${card.gate}`, TW - 2 * SAFE, 3.2, "divider", TINY), { before: tw(2.1), after: tw(2.1), mark: TINY });
  // The cell starts with a tiny empty paragraph: Word moves a content control that begins a cell out to the whole row.
  const body = row(cell(tinyPara() + textBlock(card, "en", info, enHalf) + divider + textBlock(card, "fr", info, frHalf) + tinyPara(),
    { w: W, span: 2, fill: bg, vAlign: "center", mar: { left: side, right: side, bottom: tw(BODY_GAP) } }), { h: tw(ROWS.body), rule: "atLeast" });

  const L = LABELS[kind];
  const labelRuns = (parts, o, arrowKey, arrowPt) => parts.map((p, i) => (i ? run(" ", o) + picture(arrowKey, { emu: ptEmu(1.5 * arrowPt) }, { emu: ptEmu(0.66 * arrowPt) }, "→", { position: 1 }) + run(" ", o) : "") + run(p, o)).join("");
  const enO = { font: FONT.sign, b: true, caps: true, sz: 12, spacing: 7, color: C.navy, noProof: true, lang: "en-GB" };
  const frO = { font: FONT.text, i: true, sz: 11, color: C.teal, noProof: true, lang: "fr-FR" };
  const perf = bg ? PERF.yellowTint : PERF.white;
  const footer = row(
    cell(para(labelRuns(L.en(card.id), enO, "arr-navy", 6), { line: 126, mark: enO }) + para(labelRuns(L.fr(card.id), frO, "arr-teal", 5.6), { line: 124, before: tw(0.5), mark: frO }),
      { w: labelCol, fill: bg, topBorder: perf, vAlign: "center", mar: { left: side, right: tw(2) } }) +
    cell(para(picture(`bc-${card.id}-${card.card_type}`, CODE_W, 3.8, "barcode ornament", TINY), { jc: "right", mark: TINY }) +
      para(run(`INTL FAIR · ${card.id}`, { font: FONT.signSemi, sz: 9, spacing: 12, color: C.navy, noProof: true }), { jc: "right", line: 110, before: tw(0.5) }),
      { w: codeCol, fill: bg, topBorder: perf, vAlign: "center", mar: { right: side } }),
    { h: tw(ROWS.footer) });

  const strip = row(cell(tinyPara(), { w: W, span: 2, fill: FIELD[card.gate] }), { h: tw(ROWS.strip) });

  const edge = `w:val="single" w:sz="4" w:space="0" w:color="${C.cut}"`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${W}" w:type="dxa"/><w:tblBorders><w:top ${edge}/><w:left ${edge}/><w:bottom ${edge}/><w:right ${edge}/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr><w:tblGrid><w:gridCol w:w="${labelCol}"/><w:gridCol w:w="${codeCol}"/></w:tblGrid>${header}${category}${body}${footer}${strip}</w:tbl>`;
}

/* ------------------------------------------------------------ 4. pages */
const gridCols = (gaps) => [TW, gaps[0], TW, gaps[1], TW, gaps[2], TW].map(tw);
function pageTable(rowsOfCards, gaps) {
  const cols = gridCols(gaps);
  const noBorders = `<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>`;
  const cardRow = (list) => row(cols.map((w, i) => cell(i % 2 === 0 && list[i / 2] ? cardTable(list[i / 2]) + tinyPara() : tinyPara(), { w })).join(""));
  const spacer = row(cell(tinyPara(), { w: cols.reduce((a, b) => a + b, 0), span: 7 }), { h: tw(ROW_GAP) });
  const body = rowsOfCards.map(cardRow).join(spacer);
  return `<w:tbl><w:tblPr><w:tblW w:w="${cols.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:jc w:val="center"/>${noBorders}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr><w:tblGrid>${cols.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${body}</w:tbl>`;
}

function pageTitle(gate, note) {
  const g = gateMap[gate];
  return para(
    run(`GATE ${gate}`, { font: FONT.signHeavy, sz: 28, spacing: 6, color: C.navy, noProof: true }) +
    run(`   ${g.short_en}`, { font: FONT.sign, b: true, caps: true, sz: 22, spacing: 8, color: C.navy, lang: "en-GB" }) +
    run(`  ·  ${g.short_fr}`, { font: FONT.text, i: true, sz: 18, color: C.teal, lang: "fr-FR" }) +
    `<w:r>${rPr({ sz: 16 })}<w:tab/></w:r>` + run(note, { font: FONT.text, sz: 16, color: C.grey, noProof: true }),
    { pageBreak: true, keepNext: true, barColor: FIELD[gate], barSz: 36, barSpace: 8, left: tw(4), tabRight: tw(GRID_W), after: tw(3), mark: { sz: 28 } });
}

const pages = [];
for (const g of data.gates) {
  const qs = cards.filter((c) => c.gate === g.gate && c.card_type === "question");
  const answerOf = (q) => cards.find((c) => c.card_type === "answer" && c.id === q.id);
  const paired = qs.every(answerOf);
  const perPage = paired ? 4 : 8;
  for (let i = 0; i < qs.length; i += perPage) {
    const chunk = qs.slice(i, i + perPage);
    const range = `${chunk[0].id}–${chunk.at(-1).id}`;
    if (paired) {
      const list = chunk.flatMap((q) => [q, answerOf(q)]);
      pages.push(pageTitle(g.gate, `Cards ${range} · each question next to its answer`) + pageTable([list.slice(0, 4), list.slice(4, 8)].filter((r) => r.length), GAPS_PAIRS));
    } else {
      pages.push(pageTitle(g.gate, `Cards ${range} · discussion cards (no answer card)`) + pageTable([chunk.slice(0, 4), chunk.slice(4, 8)].filter((r) => r.length), GAPS_SINGLE));
    }
  }
}

/* ------------------------------------------------------------ 5. first page: how to edit */
const nQ = cards.filter((c) => c.card_type === "question").length, nA = cards.length - nQ;
const en = (t, o = {}) => run(t, { font: FONT.text, sz: 21, color: C.navy, lang: "en-GB", ...o });
const fr = (t, o = {}) => run(t, { font: FONT.text, i: true, sz: 18, color: C.teal, lang: "fr-FR", ...o });
const step = (n, enText, frText) => para(
  run(`${n}`, { font: FONT.signHeavy, sz: 24, color: C.navy, noProof: true }) + `<w:r><w:tab/></w:r>` + en(enText) + `<w:r><w:br/></w:r>` + fr(frText),
  { left: tw(9), hanging: tw(9), after: tw(3.2), line: 264, lineRule: "auto" });
const cover = [
  para(run("FGES AIRPORT GATES", { font: FONT.signHeavy, sz: 64, spacing: 10, color: C.navy, noProof: true }), { after: tw(1) }),
  para(run("All cards · editable Word version", { font: FONT.sign, b: true, caps: true, sz: 28, spacing: 12, color: C.teal, lang: "en-GB" }) + run("   Toutes les cartes · version Word modifiable", { font: FONT.text, i: true, sz: 22, color: C.teal, lang: "fr-FR" }), { after: tw(6) }),
  para(en(`Every card of the deck at its real size (${TW} × ${TH} mm), as it will be printed: ${nQ} question cards and ${nA} answer cards, gate by gate. Each question card sits next to its answer card; Gate E has discussion cards only.`), { after: tw(1.2), line: 276, lineRule: "auto" }),
  para(fr(`Toutes les cartes du jeu à leur taille réelle, telles qu’elles seront imprimées : ${nQ} cartes question et ${nA} cartes réponse, porte par porte. Chaque carte question est à côté de sa carte réponse ; la porte E n’a que des cartes de discussion.`), { after: tw(7), line: 264, lineRule: "auto" }),
  para(run("How to change a question or an answer", { font: FONT.sign, b: true, caps: true, sz: 26, spacing: 10, color: C.navy, lang: "en-GB" }) + run("   Modifier une question ou une réponse", { font: FONT.text, i: true, sz: 20, color: C.teal, lang: "fr-FR" }), { after: tw(3), keepNext: true, barColor: C.yellow, barSz: 36, barSpace: 8, left: tw(4) }),
  step(1, "Click in the English or French text of a card and type. Each text has its own box, named after the card (e.g. “A10 · Question · English”).",
    "Cliquez dans le texte anglais ou français d’une carte et tapez. Chaque texte a sa propre zone, nommée d’après la carte (ex. « A10 · Question · English »)."),
  step(2, "Multiple-choice questions keep one option per line: A), B), C). If you change an option, update the answer card too, with the same letter in English and French.",
    "Les QCM gardent une option par ligne : A), B), C). Si vous changez une option, modifiez aussi la carte réponse, avec la même lettre en anglais et en français."),
  step(3, "Change only the question and answer texts. The card number, the coloured header and the footer stay as they are.",
    "Ne modifiez que les textes des questions et des réponses. Le numéro de carte, l’en-tête de couleur et le pied de carte restent tels quels."),
  step(4, "If a card becomes taller than the cards next to it, its text is too long. The printed card makes the text a little smaller to fit, but please keep it short.",
    "Si une carte devient plus haute que ses voisines, son texte est trop long. La carte imprimée réduit un peu la taille du texte, mais restez bref."),
  step(5, "Save the file as a Word document (.docx) and send it to the coordinator.",
    "Enregistrez le fichier au format Word (.docx) et envoyez-le au coordinateur."),
  para(run("For the coordinator: ", { font: FONT.text, b: true, sz: 18, color: C.navy }) + run("npm run import-word -- <file>.docx", { font: "Consolas", sz: 18, color: C.navy, noProof: true }) +
    run(" reads the texts, checks them, keeps a backup of data/cards.json and updates it (tracked changes count as accepted). Then run ", { font: FONT.text, sz: 18, color: C.navy }) +
    run("npm run build", { font: "Consolas", sz: 18, color: C.navy, noProof: true }) + run(" to remake the PDFs and the website.", { font: FONT.text, sz: 18, color: C.navy }),
    { before: tw(4), shade: C.turqTint, line: 264, lineRule: "auto" }),
].join("");

/* ------------------------------------------------------------ 6. package */
const NS = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14"`;
const sectPr = `<w:sectPr><w:pgSz w:w="${tw(PAGE.w)}" w:h="${tw(PAGE.h)}" w:orient="landscape"/><w:pgMar w:top="${tw(PAGE.top)}" w:right="${tw(SIDE)}" w:bottom="${tw(PAGE.bottom)}" w:left="${tw(SIDE)}" w:header="284" w:footer="284" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${cover}${pages.join("")}${tinyPara()}${sectPr}</w:body></w:document>`;

// Fonts: obfuscated TrueType per ECMA-376 §17.8.1 (first 32 bytes XOR the reversed font-key GUID).
const FONT_FILES = [
  { family: FONT.text, style: "Regular", file: "AtkinsonHyperlegible-Regular.ttf" },
  { family: FONT.text, style: "Bold", file: "AtkinsonHyperlegible-Bold.ttf" },
  { family: FONT.text, style: "Italic", file: "AtkinsonHyperlegible-Italic.ttf" },
  { family: FONT.sign, style: "Bold", file: "BarlowCondensed-Bold.ttf" },
  { family: FONT.signSemi, style: "Regular", file: "BarlowCondensed-SemiBold.ttf" },
  { family: FONT.signHeavy, style: "Regular", file: "BarlowCondensed-ExtraBold.ttf" },
];
const fontParts = FONT_FILES.map((f, i) => {
  const ttf = readFileSync(join(ROOT, "assets/fonts/ttf", f.file));
  const hex = createHash("sha256").update(ttf).digest("hex").slice(0, 32).toUpperCase();
  const guid = `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}}`;
  const key = Buffer.from(hex, "hex");
  const data = Buffer.from(ttf);
  for (let j = 0; j < 32; j++) data[j] ^= key[15 - (j % 16)];
  return { ...f, guid, rId: `rIdFont${i + 1}`, name: `font${i + 1}.odttf`, data };
});
const families = [...new Set(FONT_FILES.map((f) => f.family))];
const fontTableXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${families.map((fam) =>
  `<w:font w:name="${fam}"><w:charset w:val="00"/><w:family w:val="swiss"/><w:pitch w:val="variable"/>${fontParts.filter((f) => f.family === fam).map((f) => `<w:embed${f.style} r:id="${f.rId}" w:fontKey="${f.guid}"/>`).join("")}</w:font>`).join("")}<w:font w:name="Consolas"><w:charset w:val="00"/><w:family w:val="modern"/><w:pitch w:val="fixed"/></w:font></w:fonts>`;
const fontRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${fontParts.map((f) => `<Relationship Id="${f.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/${f.name}"/>`).join("")}</Relationships>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT.text}" w:eastAsia="${FONT.text}" w:hAnsi="${FONT.text}" w:cs="${FONT.text}"/><w:color w:val="${C.navy}"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="en-GB" w:eastAsia="en-GB" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style><w:style w:type="numbering" w:default="1" w:styleId="NoList"><w:name w:val="No List"/><w:semiHidden/></w:style></w:styles>`;
const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:embedTrueTypeFonts/><w:defaultTabStop w:val="709"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;

const mediaName = (key) => `media/${key}.png`;
const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFonts" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>${[...rels].map(([key, id]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${mediaName(key)}"/>`).join("")}</Relationships>`;
const created = `${data.meta.generated || "2026-01-01"}T00:00:00Z`;
const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>FGES Airport Gates — all cards (editable)</dc:title><dc:subject>International Fair card game: ${cards.length} cards, English and French</dc:subject><dc:creator>FGES Airport Gates card game</dc:creator><dc:language>en-GB</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`;
const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>FGES Airport Gates build (scripts/build-docx.mjs)</Application></Properties>`;
const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const zip = writeZip([
  { name: "[Content_Types].xml", data: contentTypes },
  { name: "_rels/.rels", data: rootRels },
  { name: "docProps/core.xml", data: coreXml },
  { name: "docProps/app.xml", data: appXml },
  { name: "word/document.xml", data: documentXml },
  { name: "word/_rels/document.xml.rels", data: docRels },
  { name: "word/styles.xml", data: stylesXml },
  { name: "word/settings.xml", data: settingsXml },
  { name: "word/fontTable.xml", data: fontTableXml },
  { name: "word/_rels/fontTable.xml.rels", data: fontRels },
  ...fontParts.map((f) => ({ name: `word/fonts/${f.name}`, data: f.data })),
  ...[...rels.keys()].map((key) => ({ name: `word/${mediaName(key)}`, data: images.get(key) })),
]);
writeFileSync(join(ROOT, DOCX_OUT), zip);
const shrunk = [...typeset.values()].filter((t) => halfDown(t.enPt) / 2 < t.enPt - 1e-6).length;
writeOut("build/docx-report.json", JSON.stringify({ file: DOCX_OUT, bytes: zip.length, cards: cards.length, pages: pages.length + 1, images: rels.size, fonts: fontParts.map((f) => `${f.family} ${f.style}`), sizes_rounded_down: shrunk }, null, 2));
console.log(`✓ ${DOCX_OUT} — ${cards.length} cards on ${pages.length} pages (+ instructions), ${rels.size} images, ${fontParts.length} embedded fonts, ${(zip.length / 1048576).toFixed(1)} MB`);
