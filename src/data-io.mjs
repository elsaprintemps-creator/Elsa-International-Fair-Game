// Card data serialisation shared by the Node build (data/cards.csv) and the web editor's exports,
// so a file exported from the editor is byte-for-byte what the build would write.
// Pure functions only: this file is also bundled for the browser by scripts/build-web.mjs.

/** Serialise card data exactly like data/cards.json (2-space JSON + final newline), so diffs stay minimal. */
export function formatCardsJSON(data) {
  return JSON.stringify(data, null, 2) + "\n";
}

export const CSV_COLUMNS = ["id", "card_type", "gate", "gate_name_en", "gate_name_fr", "topic", "destination", "text_en", "text_fr", "pair_id", "has_matching_answer_card", "open_ended", "verification_status", "source_urls", "verification_note", "last_checked"];

export function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Flat CSV of every card. UTF-8 BOM + CRLF so Excel opens accents correctly. */
export function cardsToCsv(data) {
  const cards = data.cards;
  const gateMap = Object.fromEntries(data.gates.map((g) => [g.gate, g]));
  const rows = cards.map((c) => {
    const g = gateMap[c.gate];
    const hasAnswer = c.card_type === "question" && cards.some((x) => x.card_type === "answer" && x.id === c.id);
    return [c.id, c.card_type, c.gate, g.name_en, g.name_fr, c.topic, c.destination, c.text_en, c.text_fr, c.pair_id ?? "", c.card_type === "question" ? (hasAnswer ? "yes" : "no") : "", c.open_ended ? "yes" : "no", c.verification_status, (c.source_urls || []).join(" | "), c.verification_note, c.last_checked].map(csvCell).join(",");
  });
  return "﻿" + [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}
