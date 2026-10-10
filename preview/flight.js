// Decorative flight in the masthead (markup in preview_gallery.html, motion in preview.css).
// The plane leans toward the pointer and the cloud layers shift at different depths;
// every loop pauses while the masthead is scrolled out of view. Purely visual, so it never touches the cards.
(function () {
  "use strict";
  const scene = document.getElementById("flight");
  if (!scene) return;
  const masthead = scene.closest(".masthead") || document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const clamp = (v) => Math.max(-1, Math.min(1, v));

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => scene.classList.toggle("is-paused", !entry.isIntersecting)).observe(scene);
  }

  let frame = 0, px = 0, py = 0;
  const apply = () => { frame = 0; scene.style.setProperty("--px", px.toFixed(3)); scene.style.setProperty("--py", py.toFixed(3)); };
  masthead.addEventListener("pointermove", (e) => {
    if (reduceMotion.matches || !finePointer.matches) return;
    const r = scene.getBoundingClientRect();
    px = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2));
    py = clamp((e.clientY - (r.top + r.height / 2)) / r.height);
    if (!frame) frame = requestAnimationFrame(apply);
  });
  masthead.addEventListener("pointerleave", () => { px = 0; py = 0; if (!frame) frame = requestAnimationFrame(apply); });
})();
