/* =============================================================================
 * data/signoff-drugs.js  ->  window.SIGNOFF_DRUGS
 * -----------------------------------------------------------------------------
 * The instructor's allow-list for the Med Admin Signoff skills check.
 * Values transcribed from /SIGNOFF_SPEC/spec.md. If a value is uncertain the
 * record carries verify:true and criticalConsiderations names what to confirm.
 * DO NOT ADD DRUGS not present in this list without instructor sign-off.
 * ========================================================================== */
(function () {
  'use strict';

  var DRUGS = [
    {
      id: 'tamsulosin', generic: 'tamsulosin', brand: 'Flomax',
      klass: 'Alpha-1 adrenergic blocker (BPH)',
      routes: ['PO'],
      usualAdultDose: '0.4 mg PO once daily, 30 min after the same meal each day',
      highAlert: false,
      holdParameters: ['SBP <100 or symptomatic orthostasis'],
      onset: 'Days for BPH benefit', peak: '4-8 hr (drug level)', duration: '~24 hr',
      keyTeaching: [
        'First-dose orthostatic hypotension - take at bedtime and change positions slowly',
        'Do NOT crush, chew, or open the capsule',
        'Take 30 min after the same meal each day',
        'Report dizziness, fainting, or priapism (>4 hr erection)'
      ],
      criticalConsiderations: [
        'Floppy iris syndrome during cataract surgery - tell ophthalmologist',
        'Combine cautiously with other antihypertensives and PDE-5 inhibitors',
        'Not a diuretic - does not treat urinary retention that is truly obstructed'
      ],
      sideEffects: ['Dizziness', 'Orthostatic hypotension', 'Retrograde ejaculation', 'Headache', 'Rhinitis'],
      antidote: null, ivPushRate: null
    },
    {
      id: 'percocet', generic: 'oxycodone / acetaminophen', brand: 'Percocet',
      klass: 'Opioid + non-opioid analgesic combination',
      routes: ['PO'],
      usualAdultDose: '1-2 tabs PO q4-6h PRN pain (e.g. 5/325 mg)',
      highAlert: true,
      holdParameters: ['RR <12', 'Sedation scale >=3', 'SpO2 <92% on room air'],
      onset: '10-30 min', peak: '30-60 min', duration: '3-6 hr',
      keyTeaching: [
        'Do not exceed 4 g acetaminophen/day (3 g if liver disease or elderly)',
        'Add up ALL acetaminophen sources - Tylenol, combo cold meds',
        'Take with food if GI upset; use stool softener for opioid constipation',
        'No alcohol - additive liver toxicity and sedation'
      ],
      criticalConsiderations: [
        'Opioid antidote is naloxone (Narcan)',
        'Cumulative APAP dose is the classic trap',
        'Pain reassess within 60 min PO'
      ],
      sideEffects: ['Sedation', 'Constipation', 'N/V', 'Pruritus', 'Respiratory depression'],
      antidote: 'naloxone (for opioid); N-acetylcysteine (for acetaminophen overdose)', ivPushRate: null
    },
    {
      id: 'bisacodyl', generic: 'bisacodyl', brand: 'Dulcolax',
      klass: 'Stimulant laxative',
      routes: ['PO', 'PR'],
      usualAdultDose: 'PO 5-15 mg once daily; PR 10 mg once daily',
      highAlert: false, holdParameters: ['Suspected bowel obstruction / ileus'],
      onset: 'PO 6-12 hr; PR 15-60 min', peak: 'Variable', duration: 'Single-dose',
      keyTeaching: [
        'Swallow enteric tab whole - do NOT crush or chew',
        'No dairy or antacids within 1 hr (dissolves the enteric coating)',
        'Expect cramping; drink fluids',
        'Not for chronic daily use without provider guidance'
      ],
      criticalConsiderations: [
        'Avoid in acute abdomen or GI bleed',
        'Fluid/electrolyte loss with overuse'
      ],
      sideEffects: ['Cramps', 'Nausea', 'Rectal burning (PR)', 'Diarrhea'],
      antidote: null, ivPushRate: null
    },
    {
      id: 'erythromycin', generic: 'erythromycin', brand: 'E-Mycin, Ery-Tab',
      klass: 'Macrolide antibiotic',
      routes: ['PO', 'IV', 'Ophthalmic', 'Topical'],
      usualAdultDose: 'PO 250-500 mg q6h; IV 15-20 mg/kg/day divided',
      highAlert: false,
      holdParameters: ['QTc prolongation or known long QT'],
      onset: '1 hr', peak: '1-4 hr PO', duration: '6 hr',
      keyTeaching: [
        'Take with food if GI upset (very common)',
        'Report palpitations, syncope - QT prolongation',
        'Finish full course even if you feel better',
        'Ophthalmic ointment: neonatal eye prophylaxis'
      ],
      criticalConsiderations: [
        'QT prolongation - avoid with other QT-prolonging drugs',
        'Strong CYP3A4 inhibitor - many interactions (statins, warfarin, digoxin)',
        'IV infusion over 20-60 min; rapid infusion causes phlebitis'
      ],
      sideEffects: ['N/V/D', 'Abdominal cramping', 'QT prolongation', 'Ototoxicity (high dose)'],
      antidote: null, ivPushRate: 'IV infusion over 20-60 min; not IV push'
    },
    {
      id: 'vancomycin', generic: 'vancomycin', brand: 'Vancocin',
      klass: 'Glycopeptide antibiotic',
      routes: ['IV', 'PO (for C. diff only)'],
      usualAdultDose: 'IV 15-20 mg/kg q8-12h; PO 125 mg q6h for C. diff',
      highAlert: false,
      holdParameters: ['Trough outside target', 'Rising creatinine'],
      onset: 'IV rapid; PO not systemically absorbed', peak: 'End of infusion', duration: '~8-12 hr',
      keyTeaching: [
        'IV infuses over AT LEAST 60 min (1 g). Never IV push',
        'Report flushing/itching during infusion - slow the rate',
        'Report ringing in ears or decreased urine output',
        'PO form treats C. diff only - not absorbed systemically'
      ],
      criticalConsiderations: [
        'Rapid infusion causes vancomycin infusion reaction (formerly "red man syndrome") - histamine release, NOT a true allergy',
        'Nephrotoxic and ototoxic - monitor trough 15-20 mcg/mL for serious infection',
        'Check renal function before every dose in unstable patients'
      ],
      sideEffects: ['Infusion reaction/flushing', 'Nephrotoxicity', 'Ototoxicity', 'Thrombophlebitis'],
      antidote: null, ivPushRate: 'IV infusion over >=60 min per 1 g; NEVER IV push'
    },
    {
      id: 'hctz', generic: 'hydrochlorothiazide', brand: 'HCTZ, Microzide',
      klass: 'Thiazide diuretic',
      routes: ['PO'],
      usualAdultDose: '12.5-25 mg PO once daily in AM',
      highAlert: false,
      holdParameters: ['SBP <100', 'K+ <3.5', 'Na+ <130'],
      onset: '2 hr', peak: '4-6 hr', duration: '6-12 hr',
      keyTeaching: [
        'Take in the morning to avoid nighttime bathroom trips',
        'Report muscle cramps, weakness, dizziness (electrolytes)',
        'Sun sensitivity - wear sunscreen',
        'Rise slowly - orthostatic hypotension'
      ],
      criticalConsiderations: [
        'Low K+, low Na+, HIGH Ca+, high glucose, high uric acid',
        'Sulfa allergy cross-sensitivity possible',
        'Enhances lithium toxicity'
      ],
      sideEffects: ['Hypokalemia', 'Hyponatremia', 'Photosensitivity', 'Hyperglycemia', 'Hyperuricemia'],
      antidote: null, ivPushRate: null
    },
    {
      id: 'digoxin', generic: 'digoxin', brand: 'Lanoxin',
      klass: 'Cardiac glycoside',
      routes: ['PO', 'IV'],
      usualAdultDose: 'PO/IV 0.125-0.25 mg once daily',
      highAlert: true,
      holdParameters: ['Apical HR <60 adult (<70 child, <90 infant)', 'K+ <3.5 or >5.0', 'Level >2 ng/mL'],
      onset: 'PO 30-120 min; IV 5-30 min', peak: 'PO 2-8 hr; IV 1-4 hr', duration: '3-4 days',
      keyTeaching: [
        'Take apical pulse for full 60 sec before every dose - hold if <60',
        'Report N/V, yellow-green halos, confusion (toxicity)',
        'Do not double a missed dose',
        'Report new palpitations or fainting'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication',
        'IV push over AT LEAST 5 min - "Rapid IV push" is a TRAP, refuse and clarify',
        'Low K+, low Mg+, high Ca+ potentiate toxicity',
        'Therapeutic level 0.5-2 ng/mL',
        'Antidote is digoxin immune Fab (DigiFab)'
      ],
      sideEffects: ['Bradycardia/AV block', 'N/V/anorexia', 'Visual halos', 'Confusion'],
      antidote: 'digoxin immune Fab (DigiFab)', ivPushRate: 'IV push over >=5 min (undiluted or diluted)'
    },
    {
      id: 'warfarin', generic: 'warfarin', brand: 'Coumadin, Jantoven',
      klass: 'Vitamin K antagonist anticoagulant',
      routes: ['PO'],
      usualAdultDose: 'Individualized to INR target (typical start 2-5 mg PO once daily)',
      highAlert: true,
      holdParameters: ['INR above therapeutic range', 'Active bleeding'],
      onset: '24-72 hr', peak: '3-5 days', duration: '2-5 days',
      keyTeaching: [
        'Consistent vitamin K intake - green leafy vegetables stay CONSISTENT, not avoided',
        'Report bruising, black tarry stool, pink/red urine, prolonged nosebleeds',
        'Soft toothbrush, electric razor',
        'Many drug interactions - clear all new meds/supplements with pharmacist'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication',
        'Monitor INR (goal 2-3; mechanical mitral valve 2.5-3.5)',
        'Reversal: vitamin K (phytonadione); FFP or 4-factor PCC for severe bleed',
        'Teratogenic - Category X'
      ],
      sideEffects: ['Bleeding', 'Bruising', 'Purple toe syndrome', 'Skin necrosis (early)'],
      antidote: 'vitamin K (phytonadione); FFP/PCC for severe bleed', ivPushRate: null
    },
    {
      id: 'heparin', generic: 'heparin', brand: 'Heparin',
      klass: 'Indirect thrombin inhibitor anticoagulant',
      routes: ['SubQ', 'IV'],
      usualAdultDose: 'SubQ 5,000 units q8-12h prophylaxis; IV weight-based per protocol',
      highAlert: true,
      holdParameters: ['aPTT above therapeutic range', 'Platelets <100k (HIT concern)', 'Active bleeding'],
      onset: 'IV immediate; SubQ 20-60 min', peak: 'IV minutes; SubQ 2 hr', duration: '2-6 hr',
      keyTeaching: [
        'SubQ: pinch, insert 90 deg into abdomen at least 2 in from umbilicus',
        'DO NOT aspirate. DO NOT rub or massage the site',
        'Rotate injection sites',
        'Report bleeding, easy bruising, or dark stools'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication - independent double-check for IV drips',
        'Monitor aPTT / anti-Xa for IV drip; no routine monitoring for prophy SubQ',
        'Watch platelets - HIT (heparin-induced thrombocytopenia)',
        'Reversal: protamine sulfate'
      ],
      sideEffects: ['Bleeding', 'Bruising', 'HIT', 'Injection-site hematoma'],
      antidote: 'protamine sulfate', ivPushRate: 'Bolus per protocol only; drip via pump with double-check'
    },
    {
      id: 'nystatin', generic: 'nystatin', brand: 'Mycostatin',
      klass: 'Antifungal (polyene)',
      routes: ['PO suspension', 'Topical', 'PO tab (troche)'],
      usualAdultDose: 'PO 4-6 mL swish-and-swallow QID (100,000 units/mL)',
      highAlert: false, holdParameters: [],
      onset: 'Local within days', peak: 'N/A', duration: 'Q6h dosing',
      keyTeaching: [
        'Swish suspension in mouth AT LEAST 1-2 min before swallowing (or spit if aspiration risk)',
        'Give AFTER meals and oral care for maximum contact time',
        'Continue for at least 48 hr after symptoms resolve',
        'Not absorbed systemically from GI tract'
      ],
      criticalConsiderations: [
        'Remove dentures before swishing; clean dentures separately',
        'Report burning or worsening white patches'
      ],
      sideEffects: ['Nausea', 'GI upset', 'Local irritation'],
      antidote: null, ivPushRate: null
    },
    {
      id: 'docusate', generic: 'docusate sodium', brand: 'Colace',
      klass: 'Stool softener (surfactant)',
      routes: ['PO', 'PR'],
      usualAdultDose: 'PO 100 mg BID; range 50-300 mg/day',
      highAlert: false, holdParameters: ['Suspected bowel obstruction'],
      onset: '12-72 hr', peak: 'Variable', duration: 'While dosing continues',
      keyTeaching: [
        'Take with a full glass of water',
        'Increase fluids and fiber',
        'Not a stimulant - softens stool, does not "make you go"',
        'Report abdominal pain'
      ],
      criticalConsiderations: [
        'Avoid concurrent mineral oil (increased absorption)'
      ],
      sideEffects: ['Mild cramping', 'Diarrhea', 'Throat irritation (liquid)'],
      antidote: null, ivPushRate: null
    },
    {
      id: 'dilantin', generic: 'phenytoin', brand: 'Dilantin',
      klass: 'Hydantoin anticonvulsant',
      routes: ['PO', 'IV'],
      usualAdultDose: 'Maintenance 300-400 mg/day PO; loading per protocol',
      highAlert: true,
      holdParameters: ['Level >20 mcg/mL', 'Symptomatic bradycardia/hypotension during infusion'],
      onset: 'PO 2-24 hr; IV within minutes for loading', peak: 'PO 1.5-3 hr', duration: '12-36 hr',
      keyTeaching: [
        'Good oral care - brush and floss (gingival hyperplasia)',
        'Do not stop abruptly - status epilepticus risk',
        'Shake suspension well - uneven mix causes toxic/subtherapeutic doses',
        'Report rash immediately (SJS/TEN risk)'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication',
        'IV: use in-line FILTER, SALINE ONLY - precipitates in dextrose',
        'IV push <=50 mg/min adult (<=25 mg/min elderly) - faster causes hypotension, arrhythmia',
        'Level 10-20 mcg/mL therapeutic; free level 1-2 mcg/mL',
        'Many drug interactions (CYP inducer)'
      ],
      sideEffects: ['Gingival hyperplasia', 'Nystagmus', 'Ataxia', 'Rash/SJS', 'Hirsutism'],
      antidote: null, ivPushRate: 'IV push <=50 mg/min (adult); <=25 mg/min elderly'
    },
    {
      id: 'lasix', generic: 'furosemide', brand: 'Lasix',
      klass: 'Loop diuretic',
      routes: ['PO', 'IV', 'IM'],
      usualAdultDose: 'PO/IV 20-80 mg once or twice daily',
      highAlert: false,
      holdParameters: ['SBP <90', 'K+ <3.5', 'Symptomatic dehydration'],
      onset: 'PO 30-60 min; IV 5 min', peak: 'PO 1-2 hr; IV 30 min', duration: 'PO 6-8 hr; IV 2 hr',
      keyTeaching: [
        'Take AM dose early so you are not up urinating all night',
        'Rise slowly - orthostasis',
        'Report muscle cramps, weakness, ringing in ears',
        'Daily weights; report weight gain >2 lb in 24 hr'
      ],
      criticalConsiderations: [
        'IV push over 1-2 min - rapid push causes OTOTOXICITY',
        'Monitor K+ (low), Na+, Mg+, BUN/Cr, BP, weight',
        'Sulfa allergy cross-sensitivity possible',
        'Potentiates digoxin toxicity via hypokalemia'
      ],
      sideEffects: ['Hypokalemia', 'Hyponatremia', 'Ototoxicity', 'Dehydration', 'Hyperglycemia'],
      antidote: null, ivPushRate: 'IV push over 1-2 min (max 40 mg/min); no faster'
    },
    {
      id: 'kcl', generic: 'potassium chloride', brand: 'K-Dur, Klor-Con, KCl',
      klass: 'Electrolyte replacement',
      routes: ['PO', 'IV (infusion only)'],
      usualAdultDose: 'PO 20-40 mEq/dose; IV 10 mEq/hr peripheral, 20 mEq/hr central',
      highAlert: true,
      holdParameters: ['K+ >5.0', 'Anuria/oliguria', 'No IV access if IV ordered'],
      onset: 'PO 30 min; IV per infusion', peak: 'Variable', duration: 'Per replacement',
      keyTeaching: [
        'Take PO with FOOD and a full glass of water',
        'Do NOT crush, chew, or dissolve ER tablets in mouth',
        'Report burning at IV site immediately',
        'Report muscle weakness, palpitations, GI symptoms'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication',
        'NEVER IV push - fatal arrhythmia',
        'IV MUST be diluted; max 10 mEq/hr peripheral, 20 mEq/hr central',
        'Use pump; independent double-check',
        'Hold if K+ >5.0'
      ],
      sideEffects: ['GI upset', 'Burning at IV site', 'Hyperkalemia', 'Arrhythmia (if pushed)'],
      antidote: null, ivPushRate: 'NEVER IV push. IV infusion only via pump.'
    },
    {
      id: 'plavix', generic: 'clopidogrel', brand: 'Plavix',
      klass: 'Antiplatelet (P2Y12 inhibitor)',
      routes: ['PO'],
      usualAdultDose: '75 mg PO once daily (loading 300-600 mg)',
      highAlert: false,
      holdParameters: ['Active bleeding', 'Scheduled surgery within 5-7 days'],
      onset: '2 hr', peak: '6 hr', duration: '5 days after last dose',
      keyTeaching: [
        'Report unusual bleeding, bruising, black stools',
        'Do not stop without provider - stent thrombosis risk',
        'Tell dentists/surgeons - hold about 5-7 days before elective procedure',
        'Avoid grapefruit juice (CYP interaction)'
      ],
      criticalConsiderations: [
        'Additive bleeding risk with NSAIDs, ASA, anticoagulants',
        'PPI omeprazole may reduce efficacy'
      ],
      sideEffects: ['Bleeding', 'Bruising', 'TTP (rare)', 'GI upset'],
      antidote: null, ivPushRate: null
    },
    {
      id: 'synthroid', generic: 'levothyroxine', brand: 'Synthroid, Levoxyl',
      klass: 'Thyroid hormone (T4)',
      routes: ['PO', 'IV'],
      usualAdultDose: '1.6 mcg/kg/day PO (typical 50-150 mcg once daily)',
      highAlert: false,
      holdParameters: ['New-onset chest pain, tachyarrhythmia'],
      onset: 'PO 3-5 days', peak: '1-3 wk', duration: '1-3 wk',
      keyTeaching: [
        'Take in the AM on an EMPTY STOMACH, at least 30-60 min before food',
        'Full glass of water; stand upright 30 min',
        'Separate from calcium, iron, antacids by 4 hr',
        'Lifelong therapy - do not stop; report chest pain, palpitations'
      ],
      criticalConsiderations: [
        'IV dose is roughly HALF the PO dose - big trap when converting',
        'Watch for hyperthyroid signs (tachy, tremor, heat intolerance)',
        'Increases warfarin effect (monitor INR)'
      ],
      sideEffects: ['Palpitations', 'Tremor', 'Insomnia', 'Weight loss', 'Heat intolerance'],
      antidote: null, ivPushRate: 'IV push over 1-2 min if converting acutely'
    },
    {
      id: 'zolpidem', generic: 'zolpidem', brand: 'Ambien',
      klass: 'Non-benzodiazepine sedative-hypnotic',
      routes: ['PO', 'SL'],
      usualAdultDose: '5-10 mg PO at bedtime (5 mg female / elderly)',
      highAlert: false,
      holdParameters: ['Sedation', 'Confusion', 'Respiratory depression', 'Concurrent CNS depressants'],
      onset: '30 min', peak: '1.5 hr', duration: '6-8 hr',
      keyTeaching: [
        'Take IMMEDIATELY before bed - lights out, phone down',
        'Only if you have at least 7-8 hr to sleep',
        'Do not drink alcohol',
        'Report sleep-walking, sleep-driving, sleep-eating (complex sleep behaviors)'
      ],
      criticalConsiderations: [
        'FALL RISK - call bell in reach, bed low',
        'Elderly - reduced dose; higher confusion/fall risk',
        'Not for daytime anxiety'
      ],
      sideEffects: ['Drowsiness', 'Dizziness', 'Complex sleep behaviors', 'Amnesia', 'Headache'],
      antidote: 'flumazenil (may be partial)', ivPushRate: null
    },
    {
      id: 'prednisone', generic: 'prednisone', brand: 'Deltasone, Rayos',
      klass: 'Systemic corticosteroid',
      routes: ['PO'],
      usualAdultDose: 'Variable; typical 5-60 mg PO daily; taper',
      highAlert: false,
      holdParameters: ['Active untreated systemic infection'],
      onset: '1-2 hr', peak: '1-2 hr', duration: '18-36 hr',
      keyTeaching: [
        'Take with FOOD to reduce GI upset',
        'NEVER stop abruptly - adrenal crisis; must taper',
        'Report signs of infection - masks fever/inflammation',
        'Monitor blood glucose (may rise)'
      ],
      criticalConsiderations: [
        'Hyperglycemia, Cushingoid features, osteoporosis, insomnia, mood/psych',
        'Immunosuppression - avoid live vaccines',
        'Stress-dose steroids around surgery / illness'
      ],
      sideEffects: ['Hyperglycemia', 'Weight gain', 'Insomnia', 'Mood changes', 'Fluid retention'],
      antidote: null, ivPushRate: null
    },
    {
      id: 'loperamide', generic: 'loperamide', brand: 'Imodium',
      klass: 'Antidiarrheal (mu-opioid receptor agonist, gut)',
      routes: ['PO'],
      usualAdultDose: '4 mg initially then 2 mg after each loose stool (max 16 mg/day)',
      highAlert: false,
      holdParameters: ['Bloody diarrhea', 'Fever >101 F', 'Suspected C. diff or infectious diarrhea'],
      onset: '1 hr', peak: '4-5 hr', duration: '10-14 hr',
      keyTeaching: [
        'Not for bloody diarrhea, high fever, or suspected infection',
        'Increase fluids and electrolytes',
        'Report abdominal distention (toxic megacolon risk)',
        'Do not exceed 16 mg/day - QT prolongation at abuse doses'
      ],
      criticalConsiderations: [
        'Contraindicated in C. difficile - retains toxin, causes toxic megacolon',
        'QT prolongation / cardiac arrhythmia at high doses'
      ],
      sideEffects: ['Constipation', 'Abdominal cramps', 'Dizziness', 'Dry mouth'],
      antidote: 'naloxone (for opioid effect if overdose)', ivPushRate: null
    },
    {
      id: 'miralax', generic: 'polyethylene glycol 3350', brand: 'MiraLax',
      klass: 'Osmotic laxative',
      routes: ['PO'],
      usualAdultDose: '17 g dissolved in 4-8 oz liquid PO once daily',
      highAlert: false, holdParameters: ['Suspected bowel obstruction'],
      onset: '1-3 days', peak: 'Variable', duration: 'While dosing',
      keyTeaching: [
        'Mix in 4-8 oz water, juice, coffee, or tea and drink',
        'Onset is 1-3 days - not immediate',
        'Increase fluids',
        'Stop and call if severe cramping or no BM after 7 days'
      ],
      criticalConsiderations: [
        'Not absorbed - well tolerated in renal/hepatic disease',
        'Can cause electrolyte disturbance with prolonged high-dose use'
      ],
      sideEffects: ['Bloating', 'Nausea', 'Cramping', 'Diarrhea'],
      antidote: null, ivPushRate: null
    },
    {
      id: 'cardizem', generic: 'diltiazem', brand: 'Cardizem, Cartia XT',
      klass: 'Non-dihydropyridine calcium channel blocker',
      routes: ['PO', 'IV'],
      usualAdultDose: 'PO 120-360 mg/day; IV bolus 0.25 mg/kg over 2 min then drip',
      highAlert: true,
      holdParameters: ['HR <60', 'SBP <90', '2nd/3rd degree AV block without pacer'],
      onset: 'PO 30-60 min; IV 3 min', peak: 'PO 2-3 hr; IV 7 min', duration: 'IV 1-3 hr',
      keyTeaching: [
        'Check pulse before each dose - hold if <60',
        'Rise slowly - orthostasis',
        'Do not crush ER capsules',
        'Report edema, shortness of breath, slow pulse'
      ],
      criticalConsiderations: [
        'HIGH-ALERT (IV) - continuous cardiac monitor for IV',
        'AV block, bradycardia, hypotension',
        'Additive with beta-blockers, digoxin - severe brady/heart block',
        'Grapefruit juice increases levels'
      ],
      sideEffects: ['Bradycardia', 'Hypotension', 'AV block', 'Peripheral edema', 'Constipation'],
      antidote: 'IV calcium gluconate; glucagon; vasopressors', ivPushRate: 'IV bolus over 2 min; then continuous infusion 5-15 mg/hr'
    },
    {
      id: 'lactulose', generic: 'lactulose', brand: 'Enulose, Kristalose',
      klass: 'Osmotic laxative / ammonia detoxicant',
      routes: ['PO', 'PR (retention enema)'],
      usualAdultDose: 'Constipation 15-30 mL PO daily; hepatic encephalopathy 30-45 mL PO q1-2h until stools, then TID-QID',
      highAlert: false, holdParameters: ['Galactosemia', 'Severe hyponatremia from over-diuresis'],
      onset: '24-48 hr for constipation; hours for encephalopathy', peak: 'Variable', duration: 'Ongoing dosing',
      keyTeaching: [
        'For hepatic encephalopathy: titrate to 2-3 soft stools per day',
        'Mix with juice or water to improve taste',
        'Report severe diarrhea, muscle cramps',
        'Not the same as MiraLax - dose is different for the same amount of laxative effect'
      ],
      criticalConsiderations: [
        'Encephalopathy dose is separate from constipation dose',
        'Monitor for dehydration, hypokalemia, hypernatremia with heavy use',
        'Slow onset for constipation'
      ],
      sideEffects: ['Bloating', 'Flatulence', 'Cramps', 'Diarrhea'],
      antidote: null, ivPushRate: null
    },
    {
      id: 'kayexalate', generic: 'sodium polystyrene sulfonate', brand: 'Kayexalate, Kionex',
      klass: 'Potassium binder (cation-exchange resin)',
      routes: ['PO', 'PR'],
      usualAdultDose: 'PO 15 g 1-4 times daily; PR 30-50 g as retention enema',
      highAlert: false,
      holdParameters: ['Ileus', 'Postoperative bowel', 'Suspected bowel obstruction'],
      onset: 'Hours', peak: 'Variable', duration: '4-6 hr per dose',
      keyTeaching: [
        'Used for HYPERkalemia - report muscle weakness, palpitations',
        'Expect frequent stools',
        'Mix PO dose with water or sorbitol as ordered',
        'Retention enema: hold 30-60 min if possible'
      ],
      criticalConsiderations: [
        'Contraindicated in ileus, reduced bowel motility - BOWEL NECROSIS risk',
        'Do not give with other cation binders or with sorbitol in postoperative patient',
        'Monitor K+ (goal decrease) and Na+ (may rise)'
      ],
      sideEffects: ['Constipation', 'N/V', 'Hypokalemia', 'Hypernatremia', 'Bowel necrosis (rare)'],
      antidote: null, ivPushRate: null
    },
    {
      id: 'metformin', generic: 'metformin', brand: 'Glucophage, Glumetza',
      klass: 'Biguanide antihyperglycemic',
      routes: ['PO'],
      usualAdultDose: '500-1000 mg PO BID with meals (max 2550 mg/day)',
      highAlert: false,
      holdParameters: ['eGFR <30 mL/min', '48 hr before AND after IV contrast', 'Acute illness / hypoxia / hypoperfusion'],
      onset: 'Days', peak: '2-3 hr level', duration: '~12 hr',
      keyTeaching: [
        'Take WITH FOOD to reduce GI upset',
        'HOLD 48 hr before AND after IV contrast - lactic acidosis risk',
        'Report muscle pain, unusual fatigue, trouble breathing (lactic acidosis)',
        'Does not usually cause hypoglycemia alone'
      ],
      criticalConsiderations: [
        'LACTIC ACIDOSIS risk with renal impairment, contrast, dehydration, sepsis',
        'Verify renal function before initiating (eGFR)',
        'Vitamin B12 deficiency with long-term use'
      ],
      sideEffects: ['GI upset/diarrhea', 'Metallic taste', 'B12 deficiency', 'Lactic acidosis (rare)'],
      antidote: null, ivPushRate: null
    },
    {
      id: 'methergine', generic: 'methylergonovine', brand: 'Methergine',
      klass: 'Ergot alkaloid uterotonic',
      routes: ['PO', 'IM', 'IV (emergency only)'],
      usualAdultDose: 'IM 0.2 mg q2-4h up to 5 doses, then PO 0.2 mg q6-8h x 2-7 days',
      highAlert: true,
      holdParameters: ['HYPERTENSION (any BP elevation)', 'Preeclampsia/eclampsia', 'Coronary artery disease'],
      onset: 'IM 2-5 min; PO 5-10 min', peak: 'IM 30 min', duration: '~3 hr',
      keyTeaching: [
        'Used for POSTPARTUM HEMORRHAGE due to uterine atony',
        'Expect cramping - the drug is working',
        'Report chest pain, severe headache, numbness in extremities',
        'Do not smoke (vasoconstriction)'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication',
        'HOLD IF BP IS ELEVATED - vasoconstrictor, can trigger stroke/MI/HTN crisis',
        'Contraindicated in HTN, preeclampsia, CAD, PVD',
        'Check BP before every dose'
      ],
      sideEffects: ['Hypertension', 'Cramping', 'N/V', 'Headache', 'Chest pain'],
      antidote: null, ivPushRate: 'IV only in life-threatening hemorrhage; slow over >=60 sec with BP monitor'
    },
    {
      id: 'amiodarone', generic: 'amiodarone', brand: 'Cordarone, Pacerone',
      klass: 'Class III antiarrhythmic',
      routes: ['PO', 'IV'],
      usualAdultDose: 'PO 200-400 mg/day maintenance; IV load per protocol (150 mg over 10 min, then 1 mg/min)',
      highAlert: true,
      holdParameters: ['HR <60', 'SBP <90', 'QTc prolonged', 'New pulmonary symptoms'],
      onset: 'IV minutes; PO days to weeks', peak: 'IV 20 min; PO 3-7 hr', duration: 'Weeks (long half-life)',
      keyTeaching: [
        'Take PO with food consistently',
        'Report cough, shortness of breath (pulmonary fibrosis)',
        'Report yellowing of skin/eyes, dark urine (hepatotox)',
        'Sun protection - photosensitivity and blue-gray skin discoloration'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication',
        'IV push ONLY in cardiac arrest (300 mg for V-fib/pulseless VT)',
        'Long half-life - side effects persist weeks after stopping',
        'Baseline and periodic: LFTs, TFTs, PFTs, eye exam, ECG',
        'Interacts with warfarin, digoxin - reduce doses'
      ],
      sideEffects: ['Pulmonary fibrosis', 'Hepatotoxicity', 'Thyroid dysfunction', 'Corneal deposits', 'Blue-gray skin', 'Bradycardia'],
      antidote: null, ivPushRate: 'IV push only in cardiac arrest; otherwise infusion per protocol'
    },
    {
      id: 'glucagon', generic: 'glucagon', brand: 'GlucaGen, Gvoke, Baqsimi',
      klass: 'Antihypoglycemic hormone',
      routes: ['IM', 'SubQ', 'IV', 'Intranasal'],
      usualAdultDose: '1 mg IM/SubQ/IV for severe hypoglycemia',
      highAlert: false,
      holdParameters: ['Insulinoma', 'Pheochromocytoma'],
      onset: 'IV ~1 min; IM ~15 min', peak: '5-20 min', duration: '60-90 min',
      keyTeaching: [
        'Turn patient on SIDE - vomiting is common',
        'Give oral carbohydrate as soon as patient can safely swallow',
        'Recheck blood glucose in 15 min',
        'Teach family how to give IM/intranasal at home'
      ],
      criticalConsiderations: [
        'For severe hypoglycemia when patient cannot take PO',
        'Requires liver glycogen stores - less effective in starvation, alcohol, chronic hypoglycemia',
        'Also given IV in beta-blocker or CCB toxicity'
      ],
      sideEffects: ['N/V', 'Headache', 'Rebound hypoglycemia if no follow-up carb'],
      antidote: null, ivPushRate: 'IV push over 1 min if IV route used'
    },
    {
      id: 'lorazepam', generic: 'lorazepam', brand: 'Ativan',
      klass: 'Benzodiazepine',
      routes: ['PO', 'IV', 'IM', 'SL'],
      usualAdultDose: 'PO 0.5-2 mg q6-8h; IV 0.5-2 mg (max 4 mg/dose)',
      highAlert: true,
      holdParameters: ['RR <12', 'Sedation scale >=3', 'Hypotension'],
      onset: 'IV 1-3 min; PO 30-60 min', peak: 'IV 20 min; PO 2 hr', duration: '6-8 hr',
      keyTeaching: [
        'Fall risk - call bell in reach',
        'Do not combine with alcohol or other CNS depressants',
        'Report excessive drowsiness, confusion',
        'Do not stop abruptly if taken chronically (withdrawal)'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication',
        'IV push SLOWLY - max 2 mg/min',
        'Respiratory depression, especially with opioids',
        'Antidote: flumazenil (use cautiously; can precipitate seizures in chronic users)',
        'Elderly - paradoxical agitation'
      ],
      sideEffects: ['Sedation', 'Ataxia', 'Respiratory depression', 'Amnesia', 'Confusion (elderly)'],
      antidote: 'flumazenil', ivPushRate: 'IV push <=2 mg/min; dilute equal volume before push'
    },
    {
      id: 'haloperidol', generic: 'haloperidol', brand: 'Haldol',
      klass: 'First-generation (typical) antipsychotic',
      routes: ['PO', 'IM', 'IV (off-label, cardiac monitor)'],
      usualAdultDose: 'PO 0.5-5 mg BID-TID; IM acute 2-10 mg',
      highAlert: false,
      holdParameters: ['QTc prolonged (>500 ms)', 'Parkinson disease', 'Severe CNS depression'],
      onset: 'IM 20-30 min; PO 30-60 min', peak: 'IM 30-45 min; PO 3-5 hr', duration: '4-8 hr',
      keyTeaching: [
        'Report muscle stiffness, tremor, restlessness, involuntary movements',
        'Report high fever with rigidity - NMS is an emergency',
        'Rise slowly - orthostasis',
        'Do not stop abruptly'
      ],
      criticalConsiderations: [
        'QT PROLONGATION - baseline ECG; monitor K+, Mg+',
        'EPS: acute dystonia, akathisia, pseudoparkinsonism, tardive dyskinesia',
        'NMS: rigidity, hyperthermia, altered LOC, autonomic instability - stop the drug',
        'Increased mortality in elderly with dementia-related psychosis (BBW)'
      ],
      sideEffects: ['EPS', 'Sedation', 'QT prolongation', 'NMS (rare)', 'Anticholinergic'],
      antidote: 'benztropine or diphenhydramine for acute dystonia; dantrolene/bromocriptine for NMS', ivPushRate: 'IV use off-label; slow push with continuous cardiac monitor'
    },
    {
      id: 'cefazolin', generic: 'cefazolin', brand: 'Ancef, Kefzol',
      klass: '1st-generation cephalosporin antibiotic',
      routes: ['IV', 'IM'],
      usualAdultDose: '1-2 g IV q8h (surgical prophylaxis 2 g IV within 60 min of incision)',
      highAlert: false,
      holdParameters: ['Documented severe (anaphylactic) beta-lactam allergy'],
      onset: 'IV rapid', peak: 'IV end of infusion', duration: '~8 hr',
      keyTeaching: [
        'Report rash, itching, or trouble breathing',
        'Finish full course even if you feel better',
        'Report severe watery diarrhea (C. diff)'
      ],
      criticalConsiderations: [
        'Cross-sensitivity with penicillin ~1-5%',
        'Verify allergies before every dose',
        'IV infusion over 15-30 min (IV push over 3-5 min if truly ordered undiluted)',
        'Adjust dose in renal impairment'
      ],
      sideEffects: ['Rash', 'GI upset', 'C. diff overgrowth', 'Injection site pain'],
      antidote: null, ivPushRate: 'IV infusion 15-30 min; IV push over 3-5 min if diluted per policy'
    },
    {
      id: 'morphine', generic: 'morphine sulfate', brand: 'MS Contin, Roxanol',
      klass: 'Opioid agonist',
      routes: ['PO', 'IV', 'IM', 'SubQ', 'PR', 'Epidural'],
      usualAdultDose: 'IV 2-4 mg q3-4h PRN; PO IR 15-30 mg q4h PRN',
      highAlert: true,
      holdParameters: ['RR <10 (or per order)', 'Sedation scale >=3', 'SBP <90', 'SpO2 <92%'],
      onset: 'IV 5-10 min; IM 15-30 min; PO 30-60 min', peak: 'IV 20 min; PO 60 min', duration: '3-5 hr',
      keyTeaching: [
        'Report constipation - start bowel regimen',
        'Rise slowly - orthostasis',
        'Do not combine with alcohol/benzos',
        'Itching can be histamine release, not a true allergy'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication',
        'Antidote: naloxone (Narcan)',
        'Respiratory depression, hypotension, sedation',
        'Reduce dose in renal impairment (M6G accumulation)',
        'Independent double-check for PCA / neuraxial'
      ],
      sideEffects: ['Sedation', 'Respiratory depression', 'Constipation', 'N/V', 'Pruritus', 'Hypotension'],
      antidote: 'naloxone', ivPushRate: 'IV push over 4-5 min; dilute in 4-5 mL NS'
    },
    {
      id: 'ceftriaxone', generic: 'ceftriaxone', brand: 'Rocephin',
      klass: '3rd-generation cephalosporin antibiotic',
      routes: ['IV', 'IM'],
      usualAdultDose: '1-2 g IV/IM once or twice daily',
      highAlert: false,
      holdParameters: ['Documented severe beta-lactam allergy', 'Neonate receiving IV calcium'],
      onset: 'IV rapid', peak: 'End of infusion', duration: '~24 hr',
      keyTeaching: [
        'Report rash, itching, difficulty breathing',
        'Report severe watery diarrhea',
        'IM injection is painful - reconstituted with lidocaine per policy'
      ],
      criticalConsiderations: [
        'DO NOT mix or coadminister with IV calcium-containing solutions in neonates - fatal pulmonary/renal precipitate',
        'Cross-sensitivity with penicillin ~1-5%',
        'Route TRAP: "IC" is not a real MAR route - clarify (IM vs IV)',
        'IV infusion over 30 min; do not mix in same line with Ringer\'s or LR (calcium)'
      ],
      sideEffects: ['Rash', 'Diarrhea', 'Elevated LFTs', 'Injection-site pain'],
      antidote: null, ivPushRate: 'IV infusion over 30 min; IV push not standard'
    },
    {
      id: 'insulin_regular', generic: 'insulin regular (human)', brand: 'Humulin R, Novolin R',
      klass: 'Short-acting insulin',
      routes: ['SubQ', 'IV', 'IM (rare)'],
      usualAdultDose: 'Per sliding scale / weight-based; IV drip for DKA',
      highAlert: true,
      holdParameters: ['BG below sliding-scale threshold', 'K+ <3.3 for DKA drip (replace K+ first)'],
      onset: 'SubQ 30 min; IV immediate', peak: 'SubQ 2-3 hr; IV 15-30 min', duration: 'SubQ 5-7 hr; IV 30-60 min after stop',
      keyTeaching: [
        'CLEAR solution',
        'Rotate SubQ sites; 90 deg abdomen at least 2 in from umbilicus',
        'Eat within 30 min of SubQ dose',
        'Recognize hypoglycemia: shaky, sweaty, confused - treat with 15 g fast carb'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication - independent double-check',
        'The ONLY insulin that is IV-safe',
        'Drip: monitor K+, glucose q1h; do NOT stop drip until SubQ overlap in DKA',
        'When mixing with NPH: draw REGULAR (clear) FIRST'
      ],
      sideEffects: ['Hypoglycemia', 'Hypokalemia', 'Weight gain', 'Lipohypertrophy'],
      antidote: 'D50 IV / glucagon IM', ivPushRate: 'IV bolus or continuous infusion via pump with double-check'
    },
    {
      id: 'insulin_nph', generic: 'insulin NPH (isophane)', brand: 'Humulin N, Novolin N',
      klass: 'Intermediate-acting insulin',
      routes: ['SubQ'],
      usualAdultDose: 'Per regimen (typical 10-20 units SubQ daily-BID)',
      highAlert: true,
      holdParameters: ['BG below sliding-scale threshold'],
      onset: '1-2 hr', peak: '4-12 hr', duration: '14-24 hr',
      keyTeaching: [
        'CLOUDY suspension - ROLL between palms, do NOT shake',
        'SubQ only - never IV',
        'Peaks 4-12 hr - anticipate hypoglycemia at peak',
        'Rotate sites'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication',
        'NEVER IV',
        'When mixing with Regular: Clear before Cloudy (Regular first, then NPH)',
        'Long peak - snacks may be needed to prevent hypoglycemia'
      ],
      sideEffects: ['Hypoglycemia', 'Weight gain', 'Lipohypertrophy', 'Injection site reaction'],
      antidote: 'D50 IV / glucagon IM', ivPushRate: 'NEVER IV'
    },
    {
      id: 'insulin_humalog', generic: 'insulin lispro', brand: 'Humalog',
      klass: 'Rapid-acting insulin',
      routes: ['SubQ', 'IV (rare, per policy)'],
      usualAdultDose: 'Per meal / sliding scale',
      highAlert: true,
      holdParameters: ['NO FOOD present at bedside', 'BG below scale threshold'],
      onset: '15 min', peak: '30-90 min', duration: '3-5 hr',
      keyTeaching: [
        'CLEAR solution',
        'Give within 15 min BEFORE eating (or immediately after)',
        'FOOD MUST BE AT BEDSIDE first - critical safety check',
        'Recognize hypoglycemia early'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication',
        'Rapid onset - hypoglycemia if meal delayed',
        'Do not give if patient is NPO without provider instruction'
      ],
      sideEffects: ['Hypoglycemia', 'Weight gain', 'Injection site reaction'],
      antidote: 'D50 IV / glucagon IM', ivPushRate: 'Not routine IV; use regular insulin for IV drip'
    },
    {
      id: 'dilaudid', generic: 'hydromorphone', brand: 'Dilaudid, Exalgo',
      klass: 'Opioid agonist (potent)',
      routes: ['PO', 'IV', 'IM', 'SubQ', 'PR'],
      usualAdultDose: 'IV 0.2-1 mg q2-3h PRN; PO 2-4 mg q4-6h PRN',
      highAlert: true,
      holdParameters: ['RR <10', 'Sedation scale >=3', 'SBP <90', 'SpO2 <92%'],
      onset: 'IV 5 min; PO 15-30 min', peak: 'IV 10-20 min; PO 30-60 min', duration: '3-5 hr',
      keyTeaching: [
        'About 5-7x MORE potent than morphine - milligram-for-milligram is not equivalent',
        'Report constipation - start bowel regimen',
        'Rise slowly',
        'Do not combine with alcohol/benzos'
      ],
      criticalConsiderations: [
        'HIGH-ALERT medication',
        'IV push SLOWLY over 2-3 min',
        'Antidote: naloxone',
        'Verify allergy list - patients allergic to "morphine" may still tolerate hydromorphone but VERIFY, and vice versa',
        'Independent double-check for PCA'
      ],
      sideEffects: ['Sedation', 'Respiratory depression', 'Constipation', 'N/V', 'Pruritus'],
      antidote: 'naloxone', ivPushRate: 'IV push over 2-3 min; dilute in NS'
    },
    {
      id: 'hydralazine', generic: 'hydralazine', brand: 'Apresoline',
      klass: 'Direct arterial vasodilator',
      routes: ['PO', 'IV', 'IM'],
      usualAdultDose: 'IV 5-20 mg q4-6h PRN; PO 10-50 mg QID',
      highAlert: true,
      holdParameters: ['SBP <110 (or per order)', 'HR >120'],
      onset: 'IV 5-20 min; PO 20-30 min', peak: 'IV 15-30 min; PO 1-2 hr', duration: '2-6 hr',
      keyTeaching: [
        'Report chest pain, palpitations - reflex tachycardia',
        'Rise slowly',
        'Report joint pain, rash (drug-induced lupus)',
        'Take PO with food for consistent absorption'
      ],
      criticalConsiderations: [
        'HIGH-ALERT (IV) - IV push SLOW over at least 1 min',
        'Reflex tachycardia - often paired with beta-blocker',
        'Check BP before every dose',
        'Drug-induced lupus with chronic high-dose PO'
      ],
      sideEffects: ['Reflex tachycardia', 'Headache', 'Palpitations', 'Nausea', 'Lupus-like syndrome'],
      antidote: null, ivPushRate: 'IV push slow over >=1 min; monitor BP'
    },
    // Added post-spec — the MAR-12 photo has a Lidocaine Patch order, and any
    // drug that can appear on a MAR needs to be on the allow-list.
    {
      id: 'lidocaine_patch', generic: 'lidocaine 5% patch', brand: 'Lidoderm',
      class: 'Topical local anesthetic (amide)',
      routes: ['Topical'],
      usualAdultDose: 'Up to 3 patches to intact skin, once daily; 12 hr ON, 12 hr OFF (max 12 hr / 24 hr).',
      highAlert: false,
      holdParameters: ['Broken/inflamed skin at site'],
      onset: '30 min', peak: '2-3 hr', duration: '4-12 hr topical',
      keyTeaching: [
        'Apply to clean, DRY, intact skin. Never on open wounds or rashes.',
        'DATE, TIME, and initial the patch when applied — critical for the next nurse.',
        '12 hours ON, then 12 hours OFF — never continuous.',
        'Fold used patches sticky-sides-in and dispose safely (still contains drug; pet/child risk).',
        'May cut patch to size with backing intact if instructed.'
      ],
      criticalConsiderations: [
        'Not for acute severe pain — chronic localized pain only.',
        'Systemic absorption is possible on broken skin — do not use.',
        'If a heating pad is placed over the patch, absorption goes up sharply — do not do it.'
      ],
      sideEffects: ['Local irritation', 'Erythema', 'Rare systemic toxicity if overused'],
      antidote: null, ivPushRate: null
    }
  ];

  // Enforce the allow-list at data time - reject anything not on the spec list.
  var ALLOWED_IDS = {
    tamsulosin:1, percocet:1, bisacodyl:1, erythromycin:1, vancomycin:1, hctz:1,
    digoxin:1, warfarin:1, heparin:1, nystatin:1, docusate:1, dilantin:1, lasix:1,
    kcl:1, plavix:1, synthroid:1, zolpidem:1, prednisone:1, loperamide:1, miralax:1,
    cardizem:1, lactulose:1, kayexalate:1, metformin:1, methergine:1, amiodarone:1,
    glucagon:1, lorazepam:1, haloperidol:1, cefazolin:1, morphine:1, ceftriaxone:1,
    insulin_regular:1, insulin_nph:1, insulin_humalog:1, dilaudid:1, hydralazine:1,
    lidocaine_patch:1
  };
  var filtered = [];
  for (var i = 0; i < DRUGS.length; i++) {
    var d = DRUGS[i];
    if (ALLOWED_IDS[d.id]) filtered.push(d);
  }

  window.SIGNOFF_DRUGS = filtered;
  window.SIGNOFF_DRUGS_ALLOWED = ALLOWED_IDS;
})();
