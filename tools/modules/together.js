// What a module's own suite needs when every other module is built into the
// game file too.
//
// quietBuddy: an init script for each browser context. On a child's first
// visit the Brain Buddy module opens its chooser over the hub, so every first
// visit in another module's suite would land on the chooser, not the hub.
// Here that automatic ask stays closed and the hub shows the buddy's invite
// card, the same hub a child sees after MAYBE LATER. Only the automatic call
// is held back (buddyOpenChooser('first') with no event): tapping the invite
// card, pressing Enter on it, and CHANGE BUDDY still open the chooser. The
// chooser itself is the buddy suite's business, and smoke, screens, platforms
// and the play-through go through it for real.
//
// others(page): which other modules are in the page, for checks that only
// hold when a module is alone (for example "no boss missions without boss").
module.exports.quietBuddy = () => {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.buddyOpenChooser !== 'function') return;
    const open = window.buddyOpenChooser;
    window.buddyOpenChooser = function (mode, evt) {
      if (mode === 'first' && !evt) return;
      return open.apply(this, arguments);
    };
  });
};

module.exports.others = page => page.evaluate(() => ({
  buddy: typeof buddyOpenChooser === 'function',
  stickers: typeof stickersAutoRead === 'function',
  boss: typeof bossStart === 'function',
  missions: typeof missionsDef === 'function',
  reading: typeof readingRoad === 'function',
}));
