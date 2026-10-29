// Daily Missions + Day Streak — end-to-end test.
//   node modules/missions.test.js [app.html]
// On the game file (the repo's, $TT_APP, or the one named), with the missions
// module and every other one built in: clears localStorage, and for the
// kindergartener (k) and the fifth grader (g5), on an iPad in portrait
// (820×1180, touch, locator.tap) and a 1440×900 laptop (mouse clicks), walks
// every path through real rounds of the real engine:
//   today's three missions (deterministic, grade-suited pool), auto-read and 🔊
//   for the kindergartener, tapping a mission to find where to do it, a mission
//   finishing mid-round (quiet toast) and at round end ("✓ Mission done: …"),
//   all three done (bonus XP = xpPer × 3, missionsComplete, awardSticker, win
//   sound, confetti, toast — once a day only), the day streak over several days
//   (alive / today / broken → kind "welcome back"), the three trophies, leaving
//   a round early, the 🔊 mission (k), the puzzle mission (g5), boss / sprint
//   missions with stub modules, the parent dashboard, and a normal round played
//   start to finish. Extra passes: keyboard only (Tab / Enter / Space), 390px
//   wide, reduced motion, old or broken saved data, and the play zone with the
//   other modules (a real boss battle finishing the boss mission).
// Fails on any page error, console error, horizontal overflow, or a tap target
// under 44px (56px for anything of this module the kindergartener taps).
// Screenshots go to tools/out/shots/missions/.
const { chromium } = require('playwright');
const path = require('path');
const app = require('./app');

const HTML = app.APP;
// The suite is for the missions module as the game file has it: without it, it fails.
if (!app.has('missions')) { console.log('missions: FAIL — the game file has no missions module'); process.exit(1); }
const SHOTS = app.shots('missions');
console.log('app: ' + HTML);

let passes = 0, fails = 0;
// Named in the result line: a pass skipped, answers pressed a second time (answerAndWait).
let skipped = '', retries = 0;
const failList = [];
function ok(cond, msg) {
  if (cond) passes++;
  else { fails++; failList.push(msg); console.log('    FAIL ' + msg); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const GUILT = /\blost\b|broke|\bmissed\b|\bsad\b|fail|shame|too bad|ruin|\bgone\b|\breset\b/i;

const VPS = {
  ipad:   { name: 'ipad',   width: 820,  height: 1180, touch: true },
  laptop: { name: 'laptop', width: 1440, height: 900,  touch: false },
  phone:  { name: 'phone',  width: 390,  height: 844,  touch: true },
};
const BONUS = { k: 15, g5: 45 };

// A day in late October 2026 (Eastern daylight time), at noon.
const DAY = n => {
  const d = new Date(Date.UTC(2026, 9, 22 + n, 16, 0, 0));
  return d;
};
const DAYKEY = n => { const d = new Date(Date.UTC(2026, 9, 22 + n)); return d.toISOString().slice(0, 10); };

async function press(page, vp, loc) {
  await loc.scrollIntoViewIfNeeded();
  if (vp.touch) await loc.tap(); else await loc.click();
  await page.waitForTimeout(450);
}

async function layout(page, vp, pid, label) {
  const r = await page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const vis = el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    };
    const desc = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '') +
      ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
    const transient = el => el.closest('.fun-confetti, .fun-toast, .trophy-pop, .xp-pop, .streak-pop');
    const over = [];
    for (const el of document.querySelectorAll('body *')) {
      if (transient(el) || !vis(el)) continue;
      const b = el.getBoundingClientRect();
      if (b.right > W + 1 || b.left < -1) over.push(desc(el) + ` [${Math.round(b.left)}..${Math.round(b.right)} of ${W}]`);
    }
    const small = [];
    for (const el of document.querySelectorAll('button, [role=button], [role=checkbox]')) {
      if (transient(el) || !vis(el)) continue;
      const b = el.getBoundingClientRect();
      const mine = !!el.closest('.missions-card, .missions-done, .missions-parent');
      small.push({ d: desc(el), w: b.width, h: b.height, mine });
    }
    const app = document.getElementById('app');
    return { over, small, docOver: document.documentElement.scrollWidth > W + 1, appOver: app.scrollWidth > app.clientWidth + 1 };
  });
  ok(!r.docOver && !r.appOver, `${label}: page scrolls horizontally`);
  ok(r.over.length === 0, `${label}: elements overflow the viewport: ${r.over.slice(0, 4).join(' | ')}`);
  const floor = pid === 'k' ? 55.5 : 43.5;
  const mineSmall = r.small.filter(s => s.mine && (s.w < floor || s.h < floor));
  ok(mineSmall.length === 0, `${label}: mission tap targets under ${Math.round(floor)}px: ${mineSmall.map(s => `${s.d} ${Math.round(s.w)}x${Math.round(s.h)}`).join(' | ')}`);
  const appSmall = r.small.filter(s => !s.mine && (s.w < 43.5 || s.h < 43.5));
  if (appSmall.length) console.log(`    note (${label}, app's own controls under 44px, not this module): ${appSmall.slice(0, 3).map(s => `${s.d} ${Math.round(s.w)}x${Math.round(s.h)}`).join(' | ')}`);
}

// Records speech, sounds and module events (headless Chromium has no voices).
async function instrument(page) {
  await page.evaluate(() => {
    window.__spoken = [];
    window.speakText = function (t) { window.__spoken.push(String(t)); };
    window.__sounds = [];
    const orig = window.funSound;
    window.funSound = function (n) { window.__sounds.push(n); return orig(n); };
    window.__events = [];
    FUN.on('missionsComplete', e => window.__events.push('missionsComplete:' + e.profileId));
    FUN.on('awardSticker', e => window.__events.push('awardSticker:' + e.profileId + ':' + e.reason));
    FUN.on('stickerEarned', e => window.__events.push('stickerEarned:' + e.profileId + ':' + e.reason));
  });
}

async function newPage(browser, vp, dayN, extra) {
  const ctx = await browser.newContext(Object.assign({
    viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, deviceScaleFactor: 1, timezoneId: 'America/New_York',
  }, extra || {}));
  ctx.setDefaultTimeout(12000);
  await ctx.addInitScript(require('./together').quietBuddy);   // every module built in: see together.js
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); if (m.type() === 'warning' && /\[fun\]/.test(m.text())) errors.push('fun warning: ' + m.text()); });
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });
  await page.clock.setSystemTime(DAY(dayN));
  await page.goto('file://' + HTML);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await instrument(page);
  return { ctx, page, errors };
}

// KNOWN APP BUG (not this module): `let state = loadState()` runs before
// `const PROFILE_MIGRATIONS` is initialised, so loadState() throws inside its
// try/catch and every page load starts from a blank state — all progress is
// lost on reload. To test what this module does across days, the saved state
// is put back after each reload; once the app is fixed this does nothing.
let appLoadBugSeen = false;
async function restoreState(page) {
  const lost = await page.evaluate(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    const fresh = loadState();
    if (JSON.stringify(fresh) === JSON.stringify(state)) return false;
    state = fresh;
    if (!currentProfile) renderProfileSelect();
    return true;
  });
  if (lost && !appLoadBugSeen) {
    appLoadBugSeen = true;
    console.log('    NOTE app bug: progress is not reloaded on page load (loadState runs before PROFILE_MIGRATIONS exists); the test restores it');
  }
}
async function reloadPage(page) {
  await page.reload();
  await restoreState(page);
  await instrument(page);
}

// Move to another day: the app is reloaded the way a child opens it tomorrow.
async function goDay(page, dayN, pid, vp) {
  await page.clock.setSystemTime(DAY(dayN));
  await reloadPage(page);
  ok(await page.evaluate(() => FUN.today()) === DAYKEY(dayN), `clock moved to ${DAYKEY(dayN)}`);
  if (pid) {
    await press(page, vp, page.locator(`.profile-card[onclick*="'${pid}'"]`));
    await page.waitForSelector('.missions-card');
  }
}

const store = (page, pid) => page.evaluate(pid => JSON.parse(JSON.stringify(missionsStore(pid))), pid);
const force = (page, pid, ids, extra) => page.evaluate(([pid, ids, extra]) => {
  const s = missionsStore(pid);
  s.ids = ids; s.done = []; s.seen = []; s.bonus = false; s.c = missionsNewCounters();
  Object.assign(s, extra || {});
  saveState();
  if (document.querySelector('.hub') && !document.querySelector('.missions-flash')) renderHub();
}, [pid, ids, extra || null]);
const cardText = page => page.locator('.missions-card').innerText();
// Our toasts never sit on top of another toast.
const toastsClear = page => page.evaluate(() => {
  const ts = [...document.querySelectorAll('.fun-toast')].filter(t => t.querySelector('.missions-toast'));
  const others = [...document.querySelectorAll('.fun-toast')];
  for (const t of ts) {
    const a = t.getBoundingClientRect();
    for (const o of others) {
      if (o === t) continue;
      const b = o.getBoundingClientRect();
      if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) return false;
    }
  }
  return true;
});
const toastText = page => page.evaluate(() => [...document.querySelectorAll('.fun-toast')].map(t => t.textContent.replace(/\s+/g, ' ').trim()).join(' || '));

const mc = (n) => ({ type: 'mc', text: `Which one is a fruit? (${n})`, options: ['Apple', 'Rock', 'Shoe', 'Cloud'], correct: 0, why: 'An apple grows on a tree.', hint: 'Which one can you eat?' });
const tf = () => ({ type: 'tf', statement: 'The sun is a star.', answer: true, why: 'The sun is a very hot star.' });
const multi = () => ({ type: 'multi', text: 'Pick the two even numbers.', options: ['2', '3', '4', '5'], correct: [0, 2], why: '2 and 4 can be split into two equal groups.' });

// A round through the real engine with known questions.
//   R right first try · F wrong then fixed · W wrong (true/false, no retry) · P puzzle right · S 🔊 twice then right
async function playRound(page, vp, pid, opts) {
  const plan = opts.plan;
  const qs = plan.map((a, i) => a === 'W' ? tf() : a === 'P' ? multi() : mc(i + 1));
  await page.evaluate(([qs, sel]) => {
    let pk;
    if (sel.id) pk = PACKS[currentProfile.id].find(p => p.id === sel.id);
    else pk = PACKS[currentProfile.id].find(p => p.tier === (sel.tier || 'now') && (!sel.subject || p.subject === sel.subject) && !p.getQuestions && p.id !== 'think_mix');
    if (!pk) throw new Error('no pack for ' + JSON.stringify(sel));
    window.__xpBefore = state.profiles[currentProfile.id].xp;
    startPack(pk.id);
    questions = qs.map(q => JSON.parse(JSON.stringify(q)));
    qIdx = 0;
    // No briefing: the pack's own first question is showing; show ours.
    if (!document.querySelector('.briefing-go')) renderQuestion();
  }, [qs, opts.pack || {}]);
  if (await page.locator('.briefing-go').count()) await press(page, vp, page.locator('.briefing-go'));
  await page.waitForSelector('.question-frame');
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i];
    if (opts.exitAfter === i) {
      await press(page, vp, page.locator('.exit-btn'));
      await press(page, vp, page.locator('#exit-modal-exit'));
      await page.waitForSelector('.hub');
      return;
    }
    if (a === 'S') {
      const sp = page.locator('.question-frame .js-speak').first();
      await press(page, vp, sp);
      await press(page, vp, sp);
    }
    if (a === 'R' || a === 'S') await press(page, vp, page.locator('.choice').nth(0));
    else if (a === 'F') { await press(page, vp, page.locator('.choice').nth(1)); await page.waitForTimeout(420); await press(page, vp, page.locator('.choice').nth(0)); }
    else if (a === 'W') await press(page, vp, page.locator('.false-btn'));
    else if (a === 'P') {
      await press(page, vp, page.locator('.choice').nth(0));
      await press(page, vp, page.locator('.choice').nth(2));
      await press(page, vp, page.locator('.puzzle-check'));
    }
    if (opts.onAnswer) await opts.onAnswer(i);
    await page.waitForSelector('#fb .next-btn');
    await press(page, vp, page.locator('#fb .next-btn'));
  }
  await page.waitForSelector('.complete');
}
async function backToHub(page, vp) {
  await press(page, vp, page.locator('.complete .next-btn').nth(1));
  await page.waitForSelector('.missions-card');
}

// Answer whatever question is showing, correctly, through the UI (any type).
async function answerCorrect(page, vp) {
  const q = await page.evaluate(() => {
    const q = questions[qIdx];
    return { type: q.type || 'mc', correct: q.correct, answer: q.answer, accepted: q.acceptedAnswers, n: (q.items || []).length,
             shuffle: q._shuffle, groups: q.type === 'sort' ? q.items.map(i => i.g) : null,
             pa: q.partA && q.partA.correct, pb: q.partB && q.partB.correct };
  });
  if (q.type === 'mc') await press(page, vp, page.locator('.choice').nth(q.correct));
  else if (q.type === 'tf') await press(page, vp, page.locator(q.answer ? '.true-btn' : '.false-btn'));
  else if (q.type === 'typed' || q.type === 'fib' || q.type === 'showwork') {
    if (q.type === 'showwork') { await page.locator('#workDone').check(); await page.waitForTimeout(150); }
    const v = String(q.accepted[0]);
    if (await page.locator('.numpad-key').count()) {
      for (const ch of v) {
        // A mixed number such as 4 3/4 gets a SPACE key on the pad.
        const idx = await page.evaluate(ch => [...document.querySelectorAll('.numpad-key')].findIndex(k => ch === ' ' ? k.getAttribute('aria-label') === 'SPACE' : k.textContent.trim() === ch), ch);
        if (idx < 0 && ch === ' ') continue;
        await press(page, vp, page.locator('.numpad-key').nth(idx));
      }
    } else await page.locator('#typedInput').fill(v);
    await press(page, vp, page.locator('.typed-submit'));
  } else if (q.type === 'order') {
    for (let pos = 0; pos < q.n; pos++) {
      const idx = await page.evaluate(pos => { const q = questions[qIdx]; return q._shuffle.filter(i => !qState.slots.includes(i)).indexOf(pos); }, pos);
      await press(page, vp, page.locator('.order-item').nth(idx));
    }
    await press(page, vp, page.locator('.puzzle-check'));
  } else if (q.type === 'sort') {
    for (let r = 0; r < q.shuffle.length; r++) await press(page, vp, page.locator('.sort-row').nth(r).locator('.sort-btn').nth(q.groups[q.shuffle[r]]));
    await press(page, vp, page.locator('.puzzle-check'));
  } else if (q.type === 'multi') {
    for (const i of q.correct) await press(page, vp, page.locator('.choice').nth(i));
    await press(page, vp, page.locator('.puzzle-check'));
  } else if (q.type === 'twopart') {
    await press(page, vp, page.locator('.part-choice[data-part="A"]').nth(q.pa));
    await page.waitForTimeout(300);
    await press(page, vp, page.locator('.part-choice[data-part="B"]').nth(q.pb));
  }
  return q.type;
}

// Answer the question showing (answerCorrect) and wait for its HERE'S WHY.
// On a busy machine a press can land while the new question is still
// settling and not count, leaving the question unanswered or on its second
// try. A child would answer again; so does this, once, with a note.
async function answerAndWait(page, vp) {
  const type = await answerCorrect(page, vp);
  if (await page.waitForSelector('#fb .next-btn', { timeout: 6000 }).then(() => true, () => false)) return type;
  const st = await page.evaluate(() => ({ tries, locked }));
  retries++;
  console.log(`    note: a ${type} answer did not finish the question (tries ${st.tries}, locked ${st.locked}); answering again`);
  if (await page.locator('.numpad-key.clear').count()) await press(page, vp, page.locator('.numpad-key.clear'));
  else if (await page.locator('#typedInput').count()) await page.locator('#typedInput').fill('');
  await answerCorrect(page, vp);
  await page.waitForSelector('#fb .next-btn');
  return type;
}

// ═══════════════════════════════════════════════════════════════
// The mission pool, without any UI
// ═══════════════════════════════════════════════════════════════
async function poolChecks(browser) {
  console.log('\n▶ pool');
  const { ctx, page, errors } = await newPage(browser, VPS.laptop, 0);
  const r = await page.evaluate(() => {
    const days = [];
    const d0 = new Date(2026, 9, 1);
    for (let i = 0; i < 120; i++) { const d = new Date(d0); d.setDate(d.getDate() + i); days.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); }
    // With every module built in the boss module is really there.
    const res = { present: { boss: typeof bossStart === 'function', sprint: typeof sprintStart === 'function' } };
    const realBoss = window.bossStart, realSprint = window.sprintStart;
    for (const pid of ['k', 'g3', 'g5']) {
      const subs = new Set(PACKS[pid].filter(p => p.tier === 'now').map(p => p.subject));
      const picks = days.map(day => missionsPick(pid, day));
      const again = days.map(day => missionsPick(pid, day));
      const all = picks.flat();
      res[pid] = {
        n3: picks.every(p => p.length === 3 && new Set(p).size === 3),
        famsDistinct: picks.every(p => new Set(p.map(missionsFam)).size === 3),
        same: JSON.stringify(picks) === JSON.stringify(again),
        distinctSets: new Set(picks.map(p => p.join())).size,
        subjOk: all.filter(id => id.startsWith('subj:')).every(id => subs.has(id.slice(5)) && ['math', 'ela', 'reading', 'science', 'ss', 'health', 'tech'].includes(id.slice(5))),
        kinds: [...new Set(all.map(id => id.startsWith('subj:') ? 'subj' : id))].sort(),
        easyFirst: picks.every(p => MISSIONS_POOLS[pid].easy.includes(p[0])),
        mediumSecond: picks.every(p => MISSIONS_POOLS[pid].medium.includes(p[1]) || ['inarow5', 'rounds2', 'inarow3'].includes(p[1])),
        texts: [...new Set(all)].map(id => missionsDef(id, pid).text),
        hasPuzzles: thinkPacksFor(pid).length > 0,
      };
    }
    // Optional features appear only when present.
    window.bossStart = function () {};
    window.sprintStart = function () {};
    const g5now = PACKS.g5.find(p => p.tier === 'now' && p.subject === 'math');
    THINK_ITEMS[g5now.id] = [{ type: 'multi', text: 'x', options: ['a', 'b', 'c'], correct: [0, 1] }];
    const withAll = days.map(day => missionsPick('g5', day)).flat();
    res.optional = { boss: withAll.includes('boss'), sprint: withAll.includes('sprint'), puzzle: withAll.includes('puzzle'),
                     kPuzzle: days.map(day => missionsPick('k', day)).flat().includes('puzzle') };
    delete THINK_ITEMS[g5now.id];
    if (res.present.boss) window.bossStart = realBoss; else delete window.bossStart;
    if (res.present.sprint) window.sprintStart = realSprint; else delete window.sprintStart;
    res.today = FUN.today();
    return res;
  });
  ok(r.today === DAYKEY(0), 'clock: FUN.today() follows the test clock (' + r.today + ')');
  for (const pid of ['k', 'g3', 'g5']) {
    const x = r[pid];
    ok(x.n3, `${pid}: three different missions every day`);
    ok(x.famsDistinct, `${pid}: no two missions of the same kind on one day`);
    ok(x.same, `${pid}: the same day always gives the same missions`);
    ok(x.distinctSets >= 15, `${pid}: missions vary from day to day (${x.distinctSets} different sets in 120 days)`);
    ok(x.subjOk, `${pid}: subject missions only use subjects in this year's packs`);
    ok(x.easyFirst, `${pid}: first mission is an easy one`);
    ok(x.mediumSecond, `${pid}: second mission is a medium one`);
    ok((!x.kinds.includes('boss') || r.present.boss) && (!x.kinds.includes('sprint') || r.present.sprint) && x.kinds.includes('puzzle') === x.hasPuzzles, `${pid}: boss/sprint missions only while those features are present (boss ${r.present.boss ? 'built in' : 'absent'}, sprint ${r.present.sprint ? 'built in' : 'absent'}); a puzzle mission only when this child has puzzles (${x.kinds})`);
    ok(x.texts.every(t => !/wrong|miss/i.test(t)), `${pid}: no mission rewards getting things wrong`);
    console.log(`    ${pid} kinds: ${x.kinds.join(', ')}`);
  }
  ok(r.k.kinds.includes('speak2'), 'k: the 🔊 mission is in the kindergartener\'s pool');
  ok(!r.g5.kinds.includes('speak2') && !r.g3.kinds.includes('speak2'), 'g3/g5: no 🔊 mission (too babyish)');
  ok(!r.k.kinds.includes('score8') && !r.k.kinds.includes('inarow7'), 'k: no score-8 or 7-in-a-row missions for the kindergartener');
  ok(r.g5.kinds.includes('inarow7') && r.g5.kinds.includes('score8') && r.g5.kinds.includes('review'), 'g5: harder missions and review appear');
  ok(r.optional.boss && r.optional.sprint && r.optional.puzzle, 'boss, sprint and puzzle missions appear once those features exist');
  ok(r.optional.kPuzzle === r.k.hasPuzzles, 'k: a puzzle mission exactly when the kindergartener has puzzle items');
  ok(errors.length === 0, 'pool: no page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
async function runFull(browser, vp, pid) {
  const tag = `${vp.name}-${pid}`;
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp, 0);
  const shot = name => page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) });
  const isK = pid === 'k';
  const bonus = BONUS[pid];

  // ── 1. First look at today's missions ──
  await press(page, vp, page.locator(`.profile-card[onclick*="'${pid}'"]`));
  await page.waitForSelector('.missions-card');
  let s = await store(page, pid);
  ok(s.day === DAYKEY(0), 'missions are for today');
  ok(JSON.stringify(s.ids) === JSON.stringify(await page.evaluate(([pid, d]) => missionsPick(pid, d), [pid, DAYKEY(0)])), 'stored missions are the deterministic pick for today');
  ok(await page.locator('.missions-card .missions-item').count() === 3, 'three missions on the card');
  ok((await page.locator('.missions-card .fun-card-badge').innerText()).trim() === '0/3', 'badge 0/3');
  let txt = await cardText(page);
  ok(/TODAY.S MISSIONS/i.test(txt), 'card title');
  ok(/start a day streak/i.test(txt), 'no streak yet: invites to start one');
  ok(new RegExp(`\\+${bonus} XP`).test(txt), `card promises the +${bonus} XP bonus`);
  ok(await page.evaluate(() => { const z = document.querySelector('.fun-zone'); return z && z.contains(document.querySelector('.missions-card')); }), 'card sits in the hub play zone');
  if (isK) {
    await page.waitForTimeout(1300);
    ok(await page.evaluate(() => window.__spoken.some(t => /^Today's missions\. One: /.test(t))), 'k: missions are read aloud automatically on the first look of the day');
    ok((await store(page, pid)).heard === DAYKEY(0), 'k: auto-read remembered for today');
    ok(await page.locator('.missions-card .missions-foot .js-speak').count() === 1, 'k: a 🔊 button reads all three');
    await page.evaluate(() => { window.__spoken = []; });
    await press(page, vp, page.locator('.missions-card .missions-foot .js-speak'));
    const said = await page.evaluate(() => window.__spoken.join(' | '));
    ok(/Today's missions\. One: .+ Two: .+ Three: .+bonus X P/.test(said), 'k: 🔊 reads all three missions and the bonus: ' + said.slice(0, 160));
  } else {
    await page.waitForTimeout(900);
    ok(await page.evaluate(() => !window.__spoken.some(t => /missions/i.test(t))), 'g5: nothing read aloud');
    ok(await page.locator('.missions-card .js-speak').count() === 0, 'g5: no 🔊 on the card (cool, not cutesy)');
  }
  await layout(page, vp, pid, `${tag} hub`);
  await shot('01-hub');

  // Same day, app opened again: the same missions, and no second auto-read.
  await reloadPage(page);
  await press(page, vp, page.locator(`.profile-card[onclick*="'${pid}'"]`));
  await page.waitForSelector('.missions-card');
  ok(JSON.stringify((await store(page, pid)).ids) === JSON.stringify(s.ids), 'reopened the same day: same missions');
  if (isK) { await page.waitForTimeout(1200); ok(await page.evaluate(() => !window.__spoken.some(t => /Today's missions/.test(t))), 'k: not read again the same day'); }

  // ── 2. Tap a mission: hear it (k) and jump to where it can be done ──
  const ids = isK ? ['rounds1', 'inarow3', 'subj:science'] : ['inarow5', 'score8', 'review'];
  await force(page, pid, ids);
  await page.waitForSelector('.missions-card');
  const third = page.locator('.missions-card .missions-item').nth(2);
  ok(await third.getAttribute('role') === 'button' && await third.getAttribute('tabindex') === '0', 'an open mission is a button');
  await page.evaluate(() => { window.__spoken = []; window.__sounds = []; });
  await press(page, vp, third);
  await page.waitForTimeout(isK ? 1000 : 700);
  const flash = await page.evaluate(() => {
    const el = document.querySelector('.missions-flash');
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { text: el.textContent.trim().slice(0, 40), top: b.top, h: innerHeight };
  });
  ok(flash && (isK ? /SCIENCE/.test(flash.text) : /REVIEW/.test(flash.text)), `tapping a mission flashes its section: ${flash && flash.text}`);
  ok(flash && flash.top >= -2 && flash.top < flash.h * 0.5, 'the section is scrolled into view');
  ok(await page.evaluate(() => window.__sounds.includes('tap')), 'a tap sound');
  if (isK) ok(await page.evaluate(() => window.__spoken.some(t => /science round/.test(t))), 'k: the mission is read aloud when tapped');
  await shot('02-mission-tapped');
  await page.evaluate(() => document.getElementById('app').scrollTo(0, 0));

  // ── 3. A round finishes two missions ──
  await page.evaluate(() => { window.__spoken = []; });
  if (isK) {
    // 3 right in a row lands mid-round: a quiet toast, no fanfare.
    await playRound(page, vp, pid, { plan: ['R', 'R', 'R', 'F'], pack: { subject: 'math' }, onAnswer: async i => {
      if (i === 2) {
        await page.waitForTimeout(1250);
        ok(/MISSION DONE.*3 right in a row/i.test(await toastText(page)), 'mid-round: a toast says the mission is done');
        ok(await page.evaluate(() => !window.__sounds.includes('win')), 'mid-round: no fanfare yet');
        await shot('03-midround-toast');
      }
    } });
  } else {
    await playRound(page, vp, pid, { plan: ['R', 'R', 'R', 'R', 'R', 'W', 'R', 'R', 'R', 'F'], pack: { subject: 'math' }, onAnswer: async i => {
      if (i === 4) {
        await page.waitForTimeout(1250);
        ok(/MISSION DONE.*5 right in a row/i.test(await toastText(page)), 'mid-round: a toast says the mission is done');
        await shot('03-midround-toast');
      }
    } });
  }
  s = await store(page, pid);
  ok(s.done.length === 2 && !s.bonus, `two missions done after the round (${s.done})`);
  ok(s.streak === 1 && s.last === DAYKEY(0), 'day streak starts at 1');
  let done = await page.locator('.missions-done').innerText();
  ok(/2\/3/.test(done), 'complete screen: 2/3');
  if (isK) {
    ok(/Mission done:\s*Finish 1 round/.test(done) && /Mission done:\s*3 right in a row/.test(done), 'complete screen lists both missions done this round');
    ok(/Next: Finish a Science round/.test(done), 'complete screen shows the next mission');
  } else {
    ok(/Mission done:\s*5 right in a row/.test(done) && /Mission done:\s*Score 8\+ in a round/.test(done), 'complete screen lists both missions done this round');
    ok(/Next: Play a 4th grade review round/.test(done), 'complete screen shows the next mission');
  }
  ok(/Day 1 of your streak/.test(done), 'complete screen: streak day 1');
  if (isK) {
    await page.waitForTimeout(2800);
    ok(await page.evaluate(() => window.__spoken.some(t => /Mission done! Finish one round\. Mission done! Get 3 right in a row\./.test(t))), 'k: the missions done are read aloud on the complete screen');
    ok(await page.locator('.missions-done .js-speak').count() === 1, 'k: 🔊 on the complete-screen missions');
  }
  await layout(page, vp, pid, `${tag} complete (2 of 3)`);
  await page.locator('.missions-done').scrollIntoViewIfNeeded();
  await shot('04-complete-two');

  await backToHub(page, vp);
  txt = await cardText(page);
  ok((await page.locator('.missions-card .fun-card-badge').innerText()).trim() === '2/3', 'hub badge 2/3');
  ok(await page.locator('.missions-card .missions-item.is-done').count() === 2, 'two missions ticked on the hub');
  ok(await page.locator('.missions-card .missions-item.is-new').count() === 2, 'newly ticked missions get the stamp animation once');
  ok(await page.locator('.missions-card .missions-item.is-done[role=button]').count() === 0, 'done missions are not buttons');
  ok(/1-day streak/.test(txt), 'hub: 1-day streak');
  await layout(page, vp, pid, `${tag} hub 2/3`);
  await shot('05-hub-two');
  await page.evaluate(() => renderHub());
  ok(await page.locator('.missions-card .missions-item.is-new').count() === 0, 'stamp animation plays only once');

  // ── 4. The third mission: all three done ──
  await page.evaluate(() => { window.__sounds = []; window.__events = []; window.__spoken = []; });
  await playRound(page, vp, pid, isK ? { plan: ['R', 'F', 'R'], pack: { subject: 'science' } } : { plan: ['R', 'W', 'R'], pack: { tier: 'review' } });
  await page.waitForTimeout(1300);
  s = await store(page, pid);
  const xp = await page.evaluate(pid => ({ now: state.profiles[pid].xp, before: window.__xpBefore, round: xpEarned }), pid);
  ok(s.bonus && s.done.length === 3, 'all three missions done');
  ok(xp.now === xp.before + xp.round + bonus, `bonus XP is xpPer×3 = ${bonus} (xp ${xp.before} + round ${xp.round} → ${xp.now})`);
  const ev = await page.evaluate(() => window.__events);
  ok(ev.filter(e => e === 'missionsComplete:' + pid).length === 1, 'missionsComplete emitted once');
  ok(ev.filter(e => e === `awardSticker:${pid}:missions`).length === 1, 'awardSticker {reason:missions} emitted once');
  ok(await page.evaluate(() => window.__sounds.includes('win')), 'win sound');
  ok(await page.locator('.fun-confetti').count() > 0, 'confetti');
  ok(/ALL 3 MISSIONS DONE!.*\+\d+ BONUS XP/.test(await toastText(page)), 'celebration toast');
  ok(await toastsClear(page), 'toasts do not overlap');
  done = await page.locator('.missions-done').innerText();
  ok(new RegExp(`ALL 3 MISSIONS DONE!\\s*\\+${bonus} BONUS XP`).test(done), 'complete screen: all three done with the bonus');
  ok(/Mission done:\s*(Finish a Science round|Play a 4th grade review round)/.test(done), 'complete screen: the last mission');
  ok(!/Day \d|days in a row/.test(done), 'complete screen: no streak news on the second round of the day');
  if (isK) {
    await page.waitForTimeout(2600);
    ok(await page.evaluate(() => window.__spoken.some(t => /All three missions done! You earned 15 bonus X P!/.test(t))), 'k: the bonus is read aloud');
  }
  await layout(page, vp, pid, `${tag} complete (all done)`);
  await page.locator('.missions-done').scrollIntoViewIfNeeded();
  await shot('06-complete-all');
  await backToHub(page, vp);
  txt = await cardText(page);
  ok((await page.locator('.missions-card .fun-card-badge').innerText()).trim() === '✓ 3/3', 'hub badge: ✓ 3/3');
  ok(await page.locator('.missions-card.is-all').count() === 1, 'hub card glows gold');
  ok(new RegExp(`All done! \\+${bonus} XP earned`).test(txt), 'hub: bonus earned, new missions tomorrow');
  ok(await page.locator('.missions-card [role=button]').count() === 0, 'hub: nothing left to tap but 🔊');
  await layout(page, vp, pid, `${tag} hub all done`);
  await shot('07-hub-all');

  // Another round the same day (not a perfect one — the app plays its own
  // fanfare for those): no second bonus.
  await page.evaluate(() => { window.__events = []; window.__sounds = []; });
  await playRound(page, vp, pid, { plan: ['R', 'F', 'R'], pack: { subject: 'math' } });
  await page.waitForTimeout(1100);
  const xp2 = await page.evaluate(pid => ({ now: state.profiles[pid].xp, before: window.__xpBefore, round: xpEarned }), pid);
  ok(xp2.now === xp2.before + xp2.round, 'no second bonus the same day');
  // Only the missions' own celebration counts: with the sticker module built
  // in, a round can also earn a sticker of its own (another reason).
  ok(await page.evaluate(() => !window.__events.some(e => /^missionsComplete:|:missions$/.test(e)) && !window.__sounds.includes('win')), 'no second celebration');
  ok((await store(page, pid)).aceDays === 1, 'all-three day counted once');
  await backToHub(page, vp);

  // ── 5. Tomorrow: new missions, streak still alive ──
  await goDay(page, 1, pid, vp);
  s = await store(page, pid);
  ok(s.day === DAYKEY(1) && s.done.length === 0 && !s.bonus, 'a new day: fresh missions');
  ok(JSON.stringify(s.ids) === JSON.stringify(await page.evaluate(([pid, d]) => missionsPick(pid, d), [pid, DAYKEY(1)])), 'tomorrow\'s missions are tomorrow\'s pick');
  txt = await cardText(page);
  ok(/1-day streak · a round today makes 2/.test(txt), 'streak alive from yesterday: ' + txt.split('\n').slice(1, 3).join(' / '));
  ok((await page.locator('.missions-card .fun-card-badge').innerText()).trim() === '0/3', 'badge back to 0/3');
  await shot('08-hub-day2');
  await playRound(page, vp, pid, { plan: ['R', 'F', 'R'], pack: { subject: 'math' } });
  ok(/2 days in a row!/.test(await page.locator('.missions-done').innerText()), 'complete: 2 days in a row');
  ok((await store(page, pid)).streak === 2, 'streak 2');
  await backToHub(page, vp);

  // ── 6. Day 3: ON A ROLL ──
  await goDay(page, 2, pid, vp);
  await playRound(page, vp, pid, { plan: ['R', 'R', 'F'], pack: { subject: 'math' } });
  await page.waitForTimeout(300);
  s = await store(page, pid);
  ok(s.streak === 3 && s.best === 3, 'streak 3');
  ok(await page.evaluate(pid => state.profiles[pid].trophies.includes('missions_roll'), pid), 'trophy 🔥 ON A ROLL earned');
  ok(/ON A ROLL/.test(await page.evaluate(() => [...document.querySelectorAll('.trophy-pop')].map(t => t.textContent).join(' '))), 'trophy pop shows ON A ROLL');
  ok(/3 days in a row! Your best ever!/.test(await page.locator('.missions-done').innerText()), 'complete: 3 days in a row, best ever');
  await page.locator('.missions-done').scrollIntoViewIfNeeded();
  await shot('09-complete-streak3');
  await backToHub(page, vp);
  ok(/3-day streak · your best!/.test(await cardText(page)), 'hub: 3-day streak, your best');
  await shot('10-hub-streak3');

  // ── 7. Two days off: a kind welcome back, nothing taken away ──
  await goDay(page, 5, pid, vp);
  txt = await cardText(page);
  ok(/Welcome back! A new streak starts today\./.test(txt), 'broken streak: "Welcome back! A new streak starts today."');
  ok(/best 3 days/.test(txt), 'best streak still shown');
  ok(!GUILT.test(txt.replace(/Welcome back!/, '')), 'no guilt words on the card: ' + txt.replace(/\n/g, ' / '));
  ok(await page.evaluate(pid => state.profiles[pid].trophies.includes('missions_roll'), pid), 'trophy kept');
  await layout(page, vp, pid, `${tag} hub welcome back`);
  await shot('11-hub-welcome-back');
  await playRound(page, vp, pid, { plan: ['R', 'R', 'R'], pack: { subject: 'math' } });
  ok(/Welcome back! Your new streak starts today\./.test(await page.locator('.missions-done').innerText()), 'complete: welcome back');
  s = await store(page, pid);
  ok(s.streak === 1 && s.best === 3, 'new streak 1, best 3 kept');
  await backToHub(page, vp);
  ok(/1-day streak · welcome back!/.test(await cardText(page)) && /best 3 days/.test(await cardText(page)), 'hub: 1-day streak, welcome back, best 3');

  // ── 8. WEEK WARRIOR and MISSION ACE in one round ──
  await goDay(page, 6, pid, vp);
  await force(page, pid, ['rounds1', 'inarow3', 'subj:math'], { last: DAYKEY(5), streak: 6, aceDays: 4 });
  await playRound(page, vp, pid, { plan: ['R', 'R', 'R'], pack: { subject: 'math' } });
  await page.waitForTimeout(1200);
  s = await store(page, pid);
  ok(s.streak === 7 && s.best === 7, 'streak 7');
  ok(s.aceDays === 5, 'all three done on 5 days');
  const tro = await page.evaluate(pid => state.profiles[pid].trophies, pid);
  ok(tro.includes('missions_week'), 'trophy 🗓️ WEEK WARRIOR earned');
  ok(tro.includes('missions_ace'), 'trophy 🎯 MISSION ACE earned');
  await page.locator('.missions-done').scrollIntoViewIfNeeded();
  await shot('12-complete-week-ace');
  await backToHub(page, vp);
  const trophyRow = await page.evaluate(() => [...document.querySelectorAll('.trophy.got .trophy-name')].map(t => t.textContent));
  ok(['ON A ROLL', 'WEEK WARRIOR', 'MISSION ACE'].every(n => trophyRow.includes(n)), 'all three trophies show in the hub: ' + trophyRow.join(','));

  // ── 9. Leaving a round early keeps what was done, finishes nothing else ──
  await goDay(page, 7, pid, vp);
  await force(page, pid, ['rounds1', 'inarow3', isK ? 'inarow5' : 'score8']);
  const lastBefore = (await store(page, pid)).last;
  await playRound(page, vp, pid, { plan: ['R', 'R', 'R', 'R'], pack: { subject: 'math' }, exitAfter: 3 });
  s = await store(page, pid);
  ok(s.done.length === 1 && s.done[0] === 'inarow3', 'left early: 3-in-a-row still counts, nothing else');
  ok(s.last === lastBefore && s.c.rounds === 0, 'left early: not a finished round, streak day not counted');
  ok((await page.locator('.missions-card .fun-card-badge').innerText()).trim() === '1/3', 'hub shows 1/3 after leaving');
  await shot('13-hub-after-exit');

  // ── 10. k: the 🔊 mission · g5: the puzzle mission ──
  await goDay(page, 8, pid, vp);
  if (isK) {
    await force(page, pid, ['speak2', 'rounds1', 'inarow3']);
    ok(/Tap 🔊 on 2 questions/.test(await cardText(page)), 'k: 🔊 mission on the card');
    ok(await page.locator('.missions-card .missions-pips').count() >= 1, 'k: progress shown as dots');
    await press(page, vp, page.locator('.missions-card .missions-foot .js-speak'));
    ok((await store(page, pid)).c.spoke.length === 0, 'k: 🔊 on the hub does not count');
    await playRound(page, vp, pid, { plan: ['S', 'S', 'R'], pack: { subject: 'math' }, onAnswer: async i => {
      const n = (await store(page, pid)).c.spoke.length;
      if (i === 0) ok(n === 1, 'k: two taps on one question count once (' + n + ')');
      if (i === 1) {
        ok(n === 2, 'k: a second question counts');
        await page.waitForTimeout(1300);
        ok(/MISSION DONE.*Tap 🔊 on 2 questions/.test(await toastText(page)), 'k: 🔊 mission toast');
      }
    } });
    ok((await store(page, pid)).done.includes('speak2'), 'k: 🔊 mission done');
  } else {
    await page.evaluate(() => {
      const pk = PACKS.g5.find(p => p.tier === 'now' && p.subject === 'math');
      THINK_ITEMS[pk.id] = [{ type: 'multi', text: 'Pick two', options: ['a', 'b', 'c'], correct: [0, 1] }];
    });
    await force(page, pid, ['puzzle', 'rounds1', 'inarow3']);
    ok(/Solve a puzzle question/.test(await cardText(page)), 'g5: puzzle mission on the card');
    await page.evaluate(() => FUN.emit('answer', { profileId: 'g5', pack: currentPack, q: { type: 'multi' }, isRight: false, fixed: false, streak: 0 }));
    ok((await store(page, pid)).c.puzzle === 0, 'g5: a wrong puzzle answer does not count');
    await playRound(page, vp, pid, { plan: ['R', 'P', 'R'], pack: { subject: 'math' } });
    ok((await store(page, pid)).done.includes('puzzle'), 'g5: puzzle mission done by a real pick-all question');
  }
  await page.waitForTimeout(1200);
  ok((await store(page, pid)).bonus, 'all three done again on a new day');
  await backToHub(page, vp);

  // ── 11. Boss battle and speed sprint, with stand-in modules ──
  await goDay(page, 9, pid, vp);
  await page.evaluate(pid => {
    window.bossStart = function () {};
    window.sprintStart = function () {};
    PACKS[pid].push({ id: 'boss_test', title: 'Boss Battle', icon: '👾', subject: 'boss', tier: 'boss', hidden: true, desc: '',
      getQuestions: () => [0, 1, 2].map(i => ({ type: 'mc', text: 'Boss ' + i, options: ['Yes', 'No', 'Maybe', 'Never'], correct: 0, _prepared: true })) });
  }, pid);
  await force(page, pid, ['sprint', 'boss', 'rounds1']);
  txt = await cardText(page);
  ok(/Run a speed sprint/.test(txt) && /Take on a boss battle/.test(txt), 'boss and sprint missions on the card');
  await page.evaluate(() => { document.getElementById('app').scrollTop = 120; window.__sounds = []; });
  await page.evaluate(pid => FUN.emit('sprintDone', { profileId: pid, score: 12, best: 12, isBest: true }), pid);
  await page.waitForTimeout(500);
  ok((await store(page, pid)).done.includes('sprint'), 'sprintDone finishes the sprint mission');
  ok(/MISSION DONE.*Run a speed sprint/.test(await toastText(page)), 'sprint: toast');
  ok(await page.evaluate(() => window.__sounds.includes('fixed')), 'sprint: a chime');
  ok((await page.locator('.missions-card .fun-card-badge').innerText()).trim() === '1/3', 'hub card updated in place');
  ok(await page.evaluate(() => document.getElementById('app').scrollTop) === 120, 'hub keeps its scroll position');
  ok((await store(page, pid)).last === DAYKEY(9), 'a sprint counts as playing today');
  await shot('14-hub-sprint-done');
  await page.evaluate(() => { document.getElementById('app').scrollTop = 0; window.__events = []; });
  await playRound(page, vp, pid, { plan: ['R', 'R', 'R'], pack: { id: 'boss_test' } });
  await page.waitForTimeout(1200);
  s = await store(page, pid);
  ok(s.done.includes('boss') && s.done.includes('rounds1') && s.bonus, 'a boss round finishes the boss mission (and all three)');
  ok(await page.evaluate(() => window.__events.includes('missionsComplete:' + currentProfile.id)), 'missionsComplete after boss + sprint');
  await backToHub(page, vp);
  await force(page, pid, ['boss', 'rounds1', 'inarow3']);
  await page.evaluate(pid => FUN.emit('bossDefeated', { profileId: pid, boss: 'Test' }), pid);
  ok((await store(page, pid)).done.includes('boss'), 'bossDefeated alone also counts');

  // ── 12. Parent dashboard ──
  await page.evaluate(() => renderParentDash());
  const par = await page.locator('.missions-parent').innerText();
  ok(/Daily Missions & Day Streaks/.test(par), 'parent: missions block');
  ok(new RegExp(isK ? 'KINDERGARTEN — 🔥' : '5TH GRADE — 🔥').test(par), 'parent: this child\'s streak');
  ok(/not started yet/.test(par), 'parent: a child who has not started');
  ok(/all 3 missions done on \d+ days?/.test(par), 'parent: all-three days');
  await page.locator('.missions-parent').scrollIntoViewIfNeeded();
  await layout(page, vp, pid, `${tag} parent`);
  await shot('15-parent');

  // ── 13. A normal round, start to finish, the app's own way ──
  await goDay(page, 10, pid, vp);
  await press(page, vp, page.locator('.pack-card').first());
  if (await page.locator('.briefing-go').count()) await press(page, vp, page.locator('.briefing-go'));
  await page.waitForSelector('.question-frame');
  const total = await page.evaluate(() => questions.length);
  for (let i = 0; i < total; i++) {
    await answerAndWait(page, vp);
    await press(page, vp, page.locator('#fb .next-btn'));
  }
  await page.waitForSelector('.complete');
  ok(total === 10, 'normal round has 10 questions');
  ok(/ROUND \d+ DONE/.test(await page.locator('.complete-title').innerText()), 'normal round reaches the complete screen');
  ok(await page.locator('.missions-done').count() === 1, 'missions block on the normal complete screen');
  await page.locator('.missions-done').scrollIntoViewIfNeeded();
  await shot('16-normal-complete');
  await backToHub(page, vp);

  ok(errors.length === 0, `${tag}: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// Keyboard only (laptop, no touch): Tab / Enter / Space
// ═══════════════════════════════════════════════════════════════
async function runKeyboard(browser, pid) {
  const tag = `keyboard-${pid}`;
  console.log(`\n▶ ${tag}`);
  const vp = VPS.laptop;
  const { ctx, page, errors } = await newPage(browser, vp, 0);
  // To the child's profile card and in, by keyboard.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(pid => { const a = document.activeElement; return !!a && (a.getAttribute('onclick') || '').includes(`'${pid}'`); }, pid)) break;
  }
  await page.keyboard.press('Enter');
  await page.waitForSelector('.missions-card');
  await force(page, pid, pid === 'k' ? ['rounds1', 'inarow3', 'subj:science'] : ['inarow5', 'score8', 'review']);
  let found = false;
  for (let i = 0; i < 40 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => { const a = document.activeElement; return !!a && a.classList.contains('missions-item'); });
  }
  ok(found, 'Tab reaches a mission');
  const ring = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return a.matches(':focus-visible') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; });
  ok(ring, 'the focused mission shows a focus ring');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(pid === 'k' ? 900 : 500);
  ok(await page.locator('.missions-flash').count() === 1, 'Enter on a mission shows where to do it');
  ok(await page.evaluate(() => !!document.activeElement && document.activeElement.classList.contains('pack-card')), 'keyboard focus moves to the first pack there');
  await page.screenshot({ path: path.join(SHOTS, `${tag}-01-enter.png`) });
  await page.evaluate(() => { document.querySelectorAll('.missions-flash').forEach(e => e.classList.remove('missions-flash')); document.getElementById('app').scrollTo(0, 0); });
  await page.locator('.missions-card .missions-item[role=button]').nth(2).focus();
  await page.keyboard.press(' ');
  await page.waitForTimeout(pid === 'k' ? 900 : 500);
  ok(await page.locator('.missions-flash').count() === 1, 'Space on a mission works too');
  if (pid === 'k') {
    await page.evaluate(() => { window.__spoken = []; document.getElementById('app').scrollTo(0, 0); });
    await page.locator('.missions-card .missions-foot .js-speak').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    ok(await page.evaluate(() => window.__spoken.some(t => /Today's missions/.test(t))), 'k: Enter on 🔊 reads the missions');
  }
  // A round by keyboard, so a mission ticks off without a pointer.
  await page.evaluate(() => { document.getElementById('app').scrollTo(0, 0); });
  await page.evaluate(() => {
    const pk = PACKS[currentProfile.id].find(p => p.tier === 'now' && p.subject === 'math');
    startPack(pk.id);
    questions = [0, 1, 2].map(i => ({ type: 'mc', text: 'Pick A ' + i, options: ['Apple', 'Rock', 'Shoe', 'Cloud'], correct: 0 }));
    qIdx = 0;
    if (!document.querySelector('.briefing-go')) renderQuestion();
  });
  if (await page.locator('.briefing-go').count()) { await page.keyboard.press('Enter'); }
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector('.question-frame');
    await page.keyboard.press(pid === 'k' ? '1' : 'a');
    await page.waitForSelector('#fb .next-btn');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  await page.waitForSelector('.complete');
  ok(/Mission done/.test(await page.locator('.missions-done').innerText()), 'keyboard round: missions ticked');
  ok(errors.length === 0, `${tag}: no errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// 390px wide, reduced motion, and old / broken saved data
// ═══════════════════════════════════════════════════════════════
async function runExtras(browser) {
  for (const pid of ['k', 'g5']) {
    const tag = `phone-${pid}`;
    console.log(`\n▶ ${tag}`);
    const vp = VPS.phone;
    const { ctx, page, errors } = await newPage(browser, vp, 0);
    await press(page, vp, page.locator(`.profile-card[onclick*="'${pid}'"]`));
    await page.waitForSelector('.missions-card');
    await force(page, pid, pid === 'k' ? ['speak2', 'inarow5', 'subj:reading'] : ['inarow7', 'score8', 'review']);
    const w = await page.evaluate(() => { const c = document.querySelector('.missions-card').getBoundingClientRect(); const z = document.querySelector('.fun-zone').getBoundingClientRect(); return [c.width, z.width]; });
    ok(Math.abs(w[0] - w[1]) < 2, `${tag}: the card takes the full row on a phone`);
    await layout(page, vp, pid, `${tag} hub`);
    await page.screenshot({ path: path.join(SHOTS, `${tag}-01-hub.png`) });
    // Two fast taps are two taps.
    await page.evaluate(() => { window.__sounds = []; });
    const row = page.locator('.missions-card .missions-item[role=button]').first();
    await row.tap();
    await row.tap();
    await page.waitForTimeout(150);
    ok(await page.evaluate(() => window.__sounds.filter(n => n === 'tap').length) === 2, `${tag}: two fast taps register as two taps`);
    await page.waitForTimeout(900);
    await page.evaluate(() => document.getElementById('app').scrollTo(0, 0));
    await force(page, pid, ['rounds1', 'inarow3', 'subj:math'], { last: FUN_YESTERDAY(), streak: 4, best: 6 });
    await playRound(page, vp, pid, { plan: ['R', 'R', 'R'], pack: { subject: 'math' } });
    await page.waitForTimeout(1200);
    await layout(page, vp, pid, `${tag} complete`);
    await page.locator('.missions-done').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, `${tag}-02-complete.png`) });
    await backToHub(page, vp);
    await layout(page, vp, pid, `${tag} hub all done`);
    await page.screenshot({ path: path.join(SHOTS, `${tag}-03-hub-all.png`) });
    ok(errors.length === 0, `${tag}: no errors: ${errors.join(' | ')}`);
    await ctx.close();
  }

  {
    console.log('\n▶ reduced-motion');
    const vp = VPS.ipad;
    const { ctx, page, errors } = await newPage(browser, vp, 0, { reducedMotion: 'reduce' });
    await press(page, vp, page.locator(`.profile-card[onclick*="'g5'"]`));
    await page.waitForSelector('.missions-card');
    await force(page, 'g5', ['rounds1', 'inarow3', 'subj:math']);
    await playRound(page, vp, 'g5', { plan: ['R', 'R', 'R'], pack: { subject: 'math' } });
    await page.waitForTimeout(1200);
    ok(await page.locator('.fun-confetti').count() === 0, 'reduced motion: no confetti');
    ok(/ALL 3 MISSIONS DONE/.test(await toastText(page)), 'reduced motion: still a toast');
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('.missions-done-row')).animationName === 'none'), 'reduced motion: rows do not animate');
    await press(page, vp, page.locator('.complete .next-btn').nth(1));
    await page.waitForSelector('.missions-card');
    ok(errors.length === 0, `reduced motion: no errors: ${errors.join(' | ')}`);
    await ctx.close();
  }

  {
    console.log('\n▶ old-data');
    const vp = VPS.laptop;
    const { ctx, page, errors } = await newPage(browser, vp, 0);
    // A feature that is not in this app: boss when missions is alone, sprint
    // (no module has it yet) when the boss module is built in.
    // A mission whose feature is not built in; with every module built in, a retired id stands in for one.
    const gone = await page.evaluate(() => typeof bossStart !== 'function' ? 'boss' : typeof sprintStart !== 'function' ? 'sprint' : 'retired-mission');
    await page.evaluate(gone => {
      state.profiles.g5.fun = { missions: { day: 'garbage', ids: 'nope', c: null, done: 'x', streak: 'abc', best: null, last: 7, aceDays: '2' } };
      state.profiles.k.fun = { missions: { day: FUN.today(), ids: ['rounds1', gone, 'inarow3'], c: { rounds: 0 }, done: [] } };
      delete state.profiles.g3.fun;
      saveState();
    }, gone);
    await reloadPage(page);
    await press(page, vp, page.locator(`.profile-card[onclick*="'g5'"]`));
    await page.waitForSelector('.missions-card');
    const s = await store(page, 'g5');
    ok(Array.isArray(s.ids) && s.ids.length === 3 && s.streak === 0 && s.best === 0 && Array.isArray(s.done), 'broken saved data is repaired');
    ok(await page.locator('.missions-card .missions-item').count() === 3, 'card renders from broken data');
    await page.evaluate(() => renderProfileSelect());
    await press(page, vp, page.locator(`.profile-card[onclick*="'k'"]`));
    await page.waitForSelector('.missions-card');
    const sk = await store(page, 'k');
    ok(!sk.ids.includes(gone) && sk.ids.length === 3 && new Set(sk.ids.map(missionsFamNode)).size === 3, `a mission for a missing feature (${gone}) is swapped out: ` + sk.ids);
    await page.evaluate(() => renderProfileSelect());
    await press(page, vp, page.locator(`.profile-card[onclick*="'g3'"]`));
    await page.waitForSelector('.missions-card');
    ok(await page.locator('.missions-card .missions-item').count() === 3, 'g3 (never saw the module) gets missions too');
    ok(errors.length === 0, `old data: no errors: ${errors.join(' | ')}`);
    await ctx.close();
  }
}
function FUN_YESTERDAY() { return DAYKEY(-1); }

// ═══════════════════════════════════════════════════════════════
// With the other modules the game has (buddy, boss, stickers):
// the play zone together, a real boss battle finishing the boss mission,
// and the sticker the missions bonus asks for.
// ═══════════════════════════════════════════════════════════════
async function runIntegration(browser) {
  const others = ['buddy', 'boss', 'stickers'].filter(app.has);
  if (!others.length) { console.log('\n▶ integration: no other modules present, skipped'); skipped = '; skipped the pass with the other modules (none in the game)'; return; }
  const out = HTML;
  for (const pid of ['k', 'g5']) {
    const tag = `integ-${pid}`;
    console.log(`\n▶ ${tag} (with ${others.join(', ')})`);
    const vp = VPS.ipad;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'America/New_York' });
    await ctx.addInitScript(require('./together').quietBuddy);   // every module built in: see together.js
    const page = await ctx.newPage();
    const errors = [], warns = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); if (m.type() === 'warning' && /\[fun\]/.test(m.text())) warns.push(m.text()); });
    page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });
    await page.clock.setSystemTime(DAY(0));
    await page.goto('file://' + out);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await instrument(page);
    await page.evaluate(pid => {
      if (typeof buddyStore === 'function') Object.assign(buddyStore(pid), { type: 'crab', name: 'Pinchy', shownStage: 0 });
      const s = missionsStore(pid); s.last = FUN.today(-1); s.streak = 2; s.best = 2;
      saveState();
    }, pid);
    await press(page, vp, page.locator(`.profile-card[onclick*="'${pid}'"]`));
    await page.waitForSelector('.missions-card');
    await page.waitForTimeout(600);
    const order = await page.evaluate(() => [...document.querySelectorAll('.fun-zone > .fun-card')].map(c => c.className));
    ok(order.some(c => /missions-card/.test(c)), `${tag}: missions card in the play zone with the others (${order.length} cards)`);
    await layout(page, vp, pid, `${tag} hub`);
    await page.screenshot({ path: path.join(SHOTS, `${tag}-01-hub.png`) });
    const hasBoss = await page.evaluate(() => typeof bossStart === 'function');
    if (hasBoss) {
      await force(page, pid, ['boss', 'rounds1', 'inarow3']);
      await page.waitForTimeout(300);
      await press(page, vp, page.locator('.missions-card .missions-item').first());
      await page.waitForTimeout(pid === 'k' ? 1000 : 600);
      ok(await page.evaluate(() => { const f = document.querySelector('.missions-flash'); return !!f && f.closest('.fun-zone') !== null && /boss/.test(f.className); }), `${tag}: tapping the boss mission points at the boss card`);
      await page.evaluate(() => { document.getElementById('app').scrollTo(0, 0); window.__events = []; bossStart(); });
      if (await page.locator('.briefing-go').count()) await press(page, vp, page.locator('.briefing-go'));
      for (let i = 0; i < 14 && !(await page.locator('.complete').count()); i++) {
        await page.waitForSelector('.question-frame');
        await answerAndWait(page, vp);
        await press(page, vp, page.locator('#fb .next-btn'));
      }
      await page.waitForSelector('.complete');
      await page.waitForTimeout(1300);
      const s = await store(page, pid);
      ok(s.done.includes('boss') && s.done.includes('rounds1') && s.bonus, `${tag}: a real boss battle finishes the boss mission and all three (${s.done})`);
      ok(await page.evaluate(pid => window.__events.includes(`awardSticker:${pid}:missions`), pid), `${tag}: missions sticker asked for`);
      ok(s.streak === 3, `${tag}: the boss battle counts for the day streak`);
      ok(await toastsClear(page), `${tag}: the missions toast does not cover another module's toast`);
      if (await page.evaluate(() => typeof stickersStore === 'function')) {
        const got = await page.evaluate(pid => window.__events.includes(`stickerEarned:${pid}:missions`), pid);
        ok(got, `${tag}: the sticker module awarded the missions sticker`);
      }
      await layout(page, vp, pid, `${tag} complete`);
      await page.locator('.missions-done').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SHOTS, `${tag}-02-boss-complete.png`) });
      await press(page, vp, page.locator('.complete .next-btn').nth(1));
      await page.waitForSelector('.missions-card');
      await page.waitForTimeout(700);
      await layout(page, vp, pid, `${tag} hub after`);
      await page.screenshot({ path: path.join(SHOTS, `${tag}-03-hub-after.png`) });
    }
    if (warns.length) console.log(`    note (${tag}): module warnings: ${warns.slice(0, 3).join(' | ')}`);
    ok(errors.length === 0, `${tag}: no page/console errors: ${errors.slice(0, 4).join(' | ')}`);
    await ctx.close();
  }
}
function missionsFamNode(id) { return String(id).replace(/:.*$/, '').replace(/\d+$/, ''); }

(async () => {
  const browser = await chromium.launch({ executablePath: app.CHROMIUM });
  const t0 = Date.now();
  try {
    await poolChecks(browser);
    for (const vp of [VPS.ipad, VPS.laptop]) for (const pid of ['k', 'g5']) await runFull(browser, vp, pid);
    for (const pid of ['k', 'g5']) await runKeyboard(browser, pid);
    await runExtras(browser);
    await runIntegration(browser);
  } catch (e) {
    fails++;
    failList.push('crash: ' + (e && e.stack || e));
    console.log('CRASH', e);
  }
  await browser.close();
  console.log(`\nscreenshots: tools/${path.relative(app.TOOLS, SHOTS)}/`);
  if (fails) console.log('failures:\n  ' + failList.join('\n  '));
  const again = retries ? `; ${retries} answer(s) pressed a second time (see the "note:" lines)` : '';
  console.log(`missions: ${fails ? 'FAIL' : 'PASS'} — ${passes} checks passed, ${fails} failed (${Math.round((Date.now() - t0) / 1000)}s)${skipped}${again}`);
  process.exit(fails ? 1 : 0);
})();
