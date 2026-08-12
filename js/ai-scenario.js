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
  var RE_FREE_VITALS = /^(what|show|tell|give|repeat|read)?[^a-z]*(are|is|me)?[^a-z]*(my|the|his|her|current|latest)?[^a-z]*(vital|vitals|vital signs|numbers|sats?|monitor)\b/i;
  var RE_FREE_CHART = /^(show|open|pull up|check|look at|review|see)?[^a-z]*(me)?[^a-z]*(the)?[^a-z]*(chart|charts|record|labs?|orders?|history|allergies|mar)\b/i;

  /* ==========================================================================
   * 1. CONSTANTS
   * ======================================================================== */

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

  function stripFences(text) {
    var t = str(text).trim();
    var whole = /^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/.exec(t);
    if (whole) return whole[1].trim();
    var inner = /```[a-zA-Z]*\s*([\s\S]*?)```/.exec(t);
    if (inner) return inner[1].trim();
    return t;
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
    var t = stripFences(raw);
    if (!t) return null;

    var attempts = [];
    attempts.push(t);
    var carved = outermostObject(t);
    if (carved && carved !== t) attempts.push(carved);

    var i, v;
    for (i = 0; i < attempts.length; i++) {
      try {
        v = JSON.parse(attempts[i]);
        if (v && typeof v === 'object' && !Array.isArray(v)) return v;
      } catch (e) { /* next shape */ }
    }
    /* trailing-comma repair, then newline-in-string repair */
    for (i = 0; i < attempts.length; i++) {
      try {
        v = JSON.parse(attempts[i].replace(/,\s*([\]}])/g, '$1'));
        if (v && typeof v === 'object' && !Array.isArray(v)) return v;
      } catch (e) { /* next shape */ }
    }
    return null;
  }

  function strArray(v, cap) {
    var out = [];
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) {
        var s = str(typeof v[i] === 'object' ? (obj(v[i]).text || obj(v[i]).name) : v[i]).trim();
        if (s) out.push(s);
      }
    } else if (typeof v === 'string' && v.trim()) {
      out.push(v.trim());
    }
    return cap ? out.slice(0, cap) : out;
  }

  function oneOf(v, list, dflt) {
    var s = str(v).toLowerCase().replace(/[\s-]+/g, '_');
    return (list.indexOf(s) !== -1) ? s : dflt;
  }

  function normalizeVitals(v, prev) {
    var src = obj(v), out = {}, base = obj(prev);
    for (var i = 0; i < VITAL_KEYS.length; i++) {
      var k = VITAL_KEYS[i].k;
      var val = src[k];
      if (val === undefined || val === null || val === '') {
        out[k] = (base[k] === undefined) ? '' : base[k];
      } else if (typeof val === 'number') {
        out[k] = val;
      } else {
        out[k] = str(val).trim();
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
    for (i = 0; i < raw.length && out.length < 6; i++) {
      o = raw[i];
      if (typeof o === 'string') { text = o.trim(); o = {}; }
      else { o = obj(o); text = str(o.text || o.label || o.action).trim(); }
      if (!text) continue;
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

  function normalizeChart(v) {
    var c = obj(v);
    return {
      name: str(c.name || c.patientName).trim() || 'Unnamed patient',
      age: str(c.age).trim() || 'Adult',
      sex: str(c.sex || c.gender).trim(),
      weightKg: str(c.weightKg || c.weight).trim(),
      room: str(c.room || c.bed).trim(),
      admittingDx: str(c.admittingDx || c.diagnosis || c.admittingDiagnosis).trim() || 'Pending',
      allergies: strArray(c.allergies, 6),
      codeStatus: str(c.codeStatus).trim() || 'Full Code',
      chiefComplaint: str(c.chiefComplaint || c.complaint).trim(),
      history: strArray(c.history || c.pmh, 8)
    };
  }

  /**
   * normalizeTurn(parsed, ctx) -> a complete, safe turn object.
   * ctx: {prevVitals, seed, turnNumber, phase}
   */
  function normalizeTurn(parsed, ctx) {
    var p = obj(parsed), c = obj(ctx);
    var narration = str(p.narration || p.narrative || p.scene).trim();
    var speech = p.patientSpeech;
    speech = (typeof speech === 'string' && speech.trim()) ? speech.trim() : null;

    var fb = p.feedbackOnLastAction;
    fb = (typeof fb === 'string' && fb.trim()) ? fb.trim() : null;

    var hint = p.hint;
    hint = (typeof hint === 'string' && hint.trim()) ? hint.trim() : null;

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
      newFindings: strArray(p.newFindings || p.findings, 6),
      feedbackOnLastAction: fb,
      lastActionQuality: quality,
      options: normalizeOptions(p.options, numOr(c.seed, 7) + numOr(c.turnNumber, 0) * 101),
      phase: oneOf(p.phase, PHASES, str(c.phase) || 'assessment'),
      outcome: outcome,
      hint: hint,
      rubricHits: strArray(p.rubricHits || p.rubric, 8),
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
      'Return the JSON object only.'
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
    L.push('Evaluate that action, advance the scene by one beat, and return the JSON object only.');
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
      '.ais-pick,.ais-opt,.ais-mini,.ais-seg button,.ais-escalate{transition:none}',
      '.ais-pick:active,.ais-opt:active,.ais-mini:active,.ais-seg button:active,.ais-escalate:active{',
      'transform:none;background:var(--surface3)}',
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

  function Thinking(props) {
    var p = obj(props);
    return ce('div', { className: 'ais-think', role: 'status', 'aria-live': 'polite' }, [
      ce('span', { className: 'ais-dots', key: 'd', 'aria-hidden': 'true' },
        [ce('i', { key: 1 }), ce('i', { key: 2 }), ce('i', { key: 3 })]),
      ce('span', { key: 't' }, str(p.label) || 'The scenario is responding...'),
      p.chars ? ce('span', { key: 'c', className: 'ais-lab' }, p.chars + ' chars') : null
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

  function trimMessages(msgs) {
    var m = arr(msgs);
    if (m.length <= 14) return m.slice();
    return [m[0]].concat(m.slice(m.length - 12));
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
    next.timeSec = Math.round((Date.now() - numOr(next.startedAt, Date.now())) / 1000);

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

  function askTurn(system, messages, temperature, onToken) {
    var ai = aiApi();
    if (!isFn(ai.chat)) return Promise.reject({ code: 'ai-disabled' });

    return ai.chat({
      system: system, messages: trimMessages(messages),
      maxTokens: 1500, temperature: temperature, onToken: onToken
    }).then(function (raw) {
      var parsed = parseTurnJSON(raw);
      if (parsed) return { parsed: parsed, raw: raw, repaired: false };

      /* one repair attempt, then a graceful in-character fallback */
      var repair = trimMessages(messages).concat([
        { role: 'assistant', content: str(raw).slice(0, 1200) || '(empty reply)' },
        { role: 'user', content: REPAIR_MESSAGE }
      ]);
      return ai.chat({
        system: system, messages: repair, maxTokens: 1500, temperature: 0.2
      }).then(function (raw2) {
        return { parsed: parseTurnJSON(raw2), raw: raw2, repaired: true };
      }, function () {
        return { parsed: null, raw: raw, repaired: true };
      });
    });
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

    var aliveRef = useRef(true);
    var startedRef = useRef(false);
    var retryRef = useRef(null);
    var logRef = useRef(null);

    var vsup = isFn(voiceApi().isSupported) ? voiceApi().isSupported() : { stt: false, tts: false };

    function commit(next) {
      runRef.current = next;
      if (aliveRef.current) setRunState(next);
      return next;
    }

    useEffect(function () {
      aliveRef.current = true;
      return function () {
        aliveRef.current = false;
        if (isFn(voiceApi().stopSpeaking)) { try { voiceApi().stopSpeaking(); } catch (e) { /* noop */ } }
      };
    }, []);

    /* elapsed clock */
    useEffect(function () {
      var t0 = runRef.current.startedAt;
      var id = setInterval(function () {
        if (!aliveRef.current) return;
        var s = Math.floor((Date.now() - t0) / 1000);
        runRef.current.elapsedSec = s;
        setElapsed(s);
      }, 1000);
      return function () { clearInterval(id); };
    }, []);

    /* keep the transcript pinned to the newest turn */
    useEffect(function () {
      if (logRef.current) {
        try { logRef.current.scrollTop = logRef.current.scrollHeight; } catch (e) { /* noop */ }
      }
    }, [run.turns.length, busy]);

    /* ------------------------------------------------------------- speech */
    function speakTurn(turn) {
      if (!voiceOn || !vsup.tts || !isFn(voiceApi().speak)) return;
      var speak = voiceApi().speak;
      var jobs = [];
      if (turn.patientSpeech) {
        jobs.push(function () {
          return speak(turn.patientSpeech, { voice: SPEAKERS[turn.speaker] ? SPEAKERS[turn.speaker].voice : 'patient',
            rate: 0.95, pitch: 1.02, force: true });
        });
      } else if (turn.speaker !== 'instructor' && turn.narration) {
        jobs.push(function () {
          return speak(turn.narration, { voice: SPEAKERS[turn.speaker] ? SPEAKERS[turn.speaker].voice : 'nurse',
            rate: 1, pitch: 1, force: true });
        });
      }
      if (turn.feedbackOnLastAction) {
        jobs.push(function () {
          return speak(turn.feedbackOnLastAction, { voice: 'instructor', rate: 0.92, pitch: 0.96, force: true });
        });
      }
      var chain = Promise.resolve();
      jobs.forEach(function (j) {
        chain = chain.then(function () { return aliveRef.current ? j() : null; })['catch'](function () { return null; });
      });
    }

    /* --------------------------------------------------------- AI plumbing */

    function sendTurn(userContent, action, temperature) {
      var current = runRef.current;
      var msgs = arr(current.messages).concat([{ role: 'user', content: userContent }]);

      setBusy(true); setChars(0); setErr(null);

      retryRef.current = function () { sendTurn(userContent, action, temperature); };

      askTurn(current.system, msgs, temperature, function (chunk, full) {
        if (!aliveRef.current) return;
        setChars(str(full).length);
      }).then(function (res) {
        if (!aliveRef.current) return;
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
        setBusy(false);
        setDraft(''); setInterim('');
        setHint({ open: false, busy: false, text: '', tier: numOr(hint.tier, 0) });
        speakTurn(turn);

        if (next.phase === 'complete') {
          var done = finalizeRun(next, scenario);
          commit(done.run);
          if (isFn(p.onFinish)) p.onFinish(done);
        }
      }, function (e) {
        if (!aliveRef.current) return;
        setBusy(false);
        setErr({ code: (e && e.code) ? e.code : 'server', message: errText(e) });
      });
    }

    /* opening turn */
    useEffect(function () {
      if (startedRef.current) return;
      startedRef.current = true;
      sendTurn(openingUserMessage({ seed: runRef.current.seed, stability: runRef.current.stability }), null, 0.95);
    }, []);

    /* ------------------------------------------------------------ actions */

    function takeAction(text, mode) {
      var body = str(text).trim();
      if (!body || busy) return;

      /* free data checks never cost a turn and never cost points */
      if (mode !== 'choice' && RE_FREE_VITALS.test(body)) { showVitals(); return; }
      if (mode !== 'choice' && RE_FREE_CHART.test(body)) { setShowChart(true); creditChart('chart'); return; }

      var current = runRef.current;
      sendTurn(stateBlock(current, body, mode), { text: body, mode: mode }, 0.7);
    }

    function creditChart(tab) {
      var next = cloneRun(runRef.current);
      next.chartTabsViewed[tab] = true;
      commit(next);
    }

    function showVitals() {
      var v = runRef.current.vitals;
      var next = pushFreeNote(runRef.current, 'monitor',
        'You glance at the monitor and the flowsheet. Current set: ' + (vitalsLine(v) || 'no numbers charted yet') + '.',
        []);
      next.vitalsChecks = numOr(next.vitalsChecks, 0) + 1;
      next.chartTabsViewed.vitals = true;
      commit(next);
    }

    function openChart() {
      setShowChart(!showChart);
      if (!showChart) creditChart('chart');
    }

    function requestHint() {
      if (hint.busy || busy) return;
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
      var pr = isFn(ai.chat)
        ? ai.chat({ system: sys, messages: [{ role: 'user', content: msg }], maxTokens: 260, temperature: 0.5 })
        : Promise.reject({ code: 'ai-disabled' });

      pr.then(function (text) {
        if (!aliveRef.current) return;
        var body = str(text).trim() || (last && last.hint ? str(last.hint) : 'Go back to your ABCs and reassess.');
        applyHint(tier, body);
      }, function () {
        if (!aliveRef.current) return;
        var body = (last && last.hint) ? str(last.hint)
          : 'Go back to your ABCs. What is the single finding here that could kill this patient soonest?';
        applyHint(tier, body);
      });
    }

    function applyHint(tier, body) {
      var next = pushFreeNote(runRef.current, 'instructor', 'HINT (tier ' + tier + ', -' + HINT_COST + ' points): ' + body, []);
      next.hintsUsed = numOr(next.hintsUsed, 0) + 1;
      next.hintLog.push({ turn: next.turnCount, tier: tier, text: body });
      commit(next);
      setHint({ open: false, busy: false, text: body, tier: tier });
      if (voiceOn && vsup.tts && isFn(voiceApi().speak)) {
        try { voiceApi().speak(body, { voice: 'instructor', rate: 0.92, pitch: 0.96, force: true }); } catch (e) { /* noop */ }
      }
    }

    function toggleVoice() {
      var on = !voiceOn;
      if (on && isFn(voiceApi().prime)) { try { voiceApi().prime(); } catch (e) { /* noop */ } }
      if (!on && isFn(voiceApi().stopSpeaking)) { try { voiceApi().stopSpeaking(); } catch (e) { /* noop */ } }
      setVoiceOn(on);
      lsSet(LS_VOICE, on ? '1' : '0');
    }

    function changeMode(id) {
      setInputMode(id);
      lsSet(LS_INPUT_MODE, id);
    }

    /* ------------------------------------------------------------- handoff */

    function finishWithSbar(sbarResult) {
      var next = cloneRun(runRef.current);
      next.sbar = sbarResult || null;
      commit(next);
      var done = finalizeRun(next, scenario);
      commit(done.run);
      if (isFn(p.onFinish)) p.onFinish(done);
    }

    function submitTypedSbar() {
      var body = str(sbarText).trim();
      if (!body) return;
      setSbarBusy(true);
      var hs = handoffScenario(runRef.current, scenario);
      var ai = aiApi();
      var pr = isFn(ai.gradeSBAR) ? ai.gradeSBAR(hs, body) : Promise.reject(new Error('no grader'));
      Promise.resolve(pr).then(function (res) {
        if (!aliveRef.current) return;
        var r = obj(res);
        finishWithSbar({
          transcript: body, score: numOr(r.score, 0), maxScore: numOr(r.maxScore, 20),
          pct: numOr(r.pct, Math.round((numOr(r.score, 0) / 20) * 100)),
          breakdown: obj(r.breakdown), missing: arr(r.missing), feedback: str(r.feedback)
        });
      }, function () {
        if (!aliveRef.current) return;
        /* no grader: give partial credit for a substantive report rather than zero */
        var words = body.split(/\s+/).length;
        var pct = clamp(Math.round((words / 90) * 100), 10, 70);
        finishWithSbar({
          transcript: body, score: Math.round((pct / 100) * 20), maxScore: 20, pct: pct,
          breakdown: {}, missing: [],
          feedback: 'The AI grader was unavailable, so this report was credited on length and structure only. ' +
                    'Compare it against the reference SBAR in the debrief.'
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

    var strip = ce('div', { className: 'ais-strip z-' + stabZone, key: 'strip' }, [
      ce('div', { className: 'ais-strip-row', key: 'r1' }, [
        ce(StabilityMeter, {
          key: 's', stability: run.stability, trend: run.trend, delta: run.lastDelta
        }),
        ce('div', { className: 'ais-clock', key: 'c' }, [
          ce('b', { key: 'a' }, fmtClock(elapsed)),
          ce('span', { key: 'b' }, 'Turn ' + Math.max(1, run.turnCount) + ' of ' + TURN_CAP)
        ])
      ]),
      showEscalate
        ? ce('button', {
            key: 'esc', type: 'button', className: 'ais-escalate', disabled: busy,
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
        className: 'ais-mini', key: 'id', type: 'button', onClick: openChart,
        'aria-expanded': showChart ? 'true' : 'false'
      }, [str(chart.name) || 'Admitting patient...',
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

    var errorBox = err ? ce('div', { className: 'ais-note err', key: 'err', role: 'alert' }, [
      ce('div', { key: 'm', style: { marginBottom: '8px' } },
        str(err.message) + ' Your run is intact - nothing has been lost.'),
      ce('div', { className: 'ais-row', key: 'b' }, [
        ce('button', {
          key: 'r', type: 'button', className: 'btn btn-primary btn-sm',
          onClick: function () { if (isFn(retryRef.current)) retryRef.current(); }
        }, 'Retry this turn'),
        (err.code === 'quota-exceeded' || err.code === 'tier-denied' || err.code === 'no-auth')
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
              key: o.id, type: 'button', className: 'ais-opt', disabled: busy,
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
        key: 'ta', className: 'ais-ta', value: draft, disabled: busy,
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
          disabled: busy || !str(draft).trim(),
          onClick: function () { takeAction(draft, 'text'); }
        }, 'Take this action'),
        ce('span', { className: 'ais-lab', key: 'h' }, 'Ctrl+Enter also submits')
      ])
    ]);

    var VB = window.VoiceButton;
    var voiceUI = ce('div', { className: 'ais-col', key: 'voice' }, [
      (vsup.stt && isFn(VB))
        ? ce(VB, {
            key: 'vb', size: 'lg', continuous: false, disabled: busy,
            label: busy ? 'Working...' : 'Hold the mic and say your action',
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
      ce('button', { key: 'v', type: 'button', className: 'ais-mini', onClick: showVitals, disabled: busy },
        'What are my vitals again? (free)'),
      ce('button', { key: 'c', type: 'button', className: 'ais-mini' + (showChart ? ' on' : ''), onClick: openChart },
        showChart ? 'Hide the chart' : 'Show the chart (free)'),
      ce('button', {
        key: 'h', type: 'button', className: 'ais-mini', disabled: busy || hint.busy,
        title: 'Costs ' + HINT_COST + ' points',
        onClick: requestHint
      }, 'Ask for a hint (-' + HINT_COST + ' points, used ' + numOr(run.hintsUsed, 0) + ')'),
      ce('button', {
        key: 'm', type: 'button', className: 'ais-mini' + (voiceOn ? ' on' : ''),
        'aria-pressed': voiceOn ? 'true' : 'false', disabled: !vsup.tts, onClick: toggleVoice
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
          ? ce(SBARComp, {
              key: 'rec', scenario: hs,
              onComplete: function (res) { finishWithSbar(res); }
            })
          : ce('div', { className: 'ais-col', key: 'fallback' }, [
              ce('textarea', {
                key: 'ta', className: 'ais-ta', value: sbarText, disabled: sbarBusy,
                style: { minHeight: '140px' },
                'aria-label': 'Your SBAR report',
                placeholder: 'S: ...  B: ...  A: ...  R: ...',
                onChange: function (e) { setSbarText(e.target.value); }
              }),
              ce('button', {
                key: 'go', type: 'button', className: 'btn btn-primary',
                disabled: sbarBusy || !str(sbarText).trim(), onClick: submitTypedSbar
              }, sbarBusy ? 'Grading...' : 'Give report and finish')
            ]),
        ce('button', {
          key: 'skip', type: 'button', className: 'ais-mini',
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

    /* The options stay mounted while the model thinks - dimmed, not unmounted.
       Swapping them for a spinner reflows the page mid-read every turn. */
    var actionUI = (run.phase === 'handoff') ? handoffUI
      : ce('div', { className: 'ais-act' + (busy ? ' busy' : ''), key: 'act' }, [
          busy ? ce(Thinking, { key: 'think', chars: chars,
            label: run.turnCount === 0 ? 'Admitting your patient...' : 'The scenario is responding...' }) : null,
          hintUI,
          (inputMode === 'choice') ? choiceUI : null,
          (inputMode === 'text') ? textUI : null,
          (inputMode === 'voice') ? voiceUI : null,
          ce('div', { className: 'ais-col', key: 'seg', style: { gap: '4px' } }, [
            ce(Segmented, {
              key: 's', label: 'Input mode', value: inputMode,
              items: INPUT_MODES.map(function (m) {
                return { id: m.id, label: m.label, hint: m.hint, disabled: m.id === 'voice' && !vsup.stt };
              }),
              onChange: changeMode
            }),
            ce('span', { className: 'ais-sub', key: 'h' },
              modeHint + ' You can switch at any point without losing what you have typed.')
          ]),
          freeRow
        ]);

    return ce('div', { className: 'ais-wrap' }, [
      strip,
      errorBox,
      chartDrawer,
      transcript,
      actionUI,
      ce('div', { className: 'ais-row', key: 'foot', style: { justifyContent: 'space-between' } }, [
        ce('span', { className: 'ais-lab', key: 'l' },
          str(run.difficultyId) + ' · hints ' + numOr(run.hintsUsed, 0)),
        ce('button', {
          key: 'q', type: 'button', className: 'ais-mini',
          onClick: function () {
            if (isFn(voiceApi().stopSpeaking)) { try { voiceApi().stopSpeaking(); } catch (e) { /* noop */ } }
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
  AIScenarioMode.MIN_TURNS_FOR_OUTCOME = MIN_TURNS_FOR_OUTCOME;
  AIScenarioMode.HINT_COST = HINT_COST;

  window.AIScenarioMode = AIScenarioMode;
  window.AIScenarioSetup = SetupScreen;
  window.AIScenarioRun = RunScreen;
  window.AIScenarioDebrief = DebriefScreen;
})();
