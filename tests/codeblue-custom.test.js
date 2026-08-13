/* ============================================================================
   codeblue-custom.test.js
   ----------------------------------------------------------------------------
   The two things js/codeblue.js grew that a student's safety depends on:

     1. CUSTOM AI-BUILT SCENARIOS. A language model will hand you a beautifully
        written cardiac arrest with a potassium of 47 and a pediatric
        epinephrine dose ten times too big, and a nursing student has no reason
        to disbelieve either of them. Three gates stand between the model and
        the engine - parse, schema, clinical - and this suite asserts that all
        three actually stop something.

     2. PAUSE / RESUME. Simulated time is wall-clock time minus paused time, so
        a pause freezes every clock and a resume cannot fast-forward. The whole
        feature is one subtraction; the whole risk is that one subtraction being
        missed in one place, which is why the tests below check the CLOCK rather
        than the flag.

   Run:  node tests/run.js codeblue-custom
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./_harness.js');

/* Only real shipped modules. The working folder accumulates orphaned
   `.fuse_hidden*` files - stale copies the mount will not let us delete - and
   readdir returns them FIRST because dotfiles sort early. Reading one means
   sweeping a ghost copy of a module instead of the real one. Same filter as
   tests/ui-contrast.test.js, for the same reason. */
function moduleFiles() {
  return fs.readdirSync(path.join(H.APP_ROOT, 'js'))
    .filter(function (f) { return /\.js$/.test(f) && f.charAt(0) !== '.'; })
    .map(function (f) { return 'js/' + f; });
}
function read(rel) { return fs.readFileSync(path.join(H.APP_ROOT, rel), 'utf8'); }

/* ------------------------------------------------------------------ fixtures */

/** A generation that should pass every gate. Adult, PEA, hyperkalemia. */
function goodGeneration(over) {
  var g = {
    title: 'Refractory hyperkalemia arrest on dialysis day',
    short: 'Hyperkalemia / PEA',
    icon: '⚡',
    category: 'Medical-Surgical',
    patient: { name: 'Alma Fitch', age: 68, sex: 'female', weightKg: 78 },
    lead: 'Alma Fitch is 68 and missed her Tuesday dialysis because her ride never came. She has been on the ' +
          'unit since midnight with nausea and a heaviness in her legs she cannot explain. At 0530 she stops ' +
          'answering you. Her skin is grey and cool, her chest is not moving, and the monitor shows a wide, ' +
          'slow, oddly regular complex marching across the screen at about 40. You put two fingers on her ' +
          'carotid and hold them there for a full ten seconds. There is nothing under them.',
    initialRhythm: 'pea',
    prearrest: false,
    cause: 'hypokalemia',
    causeHint: 'A missed dialysis run, a wide slow complex and no pulse - check the potassium first.',
    handoff: 'the intensivist',
    vitals: { hr: 40, sbp: 74, dbp: 40, rr: 6, spo2: 84, tempC: 36.1, glucoseMgDl: 132 },
    labs: [
      { name: 'Potassium', value: 7.9, unit: 'mEq/L' },
      { name: 'Bicarbonate', value: 12, unit: 'mEq/L' }
    ],
    history: ['ESRD on hemodialysis', 'Type 2 diabetes'],
    teachingPoints: ['A wide complex plus a missed dialysis run is potassium until proven otherwise.']
  };
  if (over) { Object.keys(over).forEach(function (k) { g[k] = over[k]; }); }
  return g;
}

/** A long-enough lead-in without having to write another paragraph by hand. */
function padLead(sentence) {
  var out = '';
  while (out.length < 320) { out += sentence + ' '; }
  return out.trim();
}

function normalize(CB, raw, topic) {
  var hash = 'testhash' + String(topic || '').replace(/\W/g, '');
  return CB.normalizeGenerated(raw, { topic: topic || 'Hyperkalemia', hash: hash, caseId: 'custom-' + hash });
}

/** Everything a scenario has to survive before the engine will run it. */
function fullGate(CB, raw, topic) {
  var n = normalize(CB, raw, topic);
  var kase = CB.canonicalDoses(n.kase);
  var chk = CB.clinicalCheck(kase);
  return { kase: kase, schema: n.problems, clinical: chk };
}

/** Every problem string in one blob, so a test can ask "was X mentioned". */
function joined(list) { return (list || []).join(' || '); }

/* ---------------------------------------------------------------- the suite */

module.exports = {
  name: 'codeblue-custom — AI-built scenarios, the clinical gate, and pause/resume',

  run: function (t) {
    var db = H.makeFakeDb();
    var world = H.makeWorld({ tier: 'pro', db: db });
    var W = world.window;
    world.load('js/codeblue.js');
    var CB = W.CodeBlueMode;

    /* ==================================================================== */
    t.group('the module still loads and exports both surfaces');

    t.ok(typeof CB === 'function', 'window.CodeBlueMode is exported');
    ['generateCustomCase', 'normalizeGenerated', 'clinicalCheck', 'canonicalDoses',
     'parseJsonReply', 'completeTruncatedJSON', 'scenarioCacheKey', 'registerCase']
      .forEach(function (k) {
        t.ok(typeof CB[k] === 'function', 'exports ' + k + '()');
      });
    /* The shared pause convention: the same verb names sim-engine.js and
       ai-scenario.js expose, so MMPause.pauseAll() can stop all three. */
    ['pause', 'resume', 'togglePause', 'isPaused', 'canPause', 'onPauseChange', 'pauseStats']
      .forEach(function (k) {
        t.ok(typeof CB[k] === 'function', 'shared pause API: ' + k + '()');
      });
    ['pauseState', 'resumeState', 'stateIsPaused', 'statePausedMs', 'simNow']
      .forEach(function (k) {
        t.ok(typeof CB[k] === 'function', 'engine pause API: ' + k + '()');
      });
    t.eq(CB.PAUSE_EVENT, 'sim_pause', 'the pause transport event is sim_pause');
    t.eq(CB.RESUME_EVENT, 'sim_resume', 'the resume transport event is sim_resume');
    t.eq(CB.isPaused(), false, 'with nothing mounted the shared API says "not paused"');

    t.group('the module registers itself in the shared MMPause registry');
    t.ok(W.MMPause && typeof W.MMPause.pauseAll === 'function', 'window.MMPause exists with pauseAll()');
    t.ok(W.MMPause.get('codeblue'), 'a control is registered under the id "codeblue"');
    var ctl = W.MMPause.get('codeblue') || {};
    ['isActive', 'isPaused', 'canPause', 'pause', 'resume', 'toggle', 'stats', 'subscribe']
      .forEach(function (k) {
        t.ok(typeof ctl[k] === 'function', 'pauseControl.' + k + '() matches the shared shape');
      });
    t.noThrow(function () { W.MMPause.pauseAll('test'); W.MMPause.resumeAll(); },
      'pauseAll/resumeAll are harmless with no code mounted');

    /* Cross-module: whoever loads first defines the registry, so every engine
       that has a pause has to bootstrap it the same way. */
    t.group('every engine that pauses uses the same registry bootstrap');
    /* Only the modules that BOOTSTRAP the registry, not every file that reads
       it: whichever of them loads first defines the helpers, so they all have
       to define the same ones. */
    var pausers = moduleFiles().filter(function (f) { return /window\.MMPause\s*=/.test(read(f)); });
    t.ok(pausers.indexOf('js/codeblue.js') !== -1, 'js/codeblue.js registers a pause control');
    pausers.forEach(function (f) {
      var src = read(f);
      t.match(src, /reg\.register\(/, f + ' uses reg.register() rather than writing controls directly');
      t.match(src, /reg\.pauseAll\s*=/, f + ' defines pauseAll() if it is the first module to load');
    });

    /* ==================================================================== *
     * 1. THE SCHEMA GATE
     * ==================================================================== */
    t.group('schema gate: a good generation is accepted');

    var ok = fullGate(CB, goodGeneration(), 'Hyperkalemia');
    t.deepEq(ok.schema, [], 'a well-formed generation produces no schema problems');
    t.eq(ok.kase.aiGenerated, true, 'the case is flagged as machine-written');
    t.eq(ok.kase.initialRhythm, 'pea', 'the rhythm is carried through');
    t.eq(ok.kase.cause, 'hypokalemia', 'the reversible cause is one the engine grades');
    t.eq(ok.kase.prearrest, false, 'a pulseless rhythm is not marked pre-arrest');
    t.eq(ok.kase.patient, 'Alma Fitch, 68', 'patient is rendered the way every other case writes it');
    t.eq(ok.kase.pedi, false, 'a 68-year-old is not pediatric');
    t.ok(String(ok.kase.id).indexOf('custom-') === 0, 'the id is namespaced so it can never shadow a real case');

    t.group('schema gate: the engine can actually run what came back');
    var runnable = CB.createState({ caseId: ok.kase.id, customCase: ok.kase, difficulty: 'competent' });
    t.eq(runnable.caseId, ok.kase.id, 'createState adopts the generated case');
    t.eq(runnable.aiGenerated, true, 'state remembers that the case was generated');
    t.ok(runnable.customCase && runnable.customCase.lead === ok.kase.lead,
      'the whole case travels inside state - which is how a room shares one copy');
    t.eq(CB.caseById(ok.kase.id).title, ok.kase.title, 'caseById resolves the generated case');
    t.eq(CB.isGeneratedCase(CB.caseById(ok.kase.id)), true, 'and reports it as generated');
    t.eq(CB.caseById('vf-mi').title, 'VF arrest after an anterior MI',
      'a generated case cannot shadow a school-authored one');

    t.group('schema gate: a malformed generation is rejected, field by field');
    var bad = normalize(CB, {
      title: 'x',
      lead: 'too short',
      initialRhythm: 'flatline',
      cause: 'ghosts',
      patient: {}
    }, 'DKA');
    var badText = joined(bad.problems);
    t.ok(bad.problems.length >= 6, 'every missing or wrong field is reported (' + bad.problems.length + ')');
    t.contains(badText, 'patient.name', 'a missing name is caught');
    t.contains(badText, 'patient.age', 'a missing age is caught');
    t.contains(badText, 'weightKg', 'a missing weight is caught - every peds dose comes from it');
    t.contains(badText, 'title', 'a stub title is caught');
    t.contains(badText, '200 characters', 'a lead-in too short to set a scene is caught');
    t.contains(badText, 'flatline', 'a rhythm the engine does not know is named in the rejection');
    t.contains(badText, 'ghosts', 'a cause outside the H\'s and T\'s is named in the rejection');
    t.contains(badText, 'causeHint', 'a missing cause hint is caught');

    t.group('schema gate: garbage in never throws and never half-passes');
    [null, undefined, 0, '', 'not an object', [], { }, { patient: 'Bob' }, { labs: 'no' }]
      .forEach(function (junk, i) {
        t.noThrow(function () {
          var r = normalize(CB, junk, 'junk');
          CB.clinicalCheck(CB.canonicalDoses(r.kase));
        }, 'junk input #' + i + ' is survivable');
        t.ok(normalize(CB, junk, 'junk').problems.length > 0, 'junk input #' + i + ' is rejected');
      });

    t.group('schema gate: prearrest is a fact about the rhythm, not the model\'s opinion');
    var lied = normalize(CB, goodGeneration({
      initialRhythm: 'vt_pulse', prearrest: false, cause: 'hypokalemia'
    }), 'VT');
    t.eq(lied.kase.prearrest, true, 'a rhythm WITH a pulse forces prearrest true whatever the flag said');
    t.ok(['vf', 'vf_fine', 'pvt', 'pea', 'asystole'].indexOf(lied.kase.arrestRhythm) !== -1,
      'a pre-arrest case is given a real rhythm to deteriorate into');
    t.ok(String(lied.kase.arrestText).length > 10, 'and narration for the moment it does');

    t.group('schema gate: the lead-in must not hand over the answer');
    var spoiler = normalize(CB, goodGeneration({
      cause: 'tamponade',
      lead: padLead('The bedside ultrasound shows a cardiac tamponade and the team is standing around it.')
    }), 'Tamponade');
    t.contains(joined(spoiler.problems), 'names the reversible cause',
      'a lead-in that names the cause is rejected - finding it is the exercise');

    /* ==================================================================== *
     * 2. THE CLINICAL GATE
     * ==================================================================== */
    t.group('clinical gate: a sane case passes');
    t.eq(ok.clinical.ok, true, 'the good generation clears the clinical gate: ' + joined(ok.clinical.errors));
    t.deepEq(ok.clinical.errors, [], 'with no errors');

    t.group('clinical gate: the simulator owns every dose');
    var peds = fullGate(CB, goodGeneration({
      title: 'Pediatric septic arrest on the floor',
      category: 'Pediatrics',
      patient: { name: 'Ivo Marek', age: 4, sex: 'male', weightKg: 17 },
      initialRhythm: 'asystole', cause: 'hypoxia',
      causeHint: 'Children arrest from their lungs.',
      lead: padLead('The child is grey and unresponsive, his chest is not moving and the monitor is flat.'),
      vitals: { hr: 150, sbp: 60, dbp: 35, rr: 8, spo2: 70, tempC: 39.4, glucoseMgDl: 62 },
      labs: [{ name: 'Lactate', value: 9.1, unit: 'mmol/L' }]
    }), 'Sepsis');
    t.eq(peds.kase.pedi, true, 'a four-year-old is flagged pediatric');
    t.eq(peds.kase.epiMg, 0.17, '0.01 mg/kg of 17 kg is 0.17 mg, calculated not quoted');
    t.contains(peds.kase.epiText, '0.17 mg', 'and the dose the student is shown says so');
    t.eq(peds.clinical.ok, true, 'the pediatric case clears the gate: ' + joined(peds.clinical.errors));

    var epiOpts = CB.epiOptions(peds.kase);
    var right = epiOpts.filter(function (o) { return o.ok; })[0];
    t.eq(epiOpts.length, 4, 'the dose picker offers four options');
    t.contains(right.text, '0.17 mg', 'the CORRECT option is the weight-based dose for THIS child');
    t.contains(right.text, '0.01 mg/kg', 'and shows the rule it came from');
    t.eq(epiOpts.filter(function (o) { return o.ok; }).length, 1, 'exactly one option is correct');
    t.contains(CB.amioOptions(peds.kase, 0)[0].text, '85 mg', 'amiodarone is 5 mg/kg of 17 kg = 85 mg');
    /* The regression this replaced: a hard-coded 14 kg list that was correct
       for exactly one child and wrong for every generated one. */
    t.notContains(right.text, '0.14 mg', 'the old hard-coded 14 kg dose is gone');

    t.group('clinical gate: an out-of-range dose is caught and blocks the scenario');
    var tenX = fullGate(CB, goodGeneration({
      title: 'Pediatric arrest with a decimal slip',
      category: 'Pediatrics',
      patient: { name: 'Ivo Marek', age: 4, sex: 'male', weightKg: 17 },
      initialRhythm: 'asystole', cause: 'hypoxia',
      causeHint: 'Children arrest from their lungs.',
      lead: padLead('The child is grey and unresponsive and the monitor is flat.'),
      epiMg: 1.7,                               // ten times the right dose
      vitals: { hr: 150, sbp: 60, dbp: 35, rr: 8, spo2: 70, tempC: 39.4, glucoseMgDl: 62 },
      labs: []
    }), 'Sepsis');
    t.eq(tenX.clinical.ok, false, 'a 10x pediatric epinephrine dose fails the gate');
    t.contains(joined(tenX.clinical.errors), '1.7 mg', 'the wrong dose is named');
    t.contains(joined(tenX.clinical.errors), '0.17 mg', 'so is the right one');
    t.eq(tenX.kase.epiMg, 0.17, 'and the dose the engine would have used was already the correct one');

    t.group('clinical gate: a wrong dose written into the prose is caught too');
    var proseDose = fullGate(CB, goodGeneration({
      teachingPoints: ['Give epinephrine 10 mg IV push every three to five minutes.']
    }), 'Hyperkalemia');
    t.eq(proseDose.clinical.ok, false, 'an epinephrine dose in the text is checked against the real one');
    t.contains(joined(proseDose.clinical.errors), '10 mg', 'and the wrong number is quoted back');

    t.group('clinical gate: a weight-based dose that does not multiply out is caught');
    var mgkg = fullGate(CB, goodGeneration({
      teachingPoints: ['Amiodarone is dosed at 5 mg/kg, so for this patient that is 39 mg.']
    }), 'Hyperkalemia');
    t.eq(mgkg.clinical.ok, false, '5 mg/kg of 78 kg is 390 mg, not 39 mg');
    t.contains(joined(mgkg.clinical.errors), 'does not multiply out', 'and it says so plainly');

    t.group('clinical gate: an impossible vital sign is caught');
    var vitals = fullGate(CB, goodGeneration({
      vitals: { hr: 900, sbp: 60, dbp: 90, rr: 6, spo2: 84, tempC: 36.1, glucoseMgDl: 132 }
    }), 'Hyperkalemia');
    t.eq(vitals.clinical.ok, false, 'impossible vitals fail the gate');
    t.contains(joined(vitals.clinical.errors), 'heart rate of 900', 'a heart rate of 900 is named');
    t.contains(joined(vitals.clinical.errors), 'systolic must be above diastolic',
      'a blood pressure of 60/90 is named');

    var moreVitals = [
      { over: { spo2: 140 }, want: 'oxygen saturation', label: 'an SpO2 of 140%' },
      { over: { rr: 300 }, want: 'respiratory rate', label: 'a respiratory rate of 300' },
      { over: { tempC: 58 }, want: 'temperature', label: 'a temperature of 58 C' },
      { over: { glucoseMgDl: 9000 }, want: 'glucose', label: 'a glucose of 9000 mg/dL' },
      { over: { hr: 0 }, want: 'heart rate cannot be zero', label: 'a pre-arrest heart rate of zero' }
    ];
    moreVitals.forEach(function (c) {
      var v = { hr: 40, sbp: 74, dbp: 40, rr: 6, spo2: 84, tempC: 36.1, glucoseMgDl: 132 };
      Object.keys(c.over).forEach(function (k) { v[k] = c.over[k]; });
      var r = fullGate(CB, goodGeneration({ vitals: v }), 'Hyperkalemia');
      t.eq(r.clinical.ok, false, c.label + ' fails the gate');
      t.contains(joined(r.clinical.errors), c.want, c.label + ' is named in the rejection');
    });

    t.group('clinical gate: a lab value outside physiologic bounds is caught');
    var labs = fullGate(CB, goodGeneration({
      labs: [{ name: 'Potassium', value: 47, unit: 'mEq/L' }]
    }), 'Hyperkalemia');
    t.eq(labs.clinical.ok, false, 'a potassium of 47 fails the gate');
    t.contains(joined(labs.clinical.errors), 'Potassium', 'and the analyte is named');

    [['Sodium', 400], ['pH', 9.1], ['Hemoglobin', 90], ['Lactate', 400], ['INR', 90]].forEach(function (pair) {
      var r = fullGate(CB, goodGeneration({ labs: [{ name: pair[0], value: pair[1], unit: '' }] }), 'x');
      t.eq(r.clinical.ok, false, 'a ' + pair[0] + ' of ' + pair[1] + ' fails the gate');
    });

    t.group('clinical gate: a frightening but survivable ICU number is left alone');
    var scary = fullGate(CB, goodGeneration({
      labs: [
        { name: 'Potassium', value: 8.9, unit: 'mEq/L' },
        { name: 'pH', value: 6.85, unit: '' },
        { name: 'Lactate', value: 14.2, unit: 'mmol/L' },
        { name: 'Platelets', value: 11, unit: 'K/uL' }
      ],
      vitals: { hr: 28, sbp: 52, dbp: 30, rr: 38, spo2: 61, tempC: 34.1, glucoseMgDl: 41 }
    }), 'DIC');
    t.eq(scary.clinical.ok, true,
      'a genuinely critical patient is not rejected for being critical: ' + joined(scary.clinical.errors));

    t.group('clinical gate: a weight that cannot belong to that age is caught');
    var fatToddler = fullGate(CB, goodGeneration({
      category: 'Pediatrics',
      patient: { name: 'Ivo Marek', age: 3, sex: 'male', weightKg: 62 },
      initialRhythm: 'asystole', cause: 'hypoxia',
      lead: padLead('The child is grey and unresponsive and the monitor is flat.')
    }), 'Pediatric respiratory');
    t.eq(fatToddler.clinical.ok, false, 'a 62 kg three-year-old fails the gate');
    t.contains(joined(fatToddler.clinical.errors), 'does not go with an age',
      'because the pediatric dose is calculated from that weight');

    t.group('clinical gate: a refusal dressed up as a scenario is caught');
    var refusal = fullGate(CB, goodGeneration({
      lead: padLead('I am sorry, I cannot help with that request as an AI language model.')
    }), 'x');
    t.eq(refusal.clinical.ok, false, 'a model disclaimer never becomes a patient');

    t.group('clinical gate: things it cannot prove are warnings, not blocks');
    var odd = fullGate(CB, goodGeneration({
      labs: [{ name: 'Wibble factor', value: 3, unit: 'widgets' }]
    }), 'Hyperkalemia');
    t.eq(odd.clinical.ok, true, 'a lab it cannot range-check does not block the scenario');
    t.contains(joined(odd.clinical.warnings), 'Wibble', 'it says so instead, and the student is told');

    var mismatched = fullGate(CB, goodGeneration({ cause: 'hypothermia' }), 'GI bleed');
    t.eq(mismatched.clinical.ok, true, 'an odd cause for the topic is a warning, not a rejection');
    t.contains(joined(mismatched.clinical.warnings), 'GI bleed',
      'because "sepsis can arrest three ways" is true and the gate must not pretend otherwise');

    /* ==================================================================== *
     * 3. TRUNCATION SALVAGE
     * ==================================================================== */
    t.group('a reply cut off by the token ceiling is salvaged');
    var whole = JSON.stringify(goodGeneration());
    var cut = whole.slice(0, whole.length - 90);
    t.eq(CB.parseJsonReply(cut), null, 'the truncated reply does not parse as JSON');
    var salvaged = CB.completeTruncatedJSON(cut);
    t.ok(salvaged && typeof salvaged === 'object', 'completeTruncatedJSON recovers an object');
    t.eq(salvaged.initialRhythm, 'pea', 'the fields that survived the cut are intact');
    t.eq(salvaged.cause, 'hypokalemia', 'including the reversible cause');
    t.contains(salvaged.lead, 'Alma Fitch', 'and the lead-in');

    var midString = whole.slice(0, whole.indexOf('missed her Tuesday') + 8);
    var s2 = CB.completeTruncatedJSON(midString);
    t.ok(s2 === null || typeof s2 === 'object', 'a cut in the middle of a string never throws');

    t.group('salvage refuses to invent a scenario out of nothing');
    t.eq(CB.completeTruncatedJSON('{"title":"T","short":"s"'), null,
      'a salvage missing lead/rhythm/cause is rejected rather than half-loaded');
    t.eq(CB.completeTruncatedJSON('no json here at all'), null, 'prose is not salvageable');
    t.eq(CB.completeTruncatedJSON('{"a":1}'), null, 'a COMPLETE object is not a truncation - failure is elsewhere');
    t.eq(CB.completeTruncatedJSON('}]}{'), null, 'structurally broken input gives up rather than guessing');
    t.noThrow(function () {
      [null, undefined, 0, [], {}, '{', '{"a":"\\"', '{"a":[[[['].forEach(function (x) {
        CB.completeTruncatedJSON(x);
      });
    }, 'completeTruncatedJSON never throws');

    t.group('the normal parse ladder still handles the usual mess');
    t.eq(CB.parseJsonReply('```json\n{"a":1}\n```').a, 1, 'fenced JSON');
    t.eq(CB.parseJsonReply('Sure! Here you go:\n{"a":2}\nHope that helps.').a, 2, 'JSON wrapped in prose');
    t.eq(CB.parseJsonReply('{"a":3,}').a, 3, 'a trailing comma');
    t.eq(CB.parseJsonReply(''), null, 'an empty reply is null, not a throw');
    t.eq(CB.parseJsonReply('[1,2,3]'), null, 'an array is not a turn object');

    /* ==================================================================== *
     * 4. GENERATION, RETRY AND CACHE
     * ==================================================================== */
    var calls = [];
    function mockAi(replies) {
      var i = 0;
      W.MM.ai = {
        isAvailable: function () { return true; },
        chat: function (o) {
          calls.push(o);
          var r = replies[Math.min(i, replies.length - 1)];
          i++;
          return Promise.resolve(typeof r === 'function' ? r() : r);
        }
      };
    }

    var GOOD_REPLY = '```json\n' + JSON.stringify(goodGeneration()) + '\n```';
    var genOpts = { topic: 'Hyperkalemia', difficulty: 'expert', length: 'standard' };
    var hash = CB.scenarioCacheKey(genOpts);

    t.group('the cache key is content-addressed on topic + difficulty + length');
    t.match(hash, /^[0-9a-f]{32}$/, 'it is 32 hex characters, like the image and voice caches');
    t.eq(CB.scenarioCacheKey({ topic: '  HYPERKALEMIA ', difficulty: 'expert', length: 'standard' }), hash,
      'casing and stray whitespace do not make a new key');
    t.ok(CB.scenarioCacheKey({ topic: 'Hyperkalemia', difficulty: 'student', length: 'standard' }) !== hash,
      'a different difficulty is a different scenario');
    t.ok(CB.scenarioCacheKey({ topic: 'Hyperkalemia', difficulty: 'expert', length: 'brief' }) !== hash,
      'a different length is a different scenario');
    t.ok(CB.scenarioCacheKey({ topic: 'DKA', difficulty: 'expert', length: 'standard' }) !== hash,
      'a different topic is a different scenario');

    var stages = [];
    var first = null, second = null, repaired = null, hopeless = null, secondWorldHit = null;

    return Promise.resolve()
      .then(function () {
        t.group('generation: a clean reply becomes a playable case');
        calls.length = 0;
        mockAi([GOOD_REPLY]);
        return CB.generateCustomCase({
          topic: genOpts.topic, difficulty: genOpts.difficulty, length: genOpts.length, db: db,
          onProgress: function (s, a) { stages.push({ s: String(s), a: a }); }
        });
      })
      .then(function (r) {
        first = r;
        t.eq(r.ok, true, 'the generation succeeded: ' + String(r.error || ''));
        t.eq(r.source, 'generated', 'and it really was generated');
        t.eq(calls.length, 1, 'exactly one AI call');
        t.eq(String(calls[0].feature), 'codeblue',
          'billed and model-routed through the codeblue feature, like the narrator');
        t.eq(calls[0].json, true, 'strict JSON mode is requested');
        t.ok(Number(calls[0].maxTokens) >= 2000, 'with a ceiling big enough for a whole case');
        t.ok(stages.length >= 2, 'a visible progress state was reported (' + stages.length + ' steps)');
        t.contains(stages[0].s, 'already built', 'the first step is the cache lookup');
        t.contains(joined(stages.map(function (x) { return x.s; })), 'clinical numbers',
          'and the clinical gate is one of the steps the student sees');
        t.eq(r.kase.epiMg, 1, 'the adult arrest dose is the simulator\'s, not the model\'s');
      })
      .then(function () {
        t.group('cache: the shared and device rungs were both written');
        t.ok(!!W.localStorage.getItem('mm.codeblue.scenario.' + hash), 'the device cache holds the case');
        var rec = db.get('codeblue/scenarioCache/' + hash);
        t.ok(!!rec, 'the shared index at ' + CB.SCENARIO_CACHE_PATH + ' holds the case');
        t.eq((rec || {}).v, CB.SCENARIO_SCHEMA_VERSION, 'stamped with the schema version so a bump invalidates it');
        t.ok(!!((rec || {})['case'] || {}).lead, 'and the whole case, not just a pointer');
      })
      .then(function () {
        t.group('cache: a hit returns without a second AI call');
        calls.length = 0;
        return CB.generateCustomCase({ topic: '  hyperkalemia  ', difficulty: 'expert', length: 'standard', db: db });
      })
      .then(function (r) {
        second = r;
        t.eq(r.ok, true, 'the cached scenario came back');
        t.eq(r.cached, true, 'flagged as a cache hit');
        t.eq(calls.length, 0, 'and NOT ONE AI call was made');
        t.eq(r.kase.id, first.kase.id, 'it is the same case, not a lookalike');
        t.eq(r.kase.lead, first.kase.lead, 'byte for byte');
      })
      .then(function () {
        t.group('cache: a fresh page load still hits the shared index');
        /* A second world = a fresh module with an empty memory cache and an
           empty localStorage, but the same Firebase. This is the rung that
           makes one student's generation free for the whole cohort. */
        var w2 = H.makeWorld({ tier: 'pro', db: db });
        w2.load('js/codeblue.js');
        var calls2 = [];
        w2.window.MM.ai = {
          isAvailable: function () { return true; },
          chat: function (o) { calls2.push(o); return Promise.resolve(GOOD_REPLY); }
        };
        return w2.window.CodeBlueMode.generateCustomCase({
          topic: 'Hyperkalemia', difficulty: 'expert', length: 'standard', db: db
        }).then(function (r) {
          secondWorldHit = r;
          t.eq(r.ok, true, 'a brand-new client got the scenario');
          t.eq(r.source, 'shared', 'out of the shared Firebase index');
          t.eq(calls2.length, 0, 'with no AI call at all');
          t.eq(r.kase.title, first.kase.title, 'and it is the same patient the first student built');
          /* Restore the world under test - makeWorld pins global.window. */
          global.window = W;
          global.document = W.document;
        });
      })
      .then(function () {
        t.group('generation: a malformed reply is repaired rather than crashing the mode');
        calls.length = 0;
        mockAi([
          'I would be happy to help you with that!',                    // not JSON at all
          JSON.stringify(goodGeneration({ patient: { name: 'Bo', age: 70, sex: 'male' } })), // no weight
          JSON.stringify(goodGeneration({ title: 'Third time lucky arrest' }))
        ]);
        return CB.generateCustomCase({ topic: 'ARDS', difficulty: 'competent', length: 'brief', db: db });
      })
      .then(function (r) {
        repaired = r;
        t.eq(r.ok, true, 'the third attempt produced a usable scenario');
        t.eq(r.attempts, 3, 'after three attempts');
        t.eq(calls.length, 3, 'and three AI calls');
        t.contains(String(calls[1].messages[0].content), 'REJECTED',
          'the second attempt is told its predecessor was rejected');
        t.contains(String(calls[2].messages[0].content), 'weightKg',
          'and told exactly which field was the problem');
        t.eq(r.kase.title, 'Third time lucky arrest', 'the good one is the one that loaded');
      })
      .then(function () {
        t.group('generation: three bad attempts fail closed, with a sentence a student can read');
        calls.length = 0;
        mockAi(['not json', 'still not json', 'nope']);
        return CB.generateCustomCase({ topic: 'DIC', difficulty: 'student', length: 'brief', db: db });
      })
      .then(function (r) {
        hopeless = r;
        t.eq(r.ok, false, 'nothing loaded');
        t.eq(r.attempts, CB.GEN_MAX_ATTEMPTS, 'it stopped at the attempt ceiling');
        t.eq(calls.length, CB.GEN_MAX_ATTEMPTS, 'and did not keep paying for retries');
        t.ok(String(r.error).length > 20, 'there is an error sentence');
        t.contains(r.error, 'Nothing was loaded', 'that says nothing was loaded');
        t.notContains(r.error, 'undefined', 'and is not a stack trace');
        t.eq(db.get('codeblue/scenarioCache/' + CB.scenarioCacheKey({
          topic: 'DIC', difficulty: 'student', length: 'brief'
        })), null, 'a failed generation is never cached');
      })
      .then(function () {
        t.group('generation: a clinically unsafe scenario is regenerated, never shown');
        calls.length = 0;
        var unsafe = goodGeneration({
          category: 'Pediatrics',
          patient: { name: 'Ivo Marek', age: 4, sex: 'male', weightKg: 17 },
          epiMg: 1.7,
          labs: [{ name: 'Potassium', value: 47, unit: 'mEq/L' }]
        });
        mockAi([JSON.stringify(unsafe), JSON.stringify(unsafe), JSON.stringify(unsafe)]);
        return CB.generateCustomCase({ topic: 'Sepsis', difficulty: 'student', length: 'brief', db: db });
      })
      .then(function (r) {
        t.eq(r.ok, false, 'a scenario that keeps failing the clinical gate never becomes playable');
        t.eq(joined(r.problems).indexOf('47') !== -1, true, 'and the problems name the impossible value');
        t.contains(String(calls[1].messages[0].content), '47',
          'the model is told the exact number that was rejected');
      })
      .then(function () {
        t.group('generation: no AI, no crash');
        W.MM.ai = { isAvailable: function () { return false; }, chat: function () { throw new Error('nope'); } };
        return CB.generateCustomCase({ topic: 'Liver failure', difficulty: 'student', length: 'brief', db: db });
      })
      .then(function (r) {
        t.eq(r.ok, false, 'it fails');
        t.ok(String(r.error).length > 10, 'with a sentence rather than an exception');
      })
      .then(function () {
        t.group('generation: an empty topic is refused before anything is spent');
        calls.length = 0;
        mockAi([GOOD_REPLY]);
        return CB.generateCustomCase({ topic: '   ', difficulty: 'student', length: 'brief', db: db });
      })
      .then(function (r) {
        t.eq(r.ok, false, 'an empty topic does not generate');
        t.eq(calls.length, 0, 'and costs nothing');
      })
      .then(function () {
        t.group('generation: it works with no database at all');
        calls.length = 0;
        mockAi([GOOD_REPLY]);
        W.MM.db = null;
        return CB.generateCustomCase({ topic: 'Anaphylaxis', difficulty: 'student', length: 'brief', db: null });
      })
      .then(function (r) {
        t.eq(r.ok, true, 'a signed-in student with no room server can still build one');
        W.MM.db = db;
      })

      /* ================================================================== *
       * 5. PAUSE - SOLO
       * ================================================================== */
      .then(function () {
        t.group('pause: the clock freezes and resume does not fast-forward');

        var T0 = 1700000000000;
        var st = CB.createState({ caseId: 'vf-mi', solo: true, seed: 'pause-seed' });
        CB.assignRoles(st, ['u1']);
        function sim(real) { return CB.simNow(st, real); }
        function ev(type, real, payload) {
          CB.applyEvent(st, { type: type, uid: 'u1', realT: real, payload: payload || {} }, sim(real));
        }

        ev('start', T0);
        CB.tick(st, sim(T0 + 30000));
        t.eq(st.phase, 'running', 'the code is running');
        t.eq(sim(T0 + 30000) - st.cycleStartedAt, 30000, 'thirty seconds into the first cycle');

        ev('sim_pause', T0 + 30000, { name: 'Ada' });
        t.eq(CB.stateIsPaused(st), true, 'the code is paused');
        t.eq(st.pausedByName, 'Ada', 'and the state names who paused it');
        t.eq(st.pauseCount, 1, 'one pause so far');

        var LATER = T0 + 30000 + 300000;         // five real minutes go by
        t.eq(sim(LATER), T0 + 30000, 'simulated time is frozen for the whole pause');
        t.eq(CB.statePausedMs(st, LATER), 300000, 'and the paused duration is measured');

        var before = JSON.stringify({ p: st.phase, c: st.cycle, r: st.rhythm, tick: st.tickAt, cpr: st.cprMs });
        CB.tick(st, sim(LATER));
        t.eq(JSON.stringify({ p: st.phase, c: st.cycle, r: st.rhythm, tick: st.tickAt, cpr: st.cprMs }), before,
          'ticking during a pause advances nothing - not the cycle, not the rhythm, not the CPR clock');

        ev('iv', LATER);
        t.eq(st.iv, false, 'an action submitted during a pause is swallowed, not queued');
        ev('epi', LATER, { optId: 'a' });
        t.eq(st.epi, 0, 'and so is a drug');

        ev('sim_pause', LATER, { name: 'Bo' });
        t.eq(st.pauseCount, 1, 'a second person pausing an already-paused code is a no-op');
        t.eq(st.pausedByName, 'Ada', 'and the first person keeps the credit');

        ev('sim_resume', T0 + 30000 + 100, { name: 'Ada' });
        t.eq(CB.stateIsPaused(st), true, 'a resume inside the double-tap window is ignored');

        ev('sim_resume', LATER, { name: 'Bo' });
        t.eq(CB.stateIsPaused(st), false, 'the code is running again');
        t.eq(st.pausedTotalMs, 300000, 'the five paused minutes are banked separately');
        t.eq(st.pausedAt, 0, 'and the pause instant is cleared');

        /* THE POINT OF ALL OF THIS. */
        t.eq(sim(LATER) - st.cycleStartedAt, 30000,
          'we are still thirty seconds into the cycle - the pause did not advance it');
        CB.tick(st, sim(LATER + 1000));
        t.eq(st.phase, 'running', 'one tick after resume does not fast-forward into a rhythm check');
        t.eq(st.cycle, 1, 'and does not skip the two and a half cycles the pause was long enough to hide');

        CB.tick(st, sim(LATER + 91000));
        t.eq(st.phase, 'check', 'the rhythm check arrives at two minutes of SIMULATED time, on schedule');
        t.eq(st.cycle, 1, 'still in cycle one when it does');

        t.group('pause: scoring on timeliness is not distorted');
        var m = CB.teamMetrics(st);
        t.eq(m.pausedMs, 300000, 'the debrief knows how long the code was paused');
        t.eq(m.pauseCount, 1, 'and how many times');
        t.eq(m.durationMs, 121000, 'but the code lasted 2:01 of simulated time, not 7:01');
        t.ok(m.durationMs < 300000, 'the paused five minutes are absent from the duration');
      })

      .then(function () {
        t.group('pause: only inside a running code');
        var st2 = CB.createState({ caseId: 'vf-mi', solo: true, seed: 's2' });
        CB.assignRoles(st2, ['u1']);
        t.eq(CB.pauseState(st2, 1000, 'u1', 'Ada'), false, 'a code in the briefing cannot be paused');
        t.eq(CB.stateIsPaused(st2), false, 'and does not think it is');
        CB.applyEvent(st2, { type: 'start', uid: 'u1', realT: 1000 }, 0);
        t.eq(CB.pauseState(st2, 2000, 'u1', 'Ada'), true, 'a running code can be');
        t.eq(CB.resumeState(st2, 3000, 'u1', 'Ada'), true, 'and resumed');
        t.eq(CB.resumeState(st2, 4000, 'u1', 'Ada'), false, 'resuming a running code is a no-op that says so');
        t.eq(CB.statePausedMs(st2, 9999), 1000, 'the banked pause is exactly the wall time it took');

        t.group('pause: the log records both ends of it');
        var texts = (st2.log || []).map(function (l) { return l.kind + ':' + l.text; }).join(' || ');
        t.contains(texts, 'pause:', 'the pause is logged');
        t.contains(texts, 'Ada paused', 'by name');
        t.contains(texts, 'restarted the code', 'and so is the restart');

        t.group('pause: hands come off the chest the moment it freezes');
        var st3 = CB.createState({ caseId: 'vf-mi', solo: true, seed: 's3' });
        CB.assignRoles(st3, ['u1']);
        CB.applyEvent(st3, { type: 'start', uid: 'u1', realT: 1000 }, 0);
        CB.feedCpr(st3, 5000, { rate: 110, at: 5000 });
        t.eq(st3.cprOn, true, 'compressions are in progress');
        CB.pauseState(st3, 6000, 'u1', 'Ada');
        t.eq(st3.cprOn, false, 'pausing takes hands off the chest');
        t.eq(st3.cprRate, 0, 'and zeroes the rate, so the pause is not credited as perfect CPR');
      })

      /* ================================================================== *
       * 6. PAUSE - MULTIPLAYER
       * ================================================================== */
      .then(function () {
        t.group('pause is shared room state, not a local flag');
        var T0 = 1700000000000;
        var host = CB.createState({ caseId: 'pea-gi', seed: 'room-seed', teamSize: 3 });
        CB.assignRoles(host, ['host', 'p2', 'p3']);
        CB.applyEvent(host, { type: 'start', uid: 'host', realT: T0 }, CB.simNow(host, T0));
        CB.tick(host, CB.simNow(host, T0 + 20000));

        /* p3 holds no lead role and is not the host. Anybody may stop a drill. */
        CB.applyEvent(host, { type: 'sim_pause', uid: 'p3', realT: T0 + 20000, payload: { name: 'Kai' } },
          CB.simNow(host, T0 + 20000));
        t.eq(CB.stateIsPaused(host), true, 'a non-host, non-lead participant can pause the room');
        t.eq(host.pausedBy, 'p3', 'and the room records whose finger it was');
        t.eq(host.pausedByName, 'Kai', 'by name, so nobody has to ask on the voice channel');

        t.group('a late joiner sees a paused room as paused');
        /* Exactly what a client receives: the host state, scrubbed for RTDB and
           round-tripped through JSON. Nothing else reaches a joining client. */
        var overWire = JSON.parse(JSON.stringify(host));
        t.eq(CB.stateIsPaused(overWire), true, 'the snapshot says paused');
        t.eq(overWire.pausedByName, 'Kai', 'and says who');
        var MUCH_LATER = T0 + 20000 + 600000;
        t.eq(CB.simNow(overWire, MUCH_LATER), T0 + 20000,
          'a client that joins ten minutes into a pause computes the same frozen clock as everyone else');
        t.eq(CB.simNow(overWire, MUCH_LATER) - overWire.cycleStartedAt, 20000,
          'and shows the same 20 seconds into the cycle the rest of the room is looking at');
        t.eq(CB.statePausedMs(overWire, MUCH_LATER), 600000, 'while still counting how long it has been paused');

        t.group('the render a late joiner actually gets');
        var el = W.React.createElement(CB.GameScreen, {
          st: overWire,
          players: {
            host: { name: 'Ada', connected: true, joinedAt: 1 },
            p2: { name: 'Bo', connected: true, joinedAt: 2 },
            p3: { name: 'Kai', connected: false, joinedAt: 3 }
          },
          myUid: 'p2', myName: 'Bo',
          send: function () {},
          isHost: false, solo: false
        });
        var r = H.renderInto(W, el);
        var text = r.text();
        t.contains(text, 'Paused by Kai', 'the joining client is told the room is paused and by whom');
        t.contains(text, 'has dropped off', 'and that the person who paused it is no longer connected');
        t.contains(text, 'Resume the code', 'with a control to restart it - the room cannot be stuck');
        t.contains(text, 'Nothing moves', 'and the action panel says so too');
        var live = r.all('button').filter(function (b) {
          return !b.disabled && /Order a rhythm check|Establish IV|Charge to|Deliver the shock|Connect oxygen/.test(b.textContent || '');
        });
        t.eq(live.length, 0, 'every code action is disabled while the room is paused');
        r.unmount();
      })

      /* ================================================================== *
       * 7. THE AI LABEL
       * ================================================================== */
      .then(function () {
        t.group('a generated case is labelled everywhere it appears');
        var kase = first.kase;
        var st = CB.createState({ caseId: kase.id, customCase: kase, difficulty: 'competent', maxCycles: 7 });
        CB.assignRoles(st, ['u1']);
        t.eq(st.maxCycles, 7, 'the chosen length really is the number of cycles the engine will run');

        var r = H.renderInto(W, W.React.createElement(CB.GameScreen, {
          st: st, players: { u1: { name: 'Ada', connected: true } },
          myUid: 'u1', myName: 'Ada', send: function () {}, isHost: true, solo: true, canStart: true
        }));
        var text = r.text();
        t.contains(text, 'AI-built scenario', 'the briefing carries the badge');
        t.contains(text, 'written by AI from the topic you typed, not by your school',
          'and says plainly where the content came from');
        t.contains(text, 'range-checked', 'and what was and was not verified');
        t.contains(text, kase.title, 'alongside the case itself');
        t.contains(text, 'Alma Fitch', 'and the patient');
        t.contains(text, '7.9', 'with the labs it was checked against on screen');
        r.unmount();

        t.group('and it is written into the saved result, not just onto the screen');
        var saved = null;
        st.phase = 'ended';
        st.outcome = 'death';
        st.startedAt = 1000;
        st.endedAt = 200000;
        st.tickAt = 200000;
        var rec = CB.persistResult(st, CB.scoreForPlayer(st, 'u1'), 'u1', 'Ada', db, function (fn) {
          saved = fn({});
        });
        t.eq(rec.aiGenerated, true, 'the progress record is flagged as machine-generated');
        t.eq(rec.topic, 'Hyperkalemia', 'and remembers the topic it was built from');
        t.ok(saved && saved.simResults && saved.simResults[0].aiGenerated === true,
          'so a dashboard can never launder generated reps into school-authored ones');
      })

      .then(function () {
        t.group('school-authored cases are NOT labelled as generated');
        var st = CB.createState({ caseId: 'vf-mi', solo: true, seed: 'plain' });
        CB.assignRoles(st, ['u1']);
        t.eq(st.aiGenerated, false, 'state does not claim a written case was generated');
        var r = H.renderInto(W, W.React.createElement(CB.GameScreen, {
          st: st, players: { u1: { name: 'Ada', connected: true } },
          myUid: 'u1', myName: 'Ada', send: function () {}, isHost: true, solo: true, canStart: true
        }));
        t.notContains(r.text(), 'AI-built scenario', 'and the badge is absent');
        r.unmount();
      })

      .then(function () {
        t.group('the quick-picks cover what the student asked for');
        var labels = CB.TOPIC_CHIPS.map(function (c) { return c.label.toLowerCase(); }).join(' | ');
        ['hhs', 'dka', 'ards', 'sepsis', 'increased icp', 'dic', 'gi bleed', 'heart failure',
         'pulmonary embolism', 'liver failure', 'anaphylaxis', 'hyperkalemia'].forEach(function (want) {
          t.contains(labels, want, 'there is a chip for ' + want);
        });
        t.eq(CB.GEN_DIFFS.map(function (d) { return d.id; }).join(','), 'student,competent,expert',
          'difficulty is offered as student / competent / expert');
        CB.GEN_DIFFS.forEach(function (d) {
          t.ok(CB.DIFFS.filter(function (x) { return x.id === d.engine; }).length === 1,
            d.id + ' maps onto a difficulty the engine actually implements (' + d.engine + ')');
        });
        t.eq(CB.GEN_LENGTHS.length, 3, 'three estimated lengths');
        CB.GEN_LENGTHS.forEach(function (l) {
          t.ok(l.cycles >= 2 && l.cycles <= 20, l.id + ' is a real cycle count (' + l.cycles + ')');
        });
      })

      .then(function () {
        t.group('the prompt tells the model the rules that matter');
        var sys = String(CB.SCENARIO_SYSTEM);
        t.contains(sys, 'ONE JSON object', 'strict JSON only');
        t.contains(sys, 'Never state a medication dose', 'the simulator owns every dose');
        t.contains(sys, 'physiologically possible', 'and every number has to be possible');
        t.contains(sys, 'PRACTICE', 'the model is told this is a drill, not a patient');
        CB.HT_LIST.forEach(function (h) {
          t.contains(sys, h.id, 'the cause id "' + h.id + '" is offered to the model');
        });
        Object.keys(CB.RHYTHMS).filter(function (k) { return k !== 'sinus'; }).forEach(function (k) {
          t.contains(sys, k, 'the rhythm id "' + k + '" is offered to the model');
        });
      })

      .then(function () {
        t.group('the entry UI: a custom-scenario path inside the lobby');
        W.MM.ai = { isAvailable: function () { return true; }, chat: function () { return Promise.resolve('{}'); } };
        var r = H.renderInto(W, W.React.createElement(W.CodeBlueLobby, {
          db: db, myUid: 'u1', myName: 'Ada',
          onEnterRoom: function () {}, onSolo: function () {}
        }));
        t.contains(r.text(), 'Build one with AI', 'the lobby offers a custom-scenario path');
        t.contains(r.text(), 'Written for your school', 'alongside the school-authored cases');

        r.click(r.button(/Build one with AI/));
        var panel = r.text();
        t.contains(panel, 'What do you want to practise', 'with a free-text box');
        ['HHS', 'DKA', 'ARDS', 'Sepsis', 'Acute increased ICP', 'DIC', 'GI bleed', 'Heart failure',
         'Pulmonary embolism', 'Liver failure', 'Anaphylaxis', 'Hyperkalemia'].forEach(function (chip) {
          t.contains(panel, chip, 'and a quick-pick chip for ' + chip);
        });
        t.contains(panel, 'Student', 'difficulty: student');
        t.contains(panel, 'Competent', 'difficulty: competent');
        t.contains(panel, 'Expert', 'difficulty: expert');
        t.contains(panel, 'two-minute cycles', 'and an estimated length in real cycles');
        t.contains(panel, 'range-checked', 'the panel says the output is checked before it loads');

        t.group('nothing can start on the custom path until something is built');
        t.contains(panel, 'Build the scenario above first', 'the lobby says why it is blocked');
        var create = r.button(/Create the room/);
        t.ok(create && create.disabled, 'and the create button is disabled');
        var build = r.button(/Build the scenario/);
        t.ok(build && build.disabled, 'as is Build, until a topic is typed or picked');
        r.unmount();
      })

      .then(function () {
        t.group('a mounted code answers the shared MMPause control');
        var built = first.kase;
        var mounted = H.renderInto(W, W.React.createElement(CB, {
          authUser: { uid: 'u1', email: 'ada@example.edu', displayName: 'Ada' }
        }));
        t.eq(W.MMPause.get('codeblue').isActive(), false, 'the lobby is not a running code');
        t.eq(W.MMPause.get('codeblue').canPause(), false, 'so there is nothing to pause');
        t.noThrow(function () { W.MMPause.pauseAll('fire alarm'); }, 'pauseAll from the lobby is harmless');
        mounted.unmount();

        /* And the engine-level equivalent on a state built from the generated
           case, which is the path a solo run takes. */
        var st = CB.createState({ caseId: built.id, customCase: built, maxCycles: 4 });
        CB.assignRoles(st, ['u1']);
        CB.applyEvent(st, { type: 'start', uid: 'u1', realT: 1000 }, CB.simNow(st, 1000));
        t.eq(CB.pauseState(st, 2000, 'u1', 'Ada'), true, 'a generated scenario pauses like any other');
        t.eq(CB.resumeState(st, 12000, 'u1', 'Ada'), true, 'and resumes');
        t.eq(st.pausedTotalMs, 10000, 'banking the ten seconds');
        t.eq(CB.simNow(st, 12000), 2000, 'with simulated time held where the pause started');
      })

      .then(function () {
        t.group('the shared cache rule is published for the ruleset to adopt');
        /* The cache lives under a path firebase-rules.json does not yet cover,
           and this module does not own that file. The snippet is exported so
           the rule can be pasted in; until it is, rungs 1 and 2 carry the load
           and rung 3 misses silently. That is asserted, not assumed. */
        var rules = String(CB.SCENARIO_CACHE_RULES);
        t.contains(rules, 'scenarioCache', 'the snippet names the path');
        t.contains(rules, '.read', 'and grants a read');
        t.noThrow(function () { JSON.parse('{' + rules.replace(/^"codeblue":\s*\{|\}$/g, '') + '}'); },
          'the snippet is well-formed JSON once pasted');
        t.eq(CB.SCENARIO_CACHE_PATH, 'codeblue/scenarioCache', 'and matches the path actually written');
      })

      .then(function () {
        world.cleanup();
      }, function (e) {
        try { world.cleanup(); } catch (x) {}
        throw e;
      });
  }
};
