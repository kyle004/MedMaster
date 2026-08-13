/* =============================================================================
 * MedMaster :: js/ai-scenario.js
 * AI-DRIVEN LIVE CLINICAL SCENARIO MODE   ->   window.AIScenarioMode
 * -----------------------------------------------------------------------------
 * An unscripted patient simulation. The student performs a focused assessment
 * on a newly admitted patient and the patient's condition responds to the
 * quality of their nursing.
 *
 * DESIGN RULE #1 - THE AI DOES NOT FREEFORM CHAT.
 * Every turn the model must return ONE strict JSON object (the "turn protocol").
 * This file parses it and drives a deterministic state machine. The app owns
 * the state; the model only proposes the next beat.
 *
 * DESIGN RULE #2 - THE APP OWNS HOW SICK THE PATIENT IS.
 * A numeric stability value (0-100) lives in app state. Quality deltas and
 * passive drift are applied by stepStability() - never by the model. The
 * current value is pushed back into the prompt every turn so the narration
 * has to match the number.
 *
 * DESIGN RULE #3 - GROUNDED IN REAL COURSE CONTENT.
 * Cases are generated against an "APPROVED CLINICAL GROUND TRUTH" block built
 * from window.ALL_SCENARIOS: the real condition, vitals trajectory, labs,
 * orders, ordered interventions with their critical flags, critical errors,
 * medications and pearls. A different patient, the same medicine.
 *
 * Contract: IIFE, no JSX, no ES modules, no optional chaining, window export,
 * CSS variables only, works at 360px.
 * ========================================================================== */
(function () {
  'use strict';

  var ce = React.createElement;
  var useState = React.useState, useEffect = React.useEffect,
      useRef = React.useRef, useMemo = React.useMemo,
      useCallback = React.useCallback;

  /* ==========================================================================
   * 0. TINY HELPERS
   * ======================================================================== */

  function isFn(f) { return typeof f === 'function'; }
  function obj(v) { return (v && typeof v === 'object') ? v : {}; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function numOr(v, d) {
    var n = (typeof v === 'number') ? v : parseFloat(v);
    return isFinite(n) ? n : d;
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  /* Hard ceiling on any string that came from the model. A runaway generation
     is not just an ugly transcript: narration is echoed back into the prompt by
     compactAssistant() on every subsequent turn, so one 100KB paragraph turns
     into a 100KB tax on the next eight requests. Cut at a word boundary. */
  function cut(v, n) {
    var t = str(v);
    if (t.length <= n) return t;
    var head = t.slice(0, n - 1);
    var trimmed = head.replace(/\s+\S*$/, '');
    return (trimmed.length > n * 0.6 ? trimmed : head) + '…';
  }
  function MMx() { return window.MM || {}; }
  function aiApi() { return obj(MMx().ai); }
  function voiceApi() { return obj(MMx().voice); }

  /* ======================================================================
   * "CHECKING YOUR PLAN" STATE
   * MM.ai.isResolving() is true until Firebase has actually answered with this
   * student's tier. Until it goes false we know nothing about their plan, so
   * the setup screen may not claim this mode is unavailable to them. Feature
   * detected - an older cached ai.js has no isResolving and everything then
   * behaves exactly as before.
   * ==================================================================== */
  function aiResolving() {
    var a = aiApi();
    try { return !!(isFn(a.isResolving) && a.isResolving()); }
    catch (e) { return false; }
  }

  function useAiResolving() {
    var st = useState(aiResolving);
    var resolving = st[0], setResolving = st[1];
    useEffect(function () {
      if (!resolving) return undefined;
      var a = aiApi();
      if (!isFn(a.onResolved)) { setResolving(false); return undefined; }
      var off = a.onResolved(function () { setResolving(false); });
      return function () { if (isFn(off)) off(); };
    }, [resolving]);
    return resolving;
  }

  var CHK_STYLE_ID = 'mm-checking-styles';
  function ensureCheckingStyles() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.getElementById(CHK_STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = CHK_STYLE_ID;
    s.textContent = [
      '.mm-chk{opacity:.9}',
      '.mm-chk-line{height:12px;border-radius:var(--r-full,999px);background:var(--surface3,#334155);',
      'animation:mmChkPulse 1.7s ease-in-out infinite;margin-bottom:10px}',
      '.mm-chk-line:last-child{margin-bottom:0}',
      '.mm-chk-note{color:var(--text3);font-size:var(--fs-sm,13px);line-height:var(--lh-normal,1.5);margin:0}',
      '.mm-chk-box{border:1px solid var(--border,#334155);border-radius:var(--r-lg,14px);',
      'background:var(--surface);padding:var(--sp-4,16px)}',
      '@keyframes mmChkPulse{0%,100%{opacity:.30}50%{opacity:.62}}',
      '@media(prefers-reduced-motion:reduce){.mm-chk-line{animation:none;opacity:.4}}'
    ].join('');
    document.head.appendChild(s);
  }

  function CheckingLines(props) {
    ensureCheckingStyles();
    var widths = obj(props).widths || ['92%', '78%', '60%'];
    return ce('div', { className: 'mm-chk', 'aria-hidden': 'true' },
      widths.map(function (w, i) {
        return ce('div', { key: i, className: 'mm-chk-line', style: { width: w } });
      }));
  }

  function toast(msg, kind) {
    var f = MMx().toast;
    if (isFn(f)) { try { f(msg, kind || 'info'); } catch (e) { /* noop */ } }
  }

  /* Screen-reader announcer. Prefers the shell's shared announcer when it
     exists; otherwise owns a single off-screen live region. Deliberately NOT
     a live region wrapped around the vitals grid - see thresholdWatch(). */
  var LIVE_ID = 'ais-live-region';
  function announce(msg, urgent) {
    var m = str(msg).trim();
    if (!m) return;
    var MM = MMx();
    if (isFn(MM.announce)) {
      try { MM.announce(m, !!urgent); return; } catch (e) { /* fall through */ }
    }
    try {
      var n = document.getElementById(LIVE_ID);
      if (!n) {
        n = document.createElement('div');
        n.id = LIVE_ID;
        n.className = 'ais-sr';
        n.setAttribute('aria-atomic', 'true');
        document.body.appendChild(n);
      }
      n.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
      n.textContent = '';
      window.setTimeout(function () { n.textContent = m; }, 60);
    } catch (e) { /* noop */ }
  }

  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function rid() {
    return 'ais-' + Date.now().toString(36) + '-' +
      Math.floor(Math.random() * 1679616).toString(36);
  }

  function lsGet(k, dflt) {
    try {
      var v = window.localStorage.getItem(k);
      return (v === null || v === undefined) ? dflt : v;
    } catch (e) { return dflt; }
  }
  function lsSet(k, v) {
    try { window.localStorage.setItem(k, String(v)); } catch (e) { /* private mode */ }
  }

  /* deterministic PRNG so option shuffles are stable across re-renders */
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleSeeded(list, seed) {
    var out = arr(list).slice();
    var rnd = mulberry(seed || 1);
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  /* ---- fuzzy clinical text matching (used to map free text onto the
     grounded intervention list without asking the model to do it) ---- */

  var STOPWORDS = {
    the: 1, and: 1, for: 1, with: 1, that: 1, this: 1, from: 1, they: 1, have: 1,
    will: 1, your: 1, been: 1, were: 1, what: 1, when: 1, then: 1, than: 1,
    into: 1, onto: 1, over: 1, more: 1, some: 1, must: 1, also: 1, each: 1,
    every: 1, their: 1, about: 1, before: 1, after: 1, patient: 1, client: 1,
    nurse: 1, child: 1, would: 1, should: 1, could: 1
  };

  function stem(t) { return t.replace(/(ings|ing|ed|es|s)$/, ''); }

  function toks(s) {
    var raw = str(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/);
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var t = raw[i];
      if (t.length > 3 && !STOPWORDS[t]) out.push(stem(t));
    }
    return out;
  }

  function tokenSet(s) {
    var t = toks(s), m = {};
    for (var i = 0; i < t.length; i++) m[t[i]] = true;
    return m;
  }

  /** fraction of `ref`'s significant tokens that appear in `user` */
  function matchRatio(ref, user) {
    var r = toks(ref);
    if (!r.length) return 0;
    var u = tokenSet(user);
    var hit = 0, seen = {};
    for (var i = 0; i < r.length; i++) {
      if (seen[r[i]]) continue;
      seen[r[i]] = true;
      if (u[r[i]]) hit++;
    }
    var uniq = Object.keys(seen).length || 1;
    return hit / uniq;
  }

  function looksLike(ref, user, minRatio) {
    var r = matchRatio(ref, user);
    return r >= (minRatio || 0.42) && toks(ref).length >= 2;
  }

  var RE_ESCALATE = /(rapid response|rapid-response|call (a |the )?rapid|activate (the )?(rrt|rapid)|code (blue|team)|call (a )?code|notify (the )?(provider|physician|doctor|md|hospitalist|surgeon|pediatrician|intensivist)|call (the )?(provider|physician|doctor|md|hospitalist|charge nurse)|page (the )?(provider|doctor|md)|escalat)/i;
  var RE_ASSESS = /(assess|auscultat|listen to|inspect|palpat|percuss|check|recheck|measure|obtain|monitor|reassess|evaluate|observe|capillary refill|breath sound|lung sound|bowel sound|neuro|pupil|pain scale|skin|edema|fundus|strip|telemetry|weigh)/i;
  var RE_EDUCATE = /(teach|educat|explain|instruct|demonstrat|reinforce|show (the|them|him|her) how|discharge instruction)/i;
  var RE_COMMUNICATE = /(sbar|hand ?off|report|notify|inform|document|chart it|communicat|update the (family|provider)|call)/i;
  /* Free data checks: "what are my vitals again?", "show me the chart".
     These cost no turn and no points, which is right for a student peeking at
     information they would simply have on a real unit - and badly wrong for a
     real nursing action that merely STARTS with one of these words. Unanchored,
     the old patterns swallowed "Monitor her cardiac rhythm continuously and
     titrate oxygen" and "Review the orders and clarify the heparin dose": the
     student took a graded action, was charged nothing, told nothing, and the
     scene never advanced. Both patterns must now match the WHOLE utterance, so
     a peek stays a peek and anything with a clinical tail is a real turn. */
  var RE_FREE_VITALS = /^\s*(?:what|show|tell|give|repeat|read)?[^a-z]*(?:are|is|me)?[^a-z]*(?:(?:my|the|his|her|their|current|latest|last|patient'?s?)[^a-z]*){0,3}(?:vital signs|vitals|vital|numbers|sats?|monitor)\b[^a-z]*(?:again|now|please|reading|readings)?[^a-z]*$/i;
  var RE_FREE_CHART = /^\s*(?:show|open|pull up|check|look at|review|see)?[^a-z]*(?:me)?[^a-z]*(?:(?:the|his|her|their|patient'?s?)[^a-z]*){0,3}(?:charts|chart|records|record|labs|lab|orders|order|history|allergies|mar)\b[^a-z]*(?:again|now|please)?[^a-z]*$/i;

  /* ==========================================================================
   * 0b. PAUSE / RESUME PLUMBING
   * --------------------------------------------------------------------------
   * Two pieces, both deliberately free of timers.
   *
   * createPauseClock() is the whole time model. Wall time is never used
   * directly again: everything the student is shown, and everything that is
   * scored, is wall time MINUS every interval the run spent paused. That is
   * what makes resume free of a catch-up burst - the clock does not "come
   * back and find out it is 40 seconds later", because those 40 seconds were
   * never part of scenario time in the first place. It also keeps paused time
   * separately (pausedMs) so timeliness scoring is not distorted.
   *
   * The registry below is a REGISTRATION, not a lifecycle of its own. The
   * mounted RunScreen writes its controller in and clears it on unmount, so
   * nothing here outlives the component - this module has a history of
   * load-order races and a module-scope anything that ticks is exactly the
   * bug we are not repeating.
   * ======================================================================== */

  /**
   * createPauseClock(startedAtMs, nowFn) -> clock
   *   pause()/resume()      -> bool (resume returns false if it was not paused)
   *   isPaused()            -> bool
   *   elapsedMs()/Sec()     -> scenario time, frozen while paused
   *   pausedMs()            -> total time spent paused, including right now
   *   sinceMs(mark, banked) -> unpaused time since a mark taken with bankedMs()
   *   bankedMs()            -> paused total at the moment a mark is taken
   * nowFn is injectable purely so this is unit-testable without sleeping.
   */
  function createPauseClock(startedAtMs, nowFn) {
    var now = isFn(nowFn) ? nowFn : function () { return Date.now(); };
    var startedAt = numOr(startedAtMs, now());
    var pausedAt = 0;   /* 0 while running, otherwise the instant we paused */
    var bankedMs = 0;   /* every COMPLETED paused interval, added up */

    /* While paused the clock reads the instant of the pause, so every derived
       value is frozen without a single timer being touched. */
    function endMark() { return pausedAt || now(); }
    function pausedMs() { return bankedMs + (pausedAt ? Math.max(0, now() - pausedAt) : 0); }
    function elapsedMs() { return Math.max(0, endMark() - startedAt - bankedMs); }
    function sinceMs(markMs, markBankedMs) {
      return Math.max(0, endMark() - numOr(markMs, endMark()) - (bankedMs - numOr(markBankedMs, 0)));
    }

    return {
      startedAt: function () { return startedAt; },
      isPaused: function () { return !!pausedAt; },
      pause: function () { if (!pausedAt) pausedAt = now(); return true; },
      resume: function () {
        if (!pausedAt) return false;
        bankedMs = bankedMs + Math.max(0, now() - pausedAt);
        pausedAt = 0;
        return true;
      },
      bankedMs: function () { return bankedMs; },
      pausedMs: pausedMs,
      pausedSec: function () { return Math.floor(pausedMs() / 1000); },
      elapsedMs: elapsedMs,
      elapsedSec: function () { return Math.floor(elapsedMs() / 1000); },
      sinceMs: sinceMs,
      sinceSec: function (markMs, markBankedMs) { return Math.floor(sinceMs(markMs, markBankedMs) / 1000); }
    };
  }

  /* ---- the shared pause convention -----------------------------------------
   * Identical in shape to the hub in js/sim-engine.js, on purpose: every
   * simulation engine in the app answers the same verbs, so the shell, a
   * parent screen or a test can pause whatever is running without knowing
   * which engine is on screen.
   *
   *   pauseRun(reason) resumeRun() togglePauseRun()
   *   isRunPaused()    canPauseRun()
   *   onPauseChange(cb) -> off()      cb(paused, snapshot)
   *   pauseStats() -> {active,paused,pauseCount,pausedMs,pausedSec,mode}
   *
   * Bundled as `.pauseControl` and registered in the shared `window.MMPause`
   * registry under this module's id, so MMPause.pauseAll() reaches it too.
   * ------------------------------------------------------------------------ */
  function createPauseHub(id) {
    var host = null;
    var subs = [];

    function stats() {
      if (!host) {
        return { active: false, paused: false, pauseCount: 0, pausedMs: 0, pausedSec: 0, mode: '' };
      }
      return host.stats();
    }
    function emit() {
      var snapshot = stats();
      subs.slice().forEach(function (fn) {
        try { fn(!!snapshot.paused, snapshot); } catch (e) { /* a bad subscriber is not our problem */ }
      });
    }

    var hub = {
      id: str(id) || 'sim',
      /* every verb answers "is a run paused now?", and every one of them is
         harmless with nothing mounted */
      pauseRun: function (reason) { return !!(host && host.pause(reason)); },
      resumeRun: function () { return !!(host && host.resume()); },
      togglePauseRun: function () { return !!(host && host.toggle()); },
      isRunPaused: function () { return !!(host && host.isPaused()); },
      canPauseRun: function () { return !!(host && host.canPause()); },
      pauseStats: stats,
      onPauseChange: function (cb) {
        if (!isFn(cb)) return function () { /* noop */ };
        subs.push(cb);
        return function () {
          subs = subs.filter(function (f) { return f !== cb; });
        };
      },
      /* used by the mounted runner only */
      _attach: function (h) {
        host = h; emit();
        return function () { if (host === h) { host = null; emit(); } };
      },
      _changed: emit
    };

    hub.pauseControl = {
      id: hub.id,
      isActive: function () { return !!host; },
      isPaused: hub.isRunPaused,
      canPause: hub.canPauseRun,
      pause: hub.pauseRun,
      resume: hub.resumeRun,
      toggle: hub.togglePauseRun,
      stats: hub.pauseStats,
      subscribe: hub.onPauseChange
    };
    return hub;
  }

  function registerPauseControl(ctl) {
    try {
      var reg = window.MMPause;
      if (!reg || typeof reg !== 'object') { reg = window.MMPause = {}; }
      if (!reg.controls || typeof reg.controls !== 'object') { reg.controls = {}; }
      if (!isFn(reg.register)) {
        reg.register = function (c) { if (c && c.id) { reg.controls[c.id] = c; } return c; };
        reg.get = function (k) { return obj(reg.controls)[str(k)] || null; };
        reg.all = function () {
          return Object.keys(obj(reg.controls)).map(function (k) { return reg.controls[k]; });
        };
        reg.pauseAll = function (why) {
          reg.all().forEach(function (c) { try { c.pause(why); } catch (e) { /* noop */ } });
        };
        reg.resumeAll = function () {
          reg.all().forEach(function (c) { try { c.resume(); } catch (e) { /* noop */ } });
        };
      }
      reg.register(ctl);
    } catch (e) { /* a registry we cannot reach is not worth a broken mode */ }
  }

  var aiPause = createPauseHub('ai-scenario');
  registerPauseControl(aiPause.pauseControl);

  /**
   * isTypingTarget(el) - the guard on the keyboard shortcut.
   * This mode has a chat box, an SBAR box and (via SBARRecorder) other fields,
   * so Space must never be stolen from a student mid-sentence.
   */
  function isTypingTarget(el) {
    var n = el;
    if (!n || typeof n !== 'object') return false;
    try {
      if (n.isContentEditable) return true;
      var tag = str(n.tagName).toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option') return true;
      var role = isFn(n.getAttribute) ? str(n.getAttribute('role')).toLowerCase() : '';
      if (role === 'textbox' || role === 'searchbox' || role === 'combobox') return true;
      /* a field inside a component we do not own (SBARRecorder) still counts */
      if (isFn(n.closest) && n.closest('input,textarea,select,[contenteditable="true"]')) return true;
    } catch (e) { return false; }
    return false;
  }

  /* ==========================================================================
   * 1. CONSTANTS
   * ======================================================================== */

  /* Ceilings on model-authored prose. The protocol asks for 2-4 sentences of
     narration; 1600 characters is roughly ten. Nothing a well-behaved model
     writes is ever clipped, and nothing a badly-behaved one writes can flood
     the transcript or ride along in the next eight prompts. */
  var MAX_NARRATION = 1600;
  var MAX_SPEECH    = 600;
  var MAX_FEEDBACK  = 800;

  var TURN_CAP = 25;            // hard stop - the model can never run forever
  var FORCE_HANDOFF_AT = 21;    // start pushing toward handoff here
  var MIN_TURNS_FOR_OUTCOME = 6; // ignore an early outcome unless harm occurred
  var HINT_COST = 3;

  var LS_INPUT_MODE = 'mm.aiscenario.inputMode';
  var LS_DIFFICULTY = 'mm.aiscenario.difficulty';
  var LS_VOICE = 'mm.aiscenario.voice';

  var DIFFICULTIES = [
    { id: 'student', label: 'Student', baseline: 72, drift: 2,
      blurb: 'Forgiving. Slower decline, clearer cues, more obvious options.' },
    { id: 'competent', label: 'Competent', baseline: 60, drift: 3.5,
      blurb: 'Realistic. Subtle early findings, decline if you dawdle.' },
    { id: 'challenge', label: 'Challenge', baseline: 52, drift: 5,
      blurb: 'Unforgiving. Vague reporting, distractors, fast deterioration.' }
  ];

  var QUALITY_DELTA = {
    correct: 6, acceptable: 2, suboptimal: -4, wrong: -9, harmful: -18
  };

  var QUALITY_META = {
    correct:    { label: 'Correct',     tag: 'tag-green',  mark: '++' },
    acceptable: { label: 'Acceptable',  tag: 'tag-blue',   mark: '+' },
    suboptimal: { label: 'Suboptimal',  tag: 'tag-orange', mark: '-' },
    wrong:      { label: 'Wrong',       tag: 'tag-red',    mark: '--' },
    harmful:    { label: 'HARMFUL',     tag: 'tag-red',    mark: '!!' }
  };

  var SPEAKERS = {
    patient:      { label: 'Patient',      voice: 'patient' },
    instructor:   { label: 'Instructor',   voice: 'instructor' },
    charge_nurse: { label: 'Charge Nurse', voice: 'nurse' },
    provider:     { label: 'Provider',     voice: 'instructor' },
    family:       { label: 'Family',       voice: 'family' },
    monitor:      { label: 'Monitor',      voice: 'nurse' }
  };

  var PHASES = ['arrival', 'assessment', 'intervention', 'escalation', 'handoff', 'complete'];
  var TRENDS = ['stable', 'improving', 'declining', 'critical'];
  var OUTCOMES = ['success', 'partial', 'decline', 'rapid_response', 'code', 'death'];
  var QUALITIES = ['correct', 'acceptable', 'suboptimal', 'wrong', 'harmful'];

  var VITAL_KEYS = [
    { k: 'bp', label: 'BP' },
    { k: 'hr', label: 'HR' },
    { k: 'rr', label: 'RR' },
    { k: 'temp', label: 'Temp' },
    { k: 'spo2', label: 'SpO2' },
    { k: 'pain', label: 'Pain' },
    { k: 'loc', label: 'LOC' }
  ];

  /* Only the five numeric vitals get a tile. LOC and Pain are sentences, not
     numbers - they go in the one-line text row underneath, the way the
     hand-written sims already do it. */
  var TILE_KEYS = [
    { k: 'bp',   label: 'BP',   unit: 'mmHg' },
    { k: 'hr',   label: 'HR',   unit: 'bpm' },
    { k: 'rr',   label: 'RR',   unit: '/min' },
    { k: 'spo2', label: 'SpO2', unit: '%' },
    { k: 'temp', label: 'Temp', unit: '' }
  ];

  var INPUT_MODES = [
    { id: 'choice', label: 'Choices', hint: 'Pick from the options the scenario offers.' },
    { id: 'text',   label: 'Free text', hint: 'Type what you would actually do. Harder, scores higher.' },
    { id: 'voice',  label: 'Voice', hint: 'Say it out loud, like you would at the bedside.' }
  ];

  /* stability zones - readable WITHOUT relying on colour */
  function zoneFor(s) {
    if (s <= 0) return 'arrest';
    if (s < 25) return 'critical';
    if (s < 45) return 'rapid';
    if (s <= 70) return 'concerning';
    return 'stable';
  }
  /* Five redundant channels per zone: glyph, word, note, severity rank and
     number. Remove hue entirely and the state still reads. `bars` is kept for
     backwards compatibility with the published ZONE_META shape; the meter
     itself is driven by `rank`, which ESCALATES with severity rather than
     depleting like a health bar. */
  var ZONE_META = {
    stable:      { label: 'STABLE',            note: 'Within expected limits',    bars: 4, glyph: '✓',       rank: 0 },
    concerning:  { label: 'CONCERNING',        note: 'Watch closely, act now',    bars: 3, glyph: '!',            rank: 1 },
    rapid:       { label: 'RAPID RESPONSE',    note: 'Escalation is indicated',   bars: 2, glyph: '!!',           rank: 2 },
    critical:    { label: 'PERI-ARREST',       note: 'Call for help now',         bars: 1, glyph: '✖',       rank: 3 },
    arrest:      { label: 'ARREST',            note: 'No perfusing rhythm',       bars: 0, glyph: '✖✖', rank: 4 }
  };

  function trendFrom(stability, delta) {
    if (stability < 25) return 'critical';
    if (delta >= 1.5) return 'improving';
    if (delta <= -1.5) return 'declining';
    return 'stable';
  }

  var TREND_ARROW = {
    improving: 'UP', stable: 'LEVEL', declining: 'DOWN', critical: 'FALLING FAST'
  };

  /* ==========================================================================
   * 2. GROUNDING - build APPROVED CLINICAL GROUND TRUTH from real scenarios
   * ======================================================================== */

  function allScenarios() {
    var a = window.ALL_SCENARIOS;
    if (Array.isArray(a) && a.length) return a;
    var out = [];
    var keys = ['SCENARIOS_MS2A', 'SCENARIOS_MS2B', 'SCENARIOS_OB', 'SCENARIOS_PEDS'];
    for (var i = 0; i < keys.length; i++) {
      if (Array.isArray(window[keys[i]])) out = out.concat(window[keys[i]]);
    }
    return out;
  }

  var CATEGORY_ORDER = ['Med-Surg 2', 'OB', 'PEDS'];

  function categoryList() {
    var all = allScenarios();
    var seen = {}, out = [];
    for (var i = 0; i < CATEGORY_ORDER.length; i++) {
      for (var j = 0; j < all.length; j++) {
        if (str(all[j].category) === CATEGORY_ORDER[i]) { out.push(CATEGORY_ORDER[i]); seen[CATEGORY_ORDER[i]] = 1; break; }
      }
    }
    for (var k = 0; k < all.length; k++) {
      var c = str(all[k].category);
      if (c && !seen[c]) { seen[c] = 1; out.push(c); }
    }
    return out;
  }

  function scenariosIn(category) {
    var all = allScenarios();
    if (!category || category === 'any') return all.slice();
    return all.filter(function (s) { return str(s.category) === category; });
  }

  function scenarioById(id) {
    var all = allScenarios();
    for (var i = 0; i < all.length; i++) { if (str(all[i].id) === str(id)) return all[i]; }
    return null;
  }

  /** the one intervention that actually stops the pathology from progressing */
  function keyStabilizer(sc) {
    var ivs = arr(obj(sc).interventions).slice().sort(function (a, b) {
      return numOr(a.order, 99) - numOr(b.order, 99);
    });
    var i;
    for (i = 0; i < ivs.length; i++) {
      if (ivs[i].critical && ivs[i].preventsDeterioration &&
          (ivs[i].category === 'medication' || ivs[i].category === 'intervention')) return ivs[i];
    }
    for (i = 0; i < ivs.length; i++) {
      if (ivs[i].critical && ivs[i].preventsDeterioration) return ivs[i];
    }
    for (i = 0; i < ivs.length; i++) { if (ivs[i].critical) return ivs[i]; }
    return ivs[0] || null;
  }

  function vitalsLine(v) {
    var b = [];
    if (v.bp) b.push('BP ' + v.bp);
    if (v.hr !== undefined && v.hr !== null && v.hr !== '') b.push('HR ' + v.hr);
    if (v.rr !== undefined && v.rr !== null && v.rr !== '') b.push('RR ' + v.rr);
    if (v.temp) b.push('T ' + v.temp);
    if (v.spo2 !== undefined && v.spo2 !== null && v.spo2 !== '') b.push('SpO2 ' + v.spo2 + '%');
    if (v.pain) b.push('Pain ' + v.pain);
    if (v.loc) b.push('LOC ' + v.loc);
    return b.join(', ');
  }

  /**
   * buildGroundTruth(scenario) -> plain-text block injected into the system
   * prompt. Everything the generated case must stay consistent with.
   */
  function buildGroundTruth(sc) {
    var s = obj(sc), p = obj(s.patient), L = [], i;

    L.push('CONDITION: ' + str(s.fullTitle || s.title));
    L.push('COURSE AREA: ' + str(s.category) + ' (reference difficulty: ' + str(s.difficulty) + ')');
    if (s.summary) L.push('PATHOPHYSIOLOGY / PRESENTATION: ' + str(s.summary));

    L.push('');
    L.push('REFERENCE PATIENT (a DIFFERENT patient must be generated - this is shape, not content):');
    L.push('  ' + [str(p.name), str(p.age), str(p.sex), p.weightKg ? p.weightKg + ' kg' : ''].filter(Boolean).join(', '));
    if (p.diagnosis) L.push('  Admitting diagnosis: ' + str(p.diagnosis));
    if (arr(p.history).length) L.push('  Typical history: ' + arr(p.history).slice(0, 6).join('; '));

    var tl = arr(s.vitalsTimeline);
    if (tl.length) {
      L.push('');
      L.push('REALISTIC VITAL RANGES AND THE DETERIORATION TRAJECTORY FOR THIS CONDITION:');
      for (i = 0; i < tl.length && i < 6; i++) {
        L.push('  t+' + numOr(tl[i].atMin, 0) + 'min [' + str(tl[i].label) + '] ' + vitalsLine(tl[i]));
        if (tl[i].other) L.push('      findings: ' + str(tl[i].other));
        if (tl[i].note) L.push('      why: ' + str(tl[i].note));
      }
    }

    var labs = arr(s.labs);
    if (labs.length) {
      var abn = labs.filter(function (l) { return l && l.status && l.status !== 'normal'; });
      var show = abn.length ? abn : labs;
      L.push('');
      L.push('REAL LAB VALUES FOR THIS CONDITION (stay inside these ranges):');
      for (i = 0; i < show.length && i < 14; i++) {
        L.push('  ' + str(show[i].name) + ': ' + str(show[i].value) + ' ' + str(show[i].unit) +
               (show[i].status ? ' [' + str(show[i].status) + ']' : '') +
               (show[i].normalRange ? ' (normal ' + str(show[i].normalRange) + ')' : ''));
      }
    }

    var dx = arr(s.diagnostics);
    if (dx.length) {
      L.push('');
      L.push('DIAGNOSTICS:');
      for (i = 0; i < dx.length && i < 6; i++) L.push('  ' + str(dx[i].name) + ': ' + str(dx[i].finding));
    }

    var orders = arr(s.orders);
    if (orders.length) {
      L.push('');
      L.push('REAL PROVIDER ORDERS (the only orders that may exist on this case):');
      for (i = 0; i < orders.length && i < 18; i++) L.push('  - ' + str(orders[i].text));
    }

    var meds = arr(s.medications);
    if (meds.length) {
      L.push('');
      L.push('APPROVED MEDICATIONS (do NOT invent any drug outside this list):');
      for (i = 0; i < meds.length && i < 8; i++) {
        var m = meds[i];
        L.push('  - ' + str(m.name) + ' (' + str(m.classification) + '), dose ' + str(m.dose) +
               (m.onset ? ', onset ' + str(m.onset) : ''));
        if (m.atiTip) L.push('      ATI: ' + str(m.atiTip));
      }
    }

    var ivs = arr(s.interventions).slice().sort(function (a, b) { return numOr(a.order, 99) - numOr(b.order, 99); });
    if (ivs.length) {
      L.push('');
      L.push('CORRECT PRIORITY ORDER OF NURSING ACTIONS (this is the grading key - NEVER show this list to the student):');
      for (i = 0; i < ivs.length; i++) {
        L.push('  ' + numOr(ivs[i].order, i + 1) + '. ' + str(ivs[i].action) +
               (ivs[i].critical ? '  [CRITICAL]' : '') +
               (ivs[i].preventsDeterioration ? ' [STABILIZING]' : ''));
      }
    }

    var errs = arr(s.criticalErrors);
    if (errs.length) {
      L.push('');
      L.push('CRITICAL ERRORS - if the student does any of these, grade it "harmful":');
      for (i = 0; i < errs.length && i < 12; i++) L.push('  - ' + str(errs[i]));
    }

    var pearls = arr(s.pearls).length ? arr(s.pearls) : arr(s.keyPoints);
    if (pearls.length) {
      L.push('');
      L.push('ATI / NCLEX PEARLS FOR THIS CONDITION:');
      for (i = 0; i < pearls.length && i < 12; i++) L.push('  - ' + str(pearls[i]));
    }

    var edu = arr(s.patientEducation);
    if (edu.length) {
      L.push('');
      L.push('TEACHING POINTS THAT BELONG TO THIS CONDITION:');
      for (i = 0; i < edu.length && i < 6; i++) L.push('  - ' + str(edu[i]));
    }

    return L.join('\n');
  }

  /* ==========================================================================
   * 3. THE TURN PROTOCOL - parsing and normalising
   * --------------------------------------------------------------------------
   * Every model reply must be exactly one JSON object:
   * {
   *   "speaker": "patient|instructor|charge_nurse|provider|family|monitor",
   *   "narration": "2-4 sentences, present tense",
   *   "patientSpeech": "verbatim words or null",
   *   "vitals": {"bp","hr","rr","temp","spo2","pain","loc"},
   *   "trend": "stable|improving|declining|critical",
   *   "newFindings": ["..."],
   *   "feedbackOnLastAction": "1-2 sentences or null on turn 1",
   *   "lastActionQuality": "correct|acceptable|suboptimal|wrong|harmful|null",
   *   "options": [{"id":"a","text":"...","quality":"correct"}],
   *   "phase": "arrival|assessment|intervention|escalation|handoff|complete",
   *   "outcome": null|"success|partial|decline|rapid_response|code|death",
   *   "hint": "nudge or null",
   *   "rubricHits": ["snake_case_competency"],
   *   "scoreDelta": -10..10,
   *   "isFinal": false,
   *   "chart": {...}   // opening turn only - drives the chart header
   * }
   * ======================================================================== */

  /**
   * stripFences(text) -> the payload with an ENCLOSING code fence removed.
   *
   * This deliberately only unwraps a fence that the whole reply is wrapped in.
   * It used to strip the first fence found ANYWHERE, which meant a perfectly
   * valid turn whose narration happened to quote a code block -
   *   {"narration":"the board reads ```json\n{\"x\":1}\n``` ..."}
   * - was parsed as the fragment inside the student's own narration, and the
   * real turn was thrown away. parseTurnJSON() tries the raw text first now,
   * so an unfenced reply never reaches this function's guesswork at all.
   */
  function stripFences(text) {
    var t = str(text).trim();
    if (t.slice(0, 3) !== '```') return t;
    var whole = /^```[a-zA-Z]*\s*([\s\S]*?)\s*```\s*$/.exec(t);
    if (whole) return whole[1].trim();
    var inner = /^```[a-zA-Z]*\s*([\s\S]*?)```/.exec(t);
    if (inner) return inner[1].trim();
    return t.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```\s*$/, '').trim();
  }

  /** the first fenced block anywhere - a last resort, tried after everything else */
  function firstFencedBlock(text) {
    var m = /```[a-zA-Z]*\s*([\s\S]*?)```/.exec(str(text));
    return m ? m[1].trim() : null;
  }

  function outermostObject(text) {
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return text.slice(start, end + 1);
  }

  /**
   * parseTurnJSON(raw) -> object | null.  NEVER throws.
   * Handles: clean JSON, ```json fences, leading prose, trailing prose,
   * trailing commas, smart quotes around the whole payload.
   */
  function parseTurnJSON(raw) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
    var whole = str(raw).trim();
    if (!whole) return null;

    /* Order matters and it is not arbitrary. The raw reply is tried FIRST,
       because a well-formed turn is the common case and any rewriting we do
       can only damage it. Only when that fails do we start guessing. */
    var attempts = [], seen = {};
    function add(s) {
      var v = str(s).trim();
      if (!v || seen[v]) return;
      seen[v] = true;
      attempts.push(v);
    }
    add(whole);
    add(stripFences(whole));
    add(outermostObject(whole));
    add(firstFencedBlock(whole));
    var i, j, v;
    /* carve an object out of each candidate as a further fallback */
    var carveFrom = attempts.slice();
    for (j = 0; j < carveFrom.length; j++) add(outermostObject(carveFrom[j]));

    for (i = 0; i < attempts.length; i++) {
      try {
        v = JSON.parse(attempts[i]);
        if (v && typeof v === 'object' && !Array.isArray(v)) return v;
      } catch (e) { /* next shape */ }
    }
    /* trailing-comma repair */
    for (i = 0; i < attempts.length; i++) {
      try {
        v = JSON.parse(attempts[i].replace(/,\s*([\]}])/g, '$1'));
        if (v && typeof v === 'object' && !Array.isArray(v)) return v;
      } catch (e) { /* next shape */ }
    }
    return null;
  }

  function strArray(v, cap, maxLen) {
    var out = [], lim = maxLen || 300;
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) {
        var s = str(typeof v[i] === 'object' ? (obj(v[i]).text || obj(v[i]).name) : v[i]).trim();
        if (s) out.push(cut(s, lim));
      }
    } else if (typeof v === 'string' && v.trim()) {
      out.push(cut(v.trim(), lim));
    }
    return cap ? out.slice(0, cap) : out;
  }

  function oneOf(v, list, dflt) {
    var s = str(v).toLowerCase().replace(/[\s-]+/g, '_');
    return (list.indexOf(s) !== -1) ? s : dflt;
  }

  /**
   * Some models answer "vitals" with one prose line instead of an object.
   * Silently dropping it blanked the whole monitor, which reads to the student
   * as a broken sim rather than a sloppy model, so pull the numbers back out.
   */
  function vitalsFromText(s) {
    var t = str(s), out = {}, m;
    m = /\b(?:bp|blood\s*pressure)\D{0,4}(\d{2,3}\s*\/\s*\d{2,3})/i.exec(t);
    if (m) out.bp = m[1].replace(/\s+/g, '');
    m = /\b(?:hr|heart\s*rate|pulse)\D{0,4}(\d{2,3})/i.exec(t);
    if (m) out.hr = m[1];
    m = /\b(?:rr|resp(?:iration|iratory)?s?(?:\s*rate)?)\D{0,4}(\d{1,2})/i.exec(t);
    if (m) out.rr = m[1];
    m = /\b(?:spo2|sao2|o2\s*sat\w*|sat\w*)\D{0,4}(\d{2,3})/i.exec(t);
    if (m) out.spo2 = m[1];
    m = /\b(?:temp\w*)\D{0,4}(\d{2,3}(?:\.\d)?\s*(?:°?\s*[CF])?)/i.exec(t);
    if (m) out.temp = m[1].trim();
    m = /\bpain\D{0,4}(\d{1,2}\s*\/\s*10)/i.exec(t);
    if (m) out.pain = m[1].replace(/\s+/g, '');
    m = /\b(?:loc|level of consciousness)\s*[:\-]?\s*([A-Za-z][A-Za-z ,'-]{2,40})/i.exec(t);
    if (m) out.loc = m[1].trim();
    return out;
  }

  /** one vital value the model may have sent as an object rather than a scalar */
  function flattenVital(val) {
    var o = obj(val);
    var sys = o.systolic !== undefined ? o.systolic : o.sys;
    var dia = o.diastolic !== undefined ? o.diastolic : o.dia;
    if (sys !== undefined && sys !== null && dia !== undefined && dia !== null) {
      return str(sys).trim() + '/' + str(dia).trim();
    }
    var keys = ['value', 'val', 'reading', 'text', 'result', 'description'];
    for (var i = 0; i < keys.length; i++) {
      var c = o[keys[i]];
      if (typeof c === 'number') return c;
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return '';
  }

  function normalizeVitals(v, prev) {
    /* a whole-object string payload, e.g. "BP 88/54, HR 132, RR 34" */
    var src = (typeof v === 'string') ? vitalsFromText(v) : obj(v);
    var out = {}, base = obj(prev);
    for (var i = 0; i < VITAL_KEYS.length; i++) {
      var k = VITAL_KEYS[i].k;
      var val = src[k];
      if (val && typeof val === 'object') val = flattenVital(val);
      if (val === undefined || val === null || val === '') {
        out[k] = (base[k] === undefined) ? '' : base[k];
      } else if (typeof val === 'number') {
        out[k] = val;
      } else {
        out[k] = cut(str(val).trim(), 60);
      }
    }
    return out;
  }

  var GENERIC_OPTIONS = [
    { text: 'Perform a focused reassessment of the primary system involved', quality: 'correct' },
    { text: 'Recheck a full set of vital signs and level of consciousness', quality: 'acceptable' },
    { text: 'Notify the provider with an SBAR update', quality: 'acceptable' },
    { text: 'Document your findings and continue with routine rounds', quality: 'wrong' }
  ];

  function normalizeOptions(v, seed) {
    var raw = arr(v), out = [], i, o, text;
    /* Two buttons with identical text is not a hard choice, it is a broken
       screen - and the student cannot tell which one they pressed. */
    var seenText = {};
    for (i = 0; i < raw.length && out.length < 6; i++) {
      o = raw[i];
      if (typeof o === 'string') { text = o.trim(); o = {}; }
      else { o = obj(o); text = str(o.text || o.label || o.action).trim(); }
      text = cut(text, 240);
      if (!text) continue;
      var dedupe = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (seenText[dedupe]) continue;
      seenText[dedupe] = true;
      out.push({
        id: String.fromCharCode(97 + out.length),
        text: text,
        quality: oneOf(o.quality, QUALITIES, 'acceptable')
      });
    }
    if (out.length < 2) {
      out = GENERIC_OPTIONS.map(function (g, idx) {
        return { id: String.fromCharCode(97 + idx), text: g.text, quality: g.quality };
      });
    }
    /* shuffle so the correct answer is never positionally predictable */
    var shuffled = shuffleSeeded(out, seed || 7);
    for (i = 0; i < shuffled.length; i++) shuffled[i].id = String.fromCharCode(97 + i);
    return shuffled;
  }

  var CHART_PLACEHOLDER_NAME = 'Unnamed patient';

  function normalizeChart(v) {
    var c = obj(v);
    return {
      name: cut(str(c.name || c.patientName).trim(), 120) || CHART_PLACEHOLDER_NAME,
      age: cut(str(c.age).trim(), 40) || 'Adult',
      sex: cut(str(c.sex || c.gender).trim(), 40),
      weightKg: cut(str(c.weightKg || c.weight).trim(), 40),
      room: cut(str(c.room || c.bed).trim(), 40),
      admittingDx: cut(str(c.admittingDx || c.diagnosis || c.admittingDiagnosis).trim(), 200) || 'Pending',
      allergies: strArray(c.allergies, 6, 80),
      codeStatus: cut(str(c.codeStatus).trim(), 60) || 'Full Code',
      chiefComplaint: cut(str(c.chiefComplaint || c.complaint).trim(), 200),
      history: strArray(c.history || c.pmh, 8, 160)
    };
  }

  /**
   * chartUsable(rawChart) -> is this good enough to run a simulation on?
   *
   * normalizeChart() is deliberately forgiving - it fills every field with a
   * placeholder so nothing downstream has to null-check. That forgiveness is
   * exactly why the opening turn cannot use it as its gate: `"chart": {}`
   * normalises into a complete-looking chart for "Unnamed patient", which is
   * how a chartless run used to slip past the opening retry and hang the
   * header on "Admitting patient..." forever. Gate on the RAW payload.
   */
  function chartUsable(raw) {
    var c = obj(raw);
    var name = str(c.name || c.patientName).trim();
    if (!name || name.toLowerCase() === CHART_PLACEHOLDER_NAME.toLowerCase()) return false;
    return true;
  }

  /**
   * normalizeTurn(parsed, ctx) -> a complete, safe turn object.
   * ctx: {prevVitals, seed, turnNumber, phase}
   *
   * Every free-text field the model owns is length-capped here. The spec asks
   * for 2-4 sentences; these ceilings are several times that, so nothing
   * legitimate is ever clipped, and a runaway generation cannot flood the
   * transcript, the DOM, or the next eight prompts.
   */
  function normalizeTurn(parsed, ctx) {
    var p = obj(parsed), c = obj(ctx);
    var narration = cut(str(p.narration || p.narrative || p.scene).trim(), MAX_NARRATION);
    var speech = p.patientSpeech;
    speech = (typeof speech === 'string' && speech.trim()) ? cut(speech.trim(), MAX_SPEECH) : null;

    var fb = p.feedbackOnLastAction;
    fb = (typeof fb === 'string' && fb.trim()) ? cut(fb.trim(), MAX_FEEDBACK) : null;

    var hint = p.hint;
    hint = (typeof hint === 'string' && hint.trim()) ? cut(hint.trim(), MAX_FEEDBACK) : null;

    var quality = QUALITIES.indexOf(oneOf(p.lastActionQuality, QUALITIES, '')) !== -1
      ? oneOf(p.lastActionQuality, QUALITIES, null) : null;

    var outcome = OUTCOMES.indexOf(oneOf(p.outcome, OUTCOMES, '')) !== -1
      ? oneOf(p.outcome, OUTCOMES, null) : null;

    return {
      speaker: oneOf(p.speaker, Object.keys(SPEAKERS), 'instructor'),
      narration: narration || 'The scene holds steady. Nothing new is offered - decide your next action.',
      patientSpeech: speech,
      vitals: normalizeVitals(p.vitals, c.prevVitals),
      trend: oneOf(p.trend, TRENDS, 'stable'),
      newFindings: strArray(p.newFindings || p.findings, 6, 240),
      feedbackOnLastAction: fb,
      lastActionQuality: quality,
      options: normalizeOptions(p.options, numOr(c.seed, 7) + numOr(c.turnNumber, 0) * 101),
      phase: oneOf(p.phase, PHASES, str(c.phase) || 'assessment'),
      outcome: outcome,
      hint: hint,
      rubricHits: strArray(p.rubricHits || p.rubric, 8, 60),
      scoreDelta: clamp(Math.round(numOr(p.scoreDelta, 0)), -10, 10),
      isFinal: p.isFinal === true,
      chart: p.chart ? normalizeChart(p.chart) : null
    };
  }

  function degradedTurn(ctx) {
    var t = normalizeTurn({
      speaker: 'instructor',
      narration: 'The record stutters for a moment - the monitor redraws and the note you were reading does not load. ' +
                 'Nothing about the patient has changed while you waited. Take your next action.',
      patientSpeech: null,
      trend: obj(ctx).trend || 'stable',
      lastActionQuality: null,
      feedbackOnLastAction: null,
      options: GENERIC_OPTIONS,
      phase: obj(ctx).phase || 'assessment',
      scoreDelta: 0
    }, ctx);
    t.degraded = true;
    return t;
  }

  /* ==========================================================================
   * 4. PATIENT CONDITION ENGINE
   * --------------------------------------------------------------------------
   * The model is NOT the source of truth for how sick the patient is.
   * Stability (0-100) is owned here:
   *   - baseline by difficulty (Student 72 / Competent 60 / Challenge 52)
   *   - quality delta: correct +6, acceptable +2, suboptimal -4, wrong -9,
   *     harmful -18
   *   - passive drift of -2 (Student) to -5 (Challenge) every turn until the
   *     key stabilizing intervention for the grounded condition is performed
   *   - a small +8 credit for correctly escalating when escalation is indicated
   * Decline is always recoverable with correct action until stability hits 0.
   * ======================================================================== */

  /**
   * stepStability(prev, quality, opts) -> {stability, delta, drift, qualityDelta}
   * opts: {drift, keyDone, escalatedNow, degraded, floorAtZero}
   */
  function stepStability(prev, quality, opts) {
    var o = obj(opts);
    var start = clamp(numOr(prev, 60), 0, 100);
    var qd = (quality && QUALITY_DELTA[quality] !== undefined) ? QUALITY_DELTA[quality] : 0;

    /* a parse failure must never cost the student anything */
    var drift = o.degraded ? 0 : (o.keyDone ? 0 : -Math.abs(numOr(o.drift, 3)));

    /* recognising deterioration and getting help is worth real credit */
    var escalationCredit = o.escalatedNow ? 8 : 0;

    /* correct action always outruns drift, so decline is never unwinnable */
    var delta = qd + drift + escalationCredit;
    var next = clamp(Math.round((start + delta) * 10) / 10, 0, 100);

    return {
      stability: next,
      delta: Math.round((next - start) * 10) / 10,
      qualityDelta: qd,
      drift: drift,
      escalationCredit: escalationCredit
    };
  }

  /**
   * resolveOutcome(run) -> one of the five endings (six ids: code and death
   * share the "worst case" debrief but read differently).
   */
  function resolveOutcome(run) {
    var r = obj(run);
    var s = numOr(r.stability, 60);

    if (s <= 0) return 'death';
    if (s < 25) return r.escalated ? 'rapid_response' : 'code';
    if (r.escalated && r.escalatedIndicated) return 'rapid_response';
    if (s >= 68 && !r.harmfulCount && numOr(r.missedCriticalCount, 0) <= 1) return 'success';
    if (s >= 45) return 'partial';
    return 'decline';
  }

  var OUTCOME_META = {
    success: {
      title: 'Patient stable - strong performance',
      kind: 'good',
      lede: 'You assessed in the right order, caught what mattered, and intervened before the patient lost ground.'
    },
    partial: {
      title: 'Patient stable - with gaps',
      kind: 'mixed',
      lede: 'You got there. Some pieces were late or missing, and on a real unit that lag is where harm hides.'
    },
    rapid_response: {
      title: 'Rapid Response activated - correct call',
      kind: 'good',
      lede: 'You recognised that this patient was beyond what you could safely manage alone and you got help. ' +
            'That is a core nursing competency, not a failure. Nurses who escalate early save patients.'
    },
    decline: {
      title: 'Patient deteriorated - escalation never happened',
      kind: 'bad',
      lede: 'The patient got sicker while care continued as if nothing was changing, and no one was called.'
    },
    /* reached only when stability < 25 AND the student never escalated, so the
       defining fact of this ending is that nobody was called */
    code: {
      title: 'The patient arrested',
      kind: 'grave',
      lede: 'The code team was called by someone else. Stability had been in the rapid-response range for ' +
            'several turns before this point and no one was called. Read the next section before the score - ' +
            'that is where the run actually turned.'
    },
    death: {
      title: 'The patient died',
      kind: 'grave',
      lede: 'Sit with that for a second. Then read the next section - not to be told what you did wrong, but ' +
            'because there was a specific point in this run where the trajectory was still changeable, and ' +
            'knowing where it was is the whole point of doing this here instead of on a real unit.'
    }
  };

  /* the rapid-response lede is right, but a call made at peri-arrest is not the
     same call as one made at 60/100 - say so without taking the credit back */
  function ledeFor(run, meta) {
    var base = str(obj(meta).lede);
    if (str(obj(run).outcome) === 'rapid_response' && numOr(obj(run).stability, 100) < 25) {
      return base + ' You called late - the patient was already peri-arrest when help arrived. The call was ' +
             'right; the timing is the thing to work on.';
    }
    return base;
  }

  /* ==========================================================================
   * 5. PROMPTS
   * ======================================================================== */

  var PROTOCOL_SPEC = [
    'RESPOND WITH ONE STRICT JSON OBJECT AND NOTHING ELSE.',
    'No prose before it. No prose after it. No markdown. No code fences. No comments inside the JSON.',
    'Exact shape (every key required except "chart"):',
    '{',
    '  "speaker": "patient" | "instructor" | "charge_nurse" | "provider" | "family" | "monitor",',
    '  "narration": "what the student sees and hears right now, 2-4 sentences, present tense, second person",',
    '  "patientSpeech": "the verbatim words the patient says, or null",',
    '  "vitals": {"bp":"138/88","hr":112,"rr":26,"temp":"101.4 F","spo2":91,"pain":"7/10","loc":"Alert, anxious"},',
    '  "trend": "stable" | "improving" | "declining" | "critical",',
    '  "newFindings": ["Crackles in bilateral bases", "Capillary refill 4 seconds"],',
    '  "feedbackOnLastAction": "1-2 sentences on what they did well or missed, or null on turn 1",',
    '  "lastActionQuality": "correct" | "acceptable" | "suboptimal" | "wrong" | "harmful" | null,',
    '  "options": [{"id":"a","text":"Auscultate lung sounds in all fields","quality":"correct"},',
    '              {"id":"b","text":"Document and continue rounds","quality":"wrong"}],',
    '  "phase": "arrival" | "assessment" | "intervention" | "escalation" | "handoff" | "complete",',
    '  "outcome": null | "success" | "partial" | "decline" | "rapid_response" | "code" | "death",',
    '  "hint": "a nudge if asked for help, else null",',
    '  "rubricHits": ["focused_respiratory_assessment", "recognized_hypoxemia"],',
    '  "scoreDelta": -10 to 10,',
    '  "isFinal": false',
    '}',
    '',
    'OPTIONS RULES:',
    '- Always return exactly 4 options.',
    '- Exactly one is "correct" (the true priority action right now).',
    '- Include one "acceptable" (a real nursing action that is simply not first),',
    '  one "suboptimal" or "wrong" (plausible but out of order or low value),',
    '  and one that is "wrong" or "harmful" (a classic ATI distractor or an actual safety error).',
    '- Options must be concrete nursing actions in the student voice, 4 to 14 words.',
    '- NEVER hint at the quality inside the option text. Do not label them.',
    '- Vary the order you write them in; do not always put the correct one first.',
    '',
    'GRADING RULES:',
    '- "lastActionQuality" grades ONLY the single action the student just took.',
    '- Grade free text generously on intent but strictly on priority: the right action at the wrong',
    '  time is "suboptimal", not "correct".',
    '- Anything on the CRITICAL ERRORS list is "harmful". So is any unsafe medication action.',
    '- "rubricHits" are snake_case competency tags drawn from what they actually demonstrated.',
    '- "scoreDelta" is advisory only. The application owns the real score.'
  ].join('\n');

  function buildSystemPrompt(cfg) {
    var c = obj(cfg);
    var sc = obj(c.scenario);
    var diff = obj(c.difficulty);
    var keyIv = obj(c.keyIv);

    var L = [];
    L.push('You are the simulation engine for a nursing school high-fidelity clinical simulation.');
    L.push('A nursing student is performing a focused assessment on a NEWLY ADMITTED patient. You generate the case,');
    L.push('play every voice in the room, and evaluate each action. You are not a chatbot and you never chat.');
    L.push('');
    L.push('THIS IS A TRAINING SIMULATION. Nothing here is real medical advice. Never say that out loud in narration.');
    L.push('');
    L.push('=== APPROVED CLINICAL GROUND TRUTH ===');
    L.push('The case you generate must be a DIFFERENT PATIENT with the SAME underlying condition, and must stay');
    L.push('consistent with these findings, interventions and priorities. This is the medicine of the case; you may');
    L.push('not contradict it.');
    L.push('');
    L.push(str(c.ground));
    L.push('');
    L.push('=== HOW TO USE THE GROUND TRUTH ===');
    L.push('1. VARY freely: name, age (within the same developmental band), sex, ethnicity, occupation, family');
    L.push('   situation, personality, coping style, comorbidities, the exact trigger, and which complication threatens.');
    L.push('2. NEVER vary the pathophysiology, the direction the vitals move, the priority order of nursing actions,');
    L.push('   the drugs involved, or what counts as a critical error.');
    L.push('3. Keep every number inside a realistic range for this condition and this age. Never invent a drug that is');
    L.push('   not on the approved list. Never invent a lab value that would not occur in this condition.');
    L.push('4. The patient is a layperson. They do not know their diagnosis, their labs, or medical vocabulary.');
    L.push('5. Randomisation seed for this run: ' + numOr(c.seed, 1) + '. Use it to produce a presentation that is');
    L.push('   distinctly different from the reference patient above.');
    if (keyIv.action) {
      L.push('6. THE KEY STABILIZING INTERVENTION for this case is: "' + str(keyIv.action) + '".');
      L.push('   Until the student performs it, the underlying problem keeps progressing on its own.');
    }
    L.push('');
    L.push('=== DIFFICULTY: ' + str(diff.label).toUpperCase() + ' ===');
    if (diff.id === 'student') {
      L.push('Cue generously. The patient volunteers symptoms. Findings are unmistakable. Distractors are obviously wrong.');
    } else if (diff.id === 'competent') {
      L.push('Cue realistically. The patient under-reports. Early findings are subtle. Distractors are genuinely tempting.');
    } else {
      L.push('Cue sparsely. The patient minimises or is a poor historian, family interrupts, findings are easy to miss,');
      L.push('and at least one distractor each turn is a real intervention that is simply not the priority.');
    }
    L.push('');
    L.push('=== THE APP OWNS THE PATIENT, NOT YOU ===');
    L.push('Each turn you receive a STATE BLOCK containing the authoritative stability score (0-100).');
    L.push('Your narration, your vitals and your trend MUST match that number and the direction it is moving.');
    L.push('If the state block says the patient is deteriorating, the patient IS deteriorating - show it in the numbers,');
    L.push('the level of consciousness, the work of breathing, the skin, and the way the patient speaks.');
    L.push('Do NOT end the run on your own. Only set "outcome" and "isFinal" when the state block tells you to.');
    L.push('');
    L.push('=== NURSING PEDAGOGY ===');
    L.push('Grade with ABCs first, then Maslow, then safety, then acute before chronic and unstable before stable.');
    L.push('Assessment comes before intervention unless the patient is unstable - then act.');
    L.push('Feedback is 1-2 sentences, direct, second person, and always says WHY, naming the framework.');
    L.push('Speak ATI and NCLEX: name the classic trap when the student steps into one.');
    L.push('');
    L.push(PROTOCOL_SPEC);
    return L.join('\n');
  }

  function openingUserMessage(cfg) {
    var c = obj(cfg);
    return [
      'TURN 1 - ARRIVAL.',
      'Generate the novel patient now and open the simulation.',
      'Seed: ' + numOr(c.seed, 1) + '. Starting stability: ' + numOr(c.stability, 60) + '/100.',
      '',
      'The student is the nurse receiving this newly admitted patient. Give them exactly what a nurse gets at the',
      'door: the chief complaint, how the patient looks from the doorway, the first set of vitals, and nothing else.',
      'Do NOT reveal the diagnosis, the labs, or the plan. Make them work for it.',
      '',
      'Set "phase" to "arrival", "feedbackOnLastAction" to null, "lastActionQuality" to null, "outcome" to null,',
      '"isFinal" to false and "scoreDelta" to 0.',
      '',
      'This turn ONLY, add a "chart" key so the app can build the chart header:',
      '"chart": {"name":"...","age":"...","sex":"...","weightKg":"...","room":"...","admittingDx":"...",',
      '          "allergies":["..."],"codeStatus":"...","chiefComplaint":"...","history":["...","..."]}',
      'The name must NOT be the reference patient name. Age, sex and background must differ too.',
      '',
      'Return the JSON object only. Emit it COMPACT - no indentation, no newlines between keys,',
      'no markdown fences. Whitespace is wasted budget that can truncate your own reply.'
    ].join('\n');
  }

  function stateBlock(run, actionText, mode) {
    var r = obj(run);
    var s = numOr(r.stability, 60);
    var zone = zoneFor(s);
    var direction = (numOr(r.lastDelta, 0) < -0.4) ? 'and falling'
      : (numOr(r.lastDelta, 0) > 0.4 ? 'and improving' : 'and holding');

    var L = [];
    L.push('=== STATE BLOCK (authoritative - obey it) ===');
    L.push('TURN: ' + (r.turnCount + 1) + ' of ' + TURN_CAP);
    L.push('ELAPSED: ' + fmtClock(r.elapsedSec) + ' of simulated bedside time');
    L.push('PHASE: ' + str(r.phase));
    L.push('STABILITY: ' + s + '/100 ' + direction + ' (' + ZONE_META[zone].label + ')');

    if (zone === 'stable') {
      L.push('The patient is currently holding. Narrate a patient who is uncomfortable but compensating.');
    } else if (zone === 'concerning') {
      L.push('The patient\'s stability is ' + s + '/100 ' + direction + '. Your narration and vitals MUST show a patient ' +
             'who is starting to slip: early compensation failing, subtle changes the student should catch.');
    } else if (zone === 'rapid') {
      L.push('The patient\'s stability is ' + s + '/100 ' + direction + '. Your narration and vitals MUST reflect a VISIBLY ' +
             'DETERIORATING patient. Rapid Response is now clinically indicated. Do not rescue the patient in the ' +
             'narration - the student has to do that.');
    } else if (zone === 'critical') {
      L.push('The patient\'s stability is ' + s + '/100 ' + direction + '. This is PERI-ARREST. Vitals must be frankly ' +
             'abnormal, level of consciousness must be depressed, and the room must feel urgent.');
    } else {
      L.push('The patient has arrested. Narrate this soberly and without drama or gore.');
    }

    L.push('KEY STABILIZING INTERVENTION: ' + (r.keyIvAction ? '"' + r.keyIvAction + '"' : '(none defined)') +
           ' - ' + (r.keyDone ? 'PERFORMED at turn ' + r.keyDoneTurn + '; the underlying problem is now being treated.'
                              : 'NOT YET PERFORMED; the underlying problem is still progressing.'));
    L.push('ESCALATION: ' + (r.escalated ? 'the student escalated at turn ' + r.escalatedTurn + '.'
                                         : 'the student has not called for help yet.'));
    L.push('HINTS USED: ' + numOr(r.hintsUsed, 0));

    if (r.forceHandoff) {
      L.push('DIRECTIVE: the shift is ending. Move "phase" to "handoff" and have the provider (or the responding');
      L.push('rapid response team) ask the student for an SBAR report. Do not set "outcome" yet.');
    } else if (r.turnCount + 1 >= FORCE_HANDOFF_AT) {
      L.push('DIRECTIVE: begin steering toward handoff within the next two turns.');
    }
    if (r.turnCount + 1 < MIN_TURNS_FOR_OUTCOME) {
      L.push('DIRECTIVE: it is far too early to end this run. "outcome" MUST be null and "isFinal" MUST be false.');
    }

    L.push('');
    L.push('=== THE STUDENT\'S ACTION THIS TURN (' + str(mode) + ') ===');
    L.push(str(actionText) || '(the student did nothing and time passed)');
    L.push('');
    L.push('Evaluate that action, advance the scene by one beat, and return the JSON object only,');
    L.push('emitted COMPACT: no indentation, no newlines between keys, no markdown fences.');
    return L.join('\n');
  }

  var REPAIR_MESSAGE = [
    'That reply was not valid JSON and could not be parsed.',
    'Send the SAME turn again as ONE raw JSON object.',
    'Start your reply with { and end it with }. No code fences, no explanation, no trailing text.'
  ].join(' ');

  /* ==========================================================================
   * 6. SCORING
   * --------------------------------------------------------------------------
   * Scored on the same dimensions as the scripted engine so results are
   * directly comparable. Actions taken during the AI run are matched back onto
   * the grounded scenario's intervention list, which lets us hand SimEngine a
   * real `perf` object and reuse SimEngine.scorePerformance verbatim.
   * If SimEngine is absent we mirror its weights and result fields exactly.
   * ======================================================================== */

  var MIRROR_WEIGHTS = {
    critical: 35, ordering: 15, timeliness: 15, assessment: 12,
    communication: 10, education: 8, supporting: 5
  };
  var MIRROR_PASS = 80;

  function lisLength(seq) {
    var tails = [];
    for (var i = 0; i < seq.length; i++) {
      var v = seq[i], lo = 0, hi = tails.length;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (tails[mid] < v) lo = mid + 1; else hi = mid;
      }
      tails[lo] = v;
    }
    return tails.length;
  }

  /** byte-for-byte mirror of SimEngine.scorePerformance, used only as a fallback */
  function mirrorScore(scenario, perf, mode) {
    var sc = obj(scenario), p = obj(perf);
    var ivs = arr(sc.interventions);
    var criticals = ivs.filter(function (i) { return !!i.critical; });
    var doneMap = {};
    arr(p.performedIvIds).forEach(function (id) { doneMap[str(id)] = true; });

    var critDone = criticals.filter(function (i) { return doneMap[str(i.id)]; });
    var critPct = criticals.length ? critDone.length / criticals.length : 1;

    var seq = arr(p.ivOrderSeq).filter(function (n) { return typeof n === 'number' && isFinite(n); });
    var orderPct;
    if (seq.length < 2) orderPct = seq.length === 1 ? 1 : 0;
    else orderPct = lisLength(seq) / seq.length;
    var coverage = ivs.length ? clamp(seq.length / ivs.length, 0.35, 1) : 1;
    orderPct = orderPct * coverage;

    var stagesTotal = numOr(p.stagesTotal, 0);
    var timePct = !stagesTotal ? critPct
      : (numOr(p.stagesHeld, 0) + 0.4 * numOr(p.stagesPartial, 0)) / stagesTotal;
    timePct = clamp(timePct, 0, 1);

    var assessTotal = Math.max(1, numOr(p.assessTotal, 0) + 4);
    var assessPct = clamp((numOr(p.assessDone, 0) + numOr(p.chartViewed, 0)) / assessTotal, 0, 1);

    var commTotal = Math.max(1, numOr(p.commTotal, 1));
    var commPct = clamp((numOr(p.commDone, 0) + (p.sbarDone ? 1 : 0)) / (commTotal + 1), 0, 1);

    var eduTotal = Math.max(1, Math.min(3, numOr(p.eduTotal, 1)));
    var eduPct = clamp(numOr(p.eduDone, 0) / eduTotal, 0, 1);

    var supTotal = numOr(p.supportingTotal, 0);
    var supPct = supTotal ? clamp(numOr(p.supportingDone, 0) / supTotal, 0, 1) : 1;

    var cats = [
      { key: 'critical', label: 'Critical interventions', weight: MIRROR_WEIGHTS.critical, pct: critPct,
        detail: critDone.length + ' of ' + criticals.length + ' critical actions performed' },
      { key: 'ordering', label: 'Priority ordering', weight: MIRROR_WEIGHTS.ordering, pct: orderPct,
        detail: seq.length ? ('Longest correctly ordered run: ' + lisLength(seq) + ' of ' + seq.length)
                           : 'No graded interventions performed' },
      { key: 'timeliness', label: 'Timeliness', weight: MIRROR_WEIGHTS.timeliness, pct: timePct,
        detail: stagesTotal ? (numOr(p.stagesHeld, 0) + ' of ' + stagesTotal + ' deterioration events prevented')
                            : 'No deterioration events in this run' },
      { key: 'assessment', label: 'Assessment thoroughness', weight: MIRROR_WEIGHTS.assessment, pct: assessPct,
        detail: numOr(p.assessDone, 0) + ' focused assessments, ' + numOr(p.chartViewed, 0) + ' of 4 chart sections reviewed' },
      { key: 'communication', label: 'Communication', weight: MIRROR_WEIGHTS.communication, pct: commPct,
        detail: p.sbarDone ? 'SBAR handoff completed' : 'No SBAR handoff given' },
      { key: 'education', label: 'Patient education', weight: MIRROR_WEIGHTS.education, pct: eduPct,
        detail: numOr(p.eduDone, 0) + ' teaching point(s) delivered' },
      { key: 'supporting', label: 'Supporting interventions', weight: MIRROR_WEIGHTS.supporting, pct: supPct,
        detail: numOr(p.supportingDone, 0) + ' of ' + supTotal + ' non-critical interventions' }
    ];

    var earned = 0;
    cats.forEach(function (c) {
      c.earned = Math.round(c.weight * clamp(c.pct, 0, 1) * 10) / 10;
      earned += c.earned;
    });

    var perError = (mode === 'exam') ? 18 : 12;
    var errs = arr(p.errors);
    var penalty = Math.min(errs.length * perError, 45);
    var total = clamp(Math.round(earned - penalty), 0, 100);
    var letter = total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'F';

    return {
      total: total, earnedRaw: Math.round(earned * 10) / 10, penalty: penalty,
      letter: letter, passed: total >= MIRROR_PASS && errs.length === 0, passMark: MIRROR_PASS,
      categories: cats,
      missedCritical: criticals.filter(function (i) { return !doneMap[str(i.id)]; }),
      missedOther: ivs.filter(function (i) { return !i.critical && !doneMap[str(i.id)]; }),
      errors: errs,
      ordering: { seq: seq, lis: seq.length ? lisLength(seq) : 0 }
    };
  }

  function scoreWithEngine(scenario, perf, mode) {
    var eng = window.SimEngine;
    if (eng && isFn(eng.scorePerformance)) {
      try {
        var r = eng.scorePerformance(scenario, perf, mode);
        if (r && typeof r.total === 'number') return r;
      } catch (e) { /* fall through to the mirror */ }
    }
    return mirrorScore(scenario, perf, mode);
  }

  function countIv(ivs, pred) {
    var n = 0;
    for (var i = 0; i < ivs.length; i++) { if (pred(ivs[i])) n++; }
    return n;
  }

  function buildPerf(run, scenario) {
    var r = obj(run), sc = obj(scenario);
    var ivs = arr(sc.interventions);
    var criticals = ivs.filter(function (i) { return !!i.critical; });
    var matched = {};
    arr(r.matchedIvIds).forEach(function (id) { matched[str(id)] = true; });

    var supportingDone = 0;
    for (var i = 0; i < ivs.length; i++) {
      if (!ivs[i].critical && matched[str(ivs[i].id)]) supportingDone++;
    }

    return {
      performedIvIds: arr(r.matchedIvIds).slice(),
      ivOrderSeq: arr(r.ivOrderSeq).slice(),
      errors: arr(r.errors).slice(),
      stagesTotal: numOr(r.declineEvents, 0),
      stagesHeld: numOr(r.declineHandled, 0),
      stagesPartial: numOr(r.declinePartial, 0),
      assessDone: numOr(r.assessDone, 0),
      assessTotal: countIv(ivs, function (i) { return i.category === 'assessment'; }),
      chartViewed: Object.keys(obj(r.chartTabsViewed)).length,
      sbarDone: !!(r.sbar && numOr(r.sbar.pct, 0) >= 50),
      commDone: numOr(r.commDone, 0),
      commTotal: Math.max(1, countIv(ivs, function (i) {
        return i.category === 'escalation' || i.category === 'communication';
      })),
      eduDone: numOr(r.eduDone, 0),
      eduTotal: 2,
      supportingDone: supportingDone,
      supportingTotal: Math.max(0, ivs.length - criticals.length)
    };
  }

  /* score adjustments that only exist in this mode */
  var OUTCOME_ADJ = {
    success: 0, partial: 0, rapid_response: 3, decline: -5, code: -10, death: -15
  };

  /**
   * scoreRun(run, scenario) -> full result, including the SimEngine fields plus
   * this mode's modifiers (hints, free-text bonus, outcome).
   */
  function scoreRun(run, scenario) {
    var r = obj(run);
    var perf = buildPerf(r, scenario);
    var base = scoreWithEngine(scenario, perf, 'practice');

    var hintPenalty = numOr(r.hintsUsed, 0) * HINT_COST;

    /* free text and voice are harder than picking from a list, so answering
       well without the options is worth up to 4 points */
    var typedTurns = numOr(r.freeTextTurns, 0);
    var typedGood = numOr(r.freeTextGood, 0);
    var freeTextBonus = typedTurns ? Math.round(4 * (typedGood / typedTurns) * Math.min(1, typedTurns / 5)) : 0;

    var outcomeAdj = numOr(OUTCOME_ADJ[r.outcome], 0);
    var total = clamp(Math.round(numOr(base.total, 0) - hintPenalty + freeTextBonus + outcomeAdj), 0, 100);
    var letter = total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'F';

    return {
      total: total,
      base: numOr(base.total, 0),
      maxScore: 100,
      letter: letter,
      passed: total >= 80 && !arr(base.errors).length,
      categories: arr(base.categories),
      missedCritical: arr(base.missedCritical),
      missedOther: arr(base.missedOther),
      errors: arr(base.errors),
      penalty: numOr(base.penalty, 0),
      modifiers: {
        hints: -hintPenalty,
        freeText: freeTextBonus,
        outcome: outcomeAdj
      },
      perf: perf,
      sbar: r.sbar || null
    };
  }

  /* ---------------------------------------------------------------- persist */

  function saveRunResult(run, scenario, result) {
    var r = obj(run);
    var rec = {
      runId: str(r.runId),
      date: new Date().toISOString(),
      category: str(r.category),
      topic: str(r.topic),
      condition: str(r.condition),
      score: numOr(result.total, 0),
      maxScore: 100,
      pct: numOr(result.total, 0),
      outcome: str(r.outcome),
      turns: numOr(r.turnCount, 0),
      hintsUsed: numOr(r.hintsUsed, 0),
      timeSec: numOr(r.timeSec, 0),
      pausedSec: numOr(r.pausedSec, 0),
      pauseCount: numOr(r.pauseCount, 0),
      missedCritical: arr(result.missedCritical).map(function (i) { return str(i.action); }),
      harmfulActions: arr(r.harmfulActions).slice(),
      difficulty: str(r.difficultyId),
      stability: numOr(r.stability, 0)
    };

    /* the Dashboard reads simResults, so mirror into it as well */
    var simRec = {
      simId: 'ai-live:' + str(obj(scenario).id || r.category),
      date: rec.date,
      score: rec.score,
      maxScore: 100,
      pct: rec.pct,
      timeSec: rec.timeSec,
      missedCritical: rec.missedCritical,
      errors: arr(result.errors).map(function (e) { return str(obj(e).text || e); }),
      category: rec.category,
      mode: 'ai-live',
      letter: str(result.letter),
      passed: !!result.passed,
      title: 'AI Live Scenario: ' + rec.condition
    };

    var MM = MMx();
    if (isFn(MM.setProgress)) {
      try {
        MM.setProgress(function (prev) {
          var p = obj(prev), next = {}, k;
          for (k in p) { if (Object.prototype.hasOwnProperty.call(p, k)) next[k] = p[k]; }
          next.aiScenarioResults = arr(p.aiScenarioResults).concat([rec]);
          next.simResults = arr(p.simResults).concat([simRec]);
          return next;
        });
      } catch (e) { /* never let persistence break the debrief */ }
    }
    if (isFn(MM.recordActivity)) {
      try {
        MM.recordActivity('sim', {
          simId: simRec.simId, title: simRec.title, pct: rec.pct,
          passed: simRec.passed, outcome: rec.outcome
        });
      } catch (e) { /* noop */ }
    }
    return rec;
  }

  /* ==========================================================================
   * 7. STYLES (injected once, CSS variables only)
   * ======================================================================== */

  function injectStyles() {
    if (document.getElementById('aiscenario-styles')) return;
    var css = [
      '.ais-wrap{display:flex;flex-direction:column;gap:var(--sp-3)}',
      '.ais-h1{font-size:var(--fs-xl);font-weight:800;color:var(--text);margin:0}',
      '.ais-sub{font-size:var(--fs-sm);color:var(--text2);line-height:1.55;margin:0}',
      '.ais-lab{font-size:var(--fs-2xs);letter-spacing:.07em;text-transform:uppercase;color:var(--text3);',
      'font-weight:700}',
      '.ais-row{display:flex;gap:var(--sp-2);flex-wrap:wrap;align-items:center}',
      '.ais-col{display:flex;flex-direction:column;gap:var(--sp-3)}',
      '.ais-hr{height:1px;background:var(--border);border:0;margin:var(--sp-half) 0}',
      '.ais-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;',
      'clip:rect(0 0 0 0);white-space:nowrap;border:0}',

      /* ---- chooser grids ---- */
      '.ais-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--sp-2)}',
      '.ais-pick{text-align:left;background:var(--surface);border:1px solid var(--border);',
      'border-radius:var(--r-lg);',
      'padding:var(--sp-3);color:var(--text);cursor:pointer;min-height:44px;font-size:var(--fs-base);',
      'transition:border-color var(--dur-fast) ease,background var(--dur-fast) ease,',
      'transform var(--dur-fast) ease}',
      '.ais-pick:hover{border-color:var(--accent)}',
      '.ais-pick:active{transform:scale(.975);background:var(--surface3)}',
      '.ais-pick:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.ais-pick[aria-pressed="true"]{border-color:var(--accent);background:var(--surface3);',
      'box-shadow:0 0 0 1px var(--accent) inset}',
      '.ais-pick b{display:block;font-size:var(--fs-base);margin-bottom:3px}',
      '.ais-pick span{display:block;font-size:var(--fs-xs);color:var(--text2);line-height:1.5}',
      '.ais-pick .ais-chk{float:right;font-size:var(--fs-2xs);font-weight:800;color:var(--accent-fg)}',

      /* ---- segmented control ---- */
      '.ais-seg{display:flex;border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;',
      'background:var(--bg)}',
      '.ais-seg button{flex:1 1 0;min-width:0;min-height:44px;padding:var(--sp-2) var(--sp-2);border:0;',
      'background:transparent;color:var(--text2);font-size:var(--fs-sm);font-weight:600;cursor:pointer;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
      'transition:background var(--dur-fast) ease,transform var(--dur-fast) ease}',
      '.ais-seg button+button{border-left:1px solid var(--border)}',
      '.ais-seg button[aria-pressed="true"]{background:var(--accent);color:#fff}',
      '.ais-seg button:active{transform:scale(.975);background:var(--surface3)}',
      '.ais-seg button:disabled{opacity:.45;cursor:not-allowed}',
      '.ais-seg button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}',

      /* ---- status strip: severity first, identity last ---- */
      '.ais-strip{position:sticky;top:0;z-index:30;background:var(--surface);border:1px solid var(--border);',
      'border-radius:var(--r-lg);padding:var(--sp-3);display:flex;flex-direction:column;gap:var(--sp-2)}',
      '.ais-strip.z-rapid,.ais-strip.z-critical,.ais-strip.z-arrest{border-color:var(--zone-critical)}',
      '.ais-strip-row{display:flex;gap:var(--sp-3);align-items:flex-start}',
      '.ais-strip-row>.ais-stab{flex:1 1 auto;min-width:0}',
      '.ais-clock{text-align:right;flex:0 0 auto;font-variant-numeric:tabular-nums}',
      '.ais-clock b{display:block;font-size:var(--fs-lg);font-weight:800;color:var(--text);line-height:1.2}',
      '.ais-clock span{font-size:var(--fs-2xs);color:var(--text3)}',
      '.ais-escalate{width:100%;min-height:46px;border:0;border-radius:var(--r-md);background:var(--red);',
      'color:#fff;font-size:var(--fs-md);font-weight:800;cursor:pointer;',
      'transition:transform var(--dur-fast) ease,filter var(--dur-fast) ease}',
      '.ais-escalate:hover{filter:brightness(1.08)}',
      '.ais-escalate:active{transform:scale(.975)}',
      '.ais-escalate:disabled{opacity:.45;cursor:not-allowed}',
      '.ais-escalate:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',

      /* ---- pause: the state has to be unmistakable, not a subtle tint ---- */
      '.ais-pause{margin-top:6px;width:100%;min-height:36px;padding:6px var(--sp-2);',
      'border:1px solid var(--border);border-radius:var(--r-md);background:var(--bg);color:var(--text2);',
      'font-size:var(--fs-2xs);font-weight:800;letter-spacing:.06em;text-transform:uppercase;',
      'cursor:pointer;white-space:nowrap;',
      'transition:border-color var(--dur-fast) ease,transform var(--dur-fast) ease}',
      '.ais-pause:hover{border-color:var(--accent);color:var(--text)}',
      '.ais-pause:active{transform:scale(.975)}',
      '.ais-pause:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.ais-pause:disabled{opacity:.45;cursor:not-allowed}',
      '.ais-pause.on{border-color:var(--accent);background:var(--accent);color:#fff}',
      '.ais-pausebar{display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap;',
      'border:2px solid var(--accent);border-radius:var(--r-md);padding:var(--sp-2) var(--sp-3);',
      'background:color-mix(in srgb,var(--accent) 16%,var(--bg));color:var(--text)}',
      '.ais-pausebar b{font-size:var(--fs-md);font-weight:800;letter-spacing:.16em;color:var(--text)}',
      '.ais-pausebar span{font-size:var(--fs-xs);color:var(--text2);flex:1 1 180px;line-height:1.5}',
      '.ais-pausebar .ais-pause{margin-top:0;width:auto;flex:0 0 auto}',
      /* Everything that is not the pause control is visibly out of play. The
         disabled attributes on the controls are the real lockout - this is the
         part the student can see from across the room. */
      '.ais-wrap.is-paused .ais-log,.ais-wrap.is-paused .ais-act,.ais-wrap.is-paused .ais-chart{',
      'opacity:.34;pointer-events:none;filter:grayscale(.55)}',
      '.ais-wrap.is-paused .ais-vitals,.ais-wrap.is-paused .ais-mon-text,',
      '.ais-wrap.is-paused .ais-stab{opacity:.5}',
      '.ais-wrap.is-paused .ais-escalate{opacity:.45;pointer-events:none}',
      '.ais-allergy{font-size:var(--fs-xs);font-weight:800;letter-spacing:.05em;color:var(--red-fg);',
      'border:1px solid var(--red);border-radius:var(--r-sm);padding:5px var(--sp-2);',
      'background:color-mix(in srgb,var(--red) 10%,var(--bg))}',
      '.ais-mon-text{display:flex;gap:var(--sp-4);flex-wrap:wrap;font-size:var(--fs-sm);color:var(--text2);',
      'overflow-wrap:anywhere}',
      '.ais-mon-text b{color:var(--text3);font-weight:700}',
      '.ais-who{font-size:var(--fs-md);font-weight:800;color:var(--text);line-height:1.25}',
      '.ais-who small{display:block;font-size:var(--fs-xs);font-weight:500;color:var(--text2);margin-top:2px}',
      '.ais-meta{display:flex;gap:var(--sp-2);flex-wrap:wrap;align-items:center;',
      'font-variant-numeric:tabular-nums}',
      '.ais-chip{font-size:var(--fs-2xs);padding:3px var(--sp-2);border-radius:var(--r-full);',
      'border:1px solid var(--border);background:var(--bg);color:var(--text2);white-space:nowrap}',
      '.ais-chip.alert{border-color:var(--red);color:var(--red-fg)}',

      /* ---- vitals tiles (unified with sim-engine VitalTile) ---- */
      '.ais-vitals{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:var(--sp-2)}',
      '.ais-v{background:var(--bg);border:1px solid var(--border);border-left:3px solid var(--border);',
      'border-radius:var(--r-md);padding:7px 9px;min-width:0;display:flex;flex-direction:column;gap:1px}',
      '.ais-v .k{font-size:var(--fs-2xs);letter-spacing:.06em;text-transform:uppercase;color:var(--text3);',
      'display:flex;gap:4px;align-items:center;font-weight:800}',
      '.ais-v .k i{font-style:normal;font-size:9px;letter-spacing:-1px}',
      '.ais-v .val{font-size:var(--fs-2xl);font-weight:800;line-height:1.05;',
      'font-variant-numeric:tabular-nums;color:var(--text);display:block;',
      'white-space:normal;overflow-wrap:anywhere}',
      '.ais-v .unit{font-size:var(--fs-2xs);color:var(--text3);font-weight:700}',
      '.ais-v .dlt{font-size:var(--fs-2xs);font-weight:700;color:var(--text3);',
      'font-variant-numeric:tabular-nums}',
      '.ais-v .spark{height:20px;opacity:.9;margin-top:1px}',
      '.ais-v.s1{border-left-color:var(--zone-concerning);',
      'background:color-mix(in srgb,var(--zone-concerning) 8%,var(--bg))}',
      '.ais-v.s2{border-left-color:var(--zone-critical);',
      'background:color-mix(in srgb,var(--zone-critical) 12%,var(--bg))}',
      '.ais-v.s1 .val,.ais-v.s1 .k{color:var(--orange-fg)}',
      '.ais-v.s2 .val,.ais-v.s2 .k{color:var(--red-fg)}',
      '.ais-v.flash{animation:ais-flash 1.4s ease-out 1}',
      '@keyframes ais-flash{0%{background:var(--surface3)}100%{background:var(--bg)}}',

      /* ---- stability: a clinical severity indicator, not a health bar ---- */
      '.ais-stab{border-radius:var(--r-lg);padding:var(--sp-3);display:grid;gap:var(--sp-2);',
      'border:1px solid var(--border);background:var(--bg)}',
      '.ais-stab-main{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}',
      '.ais-stab-glyph{font-size:var(--fs-md);font-weight:800;line-height:1}',
      '.ais-stab-zone{font-size:var(--fs-sm);font-weight:800;letter-spacing:.08em}',
      '.ais-stab-num{margin-left:auto;font-size:var(--fs-2xl);font-weight:800;line-height:1;',
      'color:var(--text);font-variant-numeric:tabular-nums}',
      '.ais-stab-num small{font-size:var(--fs-2xs);font-weight:700;color:var(--text3)}',
      '.ais-stab-delta{font-size:var(--fs-sm);font-weight:700;font-variant-numeric:tabular-nums;',
      'color:var(--text2)}',
      '.ais-stab-note{font-size:var(--fs-xs);color:var(--text2)}',
      '.ais-stab-bar{position:relative;height:10px;border-radius:var(--r-full);background:var(--surface3);',
      'overflow:hidden}',
      /* every zone overrides this; the default must never be the disabled grey */
      '.ais-stab-fill{height:100%;border-radius:var(--r-full);background:var(--border-str)}',
      '.ais-stab-tick{position:absolute;top:0;bottom:0;width:1px;background:var(--bg);opacity:.75}',
      '.ais-stab-tick.t70{left:70%}.ais-stab-tick.t45{left:45%}.ais-stab-tick.t25{left:25%}',
      '.ais-pips{display:flex;gap:4px}',
      '.ais-pip{flex:1 1 0;height:5px;border-radius:2px;background:var(--surface3)}',
      '.ais-pip.on{background:currentColor}',
      /* zones: hue is the LAST channel, never the only one. Size, weight,
         border and severity-step count all escalate together. */
      '.ais-stab.z-stable{color:var(--green-fg)}',
      '.ais-stab.z-stable .ais-stab-fill{background:var(--zone-stable)}',
      '.ais-stab.z-stable .ais-stab-zone,.ais-stab.z-stable .ais-stab-glyph{color:var(--green-fg)}',
      '.ais-stab.z-concerning{border-color:var(--zone-concerning);color:var(--orange-fg)}',
      '.ais-stab.z-concerning .ais-stab-fill{background:var(--zone-concerning)}',
      '.ais-stab.z-concerning .ais-stab-zone,.ais-stab.z-concerning .ais-stab-glyph{',
      'color:var(--orange-fg)}',
      '.ais-stab.z-rapid{border:2px solid var(--zone-concerning);padding:var(--sp-3);',
      'color:var(--orange-fg)}',
      '.ais-stab.z-rapid .ais-stab-fill{background:var(--zone-concerning)}',
      '.ais-stab.z-rapid .ais-stab-num{font-size:32px}',
      '.ais-stab.z-rapid .ais-stab-zone,.ais-stab.z-rapid .ais-stab-glyph{color:var(--orange-fg)}',
      '.ais-stab.z-critical{border:2px solid var(--zone-critical);padding:var(--sp-4);',
      'color:var(--red-fg);background:color-mix(in srgb,var(--zone-critical) 10%,var(--bg))}',
      '.ais-stab.z-arrest{border:2px solid var(--zone-arrest);padding:var(--sp-4);',
      'color:var(--zone-arrest);background:color-mix(in srgb,var(--zone-arrest) 18%,var(--bg))}',
      '.ais-stab.z-critical .ais-stab-fill{background:var(--zone-critical)}',
      '.ais-stab.z-arrest .ais-stab-fill{background:var(--zone-arrest)}',
      '.ais-stab.z-critical .ais-stab-num,.ais-stab.z-critical .ais-stab-zone,',
      '.ais-stab.z-critical .ais-stab-glyph{color:var(--red-fg)}',
      '.ais-stab.z-arrest .ais-stab-num,.ais-stab.z-arrest .ais-stab-zone,',
      '.ais-stab.z-arrest .ais-stab-glyph{color:var(--zone-arrest)}',
      '.ais-stab.z-critical .ais-stab-num,.ais-stab.z-arrest .ais-stab-num{font-size:36px}',

      /* ---- transcript ---- */
      '.ais-log{display:flex;flex-direction:column;gap:var(--sp-3);max-height:52vh;max-height:52dvh;',
      'overflow:auto;padding-right:2px}',
      '.ais-turn{border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);',
      'padding:11px var(--sp-3);display:flex;flex-direction:column;gap:7px;opacity:.62;',
      'transition:opacity var(--dur-slow) ease}',
      '.ais-log .ais-turn:last-child{opacity:1}',
      '.ais-turn.sp-patient{border-left:3px solid var(--accent2)}',
      '.ais-turn.sp-instructor{border-left:3px solid var(--accent)}',
      '.ais-turn.sp-provider{border-left:3px solid var(--green)}',
      /* charge nurse gets its own hue - it used to be identical to provider */
      '.ais-turn.sp-charge_nurse{border-left:3px solid var(--info,var(--accent2))}',
      '.ais-turn.sp-family{border-left:3px solid var(--orange)}',
      '.ais-turn.sp-monitor{border-left:3px solid var(--red)}',
      '.ais-turn-head{display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap;',
      'font-size:var(--fs-2xs);color:var(--text3)}',
      '.ais-turn-head b{color:var(--text2);text-transform:uppercase;letter-spacing:.06em;',
      'font-size:var(--fs-2xs)}',
      '.ais-narr{font-size:var(--fs-base);line-height:1.65;color:var(--text);margin:0;',
      'overflow-wrap:anywhere}',
      '.ais-speech{font-size:var(--fs-base);line-height:1.65;color:var(--text);background:var(--bg);',
      'border-radius:var(--r-md);padding:9px 11px;border-left:3px solid var(--accent2);font-style:italic;',
      'margin:0;overflow-wrap:anywhere}',
      '.ais-find{margin:0;padding-left:18px;font-size:var(--fs-sm);color:var(--text2);line-height:1.65;',
      'overflow-wrap:anywhere}',
      '.ais-find li{margin:2px 0}',
      '.ais-fb{font-size:var(--fs-sm);line-height:1.65;color:var(--text2);background:var(--bg);',
      'border-radius:var(--r-md);padding:9px 11px;border:1px dashed var(--border);margin:0;',
      'overflow-wrap:anywhere}',
      '.ais-you{font-size:var(--fs-sm);color:var(--text2);background:var(--bg);border:1px solid var(--border);',
      'border-radius:var(--r-md);padding:var(--sp-2) 11px;margin:0;overflow-wrap:anywhere}',
      '.ais-you b{color:var(--text);font-weight:700}',

      /* ---- action area ---- */
      '.ais-act{border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);',
      'padding:var(--sp-3);display:flex;flex-direction:column;gap:var(--sp-3)}',
      /* while the model thinks, keep the options mounted and dim them - never reflow mid-read */
      '.ais-act.busy .ais-opt,.ais-act.busy .ais-ta{opacity:.45;pointer-events:none}',
      '.ais-opt{display:flex;gap:var(--sp-3);align-items:flex-start;text-align:left;width:100%;min-height:44px;',
      'background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:11px var(--sp-3);',
      'color:var(--text);font-size:var(--fs-base);line-height:1.5;cursor:pointer;',
      'transition:border-color var(--dur-fast) ease,background var(--dur-fast) ease,',
      'transform var(--dur-fast) ease}',
      '.ais-opt:hover{border-color:var(--accent);background:var(--surface3)}',
      '.ais-opt:active{transform:scale(.975);background:var(--surface3)}',
      '.ais-opt:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.ais-opt[disabled]{opacity:.45;cursor:not-allowed}',
      '.ais-opt .ltr{flex:0 0 auto;width:22px;height:22px;border-radius:var(--r-sm);background:var(--surface3);',
      'color:var(--text2);font-size:var(--fs-xs);font-weight:800;display:flex;align-items:center;',
      'justify-content:center;text-transform:uppercase}',
      '.ais-ta{width:100%;min-height:84px;background:var(--bg);color:var(--text);border:1px solid var(--border);',
      'border-radius:var(--r-md);padding:11px;font-size:var(--fs-md);line-height:1.5;font-family:inherit;',
      'resize:vertical}',
      '.ais-ta:focus-visible{outline:2px solid var(--accent);outline-offset:1px}',
      '.ais-free{display:flex;gap:var(--sp-2);flex-wrap:wrap}',
      '.ais-mini{min-height:44px;padding:var(--sp-2) var(--sp-3);border-radius:var(--r-md);',
      'border:1px solid var(--border);background:var(--bg);color:var(--text2);font-size:var(--fs-xs);',
      'cursor:pointer;transition:transform var(--dur-fast) ease,border-color var(--dur-fast) ease}',
      '.ais-mini:hover{color:var(--text);border-color:var(--accent)}',
      '.ais-mini:active{transform:scale(.975);background:var(--surface3)}',
      '.ais-mini:disabled{opacity:.45;cursor:not-allowed}',
      '.ais-mini:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.ais-mini.on{border-color:var(--accent);color:var(--text)}',

      /* ---- notices / thinking ---- */
      '.ais-note{border:1px solid var(--border);border-left:3px solid var(--orange);',
      'border-radius:var(--r-md);padding:var(--sp-3);font-size:var(--fs-sm);color:var(--text2);',
      'background:var(--surface);line-height:1.55}',
      '.ais-note.err{border-left-color:var(--red)}',
      '.ais-note.ok{border-left-color:var(--green)}',
      '.ais-note.info{border-left-color:var(--accent)}',
      '.ais-think{display:flex;align-items:center;gap:var(--sp-3);font-size:var(--fs-sm);color:var(--text2);',
      'background:var(--bg);border:1px dashed var(--border);border-radius:var(--r-md);padding:11px var(--sp-3)}',
      '.ais-think-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto;',
      'overflow-wrap:anywhere}',
      '.ais-elapsed{font-variant-numeric:tabular-nums;flex:0 0 auto}',
      '.ais-slow{display:flex;flex-direction:column;gap:var(--sp-2)}',
      '.ais-dots{display:inline-flex;gap:4px}',
      '.ais-dots i{width:6px;height:6px;border-radius:var(--r-full);background:var(--accent);display:block;',
      'animation:ais-bounce 1.1s ease-in-out infinite}',
      '.ais-dots i:nth-child(2){animation-delay:.16s}.ais-dots i:nth-child(3){animation-delay:.32s}',
      '@keyframes ais-bounce{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}',

      /* ---- chart drawer ---- */
      '.ais-chart{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-lg);',
      'padding:var(--sp-3);display:flex;flex-direction:column;gap:var(--sp-2)}',
      '.ais-kv{display:grid;grid-template-columns:104px 1fr;gap:4px var(--sp-3);font-size:var(--fs-sm)}',
      '.ais-kv .k{color:var(--text3)}.ais-kv .v{color:var(--text);overflow-wrap:anywhere}',

      /* ---- debrief ---- */
      '.ais-out{border-radius:var(--r-xl);padding:var(--sp-4);border:1px solid var(--border);display:flex;',
      'flex-direction:column;gap:var(--sp-2);background:var(--surface)}',
      '.ais-out.good{border-color:var(--green);border-left:5px solid var(--green)}',
      '.ais-out.mixed{border-color:var(--orange);border-left:5px solid var(--orange)}',
      '.ais-out.bad{border-color:var(--red);border-left:5px solid var(--red)}',
      '.ais-out.grave{border-color:var(--red);border-left:5px solid var(--red);background:var(--bg)}',
      '.ais-out h2{margin:0;font-size:var(--fs-lg);font-weight:800;color:var(--text);line-height:1.3}',
      '.ais-out p{margin:0;font-size:var(--fs-base);line-height:1.65;color:var(--text2)}',
      '.ais-out.grave h2{font-weight:700}',
      '.ais-score{display:flex;align-items:baseline;gap:var(--sp-3);flex-wrap:wrap}',
      '.ais-score .n{font-size:var(--fs-3xl);font-weight:800;line-height:1;color:var(--text);',
      'font-variant-numeric:tabular-nums}',
      '.ais-cat{display:flex;flex-direction:column;gap:4px}',
      '.ais-cat-head{display:flex;justify-content:space-between;gap:var(--sp-2);font-size:var(--fs-sm);',
      'color:var(--text)}',
      '.ais-cat-head span:last-child{color:var(--text2);font-variant-numeric:tabular-nums}',
      '.ais-bar{height:7px;border-radius:var(--r-full);background:var(--surface3);overflow:hidden}',
      '.ais-bar>i{display:block;height:100%;border-radius:var(--r-full);background:var(--accent)}',
      '.ais-list{margin:0;padding-left:18px;font-size:var(--fs-sm);line-height:1.65;color:var(--text2)}',
      '.ais-list li{margin:4px 0}',
      '.ais-list b{color:var(--text)}',
      /* structured teaching payload: scannable imperative + rationale underneath */
      '.ais-teach{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--sp-3)}',
      '.ais-teach li{border-left:3px solid var(--red);padding-left:var(--sp-3)}',
      '.ais-teach li.calm{border-left-color:var(--border)}',
      '.ais-teach b{display:block;font-size:var(--fs-md);font-weight:800;color:var(--text);line-height:1.35;',
      'overflow-wrap:anywhere}',
      '.ais-teach .ais-sub{margin-top:3px}',
      '.ais-ord{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--sp-2)}',
      '.ais-ord li{display:flex;gap:9px;font-size:var(--fs-sm);line-height:1.5;color:var(--text2)}',
      '.ais-ord .num{flex:0 0 auto;width:22px;height:22px;border-radius:var(--r-sm);background:var(--surface3);',
      'color:var(--text2);font-size:var(--fs-2xs);font-weight:800;display:flex;align-items:center;',
      'justify-content:center}',
      '.ais-ord li.hit .num{background:var(--green);color:var(--text-on-fill)}',
      '.ais-ord li.miss .num{background:var(--red);color:#fff}',

      /* ---- phones ---- */
      '@media (max-width:640px){',
      '.ais-vitals{grid-template-columns:repeat(3,minmax(0,1fr))}',
      '.ais-log{max-height:none}',
      '.ais-kv{grid-template-columns:92px 1fr}',
      '.ais-score .n{font-size:34px}',
      '.ais-strip-row{flex-wrap:wrap}',
      '}',
      '@media (max-width:400px){',
      '.ais-vitals{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.ais-seg button{font-size:var(--fs-xs);padding:var(--sp-2) 4px}',
      '.ais-grid{grid-template-columns:1fr}',
      '}',
      '@media (max-height:500px){.ais-log{max-height:60vh;max-height:60dvh}}',
      '@media (prefers-reduced-motion:reduce){',
      '.ais-v.flash{animation:none;box-shadow:inset 3px 0 0 0 var(--accent)}',
      '.ais-dots i{animation:none;opacity:.7}',
      '.ais-turn{transition:none}',
      '.ais-pick,.ais-opt,.ais-mini,.ais-seg button,.ais-escalate,.ais-pause{transition:none}',
      '.ais-pick:active,.ais-opt:active,.ais-mini:active,.ais-seg button:active,.ais-escalate:active,',
      '.ais-pause:active{transform:none;background:var(--surface3)}',
      '}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'aiscenario-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }
  injectStyles();

  /* ==========================================================================
   * 8. SMALL PRESENTATIONAL PIECES
   * ======================================================================== */

  /**
   * sevFor(key, value) -> 0 normal | 1 abnormal | 2 critical
   * Three levels, not a binary, and unit-aware: a Celsius temperature is
   * sniffed rather than assumed to be Fahrenheit, and blood pressure is
   * graded on systolic, diastolic and (when charted) MAP.
   */
  function sevFor(key, value) {
    var v = str(value), n;
    if (!v) return 0;

    if (key === 'bp') {
      var m = /(\d{2,3})\s*\/\s*(\d{2,3})/.exec(v);
      if (!m) return 0;
      var sys = parseInt(m[1], 10), dia = parseInt(m[2], 10);
      /* an explicitly charted MAP wins; otherwise estimate it */
      var mm = /map[^0-9]{0,4}(\d{2,3})/i.exec(v);
      var map = mm ? parseInt(mm[1], 10) : Math.round((sys + 2 * dia) / 3);
      if (sys < 90 || sys > 180 || dia > 110 || map < 65) return 2;
      if (sys < 100 || sys > 140 || dia < 50 || dia > 90 || map < 70) return 1;
      return 0;
    }
    if (key === 'hr') {
      n = numOr(v, NaN);
      return !isFinite(n) ? 0 : (n < 45 || n > 130) ? 2 : (n < 55 || n > 110) ? 1 : 0;
    }
    if (key === 'rr') {
      n = numOr(v, NaN);
      return !isFinite(n) ? 0 : (n < 9 || n > 30) ? 2 : (n < 11 || n > 24) ? 1 : 0;
    }
    if (key === 'spo2') {
      n = numOr(v, NaN);
      return !isFinite(n) ? 0 : (n < 88) ? 2 : (n < 94) ? 1 : 0;
    }
    if (key === 'temp') {
      n = numOr(v, NaN);
      if (!isFinite(n)) return 0;
      /* unit sniff, not unit assumption: scenario data and the model both emit
         Celsius, and 37.4 C is not a fever. */
      var f = (/c\b|celsius|°\s*c/i.test(v) || (n > 25 && n < 45)) ? (n * 9 / 5 + 32) : n;
      return (f < 95 || f > 103) ? 2 : (f < 96.5 || f > 100.4) ? 1 : 0;
    }
    if (key === 'pain') {
      var pm = /(\d{1,2})\s*\/\s*10/.exec(v);
      if (!pm) return 0;
      var pn = parseInt(pm[1], 10);
      return pn >= 8 ? 2 : pn >= 5 ? 1 : 0;
    }
    if (key === 'loc') {
      if (/unrespons|obtund|somnolen|difficult to arouse/i.test(v)) return 2;
      if (/confus|letharg|drowsy|restless|agitat|anxious|sleepy/i.test(v)) return 1;
      return 0;
    }
    return 0;
  }

  /* kept for callers that only want a boolean */
  function isAbnormal(key, value) { return sevFor(key, value) > 0; }

  var SEV_WORD = ['within limits', 'abnormal', 'CRITICAL'];

  /* numeric series for one key across the run - the data is already in
     run.turns[].vitals, it was simply never drawn */
  function seriesFor(turns, key) {
    var out = [];
    arr(turns).forEach(function (t) {
      var raw = obj(t.vitals)[key];
      var src = raw;
      if (key === 'bp') {
        var m = /(\d{2,3})/.exec(str(raw));
        src = m ? m[1] : null;
      }
      var n = numOr(src, NaN);
      if (isFinite(n)) out.push(n);
    });
    return out;
  }

  /* sim-engine owns the canonical sparkline; fall back to a local copy so this
     module still renders when it is loaded on its own */
  function LocalSparkline(props) {
    var pts = arr(obj(props).points).filter(function (n) {
      return typeof n === 'number' && isFinite(n);
    });
    if (pts.length < 2) return null;
    var w = 68, h = 20, pad = 2;
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    var span = (max - min) || 1;
    var d = pts.map(function (v, i) {
      var x = pad + (i * (w - pad * 2)) / (pts.length - 1);
      var y = h - pad - ((v - min) / span) * (h - pad * 2);
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    return ce('svg', {
      className: 'spark', viewBox: '0 0 ' + w + ' ' + h, width: '100%', height: h,
      preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false'
    }, ce('path', {
      d: d, fill: 'none', stroke: obj(props).color || 'var(--text3)', strokeWidth: 1.6,
      strokeLinecap: 'round', strokeLinejoin: 'round'
    }));
  }
  function sparkComp() {
    return isFn(window.VitalSparkline) ? window.VitalSparkline : LocalSparkline;
  }

  function AisVitalTile(props) {
    var p = obj(props);
    var sev = sevFor(p.k, p.val);
    var pts = arr(p.points);
    var delta = null;
    if (pts.length >= 2) {
      delta = Math.round((pts[pts.length - 1] - pts[pts.length - 2]) * 10) / 10;
    }
    var glyph = sev === 2 ? '••' : sev === 1 ? '•' : '';
    var dirMark = !delta ? '' : (delta > 0 ? '▲' : '▼');
    var shown = (p.val === '' || p.val === null || p.val === undefined) ? '--' : String(p.val);
    var sparkColor = sev === 2 ? 'var(--zone-critical)'
      : sev === 1 ? 'var(--zone-concerning)' : 'var(--text3)';

    return ce('div', {
      className: 'ais-v s' + sev + (p.changed ? ' flash' : ''),
      role: 'group',
      'aria-label': p.label + ' ' + shown + ' ' + str(p.unit) +
        (delta ? ', changed by ' + delta : '') + ', ' + SEV_WORD[sev]
    }, [
      ce('span', { className: 'k', key: 'k' }, [
        p.label,
        glyph ? ce('i', { key: 'g', 'aria-hidden': 'true' }, glyph) : null
      ]),
      ce('span', { className: 'val', key: 'v' }, [
        shown,
        (p.unit && shown !== '--') ? ce('span', { className: 'unit', key: 'u' }, ' ' + p.unit) : null
      ]),
      ce('span', { className: 'dlt', key: 'd', 'aria-hidden': 'true' },
        delta ? dirMark + ' ' + Math.abs(delta) : '—'),
      ce(sparkComp(), { key: 's', points: pts, color: sparkColor })
    ]);
  }

  function StabilityMeter(props) {
    var p = obj(props);
    var s = clamp(numOr(p.stability, 0), 0, 100);
    var zone = zoneFor(s);
    var meta = ZONE_META[zone];
    var d = numOr(p.delta, 0);

    /* the severity scale FILLS as the patient deteriorates, so the worst state
       in the app can never render as an empty track */
    var pips = [];
    for (var i = 0; i < 5; i++) {
      pips.push(ce('i', { key: 'p' + i, className: 'ais-pip' + (i <= meta.rank ? ' on' : '') }));
    }

    return ce('div', {
      className: 'ais-stab z-' + zone,
      role: 'status',
      'aria-live': meta.rank >= 2 ? 'assertive' : 'polite',
      'aria-label': 'Patient stability ' + s + ' out of 100. ' + meta.label + '. ' + meta.note + '. ' +
        'Trend ' + (TREND_ARROW[str(p.trend)] || 'LEVEL') + '.'
    }, [
      ce('div', { className: 'ais-stab-main', key: 'm' }, [
        ce('span', { className: 'ais-stab-glyph', key: 'g', 'aria-hidden': 'true' }, meta.glyph),
        ce('span', { className: 'ais-stab-zone', key: 'z' }, meta.label),
        ce('span', { className: 'ais-stab-num', key: 'n' }, [
          String(s), ce('small', { key: 's' }, '/100')
        ]),
        ce('span', { className: 'ais-stab-delta', key: 'd' },
          d === 0 ? '—' : (d > 0 ? '▲ +' + d : '▼ ' + d))
      ]),
      ce('div', { className: 'ais-stab-note', key: 'nt' }, meta.note),
      ce('div', { className: 'ais-stab-bar', key: 'b', 'aria-hidden': 'true' }, [
        /* never zero-width: a dying patient must never read as an empty track */
        ce('div', { className: 'ais-stab-fill', key: 'f', style: { width: Math.max(6, s) + '%' } }),
        ce('span', { className: 'ais-stab-tick t70', key: 't1' }),
        ce('span', { className: 'ais-stab-tick t45', key: 't2' }),
        ce('span', { className: 'ais-stab-tick t25', key: 't3' })
      ]),
      ce('span', { className: 'ais-pips', key: 'p', 'aria-hidden': 'true' }, pips)
    ]);
  }

  function VitalsGrid(props) {
    var p = obj(props);
    var v = obj(p.vitals), prev = obj(p.prevVitals);
    var turns = arr(p.turns);
    var spokenRef = useRef({});

    /* Threshold-crossing announcer. The grid itself is NOT a live region -
       six numbers re-read on every turn is unusable - so only a change of
       severity level for a vital is spoken. */
    var sevKey = TILE_KEYS.map(function (spec) { return sevFor(spec.k, v[spec.k]); }).join('');
    useEffect(function () {
      var msgs = [], urgent = false, first = true, k;
      for (k in spokenRef.current) {
        if (Object.prototype.hasOwnProperty.call(spokenRef.current, k)) { first = false; break; }
      }
      TILE_KEYS.forEach(function (spec) {
        var sev = sevFor(spec.k, v[spec.k]);
        if (spokenRef.current[spec.k] === sev) return;
        var known = spokenRef.current[spec.k] !== undefined;
        spokenRef.current[spec.k] = sev;
        if (!known && sev === 0) return;          /* silence on first paint if normal */
        if (known && sev === 0) { msgs.push(spec.label + ' back within limits'); return; }
        if (sev === 0) return;
        if (sev === 2) urgent = true;
        msgs.push(spec.label + ' ' + str(v[spec.k]) + ', ' + SEV_WORD[sev]);
      });
      if (msgs.length && !first) announce(msgs.join('. '), urgent);
    }, [sevKey]);

    var cells = TILE_KEYS.map(function (spec) {
      var val = v[spec.k];
      var changed = !!p.flash && str(prev[spec.k]) !== '' && str(prev[spec.k]) !== str(val);
      return ce(AisVitalTile, {
        key: spec.k + '-' + (changed ? str(p.turn) : 'x'),
        k: spec.k, label: spec.label, unit: spec.unit, val: val,
        changed: changed, points: seriesFor(turns, spec.k)
      });
    });
    return ce('div', { className: 'ais-vitals', role: 'group', 'aria-label': 'Current vital signs' }, cells);
  }

  function Segmented(props) {
    var p = obj(props);
    return ce('div', { className: 'ais-seg', role: 'group', 'aria-label': str(p.label) || 'Options' },
      arr(p.items).map(function (it) {
        return ce('button', {
          key: it.id, type: 'button',
          'aria-pressed': p.value === it.id ? 'true' : 'false',
          disabled: !!it.disabled,
          title: str(it.hint),
          onClick: function () { if (isFn(p.onChange)) p.onChange(it.id); }
        }, it.label);
      })
    );
  }

  /* ==========================================================================
   * HONEST PROGRESS
   * --------------------------------------------------------------------------
   * The Netlify function BUFFERS the upstream SSE stream - the classic
   * exports.handler runtime cannot stream a response body - so `onToken`
   * normally fires exactly once, at the very end, with the entire reply. Any
   * indicator driven off token arrival is therefore completely frozen for the
   * whole generation, which is precisely what "sometimes it just doesn't load"
   * looks like from the student's chair.
   *
   * So: the elapsed counter runs on its OWN interval and the stage text
   * advances on the clock. Nothing here is a fake progress bar. It reports the
   * only two things we honestly know - how long we have been waiting, and how
   * many characters have actually arrived - and the stage labels describe what
   * the request is doing, not how far along it is.
   * ======================================================================== */

  var MIDRUN_CLOCK_AT = 5;   // mid-run: start showing the counter after 5s
  var SLOW_NOTE_AT    = 20;  // mid-run: name the cause after 20s
  var SLOW_WARN_AT    = 30;  // any turn: offer a retry rather than wait out 130s

  var OPENING_STAGES = [
    { at: 0,  text: 'Contacting the unit...' },
    { at: 5,  text: 'Pulling the chart...' },
    { at: 12, text: 'Getting report from the off-going nurse...' },
    { at: 24, text: 'Still on the phone with report - this model is running slow...' }
  ];

  function stageText(stages, seconds) {
    var list = arr(stages), out = list.length ? str(list[0].text) : '';
    for (var i = 0; i < list.length; i++) {
      if (numOr(seconds, 0) >= numOr(list[i].at, 0)) out = str(list[i].text);
    }
    return out;
  }

  /**
   * Thinking props:
   *   label        what we are doing right now (staged, and character counts
   *                folded in, by the caller - see RunScreen)
   *   seconds      elapsed seconds for THIS request
   *   showSeconds  render the counter (mid-run turns hide it for the first 5s)
   *   note         an extra honest line, e.g. the slow-model warning
   */
  function Thinking(props) {
    var p = obj(props);
    var secs = Math.max(0, Math.floor(numOr(p.seconds, 0)));
    return ce('div', { className: 'ais-think', role: 'status', 'aria-live': 'polite' }, [
      ce('span', { className: 'ais-dots', key: 'd', 'aria-hidden': 'true' },
        [ce('i', { key: 1 }), ce('i', { key: 2 }), ce('i', { key: 3 })]),
      ce('span', { className: 'ais-think-main', key: 't' }, [
        ce('span', { key: 'l' }, str(p.label) || 'The scenario is responding...'),
        p.note ? ce('span', { className: 'ais-lab', key: 'n' }, str(p.note)) : null
      ]),
      (p.showSeconds !== false && secs > 0)
        ? ce('span', { key: 's', className: 'ais-lab ais-elapsed' }, secs + 's')
        : null
    ]);
  }

  /* ==========================================================================
   * 9. SETUP SCREEN
   * ======================================================================== */

  function aiIsAvailable() {
    var ai = aiApi();
    if (!isFn(ai.chat)) return false;
    if (isFn(ai.isAvailable)) {
      try { return !!ai.isAvailable(); } catch (e) { return false; }
    }
    return true;
  }

  function aiUnavailableInfo() {
    var ai = aiApi();
    if (isFn(ai.unavailableReason)) {
      try {
        var r = ai.unavailableReason();
        if (r) return r;
      } catch (e) { /* noop */ }
    }
    return {
      code: 'not-configured',
      title: 'The AI simulator is not available right now',
      message: 'This mode needs the AI tutor, and it is not reachable for your account at the moment.'
    };
  }

  function SetupScreen(props) {
    var p = obj(props);
    var cats = useMemo(categoryList, []);
    var available = aiIsAvailable();
    var resolving = useAiResolving();

    var catHook = useState(cats.length ? cats[0] : 'any');
    var category = catHook[0], setCategory = catHook[1];
    var topicHook = useState('surprise');
    var topicId = topicHook[0], setTopicId = topicHook[1];
    var diffHook = useState(lsGet(LS_DIFFICULTY, 'competent'));
    var difficulty = diffHook[0], setDifficulty = diffHook[1];
    var modeHook = useState(lsGet(LS_INPUT_MODE, 'choice'));
    var inputMode = modeHook[0], setInputMode = modeHook[1];
    var voiceHook = useState(lsGet(LS_VOICE, '0') === '1');
    var voiceOn = voiceHook[0], setVoiceOn = voiceHook[1];

    var pool = useMemo(function () { return scenariosIn(category); }, [category]);
    var vsup = isFn(voiceApi().isSupported) ? voiceApi().isSupported() : { stt: false, tts: false };

    useEffect(function () { setTopicId('surprise'); }, [category]);

    /* Wake the Netlify container while the student is still picking a topic.
       A cold start is dead time bolted onto the front of the opening call -
       the single slowest, most visible call in the whole mode. Fire and
       forget: it needs no auth, spends nothing, and its failure is not the
       student's problem. Feature-detected so an older cached ai.js is fine. */
    useEffect(function () {
      var ai = aiApi();
      if (!isFn(ai.warmup)) return;
      try {
        var w = ai.warmup();
        /* Fire and forget means forget the REJECTION too. warmup() is a fetch;
           with the network down it returns a rejected promise, and try/catch
           does not see that - it surfaced as an unhandled rejection (a red
           console error, and a crash under any error-reporting shim) on the
           setup screen of a student who simply had no signal. */
        if (w && isFn(w.then)) w.then(null, function () { /* silence is correct */ });
      } catch (e) { /* never let a warmup break setup */ }
    }, []);

    function start() {
      /* prime speech synthesis inside the user gesture - iOS will not speak otherwise */
      if (voiceOn && isFn(voiceApi().prime)) { try { voiceApi().prime(); } catch (e) { /* noop */ } }
      lsSet(LS_DIFFICULTY, difficulty);
      lsSet(LS_INPUT_MODE, inputMode);
      lsSet(LS_VOICE, voiceOn ? '1' : '0');

      var seed = Math.floor(Math.random() * 1000000);
      var chosen;
      if (topicId && topicId !== 'surprise') chosen = scenarioById(topicId);
      if (!chosen) chosen = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      if (!chosen) { toast('No scenario data is loaded to ground the case.', 'error'); return; }

      if (isFn(p.onStart)) {
        p.onStart({
          scenario: chosen,
          category: category === 'any' ? str(chosen.category) : category,
          topic: (topicId && topicId !== 'surprise') ? str(chosen.title) : 'Surprise Me',
          difficultyId: difficulty,
          inputMode: inputMode,
          voiceOn: voiceOn,
          seed: seed
        });
      }
    }

    var header = ce('div', { className: 'card', key: 'hdr' }, [
      ce('h1', { className: 'ais-h1', key: 'h' }, 'Live Clinical Scenario'),
      ce('p', { className: 'ais-sub', key: 's' },
        'An unscripted patient, generated fresh every run and grounded in your course content. You receive a newly ' +
        'admitted patient, decide what to do each turn, and the patient responds to the quality of your nursing. ' +
        'Miss things and they deteriorate. Catch things and they stabilise. It ends with an SBAR handoff and a debrief.'),
      ce('div', { className: 'ais-row', key: 'tags', style: { marginTop: '10px' } }, [
        ce('span', { className: 'tag tag-blue', key: 't1' }, '10-20 minutes'),
        ce('span', { className: 'tag', key: 't2' }, 'Up to ' + TURN_CAP + ' turns'),
        ce('span', { className: 'tag', key: 't3' }, 'Scored like the scripted sims'),
        ce('span', { className: 'tag tag-orange', key: 't4' }, 'Uses your AI messages')
      ])
    ]);

    /* ------------------------------------------------------- still checking
       We do not yet know what this account includes, so we say nothing about
       it. This is shaped like the first setup card that replaces it, uses no
       error styling and offers no upgrade path, and it clears the moment the
       tier lands. */
    if (!available && resolving) {
      return ce('div', { className: 'ais-wrap' }, [
        header,
        ce('div', { className: 'card ais-col', key: 'chk' }, [
          ce('div', { className: 'ais-sr', key: 'sr', role: 'status', 'aria-live': 'polite' }, 'Checking your plan'),
          ce(CheckingLines, { key: 'l1', widths: ['38%', '86%', '70%'] }),
          ce('div', { key: 'gap', style: { height: '14px' } }),
          ce(CheckingLines, { key: 'l2', widths: ['54%', '64%'] }),
          ce('p', { className: 'mm-chk-note', key: 'n', style: { marginTop: '16px' } }, 'Checking your plan...')
        ])
      ]);
    }

    if (!available) {
      var info = aiUnavailableInfo();
      return ce('div', { className: 'ais-wrap' }, [
        header,
        ce('div', { className: 'card ais-col', key: 'un' }, [
          ce('div', { className: 'ais-note err', key: 'n' }, [
            ce('div', { key: 't', style: { color: 'var(--text)', fontWeight: 700, marginBottom: '6px' } },
              str(info.title) || 'AI is unavailable'),
            ce('div', { key: 'm' }, str(info.message))
          ]),
          ce('p', { className: 'ais-sub', key: 'alt' },
            'This mode cannot run without the AI. In the meantime the 18 scripted simulations are fully playable, ' +
            'graded the same way, and cover every one of these conditions with hand-written vitals timelines, labs, ' +
            'orders and debriefs.'),
          ce('div', { className: 'ais-row', key: 'btns' }, [
            ce('button', {
              key: 'go', type: 'button', className: 'btn btn-primary',
              onClick: function () {
                var nav = MMx().navigate;
                if (isFn(nav)) nav('simulations'); else toast('Open the Simulations page from the menu.', 'info');
              }
            }, 'Open the 18 scripted simulations'),
            isFn(p.onExit) ? ce('button', { key: 'x', type: 'button', className: 'btn btn-outline', onClick: p.onExit }, 'Back') : null
          ])
        ])
      ]);
    }

    var catItems = cats.map(function (c) {
      return { id: c, label: c };
    });
    catItems.push({ id: 'any', label: 'Surprise Me' });

    var topicCards = [{ id: 'surprise', title: 'Surprise Me', summary: 'Let the simulator pick a condition from this area.' }]
      .concat(pool.map(function (s) {
        return { id: str(s.id), title: str(s.title), summary: str(s.difficulty) + ' · ' + str(s.category) };
      }));

    return ce('div', { className: 'ais-wrap' }, [
      header,

      ce('div', { className: 'card ais-col', key: 'cat' }, [
        ce('div', { className: 'ais-lab', key: 'l' }, '1. Course area'),
        ce(Segmented, {
          key: 'seg', label: 'Course area', value: category, items: catItems,
          onChange: setCategory
        })
      ]),

      ce('div', { className: 'card ais-col', key: 'top' }, [
        ce('div', { className: 'ais-lab', key: 'l' }, '2. Condition to be grounded in'),
        ce('p', { className: 'ais-sub', key: 'p' },
          'Whatever you pick, you get a brand new patient - different name, age, background and complications - with ' +
          'the same underlying pathophysiology, the same real orders, and the same priority actions.'),
        ce('div', { className: 'ais-grid', key: 'g' }, topicCards.map(function (t) {
          return ce('button', {
            key: t.id, type: 'button', className: 'ais-pick',
            'aria-pressed': topicId === t.id ? 'true' : 'false',
            onClick: function () { setTopicId(t.id); }
          }, [
            topicId === t.id ? ce('span', { className: 'ais-chk', key: 'c' }, 'SELECTED') : null,
            ce('b', { key: 'b' }, t.title),
            ce('span', { key: 's' }, t.summary)
          ]);
        }))
      ]),

      ce('div', { className: 'card ais-col', key: 'diff' }, [
        ce('div', { className: 'ais-lab', key: 'l' }, '3. Difficulty'),
        ce('div', { className: 'ais-grid', key: 'g' }, DIFFICULTIES.map(function (d) {
          return ce('button', {
            key: d.id, type: 'button', className: 'ais-pick',
            'aria-pressed': difficulty === d.id ? 'true' : 'false',
            onClick: function () { setDifficulty(d.id); }
          }, [
            difficulty === d.id ? ce('span', { className: 'ais-chk', key: 'c' }, 'SELECTED') : null,
            ce('b', { key: 'b' }, d.label),
            ce('span', { key: 's' }, d.blurb + ' Starting stability ' + d.baseline + '/100.')
          ]);
        }))
      ]),

      ce('div', { className: 'card ais-col', key: 'input' }, [
        ce('div', { className: 'ais-lab', key: 'l' }, '4. How you will answer'),
        ce(Segmented, {
          key: 'seg', label: 'Input mode', value: inputMode,
          items: INPUT_MODES.map(function (m) {
            return { id: m.id, label: m.label, hint: m.hint, disabled: m.id === 'voice' && !vsup.stt };
          }),
          onChange: setInputMode
        }),
        ce('p', { className: 'ais-sub', key: 'h' },
          (function () {
            for (var i = 0; i < INPUT_MODES.length; i++) { if (INPUT_MODES[i].id === inputMode) return INPUT_MODES[i].hint; }
            return '';
          })() + ' You can switch at any point during the run without losing your place.'),
        !vsup.stt ? ce('div', { className: 'ais-note', key: 'nv' },
          'Voice input is not available in this browser, so that option is switched off. ' +
          (isFn(voiceApi().unsupportedReason) ? str(voiceApi().unsupportedReason()) : '')) : null,

        ce('hr', { className: 'ais-hr', key: 'hr' }),
        ce('div', { className: 'ais-row', key: 'v' }, [
          ce('button', {
            key: 'b', type: 'button',
            className: 'ais-mini' + (voiceOn ? ' on' : ''),
            'aria-pressed': voiceOn ? 'true' : 'false',
            disabled: !vsup.tts,
            onClick: function () {
              if (!voiceOn && isFn(voiceApi().prime)) { try { voiceApi().prime(); } catch (e) { /* noop */ } }
              setVoiceOn(!voiceOn);
            }
          }, voiceOn ? 'Spoken audio: ON' : 'Spoken audio: OFF'),
          ce('span', { className: 'ais-sub', key: 's', style: { flex: '1 1 160px' } },
            vsup.tts ? 'The patient and your instructor will be read aloud in different voices. Nothing plays until you turn this on.'
                     : 'Text-to-speech is not supported in this browser.')
        ])
      ]),

      ce('div', { className: 'card ais-row', key: 'go', style: { justifyContent: 'space-between' } }, [
        isFn(p.onExit) ? ce('button', { key: 'x', type: 'button', className: 'btn btn-outline', onClick: p.onExit }, 'Back')
                       : ce('span', { key: 'x' }),
        ce('button', { key: 'g', type: 'button', className: 'btn btn-primary', onClick: start },
          'Start the simulation')
      ])
    ]);
  }

  /* ==========================================================================
   * 10. RUN STATE MACHINE (pure-ish helpers - the app owns all of this)
   * ======================================================================== */

  function diffCfg(id) {
    for (var i = 0; i < DIFFICULTIES.length; i++) { if (DIFFICULTIES[i].id === id) return DIFFICULTIES[i]; }
    return DIFFICULTIES[1];
  }

  function createRun(cfg) {
    var c = obj(cfg);
    var sc = obj(c.scenario);
    var d = diffCfg(c.difficultyId);
    var keyIv = obj(keyStabilizer(sc));

    return {
      runId: rid(),
      startedAt: Date.now(),
      seed: numOr(c.seed, 1),
      category: str(c.category || sc.category),
      topic: str(c.topic),
      scenarioId: str(sc.id),
      condition: str(sc.fullTitle || sc.title),
      difficultyId: d.id,
      drift: d.drift,

      system: buildSystemPrompt({
        scenario: sc, ground: buildGroundTruth(sc), difficulty: d,
        seed: numOr(c.seed, 1), keyIv: keyIv
      }),
      messages: [],

      chart: null,
      turns: [],
      turnCount: 0,
      phase: 'arrival',
      elapsedSec: 0,

      /* Paused time is tracked SEPARATELY from scenario time. elapsedSec and
         timeSec are both wall time minus this, so a student who steps away
         mid-run is not scored as though they dithered at the bedside. */
      pausedMs: 0,
      pausedSec: 0,
      pauseCount: 0,

      stability: d.baseline,
      lastDelta: 0,
      trend: 'stable',
      vitals: {},

      keyIvAction: str(keyIv.action),
      keyIvId: str(keyIv.id),
      keyDone: false,
      keyDoneTurn: 0,
      escalated: false,
      escalatedTurn: 0,
      escalatedIndicated: false,
      criticalStreak: 0,
      pendingDecline: false,
      declineEvents: 0,
      declineHandled: 0,
      declinePartial: 0,

      matchedIvIds: [],
      ivOrderSeq: [],
      errors: [],
      harmfulActions: [],
      harmfulCount: 0,
      assessDone: 0,
      commDone: 0,
      eduDone: 0,
      freeTextTurns: 0,
      freeTextGood: 0,
      hintsUsed: 0,
      hintLog: [],
      chartTabsViewed: {},
      vitalsChecks: 0,

      forceHandoff: false,
      forceEnd: null,
      outcome: null,
      sbar: null,
      timeSec: 0,
      missedCriticalCount: 0
    };
  }

  function cloneRun(run) {
    var out = {}, k;
    for (k in run) { if (Object.prototype.hasOwnProperty.call(run, k)) out[k] = run[k]; }
    out.turns = arr(run.turns).slice();
    out.messages = arr(run.messages).slice();
    out.matchedIvIds = arr(run.matchedIvIds).slice();
    out.ivOrderSeq = arr(run.ivOrderSeq).slice();
    out.errors = arr(run.errors).slice();
    out.harmfulActions = arr(run.harmfulActions).slice();
    out.hintLog = arr(run.hintLog).slice();
    var tabs = {}, t;
    for (t in obj(run.chartTabsViewed)) {
      if (Object.prototype.hasOwnProperty.call(run.chartTabsViewed, t)) tabs[t] = true;
    }
    out.chartTabsViewed = tabs;
    return out;
  }

  function compactAssistant(turn) {
    try {
      return JSON.stringify({
        speaker: turn.speaker, narration: turn.narration, patientSpeech: turn.patientSpeech,
        vitals: turn.vitals, trend: turn.trend, newFindings: turn.newFindings,
        phase: turn.phase, rubricHits: turn.rubricHits
      });
    } catch (e) { return '{"narration":"(previous turn)"}'; }
  }

  /* ==========================================================================
   * HISTORY COMPACTION  (this is a LATENCY control, not a memory feature)
   * --------------------------------------------------------------------------
   * Every turn re-sends the entire system prompt - which contains the whole
   * APPROVED CLINICAL GROUND TRUTH block - plus the whole conversation. The
   * system prompt is fixed and load-bearing, so the only place there is any
   * fat to cut is the transcript, and by turn 12 the transcript is the larger
   * half of the request. Prompt tokens are what the student experiences as
   * "the AI is taking forever", so history is compacted hard:
   *
   *   - the last KEEP_TURNS exchanges survive verbatim (that is the working
   *     memory the model actually reasons over)
   *   - everything older collapses into ONE short synthetic user message:
   *     how many turns were dropped, which competencies were already tagged,
   *     and where the scene stood. Nothing clinically load-bearing is in there
   *     anyway - the authoritative STATE BLOCK is rebuilt from app state and
   *     re-sent on every single turn.
   *   - assistant turns were already stored through compactAssistant(), so
   *     even the verbatim tail is a fraction of the raw model output.
   *
   * The opening user message (the long "generate the patient" instruction) is
   * deliberately NOT kept: it is spent by turn 2 and costs hundreds of tokens
   * on every turn after that.
   * ======================================================================== */
  var KEEP_TURNS = 8;                  // verbatim exchanges kept in full
  var KEEP_MSGS  = KEEP_TURNS * 2;     // each exchange is one user + one assistant

  /** One short stand-in message for everything that got dropped. */
  function historySummary(dropped) {
    var d = arr(dropped);
    var exchanges = 0, lastScene = '', lastPhase = '';
    var hits = [], seen = {}, i, j, m, parsed, rh;

    for (i = 0; i < d.length; i++) {
      m = obj(d[i]);
      if (m.role !== 'assistant') continue;
      exchanges++;
      parsed = null;
      try { parsed = JSON.parse(str(m.content)); } catch (e) { parsed = null; }
      if (!parsed || typeof parsed !== 'object') continue;
      if (str(parsed.narration)) lastScene = str(parsed.narration);
      if (str(parsed.phase)) lastPhase = str(parsed.phase);
      rh = arr(parsed.rubricHits);
      for (j = 0; j < rh.length; j++) {
        var tag = str(rh[j]).trim();
        if (!tag || seen[tag]) continue;
        seen[tag] = true;
        hits.push(tag);
      }
    }

    var L = [];
    L.push('=== EARLIER IN THIS RUN (compacted) ===');
    L.push(exchanges + ' earlier turn(s) have been summarised and removed from this transcript to keep the ' +
           'request small. Treat them as having happened.');
    if (hits.length) L.push('Competencies already demonstrated: ' + hits.slice(0, 12).join(', ') + '.');
    if (lastPhase) L.push('Phase at that point: ' + lastPhase + '.');
    if (lastScene) L.push('The scene as it stood: ' + lastScene.slice(0, 400));
    L.push('The STATE BLOCK in the next message is authoritative for stability, phase and what has been done. ' +
           'Do not contradict it, and do not re-introduce the patient.');
    return L.join('\n');
  }

  function trimMessages(msgs) {
    var m = arr(msgs);
    if (m.length <= KEEP_MSGS + 1) return m.slice();
    var cut = m.length - KEEP_MSGS;
    /* keep the boundary on an exchange: the tail must start with a user turn */
    if (obj(m[cut]).role !== 'user' && cut > 0) cut = cut - 1;
    return [{ role: 'user', content: historySummary(m.slice(0, cut)) }].concat(m.slice(cut));
  }

  /** map one student action onto the grounded intervention list */
  function creditInterventions(next, sc, actionText, rubricHits) {
    var ivs = arr(obj(sc).interventions);
    var probe = str(actionText) + ' ' + arr(rubricHits).join(' ').replace(/_/g, ' ');
    var seen = {};
    arr(next.matchedIvIds).forEach(function (id) { seen[str(id)] = true; });

    for (var i = 0; i < ivs.length; i++) {
      var iv = ivs[i], id = str(iv.id);
      if (seen[id]) continue;
      if (looksLike(str(iv.action), probe, 0.4)) {
        next.matchedIvIds.push(id);
        next.ivOrderSeq.push(numOr(iv.order, i + 1));
        seen[id] = true;
      }
    }
  }

  /* Most entries on a criticalErrors list are OMISSIONS ("Failing to auscultate
     lung sounds before and after the bronchodilator"). Text-matching those
     against what the student did would flag the CORRECT action as harmful, so
     omission-phrased errors are only ever detected by the model's grade. */
  var RE_OMISSION = /^\s*(fail|delay|not\b|never\b|omit|ignor|forget|neglect|leaving|allowing|missing|under-?|insufficient|inadequate|lack)/i;

  function creditErrors(next, sc, actionText, quality) {
    var text = str(actionText).trim();
    if (!text) return;
    if (quality === 'harmful') {
      next.errors.push({ text: text });
      next.harmfulActions.push(text);
      next.harmfulCount = numOr(next.harmfulCount, 0) + 1;
      return;
    }
    var errs = arr(obj(sc).criticalErrors);
    for (var i = 0; i < errs.length; i++) {
      if (RE_OMISSION.test(str(errs[i]))) continue;
      if (looksLike(str(errs[i]), text, 0.62)) {
        next.errors.push({ text: str(errs[i]) });
        next.harmfulActions.push(text);
        next.harmfulCount = numOr(next.harmfulCount, 0) + 1;
        return;
      }
    }
  }

  /**
   * commitTurn(run, turn, action, scenario) -> new run
   * action: {text, mode} or null on the opening turn.
   * This is where the app - not the model - decides how sick the patient is.
   */
  function commitTurn(run, turn, action, scenario) {
    var next = cloneRun(run);
    var sc = obj(scenario);
    var a = obj(action);
    var actionText = str(a.text);
    var mode = str(a.mode) || 'none';
    var turnNumber = numOr(next.turnCount, 0) + 1;
    var quality = turn.lastActionQuality;
    var prevZone = zoneFor(next.stability);

    /* --- what did the action accomplish? (app-side detection) --- */
    var escalatedNow = false;
    if (actionText) {
      creditInterventions(next, sc, actionText, turn.rubricHits);
      creditErrors(next, sc, actionText, quality);

      if (!next.keyDone && next.keyIvAction &&
          (quality === 'correct' || quality === 'acceptable') &&
          (looksLike(next.keyIvAction, actionText + ' ' + arr(turn.rubricHits).join(' ').replace(/_/g, ' '), 0.4))) {
        next.keyDone = true;
        next.keyDoneTurn = turnNumber;
      }
      if (!next.escalated && quality !== 'harmful' && RE_ESCALATE.test(actionText)) {
        next.escalated = true;
        next.escalatedTurn = turnNumber;
        next.escalatedIndicated = next.stability < 45;
        escalatedNow = true;
      }
      if ((quality === 'correct' || quality === 'acceptable') && RE_ASSESS.test(actionText)) {
        next.assessDone = numOr(next.assessDone, 0) + 1;
      }
      if ((quality === 'correct' || quality === 'acceptable') && RE_COMMUNICATE.test(actionText)) {
        next.commDone = numOr(next.commDone, 0) + 1;
      }
      if (RE_EDUCATE.test(actionText)) {
        next.eduDone = numOr(next.eduDone, 0) + 1;
      }
      if (mode === 'text' || mode === 'voice') {
        next.freeTextTurns = numOr(next.freeTextTurns, 0) + 1;
        if (quality === 'correct' || quality === 'acceptable') {
          next.freeTextGood = numOr(next.freeTextGood, 0) + 1;
        }
      }
    }

    /* --- stability is computed HERE, never taken from the model --- */
    var step = stepStability(next.stability, quality, {
      drift: turnNumber === 1 ? 0 : next.drift,
      keyDone: next.keyDone,
      escalatedNow: escalatedNow,
      degraded: !!turn.degraded
    });
    next.stability = step.stability;
    next.lastDelta = step.delta;
    next.trend = trendFrom(next.stability, step.delta);

    /* --- deterioration event tracking (feeds the timeliness score) --- */
    var zone = zoneFor(next.stability);
    if (!next.pendingDecline && (zone === 'rapid' || zone === 'critical') &&
        prevZone !== 'rapid' && prevZone !== 'critical') {
      next.pendingDecline = true;
      next.declineEvents = numOr(next.declineEvents, 0) + 1;
    } else if (next.pendingDecline) {
      if (zone === 'stable' || zone === 'concerning') {
        next.pendingDecline = false;
        next.declineHandled = numOr(next.declineHandled, 0) + 1;
      } else if (escalatedNow || (step.delta > 0 && next.keyDone)) {
        next.pendingDecline = false;
        next.declinePartial = numOr(next.declinePartial, 0) + 1;
      }
    }

    next.criticalStreak = (zone === 'critical' || zone === 'arrest')
      ? numOr(next.criticalStreak, 0) + 1 : 0;

    /* --- forced endings owned by the app --- */
    if (next.stability <= 0) {
      next.forceEnd = 'death';
    } else if (zone === 'critical' && !next.escalated && next.criticalStreak >= 3) {
      next.forceEnd = 'code';
    }

    /* --- phase machine --- */
    var honorOutcome = !!turn.outcome &&
      (turnNumber >= MIN_TURNS_FOR_OUTCOME || quality === 'harmful');

    var phase;
    if (turnNumber === 1) {
      phase = 'arrival';
    } else if (next.forceEnd) {
      phase = 'complete';
    } else if (next.forceHandoff || turnNumber >= TURN_CAP || honorOutcome) {
      phase = 'handoff';
    } else if ((zone === 'rapid' || zone === 'critical') && !next.escalated) {
      phase = 'escalation';
    } else {
      phase = oneOf(turn.phase, PHASES, 'assessment');
      if (phase === 'complete') phase = 'handoff';
      if (phase === 'arrival') phase = 'assessment';
      /* the model may steer to handoff naturally, but never before turn 6 -
         that is the guard against a run that ends the moment it begins */
      if (phase === 'handoff' && turnNumber < MIN_TURNS_FOR_OUTCOME) phase = 'assessment';
    }
    next.phase = phase;
    if (turnNumber >= FORCE_HANDOFF_AT) next.forceHandoff = true;

    /* --- record --- */
    var record = {
      n: turnNumber,
      speaker: turn.speaker,
      narration: turn.narration,
      patientSpeech: turn.patientSpeech,
      vitals: turn.vitals,
      trend: next.trend,
      newFindings: turn.newFindings,
      feedback: turn.feedbackOnLastAction,
      quality: quality,
      options: turn.options,
      hint: turn.hint,
      rubricHits: turn.rubricHits,
      degraded: !!turn.degraded,
      studentAction: actionText,
      inputMode: mode,
      stabilityAfter: next.stability,
      delta: step.delta,
      at: Date.now()
    };
    next.turns.push(record);
    next.turnCount = turnNumber;
    next.vitals = turn.vitals;
    if (turn.chart && !next.chart) next.chart = turn.chart;

    return next;
  }

  /** finalizeRun(run, scenario) -> {run, result} */
  function finalizeRun(run, scenario) {
    var next = cloneRun(run);
    /* Scenario time, not wall time: every second the run spent paused is
       subtracted, and kept on the record in its own field. */
    var wall = Math.max(0, Date.now() - numOr(next.startedAt, Date.now()));
    next.pausedSec = Math.round(numOr(next.pausedMs, 0) / 1000);
    next.timeSec = Math.max(0, Math.round((wall - numOr(next.pausedMs, 0)) / 1000));

    var perf = buildPerf(next, scenario);
    var base = scoreWithEngine(scenario, perf, 'practice');
    next.missedCriticalCount = arr(base.missedCritical).length;
    next.outcome = next.forceEnd ? next.forceEnd : resolveOutcome(next);
    next.phase = 'complete';

    var result = scoreRun(next, scenario);
    try { saveRunResult(next, scenario, result); } catch (e) { /* never break the debrief */ }
    return { run: next, result: result };
  }

  /* ---------------------------------------------------------- AI call layer */

  var FRIENDLY_ERR = {
    'no-auth': 'You need to be signed in for the simulator to run.',
    'tier-denied': 'Your plan does not include the model this mode uses.',
    'quota-exceeded': 'You are out of AI messages for today. They reset at midnight Eastern.',
    'ai-disabled': 'AI features are switched off right now.',
    'network': 'Could not reach the simulator. Check your connection.',
    'server': 'The simulator hit a snag on our end.'
  };

  function errText(e) {
    var code = (e && e.code) ? e.code : 'server';
    return FRIENDLY_ERR[code] || FRIENDLY_ERR.server;
  }

  /* --------------------------------------------------------------------------
   * TURN BUDGET
   * A turn is a fixed-shape JSON object: narration (~60 words), an optional
   * line of patient speech, one or two sentences of feedback, up to six
   * findings, exactly four options of 4-14 words, a handful of snake_case
   * tags and a few scalars. Measured against that shape a normal turn is
   * ~350-450 output tokens; the opening turn adds the chart block and lands
   * around 600-700 tokens of CONTENT - but the ceiling must be set for the
   * worst case, not the average, because a turn that hits the ceiling is not
   * "slightly long", it is UNPARSEABLE (truncated JSON = unterminated string)
   * and the run dies. Three things inflate real-world output well past the
   * content size: json/response_format mode makes many providers pretty-print
   * (whitespace roughly doubles tokens), some providers spend budget on
   * reasoning preambles, and the OPENING turn additionally carries the full
   * patient chart. The 1000 ceiling shipped in v30 caused exactly this:
   * "could not produce a readable patient chart after 3 attempts", because
   * the opening turn AND both its retries truncated at the same cap.
   *
   * So: mid-run turns get 1600; the opening turn and every repair attempt get
   * 2400. Unused ceiling costs nothing - OpenRouter bills tokens actually
   * generated, and generation stops at the closing brace either way.
   * ------------------------------------------------------------------------ */
  var TURN_MAX_TOKENS    = 1600;
  var OPENING_MAX_TOKENS = 2400;

  /* Opening variety comes from the seed in the prompt, not from sampling
     temperature. 0.95 bought a little more prose colour and a much higher rate
     of non-JSON replies on the one turn that cannot survive one. */
  var OPENING_TEMP       = 0.75;
  var TURN_TEMP          = 0.7;
  var REPAIR_TEMP        = 0.2;
  var OPENING_RETRY_TEMP = 0.5;   // cooler still on an automatic opening retry
  var OPENING_MAX_RETRIES = 2;

  /**
   * askTurn(opts) -> Promise<{parsed, raw, repaired}>
   * opts: {system, messages, temperature, onToken}
   *
   * `parsed` is null only when BOTH the first reply and the repair attempt
   * failed to parse. What the caller does about that depends entirely on
   * whether this is the opening turn - see sendTurn().
   */
  function askTurn(opts) {
    var o = obj(opts);
    var ai = aiApi();
    if (!isFn(ai.chat)) return Promise.reject({ code: 'ai-disabled' });

    var system = o.system;
    var messages = arr(o.messages);
    var trimmed = trimMessages(messages);

    /* ai.chat must be treated as hostile at its boundary: if it throws
       SYNCHRONOUSLY the throw escapes the click handler, sendTurn never
       reaches its error branch, and the run sits busy forever with no error
       and no retry - a hang, not a failure. Convert it to a rejection. */
    /* The opening turn carries the whole patient chart and so needs the
       bigger ceiling; a truncated opening is what "could not produce a
       readable patient chart" looks like from the outside. */
    var budget = o.opening ? OPENING_MAX_TOKENS : TURN_MAX_TOKENS;

    var first;
    try {
      first = ai.chat({
        system: system, messages: trimmed,
        maxTokens: budget,
        temperature: numOr(o.temperature, TURN_TEMP),
        // Structured output. The server drops the parameter and retries when a
        // model does not support it, so this can only ever help.
        json: true,
        onToken: isFn(o.onToken) ? o.onToken : undefined
      });
    } catch (e) { return Promise.reject(e); }

    return Promise.resolve(first).then(function (raw) {
      var parsed = parseTurnJSON(raw);
      if (parsed) return { parsed: parsed, raw: raw, repaired: false };

      /* A reply that LOOKS like truncated JSON (has an opening brace, does
         not parse, and ends mid-structure) gets a completion attempt first:
         balance the brackets and try to parse the salvage. Costs nothing,
         and recovers the most common failure mode outright. */
      var salvaged = completeTruncatedJSON(str(raw));
      if (salvaged) return { parsed: salvaged, raw: raw, repaired: false, salvaged: true };

      /* One repair attempt at low temperature - ALWAYS at the opening-size
         ceiling, because if the first reply truncated, resending the same
         budget just truncates the repair identically (the v30 bug). */
      var repair = trimmed.concat([
        { role: 'assistant', content: str(raw).slice(0, 1200) || '(empty reply)' },
        { role: 'user', content: REPAIR_MESSAGE }
      ]);
      return ai.chat({
        system: system, messages: repair,
        maxTokens: OPENING_MAX_TOKENS, temperature: REPAIR_TEMP, json: true
      }).then(function (raw2) {
        var p2 = parseTurnJSON(raw2);
        if (!p2) p2 = completeTruncatedJSON(str(raw2));
        return { parsed: p2, raw: raw2, repaired: true };
      }, function () {
        return { parsed: null, raw: raw, repaired: true };
      });
    });
  }

  /**
   * completeTruncatedJSON(raw) - best-effort recovery of a JSON object that
   * was cut off mid-generation by a token ceiling.
   *
   * Strategy: find the outermost '{', walk it tracking string/escape state
   * and bracket depth, then append the closers the walk still owes (plus a
   * closing quote if we ended inside a string). Trailing commas are trimmed.
   * If the result parses AND kept the fields a turn cannot function without
   * (narration or options or chart), hand it to the caller; otherwise null.
   * A field that was mid-word when the cut happened stays clipped - that is
   * cosmetic, and normalizeTurn tolerates it - but no field is invented.
   */
  function completeTruncatedJSON(raw) {
    var s = str(raw);
    var start = s.indexOf('{');
    if (start === -1) return null;
    s = s.slice(start);
    // Strip a trailing markdown fence the cut may have left half-open
    s = s.replace(/```\s*$/, '');

    var inStr = false, esc = false, stack = [], i, ch;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      if (esc) { esc = false; continue; }
      if (ch === '\\') { if (inStr) esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') {
        if (stack.length && stack[stack.length - 1] === ch) stack.pop();
        else return null; // structurally broken beyond truncation - give up
      }
    }
    if (!stack.length && !inStr) return null; // it was complete; failure is elsewhere

    var fixed = s;
    if (inStr) fixed += '"';
    // Trim a dangling comma or colon the cut may have left before we close up
    fixed = fixed.replace(/[,:]\s*$/, '');
    while (stack.length) fixed += stack.pop();

    var parsed = null;
    try { parsed = JSON.parse(fixed); } catch (e) { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    // Only accept a salvage that still has enough substance to drive a turn.
    var hasCore = !!(str(parsed.narration) || arr(parsed.options).length || obj(parsed.chart).name);
    return hasCore ? parsed : null;
  }

  function buildReferenceSbar(run, sc) {
    var r = obj(run), chart = obj(r.chart), v = obj(r.vitals);
    var lastFindings = [];
    for (var i = arr(r.turns).length - 1; i >= 0 && lastFindings.length < 4; i--) {
      lastFindings = lastFindings.concat(arr(r.turns[i].newFindings));
    }
    var ref = obj(sc).sbar || {};
    return {
      situation: 'This is the nurse caring for ' + str(chart.name) + ', ' + str(chart.age) + ', admitted with ' +
                 str(chart.admittingDx) + '. ' + (str(chart.chiefComplaint) || str(ref.situation)),
      background: (arr(chart.history).length ? arr(chart.history).slice(0, 4).join('; ') + '. ' : '') +
                  'Allergies: ' + (arr(chart.allergies).join(', ') || 'none known') + '. Code status: ' +
                  str(chart.codeStatus) + '. ' + str(ref.background),
      assessment: 'Current vitals ' + (vitalsLine(v) || 'as charted') + '. ' +
                  (lastFindings.length ? 'Key findings: ' + lastFindings.slice(0, 4).join('; ') + '. ' : '') +
                  str(ref.assessment),
      recommendation: (r.keyIvAction ? 'Priority action: ' + r.keyIvAction + '. ' : '') + str(ref.recommendation)
    };
  }

  /** a scenario-shaped object for SBARRecorder / MM.ai.gradeSBAR */
  function handoffScenario(run, sc) {
    var r = obj(run), s = obj(sc), chart = obj(r.chart);
    return {
      id: str(r.runId),
      title: 'AI Live Scenario: ' + str(r.condition),
      fullTitle: 'AI Live Scenario: ' + str(r.condition),
      category: str(r.category),
      difficulty: str(r.difficultyId),
      summary: str(s.summary),
      patient: {
        name: str(chart.name), age: str(chart.age), sex: str(chart.sex),
        weightKg: str(chart.weightKg), diagnosis: str(chart.admittingDx),
        allergies: arr(chart.allergies), codeStatus: str(chart.codeStatus),
        history: arr(chart.history)
      },
      vitalsTimeline: [{
        atMin: 0, label: 'Most recent set',
        bp: obj(r.vitals).bp, hr: obj(r.vitals).hr, rr: obj(r.vitals).rr,
        temp: obj(r.vitals).temp, spo2: obj(r.vitals).spo2,
        pain: obj(r.vitals).pain, loc: obj(r.vitals).loc
      }],
      labs: arr(s.labs),
      diagnostics: arr(s.diagnostics),
      orders: arr(s.orders),
      medications: arr(s.medications),
      interventions: arr(s.interventions),
      criticalErrors: arr(s.criticalErrors),
      objectives: arr(s.objectives),
      sbar: buildReferenceSbar(r, s)
    };
  }

  /* ==========================================================================
   * 11. RUN SCREEN
   * ======================================================================== */

  function pushFreeNote(run, speaker, text, findings) {
    var next = cloneRun(run);
    next.turns.push({
      n: numOr(next.turnCount, 0),
      speaker: speaker,
      narration: text,
      patientSpeech: null,
      vitals: next.vitals,
      trend: next.trend,
      newFindings: arr(findings),
      feedback: null,
      quality: null,
      options: [],
      free: true,
      at: Date.now()
    });
    return next;
  }

  function RunScreen(props) {
    var p = obj(props);
    var cfg = obj(p.cfg);
    var scenario = obj(cfg.scenario);

    var runRef = useRef(null);
    if (!runRef.current) runRef.current = createRun(cfg);

    var runHook = useState(runRef.current);
    var run = runHook[0], setRunState = runHook[1];
    var busyHook = useState(true);
    var busy = busyHook[0], setBusy = busyHook[1];
    var charsHook = useState(0);
    var chars = charsHook[0], setChars = charsHook[1];
    var errHook = useState(null);
    var err = errHook[0], setErr = errHook[1];
    var draftHook = useState('');
    var draft = draftHook[0], setDraft = draftHook[1];
    var interimHook = useState('');
    var interim = interimHook[0], setInterim = interimHook[1];
    var modeHook = useState(str(cfg.inputMode) || 'choice');
    var inputMode = modeHook[0], setInputMode = modeHook[1];
    var voiceHook = useState(!!cfg.voiceOn);
    var voiceOn = voiceHook[0], setVoiceOn = voiceHook[1];
    var chartHook = useState(false);
    var showChart = chartHook[0], setShowChart = chartHook[1];
    var hintHook = useState({ open: false, busy: false, text: '', tier: 0 });
    var hint = hintHook[0], setHint = hintHook[1];
    var elapsedHook = useState(0);
    var elapsed = elapsedHook[0], setElapsed = elapsedHook[1];
    var sbarHook = useState('');
    var sbarText = sbarHook[0], setSbarText = sbarHook[1];
    var sbarBusyHook = useState(false);
    var sbarBusy = sbarBusyHook[0], setSbarBusy = sbarBusyHook[1];
    var pausedHook = useState(false);
    var paused = pausedHook[0], setPaused = pausedHook[1];
    var pausedSecHook = useState(0);
    var pausedSec = pausedSecHook[0], setPausedSec = pausedSecHook[1];

    /* --- per-request wait state ------------------------------------------
     * `elapsed` above is the RUN clock. This is the clock for the ONE call
     * currently in flight, and it is what the progress indicator reports.
     * It has to be its own interval: the Netlify function buffers the SSE
     * body, so token arrival tells us nothing until the very end.
     * ------------------------------------------------------------------- */
    var waitHook = useState(0);
    var waitSec = waitHook[0], setWaitSec = waitHook[1];
    var reqHook = useState(0);
    var reqId = reqHook[0], setReqId = reqHook[1];
    var attemptHook = useState(0);
    var openAttempt = attemptHook[0], setOpenAttempt = attemptHook[1];

    var aliveRef = useRef(true);
    var startedRef = useRef(false);
    var retryRef = useRef(null);
    var logRef = useRef(null);
    /* The id of the only request whose result may be applied. Starting a new
       turn - including an automatic opening retry, and including the Retry
       button pressed while a call is still in flight - bumps it, so the older
       reply is dropped on arrival instead of racing the newer one into run
       state. This is the "abort" the UI offers: nothing half-applied, no
       double-committed turn, no lost run. */
    var reqRef = useRef(0);
    /* Synchronous mirror of `busy`. React state is only as current as the last
       render, and two taps inside one frame both read the stale value. */
    var inFlightRef = useRef(false);
    /* A run may only be scored and persisted ONCE. The handoff screen offers
       three ways out - the SBAR recorder, the typed report, and "skip" - and
       the typed report is graded asynchronously while the skip button is still
       on screen. Submitting a report and then skipping used to finish the run
       twice: two debriefs, two aiScenarioResults rows, two simResults rows on
       the dashboard for one patient. */
    var finishedRef = useRef(false);

    /* --- pause -----------------------------------------------------------
     * `paused` is render state; pausedRef is the synchronous mirror, for the
     * same reason inFlightRef exists - a promise settling, a keypress and a
     * click can all be handled inside one frame, and every one of them has to
     * see the CURRENT answer, not the last rendered one.
     *
     * heldRef is the in-flight turn's landing pad. A reply that arrives while
     * the sim is paused is neither dropped nor applied: the whole apply step
     * is closed over and parked here until resume, so a paused sim can never
     * mutate patient state.
     *
     * speakQ is the TTS queue - see speakTurn().
     * ------------------------------------------------------------------- */
    var pausedRef = useRef(false);
    var heldRef = useRef(null);
    var speakQRef = useRef(null);
    var clockRef = useRef(null);
    if (!clockRef.current) clockRef.current = createPauseClock(runRef.current.startedAt);

    var vsup = isFn(voiceApi().isSupported) ? voiceApi().isSupported() : { stt: false, tts: false };

    function commit(next) {
      runRef.current = next;
      if (aliveRef.current) setRunState(next);
      return next;
    }

    function clearDraft() { setDraft(''); setInterim(''); }

    /* the single place `busy` is turned off, so the ref can never drift */
    function idle() { inFlightRef.current = false; setBusy(false); }

    useEffect(function () {
      aliveRef.current = true;
      return function () {
        aliveRef.current = false;
        /* Drop the speech queue and any turn parked by a pause. Both are
           closures over this component; letting either survive the unmount is
           how a stale world reaches into the next one. */
        speakQRef.current = null;
        heldRef.current = null;
        pausedRef.current = false;
        if (isFn(voiceApi().stopSpeaking)) { try { voiceApi().stopSpeaking(); } catch (e) { /* noop */ } }
      };
    }, []);

    /* elapsed clock - SCENARIO time, which is wall time minus paused time.
       The interval keeps its own rhythm and simply stops reporting while
       paused; because the value it reports is computed by the pause clock and
       not accumulated, resume continues from the frozen number rather than
       jumping forward by the length of the pause. */
    useEffect(function () {
      var id = setInterval(function () {
        if (!aliveRef.current) return;
        /* Paused: scenario time does not move, but the paused counter does -
           the student should be able to see what they are not being charged
           for. Nothing here touches the run. */
        if (pausedRef.current) { setPausedSec(clockRef.current.pausedSec()); return; }
        var s = clockRef.current.elapsedSec();
        runRef.current.elapsedSec = s;
        setElapsed(s);
      }, 1000);
      return function () { clearInterval(id); };
    }, []);

    /* per-request wait clock - runs on its own interval, never on token arrival.
       Also measured in unpaused time, so a paused student does not come back to
       a request that appears to have taken four minutes. */
    useEffect(function () {
      if (!busy) {
        setWaitSec(0);
        return undefined;
      }
      var t0 = Date.now();
      var banked = clockRef.current.bankedMs();
      setWaitSec(0);
      var id = setInterval(function () {
        if (!aliveRef.current || pausedRef.current) return;
        setWaitSec(clockRef.current.sinceSec(t0, banked));
      }, 1000);
      return function () { clearInterval(id); };
    }, [busy, reqId]);

    /* keep the transcript pinned to the newest turn */
    useEffect(function () {
      if (logRef.current) {
        try { logRef.current.scrollTop = logRef.current.scrollHeight; } catch (e) { /* noop */ }
      }
    }, [run.turns.length, busy]);

    /* ------------------------------------------------------------- speech
     * MM.voice publishes speak(), stopSpeaking() and isSpeaking() - and that
     * is the whole surface. Neither engine behind it (browser speechSynthesis
     * or the ElevenLabs <audio> element) exposes a pause through this API, and
     * voice.js is not ours to change. So pausing STOPS the clip outright, and
     * the queue below remembers which line was cut off: resume re-speaks THAT
     * one line from its start and then continues with the rest of the turn.
     * One line repeats; the turn is never replayed from the top.
     *
     * The queue is also what makes "stop talking" reliable - the old promise
     * chain kept firing the next job after a stopSpeaking(), because a
     * cancelled clip resolves exactly like a finished one.
     * ------------------------------------------------------------------- */
    function runSpeakQueue() {
      var q = speakQRef.current;
      if (!q || pausedRef.current || !aliveRef.current) return;
      if (q.i >= q.jobs.length) { speakQRef.current = null; return; }
      var speak = voiceApi().speak;
      if (!isFn(speak)) { speakQRef.current = null; return; }

      var job = q.jobs[q.i];
      var pr;
      try { pr = speak(job.text, job.opts); } catch (e) { pr = null; }

      function step() {
        if (!aliveRef.current) return;
        if (speakQRef.current !== q) return;   /* a newer turn took the floor */
        if (pausedRef.current) return;         /* cut off mid-clip: q.i stays put */
        q.i = q.i + 1;
        runSpeakQueue();
      }
      Promise.resolve(pr).then(step, step);
    }

    function speakJobs(jobs) {
      if (!voiceOn || !vsup.tts || !isFn(voiceApi().speak)) { speakQRef.current = null; return; }
      if (!arr(jobs).length) { speakQRef.current = null; return; }
      speakQRef.current = { jobs: arr(jobs).slice(), i: 0 };
      runSpeakQueue();
    }

    function stopSpeech(forget) {
      var v = voiceApi();
      if (isFn(v.stopSpeaking)) { try { v.stopSpeaking(); } catch (e) { /* noop */ } }
      if (forget) speakQRef.current = null;
    }

    function speakTurn(turn) {
      var who = SPEAKERS[turn.speaker];
      var jobs = [];
      if (turn.patientSpeech) {
        jobs.push({
          text: turn.patientSpeech,
          opts: { voice: who ? who.voice : 'patient', rate: 0.95, pitch: 1.02, force: true }
        });
      } else if (turn.speaker !== 'instructor' && turn.narration) {
        jobs.push({
          text: turn.narration,
          opts: { voice: who ? who.voice : 'nurse', rate: 1, pitch: 1, force: true }
        });
      }
      if (turn.feedbackOnLastAction) {
        jobs.push({
          text: turn.feedbackOnLastAction,
          opts: { voice: 'instructor', rate: 0.92, pitch: 0.96, force: true }
        });
      }
      speakJobs(jobs);
    }

    /* --------------------------------------------------------------- pause */

    /* A finished run has nothing left to freeze, and pausing the debrief would
       only be a way to get stuck. */
    function canPause() {
      return !!aliveRef.current && !finishedRef.current && runRef.current.phase !== 'complete';
    }

    function pauseStatsNow() {
      var c = clockRef.current;
      return {
        active: canPause(), paused: !!pausedRef.current, mode: 'ai-live',
        pauseCount: numOr(runRef.current.pauseCount, 0),
        pausedMs: c.pausedMs(),
        pausedSec: c.pausedSec(),
        simSec: c.elapsedSec(),
        /* unique to this mode: a settled AI turn is parked and waiting */
        holding: !!heldRef.current
      };
    }

    function doPause(reason) {
      if (pausedRef.current) return true;
      if (!canPause()) return false;

      /* the ref goes first: everything else - the speak() promise that is
         about to settle, an AI reply landing in the same tick - must see the
         paused state, not the state React last rendered */
      pausedRef.current = true;
      clockRef.current.pause();
      runRef.current.pauseCount = numOr(runRef.current.pauseCount, 0) + 1;

      stopSpeech(false);                         /* keep the queue's place */
      var v = voiceApi();
      if (isFn(v.stopListening)) { try { v.stopListening(); } catch (e) { /* noop */ } }

      setPaused(true);
      setPausedSec(clockRef.current.pausedSec());
      announce((str(reason) ? str(reason) + ' ' : '') +
        'Simulation paused. The clock, the patient and your controls are frozen.', false);
      aiPause._changed();
      return true;
    }

    function doResume() {
      if (!pausedRef.current) return false;
      pausedRef.current = false;
      clockRef.current.resume();

      var pms = clockRef.current.pausedMs();
      runRef.current.pausedMs = pms;
      runRef.current.pausedSec = Math.floor(pms / 1000);
      runRef.current.elapsedSec = clockRef.current.elapsedSec();
      setPaused(false);
      setPausedSec(clockRef.current.pausedSec());
      setElapsed(clockRef.current.elapsedSec());
      announce('Simulation resumed. The clock picks up exactly where it stopped - ' +
        'no time was skipped forward.', false);
      aiPause._changed();

      /* A turn that settled during the pause lands NOW - in the same order,
         with the same freshness check, as if the student had never paused. */
      var held = heldRef.current;
      heldRef.current = null;
      if (held) {
        try { held(); } catch (e) { /* an apply that throws must not strand the run */ }
      } else {
        runSpeakQueue();
      }
      return true;
    }

    function togglePause() {
      if (pausedRef.current) { doResume(); return false; }
      return doPause();
    }

    /**
     * holdOrRun(fn) - the one rule for every async result that mutates the run.
     * Running: apply it now. Paused: park it, in arrival order, and apply it
     * on resume. Nothing is ever dropped, and nothing lands mid-pause.
     */
    function holdOrRun(fn) {
      if (!isFn(fn)) return;
      if (!pausedRef.current) { fn(); return; }
      var prev = heldRef.current;
      heldRef.current = !isFn(prev) ? fn : function () {
        try { prev(); } catch (e) { /* one bad apply must not eat the next */ }
        fn();
      };
    }

    /* The controller the outside world drives. Rebuilt every render so the
       closures are current; the effect below registers a stable façade over
       it exactly once, and takes it down on unmount. */
    var ctlRef = useRef(null);
    ctlRef.current = {
      pause: doPause,
      resume: function () { doResume(); return !!pausedRef.current; },
      toggle: togglePause,
      isPaused: function () { return !!pausedRef.current; },
      canPause: canPause,
      stats: pauseStatsNow
    };

    useEffect(function () {
      /* The hub calls through the ref, so it always sees the current closures
         rather than the ones from the render that happened to mount. */
      var detach = aiPause._attach({
        pause: function (r) { return ctlRef.current.pause(r); },
        resume: function () { return ctlRef.current.resume(); },
        toggle: function () { return ctlRef.current.toggle(); },
        isPaused: function () { return ctlRef.current.isPaused(); },
        canPause: function () { return ctlRef.current.canPause(); },
        stats: function () { return ctlRef.current.stats(); }
      });

      /* Space or P toggles - but NEVER out from under a student who is typing
         into the chat box, the SBAR box or anything else with a caret in it. */
      function onKey(e) {
        if (!e || e.defaultPrevented) return;
        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        var k = str(e.key);
        var isSpace = (k === ' ' || k === 'Spacebar' || e.keyCode === 32);
        var isP = (k === 'p' || k === 'P');
        if (!isSpace && !isP) return;
        if (isTypingTarget(e.target)) return;
        var c = ctlRef.current;
        if (!c || (!c.isPaused() && !c.canPause())) return;
        /* Space would otherwise scroll the page and re-fire whatever button
           still has focus - which is the option the student just took. */
        if (isFn(e.preventDefault)) e.preventDefault();
        c.toggle();
      }

      var doc = (typeof document !== 'undefined') ? document : null;
      if (doc && isFn(doc.addEventListener)) doc.addEventListener('keydown', onKey, false);

      return function () {
        if (isFn(detach)) detach();
        if (doc && isFn(doc.removeEventListener)) doc.removeEventListener('keydown', onKey, false);
      };
    }, []);

    /* --------------------------------------------------------- AI plumbing */

    /**
     * sendTurn(userContent, action, temperature [, attempt])
     *
     * THE OPENING TURN IS NOT LIKE THE OTHERS.
     * The chart arrives once and only once - normalizeTurn() reads `turn.chart`
     * on turn 1 and commitTurn() keeps the first one it sees. So a degraded
     * opening is not a small stumble the student can act through, the way a
     * degraded turn 7 is: it produces a run with no patient, no chart, no real
     * options, and a header stuck on "Admitting patient..." forever. That is
     * exactly the reported bug, and high sampling temperature on the opening
     * call is why it was intermittent.
     *
     * Therefore the opening NEVER degrades. If the reply and the repair both
     * fail to parse - OR the reply parses perfectly but contains no usable
     * "chart" block, which produces exactly the same broken run and used to
     * sail straight through this gate - the whole opening call is retried from
     * scratch at a cooler temperature (up to OPENING_MAX_RETRIES times), and if
     * it still cannot be read the student gets a plain error with a working
     * Retry button. A chartless run is not one of the outcomes.
     *
     * Mid-run, degradedTurn() stays exactly as it was - it costs the student
     * nothing (stepStability zeroes the drift on a degraded turn) and the run
     * continues.
     */
    function sendTurn(userContent, action, temperature, attempt) {
      if (!aliveRef.current) return;
      var current = runRef.current;
      var isOpening = numOr(current.turnCount, 0) === 0 && !action;
      var tryN = Math.max(0, Math.floor(numOr(attempt, 0)));
      var msgs = arr(current.messages).concat([{ role: 'user', content: userContent }]);

      reqRef.current = reqRef.current + 1;
      var myReq = reqRef.current;
      function fresh() { return aliveRef.current && myReq === reqRef.current; }

      setReqId(myReq);
      inFlightRef.current = true;
      setBusy(true); setChars(0); setErr(null);
      setOpenAttempt(isOpening ? tryN : 0);

      /* Retry always starts over from attempt 0 at the original temperature. */
      retryRef.current = function () { sendTurn(userContent, action, temperature, 0); };

      askTurn({
        system: current.system,
        messages: msgs,
        temperature: temperature,
        opening: isOpening,
        onToken: function (chunk, full) {
          if (!fresh()) return;
          setChars(str(full).length);
        }
      }).then(function (res) {
        if (!fresh()) return;
        /* PAUSED: the request already cost the student an AI message, so it is
           not thrown away - but a paused sim may not mutate patient state, so
           the entire apply step is parked and replayed on resume. */
        holdOrRun(function () { applyTurn(res); });
      }, function (e) {
        if (!fresh()) return;
        holdOrRun(function () { applyError(e); });
      });

      function applyError(e) {
        if (!fresh()) return;
        idle();
        setErr({
          code: (e && e.code) ? e.code : 'server',
          opening: isOpening,
          message: errText(e)
        });
      }

      function applyTurn(res) {
        /* Re-checked here and not only at settle time: a held turn applies
           later than it arrived, and anything that bumped the request id in
           between still wins. */
        if (!fresh()) return;

        /* An opening that parsed but carries no patient is just as unplayable
           as one that did not parse at all - same retry, same error. */
        var openingBad = isOpening &&
          (!res.parsed || !chartUsable(obj(res.parsed).chart));

        if (openingBad) {
          if (tryN < OPENING_MAX_RETRIES) {
            /* fresh opening call, cooler - never a degraded turn 1 */
            sendTurn(userContent, action, OPENING_RETRY_TEMP, tryN + 1);
            return;
          }
          idle();
          setErr({
            code: 'opening-unparseable',
            opening: true,
            message: 'The model could not produce a readable patient chart after ' +
                     (OPENING_MAX_RETRIES + 1) + ' attempts.'
          });
          return;
        }

        var ctx = {
          prevVitals: runRef.current.vitals,
          seed: runRef.current.seed,
          turnNumber: runRef.current.turnCount + 1,
          phase: runRef.current.phase,
          trend: runRef.current.trend
        };
        var turn = res.parsed ? normalizeTurn(res.parsed, ctx) : degradedTurn(ctx);

        var next = commitTurn(runRef.current, turn, action, scenario);
        next.messages = arr(current.messages).concat([
          { role: 'user', content: userContent },
          { role: 'assistant', content: compactAssistant(turn) }
        ]);
        commit(next);
        idle();
        clearDraft();
        /* Reset the hint panel without reading a render-scoped `hint`, which
           can be a render behind and would silently walk the tier backwards
           while a hint request is still in flight. */
        setHint(function (h) {
          var cur = obj(h);
          return { open: !!cur.busy, busy: !!cur.busy, text: '', tier: numOr(cur.tier, 0) };
        });
        speakTurn(turn);

        if (next.phase === 'complete') finish(next);
      }
    }

    /* opening turn */
    useEffect(function () {
      if (startedRef.current) return;
      startedRef.current = true;
      sendTurn(openingUserMessage({ seed: runRef.current.seed, stability: runRef.current.stability }),
        null, OPENING_TEMP);
    }, []);

    /* ------------------------------------------------------------ actions */

    function takeAction(text, mode) {
      var body = str(text).trim();
      /* `busy` is render state and a second tap can be handled before React has
         re-rendered the disabled buttons, so the authoritative check is the
         ref. Without it a double-tap on a phone sent two turns for one action:
         two AI messages spent, two commits, and a transcript that skipped a
         beat. The paused check is the same argument: `disabled` on a button is
         cosmetic, THIS is the lockout. */
      if (!body || busy || inFlightRef.current || pausedRef.current) return;

      /* free data checks never cost a turn and never cost points */
      if (mode !== 'choice' && RE_FREE_VITALS.test(body)) { clearDraft(); showVitals(); return; }
      if (mode !== 'choice' && RE_FREE_CHART.test(body)) {
        clearDraft(); setShowChart(true); creditChart('chart'); return;
      }

      var current = runRef.current;
      sendTurn(stateBlock(current, body, mode), { text: body, mode: mode }, TURN_TEMP);
    }

    /* Reading the chart is free but it IS graded (chartTabsViewed feeds the
       assessment score), so it is an action like any other while paused. */
    function creditChart(tab) {
      if (pausedRef.current) return;
      var next = cloneRun(runRef.current);
      next.chartTabsViewed[tab] = true;
      commit(next);
    }

    function showVitals() {
      if (pausedRef.current) return;
      var v = runRef.current.vitals;
      var next = pushFreeNote(runRef.current, 'monitor',
        'You glance at the monitor and the flowsheet. Current set: ' + (vitalsLine(v) || 'no numbers charted yet') + '.',
        []);
      next.vitalsChecks = numOr(next.vitalsChecks, 0) + 1;
      next.chartTabsViewed.vitals = true;
      commit(next);
    }

    function openChart() {
      if (pausedRef.current) return;
      setShowChart(!showChart);
      if (!showChart) creditChart('chart');
    }

    function requestHint() {
      if (hint.busy || busy || pausedRef.current) return;
      var tier = Math.min(3, numOr(hint.tier, 0) + 1);
      setHint({ open: true, busy: true, text: '', tier: tier });

      var current = runRef.current;
      var last = current.turns.length ? current.turns[current.turns.length - 1] : null;
      var tierAsk = tier === 1
        ? 'Give a NUDGE only: one question that points them at the right body system or framework. Do not name the action.'
        : (tier === 2
          ? 'NARROW THE FIELD: name the two things worth doing right now and ask which comes first and why. Do not give the answer outright.'
          : 'TELL THEM: state exactly what to assess or do next and the one-sentence rationale, then hand control back.');

      var sys = current.system + '\n\nYou are now answering a HINT REQUEST, not producing a turn. ' +
        'Reply with 1-3 plain sentences of coaching. No JSON, no markdown, no options.';
      var msg = [
        stateBlock(current, '(the student has asked for help)', 'hint'),
        '',
        'CURRENT SCENE: ' + (last ? str(last.narration) : '(the run has just begun)'),
        '',
        'HINT TIER ' + tier + ' of 3. ' + tierAsk
      ].join('\n');

      var ai = aiApi();
      var pr;
      /* a synchronous throw here would leave the hint panel spinning and the
         hint button disabled for the rest of the run */
      try {
        pr = isFn(ai.chat)
          ? ai.chat({ system: sys, messages: [{ role: 'user', content: msg }], maxTokens: 260, temperature: 0.5 })
          : Promise.reject({ code: 'ai-disabled' });
      } catch (e) { pr = Promise.reject(e); }

      /* A hint costs points, so it is patient-state too: held while paused. */
      Promise.resolve(pr).then(function (text) {
        if (!aliveRef.current) return;
        var body = str(text).trim() || (last && last.hint ? str(last.hint) : 'Go back to your ABCs and reassess.');
        holdOrRun(function () { applyHint(tier, body); });
      }, function () {
        if (!aliveRef.current) return;
        var body = (last && last.hint) ? str(last.hint)
          : 'Go back to your ABCs. What is the single finding here that could kill this patient soonest?';
        holdOrRun(function () { applyHint(tier, body); });
      });
    }

    function applyHint(tier, body) {
      var next = pushFreeNote(runRef.current, 'instructor', 'HINT (tier ' + tier + ', -' + HINT_COST + ' points): ' + body, []);
      next.hintsUsed = numOr(next.hintsUsed, 0) + 1;
      next.hintLog.push({ turn: next.turnCount, tier: tier, text: body });
      commit(next);
      setHint({ open: false, busy: false, text: body, tier: tier });
      /* through the queue, so a pause stops it and a resume picks it up */
      speakJobs([{ text: body, opts: { voice: 'instructor', rate: 0.92, pitch: 0.96, force: true } }]);
    }

    function toggleVoice() {
      if (pausedRef.current) return;
      var on = !voiceOn;
      if (on && isFn(voiceApi().prime)) { try { voiceApi().prime(); } catch (e) { /* noop */ } }
      if (!on) stopSpeech(true);
      setVoiceOn(on);
      lsSet(LS_VOICE, on ? '1' : '0');
    }

    function changeMode(id) {
      if (pausedRef.current) return;
      setInputMode(id);
      lsSet(LS_INPUT_MODE, id);
    }

    /* ------------------------------------------------------------- handoff */

    /**
     * finish(run, sbarResult) - the ONLY way a run is scored and persisted.
     *
     * Four callers can reach an ending: the forced ending inside sendTurn, the
     * SBAR recorder, the typed report's async grader, and the "skip the
     * handoff" button. The last two can both be live at the same moment - the
     * skip button stays on screen while the grader works - so this is
     * idempotent. finalizeRun() writes to progress, and a second write is two
     * rows on the dashboard for one patient.
     */
    function finish(runToScore, sbarResult) {
      if (finishedRef.current) return null;
      finishedRef.current = true;
      var next = cloneRun(runToScore || runRef.current);
      if (sbarResult !== undefined) next.sbar = sbarResult || null;
      commit(next);
      var done = finalizeRun(next, scenario);
      commit(done.run);
      if (isFn(p.onFinish)) p.onFinish(done);
      return done;
    }

    function finishWithSbar(sbarResult) {
      if (pausedRef.current) return null;
      return finish(null, sbarResult || null);
    }

    function submitTypedSbar() {
      var body = str(sbarText).trim();
      if (!body || sbarBusy || finishedRef.current || pausedRef.current) return;
      setSbarBusy(true);
      var hs = handoffScenario(runRef.current, scenario);
      var ai = aiApi();
      var pr;
      /* a synchronous throw here would strand the run on a "Grading..." button
         that can never be pressed again */
      try {
        pr = isFn(ai.gradeSBAR) ? ai.gradeSBAR(hs, body) : Promise.reject(new Error('no grader'));
      } catch (e) { pr = Promise.reject(e); }
      /* A grade that lands during a pause is held exactly like a turn: the
         report is not regraded and not lost, it simply finishes on resume. */
      Promise.resolve(pr).then(function (res) {
        if (!aliveRef.current) return;
        var r = obj(res);
        holdOrRun(function () {
          finish(null, {
            transcript: body, score: numOr(r.score, 0), maxScore: numOr(r.maxScore, 20),
            pct: numOr(r.pct, Math.round((numOr(r.score, 0) / 20) * 100)),
            breakdown: obj(r.breakdown), missing: arr(r.missing), feedback: str(r.feedback)
          });
        });
      }, function () {
        if (!aliveRef.current) return;
        /* no grader: give partial credit for a substantive report rather than zero */
        var words = body.split(/\s+/).length;
        var pct = clamp(Math.round((words / 90) * 100), 10, 70);
        holdOrRun(function () {
          finish(null, {
            transcript: body, score: Math.round((pct / 100) * 20), maxScore: 20, pct: pct,
            breakdown: {}, missing: [],
            feedback: 'The AI grader was unavailable, so this report was credited on length and structure only. ' +
                      'Compare it against the reference SBAR in the debrief.'
          });
        });
      });
    }

    /* --------------------------------------------------------------- views */

    var chart = obj(run.chart);
    var latest = run.turns.length ? run.turns[run.turns.length - 1] : null;
    var lastGraded = null;
    for (var li = run.turns.length - 1; li >= 0; li--) {
      if (!run.turns[li].free) { lastGraded = run.turns[li]; break; }
    }
    var prevVitals = (function () {
      var seen = 0;
      for (var i = run.turns.length - 1; i >= 0; i--) {
        if (run.turns[i].free) continue;
        seen++;
        if (seen === 2) return run.turns[i].vitals;
      }
      return {};
    })();

    /* Information hierarchy: how bad is it (stability) -> what are the numbers
       (vitals) -> what can I do about it (escalation) -> how long have I got
       (clock) -> what must never change (allergy / code status) -> who is this
       (identity, collapsed into the chart drawer). The condition is NOT on
       this screen: naming the diagnosis every turn gives away the exercise. */
    var stabZone = zoneFor(numOr(run.stability, 0));
    var zoneMeta = ZONE_META[stabZone] || ZONE_META.stable;
    var showEscalate = zoneMeta.rank >= 2 && !run.escalated && run.phase !== 'handoff';
    /* One word for "the student may not act right now", used by every control
       on the screen. `busy` dims; `paused` freezes. */
    var locked = busy || paused;

    var pauseBtn = ce('button', {
      key: 'pause', type: 'button',
      className: 'ais-pause' + (paused ? ' on' : ''),
      'aria-pressed': paused ? 'true' : 'false',
      disabled: !paused && !canPause(),
      title: 'Space or P',
      onClick: togglePause
    }, paused ? '▶ Resume (Space)' : '❚❚ Pause (Space)');

    var strip = ce('div', { className: 'ais-strip z-' + stabZone, key: 'strip' }, [
      paused
        ? ce('div', { className: 'ais-pausebar', key: 'pb', role: 'status', 'aria-live': 'polite' }, [
            ce('b', { key: 'b' }, 'PAUSED'),
            ce('span', { key: 's' },
              'The clock, the patient and every control are frozen. Paused for ' + fmtClock(pausedSec) +
              ' so far - paused time is tracked separately and is not scored against you.' +
              (busy ? ' A reply is on its way and is being held until you resume.' : '')),
            pauseBtn
          ])
        : null,
      ce('div', { className: 'ais-strip-row', key: 'r1' }, [
        ce(StabilityMeter, {
          key: 's', stability: run.stability, trend: run.trend, delta: run.lastDelta
        }),
        ce('div', { className: 'ais-clock', key: 'c' }, [
          ce('b', { key: 'a' }, fmtClock(elapsed)),
          ce('span', { key: 'b' }, 'Turn ' + Math.max(1, run.turnCount) + ' of ' + TURN_CAP),
          pausedSec ? ce('span', { key: 'p' }, 'Paused ' + fmtClock(pausedSec)) : null,
          paused ? null : pauseBtn
        ])
      ]),
      showEscalate
        ? ce('button', {
            key: 'esc', type: 'button', className: 'ais-escalate', disabled: locked,
            onClick: function () { takeAction('Activate the rapid response team', 'choice'); }
          }, 'Call the rapid response team')
        : null,
      ce(VitalsGrid, {
        key: 'v', vitals: run.vitals, prevVitals: prevVitals, flash: true,
        turns: run.turns, turn: run.turnCount
      }),
      ce('div', { className: 'ais-mon-text', key: 'lo' }, [
        ce('span', { key: 'a' }, [ce('b', { key: 'b' }, 'LOC '), str(run.vitals.loc) || '--']),
        ce('span', { key: 'c' }, [ce('b', { key: 'd' }, 'Pain '), str(run.vitals.pain) || '--']),
        chart.chiefComplaint
          ? ce('span', { key: 'e' }, [ce('b', { key: 'f' }, 'C/O '), str(chart.chiefComplaint)])
          : null
      ]),
      (arr(chart.allergies).length || chart.codeStatus)
        ? ce('div', { className: 'ais-allergy', key: 'al' },
            (arr(chart.allergies).length
              ? 'ALLERGY · ' + arr(chart.allergies).join(', ')
              : 'NO KNOWN ALLERGIES') +
            ' · ' + (str(chart.codeStatus) || 'Code status not set'))
        : null,
      ce('button', {
        className: 'ais-mini', key: 'id', type: 'button', onClick: openChart, disabled: paused,
        'aria-expanded': showChart ? 'true' : 'false'
      }, [str(chart.name) ||
            /* No chart and no call in flight means the opening failed. Saying
               "Admitting patient..." forever is the lie the student reported
               as a hang; when it has actually stopped, say so. */
            (err && run.turnCount === 0 ? 'No chart yet' : 'Admitting patient...'),
          str(chart.age) ? ' · ' + str(chart.age) : '',
          showChart ? ' · hide chart' : ' · open chart'].join(''))
    ]);

    var transcript = ce('div', { className: 'ais-log', key: 'log', ref: logRef },
      run.turns.map(function (t, i) {
        var meta = SPEAKERS[t.speaker] || SPEAKERS.instructor;
        var q = t.quality ? QUALITY_META[t.quality] : null;
        return ce('div', { className: 'ais-turn sp-' + str(t.speaker), key: 'turn-' + i }, [
          ce('div', { className: 'ais-turn-head', key: 'h' }, [
            ce('b', { key: 'w' }, meta.label),
            t.free ? ce('span', { key: 'f' }, 'free action') : ce('span', { key: 'n' }, 'Turn ' + t.n),
            t.degraded ? ce('span', { className: 'tag tag-orange', key: 'd' }, 'recovered') : null
          ]),
          t.studentAction
            ? ce('p', { className: 'ais-you', key: 'you' }, [
                ce('b', { key: 'b' }, 'You: '), str(t.studentAction),
                q ? ce('span', { className: 'tag ' + q.tag, key: 'q', style: { marginLeft: '8px' } }, q.label) : null
              ])
            : null,
          t.narration ? ce('p', { className: 'ais-narr', key: 'n' }, str(t.narration)) : null,
          t.patientSpeech ? ce('p', { className: 'ais-speech', key: 'sp' }, '"' + str(t.patientSpeech) + '"') : null,
          arr(t.newFindings).length
            ? ce('ul', { className: 'ais-find', key: 'f' }, arr(t.newFindings).map(function (f, j) {
                return ce('li', { key: j }, str(f));
              }))
            : null,
          t.feedback ? ce('p', { className: 'ais-fb', key: 'fb' }, str(t.feedback)) : null
        ]);
      })
    );

    var openingFailed = !!(err && err.opening) && run.turnCount === 0;

    var errorBox = err ? ce('div', { className: 'ais-note err', key: 'err', role: 'alert' }, [
      ce('div', { key: 'm', style: { marginBottom: '8px' } },
        openingFailed
          ? str(err.message) + ' Nothing has started yet, so nothing has been lost - ' +
            'admit the patient again and you will get a different one.'
          : str(err.message) + ' Your run is intact - nothing has been lost.'),
      ce('div', { className: 'ais-row', key: 'b' }, [
        ce('button', {
          key: 'r', type: 'button', className: 'btn btn-primary btn-sm', disabled: paused,
          onClick: function () { if (paused) return; if (isFn(retryRef.current)) retryRef.current(); }
        }, openingFailed ? 'Try admitting the patient again' : 'Retry this turn'),
        (openingFailed || err.code === 'quota-exceeded' || err.code === 'tier-denied' || err.code === 'no-auth')
          ? ce('button', {
              key: 'e', type: 'button', className: 'btn btn-outline btn-sm',
              onClick: function () { if (isFn(p.onExit)) p.onExit(); }
            }, 'Leave the run')
          : null
      ])
    ]) : null;

    /* ---- action area ---- */
    var options = lastGraded ? arr(lastGraded.options) : [];

    var choiceUI = ce('div', { className: 'ais-col', key: 'choice' },
      options.length
        ? options.map(function (o) {
            return ce('button', {
              key: o.id, type: 'button', className: 'ais-opt', disabled: locked,
              onClick: function () { takeAction(o.text, 'choice'); }
            }, [
              ce('span', { className: 'ltr', key: 'l' }, o.id),
              ce('span', { key: 't' }, o.text)
            ]);
          })
        : [ce('div', { className: 'ais-note', key: 'none' },
            'No options are on the table right now. Switch to free text and say what you would do.')]
    );

    var textUI = ce('div', { className: 'ais-col', key: 'text' }, [
      ce('textarea', {
        key: 'ta', className: 'ais-ta', value: draft, disabled: locked,
        placeholder: 'What do you do next? Say it the way you would to your preceptor - "auscultate all lung fields and check work of breathing".',
        'aria-label': 'Your next nursing action',
        onChange: function (e) { setDraft(e.target.value); },
        onKeyDown: function (e) {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { takeAction(draft, 'text'); }
        }
      }),
      ce('div', { className: 'ais-row', key: 'b' }, [
        ce('button', {
          key: 'go', type: 'button', className: 'btn btn-primary btn-sm',
          disabled: locked || !str(draft).trim(),
          onClick: function () { takeAction(draft, 'text'); }
        }, 'Take this action'),
        ce('span', { className: 'ais-lab', key: 'h' }, 'Ctrl+Enter also submits')
      ])
    ]);

    var VB = window.VoiceButton;
    var voiceUI = ce('div', { className: 'ais-col', key: 'voice' }, [
      (vsup.stt && isFn(VB))
        ? ce(VB, {
            key: 'vb', size: 'lg', continuous: false, disabled: locked,
            label: paused ? 'Paused' : (busy ? 'Working...' : 'Hold the mic and say your action'),
            onInterim: function (text) { setInterim(str(text)); },
            onTranscript: function (text) {
              var t = str(text).trim();
              setInterim('');
              if (!t) return;
              var fixed = isFn(voiceApi().correctMedicalTerms) ? str(voiceApi().correctMedicalTerms(t)) : t;
              setDraft(fixed);
              takeAction(fixed, 'voice');
            }
          })
        : ce('div', { className: 'ais-note', key: 'nv' },
            'Voice input is not available here. ' +
            (isFn(voiceApi().unsupportedReason) ? str(voiceApi().unsupportedReason()) : 'Use free text instead.')),
      interim ? ce('div', { className: 'ais-note info', key: 'i' }, 'Heard so far: ' + interim) : null
    ]);

    var hintUI = hint.open
      ? ce('div', { className: 'ais-note info', key: 'hint' },
          hint.busy ? 'Your instructor is thinking...' : str(hint.text))
      : null;

    var freeRow = ce('div', { className: 'ais-free', key: 'free' }, [
      ce('button', { key: 'v', type: 'button', className: 'ais-mini', onClick: showVitals, disabled: locked },
        'What are my vitals again? (free)'),
      ce('button', {
        key: 'c', type: 'button', className: 'ais-mini' + (showChart ? ' on' : ''),
        onClick: openChart, disabled: paused
      }, showChart ? 'Hide the chart' : 'Show the chart (free)'),
      ce('button', {
        key: 'h', type: 'button', className: 'ais-mini', disabled: locked || hint.busy,
        title: 'Costs ' + HINT_COST + ' points',
        onClick: requestHint
      }, 'Ask for a hint (-' + HINT_COST + ' points, used ' + numOr(run.hintsUsed, 0) + ')'),
      ce('button', {
        key: 'm', type: 'button', className: 'ais-mini' + (voiceOn ? ' on' : ''),
        'aria-pressed': voiceOn ? 'true' : 'false', disabled: !vsup.tts || paused, onClick: toggleVoice
      }, voiceOn ? 'Mute audio' : 'Unmute audio')
    ]);

    var chartDrawer = showChart ? ce('div', { className: 'ais-chart', key: 'chart' }, [
      ce('div', { className: 'ais-lab', key: 'l' }, 'Chart'),
      ce('div', { className: 'ais-kv', key: 'kv' }, [
        ce('span', { className: 'k', key: 'k1' }, 'Name'), ce('span', { className: 'v', key: 'v1' }, str(chart.name) || '--'),
        ce('span', { className: 'k', key: 'k2' }, 'Age / sex'), ce('span', { className: 'v', key: 'v2' }, [str(chart.age), str(chart.sex)].filter(Boolean).join(' / ') || '--'),
        ce('span', { className: 'k', key: 'k7' }, 'Weight'), ce('span', { className: 'v', key: 'v7' }, str(chart.weightKg) || '--'),
        ce('span', { className: 'k', key: 'k3' }, 'Admitting dx'), ce('span', { className: 'v', key: 'v3' }, str(chart.admittingDx) || '--'),
        ce('span', { className: 'k', key: 'k4' }, 'Allergies'), ce('span', { className: 'v', key: 'v4' }, arr(chart.allergies).join(', ') || 'None known'),
        ce('span', { className: 'k', key: 'k5' }, 'Code status'), ce('span', { className: 'v', key: 'v5' }, str(chart.codeStatus) || '--'),
        ce('span', { className: 'k', key: 'k6' }, 'History'), ce('span', { className: 'v', key: 'v6' }, arr(chart.history).join('; ') || '--')
      ]),
      ce('div', { className: 'ais-lab', key: 'l2' }, 'Latest vitals'),
      ce('div', { className: 'ais-sub', key: 'v' }, vitalsLine(run.vitals) || 'Not yet charted')
    ]) : null;

    /* ---- handoff ---- */
    var SBARComp = window.SBARRecorder;
    var handoffUI = null;
    if (run.phase === 'handoff') {
      var hs = handoffScenario(run, scenario);
      handoffUI = ce('div', { className: 'ais-act', key: 'handoff' }, [
        ce('div', { className: 'ais-lab', key: 'l' }, 'Handoff - SBAR to the provider'),
        ce('p', { className: 'ais-sub', key: 'p' },
          'Give your report. Situation, background, assessment, recommendation. Speak it or type it - it is graded ' +
          'for completeness and for whether you led with the priority.'),
        (isFn(SBARComp))
          /* SBARRecorder is not ours to add a `disabled` prop to, so the pause
             lockout for it is threefold: the CSS makes the whole action area
             inert, doPause() calls MM.voice.stopListening(), and every way it
             can finish the run goes through finishWithSbar(). */
          ? ce(SBARComp, {
              key: 'rec', scenario: hs,
              onComplete: function (res) { finishWithSbar(res); }
            })
          : ce('div', { className: 'ais-col', key: 'fallback' }, [
              ce('textarea', {
                key: 'ta', className: 'ais-ta', value: sbarText, disabled: sbarBusy || paused,
                style: { minHeight: '140px' },
                'aria-label': 'Your SBAR report',
                placeholder: 'S: ...  B: ...  A: ...  R: ...',
                onChange: function (e) { setSbarText(e.target.value); }
              }),
              ce('button', {
                key: 'go', type: 'button', className: 'btn btn-primary',
                disabled: sbarBusy || paused || !str(sbarText).trim(), onClick: submitTypedSbar
              }, sbarBusy ? 'Grading...' : 'Give report and finish')
            ]),
        ce('button', {
          key: 'skip', type: 'button', className: 'ais-mini', disabled: paused,
          onClick: function () { finishWithSbar(null); }
        }, 'Skip the handoff and go to the debrief')
      ]);
    }

    var modeHint = (function () {
      for (var i = 0; i < INPUT_MODES.length; i++) {
        if (INPUT_MODES[i].id === inputMode) return INPUT_MODES[i].hint;
      }
      return '';
    })();

    /* ---- what to say while we wait ----------------------------------------
       Everything here is either measured (seconds waited, characters received)
       or a description of the request itself. No invented percentages, and no
       indicator that depends on token arrival - the function buffers the SSE
       body, so tokens usually all land at once at the very end. */
    var isOpeningWait = run.turnCount === 0;
    var waitLabel;
    if (paused) {
      /* Never claim the scene is advancing while it is frozen. */
      waitLabel = 'Paused. Anything the model sends back is held until you resume.';
    } else if (chars > 0) {
      /* Characters really have arrived, so say the true thing. Because the
         function buffers the SSE body this usually flips straight from a stage
         message to the finished turn - which is exactly why the stage messages
         and the clock above cannot depend on it. */
      waitLabel = (isOpeningWait ? 'Receiving report... (' : 'Receiving the response... (') +
        chars + ' chars)';
    } else if (isOpeningWait) {
      waitLabel = openAttempt > 0
        ? 'Re-paging the charge nurse... (attempt ' + (openAttempt + 1) + ' of ' + (OPENING_MAX_RETRIES + 1) + ')'
        : stageText(OPENING_STAGES, waitSec);
    } else {
      waitLabel = 'The scenario is responding...';
    }
    /* Mid-run the counter stays out of the way for the first few seconds; a
       normal turn is back before then and a ticking clock would only add
       pressure. After 20s the honest thing is to name the cause. */
    var waitNote = (!isOpeningWait && waitSec >= SLOW_NOTE_AT)
      ? 'Still working - this model is slow today.' : '';
    var showWaitSecs = isOpeningWait || waitSec >= MIDRUN_CLOCK_AT;

    /* A 130s client timeout is a terrible thing to hit in silence. At 30s we
       say so and hand back control; Retry bumps the request id, so the reply
       still in flight is discarded rather than landing on top of the new one. */
    var slowBox = (busy && !paused && waitSec >= SLOW_WARN_AT)
      ? ce('div', { className: 'ais-note ais-slow', key: 'slow', role: 'status' }, [
          ce('div', { key: 'm' },
            'This model is slow right now - ' + waitSec + ' seconds so far. You can keep waiting, or retry.'),
          ce('div', { className: 'ais-row', key: 'b' }, [
            ce('button', {
              key: 'r', type: 'button', className: 'btn btn-outline btn-sm',
              onClick: function () { if (paused) return; if (isFn(retryRef.current)) retryRef.current(); }
            }, isOpeningWait ? 'Retry admitting the patient' : 'Retry this turn')
          ])
        ])
      : null;

    /* The options stay mounted while the model thinks - dimmed, not unmounted.
       Swapping them for a spinner reflows the page mid-read every turn. */
    var actionUI = (run.phase === 'handoff') ? handoffUI
      : openingFailed
        /* No chart means no playable run. Offering options and a text box here
           would be pretending there is a patient to act on; the error box above
           owns this state. */
        ? null
      : ce('div', {
          className: 'ais-act' + (busy ? ' busy' : ''), key: 'act',
          'aria-disabled': paused ? 'true' : 'false'
        }, [
          busy ? ce(Thinking, {
            key: 'think', seconds: waitSec,
            showSeconds: showWaitSecs, note: waitNote, label: waitLabel
          }) : null,
          slowBox,
          hintUI,
          (inputMode === 'choice') ? choiceUI : null,
          (inputMode === 'text') ? textUI : null,
          (inputMode === 'voice') ? voiceUI : null,
          ce('div', { className: 'ais-col', key: 'seg', style: { gap: '4px' } }, [
            ce(Segmented, {
              key: 's', label: 'Input mode', value: inputMode,
              items: INPUT_MODES.map(function (m) {
                return {
                  id: m.id, label: m.label, hint: m.hint,
                  disabled: paused || (m.id === 'voice' && !vsup.stt)
                };
              }),
              onChange: changeMode
            }),
            ce('span', { className: 'ais-sub', key: 'h' },
              modeHint + ' You can switch at any point without losing what you have typed.')
          ]),
          freeRow
        ]);

    return ce('div', { className: 'ais-wrap' + (paused ? ' is-paused' : '') }, [
      strip,
      errorBox,
      chartDrawer,
      transcript,
      actionUI,
      ce('div', { className: 'ais-row', key: 'foot', style: { justifyContent: 'space-between' } }, [
        ce('span', { className: 'ais-lab', key: 'l' },
          str(run.difficultyId) + ' · hints ' + numOr(run.hintsUsed, 0) +
          (numOr(run.pausedSec, 0) || pausedSec ? ' · paused ' + fmtClock(pausedSec) : '')),
        /* Deliberately NOT locked while paused: a student who has stepped away
           must always be able to leave, and leaving mutates nothing. */
        ce('button', {
          key: 'q', type: 'button', className: 'ais-mini',
          onClick: function () {
            stopSpeech(true);
            if (isFn(p.onExit)) p.onExit();
          }
        }, 'End the run')
      ])
    ]);
  }

  /* ==========================================================================
   * 12. DEBRIEF
   * ======================================================================== */

  /* Scenario action strings are teaching paragraphs. The turning-point list
     needs a headline the student can scan in one second. */
  function shortAction(s) {
    var t = str(s).split(/\s+[-–]\s+/)[0];   /* everything before the first " - " */
    t = t.split(/[,;.]/)[0].trim();
    if (!t) t = str(s).slice(0, 60);
    if (t.length > 72) { t = t.slice(0, 69).replace(/\s+\S*$/, '') + '…'; }
    return t;
  }

  /**
   * turningPoints(run, scenario, result) -> [{head, body, tone}]
   * A structured payload, not a wall of prose: the imperative carries the page
   * and the rationale sits underneath it. This is the highest-stakes copy in
   * the product and it has to be readable in one pass.
   */
  function turningPoints(run, scenario, result) {
    var out = [];
    var r = obj(run);
    var missed = arr(obj(result).missedCritical);

    if (r.keyIvAction && !r.keyDone) {
      out.push({
        head: shortAction(r.keyIvAction),
        body: 'This is the action that stops this condition progressing. It never happened, and until it ' +
              'does nothing else holds.'
      });
    }
    if (!r.escalated) {
      out.push({
        head: 'Call for help',
        body: 'Stability crossed into the rapid-response range and care continued alone. Escalating is a ' +
              'nursing intervention, and it is the highest-yield one a student nurse has.'
      });
    }
    var harm = arr(r.harmfulActions);
    for (var j = 0; j < harm.length && out.length < 5; j++) {
      out.push({
        head: 'Do not: ' + shortAction(harm[j]),
        body: 'This is on the documented critical-error list for this condition. Harm is not recoverable by ' +
              'doing something right afterwards.'
      });
    }
    for (var i = 0; i < missed.length && out.length < 5; i++) {
      out.push({
        head: shortAction(missed[i].action),
        body: str(missed[i].rationale || 'A critical action for this condition that was never performed.')
      });
    }
    if (!out.length) {
      out.push({
        head: 'Act one turn earlier',
        body: 'This patient declined faster than the interventions could take hold. In a deteriorating ' +
              'patient, timing is the intervention.',
        tone: 'calm'
      });
    }
    return out;
  }

  /* renders a [{head, body}] payload as scannable imperatives */
  function teachingList(items, key) {
    return ce('ul', { className: 'ais-teach', key: key || 'teach' }, arr(items).map(function (t, i) {
      return ce('li', { key: i, className: t.tone === 'calm' ? 'calm' : '' }, [
        ce('b', { key: 'h' }, str(t.head)),
        t.body ? ce('div', { className: 'ais-sub', key: 'b' }, str(t.body)) : null
      ]);
    }));
  }

  function DebriefScreen(props) {
    var p = obj(props);
    var run = obj(p.run), result = obj(p.result), scenario = obj(p.scenario);
    var meta = OUTCOME_META[str(run.outcome)] || OUTCOME_META.partial;
    var grave = meta.kind === 'grave';
    /* "the patient deteriorated and nobody was called" is not a quiz result -
       it gets the teaching-first ordering, while keeping the `bad` treatment */
    var leadWithTeaching = grave || str(run.outcome) === 'decline';

    var aiHook = useState({ busy: false, text: '', tried: false });
    var ai = aiHook[0], setAi = aiHook[1];
    var aliveRef = useRef(true);
    useEffect(function () { aliveRef.current = true; return function () { aliveRef.current = false; }; }, []);

    function getAiDebrief() {
      if (ai.busy) return;
      setAi({ busy: true, text: '', tried: true });
      var api = aiApi();
      if (!isFn(api.debriefSimulation)) {
        setAi({ busy: false, tried: true, text: 'The AI debrief is not available right now. The breakdown above is complete on its own.' });
        return;
      }
      var perfSummary = {
        score: result.total, maxScore: 100, pct: result.total, timeSec: run.timeSec,
        actions: arr(run.turns).filter(function (t) { return t.studentAction; })
          .map(function (t) { return t.studentAction + ' [' + str(t.quality) + ']'; }),
        missedCritical: arr(result.missedCritical).map(function (i) { return str(i.action); }),
        errors: arr(result.errors).map(function (e) { return str(obj(e).text || e); }),
        deteriorated: numOr(run.stability, 100) < 60,
        notes: 'Outcome: ' + str(run.outcome) + '. Final stability ' + numOr(run.stability, 0) + '/100. ' +
               'Hints used: ' + numOr(run.hintsUsed, 0) + '.'
      };
      Promise.resolve(api.debriefSimulation(handoffScenario(run, scenario), perfSummary)).then(function (md) {
        if (!aliveRef.current) return;
        setAi({ busy: false, tried: true, text: str(md) });
      }, function () {
        if (!aliveRef.current) return;
        setAi({ busy: false, tried: true, text: 'The AI debrief could not be generated. Your results are saved.' });
      });
    }

    var hero = ce('div', { className: 'ais-out ' + meta.kind, key: 'hero' }, [
      ce('div', { className: 'ais-lab', key: 'l' },
        leadWithTeaching ? 'Outcome' : 'Outcome · ' + str(run.condition)),
      ce('h2', { key: 'h' }, meta.title),
      ce('p', { key: 'p' }, ledeFor(run, meta)),
      grave ? null : (leadWithTeaching ? null : ce('div', { className: 'ais-score', key: 's' }, [
        ce('span', { className: 'n', key: 'n' }, numOr(result.total, 0)),
        ce('span', { className: 'ais-sub', key: 'x' }, '/ 100 · grade ' + str(result.letter) +
          ' · ' + numOr(run.turnCount, 0) + ' turns · ' + fmtClock(numOr(run.timeSec, 0)))
      ]))
    ]);

    /* for a death, a code or an unescalated decline the teaching moment comes
       FIRST, before any score - and the reassurance frames the list rather
       than trailing it */
    var turning = ce('div', { className: 'card ais-col', key: 'turn' }, [
      ce('div', { className: 'ais-lab', key: 'l' },
        leadWithTeaching ? 'What would have changed this outcome' : 'What to tighten up'),
      grave ? ce('p', { className: 'ais-sub', key: 'n' },
        'This is a simulation, and it is designed so that this can happen safely here instead of on a real unit. ' +
        'Run it again with the same condition - the patient will be different, the priorities will not be.') : null,
      teachingList(turningPoints(run, scenario, result), 'u')
    ]);

    var scoreCard = ce('div', { className: 'card ais-col', key: 'score' }, [
      ce('div', { className: 'ais-lab', key: 'l' }, 'Score breakdown'),
      leadWithTeaching ? ce('div', { className: 'ais-score', key: 's' }, [
        ce('span', { className: 'n', key: 'n' }, numOr(result.total, 0)),
        ce('span', { className: 'ais-sub', key: 'x' }, '/ 100 · ' + numOr(run.turnCount, 0) + ' turns · ' +
          fmtClock(numOr(run.timeSec, 0)))
      ]) : null,
      ce('div', { className: 'ais-col', key: 'cats' }, arr(result.categories).map(function (c) {
        var pct = clamp(Math.round(numOr(c.pct, 0) * 100), 0, 100);
        return ce('div', { className: 'ais-cat', key: c.key }, [
          ce('div', { className: 'ais-cat-head', key: 'h' }, [
            ce('span', { key: 'a' }, str(c.label)),
            ce('span', { key: 'b' }, numOr(c.earned, 0) + ' / ' + numOr(c.weight, 0))
          ]),
          ce('div', { className: 'ais-bar', key: 'b' }, ce('i', { style: { width: pct + '%' } })),
          ce('div', { className: 'ais-lab', key: 'd' }, str(c.detail))
        ]);
      })),
      ce('hr', { className: 'ais-hr', key: 'hr' }),
      ce('ul', { className: 'ais-list', key: 'mods' }, [
        ce('li', { key: 'a' }, ce('b', {}, 'Base performance: '), numOr(result.base, 0) + ' / 100'),
        ce('li', { key: 'b' }, ce('b', {}, 'Hints: '), numOr(run.hintsUsed, 0) + ' used, ' +
          numOr(obj(result.modifiers).hints, 0) + ' points'),
        ce('li', { key: 'c' }, ce('b', {}, 'Free text / voice bonus: '), '+' +
          numOr(obj(result.modifiers).freeText, 0) + ' (' + numOr(run.freeTextGood, 0) + ' of ' +
          numOr(run.freeTextTurns, 0) + ' unscripted actions were sound)'),
        ce('li', { key: 'd' }, ce('b', {}, 'Outcome adjustment: '), numOr(obj(result.modifiers).outcome, 0)),
        ce('li', { key: 'e' }, ce('b', {}, 'Final stability: '), numOr(run.stability, 0) + '/100 (' +
          ZONE_META[zoneFor(numOr(run.stability, 0))].label + ')')
      ])
    ]);

    var ivs = arr(scenario.interventions).slice().sort(function (a, b) {
      return numOr(a.order, 99) - numOr(b.order, 99);
    });
    var hitMap = {};
    arr(run.matchedIvIds).forEach(function (id) { hitMap[str(id)] = true; });

    var priority = ce('div', { className: 'card ais-col', key: 'prio' }, [
      ce('div', { className: 'ais-lab', key: 'l' }, 'The correct priority order for this condition'),
      ce('ul', { className: 'ais-ord', key: 'u' }, ivs.map(function (iv, i) {
        var hit = !!hitMap[str(iv.id)];
        return ce('li', { key: str(iv.id) || i, className: hit ? 'hit' : (iv.critical ? 'miss' : '') }, [
          ce('span', { className: 'num', key: 'n' }, hit ? 'OK' : String(numOr(iv.order, i + 1))),
          ce('span', { key: 't' }, [
            str(iv.action),
            iv.critical ? ce('span', { className: 'tag tag-red', key: 'c', style: { marginLeft: '6px' } }, 'CRITICAL') : null,
            iv.rationale ? ce('div', { className: 'ais-lab', key: 'r', style: { marginTop: '3px', textTransform: 'none', letterSpacing: 0 } }, str(iv.rationale)) : null
          ])
        ]);
      }))
    ]);

    var didWell = [];
    var rubric = {};
    arr(run.turns).forEach(function (t) {
      arr(t.rubricHits).forEach(function (h) { rubric[str(h)] = true; });
      if (t.quality === 'correct' && t.studentAction) didWell.push(str(t.studentAction));
    });
    var rubricList = Object.keys(rubric);

    var wellCard = ce('div', { className: 'card ais-col', key: 'well' }, [
      ce('div', { className: 'ais-lab', key: 'l' }, 'What you did well'),
      didWell.length
        ? ce('ul', { className: 'ais-list', key: 'u' }, didWell.slice(0, 8).map(function (d, i) {
            return ce('li', { key: i }, d);
          }))
        : ce('p', { className: 'ais-sub', key: 'n' },
            'No action this run was graded fully correct. That is information, not a verdict - work the priority ' +
            'order below until the sequence is automatic.'),
      rubricList.length
        ? ce('div', { className: 'ais-row', key: 'r' }, rubricList.slice(0, 12).map(function (h, i) {
            return ce('span', { className: 'tag tag-green', key: i }, h.replace(/_/g, ' '));
          }))
        : null
    ]);

    /* top three by priority order, imperative first - not four paragraphs */
    var missedTop = arr(result.missedCritical).slice().sort(function (a, b) {
      return numOr(obj(a).order, 99) - numOr(obj(b).order, 99);
    }).slice(0, 3);

    var missedCard = ce('div', { className: 'card ais-col', key: 'missed' }, [
      ce('div', { className: 'ais-lab', key: 'l' },
        missedTop.length ? 'Do these first next time' : 'Critical actions you skipped'),
      missedTop.length
        ? teachingList(missedTop.map(function (i) {
            return { head: shortAction(i.action), body: str(i.rationale || '') };
          }), 'u')
        : ce('p', { className: 'ais-sub', key: 'n' }, 'None. Every critical action for this condition was covered.'),
      (arr(result.missedCritical).length > missedTop.length)
        ? ce('p', { className: 'ais-lab', key: 'more' },
            (arr(result.missedCritical).length - missedTop.length) +
            ' more critical actions are listed in the priority order below')
        : null,
      arr(run.harmfulActions).length
        ? ce('div', { key: 'h' }, [
            ce('div', { className: 'ais-lab', key: 'l', style: { marginTop: '8px' } }, 'Safety'),
            teachingList(arr(run.harmfulActions).map(function (h) {
              return {
                head: 'Do not: ' + shortAction(h),
                body: 'Documented as directly harmful for this condition.'
              };
            }), 'u')
          ])
        : null
    ]);

    var sbar = obj(run.sbar);
    var sbarCard = run.sbar ? ce('div', { className: 'card ais-col', key: 'sbar' }, [
      ce('div', { className: 'ais-lab', key: 'l' }, 'Your SBAR handoff'),
      ce('div', { className: 'ais-score', key: 's' }, [
        ce('span', { className: 'n', key: 'n', style: { fontSize: '28px' } },
          numOr(sbar.score, 0) + '/' + numOr(sbar.maxScore, 20)),
        ce('span', { className: 'ais-sub', key: 'p' }, numOr(sbar.pct, 0) + '%')
      ]),
      sbar.feedback ? ce('p', { className: 'ais-sub', key: 'f' }, str(sbar.feedback)) : null,
      arr(sbar.missing).length
        ? ce('div', { className: 'ais-row', key: 'm' }, arr(sbar.missing).map(function (m, i) {
            return ce('span', { className: 'tag tag-orange', key: i }, str(m));
          }))
        : null
    ]) : ce('div', { className: 'card ais-col', key: 'sbar' }, [
      ce('div', { className: 'ais-lab', key: 'l' }, 'Your SBAR handoff'),
      ce('p', { className: 'ais-sub', key: 'p' },
        'No handoff was given, so the communication score reflects that. On a real unit the report IS the ' +
        'intervention - the best assessment in the world does nothing if it never reaches the provider.')
    ]);

    var pearls = arr(scenario.pearls).length ? arr(scenario.pearls) : arr(scenario.keyPoints);
    var pearlCard = pearls.length ? ce('div', { className: 'card ais-col', key: 'pearls' }, [
      /* no test-prep branding on a death debrief */
      ce('div', { className: 'ais-lab', key: 'l' }, grave
        ? 'What this condition does, and what stops it'
        : 'ATI / NCLEX pearls for ' + str(scenario.title)),
      ce('ul', { className: 'ais-list', key: 'u' }, pearls.slice(0, 10).map(function (x, i) {
        return ce('li', { key: i }, str(x));
      }))
    ]) : null;

    var aiCard = ce('div', { className: 'card ais-col', key: 'aidb' }, [
      ce('div', { className: 'ais-lab', key: 'l' }, 'Instructor debrief'),
      ai.text
        ? ce('p', { className: 'ais-sub', key: 't', style: { whiteSpace: 'pre-wrap' } }, ai.text)
        : ce('p', { className: 'ais-sub', key: 'p' },
            'Want this walked through the way your clinical instructor would? It uses one AI message.'),
      ai.text ? null : ce('button', {
        key: 'b', type: 'button', className: 'btn btn-outline btn-sm', disabled: ai.busy, onClick: getAiDebrief
      }, ai.busy ? 'Writing your debrief...' : 'Get the full instructor debrief')
    ]);

    var footer = ce('div', { className: 'card ais-row', key: 'foot', style: { justifyContent: 'space-between' } }, [
      ce('button', { key: 'again', type: 'button', className: 'btn btn-primary', onClick: p.onRestart },
        'Run another patient'),
      isFn(p.onExit) ? ce('button', { key: 'x', type: 'button', className: 'btn btn-outline', onClick: p.onExit }, 'Done')
                     : null
    ]);

    /* teaching before score whenever the patient came to harm */
    var order = leadWithTeaching
      ? [hero, turning, missedCard, scoreCard, priority, sbarCard, wellCard, pearlCard, aiCard, footer]
      : [hero, scoreCard, wellCard, turning, missedCard, priority, sbarCard, pearlCard, aiCard, footer];

    return ce('div', { className: 'ais-wrap' }, order);
  }

  /* ==========================================================================
   * 13. ROOT
   * ======================================================================== */

  function AIScenarioMode(props) {
    var p = obj(props);
    var screenHook = useState('setup');
    var screen = screenHook[0], setScreen = screenHook[1];
    var cfgHook = useState(null);
    var cfg = cfgHook[0], setCfg = cfgHook[1];
    var doneHook = useState(null);
    var done = doneHook[0], setDone = doneHook[1];
    var nonceHook = useState(0);
    var nonce = nonceHook[0], setNonce = nonceHook[1];

    injectStyles();

    function onStart(c) {
      setCfg(c);
      setDone(null);
      setNonce(nonce + 1);
      setScreen('run');
    }

    function onFinish(res) {
      setDone(res);
      setScreen('debrief');
    }

    function restart() {
      setDone(null);
      setCfg(null);
      setScreen('setup');
    }

    if (screen === 'run' && cfg) {
      return ce(RunScreen, {
        key: 'run-' + nonce,
        cfg: cfg,
        onFinish: onFinish,
        onExit: function () {
          if (isFn(voiceApi().stopSpeaking)) { try { voiceApi().stopSpeaking(); } catch (e) { /* noop */ } }
          restart();
        }
      });
    }

    if (screen === 'debrief' && done) {
      return ce(DebriefScreen, {
        key: 'debrief-' + nonce,
        run: done.run,
        result: done.result,
        scenario: obj(cfg).scenario,
        onRestart: restart,
        onExit: isFn(p.onExit) ? p.onExit : restart
      });
    }

    return ce(SetupScreen, { key: 'setup', onStart: onStart, onExit: p.onExit });
  }

  /* ==========================================================================
   * 14. EXPORTS
   * The engine internals hang off the component so they can be unit tested and
   * reused (the parser and the stability model are the load-bearing parts).
   * ======================================================================== */

  AIScenarioMode.parseTurnJSON = parseTurnJSON;
  AIScenarioMode.normalizeTurn = normalizeTurn;
  AIScenarioMode.degradedTurn = degradedTurn;
  AIScenarioMode.stepStability = stepStability;
  AIScenarioMode.resolveOutcome = resolveOutcome;
  AIScenarioMode.zoneFor = zoneFor;
  AIScenarioMode.trendFrom = trendFrom;
  AIScenarioMode.sevFor = sevFor;
  AIScenarioMode.isAbnormal = isAbnormal;
  AIScenarioMode.shortAction = shortAction;
  AIScenarioMode.turningPoints = turningPoints;
  AIScenarioMode.buildGroundTruth = buildGroundTruth;
  AIScenarioMode.buildSystemPrompt = buildSystemPrompt;
  AIScenarioMode.openingUserMessage = openingUserMessage;
  AIScenarioMode.stateBlock = stateBlock;
  AIScenarioMode.trimMessages = trimMessages;
  AIScenarioMode.KEEP_TURNS = KEEP_TURNS;
  AIScenarioMode.createRun = createRun;
  AIScenarioMode.commitTurn = commitTurn;
  AIScenarioMode.finalizeRun = finalizeRun;
  AIScenarioMode.scoreRun = scoreRun;
  AIScenarioMode.buildPerf = buildPerf;
  AIScenarioMode.keyStabilizer = keyStabilizer;
  AIScenarioMode.handoffScenario = handoffScenario;
  AIScenarioMode.categoryList = categoryList;
  AIScenarioMode.scenariosIn = scenariosIn;
  AIScenarioMode.isAvailable = aiIsAvailable;
  AIScenarioMode.DIFFICULTIES = DIFFICULTIES;
  AIScenarioMode.QUALITY_DELTA = QUALITY_DELTA;
  AIScenarioMode.OUTCOME_META = OUTCOME_META;
  AIScenarioMode.ZONE_META = ZONE_META;
  AIScenarioMode.TURN_CAP = TURN_CAP;
  AIScenarioMode.completeTruncatedJSON = completeTruncatedJSON;
  AIScenarioMode.MIN_TURNS_FOR_OUTCOME = MIN_TURNS_FOR_OUTCOME;
  AIScenarioMode.HINT_COST = HINT_COST;

  /* ---- pause API -----------------------------------------------------------
   * The shared convention, mirrored by js/sim-engine.js so a caller never has
   * to know which engine is on screen:
   *
   *   pauseRun(reason) / resumeRun() / togglePauseRun() -> bool: IS IT PAUSED NOW
   *   isRunPaused()  -> bool
   *   canPauseRun()  -> bool (false once the run is over, false with nothing mounted)
   *   pauseStats()   -> {active,paused,pauseCount,pausedMs,pausedSec,mode,...}
   *   onPauseChange(fn) -> off()   fn(paused, snapshot)
   *   pauseControl   -> the same thing as one object, also registered in the
   *                     shared window.MMPause registry under 'ai-scenario'
   *
   * All of them are safe with no run mounted: they answer false and do nothing.
   * The controller behind them is attached by the mounted RunScreen and
   * detached on unmount - nothing in module scope here ticks, and nothing
   * survives the component.
   * ------------------------------------------------------------------------ */
  AIScenarioMode.pauseControl = aiPause.pauseControl;
  AIScenarioMode.pauseRun = aiPause.pauseRun;
  AIScenarioMode.resumeRun = aiPause.resumeRun;
  AIScenarioMode.togglePauseRun = aiPause.togglePauseRun;
  AIScenarioMode.isRunPaused = aiPause.isRunPaused;
  AIScenarioMode.canPauseRun = aiPause.canPauseRun;
  AIScenarioMode.pauseStats = aiPause.pauseStats;
  AIScenarioMode.onPauseChange = aiPause.onPauseChange;
  /* short aliases - the same functions, for call sites that read better
     without the Run suffix */
  AIScenarioMode.pause = aiPause.pauseRun;
  AIScenarioMode.resume = aiPause.resumeRun;
  AIScenarioMode.togglePause = aiPause.togglePauseRun;
  AIScenarioMode.isPaused = aiPause.isRunPaused;
  AIScenarioMode.canPause = aiPause.canPauseRun;
  AIScenarioMode.createPauseClock = createPauseClock;
  AIScenarioMode.isTypingTarget = isTypingTarget;

  window.AIScenarioMode = AIScenarioMode;
  window.AIScenarioSetup = SetupScreen;
  window.AIScenarioRun = RunScreen;
  window.AIScenarioDebrief = DebriefScreen;
})();
