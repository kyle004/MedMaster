/* =============================================================================
 * scenarios-ms2a.js - Med-Surg 2 Simulation Scenarios, Set A
 * -----------------------------------------------------------------------------
 * Global defined by this file:
 *   SCENARIOS_MS2A (on the global/window object) - array of 4 scenario objects
 *
 * Sources (NUR2212C Medical-Surgical Nursing II - Simulation Lab):
 *   _staging/MS2_ARDS_STudent.txt            -> ms2-ards
 *   _staging/MS2_DIC_Student.txt             -> ms2-dic
 *   _staging/MS2_Heart_Failure_1_-_Student.txt -> ms2-heart-failure
 *   _staging/MS2_ICP_Student.txt             -> ms2-icp
 *
 * All vitals, labs, diagnostics, orders and MAR entries are transcribed from
 * the source charts. Where a scenario documented only one set of vitals, the
 * later vitalsTimeline entries are a clinically realistic deterioration
 * trajectory and are labeled as such in the entry note.
 * ========================================================================== */

window.SCENARIOS_MS2A = [

  /* ===========================================================================
   * 1. ARDS / ACUTE RESPIRATORY FAILURE
   * ======================================================================== */
  {
    id: 'ms2-ards',
    title: 'ARDS',
    fullTitle: 'Acute Respiratory Failure Progressing to Acute Respiratory Distress Syndrome',
    category: 'Med-Surg 2',
    course: 'NUR2212C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'LUNGS',
    summary: 'A 72-year-old man admitted yesterday with severe pneumonia is deteriorating into acute respiratory failure with radiographic and gas-exchange evidence of early ARDS. The student must recognize refractory hypoxemia, prioritize by ABCs, and escalate respiratory support before respiratory arrest.',
    highYield: true,

    objectives: [
      'Describe the pathophysiology of acute respiratory failure and ARDS',
      'Recognize manifestations of hypoxemia and impaired gas exchange',
      'Interpret arterial blood gas results',
      'Interpret chest x-ray findings associated with severe pneumonia and ARDS',
      'Recognize signs of respiratory deterioration and impending respiratory arrest',
      'Perform focused respiratory, cardiovascular, and neurological assessments',
      'Discuss oxygen delivery methods and escalation of respiratory support',
      'Utilize SBAR communication',
      'Recognize indications for Rapid Response Team activation'
    ],

    patient: {
      name: 'John Smith',
      age: '72 years',
      dob: '06/26/1954',
      sex: 'Male',
      weightKg: 92,
      heightIn: 72,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Severe Pneumonia with Progression to Acute Respiratory Failure',
      unit: 'Step-Down Unit',
      isolation: 'None',
      diet: 'Regular',
      admitted: 'Yesterday',
      history: [
        'Admitted yesterday at 1800 with severe pneumonia',
        'Yesterday 2200 - increased oxygen requirement documented',
        'Today 0600 - reports worsening shortness of breath',
        'Progressive fatigue and inability to speak in complete sentences over the last several hours'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - charted Today 0600',
        bp: '136/84', hr: 96, rr: 22, temp: '100.6 F', spo2: 93,
        pain: '3/10 chest discomfort with coughing',
        loc: 'Alert and oriented x4, mildly anxious',
        other: 'On 2 L nasal cannula. Diffuse crackles bilaterally. Frequent cough. Skin warm.',
        flags: ['tachypnea', 'fever', 'hypoxemia'],
        note: 'Charted 0600 set. Already below the ordered SpO2 goal of greater than 95 percent on 2 L. Fever plus tachypnea in pneumonia is the early warning that gas exchange is failing.'
      },
      {
        atMin: 4,
        label: 'Handoff - charted Today 1000',
        bp: '142/86', hr: 112, rr: 30, temp: '101.8 F', spo2: 88,
        pain: '4/10',
        loc: 'Alert, anxious, restless, unable to speak in complete sentences',
        other: 'Accessory muscle use, nasal flaring, tripod positioning, frequent cough. Still on 2 L nasal cannula. Skin warm.',
        flags: ['tachycardia', 'tachypnea', 'severe-hypoxemia', 'fever', 'accessory-muscle-use'],
        note: 'Second charted set from the source record. Over four hours: RR 22 to 30, HR 96 to 112, SpO2 93 to 88 percent, temp up 1.2 degrees. Inability to finish a sentence is a bedside marker of impending respiratory failure.'
      },
      {
        atMin: 9,
        label: 'Refractory hypoxemia',
        bp: '148/90', hr: 122, rr: 34, temp: '101.8 F', spo2: 85,
        pain: '4/10',
        loc: 'Restless and agitated, answers in one or two words only',
        other: 'SpO2 fails to rise appreciably despite increasing FiO2. Crackles now throughout all fields.',
        flags: ['worsening', 'refractory-hypoxemia', 'shunt'],
        note: 'Projected trajectory. Hypoxemia that does NOT correct with supplemental oxygen is the defining feature of ARDS: alveoli are flooded and collapsed, so blood passes through unventilated lung (intrapulmonary shunt). More FiO2 cannot fix a shunt - the patient needs PEEP.'
      },
      {
        atMin: 14,
        label: 'Decompensation - respiratory muscle fatigue',
        bp: '132/78', hr: 130, rr: 38, temp: '101.6 F', spo2: 82,
        pain: 'Unable to reliably report',
        loc: 'Drowsy, confused, difficult to arouse',
        other: 'Circumoral cyanosis, diaphoretic, shallow ineffective breaths, diminished breath sounds in the bases.',
        flags: ['altered-loc', 'cyanosis', 'fatigue', 'impending-failure'],
        note: 'Projected trajectory. A new drop in level of consciousness in a hypoxemic patient means the PaCO2 is now RISING as the diaphragm tires. A CO2 that climbs toward normal in a patient breathing 38 times a minute is a red flag, not improvement.'
      },
      {
        atMin: 18,
        label: 'Impending respiratory arrest',
        bp: '104/60', hr: 138, rr: 10, temp: '101.4 F', spo2: 78,
        pain: 'Unable to report',
        loc: 'Unresponsive to voice, responds only to painful stimuli',
        other: 'Slow shallow irregular respirations, bradypnea after prolonged tachypnea. Mottled, cool extremities.',
        flags: ['bradypnea', 'unresponsive', 'critical', 'pre-arrest'],
        note: 'Projected trajectory. A respiratory rate that FALLS after sustained tachypnea is exhaustion, not recovery. This is the point of intubation and mechanical ventilation with low tidal volume and PEEP; if it is not already called, the Rapid Response Team is late.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'WBC', value: '19.2', unit: 'K/uL', status: 'critical-high', normalRange: '5-10', interpretation: 'Marked leukocytosis consistent with severe bacterial pneumonia driving the systemic inflammatory response behind ARDS.' },
      { panel: 'CBC', name: 'RBC', value: '4.4', unit: 'M/uL', status: 'normal', normalRange: '4.2-5.4', interpretation: 'Normal. Oxygen carrying capacity is intact - the problem is at the alveolus, not the red cell.' },
      { panel: 'CBC', name: 'Hemoglobin', value: '13.4', unit: 'g/dL', status: 'low', normalRange: '13.5-17.5', interpretation: 'Marginally below the male reference range. Oxygen carrying capacity is essentially intact - the problem is at the alveolus, not the red cell - but trend it.' },
      { panel: 'CBC', name: 'Hematocrit', value: '40', unit: '%', status: 'normal', normalRange: '39-50', interpretation: 'Normal.' },
      { panel: 'CBC', name: 'Platelets', value: '299,000', unit: '/uL', status: 'normal', normalRange: '150,000-400,000', interpretation: 'Normal. Watch for a fall, which would suggest sepsis with DIC.' },
      { panel: 'BMP', name: 'Sodium', value: '136', unit: 'mEq/L', status: 'normal', normalRange: '135-145', interpretation: 'Normal.' },
      { panel: 'BMP', name: 'Potassium', value: '4.3', unit: 'mEq/L', status: 'normal', normalRange: '3.5-5.0', interpretation: 'Normal.' },
      { panel: 'BMP', name: 'Chloride', value: '104', unit: 'mEq/L', status: 'normal', normalRange: '98-106', interpretation: 'Normal.' },
      { panel: 'BMP', name: 'Calcium', value: '9.8', unit: 'mg/dL', status: 'normal', normalRange: '9-10.5', interpretation: 'Normal.' },
      { panel: 'BMP', name: 'BUN', value: '24', unit: 'mg/dL', status: 'high', normalRange: '10-20', interpretation: 'Elevated. Insensible losses from fever and tachypnea plus reduced renal perfusion.' },
      { panel: 'BMP', name: 'Creatinine', value: '1.2', unit: 'mg/dL', status: 'normal', normalRange: '0.6-1.2', interpretation: 'At the top of the reference range. In a 72-year-old with reduced muscle mass, a creatinine at this level already corresponds to a GFR in the 55 to 60 range - roughly stage 3a chronic kidney disease - so a "normal" creatinine is not a normal kidney.' },
      { panel: 'BMP', name: 'Glucose', value: '124', unit: 'mg/dL', status: 'high', normalRange: '70-110', interpretation: 'Mild stress hyperglycemia from catecholamine and cortisol release.' },
      { panel: 'Perfusion Marker', name: 'GFR', value: '18', unit: 'mL/min/1.73m2', status: 'critical-low', normalRange: 'greater than 90', interpretation: 'Severely reduced glomerular filtration as charted. Note the internal inconsistency in this chart: a creatinine of 1.2 in a 72-year-old man usually estimates a GFR near 55 to 60, not 18, so the nurse should verify the result and the reporting equation with the laboratory before acting on it. Either way, the charted GFR mandates that renally cleared and nephrotoxic drugs be dose-adjusted, contrast avoided when possible, and strict hourly intake and output maintained. Verifying a lab that does not fit the clinical picture is itself the nursing action.' },
      { panel: 'ABG', name: 'pH', value: '7.48', unit: '', status: 'high', normalRange: '7.35-7.45', interpretation: 'Alkalemia.' },
      { panel: 'ABG', name: 'PaCO2', value: '31', unit: 'mmHg', status: 'low', normalRange: '35-45', interpretation: 'Low from hyperventilation. Combined with the high pH this is acute respiratory alkalosis, uncompensated.' },
      { panel: 'ABG', name: 'PaO2', value: '58', unit: 'mmHg', status: 'critical-low', normalRange: '80-100', interpretation: 'Severe hypoxemia despite supplemental oxygen. A PaO2 under 60 mmHg defines hypoxemic (Type I) respiratory failure.' },
      { panel: 'ABG', name: 'HCO3', value: '22', unit: 'mEq/L', status: 'normal', normalRange: '22-26', interpretation: 'Normal - no time for renal compensation, confirming an ACUTE process.' },
      { panel: 'ABG (calculated)', name: 'PaO2/FiO2 ratio', value: '~207', unit: '', status: 'critical-low', normalRange: 'greater than 400', interpretation: 'Calculated from the charted PaO2 of 58 with an estimated FiO2 of 0.28 on 2 L nasal cannula. A P/F ratio of 200-300 with bilateral infiltrates and no cardiac cause meets Berlin criteria for MILD ARDS (mild 200-300, moderate 100-200, severe 100 or less). Note that Berlin severity is formally assessed on PEEP of at least 5 cm H2O, which a nasal cannula does not provide - this is an estimate that justifies escalation, not a formal grade.' }
    ],

    diagnostics: [
      { name: 'Chest X-ray', finding: 'Bilateral diffuse infiltrates consistent with worsening pneumonia and progression toward ARDS.',
        interpretation: 'Bilateral diffuse (white-out) infiltrates not explained by fluid overload are one of the Berlin criteria for ARDS. Combined with the P/F ratio and an acute onset within one week of a known insult (pneumonia), this patient meets the definition.' },
      { name: 'Continuous pulse oximetry', finding: 'SpO2 trending 93 percent down to 88 percent on 2 L nasal cannula',
        interpretation: 'Downtrending saturation despite oxygen therapy. Pulse oximetry lags behind PaO2 - on the steep part of the oxyhemoglobin curve, an SpO2 of 88 percent corresponds to roughly a PaO2 of 55-60 mmHg, so small further drops cause large PaO2 losses.' },
      { name: 'Continuous cardiac monitoring', finding: 'Sinus tachycardia',
        interpretation: 'Compensatory response to hypoxemia and fever. Watch for ectopy or bradycardia, which in this setting signals profound hypoxemia and imminent arrest.' }
    ],

    orders: [
      { text: 'Oxygen 2 L nasal cannula to keep O2 greater than 95 percent', category: 'respiratory' },
      { text: 'Titrate oxygen to maintain SpO2 greater than 95 percent', category: 'respiratory' },
      { text: 'Continuous pulse oximetry', category: 'monitoring' },
      { text: 'Continuous cardiac monitoring', category: 'monitoring' },
      { text: 'Maintain High Fowler position', category: 'monitoring' },
      { text: 'Possible ICU transfer', category: 'consult' },
      { text: 'Ceftriaxone 1 g IV - given today 0900', category: 'medication' },
      { text: 'Azithromycin 500 mg IV - given today 0900', category: 'medication' },
      { text: 'Albuterol nebulizer - given today 1000', category: 'medication' },
      { text: '0.9 percent Sodium Chloride 125 mL/hr - started today 1000', category: 'medication' },
      { text: 'Regular diet', category: 'diet' }
    ],

    interventions: [
      { id: 'ards-1', order: 1, action: 'Receive and review the patient chart before entering the room', rationale: 'The chart already contains the answer: ABG with PaO2 58, chest x-ray with bilateral diffuse infiltrates, a four-hour trend of rising RR and falling SpO2, and a GFR of 18. Walking in without this means missing the ARDS picture.', category: 'assessment', critical: false, preventsDeterioration: false, atiPearl: 'Trends beat single values. Always compare the 0600 and 1000 vitals.' },
      { id: 'ards-2', order: 3, action: 'Verify patient identity using two identifiers', rationale: 'Name and date of birth (John Smith, 06/26/1954) against the armband and MAR. Required before any assessment, medication, or treatment.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'ards-3', order: 2, action: 'Perform hand hygiene and apply standard precautions', rationale: 'This patient is immunologically stressed with a WBC of 19.2 and severe pneumonia. Hand hygiene is the single highest-yield infection control action.', category: 'intervention', critical: true, preventsDeterioration: false },
      { id: 'ards-4', order: 4, action: 'Perform a focused respiratory and hemodynamic assessment: rate, depth, effort, accessory muscle use, ability to speak in sentences, breath sounds in all fields, skin color, cardiac rhythm, blood pressure', rationale: 'Auscultation reveals diffuse crackles; accessory muscle use, tripod position, and one-word answers quantify the work of breathing better than any number. Confirm the monitor with a manual assessment.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Count a full 60-second respiratory rate. Inability to speak a full sentence equals severe distress.' },
      { id: 'ards-5', order: 5, action: 'Position the patient in High Fowler position and titrate oxygen upward per order to maintain SpO2 greater than 95 percent (escalate from 2 L nasal cannula toward high-flow or non-rebreather)', rationale: 'Airway and breathing come first. High Fowler drops the diaphragm and maximizes chest excursion. The order explicitly permits titration, so leaving a patient at 88 percent on 2 L is a failure to implement an existing order.', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Position and oxygen are independent nursing actions you already have an order for. Do them before you page.' },
      { id: 'ards-6', order: 6, action: 'Review laboratory, diagnostic, and radiology findings - ABG, WBC, GFR, chest x-ray', rationale: 'pH 7.48 with PaCO2 31 and PaO2 58 is acute respiratory alkalosis with severe hypoxemia. WBC 19.2 confirms infection. GFR 18 changes drug dosing. The chest x-ray states progression toward ARDS in writing.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'ards-7', order: 7, action: 'Recognize and verbalize the manifestations of acute respiratory failure', rationale: 'PaO2 less than 60 mmHg on supplemental oxygen is hypoxemic respiratory failure by definition. Tachypnea, accessory muscle use, restlessness, and inability to complete sentences are the clinical companions.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Restlessness and anxiety are EARLY hypoxia. Confusion and somnolence are LATE.' },
      { id: 'ards-8', order: 8, action: 'Identify signs of progression toward ARDS - refractory hypoxemia, bilateral diffuse infiltrates, P/F ratio around 207 (mild range), acute onset within one week of pneumonia, no evidence of cardiogenic pulmonary edema', rationale: 'Distinguishing ARDS from simple pneumonia changes the plan: ARDS needs PEEP and lung-protective ventilation, not just more FiO2 and antibiotics.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'ards-9', order: 9, action: 'Prioritize interventions using the ABCs - airway patency, oxygenation and ventilation, then circulation', rationale: 'Anxiety in this patient is a symptom of hypoxemia. Treat the oxygen deficit, not the anxiety. Never sedate first.', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'ards-10', order: 10, action: 'Implement provider orders - continuous pulse oximetry, continuous cardiac monitoring, maintain High Fowler, continue the ordered antibiotics and nebulizer, monitor the 0.9 percent NaCl at 125 mL/hr', rationale: 'Ceftriaxone and azithromycin cover community-acquired pneumonia. With a GFR of 18, fluids at 125 mL/hr must be watched closely - volume overload worsens ARDS lung water.', category: 'medication', critical: true, preventsDeterioration: false, atiPearl: 'In ARDS, keep the lungs dry. Conservative fluid strategy improves ventilator-free days.' },
      { id: 'ards-11', order: 11, action: 'Communicate findings to the provider and Rapid Response Team using SBAR', rationale: 'A structured report gets the ICU bed. Lead with the numbers that force action: SpO2 88 percent on 2 L, RR 30, PaO2 58, bilateral infiltrates.', category: 'communication', critical: true, preventsDeterioration: true },
      { id: 'ards-12', order: 12, action: 'Prepare for escalation of respiratory support and ICU transfer - bring the code cart and intubation equipment to the bedside, set up suction and bag-valve-mask, obtain a repeat ABG, and stay with the patient', rationale: 'The order already anticipates possible ICU transfer. Refractory hypoxemia in ARDS requires positive pressure with PEEP. Having the equipment ready converts an emergency into a controlled intubation.', category: 'escalation', critical: true, preventsDeterioration: true, atiPearl: 'Never leave a patient in respiratory distress alone. Delegate the phone call, stay at the bedside.' }
    ],

    medications: [
      { name: 'Ceftriaxone', brand: 'Rocephin', classification: 'Third-generation cephalosporin antibiotic', dose: '1 g IV (given today 0900)', action: 'Bactericidal - inhibits bacterial cell wall synthesis; standard coverage for community-acquired pneumonia', onset: 'Peak serum level immediately after IV infusion', sideEffects: ['Diarrhea', 'Rash', 'Injection site pain', 'Clostridioides difficile colitis'], nursingConsiderations: ['Confirm allergy history - cross-sensitivity with penicillins', 'Obtain cultures BEFORE the first dose when possible', 'Do not mix or co-infuse with calcium-containing solutions such as lactated Ringer', 'Primarily biliary elimination, so no dose change for the GFR of 18 - but monitor'], atiTip: 'Cultures before antibiotics, unless drawing them would delay therapy in sepsis.', highAlert: false },
      { name: 'Azithromycin', brand: 'Zithromax', classification: 'Macrolide antibiotic', dose: '500 mg IV (given today 0900)', action: 'Inhibits bacterial protein synthesis; adds atypical organism coverage (Legionella, Mycoplasma, Chlamydophila) to the cephalosporin', onset: 'Immediate serum levels with IV administration', sideEffects: ['QT prolongation', 'Nausea and vomiting', 'Diarrhea', 'Abdominal pain'], nursingConsiderations: ['Infuse over at least 60 minutes - never IV push', 'Monitor the cardiac monitor for QT prolongation, especially with other QT-prolonging drugs', 'Assess for GI intolerance'], atiTip: 'Ceftriaxone plus azithromycin is the classic inpatient community-acquired pneumonia pairing.', highAlert: false },
      { name: 'Albuterol', brand: 'Proventil, Ventolin', classification: 'Short-acting beta-2 adrenergic agonist bronchodilator', dose: 'Nebulizer treatment (given today 1000)', action: 'Relaxes bronchial smooth muscle to relieve bronchospasm and reduce work of breathing', onset: '5-15 minutes, peak 30-60 minutes', sideEffects: ['Tachycardia', 'Tremor', 'Palpitations', 'Nervousness', 'Hypokalemia'], nursingConsiderations: ['Auscultate lung sounds and count the pulse before and after', 'Expect a rise in heart rate - do not confuse drug-induced tachycardia with worsening hypoxia, assess both', 'Albuterol does NOT fix ARDS shunt physiology; it treats any reversible bronchospasm component'], atiTip: 'If the heart rate climbs more than 20-30 beats per minute after a treatment, notify the provider.', highAlert: false },
      { name: '0.9 percent Sodium Chloride', brand: 'Normal Saline', classification: 'Isotonic crystalloid IV fluid', dose: '125 mL/hr continuous IV (started today 1000)', action: 'Maintains intravascular volume and vascular access', onset: 'Immediate', sideEffects: ['Fluid overload', 'Pulmonary edema', 'Hyperchloremic metabolic acidosis'], nursingConsiderations: ['With a GFR of 18 and ARDS lung water, 125 mL/hr can quickly become too much', 'Auscultate lungs and monitor strict intake and output hourly', 'Report worsening crackles, rising JVD, or a falling urine output to the provider'], atiTip: 'In ARDS the fluid strategy is conservative - a wetter lung is a worse lung.', highAlert: false },
      { name: 'Oxygen', brand: 'n/a', classification: 'Medical gas / respiratory therapy', dose: '2 L nasal cannula, titrate to keep SpO2 greater than 95 percent', action: 'Raises alveolar oxygen tension to improve arterial oxygenation', onset: 'Within minutes; reassess SpO2 5 minutes after each change', sideEffects: ['Nasal drying and epistaxis', 'Oxygen toxicity with prolonged high FiO2', 'Absorption atelectasis'], nursingConsiderations: ['Escalate the device as needed: nasal cannula to simple mask to non-rebreather to high-flow nasal cannula to positive pressure', 'Hypoxemia that does not improve with increased FiO2 indicates shunt and requires PEEP', 'Document the device, the liter flow, and the response to each change'], atiTip: 'Oxygen is a drug. Titrating it within an existing order is an independent nursing action.', highAlert: false }
    ],

    sbar: {
      situation: 'This is the RN on the Step-Down Unit calling about Mr. John Smith, room bed, a 72-year-old male admitted yesterday with severe pneumonia. He is in acute respiratory distress and I need a rapid response and ICU evaluation now.',
      background: 'He was admitted yesterday at 1800 with severe pneumonia, required increased oxygen overnight, and reported worsening shortness of breath at 0600. He received ceftriaxone 1 g IV and azithromycin 500 mg IV at 0900 and an albuterol nebulizer at 1000. He is Full Code with no known drug allergies, weighs 92 kg, and is on 0.9 percent sodium chloride at 125 mL/hr.',
      assessment: 'At 0600 his vitals were 136/84, heart rate 96, respiratory rate 22, temp 100.6, SpO2 93 percent. At 1000 he is 142/86, heart rate 112, respiratory rate 30, temp 101.8, SpO2 88 percent on 2 L nasal cannula. He is using accessory muscles and cannot speak a full sentence. Breath sounds are diffuse crackles bilaterally. His ABG shows pH 7.48, PaCO2 31, PaO2 58, HCO3 22 - acute respiratory alkalosis with severe hypoxemia and a P/F ratio around 207. Chest x-ray reads bilateral diffuse infiltrates consistent with worsening pneumonia and progression toward ARDS. WBC is 19.2 and his GFR is 18.',
      recommendation: 'I have him in High Fowler and I am titrating his oxygen up per your order. I recommend immediate transfer to the ICU, evaluation for non-invasive positive pressure or intubation with low tidal volume and PEEP, a repeat ABG now, and a review of his IV fluid rate and drug dosing given the GFR of 18. Can you come to the bedside?'
    },

    questions: [
      { id: 'ms2-ards-q1', text: 'The nurse reviews the ABG: pH 7.48, PaCO2 31, PaO2 58, HCO3 22. Which interpretation is correct?', type: 'multiple-choice',
        options: ['Uncompensated respiratory alkalosis with severe hypoxemia', 'Compensated metabolic alkalosis', 'Uncompensated respiratory acidosis', 'Fully compensated respiratory alkalosis with normal oxygenation'],
        correct: [0], rationale: 'The pH of 7.48 is alkalotic and the PaCO2 of 31 is low, so the respiratory system is the cause - respiratory alkalosis. The HCO3 of 22 is normal, meaning the kidneys have not compensated, so it is uncompensated and acute. A PaO2 of 58 on supplemental oxygen is severe hypoxemia.',
        atiPearl: 'ROME: Respiratory Opposite (pH up, CO2 down), Metabolic Equal. Normal HCO3 equals uncompensated.', difficulty: 'Medium' },
      { id: 'ms2-ards-q2', text: 'Mr. Smith is on 2 L nasal cannula with an SpO2 of 88 percent, a respiratory rate of 30, and accessory muscle use. What is the nurse\'s PRIORITY action?', type: 'multiple-choice',
        options: ['Administer a PRN anxiolytic for his restlessness', 'Place the patient in High Fowler position and titrate oxygen up per the existing order', 'Page the provider and wait at the desk for a call back', 'Draw a repeat set of blood cultures'],
        correct: [1], rationale: 'Airway and breathing come first, and there is already an order to titrate oxygen to keep SpO2 greater than 95 percent. Positioning and oxygen titration are immediate independent nursing actions that treat the hypoxemia. Sedation would blunt the respiratory drive of a patient who is compensating. Leaving the bedside or drawing cultures delays oxygenation.',
        atiPearl: 'Restlessness in a hypoxic patient is a symptom of hypoxia - give oxygen, not sedation.', difficulty: 'Easy' },
      { id: 'ms2-ards-q3', text: 'Which finding BEST distinguishes ARDS from uncomplicated pneumonia in this patient?', type: 'multiple-choice',
        options: ['WBC of 19.2', 'Temperature of 101.8 F', 'Hypoxemia that does not improve when the FiO2 is increased', 'Productive cough'],
        correct: [2], rationale: 'Refractory hypoxemia is the hallmark of ARDS. Flooded, collapsed alveoli create an intrapulmonary shunt: blood flows past lung that is not ventilated, so raising FiO2 cannot fix it. Leukocytosis, fever, and cough occur in ordinary pneumonia as well.',
        atiPearl: 'Shunt does not respond to FiO2. It responds to PEEP.', difficulty: 'Medium' },
      { id: 'ms2-ards-q4', text: 'Two hours later the patient\'s respiratory rate has fallen from 38 to 10, and he is drowsy and difficult to arouse. How should the nurse interpret this?', type: 'multiple-choice',
        options: ['The patient is improving and finally resting', 'The albuterol treatment is working', 'Respiratory muscle fatigue with impending respiratory arrest', 'This is an expected effect of the antibiotics'],
        correct: [2], rationale: 'A respiratory rate that falls after prolonged tachypnea, accompanied by a decreasing level of consciousness, means the diaphragm has tired and the PaCO2 is rising. This is impending respiratory arrest and requires immediate bag-valve-mask support and intubation, not observation.',
        atiPearl: 'A quiet, sleepy patient after loud respiratory distress is the most dangerous patient on the unit.', difficulty: 'Hard' },
      { id: 'ms2-ards-q5', text: 'Which assessment findings indicate EARLY hypoxemia? Select all that apply.', type: 'select-all',
        options: ['Restlessness', 'Anxiety', 'Tachycardia', 'Cyanosis', 'Bradycardia', 'Tachypnea'],
        correct: [0, 1, 2, 5], rationale: 'Early hypoxemia produces restlessness, anxiety, tachypnea, and tachycardia as the body compensates. Cyanosis is a late and unreliable sign that requires roughly 5 g/dL of deoxygenated hemoglobin. Bradycardia in a hypoxemic patient is a pre-arrest finding.',
        atiPearl: 'RAT before BED: Restlessness, Anxiety, Tachycardia are early; Bradycardia, Extreme restlessness, Dyspnea are late.', difficulty: 'Medium' },
      { id: 'ms2-ards-q6', text: 'The patient\'s GFR is reported as 18 mL/min/1.73m2 while the creatinine is 1.2 mg/dL. What is the nursing implication?', type: 'multiple-choice',
        options: ['No action is needed because the creatinine is within normal limits', 'Renally cleared medications require dose adjustment and strict intake and output must be maintained', 'The patient should receive a rapid 1 liter fluid bolus', 'The lab should be disregarded as an error'],
        correct: [1], rationale: 'A GFR of 18 indicates severe renal impairment even though the creatinine sits at the top of the reference range - older adults with reduced muscle mass produce less creatinine, so a "normal" value can mask real kidney disease. Drug doses must be reviewed, nephrotoxins and contrast avoided when possible, and intake and output tracked hourly. A rapid bolus would worsen ARDS lung water.',
        atiPearl: 'In older adults trust the GFR, not the creatinine.', difficulty: 'Hard' },
      { id: 'ms2-ards-q7', text: 'The chest x-ray reports bilateral diffuse infiltrates. Which additional criterion is required to support a diagnosis of ARDS rather than cardiogenic pulmonary edema?', type: 'multiple-choice',
        options: ['Respiratory failure not fully explained by cardiac failure or fluid overload', 'The presence of a fever', 'An elevated white blood cell count', 'A history of smoking'],
        correct: [0], rationale: 'The Berlin definition of ARDS requires acute onset within one week of a known insult, bilateral opacities on imaging, a P/F ratio of 300 or less with PEEP, and respiratory failure not fully explained by cardiac failure or fluid overload. Fever, leukocytosis, and smoking history do not distinguish the two.',
        atiPearl: 'ARDS is non-cardiogenic pulmonary edema. Cardiogenic edema has a high BNP and responds to diuresis.', difficulty: 'Hard' },
      { id: 'ms2-ards-q8', text: 'Which nursing action is MOST appropriate regarding the 0.9 percent sodium chloride infusing at 125 mL/hr?', type: 'multiple-choice',
        options: ['Increase the rate to improve renal perfusion', 'Monitor lung sounds and hourly intake and output and report worsening crackles to the provider', 'Discontinue the fluid without notifying the provider', 'Change the fluid to D5W'],
        correct: [1], rationale: 'In ARDS a conservative fluid strategy improves outcomes because excess volume increases alveolar-capillary leak and worsens oxygenation. With a GFR of 18 the patient also cannot excrete a fluid load. The nurse monitors closely and reports, but does not independently stop or change an ordered infusion.',
        atiPearl: 'ARDS lungs are leaky. Keep them dry.', difficulty: 'Medium' },
      { id: 'ms2-ards-q9', text: 'Which position should the nurse maintain for this patient, and why?', type: 'multiple-choice',
        options: ['Supine with the head of bed flat to maximize venous return', 'Left lateral recumbent to reduce aspiration risk', 'High Fowler position to lower the diaphragm and maximize chest excursion', 'Trendelenburg to improve cerebral perfusion'],
        correct: [2], rationale: 'High Fowler is ordered and is physiologically correct: it drops the abdominal contents away from the diaphragm, increases functional residual capacity, and reduces the work of breathing. Flat or Trendelenburg positioning would worsen ventilation and increase hypoxemia.',
        atiPearl: 'For any patient in respiratory distress, sit them up first. It is free and it is immediate.', difficulty: 'Easy' },
      { id: 'ms2-ards-q10', text: 'When calling the Rapid Response Team using SBAR, which statement belongs in the RECOMMENDATION section?', type: 'multiple-choice',
        options: ['He was admitted yesterday with severe pneumonia', 'His SpO2 is 88 percent on 2 L nasal cannula with a respiratory rate of 30', 'I recommend immediate ICU transfer and evaluation for intubation with PEEP', 'His chest x-ray shows bilateral diffuse infiltrates'],
        correct: [2], rationale: 'Recommendation states what the nurse wants to happen next. Admission history is Background, current vitals and the chest x-ray finding are Assessment. Ending the call with a clear ask is what converts a report into an intervention.',
        atiPearl: 'Never end an SBAR without a specific request and a timeframe.', difficulty: 'Easy' },
      { id: 'ms2-ards-q11', text: 'If this patient is intubated, which ventilator strategy is evidence-based for ARDS?', type: 'multiple-choice',
        options: ['High tidal volume of 12 mL/kg with zero PEEP', 'Low tidal volume of 4 to 6 mL/kg predicted body weight with PEEP', 'Spontaneous breathing trials only, with no positive pressure', 'Maximum FiO2 of 100 percent maintained continuously for 48 hours'],
        correct: [1], rationale: 'Lung-protective ventilation with low tidal volumes of 4 to 6 mL/kg predicted body weight plus PEEP reduces ventilator-induced lung injury and mortality in ARDS. PEEP recruits collapsed alveoli, which is what actually corrects shunt. Sustained 100 percent FiO2 causes oxygen toxicity and absorption atelectasis.',
        atiPearl: 'ARDS ventilation: small breaths, adequate PEEP, permissive hypercapnia.', difficulty: 'Hard' },
      { id: 'ms2-ards-q12', text: 'The patient asks why he still feels short of breath after the nurse turned up his oxygen. Which response is BEST?', type: 'multiple-choice',
        options: ['"Your lungs have fluid in the air sacs, so oxygen cannot cross into your blood as easily. We are getting you more support right now and I am staying with you."', '"You are just anxious. Try to take slow deep breaths."', '"The oxygen takes several hours to start working."', '"There is nothing more we can do until the antibiotics finish."'],
        correct: [0], rationale: 'Honest, simple, and reassuring communication reduces the anxiety that increases oxygen consumption, and it explains the shunt physiology in plain language while committing to action and presence. Dismissing the symptom as anxiety, giving false information about onset, or expressing helplessness all increase distress.',
        atiPearl: 'Staying at the bedside is a therapeutic intervention for a patient who cannot breathe.', difficulty: 'Medium' }
    ],

    keyPoints: [
      'ARDS is non-cardiogenic pulmonary edema from increased alveolar-capillary permeability',
      'Refractory hypoxemia - hypoxemia that does not improve with increased FiO2 - is the hallmark',
      'Berlin criteria: acute onset within one week, bilateral opacities, P/F ratio 300 or less, not explained by cardiac failure',
      'This patient P/F is about 207, which is MILD ARDS by Berlin criteria - mild 200-300, moderate 100-200, severe 100 or less',
      'Early ABG in ARDS is respiratory ALKALOSIS from hyperventilation; a rising CO2 later means the patient is tiring',
      'Restlessness and anxiety are early hypoxia; confusion, somnolence, cyanosis, and bradycardia are late',
      'Treatment is PEEP and low tidal volume ventilation, not simply more oxygen',
      'A creatinine at the top of the range in an older adult with low muscle mass already means a meaningfully reduced GFR - trust the GFR, not the creatinine'
    ],

    pearls: [
      'A falling respiratory rate after sustained tachypnea is exhaustion, not improvement',
      'A patient who cannot finish a sentence is in severe respiratory distress regardless of the pulse oximeter',
      'Never sedate an anxious hypoxic patient - the anxiety IS the hypoxia',
      'SpO2 sits on the steep part of the oxyhemoglobin curve below 90 percent, so small drops in saturation mean large drops in PaO2',
      'Keep ARDS patients dry - conservative fluids improve ventilator-free days',
      'Bring the code cart and intubation equipment to the room BEFORE you need it'
    ],

    successChecklist: [
      'Review the chart including ABG, chest x-ray, and the 0600 to 1000 vital sign trend',
      'Verify identity with two identifiers and perform hand hygiene',
      'Perform a focused respiratory and hemodynamic assessment including breath sounds in all fields',
      'Place and maintain the patient in High Fowler position',
      'Titrate oxygen upward per the existing order and reassess SpO2 within 5 minutes',
      'Verbalize recognition of acute respiratory failure and progression toward ARDS',
      'Maintain continuous pulse oximetry and cardiac monitoring',
      'Monitor the IV fluid rate and hourly intake and output given the GFR of 18',
      'Deliver a complete SBAR to the provider and Rapid Response Team',
      'Bring intubation and suction equipment to the bedside and remain with the patient',
      'Prepare the patient and family for ICU transfer'
    ],

    criticalErrors: [
      'Lowering the head of bed or laying the patient flat while he is in respiratory distress',
      'Leaving the patient on 2 L nasal cannula with an SpO2 of 88 percent when there is an order to titrate',
      'Administering a sedative, anxiolytic, or opioid to treat hypoxia-driven restlessness',
      'Leaving a patient in respiratory distress alone to go find the provider',
      'Interpreting a rising PaCO2 or a falling respiratory rate as improvement',
      'Failing to activate the Rapid Response Team as the SpO2 continues to fall',
      'Increasing the IV fluid rate, which worsens alveolar flooding in ARDS',
      'Administering renally cleared medications at full dose without addressing the GFR of 18',
      'Documenting the vital signs without reporting the four-hour deterioration trend'
    ],

    comparisons: [
      { title: 'ARDS vs Cardiogenic Pulmonary Edema', headers: ['Feature', 'ARDS', 'Cardiogenic Pulmonary Edema'],
        rows: [
          ['Cause', 'Alveolar-capillary membrane injury (pneumonia, sepsis, aspiration, trauma)', 'Failing left ventricle raises pulmonary capillary pressure'],
          ['BNP', 'Usually normal or only mildly elevated', 'Markedly elevated'],
          ['Response to oxygen', 'Refractory - does not correct with FiO2', 'Improves with oxygen and diuresis'],
          ['Chest x-ray', 'Bilateral diffuse patchy infiltrates, peripheral', 'Central bat-wing pattern, effusions, cardiomegaly'],
          ['Primary treatment', 'PEEP and low tidal volume ventilation, treat the cause', 'Diuretics, vasodilators, preload reduction']
        ] },
      { title: 'Type I vs Type II Respiratory Failure', headers: ['Feature', 'Type I (Hypoxemic)', 'Type II (Hypercapnic)'],
        rows: [
          ['Defining gas', 'PaO2 less than 60 mmHg', 'PaCO2 greater than 50 mmHg with pH less than 7.35'],
          ['Mechanism', 'Shunt and V/Q mismatch - the lung fails to oxygenate', 'Pump failure - the lung fails to ventilate'],
          ['Classic causes', 'ARDS, pneumonia, pulmonary edema, PE', 'COPD exacerbation, opioid overdose, neuromuscular disease'],
          ['This patient', 'Type I at 1000 with PaO2 58 and PaCO2 31', 'Becomes Type II if the diaphragm tires and CO2 climbs']
        ] }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'I cannot... get... enough air. It feels like... I am breathing through a straw.' },
      { speaker: 'patient', trigger: 'breathing', line: 'Every breath... takes everything I have. Please... do not make me lie down. I have to sit up.' },
      { speaker: 'patient', trigger: 'pain', line: 'It is not really pain... my chest just aches... when I cough. Maybe a four. The breathing is... the bad part.' },
      { speaker: 'patient', trigger: 'history', line: 'They told me... it was just pneumonia. Yesterday I could... talk fine. Now I cannot... finish a sentence.' },
      { speaker: 'patient', trigger: 'anxiety', line: 'Am I going to die? Please... do not leave me in here alone.' },
      { speaker: 'patient', trigger: 'intervention', line: 'Whatever you have to do... just help me breathe. I am so tired.' },
      { speaker: 'family', trigger: 'greeting', line: 'I am his daughter. He was talking to me normally last night and now he can barely get a word out. Nobody has told us anything. Is he getting worse?' },
      { speaker: 'family', trigger: 'escalation', line: 'The ICU? Oh God. Do you have to put him on a breathing machine? He always said he did not want to be on a machine forever - but he is a Full Code, he wants everything done.' },
      { speaker: 'family', trigger: 'education', line: 'Should we call his son? He lives four hours away. How much time do we have?' }
    ],

    patientEducation: [
      'Explain that the oxygen device is being changed to give more support, and that the mask or high-flow prongs will feel forceful but are helping',
      'Teach the patient to stay in an upright position and to call before getting out of bed',
      'Explain the purpose of continuous pulse oximetry and cardiac monitoring so alarms do not increase anxiety',
      'Explain in plain language why oxygen alone is not enough - the air sacs are filled with fluid and need pressure to stay open',
      'Prepare the patient and family for possible ICU transfer, non-invasive positive pressure, or intubation, and confirm code status',
      'Teach incentive spirometry, controlled coughing, and repositioning for the recovery phase',
      'Explain the importance of completing the full antibiotic course and of pneumococcal and influenza vaccination after recovery'
    ]
  },

  /* ===========================================================================
   * 2. DISSEMINATED INTRAVASCULAR COAGULATION
   * ======================================================================== */
  {
    id: 'ms2-dic',
    title: 'DIC',
    fullTitle: 'Disseminated Intravascular Coagulation Secondary to Sepsis',
    category: 'Med-Surg 2',
    course: 'NUR2212C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'BLOOD',
    summary: 'A 72-year-old woman admitted three days ago with pneumonia that progressed to sepsis is now bleeding from her gums and IV sites with petechiae, a platelet count of 48,000, a fibrinogen of 90, and a lactate of 4.8. The student must recognize overt DIC with septic shock, protect the patient from bleeding, and prepare for blood product administration.',
    highYield: true,

    objectives: [
      'Describe the pathophysiology of sepsis and DIC',
      'Recognize manifestations of abnormal bleeding and clotting',
      'Interpret coagulation studies',
      'Interpret platelet count, fibrinogen, D-dimer, lactate, and renal function studies',
      'Recognize signs of septic shock',
      'Perform focused cardiovascular, respiratory, neurological, integumentary, and renal assessments',
      'Discuss blood product administration',
      'Utilize SBAR communication',
      'Recognize indications for Rapid Response Team activation'
    ],

    patient: {
      name: 'Jane Smith',
      age: '72 years',
      dob: '06/26/1954',
      sex: 'Female',
      weightKg: 78,
      heightIn: 65,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Sepsis secondary to Pneumonia, now with Disseminated Intravascular Coagulation',
      unit: 'Med/Surg Unit',
      isolation: 'None',
      diet: 'Regular',
      admitted: '3 days ago',
      history: [
        'Admitted 3 days ago with pneumonia that progressed to sepsis',
        'Yesterday 1800 - continue treatment for pneumonia and sepsis',
        'Today 0700 - increased fatigue and weakness, bleeding noticed in gums',
        'Today 0922 - petechiae noted on chest and upper extremities',
        'Oozing blood from IV insertion site',
        'Urine output less than 30 mL/hr'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - charted Today 0600',
        bp: '118/70', hr: 92, rr: 18, temp: '100.8 F', spo2: 94,
        pain: '2/10 generalized aching',
        loc: 'Alert, fatigued',
        other: 'Pale. MAP approximately 86. Scattered petechiae not yet documented at this time.',
        flags: ['fever', 'low-normal-spo2'],
        note: 'Charted 0600 set. Still compensating, but a fever on day three of antibiotics means the source is not controlled.'
      },
      {
        atMin: 4,
        label: 'Handoff - charted Today 0800',
        bp: '108/64', hr: 102, rr: 24, temp: '101.6 F', spo2: 93,
        pain: '3/10, gums sore and bleeding',
        loc: 'Alert but lethargic and fatigued',
        other: 'Petechiae on chest and arms, ecchymosis present, oozing blood from the IV insertion site, bleeding gums. Urine output less than 30 mL/hr. MAP approximately 79.',
        flags: ['tachycardia', 'tachypnea', 'fever', 'bleeding', 'petechiae', 'oliguria'],
        note: 'Second charted set. In two hours the BP dropped 10 points, HR rose 10, RR rose 6, and the temperature climbed to 101.6. Bleeding from three separate sites plus oliguria means the coagulation cascade is consuming clotting factors faster than the liver can make them.'
      },
      {
        atMin: 9,
        label: 'Progressive consumption and early septic shock',
        bp: '96/54', hr: 118, rr: 28, temp: '102.2 F', spo2: 91,
        pain: '4/10',
        loc: 'Lethargic, slow to answer, oriented x3',
        other: 'New petechiae spreading to the abdomen. Continuous ooze from the IV site now saturating the dressing. Urine output 15 mL/hr and tea-colored. MAP approximately 68.',
        flags: ['hypotension', 'worsening-bleeding', 'oliguria', 'hypoperfusion'],
        note: 'Projected trajectory. Microvascular thrombi are obstructing capillary beds in the kidneys while the consumed clotting factors leave every puncture site open. This is the paradox of DIC: clotting and bleeding at the same time.'
      },
      {
        atMin: 14,
        label: 'Septic shock with active hemorrhage',
        bp: '84/46', hr: 130, rr: 32, temp: '101.4 F', spo2: 89,
        pain: 'Unable to quantify',
        loc: 'Confused, oriented to person only',
        other: 'Frank bleeding from gums and IV sites. Extremities cool and mottled, capillary refill greater than 4 seconds. Urine output 10 mL/hr. MAP approximately 59.',
        flags: ['shock', 'hemorrhage', 'altered-loc', 'mottling', 'map-below-65'],
        note: 'Projected trajectory. MAP has fallen below 65, the threshold that defines inadequate organ perfusion in sepsis. The falling temperature in a septic patient is ominous, not reassuring.'
      },
      {
        atMin: 18,
        label: 'Decompensated shock with multi-organ dysfunction',
        bp: '72/38', hr: 138, rr: 34, temp: '100.2 F', spo2: 86,
        pain: 'Unable to report',
        loc: 'Responds only to painful stimuli',
        other: 'Thready peripheral pulses, purpuric patches on the extremities, anuric. Oozing from every puncture site.',
        flags: ['critical', 'mods', 'anuria', 'purpura', 'pre-arrest'],
        note: 'Projected trajectory. Purpura fulminans, anuria, and obtundation signal multi-organ dysfunction. She needs vasopressors, blood products, and ICU-level care; the only definitive treatment for DIC is treating the underlying sepsis.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'WBC', value: '19.8', unit: 'K/uL', status: 'critical-high', normalRange: '5-10', interpretation: 'Marked leukocytosis on day three of antibiotics - the septic source is not controlled.' },
      { panel: 'CBC', name: 'Hemoglobin', value: '10.2', unit: 'g/dL', status: 'low', normalRange: '12-16', interpretation: 'Anemia from ongoing microvascular bleeding and red cell fragmentation as cells are sheared through fibrin strands.' },
      { panel: 'CBC', name: 'Hematocrit', value: '31', unit: '%', status: 'low', normalRange: '37-47', interpretation: 'Low, consistent with the hemoglobin. Trend it - a falling hematocrit with visible bleeding means active loss.' },
      { panel: 'CBC', name: 'Platelets', value: '48,000', unit: '/uL', status: 'critical-low', normalRange: '150,000-400,000', interpretation: 'Severe thrombocytopenia from platelet CONSUMPTION in widespread microthrombi. Below 50,000 there is significant spontaneous bleeding risk; below 20,000 the risk includes spontaneous intracranial hemorrhage.' },
      { panel: 'BMP', name: 'Sodium', value: '133', unit: 'mEq/L', status: 'low', normalRange: '135-145', interpretation: 'Mild hyponatremia, common in sepsis with fluid shifts.' },
      { panel: 'BMP', name: 'Potassium', value: '4.8', unit: 'mEq/L', status: 'normal', normalRange: '3.5-5.0', interpretation: 'Upper normal. Watch it closely - worsening acute kidney injury and tissue breakdown will drive it up.' },
      { panel: 'BMP', name: 'BUN', value: '36', unit: 'mg/dL', status: 'high', normalRange: '10-20', interpretation: 'Elevated from hypoperfusion and acute kidney injury.' },
      { panel: 'BMP', name: 'Creatinine', value: '2.1', unit: 'mg/dL', status: 'critical-high', normalRange: '0.6-1.2', interpretation: 'Acute kidney injury. Microthrombi in the renal microvasculature plus hypoperfusion. Vancomycin dosing must be reviewed.' },
      { panel: 'BMP', name: 'Glucose', value: '176', unit: 'mg/dL', status: 'high', normalRange: '70-110', interpretation: 'Stress hyperglycemia from the sepsis-driven catecholamine and cortisol surge.' },
      { panel: 'Perfusion Marker', name: 'Lactate', value: '4.8', unit: 'mmol/L', status: 'critical-high', normalRange: '0.5-2.0', interpretation: 'A lactate above 4 indicates anaerobic metabolism from global tissue hypoperfusion and, with infection, defines septic shock. This single number should trigger escalation.' },
      { panel: 'Coagulation Panel', name: 'PT', value: '24', unit: 'sec', status: 'critical-high', normalRange: '11-13 sec', interpretation: 'Prolonged by more than 6 seconds. The extrinsic pathway factors have been consumed.' },
      { panel: 'Coagulation Panel', name: 'INR', value: '2.8', unit: '', status: 'critical-high', normalRange: '0.8-1.2', interpretation: 'Markedly prolonged in a patient who is NOT on warfarin - this is consumption, not anticoagulation.' },
      { panel: 'Coagulation Panel', name: 'aPTT', value: '62', unit: 'sec', status: 'critical-high', normalRange: '25-35 sec', interpretation: 'Prolonged intrinsic pathway. Both pathways are depleted, which is characteristic of DIC.' },
      { panel: 'Coagulation Panel', name: 'Fibrinogen', value: '90', unit: 'mg/dL', status: 'critical-low', normalRange: '200-400', interpretation: 'Fibrinogen is consumed to make the microthrombi. A level under 100 is the classic DIC finding and is the specific indication for CRYOPRECIPITATE.' },
      { panel: 'Coagulation Panel', name: 'D-Dimer', value: '5000', unit: 'ng/mL FEU', status: 'critical-high', normalRange: 'less than 500', interpretation: 'Ten times the upper limit. D-dimer is a fibrin degradation product - a massively elevated level proves widespread clot formation AND breakdown is occurring simultaneously. This is the most specific DIC lab.' }
    ],

    diagnostics: [
      { name: 'ISTH DIC score (calculated from the charted labs)', finding: 'Platelets 48,000 = 2 points; D-dimer strongly elevated = 3 points; PT prolonged more than 6 seconds = 2 points; fibrinogen less than 100 = 1 point. Total 8.',
        interpretation: 'A score of 5 or greater is compatible with OVERT DIC. This patient scores 8. This is not a borderline picture - it is fully established disseminated intravascular coagulation.' },
      { name: 'Focused integumentary assessment', finding: 'Petechiae on the chest and upper extremities, ecchymosis, oozing from the IV insertion site, bleeding gums',
        interpretation: 'Bleeding from three or more unrelated sites is a hallmark of DIC. Petechiae are non-blanching pinpoint hemorrhages that reflect the platelet count of 48,000.' },
      { name: 'Renal assessment', finding: 'Urine output less than 30 mL/hr with BUN 36 and creatinine 2.1',
        interpretation: 'Less than 0.5 mL/kg/hr for this 78 kg patient is under 39 mL/hr, so she is oliguric. Renal microthrombi plus hypoperfusion equal acute kidney injury - an early organ failure in DIC.' },
      { name: 'Continuous cardiac monitoring', finding: 'Sinus tachycardia progressing from 92 to 102',
        interpretation: 'Compensation for falling perfusion pressure and volume loss.' }
    ],

    orders: [
      { text: 'Continuous cardiac monitoring', category: 'monitoring' },
      { text: 'Vital signs every 15 minutes', category: 'monitoring' },
      { text: 'Keep SpO2 greater than 95 percent', category: 'respiratory' },
      { text: 'Cefepime 1 g IV every 8 hours - given today 0800', category: 'medication' },
      { text: 'Vancomycin 1 g IV every 24 hours - given today 0900', category: 'medication' },
      { text: '0.9 percent Sodium Chloride 125 mL/hr - started today 0900', category: 'medication' },
      { text: 'Strict intake and output', category: 'monitoring' },
      { text: 'Regular diet', category: 'diet' }
    ],

    interventions: [
      { id: 'dic-1', order: 1, action: 'Receive and review the patient chart', rationale: 'The coagulation panel alone tells the story: PT 24, INR 2.8, aPTT 62, fibrinogen 90, D-dimer 5000, platelets 48,000, lactate 4.8. Reviewing the chart first means walking in already knowing this is overt DIC with septic shock.', category: 'assessment', critical: false, preventsDeterioration: false },
      { id: 'dic-2', order: 3, action: 'Verify patient identity using two identifiers', rationale: 'Jane Smith, date of birth 06/26/1954. Identity verification is mandatory before assessment, medications, and especially before any blood product - a mismatched transfusion in a bleeding patient is fatal.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'dic-3', order: 2, action: 'Perform hand hygiene and apply standard precautions including gloves for the bleeding gums and oozing IV site', rationale: 'She is septic and immunocompromised, and the nurse will contact blood. Standard precautions protect both parties.', category: 'intervention', critical: true, preventsDeterioration: false },
      { id: 'dic-4', order: 4, action: 'Perform a focused assessment - cardiovascular, respiratory, neurological, integumentary, and renal', rationale: 'Inspect all skin surfaces and mucous membranes for petechiae, purpura, and ecchymosis; check every puncture and IV site for oozing; assess capillary refill and peripheral pulses; measure urine output and note the color; assess level of consciousness for signs of intracranial bleeding.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'A neuro change in a DIC patient is intracranial hemorrhage until proven otherwise.' },
      { id: 'dic-5', order: 5, action: 'Implement bleeding precautions immediately - soft toothbrush or oral swabs only, no razors, no IM injections, no rectal temperatures or suppositories, hold pressure at least 5 to 10 minutes after any puncture, pad side rails, avoid tape trauma, minimize blood draws, and do not disturb established clots', rationale: 'With platelets at 48,000 and a fibrinogen of 90 the patient cannot form a stable clot. Every nursing action becomes a potential bleeding source. This is the single most protective set of independent nursing actions in DIC.', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Bleeding precautions are independent nursing actions - no order is needed.' },
      { id: 'dic-6', order: 6, action: 'Review laboratory and diagnostic findings and interpret the coagulation panel', rationale: 'Prolonged PT, INR, and aPTT with LOW fibrinogen and LOW platelets but HIGH D-dimer is the diagnostic fingerprint of DIC. Lactate 4.8 with a creatinine of 2.1 documents hypoperfusion and organ injury.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'dic-7', order: 7, action: 'Recognize and verbalize the manifestations of DIC', rationale: 'Simultaneous clotting and bleeding. Naming it out loud drives the correct interventions: bleeding precautions, product replacement, and source control.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'dic-8', order: 8, action: 'Identify signs of septic shock and organ dysfunction - lactate 4.8, falling MAP, oliguria under 30 mL/hr, creatinine 2.1, and lethargy', rationale: 'Sepsis is the underlying trigger. DIC will not resolve until the sepsis is treated. Recognizing shock is what justifies the Rapid Response call.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Sepsis plus lactate above 4 or a MAP under 65 despite fluids equals septic shock.' },
      { id: 'dic-9', order: 9, action: 'Prioritize interventions using the ABCs - maintain airway, keep SpO2 above 95 percent with supplemental oxygen per order, support circulation with the ordered isotonic fluid, and control visible bleeding with gentle direct pressure', rationale: 'Oxygen delivery is already compromised by a hemoglobin of 10.2, hypotension, and microvascular thrombi. ABCs organize a chaotic bedside.', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'dic-10', order: 10, action: 'Implement provider orders - continuous cardiac monitoring, vital signs every 15 minutes, oxygen to keep SpO2 above 95 percent, cefepime and vancomycin as scheduled, 0.9 percent NaCl at 125 mL/hr, and strict intake and output', rationale: 'Antibiotics treat the source, which is the only definitive DIC therapy. Vital signs every 15 minutes exist because this patient is expected to change quickly. Strict intake and output tracks the acute kidney injury.', category: 'medication', critical: true, preventsDeterioration: false, atiPearl: 'Vancomycin with a creatinine of 2.1 requires trough level monitoring and renal dose adjustment - question the standing dose.' },
      { id: 'dic-11', order: 11, action: 'Communicate findings using SBAR to the provider and activate the Rapid Response Team', rationale: 'Lead with fibrinogen 90, platelets 48,000, INR 2.8, D-dimer 5000, lactate 4.8, MAP falling, and bleeding from three sites. Request blood products, a repeat coagulation panel, blood cultures, and ICU transfer.', category: 'communication', critical: true, preventsDeterioration: true },
      { id: 'dic-12', order: 12, action: 'Prepare for blood product administration - verify type and crossmatch, confirm a signed consent, obtain a second RN for the two-person verification, use blood tubing with a filter and 0.9 percent sodium chloride only, obtain baseline vitals, stay with the patient for the first 15 minutes, and prepare for cryoprecipitate for the fibrinogen of 90, platelets for the count of 48,000, and fresh frozen plasma for the INR of 2.8', rationale: 'Product selection is driven by the specific deficit. Cryoprecipitate is the fibrinogen product; FFP replaces all the consumed clotting factors; platelets are given for the count and active bleeding. Only normal saline may run with blood - dextrose lyses cells and lactated Ringer contains calcium that can clot the line.', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Fibrinogen under 100 equals cryoprecipitate. Prolonged INR equals FFP. Platelets under 50,000 with bleeding equals platelets.' }
    ],

    medications: [
      { name: 'Cefepime', brand: 'Maxipime', classification: 'Fourth-generation cephalosporin antibiotic', dose: '1 g IV every 8 hours (given today 0800)', action: 'Broad-spectrum bactericidal coverage including Pseudomonas; treats the septic source that is driving the DIC', onset: 'Peak serum level at the end of the infusion', sideEffects: ['Diarrhea', 'Rash', 'Neurotoxicity and encephalopathy in renal impairment', 'C. difficile colitis'], nursingConsiderations: ['Cefepime is renally cleared - with a creatinine of 2.1 the dose interval should be reviewed with the provider or pharmacist', 'Cefepime neurotoxicity presents as confusion or myoclonus and can be mistaken for sepsis-related encephalopathy', 'Assess for cephalosporin and penicillin allergy'], atiTip: 'Treating the underlying infection is the only definitive treatment for DIC.', highAlert: false },
      { name: 'Vancomycin', brand: 'Vancocin', classification: 'Glycopeptide antibiotic', dose: '1 g IV every 24 hours (given today 0900)', action: 'Bactericidal against gram-positive organisms including MRSA', onset: 'Infused over at least 60 minutes; steady state after several doses', sideEffects: ['Nephrotoxicity', 'Ototoxicity', 'Vancomycin infusion reaction (red man syndrome)', 'Thrombophlebitis'], nursingConsiderations: ['Infuse over at least 60 minutes - faster infusion causes flushing, rash, and hypotension', 'Monitor trough levels and renal function; this patient already has a creatinine of 2.1 and is oliguric', 'Nephrotoxicity risk is additive with hypoperfusion - report a rising creatinine or falling urine output', 'Assess the IV site frequently; it is also an active bleeding site'], atiTip: 'Draw the trough 30 minutes BEFORE the next scheduled dose.', highAlert: false },
      { name: '0.9 percent Sodium Chloride', brand: 'Normal Saline', classification: 'Isotonic crystalloid IV fluid', dose: '125 mL/hr continuous IV (started today 0900)', action: 'Restores intravascular volume to support MAP and organ perfusion in sepsis', onset: 'Immediate', sideEffects: ['Fluid overload', 'Hyperchloremic metabolic acidosis'], nursingConsiderations: ['Normal saline is the ONLY solution that may be co-administered with blood products', 'Monitor lung sounds and hourly urine output', 'Anticipate a provider order for a 30 mL/kg bolus (about 2,340 mL for this 78 kg patient) if she meets septic shock criteria'], atiTip: 'Isotonic fluid first, then vasopressors if the MAP stays under 65.', highAlert: false },
      { name: 'Cryoprecipitate', brand: 'Cryo', classification: 'Blood product - concentrated fibrinogen, factor VIII, factor XIII, von Willebrand factor', dose: 'Anticipated - not yet ordered. Typically pooled units dosed to raise fibrinogen above 100 to 150 mg/dL', action: 'Directly replaces the fibrinogen consumed by widespread clot formation', onset: 'Fibrinogen rises within 30 to 60 minutes of transfusion', sideEffects: ['Transfusion reaction', 'Volume overload', 'Febrile non-hemolytic reaction'], nursingConsiderations: ['THE product for a fibrinogen under 100 - this patient is at 90', 'Two-RN verification of patient, product, and blood bank tag', 'Blood tubing with an in-line filter, primed with 0.9 percent sodium chloride only', 'Baseline vitals, remain with the patient for the first 15 minutes, then vitals per policy', 'Recheck fibrinogen after transfusion'], atiTip: 'Low fibrinogen equals cryoprecipitate. Memorize the pair.', highAlert: true },
      { name: 'Fresh Frozen Plasma', brand: 'FFP', classification: 'Blood product - all clotting factors', dose: 'Anticipated - not yet ordered. Typically 10 to 15 mL/kg, roughly 780 to 1,170 mL for this 78 kg patient', action: 'Replaces all consumed clotting factors to correct the prolonged PT, INR, and aPTT', onset: 'Correction of coagulation studies within hours', sideEffects: ['Transfusion-associated circulatory overload', 'Transfusion-related acute lung injury (TRALI)', 'Allergic reaction'], nursingConsiderations: ['Must be thawed by the blood bank; once thawed, infuse promptly', 'Watch for volume overload, especially with a urine output under 30 mL/hr', 'Recheck PT, INR, and aPTT after transfusion', 'Stop the transfusion at the first sign of a reaction, keep the line open with normal saline through NEW tubing, and notify the provider and blood bank'], atiTip: 'FFP corrects the INR. Platelets correct the count. Cryo corrects the fibrinogen.', highAlert: true },
      { name: 'Platelets', brand: 'Platelet concentrate', classification: 'Blood product', dose: 'Anticipated - not yet ordered. Generally transfused for a count under 50,000 with active bleeding', action: 'Restores platelet number to allow primary hemostasis', onset: 'Count rises within 1 hour of transfusion', sideEffects: ['Febrile non-hemolytic reaction', 'Allergic reaction', 'Bacterial contamination risk (stored at room temperature)'], nursingConsiderations: ['Do NOT refrigerate platelets', 'Infuse rapidly through a filter, generally within 30 minutes per unit', 'Obtain a post-transfusion platelet count', 'Platelet transfusion is supportive only; DIC will keep consuming them until the sepsis is controlled'], atiTip: 'In DIC, replacing products without treating the infection is bailing a boat without plugging the hole.', highAlert: true }
    ],

    sbar: {
      situation: 'This is the RN on the Med/Surg unit calling a Rapid Response on Mrs. Jane Smith, a 72-year-old female admitted three days ago with pneumonia and sepsis. She is bleeding from multiple sites and I believe she is in DIC with septic shock.',
      background: 'She was admitted three days ago with pneumonia that progressed to sepsis. She is on cefepime 1 g IV every 8 hours and vancomycin 1 g IV every 24 hours, last given at 0800 and 0900, with 0.9 percent sodium chloride at 125 mL/hr. She is Full Code, has no known drug allergies, and weighs 78 kg. At 0700 the night shift noted increased fatigue and bleeding gums, and at 0922 petechiae were documented on her chest and upper extremities.',
      assessment: 'At 0600 she was 118/70, heart rate 92, respiratory rate 18, temp 100.8, SpO2 94 percent. At 0800 she is 108/64, heart rate 102, respiratory rate 24, temp 101.6, SpO2 93 percent. She has petechiae on the chest and arms, ecchymosis, oozing from the IV insertion site, and bleeding gums, and her urine output is less than 30 mL/hr. Her platelets are 48,000, hemoglobin 10.2, PT 24, INR 2.8, aPTT 62, fibrinogen 90, and D-dimer 5000. Her lactate is 4.8, creatinine 2.1, and BUN 36. Her ISTH DIC score is 8, which is consistent with overt DIC.',
      recommendation: 'I have started bleeding precautions and I am holding pressure at the IV site. I recommend a STAT type and crossmatch, cryoprecipitate for the fibrinogen of 90, fresh frozen plasma for the INR of 2.8, and platelets for the count of 48,000. I also recommend repeat blood cultures, a repeat lactate, a fluid bolus with consideration of vasopressors if the MAP stays under 65, review of the vancomycin dose given the creatinine of 2.1, an indwelling urinary catheter for strict output, and transfer to the ICU. Please come to the bedside now.'
    },

    questions: [
      { id: 'ms2-dic-q1', text: 'Which combination of laboratory results is MOST consistent with disseminated intravascular coagulation?', type: 'multiple-choice',
        options: ['High platelets, high fibrinogen, low D-dimer, normal PT', 'Low platelets, low fibrinogen, high D-dimer, prolonged PT and aPTT', 'Normal platelets, normal fibrinogen, high D-dimer, normal INR', 'Low platelets, high fibrinogen, low D-dimer, shortened aPTT'],
        correct: [1], rationale: 'DIC consumes platelets and clotting factors, so the platelet count and fibrinogen fall while PT, INR, and aPTT rise. Simultaneous fibrinolysis releases fibrin degradation products, so the D-dimer rises dramatically. This patient has platelets 48,000, fibrinogen 90, D-dimer 5000, PT 24, INR 2.8, and aPTT 62 - a textbook panel.',
        atiPearl: 'Everything goes DOWN except D-dimer and the clotting times, which go UP.', difficulty: 'Medium' },
      { id: 'ms2-dic-q2', text: 'The fibrinogen level is 90 mg/dL. Which blood product should the nurse anticipate administering specifically for this value?', type: 'multiple-choice',
        options: ['Packed red blood cells', 'Cryoprecipitate', 'Albumin 25 percent', 'Platelets'],
        correct: [1], rationale: 'Cryoprecipitate is the concentrated fibrinogen product and is indicated for a fibrinogen below 100 mg/dL. Packed red cells replace oxygen carrying capacity, albumin is a volume expander, and platelets correct the count - none of them raise fibrinogen meaningfully.',
        atiPearl: 'Fibrinogen under 100 equals cryoprecipitate.', difficulty: 'Medium' },
      { id: 'ms2-dic-q3', text: 'Which nursing actions are appropriate bleeding precautions for this patient? Select all that apply.', type: 'select-all',
        options: ['Use a soft toothbrush or oral swabs for mouth care', 'Take rectal temperatures for accuracy', 'Hold pressure for at least 5 to 10 minutes after any venipuncture', 'Administer intramuscular injections when the IV is unavailable', 'Use an electric razor rather than a blade razor', 'Avoid removing or disturbing established clots'],
        correct: [0, 2, 4, 5], rationale: 'Soft oral care, prolonged pressure after punctures, electric razors, and leaving clots undisturbed all reduce bleeding risk with a platelet count of 48,000. Rectal temperatures and suppositories can tear friable rectal mucosa and cause significant hemorrhage. Intramuscular injections create a deep bleeding site that cannot be compressed and must be avoided.',
        atiPearl: 'No rectal anything and no IM injections in a bleeding patient.', difficulty: 'Easy' },
      { id: 'ms2-dic-q4', text: 'The patient\'s lactate is 4.8 mmol/L. What does this indicate?', type: 'multiple-choice',
        options: ['Adequate tissue oxygenation', 'Anaerobic metabolism from global tissue hypoperfusion, consistent with septic shock', 'A laboratory error caused by the prolonged PT', 'Normal for a 72-year-old patient'],
        correct: [1], rationale: 'Lactate rises when cells cannot get enough oxygen and shift to anaerobic metabolism. A lactate above 4 mmol/L in the setting of infection is a marker of septic shock and independently predicts mortality. It should trigger immediate escalation, fluid resuscitation, and a repeat level.',
        atiPearl: 'Lactate is the perfusion number. Trend it after every intervention.', difficulty: 'Medium' },
      { id: 'ms2-dic-q5', text: 'The nurse notes the patient\'s urine output has been 25 mL/hr for the last three hours. She weighs 78 kg. How should the nurse interpret this?', type: 'multiple-choice',
        options: ['Normal output for her weight', 'Oliguria indicating acute kidney injury and inadequate renal perfusion', 'Expected effect of the cefepime', 'A sign of improving fluid balance'],
        correct: [1], rationale: 'Adequate output is at least 0.5 mL/kg/hr, which for a 78 kg patient is about 39 mL/hr. At 25 mL/hr she is oliguric. Combined with a BUN of 36 and a creatinine of 2.1, this is acute kidney injury from renal microthrombi and hypoperfusion - an early organ failure in DIC.',
        atiPearl: 'Calculate the minimum output for the actual weight. Do not rely on the 30 mL/hr rule of thumb alone.', difficulty: 'Medium' },
      { id: 'ms2-dic-q6', text: 'What is the DEFINITIVE treatment for DIC?', type: 'multiple-choice',
        options: ['Transfusing enough platelets and plasma to normalize the labs', 'Administering heparin to all patients with DIC', 'Treating the underlying cause, in this case the sepsis', 'Placing the patient on strict bed rest'],
        correct: [2], rationale: 'DIC is always secondary to another process - here, sepsis from pneumonia. Blood products are supportive and will keep being consumed until the trigger is controlled. Heparin is used only in selected thrombosis-predominant cases and would be dangerous in a patient who is actively hemorrhaging.',
        atiPearl: 'You cannot fix DIC without fixing what caused it.', difficulty: 'Medium' },
      { id: 'ms2-dic-q7', text: 'While preparing to transfuse fresh frozen plasma, which IV solution may the nurse use to prime the blood tubing?', type: 'multiple-choice',
        options: ['Dextrose 5 percent in water', 'Lactated Ringer solution', '0.9 percent sodium chloride', 'Dextrose 5 percent in 0.45 percent sodium chloride'],
        correct: [2], rationale: '0.9 percent sodium chloride is the only solution compatible with blood products. Dextrose solutions are hypotonic relative to the cell membrane and cause hemolysis, and lactated Ringer contains calcium that can overcome the citrate anticoagulant and cause clotting within the tubing.',
        atiPearl: 'Blood and normal saline only. Nothing else in the line.', difficulty: 'Easy' },
      { id: 'ms2-dic-q8', text: 'Fifteen minutes into a platelet transfusion the patient develops chills, a temperature rise of 1.5 degrees F, flank pain, and dark urine. What is the nurse\'s FIRST action?', type: 'multiple-choice',
        options: ['Slow the transfusion and continue monitoring', 'Stop the transfusion immediately and keep the line open with 0.9 percent sodium chloride using new tubing', 'Administer acetaminophen and reassess in 30 minutes', 'Obtain a urine specimen before doing anything else'],
        correct: [1], rationale: 'Fever, chills, flank pain, and hemoglobinuria suggest an acute hemolytic transfusion reaction. The first action is always to STOP the transfusion. Then maintain IV access with normal saline through NEW tubing so no additional product enters the patient, stay with the patient, notify the provider and blood bank, recheck vitals, and send the product, tubing, and specimens for analysis.',
        atiPearl: 'Stop the blood, save the bag and tubing, run saline through a new set.', difficulty: 'Hard' },
      { id: 'ms2-dic-q9', text: 'Which new assessment finding in this patient would be the MOST concerning and require immediate escalation?', type: 'multiple-choice',
        options: ['A new petechial rash on the abdomen', 'A report of a headache with new confusion and unequal pupils', 'Oozing from the IV insertion site', 'Bleeding from the gums with oral care'],
        correct: [1], rationale: 'New headache, confusion, and unequal pupils in a patient with a platelet count of 48,000 and an INR of 2.8 suggest intracranial hemorrhage, which is the leading cause of death in DIC. Petechiae, IV site ooze, and gum bleeding are all expected findings in this diagnosis and are concerning but not immediately life-threatening.',
        atiPearl: 'In any coagulopathy, a neuro change outranks visible external bleeding.', difficulty: 'Hard' },
      { id: 'ms2-dic-q10', text: 'The patient asks why she is bleeding when the nurse said her blood is "clotting too much." Which explanation is BEST?', type: 'multiple-choice',
        options: ['"The lab results must be wrong. We will recheck them."', '"Your body formed tiny clots throughout your small blood vessels and used up all the clotting supplies, so now there is nothing left to stop bleeding at the surface."', '"The antibiotics are thinning your blood."', '"This happens to everyone who has been in the hospital for three days."'],
        correct: [1], rationale: 'This explains the central paradox of DIC in plain language: widespread microvascular clotting consumes platelets and clotting factors, leaving the patient unable to form a clot where one is needed. Blaming the lab, blaming the antibiotics, or normalizing the finding are all inaccurate and undermine trust.',
        atiPearl: 'DIC is simultaneous clotting and bleeding - clots in the small vessels, hemorrhage everywhere else.', difficulty: 'Medium' },
      { id: 'ms2-dic-q11', text: 'The vancomycin 1 g IV is due and the patient\'s creatinine is 2.1 mg/dL with a urine output under 30 mL/hr. What is the nurse\'s BEST action?', type: 'multiple-choice',
        options: ['Administer the dose as ordered because sepsis requires antibiotics', 'Hold the dose and say nothing until the next set of labs', 'Contact the provider or pharmacist to review the dose and obtain trough monitoring before administering', 'Give half the dose to reduce the nephrotoxicity risk'],
        correct: [2], rationale: 'Vancomycin is renally cleared and nephrotoxic. With a creatinine of 2.1 and oliguria, accumulation is likely and will worsen the acute kidney injury. The nurse does not independently hold, halve, or blindly give the dose - the correct action is to question the order and collaborate with the provider or pharmacist for renal dosing and trough monitoring.',
        atiPearl: 'Renal function changes drug doses. Nurses are expected to catch it.', difficulty: 'Hard' },
      { id: 'ms2-dic-q12', text: 'Place the nurse\'s actions in the correct priority order when entering the room and finding blood soaking through the IV site dressing.', type: 'priority-order',
        options: ['Apply gentle direct pressure over the site with sterile gauze', 'Assess airway, breathing, circulation and level of consciousness', 'Notify the provider and activate the Rapid Response Team', 'Document the amount of blood loss and the intervention'],
        correct: [1, 0, 2, 3], rationale: 'ABCs and level of consciousness come first because a change in mentation would indicate hemorrhagic shock or intracranial bleeding. Direct pressure is the immediate physical intervention to control the visible bleeding. Escalation follows once the nurse can report an accurate picture, and documentation is last.',
        atiPearl: 'Assess, intervene, escalate, document - in that order, every time.', difficulty: 'Medium' }
    ],

    keyPoints: [
      'DIC is always SECONDARY to another process - sepsis is the most common trigger',
      'Widespread microclots consume platelets and clotting factors, causing simultaneous thrombosis and hemorrhage',
      'Classic labs: platelets DOWN, fibrinogen DOWN, PT/INR/aPTT UP, D-dimer WAY UP',
      'D-dimer is the most specific single DIC lab; fibrinogen under 100 is the most classic',
      'ISTH score of 5 or more equals overt DIC - this patient scores 8',
      'Bleeding precautions are independent nursing actions that need no order',
      'Cryoprecipitate for fibrinogen, FFP for INR, platelets for count - match the product to the deficit',
      'Only 0.9 percent sodium chloride may run with blood products',
      'Treating the underlying sepsis is the only definitive therapy'
    ],

    pearls: [
      'Bleeding from three or more unrelated sites is DIC until proven otherwise',
      'A neuro change in a coagulopathic patient means intracranial hemorrhage until proven otherwise',
      'Petechiae do not blanch - that is how you tell them from a rash',
      'A falling temperature in a septic patient is a bad sign, not a good one',
      'Lactate above 4 with infection equals septic shock - escalate immediately',
      'Never disturb an established clot to "clean up" a site',
      'Heparin in DIC is controversial and is never given to an actively hemorrhaging patient without an explicit order'
    ],

    successChecklist: [
      'Review the chart including the full coagulation panel, lactate, and renal function',
      'Verify identity with two identifiers and perform hand hygiene with gloves',
      'Perform a head-to-toe assessment including all skin surfaces, mucous membranes, and every puncture site',
      'Institute bleeding precautions immediately without waiting for an order',
      'Measure and document urine output and note the color',
      'Verbalize recognition of overt DIC and septic shock',
      'Maintain continuous cardiac monitoring and vital signs every 15 minutes per order',
      'Apply oxygen to keep SpO2 above 95 percent per order',
      'Question the vancomycin dose in light of the creatinine of 2.1',
      'Deliver a complete SBAR and activate the Rapid Response Team',
      'Prepare for blood product administration including consent, type and crossmatch, second RN verification, and normal saline priming'
    ],

    criticalErrors: [
      'Administering heparin, enoxaparin, aspirin, or any NSAID to this actively bleeding patient',
      'Giving an intramuscular injection with a platelet count of 48,000',
      'Taking a rectal temperature or inserting a suppository or enema',
      'Performing vigorous oral care with a firm toothbrush or flossing the bleeding gums',
      'Removing or wiping away an established clot at the IV site',
      'Releasing pressure after venipuncture at the usual 1 to 2 minutes',
      'Hanging blood product with dextrose or lactated Ringer solution',
      'Failing to perform two-RN verification before a blood product',
      'Continuing a transfusion after the patient develops chills, fever, and flank pain',
      'Administering full-dose vancomycin without addressing the creatinine of 2.1 and oliguria',
      'Failing to recognize the lactate of 4.8 and falling MAP as septic shock requiring escalation',
      'Ambulating the patient or leaving side rails unpadded, risking a fall with an INR of 2.8'
    ],

    comparisons: [
      { title: 'DIC Laboratory Fingerprint', headers: ['Lab', 'This Patient', 'Direction in DIC', 'Why'],
        rows: [
          ['Platelets', '48,000', 'DOWN', 'Consumed in microthrombi'],
          ['Fibrinogen', '90 mg/dL', 'DOWN', 'Converted to fibrin clots'],
          ['PT / INR', '24 sec / 2.8', 'UP', 'Extrinsic factors consumed'],
          ['aPTT', '62 sec', 'UP', 'Intrinsic factors consumed'],
          ['D-Dimer', '5000', 'UP dramatically', 'Fibrin breakdown products from simultaneous fibrinolysis'],
          ['Hemoglobin', '10.2 g/dL', 'DOWN', 'Bleeding plus red cell fragmentation']
        ] },
      { title: 'Thrombotic Manifestations vs Bleeding Manifestations of DIC', headers: ['Clotting (microvascular thrombosis)', 'Bleeding (factor consumption)'],
        rows: [
          ['Oliguria and rising creatinine from renal microthrombi', 'Petechiae and ecchymosis'],
          ['Cool, mottled, cyanotic extremities', 'Oozing from IV sites and puncture wounds'],
          ['Altered mental status from cerebral microthrombi', 'Bleeding gums and epistaxis'],
          ['Hypoxemia from pulmonary microthrombi', 'Hematuria and GI bleeding'],
          ['Elevated lactate from tissue hypoperfusion', 'Intracranial hemorrhage - the leading cause of death']
        ] }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'My mouth keeps filling up with blood. I rinsed three times and it just keeps coming. I am so tired I can barely lift my head.' },
      { speaker: 'patient', trigger: 'pain', line: 'It is not sharp pain. My whole body just aches, and my gums are sore. Maybe a three. Honestly I am more scared than hurting.' },
      { speaker: 'patient', trigger: 'bleeding', line: 'Look at my arms. Those little red dots were not there this morning. And my IV keeps soaking the tape. Am I bleeding to death?' },
      { speaker: 'patient', trigger: 'history', line: 'I came in with pneumonia. Three days. They said the antibiotics would take care of it. Why am I worse?' },
      { speaker: 'patient', trigger: 'breathing', line: 'I feel like I cannot catch my breath, and my heart is going so fast. Everything is far away and fuzzy.' },
      { speaker: 'patient', trigger: 'intervention', line: 'A blood transfusion? Is that safe? I have never had one. Please tell me what you are doing before you do it.' },
      { speaker: 'family', trigger: 'greeting', line: 'I am her husband. She was sitting up eating breakfast yesterday. This morning her pillow had blood on it and nobody would tell me why.' },
      { speaker: 'family', trigger: 'escalation', line: 'You are calling a rapid response? What does that mean? Is she dying? Please do not make me leave the room.' },
      { speaker: 'family', trigger: 'education', line: 'They keep saying sepsis. I thought sepsis was an infection. How does an infection make her bleed?' }
    ],

    patientEducation: [
      'Explain bleeding precautions and why she must use only a soft toothbrush or swabs, an electric razor, and must not blow her nose forcefully',
      'Instruct her to call for help before getting out of bed to prevent a fall and bleeding injury',
      'Teach her to report any new headache, vision change, confusion, or weakness immediately',
      'Teach her to report black or tarry stools, red or tea-colored urine, or coughing up blood',
      'Explain the transfusion process, the reason for each product, and the signs of a reaction she should report - chills, itching, back pain, or trouble breathing',
      'Explain in plain language that widespread tiny clots used up her clotting supplies, which is why she is bleeding',
      'Reinforce that treating the underlying pneumonia and sepsis is what will stop the DIC',
      'Prepare her and her family for ICU transfer and involve them in code status discussion'
    ]
  },

  /* ===========================================================================
   * 3. ACUTE HEART FAILURE EXACERBATION
   * ======================================================================== */
  {
    id: 'ms2-heart-failure',
    title: 'Heart Failure',
    fullTitle: 'Acute Exacerbation of Heart Failure with Risk of Pulmonary Edema',
    category: 'Med-Surg 2',
    course: 'NUR2212C',
    difficulty: 'Medium',
    durationMin: 20,
    icon: 'HEART',
    summary: 'A 72-year-old man arrives in the Emergency Department with several days of worsening dyspnea, orthopnea, and lower extremity edema. His BNP is 1,250, he has bibasilar crackles, JVD, and +2 pitting edema, and his SpO2 is 91 percent on room air. The student must assess fluid volume status, interpret the diagnostics, and recognize progression toward pulmonary edema.',
    highYield: true,

    objectives: [
      'Explain the pathophysiology of heart failure',
      'Differentiate left-sided, right-sided, and biventricular heart failure',
      'Recognize signs and symptoms of acute heart failure exacerbation',
      'Perform a focused cardiovascular and respiratory assessment',
      'Interpret laboratory findings associated with heart failure',
      'Interpret diagnostic results including chest x-ray, ECG findings, and BNP levels',
      'Assess fluid volume status, daily weights, and trends in intake and output',
      'Describe indications and nursing considerations for oxygen, diuretic, vasodilator, ACE inhibitor and ARB, and beta-blocker therapy, and for fluid and sodium restriction',
      'Recognize signs and symptoms of pulmonary edema',
      'Utilize SBAR communication and recognize indications for Rapid Response Team activation',
      'Prioritize care using the ABCs and clinical urgency',
      'Recognize complications including pulmonary edema, dysrhythmias, cardiogenic shock, and acute respiratory failure'
    ],

    patient: {
      name: 'John Smith',
      age: '72 years',
      dob: '06/26/1954',
      sex: 'Male',
      weightKg: 90,
      heightIn: 70,
      allergies: ['Aspirin'],
      codeStatus: 'Full Code',
      diagnosis: 'Acute Exacerbation of Heart Failure',
      unit: 'Emergency Department',
      isolation: 'None',
      diet: 'NPO',
      admitted: 'Today',
      history: [
        'Chronic Heart Failure',
        'Hypertension - Lisinopril 10 mg daily',
        'Hyperlipidemia - Atorvastatin 40 mg at bedtime',
        'Type 2 Diabetes Mellitus - Metformin 500 mg daily',
        'Allergy to Aspirin',
        'Today 0930 - admitted to the ED with complaints of shortness of breath',
        'Today 0945 - vital signs taken, then placed on 2 L nasal cannula',
        'Reports increasing shortness of breath over the last several days and inability to lie flat',
        'Recent weight gain reported'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - charted Today 09:45 on room air',
        bp: '152/90', hr: 102, rr: 22, temp: '98.7 F', spo2: 91,
        pain: 'Denies chest pain; reports chest tightness and air hunger',
        loc: 'Alert and oriented x3, appears fatigued, mildly anxious',
        other: 'Crackles at bilateral lung bases, S1/S2 present, pulses +2 throughout, +2 bilateral lower extremity edema, JVD present, positive fluid balance. Placed on 2 L nasal cannula immediately after these vitals were taken.',
        flags: ['hypertension', 'tachycardia', 'tachypnea', 'hypoxemia', 'edema', 'jvd'],
        note: 'This is the ONLY vital sign set documented in the source chart. The entries that follow are a clinically realistic acute heart failure exacerbation trajectory, included so the deterioration engine can run; each note explains what is changing and why.'
      },
      {
        atMin: 6,
        label: 'Increasing congestion',
        bp: '158/94', hr: 110, rr: 26, temp: '98.6 F', spo2: 92,
        pain: 'Chest tightness increasing',
        loc: 'Alert, more anxious, refuses to lie back',
        other: 'On 2 L nasal cannula. Crackles now audible to the mid-lung fields. Orthopnea requiring three pillows. Dry hacking cough. Increased work of breathing with any movement.',
        flags: ['worsening-crackles', 'orthopnea', 'tachycardia'],
        note: 'Projected trajectory. Rising afterload and a failing left ventricle push pulmonary capillary pressure higher, so fluid moves up the lung fields. Crackles that climb from bases to mid-fields are a measurable marker of worsening backward failure.'
      },
      {
        atMin: 12,
        label: 'Flash pulmonary edema',
        bp: '166/98', hr: 122, rr: 32, temp: '98.8 F', spo2: 88,
        pain: 'Severe air hunger, feels like drowning',
        loc: 'Very anxious, sitting bolt upright in a tripod position, restless',
        other: 'On 2 L nasal cannula. Pink frothy sputum. Crackles throughout all lung fields with expiratory wheeze (cardiac asthma). S3 gallop audible. Diaphoretic, skin cool and pale.',
        flags: ['pulmonary-edema', 'pink-frothy-sputum', 's3-gallop', 'severe-hypoxemia', 'critical'],
        note: 'Projected trajectory. Pink frothy sputum plus an S3 gallop is acute cardiogenic pulmonary edema. The alveoli are filling with plasma. This patient needs to sit upright with legs dependent, high-flow oxygen or positive pressure, an IV loop diuretic, and a vasodilator - immediately.'
      },
      {
        atMin: 17,
        label: 'Cardiogenic decompensation',
        bp: '96/62', hr: 132, rr: 36, temp: '97.6 F', spo2: 84,
        pain: 'Unable to reliably report',
        loc: 'Confused, restless, difficult to redirect',
        other: 'Non-rebreather in place. Skin cool, clammy, and gray. Weak thready peripheral pulses, capillary refill greater than 3 seconds. Urine output has essentially stopped. Frequent PVCs on the monitor.',
        flags: ['hypotension', 'cardiogenic-shock', 'altered-loc', 'oliguria', 'ectopy'],
        note: 'Projected trajectory. A blood pressure that falls from hypertensive to hypotensive in a heart failure exacerbation is not improvement - it means the ventricle can no longer generate output against its afterload. Cold, clammy, and confused with a low BP is cardiogenic shock and requires ICU care, inotropes, and possible mechanical support.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'WBC', value: '8.4', unit: 'K/uL', status: 'normal', normalRange: '5-10', interpretation: 'Normal - this exacerbation is not driven by infection.' },
      { panel: 'CBC', name: 'Hemoglobin', value: '12.8', unit: 'g/dL', status: 'low', normalRange: '13.5-17.5', interpretation: 'Low-normal. Anemia is a common precipitant of heart failure exacerbation, so trend it.' },
      { panel: 'CBC', name: 'Hematocrit', value: '38', unit: '%', status: 'low', normalRange: '39-50', interpretation: 'Low for an adult male. Consider both dilution from volume overload and true anemia - anemia is a common and correctable precipitant of decompensation.' },
      { panel: 'CBC', name: 'Platelets', value: '311,000', unit: '/uL', status: 'normal', normalRange: '150,000-400,000', interpretation: 'Normal.' },
      { panel: 'BMP', name: 'Sodium', value: '132', unit: 'mEq/L', status: 'low', normalRange: '135-145', interpretation: 'Dilutional hyponatremia from fluid retention - a marker of more advanced heart failure and a predictor of poorer outcomes. It supports fluid restriction rather than sodium administration.' },
      { panel: 'BMP', name: 'Potassium', value: '4.8', unit: 'mEq/L', status: 'normal', normalRange: '3.5-5.0', interpretation: 'Upper normal. Critical baseline: loop diuretics will drop it, while his lisinopril raises it. Recheck after diuresis begins.' },
      { panel: 'BMP', name: 'Chloride', value: '100', unit: 'mEq/L', status: 'normal', normalRange: '98-106', interpretation: 'Normal.' },
      { panel: 'BMP', name: 'Calcium', value: '9', unit: 'mg/dL', status: 'normal', normalRange: '9-10.5', interpretation: 'At the low end of normal.' },
      { panel: 'BMP', name: 'BUN', value: '28', unit: 'mg/dL', status: 'high', normalRange: '10-20', interpretation: 'Elevated. Reduced cardiac output means reduced renal perfusion - cardiorenal syndrome. A high BUN to creatinine ratio also suggests a prerenal pattern.' },
      { panel: 'BMP', name: 'Creatinine', value: '1.3', unit: 'mg/dL', status: 'high', normalRange: '0.6-1.2', interpretation: 'Mildly elevated from renal hypoperfusion. Monitor closely once diuresis begins and before any contrast study; also relevant to his metformin.' },
      { panel: 'BMP', name: 'Glucose', value: '202', unit: 'mg/dL', status: 'high', normalRange: '70-110', interpretation: 'Hyperglycemia in a patient with type 2 diabetes, worsened by acute physiologic stress.' },
      { panel: 'Cardiac', name: 'BNP', value: '1,250', unit: 'pg/mL', status: 'critical-high', normalRange: 'less than 100', interpretation: 'Markedly elevated. BNP is released by stretched ventricular myocardium and directly reflects ventricular wall stress and volume overload. A level over 1,000 strongly supports acute decompensated heart failure as the cause of the dyspnea and helps distinguish it from a primary pulmonary cause.' }
    ],

    diagnostics: [
      { name: 'ECG (STAT EKG ordered)', finding: 'Sinus tachycardia',
        interpretation: 'The heart is compensating for reduced stroke volume by increasing rate. Tachycardia shortens diastolic filling time and coronary perfusion time, which worsens cardiac output in a failing ventricle. No acute ischemic changes are documented, but continuous monitoring is required to catch atrial fibrillation or ventricular ectopy.' },
      { name: 'Focused respiratory assessment', finding: 'Crackles auscultated at bilateral lung bases, mild to moderate dyspnea, increased work of breathing with activity, SpO2 91 percent on room air',
        interpretation: 'Bibasilar crackles that do not clear with coughing are pulmonary congestion from LEFT-sided failure. Crackles that ascend toward the apices indicate worsening congestion.' },
      { name: 'Focused fluid volume assessment', finding: 'Bilateral lower extremity edema +2, jugular venous distention present, recent weight gain reported, positive fluid balance',
        interpretation: 'Peripheral edema and JVD are RIGHT-sided failure findings. Left plus right equals biventricular failure. Daily weight is the single most reliable measure of fluid status - 1 kg equals about 1 liter of fluid.' },
      { name: 'Cardiovascular assessment', finding: 'S1 and S2 present, heart rate mildly elevated, pulses +2 throughout',
        interpretation: 'Baseline heart sounds are normal. A new S3 gallop would be the classic auscultatory sign of volume overload and decompensating heart failure - listen for it at the apex with the bell.' }
    ],

    orders: [
      { text: 'Oxygen titration via nasal cannula to keep O2 greater than 95 percent', category: 'respiratory' },
      { text: 'Continuous cardiac monitoring', category: 'monitoring' },
      { text: 'CBC, BMP, BNP', category: 'lab' },
      { text: 'STAT EKG', category: 'imaging' },
      { text: 'Monitor intake and output every 1 hour', category: 'monitoring' },
      { text: 'NPO', category: 'diet' },
      { text: 'Medication Administration Record: none administered', category: 'medication' }
    ],

    interventions: [
      { id: 'hf-1', order: 1, action: 'Perform a focused cardiovascular and respiratory assessment - heart sounds including listening for an S3, apical rate and rhythm, peripheral pulses, capillary refill, lung sounds in all fields, respiratory rate and effort, and SpO2', rationale: 'Bibasilar crackles, an elevated heart rate, and an SpO2 of 91 percent on room air quantify how much congestion is present. Listening for an S3 gallop is the classic bedside marker of volume overload. Assessment drives every subsequent decision.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Listen for crackles at the BASES first, then follow them upward. Rising crackles equal rising congestion.' },
      { id: 'hf-2', order: 3, action: 'Obtain a comprehensive patient history and symptom assessment - onset and progression of dyspnea, orthopnea and number of pillows, paroxysmal nocturnal dyspnea, weight change, activity tolerance, dietary sodium, fluid intake, and home medication adherence', rationale: 'He states he has been getting more short of breath over several days and cannot lie flat. Orthopnea and recent weight gain are the earliest, most specific heart failure exacerbation symptoms and often reveal the precipitating cause, such as dietary sodium or a missed dose of lisinopril.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'hf-3', order: 4, action: 'Identify signs and symptoms of worsening heart failure - increasing dyspnea, orthopnea, fatigue, crackles, tachycardia, hypoxemia, JVD, and peripheral edema', rationale: 'Naming the syndrome converts scattered findings into a clinical picture that justifies escalation and treatment.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'hf-4', order: 5, action: 'Assess fluid volume status - hourly intake and output per order, obtain a daily weight on the same scale in the same clothing, grade the bilateral lower extremity edema, and assess jugular venous distention with the head of bed at 30 to 45 degrees', rationale: 'Daily weight is the most reliable indicator of fluid balance; a gain of 1 kg equals roughly 1 liter of retained fluid. Hourly output establishes the baseline against which diuretic response will be judged.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'A gain of 2 to 3 pounds in a day or 5 pounds in a week is the teaching threshold to call the provider.' },
      { id: 'hf-5', order: 6, action: 'Review laboratory and diagnostic results - BNP 1,250, sodium 132, potassium 4.8, BUN 28, creatinine 1.3, glucose 202, and the ECG showing sinus tachycardia', rationale: 'A BNP over 1,000 confirms acute decompensated heart failure as the cause of the dyspnea. The sodium of 132 is dilutional. The BUN and creatinine reflect cardiorenal syndrome. The potassium of 4.8 is the baseline that matters once a loop diuretic starts.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'hf-6', order: 7, action: 'Identify potential causes of the heart failure exacerbation - dietary sodium and fluid excess, medication nonadherence, uncontrolled hypertension at 152/90, new dysrhythmia, ischemia, infection, anemia, or NSAID use', rationale: 'Treating only the symptoms guarantees a readmission. His blood pressure of 152/90 raises afterload the failing ventricle must pump against and is a modifiable contributor.', category: 'assessment', critical: false, preventsDeterioration: false },
      { id: 'hf-7', order: 2, action: 'Initiate evidence-based nursing interventions - position in high Fowler with legs dependent, apply and titrate oxygen per order to keep SpO2 above 95 percent, maintain continuous cardiac monitoring, maintain NPO status, limit activity and cluster care, and provide calm reassurance', rationale: 'The SpO2 is 91 percent with a standing order to titrate to above 95 percent, so this is an immediate independent nursing action, not a step to be reached after the history is complete. High Fowler with legs down reduces preload and maximizes chest excursion at the same time. Titrating oxygen is an independent action within an existing order. Anxiety increases myocardial oxygen demand, so reassurance is a physiologic intervention.', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Upright with legs dangling is the single fastest non-drug preload reduction available.' },
      { id: 'hf-8', order: 8, action: 'Communicate findings using SBAR', rationale: 'Report the BNP of 1,250, SpO2 of 91 percent on room air, bibasilar crackles, JVD, +2 edema, and the aspirin allergy. Request diuretic and vasodilator orders and a chest x-ray, none of which currently exist in the chart.', category: 'communication', critical: true, preventsDeterioration: true },
      { id: 'hf-9', order: 9, action: 'Implement provider orders safely - oxygen titration, continuous cardiac monitoring, CBC, BMP and BNP, STAT EKG, and hourly intake and output, while honoring the documented aspirin allergy', rationale: 'The STAT EKG must actually be done STAT - it rules in or out ischemia and dysrhythmia as the precipitant. The aspirin allergy must be verified on the band and communicated to every team member, because aspirin is a reflexive order in cardiac patients.', category: 'intervention', critical: true, preventsDeterioration: false },
      { id: 'hf-10', order: 10, action: 'Monitor for complications - pulmonary edema, acute respiratory distress, cardiac dysrhythmias, cardiogenic shock, decreased cardiac output, and worsening fluid overload', rationale: 'Pink frothy sputum, an S3 gallop, crackles ascending toward the apices, new ectopy, or a falling blood pressure with cool clammy skin all signal that the exacerbation has progressed.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'A BP that falls from high to low in heart failure means the pump is failing, not improving.' },
      { id: 'hf-11', order: 11, action: 'Assess response to oxygen therapy and prescribed medications', rationale: 'Reassess SpO2 within 5 minutes of every oxygen change. Once a diuretic is given, measure urine output, daily weight, potassium, blood pressure, and respiratory status to judge the response.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'hf-12', order: 12, action: 'Monitor oxygen saturation, respiratory effort, and lung sounds continuously', rationale: 'Serial lung auscultation is the earliest bedside detector of ascending pulmonary congestion, often before the pulse oximeter changes.', category: 'assessment', critical: true, preventsDeterioration: true },
      { id: 'hf-13', order: 13, action: 'Escalate care appropriately - activate the Rapid Response Team for pink frothy sputum, an SpO2 that will not maintain above 90 percent, a falling blood pressure with cool clammy skin, new confusion, or sustained dysrhythmia', rationale: 'Acute cardiogenic pulmonary edema is a medical emergency that can progress to respiratory failure within minutes. Early escalation gets non-invasive positive pressure, IV diuretics, and vasodilators to the bedside before intubation is required.', category: 'escalation', critical: true, preventsDeterioration: true },
      { id: 'hf-14', order: 14, action: 'Participate in debriefing', rationale: 'Structured debriefing consolidates clinical reasoning, identifies missed cues such as the aspirin allergy or the absent diuretic order, and is a required component of simulation learning.', category: 'communication', critical: false, preventsDeterioration: false }
    ],

    medications: [
      { name: 'Lisinopril', brand: 'Zestril, Prinivil', classification: 'ACE inhibitor', dose: '10 mg PO daily (home medication - patient is currently NPO)', action: 'Blocks conversion of angiotensin I to angiotensin II, producing vasodilation that lowers afterload and preload; reduces aldosterone-driven sodium and water retention and blunts ventricular remodeling', onset: '1 hour, peak 6 hours, duration 24 hours', sideEffects: ['Persistent dry cough', 'Hyperkalemia', 'First-dose hypotension', 'Angioedema', 'Acute kidney injury'], nursingConsiderations: ['Monitor potassium - his is already 4.8 and ACE inhibitors raise it', 'Monitor BUN and creatinine, currently 28 and 1.3', 'Teach that a dry hacking cough is a drug effect, not worsening heart failure, and should be reported', 'Angioedema of the lips, tongue, or throat is an emergency - stop the drug and get help', 'Advise against salt substitutes, which are potassium chloride'], atiTip: 'ACE inhibitors are cornerstone therapy in heart failure with reduced ejection fraction - they improve survival, not just symptoms.', highAlert: false },
      { name: 'Atorvastatin', brand: 'Lipitor', classification: 'HMG-CoA reductase inhibitor (statin)', dose: '40 mg PO at bedtime (home medication)', action: 'Lowers LDL cholesterol and stabilizes atherosclerotic plaque, reducing ischemic events', onset: 'Lipid effect over weeks', sideEffects: ['Myalgia', 'Rhabdomyolysis', 'Elevated liver enzymes', 'Headache'], nursingConsiderations: ['Teach the patient to report unexplained muscle pain, tenderness, or weakness, especially with dark urine', 'Monitor liver function tests', 'Avoid grapefruit juice, which increases drug levels'], atiTip: 'New muscle pain on a statin equals check a CK for rhabdomyolysis.', highAlert: false },
      { name: 'Metformin', brand: 'Glucophage', classification: 'Biguanide antidiabetic', dose: '500 mg PO daily (home medication - patient is currently NPO)', action: 'Decreases hepatic glucose production and improves peripheral insulin sensitivity', onset: 'Glycemic effect over days to weeks', sideEffects: ['GI upset and diarrhea', 'Metallic taste', 'Lactic acidosis (rare but life-threatening)', 'Vitamin B12 deficiency'], nursingConsiderations: ['Lactic acidosis risk rises with renal impairment and tissue hypoperfusion - his creatinine is 1.3 and his cardiac output is falling', 'Must be held before and for 48 hours after iodinated contrast studies', 'He is NPO, so the dose will be held; monitor his glucose of 202 and anticipate sliding scale coverage'], atiTip: 'Hold metformin around contrast and in any patient with hypoperfusion or renal impairment.', highAlert: false },
      { name: 'Furosemide', brand: 'Lasix', classification: 'Loop diuretic - ANTICIPATED therapy, not currently ordered in this chart', dose: 'Typically 20 to 40 mg IV push over 1 to 2 minutes for acute decompensated heart failure', action: 'Inhibits sodium and chloride reabsorption in the ascending loop of Henle, producing rapid diuresis that reduces preload and pulmonary congestion; also has a direct early venodilating effect', onset: 'IV onset 5 minutes, peak 30 minutes, duration about 2 hours', sideEffects: ['Hypokalemia', 'Hyponatremia', 'Hypomagnesemia', 'Hypotension', 'Ototoxicity with rapid IV push', 'Dehydration'], nursingConsiderations: ['Push IV slowly - rapid administration causes ototoxicity and hearing loss', 'Check potassium before and after; his baseline is 4.8 and it will fall', 'Measure strict intake and output and daily weight to judge response', 'Monitor blood pressure closely, especially with concurrent lisinopril', 'Ensure toileting access or a urinal is within reach before administering'], atiTip: 'Furosemide is the first-line drug for acute pulmonary congestion. Expect diuresis within 30 minutes and watch the potassium.', highAlert: false },
      { name: 'Nitroglycerin', brand: 'Nitrostat, Tridil', classification: 'Nitrate vasodilator - ANTICIPATED therapy, not currently ordered in this chart', dose: 'Sublingual or IV infusion titrated to blood pressure and symptoms', action: 'Venodilation reduces preload; at higher doses arterial dilation reduces afterload, decreasing the workload of the failing left ventricle', onset: 'Sublingual 1 to 3 minutes; IV within minutes', sideEffects: ['Headache', 'Hypotension', 'Reflex tachycardia', 'Dizziness'], nursingConsiderations: ['Contraindicated with phosphodiesterase-5 inhibitors such as sildenafil within 24 to 48 hours - profound hypotension', 'Continuous blood pressure monitoring; hold and notify if systolic falls below 90', 'Headache is expected and is treated with acetaminophen'], atiTip: 'Nitroglycerin is especially useful in hypertensive acute heart failure like this patient at 152/90 - reducing afterload unloads the ventricle.', highAlert: false },
      { name: 'Oxygen', brand: 'n/a', classification: 'Medical gas / respiratory therapy', dose: '2 L nasal cannula applied at 0945, titrate to keep SpO2 greater than 95 percent', action: 'Improves arterial oxygenation and reduces myocardial oxygen demand and pulmonary vasoconstriction', onset: 'Minutes', sideEffects: ['Nasal drying', 'Oxygen toxicity with prolonged high concentration'], nursingConsiderations: ['Escalate to a non-rebreather or non-invasive positive pressure if the SpO2 will not maintain', 'CPAP or BiPAP in cardiogenic pulmonary edema pushes alveolar fluid back into the vasculature and often prevents intubation', 'Reassess SpO2 within 5 minutes of every change'], atiTip: 'Oxygen plus upright positioning is the fastest thing you can do for a heart failure patient who cannot breathe.', highAlert: false }
    ],

    sbar: {
      situation: 'This is the RN in the Emergency Department calling about Mr. John Smith, a 72-year-old male who arrived at 0930 with several days of worsening shortness of breath and an admitting diagnosis of acute heart failure exacerbation. I am concerned he is progressing toward pulmonary edema.',
      background: 'He has a history of chronic heart failure, hypertension on lisinopril 10 mg daily, hyperlipidemia on atorvastatin 40 mg at bedtime, and type 2 diabetes on metformin 500 mg daily. He is allergic to ASPIRIN. He is Full Code, weighs 90 kg, and is NPO. No medications have been administered here. He reports he cannot lie flat without feeling like he cannot breathe, and he has had recent weight gain.',
      assessment: 'At 0945 his vitals were 152/90, heart rate 102, respiratory rate 22, temp 98.7, SpO2 91 percent on room air, and he was placed on 2 L nasal cannula. He has crackles at both lung bases, jugular venous distention, +2 bilateral lower extremity edema, and a positive fluid balance. His BNP is 1,250, sodium 132, potassium 4.8, BUN 28, creatinine 1.3, and glucose 202. His ECG shows sinus tachycardia.',
      recommendation: 'I recommend an order for IV furosemide, consideration of nitroglycerin given his blood pressure of 152/90, a STAT chest x-ray, an indwelling catheter or strict hourly output measurement, a repeat BMP after diuresis, daily weights, and admission to a telemetry or step-down bed. Please note his aspirin allergy before ordering any antiplatelet therapy. Can you evaluate him now?'
    },

    questions: [
      { id: 'ms2-hf-q1', text: 'The patient\'s BNP is 1,250 pg/mL. What does this result indicate?', type: 'multiple-choice',
        options: ['An acute infection', 'Ventricular stretch from volume overload, supporting acute decompensated heart failure', 'Acute kidney injury', 'A myocardial infarction'],
        correct: [1], rationale: 'B-type natriuretic peptide is secreted by ventricular myocardium in response to stretch. A level over 1,000 pg/mL in a dyspneic patient strongly supports acute decompensated heart failure and helps distinguish a cardiac cause of dyspnea from a pulmonary one. Troponin, not BNP, is the marker for myocardial infarction.',
        atiPearl: 'BNP answers the question: is this dyspnea the heart or the lungs?', difficulty: 'Easy' },
      { id: 'ms2-hf-q2', text: 'Which assessment findings indicate LEFT-sided heart failure? Select all that apply.', type: 'select-all',
        options: ['Bibasilar crackles', 'Jugular venous distention', 'Orthopnea', 'Bilateral lower extremity edema', 'Dyspnea on exertion', 'Hepatomegaly and ascites'],
        correct: [0, 2, 4], rationale: 'Left-sided failure backs blood up into the LUNGS, producing crackles, orthopnea, paroxysmal nocturnal dyspnea, dyspnea on exertion, and a cough with frothy sputum. JVD, peripheral edema, hepatomegaly, ascites, and weight gain are RIGHT-sided findings from systemic venous congestion. This patient has both, which is biventricular failure.',
        atiPearl: 'LEFT equals LUNGS. RIGHT equals REST of the body.', difficulty: 'Medium' },
      { id: 'ms2-hf-q3', text: 'The patient suddenly becomes severely dyspneic, sits bolt upright, and coughs up pink frothy sputum. What is the nurse\'s FIRST action?', type: 'multiple-choice',
        options: ['Lay the patient flat and elevate the legs', 'Place the patient in high Fowler position with the legs dependent and increase the oxygen', 'Obtain a 12-lead ECG', 'Draw a repeat BNP'],
        correct: [1], rationale: 'Pink frothy sputum is acute cardiogenic pulmonary edema. Sitting the patient fully upright with the legs down immediately reduces preload by pooling blood in the lower extremities and maximizes chest excursion, while increased oxygen addresses the hypoxemia. Laying him flat or elevating the legs would increase venous return and drown him faster. The ECG and labs matter, but not before airway and breathing.',
        atiPearl: 'High Fowler with legs DOWN. Never elevate the legs in pulmonary edema.', difficulty: 'Medium' },
      { id: 'ms2-hf-q4', text: 'The provider orders furosemide 40 mg IV. Which laboratory value is MOST important for the nurse to monitor?', type: 'multiple-choice',
        options: ['Potassium', 'White blood cell count', 'Platelets', 'Hemoglobin'],
        correct: [0], rationale: 'Loop diuretics cause potassium wasting, and hypokalemia predisposes to life-threatening ventricular dysrhythmias, especially in a patient on continuous cardiac monitoring with a failing heart. His baseline is 4.8, so both the pre-dose and post-dose values matter - his lisinopril pushes potassium up while furosemide pushes it down.',
        atiPearl: 'Loop diuretics LOSE potassium. Potassium-sparing diuretics keep it.', difficulty: 'Easy' },
      { id: 'ms2-hf-q5', text: 'Which nursing action is MOST important before administering any medication to this patient?', type: 'multiple-choice',
        options: ['Verify his weight', 'Verify and communicate his documented ASPIRIN allergy', 'Check his last bowel movement', 'Confirm he has a family member present'],
        correct: [1], rationale: 'Aspirin is documented as an allergy and is a reflexive order in almost any cardiac presentation. Verifying the allergy on the armband, in the electronic record, and verbally with the patient, and communicating it during SBAR, prevents a potentially anaphylactic exposure. Weight matters for dosing but the allergy is the safety-critical check.',
        atiPearl: 'Allergy check happens before every single medication, every single time.', difficulty: 'Easy' },
      { id: 'ms2-hf-q6', text: 'The patient\'s sodium is 132 mEq/L. What is the MOST likely cause in this patient?', type: 'multiple-choice',
        options: ['Excessive sodium intake', 'Dilutional hyponatremia from fluid retention', 'Adrenal insufficiency', 'Laboratory error'],
        correct: [1], rationale: 'In heart failure, reduced cardiac output triggers the renin-angiotensin-aldosterone system and antidiuretic hormone, causing the body to retain water in excess of sodium. The resulting dilutional hyponatremia is a marker of more advanced disease and worse prognosis. The treatment is fluid restriction and diuresis, not sodium administration.',
        atiPearl: 'Hyponatremia in heart failure means too much water, not too little salt.', difficulty: 'Medium' },
      { id: 'ms2-hf-q7', text: 'Which single measurement is the MOST reliable indicator of fluid volume status in a heart failure patient?', type: 'multiple-choice',
        options: ['Blood pressure', 'Daily weight taken at the same time on the same scale', 'Degree of pitting edema', 'Serum sodium'],
        correct: [1], rationale: 'A daily weight obtained at the same time, on the same scale, in the same clothing captures total body fluid before edema is visible. One kilogram equals approximately one liter of fluid. Edema grading is subjective and lags, blood pressure is influenced by many factors, and sodium is an indirect measure.',
        atiPearl: 'Teach patients: same time, same scale, same clothes, every morning after voiding.', difficulty: 'Easy' },
      { id: 'ms2-hf-q8', text: 'Over the next hour the patient\'s blood pressure drops from 166/98 to 96/62, his heart rate rises to 132, and his skin becomes cool and clammy with new confusion. How should the nurse interpret this change?', type: 'multiple-choice',
        options: ['His hypertension is finally responding to treatment', 'He is developing cardiogenic shock and requires immediate escalation', 'He is dehydrated from diuresis and needs a fluid bolus', 'He is having a vasovagal response to anxiety'],
        correct: [1], rationale: 'A fall from hypertensive to hypotensive with tachycardia, cool clammy skin, and confusion means the failing ventricle can no longer generate adequate cardiac output. This is cardiogenic shock and requires immediate Rapid Response activation, ICU transfer, and consideration of inotropes. Giving a fluid bolus to a volume-overloaded patient in cardiogenic shock would worsen the pulmonary edema.',
        atiPearl: 'Cold and clammy plus low BP in heart failure equals cardiogenic shock, not hypovolemia.', difficulty: 'Hard' },
      { id: 'ms2-hf-q9', text: 'Which extra heart sound is the classic auscultatory finding of volume overload in heart failure?', type: 'multiple-choice',
        options: ['S3 gallop', 'S4 gallop', 'Pericardial friction rub', 'Systolic ejection click'],
        correct: [0], rationale: 'An S3 gallop occurs in early diastole as blood rushes into an already overfilled, poorly compliant ventricle, and it is the classic sign of volume overload in heart failure. An S4 reflects a stiff ventricle in late diastole and is associated with hypertension and hypertrophy. Listen for the S3 at the apex with the bell of the stethoscope with the patient in the left lateral position.',
        atiPearl: 'S3 sounds like Ken-TUC-ky and means fluid overload.', difficulty: 'Medium' },
      { id: 'ms2-hf-q10', text: 'Which discharge teaching points should the nurse include for this patient? Select all that apply.', type: 'select-all',
        options: ['Weigh yourself daily and report a gain of 2 to 3 pounds in one day or 5 pounds in one week', 'Limit dietary sodium and read food labels', 'Take a potassium-containing salt substitute to replace lost potassium', 'Report a persistent dry cough, since it may be from your lisinopril', 'Stop your heart failure medications once your swelling improves', 'Report increasing shortness of breath, new inability to lie flat, or increased swelling'],
        correct: [0, 1, 3, 5], rationale: 'Daily weights, sodium restriction, reporting the ACE inhibitor cough, and recognizing worsening symptoms are all core heart failure self-management. Salt substitutes are potassium chloride and are dangerous with an ACE inhibitor and a potassium of 4.8. Heart failure medications are lifelong disease-modifying therapy and must never be stopped because symptoms improve.',
        atiPearl: 'Never stop a heart failure medication because you feel better - feeling better is the medication working.', difficulty: 'Medium' },
      { id: 'ms2-hf-q11', text: 'The patient is currently NPO with a glucose of 202 mg/dL and a creatinine of 1.3 mg/dL. What is the correct nursing consideration for his home metformin?', type: 'multiple-choice',
        options: ['Give it now with a sip of water to control the glucose', 'Hold it because he is NPO, and recognize the added lactic acidosis risk with renal impairment, hypoperfusion, and any contrast study', 'Double the dose because his glucose is elevated', 'Substitute an oral sulfonylurea'],
        correct: [1], rationale: 'Metformin is held when a patient is NPO, and its most serious adverse effect - lactic acidosis - becomes far more likely with renal impairment, tissue hypoperfusion from low cardiac output, or iodinated contrast. Glucose control in the acute setting is managed with insulin, not by increasing or substituting oral agents, and the nurse does not change drugs independently.',
        atiPearl: 'Metformin plus contrast, plus hypoperfusion, plus renal impairment equals lactic acidosis risk.', difficulty: 'Hard' },
      { id: 'ms2-hf-q12', text: 'The patient says, "I stopped my water pill last week because I kept having to get up all night to pee." Which response by the nurse is BEST?', type: 'multiple-choice',
        options: ['"You should never stop a medication. That was a serious mistake."', '"That is understandable, and it likely contributed to the fluid building up. Let us talk with the provider about taking it earlier in the day so it does not disturb your sleep."', '"Do not worry, the diuretic was probably not helping anyway."', '"I will make a note of it in the chart."'],
        correct: [1], rationale: 'This response validates the real barrier, connects the behavior to the current exacerbation without shaming, and moves toward a practical solution - taking diuretics in the morning and not after late afternoon. Medication nonadherence is one of the most common precipitants of heart failure readmission, and blaming the patient makes future disclosure less likely.',
        atiPearl: 'Ask WHY a patient stopped a medication. The answer is usually a solvable problem.', difficulty: 'Medium' }
    ],

    keyPoints: [
      'LEFT-sided failure equals LUNG findings: crackles, orthopnea, PND, dyspnea, frothy sputum',
      'RIGHT-sided failure equals systemic findings: JVD, peripheral edema, hepatomegaly, ascites, weight gain',
      'This patient has BOTH, which is biventricular failure',
      'BNP over 1,000 strongly supports acute decompensated heart failure as the cause of dyspnea',
      'Daily weight is the most reliable fluid status measure - 1 kg equals about 1 liter',
      'Hyponatremia in heart failure is dilutional and signals more advanced disease',
      'High Fowler with legs DEPENDENT reduces preload immediately',
      'Pink frothy sputum plus an S3 gallop equals acute cardiogenic pulmonary edema - a medical emergency',
      'A blood pressure that falls from high to low with cool clammy skin is cardiogenic shock',
      'ACE inhibitors and beta-blockers improve SURVIVAL in heart failure; diuretics improve symptoms'
    ],

    pearls: [
      'The number of pillows a patient sleeps on is a vital sign in heart failure',
      'Never elevate the legs of a patient in pulmonary edema - it dumps preload into a failing ventricle',
      'An ACE inhibitor cough is dry and persistent and is not a reason to hide the symptom - it is a reason to switch to an ARB',
      'Salt substitutes are potassium chloride and are dangerous with ACE inhibitors',
      'Beta-blockers are started when the patient is EUVOLEMIC and stable, never during acute decompensation',
      'CPAP or BiPAP in cardiogenic pulmonary edema often prevents intubation by forcing alveolar fluid back into the vasculature',
      'Watch for the aspirin allergy - aspirin is a reflexive order for anyone who arrives with a cardiac complaint'
    ],

    successChecklist: [
      'Verify patient identity with two identifiers and confirm the ASPIRIN allergy',
      'Perform hand hygiene',
      'Perform a focused cardiovascular and respiratory assessment including all lung fields and heart sounds',
      'Obtain a symptom history including orthopnea, pillow count, weight gain, and medication adherence',
      'Assess fluid volume status - edema grading, JVD, intake and output, and weight',
      'Position in high Fowler with legs dependent',
      'Apply and titrate oxygen per order and reassess SpO2 within 5 minutes',
      'Ensure the STAT EKG is obtained and continuous cardiac monitoring is running',
      'Interpret the BNP of 1,250, sodium 132, and BUN 28 with creatinine 1.3',
      'Maintain NPO status and hourly intake and output per order',
      'Deliver a complete SBAR and request diuretic, vasodilator, and chest x-ray orders',
      'Monitor for pulmonary edema, dysrhythmias, and cardiogenic shock and escalate appropriately',
      'Provide heart failure self-management teaching'
    ],

    criticalErrors: [
      'Administering aspirin or an aspirin-containing product to a patient with a documented aspirin allergy',
      'Laying the patient flat or elevating his legs while he is dyspneic or in pulmonary edema',
      'Administering a rapid IV fluid bolus to a volume-overloaded patient',
      'Leaving the patient on room air or failing to titrate oxygen when the SpO2 is 91 percent with an order to keep it above 95 percent',
      'Delaying the STAT EKG',
      'Giving furosemide by rapid IV push, risking ototoxicity',
      'Administering a diuretic without checking the baseline potassium or reassessing it afterward',
      'Giving the home metformin while the patient is NPO with a creatinine of 1.3 and falling cardiac output',
      'Ambulating the patient to the bathroom while he is hypoxemic and dyspneic',
      'Offering oral fluids or food while the patient is NPO',
      'Interpreting a falling blood pressure as improvement rather than cardiogenic shock',
      'Failing to report the BNP of 1,250 and the absence of any diuretic order'
    ],

    comparisons: [
      { title: 'Left-Sided vs Right-Sided Heart Failure', headers: ['Left-Sided (LUNGS)', 'Right-Sided (REST of body)'],
        rows: [
          ['Bibasilar crackles', 'Jugular venous distention'],
          ['Orthopnea and paroxysmal nocturnal dyspnea', 'Dependent peripheral edema'],
          ['Dyspnea on exertion', 'Weight gain'],
          ['Cough with frothy or pink-tinged sputum', 'Hepatomegaly, splenomegaly, ascites'],
          ['Restlessness, confusion, fatigue', 'Anorexia, nausea, right upper quadrant discomfort'],
          ['S3 gallop, tachycardia', 'Nocturia']
        ] },
      { title: 'Cardiogenic Pulmonary Edema vs Cardiogenic Shock', headers: ['Feature', 'Pulmonary Edema', 'Cardiogenic Shock'],
        rows: [
          ['Blood pressure', 'Usually HIGH from sympathetic surge', 'LOW - systolic under 90'],
          ['Skin', 'Diaphoretic, may be pale', 'Cold, clammy, mottled, gray'],
          ['Lungs', 'Crackles throughout, pink frothy sputum', 'Crackles plus signs of end-organ hypoperfusion'],
          ['Mentation', 'Extreme anxiety, air hunger', 'Confusion, obtundation'],
          ['Urine output', 'May still be adequate', 'Oliguric to anuric'],
          ['Priority treatment', 'Sit upright, oxygen or positive pressure, IV loop diuretic, nitrates', 'Inotropes, ICU, possible mechanical circulatory support']
        ] }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'I have been getting more short of breath over the last few days, and I cannot lie flat without feeling like I cannot breathe. I slept in the recliner last night.' },
      { speaker: 'patient', trigger: 'breathing', line: 'It is like there is a weight sitting on my chest. When I try to lay back it gets worse right away, so please leave me sitting up.' },
      { speaker: 'patient', trigger: 'pain', line: 'It is not chest pain exactly. No crushing, nothing going down my arm. It is more like tightness, and I just cannot get a full breath.' },
      { speaker: 'patient', trigger: 'history', line: 'I have had the heart failure for a few years. I take the lisinopril, the cholesterol pill, and the metformin. And my legs, look at them, my shoes did not fit this morning.' },
      { speaker: 'patient', trigger: 'medication', line: 'Do not give me aspirin. I break out and my throat gets tight. They put it on my bracelet.' },
      { speaker: 'patient', trigger: 'adherence', line: 'I stopped the water pill about a week ago. I was up four or five times a night going to the bathroom and I could not sleep. Was that bad?' },
      { speaker: 'patient', trigger: 'anxiety', line: 'My wife made me come in. I kept saying it was nothing. Am I having a heart attack?' },
      { speaker: 'family', trigger: 'greeting', line: 'I am his wife. He has gained about eight pounds in a week and I could not get him to call the doctor. He has been sleeping sitting up in the chair for three nights.' },
      { speaker: 'family', trigger: 'education', line: 'We had barbecue at our grandson\'s birthday on Saturday. Ham, chips, the whole thing. Could that have done this?' },
      { speaker: 'family', trigger: 'escalation', line: 'His breathing sounds wet and rattly now. That is new. Should someone be looking at him right now?' }
    ],

    patientEducation: [
      'Weigh yourself every morning after voiding, on the same scale, in the same clothing, and record it',
      'Call the provider for a weight gain of 2 to 3 pounds in one day or 5 pounds in one week',
      'Limit dietary sodium as prescribed - read labels, avoid canned soups, deli meats, processed foods, and restaurant meals',
      'Do NOT use salt substitutes, which are potassium chloride and are dangerous with lisinopril',
      'Follow any prescribed fluid restriction and count all liquids, including ice, soup, and gelatin',
      'Take diuretics in the morning and not late in the day so nighttime urination does not disrupt sleep - and never stop them on your own',
      'Report a persistent dry cough, which may be caused by lisinopril and can be managed by switching to an ARB',
      'Report increasing shortness of breath, needing more pillows, new or worsening swelling, or a rapid weight gain',
      'Seek emergency care immediately for pink frothy sputum, severe breathlessness at rest, chest pain, or confusion',
      'Balance activity with rest, and stop and rest if you become short of breath',
      'Keep the aspirin allergy on your medical alert information and tell every provider',
      'Get an annual influenza vaccine and stay current on pneumococcal vaccination'
    ]
  },

  /* ===========================================================================
   * 4. INCREASED INTRACRANIAL PRESSURE
   * ======================================================================== */
  {
    id: 'ms2-icp',
    title: 'Increased ICP',
    fullTitle: 'Traumatic Brain Injury with Increasing Intracranial Pressure',
    category: 'Med-Surg 2',
    course: 'NUR2212C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'BRAIN',
    summary: 'A 72-year-old man admitted after a motor vehicle accident develops headache, confusion, and a declining Glasgow Coma Scale twelve hours after admission. CT shows cerebral edema with increasing midline shift. The student must perform serial neurologic assessments, recognize Cushing triad, implement ICP-lowering measures, and prepare mannitol 20 percent 42 g IV.',
    highYield: true,

    objectives: [
      'Describe the pathophysiology of increased intracranial pressure',
      'Discuss cerebral perfusion pressure and factors affecting cerebral blood flow',
      'Perform a focused neurological assessment',
      'Interpret Glasgow Coma Scale findings',
      'Assess pupillary response and motor function',
      'Recognize signs of neurological deterioration',
      'Identify manifestations of Cushing triad',
      'Discuss interventions used to reduce ICP',
      'Utilize SBAR communication',
      'Recognize indications for Rapid Response Team activation'
    ],

    patient: {
      name: 'John Smith',
      age: '72 years',
      dob: '06/26/1954',
      sex: 'Male',
      weightKg: 84,
      heightIn: 74,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Traumatic Brain Injury with Increasing Intracranial Pressure',
      unit: 'Neuro Step-Down Unit',
      isolation: 'None',
      diet: 'Regular',
      admitted: 'Yesterday',
      history: [
        'Yesterday 2200 - admitted following a motor vehicle accident with traumatic brain injury',
        'Today 0600 - complains of headache',
        'Today 0800 - mild confusion and drowsiness noted; acetaminophen 650 mg PO given',
        'Today 1000 - Glasgow Coma Scale decline noted',
        'Twelve hours after admission the patient began demonstrating subtle neurological changes',
        'Initial assessment: headache, mild confusion, unlabored respirations, moves all extremities equally'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - charted Today 0600',
        bp: '128/78', hr: 84, rr: 18, temp: '99.4 F', spo2: 97,
        pain: 'Headache 5/10',
        loc: 'Alert and oriented x4, GCS 15. Moves all extremities equally.',
        other: 'Respirations unlabored. Pulse pressure 50. Pupils equal and briskly reactive.',
        flags: ['headache', 'low-grade-fever'],
        note: 'Charted 0600 set. Headache is the earliest and most common symptom of rising intracranial pressure. Everything else is still normal, which is exactly why the change over the next few hours matters so much.'
      },
      {
        atMin: 4,
        label: 'Charted Today 0900 - subtle change',
        bp: '138/84', hr: 88, rr: 18, temp: '99.0 F', spo2: 96,
        pain: 'Headache 6/10',
        loc: 'Drowsy with mild confusion, oriented x3, GCS approximately 14. Follows commands but slowly.',
        other: 'Respirations still unlabored. Pulse pressure 54. Acetaminophen 650 mg PO given at 0800 for headache.',
        flags: ['altered-loc', 'drowsiness', 'confusion', 'rising-bp'],
        note: 'Second charted set. The vital signs look almost normal, but the LEVEL OF CONSCIOUSNESS has changed. A decline in level of consciousness is the EARLIEST and most sensitive indicator of increasing intracranial pressure and always precedes the vital sign changes.'
      },
      {
        atMin: 9,
        label: 'Today 1000 - documented GCS decline',
        bp: '152/78', hr: 78, rr: 16, temp: '99.2 F', spo2: 96,
        pain: 'Unable to reliably rate; grimaces and guards the head',
        loc: 'Lethargic, oriented to person only, GCS approximately 12. Requires repeated stimulation to respond.',
        other: 'Pulse pressure widening to 74. Left pupil now 4 mm and sluggish, right 3 mm and brisk. Reports blurred and double vision. One episode of vomiting without nausea.',
        flags: ['gcs-decline', 'widening-pulse-pressure', 'anisocoria', 'projectile-vomiting'],
        note: 'Charted note documents GCS decline at 1000. Projected physiology: the systolic pressure is climbing while the diastolic falls, which widens the pulse pressure - one third of Cushing triad. Unequal pupils mean the expanding mass is compressing cranial nerve III on the left.'
      },
      {
        atMin: 14,
        label: 'Cushing triad emerging',
        bp: '168/64', hr: 62, rr: 12, temp: '99.6 F', spo2: 95,
        pain: 'Unable to report',
        loc: 'Responds to painful stimuli only, GCS approximately 8. No longer follows commands.',
        other: 'Pulse pressure 104. Respirations slow and becoming irregular. Left pupil 5 mm and fixed, right 3 mm and sluggish. Beginning to posture on the right side with noxious stimulation.',
        flags: ['cushings-triad', 'bradycardia', 'irregular-respirations', 'fixed-pupil', 'posturing', 'critical'],
        note: 'Projected trajectory. Cushing triad is hypertension with a WIDENING pulse pressure, BRADYCARDIA, and IRREGULAR respirations. It is a LATE sign of dangerously elevated intracranial pressure and impending herniation. A GCS of 8 or less is the threshold for definitive airway protection.'
      },
      {
        atMin: 18,
        label: 'Impending herniation',
        bp: '190/58', hr: 48, rr: 8, temp: '100.8 F', spo2: 92,
        pain: 'Unable to report',
        loc: 'GCS approximately 6. Decorticate posturing progressing toward decerebrate.',
        other: 'Pulse pressure 132. Cheyne-Stokes respirations. Left pupil fixed and dilated at 6 mm. Central hyperthermia from hypothalamic involvement.',
        flags: ['herniation', 'decerebrate-progression', 'cheyne-stokes', 'blown-pupil', 'pre-arrest'],
        note: 'Projected trajectory. A blown pupil with posturing and Cushing triad is uncal herniation. Progression from decorticate (flexion, arms toward the CORE) to decerebrate (extension) means the injury is descending through the brainstem and carries a far worse prognosis. This requires immediate intubation, hyperosmolar therapy, and neurosurgical intervention.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'WBC', value: '11.8', unit: 'K/uL', status: 'high', normalRange: '5-10', interpretation: 'Mild leukocytosis. Expected as a stress response after trauma, but infection must still be ruled out - fever raises cerebral metabolic demand and worsens ICP.' },
      { panel: 'CBC', name: 'RBC', value: '4.6', unit: 'M/uL', status: 'normal', normalRange: '4.2-5.4', interpretation: 'Normal.' },
      { panel: 'CBC', name: 'Hemoglobin', value: '14.1', unit: 'g/dL', status: 'normal', normalRange: '13.5-17.5', interpretation: 'Normal. Adequate oxygen carrying capacity supports cerebral oxygen delivery.' },
      { panel: 'CBC', name: 'Hematocrit', value: '42', unit: '%', status: 'normal', normalRange: '39-50', interpretation: 'Normal - no evidence of significant occult hemorrhage from the trauma.' },
      { panel: 'CBC', name: 'Platelets', value: '280,000', unit: '/uL', status: 'normal', normalRange: '150,000-400,000', interpretation: 'Normal. Important in traumatic brain injury because thrombocytopenia would increase the risk of hemorrhage expansion.' },
      { panel: 'BMP', name: 'Sodium', value: '138', unit: 'mEq/L', status: 'normal', normalRange: '135-145', interpretation: 'Normal now, and this is the critical baseline before mannitol. Hyperosmolar therapy and the syndrome of inappropriate ADH or cerebral salt wasting after traumatic brain injury all move sodium. Hyponatremia worsens cerebral edema.' },
      { panel: 'BMP', name: 'Potassium', value: '4.1', unit: 'mEq/L', status: 'normal', normalRange: '3.5-5.0', interpretation: 'Normal. Mannitol-induced diuresis can lower it - recheck after administration.' },
      { panel: 'BMP', name: 'BUN', value: '18', unit: 'mg/dL', status: 'normal', normalRange: '10-20', interpretation: 'Normal. Baseline before osmotic diuresis.' },
      { panel: 'BMP', name: 'Creatinine', value: '1.0', unit: 'mg/dL', status: 'normal', normalRange: '0.6-1.2', interpretation: 'Normal renal function, which is required for safe mannitol administration. Mannitol can cause acute kidney injury, so trend it.' },
      { panel: 'BMP', name: 'Glucose', value: '110', unit: 'mg/dL', status: 'normal', normalRange: '70-110', interpretation: 'At the upper limit of normal. Hyperglycemia worsens outcomes in brain injury by increasing anaerobic metabolism and lactate in ischemic tissue - keep it controlled.' }
    ],

    diagnostics: [
      { name: 'CT Head (STAT)', finding: 'Cerebral edema with increasing midline shift, consistent with worsening intracranial pressure.',
        interpretation: 'Midline shift means the swelling brain is pushing structures across the midline - the compensatory mechanisms described by the Monro-Kellie doctrine are exhausted. Increasing shift on serial imaging is a neurosurgical emergency and is the objective evidence supporting hyperosmolar therapy and possible decompression.' },
      { name: 'Glasgow Coma Scale trend', finding: 'GCS 15 at 0600, approximately 14 at 0900 with drowsiness and mild confusion, documented decline at 1000',
        interpretation: 'The trend matters more than any single score. A drop of 2 or more points requires immediate provider notification. A GCS of 8 or less indicates the patient cannot protect his airway and requires intubation.' },
      { name: 'Pupillary assessment', finding: 'Baseline pupils equal and briskly reactive; developing anisocoria with a sluggish then fixed left pupil',
        interpretation: 'A unilaterally dilated, sluggish, or fixed pupil indicates compression of the oculomotor nerve (cranial nerve III) by an expanding mass, classically from uncal herniation. The pupil dilates on the SAME side as the lesion. This is a neurosurgical emergency.' },
      { name: 'Cerebral perfusion pressure (calculated)', finding: 'CPP = MAP minus ICP. At 138/84 the MAP is approximately 102; if the ICP were 25 mmHg, the CPP would be about 77 mmHg.',
        interpretation: 'The goal CPP is 60 to 70 mmHg. As ICP rises, CPP falls unless MAP rises to compensate - which is exactly why the body generates the hypertension of Cushing triad. Lowering that blood pressure without a specific order can drop the CPP and cause cerebral ischemia.' }
    ],

    orders: [
      { text: 'Neuro checks every hour', category: 'monitoring' },
      { text: 'Maintain head of bed at 30 degrees', category: 'monitoring' },
      { text: 'Seizure precautions - padded side rails, bed in low position, suction and oxygen set up at the bedside, nothing in the mouth during a seizure', category: 'monitoring' },
      { text: 'Aspiration precautions - assess gag and swallow before any oral intake', category: 'monitoring' },
      { text: 'Maintain oxygenation with SpO2 greater than 95 percent (the source chart is typed as "SpO2 <95%"; this must be clarified with the provider - allowing hypoxemia causes cerebral vasodilation and directly raises ICP)', category: 'respiratory' },
      { text: 'Strict intake and output', category: 'monitoring' },
      { text: '0.9 percent Sodium Chloride 75 mL/hr - running since today 1000', category: 'medication' },
      { text: 'Acetaminophen 650 mg PO for pain - given today 0800', category: 'medication' },
      { text: 'Mannitol 20 percent 42 g IV over 30 minutes (pending physician order) - documented as given today 1000', category: 'medication' },
      { text: 'STAT CT head', category: 'imaging' },
      { text: 'Regular diet', category: 'diet' }
    ],

    interventions: [
      { id: 'icp-1', order: 1, action: 'Receive and review the patient chart', rationale: 'The chart documents a headache at 0600, confusion and drowsiness at 0800, and a GCS decline at 1000, plus a CT showing cerebral edema with increasing midline shift. That progression over four hours is the entire clinical story.', category: 'assessment', critical: false, preventsDeterioration: false, atiPearl: 'Read the progress notes in time order. Deterioration lives in the trend.' },
      { id: 'icp-2', order: 3, action: 'Verify patient identity using two identifiers', rationale: 'John Smith, date of birth 06/26/1954. Required before assessment and before administering mannitol, a high-alert medication.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'icp-3', order: 2, action: 'Perform hand hygiene and apply standard precautions', rationale: 'Infection prevention. Fever raises cerebral metabolic rate and cerebral blood flow, which directly increases intracranial pressure in an injured brain.', category: 'intervention', critical: true, preventsDeterioration: false },
      { id: 'icp-4', order: 4, action: 'Perform a focused neurological assessment - level of consciousness and orientation, Glasgow Coma Scale, pupil size, shape, equality and reactivity, motor strength and symmetry in all four extremities, and speech', rationale: 'A change in level of consciousness is the EARLIEST and most sensitive sign of rising intracranial pressure and precedes every vital sign change. Compare directly against the previous shift assessment rather than judging in isolation.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'The first thing to change in rising ICP is level of consciousness. The last is Cushing triad.' },
      { id: 'icp-5', order: 5, action: 'Review provider orders, laboratory findings, and the CT scan report', rationale: 'Sodium 138 and creatinine 1.0 are the baselines that make mannitol safe. The CT report explicitly states cerebral edema with increasing midline shift. Also identify that the oxygen order as typed reads "SpO2 less than 95 percent" and must be clarified.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'icp-6', order: 6, action: 'Recognize and verbalize the manifestations of increased intracranial pressure - headache, declining level of consciousness, vomiting, visual changes, widening pulse pressure, and pupillary changes', rationale: 'Early signs are a decreasing level of consciousness, headache, restlessness, nausea, projectile vomiting without nausea, and visual disturbances. Late signs are Cushing triad, fixed and dilated pupils, and posturing.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'icp-7', order: 7, action: 'Monitor Glasgow Coma Scale trends with hourly neuro checks per order', rationale: 'Score eye opening out of 4, verbal response out of 5, and best motor response out of 6, for a total of 3 to 15. A decline of 2 or more points requires immediate provider notification. A GCS of 8 or less means intubate.', category: 'assessment', critical: true, preventsDeterioration: true, atiPearl: 'GCS 8, intubate. Memorize it.' },
      { id: 'icp-8', order: 8, action: 'Assess pupillary response and ongoing neurological status - size in millimeters, equality, and speed of reaction bilaterally', rationale: 'A new sluggish, unequal, or fixed and dilated pupil indicates oculomotor nerve compression from an expanding mass, on the SAME side as the lesion. This is a herniation warning and must be reported immediately.', category: 'assessment', critical: true, preventsDeterioration: true },
      { id: 'icp-9', order: 9, action: 'Prioritize interventions using the ABCs and implement ICP-lowering positioning - maintain the head of bed at 30 degrees per order, keep the head and neck in NEUTRAL midline alignment, avoid hip and neck flexion, ensure no tight cervical collar or tracheostomy ties, maintain oxygenation above 95 percent, provide a quiet dim environment, and space nursing care to avoid clustering', rationale: 'Head of bed at 30 degrees with neutral alignment promotes venous drainage through the jugular veins. Turning or flexing the head kinks the jugular and immediately raises ICP. Hypoxemia and hypercapnia cause cerebral vasodilation, which increases cerebral blood volume and raises ICP further. Clustered care produces cumulative pressure spikes.', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Head midline, HOB 30, oxygen up, room quiet, care spaced out. All free, all nursing-initiated.' },
      { id: 'icp-9b', order: 10, action: 'Implement seizure and aspiration precautions - pad the side rails, keep the bed in the low position, ensure functioning suction and an oxygen source are set up at the bedside, remove clutter, and do not place anything in the mouth if a seizure occurs',
        rationale: 'Post-traumatic seizure is common with cerebral edema and midline shift. A seizure causes an abrupt ICP spike, apnea, and aspiration. This patient has already vomited once and has a declining level of consciousness, so the airway is already at risk. These are independent nursing actions that require no order.',
        category: 'intervention', critical: true, preventsDeterioration: true,
        atiPearl: 'Suction at the bedside BEFORE you need it. In a head injury, a seizure is not a surprise - it is an expectation.' },
      { id: 'icp-10', order: 11, action: 'Implement provider orders - hourly neuro checks, head of bed 30 degrees, oxygen to keep SpO2 above 95 percent after clarifying the order, strict intake and output, 0.9 percent sodium chloride at 75 mL/hr, acetaminophen 650 mg PO for pain and fever, and ensure the STAT CT head is completed', rationale: 'Isotonic 0.9 percent sodium chloride is used deliberately - hypotonic fluids move water into brain cells and worsen cerebral edema. Acetaminophen also treats fever, which lowers cerebral metabolic demand. Strict output is essential once osmotic diuresis begins.', category: 'medication', critical: true, preventsDeterioration: true, atiPearl: 'Never hang D5W or 0.45 percent sodium chloride in a patient with cerebral edema.' },
      { id: 'icp-11', order: 12, action: 'Communicate significant findings using SBAR and activate the Rapid Response Team', rationale: 'Report the GCS trend from 15 to 12, the widening pulse pressure, the new unequal pupils, the vomiting, and the CT showing increasing midline shift. Request neurosurgery, confirmation of the mannitol order, an arterial line and possible ICP monitoring, and ICU transfer.', category: 'communication', critical: true, preventsDeterioration: true },
      { id: 'icp-12', order: 13, action: 'Prepare for and administer Mannitol 20 percent 42 g IV over 30 minutes - verify the physician order since the chart lists it as pending, confirm the dose of 0.5 g/kg for 84 kg, calculate the volume (20 percent equals 20 g per 100 mL, so 42 g equals 210 mL, infused over 30 minutes equals 420 mL/hr), inspect the vial for crystals, use an in-line filter, verify a dedicated patent IV line, obtain baseline serum sodium and osmolality, and ensure a urinary catheter and strict output are in place', rationale: 'Mannitol is an osmotic diuretic that pulls water out of edematous brain tissue into the vasculature and then excretes it renally. It is high-alert: it can cause profound diuresis, hypovolemia, hypotension, electrolyte derangement, and acute kidney injury. Mannitol crystallizes at room temperature, so it must be inspected and filtered. Administering a medication charted as pending without confirming the order is a medication error.', category: 'medication', critical: true, preventsDeterioration: true, atiPearl: 'Mannitol: filter it, dedicate the line, catheterize the patient, and hold if serum osmolality is above 320.' },
      { id: 'icp-13', order: 14, action: 'Escalate care appropriately - anticipate intubation for a GCS of 8 or less, prepare for ICU transfer and possible ICP monitor or decompressive craniectomy, and keep the family informed', rationale: 'Increasing midline shift with a declining GCS is a neurosurgical emergency. Definitive management requires airway control, ICP monitoring, and possible surgical decompression. Delay converts a survivable injury into permanent damage or death.', category: 'escalation', critical: true, preventsDeterioration: true }
    ],

    medications: [
      { name: 'Mannitol 20 percent', brand: 'Osmitrol', classification: 'Osmotic diuretic - hyperosmolar therapy', dose: '42 g IV over 30 minutes (0.5 g/kg for 84 kg). 20 percent solution equals 20 g per 100 mL, so 42 g equals 210 mL; over 30 minutes the pump rate is 420 mL/hr. Charted as given today 1000 but listed in the orders as PENDING physician order.', action: 'Creates an osmotic gradient across the intact blood-brain barrier that draws water out of edematous brain tissue into the intravascular space; the water is then excreted by the kidneys, reducing cerebral edema and intracranial pressure', onset: '15 to 30 minutes; peak ICP reduction at about 1 hour; duration 3 to 8 hours', sideEffects: ['Profound diuresis with hypovolemia and hypotension', 'Electrolyte imbalance including hyponatremia or hypernatremia and hypokalemia', 'Acute kidney injury', 'Rebound increase in ICP', 'Pulmonary edema in patients with heart failure', 'Crystallization of the solution'], nursingConsiderations: ['VERIFY the physician order before administering - the chart lists it as pending', 'Inspect the vial and tubing for crystals; if present, warm the vial per policy to redissolve, and always use an in-line filter (0.22 micron or per policy)', 'Administer through a dedicated patent IV line - extravasation causes tissue necrosis', 'Do not administer with blood products through the same line', 'Insert an indwelling urinary catheter and maintain strict hourly intake and output', 'Monitor serum sodium and serum osmolality; goal osmolality is generally 300 to 320 mOsm/kg and mannitol is typically held above 320', 'Monitor blood pressure - excessive diuresis can drop the MAP and therefore the cerebral perfusion pressure', 'Reassess the neurologic exam and pupils 30 to 60 minutes after the infusion to document response', 'Watch for rebound ICP elevation as the drug wears off'], atiTip: 'Mannitol works only when the blood-brain barrier is intact. Filter it, dedicate the line, catheterize the patient, and check the osmolality.', highAlert: true },
      { name: 'Acetaminophen', brand: 'Tylenol', classification: 'Non-opioid analgesic and antipyretic', dose: '650 mg PO for pain (given today 0800)', action: 'Central inhibition of prostaglandin synthesis; relieves headache and lowers fever', onset: '30 to 60 minutes PO', sideEffects: ['Hepatotoxicity in overdose', 'Rare rash'], nursingConsiderations: ['Maximum 3 to 4 g in 24 hours from ALL sources including combination products', 'Preferred over opioids in traumatic brain injury because it does not sedate and therefore does not mask the neurologic exam', 'Treating fever is an ICP intervention - every degree of fever raises cerebral metabolic rate and cerebral blood flow', 'Assess the ability to swallow safely before any oral medication in a patient whose level of consciousness is declining'], atiTip: 'In neuro patients, control pain and fever without clouding the neuro exam.', highAlert: false },
      { name: '0.9 percent Sodium Chloride', brand: 'Normal Saline', classification: 'Isotonic crystalloid IV fluid', dose: '75 mL/hr continuous IV (running since today 1000)', action: 'Maintains intravascular volume and cerebral perfusion pressure without shifting free water into brain tissue', onset: 'Immediate', sideEffects: ['Fluid overload', 'Hyperchloremic metabolic acidosis'], nursingConsiderations: ['ISOTONIC fluid is chosen deliberately - hypotonic solutions such as D5W and 0.45 percent sodium chloride move free water into brain cells and worsen cerebral edema', 'The relatively conservative 75 mL/hr rate maintains euvolemia without overhydration', 'Maintain strict intake and output, especially once mannitol diuresis begins', 'Avoid hypotension - a falling MAP lowers cerebral perfusion pressure'], atiTip: 'Isotonic only in cerebral edema. D5W is essentially free water and is contraindicated.', highAlert: false },
      { name: 'Hypertonic Saline (3 percent)', brand: 'n/a', classification: 'Hyperosmolar therapy - ALTERNATIVE therapy, not currently ordered', dose: 'Typically given as a bolus or infusion titrated to serum sodium goal', action: 'Raises serum osmolality to draw water out of brain tissue, similar to mannitol, but expands rather than depletes intravascular volume', onset: 'Minutes', sideEffects: ['Hypernatremia', 'Fluid overload', 'Phlebitis and tissue injury if extravasated', 'Central pontine myelinolysis with overly rapid correction'], nursingConsiderations: ['Often preferred over mannitol in a hypotensive or hypovolemic patient because it does not cause diuresis', 'Concentrations above 3 percent generally require central venous access', 'Monitor serum sodium frequently per protocol'], atiTip: 'Mannitol pulls water out and dumps it in the urine. Hypertonic saline pulls water out and keeps the volume.', highAlert: true }
    ],

    sbar: {
      situation: 'This is the RN on the Neuro Step-Down Unit calling a Rapid Response on Mr. John Smith, a 72-year-old male admitted last night at 2200 after a motor vehicle accident with a traumatic brain injury. His Glasgow Coma Scale is declining and I am concerned about increasing intracranial pressure.',
      background: 'He was admitted yesterday at 2200 following the accident. At 0600 he complained of a headache, at 0800 he was noted to have mild confusion and drowsiness and received acetaminophen 650 mg PO, and at 1000 a GCS decline was documented. His STAT CT head shows cerebral edema with increasing midline shift. He is Full Code, has no known drug allergies, weighs 84 kg, and is on 0.9 percent sodium chloride at 75 mL/hr. Mannitol 20 percent 42 g IV over 30 minutes is listed as pending your order.',
      assessment: 'At 0600 he was 128/78 with a heart rate of 84, respiratory rate 18, temp 99.4, SpO2 97 percent, alert and oriented times four. At 0900 he was 138/84, heart rate 88, respiratory rate 18, temp 99.0, SpO2 96 percent, drowsy and mildly confused. He is now lethargic and oriented to person only with a GCS of about 12, his blood pressure is 152/78 so his pulse pressure has widened from 50 to 74, his left pupil is 4 mm and sluggish while the right is 3 mm and brisk, and he vomited once without nausea. His sodium is 138 and his creatinine is 1.0.',
      recommendation: 'I have him with the head of bed at 30 degrees, head midline, oxygen on, and the room quiet with care spaced out. I need you at the bedside now. I recommend confirming the mannitol 20 percent 42 g IV order so I can give it, an immediate neurosurgery consult, repeat CT imaging, serum sodium and osmolality, an indwelling urinary catheter for strict output, ICP monitoring, and ICU transfer. Please also clarify the oxygen order, which is typed as SpO2 less than 95 percent. If his GCS reaches 8 he will need to be intubated.'
    },

    questions: [
      { id: 'ms2-icp-q1', text: 'Which assessment finding is the EARLIEST indicator of increasing intracranial pressure?', type: 'multiple-choice',
        options: ['Fixed and dilated pupils', 'A change in level of consciousness', 'Bradycardia', 'Decerebrate posturing'],
        correct: [1], rationale: 'A change in level of consciousness - restlessness, irritability, drowsiness, confusion, or slowed responses - is the earliest and most sensitive sign of increasing intracranial pressure. Fixed pupils, bradycardia, and posturing are all LATE findings that appear after compensation has failed. This patient showed exactly that sequence: headache at 0600, confusion and drowsiness at 0800, GCS decline at 1000.',
        atiPearl: 'LOC changes first. Vital signs change last.', difficulty: 'Easy' },
      { id: 'ms2-icp-q2', text: 'The nurse notes a blood pressure of 168/64, a heart rate of 62, and slow irregular respirations. What does this represent?', type: 'multiple-choice',
        options: ['Cushing triad, a late sign of severely elevated intracranial pressure', 'Early compensated hypovolemic shock', 'A normal response to pain medication', 'An expected finding twelve hours after trauma'],
        correct: [0], rationale: 'Cushing triad is hypertension with a WIDENING pulse pressure (168 minus 64 equals 104), BRADYCARDIA, and IRREGULAR or slowed respirations. It is a late and ominous sign of severely elevated intracranial pressure with impending brainstem herniation and requires immediate escalation. Note that shock produces the opposite pattern: low blood pressure with tachycardia.',
        atiPearl: 'Cushing triad: BP up with wide pulse pressure, HR down, respirations irregular. Late and dangerous.', difficulty: 'Medium' },
      { id: 'ms2-icp-q3', text: 'Which nursing actions help REDUCE intracranial pressure? Select all that apply.', type: 'select-all',
        options: ['Maintain the head of bed at 30 degrees', 'Keep the head and neck in neutral midline alignment', 'Cluster all nursing care together to give the patient long rest periods', 'Maintain a quiet environment with dim lighting', 'Suction the airway routinely every hour', 'Prevent hypoxemia and hypercapnia'],
        correct: [0, 1, 3, 5], rationale: 'Head of bed at 30 degrees with neutral alignment promotes jugular venous drainage. A quiet, dim environment reduces stimulation. Preventing hypoxemia and hypercapnia prevents cerebral vasodilation, which would raise cerebral blood volume and ICP. Clustering care produces cumulative ICP spikes and should be avoided - care is SPACED instead. Routine suctioning raises ICP sharply and is done only when indicated, limited to 10 seconds, with hyperoxygenation before and after.',
        atiPearl: 'Space care, do not cluster it. Every stimulus adds pressure.', difficulty: 'Medium' },
      { id: 'ms2-icp-q4', text: 'The provider confirms the order for mannitol 20 percent 42 g IV over 30 minutes for this 84 kg patient. A 20 percent solution contains 20 g per 100 mL. What volume will the nurse infuse, and at what pump rate?', type: 'multiple-choice',
        options: ['84 mL at 168 mL/hr', '210 mL at 420 mL/hr', '420 mL at 210 mL/hr', '42 mL at 84 mL/hr'],
        correct: [1], rationale: '20 percent means 20 g per 100 mL, so 42 g divided by 20 g per 100 mL equals 210 mL. Infusing 210 mL over 30 minutes means 210 mL times 2 equals 420 mL/hr on the pump. The ordered dose of 42 g also checks out as 0.5 g/kg for an 84 kg patient, which is a standard mannitol dose for increased ICP.',
        atiPearl: 'Always verify a weight-based dose independently: 0.5 g/kg times 84 kg equals 42 g.', difficulty: 'Hard' },
      { id: 'ms2-icp-q5', text: 'Before administering mannitol, which assessments and preparations are essential? Select all that apply.', type: 'select-all',
        options: ['Inspect the solution for crystals and use an in-line filter', 'Obtain a baseline serum sodium and serum osmolality', 'Ensure an indwelling urinary catheter or a reliable method of hourly output measurement', 'Mix the mannitol with the running blood product to save a line', 'Verify a patent dedicated IV line', 'Verify that the physician order exists, since the chart lists it as pending'],
        correct: [0, 1, 2, 4, 5], rationale: 'Mannitol crystallizes at room temperature and must be inspected and filtered. Baseline sodium and osmolality guide therapy, and mannitol is typically held if the osmolality exceeds 320 mOsm/kg. Profound osmotic diuresis requires accurate hourly output measurement. A dedicated patent line prevents extravasation and tissue necrosis. Verifying an order that the chart lists as pending is a fundamental safety check. Mannitol must never be co-administered with blood products.',
        atiPearl: 'Pending is not an order. Verify before you push.', difficulty: 'Hard' },
      { id: 'ms2-icp-q6', text: 'Which IV fluid is CONTRAINDICATED in a patient with cerebral edema?', type: 'multiple-choice',
        options: ['0.9 percent sodium chloride', 'Dextrose 5 percent in water', 'Lactated Ringer solution', '3 percent sodium chloride'],
        correct: [1], rationale: 'D5W is effectively free water once the dextrose is metabolized. It is hypotonic relative to plasma, so it shifts water into brain cells and worsens cerebral edema and intracranial pressure. Isotonic 0.9 percent sodium chloride is the standard maintenance fluid, and hypertonic 3 percent saline is a treatment for cerebral edema.',
        atiPearl: 'Never hang D5W or 0.45 percent sodium chloride in a brain-injured patient.', difficulty: 'Medium' },
      { id: 'ms2-icp-q7', text: 'The patient\'s left pupil is now 5 mm and sluggish while the right remains 3 mm and brisk. What does this indicate?', type: 'multiple-choice',
        options: ['A normal variant present in about 20 percent of adults', 'Compression of the left oculomotor nerve by an expanding mass, indicating impending herniation', 'A side effect of the acetaminophen', 'Improvement in the patient\'s neurological status'],
        correct: [1], rationale: 'A new unilaterally dilated and sluggish pupil reflects compression of cranial nerve III by an expanding mass, classically from uncal herniation. The pupil dilates on the SAME side as the lesion. In a patient with a documented midline shift and a declining GCS this is a neurosurgical emergency requiring immediate escalation - not a normal variant and not a medication effect.',
        atiPearl: 'A new blown pupil in a head-injured patient means call now, not at the next neuro check.', difficulty: 'Medium' },
      { id: 'ms2-icp-q8', text: 'The patient\'s Glasgow Coma Scale is now 8. What does this indicate about airway management?', type: 'multiple-choice',
        options: ['He can protect his own airway and needs only oxygen by nasal cannula', 'He requires endotracheal intubation for airway protection', 'He should be positioned prone to protect the airway', 'He needs an oral airway and nothing further'],
        correct: [1], rationale: 'A GCS of 8 or less means the patient cannot reliably protect his airway and is at high risk for aspiration and hypoventilation. Hypoventilation raises PaCO2, which causes cerebral vasodilation and further increases intracranial pressure, creating a lethal cycle. Endotracheal intubation is indicated. Prone positioning would be dangerous and would impede venous drainage.',
        atiPearl: 'GCS 8, intubate.', difficulty: 'Medium' },
      { id: 'ms2-icp-q9', text: 'The order in the chart reads "Maintain oxygen SpO2 <95%." What is the nurse\'s BEST action?', type: 'multiple-choice',
        options: ['Follow the order exactly as written and titrate oxygen down', 'Ignore the order entirely and document that it was unclear', 'Contact the provider to clarify the order, because hypoxemia causes cerebral vasodilation and increases intracranial pressure', 'Ask another nurse what she thinks the provider meant and act on that'],
        correct: [2], rationale: 'The order as typed would allow hypoxemia, which causes cerebral vasodilation, increases cerebral blood volume, and directly raises intracranial pressure. Nurses are professionally and legally obligated to clarify any order that is unclear, incomplete, or unsafe before carrying it out. Following an unsafe order, ignoring it silently, or acting on a colleague\'s guess are all unacceptable.',
        atiPearl: 'If an order does not make clinical sense, it is not a typo you get to interpret. Call and clarify.', difficulty: 'Hard' },
      { id: 'ms2-icp-q10', text: 'Cerebral perfusion pressure is calculated as MAP minus ICP. If the patient\'s MAP is 90 mmHg and his ICP is 25 mmHg, what is his CPP and how should the nurse interpret it?', type: 'multiple-choice',
        options: ['CPP 65 mmHg - at the lower edge of the acceptable 60 to 70 mmHg goal and must be protected', 'CPP 115 mmHg - dangerously high and requires immediate blood pressure reduction', 'CPP 25 mmHg - incompatible with life', 'CPP cannot be estimated without an arterial line'],
        correct: [0], rationale: '90 minus 25 equals a CPP of 65 mmHg, which sits at the low end of the 60 to 70 mmHg goal. Below about 60 mmHg cerebral ischemia begins. This is why the hypertension seen in Cushing triad must not be lowered without a specific order - it is the body maintaining perfusion against a rising ICP. Normal ICP is 5 to 15 mmHg, so 25 is elevated.',
        atiPearl: 'CPP equals MAP minus ICP. If you drop the MAP, you drop the CPP.', difficulty: 'Hard' },
      { id: 'ms2-icp-q11', text: 'Which activity should the nurse teach the patient and family to AVOID because it increases intracranial pressure?', type: 'multiple-choice',
        options: ['Speaking quietly to the patient', 'Straining to have a bowel movement, coughing forcefully, or bearing down', 'Keeping the head of bed elevated at 30 degrees', 'Dimming the lights in the room'],
        correct: [1], rationale: 'Any Valsalva maneuver - straining at stool, forceful coughing, vomiting, or bearing down - raises intrathoracic pressure, impedes jugular venous return from the head, and produces a sharp spike in intracranial pressure. Stool softeners are given for this reason. Quiet speech, head of bed at 30 degrees, and dim lighting are all ICP-lowering measures.',
        atiPearl: 'Stool softeners are an ICP intervention. Prevent the strain before it happens.', difficulty: 'Medium' },
      { id: 'ms2-icp-q12', text: 'Which change in motor response indicates the MOST serious neurological deterioration?', type: 'multiple-choice',
        options: ['Localizing to painful stimuli', 'Withdrawing from painful stimuli', 'Progression from decorticate to decerebrate posturing', 'Following simple commands'],
        correct: [2], rationale: 'Motor responses deteriorate in a predictable order: following commands, localizing pain, withdrawing from pain, decorticate flexion, decerebrate extension, then flaccidity. Decorticate posturing means the arms flex toward the CORE and indicates damage above the brainstem. Decerebrate means rigid extension and indicates the injury has descended into the brainstem, which carries a much worse prognosis. Progression between the two is a critical finding requiring immediate escalation.',
        atiPearl: 'deCORticate equals arms to the CORE. deCEREBRATE is worse - the injury has reached the brainstem.', difficulty: 'Hard' }
    ],

    keyPoints: [
      'The Monro-Kellie doctrine: the skull is a fixed box containing brain, blood, and cerebrospinal fluid - if one increases, another must decrease or pressure rises',
      'Normal ICP is 5 to 15 mmHg; sustained pressure above 20 mmHg requires treatment',
      'CPP equals MAP minus ICP, with a goal of 60 to 70 mmHg',
      'A change in level of consciousness is the EARLIEST sign of rising ICP',
      'Cushing triad - hypertension with widening pulse pressure, bradycardia, and irregular respirations - is a LATE sign of impending herniation',
      'Glasgow Coma Scale: eye 4, verbal 5, motor 6, total 3 to 15. GCS 8 means intubate. A drop of 2 or more points means call the provider',
      'A new unilaterally dilated pupil is on the SAME side as the expanding lesion',
      'Head of bed 30 degrees with the head in NEUTRAL midline alignment promotes venous drainage',
      'Hypoxemia and hypercapnia cause cerebral vasodilation and raise ICP',
      'Mannitol 20 percent contains 20 g per 100 mL; 42 g equals 210 mL; over 30 minutes that is 420 mL/hr',
      'Isotonic fluids only - hypotonic fluids worsen cerebral edema'
    ],

    pearls: [
      'Restlessness in a head-injured patient is a neurological sign, not misbehavior - never restrain or sedate it away without evaluating',
      'Projectile vomiting WITHOUT nausea is classic for increased ICP',
      'Space nursing care instead of clustering it - each stimulus stacks another ICP spike',
      'Suction only when indicated, limit to 10 seconds, and hyperoxygenate before and after',
      'Do not treat the hypertension of Cushing triad without a specific order - it is maintaining cerebral perfusion',
      'Avoid opioids and sedatives that mask the neurologic exam when a non-sedating option exists',
      'Fever raises cerebral metabolic demand - treat it aggressively',
      'Mannitol crystallizes. Look at the bag and use a filter, every time'
    ],

    successChecklist: [
      'Review the chart including the 0600, 0800, and 1000 notes and the CT report',
      'Verify identity with two identifiers and perform hand hygiene',
      'Perform a complete focused neuro assessment - LOC, GCS, pupils, motor strength in all four extremities',
      'Compare the current GCS directly against the previous documented score',
      'Assess pupils for size in millimeters, equality, and reactivity bilaterally',
      'Maintain the head of bed at 30 degrees with the head and neck in neutral midline alignment',
      'Maintain oxygenation above 95 percent and clarify the ambiguous oxygen order with the provider',
      'Maintain a quiet, dim environment and space nursing care',
      'Implement seizure and aspiration precautions with suction set up at the bedside',
      'Maintain strict intake and output and the 0.9 percent sodium chloride at 75 mL/hr',
      'Verify the mannitol order, calculate 42 g as 210 mL at 420 mL/hr, inspect for crystals, and use a filter and a dedicated line',
      'Obtain baseline serum sodium and osmolality before mannitol',
      'Deliver a complete SBAR and activate the Rapid Response Team',
      'Anticipate intubation at a GCS of 8, neurosurgery consult, and ICU transfer'
    ],

    criticalErrors: [
      'Lowering the head of bed below 30 degrees or laying the patient flat',
      'Turning the head to the side or allowing neck or hip flexion, which obstructs jugular venous drainage',
      'Clustering all nursing care together instead of spacing interventions',
      'Suctioning routinely, for longer than 10 seconds, or without hyperoxygenation',
      'Administering hypotonic IV fluid such as D5W or 0.45 percent sodium chloride',
      'Administering mannitol without verifying the order that the chart lists as pending',
      'Administering mannitol without an in-line filter or without inspecting for crystals',
      'Administering mannitol without a means of measuring hourly urine output',
      'Co-administering mannitol with blood products or through a non-dedicated line',
      'Treating the hypertension of Cushing triad with an antihypertensive without a specific order, which drops cerebral perfusion pressure',
      'Giving opioids or sedatives that mask the neurologic exam',
      'Allowing or causing a Valsalva maneuver - straining, forceful coughing, or bearing down',
      'Following the order as typed and permitting an SpO2 below 95 percent instead of clarifying it',
      'Delaying provider notification for a GCS drop of 2 or more points or a new unequal pupil',
      'Documenting the neuro change without escalating it',
      'Failing to set up suction and seizure precautions for a patient with cerebral edema, midline shift, and a declining GCS'
    ],

    comparisons: [
      { title: 'Early vs Late Signs of Increased ICP', headers: ['Early Signs', 'Late Signs'],
        rows: [
          ['Decreasing level of consciousness, restlessness, irritability', 'Cushing triad - widening pulse pressure, bradycardia, irregular respirations'],
          ['Headache, often worse in the morning', 'Fixed and dilated pupil, then bilateral fixed pupils'],
          ['Nausea and projectile vomiting without nausea', 'Decorticate then decerebrate posturing'],
          ['Blurred or double vision, pupillary sluggishness', 'Cheyne-Stokes then ataxic respirations'],
          ['Subtle confusion and slowed responses', 'Coma, flaccidity, loss of brainstem reflexes'],
          ['Slight pupil inequality', 'Central hyperthermia from hypothalamic involvement']
        ] },
      { title: 'Cushing Triad vs Hypovolemic Shock', headers: ['Parameter', 'Cushing Triad (increased ICP)', 'Hypovolemic Shock'],
        rows: [
          ['Blood pressure', 'HIGH systolic with WIDENING pulse pressure', 'LOW with NARROWING pulse pressure'],
          ['Heart rate', 'BRADYCARDIA', 'TACHYCARDIA'],
          ['Respirations', 'Slow, irregular, Cheyne-Stokes', 'Rapid and shallow'],
          ['Skin', 'Usually warm and dry', 'Cool, pale, clammy'],
          ['Meaning', 'The brain is being compressed - herniation risk', 'Volume loss - fluid and blood needed'],
          ['Action', 'Reduce ICP, do NOT lower the blood pressure without an order', 'Restore volume']
        ] },
      { title: 'Mannitol vs Hypertonic Saline', headers: ['Feature', 'Mannitol 20 percent', 'Hypertonic Saline 3 percent'],
        rows: [
          ['Mechanism', 'Osmotic diuretic - pulls water out and excretes it', 'Raises serum osmolality - pulls water out and retains volume'],
          ['Volume effect', 'Causes diuresis and can cause hypovolemia and hypotension', 'Expands intravascular volume'],
          ['Best when', 'Patient is euvolemic with adequate renal function', 'Patient is hypotensive or hypovolemic'],
          ['Key monitoring', 'Serum osmolality (hold above 320), sodium, urine output, renal function', 'Serum sodium, fluid overload, IV site integrity'],
          ['Administration caution', 'Filter required, crystallizes, dedicated line', 'Concentrations above 3 percent usually need central access']
        ] }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'My head... it really hurts. What time is it? Is it still morning? I keep losing track.' },
      { speaker: 'patient', trigger: 'pain', line: 'It is a deep pounding, right behind my eyes. Maybe a six. The light in here is making it worse, can you turn it down?' },
      { speaker: 'patient', trigger: 'orientation', line: 'John. John Smith. I know my name. But I could not tell you what day it is. Was I in a car? Somebody said there was a car.' },
      { speaker: 'patient', trigger: 'vision', line: 'Things are going double when I try to look at you. And I feel like I am going to be sick... wait...' },
      { speaker: 'patient', trigger: 'breathing', line: 'Breathing is fine. It is my head. Just let me sleep. I am so tired. Please just let me close my eyes.' },
      { speaker: 'patient', trigger: 'intervention', line: 'Do not move me. Every time you move my head it feels like it is going to split open.' },
      { speaker: 'family', trigger: 'greeting', line: 'I am his daughter. He was talking to me completely normally at six this morning. Now he does not know what day it is. That is not him. Something is wrong.' },
      { speaker: 'family', trigger: 'escalation', line: 'Why is he so sleepy? The night nurse said he was fine. Is the bleeding getting worse in there? Please tell me what the CT scan showed.' },
      { speaker: 'family', trigger: 'education', line: 'You keep shining that light in his eyes and asking him the same questions. Is that helping him? Can you not just let him rest?' },
      { speaker: 'family', trigger: 'medication', line: 'What is that medication you are hanging? Will it fix the swelling in his brain? Is he going to be himself again?' }
    ],

    patientEducation: [
      'Explain to the family why the nurse must wake the patient for hourly neuro checks - the level of consciousness is the earliest warning sign and letting him sleep through it could miss deterioration',
      'Explain the purpose of the light in the eyes and the repeated orientation questions as pupil and mental status monitoring, not as an annoyance',
      'Teach the patient and family to keep the head of bed at 30 degrees and the head in a straight midline position, and not to turn the head to the side',
      'Teach the patient to avoid straining, bearing down, forceful coughing, or holding his breath during movement, and explain why stool softeners are given',
      'Explain that a quiet, dimly lit room with limited visitors and spaced-out care is a treatment, not a restriction',
      'Explain the purpose of mannitol in plain language - it draws excess water out of the swollen brain and the patient will urinate a large amount',
      'Instruct the family to report immediately any increase in sleepiness, new confusion, worsening headache, vomiting, weakness on one side, or seizure activity',
      'Prepare the patient and family for possible intubation, ICU transfer, ICP monitoring, or surgery, and revisit code status',
      'For the recovery phase, teach fall precautions, seizure precautions, and gradual return to activity with cognitive rest'
    ]
  }

];
