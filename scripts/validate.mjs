// Automated content + asset validation. Writes build/validation-report.json.
// Exits with code 1 if any ERROR is found (warnings are reported for manual review).
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, CARDS_FILE, loadProject, writeOut } from "./lib.mjs";
import { GATES, ANSWER_GATES, PER_GATE, cardTextIssues, nearDuplicates } from "../src/rules.mjs";

const { settings, data } = loadProject();
const cards = data.cards;
const errors = [], warnings = [], checks = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok, detail }); if (!ok) errors.push(`${name}${detail ? " — " + detail : ""}`); };

/* Counts ------------------------------------------------------------------ */
const qs = cards.filter((c) => c.card_type === "question");
const as = cards.filter((c) => c.card_type === "answer");
const counts = {};
for (const g of GATES) counts[g] = { questions: qs.filter((c) => c.gate === g).length, answers: as.filter((c) => c.gate === g).length };
for (const g of GATES) check(`Gate ${g}: exactly ${PER_GATE} question cards`, counts[g].questions === PER_GATE, `found ${counts[g].questions}`);
for (const g of ANSWER_GATES) check(`Gate ${g}: exactly ${PER_GATE} answer cards`, counts[g].answers === PER_GATE, `found ${counts[g].answers}`);
check("Gate E: zero answer cards", counts.E.answers === 0, `found ${counts.E.answers}`);
check("Total question cards = 100", qs.length === 100, `found ${qs.length}`);
check("Total answer cards = 80", as.length === 80, `found ${as.length}`);
check("Total physical cards = 180", cards.length === 180, `found ${cards.length}`);
check("Only valid card types", cards.every((c) => ["question", "answer"].includes(c.card_type)));
check("Only valid gates", cards.every((c) => GATES.includes(c.gate)));

/* IDs --------------------------------------------------------------------- */
for (const type of ["question", "answer"]) {
  const ids = cards.filter((c) => c.card_type === type).map((c) => c.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  check(`No duplicate ${type} IDs`, dup.length === 0, dup.join(", "));
}
for (const g of GATES) {
  const expected = Array.from({ length: PER_GATE }, (_, i) => `${g}${i + 1}`);
  const have = qs.filter((c) => c.gate === g).map((c) => c.id);
  const missing = expected.filter((id) => !have.includes(id));
  const extra = have.filter((id) => !expected.includes(id));
  check(`Gate ${g}: question IDs ${g}1–${g}${PER_GATE} complete, no gaps`, !missing.length && !extra.length, [missing.length && `missing ${missing}`, extra.length && `unexpected ${extra}`].filter(Boolean).join("; "));
  check(`Gate ${g}: every ID starts with its gate letter`, cards.filter((c) => c.gate === g).every((c) => c.id.startsWith(g)));
}

/* Pairing ----------------------------------------------------------------- */
let pairs = 0;
for (const g of ANSWER_GATES) {
  let gp = 0;
  for (const q of qs.filter((c) => c.gate === g)) {
    const a = as.filter((x) => x.id === q.id);
    if (a.length === 1 && q.pair_id === q.id && a[0].pair_id === q.id && a[0].gate === g) gp++;
    else errors.push(`Pairing broken for ${q.id}`);
  }
  check(`Gate ${g}: 20 matched question–answer pairs`, gp === PER_GATE, `matched ${gp}`);
  pairs += gp;
}
const orphanAnswers = as.filter((a) => !qs.some((q) => q.id === a.id));
check("No unmatched answer cards", orphanAnswers.length === 0, orphanAnswers.map((a) => a.id).join(", "));
check("Gate E questions have no pair_id (no answer card)", qs.filter((c) => c.gate === "E").every((c) => c.pair_id == null));
check("Gate E: no model answers stored on question records", qs.filter((c) => c.gate === "E").every((c) => !("answer_en" in c) && !("answer_fr" in c)));

/* Text quality (rules shared with the web editor: src/rules.mjs) ----------- */
const issues = cards.flatMap((c) => {
  const question = c.card_type === "answer" ? qs.find((q) => q.id === c.id) : undefined;
  return cardTextIssues(c, { question }).map((i) => ({ ...i, card: `${c.id}/${c.card_type}` }));
});
const issueCards = (...codes) => [...new Set(issues.filter((i) => i.level === "error" && codes.includes(i.code)).map((i) => i.card))];
check("Every card has English AND French text", issueCards("required").length === 0, issueCards("required").join(", "));
check("French text is not a copy of the English", issueCards("same-text").length === 0, issueCards("same-text").join(", "));
check("No URLs or citations on card faces", issueCards("url").length === 0, issueCards("url").join(", "));
check("Multiple-choice options match in EN/FR and answers start with the same correct letter", issueCards("mc-options", "mc-letter").length === 0,
  issues.filter((i) => i.code.startsWith("mc-")).map((i) => `${i.card}: ${i.message}`).join("; "));
const unhandled = issues.filter((i) => i.level === "error" && !["required", "same-text", "url", "mc-options", "mc-letter"].includes(i.code));
check("No other text errors", unhandled.length === 0, unhandled.map((i) => `${i.card}: ${i.message}`).join("; "));
for (const i of issues.filter((x) => x.level === "warning")) warnings.push(`${i.card} ${i.field === "text_fr" ? "FR" : "EN"}: ${i.message}`);

/* Near-duplicates within a gate (token Jaccard on English questions) ------ */
const nearDup = nearDuplicates(cards).map((d) => `${d.a} ~ ${d.b} (${d.score.toFixed(2)})`);
check("No duplicate or near-duplicate questions within a gate", nearDup.length === 0, nearDup.join("; "));
const exactAcross = qs.filter((q, i) => qs.findIndex((x) => x.text_en === q.text_en) !== i).map((q) => q.id);
check("No identical questions across gates", exactAcross.length === 0, exactAcross.join(", "));

/* Gate theme sanity -------------------------------------------------------- */
const themeTopics = {
  A: ["Food", "Language", "Traditions"],
  B: ["City landmark", "City geography", "City history", "City transport", "City culture", "University history", "Student life", "Everyday life", "Student exchange"],
  D: ["Games", "Culture shock", "Culture"],
};
for (const [g, allowed] of Object.entries(themeTopics)) {
  const off = qs.filter((c) => c.gate === g && !allowed.includes(c.topic)).map((c) => `${c.id}:${c.topic}`);
  check(`Gate ${g}: every question topic matches the gate theme`, off.length === 0, off.join(", "));
}
const dGames = qs.filter((c) => c.gate === "D" && c.topic === "Games").length;
const dShock = qs.filter((c) => c.gate === "D" && c.topic !== "Games").length;
check("Gate D mixes games and culture-shock questions", dGames >= 6 && dShock >= 6, `${dGames} games / ${dShock} culture`);

/* Sources ------------------------------------------------------------------ */
const factual = cards.filter((c) => c.gate !== "E");
const webNoUrl = factual.filter((c) => c.verification_status === "web-checked" && !(c.source_urls || []).length).map((c) => c.id);
check("Every web-checked fact records at least one source URL", webNoUrl.length === 0, webNoUrl.join(", "));
check("Every factual card has a verification status and note", factual.every((c) => ["web-checked", "general-knowledge"].includes(c.verification_status) && c.verification_note));
const badUrl = factual.flatMap((c) => (c.source_urls || []).filter((u) => !/^https:\/\/[^\s]+$/.test(u)).map((u) => `${c.id}: ${u}`));
check("Source URLs are well-formed https links", badUrl.length === 0, badUrl.join("; "));
const verification = {
  web_checked_pairs: qs.filter((c) => c.gate !== "E" && c.verification_status === "web-checked").length,
  general_knowledge_pairs: qs.filter((c) => c.gate !== "E" && c.verification_status === "general-knowledge").length,
};

/* Assets: exactly five backs, one per gate --------------------------------- */
const backDir = join(ROOT, "assets", "backs");
const backFiles = readdirSync(backDir).filter((f) => f.endsWith(".svg"));
const expectedBacks = ["back_gate_A_food_language_traditions.svg", "back_gate_B_campus_city.svg", "back_gate_C_random_knowledge.svg", "back_gate_D_games_culture_shock.svg", "back_gate_E_student_advice.svg"];
check("Exactly five back SVGs exist", backFiles.length === 5, backFiles.join(", "));
check("Back filenames match the required names", expectedBacks.every((f) => backFiles.includes(f)));
for (const g of data.gates) {
  const p = join(ROOT, g.back_file);
  const ok = existsSync(p) && readFileSync(p, "utf8").includes(`Gate ${g.gate}`) && readFileSync(p, "utf8").includes(`>${g.gate}</text>`);
  check(`Back for Gate ${g.gate} is labelled with its own gate letter`, ok, g.back_file);
  if (existsSync(p)) {
    const svg = readFileSync(p, "utf8");
    const snippet = (t) => (t || "").trim().slice(0, 24);
    const leaked = cards.filter((x) => [snippet(x.text_en), snippet(x.text_fr)].some((s) => s.length >= 10 && svg.includes(s))).map((x) => x.id);
    check(`Back for Gate ${g.gate} carries no question/answer text`, leaked.length === 0, leaked.join(", "));
  }
}

/* Palette ------------------------------------------------------------------ */
const APPROVED = new Set(["#0B2545", "#0B6F79", "#1FB5BE", "#FFC93C", "#FFFFFF", "#6D071A", "#D9F2F4", "#FFF6DB"]);
const paletteFiles = ["design/tokens.css", "src/cards.css", "src/cards-ink-saver.css", ...expectedBacks.map((f) => `assets/backs/${f}`)];
const offPalette = [];
for (const f of paletteFiles) {
  const txt = readFileSync(join(ROOT, f), "utf8");
  for (const m of txt.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) if (!APPROVED.has(m[0].toUpperCase())) offPalette.push(`${f}: ${m[0]}`);
  if (/\b(rgb|hsl)a?\(/.test(txt.replace(/rgba\(11,\s*37,\s*69/g, ""))) offPalette.push(`${f}: functional colour notation`);
}
check("Artwork uses only the approved palette (navy, teal, turquoise, yellow, white, Bordeaux + tints)", offPalette.length === 0, offPalette.join("; "));

/* Print settings sanity ------------------------------------------------------ */
const c = settings.card, hp = settings.home_print, ps = settings.print_shop;
check("Card trim/bleed/safe values are positive", c.trim_width_mm > 0 && c.trim_height_mm > 0 && c.bleed_mm >= 0 && c.safe_margin_mm >= 3);
check("Duplex flip is long-edge or short-edge", ["long-edge", "short-edge"].includes(hp.duplex_flip), hp.duplex_flip);
check("Print-shop crop marks sit outside the bleed", ps.crop_mark_offset_mm >= c.bleed_mm, `offset ${ps.crop_mark_offset_mm} mm vs bleed ${c.bleed_mm} mm`);
check("Print-shop slug fits the crop marks", ps.slug_mm >= ps.crop_mark_offset_mm - c.bleed_mm + ps.crop_mark_length_mm, `slug ${ps.slug_mm} mm`);
check("Print-shop page order is a known option", ["front-back-interleaved", "fronts-then-backs"].includes(ps.page_order), ps.page_order);
check("Safe margin keeps text inside the trim", c.safe_margin_mm * 2 < c.trim_width_mm / 2, `${c.safe_margin_mm} mm`);
check("Gate list matches A–E with a back file each", data.gates.map((g) => g.gate).join("") === GATES.join("") && data.gates.every((g) => g.back_file && g.name_en && g.name_fr && g.short_en && g.short_fr));

const report = {
  generated: new Date().toISOString(),
  data_file: CARDS_FILE,
  ok: errors.length === 0,
  counts: { per_gate: counts, questions: qs.length, answers: as.length, physical_cards: cards.length, matched_pairs: pairs },
  verification,
  checks,
  errors,
  warnings,
};
writeOut("build/validation-report.json", JSON.stringify(report, null, 2));
const passed = checks.filter((x) => x.ok).length;
console.log(`Validation: ${passed}/${checks.length} checks passed, ${errors.length} error(s), ${warnings.length} warning(s).`);
for (const e of errors) console.log("  ✗", e);
for (const w of warnings) console.log("  ⚠", w);
if (errors.length) process.exit(1);
