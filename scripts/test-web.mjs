// Automated browser tests for the two static web pages (headless Chrome/Edge):
//   preview/preview_gallery.html — five-gate first page, one gate per view, lighter answer backs,
//                                  flip interaction, keyboard, reduced motion, filters, sizes, mobile
//   editor/index.html            — editing, live checks, browser drafts, real downloads (JSON/CSV/change list),
//                                  import (valid + rejected files), filters, mobile overlay,
//                                  and agreement with scripts/validate.mjs on exported files
// Screenshots go to build/screenshots/. Writes build/web-test-report.json; exits 1 on any failure.
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ROOT, launchOptions, loadProject, writeOut } from "./lib.mjs";

const { settings, data } = loadProject();
const SHOTS = join(ROOT, "build", "screenshots");
const DL = join(ROOT, "build", "test-downloads");
mkdirSync(SHOTS, { recursive: true });
const results = [];
const t = (group, name, ok, detail = "") => { results.push({ group, name, ok: !!ok, detail: String(detail ?? "") }); console.log(`  ${ok ? "✓" : "✗"} [${group}] ${name}${detail !== "" && detail != null ? ` (${detail})` : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (rel) => pathToFileURL(join(ROOT, rel)).href;

const browser = await puppeteer.launch(launchOptions(settings));

async function newPage(ctx, viewport, opts = {}) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") page.errors.push(m.text()); });
  if (opts.reduceMotion) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.setViewport(viewport);
  return page;
}

/* =============================================================== PREVIEW */
{
  const G = "preview";
  const ctx = await browser.createBrowserContext();
  const page = await newPage(ctx, { width: 1366, height: 900 });
  const ready = () => page.waitForFunction(() => document.documentElement.dataset.previewReady === "1", { timeout: 60000 });
  await page.goto(url("preview/preview_gallery.html"), { waitUntil: "load" });
  await ready();
  await page.screenshot({ path: join(SHOTS, "preview-desktop.png") });

  const counts = await page.evaluate(() => {
    const s = [...document.querySelectorAll("#gallery .slot")];
    const by = (f) => s.filter(f).length;
    return { total: s.length, A: by((x) => x.dataset.gate === "A"), B: by((x) => x.dataset.gate === "B"), C: by((x) => x.dataset.gate === "C"), D: by((x) => x.dataset.gate === "D"), E: by((x) => x.dataset.gate === "E"), eAnswers: by((x) => x.dataset.gate === "E" && x.dataset.type === "answer"), answers: by((x) => x.dataset.type === "answer") };
  });
  t(G, "Loads without script errors", page.errors.length === 0, page.errors.join("; "));
  t(G, "All 180 cards present: A–D 40 each (20 Q + 20 A), E 20 questions, no Gate E answers", counts.total === 180 && ["A", "B", "C", "D"].every((g) => counts[g] === 40) && counts.E === 20 && counts.eAnswers === 0 && counts.answers === 80, JSON.stringify(counts));
  const dls = await page.evaluate(() => [...document.querySelectorAll(".downloads a.dl")].map((a) => ({ href: a.href, download: a.hasAttribute("download") })));
  const badDl = dls.filter((d) => !d.download || !existsSync(fileURLToPath(d.href)));
  t(G, "Download links: all 4 PDFs (home A4, print shop, A3 cut sheets, print specifications) exist", dls.length === 4 && badDl.length === 0, badDl.map((d) => d.href).join(", ") || `${dls.length} links`);

  // First page: the five gates, no cards.
  const visible = () => page.evaluate(() => [...document.querySelectorAll("#gallery .slot")].filter((s) => s.offsetParent !== null).map((s) => s.dataset.gate + s.dataset.type[0]));
  const home = await page.evaluate(() => ({
    h1: document.querySelector("h1").firstChild.textContent.trim(),
    tiles: [...document.querySelectorAll("#gates .gate-tile")].map((a) => ({ href: a.getAttribute("href"), back: a.querySelector(".card.back")?.dataset.back, count: a.querySelector(".tile-count").textContent })),
    toolbar: document.getElementById("toolbar").offsetParent !== null,
  }));
  const shownHome = (await visible()).length;
  t(G, "Title reads “FGES Airport Gates”", home.h1 === "FGES Airport Gates", home.h1);
  t(G, "First page shows the five gates (each with its own back) and no cards", home.tiles.length === 5 && home.tiles.every((x, i) => x.href === `#gate=${"ABCDE"[i]}` && x.back === "ABCDE"[i]) && shownHome === 0 && !home.toolbar, `${home.tiles.length} gates, ${shownHome} cards shown`);
  t(G, "Each gate states its card count (A–D: 40 cards, E: 20 discussion cards)", home.tiles.slice(0, 4).every((x) => /^40 cards/.test(x.count)) && /^20 discussion cards/.test(home.tiles[4].count), home.tiles.map((x) => x.count).join(" | "));

  // Open Gate A from the first page.
  await page.click('.gate-tile[href="#gate=A"]');
  await sleep(300);
  const vA = await visible();
  const openA = await page.evaluate(() => ({ hash: location.hash, masthead: document.getElementById("masthead").offsetParent !== null, focus: document.activeElement.id, title: document.getElementById("gate-title").textContent }));
  t(G, "Clicking a gate shows only that gate's 40 cards (20 questions + 20 answers)", vA.length === 40 && vA.every((x) => x[0] === "A") && vA.filter((x) => x === "Aq").length === 20 && openA.hash === "#gate=A" && !openA.masthead, `${vA.length} cards, ${openA.hash}`);
  t(G, "The open gate's heading takes focus (screen readers hear which gate opened)", openA.focus === "gate-title" && /^Gate A/.test(openA.title), openA.title);
  await page.screenshot({ path: join(SHOTS, "preview-gate.png") });

  const init = await page.evaluate(() => {
    const s = [...document.querySelectorAll("#gallery .slot")];
    const shown = s.filter((x) => x.offsetParent !== null);
    const m11 = (el) => new DOMMatrix(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform).m11;
    return {
      allBack: s.every((x) => x.dataset.face === "back" && x.querySelector(".flip-hit").getAttribute("aria-pressed") === "false"),
      frontsHidden: s.every((x) => x.querySelector(".face-front").getAttribute("aria-hidden") === "true"),
      notRotated: shown.every((x) => Math.abs(m11(x.querySelector(".flip-inner")) - 1) < 1e-6),
      ownBack: s.every((x) => x.querySelector(".face-back .card.back").dataset.back === x.dataset.gate),
      backFacesVisible: shown.every((x) => getComputedStyle(x.querySelector(".face-front")).backfaceVisibility === "hidden"),
      hint: /Click a card to flip it/.test(document.getElementById("hint").textContent),
      fit: window.__fitReport.cards.filter((c) => c.overflow).length,
      fitted: window.__fitReport.cards.length,
    };
  });
  t(G, "Every card starts face down (back facing the viewer), fronts hidden from screen readers", init.allBack && init.frontsHidden && init.notRotated && init.backFacesVisible, JSON.stringify(init));
  t(G, "Every card shows its own gate's back design", init.ownBack);
  t(G, "Hint “Click a card to flip it” is shown", init.hint);
  t(G, "All card text fits (same fitting as the PDFs, all 180 cards)", init.fit === 0 && init.fitted === 180, `${init.fit} overflowing of ${init.fitted}`);

  // Answer backs: same artwork on a lighter field of the same gate colour; question backs and the back text unchanged.
  const shades = await page.evaluate(() => {
    const ctx2d = document.createElement("canvas").getContext("2d");
    const rgb = (c) => { ctx2d.clearRect(0, 0, 1, 1); ctx2d.fillStyle = c; ctx2d.fillRect(0, 0, 1, 1); return [...ctx2d.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const root = getComputedStyle(document.documentElement);
    return ["A", "B", "C", "D"].map((g) => {
      const back = (type) => document.querySelector(`#gallery .slot[data-gate="${g}"][data-type="${type}"] .face-back svg`);
      const q = rgb(getComputedStyle(back("question").querySelector("rect")).fill), a = rgb(getComputedStyle(back("answer").querySelector("rect")).fill);
      const token = rgb(root.getPropertyValue(`--gate-${g}-field`).trim());
      const inkQ = getComputedStyle(back("question").querySelector("text")).fill, inkA = getComputedStyle(back("answer").querySelector("text")).fill;
      return { g, qIsToken: q.join() === token.join(), lighter: lum(a) - lum(q), sameInk: inkQ === inkA };
    });
  });
  t(G, "Answer backs are lighter than question backs (A–D); question backs keep the gate colour, back text keeps its colour", shades.every((x) => x.qIsToken && x.lighter > 25 && x.sameInk), shades.map((x) => `${x.g} +${x.lighter.toFixed(0)}${x.qIsToken ? "" : " (question back changed!)"}${x.sameInk ? "" : " (ink changed!)"}`).join(", "));
  const legend = await page.evaluate(() => [...document.querySelectorAll("#gate-head .legend-item b")].map((b) => b.textContent));
  t(G, "Legend explains question vs answer backs", legend.join("|") === "Question card|Answer card", legend.join("|"));

  const sel = (id, type) => `#gallery .slot[data-id="${id}"][data-type="${type}"]`;
  const state = (id, type) => page.evaluate((s) => { const el = document.querySelector(s); const m = new DOMMatrix(getComputedStyle(el.querySelector(".flip-inner")).transform); return { face: el.dataset.face, pressed: el.querySelector(".flip-hit").getAttribute("aria-pressed"), m11: +m.m11.toFixed(3), frontHidden: el.querySelector(".face-front").getAttribute("aria-hidden"), cap: el.querySelector(".cap .side").textContent }; }, sel(id, type));

  await page.click(`${sel("A1", "question")} .flip-hit`);
  await sleep(260);
  const mid = await state("A1", "question");
  await page.screenshot({ path: join(SHOTS, "preview-mid-flip.png") });
  await sleep(800);
  const s1 = await state("A1", "question");
  t(G, "Click flips the card to its front with a 3D rotation (mid-animation the card is edge-on, then fully turned)", mid.m11 > -0.999 && mid.m11 < 0.999 && s1.face === "front" && s1.pressed === "true" && s1.m11 === -1 && s1.frontHidden === "false", `mid m11 ${mid.m11}, end ${JSON.stringify(s1)}`);
  await page.screenshot({ path: join(SHOTS, "preview-flipped.png") });
  await page.click(`${sel("A1", "question")} .flip-hit`);
  await sleep(900);
  const s2 = await state("A1", "question");
  t(G, "Clicking again flips it back to the gate back", s2.face === "back" && s2.pressed === "false" && s2.m11 === 1, JSON.stringify(s2));

  // Keyboard
  await page.focus(`${sel("A3", "answer")} .flip-hit`);
  const focusable = await page.evaluate(() => document.activeElement.classList.contains("flip-hit") && document.activeElement.tagName === "BUTTON");
  await page.keyboard.press("Enter");
  await sleep(900);
  const k1 = await state("A3", "answer");
  await page.keyboard.press("Space");
  await sleep(900);
  const k2 = await state("A3", "answer");
  t(G, "Keyboard: cards are focusable buttons; Enter flips to the front, Space flips back", focusable && k1.face === "front" && k2.face === "back", `${k1.face} → ${k2.face}`);
  const tabbed = await page.evaluate(() => { document.querySelector("#reset").focus(); return true; }) && (await (async () => { for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); const c = await page.evaluate(() => document.activeElement.className); if (c.includes("flip-hit")) return true; } return false; })());
  t(G, "Keyboard: Tab from the toolbar reaches the cards", tabbed);
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2; });
  t(G, "Keyboard focus is visible on the card", ring);

  // Flip all / reset act on the open gate only
  await page.click("#flip-all");
  await sleep(1700);
  const flipped = await page.evaluate(() => { const s = [...document.querySelectorAll("#gallery .slot")]; return { gate: s.filter((x) => x.dataset.gate === "A").every((x) => x.dataset.face === "front"), others: s.filter((x) => x.dataset.gate !== "A").every((x) => x.dataset.face === "back") }; });
  await page.click("#reset");
  await sleep(1700);
  const allBack = await page.evaluate(() => [...document.querySelectorAll("#gallery .slot")].every((s) => s.dataset.face === "back" && s.querySelector(".flip-hit").getAttribute("aria-pressed") === "false"));
  t(G, "“Flip all to fronts” turns the open gate's cards only; “Reset all to backs” returns them to their backs", flipped.gate && flipped.others && allBack, `gate front ${flipped.gate}, other gates untouched ${flipped.others}, all back ${allBack}`);

  // Switching gates, type filter, links, back button
  await page.click('.gate-tab[href="#gate=B"]');
  await sleep(200);
  const vB = await visible();
  const tabCurrent = await page.evaluate(() => document.querySelector(".gate-tab[aria-current='page']")?.textContent);
  await page.click('[data-show="answer"]');
  const vBA = await visible();
  const hash = await page.evaluate(() => location.hash);
  await page.click('.gate-tab[href="#gate=E"]');
  await sleep(200);
  await page.click('[data-show="answer"]');
  const vEA = await visible();
  const emptyNote = await page.evaluate(() => !document.querySelector("#gate-E .empty-note").hidden);
  t(G, "Gate switcher opens another gate (only its cards) and marks it as current", vB.length === 40 && vB.every((x) => x[0] === "B") && tabCurrent === "B", `${vB.length} cards, current ${tabCurrent}`);
  t(G, "Type filter: answers only", vBA.length === 20 && vBA.every((x) => x === "Ba"), `${vBA.length} cards`);
  t(G, "Gate E with “Answers” shows no cards and explains why", vEA.length === 0 && emptyNote);
  t(G, "Filter state is kept in the link (#gate=…&show=…)", hash === "#gate=B&show=answer", hash);
  await page.goBack();
  await sleep(200);
  const back = await page.evaluate(() => location.hash);
  await page.click(".home-link");
  await sleep(200);
  const home2 = await page.evaluate(() => ({ view: document.body.dataset.view, gates: document.getElementById("picker").offsetParent !== null }));
  const shownHome2 = (await visible()).length;
  t(G, "Browser Back returns to the previous gate; “All gates” returns to the five gates", /^#gate=B/.test(back) && home2.view === "home" && home2.gates && shownHome2 === 0, `back → ${back}, then ${home2.view} (${shownHome2} cards shown)`);
  await page.goto("about:blank");
  await page.goto(url("preview/preview_gallery.html") + "#gate=D&show=question", { waitUntil: "load" });
  await ready();
  const vD = await visible();
  t(G, "Opening a link with #gate=D&show=question restores that view", vD.length === 20 && vD.every((x) => x === "Dq"), `${vD.length} cards`);

  // Size + guides
  const sz = async () => page.evaluate(() => { const s = [...document.querySelectorAll("#gallery .slot")].find((x) => x.offsetParent !== null); return { s: +getComputedStyle(document.getElementById("gallery")).getPropertyValue("--s"), w: s.querySelector(".flip").getBoundingClientRect().width }; });
  const m = await sz();
  await page.click('[data-size="l"]');
  const l = await sz();
  await page.click("#guides");
  const g = await sz();
  const guidesShown = await page.evaluate(() => getComputedStyle([...document.querySelectorAll("#gallery .slot")].find((x) => x.offsetParent !== null).querySelector(".guides")).display === "block");
  await page.evaluate(() => [...document.querySelectorAll("#gallery .slot")].find((x) => x.offsetParent !== null).closest(".pair").scrollIntoView());
  await page.screenshot({ path: join(SHOTS, "preview-print-guides.png") });
  await page.click("#guides");
  await page.click('[data-size="m"]');
  t(G, "Card size buttons enlarge the cards", l.s > m.s && l.w > m.w, `M ${m.w.toFixed(0)} px → L ${l.w.toFixed(0)} px`);
  t(G, "Print guides show bleed, trim and safe-area lines", guidesShown && g.w > l.w, `${l.w.toFixed(0)} → ${g.w.toFixed(0)} px with bleed`);
  await page.close();

  // Reduced motion
  const rm = await newPage(ctx, { width: 1366, height: 900 }, { reduceMotion: true });
  await rm.goto(url("preview/preview_gallery.html") + "#gate=C", { waitUntil: "load" });
  await rm.waitForFunction(() => document.documentElement.dataset.previewReady === "1");
  const before = await rm.evaluate(() => getComputedStyle(document.querySelector("#gallery .flip-inner")).transitionDuration);
  await rm.click('#gallery .slot[data-id="C2"][data-type="question"] .flip-hit');
  await sleep(40);
  const quick = await rm.evaluate(() => { const el = document.querySelector('#gallery .slot[data-id="C2"][data-type="question"]'); return { face: el.dataset.face, m11: +new DOMMatrix(getComputedStyle(el.querySelector(".flip-inner")).transform).m11.toFixed(3), lift: el.querySelector(".flip").classList.contains("lift") }; });
  t(G, "Reduced motion: no flip animation (instant face change, no lift)", before === "0s" && quick.face === "front" && quick.m11 === -1 && !quick.lift, `transition ${before}, ${JSON.stringify(quick)}`);
  await rm.close();

  // Mobile
  const mob = await newPage(ctx, { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mob.goto(url("preview/preview_gallery.html"), { waitUntil: "load" });
  await mob.waitForFunction(() => document.documentElement.dataset.previewReady === "1");
  const mh = await mob.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth, fitting: [...document.querySelectorAll("#gates .gate-tile")].filter((a) => a.getBoundingClientRect().right <= innerWidth).length }));
  t(G, "Mobile (375 px): the five gates fit the screen width, no horizontal scrolling", mh.scroll <= mh.inner && mh.fitting === 5, `page ${mh.scroll}px, ${mh.fitting} gates fit`);
  await mob.screenshot({ path: join(SHOTS, "preview-mobile-gates.png"), fullPage: true });
  await mob.tap('.gate-tile[href="#gate=A"]');
  await sleep(300);
  const mi = await mob.evaluate(() => {
    const s = +getComputedStyle(document.getElementById("gallery")).getPropertyValue("--s");
    const minPt = Math.min(...window.__fitReport.cards.flatMap((c) => [c.en_pt, c.fr_pt]));
    const card = [...document.querySelectorAll("#gallery .slot")].find((x) => x.offsetParent !== null);
    return { scroll: document.documentElement.scrollWidth, inner: innerWidth, cardW: card.querySelector(".flip").getBoundingClientRect().width, s, minPx: minPt * s * 96 / 72 };
  });
  t(G, "Mobile (375 px): no horizontal scrolling and cards fit the screen", mi.scroll <= mi.inner && mi.cardW <= mi.inner - 32, `page ${mi.scroll}px, card ${mi.cardW.toFixed(0)}px`);
  t(G, "Mobile: smallest card text is still at least 11 px on screen", mi.minPx >= 11, `${mi.minPx.toFixed(1)} px (scale ${mi.s})`);
  await mob.tap('#gallery .slot[data-id="A2"][data-type="question"] .flip-hit');
  await sleep(900);
  const tapped = await mob.evaluate(() => document.querySelector('#gallery .slot[data-id="A2"][data-type="question"]').dataset.face);
  t(G, "Mobile: tapping a card flips it", tapped === "front");
  await mob.evaluate(() => document.querySelector('#gallery .slot[data-id="A2"]').scrollIntoView());
  await mob.screenshot({ path: join(SHOTS, "preview-mobile.png") });
  await mob.close();
  await ctx.close();
}

/* =============================================================== EDITOR */
{
  const G = "editor";
  rmSync(DL, { recursive: true, force: true });
  mkdirSync(DL, { recursive: true });
  const ctx = await browser.createBrowserContext();
  const cdp = await browser.target().createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL, browserContextId: ctx.id });
  const page = await newPage(ctx, { width: 1440, height: 950 });
  const dialogs = [];
  page.on("dialog", async (d) => { dialogs.push(d.message()); await d.accept(); });
  const ready = async () => page.waitForFunction(() => document.documentElement.dataset.editorReady === "1", { timeout: 60000 });
  await page.goto(url("editor/index.html"), { waitUntil: "load" });
  await ready();
  await page.screenshot({ path: join(SHOTS, "editor-desktop.png") });

  const st = await page.evaluate(() => ({
    entries: document.querySelectorAll(".entry").length,
    textareas: document.querySelectorAll("textarea").length,
    eEntries: document.querySelectorAll('.entry[data-gate="E"]').length,
    eAnswerFields: document.querySelectorAll('.entry[data-gate="E"] fieldset.answer, .entry[data-gate="E"] textarea[data-type="answer"]').length,
    eNote: [...document.querySelectorAll('.entry[data-gate="E"] .no-answer')].length,
    adAnswers: document.querySelectorAll('.entry:not([data-gate="E"]) fieldset.answer').length,
    labelled: [...document.querySelectorAll("textarea")].every((x) => x.labels.length === 1 && x.labels[0].textContent.trim()),
    named: [...document.querySelectorAll("button")].every((b) => (b.getAttribute("aria-label") || b.textContent).trim()),
    totals: window.__editor.totals(),
    idsShown: [...document.querySelectorAll(".entry .id-chip")].map((x) => x.textContent).join(","),
  }));
  t(G, "Loads without script errors", page.errors.length === 0, page.errors.join("; "));
  t(G, "100 cards to edit: 80 with question + answer (A–D), 20 Gate E with question only", st.entries === 100 && st.adAnswers === 80 && st.eEntries === 20 && st.textareas === 360, JSON.stringify({ entries: st.entries, adAnswers: st.adAnswers, e: st.eEntries, textareas: st.textareas }));
  t(G, "Gate E has no answer fields, and says so", st.eAnswerFields === 0 && st.eNote === 20);
  t(G, "Every card shows its ID (A1–E20 in order)", st.idsShown === data.cards.filter((c) => c.card_type === "question").map((c) => c.id).join(","));
  t(G, "Every text box has a label and every button has a name", st.labelled && st.named);
  t(G, "Master data passes every editor check (0 errors, 0 warnings)", st.totals.errors === 0 && st.totals.warnings === 0, JSON.stringify(st.totals));

  // Downloads (real browser downloads into an emptied folder; names repeat within the same minute)
  async function download(selector, ext) {
    for (const f of readdirSync(DL)) rmSync(join(DL, f), { force: true });
    await page.click(selector);
    for (let i = 0; i < 100; i++) {
      const files = readdirSync(DL);
      const f = files.find((x) => x.endsWith(ext));
      if (f && !files.some((x) => x.endsWith(".crdownload"))) { await sleep(150); return { name: f, text: readFileSync(join(DL, f), "utf8") }; }
      await sleep(100);
    }
    return null;
  }
  const j0 = await download("#export-json", ".json");
  const c0 = await download("#export-csv", ".csv");
  t(G, "Export JSON without edits = data/cards.json, byte for byte (safe drop-in replacement)", j0 && j0.text === readFileSync(join(ROOT, "data/cards.json"), "utf8"), j0 ? j0.name : "no download");
  t(G, "Export CSV without edits = data/cards.csv, byte for byte", c0 && c0.text === readFileSync(join(ROOT, "data/cards.csv"), "utf8"), c0 ? c0.name : "no download");

  // Edit + draft persistence
  const typeInto = async (id, type, lang, text, { replace = false } = {}) => {
    const s = `#t-${id}-${type}-${lang}`;
    await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: "center" }), s);
    await page.click(s);
    if (replace) { await page.evaluate((s) => { const el = document.querySelector(s); el.select(); }, s); await page.keyboard.press("Backspace"); }
    else await page.evaluate((s) => { const el = document.querySelector(s); el.setSelectionRange(el.value.length, el.value.length); }, s);
    if (text) await page.keyboard.type(text);
    await sleep(700);
  };
  await typeInto("A1", "question", "en", " (Edited by a colleague.)");
  const e1 = await page.evaluate(() => ({ tag: !!document.querySelector("#entry-A1 .tag.edited"), totals: window.__editor.totals(), draft: !!localStorage.getItem("airport-gates-card-editor/v1"), status: document.getElementById("status").textContent }));
  t(G, "Typing marks the card as edited and saves a draft in this browser", e1.tag && e1.totals.editedCards === 1 && e1.draft && /Saved in this browser only/.test(e1.status) && /Not exported yet/.test(e1.status), e1.status);
  await page.reload({ waitUntil: "load" });
  await ready();
  const e2 = await page.evaluate(() => ({ v: document.querySelector("#t-A1-question-en").value, notice: document.getElementById("notice").textContent }));
  t(G, "After reloading, the edit is restored from the browser draft (with a notice)", e2.v.endsWith("(Edited by a colleague.)") && /Restored your edits to 1 card/.test(e2.notice), e2.notice.trim().slice(0, 80));

  // Live checks
  await typeInto("B2", "question", "fr", "", { replace: true });
  const v1 = await page.evaluate(() => ({ iss: window.__editor.issuesFor("B2").map((i) => i.code), invalid: document.querySelector("#t-B2-question-fr").getAttribute("aria-invalid"), msg: document.getElementById("B2-issues").textContent, tab: document.querySelector('.gate-tab[data-gate="B"] .n').textContent }));
  t(G, "Required check: empty French text is an error, shown next to the field and on the gate tab", v1.iss.includes("required") && v1.invalid === "true" && /French text is required/.test(v1.msg) && /1/.test(v1.tab), JSON.stringify(v1).slice(0, 160));
  await typeInto("A3", "answer", "en", " " + "This answer goes on and on with far too many words for a small card. ".repeat(8));
  const v2 = await page.evaluate(() => window.__editor.issuesFor("A3").map((i) => i.code));
  t(G, "Fit check: text too long for the printed card is an error (same fitting as the PDFs)", v2.includes("overflow") && v2.includes("long"), v2.join(","));
  await page.evaluate(() => document.getElementById("entry-A3").scrollIntoView());
  await page.click("#t-A3-answer-en");
  await sleep(300);
  await page.screenshot({ path: join(SHOTS, "editor-errors.png") });
  const a1fr = await page.evaluate(() => document.querySelector("#t-A1-answer-fr").value);
  await typeInto("A1", "answer", "fr", "C)" + a1fr.slice(2), { replace: true });
  const v3 = await page.evaluate(() => window.__editor.issuesFor("A1").filter((i) => i.code === "mc-letter").map((i) => i.message));
  t(G, "Question–answer check: the French answer letter must match the English one", v3.length === 1 && /starts with C\) but the English answer starts with B\)/.test(v3[0]), v3[0]);
  const ef = await page.evaluate(() => { const s = document.querySelector("#t-E5-question-fr"); return !!s && !document.querySelector("#t-E5-answer-en"); });
  t(G, "Gate E cards only offer the question (EN + FR) for editing", ef);

  // Export with errors → validator must reject; fix → validator must accept
  dialogs.length = 0;
  const jBad = await download("#export-json", ".json");
  writeFileSync(join(ROOT, "build", "_editor_export.json"), jBad ? jBad.text : "{}");
  const vBad = spawnSync(process.execPath, ["scripts/validate.mjs"], { cwd: ROOT, env: { ...process.env, CARDS_FILE: "build/_editor_export.json" }, encoding: "utf8" });
  t(G, "Exporting with errors asks for confirmation first", dialogs.some((d) => /errors? in the cards/.test(d)), dialogs[0] && dialogs[0].slice(0, 60));
  t(G, "The project validator also rejects that export (editor and build agree)", vBad.status === 1 && /B2\/question/.test(vBad.stdout) && /A1\/answer/.test(vBad.stdout), vBad.stdout.split("\n")[0]);
  for (const id of ["B2", "A3"]) { await page.evaluate((id) => document.querySelector(`#entry-${id} [data-act="revert"]`).click(), id); await sleep(200); }
  await typeInto("A1", "answer", "fr", a1fr, { replace: true });
  const fixed = await page.evaluate(() => window.__editor.totals());
  dialogs.length = 0;
  const jGood = await download("#export-json", ".json");
  writeFileSync(join(ROOT, "build", "_editor_export.json"), jGood.text);
  const vGood = spawnSync(process.execPath, ["scripts/validate.mjs"], { cwd: ROOT, env: { ...process.env, CARDS_FILE: "build/_editor_export.json" }, encoding: "utf8" });
  const doc = JSON.parse(jGood.text);
  const master = data.cards;
  const diffs = doc.cards.flatMap((c, i) => ["text_en", "text_fr"].filter((f) => c[f] !== master[i][f]).map((f) => `${c.id}/${c.card_type}/${f}`));
  const otherSame = doc.cards.every((c, i) => Object.keys(master[i]).every((k) => ["text_en", "text_fr"].includes(k) || JSON.stringify(c[k]) === JSON.stringify(master[i][k])));
  t(G, "After fixing, export needs no confirmation and the validator accepts the file", fixed.errors === 0 && dialogs.length === 0 && vGood.status === 0, vGood.stdout.split("\n")[0]);
  t(G, "Exported JSON changes only the edited text field; IDs, order, sources unchanged", diffs.join() === "A1/question/text_en" && otherSame && doc.cards.length === 180 && doc.cards[0].text_en.endsWith("(Edited by a colleague.)"), diffs.join(", "));
  const ch = await download("#export-changes", ".csv");
  t(G, "Change list (CSV) lists exactly the edited text", ch && ch.text.split("\r\n").filter(Boolean).length === 2 && ch.text.includes("A1,question,A,English"), ch && ch.name);
  rmSync(join(ROOT, "build", "_editor_export.json"), { force: true });

  // Import
  const imp = JSON.parse(readFileSync(join(ROOT, "data/cards.json"), "utf8"));
  imp.cards.find((c) => c.id === "C5" && c.card_type === "question").text_fr += " (import test)";
  imp.cards.find((c) => c.id === "C5" && c.card_type === "question").verification_note = "changed elsewhere";
  const IMP = join(ROOT, "build", "test-imports");
  mkdirSync(IMP, { recursive: true });
  const fGood = join(IMP, "import-good.json"), fBad = join(IMP, "import-bad.json"), fBroken = join(IMP, "import-broken.json");
  writeFileSync(fGood, JSON.stringify(imp, null, 2));
  const bad = JSON.parse(readFileSync(join(ROOT, "data/cards.json"), "utf8"));
  bad.cards.push({ ...bad.cards.find((c) => c.id === "E1"), card_type: "answer" });
  bad.cards = bad.cards.filter((c) => !(c.id === "D7" && c.card_type === "answer"));
  writeFileSync(fBad, JSON.stringify(bad));
  writeFileSync(fBroken, "{ not json");
  const upload = async (f) => { const input = await page.$("#import-file"); await input.uploadFile(f); await sleep(900); return page.evaluate(() => document.getElementById("notice").textContent.trim()); };
  dialogs.length = 0;
  const n1 = await upload(fGood);
  const after = await page.evaluate(() => ({ v: document.querySelector("#t-C5-question-fr").value, a1: document.querySelector("#t-A1-question-en").value, totals: window.__editor.totals() }));
  t(G, "Import JSON: text from the file is loaded (after confirming it replaces current edits)", after.v.endsWith("(import test)") && !after.a1.includes("colleague") && after.totals.editedCards === 1 && dialogs.length === 1, n1.slice(0, 90));
  t(G, "Import JSON: fields the editor does not manage (sources) are reported, not imported", /1 other field/.test(n1));
  const n2 = await upload(fBad);
  t(G, "Import rejects a file with a Gate E answer card or a missing card", /was not imported/.test(n2) && /Gate E must not have answer cards/.test(n2) && /Missing cards: D7 answer/.test(n2), n2.slice(0, 140));
  const n3 = await upload(fBroken);
  t(G, "Import rejects a file that is not valid JSON", /is not valid JSON/.test(n3), n3.slice(0, 80));

  // Filters
  await page.type("#search", "naples");
  await sleep(400);
  const sr = await page.evaluate(() => [...document.querySelectorAll(".entry")].filter((e) => !e.hidden).map((e) => e.dataset.id));
  t(G, "Search finds cards by text (accent- and case-insensitive)", sr.length >= 1 && sr.includes("A2"), sr.join(","));
  await page.evaluate(() => { const s = document.getElementById("search"); s.value = ""; s.dispatchEvent(new Event("input", { bubbles: true })); });
  await sleep(300);
  await page.click('.gate-tab[data-gate="E"]');
  const ge = await page.evaluate(() => [...document.querySelectorAll(".entry")].filter((e) => !e.hidden).map((e) => e.dataset.gate));
  t(G, "Gate tabs filter the list (Gate E: 20 cards)", ge.length === 20 && ge.every((g) => g === "E"));
  await page.click('.gate-tab[data-gate="all"]');
  await page.select("#show", "edited");
  const ed = await page.evaluate(() => [...document.querySelectorAll(".entry")].filter((e) => !e.hidden).map((e) => e.dataset.id));
  t(G, "“Edited cards” filter shows only edited cards", ed.join() === "C5", ed.join());
  await page.select("#show", "all");

  // Discard
  dialogs.length = 0;
  await page.click("#discard");
  await sleep(600);
  const disc = await page.evaluate(() => ({ totals: window.__editor.totals(), draft: localStorage.getItem("airport-gates-card-editor/v1") }));
  t(G, "“Discard all edits” asks first, then restores the master text and clears the draft", dialogs.length === 1 && disc.totals.editedCards === 0 && disc.draft === null);
  await page.close();

  // Mobile
  const mob = await newPage(ctx, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mob.goto(url("editor/index.html"), { waitUntil: "load" });
  await mob.waitForFunction(() => document.documentElement.dataset.editorReady === "1");
  const mw = await mob.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth, pane: getComputedStyle(document.getElementById("pane")).display }));
  await mob.evaluate(() => document.querySelector('#entry-B4 [data-act="preview"]').click());
  await sleep(300);
  const open = await mob.evaluate(() => ({ pane: getComputedStyle(document.getElementById("pane")).display, focus: document.activeElement.id, cards: document.querySelectorAll("#pane-cards .card.front").length, w: document.querySelector("#pane-cards .pv-face").getBoundingClientRect().width }));
  await mob.screenshot({ path: join(SHOTS, "editor-mobile-preview.png") });
  await mob.keyboard.press("Escape");
  await sleep(150);
  const closed = await mob.evaluate(() => getComputedStyle(document.getElementById("pane")).display);
  t(G, "Mobile (390 px): no horizontal scrolling; preview hidden until asked", mw.scroll <= mw.inner && mw.pane === "none", `${mw.scroll}px`);
  t(G, "Mobile: “Preview” opens the live card preview (focus on Close), Escape closes it", open.pane === "block" && open.focus === "pane-close" && open.cards === 2 && open.w >= 200 && closed === "none", JSON.stringify(open));
  await mob.close();
  await ctx.close();
}

await browser.close();
const ok = results.every((r) => r.ok);
writeOut("build/web-test-report.json", JSON.stringify({ generated: new Date().toISOString(), ok, passed: results.filter((r) => r.ok).length, total: results.length, results }, null, 2));
console.log(ok ? `✓ Web tests: ${results.length}/${results.length} passed (screenshots in build/screenshots/)` : `✗ Web tests: ${results.filter((r) => !r.ok).length} failed`);
if (!ok) process.exit(1);
