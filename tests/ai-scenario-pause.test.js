/* ============================================================================
   ai-scenario-pause.test.js
   ----------------------------------------------------------------------------
   Pause / resume for the Live AI Patient mode.

   This mode is the hard case for a pause button, because it is the only one
   with real async work in flight: a /api/ai turn can settle while the student
   is away from the screen. The rules this suite pins down:

     1. Pausing FREEZES the scenario clock. Not "slows", not "keeps counting
        and subtracts later" - the number on screen stops moving.
     2. Resuming does not fast-forward. There is no accumulated-time catch-up
        burst, because paused time was never scenario time to begin with.
     3. A turn that resolves while paused is neither dropped nor applied. It is
        held, and it lands on resume. A paused sim never mutates patient state.
     4. While paused the student cannot act: every control is disabled AND the
        handlers refuse, because `disabled` on a button is cosmetic.
     5. Nothing this mode starts outlives the component. The module has a
        history of load-order races, and js/voice.js once leaked a module-scope
        retry timer across jsdom test worlds - so intervals and the document
        keydown listener are counted in and counted back out.

   Run:  node tests/run.js ai-scenario-pause
   ========================================================================== */
'use strict';

/* Node >= 21 makes `navigator` accessor-only; the harness assigns to it. */
(function () {
  try {
    var d = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    if (d && d.writable !== true) {
      Object.defineProperty(globalThis, 'navigator',
        { value: undefined, writable: true, configurable: true });
    }
  } catch (e) { /* older Node is fine */ }
})();

var fs = require('fs');
var path = require('path');
var React = require('react');
var H = require('./_harness.js');

/* ---------------------------------------------------------------------------
 * Source access.
 * The working folder accumulates orphaned `.fuse_hidden*` files - stale copies
 * the mount will not let us delete - and readdir returns them FIRST, because
 * dotfiles sort early. Reading one means asserting against a ghost copy of a
 * module instead of the real one. Same filter as ui-contrast.test.js.
 * ------------------------------------------------------------------------- */
function jsModules() {
  return fs.readdirSync(path.join(H.APP_ROOT, 'js'))
    .filter(function (f) { return /\.js$/.test(f) && f.charAt(0) !== '.'; })
    .map(function (f) { return 'js/' + f; });
}

function readModule(name) {
  var rel = jsModules().filter(function (f) { return f === 'js/' + name; })[0];
  if (!rel) throw new Error('js/' + name + ' is not in the module list');
  return fs.readFileSync(path.join(H.APP_ROOT, rel), 'utf8');
}

/* ------------------------------------------------------------------ fixtures */

var SCENARIO = {
  id: 'test-copd',
  title: 'COPD exacerbation',
  fullTitle: 'Acute COPD exacerbation with hypoxemia',
  category: 'Med-Surg 2',
  difficulty: 'Intermediate',
  summary: 'Air trapping and worsening hypoxemia in a known COPD patient.',
  patient: { name: 'Reference Patient', age: '71', sex: 'F', weightKg: 62, diagnosis: 'COPD exacerbation',
    history: ['COPD', '40 pack-year smoking history'] },
  vitalsTimeline: [{ atMin: 0, label: 'Baseline', bp: '138/84', hr: 104, rr: 24, spo2: 90, temp: '99.0 F' }],
  labs: [{ name: 'pH', value: '7.31', unit: '', status: 'low', normalRange: '7.35-7.45' }],
  orders: [{ text: 'Oxygen to keep SpO2 88-92%' }],
  medications: [{ name: 'Albuterol', classification: 'SABA', dose: '2.5 mg neb' }],
  interventions: [
    { id: 'iv1', order: 1, action: 'Apply oxygen and titrate to an SpO2 of 88 to 92 percent',
      category: 'intervention', critical: true, preventsDeterioration: true,
      rationale: 'Hypoxemia is what kills first.' },
    { id: 'iv2', order: 2, action: 'Auscultate lung sounds in all fields',
      category: 'assessment', critical: false },
    { id: 'iv3', order: 3, action: 'Notify the provider with an SBAR update',
      category: 'escalation', critical: true }
  ],
  criticalErrors: ['Administering a high-dose opioid to a patient who is retaining carbon dioxide'],
  pearls: ['Target SpO2 in COPD is 88 to 92 percent.']
};

var OPTIONS = [
  { id: 'a', text: 'Auscultate lung sounds in all fields', quality: 'correct' },
  { id: 'b', text: 'Document and continue rounds', quality: 'wrong' },
  { id: 'c', text: 'Recheck a full set of vital signs', quality: 'acceptable' },
  { id: 'd', text: 'Raise the head of the bed', quality: 'acceptable' }
];

function merge(base, extra) {
  var out = {}, k;
  for (k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k]; }
  for (k in (extra || {})) { if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k]; }
  return out;
}

function openingTurn(extra) {
  return JSON.stringify(merge({
    speaker: 'patient',
    narration: 'She is upright on the edge of the bed, shoulders working with every breath.',
    patientSpeech: 'I cannot catch my breath.',
    vitals: { bp: '138/88', hr: 112, rr: 26, temp: '99.1 F', spo2: 91, pain: '3/10', loc: 'Alert, anxious' },
    trend: 'stable',
    newFindings: ['Accessory muscle use'],
    feedbackOnLastAction: null,
    lastActionQuality: null,
    options: OPTIONS,
    phase: 'arrival',
    outcome: null, hint: null, rubricHits: [], scoreDelta: 0, isFinal: false,
    chart: {
      name: 'Dolores Marchetti', age: '68', sex: 'F', weightKg: '71', room: '412',
      admittingDx: 'COPD exacerbation', allergies: ['Penicillin'], codeStatus: 'Full Code',
      chiefComplaint: 'Increasing shortness of breath', history: ['COPD', 'Hypertension']
    }
  }, extra));
}

/* A graded turn. `wrong` costs 9, drift on Competent costs 3.5, so a run that
   opened at 60 lands on exactly 47.5 - a number that can be read off screen. */
function gradedTurn(extra) {
  return JSON.stringify(merge({
    speaker: 'instructor',
    narration: 'Nothing was assessed and the patient is working harder to breathe.',
    patientSpeech: null,
    vitals: { bp: '142/90', hr: 124, rr: 32, temp: '99.4 F', spo2: 86, pain: '3/10', loc: 'Drowsy' },
    trend: 'declining',
    newFindings: ['Speaking in three-word sentences'],
    feedbackOnLastAction: 'Charting is not an assessment. Airway and breathing come first.',
    lastActionQuality: 'wrong',
    options: OPTIONS,
    phase: 'assessment',
    outcome: null, hint: null, rubricHits: [], scoreDelta: -4, isFinal: false
  }, extra));
}

/* -------------------------------------------------------------------- doubles */

/** MM.ai.chat that hands the test the resolver for every call. */
function makeChat() {
  var pending = [];
  function chat(opts) {
    var rec = { opts: opts };
    rec.promise = new Promise(function (res, rej) { rec.resolve = res; rec.reject = rej; });
    pending.push(rec);
    return rec.promise;
  }
  chat.count = function () { return pending.length; };
  chat.last = function () { return pending[pending.length - 1] || null; };
  return chat;
}

/** MM.voice with only the surface ai-scenario.js is allowed to rely on. */
function makeVoice() {
  var v = {
    spoken: [], stops: 0, stopListens: 0, pending: null,
    isSupported: function () { return { stt: true, tts: true }; },
    prime: function () { /* noop */ },
    speak: function (text) {
      v.spoken.push(String(text));
      var rec = {};
      rec.promise = new Promise(function (res) { rec.done = res; });
      v.pending = rec;
      return rec.promise;
    },
    /* The real one has no pause: a stop ENDS the clip, and the promise settles
       exactly as it would have on a natural finish. That is the behaviour the
       queue in ai-scenario.js has to survive. */
    stopSpeaking: function () {
      v.stops++;
      var p = v.pending;
      v.pending = null;
      if (p) p.done();
    },
    isSpeaking: function () { return !!v.pending; },
    stopListening: function () { v.stopListens++; },
    correctMedicalTerms: function (s) { return s; }
  };
  return v;
}

/* --------------------------------------------------------------- act helpers */

function quiet(fn) {
  var ow = console.warn, oe = console.error;
  console.warn = function () {}; console.error = function () {};
  try { return fn(); } finally { console.warn = ow; console.error = oe; }
}

/** Run a synchronous mutation inside act() so its render is flushed. */
function actRun(fn) {
  return Promise.resolve(quiet(function () { return React.act(function () { fn(); }); }))
    .then(function () { return H.actTick(10); });
}

/* --------------------------------------------------------------- leak probes */

function trackIntervals() {
  var si = global.setInterval, ci = global.clearInterval;
  var live = {}, made = 0;
  global.setInterval = function () {
    var id = si.apply(null, arguments);
    made++; live[String(id)] = true;
    return id;
  };
  global.clearInterval = function (id) {
    delete live[String(id)];
    return ci.apply(null, arguments);
  };
  return {
    made: function () { return made; },
    liveCount: function () { return Object.keys(live).length; },
    restore: function () { global.setInterval = si; global.clearInterval = ci; }
  };
}

function trackKeydownListeners(doc) {
  var add = doc.addEventListener, rm = doc.removeEventListener;
  var live = 0;
  doc.addEventListener = function (type) {
    if (type === 'keydown') live++;
    return add.apply(doc, arguments);
  };
  doc.removeEventListener = function (type) {
    if (type === 'keydown') live--;
    return rm.apply(doc, arguments);
  };
  return {
    live: function () { return live; },
    restore: function () { doc.addEventListener = add; doc.removeEventListener = rm; }
  };
}

/* ------------------------------------------------------------------- mounting */

/**
 * A world with the Live AI Patient mode loaded and nothing else.
 * Deliberately does NOT load js/voice.js: it schedules a module-scope profile
 * retry at load, and a timer still pending when this world is torn down fires
 * against a stale global.window during a LATER suite. The mode feature-detects
 * MM.voice, so a double is both sufficient and safer.
 */
function scenarioWorld(opts) {
  opts = opts || {};
  var world = H.makeWorld({ tier: 'pro' });
  var w = world.window;
  var chat = makeChat();
  var voice = makeVoice();

  w.MM.ai = {
    chat: chat,
    isAvailable: function () { return true; },
    isResolving: function () { return false; },
    onResolved: function () { return function () {}; }
  };
  w.MM.voice = voice;
  w.ALL_SCENARIOS = [SCENARIO];

  world.load('js/ai-scenario.js');
  world.chat = chat;
  world.voice = voice;
  world.cfg = {
    scenario: SCENARIO,
    category: 'Med-Surg 2',
    topic: 'COPD exacerbation',
    difficultyId: 'competent',
    inputMode: (opts.inputMode || 'choice'),
    voiceOn: opts.voiceOn !== false,
    seed: 4242
  };
  return world;
}

function mountRun(world) {
  var w = world.window;
  return H.renderInto(w, React.createElement(w.AIScenarioRun, {
    cfg: world.cfg,
    onFinish: function () {},
    onExit: function () {}
  }));
}

function stabilityText(view) {
  var n = view.find('.ais-stab-num');
  return n ? (n.textContent || '').replace(/\s+/g, '') : '';
}
function clockText(view) {
  var n = view.find('.ais-clock b');
  return n ? (n.textContent || '').trim() : '';
}
function optionByText(view, rx) {
  return view.all('.ais-opt').filter(function (b) { return rx.test(b.textContent || ''); })[0] || null;
}
function isDisabled(el) {
  return !!el && (el.disabled === true || el.hasAttribute('disabled'));
}

module.exports = {
  name: 'ai-scenario-pause — freezing a live AI patient',

  run: function (t) {
    /* The run screen owns two 1-second intervals. They keep ticking in the gaps
       between act() windows, and React shouts about every state update it sees
       outside one. That noise is not a finding - the ticks are exactly what
       these tests are here to measure - so it is filtered for the whole suite
       and nothing else is. */
    var realErr = console.error;
    console.error = function (m) {
      if (String(m == null ? '' : m).indexOf('not wrapped in act') !== -1) return undefined;
      return realErr.apply(console, arguments);
    };
    function restore(v) { console.error = realErr; return v; }

    return Promise.resolve()

      /* ==================================================================== */
      /* 1. The time model, as a pure function                                */
      /* ==================================================================== */
      .then(function () {
        t.group('createPauseClock: paused time is not scenario time');

        var world = scenarioWorld();
        var mk = world.window.AIScenarioMode.createPauseClock;
        t.eq(typeof mk, 'function', 'createPauseClock is exported so the time model is testable');

        var now = 1000000;
        function fakeNow() { return now; }
        var c = mk(now, fakeNow);

        now += 5000;
        t.eq(c.elapsedSec(), 5, 'the clock runs while the sim runs');
        t.eq(c.isPaused(), false, 'a fresh clock is not paused');

        c.pause();
        t.eq(c.isPaused(), true, 'pause() takes');
        now += 60000;
        t.eq(c.elapsedSec(), 5,
          'PAUSE FREEZES THE CLOCK — a minute of wall time passed and scenario time did not move');
        t.eq(c.pausedSec(), 60, 'paused time is tracked separately, and it did move');

        c.resume();
        now += 3000;
        t.eq(c.elapsedSec(), 8,
          'RESUME DOES NOT FAST-FORWARD — 5s before the pause plus 3s after, not 68s');
        t.eq(c.pausedSec(), 60, 'the paused minute stays on its own ledger');

        /* Every pause banks, nothing double-counts. */
        c.pause(); now += 10000; c.resume(); now += 2000;
        t.eq(c.elapsedSec(), 10, 'a second pause banks too (8s + 2s of running time)');
        t.eq(c.pausedSec(), 70, 'paused totals accumulate across pauses');

        t.eq(c.resume(), false, 'resume() on a running clock is a no-op that says so');
        t.eq(c.pause(), true, 'pause() is idempotent');
        t.eq(c.pause(), true, 'pausing twice does not double-bank');
        now += 1000; c.resume();
        t.eq(c.pausedSec(), 71, 'the double pause banked one second, not two');

        /* The per-request wait clock rides on the same accounting. */
        var mark = now, banked = c.bankedMs();
        now += 4000; c.pause(); now += 30000;
        t.eq(c.sinceSec(mark, banked), 4, 'a request timer measured from a mark also freezes');
        c.resume(); now += 1000;
        t.eq(c.sinceSec(mark, banked), 5, 'and resumes without a catch-up burst');

        world.cleanup();
      })

      /* ==================================================================== */
      /* 2. The published API                                                 */
      /* ==================================================================== */
      .then(function () {
        t.group('the pause API is the same shape every engine exposes');

        var world = scenarioWorld();
        var w = world.window;
        var M = w.AIScenarioMode;

        /* The convention js/sim-engine.js publishes, verb for verb. */
        ['pauseRun', 'resumeRun', 'togglePauseRun', 'isRunPaused', 'canPauseRun',
         'pauseStats', 'onPauseChange'].forEach(function (k) {
          t.eq(typeof M[k], 'function', 'AIScenarioMode.' + k + '() matches the shared convention');
        });
        ['pause', 'resume', 'togglePause', 'isPaused', 'canPause'].forEach(function (k) {
          t.eq(typeof M[k], 'function', 'AIScenarioMode.' + k + '() is published as the short alias');
        });

        /* Nothing mounted: every verb is false and none of them throw. */
        t.eq(M.isRunPaused(), false, 'isRunPaused() is false with no run mounted');
        t.eq(M.canPauseRun(), false, 'canPauseRun() is false with no run mounted');
        t.eq(M.pauseRun(), false, 'pauseRun() with no run mounted does nothing and says so');
        t.eq(M.resumeRun(), false, 'resumeRun() with no run mounted does nothing and says so');
        t.noThrow(function () { M.togglePauseRun(); }, 'togglePauseRun() with nothing mounted is harmless');

        var idle = M.pauseStats();
        t.eq(idle.active, false, 'pauseStats() reports no active run');
        t.eq(idle.paused, false, 'pauseStats() reports not paused');
        t.eq(idle.pausedMs, 0, 'pauseStats() reports zero paused time');

        var off = M.onPauseChange(function () {});
        t.eq(typeof off, 'function', 'onPauseChange returns an unsubscribe');
        t.noThrow(off, 'unsubscribing works');
        t.noThrow(function () { M.onPauseChange('not a function'); },
          'onPauseChange survives a non-function');

        /* The shared registry, so MMPause.pauseAll() reaches this engine too. */
        var ctl = M.pauseControl;
        t.ok(!!ctl && ctl.id === 'ai-scenario', 'the module publishes a pauseControl with an id');
        ['isActive', 'isPaused', 'canPause', 'pause', 'resume', 'toggle', 'stats', 'subscribe']
          .forEach(function (k) {
            t.eq(typeof ctl[k], 'function', 'pauseControl.' + k + '() is present');
          });
        t.eq(ctl.isActive(), false, 'pauseControl.isActive() is false with nothing mounted');
        t.ok(!!w.MMPause, 'the shared window.MMPause registry exists');
        t.eq(w.MMPause.get('ai-scenario'), ctl, 'this engine registered itself under its own id');
        t.noThrow(function () { w.MMPause.pauseAll('test'); },
          'MMPause.pauseAll() reaches this engine without a run mounted');

        world.cleanup();
      })

      /* ==================================================================== */
      /* 3. Freeze, hold the in-flight turn, lock the input                   */
      /* ==================================================================== */
      .then(function () {
        t.group('a live run: freeze, hold, lock');

        var world = scenarioWorld();
        var w = world.window;
        var M = w.AIScenarioMode;
        var chat = world.chat, voice = world.voice;

        /* A controllable Date.now, so "the clock froze" is an assertion about
           the number on screen rather than about how long the test slept. */
        var realNow = Date.now;
        var fakeT = realNow();
        Date.now = function () { return fakeT; };

        var view = mountRun(world);
        var seen = [], snaps = [];
        var offPause = M.onPauseChange(function (p, s) { seen.push(!!p); snaps.push(s); });

        return H.actTick(30).then(function () {
          t.eq(chat.count(), 1, 'the opening turn was requested on mount');
          return actRun(function () { chat.last().resolve(openingTurn()); });
        }).then(function () {
          return H.actTick(20);
        }).then(function () {
          t.eq(view.all('.ais-turn').length, 1, 'the opening turn rendered');
          t.eq(stabilityText(view), '60/100', 'the run opened at the Competent baseline');
          t.contains(view.text(), 'Dolores Marchetti', 'the chart header is populated');
          t.ok(voice.spoken.length >= 1, 'the patient was spoken aloud');

          /* ---- the clock runs ---- */
          fakeT += 5000;
          return H.actTick(1100);
        }).then(function () {
          t.eq(clockText(view), '0:05', 'the scenario clock is running');

          /* ---- take an action, then pause with the reply still in flight ---- */
          var opt = optionByText(view, /Document and continue rounds/i);
          t.ok(!!opt, 'the options from the opening turn are on screen');
          view.click(opt);
          return H.actTick(20);
        }).then(function () {
          t.eq(chat.count(), 2, 'the action started an AI turn');

          return actRun(function () { M.pause(); });
        }).then(function () {
          t.eq(M.isRunPaused(), true, 'the public API reports the run as paused');
          t.deepEq(seen, [true], 'onPauseChange fired once, with true');
          t.ok(!!snaps[0] && snaps[0].paused === true, 'the subscriber got a snapshot as well');
          t.eq(snaps[0].mode, 'ai-live', 'the snapshot names this engine');
          t.eq(snaps[0].pauseCount, 1, 'the snapshot counts the pause');
          t.contains(view.text(), 'PAUSED', 'the paused state is unmistakable on screen');
          t.ok(!!view.host.querySelector('.ais-wrap.is-paused'),
            'the whole run area carries the paused class');
          t.eq(voice.stops >= 1, true, 'pausing stopped the speech');
          t.eq(voice.stopListens >= 1, true, 'pausing stopped the microphone');

          /* ---- the clock is frozen ---- */
          fakeT += 60000;
          return H.actTick(1100);
        }).then(function () {
          t.eq(clockText(view), '0:05',
            'PAUSE FREEZES THE CLOCK — a minute passed and the scenario clock did not move');

          /* ---- the in-flight turn settles WHILE PAUSED ---- */
          return actRun(function () { chat.last().resolve(gradedTurn()); });
        }).then(function () {
          return H.actTick(30);
        }).then(function () {
          t.eq(view.all('.ais-turn').length, 1,
            'a turn that resolved during the pause did NOT reach the transcript');
          t.eq(stabilityText(view), '60/100',
            'A PAUSED SIM DOES NOT MUTATE PATIENT STATE — stability is untouched');
          t.notContains(view.text(), 'three-word sentences',
            'none of the held turn leaked onto the screen');
          t.eq(M.pauseStats().holding, true,
            'pauseStats() says a settled turn is parked and waiting for the resume');

          /* ---- input is locked ---- */
          var opts = view.all('.ais-opt');
          t.ok(opts.length > 0, 'the options are still mounted (never reflow mid-read)');
          t.ok(opts.every(function (b) { return isDisabled(b); }),
            'every option button is disabled while paused');
          var vitalsBtn = view.button(/vitals again/i);
          t.ok(isDisabled(vitalsBtn), 'the free vitals check is disabled while paused');
          var chartBtn = view.button(/Show the chart/i);
          t.ok(isDisabled(chartBtn), 'the chart is disabled while paused — it is a graded peek');
          var hintBtn = view.button(/Ask for a hint/i);
          t.ok(isDisabled(hintBtn), 'the hint button is disabled while paused');

          /* And the handlers refuse even if something gets past the attribute. */
          var before = chat.count();
          view.click(opts[0]);
          return H.actTick(20).then(function () {
            t.eq(chat.count(), before,
              'clicking a paused option starts no request — the handler refuses, not just the CSS');
            t.eq(view.all('.ais-turn').length, 1, 'and nothing was committed');
          });
        }).then(function () {
          /* ---- resume ---- */
          return actRun(function () { M.resume(); });
        }).then(function () {
          return H.actTick(30);
        }).then(function () {
          t.eq(M.isRunPaused(), false, 'the run is running again');
          t.deepEq(seen, [true, false], 'onPauseChange reported the resume');
          t.eq(M.pauseStats().holding, false, 'nothing is being held any more');
          t.eq(view.all('.ais-turn').length, 2, 'the held turn landed on resume');
          t.eq(stabilityText(view), '47.5/100',
            'the held turn was applied exactly once: 60 - 9 (wrong) - 3.5 (drift)');
          t.contains(view.text(), 'three-word sentences', 'the held narration is now on screen');
          t.ok(!view.host.querySelector('.ais-wrap.is-paused'), 'the paused styling is gone');
          t.ok(!isDisabled(view.all('.ais-opt')[0]), 'the controls are live again');

          /* ---- and the clock picked up where it stopped ---- */
          fakeT += 3000;
          return H.actTick(1100);
        }).then(function () {
          t.eq(clockText(view), '0:08',
            'RESUME DOES NOT FAST-FORWARD — 5s before the pause + 3s after, not 1:08');
          t.contains(view.text(), 'Paused 1:00', 'the paused minute is reported on its own');

          offPause();
          view.unmount();
          Date.now = realNow;
          world.cleanup();
        }, function (e) {
          Date.now = realNow;
          throw e;
        });
      })

      /* ==================================================================== */
      /* 4. Speech: stop on pause, pick the cut-off line back up on resume    */
      /* ==================================================================== */
      .then(function () {
        t.group('speech stops on pause and continues on resume');

        var world = scenarioWorld();
        var w = world.window;
        var M = w.AIScenarioMode;
        var chat = world.chat, voice = world.voice;
        var view = mountRun(world);

        return H.actTick(30).then(function () {
          return actRun(function () {
            chat.last().resolve(openingTurn({ feedbackOnLastAction: 'Lead with airway.' }));
          });
        }).then(function () {
          return H.actTick(20);
        }).then(function () {
          t.deepEq(voice.spoken, ['I cannot catch my breath.'],
            'the first line is speaking; the next one has not been started');
          t.ok(voice.isSpeaking(), 'a clip is in progress');

          return actRun(function () { M.pause(); });
        }).then(function () {
          return H.actTick(20);
        }).then(function () {
          t.eq(voice.stops, 1, 'pausing called stopSpeaking()');
          t.deepEq(voice.spoken, ['I cannot catch my breath.'],
            'the cancelled clip did NOT let the queue run on to the next line — ' +
            'a stopped clip settles exactly like a finished one, which is the trap here');

          return actRun(function () { M.resume(); });
        }).then(function () {
          return H.actTick(20);
        }).then(function () {
          t.deepEq(voice.spoken, ['I cannot catch my breath.', 'I cannot catch my breath.'],
            'MM.voice exposes no pause, so resume re-speaks the interrupted LINE from its ' +
            'start — one line, not the whole turn');

          /* finish the re-spoken line and the queue moves on by itself */
          return actRun(function () { voice.pending.done(); });
        }).then(function () {
          return H.actTick(20);
        }).then(function () {
          t.eq(voice.spoken.length, 3, 'the rest of the turn then plays');
          t.eq(voice.spoken[2], 'Lead with airway.', 'and it is the feedback line, in order');

          view.unmount();
          world.cleanup();
        });
      })

      /* ==================================================================== */
      /* 5. Keyboard toggle, and the chat-box guard                           */
      /* ==================================================================== */
      .then(function () {
        t.group('Space / P toggles, but never out from under a typing student');

        var world = scenarioWorld({ inputMode: 'text' });
        var w = world.window;
        var M = w.AIScenarioMode;
        var chat = world.chat;
        var view = mountRun(world);

        function key(target, k) {
          var evt = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
          target.dispatchEvent(evt);
          return evt;
        }

        return H.actTick(30).then(function () {
          return actRun(function () { chat.last().resolve(openingTurn()); });
        }).then(function () {
          return H.actTick(20);
        }).then(function () {
          t.eq(M.isPaused(), false, 'the run starts unpaused');

          return actRun(function () { key(w.document, ' '); });
        }).then(function () {
          t.eq(M.isPaused(), true, 'Space pauses');
          return actRun(function () { key(w.document, 'p'); });
        }).then(function () {
          t.eq(M.isPaused(), false, 'P resumes');

          /* the chat box wins, always */
          var ta = view.find('textarea');
          t.ok(!!ta, 'the free-text box is on screen in text mode');
          return actRun(function () { key(ta, ' '); });
        }).then(function () {
          t.eq(M.isPaused(), false,
            'Space inside the chat box types a space — it does not pause the simulation');

          var input = w.document.createElement('input');
          w.document.body.appendChild(input);
          return actRun(function () { key(input, 'p'); }).then(function () {
            t.eq(M.isPaused(), false, 'P inside any text input is a letter, not a shortcut');
            w.document.body.removeChild(input);
          });
        }).then(function () {
          /* modified keystrokes belong to the browser */
          return actRun(function () {
            var evt = new w.KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true, metaKey: true });
            w.document.dispatchEvent(evt);
          });
        }).then(function () {
          t.eq(M.isPaused(), false, 'Cmd/Ctrl+P is the print dialog, not the pause button');

          var evt = key(w.document, ' ');
          t.ok(evt.defaultPrevented,
            'the handled Space is preventDefault()ed, or it would scroll the page and ' +
            're-fire the option button that still has focus');
          return H.actTick(10);
        }).then(function () {
          t.eq(M.isRunPaused(), true, 'and that Space did pause the run');

          /* The header control is the way most students will do this. */
          var resumeBtn = view.button(/Resume/i);
          t.ok(!!resumeBtn, 'the paused run offers a Resume control');
          t.ok(!isDisabled(resumeBtn), 'the Resume control is not itself locked out');
          var endBtn = view.button(/End the run/i);
          t.ok(!isDisabled(endBtn),
            '"End the run" stays available while paused — a student must always be able to leave');

          view.click(resumeBtn);
          return H.actTick(20);
        }).then(function () {
          t.eq(M.isRunPaused(), false, 'clicking Resume resumes');
          var pauseBtn = view.button(/Pause/i);
          t.ok(!!pauseBtn, 'and the control goes back to offering a Pause');

          view.click(pauseBtn);
          return H.actTick(20);
        }).then(function () {
          t.eq(M.isRunPaused(), true, 'clicking Pause pauses');
          return actRun(function () { w.MMPause.resumeAll(); });
        }).then(function () {
          t.eq(M.isRunPaused(), false, 'MMPause.resumeAll() reaches a mounted run');
          return actRun(function () { w.MMPause.pauseAll('fire drill'); });
        }).then(function () {
          t.eq(M.isRunPaused(), true, 'MMPause.pauseAll() reaches a mounted run too');
          return actRun(function () { M.resumeRun(); });
        }).then(function () {
          view.unmount();
          world.cleanup();
        });
      })

      /* ==================================================================== */
      /* 6. Nothing outlives the component                                    */
      /* ==================================================================== */
      .then(function () {
        t.group('no leaked handles: this module has a history');

        var world = scenarioWorld();
        var w = world.window;
        var M = w.AIScenarioMode;
        var chat = world.chat;

        var timers = trackIntervals();
        var keys = trackKeydownListeners(w.document);
        var view;

        return H.actTick(5).then(function () {
          view = mountRun(world);
          return H.actTick(30);
        }).then(function () {
          return actRun(function () { chat.last().resolve(openingTurn()); });
        }).then(function () {
          return H.actTick(20);
        }).then(function () {
          t.ok(timers.made() >= 1, 'the run screen owns at least one interval while mounted');
          t.eq(keys.live(), 1, 'exactly one keydown listener is registered while mounted');

          /* Unmount from a PAUSED run with a turn still in flight - the worst
             case, and the one that leaks if pause forgot to clean up. */
          var opt = optionByText(view, /Document and continue rounds/i);
          view.click(opt);
          return H.actTick(20);
        }).then(function () {
          return actRun(function () { M.pause(); });
        }).then(function () {
          return actRun(function () { view.unmount(); });
        }).then(function () {
          return H.actTick(30);
        }).then(function () {
          t.eq(timers.liveCount(), 0,
            'every interval the run started was cleared on unmount (made ' + timers.made() + ')');
          t.eq(keys.live(), 0, 'the document keydown listener was removed on unmount');
          t.eq(M.isPaused(), false, 'the unmounted run no longer answers the pause API');
          t.eq(M.canPause(), false, 'and it deregistered itself as the active run');

          /* The reply lands after the component is gone: it must be inert. */
          var threw = null;
          try { chat.last().resolve(gradedTurn()); } catch (e) { threw = e; }
          t.ok(!threw, 'resolving a request after unmount does not throw');
          return H.actTick(40);
        }).then(function () {
          t.eq(M.isPaused(), false, 'a late reply cannot resurrect the paused state');
          timers.restore();
          keys.restore();
          world.cleanup();
        }, function (e) {
          timers.restore();
          keys.restore();
          throw e;
        });
      })

      /* ==================================================================== */
      /* 7. Static sweep                                                      */
      /* ==================================================================== */
      .then(function () {
        t.group('static: the guarantees that no render happens to exercise');

        var src = readModule('ai-scenario.js');

        t.match(src, /AIScenarioMode\.pauseRun\s*=/, 'the shared pause verb is exported');
        t.match(src, /AIScenarioMode\.pauseControl\s*=/, 'so is the bundled control');
        t.match(src, /AIScenarioMode\.onPauseChange\s*=/, 'so is the change subscription');
        t.match(src, /window\.MMPause/, 'the engine joins the shared MMPause registry');

        /* Same verbs on both engines, or the shell has to special-case them. */
        var simSrc = readModule('sim-engine.js');
        ['pauseRun', 'resumeRun', 'togglePauseRun', 'isRunPaused', 'canPauseRun',
         'pauseStats', 'onPauseChange', 'pauseControl'].forEach(function (verb) {
          t.ok(new RegExp(verb).test(simSrc) === new RegExp(verb).test(src),
            'ai-scenario and sim-engine agree on "' + verb + '"');
        });

        /* Module scope may hold a registration, never a running timer. The
           component owns every interval and clears it in an effect cleanup. */
        var head = src.slice(0, src.indexOf('function RunScreen'));
        t.eq(/(^|[^.\w$])setInterval\s*\(/.test(head), false,
          'no module-scope setInterval — a timer that outlives the component is how ' +
          'this mode reached into a later jsdom world before');

        var intervals = (src.match(/setInterval\s*\(/g) || []).length;
        var cleared = (src.match(/clearInterval\s*\(/g) || []).length;
        t.ok(cleared >= intervals,
          'every setInterval in the module has a matching clearInterval (' +
          intervals + ' set, ' + cleared + ' cleared)');

        t.match(src, /removeEventListener\(\s*['"]keydown['"]/,
          'the keyboard shortcut is unregistered, not just registered');

        /* The lockout has to be in the handlers, not only in the markup. */
        t.match(src, /if\s*\(!body \|\| busy \|\| inFlightRef\.current \|\| pausedRef\.current\)/,
          'takeAction() refuses while paused, so a stray click cannot spend an AI message');

        /* Paused time is on its own ledger. */
        t.match(src, /pausedMs/, 'the run record tracks paused time');
        t.match(src, /wall - numOr\(next\.pausedMs, 0\)/,
          'finalizeRun scores scenario time, not wall time — timeliness is not distorted');
      })

      .then(restore, function (e) { restore(); throw e; });
  }
};
