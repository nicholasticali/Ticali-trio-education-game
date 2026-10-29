// Speed Sprints — end-to-end test.
//   node modules/sprint.test.js [app.html]
// On the game file (the repo's, $TT_APP, or the one named), with the sprint
// module and every other one built in (buddy, stickers, boss, missions,
// reading, family), clears localStorage, and checks:
//   facts      thousands of problems per child, each answer re-solved here
//              independently from the problem text; option count, uniqueness,
//              plausible distractors (fact neighbours, place value, the
//              "add a zero" slip), the answer's position, no repeats in a run,
//              the kindergartener's 40 facts used up exactly once
//   k and g5   on an iPad (820×1180, touch taps) and a 1440×900 laptop (mouse):
//              hub card, 3-2-1 countdown, timer bar, dot pictures and read-aloud
//              (k), right (tick, +1, combo) and wrong (buzz, right answer shown
//              ~600 ms, clock stopped, no other penalty), pause when the page
//              is hidden and RESUME, the pause button, TIME! and the results
//              (score, NEW BEST + confetti, XP = ceil(score × xpPer / 5) saved,
//              the problems to learn with their answers, Again / Back to hub,
//              the last-10 chart), sprintDone, a second (not best) sprint,
//              ⚡ LIGHTNING, ending early, leaving from the countdown, a closed
//              tab (pending XP credited), the screen replaced mid-sprint,
//              persistence across a reload, the parent dashboard, and a normal
//              round played start to finish
//   g3         4 answers, × and ÷ only, 60 s, a full sprint
//   keyboard   laptop, keys only: Tab/Enter/Space, 1-4 (1-3 for k), Esc
//   old saves  no module data at all, and broken module data
//   together   play-zone order, missions counting the sprint, the buddy's level-up
//   narrow     390 px with reduced motion; iPad landscape
//   critic     (fixes from the play-test review) a finished round's stale
//              currentPack never fires roundExit (the Reading Road stop used to
//              open over the sprint); a guess (wrong in < 0.6 s, g3/g5) keeps
//              the clock running so mashing is never faster than thinking; a
//              double tap on RESUME never answers; a damaged pending score is
//              never paid out; the kindergartener's gentle sounds; a 'streak'
//              fanfare every 5 in a row; fraction answers read as sentences;
//              phone-sized long answers; ink stars on the yellow banner/chip
// Fails on any page error, console error, module warning, horizontal overflow,
// a tap target under 44px (56px for the kindergartener, 72px for her answers).
// Presses that change the screen are spaced ≥ 420 ms apart. Screenshots go
// to tools/out/shots/sprint/.
const { chromium } = require('playwright');
const path = require('path');
const app = require('./app');

const HTML = app.APP;
// The suite is for the sprint module as the game file has it: without it, it fails.
if (!app.has('sprint')) { console.log('sprint: FAIL — the game file has no sprint module'); process.exit(1); }
const SHOTS = app.shots('sprint');
console.log('app: ' + HTML);

let passes = 0, fails = 0;
const failList = [];
function ok(cond, msg) {
  if (cond) passes++;
  else { fails++; failList.push(msg); console.log('    FAIL ' + msg); }
}
const UNSAFE = /\b(kill|kills|killed|die|dies|dead|death|blood|stupid|dumb|loser|lost|fail|failed|failure|shame|missed|wrong!)\b/i;
const XPPER = { k: 5, g3: 10, g5: 15 };
const SECS = { k: 90, g3: 60, g5: 60 };
const NCH = { k: 3, g3: 4, g5: 4 };
const LIGHT = { k: 12, g3: 20, g5: 20 };
const VPS = {
  ipad:   { name: 'ipad', width: 820, height: 1180, touch: true },
  laptop: { name: 'laptop', width: 1440, height: 900, touch: false },
  phone:  { name: 'phone', width: 390, height: 844, touch: true },
  land:   { name: 'ipad-landscape', width: 1180, height: 820, touch: true },
};

// ─── Exact arithmetic, independent of the module ───
// A decimal string ("3,600", "0.045") → [BigInt numerator, power of ten].
function dec(s) {
  s = String(s).replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('not a number: ' + s);
  const [i, f = ''] = s.split('.');
  return { n: BigInt(i + f), p: f.length };
}
function same(a, b) {   // equal values
  const p = Math.max(a.p, b.p);
  return a.n * 10n ** BigInt(p - a.p) === b.n * 10n ** BigInt(p - b.p);
}
function valKey(s) { const d = dec(s); let n = d.n, p = d.p; while (p > 0 && n % 10n === 0n) { n /= 10n; p--; } return n + '/' + p; }
// Solve a problem from its text alone.
function solve(text) {
  let m;
  if ((m = /^(\d) ([+−]) (\d)$/.exec(text))) {
    const a = +m[1], b = +m[3];
    return { kind: m[2] === '+' ? 'add' : 'sub', a, b, ans: dec(String(m[2] === '+' ? a + b : a - b)) };
  }
  if ((m = /^(\d+)\/(\d+) = (\?|\d+)\/(\?|\d+)$/.exec(text))) {
    const [a, b] = [BigInt(m[1]), BigInt(m[2])];
    if (m[3] === '?') { const d = BigInt(m[4]); if ((a * d) % b) return null; return { kind: 'frac', ans: { n: a * d / b, p: 0 } }; }
    const c = BigInt(m[3]); if ((b * c) % a) return null; return { kind: 'frac', ans: { n: b * c / a, p: 0 } };
  }
  if ((m = /^([\d,.]+) ([×÷]) ([\d,.]+)$/.exec(text))) {
    const x = dec(m[1]), y = dec(m[3]);
    if (m[2] === '×') return { kind: 'x', x: m[1], y: m[3], ans: { n: x.n * y.n, p: x.p + y.p } };
    // x ÷ y exactly: scale until it divides
    for (let extra = 0; extra < 8; extra++) {
      const num = x.n * 10n ** BigInt(y.p + extra), den = y.n * 10n ** BigInt(x.p);
      if (num % den === 0n) return { kind: '÷', x: m[1], y: m[3], ans: { n: num / den, p: extra } };
    }
    return null;
  }
  return null;
}

// ─── Page helpers ───
async function newPage(browser, vp, extra) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, deviceScaleFactor: 1 }, extra || {}));
  ctx.setDefaultTimeout(15000);
  await ctx.addInitScript(require('./together').quietBuddy);   // every module built in: see together.js
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
    if (m.type() === 'warning' && /\[fun\]/.test(m.text())) errors.push('module threw: ' + m.text());
  });
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });
  await page.goto('file://' + HTML);
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
    window.__levelUps = [];
    window.__exits = 0;
    FUN.on('roundExit', () => { window.__exits++; });
    FUN.on('sprintDone', e => window.__events.push(JSON.parse(JSON.stringify(e))));
    FUN.on('levelUp', e => window.__levelUps.push(e));
  });
}
async function press(page, vp, loc, gap) {
  await loc.first().scrollIntoViewIfNeeded();
  if (vp.touch) await loc.first().tap(); else await loc.first().click();
  await page.waitForTimeout(gap == null ? 450 : gap);
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
    const transient = el => el.closest('.fun-confetti, .fun-toast, .trophy-pop, .xp-pop, .streak-pop, .sprint-plus');
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
      const mine = !!el.closest('.sprint-scope') || /\bsprint-/.test(String(el.className));
      small.push({ d: desc(el), w: b.width, h: b.height, mine, ans: el.classList.contains('sprint-ans') });
    }
    const app = document.getElementById('app');
    return { over, small, docOver: document.documentElement.scrollWidth > W + 1, appOver: app.scrollWidth > app.clientWidth + 1 };
  });
  ok(!r.docOver && !r.appOver, `${label}: page scrolls horizontally`);
  ok(r.over.length === 0, `${label}: elements overflow the viewport: ${r.over.slice(0, 4).join(' | ')}`);
  const floor = pid === 'k' ? 55.5 : 43.5;
  const mineSmall = r.small.filter(s => s.mine && (s.w < floor || s.h < floor));
  ok(mineSmall.length === 0, `${label}: sprint tap targets under ${Math.round(floor)}px: ${mineSmall.map(s => `${s.d} ${Math.round(s.w)}x${Math.round(s.h)}`).join(' | ')}`);
  if (pid === 'k') {
    const ansSmall = r.small.filter(s => s.ans && (s.w < 72 || s.h < 72));
    ok(ansSmall.length === 0, `${label}: kindergarten answer buttons under 72px: ${ansSmall.map(s => `${Math.round(s.w)}x${Math.round(s.h)}`).join(' | ')}`);
  }
  const appSmall = r.small.filter(s => !s.mine && (s.w < 43.5 || s.h < 43.5));
  if (appSmall.length) console.log(`    note (${label}, app's own controls under 44px, not this module): ${appSmall.slice(0, 3).map(s => `${s.d} ${Math.round(s.w)}x${Math.round(s.h)}`).join(' | ')}`);
  return r;
}
function checkSafe(label, text) {
  const m = String(text || '').match(UNSAFE);
  ok(!m, `${label}: unkind word "${m && m[0]}" in: ${String(text).slice(0, 90)}`);
}

const store = (page, pid) => page.evaluate(pid => JSON.parse(JSON.stringify((state.profiles[pid].fun || {}).sprint || null)), pid);
const xpOf = (page, pid) => page.evaluate(pid => state.profiles[pid].xp, pid);
const sounds = page => page.evaluate(() => window.__sounds.slice());
const clearSounds = page => page.evaluate(() => { window.__sounds.length = 0; });
const events = page => page.evaluate(() => window.__events.slice());
const spoken = page => page.evaluate(() => window.__spoken.slice());
const runInfo = page => page.evaluate(() => {
  const r = sprintRun;
  if (!r) return null;
  const p = r.p;
  return { phase: r.phase, score: r.score, combo: r.combo, tries: r.tries, left: sprintLeft(r), total: r.total, clockOn: r.clockOn,
           key: p && p.key, kind: p && p.kind, text: p && p.text, say: p && p.say, a: p && p.a, b: p && p.b,
           correct: p && p.correct, n: p && p.opts.length, opts: p && p.opts.map(o => o.s), ans: p && p.opts[p.correct].s };
});

async function toHub(page, vp, pid) {
  await press(page, vp, page.locator(`.profile-card[onclick*="'${pid}'"]`));
  await page.waitForSelector('.hub .sprint-hubcard');
}
async function startSprint(page, vp, fast) {
  if (fast) await page.evaluate(() => { SPRINT_CFG.countStep = 120; });
  await press(page, vp, page.locator('.sprint-hubcard .sprint-go'), 120);
  await page.waitForSelector('.sprint-screen');
  await page.waitForFunction(() => sprintRun && sprintRun.phase === 'run', null, { timeout: 8000 });
}
// Right after GO! or RESUME a tap on an answer is taken for the second tap
// of a double tap and held back for SPRINT_CFG.settleMs; a child cannot read
// a problem that fast anyway. Taps in the tests wait it out.
const settle = page => page.waitForFunction(() => !sprintRun || performance.now() >= sprintRun.settleUntil + 20);
// Close a sticker reveal (or any overlay another module opened) so taps reach the page.
const closeOverlays = page => page.evaluate(() => { if (document.getElementById('stk-overlay') && typeof stickersCloseOverlay === 'function') stickersCloseOverlay(); });
// Answer the problem on screen, right or wrong, then wait for the next one.
async function answer(page, vp, right, via) {
  if (via !== 'key') await settle(page);
  const st = await runInfo(page);
  const i = right ? st.correct : (st.correct + 1) % st.n;
  const t0 = Date.now();
  if (via === 'key') await page.keyboard.press(String(i + 1));
  else {
    const b = page.locator('#sprint-answers .sprint-ans').nth(i);
    if (vp.touch) await b.tap(); else await b.click();
  }
  await page.waitForFunction(k => !sprintRun || ['over', 'paused'].includes(sprintRun.phase) || (sprintRun.phase === 'run' && sprintRun.p.key !== k), st.key, { timeout: 6000 });
  const spent = Date.now() - t0;
  if (spent < 430) await page.waitForTimeout(430 - spent);   // presses ≥ 420 ms apart
  return Object.assign(st, { picked: i });
}
// Run the clock out now.
async function timeUp(page) {
  await page.waitForFunction(() => sprintRun && sprintRun.phase === 'run');
  await page.evaluate(() => { sprintRun.endAt = performance.now() + 120; });
  await page.waitForSelector('.sprint-stamp', { timeout: 5000 });
}
async function endInfo(page) {
  return page.evaluate(() => {
    const e = document.querySelector('.sprint-end');
    if (!e) return null;
    const t = sel => { const x = e.querySelector(sel); return x ? x.innerText.replace(/\s+/g, ' ').trim() : ''; };
    return {
      kicker: t('.sprint-end-kicker'), num: t('.sprint-end-num'), banner: t('.sprint-end-banner'), line: t('.sprint-end-line'),
      chips: t('.sprint-end-chips'), bars: [...e.querySelectorAll('.sprint-chart-col')].map(c => ({ v: c.querySelector('.sprint-chart-v').innerText.replace('⭐', ''), now: c.classList.contains('is-now'), best: c.classList.contains('is-best') })),
      learn: [...e.querySelectorAll('.sprint-learn-item')].map(li => ({ eq: li.querySelector('.sprint-eq').innerText.replace(/\s+/g, ' ').trim(), filled: (li.querySelector('.sprint-q.is-filled') || {}).innerText, dots: li.querySelectorAll('.sprint-dot').length, say: !!li.querySelector('.js-speak') })),
      clean: !!e.querySelector('.sprint-learn--clean'), again: !!e.querySelector('button.sprint-again'), home: !!e.querySelector('button.sprint-home'),
      say: (e.querySelector('.sprint-end-say .js-speak') || { getAttribute: () => '' }).getAttribute('data-speak-text'),
      ownKeys: e.hasAttribute('data-own-keys'), text: e.innerText,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// 1. The facts, without any UI
// ═══════════════════════════════════════════════════════════════
async function factChecks(browser) {
  console.log('\n▶ facts');
  const { ctx, page, errors } = await newPage(browser, VPS.laptop);
  const cfg = await page.evaluate(() => JSON.parse(JSON.stringify(SPRINT_CFG)));
  ok(cfg.secs.k === 90 && cfg.secs.g3 === 60 && cfg.secs.g5 === 60, 'sprint lengths: 90 s kindergarten, 60 s for 3rd and 5th');
  ok(cfg.choices.k === 3 && cfg.choices.g3 === 4 && cfg.choices.g5 === 4, 'answers: 3 for kindergarten, 4 for 3rd and 5th');
  ok(cfg.wrongMs >= 500 && cfg.wrongMs <= 700, 'the right answer shows for about 600 ms after a miss: ' + cfg.wrongMs);
  for (const pid of ['k', 'g3', 'g5']) {
    const N = 4000;
    const probs = await page.evaluate(([pid, N]) => {
      const out = [];
      for (let i = 0; i < N; i++) {
        const p = sprintGen(pid);
        out.push({ kind: p.kind, text: p.text, say: p.say, opts: p.opts.map(o => o.s), correct: p.correct, verified: sprintVerify(p, pid), a: p.a, b: p.b });
      }
      return out;
    }, [pid, N]);
    let bad = [], kinds = {}, pos = Array(NCH[pid]).fill(0), plausible = 0, multCount = 0, p10 = 0, p10plaus = 0, fracCount = 0, fracSlip = 0, zeroCount = 0;
    for (const p of probs) {
      kinds[p.kind] = (kinds[p.kind] || 0) + 1;
      const s = solve(p.text);
      if (!s) { bad.push('unsolvable ' + p.text); continue; }
      const vals = p.opts.map(o => { try { return dec(o); } catch (e) { return null; } });
      if (vals.some(v => !v)) { bad.push('bad option ' + p.text + ' ' + p.opts); continue; }
      const hits = vals.map((v, i) => same(v, s.ans) ? i : -1).filter(i => i >= 0);
      if (hits.length !== 1 || hits[0] !== p.correct) bad.push(`answer ${p.text} → [${p.opts}] marked ${p.correct}`);
      if (new Set(vals.map(v => valKey(p.opts[vals.indexOf(v)]))).size !== vals.length) bad.push('duplicate values ' + p.text + ' ' + p.opts);
      if (p.opts.length !== NCH[pid]) bad.push('option count ' + p.text);
      if (!p.verified) bad.push('module could not verify ' + p.text);
      if (vals.some(v => v.p > 3)) bad.push('more than thousandths ' + p.text + ' ' + p.opts);
      pos[p.correct]++;
      if (pid === 'k') {
        const nums = p.opts.map(Number), ans = Number(s.ans.n);
        if (!(s.a <= 5 && s.b <= 5 && (s.kind === 'add' ? s.a + s.b <= 5 && s.a + s.b > 0 : s.b <= s.a))) bad.push('not within 5: ' + p.text);
        if (nums.some((v, i) => i && v <= nums[i - 1])) bad.push('k options not in counting order: ' + p.opts);
        if (nums.some(v => v < 0 || v > 7 || Math.abs(v - ans) > 3)) bad.push('k option out of range: ' + p.text + ' ' + p.opts);
        if (!new RegExp(`^${s.a} (plus|take away) ${s.b}$`).test(p.say) || (s.kind === 'sub') !== /take away/.test(p.say)) bad.push('k spoken form: ' + p.say);
        if (s.a === 0 || s.b === 0) zeroCount++;
      } else if (s.kind === 'x' || s.kind === '÷') {
        if (p.kind === 'mul' || p.kind === 'div') {
          const a = s.kind === 'x' ? +s.x : +s.x / +s.y, b = +s.y;
          const lo = pid === 'g3' ? 0 : 2, hi = pid === 'g3' ? 10 : 12;
          if (!(a >= lo && a <= hi && b >= Math.max(lo, s.kind === '÷' ? 1 : lo) && b <= hi)) bad.push(`fact out of range for ${pid}: ${p.text}`);
          if (s.kind === 'x') {
            multCount++;
            const x = +s.x, y = +s.y, P = x * y;
            const nb = new Set([x * (y + 1), x * (y - 1), (x + 1) * y, (x - 1) * y].filter(v => v !== P && v >= 0));
            if (P === 0 || p.opts.some((o, i) => i !== p.correct && nb.has(Number(o)))) plausible++;
          }
        } else if (p.kind === 'p10') {
          p10++;
          // decimals are read by place value ("4 and 7 tenths"), never "four point seven"
          if (/\./.test(p.text) && (!/(tenth|hundredth|thousandth)s?\b/.test(p.say) || /\d\.\d/.test(p.say))) bad.push('decimal not read by place value: ' + p.text + ' → ' + p.say);
          // every distractor is the answer with its digits in the wrong place,
          // or the number itself with zeros tacked on ("4.7 × 10 = 4.70")
          const ans = s.ans, okD = p.opts.every((o, i) => {
            if (i === p.correct) return true;
            const v = dec(o);
            for (let j = -4; j <= 4; j++) {
              if (!j) continue;
              const shifted = j > 0 ? { n: ans.n * 10n ** BigInt(j), p: ans.p } : { n: ans.n, p: ans.p - j };
              if (same(v, shifted)) return true;
            }
            return /\.\d*0$/.test(o) && same(v, dec(s.x));
          });
          if (okD) p10plaus++;
        } else bad.push('unexpected kind ' + p.kind);
      } else if (s.kind === 'frac') {
        fracCount++;
        if (p.opts.some(o => !/^\d+$/.test(o) || +o <= 0)) bad.push('fraction option not a positive whole number: ' + p.text + ' ' + p.opts);
        const m = /^(\d+)\/(\d+) = (\?|\d+)\/(\?|\d+)$/.exec(p.text);
        const slip = m[3] === '?' ? +m[1] + (+m[4] - +m[2]) : +m[2] + (+m[3] - +m[1]);
        if (p.opts.some((o, i) => i !== p.correct && +o === slip)) fracSlip++;
      }
    }
    ok(bad.length === 0, `${pid}: every problem re-solved and its options checked (${probs.length}): ${bad.slice(0, 5).join(' | ')}`);
    const K = Object.keys(kinds).sort().join(',');
    const want = { k: 'add,sub', g3: 'div,mul', g5: 'div,frac,mul,p10' }[pid];
    ok(K === want, `${pid}: problem kinds ${K} (want ${want})`);
    const share = pos.map(n => n / probs.length);
    ok(share.every(x => x > (pid === 'k' ? 0.2 : 0.15) && x < (pid === 'k' ? 0.48 : 0.36)), `${pid}: the right answer lands in every position: ${share.map(x => x.toFixed(2))}`);
    if (pid === 'k') ok(zeroCount / probs.length < 0.3, `k: facts with a zero are rarer (${(zeroCount / probs.length).toFixed(2)})`);
    if (multCount) ok(plausible / multCount > 0.97, `${pid}: × distractors include a neighbouring fact (${plausible}/${multCount})`);
    if (p10) ok(p10plaus === p10, `g5: every powers-of-10 distractor is a place-value slip (${p10plaus}/${p10})`);
    if (fracCount) ok(fracSlip / fracCount > 0.5, `g5: equivalent-fraction distractors include the "add the same number" slip (${fracSlip}/${fracCount})`);
    if (pid === 'g5') ok(kinds.p10 > 600 && kinds.frac > 300 && kinds.mul > 600 && kinds.div > 600, `g5: a real mix ${JSON.stringify(kinds)}`);

    // Runs: never the same problem twice, never the same fact family twice in a row.
    const runs = await page.evaluate(pid => {
      const res = [];
      for (let t = 0; t < 12; t++) {
        const r = { pid, used: new Set(), lastFam: '' };
        const keys = [], fams = [], texts = [];
        let p;
        while ((p = sprintNextProblem(r)) && keys.length < 150) { keys.push(p.key); fams.push(p.fam); texts.push(p.text); r.used.add(p.key); r.lastFam = p.fam; }
        res.push({ keys, fams, texts, ended: !p });
      }
      return res;
    }, pid);
    const norm = x => x.replace(/^(\S+) × (\S+)$/, (m, a, b) => [a, b].sort().join(' × '));
    ok(runs.every(r => new Set(r.keys).size === r.keys.length && new Set(r.texts.map(norm)).size === r.texts.length), `${pid}: no problem twice in a run (3 × 4 and 4 × 3 count as one)`);
    const famRepeats = runs.reduce((n, r) => n + r.fams.filter((f, i) => i && f === r.fams[i - 1]).length, 0);
    ok(famRepeats <= (pid === 'k' ? 6 : 0), `${pid}: the same fact family is not shown twice in a row (${famRepeats})`);
    if (pid === 'k') {
      ok(runs.every(r => r.ended && r.keys.length === 40), 'k: all 40 kindergarten facts, each once, then the run is done: ' + runs.map(r => r.keys.length).join(','));
      const allK = await page.evaluate(() => sprintAllK().length);
      ok(allK === 40, 'k: 20 add-within-5 facts and 20 take-away-within-5 facts');
    } else ok(runs.every(r => r.keys.length === 150), `${pid}: 150 different problems in a run and more to come`);
  }
  // Exact decimals: no floating-point leftovers anywhere.
  const fmt = await page.evaluate(() => [sprintFmt(sprintV(36, -3)), sprintFmt(sprintV(47, 2)), sprintFmt(sprintV(1256)), sprintFmt(sprintV(3, -1)), sprintFmt(sprintShift(sprintV(7, -1), -2))]);
  ok(fmt.join('|') === '0.036|4,700|1,256|0.3|0.007', 'decimals and thousands are written the usual way: ' + fmt.join('|'));
  const said = await page.evaluate(() => ['4.7', '0.036', '12.05', '4.70', '0.1', '3,700'].map(sprintSayStr));
  ok(said.join('|') === '4 and 7 tenths|36 thousandths|12 and 5 hundredths|4 and 70 hundredths|1 tenth|3,700', 'decimals said by place value: ' + said.join('|'));
  // A problem said with its answer, as a sentence (the 🔊 on the results)
  const sent = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 400; i++) { const p = sprintFrac(); out.push({ s: sprintSayAnswer(p, false), L: p.L, R: p.R, miss: p.miss, a: +p.opts[p.correct].s }); }
    const m = sprintMul('g5', 7, 8), pk = sprintMakeK(false, 4, 1);
    const pp = sprintP10();
    return { fr: out, mul: sprintSayAnswer(m, false), k: sprintSayAnswer(pk, true), p10: sprintSayAnswer(pp, false), p10a: pp.opts[pp.correct].s };
  });
  const badSent = sent.fr.filter(x => { const R = x.R.slice(); R[x.miss] = x.a; const m = /^(\d+) (\S+) equals (\d+) (\S+)$/.exec(x.s); return !m || +m[1] !== x.L[0] || +m[3] !== R[0] || /\?/.test(x.s); });
  ok(badSent.length === 0 && sent.mul === '7 times 8 equals 56' && sent.k === '4 take away 1 is 3' && !/\?/.test(sent.p10), 'answers said as sentences: ' + [sent.fr[0].s, sent.mul, sent.k, sent.p10].join(' | ') + (badSent.length ? ' BAD: ' + badSent.slice(0, 3).map(x => x.s).join(' | ') : ''));
  const ord = await page.evaluate(() => [2, 3, 4, 12, 20, 24, 36, 40, 48, 60].map(d => sprintOrd(d, true)).join(','));
  ok(ord === 'halves,thirds,fourths,twelfths,twentieths,twenty-fourths,thirty-sixths,fortieths,forty-eighths,sixtieths', 'fraction names: ' + ord);
  // The chart: a small score next to a big best still shows a coloured bar
  const minBar = await page.evaluate(() => Math.min(...[...sprintChartHtml([88, 3], 88, 1).matchAll(/height:(\d+)%/g)].map(m => +m[1])));
  ok(minBar >= 9, 'chart: the smallest bar is tall enough to show its colour (not just its border): ' + minBar + '%');
  const zeroBar = await page.evaluate(() => +/height:(\d+)%/.exec(sprintChartHtml([0], 0, 0))[1]);
  ok(zeroBar < 9, 'chart: a 0 is a stub, not a bar that looks like points: ' + zeroBar + '%');
  ok(await page.evaluate(() => SPRINT_MAX) <= 300, 'a stored score over 300 is damage (no 60-second sprint gets near it)');
  ok(errors.length === 0, 'facts: page errors: ' + errors.join(' | '));
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// 2. k and g5 on the iPad and the laptop
// ═══════════════════════════════════════════════════════════════
async function runFull(browser, vp, pid) {
  const tag = `${vp.name}-${pid}`;
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp);
  const shot = name => page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) });
  const isK = pid === 'k';
  ok(await page.evaluate(pid => state.profiles[pid].autoRead, pid) === isK, `autoRead is ${isK ? 'on' : 'off'} by default for ${pid}`);
  ok(await page.evaluate(() => { try { const cp = currentProfile; currentProfile = null; sprintStart(); currentProfile = cp; return !document.querySelector('.sprint-screen'); } catch (e) { return false; } }), 'sprintStart() with nobody signed in does nothing');

  // ── Hub card ──
  await toHub(page, vp, pid);
  const hub = await page.evaluate(() => {
    const c = document.querySelector('.sprint-hubcard');
    const zone = [...document.querySelectorAll('.fun-zone > .fun-card')];
    return { inZone: !!c.closest('.fun-zone'), idx: zone.indexOf(c), n: zone.length, bossIdx: zone.findIndex(x => x.classList.contains('boss-hubcard')),
      after: zone.slice(zone.indexOf(c) + 1).map(x => x.className),
      title: c.querySelector('.fun-card-title').innerText, icon: c.querySelector('.fun-card-icon').innerText, text: c.innerText,
      badge: c.querySelector('.fun-card-badge').innerText, go: !!c.querySelector('button.sprint-go'), say: !!c.querySelector('.js-speak') };
  });
  // Only the family goal (order 60) may come after it, when that module is built in.
  ok(hub.inZone && hub.after.every(c => /family-card/.test(c)), `the sprint card is in the play zone, after everything but the family goal (order 50): ${hub.idx}/${hub.n}`);
  ok(hub.bossIdx >= 0 && hub.bossIdx < hub.idx, 'after the boss card (order 40)');
  ok(hub.title === 'SPEED SPRINT' && hub.icon === '⚡' && /Best:/.test(hub.text) && hub.badge === 'NEW', `hub card: ⚡ SPEED SPRINT, Best:, NEW (${hub.title} ${hub.badge})`);
  ok(new RegExp(isK ? 'Quick Count' : 'Mixed Facts').test(hub.text) && new RegExp(`${SECS[pid]} sec`).test(hub.text), 'hub card names the set and its length');
  ok(hub.go && hub.say === isK, `SPRINT! button; read-aloud ${isK ? 'for' : 'not for'} this child`);
  checkSafe('hub card', hub.text);
  await page.locator('.sprint-hubcard').scrollIntoViewIfNeeded();
  await shot('01-hub');
  await page.locator('.sprint-hubcard').screenshot({ path: path.join(SHOTS, `${tag}-01b-hubcard.png`) });
  await layout(page, vp, pid, `${tag} hub`);
  if (isK) {
    await press(page, vp, page.locator('.sprint-hubcard .js-speak'));
    const said = (await spoken(page)).join(' ');
    ok(/Speed sprint/.test(said) && /90 seconds/.test(said) && /SPRINT/.test(said), 'hub 🔊 explains the sprint: ' + said.slice(0, 80));
  }

  // ── Sprint 1: countdown (real timing), right, wrong, combo, pause, TIME! ──
  await page.evaluate(() => { window.__spoken.length = 0; });
  const xp0 = await xpOf(page, pid);
  await clearSounds(page);
  await press(page, vp, page.locator('.sprint-hubcard .sprint-go'), 150);
  await page.waitForSelector('.sprint-screen');
  const c1 = await page.evaluate(() => ({
    phase: document.querySelector('.sprint-screen').getAttribute('data-phase'), own: document.querySelector('.sprint-screen').hasAttribute('data-own-keys'),
    count: (document.querySelector('.sprint-count') || {}).innerText, covered: getComputedStyle(document.getElementById('sprint-card')).visibility,
    secs: document.getElementById('sprint-secs').innerText, best: document.querySelector('.sprint-best').innerText, ov: document.querySelector('.sprint-ov--count') && document.querySelector('.sprint-ov--count').innerText }));
  ok(c1.phase === 'count' && c1.own && c1.count === '3', `countdown starts at 3 on a screen with its own keys (${c1.phase} ${c1.count})`);
  ok(c1.covered === 'hidden', 'nothing to answer during the countdown');
  ok(c1.secs === String(SECS[pid]), `timer reads ${SECS[pid]} before the start: ${c1.secs}`);
  checkSafe('countdown', c1.ov);
  ok(isK ? !/Guess/.test(c1.ov) : /Guesses cost time/.test(c1.ov), isK ? 'K: no guess rule, nothing said about it' : 'the countdown says up front that guesses cost time (the rule is never hidden): ' + (c1.ov || '').replace(/\s+/g, ' '));
  await shot('02-countdown');
  await layout(page, vp, pid, `${tag} countdown`);
  await page.keyboard.press('1');   // a key during the countdown does nothing
  const seen = [];
  for (let i = 0; i < 40 && seen.length < 4; i++) {
    const t = await page.evaluate(() => { const c = document.querySelector('.sprint-count'); return c ? c.innerText : (sprintRun && sprintRun.phase); });
    if (t && t !== seen[seen.length - 1] && ['3', '2', '1', 'GO!'].includes(t)) seen.push(t);
    await page.waitForTimeout(100);
  }
  ok(seen.join(' ') === '3 2 1 GO!', 'countdown 3 · 2 · 1 · GO!: ' + seen.join(' '));
  await page.waitForFunction(() => sprintRun && sprintRun.phase === 'run', null, { timeout: 5000 });
  let r = await runInfo(page);
  ok(r.score === 0 && r.tries === 0, 'the key pressed during the countdown answered nothing');
  ok(r.total === SECS[pid] * 1000 && r.left > (SECS[pid] - 2) * 1000 && r.clockOn, `the clock runs: ${Math.round(r.left)} ms of ${r.total}`);
  const snd = await sounds(page);
  ok(snd.filter(s => s === 'tick').length >= 3 && snd.includes('right'), 'countdown ticks, GO chimes: ' + snd.join(','));
  if (isK) ok((await spoken(page)).some(t => /Ready\? 3/.test(t)), 'K: the countdown is read aloud');
  const ui = await page.evaluate(() => ({
    btns: document.querySelectorAll('#sprint-answers .sprint-ans').length,
    vals: [...document.querySelectorAll('#sprint-answers .sprint-ans-val')].map(x => x.innerText),
    eq: document.querySelector('#sprint-card .sprint-eq').innerText.replace(/\s+/g, ' '),
    dotsA: document.querySelectorAll('#sprint-card .sprint-dot.is-a:not(.is-gone)').length, dotsB: document.querySelectorAll('#sprint-card .sprint-dot.is-b').length,
    gone: document.querySelectorAll('#sprint-card .sprint-dot.is-gone').length, voice: !!document.querySelector('#sprint-card .js-speak'),
    voiceText: (document.querySelector('#sprint-card .js-speak') || { getAttribute: () => '' }).getAttribute('data-speak-text'),
    fill: !!document.getElementById('sprint-fill'), bottom: document.getElementById('sprint-answers').getBoundingClientRect().bottom, vh: innerHeight,
    sizes: [...new Set([...document.querySelectorAll('#sprint-answers .sprint-ans')].map(b => getComputedStyle(b).fontSize))] }));
  ok(ui.btns === NCH[pid] && ui.vals.join('|') === r.opts.join('|'), `${NCH[pid]} answer buttons showing the options: ${ui.vals.join(' ')}`);
  ok(ui.sizes.length === 1, 'every answer in a set is the same size (no number stands out): ' + ui.sizes.join(','));
  ok(ui.fill, 'a timer bar');
  ok(ui.bottom <= ui.vh, `answers fit on screen without scrolling (${Math.round(ui.bottom)} ≤ ${ui.vh})`);
  if (isK) {
    ok(r.kind === 'add' ? ui.dotsA === r.a && ui.dotsB === r.b && ui.gone === 0 : ui.dotsA === r.a - r.b && ui.gone === r.b,
      `K: the dot picture matches ${r.text} (${ui.dotsA} + ${ui.dotsB}, ${ui.gone} crossed out)`);
    ok(ui.voice && ui.voiceText.startsWith(r.say) && /Is it/.test(ui.voiceText), 'K: a 🔊 on the problem reads it and the choices: ' + ui.voiceText);
    ok((await spoken(page)).includes(r.say), `K: the problem is read aloud (autoRead): "${r.say}"`);
    ok(/^\d (plus|take away) \d$/.test(r.say), 'K says "plus" and "take away": ' + r.say);
    const dotCol = await page.evaluate(() => { const d = document.createElement('i'); d.className = 'sprint-dot is-b'; document.getElementById('sprint-card').appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove();
      const t = document.createElement('i'); t.style.background = 'var(--success)'; document.body.appendChild(t); const s = getComputedStyle(t).backgroundColor; t.remove(); return { c, s }; });
    ok(dotCol.c !== dotCol.s, `K: the second group of dots is not the "right answer" teal (${dotCol.c} vs ${dotCol.s})`);
  } else {
    ok(!ui.voice && !(await spoken(page)).length, 'g5 (autoRead off): no 🔊 on the problem and nothing read');
  }
  await page.waitForTimeout(250);   // the problem slides in
  await shot('03-run');
  await layout(page, vp, pid, `${tag} run`);

  // Right → tick, +1, the button and the ? light up
  await clearSounds(page);
  await settle(page);
  r = await runInfo(page);
  const btn = page.locator('#sprint-answers .sprint-ans').nth(r.correct);
  if (vp.touch) await btn.tap(); else await btn.click();
  const fx = await page.evaluate(() => ({ phase: sprintRun.phase, right: !!document.querySelector('.sprint-ans.is-right'), q: (document.querySelector('#sprint-card .sprint-q.is-filled') || {}).innerText,
    score: document.getElementById('sprint-score').innerText, plus: !!document.querySelector('.sprint-plus'), pending: JSON.parse(JSON.stringify(state.profiles[sprintRun.pid].fun.sprint.pending || null)) }));
  ok(fx.phase === 'reveal' && fx.right && fx.q === r.ans && fx.score === '1' && fx.plus, `right answer: green, the answer fills the ?, score 1 with a +1 (${fx.q}, ${fx.score})`);
  ok((await sounds(page)).includes(isK ? 'right' : 'tick'), `right answer plays funSound('${isK ? 'right' : 'tick'}')${isK ? ' (the chime she knows from rounds, not a faint tick)' : ''}`);
  ok(fx.pending && fx.pending.score === 1, 'the score so far is kept in case the tab closes');
  await shot('04-right');
  await page.waitForFunction(k => sprintRun.phase === 'run' && sprintRun.p.key !== k, r.key);
  await page.waitForTimeout(350);
  await answer(page, vp, true);
  await answer(page, vp, true);
  r = await runInfo(page);
  const combo = await page.evaluate(() => ({ on: document.getElementById('sprint-combo').classList.contains('is-on'), text: document.getElementById('sprint-combo').innerText }));
  ok(r.score === 3 && r.combo === 3 && combo.on && /3/.test(combo.text), `3 in a row shows the combo counter: ${combo.text.replace(/\s+/g, ' ')}`);
  await shot('05-combo');

  // Wrong → buzz, the right answer shows ~600 ms with the clock stopped, nothing else
  // (a wrong answer the child thought about: not a guess)
  await page.waitForFunction(ms => performance.now() - sprintRun.shownAt > ms + 120, await page.evaluate(() => SPRINT_CFG.guessMs));
  await clearSounds(page);
  r = await runInfo(page);
  const wrongI = (r.correct + 1) % r.n;
  const wb = page.locator('#sprint-answers .sprint-ans').nth(wrongI);
  const tW = Date.now();
  if (vp.touch) await wb.tap(); else await wb.click();
  const w1 = await page.evaluate(() => ({ phase: sprintRun.phase, left: sprintLeft(sprintRun), clockOn: sprintRun.clockOn,
    wrong: [...document.querySelectorAll('.sprint-ans')].findIndex(b => b.classList.contains('is-wrong')),
    right: [...document.querySelectorAll('.sprint-ans')].findIndex(b => b.classList.contains('is-answer')),
    q: (document.querySelector('#sprint-card .sprint-q.is-filled') || {}).innerText, score: sprintRun.score, combo: document.getElementById('sprint-combo').classList.contains('is-on'),
    ansBg: getComputedStyle(document.querySelector('.sprint-ans.is-answer')).backgroundColor, ansFg: getComputedStyle(document.querySelector('.sprint-ans.is-answer')).color }));
  ok(w1.phase === 'reveal' && w1.wrong === wrongI && w1.right === r.correct && w1.q === r.ans, `wrong answer: the right one (${r.ans}) shows`);
  ok(w1.ansBg !== w1.ansFg && !/255, 255, 255/.test(w1.ansBg), `the right answer is readable at once, not fading in white on white (${w1.ansBg} / ${w1.ansFg})`);
  ok((await sounds(page)).includes(isK ? 'wrong' : 'buzz') && (!isK || !(await sounds(page)).includes('buzz')), `wrong answer plays funSound('${isK ? 'wrong' : 'buzz'}')${isK ? ', the gentle one, never the buzzer' : ''}`);
  ok(w1.score === 3 && !w1.combo, 'no penalty: the score stays 3; the combo counter just goes away');
  await shot('06-wrong');
  await page.waitForTimeout(250);
  const w2 = await page.evaluate(() => ({ phase: sprintRun.phase, left: sprintLeft(sprintRun) }));
  ok(w2.phase === 'reveal' && Math.abs(w2.left - w1.left) < 5 && !w1.clockOn, `the clock waits while the right answer shows (${Math.round(w1.left)} → ${Math.round(w2.left)})`);
  await page.waitForFunction(k => sprintRun.phase === 'run' && sprintRun.p.key !== k, r.key);
  const shown = Date.now() - tW;
  const wantMs = isK ? 900 : 600;
  ok(shown >= wantMs - 80 && shown < wantMs + 700, `the right answer shows for ~${wantMs} ms, then the next problem (${shown} ms)`);
  const afterWrong = await runInfo(page);
  ok(afterWrong.score === 3 && afterWrong.tries === 4, 'on to the next problem, score unchanged');
  const t1 = afterWrong.left; await page.waitForTimeout(500);
  ok((await runInfo(page)).left < t1 - 300, 'the clock runs again while a problem waits');

  // Pause: the page is hidden → paused; RESUME brings it back
  const hide = h => page.evaluate(h => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, h);
  await hide(true);
  const p1 = await page.evaluate(() => ({ phase: sprintRun.phase, left: sprintLeft(sprintRun), resume: !!document.querySelector('.sprint-ov--paused button.sprint-resume'),
    card: getComputedStyle(document.getElementById('sprint-card')).visibility, answers: getComputedStyle(document.getElementById('sprint-answers')).visibility,
    text: document.querySelector('.sprint-ov--paused').innerText }));
  ok(p1.phase === 'paused' && p1.resume, 'page hidden → paused, with a RESUME button');
  ok(p1.card === 'hidden' && p1.answers === 'hidden', 'the problem is hidden while paused');
  checkSafe('paused', p1.text);
  await hide(false);
  await page.waitForTimeout(600);
  const p2 = await page.evaluate(() => ({ phase: sprintRun.phase, left: sprintLeft(sprintRun) }));
  ok(p2.phase === 'paused' && Math.abs(p2.left - p1.left) < 5, 'the clock stays stopped until RESUME, even when the page is back');
  await shot('07-paused');
  await layout(page, vp, pid, `${tag} paused`);
  await press(page, vp, page.locator('.sprint-resume'));
  r = await runInfo(page);
  ok(r.phase === 'run' && r.clockOn && r.score === 3, 'RESUME: the same problem, the clock running again');
  // The pause button does the same
  await press(page, vp, page.locator('.sprint-pause'), 200);
  ok((await runInfo(page)).phase === 'paused', 'the ⏸ PAUSE button pauses');
  await press(page, vp, page.locator('.sprint-resume'));
  ok((await runInfo(page)).phase === 'run', 'and RESUME resumes');
  // One more right, then the time runs out
  await answer(page, vp, true);
  await timeUp(page);
  const stamp = await page.evaluate(() => document.querySelector('.sprint-stamp').innerText);
  ok(/TIME/.test(stamp), 'TIME! stamp: ' + stamp);
  await shot('08-time');
  await page.waitForSelector('.sprint-end');
  await page.waitForTimeout(1300);
  let E = await endInfo(page);
  let st = await store(page, pid);
  const xpGain1 = Math.ceil(4 * XPPER[pid] / 5);
  ok(E.num === '4' && /RIGHT/.test(E.text), `results: 4 right (${E.num})`);
  ok(/NEW BEST!/.test(E.banner), 'first sprint: NEW BEST!: ' + E.banner);
  const stars1 = await page.evaluate(() => [...document.querySelectorAll('.sprint-end-banner .sprint-star')].map(x => getComputedStyle(x).color));
  ok(!/⭐/.test(E.banner) && stars1.length === 2 && stars1.every(c => c === 'rgb(26, 26, 46)'), 'the banner stars are ink, not a yellow ⭐ lost on the yellow banner: ' + stars1.join(','));
  ok((await page.evaluate(() => window.__confetti.length)) >= 1 && (await sounds(page)).includes('win'), 'NEW BEST: confetti and the win sound');
  ok(new RegExp(`\\+${xpGain1} XP`).test(E.chips), `XP earned shown: +${xpGain1} (${E.chips})`);
  ok((await xpOf(page, pid)) === xp0 + xpGain1, `XP added to the child's xp: ${xp0} + ${xpGain1}`);
  ok(st && st.best === 4 && st.scores.join() === '4' && st.runs === 1 && !st.pending && st.xp === xpGain1, 'saved: best 4, scores [4], runs 1, no pending: ' + JSON.stringify(st));
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem(STORAGE_KEY)).profiles[currentProfile.id].fun.sprint.best === 4), 'and written to localStorage');
  ok(E.learn.length === 1, 'one problem to learn');
  const learnText = E.learn[0] && E.learn[0].eq;
  ok(E.learn[0] && E.learn[0].filled === w1.q, `the problem gone wrong is listed with its answer: ${learnText}`);
  if (isK) ok(E.learn[0] && E.learn[0].dots > 0 && E.learn[0].say, 'K: with its dot picture and a 🔊');
  ok(E.bars.length === 1 && E.bars[0].now && E.bars[0].v === '4', 'the chart shows this sprint');
  ok(E.again && E.home && E.ownKeys, 'AGAIN and BACK TO HUB');
  let ev = await events(page);
  ok(ev.length === 1 && ev[0].profileId === pid && ev[0].score === 4 && ev[0].best === 4 && ev[0].isBest === true, 'sprintDone { profileId, score, best, isBest }: ' + JSON.stringify(ev[0]));
  if (isK) {
    ok(/You got 4 right/.test(E.say || ''), 'K: a 🔊 for the results');
    await page.waitForTimeout(600);
    ok((await spoken(page)).some(t => /You got 4 right/.test(t)), 'K: the results are read aloud (autoRead)');
  }
  const mis = await page.evaluate(pid => { const m = state.profiles[pid].fun && state.profiles[pid].fun.missions; return m && m.c ? m.c.sprint : null; }, pid);
  ok(mis === 1, 'the missions module counted the sprint: ' + mis);
  checkSafe('results', E.text);
  await shot('09-results');
  await page.screenshot({ path: path.join(SHOTS, `${tag}-09b-results-full.png`), fullPage: true });
  await layout(page, vp, pid, `${tag} results`);

  // ── Sprint 2 (AGAIN): fewer right → not a best, kind words, chart of 2 ──
  await page.evaluate(() => { window.__confetti.length = 0; window.__sounds.length = 0; SPRINT_CFG.countStep = 120; });
  await press(page, vp, page.locator('.sprint-again'), 150);
  await page.waitForFunction(() => sprintRun && sprintRun.phase === 'run');
  ok(await page.evaluate(() => document.querySelector('.sprint-best').innerText.includes('4')), 'the sprint shows the best to beat: 4');
  for (let i = 0; i < 3; i++) await answer(page, vp, true);
  await timeUp(page);
  await page.waitForSelector('.sprint-end');
  await page.waitForTimeout(400);
  E = await endInfo(page);
  st = await store(page, pid);
  ok(E.num === '3' && !E.banner && /away from your best|best is 4|Your best/.test(E.line), `3 right: no banner, the best named kindly: "${E.line}"`);
  ok(/best 4/.test(E.chips), 'their personal best is in view: ' + E.chips);
  ok(!/⭐/.test(E.chips) && /★/.test(E.chips), 'the best chip has an ink ★ (a ⭐ vanishes on its yellow): ' + E.chips);
  ok((await page.evaluate(() => window.__confetti.length)) === 0, 'no confetti without a new best');
  ok(st.best === 4 && st.scores.join() === '4,3' && st.runs === 2, 'saved: best 4, scores [4, 3]');
  ok(E.bars.length === 2 && E.bars[0].best && !E.bars[0].now && E.bars[1].now, 'chart: two bars, the best starred, this one marked');
  ok(E.clean, 'every answer right: no list, a cheer instead');
  ev = await events(page);
  ok(ev.length === 2 && ev[1].isBest === false && ev[1].best === 4 && ev[1].score === 3, 'sprintDone isBest false');
  await shot('10-results-again');

  // ── Sprint 3: LIGHTNING ──
  await press(page, vp, page.locator('.sprint-again'), 150);
  await page.waitForFunction(() => sprintRun && sprintRun.phase === 'run');
  await clearSounds(page);
  for (let i = 0; i < LIGHT[pid]; i++) await answer(page, vp, true);
  r = await runInfo(page);
  ok(r.combo === LIGHT[pid], `${LIGHT[pid]} in a row`);
  const fanfares = (await sounds(page)).filter(x => x === 'streak').length;
  ok(fanfares === Math.floor(LIGHT[pid] / 5), `a 'streak' fanfare at every 5 in a row (${fanfares} for ${LIGHT[pid]})`);
  await shot('11-combo-big');
  await timeUp(page);
  await page.waitForSelector('.sprint-end');
  await page.waitForTimeout(700);
  E = await endInfo(page);
  const tro = await page.evaluate(pid => ({ has: state.profiles[pid].trophies.includes('sprint_lightning'), pop: [...document.querySelectorAll('.trophy-pop')].map(p => p.innerText).join(' | ') }), pid);
  ok(E.num === String(LIGHT[pid]) && /NEW BEST!/.test(E.banner) && /old best was 4/.test(E.line), `${LIGHT[pid]}: a new best over 4 (${E.line})`);
  ok(tro.has && /LIGHTNING/.test(tro.pop), '⚡ LIGHTNING trophy: ' + tro.pop);
  await shot('12-lightning');

  // ── Back to the hub: Best and the recent bars ──
  await press(page, vp, page.locator('.sprint-home'));
  await page.waitForSelector('.hub .sprint-hubcard');
  const hub2 = await page.evaluate(() => {
    const c = document.querySelector('.sprint-hubcard');
    const t = [...document.querySelectorAll('.trophy')].find(x => x.innerText.includes('LIGHTNING'));
    return { best: c.querySelector('.sprint-hub-best-n') && c.querySelector('.sprint-hub-best-n').innerText, bars: c.querySelectorAll('.sprint-hub-bars i').length,
      badge: c.querySelector('.fun-card-badge').innerText, text: c.innerText, trophy: t && t.className, note: t && t.querySelector('.trophy-note').innerText };
  });
  ok(hub2.best === String(LIGHT[pid]) && /Best:/.test(hub2.text), `hub card: Best: ${hub2.best}`);
  ok(hub2.bars === 3 && hub2.badge === `${SECS[pid]}s`, `hub card: 3 recent bars, badge ${hub2.badge}`);
  ok(/got/.test(hub2.trophy || '') && (isK ? /12 in a Quick Count/.test(hub2.note) : /Score 20 in a speed sprint/.test(hub2.note)), `trophy row: LIGHTNING won, note for this child: ${hub2.note}`);
  ok(/3 sprints/i.test(hub2.text), 'hub card counts sprints');
  await page.locator('.sprint-hubcard').scrollIntoViewIfNeeded();
  await shot('13-hub-after');

  // ── Ending early: nothing on the chart, XP kept, no sprintDone ──
  const xpA = await xpOf(page, pid);
  await startSprint(page, vp, true);
  await answer(page, vp, true);
  await answer(page, vp, true);
  await answer(page, vp, false);
  if (vp.touch) {
    await press(page, vp, page.locator('.sprint-pause'), 300);
    await press(page, vp, page.locator('.sprint-quit'));
  } else {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
  }
  await page.waitForSelector('.sprint-end');
  E = await endInfo(page);
  st = await store(page, pid);
  ok(/STOPPED/.test(E.kicker) && /stopped early/i.test(E.line), `${vp.touch ? 'END SPRINT' : 'Esc'} ends it early: ${E.kicker} / ${E.line}`);
  ok(st.runs === 3 && st.scores.length === 3 && st.best === LIGHT[pid], 'an early end is not on the chart and not a best');
  ok((await xpOf(page, pid)) === xpA + Math.ceil(2 * XPPER[pid] / 5), 'its XP is still added');
  ok((await events(page)).length === 3, 'no sprintDone for a sprint stopped early');
  ok(E.learn.length === 1, 'the problem to learn is still shown');
  await shot('14-stopped');
  await press(page, vp, page.locator('.sprint-home'));

  // ── Leaving from the countdown: nothing recorded ──
  await page.evaluate(() => { SPRINT_CFG.countStep = 800; });
  await press(page, vp, page.locator('.sprint-hubcard .sprint-go'), 200);
  ok((await runInfo(page)).phase === 'count', 'countdown');
  await press(page, vp, page.locator('.sprint-pause'), 200);
  ok(await page.locator('.sprint-ov--paused .sprint-quit').innerText() === '← BACK TO HUB', 'paused in the countdown offers BACK TO HUB');
  await press(page, vp, page.locator('.sprint-quit'));
  await page.waitForSelector('.hub .sprint-hubcard');
  ok((await store(page, pid)).runs === 3 && (await page.evaluate(() => sprintRun)) === null, 'back at the hub, nothing recorded');

  // ── A closed tab mid-sprint: the XP of its right answers comes back ──
  const xpB = await xpOf(page, pid);
  await startSprint(page, vp, true);
  for (let i = 0; i < 3; i++) await answer(page, vp, true);
  ok((await store(page, pid)).pending.score === 3, 'pending score saved as the sprint goes');
  await page.reload();
  await instrument(page);
  ok((await page.evaluate(pid => state.profiles[pid].xp, pid)) === xpB, 'after a reload the XP is not yet counted');
  await toHub(page, vp, pid);
  await page.waitForTimeout(600);
  const toast = await page.evaluate(() => [...document.querySelectorAll('.fun-toast')].map(t => t.innerText).join(' | '));
  ok((await xpOf(page, pid)) === xpB + Math.ceil(3 * XPPER[pid] / 5), `the hub adds the closed sprint's XP: +${Math.ceil(3 * XPPER[pid] / 5)}`);
  ok(/from your last sprint/.test(toast), 'and says so: ' + toast);
  st = await store(page, pid);
  ok(!st.pending && st.runs === 3 && st.best === LIGHT[pid], 'pending cleared; best and chart untouched');
  ok((await page.evaluate(pid => state.profiles[pid].fun.sprint.pending, pid)) === undefined, 'nothing pending');

  // ── Persistence across the reload ──
  ok(st.scores.join() === `4,3,${LIGHT[pid]}` && st.xp > 0, 'scores survive a reload: ' + st.scores.join());
  ok(await page.locator('.sprint-hubcard .sprint-hub-best-n').innerText() === String(LIGHT[pid]), 'hub card after reload: Best: ' + LIGHT[pid]);

  // ── The screen replaced mid-sprint (e.g. the parent link): stop cleanly, keep XP ──
  const xpC = await xpOf(page, pid);
  await startSprint(page, vp, true);
  await answer(page, vp, true);
  await page.evaluate(() => render('<div class="hub">elsewhere</div>'));
  await page.waitForTimeout(400);
  ok((await page.evaluate(() => sprintRun)) === null, 'another screen drawn: the sprint stops by itself');
  ok((await xpOf(page, pid)) === xpC + Math.ceil(1 * XPPER[pid] / 5) && !(await store(page, pid)).pending, 'and its XP is kept');
  await page.evaluate(() => renderHub());
  await page.waitForSelector('.hub .sprint-hubcard');

  // ── K: every fact used up → ALL DONE ──
  if (isK) {
    await startSprint(page, vp, true);
    await page.evaluate(() => {
      const all = sprintAllK().map(([add, a, b]) => sprintMakeK(add, a, b).key).filter(k => k !== sprintRun.p.key);
      const keep = all.pop();
      all.forEach(k => sprintRun.used.add(k));
      window.__keep = keep;
    });
    await answer(page, vp, true);
    ok((await runInfo(page)).key === await page.evaluate(() => window.__keep), 'the last unused fact comes up');
    await answer(page, vp, true);
    await page.waitForSelector('.sprint-stamp');
    ok(/ALL DONE/.test(await page.locator('.sprint-stamp').innerText()), 'every fact done: ALL DONE!');
    await page.waitForSelector('.sprint-end');
    E = await endInfo(page);
    ok(/ALL DONE/.test(E.kicker) && (await store(page, pid)).runs === 4, 'it counts as a finished sprint');
    ok(/You did every fact!/.test(E.line), 'and says so: ' + E.line);
    await shot('15-all-done');
    await press(page, vp, page.locator('.sprint-home'));
  }

  // ── Parent dashboard ──
  await page.evaluate(() => renderParentDash());
  await page.waitForSelector('.sprint-parent');
  const par = await page.evaluate(() => ({ text: document.querySelector('.sprint-parent').innerText, rows: document.querySelectorAll('.sprint-parent li').length }));
  ok(/Speed Sprints/.test(par.text) && par.rows === 3 && new RegExp(`best ${LIGHT[pid]}`).test(par.text), 'parent dashboard: a row per child with the best');
  ok(/guess/.test(par.text) && /clock waits/.test(par.text), 'the parent page explains the clock and the guess rule');
  await page.locator('.sprint-parent').scrollIntoViewIfNeeded();
  await shot('16-parent');
  await page.evaluate(pid => pickProfile(pid), pid);
  await page.waitForSelector('.hub .sprint-hubcard');

  // ── A normal round plays start to finish with the module loaded ──
  await press(page, vp, page.locator('.pack-card').first());
  if (await page.locator('.briefing-go').count()) await press(page, vp, page.locator('.briefing-go'));
  await page.waitForSelector('.question-frame');
  const total = await page.evaluate(() => questions.length);
  let sawSprint = false;
  for (let i = 0; i < total; i++) {
    if (await page.locator('.sprint-screen, .sprint-end').count()) sawSprint = true;
    await answerCorrect(page, vp);
    await page.waitForSelector('#fb .next-btn');
    await press(page, vp, page.locator('#fb .next-btn'));
  }
  await page.waitForSelector('.complete');
  ok(total === 10 && !sawSprint, 'a normal round: 10 questions, no sprint pieces in it');
  ok(/ROUND \d+ DONE/.test(await page.locator('.complete-title').innerText()), 'the normal round reaches its complete screen');
  await shot('17-normal-complete');
  // Back to the hub, then a sprint: the finished round left currentPack set,
  // and starting a sprint must not "leave" that round again (roundExit).
  await page.waitForTimeout(1200);
  await closeOverlays(page);
  await press(page, vp, page.locator('.complete-nav', { hasText: 'BACK TO PACKS' }));
  await page.waitForSelector('.hub .sprint-hubcard');
  await page.waitForTimeout(600);
  await closeOverlays(page);
  const exits0 = await page.evaluate(() => window.__exits);
  await press(page, vp, page.locator('.sprint-hubcard .sprint-go'), 700);
  const after = await page.evaluate(() => ({ exits: window.__exits, screen: !!document.querySelector('.sprint-screen'), run: !!sprintRun, modal: !!document.querySelector('[aria-modal="true"], #stk-overlay') }));
  ok(after.exits === exits0 && after.screen && after.run && !after.modal, `SPRINT! after a finished round: no roundExit for it, the sprint stays on screen (${JSON.stringify(after)})`);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.hub .sprint-hubcard');

  ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

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

// ═══════════════════════════════════════════════════════════════
// 3. The 3rd grader: × and ÷ facts, 4 answers, 60 s
// ═══════════════════════════════════════════════════════════════
async function runG3(browser) {
  const vp = VPS.ipad, pid = 'g3', tag = 'ipad-g3';
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp);
  const shot = name => page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) });
  await toHub(page, vp, pid);
  const text = await page.locator('.sprint-hubcard').innerText();
  ok(/Multiply & Divide/.test(text) && /60 sec/.test(text) && /× and ÷ facts within 100/.test(text), 'g3 hub card: Multiply & Divide, 60 sec');
  await page.locator('.sprint-hubcard').scrollIntoViewIfNeeded();
  await shot('01-hub');
  await startSprint(page, vp, true);
  const kinds = new Set();
  let r = await runInfo(page);
  ok(r.n === 4 && r.total === 60000, 'g3: 4 answers, 60 seconds');
  await shot('02-run');
  await layout(page, vp, pid, `${tag} run`);
  for (let i = 0; i < 7; i++) { r = await runInfo(page); kinds.add(r.kind); ok(/^\d+ [×÷] \d+$/.test(r.text), 'g3 fact: ' + r.text); await answer(page, vp, i !== 3); }
  ok([...kinds].every(k => k === 'mul' || k === 'div'), 'g3: only × and ÷ facts: ' + [...kinds]);
  await timeUp(page);
  await page.waitForSelector('.sprint-end');
  await page.waitForTimeout(1000);
  const E = await endInfo(page);
  ok(E.num === '6' && /\+12 XP/.test(E.chips) && E.learn.length === 1, 'g3 results: 6 right, +12 XP, one to learn: ' + E.chips);
  ok(/LEARN THESE/.test(E.text), 'g3: "LEARN THESE"');
  await shot('03-results');
  await layout(page, vp, pid, `${tag} results`);
  ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// 4. Keyboard only (laptop, no touch)
// ═══════════════════════════════════════════════════════════════
async function runKeyboard(browser, pid) {
  const vp = VPS.laptop, tag = `keys-${pid}`, isK = pid === 'k';
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp);
  const shot = name => page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) });
  const tabTo = async (sel, max) => {
    for (let i = 0; i < (max || 80); i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(sel => { const a = document.activeElement; return !!(a && a.matches && a.matches(sel)); }, sel)) return true;
    }
    return false;
  };
  ok(await tabTo(`.profile-card[onclick*="'${pid}'"]`, 20), 'Tab reaches the child on the title screen');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.hub .sprint-hubcard');
  await page.waitForTimeout(450);
  ok(await tabTo('.sprint-go'), 'Tab reaches SPRINT! on the hub');
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  ok(ring !== 'none', 'with a visible focus ring: ' + ring);
  await shot('01-focus');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.sprint-screen');
  ok((await runInfo(page)).phase === 'count', 'Enter on SPRINT! starts the countdown');
  await page.waitForTimeout(450);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.hub .sprint-hubcard');
  ok((await store(page, pid)).runs === 0, 'Esc in the countdown: back to the hub, nothing recorded');
  await page.waitForTimeout(450);
  await page.evaluate(() => { SPRINT_CFG.countStep = 120; });
  ok(await tabTo('.sprint-go'), 'Tab to SPRINT! again');
  await page.keyboard.press(' ');
  await page.waitForFunction(() => sprintRun && sprintRun.phase === 'run');
  ok(true, 'Space on SPRINT! starts it');
  let r = await answer(page, vp, true, 'key');
  ok((await runInfo(page)).score === 1, `key ${r.picked + 1} answers (right)`);
  await clearSounds(page);
  r = await answer(page, vp, false, 'key');
  ok((await runInfo(page)).score === 1 && (await sounds(page)).includes(isK ? 'wrong' : 'buzz'), `key ${r.picked + 1} answers (wrong)`);
  const before = await runInfo(page);
  await page.keyboard.press(String(NCH[pid] + 1));   // 4 for K, 5 otherwise: not an answer
  await page.keyboard.press('9');
  await page.waitForTimeout(450);
  const after = await runInfo(page);
  ok(after.tries === before.tries && after.key === before.key, `keys past ${NCH[pid]} do nothing`);
  // Letters are not answers here, and the app's own shortcuts stand aside.
  await page.keyboard.press('a');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(450);
  ok((await runInfo(page)).tries === before.tries && !(await page.locator('#exit-modal-backdrop').count()), "the app's own shortcuts stand aside (data-own-keys)");
  ok(await tabTo('.sprint-pause', 10), 'Tab reaches PAUSE');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  ok((await runInfo(page)).phase === 'paused' && await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('sprint-resume')), 'paused, focus on RESUME');
  await shot('02-paused');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  ok((await runInfo(page)).phase === 'run', 'Enter resumes');
  await answer(page, vp, true, 'key');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.sprint-end');
  await page.waitForTimeout(300);
  ok(/STOPPED/.test((await endInfo(page)).kicker), 'Esc ends the sprint');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('sprint-again')), 'focus on AGAIN');
  await shot('03-stopped');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => sprintRun && sprintRun.phase === 'run');
  ok(true, 'Enter = AGAIN');
  for (let i = 0; i < 3; i++) await answer(page, vp, true, 'key');
  await timeUp(page);
  await page.waitForSelector('.sprint-end');
  await page.waitForTimeout(400);
  ok((await endInfo(page)).num === '3' && (await store(page, pid)).best === 3, 'a full sprint by keyboard: 3, saved as the best');
  await shot('04-results');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.hub .sprint-hubcard');
  ok(true, 'Esc on the results: back to the hub');
  ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// 5. Old saves: no module data at all, and broken module data
// ═══════════════════════════════════════════════════════════════
async function runOldSave(browser) {
  const vp = VPS.ipad, tag = 'oldsave';
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp);
  await page.evaluate(() => {
    const s = JSON.parse(JSON.stringify(state));
    // k: an old save from before any fun module existed
    Object.assign(s.profiles.k, { xp: 140, trophies: ['warmup'], bestStreak: 4, correct: 30, attempts: 36 });
    delete s.profiles.k.fun;
    // g3: module data that is not an object, next to another module's data
    s.profiles.g3.xp = 410;
    s.profiles.g3.fun = { sprint: 'junk', boss: { idx: 2, wins: 2, tired: 0, escapes: 0, battles: 3, laps: 0, beaten: {} } };
    // g5: broken fields
    s.profiles.g5.xp = 905;
    s.profiles.g5.fun = { sprint: { best: 'x', scores: [3, 'a', null, 9, -2, 1e9, 7.6], runs: -3, xp: 'lots', pending: 'zz' } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await instrument(page);
  for (const pid of ['k', 'g3', 'g5']) {
    await toHub(page, vp, pid);
    const c = await page.evaluate(() => document.querySelector('.sprint-hubcard').innerText);
    ok(/Best:/.test(c), `${pid}: the hub card renders from an old save`);
    await page.screenshot({ path: path.join(SHOTS, `${tag}-${pid}-hub.png`) });
    await page.evaluate(() => renderProfileSelect());
    await page.waitForTimeout(450);
  }
  const s = await page.evaluate(() => ({ k: state.profiles.k, g3: state.profiles.g3, g5: state.profiles.g5 }));
  ok(s.k.xp === 140 && s.k.trophies.includes('warmup') && s.k.bestStreak === 4 && s.k.fun.sprint.best === 0 && s.k.fun.sprint.runs === 0, 'k: no module data → a fresh sprint record, everything else kept');
  ok(s.g3.xp === 410 && s.g3.fun.boss.wins === 2 && s.g3.fun.sprint.best === 0 && Array.isArray(s.g3.fun.sprint.scores), "g3: junk sprint data replaced; the boss module's data untouched");
  ok(s.g5.xp === 905 && s.g5.fun.sprint.scores.join() === '3,9,7' && s.g5.fun.sprint.best === 9 && s.g5.fun.sprint.runs === 3 && s.g5.fun.sprint.xp === 0 && !('pending' in s.g5.fun.sprint),
    'g5: broken fields repaired (scores 3,9,7; best 9; runs 3): ' + JSON.stringify(s.g5.fun.sprint));
  // Play on the repaired save
  await toHub(page, vp, 'g5');
  ok(await page.locator('.sprint-hubcard .sprint-hub-best-n').innerText() === '9', 'g5 hub: Best: 9');
  await startSprint(page, vp, true);
  for (let i = 0; i < 2; i++) await answer(page, vp, true);
  await timeUp(page);
  await page.waitForSelector('.sprint-end');
  const g5 = await store(page, 'g5');
  ok(g5.scores.join() === '3,9,7,2' && g5.best === 9 && g5.runs === 4, 'g5: a sprint on the repaired save is saved: ' + g5.scores.join());
  ok((await xpOf(page, 'g5')) === 905 + 6, 'g5: XP 905 + 6');
  // A damaged pending score is never paid out; a real one (even as text) is
  await page.evaluate(() => { renderProfileSelect(); state.profiles.g3.xp = 410; state.profiles.g3.fun.sprint.pending = { score: 1e9 }; state.profiles.k.fun.sprint.pending = { score: -40 }; saveState(); });
  await page.reload();
  await instrument(page);
  await toHub(page, vp, 'g3');
  ok((await xpOf(page, 'g3')) === 410 && !(await store(page, 'g3')).pending, 'g3: a pending score of a billion is dropped, not turned into 2 billion XP: xp ' + (await xpOf(page, 'g3')));
  await page.evaluate(() => { state.profiles.g3.fun.sprint.pending = { score: '7' }; renderHub(); });
  ok((await xpOf(page, 'g3')) === 410 + 14, 'g3: a real pending score of "7" (text) is credited once: +14 XP');
  await page.evaluate(() => pickProfile('k'));
  ok((await xpOf(page, 'k')) === 140 && !(await store(page, 'k')).pending, 'k: a negative pending score is dropped');
  // A warm-up sprint with nothing right is never shown as "Best: 0"
  await page.evaluate(() => { state.profiles.k.fun.sprint = { best: 0, scores: [0], runs: 1, xp: 0 }; renderHub(); });
  const kb = await page.evaluate(() => document.querySelector('.sprint-hubcard .sprint-hub-best').innerText.replace(/\s+/g, ' '));
  ok(/not yet/.test(kb) && !/\b0\b/.test(kb), 'k: after one sprint with 0 right the hub says "Best: not yet!", not "Best: 0": ' + kb);
  // A profile with no module data at all, mid-session
  await page.evaluate(() => { delete state.profiles.g3.fun; saveState(); });
  await page.evaluate(() => pickProfile('g3'));
  await page.waitForSelector('.hub .sprint-hubcard');
  ok(true, 'g3 with no fun data at all: hub renders');
  ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// 6. Together with the other modules
// ═══════════════════════════════════════════════════════════════
async function runTogether(browser) {
  const vp = VPS.ipad, tag = 'together';
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp);
  const present = await page.evaluate(() => ({ buddy: typeof buddyCheckLevel === 'function', stickers: typeof stickersAutoRead === 'function', boss: typeof bossStart === 'function', missions: typeof missionsDef === 'function', reading: typeof readingRoad === 'function' }));
  console.log('    modules in the page: ' + JSON.stringify(present));
  ok(present.buddy && present.stickers && present.boss && present.missions, 'the game has buddy, stickers, boss and missions');
  await page.evaluate(() => { const s = FUN.store('k', 'buddy'); s.type = 'dragon'; s.name = 'Ember'; s.lastLevel = 1; state.profiles.k.xp = 148; saveState(); });
  await toHub(page, vp, 'k');
  const order = await page.evaluate(() => [...document.querySelectorAll('.fun-zone > .fun-card')].map(c => c.className.split(' ').find(x => /hubcard|buddy-card|missions-card|stk-|boss-hubcard|sprint-hubcard|reading-hubcard/.test(x)) || c.className));
  const at = re => order.findIndex(c => re.test(c));
  ok(at(/missions/) < at(/stk-/) && at(/stk-/) < at(/boss/) && at(/boss/) < at(/sprint/) && order.slice(at(/sprint/) + 1).every(c => /family/.test(c)), 'play zone order: … missions 20, stickers 30, boss 40, sprint 50 (family 60): ' + order.join(', '));
  await page.screenshot({ path: path.join(SHOTS, `${tag}-01-hub.png`), fullPage: false });
  await startSprint(page, vp, true);
  for (let i = 0; i < 2; i++) await answer(page, vp, true);
  await timeUp(page);
  await page.waitForSelector('.sprint-end');
  await page.waitForTimeout(900);
  const lv = await page.evaluate(() => ({ ups: window.__levelUps.map(e => e.level), face: !!document.querySelector('.sprint-end .buddy-face'), xp: state.profiles.k.xp }));
  ok(lv.xp === 150 && lv.ups.includes(2), `the buddy's level-up fires after a sprint's XP (xp ${lv.xp}, levels ${lv.ups})`);
  ok(lv.face, "the child's buddy cheers on the results");
  ok((await page.evaluate(() => FUN.store('k', 'missions').c.sprint)) === 1, 'missions counted the sprint');
  await page.screenshot({ path: path.join(SHOTS, `${tag}-02-results-buddy.png`) });
  await layout(page, vp, 'k', `${tag} results`);
  await press(page, vp, page.locator('.sprint-home'));
  await page.waitForSelector('.hub .boss-hubcard');
  ok(true, 'back at the hub with the boss card still there');
  ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// 7. Narrow (390 px, reduced motion) and iPad landscape
// ═══════════════════════════════════════════════════════════════
async function runNarrow(browser, vp, pid, reduce) {
  const tag = `${vp.name}-${pid}`;
  console.log(`\n▶ ${tag} (${vp.width}x${vp.height}${reduce ? ', reduced motion' : ''})`);
  const { ctx, page, errors } = await newPage(browser, vp, reduce ? { reducedMotion: 'reduce' } : {});
  const shot = name => page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) });
  ok(await page.evaluate(() => FUN.reducedMotion()) === !!reduce, 'reduced motion setting seen by FUN');
  await toHub(page, vp, pid);
  await page.locator('.sprint-hubcard').scrollIntoViewIfNeeded();
  await shot('01-hub');
  await layout(page, vp, pid, `${tag} hub`);
  await press(page, vp, page.locator('.sprint-hubcard .sprint-go'), 200);
  await shot('02-countdown');
  await layout(page, vp, pid, `${tag} countdown`);
  await page.waitForFunction(() => sprintRun && sprintRun.phase === 'run', null, { timeout: 8000 });
  if (pid === 'g5') await page.evaluate(() => { const f = sprintGen; let n = 0; window.sprintGen = p => (n++ % 2 ? sprintFrac() : sprintP10()); window.__restoreGen = () => { window.sprintGen = f; }; });
  await answer(page, vp, true);
  const fit = await page.evaluate(() => ({ b: document.getElementById('sprint-answers').getBoundingClientRect().bottom, h: innerHeight,
    sizes: [...new Set([...document.querySelectorAll('#sprint-answers .sprint-ans')].map(b => getComputedStyle(b).fontSize))],
    clipped: [...document.querySelectorAll('#sprint-answers .sprint-ans-val')].filter(v => v.getBoundingClientRect().height > parseFloat(getComputedStyle(v.parentElement).fontSize) * 1.6).map(v => v.textContent) }));
  ok(fit.sizes.length === 1 && fit.clipped.length === 0, `answers: one size, each on one line (${fit.sizes} ${fit.clipped})`);
  if (pid === 'g5' && vp.width < 600) {
    // The longest numbers (5,200,000) on a phone: two columns, so they stay big
    await page.evaluate(() => { window.sprintGen = () => { let p; do { p = sprintP10(); } while (Math.max(...p.opts.map(o => o.s.length)) < 8); return p; }; });
    await answer(page, vp, true);
    const big = await page.evaluate(() => ({ font: parseFloat(getComputedStyle(document.querySelector('#sprint-answers .sprint-ans')).fontSize), vals: [...document.querySelectorAll('#sprint-answers .sprint-ans-val')].map(v => v.textContent),
      lines: [...document.querySelectorAll('#sprint-answers .sprint-ans-val')].every(v => v.getBoundingClientRect().height < parseFloat(getComputedStyle(v.parentElement).fontSize) * 1.6),
      inside: [...document.querySelectorAll('#sprint-answers .sprint-ans')].every(b => { const v = b.querySelector('.sprint-ans-val').getBoundingClientRect(), r = b.getBoundingClientRect(); return v.left >= r.left && v.right <= r.right; }) }));
    ok(big.font >= 18 && big.lines && big.inside, `phone: long answers stay readable (${big.font}px, one line, inside the button): ${big.vals.join(' ')}`);
    await shot('03c-long');
    await page.evaluate(() => { const f = sprintGen; let n = 0; window.sprintGen = p => (n++ % 2 ? sprintFrac() : sprintP10()); });
  }
  ok(fit.b <= fit.h, `answers on screen without scrolling (${Math.round(fit.b)} ≤ ${fit.h})`);
  await shot('03-run');
  await layout(page, vp, pid, `${tag} run`);
  await answer(page, vp, true);
  await shot('03b-run');
  await layout(page, vp, pid, `${tag} run 2`);
  await settle(page);
  const r = await runInfo(page);
  const wb = page.locator('#sprint-answers .sprint-ans').nth((r.correct + 1) % r.n);
  if (vp.touch) await wb.tap(); else await wb.click();
  await page.waitForTimeout(120);
  await shot('04-wrong');
  await layout(page, vp, pid, `${tag} wrong`);
  await page.waitForFunction(k => sprintRun.phase === 'run' && sprintRun.p.key !== k, r.key);
  await page.waitForTimeout(350);
  await press(page, vp, page.locator('.sprint-pause'), 200);
  await shot('05-paused');
  await layout(page, vp, pid, `${tag} paused`);
  await press(page, vp, page.locator('.sprint-resume'));
  await answer(page, vp, true);
  await timeUp(page);
  await page.waitForSelector('.sprint-end');
  await page.waitForTimeout(reduce ? 300 : 1300);
  if (reduce) {
    ok(await page.evaluate(() => window.__confetti.length >= 1 && document.querySelectorAll('.fun-confetti').length === 0), 'reduced motion: no confetti on the page');
    ok((await page.locator('#sprint-end-num').innerText()) === String(await page.evaluate(() => sprintLast.score)), 'reduced motion: the score shows at once (no count-up)');
  }
  await shot('06-results');
  await page.screenshot({ path: path.join(SHOTS, `${tag}-06b-results-full.png`), fullPage: true });
  await layout(page, vp, pid, `${tag} results`);
  ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// Another screen drawn during the TIME! stamp: the sprint is saved and still
// counts (sprintDone, missions), whichever screen took over.
async function runStampLeave(browser) {
  const vp = VPS.laptop, pid = 'g3', tag = 'stamp-leave';
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp);
  await toHub(page, vp, pid);
  for (const [n, away] of [[2, 'renderParentDash()'], [1, 'renderHub()']]) {
    await startSprint(page, vp, true);
    for (let i = 0; i < n; i++) await answer(page, vp, true);
    await timeUp(page);
    await page.evaluate(js => eval(js), away);
    await page.waitForTimeout(1500);
    const ev = await events(page);
    ok(ev.length && ev[ev.length - 1].score === n && !(await page.locator('.sprint-end').count()), `${away} during TIME!: sprintDone still sent (score ${n}), no results screen pops up over it`);
    if (away === 'renderParentDash()') { await page.evaluate(pid => pickProfile(pid), pid); await page.waitForSelector('.hub .sprint-hubcard'); }
  }
  const st = await store(page, pid);
  ok(st.runs === 2 && st.scores.join() === '2,1' && st.best === 2 && (await events(page)).length === 2, 'both saved once: ' + JSON.stringify(st));
  ok((await page.evaluate(() => FUN.store('g3', 'missions').c.sprint)) === 2, 'missions counted both');
  ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// Guesses, double taps and the kindergartener's sounds.
async function runGuessAndTaps(browser) {
  // ── 5th grade on a phone (touch) ──
  {
    const vp = VPS.phone, tag = 'guess-g5';
    console.log(`\n▶ ${tag}`);
    const { ctx, page, errors } = await newPage(browser, vp);
    await toHub(page, vp, 'g5');
    await startSprint(page, vp, true);
    await settle(page);
    const G = await page.evaluate(() => SPRINT_CFG.guessMs);
    // A guess: wrong, tapped as soon as the problem shows → the clock keeps running through the reveal
    let r = await runInfo(page);
    await page.evaluate(() => { sprintRun.shownAt = performance.now(); });
    await page.locator('#sprint-answers .sprint-ans').nth((r.correct + 1) % r.n).tap();
    const g1 = await page.evaluate(() => ({ phase: sprintRun.phase, clockOn: sprintRun.clockOn, left: sprintLeft(sprintRun), guesses: sprintRun.guesses }));
    await page.waitForTimeout(300);
    const g2 = await page.evaluate(() => ({ phase: sprintRun.phase, left: sprintLeft(sprintRun) }));
    ok(g1.phase === 'reveal' && g1.clockOn && g1.guesses === 1 && g2.phase === 'reveal' && g1.left - g2.left > 200, `a guess (wrong in under ${G} ms): the clock keeps running while the answer shows (${Math.round(g1.left)} → ${Math.round(g2.left)})`);
    await page.waitForFunction(k => sprintRun.phase === 'run' && sprintRun.p.key !== k, r.key);
    // A considered wrong answer: the clock waits
    await page.waitForFunction(ms => performance.now() - sprintRun.shownAt > ms + 100, G);
    r = await runInfo(page);
    await page.locator('#sprint-answers .sprint-ans').nth((r.correct + 1) % r.n).tap();
    const c1 = await page.evaluate(() => ({ clockOn: sprintRun.clockOn, left: sprintLeft(sprintRun), guesses: sprintRun.guesses }));
    await page.waitForTimeout(300);
    const c2 = await page.evaluate(() => sprintLeft(sprintRun));
    ok(!c1.clockOn && c1.guesses === 1 && Math.abs(c1.left - c2) < 5, 'a wrong answer the child thought about: the clock waits, as always');
    await page.waitForFunction(k => sprintRun.phase === 'run' && sprintRun.p.key !== k, r.key);
    // A double tap on RESUME: the second tap must not answer whatever was under it
    await page.waitForTimeout(450);
    await press(page, vp, page.locator('.sprint-pause'), 250);
    // a spot on RESUME that has an answer button under it once the overlay goes
    const spot = await page.evaluate(() => {
      const b = document.querySelector('.sprint-resume').getBoundingClientRect();
      for (const a of document.querySelectorAll('#sprint-answers .sprint-ans')) {
        const q = a.getBoundingClientRect();
        const x0 = Math.max(b.left, q.left) + 4, x1 = Math.min(b.right, q.right) - 4, y0 = Math.max(b.top, q.top) + 3, y1 = Math.min(b.bottom, q.bottom) - 3;
        if (x1 > x0 && y1 > y0) return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
      }
      return null;
    });
    const under = !!spot;
    const at = spot || { x: 195, y: 360 };
    const t0 = await page.evaluate(() => sprintRun.tries);
    await page.touchscreen.tap(at.x, at.y);
    await page.waitForTimeout(70);
    await page.touchscreen.tap(at.x, at.y);
    await page.waitForTimeout(120);
    const d1 = await page.evaluate(() => ({ phase: sprintRun.phase, tries: sprintRun.tries }));
    ok(under && d1.phase === 'run' && d1.tries === t0, `phone: RESUME sits over the answers (${under}), and a double tap on it resumes without answering (${d1.phase}, tries ${t0} → ${d1.tries})`);
    await page.waitForTimeout(400);
    r = await runInfo(page);
    await page.locator('#sprint-answers .sprint-ans').nth(r.correct).tap();
    ok((await page.evaluate(() => sprintRun.tries)) === t0 + 1, 'a moment later, a tap answers as usual');
    await page.waitForFunction(k => sprintRun.phase === 'run' && sprintRun.p.key !== k, r.key);
    await page.evaluate(() => sprintFinish('stop'));
    await page.waitForSelector('.sprint-end');
    await press(page, vp, page.locator('.sprint-home'));
    // Mashing: random taps as fast as possible never beat thinking
    await page.evaluate(() => { SPRINT_CFG.secs.g5 = 8; SPRINT_CFG.countStep = 60; sprintStart(); });
    await page.waitForFunction(() => sprintRun && sprintRun.phase === 'run');
    const mash = await page.evaluate(() => new Promise(res => {
      const iv = setInterval(() => {
        if (!sprintRun || sprintRun.phase === 'over') { clearInterval(iv); res(sprintLast && { score: sprintLast.score, tries: sprintLast.tries }); return; }
        if (sprintRun.phase === 'run') { const b = document.querySelectorAll('#sprint-answers .sprint-ans'); b[Math.floor(Math.random() * b.length)].click(); }
      }, 90);
    }));
    ok(mash && mash.tries < 30 && mash.score <= 10, `mashing at random for an 8-second sprint: ${mash && mash.score} right of ${mash && mash.tries} (without the guess rule about 20 of 85)`);
    await page.evaluate(() => { SPRINT_CFG.secs.g5 = 60; });
    await page.waitForSelector('.sprint-end');
    await page.screenshot({ path: path.join(SHOTS, `${tag}-01-mashed.png`) });
    ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
    await ctx.close();
  }
  // ── The kindergartener on a laptop (mouse and keys) ──
  {
    const vp = VPS.laptop, tag = 'guess-k';
    console.log(`\n▶ ${tag}`);
    const { ctx, page, errors } = await newPage(browser, vp);
    await toHub(page, vp, 'k');
    await startSprint(page, vp, true);
    let r = await runInfo(page);
    await clearSounds(page);
    await page.evaluate(() => { sprintRun.shownAt = performance.now(); });
    await page.keyboard.press(String((r.correct + 1) % r.n + 1));
    const k1 = await page.evaluate(() => ({ clockOn: sprintRun.clockOn, guesses: sprintRun.guesses, phase: sprintRun.phase }));
    ok(k1.phase === 'reveal' && !k1.clockOn && k1.guesses === 0, 'K: even a fast wrong answer never costs her clock time');
    ok((await sounds(page)).includes('wrong') && !(await sounds(page)).includes('buzz'), "K: a miss plays the gentle 'wrong', not the buzzer");
    await page.waitForFunction(k => sprintRun.phase === 'run' && sprintRun.p.key !== k, r.key);
    // ⏸ clicked with the mouse, then Enter: it resumes (focus moved to RESUME,
    // so the Enter does not land on the PAUSE button that was clicked)
    await page.waitForTimeout(450);
    await page.locator('.sprint-pause').click();
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('sprint-resume')), 'K: after a mouse click on ⏸, focus is on RESUME');
    r = await runInfo(page);
    // Keys are never held back after RESUME (only a pointer's second tap is)
    await page.keyboard.press('Enter');
    await page.keyboard.press(String(r.correct + 1));
    await page.waitForTimeout(60);
    const k2 = await page.evaluate(() => ({ score: sprintRun.score }));
    ok(k2.score === 1, 'Enter resumes and a key pressed straight after still answers');
    ok((await sounds(page)).includes('right'), "K: a right answer plays the 'right' chime");
    await page.waitForFunction(k => sprintRun.phase === 'run' && sprintRun.p.key !== k, r.key);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.sprint-end');
    ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
    await ctx.close();
  }
}

// The kindergartener finishes a Reading Road stop, goes back to her hub and
// taps SPRINT!: the sprint starts (the stop used to open over it, because the
// finished round was "left" again).
async function runStaleReading(browser) {
  const vp = VPS.ipad, tag = 'stale-reading';
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp);
  await toHub(page, vp, 'k');
  const stop = await page.evaluate(() => { const road = readingRoad(); const s = (road.stops || Object.values(road.byId))[0]; readingPlay(s.id); return s.id; });
  if (await page.locator('.briefing-go').count()) await press(page, vp, page.locator('.briefing-go'));
  await page.waitForSelector('.question-frame');
  const total = await page.evaluate(() => questions.length);
  for (let i = 0; i < total; i++) {
    await answerCorrect(page, vp);
    await page.waitForSelector('#fb .next-btn');
    await press(page, vp, page.locator('#fb .next-btn'));
  }
  await page.waitForSelector('.complete');
  ok(await page.evaluate(() => !!(currentPack && currentPack.id === READING_PACK_ID)), `a Reading Road stop (${stop}) played to the end; the engine keeps its pack as currentPack`);
  await page.waitForTimeout(1200);
  await closeOverlays(page);
  const back = page.locator('.complete-nav', { hasText: 'BACK TO PACKS' });
  if (await back.count()) await press(page, vp, back); else await page.evaluate(() => backToPacks());
  await page.waitForSelector('.hub .sprint-hubcard');
  await page.waitForTimeout(600);
  await closeOverlays(page);
  const exits0 = await page.evaluate(() => window.__exits);
  await press(page, vp, page.locator('.sprint-hubcard .sprint-go'), 900);
  const s = await page.evaluate(() => ({ exits: window.__exits, sprint: !!document.querySelector('.sprint-screen'), stopScreen: !!document.querySelector('.reading-stopscreen'), run: !!sprintRun }));
  ok(s.exits === exits0 && s.sprint && s.run && !s.stopScreen, `SPRINT! after a Reading Road round opens the sprint, not the road stop (${JSON.stringify(s)})`);
  await page.screenshot({ path: path.join(SHOTS, `${tag}-01-sprint.png`) });
  ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// g5 with read-aloud switched on: the problems are read and get a 🔊.
async function runG5Voice(browser) {
  const vp = VPS.laptop, tag = 'voice-g5';
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp);
  await page.evaluate(() => { state.profiles.g5.autoRead = true; saveState(); });
  await toHub(page, vp, 'g5');
  await page.evaluate(() => { window.sprintGen = () => sprintFrac(); });
  await startSprint(page, vp, true);
  const r = await runInfo(page);
  ok(await page.locator('#sprint-card .js-speak').count() === 1, 'g5 with auto-read on: a 🔊 on the problem');
  ok((await spoken(page)).includes(r.say) && /(thirds|fourths|fifths|sixths|eighths|tenths|twelfths|halves|ieths|th|over what number)/.test(r.say), 'and it is read the way a teacher says it: ' + r.say);
  const q1 = await page.locator('#sprint-card .js-speak').getAttribute('data-speak-text');
  ok(!/\?\./.test(q1) && /\? Is it .*\?$/.test(q1), 'the 🔊 asks the problem, then the choices (no "?." in the middle): ' + q1);
  await page.screenshot({ path: path.join(SHOTS, `${tag}-01-run.png`) });
  // Miss three fractions (one of each kind), then the results read each as a sentence with its answer
  const kinds = [];
  for (const v of ['num', 'den', 'simp']) {
    await page.evaluate(v => { const pick = Math.random; window.sprintGen = () => { let p; do { p = sprintFrac(); } while (!(v === 'den' ? p.miss === 1 : v === 'simp' ? p.L[0] > p.R[0] : p.miss === 0 && p.L[0] < p.R[0])); return p; }; }, v);
    if (kinds.length) await page.waitForFunction(k => sprintRun.phase === 'run' && sprintRun.p.key !== k, kinds[kinds.length - 1]);
    await page.waitForTimeout(150);
    const st = await runInfo(page);
    kinds.push(st.key);
    await page.waitForFunction(ms => performance.now() - sprintRun.shownAt > ms + 80, await page.evaluate(() => SPRINT_CFG.guessMs));
    await page.locator('#sprint-answers .sprint-ans').nth((st.correct + 1) % st.n).click();
  }
  await page.waitForFunction(k => sprintRun.phase === 'run' && sprintRun.p.key !== k, kinds[2]);
  await page.evaluate(() => { sprintRun.endAt = performance.now() + 60; });
  await page.waitForSelector('.sprint-end');
  const learnSay = await page.evaluate(() => [...document.querySelectorAll('.sprint-learn-item .js-speak')].map(b => b.getAttribute('data-speak-text')));
  const sentence = /^\d+ [a-z-]+ equals \d+ [a-z-]+\.$/;
  ok(learnSay.length === 3 && learnSay.every(t => sentence.test(t) && !/\?/.test(t)), 'missed fractions are read as sentences ("2 thirds equals 8 twelfths."), never "…how many twelfths? equals 8": ' + learnSay.join(' | '));
  const nums = await page.evaluate(() => sprintLast.missed.map(p => ({ say: sprintSayAnswer(p, false), L: p.L, R: p.R, miss: p.miss, a: p.opts[p.correct].s })));
  ok(nums.every(x => { const m = /^(\d+) \S+ equals (\d+) /.exec(x.say); const R = x.R.slice(); R[x.miss] = +x.a; return m && +m[1] === x.L[0] && +m[2] === R[0]; }), 'and each sentence has the right numbers: ' + nums.map(x => x.say).join(' | '));
  await page.screenshot({ path: path.join(SHOTS, `${tag}-02-results.png`) });
  ok(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: app.CHROMIUM });
  try {
    await factChecks(browser);
    for (const vp of [VPS.ipad, VPS.laptop]) for (const pid of ['k', 'g5']) await runFull(browser, vp, pid);
    await runG3(browser);
    await runKeyboard(browser, 'g5');
    await runKeyboard(browser, 'k');
    await runOldSave(browser);
    await runTogether(browser);
    await runG5Voice(browser);
    await runStampLeave(browser);
    await runGuessAndTaps(browser);
    await runStaleReading(browser);
    await runNarrow(browser, VPS.phone, 'k', true);
    await runNarrow(browser, VPS.phone, 'g5', true);
    await runNarrow(browser, VPS.land, 'k', false);
  } catch (e) {
    fails++; failList.push('crash: ' + (e && e.stack || e));
    console.log('CRASH', e && e.stack || e);
  } finally {
    await browser.close();
  }
  if (fails) console.log('\nfailures:\n' + failList.map(f => ' - ' + f).join('\n'));
  console.log(`\nsprint: ${fails ? 'FAIL' : 'PASS'} — ${passes} checks passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
