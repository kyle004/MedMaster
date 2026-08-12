// OB Simulation Scenarios - NUR2212C
// Generated from OB Simulation Study Guides 1-6
window.SCENARIOS_OB = [

  // ============================================================
  // OB SIM 1 - Postpartum Hemorrhage + Newborn Transition
  // ============================================================
  {
    id: 'ob-postpartum-hemorrhage',
    title: 'Postpartum Hemorrhage',
    fullTitle: 'Postpartum Hemorrhage from Uterine Atony with Newborn Transition Assessment',
    category: 'OB',
    course: 'NUR2212C',
    difficulty: 'Hard',
    // durationMin must be >= the last vitalsTimeline atMin or the final
    // deterioration stage can never fire (sim-engine ends the run at
    // durationMin * 60 simulated seconds). Last stage here is atMin 25 and
    // the 15-minute stage is named in its label, so the limit moves, not the
    // timeline. 30 simulated minutes = 15 real minutes at TIME_SCALE 2.
    durationMin: 30,
    icon: 'BLOOD',
    summary: 'A 28-year-old G2P2 is 2 hours post vaginal delivery with a boggy uterus, heavy lochia, and worsening vital signs. You must manage the hemorrhage while completing a routine newborn transition assessment.',
    highYield: true,

    objectives: [
      'Perform a focused postpartum assessment using BUBBLE-HE',
      'Perform a newborn transition assessment',
      'Recognize maternal deterioration and hypovolemic shock',
      'Prioritize hemorrhage interventions in the correct sequence',
      'Administer uterotonic medications safely',
      'Communicate using SBAR',
      'Educate the patient on postpartum warning signs',
      'Document care accurately'
    ],

    patient: {
      name: 'Jane Smith',
      age: '28 years',
      dob: null,
      sex: 'Female',
      weightKg: null,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Postpartum hemorrhage secondary to uterine atony',
      history: [
        'Vaginal delivery 2 hours ago - healthy baby boy',
        'Estimated blood loss at delivery 450 mL (within normal limits for vaginal birth, which is 500 mL or less)',
        'Continued heavy bleeding AFTER delivery is the problem, not the initial EBL',
        'Currently reports dizziness, appears pale and weak'
      ],
      gravidaPara: 'G2P2',
      gestationalAge: 'Postpartum - delivered 2 hours ago'
    },

    // Newborn - routine transition assessment, all findings reassuring
    secondaryPatient: {
      name: 'Baby Boy Smith',
      age: '2 hours old',
      dob: null,
      sex: 'Male',
      weightKg: null,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Normal newborn transition',
      history: [
        'Born via vaginal delivery 2 hours ago',
        'Strong cry, good tone, pink color',
        'Successful breastfeeding at the breast'
      ],
      gestationalAge: 'Term newborn',
      vitalsTimeline: [
        {
          atMin: 0,
          label: 'Newborn baseline',
          bp: 'Not indicated',
          hr: 145,
          rr: 42,
          temp: '98.1 F',
          spo2: 97,
          pain: 'No distress',
          loc: 'Alert, strong cry, good tone',
          other: 'Pink, breastfeeding well, no grunting/flaring/retracting',
          flags: [],
          note: 'All values within normal newborn ranges - HR 110-160, RR 30-60, temp 97.7-99.5 F, SpO2 above 95 percent after transition'
        },
        {
          atMin: 10,
          label: 'Newborn recheck',
          bp: 'Not indicated',
          hr: 142,
          rr: 44,
          temp: '98.0 F',
          spo2: 97,
          pain: 'No distress',
          loc: 'Alert, rooting',
          other: 'Remains pink and well perfused; latched and feeding',
          flags: [],
          note: 'Newborn remains stable - do not let the stable baby distract you from the deteriorating mother'
        }
      ]
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline (1400)',
        bp: '100/62',
        hr: 112,
        rr: 22,
        temp: 'Not documented',
        spo2: 95,
        pain: 'Cramping, reports dizziness',
        loc: 'Alert but pale and weak',
        other: 'Fundus boggy, 2 cm ABOVE umbilicus; large amount lochia rubra',
        flags: ['tachycardia', 'borderline-hypotension', 'boggy-uterus'],
        note: 'Already concerning. Tachycardia plus a soft displaced fundus equals active hemorrhage.'
      },
      {
        atMin: 15,
        label: 'Fifteen minutes later',
        bp: '92/56',
        hr: 122,
        rr: 24,
        temp: 'Not documented',
        spo2: 95,
        pain: 'Dizziness worsening',
        loc: 'Pale, weak, increasingly anxious',
        other: 'Fundus still boggy despite massage; lochia continues heavy with clots',
        flags: ['hypotension', 'tachycardia', 'tachypnea', 'worsening'],
        note: 'BP down, HR up, RR up - classic compensatory response to hemorrhage. Patient is decompensating.'
      },
      {
        atMin: 25,
        label: 'Projected if bleeding is not controlled',
        bp: '84/48',
        hr: 134,
        rr: 28,
        temp: 'Not documented',
        spo2: 93,
        pain: 'Unable to focus on pain',
        loc: 'Restless, confused, difficult to arouse',
        other: 'Skin cool and clammy, delayed capillary refill, urine output less than 30 mL/hr',
        flags: ['shock', 'hypotension', 'altered-loc', 'oliguria'],
        note: 'Late hypovolemic shock. This point is prevented if the fundus is massaged, the bladder emptied, uterotonics given, and fluids increased.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'WBC', value: '13.5', unit: 'K/microL', status: 'normal', normalRange: '5.0-15.0 postpartum (4.5-11.0 nonpregnant)', interpretation: 'Looks elevated but is a NORMAL physiologic postpartum leukocytosis from the stress of labor. Do not mistake this for infection.' },
      { panel: 'CBC', name: 'Hemoglobin', value: '9.8', unit: 'g/dL', status: 'low', normalRange: '11-14 in late pregnancy and the immediate postpartum period (12-16 nonpregnant)', interpretation: 'Low - reflects acute blood loss from postpartum hemorrhage.' },
      { panel: 'CBC', name: 'Hematocrit', value: '30', unit: '%', status: 'low', normalRange: '33-44 in late pregnancy and the immediate postpartum period (37-47 nonpregnant)', interpretation: 'Low - consistent with ongoing blood loss. Trend serially.' },
      { panel: 'CBC', name: 'Platelets', value: 'Within normal limits', unit: 'K/microL', status: 'normal', normalRange: '150,000-400,000', interpretation: 'Normal platelets - no evidence of DIC at this time. Recheck if bleeding continues.' },
      { panel: 'Newborn', name: 'Newborn transition', value: 'Reassuring', unit: '', status: 'normal', normalRange: 'HR 110-160, RR 30-60', interpretation: 'Newborn HR 145, RR 42, temp 98.1 F, SpO2 97 percent - stable transition, no intervention needed.' }
    ],

    diagnostics: [
      { name: 'Fundal assessment', finding: 'Boggy uterus, 2 cm above the umbilicus, deviated from midline', interpretation: 'Uterine atony - the number one cause of postpartum hemorrhage. A displaced fundus also suggests a full bladder.' },
      { name: 'Lochia assessment', finding: 'Large amount of lochia rubra with clots', interpretation: 'Excessive for 2 hours postpartum. Quantify by weighing pads (1 g = 1 mL), do not estimate.' },
      { name: 'APGAR scoring (newborn)', finding: 'Appearance, Pulse, Grimace, Activity, Respiration scored at 1 and 5 minutes', interpretation: 'Standard newborn transition scoring; repeat at 10 minutes if the 5-minute score is under 7.' }
    ],

    orders: [
      { text: 'Quantify blood loss (weigh pads and chux)', category: 'monitoring' },
      { text: 'Strict intake and output', category: 'monitoring' },
      { text: 'Notify provider for continued bleeding or hemodynamic change', category: 'consult' },
      { text: 'Routine newborn care', category: 'monitoring' },
      { text: 'Oxytocin (Pitocin) infusion', category: 'medication' },
      { text: 'Lactated Ringers IV', category: 'medication' },
      { text: 'Large-bore IV access', category: 'access' },
      { text: 'Oxygen 10-15 L/min via non-rebreather if symptomatic', category: 'respiratory' },
      { text: 'Type and crossmatch 2 units PRBC; notify blood bank', category: 'lab' },
      { text: 'Repeat CBC and coagulation studies (PT, INR, fibrinogen) now and serially', category: 'lab' }
    ],

    interventions: [
      { id: 'pph-1', order: 1, action: 'Massage the fundus immediately', rationale: 'A boggy uterus cannot compress the open spiral arteries at the placental site. Massage is the FIRST action and often stops the bleeding by itself.', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Boggy fundus equals massage FIRST. Most NCLEX questions stop right here.' },
      { id: 'pph-2', order: 2, action: 'Call for help - notify the charge RN and provider', rationale: 'Hemorrhage requires more than one set of hands. Early escalation gets uterotonic orders, blood products, and a provider at the bedside.', category: 'escalation', critical: true, preventsDeterioration: false },
      { id: 'pph-3', order: 4, action: 'Increase the oxytocin infusion and verify it is actually running', rationale: 'Oxytocin is first-line and already ordered. Confirm the line is patent, the pump is infusing, and titrate per order.', category: 'medication', critical: true, preventsDeterioration: true },
      { id: 'pph-4', order: 3, action: 'Assess the bladder and have the patient void; straight catheterize if unable', rationale: 'A full bladder displaces the uterus upward and laterally and prevents it from contracting. This fundus is 2 cm above the umbilicus and off midline.', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Fundus boggy AFTER massage - empty the bladder next.' },
      { id: 'pph-5', order: 5, action: 'Quantify blood loss by weighing pads and linens', rationale: 'Visual estimation underestimates blood loss by up to 50 percent. 1 gram equals 1 mL.', category: 'assessment', critical: false, preventsDeterioration: false },
      { id: 'pph-6', order: 7, action: 'Reassess vital signs every 5-15 minutes', rationale: 'Trending BP, HR, and RR detects compensated shock before hypotension appears.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'pph-7', order: 8, action: 'Establish large-bore IV access and increase IV fluids', rationale: 'An 18-gauge or larger IV is required for rapid crystalloid and blood product administration.', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'pph-8', order: 6, action: 'Apply oxygen 10-15 L/min by non-rebreather', rationale: 'This patient is symptomatic - pale, dizzy, and weak with an SpO2 trending down and a hemoglobin of 9.8 - so oxygen is not optional. Maximizing the oxygen dissolved in plasma and saturating the hemoglobin that remains is the only way to raise arterial oxygen content while circulating hemoglobin is falling.', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'pph-9', order: 9, action: 'Perform the routine newborn transition assessment', rationale: 'The newborn still requires vital signs, color, tone, respiratory effort, and feeding assessment. Findings here are reassuring.', category: 'assessment', critical: false, preventsDeterioration: false },
      { id: 'pph-10', order: 10, action: 'Report using SBAR and educate the mother on warning signs', rationale: 'Structured handoff and discharge teaching are graded elements of the simulation.', category: 'communication', critical: false, preventsDeterioration: false }
    ],

    medications: [
      {
        name: 'Oxytocin',
        brand: 'Pitocin',
        classification: 'Uterotonic / posterior pituitary hormone',
        dose: 'IV infusion per order (commonly 10-40 units in 500-1000 mL LR titrated to uterine tone); 10 units IM if no IV access',
        action: 'Stimulates rhythmic uterine smooth muscle contraction, compressing bleeding vessels at the placental site',
        onset: 'Immediate IV; 3-5 minutes IM',
        sideEffects: ['Hypotension with rapid IV push', 'Tachycardia', 'Water intoxication/hyponatremia with prolonged high-dose infusion', 'Nausea'],
        nursingConsiderations: [
          'FIRST-LINE agent for postpartum hemorrhage',
          'Never give undiluted IV push - causes hypotension and dysrhythmias',
          'Always administer as a secondary/piggyback infusion on a pump',
          'Assess fundal tone and lochia with every rate change',
          'No absolute contraindications in PPH'
        ],
        atiTip: 'Oxytocin is always the first uterotonic in postpartum hemorrhage.',
        highAlert: true
      },
      {
        name: 'Methylergonovine',
        brand: 'Methergine',
        classification: 'Ergot alkaloid uterotonic',
        dose: '0.2 mg IM every 2-4 hours as prescribed (may be repeated); PO for maintenance',
        action: 'Produces sustained tetanic uterine contraction',
        onset: '2-5 minutes IM',
        sideEffects: ['HYPERTENSION', 'Severe headache', 'Nausea and vomiting', 'Chest pain', 'Seizures (rare)'],
        nursingConsiderations: [
          'CONTRAINDICATED in hypertension, preeclampsia, and eclampsia',
          'CHECK BLOOD PRESSURE BEFORE EVERY DOSE and hold if elevated',
          'Do not give IV push except in life-threatening hemorrhage - can cause hypertensive crisis and stroke',
          'Also avoid with cardiovascular disease'
        ],
        atiTip: 'Methergine plus hypertension equals stroke risk. Always check the BP first.',
        highAlert: true
      },
      {
        name: 'Carboprost tromethamine',
        brand: 'Hemabate',
        classification: 'Prostaglandin F2-alpha uterotonic',
        dose: '250 mcg IM or intramyometrial every 15-90 minutes, maximum 8 doses (2 mg total)',
        action: 'Potent stimulation of uterine smooth muscle contraction',
        onset: 'Within minutes IM',
        sideEffects: ['Bronchospasm', 'Diarrhea (very common)', 'Nausea and vomiting', 'Fever/flushing', 'Hypertension'],
        nursingConsiderations: [
          'CONTRAINDICATED IN ASTHMA - causes bronchoconstriction',
          'Use with caution in hypertension, cardiac, renal, or hepatic disease',
          'Premedicate with an antiemetic and antidiarrheal when possible',
          'Refrigerate the vial'
        ],
        atiTip: 'Hemabate and asthma do not mix. Screen every patient for asthma before giving it.',
        highAlert: true
      },
      {
        name: 'Misoprostol',
        brand: 'Cytotec',
        classification: 'Prostaglandin E1 analog uterotonic',
        dose: '600-1000 mcg PO, sublingual, or rectally as prescribed',
        action: 'Stimulates uterine contraction',
        onset: '10-30 minutes',
        sideEffects: ['Fever/shivering', 'Diarrhea', 'Nausea', 'Abdominal cramping'],
        nursingConsiderations: [
          'Useful when there is no IV access or when other agents are contraindicated',
          'Heat-stable - commonly used in low-resource settings',
          'Shivering and transient fever are expected, not infection'
        ],
        atiTip: 'Misoprostol is the backup uterotonic when both Methergine and Hemabate are contraindicated.',
        highAlert: false
      },
      {
        name: 'Tranexamic acid',
        brand: 'TXA / Cyklokapron',
        classification: 'Antifibrinolytic',
        dose: '1 g IV over 10 minutes; may repeat once within 24 hours',
        action: 'Inhibits fibrinolysis, stabilizing clot already formed',
        onset: 'Within minutes',
        sideEffects: ['Nausea', 'Diarrhea', 'Hypotension with rapid infusion', 'Thrombosis (rare)'],
        nursingConsiderations: [
          'Most effective when given within 3 hours of birth',
          'Infuse over at least 10 minutes - rapid administration causes hypotension',
          'Adjunct only, does not replace uterotonics or fundal massage'
        ],
        atiTip: 'TXA does not contract the uterus - it keeps the clot from breaking down.',
        highAlert: false
      },
      {
        name: 'Lactated Ringers',
        brand: 'LR',
        classification: 'Isotonic crystalloid',
        dose: 'IV infusion, rate increased per order for hemorrhage',
        action: 'Restores intravascular volume',
        onset: 'Immediate',
        sideEffects: ['Fluid overload', 'Dilutional coagulopathy with large volumes'],
        nursingConsiderations: [
          'Use large-bore access (18 gauge or larger)',
          'Crystalloid is a bridge - blood products are required for ongoing significant loss',
          'Monitor lung sounds and urine output'
        ],
        atiTip: 'Isotonic crystalloid first, blood products for continued hemorrhage.',
        highAlert: false
      }
    ],

    sbar: {
      situation: 'This is the RN caring for Jane Smith, a 28-year-old G2P2, two hours postpartum after a vaginal delivery. She is experiencing heavy vaginal bleeding.',
      background: 'Estimated blood loss at delivery was 450 mL. She now has excessive lochia and a boggy uterus that is 2 cm above the umbilicus. Oxytocin is infusing and LR is running.',
      assessment: 'Current BP is 92/56, HR 122, RR 24, SpO2 95 percent. The fundus remains boggy despite massage. She reports dizziness and appears pale. Hemoglobin is 9.8 and hematocrit is 30 percent. The newborn is stable with HR 145, RR 42, temp 98.1 F, and SpO2 97 percent.',
      recommendation: 'I recommend immediate bedside evaluation. Please provide additional uterotonic medication orders and prepare for possible blood transfusion.'
    },

    questions: [
      { id: 'ob-postpartum-hemorrhage-q1', text: 'Two hours after a vaginal delivery the nurse finds the fundus boggy and 2 cm above the umbilicus with a large amount of lochia rubra. Which action should the nurse take FIRST?', type: 'multiple-choice',
        options: ['Massage the fundus', 'Notify the provider', 'Increase the oxytocin infusion', 'Assist the patient to the bathroom to void'],
        correct: [0], rationale: 'Fundal massage is the first action for a boggy uterus. Mechanical stimulation causes the myometrium to contract and compress the open vessels at the placental site, and it often controls bleeding immediately. Everything else follows.', atiPearl: 'Boggy uterus equals massage first, every time.', difficulty: 'Easy' },

      { id: 'ob-postpartum-hemorrhage-q2', text: 'The fundus remains boggy and displaced to the right after several minutes of massage. What should the nurse do NEXT?', type: 'multiple-choice',
        options: ['Repeat the fundal massage for 10 more minutes', 'Assess the bladder and assist the patient to void or straight catheterize', 'Administer methylergonovine 0.2 mg IM', 'Place the patient in Trendelenburg position'],
        correct: [1], rationale: 'A full bladder pushes the uterus up and laterally and mechanically prevents it from contracting. A fundus that is above the umbilicus and off midline is the classic sign. Emptying the bladder allows the uterus to contract.', atiPearl: 'Boggy AND deviated equals full bladder until proven otherwise.', difficulty: 'Medium' },

      { id: 'ob-postpartum-hemorrhage-q3', text: 'The patient becomes pale and reports dizziness. BP has fallen from 100/62 to 92/56 and HR has risen from 112 to 122. What is the priority nursing action?', type: 'multiple-choice',
        options: ['Document the findings and recheck in 30 minutes', 'Offer oral fluids and a snack', 'Continue hemorrhage interventions, obtain vital signs, and notify the provider immediately', 'Ambulate the patient to assess for orthostatic changes'],
        correct: [2], rationale: 'Falling BP with rising HR and RR is compensated hypovolemic shock. The nurse continues hemorrhage control while escalating to the provider. Ambulating a hypotensive hemorrhaging patient is unsafe.', atiPearl: 'Never delay escalation to recheck later when the patient is actively bleeding.', difficulty: 'Medium' },

      { id: 'ob-postpartum-hemorrhage-q4', text: 'The patient asks why she is receiving oxytocin. What is the nurse\'s best response?', type: 'multiple-choice',
        options: ['"It replaces the blood you have lost."', '"It causes your uterus to contract, which squeezes the blood vessels closed and slows the bleeding."', '"It prevents infection after delivery."', '"It raises your blood pressure back to normal."'],
        correct: [1], rationale: 'Oxytocin stimulates uterine smooth muscle contraction. A contracted uterus compresses the spiral arteries at the placental site, which is what mechanically stops postpartum bleeding.', atiPearl: 'Uterotonics work by contracting muscle, not by replacing volume.', difficulty: 'Easy' },

      { id: 'ob-postpartum-hemorrhage-q5', text: 'Why does the nurse encourage the mother to breastfeed her newborn during a postpartum hemorrhage?', type: 'multiple-choice',
        options: ['Breastfeeding distracts the mother from her pain', 'Suckling triggers release of endogenous oxytocin, which contracts the uterus and decreases bleeding', 'Breastfeeding raises maternal hemoglobin', 'It prevents the newborn from becoming hypoglycemic'],
        correct: [1], rationale: 'Infant suckling stimulates the posterior pituitary to release endogenous oxytocin, producing uterine contraction and reducing bleeding. It is a free, physiologic uterotonic.', atiPearl: 'Breastfeeding equals natural oxytocin.', difficulty: 'Easy' },

      { id: 'ob-postpartum-hemorrhage-q6', text: 'The provider orders methylergonovine 0.2 mg IM. Which assessment finding would cause the nurse to HOLD the medication and call the provider?', type: 'multiple-choice',
        options: ['Blood pressure 168/104', 'Heart rate 122', 'Hemoglobin 9.8 g/dL', 'Report of uterine cramping'],
        correct: [0], rationale: 'Methylergonovine is contraindicated in hypertension, preeclampsia, and eclampsia because it causes generalized vasoconstriction and can precipitate hypertensive crisis, seizure, or stroke. Check the blood pressure before every dose.', atiPearl: 'Methergine plus high BP equals hold and call.', difficulty: 'Medium' },

      { id: 'ob-postpartum-hemorrhage-q7', text: 'Carboprost (Hemabate) is ordered for continued bleeding. Which item in the patient history requires the nurse to question this order?', type: 'multiple-choice',
        options: ['History of asthma', 'History of migraine headaches', 'History of gestational diabetes', 'History of a prior cesarean birth'],
        correct: [0], rationale: 'Carboprost is a prostaglandin F2-alpha analog that causes bronchoconstriction and is contraindicated in asthma. Diarrhea, fever, and vomiting are expected side effects but are not contraindications.', atiPearl: 'Hemabate equals no asthma.', difficulty: 'Medium' },

      { id: 'ob-postpartum-hemorrhage-q8', text: 'Which findings indicate EARLY hypovolemic shock in this postpartum patient? Select all that apply.', type: 'select-all',
        options: ['Tachycardia', 'Restlessness and anxiety', 'Pale, cool skin with delayed capillary refill', 'Profound hypotension', 'Loss of consciousness'],
        correct: [0, 1, 2], rationale: 'Early compensated shock produces tachycardia, restlessness, anxiety, pallor, cool skin, and delayed capillary refill. Hypotension, confusion, weak pulses, oliguria, and loss of consciousness are LATE signs that appear only after compensation fails.', atiPearl: 'In pregnancy and postpartum, the blood pressure is the last thing to fall.', difficulty: 'Medium' },

      { id: 'ob-postpartum-hemorrhage-q9', text: 'The postpartum hemoglobin is 9.8 g/dL and hematocrit is 30 percent. How should the nurse interpret these results?', type: 'multiple-choice',
        options: ['Normal physiologic values for the postpartum period', 'Consistent with acute blood loss and requiring continued monitoring for shock', 'Indicative of an infection', 'Diagnostic of disseminated intravascular coagulation'],
        correct: [1], rationale: 'In the immediate postpartum period, plasma volume is still expanded, so the expected hemoglobin is about 11-14 g/dL with a hematocrit of 33-44 percent. A hemoglobin of 9.8 with a hematocrit of 30 percent reflects significant blood loss. Platelets are normal so there is no evidence of DIC.', atiPearl: 'Correlate the CBC with the vital signs and the fundal exam, not in isolation.', difficulty: 'Medium' },

      { id: 'ob-postpartum-hemorrhage-q10', text: 'The postpartum WBC count is 13,500/microL. What is the nurse\'s interpretation?', type: 'multiple-choice',
        options: ['Expected physiologic leukocytosis from the stress of labor', 'Early sign of endometritis requiring antibiotics', 'Evidence of hemoconcentration from blood loss', 'A critical value requiring immediate provider notification'],
        correct: [0], rationale: 'WBC counts up to 15,000-20,000/microL are a normal physiologic response to the stress of labor and delivery. Infection is suggested by fever, uterine tenderness, and foul-smelling lochia, none of which are present here.', atiPearl: 'Do not chase a postpartum WBC of 13,500 - look at the whole picture.', difficulty: 'Medium' },

      { id: 'ob-postpartum-hemorrhage-q11', text: 'When performing fundal massage, which technique is essential to prevent uterine inversion?', type: 'multiple-choice',
        options: ['Massage vigorously with both hands on the fundus', 'Support the lower uterine segment with one hand just above the symphysis pubis while massaging the fundus with the other hand', 'Push downward firmly toward the pelvis until the fundus is felt', 'Have the patient bear down while massaging'],
        correct: [1], rationale: 'One hand must cup and support the lower uterine segment above the symphysis pubis while the other hand massages the fundus. Massaging or pushing down without supporting the lower segment can cause uterine inversion, a life-threatening emergency.', atiPearl: 'Never push down on a fundus without supporting the lower segment.', difficulty: 'Medium' },

      { id: 'ob-postpartum-hemorrhage-q12', text: 'The estimated blood loss at this vaginal delivery was 450 mL. How should the nurse interpret this in the context of the current findings?', type: 'multiple-choice',
        options: ['This exceeds the definition of postpartum hemorrhage for a vaginal birth', 'The delivery loss was within normal limits, but ongoing bleeding with tachycardia and hypotension still meets the definition of postpartum hemorrhage', 'No hemorrhage can be diagnosed until blood loss exceeds 1000 mL', 'The 450 mL loss fully explains the current hypotension'],
        correct: [1], rationale: 'Blood loss of 500 mL or less for a vaginal birth is normal, so 450 mL at delivery was acceptable. However, ANY blood loss producing tachycardia, hypotension, dizziness, or signs of shock is treated as postpartum hemorrhage regardless of the measured volume.', atiPearl: 'Unstable vital signs define hemorrhage even before the volume threshold is reached.', difficulty: 'Hard' },

      { id: 'ob-postpartum-hemorrhage-q13', text: 'The nurse completes the newborn assessment: HR 145, RR 42, temp 98.1 F, SpO2 97 percent, strong cry, good tone, pink, breastfeeding well. What is the appropriate nursing action?', type: 'multiple-choice',
        options: ['Notify the provider of the abnormal respiratory rate', 'Place the newborn under a radiant warmer immediately', 'Document the reassuring findings and continue routine newborn care', 'Obtain a blood glucose because the heart rate is elevated'],
        correct: [2], rationale: 'All values are within normal newborn ranges: HR 110-160, RR 30-60, temp 97.7-99.5 F, and SpO2 above 95 percent after transition. Color, tone, cry, and feeding are all reassuring. Routine care and documentation are appropriate.', atiPearl: 'Know the normal newborn vital sign ranges cold - they are tested constantly.', difficulty: 'Easy' }
    ],

    keyPoints: [
      'Uterine atony is the number one cause of postpartum hemorrhage',
      'Fundal massage is the FIRST action for a boggy uterus',
      'Postpartum hemorrhage: more than 500 mL after vaginal birth or more than 1000 mL after cesarean, OR any loss causing instability',
      'A fundus above the umbilicus and deviated from midline suggests a FULL BLADDER',
      'BUBBLE-HE: Breasts, Uterus, Bladder, Bowel/Lochia, Episiotomy, Homans/extremities, Emotions',
      'Oxytocin is first-line; Methergine is contraindicated in hypertension; Hemabate is contraindicated in asthma',
      'Quantify blood loss by weight (1 g equals 1 mL) - visual estimation is unreliable',
      'Postpartum WBC up to 15,000-20,000 is a normal physiologic response to labor',
      'Normal newborn: HR 110-160, RR 30-60, temp 97.7-99.5 F, SpO2 above 95 percent'
    ],

    pearls: [
      'Tachycardia is the earliest sign of hemorrhage - the blood pressure falls LAST',
      'Breastfeeding releases endogenous oxytocin and helps the uterus contract',
      'Never massage the fundus without supporting the lower uterine segment - uterine inversion is a real risk',
      'The uterus descends about 1 cm per day after delivery',
      'A firm uterus that is still bleeding suggests a laceration or retained placental fragments, not atony'
    ],

    successChecklist: [
      'Perform hand hygiene and identify the patient using two identifiers',
      'Assess airway, breathing, circulation, and obtain vital signs',
      'Inspect lochia and quantify blood loss',
      'Assess the fundus for firmness, height, and position',
      'If the fundus is boggy, massage it immediately',
      'Send type and crossmatch and repeat CBC/coagulation studies early, before the patient destabilizes',
      'Assess bladder fullness and assist the patient to void or prepare for catheterization',
      'Verify the oxytocin infusion and IV fluids are running as ordered',
      'Reassess maternal vital signs and monitor for signs of hypovolemic shock',
      'Perform a routine newborn assessment (vital signs, color, tone, respirations, feeding)',
      'Communicate the mother\'s condition using SBAR',
      'Educate the mother about postpartum warning signs and document all assessments and interventions'
    ],

    criticalErrors: [
      'Failing to massage the fundus when it is boggy',
      'Massaging or pushing down on the fundus without supporting the lower uterine segment (risk of uterine inversion)',
      'Administering methylergonovine to a patient with hypertension or preeclampsia',
      'Administering carboprost to a patient with asthma',
      'Giving oxytocin as an undiluted rapid IV push',
      'Ignoring a full bladder when the fundus remains boggy and displaced',
      'Estimating rather than quantifying blood loss',
      'Delaying provider notification while the patient decompensates',
      'Leaving the mother alone to complete the newborn assessment while she is actively hemorrhaging'
    ],

    comparisons: [
      {
        title: 'Uterotonic Medications for Postpartum Hemorrhage',
        headers: ['Medication', 'Key Contraindication'],
        rows: [
          ['Oxytocin (Pitocin) - FIRST LINE', 'None absolute; never rapid IV push'],
          ['Methylergonovine (Methergine)', 'Hypertension, preeclampsia'],
          ['Carboprost (Hemabate)', 'Asthma'],
          ['Misoprostol (Cytotec)', 'Prostaglandin allergy'],
          ['Tranexamic acid (TXA)', 'Active thromboembolic disease']
        ]
      },
      {
        title: 'Normal vs Atonic Uterus',
        headers: ['Normal Uterus', 'Atonic Uterus'],
        rows: [
          ['Firm like a grapefruit', 'Soft and boggy'],
          ['At or below the umbilicus, midline', 'Above the umbilicus, may be displaced'],
          ['Compresses placental site vessels', 'Cannot compress vessels'],
          ['Moderate lochia rubra', 'Heavy lochia with clots']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'I feel so lightheaded... like the room is tilting. Is it normal to bleed this much?' },
      { speaker: 'patient', trigger: 'assessment', line: 'Oh - that hurts when you press on my belly. Do you have to push that hard?' },
      { speaker: 'patient', trigger: 'bleeding', line: 'I just felt a huge gush. I think I soaked through the pad again, and there was a clot the size of my fist.' },
      { speaker: 'patient', trigger: 'bladder', line: 'I honestly cannot tell if I need to pee. I am so numb down there from the epidural.' },
      { speaker: 'patient', trigger: 'medication', line: 'What is that medicine for? Will it hurt the baby if I am breastfeeding?' },
      { speaker: 'patient', trigger: 'baby', line: 'Is he okay? Please make sure someone is watching him. I cannot even hold him right now.' },
      { speaker: 'family', trigger: 'greeting', line: 'She looks really pale to me. She was fine an hour ago and now she can barely keep her eyes open.' },
      { speaker: 'family', trigger: 'escalation', line: 'That is a lot of blood. Should the doctor be in here? Somebody needs to do something.' },
      { speaker: 'patient', trigger: 'education', line: 'So how much bleeding is too much once I go home? What am I supposed to watch for?' }
    ],

    patientEducation: [
      'Massage your own uterus if instructed and report if it feels soft',
      'Empty your bladder every 2-3 hours - a full bladder makes bleeding worse',
      'Breastfeeding releases oxytocin and helps the uterus contract naturally',
      'Report heavy bleeding that soaks a pad in one hour or less',
      'Report clots larger than a golf ball',
      'Report dizziness, weakness, or feeling like you may faint',
      'Report fever, foul-smelling lochia, or severe abdominal pain',
      'Lochia should progress from rubra (red) to serosa (pink-brown) to alba (white-yellow) - bleeding that returns to bright red is abnormal'
    ]
  },

  // ============================================================
  // OB SIM 2 - Neonatal Hypoglycemia / Infant of a Diabetic Mother
  // ============================================================
  {
    id: 'ob-neonatal-hypoglycemia',
    title: 'Neonatal Hypoglycemia',
    fullTitle: 'Neonatal Hypoglycemia and Breastfeeding Support for an Infant of a Diabetic Mother',
    category: 'OB',
    course: 'NUR2212C',
    difficulty: 'Medium',
    durationMin: 20,
    icon: 'GLUCOSE',
    summary: 'An 8-hour-old LGA infant of a mother with insulin-treated gestational diabetes is jittery, sleepy, and feeding poorly with a blood glucose of 34 mg/dL. You must assess mother and newborn, feed the infant, maintain warmth, notify the provider, and support breastfeeding.',
    highYield: true,

    objectives: [
      'Assess the postpartum mother',
      'Perform a complete newborn assessment',
      'Evaluate feeding effectiveness and latch',
      'Recognize neonatal hypoglycemia',
      'Check and interpret blood glucose',
      'Support breastfeeding',
      'Notify the provider using SBAR',
      'Educate the parents',
      'Document care'
    ],

    // PRIMARY PATIENT = the newborn (the unstable patient driving this simulation)
    patient: {
      name: 'Baby Boy Smith',
      age: '8 hours old',
      dob: null,
      sex: 'Male',
      weightKg: 4.2,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Symptomatic neonatal hypoglycemia in an infant of a diabetic mother (IDM)',
      history: [
        'Born vaginally at 39 weeks gestation',
        'Birth weight 4.2 kg (9.3 lb) - Large for Gestational Age (LGA is greater than 4000 g)',
        'APGAR 8 at 1 minute and 9 at 5 minutes - excellent transition',
        'Mother had gestational diabetes requiring insulin',
        'Mother reports the baby is difficult to wake and is feeding poorly'
      ],
      gestationalAge: '39 weeks at birth'
    },

    // SECONDARY PATIENT = the mother, stable postpartum, needs lactation support
    secondaryPatient: {
      name: 'Jane Smith (mother)',
      age: '28 years',
      dob: null,
      sex: 'Female',
      weightKg: null,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Stable postpartum day 0 with gestational diabetes; breastfeeding difficulty',
      history: [
        'Vaginal delivery 8 hours ago',
        'Pregnancy complicated by gestational diabetes requiring insulin',
        'No postpartum complications noted',
        'Breasts soft with colostrum present',
        'Anxious and concerned about breastfeeding'
      ],
      gravidaPara: 'G2P2',
      gestationalAge: 'Postpartum - delivered 8 hours ago',
      vitalsTimeline: [
        {
          atMin: 0,
          label: 'Maternal baseline',
          bp: '118/72',
          hr: 78,
          rr: 18,
          temp: '98.4 F',
          spo2: 99,
          pain: 'Mild afterpains',
          loc: 'Alert and oriented x4, anxious about feeding',
          other: 'Fundus firm, lochia moderate rubra, breasts soft with colostrum present',
          flags: [],
          note: 'Mother is hemodynamically stable. Her need is lactation support and reassurance, not medical intervention.'
        },
        {
          atMin: 15,
          label: 'After lactation coaching',
          bp: '116/70',
          hr: 74,
          rr: 18,
          temp: '98.4 F',
          spo2: 99,
          pain: 'Mild afterpains, some nipple tenderness',
          loc: 'Calmer, engaged in teaching',
          other: 'Hand-expressing colostrum successfully; improved positioning with cross-cradle hold',
          flags: [],
          note: 'Remains stable. Afterpains often increase during breastfeeding because of oxytocin release.'
        }
      ]
    },

    vitalsTimeline: [
      {
        // atMin values rescaled 0/10/20/30 -> 0/6/12/18 so the final stage
        // fires inside durationMin 20 (sim-engine ends the run at
        // durationMin * 60 simulated seconds). Relative pacing preserved.
        atMin: 0,
        label: 'Newborn baseline - 8 hours of life',
        bp: 'Not routinely measured',
        hr: 145,
        rr: 42,
        temp: '98.1 F',
        // Room-air SpO2 was missing on every stage, so the monitor tile read
        // "--" and the deterioration announcement read "SpO2 ,". Standard
        // term-newborn values, normal at every stage.
        spo2: 98,
        pain: 'Not in pain; weak cry',
        loc: 'Sleepy, difficult to arouse, jittery when disturbed',
        other: 'Airway patent, color pink, tone normal but sleepy, WEAK SUCK and poor feeding, mild temperature instability. Blood glucose 34 mg/dL.',
        flags: ['hypoglycemia', 'jitteriness', 'poor-feeding', 'weak-suck', 'lethargy'],
        note: 'Vital signs are all within normal newborn ranges. The critical abnormality is the blood glucose of 34 mg/dL (normal is greater than 45).'
      },
      {
        atMin: 6,
        label: 'First feeding attempt',
        bp: 'Not routinely measured',
        hr: 148,
        rr: 44,
        temp: '97.8 F',
        spo2: 97,
        pain: 'Weak, whimpering cry',
        loc: 'Falls asleep at the breast after only a few sucks',
        other: 'Shallow latch, no audible swallowing, minimal milk transfer; jitteriness persists',
        flags: ['poor-feeding', 'weak-suck', 'temp-drifting'],
        note: 'Poor feeding effort with a falling temperature. Undress slightly, place skin-to-skin, and hand-express colostrum to the buccal mucosa.'
      },
      {
        atMin: 12,
        label: 'If feeding is unsuccessful and warmth is not maintained',
        bp: 'Not routinely measured',
        hr: 158,
        rr: 68,
        temp: '97.2 F',
        spo2: 95,
        pain: 'Very weak cry',
        loc: 'Increasingly lethargic, hypotonic, difficult to arouse',
        other: 'Repeat glucose 28 mg/dL; mild tachypnea; cool extremities',
        flags: ['worsening-hypoglycemia', 'hypothermia', 'hypotonia', 'tachypnea'],
        note: 'Cold stress increases glucose consumption and worsens hypoglycemia. This infant now needs 40 percent oral dextrose gel or IV D10W per provider order.'
      },
      {
        atMin: 18,
        label: 'After effective feeding, warming, and provider notification',
        bp: 'Not routinely measured',
        hr: 144,
        rr: 44,
        temp: '98.3 F',
        spo2: 98,
        pain: 'Strong cry',
        loc: 'Alert, arouses easily, jitteriness resolved',
        other: 'Repeat glucose 52 mg/dL after feeding; deep latch with audible swallowing; skin-to-skin maintained',
        flags: [],
        note: 'Target outcome. Continue feeding every 2-3 hours and recheck glucose per protocol before feeds.'
      }
    ],

    labs: [
      { panel: 'Newborn POC', name: 'Blood glucose', value: '34', unit: 'mg/dL', status: 'critical-low', normalRange: 'Greater than 45 mg/dL', interpretation: 'Critically low and symptomatic. This is the single most important abnormal finding. Provider order requires notification for glucose less than 40 mg/dL - this infant meets that criterion.' },
      { panel: 'Newborn POC', name: 'Repeat blood glucose (post-feeding)', value: '52', unit: 'mg/dL', status: 'normal', normalRange: 'Greater than 45 mg/dL', interpretation: 'Target response to feeding. Continue to recheck before feeds per protocol.' },
      { panel: 'Chemistry', name: 'Total bilirubin', value: '4.2', unit: 'mg/dL', status: 'normal', normalRange: 'Less than 6 mg/dL at 8-12 hours of life', interpretation: 'Normal for age. No phototherapy indicated. IDMs remain at risk for later hyperbilirubinemia - continue to monitor.' },
      { panel: 'CBC', name: 'Hemoglobin', value: '18.5', unit: 'g/dL', status: 'normal', normalRange: '14-24 (newborn)', interpretation: 'Normal newborn value. IDMs are at risk for polycythemia, so a rising hematocrit would be a concern.' },
      { panel: 'Maternal', name: 'Maternal status', value: 'Stable', unit: '', status: 'normal', normalRange: '', interpretation: 'BP 118/72, HR 78, RR 18, temp 98.4 F, SpO2 99 percent. Breasts soft with colostrum present. No postpartum complications.' }
    ],

    diagnostics: [
      { name: 'APGAR scores', finding: '8 at 1 minute, 9 at 5 minutes', interpretation: 'Excellent transition at birth. A good APGAR does NOT rule out later hypoglycemia in an IDM.' },
      { name: 'Birth weight / growth classification', finding: '4.2 kg (9.3 lb) at 39 weeks', interpretation: 'Large for Gestational Age (greater than 4000 g). Macrosomia is common in infants of diabetic mothers and raises the risk of birth injury and shoulder dystocia.' },
      { name: 'Feeding/latch assessment', finding: 'Shallow latch, weak suck, no audible swallowing, falls asleep at the breast', interpretation: 'Ineffective breastfeeding contributing to hypoglycemia. Needs waking techniques, skin-to-skin, positioning help, and possible supplementation.' }
    ],

    orders: [
      { text: 'Blood glucose monitoring per at-risk infant protocol', category: 'lab' },
      { text: 'Notify provider for blood glucose less than 40 mg/dL', category: 'consult' },
      { text: 'Early and frequent feedings every 2-3 hours; breastfeed if possible', category: 'diet' },
      { text: 'Supplement with expressed breast milk or formula if unable to breastfeed', category: 'diet' },
      { text: 'Maintain thermoneutral environment; skin-to-skin, warm blankets, radiant warmer as needed', category: 'monitoring' },
      { text: '40 percent oral dextrose gel per protocol if unable to feed or glucose remains low', category: 'medication' },
      { text: 'IV D10W if seizures, apnea, persistent hypoglycemia, or unable to feed', category: 'medication' },
      { text: 'Lactation consult', category: 'consult' },
      { text: 'Routine newborn care and vital signs', category: 'monitoring' }
    ],

    interventions: [
      { id: 'nh-1', order: 1, action: 'Verify newborn identification - match the infant ID band to the mother ID band', rationale: 'Newborn identity verification before any care or feeding is a National Patient Safety Goal and prevents infant misidentification.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Two identifiers plus matching mother-baby bands, every single time.' },
      { id: 'nh-2', order: 2, action: 'Assess airway, breathing, and circulation', rationale: 'ABCs come first. Hypoglycemia can progress to respiratory distress, apnea, and seizures.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'nh-3', order: 3, action: 'Check the blood glucose', rationale: 'Jitteriness in a newborn is hypoglycemia until proven otherwise. Result is 34 mg/dL, critically low.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Jittery baby equals check the glucose FIRST.' },
      { id: 'nh-4', order: 4, action: 'Feed the infant immediately - breastfeed if possible, otherwise expressed breast milk or formula per order', rationale: 'Feeding is the first-line treatment for asymptomatic to mildly symptomatic neonatal hypoglycemia and delivers substrate immediately. Feeding is appropriate first-line therapy for an infant who is asymptomatic or only mildly symptomatic and who can feed effectively. This infant is symptomatic with a glucose of 34 - feeding is started immediately but must not delay provider notification, and IV dextrose is anticipated if the infant cannot take an effective feed or the repeat glucose does not rise.', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'nh-5', order: 5, action: 'Keep the baby warm - skin-to-skin, warm blankets, hat, radiant warmer if needed', rationale: 'Cold stress dramatically increases glucose and oxygen consumption through nonshivering thermogenesis and will worsen hypoglycemia.', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Cold stress burns glucose. Warm the baby while you feed the baby.' },
      { id: 'nh-6', order: 6, action: 'Recheck the blood glucose after feeding per protocol', rationale: 'Confirms response to treatment and identifies persistent hypoglycemia that requires dextrose gel or IV dextrose.', category: 'assessment', critical: true, preventsDeterioration: true },
      { id: 'nh-7', order: 7, action: 'Notify the provider - glucose is below the ordered threshold of 40 mg/dL', rationale: 'The order specifically directs notification for glucose less than 40 mg/dL. This infant is also symptomatic, which raises the urgency.', category: 'escalation', critical: true, preventsDeterioration: false },
      { id: 'nh-8', order: 8, action: 'Provide breastfeeding support - assess latch, position, suck, swallow, and milk transfer', rationale: 'Effective feeding is the definitive prevention of recurrent hypoglycemia. Cross-cradle hold is best for learning latch.', category: 'intervention', critical: false, preventsDeterioration: true },
      { id: 'nh-9', order: 9, action: 'Educate the parents and communicate using SBAR, then document', rationale: 'Parents must recognize warning signs and feed every 2-3 hours without waiting for the baby to cry.', category: 'education', critical: false, preventsDeterioration: false }
    ],

    medications: [
      {
        name: 'Dextrose gel 40 percent',
        brand: 'Instaglucose / oral glucose gel',
        classification: 'Carbohydrate / glucose supplement',
        dose: '0.5 mL/kg (200 mg/kg) massaged into the buccal mucosa; for a 4.2 kg infant that is approximately 2.1 mL',
        action: 'Buccal absorption of glucose raises blood glucose without interrupting breastfeeding',
        onset: '15-30 minutes',
        sideEffects: ['Transient rebound hypoglycemia', 'Choking if squirted into the pharynx'],
        nursingConsiderations: [
          'Dry the buccal mucosa first, then massage the gel into the inside of the cheek',
          'ALWAYS follow the gel with a feeding - gel alone is temporary',
          'Recheck the glucose 30 minutes after administration',
          'Do not give to an infant who cannot protect the airway or is having seizures'
        ],
        atiTip: 'Dextrose gel plus a feeding often prevents an IV and keeps mother and baby together.',
        highAlert: false
      },
      {
        name: 'Dextrose 10 percent in water',
        brand: 'D10W',
        classification: 'IV carbohydrate / hypertonic dextrose',
        dose: 'Mini-bolus 2 mL/kg IV over 1-2 minutes (approximately 8.4 mL for this 4.2 kg infant), followed by a continuous infusion at a glucose infusion rate of 5-8 mg/kg/min per order',
        action: 'Directly and rapidly raises serum glucose',
        onset: 'Immediate',
        sideEffects: ['Rebound hypoglycemia if stopped abruptly', 'Hyperglycemia', 'Tissue necrosis with extravasation', 'Fluid overload'],
        nursingConsiderations: [
          'Indicated for seizures, apnea, inability to feed, or persistent hypoglycemia',
          'NEVER use D25 or D50 in a neonate - the osmolarity can cause intraventricular hemorrhage',
          'Never stop the infusion abruptly - wean while feeding is established',
          'Monitor the IV site closely for infiltration',
          'Recheck glucose 30 minutes after the bolus and then per protocol'
        ],
        atiTip: 'D10W is the neonatal dextrose concentration. Higher concentrations are dangerous in newborns.',
        highAlert: true
      },
      {
        name: 'Expressed breast milk / colostrum',
        brand: 'EBM',
        classification: 'Human milk feeding',
        dose: 'Hand-expressed colostrum to the buccal mucosa or by spoon/syringe; then feed every 2-3 hours',
        action: 'Provides glucose, protein, and fat substrate plus immunologic protection',
        onset: 'Within 30-60 minutes on repeat glucose',
        sideEffects: ['None'],
        nursingConsiderations: [
          'Preferred over formula when available',
          'Colostrum is small in volume but very high in protein and protective factors',
          'Hand expression is more effective than a pump in the first 24 hours'
        ],
        atiTip: 'Even a few milliliters of colostrum can raise a newborn glucose.',
        highAlert: false
      },
      {
        name: 'Maternal insulin (history)',
        brand: 'Varies',
        classification: 'Antidiabetic hormone',
        dose: 'Used during pregnancy for gestational diabetes - typically discontinued after delivery',
        action: 'Lowers maternal blood glucose; maternal insulin does NOT cross the placenta',
        onset: 'Varies by formulation',
        sideEffects: ['Maternal hypoglycemia'],
        nursingConsiderations: [
          'Insulin requirements drop sharply immediately after delivery of the placenta',
          'Monitor the mother for postpartum hypoglycemia if insulin is continued',
          'The key teaching point: maternal GLUCOSE crosses the placenta but maternal INSULIN does not - this is why the fetus makes its own excess insulin'
        ],
        atiTip: 'Glucose crosses, insulin does not. That single fact explains the whole IDM picture.',
        highAlert: true
      }
    ],

    sbar: {
      situation: 'This is the RN caring for Baby Smith, an 8-hour-old infant of a diabetic mother. The infant is jittery, sleepy, feeding poorly, and has a blood glucose of 34 mg/dL.',
      background: 'Mother had gestational diabetes treated with insulin. Baby weighs 4.2 kg, delivered vaginally at 39 weeks. APGAR scores were 8 and 9.',
      assessment: 'Infant has a weak suck, poor feeding effort, mild temperature instability, and symptomatic hypoglycemia. HR 145, RR 42, temp 98.1 F, color pink, tone normal but sleepy. Bilirubin 4.2 and hemoglobin 18.5 are normal. Mother is stable with BP 118/72 and colostrum present.',
      recommendation: 'I recommend immediate evaluation. The infant is being fed now and kept skin-to-skin. Please provide additional orders for glucose management, including dextrose gel or IV dextrose if indicated.'
    },

    questions: [
      { id: 'ob-neonatal-hypoglycemia-q1', text: 'The nurse observes that an 8-hour-old infant of a diabetic mother is jittery. What is the nurse\'s FIRST action?', type: 'multiple-choice',
        options: ['Swaddle the infant tightly and place in the bassinet', 'Check the blood glucose immediately', 'Notify the provider', 'Place the infant under a radiant warmer'],
        correct: [1], rationale: 'Jitteriness is the most common sign of neonatal hypoglycemia. In an at-risk infant the first action is to obtain a blood glucose so treatment is guided by data rather than assumption.', atiPearl: 'Jittery newborn equals check the glucose.', difficulty: 'Easy' },

      { id: 'ob-neonatal-hypoglycemia-q2', text: 'The blood glucose is 34 mg/dL. The order states to notify the provider for a glucose less than 40 mg/dL. What is the priority intervention?', type: 'multiple-choice',
        options: ['Recheck the glucose in one hour', 'Feed the newborn immediately, preferably at the breast, and notify the provider', 'Start an IV of D10W without an order', 'Place the infant NPO pending provider evaluation'],
        correct: [1], rationale: 'Feeding is the first-line treatment for symptomatic hypoglycemia and provides immediate substrate. The provider must also be notified because 34 mg/dL is below the ordered threshold of 40 mg/dL.', atiPearl: 'Feed the baby AND call the provider - not one or the other.', difficulty: 'Medium' },

      { id: 'ob-neonatal-hypoglycemia-q3', text: 'The infant becomes lethargic and hypotonic and will not latch or take a bottle. What should the nurse prepare for?', type: 'multiple-choice',
        options: ['Continued attempts at breastfeeding every 30 minutes', 'Administration of 40 percent oral dextrose gel or IV D10W per provider order and protocol', 'Administration of subcutaneous insulin', 'Discharge teaching about feeding cues'],
        correct: [1], rationale: 'An infant who cannot feed, or who has persistent hypoglycemia, seizures, or apnea, requires dextrose gel or IV dextrose. Insulin would be catastrophic - it lowers glucose further.', atiPearl: 'Cannot feed plus low glucose equals dextrose gel or IV D10W.', difficulty: 'Medium' },

      { id: 'ob-neonatal-hypoglycemia-q4', text: 'A student nurse asks why infants of diabetic mothers develop hypoglycemia. What is the best explanation?', type: 'multiple-choice',
        options: ['Maternal insulin crosses the placenta and continues to lower the newborn glucose', 'The fetus produced high levels of its own insulin in response to maternal glucose, and that hyperinsulinemia persists after the maternal glucose supply is cut off at birth', 'Diabetic mothers cannot produce adequate colostrum', 'The newborn liver cannot metabolize maternal glucose'],
        correct: [1], rationale: 'Maternal glucose crosses the placenta but maternal insulin does not, so the fetus produces large amounts of its own insulin. At birth the maternal glucose supply stops abruptly while fetal hyperinsulinemia persists, causing the glucose to fall rapidly.', atiPearl: 'Glucose crosses the placenta; insulin does not.', difficulty: 'Medium' },

      { id: 'ob-neonatal-hypoglycemia-q5', text: 'What is the best way to PREVENT neonatal hypoglycemia in an at-risk infant?', type: 'multiple-choice',
        options: ['Give the first feeding at 6 hours of life to allow the infant to rest', 'Provide early and frequent feedings every 2-3 hours with routine glucose monitoring per protocol', 'Administer routine IV dextrose to all LGA infants', 'Keep the infant in an open crib to encourage arousal'],
        correct: [1], rationale: 'Early, frequent feeding every 2-3 hours plus scheduled glucose screening in at-risk infants (IDM, LGA, SGA, preterm) is the standard preventive approach. Delaying feedings or allowing cold stress increases risk.', atiPearl: 'Feed early, feed often, screen the at-risk infant.', difficulty: 'Easy' },

      { id: 'ob-neonatal-hypoglycemia-q6', text: 'The infant weighs 4.2 kg at 39 weeks gestation. How does the nurse classify this newborn?', type: 'multiple-choice',
        options: ['Appropriate for gestational age', 'Small for gestational age', 'Large for gestational age', 'Post-term'],
        correct: [2], rationale: 'Large for gestational age is defined as a birth weight greater than 4000 g (or above the 90th percentile for gestational age). Macrosomia is very common in infants of diabetic mothers and increases the risk of shoulder dystocia and birth injury.', atiPearl: 'LGA equals greater than 4000 g. Think IDM.', difficulty: 'Easy' },

      { id: 'ob-neonatal-hypoglycemia-q7', text: 'Which set of newborn vital signs is within normal limits?', type: 'multiple-choice',
        options: ['HR 145, RR 42, temp 98.1 F', 'HR 95, RR 26, temp 96.8 F', 'HR 180, RR 72, temp 100.2 F', 'HR 100, RR 24, temp 97.0 F'],
        correct: [0], rationale: 'Normal newborn ranges are HR 110-160, RR 30-60, and temperature 97.7-99.5 F (36.5-37.5 C). This infant\'s vital signs are all normal, which is why the glucose of 34 mg/dL is the critical finding.', atiPearl: 'Memorize 110-160, 30-60, 97.7-99.5.', difficulty: 'Easy' },

      { id: 'ob-neonatal-hypoglycemia-q8', text: 'Which findings are consistent with neonatal hypoglycemia? Select all that apply.', type: 'select-all',
        options: ['Jitteriness and tremors', 'Weak cry and weak suck', 'Temperature instability', 'Excessive sleepiness and lethargy', 'Bounding peripheral pulses with hypertension'],
        correct: [0, 1, 2, 3], rationale: 'The JITTERS mnemonic covers jitteriness, irritability, tremors, temperature instability, excessive sleepiness, respiratory distress, and seizures, along with weak cry, poor feeding, weak suck, hypotonia, cyanosis, and apnea. Bounding pulses with hypertension is not a feature of neonatal hypoglycemia.', atiPearl: 'JITTERS - jitteriness is the most common presenting sign.', difficulty: 'Medium' },

      { id: 'ob-neonatal-hypoglycemia-q9', text: 'Why is maintaining a thermoneutral environment a priority for a hypoglycemic newborn?', type: 'multiple-choice',
        options: ['Warmth improves the accuracy of the heel-stick glucose sample', 'Cold stress triggers nonshivering thermogenesis, which consumes glucose and oxygen and worsens hypoglycemia', 'Cold stress causes hyperglycemia that masks the true glucose level', 'Warmth prevents the infant from becoming jaundiced'],
        correct: [1], rationale: 'A cold newborn metabolizes brown fat through nonshivering thermogenesis, rapidly consuming glucose and oxygen. Cold stress both causes and worsens hypoglycemia, so warming is a treatment, not just comfort.', atiPearl: 'Cold stress equals glucose burned. Warm and feed together.', difficulty: 'Medium' },

      { id: 'ob-neonatal-hypoglycemia-q10', text: 'Which observation indicates an EFFECTIVE breastfeeding latch?', type: 'multiple-choice',
        options: ['The infant\'s lips are pursed inward with a clicking sound', 'Wide open mouth, lips flanged outward, deep latch, rhythmic sucking with audible swallowing, and no maternal nipple pain', 'The infant sucks rapidly for 2 minutes and then falls asleep', 'The mother reports sharp nipple pain throughout the feeding'],
        correct: [1], rationale: 'Signs of a good latch are a wide mouth, lips flanged outward, a deep latch onto the areola, rhythmic sucking with audible swallowing, and absence of maternal nipple pain. Clicking, pursed lips, and pain indicate a shallow latch.', atiPearl: 'Pain and clicking equal a shallow latch. Break suction and relatch.', difficulty: 'Medium' },

      { id: 'ob-neonatal-hypoglycemia-q11', text: 'Which complication is MOST common in the infant of a diabetic mother?', type: 'multiple-choice',
        options: ['Hypoglycemia', 'Necrotizing enterocolitis', 'Congenital hip dysplasia', 'Neonatal abstinence syndrome'],
        correct: [0], rationale: 'Hypoglycemia is the most common complication in an IDM. Other recognized complications include macrosomia, birth injury such as shoulder dystocia, respiratory distress syndrome, polycythemia, hyperbilirubinemia, hypocalcemia, and hypomagnesemia.', atiPearl: 'IDM on an exam equals think hypoglycemia first.', difficulty: 'Easy' },

      { id: 'ob-neonatal-hypoglycemia-q12', text: 'The mother says, "I will feed him as soon as he cries for it." What is the nurse\'s best response?', type: 'multiple-choice',
        options: ['"That is a good plan - crying is the best feeding cue."', '"Crying is a late hunger sign. Feed him every 2 to 3 hours and watch for early cues like rooting, hand-to-mouth movements, and lip smacking."', '"You should wake him every hour to feed."', '"Let him sleep as long as he wants so he can recover from the delivery."'],
        correct: [1], rationale: 'Crying is a LATE hunger cue, and a hypoglycemic or sleepy IDM may never cry to demand a feed. Parents should feed every 2-3 hours and respond to early cues: rooting, hand-to-mouth, sucking motions, and increased alertness.', atiPearl: 'Never wait for crying to feed an at-risk newborn.', difficulty: 'Medium' },

      { id: 'ob-neonatal-hypoglycemia-q13', text: 'The infant\'s bilirubin is 4.2 mg/dL and hemoglobin is 18.5 g/dL at 8 hours of life. What is the appropriate nursing action?', type: 'multiple-choice',
        options: ['Initiate phototherapy immediately', 'Prepare for an exchange transfusion', 'Recognize both values as normal for age, document, and continue routine monitoring', 'Notify the provider of critical anemia'],
        correct: [2], rationale: 'A bilirubin of 4.2 mg/dL at 8 hours is within normal limits and a newborn hemoglobin of 18.5 g/dL is normal (newborn range 14-24). Neither requires intervention, though IDMs remain at risk for later hyperbilirubinemia and polycythemia.', atiPearl: 'Newborn hemoglobin is much higher than adult - do not call 18.5 abnormal.', difficulty: 'Medium' }
    ],

    keyPoints: [
      'Maternal glucose crosses the placenta; maternal insulin does not - this causes fetal hyperinsulinemia',
      'Neonatal hypoglycemia is a blood glucose less than 45 mg/dL; this facility requires provider notification below 40 mg/dL',
      'Risk factors: infant of a diabetic mother, LGA, SGA, prematurity, cold stress, poor feeding',
      'LGA equals birth weight greater than 4000 g',
      'JITTERS: Jitteriness, Irritability, Tremors, Temperature instability, Excessive sleepiness, Respiratory distress, Seizures',
      'Treatment sequence: feed the baby, keep the baby warm, recheck the glucose, notify the provider',
      'Cold stress worsens hypoglycemia through nonshivering thermogenesis',
      'D10W is the correct IV dextrose concentration for neonates - never D25 or D50',
      'Feed every 2-3 hours; crying is a LATE hunger cue'
    ],

    pearls: [
      'Whenever you see IDM on an exam, immediately think hypoglycemia, early feeding, frequent glucose monitoring, keep the baby warm, and support breastfeeding',
      'A jittery newborn gets a glucose check, not a swaddle',
      'A good APGAR score does not protect an IDM from hypoglycemia hours later',
      'Cross-cradle hold is best for teaching latch; football hold is best after a cesarean',
      'Colostrum volume is tiny but it is enough - a few mL can correct a borderline glucose'
    ],

    successChecklist: [
      'Perform hand hygiene',
      'Verify the newborn ID band against the mother ID band',
      'Complete a brief maternal postpartum assessment',
      'Perform a comprehensive newborn assessment (airway, breathing, circulation, temperature, tone, color, reflexes)',
      'Assess feeding effectiveness and latch',
      'Recognize the signs of neonatal hypoglycemia (jitteriness, sleepiness, weak suck, poor feeding)',
      'Review the blood glucose result of 34 mg/dL and recognize it is critically low',
      'Feed the infant immediately, support breastfeeding, and keep the baby warm',
      'Notify the provider because the glucose is less than 40 mg/dL as required by the order',
      'Reassess the infant, educate the parents, communicate using SBAR, and document all care'
    ],

    criticalErrors: [
      'Failing to check a blood glucose on a jittery at-risk newborn',
      'Delaying feeding while waiting for the provider to call back',
      'Leaving the infant undressed or uncovered, allowing cold stress that worsens hypoglycemia',
      'Failing to notify the provider when the glucose is below the ordered threshold of 40 mg/dL',
      'Administering D25 or D50 to a neonate instead of D10W',
      'Abruptly discontinuing an IV dextrose infusion, causing rebound hypoglycemia',
      'Attempting oral feeding or dextrose gel in a seizing or apneic infant who cannot protect the airway',
      'Failing to verify the newborn ID band against the mother ID band before feeding',
      'Telling the parents to wait until the baby cries before feeding'
    ],

    comparisons: [
      {
        title: 'Breastfeeding Positions',
        headers: ['Position', 'Best Use'],
        rows: [
          ['Football (clutch) hold', 'Excellent after a cesarean - keeps pressure off the incision'],
          ['Cradle hold', 'Most common, good for an experienced dyad'],
          ['Cross-cradle hold', 'Best for LEARNING latch - gives the most head control'],
          ['Side-lying', 'Good for maternal rest and nighttime feeding']
        ]
      },
      {
        title: 'Feeding vs Dextrose Gel vs IV Dextrose',
        headers: ['Intervention', 'When Indicated'],
        rows: [
          ['Breastfeed or expressed milk/formula', 'First line - infant able to feed effectively, asymptomatic or mildly symptomatic'],
          ['40 percent oral dextrose gel', 'Glucose remains low after feeding, infant still able to swallow safely'],
          ['IV D10W', 'Seizures, apnea, unable to feed, or persistent hypoglycemia'],
          ['IV D10W (do not wait for a feeding trial)', 'Symptomatic infant with glucose below 40 who cannot take an effective feed']
        ]
      }
    ],

    dialogue: [
      { speaker: 'family', trigger: 'greeting', line: 'He just will not wake up to eat. I keep trying and he takes two sucks and falls right back asleep.' },
      { speaker: 'family', trigger: 'assessment', line: 'His hands were shaking a minute ago. Is that a seizure? Is something wrong with him?' },
      { speaker: 'family', trigger: 'glucose', line: 'Thirty-four? Is that bad? They told me my diabetes was under control at the end.' },
      { speaker: 'family', trigger: 'breastfeeding', line: 'My nipples are already sore and nothing is coming out. I do not think I have any milk. Maybe we should just give him a bottle.' },
      { speaker: 'family', trigger: 'education', line: 'How often do I really have to feed him? He seems so content when he is sleeping.' },
      { speaker: 'family', trigger: 'reassurance', line: 'Did I do this to him? Was it because of my sugars during the pregnancy?' },
      { speaker: 'family', trigger: 'partner', line: 'She has been up all night trying to get him to latch. Is there someone who can actually show us how to do this?' },
      { speaker: 'family', trigger: 'escalation', line: 'You are calling the doctor? That means it is serious, does it not?' }
    ],

    patientEducation: [
      'Feed the baby every 2-3 hours - do not wait until he cries, because crying is a late hunger sign',
      'Watch for early feeding cues: rooting, hand-to-mouth movements, lip smacking, and increased alertness',
      'Report jitteriness, weak or high-pitched cry, blue color, lethargy, poor feeding, or temperature instability immediately',
      'Continue skin-to-skin contact - it stabilizes temperature, glucose, and breathing',
      'Keep a hat on the baby and avoid drafts to prevent cold stress',
      'Track wet diapers and stools as a measure of adequate intake',
      'Colostrum is small in amount but very concentrated - it is enough for a newborn stomach',
      'Attend the follow-up appointment for weight check and glucose monitoring as directed'
    ]
  },

  // ============================================================
  // OB SIM 3 - Severe Preeclampsia at 36 Weeks
  // ============================================================
  {
    id: 'ob-severe-preeclampsia',
    title: 'Severe Preeclampsia',
    fullTitle: 'Severe Preeclampsia with Severe Features at 36 Weeks Gestation',
    category: 'OB',
    course: 'NUR2212C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'BP',
    summary: 'A 28-year-old G1P0 at 36 weeks presents with BP 178/112, severe headache, visual changes, epigastric pain, hyperreflexia, and a Category II fetal tracing. You must prevent eclampsia, administer magnesium sulfate safely, and monitor for HELLP syndrome and magnesium toxicity.',
    highYield: true,

    objectives: [
      'Perform a focused maternal assessment including neurologic status and DTRs',
      'Assess and interpret the fetal heart rate tracing',
      'Recognize severe preeclampsia with severe features',
      'Monitor for worsening maternal status and HELLP syndrome',
      'Administer magnesium sulfate safely and recognize toxicity',
      'Implement seizure precautions',
      'Communicate with the provider using SBAR',
      'Educate the patient and family',
      'Document care'
    ],

    patient: {
      name: 'Jane Smith',
      age: '28 years',
      dob: null,
      sex: 'Female',
      weightKg: null,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Severe preeclampsia with severe features at 36 weeks gestation',
      history: [
        'History of gestational hypertension that has worsened over the last two weeks',
        'Blood type A positive',
        'GBS negative',
        'Presents with severe headache, blurred vision, seeing spots, epigastric pain, facial and hand swelling, and decreased fetal movement'
      ],
      gravidaPara: 'G1P0',
      gestationalAge: '36 weeks'
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline on admission',
        bp: '178/112',
        hr: 102,
        rr: 20,
        temp: '98.7 F',
        spo2: 98,
        pain: 'Severe headache; epigastric pain',
        loc: 'Alert and oriented x4, reports blurred vision and seeing spots',
        other: 'Facial and hand edema, hyperreflexia (3+ to 4+ DTRs), +3 proteinuria, decreased fetal movement',
        flags: ['severe-hypertension', 'headache', 'visual-changes', 'epigastric-pain', 'hyperreflexia', 'proteinuria'],
        note: 'BP 178/112 is a hypertensive emergency in pregnancy. Multiple severe features are present - this patient is at high risk for eclampsia, HELLP, abruption, and stroke.'
      },
      {
        // atMin rescaled to fit durationMin 20 (the last stage used to sit past the time limit and never fired). Relative pacing preserved.
        atMin: 6,
        label: 'Worsening severe features (before magnesium takes effect)',
        bp: '186/118',
        hr: 108,
        rr: 22,
        temp: '98.7 F',
        spo2: 97,
        pain: 'Headache rated 9/10, unrelieved by rest or acetaminophen',
        loc: 'Restless, photophobic, difficulty focusing on the nurse',
        other: 'DTRs 4+ with sustained clonus, worsening epigastric pain, urine output 25 mL/hr',
        flags: ['worsening', 'clonus', 'oliguria', 'severe-headache'],
        note: 'Sustained clonus and an unrelieved headache signal impending eclampsia. Magnesium loading dose and antihypertensive therapy must not be delayed.'
      },
      {
        atMin: 12,
        label: 'Magnesium sulfate infusing - toxicity developing',
        bp: '176/108',
        hr: 88,
        rr: 10,
        temp: '98.5 F',
        spo2: 92,
        pain: 'Headache improved',
        loc: 'Extremely drowsy, slurred speech, difficult to arouse',
        other: 'DTRs ABSENT, urine output 18 mL/hr, feels warm and flushed, muscle weakness',
        flags: ['mag-toxicity', 'respiratory-depression', 'absent-dtrs', 'oliguria'],
        note: 'MAGNESIUM TOXICITY. RR below 12, absent DTRs, and urine output below 30 mL/hr. STOP the infusion, notify the provider, and give calcium gluconate.'
      },
      {
        atMin: 18,
        label: 'If severe hypertension is untreated - eclamptic seizure',
        bp: '192/122',
        hr: 120,
        rr: 0,
        temp: '98.7 F',
        spo2: 84,
        pain: 'Unable to report',
        loc: 'Generalized tonic-clonic seizure, then postictal',
        other: 'Apneic during the tonic-clonic phase; fetal bradycardia during and after the seizure; risk of placental abruption and aspiration',
        flags: ['eclampsia', 'seizure', 'hypoxia', 'fetal-bradycardia'],
        note: 'Eclampsia. Turn the patient to her side, protect the airway, do NOT restrain, give oxygen, and never leave her alone. This endpoint is prevented by timely magnesium and antihypertensive therapy.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'Platelets', value: '92,000', unit: '/microL', status: 'critical-low', normalRange: '150,000-400,000', interpretation: 'Thrombocytopenia - a severe feature of preeclampsia and the LP of HELLP syndrome. Increases bleeding risk and may contraindicate regional anesthesia.' },
      { panel: 'LFT', name: 'AST', value: '95', unit: 'units/L', status: 'high', normalRange: '10-40', interpretation: 'Elevated - indicates hepatocellular injury and supports HELLP syndrome.' },
      { panel: 'LFT', name: 'ALT', value: '102', unit: 'units/L', status: 'high', normalRange: '7-56', interpretation: 'Elevated - liver involvement. Correlates with the epigastric/RUQ pain.' },
      { panel: 'BMP', name: 'Creatinine', value: '1.3', unit: 'mg/dL', status: 'high', normalRange: '0.6-1.1 (lower in pregnancy)', interpretation: 'Elevated - renal impairment, a severe feature. Also raises the risk of magnesium accumulation and toxicity.' },
      { panel: 'Chemistry', name: 'Uric acid', value: '8.2', unit: 'mg/dL', status: 'high', normalRange: '2.4-6.0', interpretation: 'Elevated - commonly rises in preeclampsia and correlates with disease severity.' },
      { panel: 'Urinalysis', name: 'Urine protein', value: '+3', unit: 'dipstick', status: 'critical-high', normalRange: 'Negative to trace', interpretation: 'Significant proteinuria supporting the diagnosis of preeclampsia.' }
    ],

    diagnostics: [
      { name: 'Fetal heart rate tracing', finding: 'Baseline 170 bpm, minimal variability, absent accelerations, late decelerations present', interpretation: 'Category II tracing. Fetal tachycardia with minimal variability and late decelerations indicates uteroplacental insufficiency and fetal hypoxia. Requires intrauterine resuscitation and close monitoring.' },
      { name: 'Deep tendon reflexes', finding: 'Hyperreflexia 3+ to 4+ with clonus', interpretation: 'CNS irritability - a warning sign of impending eclampsia. DTRs also serve as the primary bedside monitor for magnesium toxicity once the infusion begins.' },
      { name: 'Edema assessment', finding: 'Facial and hand (nondependent) edema', interpretation: 'Nondependent edema of the face and hands is more concerning than dependent ankle edema in pregnancy.' },
      { name: 'Blood pressure criteria', finding: '178/112, repeatedly at or above 160/110', interpretation: 'Severe-range hypertension. Preeclampsia requires BP at or above 140/90 on two occasions after 20 weeks plus organ dysfunction; at or above 160/110 defines severe range.' }
    ],

    orders: [
      { text: 'Continuous fetal monitoring', category: 'monitoring' },
      { text: 'Magnesium sulfate 4 g IV loading dose over 20 minutes, then 2 g/hr maintenance infusion', category: 'medication' },
      { text: 'Calcium gluconate 1 g IV available at the bedside as the magnesium antidote', category: 'medication' },
      { text: 'Seizure precautions - padded side rails, suction and oxygen at bedside, low stimulation environment', category: 'monitoring' },
      { text: 'Strict intake and output; indwelling urinary catheter; report urine output less than 30 mL/hr', category: 'monitoring' },
      { text: 'Assess respirations, deep tendon reflexes, and level of consciousness hourly while on magnesium', category: 'monitoring' },
      { text: 'Labetalol, hydralazine, or nifedipine for severe-range blood pressure per protocol', category: 'medication' },
      { text: 'Left lateral positioning and bedrest', category: 'monitoring' },
      { text: 'CBC, CMP, LFTs, uric acid, and urine protein', category: 'lab' },
      { text: 'Maintain IV access', category: 'access' },
      { text: 'Notify provider and prepare for possible delivery after maternal stabilization', category: 'consult' }
    ],

    interventions: [
      { id: 'pre-1', order: 1, action: 'Assess airway, breathing, circulation, and overall maternal status', rationale: 'ABCs come first. Neurologic status, blood pressure, and respiratory status determine every subsequent action.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'pre-2', order: 2, action: 'Place the patient in the left side-lying position', rationale: 'Relieves compression of the inferior vena cava, improves venous return and cardiac output, increases uteroplacental blood flow, and improves fetal oxygenation.', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Left lateral is the answer to almost every fetal oxygenation question.' },
      { id: 'pre-3', order: 3, action: 'Initiate and maintain continuous fetal monitoring', rationale: 'Already ordered. The Category II tracing with late decelerations requires continuous surveillance for worsening fetal compromise.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'pre-4', order: 4, action: 'Administer magnesium sulfate - 4 g IV loading dose over 20 minutes, then 2 g/hr maintenance', rationale: 'Magnesium sulfate is the drug of choice to PREVENT eclamptic seizures. It does NOT lower blood pressure.', category: 'medication', critical: true, preventsDeterioration: true, atiPearl: 'Magnesium prevents seizures. Antihypertensives lower blood pressure. Two different jobs.' },
      { id: 'pre-5', order: 5, action: 'Implement seizure precautions - pad the side rails, keep suction and oxygen at the bedside, reduce environmental stimuli, maintain IV access', rationale: 'CNS irritability with hyperreflexia and clonus means a seizure may occur at any moment. Dim lights, limit visitors, and cluster care.', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'pre-6', order: 7, action: 'Maintain strict intake and output; urine output must be at least 30 mL/hr', rationale: 'Magnesium is cleared entirely by the kidneys. Oliguria causes magnesium to accumulate and produces toxicity. This patient already has an elevated creatinine.', category: 'assessment', critical: true, preventsDeterioration: true },
      { id: 'pre-7', order: 8, action: 'Monitor respirations, deep tendon reflexes, and level of consciousness every hour while magnesium is infusing', rationale: 'Loss of DTRs is the EARLIEST clinical sign of magnesium toxicity and precedes respiratory depression. RR less than 12 requires stopping the infusion.', category: 'assessment', critical: true, preventsDeterioration: true, atiPearl: 'DTRs go first, then respirations, then cardiac arrest. Catch it at the reflexes.' },
      { id: 'pre-8', order: 6, action: 'Administer antihypertensive therapy (labetalol, hydralazine, or nifedipine) for severe-range blood pressure', rationale: 'Sustained BP at or above 160/110 must be treated within 30-60 minutes to reduce the risk of maternal stroke, while avoiding a drop so rapid that placental perfusion is compromised. Magnesium prevents the seizure; it does not prevent the stroke. Severe-range BP must be treated on its own timeline.', category: 'medication', critical: true, preventsDeterioration: true },
      { id: 'pre-9', order: 9, action: 'Communicate using SBAR, educate the patient and family, and prepare for possible delivery', rationale: 'Delivery of the fetus and placenta is the only definitive cure. At 36 weeks with severe features, delivery is expected after maternal stabilization.', category: 'communication', critical: false, preventsDeterioration: false }
    ],

    medications: [
      {
        name: 'Magnesium sulfate',
        brand: 'MgSO4',
        classification: 'Anticonvulsant / CNS depressant / electrolyte',
        dose: '4 g IV loading dose over 20 minutes, then 2 g/hr continuous maintenance infusion',
        action: 'Depresses CNS irritability at the neuromuscular junction to prevent eclamptic seizures; also produces mild vasodilation',
        onset: 'Immediate with the IV loading dose',
        sideEffects: ['Flushing and feeling warm', 'Diaphoresis', 'Nausea', 'Drowsiness', 'Blurred vision', 'Muscle weakness', 'Respiratory depression', 'Pulmonary edema', 'Cardiac arrest (toxicity)'],
        nursingConsiderations: [
          'PURPOSE IS SEIZURE PREVENTION - it does NOT treat hypertension',
          'Therapeutic range 4-7 mEq/L (approximately 5-9 mg/dL)',
          'Always administer on an infusion pump as a secondary line',
          'Assess RESPIRATIONS, DTRs, and URINE OUTPUT hourly - these are the three toxicity monitors',
          'HOLD and notify the provider for RR less than 12, absent DTRs, or urine output less than 30 mL/hr',
          'Keep CALCIUM GLUCONATE at the bedside as the antidote',
          'Kidneys clear magnesium - an elevated creatinine increases toxicity risk',
          'Continue the infusion for 24 hours after delivery, since most postpartum seizures occur in the first 24 hours',
          'Monitor the newborn for respiratory depression and hypotonia after birth'
        ],
        atiTip: 'The three magnesium checks: respirations, reflexes, and urine output. Antidote is calcium gluconate.',
        highAlert: true
      },
      {
        name: 'Calcium gluconate',
        brand: 'Calcium gluconate 10 percent',
        classification: 'Electrolyte / magnesium antagonist (ANTIDOTE)',
        dose: '1 g (10 mL of a 10 percent solution) IV over 3-5 minutes',
        action: 'Directly antagonizes magnesium at the neuromuscular junction, reversing respiratory and cardiac depression',
        onset: 'Immediate',
        sideEffects: ['Bradycardia if pushed too fast', 'Flushing', 'Tissue necrosis with extravasation', 'Hypotension'],
        nursingConsiderations: [
          'THE ANTIDOTE FOR MAGNESIUM SULFATE TOXICITY - must be immediately available at the bedside whenever magnesium is infusing',
          'STOP the magnesium infusion first, then give calcium gluconate',
          'Push slowly over 3-5 minutes with continuous cardiac monitoring',
          'Ensure a patent IV - extravasation causes severe tissue necrosis',
          'Support ventilation as needed'
        ],
        atiTip: 'Magnesium toxicity: stop the drip, call the provider, give calcium gluconate, support respirations.',
        highAlert: true
      },
      {
        name: 'Labetalol',
        brand: 'Trandate',
        classification: 'Combined alpha-1 and nonselective beta blocker',
        dose: '20 mg IV push over 2 minutes; may repeat with escalating doses (40 mg, then 80 mg) every 10 minutes, maximum 300 mg total',
        action: 'Lowers blood pressure by decreasing systemic vascular resistance without reducing uteroplacental blood flow',
        onset: '5-10 minutes IV',
        sideEffects: ['Maternal hypotension', 'Dizziness', 'Fatigue', 'Bradycardia', 'Neonatal bradycardia and hypoglycemia'],
        nursingConsiderations: [
          'First-line for severe-range hypertension in pregnancy',
          'CONTRAINDICATED in asthma, decompensated heart failure, and heart block',
          'Recheck the BP and maternal heart rate 10 minutes after each dose',
          'Avoid dropping the BP too rapidly - a sudden fall reduces placental perfusion and can cause fetal distress',
          'Monitor the newborn for bradycardia and hypoglycemia after delivery'
        ],
        atiTip: 'Labetalol lowers the pressure; magnesium prevents the seizure. Do not confuse their roles.',
        highAlert: true
      },
      {
        name: 'Hydralazine',
        brand: 'Apresoline',
        classification: 'Direct-acting arterial vasodilator',
        dose: '5-10 mg IV every 20-40 minutes as prescribed for severe-range BP',
        action: 'Relaxes arteriolar smooth muscle, lowering systemic vascular resistance',
        onset: '10-20 minutes IV',
        sideEffects: ['Reflex tachycardia', 'Headache (can mimic worsening preeclampsia)', 'Flushing', 'Palpitations', 'Maternal hypotension with fetal distress'],
        nursingConsiderations: [
          'Monitor BP every 5-10 minutes after administration',
          'Reflex tachycardia and headache are common and can be confused with disease progression',
          'Watch the fetal tracing closely - a rapid maternal BP drop causes late decelerations',
          'Safe alternative when labetalol is contraindicated, such as in asthma'
        ],
        atiTip: 'Hydralazine causes reflex tachycardia and headache - anticipate it, do not panic.',
        highAlert: true
      },
      {
        name: 'Nifedipine',
        brand: 'Procardia',
        classification: 'Dihydropyridine calcium channel blocker',
        dose: '10-20 mg PO, may repeat in 20-30 minutes per protocol',
        action: 'Arterial vasodilation lowers blood pressure; also relaxes uterine smooth muscle',
        onset: '20-30 minutes PO',
        sideEffects: ['Hypotension', 'Headache', 'Flushing', 'Dizziness', 'Reflex tachycardia', 'Peripheral edema'],
        nursingConsiderations: [
          'ALWAYS check the blood pressure before administration',
          'Use with caution together with magnesium sulfate - the combination can potentiate neuromuscular blockade and profound hypotension',
          'Oral route makes it useful when IV access is limited',
          'Reassess BP 20-30 minutes after the dose'
        ],
        atiTip: 'Check the BP before every dose of nifedipine.',
        highAlert: false
      },
      {
        name: 'Methylergonovine',
        brand: 'Methergine',
        classification: 'Ergot alkaloid uterotonic - CONTRAINDICATED IN THIS PATIENT',
        dose: 'Would be 0.2 mg IM for postpartum hemorrhage - DO NOT GIVE to this patient',
        action: 'Sustained uterine contraction through potent vasoconstriction',
        onset: '2-5 minutes IM',
        sideEffects: ['Severe hypertension', 'Hypertensive crisis', 'Stroke', 'Seizure'],
        nursingConsiderations: [
          'ABSOLUTELY CONTRAINDICATED in hypertension, preeclampsia, and eclampsia',
          'If this patient hemorrhages after delivery, use oxytocin, carboprost (if no asthma), misoprostol, or TXA instead',
          'Included here because it is the classic wrong-answer trap for a preeclamptic patient'
        ],
        atiTip: 'Never give Methergine to a preeclamptic patient - it can cause a stroke.',
        highAlert: true
      }
    ],

    sbar: {
      situation: 'This is the RN caring for Jane Smith, a 28-year-old G1P0 at 36 weeks with severe preeclampsia. Her blood pressure is 178/112.',
      background: 'She has gestational hypertension that has worsened over the last two weeks. She reports severe headache, blurred vision, epigastric pain, and decreased fetal movement.',
      assessment: 'Platelets are 92,000, AST is 95 and ALT is 102, creatinine is 1.3, uric acid is 8.2, and urine protein is +3. DTRs are hyperreflexic with clonus. The fetal tracing shows a baseline of 170, minimal variability, absent accelerations, and late decelerations - a Category II tracing.',
      recommendation: 'I recommend immediate provider evaluation. Magnesium sulfate has been initiated with calcium gluconate at the bedside and seizure precautions are in place. Please assess the patient for possible delivery and additional antihypertensive therapy.'
    },

    questions: [
      { id: 'ob-severe-preeclampsia-q1', text: 'A patient at 36 weeks with preeclampsia reports a severe headache and blurred vision. What is the priority nursing action?', type: 'multiple-choice',
        options: ['Dim the lights and allow the patient to rest', 'Assess the blood pressure and notify the provider while initiating seizure precautions', 'Administer acetaminophen for the headache', 'Encourage oral fluids and reassess in one hour'],
        correct: [1], rationale: 'Headache and visual changes are severe features indicating CNS involvement and impending eclampsia. The nurse assesses the BP, escalates to the provider, and puts seizure precautions in place. A quiet environment is helpful but is not the priority action.', atiPearl: 'Headache plus visual changes in preeclampsia equals a seizure is coming.', difficulty: 'Medium' },

      { id: 'ob-severe-preeclampsia-q2', text: 'The patient asks why she is receiving magnesium sulfate. What is the nurse\'s best response?', type: 'multiple-choice',
        options: ['"It lowers your blood pressure to a safe level."', '"It prevents seizures, which are the most dangerous complication of your condition."', '"It helps your baby\'s lungs mature before delivery."', '"It stops your contractions so you do not deliver early."'],
        correct: [1], rationale: 'Magnesium sulfate is an anticonvulsant given to prevent eclamptic seizures. It does NOT treat hypertension - separate antihypertensives such as labetalol, hydralazine, or nifedipine are used for that.', atiPearl: 'Magnesium equals seizure prevention. This is the single most tested fact about preeclampsia.', difficulty: 'Easy' },

      { id: 'ob-severe-preeclampsia-q3', text: 'A patient receiving magnesium sulfate has absent deep tendon reflexes and a respiratory rate of 10/min. What is the priority nursing action?', type: 'multiple-choice',
        options: ['Slow the magnesium infusion to half the ordered rate and continue monitoring', 'Stop the magnesium infusion, notify the provider immediately, and prepare to administer calcium gluconate', 'Administer naloxone', 'Increase the IV fluid rate to flush the magnesium out'],
        correct: [1], rationale: 'Absent DTRs and RR below 12 are hallmark signs of magnesium toxicity. The infusion must be STOPPED (not slowed), the provider notified, and calcium gluconate given as the antidote while supporting respirations. Naloxone reverses opioids, not magnesium.', atiPearl: 'Stop the drip, call the provider, give calcium gluconate.', difficulty: 'Hard' },

      { id: 'ob-severe-preeclampsia-q4', text: 'Why is the preeclamptic patient positioned on her left side?', type: 'multiple-choice',
        options: ['To reduce the risk of aspiration if she seizes', 'To improve uteroplacental blood flow and fetal oxygenation by relieving vena cava compression', 'To lower the blood pressure directly', 'To promote diuresis and reduce edema'],
        correct: [1], rationale: 'The left lateral position moves the gravid uterus off the inferior vena cava, improving venous return, maternal cardiac output, uteroplacental perfusion, and fetal oxygenation. It also increases renal perfusion.', atiPearl: 'Late decelerations or fetal distress equals turn her to her left side.', difficulty: 'Easy' },

      { id: 'ob-severe-preeclampsia-q5', text: 'The patient reports severe epigastric pain. Why is this finding concerning?', type: 'multiple-choice',
        options: ['It indicates the onset of labor', 'It suggests indigestion from prolonged bedrest', 'It may indicate hepatic ischemia, liver capsule distention, and progression to HELLP syndrome', 'It is an expected finding in the third trimester'],
        correct: [2], rationale: 'Epigastric or right upper quadrant pain in a preeclamptic patient reflects liver swelling and stretching of the hepatic capsule from hepatocellular ischemia. It signals HELLP syndrome and carries a risk of liver capsule rupture. Never dismiss it as heartburn.', atiPearl: 'Epigastric or RUQ pain in pregnancy is a liver until proven otherwise.', difficulty: 'Medium' },

      { id: 'ob-severe-preeclampsia-q6', text: 'The fetal tracing shows a baseline of 170 bpm, minimal variability, absent accelerations, and late decelerations. Which finding most directly indicates uteroplacental insufficiency?', type: 'multiple-choice',
        options: ['Baseline of 170 bpm', 'Minimal variability', 'Absent accelerations', 'Late decelerations'],
        correct: [3], rationale: 'Late decelerations are the most ominous of these findings because they directly indicate uteroplacental insufficiency and fetal hypoxia. Tachycardia, minimal variability, and absent accelerations are all non-reassuring but late decelerations reflect actual impaired oxygen exchange. Minimal variability is also highly concerning and is the best single predictor of fetal acid-base status; the distinction here is that late decelerations are the finding that specifically localizes the problem to uteroplacental oxygen exchange.', atiPearl: 'Late decelerations equal placental insufficiency. VEAL CHOP: Late decels equal Placental insufficiency.', difficulty: 'Medium' },

      { id: 'ob-severe-preeclampsia-q7', text: 'What is the therapeutic serum magnesium range for seizure prophylaxis in preeclampsia?', type: 'multiple-choice',
        options: ['1-2 mEq/L', '4-7 mEq/L (approximately 5-9 mg/dL)', '8-12 mEq/L', '12-15 mEq/L'],
        correct: [1], rationale: 'The therapeutic range for seizure prophylaxis is 4-7 mEq/L, roughly 5-9 mg/dL. Loss of DTRs occurs around 8-10 mEq/L, respiratory depression around 12 mEq/L, and cardiac arrest above about 25 mEq/L.', atiPearl: 'Know 4-7 mEq/L and know that reflexes disappear first as levels climb.', difficulty: 'Medium' },

      { id: 'ob-severe-preeclampsia-q8', text: 'The patient receiving magnesium sulfate has a urine output of 18 mL/hr over the last two hours. What is the significance of this finding?', type: 'multiple-choice',
        options: ['It is an expected effect of magnesium sulfate and requires no action', 'Reduced renal clearance allows magnesium to accumulate, greatly increasing the risk of toxicity - hold the infusion and notify the provider', 'It indicates the patient needs a fluid bolus of 1000 mL', 'It means the magnesium dose should be increased'],
        correct: [1], rationale: 'Magnesium is excreted entirely by the kidneys. Urine output below 30 mL/hr means magnesium accumulates and toxicity develops rapidly. This patient already has an elevated creatinine of 1.3. The infusion is held and the provider notified. Aggressive fluid boluses risk pulmonary edema in preeclampsia.', atiPearl: 'Less than 30 mL/hr equals hold the magnesium and call.', difficulty: 'Hard' },

      { id: 'ob-severe-preeclampsia-q9', text: 'Which laboratory findings in this patient support HELLP syndrome? Select all that apply.', type: 'select-all',
        options: ['Platelets 92,000/microL', 'AST 95 units/L', 'ALT 102 units/L', 'Urine protein +3', 'Uric acid 8.2 mg/dL'],
        correct: [0, 1, 2], rationale: 'HELLP stands for Hemolysis, Elevated Liver enzymes, and Low Platelets. The low platelet count and the elevated AST and ALT are the HELLP components. Proteinuria and elevated uric acid support preeclampsia but are not part of the HELLP triad.', atiPearl: 'HELLP: Hemolysis, Elevated Liver enzymes, Low Platelets.', difficulty: 'Hard' },

      { id: 'ob-severe-preeclampsia-q10', text: 'What is the only definitive cure for preeclampsia?', type: 'multiple-choice',
        options: ['Magnesium sulfate infusion', 'Strict bedrest in the left lateral position', 'Delivery of the fetus and the placenta', 'Aggressive antihypertensive therapy'],
        correct: [2], rationale: 'Preeclampsia originates from abnormal placental function, so removing the placenta is the only cure. Magnesium, positioning, and antihypertensives are stabilizing measures. At 36 weeks with severe features, delivery is expected after maternal stabilization.', atiPearl: 'Delivery of the baby AND the placenta - the placenta is the source.', difficulty: 'Easy' },

      { id: 'ob-severe-preeclampsia-q11', text: 'This patient delivers and then develops uterine atony with heavy bleeding. Which uterotonic order should the nurse QUESTION?', type: 'multiple-choice',
        options: ['Oxytocin 20 units in 1000 mL LR IV infusion', 'Methylergonovine 0.2 mg IM', 'Misoprostol 800 mcg rectally', 'Tranexamic acid 1 g IV over 10 minutes'],
        correct: [1], rationale: 'Methylergonovine is an ergot alkaloid that causes intense vasoconstriction and is contraindicated in hypertension, preeclampsia, and eclampsia. Giving it to this patient could precipitate hypertensive crisis, seizure, or stroke. Oxytocin, misoprostol, and TXA are all safe here.', atiPearl: 'Preeclampsia plus Methergine equals stroke. Never.', difficulty: 'Hard' },

      { id: 'ob-severe-preeclampsia-q12', text: 'Which actions are part of appropriate seizure precautions for this patient? Select all that apply.', type: 'select-all',
        options: ['Pad the side rails and keep the bed in the lowest position', 'Keep suction and oxygen set up at the bedside', 'Dim the lights and minimize noise and visitors', 'Maintain patent IV access', 'Apply soft wrist restraints prophylactically'],
        correct: [0, 1, 2, 3], rationale: 'Seizure precautions include padded rails, a low bed, immediate access to suction and oxygen, a low-stimulation environment, and maintained IV access. Restraints are NEVER applied - they cause injury during a tonic-clonic seizure.', atiPearl: 'Never restrain a seizing patient. Protect, position, and never leave her alone.', difficulty: 'Medium' },

      { id: 'ob-severe-preeclampsia-q13', text: 'The patient begins a generalized tonic-clonic seizure. What is the nurse\'s FIRST action?', type: 'multiple-choice',
        options: ['Insert an oral airway between the teeth', 'Turn the patient onto her side and protect her from injury while calling for help', 'Restrain the extremities to prevent injury', 'Leave the room to obtain the emergency medication cart'],
        correct: [1], rationale: 'Turn the patient to her side to maintain the airway and prevent aspiration, protect her from injury, call for help, and stay with her. Never force anything into the mouth, never restrain, and never leave the patient alone. Oxygen and suction are applied as the seizure ends.', atiPearl: 'Side-lying, protect, call for help, never leave, never restrain, nothing in the mouth.', difficulty: 'Medium' },

      { id: 'ob-severe-preeclampsia-q14', text: 'Which blood pressure finding meets the diagnostic criteria for preeclampsia in a patient at 36 weeks with +3 proteinuria?', type: 'multiple-choice',
        options: ['138/88 on one occasion', '142/92 on two occasions at least 4 hours apart', '128/78 on three occasions', '120/70 with a 10 mmHg rise from baseline'],
        correct: [1], rationale: 'Preeclampsia requires a BP of 140/90 or higher on two occasions at least 4 hours apart after 20 weeks of gestation, plus proteinuria or other evidence of organ dysfunction. Severe range is 160/110 or higher, which this patient far exceeds at 178/112.', atiPearl: '140/90 twice after 20 weeks plus organ dysfunction equals preeclampsia. 160/110 equals severe range.', difficulty: 'Medium' }
    ],

    keyPoints: [
      'Preeclampsia equals hypertension after 20 weeks plus signs of organ damage, most commonly proteinuria',
      'Diagnostic criteria: BP at or above 140/90 on two occasions plus proteinuria, thrombocytopenia, elevated liver enzymes, renal impairment, pulmonary edema, persistent headache, or visual disturbances',
      'Severe features: BP at or above 160/110, headache, visual changes, epigastric/RUQ pain, hyperreflexia, thrombocytopenia, elevated LFTs, elevated creatinine',
      'Magnesium sulfate PREVENTS SEIZURES - it does not lower blood pressure',
      'Magnesium therapeutic range: 4-7 mEq/L (about 5-9 mg/dL)',
      'The three magnesium toxicity monitors: respirations (must be 12 or above), DTRs (must be present), urine output (must be 30 mL/hr or more)',
      'Calcium gluconate is the magnesium antidote and must be at the bedside',
      'HELLP: Hemolysis, Elevated Liver enzymes, Low Platelets',
      'Left lateral position improves uteroplacental perfusion',
      'Delivery of the fetus AND placenta is the only definitive cure',
      'Methylergonovine is contraindicated in any hypertensive or preeclamptic patient'
    ],

    pearls: [
      'Epigastric or RUQ pain in preeclampsia means liver involvement and HELLP - it is never just heartburn',
      'Loss of DTRs is the EARLIEST sign of magnesium toxicity, appearing before respiratory depression',
      'Magnesium is continued for 24 hours AFTER delivery because most postpartum eclamptic seizures occur in that window',
      'Nondependent edema of the face and hands is more significant than ankle edema in pregnancy',
      'A patient can develop preeclampsia or eclampsia for the first time up to 6 weeks postpartum',
      'Do not lower a severely elevated BP too quickly - it drops placental perfusion and causes fetal distress'
    ],

    successChecklist: [
      'Perform hand hygiene and verify patient identity',
      'Assess maternal vital signs and neurologic status (headache, vision, DTRs, clonus)',
      'Assess for edema, epigastric or RUQ pain, and urine output',
      'Review laboratory results (platelets, liver enzymes, creatinine, urine protein)',
      'Place the patient in the left lateral position',
      'Apply continuous fetal monitoring and interpret the tracing',
      'Begin or verify the magnesium sulfate loading dose and maintenance infusion',
      'Implement seizure precautions (padded rails, suction, oxygen, low stimulation)',
      'Verify calcium gluconate is available at the bedside',
      'Monitor for magnesium toxicity (respirations, DTRs, urine output)',
      'Communicate changes using SBAR, educate the patient, and prepare for possible delivery'
    ],

    criticalErrors: [
      'Continuing the magnesium infusion when the respiratory rate is below 12 or DTRs are absent',
      'Failing to have calcium gluconate immediately available at the bedside',
      'Administering magnesium sulfate without hourly assessment of respirations, DTRs, and urine output',
      'Administering methylergonovine to this hypertensive patient for postpartum bleeding',
      'Restraining the patient during an eclamptic seizure or forcing an object into her mouth',
      'Leaving a seizing patient alone',
      'Placing the patient supine, which compresses the vena cava and worsens fetal oxygenation',
      'Dismissing epigastric pain as indigestion',
      'Failing to treat sustained severe-range blood pressure within 30-60 minutes',
      'Administering a large fluid bolus, which risks pulmonary edema in preeclampsia'
    ],

    comparisons: [
      {
        title: 'Magnesium Sulfate vs Antihypertensives',
        headers: ['Magnesium Sulfate', 'Labetalol / Hydralazine / Nifedipine'],
        rows: [
          ['Prevents eclamptic seizures', 'Lowers severe-range blood pressure'],
          ['Does NOT treat hypertension', 'Does NOT prevent seizures'],
          ['Monitor RR, DTRs, urine output', 'Monitor BP and fetal tracing'],
          ['Antidote is calcium gluconate', 'No specific antidote - hold and support']
        ]
      },
      {
        title: 'Magnesium Level and Clinical Effect',
        headers: ['Serum Level', 'Clinical Finding'],
        rows: [
          ['4-7 mEq/L', 'Therapeutic for seizure prophylaxis'],
          ['8-10 mEq/L', 'Loss of deep tendon reflexes (earliest sign)'],
          ['10-13 mEq/L', 'Respiratory depression, RR less than 12'],
          ['15-25 mEq/L', 'Altered cardiac conduction'],
          ['Above 25 mEq/L', 'Cardiac arrest']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'My head has been pounding since yesterday and nothing touches it. And I keep seeing these little flashing spots.' },
      { speaker: 'patient', trigger: 'pain', line: 'It is right here under my ribs on the right. It feels like something is pressing out from the inside.' },
      { speaker: 'patient', trigger: 'assessment', line: 'Look at my hands. My rings will not come off anymore, and my face looks like a different person in the mirror.' },
      { speaker: 'patient', trigger: 'fetal', line: 'He has not been moving like he usually does. I did not feel him at all this morning. Is he okay?' },
      { speaker: 'patient', trigger: 'medication', line: 'This medicine is making me so hot. Why do I feel like I am burning up from the inside? And I can barely keep my eyes open.' },
      { speaker: 'patient', trigger: 'education', line: 'They keep saying the only fix is to have the baby. But I am only 36 weeks. Is he going to be okay if he comes now?' },
      { speaker: 'family', trigger: 'greeting', line: 'Her pressure was high at the last two appointments and they just said to watch it. Should we have come in sooner?' },
      { speaker: 'family', trigger: 'escalation', line: 'She is not making sense right now. She was fine twenty minutes ago. Something is very wrong.' },
      { speaker: 'patient', trigger: 'reassurance', line: 'Am I going to have a seizure? Please do not leave me in here by myself.' }
    ],

    patientEducation: [
      'Report immediately: worsening headache, blurred vision, seeing spots, or flashing lights',
      'Report right upper quadrant or epigastric pain right away - it can mean your liver is involved',
      'Report shortness of breath, decreased fetal movement, vaginal bleeding, contractions, or leaking fluid',
      'Magnesium sulfate is given to prevent seizures - feeling warm, flushed, and very drowsy is expected',
      'Tell the nurse right away if you feel like you cannot catch your breath',
      'Bedrest in the side-lying position improves blood flow to your baby',
      'Continuous fetal monitoring is necessary to watch how the baby tolerates the reduced blood flow',
      'Delivery of the baby and placenta is the only cure, and preeclampsia can still develop or worsen for up to 6 weeks after birth',
      'Keep all postpartum blood pressure follow-up appointments'
    ]
  },

  // ============================================================
  // OB SIM 4 - Placental Abruption with Fetal Distress
  // ============================================================
  {
    id: 'ob-placental-abruption',
    title: 'Placental Abruption',
    fullTitle: 'Placental Abruption with Fetal Distress Following Motor Vehicle Trauma',
    category: 'OB',
    course: 'NUR2212C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'TRAUMA',
    summary: 'A 28-year-old G1P0 at 35 weeks 4 days presents after a motor vehicle collision with sudden severe abdominal pain, dark red bleeding, a board-like uterus, and a Category II fetal tracing. You must prevent hemorrhagic shock, monitor for DIC, and prepare for emergency cesarean birth.',
    highYield: true,

    objectives: [
      'Perform a focused maternal assessment',
      'Assess abdominal pain and vaginal bleeding',
      'Interpret the fetal heart rate tracing',
      'Recognize placental abruption',
      'Monitor maternal and fetal status',
      'Implement emergency interventions',
      'Prepare for possible emergency cesarean birth',
      'Communicate using SBAR',
      'Educate the patient and support person',
      'Document care'
    ],

    patient: {
      name: 'Jane Smith',
      age: '28 years',
      dob: null,
      sex: 'Female',
      weightKg: null,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Suspected placental abruption with fetal distress',
      history: [
        'Involved in a minor motor vehicle collision earlier today while wearing a seatbelt',
        'Initially felt well, then developed sudden severe abdominal pain',
        'Blood type O positive',
        'GBS not yet tested',
        'Chief complaints: sudden severe abdominal pain, vaginal bleeding, decreased fetal movement'
      ],
      gravidaPara: 'G1P0',
      gestationalAge: '35 weeks 4 days'
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline on arrival',
        bp: '120/77',
        hr: 102,
        rr: 20,
        temp: '98.6 F',
        spo2: 98,
        pain: '8/10 constant, severe, unlike labor contractions',
        loc: 'Alert and oriented x4, anxious',
        other: 'Uterus firm, tender, and difficult to relax (board-like); moderate DARK RED vaginal bleeding; decreased fetal movement',
        flags: ['tachycardia', 'severe-pain', 'rigid-uterus', 'dark-red-bleeding'],
        note: 'BP is normal for now, but mild tachycardia may be the first sign of blood loss. A pregnant patient can lose a large volume before hypotension appears.'
      },
      {
        // atMin rescaled to fit durationMin 20 (the last stage used to sit past the time limit and never fired). Relative pacing preserved.
        atMin: 6,
        label: 'Concealed hemorrhage progressing',
        bp: '108/64',
        hr: 116,
        rr: 24,
        temp: '98.6 F',
        spo2: 96,
        pain: '9/10 constant, unrelenting',
        loc: 'Increasingly anxious and restless',
        other: 'Uterus remains rigid with no relaxation between contractions; fundal height increasing; external bleeding moderate but concealed loss suspected',
        flags: ['worsening', 'tachycardia', 'narrowing-pulse-pressure'],
        note: 'Rising fundal height with a rigid uterus indicates blood accumulating behind the placenta. External bleeding underestimates the true loss.'
      },
      {
        atMin: 12,
        label: 'Hemorrhagic shock with early DIC',
        bp: '92/50',
        hr: 130,
        rr: 28,
        temp: '98.2 F',
        spo2: 94,
        pain: 'Severe, unable to rate',
        loc: 'Pale, cool, clammy, restless and confused',
        other: 'Oozing from the IV insertion site and gums, petechiae on the forearm, urine output 20 mL/hr; fetal tracing with recurrent late decelerations',
        flags: ['shock', 'hypotension', 'dic', 'oliguria', 'fetal-distress'],
        note: 'Bleeding from IV sites plus a falling fibrinogen equals DIC. Draw repeat coagulation studies, activate the massive transfusion protocol, and move toward emergency cesarean.'
      },
      {
        atMin: 18,
        label: 'Decompensated shock - emergency cesarean',
        bp: '78/40',
        hr: 142,
        rr: 32,
        temp: '97.8 F',
        spo2: 90,
        pain: 'Unable to report',
        loc: 'Lethargic, difficult to arouse',
        other: 'Weak thready pulses, capillary refill greater than 4 seconds, anuric; fetal bradycardia with prolonged deceleration',
        flags: ['decompensated-shock', 'fetal-bradycardia', 'anuria'],
        note: 'This endpoint is prevented by early large-bore IV access, volume resuscitation, blood products, and timely delivery.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'Hemoglobin', value: '11', unit: 'g/dL', status: 'low', normalRange: '11-14 in pregnancy (12-16 nonpregnant)', interpretation: 'Slightly low. Serial values are more useful than a single result - an acute bleed may not yet be reflected.' },
      { panel: 'CBC', name: 'Hematocrit', value: '34', unit: '%', status: 'low', normalRange: '33-44 in pregnancy (37-47 nonpregnant)', interpretation: 'Slightly low and consistent with early blood loss. Trend serially.' },
      { panel: 'CBC', name: 'Platelets', value: '192,000', unit: '/microL', status: 'normal', normalRange: '150,000-400,000', interpretation: 'Normal now. A falling platelet count would be an early indicator of developing DIC.' },
      { panel: 'Coagulation', name: 'PT', value: '13', unit: 'seconds', status: 'normal', normalRange: '11-13.5', interpretation: 'Normal. Prolongation would signal consumptive coagulopathy.' },
      { panel: 'Coagulation', name: 'INR', value: '1.0', unit: '', status: 'normal', normalRange: '0.8-1.1', interpretation: 'Normal clotting at this time.' },
      { panel: 'Coagulation', name: 'Fibrinogen', value: '250', unit: 'mg/dL', status: 'normal', normalRange: '200-400 nonpregnant; 300-600 in pregnancy', interpretation: 'Reported as normal, but fibrinogen is physiologically ELEVATED in pregnancy (300-600). A value of 250 is relatively low for a term patient and is a warning sign. A fibrinogen below 200 in abruption strongly suggests DIC.' },
      { panel: 'Blood bank', name: 'Blood type', value: 'O positive', unit: '', status: 'normal', normalRange: '', interpretation: 'Rh POSITIVE, so Rh immune globulin (RhoGAM) is not indicated. Type and crossmatch for possible transfusion.' }
    ],

    diagnostics: [
      { name: 'Fetal heart rate tracing', finding: 'Baseline 170 bpm, minimal variability, absent accelerations, late decelerations present', interpretation: 'Category II tracing indicating uteroplacental insufficiency and fetal hypoxia. Late decelerations are the most concerning element and may require urgent delivery.' },
      { name: 'Uterine palpation', finding: 'Firm, tender, difficult to relax - board-like and rigid', interpretation: 'Classic for placental abruption. Blood behind the placenta irritates the myometrium and produces a tetanic, rigid uterus with poor relaxation between contractions.' },
      { name: 'Vaginal bleeding assessment', finding: 'Moderate amount of DARK RED blood', interpretation: 'Dark red blood is characteristic of abruption. External bleeding may drastically underestimate the true loss because hemorrhage can be concealed behind the placenta.' },
      { name: 'Serial fundal height', finding: 'Measure and mark the fundal height with a marker on the abdomen', interpretation: 'An increasing fundal height over time indicates expanding concealed retroplacental hemorrhage.' }
    ],

    orders: [
      { text: 'Continuous fetal monitoring', category: 'monitoring' },
      { text: 'Lactated Ringers IV at 125 mL/hr', category: 'medication' },
      { text: 'Insert two large-bore IVs (18 gauge or larger)', category: 'access' },
      { text: 'Type and crossmatch; have blood products available', category: 'lab' },
      { text: 'CBC and coagulation studies (PT, INR, fibrinogen, D-dimer) - repeat serially', category: 'lab' },
      { text: 'NO repeated or digital vaginal examinations until placenta location is known', category: 'procedure' },
      { text: 'Quantify blood loss; pad counts and weights', category: 'monitoring' },
      { text: 'Continuous maternal vital signs and pulse oximetry', category: 'monitoring' },
      { text: 'Oxygen 10 L/min via non-rebreather for non-reassuring fetal status', category: 'respiratory' },
      { text: 'Indwelling urinary catheter with strict intake and output', category: 'monitoring' },
      { text: 'Prepare for emergency cesarean birth', category: 'procedure' },
      { text: 'Notify the provider and anesthesia; alert the neonatal team', category: 'consult' }
    ],

    interventions: [
      { id: 'abr-1', order: 1, action: 'Assess airway, breathing, circulation, and maternal stability', rationale: 'Maternal stabilization always precedes fetal intervention. A dead mother cannot oxygenate a fetus.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Stabilize the mother to save the baby.' },
      { id: 'abr-2', order: 2, action: 'Initiate and maintain continuous fetal monitoring', rationale: 'Already ordered. The tracing is the earliest indicator of worsening abruption - late decelerations, minimal variability, and bradycardia signal the need for emergency delivery.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'abr-3', order: 3, action: 'Position the mother on her LEFT side', rationale: 'Relieves vena cava compression, improves venous return and maternal cardiac output, and maximizes uteroplacental perfusion and fetal oxygenation.', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'abr-3b', order: 4,
        action: 'Apply oxygen 10 L/min via non-rebreather mask for the non-reassuring fetal tracing',
        rationale: 'Maternal hyperoxygenation raises the oxygen content delivered across an already compromised placental bed. Oxygen is one of the four components of intrauterine resuscitation: reposition left, oxygen, IV fluid bolus, stop oxytocin. Reassess the tracing after applying it.',
        category: 'intervention', critical: true, preventsDeterioration: true,
        atiPearl: 'Late decelerations: reposition, oxygen, fluids, stop the Pitocin' },
      { id: 'abr-4', order: 5, action: 'Infuse Lactated Ringers - maintenance 125 mL/hr while stable, and bolus for hypotension, tachycardia, or a non-reassuring tracing', rationale: 'Isotonic crystalloid supports intravascular volume while blood products are obtained. 125 mL/hr is a maintenance rate, not a resuscitation rate. Once the BP falls or the tracing worsens, the nurse anticipates rapid bolus infusion through both large-bore lines and activation of the massive transfusion protocol.', category: 'medication', critical: true, preventsDeterioration: true },
      { id: 'abr-5', order: 6, action: 'Insert two large-bore IVs (18 gauge or larger)', rationale: 'Required for rapid crystalloid, blood products, and emergency anesthesia. Establish access BEFORE the patient decompensates and veins collapse.', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Two large-bore IVs go in early, not after the BP drops.' },
      { id: 'abr-6', order: 7, action: 'Monitor and quantify bleeding; do NOT perform repeated vaginal examinations', rationale: 'A digital exam can disrupt a placenta previa and cause catastrophic hemorrhage, and it does not help diagnose abruption. Quantify loss by weight, and mark serial fundal heights to detect concealed bleeding.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'abr-7', order: 8, action: 'Prepare for emergency cesarean birth if fetal or maternal status worsens', rationale: 'Consent, preoperative labs, type and crossmatch, foley catheter, abdominal prep, NPO status, and notification of anesthesia and the neonatal team.', category: 'intervention', critical: true, preventsDeterioration: false },
      { id: 'abr-8', order: 9, action: 'Monitor for disseminated intravascular coagulation', rationale: 'Watch for bleeding gums, petechiae, oozing IV sites, ecchymosis, falling fibrinogen, falling platelets, and prolonged PT/PTT. Abruption is the leading obstetric cause of DIC.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Oozing from puncture sites plus falling fibrinogen equals DIC.' },
      { id: 'abr-9', order: 10, action: 'Communicate using SBAR and educate the patient and support person', rationale: 'The patient must understand that delivery may need to happen quickly, and structured handoff is a graded element.', category: 'communication', critical: false, preventsDeterioration: false }
    ],

    medications: [
      {
        name: 'Lactated Ringers',
        brand: 'LR',
        classification: 'Isotonic crystalloid',
        dose: '125 mL/hr IV, titrate up for hemorrhage per order',
        action: 'Expands intravascular volume and supports maternal blood pressure and uteroplacental perfusion',
        onset: 'Immediate',
        sideEffects: ['Fluid overload / pulmonary edema', 'Dilutional coagulopathy with large volumes', 'Hypothermia if not warmed'],
        nursingConsiderations: [
          'Administer through large-bore access',
          'Warm fluids during rapid resuscitation to prevent hypothermia-induced coagulopathy',
          'Crystalloid is a bridge only - ongoing hemorrhage requires blood products',
          'Monitor lung sounds, urine output, and mental status'
        ],
        atiTip: 'Crystalloid buys time. Blood replaces blood.',
        highAlert: false
      },
      {
        name: 'Packed red blood cells',
        brand: 'PRBC',
        classification: 'Blood product',
        dose: '1-2 units IV per order; massive transfusion protocol if hemorrhage is uncontrolled',
        action: 'Restores oxygen-carrying capacity and intravascular volume',
        onset: 'Immediate',
        sideEffects: ['Transfusion reaction', 'Febrile nonhemolytic reaction', 'TRALI', 'Circulatory overload', 'Hypothermia', 'Citrate-induced hypocalcemia'],
        nursingConsiderations: [
          'Two-nurse verification of the patient, blood type, and unit before hanging',
          'Infuse only with 0.9 percent normal saline - NEVER with Lactated Ringers, because the calcium in LR promotes clotting in the line',
          'Stay with the patient for the first 15 minutes and take vital signs before, at 15 minutes, and after',
          'Stop the transfusion immediately for fever, chills, back pain, hypotension, or dyspnea',
          'In massive hemorrhage, give fresh frozen plasma, platelets, and cryoprecipitate along with PRBCs'
        ],
        atiTip: 'Blood runs with normal saline only. LR plus blood equals clotting.',
        highAlert: true
      },
      {
        name: 'Oxygen therapy',
        brand: 'Non-rebreather mask',
        classification: 'Medical gas / intrauterine resuscitation',
        dose: '10 L/min via non-rebreather mask',
        action: 'Increases maternal arterial oxygen content and improves oxygen delivery across the placenta',
        onset: 'Immediate',
        sideEffects: ['Dry mucous membranes', 'Patient anxiety with a tight-fitting mask'],
        nursingConsiderations: [
          'Part of intrauterine resuscitation along with left lateral positioning, IV fluid bolus, and stopping oxytocin if infusing',
          'Ensure the reservoir bag stays inflated',
          'Reassess the fetal tracing after initiating'
        ],
        atiTip: 'Intrauterine resuscitation: reposition left, oxygen, IV fluids, stop oxytocin, notify provider.',
        highAlert: false
      },
      {
        name: 'Rh immune globulin',
        brand: 'RhoGAM',
        classification: 'Immune globulin',
        dose: '300 mcg IM - NOT INDICATED for this patient',
        action: 'Prevents maternal Rh sensitization after fetomaternal hemorrhage',
        onset: 'Within 72 hours of the sensitizing event',
        sideEffects: ['Injection site soreness', 'Low-grade fever'],
        nursingConsiderations: [
          'This patient is blood type O POSITIVE, so she is Rh positive and RhoGAM is NOT indicated',
          'It WOULD be indicated for an Rh-negative mother after trauma, abruption, or any bleeding event',
          'A Kleihauer-Betke test quantifies fetomaternal hemorrhage and determines whether additional doses are needed in an Rh-negative patient'
        ],
        atiTip: 'RhoGAM is for Rh-NEGATIVE mothers only. Check the blood type before you assume.',
        highAlert: false
      },
      {
        name: 'Betamethasone',
        brand: 'Celestone Soluspan',
        classification: 'Antenatal corticosteroid',
        dose: '12 mg IM, two doses 24 hours apart - may be considered if delivery can be safely delayed',
        action: 'Accelerates fetal lung maturity',
        onset: 'Benefit begins about 24 hours after the first dose',
        sideEffects: ['Maternal hyperglycemia', 'Transient leukocytosis', 'Transient decrease in fetal movement and FHR variability'],
        nursingConsiderations: [
          'At 35 weeks 4 days a late preterm steroid course may be considered, but ONLY if delivery is not emergent',
          'Maternal or fetal instability takes absolute priority over completing a steroid course',
          'Do not delay an indicated emergency cesarean to give betamethasone'
        ],
        atiTip: 'Never delay an emergency delivery for steroids.',
        highAlert: false
      }
    ],

    sbar: {
      situation: 'This is the RN caring for Jane Smith, a 28-year-old G1P0 at 35 weeks and 4 days with suspected placental abruption.',
      background: 'She was involved in a motor vehicle collision earlier today. She now has constant severe abdominal pain rated 8 out of 10, dark red vaginal bleeding, uterine tenderness with a rigid uterus, and decreased fetal movement. Blood type is O positive and GBS status is unknown.',
      assessment: 'Maternal vital signs are BP 120/77, HR 102, RR 20, SpO2 98 percent - stable but mildly tachycardic. Hemoglobin is 11, hematocrit 34 percent, platelets 192,000, PT 13, INR 1.0, and fibrinogen 250. The fetal heart rate is 170 bpm with minimal variability, absent accelerations, and intermittent late decelerations.',
      recommendation: 'I recommend immediate bedside evaluation. Two large-bore IVs are in place, LR is infusing, continuous fetal monitoring is ongoing, and the patient may require emergency cesarean delivery if fetal status worsens. Please consider type and crossmatch and notify anesthesia and the neonatal team.'
    },

    questions: [
      { id: 'ob-placental-abruption-q1', text: 'A patient at 35 weeks reports sudden severe constant abdominal pain and dark red vaginal bleeding after a motor vehicle collision. Her uterus is rigid and tender. What is the most likely diagnosis?', type: 'multiple-choice',
        options: ['Placenta previa', 'Placental abruption', 'Preterm labor', 'Uterine rupture from a prior scar'],
        correct: [1], rationale: 'Pain plus bleeding plus a rigid, tender uterus equals placental abruption. Trauma is a major risk factor. Placenta previa causes PAINLESS bright red bleeding with a soft uterus. This is a G1P0 with no prior uterine scar, making rupture unlikely.', atiPearl: 'Pain plus bleeding plus board-like uterus equals abruption.', difficulty: 'Easy' },

      { id: 'ob-placental-abruption-q2', text: 'The fetal monitor shows a baseline of 170 bpm, minimal variability, absent accelerations, and late decelerations. Which finding most directly indicates uteroplacental insufficiency?', type: 'multiple-choice',
        options: ['Baseline 170 bpm', 'Minimal variability', 'Absent accelerations', 'Late decelerations'],
        correct: [3], rationale: 'Late decelerations directly reflect uteroplacental insufficiency and fetal hypoxia. In the setting of abruption they indicate the placenta is no longer exchanging oxygen adequately and urgent delivery may be required. Minimal variability is also highly concerning and is the best single predictor of fetal acid-base status; the distinction here is that late decelerations are the finding that specifically localizes the problem to uteroplacental oxygen exchange.', atiPearl: 'VEAL CHOP - Late decels equal Placental insufficiency.', difficulty: 'Medium' },

      { id: 'ob-placental-abruption-q3', text: 'Why are two large-bore IVs inserted in a patient with suspected placental abruption?', type: 'multiple-choice',
        options: ['To allow simultaneous administration of magnesium sulfate and oxytocin', 'To rapidly administer fluids, blood products, and medications if maternal hemorrhage occurs', 'To draw serial blood samples without repeated venipunctures', 'To reduce the risk of infiltration during a long labor'],
        correct: [1], rationale: 'Abruption can progress to catastrophic hemorrhage and emergency cesarean. Two 18-gauge or larger IVs allow rapid crystalloid and blood product resuscitation and are placed BEFORE the patient decompensates and veins become difficult to access.', atiPearl: 'Get access early - collapsed veins are impossible to cannulate.', difficulty: 'Easy' },

      { id: 'ob-placental-abruption-q4', text: 'The patient\'s uterus is firm and difficult to relax between contractions. What explains this finding?', type: 'multiple-choice',
        options: ['Normal uterine activity in the third trimester', 'Blood trapped behind the placenta irritates the myometrium, causing a rigid board-like uterus', 'The bladder is full and displacing the uterus', 'The fetus is in a persistent occiput posterior position'],
        correct: [1], rationale: 'Retroplacental blood infiltrates and irritates the myometrium (Couvelaire uterus), producing tetanic contraction with poor relaxation. This is the classic board-like uterus of abruption and it also impairs oxygen delivery to the fetus.', atiPearl: 'No relaxation between contractions equals abruption, not labor.', difficulty: 'Medium' },

      { id: 'ob-placental-abruption-q5', text: 'The patient begins oozing blood from her IV site and gums, and her fibrinogen level falls to 140 mg/dL. What complication should the nurse suspect?', type: 'multiple-choice',
        options: ['Disseminated intravascular coagulation', 'Hemolytic transfusion reaction', 'HELLP syndrome', 'Idiopathic thrombocytopenic purpura'],
        correct: [0], rationale: 'Bleeding from puncture sites and mucous membranes with a falling fibrinogen, falling platelets, and prolonged PT/PTT is DIC. Placental abruption is the leading obstetric cause because thromboplastin from the disrupted placenta enters the maternal circulation and triggers widespread clotting followed by factor depletion.', atiPearl: 'Abruption is the number one obstetric cause of DIC.', difficulty: 'Hard' },

      { id: 'ob-placental-abruption-q6', text: 'What is the priority maternal position for this patient?', type: 'multiple-choice',
        options: ['Supine with the head of the bed flat', 'Left lateral (left side-lying)', 'High Fowler', 'Trendelenburg'],
        correct: [1], rationale: 'The left lateral position moves the gravid uterus off the inferior vena cava, improving venous return, maternal cardiac output, uteroplacental perfusion, and fetal oxygenation. Supine positioning causes aortocaval compression and worsens both maternal hypotension and fetal hypoxia.', atiPearl: 'Never leave a third-trimester patient flat on her back.', difficulty: 'Easy' },

      { id: 'ob-placental-abruption-q7', text: 'Which findings distinguish placental abruption from placenta previa? Select all that apply.', type: 'select-all',
        options: ['Painful bleeding rather than painless bleeding', 'Dark red blood rather than bright red blood', 'Board-like rigid uterus rather than a soft uterus', 'Uterine tenderness rather than absence of tenderness', 'Bleeding always begins before 20 weeks'],
        correct: [0, 1, 2, 3], rationale: 'Abruption produces PAINFUL bleeding, DARK red blood, a rigid board-like tender uterus, and frequent fetal distress, often with a trauma history. Previa produces PAINLESS BRIGHT red bleeding with a soft, nontender uterus. Both occur after 20 weeks, so the last option is false.', atiPearl: 'Abruption hurts. Previa does not.', difficulty: 'Medium' },

      { id: 'ob-placental-abruption-q8', text: 'Which nursing action is CONTRAINDICATED for a patient with third-trimester vaginal bleeding of unknown cause?', type: 'multiple-choice',
        options: ['Applying an external fetal monitor', 'Performing a digital vaginal examination', 'Obtaining a type and crossmatch', 'Placing the patient in the left lateral position'],
        correct: [1], rationale: 'A digital vaginal examination is contraindicated until the placental location is known, because if a placenta previa is present the exam can perforate the placenta and cause catastrophic hemorrhage. Repeated exams also do nothing to diagnose abruption.', atiPearl: 'Third-trimester bleeding equals no digital vaginal exam until previa is ruled out.', difficulty: 'Medium' },

      { id: 'ob-placental-abruption-q9', text: 'The patient has only moderate visible vaginal bleeding but her heart rate is climbing and her fundal height has increased. How should the nurse interpret this?', type: 'multiple-choice',
        options: ['The bleeding is resolving and the increased fundal height reflects fetal growth', 'Concealed hemorrhage is accumulating behind the placenta, so external bleeding underestimates the true blood loss', 'The patient is developing polyhydramnios', 'The patient is in active labor'],
        correct: [1], rationale: 'In abruption, blood can be trapped behind the placenta rather than escaping through the cervix. Rising fundal height with worsening tachycardia signals expanding concealed hemorrhage. Never judge the severity of an abruption by the visible blood alone.', atiPearl: 'Concealed hemorrhage kills - trend the fundal height and the vital signs, not just the pad count.', difficulty: 'Hard' },

      { id: 'ob-placental-abruption-q10', text: 'The patient\'s blood pressure is 120/77 with a heart rate of 102. What is the most accurate interpretation?', type: 'multiple-choice',
        options: ['The patient is hemodynamically stable and can be reassessed in one hour', 'Mild tachycardia may be an early sign of blood loss, because a pregnant patient can lose a significant volume before hypotension develops', 'The heart rate elevation is caused by pain and has no hemodynamic significance', 'The patient requires immediate vasopressor support'],
        correct: [1], rationale: 'Pregnancy increases blood volume by 40-50 percent, so a pregnant patient can lose 1500 mL or more before the blood pressure falls. Tachycardia is the earliest warning of hypovolemia and must never be dismissed as anxiety or pain.', atiPearl: 'In pregnancy the blood pressure is the LAST thing to change. Watch the pulse.', difficulty: 'Hard' },

      { id: 'ob-placental-abruption-q11', text: 'Which findings would alert the nurse to developing DIC? Select all that apply.', type: 'select-all',
        options: ['Bleeding from the gums', 'Petechiae and ecchymosis', 'Oozing from IV insertion sites', 'Falling fibrinogen level', 'Prolonged PT and PTT'],
        correct: [0, 1, 2, 3, 4], rationale: 'All of these indicate consumptive coagulopathy. Clotting factors and platelets are consumed by widespread microthrombi, leaving the patient unable to clot. Fibrinogen is the most sensitive early marker in obstetric DIC and would be expected to be high in a healthy pregnancy.', atiPearl: 'A pregnant patient who oozes from every puncture site is in DIC until proven otherwise.', difficulty: 'Medium' },

      { id: 'ob-placental-abruption-q12', text: 'The patient\'s blood type is O positive. What does the nurse conclude about Rh immune globulin (RhoGAM)?', type: 'multiple-choice',
        options: ['RhoGAM should be administered within 72 hours because of the trauma', 'RhoGAM is not indicated because the patient is Rh positive', 'RhoGAM should be given only if the newborn is Rh negative', 'RhoGAM must be given before any blood transfusion'],
        correct: [1], rationale: 'RhoGAM prevents Rh sensitization in Rh-NEGATIVE mothers. This patient is O POSITIVE, so she cannot be sensitized to the Rh antigen and RhoGAM is not indicated. An Rh-negative mother after trauma or abruption would need it, guided by a Kleihauer-Betke test.', atiPearl: 'Check the Rh status before you assume RhoGAM is needed.', difficulty: 'Medium' },

      { id: 'ob-placental-abruption-q13', text: 'Blood products are ordered. Which solution must the nurse use to prime the line and infuse with packed red blood cells?', type: 'multiple-choice',
        options: ['Lactated Ringers', '0.9 percent sodium chloride (normal saline)', 'Dextrose 5 percent in water', '0.45 percent sodium chloride'],
        correct: [1], rationale: 'Only 0.9 percent normal saline may be used with blood products. Lactated Ringers contains calcium, which can overcome the citrate anticoagulant and cause clotting in the tubing. Dextrose solutions cause hemolysis.', atiPearl: 'Blood plus normal saline only. Never LR, never dextrose.', difficulty: 'Medium' },

      { id: 'ob-placental-abruption-q14', text: 'Which risk factors are associated with placental abruption? Select all that apply.', type: 'select-all',
        options: ['Maternal hypertension or preeclampsia', 'Abdominal trauma such as a motor vehicle collision', 'Cocaine use', 'Cigarette smoking', 'Previous placental abruption'],
        correct: [0, 1, 2, 3, 4], rationale: 'All are established risk factors. Hypertension and preeclampsia are the most common medical risk factors, trauma is the classic acute cause, cocaine causes vasoconstriction and abrupt separation, and a prior abruption raises the recurrence risk substantially. Multiparity is also a risk factor.', atiPearl: 'Hypertension and trauma are the two biggest abruption triggers.', difficulty: 'Easy' }
    ],

    keyPoints: [
      'Placental abruption is premature separation of a normally implanted placenta after 20 weeks and before delivery',
      'Classic triad: painful dark red bleeding, rigid board-like tender uterus, and fetal distress',
      'Trauma, hypertension, preeclampsia, cocaine, smoking, multiparity, and prior abruption are the risk factors',
      'External bleeding may drastically UNDERESTIMATE the true loss because hemorrhage can be concealed behind the placenta',
      'A pregnant patient can lose a large volume of blood before hypotension appears - tachycardia comes first',
      'Left lateral position improves uteroplacental perfusion and maternal cardiac output',
      'Two large-bore IVs must be placed early for fluids, blood, and emergency surgery',
      'NO digital vaginal examination until placenta location is known',
      'Abruption is the leading obstetric cause of DIC - monitor fibrinogen, platelets, PT, and PTT',
      'Delivery, often emergency cesarean, is the definitive treatment when maternal or fetal status deteriorates'
    ],

    pearls: [
      'If you see pain plus bleeding plus a rigid uterus, think placental abruption',
      'Fibrinogen is normally HIGH in pregnancy (300-600), so a "normal" 250 is actually a red flag in abruption',
      'Mark the fundal height on the abdomen to detect expanding concealed hemorrhage',
      'Blood products run with normal saline only - never with Lactated Ringers',
      'Intrauterine resuscitation: reposition to the left, oxygen 10 L non-rebreather, IV fluid bolus, stop oxytocin, notify the provider',
      'Stabilize the mother first - fetal outcome depends entirely on maternal perfusion'
    ],

    successChecklist: [
      'Perform hand hygiene and verify patient identity',
      'Assess maternal airway, breathing, circulation, and vital signs',
      'Assess abdominal pain (location, severity, constant versus intermittent)',
      'Assess uterine tone (expect a rigid, tender uterus)',
      'Assess the amount and color of vaginal bleeding and quantify the loss',
      'Place the patient in the left lateral position',
      'Apply or continue continuous fetal monitoring and interpret the tracing',
      'Maintain the LR infusion and ensure two large-bore IVs are available',
      'Monitor for maternal hypovolemia and signs of DIC',
      'Notify the provider using SBAR and prepare for emergency cesarean birth if maternal or fetal status deteriorates'
    ],

    criticalErrors: [
      'Performing a digital vaginal examination before the placenta location is known',
      'Placing the patient supine, causing aortocaval compression and worsening fetal hypoxia',
      'Estimating blood loss visually instead of quantifying it, and ignoring the possibility of concealed hemorrhage',
      'Delaying placement of large-bore IV access until the patient is hypotensive',
      'Attributing maternal tachycardia to anxiety or pain instead of blood loss',
      'Administering an oxytocin infusion to augment labor in an active abruption with fetal distress',
      'Hanging blood products with Lactated Ringers instead of normal saline',
      'Failing to recognize oozing IV sites and falling fibrinogen as DIC',
      'Delaying an emergency cesarean to complete a betamethasone course',
      'Discharging or minimizing a pregnant trauma patient who initially feels well - abruption can present hours later'
    ],

    comparisons: [
      {
        title: 'Placental Abruption vs Placenta Previa',
        headers: ['Placental Abruption', 'Placenta Previa'],
        rows: [
          ['Painful bleeding', 'Painless bleeding'],
          ['Dark red blood', 'Bright red blood'],
          ['Board-like uterus', 'Soft uterus'],
          ['Uterine tenderness', 'No tenderness'],
          ['Trauma common', 'No trauma required'],
          ['Fetal distress common', 'Fetal distress less common initially'],
          ['Vaginal exam contraindicated until placenta location known', 'Digital vaginal exam contraindicated']
        ]
      },
      {
        title: 'Normal Pregnancy Labs vs This Patient',
        headers: ['Lab (pregnancy value)', 'This Patient'],
        rows: [
          ['Hemoglobin 11-14 g/dL', '11 - slightly low'],
          ['Hematocrit 33-44 percent', '34 percent - slightly low'],
          ['Platelets 150,000-400,000', '192,000 - normal'],
          ['Fibrinogen 300-600 mg/dL in pregnancy', '250 - relatively LOW for pregnancy, watch for DIC'],
          ['PT 11-13.5 sec / INR 0.8-1.1', '13 / 1.0 - normal']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'It came on all at once. The accident was hours ago and I felt totally fine, and then this pain just hit me and it has not let up for a second.' },
      { speaker: 'patient', trigger: 'pain', line: 'It is an eight, maybe a nine. It does not come and go like contractions - it is just constant. My whole belly feels like a rock.' },
      { speaker: 'patient', trigger: 'bleeding', line: 'The blood is dark. Almost brownish red. Is that supposed to look like that?' },
      { speaker: 'patient', trigger: 'fetal', line: 'She has not kicked since we got here. She is usually so active in the evening. Please tell me she is okay.' },
      { speaker: 'patient', trigger: 'assessment', line: 'Please do not press there. I am serious, that is unbearable.' },
      { speaker: 'patient', trigger: 'escalation', line: 'You are calling the surgery team? Am I having the baby right now? I am only 35 weeks.' },
      { speaker: 'family', trigger: 'greeting', line: 'I was driving. It was barely a fender bender, she had her seatbelt on the whole time. Did I do this?' },
      { speaker: 'family', trigger: 'reassurance', line: 'She is white as a sheet and her hands are freezing. That is not normal, is it?' },
      { speaker: 'patient', trigger: 'education', line: 'What does it mean that the placenta came off? Can they put it back?' }
    ],

    patientEducation: [
      'Placental abruption means the placenta has partially separated from the wall of the uterus',
      'Continuous monitoring is needed because the baby\'s condition can change within minutes',
      'Emergency cesarean delivery may become necessary and the team is prepared for it',
      'Report any increase in pain, bleeding, contractions, or decreased fetal movement immediately',
      'Tell the nurse right away if you feel dizzy, lightheaded, short of breath, or if you notice bleeding from your gums or IV site',
      'After any abdominal trauma in pregnancy, always be evaluated even if you feel fine, because abruption can appear hours later',
      'Wear the seatbelt low across the hip bones and below the pregnant abdomen, with the shoulder strap between the breasts',
      'Avoid smoking and cocaine, which are major risk factors for abruption in future pregnancies'
    ]
  },

  // ============================================================
  // OB SIM 5 - Preterm Labor at 32 Weeks 5 Days
  // ============================================================
  {
    id: 'ob-preterm-labor',
    title: 'Preterm Labor',
    fullTitle: 'Preterm Labor Management at 32 Weeks 5 Days Gestation',
    category: 'OB',
    course: 'NUR2212C',
    difficulty: 'Medium',
    durationMin: 20,
    icon: 'CONTRACTION',
    summary: 'A 28-year-old G2P1 at 32 weeks 5 days presents with contractions every 5-7 minutes, pelvic pressure, and cervical change to 2 cm/70 percent. You must delay delivery with tocolysis, promote fetal lung maturity with betamethasone, and monitor mother and fetus.',
    highYield: true,

    objectives: [
      'Perform a focused maternal assessment',
      'Assess the contraction pattern',
      'Interpret the fetal heart rate tracing',
      'Recognize preterm labor',
      'Administer prescribed medications safely',
      'Monitor maternal and fetal status',
      'Educate the patient',
      'Communicate using SBAR',
      'Document care'
    ],

    patient: {
      name: 'Jane Smith',
      age: '28 years',
      dob: null,
      sex: 'Female',
      weightKg: null,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Preterm labor at 32 weeks 5 days gestation',
      history: [
        'Blood type B positive',
        'GBS status unknown',
        'Chief complaints: lower abdominal cramping, pelvic pressure, low back pain, contractions every 5-7 minutes, increased vaginal discharge',
        'DENIES vaginal bleeding',
        'Cervical exam: 2 cm dilated, 70 percent effaced, station -2, membranes intact'
      ],
      gravidaPara: 'G2P1',
      gestationalAge: '32 weeks 5 days'
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline on admission',
        bp: '124/76',
        hr: 96,
        rr: 20,
        temp: '98.9 F',
        spo2: 98,
        pain: 'Cramping and pelvic pressure, 5/10 with contractions',
        loc: 'Alert and oriented x4, anxious about delivering early',
        other: 'Contractions every 5-7 minutes; cervix 2 cm / 70 percent / station -2, membranes intact; increased clear vaginal discharge; no bleeding',
        flags: ['preterm-contractions', 'cervical-change'],
        note: 'All maternal vital signs are within normal limits. The problem is cervical change before 37 weeks, not maternal instability.'
      },
      {
        // atMin rescaled to fit durationMin 20 (the last stage used to sit past the time limit and never fired). Relative pacing preserved.
        atMin: 6,
        label: 'After IV hydration and left lateral positioning',
        bp: '120/74',
        hr: 92,
        rr: 18,
        temp: '98.8 F',
        spo2: 98,
        pain: 'Cramping 4/10',
        loc: 'Alert, calmer with explanation of the plan',
        other: 'Contractions spacing to every 7-8 minutes; LR infusing; fetal tracing remains Category I',
        flags: [],
        note: 'Hydration decreases uterine irritability. Dehydration releases ADH, which is structurally similar to oxytocin and can stimulate contractions.'
      },
      {
        atMin: 12,
        label: 'After nifedipine administration - expected side effects',
        bp: '104/62',
        hr: 108,
        rr: 18,
        temp: '98.8 F',
        spo2: 98,
        pain: 'Cramping 3/10',
        loc: 'Alert, reports mild dizziness, headache, and facial flushing',
        other: 'Contractions every 10-12 minutes; reflex tachycardia and mild hypotension from the calcium channel blocker',
        flags: ['hypotension', 'reflex-tachycardia', 'headache', 'flushing'],
        note: 'Expected nifedipine effects. Recheck BP before each dose, keep the patient in bed, and assist with position changes to prevent falls.'
      },
      {
        atMin: 18,
        label: 'Stabilized on tocolysis',
        bp: '112/68',
        hr: 98,
        rr: 18,
        temp: '98.9 F',
        spo2: 98,
        pain: 'Cramping 2/10',
        loc: 'Alert and comfortable in the left lateral position',
        other: 'Contractions every 15 minutes and decreasing in intensity; first betamethasone dose given IM; fetal tracing Category I with baseline 145 and moderate variability',
        flags: [],
        note: 'Target outcome - tocolysis buying the 48-hour window for betamethasone to work. Continue monitoring for return of contractions, bleeding, or rupture of membranes.'
      }
    ],

    labs: [
      { panel: 'Screening', name: 'Group B Streptococcus (GBS)', value: 'Unknown', unit: '', status: 'normal', normalRange: 'Screened at 36-37 weeks', interpretation: 'GBS status is unknown at 32 weeks 5 days. If delivery becomes imminent, intrapartum antibiotic prophylaxis (penicillin G) is given empirically for any preterm birth with unknown GBS status.' },
      { panel: 'Blood bank', name: 'Blood type', value: 'B positive', unit: '', status: 'normal', normalRange: '', interpretation: 'Rh positive, so Rh immune globulin is not indicated.' },
      { panel: 'Special', name: 'Fetal fibronectin (fFN)', value: 'May be obtained', unit: '', status: 'normal', normalRange: 'Used between 22 and 35 weeks', interpretation: 'A POSITIVE result indicates increased risk of delivery within 7-14 days. A NEGATIVE result is highly reassuring and has strong negative predictive value for imminent delivery. Collect BEFORE any digital exam, lubricant, or intercourse within 24 hours, or the result is invalid.' },
      { panel: 'Urinalysis', name: 'Urinalysis and culture', value: 'Obtained', unit: '', status: 'normal', normalRange: '', interpretation: 'Urinary tract infection is a common and treatable trigger for preterm contractions and should always be ruled out.' }
    ],

    diagnostics: [
      { name: 'Fetal heart rate tracing', finding: 'Baseline 145 bpm, moderate variability, two accelerations, no decelerations', interpretation: 'CATEGORY I - normal and reassuring tracing. Moderate variability is the single best indicator of adequate fetal oxygenation and an intact fetal CNS.' },
      { name: 'Cervical examination', finding: '2 cm dilated, 70 percent effaced, station -2, membranes intact', interpretation: 'Cervical change before 37 weeks confirms true preterm labor. Station -2 means the presenting part is 2 cm above the ischial spines. Intact membranes are favorable.' },
      { name: 'Contraction pattern (tocodynamometer)', finding: 'Contractions every 5-7 minutes on admission', interpretation: 'Assess frequency, duration, intensity, and resting tone. Regular contractions plus cervical change equal preterm labor; contractions without cervical change are typically Braxton Hicks.' },
      { name: 'Transvaginal cervical length ultrasound', finding: 'May be ordered', interpretation: 'A cervical length less than 25 mm before 34 weeks predicts increased risk of preterm birth.' }
    ],

    orders: [
      { text: 'Continuous fetal monitoring', category: 'monitoring' },
      { text: 'Lactated Ringers IV for hydration', category: 'medication' },
      { text: 'Betamethasone 12 mg IM, two doses 24 hours apart', category: 'medication' },
      { text: 'Nifedipine PO as tocolytic per protocol', category: 'medication' },
      { text: 'Bedrest', category: 'monitoring' },
      { text: 'Left lateral position', category: 'monitoring' },
      { text: 'Monitor contraction pattern continuously', category: 'monitoring' },
      { text: 'Vital signs with blood pressure before each nifedipine dose', category: 'monitoring' }
    ],

    interventions: [
      { id: 'ptl-1', order: 1, action: 'Assess maternal and fetal status', rationale: 'Establish the baseline: maternal vital signs, pain, contraction pattern, bleeding, membrane status, and fetal heart rate before any intervention.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'ptl-2', order: 2, action: 'Initiate continuous fetal monitoring', rationale: 'Already ordered. Establishes the Category I baseline and detects any change caused by contractions or tocolytic medications.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'ptl-3', order: 3, action: 'Assess the contraction pattern - frequency, duration, intensity, and resting tone', rationale: 'Distinguishes true preterm labor from Braxton Hicks and provides the measure of whether tocolysis is working. Resting tone must return to soft between contractions.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'ptl-4', order: 4, action: 'Place the patient in the left lateral position', rationale: 'Improves uteroplacental blood flow, increases fetal oxygenation, and reduces vena cava compression.', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'ptl-5', order: 5, action: 'Provide IV hydration with Lactated Ringers', rationale: 'Dehydration triggers ADH release, which is structurally similar to oxytocin and stimulates uterine activity. Hydration can decrease uterine irritability and contraction frequency.', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'ptl-6', order: 6, action: 'Administer nifedipine as the tocolytic - check the blood pressure FIRST', rationale: 'Nifedipine is a calcium channel blocker that relaxes uterine smooth muscle to delay delivery. It also lowers maternal blood pressure, so the BP must be assessed before every dose.', category: 'medication', critical: true, preventsDeterioration: true, atiPearl: 'Always check the mother\'s blood pressure before giving nifedipine.' },
      { id: 'ptl-7', order: 7, action: 'Administer betamethasone 12 mg IM to accelerate fetal lung maturity', rationale: 'The entire purpose of tocolysis is to buy 48 hours for corticosteroids to work. Benefit begins at 24 hours after the first dose and is maximal 48 hours after the second dose.', category: 'medication', critical: true, preventsDeterioration: false, atiPearl: 'Tocolytics buy time; betamethasone is what actually helps the baby.' },
      { id: 'ptl-8', order: 8, action: 'Educate the patient, communicate using SBAR, and document', rationale: 'The patient must know which symptoms require an immediate return, and structured provider communication is a graded element.', category: 'education', critical: false, preventsDeterioration: false }
    ],

    medications: [
      {
        name: 'Betamethasone',
        brand: 'Celestone Soluspan',
        classification: 'Antenatal corticosteroid',
        dose: '12 mg IM, TWO doses given 24 hours apart',
        action: 'Crosses the placenta and accelerates fetal lung maturity by stimulating surfactant production',
        onset: 'Benefit begins about 24 hours after the first dose; maximal benefit 48 hours after the second dose',
        sideEffects: ['Maternal hyperglycemia', 'Transient maternal leukocytosis', 'Fluid retention and pulmonary edema (especially combined with tocolytics)', 'Transient decrease in fetal movement and FHR variability'],
        nursingConsiderations: [
          'Indicated between 24 and 34 weeks, and sometimes up to 36 weeks 6 days if indicated',
          'Reduces respiratory distress syndrome, intraventricular hemorrhage, necrotizing enterocolitis, and neonatal death',
          'Give IM in a large muscle - the ventrogluteal site is preferred',
          'Monitor blood glucose closely in a diabetic patient, since steroids raise glucose significantly',
          'Do NOT delay an emergency delivery to complete the steroid course',
          'A transient decrease in fetal movement and variability for 24-48 hours after dosing is expected and not a sign of fetal compromise'
        ],
        atiTip: 'Betamethasone equals fetal LUNG maturity. Two doses, 12 mg, 24 hours apart.',
        highAlert: false
      },
      {
        name: 'Nifedipine',
        brand: 'Procardia',
        classification: 'Dihydropyridine calcium channel blocker - tocolytic',
        dose: '10-20 mg PO, may repeat every 3-6 hours per protocol (loading regimens vary by facility)',
        action: 'Blocks calcium influx into uterine smooth muscle, relaxing the myometrium and suppressing contractions',
        onset: '20-30 minutes PO',
        sideEffects: ['HYPOTENSION', 'Dizziness', 'Headache', 'Facial flushing', 'Reflex tachycardia', 'Nausea', 'Peripheral edema'],
        nursingConsiderations: [
          'ALWAYS CHECK THE MATERNAL BLOOD PRESSURE BEFORE EVERY DOSE - hold and notify the provider for hypotension',
          'Hold for systolic BP below 90 mmHg or per facility parameters',
          'Keep the patient in bed and assist with all position changes because of dizziness and fall risk',
          'Use with EXTREME caution with magnesium sulfate - the combination can cause profound hypotension and neuromuscular blockade',
          'Monitor the fetal heart rate for changes caused by maternal hypotension',
          'Currently a preferred tocolytic because of its oral route and favorable side effect profile'
        ],
        atiTip: 'Nifedipine plus low BP equals hold the dose and call.',
        highAlert: false
      },
      {
        name: 'Terbutaline',
        brand: 'Brethine',
        classification: 'Beta-2 adrenergic agonist - tocolytic',
        dose: '0.25 mg subcutaneously every 20 minutes to 3 hours, SHORT TERM ONLY (no longer than 48-72 hours)',
        action: 'Stimulates beta-2 receptors in uterine smooth muscle, causing relaxation and suppression of contractions',
        onset: '3-5 minutes subcutaneously',
        sideEffects: ['Maternal and fetal TACHYCARDIA', 'Palpitations', 'Tremors and nervousness', 'HYPERGLYCEMIA', 'Hypokalemia', 'Chest pain', 'Pulmonary edema (rare but life-threatening)'],
        nursingConsiderations: [
          'HOLD and notify the provider for a maternal heart rate above 120 bpm',
          'FDA black box warning: not for prolonged tocolysis beyond 48-72 hours because of maternal cardiac events and death',
          'AVOID in significant maternal cardiac disease',
          'Use with caution in diabetes - it raises blood glucose',
          'Assess lung sounds every shift for pulmonary edema, especially when combined with corticosteroids and IV fluids',
          'Monitor potassium and glucose'
        ],
        atiTip: 'Terbutaline equals tachycardia. HR above 120 means hold it.',
        highAlert: true
      },
      {
        name: 'Magnesium sulfate (fetal neuroprotection)',
        brand: 'MgSO4',
        classification: 'CNS depressant / neuroprotective agent',
        dose: 'Loading dose 4-6 g IV over 20-30 minutes, then 1-2 g/hr per protocol when birth before 32 weeks appears imminent',
        action: 'Neuroprotective effect on the developing fetal brain, reducing the risk of cerebral palsy in preterm infants',
        onset: 'Immediate with the IV load',
        sideEffects: ['Flushing and warmth', 'Nausea', 'Drowsiness', 'Muscle weakness', 'Respiratory depression', 'Pulmonary edema'],
        nursingConsiderations: [
          'Used for FETAL NEUROPROTECTION before 32 weeks, NOT primarily as a tocolytic - this is different from its use to prevent seizures in preeclampsia',
          'Assess respirations, deep tendon reflexes, and urine output hourly',
          'Hold for RR less than 12, absent DTRs, or urine output less than 30 mL/hr',
          'Keep CALCIUM GLUCONATE at the bedside as the antidote',
          'Do not combine casually with nifedipine - the combination risks profound hypotension',
          'Monitor the newborn for hypotonia and respiratory depression after delivery'
        ],
        atiTip: 'Magnesium has three OB uses: seizure prevention in preeclampsia, fetal neuroprotection before 32 weeks, and occasionally tocolysis.',
        highAlert: true
      },
      {
        name: 'Lactated Ringers',
        brand: 'LR',
        classification: 'Isotonic crystalloid',
        dose: 'IV infusion per order for hydration',
        action: 'Corrects dehydration, which reduces ADH release and decreases uterine irritability',
        onset: 'Within 30-60 minutes on contraction frequency',
        sideEffects: ['Fluid overload', 'Pulmonary edema when combined with beta-agonist tocolytics and corticosteroids'],
        nursingConsiderations: [
          'Assess lung sounds and intake and output, especially if terbutaline or magnesium is also being given',
          'Avoid excessive fluid boluses - pulmonary edema is a real risk with combined tocolysis and steroids'
        ],
        atiTip: 'Hydration decreases uterine irritability, but do not drown the patient.',
        highAlert: false
      },
      {
        name: 'Penicillin G (GBS prophylaxis)',
        brand: 'Pfizerpen',
        classification: 'Beta-lactam antibiotic',
        dose: '5 million units IV loading dose, then 2.5-3 million units IV every 4 hours until delivery',
        action: 'Prevents early-onset neonatal group B streptococcal sepsis',
        onset: 'Adequate fetal levels within about 4 hours of the first dose',
        sideEffects: ['Allergic reaction including anaphylaxis', 'Rash', 'Diarrhea'],
        nursingConsiderations: [
          'This patient has UNKNOWN GBS status at less than 37 weeks, so empiric prophylaxis is indicated if delivery becomes imminent',
          'Verify penicillin allergy status before administration; cefazolin or clindamycin/vancomycin are alternatives depending on the reaction severity',
          'Aim for at least 4 hours of antibiotic exposure before delivery for maximum benefit'
        ],
        atiTip: 'Preterm birth with unknown GBS equals treat empirically.',
        highAlert: false
      }
    ],

    sbar: {
      situation: 'This is the RN caring for Jane Smith, a 28-year-old G2P1 at 32 weeks and 5 days in preterm labor.',
      background: 'She reports contractions every 5 to 7 minutes, pelvic pressure, low back pain, and increased vaginal discharge with no bleeding. Cervix is 2 cm dilated, 70 percent effaced, station -2, with intact membranes. Blood type B positive, GBS unknown.',
      assessment: 'Maternal vital signs are stable at BP 124/76, HR 96, RR 20, temp 98.9 F, SpO2 98 percent. Fetal heart rate is 145 bpm with moderate variability, two accelerations, no decelerations - a Category I tracing.',
      recommendation: 'Nifedipine has been administered, betamethasone has been ordered, LR is infusing, and the patient is in the left lateral position. Please evaluate ongoing labor progression and additional management, including whether magnesium sulfate for fetal neuroprotection is indicated.'
    },

    questions: [
      { id: 'ob-preterm-labor-q1', text: 'A patient at 32 weeks reports pelvic pressure and contractions every 5 minutes. What is the priority nursing action?', type: 'multiple-choice',
        options: ['Administer a tocolytic immediately', 'Assess the contraction pattern, cervical status, and fetal heart rate', 'Instruct the patient to walk to see if the contractions stop', 'Prepare the patient for immediate delivery'],
        correct: [1], rationale: 'Assessment precedes intervention. The nurse must characterize the contractions (frequency, duration, intensity, resting tone), determine whether cervical change is occurring, and establish the fetal heart rate baseline before medications are given.', atiPearl: 'Assess before you medicate. Contractions without cervical change are not preterm labor.', difficulty: 'Medium' },

      { id: 'ob-preterm-labor-q2', text: 'The patient asks why she is receiving betamethasone. What is the nurse\'s best response?', type: 'multiple-choice',
        options: ['"It stops your contractions so the baby stays in longer."', '"It speeds up your baby\'s lung development so he has fewer breathing problems if he is born early."', '"It prevents you from having a seizure."', '"It treats an infection that may have started your labor."'],
        correct: [1], rationale: 'Betamethasone is an antenatal corticosteroid that crosses the placenta and stimulates surfactant production, accelerating fetal lung maturity. It reduces respiratory distress syndrome, intraventricular hemorrhage, necrotizing enterocolitis, and neonatal death.', atiPearl: 'Betamethasone equals LUNGS. Nifedipine equals CONTRACTIONS.', difficulty: 'Easy' },

      { id: 'ob-preterm-labor-q3', text: 'Why is nifedipine prescribed for this patient?', type: 'multiple-choice',
        options: ['To lower the blood pressure to a safe level', 'To suppress uterine contractions and delay labor so corticosteroids have time to work', 'To accelerate fetal lung maturity', 'To prevent group B streptococcal infection'],
        correct: [1], rationale: 'Nifedipine is a calcium channel blocker used as a tocolytic. Blocking calcium influx relaxes uterine smooth muscle and suppresses contractions, buying the 48-hour window needed for betamethasone to take full effect.', atiPearl: 'Tocolysis is not about stopping labor forever - it is about buying 48 hours.', difficulty: 'Easy' },

      { id: 'ob-preterm-labor-q4', text: 'Which fetal heart rate findings indicate a reassuring Category I tracing? Select all that apply.', type: 'select-all',
        options: ['Baseline 145 bpm', 'Moderate variability', 'Presence of accelerations', 'Absence of late or variable decelerations', 'Baseline 170 bpm with minimal variability'],
        correct: [0, 1, 2, 3], rationale: 'Category I requires a baseline of 110-160 bpm, moderate variability, no late or variable decelerations, and either present or absent accelerations. A baseline of 170 with minimal variability is Category II and non-reassuring. Moderate variability is the single best indicator of fetal well-being.', atiPearl: 'Moderate variability equals an oxygenated fetal brain.', difficulty: 'Medium' },

      { id: 'ob-preterm-labor-q5', text: 'Before administering nifedipine, which assessment is MOST important?', type: 'multiple-choice',
        options: ['Maternal temperature', 'Maternal blood pressure', 'Deep tendon reflexes', 'Maternal blood glucose'],
        correct: [1], rationale: 'Nifedipine is a calcium channel blocker that causes vasodilation and hypotension. The blood pressure must be checked before every dose and the medication held for hypotension per protocol, because maternal hypotension reduces placental perfusion and causes fetal distress.', atiPearl: 'Check the BP before every dose of nifedipine.', difficulty: 'Medium' },

      { id: 'ob-preterm-labor-q6', text: 'A patient receiving terbutaline subcutaneously has a maternal heart rate of 132 bpm and reports palpitations and chest tightness. What is the nurse\'s priority action?', type: 'multiple-choice',
        options: ['Document the expected side effect and continue therapy', 'Hold the next dose, notify the provider, and assess lung sounds and cardiac status', 'Administer the next dose early to control the contractions', 'Encourage the patient to walk to relieve the palpitations'],
        correct: [1], rationale: 'Terbutaline is a beta-2 agonist that causes maternal tachycardia. A heart rate above 120 bpm requires holding the dose and notifying the provider. Chest tightness raises concern for pulmonary edema or myocardial ischemia, both of which are in the FDA black box warning against prolonged terbutaline tocolysis.', atiPearl: 'Terbutaline plus HR above 120 equals hold and call.', difficulty: 'Hard' },

      { id: 'ob-preterm-labor-q7', text: 'Why might magnesium sulfate be added for this patient at 32 weeks 5 days if delivery becomes imminent before 32 weeks in a future admission?', type: 'multiple-choice',
        options: ['To prevent eclamptic seizures', 'For fetal neuroprotection, reducing the risk of cerebral palsy in the preterm infant', 'To treat maternal hypertension', 'To accelerate fetal lung maturity'],
        correct: [1], rationale: 'When birth before 32 weeks appears imminent, magnesium sulfate is given for FETAL NEUROPROTECTION to reduce the risk of cerebral palsy. This is a distinct indication from its use as an anticonvulsant in preeclampsia, and it is not primarily a tocolytic.', atiPearl: 'Magnesium before 32 weeks equals brain protection. Magnesium in preeclampsia equals seizure prevention.', difficulty: 'Hard' },

      { id: 'ob-preterm-labor-q8', text: 'A fetal fibronectin test is NEGATIVE. How should the nurse interpret this result?', type: 'multiple-choice',
        options: ['Delivery within 7-14 days is highly likely', 'Delivery within the next 7-14 days is unlikely - this is a reassuring result', 'The patient has an intra-amniotic infection', 'The membranes have ruptured'],
        correct: [1], rationale: 'Fetal fibronectin is used between 22 and 35 weeks. Its value lies in its strong NEGATIVE predictive value: a negative result means delivery within 7-14 days is unlikely. A positive result indicates increased risk. The specimen must be collected before any digital exam, lubricant, or recent intercourse or the result is invalid.', atiPearl: 'fFN is most useful when it is negative.', difficulty: 'Medium' },

      { id: 'ob-preterm-labor-q9', text: 'Which symptoms should the nurse instruct the patient to report IMMEDIATELY after discharge? Select all that apply.', type: 'select-all',
        options: ['Contractions becoming more frequent or stronger', 'Leakage of fluid from the vagina', 'Vaginal bleeding', 'Decreased fetal movement', 'Fever'],
        correct: [0, 1, 2, 3, 4], rationale: 'All of these indicate progressing preterm labor, rupture of membranes, abruption, fetal compromise, or infection. The patient should also report severe abdominal pain. Any of these warrants immediate evaluation.', atiPearl: 'Contractions, bleeding, leaking, less movement, fever - the five call-now symptoms.', difficulty: 'Easy' },

      { id: 'ob-preterm-labor-q10', text: 'What is the most effective maternal position for this patient?', type: 'multiple-choice',
        options: ['Supine with the legs elevated', 'Left lateral (left side-lying)', 'High Fowler', 'Prone'],
        correct: [1], rationale: 'The left lateral position relieves vena cava compression, improves venous return and maternal cardiac output, and maximizes uteroplacental perfusion and fetal oxygenation. It also helps decrease uterine irritability.', atiPearl: 'Left lateral is the default OB position for improving fetal oxygenation.', difficulty: 'Easy' },

      { id: 'ob-preterm-labor-q11', text: 'Which criteria must be met to diagnose true preterm labor?', type: 'multiple-choice',
        options: ['Any contractions before 37 weeks', 'Regular uterine contractions before 37 weeks that produce cervical dilation and/or effacement', 'Contractions plus rupture of membranes at any gestation', 'Pelvic pressure and back pain at any gestation'],
        correct: [1], rationale: 'Preterm labor requires gestation less than 37 weeks, regular contractions, AND documented cervical change (dilation and/or effacement). Contractions alone without cervical change are typically Braxton Hicks. This patient at 32 weeks 5 days with 2 cm dilation and 70 percent effacement meets all criteria.', atiPearl: 'No cervical change means no true preterm labor.', difficulty: 'Medium' },

      { id: 'ob-preterm-labor-q12', text: 'How should the nurse explain the cervical exam finding of "station -2" to the patient?', type: 'multiple-choice',
        options: ['"The baby\'s head is 2 cm below the narrowest part of your pelvis."', '"The baby\'s presenting part is still 2 cm above the ischial spines, so he has not dropped into the pelvis."', '"Your cervix is 2 cm thick."', '"You are 2 cm from being fully dilated."'],
        correct: [1], rationale: 'Station describes the relationship of the presenting part to the maternal ischial spines. Station 0 is engaged at the spines, negative numbers are above the spines, and positive numbers are below. Station -2 means the presenting part is 2 cm above the spines.', atiPearl: 'Negative station equals higher up. Zero equals engaged.', difficulty: 'Medium' },

      { id: 'ob-preterm-labor-q13', text: 'Why does IV hydration help decrease uterine contractions in preterm labor?', type: 'multiple-choice',
        options: ['Fluid dilutes circulating oxytocin so it becomes ineffective', 'Dehydration triggers release of antidiuretic hormone, which is structurally similar to oxytocin and can stimulate uterine activity', 'Fluids increase maternal blood pressure enough to stop contractions', 'IV fluids flush prostaglandins out of the uterus'],
        correct: [1], rationale: 'Dehydration stimulates ADH (vasopressin) release from the posterior pituitary. Because ADH is structurally similar to oxytocin, it can cross-react and stimulate uterine contractions. Correcting hydration reduces uterine irritability. Avoid excessive fluid, however, because pulmonary edema is a risk with tocolytics and steroids.', atiPearl: 'Hydrate, but do not overload - pulmonary edema is the tocolysis complication to watch for.', difficulty: 'Hard' },

      { id: 'ob-preterm-labor-q14', text: 'This patient\'s GBS status is unknown at 32 weeks 5 days. If delivery becomes imminent, what should the nurse anticipate?', type: 'multiple-choice',
        options: ['No antibiotic prophylaxis, because she has not tested positive', 'Empiric intrapartum antibiotic prophylaxis with IV penicillin G because of preterm birth with unknown GBS status', 'Oral amoxicillin at discharge', 'A GBS culture with results before treatment is started'],
        correct: [1], rationale: 'Any preterm birth with unknown GBS status receives empiric intrapartum antibiotic prophylaxis, typically IV penicillin G, to prevent early-onset neonatal GBS sepsis. Waiting for culture results is not feasible, and oral antibiotics do not achieve adequate fetal levels.', atiPearl: 'Preterm plus unknown GBS equals treat.', difficulty: 'Hard' }
    ],

    keyPoints: [
      'Preterm labor equals regular contractions PLUS cervical change before 37 weeks',
      'This patient meets criteria: 32 weeks 5 days, contractions every 5 minutes, cervix 2 cm dilated and 70 percent effaced',
      'Betamethasone 12 mg IM, two doses 24 hours apart, accelerates fetal LUNG maturity',
      'Betamethasone is indicated 24-34 weeks and reduces RDS, IVH, NEC, and neonatal death',
      'Nifedipine is a calcium channel blocker tocolytic - ALWAYS check the maternal BP before giving it',
      'Terbutaline is a beta-2 agonist - hold for maternal HR above 120; FDA black box warning against prolonged use',
      'Magnesium sulfate before 32 weeks is for FETAL NEUROPROTECTION, not primarily tocolysis',
      'Hydration and left lateral positioning decrease uterine irritability',
      'Fetal fibronectin between 22 and 35 weeks: negative is very reassuring; positive means increased risk of delivery in 7-14 days',
      'Category I tracing: baseline 110-160, moderate variability, no late or variable decelerations'
    ],

    pearls: [
      'The point of tocolysis is not to stop labor forever - it is to buy 48 hours for steroids',
      'Never delay an indicated delivery to complete a betamethasone course',
      'A transient decrease in fetal movement and variability for 24-48 hours after betamethasone is EXPECTED',
      'Betamethasone raises maternal blood glucose - watch a diabetic patient closely',
      'Pulmonary edema is the feared complication of tocolytics combined with corticosteroids and IV fluids - assess lung sounds',
      'Nifedipine plus magnesium sulfate can cause profound hypotension and neuromuscular blockade',
      'Always rule out a urinary tract infection - it is a common and treatable trigger for preterm contractions'
    ],

    successChecklist: [
      'Perform hand hygiene and verify patient identity',
      'Assess maternal vital signs and pain',
      'Assess contraction frequency, duration, intensity, and resting tone',
      'Review the cervical examination (2 cm dilated, 70 percent effaced, station -2, membranes intact)',
      'Apply or continue continuous fetal monitoring and recognize the reassuring Category I tracing',
      'Place the patient in the left lateral position',
      'Maintain IV hydration with Lactated Ringers',
      'Check the blood pressure, then administer nifedipine and monitor for hypotension',
      'Administer betamethasone 12 mg IM to promote fetal lung maturity',
      'Educate the patient about warning signs, communicate using SBAR, and document all assessments and interventions'
    ],

    criticalErrors: [
      'Administering nifedipine without first checking the maternal blood pressure',
      'Continuing terbutaline when the maternal heart rate exceeds 120 bpm or the patient reports chest pain',
      'Using terbutaline for prolonged tocolysis beyond 48-72 hours (FDA black box warning)',
      'Ambulating a patient who has just received nifedipine and is dizzy and hypotensive',
      'Failing to administer betamethasone during the tocolysis window',
      'Placing the patient supine, causing vena cava compression and fetal compromise',
      'Administering excessive IV fluid boluses with tocolytics and steroids, causing pulmonary edema',
      'Failing to recognize new vaginal bleeding or leaking fluid as a change in status',
      'Discharging the patient without teaching the warning signs that require immediate return',
      'Withholding empiric GBS prophylaxis in a preterm delivery with unknown GBS status'
    ],

    comparisons: [
      {
        title: 'Tocolytic Medications',
        headers: ['Medication', 'Class and Key Nursing Concern'],
        rows: [
          ['Nifedipine (Procardia)', 'Calcium channel blocker - check BP before every dose, watch for hypotension and dizziness'],
          ['Terbutaline (Brethine)', 'Beta-2 agonist - hold for HR above 120; hyperglycemia, pulmonary edema, black box warning'],
          ['Magnesium sulfate', 'CNS depressant - neuroprotection before 32 weeks; monitor RR, DTRs, urine output'],
          ['Indomethacin', 'NSAID - avoid after 32 weeks due to premature ductus arteriosus closure and oligohydramnios']
        ]
      },
      {
        title: 'Betamethasone vs Tocolytics',
        headers: ['Betamethasone', 'Tocolytics'],
        rows: [
          ['Helps the BABY', 'Helps buy TIME'],
          ['Accelerates fetal lung maturity', 'Suppresses uterine contractions'],
          ['12 mg IM x 2 doses, 24 hours apart', 'Nifedipine PO, terbutaline SubQ, magnesium IV'],
          ['Benefit at 24 hours, maximal at 48 hours', 'Typically used no longer than 48 hours'],
          ['Raises maternal glucose', 'Hypotension (nifedipine) or tachycardia (terbutaline)']
        ]
      },
      {
        title: 'True Preterm Labor vs Braxton Hicks',
        headers: ['True Preterm Labor', 'Braxton Hicks'],
        rows: [
          ['Regular and increasing in frequency', 'Irregular and unpredictable'],
          ['Produces cervical dilation and effacement', 'No cervical change'],
          ['Often felt in the low back radiating forward', 'Usually felt in the front of the abdomen'],
          ['Not relieved by hydration or rest', 'Often relieved by hydration, rest, or position change'],
          ['May include pelvic pressure and increased discharge', 'No pelvic pressure or discharge change']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'I keep getting this tightening every five minutes or so, and there is so much pressure down low. It feels like he is going to fall out.' },
      { speaker: 'patient', trigger: 'pain', line: 'My back has been aching all day. It comes in waves and wraps around to the front.' },
      { speaker: 'patient', trigger: 'assessment', line: 'There has been more discharge than usual, but it is clear, not bloody. I am not bleeding at all.' },
      { speaker: 'patient', trigger: 'fear', line: 'I am only 32 weeks. It is too early. With my first I went all the way to 39. Why is this happening?' },
      { speaker: 'patient', trigger: 'medication', line: 'This medicine is making my face feel hot and my head is pounding. Is that supposed to happen?' },
      { speaker: 'patient', trigger: 'education', line: 'The shot is for his lungs? So if he does come, he will be able to breathe on his own?' },
      { speaker: 'patient', trigger: 'ambulation', line: 'Can I just get up and use the bathroom? I feel a little dizzy but I really need to go.' },
      { speaker: 'family', trigger: 'greeting', line: 'We have a two-year-old at home and nobody to watch her. How long is she going to be here?' },
      { speaker: 'family', trigger: 'reassurance', line: 'If the baby comes now, what happens? Does he go to the NICU? For how long?' }
    ],

    patientEducation: [
      'Report immediately if contractions become more frequent, longer, or stronger',
      'Report any vaginal bleeding right away',
      'Report leakage of fluid - a gush or a continuous trickle may mean your water has broken',
      'Report decreased fetal movement, fever, or severe abdominal pain',
      'Drink plenty of fluids - dehydration can trigger contractions',
      'Avoid smoking and secondhand smoke',
      'Avoid strenuous activity, heavy lifting, and prolonged standing',
      'Empty your bladder frequently - a full bladder and urinary infections can trigger contractions',
      'Betamethasone is given as two shots 24 hours apart to help your baby\'s lungs mature',
      'Attend every follow-up appointment and follow your provider\'s activity restrictions'
    ]
  },

  // ============================================================
  // OB SIM 6 - PROM with Developing Chorioamnionitis
  // ============================================================
  {
    id: 'ob-prom-chorioamnionitis',
    title: 'PROM with Chorioamnionitis',
    fullTitle: 'Prolonged Premature Rupture of Membranes with Developing Chorioamnionitis at 38 Weeks',
    category: 'OB',
    course: 'NUR2212C',
    difficulty: 'Hard',
    durationMin: 20,
    icon: 'INFECTION',
    summary: 'A 28-year-old G1P0 at 38 weeks presents 20 hours after rupture of membranes with fever 100.9 F, maternal tachycardia 112, uterine tenderness, chills, WBC 16.8, and lactic acid 2.2. You must recognize chorioamnionitis, give antibiotics promptly, and prepare for induction of labor.',
    highYield: true,

    objectives: [
      'Perform a focused maternal assessment',
      'Assess amniotic fluid leakage',
      'Monitor maternal vital signs and trend them',
      'Interpret the fetal heart rate tracing',
      'Recognize the signs of intra-amniotic infection',
      'Administer antibiotics safely',
      'Prepare for induction of labor',
      'Educate the patient',
      'Communicate using SBAR',
      'Document care'
    ],

    patient: {
      name: 'Jane Smith',
      age: '28 years',
      dob: null,
      sex: 'Female',
      weightKg: null,
      allergies: ['NKDA'],
      codeStatus: 'Full Code',
      diagnosis: 'Term PROM with developing chorioamnionitis (intra-amniotic infection)',
      history: [
        'Membranes ruptured approximately 20 hours ago with continuous leakage of clear fluid',
        'Delayed coming to the hospital because labor had not started',
        'Blood type A positive',
        'GBS negative',
        'Chief complaints: chills, lower abdominal (uterine) tenderness, and feeling tired',
        'Contractions every 8-10 minutes; cervix 2 cm dilated and 60 percent effaced'
      ],
      gravidaPara: 'G1P0',
      gestationalAge: '38 weeks'
    },

    vitalsTimeline: [
      {
        atMin: 0,
        label: 'Baseline on admission',
        bp: '118/72',
        hr: 112,
        rr: 22,
        temp: '100.9 F (38.3 C)',
        spo2: 98,
        pain: 'Uterine tenderness; mild contraction discomfort 4/10',
        loc: 'Alert and oriented x4, mildly anxious',
        other: 'Chills, warm skin, uterine tenderness on palpation; continuous leakage of clear fluid; fetal heart rate 160s (tachycardic)',
        flags: ['fever', 'maternal-tachycardia', 'fetal-tachycardia', 'uterine-tenderness', 'chills'],
        note: 'Temperature 100.9 F meets the definition of maternal fever. Fever plus maternal tachycardia plus fetal tachycardia plus uterine tenderness equals chorioamnionitis.'
      },
      {
        // atMin rescaled to fit durationMin 20 (the last stage used to sit past the time limit and never fired). Relative pacing preserved.
        atMin: 6,
        label: 'Worsening infection before antibiotics take effect',
        bp: '110/64',
        hr: 122,
        rr: 24,
        temp: '101.8 F (38.8 C)',
        spo2: 97,
        pain: 'Increased uterine tenderness 6/10',
        loc: 'Alert but fatigued and increasingly uncomfortable',
        other: 'Rigors, flushed skin, foul-smelling amniotic fluid noted; fetal baseline now 178 with minimal variability',
        flags: ['worsening-fever', 'tachycardia', 'foul-fluid', 'fetal-tachycardia'],
        note: 'Foul-smelling fluid and a rising fetal baseline confirm progression. Blood cultures and antibiotics must not be delayed further.'
      },
      {
        atMin: 12,
        label: 'Early sepsis if antibiotics and delivery are delayed',
        bp: '92/50',
        hr: 132,
        rr: 28,
        temp: '102.4 F (39.1 C)',
        spo2: 94,
        pain: 'Marked uterine tenderness',
        loc: 'Confused, difficult to follow commands, lethargic',
        other: 'Warm flushed skin with bounding pulses (warm shock), urine output 20 mL/hr, repeat lactic acid 3.8',
        flags: ['sepsis', 'hypotension', 'altered-loc', 'oliguria', 'rising-lactate'],
        note: 'MATERNAL SEPSIS. Fever plus hypotension plus confusion. Notify the provider immediately, initiate the sepsis bundle, and expedite delivery.'
      },
      {
        atMin: 18,
        label: 'After antibiotics, acetaminophen, and fluids',
        bp: '112/68',
        hr: 98,
        rr: 20,
        temp: '99.6 F (37.6 C)',
        spo2: 98,
        pain: 'Contraction discomfort 5/10 with induction underway',
        loc: 'Alert and oriented x4, more comfortable',
        other: 'Ampicillin and gentamicin infusing after blood cultures were drawn; fetal baseline down to 158 with moderate variability; oxytocin induction started',
        flags: [],
        note: 'Target outcome. Reducing maternal fever also lowers the fetal heart rate. Delivery remains the definitive treatment.'
      }
    ],

    labs: [
      { panel: 'CBC', name: 'WBC', value: '16.8', unit: 'K/microL', status: 'high', normalRange: '5.0-15.0 in pregnancy (4.5-11.0 nonpregnant)', interpretation: 'Elevated. Pregnancy alone can mildly raise the WBC, but 16.8 combined with fever and uterine tenderness supports intra-amniotic infection.' },
      { panel: 'CBC', name: 'Hemoglobin', value: '11.2', unit: 'g/dL', status: 'low', normalRange: '11-14 in pregnancy', interpretation: 'Slightly low - consistent with the physiologic dilutional anemia of pregnancy.' },
      { panel: 'CBC', name: 'Hematocrit', value: '35', unit: '%', status: 'low', normalRange: '33-44 in pregnancy', interpretation: 'Slightly low, consistent with hemodilution of pregnancy.' },
      { panel: 'CBC', name: 'Platelets', value: '245,000', unit: '/microL', status: 'normal', normalRange: '150,000-400,000', interpretation: 'Normal. A falling platelet count would raise concern for sepsis-associated DIC.' },
      { panel: 'Chemistry', name: 'Glucose', value: '142', unit: 'mg/dL', status: 'high', normalRange: '70-110 fasting', interpretation: 'Elevated. Stress and infection release cortisol and catecholamines, which raise blood glucose.' },
      { panel: 'Chemistry', name: 'Lactic acid', value: '2.2', unit: 'mmol/L', status: 'high', normalRange: 'Less than 2.0', interpretation: 'Elevated - suggests early tissue hypoperfusion and possible evolving sepsis. Trend it; a rising lactate is an ominous sign.' },
      { panel: 'Microbiology', name: 'Blood cultures x2', value: 'Pending', unit: '', status: 'normal', normalRange: '', interpretation: 'Draw from two separate sites BEFORE starting antibiotics if it does not delay treatment. Never delay antibiotics waiting for cultures in a septic patient.' },
      { panel: 'Screening', name: 'Group B Streptococcus', value: 'Negative', unit: '', status: 'normal', normalRange: 'Negative', interpretation: 'GBS negative, so GBS prophylaxis is not the indication here. The broad-spectrum ampicillin and gentamicin are treating the established intra-amniotic infection.' }
    ],

    diagnostics: [
      { name: 'Fetal heart rate tracing', finding: 'Fetal tachycardia with a baseline at or above 160 bpm', interpretation: 'Fetal tachycardia is often the EARLIEST sign of maternal infection. Common causes include maternal fever, infection, chorioamnionitis, dehydration, and fetal hypoxia. Treating the maternal fever frequently lowers the fetal baseline.' },
      { name: 'Nitrazine paper test', finding: 'Paper turns BLUE', interpretation: 'Amniotic fluid is alkaline (pH 7.1-7.3) and turns nitrazine paper blue. Blood, semen, and bacterial vaginosis can cause false positives.' },
      { name: 'Ferning test', finding: 'Microscopic fern-like crystallization pattern on a dried slide', interpretation: 'Confirms the presence of amniotic fluid because of its high estrogen and sodium chloride content.' },
      { name: 'Sterile speculum exam with pooling', finding: 'Visible pooling of amniotic fluid in the posterior vaginal vault', interpretation: 'Confirms rupture of membranes. A STERILE SPECULUM exam is preferred over a digital exam because it does not introduce bacteria.' },
      { name: 'Cervical examination', finding: '2 cm dilated, 60 percent effaced, contractions every 8-10 minutes', interpretation: 'Labor has begun but is progressing slowly. Because infection is present, the goal is DELIVERY, not delaying labor.' }
    ],

    orders: [
      { text: 'Continuous fetal monitoring', category: 'monitoring' },
      { text: 'Lactated Ringers IV', category: 'medication' },
      { text: 'Vital signs every 30 minutes', category: 'monitoring' },
      { text: 'Limited vaginal examinations - perform only when absolutely necessary', category: 'procedure' },
      { text: 'Ampicillin IV', category: 'medication' },
      { text: 'Gentamicin IV', category: 'medication' },
      { text: 'Acetaminophen PRN for fever', category: 'medication' },
      { text: 'Blood cultures x2', category: 'lab' },
      { text: 'Prepare for induction of labor', category: 'procedure' },
      { text: 'Notify the neonatal team for anticipated delivery of an infant exposed to chorioamnionitis', category: 'consult' }
    ],

    interventions: [
      { id: 'chorio-1', order: 1, action: 'Assess maternal and fetal status', rationale: 'Establish the baseline for both patients. Maternal vital signs, level of consciousness, uterine tenderness, fluid characteristics, and the fetal tracing all guide management.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'chorio-2', order: 2, action: 'Monitor and TREND maternal temperature, heart rate, blood pressure, and respiratory rate every 30 minutes', rationale: 'A single set of vitals is not enough. Rising temperature and heart rate with a falling blood pressure signal progression to sepsis.', category: 'assessment', critical: true, preventsDeterioration: false, atiPearl: 'Trend the vitals - infection is diagnosed by the direction they are moving.' },
      { id: 'chorio-3', order: 3, action: 'Maintain continuous fetal monitoring, watching for fetal tachycardia, minimal variability, and decelerations', rationale: 'Fetal tachycardia is often the earliest sign of maternal infection and may precede the maternal fever.', category: 'assessment', critical: true, preventsDeterioration: false },
      { id: 'chorio-4', order: 5, action: 'Administer IV antibiotics promptly - ampicillin plus gentamicin', rationale: 'Ampicillin covers gram-positive organisms including group B Streptococcus, enterococci, and Listeria, and gentamicin adds gram-negative coverage. Together they are the standard first-line regimen for chorioamnionitis. Every hour of delay increases maternal and neonatal risk.', category: 'medication', critical: true, preventsDeterioration: true },
      { id: 'chorio-5', order: 4, action: 'Obtain blood cultures BEFORE starting antibiotics if it does not delay treatment', rationale: 'Cultures drawn after antibiotics are frequently falsely negative. Draw from two separate sites, but never let culture collection delay antibiotic administration in a septic patient.', category: 'intervention', critical: true, preventsDeterioration: false, atiPearl: 'Cultures before antibiotics - but antibiotics within one hour regardless.' },
      { id: 'chorio-6', order: 6, action: 'Maintain IV fluids with Lactated Ringers', rationale: 'Hydration supports maternal circulation, uteroplacental perfusion, and renal output, and helps correct the fever-related insensible losses.', category: 'intervention', critical: true, preventsDeterioration: true },
      { id: 'chorio-7', order: 7, action: 'Administer acetaminophen as ordered for fever', rationale: 'Lowering the maternal temperature improves maternal comfort and frequently lowers the fetal heart rate, since fetal tachycardia is largely driven by maternal fever.', category: 'medication', critical: true, preventsDeterioration: true },
      { id: 'chorio-8', order: 8, action: 'Prepare for induction of labor', rationale: 'Once chorioamnionitis develops at term, DELIVERY is the definitive treatment. Tocolysis is contraindicated - the goal is to deliver, not to delay.', category: 'intervention', critical: true, preventsDeterioration: true, atiPearl: 'Infection at term equals deliver. Never try to stop this labor.' },
      { id: 'chorio-9', order: 9, action: 'Limit vaginal examinations, use sterile technique, and communicate using SBAR', rationale: 'Every digital exam pushes vaginal bacteria toward the uterus. Cluster assessments and document the number of exams performed.', category: 'communication', critical: true, preventsDeterioration: true }
    ],

    medications: [
      {
        name: 'Ampicillin',
        brand: 'Principen',
        classification: 'Aminopenicillin (beta-lactam) antibiotic',
        dose: '2 g IV every 6 hours (typical regimen for chorioamnionitis); administer per provider order',
        action: 'Bactericidal - inhibits bacterial cell wall synthesis; covers gram-positive organisms including group B Streptococcus, enterococci, and Listeria',
        onset: 'Peak levels within 15-30 minutes IV',
        sideEffects: ['Allergic reaction including anaphylaxis', 'Rash', 'Diarrhea', 'Nausea', 'Candidiasis', 'C. difficile colitis'],
        nursingConsiderations: [
          'VERIFY PENICILLIN ALLERGY before administration - cross-reactivity with cephalosporins is possible',
          'Draw blood cultures before the first dose when it will not delay therapy',
          'Assess for rash, wheezing, throat tightness, or hypotension during and after infusion',
          'Do not mix in the same line as gentamicin - beta-lactams inactivate aminoglycosides; flush between drugs',
          'Continue postpartum per provider order until the patient is afebrile',
          'If the patient requires a cesarean, anticipate the addition of clindamycin or metronidazole for anaerobic coverage - ampicillin and gentamicin alone do not cover Bacteroides.'
        ],
        atiTip: 'Ampicillin plus gentamicin is the classic chorioamnionitis regimen. Always ask about penicillin allergy.',
        highAlert: false
      },
      {
        name: 'Gentamicin',
        brand: 'Garamycin',
        classification: 'Aminoglycoside antibiotic',
        dose: '1.5 mg/kg IV every 8 hours, or 5 mg/kg IV every 24 hours (extended-interval dosing); per provider order and weight',
        action: 'Bactericidal - binds the 30S ribosomal subunit; provides gram-NEGATIVE coverage including E. coli',
        onset: 'Peak levels 30-60 minutes after the end of the infusion',
        sideEffects: ['NEPHROTOXICITY', 'OTOTOXICITY (hearing loss, tinnitus, vertigo)', 'Neuromuscular blockade', 'Rash'],
        nursingConsiderations: [
          'THE TWO TOXICITIES: nephrotoxicity and ototoxicity',
          'Monitor BUN, creatinine, and urine output - hold and notify the provider for rising creatinine or oliguria',
          'Report tinnitus, hearing changes, vertigo, or ataxia immediately - ototoxicity can be permanent',
          'Monitor peak and trough levels; draw the trough 30 minutes BEFORE the next dose and the peak 30 minutes AFTER the infusion ends',
          'Do NOT infuse in the same line as ampicillin - separate and flush between',
          'Additive nephrotoxicity with NSAIDs, vancomycin, and contrast media',
          'Neuromuscular blockade risk is increased if the patient is also receiving magnesium sulfate'
        ],
        atiTip: 'Aminoglycosides equal ears and kidneys. Trough before, peak after.',
        highAlert: true
      },
      {
        name: 'Acetaminophen',
        brand: 'Tylenol',
        classification: 'Antipyretic / non-opioid analgesic',
        dose: '650 mg PO or rectally every 4-6 hours PRN fever; maximum 3-4 g in 24 hours',
        action: 'Acts on the hypothalamic heat-regulating center to reduce fever',
        onset: '30-60 minutes PO',
        sideEffects: ['Hepatotoxicity with overdose', 'Rare rash'],
        nursingConsiderations: [
          'Safe in pregnancy and lactation and the antipyretic of choice',
          'Reducing the maternal fever frequently lowers the fetal heart rate',
          'Track the 24-hour total from ALL sources including combination products',
          'Recheck the temperature 60 minutes after administration',
          'Reducing the fever does NOT treat the infection - antibiotics and delivery do'
        ],
        atiTip: 'Treat the maternal fever and the fetal tachycardia often follows it down.',
        highAlert: false
      },
      {
        name: 'Oxytocin',
        brand: 'Pitocin',
        classification: 'Uterotonic - labor induction and augmentation',
        dose: 'IV infusion starting at 1-2 milliunits/min, titrated per protocol to an adequate contraction pattern',
        action: 'Stimulates uterine smooth muscle contraction to induce and augment labor',
        onset: 'Immediate IV; steady state in 30-40 minutes',
        sideEffects: ['Uterine tachysystole', 'Fetal heart rate decelerations', 'Water intoxication and hyponatremia with prolonged high-dose infusion', 'Hypotension with rapid bolus'],
        nursingConsiderations: [
          'Always administer as a secondary infusion on a pump, piggybacked into a primary line',
          'Continuous fetal monitoring is mandatory during induction',
          'STOP the infusion for tachysystole (more than 5 contractions in 10 minutes) or recurrent late decelerations, then reposition left, give oxygen, and increase the primary fluid',
          'Delivery is the definitive treatment for chorioamnionitis, so induction is appropriate here',
          'Continue oxytocin postpartum to reduce the risk of postpartum hemorrhage, which is increased after chorioamnionitis because an infected uterus contracts poorly'
        ],
        atiTip: 'Tachysystole equals stop the Pitocin FIRST, then reposition, oxygen, and fluids.',
        highAlert: true
      },
      {
        name: 'Lactated Ringers',
        brand: 'LR',
        classification: 'Isotonic crystalloid',
        dose: 'IV infusion per order; bolus for hypotension or elevated lactate per sepsis protocol',
        action: 'Restores intravascular volume, supports blood pressure, and improves tissue perfusion',
        onset: 'Immediate',
        sideEffects: ['Fluid overload', 'Pulmonary edema'],
        nursingConsiderations: [
          'Fever increases insensible losses - hydration needs are higher',
          'Sepsis protocols typically call for a 30 mL/kg crystalloid bolus for hypotension or lactate of 4 or higher',
          'Monitor lung sounds, urine output (goal at least 30 mL/hr), and mental status',
          'Do NOT run in the same line as blood products'
        ],
        atiTip: 'Fluids plus antibiotics plus source control (delivery) equals sepsis management.',
        highAlert: false
      }
    ],

    sbar: {
      situation: 'This is the RN caring for Jane Smith, a 28-year-old G1P0 at 38 weeks with premature rupture of membranes for approximately 20 hours.',
      background: 'She reports continuous leakage of clear fluid, chills, uterine tenderness, and increasing fatigue. She delayed coming in because labor had not started. Her temperature is 100.9 F and her maternal heart rate is 112. She is GBS negative and blood type A positive. Cervix is 2 cm dilated and 60 percent effaced with contractions every 8-10 minutes.',
      assessment: 'Laboratory results show a WBC of 16.8, glucose 142, and lactic acid 2.2. The fetus demonstrates tachycardia, and the patient has clinical signs consistent with developing chorioamnionitis.',
      recommendation: 'Blood cultures have been obtained, IV fluids are running, and ampicillin and gentamicin are being initiated. I recommend continued evaluation and preparation for induction of labor, and I have alerted the neonatal team.'
    },

    questions: [
      { id: 'ob-prom-chorioamnionitis-q1', text: 'A patient at 38 weeks reports her membranes ruptured 20 hours ago and labor has not started. What is the nurse\'s priority concern?', type: 'multiple-choice',
        options: ['Umbilical cord prolapse', 'Ascending intrauterine infection (chorioamnionitis)', 'Postpartum hemorrhage', 'Precipitous delivery'],
        correct: [1], rationale: 'The amniotic sac normally protects the fetus from ascending bacteria. Once membranes rupture, infection risk rises sharply, and after 18-24 hours it becomes substantial. At 20 hours this patient is at high risk for chorioamnionitis, and she already has fever, tachycardia, and uterine tenderness.', atiPearl: 'Rupture beyond 18-24 hours equals think infection.', difficulty: 'Easy' },

      { id: 'ob-prom-chorioamnionitis-q2', text: 'Which findings support a diagnosis of chorioamnionitis? Select all that apply.', type: 'select-all',
        options: ['Maternal temperature 100.9 F', 'Maternal heart rate 112', 'Fetal heart rate baseline 168', 'Uterine tenderness on palpation', 'WBC 16.8 K/microL'],
        correct: [0, 1, 2, 3, 4], rationale: 'All five are classic signs of chorioamnionitis: maternal fever, maternal tachycardia, fetal tachycardia, uterine tenderness, and leukocytosis. Foul-smelling or purulent amniotic fluid is another. Maternal fever plus any of the others supports the diagnosis.', atiPearl: 'Fever, mom tachy, baby tachy, tender uterus, high WBC.', difficulty: 'Medium' },

      { id: 'ob-prom-chorioamnionitis-q3', text: 'Why are vaginal examinations limited for a patient with ruptured membranes?', type: 'multiple-choice',
        options: ['They cause the patient too much pain', 'Each examination can introduce vaginal bacteria into the uterus and increase the risk of ascending infection', 'They can rupture the membranes further', 'They interfere with the accuracy of fetal monitoring'],
        correct: [1], rationale: 'Every digital vaginal examination carries bacteria from the vagina toward the cervix and uterus. With ruptured membranes there is no protective barrier, so the number of exams directly correlates with the risk of chorioamnionitis. Perform them only when absolutely necessary and use a sterile speculum when possible.', atiPearl: 'Ruptured membranes equal keep your fingers out.', difficulty: 'Easy' },

      { id: 'ob-prom-chorioamnionitis-q4', text: 'Why are ampicillin and gentamicin prescribed together for this patient?', type: 'multiple-choice',
        options: ['To prevent group B streptococcal disease in the newborn only', 'To provide broad coverage of the polymicrobial organisms causing intra-amniotic infection - ampicillin for gram-positive organisms including group B Streptococcus, enterococci, and Listeria, gentamicin for gram-negative organisms', 'Because the patient is allergic to penicillin', 'To treat a urinary tract infection'],
        correct: [1], rationale: 'Chorioamnionitis is polymicrobial. Ampicillin covers gram-positive organisms including group B Streptococcus, enterococci, and Listeria, while gentamicin adds gram-negative coverage such as E. coli. Together they are the standard first-line regimen. This patient is GBS NEGATIVE, so this is treatment of an established infection, not GBS prophylaxis.', atiPearl: 'Amp plus gent equals chorioamnionitis.', difficulty: 'Medium' },

      { id: 'ob-prom-chorioamnionitis-q5', text: 'Once chorioamnionitis develops in a patient at term, what is the definitive treatment?', type: 'multiple-choice',
        options: ['Tocolysis to delay labor until antibiotics have cleared the infection', 'Delivery of the baby, along with IV antibiotics', 'Bedrest and increased oral fluids', 'Amnioinfusion to dilute the infected fluid'],
        correct: [1], rationale: 'The infected uterine contents are the source. At term, delivery combined with IV antibiotics is the definitive treatment. Tocolysis is CONTRAINDICATED because delaying delivery prolongs both maternal and fetal exposure to the infection.', atiPearl: 'Infection at term equals deliver. Never delay this labor.', difficulty: 'Medium' },

      { id: 'ob-prom-chorioamnionitis-q6', text: 'The patient\'s temperature rises to 102.4 F, her blood pressure falls to 92/50, and she becomes confused. What is the priority concern?', type: 'multiple-choice',
        options: ['Dehydration from the fever', 'Maternal sepsis requiring immediate provider notification and aggressive management', 'Normal progression of labor', 'An adverse reaction to acetaminophen'],
        correct: [1], rationale: 'Fever plus hypotension plus altered mental status is sepsis. This requires immediate escalation, a sepsis bundle with fluid resuscitation and broad-spectrum antibiotics, repeat lactate and cultures, and expedited delivery for source control.', atiPearl: 'Fever plus hypotension plus confusion equals sepsis. Escalate now.', difficulty: 'Medium' },

      { id: 'ob-prom-chorioamnionitis-q7', text: 'The nurse tests the leaking fluid with nitrazine paper. Which result confirms amniotic fluid?', type: 'multiple-choice',
        options: ['The paper turns yellow', 'The paper turns blue', 'The paper turns green', 'The paper remains unchanged'],
        correct: [1], rationale: 'Amniotic fluid is alkaline with a pH of about 7.1-7.3 and turns nitrazine paper BLUE. Urine and normal vaginal secretions are acidic and leave the paper yellow. Blood, semen, and bacterial vaginosis can produce false positives.', atiPearl: 'Amniotic fluid equals alkaline equals blue.', difficulty: 'Easy' },

      { id: 'ob-prom-chorioamnionitis-q8', text: 'Which fetal assessment finding is often the EARLIEST indicator of developing maternal infection?', type: 'multiple-choice',
        options: ['Late decelerations', 'Fetal tachycardia', 'Absent variability', 'Fetal bradycardia'],
        correct: [1], rationale: 'Fetal tachycardia (baseline above 160 bpm) is frequently the earliest sign of maternal infection and can appear before the maternal fever. Maternal fever, infection, chorioamnionitis, dehydration, and fetal hypoxia all raise the baseline. Treating the maternal fever often lowers the fetal heart rate.', atiPearl: 'A newly tachycardic fetus - take the mother\'s temperature.', difficulty: 'Medium' },

      { id: 'ob-prom-chorioamnionitis-q9', text: 'The provider orders blood cultures x2 and IV antibiotics. What is the correct nursing sequence?', type: 'multiple-choice',
        options: ['Give the antibiotics first so treatment is not delayed, then draw cultures 30 minutes later', 'Draw the blood cultures from two separate sites first, then immediately administer the antibiotics - but do not let culture collection delay antibiotics beyond one hour', 'Wait for the culture results before giving any antibiotics', 'Draw one culture, give the antibiotics, then draw the second culture'],
        correct: [1], rationale: 'Cultures drawn after antibiotics are frequently falsely negative and can prevent identification of the organism. Draw two sets from separate sites first, then give antibiotics immediately. However, antibiotics must not be delayed beyond one hour in a septic patient, so if access is difficult, treat first.', atiPearl: 'Cultures before antibiotics - unless waiting would delay treatment.', difficulty: 'Hard' },

      { id: 'ob-prom-chorioamnionitis-q10', text: 'The patient\'s lactic acid is 2.2 mmol/L. What does this indicate?', type: 'multiple-choice',
        options: ['A normal value in pregnancy requiring no action', 'Elevated, suggesting early tissue hypoperfusion and possible evolving sepsis - it should be trended', 'Evidence of diabetic ketoacidosis', 'Laboratory error, since lactate is not measured in pregnancy'],
        correct: [1], rationale: 'A lactic acid above 2.0 mmol/L reflects anaerobic metabolism from inadequate tissue oxygen delivery. In the setting of fever, tachycardia, and leukocytosis it points to evolving sepsis. Serial lactate measurement is a key marker - a rising value is ominous and a clearing value indicates response to treatment.', atiPearl: 'Lactate is the sepsis perfusion marker. Trend it.', difficulty: 'Hard' },

      { id: 'ob-prom-chorioamnionitis-q11', text: 'A patient is receiving gentamicin. Which findings require the nurse to hold the drug and notify the provider? Select all that apply.', type: 'select-all',
        options: ['New-onset tinnitus and dizziness', 'Serum creatinine rising from 0.7 to 1.6 mg/dL', 'Urine output of 15 mL/hr', 'Mild nausea after the infusion', 'Elevated trough level'],
        correct: [0, 1, 2, 4], rationale: 'Gentamicin is nephrotoxic and ototoxic. Tinnitus and dizziness suggest ototoxicity, which can be permanent. A rising creatinine, oliguria, and an elevated trough all indicate accumulation and nephrotoxicity. Mild nausea is a common, non-dangerous side effect.', atiPearl: 'Aminoglycosides: watch the ears and the kidneys.', difficulty: 'Hard' },

      { id: 'ob-prom-chorioamnionitis-q12', text: 'A new nurse suggests giving terbutaline to slow this patient\'s contractions so the antibiotics have more time to work. What is the experienced nurse\'s best response?', type: 'multiple-choice',
        options: ['"That is a good idea - antibiotics need at least 12 hours to be effective."', '"Tocolysis is contraindicated here. With chorioamnionitis at term, delivery is the treatment - delaying labor prolongs the infection exposure for both mother and baby."', '"Terbutaline is safe, but we should use nifedipine instead."', '"We should give magnesium sulfate for neuroprotection first."'],
        correct: [1], rationale: 'Once chorioamnionitis develops at term, the goal is DELIVERY, not delay. Tocolysis prolongs maternal and fetal exposure to infection and increases the risk of maternal sepsis and neonatal infection. Terbutaline would also worsen the existing maternal tachycardia.', atiPearl: 'Never tocolyze an infected uterus at term.', difficulty: 'Hard' },

      { id: 'ob-prom-chorioamnionitis-q13', text: 'After delivery, this patient is at increased risk for which complication?', type: 'multiple-choice',
        options: ['Postpartum hemorrhage from uterine atony, because an infected uterus contracts poorly', 'Deep vein thrombosis only', 'Neonatal jaundice in the mother', 'Gestational diabetes'],
        correct: [0], rationale: 'Chorioamnionitis inflames the myometrium and impairs its ability to contract after delivery, significantly raising the risk of uterine atony and postpartum hemorrhage. Postpartum endometritis and neonatal sepsis are also increased. Anticipate continued oxytocin and close fundal assessment.', atiPearl: 'Infected uterus equals boggy uterus equals hemorrhage risk.', difficulty: 'Hard' },

      { id: 'ob-prom-chorioamnionitis-q14', text: 'How does the nurse classify this patient\'s rupture of membranes?', type: 'multiple-choice',
        options: ['PPROM, because labor had not started', 'Term PROM, because rupture occurred before labor at 37 weeks or later', 'Spontaneous rupture of membranes in active labor', 'Artificial rupture of membranes'],
        correct: [1], rationale: 'PROM is rupture of membranes before the onset of labor. PPROM is rupture before labor AND before 37 weeks. This patient is 38 weeks, so she has term PROM, not PPROM. The distinction matters because PPROM management often includes latency antibiotics and steroids, while term PROM with infection means delivery.', atiPearl: 'The extra P in PPROM stands for PRETERM, which means before 37 weeks.', difficulty: 'Medium' }
    ],

    keyPoints: [
      'PROM is rupture of membranes before labor begins; PPROM is rupture before labor AND before 37 weeks',
      'This patient is 38 weeks with rupture 20 hours ago - term PROM with developing chorioamnionitis',
      'Infection risk rises significantly after 18-24 hours of ruptured membranes',
      'Classic chorioamnionitis signs: maternal fever, maternal tachycardia, fetal tachycardia, uterine tenderness, chills, elevated WBC, foul-smelling fluid',
      'Fetal tachycardia is often the EARLIEST sign of maternal infection',
      'Nitrazine paper turns BLUE because amniotic fluid is alkaline; ferning confirms amniotic fluid; pooling is seen on sterile speculum exam',
      'LIMIT vaginal examinations - each one increases the risk of ascending infection',
      'Ampicillin plus gentamicin is standard first-line therapy for chorioamnionitis',
      'Blood cultures before antibiotics when possible, but never delay antibiotics beyond one hour',
      'At term with infection, DELIVERY is the definitive treatment - tocolysis is contraindicated',
      'Watch for maternal sepsis: fever, hypotension, confusion, oliguria, rising lactate'
    ],

    pearls: [
      'A rising lactate is one of the best early markers of maternal sepsis - trend it',
      'Reducing the maternal fever with acetaminophen often lowers the fetal heart rate',
      'Chorioamnionitis increases the risk of postpartum hemorrhage because an infected uterus contracts poorly',
      'Alert the neonatal team early - the infant is at risk for neonatal sepsis and will need evaluation',
      'GBS negative does not mean infection-free - this patient still has a polymicrobial intra-amniotic infection',
      'Use a STERILE SPECULUM exam rather than a digital exam whenever possible after rupture'
    ],

    successChecklist: [
      'Perform hand hygiene and verify patient identity',
      'Assess maternal vital signs, especially temperature and heart rate',
      'Confirm the time of membrane rupture and assess the color, odor, and amount of the leaking fluid',
      'Assess for uterine tenderness, chills, and other signs of infection',
      'Apply or continue continuous fetal monitoring and assess for fetal tachycardia',
      'Limit vaginal examinations unless absolutely necessary',
      'Obtain blood cultures if not already collected and administer ampicillin and gentamicin promptly',
      'Continue IV Lactated Ringers and administer acetaminophen as ordered for fever',
      'Prepare the patient for induction of labor',
      'Communicate using SBAR, educate the patient and family, and document all assessments and interventions'
    ],

    criticalErrors: [
      'Performing frequent or unnecessary digital vaginal examinations after rupture of membranes',
      'Delaying antibiotic administration while waiting for blood culture results',
      'Administering a tocolytic to delay labor in a patient with chorioamnionitis at term',
      'Administering ampicillin and gentamicin through the same line without flushing (beta-lactams inactivate aminoglycosides)',
      'Giving ampicillin without verifying penicillin allergy status',
      'Failing to monitor renal function and hearing during gentamicin therapy',
      'Missing the trend of rising temperature and heart rate with a falling blood pressure',
      'Treating the fever with acetaminophen and considering the infection managed',
      'Failing to notify the neonatal team before delivery of an infant exposed to chorioamnionitis',
      'Failing to anticipate postpartum hemorrhage after delivery of an infected uterus'
    ],

    comparisons: [
      {
        title: 'PROM vs PPROM',
        headers: ['PROM', 'PPROM'],
        rows: [
          ['Rupture before labor at 37 weeks or later', 'Rupture before labor and before 37 weeks'],
          ['This patient at 38 weeks', 'Would need latency antibiotics and betamethasone'],
          ['Goal is delivery, especially if infected', 'Goal may be expectant management to gain fetal maturity'],
          ['Main risk is infection', 'Risks are infection AND prematurity']
        ]
      },
      {
        title: 'Confirming Rupture of Membranes',
        headers: ['Test', 'Positive Finding'],
        rows: [
          ['Nitrazine paper', 'Turns BLUE - amniotic fluid is alkaline'],
          ['Ferning test', 'Microscopic fern-like crystal pattern on a dried slide'],
          ['Pooling', 'Visible amniotic fluid in the posterior vaginal vault on sterile speculum exam'],
          ['False positives for nitrazine', 'Blood, semen, bacterial vaginosis, antiseptics']
        ]
      },
      {
        title: 'Normal Pregnancy Change vs Infection',
        headers: ['Finding', 'Interpretation'],
        rows: [
          ['WBC 12-15 K, afebrile, no tenderness', 'Normal physiologic leukocytosis of pregnancy'],
          ['WBC 16.8 K with fever and uterine tenderness', 'Supports intra-amniotic infection'],
          ['Maternal HR 85-95', 'Normal pregnancy increase'],
          ['Maternal HR 112 with fever', 'Infection until proven otherwise'],
          ['Fetal baseline 110-160', 'Normal'],
          ['Fetal baseline above 160 with maternal fever', 'Early sign of maternal infection']
        ]
      }
    ],

    dialogue: [
      { speaker: 'patient', trigger: 'greeting', line: 'My water broke yesterday evening around eight. Nothing was happening so I figured I would just wait it out at home. Was that wrong?' },
      { speaker: 'patient', trigger: 'symptoms', line: 'I keep getting these chills where I cannot stop shaking, and then a minute later I am burning up.' },
      { speaker: 'patient', trigger: 'pain', line: 'My whole belly is sore. Not like the contractions - it hurts even when I am not having one.' },
      { speaker: 'patient', trigger: 'assessment', line: 'The fluid is still coming. It was clear before but I think it smells different now.' },
      { speaker: 'patient', trigger: 'fatigue', line: 'I am so tired. I did not sleep at all last night. I just want this to be over.' },
      { speaker: 'patient', trigger: 'medication', line: 'Two different antibiotics? Are they safe for the baby? Is he sick too?' },
      { speaker: 'patient', trigger: 'education', line: 'They said they want to start something to speed up my labor. I wanted to do this naturally. Do I really have to be induced?' },
      { speaker: 'family', trigger: 'greeting', line: 'She has been shivering under three blankets for two hours. I told her we should have come in last night.' },
      { speaker: 'family', trigger: 'escalation', line: 'She just asked me what day it is. She is not acting like herself at all. Is that from the fever?' }
    ],

    patientEducation: [
      'Report fever, chills, or shaking immediately',
      'Report foul-smelling or discolored vaginal discharge or fluid',
      'Report increased abdominal or uterine pain',
      'Report decreased fetal movement, increased contractions, or vaginal bleeding',
      'Antibiotics are needed because bacteria can travel up into the uterus once the water has broken',
      'Vaginal examinations are kept to a minimum because each one can push bacteria toward the baby',
      'Labor induction is recommended because delivery is the definitive treatment once infection develops',
      'The baby will be evaluated by the newborn team after birth because of the exposure to infection',
      'In any future pregnancy, come to the hospital promptly when your water breaks even if labor has not started',
      'Expect closer monitoring of your bleeding after delivery, since an infected uterus does not contract as well'
    ]
  }

];
