# Checks

    npm install          # playwright only; the browser is already on the machine

Then:

| command | what it proves |
|---|---|
| `node packcheck.js` | every pack in every profile returns a full, well-formed round of ten — including the puzzle types (order, sort, multi, twopart) — every question drawn in six sampled rounds has a **why**, and every pack has its **why this matters** line. Catches a pack pointing at a bank that does not exist, which is otherwise invisible until a child taps it |
| `node smoke.js` | a whole round plays at six viewports (iPad portrait/landscape, 12.9", Split View, iPhone, touch laptop): the briefing card, then every other question missed once on purpose so the THINK AGAIN hint and second try are exercised, every answer followed by a HERE'S WHY panel. Reports JS errors, horizontal overflow, and any tap target under 44px |
| `node screens.js` | the screens `smoke.js` never opens — parent dashboard, progress chart, a walkthrough, the scratch pad (draw, undo, close), the number pad (readonly, backspace, keyboard escape hatch), each puzzle type for the youngest and oldest child, and every child's briefing card |
| `node platforms.js` | the same round plays the same way on a laptop with only a mouse, a laptop driven only by the keyboard (Tab, Enter, A-D, T/F, digits), a touchscreen laptop, and an iPad in both orientations — for every child, with every question type, ending in a perfect score each time. Fails on a tap that does not register, a control the keyboard cannot reach, a target under 44px, or a JS error |
| `node saves.js` | the children's saved progress survives a page load: this year's save, last year's (pre-K, 2nd and 4th grade keys), an old save missing newer fields, play-then-reload, a corrupt save (kept aside, never overwritten), and storage that throws (private browsing) — the game still plays. Every other test starts from empty storage |
| `node validate-packs.js <dir>` | shape-checks raw question-bank `.js` files before they are merged into the app, including puzzle types, and warns on a missing why or hint |

All six take an optional path to the HTML file as the first argument; they default
to the one beside this directory.

`smoke.js`, `screens.js`, `platforms.js` and `saves.js` need Chromium at `/opt/pw-browsers/chromium`. Change
`executablePath` if yours lives elsewhere, or drop the option to use Playwright's
own download.

Real Safari is not available on this machine. The iPad runs above are Chromium with
touch input at iPad screen sizes, so try a round on the real iPads after a big change.
