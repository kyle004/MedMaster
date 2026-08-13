/* ms2lab.js - Medical-Surgical Nursing II Simulation Lab packets (NUR2212C)
 * Transcribed from the 8 student simulation packets in _staging/.
 * Verbatim fields: outcomes, requiredKnowledge, activitySteps text, providerOrders,
 * mar, labs + printed normal ranges, notes, chart fields, initialAssessment.
 * Derived fields (clinical judgement, not from the packet): critical, phase, evidence,
 * coachTip, status, interpretation, expectedSbar, criticalErrors, debriefQuestions, pearls,
 * heightCm conversions, map calculations, flags.
 */
window.MS2_LAB_SIMS = [

/* ============================ 1. ARDS ============================ */
{
  id: 'ms2lab-ards',
  course: 'NUR2212C',
  courseTitle: 'Medical-Surgical Nursing II - Simulation Lab',
  topic: 'Acute Respiratory Failure to Respiratory Distress',
  sourceTopic: '',
  sourceNote: 'The packet header is marked "(Faculty)" although it is distributed as the student copy. The packet does not print a P/F ratio; calculated from the charted PaO2 of 58 with an estimated FiO2 of 0.28 on 2 L nasal cannula, the PaO2/FiO2 ratio is about 207, which is MILD ARDS by the Berlin criteria (mild 200-300, moderate 100-200, severe 100 or less). Earlier MedMaster content labeled 207 as moderate; that is corrected here. The MAR prints "Ceftriaxone 1 g IC" - a typo for IV - and is kept verbatim. The chest x-ray impression prints "progression otwards ARDS"; the typo is normalized to "toward". The packet states no start clock, so the latest charted event (1000) is used as the current time.',
  durationMin: 20,
  introduction: 'Acute Respiratory Failure is a life-threatening condition that occurs when the respiratory system is unable to maintain adequate oxygenation and/or ventilation. Acute Respiratory Distress Syndrome (ARDS) is characterized by severe hypoxemia, diffuse pulmonary inflammation, increased alveolar-capillary membrane permeability, and impaired gas exchange. ARDS commonly develops secondary to severe pneumonia, sepsis, aspiration, trauma, or other systemic inflammatory processes. This simulation allows ASN nursing students to recognize early manifestations of acute respiratory failure, identify progression toward ARDS, implement evidence-based nursing interventions, communicate effectively using SBAR, and escalate care appropriately to prevent respiratory arrest, mechanical ventilation, multi-organ dysfunction, and death.',

  outcomes: [
    { n: 1, text: 'Correlate the integrative processes to the care of the client and family' },
    { n: 2, text: 'Demonstrate safe and effective care in the care of the client' },
    { n: 3, text: 'Relate health promotion and maintenance in the care of the client' },
    { n: 4, text: 'Relate components of psychosocial integrity in the care of the client' },
    { n: 5, text: 'Relate components of physiological integrity in the care of the client' },
    { n: 6, text: 'Demonstrate the competencies specific to entry-level professional nursing' }
  ],

  requiredKnowledge: [
    'Describe the pathophysiology of acute respiratory failure and ARDS.',
    'Recognize manifestations of hypoxemia and impaired gas exchange.',
    'Interpret arterial blood gas results.',
    'Interpret chest x-ray findings associated with severe pneumonia and ARDS.',
    'Recognize signs of respiratory deterioration and impending respiratory arrest.',
    'Perform focused respiratory, cardiovascular, and neurological assessments.',
    'Discuss oxygen delivery methods and escalation of respiratory support.',
    'Utilize SBAR communication.',
    'Recognize indications for Rapid Response Team activation.'
  ],

  activitySteps: [
    { n: 1, text: 'Receive and review patient chart.', critical: true, phase: 'prep',
      evidence: 'opened the chart and reviewed orders, MAR, labs, and the chest x-ray before entering the room',
      coachTip: 'Walk in already knowing the last set of vitals and what is ordered. You cannot recognize a change you never baselined.' },
    { n: 2, text: 'Verify patient identity using two identifiers.', critical: true, phase: 'prep',
      evidence: 'stated name and date of birth and compared them to the armband',
      coachTip: 'Two identifiers before anything else - name and date of birth, never room number.' },
    { n: 3, text: 'Perform hand hygiene and apply standard precautions.', critical: true, phase: 'prep',
      evidence: 'performed hand hygiene on entry and donned gloves before contact',
      coachTip: 'Hand hygiene is scored every single time. Isolation is listed as none here, but standard precautions still apply.' },
    { n: 4, text: 'Perform focused respiratory and hemodynamic assessment.', critical: true, phase: 'assess',
      evidence: 'auscultated all lung fields, counted a full-minute respiratory rate, noted accessory muscle use and speech in fragments, and checked pulses and skin',
      coachTip: 'Count the rate yourself. A respiratory rate of 30 with accessory muscle use is the finding that drives everything else in this sim.' },
    { n: 5, text: 'Review laboratory, diagnostic, and radiology findings.', critical: true, phase: 'interpret',
      evidence: 'verbalized the ABG, the WBC of 19.2, the GFR of 18, and the chest x-ray impression',
      coachTip: 'pH 7.48 with PaCO2 31 and PaO2 58 is acute respiratory alkalosis with severe hypoxemia. The GFR of 18 changes drug dosing.' },
    { n: 6, text: 'Recognize manifestations of acute respiratory failure.', critical: true, phase: 'interpret',
      evidence: 'stated that a PaO2 under 60 mmHg on supplemental oxygen defines hypoxemic respiratory failure',
      coachTip: 'Restlessness and anxiety are EARLY hypoxia. Confusion and somnolence are LATE. Do not sedate the anxiety.' },
    { n: 7, text: 'Identify signs of progression toward ARDS.', critical: true, phase: 'interpret',
      evidence: 'named refractory hypoxemia, bilateral diffuse infiltrates, acute onset within one week of pneumonia, and no cardiogenic cause',
      coachTip: 'Berlin criteria: acute onset within one week, bilateral opacities, P/F 300 or less, not explained by cardiac failure. This P/F is about 207 - mild ARDS.' },
    { n: 8, text: 'Prioritize interventions using ABCs.', critical: true, phase: 'intervene',
      evidence: 'addressed airway and oxygenation first - high Fowler position and oxygen titration - before charting or calling',
      coachTip: 'Sit him upright and raise the oxygen before you pick up the phone. Airway and breathing outrank documentation.' },
    { n: 9, text: 'Implement provider orders.', critical: true, phase: 'intervene',
      evidence: 'titrated oxygen per order, confirmed continuous pulse oximetry and cardiac monitoring, and maintained high Fowler position',
      coachTip: 'The order says titrate to keep SpO2 above 95 percent. At 88 percent on 2 L you are already authorized to go up - do it, then reassess in 5 minutes.' },
    { n: 10, text: 'Communicate findings using SBAR.', critical: true, phase: 'communicate',
      evidence: 'gave a structured SBAR that included the SpO2 of 88 percent on 2 L, RR 30, PaO2 58, and the bilateral infiltrates',
      coachTip: 'Lead with the numbers that force action. Ask for something specific - ICU evaluation and a repeat ABG.' },
    { n: 11, text: 'Prepare for escalation of respiratory support.', critical: true, phase: 'intervene',
      evidence: 'gathered a non-rebreather or BiPAP setup, suction, and bag-valve mask and verified airway equipment at the bedside',
      coachTip: 'Have the airway box in the room before you need it. Escalation is nasal cannula to mask to non-rebreather to BiPAP to intubation.' },
    { n: 12, text: 'Escalate care appropriately.', critical: true, phase: 'escalate',
      evidence: 'activated the Rapid Response Team and requested ICU transfer',
      coachTip: 'Refractory hypoxemia despite oxygen is a rapid response call, not a wait-and-see. The order already anticipates ICU transfer.' },
    { n: 13, text: 'Complete tasks within the 20-minute simulation time.', critical: false, phase: 'prep',
      evidence: 'finished assessment, interventions, SBAR, and escalation before the timer expired',
      coachTip: 'Budget roughly 5 minutes to assess, 5 to intervene, 5 to communicate, 5 to reassess.' }
  ],

  caseOverview: 'Mr. John Smith is a 72-year-old male admitted with severe pneumonia. During the last several hours the patient has experienced worsening shortness of breath, increasing oxygen requirements, fatigue, and difficulty speaking in complete sentences. Despite treatment, oxygen saturation continues to decline. The patient demonstrates tachypnea, accessory muscle use, diffuse crackles, anxiety, and increasing respiratory distress. Students must recognize deterioration in the patient\'s respiratory status and intervene appropriately to prevent acute respiratory failure, ARDS, respiratory arrest, and death.',
  currentTime: '1000',

  initialAssessment: [
    { system: 'General', findings: ['Alert', 'Anxious', 'Restless'] },
    { system: 'Respiratory', findings: ['Severe dyspnea', 'Tachypnea', 'Accessory muscle use', 'Unable to speak in complete sentences', 'Frequent cough'] },
    { system: 'Cardiovascular', findings: ['Sinus tachycardia', 'Warm skin'] }
  ],

  chart: {
    name: 'John Smith', age: '72 years', dob: '06/26/1954', sex: 'Male',
    heightRaw: '72 inch', heightCm: 183, weightKg: 92,
    allergies: ['No Known Drug Allergies'], codeStatus: 'Full Code',
    admittingDx: 'Severe Pneumonia with Progression to Acute Respiratory Failure',
    admitDate: 'Yesterday', facility: 'Step-Down Unit', isolation: 'none', diet: 'Regular'
  },

  notes: [
    { at: 'Yesterday, 1800', text: 'Admitted with severe pneumonia' },
    { at: 'Yesterday, 2200', text: 'Increased oxygen requirement' },
    { at: 'Today, 0600', text: 'Reports worsening SOB' }
  ],

  providerOrders: [
    { text: 'Oxygen 2L Nasal Cannula to keep O2 > 95%', category: 'respiratory' },
    { text: 'Continuous pulse oximetry', category: 'monitoring' },
    { text: 'Continuous cardiac monitoring', category: 'monitoring' },
    { text: 'Titrate oxygen to maintain SpO2 >95%', category: 'respiratory' },
    { text: 'Possible ICU transfer', category: 'procedure' },
    { text: 'Maintains High Fowler\'s position', category: 'procedure' }
  ],

  mar: [
    { at: 'Today, 0900', text: 'Ceftriaxone 1 g IC' },
    { at: 'Today, 0900', text: 'Azithromycin 500 mg IV' },
    { at: 'Today, 1000', text: 'Albuterol Nebulizer' },
    { at: 'Today, 1000', text: '0.9% Sodium Chloride 125 mL/h' }
  ],

  labs: [
    { panel: 'CBC', name: 'WBC', value: '19.2', normalRange: '5-10', status: 'critical-high', interpretation: 'Marked leukocytosis confirming ongoing bacterial infection driving the inflammatory lung injury.' },
    { panel: 'CBC', name: 'RBC', value: '4.4', normalRange: '4.2-5.4', status: 'normal', interpretation: 'Normal - oxygen-carrying capacity is intact, so the hypoxemia is a gas exchange problem, not an anemia problem.' },
    { panel: 'CBC', name: 'Hgb', value: '13.4', normalRange: '12-16', status: 'normal', interpretation: 'Normal hemoglobin. Adequate carrier for oxygen once oxygenation is corrected.' },
    { panel: 'CBC', name: 'Hematocrit', value: '40%', normalRange: '37-47%', status: 'normal', interpretation: 'Normal.' },
    { panel: 'CBC', name: 'Platelets', value: '299,000', normalRange: '150,000-400,000', status: 'normal', interpretation: 'Normal - no consumptive coagulopathy at this point.' },
    { panel: 'BMP', name: 'Sodium', value: '136', normalRange: '135-145', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'Potassium', value: '4.3', normalRange: '3.5-5.0', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'Chloride', value: '104', normalRange: '98-106', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'Calcium', value: '9.8', normalRange: '9-10.5', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'BUN', value: '24', normalRange: '10-20', status: 'high', interpretation: 'Mildly elevated - dehydration from fever and tachypnea plus reduced renal perfusion.' },
    { panel: 'BMP', name: 'Creatinine', value: '1.2', normalRange: '0.6-1.2', status: 'normal', interpretation: 'Top of normal, but do not be reassured - the GFR tells the real story in a 72-year-old.' },
    { panel: 'BMP', name: 'Glucose', value: '124', normalRange: '70-110', status: 'high', interpretation: 'Mild stress hyperglycemia from the inflammatory response.' },
    { panel: 'Perfusion Marker', name: 'GFR', value: '18', normalRange: '>90', status: 'critical-low', interpretation: 'Severely reduced renal clearance. Renally cleared drugs and IV fluid rates must be reviewed with the provider.' },
    { panel: 'ABG', name: 'pH', value: '7.48', normalRange: '7.35-7.45', status: 'high', interpretation: 'Alkalemia from hyperventilation - the patient is blowing off CO2 to compensate for hypoxemia.' },
    { panel: 'ABG', name: 'PaCO2', value: '31', normalRange: '35-45', status: 'low', interpretation: 'Low from hyperventilation. With the high pH this is acute respiratory alkalosis, uncompensated.' },
    { panel: 'ABG', name: 'PaO2', value: '58', normalRange: '80-100', status: 'critical-low', interpretation: 'Severe hypoxemia despite supplemental oxygen. A PaO2 under 60 mmHg defines hypoxemic (Type I) respiratory failure.' },
    { panel: 'ABG', name: 'HCO3', value: '22', normalRange: '22-26', status: 'normal', interpretation: 'Normal - no time for renal compensation, confirming an ACUTE process.' },
    { panel: 'ABG (calculated)', name: 'PaO2/FiO2 ratio', value: '~207', normalRange: 'greater than 400', status: 'critical-low', interpretation: 'Calculated from the charted PaO2 of 58 with an estimated FiO2 of 0.28 on 2 L nasal cannula. A P/F of 200-300 with bilateral infiltrates and no cardiac cause meets Berlin criteria for MILD ARDS. Not printed in the packet.' }
  ],

  vitals: [
    { at: 'Today, 0600', bp: '136/84', map: 101, hr: 96, rr: 22, temp: '100.6 F', spo2: 93, pain: '', loc: 'Alert', flags: ['low-grade fever', 'borderline hypoxemia'] },
    { at: 'Today, 1000', bp: '142/86', map: 105, hr: 112, rr: 30, temp: '101.8 F', spo2: 88, pain: '', loc: 'Alert, anxious, restless', flags: ['fever', 'tachycardia', 'tachypnea', 'severe hypoxemia'] }
  ],

  diagnostics: [
    { name: 'Chest x-ray', finding: 'Bilateral diffuse infiltrates consistent with worsening pneumonia and progression toward ARDS.',
      interpretation: 'Bilateral opacities not explained by fluid overload are one of the Berlin criteria for ARDS. With the P/F of about 207 and acute onset within a week of pneumonia, this patient meets the definition.' }
  ],

  expectedSbar: {
    situation: 'This is the nurse on the Step-Down Unit calling about Mr. John Smith, a 72-year-old male admitted yesterday with severe pneumonia. He is in acute respiratory distress with an SpO2 of 88 percent on 2 L nasal cannula and I need rapid response and ICU evaluation now.',
    background: 'He was admitted yesterday at 1800 with severe pneumonia, needed more oxygen overnight, and reported worsening shortness of breath at 0600. He received ceftriaxone 1 g and azithromycin 500 mg IV at 0900 and an albuterol nebulizer at 1000. He is Full Code, no known drug allergies, 92 kg, on 0.9 percent sodium chloride at 125 mL/hr.',
    assessment: 'At 1000 his blood pressure is 142/86, heart rate 112, respiratory rate 30, temperature 101.8 F, SpO2 88 percent on 2 L. He is using accessory muscles and cannot finish a sentence. His ABG shows pH 7.48, PaCO2 31, PaO2 58, HCO3 22 - acute respiratory alkalosis with severe hypoxemia. The chest x-ray shows bilateral diffuse infiltrates with progression toward ARDS, and his GFR is 18.',
    recommendation: 'He is in high Fowler and I am titrating oxygen up per your order. I recommend immediate ICU transfer, evaluation for non-invasive positive pressure or intubation with low tidal volume and PEEP, a repeat ABG now, and a review of his fluid rate and drug dosing given the GFR of 18. Can you come to the bedside?'
  },

  criticalErrors: [
    'Treating the anxiety with a sedative or reassurance instead of treating the hypoxemia',
    'Leaving the patient on 2 L nasal cannula with an SpO2 of 88 percent when the order authorizes titration',
    'Laying the patient flat to take vital signs or perform care',
    'Documenting or completing tasks before addressing airway and breathing',
    'Failing to activate the Rapid Response Team for refractory hypoxemia',
    'Ignoring the GFR of 18 when administering renally cleared drugs and IV fluids'
  ],

  debriefQuestions: [
    'What was the earliest sign that this patient was decompensating, and at what time did it appear?',
    'Why is the ABG showing alkalosis when the patient is in respiratory failure, and what would a normal or rising PaCO2 mean here?',
    'How do you distinguish worsening pneumonia from ARDS at the bedside?',
    'What would you have prepared in the room before the rapid response team arrived?',
    'How did the GFR of 18 change your medication and fluid thinking?'
  ],

  pearls: [
    'A PaO2 under 60 mmHg on supplemental oxygen is hypoxemic respiratory failure by definition',
    'Refractory hypoxemia - hypoxemia that does not improve with more FiO2 - is the hallmark of ARDS',
    'Berlin criteria: acute onset within one week, bilateral opacities, P/F 300 or less, not explained by cardiac failure',
    'P/F about 207 is MILD ARDS - mild 200-300, moderate 100-200, severe 100 or less',
    'Early ARDS gives respiratory ALKALOSIS; a rising CO2 later means the patient is tiring and about to arrest',
    'Restlessness and anxiety are early hypoxia; confusion, somnolence, and bradycardia are late and ominous',
    'ARDS is treated with PEEP and low tidal volume ventilation, not simply more oxygen'
  ]
},

/* ============================ 2. DIC ============================ */
{
  id: 'ms2lab-dic',
  course: 'NUR2212C',
  courseTitle: 'Medical-Surgical Nursing II - Simulation Lab',
  topic: 'Disseminated Intravascular Coagulation',
  sourceTopic: '',
  sourceNote: 'The packet does not state a start clock; the latest charted event (0922) is used as the current time. Physician orders include cefepime and vancomycin but no order for the blood products the activity instructions tell the student to prepare - the student is expected to anticipate and request them. No diagnostics or imaging section is printed.',
  durationMin: 20,
  introduction: 'Disseminated Intravascular Coagulation (DIC) is a life-threatening disorder characterized by widespread activation of the coagulation cascade resulting in microvascular thrombosis, consumption of clotting factors and platelets, hemorrhage, impaired tissue perfusion, and multi-organ dysfunction. This simulation allows ASN nursing students to identify early manifestations of DIC, recognize progression toward septic shock and organ failure, implement evidence-based nursing interventions, communicate effectively using SBAR, and escalate care appropriately.',

  outcomes: [
    { n: 1, text: 'Correlate the integrative processes to the care of the client and family' },
    { n: 2, text: 'Demonstrate safe and effective care in the care of the client' },
    { n: 3, text: 'Relate health promotion and maintenance in the care of the client' },
    { n: 4, text: 'Relate components of psychosocial integrity in the care of the client' },
    { n: 5, text: 'Relate components of physiological integrity in the care of the client' },
    { n: 6, text: 'Demonstrate the competencies specific to entry level professional nursing' }
  ],

  requiredKnowledge: [
    'Pathophysiology of sepsis and DIC.',
    'Recognize manifestations of abnormal bleeding and clotting.',
    'Interpret coagulation studies.',
    'Interpret platelet count, fibrinogen, D-dimer, lactate, and renal function studies.',
    'Recognize signs of septic shock.',
    'Perform focused cardiovascular, respiratory, neurological, integumentary, and renal assessments.',
    'Discuss blood product administration.',
    'Utilize SBAR communication.',
    'Recognize indications for Rapid Response Team activation.'
  ],

  activitySteps: [
    { n: 1, text: 'Receive and review patient chart.', critical: true, phase: 'prep',
      evidence: 'opened the chart and reviewed orders, MAR, the coagulation panel, and the progress notes',
      coachTip: 'The 0700 and 0922 notes tell you bleeding started before your shift. Know the trend before you touch the patient.' },
    { n: 2, text: 'Verify patient identity using two identifiers.', critical: true, phase: 'prep',
      evidence: 'stated name and date of birth and compared them to the armband',
      coachTip: 'Two identifiers before anything else - name and date of birth, never room number. This matters twice as much when blood products are coming.' },
    { n: 3, text: 'Perform hand hygiene and apply standard precautions.', critical: true, phase: 'prep',
      evidence: 'performed hand hygiene and donned gloves before contact with bleeding sites',
      coachTip: 'Active bleeding from gums and IV sites means gloves every approach, and eye protection if splash is possible.' },
    { n: 4, text: 'Perform focused assessment.', critical: true, phase: 'assess',
      evidence: 'assessed skin for petechiae and ecchymosis, inspected all IV sites and gums for oozing, auscultated heart and lungs, checked mental status and urine output',
      coachTip: 'In DIC you assess every orifice, every puncture site, and every inch of skin. Bleeding you do not look for is bleeding you will not find.' },
    { n: 5, text: 'Review laboratory and diagnostic findings.', critical: true, phase: 'interpret',
      evidence: 'verbalized platelets 48,000, fibrinogen 90, D-dimer 5000, PT 24, INR 2.8, aPTT 62, lactate 4.8, creatinine 2.1',
      coachTip: 'The DIC signature is low platelets, low fibrinogen, high D-dimer, and prolonged PT and aPTT all at once. One abnormal value is not DIC.' },
    { n: 6, text: 'Recognize manifestations of DIC.', critical: true, phase: 'interpret',
      evidence: 'stated that simultaneous bleeding and consumption of clotting factors in a septic patient is DIC',
      coachTip: 'DIC clots and bleeds at the same time. The microthrombi are what kill the kidneys while the gums ooze.' },
    { n: 7, text: 'Identify signs of septic shock and organ dysfunction.', critical: true, phase: 'interpret',
      evidence: 'linked the lactate of 4.8, creatinine of 2.1, urine output under 30 mL/hr, and falling blood pressure to hypoperfusion',
      coachTip: 'Urine output under 30 mL/hr is organ dysfunction, not just dehydration. It is the cheapest perfusion monitor you have.' },
    { n: 8, text: 'Prioritize interventions using ABCs.', critical: true, phase: 'intervene',
      evidence: 'secured oxygenation and circulation and applied gentle pressure to bleeding sites before non-urgent tasks',
      coachTip: 'Airway and breathing first, then stop the bleeding you can see and protect the patient from new puncture wounds.' },
    { n: 9, text: 'Implement provider orders.', critical: true, phase: 'intervene',
      evidence: 'confirmed continuous cardiac monitoring, vital signs every 15 minutes, SpO2 above 95 percent, strict intake and output, and the antibiotic schedule',
      coachTip: 'Vital signs every 15 minutes is an order, not a suggestion. Set a timer and actually retake them during the sim.' },
    { n: 10, text: 'Communicate findings using SBAR.', critical: true, phase: 'communicate',
      evidence: 'gave a structured SBAR naming the platelet count, fibrinogen, INR, lactate, and active bleeding sites, and requested blood products',
      coachTip: 'Say the four numbers that define DIC: platelets 48,000, fibrinogen 90, INR 2.8, D-dimer 5000. Then ask for FFP, cryoprecipitate, and platelets.' },
    { n: 11, text: 'Prepare for blood product administration.', critical: true, phase: 'intervene',
      evidence: 'verified type and crossmatch, obtained large-bore access with normal saline priming, gathered a blood administration set, and arranged the second-nurse verification',
      coachTip: 'Blood hangs with 0.9 percent sodium chloride only, through a filtered set, with two-nurse verification and vital signs before, at 15 minutes, and after.' },
    { n: 12, text: 'Escalate care appropriately.', critical: true, phase: 'escalate',
      evidence: 'activated the Rapid Response Team and requested provider evaluation for ICU transfer',
      coachTip: 'Bleeding plus a lactate of 4.8 plus rising creatinine is multi-organ failure in progress. Call early.' },
    { n: 13, text: 'Complete tasks within 20-minute simulation time.', critical: false, phase: 'prep',
      evidence: 'finished assessment, interventions, SBAR, and escalation before the timer expired',
      coachTip: 'Budget roughly 5 minutes to assess, 5 to intervene, 5 to communicate, 5 to reassess.' }
  ],

  caseOverview: 'Mrs. Jane Smith is a 72-year-old female admitted three days ago with pneumonia that progressed to sepsis. Despite treatment, the patient has developed abnormal bleeding from multiple sites including the gums and intravenous insertion sites. Petechiae and bruising have appeared across the chest and upper extremities. Students must recognize deterioration in patient and intervene appropriately to prevent hemorrhage, septic shock, multi-organ dysfunction, and death.',
  currentTime: '0922',

  initialAssessment: [
    { system: 'General', findings: ['Alert', 'Pale', 'Fatigued', 'Lethargic'] },
    { system: 'Respiratory', findings: ['Tachypnea'] },
    { system: 'Cardiovascular', findings: ['Sinus tachycardia'] },
    { system: 'Integumentary', findings: ['Petechiae on chest and arms', 'Ecchymosis present', 'Oozing blood from IV insertion site', 'Bleeding gums'] },
    { system: 'Urinary', findings: ['Urine output <30 mL/hr'] }
  ],

  chart: {
    name: 'Jane Smith', age: '72 years', dob: '06/26/1954', sex: 'Female',
    heightRaw: '65 inches', heightCm: 165, weightKg: 78,
    allergies: ['No Known Drug Allergies'], codeStatus: 'Full Code',
    admittingDx: 'Sepsis secondary to Pneumonia',
    admitDate: '3 days ago', facility: 'Med/surg Unit', isolation: 'none', diet: 'Regular'
  },

  notes: [
    { at: 'Yesterday, 1800', text: 'Continue treatment for pneumonia and sepsis' },
    { at: 'Today, 0700', text: 'Increased fatigue and weakness, bleeding noticed in gums.' },
    { at: 'Today, 0922', text: 'Petechiae noted on chest and upper extremities.' }
  ],

  providerOrders: [
    { text: 'Continuous cardiac monitoring', category: 'monitoring' },
    { text: 'Vital signs every 15 minutes', category: 'monitoring' },
    { text: 'Keep SpO2 >95%', category: 'respiratory' },
    { text: 'Cefepime 1 g IV every 8 hours', category: 'medication' },
    { text: 'Vancomycin 1 g IV every 24 hours', category: 'medication' },
    { text: 'Strict intake and output', category: 'monitoring' }
  ],

  mar: [
    { at: 'Today, 0800', text: 'Cefepime IV' },
    { at: 'Today, 0900', text: 'Vancomycin IV' },
    { at: 'Today, 0900', text: '0.9% Sodium Chloride 125 mL/h' }
  ],

  labs: [
    { panel: 'CBC', name: 'WBC', value: '19.8', normalRange: '5-10', status: 'critical-high', interpretation: 'Marked leukocytosis - the sepsis that triggered the coagulation cascade is still active.' },
    { panel: 'CBC', name: 'Hgb', value: '10.2', normalRange: '12-16', status: 'low', interpretation: 'Anemia from ongoing blood loss and hemolysis as red cells shear through microthrombi.' },
    { panel: 'CBC', name: 'Hematocrit', value: '31%', normalRange: '37-47%', status: 'low', interpretation: 'Falling with the hemoglobin - consistent with active bleeding.' },
    { panel: 'CBC', name: 'Platelets', value: '48,000', normalRange: '150,000-400,000', status: 'critical-low', interpretation: 'Severe thrombocytopenia from consumption. Below 50,000 there is real spontaneous bleeding risk; institute bleeding precautions.' },
    { panel: 'BMP', name: 'Sodium', value: '133', normalRange: '135-145', status: 'low', interpretation: 'Mild hyponatremia of critical illness.' },
    { panel: 'BMP', name: 'Potassium', value: '4.8', normalRange: '3.5-5.0', status: 'normal', interpretation: 'High-normal - watch it, because worsening acute kidney injury will push it up.' },
    { panel: 'BMP', name: 'BUN', value: '36', normalRange: '10-20', status: 'high', interpretation: 'Elevated from hypoperfusion and catabolism.' },
    { panel: 'BMP', name: 'Creatinine', value: '2.1', normalRange: '0.6-1.2', status: 'critical-high', interpretation: 'Acute kidney injury from microvascular thrombi and hypoperfusion. Renal dosing must be reviewed - vancomycin especially.' },
    { panel: 'BMP', name: 'Glucose', value: '176', normalRange: '70-110', status: 'high', interpretation: 'Stress hyperglycemia.' },
    { panel: 'Perfusion Marker', name: 'Lactate', value: '4.8', normalRange: '0.5-2.0', status: 'critical-high', interpretation: 'Anaerobic metabolism from global hypoperfusion. Above 4 is a mortality predictor, not just a perfusion marker.' },
    { panel: 'Coagulation Panel', name: 'PT', value: '24 sec', normalRange: '11-13 sec', status: 'critical-high', interpretation: 'Prolonged - the extrinsic pathway factors have been consumed.' },
    { panel: 'Coagulation Panel', name: 'INR', value: '2.8', normalRange: '0.8-1.2', status: 'critical-high', interpretation: 'Significant coagulopathy in a patient on no anticoagulant. Fresh frozen plasma replaces these factors.' },
    { panel: 'Coagulation Panel', name: 'aPTT', value: '62 sec', normalRange: '25-35 sec', status: 'critical-high', interpretation: 'Prolonged intrinsic pathway - consumption, not heparin effect.' },
    { panel: 'Coagulation Panel', name: 'Fibrinogen', value: '90', normalRange: '200-400', status: 'critical-low', interpretation: 'Consumed by widespread clotting. Fibrinogen under 100 is the classic DIC finding and is replaced with cryoprecipitate.' },
    { panel: 'Coagulation Panel', name: 'D-Dimer', value: '5000', normalRange: '<500', status: 'critical-high', interpretation: 'Massive fibrin breakdown, proving clots are forming and lysing throughout the microvasculature.' }
  ],

  vitals: [
    { at: 'Today, 0600', bp: '118/70', map: 86, hr: 92, rr: 18, temp: '100.8 F', spo2: 94, pain: '', loc: 'Alert', flags: ['low-grade fever'] },
    { at: 'Today, 0800', bp: '108/64', map: 79, hr: 102, rr: 24, temp: '101.6 F', spo2: 93, pain: '', loc: 'Alert, lethargic', flags: ['fever', 'tachycardia', 'tachypnea', 'falling blood pressure'] }
  ],

  diagnostics: [],

  expectedSbar: {
    situation: 'This is the nurse on the Med/Surg unit calling about Mrs. Jane Smith, a 72-year-old female admitted three days ago with pneumonia and sepsis. She is now bleeding from her gums and IV sites with new petechiae, and I believe she is in DIC.',
    background: 'She has been treated with cefepime and vancomycin and is on 0.9 percent sodium chloride at 125 mL/hr. Bleeding from the gums was noted at 0700 and petechiae across the chest and upper extremities at 0922. She is Full Code, no known drug allergies, 78 kg.',
    assessment: 'Her latest vital signs at 0800 are 108/64 with a MAP of 79, heart rate 102, respiratory rate 24, temperature 101.6 F, SpO2 93 percent. She is pale and lethargic with urine output under 30 mL per hour. Platelets are 48,000, fibrinogen 90, D-dimer 5000, PT 24 seconds, INR 2.8, aPTT 62 seconds, lactate 4.8, creatinine 2.1, hemoglobin 10.2.',
    recommendation: 'I recommend orders for fresh frozen plasma, cryoprecipitate, and platelets, a type and crossmatch, repeat coagulation studies and lactate, bleeding precautions, and evaluation for ICU transfer. Please review her vancomycin dosing with a creatinine of 2.1. Can you come to the bedside?'
  },

  criticalErrors: [
    'Performing unnecessary venipunctures, intramuscular injections, or invasive procedures on a patient with a platelet count of 48,000',
    'Failing to recognize that low platelets with low fibrinogen and a high D-dimer together mean DIC',
    'Treating the bleeding as a local problem and only holding pressure without escalating',
    'Missing the urine output under 30 mL/hr as evidence of organ dysfunction',
    'Not obtaining large-bore access and type and crossmatch before the patient destabilizes',
    'Giving vancomycin on schedule without questioning the dose against a creatinine of 2.1'
  ],

  debriefQuestions: [
    'Which single lab value convinced you this was DIC rather than isolated thrombocytopenia?',
    'How can a patient be clotting and bleeding at the same time?',
    'Which blood product replaces which deficit - platelets, FFP, and cryoprecipitate?',
    'What bleeding precautions would you put in place for the rest of this shift?',
    'What is the definitive treatment for DIC, and why will blood products alone not fix her?'
  ],

  pearls: [
    'DIC is always secondary - find and treat the trigger, which here is sepsis, or the products you give will just be consumed',
    'The DIC panel signature: platelets down, fibrinogen down, D-dimer up, PT and aPTT prolonged',
    'Fibrinogen under 100 mg/dL is replaced with cryoprecipitate; prolonged PT and INR with fresh frozen plasma',
    'Platelets under 50,000 means bleeding precautions - soft toothbrush, electric razor, no IM injections, minimal venipunctures',
    'A D-dimer is sensitive but not specific; it is the company it keeps that makes the diagnosis',
    'Lactate above 4 is a mortality predictor, not just a perfusion marker'
  ]
},

/* ======================= 3. HEART FAILURE ======================= */
{
  id: 'ms2lab-heart-failure',
  course: 'NUR2212L-C',
  courseTitle: 'Medical Surgical 2 - Simulation Lab',
  topic: 'Heart Failure 1',
  sourceTopic: '',
  sourceNote: 'This packet prints the course code as NUR2212L-C and the title as "Medical Surgical 2 - Simulation Lab", unlike the other seven packets (NUR2212C, Medical-Surgical Nursing II). The header is marked "(Faculty)" although it is distributed as the student copy. No simulation duration is printed, so durationMin is null. The activity instructions do not include chart review, identity verification, or hand hygiene as numbered steps - those are assumed - and the packet has no numbered step for administering diuretics even though diuretic therapy is in the required knowledge. The Required Knowledge and Activity Instructions lists use indented sub-bullets; those are preserved in subItems or inline after a colon.',
  durationMin: null,
  introduction: 'Heart Failure (HF) is a complex clinical syndrome that occurs when the heart is unable to pump blood effectively to meet the body\'s metabolic demands. This results in decreased cardiac output and fluid accumulation in the lungs and peripheral tissues, leading to symptoms such as shortness of breath, fatigue, edema, and activity intolerance. Acute exacerbations of heart failure can develop rapidly and may progress to pulmonary edema, respiratory distress, dysrhythmias, or cardiogenic shock if not recognized and treated promptly. Early identification of risk factors, assessment findings, changes in respiratory and cardiovascular status, and abnormal diagnostic results is essential to prevent further deterioration and improve patient outcomes. This simulation provides ASN nursing students the opportunity to recognize signs and symptoms of heart failure exacerbation, assess fluid volume status and cardiopulmonary function, prioritize nursing care, implement evidence-based interventions, communicate effectively using SBAR, and identify signs of clinical deterioration requiring prompt escalation of care.',

  outcomes: [
    { n: 1, text: 'Correlate the integrative processes to the care of the client and family' },
    { n: 2, text: 'Demonstrate safe and effective care in the care of the client' },
    { n: 3, text: 'Relate health promotion and maintenance in the care of the client' },
    { n: 4, text: 'Relate components of psychosocial integrity in the care of the client' },
    { n: 5, text: 'Relate components of physiological integrity in the care of the client' },
    { n: 6, text: 'Demonstrate the competencies specific to entry level professional nursing' }
  ],

  requiredKnowledge: [
    'Explain the pathophysiology of Heart Failure (HF).',
    'Differentiate left-sided heart failure, right-sided heart failure, and biventricular heart failure.',
    'Recognize signs and symptoms of acute heart failure exacerbation.',
    'Perform a focused cardiovascular and respiratory assessment.',
    'Interpret laboratory findings associated with heart failure.',
    'Interpret diagnostic results, including chest X-ray, ECG findings, and B-type natriuretic peptide (BNP) levels.',
    'Assess fluid volume status, daily weights, and trends in intake and output.',
    'Describe indications and nursing considerations for: Oxygen therapy; Diuretic therapy; Vasodilator therapy; ACE inhibitors and ARBs; Beta-blockers; Fluid and sodium restrictions.',
    'Recognize signs and symptoms of pulmonary edema.',
    'Utilize SBAR communication.',
    'Recognize indications for Rapid Response Team activation.',
    'Prioritize care using the ABCs and clinical urgency.',
    'Identify signs of worsening cardiac output and impaired tissue perfusion.',
    'Recognize complications associated with heart failure, including: Pulmonary edema; Cardiac dysrhythmias; Cardiogenic shock; Acute respiratory failure.',
    'Implement evidence-based nursing interventions to improve oxygenation, reduce fluid overload, and promote hemodynamic stability.'
  ],

  activitySteps: [
    { n: 1, text: 'Perform a focused cardiovascular and respiratory assessment.', critical: true, phase: 'assess',
      evidence: 'auscultated heart sounds and all lung fields, palpated pulses, assessed edema, and counted a full-minute respiratory rate',
      coachTip: 'Listen to the posterior bases. Crackles in heart failure start at the bases and move up as the fluid climbs.' },
    { n: 2, text: 'Obtain a comprehensive patient history and symptom assessment.', critical: true, phase: 'assess',
      evidence: 'asked about orthopnea, paroxysmal nocturnal dyspnea, weight gain, diet and sodium, activity tolerance, and medication adherence',
      coachTip: 'Ask how many pillows he sleeps on. He already told you he cannot lie flat - that is orthopnea and it is diagnostic gold.' },
    { n: 3, text: 'Identify signs and symptoms of worsening heart failure.', critical: true, phase: 'interpret',
      evidence: 'named dyspnea, bibasilar crackles, +2 bilateral edema, JVD, weight gain, and SpO2 91 percent on room air',
      coachTip: 'Left-sided failure backs up into the lungs; right-sided backs up into the body. This patient has both.' },
    { n: 4, text: 'Assess fluid volume status, including intake and output, daily weights, edema, and jugular venous distention (JVD).', critical: true, phase: 'assess',
      evidence: 'inspected the neck for JVD at 30 to 45 degrees, graded the edema, and reviewed I&O and the daily weight',
      coachTip: 'One kilogram of weight gain equals about one liter of retained fluid. The scale finds fluid before the lungs do.' },
    { n: 5, text: 'Review laboratory and diagnostic results:', critical: true, phase: 'interpret',
      subItems: ['B-type natriuretic peptide (BNP) or NT-proBNP', 'Complete metabolic panel (CMP)', 'Electrolytes (especially potassium and sodium)', 'Chest X-ray findings', 'ECG findings', 'Echocardiogram results (if available)'],
      evidence: 'verbalized the BNP of 1,250, sodium 132, potassium 4.8, BUN 28, creatinine 1.3, and the sinus tachycardia on ECG',
      coachTip: 'A BNP over 100 supports heart failure; 1,250 is a loud yes. It is the value that separates cardiac dyspnea from pulmonary dyspnea.' },
    { n: 6, text: 'Identify potential causes of heart failure exacerbation.', critical: true, phase: 'interpret',
      evidence: 'considered dietary sodium and fluid excess, medication nonadherence, uncontrolled hypertension, ischemia, dysrhythmia, and infection',
      coachTip: 'The most common trigger for an exacerbation is nonadherence to diet or medication. Always ask before you blame the heart.' },
    { n: 7, text: 'Initiate evidence-based nursing interventions.', critical: true, phase: 'intervene',
      evidence: 'placed the patient in high Fowler position, applied and titrated oxygen, limited exertion, and initiated strict I&O',
      coachTip: 'Upright position first. It drops preload and recruits lung volume before any drug can work.' },
    { n: 8, text: 'Communicate findings using SBAR.', critical: true, phase: 'communicate',
      evidence: 'gave a structured SBAR including the BNP of 1,250, SpO2 91 percent on room air, crackles, JVD, and +2 edema',
      coachTip: 'Ask for what you need: a diuretic order, a chest x-ray, and continued oxygen titration. Do not just report and wait.' },
    { n: 9, text: 'Implement provider orders safely.', critical: true, phase: 'intervene',
      evidence: 'titrated oxygen via nasal cannula to keep SpO2 above 95 percent, applied continuous cardiac monitoring, drew CBC, BMP, and BNP, obtained the STAT EKG, and started hourly I&O',
      coachTip: 'The EKG is STAT. In a heart failure patient with a heart rate of 102 you need to know whether the rhythm is the cause or the consequence.' },
    { n: 10, text: 'Monitor for complications, including:', critical: true, phase: 'assess',
      subItems: ['Pulmonary edema', 'Acute respiratory distress', 'Cardiac dysrhythmias', 'Cardiogenic shock', 'Decreased cardiac output', 'Worsening fluid overload'],
      evidence: 'reassessed lung sounds, work of breathing, rhythm, blood pressure, and mentation after intervening',
      coachTip: 'Pink frothy sputum, crackles rising above the bases, and sudden anxiety mean flash pulmonary edema. That is a rapid response.' },
    { n: 11, text: 'Assess response to oxygen therapy and prescribed medications.', critical: true, phase: 'assess',
      evidence: 'rechecked SpO2 and respiratory effort after the nasal cannula was applied and documented the response',
      coachTip: 'He went on 2 L at 0945. Recheck the saturation - an intervention you never evaluate is an intervention you never finished.' },
    { n: 12, text: 'Monitor oxygen saturation, respiratory effort, and lung sounds.', critical: true, phase: 'assess',
      evidence: 'maintained continuous pulse oximetry and re-auscultated lungs during the scenario',
      coachTip: 'Lung sounds are a trend, not a one-time finding. Listen at the start and again before you hand off.' },
    { n: 13, text: 'Escalate care appropriately.', critical: true, phase: 'escalate',
      evidence: 'notified the provider or activated rapid response for worsening oxygenation or hemodynamic compromise',
      coachTip: 'Escalate on trajectory, not just on a threshold. A saturation falling despite oxygen is worse than a low but stable one.' },
    { n: 14, text: 'Participate in debriefing.', critical: false, phase: 'communicate',
      evidence: 'engaged in the post-simulation debrief and identified personal learning points',
      coachTip: 'Say out loud the one thing you would do differently. That sentence is what transfers to the floor.' }
  ],

  caseOverview: 'Mr. John Smith is a 72-year-old male who presented to the Emergency Department with increasing shortness of breath, fatigue, and swelling in his lower extremities. He reports, "I\'ve been getting more short of breath over the last few days, and I can\'t lie flat without feeling like I can\'t breathe." Upon arrival, the patient appeared mildly anxious and dyspneic with signs of fluid overload and was admitted with a suspected acute exacerbation of Heart Failure (HF). He is currently on oxygen therapy, Full Code, and has an allergy to Aspirin. You are assuming care at 1000. Students must recognize the signs and symptoms of acute heart failure exacerbation, perform a focused cardiovascular and respiratory assessment, assess fluid volume status, interpret laboratory and diagnostic findings, initiate appropriate nursing interventions, communicate effectively with the provider using SBAR, and identify signs of worsening cardiopulmonary status and potential complications requiring escalation of care.',
  currentTime: '1000',

  medicalHistory: [
    'Hypertension - Lisinopril 10 mg daily',
    'Chronic Heart Failure',
    'Hyperlipidemia - Atorvastatin 40 mg hs',
    'Type 2 Diabetes Mellitus - Metformin 500 mg daily'
  ],

  initialAssessment: [
    { system: 'General Appearance', findings: ['Alert and oriented x3', 'Appears fatigued', 'Mild anxiety related to shortness of breath'] },
    { system: 'Cardiovascular', findings: ['S1/S2 present', 'Heart rate mildly elevated', 'Pulses +2 throughout', 'Bilateral lower extremity edema (+2)'] },
    { system: 'Respiratory', findings: ['Mild to moderate dyspnea', 'Crackles auscultated at bilateral lung bases', 'Increased work of breathing with activity', 'Oxygen saturation decreased on room air'] },
    { system: 'Fluid Volume Status', findings: ['Bilateral lower extremity edema', 'Recent weight gain reported', 'Jugular venous distention (JVD) present', 'Positive fluid balance'] }
  ],

  chart: {
    name: 'John Smith', age: '72 years', dob: '06/26/1954', sex: 'Male',
    heightRaw: '70 inch', heightCm: 178, weightKg: 90,
    allergies: ['Aspirin'], codeStatus: 'Full Code',
    admittingDx: 'Heart Failure',
    admitDate: 'Today', facility: 'Emergency Department', isolation: 'None', diet: 'NPO'
  },

  notes: [
    { at: 'Today, 0930', text: 'Patient admitted to ED with complaints of shortness of breath.' },
    { at: 'Today, 0945', text: 'Patient has vital signs taken. Patient placed on 2 L nasal cannula after Vital Signs taken.' }
  ],

  providerOrders: [
    { text: 'Oxygen Titration via Nasal Cannula to keep O2 > 95%', category: 'respiratory' },
    { text: 'Continuous Cardiac Monitoring', category: 'monitoring' },
    { text: 'CBC, BMP, BNP', category: 'lab' },
    { text: 'STAT EKG', category: 'monitoring' },
    { text: 'Monitor I&Os q1h', category: 'monitoring' }
  ],

  mar: [
    { at: '', text: 'None administered' }
  ],

  labs: [
    { panel: 'CBC', name: 'WBC', value: '8.4', normalRange: '5-10', status: 'normal', interpretation: 'Normal - argues against pneumonia or infection as the cause of this dyspnea.' },
    { panel: 'CBC', name: 'HGB', value: '12.8', normalRange: '12-16', status: 'normal', interpretation: 'Normal. Anemia would worsen heart failure by raising cardiac demand, so this is reassuring.' },
    { panel: 'CBC', name: 'Hematocrit', value: '38%', normalRange: '37-47%', status: 'normal', interpretation: 'Low-normal, consistent with dilution from fluid overload.' },
    { panel: 'CBC', name: 'Platelets', value: '311,000', normalRange: '150,000-400,000', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'Sodium', value: '132', normalRange: '135-145', status: 'low', interpretation: 'Dilutional hyponatremia from fluid retention - a marker of heart failure severity, not of salt deficiency. Do not give sodium.' },
    { panel: 'BMP', name: 'Potassium', value: '4.8', normalRange: '3.5-5.0', status: 'normal', interpretation: 'High-normal now. Baseline this value, because loop diuretics will drop it fast.' },
    { panel: 'BMP', name: 'Chloride', value: '100', normalRange: '98-106', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'Calcium', value: '9', normalRange: '9-10.5', status: 'normal', interpretation: 'Low end of normal.' },
    { panel: 'BMP', name: 'BUN', value: '28', normalRange: '10-20', status: 'high', interpretation: 'Elevated from reduced renal perfusion - cardiorenal effect of low cardiac output.' },
    { panel: 'BMP', name: 'Creatinine', value: '1.3', normalRange: '0.6-1.2', status: 'high', interpretation: 'Mildly elevated. Watch it closely once diuresis starts.' },
    { panel: 'BMP', name: 'Glucose', value: '202', normalRange: '70-110', status: 'high', interpretation: 'Hyperglycemia in a patient with type 2 diabetes on metformin, worsened by acute stress.' },
    { panel: 'BNP', name: 'BNP', value: '1,250', normalRange: '< 100', status: 'critical-high', interpretation: 'Markedly elevated. BNP is released when ventricles stretch; over 100 supports heart failure and 1,250 indicates significant volume overload.' }
  ],

  vitals: [
    { at: 'Today, 0945', bp: '152/90', map: 111, hr: 102, rr: 22, temp: '98.7 F', spo2: 91, pain: '', loc: 'Alert and oriented x3', flags: ['hypertension', 'tachycardia', 'tachypnea', 'hypoxemia on room air'], note: 'SpO2 91% on Room Air' }
  ],

  diagnostics: [
    { name: 'ECG', finding: 'Sinus Tachycardia',
      interpretation: 'Compensatory tachycardia maintaining cardiac output in the face of a low stroke volume. It also shortens diastolic filling time, which makes the failure worse - watch for atrial fibrillation.' }
  ],

  expectedSbar: {
    situation: 'This is the nurse in the Emergency Department calling about Mr. John Smith, a 72-year-old male admitted this morning with a suspected acute heart failure exacerbation. He is short of breath with an SpO2 of 91 percent on room air and I need orders for diuresis.',
    background: 'He arrived at 0930 with several days of worsening dyspnea, orthopnea, fatigue, and leg swelling. His history includes chronic heart failure, hypertension on lisinopril, hyperlipidemia on atorvastatin, and type 2 diabetes on metformin. He is allergic to aspirin, Full Code, 90 kg, and currently NPO. He was placed on 2 L nasal cannula at 0945 and no medications have been given.',
    assessment: 'At 0945 his blood pressure was 152/90, heart rate 102, respiratory rate 22, temperature 98.7 F, SpO2 91 percent on room air. He has bibasilar crackles, JVD, +2 bilateral lower extremity edema, and increased work of breathing with activity. His BNP is 1,250, sodium 132, BUN 28, creatinine 1.3, and the EKG shows sinus tachycardia.',
    recommendation: 'I have him in high Fowler with oxygen titrating to keep the saturation above 95 percent. I recommend an IV loop diuretic, a chest x-ray, an echocardiogram, strict intake and output with daily weights, a repeat BMP after diuresis to follow the potassium, and consideration of a fluid and sodium restriction. Do you want a Foley for accurate output?'
  },

  criticalErrors: [
    'Laying the patient flat, which worsens orthopnea and oxygenation',
    'Giving an IV fluid bolus to a patient who is already volume overloaded',
    'Missing the JVD and bibasilar crackles and attributing the dyspnea to anxiety',
    'Failing to obtain the STAT EKG in a patient with a heart rate of 102 and known heart failure',
    'Administering aspirin to a patient with a documented aspirin allergy',
    'Interpreting the sodium of 132 as a need for sodium replacement rather than as dilutional overload',
    'Starting diuresis without baselining the potassium and renal function'
  ],

  debriefQuestions: [
    'Which findings told you this was left-sided failure, and which told you it was right-sided?',
    'Why is the sodium low when the patient is fluid overloaded, and what would happen if you treated it with saline?',
    'What does a BNP of 1,250 add that your physical assessment did not already tell you?',
    'What would you monitor in the hour after the first dose of furosemide?',
    'What early findings would tell you he was moving into flash pulmonary edema or cardiogenic shock?',
    'What discharge teaching would most likely prevent the next admission?'
  ],

  pearls: [
    'Left-sided failure backs up into the lungs - crackles, orthopnea, PND, frothy sputum; right-sided backs up into the body - JVD, peripheral edema, ascites, hepatomegaly',
    'BNP is released by ventricular stretch; over 100 supports heart failure and helps separate cardiac from pulmonary dyspnea',
    'Hyponatremia in heart failure is dilutional - the answer is fluid restriction and diuresis, not sodium',
    'One kilogram of weight gain is about one liter of fluid; daily weights on the same scale at the same time are the most sensitive monitor',
    'High Fowler position reduces preload and improves lung expansion before any medication acts',
    'Loop diuretics waste potassium - check the potassium before and after, and watch for digoxin toxicity if the patient takes it',
    'Sudden anxiety with pink frothy sputum is flash pulmonary edema and requires immediate escalation'
  ]
},

/* ====================== 4. INCREASED ICP ====================== */
{
  id: 'ms2lab-icp',
  course: 'NUR2212C',
  courseTitle: 'Medical-Surgical Nursing II - Simulation Lab',
  topic: 'Increased Intracranial Pressure (ICP)',
  sourceTopic: '',
  sourceNote: 'SOURCE DEFECT: the physician order prints "Maintain oxygen SpO2 <95%". That is clinically backwards - hypoxemia raises ICP through cerebral vasodilation, and the intent is to maintain SpO2 GREATER than 95 percent. The order is kept verbatim; students should question it rather than follow it literally. A second inconsistency: mannitol is written as "Pending physicians order" yet the MAR records it as given at 1000. The packet also prints no GCS score even though two activity steps require monitoring GCS trends, and states no start clock - the latest charted event (1000) is used as the current time.',
  durationMin: 20,
  introduction: 'Increased Intracranial Pressure (ICP) is a neurological emergency that occurs when pressure within the cranial vault rises due to cerebral edema, hemorrhage, mass effect, or impaired cerebrospinal fluid drainage. Elevated ICP can decrease cerebral perfusion, resulting in ischemia, neurological deterioration, brain herniation, respiratory failure, permanent neurological injury, and death. This simulation allows ASN nursing students to recognize early manifestations of increased intracranial pressure, identify neurological deterioration, perform focused neurological assessments, implement evidence-based nursing interventions, communicate effectively using SBAR, and escalate care appropriately to prevent secondary brain injury.',

  outcomes: [
    { n: 1, text: 'Correlate the integrative processes to the care of the client and family' },
    { n: 2, text: 'Demonstrate safe and effective care in the care of the client' },
    { n: 3, text: 'Relate health promotion and maintenance in the care of the client' },
    { n: 4, text: 'Relate components of psychosocial integrity in the care of the client' },
    { n: 5, text: 'Relate components of physiological integrity in the care of the client' },
    { n: 6, text: 'Demonstrate the competencies specific to entry-level professional nursing' }
  ],

  requiredKnowledge: [
    'Describe the pathophysiology of increased intracranial pressure.',
    'Discuss cerebral perfusion pressure and factors affecting cerebral blood flow.',
    'Perform a focused neurological assessment.',
    'Interpret Glasgow Coma Scale (GCS) findings.',
    'Assess pupillary response and motor function.',
    'Recognize signs of neurological deterioration.',
    'Identify manifestations of Cushing\'s Triad.',
    'Discuss interventions used to reduce ICP.',
    'Utilize SBAR communication.',
    'Recognize indications for Rapid Response Team activation.'
  ],

  activitySteps: [
    { n: 1, text: 'Receive and review patient chart.', critical: true, phase: 'prep',
      evidence: 'opened the chart and reviewed the mechanism of injury, orders, MAR, labs, and the CT report',
      coachTip: 'The notes show headache at 0600, confusion at 0800, and GCS decline at 1000. That trajectory is the whole scenario.' },
    { n: 2, text: 'Verify patient identity using two identifiers.', critical: true, phase: 'prep',
      evidence: 'stated name and date of birth and compared them to the armband',
      coachTip: 'Two identifiers before anything else - name and date of birth, never room number. A confused patient cannot reliably confirm his own name.' },
    { n: 3, text: 'Perform hand hygiene and apply standard precautions.', critical: true, phase: 'prep',
      evidence: 'performed hand hygiene on entry and donned gloves before contact',
      coachTip: 'Hand hygiene is scored every time, including before and after the neuro exam.' },
    { n: 4, text: 'Perform focused neurological assessment.', critical: true, phase: 'assess',
      evidence: 'assessed level of consciousness, orientation, pupils, motor strength in all four extremities, and speech',
      coachTip: 'Level of consciousness is the earliest and most sensitive indicator of rising ICP. It changes before the pupils and long before the vital signs.' },
    { n: 5, text: 'Review provider orders, laboratory findings, and CT scan report.', critical: true, phase: 'interpret',
      evidence: 'verbalized the CT impression of cerebral edema with increasing midline shift and reviewed the mannitol order',
      coachTip: 'Midline shift means mass effect. That is the imaging word that should make you move.' },
    { n: 6, text: 'Recognize manifestations of increased ICP.', critical: true, phase: 'interpret',
      evidence: 'named headache, declining level of consciousness, confusion, and drowsiness as early signs and stated what late signs would look like',
      coachTip: 'Early: headache, restlessness, confusion, declining LOC. Late: Cushing triad, pupil changes, posturing, vomiting.' },
    { n: 7, text: 'Monitor Glasgow Coma Scale trends.', critical: true, phase: 'assess',
      evidence: 'scored eye opening, verbal, and motor responses and compared the score to the previous assessment',
      coachTip: 'A drop of 2 or more GCS points is a reportable change. Trend beats a single number every time.' },
    { n: 8, text: 'Assess pupillary response and neurological status.', critical: true, phase: 'assess',
      evidence: 'checked pupil size, equality, and reaction to light bilaterally',
      coachTip: 'A unilateral sluggish or blown pupil is uncal herniation compressing cranial nerve III. That is a call-now finding.' },
    { n: 9, text: 'Prioritize interventions using ABCs.', critical: true, phase: 'intervene',
      evidence: 'protected the airway, ensured oxygenation, kept the head of bed at 30 degrees with the head midline, and clustered care to limit stimulation',
      coachTip: 'Head of bed 30 degrees, head midline, no neck flexion, no hip flexion. Those free interventions improve venous drainage immediately.' },
    { n: 10, text: 'Implement provider orders.', critical: true, phase: 'intervene',
      evidence: 'performed hourly neuro checks, maintained the head of bed at 30 degrees, ran the saline at 75 mL/hr, kept strict I&O, and arranged the STAT CT head',
      coachTip: 'Question the order that says keep SpO2 below 95 percent. Hypoxemia dilates cerebral vessels and raises ICP - clarify it before you act.' },
    { n: 11, text: 'Communicate significant findings using SBAR.', critical: true, phase: 'communicate',
      evidence: 'gave a structured SBAR naming the GCS decline, the CT findings, and the request for mannitol authorization',
      coachTip: 'Report the change, not the snapshot: "his GCS has fallen since 0600 and the CT now shows midline shift."' },
    { n: 12, text: 'Prepare for administration of Mannitol if ordered.', critical: true, phase: 'intervene',
      evidence: 'verified the dose against weight, obtained a filter needle and administration set, checked the solution for crystals, confirmed IV patency, and planned to monitor output, serum osmolality, and electrolytes',
      coachTip: 'Mannitol 42 g for 84 kg is 0.5 g/kg - a correct dose. Use a filter set, inspect for crystals, and expect a brisk diuresis, so watch the blood pressure and electrolytes.' },
    { n: 13, text: 'Escalate care appropriately.', critical: true, phase: 'escalate',
      evidence: 'activated the Rapid Response Team or notified neurosurgery for the declining GCS and midline shift',
      coachTip: 'Waiting for Cushing triad is waiting too long. It is a late herniation sign, not a trigger to start worrying.' },
    { n: 14, text: 'Complete tasks within 20-minute simulation time.', critical: false, phase: 'prep',
      evidence: 'finished assessment, interventions, SBAR, and escalation before the timer expired',
      coachTip: 'Budget roughly 5 minutes to assess, 5 to intervene, 5 to communicate, 5 to reassess.' }
  ],

  caseOverview: 'Mr. John Smith is a 72-year-old male admitted following a traumatic brain injury sustained during a motor vehicle accident. Twelve hours after admission, the patient begins demonstrating subtle neurological changes. The healthcare team is concerned that the patient may be developing increased intracranial pressure. Early recognition and intervention are critical because untreated ICP can rapidly progress to brain herniation, respiratory failure, permanent neurological damage, and death.',
  currentTime: '1000',

  initialAssessment: [
    { system: 'Neurological', findings: ['Headache', 'Mild confusion'] },
    { system: 'Respiratory', findings: ['Respirations unlabored'] },
    { system: 'Musculoskeletal', findings: ['Moves all extremities equally'] }
  ],

  chart: {
    name: 'John Smith', age: '72 years', dob: '06/26/1954', sex: 'Male',
    heightRaw: '74 inch', heightCm: 188, weightKg: 84,
    allergies: ['No Known Drug Allergies'], codeStatus: 'Full Code',
    admittingDx: 'Traumatic Brain Injury with Increasing Intracranial Pressure',
    admitDate: 'Yesterday', facility: 'Neuro Step-down Unit', isolation: 'none', diet: 'Regular'
  },

  notes: [
    { at: 'Yesterday, 2200', text: 'Admitted following motor vehicle accident.' },
    { at: 'Today, 0600', text: 'C/o headache.' },
    { at: 'Today, 0800', text: 'Mild confusion noted and drowsiness.' },
    { at: 'Today, 1000', text: 'GCS decline noted.' }
  ],

  providerOrders: [
    { text: 'Neuro checks every hour', category: 'monitoring' },
    { text: 'Maintain head of bed at 30 degrees', category: 'procedure' },
    { text: 'Maintain oxygen SpO2 <95%', category: 'respiratory' },
    { text: 'Strict intake and output', category: 'monitoring' },
    { text: '0.9% Sodium Chloride 75 mL/H', category: 'access' },
    { text: 'Acetaminophen 650 mg PO for pain', category: 'medication' },
    { text: 'Mannitol 20% 42g IV over 30 minutes (Pending physicians order)', category: 'medication' },
    { text: 'STAT CT head', category: 'imaging' }
  ],

  mar: [
    { at: 'Today, 0800', text: 'Acetaminophen 650 mg PO' },
    { at: 'Today, 1000', text: 'Mannitol 20% 42 g IV' },
    { at: 'Today, 1000', text: '0.9% Sodium Chloride 75 mL/H' }
  ],

  labs: [
    { panel: 'CBC', name: 'WBC', value: '11.8', normalRange: '5-10', status: 'high', interpretation: 'Mild leukocytosis - a stress response to trauma rather than proof of infection.' },
    { panel: 'CBC', name: 'RBC', value: '4.6', normalRange: '4.2-5.4', status: 'normal', interpretation: 'Normal - no evidence of significant occult blood loss from the accident.' },
    { panel: 'CBC', name: 'Hgb', value: '14.1', normalRange: '12-16', status: 'normal', interpretation: 'Normal. Adequate oxygen-carrying capacity protects the injured brain.' },
    { panel: 'CBC', name: 'Hematocrit', value: '42%', normalRange: '37-47%', status: 'normal', interpretation: 'Normal.' },
    { panel: 'CBC', name: 'Platelets', value: '280,000', normalRange: '150,000-400,000', status: 'normal', interpretation: 'Normal - important in a head injury, where thrombocytopenia would raise the risk of extending the bleed.' },
    { panel: 'BMP', name: 'Sodium', value: '138', normalRange: '135-145', status: 'normal', interpretation: 'Normal baseline. Mannitol and any hypertonic saline therapy will move this - recheck after treatment.' },
    { panel: 'BMP', name: 'Potassium', value: '4.1', normalRange: '3.5-5.0', status: 'normal', interpretation: 'Normal. Mannitol diuresis can drop it.' },
    { panel: 'BMP', name: 'BUN', value: '18', normalRange: '10-20', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'Creatinine', value: '1.0', normalRange: '0.6-1.2', status: 'normal', interpretation: 'Normal renal function, which is required before giving mannitol.' },
    { panel: 'BMP', name: 'Glucose', value: '110', normalRange: '70-110', status: 'normal', interpretation: 'Upper limit of normal. Hyperglycemia worsens secondary brain injury, so keep watching it.' }
  ],

  vitals: [
    { at: 'Today, 0600', bp: '128/78', map: 95, hr: 84, rr: 18, temp: '99.4 F', spo2: 97, pain: 'Headache reported', loc: 'Awake, complaining of headache', flags: [] },
    { at: 'Today, 0900', bp: '138/84', map: 102, hr: 88, rr: 18, temp: '99.0 F', spo2: 96, pain: 'Headache reported', loc: 'Mild confusion, drowsy', flags: ['rising systolic pressure', 'declining level of consciousness'] }
  ],

  diagnostics: [
    { name: 'CT Head', finding: 'Cerebral edema with increasing midline shift, consistent with worsening intracranial pressure.',
      interpretation: 'Midline shift means mass effect displacing brain tissue and is a herniation risk. It converts this from monitoring to urgent intervention - osmotic therapy now and neurosurgical evaluation.' }
  ],

  expectedSbar: {
    situation: 'This is the nurse on the Neuro Step-Down Unit calling about Mr. John Smith, a 72-year-old male admitted yesterday at 2200 after a motor vehicle accident with a traumatic brain injury. His neurological status is declining and I need you at the bedside.',
    background: 'He was neurologically intact on admission. He reported a headache at 0600, developed mild confusion and drowsiness by 0800, and his GCS has declined at 1000. He is Full Code, no known drug allergies, 84 kg, on 0.9 percent sodium chloride at 75 mL/hr, and received acetaminophen 650 mg at 0800.',
    assessment: 'At 0900 his blood pressure was 138/84, up from 128/78, heart rate 88, respiratory rate 18, temperature 99.0 F, SpO2 96 percent. He is drowsy and confused with a falling GCS. The CT head shows cerebral edema with increasing midline shift. His labs are unremarkable with a sodium of 138 and creatinine of 1.0.',
    recommendation: 'His head of bed is at 30 degrees with the head midline and I am clustering care. I need authorization for the mannitol 20 percent 42 g IV over 30 minutes, neurosurgery evaluation, a repeat CT, an order for serial sodium and serum osmolality, and clarification of the oxygen order, which currently reads to keep the SpO2 below 95 percent. Should I place a Foley for accurate output during osmotic therapy?'
  },

  criticalErrors: [
    'Following the printed order to keep SpO2 below 95 percent instead of clarifying it - hypoxemia raises ICP',
    'Flexing the neck or hips, or lowering the head of bed, which obstructs cerebral venous drainage',
    'Clustering painful or stimulating care all at once, spiking ICP',
    'Suctioning without preoxygenating or for longer than 10 seconds',
    'Waiting for Cushing triad before escalating - it is a late herniation sign',
    'Giving mannitol without a filter set, without checking for crystals, or without monitoring output, sodium, and osmolality',
    'Missing a 2-point GCS decline because only a single assessment was performed'
  ],

  debriefQuestions: [
    'What was the earliest sign of rising ICP in this patient, and at what time could it have been caught?',
    'What is cerebral perfusion pressure, and how do MAP and ICP determine it?',
    'What are the three components of Cushing\'s triad, and why is it a late sign?',
    'Which nursing interventions lower ICP without any medication at all?',
    'How does mannitol work, and what must you monitor before, during, and after the infusion?',
    'Which finding in this scenario would have made you call a rapid response immediately?'
  ],

  pearls: [
    'A declining level of consciousness is the earliest and most sensitive sign of increasing ICP',
    'Cushing\'s triad - hypertension with a widening pulse pressure, bradycardia, and irregular respirations - is a LATE herniation sign',
    'CPP equals MAP minus ICP; keep CPP at 60 to 70 mmHg, so treating hypotension is treating the brain',
    'Head of bed 30 degrees with the head midline and hips unflexed promotes venous drainage and costs nothing',
    'Hypoxemia and hypercapnia dilate cerebral vessels and raise ICP - oxygenate and avoid prolonged suctioning',
    'Mannitol is an osmotic diuretic given through a filter; monitor urine output, serum sodium, serum osmolality, and blood pressure',
    'Avoid hypotonic fluids such as D5W in head injury - they worsen cerebral edema',
    'A unilateral dilated, sluggish pupil suggests uncal herniation and cranial nerve III compression'
  ]
},

/* ===================== 5. PULMONARY EMBOLISM ===================== */
{
  id: 'ms2lab-pe',
  course: 'NUR2212C',
  courseTitle: 'Medical-Surgical Nursing II - Simulation Lab',
  topic: 'Pulmonary Embolism with Progression to Obstructive Shock',
  sourceTopic: '',
  sourceNote: 'The packet header is marked "(Faculty)" although it is distributed as the student copy. SOURCE INCONSISTENCY: the surgery is a LEFT total knee replacement and the Doppler confirms a LEFT lower extremity DVT, but the Initial Assessment prints "Right calf tenderness". The assessment line is kept verbatim; the left leg is the clinically consistent side. The MAR also records a heparin bolus at 1015 and infusion at 1020, after the 1000 start time, so those entries are the expected actions rather than events already completed. The 1000 note prints "Chest pain and hypoxemia develpes." and is kept verbatim.',
  durationMin: 20,
  introduction: 'Pulmonary embolism (PE) is a life-threatening condition caused by obstruction of pulmonary blood flow, most commonly resulting from a thrombus originating in the deep veins of the lower extremities. Large pulmonary emboli can significantly impair oxygenation, decrease cardiac output, and rapidly progress to obstructive shock, cardiovascular collapse, and death. This simulation allows ASN nursing students to recognize manifestations of pulmonary embolism, identify progression toward obstructive shock, implement evidence-based nursing interventions, communicate effectively using SBAR, and escalate care appropriately.',

  outcomes: [
    { n: 1, text: 'Correlate the integrative processes to the care of the client and family' },
    { n: 2, text: 'Demonstrate safe and effective care in the care of the client' },
    { n: 3, text: 'Relate health promotion and maintenance in the care of the client' },
    { n: 4, text: 'Relate components of psychosocial integrity in the care of the client' },
    { n: 5, text: 'Relate components of physiological integrity in the care of the client' },
    { n: 6, text: 'Demonstrate the competencies specific to entry level professional nursing' }
  ],

  requiredKnowledge: [
    'Describe the pathophysiology of pulmonary embolism.',
    'Recognize risk factors for venous thromboembolism.',
    'Recognize manifestations of pulmonary embolism.',
    'Interpret D-dimer, ABGs, CT angiography, and Doppler ultrasound findings.',
    'Recognize signs of respiratory distress and obstructive shock.',
    'Perform focused cardiovascular, respiratory, neurological, and perfusion assessments.',
    'Discuss anticoagulation therapy.',
    'Utilize SBAR communication.',
    'Recognize indications for Rapid Response Team activation.',
    'Identify signs of patient deterioration requiring ICU transfer.'
  ],

  activitySteps: [
    { n: 1, text: 'Receive and review patient chart.', critical: true, phase: 'prep',
      evidence: 'opened the chart and reviewed the postoperative course, orders, MAR, labs, and imaging',
      coachTip: 'Postoperative day three after a knee replacement with calf discomfort is a Virchow triad checklist waiting to happen. Know that before you walk in.' },
    { n: 2, text: 'Verify patient identity using two identifiers.', critical: true, phase: 'prep',
      evidence: 'stated name and date of birth and compared them to the armband',
      coachTip: 'Two identifiers before anything else - name and date of birth, never room number. Heparin is a high-alert drug; identity errors are fatal.' },
    { n: 3, text: 'Perform hand hygiene and apply standard precautions.', critical: true, phase: 'prep',
      evidence: 'performed hand hygiene on entry and donned gloves before contact',
      coachTip: 'Hand hygiene is scored every time, even in an emergency. Especially in an emergency.' },
    { n: 4, text: 'Perform focused cardiopulmonary assessment.', critical: true, phase: 'assess',
      evidence: 'auscultated lungs and heart, counted a full-minute respiratory rate, assessed both calves for tenderness, swelling, and warmth, and checked skin color and capillary refill',
      coachTip: 'Clear lung sounds with severe dyspnea and hypoxemia is the classic PE mismatch - the problem is perfusion, not ventilation.' },
    { n: 5, text: 'Review laboratory and diagnostic findings.', critical: true, phase: 'interpret',
      evidence: 'verbalized the D-dimer of 2.8, troponin 0.12, BNP 420, the ABG, the CT angiography result, and the Doppler result',
      coachTip: 'The elevated troponin and BNP here are right ventricular strain from the clot, not a heart attack and not heart failure.' },
    { n: 6, text: 'Recognize manifestations of pulmonary embolism.', critical: true, phase: 'interpret',
      evidence: 'named sudden dyspnea, pleuritic chest pain, tachypnea, tachycardia, anxiety, and hypoxemia in a postoperative patient',
      coachTip: 'Sudden is the key word. PE arrives in minutes; pneumonia arrives over days.' },
    { n: 7, text: 'Identify signs of obstructive shock.', critical: true, phase: 'interpret',
      evidence: 'linked falling blood pressure, rising heart rate, dizziness, pallor, and diaphoresis to failing forward flow',
      coachTip: 'Obstructive shock is a full tank with a blocked outlet. Fluids alone will not fix it - the clot has to go.' },
    { n: 8, text: 'Prioritize interventions using ABCs.', critical: true, phase: 'intervene',
      evidence: 'applied oxygen, raised the head of the bed, kept the patient on bedrest, and stayed with the patient',
      coachTip: 'Oxygen and semi-Fowler first, and do not leave the bedside. Bedrest prevents another embolus from breaking loose.' },
    { n: 9, text: 'Implement provider orders.', critical: true, phase: 'intervene',
      evidence: 'confirmed continuous pulse oximetry and cardiac monitoring, titrated oxygen, facilitated the STAT CT angiography and venous Doppler, and prepared the heparin per protocol',
      coachTip: 'CT angiography is STAT. Do not send an unstable patient to radiology alone - a nurse and monitoring go with her.' },
    { n: 10, text: 'Communicate findings using SBAR.', critical: true, phase: 'communicate',
      evidence: 'gave a structured SBAR naming the sudden onset, the CT result, the ABG, and the request for ICU transfer',
      coachTip: 'Say "large right pulmonary artery embolus" out loud. Naming the imaging finding gets the ICU bed.' },
    { n: 11, text: 'Prepare for anticoagulation therapy.', critical: true, phase: 'intervene',
      evidence: 'verified the heparin protocol dose with a second nurse, confirmed baseline aPTT and platelets, checked for bleeding, and confirmed protamine sulfate availability',
      coachTip: 'Heparin is high-alert: independent double check, weight-based protocol, baseline coagulation studies, and know that protamine sulfate is the antidote.' },
    { n: 12, text: 'Escalate care appropriately.', critical: true, phase: 'escalate',
      evidence: 'activated the Rapid Response Team and requested ICU transfer per the order for instability',
      coachTip: 'The order already says ICU transfer if unstable and to prepare for thrombolytics. Recognizing instability is your job, not the provider\'s.' },
    { n: 13, text: 'Complete tasks within the 20-minute simulation time.', critical: false, phase: 'prep',
      evidence: 'finished assessment, interventions, SBAR, and escalation before the timer expired',
      coachTip: 'Budget roughly 5 minutes to assess, 5 to intervene, 5 to communicate, 5 to reassess.' }
  ],

  caseOverview: 'It is now 1000. You are the nurse assuming care of Ms. Jane Smith on postoperative day three following a left total knee replacement. The patient has developed sudden shortness of breath, pleuritic chest pain, and hypoxemia. Earlier today the patient reported mild shortness of breath and discomfort in the operative leg. During assessment she suddenly develops severe shortness of breath, pleuritic chest pain, anxiety, tachycardia, and declining oxygen saturation. Students must recognize manifestations of pulmonary embolism and intervene appropriately to prevent obstructive shock, cardiovascular collapse, and death.',
  currentTime: '1000',

  initialAssessment: [
    { system: 'Neurological', findings: ['Alert', 'Anxious', 'Restless'] },
    { system: 'Respiratory', findings: ['Sudden onset dyspnea', 'Tachypnea', 'Increased work of breathing'] },
    { system: 'Cardiovascular', findings: ['Sinus tachycardia', 'Reports dizziness'] },
    { system: 'Peripheral Vascular', findings: ['Right calf tenderness'] },
    { system: 'Skin', findings: ['Pale', 'Mild diaphoresis'] }
  ],

  chart: {
    name: 'Jane Smith', age: '72 years', dob: '06/26/1954', sex: 'Female',
    heightRaw: '165 cm', heightCm: 165, weightKg: 94,
    allergies: ['No Known Drug Allergies'], codeStatus: 'Full Code',
    admittingDx: 'Left Total Knee Replacement',
    admitDate: 'Post-op day #3', facility: 'Med/surg Unit', isolation: 'none', diet: 'Regular'
  },

  notes: [
    { at: 'POD#1', text: 'Ambulating with assistance.' },
    { at: 'POD#2', text: 'Mild calf discomfort reported. Increased swelling in operative leg.' },
    { at: 'Today, 0922', text: 'Sudden onset shortness of breath.' },
    { at: 'Today, 1000', text: 'Chest pain and hypoxemia develpes.' }
  ],

  providerOrders: [
    { text: 'Oxygen 2L Nasal Cannula to keep O2 > 95%', category: 'respiratory' },
    { text: 'Continuous pulse oximetry', category: 'monitoring' },
    { text: 'Continuous cardiac monitoring', category: 'monitoring' },
    { text: 'CT angiography STAT', category: 'imaging' },
    { text: 'Heparin bolus and infusion per protocol', category: 'medication' },
    { text: 'Notify provider for worsening respiratory status', category: 'monitoring' },
    { text: 'Prepare for thrombolytic therapy if ordered', category: 'medication' },
    { text: 'Venous doppler ultrasound LLE', category: 'imaging' },
    { text: 'ICU transfer if unstable', category: 'procedure' }
  ],

  mar: [
    { at: 'Today, 0800', text: 'Enoxaparin 40 mg SQ' },
    { at: 'Today, 1015', text: 'Heparin Bolus' },
    { at: 'Today, 1020', text: 'Heparin Infusion' }
  ],

  labs: [
    { panel: 'CBC', name: 'WBC', value: '10.4', normalRange: '5-10', status: 'high', interpretation: 'Barely elevated - a postoperative inflammatory response, not evidence of infection.' },
    { panel: 'CBC', name: 'RBC', value: '4.5', normalRange: '4.2-5.4', status: 'normal', interpretation: 'Normal.' },
    { panel: 'CBC', name: 'Hgb', value: '13.5', normalRange: '12-16', status: 'normal', interpretation: 'Normal. Important as a baseline before heparin - any drop signals bleeding.' },
    { panel: 'CBC', name: 'Hematocrit', value: '41%', normalRange: '37-47%', status: 'normal', interpretation: 'Normal baseline before anticoagulation.' },
    { panel: 'CBC', name: 'Platelets', value: '285,000', normalRange: '150,000-400,000', status: 'normal', interpretation: 'Normal baseline. Recheck on heparin - a 50 percent drop suggests heparin-induced thrombocytopenia.' },
    { panel: 'BMP', name: 'Sodium', value: '138', normalRange: '135-145', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'Potassium', value: '4.2', normalRange: '3.5-5.0', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'BUN', value: '18', normalRange: '10-20', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'Creatinine', value: '1.0', normalRange: '0.6-1.2', status: 'normal', interpretation: 'Normal renal function - relevant because enoxaparin is renally cleared.' },
    { panel: 'BMP', name: 'Glucose', value: '108', normalRange: '70-110', status: 'normal', interpretation: 'Normal.' },
    { panel: 'Cardiac Markers', name: 'Troponin', value: '0.12', normalRange: '<0.04', status: 'high', interpretation: 'Elevated from right ventricular strain against the obstructed pulmonary artery, not from coronary occlusion. It predicts a worse outcome in PE.' },
    { panel: 'Cardiac Markers', name: 'BNP', value: '420', normalRange: '<100', status: 'high', interpretation: 'Elevated from right ventricular stretch. With the troponin it signals right heart strain and risk of obstructive shock.' },
    { panel: 'Coagulation', name: 'D-Dimer', value: '2.8', normalRange: '<0.50', status: 'critical-high', interpretation: 'Markedly elevated fibrin degradation product. Sensitive but not specific - it is the CT angiography that confirms the diagnosis.' },
    { panel: 'ABG', name: 'pH', value: '7.48', normalRange: '7.35-7.45', status: 'high', interpretation: 'Alkalemia from hyperventilation driven by hypoxemia and pain.' },
    { panel: 'ABG', name: 'PaCO2', value: '30', normalRange: '35-45', status: 'low', interpretation: 'Low from blowing off CO2. With the high pH this is acute respiratory alkalosis - the classic early PE gas.' },
    { panel: 'ABG', name: 'PaO2', value: '60', normalRange: '80-100', status: 'critical-low', interpretation: 'Hypoxemia at the threshold of respiratory failure, caused by dead-space ventilation where the lung is ventilated but not perfused.' },
    { panel: 'ABG', name: 'HCO3', value: '22', normalRange: '22-26', status: 'normal', interpretation: 'Normal - no renal compensation yet, confirming an acute event.' }
  ],

  vitals: [
    { at: 'Today, 0600', bp: '128/80', map: 96, hr: 88, rr: 18, temp: '98.4 F', spo2: 97, pain: '', loc: 'Alert', flags: [] },
    { at: 'Today, 1000', bp: '124/78', map: 93, hr: 98, rr: 20, temp: '98.4 F', spo2: 95, pain: 'Pleuritic chest pain', loc: 'Alert, anxious, restless', flags: ['rising heart rate', 'falling oxygen saturation', 'pleuritic chest pain'] }
  ],

  diagnostics: [
    { name: 'CT Angiography', finding: 'Large right pulmonary artery embolus consistent with acute pulmonary embolism.',
      interpretation: 'CT angiography is the gold standard for PE. A large central embolus explains the dead-space ventilation, the right ventricular strain markers, and the risk of obstructive shock.' },
    { name: 'Venous Doppler Ultrasound Left Lower Extremity', finding: 'Left lower extremity deep vein thrombosis.',
      interpretation: 'Confirms the source. The DVT is in the operative leg, so the remaining clot burden can embolize again - bedrest and anticoagulation now, and no massaging the calf.' }
  ],

  expectedSbar: {
    situation: 'This is the nurse on the Med/Surg unit calling about Ms. Jane Smith, a 72-year-old female on postoperative day three from a left total knee replacement. She has had sudden onset dyspnea with pleuritic chest pain and hypoxemia and the CT angiography shows a large right pulmonary artery embolus.',
    background: 'She ambulated with assistance on postoperative day one and reported calf discomfort and operative leg swelling on day two. She received enoxaparin 40 mg subcutaneously at 0800. Shortness of breath began suddenly at 0922 and chest pain and hypoxemia followed at 1000. She is Full Code, no known drug allergies, 94 kg.',
    assessment: 'At 1000 her blood pressure is 124/78 with a MAP of 93, heart rate 98, respiratory rate 20, temperature 98.4 F, SpO2 95 percent. She is anxious, restless, pale, and diaphoretic with calf tenderness. Her ABG shows pH 7.48, PaCO2 30, PaO2 60. D-dimer is 2.8, troponin 0.12, BNP 420. The Doppler confirms a left lower extremity DVT.',
    recommendation: 'I have her on oxygen with the head of bed up and on bedrest with continuous monitoring. I am starting the heparin bolus and infusion per protocol and I recommend ICU transfer now, evaluation for thrombolytic therapy, baseline aPTT and platelets, and that someone stay with her. Can you come to the bedside?'
  },

  criticalErrors: [
    'Ambulating or massaging the affected leg, which can dislodge more clot',
    'Leaving the patient alone during an acute deterioration',
    'Attributing sudden dyspnea and anxiety to postoperative pain or a panic attack',
    'Sending an unstable patient to CT angiography without monitoring or a nurse escort',
    'Starting heparin without an independent double check, baseline aPTT, and baseline platelets',
    'Failing to recognize that clear lung sounds do not rule out a pulmonary embolism',
    'Treating obstructive shock with fluid boluses alone instead of escalating for clot removal'
  ],

  debriefQuestions: [
    'Which elements of Virchow\'s triad did this patient have, and when could prophylaxis have been strengthened?',
    'Why is the PaO2 low when the lungs sound clear?',
    'What do the elevated troponin and BNP mean in a patient with a pulmonary embolism?',
    'She was already receiving prophylactic enoxaparin. What does that tell you about prophylaxis versus treatment dosing?',
    'What are the signs that she is moving from PE into obstructive shock?',
    'What safety checks are required before and during a heparin infusion?'
  ],

  pearls: [
    'Sudden onset dyspnea with pleuritic chest pain and clear lung sounds is pulmonary embolism until proven otherwise',
    'Virchow\'s triad - venous stasis, hypercoagulability, endothelial injury - all three are present after joint replacement',
    'The early PE ABG is respiratory alkalosis with hypoxemia; a rising CO2 means the patient is tiring',
    'D-dimer is sensitive but not specific; CT angiography confirms the diagnosis',
    'Troponin and BNP elevations in PE reflect right ventricular strain and predict a worse outcome',
    'Obstructive shock is a pump problem caused by a blockage - volume alone will not fix it',
    'Prophylactic enoxaparin 40 mg daily is not a treatment dose; treatment requires full anticoagulation, and protamine sulfate is the heparin antidote',
    'Best prevention is early ambulation, sequential compression devices, and adequate prophylaxis'
  ]
},

/* =========================== 6. SEPSIS =========================== */
{
  id: 'ms2lab-sepsis',
  course: 'NUR2212C',
  courseTitle: 'Medical-Surgical Nursing II - Simulation Lab',
  topic: 'Sepsis and Septic Shock',
  sourceTopic: 'Disseminated Intravascular Coagulation',
  sourceNote: 'SOURCE DEFECT: the packet is titled "TOPIC: Disseminated Intravascular Coagulation (Student)" but the entire body - introduction, required knowledge, activity instructions, case, orders, and labs - is sepsis and septic shock. There is no coagulation panel and no bleeding anywhere in the case. The topic line is a copy-paste error from the DIC packet; the topic is corrected to Sepsis and Septic Shock and the original title is preserved in sourceTopic. A separate DIC packet exists as ms2lab-dic. Second issue: the sepsis bundle calls for 30 mL/kg of crystalloid, which is about 2,220 mL for this 74 kg patient, but the MAR records only a 1 L bolus at 1015 - the student should recognize the under-resuscitation.',
  durationMin: 20,
  introduction: 'Sepsis is a life-threatening condition resulting from a dysregulated host response to infection that leads to organ dysfunction. Septic shock is a subset of sepsis characterized by persistent hypotension, impaired tissue perfusion, elevated lactate levels, and increased mortality despite adequate fluid resuscitation. This simulation allows ASN nursing students to recognize early manifestations of sepsis, identify progression toward septic shock, interpret laboratory findings, implement evidence-based interventions, communicate effectively using SBAR, and escalate care appropriately to prevent multi-organ dysfunction and death.',

  outcomes: [
    { n: 1, text: 'Correlate the integrative processes to the care of the client and family' },
    { n: 2, text: 'Demonstrate safe and effective care in the care of the client' },
    { n: 3, text: 'Relate health promotion and maintenance in the care of the client' },
    { n: 4, text: 'Relate components of psychosocial integrity in the care of the client' },
    { n: 5, text: 'Relate components of physiological integrity in the care of the client' },
    { n: 6, text: 'Demonstrate the competencies specific to entry-level professional nursing' }
  ],

  requiredKnowledge: [
    'Explain the pathophysiology of sepsis and septic shock.',
    'Recognize signs of systemic infection and organ dysfunction.',
    'Interpret CBC, CMP, lactate, blood culture, and renal function results.',
    'Identify manifestations of impaired tissue perfusion.',
    'Perform focused respiratory, cardiovascular, neurological, and renal assessments.',
    'Discuss evidence-based sepsis treatment and the sepsis bundle.',
    'Utilize SBAR communication.',
    'Recognize indications for Rapid Response Team activation.'
  ],

  activitySteps: [
    { n: 1, text: 'Receive and review patient chart.', critical: true, phase: 'prep',
      evidence: 'opened the chart and reviewed orders, MAR, labs, and the vital sign trend before entering the room',
      coachTip: 'The vitals at 0600, 0800, and 1000 are a straight line toward shock. Read the trend, not the last set.' },
    { n: 2, text: 'Verify patient identity using two identifiers.', critical: true, phase: 'prep',
      evidence: 'stated name and date of birth and compared them to the armband',
      coachTip: 'Two identifiers before anything else - name and date of birth, never room number. A confused patient cannot verify herself.' },
    { n: 3, text: 'Perform hand hygiene and apply standard precautions.', critical: true, phase: 'prep',
      evidence: 'performed hand hygiene on entry and applied the standard precautions listed in the chart',
      coachTip: 'Hand hygiene is scored every time. Isolation is charted as Standard here.' },
    { n: 4, text: 'Perform focused assessment.', critical: true, phase: 'assess',
      evidence: 'assessed mentation, lung sounds, heart rate and rhythm, skin temperature and color, capillary refill, and urine output',
      coachTip: 'New confusion in an older adult with infection is sepsis until proven otherwise. Mentation is a vital sign here.' },
    { n: 5, text: 'Review laboratory and diagnostic findings.', critical: true, phase: 'interpret',
      evidence: 'verbalized the WBC of 19.8, lactate 4.6, creatinine 2.0, BUN 38, and the gram-positive cocci on blood culture',
      coachTip: 'Lactate 4.6 plus creatinine 2.0 is organ dysfunction. That is what turns infection into sepsis by definition.' },
    { n: 6, text: 'Recognize manifestations of sepsis and septic shock.', critical: true, phase: 'interpret',
      evidence: 'named fever, tachycardia, tachypnea, leukocytosis, confusion, hypotension, and elevated lactate as sepsis criteria',
      coachTip: 'Warm flushed skin with hypotension is early distributive shock. Cold and clammy is late - do not wait for it.' },
    { n: 7, text: 'Prioritize interventions using ABCs.', critical: true, phase: 'intervene',
      evidence: 'addressed oxygenation first with the SpO2 at 90 percent, then circulation with the fluid bolus',
      coachTip: 'Oxygen up first, then volume. Both are already covered by standing orders - you do not need to call for permission.' },
    { n: 8, text: 'Implement provider orders.', critical: true, phase: 'intervene',
      evidence: 'titrated oxygen to keep SpO2 above 95 percent, took vital signs every 15 minutes, gave the antibiotics on time, checked bedside glucose, maintained strict I&O, and planned the repeat lactate in 4 hours',
      coachTip: 'Antibiotics are time-critical. Every hour of delay in septic shock measurably raises mortality - and cultures should be drawn before the dose when possible.' },
    { n: 9, text: 'Monitor oxygenation, perfusion, and urine output.', critical: true, phase: 'assess',
      evidence: 'tracked SpO2, MAP, capillary refill, mentation, and hourly urine output after the bolus',
      coachTip: 'Urine output under 0.5 mL/kg/hr - under about 37 mL/hr for this 74 kg patient - means the kidneys are not being perfused.' },
    { n: 10, text: 'Communicate findings using SBAR.', critical: true, phase: 'communicate',
      evidence: 'gave a structured SBAR naming the MAP, lactate, creatinine, and the fluid volume given, and requested further orders',
      coachTip: 'Report the MAP, not just the blood pressure. MAP is what the order threshold and the perfusion actually depend on.' },
    { n: 11, text: 'Escalate care appropriately.', critical: true, phase: 'escalate',
      evidence: 'notified the provider per the MAP order and activated rapid response for persistent hypotension after fluids',
      coachTip: 'The MAP at 1000 is about 69 - not yet under 65, but falling fast. Call on the trend, before you cross the line.' },
    { n: 12, text: 'Complete tasks within the 20-minute simulation time.', critical: false, phase: 'prep',
      evidence: 'finished assessment, interventions, SBAR, and escalation before the timer expired',
      coachTip: 'Budget roughly 5 minutes to assess, 5 to intervene, 5 to communicate, 5 to reassess.' }
  ],

  caseOverview: 'The current time is 1030 and you are assuming the care of Mrs. Jane Smith is a 72-year-old female admitted yesterday with community-acquired pneumonia. Over the last several hours she has experienced worsening symptoms. Laboratory findings reveal leukocytosis, elevated lactate, worsening kidney function, and evidence of systemic infection. The healthcare team is concerned that the patient is developing sepsis progressing toward septic shock. Students must recognize deterioration, initiate evidence-based interventions, communicate findings, and prevent progression to respiratory failure, multi-organ dysfunction, and cardiovascular collapse.',
  currentTime: '1030',

  initialAssessment: [
    { system: 'Neurological', findings: ['Confused', 'Lethargic', 'Difficult to focus'] },
    { system: 'Respiratory', findings: ['Tachypnea', 'Shortness of breath'] },
    { system: 'Cardiovascular', findings: ['Tachycardia', 'Warm skin'] }
  ],

  chart: {
    name: 'Jane Smith', age: '72 years', dob: '06/26/1954', sex: 'Female',
    heightRaw: '160 cm', heightCm: 160, weightKg: 74,
    allergies: ['No Known Drug Allergies'], codeStatus: 'Full Code',
    admittingDx: 'Pneumonia progressing to sepsis',
    admitDate: 'Yesterday', facility: 'Med/surg Unit', isolation: 'Standard', diet: 'Regular'
  },

  notes: [
    { at: 'Yesterday, 1800', text: 'Admitted to ED with pneumonia and SOB.' },
    { at: 'Yesterday, 2200', text: 'Stable overnight. Receiving oxygen at 2L NC.' },
    { at: 'Today, 0800', text: 'Patient c/o fatigue and dizziness. Increased confusion.' }
  ],

  providerOrders: [
    { text: 'Oxygen 2L Nasal Cannula to keep O2 > 95%', category: 'respiratory' },
    { text: 'Vital signs every 15 minutes', category: 'monitoring' },
    { text: 'Bedside blood glucose level before meals, at bedtime and as needed.', category: 'monitoring' },
    { text: 'Repeat lactate in 4 hours', category: 'lab' },
    { text: 'Acetaminophen 650 mg PO every 6 hours PRN for Fever', category: 'medication' },
    { text: 'Notify provider if MAP<65 mm Hg', category: 'monitoring' },
    { text: 'Strict intake and output', category: 'monitoring' },
    { text: 'Cefepime 2 g IV every 8 hours', category: 'medication' },
    { text: 'Vancomycin 1 g IV every 24 hours', category: 'medication' }
  ],

  mar: [
    { at: 'Today, 0800', text: 'Acetaminophen 650 mg PO' },
    { at: 'Today, 0900', text: '0.9% Sodium Chloride 125 mL/h' },
    { at: 'Today, 0900', text: 'Cefepime 2 g IV' },
    { at: 'Today, 1000', text: 'Vancomycin 1 g IV' },
    { at: 'Today, 1015', text: '0.9% Sodium Chloride 1 L Bolus' }
  ],

  labs: [
    { panel: 'CBC', name: 'WBC', value: '19.8', normalRange: '5-10', status: 'critical-high', interpretation: 'Marked leukocytosis consistent with an active systemic bacterial infection and meeting SIRS criteria.' },
    { panel: 'CBC', name: 'RBC', value: '4.1', normalRange: '4.2-5.4', status: 'low', interpretation: 'Mildly low - anemia of acute illness lowers oxygen delivery when tissue demand is already high.' },
    { panel: 'CBC', name: 'Hgb', value: '11.6', normalRange: '12-16', status: 'low', interpretation: 'Mild anemia, further reducing oxygen-carrying capacity in a hypoperfused patient.' },
    { panel: 'CBC', name: 'Hematocrit', value: '35%', normalRange: '37-47%', status: 'low', interpretation: 'Mildly low.' },
    { panel: 'CBC', name: 'Platelets', value: '175,000', normalRange: '150,000-400,000', status: 'normal', interpretation: 'Normal today, but a falling platelet count would be the first hint that sepsis is triggering DIC.' },
    { panel: 'BMP', name: 'Sodium', value: '132', normalRange: '135-145', status: 'low', interpretation: 'Mild hyponatremia of acute illness.' },
    { panel: 'BMP', name: 'Potassium', value: '4.9', normalRange: '3.5-5.0', status: 'normal', interpretation: 'High-normal. Worsening acute kidney injury and acidosis will push it higher.' },
    { panel: 'BMP', name: 'Chloride', value: '100', normalRange: '98-106', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'BUN', value: '38', normalRange: '10-20', status: 'high', interpretation: 'Elevated from hypoperfusion and catabolism.' },
    { panel: 'BMP', name: 'Creatinine', value: '2.0', normalRange: '0.6-1.2', status: 'critical-high', interpretation: 'Acute kidney injury from sepsis-related hypoperfusion. This is documented organ dysfunction and it changes vancomycin dosing.' },
    { panel: 'BMP', name: 'Glucose', value: '186', normalRange: '70-110', status: 'high', interpretation: 'Stress hyperglycemia, which is why bedside glucose checks are ordered.' },
    { panel: 'Perfusion Marker', name: 'Lactate', value: '4.6', normalRange: '0.5-2.0', status: 'critical-high', interpretation: 'Anaerobic metabolism from global hypoperfusion. A lactate above 4 with hypotension is septic shock physiology and a mortality predictor.' }
  ],

  vitals: [
    { at: 'Today, 0600', bp: '118/72', map: 87, hr: 94, rr: 18, temp: '100.8 F', spo2: 95, pain: '', loc: 'Baseline', flags: ['low-grade fever'] },
    { at: 'Today, 0800', bp: '108/66', map: 80, hr: 104, rr: 22, temp: '101.4 F', spo2: 95, pain: '', loc: 'Increased confusion', flags: ['fever', 'tachycardia', 'tachypnea', 'falling blood pressure'] },
    { at: 'Today, 1000', bp: '92/58', map: 69, hr: 118, rr: 26, temp: '102.2 F', spo2: 90, pain: '', loc: 'Confused, lethargic', flags: ['hypotension', 'tachycardia', 'tachypnea', 'high fever', 'hypoxemia', 'MAP approaching 65'] }
  ],

  diagnostics: [
    { name: 'Blood Cultures', finding: 'Gram-Positive Cocci (Final Sensitivity Pending)',
      interpretation: 'Confirms bacteremia and supports the broad-spectrum coverage already ordered. Vancomycin covers resistant gram-positive organisms; therapy will be narrowed once sensitivities return.' }
  ],

  expectedSbar: {
    situation: 'This is the nurse on the Med/Surg unit calling about Mrs. Jane Smith, a 72-year-old female admitted yesterday with community-acquired pneumonia. She is now hypotensive, confused, and hypoxemic and I believe she is progressing into septic shock.',
    background: 'She was admitted yesterday at 1800 and was stable overnight on 2 L nasal cannula. At 0800 she reported fatigue and dizziness with increased confusion. She has received acetaminophen at 0800, cefepime 2 g at 0900, vancomycin 1 g at 1000, maintenance saline at 125 mL/hr, and a 1 L normal saline bolus at 1015. She is Full Code, no known drug allergies, 74 kg.',
    assessment: 'Her vitals have trended down all morning. At 1000 her blood pressure is 92/58 with a MAP of 69, heart rate 118, respiratory rate 26, temperature 102.2 F, SpO2 90 percent. She is confused and lethargic with warm skin. WBC 19.8, lactate 4.6, creatinine 2.0 up from baseline, BUN 38, and blood cultures are growing gram-positive cocci.',
    recommendation: 'She has only received 1 L of the roughly 2.2 L that 30 mL/kg would require. I recommend completing the 30 mL/kg crystalloid resuscitation, a repeat lactate now rather than in four hours, an order for vasopressors if the MAP stays below 65 after fluids, review of the vancomycin dose against a creatinine of 2.0, hourly urine output, and evaluation for ICU transfer. Can you come to the bedside?'
  },

  criticalErrors: [
    'Failing to escalate when the MAP is falling toward 65 despite fluids',
    'Delaying or holding antibiotics for any reason once sepsis is recognized',
    'Interpreting warm, flushed skin as reassuring rather than as early distributive shock',
    'Attributing new confusion to age or hospital delirium instead of hypoperfusion',
    'Giving only a 1 L bolus to a 74 kg patient when the bundle calls for about 2.2 L',
    'Treating the fever aggressively while ignoring the perfusion problem',
    'Administering the scheduled vancomycin without questioning the dose against a creatinine of 2.0'
  ],

  debriefQuestions: [
    'What was the earliest sign this patient was septic, and at what time did it appear?',
    'What does a lactate of 4.6 tell you that the blood pressure does not?',
    'Calculate the 30 mL/kg fluid resuscitation for a 74 kg patient. How much has she actually received?',
    'Why is a MAP of 65 the threshold rather than a systolic pressure?',
    'What are the components of the hour-1 sepsis bundle, and which ones were completed here?',
    'What would tell you she has moved from sepsis into septic shock?'
  ],

  pearls: [
    'Sepsis is infection plus organ dysfunction; septic shock adds persistent hypotension and a lactate above 2 despite adequate fluids',
    'Lactate above 4 is a mortality predictor, not just a perfusion marker',
    'The hour-1 bundle: measure lactate, draw blood cultures BEFORE antibiotics, give broad-spectrum antibiotics, give 30 mL/kg crystalloid for hypotension or lactate 4 or more, and start vasopressors for MAP under 65',
    'MAP under 65 mmHg means organs are not being perfused, whatever the systolic number looks like',
    'New confusion in an older adult with infection is often the very first sign of sepsis',
    'Early septic shock is warm and flushed from vasodilation; cold and clammy is a late, ominous finding',
    'Urine output under 0.5 mL/kg/hr is early renal hypoperfusion and one of the cheapest monitors available'
  ]
},

/* ========================= 7. GI BLEED ========================= */
{
  id: 'ms2lab-gi-bleed',
  course: 'NUR2212',
  courseTitle: 'Medical-Surgical Nursing II Simulation Lab',
  topic: 'Upper Gastrointestinal Bleed',
  sourceTopic: '',
  sourceNote: 'This packet prints the course code as NUR2212 (no C) and labels its opening section "Purpose" rather than "Introduction"; that text is used as the introduction. SOURCE DEFECT: the Required Prior Knowledge list contains two headings - "Laboratory Interpretation" and "Pharmacology" - with no items under them; those gaps are preserved and flagged rather than filled in. The Physician Orders cell duplicates a phrase, printing "Pantoprazole 80 mg IV Bolus then Pantoprazole 80 mg IV Bolus then continuous infusion at 8 mg/hr"; the duplication is a transcription artifact and is collapsed to a single bolus followed by the infusion. This packet also prints different reference ranges than the others for RBC (4.5-5.5), PT (11-13.5 sec), and INR (0.8-1.1); the printed values are kept as-is. The activity instructions do not include chart review, identity verification, or hand hygiene as numbered steps.',
  durationMin: 20,
  introduction: 'This simulation is designed to provide students with the opportunity to care for a patient experiencing an acute upper gastrointestinal (GI) hemorrhage with progression toward hypovolemic shock. Students will develop skills in focused assessment, recognition of patient deterioration, airway protection, clinical judgment, prioritization of nursing interventions, communication, and safe patient-centered care. The simulation emphasizes early recognition of GI bleeding, rapid hemodynamic stabilization, preparation for blood transfusion, and collaboration with the healthcare team to prevent cardiovascular collapse.',

  outcomes: [
    { n: 1, text: 'Explain the integrated process in the care of the client' },
    { n: 2, text: 'Demonstrate safe and effective care in the care of the client' },
    { n: 3, text: 'Relate health promotion and maintenance in the care of the client' },
    { n: 4, text: 'Relate components of psychosocial integrity in the care of the client' },
    { n: 5, text: 'Relate components of physiological integrity in the care of the client' },
    { n: 6, text: 'Demonstrate the competencies specific to entry level professional nursing' }
  ],

  requiredKnowledge: [
    'Pathophysiology: Explain the causes and pathophysiology of upper gastrointestinal bleeding.',
    'Pathophysiology: Differentiate upper GI bleeding from lower GI bleeding.',
    'Pathophysiology: Describe the effects of acute blood loss on tissue perfusion and oxygenation.',
    'Pathophysiology: Explain the progression from hemorrhage to hypovolemic shock.',
    'Assessment: Recognize manifestations of upper GI bleeding: Hematemesis; Coffee-ground emesis; Melena; Epigastric pain; Dizziness; Syncope.',
    'Assessment: Identify signs of hypovolemia: Tachycardia; Hypotension; Decreased urine output; Delayed capillary refill; Cool, clammy skin; Altered mental status.',
    'Laboratory Interpretation: (heading printed in the packet with no items listed)',
    'Pharmacology: (heading printed in the packet with no items listed)',
    'Nursing Concepts: Blood transfusion administration and monitoring',
    'Nursing Concepts: Airway protection during active vomiting',
    'Nursing Concepts: Shock management',
    'Nursing Concepts: Fluid resuscitation',
    'Nursing Concepts: Oxygen therapy',
    'Nursing Concepts: SBAR communication',
    'Nursing Concepts: Prioritization using ABCs and clinical judgment'
  ],

  activitySteps: [
    { n: 1, text: 'Perform an immediate focused assessment.', critical: true, phase: 'assess',
      evidence: 'assessed airway and level of consciousness, skin color and temperature, capillary refill, pulses, abdomen, and the character and volume of emesis',
      coachTip: 'With active hematemesis, airway comes before everything. Turn the head to the side, have suction on and working, and keep her sitting up.' },
    { n: 2, text: 'Identify signs of active bleeding and hypovolemia.', critical: true, phase: 'interpret',
      evidence: 'named bright red hematemesis, melena, pallor, diaphoresis, cool extremities, tachycardia, and the falling blood pressure',
      coachTip: 'Heart rate rises before blood pressure falls. A heart rate of 104 with a pressure of 108/68 is compensated shock, not stability.' },
    { n: 3, text: 'Prioritize interventions using ABCs.', critical: true, phase: 'intervene',
      evidence: 'protected the airway with suction and positioning, applied oxygen, and established or verified large-bore IV access before other tasks',
      coachTip: 'Two large-bore IVs - 18 gauge or larger. You cannot resuscitate a hemorrhage through a 22 in the hand.' },
    { n: 4, text: 'Implement provider orders appropriately.', critical: true, phase: 'intervene',
      evidence: 'kept the patient NPO, ran the 1,000 mL normal saline bolus, maintained continuous pulse oximetry and SpO2 above 95 percent, took vital signs every 15 minutes, gave pantoprazole and ondansetron, and started strict I&O',
      coachTip: 'NPO means NPO - no ice chips, no sips of water. She may go to endoscopy or the OR at any moment.' },
    { n: 5, text: 'Monitor for signs of deterioration.', critical: true, phase: 'assess',
      evidence: 'reassessed vital signs, mentation, urine output, and the volume of ongoing bleeding after each intervention',
      coachTip: 'Reassess after every bolus. Vital signs every 15 minutes exists so you catch the second bleed, not just the first.' },
    { n: 6, text: 'Communicate significant findings using SBAR.', critical: true, phase: 'communicate',
      evidence: 'gave a structured SBAR naming the hemoglobin of 6.8, the hematocrit of 21 percent, the active hematemesis, and the vital sign trend',
      coachTip: 'Lead with the hemoglobin of 6.8 and the words "active bright red hematemesis." Those two facts move the whole team.' },
    { n: 7, text: 'Safely administer blood products according to facility policy.', critical: true, phase: 'intervene',
      evidence: 'completed two-nurse verification against the blood bank tag and armband, used a filtered blood administration set primed with 0.9 percent sodium chloride, took a baseline set of vital signs, stayed for the first 15 minutes, and rechecked vital signs',
      coachTip: 'Only 0.9 percent sodium chloride touches blood. Stay for the first 15 minutes - that is when a reaction shows itself.' },
    { n: 8, text: 'Provide patient and family education.', critical: false, phase: 'communicate',
      evidence: 'explained the transfusion, the NPO status, the reason for frequent vital signs, and what to report immediately',
      coachTip: 'Teach her to report itching, chills, back pain, or shortness of breath during the transfusion. The patient is your best reaction monitor.' },
    { n: 9, text: 'Collaborate with the healthcare team.', critical: true, phase: 'escalate',
      evidence: 'notified the provider per the order for hypotension, tachycardia, or worsening bleeding and coordinated with the blood bank and GI for endoscopy',
      coachTip: 'The order tells you exactly when to call. When you meet a notify parameter, that is not a judgement call.' },
    { n: 10, text: 'Document assessments, interventions, and patient responses.', critical: false, phase: 'communicate',
      evidence: 'documented the emesis volume and character, vital signs, fluids and products given, and the response to each',
      coachTip: 'Quantify the blood loss. "Large amount" is not data - 400 mL of bright red emesis is.' }
  ],

  caseOverview: 'The current time is 1100 and you are the nurse assuming care of Mr. John Smith, a 72-year-old patient admitted with a history of peptic ulcer disease, osteoarthritis and chronic NSAID use. Earlier today, the patient reported epigastric pain, nausea, dizziness, and dark tarry stools. Over the last hour, the patient has become increasingly pale, weak, and diaphoretic. During assessment, the patient experiences a sudden episode of bright red hematemesis. Vital signs demonstrate tachycardia and a downward trend in blood pressure. The healthcare team is concerned that the patient is experiencing a massive upper GI hemorrhage with progression toward hypovolemic shock. Early recognition and intervention are critical because delayed treatment can lead to organ dysfunction, cardiovascular collapse, and death.',
  currentTime: '1100',

  initialAssessment: [
    { system: 'General Appearance', findings: ['Alert', 'Pale and diaphoretic', 'Appears weak and fatigued', 'Active hematemesis'] },
    { system: 'Circulation', findings: ['Cool extremities', 'S1S2 audible'] },
    { system: 'Gastrointestinal', findings: ['Bright red hematemesis present', 'History of melena', 'Nausea'] }
  ],

  chart: {
    name: 'John Smith', age: '72 years', dob: '06/26/1954', sex: 'Male',
    heightRaw: '69 inch', heightCm: 175, weightKg: 88,
    allergies: ['No Known Drug Allergies'], codeStatus: 'Full Code',
    admittingDx: 'Acute Upper GI Bleed',
    admitDate: 'Today', facility: 'Med/surg Unit', isolation: 'none', diet: 'NPO'
  },

  notes: [
    { at: 'Today, 0600', text: 'Complaint of dizziness' },
    { at: 'Today, 0800', text: 'Epigastric pain worsening' },
    { at: 'Today, 1000', text: 'Active hematemesis begins' }
  ],

  providerOrders: [
    { text: 'Continuous pulse oximetry', category: 'monitoring' },
    { text: 'Vital signs every 15 minutes', category: 'monitoring' },
    { text: 'Maintain SpO2 >95%', category: 'respiratory' },
    { text: 'NPO', category: 'diet' },
    { text: 'Normal Saline 1000mL Bolus IV', category: 'access' },
    { text: 'Transfuse PRBCs', category: 'procedure' },
    { text: 'Strict intake and output', category: 'monitoring' },
    { text: 'Notify provider for hypotension, tachycardia, or worsening bleeding', category: 'monitoring' },
    { text: 'Pantoprazole 80 mg IV Bolus then continuous infusion at 8 mg/hr', category: 'medication' },
    { text: 'Ondansetron 4 mg IV every 6 hours PRN for nausea', category: 'medication' }
  ],

  mar: [
    { at: 'Today, 1000', text: '0.9% Sodium Chloride 1L Bolus' },
    { at: 'Today, 1015', text: 'Pantoprazole (Protonix) 80 mg IV' },
    { at: 'Today, 1030', text: 'PRBC Transfusion Initiated' },
    { at: 'Today, 1030', text: 'Ondansetron 4 mg IV' }
  ],

  labs: [
    { panel: 'CBC', name: 'WBC', value: '9.8', normalRange: '5-10', status: 'normal', interpretation: 'Normal - this is blood loss, not infection.' },
    { panel: 'CBC', name: 'RBC', value: '3.2', normalRange: '4.5-5.5', status: 'critical-low', interpretation: 'Markedly reduced red cell mass from acute hemorrhage.' },
    { panel: 'CBC', name: 'HGB', value: '6.8', normalRange: '12-16', status: 'critical-low', interpretation: 'Critically low. Below 7 g/dL is the usual transfusion threshold, and with active bleeding this value understates the true loss because equilibration lags.' },
    { panel: 'CBC', name: 'Hematocrit', value: '21%', normalRange: '37-47%', status: 'critical-low', interpretation: 'Roughly three times the hemoglobin, as expected. Confirms significant volume of blood lost.' },
    { panel: 'CBC', name: 'Platelets', value: '280,000', normalRange: '150,000-400,000', status: 'normal', interpretation: 'Normal - his clotting cells are adequate; the problem is a bleeding lesion, not a platelet defect.' },
    { panel: 'BMP', name: 'Sodium', value: '138', normalRange: '135-145', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'Potassium', value: '4.2', normalRange: '3.5-5.0', status: 'normal', interpretation: 'Normal. Watch it during transfusion, since stored blood releases potassium.' },
    { panel: 'BMP', name: 'Chloride', value: '104', normalRange: '98-106', status: 'normal', interpretation: 'Normal.' },
    { panel: 'BMP', name: 'Calcium', value: '9.8', normalRange: '9-10.5', status: 'normal', interpretation: 'Normal baseline. Citrate in banked blood binds calcium, so recheck after multiple units.' },
    { panel: 'BMP', name: 'BUN', value: '34', normalRange: '10-20', status: 'high', interpretation: 'Elevated out of proportion to the creatinine - the classic sign of an UPPER GI bleed, because digested blood protein is absorbed and metabolized to urea.' },
    { panel: 'BMP', name: 'Creatinine', value: '1.3', normalRange: '0.6-1.2', status: 'high', interpretation: 'Mildly elevated from reduced renal perfusion.' },
    { panel: 'BMP', name: 'Glucose', value: '112', normalRange: '70-110', status: 'high', interpretation: 'Barely elevated - a stress response.' },
    { panel: 'Coagulation Studies', name: 'PT', value: '15 sec', normalRange: '11-13.5 sec', status: 'high', interpretation: 'Mildly prolonged, likely dilutional from resuscitation. Not a primary coagulopathy.' },
    { panel: 'Coagulation Studies', name: 'INR', value: '1.3', normalRange: '0.8-1.1', status: 'high', interpretation: 'Mildly elevated. Watch it if he receives multiple units without plasma.' },
    { panel: 'Coagulation Studies', name: 'aPTT', value: '34 sec', normalRange: '25-35 sec', status: 'normal', interpretation: 'Normal - the intrinsic pathway is intact.' },
    { panel: 'Type and Crossmatch', name: 'Blood Type', value: 'O Positive', normalRange: '', status: 'normal', interpretation: 'Crossmatch complete. Verify the unit against the blood bank tag and armband with a second nurse before hanging.' },
    { panel: 'Type and Crossmatch', name: 'PRBCs', value: 'Available', normalRange: '', status: 'normal', interpretation: 'Product is ready in the blood bank - no delay should occur in starting the transfusion.' }
  ],

  vitals: [
    { at: 'Today, 0600', bp: '118/76', map: 90, hr: 88, rr: 18, temp: '99.4 F', spo2: 98, pain: 'Epigastric pain', loc: 'Alert', flags: [] },
    { at: 'Today, 1000', bp: '108/68', map: 81, hr: 104, rr: 22, temp: '98.4', spo2: 94, pain: 'Epigastric pain', loc: 'Alert, pale, diaphoretic', flags: ['tachycardia', 'falling blood pressure', 'compensated hypovolemic shock'] }
  ],

  diagnostics: [],

  expectedSbar: {
    situation: 'This is the nurse on the Med/Surg unit calling about Mr. John Smith, a 72-year-old male admitted today with an acute upper GI bleed. He has just had an episode of bright red hematemesis and his hemoglobin is 6.8.',
    background: 'He has a history of peptic ulcer disease, osteoarthritis, and chronic NSAID use. He reported dizziness at 0600, worsening epigastric pain at 0800, and active hematemesis beginning at 1000. He received a 1 L normal saline bolus at 1000, pantoprazole 80 mg IV at 1015, ondansetron 4 mg IV at 1030, and a PRBC transfusion was initiated at 1030. He is NPO, Full Code, no known drug allergies, 88 kg, blood type O positive.',
    assessment: 'At 1000 his blood pressure was 108/68 with a MAP of 81, down from 118/76, heart rate 104 up from 88, respiratory rate 22, SpO2 94 percent. He is pale, diaphoretic, and cool to touch. Hemoglobin is 6.8, hematocrit 21 percent, BUN 34 with a creatinine of 1.3, INR 1.3. He has ongoing bright red hematemesis.',
    recommendation: 'I have him NPO, upright with suction at the bedside, oxygen on, two large-bore IVs, and the first unit running. I recommend urgent GI consultation for endoscopy, additional units crossmatched, a repeat CBC after transfusion, a Foley for accurate output, and consideration of ICU transfer. Can you come now?'
  },

  criticalErrors: [
    'Laying the patient flat during active vomiting, risking aspiration',
    'Not having working suction set up and immediately available at the bedside',
    'Giving anything by mouth to a patient who is NPO and may need urgent endoscopy',
    'Attempting resuscitation through small-gauge peripheral access instead of two large-bore IVs',
    'Hanging blood with any solution other than 0.9 percent sodium chloride or without a filtered administration set',
    'Skipping two-nurse verification or leaving the bedside during the first 15 minutes of the transfusion',
    'Interpreting a blood pressure of 108/68 as stable while the heart rate is climbing'
  ],

  debriefQuestions: [
    'How did chronic NSAID use set up this bleed, and what would you teach him at discharge?',
    'Why is the BUN elevated when the creatinine is nearly normal?',
    'What are the earliest signs of hypovolemic shock, and which one appeared first in this patient?',
    'Walk through every safety step for hanging a unit of packed red blood cells.',
    'What are the signs of an acute hemolytic transfusion reaction, and what is your first action?',
    'How would your priorities change if he suddenly became unresponsive during hematemesis?'
  ],

  pearls: [
    'Hematemesis and melena point to an UPPER GI source; bright red rectal bleeding points to a lower source',
    'An elevated BUN with a normal or near-normal creatinine is the hallmark of an upper GI bleed - digested blood is absorbed protein',
    'Hemoglobin lags behind acute blood loss; a value of 6.8 during active bleeding understates the true deficit',
    'Tachycardia is the earliest sign of hypovolemia; hypotension is late and means compensation has failed',
    'Airway first during active vomiting - upright position, head turned, suction on and tested',
    'Blood is administered only with 0.9 percent sodium chloride through a filtered set, with two-nurse verification and vital signs before, at 15 minutes, and after',
    'Stay with the patient for the first 15 minutes of a transfusion; most severe reactions occur then',
    'Proton pump inhibitors raise gastric pH to stabilize clot; the definitive treatment is endoscopic hemostasis'
  ]
},

/* ====================== 8. ACUTE LIVER FAILURE ====================== */
{
  id: 'ms2lab-liver-failure',
  course: 'NUR2212C',
  courseTitle: 'Medical-Surgical Nursing II - Simulation Lab',
  topic: 'Acute Liver Failure with Hepatic Encephalopathy',
  sourceTopic: '',
  sourceNote: 'The chart prints the diet as "Low fat, low protien"; the typo is kept verbatim. The case begins at 1530 but the latest charted vital signs are from 1000, so the student must recognize that the most recent data set is five and a half hours old and obtain a current one. No diagnostics or imaging section is printed even though the required knowledge asks about cerebral edema. Note also that the packet lists a GFR of 18 with the same figure used in the ARDS packet.',
  durationMin: 20,
  introduction: 'Acute Liver Failure (ALF) is a life-threatening condition characterized by rapid loss of liver function resulting in impaired detoxification, coagulopathy, metabolic disturbances, and hepatic encephalopathy. Elevated ammonia levels and accumulation of toxic substances can lead to altered mental status, cerebral edema, multi-organ dysfunction, and death. This simulation allows ASN nursing students to recognize manifestations of acute liver failure, identify worsening hepatic encephalopathy, interpret laboratory findings, implement evidence-based nursing interventions, communicate effectively using SBAR, and escalate care appropriately.',

  outcomes: [
    { n: 1, text: 'Correlate the integrative processes to the care of the client and family' },
    { n: 2, text: 'Demonstrate safe and effective care in the care of the client' },
    { n: 3, text: 'Relate health promotion and maintenance in the care of the client' },
    { n: 4, text: 'Relate components of psychosocial integrity in the care of the client' },
    { n: 5, text: 'Relate components of physiological integrity in the care of the client' },
    { n: 6, text: 'Demonstrate the competencies specific to entry level professional nursing' }
  ],

  requiredKnowledge: [
    'Describe the pathophysiology of acute liver failure.',
    'Discuss causes of hepatic encephalopathy.',
    'Recognize manifestations of liver dysfunction and neurological deterioration.',
    'Interpret liver function studies and coagulation studies.',
    'Interpret ammonia levels and their relationship to encephalopathy.',
    'Perform focused gastrointestinal and neurological assessments.',
    'Recognize signs of cerebral edema and increased intracranial pressure.',
    'Implement seizure and fall precautions.',
    'Utilize SBAR communication.',
    'Recognize indications for Rapid Response Team activation and ICU transfer.'
  ],

  activitySteps: [
    { n: 1, text: 'Receive and review patient chart.', critical: true, phase: 'prep',
      evidence: 'opened the chart and reviewed orders, MAR, liver and coagulation studies, and the progress notes',
      coachTip: 'The last vital signs are from 1000 and it is now 1530. Notice the gap - that alone should send you to the bedside for a fresh set.' },
    { n: 2, text: 'Verify patient identity using two identifiers.', critical: true, phase: 'prep',
      evidence: 'stated name and date of birth and compared them to the armband',
      coachTip: 'Two identifiers before anything else - name and date of birth, never room number. An encephalopathic patient cannot verify herself reliably.' },
    { n: 3, text: 'Perform hand hygiene and apply standard precautions.', critical: true, phase: 'prep',
      evidence: 'performed hand hygiene on entry and donned gloves before contact',
      coachTip: 'Hand hygiene every time. This patient is coagulopathic and immunocompromised by liver failure - infection would be another organ hit.' },
    { n: 4, text: 'Perform focused neurological and gastrointestinal assessment.', critical: true, phase: 'assess',
      evidence: 'assessed level of consciousness and orientation, checked for asterixis, assessed pupils, and examined the abdomen for distention, ascites, and tenderness plus skin and sclera for jaundice',
      coachTip: 'Ask her to hold her hands up like she is stopping traffic. That flap - asterixis - is the bedside sign of rising ammonia.' },
    { n: 5, text: 'Review laboratory and diagnostic findings.', critical: true, phase: 'interpret',
      evidence: 'verbalized the ammonia of 118, AST 2,850, ALT 3,200, bilirubin 8.4, albumin 2.8, INR 2.8, platelets 88,000, glucose 78, and GFR 18',
      coachTip: 'The INR of 2.8 is not a bleeding order gone wrong - it is the liver failing to make clotting factors. It is the best marker of how sick this liver is.' },
    { n: 6, text: 'Recognize manifestations of acute liver failure.', critical: true, phase: 'interpret',
      evidence: 'named jaundice, coagulopathy, hypoglycemia risk, encephalopathy, and rising ammonia as a picture of failing hepatic function',
      coachTip: 'Four jobs the liver stops doing: detoxifying ammonia, making clotting factors, making albumin, and storing glucose. Every finding here maps to one of them.' },
    { n: 7, text: 'Identify signs of worsening hepatic encephalopathy.', critical: true, phase: 'interpret',
      evidence: 'compared the current mental status to the earlier notes and identified progression from confusion to lethargy and delayed responses',
      coachTip: 'Encephalopathy is graded by mentation, and it moves in one direction fast. Grade it every check so you can prove the change.' },
    { n: 8, text: 'Prioritize interventions using ABCs and neurological assessment.', critical: true, phase: 'intervene',
      evidence: 'assessed airway protection and gag reflex given the vomiting and lethargy, then addressed neurological safety',
      coachTip: 'A lethargic patient who is vomiting is an aspiration waiting to happen. Airway first, positioning second, everything else third.' },
    { n: 9, text: 'Implement provider orders.', critical: true, phase: 'intervene',
      evidence: 'performed hourly neuro checks, maintained fall and seizure precautions, gave lactulose and the N-acetylcysteine infusion, maintained continuous cardiac monitoring, strict I&O, and daily weight',
      coachTip: 'Lactulose is titrated to two or three soft stools a day. If she is not stooling, the ammonia is not leaving, and holding it because it is inconvenient is a real error.' },
    { n: 10, text: 'Monitor for bleeding and neurological deterioration.', critical: true, phase: 'assess',
      evidence: 'inspected gums, IV sites, stool, and skin for bleeding or bruising and repeated the neuro check',
      coachTip: 'INR 2.8 with platelets of 88,000 means bleeding precautions: soft toothbrush, electric razor, no IM injections, hold pressure longer.' },
    { n: 11, text: 'Communicate findings using SBAR.', critical: true, phase: 'communicate',
      evidence: 'gave a structured SBAR naming the ammonia of 118, the INR of 2.8, the mental status change, and requested ICU evaluation',
      coachTip: 'Pair the ammonia with the mental status in one sentence. Numbers plus the clinical picture is what gets you a transfer.' },
    { n: 12, text: 'Escalate care appropriately.', critical: true, phase: 'escalate',
      evidence: 'activated the Rapid Response Team or notified the provider for the worsening neurological status per the standing order',
      coachTip: 'There is a standing order to notify for worsening neurological status. Deteriorating mentation in acute liver failure is a transplant-center conversation.' },
    { n: 13, text: 'Complete tasks within 20-minute simulation time.', critical: false, phase: 'prep',
      evidence: 'finished assessment, interventions, SBAR, and escalation before the timer expired',
      coachTip: 'Budget roughly 5 minutes to assess, 5 to intervene, 5 to communicate, 5 to reassess.' }
  ],

  caseOverview: 'It is currently 1530, and you are the nurse assuming care of Mrs. Jane Smith, a 72-year-old female admitted through the Emergency Department with acute liver failure suspected to be secondary to acetaminophen toxicity. Over the past several days she has experienced nausea, vomiting, abdominal pain, jaundice, fatigue, and worsening confusion. Family members report increasing forgetfulness, excessive sleepiness, and difficulty arousing her. Students must recognize manifestations of acute liver failure, identify worsening hepatic encephalopathy, intervene appropriately, and prevent complications including death.',
  currentTime: '1530',

  initialAssessment: [
    { system: 'Neurological', findings: ['Lethargic', 'Delayed responses', 'Asterixis present'] },
    { system: 'Gastrointestinal', findings: ['Nausea and vomiting'] },
    { system: 'Cardiovascular', findings: ['Sinus tachycardia'] }
  ],

  chart: {
    name: 'Jane Smith', age: '72 years', dob: '06/26/1954', sex: 'Female',
    heightRaw: '175 cm', heightCm: 175, weightKg: 88,
    allergies: ['No Known Drug Allergies'], codeStatus: 'Full Code',
    admittingDx: 'Acute liver failure with hepatic encephalopathy',
    admitDate: 'Yesterday', facility: 'Med/surg Unit', isolation: 'none', diet: 'Low fat, low protien'
  },

  notes: [
    { at: 'Yesterday, 2200', text: 'Nausea, vomiting, and abdominal pain. Family reports increasing confusion.' },
    { at: 'Today, 0600', text: 'Jaundice observed with increasing lethargy.' },
    { at: 'Today, 0922', text: 'Difficulty answering questions. Fall precautions initiated' }
  ],

  providerOrders: [
    { text: 'Neuro checks every hour', category: 'monitoring' },
    { text: 'Fall Precautions', category: 'procedure' },
    { text: 'Seizure precautions', category: 'procedure' },
    { text: 'Continuous cardiac monitoring', category: 'monitoring' },
    { text: 'Strict intake and output', category: 'monitoring' },
    { text: 'N-Acetylcysteine 4.4 g IV in 250 mL D5W over 1 hour', category: 'medication' },
    { text: 'Lactulose 30 mL PO every 6 hours', category: 'medication' },
    { text: 'Daily Weight', category: 'monitoring' },
    { text: 'Notify provider for worsening neurological status', category: 'monitoring' }
  ],

  mar: [
    { at: 'Today, 0900', text: 'Lactulose 30 mL PO' },
    { at: 'Today, 0930', text: 'N-Acetylcysteine Bolus' },
    { at: 'Today, 1000', text: '0.9% Sodium Chloride 100 mL/H' },
    { at: 'Today, 1200', text: 'Lactulose 30 mL PO' },
    { at: 'Today, 1500', text: 'N-Acetylcysteine 4.4 g IV in 250 mL D5W' }
  ],

  labs: [
    { panel: 'CBC', name: 'WBC', value: '13.2', normalRange: '5-10', status: 'high', interpretation: 'Leukocytosis from hepatic inflammation and necrosis; also raises the question of infection, which is a common trigger for worsening encephalopathy.' },
    { panel: 'CBC', name: 'RBC', value: '4.3', normalRange: '4.2-5.4', status: 'normal', interpretation: 'Normal - no active bleeding yet despite the coagulopathy.' },
    { panel: 'CBC', name: 'Hgb', value: '13.8', normalRange: '12-16', status: 'normal', interpretation: 'Normal. Follow it closely, because a coagulopathic patient can bleed quickly.' },
    { panel: 'CBC', name: 'Hematocrit', value: '41%', normalRange: '37-47%', status: 'normal', interpretation: 'Normal.' },
    { panel: 'CBC', name: 'Platelets', value: '88,000', normalRange: '150,000-400,000', status: 'low', interpretation: 'Thrombocytopenia from splenic sequestration and reduced thrombopoietin production. Combined with the INR of 2.8 this is a real bleeding risk.' },
    { panel: 'BMP', name: 'Sodium', value: '136', normalRange: '135-145', status: 'normal', interpretation: 'Normal. Avoid dropping it - hyponatremia worsens cerebral edema.' },
    { panel: 'BMP', name: 'Potassium', value: '4.8', normalRange: '3.5-5.0', status: 'normal', interpretation: 'High-normal now, but lactulose-induced diarrhea will pull it down. Recheck.' },
    { panel: 'BMP', name: 'BUN', value: '24', normalRange: '10-20', status: 'high', interpretation: 'Mildly elevated with the creatinine - early hepatorenal involvement.' },
    { panel: 'BMP', name: 'Creatinine', value: '1.4', normalRange: '0.6-1.2', status: 'high', interpretation: 'Elevated. In acute liver failure, rising creatinine raises concern for hepatorenal syndrome and worsens the prognosis.' },
    { panel: 'BMP', name: 'Glucose', value: '78', normalRange: '70-110', status: 'normal', interpretation: 'Low-normal and the value to watch. A failing liver cannot mobilize glycogen, so hypoglycemia can develop abruptly and mimic worsening encephalopathy.' },
    { panel: 'BMP', name: 'AST', value: '2,850', normalRange: '10-40', status: 'critical-high', interpretation: 'Massive hepatocellular necrosis. Values in the thousands are typical of acetaminophen toxicity.' },
    { panel: 'BMP', name: 'ALT', value: '3,200', normalRange: '7-56', status: 'critical-high', interpretation: 'Markedly elevated and more liver-specific than AST. Confirms severe acute hepatocellular injury.' },
    { panel: 'BMP', name: 'Total Bilirubin', value: '8.4', normalRange: '0.2-1.2', status: 'critical-high', interpretation: 'The liver cannot conjugate and excrete bilirubin - this is the jaundice and the pruritus.' },
    { panel: 'BMP', name: 'Albumin', value: '2.8', normalRange: '3.5-5.0', status: 'low', interpretation: 'Low synthetic function. Reduced oncotic pressure contributes to edema and ascites and alters protein-bound drug levels.' },
    { panel: 'BMP', name: 'Ammonia', value: '118', normalRange: '15-45', status: 'critical-high', interpretation: 'The liver is not converting ammonia to urea. This correlates with the encephalopathy and is the direct target of lactulose therapy.' },
    { panel: 'Coagulation Panel', name: 'PT', value: '28 sec', normalRange: '11-13 sec', status: 'critical-high', interpretation: 'Markedly prolonged from failure to synthesize vitamin K-dependent clotting factors.' },
    { panel: 'Coagulation Panel', name: 'INR', value: '2.8', normalRange: '0.8-1.2', status: 'critical-high', interpretation: 'Severe coagulopathy in a patient on no anticoagulant. INR is the single best marker of hepatic synthetic function and of prognosis in acute liver failure.' },
    { panel: 'Perfusion Marker', name: 'GFR', value: '18', normalRange: '>90', status: 'critical-low', interpretation: 'Severely reduced clearance. Concerning for hepatorenal syndrome and it changes drug dosing.' }
  ],

  vitals: [
    { at: 'Today, 0800', bp: '118/72', map: 87, hr: 94, rr: 15, temp: '98.8 F', spo2: 96, pain: 'Abdominal pain', loc: 'Lethargic', flags: [] },
    { at: 'Today, 1000', bp: '106/62', map: 77, hr: 112, rr: 24, temp: '100.0 F', spo2: 96, pain: 'Abdominal pain', loc: 'Lethargic, delayed responses', flags: ['tachycardia', 'tachypnea', 'falling blood pressure', 'new low-grade fever'] }
  ],

  diagnostics: [],

  expectedSbar: {
    situation: 'This is the nurse on the Med/Surg unit calling about Mrs. Jane Smith, a 72-year-old female admitted yesterday with acute liver failure from suspected acetaminophen toxicity. Her mental status is deteriorating and I am concerned about worsening hepatic encephalopathy and cerebral edema.',
    background: 'She came in with several days of nausea, vomiting, abdominal pain, jaundice, and confusion. Jaundice and increasing lethargy were noted at 0600 and difficulty answering questions at 0922, when fall precautions were started. She has received lactulose 30 mL at 0900 and 1200, an N-acetylcysteine bolus at 0930 with the 4.4 g infusion at 1500, and saline at 100 mL/hr. She is Full Code, no known drug allergies, 88 kg.',
    assessment: 'Her last vital signs at 1000 were 106/62 with a MAP of 77, heart rate 112, respiratory rate 24, temperature 100.0 F, SpO2 96 percent, and I am obtaining a current set now. She is lethargic with delayed responses and asterixis. Ammonia is 118, AST 2,850, ALT 3,200, total bilirubin 8.4, albumin 2.8, INR 2.8, PT 28 seconds, platelets 88,000, glucose 78, creatinine 1.4, GFR 18.',
    recommendation: 'Fall and seizure precautions are in place and I am doing hourly neuro checks. I recommend ICU transfer and transplant center evaluation, a repeat ammonia and coagulation panel, an order for bedside glucose checks given the glucose of 78, vitamin K, consideration of increasing the lactulose to titrate to two or three soft stools daily, and review of all renally cleared medications with a GFR of 18. Can you come to the bedside?'
  },

  criticalErrors: [
    'Holding lactulose because of diarrhea or inconvenience - the stools are the therapy',
    'Administering additional acetaminophen or any hepatotoxic or sedating medication',
    'Failing to implement or maintain fall and seizure precautions in a lethargic, coagulopathic patient',
    'Missing hypoglycemia as a cause of the altered mental status',
    'Performing IM injections or unnecessary venipunctures with an INR of 2.8 and platelets of 88,000',
    'Accepting five-and-a-half-hour-old vital signs at 1530 instead of obtaining a current set',
    'Failing to escalate a declining level of consciousness, which can signal cerebral edema'
  ],

  debriefQuestions: [
    'Which four liver functions have failed here, and which lab proves each one?',
    'Why is the INR the best marker of severity in acute liver failure?',
    'How does lactulose lower ammonia, and how do you know the dose is working?',
    'Why is N-acetylcysteine still given when the ingestion was days ago?',
    'What would make you suspect cerebral edema rather than simple encephalopathy, and what would you do?',
    'What precautions does an INR of 2.8 with a platelet count of 88,000 require for the rest of the shift?'
  ],

  pearls: [
    'The failing liver stops four jobs: detoxifying ammonia, making clotting factors, making albumin, and storing glucose - every abnormal value maps to one of them',
    'INR is the single best marker of hepatic synthetic function and of prognosis in acute liver failure',
    'Asterixis, the flapping tremor, is the bedside sign of hepatic encephalopathy',
    'Lactulose is titrated to two or three soft stools per day; it acidifies the bowel to trap ammonia as ammonium for excretion, and holding it lets ammonia climb',
    'N-acetylcysteine is the antidote for acetaminophen toxicity and improves outcomes in acute liver failure even when given late',
    'Watch for hypoglycemia - a failing liver cannot mobilize glycogen, and low glucose mimics worsening encephalopathy',
    'Cerebral edema is the leading cause of death in acute liver failure; a declining level of consciousness is the warning',
    'Coagulopathy plus thrombocytopenia means bleeding precautions and no IM injections'
  ]
}

];

