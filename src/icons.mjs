// Small vector glyphs used on card fronts. All drawn for this project (no third-party icon sets).

export const PLANE_PATH =
  "M12 2C12.9 2 13.4 2.9 13.4 4V9.2L21.5 13.6V15.6L13.4 13.2V18.4L15.6 20V21.6L12 20.7L8.4 21.6V20L10.6 18.4V13.2L2.5 15.6V13.6L10.6 9.2V4C10.6 2.9 11.1 2 12 2Z";

export const plane = () => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${PLANE_PATH}"/></svg>`;

// Thin "→" used in the footer labels. Drawn as a path so it never depends on a system font
// (the card fonts' web subsets do not contain U+2192).
export const arrow = () => `<svg class="arr" viewBox="0 0 18 8" aria-hidden="true"><path d="M1 4h15M12.6 1.2 16.2 4l-3.6 2.8" fill="none" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const stroke = (d, extra = "") =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/>${extra}</svg>`;

// Mini versions of the five back motifs, shown in the gate badge on every front.
export const badgeIcon = {
  A: () => stroke("M3.6 4v3.6M5.1 4v3.6M6.6 4v3.6M3.6 7.6Q3.6 9.4 5.1 9.4Q6.6 9.4 6.6 7.6M5.1 9.4V20M18.6 20V4c1.8 1 2.3 3.8 1.9 6.8h-1.9", `<circle cx="11.9" cy="12.4" r="4.4"/>`),
  B: () => stroke("M3.5 9L12 4l8.5 5zM4.5 10.8h15M6.6 12.6v5.4M10 12.6v5.4M14 12.6v5.4M17.4 12.6v5.4M4.5 19.6h15M3 21.4h18"),
  C: () => stroke("M9.6 16.4c0-2.2-3-3.4-3-7.4a5.4 5.4 0 0 1 10.8 0c0 4-3 5.2-3 7.4zM9.8 18.8h4.4M10.4 20.9h3.2M10.3 8.2a1.8 1.8 0 1 1 2.7 1.6c-.6.4-1 .8-1 1.6", `<circle cx="12" cy="13.3" r="0.5" fill="currentColor"/>`),
  D: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-10 12 12)" fill="currentColor"><rect x="4.5" y="4.5" width="15" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.4" cy="8.4" r="1.2"/><circle cx="15.6" cy="8.4" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="8.4" cy="15.6" r="1.2"/><circle cx="15.6" cy="15.6" r="1.2"/></g></svg>`,
  E: () => stroke("M3.5 3.8h8.6a2 2 0 0 1 2 2v3.8a2 2 0 0 1-2 2H7.8l-2.6 2.3v-2.3H3.5a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2zM12 11.2h8.4a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-.8v2.3L17 19h-5a2 2 0 0 1-2-2v-3.8a2 2 0 0 1 2-2z"),
};

// Language flags placed before the English and French text, so students can tell the two sentences apart.
// They keep their real colours (the one deliberate exception to the card palette) so they read as flags at a glance.
// Both fill a 3:2 box; the Union Jack is drawn on its usual 2:1 grid and stretched to fit (red saltire counterchanged).
export const flag = {
  en: () => `<svg viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true"><path fill="#012169" d="M0 0h60v30H0z"/><path stroke="#FFFFFF" stroke-width="6" d="M0 0l60 30M60 0L0 30"/><path fill="#C8102E" d="M0 0l30 15v2.236L0 2.236zM60 0L30 15v-2.236L55.528 0zM60 30L30 15v-2.236l30 15zM0 30l30-15v2.236L4.472 30z"/><path stroke="#FFFFFF" stroke-width="10" d="M30 0v30M0 15h60"/><path stroke="#C8102E" stroke-width="6" d="M30 0v30M0 15h60"/></svg>`,
  fr: () => `<svg viewBox="0 0 3 2" aria-hidden="true"><path fill="#0055A4" d="M0 0h1v2H0z"/><path fill="#FFFFFF" d="M1 0h1v2H1z"/><path fill="#EF4135" d="M2 0h1v2H2z"/></svg>`,
};

// Decorative boarding-pass barcode, deterministic per card ID (purely ornamental).
export function barcode(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const bars = [];
  let x = 0;
  while (x < 44) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const w = 0.6 + (h % 3) * 0.55;
    const gap = 0.6 + ((h >>> 4) % 3) * 0.45;
    if (x + w > 44) break;
    bars.push(`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="15"/>`);
    x += w + gap;
  }
  return `<svg viewBox="0 0 44 15" preserveAspectRatio="none" aria-hidden="true" fill="currentColor">${bars.join("")}</svg>`;
}
