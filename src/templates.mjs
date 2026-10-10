// HTML renderers shared by the preview gallery and both print layouts,
// so every output shows exactly the same card artwork.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { plane, arrow, badgeIcon, barcode, flag } from "./icons.mjs";

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function cardGeometry(settings) {
  const c = settings.card;
  return {
    trimW: c.trim_width_mm,
    trimH: c.trim_height_mm,
    bleed: c.bleed_mm,
    safe: c.safe_margin_mm,
    cardW: c.trim_width_mm + 2 * c.bleed_mm,
    cardH: c.trim_height_mm + 2 * c.bleed_mm,
    radius: c.preview_corner_radius_mm,
  };
}

/** CSS custom properties derived from config/print-settings.json. */
export function cssVars(settings) {
  const g = cardGeometry(settings);
  const t = settings.text_fit;
  return `:root {
  --trim-w: ${g.trimW}mm; --trim-h: ${g.trimH}mm; --bleed: ${g.bleed}mm; --safe: ${g.safe}mm;
  --card-w: ${g.cardW}mm; --card-h: ${g.cardH}mm; --preview-radius: ${g.radius}mm;
  --q-en-pt: ${t.question_en_pt}pt; --q-fr-pt: ${t.question_fr_pt}pt;
  --a-en-pt: ${t.answer_en_pt}pt; --a-fr-pt: ${t.answer_fr_pt}pt;
  --d-en-pt: ${t.discussion_en_pt}pt; --d-fr-pt: ${t.discussion_fr_pt}pt;
}`;
}

/** Read the five back SVGs (editable sources in assets/backs/) for inlining. */
export function loadBacks(root, gates) {
  const out = {};
  for (const g of gates) {
    out[g.gate] = readFileSync(join(root, g.back_file), "utf8")
      .replace(/<\?xml[^>]*\?>\s*/, "")
      .replace(/<!--[\s\S]*?-->\s*/g, "");
  }
  return out;
}

/** Escape text and keep short hyphenated words ("Qu'as-tu", "vingt-deux") from breaking at the hyphen. */
function cardText(s, lang = "en") {
  // Typographic quotes/apostrophes for print (data stays plain ASCII-friendly).
  let curly = String(s)
    .replace(/(^|[\s(—–-])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/'/g, "’");
  // French typography: non-breaking spaces inside « » and before ? ! : ; so they never start a line.
  if (lang === "fr") curly = curly.replace(/«\s+/g, "« ").replace(/\s+»/g, " »").replace(/\s+([?!:;])/g, " $1");
  return esc(curly).replace(/[\p{L}'’]+(?:-[\p{L}'’]+)+/gu, (w) => (w.length <= 16 ? `<span class="nw">${w}</span>` : w));
}

/** Question text, with multiple-choice options ("… A) x B) y C) z") set one per line so a letter never ends a line. */
function questionText(s, lang, isQuestion) {
  const [stem, ...opts] = isQuestion ? String(s).split(/\s+(?=[A-C]\)\s)/) : [s];
  if (!opts.length) return cardText(s, lang);
  return `${cardText(stem, lang)}<span class="opts">${opts.map((o) => `<span class="opt">${cardText(o, lang)}</span>`).join("")}</span>`;
}

function typeOf(card) {
  if (card.card_type === "answer") return "answer";
  return card.gate === "E" ? "discussion" : "question";
}

const LABELS = {
  question: { type: "QUESTION", ftrEn: (id) => `Answer → card ${id}`, ftrFr: (id) => `Réponse → carte ${id}` },
  answer: { type: "ANSWER · RÉPONSE", ftrEn: (id) => `Question → card ${id}`, ftrFr: (id) => `Question → carte ${id}` },
  discussion: { type: "DISCUSSION", ftrEn: () => "No right answer · share yours", ftrFr: () => "Pas de bonne réponse : raconte !" },
};

/** Escaped label with every "→" drawn as a vector arrow. */
const label = (s) => esc(s).replace(/\s*→\s*/g, ` ${arrow()} `);

export function renderFront(card, gate) {
  const kind = typeOf(card);
  const L = LABELS[kind];
  return `<article class="card front gate-${card.gate} type-${kind}" data-id="${esc(card.id)}" data-type="${card.card_type}">
  <header class="hdr"><div class="hdr-inner">
    <div class="badge">${badgeIcon[card.gate]()}</div>
    <div class="hdr-text"><div class="hdr-gate">GATE ${card.gate}</div><div class="hdr-type" data-fit-check>${L.type}</div></div>
    <div class="chip-wrap"><div class="chip-label">CARD · CARTE</div><div class="chip">${esc(card.id)}</div></div>
  </div></header>
  <div class="cat"><div class="cat-en" data-fit-check>${esc(gate.short_en)}</div><div class="cat-fr" data-fit-check>${esc(gate.short_fr)}</div></div>
  <section class="body" data-autofit>
    <p class="en" lang="en"><span class="flag" role="img" aria-label="English">${flag.en()}</span>${questionText(card.text_en, "en", card.card_type === "question")}</p>
    <div class="divider">${plane()}</div>
    <p class="fr" lang="fr"><span class="flag" role="img" aria-label="Français">${flag.fr()}</span>${questionText(card.text_fr, "fr", card.card_type === "question")}</p>
  </section>
  <footer class="ftr">
    <div class="perf"></div>
    <div class="ftr-row">
      <div class="ftr-label" data-fit-check><span class="ftr-en">${label(L.ftrEn(card.id))}</span><span class="ftr-fr">${label(L.ftrFr(card.id))}</span></div>
      <div class="ftr-code">${barcode(card.id + card.card_type)}<span>INTL FAIR · ${esc(card.id)}</span></div>
    </div>
  </footer>
  <div class="strip"></div>
</article>`;
}

export function renderBack(gateLetter, backs) {
  return `<article class="card back gate-${gateLetter}" data-back="${gateLetter}">${backs[gateLetter]}</article>`;
}

/** Common <head>. `rel` is the relative path from the HTML file to the project root. */
export function head({ title, rel, settings, extraCss = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${rel}design/fonts.css">
<link rel="stylesheet" href="${rel}design/tokens.css">
<link rel="stylesheet" href="${rel}src/cards.css">
<style>
${cssVars(settings)}
${extraCss}
</style>
<script>window.__FIT__ = ${JSON.stringify(settings.text_fit)};</script>
<script src="${rel}src/autofit.js" defer></script>
</head>`;
}
