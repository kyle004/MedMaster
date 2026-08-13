/* ============================================================================
   sim-guided.test.js
   ----------------------------------------------------------------------------
   Locks in the rebuild of guided-mode grading and the universal pause.

   The bug this suite exists for: guided mode graded ordering against a STRICT
   TOTAL ORDER over every intervention in the scenario. `expectedNext()`
   returned the first undone intervention - frequently a NON-critical one, since
   most scenarios open with "receive and review the chart" - and anything with a
   higher `order` was scored "right action, wrong priority", marked done, and
   DISABLED. The correct sequence then became unreachable: every subsequent
   action also compared against the same stuck expectation, so a competent
   student saw a wall of "wrong" with no way back. Measured over the 18 shipped
   scenarios, a sensible-but-not-numbered playthrough flagged 94-128 of 161
   picks. It should flag approximately none.

   What replaced it (js/sim-engine.js section 5b): ABC priority BANDS plus a
   lookahead window, gating only on undone CRITICAL work in a higher band, and
   a held-back-with-override interaction so nothing is ever consumed by an
   accident.

   Run:  node tests/run.js sim-guided
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./_harness.js');
var React = require('react');

/* Only real shipped modules. The working folder accumulates orphaned
   `.fuse_hidden*` copies that readdir returns FIRST (dotfiles sort early);
   reading one means testing a ghost copy of a module. Same filter as
   ui-contrast.test.js. */
function jsFiles() {
  return fs.readdirSync(path.join(H.APP_ROOT, 'js'))
    .filter(function (f) { return /\.js$/.test(f) && f.charAt(0) !== '.'; })
    .map(function (f) { return 'js/' + f; });
}

/* ---------------------------------------------------------------- helpers */

function str(v) { return (v === 0 || v) ? String(v) : ''; }
function lower(v) { return str(v).toLowerCase(); }
function parseNum(v) {
  if (typeof v === 'number') { return isFinite(v) ? v : null; }
  var m = /-?\d+(\.\d+)?/.exec(str(v));
  return m ? parseFloat(m[0]) : null;
}
function byOrder(a, b) {
  var x = parseNum(a.order), y = parseNum(b.order);
  return (x === null ? 99 : x) - (y === null ? 99 : y);
}

/* The rule EXACTLY as it shipped, kept here as the regression witness: the new
   numbers only mean something next to the old ones. */
function oldRuleFlags(sc, pickIds) {
  var ivList = (sc.interventions || []).slice().sort(byOrder);
  var done = {}, flags = 0;
  pickIds.forEach(function (id) {
    var a = ivList.filter(function (i) { return str(i.id) === id; })[0];
    if (!a) { return; }
    var order = parseNum(a.order) === null ? 99 : parseNum(a.order);
    var expect = null;
    for (var i = 0; i < ivList.length; i++) {
      if (!done[str(ivList[i].id)]) { expect = ivList[i]; break; }
    }
    var inOrder = !expect || !order || order <= (parseNum(expect.order) || 99);
    if (!inOrder) { flags++; }
    done[id] = true;
  });
  return flags;
}

function newRuleFlags(SE, sc, pickIds) {
  var plan = SE.buildPriorityPlan(sc);
  var done = {}, flags = 0;
  pickIds.forEach(function (id) {
    if (SE.orderGate(plan, done, id)) { flags++; }
    done[id] = true;
  });
  return flags;
}

/* ---- three playthroughs a competent-but-not-psychic student might run ---- */
function criticalsOf(SE, sc) { return SE.buildPriorityPlan(sc).criticals; }

/** Everything, exactly as numbered. The control: must never flag under either rule. */
function playDocumented(SE, sc) {
  return (sc.interventions || []).slice().sort(byOrder).map(function (i) { return str(i.id); });
}
/** Airway/breathing first, then circulation, then the rest - textbook ABC. */
function playAbcFirst(SE, sc) {
  return criticalsOf(SE, sc).slice()
    .sort(function (a, b) { return (a.band - b.band) || (a.rank - b.rank); })
    .map(function (c) { return c.id; });
}
/** Roughly the documented order with every consecutive triple reversed -
    the ordinary local reshuffling of a real bedside. */
function playLocalShuffle(SE, sc) {
  var ids = criticalsOf(SE, sc).map(function (c) { return c.id; });
  var out = [];
  for (var i = 0; i < ids.length; i += 3) { out = out.concat(ids.slice(i, i + 3).reverse()); }
  return out;
}
/** Assess everything, then intervene, then communicate - the other very common
    (and more debatable) student strategy. */
function playAssessThenAct(SE, sc) {
  var w = { assessment: 0, intervention: 1, medication: 1, communication: 2, escalation: 3, education: 4 };
  return criticalsOf(SE, sc).slice().sort(function (a, b) {
    var wa = w[a.category] === undefined ? 2 : w[a.category];
    var wb = w[b.category] === undefined ? 2 : w[b.category];
    return (wa - wb) || (a.rank - b.rank);
  }).map(function (c) { return c.id; });
}

/* -------------------------------------------------------------- DOM utils */

function actIn(fn) {
  var ow = console.warn, oe = console.error;
  console.warn = function () {}; console.error = function () {};
  try { React.act(fn); } finally { console.warn = ow; console.error = oe; }
}

function actionButtons(r) {
  return r.all('button.sim-action');
}
function findCard(r, label) {
  var needle = lower(label).slice(0, 40);
  return actionButtons(r).filter(function (b) {
    return lower(b.textContent || '').indexOf(needle) !== -1;
  })[0] || null;
}
/** The action list is only mounted on the Actions panel; an SBAR-linked
    intervention switches the panel out from under us. */
function backToActions(r) {
  if (actionButtons(r).length) { return; }
  var tab = r.all('button.sim-tab').filter(function (b) { return /^Actions$/.test(b.textContent || ''); })[0];
  if (tab) { r.click(tab); }
}
function clockSec(r) {
  var el = r.find('.sim-clock');
  var m = /(\d+):(\d\d)/.exec(el ? el.textContent : '');
  return m ? (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) : null;
}
function feedbackText(r) {
  var el = r.find('.sim-fb');
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
}

/* ========================================================================== */

module.exports = {
  name: 'sim-guided — priority bands, held-back actions, hint ladder, pause',

  run: function (t) {
    var world = H.makeWorld({ tier: 'pro' });
    world.loadAiThenPatch();
    world.load('js/sim-engine.js');
    var w = world.window;
    var SE = w.SimEngine;
    var corpus = H.loadScenarioCorpus();
    var scenarios = corpus.scenarios;

    /* ================================================================== */
    t.group('the module still loads');

    t.eq(typeof w.SimRunner, 'function', 'SimRunner loads');
    t.eq(typeof SE.buildPriorityPlan, 'function', 'the priority-band model is exported');
    t.eq(typeof SE.orderGate, 'function', 'the ordering gate is exported');
    t.eq(scenarios.length, 18, 'all 18 shipped scenarios loaded for the sweep');

    /* ================================================================== */
    t.group('priority bands are derived from the scenario data');

    var bandCount = { 1: 0, 2: 0, 3: 0 };
    scenarios.forEach(function (sc) {
      SE.buildPriorityPlan(sc).criticals.forEach(function (c) { bandCount[c.band]++; });
    });
    t.ok(bandCount[1] > 20 && bandCount[2] > 20 && bandCount[3] > 20,
      'all three bands are populated across the corpus (A/B ' + bandCount[1] +
      ', C ' + bandCount[2] + ', other ' + bandCount[3] + ')');

    t.eq(SE.abcBandOf({ action: 'Apply oxygen 10 L/min via non-rebreather mask' }), 1,
      'oxygen is band 1 (airway/breathing)');
    t.eq(SE.abcBandOf({ action: 'Establish large-bore IV access and increase IV fluids' }), 2,
      'IV access is band 2 (circulation)');
    t.eq(SE.abcBandOf({ action: 'Educate the parents and document' }), 3,
      'teaching is band 3');
    /* the headline is what the nurse DOES; the tail after " - " explains why and
       mentions everything under the sun */
    t.eq(SE.abcBandOf({ action: 'Verify patient identity using two identifiers - confirm before any blood product' }), 3,
      'band comes from the action headline, not the teaching tail that says "blood"');

    /* ================================================================== */
    t.group('a plausible out-of-order playthrough no longer flags everything');

    var plays = [
      ['all-documented (control)', playDocumented],
      ['ABC-first', playAbcFirst],
      ['locally shuffled', playLocalShuffle],
      ['assess-then-act', playAssessThenAct]
    ];
    var totals = {};
    plays.forEach(function (p) {
      var oldF = 0, newF = 0, picks = 0;
      scenarios.forEach(function (sc) {
        var ids = p[1](SE, sc);
        picks += ids.length;
        oldF += oldRuleFlags(sc, ids);
        newF += newRuleFlags(SE, sc, ids);
      });
      totals[p[0]] = { old: oldF, now: newF, picks: picks };
    });

    t.eq(totals['all-documented (control)'].now, 0,
      'the documented order flags nothing (control; old rule also flagged ' +
      totals['all-documented (control)'].old + ')');
    t.eq(totals['ABC-first'].now, 0,
      'ABC-first playthrough: 0 of ' + totals['ABC-first'].picks +
      ' flagged, was ' + totals['ABC-first'].old);
    t.eq(totals['locally shuffled'].now, 0,
      'locally shuffled playthrough: 0 of ' + totals['locally shuffled'].picks +
      ' flagged, was ' + totals['locally shuffled'].old);
    t.ok(totals['assess-then-act'].now <= 8,
      'assess-then-act playthrough: ' + totals['assess-then-act'].now + ' of ' +
      totals['assess-then-act'].picks + ' flagged, was ' + totals['assess-then-act'].old +
      ' (the survivors are genuine priority inversions - assessing while an ' +
      'airway or bleeding problem is untouched)');

    var oldAll = totals['ABC-first'].old + totals['locally shuffled'].old + totals['assess-then-act'].old;
    var newAll = totals['ABC-first'].now + totals['locally shuffled'].now + totals['assess-then-act'].now;
    t.ok(oldAll > 250 && newAll < 10,
      'across the three realistic playthroughs: ' + oldAll + ' spurious flags before, ' +
      newAll + ' after');

    /* ...and it must still catch the thing it exists to catch. */
    var caught = 0, tried = 0;
    scenarios.forEach(function (sc) {
      var crit = criticalsOf(SE, sc);
      if (!crit.length) { return; }
      tried++;
      var last = crit[crit.length - 1];
      if (SE.orderGate(SE.buildPriorityPlan(sc), {}, last.id)) { caught++; }
    });
    t.ok(caught >= 8,
      'jumping straight to the last critical action is still flagged in ' + caught +
      ' of ' + tried + ' scenarios (the rest are airway actions, which are never out of sequence)');

    /* ================================================================== */
    t.group('non-critical work is never gated, and order:0 is a real order');

    var zeroSc = {
      id: 'unit-zero',
      interventions: [
        { id: 'z0', order: 0, critical: true, category: 'intervention',
          action: 'Open the airway and apply oxygen' },
        { id: 'z1', order: 1, critical: true, category: 'assessment',
          action: 'Check a blood glucose' },
        { id: 'z2', order: 2, critical: true, category: 'assessment',
          action: 'Weigh the pads to quantify blood loss' },
        { id: 'z3', order: 3, critical: true, category: 'assessment',
          action: 'Recheck the pain score' },
        { id: 'z4', order: 4, critical: true, category: 'education',
          action: 'Teach the family about discharge follow-up' },
        { id: 'z5', order: 5, critical: false, category: 'education',
          action: 'Document the encounter after the airway is secured' }
      ]
    };
    var zeroPlan = SE.buildPriorityPlan(zeroSc);
    t.eq(zeroPlan.criticals[0].id, 'z0', 'order:0 sorts FIRST, it is not coerced to 99');
    t.eq(zeroPlan.criticals[0].order, 0, 'order:0 survives into the plan as 0');
    t.eq(zeroPlan.criticals[0].rank, 0, 'order:0 gets rank 0');
    t.eq(zeroPlan.byId.z0.band, 1, 'the order:0 airway action is band 1');

    t.ok(!SE.orderGate(zeroPlan, {}, 'z0'), 'a band-1 action is never out of sequence');
    t.ok(!SE.orderGate(zeroPlan, {}, 'z1'), 'a near-neighbour inside the lookahead window is fine');
    var farGate = SE.orderGate(zeroPlan, {}, 'z4');
    t.ok(!!farGate, 'teaching, five steps past an unaddressed airway, IS out of sequence');
    if (farGate) {
      t.eq(farGate.letter, 'A/B', 'the gate names the A/B band');
      t.notContains(SE.gateCoachLine(farGate), 'oxygen',
        'the coaching line never names the action it is protecting');
      t.contains(SE.gateCoachLine(farGate), 'airway', 'the coaching line does name the band');
    }
    t.ok(!SE.orderGate(zeroPlan, {}, 'z5'), 'a NON-critical intervention is never gated');
    t.ok(!SE.orderGate(zeroPlan, { z0: true }, 'z4'),
      'once the airway is addressed the same action is fine');

    var zeroActions = SE.buildActions(zeroSc).filter(function (a) { return a.ivId === 'z0'; })[0];
    t.eq(zeroActions ? zeroActions.order : null, 0, 'buildActions keeps order 0 as 0');

    /* ================================================================== */
    t.group('the hint ladder escalates and only tier 3 gives the answer');

    var hintTarget = SE.nextPriority(zeroPlan, {});
    t.eq(hintTarget.id, 'z0', 'the hint target is the highest unaddressed band');
    var h1 = SE.hintForTier(hintTarget, 1, {});
    var h2 = SE.hintForTier(hintTarget, 2, { secsToNext: 120 });
    var h3 = SE.hintForTier(hintTarget, 3, {});
    t.notContains(h1.body, 'Open the airway and apply oxygen', 'tier 1 does NOT name the action');
    t.notContains(h2.body, 'Open the airway and apply oxygen', 'tier 2 does NOT name the action');
    t.contains(h3.body, 'Open the airway and apply oxygen', 'tier 3 names the action');
    t.contains(h1.body, 'airway', 'tier 1 gives the ABC band');
    t.contains(h2.body, 'respiratory', 'tier 2 narrows to the body system');
    t.contains(h2.body, '2:00', 'tier 2 says why it is time-critical now');
    t.deepEq([h1.weight, h2.weight, h3.weight], [1, 2, 3], 'the tiers cost 1, 2 and 3');

    var noHints = SE.scorePerformance(zeroSc, { hintsUsed: 0 }, 'guided');
    var someHints = SE.scorePerformance(zeroSc, { hintsUsed: 6 }, 'guided');
    t.eq(noHints.hintPenalty, 0, 'no hints, no hint penalty');
    t.eq(someHints.hintPenalty, 3, 'a full ladder (1+2+3) costs 3 points');
    t.ok(someHints.total < noHints.total, 'the hint penalty actually moves the score');
    t.eq(SE.scorePerformance(zeroSc, { hintsUsed: 999 }, 'guided').hintPenalty, 8,
      'the hint penalty is capped');

    /* ================================================================== */
    t.group('live run: a held-back action is not consumed');

    /* pick a scenario with an action that is blockable from a cold start */
    var target = null;
    scenarios.forEach(function (sc) {
      if (target) { return; }
      var plan = SE.buildPriorityPlan(sc);
      plan.criticals.forEach(function (c) {
        if (target) { return; }
        if (SE.orderGate(plan, {}, c.id)) { target = { sc: sc, rec: c }; }
      });
    });
    t.ok(!!target, 'found a scenario with an out-of-sequence opener: ' +
      (target ? target.sc.id + ' / ' + SE.shortAction(target.rec.action) : 'none'));

    var finished = null;
    var r = null;
    if (target) {
      actIn(function () {
        r = H.renderInto(w, React.createElement(w.SimRunner, {
          scenario: target.sc, mode: 'guided',
          onFinish: function (payload) { finished = payload; },
          onQuit: function () {}
        }));
      });

      var card = findCard(r, target.rec.action);
      t.ok(!!card, 'the action card is on the board');

      r.click(card);
      card = findCard(r, target.rec.action);
      t.ok(card && !card.disabled, 'after a held-back attempt the card is STILL ENABLED');
      t.match(card ? card.className : '', /outorder/, 'the card shows the amber out-of-sequence state');
      t.contains(card ? card.textContent : '', 'Tap again',
        'the card offers the override in as many words');
      t.contains(feedbackText(r), 'has NOT been recorded',
        'the student is told nothing was recorded');
      t.notContains(feedbackText(r), SE.shortAction(target.rec.action),
        'the coaching line never names the action that is actually next');

      var logText = (r.find('.sim-log-body') || { textContent: '' }).textContent;
      t.contains(logText, 'Held back', 'the log records the held-back attempt');

      /* the patient answered */
      var patientLines = r.all('.sim-le.patient').length;
      t.ok(patientLines >= 1, 'the patient responds to the blocked attempt (' + patientLines + ' line(s))');

      /* ---- second activation: the override commits ---- */
      r.click(findCard(r, target.rec.action));
      var after = findCard(r, target.rec.action);
      t.ok(after && after.disabled, 'after the override the action is committed (now disabled)');
      t.match(after ? after.className : '', /usedmid/,
        'a committed out-of-sequence action has its own class, not the old classless grey');
      t.contains(after ? after.textContent : '', 'out of sequence',
        'the committed card says why it is amber');

      var endBtn = r.button(/End & debrief/);
      r.click(endBtn);
      t.ok(!!finished, 'the run finished and reported');
    }

    if (finished && target) {
      var mine = (finished.performed || []).filter(function (p) { return p.ivId === target.rec.id; });
      t.eq(mine.length, 1,
        'the action appears in `performed` exactly ONCE - the held-back attempt was never recorded');
      t.eq(mine.length ? mine[0].verdict : '', 'mid', 'the override scores as out of sequence');
      t.eq(finished.blockedAttempts, 1, 'exactly one attempt was held back');
      t.ok((finished.perf.outOfSequence || 0) === 1, 'perf carries the out-of-sequence count');
    }
    if (r) { r.unmount(); }

    /* ================================================================== */
    t.group('live run: a sensible playthrough is not punished');

    var sc2 = scenarios.filter(function (s) { return s.id === 'ms2-ards'; })[0] || scenarios[0];
    var plan2 = SE.buildPriorityPlan(sc2);
    var abcOrder = plan2.criticals.slice().sort(function (a, b) {
      return (a.band - b.band) || (a.rank - b.rank);
    });
    var r2 = null;
    actIn(function () {
      r2 = H.renderInto(w, React.createElement(w.SimRunner, {
        scenario: sc2, mode: 'guided', onFinish: function () {}, onQuit: function () {}
      }));
    });
    var blockedInRun = 0;
    abcOrder.forEach(function (rec) {
      backToActions(r2);
      var c = findCard(r2, rec.action);
      if (!c || c.disabled) { return; }
      r2.click(c);
      backToActions(r2);
      var again = findCard(r2, rec.action);
      if (again && /outorder/.test(again.className)) { blockedInRun++; }
    });
    backToActions(r2);
    var midCards = actionButtons(r2).filter(function (b) { return /usedmid/.test(b.className); }).length;
    var goodCards = actionButtons(r2).filter(function (b) { return /\bdone\b/.test(b.className); }).length;
    t.eq(blockedInRun, 0,
      'an ABC-first playthrough of ' + sc2.id + ' is held back zero times (' +
      abcOrder.length + ' critical actions)');
    t.eq(midCards, 0, 'nothing was scored out of sequence');
    t.ok(goodCards >= abcOrder.length, goodCards + ' cards recorded as correct');
    if (r2) { r2.unmount(); }

    /* ================================================================== */
    t.group('live run: the hint ladder in the UI');

    var r3 = null;
    actIn(function () {
      r3 = H.renderInto(w, React.createElement(w.SimRunner, {
        scenario: sc2, mode: 'guided', onFinish: function () {}, onQuit: function () {}
      }));
    });
    var hintBtn = r3.button(/^Hint$/);
    t.ok(!!hintBtn, 'the Hint button is there');
    var target3 = SE.nextPriority(SE.buildPriorityPlan(sc2), {});
    r3.click(hintBtn);
    var tierOne = feedbackText(r3);
    t.contains(tierOne, '1/3', 'the first hint announces itself as tier 1 of 3');
    t.notContains(tierOne, SE.shortAction(target3.action),
      'tier 1 does not name the action (this is the whole point of the ladder)');
    r3.click(hintBtn);
    var tierTwo = feedbackText(r3);
    t.contains(tierTwo, '2/3', 'asking again escalates to tier 2');
    t.ok(tierTwo !== tierOne, 'tier 2 says something different');
    t.notContains(tierTwo, SE.shortAction(target3.action), 'tier 2 still does not name the action');
    r3.click(hintBtn);
    var tierThree = feedbackText(r3);
    t.contains(tierThree, '3/3', 'the third ask is tier 3');
    t.contains(tierThree, SE.shortAction(target3.action), 'tier 3 finally names the action');
    if (r3) { r3.unmount(); }

    /* ================================================================== */
    t.group('pause freezes the clock and resume does not fast-forward');

    var r4 = null;
    actIn(function () {
      r4 = H.renderInto(w, React.createElement(w.SimRunner, {
        scenario: sc2, mode: 'exam', onFinish: function (p) { finished = p; }, onQuit: function () {}
      }));
    });

    var pauseBtn = r4.button(/Pause/);
    t.ok(!!pauseBtn, 'exam mode has a Pause button too (it used to be guided-only)');
    /* the canonical verbs - the same names js/ai-scenario.js exposes, so a
       parent can drive either engine without knowing which one it has */
    ['pause', 'resume', 'togglePause', 'isPaused', 'canPause', 'onPauseChange', 'pauseStats']
      .forEach(function (verb) {
        t.eq(typeof SE[verb], 'function', 'SimEngine.' + verb + '() is exported');
      });
    t.eq(typeof SE.pauseRun, 'function', 'the *Run alias is exported too');
    t.eq(SE.isPaused(), false, 'a fresh run is not paused');
    t.eq(SE.canPause(), true, 'a live run can be paused');
    t.eq(SE.isRunPaused(), false, 'the alias agrees');

    return H.actTick(1000).then(function () {
      var c0 = clockSec(r4);
      t.ok(c0 !== null && c0 > 0, 'the clock is running (' + c0 + 's left)');

      r4.click(r4.button(/Pause/));
      t.eq(SE.isRunPaused(), true, 'the public API sees the pause');
      var c1 = clockSec(r4);
      t.ok(!!r4.find('.sim-veil'), 'a paused overlay covers the stage');
      var disabledActions = actionButtons(r4).filter(function (b) { return !b.disabled; }).length;
      t.eq(disabledActions, 0, 'every action button is disabled while paused');

      return H.actTick(1200).then(function () {
        var c2 = clockSec(r4);
        t.eq(c2, c1, 'the clock did not move while paused (' + c1 + ' -> ' + c2 + ')');

        r4.click(r4.button(/Resume/));
        t.eq(SE.isRunPaused(), false, 'resumed');

        return H.actTick(1000).then(function () {
          var c3 = clockSec(r4);
          t.ok(c3 < c2, 'the clock runs again after resume (' + c2 + ' -> ' + c3 + ')');
          /* the whole point: no accumulated-time catch-up. One second of real
             time at the exam scale is 3 simulated seconds; a catch-up burst
             would swallow the 1.2s pause as well. */
          t.ok((c2 - c3) <= 8,
            'resume did NOT fast-forward: ' + (c2 - c3) + ' simulated seconds elapsed for ~1s of ' +
            'real time, not the ' + (c2 - c3 > 8 ? 'accumulated' : 'paused') + ' interval as well');

          var stats = SE.pauseStats();
          t.eq(stats.pauseCount, 1, 'the pause was counted');
          t.ok(stats.pausedMs >= 900, 'paused time was measured (' + stats.pausedMs + 'ms)');
          t.eq(stats.paused, false, 'stats agree the run is live again');

          /* keyboard */
          var seen = [];
          var off = SE.onPauseChange(function (p) { seen.push(!!p); });
          actIn(function () {
            w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'p', bubbles: true }));
          });
          t.eq(SE.isRunPaused(), true, 'P toggles the pause');
          actIn(function () {
            w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'p', bubbles: true }));
          });
          t.eq(SE.isRunPaused(), false, 'P toggles it back');
          t.ok(seen.length >= 2, 'onPauseChange subscribers were notified (' + seen.length + ' events)');
          off();

          /* never steal the key from a text field */
          var search = r4.find('input.sim-search');
          if (search) {
            actIn(function () {
              search.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'p', bubbles: true }));
            });
            t.eq(SE.isRunPaused(), false, 'typing "p" in the search box does not pause the sim');
            actIn(function () {
              search.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
            });
            t.eq(SE.isRunPaused(), false, 'nor does a space in the search box');
          }

          /* programmatic pause + the shared registry */
          actIn(function () { SE.pauseRun('unit test'); });
          t.eq(SE.isRunPaused(), true, 'SimEngine.pauseRun() pauses programmatically');
          t.eq(typeof w.MMPause, 'object', 'the shared MMPause registry exists');
          t.eq(w.MMPause.get('sim-engine'), SE.pauseControl,
            'sim-engine registered its control under a stable id');
          actIn(function () { w.MMPause.resumeAll(); });
          t.eq(SE.isRunPaused(), false, 'MMPause.resumeAll() reaches this engine');

          /* exam-mode accounting survives into the debrief payload */
          finished = null;
          r4.click(r4.button(/End & debrief/));
          t.ok(!!finished, 'the exam run finished');
          if (finished) {
            t.ok(finished.pauseCount >= 3, 'exam debrief carries the pause count (' + finished.pauseCount + ')');
            t.ok(typeof finished.pausedSec === 'number', 'exam debrief carries total paused seconds');
            t.ok(finished.timeSec > 0 && finished.timeSec < 60 * 60,
              'simulated time is unaffected by paused wall time');
          }
          r4.unmount();

          t.eq(SE.isRunPaused(), false, 'with nothing mounted the verbs are harmless');
          t.eq(SE.pauseRun(), false, 'pauseRun() with no run returns false rather than throwing');

          /* ============================================================== */
          t.group('exam mode never holds an action back');

          var examScenario = target ? target.sc : sc2;
          var examRec = target ? target.rec : null;
          var examFinished = null;
          if (examRec) {
            var r5 = null;
            actIn(function () {
              r5 = H.renderInto(w, React.createElement(w.SimRunner, {
                scenario: examScenario, mode: 'exam',
                onFinish: function (p) { examFinished = p; }, onQuit: function () {}
              }));
            });
            var c5 = findCard(r5, examRec.action);
            r5.click(c5);
            backToActions(r5);
            var after5 = findCard(r5, examRec.action);
            t.ok(after5 && after5.disabled,
              'exam mode commits the same action immediately - no held-back attempt');
            r5.click(r5.button(/End & debrief/));
            t.eq(examFinished ? examFinished.blockedAttempts : -1, 0,
              'exam mode recorded zero held-back attempts');
            var examMine = examFinished
              ? (examFinished.performed || []).filter(function (p) { return p.ivId === examRec.id; })
              : [];
            t.eq(examMine.length, 1, 'and the action is recorded exactly once');
            t.eq(examMine.length ? examMine[0].verdict : '', 'mid',
              'exam scoring semantics are unchanged: still out of sequence, still scored');
            r5.unmount();
          }

          /* ============================================================== */
          t.group('timed mode: exactly one held-back attempt per run');

          if (target) {
            var planT = SE.buildPriorityPlan(target.sc);
            var gated = planT.criticals.filter(function (c) {
              return !!SE.orderGate(planT, {}, c.id);
            });
            if (gated.length >= 2) {
              var r6 = null, timedFinished = null;
              actIn(function () {
                r6 = H.renderInto(w, React.createElement(w.SimRunner, {
                  scenario: target.sc, mode: 'timed',
                  onFinish: function (p) { timedFinished = p; }, onQuit: function () {}
                }));
              });
              r6.click(findCard(r6, gated[0].action));
              backToActions(r6);
              var firstCard = findCard(r6, gated[0].action);
              t.ok(firstCard && !firstCard.disabled,
                'timed mode holds the FIRST out-of-sequence attempt back too');
              t.contains(feedbackText(r6), 'hierarchy',
                'and it still says why, even though timed mode withholds graded feedback');
              /* a different gated action: the one block is spent, so it commits */
              r6.click(findCard(r6, gated[1].action));
              backToActions(r6);
              var secondCard = findCard(r6, gated[1].action);
              t.ok(secondCard && secondCard.disabled,
                'the SECOND one commits immediately - one warning per run, then the clock is real');
              r6.click(r6.button(/End & debrief/));
              t.eq(timedFinished ? timedFinished.blockedAttempts : -1, 1,
                'exactly one held-back attempt was recorded for the run');
              r6.unmount();
            }
          }

          /* ============================================================== */
          t.group('the stylesheet carries the new states');

          var css = Array.prototype.map.call(w.document.querySelectorAll('style'), function (s) {
            return s.textContent;
          }).join('\n');
          t.match(css, /\.sim-action\.outorder\{[^}]*color:/,
            '.sim-action.outorder sets its own colour (buttons do not inherit it)');
          t.match(css, /@keyframes simShake/, 'there is a shake keyframe');
          t.match(css, /prefers-reduced-motion[\s\S]*?\.sim-action\.outorder\{box-shadow/,
            'reduced motion gets a border cue instead of the shake');
          t.match(css, /\.sim-action\.usedmid\{/, 'the mid verdict finally has a class');

          var blackText = [];
          jsFiles().forEach(function (rel) {
            var src = fs.readFileSync(path.join(H.APP_ROOT, rel), 'utf8');
            var re = /color\s*:\s*(#0{3,6}\b|#1[0-9a-f]{2}\b|black|buttontext)/gi, m;
            while ((m = re.exec(src))) {
              var around = src.slice(Math.max(0, m.index - 60), m.index);
              if (/--text-on-fill|text-on-fill/.test(around)) { continue; }
              blackText.push(rel + ': ' + m[0]);
            }
          });
          t.eq(blackText.length, 0, 'no new rule hardcodes near-black text' +
            (blackText.length ? ' — ' + blackText.slice(0, 4).join(' | ') : ''));

          world.cleanup();
        });
      });
    });
  }
};
