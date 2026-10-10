// Renders selected pages of the FINISHED PDFs to PNG (build/snapshots/) for visual proofing, using pdf.js
// inside headless Chrome, i.e. a real PDF renderer reading the exported files (not the HTML they came from).
//   npm run snapshots                      default pages
//   node scripts/pdf-snapshots.mjs shop:1,2,359,360 home:1,3,4,5,6 spec:1
import puppeteer from "puppeteer-core";
import http from "node:http";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { ROOT, launchOptions, loadProject } from "./lib.mjs";

const { settings } = loadProject();
const FILES = { shop: settings.print_shop.output, home: settings.home_print.output, spec: settings.spec_sheet.output_pdf };
const args = process.argv.slice(2);
const wanted = (args.length ? args : ["shop:1,2,359,360", "home:1,3,4,5,6", "spec:1"]).map((a) => { const [k, p] = a.split(":"); return { key: k, file: FILES[k], pages: p.split(",").map(Number) }; });

// Tiny static server (pdf.js needs http for its module + worker).
const TYPES = { ".mjs": "text/javascript", ".js": "text/javascript", ".pdf": "application/pdf", ".html": "text/html" };
const server = http.createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^[\\/]+/, "");
  const p = join(ROOT, rel);
  if (!p.startsWith(ROOT) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const outDir = join(ROOT, "build", "snapshots");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(ROOT, "build", "_snap.html"), `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#888"><canvas id="c"></canvas>
<script type="module">
import * as pdfjs from "/node_modules/pdfjs-dist/build/pdf.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/node_modules/pdfjs-dist/build/pdf.worker.mjs";
window.renderPage = async (url, n, scale) => {
  const doc = await pdfjs.getDocument(url).promise;
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale });
  const c = document.getElementById("c"); c.width = vp.width; c.height = vp.height;
  await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  return { w: vp.width, h: vp.height };
};
window.ready = true;
</script>`);

const browser = await puppeteer.launch(launchOptions(settings));
const page = await browser.newPage();
await page.goto(`${base}/build/_snap.html`, { waitUntil: "load" });
await page.waitForFunction(() => window.ready === true);
const written = [];
for (const w of wanted) {
  for (const n of w.pages) {
    const scale = w.key === "shop" ? 4 : 1.6;
    const { w: cw, h: ch } = await page.evaluate((u, n, s) => window.renderPage(u, n, s), `${base}/${w.file}`, n, scale);
    await page.setViewport({ width: Math.ceil(cw), height: Math.ceil(ch) });
    const out = join(outDir, `${w.key}-p${n}.png`);
    await (await page.$("#c")).screenshot({ path: out });
    written.push(out);
  }
}
await browser.close();
server.close();
console.log(`✓ ${written.length} PDF page snapshots in build/snapshots/`);
