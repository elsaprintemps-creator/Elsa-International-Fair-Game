# QC Report — International Fair "Airport Gates" card game

_Generated automatically by `npm run build` on 2026-10-10. Manual review notes are maintained in `scripts/qc-report.mjs`._

**Overall automated status: ✅ all automated checks passed** — 68/68 content checks, 18/18 render/layout checks, 28/28 finished-PDF inspection checks, 52/52 browser tests (preview + editor).

## 1. Card counts

| Gate | Theme | Questions | Answers |
|---|---|---:|---:|
| A | Food, Language & Traditions | 20 | 20 |
| B | Campus Life & City Information | 20 | 20 |
| C | Random Questions & General Knowledge | 20 | 20 |
| D | Games from Countries & Culture Shock | 20 | 20 |
| E | Student Advice: Living Abroad, Adapting & Making Friends | 20 | 0 |
| **Total** | | **100** | **80** |

- Question cards: **100** (20 per gate × 5)
- Answer cards: **80** (Gates A–D only); matched question–answer pairs: **80**
- Gate E: 20 open-ended discussion cards, **0 answer cards, 0 model answers**
- **Physical cards: 180**

## 2. Automated content validation (`scripts/validate.mjs`)

- ✅ Gate A: exactly 20 question cards
- ✅ Gate B: exactly 20 question cards
- ✅ Gate C: exactly 20 question cards
- ✅ Gate D: exactly 20 question cards
- ✅ Gate E: exactly 20 question cards
- ✅ Gate A: exactly 20 answer cards
- ✅ Gate B: exactly 20 answer cards
- ✅ Gate C: exactly 20 answer cards
- ✅ Gate D: exactly 20 answer cards
- ✅ Gate E: zero answer cards
- ✅ Total question cards = 100
- ✅ Total answer cards = 80
- ✅ Total physical cards = 180
- ✅ Only valid card types
- ✅ Only valid gates
- ✅ No duplicate question IDs
- ✅ No duplicate answer IDs
- ✅ Gate A: question IDs A1–A20 complete, no gaps
- ✅ Gate A: every ID starts with its gate letter
- ✅ Gate B: question IDs B1–B20 complete, no gaps
- ✅ Gate B: every ID starts with its gate letter
- ✅ Gate C: question IDs C1–C20 complete, no gaps
- ✅ Gate C: every ID starts with its gate letter
- ✅ Gate D: question IDs D1–D20 complete, no gaps
- ✅ Gate D: every ID starts with its gate letter
- ✅ Gate E: question IDs E1–E20 complete, no gaps
- ✅ Gate E: every ID starts with its gate letter
- ✅ Gate A: 20 matched question–answer pairs
- ✅ Gate B: 20 matched question–answer pairs
- ✅ Gate C: 20 matched question–answer pairs
- ✅ Gate D: 20 matched question–answer pairs
- ✅ No unmatched answer cards
- ✅ Gate E questions have no pair_id (no answer card)
- ✅ Gate E: no model answers stored on question records
- ✅ Every card has English AND French text
- ✅ French text is not a copy of the English
- ✅ No URLs or citations on card faces
- ✅ Multiple-choice options match in EN/FR and answers start with the same correct letter
- ✅ No other text errors
- ✅ No duplicate or near-duplicate questions within a gate
- ✅ No identical questions across gates
- ✅ Gate A: every question topic matches the gate theme
- ✅ Gate B: every question topic matches the gate theme
- ✅ Gate D: every question topic matches the gate theme
- ✅ Gate D mixes games and culture-shock questions
- ✅ Every web-checked fact records at least one source URL
- ✅ Every factual card has a verification status and note
- ✅ Source URLs are well-formed https links
- ✅ Exactly five back SVGs exist
- ✅ Back filenames match the required names
- ✅ Back for Gate A is labelled with its own gate letter
- ✅ Back for Gate A carries no question/answer text
- ✅ Back for Gate B is labelled with its own gate letter
- ✅ Back for Gate B carries no question/answer text
- ✅ Back for Gate C is labelled with its own gate letter
- ✅ Back for Gate C carries no question/answer text
- ✅ Back for Gate D is labelled with its own gate letter
- ✅ Back for Gate D carries no question/answer text
- ✅ Back for Gate E is labelled with its own gate letter
- ✅ Back for Gate E carries no question/answer text
- ✅ Artwork uses only the approved palette (navy, teal, turquoise, yellow, white, Bordeaux + tints)
- ✅ Card trim/bleed/safe values are positive
- ✅ Duplex flip is long-edge or short-edge
- ✅ Print-shop crop marks sit outside the bleed
- ✅ Print-shop slug fits the crop marks
- ✅ Print-shop page order is a known option
- ✅ Safe margin keeps text inside the trim
- ✅ Gate list matches A–E with a back file each

Warnings for manual review: none.

## 3. Layout, PDF and print checks (`scripts/render-pdf.mjs`)

- ✅ Home PDF opens and has the expected page count (50 pages, expected 50)
- ✅ Home PDF pages are A4 (210 × 297 mm) (209.89 × 297.01 mm)
- ✅ Print-shop PDF opens and has 2 pages per card (360) (360 pages)
- ✅ Print-shop page = card + bleed + slug (77.98 × 109.05 mm)
- ✅ Print-shop TrimBox = configured trim size (56 × 87 mm)
- ✅ Print-shop BleedBox = trim + 2 × bleed (62 × 93 mm)
- ✅ Every card's text fits inside the safe area (preview, home PDF, print-shop PDF)
- ✅ No clipped labels (header, category, footer)
- ✅ Smallest body text ≥ configured minimum
- ✅ Fonts loaded in every render
- ✅ Only the project fonts are used (Atkinson Hyperlegible, Barlow Condensed) — no system-font fallback
- ✅ No script errors while rendering
- ✅ Web preview shows all 180 fronts (180)
- ✅ Web preview: every card has its own gate's back, front matches its ID/type, and all start face down (180 backs; gate match true; front match true; face down true)
- ✅ Home print renders every card front exactly once (180)
- ✅ Duplex map: every front lands on its own gate's back (long-edge flip)
- ✅ Gate-pure sheets: one gate per sheet
- ✅ Home print: the cut marks fit on the paper (margin ≥ mark offset + length + 3 mm printer edge) (margins 12 × 9 mm)

**Text fit.** Fonts start at 9.2/8.6 pt (questions, EN/FR) and 12/11.2 pt (answers) and may only shrink to 7 pt. Smallest sizes actually used: questions 7.6 pt EN / 7.1 pt FR; answers 11.2 pt EN / 10.45 pt FR. Cards that needed shrinking: A1 (Q), A3 (Q), A4 (Q), A5 (Q), A8 (Q), A10 (Q), A11 (Q), A13 (Q), A15 (Q), A16 (Q), A18 (Q), A19 (Q), A20 (Q), B2 (Q), B3 (Q), B5 (Q), B6 (Q), B8 (Q), B10 (Q), B11 (Q), B13 (Q), B14 (Q), B15 (Q), B16 (Q), B17 (Q), B19 (Q), B20 (Q), C3 (Q), C5 (Q), C6 (Q), C7 (Q), C9 (Q), C12 (Q), C13 (Q), C15 (Q), C18 (Q), C20 (Q), D1 (Q), D4 (Q), D5 (Q), D6 (Q), D7 (Q), D8 (Q), D9 (Q), D10 (Q), D11 (Q), D12 (Q), D13 (Q), D15 (Q), D17 (Q), D18 (Q), D19 (Q), A8 (A), A13 (A), C8 (A), D17 (A), D18 (A), D19 (A). All text boxes sit inside the 3.5 mm safe margin by construction, and overflow is measured in the browser on every card in all three renders (gallery, home PDF, print-shop PDF).

**Geometry.** Trim 56 × 87 mm, bleed 3 mm (artwork 62 × 93 mm), safe margin 3.5 mm.
- Home PDF: 50 A4 pages = 2 instruction pages + 2 alignment-test pages + 23 duplex card sheets (front/back pairs). 3 × 3 cards per sheet with bleed, margins 12 mm (left/right) × 9 mm (top/bottom); crop marks in the margins of the front side.
- Print-shop PDF: 360 pages of 77.98 × 109.05 mm (card + bleed + 8 mm slug), front/back interleaved; crop marks 3 mm outside the trim (i.e. outside the bleed); TrimBox 56 × 87 mm and BleedBox 62 × 93 mm set on every page.

**Duplex plan.** Layout for **long-edge** flip. Sheets are *gate-pure* (A: 5 · B: 5 · C: 5 · D: 5 · E: 3), so every back on a sheet shows the same gate design; backs are mirrored per the flip edge and printed in all 9 positions, so even a wrong flip choice cannot pair a front with another gate's back (it can only rotate the back artwork). The grid is centred on the page, so mirrored positions coincide exactly. An alignment test sheet (pages 3–4) with 1 mm rulers lets users measure their printer's duplex shift; `back_offset_x_mm` / `back_offset_y_mm` compensate it.

**Preview fidelity.** `preview/preview_gallery.html` and `editor/index.html` draw cards with a browser bundle generated from the same `src/templates.mjs`, `src/cards.css`, fonts, tokens and SVG backs as the PDFs. At build time the bundle is executed in a sandbox and its output is compared with the print templates for all 180 fronts and 5 backs (byte-identical), and the preview is rendered in Chrome with the same text-fitting code (180 fronts, all fitting).

**Fonts.** Chrome's DevTools font report is read for every text node in all three renders: only Atkinson Hyperlegible and Barlow Condensed are used, so no system font (e.g. Arial Narrow, Segoe UI) is substituted. Arrows (→, ▲) on cards and print guides are drawn as vector paths for this reason.

## 3b. Finished-PDF inspection (`scripts/check-pdf.mjs`)

The exported files are re-opened with two independent parsers (pdf-lib and pdf.js) and checked page by page; card identity and back design are read back from the text actually printed on each page.

- ✅ [method] Self-test: the image-resolution check detects a 150 ppi test image ([{"page":1,"px":[150,150],"placed_mm":[25.4,25.4],"ppi":[150,150]}])
- ✅ [print-shop] exports/cards_print_shop.pdf: valid PDF header and end-of-file marker (%PDF-1.7, EOF true)
- ✅ [print-shop] exports/cards_print_shop.pdf: strict parse with pdf-lib (360 pages)
- ✅ [print-shop] exports/cards_print_shop.pdf: independent parse with pdf.js, no warnings (360 pages)
- ✅ [print-shop] exports/cards_print_shop.pdf: page count (360, expected 360)
- ✅ [print-shop] exports/cards_print_shop.pdf: every page is 78 × 109 mm (77.98 × 109.05 mm)
- ✅ [print-shop] exports/cards_print_shop.pdf: all fonts embedded (8 font resources, all embedded (FontFile2))
- ✅ [print-shop] exports/cards_print_shop.pdf: only the project font families (BarlowCondensed-ExtraBold, BarlowCondensed-Bold, BarlowCondensed-SemiBold, AtkinsonHyperlegible-Italic, AtkinsonHyperlegible-Bold, AtkinsonHyperlegible-Regular)
- ✅ [print-shop] exports/cards_print_shop.pdf: raster images ≥ 300 ppi at placed size (no raster images — all artwork and text are vector (0 image objects in file))
- ✅ [print-shop] TrimBox 56 × 87 mm and BleedBox (+3 mm each side) on every page, inside the page (360 pages)
- ✅ [print-shop] PDF bookmarks per gate and card type
- ✅ [print-shop] Every page's printed content matches its planned card and side (slug, gate, ID, type label)
- ✅ [print-shop] Each of the 180 cards has exactly one front page and one back page
- ✅ [print-shop] Odd pages are fronts; each is followed by its own gate's back
- ✅ [print-shop] Card counts in the PDF: 100 question cards, 80 answer cards (A–D), 0 Gate E answers, 180 total (100 Q, 80 A, 0 E answers, 180 cards)
- ✅ [home-A4] exports/cards_home_print_A4.pdf: valid PDF header and end-of-file marker (%PDF-1.7, EOF true)
- ✅ [home-A4] exports/cards_home_print_A4.pdf: strict parse with pdf-lib (50 pages)
- ✅ [home-A4] exports/cards_home_print_A4.pdf: independent parse with pdf.js, no warnings (50 pages)
- ✅ [home-A4] exports/cards_home_print_A4.pdf: page count (50, expected 50)
- ✅ [home-A4] exports/cards_home_print_A4.pdf: every page is 210 × 297 mm (209.89 × 297.01 mm)
- ✅ [home-A4] exports/cards_home_print_A4.pdf: all fonts embedded (8 font resources, all embedded (FontFile2))
- ✅ [home-A4] exports/cards_home_print_A4.pdf: only the project font families (BarlowCondensed-Bold, BarlowCondensed-ExtraBold, AtkinsonHyperlegible-Italic, AtkinsonHyperlegible-Regular, AtkinsonHyperlegible-Bold, BarlowCondensed-SemiBold)
- ✅ [home-A4] exports/cards_home_print_A4.pdf: raster images ≥ 300 ppi at placed size (no raster images — all artwork and text are vector (0 image objects in file))
- ✅ [home-A4] Alignment test: back marks sit behind the front marks for long-edge flip (measured in the PDF) (worst deviation 0.11 mm)
- ✅ [home-A4] Every front is printed in its planned slot and every back shows the sheet's own gate (read from the PDF)
- ✅ [home-A4] Backs are centred on their slots (gate letter within 1 mm of the slot centre) (worst 0.10 mm)
- ✅ [home-A4] Each back slot is the mirror of its front slot for long-edge flip (worst 0.000 mm)
- ✅ [home-A4] PDF bookmarks (guide, alignment test, gates)

Embedded fonts (print shop): BarlowCondensed-ExtraBold, BarlowCondensed-Bold, BarlowCondensed-SemiBold, AtkinsonHyperlegible-Italic, AtkinsonHyperlegible-Bold, AtkinsonHyperlegible-Regular. Raster images: none (all vector). The image-resolution check is self-tested on every run with a generated 150 ppi test image.

## 3c. Web preview and editor tests (`scripts/test-web.mjs`)

Run in headless Chrome against the generated pages (desktop 1366–1440 px, mobile 375–390 px, reduced motion). Screenshots: `build/screenshots/`.

- ✅ [preview] Loads without script errors
- ✅ [preview] All 180 cards present: A–D 40 each (20 Q + 20 A), E 20 questions, no Gate E answers
- ✅ [preview] Every card starts face down (back facing the viewer), fronts hidden from screen readers
- ✅ [preview] Every card shows its own gate's back design
- ✅ [preview] Hint “Click a card to flip it” is shown
- ✅ [preview] All card text fits (same fitting as the PDFs)
- ✅ [preview] Click flips the card to its front with a 3D rotation (mid-animation the card is edge-on, then fully turned)
- ✅ [preview] Clicking again flips it back to the gate back
- ✅ [preview] Keyboard: cards are focusable buttons; Enter flips to the front, Space flips back
- ✅ [preview] Keyboard: Tab from the toolbar reaches the cards
- ✅ [preview] Keyboard focus is visible on the card
- ✅ [preview] “Flip all to fronts” then “Reset all to backs” returns every card to its back
- ✅ [preview] Gate filter (departures board) shows only that gate
- ✅ [preview] Type filter: answers only
- ✅ [preview] Gate E with “Answers” shows no cards and explains why
- ✅ [preview] Filter state is kept in the link (#gate=…&show=…)
- ✅ [preview] Opening a link with #gate=D&show=question restores that view
- ✅ [preview] Card size buttons enlarge the cards
- ✅ [preview] Print guides show bleed, trim and safe-area lines
- ✅ [preview] Reduced motion: no flip animation (instant face change, no lift)
- ✅ [preview] Mobile (375 px): no horizontal scrolling and cards fit the screen
- ✅ [preview] Mobile: smallest card text is still at least 11 px on screen
- ✅ [preview] Mobile: tapping a card flips it
- ✅ [editor] Loads without script errors
- ✅ [editor] 100 cards to edit: 80 with question + answer (A–D), 20 Gate E with question only
- ✅ [editor] Gate E has no answer fields, and says so
- ✅ [editor] Every card shows its ID (A1–E20 in order)
- ✅ [editor] Every text box has a label and every button has a name
- ✅ [editor] Master data passes every editor check (0 errors, 0 warnings)
- ✅ [editor] Export JSON without edits = data/cards.json, byte for byte (safe drop-in replacement)
- ✅ [editor] Export CSV without edits = data/cards.csv, byte for byte
- ✅ [editor] Typing marks the card as edited and saves a draft in this browser
- ✅ [editor] After reloading, the edit is restored from the browser draft (with a notice)
- ✅ [editor] Required check: empty French text is an error, shown next to the field and on the gate tab
- ✅ [editor] Fit check: text too long for the printed card is an error (same fitting as the PDFs)
- ✅ [editor] Question–answer check: the French answer letter must match the English one
- ✅ [editor] Gate E cards only offer the question (EN + FR) for editing
- ✅ [editor] Exporting with errors asks for confirmation first
- ✅ [editor] The project validator also rejects that export (editor and build agree)
- ✅ [editor] After fixing, export needs no confirmation and the validator accepts the file
- ✅ [editor] Exported JSON changes only the edited text field; IDs, order, sources unchanged
- ✅ [editor] Change list (CSV) lists exactly the edited text
- ✅ [editor] Import JSON: text from the file is loaded (after confirming it replaces current edits)
- ✅ [editor] Import JSON: fields the editor does not manage (sources) are reported, not imported
- ✅ [editor] Import rejects a file with a Gate E answer card or a missing card
- ✅ [editor] Import rejects a file that is not valid JSON
- ✅ [editor] Search finds cards by text (accent- and case-insensitive)
- ✅ [editor] Gate tabs filter the list (Gate E: 20 cards)
- ✅ [editor] “Edited cards” filter shows only edited cards
- ✅ [editor] “Discard all edits” asks first, then restores the master text and clears the draft
- ✅ [editor] Mobile (390 px): no horizontal scrolling; preview hidden until asked
- ✅ [editor] Mobile: “Preview” opens the live card preview (focus on Close), Escape closes it

## 4. Source verification

- Factual pairs (Gates A–D): **22 web-checked** against the sources recorded in `data/cards.json` during authoring (2026-10-10), **58 general knowledge** (widely established facts, e.g. "Canberra is the capital of Australia", not individually web-checked in this session).
- Where sources disagreed, the card wording was hedged or narrowed: Finland's lake count (range 168 000–188 000 given), Hong Kong escalator ("one of the longest"), al-Qarawiyyin ("often called the oldest"), Prague Orloj ("one of the oldest still working"), Bologna's "Red" nickname (rooftops, the most-cited reason), kubb (Viking-origin claim deliberately omitted), Ruhezeit (no hours stated — rules vary), Bulgarian head gestures ("traditionally … can mean").
- No citations or URLs appear on card faces (automated check).
- **Recommended before printing:** spot-check the general-knowledge items below; they are stable facts but were not re-verified online in this session.

| ID | Destination | Answer (EN) | Status | Sources |
|---|---|---|---|---|
| A1 | Spain | B) One per month — a grape for each chime of midnight, for 12 lucky months. Chew fast! | general knowledge | — |
| A2 | Italy — Naples | Tomato, mozzarella and basil. Pineapple was not invited! | general knowledge | — |
| A3 | Japan — Tokyo | C) Arigatō — thank you! (Konnichiwa = hello, sayōnara = goodbye.) | general knowledge | — |
| A4 | South Korea | A) Napa cabbage, with chilli and garlic. Spicy, tangy and full of vitamins! | general knowledge | — |
| A5 | Poland | C) Filled dumplings — with potato and cheese, meat, cabbage… or even fruit! | general knowledge | — |
| A6 | Türkiye | Turkish delight (lokum). Worth it? You decide! | general knowledge | — |
| A7 | Belgium | Dutch and German (plus French, of course). | general knowledge | — |
| A8 | Switzerland | B) Romansh — the main language of under 1% of the Swiss. Chocolate, though, is understood by all! | general knowledge | — |
| A9 | Finland | Saunas! "Sauna" is one of the few Finnish words used worldwide. | web-checked | [1](https://ich.unesco.org/en/RL/sauna-culture-in-finland-01596) [2](https://valtioneuvosto.fi/en/-/1410845/finland-s-sauna-culture-inscribed-on-unesco-intangible-cultural-heritage-list) |
| A10 | Portugal — Porto | A) Pastel de nata — best eaten warm with a pinch of cinnamon. | general knowledge | — |
| A11 | Mexico | C) Avocado — and yes, botanically it's a fruit (a big berry, even)! | general knowledge | — |
| A12 | Argentina / Uruguay | Tango! It has been on UNESCO's intangible heritage list since 2009. | general knowledge | — |
| A13 | Brazil | B) Samba! Rio's samba schools spend months on costumes, floats and drums. | general knowledge | — |
| A14 | Canada — Québec | Poutine! Fresh cheese curds should squeak when you bite them. | general knowledge | — |
| A15 | Greece | A) Love — philosophy = love of wisdom (sophia). No beard required! | general knowledge | — |
| A16 | Hungary | C) Paprika — Hungary's pride, from sweet to fiery hot. | general knowledge | — |
| A17 | Morocco | Tagine (tajine) — slow-cooked and full of spices. | general knowledge | — |
| A18 | Netherlands | A) Orange — the colour of the royal House of Orange-Nassau. | general knowledge | — |
| A19 | Sweden | B) A coffee break with a treat — a cinnamon bun is a classic! | general knowledge | — |
| A20 | Peru | A) Lime juice — its acid "cooks" the fish in minutes. | web-checked | [1](https://ich.unesco.org/en/RL/01952) |
| B1 | Spain — Barcelona | Barcelona — and the builders are still adding the finishing touches. | general knowledge | — |
| B2 | Czechia — Prague | B) Spires — look up: towers and steeples everywhere! | general knowledge | — |
| B3 | Poland — Kraków | C) Nicolaus Copernicus, at Kraków's Jagiellonian University. | web-checked | [1](https://copernicus.torun.pl/en/biography/copernicus-in-krakow-1491-1495/studies-at-krakow-university) |
| B4 | South Korea — Seoul | Seoul — Gangnam lies south of the Han River. | general knowledge | — |
| B5 | Hungary — Budapest | A) The Danube — it flows through 10 countries, more than any other river. | general knowledge | — |
| B6 | Japan — Tokyo | A) Crowds crossing from all sides at once — sometimes thousands per green light! | general knowledge | — |
| B7 | Türkiye — Istanbul | Europe and Asia, separated by the Bosphorus. | general knowledge | — |
| B8 | Portugal — Porto | B) Azulejos — painted tiles that tell stories from Portugal's history. | general knowledge | — |
| B9 | Belgium — Brussels | Peeing! He's Manneken Pis — and he owns over 1,000 costumes. | general knowledge | — |
| B10 | Chile — Valparaíso | C) The Pacific — Valparaíso is famous for its colourful hills facing the sea. | general knowledge | — |
| B11 | Canada — Québec City | B) Bonhomme Carnaval — welcoming visitors since 1955. | general knowledge | — |
| B12 | Hong Kong SAR | Right — traffic drives on the left, a legacy of British times. | general knowledge | — |
| B13 | Dominican Republic — Santo Domingo | C) Music and dance styles, both born in the Dominican Republic. Warm up those hips! | general knowledge | — |
| B14 | Australia — Melbourne | C) Trams — about 250 km of double track, and rides in the city centre are free! | web-checked | [1](https://yarratrams.com.au/facts-figures) [2](https://www.guinnessworldrecords.com/world-records/62650-most-extensive-tram-system) |
| B15 | Croatia — Dubrovnik | A) Game of Thrones — fans still walk its walls looking for dragons. | general knowledge | — |
| B16 | Croatia — Split | A) Emperor Diocletian's palace — people still live and shop inside it! | general knowledge | — |
| B17 | Estonia — Tallinn | A) Skype — it linked students abroad with home for over 20 years (retired in 2025). | general knowledge | — |
| B18 | Italy — Bologna | Bolognese! In Bologna it's served with tagliatelle — not spaghetti. | general knowledge | — |
| B19 | Netherlands | C) Bicycles — about 23 million for about 18 million people. Mind the bike lanes! | web-checked | [1](https://www.rug.nl/education/student-blog/7-fun-facts-about-bikes-in-the-netherlands) [2](https://www.iamexpat.nl/expat-info/dutch-news/most-googled-how-many-bicycles-are-there-netherlands) |
| B20 | Europe | B) Erasmus of Rotterdam (c. 1466–1536) — the original exchange student! | web-checked | [1](https://alumni.europa.eu/news/35-years-of-erasmus) [2](https://coris.web.uniroma1.it/en/what-erasmus) |
| C1 | World | Antarctica — a few thousand researchers, millions of penguins! | general knowledge | — |
| C2 | World | France — 12, thanks to its overseas territories. Cocorico! | web-checked | [1](https://www.timeanddate.com/time/country-with-the-most-time-zones.html) |
| C3 | World | C) Mandarin Chinese — more than 900 million native speakers. | general knowledge | — |
| C4 | China — Chengdu | The giant panda — eating is basically its full-time job! | general knowledge | — |
| C5 | Switzerland — Geneva | A) Geneva — by Tim Berners-Lee. Thanks for the memes, CERN! | general knowledge | — |
| C6 | Denmark | C) "Play well", from "leg godt". Stepping on one barefoot was never part of the plan! | web-checked | [1](https://www.lego.com/cs-cz/AboutUs/lego-group/the_lego_history) |
| C7 | Egypt — Cairo | B) Cairo — the Great Pyramid is about 4,500 years old. (Las Vegas only has a copy!) | general knowledge | — |
| C8 | Australia | Canberra! It was built as a compromise because Sydney and Melbourne both wanted the title. | general knowledge | — |
| C9 | Italy — Pavia | A) The volt. Voltaire was a writer, not a battery! | web-checked | [1](https://en.wikipedia.org/wiki/Alessandro_Volta) [2](https://en.wikipedia.org/wiki/Voltaic_pile) |
| C10 | Italy / France | The Mona Lisa, by Leonardo da Vinci — at the Louvre. | general knowledge | — |
| C11 | Europe | 12 — a symbol of unity and harmony. The number never changes. | general knowledge | — |
| C12 | Finland | B) About 188,000! The nickname is very modest. | web-checked | [1](https://stat.fi/ajk/tiedotteet/2014/uutinen_020_2014-06-09_en.html) [2](https://toolbox.finland.fi/themes/nature-and-sustainable-development/land-thousand-lakes/) [3](https://en.wikipedia.org/wiki/Finnish_Lakeland) |
| C13 | China | A) China — three of its "Four Great Inventions" (the fourth: printing). | general knowledge | — |
| C14 | World | The Pacific — it's bigger than all the land on Earth put together! | general knowledge | — |
| C15 | Taiwan | B) Bubble tea, invented in Taiwan in the 1980s. Pearl Jam is a rock band! | general knowledge | — |
| C16 | Poland / France | Marie Skłodowska-Curie (Physics 1903, Chemistry 1911). | general knowledge | — |
| C17 | UK — Scotland | B) The unicorn! Nessie is just a very famous local. | web-checked | [1](https://www.nts.org.uk/stories/the-unicorn-scotlands-national-animal) [2](https://www.historic-uk.com/HistoryUK/HistoryofScotland/The-Unicorn-Scotlands-National-Animal) |
| C18 | Japan | C) The Shinkansen — opened in 1964. The TGV followed in 1981! | general knowledge | — |
| C19 | Morocco — Fez | Morocco — now that's a long degree! | web-checked | [1](https://en.wikipedia.org/wiki/University_of_al-Qarawiyyin) |
| C20 | Brazil | A) Brazil — the world's top coffee producer for well over a century. | general knowledge | — |
| D1 | Hungary | B) Hungary — by Ernő Rubik, a Budapest professor. Good luck! | general knowledge | — |
| D2 | Japan | Mario! Back then he was called "Jumpman". | general knowledge | — |
| D3 | China / Hong Kong | China — it took shape in the 19th century. | general knowledge | — |
| D4 | Japan | A) Pocket Monsters (Poketto Monsutā in Japanese). Gotta catch 'em all! | general knowledge | — |
| D5 | Finland | B) Finland (1996), inspired by an older Karelian game, kyykkä. | web-checked | [1](https://en.wikipedia.org/wiki/M%C3%B6lkky) [2](https://yle.fi/a/3-6907318) |
| D6 | Sweden | A) Sweden, especially the island of Gotland. Viking helmet optional! | web-checked | [1](https://en.wikipedia.org/wiki/Kubb) |
| D7 | Malaysia / Southeast Asia | C) Hands — only feet, knees, chest and head. Very acrobatic! | web-checked | [1](https://www.iskl.edu.my/the-origins-of-sepak-takraw/) [2](https://www.topendsports.com/sport/list/sepak-takraw.htm) |
| D8 | Colombia | B) Little gunpowder packets ("mechas") that explode on a hit. Loud and proud! | general knowledge | — |
| D9 | Italy | A) Broom — when you take all the cards, you "sweep" the table! | web-checked | [1](https://en.wikipedia.org/wiki/Scopa) |
| D10 | South Korea | B) 1, 2, 3, soleil! In Korean: "The hibiscus flower has bloomed". | general knowledge | — |
| D11 | Japan — Kyoto | C) Playing cards — hanafuda, decorated with flowers. | web-checked | [1](https://en.wikipedia.org/wiki/History_of_Nintendo) |
| D12 | Türkiye | A) Backgammon — expect speed and friendly teasing! | general knowledge | — |
| D13 | General | C) The honeymoon stage — though not everyone goes through every stage. | general knowledge | — |
| D14 | General | Reverse culture shock! Totally normal — give it a few weeks. | general knowledge | — |
| D15 | Japan | B) It recalls an offering at Buddhist funerals. Use the chopstick rest instead! | web-checked | [1](https://www.jal.co.jp/sg/en/guide-to-japan/plan-your-trip/tips/what-to-know-when-dining-in-japan.html) |
| D16 | Spain | C) Often around 9–10 pm (it varies). Tip: tapas will help you survive until then! | web-checked | [1](https://www.thelocal.es/20241002/why-do-spaniards-eat-so-late) |
| D17 | Germany | A) Quiet hours — e.g. at night and on Sundays (rules vary). The vacuuming can wait till Monday! | web-checked | [1](https://www.thelocal.de/20201005/ruhezeit-what-you-need-to-know-about-quiet-time-in-germany) [2](https://allaboutberlin.com/guides/quiet-hours) |
| D18 | Bulgaria | A) "No" — and a side-to-side shake can mean "yes". If unsure, just ask! | web-checked | [1](https://www.peacecorps.gov/stories/yes-or-no-depends-on-which-country-youre-in/) [2](https://3seaseurope.com/bulgarians-shake-nod-heads/) |
| D19 | Japan | C) Nothing — good service is simply included. Keep your coins for the vending machines! | web-checked | [1](https://www.japan.travel/en/plan/tipping-in-japan/) |
| D20 | Denmark | Hygge! Roughly pronounced "hoo-gah". | general knowledge | — |

## 5. Partner universities (from `University Partners.xlsx`)

- 162 unique institutions (163 rows supplied; "TH Köln" appears twice and was merged) across **51 countries/territories**: Argentina, Australia, Austria, Belgium, Brazil, Bulgaria, Canada, Chile, China, China (mainland), Colombia, Croatia, Cyprus, Czechia, Denmark, Dominican Republic, Egypt, Estonia, Finland, Germany, Greece, Hong Kong SAR, Hungary, Italy, Japan, Latvia, Lithuania, Macao SAR, Malaysia, Mexico, Morocco, Netherlands, North Macedonia, Norway, Panama, Peru, Poland, Portugal, Romania, Serbia, Slovakia, Slovenia, South Korea, Spain, Sweden, Switzerland, Taiwan, Türkiye, United Kingdom, Uruguay, Vietnam.
- Status: **5 web-checked**, **142 knowledge-based** (well-known institution; city/country from general knowledge, not individually checked on the official site), **15 need confirmation** (ambiguous name or campus).
- **No campus-specific facts are used for any ambiguous entry**; cards about those destinations use country- or city-level facts only. No university policies, services, facilities, opening hours or transport rules are stated anywhere.
- Note: BNBU is listed among the Hong Kong partners but is located in **Zhuhai, mainland China** (web-checked).

| Supplied name | Resolved as | Location | Why it needs confirmation |
|---|---|---|---|
| HOWEST UNIVERSITY OF APPLIED SCIENCES | Howest University of Applied Sciences | Kortrijk / Bruges, Belgium | Multiple campuses (Kortrijk, Bruges); campus not specified — no campus-specific facts used. |
| KU LEUVEN, FACULTY OF ECONOMICS & BUSINESS | KU Leuven, Faculty of Economics & Business | Leuven (FEB also teaches in Brussels, Antwerp, Ghent), Belgium | FEB has several campuses; only Belgium-wide facts used. |
| UNIVERSITY OF SOUTHERN DENMARK (SDU) | University of Southern Denmark | Odense (main; also Kolding, Sønderborg, Esbjerg, Slagelse), Denmark | Campus not specified — only Denmark-wide facts used. |
| ZEALAND | Zealand — Academy of Technologies and Business | Køge (HQ); campuses incl. Roskilde, Næstved, Slagelse, Nykøbing F., Holbæk, Denmark | Name supplied as "ZEALAND"; matched to Zealand Academy of Technologies and Business (web-checked). Campus not specified. |
| UNIVERSITY OF THESSALY | University of Thessaly | Volos (main; also Larissa, Trikala, Karditsa, Lamia), Greece | Campus not specified — only Greece-wide facts used. |
| UNIVERSITÀ CATTOLICA DEL SACRO CUORE | Università Cattolica del Sacro Cuore | Milan (main; also Rome, Brescia, Piacenza-Cremona), Italy | Campus not specified. |
| HAN UNIVERSITY OF APPLIED SCIENCES | HAN University of Applied Sciences | Arnhem / Nijmegen, Netherlands | Two main campuses — campus not specified. |
| ADEN UNIVERSITY | ADEN University | Panama City, Panama | Supplied list is grouped by country and places it between Norway and Peru; directories list ADEN University in Panama City. Not confirmed on an official site — please confirm. (Not to be confused with the University of Aden, Yemen.) |
| MYONGJI UNIVERSITY | Myongji University | Seoul / Yongin, South Korea | Two campuses — campus not specified. |
| SKKU | Sungkyunkwan University | Seoul / Suwon, South Korea | Two campuses (Humanities & Social Sciences in Seoul; Natural Sciences in Suwon) — campus not specified. |
| IE UNIVERSITY | IE University | Madrid / Segovia, Spain | Two campuses — campus not specified. |
| UNIVERSIDAD LOYOLA ANDALUCÍA | Universidad Loyola Andalucía | Seville / Córdoba, Spain | Two campuses — campus not specified. |
| ANGLIA RUSKIN UNIVERSITY HIGHER EDUCATION CORPORATION (ARU) | Anglia Ruskin University | Cambridge / Chelmsford / Peterborough / London, United Kingdom | Several campuses — campus not specified. |
| UNIVERSITY OF HEDFORSHIRE | UNRESOLVED — University of Bedfordshire or University of Hertfordshire? | Luton/Bedford or Hatfield, United Kingdom | "Hedforshire" does not exist; could be Bedfordshire (Luton, Bedford) or Hertfordshire (Hatfield). Please confirm. Not used in any card. |
| MONTEVIDEO - UTEC | Universidad Tecnológica del Uruguay (UTEC) | Montevideo (as supplied; UTEC is mainly based in Uruguay's interior regions), Uruguay | UTEC has a Montevideo office/global centre but most teaching sites are in the interior; confirm the host site. Not to be confused with UTEC Lima (Peru). Only Uruguay-wide facts used. |

## 6. Accuracy, sensitivity and language review (manual)

Performed while authoring every card; re-read in full on the rendered prototype and gallery.

- **No stereotypes or mockery.** Customs are framed as traditions or common practices ("traditionally", "many people", "often", "rules vary"), never as what "all" people of a country do. Culture-shock cards present Oberg's stage model as *a* model and state that not everyone goes through every stage. An automated wording scan flags generalising phrases (0 flagged).
- **No exclusive-ownership claims for games** unless supported: sepak takraw "popular in Malaysia and across Southeast Asia"; truco "Argentina and Uruguay (also played in Brazil and elsewhere)"; Go named in Japan, Korea and China.
- **Not everything is EU:** the only EU-specific card is the EU flag; partners outside the EU (UK, Switzerland, Norway, Türkiye, Serbia, North Macedonia, Canada, Latin America, Asia, Africa, Oceania) are covered without implying shared rules.
- **Gate B** contains no invented university policies or services; the only university-specific facts are historical (Jagiellonian 1364/Copernicus, Tartu 1632, Pavia/Volta in Gate C) and web-checked.
- **French:** natural, idiomatic phrasing rather than literal translation; peer-to-peer *tu* register throughout; Gate E prompts are worded to avoid gendered past-participle agreement so they read correctly for everyone. French typography (non-breaking space before ? ! : ; and inside « ») is applied automatically at render time. English uses British spelling.
- **Gate E** prompts are open-ended ("What helped you…", "What do you wish…", "Tell us about…") with no model answers anywhere in the data or on cards.

## 7. Design checks

- ✅ Exactly five reusable, minimalist backs — same frame, header, typography and layout; each differs only by colour arrangement, gate letter and one motif + one small accent glyph (A plate & utensils + speech bubble; B campus building + map pin; C light bulb with "?" + sparkle; D die + turning arrows; E two linked speech bubbles + compass).
- ✅ Palette restricted to navy #0B2545, deep teal #0B6F79, turquoise #1FB5BE, yellow #FFC93C, white, Bordeaux #6D071A (Gate E), plus two same-hue tints (#D9F2F4, #FFF6DB). The small English / French flags before each sentence keep their real national colours so they stay recognisable. Crop marks in the print-shop PDF are pure black (printer's marks, not artwork).
- Fronts share one layout (boarding-pass header, category strip, EN text → flight-path divider → FR text, tear-off footer); gate identity comes from the badge motif, category bar and foot strip colour. Answer cards have a yellow header and pale-yellow ground so they are easy to sort. Gate E cards are labelled DISCUSSION and say "No right answer · share yours" instead of pointing to an answer card.
- Fonts: Atkinson Hyperlegible (body, designed for legibility) and Barlow Condensed (signage), both SIL OFL 1.1, self-hosted in `assets/fonts/`.

## 8. Unresolved issues and limitations

1. **Print-shop specifications were not supplied.** `exports/cards_print_shop.pdf` uses generic defaults (56 × 87 mm trim, 3 mm bleed, crop marks, TrimBox/BleedBox). It has **not** been checked against the university print department's requirements. `exports/print_specifications.pdf` lists what must be confirmed (size, bleed, marks, format/colour profile, page order, stock, corners, quantity, proof).
2. **Colour space is RGB.** Browser-generated PDFs are RGB (DeviceRGB, sRGB values); there is no CMYK/PDF-X conversion tool in this environment (no Ghostscript). If CMYK/PDF-X is required, the print department's prepress must convert. Turquoise and yellow may shift slightly in CMYK — request a proof.
3. **Card size.** 56 × 87 mm is the size commonly reported for UNO cards by retailers and accessory makers; no official Mattel/UNO specification was found (one guide says 56 × 88 mm). It is configurable (`card.trim_*_mm`).
4. **Editor drafts are per browser.** The web editor saves drafts in the browser's local storage on that computer only; edits reach the project only through **Export JSON** → `npm run import-edits`.
5. **58 factual pairs are general knowledge** rather than web-checked in this session (table in §4).
6. **15 partner entries need confirmation** (table in §5), notably "University of Hedforshire" (Bedfordshire or Hertfordshire?), "ADEN University" (assumed Panama City from the list's country grouping) and "Montevideo – UTEC".
7. Home printers differ in duplex shift and printable margins (crop marks start 4.0 mm from the paper edge). Always print the alignment test first.
8. Canva and Higgsfield integrations were not used. All artwork is local, editable SVG/HTML with live text, which can be imported into Canva if needed. No AI-generated images and no third-party icon sets are used.
9. Interactive approval of the prototype was not possible during the automated run; the prototype is documented in `docs/prototype.png` and the full deck follows it.

## 9. Deliverables

| File | Purpose | Status |
|---|---|---|
| `data/cards.json` | Structured records for all 180 cards (source of truth) | ✅ 117 KB |
| `data/cards.csv` | Flat export (UTF-8 with BOM, opens in Excel) | ✅ 80 KB |
| `data/partners.json` | Partner universities → resolved city/country + verification status | ✅ 43 KB |
| `preview/preview_gallery.html` | Animated design preview: every card face down, click to flip; the five backs | ✅ 4 KB |
| `editor/index.html` | Question editor for colleagues (browser only, exports JSON/CSV) | ✅ 4 KB |
| `assets/backs/back_gate_A_food_language_traditions.svg` | Back — Gate A | ✅ 4 KB |
| `assets/backs/back_gate_B_campus_city.svg` | Back — Gate B | ✅ 4 KB |
| `assets/backs/back_gate_C_random_knowledge.svg` | Back — Gate C | ✅ 4 KB |
| `assets/backs/back_gate_D_games_culture_shock.svg` | Back — Gate D | ✅ 4 KB |
| `assets/backs/back_gate_E_student_advice.svg` | Back — Gate E | ✅ 4 KB |
| `config/print-settings.json` | Card size, bleed, margins, page layout, duplex orientation | ✅ 7 KB |
| `design/tokens.css` | Colour + font design tokens | ✅ 2 KB |
| `src/templates.mjs` | Editable card generation source (HTML/CSS/JS) | ✅ 6 KB |
| `exports/cards_home_print_A4.pdf` | Home printing, A4, duplex | ✅ 1488 KB |
| `exports/cards_print_shop.pdf` | Print shop, one card side per page, bleed + crop marks | ✅ 2804 KB |
| `exports/cards_manual_cut_A3.pdf` | A3 sheets for cutting by hand (fronts only) | ✅ 1250 KB |
| `exports/print_specifications.pdf` | Print specification sheet for the print department (PDF) | ✅ 107 KB |
| `docs/PRINT_SPECIFICATIONS.md` | Print specification sheet (Markdown, same content) | ✅ 12 KB |
| `docs/prototype.png` | Design prototype (Gate A Q+A, Gate E card, five backs) | ✅ 478 KB |
| `README.md` | Setup, editing and rebuild instructions | ✅ 20 KB |
| `cards_source.zip` | Source, data, assets, docs, preview and PDFs | created by `npm run package` (final build step) |
