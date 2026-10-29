// Boss Battles — end-to-end test.
//   node modules/boss.test.js [app.html]
// On the game file (the repo's, $TT_APP, or the one named), with the boss
// module and every other one built in: for the kindergartener (k) and the
// fifth grader (g5), on an iPad in portrait (820×1180, touch taps) and a
// 1440×900 laptop (mouse clicks), walks every path: the hidden pack and its
// mixed round, the hub card, the VS briefing, the arena (zap, fixed-after-a-
// hint half zap, super zap, a miss, a retry), victory (early finish, events,
// sticker request, trophy, next boss), a real mixed round won through the UI,
// an escape (hearts run out), running out of questions, leaving mid-battle,
// BOSS LEGEND and the rematch lap, old or broken saved data, and a normal
// round start to finish. Then a keyboard-only pass, a 390px reduced-motion
// pass, and a pass with the buddy and sticker modules (when the game has
// them). Fails on any page error, console error, dialog, horizontal overflow,
// or a boss tap target under 44px (56px for the kindergartener). Screenshots
// go to tools/out/shots/boss/.
const { chromium } = require('playwright');
const path = require('path');
const app = require('./app');

const HTML = app.APP;
// The suite is for the boss module as the game file has it: without it, it fails.
if (!app.has('boss')) { console.log('boss: FAIL — the game file has no boss module'); process.exit(1); }
// The together pass: the same game, when buddy and stickers are built in.
const HTML_ALL = app.APP;
const haveOthers = app.has('buddy') && app.has('stickers');
const SHOTS = app.shots('boss');
console.log('app: ' + HTML);

let passes = 0, fails = 0;
const failList = [];
function ok(cond, msg) {
  if (cond) passes++;
  else { fails++; failList.push(msg); console.log('    FAIL ' + msg); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const UNSAFE = /\b(kill|kills|killed|die|dies|died|dead|death|blood|murder|destroy|attack|weapon|gun|stab|punch|hurt you|stupid|dumb|loser)\b/i;

const VIEWPORTS = [
  { name: 'ipad', width: 820, height: 1180, touch: true },
  { name: 'laptop', width: 1440, height: 900, touch: false },
];

// A tap on a touch device, a click with a mouse.
async function press(page, vp, loc) {
  await loc.first().scrollIntoViewIfNeeded();
  if (vp.touch) await loc.first().tap(); else await loc.first().click();
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
    const transient = el => el.closest('.fun-confetti, .fun-toast, .trophy-pop, .xp-pop, .streak-pop, .boss-fx, .boss-spark, #exit-modal-backdrop');
    const over = [];
    for (const el of document.querySelectorAll('body *')) {
      if (transient(el) || !vis(el)) continue;
      const b = el.getBoundingClientRect();
      if (b.right > W + 1 || b.left < -1) over.push(desc(el) + ` [${Math.round(b.left)}..${Math.round(b.right)} of ${W}]`);
    }
    const small = [];
    for (const el of document.querySelectorAll('button, [role=button], [role=checkbox], input[type=text]')) {
      if (transient(el) || !vis(el)) continue;
      const b = el.getBoundingClientRect();
      const mine = !!el.closest('.boss-scope') || /\bboss-/.test(String(el.className));
      small.push({ d: desc(el), w: b.width, h: b.height, mine });
    }
    const app = document.getElementById('app');
    return { over, small, docOver: document.documentElement.scrollWidth > W + 1, appOver: app.scrollWidth > app.clientWidth + 1 };
  });
  ok(!r.docOver && !r.appOver, `${label}: page scrolls horizontally`);
  ok(r.over.length === 0, `${label}: elements overflow the viewport: ${r.over.slice(0, 4).join(' | ')}`);
  const floor = pid === 'k' ? 55.5 : 43.5;
  const mineSmall = r.small.filter(s => s.mine && (s.w < floor || s.h < floor));
  ok(mineSmall.length === 0, `${label}: boss tap targets under ${Math.round(floor)}px: ${mineSmall.map(s => `${s.d} ${Math.round(s.w)}x${Math.round(s.h)}`).join(' | ')}`);
  const appSmall = r.small.filter(s => !s.mine && (s.w < 43.5 || s.h < 43.5));
  if (appSmall.length) console.log(`    note (${label}, app's own controls under 44px, not this module): ${appSmall.slice(0, 3).map(s => `${s.d} ${Math.round(s.w)}x${Math.round(s.h)}`).join(' | ')}`);
  return r;
}

async function newPage(browser, vp, file, extra) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, deviceScaleFactor: 1 }, extra || {}));
  ctx.setDefaultTimeout(12000);
  await ctx.addInitScript(require('./together').quietBuddy);   // every module built in: see together.js
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
    if (m.type() === 'warning' && /\[fun\]/.test(m.text())) errors.push('module threw: ' + m.text());
  });
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });
  await page.goto('file://' + (file || HTML));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await instrument(page);
  return { ctx, page, errors };
}
async function instrument(page) {
  await page.evaluate(() => {
    window.__spoken = [];
    window.speakText = function (t) { window.__spoken.push(String(t)); };   // headless has no voices
    window.__sounds = [];
    window.funSound = function (n) { window.__sounds.push(n); };
    window.__confetti = [];
    const conf = funConfetti;
    window.funConfetti = function (o) { window.__confetti.push(o || {}); conf(o); };
    window.__events = [];
    FUN.on('bossDefeated', e => window.__events.push({ type: 'bossDefeated', pid: e.profileId, boss: e.boss }));
    FUN.on('awardSticker', e => window.__events.push({ type: 'awardSticker', pid: e.profileId, reason: e.reason }));
  });
}

const store = (page, pid) => page.evaluate(pid => JSON.parse(JSON.stringify(FUN.store(pid, 'boss'))), pid);
const battle = page => page.evaluate(() => bossBattle ? JSON.parse(JSON.stringify(bossBattle)) : null);
const roster = (page, pid) => page.evaluate(pid => bossRoster(pid).map(b => ({ id: b.id, name: b.name, emoji: b.emoji, taunt: b.taunt, defeat: b.defeat, getaway: b.getaway })), pid);
const lines = (page, pid) => page.evaluate(pid => BOSS_LINES[bossTone(pid)], pid);
const sounds = page => page.evaluate(() => window.__sounds.slice());
const clearSounds = page => page.evaluate(() => { window.__sounds.length = 0; });
const events = page => page.evaluate(() => window.__events.slice());
const spokenHas = (page, s) => page.evaluate(s => window.__spoken.some(t => t.includes(s)), s);

async function arena(page) {
  return page.evaluate(() => {
    const a = document.getElementById('boss-arena');
    if (!a) return null;
    const t = sel => { const e = a.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
    return {
      full: a.querySelectorAll('.boss-pip--full').length, half: a.querySelectorAll('.boss-pip--half').length,
      empty: a.querySelectorAll('.boss-pip--empty').length, pop: a.querySelectorAll('.boss-pip--pop').length,
      hearts: a.querySelectorAll('.boss-heart:not(.boss-heart--empty)').length, lost: !!a.querySelector('.boss-heart--lost'),
      hp: t('.boss-hp-num'), name: t('.boss-foe-name'), bubble: t('.boss-bubble-text'), fx: t('.boss-fx'),
      banner: t('.boss-banner'), foe: a.querySelector('.boss-foe').className, cls: a.className,
      say: (a.querySelector('.boss-say .js-speak') || { getAttribute: () => '' }).getAttribute('data-speak-text'),
    };
  });
}

// Controlled questions (raw, so choice A is always right).
const mcq = n => ({ type: 'mc', text: `Boss practice ${n}: which one is a fruit?`, options: ['Apple', 'Rock', 'Shoe', 'Cloud'], correct: 0,
  why: 'An apple grows on a tree and you can eat it.', hint: 'Which one can you eat?' });
const mcqs = n => Array.from({ length: n }, (_, i) => mcq(i + 1));

async function toHub(page, vp, pid) {
  await press(page, vp, page.locator(`.profile-card[onclick*="'${pid}'"]`));
  await page.waitForSelector('.hub');
}
// From the hub: BATTLE! → VS briefing → (controlled questions) → LET'S GO.
async function startBattle(page, vp, qs, shot) {
  await press(page, vp, page.locator('.boss-go'));
  await page.waitForSelector('.boss-vs');
  if (shot) await shot();
  if (qs) await page.evaluate(qs => { questions = qs.map(q => JSON.parse(JSON.stringify(q))); qIdx = 0; }, qs);
  await press(page, vp, page.locator('.briefing-go'));
  await page.waitForSelector('#boss-arena');
}
const pickA = (page, vp) => press(page, vp, page.locator('.choice').nth(0));
const pickWrong = (page, vp, i) => press(page, vp, page.locator('.choice').nth(i || 1));
async function next(page, vp) { await press(page, vp, page.locator('#fb .next-btn')); }

// Answer whatever real question is showing, correctly, through the UI.
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
    if (q.type === 'showwork') { await page.locator('#workDone').check(); await page.waitForTimeout(120); }
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
    await page.waitForTimeout(250);
    await press(page, vp, page.locator('.part-choice[data-part="B"]').nth(q.pb));
  }
  await page.waitForSelector('#fb .next-btn');
  return q.type;
}

function checkSafeText(label, text) {
  const m = String(text).match(UNSAFE);
  ok(!m, `${label}: unkind/violent word "${m && m[0]}" in: ${String(text).slice(0, 80)}`);
}

// ═══════════════════════════════════════════════════════════════
async function runFull(browser, vp, pid) {
  const tag = `${vp.name}-${pid}`;
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp);
  const shot = name => page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) });
  const isK = pid === 'k';
  const R = await roster(page, pid);
  const L = await lines(page, pid);
  ok(R.length === 8, 'roster has 8 bosses');
  ok(new Set(R.map(b => b.id)).size === 8 && R.every(b => b.emoji && b.name && b.taunt && b.defeat && b.getaway), 'every boss has emoji, name, taunt, defeat and getaway lines');
  if (isK) ok(R[0].name === 'Grumbly Goo' && /giggle/i.test(R[0].defeat), 'the kindergartener meets Grumbly Goo first, who gets the giggles');
  else ok(R.some(b => b.name === 'The Fraction Phantom'), 'g5 roster has The Fraction Phantom');
  [...R.flatMap(b => [b.name, b.taunt, b.defeat, b.getaway]), ...Object.values(L).flat()].forEach(t => checkSafeText(`${pid} boss text`, t));

  // ── 1. The hidden pack and its mixed round ──
  const packInfo = await page.evaluate(pid => {
    const pk = PACKS[pid].find(p => p.id === 'boss_battle');
    const nowIds = new Set(PACKS[pid].filter(p => p.tier === 'now' && !p.quest && !p.hidden).map(p => p.id));
    const rounds = [];
    for (let i = 0; i < 6; i++) {
      const qs = pk.getQuestions(pid);
      rounds.push({ n: qs.length, packs: qs.map(q => q._bossPack), allNow: qs.every(q => nowIds.has(q._bossPack)), from: qs.every(q => !!q._from) });
    }
    const viaEngine = getQuestions(pk, pid);
    // A child with only three packs still gets a full-ish round, from those three.
    const saved = PACKS[pid];
    PACKS[pid] = saved.filter(p => p.tier === 'now' && !p.quest).slice(0, 3);
    const few = bossBuildRound(pid);
    PACKS[pid] = saved;
    return {
      exists: !!pk, hidden: pk && pk.hidden, tier: pk && pk.tier, subject: pk && pk.subject, icon: pk && pk.icon, title: pk && pk.title,
      desc: pk && pk.desc, why: PACK_WHY['boss_battle:' + pid], rounds, engineN: viaEngine.length,
      enginePrepared: viaEngine.every(q => (q.type || 'mc') !== 'mc' || Array.isArray(q.options)),
      inGrade: allPacks().filter(p => p.id === 'boss_battle').some(p => gradePacks(p.grade || 'x').includes(p)),
      nowCount: nowIds.size, few: few.length, fewPacks: new Set(few.map(q => q._bossPack)).size,
      onePerChild: Object.keys(PACKS).every(k => PACKS[k].filter(p => p.id === 'boss_battle').length === 1),
    };
  }, pid);
  ok(packInfo.exists && packInfo.hidden === true && packInfo.tier === 'boss' && packInfo.subject === 'boss' && packInfo.icon === '👾' && packInfo.title === 'Boss Battle', 'boss_battle pack registered hidden with tier/subject boss');
  ok(packInfo.onePerChild, 'exactly one boss_battle pack per child');
  ok(packInfo.desc && packInfo.desc.length > 10, 'pack has a desc');
  ok(packInfo.why && /mix/i.test(packInfo.why), 'PACK_WHY explains mixed practice: ' + packInfo.why);
  if (isK) ok(!/state test/i.test(packInfo.why), 'K why does not claim a state test (kindergarten has none)');
  else ok(/state test/i.test(packInfo.why), 'g5 why mentions the state tests');
  ok(packInfo.rounds.every(r => r.n === 10), 'every battle round has 10 questions: ' + packInfo.rounds.map(r => r.n));
  ok(packInfo.rounds.every(r => new Set(r.packs).size === 10), 'one question from each of 10 different packs');
  ok(packInfo.rounds.every(r => r.allNow && r.from), "questions come only from this year's non-quest, non-hidden packs, tagged with their pack");
  ok(packInfo.engineN === 10 && packInfo.enginePrepared, 'engine getQuestions() builds the battle round');
  ok(!packInfo.inGrade, 'boss pack never appears in Explore Any Grade');
  ok(packInfo.few === 9 && packInfo.fewPacks === 3, `fewer than ten packs: goes round again (${packInfo.few} from ${packInfo.fewPacks})`);

  // ── 2. Hub card ──
  await toHub(page, vp, pid);
  await page.waitForSelector('.boss-hubcard');
  const hub = await page.evaluate(() => {
    const c = document.querySelector('.boss-hubcard');
    const zone = c.closest('.fun-zone');
    return { inZone: !!zone, name: c.querySelector('.boss-hub-name').textContent, hp: c.querySelector('.boss-hub-hp').textContent,
             pips: c.querySelectorAll('.boss-pip--full').length, badge: c.querySelector('.fun-card-badge').textContent,
             btn: c.querySelector('button.boss-go').textContent.trim(), say: !!c.querySelector('.boss-say .js-speak'),
             text: c.innerText };
  });
  ok(hub.inZone, 'hub card sits in the play zone');
  ok(hub.name === R[0].name && /8 HP/.test(hub.hp) && hub.pips === 8 && hub.badge === '1/8', `hub card shows boss 1 with 8 HP (${hub.name}, ${hub.hp}, ${hub.badge})`);
  ok(/BATTLE!/.test(hub.btn), 'hub card has a BATTLE! button');
  ok(hub.say === isK, `read-aloud on the hub card ${isK ? 'for' : 'not for'} this child`);
  checkSafeText('hub card', hub.text);
  await shot('01-hub');
  await page.locator('.boss-hubcard').screenshot({ path: path.join(SHOTS, `${tag}-01b-hubcard.png`) });
  await layout(page, vp, pid, `${tag} hub`);
  if (isK) {
    await press(page, vp, page.locator('.boss-hubcard .js-speak'));
    ok(await spokenHas(page, R[0].name), 'hub 🔊 reads the boss and what to do');
  }

  // ── 3. Battle A (controlled): VS briefing, zap, retry, half zap, miss, super zap, victory ──
  await page.evaluate(() => { window.__spoken.length = 0; });
  await startBattle(page, vp, mcqs(10), async () => {
    const vs = await page.evaluate(() => {
      const v = document.querySelector('.briefing .boss-vs');
      return v && { name: v.querySelector('.boss-vs-name').textContent, stat: v.querySelector('.boss-vs-stat').textContent,
        rules: v.querySelectorAll('.boss-vs-rules li').length, go: document.querySelector('.briefing-go').textContent, text: v.innerText,
        why: !!document.querySelector('.briefing .why-matters') };
    });
    ok(vs && vs.name === R[0].name && /8 HP/.test(vs.stat) && vs.rules === 3, 'briefing becomes a VS screen with the boss, its HP and the rules');
    ok(vs && vs.why, 'the honest why is still on the briefing');
    ok(vs && /BATTLE/.test(vs.go), 'go button says battle: ' + (vs && vs.go));
    checkSafeText('VS screen', vs && vs.text);
    await page.waitForTimeout(500);
    if (isK) ok(await spokenHas(page, 'Boss battle!'), 'K: the VS screen is read aloud automatically');
    await shot('02-briefing');
    await layout(page, vp, pid, `${tag} briefing`);
  });
  let st = await store(page, pid);
  ok(st.battles === 1, 'battles counted at start');
  let a = await arena(page);
  ok(a && a.full === 8 && a.hearts === 3 && a.name === R[0].name && a.hp === '8/8', `arena: 8 HP, 3 hearts (${a && a.hp}, ${a && a.hearts})`);
  ok(a && a.bubble === R[0].taunt, 'arena bubble starts with the taunt');
  ok(isK ? !!(a && a.say) : !(a && a.say), `arena read-aloud ${isK ? 'present' : 'absent'}`);
  const face = await page.evaluate(() => document.querySelector('#boss-arena .boss-me-face').textContent.trim());
  ok(face === (isK ? '🌈' : '🔥'), 'without the buddy module, the child is shown by their profile emoji: ' + face);
  await shot('03-arena');
  await layout(page, vp, pid, `${tag} arena`);

  // Q1 right → −1
  await clearSounds(page);
  await pickA(page, vp);
  a = await arena(page);
  let b = await battle(page);
  ok(b.hp === 7 && a.full === 7 && a.hp === '7/8', `right answer zaps 1 HP (${b.hp})`);
  ok(/boss-foe--hit/.test(a.foe) && /−1/.test(a.fx) && a.pop === 1, 'hit animation, ZAP label and the pip pops');
  ok(L.hit.includes(a.bubble), 'boss reacts with a hit line: ' + a.bubble);
  ok((await sounds(page)).includes('hit'), "funSound('hit') on a zap");
  await shot('04-hit');
  if (isK) {
    await press(page, vp, page.locator('#boss-arena .js-speak'));
    ok(await spokenHas(page, '7 HP left'), 'arena 🔊 reads the bubble and the score');
  }
  await next(page, vp);
  ok((await arena(page)).hp === '7/8', 'arena carries the HP to the next question');

  // Q2 wrong then right → retry giggle, then −½
  await pickWrong(page, vp, 1);
  await page.waitForTimeout(200);
  a = await arena(page);
  ok(L.retry.includes(a.bubble) && /giggle/.test(a.foe) && a.hearts === 3, 'first miss: boss giggles, no heart lost');
  await shot('05-retry');
  await clearSounds(page);
  await pickA(page, vp);
  a = await arena(page); b = await battle(page);
  ok(b.hp === 6.5 && a.half === 1 && a.hp === '6½/8' && /−½/.test(a.fx), `fixed after a hint zaps half (${b.hp}, ${a.hp})`);
  ok((await sounds(page)).includes('hit'), 'half zap also plays hit');
  await shot('06-half');
  await next(page, vp);

  // Q3 final wrong → a heart
  await clearSounds(page);
  await pickWrong(page, vp, 1);
  await page.waitForTimeout(450);
  await pickWrong(page, vp, 2);
  await page.waitForTimeout(260);
  a = await arena(page); b = await battle(page);
  ok(b.hearts === 2 && a.hearts === 2 && a.lost && b.hp === 6.5, 'final wrong costs a heart, boss HP unchanged');
  ok(L.miss.includes(a.bubble) && /giggle/.test(a.foe) && /arena--miss/.test(a.cls), 'gentle taunt and a giggle');
  ok((await sounds(page)).includes('hurt'), "funSound('hurt') on a lost heart");
  await shot('07-miss');
  await layout(page, vp, pid, `${tag} miss`);
  await next(page, vp);

  // Q4-Q6 right → third in a row is a SUPER ZAP (−2)
  await pickA(page, vp); await next(page, vp);
  await pickA(page, vp); await next(page, vp);
  ok((await battle(page)).hp === 4.5, 'two more zaps → 4.5');
  await pickA(page, vp);
  a = await arena(page); b = await battle(page);
  ok(b.hp === 2.5 && b.supers === 1 && /SUPER ZAP/.test(a.fx) && /−2/.test(a.fx) && /boss-foe--super/.test(a.foe), `3 in a row = SUPER ZAP −2 (${b.hp})`);
  ok(L.super.includes(a.bubble), 'super zap line');
  await shot('08-super');
  await next(page, vp);

  // Q7, Q8, Q9 → 1.5, 0.5, then super zap → victory, round ends after Q9
  await pickA(page, vp); await next(page, vp);
  await pickA(page, vp); await next(page, vp);
  await clearSounds(page);
  await pickA(page, vp);
  a = await arena(page); b = await battle(page);
  const qlen = await page.evaluate(() => questions.length);
  ok(b.hp === 0 && b.result === 'win', 'boss reaches 0 HP: victory');
  ok(qlen === 9, `round shortened to finish after this question (questions.length=${qlen})`);
  ok(/boss-foe--down/.test(a.foe) && /YOU (ZAPPED|BEAT)/.test(a.banner) && a.bubble === R[0].defeat, 'boss spins out, banner and defeat line');
  ok(/FINISH/.test(await page.locator('#fb .next-btn').textContent()), 'feedback offers FINISH ROUND');
  await shot('09-victory-arena');
  await page.evaluate(() => { window.__spoken.length = 0; });
  await press(page, vp, page.locator('#fb .next-btn'));
  await page.waitForSelector('.complete');
  st = await store(page, pid);
  ok(st.wins === 1 && st.idx === 1 && st.tired === 0 && st.beaten[R[0].id] === 1 && st.last.result === 'win', 'victory saved: wins 1, next boss unlocked');
  const ev = await events(page);
  ok(ev.some(e => e.type === 'bossDefeated' && e.pid === pid && e.boss.id === R[0].id && e.boss.name === R[0].name), 'bossDefeated emitted with the boss');
  ok(ev.some(e => e.type === 'awardSticker' && e.pid === pid && e.reason === 'boss'), "awardSticker emitted with reason 'boss'");
  ok((await sounds(page)).includes('win'), "funSound('win') on victory");
  ok((await page.evaluate(() => window.__confetti.length)) >= 1, 'confetti on victory');
  ok(await page.evaluate(() => state.profiles[currentProfile.id].trophies.includes('boss_buster')), 'BOSS BUSTER trophy on the first win');
  ok(await page.evaluate(() => TROPHIES.some(t => t.id === 'boss_buster' && t.emoji === '👾') && TROPHIES.some(t => t.id === 'boss_legend' && t.emoji === '🏰')), 'both trophies registered');
  const done = await page.evaluate(() => {
    const d = document.querySelector('.boss-done');
    return d && { win: d.classList.contains('boss-done--win'), kicker: d.querySelector('.boss-done-kicker').textContent,
      line: d.querySelector('.boss-bubble-text').textContent, next: d.querySelector('.boss-next-name').textContent,
      head: d.querySelector('.boss-next-head').textContent, text: d.innerText, first: document.querySelector('.complete').querySelector('.boss-done, .lookback') === d };
  });
  ok(done && done.win && /WON|BEATEN/.test(done.kicker) && done.line === R[0].defeat, 'victory card with the defeat line');
  ok(done && done.next === R[1].name && /9 HP/.test(done.head), `preview of the next boss with 9 HP (${done && done.head})`);
  ok(done && done.first, 'boss card leads the round-complete extras');
  checkSafeText('victory card', done && done.text);
  await page.waitForTimeout(1700);
  const autoRead = await page.evaluate(pid => !!state.profiles[pid].autoRead, pid);
  if (isK) ok(autoRead, 'K has auto-read on by default');
  if (autoRead) ok(await spokenHas(page, R[0].defeat), 'auto-read: the victory is read aloud once the screen is quiet');
  else ok(!(await spokenHas(page, R[0].defeat)), 'auto-read off: the victory is not read aloud');
  await shot('10-victory-complete');
  await page.screenshot({ path: path.join(SHOTS, `${tag}-10b-victory-complete-full.png`), fullPage: true });
  await layout(page, vp, pid, `${tag} victory complete`);
  await press(page, vp, page.locator('.complete .next-btn', { hasText: 'BACK TO PACKS' }));
  await page.waitForSelector('.boss-hubcard');
  const hub2 = await page.evaluate(() => { const c = document.querySelector('.boss-hubcard'); return { name: c.querySelector('.boss-hub-name').textContent, hp: c.querySelector('.boss-hub-hp').textContent, badge: c.querySelector('.fun-card-badge').textContent, foot: c.querySelector('.boss-hub-foot').textContent }; });
  ok(hub2.name === R[1].name && /9 HP/.test(hub2.hp) && hub2.badge === '2/8' && /1 beaten/.test(hub2.foot), `hub shows boss 2 with 9 HP (${hub2.name} ${hub2.hp} ${hub2.badge})`);
  await shot('11-hub-boss2');

  // ── 4. Battle B: a real mixed round, all right through the UI ──
  await page.evaluate(() => { window.__events.length = 0; });
  await startBattle(page, vp, null);
  const tags = new Set();
  for (let i = 0; i < 12; i++) {
    tags.add(await page.locator('.question-tag').textContent());
    await answerCorrect(page, vp);
    if (i === 0) await shot('12-real-hit');
    const last = await page.locator('#fb .next-btn').textContent();
    await press(page, vp, page.locator('#fb .next-btn'));
    if (/FINISH/.test(last)) break;
  }
  await page.waitForSelector('.complete');
  const sum = await page.evaluate(() => ({ total: questions.length, score }));
  ok(sum.total === 7 && sum.score === 7, `all right vs 9 HP: wins after 7 questions with two super zaps (${sum.score}/${sum.total})`);
  ok(tags.size === 7, `each question tagged with a different pack (${[...tags].join(' | ')})`);
  st = await store(page, pid);
  ok(st.wins === 2 && st.idx === 2, 'second boss beaten');
  ok((await events(page)).filter(e => e.type === 'bossDefeated').length === 1, 'one bossDefeated per victory');
  await shot('13-real-victory');
  await press(page, vp, page.locator('.complete .next-btn', { hasText: 'BACK TO PACKS' }));
  await page.waitForSelector('.boss-hubcard');
  ok(/10 HP/.test(await page.locator('.boss-hubcard .boss-hub-hp').textContent()), 'HP caps at 10 from the third boss');

  // ── 5. Battle C: hearts run out → it gets away ──
  await startBattle(page, vp, mcqs(10));
  for (let i = 0; i < 3; i++) {
    await pickWrong(page, vp, 1);
    await page.waitForTimeout(450);
    await pickWrong(page, vp, 2);
    await page.waitForTimeout(150);
    if (i < 2) await next(page, vp);
  }
  a = await arena(page); b = await battle(page);
  ok(b.hearts === 0 && b.result === 'escape' && !b.ranOut, 'three hearts gone: the boss escapes');
  ok((await page.evaluate(() => questions.length)) === 3, 'round ends early after the third miss');
  ok(/boss-foe--flee/.test(a.foe) && /GOT AWAY/.test(a.banner) && a.bubble === R[2].getaway, 'boss flees with its getaway line');
  await shot('14-escape-arena');
  await press(page, vp, page.locator('#fb .next-btn'));
  await page.waitForSelector('.complete');
  st = await store(page, pid);
  ok(st.wins === 2 && st.idx === 2 && st.tired === 1 && st.escapes === 1 && st.last.result === 'escape', 'escape saved: same boss, a little tired, nothing taken away');
  ok(!(await events(page)).some(e => e.type === 'bossDefeated' && e.boss.id === R[2].id), 'no bossDefeated on an escape');
  const esc = await page.evaluate(() => { const d = document.querySelector('.boss-done'); return d && { kicker: d.querySelector('.boss-done-kicker').textContent, line: d.querySelector('.boss-bubble-text').textContent, next: d.querySelector('.boss-next-name').textContent, head: d.querySelector('.boss-next-head').textContent, cheer: (d.querySelector('.boss-done-cheer') || {}).textContent || '', text: d.innerText }; });
  ok(esc && /GOT AWAY — TRY AGAIN/.test(esc.kicker) && esc.line === R[2].getaway, '"it got away — try again!" card with the boss line');
  ok(esc && esc.next === R[2].name && /9 HP/.test(esc.head) && /tired/i.test(esc.cheer), `next time: same boss, tired, 9 HP (${esc && esc.head} / ${esc && esc.cheer})`);
  checkSafeText('escape card', esc && esc.text);
  await shot('15-escape-complete');
  await layout(page, vp, pid, `${tag} escape complete`);
  await press(page, vp, page.locator('.complete .next-btn', { hasText: 'BACK TO PACKS' }));
  await page.waitForSelector('.boss-hubcard');
  const hub3 = await page.evaluate(() => ({ hp: document.querySelector('.boss-hubcard .boss-hub-hp').textContent, foot: document.querySelector('.boss-hubcard .boss-hub-foot').textContent }));
  ok(/9 HP/.test(hub3.hp) && /−1 HP/.test(hub3.foot), `hub shows the tired boss (${hub3.hp} · ${hub3.foot})`);
  await shot('16-hub-tired');

  // ── 6. Battle D: out of questions with hearts left → gets away; tired caps at 2 ──
  await startBattle(page, vp, mcqs(2));
  await pickA(page, vp); await next(page, vp);
  await pickA(page, vp);
  b = await battle(page);
  ok(b.result === 'escape' && b.ranOut && b.hearts === 3 && b.hp === 7, 'last question answered with the boss standing: it gets away');
  ok(/OUT OF QUESTIONS/.test((await arena(page)).banner), 'banner says it ran out of questions');
  await press(page, vp, page.locator('#fb .next-btn'));
  await page.waitForSelector('.complete');
  st = await store(page, pid);
  ok(st.tired === 2 && st.escapes === 2, 'tired grows to 2');
  await page.evaluate(pid => { bossBattle = bossNewBattle(pid); bossBattle.result = 'escape'; FUN.emit('roundEnd', { profileId: pid, pack: currentPack, score: 0, total: 1 }); }, pid);
  st = await store(page, pid);
  ok(st.tired === 2 && st.escapes === 3, 'tired never goes past 2');
  ok((await page.evaluate(pid => bossBattleHp(bossStore(pid)), pid)) === 8, 'tired boss: 10 − 2 = 8 HP');
  // With the sticker module built in, that extra round end earns a sticker,
  // which pops up over the complete screen: close it as a child would.
  await page.waitForTimeout(150);
  if (await page.locator('#stk-overlay .stk-ok').count()) await press(page, vp, page.locator('#stk-overlay .stk-ok'));
  await press(page, vp, page.locator('.complete .next-btn', { hasText: 'BACK TO PACKS' }));
  await page.waitForSelector('.boss-hubcard');

  // ── 7. Leaving mid-battle changes nothing ──
  const before = await store(page, pid);
  await startBattle(page, vp, mcqs(10));
  await pickA(page, vp);
  // Half of a two-part question: half a zap, no heart lost (synthetic event).
  const part = await page.evaluate(pid => {
    const b0 = JSON.parse(JSON.stringify(bossBattle));
    FUN.emit('answer', { profileId: pid, pack: currentPack, q: questions[qIdx], isRight: false, fixed: false, parts: [true, false], streak: 0 });
    return { before: b0, after: JSON.parse(JSON.stringify(bossBattle)) };
  }, pid);
  ok(part.after.hp === part.before.hp - 0.5 && part.after.hearts === part.before.hearts, 'half of a two-part question: half a zap, no heart lost');
  await press(page, vp, page.locator('.exit-btn'));
  await page.waitForSelector('#exit-modal-exit');
  await press(page, vp, page.locator('#exit-modal-exit'));
  await page.waitForSelector('.boss-hubcard');
  const after = await store(page, pid);
  ok(after.wins === before.wins && after.tired === before.tired && after.escapes === before.escapes && after.idx === before.idx && after.battles === before.battles + 1, 'leaving mid-battle: no win, no escape, no penalty');
  ok((await battle(page)) === null, 'battle state cleared on exit');

  // ── 8. BOSS LEGEND (5 wins) and the rematch lap after boss 8 ──
  await page.evaluate(pid => { const s = bossStore(pid); s.wins = 4; s.idx = 7; s.tired = 0; saveState(); renderHub(); }, pid);
  await page.waitForSelector('.boss-hubcard');
  ok((await page.locator('.boss-hubcard .boss-hub-name').textContent()) === R[7].name, 'boss 8 on the hub');
  await startBattle(page, vp, mcqs(10));
  for (let i = 0; i < 10; i++) {
    await pickA(page, vp);
    const last = await page.locator('#fb .next-btn').textContent();
    await press(page, vp, page.locator('#fb .next-btn'));
    if (/FINISH/.test(last)) break;
  }
  await page.waitForSelector('.complete');
  st = await store(page, pid);
  ok(st.wins === 5 && st.idx === 0 && st.laps === 1, 'beating boss 8 starts round two at boss 1');
  ok(await page.evaluate(() => state.profiles[currentProfile.id].trophies.includes('boss_legend')), 'BOSS LEGEND trophy at 5 wins');
  ok(/all 8/i.test(await page.locator('.boss-done-lap').innerText()), 'complete card celebrates all 8 bosses');
  await shot('17-lap-complete');
  await press(page, vp, page.locator('.complete .next-btn', { hasText: 'BACK TO PACKS' }));
  await page.waitForSelector('.boss-hubcard');
  ok(/REMATCH 1\/8/.test(await page.locator('.boss-hubcard .fun-card-badge').textContent()), 'hub badge says REMATCH');
  await shot('18-hub-rematch');
  await layout(page, vp, pid, `${tag} hub rematch`);

  // ── 9. Old or broken saved data ──
  await page.evaluate(pid => { state.profiles[pid].fun.boss = { idx: 42, wins: 'lots', tired: -3, beaten: [1, 2], escapes: null }; saveState(); renderHub(); }, pid);
  await page.waitForSelector('.boss-hubcard');
  st = await store(page, pid);
  ok(st.idx === 7 && st.wins === 0 && st.tired === 0 && !Array.isArray(st.beaten), 'broken saved data is repaired');
  await page.evaluate(pid => { delete state.profiles[pid].fun.boss; saveState(); renderHub(); }, pid);
  ok((await page.locator('.boss-hubcard .boss-hub-name').textContent()) === R[0].name, 'a child who never battled starts at boss 1');
  await page.evaluate(pid => { delete state.profiles[pid].fun; renderHub(); }, pid);
  ok(await page.locator('.boss-hubcard').count() === 1, 'no fun storage at all: hub still renders');

  // ── 10. A normal round plays start to finish with the module loaded ──
  await press(page, vp, page.locator('.pack-card').first());
  if (await page.locator('.briefing-go').count()) await press(page, vp, page.locator('.briefing-go'));
  await page.waitForSelector('.question-frame');
  let sawArena = false;
  for (let i = 0; i < 12; i++) {
    if (await page.locator('#boss-arena').count()) sawArena = true;
    await answerCorrect(page, vp);
    const last = await page.locator('#fb .next-btn').textContent();
    await press(page, vp, page.locator('#fb .next-btn'));
    if (/FINISH/.test(last)) break;
  }
  await page.waitForSelector('.complete');
  ok(!sawArena, 'no arena in a normal round');
  ok(await page.locator('.boss-done').count() === 0, 'no boss card after a normal round');
  ok((await page.evaluate(() => questions.length)) === 10, 'normal round: 10 questions');
  await shot('19-normal-complete');

  // ── 11. Parent dashboard ──
  await page.evaluate(() => renderParentDash());
  await page.waitForSelector('.boss-parent');
  const par = await page.evaluate(() => ({ text: document.querySelector('.boss-parent').innerText, rows: document.querySelectorAll('.boss-parent li').length, kids: Object.keys(PROFILES).length }));
  ok(/Boss Battles/.test(par.text) && par.rows === par.kids, 'parent dashboard: one boss row per child');
  checkSafeText('parent dashboard', par.text);
  await page.locator('.boss-parent').scrollIntoViewIfNeeded();
  await shot('20-parent');
  await layout(page, vp, pid, `${tag} parent`);
  ok(await page.evaluate(() => { const cp = currentProfile; currentProfile = null; try { bossStart(); return true; } catch (e) { return false; } finally { currentProfile = cp; } }), 'bossStart() with nobody signed in does nothing');

  ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// Keyboard only (laptop, no touch): Tab / Enter / letter keys / Esc
async function runKeyboard(browser) {
  const vp = { name: 'keys', width: 1440, height: 900, touch: false };
  console.log('\n▶ keyboard-only (g5)');
  const { ctx, page, errors } = await newPage(browser, vp);
  const tabTo = async (sel, max, back) => {
    for (let i = 0; i < (max || 40); i++) {
      if (await page.evaluate(sel => !!document.activeElement && document.activeElement.matches(sel), sel)) return true;
      await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    }
    return page.evaluate(sel => !!document.activeElement && document.activeElement.matches(sel), sel);
  };
  ok(await tabTo(`.profile-card[onclick*="'g5'"]`), 'Tab reaches the g5 profile card');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.boss-hubcard');
  ok(await tabTo('.boss-go', 60), 'Tab reaches BATTLE!');
  const ring = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0; });
  ok(ring, 'BATTLE! shows a visible focus ring');
  await page.screenshot({ path: path.join(SHOTS, 'keys-g5-01-focus-battle.png') });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.boss-vs');
  await page.evaluate(qs => { questions = qs; qIdx = 0; }, mcqs(10));
  await page.keyboard.press('Enter');
  await page.waitForSelector('#boss-arena');
  await page.keyboard.press('a');
  await page.waitForTimeout(150);
  ok((await battle(page)).hp === 7, 'key A answers and zaps');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('b');
  await page.waitForTimeout(450);
  await page.keyboard.press('1');
  await page.waitForTimeout(150);
  ok((await battle(page)).hp === 6.5, 'wrong (B) then right (1): half zap');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('b');
  await page.waitForTimeout(450);
  await page.keyboard.press('c');
  await page.waitForTimeout(250);
  ok((await battle(page)).hearts === 2, 'two wrong keys: a heart lost');
  await page.screenshot({ path: path.join(SHOTS, 'keys-g5-02-arena.png') });
  await page.keyboard.press('Escape');
  await page.waitForSelector('#exit-modal-exit');
  await page.focus('#exit-modal-exit');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.boss-hubcard');
  ok((await battle(page)) === null && (await store(page, 'g5')).tired === 0, 'Esc → exit leaves the battle with nothing lost');
  ok(await tabTo('.boss-go', 60), 'Tab reaches BATTLE! again');
  await page.keyboard.press(' ');
  await page.waitForSelector('.boss-vs');
  ok(true, 'Space on BATTLE! opens the VS briefing');
  const reachedBack = await tabTo('.quiz-top .exit-btn', 10, true);
  ok(reachedBack, 'Shift+Tab reaches BACK on the briefing (focus: ' + await page.evaluate(() => { const e = document.activeElement; return e.tagName + '.' + e.className; }) + ')');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.boss-hubcard');
  ok((await battle(page)) === null, 'BACK from the briefing leaves no battle behind');
  ok(errors.length === 0, `keyboard: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// Phone width, reduced motion
async function runNarrow(browser, pid, vp, reduce) {
  vp = vp || { name: 'phone', width: 390, height: 844, touch: true };
  const tag = `${vp.name}-${pid}`;
  console.log(`\n▶ ${tag} (${vp.width}x${vp.height}${reduce ? ', reduced motion' : ''})`);
  const { ctx, page, errors } = await newPage(browser, vp, HTML, reduce ? { reducedMotion: 'reduce' } : {});
  const shot = name => page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) });
  ok(await page.evaluate(() => FUN.reducedMotion()) === !!reduce, 'reduced motion setting seen by FUN');
  await toHub(page, vp, pid);
  await page.waitForSelector('.boss-hubcard');
  await page.locator('.boss-hubcard').scrollIntoViewIfNeeded();
  await shot('01-hub');
  await layout(page, vp, pid, `${tag} hub`);
  await startBattle(page, vp, mcqs(10), async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('02-briefing');
    await layout(page, vp, pid, `${tag} briefing`);
  });
  await pickA(page, vp);
  await page.evaluate(() => { document.getElementById('app').scrollTop = 0; window.scrollTo(0, 0); });
  await shot('03-arena-hit');
  await layout(page, vp, pid, `${tag} arena`);
  await next(page, vp);
  await pickWrong(page, vp, 1); await page.waitForTimeout(450); await pickWrong(page, vp, 2);
  await page.waitForTimeout(200);
  await page.evaluate(() => { document.getElementById('app').scrollTop = 0; window.scrollTo(0, 0); });
  await shot('04-arena-miss');
  // Finish it: a victory card at phone width.
  await page.evaluate(() => { bossBattle.hp = 1; });
  await next(page, vp);
  await pickA(page, vp);
  await press(page, vp, page.locator('#fb .next-btn'));
  await page.waitForSelector('.boss-done');
  if (reduce) ok(await page.evaluate(() => document.querySelectorAll('.fun-confetti').length === 0), 'no confetti with reduced motion');
  await page.locator('.boss-done').scrollIntoViewIfNeeded();
  await shot('05-victory');
  await layout(page, vp, pid, `${tag} victory`);
  await press(page, vp, page.locator('.complete .next-btn', { hasText: 'BACK TO PACKS' }));
  await page.waitForSelector('.boss-hubcard');
  // An escape card at phone width.
  await startBattle(page, vp, mcqs(1));
  await pickWrong(page, vp, 1); await page.waitForTimeout(450); await pickWrong(page, vp, 2);
  await page.waitForTimeout(150);
  await press(page, vp, page.locator('#fb .next-btn'));
  await page.waitForSelector('.boss-done--escape');
  await page.locator('.boss-done').scrollIntoViewIfNeeded();
  await shot('06-escape');
  await layout(page, vp, pid, `${tag} escape`);
  ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// With the buddy and sticker modules loaded too
async function runTogether(browser) {
  const vp = { name: 'ipad', width: 820, height: 1180, touch: true };
  console.log('\n▶ with buddy + stickers (ipad, k)');
  const { ctx, page, errors } = await newPage(browser, vp, HTML_ALL);
  await page.evaluate(() => { const s = FUN.store('k', 'buddy'); s.type = 'dragon'; s.name = 'Ember'; saveState(); });
  await toHub(page, vp, 'k');
  await page.waitForSelector('.boss-hubcard');
  const order = await page.evaluate(() => [...document.querySelectorAll('.fun-zone > .fun-card')].map(c => c.className));
  const iB = order.findIndex(c => /buddy/.test(c)), iS = order.findIndex(c => /stk-/.test(c)), iX = order.findIndex(c => /boss-hubcard/.test(c));
  ok(iB >= 0 && iS > iB && iX > iS, 'play zone order: buddy, stickers, boss');
  await page.screenshot({ path: path.join(SHOTS, 'together-k-01-hub.png') });
  await layout(page, vp, 'k', 'together hub');
  await startBattle(page, vp, mcqs(10));
  ok(await page.locator('#boss-arena .boss-me-face .buddy-face').count() === 1, "the child's buddy stands in the arena");
  await pickA(page, vp);
  await page.screenshot({ path: path.join(SHOTS, 'together-k-02-arena-buddy.png') });
  await page.evaluate(() => { bossBattle.hp = 1; });
  await next(page, vp);
  await pickA(page, vp);
  await press(page, vp, page.locator('#fb .next-btn'));
  await page.waitForSelector('.boss-done');
  const c = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.complete .boss-done, .complete .buddy-done, .complete .stk-reveal')].map(e => e.className.split(' ')[0]);
    const tags = [...document.querySelectorAll('.stk-rcard-tag')].map(e => e.textContent);
    return { all, tags };
  });
  ok(c.all[0] === 'boss-done', 'boss card first on the complete screen: ' + c.all.join(','));
  ok(c.tags.some(t => /BOSS/i.test(t)), 'the sticker book awards a boss sticker: ' + c.tags.join(' | '));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, 'together-k-03-complete.png'), fullPage: true });
  await layout(page, vp, 'k', 'together complete');
  ok(errors.length === 0, `together: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: app.CHROMIUM });
  try {
    for (const vp of VIEWPORTS) for (const pid of ["k", "g5"]) await runFull(browser, vp, pid);
    await runKeyboard(browser);
    for (const pid of ['k', 'g5']) await runNarrow(browser, pid, null, true);
    await runNarrow(browser, 'k', { name: 'ipad-landscape', width: 1180, height: 820, touch: true }, false);
    if (haveOthers) await runTogether(browser);
    else console.log('\n(buddy/stickers modules absent — skipped the together pass)');
  } catch (e) {
    fails++; failList.push('crash: ' + (e && e.stack || e));
    console.log('CRASH', e && e.stack || e);
  } finally {
    await browser.close();
  }
  if (fails) console.log('\nfailures:\n' + failList.map(f => ' - ' + f).join('\n'));
  const skipped = haveOthers ? '' : '; skipped the together pass (no buddy or stickers module)';
  console.log(`\nboss: ${fails ? 'FAIL' : 'PASS'} — ${passes} checks passed, ${fails} failed${skipped}`);
  process.exit(fails ? 1 : 0);
})();
