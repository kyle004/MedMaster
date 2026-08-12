/* =============================================================================
 * MedMaster :: js/codeblue.js
 * CODE BLUE TEAM  ->  window.CodeBlueMode
 * -----------------------------------------------------------------------------
 * A real-time, multi-student mock cardiac arrest. Two to six students in the
 * same study group each hold a code role, one patient arrests, and the team
 * runs the resuscitation together against a live rhythm and a 2:00 cycle clock.
 *
 * DESIGN RULE #1 - THE APP OWNS THE CODE. The rhythm, the clock, the odds and
 * the score are a deterministic, seeded state machine that lives in this file.
 * The AI narrates beats and writes the debrief. If the AI is unavailable the
 * whole code still runs, start to finish, on canned narration.
 *
 * DESIGN RULE #2 - THE HOST IS AUTHORITATIVE. One client (the host) runs the
 * engine on a 1s tick and writes /codeblue/rooms/<id>/state. Everyone else
 * renders from that snapshot and submits actions as write-once events under
 * /events, which the host consumes in push-key order. If the host's heartbeat
 * goes stale for 10s the longest-tenured connected player self-promotes with a
 * write-if-unchanged transaction on hostId.
 *
 * DESIGN RULE #3 - NEVER ACCUMULATE A TIMER. Every clock in this file is
 * derived from timestamps in state (cycleStartedAt, lastEpiAt, startedAt), so a
 * backgrounded tab, a refresh, or a slow phone can never desynchronise them.
 * setInterval only asks "what time is it now?".
 *
 * DESIGN RULE #4 - SOBER ON DEATH. Teaching first, score second. The word
 * "lose" never appears next to a patient who died.
 *
 * Contract: IIFE, no JSX, no ES modules, no optional chaining, no ??,
 * window export, CSS variables with fallbacks, legible at 360px,
 * honours prefers-reduced-motion.
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
  function cut(v, n) {
    var t = str(v);
    if (t.length <= n) return t;
    var head = t.slice(0, n - 1);
    var trimmed = head.replace(/\s+\S*$/, '');
    return (trimmed.length > n * 0.6 ? trimmed : head) + '…';
  }
  function MMx() { return window.MM || {}; }
  function aiApi() { return obj(MMx().ai); }
  function nowMs() { return Date.now(); }
  function keys(o) {
    var out = [], k, s = obj(o);
    for (k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) out.push(k); }
    return out;
  }
  function shallow(o) {
    var out = {}, k, s = obj(o);
    for (k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) out[k] = s[k]; }
    return out;
  }
  /* Structured clone without the modern API. Only ever used on engine state,
     which is plain JSON by construction (it has to be - it goes to RTDB). */
  function deepCopy(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) {
      var a = [], i;
      for (i = 0; i < v.length; i++) a.push(deepCopy(v[i]));
      return a;
    }
    var o = {}, k;
    for (k in v) { if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = deepCopy(v[k]); }
    return o;
  }
  /* RTDB silently deletes keys whose value is undefined and rejects the write
     when a value is NaN or Infinity. Both used to happen here: an unset
     lastEpiAt came back as undefined, and one divide-by-zero in a metric wrote
     NaN and killed the whole state write for every player at once. */
  function scrub(v) {
    if (v === null) return null;
    var t = typeof v;
    if (t === 'number') return isFinite(v) ? v : 0;
    if (t === 'string' || t === 'boolean') return v;
    if (t === 'undefined' || t === 'function') return null;
    if (Array.isArray(v)) {
      var a = [], i;
      for (i = 0; i < v.length; i++) a.push(scrub(v[i]));
      return a;
    }
    var o = {}, k, s;
    for (k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      s = scrub(v[k]);
      if (s === null && v[k] === undefined) continue;
      o[k] = s;
    }
    return o;
  }
  function fmtClock(ms) {
    var s = Math.max(0, Math.round(numOr(ms, 0) / 1000));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function fmtSec(ms) {
    var s = Math.max(0, numOr(ms, 0) / 1000);
    return (s < 10 ? s.toFixed(1) : String(Math.round(s))) + 's';
  }
  function pct(n) { return Math.round(clamp(numOr(n, 0), 0, 1) * 100) + '%'; }

  function reducedMotion() {
    try {
      if (!window.matchMedia) return false;
      var m = window.matchMedia('(prefers-reduced-motion: reduce)');
      return !!(m && m.matches);
    } catch (e) { return false; }
  }

  function useReducedMotion() {
    var h = useState(reducedMotion);
    var on = h[0], set = h[1];
    useEffect(function () {
      var m;
      try { m = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null; }
      catch (e) { m = null; }
      if (!m) return undefined;
      var fn = function () { set(!!m.matches); };
      if (isFn(m.addEventListener)) { m.addEventListener('change', fn); return function () { m.removeEventListener('change', fn); }; }
      if (isFn(m.addListener)) { m.addListener(fn); return function () { m.removeListener(fn); }; }
      return undefined;
    }, []);
    return on;
  }

  /** A clock that ticks the component, never a timer that accumulates state. */
  function useNow(everyMs) {
    var h = useState(nowMs);
    var t = h[0], set = h[1];
    useEffect(function () {
      var iv = setInterval(function () { set(nowMs()); }, numOr(everyMs, 500));
      var vis = function () { set(nowMs()); };
      try { document.addEventListener('visibilitychange', vis); } catch (e) {}
      try { window.addEventListener('focus', vis); } catch (e) {}
      return function () {
        clearInterval(iv);
        try { document.removeEventListener('visibilitychange', vis); } catch (e) {}
        try { window.removeEventListener('focus', vis); } catch (e) {}
      };
    }, [everyMs]);
    return t;
  }

  /* ==========================================================================
   * 1. CONSTANTS
   * ======================================================================== */

  var CYCLE_MS      = 120000;  // 2:00 between rhythm checks
  var CHECK_MS      = 12000;   // how long the rhythm-check pause may last
  var TICK_MS       = 1000;    // host engine tick
  var CPR_FRESH_MS  = 2600;    // a compression sample older than this = hands off
  var CPR_LOW       = 100, CPR_HIGH = 120;
  var VENT_TARGET   = 10;      // breaths/min with an advanced airway
  var EPI_MIN_MS    = 180000;  // 3 min
  var EPI_MAX_MS    = 300000;  // 5 min
  var HOST_GRACE_MS = 10000;   // host heartbeat stale -> promote
  var REJOIN_MS     = 60000;   // a refreshing player keeps their role this long
  var PRESENCE_MS   = 3000;    // how often each client stamps lastSeen
  var LOG_CAP       = 90;
  var MAX_CYCLES    = 10;      // ten 2-minute cycles plus their checks: 22 minutes, then the engine calls it
  var SWITCH_OK_MS  = 95000;   // switching after this into a cycle is "on prompt"
  var LOOP_ACK_MS   = 12000;   // acknowledge an order inside this to close the loop
  var CLEAR_WINDOW  = 6000;    // "clear!" must precede the shock by <= this
  var RECORDER_MS   = 20000;   // recorder has this long to timestamp a beat
  var ROOM_STALE_MS = 45 * 60 * 1000;

  var DIFFS = [
    { id: 'student',   label: 'Student',   base: 0.13, shockGain: 0.36, htGain: 0.34, drift: 0.22,
      blurb: 'Forgiving. Good CPR converts sooner and the rhythm decays slowly.' },
    { id: 'competent', label: 'Competent', base: 0.09, shockGain: 0.29, htGain: 0.28, drift: 0.34,
      blurb: 'Realistic. You need high-quality CPR, timely shocks and the right cause.' },
    { id: 'challenge', label: 'Challenge', base: 0.06, shockGain: 0.22, htGain: 0.24, drift: 0.46,
      blurb: 'Unforgiving. Fine VF fades to asystole, and nothing forgives a low compression fraction.' }
  ];
  function diffOf(id) {
    for (var i = 0; i < DIFFS.length; i++) { if (DIFFS[i].id === id) return DIFFS[i]; }
    return DIFFS[1];
  }

  var RHYTHMS = {
    vf:       { id: 'vf',       label: 'Ventricular fibrillation', short: 'VF',      shockable: true,  pulse: false,
                mon: 'Coarse ventricular fibrillation. No pulse.' },
    vf_fine:  { id: 'vf_fine',  label: 'Fine ventricular fibrillation', short: 'Fine VF', shockable: true, pulse: false,
                mon: 'Fine ventricular fibrillation. No pulse.' },
    pvt:      { id: 'pvt',      label: 'Pulseless ventricular tachycardia', short: 'pVT', shockable: true, pulse: false,
                mon: 'Wide monomorphic VT. No pulse.' },
    vt_pulse: { id: 'vt_pulse', label: 'Ventricular tachycardia with a pulse', short: 'VT + pulse', shockable: false, pulse: true,
                mon: 'Monomorphic VT at 186. Thready carotid pulse.' },
    pea:      { id: 'pea',      label: 'Pulseless electrical activity', short: 'PEA', shockable: false, pulse: false,
                mon: 'Organised narrow rhythm on the monitor. NO pulse.' },
    asystole: { id: 'asystole', label: 'Asystole', short: 'Asystole', shockable: false, pulse: false,
                mon: 'Asystole. Confirmed flat in two leads.' },
    brady:    { id: 'brady',    label: 'Severe bradycardia', short: 'Brady', shockable: false, pulse: true,
                mon: 'Sinus bradycardia at 38. Central pulse present, poorly perfusing.' },
    sinus:    { id: 'sinus',    label: 'Sinus rhythm with a pulse', short: 'ROSC', shockable: false, pulse: true,
                mon: 'Sinus rhythm. Carotid pulse palpable. Return of spontaneous circulation.' }
  };
  function rhy(id) { return RHYTHMS[str(id)] || RHYTHMS.asystole; }
  function isShockable(id) { return !!rhy(id).shockable; }

  /* The H's and T's, in the order every student learns them. `id` is stable and
     is what gets scored; `label` is what the button says. */
  var HT_LIST = [
    { id: 'hypovolemia',  label: 'Hypovolemia',                 tx: 'Rapid volume - two large-bore lines, warmed fluid, blood on the way' },
    { id: 'hypoxia',      label: 'Hypoxia',                     tx: 'Airway and oxygenation - confirm placement, 100% O2, chest rise' },
    { id: 'hydrogen',     label: 'Hydrogen ion (acidosis)',     tx: 'Ventilate, and bicarbonate if the gas supports it' },
    { id: 'hypokalemia',  label: 'Hypo- / hyperkalemia',        tx: 'Correct the potassium - replace it, or calcium + insulin/dextrose' },
    { id: 'hypothermia',  label: 'Hypothermia',                 tx: 'Active rewarming - warm fluids, forced-air, remove wet clothing' },
    { id: 'tension',      label: 'Tension pneumothorax',        tx: 'Needle decompression, second intercostal space, midclavicular' },
    { id: 'tamponade',    label: 'Cardiac tamponade',           tx: 'Pericardiocentesis, bedside ultrasound to guide it' },
    { id: 'toxins',       label: 'Toxins',                      tx: 'Antidote for the agent - naloxone, bicarbonate, lipid emulsion' },
    { id: 'thrombosis_p', label: 'Thrombosis - pulmonary (PE)', tx: 'Thrombolytics, and prolonged CPR after you give them' },
    { id: 'thrombosis_c', label: 'Thrombosis - coronary (MI)',  tx: 'Cath lab activated - shock, drug and transport for PCI' }
  ];
  function htLabel(id) {
    for (var i = 0; i < HT_LIST.length; i++) { if (HT_LIST[i].id === id) return HT_LIST[i].label; }
    return 'Unknown';
  }
  function htTx(id) {
    for (var i = 0; i < HT_LIST.length; i++) { if (HT_LIST[i].id === id) return HT_LIST[i].tx; }
    return '';
  }

  /* ==========================================================================
   * 2. THE FIVE CASES
   * Each one is a paragraph of lead-in, an initial rhythm, an underlying cause,
   * and the H&T answer the Team Lead has to land on.
   * ======================================================================== */

  var CASES = [
    {
      id: 'vf-mi',
      title: 'VF arrest after an anterior MI',
      short: 'VF / post-MI',
      icon: '💔',
      patient: 'Ray Delgado, 58',
      category: 'Cardiac',
      lead: 'Ray Delgado is 58, day one on your telemetry unit after an anterior STEMI treated with a drug-eluting ' +
            'stent. He has been chatty all shift. At 0412 the monitor tech calls out, and by the time you reach the ' +
            'doorway he is slumped over the bedside table, grey, not responding to his name. The monitor above the ' +
            'bed is a chaotic scribble. You feel for a carotid pulse for ten seconds and there is nothing.',
      initialRhythm: 'vf',
      cause: 'thrombosis_c',
      causeHint: 'Fresh stent, anterior territory, and the arrest came out of a chest pain complaint.',
      epiMg: 1, epiText: '1 mg IV push',
      pedi: false,
      handoff: 'the cardiology fellow'
    },
    {
      id: 'pea-gi',
      title: 'PEA arrest from hypovolemia, upper GI bleed',
      short: 'PEA / GI bleed',
      icon: '🩸',
      patient: 'Marlene Okonjo, 71',
      category: 'Medical-Surgical',
      lead: 'Marlene Okonjo is 71, admitted last night with coffee-ground emesis and a hemoglobin of 6.4. She has had ' +
            'two black stools this shift and her blood has been "on the way" from the lab for forty minutes. Her ' +
            'pressure was 84/50 an hour ago and you flagged it. Now the tech calls you in: she is unresponsive, ' +
            'skin cold and mottled to the knees. The monitor shows a narrow, organised rhythm at 96. You cannot ' +
            'find a carotid pulse, and neither can the nurse beside you.',
      initialRhythm: 'pea',
      cause: 'hypovolemia',
      causeHint: 'A narrow, fast, organised rhythm with an empty tank is hypovolemia until proven otherwise.',
      epiMg: 1, epiText: '1 mg IV push',
      pedi: false,
      handoff: 'the intensivist'
    },
    {
      id: 'asystole-down',
      title: 'Asystole, found down and unwitnessed',
      short: 'Asystole / found down',
      icon: '⚖️',
      patient: 'Unidentified male, ~60',
      category: 'Emergency',
      lead: 'Environmental services found him on the floor of a stairwell off the east lobby. Nobody knows how long ' +
            'he was there. He is cool to the touch but not cold, cyanotic around the lips, with vomit on his shirt ' +
            'and no signs of injury. The first responders started compressions in the stairwell and rolled him into ' +
            'the ED bay two minutes ago. The monitor is flat. This one is going to be about doing it well rather ' +
            'than doing it fast, and about knowing when enough is enough.',
      initialRhythm: 'asystole',
      cause: 'hypoxia',
      causeHint: 'Vomit on his shirt, cyanosis, unwitnessed and down for an unknown time - think airway first.',
      epiMg: 1, epiText: '1 mg IV push',
      pedi: false,
      allowTermination: true,
      handoff: 'the ED attending'
    },
    {
      id: 'vt-deteriorating',
      title: 'VT with a pulse, deteriorating',
      short: 'VT with a pulse',
      icon: '⚡',
      patient: 'Bea Hollins, 66',
      category: 'Cardiac',
      lead: 'Bea Hollins is 66, three days into a heart failure exacerbation and briskly diuresed - 4.2 litres off ' +
            'since admission. Her potassium this morning was 2.9 and the replacement is still sitting in the ' +
            'pyxis queue. She presses the call light and says the room is swimming. Her monitor shows a wide, ' +
            'regular complex at 186. She is awake, but grey, diaphoretic, and her radial pulse is a thread. ' +
            'She has a pulse right now. She will not keep it for long.',
      initialRhythm: 'vt_pulse',
      cause: 'hypokalemia',
      causeHint: 'Aggressive diuresis, a potassium of 2.9, and a wide complex tachycardia. Replace the potassium.',
      epiMg: 1, epiText: '1 mg IV push',
      pedi: false,
      prearrest: true,
      handoff: 'the cardiology fellow'
    },
    {
      id: 'peds-resp',
      title: 'Pediatric respiratory arrest to bradycardia to arrest',
      short: 'Pediatric arrest',
      icon: '🧸',
      patient: 'Tobias Reed, 3 years, 14 kg',
      category: 'Pediatrics',
      lead: 'Tobias Reed is three years old, 14 kilograms, admitted overnight with RSV bronchiolitis. He has been ' +
            'working hard all shift - flaring, subcostal retractions, and for the last twenty minutes an ominous ' +
            'quiet. His mother is at the bedside and says "he stopped fighting me." His chest is barely moving, ' +
            'his lips are dusky, and the monitor reads 44 and falling. In a child this is not a cardiac arrest ' +
            'that happened to involve the lungs. It is a respiratory arrest that is about to become a cardiac one.',
      initialRhythm: 'brady',
      cause: 'hypoxia',
      causeHint: 'Children arrest from their lungs. Oxygenate and ventilate before you reach for anything else.',
      epiMg: 0.14, epiText: '0.14 mg (0.01 mg/kg) IV push',
      pedi: true, weightKg: 14,
      prearrest: true,
      handoff: 'the PICU attending'
    }
  ];
  function caseById(id) {
    for (var i = 0; i < CASES.length; i++) { if (CASES[i].id === id) return CASES[i]; }
    return CASES[0];
  }

  /* Dose pickers. The distractors are the ones that actually get chosen on a
     ward: the cardiac-arrest dose confused with the anaphylaxis dose, the
     infusion concentration read as the bolus, the adult dose given to a child. */
  function epiOptions(c) {
    if (c.pedi) {
      return [
        { id: 'a', text: '0.14 mg (0.01 mg/kg of 0.1 mg/mL) IV push', ok: true },
        { id: 'b', text: '1 mg (1 mL of 1 mg/mL) IV push', ok: false, why: 'That is the adult arrest dose - roughly seven times what Tobias should get.' },
        { id: 'c', text: '0.014 mg IV push', ok: false, why: 'A decimal place low. 0.01 mg/kg of 14 kg is 0.14 mg.' },
        { id: 'd', text: '0.14 mg IM in the lateral thigh', ok: false, why: 'Right dose, wrong route. In an arrest with IV/IO access, epinephrine goes IV or IO.' }
      ];
    }
    return [
      { id: 'a', text: '1 mg (10 mL of 1:10,000) IV push, then 20 mL flush', ok: true },
      { id: 'b', text: '0.3 mg IM in the lateral thigh', ok: false, why: 'That is the anaphylaxis dose and route. Arrest epinephrine is 1 mg IV push.' },
      { id: 'c', text: '1 mg of 1:1,000 IV push undiluted', ok: false, why: 'Wrong concentration. 1:1,000 is the IM ampoule; arrest uses 1:10,000, 10 mL.' },
      { id: 'd', text: '10 mg IV push', ok: false, why: 'Ten times the dose. This is the classic decimal error and it is fatal.' }
    ];
  }
  function amioOptions(c, given) {
    if (c.pedi) {
      return [
        { id: 'a', text: '70 mg (5 mg/kg) amiodarone IV bolus', ok: true },
        { id: 'b', text: '300 mg amiodarone IV push', ok: false, why: 'Adult dose. Pediatric amiodarone in arrest is 5 mg/kg.' },
        { id: 'c', text: '70 mg amiodarone over 20 minutes', ok: false, why: 'In arrest it is a bolus. The slow infusion is for the perfusing rhythm.' }
      ];
    }
    if (given >= 1) {
      return [
        { id: 'a', text: '150 mg amiodarone IV push (second dose)', ok: true },
        { id: 'b', text: '300 mg amiodarone IV push (second dose)', ok: false, why: 'The second amiodarone dose is 150 mg. 300 mg is the first.' },
        { id: 'c', text: '1 mg epinephrine instead', ok: false, why: 'Epinephrine is on its own 3-5 minute clock. This beat calls for the antiarrhythmic.' }
      ];
    }
    return [
      { id: 'a', text: '300 mg amiodarone IV push (first dose)', ok: true },
      { id: 'b', text: '150 mg amiodarone IV push (first dose)', ok: false, why: '150 mg is the SECOND dose. The first is 300 mg.' },
      { id: 'c', text: '1 g magnesium IV push', ok: false, why: 'Magnesium is for torsades, not for refractory monomorphic VF.' }
    ];
  }

  /* ==========================================================================
   * 3. ROLES AND THE COLLAPSE MAPPING
   * Six roles at a full team. Below six they collapse into slots, always in the
   * same documented order, so a student who has played a 6-person code knows
   * exactly what a 3-person code asked of them.
   *
   *   6 | Lead | Compressions | Airway | Meds/IV | Defib | Recorder
   *   5 | Lead + Recorder | Compressions | Airway | Meds/IV | Defib
   *   4 | Lead + Recorder | Compressions | Airway | Meds/IV + Defib
   *   3 | Lead + Recorder | Compressions + Airway | Meds/IV + Defib
   *   2 | Lead + Recorder + Meds/IV + Defib | Compressions + Airway
   *
   * The rule: the Recorder folds into the Lead first (they are both cognitive
   * and both at the foot of the bed), then Defib folds into Meds (both are at
   * the cart), then Airway folds into Compressions (both are hands-on BLS), and
   * only in a pair does the Lead pick up the cart.
   * ======================================================================== */

  var ROLES = [
    { id: 'lead',         label: 'Team Lead',    icon: '🧭', color: 'var(--accent,#3b82f6)',
      blurb: 'Stands at the foot of the bed and touches nobody. Orders rhythm checks, runs the H&T review, and decides when the code ends.' },
    { id: 'compressions', label: 'Compressions', icon: '🫀', color: 'var(--red,#ef4444)',
      blurb: 'Pushes hard and fast, 100-120 a minute, and calls for the switch before the quality falls off.' },
    { id: 'airway',       label: 'Airway',       icon: '💨', color: 'var(--accent2,#8b5cf6)',
      blurb: 'Bag-mask, adjunct, oxygen. Ten breaths a minute once there is an advanced airway - no faster.' },
    { id: 'meds',         label: 'Meds / IV',    icon: '💉', color: 'var(--green,#22c55e)',
      blurb: 'Gets access, draws the drug, states the dose out loud, pushes and flushes.' },
    { id: 'defib',        label: 'Defib / Monitor', icon: '⚡', color: 'var(--orange,#f59e0b)',
      blurb: 'Owns the pads and the joules. Charges, clears everyone off the patient, and shocks only a shockable rhythm.' },
    { id: 'recorder',     label: 'Recorder',     icon: '📋', color: 'var(--text2,#94a3b8)',
      blurb: 'The timeline of the code. Timestamps every drug and every shock, and answers when the lead asks what time the last epi went in.' }
  ];
  function roleMeta(id) {
    for (var i = 0; i < ROLES.length; i++) { if (ROLES[i].id === id) return ROLES[i]; }
    return ROLES[0];
  }

  var SLOTS = {
    6: [['lead'], ['compressions'], ['airway'], ['meds'], ['defib'], ['recorder']],
    5: [['lead', 'recorder'], ['compressions'], ['airway'], ['meds'], ['defib']],
    4: [['lead', 'recorder'], ['compressions'], ['airway'], ['meds', 'defib']],
    3: [['lead', 'recorder'], ['compressions', 'airway'], ['meds', 'defib']],
    2: [['lead', 'recorder', 'meds', 'defib'], ['compressions', 'airway']]
  };
  function slotsFor(n) {
    var t = clamp(Math.round(numOr(n, 4)), 2, 6);
    return SLOTS[t] || SLOTS[4];
  }
  function slotLabel(slot) {
    return arr(slot).map(function (r) { return roleMeta(r).label; }).join(' + ');
  }
  function slotIndexOfRole(teamSize, roleId) {
    var s = slotsFor(teamSize), i;
    for (i = 0; i < s.length; i++) { if (s[i].indexOf(roleId) !== -1) return i; }
    return 0;
  }

  /* ==========================================================================
   * 4. SEEDED RANDOMNESS
   * The same seed and the same actions always give the same code. That is what
   * makes a debrief argument settleable: "we did get unlucky" is checkable.
   * ======================================================================== */

  function hashSeed(s) {
    var h = 2166136261, i, t = str(s);
    for (i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Draw the next deterministic number and advance the cursor stored in state. */
  function roll(st) {
    var n = numOr(st.rngN, 0);
    st.rngN = n + 1;
    return mulberry(hashSeed(str(st.seed) + ':' + n))();
  }

  /* ==========================================================================
   * 5. THE MONITOR - SVG ECG WAVEFORMS
   * One tile of waveform is generated as a polyline and rendered twice, side by
   * side, inside a <g> that slides left by exactly one tile width and repeats.
   * That is a pure CSS transform loop: no rAF, no per-frame React work, and it
   * costs nothing when the tab is hidden. Under prefers-reduced-motion the
   * animation is off and the strip is a static, labelled trace.
   *
   * The waveforms are hand-authored to be *recognisable*, not to be a
   * physiologically accurate ECG. A student should be able to glance at the
   * strip and say "that is VF" - and, in the PEA case, should NOT be able to,
   * because the whole point of PEA is that the monitor looks fine.
   * ======================================================================== */

  var TILE_W = 300;   // viewBox units for one repeat
  var TILE_H = 64;
  var MID = 32;

  /* Deterministic value noise. Same x always gives the same y, so the trace
     never shimmers between renders and two clients draw the same picture. */
  function pn(i) {
    var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function ptsToStr(pts) {
    var out = [], i;
    for (i = 0; i < pts.length; i++) {
      out.push((Math.round(pts[i][0] * 100) / 100) + ',' + (Math.round(pts[i][1] * 100) / 100));
    }
    return out.join(' ');
  }

  /** A single P-QRS-T at x0 over `bw` units. `sc` scales amplitude, `wide` widens QRS. */
  function complexAt(pts, x0, bw, sc, wide, withP) {
    var q = wide ? 0.20 : 0.10;
    function at(f, y) { pts.push([x0 + bw * f, MID - y * sc]); }
    at(0.00, 0);
    if (withP) { at(0.14, 3.2); at(0.20, 4.4); at(0.26, 3.0); }
    at(0.34, 0);
    at(0.40, -3);                       // Q
    at(0.40 + q * 0.35, 22);            // R
    at(0.40 + q * 0.80, -8);            // S
    at(0.40 + q + 0.04, 0);
    at(0.66, 5.0);                      // T
    at(0.74, 6.4);
    at(0.84, 0.6);
    at(1.00, 0);
  }

  function buildTrace(kind) {
    var pts = [], i, x, y;
    if (kind === 'vf' || kind === 'vf_fine') {
      var amp = (kind === 'vf') ? 15 : 5.5;
      for (i = 0; i <= 150; i++) {
        x = i * (TILE_W / 150);
        /* Three incommensurate sines plus value noise: chaotic, never repeats
           inside a tile, and joins itself cleanly at the tile seam because the
           frequencies are whole multiples of the tile. */
        y = Math.sin(i * 0.44) * 0.55 + Math.sin(i * 0.19 + 1.3) * 0.35 +
            Math.sin(i * 0.97 + 2.1) * 0.28 + (pn(i) - 0.5) * 0.7;
        pts.push([x, MID - y * amp]);
      }
      return { points: ptsToStr(pts), label: (kind === 'vf' ? 'COARSE VF' : 'FINE VF'), rate: '', danger: true };
    }
    if (kind === 'pvt') {
      for (i = 0; i <= 150; i++) {
        x = i * (TILE_W / 150);
        y = Math.sin(i * 0.30) * 18 + Math.sin(i * 0.60) * 2.5;
        pts.push([x, MID - y]);
      }
      return { points: ptsToStr(pts), label: 'PULSELESS VT', rate: '', danger: true };
    }
    if (kind === 'vt_pulse') {
      for (i = 0; i <= 150; i++) {
        x = i * (TILE_W / 150);
        y = Math.sin(i * 0.34) * 16 + Math.sin(i * 0.68 + 0.6) * 3;
        pts.push([x, MID - y]);
      }
      return { points: ptsToStr(pts), label: 'VT', rate: '186', danger: true };
    }
    if (kind === 'asystole') {
      for (i = 0; i <= 100; i++) {
        x = i * (TILE_W / 100);
        /* Not a ruler-flat line. Real asystole wanders with the patient's chest
           and the lead wire, and a perfectly flat trace teaches students to
           look for something that never happens. */
        y = Math.sin(i * 0.055) * 1.6 + (pn(i * 3) - 0.5) * 0.9;
        pts.push([x, MID - y]);
      }
      return { points: ptsToStr(pts), label: 'ASYSTOLE', rate: '0', danger: true };
    }
    if (kind === 'pea') {
      pts.push([0, MID]);
      for (i = 0; i < 3; i++) complexAt(pts, i * 100, 100, 0.72, true, true);
      pts.push([TILE_W, MID]);
      return { points: ptsToStr(pts), label: 'PEA - NO PULSE', rate: '96', danger: true, organized: true };
    }
    if (kind === 'brady') {
      /* One complex a tile, and the long flat stretch between them sampled
         rather than drawn as a single segment - a bradycardic baseline is where
         a student should be able to see the wander and the artefact. */
      for (i = 0; i <= 20; i++) pts.push([i, MID - Math.sin(i * 0.4) * 0.5]);
      complexAt(pts, 20, 130, 0.95, false, true);
      for (i = 150; i <= TILE_W; i += 6) pts.push([i, MID - Math.sin(i * 0.08) * 0.7]);
      return { points: ptsToStr(pts), label: 'BRADYCARDIA', rate: '38', danger: true };
    }
    /* sinus / ROSC */
    pts.push([0, MID]);
    for (i = 0; i < 4; i++) complexAt(pts, i * 75, 75, 1, false, true);
    pts.push([TILE_W, MID]);
    return { points: ptsToStr(pts), label: 'SINUS RHYTHM', rate: '92', danger: false };
  }

  var TRACE_CACHE = {};
  function traceFor(kind) {
    var k = str(kind) || 'asystole';
    if (!TRACE_CACHE[k]) TRACE_CACHE[k] = buildTrace(k);
    return TRACE_CACHE[k];
  }

  function EcgStrip(props) {
    var p = obj(props);
    var reduce = !!p.reduced;
    var t = traceFor(p.rhythm);
    var speed = (p.rhythm === 'vf' || p.rhythm === 'pvt' || p.rhythm === 'vt_pulse') ? '1.6s'
              : (p.rhythm === 'brady') ? '4.2s' : '2.6s';
    var stroke = t.danger ? 'var(--red,#ef4444)' : 'var(--green,#22c55e)';
    if (p.rhythm === 'pea') stroke = 'var(--orange,#f59e0b)';

    var poly = function (dx, key) {
      return ce('polyline', {
        key: key, points: t.points, fill: 'none', stroke: stroke,
        strokeWidth: '1.8', strokeLinejoin: 'round', strokeLinecap: 'round',
        transform: dx ? ('translate(' + dx + ',0)') : null
      });
    };

    return ce('div', { className: 'cb-ecg' + (reduce ? ' cb-ecg-static' : ''), 'aria-hidden': 'true' },
      ce('svg', {
        viewBox: '0 0 ' + TILE_W + ' ' + TILE_H, preserveAspectRatio: 'none',
        className: 'cb-ecg-svg', role: 'img'
      },
        ce('g', {
          className: reduce ? 'cb-ecg-g' : 'cb-ecg-g cb-ecg-run',
          style: reduce ? null : { animationDuration: speed }
        }, [poly(0, 'a'), poly(TILE_W, 'b')])
      )
    );
  }

  /* ==========================================================================
   * 6. THE ENGINE
   * Pure functions over a plain-JSON state object. createState / applyEvent /
   * tick are the whole contract. The host wraps them in a 1s loop and an RTDB
   * write; solo practice wraps them in React state. Nothing in here touches
   * the DOM, Firebase, or the clock - `now` is always a parameter.
   * ======================================================================== */

  function blankScore() {
    return {
      pts: 0, good: [], errors: [], major: 0, minor: 0, actions: 0,
      lastFaultText: '', lastFaultAt: 0,
      ordered: 0, acked: 0, reported: 0, ackLate: 0,
      compressMs: 0, compressBandMs: 0, switches: 0,
      logConfirmed: 0, logMissed: 0, quizRight: 0, quizWrong: 0
    };
  }

  function createState(cfg) {
    var c = obj(cfg);
    var kase = caseById(c.caseId);
    var st = {
      v: 1,
      caseId: kase.id,
      difficulty: str(c.difficulty) || 'competent',
      roleMode: (c.roleMode === 'leader') ? 'leader' : 'assigned',
      teamSize: clamp(Math.round(numOr(c.teamSize, 4)), 2, 6),
      solo: !!c.solo,
      seed: str(c.seed) || ('s' + kase.id),
      rngN: 0,

      phase: 'briefing',      // briefing -> running <-> check -> ended
      startedAt: 0,
      tickAt: 0,
      hostBeat: 0,
      rev: 0,

      rhythm: kase.initialRhythm,
      arrested: !kase.prearrest,
      /* Two of the five cases start with a pulse. Everything that is timed
         against "the arrest" - first compression, compression fraction - has to
         be timed from the moment the pulse went away, not from the moment the
         team was called. Timing a pre-arrest case from the call scored a team
         that correctly did NOT compress a perfusing patient as if they had
         stood and watched one die. */
      arrestAt: 0,
      cycle: 1,
      cycleStartedAt: 0,
      checkStartedAt: 0,
      checkAnnounced: '',

      cprMs: 0, cprBandMs: 0, cycleCprMs: 0, cprOn: false, cprRate: 0,
      lastSwitchAt: 0, switches: 0, switchPrompted: false,
      ventCount: 0, ventLastAt: 0, ventRate: 0,

      shocks: 0, lastShockAt: 0, shockThisCycle: false, joules: 200,
      chargedAt: 0, clearedAt: 0,

      epi: 0, lastEpiAt: 0, epiTimes: [],
      amio: 0, otherDrugs: [],

      iv: false, ivAt: 0, airway: 'none', airwayAt: 0, o2: false,

      wrongShocks: 0, unsafeShocks: 0,
      htGuess: '', htCorrect: false, htTreatedAt: 0, htAttempts: 0,
      pulseChecks: 0, rhythmChecksOrdered: 0,

      roles: {},
      order: null,
      orderSeq: 0,
      pendingLog: null,
      quiz: null,

      log: [],
      scores: {},
      metrics: { firstCompressionAt: 0, firstShockAt: 0, firstEpiAt: 0, firstAirwayAt: 0, firstIvAt: 0 },

      outcome: null, endedAt: 0, terminationAppropriate: false,
      narration: null, beat: 0, lastBeatKind: '',
      lastEventKey: ''
    };
    return st;
  }

  /* ------------------------------------------------------------------ log */

  var DEDUPE_MS = 12000;

  function logLine(st, kind, text, uid, recordable) {
    var t = numOr(st.tickAt, 0) || numOr(st.startedAt, 0) || 0;
    /* A held button, a flaky connection replaying an event, or a student
       hammering a refused action must not be able to bury the record. The log
       is the thing the recorder is graded on and the thing the debrief is built
       from; one repeated line filling ninety slots destroys both. */
    var prev = arr(st.log)[arr(st.log).length - 1];
    if (prev && prev.text === cut(str(text), 240) && (t - numOr(prev.at, 0)) < DEDUPE_MS) return prev;
    var entry = {
      id: 'l' + (st.log.length + 1) + '_' + (numOr(st.rngN, 0)),
      at: t,
      el: st.startedAt ? Math.max(0, t - st.startedAt) : 0,
      kind: str(kind),
      text: cut(str(text), 240),
      uid: str(uid || ''),
      rec: !!recordable,
      confirmed: false
    };
    st.log = arr(st.log).concat([entry]);
    if (st.log.length > LOG_CAP) st.log = st.log.slice(st.log.length - LOG_CAP);
    if (entry.rec) st.pendingLog = { id: entry.id, text: entry.text, at: t };
    return entry;
  }

  function scoreOf(st, uid) {
    var u = str(uid);
    if (!u) return blankScore();
    if (!st.scores) st.scores = {};
    if (!st.scores[u]) st.scores[u] = blankScore();
    return st.scores[u];
  }
  function award(st, uid, n, text) {
    var s = scoreOf(st, uid);
    s.pts = numOr(s.pts, 0) + numOr(n, 0);
    if (text) s.good = arr(s.good).concat([cut(text, 160)]).slice(-24);
  }
  /**
   * fault(st, uid, sev, text) -> was it recorded?
   *
   * The same mistake, made again within twelve seconds, is one mistake. A
   * student who presses a refused button four times has not made four errors,
   * and letting the score think so turns a slip into a failure.
   */
  function fault(st, uid, sev, text) {
    var s = scoreOf(st, uid);
    var body = cut(text, 200);
    var t = numOr(st.tickAt, 0);
    if (s.lastFaultText === body && (t - numOr(s.lastFaultAt, 0)) < DEDUPE_MS) return false;
    s.lastFaultText = body;
    s.lastFaultAt = t;
    if (sev === 'major') { s.major = numOr(s.major, 0) + 1; s.pts = numOr(s.pts, 0) - 8; }
    else { s.minor = numOr(s.minor, 0) + 1; s.pts = numOr(s.pts, 0) - 3; }
    s.errors = arr(s.errors).concat([{ sev: sev, text: body }]).slice(-24);
    return true;
  }

  function uidForRole(st, roleId) { return str(obj(st.roles)[roleId] || ''); }
  function rolesOfUid(st, uid) {
    var out = [], r = obj(st.roles), k;
    for (k in r) { if (Object.prototype.hasOwnProperty.call(r, k) && str(r[k]) === str(uid)) out.push(k); }
    return out;
  }
  function holdsRole(st, uid, roleId) { return uidForRole(st, roleId) === str(uid); }

  /* ------------------------------------------------------- role assignment */

  /**
   * assignRoles(st, playerIds) - deals the slot table out to the players in
   * join order. Slot 0 (which always contains 'lead') goes to the host, because
   * the host is the person who set the room up and is the one everybody is
   * already looking at. Everything else is join order, which is stable across a
   * refresh because joinedAt is stored.
   */
  function assignRoles(st, playerIds) {
    var all = arr(playerIds).filter(function (x) { return !!x; });
    var roles = {}, i, j;

    /* The collapse is driven by WHO ACTUALLY TURNED UP, not by the number the
       host picked in the lobby. A room set to six that four people join is a
       four-person code, with the documented four-person mapping - it is not a
       six-person code with two roles nobody owns, which is a code that cannot
       be run and was the first thing to break in testing. */
    if (all.length <= 1) {
      /* One person in the room. Give them everything rather than leave them
         staring at a patient nobody is allowed to compress. */
      for (i = 0; i < ROLES.length; i++) { if (all[0]) roles[ROLES[i].id] = all[0]; }
      st.teamSize = clamp(numOr(st.teamSize, 2), 2, 6);
      st.roles = roles;
      return st;
    }

    var n = clamp(all.length, 2, 6);
    st.teamSize = n;
    var slots = slotsFor(n);
    var ids = all.slice(0, n);
    for (i = 0; i < slots.length; i++) {
      var who = ids[i];
      if (!who) continue;
      for (j = 0; j < slots[i].length; j++) roles[slots[i][j]] = who;
    }
    /* Anyone past the slot table (a 7th person in a 6-slot room) is an
       observer: no role, still in the room, still sees everything, still gets
       the debrief. */
    st.roles = roles;
    return st;
  }

  /**
   * joinRank(entry) - a player's place in the join queue. A student registers
   * their presence the instant they arrive and their joinedAt lands a moment
   * later, so an entry without one is the newest person in the room, not the
   * oldest. Reading a missing joinedAt as zero would briefly make every new
   * arrival the most senior player present, which is the wrong answer for both
   * the role deal and the host-inheritance queue.
   */
  var JOIN_LAST = 8.64e15;            // larger than any real Date.now()
  function joinRank(entry) {
    return numOr(obj(entry).joinedAt, 0) || JOIN_LAST;
  }

  /**
   * dealFromPlayers(st, players, hostUid) - the one place a players map becomes
   * a role deal. Join order decides the slots (stable across a refresh, because
   * joinedAt is written once), and the host is forced into slot zero.
   */
  function dealFromPlayers(st, players, hostUid) {
    var p = obj(players);
    /* Only people who are actually here. Someone who left during the briefing
       must not keep a slot warm - reshuffling before the code starts costs
       nothing, and a role held by an empty chair costs everything. Once the
       code is running this function is not called again, so a mid-code refresh
       never reshuffles anybody. */
    var ids = keys(p).filter(function (u) {
      return u === hostUid || obj(p[u]).connected !== false;
    }).sort(function (a, b) {
      var d = joinRank(p[a]) - joinRank(p[b]);
      return d !== 0 ? d : (a < b ? -1 : 1);
    });
    if (hostUid) ids = [hostUid].concat(ids.filter(function (u) { return u !== hostUid; }));
    return assignRoles(st, ids);
  }

  /* --------------------------------------------------------- CPR + airway */

  /**
   * feedCpr(st, now, sample) - the compressor's client reports its own tap rate
   * to /players/<uid>/cpr (which is the one node their own uid may write under
   * the deployed rules). The host folds those samples in here. A sample older
   * than CPR_FRESH_MS means hands are off the chest, full stop.
   */
  function feedCpr(st, now, sample) {
    var s = obj(sample);
    var at = numOr(s.at, 0);
    var fresh = at > 0 && (now - at) < CPR_FRESH_MS;
    st.cprOn = !!fresh;
    st.cprRate = fresh ? Math.round(numOr(s.rate, 0)) : 0;
    return st;
  }
  function feedVent(st, now, sample) {
    var s = obj(sample);
    var at = numOr(s.at, 0);
    st.ventRate = (at > 0 && (now - at) < 15000) ? Math.round(numOr(s.rate, 0)) : 0;
    st.ventLastAt = at;
    return st;
  }

  function ccf(st) {
    var from = numOr(st.arrestAt, 0) || numOr(st.startedAt, 0);
    var span = (from && st.tickAt) ? Math.max(1, st.tickAt - from) : 1;
    /* The rhythm-check pauses are legitimate hands-off time and are not counted
       against the team; padding the denominator with them would punish exactly
       the behaviour we are teaching. */
    var pausable = numOr(st.checkPausedMs, 0);
    return clamp(numOr(st.cprMs, 0) / Math.max(1, span - pausable), 0, 1);
  }
  function cprQuality(st) {
    var m = numOr(st.cprMs, 0);
    if (m <= 0) return 0;
    return clamp(numOr(st.cprBandMs, 0) / m, 0, 1);
  }

  /* -------------------------------------------------------- the odds model */

  /**
   * conversionOdds(st, now) -> 0..1, evaluated once per rhythm check.
   *
   * Every term here is something a student is graded on in a real megacode, and
   * the weights are ordered the way the evidence orders them: compression
   * fraction and early defibrillation dominate, drugs help, and for a
   * non-shockable rhythm nothing at all matters as much as finding the cause.
   */
  function conversionOdds(st, now) {
    var d = diffOf(st.difficulty);
    var shockable = isShockable(st.rhythm);
    var cycleCcf = clamp(numOr(st.cycleCprMs, 0) / CYCLE_MS, 0, 1);
    var q = cprQuality(st);
    var p = d.base;

    /* Compression fraction, referenced to the 60% that is roughly what an
       untrained team achieves. Above it you are buying perfusion; below it
       nothing else you do is reaching the coronaries. */
    p += (cycleCcf - 0.6) * 0.55;
    p += (q - 0.5) * 0.12;           // and rate discipline on top of it

    if (shockable) {
      if (st.shockThisCycle) p += d.shockGain; else p -= 0.07;
      if (st.epi > 0 && (now - st.lastEpiAt) < EPI_MAX_MS) p += 0.10;
      if (st.shocks >= 3 && st.amio > 0) p += 0.12;
      if (st.rhythm === 'vf_fine') p -= 0.07;
      if (st.htCorrect) p += 0.06;
    } else {
      p *= 0.55;
      if (st.htCorrect) p += d.htGain;
      if (st.epi > 0 && (now - st.lastEpiAt) < EPI_MAX_MS) p += 0.08;
      if (st.rhythm === 'asystole') p -= 0.07;
    }
    /* Asystole last, and multiplicatively. Everything a team can do right still
       applies - it just applies to a much smaller number, which is the honest
       shape of asystole survival and the reason the termination decision exists
       in this mode at all. */
    if (st.rhythm === 'asystole') p *= 0.45;
    if (st.airway !== 'none') p += 0.04;
    if (st.o2) p += 0.03;
    if (st.iv) p += 0.02;
    p -= Math.min(0.16, Math.max(0, numOr(st.cycle, 1) - 1) * 0.022);
    return clamp(p, 0.01, 0.92);
  }

  /** What the rhythm decays into when the cycle failed to convert it. */
  function degrade(st, now) {
    var d = diffOf(st.difficulty);
    var r = roll(st);
    if (st.rhythm === 'vf' && !st.shockThisCycle && r < d.drift) return 'vf_fine';
    if (st.rhythm === 'vf_fine' && r < d.drift * 0.8) return 'asystole';
    if (st.rhythm === 'pvt' && !st.shockThisCycle && r < d.drift * 0.7) return 'vf';
    if (st.rhythm === 'pea' && !st.htCorrect && numOr(st.cycle, 1) >= 3 && r < d.drift) return 'asystole';
    return st.rhythm;
  }

  /* --------------------------------------------------------------- outcome */

  function gradeOutcome(st, now, kind) {
    st.outcome = kind;
    st.endedAt = now;
    st.phase = 'ended';
    st.cprOn = false;
    /* Somebody senior always walks in at the end, and the handoff is part of
       the code - the last thing a student does in a real one and the first
       thing they are graded on afterwards. */
    var k = caseById(st.caseId);
    if (kind === 'rosc' || kind === 'rosc_late') {
      logLine(st, 'handoff', 'Handoff to ' + str(k.handoff) + ': "' + k.patient + '. Downtime ' +
        fmtClock(now - numOr(st.startedAt, now)) + '. ' + numOr(st.shocks, 0) + ' shock' +
        (numOr(st.shocks, 0) === 1 ? '' : 's') + ', ' + numOr(st.epi, 0) + ' epi, ' +
        (st.htCorrect ? (htLabel(k.cause) + ' identified and treated') : 'cause not identified') +
        '. ROSC now, going to the unit."', '', true);
    } else if (kind === 'terminated' || kind === 'death') {
      logLine(st, 'handoff', str(k.handoff).charAt(0).toUpperCase() + str(k.handoff).slice(1) +
        ' takes the report and thanks the team. Somebody needs to find the family, and somebody ' +
        'needs to check on the person who was doing compressions.', '', false);
    }
    return st;
  }

  function roscQuality(st) {
    /* "Late" is not about the clock alone. A team that got there in four cycles
       with an 85% compression fraction ran a good code; a team that stumbled
       into it in two with hands off the chest half the time did not. */
    var f = ccf(st);
    var early = numOr(st.cycle, 1) <= 3;
    return (early && f >= 0.7) ? 'rosc' : 'rosc_late';
  }

  function terminationIsAppropriate(st, now) {
    if (st.rhythm !== 'asystole') return false;
    if (numOr(st.cycle, 1) < 6) return false;
    if (numOr(st.epi, 0) < 3) return false;
    if (st.airway === 'none') return false;
    if (ccf(st) < 0.6) return false;
    return true;
  }

  /* ------------------------------------------------------------------ tick */

  function beginCheck(st, now) {
    st.phase = 'check';
    st.checkStartedAt = now;
    st.cprOn = false;
    var before = st.rhythm;
    var odds = conversionOdds(st, now);
    var r = roll(st);
    var converted = r < odds;

    if (converted) {
      st.rhythm = 'sinus';
      st.arrested = false;
      st.checkAnnounced = 'ROSC';
      logLine(st, 'rhythm', 'Rhythm check: organised rhythm with a palpable carotid pulse. ROSC at ' +
        fmtClock(now - st.startedAt) + '.', '', true);
      st.beat = numOr(st.beat, 0) + 1;
      st.lastBeatKind = 'rosc';
      gradeOutcome(st, now, roscQuality(st));
      return st;
    }

    var next = degrade(st, now);
    if (next !== before) {
      st.rhythm = next;
      logLine(st, 'rhythm', 'Rhythm check: ' + rhy(before).short + ' has deteriorated to ' +
        rhy(next).short + '. No pulse.', '', true);
    } else {
      logLine(st, 'rhythm', 'Rhythm check: still ' + rhy(st.rhythm).short + '. No pulse.', '', true);
    }
    st.checkAnnounced = rhy(st.rhythm).short;
    st.beat = numOr(st.beat, 0) + 1;
    st.lastBeatKind = 'rhythmcheck';
    st.terminationAppropriate = terminationIsAppropriate(st, now);
    return st;
  }

  function resumeCycle(st, now, byUid) {
    /* Every second of the check window that nobody used is a second of hands
       off the chest. Teams that stand around admiring the monitor lose here,
       which is exactly the lesson. */
    var paused = Math.max(0, now - numOr(st.checkStartedAt, now));
    st.checkPausedMs = numOr(st.checkPausedMs, 0) + Math.min(paused, CHECK_MS);
    if (paused > 10000) {
      var lead = uidForRole(st, 'lead');
      if (lead) fault(st, lead, 'minor', 'The pause at the rhythm check ran to ' + fmtSec(paused) +
        '. A rhythm check plus a pulse check should be ten seconds and then hands are back on.');
    }
    st.phase = 'running';
    st.cycle = numOr(st.cycle, 1) + 1;
    st.cycleStartedAt = now;
    st.cycleCprMs = 0;
    st.shockThisCycle = false;
    st.chargedAt = 0;
    st.clearedAt = 0;
    st.switchPrompted = true;
    st.checkAnnounced = '';
    logLine(st, 'cycle', 'Cycle ' + st.cycle + ' - resume compressions. Switch compressors.', str(byUid || ''));
    if (numOr(st.cycle, 1) > MAX_CYCLES) {
      /* Say the real number rather than a hard-coded one: the constant above is
         the sort of thing that gets tuned, and a log line that disagrees with
         the clock beside it destroys trust in both. */
      logLine(st, 'outcome', fmtClock(now - numOr(st.startedAt, now)) +
        ' of resuscitation without return of circulation. The team lead calls it.', '');
      gradeOutcome(st, now, 'death');
    }
    return st;
  }

  /**
   * tick(st, now) - the only place simulated time advances.
   *
   * Every quantity is either derived from a stored timestamp or integrated from
   * the measured gap since the previous tick. The gap is clamped: if a phone
   * slept for four minutes we must not credit the team with four minutes of
   * perfect CPR, and we must not skip four rhythm checks in one frame either.
   */
  function tick(st, now) {
    if (st.phase !== 'running' && st.phase !== 'check') { st.tickAt = now; return st; }
    var prev = numOr(st.tickAt, 0) || now;
    var dt = clamp(now - prev, 0, 4000);
    st.tickAt = now;

    if (st.phase === 'running' && st.arrested) {
      if (st.cprOn) {
        st.cprMs = numOr(st.cprMs, 0) + dt;
        st.cycleCprMs = numOr(st.cycleCprMs, 0) + dt;
        if (st.cprRate >= CPR_LOW && st.cprRate <= CPR_HIGH) st.cprBandMs = numOr(st.cprBandMs, 0) + dt;
        if (!st.metrics.firstCompressionAt) {
          st.metrics.firstCompressionAt = now;
          /* Roles are re-dealt on every tick until the code starts, so somebody
           who walks in thirty seconds late still gets a job. The instant the
           code is running they freeze - a role changing hands mid-compression
           because a phone reconnected would be worse than an empty role. */
        if (st.phase === 'briefing' && st.roleMode !== 'leader') dealFromPlayers(st, players, myUid);
        var cu = uidForRole(st, 'compressions');
          var lag = now - numOr(st.startedAt, now);
          if (lag <= 10000) award(st, cu, 6, 'Hands on the chest in ' + fmtSec(lag) + '.');
          else fault(st, cu, lag > 30000 ? 'major' : 'minor',
            'First compression at ' + fmtSec(lag) + '. Compressions start within ten seconds of recognising arrest.');
        }
      }
    }

    /* The pre-arrest cases (VT with a pulse, the bradycardic child) deteriorate
       on their own clock. Acting inside that window is the whole scenario. */
    if (st.phase === 'running' && !st.arrested) {
      var k = caseById(st.caseId);
      var since = now - numOr(st.startedAt, now);
      var deadline = (k.id === 'peds-resp') ? 75000 : 90000;
      if (since >= deadline) {
        /* THE RESCUE WINDOW. Both pre-arrest cases are winnable before anybody
           touches the chest, and a mode that only ever rewarded good CPR would
           be teaching the opposite of what these two cases are for.
           - The child arrests from his lungs. Oxygen and a working airway, in
             time, and the bradycardia comes back up on its own.
           - Bea's rhythm is potassium. Replace it and the deterioration stalls.
           Evaluated once, at the deadline, on the seeded roll like everything
           else, so it is winnable but never guaranteed. */
        var d2 = diffOf(st.difficulty);
        var rescue = 0;
        if (k.id === 'peds-resp' && st.o2 && st.airway !== 'none') {
          rescue = 0.42 + d2.htGain + (st.htCorrect ? 0.12 : 0);
        } else if (k.id === 'vt-deteriorating' && st.htCorrect) {
          rescue = 0.18 + d2.htGain * 0.6;
        }
        if (rescue > 0 && roll(st) < clamp(rescue, 0, 0.88)) {
          st.rhythm = 'sinus';
          logLine(st, 'rhythm', (k.id === 'peds-resp')
            ? 'Oxygen, a patent airway and effective breaths. Tobias\'s heart rate climbs back through 90 and ' +
              'his colour returns. He never arrested - because you treated his lungs.'
            : 'The potassium is running and the ectopy settles. Bea converts to sinus rhythm with a pulse. ' +
              'She never arrested.', '', true);
          st.beat = numOr(st.beat, 0) + 1;
          st.lastBeatKind = 'rosc';
          gradeOutcome(st, now, 'rosc');
          return st;
        }
        st.arrested = true;
        st.arrestAt = now;
        st.rhythm = (k.id === 'peds-resp') ? 'asystole' : 'pvt';
        st.cycleStartedAt = now;
        st.cycleCprMs = 0;
        st.checkPausedMs = numOr(st.checkPausedMs, 0);
        logLine(st, 'rhythm', (k.id === 'peds-resp')
          ? 'Tobias has lost his pulse. The monitor is flat. This is a full arrest now.'
          : 'Bea has lost consciousness and her pulse. The monitor shows pulseless VT.', '', true);
        st.beat = numOr(st.beat, 0) + 1;
        st.lastBeatKind = 'arrest';
      }
    }

    if (st.phase === 'running' && st.arrested && st.cycleStartedAt &&
        (now - st.cycleStartedAt) >= CYCLE_MS) {
      beginCheck(st, now);
      return st;
    }
    if (st.phase === 'check' && st.checkStartedAt && (now - st.checkStartedAt) >= CHECK_MS) {
      resumeCycle(st, now, '');
      return st;
    }
    return st;
  }

  /* ==========================================================================
   * 7. EVENTS
   * A player's client writes {type, uid, role, payload, t} to /events as a
   * write-once push. The host reads them in push-key order and calls
   * applyEvent. Nothing a player writes is trusted: every handler re-checks
   * that this uid actually holds the role the action belongs to.
   * ======================================================================== */

  function deny(st, uid, text) {
    logLine(st, 'deny', text, str(uid));
    return st;
  }

  function applyEvent(st, ev, now) {
    var e = obj(ev);
    var type = str(e.type);
    var uid = str(e.uid);
    var pl = obj(e.payload);
    var t = numOr(now, numOr(e.t, nowMs()));
    st.tickAt = Math.max(numOr(st.tickAt, 0), t);
    var s, kase = caseById(st.caseId);

    /* ---------------------------------------------------------- lifecycle */
    if (type === 'start') {
      if (st.phase !== 'briefing') return st;
      st.phase = 'running';
      st.startedAt = t;
      st.tickAt = t;
      st.cycleStartedAt = t;
      st.checkPausedMs = 0;
      if (st.arrested) st.arrestAt = t;
      logLine(st, 'start', 'Code called. ' + kase.patient + '. ' +
        (st.arrested ? 'Pulseless and apneic.' : 'Deteriorating - a pulse for now.'), uid);
      st.beat = numOr(st.beat, 0) + 1;
      st.lastBeatKind = 'open';
      return st;
    }

    if (st.phase === 'briefing' || st.phase === 'ended') return st;

    /* ------------------------------------------------------------ the pad */
    if (type === 'switch') {
      if (!holdsRole(st, uid, 'compressions')) return deny(st, uid, 'Only the compressor can call a switch.');
      var to = str(pl.toUid);
      if (!to || to === uid) return deny(st, uid, 'Nobody was free to take over compressions.');
      /* numOr(0, x) is 0 - a zero IS a finite number - so this cannot use
         numOr for the fallback. Before the first hand-off lastSwitchAt is 0
         and the elapsed time has to be measured from the start of the code. */
      var into = numOr(st.lastSwitchAt, 0) || numOr(st.startedAt, t);
      var elapsed = t - into;
      st.roles = shallow(st.roles);
      /* A true swap: whoever takes the chest gives up what they were doing to
         the person leaving it, so no role silently goes unowned. */
      var giving = rolesOfUid(st, to);
      var i;
      for (i = 0; i < giving.length; i++) st.roles[giving[i]] = uid;
      st.roles.compressions = to;
      st.lastSwitchAt = t;
      st.switches = numOr(st.switches, 0) + 1;
      st.switchPrompted = false;
      scoreOf(st, uid).switches = numOr(scoreOf(st, uid).switches, 0) + 1;
      if (elapsed >= SWITCH_OK_MS) {
        award(st, uid, 5, 'Handed off compressions at the end of the cycle, before quality fell off.');
        logLine(st, 'switch', 'Compressor switch - ' + fmtSec(elapsed) + ' on the chest. Correct.', uid, true);
      } else if (elapsed < 45000) {
        fault(st, uid, 'minor', 'Swapped out after only ' + fmtSec(elapsed) +
          '. Switch on the two-minute cycle, not whenever it gets hard - every swap costs perfusion.');
        logLine(st, 'switch', 'Compressor switch after only ' + fmtSec(elapsed) + '.', uid, true);
      } else {
        logLine(st, 'switch', 'Compressor switch at ' + fmtSec(elapsed) + '.', uid, true);
      }
      return st;
    }

    /* ------------------------------------------------------------- airway */
    if (type === 'airway') {
      if (!holdsRole(st, uid, 'airway')) return deny(st, uid, 'Airway actions belong to the airway role.');
      var kind = str(pl.kind);
      st.airway = (kind === 'ett' || kind === 'sga') ? 'advanced' : (kind === 'opa' ? 'adjunct' : 'bvm');
      if (!st.airwayAt) {
        st.airwayAt = t;
        st.metrics.firstAirwayAt = t;
        var alag = t - numOr(st.startedAt, t);
        if (alag <= 45000) award(st, uid, 5, 'Airway supported inside ' + fmtSec(alag) + '.');
        else fault(st, uid, 'minor', 'The first breath went in at ' + fmtSec(alag) + '.');
      }
      logLine(st, 'airway', 'Airway: ' + (kind === 'ett' ? 'endotracheal tube placed, placement confirmed'
        : kind === 'sga' ? 'supraglottic airway placed' : kind === 'opa' ? 'oral airway inserted'
        : 'bag-mask ventilation, two-person technique') + '.', uid, true);
      if (st.airway === 'advanced') {
        award(st, uid, 3, 'Advanced airway in, so compressions no longer pause for breaths.');
      }
      return st;
    }
    if (type === 'o2') {
      if (!holdsRole(st, uid, 'airway')) return deny(st, uid, 'Oxygen belongs to the airway role.');
      if (st.o2) return st;
      st.o2 = true;
      award(st, uid, 3, 'High-flow oxygen connected.');
      logLine(st, 'airway', 'Oxygen at 15 L/min connected to the bag with a reservoir.', uid, true);
      return st;
    }

    /* --------------------------------------------------------------- meds */
    if (type === 'iv') {
      if (!holdsRole(st, uid, 'meds')) return deny(st, uid, 'Access belongs to the meds role.');
      if (st.iv) return st;
      st.iv = true;
      st.ivAt = t;
      st.metrics.firstIvAt = t;
      var ivl = t - numOr(st.startedAt, t);
      if (ivl <= 60000) award(st, uid, 5, 'Access established in ' + fmtSec(ivl) + '.');
      else fault(st, uid, 'minor', 'Access took ' + fmtSec(ivl) + '. Two attempts and then go intraosseous.');
      logLine(st, 'meds', 'IV access established - 18 gauge, right antecubital, patent.', uid, true);
      return st;
    }

    if (type === 'epi') {
      if (!holdsRole(st, uid, 'meds')) return deny(st, uid, 'Drug administration belongs to the meds role.');
      var opt = null, eo = epiOptions(kase), i2;
      for (i2 = 0; i2 < eo.length; i2++) { if (eo[i2].id === str(pl.optId)) opt = eo[i2]; }
      if (!opt) return st;
      if (!opt.ok) {
        fault(st, uid, 'major', 'Wrong epinephrine order: "' + opt.text + '". ' + str(opt.why));
        logLine(st, 'error', 'MEDICATION ERROR caught at the bedside: ' + opt.text + '.', uid, true);
        return st;
      }
      if (!st.iv) {
        fault(st, uid, 'major', 'Epinephrine pushed with no route. Access first - IV or IO - then the drug.');
        logLine(st, 'error', 'Epinephrine attempted with no IV or IO access.', uid, true);
        return st;
      }
      var gap = st.epi > 0 ? (t - numOr(st.lastEpiAt, t)) : -1;
      if (gap >= 0 && gap < EPI_MIN_MS) {
        fault(st, uid, 'minor', 'Epinephrine repeated after only ' + fmtClock(gap) +
          '. The interval is three to five minutes.');
      } else if (gap > EPI_MAX_MS) {
        fault(st, uid, 'minor', 'Epinephrine was ' + fmtClock(gap) + ' apart. The interval is three to five minutes.');
      } else {
        award(st, uid, 6, gap < 0 ? 'First epinephrine given, correct dose and route.'
          : 'Epinephrine repeated on interval at ' + fmtClock(gap) + '.');
      }
      st.epi = numOr(st.epi, 0) + 1;
      st.lastEpiAt = t;
      st.epiTimes = arr(st.epiTimes).concat([t]).slice(-12);
      if (!st.metrics.firstEpiAt) st.metrics.firstEpiAt = t;
      logLine(st, 'meds', 'Epinephrine ' + kase.epiText + ' given (dose #' + st.epi + '), 20 mL flush, arm raised.', uid, true);
      st.beat = numOr(st.beat, 0) + 1;
      st.lastBeatKind = 'epi';
      return st;
    }

    if (type === 'amio') {
      if (!holdsRole(st, uid, 'meds')) return deny(st, uid, 'Drug administration belongs to the meds role.');
      var ao = amioOptions(kase, numOr(st.amio, 0)), aopt = null, i3;
      for (i3 = 0; i3 < ao.length; i3++) { if (ao[i3].id === str(pl.optId)) aopt = ao[i3]; }
      if (!aopt) return st;
      if (!aopt.ok) {
        fault(st, uid, 'major', 'Wrong antiarrhythmic order: "' + aopt.text + '". ' + str(aopt.why));
        logLine(st, 'error', 'MEDICATION ERROR caught at the bedside: ' + aopt.text + '.', uid, true);
        return st;
      }
      if (!isShockable(st.rhythm)) {
        fault(st, uid, 'minor', 'Amiodarone into a non-shockable rhythm. It is for refractory VF and pulseless VT.');
        logLine(st, 'error', 'Amiodarone drawn up for a non-shockable rhythm.', uid, true);
        return st;
      }
      if (numOr(st.shocks, 0) < 2) {
        fault(st, uid, 'minor', 'Amiodarone before the rhythm has proven refractory. Shock, epinephrine, shock, then the antiarrhythmic.');
      } else {
        award(st, uid, 6, 'Amiodarone for refractory VF/pVT, in the right order.');
      }
      st.amio = numOr(st.amio, 0) + 1;
      logLine(st, 'meds', 'Amiodarone ' + aopt.text + ' given.', uid, true);
      return st;
    }

    /* -------------------------------------------------------------- defib */
    if (type === 'charge') {
      if (!holdsRole(st, uid, 'defib')) return deny(st, uid, 'The defibrillator belongs to the defib role.');
      /* Already charged and still holding it: not a new action, and certainly
         not a new line in the record. */
      if (st.chargedAt && (t - st.chargedAt) < 20000) return st;
      st.chargedAt = t;
      st.joules = clamp(Math.round(numOr(pl.joules, 200)), 120, 360);
      logLine(st, 'defib', 'Defibrillator charging to ' + st.joules + ' joules. Compressions continue while it charges.', uid);
      return st;
    }
    if (type === 'clear') {
      if (!holdsRole(st, uid, 'defib')) return deny(st, uid, 'The defibrillator belongs to the defib role.');
      if (st.clearedAt && (t - st.clearedAt) < 4000) return st;
      st.clearedAt = t;
      logLine(st, 'defib', '"I am clear, you are clear, everybody clear." Visual sweep of the bed.', uid);
      /* Calling clear while the pad is still being tapped is the safety error
         that actually happens: the words get said and nobody looks up. */
      if (st.cprOn) {
        fault(st, uid, 'minor', 'You called clear while hands were still on the chest. Clear is a look, not a word.');
      }
      return st;
    }
    if (type === 'shock') {
      if (!holdsRole(st, uid, 'defib')) return deny(st, uid, 'The defibrillator belongs to the defib role.');

      /* SYNCHRONIZED CARDIOVERSION.
         Unstable VT WITH a pulse is the one place in this mode where the shock
         is not a defibrillation, and getting there before the pulse disappears
         is the entire teaching point of that case. It is scored as the save it
         is, and it ends the code before an arrest ever happens. */
      if (!st.arrested && st.rhythm === 'vt_pulse') {
        if (!st.chargedAt) {
          fault(st, uid, 'minor', 'Cardioversion pressed on an uncharged machine. Charge - synchronised - clear, then shock.');
          return st;
        }
        var cvClear = st.clearedAt ? (t - st.clearedAt) : -1;
        if (cvClear < 0 || cvClear > CLEAR_WINDOW) {
          fault(st, uid, 'major', 'Cardioversion delivered without clearing the team.');
          logLine(st, 'error', 'SAFETY: cardioversion delivered without a clear.', uid, true);
          st.unsafeShocks = numOr(st.unsafeShocks, 0) + 1;
        }
        st.shocks = numOr(st.shocks, 0) + 1;
        st.lastShockAt = t;
        st.chargedAt = 0;
        st.clearedAt = 0;
        if (!st.metrics.firstShockAt) st.metrics.firstShockAt = t;
        var cvOdds = clamp(diffOf(st.difficulty).shockGain + 0.28 + (st.htCorrect ? 0.15 : 0), 0.2, 0.9);
        if (roll(st) < cvOdds) {
          award(st, uid, 14, 'Synchronised cardioversion of unstable VT before it became an arrest. ' +
            'This is the save - nobody ever had to do compressions.');
          st.rhythm = 'sinus';
          logLine(st, 'defib', 'Synchronised cardioversion at 100 J. The monitor breaks to sinus rhythm and ' +
            'she has a strong radial pulse. She never arrested.', uid, true);
          st.beat = numOr(st.beat, 0) + 1;
          st.lastBeatKind = 'rosc';
          gradeOutcome(st, t, 'rosc');
        } else {
          award(st, uid, 5, 'Cardioverted unstable VT - the right call, even though it did not convert.');
          logLine(st, 'defib', 'Synchronised cardioversion at 100 J. No change - still wide, still fast, ' +
            'still barely perfusing. Charge again.', uid, true);
        }
        return st;
      }

      if (!isShockable(st.rhythm)) {
        fault(st, uid, 'major', 'Shock delivered into ' + rhy(st.rhythm).label +
          '. This rhythm is not shockable - the treatment is compressions, epinephrine and the reversible cause.');
        logLine(st, 'error', 'SHOCK DELIVERED INTO ' + rhy(st.rhythm).short.toUpperCase() +
          ' - non-shockable rhythm. Major error.', uid, true);
        st.wrongShocks = numOr(st.wrongShocks, 0) + 1;
        st.shocks = numOr(st.shocks, 0) + 1;
        st.lastShockAt = t;
        st.chargedAt = 0;
        st.clearedAt = 0;
        st.beat = numOr(st.beat, 0) + 1;
        st.lastBeatKind = 'wrongshock';
        return st;
      }
      if (!st.chargedAt) {
        fault(st, uid, 'minor', 'Shock pressed on an uncharged defibrillator. Charge, clear, then shock.');
        return st;
      }
      /* WHEN you may shock, not just whether the rhythm is shockable.
         The first shock is free - the pads have just gone on, the rhythm is
         confirmed, and every second of delay costs survival. After that a shock
         only belongs at a rhythm check: one shock, two full minutes of
         compressions, look again. Stacking them is a 2005 protocol and the
         reason it was abandoned is exactly the perfusion this engine measures.
         A double-tap inside three seconds is a slip and is swallowed silently;
         a deliberate mid-cycle shock is refused and taught. */
      var sinceShock = st.lastShockAt ? (t - st.lastShockAt) : 1e9;
      if (numOr(st.shocks, 0) > 0 && st.phase !== 'check') {
        if (sinceShock > 3000) {
          fault(st, uid, 'minor', 'Shock delivered mid-cycle, ' + fmtClock(sinceShock) +
            ' after the last one and with no rhythm check between them. One shock, two minutes of ' +
            'compressions, then look.');
          logLine(st, 'error', 'Mid-cycle shock refused - no rhythm check since the last one.', uid);
        }
        st.chargedAt = 0;
        st.clearedAt = 0;
        return st;
      }
      var clearGap = st.clearedAt ? (t - st.clearedAt) : -1;
      if (clearGap < 0 || clearGap > CLEAR_WINDOW) {
        fault(st, uid, 'major', 'Shock delivered without clearing the team. Somebody had a hand on that patient.');
        logLine(st, 'error', 'SAFETY: shock delivered without a clear.', uid, true);
        st.unsafeShocks = numOr(st.unsafeShocks, 0) + 1;
      } else if (st.cprOn) {
        fault(st, uid, 'major', 'You cleared and then shocked with the compressor still on the chest.');
        logLine(st, 'error', 'SAFETY: hands were on the chest at the moment of the shock.', uid, true);
        st.unsafeShocks = numOr(st.unsafeShocks, 0) + 1;
      } else {
        award(st, uid, 8, 'Charged, cleared, shocked - ' + st.joules + ' J, hands off.');
      }
      st.shocks = numOr(st.shocks, 0) + 1;
      st.lastShockAt = t;
      st.shockThisCycle = true;
      st.chargedAt = 0;
      st.clearedAt = 0;
      if (!st.metrics.firstShockAt) {
        st.metrics.firstShockAt = t;
        var slag = t - numOr(st.startedAt, t);
        if (slag <= 120000) award(st, uid, 8, 'First shock at ' + fmtClock(slag) +
          '. Every minute of delay in a shockable rhythm costs about ten percent of survival.');
        else fault(st, uid, 'minor', 'First shock at ' + fmtClock(slag) + '. Defibrillate as soon as the pads are on.');
      }
      logLine(st, 'defib', 'Shock #' + st.shocks + ' delivered at ' + st.joules +
        ' J. Immediately resume compressions - do not stop to look at the monitor.', uid, true);
      st.beat = numOr(st.beat, 0) + 1;
      st.lastBeatKind = 'shock';
      /* Post-shock the algorithm is unambiguous: two minutes of CPR, then
         look. Snapping back into the running phase enforces that. */
      if (st.phase === 'check') {
        st.phase = 'running';
        st.checkPausedMs = numOr(st.checkPausedMs, 0) + Math.max(0, t - numOr(st.checkStartedAt, t));
        st.cycle = numOr(st.cycle, 1) + 1;
        st.cycleStartedAt = t;
        st.cycleCprMs = 0;
        st.shockThisCycle = true;
        st.switchPrompted = true;
        st.checkAnnounced = '';
      }
      return st;
    }

    /* --------------------------------------------------------------- lead */
    if (type === 'rhythm_check') {
      if (!holdsRole(st, uid, 'lead')) return deny(st, uid, 'The team lead orders rhythm checks.');
      st.rhythmChecksOrdered = numOr(st.rhythmChecksOrdered, 0) + 1;
      if (st.phase === 'check') return st;
      var left = CYCLE_MS - (t - numOr(st.cycleStartedAt, t));
      if (left > 25000) {
        fault(st, uid, 'minor', 'Rhythm check ordered with ' + fmtClock(left) +
          ' still on the cycle clock. Interrupting compressions early is the most common way teams lose perfusion.');
        logLine(st, 'lead', 'Early rhythm check ordered - ' + fmtClock(left) + ' left in the cycle.', uid);
      } else {
        award(st, uid, 4, 'Rhythm check called on the cycle.');
      }
      beginCheck(st, t);
      return st;
    }
    if (type === 'resume') {
      if (!holdsRole(st, uid, 'lead') && !holdsRole(st, uid, 'compressions')) return st;
      if (st.phase !== 'check') return st;
      var pausedFor = t - numOr(st.checkStartedAt, t);
      if (pausedFor <= 10000) award(st, uid, 4, 'Back on the chest in ' + fmtSec(pausedFor) + '.');
      resumeCycle(st, t, uid);
      return st;
    }
    if (type === 'ht') {
      if (!holdsRole(st, uid, 'lead')) return deny(st, uid, 'The H&T review is the team lead\'s call.');
      var guess = str(pl.cause);
      st.htAttempts = numOr(st.htAttempts, 0) + 1;
      st.htGuess = guess;
      if (guess === kase.cause) {
        if (st.htCorrect) return st;
        st.htCorrect = true;
        st.htTreatedAt = t;
        award(st, uid, 12, 'Named the reversible cause - ' + htLabel(guess) + ' - and started treating it.');
        logLine(st, 'lead', 'H&T review: ' + htLabel(guess) + ' identified. ' + htTx(guess) + '.', uid, true);
        st.beat = numOr(st.beat, 0) + 1;
        st.lastBeatKind = 'ht';
      } else {
        if (st.htAttempts <= 2) {
          logLine(st, 'lead', 'H&T review: ' + htLabel(guess) + ' considered and ruled out.', uid);
        } else {
          fault(st, uid, 'minor', 'Third pass through the H&Ts without landing on the cause. ' + str(kase.causeHint));
        }
      }
      return st;
    }
    if (type === 'terminate') {
      if (!holdsRole(st, uid, 'lead')) return deny(st, uid, 'Only the team lead can call it.');
      if (terminationIsAppropriate(st, t)) {
        award(st, uid, 12, 'Recognised a well-run code that was not going to work, and stopped. ' +
          'Knowing when to stop is a clinical decision, not a failure of one.');
        logLine(st, 'outcome', 'Resuscitation stopped at ' + fmtClock(t - st.startedAt) +
          ' after ' + st.cycle + ' cycles of asystole. Time of death called by the team lead.', uid, true);
        gradeOutcome(st, t, 'terminated');
      } else {
        fault(st, uid, 'major', 'Resuscitation stopped at ' + fmtClock(t - numOr(st.startedAt, t)) +
          ' with ' + rhy(st.rhythm).label + ' on the monitor. There was more to do here.');
        logLine(st, 'outcome', 'Resuscitation stopped early by the team lead.', uid, true);
        gradeOutcome(st, t, 'death');
      }
      st.beat = numOr(st.beat, 0) + 1;
      st.lastBeatKind = 'end';
      return st;
    }
    if (type === 'assign') {
      if (st.roleMode !== 'leader') return st;
      if (!holdsRole(st, uid, 'lead')) return deny(st, uid, 'Only the team lead reassigns roles.');
      var role = str(pl.role), target = str(pl.toUid);
      if (!role || !target || role === 'lead') return st;
      st.roles = shallow(st.roles);
      st.roles[role] = target;
      award(st, uid, 1, 'Assigned ' + roleMeta(role).label + '.');
      logLine(st, 'lead', roleMeta(role).label + ' assigned by the team lead.', uid);
      return st;
    }

    /* ------------------------------------------------- closed-loop comms */
    if (type === 'order') {
      if (!holdsRole(st, uid, 'lead')) return deny(st, uid, 'Orders come from the team lead.');
      st.orderSeq = numOr(st.orderSeq, 0) + 1;
      var target = str(pl.role);
      st.order = {
        id: 'o' + st.orderSeq,
        text: cut(str(pl.text), 120),
        role: target,
        toUid: uidForRole(st, target),
        at: t, ackAt: 0, doneAt: 0
      };
      scoreOf(st, uid).ordered = numOr(scoreOf(st, uid).ordered, 0) + 1;
      logLine(st, 'order', 'Team lead: "' + st.order.text + '" - ' + roleMeta(target).label + '.', uid, true);
      return st;
    }
    if (type === 'ack') {
      s = obj(st.order);
      if (!s.id || s.id !== str(pl.id) || s.ackAt) return st;
      if (str(s.toUid) && str(s.toUid) !== uid) return deny(st, uid, 'That order was not addressed to you.');
      st.order = shallow(s);
      st.order.ackAt = t;
      var alag2 = t - numOr(s.at, t);
      var sc = scoreOf(st, uid);
      sc.acked = numOr(sc.acked, 0) + 1;
      if (alag2 <= LOOP_ACK_MS) award(st, uid, 3, 'Acknowledged "' + s.text + '" in ' + fmtSec(alag2) + '.');
      else { sc.ackLate = numOr(sc.ackLate, 0) + 1; fault(st, uid, 'minor', 'Took ' + fmtSec(alag2) + ' to acknowledge an order. In a code, silence reads as "nobody has it".'); }
      logLine(st, 'loop', roleMeta(s.role).label + ': "' + s.text + ', got it."', uid);
      return st;
    }
    if (type === 'report') {
      s = obj(st.order);
      if (!s.id || s.id !== str(pl.id) || s.doneAt) return st;
      if (str(s.toUid) && str(s.toUid) !== uid) return st;
      st.order = shallow(s);
      st.order.doneAt = t;
      var sc2 = scoreOf(st, uid);
      sc2.reported = numOr(sc2.reported, 0) + 1;
      award(st, uid, 3, 'Closed the loop on "' + s.text + '".');
      logLine(st, 'loop', roleMeta(s.role).label + ': "' + s.text + ' - done." Loop closed.', uid);
      return st;
    }

    /* ----------------------------------------------------------- recorder */
    if (type === 'log_confirm') {
      if (!holdsRole(st, uid, 'recorder')) return st;
      var want = str(pl.id), lg = arr(st.log), i4, found = null;
      for (i4 = lg.length - 1; i4 >= 0; i4--) { if (lg[i4].id === want) { found = lg[i4]; break; } }
      if (!found || found.confirmed) return st;
      var copy = arr(st.log).slice();
      for (i4 = 0; i4 < copy.length; i4++) { if (copy[i4].id === want) { copy[i4] = shallow(copy[i4]); copy[i4].confirmed = true; } }
      st.log = copy;
      if (obj(st.pendingLog).id === want) st.pendingLog = null;
      var dlag = t - numOr(found.at, t);
      var rs = scoreOf(st, uid);
      if (dlag <= RECORDER_MS) {
        rs.logConfirmed = numOr(rs.logConfirmed, 0) + 1;
        award(st, uid, 2, 'Timestamped "' + cut(found.text, 48) + '".');
      } else {
        rs.logMissed = numOr(rs.logMissed, 0) + 1;
        fault(st, uid, 'minor', 'Logged an event ' + fmtSec(dlag) + ' after it happened. The record is evidence; it has to be contemporaneous.');
      }
      return st;
    }
    if (type === 'quiz') {
      if (!holdsRole(st, uid, 'recorder')) return st;
      var q = obj(st.quiz);
      if (!q.id || q.id !== str(pl.id)) return st;
      var right = str(pl.answer) === str(q.answer);
      var qs = scoreOf(st, uid);
      st.quiz = null;
      if (right) { qs.quizRight = numOr(qs.quizRight, 0) + 1; award(st, uid, 4, 'Answered the lead\'s timing question correctly.'); }
      else { qs.quizWrong = numOr(qs.quizWrong, 0) + 1; fault(st, uid, 'minor', 'Could not say when the last drug went in. That number decides the next one.'); }
      logLine(st, 'record', 'Team lead: "' + str(q.q) + '" Recorder: "' + str(pl.answer) + '".' +
        (right ? '' : ' (The record says ' + str(q.answer) + '.)'), uid);
      return st;
    }
    if (type === 'ask_time') {
      if (!holdsRole(st, uid, 'lead')) return st;
      if (!st.epi) return deny(st, uid, 'No drug has been given yet.');
      var real = fmtClock(numOr(st.lastEpiAt, t) - numOr(st.startedAt, t));
      var wrongA = fmtClock(Math.max(0, numOr(st.lastEpiAt, t) - numOr(st.startedAt, t) - 62000));
      var wrongB = fmtClock(numOr(st.lastEpiAt, t) - numOr(st.startedAt, t) + 48000);
      st.quiz = {
        id: 'q' + numOr(st.beat, 0) + '_' + numOr(st.epi, 0),
        q: 'What time did the last epinephrine go in?',
        answer: real,
        options: [wrongA, real, wrongB].sort()
      };
      logLine(st, 'record', 'Team lead to recorder: "What time did the last epi go in?"', uid);
      return st;
    }

    /* ------------------------------------------------------- solo AI teammates */
    if (type === 'bot_say') {
      logLine(st, 'say', str(pl.text), uid);
      return st;
    }
    return st;
  }

  /* ==========================================================================
   * 8. SCORING
   * One hundred points of team performance, then each player's own conduct
   * modifies their share of it. The team number is what the group argues about
   * in the debrief; the personal number is what shows up on their dashboard.
   * ======================================================================== */

  function epiIntervals(st) {
    var ts = arr(st.epiTimes), out = [], i;
    for (i = 1; i < ts.length; i++) out.push(ts[i] - ts[i - 1]);
    return out;
  }

  function teamMetrics(st) {
    var end = numOr(st.endedAt, 0) || numOr(st.tickAt, 0);
    var start = numOr(st.startedAt, 0) || end;
    var iv = epiIntervals(st);
    var onInterval = 0, i;
    for (i = 0; i < iv.length; i++) { if (iv[i] >= EPI_MIN_MS && iv[i] <= EPI_MAX_MS) onInterval++; }
    return {
      durationMs: Math.max(0, end - start),
      cycles: numOr(st.cycle, 1),
      ccf: ccf(st),
      cprQuality: cprQuality(st),
      timeToCompression: st.metrics.firstCompressionAt
        ? (st.metrics.firstCompressionAt - (numOr(st.arrestAt, 0) || start)) : -1,
      timeToShock: st.metrics.firstShockAt ? (st.metrics.firstShockAt - start) : -1,
      timeToEpi: st.metrics.firstEpiAt ? (st.metrics.firstEpiAt - start) : -1,
      timeToAirway: st.metrics.firstAirwayAt ? (st.metrics.firstAirwayAt - start) : -1,
      timeToIv: st.metrics.firstIvAt ? (st.metrics.firstIvAt - start) : -1,
      shocks: numOr(st.shocks, 0),
      wrongShocks: numOr(st.wrongShocks, 0),
      unsafeShocks: numOr(st.unsafeShocks, 0),
      epi: numOr(st.epi, 0),
      amio: numOr(st.amio, 0),
      epiIntervals: iv,
      epiOnInterval: onInterval,
      switches: numOr(st.switches, 0),
      htCorrect: !!st.htCorrect,
      htAttempts: numOr(st.htAttempts, 0),
      airway: str(st.airway),
      iv: !!st.iv,
      outcome: str(st.outcome)
    };
  }

  function loopStats(st) {
    var sc = obj(st.scores), k, ordered = 0, acked = 0, reported = 0;
    for (k in sc) {
      if (!Object.prototype.hasOwnProperty.call(sc, k)) continue;
      ordered += numOr(sc[k].ordered, 0);
      acked += numOr(sc[k].acked, 0);
      reported += numOr(sc[k].reported, 0);
    }
    return {
      ordered: ordered, acked: acked, reported: reported,
      ackRate: ordered ? clamp(acked / ordered, 0, 1) : -1,
      closeRate: ordered ? clamp(reported / ordered, 0, 1) : -1
    };
  }

  var RUBRIC = [
    { id: 'compress',  max: 12, label: 'Hands on the chest within 10 seconds' },
    { id: 'ccf',       max: 20, label: 'Chest compression fraction (target 80%)' },
    { id: 'rate',      max: 8,  label: 'Compression rate held at 100-120' },
    { id: 'defib',     max: 15, label: 'Correct defibrillation decisions' },
    { id: 'drugs',     max: 14, label: 'Epinephrine on interval, right dose, right route' },
    { id: 'ht',        max: 12, label: 'Reversible cause identified and treated' },
    { id: 'switch',    max: 8,  label: 'Compressor switched each cycle' },
    { id: 'loop',      max: 11, label: 'Closed-loop communication' }
  ];

  function scoreTeam(st) {
    var m = teamMetrics(st), L = loopStats(st), parts = {}, i;
    var shockable = isShockable(st.rhythm) || numOr(st.shocks, 0) > 0 ||
                    caseById(st.caseId).initialRhythm.indexOf('v') === 0;

    parts.compress = (m.timeToCompression < 0) ? 0
      : (m.timeToCompression <= 10000) ? 12
      : (m.timeToCompression <= 30000) ? 7 : 3;

    parts.ccf = Math.round(clamp((m.ccf - 0.35) / 0.45, 0, 1) * 20);
    parts.rate = Math.round(clamp(m.cprQuality, 0, 1) * 8);

    /* Defibrillation is scored as a decision, not as an act. For a shockable
       rhythm the credit is for shocking early; for a non-shockable one the
       credit is for NOT shocking, which is the harder discipline.
       The two ways to get it wrong are counted on the state as they happen -
       an earlier version read them back out of the error prose with indexOf,
       which meant rewording a sentence silently changed the score, and a merely
       badly-phrased "clear" was penalised as heavily as an unsafe shock. */
    var wrongShocks = numOr(st.wrongShocks, 0);
    var unsafeShocks = numOr(st.unsafeShocks, 0);
    if (shockable) {
      parts.defib = (m.timeToShock < 0) ? 0
        : (m.timeToShock <= 60000) ? 15
        : (m.timeToShock <= 120000) ? 11
        : (m.timeToShock <= 240000) ? 6 : 3;
    } else {
      parts.defib = 15;
    }
    parts.defib = Math.max(0, parts.defib - wrongShocks * 8 - unsafeShocks * 5);

    var drugs = 0;
    if (m.epi >= 1) {
      drugs += (m.timeToEpi >= 0 && m.timeToEpi <= 180000) ? 8 : 5;
      if (m.epiIntervals.length) drugs += Math.round(6 * (m.epiOnInterval / m.epiIntervals.length));
      else drugs += 3;
    }
    parts.drugs = Math.min(14, drugs);

    parts.ht = m.htCorrect ? (m.htAttempts <= 2 ? 12 : 9) : 0;

    var expectedSwitches = Math.max(0, m.cycles - 1);
    parts.switch = expectedSwitches ? Math.round(clamp(m.switches / expectedSwitches, 0, 1) * 8) : 8;

    parts.loop = (L.ordered <= 0) ? 4 : Math.round(clamp((L.ackRate * 0.4 + L.closeRate * 0.6), 0, 1) * 11);

    /* ------------------------------------------------------------------
     * THE PATIENT WHO NEVER ARRESTED
     * Two cases can be won before anybody touches the chest. Scoring those
     * against the arrest rubric produced the worst bug in this file: a team
     * that cardioverted unstable VT in ninety seconds - the best possible
     * outcome, the entire point of the case - scored 31/100, because it was
     * marked down for a compression fraction of zero on a patient who had a
     * pulse the whole time. You cannot grade someone on the CPR they were
     * right not to do. When there was no arrest, those rows are not scored
     * at all and the rubric is renormalised over what actually applied.
     * ---------------------------------------------------------------- */
    var neverArrested = !numOr(st.arrestAt, 0);
    var rows;
    if (neverArrested) {
      parts.rescue = 30;
      parts.defib = Math.max(0, 15 - unsafeShocks * 5 - wrongShocks * 8);
      rows = [
        { id: 'rescue', max: 30, label: 'The arrest was prevented' },
        { id: 'defib',  max: 15, label: 'Correct electrical therapy decision' },
        { id: 'ht',     max: 12, label: 'Reversible cause identified and treated' },
        { id: 'loop',   max: 11, label: 'Closed-loop communication' }
      ];
      if (m.epi > 0) rows.splice(2, 0, { id: 'drugs', max: 14, label: 'Drugs given correctly' });
    } else {
      rows = RUBRIC;
    }

    var total = 0, maxTotal = 0;
    for (i = 0; i < rows.length; i++) {
      total += numOr(parts[rows[i].id], 0);
      maxTotal += numOr(rows[i].max, 0);
    }
    total = clamp(Math.round(maxTotal ? (total / maxTotal) * 100 : 0), 0, 100);

    return { parts: parts, total: total, metrics: m, loop: L, rubric: rows, neverArrested: neverArrested };
  }

  function letterFor(n) {
    if (n >= 90) return 'A';
    if (n >= 80) return 'B';
    if (n >= 70) return 'C';
    if (n >= 60) return 'D';
    return 'F';
  }

  var OUTCOME_META = {
    rosc: { label: 'ROSC', tone: 'good', tag: 'tag-green',
      headline: 'Return of spontaneous circulation.',
      body: 'A palpable pulse and an organised rhythm. This is what a well-run code looks like: hands on the chest almost immediately, minimal interruption, and the right treatment for the rhythm in front of you.' },
    rosc_late: { label: 'ROSC - late', tone: 'mixed', tag: 'tag-orange',
      headline: 'Return of spontaneous circulation, but it took too long.',
      body: 'You got a pulse back, and that matters. The metrics below are where it nearly did not happen - a patient who spends longer in arrest with poorer perfusion leaves with a worse brain, even when the heart restarts.' },
    terminated: { label: 'Resuscitation stopped', tone: 'sober', tag: 'tag-blue',
      headline: 'The team stopped resuscitation, and stopping was right.',
      body: 'Prolonged asystole, a secured airway, drugs on interval, good compressions, and no reversible cause. Recognising that and saying it out loud is a clinical judgement, and it is scored here as one. Someone will need to speak to the family, and someone will need to check on this team.' },
    death: { label: 'Death', tone: 'sober', tag: 'tag-red',
      headline: 'The patient died.',
      body: 'This is a practice room, and the point of it is that this happened here instead of on a real unit. Read the timeline below before the score - the score is only a way of pointing at the timeline.' }
  };
  function outcomeMeta(o) { return OUTCOME_META[str(o)] || OUTCOME_META.death; }

  /* ---------------------------------------------------- per-role feedback */

  function roleFeedback(st, uid) {
    var s = scoreOf(st, uid), roles = rolesOfUid(st, uid), m = teamMetrics(st);
    var out = [], i;
    for (i = 0; i < roles.length; i++) {
      var r = roles[i];
      if (r === 'compressions') {
        out.push({
          role: r,
          lines: [
            m.timeToCompression >= 0
              ? 'First compression at ' + fmtSec(m.timeToCompression) + ' after the arrest (target: under 10 seconds).'
              : (numOr(st.arrestAt, 0)
                  ? 'No compressions were ever recorded.'
                  : 'This patient never lost their pulse, so there were no compressions to give. ' +
                    'Not compressing a perfusing patient is the correct action, not a missed one.'),
            numOr(st.arrestAt, 0) ? ('Compression fraction ' + pct(m.ccf) + ' (target: 80% or better).') : '',
            numOr(st.arrestAt, 0) ? ('Rate inside 100-120 for ' + pct(m.cprQuality) + ' of the time you were pushing.') : '',
            'You handed off ' + numOr(s.switches, 0) + ' time' + (numOr(s.switches, 0) === 1 ? '' : 's') +
              ' across ' + m.cycles + ' cycle' + (m.cycles === 1 ? '' : 's') + '.'
          ]
        });
      } else if (r === 'airway') {
        out.push({ role: r, lines: [
          m.timeToAirway >= 0 ? 'First ventilation at ' + fmtSec(m.timeToAirway) + '.' : 'The airway was never supported.',
          'Airway at the end of the code: ' + (st.airway === 'none' ? 'none' : st.airway) + '.',
          st.o2 ? 'High-flow oxygen was connected.' : 'Oxygen was never connected to the bag.'
        ] });
      } else if (r === 'meds') {
        out.push({ role: r, lines: [
          m.iv ? 'Access at ' + fmtSec(m.timeToIv) + '.' : 'No IV or IO access was ever established.',
          m.epi ? (m.epi + ' dose' + (m.epi === 1 ? '' : 's') + ' of epinephrine, first at ' + fmtSec(m.timeToEpi) + '.')
                : 'No epinephrine was given.',
          m.epiIntervals.length ? (m.epiOnInterval + ' of ' + m.epiIntervals.length + ' intervals inside 3-5 minutes.')
                                : 'Not enough doses to judge the interval.'
        ] });
      } else if (r === 'defib') {
        out.push({ role: r, lines: [
          m.timeToShock >= 0 ? 'First shock at ' + fmtClock(m.timeToShock) + '.' : 'No shock was delivered.',
          m.shocks + ' shock' + (m.shocks === 1 ? '' : 's') + ' in total.',
          'Every shock has to be preceded by a real clear - looked at, not just said.'
        ] });
      } else if (r === 'lead') {
        out.push({ role: r, lines: [
          m.htCorrect ? 'Reversible cause identified after ' + m.htAttempts + ' pass' + (m.htAttempts === 1 ? '' : 'es') + ' through the H&Ts.'
                      : 'The reversible cause was never named. For this patient it was ' + htLabel(caseById(st.caseId).cause) + '.',
          numOr(s.ordered, 0) + ' order' + (numOr(s.ordered, 0) === 1 ? '' : 's') + ' given.',
          'Your job was the whole room. Standing back and saying what you see out loud is the job.'
        ] });
      } else if (r === 'recorder') {
        out.push({ role: r, lines: [
          numOr(s.logConfirmed, 0) + ' event' + (numOr(s.logConfirmed, 0) === 1 ? '' : 's') + ' timestamped on time, ' +
            numOr(s.logMissed, 0) + ' late.',
          (numOr(s.quizRight, 0) + numOr(s.quizWrong, 0)) ?
            ('Answered ' + numOr(s.quizRight, 0) + ' of ' + (numOr(s.quizRight, 0) + numOr(s.quizWrong, 0)) +
             ' timing questions correctly.') : 'The lead never asked you for a time.',
          'The record is what the debrief and the chart are built from.'
        ] });
      }
    }
    return out;
  }

  function scoreForPlayer(st, uid) {
    var team = scoreTeam(st);
    var s = scoreOf(st, uid);
    /* Personal = the team's number, moved by this person's own conduct. A
       student on a team that fell apart around them should not take the full
       hit, and a student who made a major error on a winning team should not
       be carried by it. */
    var personal = clamp(Math.round(team.total * 0.65 + clamp(numOr(s.pts, 0), -30, 45) + 18), 0, 100);
    return {
      team: team.total,
      personal: personal,
      letter: letterFor(personal),
      passed: personal >= 75 && numOr(s.major, 0) === 0,
      major: numOr(s.major, 0),
      minor: numOr(s.minor, 0),
      good: arr(s.good),
      errors: arr(s.errors),
      roles: rolesOfUid(st, uid),
      feedback: roleFeedback(st, uid),
      parts: team.parts,
      rubric: team.rubric,
      neverArrested: !!team.neverArrested,
      metrics: team.metrics,
      loop: team.loop
    };
  }

  function shareLine(st, res, name) {
    var m = obj(res).metrics, o = outcomeMeta(st.outcome);
    var k = caseById(st.caseId);
    var never = !numOr(st.arrestAt, 0);
    return 'Code Blue - ' + k.short + ' - ' + o.label + ' in ' + fmtClock(m.durationMs) +
      (never ? '. Arrest prevented' : ('. CCF ' + pct(m.ccf))) + ', ' +
      m.shocks + ' shock' + (m.shocks === 1 ? '' : 's') + ', ' +
      m.epi + ' epi, cause ' + (m.htCorrect ? 'found' : 'missed') + '. ' +
      str(name || 'I') + ' scored ' + obj(res).personal + '/100 on ' +
      arr(obj(res).roles).map(function (r) { return roleMeta(r).label; }).join(' + ') + '. #MedMaster';
  }

  /* ==========================================================================
   * 9. NARRATION
   * The AI narrates beats. It never decides anything. If it is slow, absent,
   * rate-limited or off, CANNED is used instead and the code runs identically -
   * this table is the reason the mode has no AI dependency at all.
   * ======================================================================== */

  var CANNED = {
    open: {
      any: ['The room fills. Somebody drops the head of the bed flat and the backboard goes in.',
            'The code cart crashes through the door. Everyone knows their job. Go.']
    },
    rhythmcheck: {
      vf: ['Compressions pause. The monitor shows coarse VF. No pulse.',
           'Hands off. Still fibrillating - a wide, chaotic tracing. Nothing at the carotid.'],
      vf_fine: ['Hands off. The VF is finer now, the complexes smaller. Still no pulse.',
                'The fibrillation is losing amplitude. The tracing is shallow and quick. No pulse.'],
      pvt: ['Compressions pause. Wide, regular, fast - pulseless VT. No pulse.',
            'Hands off. Monomorphic wide complexes marching across the screen. Nothing at the carotid.'],
      pea: ['Compressions pause. There is a rhythm on the screen - narrow, organised, unhurried. There is no pulse.',
            'Hands off. The monitor looks almost reassuring. Your fingers on the carotid disagree.'],
      asystole: ['Hands off. The line is flat. Confirmed in a second lead. No pulse.',
                 'Compressions pause. Nothing on the monitor but the wander of the cable. Asystole.'],
      any: ['Compressions pause. The team looks at the monitor together.']
    },
    shock: {
      any: ['The chest jumps. Hands are back down before the tone finishes.',
            'The shock lands. Compressions restart immediately - nobody waits to look.']
    },
    wrongshock: {
      any: ['The shock is delivered into an organised rhythm. The room goes quiet for half a second too long.',
            'Energy delivered into a non-shockable rhythm. Somebody at the back of the room says nothing, and should have.']
    },
    epi: { any: ['The syringe empties and the arm goes up with the flush.',
                 'Epinephrine in, flushed, arm elevated. The clock on the next dose starts now.'] },
    ht: { any: ['The lead names the cause out loud and the room reorganises around it.',
                'Somebody finally says the thing everybody was circling.'] },
    arrest: { any: ['The pulse is gone. This is an arrest now.',
                    'The monitor changes and the room changes with it.'] },
    rosc: { any: ['There is a pulse. Strong, regular, and unmistakably there.',
                  'Carotid pulse present. The monitor shows an organised rhythm. She has circulation.'] },
    end: { any: ['The room goes quiet. Someone notes the time.'] },
    handoff: { any: ['The attending is at the door, hand out for the report. Give it in order and give it once.',
                     'The attending arrives. "Talk to me - what have you got?"'] }
  };

  function cannedFor(kind, rhythm, st) {
    var group = CANNED[str(kind)] || CANNED.rhythmcheck;
    var list = group[str(rhythm)] || group.any || CANNED.rhythmcheck.any;
    var i = Math.abs(hashSeed(str(obj(st).seed) + ':' + kind + ':' + numOr(obj(st).beat, 0))) % list.length;
    return list[i];
  }

  function fallbackNarration(st, kind) {
    return {
      narration: cannedFor(kind, st.rhythm, st),
      monitorLine: rhy(st.rhythm).mon,
      promptForRole: null,
      canned: true
    };
  }

  var NARRATOR_SYSTEM = [
    'You are the narrator of a MOCK cardiac arrest that nursing students are running as a practice drill.',
    'This is a study simulation. It is not a real patient and nothing you write is medical advice.',
    'You narrate ONE beat at a time in one or two short, tense, present-tense sentences. You describe the room,',
    'the monitor, and the body. You never decide what the rhythm is, whether the patient survives, or what the',
    'team should have done - the simulator has already decided all of that and it is given to you in the state block.',
    'Your narration must AGREE with the state block exactly. If the state says asystole, nothing on your monitor moves.',
    'Do not congratulate, do not scold, do not teach. The debrief does that later.',
    'Never use the words "AI", "model", "simulation" or "scenario" in the narration itself.',
    '',
    'REPLY WITH ONE JSON OBJECT AND NOTHING ELSE:',
    '{"narration":"1-2 sentences, under 220 characters",',
    ' "monitorLine":"a short monitor readout line, under 70 characters, or null",',
    ' "promptForRole":{"role":"lead|compressions|airway|meds|defib|recorder","text":"under 90 characters"} or null}',
    'promptForRole is a nudge to whoever should act next, phrased as something a person in the room would say.'
  ].join('\n');

  function beatUserMessage(st, kind) {
    var k = caseById(st.caseId);
    var L = [];
    L.push('=== STATE BLOCK (authoritative - your narration must match it) ===');
    L.push('CASE: ' + k.title + ' - ' + k.patient);
    L.push('BEAT: ' + kind);
    L.push('ELAPSED: ' + fmtClock(numOr(st.tickAt, 0) - numOr(st.startedAt, 0)));
    L.push('CYCLE: ' + numOr(st.cycle, 1));
    L.push('RHYTHM: ' + rhy(st.rhythm).label + ' (' + (isShockable(st.rhythm) ? 'shockable' : 'not shockable') + ')');
    L.push('PULSE: ' + (rhy(st.rhythm).pulse ? 'present' : 'absent'));
    L.push('COMPRESSION FRACTION SO FAR: ' + pct(ccf(st)));
    L.push('SHOCKS: ' + numOr(st.shocks, 0) + '  EPINEPHRINE DOSES: ' + numOr(st.epi, 0) +
           '  AMIODARONE: ' + numOr(st.amio, 0));
    L.push('AIRWAY: ' + str(st.airway) + '  IV ACCESS: ' + (st.iv ? 'yes' : 'no'));
    L.push('REVERSIBLE CAUSE: ' + (st.htCorrect ? (htLabel(k.cause) + ' - identified and being treated')
                                                : 'not yet identified by the team'));
    if (st.outcome) L.push('OUTCOME: ' + str(st.outcome));
    L.push('');
    L.push('Narrate this beat.');
    return L.join('\n');
  }

  function parseNarration(raw) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
    var whole = str(raw).trim();
    if (!whole) return null;
    var attempts = [], seen = {};
    function add(v) {
      var s = str(v).trim();
      if (!s || seen[s]) return;
      seen[s] = true;
      attempts.push(s);
    }
    add(whole);
    var fenced = /^```[a-zA-Z]*\s*([\s\S]*?)\s*```\s*$/.exec(whole);
    if (fenced) add(fenced[1]);
    var any = /```[a-zA-Z]*\s*([\s\S]*?)```/.exec(whole);
    if (any) add(any[1]);
    var a = whole.indexOf('{'), b = whole.lastIndexOf('}');
    if (a !== -1 && b > a) add(whole.slice(a, b + 1));
    var i, v;
    for (i = 0; i < attempts.length; i++) {
      try { v = JSON.parse(attempts[i]); if (v && typeof v === 'object' && !Array.isArray(v)) return v; }
      catch (e) { /* next shape */ }
    }
    for (i = 0; i < attempts.length; i++) {
      try {
        v = JSON.parse(attempts[i].replace(/,\s*([\]}])/g, '$1'));
        if (v && typeof v === 'object' && !Array.isArray(v)) return v;
      } catch (e) { /* next shape */ }
    }
    return null;
  }

  var ROLE_IDS = ['lead', 'compressions', 'airway', 'meds', 'defib', 'recorder'];

  function normalizeNarration(parsed, st, kind) {
    var p = obj(parsed);
    var n = cut(str(p.narration).trim(), 260);
    if (!n) return fallbackNarration(st, kind);
    var mon = str(p.monitorLine).trim();
    var pr = obj(p.promptForRole);
    var role = str(pr.role).toLowerCase();
    return {
      narration: n,
      monitorLine: mon ? cut(mon, 90) : rhy(st.rhythm).mon,
      promptForRole: (ROLE_IDS.indexOf(role) !== -1 && str(pr.text).trim())
        ? { role: role, text: cut(str(pr.text).trim(), 110) } : null,
      canned: false
    };
  }

  var FRIENDLY_ERR = {
    'no-auth': 'The narrator needs you signed in. The code itself runs either way.',
    'tier-denied': 'Your plan does not include the AI narrator. The code runs on its own script instead.',
    'quota-exceeded': 'Out of AI messages for today - they reset at midnight Eastern. Running on the written script.',
    'ai-disabled': 'AI narration is switched off right now. Running on the written script.',
    'network': 'Could not reach the narrator. Running on the written script.',
    'server': 'The narrator hit a snag. Running on the written script.'
  };
  function errText(e) {
    var code = (e && e.code) ? e.code : 'server';
    return FRIENDLY_ERR[code] || FRIENDLY_ERR.server;
  }

  var NARRATION_TIMEOUT_MS = 9000;

  /**
   * narrateBeat(st, kind) -> Promise<narration>. NEVER rejects.
   *
   * Hard-capped at NARRATION_TIMEOUT_MS. A code cannot wait on a model: the
   * cycle clock is still running while the narrator thinks, so a slow reply is
   * simply abandoned and the canned line is used. That is the only honest
   * behaviour when the thing being narrated has a two-minute deadline.
   */
  function narrateBeat(st, kind) {
    var ai = aiApi();
    if (!isFn(ai.chat)) return Promise.resolve(fallbackNarration(st, kind));
    if (isFn(ai.isAvailable)) {
      var ok = false;
      try { ok = !!ai.isAvailable(); } catch (e) { ok = false; }
      if (!ok) return Promise.resolve(fallbackNarration(st, kind));
    }
    var call;
    try {
      call = ai.chat({
        system: NARRATOR_SYSTEM,
        messages: [{ role: 'user', content: beatUserMessage(st, kind) }],
        maxTokens: 260,
        temperature: 0.75,
        json: true,
        feature: 'codeblue'
      });
    } catch (e) { return Promise.resolve(fallbackNarration(st, kind)); }

    var timeout = new Promise(function (resolve) {
      setTimeout(function () { resolve({ __timeout: true }); }, NARRATION_TIMEOUT_MS);
    });
    return Promise.race([Promise.resolve(call), timeout]).then(function (raw) {
      if (obj(raw).__timeout) return fallbackNarration(st, kind);
      var parsed = parseNarration(raw);
      if (!parsed) return fallbackNarration(st, kind);
      return normalizeNarration(parsed, st, kind);
    }, function (e) {
      var fb = fallbackNarration(st, kind);
      fb.err = errText(e);
      fb.errCode = (e && e.code) ? e.code : 'server';
      return fb;
    });
  }

  var DEBRIEF_SYSTEM = [
    'You are an experienced code team debriefer running a hot debrief with nursing students immediately after a',
    'PRACTICE mock code. This is a study drill, not a real patient.',
    'Write 150-220 words of plain prose, no headings, no bullet points, no markdown.',
    'Structure: one sentence naming what the team did well and meaning it; then the single most important thing',
    'that would change the outcome next time, said concretely and with the number from the data attached to it;',
    'then one sentence of what to practise. Speak to the team as "you".',
    'If the patient died, open by acknowledging it plainly and without drama, and do not use the words "failed",',
    '"lost" or "unfortunately". Teaching first, score second.',
    'Never mention being an AI. Never invent a number that is not in the data.'
  ].join('\n');

  function debriefUserMessage(st, res) {
    var m = obj(res).metrics, L = [], k = caseById(st.caseId);
    L.push('CASE: ' + k.title);
    L.push('OUTCOME: ' + outcomeMeta(st.outcome).label);
    L.push('DURATION: ' + fmtClock(m.durationMs) + ' over ' + m.cycles + ' cycles');
    L.push('TIME TO FIRST COMPRESSION: ' + (m.timeToCompression >= 0 ? fmtSec(m.timeToCompression) : 'never'));
    L.push('CHEST COMPRESSION FRACTION: ' + pct(m.ccf) + ' (target 80%)');
    L.push('RATE IN THE 100-120 BAND: ' + pct(m.cprQuality) + ' of compression time');
    L.push('TIME TO FIRST SHOCK: ' + (m.timeToShock >= 0 ? fmtClock(m.timeToShock) : 'no shock delivered'));
    L.push('SHOCKS: ' + m.shocks + '   EPINEPHRINE DOSES: ' + m.epi + '   AMIODARONE: ' + m.amio);
    L.push('EPINEPHRINE INTERVALS ON TARGET: ' + m.epiOnInterval + ' of ' + m.epiIntervals.length);
    L.push('COMPRESSOR SWITCHES: ' + m.switches + ' across ' + m.cycles + ' cycles');
    L.push('REVERSIBLE CAUSE: ' + (m.htCorrect ? 'identified (' + htLabel(k.cause) + ')'
                                               : 'MISSED - it was ' + htLabel(k.cause)));
    L.push('CLOSED LOOP: ' + obj(res).loop.ordered + ' orders, ' + obj(res).loop.acked +
           ' acknowledged, ' + obj(res).loop.reported + ' reported back');
    L.push('TEAM SCORE: ' + obj(res).team + '/100');
    L.push('');
    L.push('Debrief this team.');
    return L.join('\n');
  }

  function aiDebrief(st, res) {
    var ai = aiApi();
    if (!isFn(ai.chat)) return Promise.resolve(null);
    if (isFn(ai.isAvailable)) {
      var ok = false;
      try { ok = !!ai.isAvailable(); } catch (e) { ok = false; }
      if (!ok) return Promise.resolve(null);
    }
    var call;
    try {
      call = ai.chat({
        system: DEBRIEF_SYSTEM,
        messages: [{ role: 'user', content: debriefUserMessage(st, res) }],
        maxTokens: 700, temperature: 0.5, feature: 'codeblue'
      });
    } catch (e) { return Promise.resolve(null); }
    return Promise.resolve(call).then(function (t) {
      var s = str(t).trim();
      return s ? cut(s, 2200) : null;
    }, function (e) { return { __err: errText(e) }; });
  }

  /* ==========================================================================
   * 10. SOLO PRACTICE - AI TEAMMATES
   * Most sessions are one student at 11pm. Solo has to be the same engine, not
   * a lesser one: the bots hold the other roles and act on a plausible clock,
   * with short utterances so the room does not feel empty. The human's own role
   * is never touched by a bot - if you are on compressions, nobody compresses
   * for you.
   * ======================================================================== */

  var BOT_NAMES = ['Priya', 'Devon', 'Marisol', 'Owen', 'Tasha', 'Bekele'];

  function botSay(role, text) { return { role: role, text: text }; }

  /**
   * botStep(st, now, mine) -> array of events the AI teammates take this tick.
   * Deterministic given the state, so a solo run is as replayable as a team one.
   */
  function botStep(st, now, mine) {
    var out = [], k = caseById(st.caseId);
    var has = function (r) { return mine.indexOf(r) === -1 && !!uidForRole(st, r); };
    var el = now - numOr(st.startedAt, now);
    var since = function (t0) { return t0 ? (now - t0) : 1e9; };

    if (st.phase === 'ended' || st.phase === 'briefing') return out;

    /* airway */
    if (has('airway')) {
      var au = uidForRole(st, 'airway');
      if (!st.o2 && el > 6000) out.push({ type: 'o2', uid: au, payload: {} });
      if (st.airway === 'none' && el > 12000) {
        out.push({ type: 'airway', uid: au, payload: { kind: 'bvm' } });
        out.push({ type: 'bot_say', uid: au, payload: { text: 'Airway: "Bagging, two-person seal, good chest rise."' } });
      } else if (st.airway === 'bvm' && el > 150000) {
        out.push({ type: 'airway', uid: au, payload: { kind: 'sga' } });
      }
    }
    /* meds */
    if (has('meds')) {
      var mu = uidForRole(st, 'meds');
      if (!st.iv && el > 20000) {
        out.push({ type: 'iv', uid: mu, payload: {} });
        out.push({ type: 'bot_say', uid: mu, payload: { text: 'Meds: "IV is in, 18 in the right AC, running wide open."' } });
      } else if (st.iv && st.arrested) {
        var needEpi = (numOr(st.epi, 0) === 0)
          ? (isShockable(st.rhythm) ? numOr(st.shocks, 0) >= 1 || el > 130000 : el > 25000)
          : since(st.lastEpiAt) > 210000;
        if (needEpi) {
          var eo = epiOptions(k), oid = 'a', ii;
          for (ii = 0; ii < eo.length; ii++) { if (eo[ii].ok) oid = eo[ii].id; }
          out.push({ type: 'epi', uid: mu, payload: { optId: oid } });
          out.push({ type: 'bot_say', uid: mu, payload: { text: 'Meds: "Epinephrine ' + k.epiText + ', in and flushed."' } });
        } else if (isShockable(st.rhythm) && numOr(st.shocks, 0) >= 2 && numOr(st.amio, 0) === 0) {
          var ao = amioOptions(k, 0), aid = 'a', jj;
          for (jj = 0; jj < ao.length; jj++) { if (ao[jj].ok) aid = ao[jj].id; }
          out.push({ type: 'amio', uid: mu, payload: { optId: aid } });
        }
      }
    }
    /* defib */
    if (has('defib')) {
      var du = uidForRole(st, 'defib');
      if (isShockable(st.rhythm) && st.arrested) {
        if (!st.chargedAt && since(st.lastShockAt) > 20000) {
          out.push({ type: 'charge', uid: du, payload: { joules: 200 } });
        } else if (st.chargedAt && !st.clearedAt && since(st.chargedAt) > 3000) {
          out.push({ type: 'clear', uid: du, payload: {} });
          out.push({ type: 'bot_say', uid: du, payload: { text: 'Defib: "Charged. I am clear, you are clear, everybody clear."' } });
        } else if (st.clearedAt && since(st.clearedAt) > 1500 && !st.cprOn) {
          out.push({ type: 'shock', uid: du, payload: {} });
        }
      }
    }
    /* compressions - a bot compressor keeps a realistic, imperfect fraction */
    if (has('compressions') && st.phase === 'running' && st.arrested) {
      var cu2 = uidForRole(st, 'compressions');
      var intoCycle = now - numOr(st.cycleStartedAt, now);
      if (intoCycle > SWITCH_OK_MS && numOr(st.lastSwitchAt, 0) < numOr(st.cycleStartedAt, 0)) {
        var free = [], rr = obj(st.roles), kk;
        for (kk in rr) {
          if (!Object.prototype.hasOwnProperty.call(rr, kk)) continue;
          if (kk !== 'compressions' && kk !== 'lead' && str(rr[kk]) !== cu2 && mine.indexOf(kk) === -1) free.push(str(rr[kk]));
        }
        if (free.length) {
          out.push({ type: 'switch', uid: cu2, payload: { toUid: free[0] } });
          out.push({ type: 'bot_say', uid: cu2, payload: { text: 'Compressions: "Switching on the next check - I am getting tired."' } });
        }
      }
    }
    /* lead */
    if (has('lead')) {
      var lu = uidForRole(st, 'lead');
      if (!st.htCorrect && el > 95000 && numOr(st.htAttempts, 0) < 1) {
        out.push({ type: 'ht', uid: lu, payload: { cause: k.cause } });
        out.push({ type: 'bot_say', uid: lu, payload: { text: 'Lead: "Running the H&Ts - I think this is ' + htLabel(k.cause) + '."' } });
      }
    }
    /* recorder */
    if (has('recorder')) {
      var ru = uidForRole(st, 'recorder');
      var pend = obj(st.pendingLog);
      if (pend.id) out.push({ type: 'log_confirm', uid: ru, payload: { id: pend.id } });
    }
    return out;
  }

  /* ==========================================================================
   * 11. STYLES
   * Injected once. Every colour is a CSS variable with a hard-coded fallback so
   * the module still looks right if it is ever loaded outside the app shell.
   * Everything below is designed at 360px first and allowed to grow.
   * ======================================================================== */

  var STYLE_ID = 'codeblue-styles';
  function injectStyles() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.cb-wrap{max-width:1080px;margin:0 auto}',
      '.cb-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}',
      '.cb-h h2{margin:0;font-size:1.15rem;color:var(--text,#f1f5f9);flex:1 1 160px;min-width:0}',
      '.cb-sub{color:var(--text2,#94a3b8);font-size:var(--fs-sm,13px);line-height:var(--lh-normal,1.5)}',
      '.cb-card{background:var(--surface,#1e293b);border:1px solid var(--border,#334155);',
      'border-radius:var(--r-lg,14px);padding:var(--sp-4,16px);margin-bottom:12px}',
      '.cb-card h3{margin:0 0 8px;font-size:0.95rem;color:var(--text,#f1f5f9)}',
      '.cb-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.cb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}',
      '.cb-muted{color:var(--text3,#64748b);font-size:var(--fs-xs,12px)}',

      /* ---- monitor ---- */
      '.cb-mon{background:#04110c;border:1px solid var(--border,#334155);border-radius:var(--r-lg,14px);',
      'overflow:hidden;position:relative}',
      '.cb-mon-top{display:flex;align-items:center;gap:8px;padding:8px 10px;flex-wrap:wrap;',
      'border-bottom:1px solid rgba(255,255,255,0.07)}',
      '.cb-mon-name{font-weight:700;font-size:var(--fs-sm,13px);color:#8ef7c4;letter-spacing:.04em}',
      '.cb-mon-rate{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:800;font-size:1.1rem;color:#8ef7c4}',
      '.cb-mon-line{padding:6px 10px 9px;font-size:var(--fs-sm,13px);color:var(--text,#f1f5f9);line-height:1.45}',
      '.cb-ecg{height:74px;overflow:hidden;background:#04110c}',
      '.cb-ecg-svg{display:block;width:100%;height:74px}',
      '.cb-ecg-g{will-change:transform}',
      '.cb-ecg-run{animation-name:cbSweep;animation-timing-function:linear;animation-iteration-count:infinite}',
      '@keyframes cbSweep{from{transform:translateX(0)}to{transform:translateX(-300px)}}',
      '.cb-ecg-static .cb-ecg-g{transform:translateX(0)}',
      '.cb-mon-tag{font-size:var(--fs-2xs,11px);font-weight:800;letter-spacing:.08em;padding:2px 7px;',
      'border-radius:var(--r-full,999px);border:1px solid currentColor}',

      /* ---- clock ---- */
      '.cb-clock{display:flex;align-items:baseline;gap:8px;justify-content:center;padding:6px 0}',
      '.cb-clock-big{font-size:2.6rem;font-weight:800;font-variant-numeric:tabular-nums;line-height:1;',
      'color:var(--text,#f1f5f9)}',
      '.cb-clock-warn{color:var(--orange,#f59e0b)}',
      '.cb-clock-hot{color:var(--red,#ef4444)}',
      '.cb-clock-lab{font-size:var(--fs-xs,12px);color:var(--text2,#94a3b8);text-transform:uppercase;letter-spacing:.08em}',
      '.cb-chips{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:6px}',
      '.cb-chip{font-size:var(--fs-2xs,11px);padding:3px 8px;border-radius:var(--r-full,999px);',
      'background:var(--surface3,#334155);color:var(--text2,#94a3b8);font-variant-numeric:tabular-nums}',
      '.cb-chip.hot{background:rgba(239,68,68,0.18);color:var(--red,#ef4444)}',
      '.cb-chip.ok{background:rgba(34,197,94,0.16);color:var(--green,#22c55e)}',

      /* ---- roles ---- */
      '.cb-roles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}',
      '.cb-role{background:var(--surface,#1e293b);border:1px solid var(--border,#334155);',
      'border-radius:var(--r-md,10px);padding:8px 10px;min-width:0}',
      '.cb-role.mine{border-color:var(--accent,#3b82f6);background:var(--tint-accent,rgba(59,130,246,0.12))}',
      '.cb-role-t{display:flex;align-items:center;gap:6px;font-size:var(--fs-xs,12px);font-weight:700;',
      'color:var(--text,#f1f5f9)}',
      '.cb-role-w{font-size:var(--fs-xs,12px);color:var(--text2,#94a3b8);margin-top:2px;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '.cb-dot{width:7px;height:7px;border-radius:50%;background:var(--green,#22c55e);flex:0 0 auto}',
      '.cb-dot.off{background:var(--red,#ef4444)}',
      '.cb-dot.idle{background:var(--text3,#64748b)}',

      /* ---- compression pad ---- */
      '.cb-pad{width:100%;min-height:120px;border-radius:var(--r-lg,14px);border:2px solid var(--red,#ef4444);',
      'background:rgba(239,68,68,0.10);color:var(--text,#f1f5f9);font-weight:800;font-size:1.05rem;',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;',
      'touch-action:manipulation;user-select:none;-webkit-user-select:none;padding:10px}',
      '.cb-pad:active{background:rgba(239,68,68,0.28);transform:scale(0.995)}',
      '.cb-pad:focus-visible{outline:3px solid var(--accent,#3b82f6);outline-offset:2px}',
      '.cb-pad.good{border-color:var(--green,#22c55e);background:rgba(34,197,94,0.13)}',
      '.cb-pad.pulse{animation:cbPad .38s ease-out}',
      '@keyframes cbPad{0%{box-shadow:0 0 0 0 rgba(239,68,68,.55)}100%{box-shadow:0 0 0 16px rgba(239,68,68,0)}}',
      '.cb-meter{height:12px;border-radius:var(--r-full,999px);background:var(--surface3,#334155);',
      'position:relative;overflow:hidden;margin-top:8px}',
      '.cb-meter-band{position:absolute;top:0;bottom:0;background:rgba(34,197,94,0.28)}',
      '.cb-meter-i{position:absolute;top:-3px;width:4px;height:18px;border-radius:2px;background:var(--text,#f1f5f9)}',
      '.cb-meter-lab{display:flex;justify-content:space-between;font-size:var(--fs-2xs,11px);',
      'color:var(--text3,#64748b);margin-top:3px}',

      /* ---- actions ---- */
      '.cb-act{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px}',
      '.cb-btn{border:1px solid var(--border,#334155);background:var(--surface2,#334155);',
      'color:var(--text,#f1f5f9);border-radius:var(--r-md,10px);padding:11px 12px;font-size:var(--fs-sm,13px);',
      'font-weight:600;cursor:pointer;text-align:left;line-height:1.35;min-height:44px}',
      '.cb-btn:hover:not(:disabled){border-color:var(--accent,#3b82f6)}',
      '.cb-btn:focus-visible{outline:3px solid var(--accent,#3b82f6);outline-offset:2px}',
      '.cb-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.cb-btn.danger{border-color:var(--red,#ef4444);color:var(--red,#ef4444)}',
      '.cb-btn.go{background:var(--accent,#3b82f6);border-color:var(--accent,#3b82f6);color:#fff}',
      '.cb-btn.warn{border-color:var(--orange,#f59e0b);color:var(--orange,#f59e0b)}',
      '.cb-sect{border-top:1px solid var(--border,#334155);padding-top:10px;margin-top:10px}',
      '.cb-sect:first-child{border-top:none;padding-top:0;margin-top:0}',
      '.cb-sect-t{display:flex;align-items:center;gap:6px;font-size:var(--fs-xs,12px);font-weight:800;',
      'text-transform:uppercase;letter-spacing:.07em;color:var(--text2,#94a3b8);margin-bottom:8px}',

      /* ---- order / closed loop ---- */
      '.cb-order{border:1px solid var(--accent,#3b82f6);background:var(--tint-accent,rgba(59,130,246,0.12));',
      'border-radius:var(--r-md,10px);padding:10px 12px;margin-bottom:10px}',
      '.cb-order-t{font-weight:700;color:var(--text,#f1f5f9);font-size:var(--fs-sm,13px)}',

      /* ---- log ---- */
      '.cb-log{max-height:260px;overflow-y:auto;font-size:var(--fs-xs,12px);line-height:1.5}',
      '.cb-log.big{max-height:420px;font-size:var(--fs-sm,13px)}',
      '.cb-log-i{display:flex;gap:8px;padding:4px 0;border-bottom:1px dashed rgba(148,163,184,0.14)}',
      '.cb-log-t{flex:0 0 44px;font-variant-numeric:tabular-nums;color:var(--text3,#64748b)}',
      '.cb-log-x{flex:1 1 auto;min-width:0;color:var(--text2,#94a3b8);overflow-wrap:anywhere}',
      '.cb-log-i.err .cb-log-x{color:var(--red,#ef4444);font-weight:600}',
      '.cb-log-i.rhythm .cb-log-x{color:var(--text,#f1f5f9);font-weight:600}',
      '.cb-log-i.say .cb-log-x{font-style:italic}',
      '.cb-log-i.unconf{background:rgba(245,158,11,0.10)}',

      /* ---- narration ---- */
      '.cb-narr{border-left:3px solid var(--accent2,#8b5cf6);background:var(--bg,#0f172a);',
      'padding:10px 12px;border-radius:0 var(--r-md,10px) var(--r-md,10px) 0;color:var(--text,#f1f5f9);',
      'font-size:var(--fs-sm,13px);line-height:1.55;margin-bottom:10px}',
      '.cb-narr small{display:block;color:var(--text3,#64748b);margin-top:4px;font-size:var(--fs-2xs,11px)}',

      /* ---- lobby ---- */
      '.cb-room{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border,#334155);',
      'border-radius:var(--r-md,10px);background:var(--surface,#1e293b);margin-bottom:8px;flex-wrap:wrap}',
      '.cb-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;letter-spacing:.22em;',
      'font-size:1.05rem;color:var(--accent,#3b82f6)}',
      '.cb-codebig{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;letter-spacing:.3em;',
      'font-size:2rem;color:var(--accent,#3b82f6);text-align:center}',
      '.cb-in{width:100%;box-sizing:border-box;background:var(--bg,#0f172a);color:var(--text,#f1f5f9);',
      'border:1px solid var(--border,#334155);border-radius:var(--r-md,10px);padding:11px 12px;font-size:16px}',
      '.cb-in:focus{outline:2px solid var(--accent,#3b82f6);outline-offset:1px}',
      '.cb-seg{display:flex;gap:6px;flex-wrap:wrap}',
      '.cb-seg button{flex:1 1 92px;border:1px solid var(--border,#334155);background:var(--surface,#1e293b);',
      'color:var(--text2,#94a3b8);border-radius:var(--r-md,10px);padding:9px 8px;font-size:var(--fs-sm,13px);',
      'font-weight:600;cursor:pointer;min-height:40px}',
      '.cb-seg button[aria-pressed="true"]{border-color:var(--accent,#3b82f6);color:var(--text,#f1f5f9);',
      'background:var(--tint-accent,rgba(59,130,246,0.12))}',
      '.cb-case{text-align:left;display:block;width:100%}',
      '.cb-case b{display:block;color:var(--text,#f1f5f9);font-size:var(--fs-sm,13px)}',
      '.cb-case span{display:block;color:var(--text3,#64748b);font-size:var(--fs-2xs,11px);margin-top:2px}',

      /* ---- debrief ---- */
      '.cb-bars{display:flex;flex-direction:column;gap:8px}',
      '.cb-bar-l{display:flex;justify-content:space-between;font-size:var(--fs-xs,12px);',
      'color:var(--text2,#94a3b8);gap:8px}',
      '.cb-bar{height:8px;border-radius:4px;background:var(--surface3,#334155);overflow:hidden;margin-top:3px}',
      '.cb-bar i{display:block;height:100%;background:var(--accent,#3b82f6)}',
      '.cb-big{font-size:2.4rem;font-weight:800;line-height:1;color:var(--text,#f1f5f9)}',
      '.cb-share{width:100%;box-sizing:border-box;background:var(--bg,#0f172a);color:var(--text2,#94a3b8);',
      'border:1px dashed var(--border,#334155);border-radius:var(--r-md,10px);padding:10px;font-size:var(--fs-xs,12px);',
      'resize:vertical;min-height:64px}',

      '.cb-banner{border-radius:var(--r-md,10px);padding:10px 12px;font-size:var(--fs-sm,13px);margin-bottom:10px}',
      '.cb-banner.warn{background:rgba(245,158,11,0.12);border:1px solid var(--orange,#f59e0b);color:var(--orange,#f59e0b)}',
      '.cb-banner.info{background:var(--tint-accent,rgba(59,130,246,0.12));border:1px solid var(--accent,#3b82f6);color:var(--text,#f1f5f9)}',
      '.cb-banner.bad{background:rgba(239,68,68,0.12);border:1px solid var(--red,#ef4444);color:var(--red,#ef4444)}',

      '.cb-two{display:grid;grid-template-columns:1fr;gap:12px}',
      '@media (min-width:860px){.cb-two{grid-template-columns:1.35fr 1fr}}',
      '@media (max-width:400px){',
      '.cb-clock-big{font-size:2.1rem}.cb-big{font-size:2rem}',
      '.cb-act{grid-template-columns:1fr}',
      '.cb-roles{grid-template-columns:1fr 1fr}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '.cb-ecg-run{animation:none}.cb-pad.pulse{animation:none}.cb-pad:active{transform:none}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ==========================================================================
   * 12. SMALL UI PIECES
   * ======================================================================== */

  function Monitor(props) {
    var p = obj(props);
    var st = obj(p.st);
    var reduce = !!p.reduced;
    var r = rhy(st.rhythm);
    var t = traceFor(st.rhythm);
    var line = str(p.monitorLine) || r.mon;
    return ce('div', { className: 'cb-mon' }, [
      ce('div', { className: 'cb-mon-top', key: 't' }, [
        ce('span', { className: 'cb-mon-name', key: 'n' }, str(p.patient) || 'PATIENT'),
        ce('span', {
          key: 'g', className: 'cb-mon-tag',
          style: { color: r.shockable ? 'var(--red,#ef4444)' : (r.pulse ? 'var(--green,#22c55e)' : 'var(--orange,#f59e0b)') }
        }, t.label),
        ce('span', { className: 'cb-mon-rate', key: 'r' }, t.rate ? t.rate : '--')
      ]),
      ce(EcgStrip, { key: 'e', rhythm: st.rhythm, reduced: reduce }),
      ce('div', { className: 'cb-mon-line', key: 'l', role: 'status', 'aria-live': 'polite' },
        (reduce ? '[static trace - ' + t.label + '] ' : '') + line)
    ]);
  }

  function CycleClock(props) {
    var p = obj(props);
    var st = obj(p.st), now = numOr(p.now, nowMs());
    var remain, label;
    if (st.phase === 'check') {
      remain = Math.max(0, CHECK_MS - (now - numOr(st.checkStartedAt, now)));
      label = 'Rhythm check - hands off';
    } else if (st.phase === 'running') {
      remain = Math.max(0, CYCLE_MS - (now - numOr(st.cycleStartedAt, now)));
      label = 'Cycle ' + numOr(st.cycle, 1) + ' - next rhythm check';
    } else {
      remain = 0;
      label = st.phase === 'ended' ? 'Code ended' : 'Not started';
    }
    var cls = 'cb-clock-big' + (st.phase === 'check' ? ' cb-clock-hot' : (remain <= 20000 && st.phase === 'running' ? ' cb-clock-warn' : ''));
    var sinceEpi = st.lastEpiAt ? (now - st.lastEpiAt) : -1;
    var elapsed = st.startedAt ? (now - st.startedAt) : 0;
    return ce('div', null, [
      ce('div', { className: 'cb-clock', key: 'c' }, [
        ce('span', { className: cls, key: 'v' }, fmtClock(remain)),
        ce('span', { className: 'cb-clock-lab', key: 'l' }, label)
      ]),
      ce('div', { className: 'cb-chips', key: 'k' }, [
        ce('span', { className: 'cb-chip', key: 'e' }, 'Elapsed ' + fmtClock(elapsed)),
        ce('span', {
          className: 'cb-chip' + (sinceEpi < 0 ? '' : (sinceEpi > EPI_MAX_MS ? ' hot' : (sinceEpi >= EPI_MIN_MS ? ' ok' : ''))),
          key: 'p'
        }, sinceEpi < 0 ? 'No epi yet' : 'Last epi ' + fmtClock(sinceEpi) + ' ago'),
        ce('span', { className: 'cb-chip', key: 's' }, numOr(st.shocks, 0) + ' shock' + (numOr(st.shocks, 0) === 1 ? '' : 's')),
        ce('span', { className: 'cb-chip', key: 'f' }, 'CCF ' + pct(ccf(st)))
      ])
    ]);
  }

  function RoleCards(props) {
    var p = obj(props);
    var st = obj(p.st), players = obj(p.players), myUid = str(p.myUid);
    return ce('div', { className: 'cb-roles' }, ROLES.map(function (r) {
      var uid = uidForRole(st, r.id);
      var pl = obj(players[uid]);
      var mine = uid && uid === myUid;
      var conn = pl.connected !== false;
      var name = uid ? (str(pl.name) || 'Player') : 'unfilled';
      return ce('div', { key: r.id, className: 'cb-role' + (mine ? ' mine' : '') }, [
        ce('div', { className: 'cb-role-t', key: 't' }, [
          ce('span', { key: 'i', 'aria-hidden': 'true' }, r.icon),
          ce('span', { key: 'l' }, r.label)
        ]),
        ce('div', { className: 'cb-role-w', key: 'w' }, [
          ce('span', { key: 'd', className: 'cb-dot' + (!uid ? ' idle' : (conn ? '' : ' off')),
            style: { display: 'inline-block', marginRight: '5px' } }),
          name + (mine ? ' (you)' : '') + (uid && !conn ? ' - reconnecting' : '')
        ])
      ]);
    }));
  }

  function EventLog(props) {
    var p = obj(props);
    var log = arr(obj(p.st).log);
    var big = !!p.big;
    var ref = useRef(null);
    useEffect(function () {
      var el = ref.current;
      if (el) { try { el.scrollTop = el.scrollHeight; } catch (e) {} }
    }, [log.length]);
    if (!log.length) return ce('div', { className: 'cb-muted' }, 'Nothing has happened yet.');
    return ce('div', { className: 'cb-log' + (big ? ' big' : ''), ref: ref, role: 'log', 'aria-live': 'polite' },
      log.map(function (l) {
        var cls = 'cb-log-i ' + str(l.kind) + (l.rec && !l.confirmed ? ' unconf' : '');
        return ce('div', { key: l.id, className: cls }, [
          ce('span', { className: 'cb-log-t', key: 't' }, fmtClock(numOr(l.el, 0))),
          ce('span', { className: 'cb-log-x', key: 'x' }, str(l.text))
        ]);
      }));
  }

  function RateMeter(props) {
    var p = obj(props);
    var rate = numOr(p.rate, 0);
    var lo = 60, hi = 160;
    var x = clamp((rate - lo) / (hi - lo), 0, 1) * 100;
    var bandL = ((CPR_LOW - lo) / (hi - lo)) * 100;
    var bandW = ((CPR_HIGH - CPR_LOW) / (hi - lo)) * 100;
    return ce('div', null, [
      ce('div', { className: 'cb-meter', key: 'm' }, [
        ce('div', { className: 'cb-meter-band', key: 'b', style: { left: bandL + '%', width: bandW + '%' } }),
        rate > 0 ? ce('div', { className: 'cb-meter-i', key: 'i', style: { left: 'calc(' + x + '% - 2px)' } }) : null
      ]),
      ce('div', { className: 'cb-meter-lab', key: 'l' }, [
        ce('span', { key: 'a' }, '60'),
        ce('span', { key: 'b' }, rate > 0 ? (rate + ' / min') : 'no compressions'),
        ce('span', { key: 'c' }, '160')
      ])
    ]);
  }

  /* --------------------------------------------------------- the CPR pad */

  /**
   * useTapRate(opts) - turns taps into a rate in compressions per minute.
   *
   * The rate is the median of the last few gaps, not the mean: one fumbled tap
   * while you reposition should not throw the meter across the screen, and a
   * median of five is the smallest window that ignores a single outlier while
   * still reacting inside two seconds.
   *
   * `onSample` is throttled - it ends up as an RTDB write on the compressor's
   * own /players/<uid>/cpr node and nobody needs 110 writes a minute.
   */
  function useTapRate(opts) {
    var o = obj(opts);
    var target = numOr(o.targetLow, CPR_LOW), high = numOr(o.targetHigh, CPR_HIGH);
    var h = useState(0);
    var rate = h[0], setRate = h[1];
    var pulseH = useState(0);
    var pulse = pulseH[0], setPulse = pulseH[1];
    var taps = useRef([]);
    var lastSent = useRef(0);
    var onSample = o.onSample;
    var sendMs = numOr(o.sendMs, 700);

    var tap = useCallback(function () {
      var t = nowMs();
      var list = taps.current.concat([t]);
      /* Anything older than four seconds is a different burst of CPR, not this
         one, and averaging across the gap invents a rate nobody performed. */
      list = list.filter(function (x) { return t - x < 4500; }).slice(-7);
      taps.current = list;
      var gaps = [], i;
      for (i = 1; i < list.length; i++) gaps.push(list[i] - list[i - 1]);
      var r = 0;
      if (gaps.length >= 2) {
        var srt = gaps.slice().sort(function (a, b) { return a - b; });
        var med = srt[Math.floor(srt.length / 2)];
        if (med > 0) r = Math.round(60000 / med);
      }
      setRate(r);
      setPulse(t);
      if (isFn(onSample) && (t - lastSent.current) >= sendMs) {
        lastSent.current = t;
        try { onSample({ rate: r, at: t }); } catch (e) {}
      }
    }, [onSample, sendMs]);

    /* Stop reporting once the taps stop, so the host sees hands-off promptly
       instead of the last rate hanging around looking like ongoing CPR. */
    useEffect(function () {
      var iv = setInterval(function () {
        var last = taps.current.length ? taps.current[taps.current.length - 1] : 0;
        if (last && (nowMs() - last) > CPR_FRESH_MS) {
          taps.current = [];
          setRate(0);
        }
      }, 600);
      return function () { clearInterval(iv); };
    }, []);

    return { rate: rate, tap: tap, pulse: pulse, inBand: rate >= target && rate <= high };
  }

  function CompressionPad(props) {
    var p = obj(props);
    var enabled = !!p.enabled;
    var pad = useTapRate({ onSample: p.onSample, targetLow: CPR_LOW, targetHigh: CPR_HIGH });
    var reduce = !!p.reduced;
    var heldWarn = useState(false);
    var warn = heldWarn[0], setWarn = heldWarn[1];

    useEffect(function () {
      if (!enabled) return undefined;
      var down = function (e) {
        if (e.code !== 'Space' && e.key !== ' ') return;
        var tgt = e.target;
        var tag = tgt && tgt.tagName ? String(tgt.tagName).toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        /* Holding the key down fires key-repeat at ~30/s. Counting those would
           make "lean on the spacebar" the optimal strategy, so repeats are
           dropped and the student is told why. */
        if (e.repeat) { setWarn(true); return; }
        setWarn(false);
        pad.tap();
      };
      try { window.addEventListener('keydown', down); } catch (e) {}
      return function () { try { window.removeEventListener('keydown', down); } catch (e) {} };
    }, [enabled, pad.tap]);

    var cls = 'cb-pad' + (pad.inBand ? ' good' : '') + (!reduce && pad.pulse ? ' pulse' : '');
    return ce('div', null, [
      ce('button', {
        key: 'pad', type: 'button', className: cls, disabled: !enabled,
        onClick: function () { if (enabled) pad.tap(); },
        'aria-label': 'Compression pad. Tap in rhythm, target 100 to 120 per minute. Current rate ' +
          (pad.rate || 'zero') + ' per minute.'
      }, [
        ce('span', { key: 'a', style: { fontSize: '1.6rem' } }, pad.rate ? pad.rate : '--'),
        ce('span', { key: 'b', style: { fontSize: 'var(--fs-xs,12px)', fontWeight: 600, opacity: 0.85 } },
          enabled ? 'compressions / min - tap here or press SPACE' : 'you are not on compressions'),
        ce('span', { key: 'c', style: { fontSize: 'var(--fs-2xs,11px)', opacity: 0.7 } },
          pad.inBand ? 'in the band - hold this' : 'target 100-120')
      ]),
      ce(RateMeter, { key: 'm', rate: pad.rate }),
      warn ? ce('div', { className: 'cb-muted', key: 'w', style: { marginTop: 6 } },
        'Holding the spacebar down does not count. Press and release it in rhythm.') : null,
      p.switchDue ? ce('div', { className: 'cb-banner warn', key: 's', style: { marginTop: 8 } },
        'Two minutes is up. Call the switch - fatigue starts costing depth long before you feel it.') : null
    ]);
  }

  function BagButton(props) {
    var p = obj(props);
    var bag = useTapRate({ onSample: p.onSample, targetLow: 8, targetHigh: 12, sendMs: 1200 });
    return ce('div', null, [
      ce('button', {
        key: 'b', type: 'button', className: 'cb-btn' + (bag.inBand ? ' go' : ''),
        style: { width: '100%' }, disabled: !p.enabled,
        onClick: function () { if (p.enabled) bag.tap(); }
      }, 'Squeeze the bag' + (bag.rate ? ' - ' + bag.rate + '/min' : '')),
      ce('div', { className: 'cb-muted', key: 'h', style: { marginTop: 4 } },
        p.advanced ? 'Advanced airway in: one breath every 6 seconds, 10 a minute, and do not stop compressions.'
                   : 'Thirty compressions to two breaths until there is an advanced airway. Do not hyperventilate.')
    ]);
  }

  /* --------------------------------------------------------- action panel */

  function Section(props) {
    var p = obj(props);
    return ce('div', { className: 'cb-sect' }, [
      ce('div', { className: 'cb-sect-t', key: 't' }, [
        ce('span', { key: 'i', 'aria-hidden': 'true' }, str(p.icon)),
        ce('span', { key: 'l' }, str(p.title))
      ]),
      p.children
    ]);
  }

  function OptionPicker(props) {
    var p = obj(props);
    var opts = arr(p.options);
    return ce('div', { className: 'cb-act' }, opts.map(function (o) {
      return ce('button', {
        key: o.id, type: 'button', className: 'cb-btn', disabled: !!p.disabled,
        onClick: function () { if (isFn(p.onPick)) p.onPick(o); }
      }, o.text);
    }));
  }

  /**
   * ActionPanel - everything the signed-in player may do right now, grouped by
   * the roles they hold. A student holding three roles in a 2-person code sees
   * three sections in a fixed order, so the layout never reshuffles under their
   * thumb mid-code.
   */
  function ActionPanel(props) {
    var p = obj(props);
    var st = obj(p.st), myUid = str(p.myUid), send = p.send;
    var now = numOr(p.now, nowMs());
    var kase = caseById(st.caseId);
    var mine = rolesOfUid(st, myUid);
    var players = obj(p.players);
    var pickH = useState('');
    var picking = pickH[0], setPicking = pickH[1];

    if (!mine.length) {
      return ce('div', { className: 'cb-card' },
        ce('div', { className: 'cb-muted' },
          (st.phase === 'briefing')
            ? 'Waiting to be dealt a role. Roles are handed out in join order and the host will start when the team is set.'
            : 'You are observing this code - the room was already full when you arrived. You will still see ' +
              'everything, and you will still get the debrief.'));
    }

    var running = st.phase === 'running' || st.phase === 'check';
    var out = [];
    var order = obj(st.order);
    var myOrder = (order.id && order.toUid === myUid && !order.doneAt) ? order : null;

    if (myOrder) {
      out.push(ce('div', { className: 'cb-order', key: 'ord' }, [
        ce('div', { className: 'cb-order-t', key: 't' }, 'Team lead: "' + str(myOrder.text) + '"'),
        ce('div', { className: 'cb-row', key: 'b', style: { marginTop: 8 } }, [
          !myOrder.ackAt ? ce('button', {
            key: 'a', type: 'button', className: 'cb-btn go',
            onClick: function () { send('ack', { id: myOrder.id }); }
          }, 'Say it back - "' + cut(str(myOrder.text), 40) + ', got it"') : null,
          myOrder.ackAt ? ce('button', {
            key: 'r', type: 'button', className: 'cb-btn go',
            onClick: function () { send('report', { id: myOrder.id }); }
          }, 'Report back - done') : null
        ])
      ]));
    }

    /* ---------------------------------------------------------- lead */
    if (mine.indexOf('lead') !== -1) {
      var htOpen = picking === 'ht';
      out.push(ce(Section, { key: 'lead', icon: '🧭', title: 'Team Lead' }, [
        ce('div', { className: 'cb-act', key: 'a' }, [
          ce('button', {
            key: 'rc', type: 'button', className: 'cb-btn', disabled: !running || st.phase === 'check',
            onClick: function () { send('rhythm_check', {}); }
          }, 'Order a rhythm check'),
          ce('button', {
            key: 'rs', type: 'button', className: 'cb-btn go', disabled: st.phase !== 'check',
            onClick: function () { send('resume', {}); }
          }, 'Resume compressions'),
          ce('button', {
            key: 'ht', type: 'button', className: 'cb-btn' + (st.htCorrect ? '' : ' warn'), disabled: !running || st.htCorrect,
            onClick: function () { setPicking(htOpen ? '' : 'ht'); }
          }, st.htCorrect ? 'Cause found: ' + htLabel(kase.cause) : 'Call an H&T review'),
          ce('button', {
            key: 'q', type: 'button', className: 'cb-btn', disabled: !running || !st.epi,
            onClick: function () { send('ask_time', {}); }
          }, 'Ask the recorder for the last epi time'),
          ce('button', {
            key: 'o', type: 'button', className: 'cb-btn', disabled: !running,
            onClick: function () { setPicking(picking === 'order' ? '' : 'order'); }
          }, 'Give an order'),
          ce('button', {
            key: 'x', type: 'button', className: 'cb-btn danger', disabled: !running,
            onClick: function () {
              if (typeof window.confirm === 'function' &&
                  !window.confirm('Stop the resuscitation and call the time of death?')) return;
              send('terminate', {});
            }
          }, 'Stop the resuscitation')
        ]),
        htOpen ? ce('div', { key: 'htp', style: { marginTop: 8 } }, [
          ce('div', { className: 'cb-muted', key: 'h' }, 'Which reversible cause fits this patient?'),
          ce('div', { className: 'cb-act', key: 'g', style: { marginTop: 6 } }, HT_LIST.map(function (h) {
            return ce('button', {
              key: h.id, type: 'button', className: 'cb-btn',
              onClick: function () { setPicking(''); send('ht', { cause: h.id }); }
            }, h.label);
          }))
        ]) : null,
        picking === 'order' ? ce('div', { key: 'op', style: { marginTop: 8 } },
          ce('div', { className: 'cb-act' }, [
            { r: 'compressions', t: 'Resume compressions' },
            { r: 'compressions', t: 'Switch compressors' },
            { r: 'defib', t: 'Charge to 200 and stand by' },
            { r: 'defib', t: 'Shock now' },
            { r: 'meds', t: 'Get me access' },
            { r: 'meds', t: 'One milligram of epi' },
            { r: 'airway', t: 'Secure the airway' },
            { r: 'recorder', t: 'Mark the time' }
          ].map(function (o, i) {
            return ce('button', {
              key: i, type: 'button', className: 'cb-btn',
              onClick: function () { setPicking(''); send('order', { role: o.r, text: o.t }); }
            }, roleMeta(o.r).icon + ' ' + o.t);
          }))) : null,
        (st.roleMode === 'leader') ? ce('div', { key: 'as', style: { marginTop: 8 } }, [
          ce('div', { className: 'cb-muted', key: 'l' }, 'Reassign a role (this is graded too - the right person on the right job).'),
          ce('div', { className: 'cb-act', key: 'g', style: { marginTop: 6 } }, ROLES.slice(1).map(function (r) {
            return ce('select', {
              key: r.id, className: 'cb-in', value: uidForRole(st, r.id),
              onChange: function (e) { send('assign', { role: r.id, toUid: e.target.value }); },
              'aria-label': 'Assign ' + r.label
            }, [ce('option', { key: '', value: '' }, r.label + ': unassigned')].concat(
              keys(players).map(function (u) {
                return ce('option', { key: u, value: u }, r.label + ': ' + (str(obj(players[u]).name) || 'Player'));
              })));
          }))
        ]) : null,
        st.terminationAppropriate ? ce('div', { className: 'cb-banner warn', key: 'tw', style: { marginTop: 8 } },
          'Prolonged asystole, airway secured, drugs on interval, good compressions, no reversible cause found. ' +
          'This is the point at which continuing and stopping are both defensible, and the decision is yours.') : null
      ]));
    }

    /* -------------------------------------------------- compressions */
    if (mine.indexOf('compressions') !== -1) {
      var intoCycle = now - numOr(st.cycleStartedAt, now);
      var others = keys(players).filter(function (u) {
        return u !== myUid && obj(players[u]).connected !== false;
      });
      out.push(ce(Section, { key: 'comp', icon: '🫀', title: 'Compressions' }, [
        ce(CompressionPad, {
          key: 'pad', enabled: running && st.phase === 'running' && st.arrested,
          onSample: p.onCprSample, reduced: !!p.reduced,
          switchDue: intoCycle > SWITCH_OK_MS
        }),
        ce('div', { className: 'cb-act', key: 'sw', style: { marginTop: 8 } },
          others.length ? others.map(function (u) {
            return ce('button', {
              key: u, type: 'button', className: 'cb-btn' + (intoCycle > SWITCH_OK_MS ? ' go' : ''),
              disabled: !running,
              onClick: function () { send('switch', { toUid: u }); }
            }, 'Switch with ' + (str(obj(players[u]).name) || 'them'));
          }) : [ce('div', { className: 'cb-muted', key: 'n' }, 'Nobody is free to take over.')])
      ]));
    }

    /* -------------------------------------------------------- airway */
    if (mine.indexOf('airway') !== -1) {
      out.push(ce(Section, { key: 'air', icon: '💨', title: 'Airway' }, [
        ce(BagButton, { key: 'bag', enabled: running, onSample: p.onVentSample, advanced: st.airway === 'advanced' }),
        ce('div', { className: 'cb-act', key: 'a', style: { marginTop: 8 } }, [
          ce('button', { key: 'o2', type: 'button', className: 'cb-btn', disabled: !running || st.o2,
            onClick: function () { send('o2', {}); } }, st.o2 ? 'Oxygen connected' : 'Connect oxygen at 15 L'),
          ce('button', { key: 'opa', type: 'button', className: 'cb-btn', disabled: !running,
            onClick: function () { send('airway', { kind: 'opa' }); } }, 'Insert an oral airway'),
          ce('button', { key: 'bvm', type: 'button', className: 'cb-btn', disabled: !running,
            onClick: function () { send('airway', { kind: 'bvm' }); } }, 'Two-person bag-mask'),
          ce('button', { key: 'sga', type: 'button', className: 'cb-btn', disabled: !running,
            onClick: function () { send('airway', { kind: 'sga' }); } }, 'Place a supraglottic airway')
        ])
      ]));
    }

    /* ---------------------------------------------------------- meds */
    if (mine.indexOf('meds') !== -1) {
      var showEpi = picking === 'epi', showAmio = picking === 'amio';
      out.push(ce(Section, { key: 'meds', icon: '💉', title: 'Meds / IV' }, [
        ce('div', { className: 'cb-act', key: 'a' }, [
          ce('button', { key: 'iv', type: 'button', className: 'cb-btn' + (st.iv ? '' : ' go'), disabled: !running || st.iv,
            onClick: function () { send('iv', {}); } }, st.iv ? 'Access established' : 'Establish IV / IO access'),
          ce('button', { key: 'e', type: 'button', className: 'cb-btn', disabled: !running,
            onClick: function () { setPicking(showEpi ? '' : 'epi'); } }, 'Draw up epinephrine'),
          ce('button', { key: 'am', type: 'button', className: 'cb-btn', disabled: !running,
            onClick: function () { setPicking(showAmio ? '' : 'amio'); } }, 'Draw up amiodarone')
        ]),
        showEpi ? ce('div', { key: 'ep', style: { marginTop: 8 } }, [
          ce('div', { className: 'cb-muted', key: 'h' }, 'State the dose out loud before you push it.'),
          ce(OptionPicker, {
            key: 'o', options: epiOptions(kase),
            onPick: function (o) { setPicking(''); send('epi', { optId: o.id }); }
          })
        ]) : null,
        showAmio ? ce('div', { key: 'ap', style: { marginTop: 8 } }, [
          ce('div', { className: 'cb-muted', key: 'h' }, 'State the dose out loud before you push it.'),
          ce(OptionPicker, {
            key: 'o', options: amioOptions(kase, numOr(st.amio, 0)),
            onPick: function (o) { setPicking(''); send('amio', { optId: o.id }); }
          })
        ]) : null
      ]));
    }

    /* --------------------------------------------------------- defib */
    if (mine.indexOf('defib') !== -1) {
      var charged = !!st.chargedAt;
      var cleared = st.clearedAt && (now - st.clearedAt) < CLEAR_WINDOW;
      out.push(ce(Section, { key: 'def', icon: '⚡', title: 'Defib / Monitor' }, [
        ce('div', { className: 'cb-act', key: 'a' }, [
          ce('button', { key: 'c', type: 'button', className: 'cb-btn' + (!charged ? ' go' : ''), disabled: !running || charged,
            onClick: function () { send('charge', { joules: 200 }); } }, charged ? 'Charged to ' + st.joules + ' J' : 'Charge to 200 J'),
          ce('button', { key: 'l', type: 'button', className: 'cb-btn' + (charged && !cleared ? ' go' : ''), disabled: !running,
            onClick: function () { send('clear', {}); } }, 'Call CLEAR and look'),
          ce('button', {
            key: 's', type: 'button', className: 'cb-btn danger', disabled: !running || !charged,
            onClick: function () { send('shock', {}); }
          }, (!st.arrested && st.rhythm === 'vt_pulse') ? 'Synchronised cardioversion' : 'Deliver the shock')
        ]),
        ce('div', { className: 'cb-muted', key: 'h', style: { marginTop: 6 } },
          (!st.arrested && st.rhythm === 'vt_pulse')
            ? 'She still has a pulse. This is unstable VT WITH a pulse - synchronised cardioversion, not defibrillation, ' +
              'and doing it now is how this patient never becomes an arrest.'
            : isShockable(st.rhythm)
              ? 'This rhythm is shockable. Charge while compressions continue, clear, shock, then straight back on the chest.'
              : 'This rhythm is NOT shockable. Shocking it now would be a major error - it needs compressions, epinephrine and the cause.')
      ]));
    }

    /* ------------------------------------------------------ recorder */
    if (mine.indexOf('recorder') !== -1) {
      var pend = obj(st.pendingLog);
      var quiz = obj(st.quiz);
      out.push(ce(Section, { key: 'rec', icon: '📋', title: 'Recorder' }, [
        pend.id ? ce('div', { className: 'cb-banner info', key: 'p' }, [
          ce('div', { key: 't' }, 'Log this: ' + str(pend.text)),
          ce('button', {
            key: 'b', type: 'button', className: 'cb-btn go', style: { marginTop: 8 },
            onClick: function () { send('log_confirm', { id: pend.id }); }
          }, 'Timestamp it at ' + fmtClock(numOr(pend.at, 0) - numOr(st.startedAt, 0)))
        ]) : ce('div', { className: 'cb-muted', key: 'p' }, 'Nothing waiting to be logged. Keep watching.'),
        quiz.id ? ce('div', { className: 'cb-banner warn', key: 'q', style: { marginTop: 8 } }, [
          ce('div', { key: 't' }, str(quiz.q)),
          ce('div', { className: 'cb-act', key: 'o', style: { marginTop: 8 } }, arr(quiz.options).map(function (o, i) {
            return ce('button', {
              key: i, type: 'button', className: 'cb-btn',
              onClick: function () { send('quiz', { id: quiz.id, answer: o }); }
            }, o);
          }))
        ]) : null,
        ce('div', { key: 'l', style: { marginTop: 10 } }, ce(EventLog, { st: st, big: true }))
      ]));
    }

    return ce('div', { className: 'cb-card' }, out);
  }

  /* ==========================================================================
   * 13. TRANSPORT
   * Two ways to run exactly the same engine.
   *
   *   useSoloCode  - everything in memory, AI teammates on the other roles.
   *   useRoomCode  - the host runs the engine and writes /state; everyone
   *                  submits write-once events under /events.
   *
   * Both hand the UI the same three things: a state object, a players map, and
   * a send(type, payload) function. Nothing below the transport knows which
   * one it is running under, which is why solo cannot silently rot.
   * ======================================================================== */

  var MAX_AI_BEATS = 14;   // hard ceiling on model calls in one code

  /** Shared beat->narration driver. Host-only in a room; the only client in solo. */
  function useNarrator(stRef, bump, active) {
    var seen = useRef({ beat: -1, calls: 0, busy: false });
    useEffect(function () {
      if (!active) return undefined;
      var alive = true;
      var iv = setInterval(function () {
        var st = stRef.current;
        if (!st || !alive) return;
        var beat = numOr(st.beat, 0);
        var s = seen.current;
        if (beat === s.beat || s.busy) return;
        s.beat = beat;
        if (beat === 0) return;
        var kind = str(st.lastBeatKind) || 'rhythmcheck';
        /* Past the ceiling we do not stop narrating - we stop *paying* for it.
           The canned line goes in instantly and the code never notices. */
        if (s.calls >= MAX_AI_BEATS) {
          var fb = fallbackNarration(st, kind);
          st.narration = { text: fb.narration, monitor: fb.monitorLine, prompt: fb.promptForRole, at: nowMs(), canned: true };
          bump();
          return;
        }
        s.busy = true;
        s.calls++;
        var snapshot = deepCopy(st);
        narrateBeat(snapshot, kind).then(function (n) {
          s.busy = false;
          if (!alive) return;
          var cur = stRef.current;
          if (!cur) return;
          cur.narration = {
            text: str(n.narration), monitor: str(n.monitorLine),
            prompt: n.promptForRole || null, at: nowMs(), canned: !!n.canned,
            err: n.err ? str(n.err) : ''
          };
          bump();
        }, function () { s.busy = false; });
      }, 400);
      return function () { alive = false; clearInterval(iv); };
    }, [active, bump, stRef]);
  }

  function botPlayers(cfg, myUid, myName) {
    var size = clamp(Math.round(numOr(obj(cfg).teamSize, 4)), 2, 6);
    var mySlot = clamp(Math.round(numOr(obj(cfg).mySlot, 0)), 0, size - 1);
    var ids = [], players = {}, i, b = 0;
    for (i = 0; i < size; i++) {
      if (i === mySlot) {
        ids.push(myUid);
        players[myUid] = { name: str(myName) || 'You', joinedAt: i, connected: true, bot: false };
      } else {
        var id = 'bot' + (b + 1);
        ids.push(id);
        players[id] = { name: BOT_NAMES[b % BOT_NAMES.length], joinedAt: i, connected: true, bot: true };
        b++;
      }
    }
    return { ids: ids, players: players };
  }

  function useSoloCode(cfg, myUid, myName) {
    var stRef = useRef(null);
    var teamRef = useRef(null);
    var h = useState(0);
    var rev = h[0], setRev = h[1];
    var cprRef = useRef({ rate: 0, at: 0 });
    var ventRef = useRef({ rate: 0, at: 0 });
    var bump = useCallback(function () { setRev(function (n) { return n + 1; }); }, []);

    if (!stRef.current) {
      var team = botPlayers(cfg, myUid, myName);
      teamRef.current = team;
      var st = createState(cfg);
      assignRoles(st, team.ids);
      stRef.current = st;
    }

    var send = useCallback(function (type, payload) {
      var st = stRef.current;
      if (!st) return;
      applyEvent(st, { type: type, uid: myUid, payload: payload || {} }, nowMs());
      bump();
    }, [myUid, bump]);

    useEffect(function () {
      var iv = setInterval(function () {
        var st = stRef.current;
        if (!st) return;
        var now = nowMs();
        if (st.phase === 'ended' || st.phase === 'briefing') { st.tickAt = now; return; }
        var mine = rolesOfUid(st, myUid);
        if (mine.indexOf('compressions') !== -1) feedCpr(st, now, cprRef.current);
        else {
          /* A bot on compressions holds a believable, imperfect fraction: about
             nine seconds on, one second off, and a rate that drifts around 112.
             Deterministic, so a solo run replays exactly. */
          var cyc = (now - numOr(st.cycleStartedAt, now)) % 10000;
          feedCpr(st, now, { rate: 108 + Math.round(Math.sin(now / 9000) * 6), at: (cyc < 9000 ? now : 0) });
        }
        if (mine.indexOf('airway') !== -1) feedVent(st, now, ventRef.current);
        tick(st, now);
        var evs = botStep(st, now, mine), i;
        for (i = 0; i < evs.length; i++) applyEvent(st, evs[i], now);
        st.rev = numOr(st.rev, 0) + 1;
        bump();
      }, TICK_MS);
      return function () { clearInterval(iv); };
    }, [myUid, bump]);

    useNarrator(stRef, bump, true);

    return {
      st: stRef.current,
      players: obj(teamRef.current).players || {},
      send: send,
      isHost: true,
      solo: true,
      rev: rev,
      onCprSample: function (s) { cprRef.current = s; },
      onVentSample: function (s) { ventRef.current = s; }
    };
  }

  /* ------------------------------------------------------------- the room */

  function roomBase(db, id) { return db.ref('codeblue/rooms/' + id); }

  function useRoomCode(roomId, myUid, myName, db) {
    var stRef = useRef(null);
    var h = useState(0);
    var rev = h[0], setRev = h[1];
    var metaH = useState(null);
    var meta = metaH[0], setMeta = metaH[1];
    var playersH = useState({});
    var players = playersH[0], setPlayers = playersH[1];
    var errH = useState('');
    var err = errH[0], setErr = errH[1];
    var staleH = useState(false);
    var hostStale = staleH[0], setHostStale = staleH[1];

    var appliedRef = useRef({});
    var hostRef = useRef('');
    var playersRef = useRef({});
    var metaRef = useRef({});
    var freshRef = useRef({});          // uid -> local ms when lastSeen last changed
    var beatRef = useRef({ v: -1, at: 0 });
    var writeRef = useRef(0);
    var cprRef = useRef({ rate: 0, at: 0 });
    var ventRef = useRef({ rate: 0, at: 0 });
    var bump = useCallback(function () { setRev(function (n) { return n + 1; }); }, []);

    var hostId = str(obj(meta).hostId);
    var isHost = !!hostId && hostId === myUid;
    /* /hostId and /cfg are separate reads of separate paths and they land in
       whatever order the network gives them. The host must not build the engine
       until the room's own settings have actually arrived: a state created from
       an absent cfg silently runs the default case, at the default difficulty,
       for the default team size, in the default role mode - a completely
       different exercise from the one the host set up, with nothing on screen
       to say so. */
    var cfgReady = !!obj(meta).cfgReady;

    /* metaRef, hostRef and playersRef are deliberately NOT refreshed here. They
       are written the instant the data lands (see patchMeta and the /players
       listener below), because the things that read them - the host engine
       loop, the event consumer, the promotion timer - are not React consumers.
       A ref filled in during render is only as current as the last commit, and
       a commit is not guaranteed to have happened before the next tick: React
       may batch several snapshots into one render, delay it, or throw an
       in-progress one away. Two bugs came out of exactly that gap - the host
       building engine state from a cfg that had not been rendered yet, and the
       host dealing roles from a roster that was missing the student who had
       just walked in - and both of them are silent and unrecoverable once the
       code is running. */
    var patchMeta = useCallback(function (patch) {
      var n = shallow(metaRef.current), k;
      for (k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) n[k] = patch[k];
      }
      metaRef.current = n;
      hostRef.current = str(n.hostId);
      setMeta(n);
    }, []);

    /* ---- meta + players + state subscriptions ---- */
    useEffect(function () {
      if (!db || !roomId) return undefined;
      var base = roomBase(db, roomId);
      var hRef = base.child('hostId'), stRef2 = base.child('status');
      var pRef = base.child('players'), sRef = base.child('state');
      /* The room's own fields are read one at a time on purpose. Subscribing to
         the whole $roomId node would stream /state and /events to every client
         on every host tick, which is the single most expensive mistake this
         file could make. */
      var onH = hRef.on('value', function (snap) {
        patchMeta({ hostId: str(snap.val()) });
      }, function () { setErr('Lost the connection to this room.'); });
      var onSt = stRef2.on('value', function (snap) {
        patchMeta({ status: str(snap.val()) });
      });
      try {
        base.child('cfg').once('value', function (snap) {
          patchMeta({ cfg: obj(snap.val()), cfgReady: true });
        }, function () { patchMeta({ cfgReady: true }); });
        base.child('hostName').once('value', function (snap) {
          patchMeta({ hostName: str(snap.val()) });
        });
        base.child('name').once('value', function (snap) {
          patchMeta({ name: str(snap.val()) });
        });
      } catch (e) { patchMeta({ cfgReady: true }); }
      var onP = pRef.on('value', function (snap) {
        var v = obj(snap.val()), k, now = nowMs();
        for (k in v) {
          if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
          var prev = obj(freshRef.current[k]);
          var ls = numOr(obj(v[k]).lastSeen, 0);
          if (prev.ls !== ls) freshRef.current[k] = { ls: ls, at: now };
        }
        playersRef.current = v;
        setPlayers(v);
      });
      var onS = sRef.on('value', function (snap) {
        var v = snap.val();
        if (!v) return;
        /* The host is the author of state; echoing its own write back over the
           live object would undo everything applied since. */
        if (hostRef.current === myUid && stRef.current) return;
        stRef.current = v;
        var b = numOr(v.hostBeat, 0);
        if (b !== beatRef.current.v) beatRef.current = { v: b, at: nowMs() };
        bump();
      });
      return function () {
        hRef.off('value', onH); stRef2.off('value', onSt);
        pRef.off('value', onP); sRef.off('value', onS);
      };
      /* meta is deliberately not a dependency: re-subscribing on every host
         heartbeat would tear the listeners down once a second. The host check
         inside goes through hostRef, which the meta listener keeps current
         without a render, so there is nothing stale to read. */
    }, [db, roomId, myUid, bump, patchMeta]);

    /* ---- presence ---- */
    useEffect(function () {
      if (!db || !roomId || !myUid) return undefined;
      var me = roomBase(db, roomId).child('players').child(myUid);
      /* clearInterval does not un-queue a callback that has already been
         scheduled. Without this flag a heartbeat that was already in flight when
         the student left would land AFTER the cleanup and re-mark them
         connected, leaving a ghost in the room that never times out - and, if
         they were the host, one that nobody is allowed to replace. */
      var alive = true;
      var beat = function () {
        if (!alive) return;
        try { me.update({ name: str(myName) || 'Player', lastSeen: nowMs(), connected: true }); } catch (e) {}
      };
      /* Announce first, ask questions afterwards. Registering has to be the very
         first thing this effect does, with no read in front of it: until
         /players/<uid> exists the host's roster does not contain this student,
         and a host who presses Start in that window deals them out of the code
         entirely - they spend the whole arrest as an observer. Gating the write
         behind a round trip made that window as long as the connection is slow,
         which is precisely backwards. update() (not set()) so nothing already
         under the node - joinedAt, cpr, vent - is disturbed. */
      beat();
      try {
        me.once('value', function (snap) {
          if (!alive) return;
          var cur = obj(snap.val());
          /* joinedAt is written once and never again: it is the tie-break that
             decides who inherits the code if the host drops, and a refresh must
             not send a student to the back of that queue. So it is filled in
             here, after the read, and only when it is genuinely absent. */
          if (!numOr(cur.joinedAt, 0)) me.update({ joinedAt: nowMs() });
        });
      } catch (e) {}
      try { if (isFn(me.onDisconnect)) me.onDisconnect().update({ connected: false, lastSeen: nowMs() }); } catch (e) {}
      var iv = setInterval(beat, PRESENCE_MS);
      return function () {
        alive = false;
        clearInterval(iv);
        try { me.update({ connected: false, lastSeen: nowMs() }); } catch (e) {}
      };
    }, [db, roomId, myUid, myName]);

    /* ---- submitting an action ---- */
    var send = useCallback(function (type, payload) {
      if (!db || !roomId) return;
      try {
        roomBase(db, roomId).child('events').push({
          type: str(type), uid: myUid, payload: payload || {}, t: nowMs()
        });
      } catch (e) { setErr('That action did not reach the room. Check your connection.'); }
    }, [db, roomId, myUid]);

    /* ---- host: consume events ---- */
    useEffect(function () {
      /* Not before the engine exists. An event that arrives with no state to
         apply it to is marked as seen and thrown away, and child_added replays
         everything already in the node when we do subscribe, so waiting costs
         nothing and losing the first event costs the whole code. */
      if (!db || !roomId || !isHost || !cfgReady) return undefined;
      var evRef = roomBase(db, roomId).child('events');
      var onAdd = evRef.on('child_added', function (snap) {
        var key = str(snap.key);
        if (appliedRef.current[key]) return;
        var st = stRef.current;
        /* A promoted host inherits state that already includes everything up to
           lastEventKey. Push keys sort chronologically, so anything at or below
           that mark has already been paid for. */
        if (st && str(st.lastEventKey) && key <= str(st.lastEventKey)) { appliedRef.current[key] = 1; return; }
        appliedRef.current[key] = 1;
        if (!st) return;
        var body = obj(snap.val());
        /* Deal the roles from the CURRENT players map at the exact moment the
           code starts. The 1s tick already re-deals during the briefing, but a
           host who presses Start in the same second that the last teammate
           joins would otherwise freeze a deal that predates them - and that
           student spends the whole code as an observer with no way back in.
           Doing it here closes the window completely. */
        if (str(body.type) === 'start' && st.phase === 'briefing' && st.roleMode !== 'leader') {
          dealFromPlayers(st, playersRef.current, myUid);
        }
        applyEvent(st, body, nowMs());
        st.lastEventKey = key;
        bump();
      });
      return function () { evRef.off('child_added', onAdd); };
    }, [db, roomId, isHost, cfgReady, myUid, bump]);

    /* ---- host: the engine loop ---- */
    useEffect(function () {
      if (!db || !roomId || !isHost || !cfgReady) return undefined;
      var base = roomBase(db, roomId);
      var alive = true;

      if (!stRef.current) {
        var st0 = createState(obj(metaRef.current.cfg));
        /* The host always takes slot zero - it holds 'lead', and the host is the
           person the room is already looking at. */
        dealFromPlayers(st0, playersRef.current, myUid);
        stRef.current = st0;
      }

      var iv = setInterval(function () {
        if (!alive) return;
        var st = stRef.current;
        if (!st) return;
        var now = nowMs();
        var players = playersRef.current;
        var meta = metaRef.current;
        /* Roles are re-dealt on every tick until the code starts, so somebody
           who walks in thirty seconds late still gets a job. The instant the
           code is running they freeze - a role changing hands mid-compression
           because a phone reconnected would be worse than an empty role. */
        if (st.phase === 'briefing' && st.roleMode !== 'leader') dealFromPlayers(st, players, myUid);
        var cu = uidForRole(st, 'compressions');
        var au = uidForRole(st, 'airway');
        var sample = (cu === myUid) ? cprRef.current : obj(obj(players[cu]).cpr);
        feedCpr(st, now, sample);
        feedVent(st, now, (au === myUid) ? ventRef.current : obj(obj(players[au]).vent));
        tick(st, now);

        /* A role whose owner has been gone longer than the rejoin grace is
           reassigned to whoever is carrying the least. Inside the grace we do
           nothing at all - a student who refreshed gets their job back. */
        if (st.phase === 'running' || st.phase === 'check') {
          var rk = keys(st.roles), i, changed = false;
          for (i = 0; i < rk.length; i++) {
            var owner = str(st.roles[rk[i]]);
            var f = obj(freshRef.current[owner]);
            var gone = owner && obj(players[owner]).connected === false &&
                       f.at && (now - f.at) > REJOIN_MS;
            if (!gone) continue;
            var cand = keys(players).filter(function (u) { return obj(players[u]).connected !== false; })
              .sort(function (a, b) { return rolesOfUid(st, a).length - rolesOfUid(st, b).length; })[0];
            if (cand && cand !== owner) {
              st.roles = shallow(st.roles);
              st.roles[rk[i]] = cand;
              logLine(st, 'lead', roleMeta(rk[i]).label + ' picked up by ' +
                (str(obj(players[cand]).name) || 'a teammate') + ' - the original player has not come back.', cand);
              changed = true;
            }
          }
          if (changed) bump();
        }

        st.hostBeat = now;
        st.rev = numOr(st.rev, 0) + 1;
        bump();
        if ((now - writeRef.current) >= 900) {
          writeRef.current = now;
          try { base.child('state').set(scrub(st)); } catch (e) {}
        }
        if (st.phase === 'ended' && str(obj(meta).status) !== 'done') {
          try { base.child('status').set('done'); } catch (e) {}
        }
        if (st.phase !== 'briefing' && str(obj(meta).status) === 'open') {
          try { base.child('status').set('running'); } catch (e) {}
        }
      }, TICK_MS);

      return function () { alive = false; clearInterval(iv); };
    }, [db, roomId, isHost, cfgReady, myUid, bump]);

    /* ---- everyone: watch for a dead host and promote ---- */
    useEffect(function () {
      if (!db || !roomId || !myUid) return undefined;
      if (isHost) return undefined;
      var iv = setInterval(function () {
        var players = playersRef.current;
        var meta = metaRef.current;
        var b = beatRef.current;
        if (!b.at) { beatRef.current = { v: b.v, at: nowMs() }; return; }
        if ((nowMs() - b.at) < HOST_GRACE_MS) { setHostStale(false); return; }
        setHostStale(true);
        var stale = str(obj(meta).hostId);
        if (!stale || stale === myUid) return;
        /* Longest tenured *connected* player wins, uid as the tie-break so two
           clients cannot both believe they are next. */
        var eligible = keys(players).filter(function (u) {
          if (u === stale) return false;
          var f = obj(freshRef.current[u]);
          if (obj(players[u]).connected === false) return false;
          return !f.at || (nowMs() - f.at) < (PRESENCE_MS * 4);
        }).sort(function (a, b2) {
          var d = joinRank(players[a]) - joinRank(players[b2]);
          return d !== 0 ? d : (a < b2 ? -1 : 1);
        });
        if (eligible[0] !== myUid) return;
        /* hostId lives at the room root, next to createdAt and status, because
           that is where the deployed .indexOn for the lobby query expects it. */
        var ref = roomBase(db, roomId).child('hostId');
        try {
          ref.transaction(function (cur) {
            /* Write-if-unchanged. If somebody else already promoted, cur is no
               longer the stale id and we abort by returning undefined. */
            if (str(cur) !== stale) return undefined;
            return myUid;
          }, function (e2, committed) {
            if (committed) {
              beatRef.current = { v: -1, at: nowMs() };
              try {
                MMx().toast && MMx().toast('The host dropped out. You are running the code now.', 'info');
              } catch (e3) {}
            }
          });
        } catch (e) {}
      }, 2000);
      return function () { clearInterval(iv); };
    }, [db, roomId, myUid, isHost]);

    useNarrator(stRef, bump, isHost);

    return {
      st: stRef.current, players: players, meta: meta, send: send,
      isHost: isHost, solo: false, rev: rev, error: err, hostStale: hostStale,
      onCprSample: function (s) {
        cprRef.current = s;
        if (db && roomId && myUid) {
          try { roomBase(db, roomId).child('players').child(myUid).child('cpr').set(s); } catch (e) {}
        }
      },
      onVentSample: function (s) {
        ventRef.current = s;
        if (db && roomId && myUid) {
          try { roomBase(db, roomId).child('players').child(myUid).child('vent').set(s); } catch (e) {}
        }
      }
    };
  }

  /* ==========================================================================
   * 14. VOICE
   * The room reuses the app's existing WebRTC mesh by borrowing its roomId
   * namespace: voice for code blue room ABCD lives at rooms/codeblue-ABCD/voice,
   * which is inside the rules that already exist for study rooms.
   * ======================================================================== */

  var NO_VOICE = {
    inVoice: false, voiceParticipants: [], isMuted: false,
    joinVoice: function () {}, leaveVoice: function () {}, toggleMute: function () {},
    audioError: null, unavailable: true
  };

  function useVoiceChatSafe(roomId, myId, myName, db) {
    /* Feature-detected once per mount. MM.useVoiceChat is installed by the app
       shell before any module renders, so this branch is stable for the whole
       life of the component and the hook order never changes. */
    var fn = MMx().useVoiceChat;
    if (isFn(fn) && roomId && db) return fn(roomId, myId, myName, db);
    return NO_VOICE;
  }

  function VoiceStrip(props) {
    var v = obj(props.voice);
    if (v.unavailable) return null;
    var n = arr(v.voiceParticipants).length;
    return ce('div', { className: 'cb-row', style: { marginBottom: 10 } }, [
      ce('button', {
        key: 'j', type: 'button', className: 'cb-btn' + (v.inVoice ? '' : ' go'),
        style: { flex: '0 0 auto' },
        onClick: function () { if (v.inVoice) v.leaveVoice(); else v.joinVoice(); }
      }, v.inVoice ? 'Leave voice' : '🎙️ Join voice'),
      v.inVoice ? ce('button', {
        key: 'm', type: 'button', className: 'cb-btn', style: { flex: '0 0 auto' },
        onClick: v.toggleMute
      }, v.isMuted ? 'Unmute' : 'Mute') : null,
      ce('span', { key: 'c', className: 'cb-muted' },
        v.inVoice ? (n + ' on the call') : 'Codes run on the voice. Join it if you can.'),
      v.audioError ? ce('span', { key: 'e', className: 'cb-muted', style: { color: 'var(--red,#ef4444)' } },
        str(v.audioError)) : null
    ]);
  }

  /* ==========================================================================
   * 15. GAME SCREEN
   * ======================================================================== */

  function GameScreen(props) {
    var p = obj(props);
    var st = obj(p.st);
    var now = useNow(250);
    var reduce = useReducedMotion();
    var kase = caseById(st.caseId);
    var narr = obj(st.narration);
    var players = obj(p.players);
    var mine = rolesOfUid(st, str(p.myUid));

    var connected = 0, total = 0, k;
    for (k in players) {
      if (!Object.prototype.hasOwnProperty.call(players, k)) continue;
      total++;
      if (obj(players[k]).connected !== false) connected++;
    }

    if (st.phase === 'briefing') {
      return ce('div', { className: 'cb-wrap' }, [
        ce('div', { className: 'cb-card', key: 'b' }, [
          ce('h3', { key: 't' }, kase.icon + '  ' + kase.title),
          ce('p', { className: 'cb-sub', key: 'l', style: { marginTop: 6 } }, kase.lead),
          ce('div', { className: 'cb-muted', key: 'm', style: { marginTop: 10 } },
            'You are ' + (mine.length ? mine.map(function (r) { return roleMeta(r).label; }).join(' + ') : 'observing') +
            '. Read your role card, then start when the team is ready.'),
          ce('div', { key: 'r', style: { marginTop: 12 } },
            ce(RoleCards, { st: st, players: players, myUid: p.myUid })),
          mine.length ? ce('div', { className: 'cb-card', key: 'rb', style: { marginTop: 12, marginBottom: 0 } },
            mine.map(function (r) {
              return ce('div', { key: r, style: { marginBottom: 6 } }, [
                ce('b', { key: 'a', style: { color: 'var(--text,#f1f5f9)', fontSize: 'var(--fs-sm,13px)' } },
                  roleMeta(r).icon + ' ' + roleMeta(r).label + ' - '),
                ce('span', { key: 'b', className: 'cb-sub' }, roleMeta(r).blurb)
              ]);
            })) : null,
          ce('div', { className: 'cb-row', key: 'go', style: { marginTop: 14 } }, [
            p.canStart ? ce('button', {
              key: 's', type: 'button', className: 'cb-btn go',
              onClick: function () { p.send('start', {}); }
            }, 'Start the code') : ce('div', { className: 'cb-muted', key: 'w' },
              'Waiting for the host to start the code.'),
            ce('button', { key: 'x', type: 'button', className: 'cb-btn', onClick: p.onLeave }, 'Leave')
          ])
        ])
      ]);
    }

    var prompt = obj(narr.prompt);
    var showPrompt = prompt.role && mine.indexOf(prompt.role) !== -1;

    return ce('div', { className: 'cb-wrap' }, [
      p.voice ? ce(VoiceStrip, { key: 'v', voice: p.voice }) : null,

      (!p.solo && !p.isHost && p.hostStale) ? ce('div', { className: 'cb-banner warn', key: 'hs' },
        'The host has gone quiet. If they do not come back in a moment, one of you will pick the code up automatically.') : null,
      p.error ? ce('div', { className: 'cb-banner bad', key: 'er' }, str(p.error)) : null,

      ce('div', { className: 'cb-two', key: 'main' }, [
        ce('div', { key: 'l' }, [
          ce('div', { className: 'cb-card', key: 'mon', style: { padding: 0, overflow: 'hidden' } },
            ce(Monitor, { st: st, reduced: reduce, patient: kase.patient, monitorLine: narr.monitor })),
          ce('div', { className: 'cb-card', key: 'clk' }, [
            ce(CycleClock, { key: 'c', st: st, now: now }),
            st.phase === 'check' ? ce('div', { className: 'cb-banner warn', key: 'w', style: { marginTop: 10 } },
              'Rhythm check. Hands off the chest. ' +
              (isShockable(st.rhythm) ? 'This is shockable - charge, clear, shock.'
                                      : 'This is not shockable - back on the chest and find the cause.')) : null
          ]),
          narr.text ? ce('div', { className: 'cb-narr', key: 'n' }, [
            ce('span', { key: 't' }, str(narr.text)),
            narr.err ? ce('small', { key: 'e' }, str(narr.err)) : null
          ]) : null,
          showPrompt ? ce('div', { className: 'cb-banner info', key: 'pr' }, '"' + str(prompt.text) + '"') : null,
          ce(ActionPanel, {
            key: 'act', st: st, myUid: p.myUid, send: p.send, now: now, players: players,
            onCprSample: p.onCprSample, onVentSample: p.onVentSample, reduced: reduce
          })
        ]),
        ce('div', { key: 'r' }, [
          ce('div', { className: 'cb-card', key: 'roles' }, [
            ce('h3', { key: 'h' }, [
              ce('span', { key: 'a' }, 'The team '),
              ce('span', { key: 'b', className: 'cb-muted', style: { fontWeight: 400, marginLeft: 6 } },
                connected + ' of ' + total + ' connected')
            ]),
            ce(RoleCards, { key: 'r', st: st, players: players, myUid: p.myUid })
          ]),
          ce('div', { className: 'cb-card', key: 'log' }, [
            ce('h3', { key: 'h' }, 'Event log'),
            ce(EventLog, { key: 'l', st: st })
          ]),
          ce('div', { className: 'cb-card', key: 'x' },
            ce('button', { type: 'button', className: 'cb-btn', onClick: p.onLeave }, 'Leave the code'))
        ])
      ])
    ]);
  }

  /* ==========================================================================
   * 16. DEBRIEF
   * ======================================================================== */

  function persistResult(st, res, uid, name, db, setProgressFn) {
    var kase = caseById(st.caseId);
    var m = obj(res).metrics;
    var rec = {
      simId: 'codeblue-' + kase.id,
      date: new Date().toISOString(),
      score: obj(res).personal,
      maxScore: 100,
      pct: obj(res).personal,
      timeSec: Math.round(numOr(m.durationMs, 0) / 1000),
      missedCritical: m.htCorrect ? [] : ['Reversible cause (' + htLabel(kase.cause) + ') never identified'],
      errors: arr(obj(res).errors).map(function (e) { return str(e.text); }),
      category: str(kase.category),
      mode: 'codeblue',
      letter: obj(res).letter,
      passed: !!obj(res).passed,
      outcome: str(st.outcome),
      role: arr(obj(res).roles).join('+'),
      teamScore: obj(res).team,
      teamSize: numOr(st.teamSize, 0),
      solo: !!st.solo,
      ccf: Math.round(clamp(numOr(m.ccf, 0), 0, 1) * 100)
    };
    var MM = MMx();
    /* The page is handed setProgress as a prop; MM.setProgress is the fallback
       for anything that renders the debrief outside the page (a future
       instructor replay, the test harness). Prefer the prop. */
    var setP = isFn(setProgressFn) ? setProgressFn : MM.setProgress;
    if (isFn(setP)) {
      try {
        setP(function (prev) {
          var next = shallow(prev);
          next.simResults = arr(obj(prev).simResults).concat([rec]);
          return next;
        });
      } catch (e) {}
    }
    if (isFn(MM.recordActivity)) {
      try {
        MM.recordActivity('codeblue', {
          simId: rec.simId, title: kase.title, pct: rec.pct,
          outcome: rec.outcome, role: rec.role, passed: rec.passed
        });
      } catch (e) {}
    }
    var d = db || MM.db;
    if (d && uid) {
      try { d.ref('codeblue/results/' + uid).push(rec); } catch (e) {}
    }
    return rec;
  }

  function DebriefScreen(props) {
    var p = obj(props);
    var st = obj(p.st);
    var myUid = str(p.myUid);
    var res = useMemo(function () { return scoreForPlayer(st, myUid); }, [st, myUid]);
    var kase = caseById(st.caseId);
    var om = outcomeMeta(st.outcome);
    if (!numOr(st.arrestAt, 0) && st.outcome === 'rosc') {
      om = {
        label: 'Arrest prevented', tone: 'good', tag: 'tag-green',
        headline: 'The arrest never happened.',
        body: 'This patient was on their way to a cardiac arrest and you stopped it. It is the best outcome ' +
              'available in this case and it is scored as such - there was no CPR to grade because there was ' +
              'never a moment when CPR was the right thing to do. Recognising the patient who is about to ' +
              'arrest is a harder skill than running the code that follows.'
      };
    }
    var m = res.metrics;

    var aiH = useState({ state: 'idle', text: '', err: '' });
    var ai = aiH[0], setAi = aiH[1];
    var savedRef = useRef(false);
    var share = shareLine(st, res, str(p.myName) || 'I');

    useEffect(function () {
      if (savedRef.current) return;
      savedRef.current = true;
      try { persistResult(st, res, myUid, p.myName, p.db, p.setProgress); } catch (e) {}
    }, [st, res, myUid, p.myName, p.db]);

    useEffect(function () {
      var alive = true;
      setAi({ state: 'busy', text: '', err: '' });
      aiDebrief(st, res).then(function (t) {
        if (!alive) return;
        if (t && t.__err) { setAi({ state: 'err', text: '', err: str(t.__err) }); return; }
        if (!t) { setAi({ state: 'none', text: '', err: '' }); return; }
        setAi({ state: 'done', text: str(t), err: '' });
      }, function () { if (alive) setAi({ state: 'none', text: '', err: '' }); });
      return function () { alive = false; };
    }, []);

    var bars = arr(res.rubric).map(function (r) {
      var got = numOr(res.parts[r.id], 0);
      return ce('div', { key: r.id }, [
        ce('div', { className: 'cb-bar-l', key: 'l' }, [
          ce('span', { key: 'a' }, r.label),
          ce('span', { key: 'b' }, got + ' / ' + r.max)
        ]),
        ce('div', { className: 'cb-bar', key: 'b' },
          ce('i', { style: { width: clamp(got / r.max, 0, 1) * 100 + '%',
            background: got / r.max >= 0.75 ? 'var(--green,#22c55e)'
              : got / r.max >= 0.4 ? 'var(--orange,#f59e0b)' : 'var(--red,#ef4444)' } }))
      ]);
    });

    var stat = function (label, value, tone) {
      return ce('div', { key: label, className: 'cb-role' }, [
        ce('div', { className: 'cb-role-w', key: 'l', style: { whiteSpace: 'normal' } }, label),
        ce('div', { key: 'v', style: {
          fontSize: '1.1rem', fontWeight: 800, marginTop: 2,
          color: tone === 'bad' ? 'var(--red,#ef4444)' : tone === 'good' ? 'var(--green,#22c55e)' : 'var(--text,#f1f5f9)'
        } }, value)
      ]);
    };

    return ce('div', { className: 'cb-wrap' }, [
      ce('div', { className: 'cb-card', key: 'top' }, [
        ce('div', { className: 'cb-row', key: 'r' }, [
          ce('span', { key: 'i', style: { fontSize: '1.8rem' }, 'aria-hidden': 'true' }, kase.icon),
          ce('div', { key: 'x', style: { flex: '1 1 160px', minWidth: 0 } }, [
            ce('h3', { key: 'a', style: { margin: 0 } }, om.headline),
            ce('div', { key: 'b', className: 'cb-muted' }, kase.title + ' - ' + kase.patient)
          ])
        ]),
        ce('p', { className: 'cb-sub', key: 'b', style: { marginTop: 10 } }, om.body),
        (st.outcome === 'death' || st.outcome === 'terminated')
          ? ce('p', { className: 'cb-sub', key: 'c', style: { marginTop: 8, color: 'var(--text3,#64748b)' } },
              'If this one sat heavily with you, that is the right response and not a weakness. ' +
              'Talk about it with your cohort or your instructor before you run another.')
          : null
      ]),

      ce('div', { className: 'cb-two', key: 'body' }, [
        ce('div', { key: 'l' }, [
          ce('div', { className: 'cb-card', key: 'sc' }, [
            ce('div', { className: 'cb-row', key: 'r' }, [
              ce('div', { key: 'a' }, [
                ce('div', { className: 'cb-big', key: 'v' }, res.personal),
                ce('div', { className: 'cb-muted', key: 'l' }, 'your score (' + res.letter + ')')
              ]),
              ce('div', { key: 'b', style: { marginLeft: 16 } }, [
                ce('div', { className: 'cb-big', key: 'v', style: { color: 'var(--text2,#94a3b8)' } }, res.team),
                ce('div', { className: 'cb-muted', key: 'l' }, 'team score')
              ])
            ]),
            ce('div', { className: 'cb-bars', key: 'b', style: { marginTop: 14 } }, bars)
          ]),
          ce('div', { className: 'cb-card', key: 'met' }, [
            ce('h3', { key: 'h' }, 'Team metrics'),
            ce('div', { className: 'cb-roles', key: 'g' }, [
              stat('Time to first compression',
                m.timeToCompression >= 0 ? fmtSec(m.timeToCompression) : (res.neverArrested ? 'no arrest' : 'never'),
                res.neverArrested ? 'good' : (m.timeToCompression >= 0 && m.timeToCompression <= 10000 ? 'good' : 'bad')),
              stat('Chest compression fraction', res.neverArrested ? 'n/a' : pct(m.ccf),
                res.neverArrested ? '' : (m.ccf >= 0.8 ? 'good' : (m.ccf >= 0.6 ? '' : 'bad'))),
              stat('Rate inside 100-120', res.neverArrested ? 'n/a' : pct(m.cprQuality),
                res.neverArrested ? '' : (m.cprQuality >= 0.7 ? 'good' : '')),
              stat('Time to first shock', m.timeToShock >= 0 ? fmtClock(m.timeToShock) : 'no shock',
                m.timeToShock >= 0 && m.timeToShock <= 120000 ? 'good' : ''),
              stat('Epinephrine doses', String(m.epi), m.epi > 0 ? 'good' : 'bad'),
              stat('Intervals on target', m.epiIntervals.length ? (m.epiOnInterval + ' / ' + m.epiIntervals.length) : 'n/a'),
              stat('Compressor switches', m.switches + ' / ' + Math.max(0, m.cycles - 1)),
              stat('Reversible cause', m.htCorrect ? htLabel(kase.cause) : 'missed - ' + htLabel(kase.cause),
                m.htCorrect ? 'good' : 'bad'),
              stat('Closed loop', res.loop.ordered ? (res.loop.reported + ' / ' + res.loop.ordered + ' closed') : 'no orders given',
                res.loop.closeRate >= 0.7 ? 'good' : ''),
              stat('Total time', fmtClock(m.durationMs))
            ])
          ])
        ]),
        ce('div', { key: 'r' }, [
          ce('div', { className: 'cb-card', key: 'role' }, [
            ce('h3', { key: 'h' }, 'Your role' + (res.roles.length > 1 ? 's' : '')),
            arr(res.feedback).length ? arr(res.feedback).map(function (f) {
              return ce('div', { key: f.role, style: { marginBottom: 10 } }, [
                ce('div', { key: 't', style: { fontWeight: 700, fontSize: 'var(--fs-sm,13px)', color: 'var(--text,#f1f5f9)' } },
                  roleMeta(f.role).icon + ' ' + roleMeta(f.role).label),
                ce('ul', { key: 'l', style: { margin: '4px 0 0', paddingLeft: 18 } },
                  arr(f.lines).filter(function (x) { return !!str(x).trim(); }).map(function (x, i) {
                    return ce('li', { key: i, className: 'cb-sub' }, x);
                  }))
              ]);
            }) : ce('div', { key: 'none', className: 'cb-muted' }, 'You observed this code.')
          ]),
          arr(res.errors).length ? ce('div', { className: 'cb-card', key: 'err' }, [
            ce('h3', { key: 'h' }, 'What to fix first'),
            arr(res.errors).map(function (e, i) {
              return ce('div', { key: i, className: 'cb-sub', style: {
                marginBottom: 8, paddingLeft: 10,
                borderLeft: '3px solid ' + (e.sev === 'major' ? 'var(--red,#ef4444)' : 'var(--orange,#f59e0b)')
              } }, str(e.text));
            })
          ]) : null,
          arr(res.good).length ? ce('div', { className: 'cb-card', key: 'good' }, [
            ce('h3', { key: 'h' }, 'What went right'),
            arr(res.good).map(function (g, i) {
              return ce('div', { key: i, className: 'cb-sub', style: { marginBottom: 5 } }, '✓  ' + str(g));
            })
          ]) : null
        ])
      ]),

      ce('div', { className: 'cb-card', key: 'ai' }, [
        ce('h3', { key: 'h' }, 'Hot debrief'),
        ai.state === 'busy' ? ce('div', { className: 'cb-muted', key: 'b' }, 'Writing the debrief...') : null,
        ai.state === 'done' ? ce('p', { className: 'cb-sub', key: 'd', style: { whiteSpace: 'pre-wrap' } }, ai.text) : null,
        (ai.state === 'none' || ai.state === 'err') ? ce('p', { className: 'cb-sub', key: 'n' },
          (ai.err ? ai.err + ' ' : '') +
          'The numbers above are the debrief. Pick the single lowest bar, say out loud what you would do differently, ' +
          'and run it again.') : null
      ]),

      ce('div', { className: 'cb-card', key: 'log' }, [
        ce('h3', { key: 'h' }, 'The timeline'),
        ce(EventLog, { key: 'l', st: st, big: true })
      ]),

      ce('div', { className: 'cb-card', key: 'share' }, [
        ce('h3', { key: 'h' }, 'Share it'),
        ce('textarea', { key: 't', className: 'cb-share', readOnly: true, value: share,
          onFocus: function (e) { try { e.target.select(); } catch (x) {} } }),
        ce('div', { className: 'cb-row', key: 'b', style: { marginTop: 10 } }, [
          ce('button', {
            key: 'c', type: 'button', className: 'cb-btn',
            onClick: function () {
              try {
                if (window.navigator && window.navigator.clipboard && isFn(window.navigator.clipboard.writeText)) {
                  window.navigator.clipboard.writeText(share);
                  if (isFn(MMx().toast)) MMx().toast('Copied.', 'success');
                }
              } catch (e) {}
            }
          }, 'Copy'),
          ce('button', { key: 'a', type: 'button', className: 'cb-btn go', onClick: p.onAgain }, 'Run it again'),
          ce('button', { key: 'x', type: 'button', className: 'cb-btn', onClick: p.onExit }, 'Back to the lobby')
        ])
      ])
    ]);
  }

  /* ==========================================================================
   * 17. LOBBY
   * ======================================================================== */

  /* I, O, 0 and 1 are gone. A four-letter code gets read aloud across a study
     table far more often than it gets typed, and "was that an I or a 1" costs
     more than the 40% of the keyspace it saves. */
  var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  function randCode() {
    var s = '', i;
    for (i = 0; i < 4; i++) {
      s += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
    }
    return s;
  }
  function normalizeCode(v) {
    return str(v).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  }

  /**
   * createRoom - claim a code with a write-if-absent transaction and retry on
   * collision. Two students in different cohorts pressing Create in the same
   * second must not land in each other's code.
   */
  function createRoom(db, cfg, myUid, myName, name, done) {
    if (!db) { done('This needs a connection to work.'); return; }
    var tries = 0;
    function attempt() {
      tries++;
      if (tries > 8) { done('Could not find a free room code. Try again in a moment.'); return; }
      var code = randCode();
      var ref = db.ref('codeblue/rooms/' + code);
      var record = {
        code: code,
        name: cut(str(name) || (str(myName) + "'s code"), 48),
        hostId: myUid,
        hostName: cut(str(myName) || 'Host', 32),
        createdAt: nowMs(),
        status: 'open',
        cfg: cfg
      };
      var settled = false;
      function finish(err, committed) {
        if (settled) return;
        settled = true;
        if (err) { done('Could not create the room.'); return; }
        if (committed) { done(null, code); return; }
        attempt();
      }
      try {
        ref.transaction(function (cur) {
          /* A room node exists if it has ANY child, including an orphaned
             /events from a room that was cleaned up badly. Only a genuinely
             empty node may be claimed. */
          if (cur !== null && cur !== undefined) return undefined;
          return record;
        }, finish);
      } catch (e) { done('Could not create the room.'); }
    }
    attempt();
  }

  function SignedOut(props) {
    return ce('div', { className: 'cb-wrap' }, [
      ce('div', { className: 'cb-card', key: 'a' }, [
        ce('h3', { key: 'h' }, '🚨  Code Blue Team'),
        ce('p', { className: 'cb-sub', key: 'p' },
          'A mock cardiac arrest you run together in real time. Everyone takes a role - team lead, compressions, ' +
          'airway, meds, defib, recorder - and the rhythm, the two-minute cycle clock and the consequences all move ' +
          'whether you act or not.'),
        ce('div', { className: 'cb-banner info', key: 'b', style: { marginTop: 12 } },
          'You need to be signed in to run a code. Rooms live on your account so your team can find you, ' +
          'your role survives a refresh, and your debrief lands on your dashboard.'),
        ce('div', { className: 'cb-row', key: 'r', style: { marginTop: 12 } },
          ce('button', {
            type: 'button', className: 'cb-btn go',
            onClick: function () { if (isFn(MMx().navigate)) MMx().navigate('home'); }
          }, 'Sign in from the account menu')),
        ce('div', { key: 'w', style: { marginTop: 16 } }, [
          ce('h3', { key: 'h' }, 'What a code looks like here'),
          ce('ul', { key: 'u', style: { paddingLeft: 18, margin: '6px 0 0' } }, [
            'A live rhythm strip that actually behaves like the rhythm it is showing.',
            'A compression pad that measures your rate and scores the time you spend in 100-120.',
            'A 2:00 cycle clock, an epinephrine timer, and a rhythm check that stops everything.',
            'Closed-loop communication scored: order, acknowledge, perform, report back.',
            'A debrief with compression fraction, time to first shock, and what each role missed.'
          ].map(function (t, i) { return ce('li', { key: i, className: 'cb-sub' }, t); }))
        ])
      ])
    ]);
  }

  function Lobby(props) {
    var p = obj(props);
    var db = p.db, myUid = str(p.myUid), myName = str(p.myName);
    var roomsH = useState({});
    var rooms = roomsH[0], setRooms = roomsH[1];
    var loadH = useState(true);
    var loading = loadH[0], setLoading = loadH[1];
    var errH = useState('');
    var err = errH[0], setErr = errH[1];
    var busyH = useState(false);
    var busy = busyH[0], setBusy = busyH[1];
    var codeH = useState('');
    var code = codeH[0], setCode = codeH[1];
    var nameH = useState('');
    var rname = nameH[0], setRname = nameH[1];

    var caseH = useState(CASES[0].id);
    var caseId = caseH[0], setCaseId = caseH[1];
    var diffH = useState('competent');
    var difficulty = diffH[0], setDifficulty = diffH[1];
    var sizeH = useState(4);
    var teamSize = sizeH[0], setTeamSize = sizeH[1];
    var modeH = useState('assigned');
    var roleMode = modeH[0], setRoleMode = modeH[1];
    var slotH = useState(0);
    var mySlot = slotH[0], setMySlot = slotH[1];
    var tabH = useState('team');
    var tab = tabH[0], setTab = tabH[1];

    useEffect(function () {
      if (!db) { setLoading(false); return undefined; }
      var q;
      try {
        var base = db.ref('codeblue/rooms');
        q = isFn(base.orderByChild) ? base.orderByChild('status').equalTo('open') : base;
      } catch (e) { q = null; }
      if (!q) { setLoading(false); return undefined; }
      var on = q.on('value', function (snap) {
        setRooms(obj(snap.val()));
        setLoading(false);
      }, function () {
        setLoading(false);
        setErr('Could not load the open rooms. You can still join with a code.');
      });
      return function () { try { q.off('value', on); } catch (e) {} };
    }, [db]);

    var list = keys(rooms).map(function (k) {
      var r = obj(rooms[k]);
      return {
        id: k, name: str(r.name) || k, host: str(r.hostName) || 'Host',
        players: keys(r.players).length, cfg: obj(r.cfg),
        createdAt: numOr(r.createdAt, 0), status: str(r.status)
      };
    }).filter(function (r) {
      return r.status === 'open' && (nowMs() - r.createdAt) < ROOM_STALE_MS;
    }).sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 20);

    function cfgNow() {
      return {
        caseId: caseId, difficulty: difficulty, teamSize: teamSize,
        roleMode: roleMode, seed: caseId + '-' + Math.floor(Math.random() * 1e9)
      };
    }

    function doCreate() {
      if (busy) return;
      setErr('');
      setBusy(true);
      createRoom(db, cfgNow(), myUid, myName, rname, function (e, id) {
        setBusy(false);
        if (e) { setErr(e); return; }
        p.onEnterRoom(id);
      });
    }

    function doJoin(id) {
      var c = normalizeCode(id);
      if (c.length !== 4) { setErr('A room code is four letters.'); return; }
      if (!db) { setErr('This needs a connection to work.'); return; }
      setErr('');
      setBusy(true);
      try {
        db.ref('codeblue/rooms/' + c + '/status').once('value', function (snap) {
          setBusy(false);
          var s = snap.val();
          if (!s) { setErr('No room with the code ' + c + '. Check it with whoever is hosting.'); return; }
          if (s === 'done') { setErr('That code has already been run.'); return; }
          p.onEnterRoom(c);
        }, function () { setBusy(false); setErr('Could not reach that room.'); });
      } catch (e) { setBusy(false); setErr('Could not reach that room.'); }
    }

    var slots = slotsFor(teamSize);

    var caseCards = ce('div', { className: 'cb-act', key: 'cases' }, CASES.map(function (c) {
      return ce('button', {
        key: c.id, type: 'button', className: 'cb-btn cb-case', 'aria-pressed': caseId === c.id ? 'true' : 'false',
        style: caseId === c.id ? { borderColor: 'var(--accent,#3b82f6)', background: 'var(--tint-accent,rgba(59,130,246,0.12))' } : null,
        onClick: function () { setCaseId(c.id); }
      }, [
        ce('b', { key: 'a' }, c.icon + '  ' + c.title),
        ce('span', { key: 'b' }, c.patient + ' - ' + rhy(c.initialRhythm).short)
      ]);
    }));

    var settings = ce('div', { key: 'settings' }, [
      ce('div', { className: 'cb-sect', key: 'case' }, [
        ce('div', { className: 'cb-sect-t', key: 't' }, 'The case'),
        caseCards,
        ce('p', { className: 'cb-sub', key: 'l', style: { marginTop: 8 } }, caseById(caseId).lead)
      ]),
      ce('div', { className: 'cb-sect', key: 'size' }, [
        ce('div', { className: 'cb-sect-t', key: 't' }, 'Team size'),
        ce('div', { className: 'cb-seg', key: 's' }, [2, 3, 4, 5, 6].map(function (n) {
          return ce('button', {
            key: n, type: 'button', 'aria-pressed': teamSize === n ? 'true' : 'false',
            onClick: function () { setTeamSize(n); setMySlot(0); }
          }, n + ' players');
        })),
        ce('div', { className: 'cb-muted', key: 'm', style: { marginTop: 6 } },
          slots.map(function (s, i) { return (i + 1) + '. ' + slotLabel(s); }).join('   ·   ')),
        ce('div', { className: 'cb-muted', key: 'n', style: { marginTop: 4 } },
          'If fewer people turn up, the roles collapse again to fit whoever is actually there. Nobody ends up ' +
          'holding a job that does not exist, and no job ends up unheld.')
      ]),
      ce('div', { className: 'cb-sect', key: 'mode' }, [
        ce('div', { className: 'cb-sect-t', key: 't' }, 'Roles'),
        ce('div', { className: 'cb-seg', key: 's' }, [
          { id: 'assigned', l: 'App deals the roles' },
          { id: 'leader', l: 'Team lead assigns live' }
        ].map(function (o) {
          return ce('button', {
            key: o.id, type: 'button', 'aria-pressed': roleMode === o.id ? 'true' : 'false',
            onClick: function () { setRoleMode(o.id); }
          }, o.l);
        })),
        ce('div', { className: 'cb-muted', key: 'm', style: { marginTop: 6 } },
          roleMode === 'leader'
            ? 'The lead reassigns roles during the code, and is scored on it. Putting the strongest hands on the chest is a skill.'
            : 'Roles are dealt in join order. The host takes team lead.')
      ]),
      ce('div', { className: 'cb-sect', key: 'diff' }, [
        ce('div', { className: 'cb-sect-t', key: 't' }, 'Difficulty'),
        ce('div', { className: 'cb-seg', key: 's' }, DIFFS.map(function (d) {
          return ce('button', {
            key: d.id, type: 'button', 'aria-pressed': difficulty === d.id ? 'true' : 'false',
            onClick: function () { setDifficulty(d.id); }
          }, d.label);
        })),
        ce('div', { className: 'cb-muted', key: 'm', style: { marginTop: 6 } }, diffOf(difficulty).blurb)
      ])
    ]);

    return ce('div', { className: 'cb-wrap' }, [
      ce('div', { className: 'cb-h', key: 'h' }, [
        ce('h2', { key: 't' }, '🚨 Code Blue Team'),
        ce('span', { key: 's', className: 'cb-sub', style: { flex: '1 1 100%' } },
          'One patient arrests. Everyone takes a role. The clock does not wait for you.')
      ]),
      err ? ce('div', { className: 'cb-banner bad', key: 'e' }, err) : null,
      !db ? ce('div', { className: 'cb-banner warn', key: 'nodb' },
        'No connection to the study-room server right now, so team rooms are unavailable. ' +
        'Solo practice below runs entirely on this device and works either way.') : null,

      ce('div', { className: 'cb-seg', key: 'tabs', style: { marginBottom: 12 } }, [
        { id: 'team', l: 'Run it with a team' },
        { id: 'solo', l: 'Run it alone with AI teammates' }
      ].map(function (o) {
        return ce('button', {
          key: o.id, type: 'button', 'aria-pressed': tab === o.id ? 'true' : 'false',
          onClick: function () { setTab(o.id); }
        }, o.l);
      })),

      tab === 'team' ? ce('div', { className: 'cb-two', key: 'team' }, [
        ce('div', { key: 'l' }, [
          ce('div', { className: 'cb-card', key: 'c' }, [
            ce('h3', { key: 'h' }, 'Start a room'),
            ce('input', {
              key: 'n', className: 'cb-in', value: rname, maxLength: 48,
              placeholder: myName ? (myName + "'s code") : 'Room name',
              onChange: function (e) { setRname(e.target.value); },
              'aria-label': 'Room name'
            }),
            ce('div', { key: 's', style: { marginTop: 12 } }, settings),
            ce('button', {
              key: 'b', type: 'button', className: 'cb-btn go', disabled: busy || !db,
              style: { marginTop: 14, width: '100%' }, onClick: doCreate
            }, busy ? 'Creating...' : 'Create the room and get a code')
          ])
        ]),
        ce('div', { key: 'r' }, [
          ce('div', { className: 'cb-card', key: 'j' }, [
            ce('h3', { key: 'h' }, 'Join with a code'),
            ce('div', { className: 'cb-row', key: 'r' }, [
              ce('input', {
                key: 'i', className: 'cb-in', value: code, maxLength: 4,
                placeholder: 'ABCD', style: { flex: '1 1 120px', letterSpacing: '.25em', textTransform: 'uppercase' },
                onChange: function (e) { setCode(normalizeCode(e.target.value)); },
                onKeyDown: function (e) { if (e.key === 'Enter') doJoin(code); },
                'aria-label': 'Four letter room code'
              }),
              ce('button', {
                key: 'b', type: 'button', className: 'cb-btn go', style: { flex: '0 0 auto' },
                disabled: busy || code.length !== 4, onClick: function () { doJoin(code); }
              }, 'Join')
            ])
          ]),
          ce('div', { className: 'cb-card', key: 'l' }, [
            ce('h3', { key: 'h' }, 'Open rooms'),
            loading ? ce('div', { className: 'cb-muted', key: 'w' }, 'Looking for rooms...')
              : (list.length ? list.map(function (r) {
                  return ce('div', { className: 'cb-room', key: r.id }, [
                    ce('span', { className: 'cb-code', key: 'c' }, r.id),
                    ce('div', { key: 'n', style: { flex: '1 1 120px', minWidth: 0 } }, [
                      ce('div', { key: 'a', style: { color: 'var(--text,#f1f5f9)', fontSize: 'var(--fs-sm,13px)' } }, r.name),
                      ce('div', { key: 'b', className: 'cb-muted' },
                        r.host + ' · ' + r.players + '/' + numOr(r.cfg.teamSize, 4) + ' · ' +
                        caseById(r.cfg.caseId).short + ' · ' + (r.cfg.roleMode === 'leader' ? 'lead assigns' : 'roles dealt'))
                    ]),
                    ce('button', {
                      key: 'j', type: 'button', className: 'cb-btn', style: { flex: '0 0 auto' },
                      onClick: function () { doJoin(r.id); }
                    }, 'Join')
                  ]);
                })
                : ce('div', { className: 'cb-muted', key: 'n' },
                    'No open rooms right now. Create one and read the code out to your group.'))
          ])
        ])
      ]) : ce('div', { className: 'cb-card', key: 'solo' }, [
        ce('h3', { key: 'h' }, 'Run it alone with AI teammates'),
        ce('p', { className: 'cb-sub', key: 'p' },
          'Same engine, same clock, same scoring. Your teammates hold the other roles and act on a realistic - ' +
          'not perfect - schedule. Pick the job you want to practise; nobody will do it for you.'),
        settings,
        ce('div', { className: 'cb-sect', key: 'slot' }, [
          ce('div', { className: 'cb-sect-t', key: 't' }, 'Your job'),
          ce('div', { className: 'cb-act', key: 's' }, slots.map(function (s, i) {
            return ce('button', {
              key: i, type: 'button', className: 'cb-btn',
              'aria-pressed': mySlot === i ? 'true' : 'false',
              style: mySlot === i ? { borderColor: 'var(--accent,#3b82f6)', background: 'var(--tint-accent,rgba(59,130,246,0.12))' } : null,
              onClick: function () { setMySlot(i); }
            }, slotLabel(s));
          }))
        ]),
        ce('button', {
          key: 'go', type: 'button', className: 'cb-btn go', style: { marginTop: 14, width: '100%' },
          onClick: function () {
            var c = cfgNow();
            c.solo = true;
            c.mySlot = mySlot;
            p.onSolo(c);
          }
        }, 'Start the code')
      ])
    ]);
  }

  /* ==========================================================================
   * 18. RUNNERS
   * Thin components whose only job is to own one transport hook each, so the
   * hook order in every component is fixed for its whole life.
   * ======================================================================== */

  function useBusyGuard(active) {
    useEffect(function () {
      if (!active) return undefined;
      var MM = MMx();
      if (!isFn(MM.setBusy)) return undefined;
      try { MM.setBusy(true); } catch (e) {}
      return function () { try { MM.setBusy(false); } catch (e) {} };
    }, [active]);
  }

  function SoloRunner(props) {
    var p = obj(props);
    var run = useSoloCode(p.cfg, p.myUid, p.myName);
    var st = obj(run.st);
    useBusyGuard(st.phase === 'running' || st.phase === 'check');

    if (st.phase === 'ended') {
      return ce(DebriefScreen, {
        st: st, myUid: p.myUid, myName: p.myName, db: p.db, setProgress: p.setProgress,
        onAgain: p.onAgain, onExit: p.onExit
      });
    }
    return ce(GameScreen, {
      st: st, players: run.players, myUid: p.myUid, send: run.send,
      isHost: true, solo: true, canStart: true,
      onCprSample: run.onCprSample, onVentSample: run.onVentSample,
      onLeave: p.onExit
    });
  }

  function RoomRunner(props) {
    var p = obj(props);
    var db = p.db, roomId = str(p.roomId);
    var run = useRoomCode(roomId, p.myUid, p.myName, db);
    var voice = useVoiceChatSafe(roomId ? ('codeblue-' + roomId) : null, p.myUid, p.myName, db);
    var st = run.st ? obj(run.st) : null;
    var meta = obj(run.meta);
    var players = obj(run.players);
    useBusyGuard(!!st && (st.phase === 'running' || st.phase === 'check'));

    /* Auto-offer voice once, on entry. It is offered, never forced: the strip
       renders with a Join button and nothing opens the microphone until the
       student presses it. */
    var announced = useRef(false);
    useEffect(function () {
      if (announced.current || !roomId) return;
      announced.current = true;
      if (!voice.unavailable && isFn(MMx().toast)) {
        try { MMx().toast('Voice chat is available in this room - join it if you can.', 'info'); } catch (e) {}
      }
    }, [roomId, voice.unavailable]);

    if (!meta.hostId && !st) {
      return ce('div', { className: 'cb-wrap' },
        ce('div', { className: 'cb-card' }, [
          ce('h3', { key: 'h' }, 'Room ' + roomId),
          ce('div', { className: 'cb-muted', key: 'm' }, 'Connecting to the room...'),
          ce('button', { key: 'b', type: 'button', className: 'cb-btn', style: { marginTop: 12 }, onClick: p.onExit },
            'Back to the lobby')
        ]));
    }

    if (!st) {
      return ce('div', { className: 'cb-wrap' },
        ce('div', { className: 'cb-card' }, [
          ce('h3', { key: 'h' }, 'Room ' + roomId),
          ce('div', { className: 'cb-codebig', key: 'c', style: { margin: '12px 0' } }, roomId),
          ce('div', { className: 'cb-muted', key: 'm' },
            'Waiting for ' + (str(meta.hostName) || 'the host') + ' to open the code. ' +
            'Read the code above out to anyone still joining.'),
          ce('div', { key: 'p', style: { marginTop: 12 } },
            keys(players).map(function (u) {
              return ce('span', { key: u, className: 'cb-chip', style: { marginRight: 6 } },
                str(obj(players[u]).name) || 'Player');
            })),
          ce(VoiceStrip, { key: 'v', voice: voice }),
          ce('button', { key: 'b', type: 'button', className: 'cb-btn', style: { marginTop: 12 }, onClick: p.onExit },
            'Leave')
        ]));
    }

    if (st.phase === 'ended') {
      return ce(DebriefScreen, {
        st: st, myUid: p.myUid, myName: p.myName, db: db, setProgress: p.setProgress,
        onAgain: p.onAgain, onExit: p.onExit
      });
    }

    return ce('div', null, [
      st.phase === 'briefing' ? ce('div', { className: 'cb-card', key: 'code', style: { textAlign: 'center' } }, [
        ce('div', { className: 'cb-muted', key: 'a' }, 'Room code - read it out'),
        ce('div', { className: 'cb-codebig', key: 'b' }, roomId),
        ce('div', { className: 'cb-muted', key: 'c' },
          keys(players).length + ' here · ' + (run.isHost ? 'you are hosting' : 'hosted by ' + (str(meta.hostName) || 'someone')))
      ]) : null,
      ce(GameScreen, {
        key: 'g', st: st, players: players, myUid: p.myUid, send: run.send,
        isHost: run.isHost, solo: false, canStart: run.isHost, voice: voice,
        hostStale: !!run.hostStale, error: run.error,
        onCprSample: run.onCprSample, onVentSample: run.onVentSample,
        onLeave: p.onExit
      })
    ]);
  }

  /* ==========================================================================
   * 19. ROOT
   * ======================================================================== */

  function CodeBlueMode(props) {
    var p = obj(props);
    injectStyles();

    var MM = MMx();
    var authUser = p.authUser || MM.authUser || null;
    var db = MM.db || null;
    var myUid = str(authUser && authUser.uid ? authUser.uid : (MM.myId || ''));
    var myName = cut(str(
      (authUser && authUser.displayName) ? authUser.displayName :
      (authUser && authUser.email) ? String(authUser.email).split('@')[0] : 'Player'
    ) || 'Player', 32);

    var screenH = useState('lobby');
    var screen = screenH[0], setScreen = screenH[1];
    var roomH = useState('');
    var roomId = roomH[0], setRoomId = roomH[1];
    var cfgH = useState(null);
    var cfg = cfgH[0], setCfg = cfgH[1];
    var nonceH = useState(0);
    var nonce = nonceH[0], setNonce = nonceH[1];

    var toLobby = useCallback(function () {
      setScreen('lobby');
      setRoomId('');
      setCfg(null);
    }, []);

    if (!authUser || !myUid) return ce(SignedOut, null);

    if (screen === 'solo' && cfg) {
      return ce(SoloRunner, {
        key: 'solo-' + nonce, cfg: cfg, myUid: myUid, myName: myName, db: db,
        setProgress: isFn(p.setProgress) ? p.setProgress : null,
        onExit: toLobby,
        onAgain: function () {
          var next = shallow(cfg);
          next.seed = str(cfg.caseId) + '-' + Math.floor(Math.random() * 1e9);
          setCfg(next);
          setNonce(nonce + 1);
        }
      });
    }

    if (screen === 'room' && roomId) {
      return ce(RoomRunner, {
        key: 'room-' + roomId + '-' + nonce, roomId: roomId, myUid: myUid, myName: myName, db: db,
        setProgress: isFn(p.setProgress) ? p.setProgress : null,
        onExit: toLobby,
        onAgain: toLobby
      });
    }

    return ce(Lobby, {
      db: db, myUid: myUid, myName: myName,
      onEnterRoom: function (id) { setRoomId(id); setScreen('room'); setNonce(nonce + 1); },
      onSolo: function (c) { setCfg(c); setScreen('solo'); setNonce(nonce + 1); }
    });
  }

  /* ==========================================================================
   * 20. EXPORTS
   * The engine hangs off the component so it can be unit tested and so a future
   * instructor dashboard can replay a code from its event list without React.
   * ======================================================================== */

  CodeBlueMode.createState = createState;
  CodeBlueMode.applyEvent = applyEvent;
  CodeBlueMode.tick = tick;
  CodeBlueMode.feedCpr = feedCpr;
  CodeBlueMode.feedVent = feedVent;
  CodeBlueMode.assignRoles = assignRoles;
  CodeBlueMode.dealFromPlayers = dealFromPlayers;
  CodeBlueMode.rolesOfUid = rolesOfUid;
  CodeBlueMode.uidForRole = uidForRole;
  CodeBlueMode.botStep = botStep;
  CodeBlueMode.conversionOdds = conversionOdds;
  CodeBlueMode.scoreTeam = scoreTeam;
  CodeBlueMode.scoreForPlayer = scoreForPlayer;
  CodeBlueMode.teamMetrics = teamMetrics;
  CodeBlueMode.loopStats = loopStats;
  CodeBlueMode.roleFeedback = roleFeedback;
  CodeBlueMode.shareLine = shareLine;
  CodeBlueMode.persistResult = persistResult;
  CodeBlueMode.parseNarration = parseNarration;
  CodeBlueMode.normalizeNarration = normalizeNarration;
  CodeBlueMode.fallbackNarration = fallbackNarration;
  CodeBlueMode.narrateBeat = narrateBeat;
  CodeBlueMode.aiDebrief = aiDebrief;
  CodeBlueMode.buildTrace = buildTrace;
  CodeBlueMode.traceFor = traceFor;
  CodeBlueMode.createRoom = createRoom;
  CodeBlueMode.normalizeCode = normalizeCode;
  CodeBlueMode.randCode = randCode;
  CodeBlueMode.slotsFor = slotsFor;
  CodeBlueMode.slotLabel = slotLabel;
  CodeBlueMode.SLOTS = SLOTS;
  CodeBlueMode.ROLES = ROLES;
  CodeBlueMode.CASES = CASES;
  CodeBlueMode.RHYTHMS = RHYTHMS;
  CodeBlueMode.HT_LIST = HT_LIST;
  CodeBlueMode.DIFFS = DIFFS;
  CodeBlueMode.RUBRIC = RUBRIC;
  CodeBlueMode.OUTCOME_META = OUTCOME_META;
  CodeBlueMode.epiOptions = epiOptions;
  CodeBlueMode.amioOptions = amioOptions;
  CodeBlueMode.CYCLE_MS = CYCLE_MS;
  CodeBlueMode.CHECK_MS = CHECK_MS;
  CodeBlueMode.HOST_GRACE_MS = HOST_GRACE_MS;
  CodeBlueMode.REJOIN_MS = REJOIN_MS;
  CodeBlueMode.CPR_LOW = CPR_LOW;
  CodeBlueMode.CPR_HIGH = CPR_HIGH;
  CodeBlueMode.ccf = ccf;
  CodeBlueMode.cprQuality = cprQuality;

  CodeBlueMode.EcgStrip = EcgStrip;
  CodeBlueMode.Monitor = Monitor;
  CodeBlueMode.GameScreen = GameScreen;
  CodeBlueMode.CycleClock = CycleClock;
  CodeBlueMode.EventLog = EventLog;
  CodeBlueMode.RoleCards = RoleCards;

  window.CodeBlueMode = CodeBlueMode;
  window.CodeBlueLobby = Lobby;
  window.CodeBlueDebrief = DebriefScreen;
})();
