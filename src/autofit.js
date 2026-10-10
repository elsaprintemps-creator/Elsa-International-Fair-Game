// Runs in the browser (print layouts, preview gallery, editor).
// 1. Shrinks question/answer text step by step until it fits inside the card's safe area.
// 2. Checks single-line labels for clipping.
// Results are exposed on window.__fitReport for the PDF/QC scripts.
// By default it runs once on load. Pages that insert cards with JavaScript set window.__FIT_MANUAL__ = true
// before this script and call window.CardFit.fitAll() / fitCard(el) themselves.
(function () {
  const PT_PER_PX = 0.75;

  function fits(el) {
    return el.scrollHeight <= el.clientHeight + 0.5 && el.scrollWidth <= el.clientWidth + 0.5;
  }

  /** Fit one card body ([data-autofit]); returns the result record. */
  function fitBody(body, cfg) {
    cfg = cfg || window.__FIT__ || { min_pt: 7, step_pt: 0.2 };
    const card = body.closest(".card");
    const en = body.querySelector(".en");
    const fr = body.querySelector(".fr");
    let enPt = parseFloat(getComputedStyle(en).fontSize) * PT_PER_PX;
    let frPt = parseFloat(getComputedStyle(fr).fontSize) * PT_PER_PX;
    const startEn = enPt;
    const ratio = frPt / enPt;
    let guard = 0;
    while (!fits(body) && enPt - cfg.step_pt >= cfg.min_pt - 1e-6 && guard++ < 200) {
      enPt -= cfg.step_pt;
      frPt = Math.max(cfg.min_pt, enPt * ratio);
      en.style.fontSize = enPt.toFixed(2) + "pt";
      fr.style.fontSize = frPt.toFixed(2) + "pt";
    }
    return {
      id: card.dataset.id,
      card_type: card.dataset.type,
      en_pt: +enPt.toFixed(2),
      fr_pt: +frPt.toFixed(2),
      shrunk: enPt < startEn - 1e-6,
      overflow: !fits(body),
    };
  }

  function clippedIn(root) {
    const clipped = [];
    root.querySelectorAll("[data-fit-check]").forEach((el) => {
      if (!fits(el)) {
        const card = el.closest(".card");
        clipped.push({ id: card && card.dataset.id, card_type: card && card.dataset.type, element: el.className });
      }
    });
    return clipped;
  }

  /** Fit a single rendered card element (.card.front). */
  function fitCard(cardEl) {
    const body = cardEl.querySelector("[data-autofit]");
    const res = body ? fitBody(body) : null;
    if (res) res.clipped = clippedIn(cardEl).length > 0;
    return res;
  }

  function fitAll(root) {
    root = root || document;
    const results = [];
    root.querySelectorAll("[data-autofit]").forEach((body) => results.push(fitBody(body)));
    window.__fitReport = { done: true, cards: results, clipped: clippedIn(root) };
    document.documentElement.dataset.fitDone = "1";
    return window.__fitReport;
  }

  // Force-load every face used on the cards before measuring, so sizes are final.
  const FACES = [
    '400 10pt "Atkinson Hyperlegible"', 'italic 400 10pt "Atkinson Hyperlegible"', '700 10pt "Atkinson Hyperlegible"',
    '600 10pt "Barlow Condensed"', '700 10pt "Barlow Condensed"', '800 10pt "Barlow Condensed"',
  ];
  let readyPromise = null;
  function ready() {
    if (!readyPromise) {
      readyPromise = !document.fonts
        ? Promise.resolve()
        : Promise.all(FACES.map((f) => document.fonts.load(f, "AÉé").catch(() => null))).then(() => document.fonts.ready);
    }
    return readyPromise;
  }

  window.CardFit = { fitAll, fitCard, ready, fits };

  if (window.__FIT_MANUAL__) return;
  const start = () => ready().then(() => fitAll());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
