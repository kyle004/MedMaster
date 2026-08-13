/* ============================================================================
   simprep-sim.test.js
   ----------------------------------------------------------------------------
   Guards js/simprep-sim.js - Clinical Simulation Prep (Simulation Mode and the
   Room / Checkoff Coach).

   What this suite is actually protecting, in priority order:

   1. THE LLM CANNOT INVENT A CLINICAL FACT. This is the single most important
      property in the module: a nursing student must never be taught a
      fabricated provider order. The suite attacks it adversarially - model
      output that invents an order, a dose, a lab value and a vital sign - and
      asserts each one is rejected, never reaches patient state, and never
      reaches the transcript. It also attacks the OBJECT shape (a reply
      carrying an `orders` array) and the reveal state (a reply that leaks a
      finding the learner has not earned).

   2. HIDDEN INFORMATION STAYS HIDDEN ON EVERY SURFACE. Lung sounds need
      auscultation, pupils need a neuro check, labs need the lab panel - and
      the debrief must not spill them before the run ends either.

   3. NATURAL LANGUAGE, NOT EXACT PHRASING. Three or more equivalent wordings
      per intent must land on the same id, and anything under the confidence
      threshold must ask rather than guess.

   4. DETERIORATION IS SCRIPTED, NOT IMPROVISED. Time, missed criticals and
      unsafe actions - those three, and nothing else.

   5. THE RUBRIC IS OBEYED. An unresolved source discrepancy is not scored at
      all, and there is no automatic course failure unless configured.

   6. THE CLOCK CANNOT LIE. Pause freezes it; resume does not fast-forward.

   7. IT DEGRADES. Missing data global, missing AI, missing partner layer,
      missing voice - none of them may be a white screen.

   Run:  node tests/run.js simprep
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./_harness.js');
var React = require('react');

/* Only real shipped modules. The working folder accumulates orphaned
   `.fuse_hidden*` copies that readdir returns FIRST (dotfiles sort early);
   reading one means linting a ghost copy of a module instead of the real one.
   Same filter as ui-contrast.test.js, sim-guided.test.js and ms2lab.test.js. */
function jsFiles() {
  return fs.readdirSync(path.join(H.APP_ROOT, 'js'))
    .filter(function (f) { return /\.js$/.test(f) && f.charAt(0) !== '.'; })
    .map(function (f) { return 'js/' + f; });
}
function read(rel) { return fs.readFileSync(path.join(H.APP_ROOT, rel), 'utf8'); }

/** Strip comments, string literals and regex literals before scanning source
    for ES5 violations - otherwise a markdown fence in a regex reads as a
    template literal and every comment full of prose reads as spread syntax. */
function stripCode(src) {
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/\/(?:[^/\\\n[]|\\.|\[[^\]\n]*\])+\/[gimsuy]*/g, '/RE/');
}

function actIn(fn) {
  var ow = console.warn, oe = console.error;
  console.warn = function () {}; console.error = function () {};
  try { React.act(fn); } finally { console.warn = ow; console.error = oe; }
}

function lower(v) { return String(v == null ? '' : v).toLowerCase(); }

/* ==========================================================================
 * FIXTURE
 * --------------------------------------------------------------------------
 * Shaped exactly like data/nur2212-scenarios.js (written in parallel), and
 * modelled on the real school GI-bleed sheet so the assertions mean something
 * against the content that will actually ship. Deliberately contains:
 *   - findings the handoff does NOT mention (lungs, pupils, pain) so the
 *     hidden-information rule has something to hide;
 *   - a medication order (pantoprazole 80 mg) so a fabricated 40 mg dose is
 *     catchable;
 *   - an unresolved source discrepancy naming that same order;
 *   - a PRBC critical action, which is the case that used to be misread as an
 *     unordered medication.
 * ========================================================================== */
function fixture() {
  return {
    schema_version: '1.0',
    topic_id: 'upper_gi_bleed',
    title: 'Upper GI Bleed With Progression Toward Hypovolemic Shock',
    provenance: 'school_file',
    source_file: 'MS 2 Sim Lab GI Bleed Student.docx',
    duration_minutes: 20,
    education_only: true,
    case_intro: 'At 1100 you assume care of John Smith, age 72, with peptic ulcer disease and ' +
      'chronic NSAID use. He is now pale, weak, diaphoretic, and has bright-red hematemesis.',
    initial_findings: [
      'Bright-red hematemesis',
      'Pale and diaphoretic',
      'Crackles in the bilateral lung bases',
      'Pupils equal but sluggish to light',
      'Epigastric pain rated 8 out of 10, burning and constant',
      'Urine output 15 mL over the last hour'
    ],
    vital_trends: [
      { time: '0600', bp: '118/76', hr: '88', rr: '18', spo2: '98%', temp: '99.4 F' },
      { time: '1000', bp: '108/68', hr: '104', rr: '22', spo2: '94%', temp: '98.4 F' }
    ],
    labs: [
      { test: 'Hgb', result: '6.8 g/dL', interpretation: 'Severely low on school sheet' },
      { test: 'Hct', result: '21%', interpretation: 'Low' },
      { test: 'BUN', result: '34', interpretation: 'High' }
    ],
    diagnostics: ['Type and crossmatch: O positive; PRBCs available.'],
    orders: [
      'Continuous pulse oximetry',
      'Vital signs every 15 minutes',
      'Maintain SpO2 >95%',
      'NPO',
      'Normal saline 1000 mL IV bolus',
      'Transfuse PRBCs',
      'Notify provider for hypotension, tachycardia, or worsening bleeding',
      'Pantoprazole 80 mg IV bolus followed by continuous infusion as written on school sheet',
      'Ondansetron 4 mg IV every 6 hours PRN nausea'
    ],
    mar: [
      '1000 - 0.9% sodium chloride 1 L bolus',
      '1015 - pantoprazole 80 mg IV',
      '1030 - PRBC transfusion initiated'
    ],
    allowed_action_intents: [
      { id: 'hand_hygiene', label: 'Perform hand hygiene / standard precautions', category: 'safety' },
      { id: 'verify_identity', label: 'Use two patient identifiers', category: 'safety' },
      { id: 'abc_assessment', label: 'Perform immediate ABC assessment', category: 'assessment' },
      { id: 'focused_assessment', label: 'Perform condition-specific focused assessment', category: 'assessment' },
      { id: 'review_trends', label: 'Compare current data with prior trends', category: 'clinical_reasoning' },
      { id: 'implement_orders', label: 'Implement/verify active provider orders', category: 'intervention' },
      { id: 'give_pantoprazole', label: 'Administer pantoprazole IV bolus per the order', category: 'intervention' },
      { id: 'reassess', label: 'Reassess response after interventions', category: 'reassessment' },
      { id: 'sbar', label: 'Communicate deterioration using SBAR', category: 'communication' },
      { id: 'document', label: 'Document assessment, interventions, and response', category: 'documentation' },
      { id: 'protect_airway_during_emesis', label: 'Protect Airway During Emesis', category: 'topic_specific' },
      { id: 'monitor_prbc_transfusion', label: 'Monitor Prbc Transfusion', category: 'topic_specific' }
    ],
    critical_actions: ['abc_assessment', 'protect_airway_during_emesis',
      'monitor_prbc_transfusion', 'sbar'],
    deterioration_triggers: [
      { trigger: 'two_critical_actions_missed_or_excessive_delay', effect: 'advance_to_deteriorating_state' },
      { trigger: 'unsafe_action', effect: 'apply_safety_penalty_and_patient_may_worsen' },
      { trigger: 'appropriate_escalation_after_deterioration', effect: 'stabilize_or_end_for_handoff' }
    ],
    deterioration_cues: [
      'Increasing hematemesis',
      'Falling BP/MAP',
      'Urine output dropping'
    ],
    scoring: {
      safety: 30, assessment_recognition: 25, prioritization_interventions: 25,
      communication: 10, reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: 72-year-old with acute upper GI bleed and active bright-red hematemesis.',
      'B: PUD and chronic NSAID use; Hgb 6.8, Hct 21; PRBC transfusion started at 1030.',
      'A: Pale, diaphoretic, tachycardic with falling BP; concern for hypovolemic shock.',
      'R: Request immediate review and continuation of ordered resuscitation.'
    ],
    source_discrepancies: [
      'The pantoprazole order repeats the phrase "80 mg IV bolus" before the infusion; ' +
        'verify the intended wording with the instructor.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.'
    ],
    debrief_points: ['Recognize an acute upper GI hemorrhage and escalate deterioration quickly.'],
    lesson: { overview: 'Upper GI bleed: protect the airway, replace volume, escalate early.' }
  };
}

function supplementalFixture() {
  return {
    topic_id: 'pneumonia',
    title: 'Community-Acquired Pneumonia',
    provenance: 'generated_supplemental_practice',
    source_file: '',
    duration_minutes: 20,
    education_only: true,
    case_intro: 'A 68-year-old with a productive cough and fever.',
    initial_findings: ['Productive cough'],
    vital_trends: [{ time: '0800', bp: '124/78', hr: '96', rr: '24', spo2: '91%', temp: '101.8 F' }],
    labs: [{ test: 'WBC', result: '16.2', interpretation: 'High' }],
    diagnostics: [],
    orders: ['Incentive spirometry every hour while awake'],
    mar: [],
    allowed_action_intents: [
      { id: 'abc_assessment', label: 'Perform immediate ABC assessment', category: 'assessment' },
      { id: 'sbar', label: 'Communicate using SBAR', category: 'communication' }
    ],
    critical_actions: ['abc_assessment', 'sbar'],
    deterioration_triggers: [],
    deterioration_cues: [],
    scoring: {},
    sbar_expected: [],
    source_discrepancies: [],
    exam_mode_rules: [],
    debrief_points: [],
    lesson: {}
  };
}

/** A world with the data global seeded BEFORE the module is evaluated. */
function makeSimWorld(opts) {
  var o = opts || {};
  var world = H.makeWorld({ tier: o.tier || 'pro', fetchImpl: o.fetchImpl });
  if (!o.noData) {
    world.window.NUR2212_SCENARIOS = o.scenarios || [fixture(), supplementalFixture()];
  }
  if (o.study) { world.window.SimPrepStudy = o.study; }
  if (o.partner) { world.window.MM.simprepPartner = o.partner; }
  if (o.ai) { world.window.MM.ai = o.ai; }
  world.load('js/simprep-sim.js');
  return world;
}

/* Deterministic timestamps: every run in this suite is folded from a
   synthetic clock, which is the only way to assert on time without sleeping. */
var T0 = 1700000000000;
function at(sec) { return T0 + sec * 1000; }

/**
 * world.cleanup() DELETES global.window. Every module in this app is loaded
 * with w.eval() into a jsdom window built without runScripts, so a bare
 * `window` inside a module resolves DYNAMICALLY to global.window at call time
 * (see the long note in tests/run.js). Tearing down a scratch world therefore
 * leaves the MAIN world's exported functions pointing at nothing, and the next
 * call throws "window is not defined" from somewhere unrelated. Re-point the
 * globals at the main world immediately after every scratch teardown.
 */
function dropWorld(scratch, main) {
  try { scratch.cleanup(); } catch (e) {}
  global.window = main.window;
  global.document = main.window.document;
  global.self = main.window;
  try { global.localStorage = main.window.localStorage; } catch (e) {}
}

module.exports = {
  name: 'simprep-sim — Clinical Simulation Prep (Simulation + Coach modes)',

  run: function (t) {

    /* ================================================================== */
    t.group('the module loads and exports both surfaces');

    var world = makeSimWorld();
    var W = world.window;
    var M = W.SimPrepSimMode;
    var C = W.SimPrepCoachMode;

    t.eq(typeof M, 'function', 'window.SimPrepSimMode is a React component');
    t.eq(typeof C, 'function', 'window.SimPrepCoachMode is a React component');
    t.ok(M.contentOk(), 'contentOk() is true with the data global present');
    t.eq(M.allScenarios().length, 2, 'both fixture scenarios loaded');
    t.eq(typeof C.applyEvent, 'function',
      'the coach surface shares the engine rather than owning a second one');
    t.ok(C.applyEvent === M.applyEvent, 'literally the same engine function, not a copy');

    var sc = M.scenarioById('upper_gi_bleed');
    var supp = M.scenarioById('pneumonia');
    t.ok(!!sc, 'scenarioById finds the school scenario');
    t.eq(M.provenanceLabel(sc), 'School source', 'school_file renders as "School source"');
    t.eq(M.provenanceLabel(supp), 'Supplemental',
      'a generated supplemental topic is labelled Supplemental, per SOURCE_RULES rule 7');

    /* ================================================================== */
    t.group('ES5 only, no build step');

    var src = stripCode(read('js/simprep-sim.js'));
    [['arrow function', /=>/],
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
    ].forEach(function (c) {
      t.ok(!c[1].test(src), 'no ' + c[0] + ' in js/simprep-sim.js');
    });
    t.ok(jsFiles().indexOf('js/simprep-sim.js') !== -1,
      'js/simprep-sim.js is a real shipped module (and the .fuse_hidden ghosts are filtered out)');

    var rawSrc = read('js/simprep-sim.js');
    var blackText = [];
    var bre = /color\s*:\s*(#0{3,6}\b|#1[0-9a-f]{2}\b|black|buttontext)/gi, bm;
    while ((bm = bre.exec(rawSrc))) {
      var around = rawSrc.slice(Math.max(0, bm.index - 60), bm.index);
      if (/text-on-fill/.test(around)) { continue; }
      blackText.push(bm[0]);
    }
    t.eq(blackText.length, 0, 'no rule hardcodes near-black text (dark theme)');
    t.match(rawSrc, /simprep-sim-styles/, 'the stylesheet is injected once, under its own id');
    t.ok(rawSrc.indexOf('.spx-') !== -1, 'every CSS class carries the spx- prefix');

    /* ================================================================== */
    t.group('the module registers a pause control in the shared MMPause registry');

    t.ok(W.MMPause && typeof W.MMPause.pauseAll === 'function', 'window.MMPause exists');
    var ctl = W.MMPause.get('simprep-sim');
    t.ok(!!ctl, 'a control is registered under the id "simprep-sim"');
    ['isActive', 'isPaused', 'canPause', 'pause', 'resume', 'toggle', 'stats', 'subscribe']
      .forEach(function (k) {
        t.eq(typeof (ctl || {})[k], 'function', 'pauseControl.' + k + '() matches the shared shape');
      });
    t.noThrow(function () { W.MMPause.pauseAll('test'); W.MMPause.resumeAll(); },
      'pauseAll/resumeAll are harmless with nothing mounted');
    t.match(rawSrc, /reg\.register\(/, 'uses reg.register() rather than writing controls directly');
    t.match(rawSrc, /reg\.pauseAll\s*=/, 'defines pauseAll() if it is the first module to load');

    /* ==================================================================== *
     * 1. NO HALLUCINATION - the adversarial half of this suite
     * ==================================================================== */
    t.group('LAYER 1: a model reply cannot carry a clinical field at all');

    var run0 = M.initialRun(sc, { startedAt: T0, mode: 'practice' });

    var evil = {
      intent: 'implement_orders',
      confidence: 0.99,
      say: 'Starting the drip now.',
      /* everything below is a fabrication attempt */
      orders: ['Furosemide 40 mg IV push now', 'Insert an arterial line'],
      medication: { name: 'furosemide', dose: '40 mg', route: 'IV push' },
      dose: '40 mg',
      labs: [{ test: 'Hgb', result: '4.1' }],
      vitals: { bp: '62/38', hr: 148, spo2: 82 },
      allergies: ['penicillin'],
      code_status: 'DNR',
      fio2: 0.6,
      diagnosis: 'septic shock',
      score: 100,
      state: 'stabilized_or_transferred'
    };
    var v = M.validateAIReply(evil, sc, run0);

    t.eq(v.intent, 'implement_orders', 'the one allowed field survives');
    t.ok(v.rejectedKeys.length >= 10,
      'every clinical key was rejected outright (' + v.rejectedKeys.length + ' of them)');
    ['orders', 'medication', 'dose', 'labs', 'vitals', 'allergies', 'code_status', 'fio2',
     'diagnosis', 'score', 'state'].forEach(function (k) {
      t.ok(v.rejectedKeys.indexOf(k) !== -1, 'rejected the "' + k + '" field');
      t.eq(v[k], undefined, 'the validated reply has no "' + k + '" property at all');
    });
    var kinds = {};
    v.violations.forEach(function (x) { kinds[x.kind] = true; });
    t.ok(kinds[M.VIOLATIONS.order], 'a fabricated orders array is recorded as an order violation');
    t.ok(kinds[M.VIOLATIONS.medication], 'a fabricated medication field is recorded');
    t.ok(kinds[M.VIOLATIONS.lab], 'a fabricated labs field is recorded');
    t.ok(kinds[M.VIOLATIONS.vital], 'a fabricated vitals field is recorded');
    t.ok(kinds[M.VIOLATIONS.allergy], 'a fabricated allergy field is recorded');
    t.ok(kinds[M.VIOLATIONS.code_status], 'a fabricated code status is recorded');
    t.ok(kinds[M.VIOLATIONS.device], 'a fabricated device setting (fio2) is recorded');
    t.deepEq(M.REPLY_ALLOWED_KEYS.sort(),
      ['clarify', 'confidence', 'intent', 'matched_source_fact', 'requires_order', 'say', 'target'],
      'the allow-list is exactly seven non-clinical fields');

    /* -------------------------------------------------------------------- */
    t.group('LAYER 2: fabricated prose is dropped sentence by sentence');

    var facts = M.buildFacts(sc);
    /* Everything uncovered, so ONLY fabrication - not the hidden-information
       rule - can be what rejects these. */
    var allSeen = {};
    facts.facts.forEach(function (f) { allSeen[f.key] = true; });

    var attacks = [
      { label: 'an invented provider order',
        text: 'The provider orders two units of packed cells and a central line right now.',
        kind: M.VIOLATIONS.order },
      { label: 'an invented dose of a real drug',
        text: 'Give pantoprazole 40 mg IV push.',
        kind: M.VIOLATIONS.dose },
      { label: 'an invented medication',
        text: 'I would hang furosemide for him.',
        kind: M.VIOLATIONS.medication },
      { label: 'an invented lab value',
        text: 'His hemoglobin just came back at 4.1.',
        kind: M.VIOLATIONS.lab },
      { label: 'an invented vital sign',
        text: 'His blood pressure is now 62 and his heart rate is 148.',
        kind: M.VIOLATIONS.vital },
      { label: 'an invented device setting',
        text: 'He is on 6 liters by nasal cannula.',
        kind: M.VIOLATIONS.device },
      { label: 'an invented allergy',
        text: 'He is allergic to penicillin.',
        kind: M.VIOLATIONS.allergy },
      { label: 'an invented code status',
        text: 'He is a DNR.',
        kind: M.VIOLATIONS.code_status }
    ];
    attacks.forEach(function (a) {
      var res = M.sanitizeAIText(a.text, facts, allSeen);
      t.eq(res.text, '', a.label + ' is dropped entirely, not softened');
      var got = res.violations.map(function (x) { return x.kind; });
      t.ok(got.indexOf(a.kind) !== -1,
        a.label + ' is recorded as a "' + a.kind + '" violation (got: ' + got.join(',') + ')');
    });

    /* The other half of the contract: truthful, non-clinical prose survives,
       or the guard is just a mute button. */
    var kept = M.sanitizeAIText(
      'I feel awful. Please do not leave me alone in here.', facts, allSeen);
    t.ok(kept.text.length > 10, 'ordinary bedside prose with no fact claim is kept');
    t.eq(kept.violations.length, 0, 'and produces no violations');

    var mixed = M.sanitizeAIText(
      'I am scared. My hemoglobin is 4.1 now. Please stay with me.', facts, allSeen);
    t.notContains(mixed.text, '4.1', 'the fabricated sentence is removed from a mixed reply');
    t.contains(mixed.text, 'scared', 'the honest sentences in the same reply survive');
    t.contains(mixed.text, 'stay with me', 'and so does the one after it');

    /* The scenario's OWN numbers are traceable and must survive. */
    var truthful = M.sanitizeAIText('The pantoprazole 80 mg IV dose is on the MAR.',
      facts, allSeen);
    t.contains(truthful.text, '80 mg',
      'a dose that IS in the scenario is not a hallucination and is kept');

    /* -------------------------------------------------------------------- */
    t.group('a fabricated line never reaches patient state or the transcript');

    var poisoned = M.applyEvent(run0, {
      type: M.EVENTS.AI, at: at(30), who: 'provider',
      text: 'New order: furosemide 40 mg IV push. His hemoglobin is 4.1 and his pressure is 62 over 38.'
    }, sc);
    t.eq(poisoned.transcript.length, 0, 'nothing reached the transcript');
    t.ok(poisoned.aiViolations.length > 0,
      'the attempt is recorded in the run audit trail (' + poisoned.aiViolations.length + ' violations)');
    t.deepEq(poisoned.createdOrders, [], 'no order was created');
    t.deepEq(poisoned.done, run0.done, 'no action was marked done');
    t.eq(poisoned.state, run0.state, 'the patient state did not move');
    t.eq(poisoned.interventionCount, 0, 'no intervention was recorded');
    var poisonText = JSON.stringify(poisoned.log) + JSON.stringify(poisoned.transcript);
    t.notContains(poisonText, 'furosemide', 'the fabricated drug is nowhere in the log');
    t.notContains(poisonText, '4.1', 'the fabricated lab value is nowhere in the log');

    /* And the honest half of a poisoned line still gets through. */
    var halfGood = M.applyEvent(run0, {
      type: M.EVENTS.AI, at: at(31), who: 'patient',
      text: 'It hurts. The provider orders furosemide 40 mg IV now.'
    }, sc);
    t.eq(halfGood.transcript.length, 1, 'the clean sentence survived');
    t.notContains(halfGood.transcript[0].text, 'furosemide',
      'and the fabricated one did not travel with it');

    /* -------------------------------------------------------------------- */
    t.group('the guard is reveal-aware: the model cannot leak a hidden finding');

    var hidden = M.sanitizeAIText('You have crackles in both lung bases.', facts, run0.revealed);
    t.eq(hidden.text, '', 'a real finding the learner has not uncovered is dropped');
    t.ok(hidden.violations.some(function (x) { return x.kind === M.VIOLATIONS.hidden; }),
      'and is recorded as a hidden-information violation, not a fabrication');
    var afterAusc = {};
    Object.keys(run0.revealed).forEach(function (k) { afterAusc[k] = true; });
    M.revealsFor('auscultate_lungs', sc, run0).forEach(function (k) { afterAusc[k] = true; });
    var nowOk = M.sanitizeAIText('You have crackles in both lung bases.', facts, afterAusc);
    t.contains(nowOk.text, 'crackles',
      'once the learner has auscultated, the same sentence is allowed');

    /* ==================================================================== *
     * 2. UNORDERED MEDICATION
     * ==================================================================== */
    t.group('an unordered medication: safety penalty, no effect, no order created');

    var runMed = M.initialRun(sc, { startedAt: T0, mode: 'practice' });
    runMed = M.applyEvent(runMed, {
      type: M.EVENTS.ACT, at: at(60), intent: 'implement_orders',
      said: 'I give 40 of furosemide IV for the fluid overload'
    }, sc);

    t.eq(runMed.unsafe.length, 1, 'the attempt is logged as an unsafe action');
    t.eq(runMed.unsafe[0].kind, 'unordered_medication', 'classified as an unordered medication');
    t.eq(runMed.penalties.length, 1, 'a safety penalty was applied');
    t.eq(runMed.penalties[0].category, 'safety', 'the penalty lands in the safety band');
    t.eq(runMed.penalties[0].points, M.UNSAFE_PENALTY, 'at the configured penalty size');
    t.deepEq(runMed.createdOrders, [], 'THE ORDER WAS NOT CREATED');
    t.eq(runMed.pending.length, 0, 'no medication effect was scheduled');
    t.eq(runMed.interventionCount, 0, 'the intervention was not counted');
    t.ok(!runMed.done.implement_orders, 'and the action was not marked done');
    t.eq(runMed.actions.length, 0, 'it is not in the action timeline as a performed action');

    var medScore = M.scoreRun(runMed, sc, runMed.opts);
    var safetyCat = medScore.categories.filter(function (c) { return c.id === 'safety'; })[0];
    t.ok(safetyCat.penalty >= M.UNSAFE_PENALTY, 'the safety band carries the penalty');
    t.ok(safetyCat.earned < safetyCat.weight, 'so safety cannot be full marks');
    t.eq(medScore.unsafeCount, 1, 'the score reports one unsafe action');

    /* The ORDERED medication on the same sheet must still work, or the guard
       is just blocking care. */
    var runOrdered = M.initialRun(sc, { startedAt: T0, mode: 'practice' });
    runOrdered = M.applyEvent(runOrdered, {
      type: M.EVENTS.ACT, at: at(60), intent: 'give_pantoprazole',
      said: 'I give the pantoprazole that is ordered'
    }, sc);
    t.eq(runOrdered.unsafe.length, 0, 'a medication that IS ordered is not an unsafe action');
    t.eq(runOrdered.pending.length, 1, 'and its effect is scheduled after a realistic delay');
    t.eq(runOrdered.pending[0].atSec, 60 + M.EFFECT_DELAY_SEC, 'at the configured delay');
    t.deepEq(runOrdered.createdOrders, [], 'still no order was created - it already existed');

    /* The PRBC case: singular/plural against the MAR must not read as unordered. */
    var runPrbc = M.applyEvent(M.initialRun(sc, { startedAt: T0 }), {
      type: M.EVENTS.ACT, at: at(30), intent: 'monitor_prbc_transfusion',
      said: 'I monitor the PRBC transfusion'
    }, sc);
    t.eq(runPrbc.unsafe.length, 0,
      'monitoring the ordered PRBC transfusion is not an unordered medication');
    t.ok(!!runPrbc.done.monitor_prbc_transfusion, 'and it counts as done');

    /* ==================================================================== *
     * 3. HIDDEN INFORMATION
     * ==================================================================== */
    t.group('hidden findings stay hidden until the matching assessment');

    function keyOfFinding(needle) {
      var hit = facts.facts.filter(function (f) {
        return f.kind === 'finding' && lower(f.text).indexOf(needle) !== -1;
      })[0];
      return hit ? hit.key : '';
    }
    var kLung = keyOfFinding('crackles');
    var kPupil = keyOfFinding('pupils');
    var kPain = keyOfFinding('epigastric pain');
    var kLab = 'lab:0';
    t.ok(!!kLung && !!kPupil && !!kPain, 'the fixture has lung, pupil and pain findings');

    var r1 = M.initialRun(sc, { startedAt: T0 });
    t.ok(!r1.revealed[kLung], 'lung sounds are hidden at handoff');
    t.ok(!r1.revealed[kPupil], 'pupils are hidden at handoff');
    t.ok(!r1.revealed[kPain], 'pain detail is hidden at handoff');
    t.ok(!r1.revealed[kLab], 'labs are hidden at handoff');
    t.ok(!r1.revealed['order:0'], 'orders are hidden until the chart is opened');
    /* What the handoff DOES disclose is not hidden - it was in the report. */
    t.ok(!!r1.revealed[keyOfFinding('hematemesis')],
      'a finding the handoff itself states is legitimately already visible');

    /* A generic focused assessment is not a stethoscope, a penlight or a
       symptom interview. */
    var rFocus = M.applyEvent(r1, { type: M.EVENTS.ACT, at: at(30),
      intent: 'focused_assessment', said: 'I do a focused assessment' }, sc);
    t.ok(!rFocus.revealed[kLung], 'a focused assessment does NOT reveal lung sounds');
    t.ok(!rFocus.revealed[kPupil], 'a focused assessment does NOT reveal pupils');
    t.ok(!rFocus.revealed[kPain], 'a focused assessment does NOT reveal pain detail');
    t.ok(!rFocus.revealed[kLab], 'a focused assessment does NOT open the labs');

    var rLung = M.applyEvent(r1, { type: M.EVENTS.ACT, at: at(30),
      intent: 'auscultate_lungs', said: 'I auscultate the lungs' }, sc);
    t.ok(!!rLung.revealed[kLung], 'auscultation reveals the lung finding');
    t.ok(!rLung.revealed[kPupil], 'and only the lung finding');

    var rPupil = M.applyEvent(r1, { type: M.EVENTS.ACT, at: at(30),
      intent: 'check_pupils', said: 'I check her pupils with a penlight' }, sc);
    t.ok(!!rPupil.revealed[kPupil], 'a neuro/pupil check reveals the pupil finding');
    t.ok(!rPupil.revealed[kLung], 'and does not leak the lungs');

    var rPain = M.applyEvent(r1, { type: M.EVENTS.ACT, at: at(30),
      intent: 'ask_pain', said: 'Can you rate your pain from zero to ten?' }, sc);
    t.ok(!!rPain.revealed[kPain], 'symptom questions reveal the pain detail');

    var rLabs = M.applyEvent(r1, { type: M.EVENTS.ACT, at: at(30),
      intent: 'open_labs', said: 'I pull up the labs' }, sc);
    t.ok(!!rLabs.revealed[kLab], 'opening the lab panel reveals the labs');
    t.ok(!rLabs.revealed['order:0'], 'but not the order sheet');

    /* -------------------------------------------------------------------- */
    t.group('a hidden finding cannot leak through the debrief before it is earned');

    var midDebrief = M.debriefText(r1, sc, r1.opts);
    t.notContains(midDebrief, 'crackles', 'the live debrief does not spell out the lung finding');
    t.notContains(midDebrief, 'sluggish', 'nor the pupil finding');
    t.notContains(midDebrief, '6.8', 'nor an unopened lab value');
    var midObj = M.buildDebrief(r1, sc, r1.opts);
    var lungMiss = midObj.missedData.filter(function (m) { return m.key === kLung; })[0];
    t.ok(!!lungMiss, 'the debrief still TELLS the learner a lung finding exists');
    t.eq(lungMiss.text, '', 'without giving them the answer while the run is live');
    t.contains(lungMiss.label, 'Lung', 'it names the system instead');

    var endedRun = M.applyEvent(r1, { type: M.EVENTS.END, at: at(200), reason: 'learner' }, sc);
    var endDebrief = M.debriefText(endedRun, sc, endedRun.opts);
    t.contains(endDebrief, 'crackles',
      'once the run has ended, the missed finding IS spelled out - that is the teaching');

    /* ==================================================================== *
     * 4. INTENT MATCHING
     * ==================================================================== */
    t.group('intent matching accepts clinically equivalent wording');

    var phrasings = {
      check_oxygenation: ['check O2 sat', 'pulse ox', 'SpO2', 'let me check her oxygen saturation',
        'put the pulse oximeter on'],
      auscultate_lungs: ['I listen to the lungs', 'auscultate lung sounds',
        'I want breath sounds', 'stethoscope on the chest to listen to the lungs'],
      check_pupils: ['check pupils', 'PERRLA', 'I do a neuro check', 'pupillary response with a penlight'],
      ask_pain: ['rate your pain', 'I ask about pain', 'where does it hurt', 'pain assessment'],
      open_labs: ['pull up the labs', 'I review the labs', 'check the labs', 'look at the lab results'],
      sbar: ['I call the provider', 'notify the doctor', 'give SBAR', 'I page the provider'],
      hand_hygiene: ['hand hygiene', 'I wash my hands', 'foam in', 'alcohol rub'],
      reassess: ['I reassess the patient', 'recheck after the intervention', 'did it help',
        'I re-evaluate the response']
    };
    Object.keys(phrasings).forEach(function (id) {
      var said = phrasings[id];
      var hits = 0;
      said.forEach(function (phrase) {
        var m = M.matchIntent(phrase, sc, {});
        if (m.intent === id) { hits++; }
        else {
          t.ok(false, '"' + phrase + '" should map to ' + id + ' (got "' + m.intent +
            '" at ' + m.confidence + ')');
        }
      });
      t.ok(hits >= 3, id + ': at least 3 equivalent phrasings map to the same intent (' +
        hits + '/' + said.length + ')');
    });
    t.eq(M.matchIntent('check O2 sat', sc, {}).intent,
         M.matchIntent('pulse ox', sc, {}).intent,
         '"check O2 sat" and "pulse ox" are literally the same intent id');
    t.eq(M.matchIntent('SpO2', sc, {}).intent,
         M.matchIntent('pulse ox', sc, {}).intent,
         'and so is "SpO2" - the spec\'s own example');

    var shape = M.matchIntent('I listen to the lungs', sc, {});
    ['intent', 'target', 'confidence', 'requires_order', 'matched_source_fact']
      .forEach(function (k) {
        t.ok(Object.prototype.hasOwnProperty.call(shape, k),
          'the match carries the spec field "' + k + '"');
      });
    t.ok(shape.confidence >= M.CLARIFY_BELOW, 'a clear phrasing clears the confidence threshold');

    t.group('below the confidence threshold it asks instead of guessing');
    ['I want to know about the sounds', 'the blue box in the hallway', 'maybe something else now']
      .forEach(function (phrase) {
        var m = M.matchIntent(phrase, sc, {});
        t.eq(m.intent, '', '"' + phrase + '" does not guess an intent');
        t.ok(m.needsClarification, 'and asks for clarification');
        t.ok(String(m.clarify).length > 10, 'with an actual question, not an empty string');
        t.ok(m.confidence < M.CLARIFY_BELOW, 'confidence is below the threshold');
      });

    t.group('the AI can only widen the matcher, never override the vocabulary');
    var badAi = M.validateAIReply({ intent: 'give_epinephrine_now', confidence: 1 }, sc, run0);
    t.eq(badAi.intent, '', 'an intent id that is not in allowed_action_intents is refused');
    var capped = M.validateAIReply({ intent: 'sbar', confidence: 1 }, sc, run0);
    t.ok(capped.confidence <= M.AI_CONF_CAP,
      'a model can never claim more certainty than a deterministic exact match');

    /* ==================================================================== *
     * 5. DETERIORATION
     * ==================================================================== */
    t.group('deterioration fires only from time, missed criticals or unsafe actions');

    /* (a) a clean, fast run never deteriorates */
    var clean = M.initialRun(sc, { startedAt: T0, mode: 'practice' });
    ['hand_hygiene', 'verify_identity', 'abc_assessment', 'protect_airway_during_emesis',
     'monitor_prbc_transfusion'].forEach(function (id, i) {
      clean = M.applyEvent(clean, { type: M.EVENTS.ACT, at: at(10 + i * 5), intent: id }, sc);
    });
    clean = M.applyEvent(clean, { type: M.EVENTS.SBAR, at: at(60),
      text: 'S B A R', sections: { s: 'x', b: 'y', a: 'z', r: 'w' } }, sc);
    clean = M.applyEvent(clean, { type: M.EVENTS.TICK, at: at(1100) }, sc);
    t.eq(clean.deteriorationReasons.length, 0,
      'a run with every critical action done never deteriorates, however long it runs');
    t.notContains(JSON.stringify(clean.stateHistory), 'deteriorating',
      'and never enters the deteriorating state');

    /* (b) missed criticals at a scheduled checkpoint */
    var lazy = M.initialRun(sc, { startedAt: T0, mode: 'practice' });
    lazy = M.applyEvent(lazy, { type: M.EVENTS.TICK, at: at(400) }, sc);
    t.eq(lazy.deteriorationReasons.length, 0, 'nothing fires before the first checkpoint');
    lazy = M.applyEvent(lazy, { type: M.EVENTS.TICK, at: at(500) }, sc);
    t.ok(lazy.deteriorationReasons.length >= 1, 'the checkpoint fires with criticals outstanding');
    t.eq(lazy.deteriorationReasons[0].reason, 'missed_criticals', 'for the right reason');
    t.eq(lazy.state, M.STATES.deteriorating, 'and the state advanced');

    /* (c) an unsafe action */
    t.eq(runMed.deteriorationReasons.length, 1, 'an unsafe action deteriorates the patient');
    t.eq(runMed.deteriorationReasons[0].reason, 'unsafe_action', 'with reason "unsafe_action"');

    /* (d) scripted time */
    var timed = M.initialRun(sc, { startedAt: T0, mode: 'practice' });
    ['hand_hygiene', 'abc_assessment', 'protect_airway_during_emesis'].forEach(function (id, i) {
      timed = M.applyEvent(timed, { type: M.EVENTS.ACT, at: at(10 + i * 5), intent: id }, sc);
    });
    timed = M.applyEvent(timed, { type: M.EVENTS.TICK, at: at(760) }, sc);
    var reasons = timed.deteriorationReasons.map(function (x) { return x.reason; });
    t.ok(reasons.indexOf('time') !== -1, 'the scripted time trigger fires with work still open');

    /* (e) nothing else, ever */
    var allReasons = {};
    [clean, lazy, runMed, timed].forEach(function (r) {
      r.deteriorationReasons.forEach(function (x) { allReasons[x.reason] = true; });
    });
    Object.keys(allReasons).forEach(function (k) {
      t.ok(['time', 'missed_criticals', 'unsafe_action'].indexOf(k) !== -1,
        'deterioration reason "' + k + '" is one of the three permitted triggers');
    });

    t.group('the engine is deterministic - the same events give the same run');
    var evts = [
      { type: M.EVENTS.START, at: at(0) },
      { type: M.EVENTS.ACT, at: at(20), intent: 'hand_hygiene' },
      { type: M.EVENTS.ACT, at: at(40), intent: 'abc_assessment' },
      { type: M.EVENTS.ACT, at: at(90), intent: 'open_labs' },
      { type: M.EVENTS.TICK, at: at(600) }
    ];
    var foldA = M.foldEvents(sc, { startedAt: T0, mode: 'practice' }, evts);
    var foldB = M.foldEvents(sc, { startedAt: T0, mode: 'practice' }, evts);
    t.deepEq(foldA.revealed, foldB.revealed, 'the reveal ledger is identical');
    t.deepEq(foldA.stateHistory, foldB.stateHistory, 'the state history is identical');
    t.deepEq(foldA.log, foldB.log, 'even the log is byte-identical - no randomness anywhere');

    t.group('the state machine walks the four documented states');
    t.deepEq(M.STATE_ORDER,
      ['handoff', 'active', 'deteriorating', 'critical_event', 'stabilized_or_transferred'],
      'the states are exactly the ones in SIMULATION_MODE_SPEC.md');
    t.eq(M.initialRun(sc, { startedAt: T0 }).state, 'handoff', 'a run starts at handoff');
    var toActive = M.applyEvent(M.initialRun(sc, { startedAt: T0 }),
      { type: M.EVENTS.ACT, at: at(10), intent: 'hand_hygiene' }, sc);
    t.eq(toActive.state, 'active', 'the first action moves it to active');

    var recover = lazy;
    ['abc_assessment', 'protect_airway_during_emesis', 'monitor_prbc_transfusion']
      .forEach(function (id, i) {
        recover = M.applyEvent(recover, { type: M.EVENTS.ACT, at: at(520 + i * 5), intent: id }, sc);
      });
    recover = M.applyEvent(recover, { type: M.EVENTS.ACT, at: at(560), intent: 'reassess' }, sc);
    recover = M.applyEvent(recover, { type: M.EVENTS.SBAR, at: at(580),
      text: 'S B A R', sections: { s: 'a', b: 'b', a: 'c', r: 'd' } }, sc);
    t.eq(recover.state, M.STATES.stabilized_or_transferred,
      'recognition + interventions + reassessment + escalation stabilizes the patient');

    /* ==================================================================== *
     * 6. CONSEQUENCES
     * ==================================================================== */
    t.group('reassessment scores only after an intervention or a state change');

    var early = M.applyEvent(M.initialRun(sc, { startedAt: T0 }),
      { type: M.EVENTS.ACT, at: at(10), intent: 'reassess', said: 'I reassess' }, sc);
    t.eq(early.reassessCredits, 0, 'a reassessment before anything happened earns nothing');
    t.eq(early.reassessAttempts, 1, 'but the attempt is recorded');
    var later = M.applyEvent(runOrdered,
      { type: M.EVENTS.ACT, at: at(120), intent: 'reassess', said: 'I reassess' }, sc);
    t.eq(later.reassessCredits, 1, 'after an intervention, the same action earns credit');

    /* ==================================================================== *
     * 7. EXAM MODE
     * ==================================================================== */
    t.group('exam mode suppresses hints, the running score and diagnosis clues');

    var examRun = M.initialRun(sc, { startedAt: T0, mode: 'exam' });
    t.eq(examRun.mode, 'exam', 'the run is in exam mode');
    t.eq(examRun.opts.hintsEnabled, false, 'hints are off and cannot be turned on');
    t.eq(M.hintFor(examRun, sc, 1), null, 'tier 1 gives nothing');
    t.eq(M.hintFor(examRun, sc, 2), null, 'tier 2 gives nothing');
    t.eq(M.hintFor(examRun, sc, 3), null, 'tier 3 gives nothing');
    var examHinted = M.applyEvent(examRun,
      { type: M.EVENTS.HINT, at: at(30), tier: 3, text: 'the answer' }, sc);
    t.eq(examHinted.hints.length, 0, 'a hint event is refused outright in exam mode');
    t.notContains(JSON.stringify(examHinted.log), 'the answer',
      'and nothing leaks into the log');

    var practiceRun = M.initialRun(sc, { startedAt: T0, mode: 'practice' });
    var h1 = M.hintFor(practiceRun, sc, 1);
    var h3 = M.hintFor(practiceRun, sc, 3);
    t.ok(!!h1 && !!h3, 'practice mode has a hint ladder');
    t.notContains(h1.body, String(M.nextPriority(practiceRun, sc).label),
      'tier 1 is a cue and does NOT name the action');
    t.contains(h3.body, String(M.nextPriority(practiceRun, sc).label),
      'tier 3 is the action itself');
    t.eq(M.hintFor(practiceRun, sc, 2).title, 'Category', 'tier 2 gives the category');

    /* ==================================================================== *
     * 8. "WHAT AM I MISSING?"
     * ==================================================================== */
    t.group('"What am I missing?" returns exactly one action, never a dump');

    var blank = M.initialRun(sc, { startedAt: T0 });
    t.ok(M.missedCriticals(blank, sc).length > 1,
      'there is more than one critical action outstanding (' +
      M.missedCriticals(blank, sc).length + ')');
    var one = M.whatAmIMissing(blank, sc);
    t.ok(!!one, 'it returns something');
    t.ok(!Array.isArray(one), 'and it is NOT a list');
    t.eq(typeof one.intent, 'string', 'it names exactly one intent');
    t.eq(typeof one.label, 'string', 'with a single label');
    t.ok(String(one.label).length > 0, 'that is not empty');

    var afterOne = M.applyEvent(blank,
      { type: M.EVENTS.ACT, at: at(20), intent: one.intent }, sc);
    var two = M.whatAmIMissing(afterOne, sc);
    t.ok(!!two && two.intent !== one.intent, 'the next call names the NEXT one, one at a time');

    var finished = clean;
    var none = M.whatAmIMissing(finished, sc);
    t.ok(none === null || (!!none && !Array.isArray(none)),
      'with nothing critical open it returns null or a single next step, never a list');

    /* ==================================================================== *
     * 9. COACH MODE
     * ==================================================================== */
    t.group('coach mode refuses to complete an intervention from a vague utterance');

    ['I take care of the patient', 'I look after him', 'I do everything',
     'nursing care', 'I handle it', 'ok'].forEach(function (phrase) {
      t.ok(M.isVague(phrase), '"' + phrase + '" is recognised as vague');
      var m = M.matchIntent(phrase, sc, {});
      t.eq(m.intent, '', '"' + phrase + '" marks nothing');
      t.ok(m.vague, 'and is flagged vague rather than low-confidence');
      t.ok(String(m.clarify).length > 20, 'with an explanation of what to say instead');
    });
    /* The contrast case: a specific statement of the same shape DOES mark. */
    t.eq(M.matchIntent('I take care of hand hygiene before I go in', sc, {}).intent,
      'hand_hygiene', 'a specific statement still marks, so the vague filter is not a wall');

    t.group('the four rehearsal styles exist and Silent examiner really is silent');
    t.deepEq(M.COACH_STYLES.map(function (s) { return s.id; }),
      ['silent', 'coach', 'callresponse', 'checklist'],
      'all four rehearsal options from the checkoff spec');
    t.eq(M.coachStyle('silent').hints, false, 'Silent examiner gives no hints');
    t.eq(M.coachStyle('checklist').dialogue, false, 'Checklist only has no AI dialogue');
    t.eq(M.coachStyle('callresponse').dialogue, true, 'Call-and-response plays the voices');
    t.eq(M.coachStyle('nonsense').id, 'coach', 'an unknown style falls back to Coach');

    t.group('the end condition requires an explicit reassessment and SBAR');
    var openRun = M.initialRun(sc, { startedAt: T0 });
    var blockers = M.completionBlockers(openRun, sc, openRun.opts);
    t.eq(blockers.length, 2, 'both requirements are outstanding at the start');
    t.ok(!M.canComplete(openRun, sc, openRun.opts), 'so the scenario cannot be completed');
    t.ok(M.canComplete(recover, sc, recover.opts),
      'a run with a credited reassessment and an SBAR can complete');
    var relaxed = M.initialRun(sc, { startedAt: T0,
      requireReassessBeforeEnd: false, requireSbarBeforeEnd: false });
    t.ok(M.canComplete(relaxed, sc, relaxed.opts),
      'an instructor can switch both requirements off');

    /* ==================================================================== *
     * 10. PROVIDER INTERACTION
     * ==================================================================== */
    t.group('the provider never improvises an order');

    var resp = M.providerResponse(sc, recover);
    t.eq(resp.authored, false, 'this scenario has no pre-authored provider branch');
    t.deepEq(resp.newOrders, [], 'so no new orders come back');
    t.contains(resp.text, 'not adding anything new',
      'the provider acknowledges the SBAR and holds rather than inventing an order');
    var withBranch = fixture();
    withBranch.provider_branches = [{
      when: 'sbar', response: 'Increase the normal saline bolus and keep the PRBCs going.',
      orders: ['Normal saline 1000 mL IV bolus'], ends: false
    }];
    var branchResp = M.providerResponse(withBranch, recover);
    t.eq(branchResp.authored, true, 'an instructor-authored branch IS honoured');
    t.eq(branchResp.newOrders.length, 1, 'and its pre-authored order comes through');

    /* ==================================================================== *
     * 11. SOURCE DISCREPANCIES
     * ==================================================================== */
    t.group('an unresolved source discrepancy is not scored at all');

    var scored = M.scoreRun(recover, sc, recover.opts);
    t.eq(scored.openDiscrepancies.length, 1, 'the fixture has one unresolved source issue');
    var notScoredIds = scored.notScored.map(function (i) { return i.id; });
    t.ok(notScoredIds.indexOf('give_pantoprazole') !== -1,
      'the item whose source fact the discrepancy names is removed from scoring');
    var prio = scored.categories.filter(function (c) {
      return c.id === 'prioritization_interventions';
    })[0];
    t.ok(prio.items.every(function (i) { return i.id !== 'give_pantoprazole'; }),
      'it is out of the numerator');
    t.ok(prio.blockedItems.length >= 1, 'and reported separately as blocked');
    t.ok(scored.possible <= scored.configuredTotal,
      'the denominator shrank rather than counting a contested item against the learner');
    t.ok(notScoredIds.indexOf('hand_hygiene') === -1,
      'unrelated items are still scored - the block is targeted, not a blanket');

    /* An instructor override resolves it, with an audit trail. */
    var overrides = { upper_gi_bleed: { d0: { text: 'Pantoprazole 80 mg IV bolus once, then infusion.',
      by: 'instructor@school.edu', at: T0 } } };
    var resolved = M.scoreRun(recover, sc, { overrides: overrides });
    t.eq(resolved.openDiscrepancies.length, 0, 'the override resolves the discrepancy');
    t.eq(resolved.notScored.length, 0, 'and the item comes back into scoring');
    t.eq(M.discrepancies(sc, { overrides: overrides })[0].resolvedBy, 'instructor@school.edu',
      'the override keeps an audit trail');

    /* ==================================================================== *
     * 12. SCORING RUBRIC
     * ==================================================================== */
    t.group('the rubric matches SCORING_RUBRIC.json and is instructor-customisable');

    t.deepEq(M.DEFAULT_WEIGHTS, {
      safety: 30, assessment_recognition: 25, prioritization_interventions: 25,
      communication: 10, reassessment_documentation_education: 10
    }, 'the default weights are the packaged rubric');
    var custom = M.resolveWeights(sc, { weights: { safety: 50, communication: 5 } });
    t.eq(custom.safety, 50, 'an instructor can raise a weight');
    t.eq(custom.communication, 5, 'and lower another');
    t.eq(custom.assessment_recognition, 25, 'leaving the rest alone');

    t.group('no automatic course failure unless it is explicitly configured');
    var disaster = M.initialRun(sc, { startedAt: T0 });
    disaster = M.applyEvent(disaster, { type: M.EVENTS.ACT, at: at(20),
      intent: 'implement_orders', said: 'I push furosemide 40 mg' }, sc);
    disaster = M.applyEvent(disaster, { type: M.EVENTS.TICK, at: at(1250) }, sc);
    var defScore = M.scoreRun(disaster, sc, disaster.opts);
    t.eq(defScore.autoFailed, false,
      'an unsafe action plus every critical missed STILL does not auto-fail by default');
    t.eq(defScore.autoFailConfigured, false, 'and reports that no auto-fail was configured');
    t.ok(defScore.unsafeCount > 0, 'even though the unsafe action is on the record');
    t.ok(defScore.criticalsMissed.length > 0, 'and the criticals really were missed');
    var strict = M.scoreRun(disaster, sc, { autoFail: true, autoFailThreshold: 2 });
    t.eq(strict.autoFailed, true, 'an instructor who configures it does get an auto-fail');
    t.ok(String(strict.autoFailReason).length > 10, 'with the reason stated');

    /* ==================================================================== *
     * 13. THE CLOCK
     * ==================================================================== */
    t.group('pause freezes the clock and resume does not fast-forward');

    var pr = M.initialRun(sc, { startedAt: T0, mode: 'practice' });
    pr = M.applyEvent(pr, { type: M.EVENTS.TICK, at: at(10) }, sc);
    t.eq(M.elapsedSec(pr, at(10)), 10, '10 seconds have elapsed');

    pr = M.applyEvent(pr, { type: M.EVENTS.PAUSE, at: at(10) }, sc);
    t.ok(M.isPausedRun(pr), 'the run is paused');
    t.eq(M.elapsedSec(pr, at(60)), 10, 'fifty seconds of wall time later, the clock has not moved');
    t.eq(M.elapsedSec(pr, at(3600)), 10, 'nor an hour later');
    t.eq(M.remainingSec(pr, at(3600)), 20 * 60 - 10, 'and the countdown is frozen too');

    var frozen = M.applyEvent(pr, { type: M.EVENTS.TICK, at: at(3600) }, sc);
    t.eq(frozen.deteriorationReasons.length, 0,
      'deterioration timers are frozen with the clock - an hour paused deteriorates nobody');
    t.eq(frozen.state, pr.state, 'and no state transition happened while paused');

    pr = M.applyEvent(pr, { type: M.EVENTS.RESUME, at: at(3600) }, sc);
    t.ok(!M.isPausedRun(pr), 'the run resumed');
    t.eq(M.elapsedSec(pr, at(3600)), 10, 'RESUME DOES NOT FAST-FORWARD - still 10 seconds');
    t.eq(pr.pausedMs, 3590 * 1000, 'the paused wall time is banked separately');
    t.eq(M.elapsedSec(pr, at(3605)), 15, 'and the clock picks up exactly where it stopped');
    t.eq(pr.pauseCount, 1, 'the pause is counted');

    var stats = M.pauseStats();
    t.eq(typeof stats, 'object', 'pauseStats() answers with nothing mounted');
    t.eq(stats.paused, false, 'and reports not paused');
    t.eq(M.pause('x'), false, 'pause() with nothing mounted is a harmless false');

    /* ==================================================================== *
     * 14. DEBRIEF CONTENT
     * ==================================================================== */
    t.group('the debrief carries everything the master prompt asks for');

    var dbg = M.buildDebrief(recover, sc, recover.opts);
    ['timeline', 'criticalsCompleted', 'criticalsMissed', 'unsafeActions', 'outOfOrder',
     'missedData', 'reassessed', 'remediation', 'score', 'studyLinks', 'sourceIssues']
      .forEach(function (k) {
        t.ok(Object.prototype.hasOwnProperty.call(dbg, k), 'the debrief has "' + k + '"');
      });
    t.eq(dbg.remediation.length, 3, 'the remediation plan is exactly three items');
    t.ok(dbg.timeline.length > 0, 'the timeline has the learner\'s actions in it');
    t.ok(dbg.timeline.every(function (x) { return typeof x.source === 'string'; }),
      'every timeline entry carries its source');
    var allItems = [];
    dbg.score.categories.forEach(function (c) {
      c.items.forEach(function (i) { allItems.push(i); });
    });
    t.ok(allItems.length > 0, 'there are scored items');
    t.ok(allItems.every(function (i) { return !!i.provenance; }),
      'EVERY scored item carries source provenance');
    t.ok(allItems.every(function (i) {
      return ['school_file', 'generated_supplemental_practice', 'instructor_override']
        .indexOf(i.provenance) !== -1;
    }), 'and the provenance is one of the three documented values');
    t.eq(dbg.reassessed, true, 'it records whether reassessment happened');

    t.group('study links are feature-detected, not hard-wired');
    t.noThrow(function () { M.buildDebrief(recover, sc, recover.opts); },
      'a debrief without window.SimPrepStudy does not throw');
    var studyWorld = makeSimWorld({
      study: { linkFor: function (topicId, section) {
        return { topicId: topicId, section: section, href: '#study/' + topicId + '/' + section };
      } }
    });
    var SM = studyWorld.window.SimPrepSimMode;
    var scS = SM.scenarioById('upper_gi_bleed');
    var runS = SM.initialRun(scS, { startedAt: T0 });
    runS = SM.applyEvent(runS, { type: SM.EVENTS.END, at: at(100) }, scS);
    var dbgS = SM.buildDebrief(runS, scS, runS.opts);
    t.ok(dbgS.studyLinks.length > 0, 'with SimPrepStudy present, the debrief links back to it');
    t.contains(String(dbgS.studyLinks[0].href), '#study/upper_gi_bleed',
      'using the study module\'s own link shape');
    dropWorld(studyWorld, world);

    /* ==================================================================== *
     * 15. SBAR
     * ==================================================================== */
    t.group('the SBAR template is built only from what the learner uncovered');

    var tplEarly = M.sbarTemplate(r1, sc);
    t.notContains(tplEarly.a, 'crackles', 'an unassessed finding is not pre-filled');
    t.notContains(tplEarly.b, 'pantoprazole', 'an unopened MAR is not pre-filled');
    var openedChart = M.applyEvent(rLung, { type: M.EVENTS.ACT, at: at(60),
      intent: 'review_chart' }, sc);
    var tplLater = M.sbarTemplate(openedChart, sc);
    t.contains(tplLater.a, 'crackles', 'once assessed, the finding is available to the report');
    t.contains(tplLater.b, 'pantoprazole', 'and so is the MAR once the chart is open');

    var cov = M.sbarCoverage(recover, sc);
    t.eq(cov.total, 4, 'coverage is measured against all four sbar_expected lines');
    t.eq(typeof cov.pct, 'number', 'and reports a percentage');

    /* ==================================================================== *
     * 16. DEGRADATION
     * ==================================================================== */
    t.group('the module survives a missing data global');

    var bare = makeSimWorld({ noData: true });
    var BM = bare.window.SimPrepSimMode;
    t.eq(typeof BM, 'function', 'the module still loads with no window.NUR2212_SCENARIOS');
    t.eq(BM.contentOk(), false, 'contentOk() is honest about it');
    t.deepEq(BM.allScenarios(), [], 'allScenarios() is an empty list, not a throw');
    t.eq(BM.scenarioById('anything'), null, 'scenarioById() returns null');
    t.noThrow(function () { BM.buildFacts(null); }, 'buildFacts(null) does not throw');
    t.noThrow(function () { BM.matchIntent('I listen to the lungs', null, {}); },
      'matchIntent against a null scenario does not throw');
    t.noThrow(function () { BM.initialRun(null, {}); }, 'initialRun(null) does not throw');
    t.noThrow(function () { BM.scoreRun(BM.initialRun(null, {}), null, {}); },
      'scoreRun on an empty scenario does not throw');

    var mount = H.renderInto(bare.window, React.createElement(BM, {
      progress: {}, setProgress: function () {}, authUser: null,
      isAdmin: false, isSuperAdmin: false, topicId: '', onNav: function () {}
    }));
    t.contains(mount.text(), 'did not load',
      'it renders a clear "content failed to load" state, not a white screen');
    t.contains(mount.text(), 'NUR2212_SCENARIOS', 'and names the file that is missing');
    t.contains(mount.text(), 'practice only',
      'the practice-only label is present even on the failure screen');
    mount.unmount();
    dropWorld(bare, world);

    t.group('the AI layer is an accessory, never a gate');
    t.eq(typeof M.aiReady, 'function', 'aiReady() is exported');
    var noAiWorld = makeSimWorld();
    noAiWorld.window.MM.ai = {};
    var NM = noAiWorld.window.SimPrepSimMode;
    t.eq(NM.aiReady(), false, 'with no MM.ai.chat, aiReady() is false');
    var scN = NM.scenarioById('upper_gi_bleed');
    t.eq(NM.matchIntent('pulse ox', scN, {}).intent, 'check_oxygenation',
      'the deterministic matcher still works with the AI unavailable');
    var pWiden = NM.aiWidenIntent('do the thing', scN, NM.initialRun(scN, {}));
    return Promise.resolve(pWiden).then(function (widened) {
      t.eq(widened, null, 'aiWidenIntent resolves null rather than rejecting');
      return NM.aiSpeak('the patient', 'how are you?', scN, NM.initialRun(scN, {}));
    }).then(function (spoke) {
      t.eq(spoke.ok, false, 'aiSpeak resolves a safe empty result with no AI');
      t.eq(spoke.text, '', 'and no text');

      /* A hostile model that DOES answer. */
      var hostile = {
        chat: function () {
          return Promise.resolve(JSON.stringify({
            say: 'The provider ordered furosemide 40 mg IV push and your hemoglobin is 4.1.',
            orders: ['furosemide 40 mg IV push'],
            intent: 'implement_orders',
            confidence: 1
          }));
        }
      };
      var hw = makeSimWorld({ ai: hostile });
      var HM = hw.window.SimPrepSimMode;
      var scH = HM.scenarioById('upper_gi_bleed');
      var runH = HM.initialRun(scH, { startedAt: T0 });
      return HM.aiSpeak('the provider', 'SBAR given', scH, runH).then(function (res) {
        t.eq(res.text, '', 'a hostile model reply survives nothing through the guard');
        t.ok(res.violations.length >= 2,
          'and every fabrication in it is recorded (' + res.violations.length + ')');
        var hk = res.violations.map(function (x) { return x.kind; });
        t.ok(hk.indexOf(HM.VIOLATIONS.order) !== -1, 'including the fabricated orders array');
        dropWorld(hw, world);
      });
    }).then(function () {
      dropWorld(noAiWorld, world);

      /* ================================================================== */
      t.group('the partner layer is optional');

      t.eq(M.partnerRoom(), null, 'with no MM.simprepPartner there is no room');
      t.eq(M.partnerIsHost(), true, 'and the solo learner is treated as the host');
      var pw = makeSimWorld({
        partner: {
          createRoom: function () {}, joinRoom: function () {}, leaveRoom: function () {},
          subscribe: function () { return function () {}; },
          setActivity: function () {}, publish: function () {},
          onEvent: function () { return function () {}; },
          getRoom: function () { return { code: 'ABCD' }; },
          isHost: function () { return false; }
        }
      });
      var PM = pw.window.SimPrepSimMode;
      t.ok(!!PM.partnerRoom(), 'with the partner layer present the room is detected');
      t.eq(PM.partnerIsHost(), false, 'and the observer role is respected');
      dropWorld(pw, world);

      /* ================================================================== */
      t.group('both surfaces actually render');

      var scM = M.scenarioById('upper_gi_bleed');
      var runMount = H.renderInto(W, React.createElement(M.Runner, {
        sc: scM,
        setup: { mode: 'practice', startedAt: Date.now(), coachStyle: 'coach' },
        onFinish: function () {}
      }));
      var runText = runMount.text();
      t.contains(runText, 'PRACTICE ONLY', 'the runner carries the permanent practice-only label');
      t.contains(runText, 'What do you do', 'the action panel rendered');
      t.contains(runText, 'What am I missing', 'the one-thing panel is there in practice mode');
      t.notContains(runText, 'crackles', 'no unassessed finding is on screen');
      t.notContains(runText, '6.8', 'no unopened lab value is on screen');
      t.notContains(runText, 'sluggish', 'no unassessed pupil finding is on screen');
      t.ok(runMount.all('button').length > 8, 'the action controls rendered');
      t.ok(runMount.all('button').filter(function (b) { return b.disabled; }).length === 0,
        'NO control the learner may still need is disabled');
      runMount.unmount();

      var examMount = H.renderInto(W, React.createElement(M.Runner, {
        sc: scM,
        setup: { mode: 'exam', startedAt: Date.now(), coachStyle: 'silent' },
        onFinish: function () {}
      }));
      var examText = examMount.text();
      t.contains(examText, 'Exam', 'exam mode is badged');
      t.notContains(examText, 'What am I missing',
        'exam mode has no next-step prompt on screen');
      t.ok(!examMount.button(/^Hint$/), 'and no hint button at all');
      t.notContains(examText, 'crackles', 'and still no diagnosis clue');
      examMount.unmount();

      var coachMount = H.renderInto(W, React.createElement(C.CoachRunner, {
        sc: scM,
        setup: { mode: 'practice', startedAt: Date.now(), coachStyle: 'coach' },
        onFinish: function () {}
      }));
      var coachText = coachMount.text();
      t.contains(coachText, 'I did this', 'the coach bar has "I did this"');
      t.contains(coachText, 'Chart', 'and "Chart"');
      t.contains(coachText, 'What am I missing', 'and "What am I missing?"');
      t.contains(coachText, 'SBAR', 'and "SBAR"');
      t.contains(coachText, 'Reassess', 'and "Reassess"');
      t.contains(coachText, 'SIMULATION / MANNEQUIN PRACTICE ONLY',
        'the permanent bottom label is present');
      t.contains(coachText, 'NOT REAL-PATIENT CLINICAL DECISION SUPPORT',
        'in the exact words the spec is emphatic about');
      t.ok(!coachMount.button(/dismiss|close|hide|got it/i),
        'and there is no control that dismisses it');
      t.contains(coachText, 'microphone is off',
        'voice is off until it is explicitly switched on');
      t.ok(!!coachMount.button(/tap to listen/i), 'with an explicit control to switch it on');

      /* Vague utterance through the real coach surface. */
      var input = coachMount.find('input.spx-input');
      t.ok(!!input, 'the coach surface has a type-it-in fallback');
      if (input) {
        var wv = input.ownerDocument.defaultView;
        var setter = Object.getOwnPropertyDescriptor(
          wv.HTMLInputElement.prototype, 'value').set;
        actIn(function () {
          setter.call(input, 'I take care of the patient');
          input.dispatchEvent(new wv.Event('input', { bubbles: true }));
        });
        coachMount.click(coachMount.button(/^Mark it$/));
        var afterVague = coachMount.text();
        t.contains(afterVague, 'not a nursing action',
          'a vague statement is refused, out loud, in the coach surface');
        t.contains(afterVague, 'Nothing marked yet',
          'and nothing was added to the marked list from it');
      }
      coachMount.unmount();

      /* ================================================================== *
       * THE REAL CORPUS
       * ------------------------------------------------------------------
       * data/nur2212-scenarios.js is written by another module. If it is not
       * on disk yet this whole group is skipped rather than failed - the
       * fixture above already proves the engine. When it IS there, every one
       * of the twelve topics gets swept, because a data-shaped surprise
       * (a topic_specific intent whose label happens to contain a drug name,
       * say) is exactly the class of bug a fixture cannot find.
       * ================================================================== */
      t.group('the real 12-topic corpus');

      var corpusPath = path.join(H.APP_ROOT, 'data', 'nur2212-scenarios.js');
      if (!fs.existsSync(corpusPath)) {
        t.ok(true, 'data/nur2212-scenarios.js is not on disk yet - corpus sweep skipped');
      } else {
        var cw = H.makeWorld({ tier: 'pro' });
        cw.load('data/nur2212-scenarios.js');
        cw.load('js/simprep-sim.js');
        var RM = cw.window.SimPrepSimMode;
        var topics = RM.allScenarios();

        t.eq(topics.length, 12, 'all twelve NUR2212 topics load');
        t.ok(topics.every(function (s) { return !!String(s.topic_id); }),
          'every topic has an id');

        var falseMeds = [];
        var noThree = [];
        var leaks = [];
        var badMissing = [];

        topics.forEach(function (s) {
          var r = RM.initialRun(s, { startedAt: T0, mode: 'practice' });

          /* Mid-run: no unopened lab RESULT may appear in the debrief.
             ONE deliberate exception: the "Source issue - verify with
             instructor" panel quotes the school file verbatim, and
             SOURCE_RULES rule 2 requires exactly that ("do not silently repair
             a suspected typo - show it"). Those strings are also on the
             pre-brief before the run even starts, so they were never hidden
             information. They are excluded from the haystack here, and
             nowhere else. */
          var mid = RM.debriefText(r, s, r.opts);
          (s.source_discrepancies || []).forEach(function (issue) {
            mid = mid.split(String(issue)).join(' ');
          });
          (s.labs || []).forEach(function (l, i) {
            if (r.revealed['lab:' + i]) { return; }
            var val = String((l || {}).result || '').trim();
            if (val.length < 3) { return; }
            if (mid.indexOf(val) !== -1) {
              leaks.push(s.topic_id + ' :: ' + (l.test || '') + ' = ' + val);
            }
          });

          /* "What am I missing" is one thing, on every topic. */
          var one = RM.whatAmIMissing(r, s);
          if (!one || Array.isArray(one) || !one.intent) { badMissing.push(s.topic_id); }

          /* Perform every intent the sheet allows. None of a scenario's OWN
             intents may be read as an unordered medication - that would charge
             a safety penalty for doing exactly what the school file asks. */
          RM.allowedIntents(s).forEach(function (it, i) {
            var before = r.unsafe.length;
            r = RM.applyEvent(r, { type: RM.EVENTS.ACT, at: at(3 * (i + 1)), intent: it.id }, s);
            if (r.unsafe.length > before) {
              falseMeds.push(s.topic_id + ' :: ' + it.id + ' -> ' +
                r.unsafe[r.unsafe.length - 1].med);
            }
          });
          r = RM.applyEvent(r, { type: RM.EVENTS.SBAR, at: at(600),
            text: 'S B A R', sections: { s: 'a', b: 'b', a: 'c', r: 'd' } }, s);
          r = RM.applyEvent(r, { type: RM.EVENTS.END, at: at(700) }, s);

          var d = RM.buildDebrief(r, s, r.opts);
          if (d.remediation.length !== 3) {
            noThree.push(s.topic_id + ' (' + d.remediation.length + ')');
          }
          var sr = RM.scoreRun(r, s, r.opts);
          t.eq(sr.autoFailed, false, s.topic_id + ': no automatic course failure by default');
          t.ok(sr.possible > 0, s.topic_id + ': something is still scoreable');
          t.ok(sr.total <= sr.possible, s.topic_id + ': the score cannot exceed the denominator');
          t.ok(d.timeline.length > 0, s.topic_id + ': the timeline recorded the run');
        });

        t.deepEq(falseMeds, [],
          'no scenario-authored intent is misread as an unordered medication');
        t.deepEq(leaks, [],
          'no unopened lab result appears in a live debrief on any topic');
        t.deepEq(badMissing, [],
          '"What am I missing?" returns exactly one action on every topic');
        t.deepEq(noThree, [],
          'the remediation plan is exactly three items on every topic');

        dropWorld(cw, world);
      }

      var pickMount = H.renderInto(W, React.createElement(C, {
        progress: {}, setProgress: function () {}, authUser: null,
        isAdmin: false, isSuperAdmin: false, topicId: '', onNav: function () {}
      }));
      t.contains(pickMount.text(), 'Room / Checkoff Coach', 'the coach page renders its picker');
      t.contains(pickMount.text(), 'Supplemental',
        'and labels the supplemental topic, per SOURCE_RULES rule 7');
      pickMount.unmount();

      world.cleanup();
    });
  }
};
