// Animated card-design preview.
// Every card is drawn with window.CardKit (the same templates, fonts and back artwork as the print PDFs)
// from window.CARDS_DATA (a build-time copy of data/cards.json). Cards start face down; clicking flips them.
// The first page shows the five gates; opening one (#gate=A … #gate=E) shows only that gate's cards.
(function () {
  "use strict";
  const kit = window.CardKit;
  const data = window.CARDS_DATA;
  if (!kit || !data) {
    document.getElementById("gates").innerHTML = '<li class="empty-note">The card data could not be loaded. Run <code>npm run build</code> to regenerate <code>preview/generated/</code>.</li>';
    return;
  }

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = kit.esc;
  const PX_PER_MM = 96 / 25.4;
  const SIZES = { s: 1.0, m: 1.3, l: 1.65 };
  const BASE_TITLE = document.title;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gates = kit.gates;
  const gateMap = Object.fromEntries(gates.map((g) => [g.gate, g]));
  const cards = data.cards;
  const questions = cards.filter((c) => c.card_type === "question");
  const answerOf = Object.fromEntries(cards.filter((c) => c.card_type === "answer").map((c) => [c.id, c]));
  const state = { gate: null, show: "all", size: "m", guides: false };
  let fitted = false;

  const perGate = (g) => ({ q: cards.filter((c) => c.gate === g && c.card_type === "question").length, a: cards.filter((c) => c.gate === g && c.card_type === "answer").length });
  const countTxt = (g) => { const n = perGate(g); return n.a ? `${n.q + n.a} cards · ${n.q} questions + ${n.a} answers` : `${n.q} discussion cards · no answers`; };

  const nQ = questions.length, nA = cards.length - nQ;
  $("#lede").textContent = `The whole deck, exactly as it will be printed: ${nQ} question cards and ${nA} answer cards (${cards.length} in all), sorted into ${gates.length} gates. Choose a gate to see its cards. They start face down, the way players see them: click a card to turn it over.`;

  /* ---------- First page: the five gates ---------- */
  // The back artwork is decorative here (the link text names the gate), so it is hidden from screen readers.
  $("#gates").innerHTML = gates.map((g) => `<li><a class="gate-tile gate-${g.gate}" href="#gate=${g.gate}">
      <span class="tile-art" aria-hidden="true">${kit.renderBack(g.gate)}</span>
      <span class="tile-info">
        <span class="tile-gate">Gate ${g.gate}</span>
        <b class="tile-name">${esc(g.short_en)}</b>
        <i class="tile-fr" lang="fr">${esc(g.short_fr)}</i>
        <span class="tile-count">${countTxt(g.gate)}</span>
        <span class="tile-cta">See the cards<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </span>
    </a></li>`).join("");

  $("#gate-tabs").innerHTML = gates.map((g) => `<li><a class="gate-tab gate-${g.gate}" href="#gate=${g.gate}" aria-label="Gate ${g.gate}: ${esc(g.short_en)}" title="Gate ${g.gate}: ${esc(g.short_en)}">${g.gate}</a></li>`).join("");

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

  // Heading of the open gate, with a legend showing how to tell the two piles apart face down
  // (answer backs are drawn on a lighter field, see preview.css). Kept outside #gallery, which holds only the 180 cards.
  const mini = (gate, answer) => `<figure class="legend-item${answer ? " is-answer" : ""}"><div class="face" aria-hidden="true"><div class="scaler">${kit.renderBack(gate)}</div></div>
      <figcaption><b>${answer ? "Answer card" : "Question card"}</b><span>${answer ? "Lighter back" : "Full-colour back"}</span><i lang="fr">${answer ? "Carte réponse : dos plus clair" : "Carte question : dos en couleur"}</i></figcaption></figure>`;
  function gateHeadHtml(g) {
    const n = perGate(g.gate);
    const note = n.a
      ? `${n.q} question cards, each next to its answer card (same ID): ${n.q + n.a} cards in all.`
      : `${n.q} open-ended discussion cards. No answer cards by design: students share their own experiences.`;
    return `<div class="gate-head-text gate-${g.gate}">
        <div class="gate-title"><span class="letter" aria-hidden="true">${g.gate}</span><h2 id="gate-title" tabindex="-1">Gate ${g.gate} — ${esc(g.name_en)}<small lang="fr">${esc(g.name_fr)}</small></h2></div>
        <p class="gate-note">${note}</p>
      </div>
      ${n.a ? `<div class="legend" role="group" aria-label="How to tell the cards apart face down">${mini(g.gate, false)}${mini(g.gate, true)}</div>` : ""}`;
  }

  $("#gallery").innerHTML = gates.map((g) => {
    const qs = questions.filter((c) => c.gate === g.gate);
    return `<section class="gate-sec gate-${g.gate}" id="gate-${g.gate}" data-gate="${g.gate}" aria-label="Gate ${g.gate} cards">
      <p class="empty-note" hidden>Gate ${g.gate} has no answer cards: its cards are open discussion prompts. Choose “Questions” or “All cards” to see them.</p>
      <div class="grid">${qs.map((q) => {
        const a = answerOf[q.id];
        const where = q.destination && !/^General/.test(q.destination) ? ` <span>· ${esc(q.destination)}</span>` : "";
        return `<div class="pair" data-gate="${g.gate}"><div class="pair-label">${esc(q.id)} · ${esc(q.topic)}${where}</div><div class="pair-cards">${slotHtml(q)}${a ? slotHtml(a) : ""}</div></div>`;
      }).join("")}</div>
    </section>`;
  }).join("");

  $("#foot").innerHTML = `Created by ELSA A.BAKHSHI<br>© 2026 ELSA A.BAKHSHI. All rights reserved. These cards may be printed and used free of charge for non-commercial educational purposes; any other copying, modification, distribution or commercial use requires the author’s written permission.`;

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

  /** Flip every card of the open gate: on-screen ones animate in a short cascade, the rest switch instantly. */
  function setAll(front) {
    const mine = slots.filter((s) => s.dataset.gate === state.gate);
    let i = 0;
    mine.forEach((s) => {
      if ((s.dataset.face === "front") === front) return;
      const animate = !s.hidden && onScreen.has(s) && !reduceMotion.matches;
      if (animate) { const d = Math.min(i++ * 35, 700); setTimeout(() => setFace(s, front, true), d); }
      else setFace(s, front, false);
    });
    announce(front ? `All Gate ${state.gate} cards flipped to their fronts.` : `All Gate ${state.gate} cards reset to their backs.`);
  }
  $("#flip-all").addEventListener("click", () => setAll(true));
  $("#reset").addEventListener("click", () => setAll(false));

  /* ---------- Filters, size, guides ---------- */
  function applyFilters() {
    $$("[data-show]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.show === state.show)));
    let shown = 0;
    $$(".gate-sec").forEach((sec) => {
      const gateOn = sec.dataset.gate === state.gate;
      sec.hidden = !gateOn;
      let inSec = 0;
      $$(".slot", sec).forEach((s) => { s.hidden = state.show !== "all" && s.dataset.type !== state.show; if (!s.hidden) inSec++; });
      $$(".pair", sec).forEach((p) => { p.hidden = !$$(".slot", p).some((s) => !s.hidden); });
      $(".empty-note", sec).hidden = inSec > 0;
      if (gateOn) shown += inSec;
    });
    $("#count").textContent = `${shown} card${shown === 1 ? "" : "s"} shown`;
    const params = new URLSearchParams({ gate: state.gate });
    if (state.show !== "all") params.set("show", state.show);
    history.replaceState(null, "", "#" + params.toString());
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

  $$("[data-show]").forEach((b) => b.addEventListener("click", () => { state.show = b.dataset.show; applyFilters(); }));
  $$("[data-size]").forEach((b) => b.addEventListener("click", () => { state.size = b.dataset.size; applySize(); try { localStorage.setItem("airport-preview-size", state.size); } catch (e) { /* storage unavailable */ } }));
  $("#guides").addEventListener("change", (e) => { state.guides = e.target.checked; applySize(); });
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(applySize, 120); });
  try { const sz = localStorage.getItem("airport-preview-size"); if (SIZES[sz]) state.size = sz; } catch (e) { /* storage unavailable */ }

  /* ---------- Views: the five gates (no hash) or one gate (#gate=B, optionally &show=answer) ---------- */
  const isRoute = (hash) => hash === "" || hash === "#" || /(^#|&)gate=/.test(hash);

  function render(navigated) {
    const params = new URLSearchParams(location.hash.slice(1));
    const gate = gateMap[params.get("gate")] ? params.get("gate") : null;
    state.gate = gate;
    state.show = ["question", "answer"].includes(params.get("show")) ? params.get("show") : "all";
    const home = !gate;
    document.body.dataset.view = home ? "home" : "gate";
    $("#masthead").hidden = !home;
    $("#picker").hidden = !home;
    $("#gatebar").hidden = home;
    $("#toolbar").hidden = home;
    $("#gate-view").hidden = home;
    document.title = home ? BASE_TITLE : `Gate ${gate} · ${BASE_TITLE}`;
    $$(".gate-tab").forEach((a) => { if (a.classList.contains("gate-" + gate)) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });

    if (!home) {
      $("#gate-head").innerHTML = gateHeadHtml(gateMap[gate]);
      const i = gates.findIndex((g) => g.gate === gate);
      const link = (g, dir) => g ? `<a class="pager-${dir}" href="#gate=${g.gate}">${dir === "prev" ? '<span aria-hidden="true">←</span> ' : ""}<b>Gate ${g.gate}</b> <span>${esc(g.short_en)}</span>${dir === "next" ? ' <span aria-hidden="true">→</span>' : ""}</a>` : "<span></span>";
      $("#pager").innerHTML = `${link(gates[i - 1], "prev")}<a class="pager-home" href="#">All gates</a>${link(gates[i + 1], "next")}`;
      if (fitted) { applySize(); applyFilters(); }
    }

    if (navigated) {
      window.scrollTo(0, 0);
      const heading = home ? $("#picker-title") : $("#gate-title");
      heading.focus({ preventScroll: true });
      announce(home ? "Showing all five gates." : `Gate ${gate}: ${countTxt(gate)}.`);
    }
  }
  window.addEventListener("hashchange", () => { if (isRoute(location.hash)) render(true); });

  // The skip link moves focus without changing the hash (the hash holds the open gate).
  $(".skip").addEventListener("click", (e) => { e.preventDefault(); $("#main").focus(); $("#main").scrollIntoView(); });

  render(false);
  // Fit the card text (same algorithm as the PDFs) while the whole deck is laid out off-screen, then show the open gate.
  applySize();
  window.CardFit.ready().then(() => {
    window.CardFit.fitAll($("#gallery"));
    fitted = true;
    $("#gate-view").classList.remove("measuring");
    if (state.gate) { applySize(); applyFilters(); }
    document.documentElement.dataset.previewReady = "1";
  });
})();
