// Med-Surg 2 Simulation Scenarios - Batch B
// Source: NUR2212C Simulation Lab student packets
window.SCENARIOS_MS2B = [

  // ==========================================================================
  // 1. PULMONARY EMBOLISM
  // ==========================================================================
  {
    id: 'ms2-pulmonary-embolism',
    title: 'Pulmonary Embolism',
    fullTitle: 'Pulmonary Embolism with Progression to Obstructive Shock',
    category: 'Med-Surg 2',
    course: 'NUR2212C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'LUNG',
    summary: 'Postoperative day 3 total knee replacement patient develops sudden dyspnea, pleuritic chest pain, and hypoxemia from a large pulmonary artery embolus, progressing toward obstructive shock.',
    highYield: true,

    objectives: [
      'Describe the pathophysiology of pulmonary embolism',
      'Recognize risk factors for venous thromboembolism',
      'Recognize manifestations of pulmonary embolism',
      'Interpret D-dimer, ABGs, CT angiography, and Doppler ultrasound findings',
      'Recognize signs of respiratory distress and obstructive shock',
      'Perform focused cardiovascular, respiratory, neurological, and perfusion assessments',
      'Discuss anticoagulation therapy',
      'Utilize SBAR communication',
      'Recognize indications for Rapid Response Team activation',
      'Identify signs of patient deterioration requiring ICU transfer'
    ],

    patient: {
      name: 'Jane Smith',
      age: '72 years',
      dob: '06/26/1954',
      sex: 'Female',
      weightKg: 94,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Acute pulmonary embolism, postoperative day 3 left total knee replacement',
      history: [
        'Left total knee replacement, postoperative day 3',
        'Height 165 cm, weight 94 kg (obesity is a VTE risk factor)',
        'POD#1: ambulating with assistance',
        'POD#2: mild calf discomfort reported, increased swelling in operative leg',
        'Today 0922: sudden onset shortness of breath',
        'Today 1000: chest pain and hypoxemia develop',
        'Receiving enoxaparin 40 mg SQ VTE prophylaxis',
        'Med/surg unit, no isolation precautions, regular diet'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - Today 1000 (assuming care)',
        bp: '124/78', hr: 98, rr: 20, temp: '98.4 F', spo2: 95,
        pain: '5/10 pleuritic right chest',
        loc: 'Alert, anxious, restless',
        other: 'Pale, mild diaphoresis. LEFT calf tenderness and increased swelling of the operative leg; Doppler confirms LEFT lower extremity DVT. Reports dizziness.',
        flags: ['tachypnea', 'borderline-tachycardia', 'anxiety'],
        note: 'Documented trend: 0600 BP 128/80, HR 88, RR 18, Temp 98.4 F, SpO2 97%. By 1000 the HR, RR and SpO2 have all shifted in the wrong direction. Numbers still look near-normal, which is the trap - a large PE can present with only subtle vital sign changes plus profound anxiety and dyspnea.'
      },
      {
        atMin: 5,
        label: 'Worsening V/Q mismatch',
        bp: '108/70', hr: 118, rr: 28, temp: '98.6 F', spo2: 89,
        pain: '7/10 sharp, worse with deep breath',
        loc: 'Alert, increasingly anxious, sense of impending doom',
        other: 'Accessory muscle use, unable to speak full sentences, splinting right chest',
        flags: ['hypoxemia', 'tachycardia', 'tachypnea', 'increased-work-of-breathing'],
        note: 'Clot obstruction creates alveolar dead space - ventilated alveoli with no perfusion. SpO2 keeps dropping despite 2L nasal cannula because the problem is perfusion, not oxygen delivery. Hypoxemia refractory to supplemental oxygen is a hallmark of PE.'
      },
      {
        atMin: 10,
        label: 'Right ventricular strain / early obstructive shock',
        bp: '92/58', hr: 132, rr: 34, temp: '98.6 F', spo2: 85,
        pain: '8/10',
        loc: 'Restless, difficulty concentrating, answering in single words',
        other: 'Jugular venous distention, cool clammy extremities, capillary refill 4 seconds. On non-rebreather mask.',
        flags: ['hypotension', 'severe-hypoxemia', 'jvd', 'poor-perfusion'],
        note: 'Elevated troponin 0.12 and BNP 420 confirm right ventricular strain. The obstructed pulmonary artery raises RV afterload, the RV dilates and fails, LV preload falls, and cardiac output drops. This is obstructive shock - fluids alone will not fix it and excessive fluid can worsen RV failure.'
      },
      {
        atMin: 15,
        label: 'Cardiovascular collapse imminent',
        bp: '78/44', hr: 138, rr: 36, temp: '98.4 F', spo2: 80,
        pain: 'Unable to reliably report',
        loc: 'Lethargic, confused, difficult to arouse',
        other: 'Weak thready pulses, mottled skin, urine output less than 20 mL over the last hour',
        flags: ['critical', 'shock', 'altered-mental-status', 'hypoxemia'],
        note: 'MAP is now approximately 55 mmHg. Massive PE with hemodynamic instability - this patient meets criteria for Rapid Response Team activation, thrombolytic consideration, and ICU transfer. Without escalation the next rhythm is often pulseless electrical activity.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'WBC', value: '10.4', unit: 'K/uL', status: 'high', normalRange: '5-10', interpretation: 'Mild leukocytosis, nonspecific postoperative inflammatory response' },
      { panel: 'CBC', name: 'RBC', value: '4.5', unit: 'M/uL', status: 'normal', normalRange: '4.2-5.4', interpretation: 'Within normal limits; no evidence of blood loss' },
      { panel: 'CBC', name: 'Hemoglobin', value: '13.5', unit: 'g/dL', status: 'normal', normalRange: '12-16', interpretation: 'Normal - hypoxemia is not from anemia' },
      { panel: 'CBC', name: 'Hematocrit', value: '41', unit: '%', status: 'normal', normalRange: '37-47', interpretation: 'Normal' },
      { panel: 'CBC', name: 'Platelets', value: '285,000', unit: '/uL', status: 'normal', normalRange: '150,000-400,000', interpretation: 'Normal baseline - important before starting heparin; watch for HIT' },
      { panel: 'BMP', name: 'Sodium', value: '138', unit: 'mEq/L', status: 'normal', normalRange: '135-145', interpretation: 'Normal' },
      { panel: 'BMP', name: 'Potassium', value: '4.2', unit: 'mEq/L', status: 'normal', normalRange: '3.5-5.0', interpretation: 'Normal' },
      { panel: 'BMP', name: 'BUN', value: '18', unit: 'mg/dL', status: 'normal', normalRange: '10-20', interpretation: 'Normal' },
      { panel: 'BMP', name: 'Creatinine', value: '1.0', unit: 'mg/dL', status: 'normal', normalRange: '0.6-1.2', interpretation: 'Normal renal function - safe for CT angiography contrast' },
      { panel: 'BMP', name: 'Glucose', value: '108', unit: 'mg/dL', status: 'normal', normalRange: '70-110', interpretation: 'Normal' },
      { panel: 'Cardiac Markers', name: 'Troponin', value: '0.12', unit: 'ng/mL', status: 'high', normalRange: 'less than 0.04', interpretation: 'Elevated from right ventricular strain, not coronary occlusion; marker of higher-risk PE' },
      { panel: 'Cardiac Markers', name: 'BNP', value: '420', unit: 'pg/mL', status: 'high', normalRange: 'less than 100', interpretation: 'Ventricular stretch from acute RV pressure overload' },
      { panel: 'Coagulation', name: 'D-Dimer', value: '2.8', unit: 'mcg/mL FEU', status: 'critical-high', normalRange: 'less than 0.50', interpretation: 'Markedly elevated fibrin degradation products - highly sensitive but not specific; supports VTE' },
      { panel: 'ABG', name: 'pH', value: '7.48', unit: '', status: 'high', normalRange: '7.35-7.45', interpretation: 'Alkalemia from hyperventilation' },
      { panel: 'ABG', name: 'PaCO2', value: '30', unit: 'mmHg', status: 'low', normalRange: '35-45', interpretation: 'Blowing off CO2 - respiratory alkalosis' },
      { panel: 'ABG', name: 'PaO2', value: '60', unit: 'mmHg', status: 'critical-low', normalRange: '80-100', interpretation: 'Significant hypoxemia from V/Q mismatch and dead space ventilation' },
      { panel: 'ABG', name: 'HCO3', value: '22', unit: 'mEq/L', status: 'normal', normalRange: '22-26', interpretation: 'Normal - confirms an acute, uncompensated respiratory alkalosis' }
    ],

    diagnostics: [
      { name: 'CT Angiography (STAT)', finding: 'Large right pulmonary artery embolus consistent with acute pulmonary embolism', interpretation: 'Gold standard confirmation of PE; large central clot explains the hemodynamic compromise' },
      { name: 'Venous Doppler Ultrasound, Left Lower Extremity', finding: 'Left lower extremity deep vein thrombosis', interpretation: 'Identifies the embolic source; postoperative immobility of the operative leg allowed thrombus formation' }
    ],

    orders: [
      { text: 'Oxygen 2L nasal cannula to keep O2 greater than 95%', category: 'respiratory' },
      { text: 'Continuous pulse oximetry', category: 'monitoring' },
      { text: 'Continuous cardiac monitoring', category: 'monitoring' },
      { text: 'CT angiography STAT', category: 'imaging' },
      { text: 'Heparin bolus and infusion per protocol', category: 'medication' },
      { text: 'Notify provider for worsening respiratory status', category: 'monitoring' },
      { text: 'Prepare for thrombolytic therapy if ordered', category: 'medication' },
      { text: 'Venous Doppler ultrasound left lower extremity', category: 'imaging' },
      { text: 'ICU transfer if unstable', category: 'consult' }
    ],

    interventions: [
      { id: 'pe-1', order: 1, action: 'Receive and review the patient chart, including the postoperative day 3 status and the POD#2 note documenting calf discomfort and operative leg swelling', rationale: 'The chart already contains the VTE risk profile; recognizing it frames every finding that follows', category: 'assessment', critical: false, preventsDeterioration: false, atiPearl: 'Hand-off data is assessment data - read it before you walk in' },
      { id: 'pe-2', order: 3, action: 'Verify patient identity using two identifiers', rationale: 'National Patient Safety Goal; required before any assessment, medication, or procedure', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'pe-3', order: 2, action: 'Perform hand hygiene and apply standard precautions', rationale: 'Infection prevention baseline for every patient contact', category: 'intervention', critical: true, preventsDeterioration: false },
      { id: 'pe-4', order: 4, action: 'Perform a focused cardiopulmonary assessment: lung sounds, work of breathing, heart sounds, pulses, capillary refill, JVD, and bilateral calf inspection', rationale: 'Establishes severity of respiratory compromise and perfusion status and confirms the DVT source', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Sudden dyspnea plus pleuritic chest pain plus tachycardia in a postoperative patient equals PE until proven otherwise' },
      { id: 'pe-5', order: 5, action: 'Apply oxygen and raise the head of the bed to high Fowler position, titrating oxygen to keep SpO2 greater than 95%', rationale: 'Airway and breathing come first; upright positioning maximizes lung expansion and reduces work of breathing while oxygen supports the poorly perfused alveoli that remain functional', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'ABCs - oxygen and position before diagnostics' },
      { id: 'pe-6', order: 6, action: 'Review laboratory and diagnostic findings: D-dimer 2.8, troponin 0.12, BNP 420, ABG pH 7.48 / PaCO2 30 / PaO2 60, CT angiography, and venous Doppler', rationale: 'Confirms PE, quantifies hypoxemia, and identifies right ventricular strain that predicts deterioration', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'pe-7', order: 7, action: 'Recognize the manifestations of pulmonary embolism and identify signs of obstructive shock (falling BP, rising HR, JVD, cool clammy skin, altered mental status)', rationale: 'Recognition is the graded clinical judgment step; obstructive shock changes the plan from anticoagulation alone to thrombolysis and ICU care', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'pe-8', order: 8, action: 'Implement provider orders: continuous pulse oximetry, continuous cardiac monitoring, establish or verify IV access, and facilitate STAT CT angiography', rationale: 'Continuous monitoring detects the arrhythmias and desaturation that precede collapse; CT angiography confirms diagnosis so definitive therapy can start', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'pe-9', order: 9, action: 'Communicate findings to the provider using SBAR', rationale: 'Structured communication produces faster orders for heparin, thrombolytics, and ICU transfer', category: 'communication', critical: true, preventsDeterioration: true },
      { id: 'pe-10', order: 10, action: 'Prepare for and initiate anticoagulation: heparin bolus at 1015 followed by heparin infusion at 1020 per weight-based protocol, with baseline aPTT and platelet count', rationale: 'Heparin does not dissolve the existing clot but prevents propagation and new emboli while the body lyses the clot', category: 'medication', critical: true, preventsDeterioration: true, atiPearl: 'Heparin is monitored with aPTT and anti-Xa; the antidote is protamine sulfate' },
      { id: 'pe-11', order: 11, action: 'Escalate care: activate the Rapid Response Team, prepare for thrombolytic therapy if ordered, and facilitate ICU transfer', rationale: 'Hemodynamic instability defines massive PE; thrombolysis and ICU-level monitoring are the only interventions that reverse obstructive shock', category: 'escalation', critical: true, preventsDeterioration: true, atiPearl: 'Do not wait for a code - a Rapid Response is called for the patient who is about to code' },
      { id: 'pe-12', order: 12, action: 'Document assessments, interventions, and patient response; reassess vital signs and neurologic status continuously', rationale: 'Trending, not single values, reveals deterioration and supports continuity of care', category: 'intervention', critical: false, preventsDeterioration: false }
    ],

    medications: [
      { name: 'Heparin sodium', brand: 'Heparin', classification: 'Unfractionated anticoagulant (antithrombin activator)', dose: 'IV bolus at 1015 followed by continuous infusion at 1020, weight-based per protocol (94 kg)', action: 'Potentiates antithrombin III, inactivating thrombin and factor Xa to prevent clot propagation and new emboli; it does not dissolve the existing clot', onset: 'Immediate with IV bolus', sideEffects: ['Bleeding', 'Heparin-induced thrombocytopenia (HIT)', 'Hematoma at injection sites', 'Hyperkalemia'], nursingConsiderations: ['Obtain baseline aPTT, PT/INR, CBC with platelets before starting', 'Monitor aPTT or anti-Xa per protocol and titrate the infusion', 'Monitor platelets - a drop greater than 50 percent suggests HIT and heparin must be stopped', 'Use an infusion pump and a dedicated line; verify the rate with a second RN', 'Assess for bleeding: gums, urine, stool, surgical knee incision, neuro changes'], atiTip: 'Heparin - aPTT and protamine sulfate. Warfarin - PT/INR and vitamin K.', highAlert: true },
      { name: 'Enoxaparin', brand: 'Lovenox', classification: 'Low molecular weight heparin', dose: '40 mg subcutaneous, given today at 0800 (prophylactic dose)', action: 'Inhibits factor Xa to prevent venous thromboembolism postoperatively', onset: '3-5 hours peak', sideEffects: ['Bleeding', 'Injection site hematoma', 'Thrombocytopenia'], nursingConsiderations: ['Give in the abdomen at least 2 inches from the umbilicus', 'Do not expel the air bubble in the prefilled syringe', 'Do not aspirate or massage the site', 'Prophylactic dosing did not prevent this PE - report the breakthrough event to the provider'], atiTip: 'Prophylactic enoxaparin does not guarantee protection; assess for VTE even in patients receiving it', highAlert: true },
      { name: 'Alteplase', brand: 'Activase, tPA', classification: 'Thrombolytic (tissue plasminogen activator)', dose: 'Prepare for thrombolytic therapy if ordered - typical massive PE regimen 100 mg IV over 2 hours', action: 'Converts plasminogen to plasmin, actively dissolving the pulmonary artery clot and relieving right ventricular afterload', onset: 'Minutes', sideEffects: ['Major hemorrhage', 'Intracranial hemorrhage', 'Hypotension', 'Reperfusion arrhythmias'], nursingConsiderations: ['Reserved for massive PE with hemodynamic instability', 'Screen for absolute contraindications - this patient had surgery 3 days ago, a major relative bleeding risk that must be reported to the provider', 'Stop heparin infusion per protocol during administration', 'Hold all noncompressible punctures, IM injections, and invasive lines', 'Perform frequent neuro checks for intracranial bleeding'], atiTip: 'Any new headache, confusion, or unequal pupils during thrombolytics equals suspected intracranial hemorrhage - stop the infusion and notify the provider immediately', highAlert: true },
      { name: 'Protamine sulfate', brand: 'Protamine', classification: 'Heparin antagonist', dose: 'Per provider order based on heparin dose administered', action: 'Binds heparin to form an inactive complex, reversing anticoagulation', onset: '5 minutes', sideEffects: ['Hypotension', 'Bradycardia', 'Anaphylaxis', 'Flushing'], nursingConsiderations: ['Administer slow IV push', 'Have emergency equipment available', 'Monitor aPTT after administration'], atiTip: 'Know the antidote before you hang the drug', highAlert: true }
    ],

    sbar: {
      situation: 'This is the RN on the med/surg unit calling about Jane Smith, room 412, a 72-year-old female who is postoperative day 3 from a left total knee replacement. At 0922 she developed sudden shortness of breath, and she now has pleuritic right-sided chest pain with worsening hypoxemia.',
      background: 'She has been on enoxaparin 40 mg subcutaneous daily for VTE prophylaxis, last given at 0800. On postoperative day 2 she reported calf discomfort with increased swelling in the operative leg. She has no known drug allergies and is a full code.',
      assessment: 'Her vital signs are blood pressure 92/58, heart rate 132 sinus tachycardia, respirations 34 and labored, temperature 98.6, and SpO2 85 percent despite oxygen. She is anxious, restless, pale, and diaphoretic with jugular venous distention and cool clammy extremities. ABG shows pH 7.48, PaCO2 30, PaO2 60. D-dimer is 2.8, troponin 0.12, BNP 420. CT angiography shows a large right pulmonary artery embolus and Doppler confirms a left lower extremity DVT. She is showing signs of obstructive shock.',
      recommendation: 'I recommend we titrate oxygen to a non-rebreather now, confirm the heparin bolus and infusion parameters, activate the Rapid Response Team, and have you evaluate her at the bedside for thrombolytic therapy and ICU transfer. I also need to flag that she is only 3 days postoperative, which is a significant bleeding risk with thrombolytics.'
    },

    questions: [
      { id: 'ms2-pe-q1', text: 'A patient on postoperative day 3 from a total knee replacement suddenly reports shortness of breath and sharp chest pain that worsens with inspiration. Which action should the nurse take FIRST?', type: 'multiple-choice', options: ['Administer oxygen and place the patient in high Fowler position', 'Call radiology to schedule the CT angiography', 'Administer the next scheduled dose of enoxaparin', 'Assist the patient to ambulate to improve circulation'], correct: [0], rationale: 'Airway and breathing come first. Oxygen plus upright positioning immediately supports oxygenation and reduces work of breathing while the team arranges diagnostics. Ambulating a patient with a suspected PE can dislodge additional thrombus and is dangerous.', atiPearl: 'ABCs before diagnostics, every time', difficulty: 'Easy' },
      { id: 'ms2-pe-q2', text: 'The ABG results are pH 7.48, PaCO2 30, PaO2 60, HCO3 22. How should the nurse interpret these values?', type: 'multiple-choice', options: ['Uncompensated respiratory alkalosis with significant hypoxemia', 'Compensated metabolic alkalosis with normal oxygenation', 'Uncompensated respiratory acidosis with hypoxemia', 'Compensated respiratory acidosis with mild hypoxemia'], correct: [0], rationale: 'The pH is alkalotic at 7.48 and the PaCO2 is low at 30, so the respiratory system is the cause. The HCO3 of 22 is normal, meaning no metabolic compensation has occurred yet, making it uncompensated. The PaO2 of 60 is significant hypoxemia. Tachypnea from the PE is blowing off CO2 while the dead space ventilation keeps oxygen low.', atiPearl: 'ROME - Respiratory Opposite, Metabolic Equal. Low CO2 with high pH equals respiratory alkalosis.', difficulty: 'Medium' },
      { id: 'ms2-pe-q3', text: 'The D-dimer result is 2.8 mcg/mL (normal less than 0.50). Which statement best describes the clinical meaning of this result?', type: 'multiple-choice', options: ['It confirms a pulmonary embolism and no further imaging is required', 'It is a sensitive but nonspecific indicator of clot breakdown that supports the need for CT angiography', 'It indicates the patient is over-anticoagulated on enoxaparin', 'It reflects the degree of postoperative inflammation and requires no action'], correct: [1], rationale: 'D-dimer measures fibrin degradation products released when a clot breaks down. It is highly sensitive, so a normal value helps rule OUT VTE, but it is elevated in surgery, trauma, infection, pregnancy, and malignancy, so it cannot rule VTE in. CT angiography is required for confirmation, and in this case it showed a large right pulmonary artery embolus.', atiPearl: 'A negative D-dimer rules out; a positive D-dimer only raises suspicion', difficulty: 'Medium' },
      { id: 'ms2-pe-q4', text: 'The nurse notes a troponin of 0.12 ng/mL and a BNP of 420 pg/mL in this patient with a confirmed pulmonary embolism. What do these results most likely indicate?', type: 'multiple-choice', options: ['An acute myocardial infarction requiring cardiac catheterization', 'Right ventricular strain from increased pulmonary vascular resistance', 'Chronic heart failure that predated the surgery', 'Laboratory error, since these values are unrelated to pulmonary embolism'], correct: [1], rationale: 'A large clot in the pulmonary artery sharply increases right ventricular afterload. The RV dilates, its wall stretches (releasing BNP), and its myocytes become ischemic (releasing troponin). Elevated cardiac biomarkers in PE identify a higher-risk, submassive-to-massive embolism with a much greater chance of hemodynamic collapse.', atiPearl: 'Troponin and BNP elevation in PE means right heart strain and predicts deterioration', difficulty: 'Hard' },
      { id: 'ms2-pe-q5', text: 'Which set of findings indicates that this patient is progressing to OBSTRUCTIVE SHOCK?', type: 'multiple-choice', options: ['Blood pressure 92/58, heart rate 132, jugular venous distention, cool clammy skin, capillary refill 4 seconds', 'Blood pressure 124/78, heart rate 98, respirations 20, SpO2 95 percent', 'Report of anxiety with an SpO2 of 95 percent on room air', 'Left calf tenderness with mild swelling of the operative leg'], correct: [0], rationale: 'Obstructive shock in PE is mechanical: the clot blocks pulmonary outflow, the right ventricle fails and backs up (JVD), left ventricular preload falls, cardiac output drops, and compensatory vasoconstriction produces cool clammy skin and delayed capillary refill with tachycardia and hypotension. The other options describe either baseline values or the DVT source, not shock.', atiPearl: 'Hypotension plus JVD plus clear breath sounds in a dyspneic patient equals obstructive shock', difficulty: 'Medium' },
      { id: 'ms2-pe-q6', text: 'Which laboratory test is used to monitor the therapeutic effect of a continuous unfractionated heparin infusion?', type: 'multiple-choice', options: ['Prothrombin time and INR', 'Activated partial thromboplastin time (aPTT)', 'D-dimer', 'Fibrinogen level'], correct: [1], rationale: 'Unfractionated heparin is monitored with the aPTT (or an anti-Xa level), with a therapeutic goal usually 1.5 to 2.5 times the control value. PT/INR monitors warfarin. D-dimer monitors clot breakdown but is not used for dosing. The nurse must also trend the platelet count to detect heparin-induced thrombocytopenia.', atiPearl: 'Heparin goes with aPTT and protamine sulfate; warfarin goes with PT/INR and vitamin K', difficulty: 'Easy' },
      { id: 'ms2-pe-q7', text: 'The provider is considering alteplase for this patient. Which piece of information is MOST important for the nurse to report before the drug is given?', type: 'multiple-choice', options: ['The patient has no known drug allergies', 'The patient had a total knee replacement 3 days ago', 'The patient received enoxaparin 40 mg subcutaneous at 0800', 'The patient weighs 94 kg'], correct: [1], rationale: 'Major surgery within the previous 2 to 3 weeks is a significant contraindication to thrombolytic therapy because alteplase dissolves clots systemically, including the hemostatic clot at the fresh surgical site. Postoperative day 3 status creates a high risk of catastrophic bleeding into the knee and must be reported. Weight and recent enoxaparin matter for dosing but are not the priority safety concern.', atiPearl: 'Before any thrombolytic, screen for recent surgery, active bleeding, stroke, and uncontrolled hypertension', difficulty: 'Hard' },
      { id: 'ms2-pe-q8', text: 'The nurse is caring for this patient after the heparin infusion has started. Select ALL findings that require immediate notification of the provider.', type: 'select-all', options: ['New onset confusion and a severe headache', 'Platelet count that has dropped from 285,000 to 120,000', 'Blood pressure of 78/44 with a heart rate of 138', 'Bright red blood in the urine', 'A small bruise at a previous venipuncture site', 'SpO2 of 80 percent on a non-rebreather mask'], correct: [0, 1, 2, 3, 5], rationale: 'Confusion with headache suggests intracranial bleeding. A platelet drop of more than 50 percent from baseline suggests heparin-induced thrombocytopenia, which paradoxically causes more clotting and requires stopping all heparin. Hypotension with tachycardia signals obstructive shock. Hematuria is frank bleeding. An SpO2 of 80 percent on a non-rebreather is refractory hypoxemia. A small bruise at an old venipuncture site is an expected, minor anticoagulation effect that is documented and monitored.', atiPearl: 'With heparin, watch the platelets as closely as the aPTT', difficulty: 'Hard' },
      { id: 'ms2-pe-q9', text: 'Which position is BEST for this patient experiencing acute dyspnea from a pulmonary embolism?', type: 'multiple-choice', options: ['Supine with the legs elevated', 'High Fowler position', 'Left lateral Trendelenburg', 'Prone position'], correct: [1], rationale: 'High Fowler position drops the abdominal contents away from the diaphragm, maximizes lung expansion, and reduces work of breathing. Supine with legs elevated increases venous return and can worsen right ventricular overload while impairing chest expansion. Trendelenburg is not indicated and worsens breathing. Prone positioning is an ARDS strategy requiring a ventilated, sedated patient.', atiPearl: 'Dyspnea equals upright - sit them up unless the patient is in hypovolemic shock without respiratory distress', difficulty: 'Easy' },
      { id: 'ms2-pe-q10', text: 'Select ALL of the risk factors present in this patient that contributed to the development of venous thromboembolism.', type: 'select-all', options: ['Recent orthopedic surgery (total knee replacement)', 'Postoperative immobility', 'Age over 65 years', 'Obesity (94 kg at 165 cm)', 'No known drug allergies', 'Hemoglobin of 13.5 g/dL'], correct: [0, 1, 2, 3], rationale: 'Virchow triad explains VTE: venous stasis, endothelial injury, and hypercoagulability. Major orthopedic surgery of the lower extremity injures the endothelium and creates a hypercoagulable state, immobility causes stasis, and advanced age and obesity independently raise risk. Allergy status and a normal hemoglobin are not risk factors.', atiPearl: 'Total joint replacement of the hip or knee is one of the highest-risk surgeries for VTE', difficulty: 'Medium' },
      { id: 'ms2-pe-q11', text: 'The patient asks why her oxygen saturation keeps falling even though she is wearing oxygen. What is the nurse best response?', type: 'multiple-choice', options: ['"The oxygen tubing is probably kinked; I will check the connection."', '"The clot is blocking blood flow to part of your lung, so that area cannot pick up the oxygen you are breathing in."', '"Your oxygen level is falling because you are breathing too fast and using up all the oxygen."', '"This is a normal response after surgery and it will improve on its own."'], correct: [1], rationale: 'PE creates alveolar dead space: alveoli are ventilated but not perfused, so oxygen cannot be transferred to blood no matter how much is delivered. This is why hypoxemia in PE is characteristically refractory to supplemental oxygen and why the definitive treatment must restore pulmonary blood flow. The other responses are inaccurate and falsely reassuring.', atiPearl: 'Hypoxemia that does not improve with oxygen should make you think PE or shunt', difficulty: 'Medium' },
      { id: 'ms2-pe-q12', text: 'Which discharge teaching point is MOST important for this patient who will go home on anticoagulation therapy?', type: 'multiple-choice', options: ['"Take an aspirin every day in addition to your anticoagulant for extra protection."', '"Report black tarry stools, blood in your urine, unusual bruising, or any severe headache right away."', '"Stay in bed as much as possible for the next month to prevent another clot."', '"You can stop the medication as soon as your chest pain and shortness of breath go away."'], correct: [1], rationale: 'Bleeding is the primary risk of anticoagulation, and the patient must be able to recognize occult bleeding. Adding aspirin without a provider order compounds bleeding risk. Prolonged bed rest causes venous stasis and would increase, not decrease, VTE risk - early progressive ambulation is what prevents recurrence. Anticoagulation is continued for a prescribed duration regardless of symptom resolution.', atiPearl: 'Anticoagulation teaching: soft toothbrush, electric razor, no NSAIDs, report any bleeding, and never stop the drug on your own', difficulty: 'Easy' },
      { id: 'ms2-pe-q13', text: 'Which nursing action would be MOST effective in preventing pulmonary embolism in postoperative orthopedic patients?', type: 'multiple-choice', options: ['Massaging the calves every 2 hours to improve circulation', 'Early progressive ambulation combined with sequential compression devices and prescribed prophylactic anticoagulation', 'Keeping the patient on strict bed rest with the legs dependent', 'Encouraging the patient to cross the legs at the ankles while resting in bed'], correct: [1], rationale: 'Preventing venous stasis with early ambulation and mechanical compression, combined with pharmacologic prophylaxis, is the evidence-based bundle for VTE prevention. Massaging the calves of a patient who may have a DVT can dislodge the thrombus and cause an embolism. Bed rest with dependent legs and crossed legs both promote stasis.', atiPearl: 'Never massage a tender, swollen calf - you can embolize the clot', difficulty: 'Easy' }
    ],

    keyPoints: [
      'PE most often originates from a deep vein thrombosis in the lower extremities',
      'Classic presentation: sudden dyspnea, pleuritic chest pain, tachycardia, anxiety, and hypoxemia',
      'Hypoxemia in PE is refractory to supplemental oxygen because the alveoli are ventilated but not perfused',
      'The initial ABG in PE is usually respiratory alkalosis with hypoxemia (pH high, PaCO2 low, PaO2 low)',
      'D-dimer is sensitive but not specific; CT angiography confirms the diagnosis',
      'Elevated troponin and BNP in PE indicate right ventricular strain and a higher-risk embolism',
      'Obstructive shock in PE presents with hypotension, JVD, and cool clammy skin',
      'Heparin prevents clot propagation; only thrombolytics or embolectomy remove the existing clot',
      'Virchow triad: venous stasis, endothelial injury, hypercoagulability'
    ],

    pearls: [
      'A postoperative patient with sudden dyspnea and a sense of impending doom has a PE until proven otherwise',
      'Never massage a tender, swollen calf - you may embolize the clot',
      'A patient on prophylactic enoxaparin can still develop a PE; prophylaxis is not immunity',
      'Heparin is a high-alert medication: aPTT, platelets, and protamine sulfate',
      'A sudden drop in platelets of more than 50 percent on heparin means suspected HIT - stop all heparin including flushes',
      'Recent surgery is a major bleeding contraindication for thrombolytics - always report it'
    ],

    successChecklist: [
      'Receive and review the patient chart',
      'Verify patient identity using two identifiers',
      'Perform hand hygiene and apply standard precautions',
      'Perform a focused cardiopulmonary assessment',
      'Review laboratory and diagnostic findings',
      'Recognize manifestations of pulmonary embolism',
      'Identify signs of obstructive shock',
      'Prioritize interventions using the ABCs',
      'Implement provider orders',
      'Communicate findings using SBAR',
      'Prepare for anticoagulation therapy',
      'Escalate care appropriately',
      'Complete tasks within the 20-minute simulation time'
    ],

    criticalErrors: [
      'Ambulating or massaging the patient calf, which can dislodge additional thrombus',
      'Laying the dyspneic patient flat instead of raising the head of the bed',
      'Delaying oxygen administration while waiting for the CT angiography result',
      'Failing to recognize hypotension with JVD and tachycardia as obstructive shock',
      'Administering thrombolytics without reporting that the patient is 3 days postoperative',
      'Failing to obtain a baseline aPTT and platelet count before starting the heparin infusion',
      'Continuing heparin after the platelet count drops more than 50 percent from baseline',
      'Leaving the patient alone and unmonitored while SpO2 continues to fall',
      'Failing to activate the Rapid Response Team when the patient becomes hemodynamically unstable',
      'Giving an IM injection or performing a noncompressible puncture on a fully anticoagulated patient'
    ],

    comparisons: [
      {
        title: 'Pulmonary Embolism vs Myocardial Infarction',
        headers: ['Feature', 'Pulmonary Embolism', 'Myocardial Infarction'],
        rows: [
          ['Chest pain quality', 'Sharp, pleuritic, worse with inspiration', 'Crushing, pressure, radiating to jaw or arm'],
          ['Breath sounds', 'Often clear', 'Crackles if left heart failure develops'],
          ['SpO2 response to O2', 'Remains low (dead space)', 'Usually improves'],
          ['Key lab', 'D-dimer high, ABG respiratory alkalosis', 'Troponin high with ECG ST changes'],
          ['Definitive test', 'CT angiography', '12-lead ECG and cardiac catheterization'],
          ['Shock type', 'Obstructive', 'Cardiogenic']
        ]
      },
      {
        title: 'Heparin vs Alteplase in PE',
        headers: ['Feature', 'Heparin', 'Alteplase (tPA)'],
        rows: [
          ['Effect on existing clot', 'Does not dissolve it', 'Actively dissolves it'],
          ['Purpose', 'Prevents propagation and new emboli', 'Restores pulmonary blood flow'],
          ['Indication', 'All confirmed PE without contraindication', 'Massive PE with hemodynamic instability'],
          ['Monitoring', 'aPTT or anti-Xa, platelets', 'Neuro checks, bleeding, vital signs'],
          ['Reversal', 'Protamine sulfate', 'Cryoprecipitate, antifibrinolytics, blood products']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'Something is wrong. I cannot catch my breath. It came on all at once, like somebody sat on my chest. Please do not leave me.' },
      { speaker: 'patient', trigger: 'pain', line: 'It is right here on the right side, and it stabs me every time I try to take a real breath. So I just take little ones. Maybe a seven, but it goes to a nine when I breathe deep.' },
      { speaker: 'patient', trigger: 'breathing', line: 'I am trying. I am really trying. It feels like I am breathing through a straw and none of it is getting in. Is the oxygen even on?' },
      { speaker: 'patient', trigger: 'history', line: 'They put my new knee in on Monday. I was walking down the hall with the therapist and everything. Yesterday my surgery leg started aching in the back, down here, but nobody seemed worried about it.' },
      { speaker: 'patient', trigger: 'assessment', line: 'My heart is pounding so hard I can hear it in my ears. And I feel dizzy, like the room is tipping. Am I dying? Please tell me the truth.' },
      { speaker: 'patient', trigger: 'medication', line: 'They already gave me a shot in my stomach this morning for blood clots. So how could I have one? I did what they told me to do.' },
      { speaker: 'patient', trigger: 'deterioration', line: 'I am so cold. And I cannot... I cannot finish a sentence anymore. Just... help me.' },
      { speaker: 'family', trigger: 'greeting', line: 'I am her daughter. She was fine an hour ago, she was complaining about the food. Then all of a sudden she could not breathe. What happened to my mother?' },
      { speaker: 'family', trigger: 'history', line: 'She told the aide yesterday that her calf hurt and that leg looked bigger to me, but I figured that was just from the surgery.' },
      { speaker: 'family', trigger: 'escalation', line: 'Why are there so many people in here now? Somebody please tell me what is going on with her.' }
    ],

    patientEducation: [
      'Take your anticoagulant exactly as prescribed, at the same time each day, and never stop it on your own',
      'Report immediately: black tarry stools, blood in urine or vomit, coughing up blood, unusual bruising, nosebleeds that will not stop, or a severe headache',
      'Use a soft toothbrush and an electric razor to reduce bleeding risk',
      'Avoid NSAIDs such as ibuprofen and naproxen, and avoid aspirin unless your provider specifically prescribes it',
      'Tell every provider and dentist that you are on a blood thinner before any procedure',
      'Wear medical alert identification indicating you are anticoagulated',
      'Perform ankle pumps hourly while awake, ambulate as tolerated, and wear compression devices as ordered',
      'Do not sit or stand in one position for long periods; on car trips or flights, get up and move every 1 to 2 hours',
      'Stay well hydrated and avoid crossing your legs',
      'Report any new leg swelling, redness, warmth, or calf pain, and any new shortness of breath or chest pain, immediately'
    ]
  },

  // ==========================================================================
  // 2. SEPSIS / SEPTIC SHOCK
  // ==========================================================================
  {
    id: 'ms2-sepsis',
    title: 'Sepsis and Septic Shock',
    fullTitle: 'Sepsis with Progression to Septic Shock Secondary to Community-Acquired Pneumonia',
    category: 'Med-Surg 2',
    course: 'NUR2212C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'INFECTION',
    summary: 'A 72-year-old woman admitted yesterday with community-acquired pneumonia develops leukocytosis, lactate 4.6, acute kidney injury, and worsening hypotension as sepsis progresses toward septic shock.',
    highYield: true,

    objectives: [
      'Explain the pathophysiology of sepsis and septic shock',
      'Recognize signs of systemic infection and organ dysfunction',
      'Interpret CBC, CMP, lactate, blood culture, and renal function results',
      'Identify manifestations of impaired tissue perfusion',
      'Perform focused respiratory, cardiovascular, neurological, and renal assessments',
      'Discuss evidence-based sepsis treatment and the sepsis bundle',
      'Utilize SBAR communication',
      'Recognize indications for Rapid Response Team activation'
    ],

    patient: {
      name: 'Jane Smith',
      age: '72 years',
      dob: '06/26/1954',
      sex: 'Female',
      weightKg: 74,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Pneumonia progressing to sepsis',
      history: [
        'Admitted yesterday at 1800 through the ED with community-acquired pneumonia and shortness of breath',
        'Height 160 cm, weight 74 kg',
        'Yesterday 2200: stable overnight, receiving oxygen at 2L nasal cannula',
        'Today 0800: reports fatigue and dizziness with increased confusion',
        'Age over 65 is an independent risk factor for sepsis and for atypical presentation',
        'Med/surg unit, standard precautions, regular diet'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - Today 1000 (assuming care at 1030)',
        bp: '92/58', hr: 118, rr: 26, temp: '102.2 F', spo2: 90,
        pain: '3/10 generalized aching, denies chest pain',
        loc: 'Confused, lethargic, difficult to focus, oriented to person only',
        other: 'Skin warm and flushed, bounding pulses, urine output 25 mL over the last hour. MAP 69 mmHg. Received 1 L normal saline bolus at 1015.',
        flags: ['fever', 'tachycardia', 'tachypnea', 'hypotension', 'hypoxemia', 'altered-mental-status'],
        note: 'Documented trend: 0600 BP 118/72, HR 94, RR 18, Temp 100.8 F, SpO2 95%. 0800 BP 108/66, HR 104, RR 22, Temp 101.4 F, SpO2 95%. Every parameter is marching in the wrong direction over 4 hours. She meets qSOFA with altered mentation and RR greater than 22, and with lactate 4.6 plus organ dysfunction she meets sepsis criteria. MAP is 69, still above the notification threshold of 65 - but barely.'
      },
      {
        atMin: 6,
        label: 'MAP crosses the notification threshold',
        bp: '86/50', hr: 126, rr: 28, temp: '102.4 F', spo2: 89,
        pain: '3/10',
        loc: 'More confused, intermittently agitated, does not follow commands consistently',
        other: 'Still warm and flushed (warm shock). Urine output 15 mL this hour. MAP 62 mmHg.',
        flags: ['hypotension', 'map-under-65', 'oliguria', 'worsening'],
        note: 'MAP is now 62, below the ordered notification parameter of 65. Massive inflammatory vasodilation and capillary leak are dropping systemic vascular resistance faster than the fluid bolus can fill the tank. The provider must be called now.'
      },
      {
        atMin: 12,
        label: 'Septic shock - fluid refractory hypotension',
        bp: '78/44', hr: 134, rr: 32, temp: '101.2 F', spo2: 87,
        pain: 'Unable to reliably report',
        loc: 'Lethargic, arouses to loud voice only, not oriented',
        other: 'Skin now cool and mottled at the knees, capillary refill 4 seconds, urine output less than 10 mL this hour. MAP 55 mmHg. Non-rebreather applied.',
        flags: ['critical', 'septic-shock', 'poor-perfusion', 'anuria', 'severe-hypoxemia'],
        note: 'Hypotension persisting after adequate fluid resuscitation with a lactate above 2 defines septic shock. Note the shift from warm flushed skin to cool mottled skin - compensatory vasoconstriction has taken over as cardiac output falls. She needs a vasopressor, and norepinephrine is first line. The falling temperature in a septic elderly patient is an ominous sign, not an improvement.'
      },
      {
        atMin: 18,
        label: 'Multi-organ dysfunction',
        bp: '72/40', hr: 140, rr: 34, temp: '100.2 F', spo2: 85,
        pain: 'Unable to report',
        loc: 'Obtunded, responds only to painful stimuli',
        other: 'Weak thready pulses, mottling extending to the thighs, anuric, worsening metabolic acidosis expected on repeat lactate',
        flags: ['critical', 'mods', 'unresponsive', 'anuria'],
        note: 'MAP approximately 51. Prolonged tissue hypoperfusion is now producing multi-organ dysfunction: kidneys (creatinine 2.0 and anuria), brain (obtundation), lungs (worsening hypoxemia), and impending cardiovascular collapse. Requires Rapid Response, vasopressors, central access, and ICU transfer.'
      }
    ],

    labs: [
      { panel: 'CBC (0645)', name: 'WBC', value: '19.8', unit: 'K/uL', status: 'critical-high', normalRange: '5-10', interpretation: 'Marked leukocytosis confirming systemic infection; a LOW WBC in sepsis is equally ominous' },
      { panel: 'CBC (0645)', name: 'RBC', value: '4.1', unit: 'M/uL', status: 'low', normalRange: '4.2-5.4', interpretation: 'Mildly low, common in acute illness' },
      { panel: 'CBC (0645)', name: 'Hemoglobin', value: '11.6', unit: 'g/dL', status: 'low', normalRange: '12-16', interpretation: 'Mild anemia reduces oxygen-carrying capacity at a time of high demand' },
      { panel: 'CBC (0645)', name: 'Hematocrit', value: '35', unit: '%', status: 'low', normalRange: '37-47', interpretation: 'Consistent with mild anemia of acute illness' },
      { panel: 'CBC (0645)', name: 'Platelets', value: '175,000', unit: '/uL', status: 'normal', normalRange: '150,000-400,000', interpretation: 'Normal now, but a falling platelet count in sepsis suggests progression toward DIC - trend it' },
      { panel: 'BMP (0645)', name: 'Sodium', value: '132', unit: 'mEq/L', status: 'low', normalRange: '135-145', interpretation: 'Mild hyponatremia from fluid shifts and illness' },
      { panel: 'BMP (0645)', name: 'Potassium', value: '4.9', unit: 'mEq/L', status: 'normal', normalRange: '3.5-5.0', interpretation: 'High-normal; monitor closely because worsening AKI and acidosis will drive it up' },
      { panel: 'BMP (0645)', name: 'Chloride', value: '100', unit: 'mEq/L', status: 'normal', normalRange: '98-106', interpretation: 'Normal' },
      { panel: 'BMP (0645)', name: 'BUN', value: '38', unit: 'mg/dL', status: 'high', normalRange: '10-20', interpretation: 'Elevated from renal hypoperfusion and catabolism' },
      { panel: 'BMP (0645)', name: 'Creatinine', value: '2.0', unit: 'mg/dL', status: 'critical-high', normalRange: '0.6-1.2', interpretation: 'Acute kidney injury - this is documented organ dysfunction, which converts infection into SEPSIS' },
      { panel: 'BMP (0645)', name: 'Glucose', value: '186', unit: 'mg/dL', status: 'high', normalRange: '70-110', interpretation: 'Stress hyperglycemia from cortisol and catecholamine release; bedside glucose ordered' },
      { panel: 'Perfusion Marker', name: 'Lactate', value: '4.6', unit: 'mmol/L', status: 'critical-high', normalRange: '0.5-2.0', interpretation: 'Anaerobic metabolism from global tissue hypoperfusion; a lactate above 4 carries markedly increased mortality and mandates aggressive resuscitation' },
      { panel: 'Microbiology', name: 'Blood Cultures', value: 'Gram-positive cocci', unit: '', status: 'critical-high', normalRange: 'No growth', interpretation: 'Confirmed bacteremia; final sensitivity pending, so broad-spectrum coverage with vancomycin and cefepime continues until de-escalation is possible' }
    ],

    diagnostics: [
      { name: 'Blood cultures x2 sets', finding: 'Gram-positive cocci, final sensitivity pending', interpretation: 'Cultures must be drawn BEFORE antibiotics whenever possible so the organism can be identified and therapy narrowed' },
      { name: 'Repeat lactate (ordered in 4 hours)', finding: 'Pending; initial 4.6 mmol/L', interpretation: 'Lactate clearance is the marker of resuscitation adequacy - a rising or unchanged lactate means perfusion is not improving' },
      { name: 'Chest imaging / pneumonia source', finding: 'Community-acquired pneumonia, admitting diagnosis', interpretation: 'The lung is the source of infection; source control and oxygenation support are part of the bundle' }
    ],

    orders: [
      { text: 'Oxygen 2L nasal cannula to keep O2 greater than 95%', category: 'respiratory' },
      { text: 'Vital signs every 15 minutes', category: 'monitoring' },
      { text: 'Continuous cardiac monitoring', category: 'monitoring' },
      { text: 'Continuous pulse oximetry', category: 'monitoring' },
      { text: 'Bedside blood glucose level before meals, at bedtime, and as needed', category: 'monitoring' },
      { text: 'Repeat lactate in 4 hours', category: 'lab' },
      { text: 'Acetaminophen 650 mg PO every 6 hours PRN for fever', category: 'medication' },
      { text: 'Notify provider if MAP less than 65 mm Hg', category: 'monitoring' },
      { text: 'Strict intake and output', category: 'monitoring' },
      { text: 'Cefepime 2 g IV every 8 hours', category: 'medication' },
      { text: 'Vancomycin 1 g IV every 24 hours', category: 'medication' }
    ],

    interventions: [
      { id: 'sep-1', order: 1, action: 'Receive and review the patient chart, including the pneumonia admission, the 0800 note of fatigue, dizziness, and increased confusion, and the 0645 labs', rationale: 'The confusion documented at 0800 in a 72-year-old is often the earliest sign of sepsis and is easily dismissed as age-related', category: 'assessment', critical: false, preventsDeterioration: false, atiPearl: 'New confusion in an older adult with infection equals sepsis until proven otherwise' },
      { id: 'sep-2', order: 3, action: 'Verify patient identity using two identifiers', rationale: 'National Patient Safety Goal; required before assessment and before every antibiotic dose', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'sep-3', order: 2, action: 'Perform hand hygiene and apply standard precautions', rationale: 'Protects an immunologically overwhelmed patient from additional organisms and prevents transmission', category: 'intervention', critical: true, preventsDeterioration: false },
      { id: 'sep-4', order: 4, action: 'Perform a focused respiratory, cardiovascular, neurological, and renal assessment including lung sounds, capillary refill, skin temperature and color, level of consciousness, and urine output', rationale: 'Sepsis is diagnosed by organ dysfunction; each system assessed is a potential dysfunction to detect', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'sep-5', order: 5, action: 'Review laboratory and diagnostic findings: WBC 19.8, lactate 4.6, creatinine 2.0, BUN 38, and blood cultures growing gram-positive cocci', rationale: 'Lactate 4.6 with a creatinine of 2.0 documents tissue hypoperfusion and acute kidney injury, confirming sepsis rather than uncomplicated infection', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Lactate is the perfusion number - above 2 is worrisome, above 4 is a crisis' },
      { id: 'sep-6', order: 6, action: 'Recognize manifestations of sepsis and identify progression toward septic shock: fever 102.2, tachycardia, tachypnea, hypotension, warm flushed skin turning cool and mottled, and worsening confusion', rationale: 'Early recognition is the single most important determinant of survival; every hour of delay increases mortality', category: 'assessment', critical: true, preventsDeterioration: true },
      { id: 'sep-7', order: 7, action: 'Prioritize interventions using the ABCs: titrate oxygen to keep SpO2 greater than 95 percent, position for optimal ventilation, and ensure patent large-bore IV access for fluid resuscitation', rationale: 'Oxygen delivery to hypoperfused tissue is the immediate priority; a patient with an SpO2 of 90 percent on 2L needs escalation of oxygen therapy', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'sep-8', order: 8, action: 'Implement provider orders: administer the ordered antibiotics on time (cefepime 2 g IV every 8 hours, vancomycin 1 g IV every 24 hours) after cultures are obtained, continue the normal saline resuscitation, obtain bedside glucose, and give acetaminophen 650 mg PO PRN for fever', rationale: 'Antibiotics within the first hour of recognition are the highest-yield intervention in sepsis; cultures must be drawn first when it does not delay therapy', category: 'medication', critical: true, preventsDeterioration: true, atiPearl: 'Culture before antibiotics - but never delay antibiotics to chase a culture' },
      { id: 'sep-9', order: 9, action: 'Monitor oxygenation, perfusion, and urine output: vital signs every 15 minutes, calculate MAP with each set, strict intake and output, and assess skin temperature, color, and capillary refill', rationale: 'Urine output is a direct, real-time readout of renal perfusion; a MAP below 65 does not deliver enough pressure to perfuse the kidneys and brain', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Target urine output is at least 0.5 mL/kg/hr - for 74 kg that is 37 mL/hr' },
      { id: 'sep-10', order: 10, action: 'Notify the provider immediately when the MAP falls below 65 mm Hg and communicate findings using SBAR', rationale: 'The ordered notification parameter exists because a MAP below 65 means organ perfusion is failing; SBAR gets vasopressor orders faster', category: 'communication', critical: true, preventsDeterioration: true },
      { id: 'sep-11', order: 11, action: 'Escalate care: activate the Rapid Response Team, anticipate norepinephrine for fluid-refractory hypotension, request central access, and prepare for ICU transfer', rationale: 'Hypotension that persists after adequate fluid resuscitation is septic shock and requires vasopressor support that cannot be safely managed on a med/surg unit', category: 'escalation', critical: true, preventsDeterioration: true, atiPearl: 'Norepinephrine (Levophed) is the first-line vasopressor in septic shock' },
      { id: 'sep-12', order: 12, action: 'Document assessments, interventions, and the patient response; ensure the repeat lactate is drawn as ordered', rationale: 'Lactate clearance documents whether resuscitation is working and guides the next escalation', category: 'intervention', critical: false, preventsDeterioration: false }
    ],

    medications: [
      { name: 'Cefepime', brand: 'Maxipime', classification: 'Fourth-generation cephalosporin antibiotic', dose: '2 g IV every 8 hours (given today at 0900)', action: 'Broad-spectrum bactericidal beta-lactam that disrupts bacterial cell wall synthesis, covering gram-negative organisms including Pseudomonas', onset: 'Peak serum level at the end of the infusion', sideEffects: ['Diarrhea including C. difficile', 'Rash', 'Neurotoxicity and seizures in renal impairment', 'Phlebitis at the IV site'], nursingConsiderations: ['Assess for penicillin and cephalosporin allergy before every dose - this patient has NKDA', 'Obtain blood cultures before the first dose whenever possible', 'Dose adjustment is required in renal impairment - with a creatinine of 2.0 the provider should reassess the dose', 'Monitor for neurotoxicity such as confusion or myoclonus, which is easy to confuse with encephalopathy from sepsis'], atiTip: 'Cefepime accumulates in renal failure and can cause seizures - flag a rising creatinine', highAlert: false },
      { name: 'Vancomycin', brand: 'Vancocin', classification: 'Glycopeptide antibiotic', dose: '1 g IV every 24 hours (given today at 1000)', action: 'Inhibits bacterial cell wall synthesis; covers gram-positive organisms including MRSA, which matters because blood cultures grew gram-positive cocci', onset: 'Peak at end of infusion', sideEffects: ['Nephrotoxicity', 'Ototoxicity', 'Vancomycin infusion reaction (red man syndrome)', 'Thrombophlebitis'], nursingConsiderations: ['Infuse over at least 60 minutes; never IV push', 'If flushing and erythema of the face and neck develop, slow or stop the infusion - this is a rate-related histamine reaction, not an allergy', 'Monitor trough levels drawn just before the next dose', 'Monitor BUN and creatinine closely - with a creatinine already at 2.0 this patient is at high nephrotoxicity risk', 'Assess for tinnitus and hearing changes'], atiTip: 'Red man syndrome equals infuse slower; a true allergy equals stop the drug', highAlert: false },
      { name: '0.9% Sodium Chloride', brand: 'Normal Saline', classification: 'Isotonic crystalloid', dose: 'Maintenance infusion at 125 mL/hr started at 0900; 1 L bolus given at 1015', action: 'Expands intravascular volume to restore preload, cardiac output, and tissue perfusion in distributive shock', onset: 'Immediate', sideEffects: ['Fluid overload and pulmonary edema', 'Hyperchloremic metabolic acidosis with large volumes', 'Peripheral and pulmonary edema from capillary leak'], nursingConsiderations: ['Sepsis bundle target is 30 mL/kg of crystalloid - for 74 kg that is 2,220 mL', 'Reassess lung sounds, work of breathing, and SpO2 after each bolus, especially in a 72-year-old with pneumonia', 'Track strict intake and output and reassess MAP after every bolus', 'If hypotension persists after adequate fluids, the answer is vasopressors, not endless fluid'], atiTip: 'Fluid first, then pressors - but stop giving fluid and call for pressors when the MAP will not come up', highAlert: false },
      { name: 'Acetaminophen', brand: 'Tylenol', classification: 'Non-opioid analgesic and antipyretic', dose: '650 mg PO every 6 hours PRN for fever (given today at 0800)', action: 'Resets the hypothalamic set point to reduce fever and the associated increase in metabolic oxygen demand', onset: '30-60 minutes', sideEffects: ['Hepatotoxicity in overdose', 'Nausea'], nursingConsiderations: ['Maximum 4 g in 24 hours for healthy adults; less in hepatic impairment or older adults', 'Check all other medications for hidden acetaminophen', 'Fever reduction improves comfort but does not treat the infection', 'Reassess temperature 1 hour after administration'], atiTip: 'Treating the fever does not treat the sepsis - antibiotics and perfusion do', highAlert: false },
      { name: 'Norepinephrine', brand: 'Levophed', classification: 'Vasopressor (alpha-1 and beta-1 adrenergic agonist)', dose: 'Anticipated for fluid-refractory hypotension; titrated to maintain MAP at or above 65 mm Hg', action: 'Potent vasoconstriction raises systemic vascular resistance and MAP to restore organ perfusion in distributive shock', onset: '1-2 minutes', sideEffects: ['Reflex bradycardia', 'Dysrhythmias', 'Extravasation causing tissue necrosis', 'Peripheral and organ ischemia'], nursingConsiderations: ['First-line vasopressor in septic shock', 'Administer through a central line whenever possible; monitor any peripheral site continuously for blanching or extravasation', 'Phentolamine is the antidote for extravasation', 'Titrate to MAP at or above 65, never to blood pressure alone', 'Requires continuous cardiac and blood pressure monitoring - this is an ICU-level drug'], atiTip: 'Ensure the patient is volume resuscitated before or while starting pressors - squeezing an empty tank does not perfuse organs', highAlert: true }
    ],

    sbar: {
      situation: 'This is the RN on the med/surg unit calling about Jane Smith in room 318, a 72-year-old female admitted yesterday with community-acquired pneumonia. She is deteriorating and I believe she is in septic shock.',
      background: 'She was stable overnight on 2L nasal cannula. At 0800 she reported fatigue and dizziness with increased confusion. She received acetaminophen at 0800, cefepime 2 g IV at 0900, vancomycin 1 g IV at 1000, and a 1 liter normal saline bolus at 1015 on top of maintenance fluids at 125 mL/hr. She has no known drug allergies and is a full code.',
      assessment: 'Her vital signs have trended from 118/72 with a heart rate of 94 at 0600 to 86/50 with a heart rate of 126 now. Her MAP is 62, below the ordered parameter of 65. Respirations are 28, temperature 102.4, and SpO2 89 percent on 2 liters. She is confused and lethargic. WBC is 19.8, lactate is 4.6, creatinine is 2.0 with a BUN of 38, and blood cultures are growing gram-positive cocci with sensitivities pending. Urine output is only 15 mL this past hour.',
      recommendation: 'I recommend we increase her oxygen, give additional fluid resuscitation toward the 30 mL/kg target of about 2.2 liters, and that you come evaluate her now for a norepinephrine drip, central line placement, and ICU transfer. I would also like an order to repeat the lactate now rather than waiting the full 4 hours, and a review of her cefepime and vancomycin dosing given her creatinine of 2.0.'
    },

    questions: [
      { id: 'ms2-sepsis-q1', text: 'Which finding in this 72-year-old patient with pneumonia is the EARLIEST indicator that she is developing sepsis?', type: 'multiple-choice', options: ['New onset confusion and difficulty focusing', 'Temperature of 102.2 F', 'White blood cell count of 19.8', 'Blood pressure of 92/58'], correct: [0], rationale: 'In older adults, a change in mental status is frequently the first and sometimes the only early manifestation of sepsis, appearing before hemodynamic changes. It is documented in this chart at 0800, two hours before the blood pressure fell. Fever, leukocytosis, and hypotension are all real sepsis findings, but confusion came first and is the finding most often dismissed as normal aging.', atiPearl: 'Any acute change in mentation in an older adult with infection is sepsis until proven otherwise', difficulty: 'Medium' },
      { id: 'ms2-sepsis-q2', text: 'The patient blood pressure is 92/58. What is her mean arterial pressure, and what action does it require?', type: 'multiple-choice', options: ['MAP 69 - continue to monitor closely, as it is above the ordered notification threshold of 65', 'MAP 75 - no concern, this is a normal MAP', 'MAP 58 - notify the provider immediately', 'MAP 92 - the systolic pressure is the MAP'], correct: [0], rationale: 'MAP equals systolic plus two times diastolic, divided by three: (92 + 116) divided by 3 equals 69 mmHg. This is above the ordered threshold of 65, so it does not yet trigger the notification order, but it is only 4 points away and trending down. The nurse should recalculate the MAP with every 15-minute vital sign set and be prepared to call immediately.', atiPearl: 'MAP equals (SBP + 2 x DBP) / 3. A MAP of at least 65 is required to perfuse the brain and kidneys.', difficulty: 'Medium' },
      { id: 'ms2-sepsis-q3', text: 'The lactate level is 4.6 mmol/L. What does this value indicate?', type: 'multiple-choice', options: ['The patient is dehydrated and needs oral fluids', 'Tissue hypoperfusion with anaerobic metabolism, indicating high mortality risk and the need for aggressive resuscitation', 'The patient liver is failing and cannot clear lactate', 'The result is expected with a fever and requires no specific action'], correct: [1], rationale: 'When oxygen delivery to the tissues is inadequate, cells shift to anaerobic metabolism and produce lactate. A lactate above 2 signals hypoperfusion and a lactate above 4 is associated with sharply increased mortality. Along with hypotension that persists after fluid resuscitation, a lactate above 2 is part of the definition of septic shock. Lactate clearance is used to judge whether resuscitation is working, which is why a repeat level is ordered.', atiPearl: 'Lactate is the perfusion number - it tells you whether the cells are getting oxygen', difficulty: 'Medium' },
      { id: 'ms2-sepsis-q4', text: 'According to the sepsis bundle, which action should the nurse take FIRST when sepsis is recognized?', type: 'multiple-choice', options: ['Administer acetaminophen to bring down the fever', 'Obtain blood cultures and a lactate level, then administer broad-spectrum antibiotics without delay', 'Insert an indwelling urinary catheter to measure hourly output', 'Place the patient in Trendelenburg position'], correct: [1], rationale: 'The Hour-1 sepsis bundle is: measure lactate, obtain blood cultures BEFORE antibiotics, administer broad-spectrum antibiotics, begin rapid crystalloid at 30 mL/kg for hypotension or lactate at or above 4, and apply vasopressors for a MAP below 65 after fluids. Cultures come before antibiotics so the organism can be identified, but antibiotics must never be delayed to chase a culture. Antipyretics treat comfort, not the infection. Trendelenburg is not recommended and impairs ventilation.', atiPearl: 'Culture, then antibiotics, then fluids - within the first hour', difficulty: 'Medium' },
      { id: 'ms2-sepsis-q5', text: 'The provider orders a crystalloid bolus at 30 mL/kg for this 74 kg patient. How many milliliters should the nurse administer?', type: 'multiple-choice', options: ['740 mL', '1,480 mL', '2,220 mL', '3,700 mL'], correct: [2], rationale: '30 mL/kg multiplied by 74 kg equals 2,220 mL. The patient has already received 1,000 mL at 1015, so approximately 1,220 mL remains to reach the bundle target. The nurse must reassess lung sounds, work of breathing, and oxygen saturation between boluses because this is a 72-year-old with pneumonia who is at risk for fluid overload.', atiPearl: 'Know the 30 mL/kg number and be able to calculate it fast', difficulty: 'Medium' },
      { id: 'ms2-sepsis-q6', text: 'The nurse notes that the patient skin, which was warm and flushed on arrival, is now cool and mottled with a capillary refill of 4 seconds. How should the nurse interpret this change?', type: 'multiple-choice', options: ['The patient is improving because the fever is resolving', 'The patient is progressing from the early warm phase of septic shock to the late cold phase with failing cardiac output', 'The patient is having an allergic reaction to vancomycin', 'The room temperature is too low and the patient needs a warm blanket'], correct: [1], rationale: 'Early septic shock produces massive vasodilation, giving warm, flushed skin with bounding pulses. As shock progresses, cardiac output falls and compensatory vasoconstriction shunts blood centrally, producing cool, mottled extremities with delayed capillary refill. This transition marks decompensation and worsening prognosis, not improvement. A vancomycin infusion reaction causes flushing and erythema of the face and neck, not mottling with poor perfusion.', atiPearl: 'Warm shock then cold shock - cold means late and worse', difficulty: 'Hard' },
      { id: 'ms2-sepsis-q7', text: 'The patient BUN is 38 and creatinine is 2.0 with a urine output of 15 mL in the last hour. Which nursing actions are appropriate? Select all that apply.', type: 'select-all', options: ['Maintain strict intake and output', 'Notify the provider of the oliguria and the rising creatinine', 'Question the vancomycin dose given the risk of nephrotoxicity', 'Encourage the patient to drink 2 liters of fluid over the next 8 hours', 'Monitor the potassium level closely', 'Withhold all IV fluids to rest the kidneys'], correct: [0, 1, 2, 4], rationale: 'Acute kidney injury from hypoperfusion is documented organ dysfunction. Strict I and O, provider notification, and close potassium monitoring (already 4.9 and likely to climb with worsening AKI and acidosis) are all indicated, and vancomycin is nephrotoxic and requires dose review and trough monitoring in renal impairment. Oral fluids are unsafe and inadequate in a confused, lethargic, tachypneic patient. Withholding IV fluids is exactly wrong - the AKI is prerenal from hypoperfusion, and restoring perfusion is the treatment.', atiPearl: 'Prerenal AKI in sepsis is treated by fixing the perfusion, not by restricting fluid', difficulty: 'Hard' },
      { id: 'ms2-sepsis-q8', text: 'The nurse is administering vancomycin 1 g IV. Twenty minutes into the infusion the patient develops flushing and erythema of the face and neck. What is the priority nursing action?', type: 'multiple-choice', options: ['Stop the infusion permanently and document a vancomycin allergy', 'Slow or temporarily stop the infusion and notify the provider; this is a rate-related infusion reaction', 'Administer epinephrine immediately', 'Continue the infusion at the same rate and apply a cool cloth'], correct: [1], rationale: 'Vancomycin infusion reaction, historically called red man syndrome, is a rate-related, non-immune histamine release, not a true IgE-mediated allergy. It is managed by slowing the infusion to at least 60 to 120 minutes and often premedicating with an antihistamine. Labeling it an allergy would inappropriately remove a critical MRSA-active antibiotic from a patient whose blood cultures grew gram-positive cocci. Epinephrine is for anaphylaxis with airway compromise and hemodynamic collapse from a true allergic reaction.', atiPearl: 'Vancomycin flushing equals slow the rate; wheezing, angioedema, and shock equal true anaphylaxis', difficulty: 'Medium' },
      { id: 'ms2-sepsis-q9', text: 'Despite receiving 30 mL/kg of crystalloid, the patient MAP remains at 55 mmHg. What should the nurse anticipate next?', type: 'multiple-choice', options: ['Initiation of a norepinephrine infusion titrated to maintain a MAP of at least 65 mmHg', 'Administration of an additional 3 liters of normal saline', 'Placement of the patient in reverse Trendelenburg', 'Administration of a diuretic to improve urine output'], correct: [0], rationale: 'Hypotension that persists after adequate fluid resuscitation defines septic shock and is the indication for vasopressors. Norepinephrine is the first-line agent and is titrated to a MAP target of at least 65 mmHg. Endless additional fluid in a septic patient with pneumonia and capillary leak causes pulmonary edema without improving perfusion. A diuretic in a hypotensive, hypoperfused patient would worsen shock and the acute kidney injury.', atiPearl: 'Fluid-refractory hypotension equals vasopressors, and norepinephrine is first line', difficulty: 'Medium' },
      { id: 'ms2-sepsis-q10', text: 'Select ALL of the findings in this patient that represent organ dysfunction attributable to sepsis.', type: 'select-all', options: ['Creatinine 2.0 with a urine output of 15 mL/hr', 'Confusion and lethargy', 'SpO2 of 90 percent on 2 liters nasal cannula', 'Lactate 4.6', 'No known drug allergies', 'Blood cultures growing gram-positive cocci'], correct: [0, 1, 2, 3], rationale: 'Sepsis is infection plus organ dysfunction. Renal dysfunction is shown by the creatinine and oliguria, neurologic dysfunction by the confusion and lethargy, respiratory dysfunction by hypoxemia despite oxygen, and global tissue hypoperfusion by the lactate. Positive blood cultures confirm the infection itself, which is the trigger rather than the dysfunction, and allergy status is irrelevant to organ function.', atiPearl: 'Sepsis equals infection plus organ dysfunction; septic shock equals sepsis plus vasopressor-requiring hypotension plus lactate above 2', difficulty: 'Hard' },
      { id: 'ms2-sepsis-q11', text: 'The patient temperature drops from 102.4 F to 100.2 F while her blood pressure continues to fall and her mottling worsens. How should the nurse interpret the temperature change?', type: 'multiple-choice', options: ['The acetaminophen is working and the infection is resolving', 'This is an ominous sign of worsening sepsis in an older adult and requires escalation, not reassurance', 'The thermometer is malfunctioning and should be replaced', 'The patient is now afebrile so the antibiotics can be discontinued'], correct: [1], rationale: 'A falling temperature in the setting of worsening hemodynamics is not improvement. Older adults and patients in late septic shock frequently become normothermic or hypothermic as thermoregulation fails, and hypothermia in sepsis carries a worse prognosis than fever. The nurse must interpret the temperature in context with the blood pressure, mentation, perfusion, and lactate, all of which are worsening.', atiPearl: 'Hypothermia in sepsis is worse than fever - never read a falling temperature in isolation', difficulty: 'Hard' },
      { id: 'ms2-sepsis-q12', text: 'What is the minimum acceptable hourly urine output for this 74 kg patient?', type: 'multiple-choice', options: ['15 mL/hr', '25 mL/hr', '37 mL/hr', '74 mL/hr'], correct: [2], rationale: 'The standard adequate urine output is at least 0.5 mL/kg/hr. For 74 kg that is 37 mL/hr. Her current output of 15 mL/hr is well below the minimum and reflects renal hypoperfusion, correlating with her creatinine of 2.0. Urine output is one of the most sensitive bedside indicators of perfusion and must be tracked hourly with strict intake and output.', atiPearl: '0.5 mL/kg/hr is the perfusion floor - memorize it and calculate it for your patient', difficulty: 'Easy' },
      { id: 'ms2-sepsis-q13', text: 'Which teaching should the nurse provide to the patient and family after recovery to reduce the risk of a future episode of sepsis?', type: 'multiple-choice', options: ['"Stop taking your antibiotics as soon as you start feeling better."', '"Stay current on pneumococcal and influenza vaccinations, complete every prescribed antibiotic course, and call the provider right away for fever, confusion, or worsening shortness of breath."', '"Take a leftover antibiotic at home whenever you feel a cold coming on."', '"Limit all fluids to prevent your kidneys from being overworked."'], correct: [1], rationale: 'Vaccination is the most effective primary prevention against pneumococcal pneumonia, the source of this patient sepsis. Completing prescribed antibiotic courses prevents resistant organisms and incomplete treatment. Teaching the family to recognize early warning signs, especially new confusion in an older adult, allows earlier treatment when survival is far better. Stopping antibiotics early, self-medicating with leftovers, and restricting fluids are all unsafe.', atiPearl: 'Family teaching about new confusion catches sepsis hours earlier than waiting for hypotension', difficulty: 'Easy' }
    ],

    keyPoints: [
      'Sepsis is a dysregulated host response to infection that causes organ dysfunction',
      'Septic shock is sepsis with hypotension requiring vasopressors to keep MAP at or above 65 plus a lactate above 2 despite adequate fluid resuscitation',
      'In older adults, new confusion is often the earliest sign of sepsis',
      'qSOFA: altered mentation, respiratory rate at or above 22, systolic BP at or below 100',
      'The Hour-1 bundle: lactate, blood cultures before antibiotics, broad-spectrum antibiotics, 30 mL/kg crystalloid, vasopressors for MAP below 65',
      'MAP equals (SBP + 2 x DBP) / 3; the perfusion target is at least 65 mmHg',
      'Lactate above 4 mmol/L signals severe tissue hypoperfusion and high mortality',
      'Early septic shock is warm and flushed; late septic shock is cool and mottled',
      'Norepinephrine is the first-line vasopressor for septic shock',
      'Urine output of at least 0.5 mL/kg/hr is the bedside marker of adequate renal perfusion'
    ],

    pearls: [
      'A LOW white count in sepsis is just as ominous as a high one - it means the marrow is overwhelmed',
      'A falling temperature with worsening hemodynamics is deterioration, not recovery',
      'Draw cultures before antibiotics, but never let the culture delay the antibiotic',
      'Do not keep pouring fluid into a patient whose MAP will not rise - that patient needs a pressor',
      'Vancomycin and cefepime both need dose adjustment when the creatinine climbs',
      'A falling platelet count in a septic patient may be the first sign of DIC'
    ],

    successChecklist: [
      'Receive and review the patient chart',
      'Verify patient identity using two identifiers',
      'Perform hand hygiene and apply standard precautions',
      'Perform a focused respiratory, cardiovascular, neurological, and renal assessment',
      'Review laboratory and diagnostic findings',
      'Recognize manifestations of sepsis and septic shock',
      'Prioritize interventions using the ABCs',
      'Implement provider orders',
      'Monitor oxygenation, perfusion, and urine output',
      'Communicate findings using SBAR',
      'Escalate care appropriately',
      'Complete tasks within the 20-minute simulation time'
    ],

    criticalErrors: [
      'Failing to recognize new confusion in an older adult as an early sign of sepsis',
      'Delaying or missing a scheduled antibiotic dose',
      'Administering antibiotics before drawing blood cultures when cultures could be obtained without delay',
      'Failing to notify the provider when the MAP drops below the ordered threshold of 65 mmHg',
      'Treating only the fever with acetaminophen and considering the problem addressed',
      'Continuing to give fluid boluses without reassessing lung sounds in a patient with pneumonia',
      'Withholding IV fluids because of the elevated creatinine',
      'Administering vancomycin as an IV push or over less than 60 minutes',
      'Failing to monitor and report the urine output falling below 0.5 mL/kg/hr',
      'Failing to activate the Rapid Response Team once hypotension persists after fluid resuscitation',
      'Interpreting the falling temperature as clinical improvement'
    ],

    comparisons: [
      {
        title: 'Sepsis Continuum',
        headers: ['Stage', 'Definition', 'Key Findings'],
        rows: [
          ['Infection', 'Organism invades tissue', 'Fever, leukocytosis, localized symptoms'],
          ['Sepsis', 'Infection plus organ dysfunction', 'Altered mentation, oliguria, rising creatinine, lactate above 2'],
          ['Septic shock', 'Sepsis plus vasopressor-requiring hypotension plus lactate above 2', 'MAP below 65 despite fluids, mottling, anuria'],
          ['MODS', 'Failure of two or more organ systems', 'Obtundation, anuria, respiratory failure, coagulopathy']
        ]
      },
      {
        title: 'Warm Shock vs Cold Shock',
        headers: ['Feature', 'Early (Warm)', 'Late (Cold)'],
        rows: [
          ['Skin', 'Warm, flushed, dry', 'Cool, mottled, clammy'],
          ['Pulses', 'Bounding', 'Weak and thready'],
          ['Capillary refill', 'Brisk or normal', 'Greater than 3 seconds'],
          ['Cardiac output', 'High', 'Low'],
          ['Prognosis', 'Reversible with prompt treatment', 'High mortality']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'Who are you again? I am sorry... I keep losing track. Is it still morning? I feel like I am underwater.' },
      { speaker: 'patient', trigger: 'pain', line: 'I do not hurt exactly. I just ache all over, like the worst flu I ever had. My whole body feels heavy.' },
      { speaker: 'patient', trigger: 'breathing', line: 'I am breathing fast, am I not? I cannot seem to slow it down. It is like I cannot get a full one in.' },
      { speaker: 'patient', trigger: 'history', line: 'They brought me in yesterday for pneumonia. I thought I was getting better. I thought I was going home.' },
      { speaker: 'patient', trigger: 'assessment', line: 'I am so hot. Then a minute ago I was shaking cold. Can you get me some water? My mouth is like paper.' },
      { speaker: 'patient', trigger: 'deterioration', line: 'I am just... so tired. Let me sleep. Just for a minute. Do not... do not make me talk.' },
      { speaker: 'family', trigger: 'greeting', line: 'I am her son. She has not been herself since this morning. She called me by my brother name and he passed away eight years ago. That is not her.' },
      { speaker: 'family', trigger: 'history', line: 'She was talking and joking with us last night. I do not understand how she went downhill this fast in one day.' },
      { speaker: 'family', trigger: 'escalation', line: 'You are calling a rapid response? What does that mean? Is she going to make it? Please just tell me straight.' },
      { speaker: 'family', trigger: 'education', line: 'She has not had a flu shot in a couple of years. She said she never gets sick. Is that why this happened?' }
    ],

    patientEducation: [
      'Stay current on pneumococcal and annual influenza vaccinations - they are the best protection against the infection that caused this',
      'Complete every prescribed antibiotic course even after you start feeling better',
      'Never take leftover or borrowed antibiotics',
      'Call your provider immediately for fever, chills, new confusion, worsening shortness of breath, decreased urination, or dizziness',
      'Teach family members that a sudden change in thinking or alertness in an older adult can be the first sign of a serious infection',
      'Perform hand hygiene frequently and avoid contact with people who are ill',
      'Keep a current medication list and tell every provider you have had sepsis, since survivors are at higher risk of recurrence',
      'Expect fatigue and weakness for weeks after discharge; increase activity gradually and follow up as scheduled',
      'Follow up on kidney function testing, since this illness caused an acute kidney injury',
      'Report any decrease in urine output, swelling in the legs, or unusual weight gain after discharge'
    ]
  },

  // ==========================================================================
  // 3. UPPER GI BLEED
  // ==========================================================================
  {
    id: 'ms2-gi-bleed',
    title: 'Upper GI Bleed',
    fullTitle: 'Acute Upper Gastrointestinal Hemorrhage with Progression to Hypovolemic Shock',
    category: 'Med-Surg 2',
    course: 'NUR2212C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'BLOOD',
    summary: 'A 72-year-old man with peptic ulcer disease and chronic NSAID use develops bright red hematemesis with a hemoglobin of 6.8, requiring airway protection, fluid resuscitation, and PRBC transfusion to prevent hypovolemic shock.',
    highYield: true,

    objectives: [
      'Explain the causes and pathophysiology of upper gastrointestinal bleeding',
      'Differentiate upper GI bleeding from lower GI bleeding',
      'Describe the effects of acute blood loss on tissue perfusion and oxygenation',
      'Explain the progression from hemorrhage to hypovolemic shock',
      'Recognize manifestations of upper GI bleeding including hematemesis, coffee-ground emesis, melena, epigastric pain, dizziness, and syncope',
      'Identify signs of hypovolemia including tachycardia, hypotension, decreased urine output, delayed capillary refill, cool clammy skin, and altered mental status',
      'Safely administer and monitor a blood transfusion',
      'Protect the airway during active vomiting',
      'Utilize SBAR communication and prioritize using the ABCs'
    ],

    patient: {
      name: 'John Smith',
      age: '72 years',
      dob: '06/26/1954',
      sex: 'Male',
      weightKg: 88,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Acute Upper GI Bleed',
      history: [
        'Peptic ulcer disease',
        'Osteoarthritis with chronic NSAID use',
        'Height 69 inches, weight 88 kg',
        'Admitted today with acute upper GI bleed',
        'Today 0600: complaint of dizziness',
        'Today 0800: epigastric pain worsening',
        'Today 1000: active hematemesis begins',
        'Reported dark tarry stools (melena) earlier today',
        'Blood type O positive; PRBCs available',
        'Med/surg unit, no isolation precautions, NPO'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - Today 1000 (assuming care at 1100)',
        bp: '108/68', hr: 104, rr: 22, temp: '98.4 F', spo2: 94,
        pain: '7/10 epigastric, burning',
        loc: 'Alert and oriented x4, appears weak and fatigued',
        other: 'Pale and diaphoretic. Bright red hematemesis present. Cool extremities. S1 S2 audible. Nausea. Received 1 L normal saline bolus at 1000, pantoprazole 80 mg IV at 1015, ondansetron 4 mg IV at 1030, PRBC transfusion initiated at 1030.',
        flags: ['tachycardia', 'tachypnea', 'active-bleeding', 'poor-perfusion'],
        note: 'Documented trend: 0600 BP 118/76, HR 88, RR 18, Temp 99.4 F, SpO2 98%. The blood pressure still looks acceptable because compensatory vasoconstriction and tachycardia are maintaining it. This is compensated (Class II) hypovolemic shock - do not be reassured by a systolic of 108 in a patient whose hemoglobin is 6.8 and who is actively vomiting blood.'
      },
      {
        atMin: 5,
        label: 'Ongoing hemorrhage - narrowing pulse pressure',
        bp: '96/58', hr: 118, rr: 26, temp: '98.2 F', spo2: 92,
        pain: '8/10 epigastric',
        loc: 'Alert but anxious and restless',
        other: 'Second episode of bright red hematemesis approximately 250 mL. Skin cool and clammy, capillary refill 3 seconds.',
        flags: ['hypotension', 'tachycardia', 'narrowed-pulse-pressure', 'active-bleeding'],
        note: 'The pulse pressure is narrowing from 40 to 38 as systemic vasoconstriction raises the diastolic relative to the systolic. Anxiety and restlessness are early cerebral hypoperfusion, not just fear. Airway protection is now the top priority during active vomiting.'
      },
      {
        atMin: 11,
        label: 'Decompensated hypovolemic shock',
        bp: '84/50', hr: 130, rr: 28, temp: '98.0 F', spo2: 90,
        pain: 'Reports pain but is difficult to redirect',
        loc: 'Restless, confused, intermittently combative',
        other: 'Capillary refill greater than 4 seconds, urine output less than 20 mL this hour, peripheral pulses weak, skin gray and diaphoretic',
        flags: ['critical', 'shock', 'altered-mental-status', 'oliguria'],
        note: 'Estimated blood loss now exceeds 30 percent of circulating volume (Class III). Confusion in a bleeding patient means the brain is no longer being perfused. Continue the PRBC transfusion, run fluids wide open, and escalate for additional units and emergent endoscopy.'
      },
      {
        atMin: 16,
        label: 'Airway threatened, circulatory collapse imminent',
        bp: '72/40', hr: 138, rr: 32, temp: '97.8 F', spo2: 88,
        pain: 'Unable to report',
        loc: 'Lethargic, arouses only to painful stimuli',
        other: 'Large volume hematemesis with blood pooling in the oropharynx, thready pulses, mottled extremities, anuric',
        flags: ['critical', 'airway-risk', 'aspiration-risk', 'hemorrhagic-shock'],
        note: 'A lethargic patient with active hematemesis cannot protect the airway. Turn the head to the side or place in the lateral position, apply suction, apply high-flow oxygen, and call the Rapid Response Team. This patient needs massive transfusion protocol consideration, emergent endoscopy, and probable intubation.'
      }
    ],

    labs: [
      { panel: 'CBC (0645)', name: 'WBC', value: '9.8', unit: 'K/uL', status: 'normal', normalRange: '5-10', interpretation: 'Normal - the problem is bleeding, not infection' },
      { panel: 'CBC (0645)', name: 'RBC', value: '3.2', unit: 'M/uL', status: 'critical-low', normalRange: '4.5-5.9', interpretation: 'Markedly reduced red cell mass from acute blood loss' },
      { panel: 'CBC (0645)', name: 'Hemoglobin', value: '6.8', unit: 'g/dL', status: 'critical-low', normalRange: '13.5-17.5', interpretation: 'Critical anemia from acute hemorrhage; transfusion threshold - severely reduced oxygen-carrying capacity' },
      { panel: 'CBC (0645)', name: 'Hematocrit', value: '21', unit: '%', status: 'critical-low', normalRange: '39-50', interpretation: 'Roughly three times the hemoglobin, consistent with true blood loss rather than dilution' },
      { panel: 'CBC (0645)', name: 'Platelets', value: '280,000', unit: '/uL', status: 'normal', normalRange: '150,000-400,000', interpretation: 'Normal - the bleeding is from an ulcer, not from thrombocytopenia' },
      { panel: 'BMP (0645)', name: 'Sodium', value: '138', unit: 'mEq/L', status: 'normal', normalRange: '135-145', interpretation: 'Normal' },
      { panel: 'BMP (0645)', name: 'Potassium', value: '4.2', unit: 'mEq/L', status: 'normal', normalRange: '3.5-5.0', interpretation: 'Normal; monitor during transfusion because stored blood releases potassium' },
      { panel: 'BMP (0645)', name: 'Chloride', value: '104', unit: 'mEq/L', status: 'normal', normalRange: '98-106', interpretation: 'Normal' },
      { panel: 'BMP (0645)', name: 'Calcium', value: '9.8', unit: 'mg/dL', status: 'normal', normalRange: '9-10.5', interpretation: 'Normal now; citrate in transfused blood can bind calcium and cause hypocalcemia with large-volume transfusion' },
      { panel: 'BMP (0645)', name: 'BUN', value: '34', unit: 'mg/dL', status: 'high', normalRange: '10-20', interpretation: 'Elevated out of proportion to the creatinine - digested blood protein in the GI tract plus renal hypoperfusion; a classic upper GI bleed finding' },
      { panel: 'BMP (0645)', name: 'Creatinine', value: '1.3', unit: 'mg/dL', status: 'high', normalRange: '0.6-1.2', interpretation: 'Mildly elevated from decreased renal perfusion' },
      { panel: 'BMP (0645)', name: 'Glucose', value: '112', unit: 'mg/dL', status: 'high', normalRange: '70-110', interpretation: 'Mild stress hyperglycemia' },
      { panel: 'Coagulation', name: 'PT', value: '15', unit: 'sec', status: 'high', normalRange: '11-13.5 sec', interpretation: 'Mildly prolonged, contributing to ongoing bleeding' },
      { panel: 'Coagulation', name: 'INR', value: '1.3', unit: '', status: 'high', normalRange: '0.8-1.1', interpretation: 'Mildly elevated; may require plasma if bleeding continues or worsens' },
      { panel: 'Coagulation', name: 'aPTT', value: '34', unit: 'sec', status: 'normal', normalRange: '25-35 sec', interpretation: 'Within normal limits' },
      { panel: 'Blood Bank', name: 'Type and Crossmatch', value: 'O Positive, PRBCs available', unit: '', status: 'normal', normalRange: 'N/A', interpretation: 'Crossmatched units are ready; two-RN verification is required at the bedside before administration' }
    ],

    diagnostics: [
      { name: 'Type and crossmatch', finding: 'Blood type O positive, PRBCs available', interpretation: 'Crossmatched blood is ready for transfusion; in an emergency before crossmatch, O negative is the universal donor' },
      { name: 'Upper endoscopy (EGD)', finding: 'Anticipated for source identification and hemostasis', interpretation: 'EGD is both diagnostic and therapeutic - it locates the bleeding ulcer and allows clipping, injection, or cautery' },
      { name: 'Stool occult blood / melena', finding: 'History of melena reported today', interpretation: 'Black tarry stool indicates blood that has been digested, confirming an UPPER GI source' }
    ],

    orders: [
      { text: 'Continuous pulse oximetry', category: 'monitoring' },
      { text: 'Vital signs every 15 minutes', category: 'monitoring' },
      { text: 'Maintain SpO2 greater than 95%', category: 'respiratory' },
      { text: 'NPO', category: 'diet' },
      { text: 'Normal Saline 1000 mL bolus IV', category: 'medication' },
      { text: 'Transfuse PRBCs', category: 'procedure' },
      { text: 'Strict intake and output', category: 'monitoring' },
      { text: 'Notify provider for hypotension, tachycardia, or worsening bleeding', category: 'monitoring' },
      { text: 'Pantoprazole 80 mg IV bolus then continuous infusion at 8 mg/hr', category: 'medication' },
      { text: 'Ondansetron 4 mg IV every 6 hours PRN for nausea', category: 'medication' }
    ],

    interventions: [
      { id: 'gib-1', order: 1, action: 'Perform an immediate focused assessment: airway patency during active vomiting, breathing, level of consciousness, skin color and temperature, capillary refill, abdominal assessment, and characterization of the emesis and stool', rationale: 'A patient with active hematemesis is first and foremost an airway patient; the focused assessment establishes both airway risk and shock severity in seconds', category: 'assessment', critical: true, preventsDeterioration: true, atiPearl: 'Active vomiting plus decreasing level of consciousness equals aspiration risk - airway comes before everything' },
      { id: 'gib-2', order: 2, action: 'Identify signs of active bleeding and hypovolemia: bright red hematemesis, melena, pallor, diaphoresis, cool extremities, tachycardia of 104 rising to 118, and the downward blood pressure trend', rationale: 'Recognizing compensated shock before the blood pressure crashes is the clinical judgment being graded; a normal-looking systolic in a patient with a hemoglobin of 6.8 is false reassurance', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'gib-3', order: 3, action: 'Prioritize using the ABCs: position the patient upright or in a lateral position with the head turned to the side, have suction set up and immediately available, and apply oxygen to maintain SpO2 greater than 95 percent', rationale: 'Positioning and suction prevent aspiration of blood, and oxygen partially compensates for the drastically reduced oxygen-carrying capacity of a hemoglobin of 6.8', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Never lay a patient with active hematemesis flat on the back' },
      { id: 'gib-4', order: 4, action: 'Implement provider orders: maintain two large-bore IVs, infuse the 1000 mL normal saline bolus, keep the patient NPO, administer pantoprazole 80 mg IV bolus followed by the 8 mg/hr infusion, and give ondansetron 4 mg IV for nausea', rationale: 'Volume replacement restores preload while the PPI raises gastric pH so the clot over the ulcer can stabilize; NPO status prepares the patient for emergent endoscopy and reduces aspiration risk', category: 'medication', critical: true, preventsDeterioration: true },
      { id: 'gib-5', order: 5, action: 'Safely administer PRBCs per facility policy: verify the provider order and consent, confirm the blood product and patient identity with two RNs at the bedside, use Y-tubing with 0.9 percent normal saline only, obtain baseline vital signs, start slowly and remain with the patient for the first 15 minutes, and complete each unit within 4 hours', rationale: 'Transfusion is the definitive treatment for a hemoglobin of 6.8 with ongoing loss, and the first 15 minutes is when acute hemolytic and anaphylactic reactions appear', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Normal saline is the ONLY solution compatible with blood - dextrose hemolyzes red cells and lactated Ringer causes clotting' },
      { id: 'gib-6', order: 6, action: 'Monitor for signs of deterioration: vital signs every 15 minutes, calculate the pulse pressure, assess capillary refill and mental status, maintain strict intake and output including estimated emesis volume, and watch for transfusion reaction', rationale: 'Narrowing pulse pressure, rising heart rate, falling urine output, and new confusion identify progression to decompensated shock before the blood pressure collapses', category: 'assessment', critical: true, preventsDeterioration: true },
      { id: 'gib-7', order: 7, action: 'Communicate significant findings to the provider using SBAR and notify for hypotension, tachycardia, or worsening bleeding as ordered', rationale: 'The ordered notification parameters have been met; SBAR produces faster orders for additional units, plasma for the elevated INR, and emergent endoscopy', category: 'communication', critical: true, preventsDeterioration: true },
      { id: 'gib-8', order: 8, action: 'Collaborate with the healthcare team: activate the Rapid Response Team, notify GI for emergent endoscopy, and prepare for possible ICU transfer and additional blood products', rationale: 'Endoscopic hemostasis is the definitive intervention; nursing resuscitation only buys time until the bleeding source is controlled', category: 'escalation', critical: true, preventsDeterioration: true },
      { id: 'gib-9', order: 9, action: 'Provide patient and family education: explain the NPO status, the transfusion process and what reactions to report, the reason for frequent vital signs, and the relationship between chronic NSAID use and the bleeding ulcer', rationale: 'A frightened patient who understands the plan is more cooperative, and NSAID avoidance is the single most important behavior change to prevent recurrence', category: 'education', critical: false, preventsDeterioration: false },
      { id: 'gib-10', order: 10, action: 'Document assessments, interventions, and patient responses including emesis characteristics and volume, transfusion times and vital signs, and all provider communication', rationale: 'Accurate estimated blood loss and transfusion documentation drive the resuscitation plan and are legally required', category: 'intervention', critical: false, preventsDeterioration: false }
    ],

    medications: [
      { name: 'Pantoprazole', brand: 'Protonix', classification: 'Proton pump inhibitor', dose: '80 mg IV bolus (given 1015) then continuous infusion at 8 mg/hr', action: 'Irreversibly blocks the gastric hydrogen-potassium ATPase pump, raising gastric pH so platelet aggregation and clot formation over the ulcer can occur and be maintained', onset: '15-30 minutes IV', sideEffects: ['Headache', 'Diarrhea', 'Abdominal pain', 'Hypomagnesemia and increased fracture risk with long-term use', 'Increased risk of C. difficile'], nursingConsiderations: ['Administer the IV bolus over at least 2 minutes; use a dedicated line or flush thoroughly because pantoprazole is incompatible with many drugs', 'Use an infusion pump for the continuous drip and verify the rate', 'Do not mix with other medications in the same line', 'Monitor for resolution of bleeding: check emesis, stool, and serial hemoglobin'], atiTip: 'Clots do not form in an acid environment - the PPI is what lets the clot hold', highAlert: false },
      { name: 'Ondansetron', brand: 'Zofran', classification: 'Serotonin 5-HT3 receptor antagonist antiemetic', dose: '4 mg IV every 6 hours PRN for nausea (given 1030)', action: 'Blocks serotonin receptors in the chemoreceptor trigger zone and the GI tract to prevent vomiting', onset: '5-15 minutes IV', sideEffects: ['Headache', 'Constipation', 'Dizziness', 'QT prolongation and torsades de pointes'], nursingConsiderations: ['Administer IV over at least 30 seconds to 2 minutes; rapid push increases the risk of dysrhythmia', 'Monitor the cardiac rhythm and QT interval, especially with electrolyte abnormalities', 'Controlling vomiting directly protects the airway and reduces further mechanical trauma to the bleeding ulcer', 'Reassess nausea and emesis after administration'], atiTip: 'Ondansetron prolongs the QT - check the potassium and magnesium', highAlert: false },
      { name: 'Packed Red Blood Cells', brand: 'PRBC', classification: 'Blood product', dose: 'Transfuse PRBCs; transfusion initiated at 1030. Patient blood type O positive.', action: 'Directly restores red cell mass, hemoglobin, and oxygen-carrying capacity; each unit typically raises the hemoglobin by about 1 g/dL', onset: 'Immediate volume effect; hemoglobin rise measurable 15 minutes to 1 hour after completion', sideEffects: ['Acute hemolytic reaction', 'Febrile nonhemolytic reaction', 'Allergic and anaphylactic reactions', 'Transfusion-associated circulatory overload (TACO)', 'Transfusion-related acute lung injury (TRALI)', 'Hypocalcemia and hyperkalemia with massive transfusion'], nursingConsiderations: ['Verify the order, informed consent, and blood bank tag with two RNs at the bedside', 'Use Y-tubing with a filter and 0.9 percent normal saline ONLY', 'Obtain baseline vital signs, then stay with the patient for the first 15 minutes at a slow rate', 'Recheck vital signs at 15 minutes, then per policy, and at completion', 'Complete each unit within 4 hours to prevent bacterial growth', 'For any suspected reaction: STOP the transfusion, keep the IV open with normal saline using NEW tubing, assess the patient, notify the provider and blood bank, and return the bag and tubing'], atiTip: 'Stop the transfusion first, then normal saline with new tubing, then notify - in that order', highAlert: true },
      { name: '0.9% Sodium Chloride', brand: 'Normal Saline', classification: 'Isotonic crystalloid', dose: '1000 mL IV bolus (given 1000)', action: 'Rapidly expands intravascular volume to maintain preload and perfusion pressure until blood products are available', onset: 'Immediate', sideEffects: ['Fluid overload', 'Dilutional anemia and coagulopathy with large volumes', 'Hyperchloremic acidosis'], nursingConsiderations: ['Crystalloid replaces volume but carries no oxygen - it is a bridge to blood, not a substitute', 'Use large-bore IV access (18 gauge or larger) for rapid infusion and for blood administration', 'Reassess blood pressure, heart rate, and lung sounds after each bolus', 'The only crystalloid compatible with blood products'], atiTip: 'Saline fills the tank; only blood carries the oxygen', highAlert: false }
    ],

    sbar: {
      situation: 'This is the RN on the med/surg unit calling about John Smith in room 226, a 72-year-old male admitted today with an acute upper GI bleed. He is having active bright red hematemesis and I believe he is going into hypovolemic shock.',
      background: 'He has a history of peptic ulcer disease, osteoarthritis, and chronic NSAID use. He reported dizziness at 0600, worsening epigastric pain at 0800, and active hematemesis beginning at 1000. He has received 1 liter of normal saline, pantoprazole 80 mg IV, ondansetron 4 mg IV, and the first unit of PRBCs was started at 1030. He is NPO, has no known drug allergies, and is a full code.',
      assessment: 'His vital signs have gone from 118/76 with a heart rate of 88 at 0600 to 84/50 with a heart rate of 130 now. Respirations are 28, SpO2 is 90 percent, his skin is cool and clammy, capillary refill is over 4 seconds, and he has become restless and confused. Urine output is less than 20 mL this hour. His hemoglobin is 6.8 with a hematocrit of 21, BUN 34, creatinine 1.3, and INR 1.3. He has had a second episode of bright red hematemesis of about 250 mL.',
      recommendation: 'I recommend additional PRBC units, evaluation for plasma given the INR of 1.3, an emergent GI consult for endoscopy, and ICU transfer. I have the Rapid Response Team at the bedside, suction is set up, and I need you to come evaluate him for airway protection now.'
    },

    questions: [
      { id: 'ms2-gi-bleed-q1', text: 'The patient begins actively vomiting bright red blood and is becoming increasingly lethargic. What is the nurse PRIORITY action?', type: 'multiple-choice', options: ['Turn the patient to the side and apply suction to protect the airway', 'Obtain a set of vital signs', 'Increase the rate of the PRBC transfusion', 'Notify the provider of the change in condition'], correct: [0], rationale: 'A lethargic patient with active hematemesis has lost the ability to protect the airway and is at immediate risk of aspirating blood. Airway always precedes breathing and circulation. Positioning and suction take seconds and prevent an airway catastrophe. Vital signs, transfusion adjustments, and provider notification all follow immediately after, but none of them keeps blood out of the lungs.', atiPearl: 'Airway before circulation, even in a hemorrhaging patient', difficulty: 'Medium' },
      { id: 'ms2-gi-bleed-q2', text: 'Which laboratory finding is MOST consistent with an upper gastrointestinal source of bleeding rather than a lower GI source?', type: 'multiple-choice', options: ['Hemoglobin of 6.8 g/dL', 'BUN of 34 mg/dL with a creatinine of 1.3 mg/dL', 'Platelet count of 280,000', 'WBC of 9.8'], correct: [1], rationale: 'A BUN elevated out of proportion to the creatinine is characteristic of upper GI bleeding. Blood in the upper GI tract is digested as protein, absorbed, and metabolized to urea, driving the BUN up, and renal hypoperfusion adds to it. A low hemoglobin occurs with bleeding from any site, and the platelet count and WBC are normal here.', atiPearl: 'Disproportionately elevated BUN with a near-normal creatinine points upstream to an upper GI bleed', difficulty: 'Hard' },
      { id: 'ms2-gi-bleed-q3', text: 'The nurse is preparing to administer packed red blood cells. Which solution may be used with the blood tubing?', type: 'multiple-choice', options: ['0.9% sodium chloride', 'Lactated Ringer solution', '5% dextrose in water', '0.45% sodium chloride'], correct: [0], rationale: 'Only 0.9 percent sodium chloride is compatible with blood products. Dextrose solutions are hypotonic relative to the cells and cause hemolysis. Lactated Ringer contains calcium, which can overcome the citrate anticoagulant in the blood bag and cause clotting in the tubing. Hypotonic saline also causes red cell lysis.', atiPearl: 'Blood and normal saline only - nothing else touches the blood tubing', difficulty: 'Easy' },
      { id: 'ms2-gi-bleed-q4', text: 'Fifteen minutes into the PRBC transfusion the patient develops chills, a temperature increase from 98.4 F to 100.6 F, flank pain, and dark urine. Place the nurse actions in the correct priority order by selecting the FIRST action.', type: 'multiple-choice', options: ['Stop the transfusion immediately', 'Notify the blood bank', 'Administer acetaminophen', 'Send the blood bag and tubing to the laboratory'], correct: [0], rationale: 'Stopping the transfusion is always first because every additional milliliter of incompatible blood worsens the hemolysis. The correct sequence is: stop the transfusion, disconnect the blood and maintain the IV with normal saline using NEW tubing, assess the patient and take vital signs, notify the provider and blood bank, then send the bag, tubing, and required specimens to the laboratory. Flank pain with dark urine and fever suggests an acute hemolytic reaction, which is life threatening.', atiPearl: 'Transfusion reaction: STOP first, saline with new tubing second, notify third', difficulty: 'Medium' },
      { id: 'ms2-gi-bleed-q5', text: 'How does pantoprazole help control this patient upper GI bleed?', type: 'multiple-choice', options: ['It coats the ulcer with a protective barrier', 'It raises gastric pH so that platelets can aggregate and the clot over the ulcer stays stable', 'It causes vasoconstriction of the bleeding vessel', 'It neutralizes acid already present in the stomach'], correct: [1], rationale: 'Platelet aggregation and clot formation are severely impaired in an acidic environment, and existing clots are dissolved by pepsin at a low pH. Pantoprazole blocks the gastric proton pump, raising the pH so the clot over the ulcer can form and hold. Sucralfate coats the ulcer, antacids neutralize existing acid, and octreotide causes splanchnic vasoconstriction - each is a different drug with a different mechanism.', atiPearl: 'PPI equals clot stability; sucralfate equals physical coating; octreotide equals vasoconstriction', difficulty: 'Medium' },
      { id: 'ms2-gi-bleed-q6', text: 'Select ALL findings that indicate this patient is progressing from compensated to DECOMPENSATED hypovolemic shock.', type: 'select-all', options: ['New onset restlessness and confusion', 'Capillary refill greater than 4 seconds', 'Urine output of less than 20 mL in the past hour', 'Narrowing pulse pressure', 'Report of epigastric burning pain', 'Blood pressure falling from 108/68 to 84/50'], correct: [0, 1, 2, 3, 5], rationale: 'Decompensation is defined by failing perfusion of vital organs: cerebral hypoperfusion produces restlessness then confusion, peripheral vasoconstriction delays capillary refill, renal hypoperfusion drops urine output below 0.5 mL/kg/hr, and compensatory vasoconstriction narrows the pulse pressure before the systolic finally falls. Epigastric pain is the presenting symptom of the ulcer itself and is present throughout, so it does not mark decompensation.', atiPearl: 'Mental status and urine output are the two best bedside perfusion monitors', difficulty: 'Hard' },
      { id: 'ms2-gi-bleed-q7', text: 'The patient asks the nurse why his stools have been black and tarry. What is the nurse best response?', type: 'multiple-choice', options: ['"That means you are bleeding from your colon or rectum."', '"Black tarry stool, called melena, means blood from higher up in your stomach has been digested on its way through."', '"That is a normal side effect of the medication we gave you."', '"It means the bleeding has stopped and old blood is clearing out."'], correct: [1], rationale: 'Melena is black, tarry, foul-smelling stool produced when blood from an upper GI source is broken down by gastric acid and intestinal bacteria during transit. Bright red blood per rectum (hematochezia) suggests a lower GI source or very brisk upper bleeding. Melena does not indicate the bleeding has stopped, and no medication given here causes it - though iron supplements and bismuth can darken stool without the tarry consistency.', atiPearl: 'Melena equals upper GI; hematochezia equals lower GI or massive rapid upper bleed', difficulty: 'Easy' },
      { id: 'ms2-gi-bleed-q8', text: 'The patient hemoglobin is 6.8 g/dL. Which assessment finding is the direct physiologic consequence of this value?', type: 'multiple-choice', options: ['Epigastric pain', 'Nausea', 'Pallor, weakness, and tachycardia from reduced oxygen-carrying capacity', 'Elevated white blood cell count'], correct: [2], rationale: 'Hemoglobin carries essentially all of the oxygen in blood. At 6.8 g/dL the oxygen-carrying capacity is roughly half of normal, so tissues become hypoxic. The body compensates with tachycardia to increase cardiac output and shunts blood away from the skin, producing pallor, weakness, dizziness, and dyspnea. Note that the SpO2 can still read in the 90s because it measures the percentage of available hemoglobin that is saturated, not how much hemoglobin there is.', atiPearl: 'A normal SpO2 with a hemoglobin of 6.8 is deceptive - saturation percentage does not measure oxygen content', difficulty: 'Hard' },
      { id: 'ms2-gi-bleed-q9', text: 'The provider orders emergency transfusion before the crossmatch is complete for a different patient with unknown blood type. Which blood product should the nurse expect?', type: 'multiple-choice', options: ['O negative packed red blood cells', 'AB positive packed red blood cells', 'O positive whole blood', 'Type-specific plasma'], correct: [0], rationale: 'O negative red cells are the universal donor because they carry no A, B, or Rh D antigens and can be given to any recipient without crossmatch. AB positive is the universal recipient plasma type, not a universal red cell donor. Note that this specific patient has already been typed and crossmatched as O positive with units available, so he should receive his own type-specific crossmatched blood.', atiPearl: 'O negative is the universal red cell donor; AB is the universal plasma donor', difficulty: 'Medium' },
      { id: 'ms2-gi-bleed-q10', text: 'Which discharge teaching is MOST important for preventing recurrence of this patient upper GI bleed?', type: 'multiple-choice', options: ['"Avoid NSAIDs such as ibuprofen and naproxen, and talk with your provider about safer options for your arthritis pain."', '"Drink a glass of milk before bed every night to coat your stomach."', '"Increase your intake of citrus juice and coffee to promote healing."', '"Take your NSAIDs on an empty stomach so they absorb faster."'], correct: [0], rationale: 'Chronic NSAID use is the direct cause of this patient bleeding ulcer. NSAIDs inhibit prostaglandins that maintain the protective gastric mucosal barrier and also impair platelet function. Eliminating them, with the provider substituting acetaminophen or another strategy for his osteoarthritis, is the single highest-yield prevention. Milk transiently buffers but then stimulates rebound acid secretion, citrus and coffee are gastric irritants, and taking NSAIDs on an empty stomach maximizes mucosal injury.', atiPearl: 'NSAID plus peptic ulcer disease equals bleeding waiting to happen - always review the home medication list', difficulty: 'Easy' },
      { id: 'ms2-gi-bleed-q11', text: 'The nurse is monitoring this patient during the transfusion. Which finding would suggest transfusion-associated circulatory overload (TACO) rather than an acute hemolytic reaction?', type: 'multiple-choice', options: ['Flank pain and dark red urine', 'Dyspnea, crackles in the lung bases, jugular venous distention, and a rising blood pressure', 'Hives and generalized itching', 'A temperature increase of 1.8 F with chills and no other symptoms'], correct: [1], rationale: 'TACO is volume overload from transfusing too much too fast, especially in older adults, and produces the picture of acute heart failure: dyspnea, crackles, JVD, and a RISING blood pressure. An acute hemolytic reaction produces fever, chills, flank pain, and hemoglobinuria with hypotension. Hives and itching indicate an allergic reaction. An isolated temperature rise with chills is a febrile nonhemolytic reaction. For any of these, the transfusion is stopped first.', atiPearl: 'TACO means blood pressure UP with crackles; hemolytic reaction means blood pressure DOWN with flank pain', difficulty: 'Hard' },
      { id: 'ms2-gi-bleed-q12', text: 'The nurse is planning care for this patient. Which order should the nurse question?', type: 'multiple-choice', options: ['Keep the patient NPO', 'Administer ibuprofen 600 mg PO every 6 hours for the patient arthritis pain', 'Insert two large-bore IV catheters', 'Vital signs every 15 minutes'], correct: [1], rationale: 'An NSAID is absolutely contraindicated in a patient with an actively bleeding peptic ulcer - it is the cause of the bleed, it further impairs the gastric mucosal barrier, and it inhibits platelet function in a patient who is hemorrhaging. It is also oral, which violates the NPO status needed for emergent endoscopy. NPO status, large-bore access for volume and blood, and frequent vital signs are all appropriate and expected.', atiPearl: 'Never give an NSAID to a patient with a GI bleed - question the order and call the provider', difficulty: 'Medium' },
      { id: 'ms2-gi-bleed-q13', text: 'Select ALL nursing actions required for safe administration of packed red blood cells.', type: 'select-all', options: ['Verify the blood product and patient identity with a second RN at the bedside', 'Obtain baseline vital signs before initiating the transfusion', 'Remain with the patient for the first 15 minutes of the transfusion', 'Complete the infusion of each unit within 4 hours', 'Prime the tubing with 5% dextrose in water', 'Infuse the first 15 minutes at a slow rate'], correct: [0, 1, 2, 3, 5], rationale: 'Two-RN bedside verification, baseline vital signs, staying with the patient at a slow rate for the first 15 minutes when severe reactions appear, and completing each unit within 4 hours to prevent bacterial proliferation are all required safety steps. Priming with dextrose is never acceptable because it causes hemolysis - only 0.9 percent sodium chloride may be used.', atiPearl: 'The first 15 minutes at the bedside is the highest-yield transfusion safety intervention there is', difficulty: 'Medium' }
    ],

    keyPoints: [
      'Upper GI bleeding presents with hematemesis, coffee-ground emesis, and melena; lower GI bleeding presents with hematochezia',
      'Bright red hematemesis means brisk active bleeding; coffee-ground emesis means blood that has been in contact with gastric acid',
      'A BUN elevated out of proportion to the creatinine is a hallmark of upper GI bleeding',
      'In compensated shock the blood pressure can stay near normal while the heart rate rises and the pulse pressure narrows',
      'Confusion and restlessness in a bleeding patient signal cerebral hypoperfusion',
      'Hemoglobin of 6.8 g/dL is a critical value requiring transfusion',
      'Only 0.9 percent sodium chloride may be infused with blood products',
      'Stay with the patient for the first 15 minutes of a transfusion - that is when severe reactions occur',
      'For any transfusion reaction: stop the transfusion first, then normal saline with new tubing, then notify',
      'Chronic NSAID use is the most common reversible cause of bleeding peptic ulcers'
    ],

    pearls: [
      'A normal SpO2 does not mean adequate oxygen delivery when the hemoglobin is 6.8',
      'Never lay a patient with active hematemesis flat on their back',
      'Estimate and document emesis volume - it drives the resuscitation plan',
      'Each unit of PRBCs raises the hemoglobin by approximately 1 g/dL',
      'Watch for hypocalcemia and hyperkalemia during massive transfusion',
      'The definitive treatment for a bleeding ulcer is endoscopic hemostasis, not nursing resuscitation'
    ],

    successChecklist: [
      'Perform an immediate focused assessment',
      'Identify signs of active bleeding and hypovolemia',
      'Prioritize interventions using the ABCs',
      'Implement provider orders appropriately',
      'Monitor for signs of deterioration',
      'Communicate significant findings using SBAR',
      'Safely administer blood products according to facility policy',
      'Provide patient and family education',
      'Collaborate with the healthcare team',
      'Document assessments, interventions, and patient responses'
    ],

    criticalErrors: [
      'Laying the patient flat on the back during active hematemesis',
      'Failing to have suction set up and immediately available',
      'Administering any NSAID to this patient',
      'Giving the patient anything by mouth when the order is NPO and endoscopy is anticipated',
      'Priming or flushing blood tubing with dextrose or lactated Ringer solution',
      'Failing to perform two-RN bedside verification before starting the transfusion',
      'Leaving the patient alone during the first 15 minutes of the transfusion',
      'Continuing a transfusion after signs of a reaction appear',
      'Restarting a transfusion through the same tubing after a suspected reaction',
      'Being falsely reassured by a systolic blood pressure of 108 in a patient with a hemoglobin of 6.8',
      'Failing to notify the provider for the ordered parameters of hypotension, tachycardia, or worsening bleeding',
      'Using a small-gauge IV catheter for rapid volume and blood resuscitation'
    ],

    comparisons: [
      {
        title: 'Upper vs Lower GI Bleeding',
        headers: ['Feature', 'Upper GI Bleed', 'Lower GI Bleed'],
        rows: [
          ['Source', 'Esophagus, stomach, duodenum (above ligament of Treitz)', 'Small bowel distal, colon, rectum'],
          ['Vomiting blood', 'Hematemesis or coffee-ground emesis', 'Absent'],
          ['Stool', 'Melena - black, tarry, foul smelling', 'Hematochezia - bright red blood'],
          ['BUN', 'Elevated out of proportion to creatinine', 'Usually normal'],
          ['Common causes', 'Peptic ulcer, NSAIDs, esophageal varices, gastritis', 'Diverticulosis, hemorrhoids, angiodysplasia, cancer'],
          ['Diagnostic test', 'Upper endoscopy (EGD)', 'Colonoscopy']
        ]
      },
      {
        title: 'Transfusion Reactions',
        headers: ['Reaction', 'Key Signs', 'Timing'],
        rows: [
          ['Acute hemolytic', 'Fever, chills, flank pain, dark urine, hypotension, chest pain', 'Within the first 15 minutes'],
          ['Febrile nonhemolytic', 'Temperature rise of 1.8 F or more with chills, no other symptoms', '30 minutes to 6 hours'],
          ['Allergic', 'Hives, itching, flushing; anaphylaxis if severe', 'Minutes to hours'],
          ['TACO', 'Dyspnea, crackles, JVD, HYPERtension', 'During or within 6 hours'],
          ['TRALI', 'Acute dyspnea, hypoxemia, bilateral infiltrates, HYPOtension', 'Within 6 hours']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'I am sorry, I made a mess. It just came up out of nowhere. There was so much blood. Is that... is that supposed to happen?' },
      { speaker: 'patient', trigger: 'pain', line: 'It burns right here, under my breastbone. Like somebody is holding a match to the inside of my stomach. It is an eight, maybe worse.' },
      { speaker: 'patient', trigger: 'assessment', line: 'Everything is spinning. When I sat up a minute ago I thought I was going to pass out. And I am freezing but I am soaked in sweat.' },
      { speaker: 'patient', trigger: 'history', line: 'They told me years back I had an ulcer. But my knees, my hands, everything hurts, so I have been taking eight, maybe ten ibuprofen a day just to get through the day. Sometimes more.' },
      { speaker: 'patient', trigger: 'breathing', line: 'I feel like I cannot get enough air, and I have not even done anything. I am just lying here.' },
      { speaker: 'patient', trigger: 'medication', line: 'Are you giving me somebody else blood? I do not know how I feel about that. Will it make me sick?' },
      { speaker: 'patient', trigger: 'deterioration', line: 'Wait... where did everybody go? I need to get up. I have to get up. Something is wrong, I know something is wrong.' },
      { speaker: 'family', trigger: 'greeting', line: 'I am his wife. He has been going to the bathroom all week and the stool was black as tar. I told him to call the doctor but he said it was nothing.' },
      { speaker: 'family', trigger: 'history', line: 'He buys the big bottles of ibuprofen at the warehouse store. I told him that could not be good for him but he says it is the only thing that touches his arthritis.' },
      { speaker: 'family', trigger: 'escalation', line: 'Why is he talking like that? He does not even know where he is. Please, somebody do something.' }
    ],

    patientEducation: [
      'Stop taking NSAIDs such as ibuprofen, naproxen, and aspirin; work with your provider on a safer plan for your arthritis pain',
      'Always read over-the-counter labels - many combination cold and pain products contain hidden NSAIDs',
      'Take your prescribed acid-reducing medication exactly as ordered and complete the full course',
      'Avoid alcohol, tobacco, and caffeine, all of which irritate the stomach lining and delay ulcer healing',
      'Report immediately: black tarry stools, vomiting blood or material that looks like coffee grounds, dizziness, fainting, or worsening weakness',
      'Eat smaller, more frequent meals and avoid foods that trigger your symptoms',
      'If you are prescribed treatment for H. pylori, take every dose of every antibiotic to eradicate the infection',
      'Expect fatigue while your blood count recovers; change positions slowly to prevent falls from dizziness',
      'Keep all follow-up appointments for repeat blood counts and any scheduled endoscopy',
      'Learn the signs of anemia - fatigue, pallor, shortness of breath with activity, and rapid heartbeat - and report them'
    ]
  },

  // ==========================================================================
  // 4. ACUTE LIVER FAILURE WITH HEPATIC ENCEPHALOPATHY
  // ==========================================================================
  {
    id: 'ms2-liver-failure',
    title: 'Acute Liver Failure',
    fullTitle: 'Acute Liver Failure with Hepatic Encephalopathy Secondary to Acetaminophen Toxicity',
    category: 'Med-Surg 2',
    course: 'NUR2212C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'LIVER',
    summary: 'A 72-year-old woman with acetaminophen-induced acute liver failure presents with jaundice, asterixis, ammonia of 118, INR 2.8, and worsening hepatic encephalopathy progressing toward cerebral edema.',
    highYield: true,

    objectives: [
      'Describe the pathophysiology of acute liver failure',
      'Discuss causes of hepatic encephalopathy',
      'Recognize manifestations of liver dysfunction and neurological deterioration',
      'Interpret liver function studies and coagulation studies',
      'Interpret ammonia levels and their relationship to encephalopathy',
      'Perform focused gastrointestinal and neurological assessments',
      'Recognize signs of cerebral edema and increased intracranial pressure',
      'Implement seizure and fall precautions',
      'Utilize SBAR communication',
      'Recognize indications for Rapid Response Team activation and ICU transfer'
    ],

    patient: {
      name: 'Jane Smith',
      age: '72 years',
      dob: '06/26/1954',
      sex: 'Female',
      weightKg: 88,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Acute liver failure with hepatic encephalopathy, suspected secondary to acetaminophen toxicity',
      history: [
        'Admitted yesterday through the Emergency Department with acute liver failure',
        'Height 175 cm, weight 88 kg',
        'Several days of nausea, vomiting, abdominal pain, jaundice, and fatigue with worsening confusion',
        'Family reports increasing forgetfulness, excessive sleepiness, and difficulty arousing her',
        'Yesterday 2200: nausea, vomiting, and abdominal pain; family reports increasing confusion',
        'Today 0600: jaundice observed with increasing lethargy',
        'Today 0922: difficulty answering questions; fall precautions initiated',
        'Med/surg unit, no isolation precautions, low fat and low protein diet'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - Today 1000 (assuming care at 1530)',
        bp: '106/62', hr: 112, rr: 24, temp: '100.0 F', spo2: 96,
        pain: '4/10 right upper quadrant abdominal discomfort',
        loc: 'Lethargic with delayed responses, oriented to person and sometimes place, asterixis present',
        other: 'Scleral icterus and generalized jaundice. Nausea and vomiting. Sinus tachycardia. Fall precautions in place since 0922. Received lactulose 30 mL PO at 0900 and 1200, N-acetylcysteine bolus at 0930 with the 4.4 g maintenance dose in 250 mL D5W at 1500.',
        flags: ['tachycardia', 'tachypnea', 'jaundice', 'asterixis', 'altered-mental-status'],
        note: 'Documented trend: 0800 BP 118/72, HR 94, RR 15, Temp 98.8 F, SpO2 96%. Over two hours the heart rate rose 18 points and the respiratory rate rose 9. With an ammonia of 118 and an INR of 2.8 the neurologic picture is the number to watch, not the blood pressure. Asterixis is stage II hepatic encephalopathy.'
      },
      {
        atMin: 6,
        label: 'Progression to stage III encephalopathy',
        bp: '100/58', hr: 118, rr: 26, temp: '100.2 F', spo2: 94,
        pain: 'Difficult to assess reliably',
        loc: 'Somnolent, arouses only to loud voice, markedly confused, cannot follow simple commands, asterixis worsening',
        other: 'Slurred speech, fetor hepaticus noted, mild agitation when stimulated. Has not had a bowel movement since the 0900 lactulose dose.',
        flags: ['worsening-encephalopathy', 'somnolence', 'hypoxemia-trending'],
        note: 'Rising serum ammonia crosses the blood-brain barrier, is converted to glutamine in astrocytes, and draws water into the cells - this is why encephalopathy and cerebral edema go together. The absence of a bowel movement means the lactulose is not yet clearing ammonia. Airway protection becomes a real concern at stage III.'
      },
      {
        atMin: 12,
        label: 'Stage IV encephalopathy and cerebral edema',
        bp: '94/54', hr: 124, rr: 28, temp: '100.4 F', spo2: 92,
        pain: 'Unable to report',
        loc: 'Responds only to painful stimuli, no verbal response, pupils sluggishly reactive',
        other: 'Gag reflex diminished, unable to protect airway, oozing from the peripheral IV site and gums',
        flags: ['critical', 'coma', 'airway-risk', 'bleeding', 'cerebral-edema'],
        note: 'Stage IV hepatic encephalopathy is coma. With an INR of 2.8 and platelets of 88,000 the mucosal oozing signals coagulopathy of liver failure. This patient needs the Rapid Response Team, airway protection, and ICU transfer for intracranial pressure management. Head of bed at 30 degrees with the head midline to promote venous drainage.'
      },
      {
        atMin: 17,
        label: 'Increased intracranial pressure - Cushing triad',
        bp: '152/60', hr: 56, rr: 'Irregular, 10-12 with periods of apnea', temp: '101.0 F', spo2: 89,
        pain: 'Unresponsive',
        loc: 'Unresponsive, posturing to noxious stimuli, pupils unequal and sluggish',
        other: 'Widened pulse pressure of 92, bradycardia, irregular respirations',
        flags: ['critical', 'increased-icp', 'cushing-triad', 'herniation-risk'],
        note: 'Cushing triad - hypertension with a widened pulse pressure, bradycardia, and irregular respirations - is a LATE sign of dangerously increased intracranial pressure and impending herniation. Cerebral edema is the leading cause of death in acute liver failure. This is an emergency requiring immediate intubation, osmotic therapy, and neurocritical care.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'WBC', value: '13.2', unit: 'K/uL', status: 'high', normalRange: '5-10', interpretation: 'Leukocytosis from hepatic inflammation and necrosis; patients in liver failure are also immunocompromised and prone to infection' },
      { panel: 'CBC', name: 'RBC', value: '4.3', unit: 'M/uL', status: 'normal', normalRange: '4.2-5.4', interpretation: 'Normal - no active bleeding yet despite the coagulopathy' },
      { panel: 'CBC', name: 'Hemoglobin', value: '13.8', unit: 'g/dL', status: 'normal', normalRange: '12-16', interpretation: 'Normal baseline; trend it closely given the bleeding risk' },
      { panel: 'CBC', name: 'Hematocrit', value: '41', unit: '%', status: 'normal', normalRange: '37-47', interpretation: 'Normal' },
      { panel: 'CBC', name: 'Platelets', value: '88,000', unit: '/uL', status: 'low', normalRange: '150,000-400,000', interpretation: 'Thrombocytopenia adds to the coagulopathy; implement bleeding precautions and avoid IM injections and invasive procedures' },
      { panel: 'BMP', name: 'Sodium', value: '136', unit: 'mEq/L', status: 'normal', normalRange: '135-145', interpretation: 'Normal; avoid hyponatremia because it worsens cerebral edema' },
      { panel: 'BMP', name: 'Potassium', value: '4.8', unit: 'mEq/L', status: 'normal', normalRange: '3.5-5.0', interpretation: 'High-normal; lactulose-induced diarrhea can drop it, and hypokalemia increases ammonia production' },
      { panel: 'BMP', name: 'BUN', value: '24', unit: 'mg/dL', status: 'high', normalRange: '10-20', interpretation: 'Elevated; note that a failing liver may produce LESS urea, so a normal BUN can mask renal injury here' },
      { panel: 'BMP', name: 'Creatinine', value: '1.4', unit: 'mg/dL', status: 'high', normalRange: '0.6-1.2', interpretation: 'Renal impairment - concerning for hepatorenal syndrome or acetaminophen-related renal injury' },
      { panel: 'BMP', name: 'Glucose', value: '78', unit: 'mg/dL', status: 'normal', normalRange: '70-110', interpretation: 'Low-normal and dangerous in this context - the failing liver cannot perform gluconeogenesis or release glycogen, so hypoglycemia is expected; monitor bedside glucose frequently' },
      { panel: 'Liver Function', name: 'AST', value: '2,850', unit: 'U/L', status: 'critical-high', normalRange: '10-40', interpretation: 'Massive hepatocellular necrosis, a pattern typical of acetaminophen toxicity' },
      { panel: 'Liver Function', name: 'ALT', value: '3,200', unit: 'U/L', status: 'critical-high', normalRange: '7-56', interpretation: 'Massive hepatocyte injury; ALT is more liver specific than AST' },
      { panel: 'Liver Function', name: 'Total Bilirubin', value: '8.4', unit: 'mg/dL', status: 'critical-high', normalRange: '0.2-1.2', interpretation: 'The liver cannot conjugate and excrete bilirubin, producing the jaundice, scleral icterus, and pruritus' },
      { panel: 'Liver Function', name: 'Albumin', value: '2.8', unit: 'g/dL', status: 'low', normalRange: '3.5-5.0', interpretation: 'Reduced hepatic synthesis lowers oncotic pressure, contributing to ascites and peripheral edema' },
      { panel: 'Liver Function', name: 'Ammonia', value: '118', unit: 'mcg/dL', status: 'critical-high', normalRange: '15-45', interpretation: 'The failing liver cannot convert ammonia to urea; ammonia crosses the blood-brain barrier and causes astrocyte swelling, encephalopathy, and cerebral edema' },
      { panel: 'Coagulation', name: 'PT', value: '28', unit: 'sec', status: 'critical-high', normalRange: '11-13 sec', interpretation: 'The liver synthesizes nearly all clotting factors; a prolonged PT is one of the most sensitive markers of hepatic synthetic failure' },
      { panel: 'Coagulation', name: 'INR', value: '2.8', unit: '', status: 'critical-high', normalRange: '0.8-1.2', interpretation: 'Severe coagulopathy - an INR of 1.5 or greater with encephalopathy defines acute liver failure and is a transplant listing criterion' },
      { panel: 'Perfusion Marker', name: 'GFR', value: '18', unit: 'mL/min/1.73m2', status: 'critical-low', normalRange: 'greater than 90', interpretation: 'Severely reduced glomerular filtration as charted. Note the internal inconsistency in this chart: a creatinine of 1.4 in a 72-year-old woman usually estimates a GFR near 36 to 38, not 18, so the nurse should verify the result and the reporting equation with the laboratory before acting on it. Either way, the charted GFR mandates that renally cleared and nephrotoxic drugs be dose-adjusted, contrast avoided when possible, and strict hourly intake and output maintained. Verifying a lab that does not fit the clinical picture is itself the nursing action.' }
    ],

    diagnostics: [
      { name: 'Serial neurologic assessment / hepatic encephalopathy staging', finding: 'Stage II on arrival with asterixis and lethargy, progressing during the shift', interpretation: 'Stage I confusion, stage II asterixis and lethargy, stage III somnolence and incoherence, stage IV coma. Progression drives escalation and ICU transfer.' },
      { name: 'Asterixis (liver flap) assessment', finding: 'Present - flapping tremor with wrists extended', interpretation: 'A classic bedside sign of hepatic encephalopathy that can be reassessed at no cost every hour' },
      { name: 'Acetaminophen level and toxicology', finding: 'Suspected acetaminophen toxicity as the etiology', interpretation: 'Determines N-acetylcysteine dosing; NAC is most effective within 8 to 10 hours of ingestion but is still given late in established liver failure' }
    ],

    orders: [
      { text: 'Neuro checks every hour', category: 'monitoring' },
      { text: 'Bedside blood glucose every 4 hours and with any change in mental status', category: 'monitoring' },
      { text: 'Fall precautions', category: 'monitoring' },
      { text: 'Seizure precautions', category: 'monitoring' },
      { text: 'Continuous cardiac monitoring', category: 'monitoring' },
      { text: 'Strict intake and output', category: 'monitoring' },
      { text: 'N-Acetylcysteine 4.4 g IV in 250 mL D5W over 1 hour', category: 'medication' },
      { text: 'Lactulose 30 mL PO every 6 hours', category: 'medication' },
      { text: 'Daily weight', category: 'monitoring' },
      { text: 'Notify provider for worsening neurological status', category: 'monitoring' }
    ],

    interventions: [
      { id: 'alf-1', order: 1, action: 'Receive and review the patient chart, including the acetaminophen toxicity etiology, the documented neurologic decline from yesterday 2200 through today 0922, and the ammonia, INR, and liver function results', rationale: 'The chart documents a clear downward neurologic trajectory over 18 hours, which frames every assessment and predicts further decline', category: 'assessment', critical: false, preventsDeterioration: false },
      { id: 'alf-2', order: 3, action: 'Verify patient identity using two identifiers', rationale: 'National Patient Safety Goal; a confused patient cannot reliably state her own name and birthdate, so the armband must be used', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'alf-3', order: 2, action: 'Perform hand hygiene and apply standard precautions', rationale: 'Patients in liver failure are functionally immunocompromised and infection is a leading precipitant of worsening encephalopathy', category: 'intervention', critical: true, preventsDeterioration: false },
      { id: 'alf-4', order: 4, action: 'Perform a focused neurological and gastrointestinal assessment: level of consciousness, orientation, ability to follow commands, pupils, asterixis, speech, fetor hepaticus, abdominal girth and tenderness, jaundice, and bowel movement pattern', rationale: 'Encephalopathy staging is the single most important assessment in acute liver failure; the number of stools also determines whether lactulose is working', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Assess asterixis by having the patient extend the arms with wrists dorsiflexed - the flap is hepatic encephalopathy' },
      { id: 'alf-5', order: 5, action: 'Review laboratory and diagnostic findings: ammonia 118, INR 2.8, PT 28, platelets 88,000, AST 2,850, ALT 3,200, total bilirubin 8.4, albumin 2.8, glucose 78, creatinine 1.4, and GFR 18', rationale: 'These values simultaneously establish encephalopathy risk, bleeding risk, hypoglycemia risk, and renal impairment, each of which changes the nursing plan', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'alf-6', order: 6, action: 'Recognize manifestations of acute liver failure and identify worsening hepatic encephalopathy by staging the patient and comparing to the previous assessment', rationale: 'Recognition of progression from stage II to stage III is the trigger for escalation and airway planning; waiting for stage IV means the airway is already lost', category: 'assessment', critical: true, preventsDeterioration: true },
      { id: 'alf-7', order: 7, action: 'Prioritize interventions using the ABCs and neurological assessment: assess airway protection and gag reflex, elevate the head of the bed to 30 degrees with the head midline, maintain oxygenation, and never leave a stage III or IV patient unattended', rationale: 'A patient who cannot protect the airway will aspirate, and head elevation with midline positioning promotes cerebral venous drainage to limit intracranial pressure', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Head of bed 30 degrees, head midline, avoid neck flexion and hip flexion - all promote venous outflow from the brain' },
      { id: 'alf-8', order: 8, action: 'Implement provider orders: neuro checks every hour, fall precautions, seizure precautions with padded rails and suction at the bedside, continuous cardiac monitoring, strict intake and output, daily weight, and administer lactulose 30 mL PO every 6 hours and N-acetylcysteine 4.4 g IV in 250 mL D5W over 1 hour', rationale: 'Lactulose lowers serum ammonia by acidifying the colon and trapping ammonium for excretion, and N-acetylcysteine restores glutathione to limit ongoing acetaminophen-mediated hepatocyte death', category: 'medication', critical: true, preventsDeterioration: true, atiPearl: 'The therapeutic endpoint for lactulose is 2 to 3 soft stools per day - not the absence of diarrhea' },
      { id: 'alf-9', order: 9, action: 'Monitor for bleeding and neurological deterioration: implement bleeding precautions (soft toothbrush, electric razor, no IM injections, hold pressure after venipuncture), assess for gum and IV site oozing, bruising, hematuria, and melena, and check bedside glucose for hypoglycemia', rationale: 'An INR of 2.8 with platelets of 88,000 creates a high spontaneous bleeding risk, and a failing liver cannot maintain a normal blood glucose', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'alf-10', order: 10, action: 'Communicate findings to the provider using SBAR and notify immediately for worsening neurological status per the standing order', rationale: 'The ordered parameter has been met; structured communication produces the orders needed for airway management, osmotic therapy, and transplant evaluation', category: 'communication', critical: true, preventsDeterioration: true },
      { id: 'alf-11', order: 11, action: 'Escalate care: activate the Rapid Response Team for stage III to IV encephalopathy or any sign of increased intracranial pressure, and facilitate ICU transfer and transplant center evaluation', rationale: 'Cerebral edema is the leading cause of death in acute liver failure and cannot be managed on a med/surg unit; an INR above 1.5 with encephalopathy meets acute liver failure criteria for transplant referral', category: 'escalation', critical: true, preventsDeterioration: true, atiPearl: 'Cushing triad - hypertension with widened pulse pressure, bradycardia, irregular respirations - is a LATE sign; act long before it appears' },
      { id: 'alf-12', order: 12, action: 'Document assessments, interventions, and patient response including encephalopathy stage, number and character of stools, intake and output, daily weight, and all provider communication', rationale: 'Serial documented neuro assessments are the only way to prove the trend that justifies escalation', category: 'intervention', critical: false, preventsDeterioration: false }
    ],

    medications: [
      { name: 'N-Acetylcysteine', brand: 'Acetadote, Mucomyst', classification: 'Antidote (glutathione precursor), mucolytic', dose: '4.4 g IV in 250 mL D5W over 1 hour (bolus given 0930, maintenance dose 1500)', action: 'Replenishes hepatic glutathione so the toxic acetaminophen metabolite NAPQI can be detoxified, limiting further hepatocyte necrosis; also improves microcirculatory oxygen delivery in established liver failure', onset: 'Immediate IV', sideEffects: ['Anaphylactoid reaction with flushing, rash, wheezing, and hypotension (rate related)', 'Nausea and vomiting', 'Rotten egg odor with the oral form'], nursingConsiderations: ['Most effective within 8 to 10 hours of ingestion but still indicated in established acute liver failure', 'Monitor closely during the first 60 minutes for anaphylactoid reaction - slow or stop the infusion and notify the provider', 'Verify the infusion volume and rate carefully; use an infusion pump', 'Note this dose is in D5W, which also provides glucose to a patient at risk for hypoglycemia', 'Continue to trend AST, ALT, INR, and ammonia', 'Verify this order against the institutional acetylcysteine protocol before hanging it. The standard 21-hour IV regimen is 150 mg/kg over 60 minutes, then 50 mg/kg (4.4 g for this 88 kg patient) in 500 mL over 4 HOURS, then 100 mg/kg over 16 hours. An order to run the 50 mg/kg dose over 1 hour is faster than protocol and increases the risk of an anaphylactoid reaction - clarify with the provider or pharmacy.'], atiTip: 'NAC is the acetaminophen antidote - the sooner it is given, the more liver is saved', highAlert: true },
      { name: 'Lactulose', brand: 'Cephulac, Chronulac', classification: 'Osmotic laxative / ammonia detoxicant (disaccharide)', dose: '30 mL PO every 6 hours (given 0900 and 1200)', action: 'Colonic bacteria metabolize lactulose to lactic and acetic acid, acidifying the colon. The acidic environment converts absorbable ammonia (NH3) into non-absorbable ammonium (NH4+), which is then trapped and excreted in stool along with the osmotic water pull.', onset: '24-48 hours PO for full effect', sideEffects: ['Diarrhea', 'Abdominal cramping and flatulence', 'Dehydration', 'Hypokalemia and hypernatremia from fluid loss'], nursingConsiderations: ['The therapeutic goal is 2 to 3 soft stools per day - do NOT hold the drug simply because the patient is having stools, that is the intended effect', 'Hold and notify the provider only for excessive diarrhea with dehydration or electrolyte derangement', 'Trend the serum ammonia and the level of consciousness to evaluate effectiveness', 'Monitor potassium - hypokalemia paradoxically increases ammonia production and worsens encephalopathy', 'Do NOT give orally to a stage III or IV patient who cannot protect the airway; anticipate an order to change to a retention enema', 'Can be mixed with juice or water to improve palatability'], atiTip: 'Effectiveness of lactulose is measured by stools and mental status, not by the patient comfort', highAlert: false },
      { name: '0.9% Sodium Chloride', brand: 'Normal Saline', classification: 'Isotonic crystalloid', dose: '100 mL/hr continuous IV (started 1000)', action: 'Maintains intravascular volume and renal perfusion in a patient with a GFR of 18', onset: 'Immediate', sideEffects: ['Fluid overload worsening ascites and peripheral edema', 'Electrolyte disturbance'], nursingConsiderations: ['Isotonic fluid is used deliberately - hypotonic fluid would worsen cerebral edema', 'Monitor strict intake and output and daily weight, since low albumin promotes third spacing', 'Assess for increasing abdominal girth, peripheral edema, and crackles'], atiTip: 'Never hang hypotonic fluid in a patient at risk for cerebral edema', highAlert: false },
      { name: 'Rifaximin (anticipated adjunct)', brand: 'Xifaxan', classification: 'Non-absorbed antibiotic', dose: 'Commonly 550 mg PO twice daily when added to lactulose', action: 'Reduces the population of ammonia-producing colonic bacteria, lowering ammonia generation at its source', onset: 'Days', sideEffects: ['Nausea', 'Peripheral edema', 'Dizziness'], nursingConsiderations: ['Used with lactulose, not instead of it', 'Minimal systemic absorption so it is generally well tolerated', 'Monitor mental status and ammonia for response'], atiTip: 'Lactulose traps ammonia; rifaximin kills the bacteria that make it', highAlert: false }
    ],

    sbar: {
      situation: 'This is the RN on the med/surg unit calling about Jane Smith in room 340, a 72-year-old female admitted yesterday with acute liver failure suspected to be from acetaminophen toxicity. Her neurologic status has significantly worsened this shift.',
      background: 'She presented with several days of nausea, vomiting, abdominal pain, jaundice, and confusion. Fall precautions were started at 0922 when she had difficulty answering questions. She has received lactulose 30 mL at 0900 and 1200 and N-acetylcysteine with the maintenance dose at 1500. She has no known drug allergies and is a full code.',
      assessment: 'At 0800 she was 118/72 with a heart rate of 94 and a respiratory rate of 15. She is now 94/54, heart rate 124, respirations 28, temperature 100.4, SpO2 92 percent. She has gone from lethargic with asterixis to responding only to painful stimuli with no verbal response and a diminished gag reflex. Her ammonia is 118, INR 2.8, PT 28 seconds, platelets 88,000, AST 2,850, ALT 3,200, total bilirubin 8.4, glucose 78, and GFR 18. She is oozing from her IV site and gums, and she has not had a bowel movement since the 0900 lactulose.',
      recommendation: 'I recommend immediate evaluation for airway protection since she can no longer protect her own airway, an order to change the lactulose to a retention enema, a stat ammonia and glucose, and ICU transfer with transplant center notification. She meets acute liver failure criteria with an INR above 1.5 plus encephalopathy. I have the head of the bed at 30 degrees with her head midline, suction and seizure precautions at the bedside, and I am calling a Rapid Response now.'
    },

    questions: [
      { id: 'ms2-liver-failure-q1', text: 'The nurse assesses a patient with acute liver failure and finds asterixis. What does this finding indicate?', type: 'multiple-choice', options: ['Hypoglycemia requiring immediate treatment', 'Hepatic encephalopathy from elevated serum ammonia', 'An allergic reaction to N-acetylcysteine', 'Alcohol withdrawal tremors'], correct: [1], rationale: 'Asterixis, also called liver flap, is the involuntary flapping tremor elicited by having the patient extend the arms with the wrists dorsiflexed. It is a hallmark of hepatic encephalopathy caused by accumulated ammonia and other neurotoxins that the failing liver cannot clear. It corresponds to stage II encephalopathy and its worsening tracks with neurologic decline.', atiPearl: 'Asterixis equals hepatic encephalopathy - assess it every hour as part of the neuro check', difficulty: 'Easy' },
      { id: 'ms2-liver-failure-q2', text: 'The patient has received two doses of lactulose and has had four large loose stools. The family asks the nurse to stop the medication because the patient is having diarrhea. What is the nurse best response?', type: 'multiple-choice', options: ['"You are right, I will hold the next dose since she is having too many stools."', '"The stools are how the medication works - it pulls the ammonia out of her body. We aim for 2 to 3 soft stools a day and I will keep watching her fluids and electrolytes."', '"Diarrhea is an unfortunate side effect but there is nothing we can do about it."', '"I will give her an antidiarrheal medication to slow it down."'], correct: [1], rationale: 'Stooling is the therapeutic mechanism, not an adverse effect to be suppressed. Lactulose acidifies the colon, converting absorbable ammonia into non-absorbable ammonium that is excreted in stool. The goal is 2 to 3 soft stools daily. Holding the drug or giving an antidiarrheal would allow ammonia to climb and encephalopathy to worsen. The nurse must, however, monitor for dehydration and hypokalemia, since low potassium paradoxically increases ammonia production.', atiPearl: 'Do not hold lactulose for stools - stools are the point. Watch potassium and volume status instead.', difficulty: 'Medium' },
      { id: 'ms2-liver-failure-q3', text: 'The patient INR is 2.8 and the platelet count is 88,000. Which nursing actions are appropriate? Select all that apply.', type: 'select-all', options: ['Use a soft toothbrush and an electric razor', 'Avoid intramuscular injections', 'Apply prolonged pressure after any venipuncture', 'Administer aspirin for the low-grade fever', 'Assess for gum bleeding, bruising, hematuria, and melena', 'Use the smallest gauge needle appropriate and minimize invasive procedures'], correct: [0, 1, 2, 4, 5], rationale: 'The liver synthesizes nearly all clotting factors, so an INR of 2.8 with thrombocytopenia creates a high risk of spontaneous bleeding. All standard bleeding precautions apply. Aspirin is absolutely contraindicated because it irreversibly inhibits platelet aggregation in a patient who is already coagulopathic and thrombocytopenic; acetaminophen is also contraindicated here because acetaminophen toxicity caused the liver failure.', atiPearl: 'In liver failure, the PT/INR is the best real-time measure of hepatic synthetic function', difficulty: 'Medium' },
      { id: 'ms2-liver-failure-q4', text: 'Why is N-acetylcysteine administered to this patient?', type: 'multiple-choice', options: ['To lower the serum ammonia level', 'To replenish glutathione so the toxic acetaminophen metabolite can be detoxified and further liver cell death limited', 'To reverse the coagulopathy and lower the INR', 'To thin respiratory secretions'], correct: [1], rationale: 'Acetaminophen is normally metabolized safely, but in overdose the pathway is overwhelmed and a toxic metabolite called NAPQI accumulates, destroying hepatocytes. N-acetylcysteine is a glutathione precursor that allows NAPQI to be conjugated and excreted. It is most effective within 8 to 10 hours of ingestion but remains indicated in established acute liver failure. Lactulose lowers ammonia, vitamin K and plasma address the coagulopathy, and the mucolytic use of NAC is an entirely different indication.', atiPearl: 'NAC is to acetaminophen what naloxone is to opioids - know your antidotes', difficulty: 'Medium' },
      { id: 'ms2-liver-failure-q5', text: 'Which set of vital signs in this patient indicates dangerously increased intracranial pressure and requires immediate intervention?', type: 'multiple-choice', options: ['BP 152/60, HR 56, respirations irregular with periods of apnea', 'BP 94/54, HR 124, respirations 28', 'BP 106/62, HR 112, respirations 24', 'BP 118/72, HR 94, respirations 15'], correct: [0], rationale: 'Cushing triad consists of hypertension with a widening pulse pressure, bradycardia, and irregular respirations. A blood pressure of 152/60 gives a pulse pressure of 92, and combined with a heart rate of 56 and apneic breathing it signals critically elevated intracranial pressure with impending brainstem herniation. Cerebral edema is the leading cause of death in acute liver failure. The other sets show a tachycardic, deteriorating but not yet herniating patient.', atiPearl: 'Cushing triad is a LATE sign - by the time you see it, herniation is close', difficulty: 'Hard' },
      { id: 'ms2-liver-failure-q6', text: 'The patient blood glucose is 78 mg/dL. Why is this value concerning in acute liver failure?', type: 'multiple-choice', options: ['It is not concerning; 78 is within the normal range', 'The failing liver cannot perform gluconeogenesis or release stored glycogen, so the patient is at high risk for sudden severe hypoglycemia', 'It indicates the patient has developed diabetes', 'It means the lactulose dose is too high'], correct: [1], rationale: 'Although 78 mg/dL is technically within normal limits, it is low-normal in a patient whose liver has lost the ability to maintain blood glucose. The liver stores glycogen and performs gluconeogenesis; in fulminant hepatic failure both fail, and profound hypoglycemia can develop rapidly. Hypoglycemia also mimics and worsens encephalopathy. Frequent bedside glucose monitoring and a dextrose-containing infusion are indicated, which is one reason the N-acetylcysteine is mixed in D5W.', atiPearl: 'Always check the glucose in an altered patient with liver failure before assuming it is the ammonia', difficulty: 'Hard' },
      { id: 'ms2-liver-failure-q7', text: 'The patient becomes increasingly agitated during the night. Which order should the nurse question?', type: 'multiple-choice', options: ['Neuro checks every hour', 'Lorazepam 1 mg IV every 6 hours PRN for agitation', 'Seizure precautions', 'Head of bed elevated 30 degrees'], correct: [1], rationale: 'Benzodiazepines and opioids are metabolized by the liver. In hepatic failure they accumulate, produce profound and prolonged sedation, and directly worsen hepatic encephalopathy, making it impossible to distinguish drug effect from neurologic deterioration. Sedatives should be avoided or used only with extreme caution and dose reduction. Hourly neuro checks, seizure precautions, and head elevation are all appropriate and expected orders for this patient.', atiPearl: 'Sedatives in liver failure mask and worsen encephalopathy - question the order', difficulty: 'Hard' },
      { id: 'ms2-liver-failure-q8', text: 'The patient has progressed to responding only to painful stimuli with a diminished gag reflex. She is due for her scheduled lactulose 30 mL PO. What should the nurse do?', type: 'multiple-choice', options: ['Administer the lactulose orally as ordered', 'Hold the oral dose, notify the provider, and anticipate an order to give lactulose as a retention enema', 'Crush the lactulose and mix it with applesauce', 'Hold the medication and document that the patient refused'], correct: [1], rationale: 'A patient at stage III to IV encephalopathy who responds only to pain and has a diminished gag reflex cannot protect her airway. Giving anything by mouth would cause aspiration. Lactulose is still urgently needed to lower the ammonia, so the appropriate action is to notify the provider and obtain an order for a lactulose retention enema. Lactulose is a liquid and cannot be crushed, and documenting refusal in an obtunded patient is inaccurate and abandons a needed therapy.', atiPearl: 'No gag reflex equals nothing by mouth - but find another route for a drug the patient truly needs', difficulty: 'Hard' },
      { id: 'ms2-liver-failure-q9', text: 'Select ALL manifestations the nurse would expect to find in a patient with acute liver failure and hepatic encephalopathy.', type: 'select-all', options: ['Jaundice and scleral icterus', 'Asterixis', 'Fetor hepaticus (sweet musty breath odor)', 'Confusion progressing to coma', 'Easy bruising and mucosal bleeding', 'Bradycardia with a strong regular pulse as an early sign'], correct: [0, 1, 2, 3, 4], rationale: 'Jaundice reflects the inability to conjugate and excrete bilirubin. Asterixis, confusion, and coma reflect ammonia-induced encephalopathy. Fetor hepaticus is the sweet musty breath odor of unmetabolized sulfur compounds. Bruising and bleeding reflect failed synthesis of clotting factors and thrombocytopenia. Early acute liver failure produces sinus TACHYCARDIA, as seen in this patient at 112 to 124; bradycardia appears only late as part of Cushing triad from increased intracranial pressure.', atiPearl: 'Jaundice, asterixis, fetor hepaticus, coagulopathy, and altered mentation is the acute liver failure picture', difficulty: 'Medium' },
      { id: 'ms2-liver-failure-q10', text: 'Which laboratory result best reflects the LIVER ability to synthesize proteins, and therefore the severity of acute liver failure?', type: 'multiple-choice', options: ['AST of 2,850', 'Total bilirubin of 8.4', 'INR of 2.8', 'WBC of 13.2'], correct: [2], rationale: 'The INR measures the function of clotting factors that only the liver produces, and because those factors have very short half-lives the INR responds within hours to changes in synthetic capacity. An INR of 1.5 or greater combined with encephalopathy in a patient without preexisting liver disease is the defining criterion for acute liver failure and a transplant listing consideration. AST and ALT measure hepatocyte injury, not function, and can actually FALL as the liver dies. Bilirubin reflects excretory function and lags behind.', atiPearl: 'Transaminases show damage; INR and albumin show function. Function is what predicts survival.', difficulty: 'Hard' },
      { id: 'ms2-liver-failure-q11', text: 'The nurse is positioning this patient who is showing signs of cerebral edema. Which position is BEST?', type: 'multiple-choice', options: ['Head of bed flat with the head turned to the right', 'Head of bed at 30 degrees with the head and neck midline', 'Trendelenburg position', 'High Fowler with the hips sharply flexed'], correct: [1], rationale: 'Elevating the head of the bed to 30 degrees with the head and neck in a neutral midline position maximizes venous drainage from the brain through the jugular veins, which lowers intracranial pressure. Turning or flexing the neck compresses the jugular veins and raises ICP. Trendelenburg increases cerebral blood volume and ICP. Sharp hip flexion increases intra-abdominal and intrathoracic pressure, which also impedes cerebral venous return.', atiPearl: 'Thirty degrees, head midline, no neck or hip flexion - the ICP positioning rule', difficulty: 'Medium' },
      { id: 'ms2-liver-failure-q12', text: 'Which dietary teaching is appropriate for this patient with hepatic encephalopathy?', type: 'multiple-choice', options: ['Eliminate all protein from the diet permanently', 'Follow the ordered low fat, low protein diet during the acute phase while maintaining adequate calories, and work with the dietitian to advance protein as mental status improves', 'Increase red meat intake to rebuild the liver', 'Eat a high sodium diet to maintain blood pressure'], correct: [1], rationale: 'Protein is broken down into ammonia by colonic bacteria, so protein is moderated during acute encephalopathy, which is why this patient is on a low protein diet. However, complete long-term protein restriction causes muscle breakdown, which actually generates more ammonia and worsens outcomes. Adequate calories must be maintained to prevent catabolism, and protein is advanced as tolerated with dietitian guidance. Sodium is restricted, not increased, because of ascites and fluid retention.', atiPearl: 'Restrict protein during the acute crisis only - long-term protein starvation makes encephalopathy worse', difficulty: 'Medium' },
      { id: 'ms2-liver-failure-q13', text: 'What is the MOST important discharge teaching point for a patient recovering from acetaminophen-induced liver injury?', type: 'multiple-choice', options: ['"Acetaminophen is safe as long as you take it with food."', '"Do not exceed the acetaminophen limit your provider gives you, and check every over-the-counter and prescription label for hidden acetaminophen in cold, sleep, and combination pain products."', '"You may take up to 6 grams of acetaminophen a day now that your liver is healing."', '"Switch to daily ibuprofen instead, since it is processed by the kidneys."'], correct: [1], rationale: 'Most acetaminophen toxicity is unintentional and results from stacking multiple products that each contain acetaminophen - cold remedies, sleep aids, and combination opioid analgesics. The maximum for healthy adults is 4 g in 24 hours and it is substantially lower with hepatic impairment, older age, or alcohol use, so the patient must follow the provider-specified limit. Taking it with food does not prevent hepatotoxicity, 6 g daily is a toxic dose, and routinely substituting an NSAID carries its own GI bleeding and renal risks that must be discussed with the provider.', atiPearl: 'Teach patients to read every label - hidden acetaminophen in combination products is the number one cause of accidental overdose', difficulty: 'Easy' }
    ],

    keyPoints: [
      'Acetaminophen toxicity is the leading cause of acute liver failure in the United States',
      'Acute liver failure is defined by coagulopathy with an INR of 1.5 or greater plus encephalopathy in a patient without preexisting liver disease',
      'Ammonia crosses the blood-brain barrier and causes astrocyte swelling, producing encephalopathy and cerebral edema',
      'Encephalopathy staging: I confusion, II asterixis and lethargy, III somnolence and incoherence, IV coma',
      'Asterixis is the hallmark bedside sign of hepatic encephalopathy',
      'The INR and albumin measure liver FUNCTION; AST and ALT only measure liver INJURY',
      'Lactulose acidifies the colon to trap ammonia as ammonium for excretion; the goal is 2 to 3 soft stools per day',
      'N-acetylcysteine replenishes glutathione and is the antidote for acetaminophen toxicity',
      'Cerebral edema is the leading cause of death in acute liver failure',
      'Cushing triad - widened pulse pressure hypertension, bradycardia, irregular respirations - is a late sign of increased ICP'
    ],

    pearls: [
      'Sedatives, benzodiazepines, and opioids are cleared by the liver - they accumulate and mask neurologic deterioration',
      'Hypokalemia increases ammonia production and worsens encephalopathy - keep the potassium replaced',
      'A failing liver cannot maintain blood glucose - check a bedside glucose on every altered patient',
      'Never hang hypotonic IV fluid in a patient at risk for cerebral edema',
      'Falling transaminases in a patient who is getting worse can mean the liver is dying, not healing',
      'GI bleeding, infection, constipation, dehydration, and hypokalemia are the classic precipitants of worsening encephalopathy'
    ],

    successChecklist: [
      'Receive and review the patient chart',
      'Verify patient identity using two identifiers',
      'Perform hand hygiene and apply standard precautions',
      'Perform a focused neurological and gastrointestinal assessment',
      'Review laboratory and diagnostic findings',
      'Recognize manifestations of acute liver failure',
      'Identify signs of worsening hepatic encephalopathy',
      'Prioritize interventions using the ABCs and neurological assessment',
      'Implement provider orders',
      'Monitor for bleeding and neurological deterioration',
      'Obtain a bedside glucose before attributing any mental status change to ammonia',
      'Communicate findings using SBAR',
      'Escalate care appropriately',
      'Complete tasks within the 20-minute simulation time'
    ],

    criticalErrors: [
      'Administering acetaminophen or any acetaminophen-containing product to this patient',
      'Hanging the acetylcysteine maintenance dose faster than the protocol rate without clarifying the order',
      'Administering aspirin, NSAIDs, or any anticoagulant to a patient with an INR of 2.8 and platelets of 88,000',
      'Giving a benzodiazepine or opioid for agitation without questioning the order',
      'Administering oral lactulose to a patient with a diminished gag reflex',
      'Holding lactulose because the patient is having stools',
      'Giving an intramuscular injection to a coagulopathic patient',
      'Failing to check a bedside glucose in a patient with worsening mental status',
      'Positioning the patient flat or with the neck flexed when cerebral edema is suspected',
      'Failing to implement fall and seizure precautions',
      'Failing to recognize the progression from stage II to stage III encephalopathy as a trigger for escalation',
      'Leaving a stage III or IV encephalopathic patient unattended',
      'Hanging hypotonic IV fluid, which worsens cerebral edema',
      'Failing to notify the provider for worsening neurological status as ordered'
    ],

    comparisons: [
      {
        title: 'Stages of Hepatic Encephalopathy',
        headers: ['Stage', 'Mental Status', 'Motor Findings', 'Nursing Priority'],
        rows: [
          ['I', 'Mild confusion, sleep pattern reversal, irritability', 'Mild tremor, impaired handwriting', 'Baseline neuro exam, fall precautions'],
          ['II', 'Lethargy, disorientation, inappropriate behavior', 'Asterixis present, slurred speech', 'Hourly neuro checks, lactulose, seizure precautions'],
          ['III', 'Somnolent but arousable, marked confusion, incoherent', 'Marked asterixis, rigidity', 'Airway assessment, escalate, no PO, prepare for ICU'],
          ['IV', 'Coma, unresponsive', 'Decorticate or decerebrate posturing, absent asterixis', 'Intubation, ICP management, ICU transfer']
        ]
      },
      {
        title: 'Liver Injury vs Liver Function Labs',
        headers: ['Lab', 'What It Measures', 'This Patient'],
        rows: [
          ['AST / ALT', 'Hepatocyte injury and necrosis', '2,850 / 3,200 - massive necrosis'],
          ['Total bilirubin', 'Excretory and conjugating function', '8.4 - jaundice, icterus'],
          ['Albumin', 'Synthetic function (slow, weeks)', '2.8 - low oncotic pressure, edema'],
          ['PT / INR', 'Synthetic function (fast, hours)', '28 sec / 2.8 - severe coagulopathy'],
          ['Ammonia', 'Detoxification function', '118 - encephalopathy, cerebral edema risk']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'Is it... is it nighttime? I keep thinking it is nighttime. Are you the one who was here before? You look like her.' },
      { speaker: 'patient', trigger: 'pain', line: 'Right here, under my ribs on this side. It is sore, like a bruise deep inside. Maybe a four. It hurts more when you push.' },
      { speaker: 'patient', trigger: 'assessment', line: 'My hands keep doing that. Look. I am not doing it on purpose, they just... flap. Why are they doing that? And my skin itches everywhere.' },
      { speaker: 'patient', trigger: 'history', line: 'I had this awful headache for days, and my back. I just kept taking the Tylenol. Two, then two more. I did not think... it is just Tylenol. You can buy it anywhere.' },
      { speaker: 'patient', trigger: 'medication', line: 'That syrup you gave me made me go to the bathroom four times. I do not want any more of it. Please do not make me take it.' },
      { speaker: 'patient', trigger: 'breathing', line: 'I am just so sleepy. Let me close my eyes for a minute. Just a minute...' },
      { speaker: 'patient', trigger: 'deterioration', line: '(No verbal response. Withdraws and grimaces to sternal rub.)' },
      { speaker: 'family', trigger: 'greeting', line: 'I am her daughter. She has been getting more and more mixed up for about a week. Yesterday she could not remember my husband name and this morning I could barely wake her up.' },
      { speaker: 'family', trigger: 'history', line: 'She had a bad flu and her arthritis was acting up. She was taking the extra strength Tylenol, and then the nighttime cold medicine on top of it. I did not know that had Tylenol in it too. Did we do this to her?' },
      { speaker: 'family', trigger: 'assessment', line: 'Her eyes went yellow. That happened just yesterday morning. Is her liver dying? Somebody said something about a transplant.' },
      { speaker: 'family', trigger: 'escalation', line: 'Why are you moving her to intensive care? She was talking to me this morning. Please, what is happening to my mother?' }
    ],

    patientEducation: [
      'Never exceed the acetaminophen limit your provider gives you; the maximum for healthy adults is 4 grams in 24 hours and it is much lower with liver injury',
      'Read the active ingredient list on every over-the-counter and prescription product - acetaminophen is hidden in cold remedies, sleep aids, and combination pain medications',
      'Avoid alcohol completely, as it dramatically increases acetaminophen liver toxicity and causes further liver damage',
      'Take lactulose exactly as prescribed and expect 2 to 3 soft stools daily; call your provider if you have no stools or if you have severe diarrhea with weakness',
      'Family should report immediately any increase in confusion, forgetfulness, sleepiness, personality change, slurred speech, or hand tremor',
      'Follow the prescribed diet with moderated protein and restricted sodium, and keep all dietitian appointments',
      'Use a soft toothbrush and an electric razor, and report any bleeding gums, easy bruising, nosebleeds, black stools, or blood in the urine',
      'Do not take any new medication, herbal product, or supplement without checking with your provider or pharmacist, since the liver processes nearly all of them',
      'Weigh yourself daily at the same time and report a gain of 2 to 3 pounds in a day or increasing abdominal swelling',
      'Keep all follow-up laboratory appointments to monitor liver function, INR, and ammonia levels'
    ]
  }

];
