// Reads the question/answer text back out of the editable Word file (exports/cards_editable.docx).
// Every card text sits in a content control tagged "<id>|<card_type>|<en|fr>", e.g. "A10|question|en".
// Shared by scripts/check-docx.mjs (build check) and scripts/import-word.mjs (colleagues' edits).
import { readZip } from "./zip.mjs";

export const tagOf = (card, lang) => `${card.id}|${card.card_type}|${lang}`;

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&");

/** Plain text of a run of WordprocessingML: text, tabs/breaks as spaces, non-breaking hyphens as "-".
 *  Tracked changes count as accepted (deleted and moved-away text is skipped). */
function plainText(xml) {
  xml = xml.replace(/<w:(del|moveFrom)\b[^>]*>[\s\S]*?<\/w:\1>/g, "");
  let out = "";
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(tab|br|cr|noBreakHyphen)\b[^>]*\/>|<\/w:p>/g)) {
    if (m[1] !== undefined) out += decode(m[1]);
    else if (m[2] === "noBreakHyphen") out += "-";
    else out += " ";
  }
  return out;
}

/** Card text as stored in data/cards.json: one line, plain spaces and straight quotes
 *  (the cards add typographic quotes and French non-breaking spaces when they are drawn). */
export function normalizeText(s) {
  return String(s)
    .normalize("NFC")   // "o" + combining macron (as written in the Word file) → "ō"
    .replace(/[\u00A0\u202F\u2007\u2009]/g, " ")
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u00AD\u200B]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** docx Buffer → { texts: Map(tag → normalised text), duplicates: [tag], document: string }. */
export function readCardTexts(docxBuffer) {
  const files = readZip(docxBuffer);
  const doc = files.get("word/document.xml");
  if (!doc) throw new Error("word/document.xml is missing: this is not a Word document");
  const xml = doc.toString("utf8");
  const texts = new Map(), duplicates = [];
  // Walk <w:sdt> blocks with their nesting depth. Text of a control nested inside another one belongs to the inner
  // control only. Word can also widen a control that starts a table cell to the whole table row (it then wraps a
  // <w:tbl>); only the first cell of such a control holds its text.
  const re = /<w:sdt>|<w:sdt\s[^>]*>|<\/w:sdt>/g;
  const stack = [], closed = [];
  for (let m; (m = re.exec(xml));) {
    if (m[0] !== "</w:sdt>") { stack.push(m.index); continue; }
    const start = stack.pop();
    if (start === undefined) continue;
    const end = m.index + m[0].length;
    const inner = closed.filter(([s, e]) => s > start && e <= end);
    closed.push([start, end]);
    let block = "", at = start;
    for (const [s, e] of inner.sort((a, b) => a[0] - b[0])) { if (s >= at) { block += xml.slice(at, s); at = e; } }
    block += xml.slice(at, m.index);
    const tag = (block.match(/<w:sdtPr>[\s\S]*?<w:tag w:val="([^"]*)"/) || [])[1];
    if (!tag || !/^[A-E]\d+\|(question|answer)\|(en|fr)$/.test(tag)) continue;
    let content = (block.match(/<w:sdtContent>([\s\S]*)$/) || [])[1] || "";
    if (/<w:tc>/.test(content)) content = (content.match(/<w:tc>([\s\S]*?)<\/w:tc>/) || [])[1] || "";
    if (texts.has(tag)) duplicates.push(tag);
    texts.set(tag, normalizeText(plainText(content)));
  }
  return { texts, duplicates, document: xml, files };
}
