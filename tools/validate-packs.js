// Mechanical gate for every generated question bank. The LLM reviewers catch
// meaning; this catches shape. Anything that would throw at runtime, mark a
// correct child wrong, or render as a broken card is a hard failure here.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = process.argv[2] || require('path').join(__dirname, 'question-banks');

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
let hardFail = 0, softFail = 0, totalQ = 0;
const report = [];

function norm(s) {
  return String(s).toLowerCase().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

for (const file of files) {
  const full = path.join(DIR, file);
  const src = fs.readFileSync(full, 'utf8');
  const name = file.replace(/\.js$/, '');
  const errs = [], warns = [];

  // 1. Does it parse, and does it define exactly the expected constant?
  let bank;
  try {
    const ctx = { module: {}, exports: {} };
    vm.createContext(ctx);
    vm.runInContext(src + `\n;globalThis.__out = typeof ${name} !== 'undefined' ? ${name} : null;`, ctx, { timeout: 5000 });
    bank = ctx.__out;
  } catch (e) {
    report.push({ name, errs: [`DOES NOT PARSE / wrong constant name: ${e.message}`], warns: [], n: 0 });
    hardFail++;
    continue;
  }
  if (!Array.isArray(bank)) {
    report.push({ name, errs: [`const ${name} is not an array`], warns: [], n: 0 });
    hardFail++;
    continue;
  }

  totalQ += bank.length;
  if (bank.length < 28) warns.push(`only ${bank.length} questions (target 28-34)`);

  const seen = new Map();
  const correctIdxHistogram = [0, 0, 0, 0];

  bank.forEach((q, i) => {
    const at = `#${i + 1}`;
    const type = q.type || 'mc';
    const label = norm(q.text || q.statement || (q.partA && q.partA.text) || '(no text)').slice(0, 60);

    if (!['mc', 'tf', 'typed', 'fib', 'showwork', 'order', 'sort', 'multi', 'twopart'].includes(type)) {
      errs.push(`${at} unknown type "${type}"`);
      return;
    }

    // Duplicate detection. A reading pack legitimately reuses a stem like
    // "What is the lesson of this fable?" across several different fables,
    // so the passage is part of the item's identity.
    const key = type + '|' + norm(q.text || q.statement || (q.partA && q.partA.text)) + '|' + norm(q.passage || '');
    if (seen.has(key)) errs.push(`${at} duplicates ${seen.get(key)}: "${label}"`);
    else seen.set(key, at);

    if (type === 'mc') {
      if (!Array.isArray(q.options)) { errs.push(`${at} mc with no options: "${label}"`); return; }
      if (q.options.length !== 4) errs.push(`${at} mc has ${q.options.length} options, must be 4: "${label}"`);
      if (typeof q.correct !== 'number' || !Number.isInteger(q.correct)) {
        errs.push(`${at} mc correct is not an integer: "${label}"`);
      } else if (q.correct < 0 || q.correct >= q.options.length) {
        errs.push(`${at} mc correct=${q.correct} out of range (${q.options.length} options): "${label}"`);
      } else if (q.correct < 4) {
        correctIdxHistogram[q.correct]++;
      }
      // Two identical options make the item unanswerable. Compare
      // case-SENSITIVELY: a kindergarten capitalisation question asks which
      // of "i love my dog." / "I love my dog." is right, and those options
      // are supposed to differ only in case.
      const optNorm = q.options.map(norm);
      const optExact = q.options.map(o => String(o).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      if (new Set(optExact).size !== optExact.length) errs.push(`${at} mc has duplicate options: "${label}"`);
      if (optNorm.some(o => o === '')) errs.push(`${at} mc has an empty option: "${label}"`);
      if (!q.text) errs.push(`${at} mc has no text`);
      // "All of the above" style options break under the runtime shuffle.
      if (optNorm.some(o => /\ball of the above\b|\bnone of the above\b|\bboth a and b\b/.test(o))) {
        errs.push(`${at} mc uses an "of the above" option, which breaks under answer shuffling: "${label}"`);
      }
    }

    if (type === 'tf') {
      if (typeof q.statement !== 'string' || !q.statement.trim()) errs.push(`${at} tf has no statement`);
      if (typeof q.answer !== 'boolean') errs.push(`${at} tf answer is not a boolean: "${label}"`);
    }

    if (type === 'typed' || type === 'fib' || type === 'showwork') {
      if (!q.text) errs.push(`${at} ${type} has no text`);
      if (!Array.isArray(q.acceptedAnswers) || q.acceptedAnswers.length === 0) {
        errs.push(`${at} ${type} has no acceptedAnswers: "${label}"`);
      } else {
        q.acceptedAnswers.forEach(a => {
          const s = String(a);
          if (!s.trim()) errs.push(`${at} ${type} has an empty acceptedAnswer: "${label}"`);
          // The app lowercases and trims; an answer that differs only by case
          // is dead weight, and emoji can never be typed on an iPad keyboard.
          if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s)) {
            errs.push(`${at} acceptedAnswer contains emoji, which cannot be typed: "${s}"`);
          }
          if (s !== s.trim()) warns.push(`${at} acceptedAnswer has stray whitespace: "${s}"`);
        });
        // Case-insensitive duplicates inside acceptedAnswers.
        // The app already lowercases before comparing, so a list containing
        // both 'Q' and 'q' is redundant but harmless — only flag it when the
        // redundancy is large enough to suggest the list was padded.
        const lowered = q.acceptedAnswers.map(a => String(a).toLowerCase().trim().replace(/\s+/g, ' '));
        if (q.acceptedAnswers.length >= 4 && new Set(lowered).size <= q.acceptedAnswers.length / 2) {
          warns.push(`${at} acceptedAnswers is mostly case-only duplicates: "${label}"`);
        }
      }
      // The number pad keys off the FIRST accepted answer, which the format
      // contract says must be the bare numeral. If a numeric question lists
      // the word form first, the child gets a QWERTY keyboard instead of a
      // keypad for what is plainly a number question.
      const all = (q.acceptedAnswers || []).map(a => String(a).trim());
      const isNum = a => /^[0-9.,:/$%\- ]+$/.test(a) && /[0-9]/.test(a);
      if (all.length && !isNum(all[0]) && all.some(isNum)) {
        warns.push(`${at} lists a word before the numeral, so the number pad will not appear: ${JSON.stringify(all)}`);
      }
    }

    // Puzzle types (put in order, sort, pick all, answer-then-prove).
    if (type === 'order') {
      if (!Array.isArray(q.items) || q.items.length < 3) errs.push(`${at} order needs 3+ items, listed in the correct order`);
      else if (new Set(q.items.map(norm)).size !== q.items.length) errs.push(`${at} order has duplicate items`);
    }
    if (type === 'sort') {
      const g = q.groups || [];
      if (g.length < 2) errs.push(`${at} sort needs 2+ groups`);
      (q.items || []).forEach((it, j) => { if (!it || !Number.isInteger(it.g) || it.g < 0 || it.g >= g.length) errs.push(`${at} sort item ${j} points at no group`); });
      g.forEach((lab, gi) => { if (!(q.items || []).some(it => it && it.g === gi)) errs.push(`${at} sort group "${lab}" is empty`); });
    }
    if (type === 'multi') {
      const o = q.options || [], c = q.correct || [];
      if (o.length < 4) errs.push(`${at} multi needs 4+ options`);
      if (!Array.isArray(c) || c.length < 2 || new Set(c).size !== c.length || c.some(x => !Number.isInteger(x) || x < 0 || x >= o.length)) errs.push(`${at} multi correct must be 2+ distinct option indices`);
      if (new Set(o.map(x => String(x).trim())).size !== o.length) errs.push(`${at} multi has duplicate options`);
    }
    if (type === 'twopart') {
      for (const part of ['partA', 'partB']) {
        const pt = q[part];
        if (!pt || !Array.isArray(pt.options) || pt.options.length !== 4) errs.push(`${at} ${part} needs exactly 4 options`);
        else if (!Number.isInteger(pt.correct) || pt.correct < 0 || pt.correct > 3) errs.push(`${at} ${part} correct out of range`);
        else if (new Set(pt.options.map(x => String(x).trim())).size !== 4) errs.push(`${at} ${part} has duplicate options`);
      }
    }

    // Every question explains itself after it is answered; every one the
    // child can retry has a hint for the second try.
    if (!q.why) warns.push(`${at} has no why (the HERE'S WHY panel will be empty)`);
    if (!q.hint && !['tf', 'twopart'].includes(type)) warns.push(`${at} has no hint (the second try will use a generic one)`);
    for (const f of ['why', 'hint']) {
      if (q[f] && /\b(option|choice|answer)\s+[A-D]\b|\b[A-D]\)/.test(q[f])) errs.push(`${at} ${f} names an option by letter, but options are shuffled`);
    }

    // A passage that mentions a figure the child cannot see.
    const body = norm((q.text || '') + ' ' + (q.statement || ''));
    if (/\b(in the picture|shown below|the diagram|the image above|see the figure|pictured here)\b/.test(body)) {
      errs.push(`${at} refers to a picture or diagram that does not exist: "${label}"`);
    }

    // Unbalanced HTML in a passage renders as garbage.
    if (q.passage) {
      const open = (q.passage.match(/<(p|strong|em|ul|li|ol)\b/g) || []).length;
      const close = (q.passage.match(/<\/(p|strong|em|ul|li|ol)>/g) || []).length;
      if (open !== close) warns.push(`${at} passage has ${open} opening and ${close} closing tags`);
    }
  });

  // A bank where the key sits in the same slot almost every time signals
  // the author was not actually varying it.
  const mcTotal = correctIdxHistogram.reduce((a, b) => a + b, 0);
  if (mcTotal >= 8) {
    const max = Math.max(...correctIdxHistogram);
    if (max / mcTotal > 0.6) {
      warns.push(`answer key is lopsided: ${correctIdxHistogram.join('/')} across ${mcTotal} mc items`);
    }
  }

  if (errs.length) hardFail++;
  else if (warns.length) softFail++;
  report.push({ name, errs, warns, n: bank.length });
}

console.log(`\nChecked ${files.length} banks, ${totalQ} questions total\n`);
for (const r of report) {
  if (!r.errs.length && !r.warns.length) { console.log(`  OK    ${r.name} (${r.n})`); continue; }
  console.log(`  ${r.errs.length ? 'FAIL' : 'warn'}  ${r.name} (${r.n})`);
  r.errs.forEach(e => console.log(`          ERROR ${e}`));
  r.warns.forEach(w => console.log(`          warn  ${w}`));
}
console.log(`\n${hardFail} banks with errors, ${softFail} with warnings only, ${files.length - hardFail - softFail} clean\n`);
process.exit(hardFail ? 1 : 0);
