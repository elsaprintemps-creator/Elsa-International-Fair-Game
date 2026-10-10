# International Fair Airport-Themed Question Card Game --- Master Prompt

## Role and objective

You are an autonomous coding agent working in VS Code. Build a complete,
polished, editable, print-ready question-card game for a university
International Fair. The visual concept is an airport with five gates,
A--E, where students exchange cultural knowledge and practical
experiences related to international student life.

**Do the work, not just describe a plan.** Inspect the existing
workspace first, preserve existing work, ask the essential questions
listed below if they cannot be answered from the supplied information,
and then implement the project end-to-end. Do not overwrite existing
files without checking them first.

The user will provide a **list of partner universities involved in
student exchange**, not a country list. Use those university names to
identify the relevant city and country, then use verified information to
inform suitable questions. Do not guess when a university name or campus
is ambiguous.

## 1. Clarifications and research workflow

Before writing the final question set, inspect the workspace and the
user-provided list of partner universities. If any essential detail is
missing, ask a single concise batch of clarification questions and wait
for the answers. Do not ask for information already supplied, and do not
ask the user to write another prompt.

Essential clarifications only: - The list of partner universities,
including campus names when known. - Whether any named university/campus
is ambiguous or there are multiple campuses and the intended one cannot
be established reliably. - Any required print-shop specifications if the
user has them. Otherwise use the configurable defaults below.

Use official university websites first to verify each university's full
name, city, country, and campus. For general cultural and city facts,
use reliable sources such as official tourism/city websites, cultural
institutions, museums, government sources, and reputable educational
sources. Record source URLs and a short verification note in the project
data, not on the printed cards. Do not imply that all countries belong
to the EU or share the same rules.

If internet research is unavailable in the environment, clearly mark any
facts that still need verification in the QC report; do not fabricate
citations or claim research was completed.

Once destinations are identified, design questions that are relevant to
the destinations while still being fun and accessible to an
international student audience. Avoid making all questions depend on
having visited a destination. Include a balanced mix of well-known facts
and less-obvious, interesting facts. Never rely on stereotypes or imply
that every person in a country shares the same habits.

## 2. Five gates and exact content counts

Create five distinct gate categories. There must be **exactly 20
question cards per gate**:

### Gate A --- Food, Language & Traditions

-   20 questions, IDs `A1` through `A20`.
-   Topics: local foods, language and useful expressions, traditions,
    celebrations, everyday customs, and cultural practices relevant to
    the verified partner destinations.
-   Keep questions respectful, accessible, and suitable for a friendly
    international fair.

### Gate B --- Campus Life & City Information

-   20 questions, IDs `B1` through `B20`.
-   Topics: student life, campus-related experiences, public transport,
    city landmarks, useful city facts, everyday life, and practical
    information about the verified university cities.
-   Questions about university life should be broadly useful and must
    not invent university-specific policies, services, or facilities.
    Only include a specific campus fact if verified from a reliable
    source.
-   Distinguish general advice from official university rules.

### Gate C --- Random Questions & General Knowledge

-   20 questions, IDs `C1` through `C20`.
-   Topics may include fun general knowledge, geography, science, arts,
    surprising cultural facts, travel, and international trivia.
-   Keep questions varied, engaging, and suitable for students from
    different backgrounds. Destination-related questions may be
    included, but this gate should feel more random than Gates A and B.

### Gate D --- Games from Countries & Culture Shock

-   20 questions, IDs `D1` through `D20`.
-   Include traditional or popular games from different countries,
    playful cross-cultural comparisons, and culture-shock scenarios or
    concepts.
-   Keep the tone curious and humorous without mocking a culture,
    nationality, accent, or individual. Avoid presenting culture shock
    as a universal or identical experience.
-   If asking a factual question about a game, verify its name, origin,
    and description. Do not claim a game belongs exclusively to a
    country unless the evidence supports that claim.

### Gate E --- Incoming-to-Outgoing Student Advice: Living Abroad, Adapting & Making Friends

-   20 **open-ended discussion questions only**, IDs `E1` through `E20`.
-   This gate has a different purpose: students who have experience
    living in a new country or city share personal tips and experiences
    with students preparing to go abroad.
-   Topics can include settling into a new city, adapting to a different
    system, making friends, building a social network, language
    barriers, homesickness, cultural differences, everyday
    practicalities, confidence, budgeting habits, and what students wish
    they had known before arriving.
-   Questions should invite personal opinions, stories, recommendations,
    and peer-to-peer discussion. Use prompts such as "What helped
    you...?", "What do you wish you had known...?", or "What advice
    would you give...?"
-   **Do not write answers for Gate E. Do not create answer cards for
    Gate E.** There are no objectively correct answers for these
    prompts; the students are meant to exchange their own experiences
    and opinions.
-   Keep these questions welcoming and non-judgmental. Avoid assuming
    that every student has had the same experience or that one person's
    advice works for everyone.

## 3. Exact card totals and ID rules

The finished deck must contain: - 20 questions for each of Gates A, B,
C, D, and E = **100 question cards**. - One matching answer card for
each question in Gates A--D only: 4 gates × 20 = **80 answer cards**. -
Gate E has 20 question cards and **zero answer cards**. - **Total: 180
physical cards** --- 100 question cards plus 80 answer cards.

Use stable, unambiguous IDs: - Question IDs: `A1`--`A20`, `B1`--`B20`,
`C1`--`C20`, `D1`--`D20`, `E1`--`E20`. - Matching answer IDs for Gates
A--D should share the same gate and number, e.g. question `A1` matches
answer `A1`. Distinguish card type with a data field such as
`card_type: "question"` or `card_type: "answer"`; do not invent a
different pair number. - Gate E question IDs have no corresponding
answer record. - Every ID must be unique within its card type. Pair
matching must be validated automatically.

## 4. Question and answer writing requirements

For Gates A--D: - Write exactly 20 unique questions per gate and one
answer for each. - Questions and answers must be in **English and French
on the same card front**. English should appear first, followed by
natural, idiomatic French. - Answers should be short and easy to read,
ideally one line per language. Rewrite any question whose correct answer
cannot be stated accurately and briefly. - Questions should be fun,
friendly, accessible, and easy-to-moderate in difficulty. - Include a
mixture of broadly familiar facts and some surprising facts, but avoid
making the game feel like an exam. - Check spelling, grammar, clarity,
and translation quality in both languages. Do not translate mechanically
if a natural French phrasing is better. - Keep factual claims precise
and appropriately qualified. If a question has more than one defensible
answer, accept that in the answer text or rewrite the question to remove
ambiguity. - Do not invent institutional policies, services, opening
hours, transport rules, or other changing information. - For facts that
can change, prefer stable facts or clearly date-stamp and verify them in
the internal source notes.

For Gate E: - Write exactly 20 unique open-ended prompts in English and
French on the same question card. - Do not provide model answers,
suggested answers, or answer cards. - The prompt should encourage
discussion, not test factual knowledge.

For all gates: - Use inclusive, culturally sensitive language. - Never
make fun of a country, culture, religion, language, nationality, accent,
or individual. - Avoid broad statements such as "people from country X
always...". - Keep wording concise enough to fit on a card without tiny
type. - Do not put citations or URLs on the card face; put source
details in the project data.

## 5. Airport concept and visual identity

Create a cohesive airport/travel/student-exchange visual identity. The
design should feel contemporary, friendly, playful, and professional
enough for a university event.

Use only this primary palette: - Turquoise / teal blue - Dark blue /
navy - Yellow - White

Define colors as editable CSS/SVG variables or design tokens. Avoid
coral, orange, pink, or purple as dominant colors. Neutral anti-aliasing
and print-safe tints may be used only when needed, while keeping the
main palette intact.

Airport and exchange motifs may include gate signage, boarding-pass
details, destination codes, simple flight paths, an airplane, passport
stamps, luggage tags, a globe, backpacks, campus icons, and speech
bubbles. Keep the card faces legible and do not let decoration compete
with the question text.

### Five minimalist reusable card-back designs

Create **exactly five reusable back designs**, one per gate: 1.
`back_gate_A_food_language_traditions.svg` 2.
`back_gate_B_campus_city.svg` 3. `back_gate_C_random_knowledge.svg` 4.
`back_gate_D_games_culture_shock.svg` 5.
`back_gate_E_student_advice.svg`

The backs must be **minimalist, uncluttered, and category-specific**.
Use one or two simple visual motifs per back, generous negative space,
consistent margins, and the shared palette. Avoid dense patterns, lots
of small icons, paragraphs, or decorative clutter. A person should be
able to infer the gate theme quickly from its simple iconography.

Suggested motifs: - Gate A: a simple plate/utensil, speech bubble, or
small cultural motif. - Gate B: a book, backpack, campus building, or
simple city map pin. - Gate C: a question mark, lightbulb, or simple
constellation of trivia symbols. - Gate D: a game token/dice and a small
dialogue or adaptation symbol. - Gate E: two students talking, linked
speech bubbles, a compass, or a simple path symbolizing peer advice and
settling in.

All five backs should share the same visual structure, typography style,
border treatment, and overall level of simplicity. They should differ
mainly in the gate label, color arrangement within the approved palette,
and one or two theme-specific symbols. Reuse each design for all cards
assigned to that gate. Do not create unique back artwork for every card.
Do not place question or answer text on card backs.

## 6. Card layout and physical specifications

Use an editable default trim size of **56 × 87 mm**, similar to a
standard compact playing card. Make card dimensions configurable because
the event's print shop may specify a different size.

-   Default bleed: 3 mm on every edge, giving 62 × 93 mm artwork size
    when bleed is included.
-   Include safe margins so no essential text or icons are too close to
    the trim.
-   Make sure English and French text fit comfortably and remain
    readable at actual print size.
-   Include the gate letter, card ID, and a clear card type label.
-   Question card front: gate/category label, ID (e.g. `A1`), English
    question, French question.
-   Answer card front (Gates A--D only): clear `ANSWER / RÉPONSE` label,
    matching ID, English answer, French answer.
-   Gate E question cards should clearly be open-ended discussion
    prompts, but must not have an answer area or an answer card.
-   Keep front-side layout consistent across the deck. Use
    category-specific accent details, not five unrelated designs.
-   Card backs are reusable gate-specific designs and must not include
    question/answer text.

## 7. Printing and duplex alignment

Create two PDF exports: 1. `cards_home_print_A4.pdf` --- home-printing
version laid out on A4 sheets, multiple cards per page, with practical
cut guides and clear instructions for printing fronts and backs. 2.
`cards_print_shop.pdf` --- professional print-shop version with
correctly configured trim, bleed, and crop marks as requested by the
selected printer.

Also provide a configurable print settings file. Do not claim that the
print-shop PDF meets a printer's exact specifications unless those
specifications were supplied and the output was checked against them.

Duplex printing must be planned carefully: - Provide explicit
instructions for the chosen page layout and the required duplex flip
setting. - Ensure the backs align with the correct front cards after
printing and cutting. - Account for the actual orientation of each sheet
and the printer's flip edge. - Include a verification/test page or clear
procedure to check alignment before printing the full deck. - Do not
silently assume that all printers use the same duplex orientation.

## 8. Required deliverables

Create the following in the project workspace, adapting folder names
only when needed to fit an existing project:

-   `data/cards.json`
    -   Structured records for all 180 physical cards.
    -   Include card ID, card type, gate, topic/subcategory, English
        text, French text, matching ID where applicable, source URLs,
        and concise verification notes for factual items.
    -   Gate E must contain only question records and no answer records.
-   `data/cards.csv`
    -   A practical flat export of the same card data, with columns that
        distinguish questions and answers and preserve bilingual content
        and pair IDs.
-   Editable HTML/CSS/JavaScript or TypeScript source for card
    generation and preview.
-   `preview_gallery.html` showing all question and answer fronts,
    grouped by gate, plus the five back designs.
-   Five editable SVG back designs in `assets/backs/` with the filenames
    listed above.
-   A configurable print settings file for card dimensions, bleed,
    margins, page layout, and duplex orientation.
-   `cards_home_print_A4.pdf`.
-   `cards_print_shop.pdf`.
-   `QC_REPORT.md` documenting counts, validation results, source
    verification, any unresolved issues, and print checks.
-   `README.md` with setup/run instructions, project structure, how to
    edit questions and answers, how to regenerate previews/PDFs, and how
    to change print settings.
-   `cards_source.zip` containing the source, data, SVG assets,
    documentation, preview, and generated PDFs when feasible.

Keep source files editable. Do not deliver only flattened PDFs or PNGs.

## 9. Canva / Higgsfield and asset handling

If Canva or Higgsfield is genuinely available through an authorized
integration in the environment, you may use it for supporting graphic
assets. Do not claim access or successful integration unless it is
actually available and used.

If those tools are not available, build editable local SVG/HTML/CSS
assets that can be imported or adapted in Canva. Keep text and artwork
separate. Do not generate or embed question text inside AI-generated
images; all card text must remain editable and selectable.

Prefer clean vector icons and simple illustrations that reproduce well
in print. Ensure all assets are legally usable and record any external
asset source or license in the README.

## 10. Suggested implementation workflow

1.  Inspect the existing workspace and preserve existing files.
2.  Obtain and verify the partner-university list; resolve ambiguous
    names/campuses before writing destination-specific facts.
3.  Create the design tokens and a content schema.
4.  Draft and audit the questions and answers according to the exact
    per-gate counts.
5.  Verify factual answers and record sources in the data.
6.  Create a small prototype: a representative question card and
    matching answer card from one of Gates A--D, one Gate E discussion
    card, and all five minimalist back designs.
7.  If the environment supports user review, show the prototype for
    approval before producing the full artwork. If it does not support
    interactive review, document the prototype clearly and continue
    using the requirements in this prompt.
8.  Generate all 180 physical card records and all editable
    source/assets.
9.  Generate preview gallery and both PDF versions.
10. Run automated data, layout, and print checks; fix any issues rather
    than merely reporting them.
11. Package the project and write the QC report and README.

Use sensible defaults for nonessential details. Do not stop to ask about
minor stylistic choices already constrained by this prompt.

## 11. Mandatory quality-control checklist

Automate as many of these checks as possible and record the results in
`QC_REPORT.md`.

### Content and counts

-   Exactly 20 question IDs per gate: A1--A20, B1--B20, C1--C20,
    D1--D20, E1--E20.
-   Exactly 100 question cards total.
-   Exactly 80 answer cards total, only for Gates A--D.
-   Exactly 180 physical cards total.
-   Exactly 20 matching question-answer pairs for each of Gates A--D.
-   Zero answer cards and zero model answers for Gate E.
-   No duplicate IDs within a card type, missing numbers, missing
    translations, or unmatched answers.
-   Every English question and answer has a natural French equivalent,
    except that Gate E has questions only and still requires both
    languages.
-   No repeated or near-duplicate questions within the same gate.
-   Gate content matches its stated theme.

### Accuracy and sensitivity

-   Factual answers are checked against recorded reliable sources
    wherever research is available.
-   University names, cities, and countries are verified, with ambiguous
    campuses resolved rather than guessed.
-   No invented university policies, facilities, or services.
-   No stereotypes, culturally insulting jokes, or unsupported claims
    about national traditions.
-   Any unverified facts or limitations are explicitly documented.

### Design and print

-   Exactly five reusable minimalist back designs exist, one per gate.
-   Back design theme corresponds to the correct gate.
-   The approved palette is used consistently.
-   All text fits within safe margins and is readable at actual size.
-   Card size, bleed, trim, and crop marks match the configured
    settings.
-   Duplex alignment maps each back to the correct gate/front
    assignment.
-   PDFs open successfully and contain the expected number of
    cards/pages.
-   The preview gallery accurately represents the generated files.
-   Editable source files and all requested deliverables are present.

## 12. Final response after implementation

When finished, report briefly: - What was created. - The exact
question/answer/card counts. - Which university locations were verified
and any unresolved ambiguities. - Whether the two PDFs and source ZIP
were generated. - Any limitations or print-shop settings that still need
confirmation.

Do not say that an artifact was generated, validated, or verified unless
you actually completed that step. If something cannot be produced in the
environment, explain the limitation and provide the most useful editable
alternative.
