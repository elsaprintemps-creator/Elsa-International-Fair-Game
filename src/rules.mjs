// Content rules for card text, shared by scripts/validate.mjs (build gate) and the web editor (live checks),
// so colleagues see the same errors in the browser that the build would report.
// Pure functions only: this file is also bundled for the browser by scripts/build-web.mjs.

export const GATES = ["A", "B", "C", "D", "E"];
export const ANSWER_GATES = ["A", "B", "C", "D"];
export const PER_GATE = 20;
/** Characters per language above which a readability warning is raised (text also shrinks to fit). */
export const LENGTH_LIMITS = { question: 200, answer: 110 };

/** Letters of the multiple-choice options in a question ("… A) x B) y C) z" → "ABC"). */
export function mcOptions(s) {
  return (String(s || "").match(/(?:^|\s)([A-C])\)\s/g) || []).map((x) => x.trim()[0]).join("");
}

/** Letter an answer starts with ("B) One per month…" → "B"), or "". */
export function answerLetter(s) {
  const m = String(s || "").trim().match(/^([A-C])\)/);
  return m ? m[1] : "";
}

const GENERALISING = /\b(always|everyone in|all (?:the )?[A-Z][a-z]+(?:s|ese|ish)\b|typical [A-Z]|[A-Z][a-z]+ people (?:are|always|never))/;

/**
 * Issues for one card's text. Returns [{ level: "error"|"warning", code, field, message }].
 * `field` is "text_en", "text_fr" or null (whole card).
 * For an answer card pass its question as `question` so multiple-choice letters can be checked.
 */
export function cardTextIssues(card, { question } = {}) {
  const out = [];
  const add = (level, code, field, message) => out.push({ level, code, field, message });
  const en = String(card.text_en || ""), fr = String(card.text_fr || "");
  const isQ = card.card_type === "question";

  if (!en.trim()) add("error", "required", "text_en", "English text is required.");
  if (!fr.trim()) add("error", "required", "text_fr", "French text is required.");
  if (en.trim() && en.trim() === fr.trim() && en.length > 12) add("error", "same-text", "text_fr", "The French text is identical to the English text — please translate it.");
  if (/https?:\/\/|www\./i.test(en)) add("error", "url", "text_en", "Remove the web link: sources belong in the internal notes, never on the card.");
  if (/https?:\/\/|www\./i.test(fr)) add("error", "url", "text_fr", "Remove the web link: sources belong in the internal notes, never on the card.");

  if (isQ && card.gate !== "E") {
    const oe = mcOptions(en), of = mcOptions(fr);
    if (oe !== of) add("error", "mc-options", "text_fr", `Multiple-choice options differ: English has ${oe ? oe.split("").join(") ") + ")" : "none"}, French has ${of ? of.split("").join(") ") + ")" : "none"}.`);
  }
  if (!isQ && question) {
    const opts = mcOptions(question.text_en);
    if (opts) {
      const le = answerLetter(en), lf = answerLetter(fr);
      if (!le) add("error", "mc-letter", "text_en", `The question is multiple choice (${opts.split("").join(") ")})): start the English answer with the correct letter, e.g. "${opts[0]}) …".`);
      else if (!opts.includes(le)) add("error", "mc-letter", "text_en", `The English answer starts with ${le}) but the question has no option ${le}).`);
      if (!lf) add("error", "mc-letter", "text_fr", `Start the French answer with the same letter as the English one${le ? ` (${le}))` : ""}.`);
      else if (le && lf !== le) add("error", "mc-letter", "text_fr", `The French answer starts with ${lf}) but the English answer starts with ${le}).`);
    }
  }

  const lim = isQ ? LENGTH_LIMITS.question : LENGTH_LIMITS.answer;
  if (en.length > lim) add("warning", "long", "text_en", `English text is long (${en.length} characters; aim for under ${lim}). Check that it is still readable.`);
  if (fr.length > lim) add("warning", "long", "text_fr", `French text is long (${fr.length} characters; aim for under ${lim}). Check that it is still readable.`);
  if (isQ && card.gate !== "E" && en.trim() && !en.includes("?")) add("warning", "no-question-mark", "text_en", "The English question has no question mark.");
  if (/\s[?!:;]/.test(en)) add("warning", "en-space-punct", "text_en", "English text has a space before ? ! : or ; (not used in English).");
  if (/[^\s\u00A0«][?!:;](\s|$)/.test(fr.replace(/https?:\S+/g, "")) && !/\d:\d/.test(fr)) add("warning", "fr-space-punct", "text_fr", "French typography: put a space before ? ! : and ; (the card adds a non-breaking space automatically if one is there).");
  if (isQ && card.gate === "E" && en.trim() && !/\?|^(Tell|Raconte|Describe)/.test(en)) add("warning", "not-open-ended", "text_en", "Gate E prompts should be open questions (e.g. \"What helped you…?\").");
  const gen = en.match(GENERALISING);
  if (gen) add("warning", "generalising", "text_en", `Generalising wording to review: "${gen[0]}". Prefer "many people", "often", "traditionally".`);
  return out;
}

const STOP = new Set("the a an of in to and or is are what which who how why do does did you your for on at with from by its it this that be as was were has have can".split(" "));
const tokens = (s) => new Set(String(s).toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

/** Near-duplicate English questions within each gate (token Jaccard ≥ 0.45). Returns [{ a, b, score }]. */
export function nearDuplicates(cards) {
  const out = [];
  for (const g of GATES) {
    const list = cards.filter((c) => c.card_type === "question" && c.gate === g);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = tokens(list[i].text_en), B = tokens(list[j].text_en);
      const inter = [...A].filter((w) => B.has(w)).length;
      const jac = inter / (A.size + B.size - inter || 1);
      if (jac >= 0.45) out.push({ a: list[i].id, b: list[j].id, score: +jac.toFixed(2) });
    }
  }
  return out;
}
