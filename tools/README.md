# Checks

    npm install          # playwright only; the browser is already on the machine

Then:

| command | what it proves |
|---|---|
| `node packcheck.js` | every pack in every profile returns a full, well-formed round of ten — catches a pack pointing at a bank that does not exist, which is otherwise invisible until a child taps it |
| `node smoke.js` | a whole round plays at six viewports (iPad portrait/landscape, 12.9", Split View, iPhone, touch laptop) with no JS errors, no horizontal overflow, and no tap target under 44px |
| `node screens.js` | the screens `smoke.js` never opens — parent dashboard, progress chart, a walkthrough, the scratch pad (draw, undo, close) and the number pad (readonly, backspace, keyboard escape hatch) |
| `node validate-packs.js <dir>` | shape-checks raw question-bank `.js` files before they are merged into the app |

All four take an optional path to the HTML file as the first argument; they default
to the one beside this directory.

`smoke.js` and `screens.js` need Chromium at `/opt/pw-browsers/chromium`. Change
`executablePath` if yours lives elsewhere, or drop the option to use Playwright's
own download.
