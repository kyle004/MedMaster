/* =============================================================================
 * scenarios-peds.js - Pediatric simulation scenarios (MedMaster Simulation Engine)
 * -----------------------------------------------------------------------------
 * Global defined by this file:
 *   SCENARIOS_PEDS (on the global window object) - array of 4 pediatric
 *   simulation scenario objects
 *
 * Sources (verbatim clinical data pulled from):
 *   _staging/PEDS_Simulation_1.txt - Acute Asthma Exacerbation, 8 y/o, 30 kg
 *   _staging/PEDS_Simulation_2.txt - Moderate Dehydration / Acute Gastroenteritis
 *   _staging/PEDS_Simulation_3.txt - DKA / New-Onset Type 1 Diabetes Mellitus
 *   _staging/PEDS_Simulation_4.txt - RSV Bronchiolitis with High Fever, 2 y/o, 12 kg
 *
 * All vitals, labs, orders and medications are taken directly from the source
 * study guides. Where a source guide supplied only one set of vital signs, the
 * vitalsTimeline extends it into a clinically realistic deterioration
 * trajectory using age-appropriate pediatric parameters; each entry's `note`
 * states what is changing and why.
 *
 * Age-appropriate reference ranges used for the timelines:
 *   School-age (6-12 yr): HR 70-110, RR 18-25, SBP 95-115, SpO2 95-100
 *   Toddler   (1-3 yr):  HR 90-140, RR 24-40, SBP 86-106, SpO2 95-100
 * ========================================================================== */

window.SCENARIOS_PEDS = [

  /* ===========================================================================
   * 1. ACUTE ASTHMA EXACERBATION
   * ======================================================================== */
  {
    id: 'peds-asthma',
    title: 'Acute Asthma Exacerbation',
    fullTitle: 'Acute Asthma Exacerbation in an 8-Year-Old Child',
    category: 'PEDS',
    course: 'NUR2310C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'LUNGS',
    summary: 'An 8-year-old with a viral URI trigger presents in moderate-to-severe asthma exacerbation with SpO2 89% on room air. Focus is oxygenation, positioning, bronchodilator therapy, and recognizing impending respiratory failure.',
    highYield: true,

    objectives: [
      'Perform a focused respiratory assessment',
      'Assess oxygenation and ventilation',
      'Recognize respiratory distress',
      'Administer oxygen and bronchodilators',
      'Monitor for respiratory failure',
      'Interpret laboratory and diagnostic tests',
      'Communicate using SBAR',
      'Educate the child and caregivers',
      'Escalate care appropriately'
    ],

    patient: {
      name: 'John Smith',
      age: '8 years',
      sex: 'Male',
      weightKg: 30,
      allergies: ['Peanut'],
      codeStatus: 'Full Code',
      diagnosis: 'Acute Asthma Exacerbation',
      history: [
        'Cold symptoms for several days',
        'Rescue inhaler every few hours with minimal relief',
        'Persistent cough',
        'Wheezing',
        'Increasing fatigue',
        'Difficulty sleeping',
        'Poor appetite',
        'Less active than usual'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - on arrival, room air',
        bp: '112/68', hr: 132, rr: 36, temp: '99.2 F', spo2: 89,
        pain: 'Denies pain; reports chest tightness',
        loc: 'Alert, anxious, speaking in short phrases',
        other: 'Expiratory wheezing bilaterally, intercostal retractions, nasal flaring, prolonged expiratory phase',
        flags: ['hypoxemia', 'tachycardia', 'tachypnea', 'retractions'],
        note: 'Documented sim vitals. SpO2 89 percent is moderate-to-severe hypoxemia for a school-age child (normal 95-100 percent) and requires immediate oxygen. HR 132 and RR 36 are both well above the 8-year-old ranges of 70-110 and 18-25.'
      },
      {
        atMin: 5,
        label: 'Oxygen applied, bronchodilator not yet given',
        bp: '114/70', hr: 138, rr: 38, temp: '99.2 F', spo2: 92,
        pain: 'Chest tightness worsening',
        loc: 'Alert, increasingly anxious and restless, 3-4 word sentences',
        other: 'Still on 2 L/min nasal cannula, tripod positioning, suprasternal retractions, audible wheeze',
        flags: ['hypoxemia', 'worsening', 'accessory-muscle-use'],
        note: 'Oxygen raised SpO2 to 92 percent but the goal is greater than 95 percent. Oxygen does not fix bronchospasm - HR and RR keep rising because airflow obstruction is unchanged. This is the window in which albuterol must be given.'
      },
      {
        atMin: 10,
        label: 'Deterioration - silent chest developing',
        bp: '106/62', hr: 142, rr: 40, temp: '99.4 F', spo2: 88,
        pain: 'Unable to report - cannot speak in sentences',
        loc: 'Anxious then quieting, answering in single words',
        other: 'Wheezing DIMINISHING with markedly decreased air movement, deep retractions, head bobbing, circumoral pallor',
        flags: ['silent-chest', 'severe-hypoxemia', 'worsening', 'air-trapping'],
        note: 'The wheeze is fading NOT because the child is better but because almost no air is moving. Loss of wheeze with rising work of breathing and falling SpO2 is status asthmaticus. Escalate now - Rapid Response.'
      },
      {
        atMin: 15,
        label: 'Impending respiratory failure',
        bp: '96/54', hr: 58, rr: 8, temp: '99.4 F', spo2: 84,
        pain: 'Unable to report',
        loc: 'Sleepy, difficult to arouse',
        other: 'Silent chest, cyanotic lips, poor respiratory effort, rising CO2 on repeat ABG',
        flags: ['silent-chest', 'bradycardia', 'cyanosis', 'altered-loc', 'respiratory-failure'],
        note: 'The classic pediatric crash: a falling heart rate and a falling respiratory rate in a hypoxic child are LATE and ominous, not reassuring. Bradycardia plus decreasing effort plus somnolence equals imminent arrest - prepare for intubation.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'WBC', value: '12.6', unit: 'K/microL', status: 'high',
        normalRange: '5.0-14.5 (school age)',
        interpretation: 'Upper-normal / mildly elevated - reflects viral infection and physiologic stress, not necessarily bacterial infection' },
      { panel: 'CBC', name: 'Hemoglobin', value: '13.2', unit: 'g/dL', status: 'normal',
        normalRange: '11.5-15.5', interpretation: 'Normal - no anemia contributing to hypoxemia' },
      { panel: 'CBC', name: 'Platelets', value: '320,000', unit: '/microL', status: 'normal',
        normalRange: '150,000-400,000', interpretation: 'Normal' },
      { panel: 'BMP', name: 'Sodium', value: '136', unit: 'mEq/L', status: 'normal',
        normalRange: '135-145', interpretation: 'Normal' },
      { panel: 'BMP', name: 'Potassium', value: '4.2', unit: 'mEq/L', status: 'normal',
        normalRange: '3.5-5.0',
        interpretation: 'Normal now - recheck after repeated albuterol, which drives potassium intracellularly' },
      { panel: 'BMP', name: 'BUN', value: '16', unit: 'mg/dL', status: 'normal',
        normalRange: '5-18', interpretation: 'Normal' },
      { panel: 'BMP', name: 'Creatinine', value: '0.5', unit: 'mg/dL', status: 'normal',
        normalRange: '0.3-0.7', interpretation: 'Normal renal function' },
      { panel: 'BMP', name: 'Glucose', value: '118', unit: 'mg/dL', status: 'high',
        normalRange: '70-110',
        interpretation: 'Slightly elevated from stress response; beta-agonists also raise glucose' }
    ],

    diagnostics: [
      { name: 'Respiratory Viral Panel', finding: 'Positive for Rhinovirus',
        interpretation: 'Confirms a viral upper respiratory infection as the trigger, supporting the mother report that the attack began after a cold' },
      { name: 'ECG', finding: 'Sinus tachycardia',
        interpretation: 'Expected from hypoxemia, respiratory distress, anxiety, and beta-agonist therapy - not a primary cardiac problem' },
      { name: 'Portable Chest X-ray', finding: 'Mild hyperinflation, no infiltrates',
        interpretation: 'Hyperinflation is classic for asthma air trapping; absence of infiltrates rules out bacterial pneumonia' },
      { name: 'ABG', finding: 'Ordered - baseline pending',
        interpretation: 'A rising or even normalizing PaCO2 in a tachypneic asthmatic signals fatigue and impending respiratory failure' }
    ],

    orders: [
      { text: 'Oxygen to keep SpO2 greater than 95 percent', category: 'respiratory' },
      { text: 'Continuous cardiac monitoring', category: 'monitoring' },
      { text: 'Continuous respiratory monitoring', category: 'monitoring' },
      { text: 'CBC', category: 'lab' },
      { text: 'BMP', category: 'lab' },
      { text: 'ABG', category: 'lab' },
      { text: 'Respiratory viral panel', category: 'lab' },
      { text: 'Intake and output every hour', category: 'monitoring' },
      { text: 'Two peripheral IVs, largest gauge the child will tolerate (typically 20-22 gauge)', category: 'access' },
      { text: 'NPO', category: 'diet' },
      { text: 'Portable chest X-ray', category: 'imaging' },
      { text: 'Pulmonology consult', category: 'consult' },
      { text: 'Respiratory therapy consult', category: 'consult' },
      { text: 'Nebulized albuterol/ipratropium', category: 'medication' },
      { text: 'Dexamethasone 0.6 mg/kg PO x1 (max 16 mg) OR methylprednisolone 1-2 mg/kg IV', category: 'medication' }
    ],

    interventions: [
      { id: 'asthma-1', order: 1,
        action: 'Assess airway, breathing, and circulation',
        rationale: 'ABCs always come first. In an asthma exacerbation the threat is airflow obstruction - establish that the airway is patent, quantify work of breathing, and auscultate air movement before doing anything else.',
        category: 'assessment', critical: true, preventsDeterioration: false,
        atiPearl: 'ABCs before anything else - always' },
      { id: 'asthma-2', order: 2,
        action: 'Apply oxygen and titrate to keep SpO2 greater than 95 percent',
        rationale: 'SpO2 is 89 percent on room air, which is moderate-to-severe hypoxemia in a child. Oxygen is the fastest correction of tissue hypoxia while bronchodilators are being prepared. Child was placed on 2 L/min via nasal cannula.',
        category: 'intervention', critical: true, preventsDeterioration: true,
        atiPearl: 'Hypoxemia kills before hypercarbia does - oxygen first, then the drug' },
      { id: 'asthma-3', order: 3,
        action: 'Place the child in High Fowler position',
        rationale: 'Upright positioning drops the diaphragm, maximizes lung expansion, and reduces the work of breathing. NEVER lay an asthma patient flat - supine positioning worsens air trapping and respiratory effort.',
        category: 'intervention', critical: true, preventsDeterioration: true,
        atiPearl: 'High Fowler for every child in respiratory distress' },
      { id: 'asthma-4', order: 4,
        action: 'Administer nebulized albuterol',
        rationale: 'Albuterol is the first-line rescue medication. It relaxes bronchial smooth muscle for rapid bronchodilation with onset in 5-15 minutes, directly reversing the bronchoconstriction component.',
        category: 'medication', critical: true, preventsDeterioration: true,
        atiPearl: 'Albuterol equals rescue. Steroids are NOT rescue drugs' },
      { id: 'asthma-5b', order: 5,
        action: 'Administer a systemic corticosteroid within the first hour',
        rationale: 'Albuterol reverses bronchospasm but does nothing to the airway inflammation and mucosal edema that drive the late phase. A systemic steroid given early (dexamethasone 0.6 mg/kg PO, max 16 mg, or methylprednisolone 1-2 mg/kg IV) is standard of care in every moderate-to-severe exacerbation. It is not a rescue drug, but it is time-critical.',
        category: 'medication', critical: true, preventsDeterioration: true,
        atiPearl: 'Steroids are not rescue - but give them in the first hour anyway' },
      { id: 'asthma-5', order: 6,
        action: 'Administer nebulized ipratropium',
        rationale: 'Ipratropium is an anticholinergic bronchodilator that works synergistically with albuterol in moderate-to-severe exacerbations, producing greater bronchodilation than albuterol alone.',
        category: 'medication', critical: true, preventsDeterioration: true,
        atiPearl: 'Ipratropium is added for MODERATE to SEVERE attacks' },
      { id: 'asthma-6', order: 7,
        action: 'Auscultate lung sounds before AND after every treatment',
        rationale: 'Pre and post assessment is the only way to know whether the treatment worked. Improvement equals less wheezing WITH better air movement, easier breathing, and a higher SpO2. Less wheezing with WORSE air movement is deterioration.',
        category: 'assessment', critical: true, preventsDeterioration: false,
        atiPearl: 'Always reassess lung sounds and respiratory status after a bronchodilator' },
      { id: 'asthma-7', order: 8,
        action: 'Monitor continuously for signs of impending respiratory failure and escalate',
        rationale: 'Late signs are diminished or absent breath sounds (silent chest), cyanosis, bradycardia, altered level of consciousness, fatigue, poor respiratory effort, and a rising CO2. Any of these require immediate provider notification or Rapid Response activation.',
        category: 'escalation', critical: true, preventsDeterioration: true,
        atiPearl: 'A child who suddenly stops wheezing may be getting WORSE, not better' }
    ],

    medications: [
      {
        name: 'Albuterol',
        brand: 'Proventil / Ventolin',
        classification: 'Short-acting beta-2 agonist (SABA)',
        dose: 'Nebulized, typically 2.5-5 mg per treatment (0.15 mg/kg/dose, min 2.5 mg)',
        action: 'Relaxes bronchial smooth muscle producing rapid bronchodilation',
        onset: '5-15 minutes',
        sideEffects: ['Tachycardia', 'Tremors', 'Nervousness', 'Palpitations', 'Hyperglycemia', 'Hypokalemia with repeated dosing'],
        nursingConsiderations: [
          'Auscultate lung sounds before and after every treatment',
          'Expect and explain tremor and tachycardia - they are not allergy',
          'Monitor cardiac rhythm during continuous nebulization',
          'Recheck serum potassium after repeated doses'
        ],
        atiTip: 'Always reassess lung sounds and respiratory status after treatment',
        highAlert: false
      },
      {
        name: 'Ipratropium',
        brand: 'Atrovent',
        classification: 'Anticholinergic bronchodilator',
        dose: 'Nebulized, typically 0.25-0.5 mg per treatment, given with albuterol',
        action: 'Blocks muscarinic receptors, reducing vagally mediated bronchoconstriction and secretions; enhances bronchodilation when combined with albuterol',
        onset: '15 minutes, peak 1-2 hours',
        sideEffects: ['Dry mouth', 'Blurred vision if the medication contacts the eyes', 'Cough'],
        nursingConsiderations: [
          'Use a well-fitted mask or mouthpiece to keep the mist out of the eyes',
          'Reserved for moderate to severe exacerbations - it is not a stand-alone rescue drug',
          'Ask about peanut allergy if using the MDI formulation with soya lecithin - this child has a peanut allergy'
        ],
        atiTip: 'Ipratropium is an ADD-ON to albuterol in moderate-to-severe attacks',
        highAlert: false
      },
      {
        name: 'Corticosteroids (prednisolone, methylprednisolone, dexamethasone)',
        brand: 'Orapred / Solu-Medrol / Decadron',
        classification: 'Systemic corticosteroid / anti-inflammatory',
        dose: 'Prednisolone 1-2 mg/kg/day PO; methylprednisolone 1-2 mg/kg IV; dexamethasone 0.6 mg/kg PO (max 16 mg)',
        action: 'Reduces airway inflammation and mucosal edema, the component albuterol cannot touch',
        onset: '4-6 hours for clinical effect - NOT immediate',
        sideEffects: ['Hyperglycemia', 'Mood changes and irritability', 'Increased appetite', 'GI upset', 'Immunosuppression with prolonged use'],
        nursingConsiderations: [
          'Give within the first hour of a moderate-to-severe exacerbation',
          'Give with food to reduce GI upset',
          'Monitor blood glucose, especially with concurrent albuterol',
          'Teach the family not to stop a steroid burst early'
        ],
        atiTip: 'Steroids reduce inflammation but are NOT rescue medications - never substitute a steroid for albuterol in an acute attack',
        highAlert: false
      }
    ],

    dosageCalculations: [
      {
        id: 'peds-asthma-calc1',
        text: 'Albuterol is ordered at 0.15 mg/kg per nebulized treatment. The child weighs 30 kg. How many mg will the nurse give?',
        given: { weight: 30, orderedDose: '0.15 mg/kg' },
        answer: 4.5, unit: 'mg',
        steps: [
          { label: 'Multiply weight by the dose per kg', hint: '30 kg x 0.15 mg/kg', answer: '4.5', unit: 'mg' }
        ],
        safeRange: 'Typical nebulized albuterol 2.5-5 mg per treatment (0.15 mg/kg/dose, minimum 2.5 mg)',
        isSafe: true
      },
      {
        id: 'peds-asthma-calc2',
        text: 'The pharmacy supplies albuterol 0.5 percent nebulizer solution, which is 5 mg/mL. How many mL are needed to deliver the 4.5 mg dose?',
        given: { orderedDose: '4.5 mg', available: '5 mg/mL' },
        answer: 0.9, unit: 'mL',
        steps: [
          { label: 'Set up desired over have', hint: '4.5 mg divided by 5 mg/mL', answer: '0.9', unit: 'mL' },
          { label: 'Dilute in normal saline per protocol', hint: 'Add 0.9 mL of drug to 2.5-3 mL NS in the nebulizer cup', answer: '0.9', unit: 'mL of drug' }
        ],
        safeRange: 'Volume must be measured in a 1 mL syringe; 0.9 mL is a reasonable nebulizer volume',
        isSafe: true
      },
      {
        id: 'peds-asthma-calc3',
        text: 'SAFE DOSE CHECK: The provider writes an order for albuterol 15 mg nebulized now for this 30 kg child. Is this dose safe to give?',
        given: { weight: 30, orderedDose: '15 mg per treatment', safeDoseRange: '0.15 mg/kg/dose, usual 2.5-5 mg per treatment' },
        answer: 4.5, unit: 'mg (the safe calculated dose)',
        steps: [
          { label: 'Calculate the safe dose for this child', hint: '30 kg x 0.15 mg/kg', answer: '4.5', unit: 'mg' },
          { label: 'Compare the order to the safe dose', hint: '15 mg ordered vs 4.5 mg safe - more than 3 times the intended dose', answer: 'Exceeds safe range', unit: '' },
          { label: 'Decide the nursing action', hint: 'Hold the dose and clarify with the prescriber before administering', answer: 'Hold and clarify', unit: '' }
        ],
        safeRange: 'Usual single nebulized dose 2.5-5 mg; 15 mg exceeds the safe single-dose range for a 30 kg child',
        isSafe: false
      },
      {
        id: 'peds-asthma-calc4',
        text: 'SAFE DOSE CHECK: Dexamethasone is ordered at 0.6 mg/kg PO, maximum 16 mg. The child weighs 30 kg. How many mg should the child actually receive?',
        given: { weight: 30, orderedDose: '0.6 mg/kg', maxDose: '16 mg' },
        answer: 16, unit: 'mg',
        steps: [
          { label: 'Multiply weight by the dose per kg', hint: '30 kg x 0.6 mg/kg', answer: '18', unit: 'mg' },
          { label: 'Compare the calculated dose to the stated maximum', hint: '18 mg calculated exceeds the 16 mg ceiling', answer: '18 is greater than 16', unit: '' },
          { label: 'Give the maximum, not the calculated dose', hint: 'When mg/kg exceeds the stated max, the max governs', answer: '16', unit: 'mg' }
        ],
        safeRange: 'Dexamethasone 0.6 mg/kg PO for asthma, not to exceed 16 mg per dose',
        isSafe: true
      }
    ],

    sbar: {
      situation: 'This is the RN caring for John Smith, an 8-year-old admitted with an acute asthma exacerbation. He remains tachypneic with an oxygen saturation of 89 percent on room air.',
      background: 'He has had cold symptoms for several days and has required his rescue inhaler every few hours with minimal relief. He has persistent cough, wheezing, fatigue, and decreased activity.',
      assessment: 'Current vital signs show HR 132, RR 36, SpO2 89 percent on room air. The viral panel is positive for rhinovirus, and chest X-ray shows mild hyperinflation.',
      recommendation: 'Oxygen has been initiated, and nebulized albuterol/ipratropium is ready to administer. I recommend continued respiratory monitoring and reassessment after treatment. Please evaluate if symptoms fail to improve or worsen.'
    },

    questions: [
      {
        id: 'peds-asthma-q1',
        text: 'The nurse enters the room of an 8-year-old in acute asthma exacerbation. Which assessment is the PRIORITY?',
        type: 'multiple-choice',
        options: [
          'Airway patency and breathing effort',
          'Peak expiratory flow rate',
          'History of asthma triggers',
          'Peripheral capillary refill'
        ],
        correct: [0],
        rationale: 'ABCs come first. Airway and breathing are the systems failing in an asthma exacerbation; the peak flow, trigger history, and perfusion assessment all follow after airway and breathing are established.',
        atiPearl: 'Priority assessment in any respiratory sim is always airway and breathing.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-asthma-q2',
        text: 'Which medication is the PRIORITY for this child right now?',
        type: 'multiple-choice',
        options: [
          'Nebulized albuterol',
          'Oral prednisolone',
          'IV methylprednisolone',
          'Nebulized ipratropium alone'
        ],
        correct: [0],
        rationale: 'Albuterol is the first-line rescue medication and produces bronchodilation in 5-15 minutes. Corticosteroids reduce inflammation but take 4-6 hours and are never the rescue drug. Ipratropium is an adjunct, not a stand-alone rescue.',
        atiPearl: 'SABA equals rescue. Steroid equals controller of inflammation.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-asthma-q3',
        text: 'Which assessment finding indicates WORSENING asthma and requires immediate intervention?',
        type: 'multiple-choice',
        options: [
          'Diminished or absent breath sounds with increased work of breathing',
          'Loud expiratory wheezing throughout all lung fields',
          'Respiratory rate of 32 with mild intercostal retractions',
          'Complaint that the chest feels tight'
        ],
        correct: [0],
        rationale: 'A silent chest means air is no longer moving well enough to generate a wheeze. Loud wheezing actually indicates air is still moving. Diminished or absent breath sounds with rising work of breathing is a late, ominous sign of impending respiratory failure.',
        atiPearl: 'No wheeze is more dangerous than a loud wheeze.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-asthma-q4',
        text: 'The child who was previously anxious and wheezing becomes sleepy and quiet, and the wheezing has stopped. What is the nurse interpretation?',
        type: 'multiple-choice',
        options: [
          'Impending respiratory failure - activate the Rapid Response Team',
          'The albuterol has worked and the child is resting',
          'Expected fatigue after the work of breathing',
          'A normal response to supplemental oxygen'
        ],
        correct: [0],
        rationale: 'Somnolence plus a silent chest is the classic pediatric pre-arrest picture. Altered level of consciousness reflects hypoxemia and CO2 retention, not comfort. The nurse must escalate immediately and prepare for advanced airway management.',
        atiPearl: 'A quiet asthmatic child is an emergency until proven otherwise.',
        difficulty: 'Hard'
      },
      {
        id: 'peds-asthma-q5',
        text: 'Based on the diagnostic results, what is the MOST likely trigger for this exacerbation?',
        type: 'multiple-choice',
        options: [
          'Viral upper respiratory infection (rhinovirus)',
          'Exposure to peanut protein',
          'Bacterial pneumonia',
          'Exercise-induced bronchospasm'
        ],
        correct: [0],
        rationale: 'The respiratory viral panel is positive for rhinovirus and the history describes several days of cold symptoms preceding the attack. The chest X-ray shows no infiltrates, ruling out pneumonia. Viral respiratory infection is the most common asthma trigger in children.',
        atiPearl: 'Viral URI is the number one asthma trigger in the pediatric population.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-asthma-q6',
        text: 'Which position is MOST effective for this child?',
        type: 'multiple-choice',
        options: [
          'High Fowler position',
          'Supine with the head of bed flat',
          'Left lateral Sims position',
          'Trendelenburg'
        ],
        correct: [0],
        rationale: 'High Fowler drops the diaphragm, maximizes chest expansion, and decreases work of breathing. Never lay an asthma patient flat - supine and Trendelenburg positions worsen air trapping and respiratory effort.',
        atiPearl: 'Upright equals easier breathing in every pediatric respiratory scenario.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-asthma-q7',
        text: 'Select ALL findings that indicate EARLY signs of respiratory distress in this child.',
        type: 'select-all',
        options: [
          'Tachypnea',
          'Nasal flaring',
          'Intercostal retractions',
          'Bradycardia',
          'Cyanosis',
          'Restlessness and anxiety'
        ],
        correct: [0, 1, 2, 5],
        rationale: 'Tachypnea, nasal flaring, retractions, tachycardia, anxiety, and restlessness are EARLY compensatory signs. Bradycardia and cyanosis are LATE findings indicating decompensation and impending arrest.',
        atiPearl: 'Early equals fast and anxious. Late equals slow, blue, and sleepy.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-asthma-q8',
        text: 'After the albuterol treatment the parent asks why the child hands are shaking and his heart is racing. What is the nurse BEST response?',
        type: 'multiple-choice',
        options: [
          'Tremors and a fast heart rate are common, expected side effects of albuterol and will pass',
          'This is an allergic reaction and we will stop the medication',
          'His asthma is getting worse and we need to call the provider',
          'The oxygen we gave is making his heart race'
        ],
        correct: [0],
        rationale: 'Tremor, tachycardia, nervousness, and palpitations are expected beta-2 agonist effects from beta-1 cross-stimulation. Recognizing them as expected prevents unnecessary alarm and unnecessary discontinuation of a life-saving drug.',
        atiPearl: 'Shaky and fast heart after albuterol equals expected, not allergy.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-asthma-q9',
        text: 'The nurse reviews an ABG on a child who has been tachypneic for two hours. Which result is MOST concerning?',
        type: 'multiple-choice',
        options: [
          'PaCO2 46 mmHg with pH 7.31',
          'PaCO2 28 mmHg with pH 7.48',
          'PaCO2 32 mmHg with pH 7.44',
          'PaCO2 30 mmHg with pH 7.46'
        ],
        correct: [0],
        rationale: 'A tachypneic asthmatic should be blowing OFF CO2, so a low PaCO2 is expected. A normalizing or rising PaCO2 with acidosis means the child can no longer sustain the work of breathing - respiratory muscle fatigue and impending failure.',
        atiPearl: 'A normal CO2 in a severely tachypneic asthmatic is a red flag, not reassurance.',
        difficulty: 'Hard'
      },
      {
        id: 'peds-asthma-q10',
        text: 'The nurse is teaching correct metered-dose inhaler technique. Place the steps in the correct order. Which step comes FIRST?',
        type: 'multiple-choice',
        options: [
          'Shake the inhaler',
          'Press the inhaler once',
          'Exhale fully',
          'Hold the breath for about 10 seconds'
        ],
        correct: [0],
        rationale: 'The sequence is: shake the inhaler, attach the spacer, exhale fully, press the inhaler once, slowly inhale, hold the breath about 10 seconds, then wait about 1 minute before a second puff. Shaking first ensures the drug and propellant are mixed so a full dose is delivered.',
        atiPearl: 'Always teach spacer use with an MDI in children - it doubles lung deposition.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-asthma-q11',
        text: 'Select ALL of the instructions the nurse should give the parents about when to seek EMERGENCY care.',
        type: 'select-all',
        options: [
          'The rescue inhaler is not relieving symptoms',
          'The child cannot speak in full sentences',
          'The lips turn blue',
          'Severe retractions occur',
          'The child becomes sleepy or difficult to arouse',
          'The child coughs once or twice during exercise'
        ],
        correct: [0, 1, 2, 3, 4],
        rationale: 'Rescue inhaler failure, inability to speak in full sentences, cyanosis, severe retractions, and somnolence all indicate severe obstruction or impending failure and require emergency care. An occasional cough with exercise is managed with the prescribed pre-exercise plan, not the emergency department.',
        atiPearl: 'Teach parents concrete, observable red flags - not just the phrase get worse.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-asthma-q12',
        text: 'A child in the emergency department has sudden onset choking while eating peanuts, unilateral decreased breath sounds, and no improvement after a bronchodilator. What does the nurse suspect?',
        type: 'multiple-choice',
        options: [
          'Foreign body aspiration',
          'Status asthmaticus',
          'Bacterial pneumonia',
          'Anaphylaxis'
        ],
        correct: [0],
        rationale: 'Sudden onset while eating, unilateral findings, and failure to respond to a bronchodilator distinguish foreign body aspiration from asthma. Asthma produces bilateral wheezing with a viral or allergen trigger and typically responds at least partially to bronchodilators.',
        atiPearl: 'Sudden plus unilateral plus no bronchodilator response equals foreign body.',
        difficulty: 'Medium'
      }
    ],

    keyPoints: [
      'Asthma has three components: bronchoconstriction, airway inflammation, and increased mucus production',
      'Normal pediatric SpO2 is 95-100 percent; 89 percent is moderate to severe hypoxemia',
      'Albuterol is the first-line rescue drug with an onset of 5-15 minutes',
      'Ipratropium is added for moderate to severe exacerbations',
      'Corticosteroids treat inflammation but take hours - they are not rescue drugs',
      'Silent chest, cyanosis, bradycardia, and altered LOC are LATE signs of respiratory failure',
      'Status asthmaticus is a life-threatening attack that does not improve with initial bronchodilator therapy',
      'Never lay an asthma patient flat - use High Fowler position'
    ],

    pearls: [
      'ABCs first in every pediatric respiratory scenario',
      'High Fowler position',
      'Oxygen to keep SpO2 greater than 95 percent',
      'Albuterol equals first-line rescue medication',
      'Ipratropium for moderate to severe exacerbations',
      'Steroids reduce inflammation but are not immediate rescue medications',
      'Monitor for silent chest - a sign of impending respiratory failure',
      'Use a spacer with metered-dose inhalers',
      'Teach trigger avoidance and when to seek emergency care',
      'A child who suddenly stops wheezing during a severe attack may actually be getting worse because almost no air is moving'
    ],

    successChecklist: [
      'Perform hand hygiene and verify patient identity',
      'Assess airway, breathing, circulation, and mental status',
      'Assess respiratory rate, work of breathing, retractions, nasal flaring, and ability to speak',
      'Auscultate lung sounds for wheezing or diminished air movement',
      'Check oxygen saturation and ensure oxygen is titrated to maintain SpO2 greater than 95 percent',
      'Place the child in High Fowler position',
      'Administer nebulized albuterol and ipratropium as ordered',
      'Reassess respiratory status after treatment',
      'Monitor for signs of impending respiratory failure and notify the provider or activate the Rapid Response Team if deterioration occurs',
      'Educate the child and caregivers about asthma triggers, inhaler and spacer use, and warning signs requiring emergency care'
    ],

    criticalErrors: [
      'Laying the child flat or lowering the head of the bed - worsens air trapping and work of breathing',
      'Delaying oxygen administration in a child with SpO2 89 percent',
      'Giving a corticosteroid instead of albuterol as the rescue medication for an acute attack',
      'Failing to give a systemic corticosteroid within the first hour of a moderate-to-severe exacerbation',
      'Interpreting a disappearing wheeze as improvement instead of a silent chest',
      'Failing to auscultate lung sounds before and after the bronchodilator treatment',
      'Administering a sedative or opioid to calm the anxious child - depresses the respiratory drive',
      'Leaving the child unattended during acute distress',
      'Failing to escalate when bradycardia, cyanosis, or somnolence appear',
      'Giving anything by mouth while the child is NPO and in severe distress - aspiration risk',
      'Ignoring the peanut allergy when selecting inhaler formulations or offering snacks'
    ],

    comparisons: [
      {
        title: 'Asthma vs Foreign Body Aspiration',
        headers: ['Asthma', 'Foreign Body'],
        rows: [
          ['Wheezing', 'Sudden choking'],
          ['Usually bilateral', 'Often unilateral'],
          ['Viral trigger common', 'Sudden onset while eating/playing'],
          ['Improves with bronchodilator', 'Bronchodilator often ineffective']
        ]
      },
      {
        title: 'Early vs Late Signs of Respiratory Failure',
        headers: ['Early (compensating)', 'Late (very dangerous)'],
        rows: [
          ['Tachypnea', 'Diminished or absent breath sounds (silent chest)'],
          ['Wheezing', 'Cyanosis'],
          ['Tachycardia', 'Bradycardia'],
          ['Retractions', 'Altered level of consciousness'],
          ['Nasal flaring', 'Fatigue and poor respiratory effort'],
          ['Anxiety and restlessness', 'Rising CO2 on ABG']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting',
        line: 'I cannot... get air... in.' },
      { speaker: 'patient', trigger: 'assessment',
        line: 'My chest. Tight. Like somebody... sitting on it.' },
      { speaker: 'patient', trigger: 'position',
        line: 'No. Do not lay me down. Please. Sitting up... is better.' },
      { speaker: 'patient', trigger: 'medication',
        line: 'My puffer... I used it. It did not... help this time.' },
      { speaker: 'patient', trigger: 'reassessment',
        line: 'Hands are shaky. Heart is going really fast. Is that bad?' },
      { speaker: 'patient', trigger: 'deterioration',
        line: 'I am... just... tired. Want to sleep.' },
      { speaker: 'family', trigger: 'greeting',
        line: 'He caught a cold last week and it just kept getting worse. He was up all night coughing and he could not lie down.' },
      { speaker: 'family', trigger: 'medication',
        line: 'I gave him his rescue inhaler every few hours like they told me. Did I do something wrong? Should I have brought him in sooner?' },
      { speaker: 'family', trigger: 'deterioration',
        line: 'He stopped that whistling sound. That means he is getting better, right? Why do you all look so worried?' },
      { speaker: 'family', trigger: 'education',
        line: 'He is allergic to peanuts. Please make sure nothing you give him has peanut in it. And what is a spacer? Nobody ever showed us one.' }
    ],

    patientEducation: [
      'Avoid triggers: smoke, dust, pollen, pet dander, mold, and cold air',
      'Use controller medications exactly as prescribed, every day, even when feeling well',
      'Always carry the rescue inhaler and keep one at school',
      'Use a spacer with the metered-dose inhaler for better lung delivery',
      'Correct MDI technique: shake, attach spacer, exhale fully, press once, inhale slowly, hold about 10 seconds, wait about 1 minute before the second puff',
      'Monitor peak flow if prescribed and know the green, yellow, and red zones',
      'Rinse the mouth after inhaled corticosteroids to prevent thrush',
      'Seek emergency care if the rescue inhaler is not working, the child cannot speak in full sentences, lips turn blue, severe retractions occur, or the child becomes sleepy or difficult to arouse'
    ]
  },

  /* ===========================================================================
   * 2. MODERATE DEHYDRATION SECONDARY TO ACUTE GASTROENTERITIS
   * ======================================================================== */
  {
    id: 'peds-dehydration',
    title: 'Moderate Dehydration',
    fullTitle: 'Moderate Dehydration Secondary to Acute Gastroenteritis',
    category: 'PEDS',
    course: 'NUR2310C',
    difficulty: 'Medium',
    durationMin: 20,
    icon: 'DROPLET',
    summary: 'An 8-year-old with two days of vomiting and watery diarrhea presents with tachycardia, hyponatremia, hypokalemia, and an elevated BUN. Focus is fluid resuscitation, strict I&O, electrolyte monitoring, and preventing hypovolemic shock.',
    highYield: true,

    objectives: [
      'Perform a focused hydration assessment',
      'Assess gastrointestinal symptoms',
      'Evaluate perfusion',
      'Monitor laboratory values',
      'Administer IV fluids',
      'Begin oral rehydration when appropriate',
      'Monitor intake and output',
      'Educate the family',
      'Recognize signs of hypovolemic shock',
      'Communicate using SBAR'
    ],

    patient: {
      name: 'John Smith',
      age: '8 years',
      sex: 'Male',
      weightKg: 30,
      allergies: ['Bee sting'],
      codeStatus: 'Full Code',
      diagnosis: 'Moderate Dehydration Secondary to Acute Gastroenteritis',
      history: [
        'Persistent vomiting',
        'Frequent watery diarrhea',
        'Poor oral intake',
        'Fatigue',
        'Abdominal cramping',
        'Urinated only once today',
        'Increasing weakness'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - on admission, before fluid bolus',
        bp: '98/60', hr: 128, rr: 24, temp: '100.2 F', spo2: 98,
        pain: 'Abdominal cramping 4/10',
        loc: 'Alert, mildly irritable',
        other: 'Dry mucous membranes, sunken eyes, capillary refill 3 seconds, urinated once today',
        flags: ['tachycardia', 'low-normal-bp', 'dry-mucous-membranes', 'delayed-cap-refill'],
        note: 'Documented sim vitals. Tachycardia is the EARLIEST sign of hypovolemia in a child - HR 128 far exceeds the 70-110 range for an 8-year-old. BP 98/60 is low-normal because children compensate by vasoconstricting; blood pressure stays normal until shock is advanced.'
      },
      {
        atMin: 6,
        label: 'Bolus delayed - compensated hypovolemia deepening',
        bp: '92/54', hr: 140, rr: 28, temp: '100.4 F', spo2: 97,
        pain: 'Abdominal cramping 5/10',
        loc: 'Irritable, difficult to console',
        other: 'Capillary refill 4 seconds, no tears with crying, cool hands and feet, tenting skin turgor, no urine output',
        flags: ['worsening', 'tachycardia', 'poor-perfusion', 'oliguria'],
        note: 'Continued GI losses without replacement. HR climbs and perfusion markers worsen while BP falls only slightly - this is compensated shock. Peripheral vasoconstriction is protecting the core at the cost of the skin and kidneys.'
      },
      {
        atMin: 12,
        label: 'Early decompensation',
        bp: '84/48', hr: 152, rr: 32, temp: '100.6 F', spo2: 96,
        pain: 'Not reliably reporting',
        loc: 'Lethargic, sluggish to respond, flat affect',
        other: 'Mottled extremities, capillary refill greater than 5 seconds, thready peripheral pulses, anuric for 4 hours',
        flags: ['hypotension', 'altered-loc', 'mottling', 'anuria', 'worsening'],
        note: 'Systolic BP has now dropped below the 5th percentile for an 8-year-old (roughly 70 plus 2 x age equals 86 mmHg). Hypotension in a child is a LATE finding - by the time it appears, roughly 25-30 percent of circulating volume is gone.'
      },
      {
        atMin: 18,
        label: 'Decompensated hypovolemic shock',
        bp: '72/40', hr: 160, rr: 34, temp: '99.8 F', spo2: 93,
        pain: 'Unable to report',
        loc: 'Minimally responsive to voice, responds only to painful stimuli',
        other: 'Absent peripheral pulses, weak central pulses, cold and mottled to the knees and elbows, anuric',
        flags: ['shock', 'severe-hypotension', 'altered-loc', 'anuria', 'critical'],
        note: 'Frank decompensated shock. Compensatory mechanisms have failed - cardiac output cannot be maintained. Children deteriorate abruptly at this point and arrest follows quickly without aggressive repeat isotonic boluses.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'WBC', value: '13.4', unit: 'K/microL', status: 'high',
        normalRange: '5.0-14.5 (school age)',
        interpretation: 'Slightly elevated, likely due to infection' },
      { panel: 'CBC', name: 'Hemoglobin', value: '15.1', unit: 'g/dL', status: 'high',
        normalRange: '11.5-15.5',
        interpretation: 'High-normal from hemoconcentration - dehydration falsely raises Hgb and Hct' },
      { panel: 'CBC', name: 'Hematocrit', value: '45', unit: '%', status: 'high',
        normalRange: '35-45',
        interpretation: 'Upper limit of normal; hemoconcentration from fluid volume deficit' },
      { panel: 'CBC', name: 'Platelets', value: '325,000', unit: '/microL', status: 'normal',
        normalRange: '150,000-400,000', interpretation: 'Normal' },
      { panel: 'BMP', name: 'Sodium', value: '132', unit: 'mEq/L', status: 'low',
        normalRange: '135-145',
        interpretation: 'Hyponatremia - sodium lost in vomit and diarrhea. Correct slowly with isotonic fluid' },
      { panel: 'BMP', name: 'Potassium', value: '3.4', unit: 'mEq/L', status: 'low',
        normalRange: '3.5-5.0',
        interpretation: 'Hypokalemia from GI losses. Causes weakness, muscle cramps, and dysrhythmias when severe' },
      { panel: 'BMP', name: 'Chloride', value: '96', unit: 'mEq/L', status: 'low',
        normalRange: '98-106', interpretation: 'Slightly low, consistent with vomiting losses' },
      { panel: 'BMP', name: 'BUN', value: '24', unit: 'mg/dL', status: 'high',
        normalRange: '5-18',
        interpretation: 'Elevated - the single best lab marker of dehydration and decreased renal perfusion in this case' },
      { panel: 'BMP', name: 'Creatinine', value: '0.7', unit: 'mg/dL', status: 'high',
        normalRange: '0.3-0.7',
        interpretation: 'Upper limit of normal; continue monitoring kidney function' },
      { panel: 'BMP', name: 'Glucose', value: '92', unit: 'mg/dL', status: 'normal',
        normalRange: '70-110', interpretation: 'Normal' }
    ],

    diagnostics: [
      { name: 'Stool studies / stool culture', finding: 'Pending',
        interpretation: 'Will determine whether the illness is viral, bacterial, or parasitic and whether antimicrobial therapy is indicated' },
      { name: 'Daily weight', finding: 'Ordered - baseline being obtained',
        interpretation: 'Daily weight on the same scale at the same time is the MOST accurate indicator of hydration status; 1 kg lost equals about 1 L of fluid' }
    ],

    orders: [
      { text: 'Vital signs every hour', category: 'monitoring' },
      { text: 'Continuous cardiac monitoring', category: 'monitoring' },
      { text: 'CBC', category: 'lab' },
      { text: 'BMP', category: 'lab' },
      { text: 'Daily weights', category: 'monitoring' },
      { text: 'Strict intake and output every hour', category: 'monitoring' },
      { text: 'Two peripheral IVs, largest gauge the child will tolerate (typically 20-22 gauge)', category: 'access' },
      { text: 'Contact precautions', category: 'monitoring' },
      { text: 'Stool culture', category: 'lab' },
      { text: 'Normal saline bolus 20 mL/kg', category: 'medication' },
      { text: 'Oral rehydration solution as tolerated', category: 'diet' },
      { text: 'Notify provider if perfusion worsens or urine output decreases', category: 'monitoring' }
    ],

    interventions: [
      { id: 'dehyd-1', order: 1,
        action: 'Assess airway, breathing, and circulation',
        rationale: 'ABCs first. In hypovolemia the C is the failing letter - assess heart rate, pulse quality, capillary refill, and skin temperature as the first read on circulating volume.',
        category: 'assessment', critical: true, preventsDeterioration: false,
        atiPearl: 'ABCs before anything else' },
      { id: 'dehyd-2', order: 2,
        action: 'Assess hydration status: heart rate, capillary refill, skin turgor, mucous membranes, urine output, mental status',
        rationale: 'These six findings quantify the degree of dehydration. This child fits MODERATE (6-9 percent): tachycardia, dry mucous membranes, sunken eyes, delayed capillary refill, decreased urine output, irritability, and fatigue.',
        category: 'assessment', critical: true, preventsDeterioration: false,
        atiPearl: 'Tachycardia is the earliest sign of pediatric hypovolemia' },
      { id: 'dehyd-3', order: 3,
        action: 'Administer the 600 mL normal saline bolus (20 mL/kg x 30 kg)',
        rationale: 'This is the priority treatment. Isotonic crystalloid rapidly expands the intravascular space, restores perfusion, and prevents progression to hypovolemic shock. Reassess perfusion after the bolus and anticipate repeat boluses if tachycardia and poor perfusion persist.',
        category: 'medication', critical: true, preventsDeterioration: true,
        atiPearl: '20 mL/kg isotonic fluid - Normal Saline or Lactated Ringers' },
      { id: 'dehyd-4', order: 4,
        action: 'Maintain strict intake and output; urine output must stay at or above 30 mL/hr',
        rationale: 'Normal pediatric urine output is at least 1 mL/kg/hr. For a 30 kg child that is 30 mL/hr. Urine output is the most sensitive bedside indicator of renal perfusion and the adequacy of resuscitation.',
        category: 'intervention', critical: true, preventsDeterioration: false,
        atiPearl: 'Urine output at or above 1 mL/kg/hr in children' },
      { id: 'dehyd-5', order: 5,
        action: 'Obtain daily weights on the same scale, at the same time, in the same clothing',
        rationale: 'Daily weight is the most accurate indicator of hydration status and of the response to fluid therapy. Acute weight change reflects fluid change, not tissue change.',
        category: 'intervention', critical: false, preventsDeterioration: false,
        atiPearl: 'Daily weights are the gold standard for fluid status' },
      { id: 'dehyd-6', order: 6,
        action: 'Begin oral rehydration solution (ORS) once vomiting improves',
        rationale: 'ORS such as Pedialyte or WHO solution is preferred for mild to moderate dehydration. Give small, frequent sips - 5 to 10 mL every 1-2 minutes. If vomiting occurs, wait about 10 minutes and restart slowly. Avoid soda, sports drinks, and juice, which contain too much sugar and worsen osmotic diarrhea.',
        category: 'intervention', critical: false, preventsDeterioration: false,
        atiPearl: 'Small frequent sips of ORS - never large volumes and never sugary drinks' },
      { id: 'dehyd-7', order: 7,
        action: 'Monitor electrolytes, especially sodium and potassium',
        rationale: 'Sodium is 132 and potassium is 3.4. Fluid resuscitation shifts both. Hypokalemia causes weakness, cramping, and dysrhythmias, which is why continuous cardiac monitoring is ordered. Sodium must be corrected slowly to avoid neurologic injury.',
        category: 'assessment', critical: true, preventsDeterioration: false,
        atiPearl: 'Monitor sodium, potassium, BUN, and creatinine' },
      { id: 'dehyd-8', order: 8,
        action: 'Maintain contact precautions',
        rationale: 'Acute gastroenteritis spreads easily by the fecal-oral route. Use gloves and a gown when indicated. Wash hands with soap and water rather than alcohol gel when norovirus or C. difficile is suspected because alcohol does not kill those spores or non-enveloped viruses.',
        category: 'intervention', critical: true, preventsDeterioration: false,
        atiPearl: 'Soap and water, not alcohol gel, for norovirus and C. difficile' }
    ],

    medications: [
      {
        name: '0.9 percent Sodium Chloride (Normal Saline)',
        brand: 'NS',
        classification: 'Isotonic crystalloid volume expander',
        dose: '20 mL/kg IV bolus equals 600 mL for this 30 kg child',
        action: 'Expands intravascular volume, restores preload and cardiac output, improves tissue perfusion',
        onset: 'Immediate during infusion',
        sideEffects: ['Fluid overload if given to a child with cardiac or renal disease', 'Hyperchloremic metabolic acidosis with large volumes', 'Peripheral or pulmonary edema'],
        nursingConsiderations: [
          'Use two large-bore IVs as ordered',
          'Infuse the bolus rapidly - typically over 20-60 minutes, or by pressure bag or push-pull syringe in shock',
          'Reassess HR, capillary refill, mental status, and urine output after each bolus',
          'Auscultate lungs and watch for crackles or increased work of breathing between boluses',
          'Never bolus with a hypotonic fluid such as D5W or 0.45 percent NS'
        ],
        atiTip: 'Isotonic fluid only for a bolus - NS or LR. Hypotonic fluid shifts into cells and can cause cerebral edema',
        highAlert: false
      },
      {
        name: 'Oral Rehydration Solution',
        brand: 'Pedialyte / WHO ORS',
        classification: 'Glucose-electrolyte oral rehydration therapy',
        dose: '5-10 mL every 1-2 minutes, advancing as tolerated',
        action: 'Uses the intact sodium-glucose cotransport mechanism in the small bowel to absorb water even during active diarrhea',
        onset: 'Gradual over hours',
        sideEffects: ['Vomiting if given too quickly or in too large a volume'],
        nursingConsiderations: [
          'Start only after vomiting improves',
          'If the child vomits, wait about 10 minutes and restart slowly',
          'A syringe, medicine cup, or teaspoon works better than a full cup',
          'Avoid soda, sports drinks, and juice - the sugar load worsens diarrhea'
        ],
        atiTip: 'ORS is FIRST-LINE for mild to moderate dehydration - IV fluid is for moderate to severe or failed oral therapy',
        highAlert: false
      },
      {
        name: 'Potassium Chloride',
        brand: 'KCl',
        classification: 'Electrolyte replacement',
        dose: 'Typically 0.5-1 mEq/kg/dose IV, infused no faster than 0.5 mEq/kg/hr; also given as maintenance 20-40 mEq/L in IV fluids',
        action: 'Replaces potassium lost through vomiting and diarrhea',
        onset: 'Serum level rises during the infusion',
        sideEffects: ['Infusion site pain and phlebitis', 'Cardiac dysrhythmias if given too fast', 'Cardiac arrest if given IV push'],
        nursingConsiderations: [
          'NEVER give potassium IV push - it is fatal',
          'Confirm adequate urine output before giving any potassium',
          'Always use an infusion pump and continuous cardiac monitoring',
          'Verify the concentration and rate with a second nurse'
        ],
        atiTip: 'No pee, no K. Establish urine output before replacing potassium',
        highAlert: true
      }
    ],

    dosageCalculations: [
      {
        id: 'peds-dehydration-calc1',
        text: 'The provider orders a normal saline bolus at 20 mL/kg. The child weighs 30 kg. How many mL will the nurse infuse?',
        given: { weight: 30, orderedDose: '20 mL/kg' },
        answer: 600, unit: 'mL',
        steps: [
          { label: 'Multiply weight by the volume per kg', hint: '30 kg x 20 mL/kg', answer: '600', unit: 'mL' }
        ],
        safeRange: 'Standard pediatric isotonic bolus is 20 mL/kg, repeated as needed based on perfusion',
        isSafe: true
      },
      {
        id: 'peds-dehydration-calc2',
        text: 'The 600 mL bolus is to be infused over 20 minutes. What rate in mL/hr will the nurse program into the pump?',
        given: { volume: '600 mL', time: '20 minutes' },
        answer: 1800, unit: 'mL/hr',
        steps: [
          { label: 'Convert the time to hours', hint: '20 minutes divided by 60 equals 0.333 hr', answer: '0.333', unit: 'hr' },
          { label: 'Divide volume by time in hours', hint: '600 mL divided by 0.333 hr, or 600 x 60 divided by 20', answer: '1800', unit: 'mL/hr' }
        ],
        safeRange: 'Rapid bolus rates exceed most pump limits - many facilities require a pressure bag or push-pull syringe technique',
        isSafe: true
      },
      {
        id: 'peds-dehydration-calc3',
        text: 'What is the MINIMUM acceptable hourly urine output for this child, using 1 mL/kg/hr?',
        given: { weight: 30, orderedDose: '1 mL/kg/hr minimum' },
        answer: 30, unit: 'mL/hr',
        steps: [
          { label: 'Multiply weight by the minimum output per kg per hour', hint: '30 kg x 1 mL/kg/hr', answer: '30', unit: 'mL/hr' },
          { label: 'Decide the nursing action if output is below this', hint: 'Notify the provider - order states to call if urine output decreases', answer: 'Notify provider', unit: '' }
        ],
        safeRange: 'Pediatric urine output should be at least 1 mL/kg/hr; infants require at least 2 mL/kg/hr',
        isSafe: true
      },
      {
        id: 'peds-dehydration-calc4',
        text: 'SAFE DOSE CHECK: The potassium is 3.4 mEq/L. A new order reads potassium chloride 40 mEq IV over 1 hour. The pediatric safe limit is 0.5-1 mEq/kg/dose infused no faster than 0.5 mEq/kg/hr. Is this order safe to give to this 30 kg child?',
        given: { weight: 30, orderedDose: '40 mEq over 1 hour', safeDoseRange: '0.5-1 mEq/kg/dose, max rate 0.5 mEq/kg/hr' },
        answer: 15, unit: 'mEq/hr (maximum safe rate)',
        steps: [
          { label: 'Calculate the maximum safe hourly rate', hint: '30 kg x 0.5 mEq/kg/hr', answer: '15', unit: 'mEq/hr' },
          { label: 'Calculate the maximum safe single dose', hint: '30 kg x 1 mEq/kg', answer: '30', unit: 'mEq' },
          { label: 'Compare the order to both limits', hint: '40 mEq exceeds the 30 mEq max dose AND the 15 mEq/hr max rate', answer: 'Exceeds both limits', unit: '' },
          { label: 'Decide the nursing action', hint: 'Hold the dose, verify urine output, and clarify with the prescriber', answer: 'Hold and clarify', unit: '' }
        ],
        safeRange: 'Max 0.5-1 mEq/kg/dose IV; infusion rate not to exceed 0.5 mEq/kg/hr. Never give potassium IV push',
        isSafe: false
      }
    ],

    sbar: {
      situation: 'This is the RN caring for John Smith, an 8-year-old admitted with moderate dehydration secondary to acute gastroenteritis.',
      background: 'He has had persistent vomiting and frequent watery diarrhea for two days. He has poor oral intake and has urinated only once today.',
      assessment: 'Vital signs show HR 128 and BP 98/60. Laboratory results reveal sodium 132, potassium 3.4, BUN 24, and clinical signs of dehydration including dry mucous membranes, sunken eyes, and capillary refill of 3 seconds.',
      recommendation: 'A 20 mL/kg normal saline bolus (600 mL) has been initiated. I recommend continued monitoring of urine output, electrolytes, and perfusion, with reassessment after fluid resuscitation.'
    },

    questions: [
      {
        id: 'peds-dehydration-q1',
        text: 'Which assessment finding is the PRIORITY indicator of hypovolemia in this 8-year-old?',
        type: 'multiple-choice',
        options: [
          'Heart rate of 128',
          'Blood pressure of 98/60',
          'Temperature of 100.2 F',
          'Abdominal cramping'
        ],
        correct: [0],
        rationale: 'Tachycardia is the EARLIEST sign of pediatric hypovolemia. A child compensates for volume loss by increasing heart rate long before blood pressure changes. The BP of 98/60 is low-normal and reassuring only on the surface.',
        atiPearl: 'Tachycardia first, hypotension last - in that order, in every pediatric hypovolemia question.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-dehydration-q2',
        text: 'What is the PRIORITY treatment for this child?',
        type: 'multiple-choice',
        options: [
          'Administer the ordered normal saline bolus',
          'Offer 8 ounces of Pedialyte',
          'Obtain the stool culture',
          'Weigh the child on the bed scale'
        ],
        correct: [0],
        rationale: 'Restoring circulating volume with the ordered isotonic bolus is the priority treatment for moderate dehydration with tachycardia and delayed capillary refill. Oral rehydration is deferred while the child is actively vomiting, and the culture and weight do not treat the deficit.',
        atiPearl: 'Circulation problem equals fluid. Do not delay a bolus to collect data.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-dehydration-q3',
        text: 'Which laboratory value BEST supports the diagnosis of dehydration?',
        type: 'multiple-choice',
        options: [
          'BUN 24 mg/dL',
          'Sodium 132 mEq/L',
          'Potassium 3.4 mEq/L',
          'WBC 13.4 K/microL'
        ],
        correct: [0],
        rationale: 'An elevated BUN reflects decreased renal perfusion and hemoconcentration and is the classic dehydration marker. The hyponatremia and hypokalemia reflect GI electrolyte losses, and the WBC reflects infection - none of those is specific to volume status.',
        atiPearl: 'Rising BUN with a normal creatinine equals a pre-renal, volume-depleted picture.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-dehydration-q4',
        text: 'The child weighs 30 kg. What is the minimum acceptable urine output the nurse should expect per hour?',
        type: 'multiple-choice',
        options: [
          '30 mL/hr',
          '15 mL/hr',
          '60 mL/hr',
          '10 mL/hr'
        ],
        correct: [0],
        rationale: 'Minimum pediatric urine output is 1 mL/kg/hr. 30 kg x 1 mL/kg/hr equals 30 mL/hr. Output below this indicates inadequate renal perfusion and requires provider notification per the standing order.',
        atiPearl: 'Children 1 mL/kg/hr, infants 2 mL/kg/hr, adults about 30 mL/hr.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-dehydration-q5',
        text: 'The vomiting has stopped. Which oral fluid is BEST for the nurse to offer?',
        type: 'multiple-choice',
        options: [
          'Oral rehydration solution such as Pedialyte',
          'Apple juice diluted with water',
          'A clear lemon-lime soda',
          'A commercial sports drink'
        ],
        correct: [0],
        rationale: 'ORS has the correct sodium-to-glucose ratio to drive water absorption through the intact sodium-glucose cotransporter. Juice, soda, and sports drinks are hyperosmolar, contain too much sugar and too little sodium, and worsen osmotic diarrhea.',
        atiPearl: 'Pedialyte yes, Gatorade no.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-dehydration-q6',
        text: 'Which finding indicates that the child is progressing into WORSENING hypovolemic shock?',
        type: 'multiple-choice',
        options: [
          'Blood pressure dropping to 84/48',
          'Heart rate of 128',
          'Capillary refill of 3 seconds',
          'Irritability'
        ],
        correct: [0],
        rationale: 'Hypotension is a LATE sign in children and indicates that compensatory mechanisms have failed. Tachycardia, delayed capillary refill, and irritability are early compensated findings that were already present at baseline.',
        atiPearl: 'When a child hypotensive, you are already behind - act immediately.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-dehydration-q7',
        text: 'Select ALL findings that indicate moderate (6-9 percent) dehydration.',
        type: 'select-all',
        options: [
          'Tachycardia',
          'Dry mucous membranes',
          'Sunken eyes',
          'Delayed capillary refill',
          'Decreased urine output',
          'Hypotension with weak pulses'
        ],
        correct: [0, 1, 2, 3, 4],
        rationale: 'Moderate dehydration produces tachycardia, dry mucous membranes, sunken eyes, delayed capillary refill, decreased urine output, irritability, and fatigue. Hypotension with weak pulses, lethargy, altered mental status, and shock define SEVERE dehydration of 10 percent or greater.',
        atiPearl: 'Hypotension moves the child from moderate to severe - it is a category change, not a detail.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-dehydration-q8',
        text: 'Which IV fluid is appropriate for the ordered bolus?',
        type: 'multiple-choice',
        options: [
          '0.9 percent sodium chloride',
          'D5W',
          '0.45 percent sodium chloride',
          'D5 with 0.2 percent sodium chloride'
        ],
        correct: [0],
        rationale: 'Fluid boluses must be ISOTONIC - normal saline or lactated Ringers - so the volume stays in the intravascular space. Hypotonic fluids such as D5W and half normal saline shift water into cells, worsen the existing hyponatremia, and risk cerebral edema.',
        atiPearl: 'Bolus equals isotonic. Always.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-dehydration-q9',
        text: 'The potassium is 3.4 mEq/L. Before administering any IV potassium replacement, the nurse must FIRST verify which finding?',
        type: 'multiple-choice',
        options: [
          'That the child has adequate urine output',
          'That the child has eaten within the last hour',
          'That the sodium has normalized',
          'That the child is not nauseated'
        ],
        correct: [0],
        rationale: 'Potassium is excreted renally. Giving potassium to a child who is not making urine can cause life-threatening hyperkalemia and cardiac arrest. Confirm urine output first, always infuse on a pump, and never give potassium IV push.',
        atiPearl: 'No pee, no K.',
        difficulty: 'Hard'
      },
      {
        id: 'peds-dehydration-q10',
        text: 'Which nursing measure is the MOST accurate indicator of this child hydration status over time?',
        type: 'multiple-choice',
        options: [
          'Daily weight on the same scale at the same time',
          'Skin turgor assessed each shift',
          'Hourly heart rate trend',
          'Parent report of how much the child drank'
        ],
        correct: [0],
        rationale: 'Daily weight is the most accurate indicator of hydration status because acute weight change equals fluid change - roughly 1 kg per liter. Skin turgor and heart rate are useful but are affected by fever, anxiety, and nutritional status.',
        atiPearl: 'Daily weights beat every other fluid-status assessment.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-dehydration-q11',
        text: 'The nurse is caring for this child on contact precautions. Norovirus is suspected. Which hand hygiene action is correct?',
        type: 'multiple-choice',
        options: [
          'Wash hands with soap and water after removing gloves',
          'Use alcohol-based hand rub after removing gloves',
          'Use alcohol-based hand rub before donning gloves only',
          'Hand hygiene is not required if gloves were worn'
        ],
        correct: [0],
        rationale: 'Alcohol-based hand rub does not reliably kill norovirus, a non-enveloped virus, or C. difficile spores. Soap and water with mechanical friction physically removes the organism. Hand hygiene is always required after glove removal.',
        atiPearl: 'Norovirus and C. diff equal soap and water, not gel.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-dehydration-q12',
        text: 'Select ALL of the symptoms the nurse should teach parents to report immediately after discharge.',
        type: 'select-all',
        options: [
          'No urination',
          'Persistent vomiting',
          'Bloody diarrhea',
          'Lethargy or difficulty waking the child',
          'No tears when crying',
          'One loose stool in 24 hours'
        ],
        correct: [0, 1, 2, 3, 4],
        rationale: 'Anuria, persistent vomiting, bloody diarrhea, lethargy, sunken eyes, absence of tears, dry mouth, and inability to drink all signal worsening dehydration or a bacterial process and require emergency evaluation. A single loose stool is expected during recovery.',
        atiPearl: 'Teach observable red flags: no pee, no tears, will not wake up.',
        difficulty: 'Medium'
      }
    ],

    keyPoints: [
      'Children dehydrate quickly because of higher metabolic rates, greater fluid needs per kg, smaller reserves, and faster insensible losses',
      'Mild is 3-5 percent, moderate is 6-9 percent, severe is 10 percent or greater',
      'This child fits MODERATE dehydration',
      'Tachycardia is the earliest sign of hypovolemia; hypotension is a LATE sign',
      'Bolus is 20 mL/kg of isotonic fluid - 600 mL for this 30 kg child',
      'Minimum urine output is 1 mL/kg/hr, which is 30 mL/hr for this child',
      'Hemoconcentration from dehydration falsely elevates hemoglobin and hematocrit',
      'Daily weight is the most accurate indicator of hydration status'
    ],

    pearls: [
      'Tachycardia is the earliest sign of hypovolemia',
      'Hypotension is a late sign',
      '20 mL/kg isotonic fluid bolus - Normal Saline or Lactated Ringers',
      'Urine output should be at least 1 mL/kg/hr',
      'Daily weights are the best indicator of hydration status',
      'Oral rehydration solution is preferred for mild to moderate dehydration',
      'Avoid sugary drinks and soda',
      'Monitor sodium, potassium, BUN, and creatinine',
      'Watch closely for hypovolemic shock and escalating mental status changes'
    ],

    successChecklist: [
      'Perform hand hygiene and verify patient identity',
      'Assess airway, breathing, circulation, and mental status',
      'Assess hydration: mucous membranes, tears, skin turgor, capillary refill, pulses, urine output',
      'Review vital signs and recognize tachycardia as an early sign of hypovolemia',
      'Review laboratory results: hyponatremia, hypokalemia, elevated BUN',
      'Administer the 600 mL normal saline bolus',
      'Monitor intake and output and ensure urine output remains at or above 30 mL/hr',
      'Begin oral rehydration when tolerated',
      'Maintain contact precautions and monitor for worsening dehydration or shock',
      'Educate the family and communicate changes using SBAR'
    ],

    criticalErrors: [
      'Delaying the 20 mL/kg isotonic bolus to wait for labs, a stool culture, or a weight',
      'Bolusing with a hypotonic fluid such as D5W or 0.45 percent saline - worsens the hyponatremia and risks cerebral edema',
      'Correcting the sodium of 132 too rapidly with hypertonic fluid - risks osmotic demyelination',
      'Giving IV potassium before urine output is established, or giving potassium IV push',
      'Offering soda, juice, or a sports drink for rehydration - the sugar load worsens osmotic diarrhea',
      'Pushing large volumes of oral fluid at once while the child is still vomiting',
      'Waiting for hypotension before recognizing shock - hypotension is a late finding in children',
      'Failing to report urine output below 30 mL/hr as the standing order requires',
      'Using alcohol-based hand rub alone when norovirus is suspected',
      'Removing contact precautions before the causative organism is identified'
    ],

    comparisons: [
      {
        title: 'Degrees of Pediatric Dehydration',
        headers: ['Mild (3-5%)', 'Moderate (6-9%)', 'Severe (10% or greater)'],
        rows: [
          ['Slight thirst', 'Tachycardia', 'Hypotension (late sign)'],
          ['Normal vital signs', 'Dry mucous membranes', 'Weak pulses'],
          ['Normal urine output', 'Sunken eyes', 'Lethargy'],
          ['Normal capillary refill', 'Delayed capillary refill', 'Altered mental status'],
          ['Alert and playful', 'Decreased urine output, irritability, fatigue', 'Shock']
        ]
      },
      {
        title: 'Hypovolemic Shock: Early vs Late',
        headers: ['Early', 'Late'],
        rows: [
          ['Tachycardia', 'Hypotension'],
          ['Delayed capillary refill', 'Altered mental status'],
          ['Cool skin', 'Oliguria or anuria'],
          ['Weak pulses', 'Very weak pulses'],
          ['Irritability', 'Loss of consciousness']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting',
        line: 'My tummy hurts. Can I have a Sprite? Mom always gives me Sprite when my stomach hurts.' },
      { speaker: 'patient', trigger: 'assessment',
        line: 'I am really thirsty but every time I drink it comes right back up.' },
      { speaker: 'patient', trigger: 'pain',
        line: 'It cramps up. Like a four, I guess. It gets worse right before I have to run to the bathroom.' },
      { speaker: 'patient', trigger: 'iv-start',
        line: 'Wait. Is that a needle? Do I have to have a needle? I do not want the needle.' },
      { speaker: 'patient', trigger: 'deterioration',
        line: 'I am so tired. My legs feel funny. Can you stop moving me around?' },
      { speaker: 'family', trigger: 'greeting',
        line: 'He has been throwing up and having diarrhea since Tuesday. Half his class has it. I thought it would just run its course.' },
      { speaker: 'family', trigger: 'assessment',
        line: 'He has only gone to the bathroom to pee one time today. That is not normal for him. Is that why his lips look so dry?' },
      { speaker: 'family', trigger: 'intervention',
        line: 'Why does he need an IV? Cannot he just drink something? I do not want to scare him with needles.' },
      { speaker: 'family', trigger: 'education',
        line: 'What should I give him when we get home? I have Gatorade and apple juice in the fridge.' },
      { speaker: 'family', trigger: 'deterioration',
        line: 'He will not really look at me. He is usually so chatty. Something is wrong, please come look at him.' }
    ],

    patientEducation: [
      'Give oral rehydration solution such as Pedialyte in small frequent sips - 5 to 10 mL every 1-2 minutes',
      'If vomiting occurs, wait about 10 minutes and restart slowly',
      'Avoid soda, sports drinks, and juice - the sugar worsens diarrhea',
      'Resume an age-appropriate regular diet once tolerated: rice, bananas, applesauce, toast, lean protein',
      'Avoid greasy foods, sugary drinks, and caffeinated beverages during recovery',
      'Seek emergency care for no urination, persistent vomiting, bloody diarrhea, fever, lethargy, sunken eyes, no tears, dry mouth, or inability to drink',
      'Wash hands frequently with soap and water, especially after bathroom use and diaper changes',
      'Use safe food preparation practices and do not share cups or utensils during the illness'
    ]
  },

  /* ===========================================================================
   * 3. DIABETIC KETOACIDOSIS / NEW-ONSET TYPE 1 DIABETES
   * ======================================================================== */
  {
    id: 'peds-dka',
    title: 'Diabetic Ketoacidosis',
    fullTitle: 'Diabetic Ketoacidosis (DKA) Secondary to New-Onset Type 1 Diabetes Mellitus',
    category: 'PEDS',
    course: 'NUR2310C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'GLUCOSE',
    summary: 'An 8-year-old presents in DKA from newly diagnosed Type 1 diabetes with glucose 568, pH 7.18, bicarbonate 10, and positive ketones. Focus is fluids before insulin, gradual glucose correction, potassium monitoring, and hourly neuro checks for cerebral edema.',
    highYield: true,

    objectives: [
      'Perform a focused endocrine assessment',
      'Assess hydration and neurological status',
      'Recognize DKA',
      'Interpret laboratory findings',
      'Administer IV fluids',
      'Initiate insulin infusion safely',
      'Monitor electrolytes',
      'Monitor for cerebral edema',
      'Educate the family',
      'Communicate using SBAR'
    ],

    patient: {
      name: 'John Smith',
      age: '8 years',
      sex: 'Male',
      weightKg: 30,
      allergies: ['Dairy', 'Latex'],
      codeStatus: 'Full Code',
      diagnosis: 'Diabetic Ketoacidosis (DKA) secondary to newly diagnosed Type 1 Diabetes Mellitus',
      history: [
        'Excessive thirst (polydipsia)',
        'Frequent urination (polyuria)',
        'Weight loss',
        'Vomiting',
        'Abdominal pain',
        'Increasing fatigue',
        'Increasing sleepiness'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - on admission, before treatment',
        bp: '94/58', hr: 132, rr: 34, temp: '99.4 F', spo2: 96,
        pain: 'Diffuse abdominal pain 5/10',
        loc: 'Sleepy but arousable, oriented to person and place, slow to answer',
        other: 'Kussmaul respirations, fruity acetone breath, dry mucous membranes, capillary refill 3-4 seconds, weak peripheral pulses',
        flags: ['tachycardia', 'kussmaul', 'dehydration', 'acidosis', 'altered-loc'],
        note: 'Documented sim vitals. RR 34 in an 8-year-old (normal 18-25) is Kussmaul breathing - the lungs blowing off CO2 to compensate for a pH of 7.18. HR 132 reflects severe osmotic-diuresis dehydration, not fever.'
      },
      {
        // atMin rescaled 0/8/16/22 -> 0/6/12/18: the Cushing-triad stage sat past durationMin 20 and never fired. Relative pacing preserved.
        atMin: 6,
        label: 'After 600 mL NS bolus - expected improvement',
        bp: '100/62', hr: 118, rr: 30, temp: '99.4 F', spo2: 97,
        pain: 'Abdominal pain 3/10',
        loc: 'More alert, answering appropriately, oriented x3',
        other: 'Capillary refill 2-3 seconds, peripheral pulses stronger, glucose 512, first void obtained',
        flags: ['improving', 'tachycardia'],
        note: 'This is what a CORRECT response looks like. Volume expansion alone lowers glucose by dilution and improved renal clearance and reduces the counter-regulatory hormone surge. Fluids before insulin is why perfusion improved without a glucose crash.'
      },
      {
        atMin: 12,
        label: 'Early cerebral edema - glucose dropped too fast',
        bp: '112/58', hr: 108, rr: 26, temp: '99.6 F', spo2: 96,
        pain: 'New headache, rated 7/10',
        loc: 'Confused, agitated, then abnormally quiet; does not recognize the parent',
        other: 'Glucose fell from 568 to 320 in under 2 hours (greater than 100 mg/dL/hr), new vomiting, widening pulse pressure',
        flags: ['cerebral-edema', 'headache', 'altered-loc', 'widening-pulse-pressure', 'critical'],
        note: 'Headache plus behavior change plus new vomiting plus a widening pulse pressure equals early cerebral edema, the most feared complication of pediatric DKA. Caused by correcting glucose or osmolality too rapidly. Notify the provider NOW - do not wait for bradycardia.'
      },
      {
        atMin: 18,
        label: 'Late cerebral edema - Cushing triad',
        bp: '132/54', hr: 62, rr: 12, temp: '99.6 F', spo2: 92,
        pain: 'Unable to report',
        loc: 'Unresponsive to voice, responds only to deep painful stimulus, sluggish pupils',
        other: 'Irregular respirations, widened pulse pressure of 78, posturing to stimulation',
        flags: ['cushing-triad', 'bradycardia', 'hypertension', 'irregular-respirations', 'herniation-risk', 'critical'],
        note: 'Cushing triad - bradycardia, hypertension with widening pulse pressure, and irregular respirations - means rising intracranial pressure and impending herniation. Stop the insulin if directed, elevate the head of the bed, give mannitol or hypertonic saline as ordered, and transfer to the ICU.'
      }
    ],

    labs: [
      { panel: 'Chemistry', name: 'Blood Glucose', value: '568', unit: 'mg/dL', status: 'critical-high',
        normalRange: '70-110',
        interpretation: 'Severely elevated. Drives osmotic diuresis, dehydration, and electrolyte loss' },
      { panel: 'Chemistry', name: 'Serum Ketones', value: 'Positive', unit: '', status: 'critical-high',
        normalRange: 'Negative',
        interpretation: 'Confirms ketosis from fat breakdown in the absence of insulin' },
      { panel: 'BMP', name: 'Sodium', value: '130', unit: 'mEq/L', status: 'low',
        normalRange: '135-145',
        interpretation: 'Hyponatremia. Hyperglycemia pulls water into the vascular space causing DILUTIONAL hyponatremia - correct slowly with isotonic fluid, never with hypertonic saline for the sodium alone' },
      { panel: 'BMP', name: 'Potassium', value: '5.6', unit: 'mEq/L', status: 'high',
        normalRange: '3.5-5.0',
        interpretation: 'Hyperkalemia on paper only. TOTAL BODY potassium is depleted - acidosis has driven potassium out of the cells. Insulin will push it back in and the serum level will fall rapidly' },
      { panel: 'BMP', name: 'BUN', value: '28', unit: 'mg/dL', status: 'high',
        normalRange: '5-18',
        interpretation: 'Elevated from dehydration and decreased renal perfusion' },
      { panel: 'BMP', name: 'Creatinine', value: '0.9', unit: 'mg/dL', status: 'high',
        normalRange: '0.3-0.7', interpretation: 'Slightly elevated, supporting dehydration' },
      { panel: 'CBC', name: 'Hemoglobin', value: '15.8', unit: 'g/dL', status: 'high',
        normalRange: '11.5-15.5', interpretation: 'Elevated from hemoconcentration due to dehydration' },
      { panel: 'CBC', name: 'WBC', value: '14.2', unit: 'K/microL', status: 'high',
        normalRange: '5.0-14.5 (school age)',
        interpretation: 'Slightly elevated from stress response; also screen for a precipitating infection' },
      { panel: 'VBG', name: 'pH', value: '7.18', unit: '', status: 'critical-low',
        normalRange: '7.35-7.45', interpretation: 'Severe metabolic acidosis' },
      { panel: 'VBG', name: 'HCO3', value: '10', unit: 'mEq/L', status: 'critical-low',
        normalRange: '22-26', interpretation: 'Very low - ketoacids have consumed the bicarbonate buffer' },
      { panel: 'VBG', name: 'PaCO2', value: '25', unit: 'mmHg', status: 'low',
        normalRange: '35-45',
        interpretation: 'Low from respiratory compensation - the child is hyperventilating (Kussmaul) to blow off CO2' },
      { panel: 'Urinalysis', name: 'Urine Glucose', value: 'Large', unit: '', status: 'critical-high',
        normalRange: 'Negative', interpretation: 'Glucose spilling into the urine above the renal threshold' },
      { panel: 'Urinalysis', name: 'Urine Ketones', value: 'Large', unit: '', status: 'critical-high',
        normalRange: 'Negative', interpretation: 'Classic DKA finding confirming ketogenesis' },
      { panel: 'Urinalysis', name: 'Specific Gravity', value: 'High', unit: '', status: 'high',
        normalRange: '1.005-1.030', interpretation: 'Concentrated urine reflecting dehydration and glycosuria' }
    ],

    diagnostics: [
      { name: 'Continuous cardiac monitoring', finding: 'Sinus tachycardia; monitoring for potassium-related changes',
        interpretation: 'Peaked T waves suggest hyperkalemia; flattened T waves with U waves suggest the hypokalemia that follows insulin therapy' },
      { name: 'Hourly neurological assessment', finding: 'Baseline: sleepy but arousable, oriented x3, pupils equal and reactive',
        interpretation: 'The single most important recurring assessment in pediatric DKA - it is the only early detector of cerebral edema' },
      { name: 'Magnesium and Phosphate', finding: 'Ordered with the BMP',
        interpretation: 'Both are depleted by osmotic diuresis and fall further with insulin therapy' }
    ],

    orders: [
      { text: 'Vital signs every hour', category: 'monitoring' },
      { text: 'Continuous cardiac monitoring', category: 'monitoring' },
      { text: 'Continuous pulse oximetry', category: 'monitoring' },
      { text: 'CBC', category: 'lab' },
      { text: 'BMP', category: 'lab' },
      { text: 'Magnesium', category: 'lab' },
      { text: 'Phosphate', category: 'lab' },
      { text: 'VBG/ABG', category: 'lab' },
      { text: 'Serum ketones', category: 'lab' },
      { text: 'Strict intake and output', category: 'monitoring' },
      { text: 'Daily weights', category: 'monitoring' },
      { text: 'Two peripheral IVs, largest gauge the child will tolerate (typically 20-22 gauge)', category: 'access' },
      { text: 'Blood glucose every hour', category: 'monitoring' },
      { text: '20 mL/kg normal saline bolus', category: 'medication' },
      { text: 'Continuous IV fluids', category: 'medication' },
      { text: 'Insulin infusion after fluid resuscitation', category: 'medication' },
      { text: 'Hourly neurological assessments', category: 'monitoring' },
      { text: 'Monitor closely for cerebral edema', category: 'monitoring' }
    ],

    interventions: [
      { id: 'dka-1', order: 1,
        action: 'Assess airway, breathing, circulation, and neurological status',
        rationale: 'ABCs plus a baseline neuro exam. The neuro baseline is essential in DKA because every later assessment is compared against it to detect cerebral edema. Kussmaul respirations are compensatory - do not suppress them.',
        category: 'assessment', critical: true, preventsDeterioration: false,
        atiPearl: 'In DKA the D for disability is as important as the ABCs' },
      { id: 'dka-2', order: 2,
        action: 'Begin IV fluids - administer the 600 mL normal saline bolus (20 mL/kg x 30 kg)',
        rationale: 'Fluid replacement ALWAYS comes before insulin. The child is profoundly volume depleted from osmotic diuresis. Volume restores perfusion, improves renal glucose clearance, and reduces the osmotic shift that causes cerebral edema.',
        category: 'medication', critical: true, preventsDeterioration: true,
        atiPearl: 'IV fluids FIRST. Every time' },
      { id: 'dka-3', order: 3,
        action: 'Start the continuous insulin infusion AFTER fluid resuscitation',
        rationale: 'Never give IV insulin before fluids in DKA. Insulin drives glucose and water into cells; giving it into an empty vascular space causes vascular collapse and a rapid osmolality shift that precipitates cerebral edema. Standard is a continuous infusion at 0.1 unit/kg/hr - no IV bolus in children.',
        category: 'medication', critical: true, preventsDeterioration: true,
        atiPearl: 'Insulin infusion AFTER fluids - and no bolus in pediatric DKA' },
      { id: 'dka-4', order: 4,
        action: 'Monitor blood glucose every hour and target a GRADUAL decrease',
        rationale: 'Glucose should fall no faster than about 50-100 mg/dL/hr. Rapid correction drops serum osmolality faster than the brain can adapt and water shifts into brain cells. Add dextrose to the IV fluid when glucose reaches about 250-300 mg/dL while the insulin infusion continues.',
        category: 'assessment', critical: true, preventsDeterioration: true,
        atiPearl: 'Slow and steady - rapid correction equals cerebral edema' },
      { id: 'dka-5', order: 5,
        action: 'Monitor potassium closely and anticipate replacement',
        rationale: 'The initial potassium of 5.6 is falsely reassuring - total body potassium is depleted. As insulin and fluids correct the acidosis, potassium shifts back into the cells and the serum level can fall precipitously, causing dangerous dysrhythmias. Replacement typically begins once K is below 5.0-5.5 and urine output is established.',
        category: 'assessment', critical: true, preventsDeterioration: true,
        atiPearl: 'High K on arrival, low K after insulin - watch the monitor' },
      { id: 'dka-6', order: 6,
        action: 'Maintain strict intake and output; urine output at or above 30 mL/hr',
        rationale: 'Urine output should be at least 1 mL/kg/hr, which is 30 mL/hr for this 30 kg child. Output guides fluid therapy and must be confirmed before potassium is added to the IV fluids.',
        category: 'intervention', critical: true, preventsDeterioration: false,
        atiPearl: '1 mL/kg/hr minimum in children' },
      { id: 'dka-7', order: 7,
        action: 'Maintain continuous cardiac monitoring',
        rationale: 'Electrolyte shifts during DKA treatment can cause dangerous dysrhythmias. Peaked T waves indicate hyperkalemia; flattened T waves, ST depression, and U waves indicate the hypokalemia that develops once insulin starts.',
        category: 'intervention', critical: true, preventsDeterioration: false,  // was 'monitoring', not a schema category (sim-engine CAT_GROUP has no such key)
        atiPearl: 'The ECG shows a potassium change before the lab result comes back' },
      { id: 'dka-8', order: 8,
        action: 'Perform neurological assessments every hour for signs of cerebral edema',
        rationale: 'This is one of the most important nursing responsibilities in pediatric DKA. Watch for headache, decreasing LOC, confusion, behavioral changes, vomiting, seizures, and the late findings of bradycardia, hypertension with widening pulse pressure, and irregular respirations.',
        category: 'assessment', critical: true, preventsDeterioration: true,
        atiPearl: 'A new headache in a child being treated for DKA is an emergency until proven otherwise' }
    ],

    medications: [
      {
        name: '0.9 percent Sodium Chloride (Normal Saline)',
        brand: 'NS',
        classification: 'Isotonic crystalloid volume expander',
        dose: '20 mL/kg IV bolus equals 600 mL, then continuous IV fluids',
        action: 'Restores intravascular volume and renal perfusion, improves glucose clearance, and begins correcting the acidosis before insulin is started',
        onset: 'Immediate during infusion',
        sideEffects: ['Fluid overload', 'Cerebral edema if total fluid is given too rapidly', 'Hyperchloremic acidosis with large volumes'],
        nursingConsiderations: [
          'Give the bolus BEFORE the insulin infusion',
          'Avoid overly aggressive total fluid volumes - excessive fluid contributes to cerebral edema in pediatric DKA',
          'Reassess perfusion, LOC, and urine output after the bolus',
          'Switch to a dextrose-containing fluid when glucose reaches about 250-300 mg/dL'
        ],
        atiTip: 'Fluids come before insulin in DKA - this is the single most tested sequencing fact',
        highAlert: false
      },
      {
        name: 'Regular Insulin (continuous IV infusion)',
        brand: 'Humulin R / Novolin R',
        classification: 'Short-acting insulin - the ONLY insulin given IV',
        dose: 'Continuous infusion at 0.1 unit/kg/hr equals 3 units/hr for this 30 kg child. NO IV bolus in pediatric DKA',
        action: 'Shuts off ketogenesis and lipolysis, drives glucose and potassium into cells, and resolves the metabolic acidosis',
        onset: 'IV onset 10-30 minutes; ketosis resolves over hours',
        sideEffects: ['Hypoglycemia', 'Hypokalemia', 'Rapid osmolality shift leading to cerebral edema', 'Hypophosphatemia', 'Hypomagnesemia'],
        nursingConsiderations: [
          'Start ONLY after fluid resuscitation',
          'Only Regular insulin may be given intravenously',
          'Prime the IV tubing with the insulin solution - insulin adsorbs to plastic',
          'Always run on a dedicated pump channel with independent double-check by a second nurse',
          'Do NOT stop the insulin infusion when glucose normalizes - add dextrose to the fluid instead, because the insulin is treating the ketosis, not just the glucose',
          'Recheck glucose hourly and potassium at least every 2 hours'
        ],
        atiTip: 'No insulin bolus in pediatric DKA and no insulin before fluids',
        highAlert: true
      },
      {
        name: 'Potassium Chloride (added to IV fluids)',
        brand: 'KCl',
        classification: 'Electrolyte replacement',
        dose: 'Typically 20-40 mEq/L added to the maintenance IV fluid once serum K is below 5.0-5.5 and urine output is established',
        action: 'Replaces the total body potassium deficit as insulin shifts potassium back into the cells',
        onset: 'Serum level responds during the infusion',
        sideEffects: ['Infusion site pain', 'Dysrhythmias if infused too rapidly', 'Cardiac arrest if given IV push'],
        nursingConsiderations: [
          'NEVER IV push',
          'Confirm urine output before adding potassium',
          'Maximum peripheral infusion rate 0.5 mEq/kg/hr',
          'Continuous cardiac monitoring is mandatory during replacement'
        ],
        atiTip: 'Serum potassium looks high in DKA but total body potassium is LOW - anticipate replacement, not restriction',
        highAlert: true
      },
      {
        name: 'Mannitol or 3 percent Hypertonic Saline',
        brand: 'Osmitrol / 3 percent NaCl',
        classification: 'Osmotic diuretic / hyperosmolar therapy',
        dose: 'Mannitol 0.5-1 g/kg IV, or 3 percent saline 2.5-5 mL/kg IV, per provider order for suspected cerebral edema',
        action: 'Draws water out of the brain parenchyma to reduce intracranial pressure',
        onset: 'Mannitol within 15-30 minutes',
        sideEffects: ['Hypotension from diuresis', 'Electrolyte derangement', 'Rebound intracranial pressure elevation'],
        nursingConsiderations: [
          'Keep at the bedside in any pediatric DKA - this is a time-critical drug',
          'Administer through a filter needle for mannitol; inspect for crystals',
          'Elevate the head of the bed 30 degrees and keep the head midline',
          'Anticipate ICU transfer and possible intubation'
        ],
        atiTip: 'Bicarbonate is NOT routinely given in pediatric DKA because it increases cerebral edema risk - the acidosis resolves with fluids and insulin',
        highAlert: true
      }
    ],

    dosageCalculations: [
      {
        id: 'peds-dka-calc1',
        text: 'The provider orders a 20 mL/kg normal saline bolus. The child weighs 30 kg. How many mL will the nurse infuse?',
        given: { weight: 30, orderedDose: '20 mL/kg' },
        answer: 600, unit: 'mL',
        steps: [
          { label: 'Multiply weight by the volume per kg', hint: '30 kg x 20 mL/kg', answer: '600', unit: 'mL' },
          { label: 'Confirm the sequence', hint: 'This bolus is given BEFORE the insulin infusion', answer: 'Fluids first', unit: '' }
        ],
        safeRange: 'Standard pediatric DKA initial bolus is 10-20 mL/kg of isotonic fluid; avoid excessive total volume',
        isSafe: true
      },
      {
        id: 'peds-dka-calc2',
        text: 'The insulin infusion is ordered at 0.1 unit/kg/hr. The pharmacy sends 100 units of regular insulin in 100 mL of normal saline. What pump rate in mL/hr will deliver the ordered dose to this 30 kg child?',
        given: { weight: 30, orderedDose: '0.1 unit/kg/hr', available: '100 units in 100 mL (1 unit/mL)' },
        answer: 3, unit: 'mL/hr',
        steps: [
          { label: 'Calculate the units per hour', hint: '30 kg x 0.1 unit/kg/hr', answer: '3', unit: 'units/hr' },
          { label: 'Determine the concentration', hint: '100 units divided by 100 mL', answer: '1', unit: 'unit/mL' },
          { label: 'Convert units/hr to mL/hr', hint: '3 units/hr divided by 1 unit/mL', answer: '3', unit: 'mL/hr' }
        ],
        safeRange: 'Standard pediatric DKA insulin infusion is 0.05-0.1 unit/kg/hr; insulin is a HIGH-ALERT drug requiring independent double-check',
        isSafe: true
      },
      {
        id: 'peds-dka-calc3',
        text: 'SAFE DOSE CHECK: A new order reads regular insulin 0.1 unit/kg IV PUSH now, then start the insulin infusion, then begin the saline bolus. Should the nurse carry out this order for this 30 kg child in DKA?',
        given: { weight: 30, orderedDose: '0.1 unit/kg IV push (3 units) before fluids' },
        answer: 0, unit: 'units of IV push insulin (no bolus is given)',
        steps: [
          { label: 'Calculate what the ordered bolus would be', hint: '30 kg x 0.1 unit/kg', answer: '3', unit: 'units' },
          { label: 'Check the sequence against pediatric DKA protocol', hint: 'Fluids ALWAYS precede insulin; an IV insulin bolus is not given in children', answer: 'Sequence is wrong', unit: '' },
          { label: 'Identify the harm', hint: 'Insulin before volume causes vascular collapse and a rapid osmolality shift that precipitates cerebral edema', answer: 'Cerebral edema and shock risk', unit: '' },
          { label: 'Decide the nursing action', hint: 'Hold the insulin, give the fluid bolus, and contact the prescriber to clarify', answer: 'Hold and clarify', unit: '' }
        ],
        safeRange: 'Pediatric DKA: NO IV insulin bolus. Continuous infusion 0.05-0.1 unit/kg/hr started only AFTER fluid resuscitation',
        isSafe: false
      },
      {
        id: 'peds-dka-calc4',
        text: 'The serum potassium has fallen to 4.6 and the child is producing 35 mL/hr of urine. The IV fluid now contains potassium chloride 40 mEq/L and is running at 75 mL/hr. How many mEq of potassium will the child receive in one hour, and is that within the safe rate of 0.5 mEq/kg/hr?',
        given: { weight: 30, orderedDose: 'KCl 40 mEq/L at 75 mL/hr', safeDoseRange: 'Maximum 0.5 mEq/kg/hr' },
        answer: 3, unit: 'mEq/hr',
        steps: [
          { label: 'Find the mEq per mL', hint: '40 mEq divided by 1000 mL equals 0.04 mEq/mL', answer: '0.04', unit: 'mEq/mL' },
          { label: 'Multiply by the hourly rate', hint: '0.04 mEq/mL x 75 mL/hr', answer: '3', unit: 'mEq/hr' },
          { label: 'Calculate the maximum safe rate', hint: '30 kg x 0.5 mEq/kg/hr', answer: '15', unit: 'mEq/hr' },
          { label: 'Compare', hint: '3 mEq/hr is well below the 15 mEq/hr ceiling', answer: 'Within safe range', unit: '' }
        ],
        safeRange: 'Peripheral potassium infusion should not exceed 0.5 mEq/kg/hr (15 mEq/hr for this child); urine output must be established first',
        isSafe: true
      }
    ],

    sbar: {
      situation: 'This is the RN caring for John Smith, an 8-year-old admitted with diabetic ketoacidosis secondary to new-onset Type 1 diabetes.',
      background: 'He presented with excessive thirst, frequent urination, weight loss, vomiting, abdominal pain, and lethargy.',
      assessment: 'Blood glucose is 568 mg/dL. Serum ketones are positive. VBG shows pH 7.18 and bicarbonate 10. Sodium is 130, potassium is 5.6, and BUN is 28. He remains tachycardic at 132 with Kussmaul respirations at 34 and is dehydrated.',
      recommendation: 'A 600 mL normal saline bolus has been started. I recommend continuing fluid resuscitation, initiating the insulin infusion per protocol, monitoring potassium closely, and performing hourly neurological assessments for cerebral edema.'
    },

    questions: [
      {
        id: 'peds-dka-q1',
        text: 'What is the PRIORITY treatment for this child on admission?',
        type: 'multiple-choice',
        options: [
          'Normal saline fluid bolus 600 mL',
          'Regular insulin IV infusion at 0.1 unit/kg/hr',
          'Sodium bicarbonate to correct the pH of 7.18',
          'Potassium chloride to prevent the anticipated hypokalemia'
        ],
        correct: [0],
        rationale: 'Fluid resuscitation is always the first treatment in DKA. The child is profoundly volume depleted from osmotic diuresis, and restoring perfusion begins correcting the acidosis before insulin is started. Insulin, bicarbonate, and potassium all come later or not at all.',
        atiPearl: 'Fluids before insulin. Memorize the order.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-dka-q2',
        text: 'Why are IV fluids given BEFORE insulin in pediatric DKA?',
        type: 'multiple-choice',
        options: [
          'To restore circulation and reduce the risk of cerebral edema',
          'To dilute the serum potassium before insulin lowers it',
          'Because insulin cannot be absorbed until the child is hydrated',
          'To wash the ketones out of the bloodstream'
        ],
        correct: [0],
        rationale: 'Insulin drives glucose and water into cells. Given into a depleted vascular space, it causes vascular collapse and a rapid drop in serum osmolality, shifting water into the brain. Volume expansion first protects perfusion and blunts that osmotic shift.',
        atiPearl: 'The reason is always cerebral edema - it is the answer to most pediatric DKA why questions.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-dka-q3',
        text: 'The initial potassium is 5.6 mEq/L. What is the nurse understanding of this value?',
        type: 'multiple-choice',
        options: [
          'Total body potassium is depleted and the serum level will fall rapidly once insulin is started',
          'The child has true hyperkalemia and potassium must be restricted for the admission',
          'The value is a lab error and should be redrawn before acting',
          'The elevated potassium means insulin should be withheld'
        ],
        correct: [0],
        rationale: 'Acidosis shifts potassium out of cells into the serum, masking a large total body deficit created by osmotic diuresis. Once insulin and fluids correct the acidosis, potassium moves back intracellularly and the serum level can plummet, causing dangerous dysrhythmias.',
        atiPearl: 'High serum K, low total body K - anticipate replacement, not restriction.',
        difficulty: 'Hard'
      },
      {
        id: 'peds-dka-q4',
        text: 'Which complication is MOST concerning in a child being treated for DKA?',
        type: 'multiple-choice',
        options: [
          'Cerebral edema',
          'Hyperglycemia rebound',
          'Deep vein thrombosis',
          'Aspiration pneumonia'
        ],
        correct: [0],
        rationale: 'Cerebral edema is the most serious and most feared complication of pediatric DKA, carrying high mortality and lasting neurologic morbidity. It typically develops within the first several hours of treatment and is why hourly neuro assessments are ordered.',
        atiPearl: 'Pediatric DKA plus complication equals cerebral edema.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-dka-q5',
        text: 'Which breathing pattern does the nurse expect to find in this child?',
        type: 'multiple-choice',
        options: [
          'Kussmaul respirations - deep and rapid',
          'Cheyne-Stokes respirations',
          'Shallow, slow respirations',
          'Biot respirations'
        ],
        correct: [0],
        rationale: 'Kussmaul respirations are deep, rapid breaths that blow off CO2 to compensate for the metabolic acidosis. This matches the documented RR of 34 and PaCO2 of 25. They are protective - never sedate or suppress them.',
        atiPearl: 'Kussmaul plus fruity breath plus high glucose equals DKA.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-dka-q6',
        text: 'Two hours into treatment the child develops a new headache, becomes confused, and vomits. What is the nurse PRIORITY action?',
        type: 'multiple-choice',
        options: [
          'Notify the provider immediately - these may indicate cerebral edema',
          'Administer an antiemetic and reassess in 30 minutes',
          'Increase the insulin infusion rate to lower the glucose faster',
          'Give acetaminophen for the headache and dim the lights'
        ],
        correct: [0],
        rationale: 'New headache, confusion, behavior change, and vomiting are EARLY signs of cerebral edema. The provider must be notified immediately; the insulin may be stopped if directed, and mannitol or hypertonic saline and ICU transfer are anticipated. Treating symptoms and waiting delays life-saving therapy.',
        atiPearl: 'Do not wait for bradycardia - by then it is too late.',
        difficulty: 'Hard'
      },
      {
        id: 'peds-dka-q7',
        text: 'Select ALL of the LATE signs of cerebral edema the nurse must recognize.',
        type: 'select-all',
        options: [
          'Bradycardia',
          'Hypertension with a widening pulse pressure',
          'Irregular respirations',
          'Seizures',
          'Tachycardia',
          'Polyuria'
        ],
        correct: [0, 1, 2, 3],
        rationale: 'Bradycardia, hypertension with a widening pulse pressure, and irregular respirations are the Cushing triad of raised intracranial pressure; seizures are also a late finding. Tachycardia is from the underlying dehydration and polyuria is a presenting DKA symptom, not a sign of cerebral edema.',
        atiPearl: 'Cushing triad: slow heart, high and widening BP, irregular breathing.',
        difficulty: 'Hard'
      },
      {
        id: 'peds-dka-q8',
        text: 'Why is sodium bicarbonate NOT routinely administered in pediatric DKA despite the pH of 7.18?',
        type: 'multiple-choice',
        options: [
          'It may increase the risk of cerebral edema, and the acidosis resolves with fluids and insulin',
          'It would raise the potassium to a dangerous level',
          'It cannot be given through the same line as insulin',
          'The acidosis in DKA is respiratory, not metabolic'
        ],
        correct: [0],
        rationale: 'Bicarbonate causes a paradoxical CNS acidosis and rapid osmolality shifts that increase cerebral edema risk in children. The metabolic acidosis of DKA corrects reliably with volume expansion and insulin, which stops ketone production at its source.',
        atiPearl: 'Treat the cause, not the number. No routine bicarb in pediatric DKA.',
        difficulty: 'Hard'
      },
      {
        id: 'peds-dka-q9',
        text: 'The glucose has fallen from 568 to 265 mg/dL and the insulin infusion is still running. What does the nurse anticipate?',
        type: 'multiple-choice',
        options: [
          'Adding dextrose to the IV fluid while continuing the insulin infusion',
          'Stopping the insulin infusion now that the glucose is nearly normal',
          'Cutting the insulin infusion rate in half and rechecking in 4 hours',
          'Giving a carbohydrate snack by mouth'
        ],
        correct: [0],
        rationale: 'The insulin infusion is treating the KETOSIS and acidosis, not just the glucose. When glucose reaches roughly 250-300 mg/dL, dextrose is added to the IV fluid so the insulin can continue safely without producing hypoglycemia.',
        atiPearl: 'Do not stop the insulin - feed the insulin with dextrose.',
        difficulty: 'Hard'
      },
      {
        id: 'peds-dka-q10',
        text: 'The sodium is 130 mEq/L. What is the nurse understanding of this finding?',
        type: 'multiple-choice',
        options: [
          'Dilutional hyponatremia from hyperglycemia, which corrects as the glucose normalizes with isotonic fluid',
          'True sodium depletion requiring immediate 3 percent hypertonic saline',
          'A sign of water intoxication from the fluid bolus',
          'An indication to restrict all IV fluid'
        ],
        correct: [0],
        rationale: 'Hyperglycemia pulls water into the vascular space and dilutes the measured sodium. It corrects on its own as glucose falls with isotonic fluid and insulin. Correcting sodium too rapidly with hypertonic saline risks osmotic demyelination and worsens the osmotic shift that drives cerebral edema.',
        atiPearl: 'Fix the glucose slowly and the sodium fixes itself.',
        difficulty: 'Hard'
      },
      {
        id: 'peds-dka-q11',
        text: 'How fast should the blood glucose be allowed to fall during treatment?',
        type: 'multiple-choice',
        options: [
          'No faster than about 50-100 mg/dL per hour',
          'As fast as possible to end the acidosis',
          'About 200 mg/dL per hour',
          'It does not matter as long as it does not go below 70'
        ],
        correct: [0],
        rationale: 'A controlled fall of roughly 50-100 mg/dL/hr lets brain cells equilibrate with the changing serum osmolality. Faster correction drives water into the brain and is the leading modifiable cause of cerebral edema in pediatric DKA.',
        atiPearl: 'Slow correction is safe correction.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-dka-q12',
        text: 'The parents ask what to do the next time their son gets sick with a stomach virus. Which response reflects correct sick-day management?',
        type: 'multiple-choice',
        options: [
          'Continue giving insulin even if he is eating less, encourage fluids, and check glucose and ketones more often',
          'Hold the insulin until he is eating normally again',
          'Cut the insulin dose in half whenever he skips a meal',
          'Only check ketones if the glucose is below 70'
        ],
        correct: [0],
        rationale: 'Illness raises counter-regulatory hormones and INCREASES insulin need even when intake drops. Never skip insulin. Encourage fluids, check glucose and ketones more frequently, and seek care for persistent vomiting, large ketones, difficulty breathing, increasing sleepiness, or confusion.',
        atiPearl: 'Never stop insulin during illness - stopping insulin is how children end up back in DKA.',
        difficulty: 'Medium'
      }
    ],

    keyPoints: [
      'Type 1 diabetes is autoimmune destruction of pancreatic beta cells resulting in absolute insulin deficiency',
      'DKA equals hyperglycemia plus ketosis plus metabolic acidosis plus severe dehydration',
      'Hyperglycemia causes osmotic diuresis, which drives the dehydration and electrolyte loss',
      'Classic findings: polyuria, polydipsia, weight loss, vomiting, abdominal pain, fruity breath, Kussmaul respirations',
      'Fluids ALWAYS come before insulin - 20 mL/kg equals 600 mL for this child',
      'Insulin is a continuous infusion at 0.1 unit/kg/hr with NO bolus in children',
      'Serum potassium looks high but total body potassium is depleted',
      'Cerebral edema is the most serious complication and requires hourly neuro assessments',
      'Bicarbonate is not routinely given because it increases cerebral edema risk'
    ],

    pearls: [
      'Type 1 Diabetes',
      'Hyperglycemia plus ketones plus metabolic acidosis',
      'Kussmaul respirations',
      'Fruity breath',
      'IV fluids FIRST',
      'Insulin infusion AFTER fluids',
      'Monitor potassium carefully even if initially elevated',
      'Hourly neurological assessments',
      'Cerebral edema is the most feared complication',
      'Never stop insulin during illness - follow sick-day rules'
    ],

    successChecklist: [
      'Perform hand hygiene and verify patient identity',
      'Assess airway, breathing, circulation, hydration, and neurological status',
      'Recognize classic DKA findings: polyuria, polydipsia, weight loss, vomiting, abdominal pain, Kussmaul respirations, and dehydration',
      'Review laboratory results and identify hyperglycemia, ketones, metabolic acidosis, and electrolyte abnormalities',
      'Administer the 600 mL normal saline bolus',
      'Start the insulin infusion only after fluid resuscitation',
      'Monitor blood glucose hourly and monitor potassium closely',
      'Perform hourly neurological assessments for signs of cerebral edema',
      'Maintain continuous cardiac monitoring and strict intake and output',
      'Educate the family, communicate using SBAR, and document all assessments and interventions'
    ],

    criticalErrors: [
      'Giving insulin before or without fluid resuscitation - causes vascular collapse and cerebral edema',
      'Administering an IV insulin bolus to a child in DKA - no bolus is given in pediatric protocols',
      'Allowing the blood glucose to fall faster than about 50-100 mg/dL/hr',
      'Stopping the insulin infusion when the glucose normalizes instead of adding dextrose - ketosis persists',
      'Giving sodium bicarbonate routinely for the pH of 7.18 - increases cerebral edema risk',
      'Correcting the sodium of 130 rapidly with hypertonic saline instead of letting it correct with the glucose',
      'Adding potassium to IV fluids before urine output is established, or giving potassium IV push',
      'Withholding potassium replacement because the initial serum level is 5.6 - total body potassium is depleted',
      'Missing or deferring the hourly neurological assessment',
      'Treating a new headache with analgesia instead of escalating for possible cerebral edema',
      'Sedating the child or suppressing the Kussmaul respirations, which are the only compensation for the acidosis',
      'Using latex products or dairy-containing supplements - this child is allergic to both'
    ],

    comparisons: [
      {
        title: 'DKA vs HHS',
        headers: ['Feature', 'DKA', 'HHS'],
        rows: [
          ['Common in', 'Type 1 DM', 'Type 2 DM'],
          ['Ketones', 'Present', 'Minimal/Absent'],
          ['Acidosis', 'Present', 'Usually absent'],
          ['Fruity breath', 'Yes', 'No'],
          ['Kussmaul respirations', 'Yes', 'No'],
          ['Blood glucose', 'Usually greater than 250 mg/dL', 'Often greater than 600 mg/dL'],
          ['Primary treatment', 'IV fluids + insulin', 'IV fluids + insulin']
        ]
      },
      {
        title: 'Cerebral Edema: Early vs Late Signs',
        headers: ['Early', 'Late'],
        rows: [
          ['Headache', 'Bradycardia'],
          ['Decreasing level of consciousness', 'Hypertension with widening pulse pressure'],
          ['Confusion and behavioral changes', 'Irregular respirations'],
          ['New or recurrent vomiting', 'Seizures'],
          ['Restlessness or unusual quietness', 'Posturing and pupillary changes']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting',
        line: 'I am so thirsty. Can I have water? I keep drinking and it never helps.' },
      { speaker: 'patient', trigger: 'assessment',
        line: 'My stomach hurts. And I feel like I am going to throw up again.' },
      { speaker: 'patient', trigger: 'pain',
        line: 'It is all over my belly. Maybe a five. It got worse this morning.' },
      { speaker: 'patient', trigger: 'loc',
        line: 'I just want to close my eyes for a minute. Is that okay? I am so tired.' },
      { speaker: 'patient', trigger: 'deterioration',
        line: 'My head really hurts. It did not hurt before. Where is my mom? Who are you?' },
      { speaker: 'family', trigger: 'greeting',
        line: 'He has been drinking water constantly for two weeks. Getting up three, four times a night to go to the bathroom. I thought it was a growth spurt.' },
      { speaker: 'family', trigger: 'assessment',
        line: 'He has lost weight. His jeans are falling off him. Why does his breath smell sweet like that?' },
      { speaker: 'family', trigger: 'diagnosis',
        line: 'Diabetes? He is eight. Nobody in our family has diabetes. Did I cause this? Was it something I fed him?' },
      { speaker: 'family', trigger: 'education',
        line: 'Wait, he has to have shots every day? For the rest of his life? How am I supposed to do that when he is at school?' },
      { speaker: 'family', trigger: 'deterioration',
        line: 'He just said he does not know who I am. He knows who I am. Please, something is wrong with him.' }
    ],

    patientEducation: [
      'Type 1 diabetes requires lifelong insulin - the pancreas no longer makes any',
      'Never skip insulin doses, even when he is not eating',
      'Check blood glucose regularly and record the results',
      'Monitor ketones during illness or any time the blood glucose is greater than 250 mg/dL',
      'Sick-day rules: continue insulin even when eating less, encourage fluids, and check glucose and ketones more frequently',
      'Rotate injection sites to prevent lipohypertrophy',
      'Recognize hypoglycemia (shakiness, sweating, confusion) and treat with 15 g of fast-acting carbohydrate, then recheck in 15 minutes',
      'Seek emergency care for persistent vomiting, large ketones, difficulty breathing, increasing sleepiness, or confusion',
      'Notify the school nurse and set up a diabetes management plan before returning to class',
      'This child is allergic to dairy and latex - verify all supplies and nutritional supplements'
    ]
  },

  /* ===========================================================================
   * 4. RSV BRONCHIOLITIS WITH HIGH FEVER
   * ======================================================================== */
  {
    id: 'peds-rsv-bronchiolitis',
    title: 'RSV Bronchiolitis',
    fullTitle: 'Respiratory Syncytial Virus (RSV) Bronchiolitis with High Fever',
    category: 'PEDS',
    course: 'NUR2310C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'VIRUS',
    summary: 'A 2-year-old with RSV-positive bronchiolitis presents with a temperature of 103.1 F, SpO2 91 percent on room air, retractions, and mild dehydration. Focus is oxygenation, nasal suctioning, hydration, fever control, and watching for apnea and respiratory failure.',
    highYield: true,

    objectives: [
      'Perform a focused respiratory assessment',
      'Assess oxygenation and work of breathing',
      'Monitor hydration',
      'Administer oxygen',
      'Perform nasal suctioning',
      'Administer medications safely',
      'Prevent respiratory deterioration',
      'Educate caregivers',
      'Communicate using SBAR',
      'Document care'
    ],

    patient: {
      name: 'John Smith',
      age: '2 years',
      sex: 'Male',
      weightKg: 12,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'RSV Bronchiolitis with High Fever',
      history: [
        'Fever for 3 days',
        'Cough',
        'Nasal congestion',
        'Poor appetite',
        'Increased work of breathing',
        'Decreased urine output',
        'Persistent fever despite acetaminophen at home'
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline - on arrival, room air',
        bp: '94/58', hr: 152, rr: 42, temp: '103.1 F (39.5 C)', spo2: 91,
        pain: 'Nonverbal for pain; FLACC 3 - fussy, restless',
        loc: 'Awake, fussy, consolable by the parent',
        other: 'Nasal flaring, intercostal retractions, expiratory wheezing with coarse crackles, thick nasal secretions, fewer wet diapers',
        flags: ['hypoxemia', 'tachycardia', 'tachypnea', 'fever', 'retractions', 'nasal-flaring'],
        note: 'Documented sim vitals. RR 42 exceeds the toddler range of 24-40, and HR 152 exceeds 90-140 - driven by fever, respiratory distress, and dehydration. SpO2 91 percent requires oxygen; the goal per order is greater than 95 percent.'
      },
      {
        atMin: 5,
        label: 'After oxygen and nasal suctioning - improvement',
        bp: '94/60', hr: 148, rr: 40, temp: '103.1 F', spo2: 94,
        pain: 'FLACC 3 - cried during suctioning, settled after',
        loc: 'Calmer, upright on the caregiver lap',
        other: 'Large amount of thick mucus suctioned from both nares, air movement improved bilaterally, retractions slightly less pronounced',
        flags: ['improving', 'tachycardia', 'fever'],
        note: 'Toddlers are obligate nose breathers, so clearing the nares is one of the highest-yield interventions in bronchiolitis. Saturation rose 3 points from suctioning alone. Fever is still driving the heart rate - acetaminophen is due.'
      },
      {
        atMin: 10,
        label: 'Deterioration - secretions reaccumulate',
        bp: '90/54', hr: 160, rr: 52, temp: '103.4 F', spo2: 89,
        pain: 'FLACC 5 - grimacing, difficult to console',
        loc: 'Restless, will not settle, no longer consolable',
        other: 'Grunting, head bobbing, tracheal tug, subcostal and suprasternal retractions, decreased air movement in the bases',
        flags: ['severe-hypoxemia', 'grunting', 'head-bobbing', 'worsening', 'notify-provider'],
        note: 'SpO2 has dropped below 90 percent, which triggers the standing order to notify the provider. Grunting is auto-PEEP - the child generating his own back pressure to keep alveoli open - and is a sign of significant distress in a toddler.'
      },
      {
        atMin: 15,
        label: 'Impending respiratory failure',
        bp: '84/48', hr: 72, rr: 14, temp: '103.4 F', spo2: 85,
        pain: 'Not responding to stimulation',
        loc: 'Lethargic, poorly responsive to the parent voice',
        other: 'Apneic pauses of 15-20 seconds, decreasing respiratory effort, diminished breath sounds throughout, circumoral cyanosis',
        flags: ['apnea', 'bradycardia', 'cyanosis', 'altered-loc', 'respiratory-failure', 'critical'],
        note: 'A falling respiratory rate and a falling heart rate in a hypoxic toddler are LATE, pre-arrest findings, not improvement. Apnea is a recognized and sudden complication of RSV in young children. Call the Rapid Response and prepare for advanced airway management.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'WBC', value: '12.4', unit: 'K/microL', status: 'normal',
        normalRange: '6.0-17.0 (toddler)',
        interpretation: 'Normal - viral infections commonly show a normal or only mildly elevated WBC' },
      { panel: 'CBC', name: 'Hemoglobin', value: '12.8', unit: 'g/dL', status: 'normal',
        normalRange: '10.5-13.5', interpretation: 'Normal' },
      { panel: 'CBC', name: 'Platelets', value: '310,000', unit: '/microL', status: 'normal',
        normalRange: '150,000-400,000', interpretation: 'Normal' },
      { panel: 'BMP', name: 'Sodium', value: '136', unit: 'mEq/L', status: 'normal',
        normalRange: '135-145', interpretation: 'Normal' },
      { panel: 'BMP', name: 'Potassium', value: '4.1', unit: 'mEq/L', status: 'normal',
        normalRange: '3.5-5.0', interpretation: 'Normal' },
      { panel: 'BMP', name: 'Chloride', value: '96', unit: 'mEq/L', status: 'low',
        normalRange: '98-106', interpretation: 'Slightly low' },
      { panel: 'BMP', name: 'BUN', value: '24', unit: 'mg/dL', status: 'high',
        normalRange: '5-18',
        interpretation: 'Elevated - suggests mild dehydration from poor oral intake, fever, and increased insensible losses from tachypnea' },
      { panel: 'BMP', name: 'Creatinine', value: '0.5', unit: 'mg/dL', status: 'high',
        normalRange: '0.2-0.5', interpretation: 'Upper limit of normal for a toddler; consistent with prerenal azotemia from dehydration. Recheck after rehydration - a value that does not fall would raise concern for intrinsic kidney injury.' },
      { panel: 'BMP', name: 'Glucose', value: '98', unit: 'mg/dL', status: 'normal',
        normalRange: '70-110', interpretation: 'Normal' },
      { panel: 'VBG', name: 'pH', value: '7.47', unit: '', status: 'high',
        normalRange: '7.35-7.45', interpretation: 'Slightly alkalotic' },
      { panel: 'VBG', name: 'pCO2', value: '30', unit: 'mmHg', status: 'low',
        normalRange: '35-45', interpretation: 'Low from hyperventilation secondary to respiratory distress' },
      { panel: 'VBG', name: 'HCO3', value: '22', unit: 'mEq/L', status: 'normal',
        normalRange: '22-26', interpretation: 'Normal - no metabolic compensation yet, meaning this is acute' }
    ],

    diagnostics: [
      { name: 'RSV Test', finding: 'Positive',
        interpretation: 'Confirms respiratory syncytial virus infection and mandates contact AND droplet precautions' },
      { name: 'Venous Blood Gas interpretation', finding: 'pH 7.47, pCO2 30, HCO3 22 - respiratory alkalosis',
        interpretation: 'The child is hyperventilating because of respiratory distress. A rising pCO2 on repeat gas would signal fatigue and impending respiratory failure' },
      { name: 'Continuous pulse oximetry', finding: '91 percent on room air at baseline',
        interpretation: 'Standing order requires provider notification if SpO2 falls below 90 percent' }
    ],

    orders: [
      { text: 'Vital signs every 15 minutes', category: 'monitoring' },
      { text: 'Oxygen to keep SpO2 greater than 95 percent', category: 'respiratory' },
      { text: 'Continuous cardiac monitoring', category: 'monitoring' },
      { text: 'Continuous pulse oximetry', category: 'monitoring' },
      { text: 'CBC', category: 'lab' },
      { text: 'BMP', category: 'lab' },
      { text: 'VBG/ABG', category: 'lab' },
      { text: 'Strict intake and output', category: 'monitoring' },
      { text: 'Nasal suctioning PRN', category: 'respiratory' },
      { text: 'Two peripheral IVs, largest gauge the child will tolerate (typically 22-24 gauge)', category: 'access' },
      { text: 'Contact and droplet precautions', category: 'monitoring' },
      { text: 'Normal saline at 45 mL/hr', category: 'medication' },
      { text: 'Acetaminophen 15 mg/kg PO', category: 'medication' },
      { text: 'Respiratory assessments every 15 minutes', category: 'monitoring' },
      { text: 'Notify provider if SpO2 less than 90 percent', category: 'monitoring' }
    ],

    interventions: [
      { id: 'rsv-1', order: 1,
        action: 'Assess airway, breathing, and circulation',
        rationale: 'ABCs first. Quantify the work of breathing: respiratory rate, nasal flaring, retractions, grunting, head bobbing, and air movement. In a toddler with small airways, even mild edema causes major obstruction.',
        category: 'assessment', critical: true, preventsDeterioration: false,
        atiPearl: 'ABCs before anything else' },
      { id: 'rsv-2', order: 2,
        action: 'Apply oxygen and titrate to keep SpO2 greater than 95 percent',
        rationale: 'SpO2 is 91 percent on room air, which is abnormal and requires oxygen therapy. Correcting hypoxemia reduces the work of breathing and myocardial oxygen demand while the underlying viral process runs its course.',
        category: 'intervention', critical: true, preventsDeterioration: true,
        atiPearl: 'Notify the provider if SpO2 drops below 90 percent' },
      { id: 'rsv-3', order: 3,
        action: 'Perform nasal suctioning',
        rationale: 'This is one of the MOST effective nursing interventions for RSV because infants and young toddlers are obligate nose breathers. Suction before feeding, before sleeping, and as needed for respiratory distress. Bulb or wall suction with saline drops clears the obstruction that oxygen alone cannot bypass.',
        category: 'intervention', critical: true, preventsDeterioration: true,
        atiPearl: 'Suctioning is treatment, not comfort care, in bronchiolitis' },
      { id: 'rsv-4', order: 4,
        action: 'Position in High Fowler or allow the child to sit upright on the caregiver lap',
        rationale: 'Upright positioning improves lung expansion and reduces the work of breathing. Letting the toddler sit on the caregiver lap also reduces crying, which itself increases oxygen consumption.',
        category: 'intervention', critical: true, preventsDeterioration: true,
        atiPearl: 'A calm child on a parent lap breathes better than a crying child in a crib' },
      { id: 'rsv-5', order: 5,
        action: 'Maintain hydration with normal saline at 45 mL/hr and monitor intake and output',
        rationale: 'The child has poor oral intake, fewer wet diapers, and an elevated BUN, indicating mild dehydration. Tachypnea increases insensible losses and makes safe oral feeding difficult. Monitor oral intake, wet diapers, and urine output.',
        category: 'intervention', critical: true, preventsDeterioration: false,
        atiPearl: 'Hydration thins secretions and is essential in bronchiolitis' },
      { id: 'rsv-6', order: 6,
        action: 'Administer acetaminophen 15 mg/kg PO (180 mg for this 12 kg child)',
        rationale: 'Reducing the temperature of 103.1 F lowers metabolic rate and oxygen demand, which directly reduces respiratory workload and heart rate. Fever control is a respiratory intervention in this child, not just a comfort measure.',
        category: 'medication', critical: true, preventsDeterioration: true,
        atiPearl: 'Lower the fever, lower the oxygen demand' },
      { id: 'rsv-7', order: 7,
        action: 'Perform respiratory assessments every 15 minutes',
        rationale: 'RSV bronchiolitis can deteriorate rapidly, and apnea is a recognized sudden complication in young children. Frequent structured reassessment is the only way to catch decreasing breath sounds, cyanosis, bradycardia, decreasing effort, lethargy, or apnea in time.',
        category: 'assessment', critical: true, preventsDeterioration: true,
        atiPearl: 'Watch closely for apnea and respiratory failure' }
    ],

    medications: [
      {
        name: 'Acetaminophen',
        brand: 'Tylenol',
        classification: 'Non-opioid analgesic and antipyretic',
        dose: '15 mg/kg PO equals 180 mg for this 12 kg child, every 4-6 hours',
        action: 'Inhibits central prostaglandin synthesis, resetting the hypothalamic set point to reduce fever',
        onset: '30-60 minutes PO; peak antipyretic effect 1-2 hours',
        sideEffects: ['Hepatotoxicity with overdose or cumulative dosing', 'Rash', 'Nausea'],
        nursingConsiderations: [
          'Maximum 15 mg/kg/dose, 5 doses in 24 hours, and no more than 75 mg/kg/day',
          'Ask exactly how much the parent has already given at home before dosing',
          'Verify the concentration - infant drops and childrens suspension differ',
          'Recheck the temperature 30-60 minutes after the dose',
          'Never give with another acetaminophen-containing combination product'
        ],
        atiTip: 'Lowering the fever reduces oxygen demand, which is a respiratory intervention in bronchiolitis',
        highAlert: false
      },
      {
        name: '0.9 percent Sodium Chloride (maintenance IV)',
        brand: 'NS',
        classification: 'Isotonic crystalloid',
        dose: '45 mL/hr continuous IV infusion',
        action: 'Maintains intravascular volume and hydration while oral intake is poor and insensible losses are increased by tachypnea and fever',
        onset: 'Continuous',
        sideEffects: ['Fluid overload', 'Peripheral edema', 'Worsening respiratory status if over-hydrated'],
        nursingConsiderations: [
          'Always run pediatric maintenance fluids on an infusion pump',
          'Strict intake and output; count wet diapers',
          'Assess lung sounds - bronchiolitis plus fluid overload worsens gas exchange',
          'Reassess whether oral intake can safely resume once the respiratory rate improves'
        ],
        atiTip: 'A toddler with a respiratory rate above 60 should not be fed by mouth - aspiration risk',
        highAlert: false
      },
      {
        name: 'Palivizumab',
        brand: 'Synagis',
        classification: 'Monoclonal antibody - RSV prophylaxis',
        dose: '15 mg/kg IM monthly during RSV season for eligible high-risk infants',
        action: 'Provides passive immunity against RSV F protein to PREVENT severe RSV disease',
        onset: 'Protective levels within days of injection',
        sideEffects: ['Injection site reaction', 'Fever', 'Rash', 'Rare anaphylaxis'],
        nursingConsiderations: [
          'It is NOT a vaccine and it does not treat active infection',
          'Given monthly during RSV season to eligible high-risk infants only',
          'Eligibility includes prematurity, congenital heart disease, and chronic lung disease',
          'Teach parents that a monthly injection schedule must be completed to maintain protection'
        ],
        atiTip: 'Palivizumab PREVENTS severe RSV in high-risk infants - it is a monoclonal antibody, NOT a vaccine',
        highAlert: false
      },
      {
        name: 'Albuterol (NOT routinely indicated)',
        brand: 'Proventil / Ventolin',
        classification: 'Short-acting beta-2 agonist',
        dose: 'Not routinely ordered in bronchiolitis; only if the provider identifies a significant bronchospastic component',
        action: 'Relaxes bronchial smooth muscle - but bronchiolitis obstruction is caused by airway EDEMA and thick mucus, not bronchospasm',
        onset: '5-15 minutes when used',
        sideEffects: ['Tachycardia', 'Tremor', 'Agitation - all of which increase oxygen demand in a distressed toddler'],
        nursingConsiderations: [
          'Routine bronchodilators are NOT recommended for bronchiolitis',
          'If a trial dose is given, an objective response must be documented or the drug is discontinued',
          'Question a routine standing albuterol order in an RSV patient'
        ],
        atiTip: 'Bronchiolitis equals edema plus mucus, so suctioning beats bronchodilators. This is an ATI favorite distractor',
        highAlert: false
      }
    ],

    dosageCalculations: [
      {
        id: 'peds-rsv-bronchiolitis-calc1',
        text: 'Acetaminophen is ordered at 15 mg/kg PO. The child weighs 12 kg. How many mg will the nurse administer?',
        given: { weight: 12, orderedDose: '15 mg/kg' },
        answer: 180, unit: 'mg',
        steps: [
          { label: 'Multiply weight by the dose per kg', hint: '12 kg x 15 mg/kg', answer: '180', unit: 'mg' },
          { label: 'Verify against the MAR', hint: 'The MAR reads acetaminophen 180 mg PO', answer: 'Matches', unit: '' }
        ],
        safeRange: 'Acetaminophen 10-15 mg/kg/dose PO every 4-6 hours; maximum 75 mg/kg/day and not more than 5 doses in 24 hours',
        isSafe: true
      },
      {
        id: 'peds-rsv-bronchiolitis-calc2',
        text: 'The pharmacy supplies acetaminophen oral suspension 160 mg per 5 mL. How many mL are needed to deliver the 180 mg dose? Round to the nearest tenth.',
        given: { orderedDose: '180 mg', available: '160 mg/5 mL' },
        answer: 5.6, unit: 'mL',
        steps: [
          { label: 'Set up desired over have times the volume', hint: '(180 mg divided by 160 mg) x 5 mL', answer: '5.625', unit: 'mL' },
          { label: 'Round to the nearest tenth for an oral syringe', hint: '5.625 rounds to 5.6', answer: '5.6', unit: 'mL' }
        ],
        safeRange: 'Measure with an oral syringe, never a kitchen spoon. Verify the concentration on the bottle before drawing up',
        isSafe: true
      },
      {
        id: 'peds-rsv-bronchiolitis-calc3',
        text: 'SAFE DOSE CHECK: A covering provider writes acetaminophen 325 mg PO now for this 12 kg child. The safe dose is 10-15 mg/kg/dose. Is this order safe to administer?',
        given: { weight: 12, orderedDose: '325 mg', safeDoseRange: '10-15 mg/kg/dose' },
        answer: 180, unit: 'mg (maximum safe dose for this child)',
        steps: [
          { label: 'Calculate the low end of the safe range', hint: '12 kg x 10 mg/kg', answer: '120', unit: 'mg' },
          { label: 'Calculate the high end of the safe range', hint: '12 kg x 15 mg/kg', answer: '180', unit: 'mg' },
          { label: 'Compare the order to the range', hint: '325 mg is about 27 mg/kg - nearly double the maximum single dose', answer: 'Exceeds safe range', unit: '' },
          { label: 'Decide the nursing action', hint: 'Hold the dose and clarify with the prescriber; 325 mg is an adult tablet strength', answer: 'Hold and clarify', unit: '' }
        ],
        safeRange: 'Safe single dose for 12 kg is 120-180 mg. 325 mg exceeds 15 mg/kg and risks hepatotoxicity, especially with doses already given at home',
        isSafe: false
      },
      {
        id: 'peds-rsv-bronchiolitis-calc4',
        text: 'Verify the maintenance IV fluid order of normal saline at 45 mL/hr using the 4-2-1 rule for this 12 kg child. Is the ordered rate appropriate?',
        given: { weight: 12, orderedDose: 'NS at 45 mL/hr', safeDoseRange: '4-2-1 rule: 4 mL/kg/hr for the first 10 kg, 2 mL/kg/hr for the next 10 kg, 1 mL/kg/hr thereafter' },
        answer: 44, unit: 'mL/hr (calculated maintenance)',
        steps: [
          { label: 'First 10 kg at 4 mL/kg/hr', hint: '10 kg x 4 mL/kg/hr', answer: '40', unit: 'mL/hr' },
          { label: 'Next 2 kg at 2 mL/kg/hr', hint: '2 kg x 2 mL/kg/hr', answer: '4', unit: 'mL/hr' },
          { label: 'Add the components', hint: '40 + 4', answer: '44', unit: 'mL/hr' },
          { label: 'Compare to the order', hint: '45 mL/hr is within 1 mL/hr of calculated maintenance', answer: 'Appropriate', unit: '' }
        ],
        safeRange: 'Calculated maintenance for 12 kg is 44 mL/hr; the ordered 45 mL/hr is clinically appropriate. Reassess for fluid overload with lung auscultation',
        isSafe: true
      }
    ],

    sbar: {
      situation: 'This is the RN caring for John Smith, a 2-year-old with RSV bronchiolitis. He has increasing respiratory distress and an oxygen saturation of 91 percent on room air.',
      background: 'He has had fever, cough, congestion, poor oral intake, and decreased urine output for three days. RSV testing is positive.',
      assessment: 'Current vital signs are HR 152, RR 42, temperature 103.1 F, and SpO2 91 percent. He has nasal flaring, intercostal retractions, wheezing, and coarse crackles.',
      recommendation: 'Oxygen has been initiated, acetaminophen has been administered, and nasal suctioning is planned. I recommend continued respiratory monitoring and reassessment after interventions.'
    },

    questions: [
      {
        id: 'peds-rsv-bronchiolitis-q1',
        text: 'What is the PRIORITY assessment for this 2-year-old with RSV bronchiolitis?',
        type: 'multiple-choice',
        options: [
          'Airway and breathing',
          'Number of wet diapers in the last 24 hours',
          'Immunization status',
          'Skin integrity under the pulse oximeter probe'
        ],
        correct: [0],
        rationale: 'ABCs come first. The child has nasal flaring, retractions, tachypnea, and a saturation of 91 percent - airway obstruction and impaired gas exchange are the immediate threats. Hydration, history, and skin assessment follow.',
        atiPearl: 'Airway and breathing are always the priority in a pediatric respiratory sim.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-rsv-bronchiolitis-q2',
        text: 'Which nursing intervention is MOST effective for improving this child breathing?',
        type: 'multiple-choice',
        options: [
          'Nasal suctioning, especially before feedings and sleep',
          'Administering scheduled nebulized albuterol',
          'Chest physiotherapy every 4 hours',
          'Administering a cough suppressant'
        ],
        correct: [0],
        rationale: 'Infants and young toddlers are obligate nose breathers, so clearing thick nasal secretions dramatically improves air entry. Routine bronchodilators are not recommended in bronchiolitis, chest physiotherapy has not been shown to help, and cough suppressants are contraindicated because coughing clears secretions.',
        atiPearl: 'Suctioning is the highest-yield intervention in bronchiolitis.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-rsv-bronchiolitis-q3',
        text: 'What is the oxygen saturation GOAL for this child per the provider order?',
        type: 'multiple-choice',
        options: [
          'Greater than 95 percent',
          'Greater than 88 percent',
          'Greater than 90 percent',
          '100 percent at all times'
        ],
        correct: [0],
        rationale: 'The standing order is to titrate oxygen to keep SpO2 greater than 95 percent, and to notify the provider if the saturation falls below 90 percent. Normal pediatric saturation is 95-100 percent; the 88-92 percent target belongs to adults with chronic CO2 retention.',
        atiPearl: 'Know the ordered target, not just the normal range.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-rsv-bronchiolitis-q4',
        text: 'The child suddenly becomes sleepy with decreasing respiratory effort and a respiratory rate that has dropped from 52 to 26. What is the PRIORITY action?',
        type: 'multiple-choice',
        options: [
          'Notify the provider immediately and prepare for advanced airway management',
          'Document that the child is finally resting and recheck in 15 minutes',
          'Reduce the oxygen because the respiratory rate has normalized',
          'Offer a bottle now that the child is calm'
        ],
        correct: [0],
        rationale: 'A falling respiratory rate with decreasing effort and lethargy in a previously tachypneic hypoxic toddler means exhaustion and impending respiratory failure, not improvement. Apnea is a known sudden complication of RSV. Escalate immediately.',
        atiPearl: 'A tiring child looks calmer right before they arrest.',
        difficulty: 'Hard'
      },
      {
        id: 'peds-rsv-bronchiolitis-q5',
        text: 'The BUN is 24 mg/dL. What is the MOST likely explanation?',
        type: 'multiple-choice',
        options: [
          'Mild dehydration from poor oral intake, fever, and increased insensible losses',
          'Acute kidney injury requiring nephrology consultation',
          'A high-protein diet',
          'A normal finding for a 2-year-old'
        ],
        correct: [0],
        rationale: 'Three days of fever, poor feeding, decreased urine output, and tachypnea have produced mild dehydration and decreased renal perfusion. The creatinine of 0.5, at the upper limit of normal for a toddler, supports this. Rehydration should normalize both values.',
        atiPearl: 'Elevated BUN plus poor intake plus fewer wet diapers equals dehydration.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-rsv-bronchiolitis-q6',
        text: 'Which medication prevents severe RSV disease in high-risk infants?',
        type: 'multiple-choice',
        options: [
          'Palivizumab (Synagis)',
          'Ribavirin',
          'Amoxicillin',
          'Dexamethasone'
        ],
        correct: [0],
        rationale: 'Palivizumab is a monoclonal antibody given monthly IM during RSV season to eligible high-risk infants such as those born prematurely or with congenital heart or chronic lung disease. It is prophylaxis, NOT a vaccine, and it does not treat active infection.',
        atiPearl: 'Palivizumab prevents, it does not treat, and it is not a vaccine.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-rsv-bronchiolitis-q7',
        text: 'Why is albuterol NOT routinely used for bronchiolitis?',
        type: 'multiple-choice',
        options: [
          'The obstruction is caused by airway edema and thick mucus, not bronchospasm',
          'Albuterol is contraindicated in children under 5 years of age',
          'It causes fatal dysrhythmias in toddlers',
          'It interacts with acetaminophen'
        ],
        correct: [0],
        rationale: 'Bronchiolitis obstructs the small airways through inflammatory edema and mucus plugging. A beta-2 agonist relaxes smooth muscle, which is not the primary problem, so most children show no benefit while gaining tachycardia and agitation. It is used only if the provider identifies a significant bronchospastic component.',
        atiPearl: 'Edema and mucus equals suction. Bronchospasm equals bronchodilator.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-rsv-bronchiolitis-q8',
        text: 'Which isolation precautions are required for this child?',
        type: 'multiple-choice',
        options: [
          'Contact AND droplet precautions',
          'Standard precautions only',
          'Airborne precautions with a negative pressure room',
          'Protective (reverse) isolation'
        ],
        correct: [0],
        rationale: 'RSV spreads through large respiratory droplets and direct contact with secretions, requiring both contact and droplet precautions: hand hygiene, gloves, gown, and a mask. Airborne precautions are reserved for tuberculosis, measles, and varicella.',
        atiPearl: 'RSV equals contact plus droplet.',
        difficulty: 'Easy'
      },
      {
        id: 'peds-rsv-bronchiolitis-q9',
        text: 'Select ALL of the LATE signs of impending respiratory failure in this toddler.',
        type: 'select-all',
        options: [
          'Decreased breath sounds',
          'Cyanosis',
          'Bradycardia',
          'Apnea',
          'Nasal flaring',
          'Tachypnea'
        ],
        correct: [0, 1, 2, 3],
        rationale: 'Decreased breath sounds, cyanosis, bradycardia, decreasing respiratory effort, lethargy, poor responsiveness, and apnea are LATE findings requiring immediate intervention. Nasal flaring, retractions, tachypnea, wheezing, restlessness, and tachycardia are EARLY compensatory signs.',
        atiPearl: 'When the child slows down, the emergency speeds up.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-rsv-bronchiolitis-q10',
        text: 'The temperature is 103.1 F. Beyond comfort, why is treating this fever a respiratory priority?',
        type: 'multiple-choice',
        options: [
          'Fever increases metabolic rate and oxygen demand, adding to the work of breathing',
          'Fever directly causes bronchospasm',
          'Fever prevents the RSV test from being accurate',
          'Fever causes the pulse oximeter to read falsely low'
        ],
        correct: [0],
        rationale: 'Every degree of fever raises oxygen consumption and carbon dioxide production, forcing an already compromised respiratory system to work harder. Lowering the temperature with acetaminophen reduces oxygen demand and heart rate, which is why it is an ordered intervention here.',
        atiPearl: 'Fever control is oxygen conservation in a child in respiratory distress.',
        difficulty: 'Medium'
      },
      {
        id: 'peds-rsv-bronchiolitis-q11',
        text: 'The parent asks to feed the child a bottle. The respiratory rate is currently 52. What is the nurse BEST response?',
        type: 'multiple-choice',
        options: [
          'Let us hold off on feeding until his breathing slows down - feeding at this rate risks aspiration; his IV fluids are keeping him hydrated',
          'Go ahead - anything he drinks will help his hydration',
          'He can have the bottle if you hold him flat so he does not choke',
          'He is NPO indefinitely because he has RSV'
        ],
        correct: [0],
        rationale: 'A toddler cannot coordinate suck, swallow, and breathe at a respiratory rate above about 60, and rates in the 50s with retractions carry real aspiration risk. IV fluids at 45 mL/hr maintain hydration. Suction the nares first, then reassess whether oral feeding is safe once the work of breathing improves.',
        atiPearl: 'Fast breathing plus a bottle equals aspiration.',
        difficulty: 'Hard'
      },
      {
        id: 'peds-rsv-bronchiolitis-q12',
        text: 'Select ALL of the discharge instructions the nurse should give the parents.',
        type: 'select-all',
        options: [
          'Use saline nose drops and suction the nose before feeding',
          'Encourage frequent small amounts of fluid',
          'Return immediately for blue lips, apnea, or increased work of breathing',
          'Count wet diapers and report a decrease',
          'Give an over-the-counter cough and cold medicine at bedtime',
          'Keep the child away from tobacco smoke'
        ],
        correct: [0, 1, 2, 3, 5],
        rationale: 'Saline drops with suctioning before feeds, frequent fluids, monitoring wet diapers, avoiding smoke exposure, and recognizing red flags such as blue lips, apnea, poor feeding, extreme sleepiness, and increased work of breathing are all correct. Over-the-counter cough and cold medications are NOT recommended for children under 6 and can cause serious harm.',
        atiPearl: 'No OTC cough and cold products in young children.',
        difficulty: 'Medium'
      }
    ],

    keyPoints: [
      'RSV is the most common cause of bronchiolitis in infants and young children',
      'Bronchiolitis is inflammation of the small bronchioles causing edema, mucus plugging, airway obstruction, and hypoxemia',
      'The most severe disease occurs in children younger than 2 years',
      'Risk factors: prematurity, congenital heart disease, chronic lung disease, immunodeficiency, age under 2, tobacco smoke exposure',
      'Normal toddler respiratory rate is 24-40; this child is 42',
      'VBG shows respiratory alkalosis (pH 7.47, pCO2 30) from hyperventilation - a rising pCO2 would signal failure',
      'Acetaminophen dose is 15 mg/kg, which is 180 mg for this 12 kg child',
      'Routine bronchodilators are NOT recommended because the problem is edema and mucus, not bronchospasm',
      'Apnea is a sudden and recognized complication of RSV in young children'
    ],

    pearls: [
      'Infants and toddlers under 2 years are at highest risk',
      'Nasal flaring, retractions, wheezing, and crackles',
      'Nasal suctioning is one of the most effective interventions',
      'Oxygen to maintain SpO2 greater than 95 percent',
      'Hydration is essential',
      'Contact and droplet precautions',
      'Acetaminophen for fever',
      'Palivizumab (Synagis) prevents severe RSV in high-risk infants - it is not a vaccine',
      'Watch closely for apnea and respiratory failure',
      'Young children are obligate nose breathers - a blocked nose is a blocked airway'
    ],

    successChecklist: [
      'Perform hand hygiene and verify patient identity',
      'Assess airway, breathing, circulation, and work of breathing',
      'Assess respiratory rate, retractions, nasal flaring, wheezing, and crackles',
      'Check oxygen saturation and begin oxygen therapy to maintain SpO2 greater than 95 percent',
      'Perform nasal suctioning before feeding and as needed',
      'Administer acetaminophen 180 mg PO and maintain IV fluids at 45 mL/hr NS',
      'Monitor hydration: intake and output, wet diapers, mucous membranes',
      'Maintain contact and droplet precautions',
      'Reassess respiratory status every 15 minutes and notify the provider if SpO2 falls below 90 percent or the child develops worsening respiratory distress',
      'Educate the parents and document all assessments and interventions'
    ],

    criticalErrors: [
      'Delaying or skipping nasal suctioning - young children are obligate nose breathers and a plugged nose is an obstructed airway',
      'Laying the child flat instead of keeping him upright or on the caregiver lap',
      'Administering routine albuterol as if this were asthma without a documented bronchospastic response',
      'Failing to notify the provider when SpO2 falls below 90 percent as the standing order requires',
      'Interpreting a falling respiratory rate and rising drowsiness as improvement rather than exhaustion',
      'Feeding the child by mouth while the respiratory rate is above 60 - aspiration risk',
      'Suctioning too deeply or too frequently, causing mucosal trauma, vagal bradycardia, and edema',
      'Using contact precautions only and omitting droplet precautions and a mask',
      'Giving an over-the-counter cough and cold preparation or aspirin to a child',
      'Exceeding 15 mg/kg per dose of acetaminophen or failing to account for doses already given at home',
      'Overhydrating with IV fluid, which worsens gas exchange in inflamed small airways',
      'Leaving a toddler with RSV unmonitored - apnea can be sudden and silent'
    ],

    comparisons: [
      {
        title: 'RSV Bronchiolitis vs Asthma',
        headers: ['RSV Bronchiolitis', 'Asthma'],
        rows: [
          ['Usually under 2 years', 'Any age'],
          ['Viral bronchiolitis', 'Chronic inflammatory disease'],
          ['Thick mucus + edema', 'Bronchospasm'],
          ['Nasal suctioning is essential', 'Bronchodilators are first-line'],
          ['Wheezing + crackles', 'Wheezing predominates'],
          ['Supportive care', 'Bronchodilators + steroids']
        ]
      },
      {
        title: 'Impending Respiratory Failure: Early vs Late',
        headers: ['Early', 'Late'],
        rows: [
          ['Tachypnea', 'Decreased breath sounds'],
          ['Nasal flaring', 'Cyanosis'],
          ['Retractions', 'Bradycardia'],
          ['Wheezing', 'Decreasing respiratory effort'],
          ['Restlessness', 'Lethargy and poor responsiveness'],
          ['Tachycardia', 'Apnea']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting',
        line: 'Mama. Up. Up!' },
      { speaker: 'patient', trigger: 'assessment',
        line: '(coughing hard, then a wet gurgling breath) No... no touch.' },
      { speaker: 'patient', trigger: 'suctioning',
        line: '(screaming and pushing the nurse hand away) Nooo! Mama! All done! All done!' },
      { speaker: 'patient', trigger: 'comfort',
        line: '(whimpering into the parent shoulder) Hurts. Bankie.' },
      { speaker: 'patient', trigger: 'deterioration',
        line: '(no words, only soft grunting with each breath, eyes half closed)' },
      { speaker: 'family', trigger: 'greeting',
        line: 'He has had a fever for three days. I have been giving him Tylenol around the clock and it just keeps coming back up over 103.' },
      { speaker: 'family', trigger: 'assessment',
        line: 'Look at his little ribs pulling in like that when he breathes. He has never done that before. Is that bad?' },
      { speaker: 'family', trigger: 'suctioning',
        line: 'Do you really have to do that to his nose? He hates it so much. Can we skip it just this once?' },
      { speaker: 'family', trigger: 'hydration',
        line: 'He will not take his bottle. Maybe two ounces all day. And he has only had one wet diaper since this morning.' },
      { speaker: 'family', trigger: 'deterioration',
        line: 'He stopped breathing for a second. I counted. Please, he just stopped. Somebody help him.' }
    ],

    patientEducation: [
      'Use saline nose drops and suction the nose before every feeding and before sleep',
      'Encourage frequent small amounts of fluid rather than large volumes',
      'Count wet diapers - fewer than normal means he needs to be seen',
      'Keep the child away from tobacco smoke, which worsens airway inflammation',
      'Do NOT give over-the-counter cough and cold medications to a child under 6 years',
      'Give acetaminophen only at the weight-based dose and track every dose given',
      'RSV spreads by droplets and contact - wash hands often and keep the child home from daycare while symptomatic',
      'Return immediately for increased work of breathing, blue lips, apnea, poor feeding, fewer wet diapers, or extreme sleepiness',
      'High-risk infants may be eligible for monthly palivizumab (Synagis) injections during RSV season'
    ]
  }

];
