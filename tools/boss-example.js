// SHOW ME HOW in a boss battle offers the worked example of the question's own pack.
//   node boss-example.js [app.html]
// A boss battle mixes questions from many packs. For the kindergartener, six
// battles are started and the coach is opened on every question and walked to
// its last card: wherever the pack a question came from has a walkthrough
// (TUTORIALS), the last card's worked-example button opens that pack's
// walkthrough. Fails if any such question has no button or the wrong pack's,
// if no question had one to offer, or on a JS error.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM }); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  const r = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    pickProfile('k'); await wait(100);
    let tried = 0, shown = 0, eligible = 0;
    for (let round = 0; round < 6; round++) {
      bossStart(); await wait(50); const go = document.querySelector('.briefing-go'); if (go) go.click(); await wait(50);
      for (let i = 0; i < questions.length; i++) {
        qIdx = i; locked = false; renderQuestion(); await wait(5);
        const q = questions[i]; const has = !!(q._bossPack && TUTORIALS[q._bossPack]);
        openCoach(); coachState.i = coachState.c.steps.length - 1; renderCoach();
        const btn = document.querySelector('.coach-example'); tried++;
        if (has) { eligible++; if (btn && btn.getAttribute('onclick').includes(q._bossPack)) shown++; }
        closeCoach();
      }
    }
    return { tried, eligible, shown };
  });
  await b.close();
  console.log(`${r.tried} boss questions coached; ${r.eligible} came from a pack with a walkthrough; ${r.shown} offered it`);
  errs.forEach(e => console.log('FAIL JS error ' + e));
  const ok = r.eligible > 0 && r.shown === r.eligible && !errs.length;
  console.log(ok ? `boss-example: PASS — all ${r.eligible} offered their own pack's worked example`
    : `boss-example: FAIL — ${r.eligible - r.shown} of ${r.eligible} without their pack's worked example${r.eligible ? '' : ' (none to check)'}, ${errs.length} JS errors`);
  process.exit(ok ? 0 : 1);
})();
