// Speech, focus and pop-up rules: what is read aloud, what a tap, a key or a
// double press does, and where focus goes.
//   node speech.js [app.html]
//
// 1. speech and answers (laptop, then iPad): the voice says blends sound by
//    sound ("c... a... t..." as "kuh, aaa, tuh") and drops emoji and check
//    marks, a picture-only line says nothing, prose keeps its "..."; the
//    built-in voice priority (Samantha, Zira, Google US English); a screen
//    change drops a pending auto-read; Enter or Space on a 🔊 inside a
//    kindergarten answer reads it and picks nothing; a double click on a wrong
//    answer, a double CHECK on pick-all, and the same wrong typed answer twice
//    each cost one try, not two; auto-read reads the story before the
//    question; a swipe that starts on a 🔊 reads nothing, a tap reads once.
// 2. focus (laptop, keyboard): a walkthrough makes the page behind it inert,
//    puts focus on NEXT, Enter steps, Esc closes and gives focus back to NEED
//    HELP; the same for the scratch pad and ✏️; digits clicked on the number
//    pad then Enter submit; every <button> has a tabindex (Safari leaves
//    buttons out of the Tab order otherwise); the parent link is a keyboard
//    button; after a render with nothing focused the screen has focus.
// 3. read to the kindergartener (iPad, touch): after she chooses a buddy and
//    the hub has read itself, every pack card has a 🔊; a tap on it reads the
//    card and does not open it, a tap on the card opens the pack; the exit
//    pop-up and the round-complete card have a 🔊 and are read to her; a
//    pick-all question is read with numbered choices and "Then press CHECK".
// Fails on any check above or a JS error.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let passed = 0;
const fails = [], ok = m => { passed++; console.log('ok   ' + m); }, bad = m => { fails.push(m); console.log('FAIL ' + m); };

// ─── 1. What is read aloud; taps, keys and double presses on answers ───
async function speechAndAnswers(b) {
  const mk = async (touch) => {
    const ctx = await b.newContext({ viewport: touch ? { width: 820, height: 1180 } : { width: 1440, height: 900 }, hasTouch: touch });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.errs = errs;
    await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    await p.evaluate(() => { window.__said = []; const real = speakText; window.speakText = (t, e) => { __said.push(speechify(plainText(t))); return real(t, e); }; });
    return p;
  };
  // 1-2. speechify and voice choice
  let p = await mk(false);
  const sp = await p.evaluate(() => ({
    blend: speechify('Blend: c... a... t... What word?'),
    emoji: speechify('Which letter starts APPLE? 🍎'),
    pic: speechify('🔵'), check: speechify('✓ Right. Now PROVE it.'),
    prose: speechify('Wait... what? I see a cat.'),
    v1: pickVoice([{ name: 'Karen', lang: 'en-AU' }, { name: 'Samantha', lang: 'en-US' }]).name,
    v2: pickVoice([{ name: 'Microsoft David', lang: 'en-US' }, { name: 'Microsoft Zira', lang: 'en-US' }]).name,
    v3: pickVoice([{ name: 'Google UK English Female', lang: 'en-GB' }, { name: 'Google US English', lang: 'en-US' }]).name,
  }));
  sp.blend === 'Blend: kuh, aaa, tuh, What word?' ? ok('sound-by-sound: ' + sp.blend) : bad('blend: ' + sp.blend);
  sp.emoji === 'Which letter starts APPLE?' ? ok('emoji dropped') : bad('emoji: ' + sp.emoji);
  sp.pic === '' ? ok('picture-only says nothing') : bad('pic: ' + sp.pic);
  sp.check === 'Right. Now PROVE it.' ? ok('check mark dropped') : bad('check: ' + sp.check);
  sp.prose === 'Wait... what? I see a cat.' ? ok('prose ellipsis untouched') : bad('prose: ' + sp.prose);
  (sp.v1 === 'Samantha' && sp.v2 === 'Microsoft Zira' && sp.v3 === 'Google US English') ? ok('voice priority') : bad('voices ' + JSON.stringify(sp));
  // 3. render stops pending speech
  const stopped = await p.evaluate(() => { autoSay('pending words', 2000); renderProfileSelect(); return autoSayTimer === null; });
  stopped ? ok('render drops a pending auto-read') : bad('pending auto-read survived a screen change');
  // 4. keyboard Enter on a 🔊 inside a K answer reads it and picks nothing
  const kb = await p.evaluate(() => {
    pickProfile('k'); const pk = PACKS.k.find(x => x.tier === 'now'); startPack(pk.id); document.querySelector('.briefing-go').click();
    questions = [prepareQuestion({ type: 'mc', text: 'Which is a fruit?', options: ['apple', 'rock', 'shoe', 'cup'], correct: 0, why: 'x', hint: 'y' })];
    qIdx = 0; renderQuestion(); __said.length = 0;
    const btn = document.querySelectorAll('.choice .js-speak')[1];
    btn.focus(); return btn.dataset.speakText;
  });
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const kbr = await p.evaluate(() => ({ tries, locked, said: __said.slice() }));
  (kbr.tries === 0 && !kbr.locked && kbr.said.includes(kb)) ? ok('Enter on 🔊 reads "' + kb + '" and picks nothing') : bad('Enter on 🔊: ' + JSON.stringify(kbr));
  await p.keyboard.press(' '); await p.waitForTimeout(200);
  const kbs = await p.evaluate(() => ({ tries, locked }));
  (kbs.tries === 0 && !kbs.locked) ? ok('Space on 🔊 picks nothing') : bad('Space on 🔊: ' + JSON.stringify(kbs));
  // 6. double click on a wrong answer = one wrong try, THINK AGAIN shown
  await p.evaluate(() => { questions = [prepareQuestion({ type: 'mc', text: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 0, why: 'x', hint: 'y' })]; qIdx = 0; tries = 0; locked = false; firstWrong = null; renderQuestion(); });
  const wrongIdx = await p.evaluate(() => questions[0].correct === 0 ? 1 : 0);
  await p.locator('.choice').nth(wrongIdx).dblclick(); await p.waitForTimeout(500);
  const dc = await p.evaluate(() => ({ tries, locked, think: !!document.querySelector('.think-box, .think-head') }));
  (dc.tries === 1 && !dc.locked) ? ok('double click on a wrong answer keeps the second try') : bad('double click: ' + JSON.stringify(dc));
  // 7. multi: double CHECK after a wrong check
  await p.evaluate(() => { questions = [prepareQuestion({ type: 'multi', text: 'Pick two', options: ['a', 'b', 'c', 'd'], correct: [0, 1], why: 'x', hint: 'y' })]; qIdx = 0; tries = 0; locked = false; firstWrong = null; renderQuestion();
    const q = questions[0]; const wrong = [0, 1, 2, 3].filter(i => !q.correct.includes(i)); multiToggle(q.correct[0]); multiToggle(wrong[0]); });
  await p.locator('.puzzle-check').dblclick(); await p.waitForTimeout(400);
  const mu = await p.evaluate(() => ({ tries, done: qState.done }));
  (mu.tries === 1 && !mu.done) ? ok('double CHECK on pick-all keeps the second try') : bad('multi double check: ' + JSON.stringify(mu));
  // 8. typed: the same wrong answer submitted twice
  await p.evaluate(() => { questions = [prepareQuestion({ type: 'typed', text: 'Type cat', acceptedAnswers: ['cat'], why: 'x', hint: 'y' })]; qIdx = 0; tries = 0; locked = false; firstWrong = null; renderQuestion();
    const i = document.getElementById('typedInput'); i.removeAttribute('readonly'); i.value = 'dog'; submitTyped(); submitTyped(); });
  const ty = await p.evaluate(() => ({ tries, locked }));
  (ty.tries === 1 && !ty.locked) ? ok('same wrong typed answer twice keeps the second try') : bad('typed twice: ' + JSON.stringify(ty));
  // 9. auto-read reads the story first for an early reader
  const story = await p.evaluate(async () => {
    state.profiles.k.autoRead = true; __said.length = 0;
    questions = [prepareQuestion({ type: 'mc', passage: '<strong>Crab Day</strong><p>Ava caught 6 crabs.</p>', text: 'How many crabs?', options: ['6', '5', '4', '3'], correct: 0, why: 'x', hint: 'y' })];
    qIdx = 0; tries = 0; locked = false; renderQuestion();
    await new Promise(r => setTimeout(r, 600)); return __said.join(' | ');
  });
  /Crab Day\. Ava caught 6 crabs\..*How many crabs\?/.test(story) ? ok('auto-read: story, then question') : bad('auto-read story: ' + story);
  p.errs.forEach(e => bad('JS error ' + e));
  // 5. a swipe that starts on a 🔊 does not read
  p = await mk(true);
  await p.evaluate(() => { pickProfile('k'); state.profiles.k.autoRead = false; const pk = PACKS.k.find(x => x.tier === 'now'); startPack(pk.id); document.querySelector('.briefing-go').click();
    questions = [prepareQuestion({ type: 'mc', text: 'Which?', options: ['apple', 'rock', 'shoe', 'cup'], correct: 0, why: 'x', hint: 'y' })]; qIdx = 0; renderQuestion(); });
  await p.waitForTimeout(500);
  const box = await p.locator('.choice .js-speak').first().boundingBox();
  const cdp = await p.context().newCDPSession(p);
  await p.evaluate(() => { __said.length = 0; });
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - k * 15 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(300);
  const sw = await p.evaluate(() => __said.length);
  sw === 0 ? ok('a swipe starting on 🔊 reads nothing') : bad('swipe read ' + sw + ' times');
  await p.evaluate(() => { __said.length = 0; });
  await p.locator('.choice .js-speak').first().tap(); await p.waitForTimeout(300);
  const tp = await p.evaluate(() => ({ said: __said.length, tries }));
  (tp.said === 1 && tp.tries === 0) ? ok('a tap on 🔊 reads once and picks nothing') : bad('tap on 🔊: ' + JSON.stringify(tp));
  p.errs.forEach(e => bad('JS error ' + e));
}

// ─── 2. Focus: walkthrough, scratch pad, number pad, the Tab order ───
async function focus(b) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: false })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  const act = () => p.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) : 'none'; });
  // Walkthrough: focus on NEXT, page behind inert, Enter steps, Esc closes and gives focus back.
  const tutPack = await p.evaluate(() => { const id = Object.keys(TUTORIALS).find(k => allPacks().find(x => x.id === k && x.home === 'g3')); pickProfile('g3'); startPack(id); document.querySelector('.briefing-go').click(); keyboardDriving = true; document.querySelector('.help-btn').focus(); openTutorial(id); return id; });
  let st = await p.evaluate(() => ({ inert: app.inert, step: tutState.stepIdx, focus: document.activeElement.textContent.trim() }));
  (st.inert && /NEXT/.test(st.focus)) ? ok('walkthrough: page behind inert, focus on NEXT') : bad('walkthrough open ' + JSON.stringify(st));
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  st = await p.evaluate(() => ({ step: tutState.stepIdx, focus: document.activeElement.textContent.trim() }));
  (st.step === 1 && /NEXT|GOT IT/.test(st.focus)) ? ok('walkthrough: Enter steps and focus stays on NEXT') : bad('walkthrough Enter ' + JSON.stringify(st));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  st = await p.evaluate(() => ({ open: !!document.getElementById('tut-overlay'), inert: app.inert, focus: document.activeElement.className }));
  (!st.open && !st.inert && /help-btn/.test(st.focus)) ? ok('walkthrough: Esc closes, focus back on NEED HELP') : bad('walkthrough close ' + JSON.stringify(st));
  // Scratch pad: inert behind, DONE gives focus back.
  await p.evaluate(() => document.querySelector('.scratch-btn').focus());
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  st = await p.evaluate(() => ({ open: !!document.getElementById('scratch-overlay'), inert: app.inert }));
  (st.open && st.inert) ? ok('scratch pad: page behind inert') : bad('scratch open ' + JSON.stringify(st));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  st = await p.evaluate(() => ({ open: !!document.getElementById('scratch-overlay'), inert: app.inert, focus: document.activeElement.className }));
  (!st.open && !st.inert && /scratch-btn/.test(st.focus)) ? ok('scratch pad: Esc closes, focus back on ✏️') : bad('scratch close ' + JSON.stringify(st));
  // Number pad: click digits with the mouse, then Enter on the keyboard submits.
  await p.evaluate(() => { questions = [prepareQuestion({ type: 'typed', text: '20 + 3?', acceptedAnswers: ['23'], why: 'x', hint: 'y' })]; qIdx = 0; tries = 0; locked = false; firstWrong = null; renderQuestion(); keyboardDriving = false; });
  await p.locator('.numpad-key', { hasText: /^2$/ }).click(); await p.locator('.numpad-key', { hasText: /^3$/ }).click();
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  st = await p.evaluate(() => ({ value: document.getElementById('typedInput').value, locked, focus: document.activeElement.className }));
  (st.value === '23' && st.locked) ? ok('number pad: clicked 2, 3, then Enter submits 23') : bad('number pad Enter ' + JSON.stringify(st));
  // Every button is in the Tab order (Safari's default leaves <button>s out).
  await p.evaluate(() => renderHub()); await p.waitForTimeout(50); const untab = await p.evaluate(() => [...document.querySelectorAll('button')].filter(x => !x.hasAttribute('tabindex')).length);
  untab === 0 ? ok('every <button> has an explicit tabindex') : bad(untab + ' buttons without tabindex');
  // The parent link is reachable.
  const pl = await p.evaluate(() => { const l = document.querySelector('.parent-link'); return l.getAttribute('role') + '/' + l.tabIndex; });
  pl === 'button/0' ? ok('parent link is a keyboard button') : bad('parent link ' + pl);
  // Focus lands on the screen after a render, so the arrow keys scroll it.
  const f = await p.evaluate(() => { document.activeElement.blur(); renderHub(); return document.activeElement.id; });
  f === 'app' ? ok('after a render with nothing focused, the screen has focus') : bad('focus after render: ' + f);
  errs.forEach(e => bad('JS error ' + e));
}

// ─── 3. Read to the kindergartener: her hub, the exit pop-up, the round's end ───
async function readToK(b) {
  const p = await (await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__said = []; const real = speakText; window.speakText = (t, e) => { __said.push(speechify(plainText(t))); return real(t, e); }; });
  await p.locator('.profile-card').first().tap(); await p.waitForTimeout(400);
  // With the Brain Buddy module, her first visit asks her to choose a buddy
  // before the hub: tap one, then the big button, spaced like a person.
  if (await p.locator('.buddy-choose').count()) {
    await p.locator('.buddy-tile').first().tap(); await p.waitForTimeout(450);
    await p.locator('.buddy-go').tap(); await p.waitForTimeout(450);
  }
  // The hub reads itself to her first (the buddy's hello, today's missions);
  // each waits for quiet, so let them finish before testing a 🔊 tap.
  for (let last = -1, n; (n = await p.evaluate(() => __said.length)) !== last; last = n) await p.waitForTimeout(1200);
  const n = await p.evaluate(() => [...document.querySelectorAll('.pack-card')].filter(c => c.querySelector('.js-speak')).length + '/' + document.querySelectorAll('.pack-card').length);
  n.split('/')[0] === n.split('/')[1] && +n.split('/')[1] > 0 ? ok('K hub: every pack card has a 🔊 (' + n + ')') : bad('K hub speakers ' + n);
  const card = p.locator('.pack-card').filter({ has: p.locator('.js-speak') }).nth(2);
  await card.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  await p.evaluate(() => { __said.length = 0; });
  await card.locator('.js-speak').tap(); await p.waitForTimeout(300);
  let st = await p.evaluate(() => ({ said: __said.slice(), inRound: !!document.querySelector('.briefing, .question-frame') }));
  (st.said.length === 1 && !st.inRound) ? ok('tap on a card 🔊 reads "' + st.said[0].slice(0, 40) + '…" and does not open it') : bad('card 🔊 tap ' + JSON.stringify(st));
  const box = await card.boundingBox();
  await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.6); await p.waitForTimeout(400);
  st = await p.evaluate(() => !!document.querySelector('.briefing, .question-frame'));
  st ? ok('tap on the middle of the card opens the pack') : bad('tap on card middle did not open the pack');
  // Exit pop-up read to her
  await p.evaluate(() => { const go = document.querySelector('.briefing-go'); if (go) go.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => { __said.length = 0; confirmExit(); });
  await p.waitForTimeout(500);
  st = await p.evaluate(() => ({ btn: !!document.querySelector('#exit-modal-backdrop .js-speak'), said: __said.slice() }));
  (st.btn && st.said.some(s => /stop this round/.test(s))) ? ok('exit pop-up has a 🔊 and is read to her') : bad('exit pop-up ' + JSON.stringify(st));
  await p.evaluate(() => document.getElementById('exit-modal-stay').click());
  // Round complete read to her
  await p.evaluate(() => { __said.length = 0; score = 7; fixedCount = 2; qIdx = questions.length - 1; finishPack(); });
  await p.waitForTimeout(800);
  st = await p.evaluate(() => ({ btn: !!document.querySelector('.complete-rating .js-speak'), said: __said.slice() }));
  (st.btn && st.said.some(s => /done!.*7 out of 10 right on the first try.*fixed 2/i.test(s))) ? ok('round-complete: 🔊 and read: "' + st.said.find(s => /done/i.test(s)).slice(0, 70) + '…"') : bad('complete ' + JSON.stringify(st));
  // Puzzle instructions
  const sq = await p.evaluate(() => { const q = prepareQuestion({ type: 'multi', text: 'Which are fruits?', options: ['apple', 'rock', 'pear', 'cup'], correct: [0, 2] }); return spokenQuestion(q); });
  /Choice 1: .*Then press CHECK\.$/.test(sq) ? ok('pick-all read with numbered choices and "Then press CHECK"') : bad('multi spoken: ' + sq);
  errs.forEach(e => bad('JS error ' + e));
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM });
  for (const [name, fn] of [['speech and answers', speechAndAnswers], ['focus', focus], ['read to the kindergartener', readToK]]) {
    console.log(`\n── ${name} ──`);
    try { await fn(b); } catch (e) { bad(`${name} crashed: ${String(e && e.message || e).split('\n')[0]}`); }
    for (const c of b.contexts()) await c.close();
  }
  await b.close();
  console.log(fails.length ? `\nspeech: FAIL — ${fails.length} of ${passed + fails.length} checks failed`
    : `\nspeech: PASS — ${passed} checks: speech, focus and pop-up rules`);
  process.exit(fails.length ? 1 : 0);
})();
