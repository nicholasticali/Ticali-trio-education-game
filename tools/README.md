# Checks

    npm install          # playwright only; the browser is already on the machine

Then:

| command | what it proves |
|---|---|
| `node packcheck.js` | every pack in every profile returns a full, well-formed round of ten — including the puzzle types (order, sort, multi, twopart) — every question drawn in six sampled rounds has a **why**, and every pack has its **why this matters** line. Catches a pack pointing at a bank that does not exist, which is otherwise invisible until a child taps it |
| `node smoke.js` | a whole round plays at six viewports (iPad portrait/landscape, 12.9", Split View, iPhone, touch laptop): the briefing card, then every other question missed once on purpose so the THINK AGAIN hint and second try are exercised, every answer followed by a HERE'S WHY panel. Reports JS errors, horizontal overflow, and any tap target under 44px |
| `node screens.js` | the screens `smoke.js` never opens — parent dashboard, progress chart, a walkthrough, the scratch pad (draw, undo, close), the number pad (readonly, backspace, keyboard escape hatch), each puzzle type for the youngest and oldest child, and every child's briefing card |
| `node validate-packs.js <dir>` | shape-checks raw question-bank `.js` files before they are merged into the app, including puzzle types, and warns on a missing why or hint |

All four take an optional path to the HTML file as the first argument; they default
to the one beside this directory.

`smoke.js` and `screens.js` need Chromium at `/opt/pw-browsers/chromium`. Change
`executablePath` if yours lives elsewhere, or drop the option to use Playwright's
own download.
