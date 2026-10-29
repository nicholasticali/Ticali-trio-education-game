# Checks

    npm install          # playwright only; the browser is already on the machine

Then, for every check below on the game file (all but `validate-packs.js`,
which checks a folder of bank files, not the game):

    ./run-all.sh         # or: npm test

It prints one line per check (PASS or FAIL, how long it took, and the check's
own result line), keeps each check's whole output in `out/logs/<check>.log`, and
exits non-zero if any check failed. `JOBS=3 ./run-all.sh` runs three at a time;
`./run-all.sh modules voice` runs just those groups (`repo`, `extras`, `modules`)
or checks; `./run-all.sh path/to/app.html` runs them on another copy of the game
(a relative path is taken from the folder you run it in).

Or one at a time:

| command | what it proves |
|---|---|
| `node packcheck.js` | every pack in every profile returns a full, well-formed round of ten — including the puzzle types (order, sort, multi, twopart) — every question drawn in six sampled rounds has a **why**, and every pack has its **why this matters** line. Catches a pack pointing at a bank that does not exist, which is otherwise invisible until a child taps it |
| `node smoke.js` | a whole round plays at six viewports (iPad portrait/landscape, 12.9", Split View, iPhone, touch laptop): the briefing card, then every other question missed once on purpose so the THINK AGAIN hint and second try are exercised, every answer followed by a HERE'S WHY panel. Reports JS errors, horizontal overflow, and any tap target under 44px |
| `node screens.js` | the screens `smoke.js` never opens — parent dashboard, progress chart, a walkthrough, the scratch pad (draw, undo, close), the number pad (readonly, backspace, keyboard escape hatch), each puzzle type for the youngest and oldest child, and every child's briefing card |
| `node platforms.js` | the same round plays the same way on a laptop with only a mouse, a laptop driven only by the keyboard (Tab, Enter, A-D, T/F, digits), a touchscreen laptop, and an iPad in both orientations — for every child, with every question type, ending in a perfect score each time. Fails on a tap that does not register, a control the keyboard cannot reach, a target under 44px, or a JS error |
| `node saves.js` | the children's saved progress survives a page load: this year's save, last year's (pre-K, 2nd and 4th grade keys), an old save missing newer fields, play-then-reload, a corrupt save (kept aside, never overwritten), and storage that throws (private browsing) — the game still plays. Every other test starts from empty storage |
| `node coach.js` | SHOW ME HOW works on every question: every written question in the game (each bank's, each reading passage's, each pack's puzzles: the questions the About page counts, and the check fails if its count and the About page's ever differ) carries its own steps, and its coach uses them; so does every item of every Reading Road stop, for each child; one round dealt from every pack (generated math, boss battles, puzzle mixes) gets a coach with a method and at least two steps. Over a real round on an iPad and a laptop, NEED HELP opens it with the question behind it inert and focus on NEXT; every card can be walked by tapping NEXT or with the arrow keys and Enter, the kindergartener hears every step, and Esc closes it without opening the exit pop-up. Screenshots in `out/shots/coach/` |
| `node readaloud.js` | every kindergarten and 1st grade question has a 🔊 for the question, for each answer with words in it, each order piece, sort item and sort group, and the story. Rendered for the child who would see it: every written question of every pack the kindergartener has and of every K and 1st grade pack her older siblings can explore, a dealt round of each of those packs (five for generated math), and every item of the Reading Road's K and 1st grade stops |
| `node speech.js` | the speech, focus and pop-up rules: blends are said sound by sound and emoji are never read out; a screen change drops a pending auto-read; Enter, Space or a tap on a 🔊 inside an answer reads it and never picks it, and a swipe that starts on one reads nothing; a double click, a double CHECK or the same wrong typed answer twice costs one try, not two; auto-read reads the story before the question. A walkthrough or the scratch pad makes the page behind it inert and gives focus back on Esc; every button is in the Tab order. The kindergartener's pack cards, exit pop-up and round-complete card are read to her |
| `node voice.js` | with the voice lists of four devices faked (an iPad with and without a premium voice, Edge with online voices, Chrome on Windows), the most natural English voice is chosen and speaks at the right pace; when an online voice fails the line goes to a built-in one; the parent's voice picker starts with Automatic, has 44px rows, saves and previews the choice, and keeps it after a reload |
| `node about.js` | the grown-ups' About page opens from the title screen on an iPad (both ways), a laptop and a phone, never scrolls sideways, has 44px targets on touch screens, lists each grade's subjects, and Esc goes back. Screenshots in `out/shots/about/` |
| `node reset.js` | RESET in the parent dashboard wipes the children's progress, the undo then brings all of it back, and after that the undo goes away |
| `node boss-example.js` | in a boss battle, where the questions come from many packs, SHOW ME HOW ends by offering the worked example of the pack each question came from, wherever that pack has one |
| `node generators.js` | every random math generator, run 300 times (`RUNS=` to change): each question's SHOW ME HOW steps fit the child's word limit, have no symbol the voice cannot say for the kindergartener, end with "Now…", and never give away the answer (a true/false step never says only "true" or "false"); every generated pack still returns full rounds |
| `node modules/readcheck.js` | the Reading Road's content, `READING_ROAD` in the game file, keeps its rules: every word of a story the child reads herself, and of each word card shown to her, is decodable with the spellings and Tricky Words taught so far; 1-3 learn cards of 3-5 words; 5-7 practice items of at least 3 types; a story's questions include a literal, a sequence or cause, and an inference one (from 2nd grade also vocabulary and a two-part evidence one); why, hint and SHOW ME HOW on every item; word limits for K and 1st grade. Give it a folder or `.json` files to check land files before they go into `READING_ROAD` |
| `node validate-packs.js <dir>` | shape-checks raw question-bank `.js` files before they are merged into the app, including puzzle types, and warns on a missing why or hint |

## The fun modules

Each fun module has its own suite. It runs on the game file with every module
built in, so it also proves the module works alongside the others. A suite fails
at once if the game file does not have its module. A pass that needs another
module (the boss suite's pass with the buddy and stickers, the family suite's
speed sprint, the missions suite's pass with the other modules, the reading
suite's real content) is skipped only when that module is missing, and the
suite's result line then names what it skipped.

| command | what it proves |
|---|---|
| `node modules/buddy.test.js` | Brain Buddy: the first-visit chooser and MAYBE LATER (asked again next visit), picking and naming, the hub card at every stage, the buddy room (pet, more, close three ways, change buddy), quiz-bar reactions, level-ups with and without a new stage, both trophies and the round-complete reaction — for the kindergartener and the 5th grader on an iPad and a laptop, then at 390px and with reduced motion |
| `node modules/stickers.test.js` | the Sticker Book: 48 stickers in 6 sets of 8, each with a fact; a sticker for a round and a bonus one for a perfect round, flipped in on the complete screen and read to the kindergartener; the book's mystery slots, set counts and trophies — through real rounds for the kindergartener and the 5th grader on an iPad and a laptop, and at 390px |
| `node modules/boss.test.js` | Boss Battles: the hub card and VS briefing, the arena (zap, half zap after a hint, super zap, a miss, a retry), victory and escape, running out of questions, leaving mid-battle, BOSS LEGEND and the rematch lap, a mixed round won through real taps, broken saved data — for the kindergartener and the 5th grader on an iPad and a laptop, keyboard only, at 390px with reduced motion, and with the child's buddy in the arena and a boss sticker awarded |
| `node modules/missions.test.js` | Daily Missions and the day streak: three grade-suited missions a day, read to the kindergartener, each pointing to where it is done; missions finishing mid-round and at the round's end; the bonus once a day; the streak kept, broken and welcomed back; the trophies, the parent dashboard, broken saved data, and a real boss battle finishing the boss mission — on an iPad and a laptop, keyboard only and at 390px. On a busy machine an answer pressed while the next question is still settling may not count; the suite then presses it once more, prints a `note:` line, and its result line says how many answers it pressed twice |
| `node modules/sprint.test.js` | Speed Sprints: thousands of problems for each older child and the kindergartener's 40 facts, each answer worked out again here from the problem's text, with plausible wrong answers and no repeats in a run; the countdown, timer, right and wrong answers, pause and RESUME, results, best score and XP, LIGHTNING, ending early, a closed tab, a reload and the parent dashboard — for each child on an iPad and a laptop, keyboard only, old saves, at 390px with reduced motion and on an iPad in landscape, and its place among the other modules |
| `node modules/family.test.js` | the Family Team Goal: the title panel's three-color meter and weekly total with no ranking, each child's hub card and round-complete strip, reaching the goal (celebrated once a week), the parent's reward, target and "Mark as claimed ✓", the week rolling over and a round past Sunday midnight, two tabs, old and broken saves, and a speed sprint's XP turning into stars — for the kindergartener and the 5th grader on an iPad and a laptop, keyboard only, at 390px and with reduced motion. `node modules/family.test.js fixes,sprint` runs just those parts (logic, flows, ipad-k, g3, midnight, keyboard, sizes, motion, saves, fixes, together, sprint) |
| `node modules/reading.test.js` | the Reading Road, on two small sample lands: from the hub to the map and a whole stop (learn cards, a story with tapped words and read-to-me, the round, stars, the next stop opening), leaving a round half way, finishing a land, the parent controls, progress kept over a reload, placement for each child, broken saved data — by touch, mouse and keyboard, on an iPad and a laptop, for the kindergartener and the 5th grader, and at 390px. Then the road data placed after the module, no data at all, and every stop of the real `READING_ROAD` rendered. `--quick` plays one touch and one keyboard run per child |

The modules are built into the game file: each module's script opens with
`// ─── module: <name> ───` after `/* ═══ FUN MODULES ═══ */`, and its styles
with `/* ─── module: <name> ─── */` after `/* ═══ FUN MODULE STYLES ═══ */`.
When a suite needs the game another way, `modules/app.js` derives that copy
from the game file itself into `out/builds/` (the game file is only read). The
reading suite does: it plays the sample lands in `modules/fixtures/` in place of
`READING_ROAD`, the same data placed after the reading module, and the module
with no data at all.
`node modules/app.js` lists the modules a game file has, and
`node modules/app.js without reading-data,reading` writes the game without them
(here, with no Reading Road) to `out/builds/`, to try by hand.

Every check takes an optional path to the HTML file as the first argument and
defaults to the one beside this directory (the module suites also read it from
`TT_APP`); `validate-packs.js` needs the folder of bank files to check, and
`coach.js` takes a second argument, the folder for its screenshots.
`coach.js` and `readaloud.js` find every written question with `lib/written.js`,
which reads the same banks as the game's own `writtenQuestionCount()`.

Screenshots go to `out/shots/<check>/`. Git ignores all of `out/`.

Every browser check launches Chromium from `/opt/pw-browsers/chromium`. Set
`CHROMIUM_PATH` if yours lives elsewhere.

One at a time, everything takes about 80 minutes: the module suites 5 to 11
minutes each, `platforms.js` about 14, `smoke.js` about 6, `screens.js` about 2
and the rest under a minute each. `JOBS=3 ./run-all.sh` takes about 30 minutes
on a 4-core machine; more jobs than cores can make the timed module checks slow
enough to fail.

Real Safari is not available on this machine. The iPad runs above are Chromium with
touch input at iPad screen sizes, so try a round on the real iPads after a big change.
