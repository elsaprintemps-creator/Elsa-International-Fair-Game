# International Fair — "Airport Gates" card game

A bilingual (English / French) question-card game for the university International Fair. Students "check in" at five airport gates and swap cultural knowledge and real experiences of studying abroad. The questions are drawn from the destinations of our exchange partners (`University Partners.xlsx`).

| Gate | Theme | Cards |
|---|---|---|
| **A** | Food, Language & Traditions · *Cuisine, langues & traditions* | 20 questions + 20 answers |
| **B** | Campus Life & City Information · *Vie de campus & infos pratiques* | 20 questions + 20 answers |
| **C** | Random Questions & General Knowledge · *Questions surprises & culture générale* | 20 questions + 20 answers |
| **D** | Games from Countries & Culture Shock · *Jeux du monde & choc culturel* | 20 questions + 20 answers |
| **E** | Student Advice: Living Abroad, Adapting & Making Friends · *Conseils d'étudiants* | 20 open discussion prompts, **no answer cards** |

**180 physical cards** in total: 100 question cards and 80 answer cards. Each answer card has the same ID as its question (question `A1` ↔ answer `A1`). The finished size is 56 × 87 mm (the size commonly reported for UNO cards; see [Card size](#card-size)), with 3 mm bleed.

**For colleagues (no software needed, just a browser):**

- **See the cards:** open [`preview/preview_gallery.html`](preview/preview_gallery.html). Every card starts face down; click one to flip it.
- **Edit the questions:** open [`editor/index.html`](editor/index.html), make your changes, then click **Export JSON** and send the file to the coordinator. See [Editing the cards in the browser](#editing-the-cards-in-the-browser-for-colleagues).
- **Send to the print department:** `exports/cards_print_shop.pdf` and `exports/print_specifications.pdf`. See [Printing](#printing).
- **Print cheaply and cut by hand:** `exports/cards_manual_cut_A3.pdf`, card fronts only on 10 A3 sheets. **Print at 100 % / Actual size and check the size with a ruler first.** See [A3 sheets to cut by hand](#a3-sheets-to-cut-by-hand-fronts-only).

## What's in the folder

```
exports/cards_print_shop.pdf      ← for the print department (1 card side per page, bleed, crop marks, bookmarks)
exports/cards_home_print_A4.pdf   ← print at home/office (A4, two-sided, with guide + alignment test)
exports/cards_manual_cut_A3.pdf   ← low-cost: card fronts only, 18 per A3 sheet, print one-sided and cut by hand
exports/print_specifications.pdf  ← print specification sheet for the print department (also docs/PRINT_SPECIFICATIONS.md)
preview/preview_gallery.html      ← animated design preview: cards face down, click to flip; download buttons for the 4 PDFs
editor/index.html                 ← question editor for colleagues (runs in the browser, exports JSON/CSV)
QC_REPORT.md                      ← counts, automated checks, sources, open issues
cards_source.zip                  ← everything below + PDFs, ready to hand over

data/cards.json               ← ★ THE source of truth: all card text, sources, verification notes
data/cards.csv                ← generated flat export (opens in Excel; do not edit — it is overwritten)
data/partners.json            ← partner list → resolved city/country, ambiguities flagged
config/print-settings.json    ← card size, bleed, margins, colour/PDF settings, sheet layout, duplex flip
.env.example / .env.local     ← optional CHROME_PATH (no secrets; .env.local is git-ignored)
design/tokens.css             ← colour palette + fonts (single place to change colours)
design/fonts.css              ← self-hosted font declarations
assets/backs/*.svg            ← the five editable card-back designs
assets/fonts/                 ← Atkinson Hyperlegible + Barlow Condensed (SIL OFL) + licences
src/templates.mjs             ← card front/back HTML templates (used by the PDFs, the preview and the editor)
src/cards.css                 ← card front layout
src/cards-ink-saver.css       ← lighter-ink colours for the A3 manual-cut sheets only
src/icons.mjs                 ← small vector glyphs (badge icons, plane, arrow, decorative barcode)
src/rules.mjs                 ← content rules shared by the build and the editor
src/data-io.mjs               ← JSON/CSV formats shared by the build and the editor's exports
src/autofit.js                ← in-browser text fitting + overflow checks
preview/, editor/             ← the two web pages; their generated/ folders are rebuilt by `npm run build`
preview/media/fges-air-fair-a350.webp ← header plane artwork, "FGES Air Fair" with a French-flag tail (generated with Higgsfield); flown by preview/flight.js + preview.css
scripts/                      ← validate · build · build-web · render-pdf · check-pdf · print-spec · test-web · import-edits · …
docs/prototype.png            ← design prototype (Gate A Q+A, a Gate E card, all five backs)
```

## Setup

You need **Node.js 22 or newer** and **Google Chrome, Microsoft Edge or Chromium** installed (used headless to render the PDFs; nothing is downloaded).

```bash
npm install
npm run build
```

`npm run build` runs, in order:

1. `validate`: content checks (counts, IDs, pairs, translations, multiple-choice letters, duplicates, palette, backs). The build **stops** if anything fails.
2. `build:html`: regenerates the print layouts in `build/` and `data/cards.csv`.
3. `build:web`: regenerates `preview/generated/` and `editor/generated/` (card templates, fonts, data) and checks that the browser renders every card exactly like the PDFs.
4. `build:pdf`: renders the PDFs into `exports/`, sets the print-shop TrimBox/BleedBox and bookmarks, and checks text fit, fonts actually used, the preview and the duplex mapping.
5. `check:pdf`: re-opens the finished PDFs with two independent parsers and checks validity, page sizes, boxes on every page, font embedding, image resolution, card counts, the front→back mapping (read back from the printed text) and duplex mirroring.
6. `build:a3`: builds the A3 manual-cut PDF (`exports/cards_manual_cut_A3.pdf`), then re-opens it and measures every card (`check:a3`, results in `docs/QC_MANUAL_CUT_A3.md`). See [A3 sheets to cut by hand](#a3-sheets-to-cut-by-hand-fronts-only).
7. `spec`: writes the print specification sheet (`exports/print_specifications.pdf`, `docs/PRINT_SPECIFICATIONS.md`).
8. `test:web`: browser tests of the preview and the editor (flip, keyboard, reduced motion, mobile, editing, exports, imports).
9. `prototype`: refreshes `docs/prototype.png`.
10. `qc`: rewrites `QC_REPORT.md` from the results.
11. `package`: rebuilds `cards_source.zip`.

`npm run snapshots` renders a few pages of the finished PDFs to PNG in `build/snapshots/` for a quick visual proof.

### Environment file (optional)

The project needs **no API keys or secrets**. The only environment setting is `CHROME_PATH`, the browser used to render the PDFs. If you leave it empty, the build finds Chrome, Edge or Chromium automatically.

```bash
cp .env.example .env.local    # then edit CHROME_PATH if auto-detection fails
```

- `.env.example`: the documented template (tracked, included in the ZIP).
- `.env.local`: your machine's values (git-ignored, never packaged).

The scripts load `.env.local`, then `.env`. Order of precedence: a variable set in the shell, then `.env.local`, then `.env`, then `browser.executable_path` in `config/print-settings.json`.

## Editing the cards in the browser (for colleagues)

No installation and no VS Code needed: the editor is a plain web page.

1. **Open** `editor/index.html` in Chrome, Edge, Firefox or Safari (double-click the file, or use the university web address if it has been put online; see [Hosting](#hosting-the-preview-and-the-editor)).
2. **Find a card** with the gate buttons (All, A–E), the search box (ID, topic or any word of the text) or **Show → Edited cards / Cards that need attention**. Each card shows its ID (e.g. `B7`), gate, topic and destination.
3. **Edit** the English and French text. Gates A–D show the question card and its matching answer card (same ID) side by side; Gate E shows the discussion question only, because Gate E has no answer cards. A live preview shows the printed card. Checks run as you type, and these are **errors**:
   - English or French text is empty.
   - The French is a copy of the English.
   - The text contains a web link.
   - The multiple-choice options differ between EN and FR.
   - The answer does not start with the same correct letter in both languages.
   - The text is too long to fit on the card, even at the smallest size.
   - A question is a near-duplicate of another one in the same gate.

   Long text, French punctuation spacing and similar points are shown as **to check**. These are the same rules the build applies.
4. **Your edits are saved automatically in this browser, on this computer only.** Nothing is sent anywhere. Other people cannot see your edits, a different computer or browser will not have them, and clearing browser data deletes them. The status bar says "Saved in this browser only" and "Not exported yet" until you export.
5. **Export** when you are done:
   - **Export JSON** is the file to send to the coordinator. It is a complete replacement for `data/cards.json`.
   - **Export CSV** gives the same content for Excel.
   - **Change list** is a CSV of only what you changed (old text and new text), which makes reviews quick.
6. **Import JSON…** reloads a previously exported file (to continue on another computer, or to review a colleague's file). Only question/answer text is imported; files with missing, extra or Gate E answer cards are rejected.

The page cannot write to the project files (browsers don't allow it), so edits only reach the printed cards through the coordinator's step below.

### Replacing the project data safely (coordinator)

```bash
npm run import-edits -- "C:/Downloads/cards_2026-10-10_1432.json" --dry-run   # show the changes + validate, change nothing
npm run import-edits -- "C:/Downloads/cards_2026-10-10_1432.json"             # back up, then replace data/cards.json
npm run build                                                                   # regenerate PDFs, preview, editor
```

`import-edits` checks that the file has exactly the same cards (IDs, types, gates). It takes **only** the question/answer text from the file, so sources and notes in `data/cards.json` are kept. It then validates the result on a temporary copy and, only if that passes, saves the old file to `data/backups/` before writing the new one. If two colleagues edited at the same time, import one file, rebuild, then open the editor, import the second file and use **Change list** to merge by hand.

If you changed a *fact*, update `source_urls` / `verification_note` for that card in `data/cards.json`. The editor shows these sources but does not edit them.

## Editing `data/cards.json` directly

Open `data/cards.json`. Each card is one record:

```json
{
  "id": "A10",
  "card_type": "question",          // "question" or "answer"
  "gate": "A",
  "topic": "Food",
  "destination": "Portugal — Porto",
  "text_en": "What is Portugal's famous little custard tart … called? A) pastel de nata B) … C) …",
  "text_fr": "Comment s'appelle la célèbre petite tarte portugaise … ? A) le pastel de nata B) … C) …",
  "pair_id": "A10",                 // matching answer ID (null for Gate E)
  "source_urls": ["https://…"],     // internal only, never printed
  "verification_status": "web-checked",
  "verification_note": "…",
  "last_checked": "2026-10-10"
}
```

- **Change a question:** edit `text_en` / `text_fr` on the `question` record. Then edit the `answer` record with the same `id`.
- **Gate E:** questions only. Do not add answer records; validation will fail if you do.
- **Multiple choice:** end a question with ` A) … B) … C) …` and each option is printed on its own line. Start the answer card with the correct letter, and vary which letter is correct.
- **Keep it short.** Text shrinks automatically to fit (down to `text_fit.min_pt`, 7 pt). If it still doesn't fit, `build:pdf` fails and names the card. Aim for about 150 characters per language on question cards and about 80 on answer cards.
- **Typography is automatic.** Straight quotes become curly quotes. French gets non-breaking spaces before `? ! : ;` and inside `« »`. Short hyphenated words such as "Qu'as-tu" never split across lines.
- **Sources** go in `source_urls` and `verification_note`, never in the card text. Set `verification_status` to `web-checked` (with at least one URL) or `general-knowledge`.
- Run `npm run build`, then check `preview/preview_gallery.html`.

To preview a few cards quickly: `node scripts/prototype.mjs B7 B7:answer E3`. This writes `docs/prototype.png`.

## Design preview (flip gallery)

`preview/preview_gallery.html` is for showing colleagues how the finished cards look. It is a review page; it does not edit anything.

- Every card starts **face down**, showing its gate's real back design. **Click a card to flip it** (a 3D turn). Click again to turn it back. Keyboard users press Tab to reach a card, then Enter or Space.
- The **departures board** at the top filters by gate. **Show** switches between all cards, questions and answers (Gate E has questions only). **Card size** sets S/M/L. **Flip all to fronts** and **Reset all to backs** turn every card. **Print guides** shows the bleed, trim line and safe area.
- The current gate/filter is kept in the address (e.g. `…/preview_gallery.html#gate=B&show=answer`), so you can send a link to one gate.
- With "reduce motion" switched on in the operating system, cards change sides instantly, without animation.
- The page uses the same card templates, fonts, colours, back artwork and text-fitting code as the PDFs. The build verifies that all 180 cards render identically.

## Hosting the preview and the editor

Both pages are static files with no database, no login and no server code. `preview/` and `editor/` are each self-contained: copy either folder (including its `generated/` subfolder) to any web space, e.g. the university website, and open `preview_gallery.html` or `index.html`. They also work straight from the disk (double-click). After any change to the cards or design, run `npm run build` and upload the folders again. Each folder's `generated/` contains a copy of the card data from the last build.

## Changing print settings (`config/print-settings.json`)

| Setting | Default | Notes |
|---|---|---|
| `card.trim_width_mm` / `trim_height_mm` | 56 / 87 | Finished card size. Use the print shop's size if it gives one. |
| `card.bleed_mm` | 3 | Extra artwork beyond the cut line. |
| `card.safe_margin_mm` | 3.5 | No text closer than this to the cut line. |
| `text_fit.*` | — | Starting font sizes and the minimum size. |
| `home_print.columns` / `rows` | 3 × 3 | Cards per A4 sheet (with bleed: 186 × 279 mm). |
| `home_print.include_bleed` | true | `false` = cards edge-to-edge without bleed (one cut between cards, less tolerant). |
| `home_print.duplex_flip` | `long-edge` | Must match the printer dialog (`long-edge` or `short-edge`). |
| `home_print.back_offset_x_mm` / `_y_mm` | 0 / 0 | Corrects a printer's duplex shift, measured on the alignment test. |
| `print_shop.slug_mm` | 8 | Space around the bleed for crop marks. |
| `print_shop.crop_marks` / `crop_mark_offset_mm` | true / 3 | Crop marks on/off; distance of the marks from the trim line (must be ≥ bleed). |
| `print_shop.page_order` | `front-back-interleaved` | Or `fronts-then-backs` (pages 1–180 fronts, 181–360 backs in the same order). |
| `print_shop.set_pdf_boxes` | true | Writes TrimBox/BleedBox into every page. |
| `color.*` | RGB | The colour request printed on the spec sheet (profile, proof). The PDF itself is always RGB; see [Printing](#printing). |
| `pdf.min_image_ppi` | 300 | Minimum effective resolution for any raster image (there are none today). |
| `pdf.allowed_extra_fonts` | `[]` | The build fails if anything is drawn in a font other than the two project fonts (e.g. Greek or CJK letters that they lack). List a font family here to accept it knowingly. |
| `pdf.add_bookmarks` | true | PDF bookmarks per gate and card type. |
| `spec_sheet.*` | — | Where the specification sheet is written, and the contact line printed on it. |
| `manual_cut_a3.orientation` | `auto` | A3 manual-cut sheets: `auto` picks the orientation that fits more cards (landscape: 6 × 3 = 18; portrait: 4 × 4 = 16). Card size always comes from `card.trim_width_mm` / `trim_height_mm`. |
| `manual_cut_a3.cut_gap_mm` / `min_cut_gap_mm` | 6 / 4 | Blank strip between neighbouring cards, and the smallest gap the check accepts. |
| `manual_cut_a3.min_page_margin_mm` | 10 | No card closer than this to the paper edge. |
| `manual_cut_a3.cut_line_stroke_mm` | 0.25 | Width of the cut outline, drawn entirely outside each card. |
| `manual_cut_a3.packing` | `continuous` | `continuous` fills every sheet (10 sheets); `gate-pure` puts one gate per sheet (14 sheets). |
| `manual_cut_a3.ink_saver` | true | White header with a thin rule instead of solid navy/yellow bands. `false` = exactly the artwork of the other PDFs. |
| `manual_cut_a3.include_instructions` | true | Page 1: print guide, test card, 200 mm ruler and sheet map. |

The card backs are SVGs drawn on a 62 × 93 mm artboard. If you change the card's proportions, they scale to fill the new size (`slice`), so check them in the preview with **Print guides** on.

### Card size

56 × 87 mm is the size commonly reported for UNO cards by retailers and accessory makers. **It is not an official Mattel/UNO specification** (none was found, and one design guide says 56 × 88 mm), and the game is not affiliated with UNO. If the print department cuts a standard size (e.g. poker 63.5 × 88.9 mm, bridge 57.2 × 88.9 mm), set `card.trim_width_mm` / `trim_height_mm` and rebuild: the layout is in millimetres, and text fitting and all checks rerun.

## Printing

**At the university print department:** send `exports/cards_print_shop.pdf` together with `exports/print_specifications.pdf`.

- **The print file:** 360 pages, each 78 × 109 mm, i.e. the 62 × 93 mm artwork (56 × 87 mm trim + 3 mm bleed) plus an 8 mm slug with crop marks. Front and back alternate, and every back is its own gate's design. TrimBox/BleedBox and bookmarks are set. All fonts are embedded subsets of the two project fonts, and all artwork is vector.
- **The specification sheet:** lists exactly that, plus page ranges per gate and a checklist of what the department must confirm.
- **Not yet confirmed by the department:** size, bleed, crop marks, file format and colour profile (the file is RGB, not PDF/X or CMYK), page order or imposition, stock, finish, corner rounding, quantity, and a proof. Adjust the settings above and rebuild if they ask for something different.

**At home or in the office:** see pages 1–2 of `exports/cards_home_print_A4.pdf`.

1. Print the **alignment test (pages 3–4)** two-sided first. Use 100 % scale, flip on the long edge.
2. Hold the sheet up to the light. The crosses should overlap, and the TOP arrows should point the same way.
3. Print pages 5–50 two-sided.
4. Cut along the crop marks on the front side. With bleed there are two cuts 6 mm apart between neighbouring cards.

Duplex safety: each sheet holds **one gate only**, and backs are printed in every position. If the flip setting is wrong, a back can only end up rotated, never on another gate's card.

**At another print shop:** the same two files apply. The defaults are generic professional settings, so confirm the shop's requirements first.

### A3 sheets to cut by hand (fronts only)

For when professional card printing is unavailable, too expensive or too slow: `exports/cards_manual_cut_A3.pdf`. Print it once, one-sided, on ordinary or heavier paper, and cut the cards out by hand. There are no card backs and no duplex alignment.

> **Print at 100 % / "Actual size" and turn page scaling OFF** ("Fit to page", "Shrink oversized pages", "Scale to fit"). **Before printing the full set, print page 1 and check the size with a ruler.**

- **What's in it:** page 1 is the print guide, with a test card, a 200 mm ruler and a sheet map. Pages 2–11 hold all **180 card fronts** (100 question cards + 80 answer cards; Gate E has questions only), 18 per A3 sheet (landscape, 6 × 3). Every card is exactly **56 × 87 mm**.
- **Check the size:** print page 1 only. Measure the test card from the inner edges of its line: **56 mm wide, 87 mm tall**. The ruler must measure 200 mm. If anything is off by more than 1 mm, the printer is scaling the page: fix the scale/paper settings and test again. Each card sheet also has a 100 mm scale bar in its bottom margin. The PDF asks viewers for no scaling and one-sided printing (`PrintScaling None`, `Duplex Simplex`), but not every viewer or printer driver follows this, so always measure.
- **Printer settings:** A3 paper, orientation Auto or Landscape, scale 100 %, one-sided, colour, normal quality.
- **Paper:** best is matte card stock, 200–250 g/m², if the printer's bypass/manual tray accepts it (check its maximum paper weight). Heavy paper, 160–200 g/m², is good. Ordinary 80–120 g/m² paper also works: glue the printed sheet onto thin card before cutting, or laminate the cut cards. Matte paper avoids glare.
- **Cutting:** a paper trimmer or guillotine is fastest; otherwise use a metal ruler and craft knife on a cutting mat (scissors also work). Each card has its own thin navy outline drawn **just outside** the card: cut along the inner edge of the line. The line and the 6 mm strip between two cards are waste. Cut the sheet into rows first, then trim each card.
- **Sorting:** the top margin of every sheet lists its contents (e.g. *Gate A answers A17–A20 · Gate B questions B1–B14*). Page labels sit in the margins, never on a card. On the card, the gate is top left and the ID top right. Answer cards have a pale-yellow header labelled **ANSWER · RÉPONSE** and the same ID as their question.
- **Ink:** the sheets use an ink-saver version of the same design (`src/cards-ink-saver.css`). Same text, layout and palette, but the header is white with a thin navy rule instead of a solid navy band, and answer cards have a pale-yellow header with a yellow rule on a white card (instead of a solid yellow header on a pale-yellow card). Set `manual_cut_a3.ink_saver` to `false` to print the exact artwork of the other PDFs.
- **Same source:** the sheets are built from `data/cards.json` with the same card template as every other output, so edits stay consistent. `npm run build` includes them; `npm run build:a3` rebuilds only this PDF.
- **Verification:** `npm run check:a3` re-opens the finished PDF with pdf.js and pdf-lib. It measures page size, every card's cut outline and artwork clip box, gaps, margins and text positions, reads back all 180 card IDs with their English and French text, and confirms there are no backs and only embedded project fonts. Results: `docs/QC_MANUAL_CUT_A3.md`. These checks prove the file is drawn at the right size. Only the ruler test shows what your printer does with it.

## Design system

- **Palette (only):** navy `#0B2545`, deep teal `#0B6F79`, turquoise `#1FB5BE`, yellow `#FFC93C`, white `#FFFFFF`, Bordeaux `#6D071A` (Gate E), plus two tints of the same hues (`#D9F2F4`, `#FFF6DB`). Change colours in `design/tokens.css`. The SVG backs read these variables when they are inlined, and fall back to the same values when opened on their own. Validation rejects any other hex colour in the artwork files. The one exception is the small 🇬🇧 / 🇫🇷 flags in front of the English and French text (`flag` in `src/icons.mjs`): they keep their real colours so students can tell at a glance which sentence is which language.
- **Fronts** follow a boarding-pass layout:
  - a header with the gate badge, card type and ID chip;
  - a category strip;
  - the English text (bold, with a 🇬🇧 flag), a flight-path divider, then the French text (with a 🇫🇷 flag);
  - a tear-off footer that points to the matching card.
- **Answer cards** have a yellow header and a pale yellow background.
- **Backs:** five minimalist designs with one shared structure (frame, plane and flight path, "INTERNATIONAL FAIR", motif disc, GATE letter, category). Each gate has one motif and one accent glyph:

  | Gate | Motif | Accent |
  |---|---|---|
  | A | plate and utensils | speech bubble |
  | B | campus building | map pin |
  | C | light bulb with "?" | sparkle |
  | D | die | turning arrows |
  | E | two speech bubbles | compass |

- **Canva:** the SVGs in `assets/backs/` import directly, and their text stays live. Card text is never baked into images.

## Licences and asset sources

- **Fonts:** [Atkinson Hyperlegible](https://brailleinstitute.org/freefont) (Braille Institute) and [Barlow Condensed](https://github.com/jpt/barlow) (Jeremy Tribby). Both are SIL Open Font License 1.1, installed via the `@fontsource` npm packages. The licence texts are in `assets/fonts/`.
- **Icons, card backs, plane glyph and barcode ornament:** drawn for this project as simple SVG paths. No third-party icon sets, stock images or AI-generated images are used.
- **npm dependencies:** `puppeteer-core` (Apache-2.0), `pdf-lib` (MIT) and `pdfjs-dist` (Apache-2.0, used only by the build to inspect the finished PDFs). The preview and editor pages use no external libraries or CDNs.

## Content principles

- Facts are checked against reliable sources where possible. The status of every card and its URLs are in `data/cards.json`, and the full table is in `QC_REPORT.md`.
- University-specific claims are limited to verified history; no policies, services or opening hours are stated. Ambiguous partner names and campuses are flagged in `data/partners.json` and never used for campus-specific facts.
- Customs are described as traditions or common practices, never as what "everyone" in a country does. Culture shock is presented as varied and personal.
- French is written as natural French in the friendly *tu* register, not as literal translation.
