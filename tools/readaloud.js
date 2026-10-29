// Read-aloud on every kindergarten and 1st grade question.
//   node readaloud.js [app.html]
// On an iPad (820×1180, touch), every written question of every pack the
// kindergartener has, and of every K and 1st grade pack for the 3rd and 5th
// graders exploring those grades, is rendered for that child: each bank's
// questions, each reading passage's, and the pack's puzzles (lib/written.js),
// plus a dealt round of each pack (five for generated math) for the questions
// no bank holds. So is every item of every Reading Road stop in a K or 1st
// grade land, for each child. Each must have a 🔊 for the question, for every
// answer with words in it, for every order piece and sort item, for each sort
// group, and for the story when there is one. Fails on any missing 🔊 or a JS
// error.
const { chromium } = require('playwright');
const path = require('path');
const written = require('./lib/written');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const n = x => x.toLocaleString('en-US');
(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM });
  const p = await (await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.evaluate(written.install);
  const out = await p.evaluate(() => {
    const res = {};
    // Render one question as the child sees it and list each 🔊 it lacks.
    const inspect = (q0, where, missing) => {
      const q = q0._prepared ? q0 : prepareQuestion(JSON.parse(JSON.stringify(q0)));
      questions = [q]; qIdx = 0; renderQuestion();
      const f = document.querySelector('.question-frame');
      const t = q.type || 'mc';
      const need = [];
      if (!f) { missing.push(where + ' ' + t + ': no question on screen'); return; }
      if (!f.querySelector('.question-with-voice .js-speak, .twopart .js-speak, .question-text ~ .js-speak') && !f.querySelector('.js-speak')) need.push('question');
      f.querySelectorAll('.choice:not(.part-choice[data-part="B"]), .tf-btn').forEach(c => { const txt = (c.querySelector('.choice-content') || c).textContent; if (!c.querySelector('.js-speak') && speechify(txt)) need.push('choice "' + c.textContent.trim().replace(/\s+/g, ' ').slice(0, 15) + '"'); });
      f.querySelectorAll('.order-item').forEach(c => { if (!c.parentElement.querySelector('.js-speak')) need.push('piece'); });
      f.querySelectorAll('.sort-item').forEach(c => { if (!c.querySelector('.js-speak')) need.push('sort item'); });
      if (t === 'sort' && f.querySelectorAll('.sort-legend .js-speak').length !== q.groups.length) need.push('sort groups');
      if (q.passage && !f.querySelector('.passage .js-speak')) need.push('passage');
      if (need.length) missing.push(where + ' ' + t + ': ' + need.join(', '));
    };
    const begin = id => { startPack(id); const go = document.querySelector('.briefing-go'); if (go) go.click(); };
    for (const [pid, grades] of [['k', null], ['g3', ['K', '1']], ['g5', ['K', '1']]]) {
      pickProfile(pid);
      const packs = grades ? allPacks().filter(pk => grades.includes(pk.grade)) : PACKS.k;
      const r = { packs: packs.length, written: 0, dealt: 0, roadStops: 0, road: 0, rendered: 0, missing: [] };
      const seen = new Set();
      for (const pk of packs) {
        begin(pk.id);
        for (const { q, src } of ttWritten(pk)) { seen.add(src); inspect(q, pk.id, r.missing); r.rendered++; }
        for (let k = 0; k < (pk.generated ? 5 : 1); k++) {
          for (const q of getQuestions(pk, pk.home || pid)) { inspect(q, pk.id, r.missing); r.dealt++; r.rendered++; }
        }
      }
      r.written = seen.size;
      // The Reading Road's K and 1st grade lands, played as readingPlay() sets them up.
      const road = PACKS[pid].find(pk => pk.id === 'reading_road');
      if (road) {
        const keep = road.grade;
        for (const { stop, land, items } of ttRoadItems(pid)) {
          if (!land.early) continue;
          r.roadStops++;
          road.grade = land.range[0] === 0 ? 'K' : String(land.range[0]);
          road._readingStop = stop.id;
          begin('reading_road');
          for (const q of items) { inspect(q, 'road ' + stop.id, r.missing); r.road++; r.rendered++; }
        }
        road.grade = keep; delete road._readingStop;
      }
      exitToHub();
      res[pid] = r;
    }
    return res;
  });
  await b.close();
  let bad = 0, rendered = 0;
  for (const [pid, r] of Object.entries(out)) {
    rendered += r.rendered; bad += r.missing.length;
    console.log(`${pid}: ${r.packs} packs, ${r.written} written questions, ${r.dealt} dealt, ${r.road} Reading Road items in ${r.roadStops} K/1st grade stops; ${r.missing.length} missing a 🔊`);
    r.missing.slice(0, 10).forEach(m => console.log('  FAIL ' + m));
  }
  errs.slice(0, 5).forEach(e => console.log('FAIL JS error ' + e));
  const ok = !bad && !errs.length;
  const k = out.k;
  console.log(ok ? `readaloud: PASS — a 🔊 on all ${n(rendered)} K and 1st grade questions shown and their answers (${n(k.written)} written ones, ${k.road} Reading Road items)`
    : `readaloud: FAIL — ${bad} questions missing a 🔊, ${errs.length} JS errors`);
  process.exit(ok ? 0 : 1);
})();
