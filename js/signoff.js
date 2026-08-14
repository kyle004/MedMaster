/* =============================================================================
 * js/signoff.js  ->  window.SignoffTrainer
 * -----------------------------------------------------------------------------
 * Med Admin Signoff Sim - the focused practice mode for the school's medication
 * administration skills check. Three tabs:
 *   1. MAR Practice   - pick a scenario, work each due med through the 3 checks
 *                       + 6 rights + trap detection, score against the verbatim
 *                       rubric, write the attempt to Firebase.
 *   2. Cheat Sheet    - one-page reference for cramming (HIGH-ALERT first).
 *   3. Flashcards +   - quick-recall drug/rate/antidote facts, plus the required
 *      Mnemonics       mnemonics verbatim from the spec.
 *
 * Design rules (mirroring the iOS side):
 * - Rubric text is stored VERBATIM from /SIGNOFF_SPEC/rubric_verbatim.txt.
 *   Any critical error = automatic FAIL regardless of score.
 * - Drug facts and MAR scenarios are the shared source of truth
 *   (window.SIGNOFF_DRUGS, window.SIGNOFF_MARS) loaded from data/signoff-*.js.
 * - The drug picker for any add-your-own MAR builder refuses drugs not on the
 *   35-drug allow-list. (Enforced at data time and again at the UI.)
 * - Firebase is optional. If MM.db (or window.firebaseDb) is missing, the
 *   attempt is kept in local state only and a note is shown.
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof React === 'undefined' || !React.createElement) { return; }

  var ce = React.createElement;
  var useState = React.useState,
      useEffect = React.useEffect,
      useMemo = React.useMemo,
      useRef = React.useRef;

  /* -------------------------------------------------------------------------
   * 0. DATA
   * ----------------------------------------------------------------------- */

  function DRUGS() { return window.SIGNOFF_DRUGS || []; }
  function MARS()  { return window.SIGNOFF_MARS  || []; }
  function ALLOW() { return window.SIGNOFF_DRUGS_ALLOWED || {}; }

  /* Verbatim rubric from /SIGNOFF_SPEC/rubric_verbatim.txt. Do not paraphrase.
     Structure: sections[].items[]; graded items carry levels for 0/1/2 with the
     source text; critical items carry only their prompt. Total 20 items x max 2
     = 40 points; percent = raw * 2.5. Any critical => automatic FAIL. */
  var SIGNOFF_RUBRIC = {
    totalPoints: 40,
    scoreMultiplier: 2.5,
    maxAttempts: 2,
    passIfAllPassAndNoCritical: true,
    criticalErrors: [
      { id: 'wrong_patient',           text: 'Wrong patient' },
      { id: 'wrong_patient_med',       text: 'Wrong patient medication administered' },
      { id: 'wrong_drug',              text: 'Wrong drug administered' },
      { id: 'wrong_dose_calc',         text: 'Wrong dose (calculation error)' },
      { id: 'wrong_route',             text: 'Wrong route of administration' },
      { id: 'allergy_not_checked',     text: 'Allergy not checked/checked incorrectly' },
      { id: 'no_bedside_verification', text: 'Bedside verification skipped' },
      { id: 'no_hand_hygiene',         text: 'No hand hygiene before preparation' },
      { id: 'sharps_violation',        text: 'Sharps safety violation (recapped needle, left on surface, improper disposal)' }
    ],
    sections: [
      {
        id: 'verification', label: 'Medication Verification Checks',
        items: [
          { id: 'first_check',  text: 'First Check: Compares medication with MAR when removing from dispensing system. Verbalizes name, dose, route, time. Checks expiration and drug form.',
            levels: ['Did not perform check.', 'Incomplete or inaccurate check.', 'Correctly performed check.'] },
          { id: 'second_check', text: 'Second Check: Compares medication again during preparation. Verifies calculation accuracy. Checks expiration on prepared medication. Performs hand hygiene before prep.',
            levels: ['Did not perform check.', 'Incomplete or inaccurate check.', 'Correctly performed check.'] },
          { id: 'third_check',  text: 'Third Check (Bedside): Compares medication with MAR at bedside with patient present. States patient name, medication name, dose, route, time.',
            levels: ['Did not perform check.', 'Incomplete or inaccurate check.', 'Correctly performed check.'] }
        ]
      },
      {
        id: 'safety_critical', label: 'Patient Safety - Critical Items',
        items: [
          { id: 'two_identifiers', text: 'Two Patient Identifiers: Verifies using name & date of birth (NOT room number or age).',
            levels: ['Did not verify.', 'Incomplete verification.', 'Correctly verified.'], starred: true },
          { id: 'allergy_check',   text: 'Allergy Check: Asks patient about allergies, checks allergy band, verifies MAR. Reports concerns before administering.',
            levels: ['Did not check.', 'Incomplete or inaccurate check.', 'Correctly checked and reported.'], starred: true },
          { id: 'right_drug',      text: 'Right Drug: Matches order/MAR exactly.',
            levels: ['Did not match.', 'Incomplete or inaccurate match.', 'Correctly matched.'], starred: true },
          { id: 'right_dose',      text: 'Right Dose: Correct calculation. Shows weight-based conversions (kg = lbs ÷ 2.2) and IV rates if applicable.',
            levels: ['Did not calculate.', 'Incomplete or inaccurate calculation.', 'Correctly calculated.'], starred: true },
          { id: 'right_route',     text: 'Right Route: Matches order. Assesses patient ability to receive via that route. Correct drug form for route.',
            levels: ['Did not assess.', 'Incomplete assessment.', 'Correctly assessed.'], starred: true },
          { id: 'right_time',      text: 'Right Time: Administers at the correct time.',
            levels: ['Did not administer at correct time.', 'Incomplete timing.', 'Correctly administered at the right time.'], starred: true },
          { id: 'right_documentation', text: 'Right Documentation: DOCUMENTS AFTER administering (not before). Includes medication name, dose, route, time, site, patient response, signature.',
            levels: ['Did not document.', 'Incomplete documentation.', 'Correctly documented.'], starred: true }
        ]
      },
      {
        id: 'judgment', label: 'Clinical Judgment & Assessment',
        items: [
          { id: 'pre_admin_assessment', text: 'Pre-Administration Assessment: Reviews vital signs, lab values, patient ability to swallow, injection site assessment.',
            levels: ['Did not assess.', 'Incomplete assessment.', 'Correctly assessed.'] },
          { id: 'right_reason',     text: 'Right Reason: Verbalizes clinical reason or indication for medication.',
            levels: ['Did not verbalize.', 'Incomplete verbalization.', 'Correctly verbalized.'] },
          { id: 'right_education',  text: 'Right Patient Education: Explains medication purpose, expected effects, and side effects to report. Verifies understanding.',
            levels: ['Did not educate.', 'Incomplete education.', 'Effectively educated patient.'] },
          { id: 'drug_guide',       text: 'Right Use of Drug Guide: Demonstrates proper use of drug guide to verify medication information, including class, indications, and contraindications.',
            levels: ['Did not demonstrate.', 'Incomplete demonstration of drug guide use.', 'Correctly demonstrated use of drug guide.'] }
        ]
      },
      {
        id: 'safety_techniques', label: 'Safety Techniques',
        items: [
          { id: 'hand_hygiene',    text: 'Hand Hygiene & Asepsis: Performs hand hygiene before prep. Maintains aseptic technique. For injections: 20-second antiseptic scrub with friction, air dry. Correct needle size.',
            levels: ['Did not perform.', 'Incomplete or inaccurate technique.', 'Correctly performed.'], starred: true },
          { id: 'injection_tech',  text: 'Injection Technique (if applicable): Correct anatomical landmark. Proper needle angle. Smooth insertion. Aspirates for IM if required. Does NOT massage heparin sites. Sharps in container immediately.',
            levels: ['Did not perform.', 'Incomplete or inaccurate technique.', 'Correctly performed.'] },
          { id: 'limit_distractions', text: 'Limiting Distractions: Minimizes interruptions. Remains focused. Demonstrates "no interruption zone" awareness.',
            levels: ['Did not limit distractions.', 'Incomplete effort to limit distractions.', 'Effectively limited distractions.'] }
        ]
      },
      {
        id: 'education_comm', label: 'Patient Education & Communication',
        items: [
          { id: 'professionalism', text: 'Professionalism & Respect: Uses clear, therapeutic communication. Maintains privacy and dignity. Demonstrates cultural sensitivity.',
            levels: ['Did not demonstrate.', 'Partial demonstration of professionalism.', 'Fully demonstrated professionalism.'] }
        ]
      },
      {
        id: 'additional', label: 'Additional Considerations',
        items: [
          { id: 'special_precautions', text: 'Special Precautions: Holds medications based on lab values. Assesses contraindications. Reviews drug interactions. Monitors for adverse effects.',
            levels: ['Did not assess.', 'Incomplete assessment of precautions.', 'Correctly assessed precautions.'] },
          { id: 'expiration',         text: 'Expiration Dates: All medications checked for expiration.',
            levels: ['Did not check.', 'Incomplete checks for expiration or form.', 'Correctly checked all medications.'] }
        ]
      }
    ]
  };
  window.SIGNOFF_RUBRIC = SIGNOFF_RUBRIC;

  /* Mnemonics -- verbatim from spec, order preserved. */
  var MNEMONICS = [
    { key: '6rights', title: '6 Rights - "PDR-TDD"',
      body: 'Patient, Drug, Dose(r), Route, Time, Documentation. (Or classic: Right pt/drug/dose/route/time/documentation.)' },
    { key: '3checks', title: '3 Checks - "Cart, Prep, Bed"',
      body: 'Cart (removing from dispensing system), Prep (during preparation), Bed (at bedside with patient). Or: "Reach it, Read it, Read it again at the bedside".' },
    { key: 'digoxin', title: 'Digoxin toxicity - "SICK"',
      body: 'Slow pulse, Impaired vision (yellow halos), Confusion/GI (N/V), K+ low potentiates.' },
    { key: 'coumadin', title: 'Coumadin diet - "Green stays consistent"',
      body: 'Leafy greens = vit K, do not have to avoid, must be consistent day-to-day.' },
    { key: 'heparin', title: 'Heparin injection - "A-N-M"',
      body: 'Avoid aspiration, No massage, Move sites (rotate). >=2 in from umbilicus.' },
    { key: 'insulins', title: 'Insulin trio - "RNH"',
      body: 'Regular clear/IV-safe, NPH cloudy Never IV, Humalog "hungry" (food at bedside).' },
    { key: 'bb60', title: 'Beta-blocker / diltiazem hold - "BB<60"',
      body: 'Hold if HR <60 or SBP <90.' },
    { key: 'vanco', title: 'Vancomycin infusion reaction - "Too fast, too red"',
      body: 'Slow the infusion (>=60 min per 1 g); it is histamine release, not a true allergy.' },
    { key: 'methergine', title: 'Methergine - "Made for the uterus, murder for the vessels"',
      body: 'Postpartum atony only; HOLD if BP is high or preeclampsia.' },
    { key: 'amio', title: 'Amiodarone body-wide toxicity - "A-CLOTS"',
      body: 'Amyloid-like corneal deposits, Constipation, Lung fibrosis, Optical/thyroid, Thyroid, Skin (blue-gray).' },
    { key: 'lasix', title: 'Furosemide watch - "LOOP"',
      body: 'Low K+, Orthostasis, Ototoxicity if fast push, Photosensitivity.' },
    { key: 'kcl', title: 'KCl - "Kill Con Level"',
      body: 'Kills if pushed, Central line only for >10 mEq/hr, Level above 5 => hold.' }
  ];

  /* Injection quick reference verbatim from lab_skills_verbatim.txt. */
  var INJECTION_REF = [
    { route: 'SubQ',
      gauge: '25-31 gauge',
      length: '3/16 to 5/8 inch',
      angle: '45 deg (limited SubQ tissue) or 90 deg (adequate SubQ tissue)',
      commonSites: 'Abdomen, upper arms, anterior thighs, upper buttocks',
      commonMeds: 'Insulin, enoxaparin, heparin',
      pearls: 'Rotate sites. Pinch skin. Do NOT aspirate. Do NOT massage enoxaparin/heparin.'
    },
    { route: 'IM',
      gauge: '20-25 gauge',
      length: '1 to 1.5 inches',
      angle: '90 deg',
      commonSites: 'Ventrogluteal (preferred adult), vastus lateralis (peds/adult), deltoid (small volumes)',
      commonMeds: 'Vaccines, antibiotics, analgesics',
      pearls: 'Z-track when indicated. Stabilize tissue. Follow facility aspiration policy.'
    },
    { route: 'ID',
      gauge: '25-27 gauge',
      length: '1/4 to 5/8 inch',
      angle: '5-15 deg, bevel up',
      commonSites: 'Inner forearm, upper back',
      commonMeds: 'TB testing, allergy testing',
      pearls: 'Form a wheal / bleb. Do NOT massage.'
    },
    { route: 'IV',
      gauge: 'N/A (via existing IV access)',
      length: 'N/A',
      angle: 'N/A',
      commonSites: 'Existing peripheral or central IV',
      commonMeds: 'Wide range',
      pearls: 'Verify patency, no infiltration or phlebitis, correct rate, drug compatibility, flush per protocol.'
    }
  ];

  /* -------------------------------------------------------------------------
   * 1. UTIL
   * ----------------------------------------------------------------------- */

  function MMobj() { return window.MM || {}; }
  function getDb() {
    var m = MMobj();
    if (m && m.db) return m.db;
    if (window.firebaseDb) return window.firebaseDb;
    return null;
  }
  function toast(msg, type) {
    try {
      var t = MMobj().toast;
      if (typeof t === 'function') { t(String(msg), type || 'info'); return; }
    } catch (e) {}
    try { console.log('[Signoff:' + (type || 'info') + ']', msg); } catch (e) {}
  }
  function drugById(id) {
    var list = DRUGS();
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
    return null;
  }
  function parseHM(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
    if (!m) return null;
    var h = parseInt(m[1], 10), mm = parseInt(m[2], 10);
    if (!isFinite(h) || !isFinite(mm)) return null;
    return h * 60 + mm;
  }
  function isDueNow(scheduledArr, currentTime, windowMin) {
    var cur = parseHM(currentTime);
    if (cur == null) return false;
    var w = (typeof windowMin === 'number') ? windowMin : 60;
    var arr = scheduledArr || [];
    for (var i = 0; i < arr.length; i++) {
      var t = parseHM(arr[i]);
      if (t == null) continue;
      var diff = Math.abs(t - cur);
      diff = Math.min(diff, 24 * 60 - diff);
      if (diff <= w) return true;
    }
    return false;
  }
  function isAllergic(patient, drug) {
    if (!patient || !drug) return false;
    var allergies = patient.allergies || [];
    var checkNames = [];
    if (drug.generic) checkNames.push(drug.generic);
    if (drug.brand)   checkNames.push(drug.brand);
    for (var i = 0; i < allergies.length; i++) {
      var a = String(allergies[i] || '').toLowerCase();
      for (var j = 0; j < checkNames.length; j++) {
        var parts = String(checkNames[j] || '').toLowerCase().split(/[\s,\/]+/);
        for (var k = 0; k < parts.length; k++) {
          var p = parts[k].replace(/[^a-z0-9]/g, '');
          if (p.length >= 5 && a.indexOf(p) !== -1) return true;
        }
      }
    }
    return false;
  }
  function styleObj(o) { return o || {}; }

  /* -------------------------------------------------------------------------
   * 2. STYLES (injected once, prefixed sg-)
   * ----------------------------------------------------------------------- */

  function injectStyles() {
    try {
      if (document.getElementById('signoff-styles')) return;
    } catch (e) { return; }
    var css = [
      '.sg-root{color:var(--text,#f1f5f9);}',
      '.sg-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}',
      '.sg-tab{padding:8px 14px;border-radius:8px;border:1px solid var(--surface2,#334155);',
      'background:var(--surface,#1e293b);color:var(--text,#f1f5f9);cursor:pointer;font-weight:600;',
      'font-size:0.92rem;}',
      '.sg-tab:hover{border-color:var(--accent,#3b82f6);}',
      '.sg-tab.on{background:var(--accent,#3b82f6);color:#fff;border-color:var(--accent,#3b82f6);}',
      '.sg-card{background:var(--surface,#1e293b);border:1px solid var(--surface2,#334155);',
      'border-radius:12px;padding:14px 16px;margin-bottom:12px;}',
      '.sg-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px;flex-wrap:wrap;}',
      '.sg-hd h3{margin:0;font-size:1.05rem;}',
      '.sg-muted{color:var(--text2,#94a3b8);font-size:0.85rem;}',
      '.sg-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}',
      '.sg-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:600;',
      'background:var(--surface2,#334155);color:var(--text,#f1f5f9);}',
      '.sg-chip.hi{background:rgba(239,68,68,0.16);color:var(--red,#ef4444);border:1px solid rgba(239,68,68,0.4);}',
      '.sg-chip.warn{background:rgba(245,158,11,0.16);color:var(--orange,#f59e0b);border:1px solid rgba(245,158,11,0.4);}',
      '.sg-chip.ok{background:rgba(34,197,94,0.14);color:var(--green,#22c55e);border:1px solid rgba(34,197,94,0.4);}',
      '.sg-chip.acc{background:rgba(59,130,246,0.16);color:var(--accent,#3b82f6);border:1px solid rgba(59,130,246,0.4);}',
      '.sg-cell{padding:6px 10px;border-radius:6px;font-weight:600;text-align:center;color:#0f172a;font-size:0.85rem;}',
      '.sg-cell.yellow{background:#facc15;}',
      '.sg-cell.green{background:#4ade80;}',
      '.sg-cell.red{background:#f87171;color:#fff;}',
      '.sg-cell.white{background:#e2e8f0;}',
      '.sg-btnrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}',
      '.sg-btn{padding:8px 14px;border-radius:8px;border:1px solid var(--surface2,#334155);',
      'background:var(--surface,#1e293b);color:var(--text,#f1f5f9);cursor:pointer;font-weight:600;font-size:0.9rem;}',
      '.sg-btn:hover{border-color:var(--accent,#3b82f6);}',
      '.sg-btn.on{background:var(--accent,#3b82f6);border-color:var(--accent,#3b82f6);color:#fff;}',
      '.sg-btn.danger{background:var(--red,#ef4444);border-color:var(--red,#ef4444);color:#fff;}',
      '.sg-btn.ok{background:var(--green,#22c55e);border-color:var(--green,#22c55e);color:#0f172a;}',
      '.sg-btn:disabled{opacity:0.5;cursor:not-allowed;}',
      '.sg-vitals{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;',
      'background:var(--surface2,#334155);padding:10px;border-radius:8px;margin:8px 0;font-size:0.85rem;}',
      '.sg-vitals div span{display:block;color:var(--text2,#94a3b8);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;}',
      '.sg-mar-table{width:100%;border-collapse:collapse;font-size:0.88rem;}',
      '.sg-mar-table th,.sg-mar-table td{border:1px solid var(--surface2,#334155);padding:8px;text-align:left;vertical-align:top;}',
      '.sg-mar-table th{background:var(--surface2,#334155);color:var(--text,#f1f5f9);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;}',
      '.sg-trap{background:rgba(239,68,68,0.09);border-left:3px solid var(--red,#ef4444);padding:8px 10px;',
      'margin:6px 0;border-radius:0 6px 6px 0;font-size:0.85rem;}',
      '.sg-trap.major{background:rgba(245,158,11,0.09);border-left-color:var(--orange,#f59e0b);}',
      '.sg-trap.minor{background:rgba(59,130,246,0.09);border-left-color:var(--accent,#3b82f6);}',
      '.sg-teach{background:var(--surface2,#334155);padding:10px;border-radius:8px;margin:8px 0;font-size:0.86rem;}',
      '.sg-teach ul{margin:6px 0 0 18px;padding:0;}',
      '.sg-teach li{margin:2px 0;}',
      '.sg-rubric-item{border:1px solid var(--surface2,#334155);border-radius:8px;padding:10px;margin:8px 0;}',
      '.sg-level-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}',
      '.sg-level-btn{padding:6px 10px;border-radius:6px;border:1px solid var(--surface2,#334155);',
      'background:var(--surface,#1e293b);color:var(--text,#f1f5f9);cursor:pointer;font-size:0.82rem;flex:1 1 100px;text-align:left;}',
      '.sg-level-btn:hover{border-color:var(--accent,#3b82f6);}',
      '.sg-level-btn.on-0{background:var(--red,#ef4444);border-color:var(--red,#ef4444);color:#fff;}',
      '.sg-level-btn.on-1{background:var(--orange,#f59e0b);border-color:var(--orange,#f59e0b);color:#0f172a;}',
      '.sg-level-btn.on-2{background:var(--green,#22c55e);border-color:var(--green,#22c55e);color:#0f172a;}',
      '.sg-crit-item{border:1px solid var(--surface2,#334155);border-radius:8px;padding:8px 10px;margin:6px 0;',
      'display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:0.88rem;}',
      '.sg-crit-item.on{background:rgba(239,68,68,0.14);border-color:var(--red,#ef4444);}',
      '.sg-score{font-size:1.6rem;font-weight:700;margin:8px 0;}',
      '.sg-fail{color:var(--red,#ef4444);}',
      '.sg-pass{color:var(--green,#22c55e);}',
      '.sg-flashcard{background:var(--surface2,#334155);border-radius:12px;padding:24px;',
      'min-height:180px;display:flex;flex-direction:column;justify-content:center;text-align:center;',
      'font-size:1.05rem;cursor:pointer;border:1px solid var(--surface2,#334155);}',
      '.sg-flashcard:hover{border-color:var(--accent,#3b82f6);}',
      '.sg-flashcard .sg-fc-front{font-size:1.2rem;font-weight:600;}',
      '.sg-flashcard .sg-fc-back{font-size:1rem;color:var(--text2,#94a3b8);}',
      '.sg-cheat-table{width:100%;border-collapse:collapse;font-size:0.83rem;}',
      '.sg-cheat-table th,.sg-cheat-table td{border:1px solid var(--surface2,#334155);padding:6px 8px;vertical-align:top;text-align:left;}',
      '.sg-cheat-table th{background:var(--surface2,#334155);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.04em;position:sticky;top:0;}',
      '.sg-cheat-table td.hi{color:var(--red-fg,#f87171);font-weight:600;}',
      '.sg-input,.sg-select,.sg-textarea{background:var(--surface2,#334155);color:var(--text,#f1f5f9);',
      'border:1px solid var(--surface2,#334155);border-radius:6px;padding:6px 10px;font-size:0.9rem;font-family:inherit;}',
      '.sg-textarea{width:100%;min-height:60px;resize:vertical;}',
      '.sg-note{background:rgba(59,130,246,0.09);border-left:3px solid var(--accent,#3b82f6);',
      'padding:8px 10px;border-radius:0 6px 6px 0;margin:8px 0;font-size:0.85rem;}',
      '.sg-progress{background:var(--surface2,#334155);height:6px;border-radius:999px;overflow:hidden;margin:6px 0;}',
      '.sg-progress > i{display:block;height:100%;background:var(--accent,#3b82f6);border-radius:999px;transition:width 0.25s ease;}',
      '.sg-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;}',
      '@media (max-width:640px){.sg-tab{flex:1 1 45%;text-align:center;}}'
    ].join('');
    var el = document.createElement('style');
    el.id = 'signoff-styles';
    el.textContent = css;
    try { document.head.appendChild(el); } catch (e) {}
  }

  /* -------------------------------------------------------------------------
   * 3. TRAP DETECTION for grading
   * ----------------------------------------------------------------------- */

  /** Given a scenario and a med (rxKey + orderText), enumerate every trap
   * that a competent student would refuse to give. Deterministic (uses only
   * data in the MAR); does not fabricate. */
  function detectTrapsForMed(scenario, med) {
    var out = (med.traps || []).slice(); // start with the scenario-authored traps

    // Add automatic traps: allergy match against generic/brand of the drug.
    var drug = drugById(med.rxKey);
    if (drug && isAllergic(scenario.patient, drug)) {
      // Only add if the scenario didn't already flag it explicitly.
      var already = false;
      for (var i = 0; i < out.length; i++) {
        if (out[i].type === 'allergy_conflict') { already = true; break; }
      }
      if (!already) {
        out.push({ type: 'allergy_conflict', severity: 'critical',
          explain: 'Patient allergy list contains this medication (or a closely matching name). Verify and clarify before giving.' });
      }
    }
    return out;
  }

  /* -------------------------------------------------------------------------
   * 4. MAR PRACTICE - the core loop
   * ----------------------------------------------------------------------- */

  function MARList(props) {
    var scenarios = MARS();
    return ce('div', { className: 'sg-root' },
      ce('div', { className: 'sg-card' },
        ce('h3', null, 'Pick a MAR scenario'),
        ce('div', { className: 'sg-muted' }, 'Each MAR is short (3-5 meds) so you can run the full 6-rights loop repeatedly. Traps are seeded from the spec.')
      ),
      scenarios.map(function (s) {
        var yellow = 0;
        (s.meds || []).forEach(function (m) { if (m.color === 'yellow') yellow++; });
        var trapCount = 0;
        (s.meds || []).forEach(function (m) { trapCount += (m.traps || []).length; });
        return ce('div', { key: s.id, className: 'sg-card' },
          ce('div', { className: 'sg-hd' },
            ce('div', null,
              ce('h3', null, s.title),
              ce('div', { className: 'sg-muted' }, s.patient.name + ' - ' + s.patient.age + ' ' + s.patient.sex + ' - ' + s.admittingDx),
              ce('div', { className: 'sg-muted', style: { marginTop: 4 } },
                'Allergies: ' + (s.patient.allergies || []).join(', ') + ' - Current time: ' + s.currentTime)
            ),
            ce('div', { style: { textAlign: 'right' } },
              ce('div', { className: 'sg-chip acc' }, yellow + ' due'),
              ce('div', { className: 'sg-chip warn', style: { marginTop: 4 } }, trapCount + ' seeded traps')
            )
          ),
          ce('div', { className: 'sg-btnrow' },
            ce('button', { className: 'sg-btn on', onClick: function () { props.onOpen(s); } }, 'Open this MAR')
          )
        );
      })
    );
  }

  function VitalsBlock(props) {
    var v = props.vitals || {};
    var labs = props.labs || {};
    var cells = [];
    function add(label, val) { if (val !== undefined && val !== null && val !== '') cells.push({ l: label, v: String(val) }); }
    add('BP', v.bp); add('HR', v.hr); add('RR', v.rr); add('Temp', v.temp);
    add('SpO2', v.spo2); add('Pain', v.painScore);
    if (labs.k !== undefined)  add('K+', labs.k);
    if (labs.na !== undefined) add('Na+', labs.na);
    if (labs.bg !== undefined) add('BG', labs.bg);
    if (labs.cr !== undefined) add('Cr', labs.cr);
    if (labs.bun !== undefined) add('BUN', labs.bun);
    if (labs.inr !== undefined) add('INR', labs.inr);
    if (labs.dig_level !== undefined) add('Dig lvl', labs.dig_level);
    if (labs.ph !== undefined) add('pH', labs.ph);
    if (labs.bicarb !== undefined) add('HCO3', labs.bicarb);
    if (labs.wbc !== undefined) add('WBC', labs.wbc);
    if (labs.hgb !== undefined) add('Hgb', labs.hgb);
    return ce('div', { className: 'sg-vitals' },
      cells.map(function (c, i) {
        return ce('div', { key: i }, ce('span', null, c.l), c.v);
      }),
      v.notes ? ce('div', { style: { gridColumn: '1/-1', color: 'var(--text2)', fontStyle: 'italic' } }, v.notes) : null
    );
  }

  /** Renders the MAR grid + info panel. Selecting a med starts the workflow. */
  function ScenarioView(props) {
    var scenario = props.scenario;
    var s = useState(null), selected = s[0], setSelected = s[1];
    var meds = scenario.meds || [];

    var dueList = useMemo(function () {
      return meds.filter(function (m) {
        return m.color === 'yellow' || (m.prn && m.color !== 'white');
      });
    }, [meds]);

    return ce('div', { className: 'sg-root' },
      ce('div', { className: 'sg-card' },
        ce('div', { className: 'sg-hd' },
          ce('div', null,
            ce('h3', null, scenario.title),
            ce('div', { className: 'sg-muted' },
              scenario.patient.name + ' - MRN ' + scenario.mrn + ' - ' + scenario.patient.age + ' ' + scenario.patient.sex + ' - ' + scenario.patient.weightKg + ' kg'),
            ce('div', { className: 'sg-muted' }, 'Code: ' + scenario.patient.codeStatus + '   Current time: ' + scenario.currentTime),
            ce('div', { className: 'sg-muted', style: { marginTop: 4 } },
              'Allergies: ',
              ce('strong', { style: { color: 'var(--red,#ef4444)' } }, (scenario.patient.allergies || []).join(', ')))
          ),
          ce('button', { className: 'sg-btn', onClick: props.onBack }, 'Back to MAR list')
        ),
        ce(VitalsBlock, { vitals: scenario.vitals, labs: scenario.labs }),
        ce('div', { className: 'sg-muted', style: { fontSize: '0.82rem' } },
          'Admitting: ' + scenario.admittingDx + '  |  PMH: ' + (scenario.pmh || []).join(', ') +
          '  |  IV: ' + (scenario.patient.iv || []).join('; '))
      ),

      ce('div', { className: 'sg-card' },
        ce('h3', { style: { marginTop: 0 } }, 'MAR'),
        ce('div', { style: { overflowX: 'auto' } },
          ce('table', { className: 'sg-mar-table' },
            ce('thead', null,
              ce('tr', null,
                ce('th', null, 'Medication'), ce('th', null, 'Order'), ce('th', null, 'Scheduled'), ce('th', null, 'Status'), ce('th', null, ''))
            ),
            ce('tbody', null,
              meds.map(function (m, i) {
                var d = drugById(m.rxKey) || { generic: m.rxKey, brand: '', highAlert: false };
                var cellClass = 'sg-cell ' + (m.color || 'white');
                var label = m.color === 'yellow' ? 'DUE' : m.color === 'green' ? 'GIVEN' : m.color === 'red' ? 'HELD' : (m.prn ? 'PRN' : '-');
                return ce('tr', { key: i },
                  ce('td', null,
                    ce('div', { style: { fontWeight: 600 } }, d.generic + (d.brand ? ' (' + d.brand + ')' : '')),
                    d.highAlert ? ce('div', { className: 'sg-chip hi', style: { marginTop: 4 } }, 'HIGH-ALERT') : null),
                  ce('td', null, m.orderText),
                  ce('td', null, (m.scheduledTimes || []).join(', ') || (m.prn ? 'PRN' : '-'),
                    (m.givenTimes && m.givenTimes.length) ? ce('div', { className: 'sg-muted' }, 'Given: ' + m.givenTimes.join(', ')) : null),
                  ce('td', null, ce('div', { className: cellClass }, label)),
                  ce('td', null,
                    (m.color === 'yellow' || (m.prn && m.color !== 'white'))
                      ? ce('button', { className: 'sg-btn on', onClick: function () { setSelected(m); } }, 'Work this med')
                      : ce('span', { className: 'sg-muted' }, '-'))
                );
              })
            )
          )
        ),
        ce('div', { className: 'sg-muted', style: { marginTop: 8, fontSize: '0.8rem' } },
          'Color key: YELLOW = due within +/-1 hr window. GREEN = already given. WHITE = not due. RED = held/DC.'),
        dueList.length === 0 ? ce('div', { className: 'sg-note' }, 'No meds are marked due at the current time. Practice a PRN or open a different scenario.') : null
      ),

      selected ? ce(MedWorkflow, {
        key: selected.rxKey + '-' + (scenario.id || ''),
        scenario: scenario, med: selected,
        onClose: function () { setSelected(null); },
        onFinishAttempt: props.onFinishAttempt
      }) : null
    );
  }

  /** Per-med workflow: teaching panel, 6-rights checkboxes, trap picker,
   * rubric grader, critical-error grid, submit -> attempt object -> onFinishAttempt. */
  function MedWorkflow(props) {
    var scenario = props.scenario, med = props.med;
    var drug = drugById(med.rxKey) || {};
    var trapsAll = useMemo(function () { return detectTrapsForMed(scenario, med); }, [scenario, med]);

    var rightsInit = { patient: false, drug: false, dose: false, route: false, time: false, documentation: false };
    var checksInit = { first: false, second: false, third: false };
    var rst = useState(rightsInit), rights = rst[0], setRights = rst[1];
    var cst = useState(checksInit), checks = cst[0], setChecks = cst[1];

    // rubric scoring per item -> integer 0/1/2 (or undefined if unset)
    var scst = useState({}), scores = scst[0], setScores = scst[1];
    var crst = useState({}), crits = crst[0], setCrits = crst[1];

    // trap picker - the student clicks the traps they identified
    var tst = useState({}), trapsPicked = tst[0], setTrapsPicked = tst[1];

    // action decision: give or hold
    var ast = useState(''), action = ast[0], setAction = ast[1];

    var nst = useState(''), notes = nst[0], setNotes = nst[1];

    var dst = useState(false), done = dst[0], setDone = dst[1];
    var rslt = useState(null), result = rslt[0], setResult = rslt[1];

    function toggleRight(k) { var n = {}; for (var kk in rights) n[kk] = rights[kk]; n[k] = !n[k]; setRights(n); }
    function toggleCheck(k) { var n = {}; for (var kk in checks) n[kk] = checks[kk]; n[k] = !n[k]; setChecks(n); }
    function setLevel(itemId, lvl) {
      var n = {}; for (var kk in scores) n[kk] = scores[kk]; n[itemId] = lvl; setScores(n);
    }
    function toggleCrit(id) {
      var n = {}; for (var kk in crits) n[kk] = crits[kk]; n[id] = !n[id]; setCrits(n);
    }
    function toggleTrap(idx) {
      var n = {}; for (var kk in trapsPicked) n[kk] = trapsPicked[kk]; n[idx] = !n[idx]; setTrapsPicked(n);
    }

    function submit() {
      // total across all rubric items
      var raw = 0, itemCount = 0, perItem = {};
      SIGNOFF_RUBRIC.sections.forEach(function (sec) {
        sec.items.forEach(function (it) {
          itemCount++;
          var v = (typeof scores[it.id] === 'number') ? scores[it.id] : 0;
          if (v < 0) v = 0; if (v > 2) v = 2;
          raw += v;
          perItem[it.id] = v;
        });
      });
      var pct = Math.round(raw * SIGNOFF_RUBRIC.scoreMultiplier);
      var critList = [];
      SIGNOFF_RUBRIC.criticalErrors.forEach(function (c) {
        if (crits[c.id]) critList.push({ id: c.id, text: c.text });
      });
      // trap accounting
      var found = [], missed = [];
      trapsAll.forEach(function (t, i) {
        var picked = !!trapsPicked[i];
        var rec = { type: t.type, severity: t.severity, explain: t.explain };
        if (picked) found.push(rec); else missed.push(rec);
      });
      // If the student chose to GIVE despite a critical trap present, that's a
      // critical error on top of what they marked. Add an implicit critical.
      var critTrapMissed = false;
      for (var i = 0; i < missed.length; i++) { if (missed[i].severity === 'critical') { critTrapMissed = true; break; } }
      if (action === 'give' && critTrapMissed) {
        critList.push({ id: 'implicit_gave_with_critical_trap',
          text: 'Administered despite an unresolved critical trap in the order or patient record.' });
      }
      var passed = critList.length === 0;
      // Also require every starred item to be at least 1 (per the "must PASS all core items" rule).
      // If any starred item is 0, treat as fail (competency not met) but still show the numeric.
      var starredFail = false;
      SIGNOFF_RUBRIC.sections.forEach(function (sec) {
        sec.items.forEach(function (it) {
          if (it.starred && (perItem[it.id] || 0) < 1) starredFail = true;
        });
      });
      if (starredFail) passed = false;

      var attempt = {
        scenarioId: scenario.id,
        medKey: med.rxKey,
        at: Date.now(),
        rawScore: raw,
        maxScore: itemCount * 2,
        percent: pct,
        passed: passed,
        action: action || null,
        criticalErrors: critList,
        perItem: perItem,
        trapsFound: found,
        trapsMissed: missed,
        rights: rights,
        checks: checks,
        notes: notes
      };
      setResult(attempt);
      setDone(true);
      // Persist to Firebase if available.
      if (typeof props.onFinishAttempt === 'function') {
        try { props.onFinishAttempt(attempt); } catch (e) {}
      }
    }

    if (done && result) {
      return ce('div', { className: 'sg-card', style: { borderColor: result.passed ? 'var(--green,#22c55e)' : 'var(--red,#ef4444)', borderWidth: 2 } },
        ce('h3', null, result.passed ? 'PASS' : 'FAIL'),
        ce('div', { className: 'sg-score ' + (result.passed ? 'sg-pass' : 'sg-fail') },
          result.rawScore + ' / ' + result.maxScore + '  ( ' + result.percent + '% )'),
        result.criticalErrors.length ? ce('div', { className: 'sg-card', style: { background: 'rgba(239,68,68,0.08)', borderColor: 'var(--red,#ef4444)' } },
          ce('div', { style: { fontWeight: 700, color: 'var(--red,#ef4444)' } }, 'Critical Errors (automatic fail):'),
          result.criticalErrors.map(function (c, i) { return ce('div', { key: i, style: { marginTop: 4 } }, '- ' + c.text); })
        ) : null,
        result.trapsMissed.length ? ce('div', { className: 'sg-card', style: { background: 'rgba(245,158,11,0.08)', borderColor: 'var(--orange,#f59e0b)' } },
          ce('div', { style: { fontWeight: 700, color: 'var(--orange,#f59e0b)' } }, 'Traps you MISSED:'),
          result.trapsMissed.map(function (t, i) {
            return ce('div', { key: i, className: 'sg-trap ' + (t.severity === 'critical' ? '' : t.severity) },
              ce('strong', null, '[' + t.severity.toUpperCase() + '] ' + t.type), ce('div', null, t.explain));
          })
        ) : null,
        result.trapsFound.length ? ce('div', null,
          ce('div', { style: { fontWeight: 700, color: 'var(--green,#22c55e)', marginTop: 12 } }, 'Traps you caught:'),
          result.trapsFound.map(function (t, i) {
            return ce('div', { key: i, className: 'sg-trap ' + (t.severity === 'critical' ? '' : t.severity) },
              ce('strong', null, '[' + t.severity.toUpperCase() + '] ' + t.type), ce('div', null, t.explain));
          })
        ) : null,
        ce('div', { className: 'sg-btnrow' },
          ce('button', { className: 'sg-btn on', onClick: props.onClose }, 'Close and return to MAR')
        )
      );
    }

    return ce('div', { className: 'sg-card', style: { borderColor: 'var(--accent,#3b82f6)', borderWidth: 2 } },
      ce('div', { className: 'sg-hd' },
        ce('div', null,
          ce('h3', null, drug.generic + (drug.brand ? ' (' + drug.brand + ')' : '')),
          ce('div', { className: 'sg-muted' }, med.orderText),
          drug.highAlert ? ce('div', { className: 'sg-chip hi', style: { marginTop: 6 } }, 'HIGH-ALERT') : null
        ),
        ce('button', { className: 'sg-btn', onClick: props.onClose }, 'Cancel')
      ),

      /* Teaching / drug facts */
      ce('div', { className: 'sg-teach' },
        ce('div', { style: { fontWeight: 700 } }, drug.klass),
        ce('div', null, ce('strong', null, 'Usual adult: '), drug.usualAdultDose),
        drug.holdParameters && drug.holdParameters.length ? ce('div', null,
          ce('strong', { style: { color: 'var(--orange,#f59e0b)' } }, 'HOLD IF: '), drug.holdParameters.join(' | ')) : null,
        drug.ivPushRate ? ce('div', null, ce('strong', null, 'Rate: '), drug.ivPushRate) : null,
        drug.antidote ? ce('div', null, ce('strong', null, 'Antidote / reversal: '), drug.antidote) : null,
        ce('div', { style: { marginTop: 6, fontWeight: 700 } }, 'Critical considerations:'),
        ce('ul', null, (drug.criticalConsiderations || []).map(function (b, i) { return ce('li', { key: i }, b); })),
        ce('div', { style: { fontWeight: 700, marginTop: 6 } }, 'Key teaching:'),
        ce('ul', null, (drug.keyTeaching || []).map(function (b, i) { return ce('li', { key: i }, b); }))
      ),

      /* 3 checks + 6 rights */
      ce('div', { className: 'sg-grid2' },
        ce('div', { className: 'sg-teach' },
          ce('div', { style: { fontWeight: 700 } }, '3 Checks - tap as you perform each'),
          ['first', 'second', 'third'].map(function (k) {
            var label = k === 'first' ? '1. From cart / dispensing system'
                     : k === 'second' ? '2. During preparation'
                     : '3. At bedside with patient';
            return ce('button', { key: k, className: 'sg-btn ' + (checks[k] ? 'on' : ''), onClick: function () { toggleCheck(k); }, style: { display: 'block', width: '100%', margin: '4px 0', textAlign: 'left' } },
              (checks[k] ? '✓ ' : '  ') + label);
          })
        ),
        ce('div', { className: 'sg-teach' },
          ce('div', { style: { fontWeight: 700 } }, '6 Rights - tap as you verify each'),
          ['patient', 'drug', 'dose', 'route', 'time', 'documentation'].map(function (k) {
            var label = 'Right ' + k[0].toUpperCase() + k.slice(1);
            return ce('button', { key: k, className: 'sg-btn ' + (rights[k] ? 'on' : ''), onClick: function () { toggleRight(k); }, style: { display: 'block', width: '100%', margin: '4px 0', textAlign: 'left' } },
              (rights[k] ? '✓ ' : '  ') + label);
          })
        )
      ),

      /* Trap picker */
      ce('div', { className: 'sg-card', style: { background: 'rgba(239,68,68,0.05)', borderColor: 'var(--red,#ef4444)' } },
        ce('div', { style: { fontWeight: 700 } }, 'What traps do you see in this order?'),
        ce('div', { className: 'sg-muted', style: { fontSize: '0.82rem' } },
          'Check every trap you catch. If you check them all AND you HOLD when appropriate, you keep the item. Missing a critical trap = automatic fail.'),
        trapsAll.length === 0 ? ce('div', { className: 'sg-note' }, 'No seeded traps here. If you choose to add one, uncheck them all and give the med.') : null,
        trapsAll.map(function (t, i) {
          return ce('button', { key: i, className: 'sg-btn ' + (trapsPicked[i] ? 'on' : ''), onClick: function () { toggleTrap(i); },
            style: { display: 'block', width: '100%', margin: '6px 0', textAlign: 'left' } },
            (trapsPicked[i] ? '✓ ' : '  ') + '[' + t.severity.toUpperCase() + '] ' + t.type);
        }),
        // Show a couple of decoy fake trap options that are NOT active, so
        // choosing them is a false positive. Keep small so it stays honest.
        // (We deliberately leave this out: the spec grades on caught vs missed
        //  from the trap list authored on the scenario. False positives are
        //  handled by the "give with no traps present" being fine.)
        ce('div', { className: 'sg-btnrow', style: { marginTop: 10 } },
          ce('button', { className: 'sg-btn ' + (action === 'give' ? 'ok' : ''), onClick: function () { setAction('give'); } }, 'DECISION: Give the med'),
          ce('button', { className: 'sg-btn ' + (action === 'hold' ? 'danger' : ''), onClick: function () { setAction('hold'); } }, 'DECISION: Hold and clarify')
        )
      ),

      /* Rubric grading */
      ce('div', { className: 'sg-card' },
        ce('div', { style: { fontWeight: 700 } }, 'Rubric - grade yourself (or your practice partner)'),
        ce('div', { className: 'sg-muted', style: { fontSize: '0.82rem' } },
          'Verbatim from the school skill-check rubric. 20 items x 2 pts = 40 total. Any critical error below = automatic FAIL regardless of score.'),
        SIGNOFF_RUBRIC.sections.map(function (sec) {
          return ce('div', { key: sec.id, style: { marginTop: 10 } },
            ce('div', { style: { fontWeight: 700, color: 'var(--accent,#3b82f6)' } }, sec.label),
            sec.items.map(function (it) {
              return ce('div', { key: it.id, className: 'sg-rubric-item' },
                ce('div', null, (it.starred ? '⚠️ ' : '') + it.text),
                ce('div', { className: 'sg-level-row' },
                  it.levels.map(function (lvl, li) {
                    var on = scores[it.id] === li;
                    return ce('button', { key: li, className: 'sg-level-btn' + (on ? ' on-' + li : ''),
                      onClick: function () { setLevel(it.id, li); } }, li + ' - ' + lvl);
                  })
                )
              );
            })
          );
        })
      ),

      /* Critical errors */
      ce('div', { className: 'sg-card', style: { borderColor: 'var(--red,#ef4444)' } },
        ce('div', { style: { fontWeight: 700, color: 'var(--red,#ef4444)' } }, 'Critical Errors - any = automatic FAIL'),
        SIGNOFF_RUBRIC.criticalErrors.map(function (c) {
          return ce('div', { key: c.id, className: 'sg-crit-item' + (crits[c.id] ? ' on' : ''), onClick: function () { toggleCrit(c.id); } },
            ce('div', null, c.text),
            ce('div', { className: 'sg-chip ' + (crits[c.id] ? 'hi' : '') }, crits[c.id] ? 'Occurred' : 'No'));
        })
      ),

      /* Notes + submit */
      ce('div', { className: 'sg-card' },
        ce('div', { style: { fontWeight: 700 } }, 'Instructor / self notes'),
        ce('textarea', { className: 'sg-textarea', value: notes, onChange: function (e) { setNotes(e.target.value); },
          placeholder: 'Strengths, areas for improvement, teaching points...' }),
        ce('div', { className: 'sg-btnrow' },
          ce('button', { className: 'sg-btn on', onClick: submit,
            disabled: !action },
            'Submit attempt'),
          ce('button', { className: 'sg-btn', onClick: props.onClose }, 'Cancel')
        ),
        !action ? ce('div', { className: 'sg-muted', style: { marginTop: 6 } }, 'Pick a decision (Give or Hold) before submitting.') : null
      )
    );
  }

  /* -------------------------------------------------------------------------
   * 5. CHEAT SHEET
   * ----------------------------------------------------------------------- */

  function CheatSheet() {
    var all = DRUGS();
    var highAlertIds = { digoxin:1, heparin:1, warfarin:1, insulin_regular:1, insulin_nph:1, insulin_humalog:1, kcl:1, hydralazine:1, morphine:1, dilaudid:1, dilantin:1, methergine:1, amiodarone:1, lorazepam:1, cardizem:1 };
    function sortKey(d) { return (highAlertIds[d.id] ? 0 : 1) + '-' + (d.klass || '') + '-' + d.generic; }
    var sorted = all.slice().sort(function (a, b) { return sortKey(a).localeCompare(sortKey(b)); });

    return ce('div', { className: 'sg-root' },
      ce('div', { className: 'sg-card' },
        ce('h3', null, 'Cheat Sheet'),
        ce('div', { className: 'sg-muted' }, 'HIGH-ALERT drugs first, then by class. Print-friendly. If a value looks wrong, defer to the instructor answer key.')
      ),
      ce('div', { className: 'sg-card' },
        ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, 'Antidotes to memorize'),
        ce('ul', null,
          ce('li', null, 'Heparin -> protamine sulfate'),
          ce('li', null, 'Warfarin -> vitamin K (phytonadione); FFP / 4-factor PCC for severe bleed'),
          ce('li', null, 'Digoxin -> digoxin immune Fab (DigiFab)'),
          ce('li', null, 'Opioids (morphine, dilaudid, oxycodone) -> naloxone (Narcan)'),
          ce('li', null, 'Benzodiazepines (lorazepam) -> flumazenil'),
          ce('li', null, 'Hypoglycemia -> glucagon IM / D50 IV'),
          ce('li', null, 'Acetaminophen overdose -> N-acetylcysteine (NAC)'),
          ce('li', null, 'CCB toxicity (cardizem) -> IV calcium gluconate, glucagon, vasopressors')
        )
      ),
      ce('div', { className: 'sg-card' },
        ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, 'Rate rules'),
        ce('ul', null,
          ce('li', null, 'Vancomycin: infuse over AT LEAST 60 min per 1 g (rapid = infusion reaction)'),
          ce('li', null, 'KCl: NEVER IV push. Max 10 mEq/hr peripheral, 20 mEq/hr central'),
          ce('li', null, 'Dilantin (phenytoin): IV push <=50 mg/min adult, <=25 mg/min elderly; saline only, use filter'),
          ce('li', null, 'Dilaudid (hydromorphone) IV push: over 2-3 min'),
          ce('li', null, 'Digoxin IV push: over AT LEAST 5 min'),
          ce('li', null, 'Furosemide IV push: over 1-2 min (max 40 mg/min); rapid = ototoxicity'),
          ce('li', null, 'Lorazepam IV push: <=2 mg/min'),
          ce('li', null, 'Morphine IV push: over 4-5 min, diluted')
        )
      ),
      ce('div', { className: 'sg-card' },
        ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, '6 Rights - Patient / Drug / Dose / Route / Time / Documentation'),
        ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, '3 Checks - Cart / Prep / Bed'),
        ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, 'Injection quick reference'),
        ce('div', { style: { overflowX: 'auto' } },
          ce('table', { className: 'sg-cheat-table' },
            ce('thead', null, ce('tr', null,
              ce('th', null, 'Route'), ce('th', null, 'Gauge'), ce('th', null, 'Length'), ce('th', null, 'Angle'),
              ce('th', null, 'Sites'), ce('th', null, 'Pearls'))),
            ce('tbody', null, INJECTION_REF.map(function (r, i) {
              return ce('tr', { key: i },
                ce('td', null, r.route), ce('td', null, r.gauge), ce('td', null, r.length),
                ce('td', null, r.angle), ce('td', null, r.commonSites), ce('td', null, r.pearls));
            }))
          )
        )
      ),
      ce('div', { className: 'sg-card' },
        ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, 'Insulin trio'),
        ce('ul', null,
          ce('li', null, 'Regular (Humulin R): CLEAR; the ONLY IV-safe insulin; onset 30 min SubQ, peak 2-3 hr, duration 5-7 hr'),
          ce('li', null, 'NPH (Humulin N): CLOUDY; NEVER IV; onset 1-2 hr, peak 4-12 hr, duration 14-24 hr'),
          ce('li', null, 'Humalog (lispro): CLEAR; food at bedside FIRST; onset 15 min, peak 30-90 min, duration 3-5 hr'),
          ce('li', null, 'Mixing: draw Regular FIRST, then NPH (Clear before Cloudy)')
        )
      ),
      ce('div', { className: 'sg-card' },
        ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, 'By drug (HIGH-ALERT first)'),
        ce('div', { style: { overflowX: 'auto' } },
          ce('table', { className: 'sg-cheat-table' },
            ce('thead', null, ce('tr', null,
              ce('th', null, 'Name'), ce('th', null, 'Class'), ce('th', null, 'Hold if'), ce('th', null, 'Antidote / Watch'), ce('th', null, 'Key teaching'))),
            ce('tbody', null, sorted.map(function (d) {
              var hold = (d.holdParameters || []).join(' | ') || '-';
              var watch = d.antidote ? ('Antidote: ' + d.antidote) : ((d.sideEffects || []).slice(0, 2).join(', '));
              var teach = (d.keyTeaching || [])[0] || '';
              return ce('tr', { key: d.id },
                ce('td', { className: d.highAlert ? 'hi' : '' }, (d.highAlert ? '⚠️ ' : '') + d.generic + (d.brand ? ' (' + d.brand + ')' : '')),
                ce('td', null, d.klass),
                ce('td', null, hold),
                ce('td', null, watch),
                ce('td', null, teach)
              );
            }))
          )
        )
      )
    );
  }

  /* -------------------------------------------------------------------------
   * 6. FLASHCARDS + MNEMONICS
   * ----------------------------------------------------------------------- */

  function buildFlashcards() {
    var cards = [];
    var drugs = DRUGS();
    drugs.forEach(function (d) {
      // headline card
      var headline = (d.criticalConsiderations || [])[0] || (d.keyTeaching || [])[0] || d.klass;
      cards.push({ id: 'drug-' + d.id, front: d.generic + (d.brand ? ' (' + d.brand + ')' : '') + '\nKey fact?', back: headline, tags: ['drug', d.klass] });
      // hold rule if present
      if (d.holdParameters && d.holdParameters.length) {
        cards.push({ id: 'hold-' + d.id, front: 'When do you HOLD ' + d.generic + '?', back: d.holdParameters.join(' | '), tags: ['hold'] });
      }
      // antidote card if present
      if (d.antidote) {
        cards.push({ id: 'ant-' + d.id, front: 'Antidote / reversal for ' + d.generic + '?', back: d.antidote, tags: ['antidote'] });
      }
      // rate card
      if (d.ivPushRate) {
        cards.push({ id: 'rate-' + d.id, front: 'IV rate rule for ' + d.generic + '?', back: d.ivPushRate, tags: ['rate'] });
      }
    });
    // Rights + checks
    cards.push({ id: 'six-rights', front: 'Name the 6 Rights of medication administration.', back: 'Patient, Drug, Dose, Route, Time, Documentation.', tags: ['rights'] });
    cards.push({ id: 'three-checks', front: 'Name the 3 Checks.', back: 'From the cart (dispensing), during preparation, at the bedside with patient.', tags: ['rights'] });
    cards.push({ id: 'insulin-mix', front: 'When mixing Regular + NPH insulin, which do you draw first?', back: 'Regular FIRST (clear before cloudy).', tags: ['insulin'] });
    cards.push({ id: 'vanco-reaction', front: 'Patient flushes and itches during IV vancomycin. What is this and what do you do?', back: 'Vancomycin infusion reaction (histamine release, NOT a true allergy). Slow / stop infusion; may resume slower. Consider premedication with diphenhydramine.', tags: ['infusion'] });
    cards.push({ id: 'digoxin-hold', front: 'Apical HR is 54 in an adult on digoxin. What do you do?', back: 'HOLD the dose, notify the provider. (Adult hold threshold is <60. Also check K+ - low K+ potentiates toxicity.)', tags: ['hold'] });
    cards.push({ id: 'methergine-hold', front: 'BP is 158/98 in a postpartum patient and methergine is ordered. What do you do?', back: 'HOLD the methergine. It is a vasoconstrictor - contraindicated in HTN or preeclampsia. Ask for an alternate uterotonic (oxytocin, carboprost, misoprostol).', tags: ['hold'] });
    cards.push({ id: 'metformin-contrast', front: 'Metformin patient has an IV-contrast CT scheduled at noon. What do you do?', back: 'Hold metformin 48 hr before AND after IV contrast - lactic acidosis risk.', tags: ['hold'] });
    return cards;
  }

  function FlashCard(props) {
    var s = useState(false), flipped = s[0], setFlipped = s[1];
    var c = props.card;
    return ce('div', { className: 'sg-flashcard', onClick: function () { setFlipped(!flipped); } },
      ce('div', { className: flipped ? 'sg-fc-back' : 'sg-fc-front', style: { whiteSpace: 'pre-line' } },
        flipped ? c.back : c.front),
      ce('div', { className: 'sg-muted', style: { marginTop: 12, fontSize: '0.75rem' } },
        flipped ? 'Tap to see the question again' : 'Tap to reveal')
    );
  }

  function Flashcards() {
    var cards = useMemo(function () { return buildFlashcards(); }, []);
    var s = useState(0), idx = s[0], setIdx = s[1];
    var f = useState(''), filter = f[0], setFilter = f[1];

    var filtered = useMemo(function () {
      if (!filter) return cards;
      return cards.filter(function (c) { return (c.tags || []).indexOf(filter) !== -1; });
    }, [cards, filter]);

    useEffect(function () { setIdx(0); }, [filter]);
    var current = filtered[idx % (filtered.length || 1)];
    var tags = ['', 'drug', 'hold', 'antidote', 'rate', 'rights', 'insulin', 'infusion'];

    return ce('div', { className: 'sg-root' },
      ce('div', { className: 'sg-card' },
        ce('h3', null, 'Flashcards'),
        ce('div', { className: 'sg-muted' }, 'Tap the card to flip. ' + cards.length + ' cards total.'),
        ce('div', { className: 'sg-btnrow' },
          tags.map(function (t) {
            return ce('button', { key: t, className: 'sg-btn ' + (filter === t ? 'on' : ''), onClick: function () { setFilter(t); } },
              t || 'All');
          })
        )
      ),
      current ? ce('div', { className: 'sg-card' },
        ce(FlashCard, { card: current, key: current.id + '-' + idx }),
        ce('div', { className: 'sg-btnrow', style: { justifyContent: 'space-between' } },
          ce('button', { className: 'sg-btn', onClick: function () { setIdx((idx - 1 + filtered.length) % filtered.length); } }, 'Previous'),
          ce('div', { className: 'sg-muted' }, (idx + 1) + ' / ' + filtered.length),
          ce('button', { className: 'sg-btn on', onClick: function () { setIdx((idx + 1) % filtered.length); } }, 'Next')
        )
      ) : ce('div', { className: 'sg-muted' }, 'No cards in this filter.'),

      ce('div', { className: 'sg-card' },
        ce('h3', null, 'Mnemonics (verbatim)'),
        MNEMONICS.map(function (m) {
          return ce('div', { key: m.key, style: { marginBottom: 10 } },
            ce('div', { style: { fontWeight: 700, color: 'var(--accent,#3b82f6)' } }, m.title),
            ce('div', null, m.body));
        })
      )
    );
  }

  /* -------------------------------------------------------------------------
   * 7. HISTORY panel (from Firebase if available)
   * ----------------------------------------------------------------------- */

  function useAttemptsHistory(authUser) {
    var s = useState([]), items = s[0], setItems = s[1];
    useEffect(function () {
      if (!authUser || !authUser.uid) { setItems([]); return; }
      var db = getDb();
      if (!db) { setItems([]); return; }
      var ref;
      try {
        ref = db.ref('signoffProgress/' + authUser.uid + '/attempts').limitToLast(25);
      } catch (e) { setItems([]); return; }
      var handler = ref.on('value', function (snap) {
        var val = snap && snap.val ? snap.val() : null;
        var arr = [];
        if (val) {
          for (var k in val) { if (Object.prototype.hasOwnProperty.call(val, k)) {
            var it = val[k]; it._id = k; arr.push(it);
          } }
        }
        arr.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
        setItems(arr);
      }, function () { setItems([]); });
      return function () { try { ref.off('value', handler); } catch (e) {} };
    }, [authUser && authUser.uid]);
    return items;
  }

  /* -------------------------------------------------------------------------
   * 8. TOP-LEVEL PAGE
   * ----------------------------------------------------------------------- */

  function SignoffTrainer(props) {
    useEffect(injectStyles, []);
    var authUser = (props && props.authUser) || (window.MM && window.MM.authUser) || null;

    var t = useState('mar'), tab = t[0], setTab = t[1];
    var s = useState(null), openScenario = s[0], setOpenScenario = s[1];

    var attempts = useAttemptsHistory(authUser);

    function persistAttempt(attempt) {
      var db = getDb();
      if (!db || !authUser || !authUser.uid) {
        toast('Attempt saved locally (sign in for cloud history).', 'info');
        return;
      }
      try {
        var ref = db.ref('signoffProgress/' + authUser.uid + '/attempts');
        var key = ref.push().key;
        var record = {
          scenarioId: attempt.scenarioId,
          medKey: attempt.medKey,
          at: attempt.at,
          rawScore: attempt.rawScore,
          maxScore: attempt.maxScore,
          percent: attempt.percent,
          passed: attempt.passed,
          action: attempt.action || null,
          criticalErrors: attempt.criticalErrors || [],
          perItem: attempt.perItem || {},
          trapsFound: (attempt.trapsFound || []).map(function (x) { return { type: x.type, severity: x.severity }; }),
          trapsMissed: (attempt.trapsMissed || []).map(function (x) { return { type: x.type, severity: x.severity }; })
        };
        ref.child(key).set(record).then(function () {
          toast('Attempt saved to your history.', 'success');
        }).catch(function () { toast('Could not save attempt to cloud.', 'error'); });
        // Update streak counters (best-effort)
        try {
          var sRef = db.ref('signoffProgress/' + authUser.uid + '/streaks');
          sRef.transaction(function (curr) {
            var c = curr || { attempted: 0, passed: 0, lastAttemptAt: 0 };
            c.attempted = (c.attempted || 0) + 1;
            if (attempt.passed) c.passed = (c.passed || 0) + 1;
            c.lastAttemptAt = attempt.at;
            return c;
          });
        } catch (e2) {}
      } catch (e) { toast('Could not save attempt.', 'error'); }
    }

    function TabButton(id, label) {
      return ce('button', { className: 'sg-tab' + (tab === id ? ' on' : ''), onClick: function () { setTab(id); } }, label);
    }

    var body;
    if (tab === 'mar') {
      body = openScenario
        ? ce(ScenarioView, { scenario: openScenario, onBack: function () { setOpenScenario(null); }, onFinishAttempt: persistAttempt })
        : ce(MARList, { onOpen: function (s) { setOpenScenario(s); } });
    } else if (tab === 'cheat') {
      body = ce(CheatSheet);
    } else if (tab === 'flash') {
      body = ce(Flashcards);
    } else if (tab === 'history') {
      body = ce('div', { className: 'sg-root' },
        ce('div', { className: 'sg-card' },
          ce('h3', null, 'Attempt history'),
          ce('div', { className: 'sg-muted' }, authUser ? 'Signed in as ' + (authUser.displayName || authUser.email || authUser.uid) : 'Sign in to save attempts to the cloud.'),
          attempts.length === 0 ? ce('div', { className: 'sg-note' }, 'No attempts saved yet. Complete a MAR practice above to see results here.') : null,
          attempts.map(function (a) {
            return ce('div', { key: a._id, className: 'sg-card', style: { marginTop: 8, borderColor: a.passed ? 'var(--green,#22c55e)' : 'var(--red,#ef4444)' } },
              ce('div', { className: 'sg-hd' },
                ce('div', null,
                  ce('div', { style: { fontWeight: 700 } }, (a.scenarioId || '?') + '  -  ' + (a.medKey || '?')),
                  ce('div', { className: 'sg-muted' }, new Date(a.at || 0).toLocaleString())
                ),
                ce('div', { className: 'sg-score ' + (a.passed ? 'sg-pass' : 'sg-fail') }, (a.rawScore || 0) + '/' + (a.maxScore || 40) + '  (' + (a.percent || 0) + '%)')
              ),
              (a.criticalErrors && a.criticalErrors.length) ? ce('div', { style: { color: 'var(--red,#ef4444)', fontSize: '0.85rem' } },
                'Criticals: ' + a.criticalErrors.map(function (c) { return c.text || c.id; }).join('; ')) : null,
              (a.trapsMissed && a.trapsMissed.length) ? ce('div', { className: 'sg-muted', style: { fontSize: '0.82rem' } },
                'Traps missed: ' + a.trapsMissed.map(function (t) { return '[' + t.severity + '] ' + t.type; }).join(', ')) : null
            );
          })
        )
      );
    } else {
      body = null;
    }

    return ce('div', { className: 'sg-root' },
      ce('div', { className: 'sg-card', style: { background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))', borderColor: 'var(--accent,#3b82f6)' } },
        ce('h2', { style: { margin: '0 0 6px' } }, 'Med Admin Signoff Sim'),
        ce('div', { className: 'sg-muted' }, 'The focused practice mode for the school medication administration skills check. Drug list, MAR format, and rubric are the ones your instructor actually uses.')
      ),
      ce('div', { className: 'sg-tabs' },
        TabButton('mar', 'MAR Practice'),
        TabButton('cheat', 'Cheat Sheet'),
        TabButton('flash', 'Flashcards + Mnemonics'),
        TabButton('history', 'History')
      ),
      body
    );
  }

  window.SignoffTrainer = SignoffTrainer;
})();
