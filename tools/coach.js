// The SHOW ME HOW coach: on every question, with touch, mouse and keyboard.
//   node coach.js [app.html] [shots-dir]
// On an iPad (820×1180, touch) and a 1440×900 laptop (mouse + keyboard):
// - every written question of every pack of every child (each bank's
//   questions, each reading passage's, each pack's critical-thinking puzzles:
//   the same questions the About page counts, writtenQuestionCount(), and the
//   check fails if the two counts differ) has its own SHOW ME HOW steps (a
//   `how` with at least two steps), and the coach for it, coachFor(), has a
//   method name and those steps. So does every item of every Reading Road
//   stop, for each child. One round dealt from every pack (the generated
//   math, the boss battles, the puzzle mixes) also gets a coach with a name
//   and at least two real steps; generators.js checks the generators' own
//   steps in depth.
// - for the kindergartener and the 5th grader, NEED HELP opens the coach over
//   a real round: the question behind it is inert, focus is on NEXT, tapping
//   NEXT (iPad) or the arrow keys and Enter (laptop) walk every card and close
//   it, the kindergartener hears every step read aloud, coachUsed counts
//   once, and on the laptop Esc closes it without also opening the exit
//   pop-up.
// Screenshots of the first and last card go to out/shots/coach/.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const written = require('./lib/written');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const OUT = path.resolve(process.argv[3] || path.join(__dirname, 'out', 'shots', 'coach'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
fs.mkdirSync(OUT, { recursive: true });
const fails = [];
let cover = null;
const n = x => x.toLocaleString('en-US');
(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM });
  for (const dev of [{ n: 'ipad', w: 820, h: 1180, t: true }, { n: 'laptop', w: 1440, h: 900, t: false }]) {
    const p = await (await b.newContext({ viewport: { width: dev.w, height: dev.h }, hasTouch: dev.t })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    await p.evaluate(written.install);
    // Every question gets a coach with real steps; every written one, its own.
    cover = await p.evaluate(() => {
      const r = { expected: writtenQuestionCount(), unique: 0, inPacks: 0, road: 0, roadStops: 0, roadKids: 0, dealt: 0,
                  unusable: [], noOwn: [], notOwn: [] };
      const seen = new Set();
      const own = q => !!(q.how && Array.isArray(q.how.steps) && q.how.steps.length >= 2 &&
        q.how.steps.every(s => typeof s === 'string' && s.trim()));
      const label = (pk, q) => pk.id + ' "' + String(q.text || q.statement || (q.partA && q.partA.text) || '').replace(/<[^>]*>/g, '').slice(0, 50) + '"';
      // needOwn: the question must carry its own steps, and the coach must use them.
      const check = (q, pk, needOwn) => {
        const c = coachFor(q, pk);
        if (!c || !c.name || !Array.isArray(c.steps) || c.steps.length < 2 || c.steps.some(s => !s || typeof s !== 'string')) r.unusable.push(label(pk, q));
        if (!needOwn) return;
        if (!own(q)) r.noOwn.push(label(pk, q));
        else if (c.steps.join('\n') !== q.how.steps.join('\n')) r.notOwn.push(label(pk, q));
      };
      for (const pid of Object.keys(PACKS)) {
        pickProfile(pid);
        for (const pk of PACKS[pid]) {
          currentPack = pk;
          for (const { q, src } of ttWritten(pk)) { r.inPacks++; seen.add(src); check(q, pk, true); }
          for (const q of getQuestions(pk, pk.home || pid)) { r.dealt++; check(q, pk, false); }
        }
        const road = PACKS[pid].find(pk => pk.id === 'reading_road');
        if (road) {
          r.roadKids++;
          for (const { stop, items } of ttRoadItems(pid)) {
            r.roadStops++;
            road._readingStop = stop.id; currentPack = road;
            for (const q of items) { r.road++; check(q, road, true); }
          }
          delete road._readingStop;
        }
      }
      currentPack = null;
      r.unique = seen.size;
      return r;
    });
    if (cover.unique !== cover.expected) fails.push(`${dev.n}: covered ${cover.unique} written questions, the game counts ${cover.expected} (update lib/written.js to the game's banks)`);
    if (cover.unusable.length) fails.push(`${dev.n}: ${cover.unusable.length} questions without a usable coach: ${cover.unusable.slice(0, 5).join(' | ')}`);
    if (cover.noOwn.length) fails.push(`${dev.n}: ${cover.noOwn.length} written questions or road items without their own steps: ${cover.noOwn.slice(0, 5).join(' | ')}`);
    if (cover.notOwn.length) fails.push(`${dev.n}: ${cover.notOwn.length} coaches not using the question's own steps: ${cover.notOwn.slice(0, 5).join(' | ')}`);
    for (const pid of ['k', 'g5']) {
      await p.evaluate(pid => { pickProfile(pid); const pk = PACKS[pid].find(x => x.tier === 'now'); startPack(pk.id);
        const go = document.querySelector('.briefing-go'); if (go) go.click(); }, pid);
      await p.waitForTimeout(400);
      await p.evaluate(() => { window.__said = []; window.speakText = (t, e) => { __said.push(t); }; });
      const btn = p.locator('.help-btn');
      if (dev.t) await btn.tap(); else await btn.click();
      await p.waitForTimeout(400);
      if (!(await p.locator('#coach-overlay').count())) { fails.push(`${dev.n}/${pid}: coach did not open`); continue; }
      const st = await p.evaluate(() => ({ inert: app.inert, steps: coachState.c.steps.length, focus: document.activeElement.id }));
      if (!st.inert) fails.push(`${dev.n}/${pid}: question behind the coach is not inert`);
      if (st.focus !== 'coach-next') fails.push(`${dev.n}/${pid}: focus not on NEXT (${st.focus})`);
      await p.screenshot({ path: path.join(OUT, `coach-${dev.n}-${pid}-1.png`) });
      // Walk it: keyboard arrows on the laptop, taps on the iPad.
      for (let k = 0; k < st.steps; k++) {
        if (dev.t) await p.locator('#coach-next').tap(); else await p.keyboard.press(k === st.steps - 1 ? 'Enter' : 'ArrowRight');
        await p.waitForTimeout(250);
        if (k === st.steps - 2) await p.screenshot({ path: path.join(OUT, `coach-${dev.n}-${pid}-last.png`) });
      }
      const after = await p.evaluate(() => ({ open: !!document.getElementById('coach-overlay'), inert: app.inert, said: __said.length, used: state.profiles[currentProfile.id].coachUsed }));
      if (after.open) fails.push(`${dev.n}/${pid}: coach did not close after the last card`);
      if (after.inert) fails.push(`${dev.n}/${pid}: question left inert`);
      if (pid === 'k' && after.said < st.steps) fails.push(`${dev.n}/${pid}: early reader heard ${after.said} of ${st.steps} steps`);
      if (after.used !== 1) fails.push(`${dev.n}/${pid}: coachUsed is ${after.used}`);
      // Esc closes it; the round carries on.
      if (!dev.t) {
        await p.locator('.help-btn').click(); await p.waitForTimeout(250);
        await p.keyboard.press('Escape'); await p.waitForTimeout(250);
        if (await p.locator('#coach-overlay').count()) fails.push(`${dev.n}/${pid}: Esc did not close the coach`);
        if (await p.locator('#exit-modal-backdrop').count()) fails.push(`${dev.n}/${pid}: Esc also opened the exit pop-up`);
      }
      await p.evaluate(() => { exitToHub(); });
    }
    errs.forEach(e => fails.push(`${dev.n}: JS error ${e}`));
    console.log(`${dev.n}: ${cover.unique} written questions (${cover.inPacks} in their packs; the game counts ${cover.expected}), ` +
      `${cover.road / (cover.roadKids || 1)} Reading Road items in ${cover.roadStops / (cover.roadKids || 1)} stops for each of ${cover.roadKids} children, ` +
      `${cover.dealt} dealt in one round of every pack`);
  }
  await b.close();
  fails.forEach(f => console.log('FAIL ' + f));
  console.log(fails.length ? `coach: FAIL — ${fails.length} problems`
    : `coach: PASS — own steps on all ${n(cover.unique)} written questions and ${n(cover.road / (cover.roadKids || 1))} Reading Road items; opens, walks and closes by touch and keyboard`);
  process.exit(fails.length ? 1 : 0);
})();
