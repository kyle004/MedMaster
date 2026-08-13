/* =============================================================================
 * data/signoff-mars.js  ->  window.SIGNOFF_MARS
 * -----------------------------------------------------------------------------
 * MAR scenarios for the Med Admin Signoff Sim. Trap patterns per /SIGNOFF_SPEC.
 * Every trap has a severity ('critical' | 'major' | 'minor') and an `explain`
 * the debrief shows verbatim.
 *
 * The three photo-derived scenarios use the fixed IDs mar12, mar14, mar6 per
 * the spec. mar6 carries the "digoxin daily Rapid IV push" and the "Dilaudid
 * with hydromorphone allergy" combined trap.
 * ========================================================================== */
(function () {
  'use strict';

  var MARS = [
    /* ==== mar12 -- photo-derived scenario 1 ================================= */
    {
      id: 'mar12',
      title: 'MAR 12 - Med/Surg AM pass',
      mrn: '00012',
      patient: {
        name: 'Robert Delgado', age: 68, sex: 'M', weightKg: 82,
        codeStatus: 'Full Code',
        allergies: ['NKDA'],
        iv: ['R forearm 20g #18, saline lock, patent, no redness']
      },
      admittingDx: 'HTN, HFrEF exacerbation',
      pmh: ['HTN', 'HFrEF EF 35%', 'AFib on warfarin', 'BPH'],
      vitals: { bp: '128/78', hr: 58, rr: 18, temp: '98.4 F', spo2: 96, painScore: 2, notes: 'AM assessment; apical taken x60 sec' },
      labs: { k: 3.6, na: 138, bun: 22, cr: 1.1, inr: 2.3, dig_level: 1.2 },
      currentTime: '09:00',
      meds: [
        {
          rxKey: 'digoxin',
          orderText: 'Digoxin 0.125 mg PO daily',
          scheduledTimes: ['09:00'], givenTimes: [], color: 'yellow',
          holdIfHRBelow: 60,
          notes: 'Take apical pulse full 60 sec. Hold if <60.',
          traps: []
        },
        {
          rxKey: 'warfarin',
          orderText: 'Warfarin 5 mg PO daily at 1700',
          scheduledTimes: ['17:00'], givenTimes: [], color: 'white',
          notes: 'Not due at 09:00 - do not give.',
          traps: [
            { type: 'wrong_time', severity: 'major',
              explain: 'Warfarin is scheduled 17:00 - outside the ±1 hr window at 09:00. Do not administer now.' }
          ]
        },
        {
          rxKey: 'lasix',
          orderText: 'Furosemide 40 mg PO daily in AM',
          scheduledTimes: ['09:00'], givenTimes: [], color: 'yellow',
          notes: 'Check K+ (3.6 - low-normal). Daily weight. Watch orthostasis.',
          traps: []
        },
        {
          rxKey: 'tamsulosin',
          orderText: 'Tamsulosin 0.4 mg PO at bedtime',
          scheduledTimes: ['21:00'], givenTimes: [], color: 'white',
          notes: 'Bedtime dose. Do not give at 09:00.',
          traps: [
            { type: 'wrong_time', severity: 'minor',
              explain: 'Tamsulosin is bedtime dosing (first-dose orthostasis). Not due at 09:00.' }
          ]
        }
      ]
    },

    /* ==== mar14 -- photo-derived scenario 2 ================================= */
    {
      id: 'mar14',
      title: 'MAR 14 - Antibiotic + insulin AM pass',
      mrn: '00014',
      patient: {
        name: 'Anita Chen', age: 54, sex: 'F', weightKg: 74,
        codeStatus: 'Full Code',
        allergies: ['Penicillin - hives'],
        iv: ['L AC 20g, primary NS at 75 mL/hr, patent']
      },
      admittingDx: 'Cellulitis L lower extremity; T2DM',
      pmh: ['T2DM', 'HTN', 'Obesity'],
      vitals: { bp: '132/80', hr: 84, rr: 18, temp: '100.6 F', spo2: 97, painScore: 4, notes: '' },
      labs: { k: 4.2, na: 139, bun: 14, cr: 0.9, bg: 212, wbc: 13.4 },
      currentTime: '08:00',
      meds: [
        {
          rxKey: 'cefazolin',
          orderText: 'Cefazolin 1 g IV q8h - infuse over 30 min',
          scheduledTimes: ['08:00'], givenTimes: [], color: 'yellow',
          notes: 'Verify allergy - PCN cross-sensitivity ~1-5%. Report before hanging.',
          traps: [
            { type: 'allergy_conflict', severity: 'critical',
              explain: 'Patient lists PCN allergy (hives). Cross-reactivity with cephalosporins is low but non-zero - CLARIFY with provider before administering. Do not give until reconciled.' }
          ]
        },
        {
          rxKey: 'insulin_regular',
          orderText: 'Insulin Regular SubQ per sliding scale AC and HS. BG 212 => 4 units SubQ',
          scheduledTimes: ['07:30'], givenTimes: [], color: 'yellow',
          notes: 'Independent double-check. Meal tray at bedside.',
          traps: []
        },
        {
          rxKey: 'insulin_nph',
          orderText: 'Insulin NPH 20 units IV BID',
          scheduledTimes: ['08:00'], givenTimes: [], color: 'yellow',
          notes: '',
          traps: [
            { type: 'wrong_route', severity: 'critical',
              explain: 'NPH insulin is NEVER given IV - only regular insulin is IV-safe. Clarify with prescriber; refuse to administer.' }
          ]
        },
        {
          rxKey: 'metformin',
          orderText: 'Metformin 1000 mg PO BID with meals',
          scheduledTimes: ['08:00'], givenTimes: [], color: 'yellow',
          notes: 'Patient scheduled for CT with IV contrast this afternoon.',
          traps: [
            { type: 'contraindication', severity: 'critical',
              explain: 'Metformin must be HELD 48 hr before AND after IV contrast - lactic acidosis risk. Clarify with team; do not give.' }
          ]
        }
      ]
    },

    /* ==== mar6 -- photo-derived scenario 3 (the mandatory traps) ============ */
    {
      id: 'mar6',
      title: 'MAR 6 - Post-op day 1 with critical trap load',
      mrn: '00006',
      patient: {
        name: 'James Whitaker', age: 72, sex: 'M', weightKg: 78,
        codeStatus: 'Full Code',
        allergies: ['Hydromorphone - respiratory depression', 'Sulfa - rash'],
        iv: ['R hand 22g, saline lock, patent']
      },
      admittingDx: 'POD#1 s/p ORIF right hip',
      pmh: ['AFib on digoxin', 'HTN', 'CKD stage 3', 'CAD'],
      vitals: { bp: '118/70', hr: 54, rr: 16, temp: '98.6 F', spo2: 95, painScore: 6, notes: 'Apical HR 54, regular' },
      labs: { k: 3.4, na: 137, bun: 28, cr: 1.6, dig_level: 1.5 },
      currentTime: '09:00',
      meds: [
        {
          rxKey: 'digoxin',
          orderText: 'Digoxin 0.25 mg IV daily Rapid IV push',
          scheduledTimes: ['09:00'], givenTimes: [], color: 'yellow',
          notes: 'Apical HR 54.',
          traps: [
            { type: 'wrong_route', severity: 'critical',
              explain: 'Digoxin must be pushed SLOWLY over at least 5 min - "Rapid IV push" is unsafe and never appropriate. Clarify and correct the order; refuse to give as written.' },
            { type: 'hold_parameter_violation', severity: 'critical',
              explain: 'Apical HR is 54 (<60) - HOLD digoxin regardless of route, notify provider.' }
          ]
        },
        {
          rxKey: 'dilaudid',
          orderText: 'Hydromorphone (Dilaudid) 1 mg IV q3h PRN pain',
          scheduledTimes: [], givenTimes: [], prn: true, color: 'yellow',
          notes: 'Pain 6/10.',
          traps: [
            { type: 'allergy_conflict', severity: 'critical',
              explain: 'Patient is allergic to HYDROMORPHONE (documented respiratory depression). Do NOT administer. Clarify alternate analgesia.' }
          ]
        },
        {
          rxKey: 'cefazolin',
          orderText: 'Cefazolin 1 g IV q8h - infuse over 30 min',
          scheduledTimes: ['09:00'], givenTimes: [], color: 'yellow',
          notes: 'Post-op prophylaxis. Renal dose adjusted per pharmacy.',
          traps: []
        },
        {
          rxKey: 'heparin',
          orderText: 'Heparin 5000 units SubQ q8h',
          scheduledTimes: ['09:00'], givenTimes: [], color: 'yellow',
          notes: 'DVT prophy. Rotate site. Do not aspirate. Do not massage.',
          traps: []
        }
      ]
    },

    /* ==== new scenario: hyperkalemia + kayexalate =========================== */
    {
      id: 'sig_hyperk_01',
      title: 'CKD + Hyperkalemia - kayexalate',
      mrn: '00025',
      patient: {
        name: 'Marta Iyengar', age: 61, sex: 'F', weightKg: 68,
        codeStatus: 'Full Code',
        allergies: ['NKDA'],
        iv: ['L forearm 22g, saline lock']
      },
      admittingDx: 'CKD stage 4 with hyperkalemia',
      pmh: ['CKD', 'HTN', 'T2DM'],
      vitals: { bp: '148/86', hr: 78, rr: 18, temp: '98.2 F', spo2: 98, painScore: 0, notes: '' },
      labs: { k: 6.1, na: 141, bun: 46, cr: 3.2, bg: 158 },
      currentTime: '10:00',
      meds: [
        {
          rxKey: 'kayexalate',
          orderText: 'Sodium polystyrene sulfonate 15 g PO now',
          scheduledTimes: ['10:00'], givenTimes: [], color: 'yellow',
          notes: 'K+ 6.1. Verify bowel sounds present, no ileus, passing gas.',
          traps: []
        },
        {
          rxKey: 'lasix',
          orderText: 'Furosemide 40 mg IV push now',
          scheduledTimes: ['10:00'], givenTimes: [], color: 'yellow',
          notes: 'Give slowly - ototoxicity if rapid push.',
          traps: []
        },
        {
          rxKey: 'kcl',
          orderText: 'Potassium chloride 20 mEq IV push now',
          scheduledTimes: ['10:00'], givenTimes: [], color: 'yellow',
          notes: '',
          traps: [
            { type: 'wrong_route', severity: 'critical',
              explain: 'KCl is NEVER IV push - fatal arrhythmia. Must be diluted, infused via pump, and patient already has K+ 6.1 (hyperkalemia). Refuse and clarify.' },
            { type: 'hold_parameter_violation', severity: 'critical',
              explain: 'K+ is 6.1 (>5.0) - hold potassium and clarify why replacement was ordered on a hyperkalemic patient.' }
          ]
        },
        {
          rxKey: 'metformin',
          orderText: 'Metformin 1000 mg PO BID',
          scheduledTimes: ['08:00', '20:00'], givenTimes: ['08:00'], color: 'white',
          notes: 'Renal function borderline.',
          traps: [
            { type: 'contraindication', severity: 'major',
              explain: 'eGFR is likely <30 (Cr 3.2) - metformin should be reevaluated for renal dose reduction or hold. Discuss with team.' }
          ]
        }
      ]
    },

    /* ==== new scenario: DKA + regular insulin drip ========================= */
    {
      id: 'sig_dka_01',
      title: 'DKA - regular insulin drip',
      mrn: '00031',
      patient: {
        name: 'Tyler Ross', age: 22, sex: 'M', weightKg: 70,
        codeStatus: 'Full Code',
        allergies: ['NKDA'],
        iv: ['R AC 18g, primary NS bolus done; secondary insulin drip']
      },
      admittingDx: 'Diabetic ketoacidosis, new-onset T1DM',
      pmh: ['None'],
      vitals: { bp: '104/62', hr: 118, rr: 24, temp: '98.6 F', spo2: 98, painScore: 3, notes: 'Kussmaul respirations, fruity breath' },
      labs: { k: 3.2, na: 132, bun: 24, cr: 1.1, bg: 486, ph: 7.19, bicarb: 12, agap: 24 },
      currentTime: '14:00',
      meds: [
        {
          rxKey: 'insulin_regular',
          orderText: 'Insulin Regular IV drip 0.1 unit/kg/hr per DKA protocol; hourly BG',
          scheduledTimes: ['14:00'], givenTimes: [], color: 'yellow',
          notes: 'Independent double-check. Pump. K+ 3.2.',
          traps: [
            { type: 'hold_parameter_violation', severity: 'critical',
              explain: 'K+ is 3.2 (<3.3) - REPLACE POTASSIUM FIRST per DKA protocol before or with insulin drip. Insulin drives K+ into cells and will worsen hypokalemia -> arrhythmia.' }
          ]
        },
        {
          rxKey: 'insulin_humalog',
          orderText: 'Insulin lispro 8 units SubQ now',
          scheduledTimes: ['14:00'], givenTimes: [], color: 'yellow',
          notes: '',
          traps: [
            { type: 'wrong_time', severity: 'critical',
              explain: 'No food is available (DKA, likely NPO) and BG is being managed by IV drip. Rapid SubQ insulin without food or overlap plan is unsafe.' },
            { type: 'duplicate', severity: 'major',
              explain: 'Overlapping insulin coverage with the drip - clarify which is the primary route.' }
          ]
        },
        {
          rxKey: 'kcl',
          orderText: 'Potassium chloride 10 mEq/hr IV infusion via central line',
          scheduledTimes: ['14:00'], givenTimes: [], color: 'yellow',
          notes: 'For K+ 3.2. Pump, double-check.',
          traps: []
        }
      ]
    },

    /* ==== new scenario: postpartum hemorrhage + methergine + HTN ============ */
    {
      id: 'sig_pph_01',
      title: 'Postpartum - methergine with HTN trap',
      mrn: '00048',
      patient: {
        name: 'Danielle Okafor', age: 29, sex: 'F', weightKg: 76,
        codeStatus: 'Full Code',
        allergies: ['NKDA'],
        iv: ['R AC 18g, LR at 125 mL/hr']
      },
      admittingDx: 'S/p vaginal delivery, boggy uterus, PPH suspected',
      pmh: ['Gestational HTN'],
      vitals: { bp: '158/98', hr: 106, rr: 20, temp: '99.0 F', spo2: 98, painScore: 5, notes: 'Fundus boggy, above umbilicus, deviated right; heavy lochia rubra' },
      labs: { hgb: 9.1, plt: 210, inr: 1.1 },
      currentTime: '11:15',
      meds: [
        {
          rxKey: 'methergine',
          orderText: 'Methylergonovine 0.2 mg IM now',
          scheduledTimes: ['11:15'], givenTimes: [], color: 'yellow',
          notes: 'Check BP before every dose.',
          traps: [
            { type: 'hold_parameter_violation', severity: 'critical',
              explain: 'BP is 158/98 - HOLD methergine. It is a vasoconstrictor and is CONTRAINDICATED in HTN and preeclampsia. Notify provider, request alternate uterotonic (oxytocin, carboprost, or misoprostol).' }
          ]
        },
        {
          rxKey: 'morphine',
          orderText: 'Morphine 4 mg IV push q3h PRN pain',
          scheduledTimes: [], givenTimes: [], prn: true, color: 'yellow',
          notes: 'Push slowly, monitor RR.',
          traps: []
        },
        {
          rxKey: 'docusate',
          orderText: 'Docusate 100 mg PO BID',
          scheduledTimes: ['09:00', '21:00'], givenTimes: ['09:00'], color: 'white',
          notes: 'Not due now.',
          traps: []
        }
      ]
    }
  ];

  window.SIGNOFF_MARS = MARS;
})();
