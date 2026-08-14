/* =============================================================================
 * data/medsim-scenarios.js  ->  window.MEDSIM_SCENARIOS
 * -----------------------------------------------------------------------------
 * MedSimScenario objects per MEDSIM_SPEC/architecture.md §9. Phase-1 ships
 * exactly one: `medsim_mar12_oxycodone`, an ORAL-only scenario (no injections,
 * no sharps, no distractions, no calculation trap) per §13's MVP scope.
 *
 * REUSE, DON'T RE-DERIVE (architecture.md's own instruction). Every clinical
 * value below is read at load time from the already-verified source data:
 *   - patient / vitals / MRN / MAR colour+times  <- window.SIGNOFF_MARS `mar12`
 *   - drug class, hold parameters, teaching       <- window.SIGNOFF_DRUGS `percocet`
 * Nothing clinical is retyped. Inline fallbacks exist ONLY so the module still
 * renders if those files failed to load (script-order accident); they are
 * byte-identical copies of the same source values, and `dataSource` on the
 * scenario records which path actually ran so the UI can say so honestly.
 * This file's <script> tag must load AFTER data/signoff-mars.js and
 * data/signoff-drugs.js.
 *
 * The one fabricated value: DATE OF BIRTH. The mar12 photo carries no DOB, but
 * two-identifier verification needs one (the rubric says "name & date of birth
 * (NOT room number or age)"). architecture.md Open Question 1 resolved this by
 * fabricating a DOB consistent with age 77 and having the patient state it when
 * asked. It is listed in `fabricatedFactKeys` so the UI can label it as
 * simulation content rather than a chart fact. The value here (June 2, 1948)
 * matches MedSimScenarioData.swift verbatim — §17 requires scenario content to
 * stay identical across platforms.
 * ========================================================================== */
(function () {
  'use strict';

  function findById(list, id) {
    var l = list || [];
    for (var i = 0; i < l.length; i++) { if (l[i] && l[i].id === id) { return l[i]; } }
    return null;
  }

  var mar12 = findById(window.SIGNOFF_MARS, 'mar12');
  var percocet = findById(window.SIGNOFF_DRUGS, 'percocet');

  /* ---- patient / chart, read from mar12 where available -------------------- */

  var patientSrc = (mar12 && mar12.patient) || {
    name: 'Eric Doe', age: 77, sex: 'M', weightKg: 72,
    codeStatus: 'Full Code', allergies: ['NKDA'], iv: ['LFA #20']
  };
  var mrn        = (mar12 && mar12.mrn) || '00012';
  var admitDx    = (mar12 && mar12.admittingDx) || 'Chronic Pain';
  var pmh        = (mar12 && mar12.pmh) || ['Chronic Constipation', 'kyphoplasty', 'Hypertension'];
  var vitalsSrc  = (mar12 && mar12.vitals) || {
    bp: '114/79', hr: 77, rr: 22, temp: '99.0 F', spo2: 95, painScore: null,
    notes: 'Pt AOX4, ambulate by self, right great toe lesion with purulent drainage, fistula RUE, bruit and thrill present.'
  };
  var simTime    = (mar12 && mar12.currentTime) || '12:00';

  /* ---- the single ordered medication, read from mar12.meds[rxKey=percocet] -- */

  var medSrc = null;
  if (mar12 && mar12.meds) {
    for (var i = 0; i < mar12.meds.length; i++) {
      if (mar12.meds[i] && mar12.meds[i].rxKey === 'percocet') { medSrc = mar12.meds[i]; break; }
    }
  }
  var orderText     = (medSrc && medSrc.orderText) || 'Oxycodone/Acetaminophen 5/325 mg by mouth every 4 hours';
  var scheduledTime = (medSrc && medSrc.scheduledTimes && medSrc.scheduledTimes[0]) || '12:00';
  var givenTimes    = (medSrc && medSrc.givenTimes) ? medSrc.givenTimes.slice() : ['07:23'];
  var marColor      = (medSrc && medSrc.color) || 'yellow';
  var marNotes      = (medSrc && medSrc.notes) ||
    'Q4h. Last given 0723 (green). Yellow at 1200 - due now (window 1100-1300).';

  /* ---- hold parameters, read from the percocet drug entry ------------------ */

  var holdConditions = (percocet && percocet.holdParameters)
    ? percocet.holdParameters.slice()
    : ['RR <12', 'Sedation scale >=3', 'SpO2 <92% on room air'];

  var SCENARIOS = [
    {
      id: 'medsim_mar12_oxycodone',
      title: 'Eric Doe — Oxycodone/Acetaminophen 5/325mg PO',
      difficulty: 'beginner',

      /* Provenance: 'source' when the signoff data files were loaded and read,
         'fallback' when the inline copies were used. Rendered in the hub so a
         mis-ordered script tag is visible rather than silent. */
      dataSource: (mar12 && percocet) ? 'source' : 'fallback',

      patient: {
        name: patientSrc.name,
        dob: '06/02/1948',            // fabricated — see file header + fabricatedFactKeys
        age: patientSrc.age,
        sex: patientSrc.sex,
        weightKg: patientSrc.weightKg,
        codeStatus: patientSrc.codeStatus,
        allergies: (patientSrc.allergies || ['NKDA']).slice(),
        mrn: mrn,
        iv: (patientSrc.iv || []).slice(),
        admittingDx: admitDx,
        pmh: (pmh || []).slice(),
        room: '412'                   // presentational only; explicitly NOT a valid identifier
      },

      environment: {
        locations: ['hallway', 'bedside', 'med_room', 'prep_area', 'documentation_station'],
        dispenserStyle: 'cart_outside'
      },

      orders: [
        {
          medId: 'percocet',
          orderText: orderText,
          scheduledTime: scheduledTime,
          route: 'PO',
          prn: false
        }
      ],

      mar: [
        { medId: 'percocet', color: marColor, givenTimes: givenTimes, notes: marNotes }
      ],

      vitals: {
        bp: vitalsSrc.bp,
        hr: vitalsSrc.hr,
        rr: vitalsSrc.rr,
        temp: vitalsSrc.temp,
        spo2: vitalsSrc.spo2,
        notes: vitalsSrc.notes
      },
      labs: {},                        // mar12 has no labs; pre_admin_assessment resolves on vitals

      assessment: { relevantTo: ['vitals', 'ability_to_swallow', 'sedation_level'] },

      medicationsAvailable: ['percocet'],
      drugGuideEntries: ['percocet'],
      expectedAssessments: [
        'Verify respiratory rate and sedation level before administering (opioid).',
        'Confirm the patient can swallow a PO tablet safely.',
        'Review total daily acetaminophen intake from all sources (APAP ceiling).'
      ],

      holdParameters: holdConditions.map(function (c) {
        return { medId: 'percocet', condition: c };
      }),
      criticalConditions: [],

      /* §8 reveal-gating source of truth. The ENGINE owns these values; the
         patient-reply model only ever sees the subset the student has already
         asked about (see js/medsim.js buildPatientReplySystemPrompt). */
      patientFacts: [
        { key: 'name', value: 'Eric Doe' },
        { key: 'dob', value: 'June 2, 1948' },
        { key: 'allergies', value: 'No known drug allergies.' },
        { key: 'pain_level', value: 'About a 6 out of 10 — a dull ache in my lower back, I\'ve had it a long time.' },
        { key: 'understanding_of_med', value: 'I know it\'s for my back pain — the same pill I\'ve been getting.' },
        { key: 'admitting_reason', value: 'I\'m in for my chronic back pain, I had a kyphoplasty a while back.' },
        { key: 'last_dose_time', value: 'I think I got a pill early this morning, maybe around 7.' },
        { key: 'constipation_history', value: 'Yes, I have ongoing trouble with constipation — I take something for it.' },
        { key: 'code_status', value: 'Full code, as far as I know.' }
      ],
      patientPersona: {
        tone: 'calm, a little tired, cooperative but soft-spoken — an elderly man managing chronic pain',
        behaviors: [
          'May mention that his back hurts if asked how he\'s feeling, but does not volunteer anything else unprompted.',
          'If asked something outside his known facts, politely says he isn\'t sure and suggests checking with the nurse or his chart.',
          'Never states a fact he hasn\'t been asked about, even if it would help the student.'
        ]
      },

      distractions: [],

      /* §13: injection/sharps/distraction machinery exists in the engine but this
         scenario does not exercise it, so those criteria are excluded from the
         denominator rather than scored 0. `special_precautions` is deliberately
         NOT overridden — this opioid has real hold parameters (RR, sedation),
         so it IS scored. Matches MedSimScenarioData.swift exactly. */
      rubricOverrides: [
        { criterionId: 'sharps_violation', notApplicable: true },
        { criterionId: 'injection_technique', notApplicable: true },
        { criterionId: 'limiting_distractions', notApplicable: true }
      ],

      requiresCalculation: false,
      expiredMedicationPresent: false,

      /* Sim-clock reading at t=0. right_time maps elapsed ms onto this. */
      currentSimTime: simTime,

      /* Fact keys whose value is scenario fabrication, not a real chart fact. */
      fabricatedFactKeys: ['dob']
    }
  ];

  window.MEDSIM_SCENARIOS = SCENARIOS;
})();
