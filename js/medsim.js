/* =============================================================================
 * js/medsim.js  ->  window.MedSimTrainer
 * -----------------------------------------------------------------------------
 * MED ADMIN SIMULATION (MedSim) — the free-form interactive clinical simulation
 * described in MEDSIM_SPEC/architecture.md. Phase-1 MVP.
 *
 * This is the web half of a two-platform contract; the iOS half lives in
 * MedMaster/Features/MedSim/ and is already shipped. What MUST stay identical
 * across the two (architecture.md §17) and is therefore transcribed rather than
 * reinvented here:
 *   1. the event-type vocabulary (§3)      -> EVENTS below
 *   2. the scenario content (§9)           -> data/medsim-scenarios.js
 *   3. the 29-item rubric mapping (§5)     -> data/medsim-rubric.js
 *   4. the scoring algorithm (§10)         -> section 5 below
 *   5. the /api/ai feature labels          -> 'medsim_rubric' and 'patient'
 *
 * ---------------------------------------------------------------------------
 * TWO NON-NEGOTIABLE SAFETY PROPERTIES. Both are implemented as structural
 * guarantees, not as instructions to a language model:
 *
 * A. THE CONFLICT RULE (§10). The AI may only adjust the QUALITY score of a
 *    criterion whose deterministic requiredEvents/chronology gate already
 *    passed. `scoreAttempt` reads `det.requiredEventsPassed` from the event log
 *    FIRST; if it is false the score is 0 and the AI verdict is never consulted
 *    at all. If a forbidden event fired, the AI's score is capped at 0. The AI
 *    can therefore never manufacture credit for a physical action that did not
 *    happen. See `scoreAttempt` in section 5.
 *
 * B. REVEAL-GATING (§8). The simulated patient runs in two layers. The
 *    classifier is shown fact KEY NAMES only — it never receives a single fact
 *    VALUE. The reply generator's system prompt is built from a fact list that
 *    has ALREADY been filtered down to `revealed` before the string is
 *    constructed, so an unrevealed fact's value is never present in the bytes
 *    sent to the model. This is an information-availability guarantee, not a
 *    "please don't mention it" instruction. See section 6.
 * ---------------------------------------------------------------------------
 *
 * Contract, matching the rest of this codebase (simprep.js / signoff.js /
 * medadmin-trainer.js): IIFE, no JSX, no ES modules, ES5 only (var/function —
 * no arrow functions, template literals, const/let, spread, optional chaining),
 * `window.MedSimTrainer` export, CSS custom properties with fallbacks, dark
 * theme, legible at 360px. Every external dependency (React, MM.ai, Firebase,
 * webkitSpeechRecognition, the two data globals) is feature-detected and
 * degrades to a written explanation — none of them can throw.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof React === 'undefined' || !React.createElement) { return; }

  var ce = React.createElement;
  var useState = React.useState,
      useEffect = React.useEffect,
      useMemo = React.useMemo,
      useRef = React.useRef,
      useCallback = React.useCallback;

  /* ==========================================================================
   * 1. TINY HELPERS
   * ======================================================================== */

  function isFn(f) { return typeof f === 'function'; }
  function obj(v) { return (v && typeof v === 'object') ? v : {}; }
  function arr(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function numOr(v, d) {
    var n = (typeof v === 'number') ? v : parseFloat(v);
    return isFinite(n) ? n : d;
  }
  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
  function MMobj() { return obj(window.MM); }
  function toast(msg, kind) {
    try {
      var t = MMobj().toast;
      if (isFn(t)) { t(str(msg), kind || 'info'); return; }
    } catch (e) { /* noop */ }
    try { console.log('[MedSim:' + (kind || 'info') + ']', msg); } catch (e2) { /* noop */ }
  }
  function getDb() {
    var m = MMobj();
    if (m && m.db) { return m.db; }
    if (window.firebaseDb) { return window.firebaseDb; }
    return null;
  }
  function aiApi() {
    var m = MMobj();
    return (m && m.ai && isFn(m.ai.chat)) ? m.ai : null;
  }
  function uid() {
    return 'e' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  function labelize(s) { return str(s).replace(/_/g, ' '); }
  function titleCase(s) {
    var t = labelize(s);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function clip(s, n) { var t = str(s); return t.length <= n ? t : t.slice(0, n); }
  function fmtMs(ms) {
    var total = Math.max(0, Math.round(numOr(ms, 0) / 1000));
    var m = Math.floor(total / 60), s = total % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function minutesSinceMidnight(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(str(hhmm).trim());
    if (!m) { return null; }
    var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (!isFinite(h) || !isFinite(mi)) { return null; }
    return h * 60 + mi;
  }
  function fmtClock(totalMinutes) {
    var t = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
    var h = Math.floor(t / 60), m = t % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  /** Strip ``` fences and salvage the first {...} object. Mirrors the iOS
      MedSimPatientAI/MedSimScoring parseJSONObject helper. */
  function parseJSONObject(raw) {
    var s = str(raw).trim();
    if (s.indexOf('```') === 0) {
      s = s.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    }
    var start = s.indexOf('{');
    if (start === -1) { return null; }
    var candidate = s.slice(start);
    try {
      var parsed = JSON.parse(candidate);
      return (parsed && typeof parsed === 'object' && !(parsed instanceof Array)) ? parsed : null;
    } catch (e) { /* fall through to brace-balance salvage */ }
    // Truncated response: walk back to the last balanced closing brace.
    var depth = 0, inStr = false, esc = false, i, end = -1;
    for (i = 0; i < candidate.length; i++) {
      var chx = candidate.charAt(i);
      if (esc) { esc = false; continue; }
      if (chx === '\\') { esc = true; continue; }
      if (chx === '"') { inStr = !inStr; continue; }
      if (inStr) { continue; }
      if (chx === '{') { depth++; }
      else if (chx === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) { return null; }
    try {
      var p2 = JSON.parse(candidate.slice(0, end + 1));
      return (p2 && typeof p2 === 'object' && !(p2 instanceof Array)) ? p2 : null;
    } catch (e2) { return null; }
  }

  /* ==========================================================================
   * 2. DATA ACCESS
   * ======================================================================== */

  function SCENARIOS() { return arr(window.MEDSIM_SCENARIOS); }
  function RUBRIC() { return arr(window.MEDSIM_RUBRIC); }
  function RUBRIC_SECTIONS() {
    var s = arr(window.MEDSIM_RUBRIC_SECTIONS);
    return s.length ? s : [
      { id: 'critical_errors', label: 'Critical Errors' },
      { id: 'verification', label: 'Medication Verification Checks' },
      { id: 'patient_safety', label: 'Patient Safety' },
      { id: 'clinical_judgment', label: 'Clinical Judgment & Assessment' },
      { id: 'safety_techniques', label: 'Safety Techniques' },
      { id: 'education', label: 'Patient Education & Communication' },
      { id: 'additional', label: 'Additional Considerations' }
    ];
  }
  function DRUGS() { return arr(window.SIGNOFF_DRUGS); }
  function drugById(id) {
    var list = DRUGS();
    for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === id) { return list[i]; } }
    return null;
  }

  /* ==========================================================================
   * 3. VOCABULARY + STATE MACHINE (architecture.md §2, §3)
   * --------------------------------------------------------------------------
   * These strings are the wire contract with the iOS build. Never invent a
   * platform-local name for something the rubric mapping references.
   * ======================================================================== */

  var PHASES = [
    'orientation', 'assessment', 'retrieval', 'check1', 'preparation', 'check2',
    'return_to_bedside', 'check3', 'education', 'administration',
    'disposal', 'reassessment', 'documentation', 'complete'
  ];
  var PHASE_RANK = {};
  (function () { for (var i = 0; i < PHASES.length; i++) { PHASE_RANK[PHASES[i]] = i; } })();

  var PHASE_LABEL = {
    orientation: 'Orientation', assessment: 'Assessment', retrieval: 'Retrieval',
    check1: 'First Check', preparation: 'Preparation', check2: 'Second Check',
    return_to_bedside: 'Return to Bedside', check3: 'Third Check',
    education: 'Patient Education', administration: 'Administration',
    disposal: 'Disposal', reassessment: 'Reassessment',
    documentation: 'Documentation', complete: 'Complete'
  };

  var LOCATIONS = ['hallway', 'bedside', 'med_room', 'prep_area', 'documentation_station'];
  var LOCATION_LABEL = {
    hallway: 'Hallway', bedside: 'Bedside', med_room: 'Med Cart / Med Room',
    prep_area: 'Prep Area', documentation_station: 'Documentation Station'
  };
  var LOCATION_ICON = {
    hallway: '🚪', bedside: '🛏️', med_room: '🗄️',
    prep_area: '🧪', documentation_station: '🖥️'
  };

  /* Event vocabulary (§3). Phase-1 fires a subset; the Phase-2/3 names exist so
     the rubric rows that reference them resolve rather than silently mismatch. */
  var EVENTS = {
    simulationStarted: 'simulation_started',
    enteredPatientRoom: 'entered_patient_room',
    handHygienePerformed: 'hand_hygiene_performed',
    wristbandViewed: 'wristband_viewed',
    marViewed: 'mar_viewed',
    marAllergiesViewed: 'mar_allergies_viewed',
    chartViewed: 'chart_viewed',
    vitalsViewed: 'vitals_viewed',
    labsViewed: 'labs_viewed',
    drugGuideOpened: 'drug_guide_opened',
    patientNameRequested: 'patient_name_requested',
    patientDobRequested: 'patient_dob_requested',
    patientIdentified: 'patient_identified',
    allergyQuestionAsked: 'allergy_question_asked',
    medicationSelected: 'medication_selected',
    beganRetrieval: 'began_retrieval',
    medicationRemoved: 'medication_removed',
    medicationPreparationStarted: 'medication_preparation_started',
    doseCalculated: 'dose_calculated',
    medicationPrepared: 'medication_prepared',
    returnedToBedside: 'returned_to_bedside',
    bedsideCheckStarted: 'bedside_check_started',
    patientPresent: 'patient_present',
    thirdCheckCompleted: 'third_check_completed',
    patientEducationGiven: 'patient_education_given',
    medicationAdministered: 'medication_administered',
    medicationRefused: 'medication_refused',
    patientResponseAssessed: 'patient_response_assessed',
    medicationDocumented: 'medication_documented',
    documentedBeforeAdministration: 'documented_before_administration',
    hintRequested: 'hint_requested',
    simulationPaused: 'simulation_paused',
    simulationResumed: 'simulation_resumed',
    simulationCompleted: 'simulation_completed',
    /* forbidden / violation vocabulary */
    administeredWrongPatient: 'administered_wrong_patient',
    administeredWrongPatientMedication: 'administered_wrong_patient_medication',
    administeredWrongDrug: 'administered_wrong_drug',
    administeredWrongDose: 'administered_wrong_dose',
    administeredWrongRoute: 'administered_wrong_route',
    /* Phase 2/3 — referenced by rubric rows, never dispatched in Phase 1 */
    sharpDisposed: 'sharp_disposed',
    sharpsViolation: 'sharps_violation',
    injectionSiteSelected: 'injection_site_selected',
    expiredMedicationRejected: 'expired_medication_rejected',
    speech: 'speech'
  };

  /* §2's transition table. Transitions are event-driven, never timer-driven,
     and only ever move FORWARD (rank must increase) — which is precisely what
     lets a learner skip ahead (administer before the bedside check) without the
     engine blocking them. Scoring, not gameplay, penalises that. */
  function phaseTransitionTarget(type) {
    switch (type) {
      case EVENTS.enteredPatientRoom: return 'assessment';
      case EVENTS.medicationSelected: return 'retrieval';
      case EVENTS.beganRetrieval: return 'retrieval';
      case EVENTS.medicationRemoved: return 'check1';
      case EVENTS.medicationPreparationStarted: return 'preparation';
      case EVENTS.medicationPrepared: return 'return_to_bedside';
      case EVENTS.bedsideCheckStarted: return 'check3';
      case EVENTS.thirdCheckCompleted: return 'education';
      case EVENTS.medicationAdministered: return 'administration';
      case EVENTS.sharpDisposed: return 'disposal';
      case EVENTS.patientResponseAssessed: return 'reassessment';
      case EVENTS.medicationDocumented: return 'documentation';
      case EVENTS.simulationCompleted: return 'complete';
      default: return null;
    }
  }

  /* §13: Guided-mode hints are canned and keyed to phase — deliberately NOT
     AI-generated, so Guided mode is fast and deterministic. */
  var GUIDED_HINTS = {
    orientation: 'Enter the patient\'s room to begin.',
    assessment: 'Anything to check before you go get the medication? (Two identifiers, allergies, vitals...)',
    retrieval: 'Select the medication that matches the order.',
    check1: 'First check: compare the medication to the MAR out loud before removing it.',
    preparation: 'Wash your hands before you start preparing the medication.',
    check2: 'Second check: verify the medication again while you prepare it.',
    return_to_bedside: 'Head back to the bedside for the third check.',
    check3: 'Third check: with the patient present, state their name, the medication, dose, route, and time.',
    education: 'Explain the medication to the patient and check their understanding before giving it.',
    administration: 'Administer the medication now.',
    disposal: 'Dispose of anything appropriately before moving on.',
    reassessment: 'Check in on the patient after giving the medication.',
    documentation: 'Document the administration now that it\'s given — not before.',
    complete: null
  };

  var MODES = [
    { id: 'guided', label: 'Guided', icon: '🧭',
      blurb: 'Phase hints on screen. Best for your first few runs.' },
    { id: 'practice', label: 'Practice', icon: '🔁',
      blurb: 'No hints, but the action list stays labelled. Full report at the end.' },
    { id: 'test', label: 'Test', icon: '📝',
      blurb: 'No hints, no checklist, no next-step highlight. Closest to the real check-off.' }
  ];

  /* ==========================================================================
   * 4. ENGINE (§2) — the attempt's live state
   * --------------------------------------------------------------------------
   * A plain mutable object held in a useRef, with a version counter the views
   * bump to re-render. Every observable action funnels through dispatch() or
   * logSpeech(), so `events` is always the single source of truth the scorer
   * reads at the end (§10). Nothing else may write to it.
   * ======================================================================== */

  function createEngine(scenario, mode) {
    var startedAt = Date.now();
    var eng = {
      scenario: scenario,
      mode: mode,
      startedAt: startedAt,
      phase: 'orientation',
      location: 'hallway',
      events: [],
      conversation: [],
      /* The reveal-gating ledger (§8). ONLY classifyStudentUtterance()'s
         classification step may grow this — nothing else in the module writes
         to it, which is what makes the guarantee in section 6 checkable. */
      revealed: {},
      selectedMedId: null,
      patientPresentConfirmed: false,
      isComplete: false,
      isPaused: false,
      pausedAccumulatedMs: 0,
      pauseStartedAt: null,
      version: 0
    };

    eng.elapsedMs = function () {
      var pausedNow = eng.pauseStartedAt ? (Date.now() - eng.pauseStartedAt) : 0;
      return (Date.now() - eng.startedAt) - eng.pausedAccumulatedMs - pausedNow;
    };

    eng.hasFired = function (type) {
      for (var i = 0; i < eng.events.length; i++) {
        if (eng.events[i].type === type) { return true; }
      }
      return false;
    };

    eng.firstOf = function (type) {
      for (var i = 0; i < eng.events.length; i++) {
        if (eng.events[i].type === type) { return eng.events[i]; }
      }
      return null;
    };

    eng.push = function (ev) { eng.events.push(ev); eng.version++; return ev; };

    eng.dispatch = function (type, meta, overrideLocation) {
      if (eng.isComplete && type !== EVENTS.simulationCompleted) { return null; }
      var loc = overrideLocation || eng.location;
      var t = eng.elapsedMs();
      var ev = {
        id: uid(), type: type, t: t, phase: eng.phase, location: loc,
        meta: meta ? obj(meta) : undefined
      };
      eng.push(ev);

      if (type === EVENTS.patientPresent) { eng.patientPresentConfirmed = true; }

      /* §3: `documented_before_administration` is a FORBIDDEN marker that flags
         a violation without blocking. Synthesised here (never dispatched by a
         caller) so right_documentation's forbiddenEvents check has real
         evidence to point at rather than an inferred chronology failure. */
      if (type === EVENTS.medicationDocumented && !eng.hasFired(EVENTS.medicationAdministered)) {
        eng.push({
          id: uid(), type: EVENTS.documentedBeforeAdministration,
          t: t, phase: eng.phase, location: loc
        });
      }

      /* §2 guard: return_to_bedside -> check3 requires patient_present context.
         The event still LOGS either way (it is real evidence for third_check /
         bedside_skipped) — it just doesn't advance the phase yet. */
      if (type === EVENTS.bedsideCheckStarted && !eng.patientPresentConfirmed) {
        return ev;
      }

      var target = phaseTransitionTarget(type);
      if (target && PHASE_RANK[target] > PHASE_RANK[eng.phase]) { eng.phase = target; }
      if (type === EVENTS.simulationCompleted) { eng.isComplete = true; }
      return ev;
    };

    /* Presentational room move (§2B). Does not append an event and never
       affects phase; subsequent dispatches simply stamp the new location. */
    eng.moveTo = function (loc) {
      if (LOCATIONS.indexOf(loc) === -1) { return; }
      eng.location = loc;
      eng.version++;
    };

    /* Speech is the ONLY carrier of free text (§3), and never drives a phase
       transition — §2's transition list contains no speech trigger. */
    eng.logSpeech = function (transcript, speaker, confidence) {
      var text = str(transcript).trim();
      if (!text) { return null; }
      var ev = {
        id: uid(), type: EVENTS.speech, t: eng.elapsedMs(),
        phase: eng.phase, location: eng.location,
        transcript: text, speaker: (speaker === 'patient' ? 'patient' : 'student')
      };
      if (typeof confidence === 'number') { ev.confidence = confidence; }
      eng.push(ev);
      eng.conversation.push({ speaker: ev.speaker, transcript: text, t: ev.t, phase: ev.phase });
      return ev;
    };

    /* The ONLY writer of the reveal ledger. Called exclusively from the
       classifier in section 6, after it has decided the student asked about
       this key. (§8) */
    eng.revealFact = function (key) {
      var k = str(key);
      if (!k) { return; }
      if (!eng.revealed[k]) { eng.revealed[k] = true; eng.version++; }
    };

    eng.pause = function () {
      if (eng.isPaused || eng.isComplete) { return; }
      eng.isPaused = true;
      eng.dispatch(EVENTS.simulationPaused);
      eng.pauseStartedAt = Date.now();
      eng.version++;
    };
    eng.resume = function () {
      if (!eng.isPaused) { return; }
      if (eng.pauseStartedAt) { eng.pausedAccumulatedMs += (Date.now() - eng.pauseStartedAt); }
      eng.pauseStartedAt = null;
      eng.isPaused = false;
      eng.dispatch(EVENTS.simulationResumed);
      eng.version++;
    };

    /* Sim wall-clock at a given elapsed-ms offset (used by right_time + header). */
    eng.simClockAt = function (ms) {
      var startMin = minutesSinceMidnight(obj(scenario).currentSimTime);
      if (startMin === null) { return null; }
      return startMin + (numOr(ms, 0) / 60000);
    };

    // simulation_started is t = 0 by definition (§3).
    eng.push({
      id: uid(), type: EVENTS.simulationStarted, t: 0,
      phase: 'orientation', location: 'hallway'
    });

    return eng;
  }

  /* ==========================================================================
   * 5. SCORING (§10)
   * --------------------------------------------------------------------------
   * Pure functions over events[] + scenario + rubric[] + pre-fetched AI
   * verdicts. Nothing here touches the network or Firebase; fetchAIVerdicts()
   * (the one impure function, at the end of this section) assembles the verdict
   * map the pure scorer consumes, exactly as §7/§10 separate them.
   * ======================================================================== */

  /** §5's note + the scenario's own `rubricOverrides` decide N/A. A criterion
      is excluded from the denominator, never scored 0, when its scenario opts
      out. */
  function isNotApplicable(criterion, scenario) {
    var overrides = arr(obj(scenario).rubricOverrides);
    for (var i = 0; i < overrides.length; i++) {
      if (overrides[i] && overrides[i].criterionId === criterion.id) {
        return !!overrides[i].notApplicable;
      }
    }
    return false;
  }

  function firstEventOfType(events, type) {
    for (var i = 0; i < events.length; i++) {
      if (events[i].type === type) { return events[i]; }
    }
    return null;
  }

  /**
   * evaluateDeterministic(criterion, events, scenario) -> {
   *   requiredEventsPassed, forbiddenFired, score, evidence[], missing[]
   * }
   *
   * `requiredEventsPassed` is THE gate the conflict rule reads. Chronology is
   * folded into it rather than kept as a separate flag, because an out-of-order
   * physical action is exactly as objective a failure as a missing one, and the
   * whole point of the gate is that no AI verdict can manufacture credit for
   * either kind.
   */
  function evaluateDeterministic(criterion, events, scenario) {
    var evidence = [], missing = [], i, hit;

    /* Scenario-conditional additions to requiredEvents (§5's "if the scenario
       requires math" / "if the scenario plants an expired med"). Kept dynamic
       here rather than baked into the shared static table, since the same
       criterion definition is reused by every scenario (§17). */
    var requiredAll = arr(criterion.requiredEvents).slice();
    if (criterion.id === 'right_dose' && obj(scenario).requiresCalculation) {
      requiredAll.push(EVENTS.doseCalculated);
    }
    if (criterion.id === 'expiration_check' && obj(scenario).expiredMedicationPresent) {
      requiredAll.push(EVENTS.expiredMedicationRejected);
    }

    var allPresent = true;
    for (i = 0; i < requiredAll.length; i++) {
      hit = firstEventOfType(events, requiredAll[i]);
      if (hit) {
        evidence.push({ t: hit.t, kind: 'event', label: labelize(requiredAll[i]) });
      } else {
        allPresent = false;
        missing.push(labelize(requiredAll[i]));
      }
    }

    var requiredAny = arr(criterion.requiredEventsAny);
    var anyPresent = true;
    if (requiredAny.length) {
      anyPresent = false;
      for (i = 0; i < requiredAny.length; i++) {
        hit = firstEventOfType(events, requiredAny[i]);
        if (hit) {
          anyPresent = true;
          evidence.push({ t: hit.t, kind: 'event', label: labelize(requiredAny[i]) });
        }
      }
      if (!anyPresent) {
        missing.push(requiredAny.map(labelize).join(' or '));
      }
    }

    var forbiddenFired = false;
    var forbidden = arr(criterion.forbiddenEvents);
    for (i = 0; i < forbidden.length; i++) {
      hit = firstEventOfType(events, forbidden[i]);
      if (hit) {
        forbiddenFired = true;
        evidence.push({ t: hit.t, kind: 'event', label: 'Violation: ' + labelize(forbidden[i]) });
      }
    }

    var chronologyPassed = true;
    var rules = arr(criterion.chronologyRules);
    for (i = 0; i < rules.length; i++) {
      var rule = rules[i] || {};
      var later = firstEventOfType(events, rule.mustPrecede);
      // The later step never happened — there is nothing to have violated yet.
      if (!later) { continue; }
      var earlier = firstEventOfType(events, rule.event);
      if (!earlier) {
        /* The constrained event never fired at all. That is a PRESENCE
           question, and requiredEvents / requiredEventsAny already adjudicate
           it — so only fail chronology here when presence is actually being
           demanded. When `rule.event` is one of several OR-alternatives, the
           alternative the student didn't take must not fail the ordering check:
           `pre_admin_assessment` asks for "vitals_viewed OR labs_viewed" and
           carries an ordering rule for each, so a scenario with no labs at all
           (this one) could otherwise never score above 0 no matter what the
           student did. Same shape for `allergy_not_checked`. */
        if (requiredAny.length && requiredAny.indexOf(rule.event) !== -1) { continue; }
        chronologyPassed = false;
        missing.push(labelize(rule.event) + ' must happen before ' + labelize(rule.mustPrecede));
        continue;
      }
      if (!(earlier.t < later.t)) {
        // It fired, but too late. An out-of-order physical action is as
        // objective a failure as a missing one.
        chronologyPassed = false;
        missing.push(labelize(rule.event) + ' must happen before ' + labelize(rule.mustPrecede));
      }
    }

    var requiredEventsPassed = allPresent && anyPresent && chronologyPassed;
    var score = (requiredEventsPassed && !forbiddenFired) ? numOr(criterion.maxScore, 2) : 0;

    /* Two rows need a correctness check beyond mere presence — §5's
       "deterministic: compare medicationId on removed vs. scenario order" and
       "compare event t mapped to sim-clock against scheduledTime". */
    if (criterion.id === 'right_drug') {
      var removed = firstEventOfType(events, EVENTS.medicationRemoved);
      if (removed) {
        var removedId = str(obj(removed.meta).medId);
        var order0 = arr(obj(scenario).orders)[0] || {};
        var expected = str(order0.medId);
        var matches = !!removedId && removedId === expected;
        score = matches ? numOr(criterion.maxScore, 2) : 0;
        if (!matches) {
          missing.push('Medication removed did not match the order (' + (expected || 'unknown') + ').');
        }
      }
    } else if (criterion.id === 'right_time') {
      var admin = firstEventOfType(events, EVENTS.medicationAdministered);
      var ord = arr(obj(scenario).orders)[0];
      var startMin = minutesSinceMidnight(obj(scenario).currentSimTime);
      var schedMin = ord ? minutesSinceMidnight(ord.scheduledTime) : null;
      if (admin && ord && startMin !== null && schedMin !== null) {
        var adminMin = startMin + (admin.t / 60000);
        var within = Math.abs(adminMin - schedMin) <= 60;
        score = within ? numOr(criterion.maxScore, 2) : 0;
        if (!within) {
          missing.push('Administered outside the ±1 hour window of the scheduled time (' +
                       str(ord.scheduledTime) + ').');
        }
      } else {
        score = 0;
      }
    }

    return {
      requiredEventsPassed: requiredEventsPassed,
      forbiddenFired: forbiddenFired,
      score: score,
      evidence: evidence,
      missing: missing
    };
  }

  var CORRECTIONS = {
    no_hand_hygiene: 'Perform hand hygiene before starting preparation.',
    hand_hygiene_asepsis: 'Perform hand hygiene before starting preparation.',
    bedside_skipped: 'Complete the third check at the bedside, with the patient present, before administering.',
    third_check: 'Complete the third check at the bedside, with the patient present, before administering.',
    two_identifiers: 'Verify the patient using name AND date of birth — not room number or age.',
    allergy_check: 'Ask the patient about allergies, check the wristband, and verify the MAR before administering.',
    allergy_not_checked: 'Ask the patient about allergies, check the wristband, and verify the MAR before administering.',
    right_documentation: 'Document only after administering, never before.',
    right_time: 'Confirm the scheduled time and administer within the ±1 hour window.',
    right_drug: 'Compare the medication removed against the order before proceeding.',
    pre_admin_assessment: 'Review vitals (and labs / swallow ability where relevant) before administering.',
    patient_education: 'Explain the medication\'s purpose and side effects, and verify the patient\'s understanding.',
    drug_guide_use: 'Open the drug guide and verbalize the medication\'s class and key considerations.',
    right_reason: 'Say out loud why this patient is receiving this medication.',
    right_route: 'Confirm the patient can take the medication by the ordered route before giving it.',
    special_precautions: 'Check this drug\'s hold parameters (respiratory rate, sedation) before administering.',
    expiration_check: 'Say out loud that you checked the expiration date.',
    first_check: 'At the cart, state the name, dose, route and time and check the expiration and form.',
    second_check: 'Re-check the medication against the MAR while you prepare it.',
    professionalism: 'Introduce yourself, explain what you are doing, and protect the patient\'s privacy.'
  };
  function correctionFor(criterion) {
    return CORRECTIONS[criterion.id] || 'Review this rubric item and demonstrate it clearly next attempt.';
  }

  function buildTimeline(events) {
    return events.map(function (e) {
      var label;
      if (e.type === EVENTS.speech) {
        label = (e.speaker === 'patient' ? 'Patient' : 'Student') + ': ' + str(e.transcript);
      } else {
        label = labelize(e.type);
      }
      return { t: e.t, label: label, type: e.type, phase: e.phase, speaker: e.speaker || null };
    });
  }

  /**
   * scoreAttempt(events, scenario, rubric, aiVerdicts) -> AttemptResult (§10/§11)
   *
   * ### THE CONFLICT RULE ###
   * The deterministic pass runs FIRST and unconditionally, for every criterion.
   * The AI verdict is consulted only inside the `det.requiredEventsPassed`
   * branch. When that gate is false, `finalScore` is hard-set to 0 and the
   * verdict object is never even read — so no AI answer, however confident or
   * however malformed, can produce credit for a physical action the event log
   * says did not happen. When a forbidden event fired, the cap is 0, so the AI
   * cannot contradict a violation either.
   */
  function scoreAttempt(events, scenario, rubric, aiVerdicts) {
    var verdicts = obj(aiVerdicts);
    var results = [];

    for (var i = 0; i < rubric.length; i++) {
      var c = rubric[i];
      var maxScore = numOr(c.maxScore, 2);

      if (isNotApplicable(c, scenario)) {
        results.push({
          id: c.id, title: c.title, detail: c.detail, section: c.section,
          score: 0, maxScore: maxScore, critical: !!c.critical,
          notApplicable: true, status: 'N/A',
          evidence: [], missing: [], correction: null, aiConfidence: null
        });
        continue;
      }

      var det = evaluateDeterministic(c, events, scenario);
      var evidence = det.evidence.slice();
      var aiConfidence = null;
      var finalScore;

      if (c.aiEvaluation && c.aiEvaluation.enabled) {
        // ---------------------------------------------------------------
        // §10 CONFLICT RULE, verbatim: "objective event data always wins for
        // physical actions. The AI verdict can only raise/lower the *quality*
        // score (0/1/2) for criteria whose requiredEvents already passed — it
        // can never manufacture a passed requiredEvents check, and it can
        // never contradict a forbiddenEvents hit."
        //
        // Note the ordering: `det.requiredEventsPassed` is read from the
        // deterministic event log BEFORE the verdict is touched. In the else
        // branch the verdict is not read at all.
        // ---------------------------------------------------------------
        if (det.requiredEventsPassed) {
          var verdict = verdicts[c.id] || { score: 0, evidence: [], confidence: null };
          var cap = det.forbiddenFired ? 0 : maxScore;
          finalScore = clamp(numOr(verdict.score, 0), 0, cap);
          evidence = evidence.concat(arr(verdict.evidence));
          aiConfidence = (typeof verdict.confidence === 'number') ? verdict.confidence : null;
        } else {
          finalScore = 0;
        }
      } else {
        finalScore = det.score;
      }

      var status = (finalScore >= maxScore) ? 'PASS' : (finalScore > 0 ? 'PARTIAL' : 'MISSED');

      results.push({
        id: c.id, title: c.title, detail: c.detail, section: c.section,
        score: finalScore, maxScore: maxScore, critical: !!c.critical,
        notApplicable: false, status: status,
        evidence: evidence, missing: det.missing,
        correction: (status === 'PASS') ? null : correctionFor(c),
        aiConfidence: aiConfidence,
        aiGraded: !!(c.aiEvaluation && c.aiEvaluation.enabled)
      });
    }

    var scored = results.filter(function (r) { return !r.notApplicable; });
    var rawScore = 0, maxScore2 = 0, anyZero = false;
    scored.forEach(function (r) {
      rawScore += r.score;
      maxScore2 += r.maxScore;
      if (r.score === 0) { anyZero = true; }
    });
    var percentage = maxScore2 > 0 ? Math.round((rawScore / maxScore2) * 100) : 0;

    /* §6: critical errors are a side effect of normal scoring — a critical
       criterion that scored 0 (whether because a forbidden event fired or
       because its required evidence is missing) is a critical error. */
    var criticalErrors = [];
    results.forEach(function (r) {
      if (!r.critical || r.notApplicable || r.score !== 0) { return; }
      var ts = 0;
      if (r.evidence.length) {
        ts = r.evidence[0].t;
        r.evidence.forEach(function (e) { if (e.t < ts) { ts = e.t; } });
      } else if (events.length) {
        ts = events[events.length - 1].t;
      }
      /* `missing[0]` is an event label or an ordering sentence; prefix it so the
         report reads as a sentence rather than a bare event name. When there is
         nothing missing, the zero came from an AI quality verdict instead. */
      var why;
      if (r.missing.length) {
        why = /must happen before|did not match|outside the/.test(r.missing[0])
          ? r.missing[0]
          : ('Never recorded: ' + r.missing[0] + '.');
      } else {
        why = r.title + ' was not demonstrated.';
      }
      criticalErrors.push({
        criterionId: r.id, title: r.title, timestamp: ts, explanation: why
      });
    });

    /* PASS = zero rubric items scored 0 AND zero critical errors. A critical
       item at 0 is also always a critical error, so that half alone would cover
       most cases — but a NON-critical item at 0 must fail the attempt too under
       this reading, which the critical check alone would miss. Both are
       therefore checked explicitly. A high percentage never hides a fail. */
    var result = (criticalErrors.length === 0 && !anyZero) ? 'PASS' : 'FAIL';

    return {
      rawScore: rawScore,
      maxScore: maxScore2,
      fullRubricMax: rubric.reduce(function (a, c) { return a + numOr(c.maxScore, 2); }, 0),
      notApplicableCount: results.length - scored.length,
      percentage: percentage,
      criticalErrors: criticalErrors,
      result: result,
      perCriterion: results,
      timeline: buildTimeline(events)
    };
  }

  /* -- The deferred AI grading pass (§7) ------------------------------------
   * Runs once, at simulation_completed — never mid-attempt, so the learner is
   * never interrupted with grading messages. One request per aiEvaluation-
   * enabled, applicable criterion, fired concurrently. The model receives a
   * READ-ONLY windowed transcript slice and nothing else: no tools, no ability
   * to write events, no access to the event log. It returns a score + evidence
   * and that is all it can influence — the conflict rule above decides what, if
   * anything, that score is allowed to do.
   * --------------------------------------------------------------------- */

  function gradeOneCriterion(criterion, events, scenario) {
    var ai = aiApi();
    var zero = { score: 0, evidence: [], confidence: null };
    if (!ai || !criterion.aiEvaluation) { return Promise.resolve(zero); }

    var windowPhases = {};
    arr(criterion.aiEvaluation.windowPhases).forEach(function (p) { windowPhases[p] = true; });

    var windowed = events.filter(function (e) {
      return e.type === EVENTS.speech && windowPhases[e.phase];
    });
    // Nothing was said in this criterion's window — §7's "return score 0 rather
    // than infer" applies at the source; no call is made at all.
    if (!windowed.length) { return Promise.resolve(zero); }

    var transcript = windowed.map(function (e) {
      var who = (e.speaker === 'patient') ? 'PATIENT' : 'STUDENT';
      return '[' + Math.round(e.t / 1000) + 's] ' + who + ': ' + str(e.transcript);
    }).join('\n');

    var system = str(criterion.aiEvaluation.evaluationPrompt) + '\n\n' +
      'Respond with ONLY minified JSON in this exact shape: ' +
      '{"score": 0, "evidence": "one-sentence quote or paraphrase of what the transcript actually shows", ' +
      '"confidence": 0.0}. `score` must be the integer 0, 1, or 2. `confidence` is 0-1, your own certainty ' +
      'in this score. Do not include anything outside the JSON object. You are grading a transcript only — ' +
      'you cannot observe physical actions, and a separate deterministic engine already checks whether the ' +
      'required physical steps occurred. Never award credit for something you did not read in the transcript.';

    return ai.chat({
      system: system,
      messages: [{ role: 'user', content: 'Transcript window:\n' + clip(transcript, 6000) }],
      feature: 'medsim_rubric',
      maxTokens: 260,
      temperature: 0.1,
      json: true
    }).then(function (raw) {
      var o = parseJSONObject(raw);
      if (!o) { return zero; }
      var s = numOr(o.score, 0);
      var evText = str(o.evidence);
      var ev = [];
      if (evText) { ev.push({ t: windowed[0].t, kind: 'speech', label: evText }); }
      return {
        score: clamp(Math.round(s), 0, numOr(criterion.maxScore, 2)),
        evidence: ev,
        confidence: (typeof o.confidence === 'number') ? clamp(o.confidence, 0, 1) : null
      };
    }, function () { return zero; });
  }

  function fetchAIVerdicts(events, scenario, rubric) {
    var ai = aiApi();
    var candidates = rubric.filter(function (c) {
      return !!(c.aiEvaluation && c.aiEvaluation.enabled) && !isNotApplicable(c, scenario);
    });
    if (!ai || !candidates.length) { return Promise.resolve({}); }

    var out = {};
    var jobs = candidates.map(function (c) {
      return gradeOneCriterion(c, events, scenario).then(function (v) { out[c.id] = v; },
        function () { out[c.id] = { score: 0, evidence: [], confidence: null }; });
    });
    return Promise.all(jobs).then(function () { return out; }, function () { return out; });
  }

  /* ==========================================================================
   * 6. SIMULATED PATIENT (§8) — REVEAL-GATED, TWO LAYERS
   * --------------------------------------------------------------------------
   * LAYER 1 (classifier): sees the fact KEY NAMES only. buildClassifierSystem()
   *   reads `f.key` and never touches `f.value`, so no fact value is present in
   *   the classifier's context at all. Its only output is a list of keys, and
   *   those keys are the only thing that may grow engine.revealed.
   *
   * LAYER 2 (reply): buildPatientReplySystem() filters the scenario's fact list
   *   down to `revealed` BEFORE the prompt string is constructed. An unrevealed
   *   fact's VALUE is therefore never part of the bytes sent to the model — this
   *   is an information-availability guarantee, not an instruction the model
   *   could choose to disregard. Even if the model "wanted" to help the learner
   *   by volunteering the allergy list before being asked, it does not have it.
   * ======================================================================== */

  /**
   * LAYER 1 PROMPT. Note: `facts[i].key` only. `.value` is never read in this
   * function — the classifier is structurally incapable of leaking a fact
   * because it was never given one.
   */
  function buildClassifierSystem(scenario) {
    var facts = arr(obj(scenario).patientFacts);
    var keyLines = [];
    for (var i = 0; i < facts.length; i++) {
      keyLines.push('- ' + str(facts[i].key));   // KEY NAME ONLY. Never facts[i].value.
    }
    return [
      'You classify a nursing student\'s spoken question to a simulated patient. You are given a fixed list',
      'of fact KEYS this patient scenario tracks — you do NOT know the values, only the key names below.',
      'Decide which of these keys (if any) the student\'s utterance is asking about.',
      'Respond with ONLY minified JSON: {"askedKeys": ["key1", "key2"]} — an empty array if the utterance',
      'does not ask about anything on this list (small talk, or a question about something this scenario',
      'does not track). Never invent a key that is not in the list below.',
      '',
      'Fact keys this scenario tracks:',
      keyLines.join('\n')
    ].join('\n');
  }

  /**
   * LAYER 2 PROMPT. The filter runs BEFORE the join, so `knownFacts` — and
   * therefore the whole system string — can only ever contain values for keys
   * already present in `revealed`. There is no code path in which an unrevealed
   * fact's value reaches this string.
   */
  function buildPatientReplySystem(scenario, revealed) {
    var sc = obj(scenario);
    var seen = obj(revealed);
    var persona = obj(sc.patientPersona);

    // ---- THE GATE: filter to revealed keys FIRST, then read values. --------
    var visibleFacts = arr(sc.patientFacts).filter(function (f) {
      return !!seen[str(f.key)];
    });
    var knownFacts = visibleFacts.map(function (f) {
      return '- ' + str(f.key) + ': ' + str(f.value);
    }).join('\n');
    // -----------------------------------------------------------------------

    var behaviors = arr(persona.behaviors).map(function (b) { return '- ' + str(b); }).join('\n');

    /* The roleplay header is gated too. The patient's NAME is itself a gated
       fact (`two_identifiers` is graded on the student actually asking for it),
       so naming the character in the header before the student has asked would
       put that value in the model's context — exactly the leak this function
       exists to prevent. Until `name` is revealed the character is unnamed. */
    var whoLine = seen.name
      ? ('You are roleplaying ' + str(obj(sc.patient).name) + ', a patient in a nursing simulation.')
      : 'You are roleplaying a patient in a nursing simulation. You have not told the student your name and must not state it unless asked.';

    return [
      whoLine,
      'Tone: ' + str(persona.tone) + '.',
      behaviors ? ('Behavior notes:\n' + behaviors) : '',
      '',
      'You may ONLY state facts from the list below — these are the only things about yourself you',
      'currently know to say, because the student has only asked about these so far. If the student asks',
      'about anything NOT in this list, stay in character and say you are not sure, or suggest they check',
      'your chart or ask the nurse — never guess, invent, or state a fact outside this list, even if it',
      'would seem helpful to the student. Never volunteer any fact from the list unless it directly answers',
      'what the student just asked — do not offer facts nobody has asked about yet, even ones you are now',
      'allowed to share.',
      '',
      'Facts you currently know to share:',
      knownFacts || '(none yet — the student has not asked you anything you have an answer for)',
      '',
      'Respond with ONLY minified JSON: {"say": "your one or two sentence in-character reply"}'
    ].filter(function (l) { return l !== ''; }).join('\n');
  }

  /* Deterministic keyword pre-pass. Runs BEFORE the AI classifier and is the
     reason identifier/allergy questions still fire their rubric events when AI
     is unavailable or refuses. It maps an utterance onto the objective event
     vocabulary (§3) — it never reveals a fact by itself; revealing is handled
     by matching against the scenario's own fact keys below. */
  function deterministicIntents(text) {
    var t = str(text).toLowerCase();
    var out = { events: [], keys: [] };
    function fire(ev) { if (out.events.indexOf(ev) === -1) { out.events.push(ev); } }
    function key(k) { if (out.keys.indexOf(k) === -1) { out.keys.push(k); } }

    if (/\b(your name|full name|state your name|who are you|what.s your name|tell me your name)\b/.test(t)) {
      fire(EVENTS.patientNameRequested); key('name');
    }
    if (/\b(date of birth|birth ?date|birthday|d\.?o\.?b\.?|when were you born)\b/.test(t)) {
      fire(EVENTS.patientDobRequested); key('dob');
    }
    if (/\b(allerg)/.test(t)) {
      fire(EVENTS.allergyQuestionAsked); key('allergies');
    }
    if (/\b(pain|hurt|ache|sore)\b/.test(t)) { key('pain_level'); }
    if (/\b(swallow|npo|by mouth|pills? ok|trouble taking)\b/.test(t)) { key('understanding_of_med'); }
    if (/\b(last (dose|pill|time)|when did you (last )?(take|get))\b/.test(t)) { key('last_dose_time'); }
    if (/\b(constipat|bowel|stool|backed up)\b/.test(t)) { key('constipation_history'); }
    if (/\b(code status|full code|dnr|resuscitat)\b/.test(t)) { key('code_status'); }
    if (/\b(why are you (here|in)|admitted|admission|brought you in)\b/.test(t)) { key('admitting_reason'); }
    if (/\b(what (is|do you know about) (this|the) (med|pill|drug)|understand)\b/.test(t)) {
      key('understanding_of_med');
    }
    return out;
  }

  /**
   * handleStudentUtterance(engine, text, onDone)
   * The single entry point for anything the student says (mic or typed).
   *   1. log the student's line as a phase-tagged speech event
   *   2. deterministic intent pass -> objective rubric events + candidate keys
   *   3. LAYER 1: AI classifier (key names only) -> more revealed keys
   *   4. LAYER 2: AI reply built from revealed facts ONLY -> patient speech event
   */
  function handleStudentUtterance(engine, text, onDone, confidence) {
    var utterance = str(text).trim();
    if (!utterance) { return Promise.resolve(); }

    // ASR confidence (§3) rides on the event — it is recognition confidence,
    // never grading confidence, and nothing in scoring reads it.
    engine.logSpeech(utterance, 'student', confidence);

    var validKeys = {};
    arr(obj(engine.scenario).patientFacts).forEach(function (f) { validKeys[str(f.key)] = true; });

    var intents = deterministicIntents(utterance);
    intents.events.forEach(function (ev) { engine.dispatch(ev, { source: 'speech' }); });
    intents.keys.forEach(function (k) { if (validKeys[k]) { engine.revealFact(k); } });

    var ai = aiApi();
    if (!ai) {
      // No AI configured: fall back to a scripted answer built from the SAME
      // reveal ledger, so the offline path cannot leak more than the online one.
      var scripted = offlinePatientReply(engine, utterance);
      engine.logSpeech(scripted, 'patient');
      if (isFn(onDone)) { onDone(); }
      return Promise.resolve();
    }

    // ---- LAYER 1: classify (fact KEY NAMES only reach the model) -----------
    var classify = ai.chat({
      system: buildClassifierSystem(engine.scenario),
      messages: [{ role: 'user', content: 'Student said: "' + clip(utterance, 300) + '"' }],
      feature: 'patient',
      maxTokens: 160,
      temperature: 0,
      json: true
    }).then(function (raw) {
      var o = parseJSONObject(raw);
      var keys = o ? arr(o.askedKeys) : [];
      for (var i = 0; i < keys.length; i++) {
        var k = str(keys[i]);
        if (validKeys[k]) { engine.revealFact(k); }
      }
    }, function () { /* classification failure reveals nothing — fail closed */ });

    // ---- LAYER 2: reply, built from the reveal ledger AFTER layer 1 --------
    return classify.then(function () {
      return ai.chat({
        // buildPatientReplySystem filters to engine.revealed before building
        // the string; unrevealed values are not in this payload at all.
        system: buildPatientReplySystem(engine.scenario, engine.revealed),
        messages: [{ role: 'user', content: 'Student said: "' + clip(utterance, 300) + '"' }],
        feature: 'patient',
        maxTokens: 220,
        temperature: 0.6,
        json: true
      });
    }).then(function (raw) {
      var o = parseJSONObject(raw);
      var say = o ? str(o.say).trim() : '';
      engine.logSpeech(say || 'I\'m not sure — you might want to check my chart.', 'patient');
      if (isFn(onDone)) { onDone(); }
    }, function () {
      engine.logSpeech(offlinePatientReply(engine, utterance), 'patient');
      if (isFn(onDone)) { onDone(); }
    });
  }

  /** Offline patient voice. Reads ONLY facts already in engine.revealed — the
      same gate the AI path uses, so turning AI off cannot widen what leaks. */
  function offlinePatientReply(engine, utterance) {
    var seen = obj(engine.revealed);
    var facts = arr(obj(engine.scenario).patientFacts).filter(function (f) {
      return !!seen[str(f.key)];
    });
    var intents = deterministicIntents(utterance);
    for (var i = 0; i < intents.keys.length; i++) {
      for (var j = 0; j < facts.length; j++) {
        if (str(facts[j].key) === intents.keys[i]) { return str(facts[j].value); }
      }
    }
    return 'I\'m not sure about that — you might want to check my chart or ask my nurse.';
  }

  /* ==========================================================================
   * 7. SPEECH CAPTURE (§7 step 1-2) — webkitSpeechRecognition
   * --------------------------------------------------------------------------
   * Same browser-native pattern js/voice.js already uses. Only COMPLETED
   * utterances become SpeechEvents — interim transcripts are shown live but
   * never logged, so nothing is graded on ASR noise (§7 step 2).
   * ======================================================================== */

  function speechCtor() {
    try {
      return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    } catch (e) { return null; }
  }
  function speechSupported() { return !!speechCtor(); }

  function useMic(onFinalUtterance) {
    var st = useState(false), listening = st[0], setListening = st[1];
    var it = useState(''), interim = it[0], setInterim = it[1];
    var recRef = useRef(null);
    var wantRef = useRef(false);
    var cbRef = useRef(onFinalUtterance);
    cbRef.current = onFinalUtterance;

    var stop = useCallback(function () {
      wantRef.current = false;
      setListening(false);
      setInterim('');
      var rec = recRef.current;
      recRef.current = null;
      if (!rec) { return; }
      try { rec.onresult = null; rec.onerror = null; rec.onend = null; } catch (e) { /* noop */ }
      try { rec.stop(); } catch (e2) { /* noop */ }
    }, []);

    var start = useCallback(function () {
      var Ctor = speechCtor();
      if (!Ctor || recRef.current) { return; }
      var rec;
      try { rec = new Ctor(); } catch (e) { toast('Microphone is not available in this browser.', 'error'); return; }
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = function (ev) {
        var live = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var r = ev.results[i];
          var text = str(r[0] && r[0].transcript);
          if (r.isFinal) {
            // ONE completed utterance -> one SpeechEvent. Interims never log.
            var conf = (r[0] && typeof r[0].confidence === 'number') ? r[0].confidence : undefined;
            if (text.trim() && isFn(cbRef.current)) {
              try { cbRef.current(text.trim(), conf); } catch (e2) { /* noop */ }
            }
          } else {
            live += text;
          }
        }
        setInterim(live);
      };
      rec.onerror = function (e) {
        var code = str(e && e.error);
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          toast('Microphone permission denied. You can still type instead.', 'error');
          stop();
        }
      };
      rec.onend = function () {
        // Continuous mode ends itself periodically; restart while still wanted.
        if (wantRef.current && recRef.current === rec) {
          try { rec.start(); return; } catch (e) { /* fall through */ }
        }
        if (recRef.current === rec) { recRef.current = null; setListening(false); }
      };
      recRef.current = rec;
      wantRef.current = true;
      try { rec.start(); setListening(true); }
      catch (e3) { recRef.current = null; wantRef.current = false; setListening(false); }
    }, [stop]);

    useEffect(function () { return function () { stop(); }; }, [stop]);

    return {
      supported: speechSupported(),
      listening: listening,
      interim: interim,
      start: start,
      stop: stop,
      toggle: function () { if (listening) { stop(); } else { start(); } }
    };
  }

  /* ==========================================================================
   * 8. STYLES (injected once, prefixed ms-)
   * ======================================================================== */

  function injectStyles() {
    try { if (document.getElementById('medsim-styles')) { return; } } catch (e) { return; }
    var css = [
      '.ms-root{color:var(--text,#f1f5f9);}',
      '.ms-card{background:var(--surface,#1e293b);border:1px solid var(--surface2,#334155);',
      'border-radius:12px;padding:14px 16px;margin-bottom:12px;}',
      '.ms-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;',
      'flex-wrap:wrap;margin-bottom:10px;}',
      '.ms-hd h3{margin:0;font-size:1.05rem;}',
      '.ms-muted{color:var(--text2,#94a3b8);font-size:0.85rem;}',
      '.ms-btn{padding:8px 13px;border-radius:8px;border:1px solid var(--surface2,#334155);',
      'background:var(--surface,#1e293b);color:var(--text,#f1f5f9);cursor:pointer;',
      'font-weight:600;font-size:0.88rem;font-family:inherit;line-height:1.25;}',
      '.ms-btn:hover{border-color:var(--accent,#3b82f6);}',
      '.ms-btn:disabled{opacity:0.45;cursor:not-allowed;}',
      '.ms-btn.on{background:var(--accent,#3b82f6);border-color:var(--accent,#3b82f6);color:#fff;}',
      '.ms-btn.ok{background:var(--green,#22c55e);border-color:var(--green,#22c55e);color:#0f172a;}',
      '.ms-btn.danger{background:var(--red,#ef4444);border-color:var(--red,#ef4444);color:#fff;}',
      '.ms-btn.warn{background:var(--orange,#f59e0b);border-color:var(--orange,#f59e0b);color:#0f172a;}',
      '.ms-btn.sm{padding:5px 9px;font-size:0.78rem;}',
      '.ms-btnrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}',
      '.ms-chip{display:inline-block;padding:2px 9px;border-radius:999px;font-size:0.74rem;',
      'font-weight:700;background:var(--surface2,#334155);color:var(--text,#f1f5f9);}',
      '.ms-chip.acc{background:rgba(var(--accent-rgb),0.18);color:var(--accent,#3b82f6);border:1px solid rgba(var(--accent-rgb),0.42);}',
      '.ms-chip.ok{background:rgba(34,197,94,0.16);color:var(--green,#22c55e);border:1px solid rgba(34,197,94,0.42);}',
      '.ms-chip.warn{background:rgba(245,158,11,0.16);color:var(--orange,#f59e0b);border:1px solid rgba(245,158,11,0.42);}',
      '.ms-chip.bad{background:rgba(239,68,68,0.16);color:var(--red,#ef4444);border:1px solid rgba(239,68,68,0.42);}',
      /* ---- schematic location panel (deliberately NOT photorealistic) ---- */
      '.ms-scene{border:1px solid var(--surface2,#334155);border-radius:12px;padding:16px;',
      'background:linear-gradient(160deg,rgba(var(--accent-rgb),0.07),rgba(15,23,42,0.25));min-height:210px;}',
      '.ms-scene-hd{display:flex;align-items:center;gap:10px;margin-bottom:12px;}',
      '.ms-scene-hd .ms-ico{font-size:1.7rem;line-height:1;}',
      '.ms-scene-hd h4{margin:0;font-size:1rem;}',
      '.ms-hotgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:9px;}',
      '.ms-hot{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;',
      'padding:11px 12px;border-radius:10px;border:1px dashed var(--surface2,#334155);',
      'background:var(--surface,#1e293b);color:var(--text,#f1f5f9);cursor:pointer;font-family:inherit;}',
      '.ms-hot:hover{border-color:var(--accent,#3b82f6);border-style:solid;}',
      '.ms-hot .e{font-size:1.35rem;line-height:1;}',
      '.ms-hot .l{font-weight:650;font-size:0.86rem;}',
      '.ms-hot .s{font-size:0.74rem;color:var(--text2,#94a3b8);}',
      '.ms-hot.done{border-style:solid;border-color:var(--green,#22c55e);',
      'background:color-mix(in srgb,var(--green,#22c55e) 12%,var(--surface,#1e293b));}',
      /* ---- overlay panels ---- */
      '.ms-overlay{position:fixed;inset:0;background:rgba(2,6,23,0.72);z-index:1400;',
      'display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow:auto;}',
      '.ms-panel{background:var(--surface,#1e293b);border:1px solid var(--surface2,#334155);',
      'border-radius:14px;max-width:760px;width:100%;padding:16px 18px;margin:auto;}',
      '.ms-table{width:100%;border-collapse:collapse;font-size:0.86rem;}',
      '.ms-table th,.ms-table td{border:1px solid var(--surface2,#334155);padding:7px 8px;',
      'text-align:left;vertical-align:top;}',
      '.ms-table th{background:var(--surface2,#334155);font-size:0.74rem;text-transform:uppercase;',
      'letter-spacing:0.04em;}',
      '.ms-cell{padding:4px 8px;border-radius:5px;font-weight:700;text-align:center;',
      'color:#0f172a;font-size:0.78rem;}',
      '.ms-cell.yellow{background:#facc15;}.ms-cell.green{background:#4ade80;}',
      '.ms-cell.red{background:#f87171;color:#fff;}.ms-cell.white{background:#e2e8f0;}',
      '.ms-vitals{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;',
      'background:var(--surface2,#334155);padding:10px;border-radius:8px;margin:8px 0;font-size:0.86rem;}',
      '.ms-vitals div span{display:block;color:var(--text2,#94a3b8);font-size:0.7rem;',
      'text-transform:uppercase;letter-spacing:0.06em;}',
      /* ---- bottom action bar ---- */
      '.ms-bar{position:sticky;bottom:0;z-index:20;background:var(--surface,#1e293b);',
      'border:1px solid var(--surface2,#334155);border-radius:12px;padding:10px 12px;margin-top:12px;',
      'box-shadow:0 -6px 18px rgba(2,6,23,0.35);}',
      '.ms-mic{width:44px;height:44px;border-radius:999px;border:1px solid var(--surface2,#334155);',
      'background:var(--surface2,#334155);color:var(--text,#f1f5f9);cursor:pointer;font-size:1.15rem;}',
      '.ms-mic.live{background:var(--red,#ef4444);border-color:var(--red,#ef4444);color:#fff;',
      'animation:ms-pulse 1.3s ease-in-out infinite;}',
      '@keyframes ms-pulse{0%,100%{opacity:1;}50%{opacity:0.55;}}',
      '@media (prefers-reduced-motion: reduce){.ms-mic.live{animation:none;}}',
      '.ms-input{flex:1 1 190px;min-width:0;background:var(--surface2,#334155);',
      'color:var(--text,#f1f5f9);border:1px solid var(--surface2,#334155);border-radius:8px;',
      'padding:9px 11px;font-size:0.9rem;font-family:inherit;}',
      '.ms-convo{max-height:190px;overflow-y:auto;padding:4px 2px;}',
      '.ms-line{margin:5px 0;font-size:0.88rem;line-height:1.4;}',
      '.ms-line b{font-weight:700;}',
      '.ms-line.student b{color:var(--accent,#3b82f6);}',
      '.ms-line.patient b{color:var(--green,#22c55e);}',
      /* ---- report ---- */
      '.ms-banner{border-radius:14px;padding:18px;text-align:center;border-width:2px;border-style:solid;',
      'margin-bottom:14px;}',
      '.ms-banner.pass{border-color:var(--green,#22c55e);background:rgba(34,197,94,0.1);}',
      '.ms-banner.fail{border-color:var(--red,#ef4444);background:rgba(239,68,68,0.1);}',
      '.ms-banner .verdict{font-size:2.1rem;font-weight:800;letter-spacing:0.04em;line-height:1;}',
      '.ms-banner .score{font-size:1.5rem;font-weight:700;margin-top:8px;}',
      '.ms-banner.pass .verdict,.ms-banner.pass .score{color:var(--green,#22c55e);}',
      '.ms-banner.fail .verdict,.ms-banner.fail .score{color:var(--red,#ef4444);}',
      '.ms-crit{background:rgba(239,68,68,0.1);border:2px solid var(--red,#ef4444);',
      'border-radius:12px;padding:14px 16px;margin-bottom:14px;}',
      '.ms-item{border:1px solid var(--surface2,#334155);border-radius:10px;padding:10px 12px;margin:8px 0;}',
      '.ms-item.pass{border-left:4px solid var(--green,#22c55e);}',
      '.ms-item.partial{border-left:4px solid var(--orange,#f59e0b);}',
      '.ms-item.missed{border-left:4px solid var(--red,#ef4444);}',
      '.ms-item.na{border-left:4px solid var(--surface2,#334155);opacity:0.65;}',
      '.ms-ev{font-size:0.8rem;color:var(--text2,#94a3b8);margin-top:5px;padding-left:10px;',
      'border-left:2px solid var(--surface2,#334155);}',
      '.ms-tl{max-height:340px;overflow-y:auto;font-size:0.83rem;}',
      '.ms-tl-row{display:flex;gap:9px;padding:4px 0;border-bottom:1px solid var(--surface2,#334155);}',
      '.ms-tl-row .t{color:var(--text2,#94a3b8);min-width:52px;font-variant-numeric:tabular-nums;}',
      '.ms-tl-row.cur{background:rgba(var(--accent-rgb),0.14);border-radius:5px;}',
      '.ms-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:11px;}',
      '.ms-hint{background:rgba(var(--accent-rgb),0.1);border-left:3px solid var(--accent,#3b82f6);',
      'padding:8px 11px;border-radius:0 8px 8px 0;margin:8px 0;font-size:0.87rem;}',
      '.ms-note{background:rgba(245,158,11,0.09);border-left:3px solid var(--orange,#f59e0b);',
      'padding:8px 11px;border-radius:0 8px 8px 0;margin:8px 0;font-size:0.85rem;}',
      '@media (max-width:520px){.ms-hotgrid{grid-template-columns:repeat(auto-fill,minmax(128px,1fr));}}'
    ].join('');
    var el = document.createElement('style');
    el.id = 'medsim-styles';
    el.textContent = css;
    try { document.head.appendChild(el); } catch (e) { /* noop */ }
  }

  /* ==========================================================================
   * 9. SHARED SMALL VIEWS
   * ======================================================================== */

  function Chip(props) {
    return ce('span', { className: 'ms-chip ' + (props.kind || ''), style: props.style }, props.children);
  }

  function VitalsBlock(props) {
    var v = obj(props.vitals);
    var cells = [];
    function add(l, x) { if (x !== undefined && x !== null && x !== '') { cells.push({ l: l, v: str(x) }); } }
    add('BP', v.bp); add('HR', v.hr); add('RR', v.rr); add('Temp', v.temp); add('SpO2', v.spo2);
    return ce('div', null,
      ce('div', { className: 'ms-vitals' },
        cells.map(function (c, i) { return ce('div', { key: i }, ce('span', null, c.l), c.v); })),
      v.notes ? ce('div', { className: 'ms-muted', style: { fontStyle: 'italic' } }, str(v.notes)) : null
    );
  }

  /* -- Persistent panels (§12: reachable throughout, never consumed) -------- */

  function ChartPanel(props) {
    var s = props.scenario, p = obj(s.patient);
    return ce('div', null,
      ce('h3', { style: { marginTop: 0 } }, 'Chart — ' + str(p.name)),
      ce('div', { className: 'ms-muted' },
        'MRN ' + str(p.mrn) + ' · ' + str(p.age) + ' ' + str(p.sex) + ' · ' + str(p.weightKg) + ' kg · Room ' + str(p.room)),
      ce('div', { className: 'ms-muted', style: { marginTop: 4 } },
        'Code status: ' + str(p.codeStatus)),
      ce('div', { style: { marginTop: 8 } },
        ce('strong', null, 'Allergies: '),
        ce('span', { style: { color: 'var(--red,#ef4444)', fontWeight: 700 } },
          arr(p.allergies).join(', ') || 'None documented')),
      ce('div', { style: { marginTop: 6 } }, ce('strong', null, 'Admitting: '), str(p.admittingDx)),
      ce('div', { style: { marginTop: 4 } }, ce('strong', null, 'PMH: '), arr(p.pmh).join(', ') || '—'),
      arr(p.iv).length ? ce('div', { style: { marginTop: 4 } }, ce('strong', null, 'IV: '), arr(p.iv).join('; ')) : null,
      ce('div', { style: { marginTop: 10, fontWeight: 700 } }, 'Vital signs'),
      ce(VitalsBlock, { vitals: s.vitals }),
      ce('div', { className: 'ms-muted', style: { marginTop: 8 } },
        'Date of birth on file: ' + str(p.dob) +
        (arr(s.fabricatedFactKeys).indexOf('dob') !== -1 ? '  (simulation value — the source MAR carries no DOB)' : '')),
      ce('div', { className: 'ms-note' },
        'Room number and age are NOT acceptable patient identifiers. Use name and date of birth.')
    );
  }

  function MARPanel(props) {
    var s = props.scenario;
    var orders = arr(s.orders);
    return ce('div', null,
      ce('h3', { style: { marginTop: 0 } }, 'MAR'),
      ce('div', { className: 'ms-muted' },
        str(obj(s.patient).name) + ' · MRN ' + str(obj(s.patient).mrn) + ' · Sim time ' + str(s.currentSimTime)),
      ce('div', { style: { overflowX: 'auto', marginTop: 10 } },
        ce('table', { className: 'ms-table' },
          ce('thead', null, ce('tr', null,
            ce('th', null, 'Medication / Order'), ce('th', null, 'Route'),
            ce('th', null, 'Scheduled'), ce('th', null, 'Given'), ce('th', null, 'Status'))),
          ce('tbody', null, orders.map(function (o, i) {
            var row = null;
            arr(s.mar).forEach(function (m) { if (m.medId === o.medId) { row = m; } });
            var color = (row && row.color) || 'white';
            var label = color === 'yellow' ? 'DUE' : color === 'green' ? 'GIVEN'
                      : color === 'red' ? 'HELD' : (o.prn ? 'PRN' : '—');
            var d = drugById(o.medId);
            return ce('tr', { key: i },
              ce('td', null,
                ce('div', { style: { fontWeight: 650 } }, str(o.orderText)),
                d ? ce('div', { className: 'ms-muted' }, str(d.generic) + (d.brand ? ' (' + d.brand + ')' : '')) : null,
                (d && d.highAlert) ? ce(Chip, { kind: 'bad', style: { marginTop: 4 } }, 'HIGH-ALERT') : null),
              ce('td', null, str(o.route)),
              ce('td', null, str(o.scheduledTime)),
              ce('td', null, (row && arr(row.givenTimes).join(', ')) || '—'),
              ce('td', null, ce('div', { className: 'ms-cell ' + color }, label)));
          }))
        )),
      ce('div', { style: { marginTop: 10 } },
        ce('strong', null, 'Allergies on the MAR: '),
        ce('span', { style: { color: 'var(--red,#ef4444)', fontWeight: 700 } },
          arr(obj(s.patient).allergies).join(', ') || 'None documented')),
      arr(s.mar).map(function (m, i) {
        return m.notes ? ce('div', { key: i, className: 'ms-muted', style: { marginTop: 6 } }, str(m.notes)) : null;
      }),
      ce('div', { className: 'ms-muted', style: { marginTop: 8, fontSize: '0.8rem' } },
        'Colour key: YELLOW = due within the ±1 hr window. GREEN = already given. WHITE = not due. RED = held/DC.')
    );
  }

  function DrugGuidePanel(props) {
    var ids = arr(props.scenario.drugGuideEntries);
    if (!ids.length) { return ce('div', null, ce('h3', null, 'Drug Guide'), ce('div', { className: 'ms-muted' }, 'No entries for this scenario.')); }
    return ce('div', null,
      ce('h3', { style: { marginTop: 0 } }, 'Drug Guide'),
      ids.map(function (id) {
        var d = drugById(id);
        if (!d) { return ce('div', { key: id, className: 'ms-muted' }, 'No guide entry loaded for "' + id + '".'); }
        return ce('div', { key: id, className: 'ms-card', style: { marginTop: 10 } },
          ce('h4', { style: { margin: '0 0 4px' } },
            str(d.generic) + (d.brand ? ' (' + d.brand + ')' : ''),
            d.highAlert ? ce(Chip, { kind: 'bad', style: { marginLeft: 8 } }, 'HIGH-ALERT') : null),
          ce('div', { className: 'ms-muted' }, str(d.klass)),
          ce('div', { style: { marginTop: 6 } }, ce('strong', null, 'Routes: '), arr(d.routes).join(', ')),
          ce('div', null, ce('strong', null, 'Usual adult dose: '), str(d.usualAdultDose)),
          arr(d.holdParameters).length ? ce('div', null,
            ce('strong', { style: { color: 'var(--orange,#f59e0b)' } }, 'HOLD IF: '),
            arr(d.holdParameters).join(' | ')) : null,
          ce('div', null, ce('strong', null, 'Onset/peak/duration: '),
            str(d.onset) + ' / ' + str(d.peak) + ' / ' + str(d.duration)),
          d.antidote ? ce('div', null, ce('strong', null, 'Antidote: '), str(d.antidote)) : null,
          ce('div', { style: { marginTop: 6, fontWeight: 700 } }, 'Critical considerations'),
          ce('ul', { style: { margin: '4px 0 0 18px' } },
            arr(d.criticalConsiderations).map(function (x, i) { return ce('li', { key: i }, str(x)); })),
          ce('div', { style: { marginTop: 6, fontWeight: 700 } }, 'Key teaching'),
          ce('ul', { style: { margin: '4px 0 0 18px' } },
            arr(d.keyTeaching).map(function (x, i) { return ce('li', { key: i }, str(x)); })),
          ce('div', { style: { marginTop: 6 } }, ce('strong', null, 'Side effects: '), arr(d.sideEffects).join(', '))
        );
      })
    );
  }

  function InventoryPanel(props) {
    var s = props.scenario, eng = props.engine;
    return ce('div', null,
      ce('h3', { style: { marginTop: 0 } }, 'Medication drawer'),
      ce('div', { className: 'ms-muted' },
        'Dispenser style: ' + labelize(str(obj(s.environment).dispenserStyle)) +
        '. Selecting is not removing — remove it only when you have completed your first check.'),
      arr(s.medicationsAvailable).map(function (id) {
        var d = drugById(id) || { generic: id };
        var selected = eng.selectedMedId === id;
        var removedEv = eng.firstOf(EVENTS.medicationRemoved);
        var removed = !!removedEv && str(obj(removedEv.meta).medId) === id;
        return ce('div', { key: id, className: 'ms-card', style: { marginTop: 8 } },
          ce('div', { style: { fontWeight: 650 } }, str(d.generic) + (d.brand ? ' (' + d.brand + ')' : '')),
          ce('div', { className: 'ms-muted' }, str(d.usualAdultDose || '')),
          ce('div', { className: 'ms-btnrow' },
            ce('button', {
              className: 'ms-btn' + (selected ? ' on' : ''),
              onClick: function () { props.onSelect(id); }
            }, selected ? '✓ Selected' : 'Select this medication'),
            ce('button', {
              className: 'ms-btn' + (removed ? ' ok' : ''),
              disabled: removed,
              onClick: function () { props.onRemove(id); }
            }, removed ? '✓ Removed from drawer' : 'Remove from drawer')));
      })
    );
  }

  /* ==========================================================================
   * 10. LOCATION SCENES (§12/§13)
   * --------------------------------------------------------------------------
   * Schematic panels only — CSS boxes with an emoji glyph and labelled tap
   * targets. Deliberately NOT photorealistic generated imagery: §13 defers art
   * generation entirely, and the engine's state/render separation means
   * swapping art in later touches only this section.
   * ======================================================================== */

  function Hotspot(props) {
    return ce('button', {
      className: 'ms-hot' + (props.done ? ' done' : ''),
      onClick: props.onClick,
      type: 'button'
    },
      ce('span', { className: 'e' }, props.emoji),
      ce('span', { className: 'l' }, props.label),
      props.sub ? ce('span', { className: 's' }, props.sub) : null);
  }

  function LocationScene(props) {
    var eng = props.engine, loc = eng.location, act = props.act, open = props.openPanel;
    var fired = function (t) { return eng.hasFired(t); };
    var spots = [];

    if (loc === 'hallway') {
      spots = [
        { e: '🧼', l: 'Hand hygiene', s: 'Foam in at the door', ev: EVENTS.handHygienePerformed, done: fired(EVENTS.handHygienePerformed) },
        { e: '🚪', l: 'Enter patient room', s: 'Starts the assessment phase', ev: EVENTS.enteredPatientRoom, done: fired(EVENTS.enteredPatientRoom) },
        { e: '📋', l: 'Open the chart', s: 'Logs chart viewed', ev: EVENTS.chartViewed, panel: 'chart' },
        { e: '💊', l: 'Open the MAR', s: 'Logs MAR viewed', ev: EVENTS.marViewed, panel: 'mar' }
      ];
    } else if (loc === 'bedside') {
      spots = [
        { e: '🧼', l: 'Hand hygiene', s: 'At the bedside', ev: EVENTS.handHygienePerformed, done: fired(EVENTS.handHygienePerformed) },
        { e: '🙋', l: 'Patient is present', s: 'Confirms who you are talking to', ev: EVENTS.patientPresent, done: fired(EVENTS.patientPresent) },
        { e: '🏷️', l: 'Check wristband', s: 'Identity + allergy band', ev: EVENTS.wristbandViewed, done: fired(EVENTS.wristbandViewed) },
        { e: '🗣️', l: 'Ask for name', s: 'Identifier 1', ev: EVENTS.patientNameRequested, done: fired(EVENTS.patientNameRequested) },
        { e: '🎂', l: 'Ask for date of birth', s: 'Identifier 2 (not room/age)', ev: EVENTS.patientDobRequested, done: fired(EVENTS.patientDobRequested) },
        { e: '⚠️', l: 'Ask about allergies', s: 'Verbal allergy check', ev: EVENTS.allergyQuestionAsked, done: fired(EVENTS.allergyQuestionAsked) },
        { e: '✅', l: 'Confirm identity matches', s: 'Two identifiers verified', ev: EVENTS.patientIdentified, done: fired(EVENTS.patientIdentified) },
        { e: '📈', l: 'Review vital signs', s: 'Pre-admin assessment', ev: EVENTS.vitalsViewed, panel: 'chart' },
        { e: '🔎', l: 'Start bedside check', s: 'Third check, patient present', ev: EVENTS.bedsideCheckStarted, done: fired(EVENTS.bedsideCheckStarted) },
        { e: '☑️', l: 'Third check complete', s: 'Moves to education', ev: EVENTS.thirdCheckCompleted, done: fired(EVENTS.thirdCheckCompleted) },
        { e: '🎓', l: 'Give patient education', s: 'Purpose, effects, side effects', ev: EVENTS.patientEducationGiven, done: fired(EVENTS.patientEducationGiven) },
        { e: '💊', l: 'Administer medication', s: 'Give the prepared dose', ev: EVENTS.medicationAdministered, done: fired(EVENTS.medicationAdministered), kind: 'admin' },
        { e: '🚫', l: 'Patient refuses', s: 'Log a refusal instead', ev: EVENTS.medicationRefused, done: fired(EVENTS.medicationRefused) },
        { e: '🩺', l: 'Reassess the patient', s: 'Response after the dose', ev: EVENTS.patientResponseAssessed, done: fired(EVENTS.patientResponseAssessed) }
      ];
    } else if (loc === 'med_room') {
      spots = [
        { e: '🧼', l: 'Hand hygiene', s: 'Before touching stock', ev: EVENTS.handHygienePerformed, done: fired(EVENTS.handHygienePerformed) },
        { e: '🗄️', l: 'Open the drawer', s: 'Select / remove the medication', panel: 'inventory' },
        { e: '💊', l: 'Open the MAR', s: 'Compare against the order', ev: EVENTS.marViewed, panel: 'mar' },
        { e: '📖', l: 'Open the drug guide', s: 'Class, indications, contraindications', ev: EVENTS.drugGuideOpened, panel: 'guide' },
        { e: '🛒', l: 'Begin retrieval', s: 'Marks the retrieval phase', ev: EVENTS.beganRetrieval, done: fired(EVENTS.beganRetrieval) }
      ];
    } else if (loc === 'prep_area') {
      spots = [
        { e: '🧼', l: 'Hand hygiene', s: 'Before preparation', ev: EVENTS.handHygienePerformed, done: fired(EVENTS.handHygienePerformed) },
        { e: '🧪', l: 'Start preparation', s: 'Opens the second check window', ev: EVENTS.medicationPreparationStarted, done: fired(EVENTS.medicationPreparationStarted) },
        { e: '🧮', l: 'Calculate the dose', s: 'Show your work out loud', ev: EVENTS.doseCalculated, done: fired(EVENTS.doseCalculated) },
        { e: '💊', l: 'Open the MAR', s: 'Second comparison', ev: EVENTS.marViewed, panel: 'mar' },
        { e: '📦', l: 'Medication prepared', s: 'Ready to take to the bedside', ev: EVENTS.medicationPrepared, done: fired(EVENTS.medicationPrepared) }
      ];
    } else {
      spots = [
        { e: '📋', l: 'Open the chart', s: 'Review before documenting', ev: EVENTS.chartViewed, panel: 'chart' },
        { e: '💊', l: 'Open the MAR', s: 'The record you sign', ev: EVENTS.marViewed, panel: 'mar' },
        { e: '🖊️', l: 'Document the administration', s: 'AFTER giving — never before', ev: EVENTS.medicationDocumented, done: fired(EVENTS.medicationDocumented) },
        { e: '🏁', l: 'End the simulation', s: 'Scores the attempt', kind: 'finish' }
      ];
    }

    return ce('div', { className: 'ms-scene' },
      ce('div', { className: 'ms-scene-hd' },
        ce('span', { className: 'ms-ico' }, LOCATION_ICON[loc]),
        ce('div', null,
          ce('h4', null, LOCATION_LABEL[loc]),
          ce('div', { className: 'ms-muted' }, 'Tap what you would actually do. Say it out loud too — the checks are graded on what you verbalize.'))),
      ce('div', { className: 'ms-hotgrid' },
        spots.map(function (sp, i) {
          return ce(Hotspot, {
            key: i, emoji: sp.e, label: sp.l,
            sub: (props.mode === 'test' ? null : sp.s),
            done: !!sp.done,
            onClick: function () {
              if (sp.kind === 'finish') { props.onFinish(); return; }
              if (sp.ev) { act(sp.ev, sp.kind === 'admin' ? { medId: eng.selectedMedId } : null); }
              if (sp.panel) { open(sp.panel); }
            }
          });
        }))
    );
  }

  /* ==========================================================================
   * 11. ATTEMPT VIEW
   * ======================================================================== */

  function AttemptView(props) {
    var scenario = props.scenario, mode = props.mode;
    var engRef = useRef(null);
    if (!engRef.current) { engRef.current = createEngine(scenario, mode); }
    var eng = engRef.current;

    var vs = useState(0), setVersion = vs[1];
    var bump = useCallback(function () { setVersion(function (n) { return n + 1; }); }, []);

    var ps = useState(null), panel = ps[0], setPanel = ps[1];
    var ts = useState(''), typed = ts[0], setTyped = ts[1];
    var bs = useState(false), busy = bs[0], setBusy = bs[1];
    var cs = useState(0), clockTick = cs[1];
    var gs = useState(false), grading = gs[0], setGrading = gs[1];

    // Sim clock ticks once a second; purely presentational.
    useEffect(function () {
      var h = window.setInterval(function () { clockTick(function (n) { return n + 1; }); }, 1000);
      return function () { window.clearInterval(h); };
    }, [clockTick]);

    var act = useCallback(function (type, meta) {
      eng.dispatch(type, meta);
      bump();
    }, [eng, bump]);

    var openPanel = useCallback(function (which) {
      // Opening a panel logs its own `_viewed` event (§12) and the panel stays
      // reachable for the rest of the attempt — never consumed.
      if (which === 'chart') { eng.dispatch(EVENTS.chartViewed); eng.dispatch(EVENTS.vitalsViewed); }
      else if (which === 'mar') { eng.dispatch(EVENTS.marViewed); eng.dispatch(EVENTS.marAllergiesViewed); }
      else if (which === 'guide') { eng.dispatch(EVENTS.drugGuideOpened); }
      setPanel(which);
      bump();
    }, [eng, bump]);

    var say = useCallback(function (text, confidence) {
      var t = str(text).trim();
      if (!t) { return; }
      setBusy(true);
      handleStudentUtterance(eng, t, null, confidence).then(
        function () { setBusy(false); bump(); },
        function () { setBusy(false); bump(); });
      bump();
    }, [eng, bump]);

    var mic = useMic(function (text, conf) { say(text, conf); });

    var finish = useCallback(function () {
      if (eng.isComplete) { return; }
      mic.stop();
      eng.dispatch(EVENTS.simulationCompleted);
      bump();
      setGrading(true);
      var events = eng.events.slice();
      var rubric = RUBRIC();
      // §7: grading is DEFERRED — the whole AI pass runs here, once, at the end.
      fetchAIVerdicts(events, scenario, rubric).then(function (verdicts) {
        var result = scoreAttempt(events, scenario, rubric, verdicts);
        setGrading(false);
        props.onComplete({
          scenarioId: scenario.id, scenarioTitle: scenario.title, mode: mode,
          startedAt: eng.startedAt,
          durationSec: Math.round(eng.elapsedMs() / 1000),
          events: events, conversation: eng.conversation.slice(),
          result: result
        });
      }, function () {
        var result = scoreAttempt(events, scenario, rubric, {});
        setGrading(false);
        props.onComplete({
          scenarioId: scenario.id, scenarioTitle: scenario.title, mode: mode,
          startedAt: eng.startedAt,
          durationSec: Math.round(eng.elapsedMs() / 1000),
          events: events, conversation: eng.conversation.slice(),
          result: result
        });
      });
    }, [eng, scenario, mode, mic, bump, props]);

    if (grading) {
      return ce('div', { className: 'ms-root' },
        ce('div', { className: 'ms-card', style: { textAlign: 'center', padding: 40 } },
          ce('div', { style: { fontSize: '2rem', marginBottom: 10 } }, '⏳'),
          ce('h3', null, 'Scoring your attempt'),
          ce('div', { className: 'ms-muted' },
            'Checking the event log against all 29 rubric items, then reviewing what you said out loud. ' +
            'Nothing was graded while you were working.')));
    }

    var simMin = eng.simClockAt(eng.elapsedMs());
    var hint = (mode === 'guided') ? GUIDED_HINTS[eng.phase] : null;
    var convo = eng.conversation;

    var panelBody = null;
    if (panel === 'chart') { panelBody = ce(ChartPanel, { scenario: scenario }); }
    else if (panel === 'mar') { panelBody = ce(MARPanel, { scenario: scenario }); }
    else if (panel === 'guide') { panelBody = ce(DrugGuidePanel, { scenario: scenario }); }
    else if (panel === 'inventory') {
      panelBody = ce(InventoryPanel, {
        scenario: scenario, engine: eng,
        onSelect: function (id) { eng.selectedMedId = id; eng.dispatch(EVENTS.medicationSelected, { medId: id }); bump(); },
        onRemove: function (id) { eng.selectedMedId = id; eng.dispatch(EVENTS.medicationRemoved, { medId: id }); bump(); }
      });
    }

    return ce('div', { className: 'ms-root' },

      /* ---- header ---- */
      ce('div', { className: 'ms-card' },
        ce('div', { className: 'ms-hd', style: { marginBottom: 6 } },
          ce('div', null,
            ce('h3', null, str(obj(scenario.patient).name) + ' · Room ' + str(obj(scenario.patient).room)),
            ce('div', { className: 'ms-muted' }, str(scenario.title))),
          ce('div', { style: { textAlign: 'right' } },
            ce('div', { style: { fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' } },
              simMin === null ? '--:--' : fmtClock(simMin)),
            ce('div', { className: 'ms-muted' }, 'elapsed ' + fmtMs(eng.elapsedMs())))),
        ce('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
          ce(Chip, { kind: 'acc' }, MODES.filter(function (m) { return m.id === mode; })[0].label + ' mode'),
          (mode !== 'test') ? ce(Chip, null, 'Phase: ' + PHASE_LABEL[eng.phase]) : null,
          ce(Chip, null, 'Location: ' + LOCATION_LABEL[eng.location]),
          eng.isPaused ? ce(Chip, { kind: 'warn' }, 'PAUSED') : null),
        hint ? ce('div', { className: 'ms-hint' }, '🧭 ' + hint) : null),

      /* ---- persistent panel controls (§12) ---- */
      ce('div', { className: 'ms-card', style: { padding: '10px 12px' } },
        ce('div', { className: 'ms-muted', style: { marginBottom: 6 } },
          'Always available — opening one logs that you looked at it:'),
        ce('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          ce('button', { className: 'ms-btn sm', onClick: function () { openPanel('chart'); } }, '📋 Chart'),
          ce('button', { className: 'ms-btn sm', onClick: function () { openPanel('mar'); } }, '💊 MAR'),
          ce('button', { className: 'ms-btn sm', onClick: function () { openPanel('guide'); } }, '📖 Drug Guide'),
          ce('button', { className: 'ms-btn sm', onClick: function () { setPanel('inventory'); bump(); } }, '🗄️ Drawer'))),

      /* ---- the schematic scene ---- */
      ce(LocationScene, {
        engine: eng, mode: mode, act: act, openPanel: openPanel, onFinish: finish
      }),

      /* ---- conversation log ---- */
      ce('div', { className: 'ms-card', style: { marginTop: 12 } },
        ce('div', { style: { fontWeight: 700, marginBottom: 4 } }, 'Conversation'),
        convo.length === 0
          ? ce('div', { className: 'ms-muted' },
              'Nothing said yet. Use the mic (or type) to talk to the patient — the three checks are graded on what you actually verbalize.')
          : ce('div', { className: 'ms-convo' }, convo.map(function (c, i) {
              return ce('div', { key: i, className: 'ms-line ' + c.speaker },
                ce('b', null, c.speaker === 'patient' ? 'Patient: ' : 'You: '), str(c.transcript));
            })),
        mic.interim ? ce('div', { className: 'ms-muted', style: { fontStyle: 'italic', marginTop: 6 } },
          '… ' + mic.interim) : null),

      /* ---- bottom action bar ---- */
      ce('div', { className: 'ms-bar' },
        ce('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
          ce('button', {
            className: 'ms-mic' + (mic.listening ? ' live' : ''),
            title: mic.supported ? (mic.listening ? 'Stop the mic' : 'Speak') : 'Speech recognition is not available in this browser',
            disabled: !mic.supported,
            onClick: mic.toggle
          }, mic.listening ? '⏹' : '🎙'),
          ce('input', {
            className: 'ms-input', value: typed, placeholder: 'Or type what you would say…',
            onChange: function (e) { setTyped(e.target.value); },
            onKeyDown: function (e) {
              if (e.key === 'Enter' && typed.trim()) { say(typed); setTyped(''); }
            }
          }),
          ce('button', {
            className: 'ms-btn on', disabled: !typed.trim() || busy,
            onClick: function () { say(typed); setTyped(''); }
          }, busy ? '…' : 'Say it')),
        !mic.supported ? ce('div', { className: 'ms-muted', style: { marginTop: 6, fontSize: '0.79rem' } },
          'This browser has no Web Speech API. Typing is graded identically — every utterance becomes the same phase-tagged speech event.') : null,
        ce('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 } },
          LOCATIONS.map(function (l) {
            return ce('button', {
              key: l, className: 'ms-btn sm' + (eng.location === l ? ' on' : ''),
              onClick: function () { eng.moveTo(l); bump(); }
            }, LOCATION_ICON[l] + ' ' + LOCATION_LABEL[l]);
          })),
        ce('div', { className: 'ms-btnrow' },
          ce('button', {
            className: 'ms-btn sm',
            onClick: function () { if (eng.isPaused) { eng.resume(); } else { eng.pause(); } bump(); }
          }, eng.isPaused ? '▶ Resume' : '⏸ Pause'),
          (mode === 'guided') ? ce('button', {
            className: 'ms-btn sm',
            onClick: function () { act(EVENTS.hintRequested); toast(GUIDED_HINTS[eng.phase] || 'You are at the end — finish up.', 'info'); }
          }, '💡 Hint') : null,
          ce('button', { className: 'ms-btn sm danger', onClick: finish }, '🏁 End & score'),
          ce('button', { className: 'ms-btn sm', onClick: props.onAbort }, 'Abandon'))),

      /* ---- overlay ---- */
      panel ? ce('div', {
        className: 'ms-overlay',
        onClick: function (e) { if (e.target === e.currentTarget) { setPanel(null); } }
      },
        ce('div', { className: 'ms-panel' },
          ce('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
            ce('button', { className: 'ms-btn sm', onClick: function () { setPanel(null); } }, 'Close ✕')),
          panelBody)) : null
    );
  }

  /* ==========================================================================
   * 12. REPORT VIEW (§11)
   * ======================================================================== */

  function ReportView(props) {
    var a = props.attempt, r = a.result;
    var xs = useState({}), expanded = xs[0], setExpanded = xs[1];
    function toggle(id) {
      var n = {}; for (var k in expanded) { if (Object.prototype.hasOwnProperty.call(expanded, k)) { n[k] = expanded[k]; } }
      n[id] = !n[id]; setExpanded(n);
    }
    var pass = r.result === 'PASS';
    var byId = {};
    r.perCriterion.forEach(function (c) { byId[c.id] = c; });

    return ce('div', { className: 'ms-root' },

      ce('div', { className: 'ms-banner ' + (pass ? 'pass' : 'fail') },
        ce('div', { className: 'verdict' }, pass ? 'PASS' : 'FAIL'),
        /* BOTH numbers, per the brief — a high percentage must never hide a fail. */
        ce('div', { className: 'score' }, r.rawScore + ' / ' + r.maxScore + '   ·   ' + r.percentage + '%'),
        ce('div', { className: 'ms-muted', style: { marginTop: 6 } },
          'Full rubric is ' + r.fullRubricMax + ' points across ' + r.perCriterion.length + ' items' +
          (r.notApplicableCount
            ? ('; ' + r.notApplicableCount + ' marked N/A for this scenario, so this attempt is scored out of ' + r.maxScore + '.')
            : '.')),
        ce('div', { className: 'ms-muted', style: { marginTop: 4 } },
          'PASS requires zero critical errors AND zero rubric items scored 0.'),
        ce('div', { className: 'ms-muted', style: { marginTop: 4 } },
          str(a.scenarioTitle) + ' · ' + titleCase(a.mode) + ' mode · ' + fmtMs(a.durationSec * 1000) + ' elapsed')),

      r.criticalErrors.length ? ce('div', { className: 'ms-crit' },
        ce('div', { style: { fontWeight: 800, color: 'var(--red,#ef4444)', fontSize: '1.05rem', marginBottom: 6 } },
          '⚠️ CRITICAL ERROR' + (r.criticalErrors.length > 1 ? 'S' : '') + ' — automatic fail regardless of score'),
        r.criticalErrors.map(function (c, i) {
          return ce('div', { key: i, style: { marginTop: 8 } },
            ce('div', { style: { fontWeight: 700 } }, '• ' + str(c.title)),
            ce('div', { className: 'ms-muted' }, str(c.explanation)),
            ce('div', { className: 'ms-muted' }, 'at ' + fmtMs(c.timestamp)));
        })) : ce('div', { className: 'ms-card', style: { borderColor: 'var(--green,#22c55e)' } },
          ce('div', { style: { color: 'var(--green,#22c55e)', fontWeight: 700 } }, '✓ No critical errors')),

      /* ---- full rubric breakdown ---- */
      RUBRIC_SECTIONS().map(function (sec) {
        var items = r.perCriterion.filter(function (c) { return c.section === sec.id; });
        if (!items.length) { return null; }
        var secRaw = 0, secMax = 0;
        items.forEach(function (c) { if (!c.notApplicable) { secRaw += c.score; secMax += c.maxScore; } });
        return ce('div', { key: sec.id, className: 'ms-card' },
          ce('div', { className: 'ms-hd', style: { marginBottom: 4 } },
            ce('h3', null, sec.label),
            ce(Chip, { kind: secMax && secRaw === secMax ? 'ok' : (secRaw ? 'warn' : 'bad') },
              secRaw + ' / ' + secMax)),
          items.map(function (c) {
            var cls = c.notApplicable ? 'na'
                    : c.status === 'PASS' ? 'pass' : c.status === 'PARTIAL' ? 'partial' : 'missed';
            var open = !!expanded[c.id];
            return ce('div', { key: c.id, className: 'ms-item ' + cls },
              ce('div', {
                style: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', cursor: 'pointer' },
                onClick: function () { toggle(c.id); }
              },
                ce('div', null,
                  ce('div', { style: { fontWeight: 650 } },
                    (c.critical ? '⚠️ ' : '') + str(c.title)),
                  ce('div', { className: 'ms-muted', style: { fontSize: '0.78rem' } },
                    (c.notApplicable ? 'Not applicable to this scenario'
                      : (c.status + (c.aiGraded ? ' · transcript-reviewed' : ' · event-log only'))) +
                    '  ' + (open ? '▾' : '▸'))),
                ce(Chip, {
                  kind: c.notApplicable ? '' : (c.status === 'PASS' ? 'ok' : c.status === 'PARTIAL' ? 'warn' : 'bad')
                }, c.notApplicable ? 'N/A' : (c.score + ' / ' + c.maxScore))),
              open ? ce('div', { style: { marginTop: 8 } },
                c.detail ? ce('div', { className: 'ms-muted', style: { marginBottom: 6 } }, str(c.detail)) : null,
                c.evidence.length ? ce('div', null,
                  ce('div', { style: { fontWeight: 650, fontSize: '0.83rem' } }, 'Evidence'),
                  c.evidence.map(function (e, i) {
                    return ce('div', { key: i, className: 'ms-ev' },
                      '[' + fmtMs(e.t) + '] ' + (e.kind === 'speech' ? '🗣 ' : '● ') + str(e.label));
                  })) : ce('div', { className: 'ms-muted', style: { fontSize: '0.82rem' } }, 'No evidence recorded.'),
                c.missing.length ? ce('div', { style: { marginTop: 6 } },
                  ce('div', { style: { fontWeight: 650, fontSize: '0.83rem', color: 'var(--orange,#f59e0b)' } }, 'Missing'),
                  c.missing.map(function (m, i) {
                    return ce('div', { key: i, className: 'ms-ev' }, str(m));
                  })) : null,
                c.correction ? ce('div', { className: 'ms-hint', style: { marginTop: 8 } },
                  '→ ' + str(c.correction)) : null,
                (typeof c.aiConfidence === 'number') ? ce('div', { className: 'ms-muted', style: { fontSize: '0.76rem', marginTop: 6 } },
                  'Transcript-review confidence: ' + Math.round(c.aiConfidence * 100) + '%') : null
              ) : null);
          }));
      }),

      /* ---- timeline ---- */
      ce('div', { className: 'ms-card' },
        ce('h3', { style: { marginTop: 0 } }, 'Timeline'),
        ce('div', { className: 'ms-tl' },
          r.timeline.map(function (t, i) {
            return ce('div', { key: i, className: 'ms-tl-row' },
              ce('span', { className: 't' }, fmtMs(t.t)),
              ce('span', null, str(t.label)));
          }))),

      ce('div', { className: 'ms-btnrow', style: { marginBottom: 30 } },
        ce('button', { className: 'ms-btn on', onClick: props.onReplay }, '▶ Replay my attempt'),
        ce('button', { className: 'ms-btn', onClick: props.onAgain }, '↻ Run it again'),
        ce('button', { className: 'ms-btn', onClick: props.onHub }, 'Back to scenarios'))
    );
  }

  /* ==========================================================================
   * 13. REPLAY VIEW (§12)
   * ======================================================================== */

  function ReplayView(props) {
    var a = props.attempt, r = a.result;
    var tl = r.timeline;
    var is = useState(tl.length ? tl.length - 1 : 0), idx = is[0], setIdx = is[1];
    var cur = tl[idx] || { t: 0, label: '' };

    /* Which criteria cite evidence at or before the scrub head. */
    var touched = useMemo(function () {
      return r.perCriterion.filter(function (c) {
        if (c.notApplicable || !c.evidence.length) { return false; }
        for (var i = 0; i < c.evidence.length; i++) {
          if (c.evidence[i].t <= cur.t) { return true; }
        }
        return false;
      });
    }, [r, cur.t]);

    return ce('div', { className: 'ms-root' },
      ce('div', { className: 'ms-card' },
        ce('div', { className: 'ms-hd' },
          ce('div', null,
            ce('h3', null, 'Replay — ' + str(a.scenarioTitle)),
            ce('div', { className: 'ms-muted' }, 'Scrub the timeline. Rubric evidence lights up as it happened.')),
          ce('button', { className: 'ms-btn', onClick: props.onBack }, 'Back to report')),
        ce('input', {
          type: 'range', min: 0, max: Math.max(0, tl.length - 1), value: idx,
          style: { width: '100%', marginTop: 10 },
          onChange: function (e) { setIdx(parseInt(e.target.value, 10) || 0); }
        }),
        ce('div', { style: { display: 'flex', justifyContent: 'space-between' } },
          ce('span', { className: 'ms-muted' }, fmtMs(cur.t)),
          ce('span', { className: 'ms-muted' }, (idx + 1) + ' / ' + tl.length)),
        ce('div', { className: 'ms-btnrow' },
          ce('button', { className: 'ms-btn sm', onClick: function () { setIdx(Math.max(0, idx - 1)); } }, '◀ Step back'),
          ce('button', { className: 'ms-btn sm', onClick: function () { setIdx(Math.min(tl.length - 1, idx + 1)); } }, 'Step forward ▶'))),

      ce('div', { className: 'ms-grid2' },
        ce('div', { className: 'ms-card' },
          ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, 'Timeline'),
          ce('div', { className: 'ms-tl' },
            tl.map(function (t, i) {
              return ce('div', {
                key: i, className: 'ms-tl-row' + (i === idx ? ' cur' : ''),
                style: { opacity: i <= idx ? 1 : 0.35, cursor: 'pointer' },
                onClick: function () { setIdx(i); }
              },
                ce('span', { className: 't' }, fmtMs(t.t)),
                ce('span', null, str(t.label)));
            }))),
        ce('div', { className: 'ms-card' },
          ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, 'Rubric evidence so far'),
          touched.length === 0
            ? ce('div', { className: 'ms-muted' }, 'No rubric evidence recorded up to this point yet.')
            : touched.map(function (c) {
                return ce('div', { key: c.id, className: 'ms-item ' + (c.status === 'PASS' ? 'pass' : c.status === 'PARTIAL' ? 'partial' : 'missed') },
                  ce('div', { style: { fontWeight: 650, fontSize: '0.87rem' } },
                    (c.critical ? '⚠️ ' : '') + str(c.title)),
                  c.evidence.filter(function (e) { return e.t <= cur.t; }).map(function (e, i) {
                    return ce('div', { key: i, className: 'ms-ev' },
                      '[' + fmtMs(e.t) + '] ' + str(e.label));
                  }));
              }))));
  }

  /* ==========================================================================
   * 14. HUB + HISTORY + PERSISTENCE
   * ======================================================================== */

  function useAttemptHistory(authUser) {
    var s = useState([]), list = s[0], setList = s[1];
    useEffect(function () {
      var db = getDb();
      if (!db || !authUser || !authUser.uid) { setList([]); return; }
      var ref;
      try { ref = db.ref('medSimAttempts/' + authUser.uid); } catch (e) { return; }
      function onVal(snap) {
        var v = (snap && snap.val && snap.val()) || {};
        var out = [];
        for (var k in v) {
          if (Object.prototype.hasOwnProperty.call(v, k)) {
            var rec = obj(v[k]); rec._id = k; out.push(rec);
          }
        }
        out.sort(function (a, b) { return numOr(b.startedAt, 0) - numOr(a.startedAt, 0); });
        setList(out.slice(0, 40));
      }
      try { ref.on('value', onVal); } catch (e2) { return; }
      return function () { try { ref.off('value', onVal); } catch (e3) { /* noop */ } };
    }, [authUser]);
    return list;
  }

  /** Firebase write, medSimAttempts/<uid>/<pushId> — push().key then set(),
      the same pattern signoff.js / the other modules use. */
  function persistAttempt(authUser, attempt) {
    var db = getDb();
    if (!db || !authUser || !authUser.uid) {
      toast('Attempt kept locally — sign in to save your MedSim history.', 'info');
      return;
    }
    var r = attempt.result;
    try {
      var ref = db.ref('medSimAttempts/' + authUser.uid);
      var key = ref.push().key;
      var record = {
        attemptId: key,
        scenarioId: str(attempt.scenarioId),
        scenarioTitle: str(attempt.scenarioTitle),
        mode: str(attempt.mode),
        startedAt: numOr(attempt.startedAt, Date.now()),
        durationSec: numOr(attempt.durationSec, 0),
        result: str(r.result),
        rawScore: numOr(r.rawScore, 0),
        maxScore: numOr(r.maxScore, 0),
        fullRubricMax: numOr(r.fullRubricMax, 58),
        percentage: numOr(r.percentage, 0),
        criticalErrors: r.criticalErrors.map(function (c) {
          return { criterionId: str(c.criterionId), title: str(c.title),
                   timestamp: numOr(c.timestamp, 0), explanation: str(c.explanation) };
        }),
        perCriterion: r.perCriterion.map(function (c) {
          return {
            id: str(c.id), title: str(c.title), section: str(c.section),
            score: numOr(c.score, 0), maxScore: numOr(c.maxScore, 2),
            critical: !!c.critical, notApplicable: !!c.notApplicable,
            status: str(c.status),
            evidence: arr(c.evidence).map(function (e) {
              return { t: numOr(e.t, 0), kind: str(e.kind), label: str(e.label) };
            }),
            missing: arr(c.missing).map(str),
            correction: c.correction ? str(c.correction) : null,
            aiConfidence: (typeof c.aiConfidence === 'number') ? c.aiConfidence : null
          };
        }),
        timeline: r.timeline.map(function (t) {
          return { t: numOr(t.t, 0), label: str(t.label) };
        }),
        transcriptReplay: arr(attempt.conversation).map(function (c) {
          return { t: numOr(c.t, 0), speaker: str(c.speaker), phase: str(c.phase), transcript: str(c.transcript) };
        })
      };
      ref.child(key).set(record).then(function () {
        toast('Attempt saved to your MedSim history.', 'success');
      }, function () { toast('Could not save the attempt to the cloud.', 'error'); });
    } catch (e) {
      toast('Could not save the attempt.', 'error');
    }
  }

  function rollup(list) {
    var out = { attemptCount: list.length, passCount: 0, avgPercentage: 0,
                mostMissed: [], criticalCounts: {} };
    if (!list.length) { return out; }
    var sum = 0, missCount = {}, titles = {};
    list.forEach(function (a) {
      sum += numOr(a.percentage, 0);
      if (str(a.result) === 'PASS') { out.passCount++; }
      arr(a.perCriterion).forEach(function (c) {
        if (c.notApplicable || numOr(c.score, 0) >= numOr(c.maxScore, 2)) { return; }
        missCount[c.id] = (missCount[c.id] || 0) + 1;
        titles[c.id] = str(c.title);
      });
      arr(a.criticalErrors).forEach(function (c) {
        out.criticalCounts[c.criterionId] = (out.criticalCounts[c.criterionId] || 0) + 1;
      });
    });
    out.avgPercentage = Math.round(sum / list.length);
    var keys = [];
    for (var k in missCount) { if (Object.prototype.hasOwnProperty.call(missCount, k)) { keys.push(k); } }
    keys.sort(function (a, b) { return missCount[b] - missCount[a]; });
    out.mostMissed = keys.slice(0, 5).map(function (k) {
      return { id: k, title: titles[k] || k, count: missCount[k] };
    });
    return out;
  }

  function Hub(props) {
    var scenarios = SCENARIOS();
    var rubric = RUBRIC();
    var ms = useState('guided'), mode = ms[0], setMode = ms[1];
    var history = props.history;
    var roll = useMemo(function () { return rollup(history); }, [history]);
    var criticalCount = rubric.filter(function (c) { return c.critical; }).length;

    return ce('div', { className: 'ms-root' },
      ce('div', {
        className: 'ms-card',
        style: {
          background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.16), rgba(139,92,246,0.16))',
          borderColor: 'var(--accent,#3b82f6)'
        }
      },
        ce('h2', { style: { margin: '0 0 6px' } }, '🎯 Med Admin Simulation'),
        ce('div', { className: 'ms-muted' },
          'A free-form simulation, not a checklist. Move around, look at what you need, talk to the patient, ' +
          'and give the medication however you think it should be given. Nothing is graded while you work — ' +
          'the full rubric is applied once, at the end.'),
        ce('div', { style: { marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' } },
          ce(Chip, { kind: 'acc' }, rubric.length + ' rubric items'),
          ce(Chip, { kind: 'bad' }, criticalCount + ' can be a critical error'),
          ce(Chip, null, 'PASS = no item at 0 and no critical errors'))),

      !rubric.length ? ce('div', { className: 'ms-note' },
        'The rubric file did not load (data/medsim-rubric.js). Reload the page — scoring is unavailable until it does.') : null,
      !scenarios.length ? ce('div', { className: 'ms-note' },
        'No scenarios loaded (data/medsim-scenarios.js). Reload the page.') : null,

      /* ---- mode picker ---- */
      ce('div', { className: 'ms-card' },
        ce('h3', { style: { marginTop: 0 } }, 'Pick a mode'),
        ce('div', { className: 'ms-grid2' },
          MODES.map(function (m) {
            return ce('button', {
              key: m.id,
              className: 'ms-btn' + (mode === m.id ? ' on' : ''),
              style: { textAlign: 'left', padding: '11px 13px' },
              onClick: function () { setMode(m.id); }
            },
              ce('div', { style: { fontSize: '1rem' } }, m.icon + ' ' + m.label),
              ce('div', { style: { fontWeight: 400, fontSize: '0.79rem', opacity: 0.85, marginTop: 3 } }, m.blurb));
          }))),

      /* ---- scenario picker ---- */
      scenarios.map(function (s) {
        var p = obj(s.patient);
        var order = arr(s.orders)[0] || {};
        return ce('div', { key: s.id, className: 'ms-card' },
          ce('div', { className: 'ms-hd' },
            ce('div', null,
              ce('h3', null, str(s.title)),
              ce('div', { className: 'ms-muted' },
                str(p.name) + ' · ' + str(p.age) + ' ' + str(p.sex) + ' · ' + str(p.admittingDx) +
                ' · MRN ' + str(p.mrn)),
              ce('div', { className: 'ms-muted', style: { marginTop: 4 } },
                'Allergies: ' + (arr(p.allergies).join(', ') || 'None') + ' · Sim clock starts ' + str(s.currentSimTime))),
            ce('div', { style: { textAlign: 'right' } },
              ce(Chip, { kind: 'acc' }, titleCase(s.difficulty)),
              ce('div', { style: { marginTop: 4 } }, ce(Chip, null, str(order.route) + ' only')))),
          ce('div', { className: 'ms-muted', style: { marginTop: 2 } },
            ce('strong', null, 'Order: '), str(order.orderText) + ' — due ' + str(order.scheduledTime)),
          s.dataSource === 'fallback' ? ce('div', { className: 'ms-note' },
            'Patient data is running from the built-in fallback copy — data/signoff-mars.js and ' +
            'data/signoff-drugs.js did not load before this file. The values are identical, but check the script order.') : null,
          ce('div', { className: 'ms-btnrow' },
            ce('button', {
              className: 'ms-btn on',
              disabled: !rubric.length,
              onClick: function () { props.onStart(s, mode); }
            }, 'Start ' + MODES.filter(function (m) { return m.id === mode; })[0].label + ' attempt')));
      }),

      /* ---- history ---- */
      ce('div', { className: 'ms-card' },
        ce('h3', { style: { marginTop: 0 } }, 'Your attempts'),
        !props.authUser
          ? ce('div', { className: 'ms-muted' }, 'Sign in to save attempts and see your trend.')
          : (history.length === 0
              ? ce('div', { className: 'ms-muted' }, 'No attempts yet. Run one above.')
              : ce('div', null,
                  ce('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 } },
                    ce(Chip, null, roll.attemptCount + ' attempts'),
                    ce(Chip, { kind: 'ok' }, roll.passCount + ' passed'),
                    ce(Chip, { kind: 'acc' }, 'avg ' + roll.avgPercentage + '%')),
                  roll.mostMissed.length ? ce('div', { className: 'ms-note' },
                    ce('strong', null, 'Most missed: '),
                    roll.mostMissed.map(function (m) { return m.title + ' (' + m.count + ')'; }).join(' · ')) : null,
                  history.slice(0, 10).map(function (a) {
                    return ce('div', {
                      key: a._id, className: 'ms-item ' + (a.result === 'PASS' ? 'pass' : 'missed')
                    },
                      ce('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } },
                        ce('div', null,
                          ce('div', { style: { fontWeight: 650 } }, str(a.scenarioTitle || a.scenarioId)),
                          ce('div', { className: 'ms-muted' },
                            new Date(numOr(a.startedAt, 0)).toLocaleString() + ' · ' + titleCase(str(a.mode)) + ' mode')),
                        ce('div', { style: { textAlign: 'right' } },
                          ce(Chip, { kind: a.result === 'PASS' ? 'ok' : 'bad' }, str(a.result)),
                          ce('div', { className: 'ms-muted' },
                            numOr(a.rawScore, 0) + '/' + numOr(a.maxScore, 0) + ' · ' + numOr(a.percentage, 0) + '%'))),
                      arr(a.criticalErrors).length ? ce('div', {
                        className: 'ms-muted', style: { color: 'var(--red,#ef4444)', marginTop: 4, fontSize: '0.8rem' }
                      }, 'Critical: ' + arr(a.criticalErrors).map(function (c) { return str(c.title); }).join('; ')) : null);
                  }))))
    );
  }

  /* ==========================================================================
   * 15. TOP-LEVEL PAGE  ->  window.MedSimTrainer
   * ======================================================================== */

  function MedSimTrainer(props) {
    useEffect(injectStyles, []);
    var p = obj(props);
    var authUser = p.authUser || (window.MM && window.MM.authUser) || null;

    var vs = useState('hub'), view = vs[0], setView = vs[1];
    var rs = useState(null), run = rs[0], setRun = rs[1];       // {scenario, mode, nonce}
    var as = useState(null), attempt = as[0], setAttempt = as[1];
    var history = useAttemptHistory(authUser);

    function start(scenario, mode) {
      setRun({ scenario: scenario, mode: mode, nonce: Date.now() });
      setAttempt(null);
      setView('attempt');
    }

    function complete(a) {
      setAttempt(a);
      setView('report');
      persistAttempt(authUser, a);
      // Best-effort local progress ping, same shape other modules use.
      try {
        if (isFn(p.setProgress)) {
          p.setProgress(function (prev) {
            var next = obj(prev);
            var copy = {}; for (var k in next) { if (Object.prototype.hasOwnProperty.call(next, k)) { copy[k] = next[k]; } }
            copy.medSimAttempts = numOr(copy.medSimAttempts, 0) + 1;
            copy.medSimLastResult = a.result.result;
            return copy;
          });
        }
      } catch (e) { /* noop */ }
    }

    if (view === 'attempt' && run) {
      return ce(AttemptView, {
        key: run.scenario.id + '-' + run.mode + '-' + run.nonce,
        scenario: run.scenario, mode: run.mode,
        onComplete: complete,
        onAbort: function () { setRun(null); setView('hub'); }
      });
    }
    if (view === 'report' && attempt) {
      return ce(ReportView, {
        attempt: attempt,
        onReplay: function () { setView('replay'); },
        onAgain: function () { start(run.scenario, run.mode); },
        onHub: function () { setView('hub'); }
      });
    }
    if (view === 'replay' && attempt) {
      return ce(ReplayView, { attempt: attempt, onBack: function () { setView('report'); } });
    }
    return ce(Hub, { authUser: authUser, history: history, onStart: start });
  }

  /* Exported for the tests directory / console inspection, alongside the page.
     Keeping the pure scorer reachable is what makes the conflict rule testable
     without driving the UI. */
  MedSimTrainer.engine = {
    createEngine: createEngine,
    scoreAttempt: scoreAttempt,
    evaluateDeterministic: evaluateDeterministic,
    isNotApplicable: isNotApplicable,
    buildClassifierSystem: buildClassifierSystem,
    buildPatientReplySystem: buildPatientReplySystem,
    EVENTS: EVENTS,
    PHASES: PHASES
  };

  window.MedSimTrainer = MedSimTrainer;
})();
