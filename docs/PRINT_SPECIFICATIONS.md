# Print specification — International Fair "Airport Gates" cards

_Generated automatically by `npm run build` on 2026-10-10. Do not edit by hand: change `config/print-settings.json` and rebuild._

## Status

> **Draft for confirmation.** These files follow generic professional defaults. They have **not** been checked against the University Publications/Printing Department's own requirements yet. Please review the checklist in section 9 and tell us what to change: every value below is a setting, and the files can be regenerated within minutes.

Generated 2026-10-10 from `config/print-settings.json`. Automated checks: **all passed** (68/68 content, 18/18 render, 28/28 PDF inspection).

## 1. Job summary

| Item | Specification |
|---|---|
| Product | Bilingual (English / French) quiz and discussion cards for the International Fair, printed both sides |
| Cards per deck | **180 cards**: 100 question cards + 80 answer cards (Gates A–D). Gate E has questions only. 180 different fronts, 5 back designs (one per gate). |
| Finished (trim) size | **56 × 87 mm**, portrait (UNO-style compact playing card; see note in section 2) |
| Bleed | **3 mm** on every edge, giving an artwork size of 62 × 93 mm |
| Safe area | Text and essential artwork stay at least 3.5 mm inside the trim (inner 49 × 80 mm) |
| Colours | Full colour (4/4) both sides. File colour space: RGB (sRGB values, DeviceRGB in the PDF). No spot colours. |
| Corners | Square in the file. Rounded corners (about 3 mm radius, as in the previews) are optional; please advise. |
| Stock and finish | To be advised by the print department. Suggestion: 300–350 g/m² coated card (matt or silk); lamination optional |
| Quantity | Number of decks to be confirmed by the organisers |

## 2. Card size

The target size is **56 × 87 mm**, the size commonly reported for UNO cards by retailers and accessory makers. **This is not an official Mattel/UNO specification**: no official specification was found, and one design guide gives 56 × 88 mm instead. The game is not affiliated with UNO or Mattel; the size was simply chosen to feel like a familiar compact card.

If the department prefers a standard size it already cuts (for example poker 63.5 × 88.9 mm or bridge 57.2 × 88.9 mm), change `card.trim_width_mm` / `card.trim_height_mm` and rebuild. The card layout is defined in millimetres and adapts; all fit and print checks are rerun automatically.

## 3. Files supplied

| File | Use | Pages | Page size | Size |
|---|---|---|---|---|
| `exports/cards_print_shop.pdf` | **Print-ready file.** One card side per page, bleed, crop marks, TrimBox/BleedBox set on every page, bookmarks per gate | 360 | 78 × 109 mm | 2.7 MB |
| `exports/cards_home_print_A4.pdf` | Office/home printing on A4, 3 × 3 cards per sheet, duplex, with cut marks, instructions and an alignment test page | 50 | 210 × 297 mm | 1.5 MB |
| `exports/print_specifications.pdf` | This specification | — | A4 | — |
| `data/cards.csv` | Card text as a spreadsheet, for proofreading (not for printing) | — | — | 0.1 MB |

Print-shop page layout: the 62 × 93 mm artwork (trim + bleed) is centred on a 78 × 109 mm page with an 8 mm slug. Crop marks: 5 mm long, 0.15 mm, 100 % black, starting 3 mm outside the trim (so they never touch the bleed). A small line of text in the slug names the card, side and page; it is outside the bleed and is cut away.

## 4. Page order and card backs

Front and back alternate: every odd page is a card front and the following even page is that card's back (page 1 = front of card 1, page 2 = its back, …).

| Gate | Card type | Card IDs | Cards | Pages |
|---|---|---|---|---|
| Gate A | Question | A1–A20 | 20 | 1–40 |
| Gate A | Answer | A1–A20 | 20 | 41–80 |
| Gate B | Question | B1–B20 | 20 | 81–120 |
| Gate B | Answer | B1–B20 | 20 | 121–160 |
| Gate C | Question | C1–C20 | 20 | 161–200 |
| Gate C | Answer | C1–C20 | 20 | 201–240 |
| Gate D | Question | D1–D20 | 20 | 241–280 |
| Gate D | Answer | D1–D20 | 20 | 281–320 |
| Gate E | Discussion (question) | E1–E20 | 20 | 321–360 |

Backs: each gate has one back design, shared by all its question and answer cards (A = Food, Language & Traditions; B = Campus Life & City Information; C = Random Questions & General Knowledge; D = Games from Countries & Culture Shock; E = Student Advice: Living Abroad, Adapting & Making Friends). Each back page in the file is the correct design for the card in front of it (verified automatically by reading the PDF).

Orientation: backs are supplied **upright, in the same orientation as their fronts** (head to head). On the finished card the top of the back is behind the top of the front. Please mirror the back positions on the press sheet according to how the sheet is turned for the second side (work-and-turn or work-and-tumble).

## 5. Colour

The PDFs are produced by a web browser engine, which always writes **RGB** (DeviceRGB; the values below are sRGB). Please convert to CMYK with the department's profile (to be confirmed by the print department (e.g. PSO Coated v3 / FOGRA51 or ISO Coated v2 / FOGRA39 for coated stock)). **A printed proof is requested before the full run**: the turquoise and the yellow may shift in CMYK. Crop marks are RGB 0, 0, 0 (black). The small British and French flags printed before each sentence keep their national colours.

| Colour | Hex | RGB | Used for |
|---|---|---|---|
| Navy | #0B2545 | 11, 37, 69 | text, frames, Gate B |
| Deep teal | #0B6F79 | 11, 111, 121 | French text, Gate D |
| Turquoise | #1FB5BE | 31, 181, 190 | Gate A, accents |
| Yellow | #FFC93C | 255, 201, 60 | answer cards, Gate C, accents |
| White | #FFFFFF | 255, 255, 255 | card grounds |
| Bordeaux | #6D071A | 109, 7, 26 | Gate E |
| Turquoise tint | #D9F2F4 | 217, 242, 244 | light grounds |
| Yellow tint | #FFF6DB | 255, 246, 219 | answer card ground |

## 6. Fonts and artwork

- Fonts: **Atkinson Hyperlegible** and **Barlow Condensed** (SIL Open Font License 1.1, embedding permitted). All fonts are embedded as subsets: BarlowCondensed-ExtraBold, BarlowCondensed-Bold, BarlowCondensed-SemiBold, AtkinsonHyperlegible-Italic, AtkinsonHyperlegible-Bold, AtkinsonHyperlegible-Regular.
- All text is live (not converted to outlines) and all artwork is vector. The PDFs contain **no raster images**.
- Any image added later must reach at least **300 ppi** at its printed size (checked automatically).
- PDF version 1.7; standard PDF, not PDF/X. If PDF/X-1a or PDF/X-4 is required, the department's prepress step will need to convert it.

## 7. Office or home printing (A4 file)

- 23 duplex A4 sheets, 3 × 3 cards per sheet with 3 mm bleed (two cuts 6 mm apart between neighbouring cards); each sheet holds one gate only.
- Print at **100 % / actual size**, two-sided, **flip on long edge**. Pages 1–2 are instructions; pages 3–4 are an alignment test to print first; cards start on page 5.
- Cut along the crop marks on the front side. A printer's duplex shift can be corrected with `home_print.back_offset_x_mm` / `back_offset_y_mm`.

## 8. Automated verification of the delivered files

Checked by reading the finished PDFs with two independent PDF parsers (pdf-lib and pdf.js), plus the browser render checks:

- ✓ cards_print_shop.pdf: valid PDF header and end-of-file marker — %PDF-1.7, EOF true
- ✓ cards_print_shop.pdf: strict parse with pdf-lib — 360 pages
- ✓ cards_print_shop.pdf: independent parse with pdf.js, no warnings — 360 pages
- ✓ cards_print_shop.pdf: page count — 360, expected 360
- ✓ cards_print_shop.pdf: every page is 78 × 109 mm — 77.98 × 109.05 mm
- ✓ cards_print_shop.pdf: all fonts embedded — 8 font resources, all embedded (FontFile2)
- ✓ cards_print_shop.pdf: only the project font families
- ✓ cards_print_shop.pdf: raster images ≥ 300 ppi at placed size — no raster images — all artwork and text are vector (0 image objects in file)
- ✓ TrimBox 56 × 87 mm and BleedBox (+3 mm each side) on every page, inside the page — 360 pages
- ✓ PDF bookmarks per gate and card type
- ✓ Every page's printed content matches its planned card and side (slug, gate, ID, type label)
- ✓ Each of the 180 cards has exactly one front page and one back page
- ✓ Odd pages are fronts; each is followed by its own gate's back
- ✓ Card counts in the PDF: 100 question cards, 80 answer cards (A–D), 0 Gate E answers, 180 total — 100 Q, 80 A, 0 E answers, 180 cards
- ✓ cards_home_print_A4.pdf: valid PDF header and end-of-file marker — %PDF-1.7, EOF true
- ✓ cards_home_print_A4.pdf: strict parse with pdf-lib — 50 pages
- ✓ cards_home_print_A4.pdf: independent parse with pdf.js, no warnings — 50 pages
- ✓ cards_home_print_A4.pdf: page count — 50, expected 50
- ✓ cards_home_print_A4.pdf: every page is 210 × 297 mm — 209.89 × 297.01 mm
- ✓ cards_home_print_A4.pdf: all fonts embedded — 8 font resources, all embedded (FontFile2)
- ✓ cards_home_print_A4.pdf: only the project font families
- ✓ cards_home_print_A4.pdf: raster images ≥ 300 ppi at placed size — no raster images — all artwork and text are vector (0 image objects in file)
- ✓ Alignment test: back marks sit behind the front marks for long-edge flip (measured in the PDF) — worst deviation 0.11 mm
- ✓ Every front is printed in its planned slot and every back shows the sheet's own gate (read from the PDF)
- ✓ Backs are centred on their slots (gate letter within 1 mm of the slot centre) — worst 0.10 mm
- ✓ Each back slot is the mirror of its front slot for long-edge flip — worst 0.000 mm
- ✓ PDF bookmarks (guide, alignment test, gates)
- ✓ Every card's text fits inside the safe area (preview, home PDF, print-shop PDF)
- ✓ No clipped labels (header, category, footer)
- ✓ Smallest body text ≥ configured minimum
- ✓ Only the project fonts are used (Atkinson Hyperlegible, Barlow Condensed) — no system-font fallback
- ✓ Duplex map: every front lands on its own gate's back (long-edge flip)
- ✓ Gate-pure sheets: one gate per sheet
- ✓ Content: 100 question cards, 80 answer cards, 80 matched pairs, 0 Gate E answers, 180 cards

## 9. Please confirm or tell us what to change

- [ ] Finished size 56 × 87 mm is acceptable (or give the size you need).
- [ ] Bleed of 3 mm is what you need (some workflows ask for 2 mm or 5 mm).
- [ ] Crop marks are wanted, at 3 mm offset (or supply without marks for your own imposition).
- [ ] An RGB PDF is accepted, or name the required format (PDF/X-1a, PDF/X-4) and CMYK profile.
- [ ] Page order "front-back-interleaved" suits you (alternative: all fronts, then all backs).
- [ ] Paper/card weight, finish, lamination and corner rounding.
- [ ] Cutting tolerance is within the 3.5 mm safe margin.
- [ ] Quantity (number of decks) and delivery date.
- [ ] A printed proof before the full run.

Questions about these files: contact the International Fair organising team.

## 10. How settings are changed (for the organisers)

| Setting in config/print-settings.json | Current value |
|---|---|
| `card.trim_width_mm` / `card.trim_height_mm` | 56 / 87 mm |
| `card.bleed_mm` | 3 mm |
| `card.safe_margin_mm` | 3.5 mm |
| `print_shop.page_order` | front-back-interleaved |
| `print_shop.crop_marks` / `crop_mark_offset_mm` / `crop_mark_length_mm` | true / 3 mm / 5 mm |
| `print_shop.slug_mm` | 8 mm |
| `print_shop.set_pdf_boxes` | true |
| `color.*` | colour request printed in this sheet (the file itself is always RGB) |
| `pdf.min_image_ppi` / `pdf.allowed_extra_fonts` | 300 ppi / none |
| `home_print.duplex_flip` / `back_offset_*_mm` | long-edge / 0, 0 mm |

After changing a value, run `npm run build`: it regenerates both PDFs, this sheet and the previews, and reruns every check.
