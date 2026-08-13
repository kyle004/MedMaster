/* ============================================================================
   ms2lab.test.js
   ----------------------------------------------------------------------------
   Guards js/ms2lab.js - the Med-Surg II Simulation Lab mode.

   What this suite is actually protecting:

   1. THE PACKET IS THE RUBRIC. `activitySteps` is the sheet the proctor marks.
      Every entry has to be reachable as an action in every one of the eight
      packets, or a student can be marked down for a step the app never let
      them perform.

   2. NOTHING IS CONSUMED BY AN ACCIDENT. The held-back interaction from
      js/sim-engine.js is the whole reason guided grading is usable: a first
      out-of-sequence attempt records nothing, leaves the control ENABLED, and
      coaches by phase without naming the step. A second activation commits it.
      Both halves are asserted, because either one alone is a bug.

   3. THE HINT LADDER DOES NOT LEAK. Tier 1 gives a phase. If tier 1 ever
      contains the step text the ladder is decoration.

   4. THE CLOCK CANNOT LIE. Pause freezes it; resume does not fast-forward.
      Asserted on the pure derivation with synthetic timestamps, which is the
      only way to test it deterministically, and again through the DOM.

   5. IT DEGRADES. Missing data file, missing AI, denied Firebase write - none
      of them may be a white screen.

   Run:  node tests/run.js ms2lab
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./_harness.js');
var React = require('react');

/* Only real shipped modules. The working folder accumulates orphaned
   `.fuse_hidden*` copies that readdir returns FIRST (dotfiles sort early);
   reading one means linting a ghost copy of a module instead of the real one.
   Same filter as ui-contrast.test.js and sim-guided.test.js. */
function jsFiles() {
  return fs.readdirSync(path.join(H.APP_ROOT, 'js'))
    .filter(function (f) { return /\.js$/.test(f) && f.charAt(0) !== '.'; })
    .map(function (f) { return 'js/' + f; });
}
function read(rel) { return fs.readFileSync(path.join(H.APP_ROOT, rel), 'utf8'); }

/* -------------------------------------------------------------- utilities */

function str(v) { return (v === 0 || v) ? String(v) : ''; }
function lower(v) { return str(v).toLowerCase(); }

function actIn(fn) {
  var ow = console.warn, oe = console.error;
  console.warn = function () {}; console.error = function () {};
  try { React.act(fn); } finally { console.warn = ow; console.error = oe; }
}

/** Strip comments, string literals and regex literals before scanning source
    for ES5 violations - otherwise a markdown fence in a regex reads as a
    template literal and every comment full of prose reads as spread syntax. */
function stripCode(src) {
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/\/(?:[^/\\\n\[]|\\.|\[[^\]\n]*\])+\/[gimsuy]*/g, '/RE/');
}

function stepButtons(r) { return r.all('button.ms2-step'); }
function errButtons(r) { return r.all('button.ms2-errbtn'); }
function findStep(r, text) {
  var needle = lower(text).slice(0, 42);
  return stepButtons(r).filter(function (b) {
    return lower(b.textContent || '').indexOf(needle) !== -1;
  })[0] || null;
}
function feedbackText(r) {
  var el = r.find('.ms2-fb');
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
}
function clockText(r) {
  var el = r.find('.ms2-clock');
  return el ? (el.textContent || '').trim() : '';
}

function chartTab(r, label) {
  return r.all('button.ms2-tab').filter(function (b) {
    return new RegExp('^' + label + '\\d?$').test((b.textContent || '').trim());
  })[0] || null;
}

/** Perform every step in the printed order, having read the chart first - the
    playthrough a competent student actually runs. Reading the labs matters:
    an interpretation step performed without opening them is held back on
    purpose. */
function performAll(r, sim) {
  var labs = chartTab(r, 'Labs');
  if (labs) { r.click(labs); }
  (sim.activitySteps || []).forEach(function (a) {
    var b = findStep(r, a.text);
    if (b && !b.disabled) { r.click(b); }
    /* The SBAR step is not a click, it is a report: acting on it swaps the
       rubric out for the composer. Fill it and hand it over, or every step
       after it is unreachable. */
    if (!stepButtons(r).length) { giveSbar(r); }
  });
}

/** Fill the four SBAR boxes and hand the report over. */
function giveSbar(r) {
  var boxes = r.all('textarea.ms2-ta');
  boxes.forEach(function (box, i) {
    var setter = Object.getOwnPropertyDescriptor(
      box.ownerDocument.defaultView.HTMLTextAreaElement.prototype, 'value').set;
    actIn(function () {
      setter.call(box, ['MY SITUATION', 'MY BACKGROUND', 'MY ASSESSMENT', 'MY RECOMMENDATION'][i] || 'x');
      box.dispatchEvent(new box.ownerDocument.defaultView.Event('input', { bubbles: true }));
    });
  });
  var go = r.button(/Give the report/);
  if (go) { r.click(go); }
}

/** Re-pin Node's globals to a world. makeWorld() and cleanup() both write
    global.window, so creating or tearing down a nested world silently steals it
    from the suite's main world and the next render dies with
    "window is not defined" three assertions later. */
function repin(world) {
  var ww = world.window;
  global.window = ww;
  global.document = ww.document;
  global.self = ww;
  global.localStorage = ww.localStorage;
  try {
    Object.defineProperty(global, 'navigator', {
      value: ww.navigator, writable: true, configurable: true
    });
  } catch (e) {}
}

/** A fake RTDB whose transaction() answers through the CALLBACK, the way the
    real SDK does, as well as the promise the harness double returns. Both
    firing is the point: createRoom() must settle exactly once. */
function txDb() {
  var f = H.makeFakeDb();
  var baseRef = f.ref;
  f.ref = function (p) {
    var key = String(p).replace(/^\/+|\/+$/g, '');
    var r = baseRef(p);
    r.transaction = function (fn, cb) {
      var cur = f.get(key);
      var next = fn(cur === undefined ? null : cur);
      var committed = next !== undefined;
      if (committed) { r.set(next); }
      if (typeof cb === 'function') {
        cb(null, committed, { val: function () { return f.get(key); } });
      }
      return Promise.resolve({ committed: committed });
    };
    return r;
  };
  return f;
}

/** Mount the runner for a sim. Callers MUST unmount - the runner owns a 500ms
    ticker and a jsdom world that outlives it leaks the interval into the next
    assertion. */
function mountRunner(w, sim, opts) {
  var o = opts || {};
  var r = null;
  var finished = { payload: null };
  actIn(function () {
    r = H.renderInto(w, React.createElement(w.MS2LabRunner, {
      sim: sim,
      durationMin: o.durationMin === undefined ? 20 : o.durationMin,
      runMode: o.runMode || 'solo',
      uid: 'u-test', name: 'Tester',
      net: null, role: '',
      onFinish: function (p) { finished.payload = p; },
      onQuit: function () {}
    }));
  });
  return { r: r, finished: finished };
}

/* ========================================================================== */

module.exports = {
  name: 'ms2lab — packet rubric, held-back steps, hint ladder, pause, degradation',

  run: function (t) {
    var world = H.makeWorld({ tier: 'pro' });
    world.load('data/ms2lab.js');
    world.load('js/ms2lab.js');
    var w = world.window;
    var M = w.MS2LabMode;

    /* ================================================================== */
    t.group('the module loads and exports its surface');

    t.eq(typeof w.MS2LabMode, 'function', 'window.MS2LabMode is the page component');
    t.eq(typeof w.MS2LabRunner, 'function', 'window.MS2LabRunner is exported for direct mounting');
    t.eq(typeof w.MS2LabPicker, 'function', 'the topic picker is exported');
    t.eq(typeof w.MS2LabPreBrief, 'function', 'the pre-brief is exported');
    t.eq(typeof w.MS2LabDebrief, 'function', 'the debrief is exported');
    t.eq(w.MS2Lab, w.MS2LabMode, 'window.MS2Lab is the logic alias');

    ['buildRubric', 'orderGate', 'gateCoachLine', 'nextStep', 'hintForTier',
      'initialRun', 'applyEvent', 'foldEvents', 'elapsedSec', 'remainingSec',
      'scoreRun', 'persistResult', 'completeTruncatedJSON', 'parseJsonReply']
      .forEach(function (fn) {
        t.eq(typeof M[fn], 'function', 'MS2LabMode.' + fn + '() is exported');
      });

    var styleTags = w.document.querySelectorAll('style');
    t.ok(styleTags.length >= 1, 'the module injected its stylesheet on load');

    /* ================================================================== */
    t.group('ES5 only, no build step');

    var src = stripCode(read('js/ms2lab.js'));
    var es5 = [
      ['arrow function', /=>/],
      ['const declaration', /(^|[^A-Za-z0-9_$.])const\s+[A-Za-z_$]/],
      ['let declaration', /(^|[^A-Za-z0-9_$.])let\s+[A-Za-z_$]/],
      ['template literal', /`/],
      ['spread or rest', /\.\.\./],
      ['optional chaining', /\?\./],
      ['nullish coalescing', /\?\?/],
      ['array destructuring', /(?:var|const|let)\s*\[/],
      ['object destructuring', /(?:var|const|let)\s*\{/],
      ['for-of', /for\s*\(\s*(?:var\s+)?[A-Za-z_$]+\s+of\s/],
      ['async function', /(^|[^A-Za-z0-9_$.])async(?:\s+function|\s*\()/],
      ['await', /(^|[^A-Za-z0-9_$.])await\s/],
      ['class declaration', /(^|[^A-Za-z0-9_$.])class\s+[A-Za-z_$]/],
      ['exponent operator', /\*\*/]
    ];
    es5.forEach(function (c) {
      t.ok(!c[1].test(src), 'no ' + c[0] + ' in js/ms2lab.js');
    });
    t.ok(jsFiles().indexOf('js/ms2lab.js') !== -1,
      'js/ms2lab.js is a real shipped module (and the .fuse_hidden ghosts are filtered out)');

    /* ================================================================== */
    t.group('all eight packets load');

    var sims = M.allSims();
    t.eq(sims.length, 8, 'all 8 simulation packets loaded');
    t.ok(M.contentOk(), 'contentOk() is true with the data file present');

    var wantIds = ['ms2lab-ards', 'ms2lab-dic', 'ms2lab-heart-failure', 'ms2lab-icp',
      'ms2lab-pe', 'ms2lab-sepsis', 'ms2lab-gi-bleed', 'ms2lab-liver-failure'];
    wantIds.forEach(function (id) {
      t.ok(!!M.simById(id), 'simById("' + id + '") resolves');
    });

    sims.forEach(function (s) {
      var rub = M.buildRubric(s);
      t.eq(rub.total, (s.activitySteps || []).length,
        s.id + ': the rubric carries every activityStep (' + rub.total + ')');
      t.ok(rub.criticals.length > 0, s.id + ': has critical steps (' + rub.criticals.length + ')');
      t.ok(!!s.sourceNote, s.id + ': carries a sourceNote for the student to read');
      t.ok((s.criticalErrors || []).length > 0, s.id + ': carries the packet critical-error list');
    });

    /* ================================================================== */
    t.group('every activity step is reachable as an action, in all 8 packets');

    var unreachable = [];
    var mounted = 0;
    sims.forEach(function (s) {
      var m = mountRunner(w, s, { durationMin: s.durationMin || 20 });
      mounted++;
      var btns = stepButtons(m.r);
      if (btns.length !== (s.activitySteps || []).length) {
        unreachable.push(s.id + ': ' + btns.length + ' buttons for ' +
          (s.activitySteps || []).length + ' steps');
      }
      (s.activitySteps || []).forEach(function (a) {
        if (!findStep(m.r, a.text)) { unreachable.push(s.id + ' step ' + a.n + ': ' + a.text); }
      });
      /* the error watch is its own control class so nothing confuses "a rubric
         step" with "an error mark" */
      if (errButtons(m.r).length !== (s.criticalErrors || []).length) {
        unreachable.push(s.id + ': critical-error watch is the wrong length');
      }
      m.r.unmount();
    });
    t.eq(mounted, 8, 'all 8 packets rendered a runner without throwing');
    t.eq(unreachable.length, 0,
      'every activityStep in every packet has its own control' +
      (unreachable.length ? ' — missing: ' + unreachable.slice(0, 5).join(' | ') : ''));

    /* ================================================================== */
    t.group('the ordering gate flags skipping, not local reordering');

    var ards = M.simById('ms2lab-ards');
    var rub = M.buildRubric(ards);

    t.ok(!M.orderGate(rub, {}, 's1'), 'the first step is never out of sequence');
    t.ok(!M.orderGate(rub, {}, 's2'), 'a neighbour inside the lookahead window is fine');
    t.ok(!M.orderGate(rub, {}, 's3'), 'two steps of local reordering is fine');
    var farGate = M.orderGate(rub, {}, 's12');
    t.ok(!!farGate, 'jumping to escalation from a cold start IS out of sequence');
    if (farGate) {
      t.eq(farGate.phase, 'prep', 'the gate names the phase of the earliest skipped step');
      var coach = M.gateCoachLine(farGate);
      t.contains(coach, 'preparation', 'the coaching line names the phase');
      t.notContains(coach, 'Receive and review patient chart',
        'the coaching line never names the step it is protecting');
      t.notContains(coach, 'identity', 'nor any other step text');
    }

    /* the documented order flags nothing, in any packet */
    var docFlags = 0, docPicks = 0;
    sims.forEach(function (s) {
      var rb = M.buildRubric(s), done = {};
      rb.steps.forEach(function (st) {
        docPicks++;
        if (M.orderGate(rb, done, st.id)) { docFlags++; }
        done[st.id] = true;
      });
    });
    t.eq(docFlags, 0,
      'running all 8 packets in the printed order flags nothing (' + docPicks + ' picks)');

    /* a locally shuffled but sane run is not punished either */
    var shufFlags = 0;
    sims.forEach(function (s) {
      var rb = M.buildRubric(s), done = {}, ids = [], i;
      rb.criticals.forEach(function (c) { ids.push(c.id); });
      var order = [];
      for (i = 0; i < ids.length; i += 2) { order = order.concat(ids.slice(i, i + 2).reverse()); }
      order.forEach(function (id) {
        if (M.orderGate(rb, done, id)) { shufFlags++; }
        done[id] = true;
      });
    });
    t.eq(shufFlags, 0, 'swapping neighbouring critical steps is never flagged');

    /* non-critical housekeeping is never gated */
    var timing = rub.steps.filter(function (s2) { return M.isTimingStep(s2); })[0];
    t.ok(!!timing, 'ARDS ends on the "complete within the 20-minute time" line');
    if (timing) {
      t.ok(!timing.critical, 'that line is not a critical step');
      t.ok(!M.orderGate(rub, {}, timing.id),
        'and it is never flagged out of sequence — non-critical work does not gate');
    }

    /* ================================================================== */
    t.group('the interpretation gate is about reading, not order');

    var interpretStep = rub.steps.filter(function (s2) { return s2.phase === 'interpret'; })[0];
    t.ok(!!interpretStep, 'ARDS has interpretation steps');
    if (interpretStep) {
      t.ok(!!M.readGate(rub, {}, interpretStep.id),
        'an interpretation step with the labs unread is gated');
      t.ok(!M.readGate(rub, { labs: true }, interpretStep.id),
        'once the labs have been opened it is not');
      t.contains(M.readCoachLine(), 'laborator',
        'the read-gate sentence says what was not read');
      t.notContains(M.readCoachLine(), interpretStep.text,
        'and it still never names the step');
    }

    /* ================================================================== */
    t.group('a held-back attempt stays enabled and is NOT scored');

    var m1 = mountRunner(w, ards, { durationMin: 20 });
    var esc = ards.activitySteps.filter(function (a) { return a.phase === 'escalate'; })[0];
    var card = findStep(m1.r, esc.text);
    t.ok(!!card, 'the escalation step is on the board');
    t.ok(card && !card.disabled, 'it starts enabled');

    m1.r.click(card);
    var after1 = findStep(m1.r, esc.text);
    t.ok(after1 && !after1.disabled,
      'after a held-back attempt the control is STILL ENABLED');
    t.match(after1 ? after1.className : '', /outorder/,
      'it shows the amber held-back state');
    t.contains(after1 ? after1.textContent : '', 'Tap again',
      'the card offers the override in as many words');
    var fb1 = feedbackText(m1.r);
    t.contains(fb1, 'has NOT been recorded', 'the student is told nothing was recorded');
    t.contains(fb1, 'preparation', 'the coaching line names the open phase');
    t.notContains(fb1, 'Receive and review patient chart',
      'the coaching line does not name the step that is actually next');

    /* ================================================================== */
    t.group('a second activation commits it as out of sequence');

    m1.r.click(findStep(m1.r, esc.text));
    var after2 = findStep(m1.r, esc.text);
    t.ok(after2 && after2.disabled, 'after the override the step is committed');
    t.match(after2 ? after2.className : '', /usedmid/,
      'a committed out-of-sequence step has its own amber class, not a dead grey');
    t.contains(after2 ? after2.textContent : '', 'out of sequence',
      'the card says why it is amber');

    m1.r.click(m1.r.button(/End & debrief/));
    var payload1 = m1.finished.payload;
    t.ok(!!payload1, 'the run finished and reported');
    if (payload1) {
      var sc1 = M.scoreRun(ards, payload1.run);
      var escMark = sc1.marks.filter(function (mk) { return mk.text === esc.text; })[0];
      t.eq(escMark ? escMark.verdict : '', 'out-of-sequence',
        'the step is marked out of sequence exactly once — the held-back attempt was never recorded');
      t.eq(sc1.outOfSequence, 1, 'exactly one out-of-sequence mark in the whole run');
      t.eq(payload1.run.order.length, 1,
        'the shared step log contains ONE entry, not two (the hold-back wrote nothing)');
    }
    m1.r.unmount();

    /* ================================================================== */
    t.group('a critical error forces a hard fail, whatever else went right');

    var m2 = mountRunner(w, ards, { durationMin: 20 });
    /* perform the whole sheet in the printed order first, so nothing except the
       critical error can be the reason for the verdict */
    performAll(m2.r, ards);
    var perfect = null;
    m2.r.click(m2.r.button(/End & debrief/));
    perfect = m2.finished.payload;
    t.ok(!!perfect, 'the clean run reported');
    var cleanScore = perfect ? M.scoreRun(ards, perfect.run) : null;
    if (cleanScore) {
      t.eq(cleanScore.criticalMissed.length, 0, 'the clean run missed no critical step');
      t.eq(cleanScore.hardFail, false, 'the clean run is not a hard fail');
      t.eq(cleanScore.verdict, 'pass', 'the clean run passes');
    }
    m2.r.unmount();

    var m3 = mountRunner(w, ards, { durationMin: 20 });
    performAll(m3.r, ards);
    var errBtns = errButtons(m3.r);
    t.ok(errBtns.length > 0, 'the critical-error watch is on screen (' + errBtns.length + ' lines)');
    m3.r.click(errBtns[0]);
    m3.r.click(m3.r.button(/End & debrief/));
    var failed = m3.finished.payload;
    t.ok(!!failed, 'the run with the marked error reported');
    if (failed) {
      var sc3 = M.scoreRun(ards, failed.run);
      t.eq(sc3.hardFail, true, 'one marked critical error is a hard fail');
      t.eq(sc3.verdict, 'fail', 'the verdict is fail, not not-yet');
      t.eq(sc3.passed, false, 'passed is false even though every step was performed');
      t.eq(sc3.done, sc3.total, '...and every step really was performed (' + sc3.done + ')');
      t.contains(str(sc3.reasons.join(' ')), 'Critical error observed',
        'the reason names it as a critical error');
      t.contains(str(sc3.errors[0].text), str(ards.criticalErrors[0]).slice(0, 30),
        'the error is quoted in the packet\'s own words');
      t.eq(M.VERDICT_META.fail.label, 'HARD FAIL', 'and it is stated as a hard fail');
    }
    m3.r.unmount();

    /* the same thing purely, with no DOM in the way */
    var pureRun = M.foldEvents(
      M.initialRun({ simId: 'ms2lab-ards', durationSec: 1200 }),
      [{ t: 'start', at: 1000 }, { t: 'error', idx: 2, text: 'x', at: 2000 }]);
    t.eq(M.scoreRun(ards, pureRun).verdict, 'fail',
      'scoreRun() alone reaches the same verdict from the event list');

    /* ================================================================== */
    t.group('the hint ladder escalates and only tier 3 names the step');

    var target = M.nextStep(rub, {});
    t.eq(target.id, 's1', 'the hint target is the earliest undone critical step');
    var h1 = M.hintForTier(target, 1, { secsLeft: 600 });
    var h2 = M.hintForTier(target, 2, { secsLeft: 600 });
    var h3 = M.hintForTier(target, 3, { secsLeft: 600 });

    t.notContains(h1.body, target.text, 'tier 1 does NOT name the step');
    t.notContains(h1.body, target.coachTip, 'tier 1 does not leak the coach tip either');
    t.notContains(h1.body, target.evidence, 'nor the evidence line');
    t.contains(h1.body, 'PREPARATION', 'tier 1 gives the phase and only the phase');
    t.notContains(h2.body, target.text, 'tier 2 still does NOT name the step');
    t.contains(h2.body, '10:00', 'tier 2 says why it is time-critical right now');
    t.contains(h3.body, target.text, 'tier 3 finally names the step');
    t.contains(h3.body, target.coachTip, 'tier 3 carries the coach tip');
    t.deepEq([h1.weight, h2.weight, h3.weight], [1, 2, 3], 'the tiers cost 1, 2 and 3');
    t.contains(h1.title, '1/3', 'the tier announces itself');
    t.contains(h3.title, '3/3', 'and so does the last one');

    /* every packet, every phase: tier 1 and 2 must never leak */
    var leaks = 0, checked = 0;
    sims.forEach(function (s) {
      M.buildRubric(s).steps.forEach(function (st) {
        checked++;
        var a = M.hintForTier(st, 1, {}), b = M.hintForTier(st, 2, {});
        if (st.text && (a.body.indexOf(st.text) !== -1 || b.body.indexOf(st.text) !== -1)) {
          leaks++;
        }
      });
    });
    t.eq(leaks, 0, 'across all ' + checked + ' steps in all 8 packets, tiers 1 and 2 leak nothing');

    /* the ladder is costed, and the cost is capped */
    var hinted = M.foldEvents(M.initialRun({ simId: 'x', durationSec: 1200 }),
      [{ t: 'start', at: 0 },
        { t: 'hint', id: 's1', tier: 1, at: 1 },
        { t: 'hint', id: 's1', tier: 2, at: 2 },
        { t: 'hint', id: 's1', tier: 3, at: 3 }]);
    t.eq(M.scoreRun(ards, hinted).hintPenalty, 6, 'a full ladder (1+2+3) costs 6 points');
    var many = M.initialRun({ simId: 'x', durationSec: 1200 });
    many.hints = [];
    for (var hi = 0; hi < 20; hi++) { many.hints.push({ tier: 3 }); }
    t.eq(M.scoreRun(ards, many).hintPenalty, M.HINT_CAP, 'the hint penalty is capped');

    /* and through the UI */
    var m4 = mountRunner(w, ards, { durationMin: 20 });
    m4.r.click(m4.r.button(/^Hint$/));
    var t1 = feedbackText(m4.r);
    t.contains(t1, '1/3', 'the first ask is tier 1');
    t.notContains(t1, ards.activitySteps[0].text, 'and it does not name the step');
    m4.r.click(m4.r.button(/^Hint$/));
    var t2 = feedbackText(m4.r);
    t.contains(t2, '2/3', 'asking again escalates');
    t.notContains(t2, ards.activitySteps[0].text, 'tier 2 still does not name the step');
    m4.r.click(m4.r.button(/^Hint$/));
    var t3 = feedbackText(m4.r);
    t.contains(t3, '3/3', 'the third ask is tier 3');
    t.contains(t3, ards.activitySteps[0].text, 'tier 3 names it');
    m4.r.unmount();

    /* ================================================================== */
    t.group('pause freezes the clock and resume does not fast-forward');

    ['pause', 'resume', 'togglePause', 'isPaused', 'canPause', 'onPauseChange', 'pauseStats']
      .forEach(function (verb) {
        t.eq(typeof M[verb], 'function', 'MS2LabMode.' + verb + '() is exported');
      });
    t.eq(typeof M.pauseRun, 'function', 'the *Run alias is exported too');
    t.eq(typeof M.pauseControl, 'object', 'the bundled pauseControl exists');
    t.eq(M.pauseControl.id, 'ms2lab', 'the control identifies itself as ms2lab');
    t.ok(!!w.MMPause && typeof w.MMPause.register === 'function',
      'the shared MMPause registry exists');
    t.eq(w.MMPause.get('ms2lab'), M.pauseControl,
      'the control is registered in window.MMPause under id "ms2lab"');
    t.eq(M.isPaused(), false, 'with nothing mounted, isPaused() is false and harmless');

    /* the invariant, on the pure derivation, with synthetic timestamps */
    var T0 = 1000000;
    var pr = M.foldEvents(M.initialRun({ simId: 'ms2lab-ards', durationSec: 1200 }),
      [{ t: 'start', at: T0 }]);
    t.eq(M.elapsedSec(pr, T0 + 10000), 10, '10 real seconds is 10 elapsed seconds');
    t.eq(M.remainingSec(pr, T0 + 10000), 1190, 'the countdown tracks it');

    var paused = M.applyEvent(pr, { t: 'pause', at: T0 + 10000 });
    t.eq(paused.paused, true, 'the run is paused');
    t.eq(M.elapsedSec(paused, T0 + 10000), 10, 'the clock reads the same the instant it pauses');
    t.eq(M.elapsedSec(paused, T0 + 40000), 10,
      '30 seconds later, while paused, the clock has NOT moved');
    t.eq(M.remainingSec(paused, T0 + 40000), 1190, 'and neither has the countdown');

    var resumed = M.applyEvent(paused, { t: 'resume', at: T0 + 40000 });
    t.eq(resumed.paused, false, 'the run resumes');
    t.eq(resumed.pausedMs, 30000, 'the 30 paused seconds are banked separately');
    t.eq(M.elapsedSec(resumed, T0 + 40000), 10,
      'at the instant of resume the clock is still 10 — it did NOT fast-forward to 40');
    t.eq(M.elapsedSec(resumed, T0 + 41000), 11,
      'one second after resuming it reads 11, exactly where it stopped plus one');
    t.eq(M.remainingSec(resumed, T0 + 41000), 1189, 'the countdown picks up in the same place');
    t.eq(resumed.pauseCount, 1, 'the pause is counted for the debrief');

    /* a second pause/resume cycle banks on top rather than replacing */
    var again = M.applyEvent(
      M.applyEvent(resumed, { t: 'pause', at: T0 + 41000 }),
      { t: 'resume', at: T0 + 101000 });
    t.eq(again.pausedMs, 90000, 'two pauses bank 30s + 60s = 90s');
    t.eq(M.elapsedSec(again, T0 + 102000), 12, 'and the run clock is still only 12 seconds old');
    t.eq(again.pauseCount, 2, 'both pauses are counted');

    /* through the DOM */
    var m5 = mountRunner(w, ards, { durationMin: 20 });
    var pauseBtn = m5.r.button(/Pause/);
    t.ok(!!pauseBtn, 'there is a Pause button');
    t.eq(clockText(m5.r), '20:00', 'the countdown starts at the packet duration');
    m5.r.click(pauseBtn);
    t.ok(!!m5.r.find('.ms2-veil'), 'pausing raises the veil over the stage');
    t.contains(m5.r.find('.ms2-veilcard').textContent, 'no time is skipped forward',
      'the veil says in as many words that resume does not fast-forward');
    t.eq(clockText(m5.r), '20:00', 'the displayed clock is frozen');
    t.eq(M.isPaused(), true, 'the shared MMPause control reports the mounted run as paused');
    var stats = M.pauseStats();
    t.eq(stats.paused, true, 'pauseStats() agrees');
    t.eq(stats.pauseCount, 1, 'pauseStats() counts the pause');
    /* a paused run refuses work rather than silently swallowing it */
    m5.r.click(findStep(m5.r, ards.activitySteps[0].text));
    t.contains(feedbackText(m5.r), 'paused', 'acting while paused says so');
    var stillThere = findStep(m5.r, ards.activitySteps[0].text);
    t.ok(stillThere && !stillThere.disabled, 'and the step is not consumed by the attempt');
    m5.r.click(m5.r.button(/Resume/));
    t.ok(!m5.r.find('.ms2-veil'), 'resuming lowers the veil');
    t.eq(M.isPaused(), false, 'and the shared control agrees');
    m5.r.unmount();
    t.eq(M.pauseStats().active, false,
      'after unmount the registry control is inert (nothing outlives the component)');

    /* ================================================================== */
    t.group('the packet that states no duration is handled honestly');

    var hf = M.simById('ms2lab-heart-failure');
    t.eq(hf.durationMin, null, 'the heart-failure packet really does state no duration');
    var others = sims.filter(function (s) { return s.id !== 'ms2lab-heart-failure'; });
    t.ok(others.every(function (s) { return s.durationMin === 20; }),
      'the other seven all state 20 minutes');

    /* nothing invents 20 for it */
    var src2 = read('js/ms2lab.js');
    t.notContains(src2, 'durationMin || 20',
      'the source never falls back to 20 for a packet that does not state one');

    var pb = null;
    actIn(function () {
      pb = H.renderInto(w, React.createElement(w.MS2LabPreBrief, {
        sim: hf, onBack: function () {}, onStart: function () {}
      }));
    });
    var pbText = pb.text();
    t.contains(pbText, 'does not state a simulation length',
      'the pre-brief says plainly that this packet states no length');
    t.contains(pbText, 'No limit', 'and offers an untimed run');
    t.contains(pbText, '20 min', 'alongside the usual presets');
    t.notContains(pbText, 'The packet states 20 minutes',
      'it does NOT claim the packet states 20 minutes');
    pb.unmount();

    /* the runner with no limit counts up instead of down, and never expires */
    var noLimit = M.foldEvents(M.initialRun({ simId: hf.id, durationSec: 0 }),
      [{ t: 'start', at: T0 }]);
    t.eq(M.remainingSec(noLimit, T0 + 999999), null,
      'remainingSec() is null when no duration was chosen');
    t.eq(M.expired(noLimit, T0 + 999999), false, 'an untimed run can never expire');
    t.eq(M.elapsedSec(noLimit, T0 + 65000), 65, 'it counts up instead');

    var m6 = mountRunner(w, hf, { durationMin: 0 });
    t.eq(clockText(m6.r), '+0:00', 'the untimed clock counts up from +0:00');
    t.contains(m6.r.text(), 'no stated limit', 'and labels itself as untimed');
    t.eq(stepButtons(m6.r).length, hf.activitySteps.length,
      'the untimed packet still exposes all ' + hf.activitySteps.length + ' steps');
    m6.r.unmount();

    /* a timed run does expire, and the timing step cannot be claimed after it */
    var timed = M.foldEvents(M.initialRun({ simId: 'ms2lab-ards', durationSec: 1200 }),
      [{ t: 'start', at: T0 }]);
    t.eq(M.expired(timed, T0 + 1199000), false, 'not expired at 19:59');
    t.eq(M.expired(timed, T0 + 1201000), true, 'expired at 20:01');

    /* ================================================================== */
    t.group('the timing step is a claim, not a free tick');

    var m7 = mountRunner(w, ards, { durationMin: 20 });
    var timingBtn = findStep(m7.r, timing.text);
    t.ok(!!timingBtn, 'the "complete within the time" line is on the sheet');
    m7.r.click(timingBtn);
    t.contains(feedbackText(m7.r), 'still open',
      'claiming it with graded work outstanding is refused, with the count');
    var timingAfter = findStep(m7.r, timing.text);
    t.ok(timingAfter && !timingAfter.disabled, 'and the line is not consumed by the refusal');
    m7.r.unmount();

    /* ================================================================== */
    t.group('scoring is against activitySteps and nothing else');

    var half = M.initialRun({ simId: 'ms2lab-ards', durationSec: 1200 });
    half.startedAt = T0;
    half.done = { s1: { verdict: 'good', atSec: 5 }, s2: { verdict: 'mid', atSec: 9 } };
    var hs = M.scoreRun(ards, half);
    t.eq(hs.total, ards.activitySteps.length, 'the sheet is exactly as long as the packet');
    t.eq(hs.marks.length, ards.activitySteps.length, 'one mark per step, no more, no fewer');
    t.eq(hs.done, 1, 'one performed');
    t.eq(hs.outOfSequence, 1, 'one out of sequence');
    t.eq(hs.missed, ards.activitySteps.length - 2, 'the rest missed');
    t.eq(hs.verdict, 'not-yet', 'missing critical steps is a not-yet, not a fail');
    t.contains(str(hs.reasons.join(' ')), 'Critical step',
      'the reason names the missing critical steps');
    t.eq(hs.marks[0].verdict, 'done', 'a performed step reads "done"');
    t.eq(hs.marks[1].verdict, 'out-of-sequence', 'an override reads "out-of-sequence"');
    t.eq(hs.marks[2].verdict, 'missed', 'an untouched step reads "missed"');
    t.ok(hs.marks[0].text === ards.activitySteps[0].text,
      'the mark carries the packet\'s own wording, not a paraphrase');

    /* an out-of-sequence step is still a performed step */
    var allMid = M.initialRun({ simId: 'ms2lab-ards', durationSec: 1200 });
    allMid.startedAt = T0;
    allMid.done = {};
    M.buildRubric(ards).steps.forEach(function (st) {
      allMid.done[st.id] = { verdict: 'mid', atSec: 1 };
    });
    var ms = M.scoreRun(ards, allMid);
    t.eq(ms.criticalMissed.length, 0, 'nothing is missed when everything was performed');
    t.eq(ms.pct, 50, 'but an all-out-of-sequence run scores half');
    t.eq(ms.verdict, 'not-yet', 'and half is a not-yet');

    /* ================================================================== */
    t.group('the run is a pure fold, so a room and a solo run agree');

    var evts = [
      { t: 'start', at: T0 },
      { t: 'chart', tab: 'labs', at: T0 + 1000 },
      { t: 'step', id: 's1', verdict: 'good', label: '1. x', at: T0 + 2000 },
      { t: 'step', id: 's1', verdict: 'good', label: '1. x', at: T0 + 2500 },
      { t: 'sbar', sbar: { situation: 'S', background: 'B', assessment: 'A', recommendation: 'R' },
        at: T0 + 3000 },
      { t: 'error', idx: 0, text: 'boom', at: T0 + 4000 },
      { t: 'error', idx: 0, text: 'boom', at: T0 + 4500 },
      { t: 'unerror', idx: 0, at: T0 + 5000 },
      { t: 'nonsense-from-a-newer-build', at: T0 + 5500 }
    ];
    var folded = M.foldEvents(M.initialRun({ simId: 'ms2lab-ards', durationSec: 1200 }), evts);
    t.eq(folded.order.length, 1, 'a duplicate step event is idempotent');
    t.eq(folded.seen.labs, true, 'opening the labs is recorded for the read gate');
    t.eq(folded.errors.length, 0, 'a marked error can be withdrawn before the debrief');
    t.eq(folded.sbar.situation, 'S', 'the SBAR is carried in shared state');
    t.noThrow(function () { M.applyEvent(folded, null); },
      'an unrecognised or null event is ignored, never thrown on');
    t.noThrow(function () { M.applyEvent(folded, { t: 'step' }); },
      'a step event with no id is ignored');

    /* folding the same list twice gives the same run - the property a room needs */
    var folded2 = M.foldEvents(M.initialRun({ simId: 'ms2lab-ards', durationSec: 1200 }), evts);
    t.deepEq(folded2.done, folded.done, 'two clients folding the same list agree on the marks');
    t.eq(folded2.pausedMs, folded.pausedMs, '...and on the clock');

    /* nothing lands before the start event */
    var early = M.foldEvents(M.initialRun({ simId: 'x', durationSec: 1200 }),
      [{ t: 'step', id: 's1', verdict: 'good', at: 1 }]);
    t.eq(Object.keys(early.done).length, 0, 'a step submitted before the start is ignored');

    /* ================================================================== */
    t.group('multiplayer reuses Code Blue\'s room infrastructure');

    t.eq(M.ROOM_BASE, 'codeblue/rooms',
      'rooms live under the EXISTING /codeblue/rooms path — no second room system');
    t.eq(M.ROOM_STATUS_OPEN, 'ms2lab-open',
      'but with its own status, so a lab room cannot appear in the Code Blue lobby');
    t.notContains(M.ROOM_STATUS_OPEN, 'open"', 'the status is not the bare "open" Code Blue lists');

    var cb = read('js/codeblue.js');
    t.match(cb, /status\s*===\s*'open'/,
      'Code Blue really does filter its lobby on status === "open" (this is why ours differs)');

    t.eq(M.normalizeCode('ab-1cd9'), 'ABCD', 'room codes normalise to four letters');
    t.eq(M.randCode().length, 4, 'a generated code is four letters');
    t.match(M.randCode(), /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/,
      'and it avoids I, O, 0 and 1 exactly as Code Blue does');

    var roleIds = M.LAB_ROLES.map(function (r) { return r.id; });
    t.deepEq(roleIds, ['primary', 'second', 'recorder', 'proctor'],
      'the roles are the realistic med-surg ones, not code-team roles');
    t.eq(M.canMarkErrors('proctor', {}), true, 'the student proctor marks critical errors');
    t.eq(M.canMarkErrors('primary', { a: { role: 'proctor', connected: true } }), false,
      'with a proctor in the room, the primary nurse does not mark them');
    t.eq(M.canMarkErrors('primary', {}), true,
      'with no proctor claimed, the whole team can — which is also true in the lab');
    t.eq(M.isHandsOn('proctor'), false, 'the proctor is not hands on');
    t.eq(M.isHandsOn('primary'), true, 'the primary nurse is');

    /* room creation claims an empty node, so it can never take a Code Blue code */
    var fdb = txDb();
    fdb.seed('codeblue/rooms/AAAA', { code: 'AAAA', status: 'open' });
    var made = null;
    M.createRoom(fdb, { mode: 'ms2lab', simId: 'ms2lab-ards' }, 'u1', 'Host', 'Test',
      function (e, id) { made = { e: e, id: id }; });
    t.ok(made && !made.e && made.id, 'createRoom() claims a code');
    if (made && made.id) {
      var rec = fdb.get('codeblue/rooms/' + made.id);
      t.eq(rec.status, 'ms2lab-open', 'the new room carries the ms2lab status');
      t.eq(rec.cfg.mode, 'ms2lab', 'and an ms2lab cfg');
      t.ok(made.id !== 'AAAA', 'it did not overwrite the existing Code Blue room');
    }
    t.eq(fdb.get('codeblue/rooms/AAAA').status, 'open',
      'the pre-existing Code Blue room is untouched');

    /* ================================================================== */
    t.group('Firebase: the results path degrades when the rule is missing');

    var rules = JSON.parse(read('firebase-rules.json'));
    t.eq(M.RESULTS_PATH, 'ms2lab/results', 'results are written under /ms2lab/results/<uid>');
    var hasRule = !!(rules.rules && rules.rules.ms2lab);
    t.ok(!!M.RESULTS_RULES && !!M.RESULTS_RULES.ms2lab,
      'the module publishes the exact rule snippet that path needs');
    t.contains(JSON.stringify(M.RESULTS_RULES), 'auth.uid === $uid',
      'the snippet scopes the write to the owning uid');
    if (!hasRule) {
      t.ok(true, 'firebase-rules.json has no /ms2lab block yet — the write is expected to be ' +
        'denied, so it must be a silent no-op (see the assertion below)');
    } else {
      t.ok(true, 'firebase-rules.json already carries an /ms2lab block');
    }

    /* a denied write must not cost the student their result */
    var denyDb = {
      ref: function () {
        return {
          push: function () { throw new Error('PERMISSION_DENIED'); },
          child: function () { return this; }
        };
      }
    };
    var savedProgress = null;
    var rec = null;
    t.noThrow(function () {
      rec = M.persistResult(ards, M.scoreRun(ards, half), half, {
        setProgress: function (fn) { savedProgress = fn({ simResults: [] }); },
        uid: 'u-test', db: denyDb, runMode: 'solo'
      });
    }, 'persistResult() survives a denied Firebase write without throwing');
    t.ok(!!rec, 'and still returns the record');
    t.ok(savedProgress && savedProgress.simResults && savedProgress.simResults.length === 1,
      'and the result still lands in progress.simResults, which is the path that matters');
    var row = (savedProgress && savedProgress.simResults) ? savedProgress.simResults[0] : {};
    t.eq(row.mode, 'ms2lab', 'the record is tagged mode:"ms2lab"');
    t.eq(row.simId, 'ms2lab-ards', 'and carries the packet id');
    t.eq(row.category, 'Med-Surg II Simulation Lab', 'and a readable category');

    var best = M.bestFor({ simResults: [
      { simId: 'ms2lab-ards', mode: 'ms2lab', pct: 62, passed: false },
      { simId: 'ms2lab-ards', mode: 'ms2lab', pct: 88, passed: true },
      { simId: 'ms2lab-dic', mode: 'ms2lab', pct: 99, passed: true }
    ] }, 'ms2lab-ards');
    t.eq(best.best, 88, 'the readiness indicator reports the best prior score');
    t.eq(best.attempts, 2, 'over the right number of attempts');
    t.eq(best.passed, true, 'and remembers that one of them passed');
    t.eq(M.bestFor({}, 'ms2lab-ards'), null, 'an untouched topic has no readiness score');

    /* ================================================================== */
    t.group('the AI follows the one house convention and never blocks the run');

    var gt = M.groundTruth(ards);
    t.contains(gt, 'John Smith', 'the ground truth carries the chart');
    t.contains(gt, '7.48', 'and the lab values');
    t.contains(gt, 'Oxygen 2L Nasal Cannula', 'and the provider orders verbatim');
    t.contains(gt, 'Ceftriaxone 1 g IC', 'including the packet\'s own MAR typo, unfixed');
    t.contains(gt, 'marking sheet', 'and the rubric, labelled as the marking sheet');
    t.contains(gt, 'KNOWN DEFECTS', 'and the sourceNote caveats');
    t.contains(M.patientSystem(ards), 'THE PACKET IS THE TRUTH',
      'the patient prompt is told the packet outranks it');
    t.contains(M.patientSystem(ards), 'NEVER HAND OVER THE RUBRIC',
      'and told not to hand over the next step');
    t.contains(M.sbarSystem(ards), 'REFERENCE SBAR',
      'the SBAR prompt carries the packet\'s reference report');

    var icp = M.simById('ms2lab-icp');
    t.contains(M.groundTruth(icp), 'SpO2 <95',
      'the ICP packet\'s backwards oxygen order reaches the AI verbatim, uncorrected');

    t.deepEq(M.AI_FEATURES, { patient: 'patient', sbar: 'sbar', debrief: 'debrief' },
      'the feature tags are real ids from KNOWN_FEATURES, not invented ones');
    var aiSrc = read('js/ai.js');
    Object.keys(M.AI_FEATURES).forEach(function (k) {
      t.contains(aiSrc, "'" + M.AI_FEATURES[k] + "'",
        'js/ai.js knows the "' + M.AI_FEATURES[k] + '" feature id (so it routes and bills)');
    });
    t.ok(M.TOKEN_CAPS.repair >= M.TOKEN_CAPS.sbar,
      'the repair attempt gets at least the biggest ceiling — resending the same ' +
      'budget just truncates the repair identically');

    /* the salvage path */
    t.eq(M.completeTruncatedJSON('{"observable":"leaning forwar'),
      null, 'a salvage with no usable content is refused... ');
    var sal = M.completeTruncatedJSON('{"say":"I cannot catch my breath","observable":"leaning forwar');
    t.ok(!!sal, '...but a truncated reply that still has a say line is recovered');
    t.eq(sal ? sal.say : '', 'I cannot catch my breath', 'and the complete field survives intact');
    t.eq(M.completeTruncatedJSON('{"say":"fine"}'), null,
      'a COMPLETE object is refused by the salvage (the failure is elsewhere)');
    t.eq(M.completeTruncatedJSON('not json at all'), null, 'and junk is refused');
    t.eq(M.parseJsonReply('```json\n{"score":80}\n```').score, 80,
      'parseJsonReply() strips a markdown fence');
    t.eq(M.parseJsonReply('Here you go: {"score":70} hope that helps').score, 70,
      'and carves the object out of surrounding prose');
    t.eq(M.parseJsonReply('{"score":70,}').score, 70, 'and repairs a trailing comma');
    t.eq(M.parseJsonReply(''), null, 'an empty reply is null, not a throw');

    /* with no AI at all, the run is unaffected */
    var noAiWorld = H.makeWorld({ tier: 'free' });
    noAiWorld.load('data/ms2lab.js');
    noAiWorld.load('js/ms2lab.js');
    var nw = noAiWorld.window;
    repin(noAiWorld);
    delete nw.MM.ai;
    t.eq(nw.MS2LabMode.aiReady(), false, 'aiReady() is false with no MM.ai');
    var noAiRun = null;
    t.noThrow(function () {
      actIn(function () {
        noAiRun = H.renderInto(nw, React.createElement(nw.MS2LabRunner, {
          sim: nw.MS2LabMode.simById('ms2lab-sepsis'), durationMin: 20, runMode: 'ai',
          uid: 'u', name: 'N', onFinish: function () {}, onQuit: function () {}
        }));
      });
    }, 'an AI-mode run mounts with no AI available at all');
    if (noAiRun) {
      t.ok(stepButtons(noAiRun).length > 0, 'and still exposes the full rubric');
      t.contains(noAiRun.text(), 'Running without the AI patient',
        'and says plainly that it degraded to solo');
      noAiRun.unmount();
    }
    var resolvedNull = null;
    return Promise.resolve(nw.MS2LabMode.askPatient(nw.MS2LabMode.simById('ms2lab-ards'), 'hi', []))
      .then(function (v) { resolvedNull = v; })
      .then(function () {
        t.eq(resolvedNull, null, 'askPatient() resolves null rather than rejecting when AI is off');
        return Promise.resolve(nw.MS2LabMode.gradeSbar(nw.MS2LabMode.simById('ms2lab-ards'), {}));
      })
      .then(function (v) {
        t.eq(v, null, 'gradeSbar() resolves null too — the caller degrades, never blocks');
        noAiWorld.cleanup();
        repin(world);

        /* ============================================================== */
        t.group('the module survives a missing MS2_LAB_SIMS');

        var bare = H.makeWorld({ tier: 'pro' });
        /* deliberately NOT loading data/ms2lab.js */
        bare.load('js/ms2lab.js');
        var bw = bare.window;
        repin(bare);
        t.eq(typeof bw.MS2LabMode, 'function', 'the module still loads with no data file');
        t.eq(bw.MS2LabMode.allSims().length, 0, 'allSims() is empty rather than throwing');
        t.eq(bw.MS2LabMode.contentOk(), false, 'contentOk() reports the content is missing');
        t.eq(bw.MS2LabMode.simById('anything'), null, 'simById() returns null, not undefined-boom');
        t.noThrow(function () { bw.MS2LabMode.buildRubric(undefined); },
          'buildRubric(undefined) does not throw');
        t.eq(bw.MS2LabMode.buildRubric(undefined).total, 0, 'it returns an empty rubric');
        t.noThrow(function () { bw.MS2LabMode.scoreRun(undefined, undefined); },
          'scoreRun(undefined, undefined) does not throw');

        var bareRender = null;
        t.noThrow(function () {
          actIn(function () {
            bareRender = H.renderInto(bw, React.createElement(bw.MS2LabMode, {
              progress: {}, setProgress: function () {},
              authUser: { uid: 'u', email: 'a@b.c' }, isAdmin: false, isSuperAdmin: false
            }));
          });
        }, 'the page component renders with no content instead of crashing');
        if (bareRender) {
          t.contains(bareRender.text(), 'could not load',
            'and shows a clear "content failed to load" state, the way modulePage() does');
          t.ok(!!bareRender.button(/Reload/), 'with a way out');
          bareRender.unmount();
        }
        bare.cleanup();
        repin(world);

        /* ============================================================== */
        t.group('the page component takes the shell\'s props without complaint');

        var page = null;
        t.noThrow(function () {
          actIn(function () {
            page = H.renderInto(w, React.createElement(w.MS2LabMode, {
              progress: { simResults: [
                { simId: 'ms2lab-ards', mode: 'ms2lab', pct: 91, passed: true }
              ] },
              setProgress: function () {},
              authUser: { uid: 'u-test', email: 'student@example.edu' },
              isAdmin: false, isSuperAdmin: false
            }));
          });
        }, 'MS2LabMode({progress, setProgress, authUser, isAdmin, isSuperAdmin}) renders');
        if (page) {
          var txt = page.text();
          t.contains(txt, 'Med-Surg II Simulation Lab', 'the picker names the mode');
          t.contains(txt, 'NUR2212C', 'and the course code');
          t.contains(txt, 'Best 91%', 'and the readiness indicator from prior results');
          t.ok(page.all('button.ms2-topic').length === 8, 'all 8 topics are offered');
          page.unmount();
        }

        /* Signed out is a message, not a crash. The page falls back to
           MM.authUser the way CodeBlueMode does, so BOTH have to be absent for
           this to be the signed-out case at all. */
        var keepUser = w.MM.authUser, keepId = w.MM.myId;
        w.MM.authUser = null;
        w.MM.myId = '';
        var out = null;
        t.noThrow(function () {
          actIn(function () {
            out = H.renderInto(w, React.createElement(w.MS2LabMode, {
              progress: {}, setProgress: function () {}, authUser: null
            }));
          });
        }, 'the page renders signed out');
        if (out) {
          t.contains(out.text(), 'Sign in', 'and asks the student to sign in');
          t.notContains(out.text(), 'Something went wrong', 'without crashing the shell');
          out.unmount();
        }
        w.MM.authUser = keepUser;
        w.MM.myId = keepId;

        /* ...and it prefers the prop, exactly as CodeBlueMode does */
        var propUser = null;
        t.noThrow(function () {
          actIn(function () {
            propUser = H.renderInto(w, React.createElement(w.MS2LabMode, {
              progress: {}, setProgress: function () {},
              authUser: { uid: 'u-prop', email: 'p@q.r' },
              isAdmin: true, isSuperAdmin: true
            }));
          });
        }, 'the page renders from the authUser PROP with MM.authUser present');
        if (propUser) {
          t.contains(propUser.text(), 'Med-Surg II Simulation Lab',
            'and shows the picker, not the signed-out card');
          propUser.unmount();
        }

        /* ============================================================== */
        t.group('the pre-brief mirrors the packet front matter');

        var brief = null;
        var started = null;
        actIn(function () {
          brief = H.renderInto(w, React.createElement(w.MS2LabPreBrief, {
            sim: ards, onBack: function () {}, onStart: function (cfg) { started = cfg; }
          }));
        });
        var bt = brief.text();
        t.contains(bt, ards.introduction.slice(0, 60), 'the Introduction is shown verbatim');
        t.contains(bt, 'End of Program Student Learning Outcomes', 'the EOPSLOs are shown');
        ards.outcomes.forEach(function (o) {
          t.contains(bt, o.text.slice(0, 40), 'EOPSLO ' + o.n + ' is present');
        });
        t.contains(bt, 'Required knowledge', 'required knowledge is a self-assessment');
        t.eq(brief.all('input[type="checkbox"]').length, ards.requiredKnowledge.length,
          'one tickbox per required-knowledge line (' + ards.requiredKnowledge.length + ')');
        t.contains(bt, ards.sourceNote.slice(0, 50),
          'the sourceNote is SURFACED to the student, not hidden');
        t.contains(bt, 'The packet states 20 minutes', 'and the stated duration is quoted');
        brief.click(brief.button(/Start the simulation/));
        t.ok(!!started, 'Start reports the chosen configuration upward');
        t.eq(started ? started.durationMin : 0, 20, 'with the packet duration');
        t.eq(started ? started.mode : '', 'solo', 'and the chosen mode');
        brief.unmount();

        /* ============================================================== */
        t.group('the chart is one keystroke away and prints the packet\'s own ranges');

        t.eq(M.CHART_TABS.length, 8, 'eight chart tabs, keys 1-8');
        var chart = null;
        actIn(function () {
          chart = H.renderInto(w, React.createElement(w.MS2LabMode.ChartPanel, {
            sim: ards, tab: 'labs', onTab: function () {}, showInterpretation: false
          }));
        });
        var ct = chart.text();
        t.contains(ct, '19.2', 'the WBC value is on the labs tab');
        t.contains(ct, '5-10', 'next to the normal range PRINTED IN THE PACKET');
        t.contains(ct, 'CRITICAL HIGH', 'and flagged');
        t.notContains(ct, 'Marked leukocytosis',
          'the interpretation is withheld until the student performs an interpretation step');
        chart.unmount();

        actIn(function () {
          chart = H.renderInto(w, React.createElement(w.MS2LabMode.ChartPanel, {
            sim: ards, tab: 'labs', onTab: function () {}, showInterpretation: true
          }));
        });
        t.contains(chart.text(), 'Marked leukocytosis',
          'and revealed once they have');
        chart.unmount();

        actIn(function () {
          chart = H.renderInto(w, React.createElement(w.MS2LabMode.ChartPanel, {
            sim: icp, tab: 'orders', onTab: function () {}, showInterpretation: false
          }));
        });
        t.contains(chart.text(), 'SpO2 <95',
          'the ICP packet\'s clinically backwards oxygen order is shown VERBATIM — ' +
          'noticing a bad order is a nursing skill');
        chart.unmount();

        /* ============================================================== */
        t.group('the debrief shows the sheet, the SBAR comparison and the packet teaching');

        var full = M.initialRun({ simId: 'ms2lab-ards', durationSec: 1200 });
        full.startedAt = T0;
        full.endedAt = T0 + 600000;
        full.ended = true;
        M.buildRubric(ards).steps.forEach(function (st) {
          full.done[st.id] = { verdict: 'good', atSec: 30, byName: '' };
        });
        full.sbar = { situation: 'MY SITUATION LINE', background: 'MY BACKGROUND',
          assessment: 'MY ASSESSMENT', recommendation: 'MY RECOMMENDATION' };

        var deb = null;
        actIn(function () {
          deb = H.renderInto(w, React.createElement(w.MS2LabDebrief, {
            sim: ards, run: full, setProgress: function () {}, uid: 'u-test',
            runMode: 'solo', onExit: function () {}, onAgain: function () {}
          }));
        });
        var dt = deb.text();
        t.contains(dt, 'PASS', 'a complete clean run reads PASS');
        ards.activitySteps.forEach(function (a) {
          t.contains(dt, a.text.slice(0, 35), 'step ' + a.n + ' appears on the marking sheet');
        });
        t.contains(dt, 'MY SITUATION LINE', 'the student\'s own SBAR is shown');
        t.contains(dt, ards.expectedSbar.situation.slice(0, 45),
          'next to the report this packet expects');
        ards.debriefQuestions.forEach(function (q, i) {
          t.contains(dt, q.slice(0, 35), 'debrief question ' + (i + 1) + ' is shown');
        });
        t.contains(dt, ards.pearls[0].slice(0, 35), 'the packet pearls are shown');
        t.contains(dt, ards.sourceNote.slice(0, 40), 'and the sourceNote again');
        deb.unmount();

        var failRun = M.initialRun({ simId: 'ms2lab-ards', durationSec: 1200 });
        failRun.startedAt = T0;
        failRun.ended = true;
        M.buildRubric(ards).steps.forEach(function (st) {
          failRun.done[st.id] = { verdict: 'good', atSec: 30 };
        });
        failRun.errors = [{ idx: 0, text: ards.criticalErrors[0], atSec: 40, byName: 'Tester' }];
        var deb2 = null;
        actIn(function () {
          deb2 = H.renderInto(w, React.createElement(w.MS2LabDebrief, {
            sim: ards, run: failRun, setProgress: function () {}, uid: 'u-test',
            runMode: 'solo', onExit: function () {}, onAgain: function () {}
          }));
        });
        var dt2 = deb2.text();
        t.contains(dt2, 'HARD FAIL', 'a marked critical error reads HARD FAIL at the top');
        t.contains(dt2, ards.criticalErrors[0].slice(0, 40),
          'and quotes the error in the packet\'s own words');
        t.contains(dt2, 'automatic fail', 'and says so plainly');
        deb2.unmount();

        /* ============================================================== */
        t.group('no unreadable controls (the dark-on-dark trap)');

        var css = read('js/ms2lab.js');
        var nearBlack = [];
        var re = /color\s*:\s*(#0{3,6}\b|#1[0-9a-f]{2}\b|black|buttontext)/gi, mm;
        while ((mm = re.exec(css))) {
          var around = css.slice(Math.max(0, mm.index - 60), mm.index);
          if (/--text-on-fill|text-on-fill/.test(around)) { continue; }
          nearBlack.push(mm[0]);
        }
        t.eq(nearBlack.length, 0,
          'no rule in ms2lab.js hardcodes near-black text' +
          (nearBlack.length ? ' — ' + nearBlack.slice(0, 4).join(', ') : ''));
        t.match(css, /\.ms2-root button\{[^}]*color:/,
          'the module normalizes its own buttons to an explicit colour');
        t.match(css, /\.ms2-step,\.ms2-errbtn\{[^}]*color:var\(--text/,
          'the step and error controls set their own colour, not just the global net');
        t.match(css, /prefers-reduced-motion/,
          'the shake honours prefers-reduced-motion');

        world.cleanup();
      });
  }
};
