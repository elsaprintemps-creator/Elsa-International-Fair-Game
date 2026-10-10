// Animated card-design preview.
// Every card is drawn with window.CardKit (the same templates, fonts and back artwork as the print PDFs)
// from window.CARDS_DATA (a build-time copy of data/cards.json). Cards start face down; clicking flips them.
(function () {
  "use strict";
  const kit = window.CardKit;
  const data = window.CARDS_DATA;
  if (!kit || !data) {
    document.getElementById("gallery").innerHTML = '<p class="empty-note">The card data could not be loaded. Run <code>npm run build</code> to regenerate <code>preview/generated/</code>.</p>';
    return;
  }

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = kit.esc;
  const PX_PER_MM = 96 / 25.4;
  const SIZES = { s: 1.0, m: 1.3, l: 1.65 };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gates = kit.gates;
  const gateMap = Object.fromEntries(gates.map((g) => [g.gate, g]));
  const cards = data.cards;
  const questions = cards.filter((c) => c.card_type === "question");
  const answerOf = Object.fromEntries(cards.filter((c) => c.card_type === "answer").map((c) => [c.id, c]));
  const state = { gate: "all", show: "all", size: "m", guides: false };

  /* ---------- Departures board (gate filter) ---------- */
  const perGate = (g) => ({ q: cards.filter((c) => c.gate === g && c.card_type === "question").length, a: cards.filter((c) => c.gate === g && c.card_type === "answer").length });
  const boardRows = [{ gate: "all", dest: "All gates", fr: "Toutes les portes", cardsTxt: `${cards.length} cards` }]
    .concat(gates.map((g) => {
      const n = perGate(g.gate);
      return { gate: g.gate, dest: g.short_en, fr: g.short_fr, cardsTxt: n.a ? `${n.q} Q · ${n.a} A` : `${n.q} Q · no answers` };
    }));
  $("#board").innerHTML = boardRows.map((r) => `<button type="button" class="board-row${r.gate === "all" ? "" : " gate-" + r.gate}" data-gate="${r.gate}" aria-pressed="false">
      <span class="b-gate${r.gate === "all" ? " all" : ""}">${r.gate === "all" ? "ALL" : r.gate}</span>
      <span class="b-dest"><b>${esc(r.dest)}</b><i lang="fr">${esc(r.fr)}</i></span>
      <span class="b-cards">${r.cardsTxt}</span>
      <span class="b-status">${r.gate === "all" ? "Open" : "Open"}</span>
    </button>`).join("");

  const nQ = questions.length, nA = cards.length - nQ;
  $("#lede").textContent = `Every card in the deck, exactly as it will be printed: ${nQ} question cards and ${nA} answer cards (${cards.length} cards in all). Cards start face down, the way players see them. Click a card to turn it over.`;

  /* ---------- Cards ---------- */
  const face = (cls, html, hidden) => `<div class="face ${cls}"${hidden ? ' aria-hidden="true"' : ""}><div class="scaler">${html}</div><div class="guides" aria-hidden="true"><i class="trim"></i><i class="safe"></i></div></div>`;
  const typeName = (c) => (c.card_type === "answer" ? "Answer" : c.gate === "E" ? "Discussion" : "Question");
  function slotHtml(c) {
    const g = gateMap[c.gate];
    const label = `Flip card ${c.id}, ${typeName(c).toLowerCase()} card, Gate ${c.gate}`;
    return `<figure class="slot" data-id="${esc(c.id)}" data-type="${c.card_type}" data-gate="${c.gate}" data-face="back">
      <div class="flip">
        <div class="flip-inner">
          ${face("face-back", kit.renderBack(c.gate), false)}
          ${face("face-front", kit.renderFront(c, g), true)}
        </div>
        <button type="button" class="flip-hit" aria-pressed="false" aria-label="${esc(label)}"></button>
      </div>
      <figcaption class="cap"><span>${esc(c.id)} · ${typeName(c)}</span><span class="side">Back</span></figcaption>
    </figure>`;
  }

  $("#gallery").innerHTML = gates.map((g) => {
    const qs = questions.filter((c) => c.gate === g.gate);
    const n = perGate(g.gate);
    const note = n.a
      ? `${n.q} question cards, each next to its answer card (same ID). All ${n.q + n.a} cards share the Gate ${g.gate} back.`
      : `${n.q} open-ended discussion cards. No answer cards by design: students share their own experiences.`;
    return `<section class="gate-sec gate-${g.gate}" id="gate-${g.gate}" data-gate="${g.gate}" aria-labelledby="gate-${g.gate}-title">
      <div class="gate-title"><span class="letter" aria-hidden="true">${g.gate}</span><h2 id="gate-${g.gate}-title">Gate ${g.gate} — ${esc(g.name_en)}<small lang="fr">${esc(g.name_fr)}</small></h2></div>
      <p class="gate-note">${note}</p>
      <p class="empty-note" hidden>Gate ${g.gate} has no answer cards: its cards are open discussion prompts. Choose “Questions” or “All cards” to see them.</p>
      <div class="grid">${qs.map((q) => {
        const a = answerOf[q.id];
        const where = q.destination && !/^General/.test(q.destination) ? ` <span>· ${esc(q.destination)}</span>` : "";
        return `<div class="pair" data-gate="${g.gate}"><div class="pair-label">${esc(q.id)} · ${esc(q.topic)}${where}</div><div class="pair-cards">${slotHtml(q)}${a ? slotHtml(a) : ""}</div></div>`;
      }).join("")}</div>
    </section>`;
  }).join("");

  $("#backs-row").innerHTML = gates.map((g) => `<figure><div class="face">${`<div class="scaler">${kit.renderBack(g.gate)}</div>`}</div><figcaption>Gate ${g.gate}</figcaption></figure>`).join("");
  $("#foot").innerHTML = `Drawn from <code>data/cards.json</code> with the same card templates, fonts, colours and back artwork as the print PDFs (finished size ${kit.geometry.trimW} × ${kit.geometry.trimH} mm, ${kit.geometry.bleed} mm bleed). Built ${esc(new Date(kit.built).toLocaleString())}.`;

  const slots = $$(".slot", $("#gallery"));

  /* ---------- Flipping ---------- */
  const onScreen = new Set();
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target))), { rootMargin: "200px" }) : null;
  slots.forEach((s) => { s._rot = 0; if (io) io.observe(s); });

  const announce = (msg) => { const el = $("#announce"); el.textContent = ""; setTimeout(() => (el.textContent = msg), 30); };

  /** Turn a card to its front (true) or back (false). Always rotates the same way, like turning a real card over. */
  function setFace(slot, front, animate) {
    if ((slot.dataset.face === "front") === front) return false;
    const motion = animate && !reduceMotion.matches;
    slot._rot += 180;
    if (!motion) slot.classList.add("instant");
    slot.querySelector(".flip-inner").style.setProperty("--rot", slot._rot + "deg");
    slot.dataset.face = front ? "front" : "back";
    slot.querySelector(".flip-hit").setAttribute("aria-pressed", String(front));
    slot.querySelector(".face-front").setAttribute("aria-hidden", String(!front));
    slot.querySelector(".face-back").setAttribute("aria-hidden", String(front));
    slot.querySelector(".cap .side").textContent = front ? "Front" : "Back";
    const flip = slot.querySelector(".flip");
    if (motion) { flip.classList.remove("lift"); void flip.offsetWidth; flip.classList.add("lift"); }
    else requestAnimationFrame(() => requestAnimationFrame(() => slot.classList.remove("instant")));
    return true;
  }

  $("#gallery").addEventListener("click", (e) => {
    const btn = e.target.closest(".flip-hit");
    if (!btn) return;
    const slot = btn.closest(".slot");
    const front = slot.dataset.face !== "front";
    setFace(slot, front, true);
    announce(`${slot.dataset.id} ${typeName({ card_type: slot.dataset.type, gate: slot.dataset.gate }).toLowerCase()} card: ${front ? "front shown" : "back shown"}.`);
  });
  $("#gallery").addEventListener("animationend", (e) => { if (e.target.classList.contains("lift")) e.target.classList.remove("lift"); });

  /** Flip many cards: on-screen ones animate in a short cascade, the rest switch instantly. */
  function setAll(front) {
    const visible = slots.filter((s) => !s.hidden && !s.closest("[hidden]"));
    let i = 0;
    slots.forEach((s) => {
      if ((s.dataset.face === "front") === front) return;
      const animate = visible.includes(s) && onScreen.has(s) && !reduceMotion.matches;
      if (animate) { const d = Math.min(i++ * 35, 700); setTimeout(() => setFace(s, front, true), d); }
      else setFace(s, front, false);
    });
    announce(front ? "All cards flipped to their fronts." : "All cards reset to their backs.");
  }
  $("#flip-all").addEventListener("click", () => setAll(true));
  $("#reset").addEventListener("click", () => setAll(false));

  /* ---------- Filters, size, guides ---------- */
  function applyFilters() {
    $$(".board-row").forEach((b) => {
      const on = b.dataset.gate === state.gate;
      b.setAttribute("aria-pressed", String(on));
      b.querySelector(".b-status").textContent = on ? "Boarding" : "Open";
    });
    $$("[data-show]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.show === state.show)));
    let shown = 0;
    $$(".gate-sec").forEach((sec) => {
      const gateOn = state.gate === "all" || sec.dataset.gate === state.gate;
      sec.hidden = !gateOn;
      let inSec = 0;
      $$(".slot", sec).forEach((s) => { s.hidden = state.show !== "all" && s.dataset.type !== state.show; if (!s.hidden) inSec++; });
      $$(".pair", sec).forEach((p) => { p.hidden = !$$(".slot", p).some((s) => !s.hidden); });
      $(".empty-note", sec).hidden = inSec > 0;
      if (gateOn) shown += inSec;
    });
    $("#count").textContent = `${shown} card${shown === 1 ? "" : "s"} shown`;
    const params = new URLSearchParams();
    if (state.gate !== "all") params.set("gate", state.gate);
    if (state.show !== "all") params.set("show", state.show);
    const hash = params.toString();
    history.replaceState(null, "", hash ? "#" + hash : location.pathname + location.search);
  }

  function applySize() {
    $$("[data-size]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.size === state.size)));
    const g = kit.geometry;
    const cardMm = state.guides ? g.trimW + 2 * g.bleed : g.trimW;
    const avail = Math.max(200, $("#gallery").clientWidth || document.documentElement.clientWidth - 32);
    const fit = avail / (cardMm * PX_PER_MM);
    const s = Math.min(SIZES[state.size], fit);
    $("#gallery").style.setProperty("--s", s.toFixed(3));
    document.body.classList.toggle("show-guides", state.guides);
  }

  $("#board").addEventListener("click", (e) => {
    const b = e.target.closest(".board-row");
    if (!b) return;
    state.gate = b.dataset.gate;
    applyFilters();
    const target = state.gate === "all" ? $("#gallery") : $("#gate-" + state.gate);
    if (target && $("#toolbar").getBoundingClientRect().top > 0) target.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
  });
  $$("[data-show]").forEach((b) => b.addEventListener("click", () => { state.show = b.dataset.show; applyFilters(); }));
  $$("[data-size]").forEach((b) => b.addEventListener("click", () => { state.size = b.dataset.size; applySize(); try { localStorage.setItem("airport-preview-size", state.size); } catch (e) { /* storage unavailable */ } }));
  $("#guides").addEventListener("change", (e) => { state.guides = e.target.checked; applySize(); });
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(applySize, 120); });

  // Restore gate/show from the link (#gate=B&show=answer) and the remembered size.
  const params = new URLSearchParams(location.hash.slice(1));
  if (gateMap[params.get("gate")]) state.gate = params.get("gate");
  if (["question", "answer"].includes(params.get("show"))) state.show = params.get("show");
  try { const sz = localStorage.getItem("airport-preview-size"); if (SIZES[sz]) state.size = sz; } catch (e) { /* storage unavailable */ }

  // Fit the card text (same algorithm as the PDFs) while everything is laid out, then apply filters.
  applySize();
  window.CardFit.ready().then(() => {
    window.CardFit.fitAll($("#gallery"));
    applyFilters();
    document.documentElement.dataset.previewReady = "1";
  });
})();
