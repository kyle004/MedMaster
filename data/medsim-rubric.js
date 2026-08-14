/* =============================================================================
 * data/medsim-rubric.js  ->  window.MEDSIM_RUBRIC
 * -----------------------------------------------------------------------------
 * The Med-Admin Simulation rubric-mapping table, transcribed verbatim from
 * MEDSIM_SPEC/architecture.md section 5 (which is itself re-mapped from
 * SIGNOFF_SPEC/rubric_verbatim.txt into the richer RubricCriterion shape
 * architecture.md section 4 defines). If a value here disagrees with
 * architecture.md, architecture.md wins — this file is a straight transcription,
 * not a reinterpretation.
 *
 * RubricCriterion shape (architecture.md section 4):
 *   { id, title, section, maxScore:2, critical,
 *     requiredEvents?: (EventType | {anyOf: EventType[]})[],
 *       -- a plain string is an AND slot; {anyOf:[...]} is an OR slot (the
 *          table's "X OR Y" phrasing, e.g. allergy_not_checked, pre_admin_assessment).
 *     forbiddenEvents?: EventType[],
 *     chronologyRules?: { eventType?: EventType, before?: EventType, after?: EventType }[],
 *       -- `eventType` names which requiredEvents slot the rule applies to; if
 *          omitted the rule applies to every requiredEvents slot on this criterion.
 *     aiEvaluation?: { enabled, windowPhases: AttemptPhase[], evaluationPrompt } }
 *
 * NOTE on the "9 critical errors" count (architecture.md section 5 intro says
 * "9 critical errors" but SIGNOFF_SPEC/rubric_verbatim.txt's Critical-Errors box
 * lists 9 bullets while architecture.md's own table only assigns 8 distinct ids
 * — "Wrong patient medication administered" has no separate row from
 * "Wrong patient"). Transcribed exactly as architecture.md's table gives it
 * (8 forbidden-event rows below); not invented a 9th row unilaterally since the
 * table, not the prose count, is the literal spec to transcribe. Flagged here so
 * it isn't mistaken for an oversight on this file's part.
 *
 * notApplicable handling: scenario-conditional rows carry no ` notApplicable`
 * flag here (that is a per-attempt property computed against the scenario, see
 * js/medsim.js `isNotApplicable`) — a scenario may also force one directly via
 * `scenario.rubricOverrides`.
 * ========================================================================== */
(function () {
  'use strict';

  var RUBRIC = [

    /* ===================== Critical Errors (automatic fail) =================== */

    {
      id: 'wrong_patient', title: 'Wrong patient (critical)',
      section: 'critical_errors', maxScore: 2, critical: true,
      forbiddenEvents: ['administered_wrong_patient']
    },
    {
      id: 'wrong_drug', title: 'Wrong drug administered (critical)',
      section: 'critical_errors', maxScore: 2, critical: true,
      forbiddenEvents: ['administered_wrong_drug']
    },
    {
      id: 'wrong_dose', title: 'Wrong dose / calculation error (critical)',
      section: 'critical_errors', maxScore: 2, critical: true,
      forbiddenEvents: ['administered_wrong_dose']
    },
    {
      id: 'wrong_route', title: 'Wrong route of administration (critical)',
      section: 'critical_errors', maxScore: 2, critical: true,
      forbiddenEvents: ['administered_wrong_route']
    },
    {
      id: 'allergy_not_checked', title: 'Allergy not checked / checked incorrectly (critical)',
      section: 'critical_errors', maxScore: 2, critical: true,
      requiredEvents: [{ anyOf: ['allergy_question_asked', 'mar_allergies_viewed'] }],
      chronologyRules: [{ before: 'medication_administered' }]
    },
    {
      id: 'bedside_skipped', title: 'Bedside verification skipped (critical)',
      section: 'critical_errors', maxScore: 2, critical: true,
      requiredEvents: ['bedside_check_started'],
      chronologyRules: [{ before: 'medication_administered' }]
    },
    {
      id: 'no_hand_hygiene', title: 'No hand hygiene before preparation (critical)',
      section: 'critical_errors', maxScore: 2, critical: true,
      requiredEvents: ['hand_hygiene_performed'],
      chronologyRules: [{ before: 'medication_preparation_started' }]
    },
    {
      id: 'sharps_violation', title: 'Sharps safety violation (critical)',
      section: 'critical_errors', maxScore: 2, critical: true,
      forbiddenEvents: ['sharps_violation'],
      /* No injection this scenario -> notApplicable per architecture.md section 13
         ("injection-specific ones marked notApplicable"). js/medsim.js's
         isNotApplicable() checks scenario.rubricOverrides for this id. */
      phase2Only: true
    },

    /* ===================== Medication Verification Checks ===================== */

    {
      id: 'first_check',
      title: 'First Check: Compares medication with MAR when removing from dispensing system. Verbalizes name, dose, route, time. Checks expiration and drug form.',
      section: 'verification', maxScore: 2, critical: false,
      requiredEvents: ['medication_removed'],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['check1'],
        evaluationPrompt: 'Did the student, while removing the medication from the dispensing system, verbalize the medication name, dose, route, and time, AND state that they checked the expiration date and drug form? Score 2 if all elements were verbalized correctly, 1 if the check was incomplete or partially inaccurate, 0 if no check was verbalized at all.'
      }
    },
    {
      id: 'second_check',
      title: 'Second Check: Compares medication again during preparation. Verifies calculation accuracy. Checks expiration on prepared medication. Performs hand hygiene before prep.',
      section: 'verification', maxScore: 2, critical: false,
      requiredEvents: ['medication_preparation_started', 'hand_hygiene_performed'],
      chronologyRules: [{ eventType: 'hand_hygiene_performed', before: 'medication_preparation_started' }],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['preparation'],
        evaluationPrompt: 'Did the student compare the medication a second time during preparation and verbalize that the calculation/dose and expiration were correct on the prepared medication? Score 2 if the second check was correctly and completely performed, 1 if incomplete or inaccurate, 0 if not performed.'
      }
    },
    {
      id: 'third_check',
      title: 'Third Check (Bedside): Compares medication with MAR at bedside with patient present. States patient name, medication name, dose, route, time.',
      section: 'verification', maxScore: 2, critical: true,
      requiredEvents: ['bedside_check_started'],
      chronologyRules: [{ before: 'medication_administered' }],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['check3', 'return_to_bedside'],
        evaluationPrompt: 'At the bedside, with the patient present, did the student compare the medication with the MAR and state the patient name, medication name, dose, route, and time? Score 2 if correctly and completely performed, 1 if incomplete or inaccurate, 0 if not performed.'
      }
    },

    /* ===================== Patient Safety - Critical Items ===================== */

    {
      id: 'two_identifiers',
      title: 'Two Patient Identifiers: Verifies using name & date of birth (NOT room number or age).',
      section: 'patient_safety', maxScore: 2, critical: true,
      requiredEvents: ['patient_name_requested', 'patient_dob_requested'],
      chronologyRules: [{ before: 'medication_administered' }],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['orientation', 'assessment', 'return_to_bedside', 'check3'],
        evaluationPrompt: 'Confirm from the transcript that the student actually used the patient\'s NAME and DATE OF BIRTH as the two identifiers — NOT room number or age (the rubric explicitly forbids those as substitutes). Score 2 if both identifiers were correctly used and confirmed against the chart, 1 if verification was attempted but incomplete or one identifier was wrong (e.g. used room number or age instead of DOB), 0 if no real identifier verification occurred.'
      }
    },
    {
      id: 'allergy_check',
      title: 'Allergy Check: Asks patient about allergies, checks allergy band, verifies MAR. Reports concerns before administering.',
      section: 'patient_safety', maxScore: 2, critical: true,
      requiredEvents: ['allergy_question_asked', 'wristband_viewed', 'mar_allergies_viewed'],
      chronologyRules: [{ before: 'medication_administered' }],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['assessment', 'check1', 'preparation', 'return_to_bedside'],
        evaluationPrompt: 'The student is required to ask the patient about allergies, check the allergy band, and verify the MAR — and to report/act on any allergy finding before administering, if one existed for this scenario. Score 2 if the allergy check was complete and (when relevant) any finding was reported, 1 if incomplete or inaccurate, 0 if not checked.'
      }
    },
    {
      id: 'right_drug',
      title: 'Right Drug: Matches order/MAR exactly.',
      section: 'patient_safety', maxScore: 2, critical: false,
      requiredEvents: ['medication_removed']
      /* Deterministic only: js/medsim.js compares the removed medicationId
         against scenario.orders[0].medId. No aiEvaluation — matching an id is
         mechanical, not a judgment call. */
    },
    {
      id: 'right_dose',
      title: 'Right Dose: Correct calculation. Shows weight-based conversions (kg = lbs ÷ 2.2) and IV rates if applicable.',
      section: 'patient_safety', maxScore: 2, critical: false,
      requiredEvents: [],
      /* requiredEvents gains `dose_calculated` at runtime when
         scenario.requiresCalculation is true — see js/medsim.js resolveRubricForScenario(). */
      aiEvaluation: {
        enabled: true,
        windowPhases: ['check1', 'preparation'],
        evaluationPrompt: 'Did the student verbalize a correct dose/calculation logic for this medication (including any weight-based conversion or IV rate, only if this scenario actually requires one)? Score 2 if correct and complete, 1 if incomplete or slightly inaccurate reasoning, 0 if no calculation/dose reasoning was verbalized when one was required, or 2 by default if this scenario requires no calculation and the student simply confirmed the ordered dose against the MAR.'
      }
    },
    {
      id: 'right_route',
      title: 'Right Route: Matches order. Assesses patient ability to receive via that route. Correct drug form for route.',
      section: 'patient_safety', maxScore: 2, critical: false,
      requiredEvents: [],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['assessment', 'check1', 'return_to_bedside'],
        evaluationPrompt: 'Did the student assess the patient\'s ability to receive the medication via the ordered route (for an oral medication, this means confirming the patient can swallow / is not NPO) before administering? Score 2 if clearly assessed, 1 if assumed without asking, 0 if never addressed.'
      }
    },
    {
      id: 'right_time',
      title: 'Right Time: Administers at the correct time.',
      section: 'patient_safety', maxScore: 2, critical: false,
      requiredEvents: ['medication_administered']
      /* Deterministic only: js/medsim.js compares the administered event's
         sim-clock time against scenario.orders[0].scheduledTime, ±60 min. */
    },
    {
      id: 'right_documentation',
      title: 'Right Documentation: DOCUMENTS AFTER administering (not before). Includes medication name, dose, route, time, site, patient response, signature.',
      section: 'patient_safety', maxScore: 2, critical: true,
      requiredEvents: ['medication_documented'],
      chronologyRules: [{ after: 'medication_administered' }],
      forbiddenEvents: ['documented_before_administration']
    },

    /* ===================== Clinical Judgment & Assessment ===================== */

    {
      id: 'pre_admin_assessment',
      title: 'Pre-Administration Assessment: Reviews vital signs, lab values, patient ability to swallow, injection site assessment.',
      section: 'clinical_judgment', maxScore: 2, critical: false,
      requiredEvents: [{ anyOf: ['vitals_viewed', 'labs_viewed'] }],
      chronologyRules: [{ before: 'medication_administered' }],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['orientation', 'assessment'],
        evaluationPrompt: 'Did the student perform a reasonable pre-administration assessment relevant to this medication and route (vital signs and/or ability to swallow, as applicable) before administering? Score 2 if thorough, 1 if partial, 0 if none.'
      }
    },
    {
      id: 'right_reason',
      title: 'Right Reason: Verbalizes clinical reason or indication for medication.',
      section: 'clinical_judgment', maxScore: 2, critical: false,
      requiredEvents: [],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['check1', 'preparation', 'return_to_bedside', 'education'],
        evaluationPrompt: 'Did the student verbalize the clinical reason/indication for giving this medication (e.g. why the patient is receiving it)? Score 2 if clearly and correctly verbalized, 1 if vague or partially correct, 0 if never verbalized.'
      }
    },
    {
      id: 'patient_education',
      title: 'Right Patient Education: Explains medication purpose, expected effects, and side effects to report. Verifies understanding.',
      section: 'clinical_judgment', maxScore: 2, critical: false,
      requiredEvents: ['patient_education_given'],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['education', 'administration'],
        evaluationPrompt: 'Did the student explain the medication\'s purpose, expected effects, and side effects to report, AND verify the patient\'s understanding (not just deliver a monologue)? Score 2 if all elements present and understanding verified, 1 if partial, 0 if not done.'
      }
    },
    {
      id: 'drug_guide_use',
      title: 'Right Use of Drug Guide: Demonstrates proper use of drug guide to verify medication information, including class, indications, and contraindications.',
      section: 'clinical_judgment', maxScore: 2, critical: false,
      requiredEvents: ['drug_guide_opened'],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['assessment', 'retrieval', 'check1', 'preparation'],
        evaluationPrompt: 'After opening the drug guide, did the student correctly state the medication\'s class, indication, or a contraindication (demonstrating they actually used the information, not just opened the panel)? Score 2 if correctly demonstrated, 1 if opened but used incompletely/inaccurately, 0 if opened but nothing was verbalized from it.'
      }
    },

    /* ===================== Safety Techniques ===================== */

    {
      id: 'hand_hygiene_asepsis',
      title: 'Hand Hygiene & Asepsis: Performs hand hygiene before prep. Maintains aseptic technique. For injections: 20-second antiseptic scrub with friction, air dry. Correct needle size.',
      section: 'safety_techniques', maxScore: 2, critical: true,
      requiredEvents: ['hand_hygiene_performed'],
      chronologyRules: [{ before: 'medication_preparation_started' }]
    },
    {
      id: 'injection_technique',
      title: 'Injection Technique (if applicable): Correct anatomical landmark. Proper needle angle. Smooth insertion. Aspirates for IM if required. Does NOT massage heparin sites. Sharps in container immediately.',
      section: 'safety_techniques', maxScore: 2, critical: false,
      requiredEvents: ['injection_site_selected'],
      phase2Only: true,
      aiEvaluation: {
        enabled: true,
        windowPhases: ['administration'],
        evaluationPrompt: 'Did the student demonstrate correct injection technique (landmark, angle, insertion, aspiration if required, no massage of a heparin site, immediate sharps disposal)? Score 2/1/0 accordingly.'
      }
    },
    {
      id: 'limiting_distractions',
      title: 'Limiting Distractions: Minimizes interruptions. Remains focused. Demonstrates "no interruption zone" awareness.',
      section: 'safety_techniques', maxScore: 2, critical: false,
      requiredEvents: [],
      distractionsOnly: true,
      aiEvaluation: {
        enabled: true,
        windowPhases: ['preparation', 'check1', 'check2', 'check3', 'administration'],
        evaluationPrompt: 'When a distraction was introduced, did the student minimize interruption, stay focused on the medication task, and show "no interruption zone" awareness? Score 2/1/0 accordingly.'
      }
    },

    /* ===================== Patient Education & Communication ===================== */

    {
      id: 'professionalism',
      title: 'Professionalism & Respect: Uses clear, therapeutic communication. Maintains privacy and dignity. Demonstrates cultural sensitivity.',
      section: 'education', maxScore: 2, critical: false,
      requiredEvents: [],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['orientation', 'assessment', 'return_to_bedside', 'check3', 'education', 'administration', 'reassessment'],
        evaluationPrompt: 'Across the whole interaction, did the student use clear, therapeutic communication, maintain the patient\'s privacy and dignity, and demonstrate respect/cultural sensitivity? Score 2 if fully demonstrated, 1 if partial, 0 if not demonstrated.'
      }
    },

    /* ===================== Additional Considerations ===================== */

    {
      id: 'special_precautions',
      title: 'Special Precautions: Holds medications based on lab values. Assesses contraindications. Reviews drug interactions. Monitors for adverse effects.',
      section: 'additional', maxScore: 2, critical: false,
      requiredEvents: [],
      holdParamsOnly: true,
      chronologyRules: [{ before: 'medication_administered' }],
      aiEvaluation: {
        enabled: true,
        windowPhases: ['assessment', 'check1', 'preparation', 'return_to_bedside'],
        evaluationPrompt: 'Did the student correctly assess any special precaution/hold parameter, contraindication, or drug interaction that applies to this scenario before administering? Score 2/1/0 accordingly.'
      }
    },
    {
      id: 'expiration_check',
      title: 'Expiration Dates: All medications checked for expiration.',
      section: 'additional', maxScore: 2, critical: false,
      requiredEvents: [],
      /* If scenario.expiredMedicationPresent, requiredEvents gains
         `expired_medication_rejected` at runtime (deterministic) — see
         js/medsim.js resolveRubricForScenario(). Otherwise AI-only. */
      aiEvaluation: {
        enabled: true,
        windowPhases: ['check1', 'preparation'],
        evaluationPrompt: 'Did the student verbalize checking the expiration date on the medication? Score 2 if clearly checked, 1 if implied/partial, 0 if never mentioned.'
      }
    }
  ];

  window.MEDSIM_RUBRIC = RUBRIC;
})();
