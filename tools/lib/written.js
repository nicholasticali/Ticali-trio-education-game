// Every written question in the game, for checks that must see all of them
// rather than the ten one round happens to deal.
//
//   const written = require('./lib/written');
//   await page.evaluate(written.install);     // once per page load
//   then, inside page.evaluate:
//     ttWritten(pack)    the pack's written questions: [{ q, src }]
//     ttWrittenAll()     every pack's, each question once: { list, packs }
//     ttRoadItems(pid)   every Reading Road stop's round for that child:
//                        [{ stop, land, items }]
//
// A written question is one in a bank a pack deals from: a K bank, a reading
// passage set (each question given its passage, as a round shows it), a
// pre-mixed bank, a multiple-choice or typed / true-false bank of the
// pre-K, 2nd and 4th grade packs, and the pack's critical-thinking puzzles.
// Generated math is not written (generators.js runs every generator); boss
// battles deal written questions from other packs. These are the same banks
// the game counts for its About page, writtenQuestionCount(): a check that
// uses this compares the two, so a new kind of bank cannot slip past it.
//
// `q` is what to show (a passage question carries its passage); `src` is the
// question object in the bank, the same for every pack that shares the bank.
'use strict';

module.exports.install = () => {
  const take = (out, list, extra) => {
    if (!Array.isArray(list)) return;
    for (const src of list) out.push({ q: extra ? Object.assign({}, src, extra) : src, src });
  };
  window.ttWritten = pk => {
    allPacks();   // gives every pack its home profile and grade
    const out = [];
    const home = pk.home;
    if (pk.kBankKey) take(out, K_BANKS[pk.kBankKey]);
    if (pk.quest && BANKS[pk.questBank]) BANKS[pk.questBank].forEach(set => take(out, set.questions, { passage: set.passage }));
    else take(out, resolvePackBank(pk));
    if (!pk.generated && pk.bankKey) take(out, ({ k: PREK_BANKS, g3: G2_BANKS, g5: G4_BANKS }[home] || {})[pk.bankKey]);
    if (pk.nonMcKey && !(pk.generated && (NONMC_MATH_GENERATORS[pk.id] || []).length)) {
      take(out, ({ k: PREK_NONMC_BANKS, g3: G2_NONMC_BANKS, g5: G4_NONMC_BANKS }[home] || {})[pk.nonMcKey]);
    }
    take(out, THINK_ITEMS[pk.id]);
    return out;
  };
  window.ttWrittenAll = () => {
    const seen = new Set(), list = [];
    let packs = 0;
    for (const pk of allPacks()) {
      const qs = ttWritten(pk);
      if (qs.length) packs++;
      for (const x of qs) if (!seen.has(x.src)) { seen.add(x.src); list.push(x); }
    }
    return { list, packs };
  };
  // A Reading Road stop's round as the engine deals it (its practice items,
  // then its story questions with the story), for a child with nothing done
  // yet, so no review items join it.
  window.ttRoadItems = pid => {
    if (typeof readingRoad !== 'function') return [];
    return readingRoad().stops.map(s => ({ stop: s, land: s.land, items: readingRound(pid, s.id) }));
  };
};
