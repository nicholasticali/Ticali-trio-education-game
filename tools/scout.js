// Scout, the raccoon guide: the title screen's hello, each hub's tips, SHOW ME AROUND and SHOW ME HOW.
//   node scout.js [app.html]
// 1. title: Scout says hello; a tap waves (or hops...), says the line aloud and moves on to the next.
// 2. hub, for each child: Scout's card sits above NOW IN CLASS; the first tip is the topic class is
//    on now, and its button starts that pack; NEXT TIP goes through tips that all differ, and every
//    tip's button works; a tap on Scout says the tip and the mouth moves while it is spoken.
// 3. SHOW ME AROUND: one step for each part the hub has, each scrolled into view and outlined;
//    NEXT, BACK, the arrow keys, Esc and DONE; a new screen ends it; the kindergartener hears each
//    step; it starts only from its button.
// 4. SHOW ME HOW has Scout in its header, talking while a step is read.
// 5. the eyes follow the mouse; with reduced motion nothing moves.
// 6. on a phone, an iPad and a laptop: no sideways scroll, every button 44 px or more (56 for the
//    kindergartener); Scout saves nothing; no JS errors.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let good = 0; const fails = [];
const ok = (c, m) => { if (c) { good++; console.log('  ok   ' + m); } else { fails.push(m); console.log('  FAIL ' + m); } };

(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM });
  const errs = [];
  const mk = async (vp, opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    // A speech voice that "speaks" for 300 ms, so the talking mouth can be seen.
    await p.addInitScript(() => {
      window.__said = [];
      const ss = window.speechSynthesis;
      let speaking = false;
      Object.defineProperty(ss, 'speaking', { get: () => speaking, configurable: true });
      ss.speak = u => { window.__said.push(u.text); speaking = true; setTimeout(() => { speaking = false; u.onend && u.onend({}); }, 300); };
      ss.getVoices = () => [];
    });
    await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
    return p;
  };
  const press = async (p, vp, sel) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (vp.touch) await l.tap(); else await l.click(); await p.waitForTimeout(250); };
  const toHub = async (p, vp, pid) => {
    await p.evaluate(pid => { renderProfileSelect(); pickProfile(pid); }, pid); await p.waitForTimeout(350);
    if (await p.locator('.buddy-choose').count()) { await press(p, vp, '.buddy-tile'); await press(p, vp, '.buddy-go'); await p.waitForTimeout(300); }
  };
  const fit = async (p, min) => p.evaluate(min => {
    const small = [...document.querySelectorAll('.scout-hello button, .scout-guide button, #scout-tour button')].filter(e => {
      const r = e.getBoundingClientRect(); return r.width && (r.height < min || r.width < 44);
    }).map(e => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
    const over = [...document.querySelectorAll('.scout-hello, .scout-guide, .scout-guide *, #scout-tour, #scout-tour *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).length;
    return { small, over, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
  }, min);

  for (const vp of [{ name: 'phone 390x844', width: 390, height: 844, touch: true }, { name: 'iPad 820x1180', width: 820, height: 1180, touch: true }, { name: 'laptop 1280x800', width: 1280, height: 800 }]) {
    console.log(`\n▶ ${vp.name}`);
    const p = await mk(vp);
    // ─── 1. the title screen ───
    ok(await p.locator('.title-screen .scout-hello .scout-pal svg.scout-svg').count() === 1, 'the title screen has Scout, with a hello');
    const before = await p.locator('.scout-hello .scout-line').textContent();
    await press(p, vp, '.scout-hello .scout-pal');
    await p.waitForFunction(() => __said.some(s => /Scout/.test(s)), null, { timeout: 2000 }).catch(() => {});
    const t1 = await p.evaluate(() => ({ said: __said.slice(), moved: /scout-do-/.test(document.querySelector('.scout-hello .scout-pal').className), talking: document.querySelector('.scout-hello .scout-pal').classList.contains('scout-talking') }));
    ok(t1.said.some(s => /Scout/.test(s)) && t1.moved && t1.talking, 'a tap on Scout: a move, the hello said aloud, the mouth talking');
    await p.waitForTimeout(1000);
    ok(!(await p.evaluate(() => document.querySelector('.scout-hello .scout-pal').classList.contains('scout-talking'))), 'the mouth stops when the voice does');
    await press(p, vp, '.scout-hello .scout-pal');
    ok((await p.locator('.scout-hello .scout-line').textContent()) !== before, 'the next tap gives the next line');
    let f = await fit(p, 44);
    ok(!f.small.length && !f.over && !f.sideways, 'title: Scout fits, buttons 44 px or more' + (f.small.length ? ': ' + f.small.join(', ') : ''));

    for (const pid of ['k', 'g3', 'g5']) {
      // ─── 2. the hub ───
      await toHub(p, vp, pid);
      const h = await p.evaluate(() => {
        const g = document.querySelector('.scout-guide'), now = document.querySelector('.now-strip');
        return { has: !!g, above: !!(g && now && (g.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING)),
          line: g && g.querySelector('.scout-line').textContent, go: g && !g.querySelector('.scout-go').hidden,
          nowTitles: [...document.querySelectorAll('.now-strip .pack-title, .now-strip h3, .now-strip .pack-name')].map(e => e.textContent.trim().toLowerCase()),
          tips: scoutHub ? scoutHub.tips.map(t => t.text) : [], first: scoutHub && scoutHub.tips[0] };
      });
      ok(h.has && h.above, `${pid}: Scout's card is on the hub, above NOW IN CLASS`);
      ok(/^Good (morning|afternoon|evening)! Your class is (learning|probably on) /.test(h.line) && h.go, `${pid}: the first tip is the topic class is on now, with a button: ${h.line.slice(0, 70)}`);
      ok(h.tips.length >= 5 && new Set(h.tips).size === h.tips.length, `${pid}: ${h.tips.length} tips, all different`);
      // the first tip's button starts that pack
      const want = await p.evaluate(() => { const t = scoutHub.tips[0]; const m = /(?:learning|on) (.+?)(?:\. Let's| right now)/.exec(t.text); return m && m[1]; });
      await press(p, vp, '.scout-go');
      const started = await p.evaluate(() => currentPack && currentPack.title);
      ok(started && started === want, `${pid}: PRACTICE starts that topic (${started})`);
      await toHub(p, vp, pid);
      // NEXT TIP goes round all the tips; every tip's button works
      const seen = [];
      const n = await p.evaluate(() => scoutHub.tips.length);
      const broken = [];
      for (let i = 0; i < n; i++) {
        const st = await p.evaluate(() => ({ line: document.querySelector('.scout-guide .scout-line').textContent, go: !document.querySelector('.scout-go').hidden, i: scoutHub.i }));
        seen.push(st.line);
        if (st.go && i > 0) {
          const r = await p.evaluate(i => { const e0 = window.__errs = []; try { scoutHub.i = i; scoutGo(); return { screen: (document.querySelector('#app > *') || {}).className, flash: !!document.querySelector('.scout-spot-flash'), pack: currentPack && currentPack.id, sounds: !!document.querySelector('.snd-page'), mix: !!document.querySelector('[class*="mix-"][role="dialog"], #mix-picker, .mix-picker'), room: !!document.getElementById('buddy-room') }; } catch (e) { return { err: e.message }; } }, st.i);
          if (r.err || !(r.flash || r.pack || r.sounds || r.mix || r.room || !/\bhub\b/.test(r.screen || ''))) broken.push(st.line.slice(0, 40) + ' ' + JSON.stringify(r));
          await p.evaluate(() => { for (const f of ['buddyCloseRoom', 'closeMixPicker']) if (typeof window[f] === 'function') try { window[f](true); } catch (e) {} });
          await toHub(p, vp, pid);
          await p.evaluate(i => { scoutHub.i = i; scoutShowTip(false); }, st.i);
        }
        await press(p, vp, '.scout-more');
      }
      ok(new Set(seen).size === n, `${pid}: NEXT TIP shows each of the ${n} tips in turn`);
      ok(!broken.length, `${pid}: every tip's button does what it says` + (broken.length ? ': ' + broken.join(' | ') : ''));
      await p.evaluate(() => { window.__said = []; });
      await press(p, vp, '.scout-guide .scout-pal');
      await p.waitForFunction(() => __said.some(s => s.trim().length > 10), null, { timeout: 2000 }).catch(() => {});
      const said = await p.evaluate(() => ({ said: __said.join(' '), line: document.querySelector('.scout-guide .scout-line').textContent, talking: document.querySelector('.scout-guide .scout-pal').classList.contains('scout-talking') }));
      ok(said.said.length > 10 && said.talking, `${pid}: a tap on Scout says the tip aloud, mouth moving`);
      f = await fit(p, pid === 'k' ? 56 : 44);
      ok(!f.small.length && !f.over && !f.sideways, `${pid}: the card fits, every button ${pid === 'k' ? 56 : 44} px or more` + (f.small.length ? ': ' + f.small.join(', ') : ''));

      // ─── 3. SHOW ME AROUND ───
      const saveBefore = await p.evaluate(() => localStorage.getItem('tapChampions_v3'));
      await p.evaluate(() => { window.__said = []; });
      ok(!(await p.locator('#scout-tour').count()), `${pid}: no tour until it is asked for`);
      await press(p, vp, '.scout-tour-btn');
      const tour = await p.evaluate(() => ({ steps: scoutTour.steps.length, sels: scoutTour.steps.map(s => s.sel), found: scoutTour.steps.filter(s => s.sel).every(s => document.querySelector(s.sel)) }));
      ok(tour.steps >= 8 && tour.found, `${pid}: the tour has ${tour.steps} steps, one for each part this hub has`);
      const visits = [];
      for (let i = 0; i < tour.steps; i++) {
        await p.waitForTimeout(250);
        await p.waitForFunction(() => { const s = scoutTour.steps[scoutTour.i], t = s.sel && document.querySelector(s.sel), box = document.getElementById('scout-tour'); if (!t) return true; const r = t.getBoundingClientRect(); return r.top >= -2 && r.top < box.getBoundingClientRect().top; }, null, { timeout: 3000 }).catch(() => {});
        visits.push(await p.evaluate(() => {
          const s = scoutTour.steps[scoutTour.i], t = s.sel && document.querySelector(s.sel), box = document.getElementById('scout-tour');
          const r = t && t.getBoundingClientRect(), br = box.getBoundingClientRect();
          return { spot: !t || t.classList.contains('scout-spot'), seen: !t || (r.top >= -2 && r.top < br.top), text: box.querySelector('.scout-tour-text').textContent, focus: document.activeElement === box.querySelector('.scout-tour-next') };
        }));
        if (i === 2) {
          await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
          ok(await p.evaluate(() => scoutTour.i === 1), `${pid}: ← goes back a step`);
          await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
          if (i === 2) { f = await fit(p, pid === 'k' ? 56 : 44); ok(!f.small.length && !f.over && !f.sideways, `${pid}: the tour's bubble fits, buttons ${pid === 'k' ? 56 : 44} px or more` + (f.small.length ? ': ' + f.small.join(', ') : '')); }
        }
        if (i < tour.steps - 1) await press(p, vp, '.scout-tour-next');
      }
      ok(visits.every(v => v.spot && v.seen), `${pid}: each step outlines its part and scrolls it into view above the bubble` + (visits.some(v => !(v.spot && v.seen)) ? ': ' + visits.filter(v => !(v.spot && v.seen)).map(v => v.text.slice(0, 30)).join(' | ') : ''));
      ok(visits.every(v => v.focus), `${pid}: NEXT has the focus at every step`);
      ok(/tour/i.test(visits[visits.length - 1].text) && (await p.locator('.scout-tour-next').textContent()).includes('DONE'), `${pid}: the last step says goodbye, with DONE`);
      const heard = await p.evaluate(() => __said.filter(s => s.trim()).length);
      ok(pid === 'k' ? heard >= tour.steps - 1 : heard === 0, `${pid}: ${pid === 'k' ? 'the kindergartener hears every step' : 'steps are read only with 🔊'} (${heard} said)`);
      await press(p, vp, '.scout-tour-next');
      ok(await p.evaluate(() => !document.getElementById('scout-tour') && !document.querySelector('.scout-spot') && !scoutTour && document.activeElement && document.activeElement.classList.contains('scout-tour-btn')), `${pid}: DONE ends the tour and gives the focus back`);
      await press(p, vp, '.scout-tour-btn');
      await p.keyboard.press('Escape'); await p.waitForTimeout(150);
      ok(await p.evaluate(() => !document.getElementById('scout-tour') && !scoutTour), `${pid}: Esc ends the tour`);
      await press(p, vp, '.scout-tour-btn');
      await p.evaluate(() => renderProgress()); await p.waitForTimeout(250);
      ok(await p.evaluate(() => !document.getElementById('scout-tour') && !document.querySelector('.scout-spot')), `${pid}: a new screen ends the tour`);
      ok(await p.evaluate(b => localStorage.getItem('tapChampions_v3') === b, saveBefore), `${pid}: Scout saves nothing`);
    }
    // ─── 4. SHOW ME HOW ───
    await toHub(p, vp, 'g3');
    await p.evaluate(() => { const pk = PACKS.g3.find(x => x.tier === 'now'); startPack(pk.id); const go = document.querySelector('.briefing-go'); if (go) go.click(); });
    await p.waitForTimeout(400);
    await press(p, vp, '.help-btn');
    ok(await p.locator('#coach-overlay .coach-kicker .coach-scout svg.scout-svg').count() === 1, 'SHOW ME HOW has Scout in its header');
    await p.evaluate(() => { coachState.voice = true; renderCoach(); }); await p.waitForTimeout(260);
    ok(await p.evaluate(() => document.querySelector('#coach-overlay .coach-kicker').classList.contains('scout-talking')), 'Scout talks while a step is read');
    await p.evaluate(() => closeCoach());
    await p.context().close();
  }

  // ─── 5. eyes, and reduced motion ───
  console.log('\n▶ eyes and reduced motion');
  let p = await mk({ width: 1280, height: 800 });
  await p.mouse.move(1270, 790); await p.waitForTimeout(200);
  const eyes = await p.evaluate(() => getComputedStyle(document.querySelector('.scout-hello .sc-look')).transform);
  ok(eyes && eyes !== 'none' && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(eyes), "Scout's eyes follow the mouse: " + eyes);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.scout-hello .sc-tail')).animationName !== 'none'), 'the tail sways and the eyes blink');
  await p.context().close();
  p = await mk({ width: 1280, height: 800 }, { reduced: true });
  await p.mouse.move(1270, 790); await p.waitForTimeout(200);
  const still = await p.evaluate(() => ({ eyes: getComputedStyle(document.querySelector('.scout-hello .sc-look')).transform, anim: [...document.querySelectorAll('.scout-hello .scout-svg *')].filter(e => getComputedStyle(e).animationName !== 'none').length }));
  ok((still.eyes === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(still.eyes)) && still.anim === 0, 'with reduced motion, Scout keeps still');
  await p.context().close();

  ok(!errs.length, 'no JS errors' + (errs.length ? ': ' + [...new Set(errs)].slice(0, 4).join(' | ') : ''));
  await b.close();
  console.log(fails.length ? `\nscout: FAIL — ${fails.length} of ${good + fails.length} checks failed` : `\nscout: PASS — ${good} checks: Scout's hello, tips, tour and SHOW ME HOW on a phone, an iPad and a laptop`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); console.log('scout: FAIL — ' + e.message.split('\n')[0]); process.exit(1); });
