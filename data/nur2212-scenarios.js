/* nur2212-scenarios.js - NUR2212 Medical-Surgical II simulation scenarios + lessons
 * Source: New stuff/Nur2212_SIM_STUDY/NUR2212_Sim_Study_App_Pack/
 *   scenarios/ALL_SCENARIOS.json  (every scenario key copied verbatim)
 *   topics/01..12_*.md            (the lesson block on each scenario)
 *
 * Educational simulation / checkoff practice only.
 *
 * VERBATIM CONTENT. Source-sheet typos and contradictions are preserved on
 * purpose (ICP "Maintain oxygen SpO2 <95%", ARDS "Ceftriaxone 1 g IC", the
 * sepsis sheet mislabeled DIC, the PE left-DVT / right-calf mismatch, and the
 * liver-failure "low protien" diet). Do not "fix" them here - the app surfaces
 * them in the verify-with-instructor panel.
 *
 * Provenance is load-bearing: pneumonia, appendicitis, appendectomy and bowel
 * obstruction are generated_supplemental_practice and must always be badged
 * as supplemental, never as a school requirement.
 *
 * Globals: window.NUR2212_SCENARIOS (array of 12)
 * ES5 only - no build step.
 */
window.NUR2212_SCENARIOS = [
  {
    schema_version: '1.0',
    topic_id: 'upper_gi_bleed',
    title: 'Upper GI Bleed With Progression Toward Hypovolemic Shock',
    provenance: 'school_file',
    source_file: 'MS 2 Sim Lab GI Bleed Student.docx',
    duration_minutes: 20,
    education_only: true,
    case_intro: 'At 1100 you assume care of John Smith, age 72, with peptic ulcer disease, osteoarthritis, and chronic NSAID use. He had epigastric pain, nausea, dizziness, and melena. He is now pale, weak, diaphoretic, and has bright-red hematemesis with tachycardia and a downward blood-pressure trend.',
    initial_findings: [
      'Bright-red hematemesis',
      'History of melena',
      'Pale and diaphoretic',
      'Weak/fatigued',
      'Cool extremities',
      'Tachycardia with falling BP',
      'Dizziness'
    ],
    vital_trends: [
      {
        time: '0600',
        bp: '118/76',
        hr: '88',
        rr: '18',
        spo2: '98%',
        temp: '99.4 F'
      },
      {
        time: '1000',
        bp: '108/68',
        hr: '104',
        rr: '22',
        spo2: '94%',
        temp: '98.4 F'
      }
    ],
    labs: [
      {
        test: 'RBC',
        result: '3.2',
        interpretation: 'Low'
      },
      {
        test: 'Hgb',
        result: '6.8 g/dL',
        interpretation: 'Severely low on school sheet'
      },
      {
        test: 'Hct',
        result: '21%',
        interpretation: 'Low'
      },
      {
        test: 'Platelets',
        result: '280,000',
        interpretation: 'Normal'
      },
      {
        test: 'BUN',
        result: '34',
        interpretation: 'High'
      },
      {
        test: 'Creatinine',
        result: '1.3',
        interpretation: 'Slightly high'
      },
      {
        test: 'PT',
        result: '15 sec',
        interpretation: 'High'
      },
      {
        test: 'INR',
        result: '1.3',
        interpretation: 'High'
      },
      {
        test: 'aPTT',
        result: '34 sec',
        interpretation: 'Normal'
      }
    ],
    diagnostics: ['Type and crossmatch: O positive; PRBCs available.'],
    orders: [
      'Continuous pulse oximetry',
      'Vital signs every 15 minutes',
      'Maintain SpO2 >95%',
      'NPO',
      'Normal saline 1000 mL IV bolus',
      'Transfuse PRBCs',
      'Strict intake and output',
      'Notify provider for hypotension, tachycardia, or worsening bleeding',
      'Pantoprazole IV bolus followed by continuous infusion as written on school sheet',
      'Ondansetron 4 mg IV every 6 hours PRN nausea'
    ],
    mar: [
      '1000 - 0.9% sodium chloride 1 L bolus',
      '1015 - pantoprazole 80 mg IV',
      '1030 - PRBC transfusion initiated',
      '1030 - ondansetron 4 mg IV'
    ],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'protect_airway_during_emesis',
        label: 'Protect Airway During Emesis',
        category: 'topic_specific'
      },
      {
        id: 'assess_active_bleeding',
        label: 'Assess Active Bleeding',
        category: 'topic_specific'
      },
      {
        id: 'monitor_prbc_transfusion',
        label: 'Monitor Prbc Transfusion',
        category: 'topic_specific'
      },
      {
        id: 'strict_io',
        label: 'Strict Io',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'abc_assessment',
      'protect_airway_during_emesis',
      'assess_active_bleeding',
      'monitor_prbc_transfusion',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'Increasing hematemesis',
      'Falling BP/MAP',
      'Rising HR',
      'Worsening dizziness, confusion, or syncope',
      'Cool clammy skin/delayed cap refill',
      'Urine output dropping',
      'Falling SpO2 or inability to protect airway'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: 72-year-old with acute upper GI bleed, active bright-red hematemesis, and worsening hemodynamics.',
      'B: PUD and chronic NSAID use; earlier melena, epigastric pain, nausea, dizziness. Hgb 6.8, Hct 21; PRBC transfusion started at 1030.',
      'A: Pale/diaphoretic, cool extremities, tachycardic with falling BP and active bleeding; concern for progression toward hypovolemic shock.',
      'R: Request immediate review/escalation and continuation/adjustment of ordered resuscitation and bleeding management.'
    ],
    source_discrepancies: [
      'The pantoprazole order repeats the phrase "80 mg IV bolus" before the infusion; verify the intended wording with the instructor.',
      'The file is labeled Student but page 1 also displays "Simulation Faculty Version."'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Recognize an acute upper GI hemorrhage, protect the airway during hematemesis, identify hypovolemia, stabilize circulation, monitor an active PRBC transfusion, and escalate deterioration quickly.',
      'BLEED: Breathing/airway, Look for shock, Establish circulation, Erythrocytes/blood, Deterioration monitoring.',
      'Do not spend several minutes on a routine head-to-toe while active hemorrhage is occurring.',
      'Do not give oral intake: the chart says NPO.',
      'Do not invent an endoscopy or medication order not in the chart.',
      'For blood products, follow the school/facility transfusion policy rather than a generic memorized sequence.'
    ],
    lesson: {
      testing: 'Recognize an acute upper GI hemorrhage, protect the airway during hematemesis, identify hypovolemia, stabilize circulation, monitor an active PRBC transfusion, and escalate deterioration quickly.',
      caseStory: 'At 1100 you assume care of John Smith, age 72, with peptic ulcer disease, osteoarthritis, and chronic NSAID use. He had epigastric pain, nausea, dizziness, and melena. He is now pale, weak, diaphoretic, and has bright-red hematemesis with tachycardia and a downward blood-pressure trend.',
      pathoChain: [
        'Chronic NSAID exposure can contribute to peptic ulcer injury.',
        'Ulcer bleeding causes acute blood loss into the upper GI tract.',
        'Loss of circulating volume reduces preload and tissue perfusion.',
        'Compensation appears as tachycardia and vasoconstriction; worsening loss can cause hypotension, altered mentation, oliguria, and hypovolemic shock.'
      ],
      redFlags: [
        'Bright-red hematemesis',
        'History of melena',
        'Pale and diaphoretic',
        'Weak/fatigued',
        'Cool extremities',
        'Tachycardia with falling BP',
        'Dizziness'
      ],
      inRoomSequence: [
        'Perform hand hygiene, standard precautions, and two patient identifiers.',
        'Immediate ABC assessment. With active hematemesis, determine whether the patient is protecting the airway and keep suction/airway support available per simulation/facility process.',
        'Check current HR, BP, RR, SpO2, mental status, skin/perfusion, and amount/character of ongoing bleeding. Compare with the earlier trend.',
        'Confirm continuous pulse oximetry, ordered oxygen target, IV access, NPO status, and strict I&O.',
        'Recognize Hgb 6.8/Hct 21 plus active bleeding as severe blood-loss concern.',
        'At the scenario time, the MAR says PRBCs were started at 1030. Treat this as an active transfusion to verify and monitor according to facility/school blood policy, rather than assuming you are starting from scratch.',
        'Carry out active provider orders within the scenario and reassess response to fluids/blood/oxygen.',
        'Notify/escalate for hypotension, tachycardia, worsening bleeding, mental-status change, reduced urine output, or airway compromise.',
        'Give a concise SBAR and document assessment, interventions, and response.'
      ],
      deteriorationCues: [
        'Increasing hematemesis',
        'Falling BP/MAP',
        'Rising HR',
        'Worsening dizziness, confusion, or syncope',
        'Cool clammy skin/delayed cap refill',
        'Urine output dropping',
        'Falling SpO2 or inability to protect airway'
      ],
      sbarSkeleton: [
        'S: 72-year-old with acute upper GI bleed, active bright-red hematemesis, and worsening hemodynamics.',
        'B: PUD and chronic NSAID use; earlier melena, epigastric pain, nausea, dizziness. Hgb 6.8, Hct 21; PRBC transfusion started at 1030.',
        'A: Pale/diaphoretic, cool extremities, tachycardic with falling BP and active bleeding; concern for progression toward hypovolemic shock.',
        'R: Request immediate review/escalation and continuation/adjustment of ordered resuscitation and bleeding management.'
      ],
      memoryHook: 'BLEED: Breathing/airway, Look for shock, Establish circulation, Erythrocytes/blood, Deterioration monitoring.',
      commonMistakes: [
        'Do not spend several minutes on a routine head-to-toe while active hemorrhage is occurring.',
        'Do not give oral intake: the chart says NPO.',
        'Do not invent an endoscopy or medication order not in the chart.',
        'For blood products, follow the school/facility transfusion policy rather than a generic memorized sequence.'
      ],
      sourceIssues: [
        'The pantoprazole order repeats the phrase "80 mg IV bolus" before the infusion; verify the intended wording with the instructor.',
        'The file is labeled Student but page 1 also displays "Simulation Faculty Version."'
      ],
      rapidFire: [
        {
          q: 'What is the immediate framework?',
          a: 'ABCs with special attention to airway protection and circulation.'
        },
        {
          q: 'Which lab is the biggest bleeding red flag?',
          a: 'Hgb 6.8 g/dL, with Hct 21% and active hematemesis.'
        },
        {
          q: 'What is the shock type?',
          a: 'Hypovolemic shock from acute blood loss.'
        },
        {
          q: 'What does melena suggest?',
          a: 'Digested blood, commonly from an upper GI source.'
        },
        {
          q: 'At 1100, has blood already started?',
          a: 'Yes. The MAR says PRBC transfusion initiated at 1030.'
        }
      ],
      references: []
    }
  },
  {
    schema_version: '1.0',
    topic_id: 'acute_liver_failure',
    title: 'Acute Liver Failure With Hepatic Encephalopathy',
    provenance: 'school_file',
    source_file: 'MS Liver Failure Student.docx',
    duration_minutes: 20,
    education_only: true,
    case_intro: 'At 1530 you assume care of Jane Smith, age 72, admitted through the ED with acute liver failure suspected secondary to acetaminophen toxicity. Over several days she developed nausea, vomiting, abdominal pain, jaundice, fatigue, increasing forgetfulness, excessive sleepiness, and difficulty being aroused.',
    initial_findings: [
      'Lethargy and delayed responses',
      'Asterixis',
      'Jaundice',
      'Nausea/vomiting and abdominal pain',
      'Sinus tachycardia',
      'Increasing confusion/somnolence'
    ],
    vital_trends: [
      {
        time: '0800',
        bp: '118/72',
        hr: '94',
        rr: '15',
        spo2: '96%',
        temp: '98.8 F'
      },
      {
        time: '1000',
        bp: '106/62',
        hr: '112',
        rr: '24',
        spo2: '96%',
        temp: '100.0 F'
      }
    ],
    labs: [
      {
        test: 'Platelets',
        result: '88,000',
        interpretation: 'Low'
      },
      {
        test: 'AST',
        result: '2,850',
        interpretation: 'Very high'
      },
      {
        test: 'ALT',
        result: '3,200',
        interpretation: 'Very high'
      },
      {
        test: 'Total bilirubin',
        result: '8.4',
        interpretation: 'High'
      },
      {
        test: 'Albumin',
        result: '2.8',
        interpretation: 'Low'
      },
      {
        test: 'Ammonia',
        result: '118',
        interpretation: 'High'
      },
      {
        test: 'PT',
        result: '28 sec',
        interpretation: 'Prolonged'
      },
      {
        test: 'INR',
        result: '2.8',
        interpretation: 'High'
      },
      {
        test: 'BUN',
        result: '24',
        interpretation: 'High'
      },
      {
        test: 'Creatinine',
        result: '1.4',
        interpretation: 'High'
      },
      {
        test: 'GFR',
        result: '18',
        interpretation: 'Low on school sheet'
      },
      {
        test: 'Glucose',
        result: '78',
        interpretation: 'Low-normal'
      }
    ],
    diagnostics: [],
    orders: [
      'Neuro checks every hour',
      'Fall precautions',
      'Seizure precautions',
      'Continuous cardiac monitoring',
      'Strict intake and output',
      'N-acetylcysteine 4.4 g IV in 250 mL D5W over 1 hour',
      'Lactulose 30 mL PO every 6 hours',
      'Daily weight',
      'Notify provider for worsening neurological status'
    ],
    mar: [
      '0900 - lactulose 30 mL PO',
      '0930 - N-acetylcysteine bolus',
      '1000 - 0.9% sodium chloride 100 mL/hr',
      '1200 - lactulose 30 mL PO',
      '1500 - N-acetylcysteine 4.4 g IV in 250 mL D5W'
    ],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'neuro_trend_gcs',
        label: 'Neuro Trend Gcs',
        category: 'topic_specific'
      },
      {
        id: 'fall_precautions',
        label: 'Fall Precautions',
        category: 'topic_specific'
      },
      {
        id: 'seizure_precautions',
        label: 'Seizure Precautions',
        category: 'topic_specific'
      },
      {
        id: 'assess_bleeding',
        label: 'Assess Bleeding',
        category: 'topic_specific'
      },
      {
        id: 'admin_lactulose_ordered',
        label: 'Admin Lactulose Ordered',
        category: 'topic_specific'
      },
      {
        id: 'admin_nac_ordered',
        label: 'Admin Nac Ordered',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'abc_assessment',
      'neuro_trend_gcs',
      'fall_precautions',
      'seizure_precautions',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'Progressive somnolence or inability to arouse',
      'Falling GCS/new disorientation',
      'New seizure',
      'Pupil/motor changes',
      'Signs of increased ICP',
      'New or worsening bleeding',
      'Hypoglycemia',
      'Worsening renal function/hemodynamics'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: 72-year-old with acute liver failure and worsening hepatic encephalopathy.',
      'B: Suspected acetaminophen toxicity; jaundice, GI symptoms, increasing confusion and somnolence.',
      'A: Lethargic with delayed responses and asterixis; ammonia 118, AST 2850, ALT 3200, INR 2.8, platelets 88,000.',
      'R: Request immediate evaluation for neurologic deterioration/ICU-level monitoring and continuation of ordered liver-failure therapy.'
    ],
    source_discrepancies: [
      'The diet is written "low fat, low protien" in the school sheet; keep the school wording visible but verify the intended diet with the instructor.',
      'The MAR shows an N-acetylcysteine bolus at 0930 and another 4.4 g infusion at 1500; do not use this sheet as a complete real-world NAC protocol.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Recognize acute liver failure, worsening hepatic encephalopathy, coagulopathy, and neurologic deterioration; implement safety precautions and ordered therapies; escalate for worsening neurologic status.',
      'LIVER: Lethargy, INR rises, Very high AST/ALT, Elevated ammonia, Risk of bleeding/brain edema.',
      'Do not treat asterixis as a benign tremor; in this case it supports encephalopathy.',
      'Do not ignore coagulation values or platelet count.',
      'Do not administer an unlisted reversal/blood product without an order in exam mode.'
    ],
    lesson: {
      testing: 'Recognize acute liver failure, worsening hepatic encephalopathy, coagulopathy, and neurologic deterioration; implement safety precautions and ordered therapies; escalate for worsening neurologic status.',
      caseStory: 'At 1530 you assume care of Jane Smith, age 72, admitted through the ED with acute liver failure suspected secondary to acetaminophen toxicity. Over several days she developed nausea, vomiting, abdominal pain, jaundice, fatigue, increasing forgetfulness, excessive sleepiness, and difficulty being aroused.',
      pathoChain: [
        'Acute liver injury rapidly reduces detoxification and synthetic function.',
        'Toxin accumulation, including ammonia, contributes to hepatic encephalopathy and altered mental status.',
        'Loss of hepatic synthetic function contributes to coagulopathy and bleeding risk.',
        'Severe neurologic deterioration can progress to cerebral edema, increased ICP, seizures, multi-organ dysfunction, and death.'
      ],
      redFlags: [
        'Lethargy and delayed responses',
        'Asterixis',
        'Jaundice',
        'Nausea/vomiting and abdominal pain',
        'Sinus tachycardia',
        'Increasing confusion/somnolence'
      ],
      inRoomSequence: [
        'Hand hygiene, standard precautions, two identifiers, and fall/seizure safety check.',
        'Perform a focused neurologic assessment: level of consciousness, orientation, ability to follow commands, speech, pupils, motor response, and trend in mental status.',
        'Perform focused GI/skin assessment: jaundice, nausea/vomiting, abdominal symptoms, bleeding/bruising.',
        'Review ammonia, AST/ALT, bilirubin, albumin, platelets, PT/INR, renal function, and glucose.',
        'Recognize hepatic encephalopathy when confusion/lethargy and asterixis accompany elevated ammonia and severe liver injury.',
        'Maintain ordered neuro checks, cardiac monitoring, I&O, daily weight, fall precautions, and seizure precautions.',
        'Administer/verify ordered lactulose and N-acetylcysteine as scheduled in the scenario and reassess neurologic status.',
        'Watch closely for bleeding and signs of cerebral edema/increased ICP or declining consciousness.',
        'Notify/escalate immediately for worsening neurologic status and give SBAR.'
      ],
      deteriorationCues: [
        'Progressive somnolence or inability to arouse',
        'Falling GCS/new disorientation',
        'New seizure',
        'Pupil/motor changes',
        'Signs of increased ICP',
        'New or worsening bleeding',
        'Hypoglycemia',
        'Worsening renal function/hemodynamics'
      ],
      sbarSkeleton: [
        'S: 72-year-old with acute liver failure and worsening hepatic encephalopathy.',
        'B: Suspected acetaminophen toxicity; jaundice, GI symptoms, increasing confusion and somnolence.',
        'A: Lethargic with delayed responses and asterixis; ammonia 118, AST 2850, ALT 3200, INR 2.8, platelets 88,000.',
        'R: Request immediate evaluation for neurologic deterioration/ICU-level monitoring and continuation of ordered liver-failure therapy.'
      ],
      memoryHook: 'LIVER: Lethargy, INR rises, Very high AST/ALT, Elevated ammonia, Risk of bleeding/brain edema.',
      commonMistakes: [
        'Do not treat asterixis as a benign tremor; in this case it supports encephalopathy.',
        'Do not ignore coagulation values or platelet count.',
        'Do not administer an unlisted reversal/blood product without an order in exam mode.'
      ],
      sourceIssues: [
        'The diet is written "low fat, low protien" in the school sheet; keep the school wording visible but verify the intended diet with the instructor.',
        'The MAR shows an N-acetylcysteine bolus at 0930 and another 4.4 g infusion at 1500; do not use this sheet as a complete real-world NAC protocol.'
      ],
      rapidFire: [
        {
          q: 'What neurologic finding is classic in this case?',
          a: 'Asterixis with lethargy/delayed responses.'
        },
        {
          q: 'Which lab connects most directly to encephalopathy?',
          a: 'Ammonia 118 on the school sheet.'
        },
        {
          q: 'Why is INR 2.8 important?',
          a: 'It signals impaired coagulation and bleeding risk.'
        },
        {
          q: 'Which safety precautions are ordered?',
          a: 'Fall and seizure precautions.'
        },
        {
          q: 'When should the provider be notified?',
          a: 'For worsening neurologic status.'
        }
      ],
      references: []
    }
  },
  {
    schema_version: '1.0',
    topic_id: 'ards',
    title: 'Acute Respiratory Failure With Progression Toward ARDS',
    provenance: 'school_file',
    source_file: 'MS2 ARDS STudent.docx',
    duration_minutes: 20,
    education_only: true,
    case_intro: 'John Smith, age 72, was admitted with severe pneumonia. Over several hours he has worsening shortness of breath, rising oxygen needs, fatigue, difficulty speaking complete sentences, tachypnea, accessory muscle use, diffuse crackles, anxiety, and falling oxygen saturation.',
    initial_findings: [
      'Severe dyspnea',
      'RR 30 at 1000',
      'Accessory muscle use',
      'Unable to speak complete sentences',
      'Frequent cough',
      'Anxiety/restlessness',
      'Sinus tachycardia',
      'SpO2 88% despite an oxygen order'
    ],
    vital_trends: [
      {
        time: '0600',
        bp: '136/84',
        hr: '96',
        rr: '22',
        spo2: '93%',
        temp: '100.6 F'
      },
      {
        time: '1000',
        bp: '142/86',
        hr: '112',
        rr: '30',
        spo2: '88%',
        temp: '101.8 F'
      }
    ],
    labs: [
      {
        test: 'WBC',
        result: '19.2',
        interpretation: 'High'
      },
      {
        test: 'BUN',
        result: '24',
        interpretation: 'High'
      },
      {
        test: 'Creatinine',
        result: '1.2',
        interpretation: 'Upper end of school range'
      },
      {
        test: 'pH',
        result: '7.48',
        interpretation: 'Alkalemic'
      },
      {
        test: 'PaCO2',
        result: '31',
        interpretation: 'Low'
      },
      {
        test: 'PaO2',
        result: '58',
        interpretation: 'Severely low'
      },
      {
        test: 'HCO3',
        result: '22',
        interpretation: 'Normal/low-normal'
      },
      {
        test: 'GFR',
        result: '18',
        interpretation: 'Low on school sheet'
      }
    ],
    diagnostics: [
      'Chest X-ray: bilateral diffuse infiltrates consistent with worsening pneumonia and progression toward ARDS.'
    ],
    orders: [
      'Oxygen 2 L nasal cannula to keep O2 >95%',
      'Continuous pulse oximetry',
      'Continuous cardiac monitoring',
      'Titrate oxygen to maintain SpO2 >95%',
      'Possible ICU transfer',
      'Maintain High Fowler\'s position'
    ],
    mar: [
      '0900 - ceftriaxone 1 g (route appears as "IC" on school sheet)',
      '0900 - azithromycin 500 mg IV',
      '1000 - albuterol nebulizer',
      '1000 - 0.9% sodium chloride 125 mL/hr'
    ],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'high_fowlers',
        label: 'High Fowlers',
        category: 'topic_specific'
      },
      {
        id: 'titrate_oxygen_to_order',
        label: 'Titrate Oxygen To Order',
        category: 'topic_specific'
      },
      {
        id: 'assess_work_of_breathing',
        label: 'Assess Work Of Breathing',
        category: 'topic_specific'
      },
      {
        id: 'interpret_abg',
        label: 'Interpret Abg',
        category: 'topic_specific'
      },
      {
        id: 'prepare_respiratory_escalation',
        label: 'Prepare Respiratory Escalation',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'abc_assessment',
      'high_fowlers',
      'titrate_oxygen_to_order',
      'prepare_respiratory_escalation',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'SpO2 continues to fall',
      'Increasing oxygen requirement',
      'Worsening tachypnea/accessory use',
      'Exhaustion or decreased LOC',
      'Inability to speak',
      'Cyanosis',
      'ABG worsening or signs of impending respiratory arrest'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: 72-year-old with severe pneumonia has acute worsening respiratory distress and SpO2 88%.',
      'B: Increasing oxygen needs and SOB over several hours; antibiotics/nebulizer already given.',
      'A: RR 30, HR 112, accessory muscles, cannot speak complete sentences; PaO2 58; chest X-ray has bilateral diffuse infiltrates concerning for ARDS.',
      'R: Immediate respiratory escalation and ICU/RRT evaluation; continue ordered oxygen titration and prepare advanced support.'
    ],
    source_discrepancies: [
      'The topic header says "Faculty" even though the filename is Student.',
      'Ceftriaxone is written as "1 g IC" in the MAR; verify intended route with instructor.',
      'GFR is listed as 18 despite creatinine 1.2; treat that as a school-sheet inconsistency rather than silently correcting it.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Recognize severe hypoxemia and respiratory deterioration from pneumonia, interpret the ABG/chest X-ray, escalate oxygen/respiratory support, and prevent respiratory arrest.',
      'ARDS: Air is not exchanging, RR rises, Diffuse infiltrates, Saturation stays low.',
      'Do not wait for the patient to become obtunded before escalating.',
      'Do not rely on SpO2 alone; work of breathing and mental status matter.',
      'Do not invent a ventilator setting in a basic nursing sim unless the scenario/instructor provides it.'
    ],
    lesson: {
      testing: 'Recognize severe hypoxemia and respiratory deterioration from pneumonia, interpret the ABG/chest X-ray, escalate oxygen/respiratory support, and prevent respiratory arrest.',
      caseStory: 'John Smith, age 72, was admitted with severe pneumonia. Over several hours he has worsening shortness of breath, rising oxygen needs, fatigue, difficulty speaking complete sentences, tachypnea, accessory muscle use, diffuse crackles, anxiety, and falling oxygen saturation.',
      pathoChain: [
        'Severe pneumonia produces alveolar inflammation and impaired gas exchange.',
        'Progressive inflammatory injury increases alveolar-capillary permeability and diffuse pulmonary edema/infiltrates.',
        'Ventilation-perfusion mismatch and shunt physiology cause severe hypoxemia.',
        'Persistent deterioration can progress to ARDS, acute respiratory failure, mechanical ventilation, multi-organ dysfunction, and death.'
      ],
      redFlags: [
        'Severe dyspnea',
        'RR 30 at 1000',
        'Accessory muscle use',
        'Unable to speak complete sentences',
        'Frequent cough',
        'Anxiety/restlessness',
        'Sinus tachycardia',
        'SpO2 88% despite an oxygen order'
      ],
      inRoomSequence: [
        'Hand hygiene, identifiers, standard precautions, immediate visual respiratory assessment.',
        'Position in High Fowler\'s as ordered and assess airway, respiratory rate/pattern, work of breathing, ability to speak, lung sounds, SpO2, and mental status.',
        'Recognize SpO2 88%, PaO2 58, RR 30, accessory muscle use, and inability to speak full sentences as severe respiratory deterioration.',
        'Confirm continuous pulse oximetry/cardiac monitoring and titrate oxygen to the ordered target within the simulation protocol.',
        'Review ABG and chest X-ray. The pattern is respiratory alkalemia with marked hypoxemia plus bilateral diffuse infiltrates.',
        'Reassess after oxygen/interventions. If hypoxemia/work of breathing remain severe, activate escalation/RRT and prepare for higher-level respiratory support/ICU transfer.',
        'Communicate using SBAR and document response.'
      ],
      deteriorationCues: [
        'SpO2 continues to fall',
        'Increasing oxygen requirement',
        'Worsening tachypnea/accessory use',
        'Exhaustion or decreased LOC',
        'Inability to speak',
        'Cyanosis',
        'ABG worsening or signs of impending respiratory arrest'
      ],
      sbarSkeleton: [
        'S: 72-year-old with severe pneumonia has acute worsening respiratory distress and SpO2 88%.',
        'B: Increasing oxygen needs and SOB over several hours; antibiotics/nebulizer already given.',
        'A: RR 30, HR 112, accessory muscles, cannot speak complete sentences; PaO2 58; chest X-ray has bilateral diffuse infiltrates concerning for ARDS.',
        'R: Immediate respiratory escalation and ICU/RRT evaluation; continue ordered oxygen titration and prepare advanced support.'
      ],
      memoryHook: 'ARDS: Air is not exchanging, RR rises, Diffuse infiltrates, Saturation stays low.',
      commonMistakes: [
        'Do not wait for the patient to become obtunded before escalating.',
        'Do not rely on SpO2 alone; work of breathing and mental status matter.',
        'Do not invent a ventilator setting in a basic nursing sim unless the scenario/instructor provides it.'
      ],
      sourceIssues: [
        'The topic header says "Faculty" even though the filename is Student.',
        'Ceftriaxone is written as "1 g IC" in the MAR; verify intended route with instructor.',
        'GFR is listed as 18 despite creatinine 1.2; treat that as a school-sheet inconsistency rather than silently correcting it.'
      ],
      rapidFire: [
        {
          q: 'What ABG pattern is present?',
          a: 'Alkalemia with low PaCO2 and severe hypoxemia: pH 7.48, PaCO2 31, PaO2 58.'
        },
        {
          q: 'What chest X-ray finding matters?',
          a: 'Bilateral diffuse infiltrates.'
        },
        {
          q: 'Which assessment cue shows severe distress?',
          a: 'Accessory use and inability to speak complete sentences.'
        },
        {
          q: 'What position is ordered?',
          a: 'High Fowler\'s.'
        },
        {
          q: 'What is the key next move if oxygenation keeps worsening?',
          a: 'Escalate/RRT and prepare higher-level respiratory support.'
        }
      ],
      references: []
    }
  },
  {
    schema_version: '1.0',
    topic_id: 'dic',
    title: 'Disseminated Intravascular Coagulation (DIC)',
    provenance: 'school_file',
    source_file: 'MS2 DIC Student.docx',
    duration_minutes: 20,
    education_only: true,
    case_intro: 'Jane Smith, age 72, was admitted three days ago with pneumonia that progressed to sepsis. She now has bleeding gums, oozing from IV sites, petechiae and bruising, fatigue, and low urine output.',
    initial_findings: [
      'Petechiae on chest and arms',
      'Ecchymosis',
      'Oozing from IV insertion site',
      'Bleeding gums',
      'Pale/fatigued/lethargic',
      'Tachypnea',
      'Sinus tachycardia',
      'Urine output <30 mL/hr'
    ],
    vital_trends: [
      {
        time: '0600',
        bp: '118/70',
        hr: '92',
        rr: '18',
        spo2: '94%',
        temp: '100.8 F'
      },
      {
        time: '0800',
        bp: '108/64',
        hr: '102',
        rr: '24',
        spo2: '93%',
        temp: '101.6 F'
      }
    ],
    labs: [
      {
        test: 'Hgb',
        result: '10.2',
        interpretation: 'Low'
      },
      {
        test: 'Hct',
        result: '31%',
        interpretation: 'Low'
      },
      {
        test: 'Platelets',
        result: '48,000',
        interpretation: 'Very low'
      },
      {
        test: 'PT',
        result: '24 sec',
        interpretation: 'Prolonged'
      },
      {
        test: 'INR',
        result: '2.8',
        interpretation: 'High'
      },
      {
        test: 'aPTT',
        result: '62 sec',
        interpretation: 'Prolonged'
      },
      {
        test: 'Fibrinogen',
        result: '90',
        interpretation: 'Low'
      },
      {
        test: 'D-dimer',
        result: '5000',
        interpretation: 'Very high'
      },
      {
        test: 'Lactate',
        result: '4.8',
        interpretation: 'High'
      },
      {
        test: 'BUN',
        result: '36',
        interpretation: 'High'
      },
      {
        test: 'Creatinine',
        result: '2.1',
        interpretation: 'High'
      }
    ],
    diagnostics: [],
    orders: [
      'Continuous cardiac monitoring',
      'Vital signs every 15 minutes',
      'Keep SpO2 >95%',
      'Cefepime 1 g IV every 8 hours',
      'Vancomycin 1 g IV every 24 hours',
      'Strict intake and output'
    ],
    mar: [
      '0800 - cefepime IV',
      '0900 - vancomycin IV',
      '0900 - 0.9% sodium chloride 125 mL/hr'
    ],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'assess_bleeding_sites',
        label: 'Assess Bleeding Sites',
        category: 'topic_specific'
      },
      {
        id: 'interpret_dic_panel',
        label: 'Interpret Dic Panel',
        category: 'topic_specific'
      },
      {
        id: 'minimize_trauma',
        label: 'Minimize Trauma',
        category: 'topic_specific'
      },
      {
        id: 'prepare_blood_products_if_ordered',
        label: 'Prepare Blood Products If Ordered',
        category: 'topic_specific'
      },
      {
        id: 'strict_io',
        label: 'Strict Io',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'abc_assessment',
      'assess_bleeding_sites',
      'interpret_dic_panel',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'Increasing bleeding or new sites',
      'Falling BP/rising HR',
      'Urine output <30 mL/hr or worsening renal labs',
      'Altered mental status',
      'Respiratory distress',
      'Falling Hgb/platelets/fibrinogen',
      'Rising lactate'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: 72-year-old with sepsis now has multi-site bleeding concerning for DIC.',
      'B: Pneumonia progressed to sepsis; new gums/IV bleeding and petechiae.',
      'A: Platelets 48,000, PT 24, INR 2.8, aPTT 62, fibrinogen 90, D-dimer 5000, lactate 4.8, urine output <30 mL/hr.',
      'R: Immediate provider/RRT evaluation for DIC, bleeding/perfusion support, and blood products if ordered.'
    ],
    source_discrepancies: [
      'The activity instructions include preparation for blood products, but the listed provider orders do not actually contain a blood-product order.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Recognize simultaneous pathologic clotting and bleeding in a septic patient, interpret coagulation/fibrinogen/D-dimer trends, protect from bleeding, maintain perfusion, and escalate organ dysfunction.',
      'DIC = Does both: Inappropriate Clotting + bleeding. Think platelets/fibrinogen DOWN; PT/aPTT/D-dimer UP.',
      'Do not interpret a high D-dimer by itself; use the entire coagulation pattern and clinical bleeding.',
      'Do not give a blood product simply because you expect one; verify the order and policy.',
      'Avoid unnecessary needle sticks/trauma in a bleeding patient.'
    ],
    lesson: {
      testing: 'Recognize simultaneous pathologic clotting and bleeding in a septic patient, interpret coagulation/fibrinogen/D-dimer trends, protect from bleeding, maintain perfusion, and escalate organ dysfunction.',
      caseStory: 'Jane Smith, age 72, was admitted three days ago with pneumonia that progressed to sepsis. She now has bleeding gums, oozing from IV sites, petechiae and bruising, fatigue, and low urine output.',
      pathoChain: [
        'Sepsis can trigger widespread activation of the coagulation cascade.',
        'Microvascular thrombi consume platelets and clotting factors.',
        'Consumption plus fibrinolysis produces bleeding while microthrombi impair tissue perfusion.',
        'The combined process can cause hemorrhage, kidney injury, shock, and multi-organ failure.'
      ],
      redFlags: [
        'Petechiae on chest and arms',
        'Ecchymosis',
        'Oozing from IV insertion site',
        'Bleeding gums',
        'Pale/fatigued/lethargic',
        'Tachypnea',
        'Sinus tachycardia',
        'Urine output <30 mL/hr'
      ],
      inRoomSequence: [
        'Hand hygiene, two identifiers, standard precautions, rapid ABC/perfusion assessment.',
        'Inspect for bleeding at gums, IV sites, skin, urine/stool if available; assess neuro status and respiratory/cardiovascular perfusion.',
        'Review platelet count, PT/INR, aPTT, fibrinogen, D-dimer, lactate, renal function, and Hgb/Hct together rather than one value at a time.',
        'Recognize the DIC pattern: platelets and fibrinogen down, clotting times prolonged, D-dimer markedly elevated, plus clinical bleeding.',
        'Maintain ordered monitoring, oxygen goal, antibiotics, IV therapy, and strict I&O. Minimize unnecessary trauma/invasive procedures in the simulation.',
        'Prepare for blood product administration if/when ordered; the school sheet tells you to prepare but does not list an active blood-product order.',
        'Escalate for worsening bleeding, hypotension, mental-status change, respiratory compromise, or oliguria/organ dysfunction.',
        'SBAR the DIC pattern and patient deterioration.'
      ],
      deteriorationCues: [
        'Increasing bleeding or new sites',
        'Falling BP/rising HR',
        'Urine output <30 mL/hr or worsening renal labs',
        'Altered mental status',
        'Respiratory distress',
        'Falling Hgb/platelets/fibrinogen',
        'Rising lactate'
      ],
      sbarSkeleton: [
        'S: 72-year-old with sepsis now has multi-site bleeding concerning for DIC.',
        'B: Pneumonia progressed to sepsis; new gums/IV bleeding and petechiae.',
        'A: Platelets 48,000, PT 24, INR 2.8, aPTT 62, fibrinogen 90, D-dimer 5000, lactate 4.8, urine output <30 mL/hr.',
        'R: Immediate provider/RRT evaluation for DIC, bleeding/perfusion support, and blood products if ordered.'
      ],
      memoryHook: 'DIC = Does both: Inappropriate Clotting + bleeding. Think platelets/fibrinogen DOWN; PT/aPTT/D-dimer UP.',
      commonMistakes: [
        'Do not interpret a high D-dimer by itself; use the entire coagulation pattern and clinical bleeding.',
        'Do not give a blood product simply because you expect one; verify the order and policy.',
        'Avoid unnecessary needle sticks/trauma in a bleeding patient.'
      ],
      sourceIssues: [
        'The activity instructions include preparation for blood products, but the listed provider orders do not actually contain a blood-product order.'
      ],
      rapidFire: [
        {
          q: 'What happens to fibrinogen in this case?',
          a: 'It is low: 90.'
        },
        {
          q: 'What happens to D-dimer?',
          a: 'It is very high: 5000.'
        },
        {
          q: 'What platelet count is given?',
          a: '48,000.'
        },
        {
          q: 'What organ-perfusion clue is present?',
          a: 'Urine output <30 mL/hr with elevated creatinine and lactate.'
        },
        {
          q: 'Why can DIC bleed and clot at the same time?',
          a: 'Widespread clotting consumes platelets/factors while microthrombi impair perfusion and fibrinolysis contributes to bleeding.'
        }
      ],
      references: []
    }
  },
  {
    schema_version: '1.0',
    topic_id: 'heart_failure',
    title: 'Acute Heart Failure Exacerbation',
    provenance: 'school_file',
    source_file: 'MS2 Heart Failure 1 - Student.docx',
    duration_minutes: 20,
    education_only: true,
    case_intro: 'John Smith, age 72, presents with increasing shortness of breath, fatigue, lower-extremity swelling, recent weight gain, and orthopnea (cannot lie flat without feeling unable to breathe). He is mildly anxious and dyspneic with signs of fluid overload.',
    initial_findings: [
      'Mild-moderate dyspnea',
      'Crackles at both lung bases',
      'SpO2 91% on room air',
      'Bilateral +2 lower-extremity edema',
      'JVD',
      'Positive fluid balance',
      'Recent weight gain',
      'Orthopnea',
      'Fatigue and mild anxiety',
      'Sinus tachycardia'
    ],
    vital_trends: [
      {
        time: '0945',
        bp: '152/90',
        hr: '102',
        rr: '22',
        spo2: '91% RA',
        temp: '98.7 F'
      }
    ],
    labs: [
      {
        test: 'Sodium',
        result: '132',
        interpretation: 'Low'
      },
      {
        test: 'Potassium',
        result: '4.8',
        interpretation: 'High-normal'
      },
      {
        test: 'BUN',
        result: '28',
        interpretation: 'High'
      },
      {
        test: 'Creatinine',
        result: '1.3',
        interpretation: 'Slightly high'
      },
      {
        test: 'Glucose',
        result: '202',
        interpretation: 'High'
      },
      {
        test: 'BNP',
        result: '1,250',
        interpretation: 'Markedly high on school sheet'
      }
    ],
    diagnostics: ['ECG: sinus tachycardia.'],
    orders: [
      'Oxygen titration via nasal cannula to keep O2 >95%',
      'Continuous cardiac monitoring',
      'CBC, BMP, BNP',
      'STAT EKG',
      'Monitor I&O every hour'
    ],
    mar: [
      'No medications administered on the school sheet. The note says the patient was placed on 2 L nasal cannula after the 0945 vital signs.'
    ],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'assess_fluid_status',
        label: 'Assess Fluid Status',
        category: 'topic_specific'
      },
      {
        id: 'assess_crackles_orthopnea',
        label: 'Assess Crackles Orthopnea',
        category: 'topic_specific'
      },
      {
        id: 'oxygen_to_order',
        label: 'Oxygen To Order',
        category: 'topic_specific'
      },
      {
        id: 'cardiac_monitoring',
        label: 'Cardiac Monitoring',
        category: 'topic_specific'
      },
      {
        id: 'hourly_io',
        label: 'Hourly Io',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'abc_assessment',
      'assess_crackles_orthopnea',
      'assess_fluid_status',
      'oxygen_to_order',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'Increasing crackles/dyspnea',
      'Falling SpO2 despite oxygen',
      'Pink/frothy sputum or acute pulmonary edema',
      'New dysrhythmia',
      'Hypotension/cool skin/altered mental status',
      'Falling urine output',
      'Rapidly increasing edema/weight'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: 72-year-old with acute heart-failure exacerbation and hypoxemia/fluid overload.',
      'B: Chronic HF and HTN; progressive SOB, orthopnea, weight gain, and edema.',
      'A: SpO2 91% on room air, HR 102, crackles, JVD, +2 edema, positive fluid balance, BNP 1250.',
      'R: Request treatment plan for acute decompensated HF and immediate review if oxygenation or perfusion worsens.'
    ],
    source_discrepancies: [
      'The topic header says "Faculty" although the filename says Student.',
      'The educational required-knowledge section discusses diuretics/vasodilators/ACE-I/ARBs/beta-blockers, but the case provider orders contain no medication order. Exam mode should respect the actual case orders.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Recognize acute heart-failure fluid overload, assess oxygenation and perfusion, interpret BNP and cardiopulmonary findings, implement existing orders, and escalate pulmonary edema/low-output deterioration.',
      'FAILURE: Fluid accumulates, Air hunger/orthopnea, Increased BNP, Lung crackles, Urine/I&O, Right-sided edema/JVD, Escalate.',
      'Do not automatically administer furosemide just because HF usually involves diuretics; it is not ordered on this sheet.',
      'Do not focus only on edema; pulmonary status is the immediate ABC concern.',
      'Do not miss renal function/electrolytes when anticipating HF therapies.'
    ],
    lesson: {
      testing: 'Recognize acute heart-failure fluid overload, assess oxygenation and perfusion, interpret BNP and cardiopulmonary findings, implement existing orders, and escalate pulmonary edema/low-output deterioration.',
      caseStory: 'John Smith, age 72, presents with increasing shortness of breath, fatigue, lower-extremity swelling, recent weight gain, and orthopnea (cannot lie flat without feeling unable to breathe). He is mildly anxious and dyspneic with signs of fluid overload.',
      pathoChain: [
        'Reduced cardiac pumping effectiveness lowers forward output.',
        'Elevated filling pressures cause congestion.',
        'Left-sided congestion produces pulmonary fluid, crackles, dyspnea, and orthopnea.',
        'Systemic venous congestion can produce JVD and peripheral edema.',
        'Severe exacerbation can progress to pulmonary edema, dysrhythmia, cardiogenic shock, or respiratory failure.'
      ],
      redFlags: [
        'Mild-moderate dyspnea',
        'Crackles at both lung bases',
        'SpO2 91% on room air',
        'Bilateral +2 lower-extremity edema',
        'JVD',
        'Positive fluid balance',
        'Recent weight gain',
        'Orthopnea',
        'Fatigue and mild anxiety',
        'Sinus tachycardia'
      ],
      inRoomSequence: [
        'Hand hygiene, identifiers, immediate respiratory/circulatory assessment.',
        'Position for easier breathing and assess SpO2, RR/work of breathing, lung sounds, HR/rhythm, BP, perfusion, and mental status.',
        'Assess fluid volume: edema, JVD, weight trend, I&O, orthopnea, and recent weight gain.',
        'Recognize the combination of crackles + low room-air SpO2 + JVD/edema + BNP 1250 as an acute HF exacerbation pattern.',
        'Confirm oxygen titration to the ordered >95% target and continuous cardiac monitoring.',
        'Review BMP/BNP/ECG and watch sodium, potassium, renal function, and rhythm.',
        'Reassess after oxygen and report ongoing congestion/dyspnea. The source sheet has no diuretic/vasodilator order, so do not invent one in exam mode.',
        'Escalate for rapidly worsening dyspnea, frothy sputum/pulmonary edema, new dysrhythmia, hypotension, chest pain, or signs of poor perfusion.'
      ],
      deteriorationCues: [
        'Increasing crackles/dyspnea',
        'Falling SpO2 despite oxygen',
        'Pink/frothy sputum or acute pulmonary edema',
        'New dysrhythmia',
        'Hypotension/cool skin/altered mental status',
        'Falling urine output',
        'Rapidly increasing edema/weight'
      ],
      sbarSkeleton: [
        'S: 72-year-old with acute heart-failure exacerbation and hypoxemia/fluid overload.',
        'B: Chronic HF and HTN; progressive SOB, orthopnea, weight gain, and edema.',
        'A: SpO2 91% on room air, HR 102, crackles, JVD, +2 edema, positive fluid balance, BNP 1250.',
        'R: Request treatment plan for acute decompensated HF and immediate review if oxygenation or perfusion worsens.'
      ],
      memoryHook: 'FAILURE: Fluid accumulates, Air hunger/orthopnea, Increased BNP, Lung crackles, Urine/I&O, Right-sided edema/JVD, Escalate.',
      commonMistakes: [
        'Do not automatically administer furosemide just because HF usually involves diuretics; it is not ordered on this sheet.',
        'Do not focus only on edema; pulmonary status is the immediate ABC concern.',
        'Do not miss renal function/electrolytes when anticipating HF therapies.'
      ],
      sourceIssues: [
        'The topic header says "Faculty" although the filename says Student.',
        'The educational required-knowledge section discusses diuretics/vasodilators/ACE-I/ARBs/beta-blockers, but the case provider orders contain no medication order. Exam mode should respect the actual case orders.'
      ],
      rapidFire: [
        {
          q: 'Which biomarker is most striking?',
          a: 'BNP 1,250.'
        },
        {
          q: 'What finding suggests pulmonary congestion?',
          a: 'Bilateral basal crackles with dyspnea/orthopnea.'
        },
        {
          q: 'What findings suggest systemic venous congestion?',
          a: 'JVD and +2 leg edema.'
        },
        {
          q: 'What is the room-air SpO2?',
          a: '91%.'
        },
        {
          q: 'Should you give furosemide automatically?',
          a: 'No. There is no furosemide order in the provided case.'
        }
      ],
      references: []
    }
  },
  {
    schema_version: '1.0',
    topic_id: 'increased_icp',
    title: 'Increased Intracranial Pressure (ICP)',
    provenance: 'school_file',
    source_file: 'MS2 ICP Student.docx',
    duration_minutes: 20,
    education_only: true,
    case_intro: 'John Smith, age 72, was admitted after a motor vehicle accident with traumatic brain injury. Twelve hours later he develops headache, mild confusion, drowsiness, and a documented GCS decline. CT shows cerebral edema with increasing midline shift.',
    initial_findings: [
      'Headache',
      'Mild confusion/drowsiness',
      'GCS decline noted',
      'CT: cerebral edema with increasing midline shift',
      'Initially unlabored respirations and equal movement of extremities'
    ],
    vital_trends: [
      {
        time: '0600',
        bp: '128/78',
        hr: '84',
        rr: '18',
        spo2: '97%',
        temp: '99.4 F'
      },
      {
        time: '0900',
        bp: '138/84',
        hr: '88',
        rr: '18',
        spo2: '96%',
        temp: '99.0 F'
      }
    ],
    labs: [
      {
        test: 'Sodium',
        result: '138',
        interpretation: 'Normal'
      },
      {
        test: 'Potassium',
        result: '4.1',
        interpretation: 'Normal'
      },
      {
        test: 'BUN',
        result: '18',
        interpretation: 'Normal'
      },
      {
        test: 'Creatinine',
        result: '1.0',
        interpretation: 'Normal'
      },
      {
        test: 'Glucose',
        result: '110',
        interpretation: 'Upper-normal'
      },
      {
        test: 'WBC',
        result: '11.8',
        interpretation: 'Mildly high'
      }
    ],
    diagnostics: [
      'STAT CT head impression: cerebral edema with increasing midline shift, consistent with worsening intracranial pressure.'
    ],
    orders: [
      'Neuro checks every hour',
      'Maintain head of bed at 30 degrees',
      'Maintain oxygen SpO2 <95% as written on the school sheet - this is flagged as a likely direction/sign inconsistency and should be instructor-verified',
      'Strict intake and output',
      '0.9% sodium chloride 75 mL/hr',
      'Acetaminophen 650 mg PO for pain',
      'Mannitol 20% 42 g IV over 30 minutes (listed as pending physician order)',
      'STAT CT head'
    ],
    mar: [
      '0800 - acetaminophen 650 mg PO',
      '1000 - mannitol 20% 42 g IV',
      '1000 - 0.9% sodium chloride 75 mL/hr'
    ],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'neuro_gcs_pupils_motor',
        label: 'Neuro Gcs Pupils Motor',
        category: 'topic_specific'
      },
      {
        id: 'hob_30',
        label: 'Hob 30',
        category: 'topic_specific'
      },
      {
        id: 'review_ct',
        label: 'Review Ct',
        category: 'topic_specific'
      },
      {
        id: 'icp_deterioration_watch',
        label: 'Icp Deterioration Watch',
        category: 'topic_specific'
      },
      {
        id: 'verify_mannitol_order_status',
        label: 'Verify Mannitol Order Status',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'abc_assessment',
      'neuro_gcs_pupils_motor',
      'hob_30',
      'icp_deterioration_watch',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'Decreasing GCS/LOC',
      'New pupil asymmetry or sluggish/nonreactive pupils',
      'New focal weakness/posturing',
      'Repeated vomiting/seizure',
      'Widening pulse pressure with bradycardia and irregular respirations (Cushing triad pattern)',
      'Respiratory compromise'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: 72-year-old TBI patient has new neurologic decline concerning for increased ICP.',
      'B: Headache, confusion/drowsiness, documented GCS decline; CT shows cerebral edema with increasing midline shift.',
      'A: Current neuro findings compared with baseline; concern for worsening cerebral perfusion/herniation risk.',
      'R: Immediate neuro/provider/RRT evaluation and clarification/implementation of ICP treatment orders.'
    ],
    source_discrepancies: [
      'Provider order says "Maintain oxygen SpO2 <95%," which appears directionally inconsistent with usual oxygenation goals. Verify with instructor before using it for scoring.',
      'Mannitol is listed as "pending physician order" but the MAR records mannitol at 1000. The app must support an instructor correction/override.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Detect subtle neurologic deterioration after traumatic brain injury, trend GCS/pupils/motor findings, maintain ICP precautions, review CT findings, and escalate before herniation.',
      'ICP: Inspect GCS/pupils, Cranial pressure rising, Position HOB 30, Prevent secondary injury.',
      'Do not rely on stable vital signs to rule out early ICP deterioration.',
      'Do not miss a subtle trend in GCS/behavior.',
      'Do not treat the school sheet\'s "SpO2 <95%" wording as a safe universal oxygen target; it needs instructor correction.'
    ],
    lesson: {
      testing: 'Detect subtle neurologic deterioration after traumatic brain injury, trend GCS/pupils/motor findings, maintain ICP precautions, review CT findings, and escalate before herniation.',
      caseStory: 'John Smith, age 72, was admitted after a motor vehicle accident with traumatic brain injury. Twelve hours later he develops headache, mild confusion, drowsiness, and a documented GCS decline. CT shows cerebral edema with increasing midline shift.',
      pathoChain: [
        'Traumatic injury can cause cerebral edema and increased intracranial volume.',
        'Rising ICP can reduce cerebral perfusion pressure and cerebral blood flow.',
        'Reduced perfusion causes ischemia and further swelling, creating a dangerous cycle.',
        'Untreated deterioration can progress to Cushing response, herniation, respiratory failure, permanent injury, and death.'
      ],
      redFlags: [
        'Headache',
        'Mild confusion/drowsiness',
        'GCS decline noted',
        'CT: cerebral edema with increasing midline shift',
        'Initially unlabored respirations and equal movement of extremities'
      ],
      inRoomSequence: [
        'Hand hygiene, identifiers, safety, immediate ABC and neurologic baseline.',
        'Perform a focused neuro exam: LOC/orientation, GCS, pupils, speech, motor strength/drift, sensation if appropriate, headache, vomiting, and behavior.',
        'Trend findings against prior assessments. A change in GCS/mentation is more important than a single normal-looking vital sign.',
        'Maintain HOB 30 degrees as ordered and avoid unnecessary stimulation/positioning that could worsen ICP per school/facility practice.',
        'Review CT result showing edema and midline shift.',
        'Verify active orders and medication timing. Because the sheet conflicts on whether mannitol is pending versus already given, the app should display that discrepancy and allow an instructor override.',
        'Monitor I&O and neurologic response after interventions.',
        'Escalate immediately for worsening GCS, pupil asymmetry, new weakness, seizure, abnormal breathing, or Cushing-triad pattern.'
      ],
      deteriorationCues: [
        'Decreasing GCS/LOC',
        'New pupil asymmetry or sluggish/nonreactive pupils',
        'New focal weakness/posturing',
        'Repeated vomiting/seizure',
        'Widening pulse pressure with bradycardia and irregular respirations (Cushing triad pattern)',
        'Respiratory compromise'
      ],
      sbarSkeleton: [
        'S: 72-year-old TBI patient has new neurologic decline concerning for increased ICP.',
        'B: Headache, confusion/drowsiness, documented GCS decline; CT shows cerebral edema with increasing midline shift.',
        'A: Current neuro findings compared with baseline; concern for worsening cerebral perfusion/herniation risk.',
        'R: Immediate neuro/provider/RRT evaluation and clarification/implementation of ICP treatment orders.'
      ],
      memoryHook: 'ICP: Inspect GCS/pupils, Cranial pressure rising, Position HOB 30, Prevent secondary injury.',
      commonMistakes: [
        'Do not rely on stable vital signs to rule out early ICP deterioration.',
        'Do not miss a subtle trend in GCS/behavior.',
        'Do not treat the school sheet\'s "SpO2 <95%" wording as a safe universal oxygen target; it needs instructor correction.'
      ],
      sourceIssues: [
        'Provider order says "Maintain oxygen SpO2 <95%," which appears directionally inconsistent with usual oxygenation goals. Verify with instructor before using it for scoring.',
        'Mannitol is listed as "pending physician order" but the MAR records mannitol at 1000. The app must support an instructor correction/override.'
      ],
      rapidFire: [
        {
          q: 'What is the most important trend?',
          a: 'Neurologic trend, especially GCS/LOC and pupils.'
        },
        {
          q: 'What CT finding is present?',
          a: 'Cerebral edema with increasing midline shift.'
        },
        {
          q: 'What position is ordered?',
          a: 'Head of bed 30 degrees.'
        },
        {
          q: 'What is Cushing triad?',
          a: 'A late deterioration pattern: hypertension/widened pulse pressure, bradycardia, and irregular respirations.'
        },
        {
          q: 'What order should be flagged for instructor verification?',
          a: 'The written SpO2 <95% target.'
        }
      ],
      references: []
    }
  },
  {
    schema_version: '1.0',
    topic_id: 'pulmonary_embolism',
    title: 'Pulmonary Embolism With Progression Toward Obstructive Shock',
    provenance: 'school_file',
    source_file: 'MS2 PE Student.docx',
    duration_minutes: 20,
    education_only: true,
    case_intro: 'At 1000 you assume care of Jane Smith, age 72, postoperative day 3 after left total knee replacement. She had calf discomfort and swelling, then developed sudden dyspnea, pleuritic chest pain, anxiety, tachycardia, and declining oxygen saturation.',
    initial_findings: [
      'Sudden dyspnea',
      'Pleuritic chest pain',
      'Anxiety/restlessness',
      'Tachypnea/increased work of breathing',
      'Sinus tachycardia',
      'Dizziness',
      'Pallor/diaphoresis',
      'Calf tenderness noted in initial assessment'
    ],
    vital_trends: [
      {
        time: '0600',
        bp: '128/80',
        hr: '88',
        rr: '18',
        spo2: '97%',
        temp: '98.4 F'
      },
      {
        time: '1000',
        bp: '124/78',
        hr: '98',
        rr: '20',
        spo2: '95%',
        temp: '98.4 F'
      }
    ],
    labs: [
      {
        test: 'D-dimer',
        result: '2.8',
        interpretation: 'High'
      },
      {
        test: 'Troponin',
        result: '0.12',
        interpretation: 'High'
      },
      {
        test: 'BNP',
        result: '420',
        interpretation: 'High'
      },
      {
        test: 'pH',
        result: '7.48',
        interpretation: 'Alkalemic'
      },
      {
        test: 'PaCO2',
        result: '30',
        interpretation: 'Low'
      },
      {
        test: 'PaO2',
        result: '60',
        interpretation: 'Low'
      },
      {
        test: 'HCO3',
        result: '22',
        interpretation: 'Normal/low-normal'
      },
      {
        test: 'Platelets',
        result: '285,000',
        interpretation: 'Normal'
      }
    ],
    diagnostics: [
      'CT angiography: large right pulmonary artery embolus consistent with acute PE.',
      'Venous Doppler: left lower-extremity DVT.'
    ],
    orders: [
      'Oxygen 2 L nasal cannula to keep O2 >95%',
      'Continuous pulse oximetry',
      'Continuous cardiac monitoring',
      'CT angiography STAT',
      'Heparin bolus and infusion per protocol',
      'Notify provider for worsening respiratory status',
      'Prepare for thrombolytic therapy if ordered',
      'Venous Doppler ultrasound LLE',
      'ICU transfer if unstable'
    ],
    mar: [
      '0800 - enoxaparin 40 mg SQ',
      '1015 - heparin bolus',
      '1020 - heparin infusion'
    ],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'oxygen_to_order',
        label: 'Oxygen To Order',
        category: 'topic_specific'
      },
      {
        id: 'continuous_monitoring',
        label: 'Continuous Monitoring',
        category: 'topic_specific'
      },
      {
        id: 'review_cta_doppler',
        label: 'Review Cta Doppler',
        category: 'topic_specific'
      },
      {
        id: 'verify_heparin_protocol',
        label: 'Verify Heparin Protocol',
        category: 'topic_specific'
      },
      {
        id: 'assess_obstructive_shock',
        label: 'Assess Obstructive Shock',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'abc_assessment',
      'oxygen_to_order',
      'review_cta_doppler',
      'verify_heparin_protocol',
      'assess_obstructive_shock',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'Sudden worsening hypoxemia',
      'Hypotension/falling MAP',
      'Marked tachycardia',
      'Syncope/altered mental status',
      'Cool clammy skin',
      'Chest pain/dyspnea worsening',
      'Signs of right-heart strain/shock'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: 72-year-old POD3 after left knee replacement with acute PE symptoms.',
      'B: Calf discomfort/swelling followed by sudden dyspnea and pleuritic chest pain.',
      'A: PaO2 60 with respiratory alkalemia; D-dimer 2.8; CTA shows large right pulmonary artery PE; Doppler shows LLE DVT.',
      'R: Continue/verify ordered heparin and oxygen, urgent review for instability, thrombolytic consideration if ordered, ICU transfer if unstable.'
    ],
    source_discrepancies: [
      'The Doppler identifies a left lower-extremity DVT, but the initial assessment lists right calf tenderness. Verify which side your instructor expects.',
      'The topic header says "Faculty" even though the filename says Student.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Recognize sudden PE after orthopedic surgery, interpret ABG/CTA/Doppler findings, support oxygenation, implement anticoagulation orders, and detect progression to obstructive shock.',
      'PE = Post-op + Pleuritic pain + Poor oxygenation + Pulmonary artery clot.',
      'Do not dismiss sudden anxiety/restlessness as purely emotional in a hypoxemic postoperative patient.',
      'Do not give thrombolytic therapy without an order.',
      'Monitor anticoagulation/bleeding per protocol after heparin starts.'
    ],
    lesson: {
      testing: 'Recognize sudden PE after orthopedic surgery, interpret ABG/CTA/Doppler findings, support oxygenation, implement anticoagulation orders, and detect progression to obstructive shock.',
      caseStory: 'At 1000 you assume care of Jane Smith, age 72, postoperative day 3 after left total knee replacement. She had calf discomfort and swelling, then developed sudden dyspnea, pleuritic chest pain, anxiety, tachycardia, and declining oxygen saturation.',
      pathoChain: [
        'Postoperative venous stasis/injury can promote lower-extremity DVT.',
        'A thrombus can embolize to the pulmonary arterial circulation.',
        'Pulmonary vascular obstruction causes ventilation-perfusion mismatch and hypoxemia.',
        'Large PE increases right-ventricular afterload and can reduce left-sided filling/cardiac output, progressing to obstructive shock.'
      ],
      redFlags: [
        'Sudden dyspnea',
        'Pleuritic chest pain',
        'Anxiety/restlessness',
        'Tachypnea/increased work of breathing',
        'Sinus tachycardia',
        'Dizziness',
        'Pallor/diaphoresis',
        'Calf tenderness noted in initial assessment'
      ],
      inRoomSequence: [
        'Hand hygiene, identifiers, rapid ABC/cardiopulmonary assessment.',
        'Assess onset/quality of chest pain, dyspnea, RR/work of breathing, SpO2, HR/rhythm, BP, mental status, skin/perfusion, and operative leg symptoms.',
        'Recognize sudden postoperative dyspnea + pleuritic pain + hypoxemia as PE until proven otherwise in this scenario.',
        'Apply/verify oxygen and continuous monitoring per orders.',
        'Review ABG, D-dimer, CTA, and Doppler. CTA confirms a large right pulmonary artery embolus; Doppler confirms LLE DVT.',
        'Verify heparin bolus/infusion per protocol and monitor for bleeding according to school/facility process.',
        'Reassess for shock: falling BP/MAP, worsening tachycardia, altered mentation, cool/clammy skin, worsening hypoxemia.',
        'Notify/escalate immediately for worsening respiratory/hemodynamic status; prepare thrombolytic therapy only if ordered and ICU transfer if unstable.'
      ],
      deteriorationCues: [
        'Sudden worsening hypoxemia',
        'Hypotension/falling MAP',
        'Marked tachycardia',
        'Syncope/altered mental status',
        'Cool clammy skin',
        'Chest pain/dyspnea worsening',
        'Signs of right-heart strain/shock'
      ],
      sbarSkeleton: [
        'S: 72-year-old POD3 after left knee replacement with acute PE symptoms.',
        'B: Calf discomfort/swelling followed by sudden dyspnea and pleuritic chest pain.',
        'A: PaO2 60 with respiratory alkalemia; D-dimer 2.8; CTA shows large right pulmonary artery PE; Doppler shows LLE DVT.',
        'R: Continue/verify ordered heparin and oxygen, urgent review for instability, thrombolytic consideration if ordered, ICU transfer if unstable.'
      ],
      memoryHook: 'PE = Post-op + Pleuritic pain + Poor oxygenation + Pulmonary artery clot.',
      commonMistakes: [
        'Do not dismiss sudden anxiety/restlessness as purely emotional in a hypoxemic postoperative patient.',
        'Do not give thrombolytic therapy without an order.',
        'Monitor anticoagulation/bleeding per protocol after heparin starts.'
      ],
      sourceIssues: [
        'The Doppler identifies a left lower-extremity DVT, but the initial assessment lists right calf tenderness. Verify which side your instructor expects.',
        'The topic header says "Faculty" even though the filename says Student.'
      ],
      rapidFire: [
        {
          q: 'What imaging confirms the PE?',
          a: 'CT angiography.'
        },
        {
          q: 'What ABG pattern is present?',
          a: 'Respiratory alkalemia with hypoxemia: pH 7.48, PaCO2 30, PaO2 60.'
        },
        {
          q: 'What anticoagulant is ordered?',
          a: 'Heparin bolus and infusion per protocol.'
        },
        {
          q: 'What shock type can a massive PE cause?',
          a: 'Obstructive shock.'
        },
        {
          q: 'What side is the Doppler-proven DVT?',
          a: 'Left lower extremity, despite a conflicting right-calf exam note.'
        }
      ],
      references: []
    }
  },
  {
    schema_version: '1.0',
    topic_id: 'sepsis',
    title: 'Sepsis With Progression Toward Septic Shock',
    provenance: 'school_file',
    source_file: 'MS2 Sepsis Student.docx',
    duration_minutes: 20,
    education_only: true,
    case_intro: 'At 1030 you assume care of Jane Smith, age 72, admitted yesterday with community-acquired pneumonia. She now has worsening fatigue, dizziness, confusion, leukocytosis, elevated lactate, kidney dysfunction, fever, tachycardia, tachypnea, hypotension trend, and falling oxygen saturation.',
    initial_findings: [
      'Confusion/lethargy/difficulty focusing',
      'Tachypnea and shortness of breath',
      'Tachycardia',
      'Warm skin',
      'Fever',
      'SpO2 falling to 90%',
      'BP falling to 92/58'
    ],
    vital_trends: [
      {
        time: '0600',
        bp: '118/72',
        hr: '94',
        rr: '18',
        spo2: '95%',
        temp: '100.8 F'
      },
      {
        time: '0800',
        bp: '108/66',
        hr: '104',
        rr: '22',
        spo2: '95%',
        temp: '101.4 F'
      },
      {
        time: '1000',
        bp: '92/58',
        hr: '118',
        rr: '26',
        spo2: '90%',
        temp: '102.2 F'
      }
    ],
    labs: [
      {
        test: 'WBC',
        result: '19.8',
        interpretation: 'High'
      },
      {
        test: 'Sodium',
        result: '132',
        interpretation: 'Low'
      },
      {
        test: 'BUN',
        result: '38',
        interpretation: 'High'
      },
      {
        test: 'Creatinine',
        result: '2.0',
        interpretation: 'High'
      },
      {
        test: 'Glucose',
        result: '186',
        interpretation: 'High'
      },
      {
        test: 'Lactate',
        result: '4.6',
        interpretation: 'High'
      },
      {
        test: 'Blood cultures',
        result: 'Gram-positive cocci',
        interpretation: 'Final sensitivity pending'
      }
    ],
    diagnostics: [],
    orders: [
      'Oxygen 2 L nasal cannula to keep O2 >95%',
      'Vital signs every 15 minutes',
      'Bedside blood glucose before meals, at bedtime, and PRN',
      'Repeat lactate in 4 hours',
      'Acetaminophen 650 mg PO every 6 hours PRN fever',
      'Notify provider if MAP <65 mm Hg',
      'Strict intake and output',
      'Cefepime 2 g IV every 8 hours',
      'Vancomycin 1 g IV every 24 hours'
    ],
    mar: [
      '0800 - acetaminophen 650 mg PO',
      '0900 - 0.9% sodium chloride 125 mL/hr',
      '0900 - cefepime 2 g IV',
      '1000 - vancomycin 1 g IV',
      '1015 - 0.9% sodium chloride 1 L bolus'
    ],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'assess_perfusion_mentation',
        label: 'Assess Perfusion Mentation',
        category: 'topic_specific'
      },
      {
        id: 'oxygen_to_order',
        label: 'Oxygen To Order',
        category: 'topic_specific'
      },
      {
        id: 'strict_io',
        label: 'Strict Io',
        category: 'topic_specific'
      },
      {
        id: 'verify_antibiotics',
        label: 'Verify Antibiotics',
        category: 'topic_specific'
      },
      {
        id: 'verify_iv_fluids',
        label: 'Verify Iv Fluids',
        category: 'topic_specific'
      },
      {
        id: 'monitor_map',
        label: 'Monitor Map',
        category: 'topic_specific'
      },
      {
        id: 'repeat_lactate_order',
        label: 'Repeat Lactate Order',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'abc_assessment',
      'assess_perfusion_mentation',
      'verify_antibiotics',
      'verify_iv_fluids',
      'monitor_map',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'MAP <65 or falling BP',
      'Worsening confusion/lethargy',
      'SpO2 declining despite oxygen',
      'Increasing RR/work of breathing',
      'Oliguria/worsening creatinine',
      'Rising or non-clearing lactate',
      'Cool/mottled skin or other shock signs'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: 72-year-old with pneumonia now has sepsis with worsening perfusion and oxygenation.',
      'B: Increasing fatigue/confusion; cefepime, vancomycin, fluids, and oxygen are in progress.',
      'A: BP 92/58, HR 118, RR 26, temp 102.2, SpO2 90%; WBC 19.8, lactate 4.6, creatinine 2.0, blood cultures with gram-positive cocci.',
      'R: Immediate reassessment/escalation for progression toward septic shock; continue ordered resuscitation and repeat lactate/monitor MAP.'
    ],
    source_discrepancies: [
      'The top of the school document incorrectly labels the topic as "Disseminated Intravascular Coagulation (Student)" even though the entire case is sepsis.',
      'The app should label the scenario Sepsis and preserve the mismatch in the source-notes panel rather than teaching DIC as the topic.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Recognize infection plus organ dysfunction and impaired perfusion, trend vitals/lactate/renal function, implement ordered oxygen/antibiotics/fluids, and escalate progression toward septic shock.',
      'SEPSIS: Source infection, Elevated lactate, Perfusion falling, Systems/organs changing, Immediate treatment, Shock watch.',
      'Do not wait for profound hypotension before recognizing deterioration; organ dysfunction is already present.',
      'Do not focus on fever alone. Mental status, kidney function, lactate, oxygenation, and BP trend matter.',
      'In exam mode, distinguish school orders from supplemental guideline teaching.'
    ],
    lesson: {
      testing: 'Recognize infection plus organ dysfunction and impaired perfusion, trend vitals/lactate/renal function, implement ordered oxygen/antibiotics/fluids, and escalate progression toward septic shock.',
      caseStory: 'At 1030 you assume care of Jane Smith, age 72, admitted yesterday with community-acquired pneumonia. She now has worsening fatigue, dizziness, confusion, leukocytosis, elevated lactate, kidney dysfunction, fever, tachycardia, tachypnea, hypotension trend, and falling oxygen saturation.',
      pathoChain: [
        'Pneumonia provides an infectious source.',
        'A dysregulated systemic host response causes vasodilation, endothelial injury, capillary leak, and impaired microcirculatory perfusion.',
        'Tissue hypoperfusion is reflected by rising lactate and organ dysfunction such as altered mentation and acute kidney injury.',
        'Persistent hypotension/hypoperfusion despite resuscitation can progress to septic shock and multi-organ failure.'
      ],
      redFlags: [
        'Confusion/lethargy/difficulty focusing',
        'Tachypnea and shortness of breath',
        'Tachycardia',
        'Warm skin',
        'Fever',
        'SpO2 falling to 90%',
        'BP falling to 92/58'
      ],
      inRoomSequence: [
        'Hand hygiene, identifiers, rapid ABC/perfusion and mental-status assessment.',
        'Trend vitals rather than viewing the 1000 set alone: BP is falling, HR/RR/temp are rising, and SpO2 is falling.',
        'Assess source/infection signs plus organ dysfunction: confusion, renal function/urine output, oxygenation, perfusion, and lactate.',
        'Recognize lactate 4.6 and creatinine 2.0 with altered mentation as major perfusion/organ-dysfunction concerns.',
        'Confirm ordered oxygen, q15-minute vitals, strict I&O, antibiotics, IV fluids, glucose monitoring, and repeat lactate.',
        'Reassess MAP/perfusion after fluid and antibiotics. Notify provider at the school threshold MAP <65 and escalate sooner if clinically unstable.',
        'Use SBAR and activate RRT/ICU escalation for worsening hypotension, hypoxemia, mental status, or organ dysfunction.'
      ],
      deteriorationCues: [
        'MAP <65 or falling BP',
        'Worsening confusion/lethargy',
        'SpO2 declining despite oxygen',
        'Increasing RR/work of breathing',
        'Oliguria/worsening creatinine',
        'Rising or non-clearing lactate',
        'Cool/mottled skin or other shock signs'
      ],
      sbarSkeleton: [
        'S: 72-year-old with pneumonia now has sepsis with worsening perfusion and oxygenation.',
        'B: Increasing fatigue/confusion; cefepime, vancomycin, fluids, and oxygen are in progress.',
        'A: BP 92/58, HR 118, RR 26, temp 102.2, SpO2 90%; WBC 19.8, lactate 4.6, creatinine 2.0, blood cultures with gram-positive cocci.',
        'R: Immediate reassessment/escalation for progression toward septic shock; continue ordered resuscitation and repeat lactate/monitor MAP.'
      ],
      memoryHook: 'SEPSIS: Source infection, Elevated lactate, Perfusion falling, Systems/organs changing, Immediate treatment, Shock watch.',
      commonMistakes: [
        'Do not wait for profound hypotension before recognizing deterioration; organ dysfunction is already present.',
        'Do not focus on fever alone. Mental status, kidney function, lactate, oxygenation, and BP trend matter.',
        'In exam mode, distinguish school orders from supplemental guideline teaching.'
      ],
      sourceIssues: [
        'The top of the school document incorrectly labels the topic as "Disseminated Intravascular Coagulation (Student)" even though the entire case is sepsis.',
        'The app should label the scenario Sepsis and preserve the mismatch in the source-notes panel rather than teaching DIC as the topic.'
      ],
      rapidFire: [
        {
          q: 'What is the lactate?',
          a: '4.6.'
        },
        {
          q: 'What organ dysfunction is present?',
          a: 'Altered mental status and kidney injury (creatinine 2.0), with worsening oxygenation.'
        },
        {
          q: 'What school threshold triggers provider notification?',
          a: 'MAP <65 mm Hg.'
        },
        {
          q: 'What is the infectious source?',
          a: 'Community-acquired pneumonia.'
        },
        {
          q: 'What antibiotics are ordered?',
          a: 'Cefepime and vancomycin.'
        }
      ],
      references: [
        {
          label: 'SCCM Surviving Sepsis Campaign Adult Guidelines (2026 page)',
          url: 'https://sccm.org/survivingsepsiscampaign/guidelines-and-resources/surviving-sepsis-campaign-adult-guidelines'
        }
      ],
      supplementalNote: 'Current supplemental note (2026 SCCM/Surviving Sepsis Campaign): sepsis/septic shock are medical emergencies; the current adult guideline suggests at least 30 mL/kg IV crystalloid within the first 3 hours for sepsis-induced hypoperfusion/septic shock, uses an initial MAP target of 65 mm Hg for most adults, and recommends antimicrobials immediately (ideally within 1 hour) for probable/definite sepsis or septic shock. These points are supplemental and do not replace the school case orders.'
    }
  },
  {
    schema_version: '1.0',
    topic_id: 'pneumonia',
    title: 'Pneumonia - Supplemental Practice Module',
    provenance: 'generated_supplemental_practice',
    source_file: null,
    duration_minutes: 20,
    education_only: true,
    case_intro: 'Generated practice case: a 72-year-old adult with community-acquired pneumonia presents with fever, productive cough, pleuritic discomfort, crackles, tachypnea, fatigue, and low oxygen saturation. The student must identify impaired gas exchange and recognize when pneumonia is becoming sepsis or respiratory failure.',
    initial_findings: [
      'Cough with or without sputum',
      'Fever/chills',
      'Shortness of breath',
      'Pleuritic chest pain',
      'Crackles or other abnormal breath sounds',
      'Tachypnea',
      'Low SpO2',
      'Older adults may present with confusion/fatigue'
    ],
    vital_trends: [
      {
        time: 'Practice baseline',
        bp: '128/74',
        hr: '104',
        rr: '26',
        spo2: '89% RA',
        temp: '101.9 F'
      },
      {
        time: 'After ordered oxygen',
        bp: '126/72',
        hr: '100',
        rr: '24',
        spo2: '94%',
        temp: '101.7 F'
      }
    ],
    labs: [
      {
        test: 'WBC',
        result: '16.8',
        interpretation: 'Practice value: high'
      },
      {
        test: 'BUN',
        result: '26',
        interpretation: 'Practice value: high'
      },
      {
        test: 'Creatinine',
        result: '1.1',
        interpretation: 'Practice value'
      },
      {
        test: 'Lactate',
        result: '1.8',
        interpretation: 'Practice value, not elevated'
      }
    ],
    diagnostics: [
      'Practice chest X-ray: right lower-lobe infiltrate/consolidation.',
      'Pulse oximetry is central to assessing oxygenation; ABG may be used if severely ill.'
    ],
    orders: [
      'Practice-only example orders: oxygen to provider target, pulse oximetry, CBC/BMP, chest X-ray, cultures if ordered, IV/oral antimicrobial therapy as prescribed, hydration as ordered, and respiratory hygiene/airway-clearance measures. Exact school orders must be substituted if provided.'
    ],
    mar: [
      'Practice-only medication examples should be configured by the instructor. Do not hard-code one antibiotic regimen as universally correct.'
    ],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'focused_respiratory',
        label: 'Focused Respiratory',
        category: 'topic_specific'
      },
      {
        id: 'oxygen_to_order',
        label: 'Oxygen To Order',
        category: 'topic_specific'
      },
      {
        id: 'review_cxr',
        label: 'Review Cxr',
        category: 'topic_specific'
      },
      {
        id: 'specimens_if_ordered',
        label: 'Specimens If Ordered',
        category: 'topic_specific'
      },
      {
        id: 'admin_antimicrobials_if_ordered',
        label: 'Admin Antimicrobials If Ordered',
        category: 'topic_specific'
      },
      {
        id: 'screen_deterioration',
        label: 'Screen Deterioration',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'abc_assessment',
      'focused_respiratory',
      'oxygen_to_order',
      'screen_deterioration',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'SpO2 falling/rising oxygen requirement',
      'Increasing RR/accessory-muscle use',
      'Confusion or lethargy',
      'Hypotension/tachycardia',
      'Rising lactate/renal dysfunction',
      'Diffuse infiltrates/ARDS pattern',
      'Sepsis signs'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: Adult with pneumonia has worsening hypoxemia/respiratory status.',
      'B: Fever, cough, infiltrate, and increasing oxygen need.',
      'A: Report current vitals, SpO2, work of breathing, lung sounds, mental status, key labs/imaging, and response to treatment.',
      'R: Request evaluation for treatment escalation, sepsis screening, or respiratory support based on the deterioration.'
    ],
    source_discrepancies: [
      'No school-specific pneumonia document was provided. This module is supplemental and must not be used to infer the exact school checklist or medication orders.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Practice focused respiratory assessment, oxygenation, diagnostics, medication safety, secretion management, and early recognition of deterioration toward sepsis or acute respiratory failure.',
      'PNEUMONIA: Productive cough, New infiltrate, Elevated temp/WBC, Uneasy breathing, Monitor oxygen, Organism-directed meds, Notify if worsening, Incentive/deep breathing as appropriate, Assess sepsis.',
      'Do not assume every pneumonia is bacterial or use one antibiotic regimen universally.',
      'Do not ignore confusion in an older adult; it may be a deterioration clue.',
      'Do not delay escalation when oxygen needs or work of breathing are rising.'
    ],
    lesson: {
      testing: 'Practice focused respiratory assessment, oxygenation, diagnostics, medication safety, secretion management, and early recognition of deterioration toward sepsis or acute respiratory failure.',
      caseStory: 'Generated practice case: a 72-year-old adult with community-acquired pneumonia presents with fever, productive cough, pleuritic discomfort, crackles, tachypnea, fatigue, and low oxygen saturation. The student must identify impaired gas exchange and recognize when pneumonia is becoming sepsis or respiratory failure.',
      pathoChain: [
        'Infection inflames the alveoli and surrounding lung tissue.',
        'Alveoli can fill with inflammatory fluid/exudate, reducing effective gas exchange.',
        'The patient may develop hypoxemia, tachypnea, fever, cough, and focal or diffuse abnormal lung sounds.',
        'Severe disease can progress to sepsis, ARDS, or acute respiratory failure.'
      ],
      redFlags: [
        'Cough with or without sputum',
        'Fever/chills',
        'Shortness of breath',
        'Pleuritic chest pain',
        'Crackles or other abnormal breath sounds',
        'Tachypnea',
        'Low SpO2',
        'Older adults may present with confusion/fatigue'
      ],
      inRoomSequence: [
        'Hand hygiene, two identifiers, respiratory precautions as required by the suspected organism/facility policy.',
        'Assess airway, RR/work of breathing, SpO2, lung sounds, cough/sputum, chest discomfort, temperature, mental status, and hydration.',
        'Position to optimize ventilation and apply oxygen only according to the active practice/provider order.',
        'Review chest imaging and CBC; obtain cultures/specimens when ordered and before antibiotics when doing so will not substantially delay treatment.',
        'Administer ordered antimicrobials and fluids safely, then reassess oxygenation, respiratory effort, fever, and mental status.',
        'Escalate if oxygen requirement rises, work of breathing increases, mentation changes, BP falls, lactate rises, or urine output declines.'
      ],
      deteriorationCues: [
        'SpO2 falling/rising oxygen requirement',
        'Increasing RR/accessory-muscle use',
        'Confusion or lethargy',
        'Hypotension/tachycardia',
        'Rising lactate/renal dysfunction',
        'Diffuse infiltrates/ARDS pattern',
        'Sepsis signs'
      ],
      sbarSkeleton: [
        'S: Adult with pneumonia has worsening hypoxemia/respiratory status.',
        'B: Fever, cough, infiltrate, and increasing oxygen need.',
        'A: Report current vitals, SpO2, work of breathing, lung sounds, mental status, key labs/imaging, and response to treatment.',
        'R: Request evaluation for treatment escalation, sepsis screening, or respiratory support based on the deterioration.'
      ],
      memoryHook: 'PNEUMONIA: Productive cough, New infiltrate, Elevated temp/WBC, Uneasy breathing, Monitor oxygen, Organism-directed meds, Notify if worsening, Incentive/deep breathing as appropriate, Assess sepsis.',
      commonMistakes: [
        'Do not assume every pneumonia is bacterial or use one antibiotic regimen universally.',
        'Do not ignore confusion in an older adult; it may be a deterioration clue.',
        'Do not delay escalation when oxygen needs or work of breathing are rising.'
      ],
      sourceIssues: [
        'No school-specific pneumonia document was provided. This module is supplemental and must not be used to infer the exact school checklist or medication orders.'
      ],
      rapidFire: [
        {
          q: 'What is pneumonia at the tissue level?',
          a: 'An infection/inflammatory process involving lung tissue and alveoli that can impair gas exchange.'
        },
        {
          q: 'What common test visualizes an infiltrate?',
          a: 'Chest X-ray.'
        },
        {
          q: 'What bedside measurement directly tracks oxygenation?',
          a: 'Pulse oximetry.'
        },
        {
          q: 'What two school topics can severe pneumonia progress into?',
          a: 'Sepsis and ARDS/acute respiratory failure.'
        },
        {
          q: 'What should the app do with antibiotic choices?',
          a: 'Use the scenario/provider order; do not hard-code one universal regimen.'
        }
      ],
      references: [
        {
          label: 'NHLBI Pneumonia',
          url: 'https://www.nhlbi.nih.gov/health/pneumonia'
        },
        {
          label: 'NHLBI Pneumonia Diagnosis',
          url: 'https://www.nhlbi.nih.gov/health/pneumonia/diagnosis'
        },
        {
          label: 'NHLBI Pneumonia Treatment',
          url: 'https://www.nhlbi.nih.gov/health/pneumonia/treatment'
        },
        {
          label: 'ATS/IDSA CAP Guideline',
          url: 'https://www.idsociety.org/practice-guideline/community-acquired-pneumonia-cap-in-adults/'
        }
      ]
    }
  },
  {
    schema_version: '1.0',
    topic_id: 'appendicitis',
    title: 'Acute Appendicitis - Supplemental Practice Module',
    provenance: 'generated_supplemental_practice',
    source_file: null,
    duration_minutes: 20,
    education_only: true,
    case_intro: 'Generated practice case: an adult reports vague periumbilical pain that migrated to the right lower quadrant with anorexia, nausea, low-grade fever, and focal tenderness. The scenario may later introduce worsening diffuse pain, rigidity, fever, and tachycardia to test recognition of perforation/peritonitis.',
    initial_findings: [
      'Pain often begins near the umbilicus and migrates to the RLQ',
      'Anorexia',
      'Nausea/vomiting',
      'Low-grade fever',
      'Localized tenderness/guarding',
      'Pain may worsen with movement/coughing',
      'Older adults may have less dramatic symptoms'
    ],
    vital_trends: [
      {
        time: 'Practice baseline',
        bp: '126/78',
        hr: '102',
        rr: '20',
        spo2: '98%',
        temp: '100.6 F'
      },
      {
        time: 'Perforation branch',
        bp: '98/60',
        hr: '122',
        rr: '26',
        spo2: '95%',
        temp: '102.4 F'
      }
    ],
    labs: [
      {
        test: 'WBC',
        result: '14.6',
        interpretation: 'Practice value: high'
      },
      {
        test: 'Neutrophils',
        result: '84%',
        interpretation: 'Practice value: high'
      },
      {
        test: 'CRP',
        result: 'Elevated',
        interpretation: 'Practice qualitative value'
      }
    ],
    diagnostics: [
      'Practice CT abdomen/pelvis: enlarged inflamed appendix with periappendiceal inflammatory change; no abscess in uncomplicated branch.',
      'Ultrasound is often used in children/pregnancy; imaging choice depends on patient and setting.'
    ],
    orders: [
      'Practice-only example orders: NPO, IV fluids, analgesia/antiemetic, labs, imaging, surgical consult, antibiotics when ordered, pre-op preparation. Replace with school-specific orders if provided.'
    ],
    mar: [
      'No universal medication schedule is hard-coded; instructor/scenario orders control.'
    ],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'focused_abdominal',
        label: 'Focused Abdominal',
        category: 'topic_specific'
      },
      {
        id: 'maintain_npo_if_ordered',
        label: 'Maintain Npo If Ordered',
        category: 'topic_specific'
      },
      {
        id: 'review_imaging',
        label: 'Review Imaging',
        category: 'topic_specific'
      },
      {
        id: 'surgical_prep_if_ordered',
        label: 'Surgical Prep If Ordered',
        category: 'topic_specific'
      },
      {
        id: 'recognize_perforation',
        label: 'Recognize Perforation',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'abc_assessment',
      'focused_abdominal',
      'maintain_npo_if_ordered',
      'recognize_perforation',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'Diffuse or rapidly worsening abdominal pain',
      'Rigid/board-like abdomen or generalized guarding',
      'High fever/tachycardia',
      'Hypotension',
      'Increasing WBC/lactate',
      'Sepsis signs',
      'Abscess/perforation on imaging'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: Patient with suspected/confirmed appendicitis has worsening abdominal findings.',
      'B: Pain migrated to RLQ with nausea/anorexia and inflammatory labs/imaging.',
      'A: Report abdominal findings, vitals, WBC/imaging and whether peritoneal signs or shock are developing.',
      'R: Urgent surgical/provider review; continue NPO, IV support, and ordered antibiotics/analgesia.'
    ],
    source_discrepancies: [
      'No school-specific appendicitis document was provided. This scenario is evidence-informed supplemental practice, not an official school rubric.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Recognize the classic and dangerous patterns of appendicitis, perform a focused abdominal assessment, maintain NPO/IV therapy as ordered, prepare for surgical evaluation, and detect rupture/peritonitis.',
      'APPENDIX: Around umbilicus -> Pain to RLQ, Poor appetite, Exam tenderness, Nausea, Danger if diffuse/rigid, Imaging, eXpedite surgical review.',
      'Do not give food/drink if the patient is NPO and may go to surgery.',
      'Do not use heating pads, enemas, or laxatives as self-treatment teaching for suspected appendicitis.',
      'Do not assume antibiotics-only management applies to every patient; patient selection matters.'
    ],
    lesson: {
      testing: 'Recognize the classic and dangerous patterns of appendicitis, perform a focused abdominal assessment, maintain NPO/IV therapy as ordered, prepare for surgical evaluation, and detect rupture/peritonitis.',
      caseStory: 'Generated practice case: an adult reports vague periumbilical pain that migrated to the right lower quadrant with anorexia, nausea, low-grade fever, and focal tenderness. The scenario may later introduce worsening diffuse pain, rigidity, fever, and tachycardia to test recognition of perforation/peritonitis.',
      pathoChain: [
        'Obstruction/inflammation of the appendix causes swelling and rising intraluminal pressure.',
        'Inflammation and reduced blood flow can progress to ischemia and tissue necrosis.',
        'Untreated disease can perforate, spilling infected material into the peritoneum.',
        'Perforation can cause abscess, peritonitis, and sepsis.'
      ],
      redFlags: [
        'Pain often begins near the umbilicus and migrates to the RLQ',
        'Anorexia',
        'Nausea/vomiting',
        'Low-grade fever',
        'Localized tenderness/guarding',
        'Pain may worsen with movement/coughing',
        'Older adults may have less dramatic symptoms'
      ],
      inRoomSequence: [
        'Hand hygiene, identifiers, focused abdominal and systemic assessment.',
        'Characterize pain onset, migration, location, severity, associated anorexia/nausea/vomiting, fever, bowel/urinary symptoms, and pregnancy possibility when clinically relevant.',
        'Inspect, auscultate, then palpate gently per school abdominal-assessment sequence; note localized tenderness/guarding and signs of peritoneal irritation.',
        'Maintain NPO and IV therapy if ordered; review WBC and imaging.',
        'Prepare for surgical evaluation/appendectomy when ordered.',
        'Watch for rupture/peritonitis: sudden change from localized pain to diffuse severe pain, rigid/guarded abdomen, fever, tachycardia, hypotension, worsening illness.',
        'Escalate immediately if perforation/sepsis is suspected.'
      ],
      deteriorationCues: [
        'Diffuse or rapidly worsening abdominal pain',
        'Rigid/board-like abdomen or generalized guarding',
        'High fever/tachycardia',
        'Hypotension',
        'Increasing WBC/lactate',
        'Sepsis signs',
        'Abscess/perforation on imaging'
      ],
      sbarSkeleton: [
        'S: Patient with suspected/confirmed appendicitis has worsening abdominal findings.',
        'B: Pain migrated to RLQ with nausea/anorexia and inflammatory labs/imaging.',
        'A: Report abdominal findings, vitals, WBC/imaging and whether peritoneal signs or shock are developing.',
        'R: Urgent surgical/provider review; continue NPO, IV support, and ordered antibiotics/analgesia.'
      ],
      memoryHook: 'APPENDIX: Around umbilicus -> Pain to RLQ, Poor appetite, Exam tenderness, Nausea, Danger if diffuse/rigid, Imaging, eXpedite surgical review.',
      commonMistakes: [
        'Do not give food/drink if the patient is NPO and may go to surgery.',
        'Do not use heating pads, enemas, or laxatives as self-treatment teaching for suspected appendicitis.',
        'Do not assume antibiotics-only management applies to every patient; patient selection matters.'
      ],
      sourceIssues: [
        'No school-specific appendicitis document was provided. This scenario is evidence-informed supplemental practice, not an official school rubric.'
      ],
      rapidFire: [
        {
          q: 'What classic pain migration should you recognize?',
          a: 'Periumbilical pain migrating to the right lower quadrant.'
        },
        {
          q: 'What complication is the main emergency concern?',
          a: 'Perforation leading to peritonitis/sepsis.'
        },
        {
          q: 'What is the usual surgical treatment?',
          a: 'Appendectomy, commonly laparoscopic when surgery is selected.'
        },
        {
          q: 'Can selected uncomplicated cases be managed without surgery?',
          a: 'Yes, some selected patients may be treated nonoperatively with antibiotics, but this is not universal.'
        },
        {
          q: 'What status is commonly ordered while awaiting surgery?',
          a: 'NPO.'
        }
      ],
      references: [
        {
          label: 'WSES 2025 appendicitis guideline abstract (JAMA Surgery)',
          url: 'https://jamanetwork.com/journals/jamasurgery/article-abstract/2844195'
        },
        {
          label: 'American College of Surgeons Appendectomy',
          url: 'https://www.facs.org/for-patients/the-day-of-your-surgery/appendectomy/'
        }
      ]
    }
  },
  {
    schema_version: '1.0',
    topic_id: 'appendectomy',
    title: 'Appendectomy Postoperative Care - Supplemental Practice Module',
    provenance: 'generated_supplemental_practice',
    source_file: null,
    duration_minutes: 20,
    education_only: true,
    case_intro: 'Generated practice case: an adult returns from laparoscopic appendectomy for uncomplicated appendicitis. The student must complete a focused postoperative assessment, control pain/nausea per orders, assess incisions and bowel function, promote safe mobility/pulmonary hygiene, and identify complications such as bleeding, infection, ileus, abscess, or peritonitis.',
    initial_findings: [
      'Post-anesthesia drowsiness improving over time',
      'Incisional pain/tenderness',
      'Small laparoscopic incisions or an RLQ open incision',
      'Possible nausea',
      'Bowel sounds/flatus may be reduced early',
      'Need for progressive ambulation and pulmonary hygiene'
    ],
    vital_trends: [
      {
        time: 'Practice PACU/floor return',
        bp: '132/76',
        hr: '96',
        rr: '18',
        spo2: '96%',
        temp: '99.1 F'
      },
      {
        time: 'Stable reassessment',
        bp: '126/72',
        hr: '86',
        rr: '16',
        spo2: '97%',
        temp: '98.9 F'
      }
    ],
    labs: [
      {
        test: 'WBC',
        result: '12.0',
        interpretation: 'Practice value, trending down'
      },
      {
        test: 'Hgb',
        result: '13.1',
        interpretation: 'Practice value'
      }
    ],
    diagnostics: [
      'No routine diagnostic test is required in the uncomplicated practice branch; new severe symptoms trigger provider evaluation.'
    ],
    orders: [
      'Practice-only example orders: postoperative vitals, pain/nausea medications, IV fluids, diet advancement as ordered, ambulation, pulmonary hygiene, wound care, DVT prophylaxis if ordered, antibiotics depending on uncomplicated vs complicated disease.'
    ],
    mar: [
      'Medication choice/timing is scenario-specific and should come from the active MAR.'
    ],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'postop_abcs',
        label: 'Postop Abcs',
        category: 'topic_specific'
      },
      {
        id: 'assess_incision_drain',
        label: 'Assess Incision Drain',
        category: 'topic_specific'
      },
      {
        id: 'pain_nausea_reassessment',
        label: 'Pain Nausea Reassessment',
        category: 'topic_specific'
      },
      {
        id: 'pulmonary_hygiene',
        label: 'Pulmonary Hygiene',
        category: 'topic_specific'
      },
      {
        id: 'ambulation',
        label: 'Ambulation',
        category: 'topic_specific'
      },
      {
        id: 'bowel_recovery',
        label: 'Bowel Recovery',
        category: 'topic_specific'
      },
      {
        id: 'discharge_teaching',
        label: 'Discharge Teaching',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'postop_abcs',
      'assess_incision_drain',
      'pain_nausea_reassessment',
      'ambulation',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'Increasing abdominal pain rather than gradual improvement',
      'Fever/chills',
      'Purulent or increasing wound drainage',
      'Rigid/distended abdomen',
      'Persistent vomiting/no bowel function with worsening distention',
      'Tachycardia/hypotension',
      'Shortness of breath/chest pain',
      'Calf swelling/pain'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: Post-appendectomy patient has a new concerning postoperative finding.',
      'B: State whether appendicitis was uncomplicated/perforated, surgical approach, time since surgery, and current orders.',
      'A: Report vitals, pain, abdomen, incision/drain, bowel function, oxygenation, and relevant labs.',
      'R: Request evaluation/intervention for suspected bleeding, infection, ileus/obstruction, abscess, or cardiopulmonary complication.'
    ],
    source_discrepancies: [
      'No school-specific appendectomy document was provided. Exact postoperative orders, diet progression, wound-care steps, and discharge criteria must be instructor-configurable.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Practice immediate postoperative priorities after appendectomy: airway/breathing, pain, incision/drain assessment, infection/bleeding surveillance, mobility, pulmonary hygiene, bowel recovery, and discharge teaching.',
      'POST-APP: Pulmonary/ABCs, Observe incision, Symptoms/pain, Track bowel/urine, Ambulate, Prevent DVT/atelectasis, Patient teaching.',
      'Do not skip the immediate postoperative ABC assessment because the surgery was "routine."',
      'Do not advance diet or remove drains/dressings outside the active order/protocol.',
      'Do not normalize worsening pain, fever, rigid abdomen, or persistent vomiting.'
    ],
    lesson: {
      testing: 'Practice immediate postoperative priorities after appendectomy: airway/breathing, pain, incision/drain assessment, infection/bleeding surveillance, mobility, pulmonary hygiene, bowel recovery, and discharge teaching.',
      caseStory: 'Generated practice case: an adult returns from laparoscopic appendectomy for uncomplicated appendicitis. The student must complete a focused postoperative assessment, control pain/nausea per orders, assess incisions and bowel function, promote safe mobility/pulmonary hygiene, and identify complications such as bleeding, infection, ileus, abscess, or peritonitis.',
      pathoChain: [
        'Appendectomy removes the inflamed appendix; surgery may be laparoscopic or open.',
        'Postoperative priorities initially center on airway, breathing, circulation, pain, and surgical-site status.',
        'Immobility/anesthesia increase pulmonary and thromboembolic risk; abdominal surgery can temporarily slow bowel motility.',
        'Perforated appendicitis carries higher risk for abscess/infection and may involve a drain.'
      ],
      redFlags: [
        'Post-anesthesia drowsiness improving over time',
        'Incisional pain/tenderness',
        'Small laparoscopic incisions or an RLQ open incision',
        'Possible nausea',
        'Bowel sounds/flatus may be reduced early',
        'Need for progressive ambulation and pulmonary hygiene'
      ],
      inRoomSequence: [
        'Receive handoff; verify procedure, anesthesia, allergies, code status, IVs/drains, last medications, and complications.',
        'ABCs first: airway patency, RR/work of breathing, SpO2, circulation, level of consciousness.',
        'Assess pain and nausea, then surgical sites/dressing/drain for bleeding, drainage, redness, swelling, or dehiscence.',
        'Assess abdomen for distention/tenderness and track bowel sounds/flatus per school expectations.',
        'Administer ordered pain/antiemetic/IV therapy and reassess.',
        'Promote early safe ambulation and deep breathing/incentive-spirometry practice if ordered/appropriate; use DVT prevention measures per orders.',
        'Advance diet only as ordered and as tolerated; monitor voiding and bowel recovery.',
        'Teach wound care, activity limits, medication instructions, and warning signs before discharge.'
      ],
      deteriorationCues: [
        'Increasing abdominal pain rather than gradual improvement',
        'Fever/chills',
        'Purulent or increasing wound drainage',
        'Rigid/distended abdomen',
        'Persistent vomiting/no bowel function with worsening distention',
        'Tachycardia/hypotension',
        'Shortness of breath/chest pain',
        'Calf swelling/pain'
      ],
      sbarSkeleton: [
        'S: Post-appendectomy patient has a new concerning postoperative finding.',
        'B: State whether appendicitis was uncomplicated/perforated, surgical approach, time since surgery, and current orders.',
        'A: Report vitals, pain, abdomen, incision/drain, bowel function, oxygenation, and relevant labs.',
        'R: Request evaluation/intervention for suspected bleeding, infection, ileus/obstruction, abscess, or cardiopulmonary complication.'
      ],
      memoryHook: 'POST-APP: Pulmonary/ABCs, Observe incision, Symptoms/pain, Track bowel/urine, Ambulate, Prevent DVT/atelectasis, Patient teaching.',
      commonMistakes: [
        'Do not skip the immediate postoperative ABC assessment because the surgery was "routine."',
        'Do not advance diet or remove drains/dressings outside the active order/protocol.',
        'Do not normalize worsening pain, fever, rigid abdomen, or persistent vomiting.'
      ],
      sourceIssues: [
        'No school-specific appendectomy document was provided. Exact postoperative orders, diet progression, wound-care steps, and discharge criteria must be instructor-configurable.'
      ],
      rapidFire: [
        {
          q: 'What comes first when the patient returns from surgery?',
          a: 'Airway, breathing, circulation, and level of consciousness.'
        },
        {
          q: 'What pulmonary complication are mobility/deep breathing meant to help prevent?',
          a: 'Postoperative pulmonary complications such as atelectasis/pneumonia.'
        },
        {
          q: 'What abdominal findings are concerning?',
          a: 'Worsening pain, rigidity/distention, persistent vomiting, or failure of bowel recovery with deterioration.'
        },
        {
          q: 'What wound findings need escalation?',
          a: 'Increasing redness, swelling, purulent drainage, dehiscence, or significant bleeding.'
        },
        {
          q: 'Are all appendectomy patients managed identically?',
          a: 'No. Laparoscopic vs open and uncomplicated vs perforated disease can change orders and recovery.'
        }
      ],
      references: [
        {
          label: 'American College of Surgeons Appendectomy',
          url: 'https://www.facs.org/for-patients/the-day-of-your-surgery/appendectomy/'
        },
        {
          label: 'MedlinePlus Appendectomy overview',
          url: 'https://medlineplus.gov/ency/article/002921.htm'
        }
      ]
    }
  },
  {
    schema_version: '1.0',
    topic_id: 'bowel_obstruction',
    title: 'Bowel Obstruction - Supplemental Practice Module',
    provenance: 'generated_supplemental_practice',
    source_file: null,
    duration_minutes: 20,
    education_only: true,
    case_intro: 'Generated practice case: an older adult with prior abdominal surgery develops crampy abdominal pain, distention, repeated vomiting, constipation, and inability to pass flatus. CT shows a small-bowel obstruction with a transition point. The student must decompress/support the patient and identify signs of ischemia or perforation.',
    initial_findings: [
      'Crampy/colicky abdominal pain',
      'Abdominal distention',
      'Nausea/vomiting',
      'Constipation/obstipation and inability to pass flatus',
      'High-pitched/tinkling bowel sounds may occur early; bowel sounds can decrease later',
      'Dehydration/tachycardia',
      'Prior abdominal surgery raises concern for adhesions'
    ],
    vital_trends: [
      {
        time: 'Practice baseline',
        bp: '112/70',
        hr: '108',
        rr: '22',
        spo2: '96%',
        temp: '99.5 F'
      },
      {
        time: 'Ischemia branch',
        bp: '94/58',
        hr: '124',
        rr: '28',
        spo2: '94%',
        temp: '102.0 F'
      }
    ],
    labs: [
      {
        test: 'BUN',
        result: '34',
        interpretation: 'Practice value: high'
      },
      {
        test: 'Creatinine',
        result: '1.5',
        interpretation: 'Practice value: high'
      },
      {
        test: 'Potassium',
        result: '3.2',
        interpretation: 'Practice value: low after vomiting'
      },
      {
        test: 'Lactate',
        result: '1.7 -> 4.1',
        interpretation: 'Rising value in ischemia branch'
      },
      {
        test: 'WBC',
        result: '12.8 -> 18.5',
        interpretation: 'Rising in complication branch'
      }
    ],
    diagnostics: [
      'Practice CT: dilated small-bowel loops with a transition point consistent with SBO.',
      'Concerning imaging signs or peritonitis/ischemia should trigger urgent surgical evaluation.'
    ],
    orders: [
      'Practice-only example orders: NPO, NG tube to ordered suction for decompression, isotonic IV fluids, electrolyte replacement, strict I&O, antiemetic/analgesia, serial abdominal exams, surgical consult. Exact orders must be scenario/instructor-defined.'
    ],
    mar: ['No universal medication schedule is hard-coded.'],
    allowed_action_intents: [
      {
        id: 'hand_hygiene',
        label: 'Perform hand hygiene / standard precautions',
        category: 'safety'
      },
      {
        id: 'verify_identity',
        label: 'Use two patient identifiers',
        category: 'safety'
      },
      {
        id: 'abc_assessment',
        label: 'Perform immediate ABC assessment',
        category: 'assessment'
      },
      {
        id: 'focused_assessment',
        label: 'Perform condition-specific focused assessment',
        category: 'assessment'
      },
      {
        id: 'review_trends',
        label: 'Compare current data with prior trends',
        category: 'clinical_reasoning'
      },
      {
        id: 'implement_orders',
        label: 'Implement/verify active provider orders',
        category: 'intervention'
      },
      {
        id: 'reassess',
        label: 'Reassess response after interventions',
        category: 'reassessment'
      },
      {
        id: 'sbar',
        label: 'Communicate deterioration using SBAR',
        category: 'communication'
      },
      {
        id: 'document',
        label: 'Document assessment, interventions, and response',
        category: 'documentation'
      },
      {
        id: 'focused_abdominal',
        label: 'Focused Abdominal',
        category: 'topic_specific'
      },
      {
        id: 'maintain_npo_if_ordered',
        label: 'Maintain Npo If Ordered',
        category: 'topic_specific'
      },
      {
        id: 'ng_decompression_if_ordered',
        label: 'Ng Decompression If Ordered',
        category: 'topic_specific'
      },
      {
        id: 'strict_io',
        label: 'Strict Io',
        category: 'topic_specific'
      },
      {
        id: 'electrolytes',
        label: 'Electrolytes',
        category: 'topic_specific'
      },
      {
        id: 'recognize_ischemia_perforation',
        label: 'Recognize Ischemia Perforation',
        category: 'topic_specific'
      }
    ],
    critical_actions: [
      'abc_assessment',
      'focused_abdominal',
      'maintain_npo_if_ordered',
      'ng_decompression_if_ordered',
      'recognize_ischemia_perforation',
      'sbar'
    ],
    deterioration_triggers: [
      {
        trigger: 'two_critical_actions_missed_or_excessive_delay',
        effect: 'advance_to_deteriorating_state'
      },
      {
        trigger: 'unsafe_action',
        effect: 'apply_safety_penalty_and_patient_may_worsen'
      },
      {
        trigger: 'appropriate_escalation_after_deterioration',
        effect: 'stabilize_or_end_for_handoff'
      }
    ],
    deterioration_cues: [
      'Pain becomes continuous/severe',
      'Peritoneal signs/rigidity',
      'Fever and marked tachycardia',
      'Hypotension/shock',
      'Rising lactate/metabolic acidosis',
      'Worsening leukocytosis',
      'Bloody stool',
      'Decreased urine output/AKI',
      'Respiratory compromise from aspiration/distention'
    ],
    scoring: {
      safety: 30,
      assessment_recognition: 25,
      prioritization_interventions: 25,
      communication: 10,
      reassessment_documentation_education: 10
    },
    sbar_expected: [
      'S: Patient with SBO has worsening abdominal/perfusion findings.',
      'B: Prior abdominal surgery and CT-confirmed obstruction; NPO/NG/IV therapy in progress if ordered.',
      'A: Report pain pattern, abdomen, bowel sounds, vomiting/NG output, vitals, urine output, electrolytes, WBC/lactate, and CT findings.',
      'R: Urgent surgical/provider evaluation for possible strangulation/ischemia/perforation and continuation of decompression/resuscitation.'
    ],
    source_discrepancies: [
      'No school-specific bowel-obstruction document was provided. This module uses general evidence-informed SBO management and must be adapted to the instructor\'s exact checklist.'
    ],
    exam_mode_rules: [
      'Do not give hints unless the learner explicitly opens a hint or the instructor configured hints.',
      'Reveal physical findings only when the learner performs the corresponding assessment.',
      'Reveal patient-history details only when asked or when they are part of the opening handoff.',
      'Never create a medication, lab result, or provider order that is not in this scenario object.',
      'Do not score a source-discrepancy item as correct/incorrect until an instructor override resolves it.'
    ],
    debrief_points: [
      'Recognize mechanical bowel obstruction, assess dehydration/aspiration/ischemia risk, implement NPO/NG decompression/IV-fluid orders, monitor electrolytes and output, and detect strangulation/perforation requiring urgent surgery.',
      'BLOCK: Belly distends, Lack of stool/flatus, Output/vomit, Crampy pain, Keep NPO/decompress; continuous pain + shock = complication.',
      'Do not give oral intake during an active obstruction unless specifically cleared.',
      'Do not treat an NG tube as automatically indicated without an order/protocol in exam mode.',
      'Do not be reassured if bowel sounds become quiet while the patient otherwise worsens.'
    ],
    lesson: {
      testing: 'Recognize mechanical bowel obstruction, assess dehydration/aspiration/ischemia risk, implement NPO/NG decompression/IV-fluid orders, monitor electrolytes and output, and detect strangulation/perforation requiring urgent surgery.',
      caseStory: 'Generated practice case: an older adult with prior abdominal surgery develops crampy abdominal pain, distention, repeated vomiting, constipation, and inability to pass flatus. CT shows a small-bowel obstruction with a transition point. The student must decompress/support the patient and identify signs of ischemia or perforation.',
      pathoChain: [
        'A mechanical blockage prevents normal passage of intestinal contents.',
        'Proximal bowel fills with fluid and gas, causing distention, pain, vomiting, and third-spacing.',
        'Vomiting and sequestration lead to dehydration, electrolyte abnormalities, and kidney injury.',
        'Strangulation compromises bowel blood flow and can progress to ischemia, necrosis, perforation, peritonitis, sepsis, and shock.'
      ],
      redFlags: [
        'Crampy/colicky abdominal pain',
        'Abdominal distention',
        'Nausea/vomiting',
        'Constipation/obstipation and inability to pass flatus',
        'High-pitched/tinkling bowel sounds may occur early; bowel sounds can decrease later',
        'Dehydration/tachycardia',
        'Prior abdominal surgery raises concern for adhesions'
      ],
      inRoomSequence: [
        'Hand hygiene, identifiers, ABCs, aspiration risk, pain, hydration/perfusion assessment.',
        'Focused abdominal assessment: distention, tenderness/guarding, bowel sounds, vomiting, last BM/flatus, previous abdominal surgery/hernias.',
        'Keep NPO per order and verify IV access/fluids.',
        'Insert/maintain NG decompression only if ordered and using the school\'s tube-placement/verification policy; record output amount/color.',
        'Track strict I&O, urine output, electrolytes, BUN/creatinine, and serial abdominal findings.',
        'Review CT/diagnostic results and response to decompression.',
        'Escalate immediately for continuous severe pain (rather than intermittent cramping), peritoneal signs, fever, tachycardia, hypotension, rising lactate, or other evidence of ischemia/perforation.'
      ],
      deteriorationCues: [
        'Pain becomes continuous/severe',
        'Peritoneal signs/rigidity',
        'Fever and marked tachycardia',
        'Hypotension/shock',
        'Rising lactate/metabolic acidosis',
        'Worsening leukocytosis',
        'Bloody stool',
        'Decreased urine output/AKI',
        'Respiratory compromise from aspiration/distention'
      ],
      sbarSkeleton: [
        'S: Patient with SBO has worsening abdominal/perfusion findings.',
        'B: Prior abdominal surgery and CT-confirmed obstruction; NPO/NG/IV therapy in progress if ordered.',
        'A: Report pain pattern, abdomen, bowel sounds, vomiting/NG output, vitals, urine output, electrolytes, WBC/lactate, and CT findings.',
        'R: Urgent surgical/provider evaluation for possible strangulation/ischemia/perforation and continuation of decompression/resuscitation.'
      ],
      memoryHook: 'BLOCK: Belly distends, Lack of stool/flatus, Output/vomit, Crampy pain, Keep NPO/decompress; continuous pain + shock = complication.',
      commonMistakes: [
        'Do not give oral intake during an active obstruction unless specifically cleared.',
        'Do not treat an NG tube as automatically indicated without an order/protocol in exam mode.',
        'Do not be reassured if bowel sounds become quiet while the patient otherwise worsens.'
      ],
      sourceIssues: [
        'No school-specific bowel-obstruction document was provided. This module uses general evidence-informed SBO management and must be adapted to the instructor\'s exact checklist.'
      ],
      rapidFire: [
        {
          q: 'What is the classic elimination clue?',
          a: 'Inability to pass flatus/stool, especially with distention and vomiting.'
        },
        {
          q: 'What is the basic conservative-management triad in an ordered SBO plan?',
          a: 'NPO, decompression, and IV fluids/electrolyte support.'
        },
        {
          q: 'What pain change is worrisome for ischemia?',
          a: 'Intermittent cramping becoming continuous severe pain.'
        },
        {
          q: 'Why monitor urine output?',
          a: 'It helps assess dehydration/perfusion and kidney function.'
        },
        {
          q: 'What complication requires urgent surgery?',
          a: 'Peritonitis, strangulation, bowel ischemia, or perforation.'
        }
      ],
      references: [
        {
          label: 'WSES Bologna ASBO Guideline',
          url: 'https://link.springer.com/article/10.1186/s13017-018-0185-2'
        },
        {
          label: 'EAST Small-Bowel Obstruction Guideline',
          url: 'https://www.east.org/education-resources/practice-management-guidelines/details/smallbowel-obstruction-evaluation-and-management-of'
        },
        {
          label: 'MedlinePlus Intestinal Obstruction',
          url: 'https://medlineplus.gov/intestinalobstruction.html'
        }
      ]
    }
  }
];
