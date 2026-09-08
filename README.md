# Ticali Trio — Family Edition

One HTML file. Open it on an iPad, a touchscreen laptop, or a phone and three
children get their own profile, their own colour, and packs of ten mixed questions
drawn from the work their school is actually doing this year.

No install, no server, no account, no network. Progress lives in the browser's
local storage on that device.

    ticali-trio/Ticali_Trio_Family_Edition.html

Put it in iCloud Drive or email it to the iPad, open it in Safari, then
**Share ▸ Add to Home Screen** and it gets a real app tile and runs full-screen.

## The three kids, 2026-2027

| Profile | Grade | Colour |
|---|---|---|
| 🌈 Kindergarten | K | pink |
| ⚡ 3rd Grade | 3 | blue |
| 🔥 5th Grade | 5 | orange |

Each hub is laid out the way a school year actually is:

- **MY GRADE THIS YEAR** — broken out by subject: math, reading and writing, books
  and knowledge, science, social studies, tech, health, state test prep.
- **ALSO ON THE SCIENCE TEST** (fifth grader only) — Maryland's grade 5 science
  test draws on the standards for grades 3, 4 *and* 5, so last year's science is
  not review, it is on the test.
- **REVIEW** — last year's work, kept because coming back to it is how it sticks.
- **LOOKING AHEAD** — a peek at next year.

Profiles move up a grade each September. When they do, a save written under the
old keys is re-keyed on load, so XP, trophies and round history carry over instead
of being abandoned.

## Question types

Every pack mixes them, roughly half and half:

- **multiple choice** — four options, shuffled on every replay
- **true / false**
- **type it** — free text, case-insensitive
- **fill in the blank**
- **show your work** — the child works it on paper, types the final answer, and the
  item is queued for a parent to look at in the parent dashboard

## On a touchscreen

The app was rebuilt around a finger:

- Hover effects only apply to a real mouse or trackpad, so a tapped answer never
  stays stuck looking selected.
- Tap targets grow wherever a finger might be used — which includes a touchscreen
  laptop that also has a trackpad. Answers are 84px, the in-card read-aloud speaker
  is 52px square, every control clears 44px.
- `100dvh` and safe-area insets, so the Safari toolbar and the home indicator never
  cover anything, and the page cannot rubber-band or pull-to-refresh mid-question.
- In landscape with room for it, reading passages park in a sticky column beside
  the question instead of making a child scroll up to re-read and back down to
  answer.
- **Typed math answers get an on-screen number pad** and never raise the system
  keyboard — the input is readonly so iOS leaves it alone. There is a button to
  switch to the real keyboard. Word answers use the keyboard but with autocorrect
  off, which was silently rewriting spelling answers.
- **Read aloud** is available in every grade. Kindergarten gets a speaker on each
  individual choice and auto-read on by default; the readers get one button that
  reads the question and all four choices.
- **Scratch pad** (the ✏️ in the quiz bar) takes an Apple Pencil with pressure,
  a finger, or a mouse. Strokes are kept as vectors, so undo works, rotating the
  iPad does not stretch or lose the work, and once a Pencil has been used a resting
  palm stops drawing.
- Reduced Motion is respected.

## Parent side

Tap **parent** in the bottom-right corner. PIN is `0000`.

- Per-child XP, accuracy, streak, rounds played, and a progress chart.
- The show-your-work queue: what the child typed, what was expected, and buttons to
  mark the paper good or needing another go.
- Reset.

## Curriculum

Aligned to what Anne Arundel County Public Schools actually uses — Amplify CKLA for
reading, McGraw Hill Reveal Math for math, NGSS for science, and the Maryland social
studies standards.

**Read [CURRICULUM-NOTES.md](CURRICULUM-NOTES.md) before trusting that sentence
too far.** It sets out exactly which claims were verified, which were reported but
could not be confirmed, and which were not researched at all — and why. Short
version: the CKLA unit sequences and the science and social studies structures held
up; the specific *codes* for Maryland's revised 2025 mathematics standards did not
survive an adversarial check, so no question in the app cites a standard code at
all. Everything is written to the content a child must be able to handle.

## Working on it

The banks are plain arrays of question objects. To add one, write the array, drop
it in the file, add its name to `BANKS`, and add a pack entry pointing at it:

```js
{ id:'g3_thing', title:'The Thing', icon:'🧪', subject:'science',
  tier:'now', desc:'What it covers.', bank:'G3_THING' },
```

`tier` is `now` (this grade), `review` (last year), `ahead` (next year), or `misa`
(on the fifth grader's science test). `subject` picks which section of the hub it
lands in.

Two checks are worth running after any change — both need
`npm i playwright` and the Chromium at `/opt/pw-browsers/chromium`:

- **`packcheck.js`** loads the app in a browser and asserts every pack in every
  profile returns a full, well-formed round of ten. It catches a pack pointing at a
  bank that does not exist, which is otherwise invisible until a child taps it.
- **`smoke.js`** plays a whole round at six viewports (iPad portrait and landscape,
  12.9", Split View, iPhone, touch laptop) and reports JS errors, horizontal
  overflow, and any tap target under 44px.
