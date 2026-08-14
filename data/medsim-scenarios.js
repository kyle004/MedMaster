/* =============================================================================
 * data/medsim-scenarios.js  ->  window.MEDSIM_SCENARIOS
 * -----------------------------------------------------------------------------
 * MedSimScenario objects per MEDSIM_SPEC/architecture.md section 9.
 *
 * REUSE, DON'T RE-DERIVE (architecture.md's own instruction): the patient/MAR
 * facts here are read from window.SIGNOFF_MARS's `mar12` entry and the drug
 * facts from window.SIGNOFF_DRUGS's `percocet` entry at load time, not
 * retyped — if those source files aren't loaded yet this file will fall back
 * to an inline literal copy of the same values (so the module still works
 * standalone) but SIGNOFF_MARS/SIGNOFF_DRUGS are the source of truth. This
 * file's <script> tag must load AFTER data/signoff-mars.js and
 * data/signoff-drugs.js in index.html for the reuse path to run.
 *
 * Phase-1 scenario only: medsim_mar12_oxycodone, derived from mar12
 * (Eric Doe, 77M, Chronic Pain) per architecture.md section 13's MVP scope.
 *
 * DOB (architecture.md Open Question 1, already decided — do not re-litigate):
 * the mar12 photo carries no date of birth. The scenario fabricates one
 * consistent with "77yo" and the patient states it naturally when asked. This
 * is clearly simulation content, not a real chart fact — flagged inline below.
 * ========================================================================== */
(function () {
  'use strict';

  function findMar(id) {
    var list = (window.SIGNOFF_MARS || []);
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
    return null;
  }
  function findDrug(id) {
    var list = (window.SIGNOFF_DRUGS || []);
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
    return null;
  }

  var mar12 = findMar('mar12');
  var percocetDrug = findDrug('percocet');

  /* Fallback literals mirror mar12/percocet exactly, only used if the source
     data files failed to load (script-order issue, or a page that only
     includes medsim.js). Kept intentionally identical to SIGNOFF_MARS/DRUGS. */
  var patientSrc = mar12 ? mar12.patient : {
    name: 'Eric Doe', age: 77, sex: 'M', weightKg: 72,
    codeStatus: 'Full Code', allergies: ['NKDA']
  };
  var mrn = mar12 ? mar12.mrn : '00012';
  var vitalsSrc = mar12 ? mar12.vitals : {
    bp: '114/79', hr: 77, rr: 22, temp: '99.0 F', spo2: 95
  };
  var medOrderSrc = (mar12 && mar12.meds) ? (function () {
    for (var i = 0; i < mar12.meds.length; i++) { if (mar12.meds[i].rxKey === 'percocet') return mar12.meds[i]; }
    return null;
  })() : null;
  var orderText = medOrderSrc ? medOrderSrc.orderText : 'Oxycodone/Acetaminophen 5/325 mg by mouth every 4 hours';
  var scheduledTime = medOrderSrc && medOrderSrc.scheduledTimes && medOrderSrc.scheduledTimes[0]
    ? medOrderSrc.scheduledTimes[0] : '12:00';
  var lastGiven = medOrderSrc && medOrderSrc.givenTimes && medOrderSrc.givenTimes[0]
    ? medOrderSrc.givenTimes[0] : '07:23';
  var marColor = medOrderSrc ? medOrderSrc.color : 'yellow';

  var SCENARIOS = [
    {
      id: 'medsim_mar12_oxycodone',
      title: 'MAR 12 — Chronic Pain, 1200 Oxycodone/Acetaminophen',
      difficulty: 'beginner',

      patient: {
        name: patientSrc.name,
        /* Fabricated per Open Question 1's resolution — no DOB on the source
           MAR photo. Patient states it naturally if asked; never surfaced by
           the engine as a "real chart" fact anywhere else. */
        dob: '1949-03-14',
        age: patientSrc.age,
        sex: patientSrc.sex,
        weightKg: patientSrc.weightKg,
        codeStatus: patientSrc.codeStatus,
        allergies: patientSrc.allergies.slice(),
        mrn: mrn
      },

      environment: {
        locations: ['hallway', 'bedside', 'med_room', 'prep_area', 'documentation_station'],
        dispenserStyle: 'cart_outside'
      },

      orders: [
        { medId: 'percocet', orderText: orderText, scheduledTime: scheduledTime, route: 'PO', prn: false }
      ],

      mar: [
        { medId: 'percocet', color: marColor, givenTimes: [lastGiven] }
      ],

      vitals: {
        bp: vitalsSrc.bp, hr: vitalsSrc.hr, rr: vitalsSrc.rr,
        temp: vitalsSrc.temp, spo2: vitalsSrc.spo2
      },
      labs: {},

      /* No labs this scenario — pre_admin_assessment's `vitals_viewed OR
         labs_viewed` OR-slot resolves to vitals_viewed being the only
         satisfying path, which is what `relevantTo` records for the UI/report. */
      assessment: { relevantTo: ['vitals', 'swallow_ability'] },

      medicationsAvailable: ['percocet'],
      drugGuideEntries: ['percocet'],
      expectedAssessments: ['pain_level', 'sedation_level', 'respiratory_rate'],

      holdParameters: percocetDrug ? percocetDrug.holdParameters.map(function (h) {
        return { medId: 'percocet', condition: h };
      }) : [
        { medId: 'percocet', condition: 'RR <12' },
        { medId: 'percocet', condition: 'Sedation scale >=3' },
        { medId: 'percocet', condition: 'SpO2 <92% on room air' }
      ],
      criticalConditions: [],

      patientFacts: [
        { key: 'name', value: patientSrc.name },
        { key: 'dob', value: 'March 14th, 1949' },
        { key: 'mrn', value: mrn },
        { key: 'allergies', value: 'No known drug allergies (NKDA).' },
        { key: 'pain_level', value: 'About a 3 out of 10 right now — comes and goes, worse when I try to walk.' },
        { key: 'pain_location', value: 'Mostly my lower back and that sore toe.' },
        { key: 'med_understanding', value: 'I know it\'s the little yellow pill for pain — the doctor said take it when it hurts.' },
        { key: 'last_dose_time', value: 'I think I took one this morning, maybe around 7:30.' },
        { key: 'swallow_ability', value: 'No trouble swallowing pills, never have.' },
        { key: 'appetite', value: 'I ate breakfast fine this morning.' },
        { key: 'toe', value: 'My right big toe has been draining some yellowish stuff, it\'s tender.' },
        { key: 'constipation', value: 'I\'ve been pretty backed up the last couple days, if I\'m honest.' },
        { key: 'iv_site', value: 'I\'ve got that IV in my right arm, it\'s a little sore where it\'s taped.' },
        { key: 'mood', value: 'I\'m alright, just tired of being poked at.' }
      ],
      patientPersona: {
        tone: 'Calm, a little stoic about pain, cooperative once he feels heard. Elderly male, plainspoken.',
        behaviors: [
          'Tends to downplay his pain rather than exaggerate it',
          'Answers only what is asked — does not launch into his whole history unprompted',
          'Appreciates being addressed by name and having things explained in plain language',
          'Gets a little short if rushed or talked over'
        ]
      },

      distractions: [],
      rubricOverrides: [
        { criterionId: 'sharps_violation', notApplicable: true },
        { criterionId: 'injection_technique', notApplicable: true },
        { criterionId: 'limiting_distractions', notApplicable: true },
        { criterionId: 'special_precautions', notApplicable: true }
      ],

      requiresCalculation: false,
      expiredMedicationPresent: false,
      currentSimTime: '12:00'
    }
  ];

  window.MEDSIM_SCENARIOS = SCENARIOS;
})();
