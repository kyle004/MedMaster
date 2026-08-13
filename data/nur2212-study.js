/* nur2212-study.js - NUR2212 simulation study bank (flashcards, quizzes, playbook)
 * Source: New stuff/Nur2212_SIM_STUDY/NUR2212_Sim_Study_App_Pack/
 *   question_banks/flashcards.json                  (108, verbatim)
 *   question_banks/quizzes.json                     (36, verbatim)
 *   ai_build/SCORING_RUBRIC.json                    (verbatim)
 *   ai_build/SOURCE_RULES.md                        (8 rules, verbatim)
 *   reference/SOURCE_DISCREPANCIES_TO_VERIFY.md     (mapped to topic_id)
 *   reference/WEB_SOURCES.md + topic reference lists (webSources)
 *   02_SKILLS_TEST_CHECKOFF_PLAYBOOK.docx           (playbook)
 *
 * Educational simulation / checkoff practice only. VERBATIM CONTENT.
 * Flashcards/quizzes carry their own provenance ("school" vs "supplemental").
 *
 * Globals: window.NUR2212_STUDY
 * ES5 only - no build step.
 */
window.NUR2212_STUDY = {
  version: '1.0',
  flashcards: [
    {
      topic_id: 'upper_gi_bleed',
      front: 'What is the immediate framework?',
      back: 'ABCs with special attention to airway protection and circulation.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'upper_gi_bleed',
      front: 'Which lab is the biggest bleeding red flag?',
      back: 'Hgb 6.8 g/dL, with Hct 21% and active hematemesis.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'upper_gi_bleed',
      front: 'What is the shock type?',
      back: 'Hypovolemic shock from acute blood loss.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'upper_gi_bleed',
      front: 'What does melena suggest?',
      back: 'Digested blood, commonly from an upper GI source.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'upper_gi_bleed',
      front: 'At 1100, has blood already started?',
      back: 'Yes. The MAR says PRBC transfusion initiated at 1030.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'upper_gi_bleed',
      front: 'What is this simulation mainly testing?',
      back: 'Recognize an acute upper GI hemorrhage, protect the airway during hematemesis, identify hypovolemia, stabilize circulation, monitor an active PRBC transfusion, and escalate deterioration quickly.',
      tag: 'simulation_goal',
      provenance: 'school'
    },
    {
      topic_id: 'upper_gi_bleed',
      front: 'Name three immediate findings to recognize.',
      back: 'Bright-red hematemesis; History of melena; Pale and diaphoretic',
      tag: 'assessment',
      provenance: 'school'
    },
    {
      topic_id: 'upper_gi_bleed',
      front: 'Name two deterioration cues.',
      back: 'Increasing hematemesis; Falling BP/MAP',
      tag: 'deterioration',
      provenance: 'school'
    },
    {
      topic_id: 'upper_gi_bleed',
      front: 'What is the memory hook?',
      back: 'BLEED: Breathing/airway, Look for shock, Establish circulation, Erythrocytes/blood, Deterioration monitoring.',
      tag: 'mnemonic',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      front: 'What neurologic finding is classic in this case?',
      back: 'Asterixis with lethargy/delayed responses.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      front: 'Which lab connects most directly to encephalopathy?',
      back: 'Ammonia 118 on the school sheet.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      front: 'Why is INR 2.8 important?',
      back: 'It signals impaired coagulation and bleeding risk.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      front: 'Which safety precautions are ordered?',
      back: 'Fall and seizure precautions.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      front: 'When should the provider be notified?',
      back: 'For worsening neurologic status.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      front: 'What is this simulation mainly testing?',
      back: 'Recognize acute liver failure, worsening hepatic encephalopathy, coagulopathy, and neurologic deterioration; implement safety precautions and ordered therapies; escalate for worsening neurologic status.',
      tag: 'simulation_goal',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      front: 'Name three immediate findings to recognize.',
      back: 'Lethargy and delayed responses; Asterixis; Jaundice',
      tag: 'assessment',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      front: 'Name two deterioration cues.',
      back: 'Progressive somnolence or inability to arouse; Falling GCS/new disorientation',
      tag: 'deterioration',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      front: 'What is the memory hook?',
      back: 'LIVER: Lethargy, INR rises, Very high AST/ALT, Elevated ammonia, Risk of bleeding/brain edema.',
      tag: 'mnemonic',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      front: 'What ABG pattern is present?',
      back: 'Alkalemia with low PaCO2 and severe hypoxemia: pH 7.48, PaCO2 31, PaO2 58.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      front: 'What chest X-ray finding matters?',
      back: 'Bilateral diffuse infiltrates.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      front: 'Which assessment cue shows severe distress?',
      back: 'Accessory use and inability to speak complete sentences.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      front: 'What position is ordered?',
      back: 'High Fowler\'s.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      front: 'What is the key next move if oxygenation keeps worsening?',
      back: 'Escalate/RRT and prepare higher-level respiratory support.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      front: 'What is this simulation mainly testing?',
      back: 'Recognize severe hypoxemia and respiratory deterioration from pneumonia, interpret the ABG/chest X-ray, escalate oxygen/respiratory support, and prevent respiratory arrest.',
      tag: 'simulation_goal',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      front: 'Name three immediate findings to recognize.',
      back: 'Severe dyspnea; RR 30 at 1000; Accessory muscle use',
      tag: 'assessment',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      front: 'Name two deterioration cues.',
      back: 'SpO2 continues to fall; Increasing oxygen requirement',
      tag: 'deterioration',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      front: 'What is the memory hook?',
      back: 'ARDS: Air is not exchanging, RR rises, Diffuse infiltrates, Saturation stays low.',
      tag: 'mnemonic',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      front: 'What happens to fibrinogen in this case?',
      back: 'It is low: 90.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      front: 'What happens to D-dimer?',
      back: 'It is very high: 5000.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      front: 'What platelet count is given?',
      back: '48,000.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      front: 'What organ-perfusion clue is present?',
      back: 'Urine output <30 mL/hr with elevated creatinine and lactate.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      front: 'Why can DIC bleed and clot at the same time?',
      back: 'Widespread clotting consumes platelets/factors while microthrombi impair perfusion and fibrinolysis contributes to bleeding.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      front: 'What is this simulation mainly testing?',
      back: 'Recognize simultaneous pathologic clotting and bleeding in a septic patient, interpret coagulation/fibrinogen/D-dimer trends, protect from bleeding, maintain perfusion, and escalate organ dysfunction.',
      tag: 'simulation_goal',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      front: 'Name three immediate findings to recognize.',
      back: 'Petechiae on chest and arms; Ecchymosis; Oozing from IV insertion site',
      tag: 'assessment',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      front: 'Name two deterioration cues.',
      back: 'Increasing bleeding or new sites; Falling BP/rising HR',
      tag: 'deterioration',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      front: 'What is the memory hook?',
      back: 'DIC = Does both: Inappropriate Clotting + bleeding. Think platelets/fibrinogen DOWN; PT/aPTT/D-dimer UP.',
      tag: 'mnemonic',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      front: 'Which biomarker is most striking?',
      back: 'BNP 1,250.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      front: 'What finding suggests pulmonary congestion?',
      back: 'Bilateral basal crackles with dyspnea/orthopnea.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      front: 'What findings suggest systemic venous congestion?',
      back: 'JVD and +2 leg edema.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      front: 'What is the room-air SpO2?',
      back: '91%.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      front: 'Should you give furosemide automatically?',
      back: 'No. There is no furosemide order in the provided case.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      front: 'What is this simulation mainly testing?',
      back: 'Recognize acute heart-failure fluid overload, assess oxygenation and perfusion, interpret BNP and cardiopulmonary findings, implement existing orders, and escalate pulmonary edema/low-output deterioration.',
      tag: 'simulation_goal',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      front: 'Name three immediate findings to recognize.',
      back: 'Mild-moderate dyspnea; Crackles at both lung bases; SpO2 91% on room air',
      tag: 'assessment',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      front: 'Name two deterioration cues.',
      back: 'Increasing crackles/dyspnea; Falling SpO2 despite oxygen',
      tag: 'deterioration',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      front: 'What is the memory hook?',
      back: 'FAILURE: Fluid accumulates, Air hunger/orthopnea, Increased BNP, Lung crackles, Urine/I&O, Right-sided edema/JVD, Escalate.',
      tag: 'mnemonic',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      front: 'What is the most important trend?',
      back: 'Neurologic trend, especially GCS/LOC and pupils.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      front: 'What CT finding is present?',
      back: 'Cerebral edema with increasing midline shift.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      front: 'What position is ordered?',
      back: 'Head of bed 30 degrees.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      front: 'What is Cushing triad?',
      back: 'A late deterioration pattern: hypertension/widened pulse pressure, bradycardia, and irregular respirations.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      front: 'What order should be flagged for instructor verification?',
      back: 'The written SpO2 <95% target.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      front: 'What is this simulation mainly testing?',
      back: 'Detect subtle neurologic deterioration after traumatic brain injury, trend GCS/pupils/motor findings, maintain ICP precautions, review CT findings, and escalate before herniation.',
      tag: 'simulation_goal',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      front: 'Name three immediate findings to recognize.',
      back: 'Headache; Mild confusion/drowsiness; GCS decline noted',
      tag: 'assessment',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      front: 'Name two deterioration cues.',
      back: 'Decreasing GCS/LOC; New pupil asymmetry or sluggish/nonreactive pupils',
      tag: 'deterioration',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      front: 'What is the memory hook?',
      back: 'ICP: Inspect GCS/pupils, Cranial pressure rising, Position HOB 30, Prevent secondary injury.',
      tag: 'mnemonic',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      front: 'What imaging confirms the PE?',
      back: 'CT angiography.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      front: 'What ABG pattern is present?',
      back: 'Respiratory alkalemia with hypoxemia: pH 7.48, PaCO2 30, PaO2 60.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      front: 'What anticoagulant is ordered?',
      back: 'Heparin bolus and infusion per protocol.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      front: 'What shock type can a massive PE cause?',
      back: 'Obstructive shock.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      front: 'What side is the Doppler-proven DVT?',
      back: 'Left lower extremity, despite a conflicting right-calf exam note.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      front: 'What is this simulation mainly testing?',
      back: 'Recognize sudden PE after orthopedic surgery, interpret ABG/CTA/Doppler findings, support oxygenation, implement anticoagulation orders, and detect progression to obstructive shock.',
      tag: 'simulation_goal',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      front: 'Name three immediate findings to recognize.',
      back: 'Sudden dyspnea; Pleuritic chest pain; Anxiety/restlessness',
      tag: 'assessment',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      front: 'Name two deterioration cues.',
      back: 'Sudden worsening hypoxemia; Hypotension/falling MAP',
      tag: 'deterioration',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      front: 'What is the memory hook?',
      back: 'PE = Post-op + Pleuritic pain + Poor oxygenation + Pulmonary artery clot.',
      tag: 'mnemonic',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      front: 'What is the lactate?',
      back: '4.6.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      front: 'What organ dysfunction is present?',
      back: 'Altered mental status and kidney injury (creatinine 2.0), with worsening oxygenation.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      front: 'What school threshold triggers provider notification?',
      back: 'MAP <65 mm Hg.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      front: 'What is the infectious source?',
      back: 'Community-acquired pneumonia.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      front: 'What antibiotics are ordered?',
      back: 'Cefepime and vancomycin.',
      tag: 'rapid_recall',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      front: 'What is this simulation mainly testing?',
      back: 'Recognize infection plus organ dysfunction and impaired perfusion, trend vitals/lactate/renal function, implement ordered oxygen/antibiotics/fluids, and escalate progression toward septic shock.',
      tag: 'simulation_goal',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      front: 'Name three immediate findings to recognize.',
      back: 'Confusion/lethargy/difficulty focusing; Tachypnea and shortness of breath; Tachycardia',
      tag: 'assessment',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      front: 'Name two deterioration cues.',
      back: 'MAP <65 or falling BP; Worsening confusion/lethargy',
      tag: 'deterioration',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      front: 'What is the memory hook?',
      back: 'SEPSIS: Source infection, Elevated lactate, Perfusion falling, Systems/organs changing, Immediate treatment, Shock watch.',
      tag: 'mnemonic',
      provenance: 'school'
    },
    {
      topic_id: 'pneumonia',
      front: 'What is pneumonia at the tissue level?',
      back: 'An infection/inflammatory process involving lung tissue and alveoli that can impair gas exchange.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'pneumonia',
      front: 'What common test visualizes an infiltrate?',
      back: 'Chest X-ray.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'pneumonia',
      front: 'What bedside measurement directly tracks oxygenation?',
      back: 'Pulse oximetry.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'pneumonia',
      front: 'What two school topics can severe pneumonia progress into?',
      back: 'Sepsis and ARDS/acute respiratory failure.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'pneumonia',
      front: 'What should the app do with antibiotic choices?',
      back: 'Use the scenario/provider order; do not hard-code one universal regimen.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'pneumonia',
      front: 'What is this simulation mainly testing?',
      back: 'Practice focused respiratory assessment, oxygenation, diagnostics, medication safety, secretion management, and early recognition of deterioration toward sepsis or acute respiratory failure.',
      tag: 'simulation_goal',
      provenance: 'supplemental'
    },
    {
      topic_id: 'pneumonia',
      front: 'Name three immediate findings to recognize.',
      back: 'Cough with or without sputum; Fever/chills; Shortness of breath',
      tag: 'assessment',
      provenance: 'supplemental'
    },
    {
      topic_id: 'pneumonia',
      front: 'Name two deterioration cues.',
      back: 'SpO2 falling/rising oxygen requirement; Increasing RR/accessory-muscle use',
      tag: 'deterioration',
      provenance: 'supplemental'
    },
    {
      topic_id: 'pneumonia',
      front: 'What is the memory hook?',
      back: 'PNEUMONIA: Productive cough, New infiltrate, Elevated temp/WBC, Uneasy breathing, Monitor oxygen, Organism-directed meds, Notify if worsening, Incentive/deep breathing as appropriate, Assess sepsis.',
      tag: 'mnemonic',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      front: 'What classic pain migration should you recognize?',
      back: 'Periumbilical pain migrating to the right lower quadrant.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      front: 'What complication is the main emergency concern?',
      back: 'Perforation leading to peritonitis/sepsis.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      front: 'What is the usual surgical treatment?',
      back: 'Appendectomy, commonly laparoscopic when surgery is selected.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      front: 'Can selected uncomplicated cases be managed without surgery?',
      back: 'Yes, some selected patients may be treated nonoperatively with antibiotics, but this is not universal.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      front: 'What status is commonly ordered while awaiting surgery?',
      back: 'NPO.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      front: 'What is this simulation mainly testing?',
      back: 'Recognize the classic and dangerous patterns of appendicitis, perform a focused abdominal assessment, maintain NPO/IV therapy as ordered, prepare for surgical evaluation, and detect rupture/peritonitis.',
      tag: 'simulation_goal',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      front: 'Name three immediate findings to recognize.',
      back: 'Pain often begins near the umbilicus and migrates to the RLQ; Anorexia; Nausea/vomiting',
      tag: 'assessment',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      front: 'Name two deterioration cues.',
      back: 'Diffuse or rapidly worsening abdominal pain; Rigid/board-like abdomen or generalized guarding',
      tag: 'deterioration',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      front: 'What is the memory hook?',
      back: 'APPENDIX: Around umbilicus -> Pain to RLQ, Poor appetite, Exam tenderness, Nausea, Danger if diffuse/rigid, Imaging, eXpedite surgical review.',
      tag: 'mnemonic',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      front: 'What comes first when the patient returns from surgery?',
      back: 'Airway, breathing, circulation, and level of consciousness.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      front: 'What pulmonary complication are mobility/deep breathing meant to help prevent?',
      back: 'Postoperative pulmonary complications such as atelectasis/pneumonia.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      front: 'What abdominal findings are concerning?',
      back: 'Worsening pain, rigidity/distention, persistent vomiting, or failure of bowel recovery with deterioration.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      front: 'What wound findings need escalation?',
      back: 'Increasing redness, swelling, purulent drainage, dehiscence, or significant bleeding.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      front: 'Are all appendectomy patients managed identically?',
      back: 'No. Laparoscopic vs open and uncomplicated vs perforated disease can change orders and recovery.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      front: 'What is this simulation mainly testing?',
      back: 'Practice immediate postoperative priorities after appendectomy: airway/breathing, pain, incision/drain assessment, infection/bleeding surveillance, mobility, pulmonary hygiene, bowel recovery, and discharge teaching.',
      tag: 'simulation_goal',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      front: 'Name three immediate findings to recognize.',
      back: 'Post-anesthesia drowsiness improving over time; Incisional pain/tenderness; Small laparoscopic incisions or an RLQ open incision',
      tag: 'assessment',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      front: 'Name two deterioration cues.',
      back: 'Increasing abdominal pain rather than gradual improvement; Fever/chills',
      tag: 'deterioration',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      front: 'What is the memory hook?',
      back: 'POST-APP: Pulmonary/ABCs, Observe incision, Symptoms/pain, Track bowel/urine, Ambulate, Prevent DVT/atelectasis, Patient teaching.',
      tag: 'mnemonic',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      front: 'What is the classic elimination clue?',
      back: 'Inability to pass flatus/stool, especially with distention and vomiting.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      front: 'What is the basic conservative-management triad in an ordered SBO plan?',
      back: 'NPO, decompression, and IV fluids/electrolyte support.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      front: 'What pain change is worrisome for ischemia?',
      back: 'Intermittent cramping becoming continuous severe pain.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      front: 'Why monitor urine output?',
      back: 'It helps assess dehydration/perfusion and kidney function.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      front: 'What complication requires urgent surgery?',
      back: 'Peritonitis, strangulation, bowel ischemia, or perforation.',
      tag: 'rapid_recall',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      front: 'What is this simulation mainly testing?',
      back: 'Recognize mechanical bowel obstruction, assess dehydration/aspiration/ischemia risk, implement NPO/NG decompression/IV-fluid orders, monitor electrolytes and output, and detect strangulation/perforation requiring urgent surgery.',
      tag: 'simulation_goal',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      front: 'Name three immediate findings to recognize.',
      back: 'Crampy/colicky abdominal pain; Abdominal distention; Nausea/vomiting',
      tag: 'assessment',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      front: 'Name two deterioration cues.',
      back: 'Pain becomes continuous/severe; Peritoneal signs/rigidity',
      tag: 'deterioration',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      front: 'What is the memory hook?',
      back: 'BLOCK: Belly distends, Lack of stool/flatus, Output/vomit, Crampy pain, Keep NPO/decompress; continuous pain + shock = complication.',
      tag: 'mnemonic',
      provenance: 'supplemental'
    }
  ],
  quizzes: [
    {
      topic_id: 'upper_gi_bleed',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'school'
    },
    {
      topic_id: 'upper_gi_bleed',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'upper_gi_bleed',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'Increasing hematemesis',
        'Falling BP/MAP',
        'Rising HR',
        'Worsening dizziness, confusion, or syncope'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'acute_liver_failure',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'Progressive somnolence or inability to arouse',
        'Falling GCS/new disorientation',
        'New seizure',
        'Pupil/motor changes'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'ards',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'SpO2 continues to fall',
        'Increasing oxygen requirement',
        'Worsening tachypnea/accessory use',
        'Exhaustion or decreased LOC'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'dic',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'Increasing bleeding or new sites',
        'Falling BP/rising HR',
        'Urine output <30 mL/hr or worsening renal labs',
        'Altered mental status'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'heart_failure',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'Increasing crackles/dyspnea',
        'Falling SpO2 despite oxygen',
        'Pink/frothy sputum or acute pulmonary edema',
        'New dysrhythmia'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'increased_icp',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'Decreasing GCS/LOC',
        'New pupil asymmetry or sluggish/nonreactive pupils',
        'New focal weakness/posturing',
        'Repeated vomiting/seizure'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'pulmonary_embolism',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'Sudden worsening hypoxemia',
        'Hypotension/falling MAP',
        'Marked tachycardia',
        'Syncope/altered mental status'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'sepsis',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'MAP <65 or falling BP',
        'Worsening confusion/lethargy',
        'SpO2 declining despite oxygen',
        'Increasing RR/work of breathing'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'school'
    },
    {
      topic_id: 'pneumonia',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'supplemental'
    },
    {
      topic_id: 'pneumonia',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'supplemental'
    },
    {
      topic_id: 'pneumonia',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'SpO2 falling/rising oxygen requirement',
        'Increasing RR/accessory-muscle use',
        'Confusion or lethargy',
        'Hypotension/tachycardia'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendicitis',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'Diffuse or rapidly worsening abdominal pain',
        'Rigid/board-like abdomen or generalized guarding',
        'High fever/tachycardia',
        'Hypotension'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'supplemental'
    },
    {
      topic_id: 'appendectomy',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'Increasing abdominal pain rather than gradual improvement',
        'Fever/chills',
        'Purulent or increasing wound drainage',
        'Rigid/distended abdomen'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      type: 'single_best_answer',
      question: 'Which action best matches the first-priority framework for this scenario?',
      choices: [
        'ABCs with a focused assessment and rapid recognition of deterioration',
        'Complete discharge teaching before reassessing vital signs',
        'Wait for all labs to normalize before acting',
        'Perform only a full routine head-to-toe before addressing instability'
      ],
      correct_index: 0,
      rationale: 'The simulation design emphasizes immediate focused assessment, ABC prioritization, and early recognition of deterioration.',
      difficulty: 'easy',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      type: 'ordering',
      question: 'Put the general simulation workflow in the best order.',
      items: [
        'Implement/verify active orders',
        'Immediate ABC/focused assessment',
        'Reassess response',
        'Verify identity/hand hygiene',
        'Escalate/communicate significant deterioration'
      ],
      correct_order: [3, 1, 0, 2, 4],
      rationale: 'Safety/identity precedes care; assess first, then act on active orders, reassess, and escalate/communicate as indicated.',
      difficulty: 'medium',
      provenance: 'supplemental'
    },
    {
      topic_id: 'bowel_obstruction',
      type: 'short_answer',
      question: 'State the most important deterioration cue(s) you would not ignore in this scenario.',
      accepted_answers: [
        'Pain becomes continuous/severe',
        'Peritoneal signs/rigidity',
        'Fever and marked tachycardia',
        'Hypotension/shock'
      ],
      rationale: 'Any of these cues should prompt reassessment and possible escalation.',
      difficulty: 'medium',
      provenance: 'supplemental'
    }
  ],
  rubric: {
    version: '1.0',
    total: 100,
    categories: [
      {
        id: 'safety',
        weight: 30,
        examples: [
          'hand hygiene',
          'two identifiers',
          'order verification',
          'blood/med safety',
          'fall/seizure/aspiration precautions as applicable'
        ]
      },
      {
        id: 'assessment_recognition',
        weight: 25,
        examples: [
          'ABCs',
          'focused assessment',
          'trend recognition',
          'critical lab/diagnostic recognition'
        ]
      },
      {
        id: 'prioritization_interventions',
        weight: 25,
        examples: [
          'prioritize immediate threat',
          'implement active orders',
          'appropriate escalation'
        ]
      },
      {
        id: 'communication',
        weight: 10,
        examples: ['SBAR', 'clear significant finding report']
      },
      {
        id: 'reassessment_documentation_education',
        weight: 10,
        examples: [
          'reassess after intervention',
          'document response',
          'appropriate patient education'
        ]
      }
    ],
    critical_safety_rule: 'Use large penalties for unsafe actions, but never declare an automatic course failure unless configured by the instructor.',
    source_discrepancy_rule: 'Do not score unresolved contradictory/likely-typo source facts.'
  },
  sourceRules: [
    'School-file facts outrank generic medical knowledge for **what this particular simulation chart says**.',
    'Do not silently repair a suspected typo. Show it in a `Source issue - verify with instructor` panel.',
    'Instructor overrides outrank the original school file but must preserve an audit trail.',
    'Supplemental evidence can explain concepts but cannot create a provider order inside a school scenario.',
    'When a school sheet says "per protocol" or "per facility policy," the app should teach the decision point and require the learner to follow that local policy; it should not fabricate a universal exact protocol.',
    'Medication administration in Simulation Mode requires an active order/MAR branch.',
    'All four requested extra topics (pneumonia, appendicitis, appendectomy, bowel obstruction) must show a `Supplemental` label until an official school sheet is imported.',
    'The Room/Checkoff mode is for simulated/mannequin practice, not real patient care.'
  ],
  discrepancies: [
    {
      topic_id: 'upper_gi_bleed',
      title: 'Upper GI Bleed With Progression Toward Hypovolemic Shock',
      items: [
        'The pantoprazole order repeats the phrase "80 mg IV bolus" before the infusion; verify the intended wording with the instructor.',
        'The file is labeled Student but page 1 also displays "Simulation Faculty Version."'
      ]
    },
    {
      topic_id: 'acute_liver_failure',
      title: 'Acute Liver Failure With Hepatic Encephalopathy',
      items: [
        'The diet is written "low fat, low protien" in the school sheet; keep the school wording visible but verify the intended diet with the instructor.',
        'The MAR shows an N-acetylcysteine bolus at 0930 and another 4.4 g infusion at 1500; do not use this sheet as a complete real-world NAC protocol.'
      ]
    },
    {
      topic_id: 'ards',
      title: 'Acute Respiratory Failure With Progression Toward ARDS',
      items: [
        'The topic header says "Faculty" even though the filename is Student.',
        'Ceftriaxone is written as "1 g IC" in the MAR; verify intended route with instructor.',
        'GFR is listed as 18 despite creatinine 1.2; treat that as a school-sheet inconsistency rather than silently correcting it.'
      ]
    },
    {
      topic_id: 'dic',
      title: 'Disseminated Intravascular Coagulation (DIC)',
      items: [
        'The activity instructions include preparation for blood products, but the listed provider orders do not actually contain a blood-product order.'
      ]
    },
    {
      topic_id: 'heart_failure',
      title: 'Acute Heart Failure Exacerbation',
      items: [
        'The topic header says "Faculty" although the filename says Student.',
        'The educational required-knowledge section discusses diuretics/vasodilators/ACE-I/ARBs/beta-blockers, but the case provider orders contain no medication order. Exam mode should respect the actual case orders.'
      ]
    },
    {
      topic_id: 'increased_icp',
      title: 'Increased Intracranial Pressure (ICP)',
      items: [
        'Provider order says "Maintain oxygen SpO2 <95%," which appears directionally inconsistent with usual oxygenation goals. Verify with instructor before using it for scoring.',
        'Mannitol is listed as "pending physician order" but the MAR records mannitol at 1000. The app must support an instructor correction/override.'
      ]
    },
    {
      topic_id: 'pulmonary_embolism',
      title: 'Pulmonary Embolism With Progression Toward Obstructive Shock',
      items: [
        'The Doppler identifies a left lower-extremity DVT, but the initial assessment lists right calf tenderness. Verify which side your instructor expects.',
        'The topic header says "Faculty" even though the filename says Student.'
      ]
    },
    {
      topic_id: 'sepsis',
      title: 'Sepsis With Progression Toward Septic Shock',
      items: [
        'The top of the school document incorrectly labels the topic as "Disseminated Intravascular Coagulation (Student)" even though the entire case is sepsis.',
        'The app should label the scenario Sepsis and preserve the mismatch in the source-notes panel rather than teaching DIC as the topic.'
      ]
    }
  ],
  playbook: {
    universalSequence: [
      {
        n: 1,
        label: 'Before entering',
        text: 'review diagnosis, allergies, code status, diet, orders, MAR, newest vitals/labs, and the trend.'
      },
      {
        n: 2,
        label: 'Enter safely',
        text: 'hand hygiene, introduce yourself, two identifiers, standard/ordered precautions, immediate safety scan.'
      },
      {
        n: 3,
        label: 'ABCs first',
        text: 'airway, breathing, circulation. If one is unstable, address/escalate it before a routine head-to-toe.'
      },
      {
        n: 4,
        label: 'Focused assessment',
        text: 'perform the exam that matches the problem (respiratory, neuro, GI, cardiovascular/perfusion, bleeding).'
      },
      {
        n: 5,
        label: 'Recognize the pattern',
        text: 'state the primary problem and the complication you are worried about.'
      },
      {
        n: 6,
        label: 'Implement only active orders / facility protocols',
        text: 'Check what has already been administered on the MAR.'
      },
      {
        n: 7,
        label: 'Reassess',
        text: 'vitals, symptoms, targeted physical findings, mental status, urine output, and response to therapy.'
      },
      {
        n: 8,
        label: 'Escalate',
        text: 'use SBAR when deterioration thresholds or clinical instability are present.'
      },
      {
        n: 9,
        label: 'Close the loop',
        text: 'safety, education as appropriate, documentation, and handoff/transfer.'
      }
    ],
    earnsPoints: [
      'You notice trends instead of reading one isolated number.',
      'You verbalize the dangerous complication you are watching for.',
      'You distinguish an order from a medication/intervention you merely expect to see.',
      'You reassess after oxygen, fluids, blood, medication, positioning, or escalation.',
      'Your SBAR includes the newest vitals, the key abnormal data, and a clear recommendation/request.',
      'You verbalize safety precautions that are actually relevant to the scenario.'
    ],
    crossTopicPatterns: [
      {
        pattern: 'Hypoxemia + pneumonia + bilateral diffuse infiltrates',
        think: 'ARDS / acute respiratory failure',
        differentiator: 'PaO2 very low, severe work of breathing, diffuse infiltrates'
      },
      {
        pattern: 'Hypoxemia + crackles + JVD/edema + high BNP',
        think: 'Heart failure',
        differentiator: 'Fluid overload/systemic venous congestion'
      },
      {
        pattern: 'Sudden dyspnea + pleuritic pain + post-op/DVT',
        think: 'Pulmonary embolism',
        differentiator: 'CTA/Doppler; obstructive-shock risk'
      },
      {
        pattern: 'Infection + falling BP + lactate/organ dysfunction',
        think: 'Sepsis',
        differentiator: 'Distributive shock physiology, renal/mental-status changes'
      },
      {
        pattern: 'Sepsis + bleeding + platelets/fibrinogen down + PT/aPTT/D-dimer up',
        think: 'DIC',
        differentiator: 'Consumption coagulopathy'
      },
      {
        pattern: 'Hematemesis/melena + low Hgb + falling BP',
        think: 'Upper GI bleed',
        differentiator: 'Hypovolemic blood-loss shock'
      },
      {
        pattern: 'Liver injury + confusion + asterixis + high ammonia/INR',
        think: 'Hepatic encephalopathy',
        differentiator: 'Neuro + coagulopathy + liver labs'
      },
      {
        pattern: 'TBI + falling GCS/pupil changes + edema/midline shift',
        think: 'Increased ICP',
        differentiator: 'Neuro trend outranks stable early vitals'
      },
      {
        pattern: 'Migrating RLQ pain + nausea/anorexia',
        think: 'Appendicitis',
        differentiator: 'Perforation if diffuse/rigid/systemically ill'
      },
      {
        pattern: 'Distention + vomiting + no flatus/stool',
        think: 'Bowel obstruction',
        differentiator: 'NG/NPO/fluids if ordered; ischemia if continuous pain/shock'
      }
    ],
    sbarFormula: [
      {
        letter: 'S',
        text: 'Who the patient is + what is happening right now + why you are calling.'
      },
      {
        letter: 'B',
        text: 'Diagnosis/history that matters + what changed + treatment already given.'
      },
      {
        letter: 'A',
        text: 'Current vitals, focused assessment, critical labs/diagnostics, and your concern.'
      },
      {
        letter: 'R',
        text: 'What you need: immediate evaluation, transfer/escalation, clarification, or next order.'
      }
    ],
    selfTalk: [
      '"What can kill the patient first?"',
      '"What changed from baseline?"',
      '"What has already been done?"',
      '"What active order can I safely carry out now?"',
      '"Did it work? I need to reassess."',
      '"Do I need to call the provider/RRT now?"'
    ],
    sourceRule: 'For the uploaded school cases, exact case facts and orders win over generic expectations. Several school sheets contain probable typos or contradictions; use the included discrepancy file and ask the instructor to resolve them before using those items for scoring.'
  },
  webSources: [
    {
      topic: 'Pneumonia',
      label: 'NHLBI Pneumonia',
      url: 'https://www.nhlbi.nih.gov/health/pneumonia'
    },
    {
      topic: 'Pneumonia',
      label: 'NHLBI Pneumonia Diagnosis',
      url: 'https://www.nhlbi.nih.gov/health/pneumonia/diagnosis'
    },
    {
      topic: 'Pneumonia',
      label: 'NHLBI Pneumonia Treatment',
      url: 'https://www.nhlbi.nih.gov/health/pneumonia/treatment'
    },
    {
      topic: 'Pneumonia',
      label: 'ATS/IDSA CAP Guideline',
      url: 'https://www.idsociety.org/practice-guideline/community-acquired-pneumonia-cap-in-adults/'
    },
    {
      topic: 'Appendicitis',
      label: 'WSES 2025 appendicitis guideline abstract (JAMA Surgery)',
      url: 'https://jamanetwork.com/journals/jamasurgery/article-abstract/2844195'
    },
    {
      topic: 'Appendicitis',
      label: 'American College of Surgeons Appendectomy',
      url: 'https://www.facs.org/for-patients/the-day-of-your-surgery/appendectomy/'
    },
    {
      topic: 'Appendectomy',
      label: 'American College of Surgeons Appendectomy',
      url: 'https://www.facs.org/for-patients/the-day-of-your-surgery/appendectomy/'
    },
    {
      topic: 'Appendectomy',
      label: 'MedlinePlus Appendectomy overview',
      url: 'https://medlineplus.gov/ency/article/002921.htm'
    },
    {
      topic: 'Bowel obstruction',
      label: 'WSES Bologna ASBO Guideline',
      url: 'https://link.springer.com/article/10.1186/s13017-018-0185-2'
    },
    {
      topic: 'Bowel obstruction',
      label: 'EAST Small-Bowel Obstruction Guideline',
      url: 'https://www.east.org/education-resources/practice-management-guidelines/details/smallbowel-obstruction-evaluation-and-management-of'
    },
    {
      topic: 'Bowel obstruction',
      label: 'MedlinePlus Intestinal Obstruction',
      url: 'https://medlineplus.gov/intestinalobstruction.html'
    },
    {
      topic: 'Sepsis current note',
      label: 'SCCM Surviving Sepsis Campaign Adult Guidelines (2026 page)',
      url: 'https://sccm.org/survivingsepsiscampaign/guidelines-and-resources/surviving-sepsis-campaign-adult-guidelines'
    }
  ]
};
