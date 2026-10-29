#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// READING ROAD — content checker
//
//   node modules/readcheck.js                READING_ROAD in the game file
//   node modules/readcheck.js app.html       READING_ROAD in that file
//   node modules/readcheck.js DIR            every <land-id>.json in a folder
//   node modules/readcheck.js a.json b.json  just these land files
//   --no-samples                             in a folder, skip _*.json
//
// The game file is the repo's Ticali_Trio_Family_Edition.html, or $TT_APP.
// Its road is the READING_ROAD const in the reading-data module, read from
// the file without running the app. A land file is one land as it is written
// before it goes into READING_ROAD: the same object plus an "order" number
// for its place on the road (in READING_ROAD the list's order is the road's).
//
// Prints one line per problem:  ERROR|WARN  land › stop › where: message
// then one result line, and exits 1 if there is any ERROR. The rules:
//   • shape and required fields (land, stop, learn card, story, items)
//   • 1-3 learn cards, each with 3-5 example words
//   • 5-7 practice items of at least 3 types
//   • a stop with a story has ≥ 3 questions: ≥ 1 literal, ≥ 1 sequence
//     (an `order` item or skill "sequence") or cause/effect, ≥ 1 inference;
//     from grade 2 up also ≥ 1 vocabulary item and ≥ 1 two-part evidence item
//   • why + hint + how {name, steps} on every practice item and question
//   • word limits for early readers (K and 1st grade lands)
//   • DECODABLE: every `show` word and every word of a mode:"read" story
//     (title and pages) must, lower-cased, be
//       – in this stop's or an earlier stop's taught words (the learn cards'
//         "words" and the optional stop "words" list), or
//       – in the Tricky Words taught so far ("tricky"), or
//       – segmentable left-to-right into the spellings taught so far
//         ("code"; a split spelling such as "a_e" covers cake = c·a_e·k).
//     "code" and "tricky" are given per stop (cumulative) and/or per land
//     (what was taught before the land). A land may say "code": "*" when the
//     whole code has been taught (grades 4-5); that is refused for K and 1st
//     grade lands. Undecodable words are ERRORs.
//     The check is by spelling. Phonics is judged by SOUND, so a reviewer
//     still reads every story aloud (for example "is" spells /z/ with s).
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const TYPES = new Set(['mc', 'tf', 'typed', 'fib', 'order', 'sort', 'multi', 'twopart']);
const SKILLS = new Set(['literal', 'sequence', 'cause', 'inference', 'vocab', 'evidence', 'other']);
const MODES = new Set(['listen', 'read']);
const CONSONANT = /^[bcdfghjklmnpqrstvwxyz]$/;

// Word limits for children still learning to read.
const LIMITS = {
  K: { read: 12, listen: 20, learn: 20, text: 20, option: 8, show: 3, pages: 8 },
  1: { read: 18, listen: 25, learn: 20, text: 24, option: 10, show: 3, pages: 8 },
};

// ─── Grades ───
// "K", "1" … "5", or a span such as "2-3", "4-5", "K-1".
function gradeRange(g) {
  if (typeof g !== 'string') return null;
  const num = s => (s === 'K' || s === 'k') ? 0 : (/^[1-5]$/.test(s) ? Number(s) : NaN);
  const m = g.trim().match(/^([Kk1-5])(?:\s*-\s*([Kk1-5]))?$/);
  if (!m) return null;
  const a = num(m[1]), b = m[2] ? num(m[2]) : a;
  if (isNaN(a) || isNaN(b) || b < a) return null;
  return [a, b];
}
function limitsFor(range) {
  if (!range) return null;
  if (range[0] === 0) return LIMITS.K;
  if (range[0] === 1) return LIMITS[1];
  return null;
}

// ─── Text helpers ───
const isStr = s => typeof s === 'string' && s.trim().length > 0;
const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
const strip = s => String(s == null ? '' : s).replace(/<[^>]+>/g, ' ');

// Words as a reader meets them: split on spaces and dashes, trim the
// punctuation around each word, drop apostrophes (Sam's → sams), lower-case.
function wordsOf(text) {
  const out = [];
  for (const raw of strip(text).split(/[\s—–\-\/]+/)) {
    const core = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!core || !/\p{L}/u.test(core)) continue;   // numerals and symbols are not decoded
    out.push(core.toLowerCase().replace(/['’‘]/g, ''));
  }
  return out;
}
const countWords = text => strip(text).split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

// Sentence ends: . ! ? (plus any closing quote) followed by the end of the
// text or a new sentence starting with a capital or an opening quote. A
// dialogue tag ("Hi!" said Tam.) is one sentence, and Mr./Dr. are not ends.
function countSentences(text) {
  const t = strip(text).replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Mt)\./g, '$1').trim();
  if (!t) return 0;
  const ends = t.match(/[.!?]+["'”’)]*(?=\s+["'“‘(]?[\p{Lu}\p{N}]|\s*$)/gu) || [];
  return Math.max(1, ends.length);
}

// ─── Decoding ───
// Can `word` be spelled left to right with the taught spellings? Split
// spellings ("a_e") claim the e after one or two consonants; the claimed
// letters are skipped when the walk reaches them.
function makeDecoder(code) {
  const simple = [], split = [];
  for (const c of code) {
    const s = String(c).toLowerCase().trim();
    if (!s) continue;
    if (s.includes('_')) {
      const [h, t] = s.split('_');
      if (h && t) split.push([h, t]);
    } else simple.push(s);
  }
  simple.sort((a, b) => b.length - a.length);
  return function canDecode(w) {
    const memo = new Map();
    const go = (i, claimed) => {
      while (claimed.has(i)) i++;
      if (i >= w.length) return true;
      const key = i + '|' + [...claimed].filter(p => p > i).sort((a, b) => a - b).join(',');
      if (memo.has(key)) return memo.get(key);
      let ok = false;
      for (const s of simple) {
        if (!w.startsWith(s, i)) continue;
        let clash = false;
        for (let k = i; k < i + s.length; k++) if (claimed.has(k)) clash = true;
        if (!clash && go(i + s.length, claimed)) { ok = true; break; }
      }
      if (!ok) {
        for (const [h, t] of split) {
          if (!w.startsWith(h, i)) continue;
          for (let gap = 1; gap <= 2 && !ok; gap++) {
            const j = i + h.length + gap;
            let cons = true;
            for (let k = i + h.length; k < j; k++) if (!CONSONANT.test(w[k] || '')) cons = false;
            if (!cons || !w.startsWith(t, j)) continue;
            const next = new Set(claimed);
            for (let k = j; k < j + t.length; k++) next.add(k);
            if (go(i + h.length, next)) ok = true;
          }
          if (ok) break;
        }
      }
      memo.set(key, ok);
      return ok;
    };
    return go(0, new Set());
  };
}

// ─── The checker ───
function checkLand(land, file, seen) {
  const out = [];
  const where = (stop, at) => [file, stop, at].filter(Boolean).join(' › ');
  const err = (stop, at, msg) => out.push({ level: 'ERROR', where: where(stop, at), msg });
  const warn = (stop, at, msg) => out.push({ level: 'WARN', where: where(stop, at), msg });
  seen = seen || { lands: new Map(), stops: new Map(), orders: new Map() };

  if (!isObj(land)) { err('', '', 'the file is not a JSON object'); return out; }
  if (typeof land.order !== 'number' || !isFinite(land.order)) err('', 'order', '"order" must be a number (it sets the land\'s place on the road)');
  else if (seen.orders.has(land.order)) err('', 'order', `order ${land.order} is also used by ${seen.orders.get(land.order)}`);
  else seen.orders.set(land.order, file);
  for (const f of ['id', 'title', 'icon', 'blurb']) if (!isStr(land[f])) err('', f, `land "${f}" is missing`);
  if (isStr(land.id)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(land.id)) err('', 'id', `land id "${land.id}" should be lower-case letters, digits and dashes`);
    if (seen.lands.has(land.id)) err('', 'id', `land id "${land.id}" is also used in ${seen.lands.get(land.id)}`);
    else seen.lands.set(land.id, file);
  }
  const range = gradeRange(land.grade);
  if (!range) err('', 'grade', `grade "${land.grade}" must be K, 1-5 or a span like "2-3"`);
  const lim = limitsFor(range);
  const early = !!lim;
  if (!/^#[0-9a-f]{6}$/i.test(String(land.color || ''))) err('', 'color', 'color must be a #rrggbb colour');
  if (land.decor !== undefined && !(Array.isArray(land.decor) && land.decor.every(isStr))) err('', 'decor', 'decor must be a list of emoji');
  if (land.code !== undefined && land.code !== '*' && !(Array.isArray(land.code) && land.code.every(isStr))) err('', 'code', 'land code must be a list of spellings or "*"');
  if (land.code === '*' && early) err('', 'code', '"code": "*" turns the decodability check off; K and 1st grade lands must list the taught spellings');
  if (land.tricky !== undefined && !(Array.isArray(land.tricky) && land.tricky.every(isStr))) err('', 'tricky', 'land tricky must be a list of words');
  if (!Array.isArray(land.stops) || !land.stops.length) { err('', 'stops', 'a land needs at least one stop'); return out; }

  // What has been taught so far, growing stop by stop.
  let code = Array.isArray(land.code) ? land.code.slice() : [];
  let allCode = land.code === '*';
  const tricky = new Set((Array.isArray(land.tricky) ? land.tricky : []).map(w => String(w).toLowerCase()));
  const taught = new Set();
  let prevStopCode = null;

  land.stops.forEach((stop, si) => {
    const sid = (stop && isStr(stop.id)) ? stop.id : `stops[${si}]`;
    if (!isObj(stop)) { err(sid, '', 'a stop must be an object'); return; }
    for (const f of ['id', 'title', 'icon', 'why']) if (!isStr(stop[f])) err(sid, f, `stop "${f}" is missing`);
    if (isStr(stop.id)) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(stop.id)) err(sid, 'id', 'stop id should be lower-case letters, digits and dashes');
      if (seen.stops.has(stop.id)) err(sid, 'id', `stop id "${stop.id}" is also used in ${seen.stops.get(stop.id)}`);
      else seen.stops.set(stop.id, file);
    }
    if (stop.sayTitle !== undefined && !isStr(stop.sayTitle)) err(sid, 'sayTitle', 'sayTitle must be text');

    // The code taught so far.
    if (stop.code === '*') {
      if (early) err(sid, 'code', '"code": "*" is not allowed in a K or 1st grade land');
      allCode = true;
    } else if (stop.code !== undefined) {
      if (!Array.isArray(stop.code) || !stop.code.every(isStr)) err(sid, 'code', 'code must be a list of spellings');
      else {
        if (prevStopCode) {
          const missing = prevStopCode.filter(c => !stop.code.includes(c));
          if (missing.length) warn(sid, 'code', `code should list every spelling taught so far; missing ${missing.join(', ')}`);
        }
        prevStopCode = stop.code.slice();
        code = code.concat(stop.code);
      }
    }
    if (stop.tricky !== undefined) {
      if (!Array.isArray(stop.tricky) || !stop.tricky.every(isStr)) err(sid, 'tricky', 'tricky must be a list of words');
      else stop.tricky.forEach(w => tricky.add(String(w).toLowerCase()));
    }
    if (stop.words !== undefined) {
      if (!Array.isArray(stop.words) || !stop.words.every(isStr)) err(sid, 'words', 'words must be a list of words');
      else stop.words.forEach(w => wordsOf(w).forEach(x => taught.add(x)));
    }
    const decode = makeDecoder(code);
    if (early && !allCode && !code.length) warn(sid, 'code', 'no taught spellings listed yet ("code")');

    // Learn cards.
    if (!Array.isArray(stop.learn) || stop.learn.length < 1 || stop.learn.length > 3) err(sid, 'learn', 'a stop needs 1-3 learn cards');
    (Array.isArray(stop.learn) ? stop.learn : []).forEach((c, ci) => {
      const at = `learn[${ci}]`;
      if (!isObj(c)) { err(sid, at, 'a learn card must be an object'); return; }
      for (const f of ['big', 'emoji', 'text']) if (!isStr(c[f])) err(sid, at, `learn card "${f}" is missing`);
      if (c.say !== undefined && !isStr(c.say)) err(sid, at, 'say must be text');
      if (!Array.isArray(c.words) || c.words.length < 3 || c.words.length > 5 || !c.words.every(isStr)) err(sid, at, 'a learn card needs 3-5 example words');
      if (isStr(c.text)) {
        const n = countWords(c.text);
        if (lim && n > lim.learn) err(sid, at, `learn text is ${n} words; early readers get at most ${lim.learn}`);
        else if (!lim && n > 30) warn(sid, at, `learn text is ${n} words; keep it to one line`);
      }
      stoppy(sid, at, c.say);
      (Array.isArray(c.words) ? c.words : []).forEach(w => {
        wordsOf(w).forEach(x => {
          taught.add(x);
          if (early && !allCode && !decode(x) && !tricky.has(x)) warn(sid, at, `example word "${w}" uses a spelling not taught yet; it now counts as taught for decoding`);
        });
      });
    });

    const checkDecodable = (text, at) => {
      if (allCode) return;
      const bad = [];
      for (const w of wordsOf(text)) {
        if (taught.has(w) || tricky.has(w) || decode(w)) continue;
        if (!bad.includes(w)) bad.push(w);
      }
      if (bad.length) {
        err(sid, at, `not decodable yet: ${bad.map(w => '"' + w + '"').join(', ')} ` +
          `(taught code: ${code.length ? [...new Set(code)].join(' ') : 'none'}; Tricky Words: ${tricky.size ? [...tricky].join(' ') : 'none'})`);
      }
    };

    // Story.
    const story = stop.story;
    if (story === undefined || story === null) warn(sid, 'story', 'this stop has no story');
    else if (!isObj(story)) err(sid, 'story', 'story must be an object');
    else {
      if (!MODES.has(story.mode)) err(sid, 'story.mode', 'story mode must be "listen" or "read"');
      if (!isStr(story.title)) err(sid, 'story.title', 'story title is missing');
      const maxPages = lim ? lim.pages : 10;
      if (!Array.isArray(story.pages) || !story.pages.length || story.pages.length > maxPages || !story.pages.every(isStr)) {
        err(sid, 'story.pages', `a story needs 1-${maxPages} pages of text`);
      }
      const pages = Array.isArray(story.pages) ? story.pages.filter(isStr) : [];
      pages.forEach((p, pi) => {
        const at = `story page ${pi + 1}`;
        const s = countSentences(p), n = countWords(p);
        if (s > 3) err(sid, at, `${s} sentences; a page has one to three`);
        if (lim) {
          const max = story.mode === 'read' ? lim.read : lim.listen;
          if (n > max) err(sid, at, `${n} words; a ${story.mode} page for early readers has at most ${max}`);
        } else if (n > 60) warn(sid, at, `${n} words; long for one page`);
        if (story.mode === 'read') checkDecodable(p, at);
      });
      if (story.mode === 'read' && isStr(story.title)) checkDecodable(story.title, 'story title');
      if (story.tricky !== undefined) {
        if (!Array.isArray(story.tricky) || !story.tricky.every(isStr)) err(sid, 'story.tricky', 'story tricky must be a list of words');
        else story.tricky.forEach(w => { if (!tricky.has(String(w).toLowerCase())) err(sid, 'story.tricky', `"${w}" is not a Tricky Word taught by this stop`); });
      }
      if (story.art !== undefined && !(Array.isArray(story.art) && story.art.length === pages.length && story.art.every(a => typeof a === 'string'))) {
        err(sid, 'story.art', 'art must have one emoji string per page');
      }
    }

    // Items.
    const practice = Array.isArray(stop.practice) ? stop.practice : [];
    const questions = Array.isArray(stop.questions) ? stop.questions : [];
    if (!Array.isArray(stop.practice)) err(sid, 'practice', 'practice is missing');
    else if (practice.length < 5 || practice.length > 7) err(sid, 'practice', `${practice.length} practice items; a stop has 5-7`);
    const ptypes = new Set(practice.filter(isObj).map(q => q.type || 'mc'));
    if (practice.length && ptypes.size < 3) err(sid, 'practice', `practice uses ${ptypes.size} item type(s); use at least 3`);
    practice.forEach((q, qi) => checkItem(q, `practice[${qi}]`, false));
    if (stop.questions !== undefined && !Array.isArray(stop.questions)) err(sid, 'questions', 'questions must be a list');
    questions.forEach((q, qi) => checkItem(q, `questions[${qi}]`, true));

    if (isObj(story)) {
      if (questions.length < 3) err(sid, 'questions', `${questions.length} story questions; a stop with a story needs at least 3`);
      const sk = questions.filter(isObj).map(q => ({ skill: q.skill, type: q.type || 'mc' }));
      if (!sk.some(q => q.skill === 'literal')) err(sid, 'questions', 'needs a literal question (skill "literal": who / what / where)');
      if (!sk.some(q => q.skill === 'sequence' || q.skill === 'cause' || q.type === 'order')) err(sid, 'questions', 'needs a sequence (order of events) or cause/effect question');
      if (!sk.some(q => q.skill === 'inference')) err(sid, 'questions', 'needs an inference / why question (skill "inference")');
      if (range && range[0] >= 2) {
        if (!sk.some(q => q.skill === 'vocab')) err(sid, 'questions', 'grade 2 and up: needs a vocabulary-in-context question (skill "vocab")');
        if (!sk.some(q => q.type === 'twopart')) err(sid, 'questions', 'grade 2 and up: needs a twopart text-evidence question');
        else if (!sk.some(q => q.type === 'twopart' && q.skill === 'evidence')) warn(sid, 'questions', 'the twopart item should have skill "evidence"');
      }
    }

    function checkItem(q, at, isQuestion) {
      if (!isObj(q)) { err(sid, at, 'an item must be an object'); return; }
      const t = q.type || 'mc';
      if (!TYPES.has(t)) { err(sid, at, `type "${q.type}" is not one the engine plays (${[...TYPES].join(', ')})`); return; }
      if (!isStr(q.why)) err(sid, at, 'why is missing');
      if (!isStr(q.hint)) err(sid, at, 'hint is missing');
      if (!isObj(q.how) || !isStr(q.how.name) || !Array.isArray(q.how.steps) || q.how.steps.length < 2 || !q.how.steps.every(isStr)) {
        err(sid, at, 'how needs a name and at least 2 coach steps');
      }
      if (isQuestion && !SKILLS.has(q.skill)) err(sid, at, `skill must be one of ${[...SKILLS].join(', ')}`);
      if (!isQuestion && q.skill !== undefined && !SKILLS.has(q.skill)) err(sid, at, `skill "${q.skill}" is not known`);
      if (q.sayText !== undefined && !isStr(q.sayText)) err(sid, at, 'sayText must be text');
      if (q.say !== undefined && (!isObj(q.say) || !Object.values(q.say).every(isStr))) err(sid, at, 'say must map shown text to spoken text');
      if (q.show !== undefined) {
        if (!isStr(q.show)) err(sid, at, 'show must be text');
        else {
          if (lim && countWords(q.show) > lim.show) err(sid, at, `show card is ${countWords(q.show)} words; at most ${lim.show} for early readers`);
          checkDecodable(q.show, at + ' show');
        }
      }
      const opts = (list, label) => {
        if (!Array.isArray(list) || list.length < 2 || list.length > 6 || !list.every(o => typeof o === 'string' && o.trim())) {
          err(sid, at, `${label} needs 2-6 text choices`); return false;
        }
        if (new Set(list).size !== list.length) err(sid, at, `${label} has the same choice twice`);
        if (lim) list.forEach(o => { if (countWords(o) > lim.option) err(sid, at, `choice "${o}" is ${countWords(o)} words; at most ${lim.option} for early readers`); });
        return true;
      };
      const shown = [];
      const textField = t === 'tf' ? 'statement' : 'text';
      if (t !== 'twopart') {
        if (!isStr(q[textField])) err(sid, at, `${textField} is missing`);
        else if (lim && countWords(q[textField]) > lim.text) err(sid, at, `${textField} is ${countWords(q[textField])} words; at most ${lim.text} for early readers`);
      }
      if (t === 'mc') {
        if (opts(q.options, 'options')) {
          shown.push(...q.options);
          if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) err(sid, at, 'correct must be the index of a choice');
        }
      } else if (t === 'multi') {
        if (opts(q.options, 'options')) {
          shown.push(...q.options);
          const c = q.correct;
          if (!Array.isArray(c) || c.length < 2 || c.length >= q.options.length || new Set(c).size !== c.length ||
              !c.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length)) {
            err(sid, at, 'correct must list 2 or more choice indexes (not all of them)');
          }
        }
      } else if (t === 'tf') {
        if (typeof q.answer !== 'boolean') err(sid, at, 'answer must be true or false');
      } else if (t === 'typed' || t === 'fib') {
        if (!Array.isArray(q.acceptedAnswers) || !q.acceptedAnswers.length || !q.acceptedAnswers.every(isStr)) err(sid, at, 'acceptedAnswers needs at least one answer');
      } else if (t === 'order') {
        if (!Array.isArray(q.items) || q.items.length < 2 || q.items.length > 8 || !q.items.every(isStr)) err(sid, at, 'items needs 2-8 pieces');
        else {
          if (new Set(q.items).size !== q.items.length) err(sid, at, 'two pieces are the same; the engine checks positions, so the child could not tell them apart');
          if (lim) q.items.forEach(o => { if (countWords(o) > lim.option + 2) err(sid, at, `piece "${o}" is long for early readers`); });
          shown.push(...q.items);
        }
      } else if (t === 'sort') {
        if (!Array.isArray(q.groups) || q.groups.length < 2 || q.groups.length > 4 || !q.groups.every(isStr)) err(sid, at, 'groups needs 2-4 names');
        else if (new Set(q.groups).size !== q.groups.length) err(sid, at, 'two groups have the same name');
        else {
          shown.push(...q.groups);
          if (!Array.isArray(q.items) || q.items.length < 2 || !q.items.every(it => isObj(it) && isStr(it.t) && Number.isInteger(it.g) && it.g >= 0 && it.g < q.groups.length)) {
            err(sid, at, 'items must be {t, g} with g the index of a group');
          } else {
            shown.push(...q.items.map(it => it.t));
            q.groups.forEach((g, gi) => { if (!q.items.some(it => it.g === gi)) warn(sid, at, `nothing sorts into "${g}"`); });
          }
        }
      } else if (t === 'twopart') {
        for (const part of ['partA', 'partB']) {
          const p = q[part];
          if (!isObj(p) || !isStr(p.text)) { err(sid, at, `${part} needs text, options and correct`); continue; }
          if (opts(p.options, part + ' options')) {
            shown.push(...p.options);
            if (!Number.isInteger(p.correct) || p.correct < 0 || p.correct >= p.options.length) err(sid, at, `${part} correct must be the index of a choice`);
          }
        }
      }
      if (isObj(q.say)) {
        for (const [k, v] of Object.entries(q.say)) {
          if (shown.length && !shown.includes(k)) warn(sid, at, `say has "${k}", which is not shown in this item`);
          stoppy(sid, at, v);
        }
      }
      stoppy(sid, at, q.sayText);
    }
  });

  // Accurate phonics: the voice must never be asked for an isolated stop
  // sound ("t", "/t/", "tuh") — those come out as letter names or a schwa.
  function stoppy(sid, at, text) {
    if (!isStr(text)) return;
    const t = text.trim().replace(/[.!?,]+$/, '');
    if (/^\/?[bcdgkpqt]\/?$/i.test(t) || /\b(buh|duh|guh|kuh|puh|tuh)\b/i.test(t) || /\/[bcdgkpt]\//i.test(t)) {
      warn(sid, at, `"${text}" asks the voice for an isolated stop sound; use a keyword ("p, like pig")`);
    }
  }
  return out;
}

// Every problem across a list of lands: [{ land, name }], names for messages.
function checkLands(list) {
  const seen = { lands: new Map(), stops: new Map(), orders: new Map() };
  const all = [];
  let stops = 0;
  for (const { land, name, problem } of list) {
    if (problem) { all.push({ level: 'ERROR', where: name, msg: problem }); continue; }
    if (land && Array.isArray(land.stops)) stops += land.stops.length;
    all.push(...checkLand(land, name, seen));
  }
  return { problems: all, stops };
}

// Land JSON files.
function checkFiles(files) {
  return checkLands(files.map(f => {
    const name = path.basename(f);
    try { return { land: JSON.parse(fs.readFileSync(f, 'utf8')), name }; }
    catch (e) { return { name, problem: 'not valid JSON: ' + e.message }; }
  }));
}

// READING_ROAD of a game file. Its lands carry no "order" (the list is the
// road's order), so each is given its place on the road for the order rules.
function checkRoad(road) {
  if (!road || !Array.isArray(road.lands)) return { problems: [{ level: 'ERROR', where: 'READING_ROAD', msg: 'needs a list of lands' }], stops: 0 };
  return checkLands(road.lands.map((l, i) => ({
    land: l && typeof l === 'object' && !Array.isArray(l) ? Object.assign({ order: i + 1 }, l) : l,
    name: l && typeof l.id === 'string' ? l.id : `lands[${i}]`,
  })));
}

module.exports = { checkLand, checkLands, checkFiles, checkRoad, wordsOf, countSentences, countWords, makeDecoder, gradeRange };

if (require.main === module) {
  const args = process.argv.slice(2);
  const noSamples = args.includes('--no-samples');
  const paths = args.filter(a => !a.startsWith('--'));
  let result, what;
  if (paths.length === 1 && fs.existsSync(paths[0]) && fs.statSync(paths[0]).isDirectory()) {
    const dir = paths[0];
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !(noSamples && f.startsWith('_'))).sort().map(f => path.join(dir, f));
    if (!files.length) { console.log(`readcheck: FAIL — no land files in ${dir}`); process.exit(1); }
    result = checkFiles(files); what = `${files.length} land file(s) in ${dir}`;
  } else if (paths.length && paths.every(p => /\.json$/i.test(p))) {
    result = checkFiles(paths); what = `${paths.length} land file(s)`;
  } else {
    const app = require('./app');   // the game file: an .html argument, $TT_APP or the repo's
    let road;
    try { road = app.readingRoad(); }
    catch (e) { console.log(`readcheck: FAIL — cannot read READING_ROAD from ${app.APP}: ${e.message}`); process.exit(1); }
    if (!road) { console.log(`readcheck: FAIL — ${app.APP} has no reading-data module (READING_ROAD)`); process.exit(1); }
    result = checkRoad(road); what = `${road.lands ? road.lands.length : 0} land(s) in READING_ROAD of ${path.basename(app.APP)}`;
  }
  const { problems, stops } = result;
  for (const p of problems) console.log(`${p.level === 'ERROR' ? 'ERROR' : 'WARN '}  ${p.where}: ${p.msg}`);
  const e = problems.filter(p => p.level === 'ERROR').length, w = problems.length - e;
  console.log(`readcheck: ${e ? 'FAIL' : 'PASS'} — ${what}, ${stops} stop(s), ${e} error(s), ${w} warning(s)`);
  process.exit(e ? 1 : 0);
}
