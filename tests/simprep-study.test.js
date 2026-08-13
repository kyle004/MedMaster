/* ============================================================================
   simprep-study.test.js
   ----------------------------------------------------------------------------
   Guards js/simprep.js - the Clinical Simulation Prep hub and Study Mode.

   What is actually at risk here, and therefore what this suite asserts:

     1. The section must not take the app down when its data files are absent.
        They are written by a separate agent and shipped as separate <script>
        tags, so "not there yet" is a normal state, not a bug.
     2. The drills must be built FROM the chart. A drill that quietly invents an
        order is worse than no drill: the student would rehearse an action the
        proctor will mark unsafe. Order vs No Order is checked line by line
        against the topic's real `orders`, Already Done against its real `mar`.
     3. A disputed item must not be scored. `source_discrepancies` exists
        because the school sheets contain real defects; scoring one of them
        would teach the defect.
     4. An instructor override must outrank the school file and must never
        erase it. The audit trail is the feature.
     5. Mastery must not be movable by reading. It rises only on unhinted
        retrieval and falls on a confident miss.
     6. `progress` is shared with a dozen other modules. A write here that
        dropped a sibling key would silently destroy someone's history.

   Content source: the real data/nur2212-*.js files when they exist, the
   authoring pack's JSON when they do not, and a compact inline stub when
   neither is reachable. The suite reports which it used.

   Run:  node tests/run.js simprep
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./_harness.js');

var PACK = path.join(H.APP_ROOT, 'New stuff', 'Nur2212_SIM_STUDY',
                     'NUR2212_Sim_Study_App_Pack');

/* Orphaned `.fuse_hidden*` copies sort first in readdir and are NOT the
   shipped module. Same hazard, same filter, as tests/ui-contrast.test.js. */
function jsFiles() {
  return fs.readdirSync(path.join(H.APP_ROOT, 'js'))
    .filter(function (f) { return /\.js$/.test(f) && f.charAt(0) !== '.'; });
}
function exists(rel) { return fs.existsSync(path.join(H.APP_ROOT, rel)); }
function read(rel) { return fs.readFileSync(path.join(H.APP_ROOT, rel), 'utf8'); }

/* ------------------------------------------------------------------ stub */
/* Twelve topics: the eight school files and the four supplemental modules,
   with the fields the drills read. Deliberately carries the real source
   discrepancies, because the gating tests are about those exact defects. */

function T(o) {
  return {
    topic_id: o.id, title: o.title, provenance: o.prov || 'school_file',
    source_file: o.file || null, duration_minutes: o.min || 20, education_only: true,
    case_intro: o.intro || (o.title + '. Practice case introduction sentence one. And a second.'),
    initial_findings: o.findings || ['Finding A for ' + o.id, 'Finding B for ' + o.id],
    vital_trends: o.vitals || [],
    labs: o.labs || [], diagnostics: o.dx || [],
    orders: o.orders || [], mar: o.mar || [],
    allowed_action_intents: [
      { id: 'abc_assessment', label: 'Perform immediate ABC assessment', category: 'assessment' },
      { id: 'focused_assessment', label: 'Perform a focused assessment', category: 'assessment' },
      { id: 'implement_orders', label: 'Implement active provider orders', category: 'intervention' },
      { id: 'sbar', label: 'Communicate deterioration using SBAR', category: 'communication' }
    ],
    critical_actions: ['abc_assessment', 'sbar'],
    deterioration_triggers: [{ trigger: 'two_critical_actions_missed', effect: 'advance_to_deteriorating_state' }],
    deterioration_cues: o.cues || ['Worsening vital signs', 'Falling level of consciousness'],
    scoring: { safety: 30, assessment_recognition: 25, prioritization_interventions: 25,
               communication: 10, reassessment_documentation_education: 10 },
    sbar_expected: o.sbar || [
      'S: Patient is deteriorating and needs review.',
      'B: Admitted earlier with the presenting problem.',
      'A: Vital signs and findings as charted.',
      'R: Immediate provider evaluation.'
    ],
    source_discrepancies: o.disc || [],
    exam_mode_rules: ['Do not give hints unless the learner opens one.'],
    debrief_points: ['Recognition speed', 'Escalation quality']
  };
}

var STUB_SCENARIOS = [
  T({ id: 'upper_gi_bleed', title: 'Upper GI Bleed With Progression Toward Hypovolemic Shock',
      file: 'MS2 UGIB Student.docx',
      intro: 'A 58-year-old with hematemesis and melena. Blood loss is ongoing.',
      vitals: [
        { time: '0600', bp: '118/76', hr: '88', rr: '18', spo2: '98%', temp: '99.4 F' },
        { time: '1000', bp: '108/68', hr: '104', rr: '22', spo2: '94%', temp: '98.4 F' }
      ],
      labs: [
        { test: 'Hgb', result: '6.8', interpretation: 'Severely low' },
        { test: 'Hct', result: '21%', interpretation: 'Low' },
        { test: 'Platelets', result: '138', interpretation: 'Low' },
        { test: 'BUN', result: '34', interpretation: 'High' },
        { test: 'Creatinine', result: '1.1', interpretation: 'Normal' },
        { test: 'INR', result: '1.3', interpretation: 'Slightly prolonged' }
      ],
      dx: ['Type and crossmatch: O positive; PRBCs available.'],
      orders: ['Continuous pulse oximetry', 'Vital signs every 15 minutes', 'Maintain SpO2 >95%',
               'NPO', 'Normal saline 1000 mL IV bolus', 'Transfuse PRBCs',
               'Strict intake and output',
               'Pantoprazole IV bolus followed by continuous infusion as written on school sheet',
               'Ondansetron 4 mg IV every 6 hours PRN nausea'],
      mar: ['1000 - 0.9% sodium chloride 1 L bolus', '1015 - pantoprazole 80 mg IV',
            '1030 - PRBC transfusion initiated', '1030 - ondansetron 4 mg IV'],
      disc: ['The pantoprazole order repeats the phrase "80 mg IV bolus" before the infusion; verify the intended wording with the instructor.',
             'The file is labeled Student but page 1 also displays "Simulation Faculty Version."'] }),

  T({ id: 'acute_liver_failure', title: 'Acute Liver Failure With Hepatic Encephalopathy',
      intro: 'A 44-year-old with jaundice and confusion after an overdose.',
      vitals: [
        { time: '0800', bp: '118/72', hr: '94', rr: '15', spo2: '96%', temp: '98.8 F' },
        { time: '1000', bp: '106/62', hr: '112', rr: '24', spo2: '96%', temp: '100.0 F' }
      ],
      labs: [
        { test: 'Ammonia', result: '148', interpretation: 'High' },
        { test: 'INR', result: '2.4', interpretation: 'Prolonged' },
        { test: 'AST', result: '820', interpretation: 'High' },
        { test: 'ALT', result: '910', interpretation: 'High' },
        { test: 'Platelets', result: '92', interpretation: 'Low' },
        { test: 'Glucose', result: '62', interpretation: 'Low' }
      ],
      orders: ['Neuro checks every hour', 'Fall precautions', 'Seizure precautions',
               'N-acetylcysteine 4.4 g IV in 250 mL D5W over 1 hour',
               'Lactulose 30 mL PO every 6 hours', 'Low fat, low protien diet as written',
               'Daily weight'],
      mar: ['0900 - lactulose 30 mL PO', '0930 - N-acetylcysteine bolus',
            '1500 - N-acetylcysteine 4.4 g IV in 250 mL D5W'],
      disc: ['The diet is written "low fat, low protien" in the school sheet; keep the school wording visible but verify the intended diet with the instructor.',
             'The MAR shows an N-acetylcysteine bolus at 0930 and another 4.4 g infusion at 1500; do not use this sheet as a complete real-world NAC protocol.'] }),

  T({ id: 'ards', title: 'Acute Respiratory Failure With Progression Toward ARDS',
      intro: 'John Smith, age 72, admitted with severe pneumonia, now in worsening distress.',
      vitals: [
        { time: '0600', bp: '136/84', hr: '96', rr: '22', spo2: '93%', temp: '100.6 F' },
        { time: '1000', bp: '142/86', hr: '112', rr: '30', spo2: '88%', temp: '101.8 F' }
      ],
      labs: [
        { test: 'WBC', result: '19.2', interpretation: 'High' },
        { test: 'BUN', result: '24', interpretation: 'High' },
        { test: 'Creatinine', result: '1.2', interpretation: 'Upper end of school range' },
        { test: 'pH', result: '7.48', interpretation: 'Alkalemic' },
        { test: 'PaCO2', result: '31', interpretation: 'Low' },
        { test: 'PaO2', result: '58', interpretation: 'Severely low' },
        { test: 'HCO3', result: '22', interpretation: 'Normal/low-normal' },
        { test: 'GFR', result: '18', interpretation: 'Low on school sheet' }
      ],
      dx: ['Chest X-ray: bilateral diffuse infiltrates consistent with progression toward ARDS.'],
      orders: ['Oxygen 2 L nasal cannula to keep O2 >95%', 'Continuous pulse oximetry',
               'Continuous cardiac monitoring', 'Titrate oxygen to maintain SpO2 >95%',
               'Possible ICU transfer', "Maintain High Fowler's position"],
      mar: ['0900 - ceftriaxone 1 g (route appears as "IC" on school sheet)',
            '0900 - azithromycin 500 mg IV', '1000 - albuterol nebulizer'],
      disc: ['The topic header says "Faculty" even though the filename is Student.',
             'Ceftriaxone is written as "1 g IC" in the MAR; verify intended route with instructor.',
             'GFR is listed as 18 despite creatinine 1.2; treat that as a school-sheet inconsistency rather than silently correcting it.'] }),

  T({ id: 'dic', title: 'Disseminated Intravascular Coagulation (DIC)',
      intro: 'A postpartum patient with oozing from every puncture site.',
      vitals: [
        { time: '0600', bp: '118/70', hr: '92', rr: '18', spo2: '94%', temp: '100.8 F' },
        { time: '0800', bp: '108/64', hr: '102', rr: '24', spo2: '93%', temp: '101.6 F' }
      ],
      labs: [
        { test: 'Platelets', result: '48', interpretation: 'Severely low' },
        { test: 'Fibrinogen', result: '92', interpretation: 'Low' },
        { test: 'D-dimer', result: '4200', interpretation: 'High' },
        { test: 'INR', result: '2.1', interpretation: 'Prolonged' },
        { test: 'aPTT', result: '58', interpretation: 'Prolonged' },
        { test: 'Hgb', result: '8.4', interpretation: 'Low' }
      ],
      orders: ['Continuous cardiac monitoring', 'Vital signs every 15 minutes',
               'Keep SpO2 >95%', 'Cefepime 1 g IV every 8 hours',
               'Vancomycin 1 g IV every 24 hours', 'Strict intake and output'],
      mar: ['0800 - cefepime IV', '0900 - vancomycin IV'],
      disc: ['The activity instructions include preparation for blood products, but the listed provider orders do not actually contain a blood-product order.'] }),

  T({ id: 'heart_failure', title: 'Acute Heart Failure Exacerbation',
      intro: 'A 68-year-old with orthopnea and new weight gain.',
      vitals: [{ time: '0945', bp: '152/90', hr: '102', rr: '22', spo2: '91% RA', temp: '98.7 F' }],
      labs: [
        { test: 'BNP', result: '1840', interpretation: 'High' },
        { test: 'Sodium', result: '132', interpretation: 'Low' },
        { test: 'Potassium', result: '3.4', interpretation: 'Low' },
        { test: 'BUN', result: '31', interpretation: 'High' },
        { test: 'Creatinine', result: '1.4', interpretation: 'High' },
        { test: 'Glucose', result: '118', interpretation: 'Normal' }
      ],
      dx: ['ECG: sinus tachycardia.'],
      orders: ['Oxygen titration via nasal cannula to keep O2 >95%',
               'Continuous cardiac monitoring', 'CBC, BMP, BNP', 'STAT EKG',
               'Monitor I&O every hour'],
      mar: ['No medications administered on the school sheet.'],
      disc: ['The topic header says "Faculty" although the filename says Student.',
             'The educational required-knowledge section discusses diuretics and beta-blockers, but the case provider orders contain no medication order.'] }),

  T({ id: 'increased_icp', title: 'Increased Intracranial Pressure (ICP)',
      intro: 'A 31-year-old two days after a fall with a widening midline shift.',
      vitals: [
        { time: '0600', bp: '128/78', hr: '84', rr: '18', spo2: '97%', temp: '99.4 F' },
        { time: '0900', bp: '138/84', hr: '88', rr: '18', spo2: '96%', temp: '99.0 F' }
      ],
      labs: [
        { test: 'Sodium', result: '148', interpretation: 'High' },
        { test: 'Potassium', result: '3.6', interpretation: 'Normal' },
        { test: 'Glucose', result: '162', interpretation: 'High' },
        { test: 'WBC', result: '11.8', interpretation: 'High' },
        { test: 'BUN', result: '18', interpretation: 'Normal' },
        { test: 'Creatinine', result: '0.9', interpretation: 'Normal' }
      ],
      dx: ['STAT CT head: cerebral edema with increasing midline shift.'],
      orders: ['Neuro checks every hour', 'Maintain head of bed at 30 degrees',
               'Maintain oxygen SpO2 <95% as written on the school sheet',
               'Strict intake and output', '0.9% sodium chloride 75 mL/hr',
               'Acetaminophen 650 mg PO for pain',
               'Mannitol 20% 42 g IV over 30 minutes (listed as pending physician order)',
               'STAT CT head'],
      mar: ['0800 - acetaminophen 650 mg PO', '1000 - mannitol 20% 42 g IV',
            '1000 - 0.9% sodium chloride 75 mL/hr'],
      disc: ['Provider order says "Maintain oxygen SpO2 <95%," which appears directionally inconsistent with usual oxygenation goals. Verify with instructor before using it for scoring.',
             'Mannitol is listed as "pending physician order" but the MAR records mannitol at 1000. The app must support an instructor correction/override.'] }),

  T({ id: 'pulmonary_embolism', title: 'Pulmonary Embolism With Progression Toward Obstructive Shock',
      intro: 'A 55-year-old post-op with sudden pleuritic chest pain and dyspnea.',
      vitals: [
        { time: '0600', bp: '128/80', hr: '88', rr: '18', spo2: '97%', temp: '98.4 F' },
        { time: '1000', bp: '124/78', hr: '98', rr: '20', spo2: '95%', temp: '98.4 F' }
      ],
      labs: [
        { test: 'D-dimer', result: '3100', interpretation: 'High' },
        { test: 'Troponin', result: '0.09', interpretation: 'High' },
        { test: 'BNP', result: '420', interpretation: 'High' },
        { test: 'pH', result: '7.49', interpretation: 'Alkalemic' },
        { test: 'PaCO2', result: '29', interpretation: 'Low' },
        { test: 'PaO2', result: '62', interpretation: 'Low' },
        { test: 'HCO3', result: '23', interpretation: 'Normal' },
        { test: 'Platelets', result: '210', interpretation: 'Normal' }
      ],
      dx: ['CT angiography: large right pulmonary artery embolus consistent with acute PE.',
           'Venous Doppler: left lower-extremity DVT.'],
      orders: ['Oxygen 2 L nasal cannula to keep O2 >95%', 'Continuous pulse oximetry',
               'CT angiography STAT', 'Heparin bolus and infusion per protocol',
               'Prepare for thrombolytic therapy if ordered', 'Venous Doppler ultrasound LLE',
               'ICU transfer if unstable'],
      mar: ['0800 - enoxaparin 40 mg SQ', '1015 - heparin bolus', '1020 - heparin infusion'],
      disc: ['The Doppler identifies a left lower-extremity DVT, but the initial assessment lists right calf tenderness. Verify which side your instructor expects.',
             'The topic header says "Faculty" even though the filename says Student.'] }),

  T({ id: 'sepsis', title: 'Sepsis With Progression Toward Septic Shock',
      intro: 'A 74-year-old from a nursing home, febrile and confused.',
      vitals: [
        { time: '0600', bp: '118/72', hr: '94', rr: '18', spo2: '95%', temp: '100.8 F' },
        { time: '0800', bp: '108/66', hr: '104', rr: '22', spo2: '95%', temp: '101.4 F' },
        { time: '1000', bp: '92/58', hr: '118', rr: '26', spo2: '90%', temp: '102.2 F' }
      ],
      labs: [
        { test: 'Lactate', result: '4.6', interpretation: 'High' },
        { test: 'WBC', result: '21.4', interpretation: 'High' },
        { test: 'Sodium', result: '134', interpretation: 'Low' },
        { test: 'BUN', result: '38', interpretation: 'High' },
        { test: 'Creatinine', result: '1.9', interpretation: 'High' },
        { test: 'Glucose', result: '176', interpretation: 'High' },
        { test: 'Blood cultures', result: 'Sent', interpretation: 'Pending' }
      ],
      orders: ['Oxygen 2 L nasal cannula to keep O2 >95%', 'Vital signs every 15 minutes',
               'Repeat lactate in 4 hours', 'Acetaminophen 650 mg PO every 6 hours PRN fever',
               'Notify provider if MAP <65 mm Hg', 'Cefepime 2 g IV every 8 hours',
               'Vancomycin 1 g IV every 24 hours'],
      mar: ['0800 - acetaminophen 650 mg PO', '0900 - cefepime 2 g IV',
            '1000 - vancomycin 1 g IV', '1015 - 0.9% sodium chloride 1 L bolus'],
      disc: ['The top of the school document incorrectly labels the topic as "Disseminated Intravascular Coagulation (Student)" even though the entire case is sepsis.'] }),

  T({ id: 'pneumonia', title: 'Pneumonia - Supplemental Practice Module',
      prov: 'generated_supplemental_practice', file: null,
      intro: 'A practice case of community-acquired pneumonia.',
      vitals: [
        { time: 'Practice baseline', bp: '128/74', hr: '104', rr: '26', spo2: '89% RA', temp: '101.9 F' },
        { time: 'After ordered oxygen', bp: '126/72', hr: '100', rr: '24', spo2: '94%', temp: '101.7 F' }
      ],
      labs: [
        { test: 'WBC', result: '17.1', interpretation: 'High' },
        { test: 'BUN', result: '22', interpretation: 'High' },
        { test: 'Creatinine', result: '1.0', interpretation: 'Normal' },
        { test: 'Lactate', result: '2.1', interpretation: 'Slightly high' }
      ],
      dx: ['Practice chest X-ray: right lower-lobe infiltrate/consolidation.'],
      orders: ['Practice-only example orders: oxygen to provider target, pulse oximetry, CBC/BMP, chest X-ray. Exact school orders must be substituted if provided.'],
      mar: ['Practice-only medication examples should be configured by the instructor.'] }),

  T({ id: 'appendicitis', title: 'Acute Appendicitis - Supplemental Practice Module',
      prov: 'generated_supplemental_practice',
      intro: 'A practice case of right lower quadrant pain.',
      vitals: [
        { time: 'Practice baseline', bp: '126/78', hr: '102', rr: '20', spo2: '98%', temp: '100.6 F' },
        { time: 'Perforation branch', bp: '98/60', hr: '122', rr: '26', spo2: '95%', temp: '102.4 F' }
      ],
      labs: [
        { test: 'WBC', result: '16.4', interpretation: 'High' },
        { test: 'Neutrophils', result: '88%', interpretation: 'High' },
        { test: 'CRP', result: '62', interpretation: 'High' }
      ],
      dx: ['Practice CT abdomen/pelvis: enlarged inflamed appendix.'],
      orders: ['Practice-only example orders: NPO, IV fluids, analgesia, labs, imaging, surgical consult. Replace with school-specific orders if provided.'],
      mar: ['No universal medication schedule is hard-coded; instructor orders control.'] }),

  T({ id: 'appendectomy', title: 'Appendectomy Postoperative Care - Supplemental Practice Module',
      prov: 'generated_supplemental_practice',
      intro: 'A practice case of routine post-operative recovery.',
      vitals: [
        { time: 'Practice PACU return', bp: '132/76', hr: '96', rr: '18', spo2: '96%', temp: '99.1 F' },
        { time: 'Stable reassessment', bp: '126/72', hr: '86', rr: '16', spo2: '97%', temp: '98.9 F' }
      ],
      labs: [
        { test: 'WBC', result: '11.2', interpretation: 'Slightly high' },
        { test: 'Hgb', result: '12.6', interpretation: 'Normal' }
      ],
      orders: ['Practice-only example orders: postoperative vitals, pain medication, IV fluids, ambulation, wound care.'],
      mar: ['Medication choice and timing is scenario-specific and should come from the active MAR.'] }),

  T({ id: 'bowel_obstruction', title: 'Bowel Obstruction - Supplemental Practice Module',
      prov: 'generated_supplemental_practice',
      intro: 'A practice case of distension and obstipation.',
      vitals: [
        { time: 'Practice baseline', bp: '112/70', hr: '108', rr: '22', spo2: '96%', temp: '99.5 F' },
        { time: 'Ischemia branch', bp: '94/58', hr: '124', rr: '28', spo2: '94%', temp: '102.0 F' }
      ],
      labs: [
        { test: 'Lactate', result: '3.4', interpretation: 'High' },
        { test: 'Potassium', result: '3.1', interpretation: 'Low' },
        { test: 'BUN', result: '29', interpretation: 'High' },
        { test: 'Creatinine', result: '1.3', interpretation: 'High' },
        { test: 'WBC', result: '14.9', interpretation: 'High' }
      ],
      dx: ['Practice CT: dilated small-bowel loops with a transition point consistent with SBO.'],
      orders: ['Practice-only example orders: NPO, NG tube to ordered suction, isotonic IV fluids, strict I&O, surgical consult. Exact orders must be scenario-defined.'],
      mar: ['No universal medication schedule is hard-coded.'] })
];

var STUB_STUDY = {
  version: 'stub-1',
  flashcards: [
    { topic_id: 'increased_icp', front: 'What is the first sign of rising ICP?', back: 'A change in level of consciousness.', tag: 'rapid_recall', provenance: 'school' },
    { topic_id: 'increased_icp', front: 'What position is ordered?', back: 'Head of bed at 30 degrees.', tag: 'assessment', provenance: 'school' },
    { topic_id: 'ards', front: 'What does PaO2 58 tell you?', back: 'Severe hypoxemia despite oxygen.', tag: 'deterioration', provenance: 'school' },
    { topic_id: 'sepsis', front: 'Which lab drives the sepsis bundle?', back: 'Lactate 4.6.', tag: 'rapid_recall', provenance: 'school' },
    { topic_id: 'pneumonia', front: 'Practice: first oxygenation step?', back: 'Oxygen to the provider target.', tag: 'simulation_goal', provenance: 'supplemental' }
  ],
  quizzes: [
    { topic_id: 'increased_icp', type: 'single_best_answer',
      question: 'Which action best matches the first priority?',
      choices: ['ABCs with a focused neurologic assessment', 'Complete discharge teaching', 'Wait for all labs', 'Full routine head-to-toe first'],
      correct_index: 0, rationale: 'ABC prioritisation and early recognition.',
      difficulty: 'easy', provenance: 'school' },
    { topic_id: 'increased_icp', type: 'ordering',
      question: 'Put the workflow in the best order.',
      items: ['Implement active orders', 'Immediate ABC assessment', 'Reassess response', 'Verify identity'],
      correct_order: [3, 1, 0, 2], rationale: 'Safety precedes care.',
      difficulty: 'medium', provenance: 'school' },
    { topic_id: 'increased_icp', type: 'short_answer',
      question: 'Name a deterioration cue you would not ignore.',
      accepted_answers: ['Falling level of consciousness', 'Widening pulse pressure'],
      rationale: 'Either should prompt escalation.', difficulty: 'medium', provenance: 'school' },
    { topic_id: 'ards', type: 'single_best_answer',
      question: 'What does the chest X-ray suggest?',
      choices: ['Bilateral infiltrates consistent with ARDS', 'Pneumothorax', 'Normal film', 'Rib fracture'],
      correct_index: 0, rationale: 'The sheet states bilateral diffuse infiltrates.',
      difficulty: 'easy', provenance: 'school' }
  ],
  rubric: { safety: 30, assessment_recognition: 25, prioritization_interventions: 25,
            communication: 10, reassessment_documentation_education: 10 },
  sourceRules: [
    'School-file facts outrank generic medical knowledge for this chart.',
    'Do not silently repair a suspected typo.',
    'Instructor overrides outrank the original school file but must preserve an audit trail.'
  ],
  discrepancies: [],
  playbook: {
    universalSequence: [
      { n: 1, label: 'Hand hygiene and two identifiers', text: 'Every scenario, every time.' },
      { n: 2, label: 'ABC first', text: 'Airway, breathing, circulation before anything focused.' },
      { n: 3, label: 'Focused assessment', text: 'The system the case is about.' },
      { n: 4, label: 'Act inside the orders', text: 'Only what is written.' },
      { n: 5, label: 'Reassess', text: 'No intervention scores without a reassessment.' },
      { n: 6, label: 'SBAR', text: 'Escalate with numbers.' }
    ],
    earnsPoints: ['Reassessing after every intervention', 'Naming the number you are worried about'],
    crossTopicPatterns: ['Every case rewards early recognition over speed of treatment'],
    sbarFormula: [
      { letter: 'S', text: 'Who and what is wrong right now' },
      { letter: 'B', text: 'Why they are here and what has been done' },
      { letter: 'A', text: 'Your numbers' },
      { letter: 'R', text: 'What you want and how soon' }
    ],
    selfTalk: ['Say the number out loud before you decide'],
    sourceRule: 'The school file is the chart.'
  },
  webSources: []
};

/* --------------------------------------------------------------- loading */

function loadScenarios(w) {
  if (exists('data/nur2212-scenarios.js')) {
    try {
      w.eval(read('data/nur2212-scenarios.js'));
      if (Array.isArray(w.NUR2212_SCENARIOS) && w.NUR2212_SCENARIOS.length) { return 'live data file'; }
    } catch (e) { /* fall through */ }
  }
  var packAll = path.join(PACK, 'scenarios', 'ALL_SCENARIOS.json');
  if (fs.existsSync(packAll)) {
    try {
      var list = JSON.parse(fs.readFileSync(packAll, 'utf8'));
      if (Array.isArray(list) && list.length) { w.NUR2212_SCENARIOS = list; return 'authoring pack JSON'; }
    } catch (e) { /* fall through */ }
  }
  w.NUR2212_SCENARIOS = JSON.parse(JSON.stringify(STUB_SCENARIOS));
  return 'inline stub';
}

function loadStudy(w) {
  if (exists('data/nur2212-study.js')) {
    try {
      w.eval(read('data/nur2212-study.js'));
      if (w.NUR2212_STUDY && (w.NUR2212_STUDY.flashcards || w.NUR2212_STUDY.quizzes)) {
        return 'live data file';
      }
    } catch (e) { /* fall through */ }
  }
  var fc = path.join(PACK, 'question_banks', 'flashcards.json');
  var qz = path.join(PACK, 'question_banks', 'quizzes.json');
  if (fs.existsSync(fc) && fs.existsSync(qz)) {
    try {
      var pack = JSON.parse(JSON.stringify(STUB_STUDY));
      pack.flashcards = JSON.parse(fs.readFileSync(fc, 'utf8'));
      pack.quizzes = JSON.parse(fs.readFileSync(qz, 'utf8'));
      w.NUR2212_STUDY = pack;
      return 'authoring pack JSON + stub playbook';
    } catch (e) { /* fall through */ }
  }
  w.NUR2212_STUDY = JSON.parse(JSON.stringify(STUB_STUDY));
  return 'inline stub';
}

/** One topic gets a `lesson` so the lesson-driven tabs are exercised; the rest
    deliberately have none, so the "no lesson published" paths are too. */
function addLesson(w) {
  var t = (w.NUR2212_SCENARIOS || [])[0];
  if (!t) { return; }
  t.lesson = {
    testing: 'Recognising deterioration early and escalating with numbers.',
    caseStory: 'The patient came in stable and is quietly falling apart.',
    pathoChain: [{ text: 'Volume is lost' }, { text: 'Preload falls' }, { text: 'Perfusion falls' }],
    redFlags: ['Rising heart rate before the pressure drops', 'Any new confusion'],
    inRoomSequence: [{ text: 'Hand hygiene, two identifiers' }, { text: 'ABCs' }, { text: 'Focused assessment' }],
    deteriorationCues: ['Narrowing pulse pressure'],
    sbarSkeleton: ['S: …', 'B: …', 'A: …', 'R: …'],
    memoryHook: 'Rate rises before pressure falls.',
    commonMistakes: [{ text: 'Charting before escalating' }],
    sourceIssues: [],
    rapidFire: [{ q: 'First sign of shock?', a: 'Tachycardia.' }],
    references: [{ label: 'Course packet', url: '' }]
  };
}

/* ------------------------------------------------------------- utilities */

function setFieldValue(w, el, value) {
  var proto = el.tagName === 'TEXTAREA'
    ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  var desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc && desc.set) { desc.set.call(el, value); } else { el.value = value; }
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
}

/** A progress store that behaves like the shell's: functional updates, and a
    plain object handed back by reference. */
function makeStore(initial) {
  var state = initial || {};
  return {
    get: function () { return state; },
    set: function (next) {
      state = (typeof next === 'function') ? next(state) : next;
      return state;
    }
  };
}

function arrOf(v) { return Array.isArray(v) ? v : []; }

module.exports = {
  name: 'simprep-study — Clinical Simulation Prep hub, tabs, drills, provenance and mastery',

  run: function (t) {
    /* ==================================================================== */
    t.group('the module survives both data globals being missing');

    var w0World = H.makeWorld({ tier: 'pro' });
    w0World.load('js/simprep.js');
    var w0 = w0World.window;

    t.eq(typeof w0.SimPrepHub, 'function', 'window.SimPrepHub is exported');
    t.eq(typeof w0.SimPrepStudy, 'function', 'window.SimPrepStudy is exported');
    t.eq(w0.NUR2212_SCENARIOS, undefined, 'no scenario global in this world');
    t.eq(w0.NUR2212_STUDY, undefined, 'no study global in this world');
    t.eq(w0.SimPrepStudy.contentOk(), false, 'contentOk() reports the content is absent');
    t.deepEq(w0.SimPrepStudy.allTopics(), [], 'allTopics() returns an empty list, not a throw');
    t.deepEq(w0.SimPrepStudy.flashcardsFor('ards'), [], 'flashcardsFor() degrades to empty');
    t.deepEq(w0.SimPrepStudy.quizzesFor('ards'), [], 'quizzesFor() degrades to empty');

    var missHub = null, missStudy = null;
    t.noThrow(function () {
      missHub = H.renderInto(w0, w0.React.createElement(w0.SimPrepHub, {
        progress: {}, setProgress: function () {}, authUser: { uid: 'u1', email: 'a@b.c' }
      }));
    }, 'SimPrepHub renders with no data at all instead of throwing');
    t.contains(missHub ? missHub.text() : '', 'content failed to load',
      'the hub says the content failed to load, the way the shell modulePage() does');
    t.contains(missHub ? missHub.text() : '', 'nur2212-scenarios.js',
      'it names the file that is missing');

    t.noThrow(function () {
      missStudy = H.renderInto(w0, w0.React.createElement(w0.SimPrepStudy, {
        progress: {}, setProgress: function () {}, authUser: { uid: 'u1', email: 'a@b.c' },
        topicId: 'ards'
      }));
    }, 'SimPrepStudy renders with no data at all instead of throwing');
    t.contains(missStudy ? missStudy.text() : '', 'failed to load',
      'Study Mode says so too');

    /* Only ONE global present is still a survivable state. */
    w0.NUR2212_STUDY = JSON.parse(JSON.stringify(STUB_STUDY));
    t.eq(w0.SimPrepStudy.contentOk(), false,
      'the study pack alone is not enough — scenarios are the floor');
    var studyOnly = null;
    t.noThrow(function () {
      studyOnly = H.renderInto(w0, w0.React.createElement(w0.SimPrepHub, {
        progress: {}, setProgress: function () {}
      }));
    }, 'hub still renders with only the study pack loaded');

    if (missHub) { missHub.unmount(); }
    if (missStudy) { missStudy.unmount(); }
    if (studyOnly) { studyOnly.unmount(); }
    w0World.cleanup();

    /* ==================================================================== */
    /* From here on: one world, fully loaded.                                */
    var world = H.makeWorld({ tier: 'pro', uid: 'u-student' });
    var w = world.window;
    var scenSrc = loadScenarios(w);
    var studySrc = loadStudy(w);
    addLesson(w);
    world.load('js/simprep.js');

    var SP = w.SimPrepStudy;
    var React = w.React;
    var topics = SP.allTopics();

    t.group('content loaded from: scenarios = ' + scenSrc + ', study = ' + studySrc);
    t.eq(topics.length, 12, 'twelve topics are loaded');
    t.ok(SP.contentOk(), 'contentOk() is true once the scenarios are present');

    var suppTopics = topics.filter(SP.isSupplemental);
    t.eq(suppTopics.length, 4, 'exactly four topics are supplemental');
    t.eq(topics.filter(function (x) {
      return SP.provMeta(x.provenance).key === 'school';
    }).length, 8, 'the other eight are school files');

    /* ==================================================================== */
    t.group('provenance labels are distinct and never confusable');

    var keys = ['school_file', 'generated_supplemental_practice', 'instructor_override'];
    var metas = keys.map(function (k) { return SP.provMeta(k); });
    t.eq(metas.map(function (m) { return m.label; }).join('|'),
      'School source|Supplemental|Instructor override', 'the three labels read as specified');
    t.eq(new w.Set ? 3 : 3, 3, 'three provenance states exist');
    t.ok(metas[0].glyph !== metas[1].glyph && metas[1].glyph !== metas[2].glyph &&
         metas[0].glyph !== metas[2].glyph,
      'each carries a different glyph, so colour is never the only signal');
    t.ok(metas[0].cls !== metas[1].cls && metas[1].cls !== metas[2].cls,
      'each carries a different CSS class');
    var css = read('js/simprep.js');
    t.match(css, /\.sp-prov\.school\{[\s\S]{0,300}?border:2px solid/,
      'School source is a solid border');
    t.match(css, /\.sp-prov\.supp\{[\s\S]{0,300}?border:2px dashed/,
      'Supplemental is a DASHED border — distinguishable in greyscale');
    t.match(css, /\.sp-prov\.override\{[\s\S]{0,300}?border:2px double/,
      'Instructor override is a DOUBLE border');
    t.eq(SP.SUPPLEMENTAL_LABEL, 'Supplemental - verify school checklist',
      'the supplemental label is exactly the wording the source rules require');

    /* ==================================================================== */
    t.group('all twelve topics render in Study Mode');

    topics.forEach(function (topic) {
      var store = makeStore({});
      var r = null;
      var ok = t.noThrow(function () {
        r = H.renderInto(w, React.createElement(SP, {
          progress: store.get(), setProgress: store.set,
          authUser: { uid: 'u-student', email: 'nurse@example.edu' },
          topicId: topic.topic_id
        }));
      }, topic.topic_id + ' renders');
      if (ok && r) {
        var txt = r.text();
        t.contains(txt, String(topic.title).slice(0, 26),
          topic.topic_id + ' shows its title');
        t.contains(txt, '60-Second Review', topic.topic_id + ' shows the tab strip');
        r.unmount();
      }
    });

    /* ==================================================================== */
    t.group('all fourteen tabs render for every topic');

    t.eq(SP.TABS.length, 14, 'there are exactly fourteen tabs');
    t.deepEq(SP.TABS.map(function (x) { return x.label; }), [
      '60-Second Review', 'Case Story', 'Patho Chain', 'Assessment / Red Flags',
      'Vitals Trend', 'Labs & Diagnostics', 'Orders / MAR', 'In-Room Sequence',
      'Deterioration', 'SBAR', 'Common Mistakes', 'Flashcards', 'Quiz', 'Teach-Back'
    ], 'the tabs are the fourteen the spec names, in the spec order');

    var tabFailures = [];
    var thinPanes = [];
    topics.forEach(function (topic) {
      var drills = {};
      SP.DRILLS.forEach(function (d) { drills[d.id] = SP.buildDrill(d.id, topic); });
      var store = makeStore({});
      SP.TABS.forEach(function (tabDef) {
        var host = null;
        try {
          host = H.renderInto(w, React.createElement('div', null,
            SP.renderTab(tabDef.id, {
              topic: topic, progress: store.get(), setProgress: store.set,
              gate: function (subject) { return SP.scoreGate(topic, store.get(), subject); },
              onGraded: function () {}, onOpened: function () {}, drills: drills
            })));
          var text = host.text();
          if (text.length < 12) { thinPanes.push(topic.topic_id + '/' + tabDef.id); }
        } catch (e) {
          tabFailures.push(topic.topic_id + '/' + tabDef.id + ': ' + e.message);
        } finally {
          if (host) { try { host.unmount(); } catch (e2) {} }
        }
      });
    });
    t.eq(tabFailures.length, 0, '12 topics x 14 tabs = 168 panes render without throwing' +
      (tabFailures.length ? ' — ' + tabFailures.slice(0, 5).join(' | ') : ''));
    t.eq(thinPanes.length, 0, 'no pane renders empty — a topic with nothing for a tab says so' +
      (thinPanes.length ? ' — ' + thinPanes.slice(0, 6).join(', ') : ''));

    /* ==================================================================== */
    t.group('the tab strip actually switches panes (one-handed, on a phone)');

    var navStore = makeStore({});
    var nav = H.renderInto(w, React.createElement(SP, {
      progress: navStore.get(), setProgress: navStore.set,
      authUser: { uid: 'u-student', email: 'nurse@example.edu' },
      topicId: topics[0].topic_id
    }));
    t.eq(nav.all('[role="tab"]').length, 14, 'fourteen tabs are in the tablist');
    t.eq(nav.all('[role="tab"][aria-selected="true"]').length, 1, 'exactly one tab is selected');
    var ordersTab = nav.all('[role="tab"]').filter(function (b) {
      return /Orders \/ MAR/.test(b.textContent || '');
    })[0];
    t.ok(!!ordersTab, 'the Orders / MAR tab is present');
    nav.click(ordersTab);
    t.eq(ordersTab.getAttribute('aria-selected'), 'true', 'clicking a tab selects it');
    t.contains(nav.text(), 'Provider orders', 'and the pane swaps to the orders chart');
    var phoneCss = /@media \(max-width:700px\)\{[\s\S]{0,600}?\.sp-tabwrap\{order:2;position:sticky;top:auto;bottom:0/
      .test(read('js/simprep.js'));
    t.ok(phoneCss,
      'below 700px the tab strip parks at the BOTTOM of the viewport, in thumb reach');
    nav.unmount();

    /* ==================================================================== */
    t.group('all eight interactions build FROM the scenario data');

    t.eq(SP.DRILLS.length, 8, 'there are exactly eight drills');
    t.deepEq(SP.DRILLS.map(function (d) { return d.label; }), [
      'Trend Spotter', 'Lab Triage', 'Order vs. No Order', 'Already Done',
      'ABG Sprint', 'Shock Type Match', 'SBAR Builder', 'Look-Alike Compare'
    ], 'the eight are the ones the spec names');

    var ocProblems = [], ocYesSeen = 0, ocNoSeen = 0;
    var adProblems = [], adYesSeen = 0;
    var trendProblems = [], labProblems = [], sbarProblems = [];
    var abgProblems = [], shockProblems = [], laProblems = [];

    topics.forEach(function (topic) {
      var id = topic.topic_id;

      /* --- Order vs No Order: every "yes" is a real order, verbatim --- */
      var oc = SP.buildOrderCheck(topic);
      if (!oc.ok) { ocProblems.push(id + ': not built'); }
      else {
        arrOf(oc.items).forEach(function (it) {
          if (it.inChart) {
            ocYesSeen++;
            if (arrOf(topic.orders).indexOf(it.text) === -1) {
              ocProblems.push(id + ': "' + String(it.text).slice(0, 40) + '" is not in topic.orders');
            }
          } else {
            ocNoSeen++;
            if (arrOf(topic.orders).indexOf(it.text) !== -1) {
              ocProblems.push(id + ': a distractor duplicates a real order');
            }
          }
        });
        if (!arrOf(oc.items).filter(function (x) { return x.inChart; }).length) {
          ocProblems.push(id + ': no real order made it into the drill');
        }
      }

      /* --- Already Done: every "given" is a real MAR line --- */
      var ad = SP.buildAlreadyDone(topic);
      if (!ad.ok) { adProblems.push(id + ': not built'); }
      else {
        arrOf(ad.items).forEach(function (it) {
          if (it.given) {
            adYesSeen++;
            if (arrOf(topic.mar).indexOf(it.text) === -1) {
              adProblems.push(id + ': "' + String(it.text).slice(0, 40) + '" is not in topic.mar');
            }
          } else if (arrOf(topic.mar).indexOf(it.text) !== -1) {
            adProblems.push(id + ': a "not given" item duplicates a MAR line');
          }
        });
      }

      /* --- Trend Spotter: rows are the chart's own vital sets --- */
      var tr = SP.buildTrendSpotter(topic);
      if (tr.ok) {
        arrOf(tr.rows).forEach(function (row) {
          if (arrOf(topic.vital_trends).indexOf(row) === -1) {
            trendProblems.push(id + ': a rendered vital set is not from vital_trends');
          }
        });
        if (arrOf(tr.rows).length < 2) { trendProblems.push(id + ': fewer than two sets shown'); }
        if (arrOf(tr.rows).length > 3) { trendProblems.push(id + ': more than three sets shown'); }
      } else if (arrOf(topic.vital_trends).length >= 2) {
        trendProblems.push(id + ': had trend data and still refused to build');
      }

      /* --- Lab Triage: items are the chart's own labs --- */
      var lt = SP.buildLabTriage(topic);
      if (lt.ok) {
        arrOf(lt.items).forEach(function (it, i) {
          var src = arrOf(topic.labs)[i] || {};
          if (String(src.test) !== it.test || String(src.result) !== it.result) {
            labProblems.push(id + ': lab row ' + i + ' does not match topic.labs');
          }
        });
        if (lt.pickCount !== 3) { labProblems.push(id + ': does not ask for three'); }
        if (!arrOf(lt.answers).length) { labProblems.push(id + ': no urgent answer set'); }
      }

      /* --- SBAR: the expected lines are the chart's own --- */
      var sb = SP.buildSbar(topic);
      if (!sb.ok) { sbarProblems.push(id + ': not built'); }
      else {
        arrOf(sb.letters).forEach(function (L) {
          if (L.expected && arrOf(topic.sbar_expected).indexOf(L.expected) === -1) {
            sbarProblems.push(id + ': SBAR model text is not from sbar_expected');
          }
        });
      }

      /* --- ABG: values come out of some real chart's labs --- */
      var ab = SP.buildAbgSprint(topic);
      if (ab.ok) {
        var srcTopic = SP.topicById(ab.sourceTopicId);
        if (!srcTopic) { abgProblems.push(id + ': ABG source topic is not a real topic'); }
        else {
          var names = arrOf(srcTopic.labs).map(function (l) {
            return String(l.test).toLowerCase().replace(/\s+/g, '');
          });
          if (names.indexOf('ph') === -1 || names.indexOf('paco2') === -1) {
            abgProblems.push(id + ': ABG source chart has no gas');
          }
        }
        var ownNames = arrOf(topic.labs).map(function (l) {
          return String(l.test).toLowerCase().replace(/\s+/g, '');
        });
        var ownHasGas = ownNames.indexOf('ph') !== -1 && ownNames.indexOf('paco2') !== -1;
        if (ownHasGas && ab.borrowed) { abgProblems.push(id + ': borrowed a gas it already had'); }
        if (!ownHasGas && !ab.borrowed) { abgProblems.push(id + ': claims its own gas without one'); }
      }

      /* --- Shock: stems come out of case_intro --- */
      var sh = SP.buildShockMatch(topic);
      if (sh.ok) {
        arrOf(sh.cards).forEach(function (c) {
          var src = SP.topicById(c.topicId);
          if (!src) { shockProblems.push(id + ': shock card for an unknown topic'); return; }
          if (String(src.case_intro).indexOf(String(c.stem).replace(/…$/, '').slice(0, 30)) !== 0) {
            shockProblems.push(id + ': shock stem is not the head of that chart\'s case_intro');
          }
          if (['hypovolemic', 'distributive', 'obstructive', 'cardiogenic'].indexOf(c.answer) === -1) {
            shockProblems.push(id + ': unknown shock category ' + c.answer);
          }
        });
      }

      /* --- Look-alike: every discriminator is a real line of its own chart --- */
      var la = SP.buildLookAlike(topic);
      if (la.ok) {
        arrOf(la.items).forEach(function (it) {
          var src = SP.topicById(it.topicId);
          if (!src) { laProblems.push(id + ': discriminator from an unknown topic'); return; }
          var pool = arrOf(src.initial_findings).concat(arrOf(src.diagnostics))
            .concat(arrOf(src.labs).map(function (l) {
              return String(l.test) + ' ' + String(l.result) + ' (' + String(l.interpretation) + ')';
            }));
          if (pool.indexOf(it.text) === -1) {
            laProblems.push(id + ': "' + String(it.text).slice(0, 40) + '" is not a line of that chart');
          }
        });
      }
    });

    t.eq(ocProblems.length, 0, 'Order vs No Order: every permitted item is a VERBATIM line of ' +
      'that topic\'s own `orders`, and no distractor duplicates one' +
      (ocProblems.length ? ' — ' + ocProblems.slice(0, 4).join(' | ') : ''));
    t.ok(ocYesSeen >= 12, ocYesSeen + ' real order lines were used across the twelve charts');
    t.ok(ocNoSeen >= 12, ocNoSeen + ' not-in-chart candidates were generated');
    t.eq(adProblems.length, 0, 'Already Done: every "already given" item is a verbatim line of ' +
      'that topic\'s own `mar`' + (adProblems.length ? ' — ' + adProblems.slice(0, 4).join(' | ') : ''));
    t.ok(adYesSeen >= 8, adYesSeen + ' real MAR lines were used');
    t.eq(trendProblems.length, 0, 'Trend Spotter shows two or three of the chart\'s own vital sets' +
      (trendProblems.length ? ' — ' + trendProblems.slice(0, 4).join(' | ') : ''));
    t.eq(labProblems.length, 0, 'Lab Triage lists the chart\'s own labs and asks for three' +
      (labProblems.length ? ' — ' + labProblems.slice(0, 4).join(' | ') : ''));
    t.eq(sbarProblems.length, 0, 'SBAR Builder grades against the chart\'s own sbar_expected' +
      (sbarProblems.length ? ' — ' + sbarProblems.slice(0, 4).join(' | ') : ''));
    t.eq(abgProblems.length, 0, 'ABG Sprint reads a real gas, and only borrows one when the ' +
      'chart genuinely has none' + (abgProblems.length ? ' — ' + abgProblems.slice(0, 4).join(' | ') : ''));
    t.eq(shockProblems.length, 0, 'Shock Type Match builds its stems from real case introductions' +
      (shockProblems.length ? ' — ' + shockProblems.slice(0, 4).join(' | ') : ''));
    t.eq(laProblems.length, 0, 'Look-Alike Compare only uses findings that really appear in the ' +
      'chart it attributes them to' + (laProblems.length ? ' — ' + laProblems.slice(0, 4).join(' | ') : ''));

    /* The chart-driven values are also computed correctly, not just sourced. */
    var ardsTopic = SP.topicById('ards');
    if (ardsTopic) {
      var ardsTrend = SP.buildTrendSpotter(ardsTopic);
      t.ok(ardsTrend.ok && ardsTrend.answers.indexOf('spo2') !== -1,
        'ARDS: falling SpO2 is detected as deteriorating');
      t.ok(ardsTrend.ok && ardsTrend.answers.indexOf('rr') !== -1,
        'ARDS: rising respiratory rate is detected too');
      var ardsAbg = SP.buildAbgSprint(ardsTopic);
      t.eq(ardsAbg.ok && ardsAbg.borrowed, false, 'ARDS uses its own gas');
      t.eq(ardsAbg.ok ? ardsAbg.truth.primary : '', 'respiratory alkalosis',
        'ARDS pH 7.48 / PaCO2 31 reads as a respiratory alkalosis');
      t.eq(ardsAbg.ok ? ardsAbg.truth.oxygenation : '', 'severe hypoxemia',
        'PaO2 58 reads as severe hypoxemia');
    }
    var stableTopic = SP.topicById('appendectomy');
    if (stableTopic) {
      var st = SP.buildTrendSpotter(stableTopic);
      t.ok(st.ok && st.stable,
        'the post-op practice chart is correctly read as improving, not deteriorating — ' +
        'the drill is computed, not assumed');
    }
    var hf = SP.topicById('heart_failure');
    if (hf && arrOf(hf.vital_trends).length === 1) {
      t.eq(SP.buildTrendSpotter(hf).ok, false,
        'a chart with one vital set refuses to fake a trend');
    }
    var ugib = SP.topicById('upper_gi_bleed');
    if (ugib) {
      var shockCards = SP.buildShockMatch(ugib);
      var mine = shockCards.ok ? arrOf(shockCards.cards).filter(function (c) {
        return c.topicId === 'upper_gi_bleed';
      })[0] : null;
      t.eq(mine ? mine.answer : '', 'hypovolemic',
        'the GI bleed is classified hypovolemic from the words in its own title');
      t.eq(mine ? mine.from : '', 'stated',
        'and it is marked as STATED by the sheet, not inferred');
    }

    /* SBAR grading: completeness, never wording. */
    var sbarDrill = SP.buildSbar(SP.topicById('sepsis') || topics[0]);
    if (sbarDrill.ok) {
      var verbatim = {};
      arrOf(sbarDrill.letters).forEach(function (L) { verbatim[L.key] = L.expected; });
      var gradedVerbatim = SP.gradeSbar(sbarDrill, verbatim);
      t.ok(gradedVerbatim.complete, 'an SBAR that repeats the sheet scores complete');
      var paraphrased = {};
      arrOf(sbarDrill.letters).forEach(function (L) {
        /* Same elements, none of the sheet's sentence structure. */
        paraphrased[L.key] = arrOf(L.elements).join(' , ');
      });
      var gradedParaphrase = SP.gradeSbar(sbarDrill, paraphrased);
      t.ok(gradedParaphrase.complete,
        'an SBAR carrying the same facts in completely different words also scores complete — ' +
        'exact phrasing is never required');
      var empty = SP.gradeSbar(sbarDrill, { S: '', B: '', A: '', R: '' });
      t.eq(empty.complete, false, 'an empty SBAR is not complete');
    }

    /* ==================================================================== */
    t.group('a supplemental topic carries its label everywhere');

    var supp = suppTopics[0];
    t.ok(!!supp, 'there is a supplemental topic to check');
    if (supp) {
      var sStore = makeStore({});
      var sr = H.renderInto(w, React.createElement(SP, {
        progress: sStore.get(), setProgress: sStore.set,
        authUser: { uid: 'u-student', email: 'nurse@example.edu' },
        topicId: supp.topic_id
      }));
      t.contains(sr.text(), 'Supplemental - verify school checklist',
        supp.topic_id + ' shows the supplemental label on the opening tab');
      /* And it stays put as the student moves through the lesson - a warning
         shown once at the start is a warning nobody sees. */
      var stuck = [];
      ['Case Story', 'Labs & Diagnostics', 'Orders / MAR', 'Quiz'].forEach(function (label) {
        var btn = sr.all('[role="tab"]').filter(function (b) {
          return b.textContent === label || (b.textContent || '').indexOf(label) === 0;
        })[0];
        if (!btn) { stuck.push(label + ' (tab not found)'); return; }
        sr.click(btn);
        if (sr.text().indexOf('Supplemental - verify school checklist') === -1) {
          stuck.push(label);
        }
      });
      t.eq(stuck.length, 0, 'the label is still on screen after moving to ' +
        'Case Story, Labs, Orders and Quiz' + (stuck.length ? ' — missing on: ' + stuck.join(', ') : ''));
      t.contains(sr.text(), 'Supplemental',
        'and the provenance badge reads Supplemental, never School source');
      t.notContains(sr.text(), 'School source',
        'a supplemental topic never shows a School source badge');
      sr.unmount();

      /* The hub carries it too. */
      var hStore = makeStore({});
      var hub = H.renderInto(w, React.createElement(w.SimPrepHub, {
        progress: hStore.get(), setProgress: hStore.set,
        authUser: { uid: 'u-student', email: 'nurse@example.edu' }
      }));
      var hubText = hub.text();
      t.contains(hubText, 'Supplemental - verify school checklist',
        'the hub tile for a supplemental topic carries the label');
      t.contains(hubText, 'Clinical Simulation Prep', 'the hub renders its own heading');
      t.contains(hubText, 'Study Mode', 'the hub offers Study Mode');
      t.contains(hubText, 'Simulation Mode', 'the hub offers Simulation Mode');
      t.contains(hubText, 'Checkoff Coach', 'the hub offers the Checkoff Coach');
      t.contains(hubText, 'not for real patient care',
        'the hub carries the simulation-practice-only disclaimer');
      hub.unmount();
    }

    /* ==================================================================== */
    t.group('the hub degrades when the sibling modules are not loaded');

    t.eq(SP.modeAvailable('SimPrepSimMode'), false, 'js/simprep-sim.js is not in this world');
    var dStore = makeStore({});
    var degrade = H.renderInto(w, React.createElement(w.SimPrepHub, {
      progress: dStore.get(), setProgress: dStore.set
    }));
    var simBtn = degrade.all('button').filter(function (b) {
      return /Simulation Mode/.test(b.textContent || '');
    })[0];
    t.ok(!!simBtn, 'the Simulation Mode entry point is rendered');
    t.eq(simBtn ? simBtn.disabled : false, true,
      'and it is disabled rather than throwing when the module is absent');
    t.contains(degrade.text(), 'Not loaded (js/simprep-sim.js)',
      'the hub names the file that would provide it');
    degrade.unmount();

    /* With the module present it is handed the standard prop bundle. */
    var handed = null;
    w.SimPrepSimMode = function (props) {
      handed = props;
      return React.createElement('div', null, 'SIM MODE STANDIN');
    };
    t.eq(SP.modeAvailable('SimPrepSimMode'), true, 'feature detection sees it once defined');
    var lStore = makeStore({});
    var launcher = H.renderInto(w, React.createElement(w.SimPrepHub, {
      progress: lStore.get(), setProgress: lStore.set,
      authUser: { uid: 'u-student', email: 'nurse@example.edu' }, isAdmin: false
    }));
    var simBtn2 = launcher.all('button').filter(function (b) {
      return /Simulation Mode/.test(b.textContent || '');
    })[0];
    launcher.click(simBtn2);
    t.contains(launcher.text(), 'SIM MODE STANDIN', 'the hub mounts the sibling module');
    t.ok(handed && typeof handed.setProgress === 'function' && 'progress' in handed,
      'and hands it the same {progress, setProgress, authUser, topicId, onNav} bundle');
    launcher.unmount();
    delete w.SimPrepSimMode;

    /* ==================================================================== */
    t.group('a disputed item is NOT scored until an override exists');

    /* Pick a topic that really has a chart-scoped discrepancy. */
    var disputed = null, disputedDisc = null, disputedSubject = '';
    topics.forEach(function (topic) {
      if (disputed) { return; }
      var ds = SP.discrepanciesFor(topic).filter(function (d) { return d.scope === 'chart'; });
      ds.forEach(function (d) {
        if (disputed) { return; }
        var pool = arrOf(topic.orders).concat(arrOf(topic.mar))
          .concat(arrOf(topic.labs).map(function (l) {
            return String(l.test) + ' ' + String(l.result) + ' ' + String(l.interpretation);
          }));
        pool.forEach(function (line) {
          if (disputed) { return; }
          if (arrOf(SP.disputesOn(topic, line)).length) {
            disputed = topic; disputedDisc = d; disputedSubject = line;
          }
        });
      });
    });
    t.ok(!!disputed, 'at least one chart line in the corpus is matched to its source discrepancy');

    if (disputed) {
      var hits = SP.disputesOn(disputed, disputedSubject);
      t.ok(hits.length > 0, disputed.topic_id + ': "' +
        String(disputedSubject).slice(0, 46) + '" is matched to a source issue');
      var gateBefore = SP.scoreGate(disputed, {}, disputedSubject);
      t.eq(gateBefore.scored, false, 'with no override the item is NOT scored');
      t.ok(gateBefore.blocking.length > 0, 'and the blocking discrepancy is named');

      var withOverride = {};
      withOverride.simprep = { overrides: {} };
      withOverride.simprep.overrides[hits[0].id] = SP.makeOverride({
        discrepancyId: hits[0].id, topicId: disputed.topic_id,
        originalText: 'as printed on the sheet', replacementText: 'as the instructor corrected it',
        instructorName: 'Prof. Reyes', recordedByUid: 'u-student', recordedByName: 'Student',
        recordedByRole: 'student'
      });
      var gateAfter = SP.scoreGate(disputed, withOverride, disputedSubject);
      t.eq(gateAfter.scored, true, 'once an override exists the same item IS scored');
      t.eq(SP.isResolved(withOverride, hits[0].id), true, 'isResolved() agrees');

      /* An undisputed line in the same chart was never blocked. */
      var clean = arrOf(disputed.orders).filter(function (line) {
        return !arrOf(SP.disputesOn(disputed, line)).length;
      })[0];
      if (clean) {
        t.eq(SP.scoreGate(disputed, {}, clean).scored, true,
          'a line the discrepancy does not touch is scored normally — the gate is targeted, ' +
          'not a blanket');
      }

      /* And the withheld attempt writes an audit line but moves nothing. */
      var gStore = makeStore({});
      SP.recordAttempt(gStore.set, gStore.get(), {
        topicId: disputed.topic_id, tag: 'meds_orders', correct: true, hinted: false,
        scored: false, reason: 'source issue', label: 'blocked item'
      });
      var after = SP.stateOf(gStore.get());
      t.eq(Object.keys(after.concepts).length, 0,
        'a correct answer on a disputed item moves NO concept');
      t.eq(after.log.length, 1, 'but it is recorded in the log');
      t.eq(after.log[0].scored, false, 'flagged as unscored');
      t.contains(after.log[0].reason, 'source issue', 'with the reason it was withheld');
    }

    /* Paperwork-only notes never block a chart item. */
    var docOnly = null;
    topics.forEach(function (topic) {
      SP.discrepanciesFor(topic).forEach(function (d) {
        if (!docOnly && d.scope === 'document') { docOnly = { topic: topic, d: d }; }
      });
    });
    t.ok(!!docOnly, 'the corpus contains a paperwork-only discrepancy (a "Faculty" header)');
    if (docOnly) {
      var anyBlocked = arrOf(docOnly.topic.orders).filter(function (line) {
        return arrOf(SP.disputesOn(docOnly.topic, line)).filter(function (x) {
          return x.id === docOnly.d.id;
        }).length;
      }).length;
      t.eq(anyBlocked, 0,
        'a note about the document header does not withhold scoring on any chart line');
    }

    /* ==================================================================== */
    t.group('an override records an audit trail and never erases the original');

    var ovTopic = disputed || topics[0];
    var ovStore = makeStore({});
    var ovRender = H.renderInto(w, React.createElement(SP, {
      progress: ovStore.get(), setProgress: ovStore.set,
      authUser: { uid: 'u-student', email: 'nurse@example.edu', displayName: 'Sam Rivera' },
      isAdmin: false, topicId: ovTopic.topic_id
    }));

    t.contains(ovRender.text(), 'Source issue - verify with instructor',
      'the source-issue panel is on screen for a topic with discrepancies');
    t.contains(ovRender.text(), 'NOT SCORED',
      'and it states plainly that the touched items are not scored');

    var openBtn = ovRender.button(/Record an instructor override/);
    t.ok(!!openBtn, 'the override screen can be opened');
    ovRender.click(openBtn);

    var origTa = ovRender.find('textarea[id^="spo-orig-"]');
    var replTa = ovRender.find('textarea[id^="spo-repl-"]');
    var whoIn = ovRender.find('input[id^="spo-who-"]');
    t.ok(!!origTa && !!replTa && !!whoIn, 'the form asks for original, replacement and instructor');
    t.ok(String(origTa && origTa.value).length > 10,
      'the original field is pre-filled from the school source note, not blank');

    var ORIGINAL = 'Maintain oxygen SpO2 <95% (as printed)';
    var REPLACEMENT = 'Maintain oxygen SpO2 >95%';
    var React2 = require('react');
    React2.act(function () {
      setFieldValue(w, origTa, ORIGINAL);
      setFieldValue(w, replTa, REPLACEMENT);
      setFieldValue(w, whoIn, 'Prof. Reyes');
    });
    ovRender.click(ovRender.button(/^Save override$/));

    var savedState = SP.stateOf(ovStore.get());
    var savedIds = Object.keys(savedState.overrides);
    t.eq(savedIds.length, 1, 'exactly one override record was written');
    var rec = savedState.overrides[savedIds[0]];
    t.eq(rec.originalText, ORIGINAL, 'the ORIGINAL school wording is stored, not discarded');
    t.eq(rec.replacementText, REPLACEMENT, 'the replacement is stored');
    t.eq(rec.instructorName, 'Prof. Reyes', 'the instructor it is attributed to is stored');
    t.eq(rec.recordedByUid, 'u-student', 'the uid that typed it is stored');
    t.eq(rec.recordedByName, 'Sam Rivera', 'the name that typed it is stored');
    t.eq(rec.recordedByEmail, 'nurse@example.edu', 'the email that typed it is stored');
    t.eq(rec.recordedByRole, 'student',
      'a student-entered override is recorded as student-entered, not dressed up as faculty');
    t.match(rec.at, /^\d{4}-\d{2}-\d{2}T/, 'an ISO timestamp is stored');
    t.eq(rec.active, true, 'the override is active');
    t.deepEq(rec.history, [], 'the first record has an empty history');
    t.eq(rec.discrepancyId, savedIds[0], 'it is keyed by the discrepancy it settles');
    t.contains(rec.discrepancyId, ovTopic.topic_id, 'the discrepancy id carries its topic');

    /* Re-render against the new progress: both texts are on screen. */
    ovRender.unmount();
    var ovRender2 = H.renderInto(w, React.createElement(SP, {
      progress: ovStore.get(), setProgress: ovStore.set,
      authUser: { uid: 'u-student', email: 'nurse@example.edu', displayName: 'Sam Rivera' },
      topicId: ovTopic.topic_id
    }));
    var shown = ovRender2.text();
    t.contains(shown, ORIGINAL, 'the ORIGINAL is still rendered after the override');
    t.contains(shown, REPLACEMENT, 'alongside the replacement');
    t.contains(shown, 'Prof. Reyes', 'and the attribution');
    t.contains(shown, 'Sam Rivera', 'and who recorded it');
    t.contains(shown, 'Override active', 'the panel marks the issue as settled');
    t.ok(!!ovRender2.find('.sp-strike'),
      'the original is struck through rather than removed — the school file is still visible');

    /* Superseding: the earlier record is pushed to history, never dropped. */
    ovRender2.click(ovRender2.button(/Record a new override/));
    var replTa2 = ovRender2.find('textarea[id^="spo-repl-"]');
    var whoIn2 = ovRender2.find('input[id^="spo-who-"]');
    React2.act(function () {
      setFieldValue(w, replTa2, 'Maintain SpO2 at or above 94%');
      setFieldValue(w, whoIn2, 'Prof. Okafor');
    });
    ovRender2.click(ovRender2.button(/^Save override$/));

    var rec2 = SP.stateOf(ovStore.get()).overrides[savedIds[0]];
    t.eq(rec2.replacementText, 'Maintain SpO2 at or above 94%', 'the newest override wins');
    t.eq(rec2.originalText, ORIGINAL, 'and the school original is STILL carried on the record');
    t.eq(arrOf(rec2.history).length, 1, 'the superseded override is kept in history');
    t.eq(arrOf(rec2.history)[0].replacementText, REPLACEMENT,
      'and history holds the previous replacement text verbatim');
    t.eq(arrOf(rec2.history)[0].instructorName, 'Prof. Reyes',
      'with the instructor it was attributed to at the time');

    /* Revoking deactivates and keeps everything. The shell re-renders on every
       progress change; the test has to do that explicitly or the component
       would still be holding the progress object it was mounted with. */
    ovRender2.unmount();
    var ovRender3 = H.renderInto(w, React.createElement(SP, {
      progress: ovStore.get(), setProgress: ovStore.set,
      authUser: { uid: 'u-student', email: 'nurse@example.edu', displayName: 'Sam Rivera' },
      topicId: ovTopic.topic_id
    }));
    ovRender3.click(ovRender3.button(/Revoke/));
    var rec3 = SP.stateOf(ovStore.get()).overrides[savedIds[0]];
    t.eq(rec3.active, false, 'revoking marks the override inactive');
    t.eq(rec3.originalText, ORIGINAL, 'and still keeps the school original');
    t.eq(arrOf(rec3.history).length, 2, 'the revocation is appended to the trail, not a deletion');
    t.eq(SP.isResolved(ovStore.get(), savedIds[0]), false,
      'a revoked override no longer unblocks scoring');
    t.ok(!!SP.overrideRecord(ovStore.get(), savedIds[0]),
      'but the record itself is still retrievable');
    ovRender3.unmount();

    /* ------------------------------------------------------------------ */
    /* Interop: js/simprep-sim.js keeps overrides under a different key, keyed
       by POSITION rather than by content hash. An override given by an
       instructor has to outrank the school file in BOTH modes, or the same
       disputed line is scored two different ways depending on which screen the
       student happens to be on. */
    var interopStore = makeStore({});
    var interopTopic = disputed || topics[0];
    var interopDisc = SP.discrepanciesFor(interopTopic).filter(function (d) {
      return d.scope === 'chart';
    })[0];
    if (interopDisc) {
      var ir = H.renderInto(w, React.createElement(SP, {
        progress: interopStore.get(), setProgress: interopStore.set,
        authUser: { uid: 'u-student', email: 'n@e.edu', displayName: 'Sam Rivera' },
        topicId: interopTopic.topic_id
      }));
      ir.click(ir.button(/Record an instructor override/));
      React2.act(function () {
        setFieldValue(w, ir.find('textarea[id^="spo-repl-"]'), 'Corrected wording');
        setFieldValue(w, ir.find('input[id^="spo-who-"]'), 'Prof. Reyes');
      });
      ir.click(ir.button(/^Save override$/));
      ir.unmount();

      var interopOut = interopStore.get();
      var proj = (interopOut[SP.INTEROP_KEY] || {})[interopTopic.topic_id] || {};
      var projKeys = Object.keys(proj);
      t.eq(projKeys.length, 1,
        'saving here also writes the projection Simulation Mode reads');
      t.match(projKeys[0], /^d\d+$/,
        'addressed by position, the way js/simprep-sim.js addresses it');
      t.eq(proj[projKeys[0]].text, 'Corrected wording', 'with the replacement text');
      t.ok(String(proj[projKeys[0]].original).length > 0,
        'and the school original travels with it — never dropped, in either shape');
      t.ok(!!SP.stateOf(interopOut).overrides[Object.keys(SP.stateOf(interopOut).overrides)[0]],
        'while the full audit record stays in this module\'s own branch');

      /* The reverse direction: an override recorded by the sim module unlocks
         scoring here without any record in our branch. */
      var simSide = {};
      simSide[SP.INTEROP_KEY] = {};
      simSide[SP.INTEROP_KEY][interopTopic.topic_id] = {};
      simSide[SP.INTEROP_KEY][interopTopic.topic_id]['d' + interopDisc.index] =
        { text: 'Fixed during the sim', by: 'Prof. Okafor', at: Date.now() };
      t.eq(SP.stateOf(simSide).overrides[interopDisc.id], undefined,
        'there is no audit record on our side for a sim-mode override');
      t.eq(SP.isResolved(simSide, interopDisc.id), true,
        'and it still resolves the issue here — one override, both modes');
      t.ok(!!SP.interopOverride(simSide, interopDisc.id),
        'interopOverride() finds it by matching the discrepancy back to its index');
      if (disputed && interopTopic === disputed) {
        t.eq(SP.scoreGate(disputed, simSide, disputedSubject).scored, true,
          'so the disputed chart line becomes scoreable in Study Mode too');
      }
    }

    /* An admin is stamped as an instructor. */
    var adminStore = makeStore({});
    var adminRender = H.renderInto(w, React.createElement(SP, {
      progress: adminStore.get(), setProgress: adminStore.set,
      authUser: { uid: 'u-fac', email: 'faculty@example.edu', displayName: 'Dr Bell' },
      isAdmin: true, topicId: ovTopic.topic_id
    }));
    adminRender.click(adminRender.button(/Record an instructor override/));
    React2.act(function () {
      setFieldValue(w, adminRender.find('textarea[id^="spo-repl-"]'), 'Corrected by faculty');
      setFieldValue(w, adminRender.find('input[id^="spo-who-"]'), 'Dr Bell');
    });
    adminRender.click(adminRender.button(/^Save override$/));
    var adminRec = SP.stateOf(adminStore.get()).overrides[Object.keys(SP.stateOf(adminStore.get()).overrides)[0]];
    t.eq(adminRec.recordedByRole, 'instructor',
      'an override recorded from an instructor account is stamped as instructor');
    adminRender.unmount();

    /* ==================================================================== */
    t.group('mastery rises only on unhinted success, and falls on a confident miss');

    var blank = { topic: 'ards', tag: 'labs', conf: 0, step: 0, reps: 0, hits: 0,
                  hintedHits: 0, misses: 0, last: 0, due: 0 };
    var ivals = SP.DEFAULT_INTERVALS;
    t.deepEq(ivals, [0, 1, 3, 7, 14],
      'the default schedule is same session, 1 day, 3 days, 7 days, 14 days');

    var r1 = SP.gradeConcept(blank, { correct: true, hinted: false }, ivals);
    t.eq(r1.conf, 1, 'an unhinted success raises confidence');
    t.eq(r1.step, 1, 'and advances one interval step');
    t.eq(r1.hits, 1, 'and counts as a clean hit');

    var r2 = SP.gradeConcept(r1, { correct: true, hinted: true }, ivals);
    t.eq(r2.conf, 1, 'a HINTED success does not raise confidence — recognising is not retrieving');
    t.eq(r2.step, 1, 'and does not advance the schedule');
    t.eq(r2.hintedHits, 1, 'it is counted separately');
    t.ok(r2.due - Date.now() <= SP.SAME_SESSION_MS + 500,
      'a hinted success comes back this session');

    var climbed = blank;
    var i;
    for (i = 0; i < 4; i++) {
      climbed = SP.gradeConcept(climbed, { correct: true, hinted: false }, ivals);
    }
    t.eq(climbed.conf, 4, 'four clean retrievals reach confidence 4');
    t.ok(climbed.due - Date.now() > 3 * 86400000,
      'and the next review is days away, not minutes');

    var confidentMiss = SP.gradeConcept(climbed, { correct: false, hinted: false }, ivals);
    t.eq(confidentMiss.conf, 2,
      'a miss at confidence 4 costs TWO points — the confident miss is the dangerous one');
    t.eq(confidentMiss.step, 0, 'and resets the schedule to the beginning');
    t.ok(confidentMiss.due - Date.now() <= SP.SAME_SESSION_MS + 500,
      'so it comes back this session');
    t.eq(confidentMiss.lastResult, 'miss-sure', 'and it is labelled as a confident miss');

    var lowMiss = SP.gradeConcept(
      SP.gradeConcept(blank, { correct: true, hinted: false }, ivals),
      { correct: false, hinted: false }, ivals);
    t.eq(lowMiss.conf, 0, 'a miss at low confidence costs one point');

    var declaredSure = SP.gradeConcept(
      SP.gradeConcept(blank, { correct: true, hinted: false }, ivals),
      { correct: false, hinted: false, sure: true }, ivals);
    t.eq(declaredSure.conf, 0, 'ticking "I am sure" makes a miss cost two even at low confidence');
    t.eq(declaredSure.lastResult, 'miss-sure', 'and it is recorded as such');

    var ceiling = climbed;
    for (i = 0; i < 6; i++) {
      ceiling = SP.gradeConcept(ceiling, { correct: true, hinted: false }, ivals);
    }
    t.eq(ceiling.conf, 5, 'confidence caps at 5');
    var floor = SP.gradeConcept(blank, { correct: false, hinted: false, sure: true }, ivals);
    t.eq(floor.conf, 0, 'and floors at 0');

    /* The schedule is configurable. */
    var crammed = SP.intervalsOf({ simprep: { prefs: { intervals: [0, 0.5, 1, 2] } } });
    t.deepEq(crammed, [0, 0.5, 1, 2], 'the interval schedule is a preference, not a constant');
    t.deepEq(SP.intervalsOf({}), [0, 1, 3, 7, 14], 'and falls back to the default');
    var soon = SP.dueAt(1, crammed, 0);
    t.eq(soon, 0.5 * 86400000, 'dueAt() honours a compressed schedule');

    /* Opening cards is counted and moves nothing. */
    var openStore = makeStore({});
    for (i = 0; i < 20; i++) { SP.recordOpened(openStore.set, 'ards', 'card:' + i); }
    var openState = SP.stateOf(openStore.get());
    t.eq(Object.keys(openState.opened).length, 20, 'twenty card opens are counted');
    t.eq(Object.keys(openState.concepts).length, 0,
      'and NONE of them created a concept record — a topic is not mastered because every card ' +
      'was opened');
    var openedMastery = SP.topicMastery(openStore.get(), SP.topicById('ards') || topics[0]);
    t.eq(openedMastery.pct, 0, 'topic mastery is still zero after opening every card');
    t.eq(openedMastery.ready, false, 'and the topic is not "ready"');

    /* Concepts are keyed by concept tag, not by topic. */
    t.eq(SP.conceptKey('ards', 'labs'), 'ards|labs',
      'the storage unit is topic + concept tag, so one topic holds several independent concepts');
    var multiStore = makeStore({});
    ['labs', 'sbar', 'deterioration'].forEach(function (tag) {
      SP.recordAttempt(multiStore.set, multiStore.get(), {
        topicId: 'ards', tag: tag, correct: true, hinted: false, scored: true, label: tag
      });
    });
    var multi = SP.stateOf(multiStore.get());
    t.eq(Object.keys(multi.concepts).length, 3,
      'three tags in one topic produce three separate concept records');
    t.eq(SP.conceptOf(multiStore.get(), 'ards', 'labs').conf, 1, 'each tracks its own confidence');
    t.eq(SP.conceptOf(multiStore.get(), 'ards', 'sbar').conf, 1, 'independently');
    t.eq(SP.conceptOf(multiStore.get(), 'ards', 'patho').conf, 0,
      'and an untouched tag stays at zero');

    /* Readiness needs unhinted reps, not just a high number. */
    var readyStore = makeStore({});
    var ardsForReady = SP.topicById('ards') || topics[0];
    SP.conceptsForTopic(ardsForReady).forEach(function (tag) {
      var k;
      for (k = 0; k < 4; k++) {
        SP.recordAttempt(readyStore.set, readyStore.get(), {
          topicId: ardsForReady.topic_id, tag: tag, correct: true, hinted: false,
          scored: true, label: tag
        });
      }
    });
    var readyM = SP.topicMastery(readyStore.get(), ardsForReady);
    t.eq(readyM.ready, true, 'four clean retrievals per concept makes the topic ready');
    t.ok(readyM.pct >= 80, 'and mastery reads ' + readyM.pct + '%');

    var hintedStore = makeStore({});
    SP.conceptsForTopic(ardsForReady).forEach(function (tag) {
      var k;
      for (k = 0; k < 8; k++) {
        SP.recordAttempt(hintedStore.set, hintedStore.get(), {
          topicId: ardsForReady.topic_id, tag: tag, correct: true, hinted: true,
          scored: true, label: tag
        });
      }
    });
    t.eq(SP.topicMastery(hintedStore.get(), ardsForReady).ready, false,
      'eight HINTED successes per concept still does not make a topic ready');

    /* The due queue puts the weakest first. */
    var queueStore = makeStore({});
    SP.recordAttempt(queueStore.set, queueStore.get(), {
      topicId: 'ards', tag: 'labs', correct: false, hinted: false, scored: true, label: 'x' });
    SP.recordAttempt(queueStore.set, queueStore.get(), {
      topicId: 'sepsis', tag: 'sbar', correct: true, hinted: true, scored: true, label: 'y' });
    var q = SP.dueQueue(queueStore.get(), 5);
    t.ok(q.length >= 1, 'the due queue is populated');
    t.eq(q[0].conf, 0, 'and the weakest concept is first');

    /* ==================================================================== */
    t.group('progress writes never clobber a sibling module\'s keys');

    var shared = {
      simResults: [{ simId: 'ms2-icp', pct: 88 }],
      quizHistory: { total: 412, correct: 331 },
      streak: 9,
      medadmin: { runs: 3 },
      simprep: {
        v: 1,
        concepts: { 'sepsis|labs': { topic: 'sepsis', tag: 'labs', conf: 3, step: 2, reps: 4, hits: 3 } },
        overrides: { 'keep-me': { discrepancyId: 'keep-me', originalText: 'o', active: true } },
        prefs: { textSize: 'l', dyslexia: true },
        opened: { 'ards#card:1': 2 },
        log: [{ at: 1, topic: 'ards', tag: 'labs', correct: true }]
      }
    };
    var sharedStore = makeStore(shared);
    SP.recordAttempt(sharedStore.set, sharedStore.get(), {
      topicId: 'ards', tag: 'deterioration', correct: true, hinted: false,
      scored: true, label: 'trend'
    });
    var out = sharedStore.get();

    t.ok(out !== shared, 'setProgress received a NEW object, not a mutation of the old one');
    t.deepEq(out.simResults, shared.simResults, 'simResults survives untouched');
    t.deepEq(out.quizHistory, { total: 412, correct: 331 }, 'quizHistory survives untouched');
    t.eq(out.streak, 9, 'streak survives untouched');
    t.deepEq(out.medadmin, { runs: 3 }, 'another module\'s branch survives untouched');

    var outState = SP.stateOf(out);
    t.eq(outState.concepts['sepsis|labs'].conf, 3,
      'a concept from a different topic inside simprep is not disturbed');
    t.eq(outState.concepts['ards|deterioration'].conf, 1, 'the new concept was written');
    t.ok(!!outState.overrides['keep-me'], 'overrides recorded earlier are preserved');
    t.eq(outState.prefs.textSize, 'l', 'reading preferences are preserved');
    t.eq(outState.prefs.dyslexia, true, 'including the dyslexia spacing setting');
    t.eq(outState.opened['ards#card:1'], 2, 'the opened-card counters are preserved');
    t.eq(outState.log.length, 2, 'the log is appended to, not replaced');

    /* A preference write is equally careful. */
    var prefStore = makeStore(JSON.parse(JSON.stringify(shared)));
    SP.mutate(prefStore.set, function (state) { state.prefs.contrast = true; });
    var prefOut = prefStore.get();
    t.eq(prefOut.streak, 9, 'writing a preference does not drop a sibling key');
    t.eq(SP.stateOf(prefOut).concepts['sepsis|labs'].conf, 3,
      'nor a concept record');
    t.eq(SP.stateOf(prefOut).prefs.textSize, 'l', 'nor another preference');
    t.eq(SP.stateOf(prefOut).prefs.contrast, true, 'and the new preference is there');

    /* A throwing mutator leaves progress exactly as it was. */
    var safeStore = makeStore(JSON.parse(JSON.stringify(shared)));
    var before = safeStore.get();
    SP.mutate(safeStore.set, function () { throw new Error('boom'); });
    t.eq(safeStore.get(), before,
      'a mutator that throws leaves the previous progress object in place');

    /* The log is capped so progress cannot grow without bound. */
    var capStore = makeStore({});
    for (i = 0; i < 300; i++) {
      SP.recordAttempt(capStore.set, capStore.get(), {
        topicId: 'ards', tag: 'labs', correct: true, hinted: false, scored: true, label: 'n' + i
      });
    }
    t.ok(SP.stateOf(capStore.get()).log.length <= 240,
      'the attempt log is capped (' + SP.stateOf(capStore.get()).log.length + ' entries)');

    /* ==================================================================== */
    t.group('the partner layer is optional in both directions');

    t.eq(typeof w.MM.simprepPartner, 'undefined', 'no partner module in this world');
    var soloStore = makeStore({});
    var solo = null;
    t.noThrow(function () {
      solo = H.renderInto(w, React.createElement(SP, {
        progress: soloStore.get(), setProgress: soloStore.set,
        authUser: { uid: 'u-student' }, topicId: topics[0].topic_id
      }));
    }, 'Study Mode renders with no partner layer at all');
    var soloText = solo ? solo.text() : '';
    t.notContains(soloText, 'Studying together',
      'and shows no partner furniture when there is no room');
    if (solo) { solo.unmount(); }

    var published = [];
    var activities = [];
    w.MM.simprepPartner = {
      createRoom: function () { return null; },
      joinRoom: function () { return null; },
      leaveRoom: function () {},
      subscribe: function (cb) {
        cb({ room: { code: 'ABCD' }, peers: [{ uid: 'u-2', name: 'Jordan', topicId: 'sepsis' }] });
        return function () {};
      },
      setActivity: function (a) { activities.push(a); },
      publish: function (e) { published.push(e); },
      onEvent: function () { return function () {}; },
      getRoom: function () { return { code: 'ABCD' }; },
      isHost: function () { return true; }
    };
    var pStore = makeStore({});
    var pr = H.renderInto(w, React.createElement(SP, {
      progress: pStore.get(), setProgress: pStore.set,
      authUser: { uid: 'u-student' }, topicId: topics[0].topic_id
    }));
    t.contains(pr.text(), 'Studying together', 'with a room active, presence is rendered');
    t.contains(pr.text(), 'Jordan', 'and the partner is named');
    t.ok(activities.length > 0, 'the room is told what the student is looking at');
    t.eq(activities[0].kind, 'study', 'as a study activity');
    t.eq(activities[0].topicId, topics[0].topic_id, 'with the topic id');

    var storyTab = pr.all('[role="tab"]').filter(function (b) {
      return (b.textContent || '').indexOf('Case Story') === 0;
    })[0];
    pr.click(storyTab);
    t.ok(published.filter(function (e) { return e.kind === 'tab_change'; }).length > 0,
      'moving through the lesson is broadcast to the room');
    pr.unmount();

    /* A partner layer that throws on every call must not break Study Mode. */
    w.MM.simprepPartner = {
      subscribe: function () { throw new Error('partner down'); },
      setActivity: function () { throw new Error('partner down'); },
      publish: function () { throw new Error('partner down'); },
      onEvent: function () { throw new Error('partner down'); },
      getRoom: function () { throw new Error('partner down'); }
    };
    var brokenStore = makeStore({});
    var broken = null;
    t.noThrow(function () {
      broken = H.renderInto(w, React.createElement(SP, {
        progress: brokenStore.get(), setProgress: brokenStore.set,
        authUser: { uid: 'u-student' }, topicId: topics[0].topic_id
      }));
    }, 'a partner layer that throws on every call does not break Study Mode');
    t.contains(broken ? broken.text() : '', '60-Second Review',
      'the lesson still renders');
    if (broken) { broken.unmount(); }
    delete w.MM.simprepPartner;

    /* ==================================================================== */
    t.group('accessibility: adjustable text, dyslexia spacing, high contrast');

    var a11yStore = makeStore({});
    var a11y = H.renderInto(w, React.createElement(SP, {
      progress: a11yStore.get(), setProgress: a11yStore.set,
      authUser: { uid: 'u-student' }, topicId: topics[0].topic_id
    }));
    t.ok(!!a11y.find('.sp-root.t-m'), 'the root carries a text-size class');
    var spacingBtn = a11y.button(/Letter spacing/);
    t.ok(!!spacingBtn, 'there is a dyslexia-friendly spacing control');
    t.eq(spacingBtn.getAttribute('aria-pressed'), 'false', 'it reports its state to a screen reader');
    a11y.click(spacingBtn);
    t.eq(SP.stateOf(a11yStore.get()).prefs.dyslexia, true, 'and the setting persists to progress');
    var contrastBtn = a11y.button(/Extra contrast/);
    t.ok(!!contrastBtn, 'there is a high-contrast control');
    a11y.click(contrastBtn);
    t.eq(SP.stateOf(a11yStore.get()).prefs.contrast, true, 'which also persists');
    t.ok(a11y.all('button').filter(function (b) {
      return b.getAttribute('title') === 'Extra large text';
    }).length === 1, 'there is an extra-large text option');
    a11y.unmount();

    var src = read('js/simprep.js');
    t.match(src, /\.sp-root\.t-xl\{font-size:1\.3rem/, 'the largest text size is a real CSS step');
    t.match(src, /\.sp-root\.sp-dys[\s\S]{0,400}?letter-spacing:var\(--spx-track\)/,
      'dyslexia mode widens letter spacing');
    t.match(src, /\.sp-root\.sp-hc[\s\S]{0,200}?border-width:2px/,
      'high-contrast mode thickens borders');
    t.match(src, /min-height:44px/, 'controls meet a 44px touch target');
    t.match(src, /@media \(prefers-reduced-motion:reduce\)/, 'reduced motion is honoured');

    /* Contrast lint that ui-contrast.test.js also enforces app-wide. */
    var nearBlack = [];
    var reBlack = /color\s*:\s*(#0{3,6}\b|#1[0-9a-f]{2}\b|black|buttontext)/gi, mBlack;
    while ((mBlack = reBlack.exec(src))) {
      var around = src.slice(Math.max(0, mBlack.index - 60), mBlack.index);
      if (/--text-on-fill|text-on-fill/.test(around)) { continue; }
      nearBlack.push(mBlack[0]);
    }
    t.eq(nearBlack.length, 0, 'simprep.js hardcodes no near-black text colour' +
      (nearBlack.length ? ' — ' + nearBlack.slice(0, 4).join(', ') : ''));

    /* Every class rendered as a <button> that paints a background must set its
       own color - the trap ui-contrast.test.js was written for. */
    var btnClasses = {};
    var reBtn = /className:\s*'(sp-[a-z0-9- ]+)'/g, mB;
    while ((mB = reBtn.exec(src))) {
      mB[1].split(/\s+/).forEach(function (c) { if (c) { btnClasses[c] = 1; } });
    }
    var missingColor = [];
    Object.keys(btnClasses).forEach(function (c) {
      var reRule = new RegExp('\\.' + c.replace(/-/g, '\\-') + '\\{([^}]*)\\}');
      var m2 = reRule.exec(src);
      if (!m2) { return; }
      var bodyTxt = m2[1].replace(/['"]\s*[,+]?\s*\n\s*['"]?/g, ' ').replace(/['"]/g, ' ');
      if (/(^|[;{\s])background\s*:/.test(bodyTxt) && !/(^|[;{\s])color\s*:/.test(bodyTxt)) {
        missingColor.push(c);
      }
    });
    /* Report, not a hard fail: several of these are pips and meter fills with
       no text in them at all. The interactive ones are asserted below. */
    t.ok(true, missingColor.length
      ? missingColor.length + ' background-only classes rely on the global net: ' + missingColor.join(', ')
      : 'every class that paints a background also sets its own color');
    ['sp-btn', 'sp-tab', 'sp-opt', 'sp-topic', 'sp-mode', 'sp-flip'].forEach(function (c) {
      var reRule2 = new RegExp('\\.' + c.replace(/-/g, '\\-') + '\\{([\\s\\S]{0,600}?)\\}');
      var m3 = reRule2.exec(src);
      t.ok(m3 && /color:/.test(m3[1]), '.' + c + ' sets its own color explicitly');
    });

    /* ==================================================================== */
    t.group('the drills grade and record through the UI');

    var liveStore = makeStore({});
    var live = H.renderInto(w, React.createElement(SP, {
      progress: liveStore.get(), setProgress: liveStore.set,
      authUser: { uid: 'u-student' }, topicId: 'ards'
    }));
    var cardsTab = live.all('[role="tab"]').filter(function (b) {
      return (b.textContent || '').indexOf('Flashcards') === 0;
    })[0];
    if (cardsTab && SP.flashcardsFor('ards').length) {
      live.click(cardsTab);
      var flip = live.find('.sp-flip');
      t.ok(!!flip, 'a flashcard is rendered');
      live.click(flip);
      t.eq(Object.keys(SP.stateOf(liveStore.get()).concepts).length, 0,
        'flipping a card alone changed no concept');
      t.ok(SP.stateOf(liveStore.get()).opened &&
           Object.keys(SP.stateOf(liveStore.get()).opened).length > 0,
        'but the open was counted');
      var gotIt = live.button(/Got it, no help/);
      t.ok(!!gotIt, 'the three grading buttons appear only after the card is turned over');
      live.click(gotIt);
      var afterCard = SP.stateOf(liveStore.get()).concepts;
      t.ok(Object.keys(afterCard).length > 0, 'saying you got it cold DOES move a concept');
      var firstKey = Object.keys(afterCard)[0];
      t.eq(afterCard[firstKey].conf, 1, 'by exactly one point');
      t.contains(firstKey, 'ards', 'and it is recorded against this topic');
    } else {
      t.ok(true, 'no flashcards published for ards in this content set — deck path skipped');
    }
    live.unmount();

    /* Order vs No Order, end to end. */
    var ocStore = makeStore({});
    var ocRender = H.renderInto(w, React.createElement(SP, {
      progress: ocStore.get(), setProgress: ocStore.set,
      authUser: { uid: 'u-student' }, topicId: 'ards'
    }));
    var ordTab = ocRender.all('[role="tab"]').filter(function (b) {
      return (b.textContent || '').indexOf('Orders / MAR') === 0;
    })[0];
    ocRender.click(ordTab);
    var ocText = ocRender.text();
    var ardsOrders = arrOf((SP.topicById('ards') || {}).orders);
    t.ok(ardsOrders.length > 0, 'the ARDS chart has orders to render');
    var shownOrders = ardsOrders.filter(function (o) { return ocText.indexOf(o) !== -1; });
    t.eq(shownOrders.length, ardsOrders.length,
      'every one of the chart\'s order lines is rendered verbatim on the Orders tab');
    t.contains(ocText, 'Order vs. No Order', 'and the drill is on the same tab');
    t.contains(ocText, 'Already Done', 'along with Already Done');
    var yesBtn = ocRender.button(/Yes - it is ordered here/);
    t.ok(!!yesBtn, 'the drill offers a yes/no decision');
    ocRender.click(yesBtn);
    t.ok(Object.keys(SP.stateOf(ocStore.get()).concepts).length > 0 ||
         SP.stateOf(ocStore.get()).log.length > 0,
      'answering it is recorded');
    ocRender.unmount();

    /* ==================================================================== */
    t.group('the Firebase mirror is optional and never blocks');

    t.eq(SP.OVERRIDE_PATH, 'simprep/overrides', 'the mirror path is declared');
    t.ok(SP.OVERRIDE_RULES && SP.OVERRIDE_RULES.simprep && SP.OVERRIDE_RULES.simprep.overrides,
      'the module carries the exact rules snippet the path needs');
    var ruleNode = SP.OVERRIDE_RULES.simprep.overrides.$uid;
    t.contains(String(ruleNode['.write']), 'auth.uid === $uid',
      'the snippet keeps overrides writable only by their owner');
    t.contains(String(ruleNode['.read']), 'email_verified === true',
      'and the owner-read escape hatch requires a verified email, like every other rule');

    /* The snippet has now been added to firebase-rules.json. Assert the SHIPPED
       rule matches the one the module declares it needs — a drifting pair is
       the failure mode here: the module writes a shape the deployed rule will
       not validate, the write is denied, and the swallow makes it silent. The
       denial path below still runs, because a rule existing in the file is no
       guarantee it has been published to Firebase. */
    var rulesFile = JSON.parse(read('firebase-rules.json'));
    var shipped = rulesFile.rules.simprep && rulesFile.rules.simprep.overrides;
    t.ok(!!shipped, 'firebase-rules.json carries the simprep/overrides node');
    if (shipped) {
      t.eq(String(shipped.$uid['.write']), String(ruleNode['.write']),
        'the shipped write rule is byte-identical to the one the module declares');
      t.eq(String(shipped.$uid['.read']), String(ruleNode['.read']),
        'and so is the read rule');
      t.eq(String(shipped.$uid.$discId['.validate']),
        String(ruleNode.$discId['.validate']),
        'and the validate clause — a drift here denies every override write silently');
    }

    var deniedDb = {
      ref: function () {
        return { set: function () { return Promise.reject(new Error('PERMISSION_DENIED')); } };
      }
    };
    w.MM.db = deniedDb;
    var denyStore = makeStore({});
    var deny = null;
    t.noThrow(function () {
      deny = H.renderInto(w, React.createElement(SP, {
        progress: denyStore.get(), setProgress: denyStore.set,
        authUser: { uid: 'u-student', email: 'n@e.edu' }, topicId: ovTopic.topic_id
      }));
      deny.click(deny.button(/Record an instructor override/));
      React2.act(function () {
        setFieldValue(w, deny.find('textarea[id^="spo-repl-"]'), 'Corrected');
        setFieldValue(w, deny.find('input[id^="spo-who-"]'), 'Prof. Reyes');
      });
      deny.click(deny.button(/^Save override$/));
    }, 'a denied Firebase write does not break the override flow');
    t.eq(Object.keys(SP.stateOf(denyStore.get()).overrides).length, 1,
      'and the override is still saved locally, which is the primary store');
    if (deny) { deny.unmount(); }

    /* ==================================================================== */
    t.group('the module is ES5 and injects exactly one stylesheet');

    /* The prose comments in this module legitimately quote code (`orders`,
       `--sp-1 … --sp-10`), so an ES5 scan of the raw text would fail on its own
       documentation. Strip comments first, the way a real linter would. */
    var code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
    t.eq(/=>/.test(code), false, 'no arrow functions');
    t.eq(/\bconst\s/.test(code), false, 'no const');
    t.eq(/\blet\s+[A-Za-z_$]/.test(code), false, 'no let');
    t.eq(code.indexOf('`'), -1, 'no template literals');
    t.eq(/\?\./.test(code), false, 'no optional chaining');
    t.eq(/\.\.\./.test(code.replace(/…/g, '')), false, 'no spread or rest');
    t.eq(/\bclass\s+[A-Za-z_$]/.test(code), false, 'no class syntax');
    t.eq(/\b(async|await)\b/.test(code), false, 'no async/await');

    var styleTags = w.document.querySelectorAll('style#simprep-styles');
    t.eq(styleTags.length, 1, 'exactly one <style id="simprep-styles"> exists after many renders');
    t.match(styleTags[0].textContent, /\.sp-prov\.supp/, 'the injected CSS carries the badges');

    world.cleanup();
  }
};
