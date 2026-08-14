/* =============================================================================
 * data/medsim-rubric.js  ->  window.MEDSIM_RUBRIC
 * -----------------------------------------------------------------------------
 * The Med-Admin Simulation rubric-mapping table: MEDSIM_SPEC/architecture.md §5,
 * cross-checked line-by-line against SIGNOFF_SPEC/rubric_verbatim.txt and against
 * the already-shipped iOS transcription in
 * MedMaster/Features/MedSim/MedSimRubric.swift.
 *
 * 29 items. 14 marked `critical: true`:
 *   - the 9 explicit "Critical Errors - Automatic Fail" bullets from the rubric
 *     docx (wrong_patient, wrong_patient_medication, wrong_drug, wrong_dose,
 *     wrong_route, allergy_not_checked, bedside_skipped, no_hand_hygiene,
 *     sharps_violation), and
 *   - the 5 items the docx marks with ⚠️ in its Patient Safety / Safety
 *     Techniques sections that this engine can objectively adjudicate:
 *     third_check, two_identifiers, allergy_check, right_documentation,
 *     hand_hygiene_asepsis.
 *
 * NOTE ON THE 9th CRITICAL ERROR: architecture.md §5's table folds "Wrong
 * patient" and "Wrong patient medication administered" into a single row (8
 * critical rows) even though its own prose says "9 critical errors" and
 * rubric_verbatim.txt lists them as two distinct bullets. Both are restored as
 * separate criteria here, matching MedSimRubric.swift, so nothing from the
 * verbatim rubric is silently dropped and the two platforms agree item-for-item.
 *
 * RubricCriterion shape (architecture.md §4, plus the same two extensions the
 * iOS file documents — an OR list and an explicit chronology pair):
 *   {
 *     id, title,            // `title` mirrors the iOS short title exactly
 *     detail,               // the verbatim rubric-docx sentence, for display
 *     section,              // critical_errors | verification | patient_safety
 *                           // | clinical_judgment | safety_techniques
 *                           // | education | additional
 *     maxScore: 2,
 *     critical: bool,
 *     requiredEvents:    [EventType],   // ALL must be present
 *     requiredEventsAny: [EventType],   // at least ONE must be present
 *     forbiddenEvents:   [EventType],   // any present => 0 (+ critical flag)
 *     chronologyRules:   [{ event, mustPrecede }],
 *     aiEvaluation:      { enabled, windowPhases: [AttemptPhase], evaluationPrompt },
 *     conditionalOnScenario: bool       // documents intent; the SCENARIO's
 *                                       // rubricOverrides is what actually flips
 *                                       // notApplicable at scoring time
 *   }
 *
 * Every field is optional except id/title/section/maxScore/critical; js/medsim.js
 * normalises missing arrays to [] so this table stays readable.
 * ========================================================================== */
(function () {
  'use strict';

  var RUBRIC = [

    /* ======================================================================
     * CRITICAL ERRORS (9) — automatic FAIL when scored 0.
     * No aiEvaluation on any of these: the brief and §10's conflict rule both
     * say objective event data alone decides critical items. An AI verdict is
     * never even requested for a criterion with no aiEvaluation block.
     * ==================================================================== */

    {
      id: 'wrong_patient',
      title: 'Wrong patient (critical)',
      detail: 'Wrong patient.',
      section: 'critical_errors', maxScore: 2, critical: true,
      forbiddenEvents: ['administered_wrong_patient']
    },
    {
      id: 'wrong_patient_medication',
      title: 'Wrong patient medication administered (critical)',
      detail: 'Wrong patient medication administered.',
      section: 'critical_errors', maxScore: 2, critical: true,
      forbiddenEvents: ['administered_wrong_patient_medication']
    },
    {
      id: 'wrong_drug',
      title: 'Wrong drug administered (critical)',
      detail: 'Wrong drug administered.',
      section: 'critical_errors', maxScore: 2, critical: true,
      forbiddenEvents: ['administered_wrong_drug']
    },
    {
      id: 'wrong_dose',
      title: 'Wrong dose / calculation error (critical)',
      detail: 'Wrong dose (calculation error).',
      section: 'critical_errors', maxScore: 2, critical: true,
      forbiddenEvents: ['administered_wrong_dose']
    },
    {
      id: 'wrong_route',
      title: 'Wrong route (critical)',
      detail: 'Wrong route of administration.',
      section: 'critical_errors', maxScore: 2, critical: true,
      forbiddenEvents: ['administered_wrong_route']
    },
    {
      id: 'allergy_not_checked',
      title: 'Allergy not checked / checked incorrectly (critical)',
      detail: 'Allergy not checked/checked incorrectly.',
      section: 'critical_errors', maxScore: 2, critical: true,
      requiredEventsAny: ['allergy_question_asked', 'mar_allergies_viewed'],
      chronologyRules: [
        { event: 'allergy_question_asked', mustPrecede: 'medication_administered' },
        { event: 'mar_allergies_viewed', mustPrecede: 'medication_administered' }
      ]
    },
    {
      id: 'bedside_skipped',
      title: 'Bedside verification skipped (critical)',
      detail: 'Bedside verification skipped.',
      section: 'critical_errors', maxScore: 2, critical: true,
      requiredEvents: ['bedside_check_started'],
      chronologyRules: [
        { event: 'bedside_check_started', mustPrecede: 'medication_administered' }
      ]
    },
    {
      id: 'no_hand_hygiene',
      title: 'No hand hygiene before preparation (critical)',
      detail: 'No hand hygiene before preparation.',
      section: 'critical_errors', maxScore: 2, critical: true,
      requiredEvents: ['hand_hygiene_performed'],
      chronologyRules: [
        { event: 'hand_hygiene_performed', mustPrecede: 'medication_preparation_started' }
      ]
    },
    {
      id: 'sharps_violation',
      title: 'Sharps safety violation (critical)',
      detail: 'Sharps safety violation (recapped needle, left on surface, improper disposal).',
      section: 'critical_errors', maxScore: 2, critical: true,
      forbiddenEvents: ['sharps_violation'],
      conditionalOnScenario: true
    },

    /* ======================================================================
     * MEDICATION VERIFICATION CHECKS (3)
     * ==================================================================== */

    {
      id: 'first_check',
      title: 'First Check (at dispensing)',
      detail: 'First Check: Compares medication with MAR when removing from dispensing system. Verbalizes name, dose, route, time. Checks expiration and drug form.',
      section: 'verification', maxScore: 2, critical: false,
      requiredEvents: ['medication_removed'],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['check1'],
        evaluationPrompt: 'Rubric item: "First Check: Compares medication with MAR when removing from dispensing system. Verbalizes name, dose, route, time. Checks expiration and drug form." Using ONLY the transcript window provided, judge whether the student verbalized the medication name, dose, route, and time, and mentioned checking the expiration date and drug form while removing the medication. Score 0 = did not perform the check, 1 = incomplete or inaccurate check, 2 = correctly performed check. If the transcript gives no clear evidence either way, return score 0 — do not infer that the student did something not actually said.'
      }
    },
    {
      id: 'second_check',
      title: 'Second Check (at preparation)',
      detail: 'Second Check: Compares medication again during preparation. Verifies calculation accuracy. Checks expiration on prepared medication. Performs hand hygiene before prep.',
      section: 'verification', maxScore: 2, critical: false,
      requiredEvents: ['medication_preparation_started', 'hand_hygiene_performed'],
      chronologyRules: [
        { event: 'hand_hygiene_performed', mustPrecede: 'medication_preparation_started' }
      ],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['preparation'],
        evaluationPrompt: 'Rubric item: "Second Check: Compares medication again during preparation. Verifies calculation accuracy. Checks expiration on prepared medication. Performs hand hygiene before prep." Using ONLY the transcript window provided, judge whether the student re-compared the medication during preparation and verified expiration/calculation. Score 0 = did not perform, 1 = incomplete or inaccurate, 2 = correctly performed. If there is no clear evidence, return score 0 rather than inferring.'
      }
    },
    {
      id: 'third_check',
      title: 'Third Check (bedside)',
      detail: 'Third Check (Bedside): Compares medication with MAR at bedside with patient present. States patient name, medication name, dose, route, time.',
      section: 'verification', maxScore: 2, critical: true,
      requiredEvents: ['bedside_check_started'],
      chronologyRules: [
        { event: 'bedside_check_started', mustPrecede: 'medication_administered' }
      ],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['return_to_bedside', 'check3'],
        evaluationPrompt: 'Rubric item: "Third Check (Bedside): Compares medication with MAR at bedside with patient present. States patient name, medication name, dose, route, time." Using ONLY the transcript window provided, judge whether the student stated the patient\'s name, the medication name, dose, route, and time while at the bedside with the patient present. Score 0 = did not perform, 1 = incomplete or inaccurate, 2 = correctly performed. Note: a required physical bedside-check event must also have fired for this criterion to receive any credit at all — the engine enforces that separately and will zero out your score if it did not fire, so score only the QUALITY of what was said, not whether a check happened.'
      }
    },

    /* ======================================================================
     * PATIENT SAFETY (7)
     * ==================================================================== */

    {
      id: 'two_identifiers',
      title: 'Two Patient Identifiers',
      detail: 'Two Patient Identifiers: Verifies using name & date of birth (NOT room number or age).',
      section: 'patient_safety', maxScore: 2, critical: true,
      requiredEvents: ['patient_name_requested', 'patient_dob_requested'],
      chronologyRules: [
        { event: 'patient_name_requested', mustPrecede: 'medication_administered' },
        { event: 'patient_dob_requested', mustPrecede: 'medication_administered' }
      ],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['assessment', 'return_to_bedside', 'check3'],
        evaluationPrompt: 'Rubric item: "Two Patient Identifiers: Verifies using name & date of birth (NOT room number or age)." Using ONLY the transcript window provided, confirm the student used the patient\'s NAME and DATE OF BIRTH specifically — not room number, not age — to verify identity. Score 0 = did not verify, 1 = incomplete verification (e.g. only one identifier, or used room number/age instead of DOB), 2 = correctly verified both identifiers. Return score 0 if the transcript doesn\'t clearly show this rather than assuming it happened off-screen.'
      }
    },
    {
      id: 'allergy_check',
      title: 'Allergy Check',
      detail: 'Allergy Check: Asks patient about allergies, checks allergy band, verifies MAR. Reports concerns before administering.',
      section: 'patient_safety', maxScore: 2, critical: true,
      requiredEvents: ['allergy_question_asked', 'wristband_viewed', 'mar_allergies_viewed'],
      chronologyRules: [
        { event: 'allergy_question_asked', mustPrecede: 'medication_administered' },
        { event: 'wristband_viewed', mustPrecede: 'medication_administered' },
        { event: 'mar_allergies_viewed', mustPrecede: 'medication_administered' }
      ],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['assessment', 'check1', 'return_to_bedside', 'check3'],
        evaluationPrompt: 'Rubric item: "Allergy Check: Asks patient about allergies, checks allergy band, verifies MAR. Reports concerns before administering." Using ONLY the transcript window provided, judge whether the student asked the patient about allergies (and, if the patient reports one, whether the student reported/acted on it before administering). Score 0 = did not check, 1 = incomplete or inaccurate check, 2 = correctly checked and reported. Return score 0 if the transcript does not clearly show this.'
      }
    },
    {
      id: 'right_drug',
      title: 'Right Drug matches order',
      detail: 'Right Drug: Matches order/MAR exactly.',
      section: 'patient_safety', maxScore: 2, critical: false,
      requiredEvents: ['medication_removed']
      /* No aiEvaluation: deterministic only — medsim.js compares the removed
         event's meta.medId against scenario.orders[0].medId (§5/§10). */
    },
    {
      id: 'right_dose',
      title: 'Right Dose / calculation',
      detail: 'Right Dose: Correct calculation. Shows weight-based conversions (kg = lbs ÷ 2.2) and IV rates if applicable.',
      section: 'patient_safety', maxScore: 2, critical: false,
      /* requiredEvents gains `dose_calculated` at scoring time only when
         scenario.requiresCalculation is true — added dynamically in medsim.js
         rather than statically here, since it is scenario-conditional (§5). */
      aiEvaluation: {
        enabled: true,
        windowPhases: ['check1', 'preparation'],
        evaluationPrompt: 'Rubric item: "Right Dose: Correct calculation. Shows weight-based conversions (kg = lbs ÷ 2.2) and IV rates if applicable." Using ONLY the transcript window provided, judge whether the student verbalized confirming the dose matches the order (and, if this scenario requires a calculation, whether the math was shown correctly). Score 0 = did not calculate/confirm, 1 = incomplete or inaccurate, 2 = correctly calculated/confirmed. Return score 0 without clear evidence.'
      }
    },
    {
      id: 'right_route',
      title: 'Right Route + patient assessed for it',
      detail: 'Right Route: Matches order. Assesses patient ability to receive via that route. Correct drug form for route.',
      section: 'patient_safety', maxScore: 2, critical: false,
      aiEvaluation: {
        enabled: true,
        windowPhases: ['assessment', 'check1', 'return_to_bedside', 'check3'],
        evaluationPrompt: 'Rubric item: "Right Route: Matches order. Assesses patient ability to receive via that route. Correct drug form for route." Using ONLY the transcript window provided, judge whether the student assessed the patient\'s ability to receive the medication via the ordered route (e.g. ability to swallow for a PO tablet). Score 0 = did not assess, 1 = incomplete assessment, 2 = correctly assessed. Return score 0 without clear evidence.'
      }
    },
    {
      id: 'right_time',
      title: 'Right Time',
      detail: 'Right Time: Administers at the correct time.',
      section: 'patient_safety', maxScore: 2, critical: false,
      requiredEvents: ['medication_administered']
      /* No aiEvaluation: deterministic only — medsim.js maps the administration
         event's `t` onto the sim clock and compares against the order's
         scheduledTime, ±60 minutes (§5/§10). */
    },
    {
      id: 'right_documentation',
      title: 'Right Documentation (documents AFTER, not before)',
      detail: 'Right Documentation: DOCUMENTS AFTER administering (not before). Includes medication name, dose, route, time, site, patient response, signature.',
      section: 'patient_safety', maxScore: 2, critical: true,
      requiredEvents: ['medication_documented'],
      forbiddenEvents: ['documented_before_administration'],
      chronologyRules: [
        { event: 'medication_administered', mustPrecede: 'medication_documented' }
      ]
    },

    /* ======================================================================
     * CLINICAL JUDGMENT & ASSESSMENT (4)
     * ==================================================================== */

    {
      id: 'pre_admin_assessment',
      title: 'Pre-Administration Assessment',
      detail: 'Pre-Administration Assessment: Reviews vital signs, lab values, patient ability to swallow, injection site assessment.',
      section: 'clinical_judgment', maxScore: 2, critical: false,
      requiredEventsAny: ['vitals_viewed', 'labs_viewed'],
      chronologyRules: [
        { event: 'vitals_viewed', mustPrecede: 'medication_administered' },
        { event: 'labs_viewed', mustPrecede: 'medication_administered' }
      ],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['assessment'],
        evaluationPrompt: 'Rubric item: "Pre-Administration Assessment: Reviews vital signs, lab values, patient ability to swallow, injection site assessment." Using ONLY the transcript window provided, judge whether the student assessed what is clinically relevant here (vital signs, ability to swallow — this scenario has no labs or injection site). Score 0 = did not assess, 1 = incomplete assessment, 2 = correctly assessed. Return score 0 without clear evidence.'
      }
    },
    {
      id: 'right_reason',
      title: 'Right Reason verbalized',
      detail: 'Right Reason: Verbalizes clinical reason or indication for medication.',
      section: 'clinical_judgment', maxScore: 2, critical: false,
      aiEvaluation: {
        enabled: true,
        windowPhases: ['assessment', 'education', 'administration'],
        evaluationPrompt: 'Rubric item: "Right Reason: Verbalizes clinical reason or indication for medication." Using ONLY the transcript window provided, judge whether the student verbalized WHY the patient is receiving this medication (chronic pain). Score 0 = did not verbalize, 1 = incomplete verbalization, 2 = correctly verbalized. Return score 0 without clear evidence.'
      }
    },
    {
      id: 'patient_education',
      title: 'Right Patient Education',
      detail: 'Right Patient Education: Explains medication purpose, expected effects, and side effects to report. Verifies understanding.',
      section: 'clinical_judgment', maxScore: 2, critical: false,
      requiredEvents: ['patient_education_given'],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['education'],
        evaluationPrompt: 'Rubric item: "Right Patient Education: Explains medication purpose, expected effects, and side effects to report. Verifies understanding." Using ONLY the transcript window provided, judge whether the student explained the medication\'s purpose, expected effects, side effects to report, and verified the patient\'s understanding (teach-back). Score 0 = did not educate, 1 = incomplete education, 2 = effectively educated. Return score 0 without clear evidence.'
      }
    },
    {
      id: 'drug_guide_use',
      title: 'Right Use of Drug Guide',
      detail: 'Right Use of Drug Guide: Demonstrates proper use of drug guide to verify medication information, including class, indications, and contraindications.',
      section: 'clinical_judgment', maxScore: 2, critical: false,
      requiredEvents: ['drug_guide_opened'],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['retrieval', 'check1', 'preparation'],
        evaluationPrompt: 'Rubric item: "Right Use of Drug Guide: Demonstrates proper use of drug guide to verify medication information, including class, indications, and contraindications." Using ONLY the transcript window provided, judge whether the student correctly stated the medication\'s class, indication, or contraindications after opening the drug guide. Score 0 = did not demonstrate, 1 = incomplete demonstration, 2 = correctly demonstrated. Return score 0 without clear evidence.'
      }
    },

    /* ======================================================================
     * SAFETY TECHNIQUES (3)
     * ==================================================================== */

    {
      id: 'hand_hygiene_asepsis',
      title: 'Hand Hygiene & Asepsis',
      detail: 'Hand Hygiene & Asepsis: Performs hand hygiene before prep. Maintains aseptic technique. For injections: 20-second antiseptic scrub with friction, air dry. Correct needle size.',
      section: 'safety_techniques', maxScore: 2, critical: true,
      requiredEvents: ['hand_hygiene_performed'],
      chronologyRules: [
        { event: 'hand_hygiene_performed', mustPrecede: 'medication_preparation_started' }
      ]
    },
    {
      id: 'injection_technique',
      title: 'Injection Technique (N/A — no injection this scenario)',
      detail: 'Injection Technique (if applicable): Correct anatomical landmark. Proper needle angle. Smooth insertion. Aspirates for IM if required. Does NOT massage heparin sites. Sharps in container immediately.',
      section: 'safety_techniques', maxScore: 2, critical: false,
      conditionalOnScenario: true,
      aiEvaluation: {
        enabled: true,
        windowPhases: ['administration'],
        evaluationPrompt: 'Rubric item: "Injection Technique: Correct anatomical landmark. Proper needle angle. Smooth insertion. Aspirates for IM if required. Does NOT massage heparin sites. Sharps in container immediately." Using ONLY the transcript window provided, score the injection technique described. Score 0/1/2 per the rubric levels. Return score 0 without clear evidence. (Kept for future injection scenarios — this criterion is marked notApplicable for the Phase-1 oral scenario.)'
      }
    },
    {
      id: 'limiting_distractions',
      title: 'Limiting Distractions',
      detail: 'Limiting Distractions: Minimizes interruptions. Remains focused. Demonstrates "no interruption zone" awareness.',
      section: 'safety_techniques', maxScore: 2, critical: false,
      conditionalOnScenario: true,
      aiEvaluation: {
        enabled: true,
        windowPhases: ['orientation', 'assessment', 'retrieval', 'check1', 'preparation', 'check2',
                       'return_to_bedside', 'check3', 'education', 'administration', 'disposal',
                       'reassessment', 'documentation', 'complete'],
        evaluationPrompt: 'Rubric item: "Limiting Distractions: Minimizes interruptions. Remains focused. Demonstrates \'no interruption zone\' awareness." Using ONLY the transcript window provided, score how the student handled any scenario-triggered distraction. Score 0/1/2 per the rubric levels. Return score 0 without clear evidence. (Kept for future distraction scenarios — this criterion is marked notApplicable when the scenario defines no distractions.)'
      }
    },

    /* ======================================================================
     * PATIENT EDUCATION & COMMUNICATION (1)
     * ==================================================================== */

    {
      id: 'professionalism',
      title: 'Professionalism & Respect',
      detail: 'Professionalism & Respect: Uses clear, therapeutic communication. Maintains privacy and dignity. Demonstrates cultural sensitivity.',
      section: 'education', maxScore: 2, critical: false,
      aiEvaluation: {
        enabled: true,
        windowPhases: ['assessment', 'retrieval', 'check1', 'preparation', 'return_to_bedside',
                       'check3', 'education', 'administration', 'reassessment', 'documentation'],
        evaluationPrompt: 'Rubric item: "Professionalism & Respect: Uses clear, therapeutic communication. Maintains privacy and dignity. Demonstrates cultural sensitivity." Using ONLY the transcript window provided, judge the student\'s tone and communication with the patient across the whole encounter. Score 0 = did not demonstrate, 1 = partial demonstration, 2 = fully demonstrated. Return score 0 without clear evidence.'
      }
    },

    /* ======================================================================
     * ADDITIONAL CONSIDERATIONS (2)
     * ==================================================================== */

    {
      id: 'special_precautions',
      title: 'Special Precautions',
      detail: 'Special Precautions: Holds medications based on lab values. Assesses contraindications. Reviews drug interactions. Monitors for adverse effects.',
      section: 'additional', maxScore: 2, critical: false,
      conditionalOnScenario: true,
      aiEvaluation: {
        enabled: true,
        windowPhases: ['assessment', 'administration', 'reassessment'],
        evaluationPrompt: 'Rubric item: "Special Precautions: Holds medications based on lab values. Assesses contraindications. Reviews drug interactions. Monitors for adverse effects." Using ONLY the transcript window provided, judge whether the student assessed the scenario\'s hold parameters (respiratory rate, sedation level for this opioid) and monitored for adverse effects. Score 0 = did not assess, 1 = incomplete assessment, 2 = correctly assessed. Return score 0 without clear evidence.'
      }
    },
    {
      id: 'expiration_check',
      title: 'Expiration Dates Checked',
      detail: 'Expiration Dates: All medications checked for expiration.',
      section: 'additional', maxScore: 2, critical: false,
      /* requiredEvents gains `expired_medication_rejected` at scoring time only
         when scenario.expiredMedicationPresent is true — the "deterministic if
         the scenario plants an expired med" branch in §5. */
      aiEvaluation: {
        enabled: true,
        windowPhases: ['check1', 'preparation'],
        evaluationPrompt: 'Rubric item: "Expiration Dates: All medications checked for expiration." Using ONLY the transcript window provided, judge whether the student mentioned checking the expiration date at first check and/or during preparation. Score 0 = did not check, 1 = incomplete checks, 2 = correctly checked. Return score 0 without clear evidence.'
      }
    }
  ];

  /* Section display order + labels, mirroring MedSimRubricSection.title on iOS. */
  var SECTIONS = [
    { id: 'critical_errors',   label: 'Critical Errors' },
    { id: 'verification',      label: 'Medication Verification Checks' },
    { id: 'patient_safety',    label: 'Patient Safety' },
    { id: 'clinical_judgment', label: 'Clinical Judgment & Assessment' },
    { id: 'safety_techniques', label: 'Safety Techniques' },
    { id: 'education',         label: 'Patient Education & Communication' },
    { id: 'additional',        label: 'Additional Considerations' }
  ];

  window.MEDSIM_RUBRIC = RUBRIC;
  window.MEDSIM_RUBRIC_SECTIONS = SECTIONS;
})();
