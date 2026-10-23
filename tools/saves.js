// The children's saved progress must survive every page load. Every other
// test starts from empty storage, which is how a bug that discarded every
// save on load (September to October 2026) went unnoticed. This seeds real
// saves — this year's, last year's, an old one missing newer fields, a
// corrupt one — reloads, and checks nothing is lost.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const KEY = 'tapChampions_v3';

const profile = (xp, extra) => Object.assign({ xp, trophies: ['first_pack'], packs: { demo: { best: 9, total: 10 } }, rounds: {},
  reviews: [], correct: 40, attempts: 50, bestStreak: 7, summerMode: false, autoRead: false,
  history: [{ d: '2026-10-01', xp: 30 }] }, extra || {});

const CASES = [
  { name: "this year's save", save: { profiles: { k: profile(777, { autoRead: true }), g3: profile(1500), g5: profile(2400) },
      parent: { reportRequired: false, secondChance: false } },
    expect: { k: 777, g3: 1500, g5: 2400 }, parent: { reportRequired: false, secondChance: false } },
  { name: "last year's save (pre-K, 2nd and 4th grade keys)", save: { profiles: { prek: profile(111), g2: profile(222), g4: profile(333) },
      parent: { reportRequired: true } },
    expect: { k: 111, g3: 222, g5: 333 } },
  { name: 'an old save missing newer fields', save: { profiles: { k: { xp: 50, trophies: [], packs: {} }, g3: { xp: 60, trophies: [], packs: {} }, g5: { xp: 70, trophies: [], packs: {} } } },
    expect: { k: 50, g3: 60, g5: 70 } },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fails = [];
  for (const c of CASES) {
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(APP);
    await page.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(s)); }, [KEY, c.save]);
    await page.reload(); await page.waitForTimeout(300);
    const got = await page.evaluate(() => ({ k: state.profiles.k.xp, g3: state.profiles.g3.xp, g5: state.profiles.g5.xp, parent: state.parent }));
    for (const pid of ['k', 'g3', 'g5']) if (got[pid] !== c.expect[pid]) fails.push(`${c.name}: ${pid} loaded ${got[pid]} XP, saved ${c.expect[pid]}`);
    if (c.parent) for (const [k, v] of Object.entries(c.parent)) if (got.parent[k] !== v) fails.push(`${c.name}: parent.${k} became ${got.parent[k]}`);
    // Play one answer (which saves), reload: progress only goes up.
    await page.evaluate(() => {
      pickProfile('g5');
      const pk = PACKS.g5.find(p => p.tier === 'now'); startPack(pk.id);
      const go = document.querySelector('.briefing-go'); if (go) go.click();
      const q = questions[qIdx];
      if ((q.type || 'mc') === 'mc') pickMc(q.correct); else saveState();
    });
    await page.waitForTimeout(400);
    await page.reload(); await page.waitForTimeout(300);
    const after = await page.evaluate(() => state.profiles.g5.xp);
    if (after < c.expect.g5) fails.push(`${c.name}: after playing and reloading, g5 has ${after} XP (had ${c.expect.g5})`);
    errors.forEach(e => fails.push(`${c.name}: JS error ${e}`));
    await page.close();
  }

  // A save that cannot be read is kept aside, never silently overwritten.
  {
    const page = await (await browser.newContext()).newPage();
    await page.goto(APP);
    await page.evaluate(k => { localStorage.clear(); localStorage.setItem(k, '{"profiles": not json'); }, KEY);
    await page.reload(); await page.waitForTimeout(300);
    const kept = await page.evaluate(k => localStorage.getItem(k + '_unread'), KEY);
    if (kept !== '{"profiles": not json') fails.push('a corrupt save was not kept aside in ' + KEY + '_unread');
    await page.close();
  }

  // Storage that throws (some private-browsing modes): the game still plays.
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      const no = () => { throw new Error('storage disabled'); };
      Object.defineProperty(window, 'localStorage', { get: () => ({ getItem: no, setItem: no, removeItem: no, clear: no }) });
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(APP); await page.waitForTimeout(300);
    const ok = await page.evaluate(() => {
      pickProfile('k'); const pk = PACKS.k.find(p => p.tier === 'now'); startPack(pk.id);
      const go = document.querySelector('.briefing-go'); if (go) go.click();
      return !!document.querySelector('.question-frame');
    });
    if (!ok) fails.push('with storage disabled, a round does not start');
    errors.forEach(e => fails.push('storage disabled: JS error ' + e));
    await ctx.close();
  }

  await browser.close();
  console.log(fails.length ? fails.map(f => 'FAIL ' + f).join('\n') : `saves: ${CASES.length} kinds of save load intact, survive play and reload; a corrupt save is kept aside; no storage still plays`);
  process.exit(fails.length ? 1 : 0);
})();
