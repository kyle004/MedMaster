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
    /* ==== mar12 -- photo-verbatim: Eric Doe 77M, Chronic Pain, 1200 ============
     * Transcribed exactly from the MAR-12 photo the user provided.  If a value
     * here disagrees with the printed sheet in class, the printed sheet wins.
     * ======================================================================= */
    {
      id: 'mar12',
      title: 'MAR 12 - Chronic pain, 1200 pass',
      mrn: '00012',
      patient: {
        name: 'Eric Doe', age: 77, sex: 'M', weightKg: 72,
        codeStatus: 'Full Code',
        allergies: ['NKDA'],
        iv: ['LFA #20']
      },
      admittingDx: 'Chronic Pain',
      pmh: ['Chronic Constipation', 'kyphoplasty', 'Hypertension'],
      vitals: { bp: '114/79', hr: 77, rr: 22, temp: '99.0 F', spo2: 95, painScore: null,
                notes: 'Pt AOX4, ambulate by self, right great toe lesion with purulent drainage, fistula RUE, bruit and thrill present.' },
      labs: {},
      currentTime: '12:00',
      meds: [
        {
          rxKey: 'percocet',
          orderText: 'Oxycodone/Acetaminophen 5/325 mg by mouth every 4 hours',
          scheduledTimes: ['12:00'], givenTimes: ['07:23'], color: 'yellow',
          notes: 'Q4h. Last given 0723 (green). Yellow at 1200 - due now (window 1100-1300).',
          traps: []
        },
        {
          rxKey: 'lidocaine_patch',
          orderText: 'Lidocaine Patch every 12 hours to lower back',
          scheduledTimes: ['12:00'], givenTimes: [], color: 'yellow',
          notes: 'Q12h topical. Apply to clean, dry skin over lower back; date+time+initial. Max 12h ON, then 12h OFF.',
          traps: []
        },
        {
          rxKey: 'dilaudid',
          orderText: 'Hydromorphone 1 mg IV every 2 hours PRN for pain >5. Vial contains 2 mg/mL',
          scheduledTimes: [], givenTimes: ['09:43'], prn: true, color: 'white',
          notes: 'PRN pain >5. Last given 0943 (green). At 1200 pt reports pain 3/10 - do NOT give (below PRN threshold).',
          traps: [
            { type: 'wrong_dose', severity: 'major',
              explain: 'Vial is 2 mg/mL, order is 1 mg = 0.5 mL. Drawing 1 mL would be a 2 mg dose (double). Verify calculation before pushing.' }
          ]
        }
      ]
    },

    /* ==== mar14 -- photo-verbatim: Eric Doe 64M, Cellulitis, 0900 =============
     * Transcribed exactly from the MAR-14 photo the user provided.
     * ======================================================================= */
    {
      id: 'mar14',
      title: 'MAR 14 - Cellulitis, 0900 pass',
      mrn: '00014',
      patient: {
        name: 'Eric Doe', age: 64, sex: 'M', weightKg: 72,
        codeStatus: 'Full Code',
        allergies: ['NSAIDs'],
        iv: ['RUE PICC']
      },
      admittingDx: 'Cellulitis',
      pmh: ['Hypertension', 'MI 2 years ago', 'CAD', 'CHF'],
      vitals: { bp: '163/88', hr: 83, rr: 18, temp: '99.6 F', spo2: 96, painScore: null,
                notes: 'Pt AOX4, ambulate with assist, edema with redness and tenderness to Left calf and lateral aspect.' },
      labs: {},
      currentTime: '09:00',
      meds: [
        {
          rxKey: 'lasix',
          orderText: 'Furosemide 60 mg by mouth every 6 hours',
          scheduledTimes: ['08:00'], givenTimes: [], color: 'yellow',
          notes: 'Q6h PO. Yellow at 0800 - within ±1 hr window at 0900. Give now. Check K+ before if available; monitor for orthostasis.',
          traps: []
        },
        {
          rxKey: 'kcl',
          orderText: 'K-DUR 20 mEq by mouth twice daily',
          scheduledTimes: ['10:00'], givenTimes: [], color: 'yellow',
          notes: 'BID PO. Yellow at 1000 - NOT due at 0900 (outside ±1 hr window). Take with food, full glass of water; do not crush ER tab.',
          traps: [
            { type: 'wrong_time', severity: 'major',
              explain: 'K-DUR is scheduled for 1000 - the ±1 hr window opens at 0900 but 0900 is the earliest allowable. If clock reads 0900 exactly it is borderline; giving before 0900 is a wrong-time error. Verify current clock time before pulling.' }
          ]
        },
        {
          rxKey: 'vancomycin',
          orderText: 'Vancomycin 1 g IV daily',
          scheduledTimes: ['07:00'], givenTimes: ['06:55'], color: 'green',
          notes: 'Daily IV. Given 0655 (green). Do NOT re-administer. Infuse over at least 60 min (rapid = red-person/red-man syndrome).',
          traps: [
            { type: 'wrong_color', severity: 'major',
              explain: 'Cell is green = already given at 0655. Giving again at 0900 would be a duplicate dose - critical for a narrow-therapeutic drug like vancomycin.' }
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
