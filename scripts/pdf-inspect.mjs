// Inspection helpers for finished PDF files, using two independent parsers:
//   pdf-lib   — object-level structure: boxes, fonts and their embedded font programs, image XObjects
//   pdf.js    — content-level: text with positions, operator lists (images and their placed size)
import { PDFDocument, PDFName, PDFDict, PDFRawStream, PDFArray, PDFRef } from "pdf-lib";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { MM_TO_PT } from "./lib.mjs";

export const ptToMm = (pt) => pt / MM_TO_PT;
const r2 = (n) => +n.toFixed(2);

/** File-level and object-level structure. */
export async function inspectStructure(file) {
  const bytes = readFileSync(file);
  const head = bytes.subarray(0, 8).toString("latin1");
  const tail = bytes.subarray(Math.max(0, bytes.length - 64)).toString("latin1");
  const out = { file, bytes: bytes.length, header: head.trim(), has_eof: /%%EOF\s*$/.test(tail), parse_error: null };
  let pdf;
  try { pdf = await PDFDocument.load(bytes, { throwOnInvalidObject: true, updateMetadata: false }); }
  catch (e) { out.parse_error = e.message; return out; }
  const pages = pdf.getPages();
  out.pages = pages.length;
  out.title = pdf.getTitle() || null;
  const box = (p, name) => {
    const raw = p.node.get(PDFName.of(name));
    if (!raw) return null;
    const b = name === "TrimBox" ? p.getTrimBox() : name === "BleedBox" ? p.getBleedBox() : p.getMediaBox();
    return { x: r2(ptToMm(b.x)), y: r2(ptToMm(b.y)), w: r2(ptToMm(b.width)), h: r2(ptToMm(b.height)) };
  };
  out.page_boxes = pages.map((p) => ({ media: box(p, "MediaBox"), trim: box(p, "TrimBox"), bleed: box(p, "BleedBox") }));
  out.has_outline = !!pdf.catalog.get(PDFName.of("Outlines"));
  out.fonts = fontsOf(pdf);
  out.image_xobjects = imageXObjectsOf(pdf);
  return out;
}

const lookup = (ctx, v) => (v instanceof PDFRef ? ctx.lookup(v) : v);
const dictOf = (o) => (o instanceof PDFDict ? o : o instanceof PDFRawStream ? o.dict : null);

/** Every font dictionary: base name, subtype, whether its font program is embedded, whether it is a subset. */
function fontsOf(pdf) {
  const ctx = pdf.context;
  const fonts = [];
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    const d = dictOf(obj);
    if (!d || d.get(PDFName.of("Type"))?.toString() !== "/Font") continue;
    const sub = d.get(PDFName.of("Subtype"))?.toString();
    if (sub === "/CIDFontType0" || sub === "/CIDFontType2") continue; // descendants are inspected via their Type0 parent
    const base = (d.get(PDFName.of("BaseFont"))?.toString() || "").replace(/^\//, "");
    let descriptor = null;
    if (sub === "/Type0") {
      const desc = lookup(ctx, d.get(PDFName.of("DescendantFonts")));
      const first = desc instanceof PDFArray ? lookup(ctx, desc.get(0)) : null;
      descriptor = first ? lookup(ctx, first.get(PDFName.of("FontDescriptor"))) : null;
    } else descriptor = lookup(ctx, d.get(PDFName.of("FontDescriptor")));
    const fileKey = descriptor ? ["FontFile", "FontFile2", "FontFile3"].find((k) => descriptor.has(PDFName.of(k))) : null;
    fonts.push({
      name: base.replace(/^[A-Z]{6}\+/, ""),
      base,
      subtype: sub?.replace("/", ""),
      embedded: sub === "/Type3" ? true : !!fileKey,
      program: sub === "/Type3" ? "Type3 glyph procedures" : fileKey,
      subset: /^[A-Z]{6}\+/.test(base),
    });
  }
  return fonts;
}

/** Image XObjects (pixel size only; placed size comes from the operator lists). */
function imageXObjectsOf(pdf) {
  const out = [];
  for (const [ref, obj] of pdf.context.enumerateIndirectObjects()) {
    const d = dictOf(obj);
    if (d && d.get(PDFName.of("Subtype"))?.toString() === "/Image") {
      out.push({ ref: ref.toString(), width: Number(d.get(PDFName.of("Width"))?.toString()), height: Number(d.get(PDFName.of("Height"))?.toString()), soft_mask: !!d.get(PDFName.of("SMask")) });
    }
  }
  return out;
}

/** Open with pdf.js, collecting its parser warnings (a second, independent validity check). */
export async function openPdfJs(file) {
  const warnings = [];
  const orig = console.log;
  console.log = (...a) => { const s = a.join(" "); if (/^Warning:/.test(s)) warnings.push(s); else orig(...a); };
  try {
    const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 1, disableFontFace: true, useSystemFonts: false, isEvalSupported: false }).promise;
    return { doc, warnings, restore: () => { console.log = orig; } };
  } catch (e) {
    console.log = orig;
    throw e;
  }
}

/** Text items of one page in mm, top-left origin: { str, x, y (baseline), w, cx }. */
export async function pageText(doc, n) {
  const page = await doc.getPage(n);
  const H = page.view[3] - page.view[1];
  const tc = await page.getTextContent();
  const items = tc.items.filter((i) => i.str && i.str.trim()).map((i) => {
    const x = ptToMm(i.transform[4]), w = ptToMm(i.width);
    return { str: i.str, x, y: ptToMm(H - i.transform[5]), w, cx: x + w / 2 };
  });
  return { items, joined: items.map((i) => i.str).join("").replace(/\s+/g, "") };
}

/** Raster images painted on a page, with their effective resolution at the placed size. */
export async function pageImages(doc, n) {
  const page = await doc.getPage(n);
  const ops = await page.getOperatorList();
  const mul = (m, t) => [m[0] * t[0] + m[2] * t[1], m[1] * t[0] + m[3] * t[1], m[0] * t[2] + m[2] * t[3], m[1] * t[2] + m[3] * t[3], m[0] * t[4] + m[2] * t[5] + m[4], m[1] * t[4] + m[3] * t[5] + m[5]];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const found = [];
  const IMG = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObject, OPS.paintInlineImageXObjectGroup, OPS.paintImageMaskXObjectGroup]);
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (Array.isArray(args[0]) || ArrayBuffer.isView(args[0])) ctm = mul(ctm, Array.from(args[0])); }
    else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (IMG.has(fn)) {
      const a0 = args && args[0];
      const w = typeof args?.[1] === "number" ? args[1] : a0 && a0.width;
      const h = typeof args?.[2] === "number" ? args[2] : a0 && a0.height;
      const wPt = Math.hypot(ctm[0], ctm[1]), hPt = Math.hypot(ctm[2], ctm[3]);
      found.push({ page: n, px: [w, h], placed_mm: [r2(ptToMm(wPt)), r2(ptToMm(hPt))], ppi: [r2(w / (wPt / 72)), r2(h / (hPt / 72))] });
    }
  }
  return found;
}
