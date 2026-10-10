// Card editor: review and edit the EN/FR text of every card, with live checks and a live card preview.
// - Master data: window.CARDS_DATA (a build-time copy of data/cards.json).
// - Rules, rendering and export formats: window.CardKit (the same code the build and PDFs use).
// - Edits are kept as a list of changed text fields and saved in this browser (localStorage) as a draft.
//   Nothing is ever written to the project files: Export JSON produces a file that replaces data/cards.json.
(function () {
  "use strict";
  const kit = window.CardKit;
  const master = window.CARDS_DATA;
  const info = window.CARDS_DATA_INFO || {};
  if (!kit || !master) {
    document.getElementById("status").textContent = "The card data could not be loaded. Run `npm run build` to regenerate editor/generated/.";
    return;
  }

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = kit.esc;
  const R = kit.rules;
  const FIELDS = ["text_en", "text_fr"];
  const STORE_KEY = "airport-gates-card-editor/v1";
  const PX_PER_MM = 96 / 25.4;
  const gates = kit.gates;
  const gateMap = Object.fromEntries(gates.map((g) => [g.gate, g]));
  const ck = (id, type) => `${id}|${type}`;
  const fk = (id, type, field) => `${id}|${type}|${field}`;
  const masterCard = new Map(master.cards.map((c) => [ck(c.id, c.card_type), c]));
  const questions = master.cards.filter((c) => c.card_type === "question");
  const hasAnswer = (id) => masterCard.has(ck(id, "answer"));

  /* ------------------------------------------------------------ state */
  const edits = new Map();      // field key → { value, base }  (base = master text when the edit was made)
  const conflicts = new Set();  // field keys whose master text changed since the draft was saved
  const fit = new Map();        // card key → autofit result
  let dupes = new Map();        // question id → [ids of near-duplicate questions in the same gate]
  let exportedSinceChange = true;
  let savedAt = null;
  let storageOK = true;
  let activeId = null;
  const ui = { gate: "all", search: "", show: "all" };

  const value = (id, type, field) => {
    const e = edits.get(fk(id, type, field));
    return e ? e.value : masterCard.get(ck(id, type))[field];
  };
  const current = (id, type) => {
    const c = masterCard.get(ck(id, type));
    return c ? Object.assign({}, c, { text_en: value(id, type, "text_en"), text_fr: value(id, type, "text_fr") }) : null;
  };
  /** Text as it will be exported: line breaks become spaces, outer whitespace trimmed. */
  const clean = (s) => String(s).replace(/\s*[\r\n]+\s*/g, " ").trim();
  const isEdited = (id) => [...edits.keys()].some((k) => k.startsWith(id + "|"));

  function setEdit(id, type, field, raw) {
    bump();
    const k = fk(id, type, field);
    const base = masterCard.get(ck(id, type))[field];
    if (clean(raw) === base) { edits.delete(k); conflicts.delete(k); }
    else edits.set(k, { value: raw, base: (edits.get(k) || {}).base ?? base });
  }

  /** The full document as it will be exported: master data with the edited text fields. */
  function currentDoc() {
    return Object.assign({}, master, {
      cards: master.cards.map((c) => {
        const out = Object.assign({}, c);
        for (const f of FIELDS) { const e = edits.get(fk(c.id, c.card_type, f)); if (e) out[f] = clean(e.value); }
        return out;
      }),
    });
  }

  /* ------------------------------------------------------------ storage (browser draft) */
  function testStorage() {
    try { localStorage.setItem(STORE_KEY + "/t", "1"); localStorage.removeItem(STORE_KEY + "/t"); return true; } catch (e) { return false; }
  }
  function saveDraft() {
    if (!storageOK) return;
    try {
      if (!edits.size) localStorage.removeItem(STORE_KEY);
      else localStorage.setItem(STORE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), masterSha: info.sha256 || null, exported: exportedSinceChange, edits: [...edits] }));
      savedAt = new Date();
    } catch (e) {
      storageOK = false;
      notice("error", "This browser refused to store your edits (storage full or disabled). Export JSON now so you don't lose your work.");
    }
    renderStatus();
  }
  let saveTimer;
  const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 400); };

  function loadDraft() {
    let draft;
    try { draft = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { draft = null; }
    if (!draft || !Array.isArray(draft.edits)) return;
    let restored = 0, changedMaster = 0;
    for (const [k, e] of draft.edits) {
      const [id, type, field] = k.split("|");
      const m = masterCard.get(ck(id, type));
      if (!m || !FIELDS.includes(field) || typeof e.value !== "string") continue;
      if (clean(e.value) === m[field]) continue;
      edits.set(k, { value: e.value, base: e.base });
      restored++;
      if (e.base !== m[field]) { conflicts.add(k); changedMaster++; }
    }
    exportedSinceChange = !!draft.exported;
    savedAt = draft.savedAt ? new Date(draft.savedAt) : null;
    if (restored) {
      const cardsN = new Set([...edits.keys()].map((k) => k.split("|")[0])).size;
      notice(changedMaster ? "warn" : "ok", `Restored your edits to ${cardsN} card${cardsN === 1 ? "" : "s"}, saved in this browser${savedAt ? " on " + savedAt.toLocaleString() : ""}.` +
        (changedMaster ? ` ${changedMaster} edited text${changedMaster === 1 ? " was" : "s were"} also changed in the master data since then. Check the cards marked “master changed”.` : ""));
    }
  }

  /* ------------------------------------------------------------ notices + status */
  function notice(kind, html) {
    const n = $("#notice");
    n.innerHTML = `<div class="${kind === "error" ? "error" : kind === "ok" ? "ok" : "warn"}"><span>${html}</span><button type="button">Dismiss</button></div>`;
    n.hidden = false;
    $("button", n).addEventListener("click", () => { n.hidden = true; });
  }

  function totals() {
    let errors = 0, warnings = 0, problemCards = 0;
    for (const q of questions) {
      const iss = issuesFor(q.id);
      const e = iss.filter((i) => i.level === "error").length, w = iss.filter((i) => i.level === "warning").length;
      errors += e; warnings += w; if (e || w) problemCards++;
    }
    return { errors, warnings, problemCards, editedCards: new Set([...edits.keys()].map((k) => k.split("|")[0])).size };
  }

  function renderStatus() {
    const t = totals();
    const fitPending = fit.size < master.cards.length;
    const parts = [
      `<span class="st"><b>${t.editedCards}</b> card${t.editedCards === 1 ? "" : "s"} edited</span>`,
      `<span class="st${t.errors ? " bad" : ""}"><b>${t.errors}</b> error${t.errors === 1 ? "" : "s"}</span>`,
      `<span class="st"><b>${t.warnings}</b> to check</span>`,
      fitPending ? `<span class="st pending">Checking text fit… ${fit.size}/${master.cards.length}</span>` : "",
      !storageOK ? `<span class="st bad">Browser storage unavailable — export to keep your edits</span>`
        : t.editedCards ? `<span class="st">Saved in this browser only${savedAt ? " at " + savedAt.toLocaleTimeString() : ""}</span>` : `<span class="st">No edits yet</span>`,
      t.editedCards && !exportedSinceChange ? `<span class="st pending">Not exported yet</span>` : "",
    ];
    $("#status").innerHTML = parts.filter(Boolean).join("");
    renderGateTabs();
  }

  /* ------------------------------------------------------------ checks */
  const coverage = kit.fontCoverage;
  const covered = (cp) => coverage.some(([a, b]) => cp >= a && cp <= b);
  function uncoveredChars(s) {
    const out = new Set();
    for (const ch of String(s)) { const cp = ch.codePointAt(0); if (cp > 0x20 && !covered(cp)) out.add(ch); }
    return [...out];
  }

  // Issues are cached per entry and recomputed only after something changed (edit, fit result, duplicates).
  let version = 0;
  const issueCache = new Map();
  const bump = () => { version++; };

  /** All issues for one entry (question + its answer). Each: { level, card_type, field, message }. */
  function issuesFor(id) {
    const hit = issueCache.get(id);
    if (hit && hit.v === version) return hit.list;
    const list = computeIssues(id);
    issueCache.set(id, { v: version, list });
    return list;
  }
  function computeIssues(id) {
    const q = current(id, "question");
    const a = hasAnswer(id) ? current(id, "answer") : null;
    const out = [];
    const push = (type, list) => list.forEach((i) => out.push(Object.assign({ card_type: type }, i)));
    push("question", R.cardTextIssues(q));
    if (a) push("answer", R.cardTextIssues(a, { question: q }));
    for (const [type, card] of [["question", q], ["answer", a]]) {
      if (!card) continue;
      const f = fit.get(ck(id, type));
      if (f && f.overflow) out.push({ card_type: type, level: "error", field: null, code: "overflow", message: `Too long for the card: the text does not fit even at the smallest size (${kit.settings.text_fit.min_pt} pt). Shorten it.` });
      for (const field of FIELDS) {
        const bad = uncoveredChars(card[field]);
        if (bad.length) out.push({ card_type: type, level: "warning", field, code: "font", message: `The card fonts have no glyph for ${bad.map((c) => `“${c}”`).join(" ")}; the printer will substitute another font (the build reports it). Use Latin characters if possible.` });
        if (conflicts.has(fk(id, type, field))) out.push({ card_type: type, level: "warning", field, code: "master-changed", message: `The master text of this field changed after you edited it. Master now reads: “${masterCard.get(ck(id, type))[field]}”. Keep your version or revert.` });
      }
    }
    const d = dupes.get(id);
    if (d && d.length) out.push({ card_type: "question", level: "error", field: "text_en", code: "near-duplicate", message: `Very similar to question ${d.join(", ")} in the same gate. Make each question distinct.` });
    if (isEdited(id) && q.verification_status === "web-checked") out.push({ card_type: "question", level: "info", field: null, code: "sources", message: "This card states a fact checked against sources. If you changed the fact, tell the coordinator so the sources can be updated." });
    return out;
  }

  function recomputeDupes() {
    bump();
    const cur = master.cards.map((c) => current(c.id, c.card_type));
    dupes = new Map();
    for (const d of R.nearDuplicates(cur)) {
      dupes.set(d.a, (dupes.get(d.a) || []).concat(d.b));
      dupes.set(d.b, (dupes.get(d.b) || []).concat(d.a));
    }
  }

  /* ------------------------------------------------------------ text fit (same algorithm as the PDFs) */
  function measure(id, type) {
    const card = current(id, type);
    const holder = document.createElement("div");
    holder.innerHTML = kit.renderFront(card, gateMap[card.gate]);
    $("#measure").appendChild(holder);
    const res = window.CardFit.fitCard(holder.firstElementChild);
    holder.remove();
    fit.set(ck(id, type), res);
    bump();
    return res;
  }
  function measureAll() {
    const queue = master.cards.map((c) => [c.id, c.card_type]);
    return new Promise((resolve) => {
      (function step() {
        const t0 = performance.now();
        while (queue.length && performance.now() - t0 < 30) measure(...queue.shift());
        renderStatus();
        if (queue.length) setTimeout(step, 0); else resolve();
      })();
    });
  }

  /* ------------------------------------------------------------ rendering */
  const typeLabel = (type, gate) => (type === "answer" ? "Answer card" : gate === "E" ? "Discussion card" : "Question card");
  function fieldHtml(id, type, field) {
    const lang = field === "text_fr" ? "fr" : "en";
    const lbl = lang === "fr" ? "Français" : "English";
    const tid = `t-${id}-${type}-${lang}`;
    return `<label class="field" for="${tid}"><span class="field-label"><span>${lbl}</span><span class="cc" id="${tid}-cc"></span></span>
      <textarea id="${tid}" lang="${lang}" spellcheck="true" rows="3" data-id="${esc(id)}" data-type="${type}" data-field="${field}" aria-describedby="${tid}-cc ${esc(id)}-issues"></textarea></label>`;
  }

  function entryHtml(q) {
    const g = gateMap[q.gate];
    const a = hasAnswer(q.id);
    const where = q.destination && !/^General/.test(q.destination) ? ` · ${esc(q.destination)}` : "";
    const src = q.gate === "E" ? "" : `<details class="sources"><summary>Sources and verification notes (internal, never printed)</summary><dl>
        <dt>Status</dt><dd>${esc(q.verification_status || "—")}</dd>
        <dt>Note</dt><dd>${esc(q.verification_note || "—")}</dd>
        <dt>Sources</dt><dd>${(q.source_urls || []).length ? q.source_urls.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`).join("<br>") : "—"}</dd>
      </dl></details>`;
    return `<article class="entry gate-${q.gate}" id="entry-${esc(q.id)}" data-id="${esc(q.id)}" data-gate="${q.gate}" aria-labelledby="h-${esc(q.id)}">
      <div class="entry-head">
        <span class="id-chip" id="h-${esc(q.id)}">${esc(q.id)}</span>
        <span class="meta"><b>Gate ${q.gate}</b> · ${esc(q.topic)}${where}</span>
        <span class="tags" data-tags></span>
        <span class="entry-tools">
          <button type="button" class="btn btn-small" data-act="preview">Preview</button>
          <button type="button" class="btn btn-small" data-act="revert" hidden>Revert card</button>
        </span>
      </div>
      <div class="fields${a ? "" : " single"}">
        <fieldset class="question"><legend>${typeLabel("question", q.gate)} <span>· carte ${q.gate === "E" ? "discussion" : "question"} ${esc(q.id)}</span></legend>
          ${fieldHtml(q.id, "question", "text_en")}${fieldHtml(q.id, "question", "text_fr")}
        </fieldset>
        ${a ? `<fieldset class="answer"><legend>Answer card <span>· carte réponse ${esc(q.id)}</span></legend>
          ${fieldHtml(q.id, "answer", "text_en")}${fieldHtml(q.id, "answer", "text_fr")}
        </fieldset>` : `<p class="no-answer">Gate E: open discussion question — there is no answer card, by design. Students share their own experiences.</p>`}
      </div>
      <ul class="issues" id="${esc(q.id)}-issues" aria-live="polite"></ul>
      ${src}
    </article>`;
  }

  function buildList() {
    $("#list").innerHTML = gates.map((g) => `<div class="gate-head gate-${g.gate}" data-gate-head="${g.gate}"><span class="letter" aria-hidden="true">${g.gate}</span><h2>Gate ${g.gate} — ${esc(g.name_en)}<small lang="fr">${esc(g.name_fr)}</small></h2></div>` +
      questions.filter((q) => q.gate === g.gate).map(entryHtml).join("")).join("") + `<p class="empty" id="empty" hidden>No cards match. Clear the search or choose another gate.</p>`;
    $$("#list textarea").forEach((t) => { t.value = value(t.dataset.id, t.dataset.type, t.dataset.field); });
  }

  function updateEntry(id) {
    const el = document.getElementById("entry-" + id);
    if (!el) return;
    const iss = issuesFor(id);
    const errs = iss.filter((i) => i.level === "error").length, warns = iss.filter((i) => i.level === "warning").length;
    $("[data-tags]", el).innerHTML = (isEdited(id) ? `<span class="tag edited">Edited</span>` : "") +
      (errs ? `<span class="tag err">${errs} error${errs === 1 ? "" : "s"}</span>` : "") +
      (warns ? `<span class="tag warn">${warns} to check</span>` : "") +
      ([...conflicts].some((k) => k.startsWith(id + "|")) ? `<span class="tag warn">Master changed</span>` : "");
    $('[data-act="revert"]', el).hidden = !isEdited(id);
    const where = (i) => `${i.card_type === "answer" ? "Answer" : "Question"}${i.field ? (i.field === "text_fr" ? " (FR)" : " (EN)") : ""}: `;
    $(".issues", el).innerHTML = iss.map((i) => `<li class="${i.level}"><span>${esc(where(i) + i.message)}</span></li>`).join("");
    $$("textarea", el).forEach((t) => {
      const { type, field } = t.dataset;
      const v = t.value;
      t.classList.toggle("changed", edits.has(fk(id, type, field)));
      t.setAttribute("aria-invalid", String(iss.some((i) => i.level === "error" && i.card_type === type && i.field === field)));
      const lim = type === "answer" ? R.LENGTH_LIMITS.answer : R.LENGTH_LIMITS.question;
      const cc = document.getElementById(t.id + "-cc");
      cc.textContent = `${clean(v).length} / ${lim} characters`;
      cc.classList.toggle("over", clean(v).length > lim);
    });
    el.dataset.problems = String(errs + warns);
    el.dataset.edited = String(isEdited(id));
  }

  /* ------------------------------------------------------------ filters */
  const fold = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function applyFilters() {
    const term = fold(ui.search.trim());
    let shown = 0;
    $$(".entry").forEach((el) => {
      const id = el.dataset.id;
      let ok = ui.gate === "all" || el.dataset.gate === ui.gate;
      if (ok && ui.show === "edited") ok = el.dataset.edited === "true";
      if (ok && ui.show === "problems") ok = el.dataset.problems !== "0";
      if (ok && term) {
        const q = current(id, "question"), a = hasAnswer(id) ? current(id, "answer") : null;
        const hay = fold([id, q.topic, q.destination, q.text_en, q.text_fr, a ? a.text_en : "", a ? a.text_fr : ""].join(" "));
        ok = term.split(/\s+/).every((w) => hay.includes(w));
      }
      el.hidden = !ok;
      if (ok) shown++;
    });
    $$("[data-gate-head]").forEach((h) => {
      h.hidden = !$$(`.entry[data-gate="${h.dataset.gateHead}"]`).some((e) => !e.hidden);
    });
    $("#empty").hidden = shown > 0;
    renderGateTabs();
  }

  function renderGateTabs() {
    const tabs = [{ gate: "all", label: "All", n: questions.length }].concat(gates.map((g) => ({ gate: g.gate, label: g.gate, n: questions.filter((q) => q.gate === g.gate).length })));
    const bad = (gate) => questions.filter((q) => (gate === "all" || q.gate === gate) && issuesFor(q.id).some((i) => i.level === "error")).length;
    const html = tabs.map((t) => {
      const b = bad(t.gate);
      const desc = t.gate === "all" ? "All gates" : `Gate ${t.gate}: ${gateMap[t.gate].short_en}`;
      return `<button type="button" class="gate-tab${t.gate === "all" ? "" : " gate-" + t.gate}" data-gate="${t.gate}" aria-pressed="${ui.gate === t.gate}" title="${esc(desc)}" aria-label="${esc(desc)}, ${t.n} cards${b ? `, ${b} with errors` : ""}">
        <span class="gl">${t.gate === "all" ? "All" : t.gate}</span><span class="n${b ? " bad" : ""}">${b ? `${b} ✗` : t.n}</span></button>`;
    }).join("");
    // Only touch the DOM when something changed, so keyboard focus on a tab is kept.
    if (html !== renderGateTabs.last) { renderGateTabs.last = html; $("#gate-tabs").innerHTML = html; }
  }

  /* ------------------------------------------------------------ live preview pane */
  function renderPane() {
    const pane = $("#pane");
    if (!activeId) return;
    const q = current(activeId, "question");
    const a = hasAnswer(activeId) ? current(activeId, "answer") : null;
    $("#pane-title").textContent = `Preview · ${activeId}`;
    $("#pane-sub").textContent = `${typeLabel("question", q.gate)}${a ? " and its answer card" : ""}, at ${Math.round(paneScale() * 100)} % of printed size.`;
    const list = a ? [["question", q], ["answer", a]] : [["question", q]];
    $("#pane-cards").style.setProperty("--pv-s", paneScale().toFixed(3));
    $("#pane-cards").innerHTML = list.map(([type, c]) => `<figure class="pv"><div class="pv-face"><div class="scaler">${kit.renderFront(c, gateMap[c.gate])}</div></div><figcaption>${typeLabel(type, c.gate)}</figcaption></figure>`).join("");
    const lines = [];
    $$(".pv .card", pane).forEach((cardEl, i) => {
      const r = window.CardFit.fitCard(cardEl);
      const [type] = list[i];
      fit.set(ck(activeId, type), r);
      bump();
      const start = type === "answer" ? kit.settings.text_fit.answer_en_pt : q.gate === "E" ? kit.settings.text_fit.discussion_en_pt : kit.settings.text_fit.question_en_pt;
      const name = typeLabel(type, q.gate);
      if (r.overflow) lines.push(`<li class="bad">${name}: too long — does not fit even at ${kit.settings.text_fit.min_pt} pt.</li>`);
      else if (r.shrunk) lines.push(`<li class="shrunk">${name}: fits; text reduced from ${start} pt to ${r.en_pt} pt (EN) / ${r.fr_pt} pt (FR).</li>`);
      else lines.push(`<li>${name}: fits at full size (${r.en_pt} pt).</li>`);
    });
    $("#pane-fit").innerHTML = lines.join("");
  }
  /** Preview scale: side by side when both cards stay near print size, otherwise stacked (narrow screens). */
  function paneScale() {
    const w = ($("#pane-cards").clientWidth || 440);
    const cardPx = kit.geometry.trimW * PX_PER_MM;
    const sideBySide = (w - 12 - 4) / (2 * cardPx);
    if (hasAnswer(activeId) && sideBySide >= 0.95) return Math.min(1.4, sideBySide);
    return Math.max(0.6, Math.min(1.4, (w - 4) / cardPx));
  }
  function setActive(id, open) {
    if (activeId !== id) {
      $$(".entry.active").forEach((e) => e.classList.remove("active"));
      activeId = id;
      const el = document.getElementById("entry-" + id);
      if (el) el.classList.add("active");
    }
    if (open) { $("#pane").classList.add("open"); }
    renderPane();
    if (open && getComputedStyle($("#pane-close")).display !== "none") $("#pane-close").focus();
  }

  /* ------------------------------------------------------------ events */
  const pending = new Map();
  $("#list").addEventListener("input", (e) => {
    const t = e.target;
    if (t.tagName !== "TEXTAREA") return;
    const { id, type, field } = t.dataset;
    setEdit(id, type, field, t.value);
    exportedSinceChange = false;
    clearTimeout(pending.get(id));
    pending.set(id, setTimeout(() => {
      measure(id, "question");
      if (hasAnswer(id)) measure(id, "answer");
      const wasDup = new Set(dupes.keys());
      recomputeDupes();
      const touched = new Set([id, ...wasDup, ...dupes.keys()]);
      touched.forEach(updateEntry);
      if (activeId === id) renderPane();
      if (ui.show !== "all") applyFilters(); else renderGateTabs();
      renderStatus();
    }, 250));
    scheduleSave();
  });
  $("#list").addEventListener("focusin", (e) => { const en = e.target.closest(".entry"); if (en && en.dataset.id !== activeId) setActive(en.dataset.id, false); });
  $("#list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = b.closest(".entry").dataset.id;
    if (b.dataset.act === "preview") setActive(id, true);
    if (b.dataset.act === "revert") {
      if (!confirm(`Revert card ${id} to the master text? Your changes to this card will be lost.`)) return;
      [...edits.keys()].filter((k) => k.startsWith(id + "|")).forEach((k) => { edits.delete(k); conflicts.delete(k); });
      $$(`#entry-${id} textarea`).forEach((t) => { t.value = value(id, t.dataset.type, t.dataset.field); });
      measure(id, "question"); if (hasAnswer(id)) measure(id, "answer");
      recomputeDupes(); questions.forEach((q) => updateEntry(q.id));
      if (activeId === id) renderPane();
      applyFilters(); saveDraft();
    }
  });
  $("#pane-close").addEventListener("click", () => { $("#pane").classList.remove("open"); const el = document.getElementById("entry-" + activeId); if (el) $("[data-act=preview]", el).focus(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#pane").classList.contains("open")) $("#pane-close").click(); });
  $("#pane").addEventListener("click", (e) => { if (e.target.id === "pane") $("#pane-close").click(); });

  $("#gate-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-gate]"); if (!b) return; ui.gate = b.dataset.gate; applyFilters(); });
  let searchTimer;
  $("#search").addEventListener("input", (e) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { ui.search = e.target.value; applyFilters(); }, 150); });
  $("#show").addEventListener("change", (e) => { ui.show = e.target.value; applyFilters(); });
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(renderPane, 150); });

  /* ------------------------------------------------------------ export */
  function stamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function confirmErrors(what) {
    const t = totals();
    return !t.errors || confirm(`There ${t.errors === 1 ? "is 1 error" : `are ${t.errors} errors`} in the cards (see “Cards that need attention”). The project build will refuse this file until they are fixed.\n\nExport the ${what} anyway, to keep your work?`);
  }
  function markExported(name) {
    exportedSinceChange = true; saveDraft();
    notice("ok", `Downloaded <b>${esc(name)}</b>. Your edits stay saved in this browser too.`);
  }
  $("#export-json").addEventListener("click", () => {
    if (!confirmErrors("JSON file")) return;
    const name = `cards_${stamp()}.json`;
    download(name, kit.io.formatCardsJSON(currentDoc()), "application/json");
    markExported(name);
  });
  $("#export-csv").addEventListener("click", () => {
    if (!confirmErrors("CSV file")) return;
    const name = `cards_${stamp()}.csv`;
    download(name, kit.io.cardsToCsv(currentDoc()), "text/csv;charset=utf-8");
    markExported(name);
  });
  $("#export-changes").addEventListener("click", () => {
    if (!edits.size) { notice("warn", "There are no edits yet, so there is no change list to export."); return; }
    const c = kit.io.csvCell;
    const rows = [...edits.entries()]
      .map(([k, e]) => { const [id, type, field] = k.split("|"); return { id, type, field, e }; })
      .sort((x, y) => master.cards.findIndex((m) => m.id === x.id && m.card_type === x.type) - master.cards.findIndex((m) => m.id === y.id && m.card_type === y.type) || x.field.localeCompare(y.field))
      .map(({ id, type, field, e }) => [id, type, masterCard.get(ck(id, type)).gate, field === "text_fr" ? "French" : "English", masterCard.get(ck(id, type))[field], clean(e.value), conflicts.has(fk(id, type, field)) ? "yes" : ""].map(c).join(","));
    const name = `card_changes_${stamp()}.csv`;
    download(name, "﻿" + ["id,card_type,gate,language,master_text,edited_text,master_changed_since_edit", ...rows].join("\r\n") + "\r\n", "text/csv;charset=utf-8");
    notice("ok", `Downloaded <b>${esc(name)}</b> (${rows.length} changed text${rows.length === 1 ? "" : "s"}).`);
  });

  /* ------------------------------------------------------------ import */
  /** Checks that a file has exactly the same cards (IDs and types) as the master. Returns a list of problems. */
  function structureProblems(doc) {
    if (!doc || typeof doc !== "object" || !Array.isArray(doc.cards)) return ["The file is not a card data file (no “cards” list)."];
    const probs = [];
    const seen = new Set();
    doc.cards.forEach((c, i) => {
      if (!c || typeof c.id !== "string" || !["question", "answer"].includes(c.card_type)) { probs.push(`Card #${i + 1} has no valid id / card_type.`); return; }
      const key = ck(c.id, c.card_type);
      if (seen.has(key)) probs.push(`${c.id} (${c.card_type}) appears twice.`);
      seen.add(key);
      if (typeof c.text_en !== "string" || typeof c.text_fr !== "string") probs.push(`${c.id} (${c.card_type}) is missing text_en or text_fr.`);
      if (c.card_type === "answer" && (c.gate === "E" || /^E/.test(c.id))) probs.push(`${c.id}: Gate E must not have answer cards.`);
    });
    const missing = [...masterCard.keys()].filter((k) => !seen.has(k));
    const extra = [...seen].filter((k) => !masterCard.has(k));
    const fmt = (list) => list.slice(0, 8).map((k) => k.replace("|", " ")).join(", ") + (list.length > 8 ? ` and ${list.length - 8} more` : "");
    if (missing.length) probs.push(`Missing cards: ${fmt(missing)}.`);
    if (extra.length) probs.push(`Unexpected cards (not in the deck): ${fmt(extra)}.`);
    return probs;
  }
  $("#import-json").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let doc;
    try { doc = JSON.parse((await file.text()).replace(/^﻿/, "")); }
    catch (err) { notice("error", `<b>${esc(file.name)}</b> is not valid JSON, so nothing was imported. (${esc(err.message)})`); return; }
    const probs = structureProblems(doc);
    if (probs.length) { notice("error", `<b>${esc(file.name)}</b> was not imported because it does not match the deck: ${probs.slice(0, 6).map(esc).join(" ")}`); return; }
    const incoming = new Map();
    let otherDiffs = 0;
    for (const c of doc.cards) {
      const m = masterCard.get(ck(c.id, c.card_type));
      for (const f of FIELDS) if (c[f] !== m[f]) incoming.set(fk(c.id, c.card_type, f), c[f]);
      for (const f of Object.keys(m)) if (!FIELDS.includes(f) && JSON.stringify(c[f]) !== JSON.stringify(m[f])) otherDiffs++;
    }
    if (edits.size && !confirm(`Replace your current edits (${totals().editedCards} cards) with the text from ${file.name}?`)) return;
    edits.clear(); conflicts.clear();
    for (const [k, v] of incoming) { const [id, type, field] = k.split("|"); setEdit(id, type, field, v); }
    $$("#list textarea").forEach((t) => { t.value = value(t.dataset.id, t.dataset.type, t.dataset.field); });
    exportedSinceChange = false;
    await measureAll(); recomputeDupes(); questions.forEach((q) => updateEntry(q.id)); applyFilters(); renderPane(); saveDraft();
    const n = totals().editedCards;
    notice(otherDiffs ? "warn" : "ok", `Imported <b>${esc(file.name)}</b>: ${n} card${n === 1 ? "" : "s"} differ from the master text.` +
      (otherDiffs ? ` Only question and answer text is imported; ${otherDiffs} other field${otherDiffs === 1 ? "" : "s"} in the file (sources, notes…) differ from this editor's master data and were left unchanged.` : ""));
  });

  $("#discard").addEventListener("click", () => {
    if (!edits.size) { notice("ok", "There are no edits to discard."); return; }
    if (!confirm(`Discard all edits (${totals().editedCards} cards) and go back to the master text? This cannot be undone. Export JSON first if you want to keep a copy.`)) return;
    edits.clear(); conflicts.clear();
    $$("#list textarea").forEach((t) => { t.value = value(t.dataset.id, t.dataset.type, t.dataset.field); });
    measureAll().then(() => { recomputeDupes(); questions.forEach((q) => updateEntry(q.id)); applyFilters(); renderPane(); });
    exportedSinceChange = true; saveDraft();
    notice("ok", "All edits were discarded. The cards show the master text again.");
  });

  window.addEventListener("beforeunload", (e) => {
    if (edits.size && !storageOK && !exportedSinceChange) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ------------------------------------------------------------ start */
  const help = $("#help");
  try { help.open = localStorage.getItem(STORE_KEY + "/help") !== "closed"; } catch (e) { help.open = true; }
  help.addEventListener("toggle", () => { try { localStorage.setItem(STORE_KEY + "/help", help.open ? "open" : "closed"); } catch (e) { /* storage unavailable */ } });
  const structural = structureProblems(master);
  storageOK = testStorage();
  if (!storageOK) notice("warn", "This browser does not allow saving drafts (private mode or storage disabled). Your edits will be lost when you close the page unless you click <b>Export JSON</b>.");
  else loadDraft();
  buildList();
  recomputeDupes();
  questions.forEach((q) => updateEntry(q.id));
  applyFilters();
  renderStatus();
  if (structural.length) notice("error", "The master data in this editor is inconsistent: " + structural.map(esc).join(" ") + " Rebuild the project.");
  window.CardFit.ready().then(measureAll).then(() => {
    questions.forEach((q) => updateEntry(q.id));
    applyFilters();
    renderStatus();
    setActive(questions[0].id, false);
    document.documentElement.dataset.editorReady = "1";
  });

  // Small hook for the automated browser tests (scripts/test-web.mjs).
  window.__editor = { totals, issuesFor, currentDoc, structureProblems, edits };
})();
