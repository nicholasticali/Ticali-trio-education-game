// The phonics sounds: every CKLA sound as a recording, played wherever the game says a sound.
//   node sounds.js [app.html]
// 1. data: 45 sounds (CKLA's 44 and /zh/) in CKLA order, each with its notation, key word,
//    spelling, tip and fallback phrase, and a recording that decodes (held sounds about half a
//    second or more, clipped ones short); the sounds page covers each sound once.
// 2. finding sounds: /m/, /th/ as in this, "sss", and "c... a... t..." become recordings; prose
//    ("Wait... what?", "Hmm… let me see…"), "you err", "and/or", fractions and markup do not;
//    speechify is idempotent; every sound the game's text names has a recording; the voice is
//    never handed a respelled sound ("buh", "kuh") or a stretched one ("sss").
// 3. saying words: units, "7 x 5", brackets, exponents, degrees, a ruler's numeral, word parts and names; a lone
//    letter a ("a and r team up") said as a letter, never "uh"; a tapped
//    story word said two ways ("she had read") speaks the reading its story uses.
// 4. speaking: a text with sounds plays speech, recordings, speech, in order; a new screen stops
//    it; a module line waits for it; a sound that cannot play (audio blocked) is named by its key
//    word, never "buh"; the voice preview carries the sounds.
// 5. on screen (iPad and phone, touch): the kindergartener's 🔈 MY SOUNDS card opens the sounds
//    page; a tap plays the sound and opens how to say it; the sister sound; BACK; the K, 1st and
//    2nd grade libraries' 🔈 SOUNDS; the parent dashboard's HEAR ALL 45 SOUNDS and back; a
//    question with sounds gets a row of 🔊 sound buttons that play and never pick an answer; a
//    coach step with a sound gets one too; every target 44 px or more; nothing overflows.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let good = 0; const fails = [];
const ok = (c, m) => { if (c) { good++; console.log('  ok   ' + m); } else { fails.push(m); console.log('  FAIL ' + m); } };

(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM, args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const mk = async (vp) => {
    const ctx = await b.newContext({ viewport: vp, hasTouch: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.type() === 'prompt' ? d.accept('0000') : d.accept());
    // A speech voice that "speaks" for 40 ms a part, so sequences run quickly and in order.
    await p.addInitScript(() => {
      window.__utter = [];
      const ss = window.speechSynthesis;
      let speaking = false;
      Object.defineProperty(ss, 'speaking', { get: () => speaking, configurable: true });
      ss.speak = u => { window.__utter.push(u.text); speaking = true; setTimeout(() => { speaking = false; u.onend && u.onend({}); }, 40); };
      ss.getVoices = () => [];
    });
    await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
    return p;
  };

  // ─── 1-4. data, finding sounds, saying words, speaking ───
  console.log('\n▶ data, finding sounds, saying words, speaking');
  let p = await mk({ width: 1280, height: 800 });
  await p.mouse.click(4, 4);
  const d = await p.evaluate(async () => {
    const out = {};
    out.n = PHONICS_SOUNDS.length;
    out.order = PHONICS_SOUNDS.slice(0, 8).map(s => s.n).join(' ');
    out.fields = PHONICS_SOUNDS.filter(s => !(s.id && s.n && s.key && s.kind && s.spell && s.spell[0] && s.tip && s.fb)).map(s => s.id);
    out.noClip = PHONICS_SOUNDS.filter(s => !PHONICS_CLIPS[s.id]).map(s => s.id);
    const pageIds = SND_UNITS.flatMap(g => g.ids);
    out.pageCover = pageIds.length === PHONICS_SOUNDS.length && PHONICS_SOUNDS.every(s => pageIds.includes(s.id));
    // every recording decodes; held sounds are long, clipped ones short
    const ctx = funAudio(); out.dur = {};
    for (const s of PHONICS_SOUNDS) { try { const b = await sndBuffer(s.id); out.dur[s.id] = Math.round(b.duration * 1000); } catch (e) { out.dur[s.id] = -1; } }
    const show = t => sayPlan(speechify(t)).map(x => x.clip ? '[' + x.clip + ']' : x.speak).join(' | ');
    out.find = {
      blend: show('Blend: c... a... t... What word?'),
      notation: show('The /th/ in this, /th/ as in thin, /oo/ as in look, /oo/ as in soon.'),
      stretched: show('It starts with sss, like a snake.'),
      teams: show('Put these sounds together: /sh/ … /i/ … /p/'),
      qu: show('q... u... i... t'),
      article: show('Listen: /s/… a sock.'),
      prose: show('Wait... what? I see a cat. Hmm… let me see…'),
      pace: ['Blend: c... a... t...', '/k/ … /a/ … /t/', '/k/ /a/ /t/'].map(t => sayPlan(speechify(t)).filter(x => x.clip).map(x => x.tight ? 'tight' : 'pause').join(' ')),
      err: show('you err'), andor: show('and/or 3/4'), markup: show('<svg viewBox="0 0 4 4"><path d="M0 0/s/"/></svg>Hi'),
    };
    out.idem = ['Blend: c... a... t...', 'The /th/ in this', 'sss and mmm', '6 cm by 7 x 5', '/k/ … /a/ … /t/'].every(x => speechify(speechify(x)) === speechify(x));
    out.words = ['The rope is 6 cm long.', '7 x 5 = 35', 'It was 75°F.', 'King Charles I and Henry VIII', 'Add -ly to quick.', 'Call 9-1-1.', '0.3 is read as 3 tenths', 'Anne Arundel County', 'A short a', 'There are 5 in the box.', 'The h and a in have drop out, and a and r team up.', 'It is a dog, at 8 a.m.', 'As long a trip as the short a sound.', 'Add -ion. Use a_e. Striped bass swim.', "The 'ow' in cow, 'ai' in rain, and the word 'cat'.", 'Union starts with u-n-i, and table ends in a-b-l-e.', '2 × (5 + 4), 10³, s − 3 and 5 m².', 'Spelled a, y. Books Read in March. Layers record ancient eruptions, with traces of lead. Close your eyes; the store is close by.']
      .map(sayWords);
    // every sound the game's text names has a recording, and no respelled sound reaches the voice
    const src = [...document.scripts].map(x => x.textContent).join('\n');
    const names = [...new Set([...src.matchAll(/^(?:const|let) ([A-Z][A-Z0-9_]+)\s*=/gm)].map(m => m[1]))].filter(n => !/^(PHONICS_|STICKERS)/.test(n));
    const seen = new Set(); const unknown = new Set(); let strings = 0, withSounds = 0; const respelled = [];
    const walk = (v, dp) => {
      if (dp > 9 || v == null) return;
      if (typeof v === 'string') {
        strings++;
        if (v.length < 2 || /<svg/.test(v)) return;
        const plan = sayPlan(speechify(v));
        if (plan.some(x => x.clip)) withSounds++;
        plan.forEach(x => { if (x.clip && !PHONICS_CLIPS[x.clip]) unknown.add(x.clip);
          if (x.speak && /(?<![-\w])(?:buh|kuh|tuh|puh|duh|guh|juh|kwuh)(?![-\w])/i.test(x.speak) && respelled.length < 5) respelled.push(x.speak.slice(0, 60)); });
        return;
      }
      if (typeof v !== 'object' || seen.has(v)) return; seen.add(v);
      if (Array.isArray(v)) v.forEach(x => walk(x, dp + 1)); else for (const k of Object.keys(v)) walk(v[k], dp + 1);
    };
    for (const nm of names) { try { walk((0, eval)(nm), 0); } catch (e) {} }
    out.scan = { strings, withSounds, unknown: [...unknown], respelled };
    // speaking: speech, recordings, speech, in order
    window.__sayLog = []; window.__sayGapScale = 0.2;
    speakText('Listen: c... a... t... What word is it?');
    for (let i = 0; i < 80 && !__sayLog.some(e => e.ev === 'end'); i++) await new Promise(r => setTimeout(r, 50));
    out.seq = __sayLog.map(e => e.ev === 'clip' ? '[' + e.id + ']' : e.ev === 'speech' ? e.text : e.ev).join(' | ');
    // a new screen stops it
    window.__sayLog = []; speakText('Listen to the sounds: m... a... t... Mat!');
    await new Promise(r => setTimeout(r, 300)); renderProfileSelect();
    const at = __sayLog.length; await new Promise(r => setTimeout(r, 1500));
    out.stopped = __sayLog.length === at && !sayBusy();
    // a module line waits for the whole sequence
    window.__sayLog = []; window.__utter = [];
    speakText('Listen to the sounds: m... a... t... Mat!'); funSay('Hello from the buddy');
    for (let i = 0; i < 100 && __utter.indexOf('Hello from the buddy') < 0; i++) await new Promise(r => setTimeout(r, 50));
    out.queue = __utter.slice();
    // a story word said two ways: its stop says which ("she had read" is red)
    out.tapped = (() => {
      const st = READING_ROAD.lands.flatMap(l => l.stops).find(s => s.say && s.say.read);
      if (!st) return 'no stop says how to read "read"';
      const el = document.createElement('div'); el.innerHTML = readingWordsHtml('She had read it.', new Set(), st.say);
      return [...el.querySelectorAll('.reading-word')].map(b => b.getAttribute('data-word')).join(' ');
    })();
    // the voice preview carries the sounds
    out.preview = sayPlan(speechify(VOICE_SAMPLE)).filter(x => x.clip).map(x => x.clip).join(' ');
    // audio blocked: a single sound is named by its key word
    const c = funAudio(); await c.suspend(); c.resume = () => Promise.resolve();
    HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('blocked', 'NotAllowedError')); };
    window.__sayLog = []; speakText('Say /m/ now.');
    for (let i = 0; i < 80 && !__sayLog.some(e => e.ev === 'end'); i++) await new Promise(r => setTimeout(r, 50));
    out.blocked = __sayLog.filter(e => e.ev === 'fallback' || e.ev === 'speech').map(e => e.text);
    return out;
  });
  ok(d.n === 45, `45 sounds (CKLA's 44 and /zh/): ${d.n}`);
  ok(d.order === '/m/ /a/ /t/ /d/ /o/ /k/ /g/ /i/', 'in the order CKLA teaches them: ' + d.order);
  ok(!d.fields.length, 'every sound has its notation, key word, spelling, tip and fallback phrase' + (d.fields.length ? ': missing ' + d.fields : ''));
  ok(!d.noClip.length, 'every sound has a recording' + (d.noClip.length ? ': missing ' + d.noClip : ''));
  ok(d.pageCover, 'the sounds page lists every sound once');
  const durs = Object.entries(d.dur);
  ok(durs.every(([, ms]) => ms > 0), 'every recording decodes' + (durs.some(([, ms]) => ms <= 0) ? ': ' + durs.filter(([, ms]) => ms <= 0).map(x => x[0]) : ''));
  const held = ['m', 'n', 'ng', 's', 'f', 'sh', 'th', 'z', 'v', 'l', 'a', 'e', 'i', 'o', 'u', 'ee', 'oo'], clipped = ['p', 't', 'k', 'b', 'd', 'g', 'ch', 'h'];
  ok(held.every(k => d.dur[k] >= 450) && clipped.every(k => d.dur[k] <= 250), `held sounds hold (≥450 ms), stop sounds are clipped (≤250 ms): /m/ ${d.dur.m} ms, /b/ ${d.dur.b} ms, /k/ ${d.dur.k} ms`);
  ok(d.find.blend === 'Blend | [k] | [a] | [t] | What word?', 'a blend is its recordings: ' + d.find.blend);
  ok(d.find.notation === 'The | [dh] | in this | [th] | as in thin | [oo2] | as in look | [oo] | as in soon.', '/th/ and /oo/ by their key word: ' + d.find.notation);
  ok(d.find.stretched === 'It starts with | [s] | like a snake.', '"sss" is the /s/ recording: ' + d.find.stretched);
  ok(d.find.teams === 'Put these sounds together | [sh] | [i] | [p]', 'letter teams are one sound: ' + d.find.teams);
  ok(d.find.pace.join(' / ') === 'pause pause pause / pause pause pause / pause tight tight', 'a blend written with pauses is said with pauses; "/k/ /a/ /t/" is said closer together: ' + d.find.pace.join(' / '));
  ok(d.find.article === 'Listen | [s] | a sock.', 'the word a after a sound is not taken for /a/: ' + d.find.article);
  ok(d.find.qu === '[qu] | [i] | [t]', 'qu is one sound-spelling: ' + d.find.qu);
  ok(d.find.prose === 'Wait... what? I see a cat. Hmm… let me see', 'prose with "..." is left alone: ' + d.find.prose);
  ok(d.find.err === 'you err' && d.find.andor === 'and/or 3 fourths' && d.find.markup === 'Hi', '"you err", "and/or", fractions and markup are not sounds');
  ok(d.idem, 'speechify is idempotent');
  ok(!d.scan.unknown.length, `every sound named in the game's text has a recording (${d.scan.withSounds} of ${d.scan.strings} strings play sounds)` + (d.scan.unknown.length ? ': ' + d.scan.unknown : ''));
  ok(!d.scan.respelled.length, 'the voice is never handed a respelled sound ("buh", "kuh")' + (d.scan.respelled.length ? ': ' + d.scan.respelled.join(' / ') : ''));
  const W = d.words;
  ok(W[0] === 'The rope is 6 centimeters long.' && W[1] === '7 times 5 = 35' && W[2] === 'It was 75 degrees Fahrenheit.', 'units, times and degrees: ' + W.slice(0, 3).join(' / '));
  ok(W[3] === 'King Charles the First and Henry the Eighth' && W[4] === 'Add lee to quick.' && W[5] === 'Call 9 1 1.', 'rulers, word parts, 9-1-1: ' + W.slice(3, 6).join(' / '));
  ok(W[6] === '0.3 is red as 3 tenths' && W[7] === 'Ann uh-Rundle County' && W[8] === 'A short A' && W[9] === 'There are 5 in the box.', 'read as, Anne Arundel, short A, and "5 in the" left alone');
  ok(W[10] === 'The h and A in have drop out, and A and r team up.' && W[11] === 'It is a dog, at 8 a.m.', 'a lone letter a is said as a letter, the word a is left alone: ' + W.slice(10, 12).join(' / '));
  ok(W[12] === 'As long a trip as the short A sound.' && W[13] === 'Add shun. Use A, consonant, e. Striped bas swim.', '"long a" as a phrase is left alone; -ion, a_e and striped bass: ' + W.slice(12, 14).join(' / '));
  ok(W[14] === "The 'o, w' in cow, 'A, i' in rain, and the word 'cat'.", 'a spelling in quotes is read as its letters, a quoted word is not: ' + W[14]);
  ok(W[15] === 'Union starts with u, n, i, and table ends in A, b, l, e.', 'a word spelled with hyphens is read letter by letter: ' + W[15]);
  ok(W[16] === '2 × open parenthesis 5 + 4 cloze parenthesis, 10 to the third power, s minus 3 and 5 square meters.', 'brackets around arithmetic, an exponent and a minus after a letter are said: ' + W[16]);
  ok(W[17] === 'Spelled A, y. Books Red in March. Layers rih-cord ancient eruptions, with traces of led. Cloze your eyes; the store is close by.', 'words said two ways, where only one reading fits: ' + W[17]);
  ok(d.tapped === 'She had red it', "a tapped story word said two ways speaks its story's reading: " + d.tapped);
  ok(d.seq === 'say | Listen | [k] | [a] | [t] | What word is it? | end', 'speech, recordings, speech, in order: ' + d.seq);
  ok(d.stopped, 'a new screen stops a sequence of sounds');
  const qi = d.queue.indexOf('Hello from the buddy'), mi = d.queue.indexOf('Mat!');
  ok(mi >= 0 && qi > mi, 'a module line waits until the sequence is over: ' + JSON.stringify(d.queue));
  ok(d.preview === 'm a t', 'the voice preview carries the sounds /m/ /a/ /t/');
  ok(d.blocked.includes('the first sound in mat') && !d.blocked.some(t => /\b(?:muh|mmm)\b/.test(t)), 'audio blocked: the sound is named by its key word: ' + JSON.stringify(d.blocked));
  await p.context().close();

  // ─── 5. on screen ───
  for (const vp of [{ name: 'iPad 820x1180', width: 820, height: 1180 }, { name: 'phone 390x844', width: 390, height: 844 }]) {
    console.log(`\n▶ on screen, ${vp.name}`);
    p = await mk({ width: vp.width, height: vp.height });
    await p.evaluate(() => pickProfile('k')); await p.waitForTimeout(450);
    // Her first visit asks her to choose a buddy before the hub.
    if (await p.locator('.buddy-choose').count()) {
      await p.locator('.buddy-tile').first().tap(); await p.waitForTimeout(450);
      await p.locator('.buddy-go').tap(); await p.waitForTimeout(450);
    }
    const card = p.locator('.snd-hubcard');
    ok(await card.count() === 1, "the kindergartener's hub has a 🔈 MY SOUNDS card");
    ok(await p.evaluate(() => { const c = document.querySelector('.snd-hubcard').getBoundingClientRect(); return document.documentElement.scrollWidth <= innerWidth + 1 && c.right <= innerWidth + 1 && [...document.querySelectorAll('.snd-hubcard *')].every(e => e.getBoundingClientRect().right <= c.right + 1); }),
      'the card fits her hub: nothing in it spills past its edge, the hub does not scroll sideways');
    await card.locator('.reading-hub-go').tap(); await p.waitForTimeout(500);
    ok(await p.locator('.snd-page').count() === 1 && await p.locator('.snd-card').count() === 45, 'HEAR ▶ opens the sounds page with 45 sounds');
    const tags = await p.evaluate(() => [...document.querySelectorAll('.snd-group')].map(g => (g.querySelector('.snd-tag') || {}).textContent || '').join(' | '));
    ok(/IN CLASS NOW/.test(tags), 'the unit class is on is marked: ' + tags.slice(0, 80));
    await p.evaluate(() => { window.__sayLog = []; });
    await p.locator('.snd-card[data-snd="b"]').tap(); await p.waitForTimeout(700);
    const det = await p.evaluate(() => ({ played: (__sayLog || []).filter(e => e.ev === 'clip').map(e => e.id), tip: (document.querySelector('.snd-detail .snd-tip') || {}).textContent || '',
      sis: !!document.querySelector('.snd-detail .snd-act.sis'), sel: !!document.querySelector('.snd-card.sel[data-snd="b"]') }));
    ok(det.played.includes('b') && /No uh after it/.test(det.tip) && det.sis && det.sel, 'a tap on /b/ plays it and opens how to say it, with its sister sound: ' + det.tip.slice(0, 60));
    await p.locator('.snd-detail .snd-act.sis').tap(); await p.waitForTimeout(600);
    ok(await p.evaluate(() => !!document.querySelector('.snd-card.sel[data-snd="p"]') && !!document.querySelector('.snd-detail')), 'the sister sound /p/ opens in its place');
    const small = await p.evaluate(() => [...document.querySelectorAll('.snd-page button, .snd-page [role="button"]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 44 || r.width < 40); }).length);
    const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!small && !over, `every button on the sounds page is 44 px or more, nothing overflows${small ? ' (' + small + ' small)' : ''}`);
    await p.locator('.stk-back').tap(); await p.waitForTimeout(500);
    ok(await p.locator('.snd-hubcard').count() === 1, 'BACK returns to her hub');
    // the libraries
    await p.evaluate(() => renderGrade('1')); await p.waitForTimeout(400);
    ok(await p.locator('.snd-lib-btn').count() === 1, 'the 1st grade library has 🔈 SOUNDS');
    await p.locator('.snd-lib-btn').tap(); await p.waitForTimeout(400);
    ok(await p.locator('.snd-page').count() === 1, 'it opens the sounds page');
    await p.locator('.stk-back').tap(); await p.waitForTimeout(400);
    ok(await p.locator('.hub-library').count() === 1, 'BACK returns to the library');
    await p.evaluate(() => renderGrade('4')); await p.waitForTimeout(300);
    ok(await p.locator('.snd-lib-btn').count() === 0, 'the 4th grade library has none');
    // the parent dashboard
    await p.evaluate(() => { stopSpeech(); renderParentDash(); }); await p.waitForTimeout(400);
    ok(await p.locator('.snd-parent-btn').count() === 1, 'the parent dashboard has HEAR ALL 45 SOUNDS');
    await p.locator('.snd-parent-btn').tap(); await p.waitForTimeout(400);
    ok(await p.locator('.snd-card').count() === 45, 'it opens every sound');
    await p.locator('.stk-back').tap(); await p.waitForTimeout(400);
    ok(await p.locator('.snd-parent-btn').count() === 1, 'BACK returns to the dashboard');
    // a question with sounds gets its row of 🔊 sound buttons
    await p.evaluate(() => {
      pickProfile('k'); const pk = PACKS.k.find(x => x.tier === 'now'); startPack(pk.id); const go = document.querySelector('.briefing-go'); if (go) go.click();
      questions = [prepareQuestion({ type: 'mc', text: 'Put these sounds together: /s/ … /u/ … /n/. What word is it?', options: ['fun', 'sit', 'sun', 'sat'], correct: 2, why: 'x', hint: 'y',
        how: { name: 'Arm Blend', steps: ['Touch your shoulder, elbow, then wrist.', 'Start with a long snake sound: /s/. Then add the next two sounds.'] } })];
      qIdx = 0; renderQuestion();
    });
    await p.waitForTimeout(500);
    const row = await p.evaluate(() => [...document.querySelectorAll('.question-frame .snd-row .snd-btn')].map(x => x.textContent.trim()));
    ok(row[0] === '🔊 /s/ … /u/ … /n/' && row.includes('🔊 /u/'), 'a question with sounds gets a row: ' + row.join(' '));
    await p.evaluate(() => { stopSpeech(); window.__sayLog = []; });
    await p.locator('.question-frame .snd-row .snd-btn').first().tap(); await p.waitForTimeout(3800);
    const tap = await p.evaluate(() => ({ clips: __sayLog.filter(e => e.ev === 'clip').map(e => e.id).join(' '), answered: !!document.querySelector('#fb .next-btn, .choice.correct, .choice.wrong') }));
    ok(/^s u n/.test(tap.clips) && !tap.answered, `the blend button plays /s/ /u/ /n/ and picks no answer: ${tap.clips}`);
    await p.evaluate(() => { openCoach(); }); await p.waitForTimeout(500);
    await p.evaluate(() => coachNext()); await p.waitForTimeout(500);
    ok(await p.locator('#coach-overlay .snd-row .snd-btn').count() === 1, 'a coach step with a sound gets its 🔊 /s/');
    const small2 = await p.evaluate(() => [...document.querySelectorAll('.snd-btn')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 44 || r.width < 40); }).length);
    ok(!small2, 'every 🔊 sound button is 44 px or more');
    await p.context().close();
  }
  await b.close();
  ok(!errs.length, 'no JS errors' + (errs.length ? ': ' + [...new Set(errs)].slice(0, 4).join(' | ') : ''));
  console.log(fails.length ? `\nsounds: FAIL — ${fails.length} of ${good + fails.length} checks failed`
    : `\nsounds: PASS — ${good} checks: 45 CKLA sounds recorded and found in the text, words said right, sequences in order, the sounds page, sound rows`);
  process.exit(fails.length ? 1 : 0);
})();
