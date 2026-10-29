// Every pack in every profile must hand back a full round of ten well-formed
// questions. A pack that silently returns [] shows the child an alert and
// bounces them to the hub, which is exactly the failure a smoke test that
// only opens the first pack would miss.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || require('path').join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(APP);
  await page.waitForTimeout(300);

  const out = await page.evaluate(() => {
    const rows = [];
    for (const profileId of Object.keys(PACKS)) {
      for (const pack of PACKS[profileId]) {
        let qs = [], err = null, firstLen = 0;
        // The Reading Road is one hidden pack whose round is the stop being
        // played: check every stop's round, not only the child's current one.
        const road = pack.tier === 'road' && typeof readingRoad === 'function';
        try {
          if (road) {
            const was = pack._readingStop;
            const sizes = readingRoad().stops.map(s => {
              pack._readingStop = s.id;
              const r = getQuestions(pack, profileId) || [];
              qs.push(...r);
              return r.length;
            });
            pack._readingStop = was;
            firstLen = sizes.length ? Math.min(...sizes) : 0;
          } else {
          qs = getQuestions(pack, profileId) || [];
          firstLen = qs.length;
          // Further rounds only add coverage for the why check below.
          for (let r = 0; r < 5 && qs.length; r++) qs.push(...getQuestions(pack, profileId).slice(0, 10));
          }
        }
        catch (e) { err = e.message; }
        const problems = [];
        if (err) problems.push('threw: ' + err);
        if (!err && firstLen === 0) problems.push('returned 0 questions');
        else if (!err && firstLen < 10) problems.push('returned only ' + firstLen + ' questions');
        qs.forEach((q, i) => {
          const t = q.type || 'mc';
          if (t === 'mc') {
            // Bank questions have four choices. Reading Road items follow the
            // road's own rule (2-6, checked by reading/readcheck.js): "which
            // sound changed? first, middle, last" has three.
            const nOk = road ? n => n >= 2 && n <= 6 : n => n === 4;
            if (!Array.isArray(q.options) || !nOk(q.options.length)) problems.push(`q${i+1} mc has ${q.options ? q.options.length : 'no'} options`);
            if (typeof q.correct !== 'number' || q.correct < 0 || q.correct >= (q.options || []).length) problems.push(`q${i+1} mc correct index ${q.correct} invalid`);
          } else if (t === 'tf') {
            if (typeof q.answer !== 'boolean') problems.push(`q${i+1} tf answer not boolean`);
            if (!q.statement) problems.push(`q${i+1} tf no statement`);
          } else if (t === 'typed' || t === 'fib' || t === 'showwork') {
            if (!Array.isArray(q.acceptedAnswers) || !q.acceptedAnswers.length) problems.push(`q${i+1} ${t} no acceptedAnswers`);
            if (!q.text) problems.push(`q${i+1} ${t} no text`);
          } else if (t === 'order') {
            if (!Array.isArray(q.items) || q.items.length < 3) problems.push(`q${i+1} order needs 3+ items`);
            if (!Array.isArray(q._shuffle) || q._shuffle.length !== (q.items || []).length) problems.push(`q${i+1} order was not shuffled for the round`);
          } else if (t === 'sort') {
            if (!Array.isArray(q.groups) || q.groups.length < 2) problems.push(`q${i+1} sort needs 2+ groups`);
            if (!Array.isArray(q.items) || q.items.some(it => !Number.isInteger(it.g) || it.g < 0 || it.g >= q.groups.length)) problems.push(`q${i+1} sort item points at no group`);
          } else if (t === 'multi') {
            if (!Array.isArray(q.options) || !Array.isArray(q.correct) || q.correct.length < 2 || q.correct.some(c => c < 0 || c >= q.options.length)) problems.push(`q${i+1} multi correct invalid`);
          } else if (t === 'twopart') {
            for (const part of [q.partA, q.partB]) if (!part || !Array.isArray(part.options) || part.options.length !== 4 || part.correct < 0 || part.correct > 3) problems.push(`q${i+1} twopart part malformed`);
          } else {
            problems.push(`q${i+1} unknown type "${t}"`);
          }
          if (!q.why) problems.push(`q${i+1} (${t}) has no why`);
        });
        rows.push({ profileId, id: pack.id, title: pack.title, tier: pack.tier, subject: pack.subject, n: qs.length, problems });
      }
    }
    // Also surface any pack pointing at a bank that does not exist.
    const orphans = [];
    for (const profileId of Object.keys(PACKS)) {
      for (const pack of PACKS[profileId]) {
        for (const key of PACK_BANK_KEYS) {
          if (pack[key] && !BANKS[pack[key]]) orphans.push(`${profileId}/${pack.id} -> missing bank ${pack[key]}`);
        }
      }
    }
    // Every pack needs its WHY THIS MATTERS line.
    const noWhy = [];
    for (const profileId of Object.keys(PACKS)) for (const pack of PACKS[profileId]) {
      if (!PACK_WHY[pack.id + ':' + profileId] && !PACK_WHY[pack.id]) noWhy.push(`${profileId}/${pack.id}`);
    }
    return { rows, orphans, noWhy, bankCount: Object.keys(BANKS).length,
             thinkPacks: Object.keys(THINK_ITEMS).length,
             thinkItems: Object.values(THINK_ITEMS).reduce((a, x) => a + x.length, 0) };
  });

  await browser.close();

  const bad = out.rows.filter(r => r.problems.length);
  const byProfile = {};
  out.rows.forEach(r => { byProfile[r.profileId] = (byProfile[r.profileId] || 0) + 1; });

  console.log(`\n${out.bankCount} banks registered`);
  console.log('packs per profile: ' + Object.entries(byProfile).map(([k, v]) => `${k}=${v}`).join('  '));
  const tiers = {};
  out.rows.forEach(r => { const k = r.profileId + '/' + r.tier; tiers[k] = (tiers[k] || 0) + 1; });
  console.log('by tier: ' + Object.entries(tiers).sort().map(([k, v]) => `${k}=${v}`).join('  '));

  console.log(`puzzle items: ${out.thinkItems} across ${out.thinkPacks} packs`);
  if (out.noWhy.length) {
    console.log(`\nPACKS WITH NO "WHY THIS MATTERS" (${out.noWhy.length}):`);
    out.noWhy.forEach(o => console.log('  ' + o));
  }
  if (out.orphans.length) {
    console.log(`\nPACKS POINTING AT A MISSING BANK (${out.orphans.length}):`);
    out.orphans.forEach(o => console.log('  ' + o));
  }
  if (errors.length) { console.log('\nJS ERRORS:'); errors.forEach(e => console.log('  ' + e)); }

  console.log(`\n${bad.length} of ${out.rows.length} packs have problems:`);
  bad.forEach(r => {
    console.log(`  ${r.profileId}/${r.id} "${r.title}" (${r.n} qs)`);
    [...new Set(r.problems)].slice(0, 6).forEach(p => console.log(`      ${p}`));
  });
  if (!bad.length) console.log('  none — every pack returns a full, well-formed round.');
  const failed = bad.length || out.orphans.length || out.noWhy.length || errors.length;
  console.log(failed ? `packcheck: FAIL — ${bad.length} packs with problems, ${out.orphans.length} pointing at a missing bank, ${out.noWhy.length} without a why, ${errors.length} JS errors`
    : `packcheck: PASS — all ${out.rows.length} packs return a full, well-formed round`);
  process.exit(failed ? 1 : 0);
})();
