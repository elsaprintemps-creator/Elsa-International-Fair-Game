// Renders the design prototype (docs/prototype.png): one Gate A question + its answer,
// one Gate E discussion card, and all five backs — at 3× resolution for review.
// Pass card IDs to preview others, e.g. `node scripts/prototype.mjs B7 B7:answer E3`.
import puppeteer from "puppeteer-core";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { ROOT, findBrowser, loadProject, writeOut } from "./lib.mjs";
import { head, renderFront, renderBack, loadBacks } from "../src/templates.mjs";

const ids = process.argv.slice(2);
const { settings, data, gateMap } = loadProject();
const backs = loadBacks(ROOT, data.gates);
const pick = (id, type) => data.cards.find((c) => c.id === id && c.card_type === type);
const fronts = ids.length
  ? ids.map((s) => { const [id, t = "question"] = s.split(":"); return pick(id, t); }).filter(Boolean)
  : [pick("A10", "question"), pick("A10", "answer"), pick("E13", "question")];

const css = `body{margin:0;padding:6mm;background:#D9F2F4;font-family:var(--font-text)}
.row{display:flex;gap:5mm;margin-bottom:5mm;align-items:flex-start}
.tv{width:var(--trim-w);height:var(--trim-h);overflow:hidden;position:relative;border-radius:var(--preview-radius);box-shadow:0 1px 3px rgba(11,37,69,.3)}
.tv>.card{position:absolute;left:calc(-1*var(--bleed));top:calc(-1*var(--bleed))}`;
const html = `${head({ title: "Prototype", rel: "../", settings, extraCss: css })}<body>
<div class="row">${fronts.map((c) => `<div class="tv">${renderFront(c, gateMap[c.gate])}</div>`).join("")}</div>
<div class="row">${data.gates.map((g) => `<div class="tv">${renderBack(g.gate, backs)}</div>`).join("")}</div>
</body></html>`;
const file = writeOut("build/prototype.html", html);

const browser = await puppeteer.launch({ executablePath: findBrowser(settings), headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1300, height: 900, deviceScaleFactor: 3 });
await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
await page.waitForFunction(() => window.__fitReport && window.__fitReport.done, { timeout: 30000 });
const box = await page.evaluate(() => { const r = document.body.getBoundingClientRect(); const rows = [...document.querySelectorAll(".row")]; const w = Math.max(...rows.map((x) => x.scrollWidth)); return { w: w + 50, h: r.height }; });
const out = join(ROOT, "docs", "prototype.png");
mkdirSync(join(ROOT, "docs"), { recursive: true });
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: box.w, height: box.h } });
const rep = await page.evaluate(() => window.__fitReport);
if (rep.cards.some((c) => c.overflow) || rep.clipped.length) { console.error("Prototype has overflowing text", rep); process.exitCode = 1; }
await browser.close();
console.log("✓", out);
