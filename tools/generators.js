// The random math generators: every question they make, and its SHOW ME HOW steps.
//
//   node generators.js [app.html]          RUNS=<n> to run each generator n times (300)
//
// 1. Finds the generator section of the game file (withWhy … the end of
//    generateNonMcMathQuestions) and every generator declared in it.
// 2. Loads the game in Chromium and runs every generator 300 times. Each
//    question must carry how = { name: 1-5 words, steps: 2-4 strings }; the last
//    step starts "Now" (and only the last); steps fit the child's word limit
//    (kindergarten 18, 2nd grade 26, 4th grade 32); kindergarten steps have no
//    symbols the voice cannot say; no step is HTML or says undefined/NaN. The
//    answer (multiple choice key / first accepted answer) never appears as a
//    whole number or word in the name or a step unless the question text has it
//    too. True/false: no step says only one of "true"/"false", and for a sum,
//    product or place-value statement the real value is never said unless the
//    statement says it.
// 3. generateMathQuestions / generateNonMcMathQuestions still return full rounds
//    (10 and 5) for every generated pack id, and the page logs no errors.
// Exits non-zero on any failure.
const fs = require('fs');
const path = require('path');

const APP = path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const RUNS = Number(process.env.RUNS) || 300;

const LIMIT = { k: 18, g2: 26, g4: 32 };
const gradeOf = name => /^prek/.test(name) ? 'k' : /^g2/.test(name) ? 'g2' : /^g4/.test(name) ? 'g4' : null;
const words = s => String(s).trim().split(/\s+/).filter(Boolean).length;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// `ans` as a whole number or word: not inside a longer number (6 in 16, 6/8,
// 0.6, 4:30) or word. Case-insensitive.
function says(text, ans) {
  const a = String(ans).trim();
  if (!a) return false;
  return new RegExp(`(?<![0-9A-Za-z])(?<![0-9][.,:/])${esc(a)}(?![0-9A-Za-z])(?![.,:/][0-9])`, 'i').test(String(text));
}
// The value a true/false math statement is about, when it has one.
function realValue(st) {
  let m;
  if ((m = st.match(/^(\d+) \+ (\d+) = (\d+)$/))) return +m[1] + +m[2];
  if ((m = st.match(/^(\d+) × (\d+) = (\d+)$/))) return +m[1] * +m[2];
  if ((m = st.match(/^(\d+) hundreds \+ (\d+) tens \+ (\d+) ones equals (\d+)\.$/))) return 100 * m[1] + 10 * m[2] + +m[3];
  return null;
}

// Every problem with one generated question, as strings.
function checkQuestion(gen, q) {
  const errs = [];
  const grade = gradeOf(gen);
  const h = q && q.how;
  const qText = q.type === 'tf' ? q.statement : q.text;
  if (!h || typeof h !== 'object') return ['no how'];
  if (typeof h.name !== 'string' || words(h.name) < 1 || words(h.name) > 5) errs.push(`name "${h.name}" is not 1-5 words`);
  if (!Array.isArray(h.steps) || h.steps.length < 2 || h.steps.length > 4) return errs.concat(`${h.steps && h.steps.length} steps (2-4)`);
  h.steps.forEach((s, i) => {
    const n = i + 1, last = i === h.steps.length - 1;
    if (typeof s !== 'string' || !s.trim()) { errs.push(`step ${n} is empty or not a string`); return; }
    if (last && !/^Now\b/.test(s)) errs.push(`last step does not start with "Now": ${s}`);
    if (!last && /^Now\b/.test(s)) errs.push(`step ${n} starts with "Now" but is not the last: ${s}`);
    if (words(s) > LIMIT[grade]) errs.push(`step ${n} is ${words(s)} words (limit ${LIMIT[grade]}): ${s}`);
    if (/[<>]/.test(s)) errs.push(`step ${n} has < or >: ${s}`);
    if (/undefined|NaN|null|\[object/.test(s)) errs.push(`step ${n} is broken: ${s}`);
    if (grade === 'k' && (/[×÷\/()<>+=−–*%$¢]/.test(s) || /\s-\s/.test(s))) errs.push(`kindergarten step ${n} has a symbol: ${s}`);
  });
  // Never the answer.
  let key = null;
  if (q.type === 'tf') {
    h.steps.forEach((s, i) => {
      if (/\btrue\b/i.test(s) !== /\bfalse\b/i.test(s)) errs.push(`step ${i + 1} gives a verdict: ${s}`);
    });
    const real = realValue(q.statement);
    if (real !== null) key = String(real);
  } else if (Array.isArray(q.options)) key = q.options[q.correct];
  else if (Array.isArray(q.acceptedAnswers)) key = q.acceptedAnswers[0];
  else errs.push('no answer key to check against');
  if (key !== null && key !== undefined && !says(qText, key)) {
    if (says(h.name, key)) errs.push(`name says the answer "${key}": ${h.name}`);
    h.steps.forEach((s, i) => { if (says(s, key)) errs.push(`step ${i + 1} says the answer "${key}": ${s}`); });
  }
  return errs;
}

// The generator section of the app: withWhy … the end of generateNonMcMathQuestions.
function sectionBounds(html) {
  const start = html.indexOf('function withWhy(q, why, hint, how)');
  const fn = html.indexOf('function generateNonMcMathQuestions(');
  const end = fn < 0 ? -1 : html.indexOf('\n}\n', fn) + 3;
  if (start < 0 || fn < 0 || end < 3) throw new Error('generator section not found in ' + APP);
  return [start, end];
}

async function main() {
  const { chromium } = require('playwright');
  const failures = [];
  const html = fs.readFileSync(APP, 'utf8');

  // Generator names declared in the generator section (prek*, g2*, g4* with no arguments).
  const [s0, e0] = sectionBounds(html);
  const declared = [...html.slice(s0, e0).matchAll(/^function ((?:prek|g2|g4)[A-Z]\w*)\(\)/gm)].map(m => m[1]);
  console.log(`${path.basename(APP)}: ${declared.length} generators declared in the generator section`);

  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));
  await page.goto('file://' + APP);
  await page.waitForFunction(() => typeof generateNonMcMathQuestions === 'function');

  const res = await page.evaluate(({ declared, RUNS }) => {
    const out = { gens: {}, rounds: [], errors: [] };
    const fns = new Map();
    for (const reg of [MATH_GENERATORS, NONMC_MATH_GENERATORS])
      for (const list of Object.values(reg)) for (const f of list || []) fns.set(f.name, f);
    for (const name of declared) {
      if (!fns.has(name)) {
        try { fns.set(name, eval(name)); } catch (e) { out.errors.push(`${name}: ${e.message}`); }
      }
    }
    for (const [name, f] of fns) {
      const qs = [];
      for (let i = 0; i < RUNS; i++) {
        try { qs.push(f()); } catch (e) { out.errors.push(`${name} threw: ${e.message}`); break; }
      }
      out.gens[name] = qs;
    }
    // Full rounds for every generated pack.
    const ids = new Set([...Object.keys(MATH_GENERATORS), ...Object.keys(NONMC_MATH_GENERATORS)]);
    for (const id of ids) {
      const mcGens = MATH_GENERATORS[id], nonGens = NONMC_MATH_GENERATORS[id];
      for (let r = 0; r < 25; r++) {
        const mc = generateMathQuestions(id, 10), non = generateNonMcMathQuestions(id, 5);
        out.rounds.push({ id, r, mc: mc.length, non: non.length,
          mcWant: mcGens && mcGens.length ? 10 : 0, nonWant: nonGens && nonGens.length ? 5 : 0,
          noHow: [...mc, ...non].filter(q => !q.how).length });
      }
    }
    return out;
  }, { declared, RUNS });

  failures.push(...res.errors);
  for (const name of declared) if (!res.gens[name]) failures.push(`${name} was not run`);
  let questions = 0, withSteps = 0;
  const perGen = [];
  for (const [name, qs] of Object.entries(res.gens)) {
    if (!gradeOf(name)) { failures.push(`${name}: cannot tell which grade it is for`); continue; }
    const seen = new Map();
    for (const q of qs) {
      questions++;
      const errs = checkQuestion(name, q);
      if (!errs.length) withSteps++;
      for (const e of errs) if (!seen.has(e)) seen.set(e, q.type === 'tf' ? q.statement : q.text);
    }
    if (qs.length < RUNS) failures.push(`${name}: only ${qs.length}/${RUNS} questions`);
    [...seen].slice(0, 5).forEach(([e, t]) => failures.push(`${name} [${String(t).replace(/<[^>]+>/g, ' ').slice(0, 60)}]: ${e}`));
    perGen.push(`${name} (${gradeOf(name)}): ${new Set(qs.map(q => q.how && q.how.name)).size} method(s), ${seen.size ? seen.size + ' problem(s)' : 'ok'}`);
  }
  const short = res.rounds.filter(r => r.mc !== r.mcWant || r.non !== r.nonWant);
  short.slice(0, 10).forEach(r => failures.push(`pack ${r.id}: round ${r.r} gave ${r.mc}/${r.mcWant} multiple choice and ${r.non}/${r.nonWant} other`));
  const noHow = res.rounds.reduce((n, r) => n + r.noHow, 0);
  if (noHow) failures.push(`${noHow} round questions have no how`);
  pageErrors.forEach(e => failures.push('page error: ' + e));
  await browser.close();

  perGen.forEach(l => console.log('  ' + l));
  const packs = new Set(res.rounds.map(r => r.id)).size;
  console.log(`generators: ${Object.keys(res.gens).length} run ${RUNS} times each; ${questions} questions, ${withSteps} pass every check`);
  console.log(`rounds: ${packs} pack ids x 25 rounds, ${short.length} short, ${noHow} questions without how; page errors: ${pageErrors.length}`);
  failures.slice(0, 80).forEach(f => console.log('FAIL ' + f));
  if (failures.length > 80) console.log(`... and ${failures.length - 80} more`);
  console.log(failures.length ? `generators: FAIL — ${failures.length} problems`
    : `generators: PASS — ${Object.keys(res.gens).length} generators, ${questions} questions, ${packs} packs, 0 page errors`);
  process.exit(failures.length ? 1 : 0);
}

module.exports = { checkQuestion, says, sectionBounds };
if (require.main === module) main().catch(e => { console.error(e); console.log('generators: FAIL — ' + e.message); process.exit(1); });
