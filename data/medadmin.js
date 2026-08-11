/* =============================================================================
 * medadmin.js — Medication Administration skill-signoff data layer
 * -----------------------------------------------------------------------------
 * Globals defined by this file:
 *   window.MEDADMIN_RUBRIC     — the official 40-point grading rubric
 *   window.MEDADMIN_SKILLS     — injection / administration reference
 *   window.MEDADMIN_MAR_CASES  — practice MAR cases with encoded traps
 *   window.MEDADMIN_DRUGS      — drug reference for the signoff study list
 *
 * Sources:
 *   _staging/Medication_Administration_Rubric.txt  (official rubric)
 *   _staging/Medication_Administration_(2).txt     (nursing lab skills guide)
 *
 * Scoring: each rubric item is scored 0, 1, or 2. 20 items x 2 = 40 points.
 *          Score (out of 40) x 2.5 = percent out of 100.
 *          Any CRITICAL ERROR = automatic FAIL regardless of total score.
 * ========================================================================== */

/* =============================================================================
 * 1. RUBRIC
 * ========================================================================== */
window.MEDADMIN_RUBRIC = {
  totalPoints: 40,
  scoreMultiplier: 2.5,
  maxAttempts: 2,
  remediationAttempts: 1,
  passRule: 'Student must demonstrate a PASS on ALL core competency items. Any critical error is an automatic FAIL regardless of other items.',
  instructions: 'This rubric assesses competency in safe medication administration. The student must demonstrate a PASS on ALL core competency items. Any CRITICAL ERROR results in an automatic FAIL, regardless of other items. A student who does not achieve PASS on all items must repeat the skill check (remediation attempts = 1, maximum number of attempts = 2).',
  outcomes: [
    { id: 'pass', label: 'PASS', description: 'Student demonstrates competency in safe medication administration. All competencies marked PASS. No critical errors.' },
    { id: 'fail', label: 'FAIL', description: 'One or more competencies marked FAIL or critical error(s) identified. Student must repeat skill check.' }
  ],
  instructorNoteFields: ['Strengths', 'Areas for Improvement', 'Specific Teaching Points'],

  criticalErrors: [
    {
      id: 'wrong-patient',
      text: 'Wrong patient',
      explanation: 'Giving any medication to the wrong person is a sentinel event. The drug may be contraindicated for that patient, may interact with their other medications, or may trigger an allergic reaction. It also means the intended patient did not receive a needed drug. Two patient identifiers (name and date of birth) prevent this every single time.'
    },
    {
      id: 'wrong-patient-medication',
      text: 'Wrong patient medication administered',
      explanation: 'Administering a medication that belongs on another patient MAR. This is the same failure as wrong patient viewed from the medication side: it typically happens when a nurse carries meds for two patients at once or prepares from the wrong drawer. Prepare and carry medications for ONE patient at a time.'
    },
    {
      id: 'wrong-drug',
      text: 'Wrong drug administered',
      explanation: 'Look-alike/sound-alike names (hydromorphone vs morphine, Celebrex vs Celexa, Humalog vs Humulin) cause this most often. The three checks against the MAR exist specifically to catch it. Always read the label, not the shape or color of the package.'
    },
    {
      id: 'wrong-dose',
      text: 'Wrong dose (calculation error)',
      explanation: 'A decimal point error is a tenfold error. High-alert drugs (insulin, heparin, opioids, potassium, digoxin) can kill at a tenfold dose. Show all work, use leading zeros (0.5 mg) and never trailing zeros (never 5.0 mg), and have a second nurse independently verify high-alert calculations.'
    },
    {
      id: 'wrong-route',
      text: 'Wrong route of administration',
      explanation: 'Route errors are frequently fatal. An IV dose of an oral drug, or an IV push of a drug that must be infused (potassium chloride), causes cardiac arrest. Some drugs are route-specific for a reason: NPH insulin is never IV, oral vancomycin does not treat a systemic infection.'
    },
    {
      id: 'allergy-not-checked',
      text: 'Allergy not checked/checked incorrectly',
      explanation: 'Anaphylaxis can occur within minutes and is fatal. Checking means all three: ask the patient, look at the allergy band, and verify the MAR/chart. Cross-reference BRAND and GENERIC names (Dilaudid IS hydromorphone) and drug classes (Zosyn IS a penicillin).'
    },
    {
      id: 'bedside-verification-skipped',
      text: 'Bedside verification skipped',
      explanation: 'The third check at the bedside with the patient present is the last barrier before the drug is irreversible. Skipping it removes the only check that verifies the right drug is reaching the right patient at the point of administration.'
    },
    {
      id: 'no-hand-hygiene',
      text: 'No hand hygiene before preparation',
      explanation: 'Hand hygiene before medication preparation prevents transmitting organisms onto tablets, into vials, and to the injection site. It is the single most effective infection-control intervention and is non-negotiable before every preparation.'
    },
    {
      id: 'sharps-safety-violation',
      text: 'Sharps safety violation (recapped needle, left on surface, improper disposal)',
      explanation: 'Recapping a needle, laying it on a surface, or failing to dispose of it immediately in a sharps container exposes the nurse, the patient, and housekeeping staff to bloodborne pathogens (HIV, hepatitis B and C). Activate the safety device and drop it in the sharps container at the point of use.'
    }
  ],

  sections: [
    {
      id: 'verification',
      title: 'Medication Verification Checks',
      critical: false,
      items: [
        {
          id: 'first-check',
          title: 'First Check',
          description: 'Compares medication with MAR when removing from dispensing system. Verbalizes name, dose, route, time. Checks expiration and drug form.',
          levels: { 0: 'Did not perform check.', 1: 'Incomplete or inaccurate check.', 2: 'Correctly performed check.' },
          critical: false,
          teachingPoint: 'The first check happens at the dispensing system (Pyxis/Omnicell/med drawer), the moment the medication leaves storage. Verbalize name, dose, route, and time out loud against the MAR, and confirm the expiration date and that the drug form matches the ordered route (an enteric-coated tablet cannot go down a feeding tube).'
        },
        {
          id: 'second-check',
          title: 'Second Check',
          description: 'Compares medication again during preparation. Verifies calculation accuracy. Checks expiration on prepared medication. Performs hand hygiene before prep.',
          levels: { 0: 'Did not perform check.', 1: 'Incomplete or inaccurate check.', 2: 'Correctly performed check.' },
          critical: false,
          teachingPoint: 'The second check happens during preparation, before the drug is drawn up, poured, or reconstituted. This is where the dose calculation is verified and where a second nurse independently double checks high-alert medications (insulin, heparin, opioids, chemotherapy). Hand hygiene must be done before preparation begins, not after.'
        },
        {
          id: 'third-check',
          title: 'Third Check (Bedside)',
          description: 'Compares medication with MAR at bedside with patient present. States patient name, medication name, dose, route, time.',
          levels: { 0: 'Did not perform check.', 1: 'Incomplete or inaccurate check.', 2: 'Correctly performed check.' },
          critical: false,
          teachingPoint: 'The third check occurs at the bedside with the patient physically present, immediately before administration. This is the last opportunity to catch an error. Scan or verify the two identifiers here, state name/med/dose/route/time, and give the patient the chance to say "that is not my usual pill."'
        }
      ]
    },
    {
      id: 'patient-safety',
      title: 'Patient Safety - Critical Items',
      critical: true,
      items: [
        {
          id: 'two-patient-identifiers',
          title: 'Two Patient Identifiers',
          description: 'Verifies using name & date of birth (NOT room number or age).',
          levels: { 0: 'Did not verify.', 1: 'Incomplete verification.', 2: 'Correctly verified.' },
          critical: true,
          teachingPoint: 'Acceptable identifiers are full name and date of birth (and medical record number). Room number, bed number, age, and diagnosis are NEVER acceptable identifiers because patients get moved. Ask the patient to state their name and DOB rather than asking "Are you Mr. Smith?" — confused and hard-of-hearing patients will say yes to anything.'
        },
        {
          id: 'allergy-check',
          title: 'Allergy Check',
          description: 'Asks patient about allergies, checks allergy band, verifies MAR. Reports concerns before administering.',
          levels: { 0: 'Did not check.', 1: 'Incomplete or inaccurate check.', 2: 'Correctly checked and reported.' },
          critical: true,
          teachingPoint: 'Three sources every time: ask the patient, look at the allergy band, and verify the MAR/chart. Also ask WHAT the reaction was — a rash is a very different risk from throat swelling. Cross-reference brand vs generic (Dilaudid = hydromorphone) and drug class (Zosyn and Ancef relate to a penicillin allergy).'
        },
        {
          id: 'right-drug',
          title: 'Right Drug',
          description: 'Matches order/MAR exactly.',
          levels: { 0: 'Did not match.', 1: 'Incomplete or inaccurate match.', 2: 'Correctly matched.' },
          critical: true,
          teachingPoint: 'Read the label three times and match it letter for letter against the MAR, which must match the original provider order. Be deliberate with look-alike/sound-alike drugs and with tall-man lettering (hydrOXYzine vs hydrALAZINE, DOPamine vs DOBUTamine). If the MAR does not match the provider order, stop and clarify.'
        },
        {
          id: 'right-dose',
          title: 'Right Dose',
          description: 'Correct calculation. Shows weight-based conversions (kg = lbs / 2.2) and IV rates if applicable.',
          levels: { 0: 'Did not calculate.', 1: 'Incomplete or inaccurate calculation.', 2: 'Correctly calculated.' },
          critical: true,
          teachingPoint: 'Show the work: Desired/Have x Quantity. Convert pounds to kilograms by dividing by 2.2 BEFORE any weight-based math — using pounds gives a dose 2.2 times too large. Verify the answer is within the safe dosage range from a drug guide, and question anything requiring more than 2 tablets or more than 3 mL in one IM site.'
        },
        {
          id: 'right-route',
          title: 'Right Route',
          description: 'Matches order. Assesses patient ability to receive via that route. Correct drug form for route.',
          levels: { 0: 'Did not assess.', 1: 'Incomplete assessment.', 2: 'Correctly assessed.' },
          critical: true,
          teachingPoint: 'The route must be written in the order — never assume. Assess whether the patient can actually use that route: can they swallow, is the IV patent and free of infiltration, is the injection site intact. Confirm the drug form fits the route: do not crush enteric-coated or extended-release tablets, and never give an oral suspension IV.'
        },
        {
          id: 'right-time',
          title: 'Right Time',
          description: 'Administers at the correct time.',
          levels: { 0: 'Did not administer at correct time.', 1: 'Incomplete timing.', 2: 'Correctly administered at the right time.' },
          critical: true,
          teachingPoint: 'Standard scheduled medications are given within 30 minutes before or after the scheduled time. Time-critical medications (insulin, antibiotics, anticoagulants, antiseizure drugs, Parkinson drugs) have a much narrower window. Honor the relationship to food: levothyroxine on an empty stomach, rapid-acting insulin with the meal tray present, prednisone with food in the morning.'
        },
        {
          id: 'right-documentation',
          title: 'Right Documentation',
          description: 'DOCUMENTS AFTER administering (not before). Includes medication name, dose, route, time, site, patient response, signature.',
          levels: { 0: 'Did not document.', 1: 'Incomplete documentation.', 2: 'Correctly documented.' },
          critical: true,
          teachingPoint: 'Never chart a medication before it is given — if the patient refuses or you are interrupted, the record is now false and the next nurse may believe the dose was administered. Document immediately after administration: drug, dose, route, time, injection site, patient response (and pain reassessment for analgesics), and your signature. Document refusals with the reason.'
        }
      ]
    },
    {
      id: 'clinical-judgment',
      title: 'Clinical Judgment & Assessment',
      critical: false,
      items: [
        {
          id: 'pre-administration-assessment',
          title: 'Pre-Administration Assessment',
          description: 'Reviews vital signs, lab values, patient ability to swallow, injection site assessment.',
          levels: { 0: 'Did not assess.', 1: 'Incomplete assessment.', 2: 'Correctly assessed.' },
          critical: false,
          teachingPoint: 'Know what each drug requires BEFORE you pull it: apical pulse for digoxin and beta blockers, blood pressure for antihypertensives, respiratory rate and sedation for opioids, blood glucose for insulin, potassium for diuretics and digoxin, INR for warfarin, aPTT and platelets for heparin, and renal function for renally cleared drugs.'
        },
        {
          id: 'right-reason',
          title: 'Right Reason',
          description: 'Verbalizes clinical reason or indication for medication.',
          levels: { 0: 'Did not verbalize.', 1: 'Incomplete verbalization.', 2: 'Correctly verbalized.' },
          critical: false,
          teachingPoint: 'Every dose must have a reason that fits THIS patient right now. This matters most with PRN orders: a PRN antihypertensive is not given to a normotensive patient just because it is due, and a PRN antipyretic is not given without a fever. If you cannot state the indication, do not give the drug.'
        },
        {
          id: 'right-patient-education',
          title: 'Right Patient Education',
          description: 'Explains medication purpose, expected effects, and side effects to report. Verifies understanding.',
          levels: { 0: 'Did not educate.', 1: 'Incomplete education.', 2: 'Effectively educated patient.' },
          critical: false,
          teachingPoint: 'Tell the patient the name, indication, action, and common side effects of each medication, then verify understanding with the teach-back technique: "Tell me in your own words what this medication is for and what you should report to me." Nodding is not understanding.'
        },
        {
          id: 'right-use-of-drug-guide',
          title: 'Right Use of Drug Guide',
          description: 'Demonstrates proper use of drug guide to verify medication information, including class, indications, and contraindications.',
          levels: { 0: 'Did not demonstrate.', 1: 'Incomplete demonstration of drug guide use.', 2: 'Correctly demonstrated use of drug guide.' },
          critical: false,
          teachingPoint: 'Never give a drug you cannot describe. Use the drug guide to confirm classification, indication, safe dose range, contraindications, nursing implications, and the specific monitoring parameters. Looking it up in front of the evaluator is a strength, not a weakness.'
        }
      ]
    },
    {
      id: 'safety-techniques',
      title: 'Safety Techniques',
      critical: false,
      items: [
        {
          id: 'hand-hygiene-asepsis',
          title: 'Hand Hygiene & Asepsis',
          description: 'Performs hand hygiene before prep. Maintains aseptic technique. For injections: 20-second antiseptic scrub with friction, air dry. Correct needle size.',
          levels: { 0: 'Did not perform.', 1: 'Incomplete or inaccurate technique.', 2: 'Correctly performed.' },
          critical: true,
          teachingPoint: 'Hand hygiene before preparation is a critical item — omitting it is an automatic fail. For injections, scrub the site with an antiseptic using friction for 20 seconds and let it AIR DRY completely; injecting through wet alcohol drives antiseptic into the tissue and causes stinging and irritation. Scrub the hub of IV ports the same way. Select the correct gauge and length for the route and the patient body habitus.'
        },
        {
          id: 'injection-technique',
          title: 'Injection Technique (if applicable)',
          description: 'Correct anatomical landmark. Proper needle angle. Smooth insertion. Aspirates for IM if required. Does NOT massage heparin sites. Sharps in container immediately.',
          levels: { 0: 'Did not perform.', 1: 'Incomplete or inaccurate technique.', 2: 'Correctly performed.' },
          critical: false,
          teachingPoint: 'Landmark every IM site rather than eyeballing it — the ventrogluteal is the safest adult site. SubQ is 45 or 90 degrees with no aspiration; IM is 90 degrees with aspiration per facility policy; intradermal is 5 to 15 degrees, bevel up, forming a wheal. Never massage heparin, enoxaparin, or intradermal sites. Sharps go straight into the container with the safety device activated — never recapped, never set down.'
        },
        {
          id: 'limiting-distractions',
          title: 'Limiting Distractions',
          description: 'Minimizes interruptions. Remains focused. Demonstrates "no interruption zone" awareness.',
          levels: { 0: 'Did not limit distractions.', 1: 'Incomplete effort to limit distractions.', 2: 'Effectively limited distractions.' },
          critical: false,
          teachingPoint: 'Interruption is one of the strongest predictors of a medication error. Stop side conversations with staff, do not answer the phone or pager during preparation, and do not multitask other patient care. Many units use a no-interruption zone, a red vest, or a taped floor area around the med room — respect it and expect the same from others.'
        }
      ]
    },
    {
      id: 'education-communication',
      title: 'Patient Education & Communication',
      critical: false,
      items: [
        {
          id: 'professionalism-respect',
          title: 'Professionalism & Respect',
          description: 'Uses clear, therapeutic communication. Maintains privacy and dignity. Demonstrates cultural sensitivity.',
          levels: { 0: 'Did not demonstrate.', 1: 'Partial demonstration of professionalism.', 2: 'Fully demonstrated professionalism.' },
          critical: false,
          teachingPoint: 'Introduce yourself, explain what you are doing and why, and use plain language rather than jargon. Close the door and the curtain and drape for any injection. Respect the patient right to refuse: obtain and document the reason, notify the provider, and return an intact wrapper to the unit dose drawer. Use a professional interpreter, not a family member, when there is a language barrier.'
        }
      ]
    },
    {
      id: 'additional-considerations',
      title: 'Additional Considerations',
      critical: false,
      items: [
        {
          id: 'special-precautions',
          title: 'Special Precautions',
          description: 'Holds medications based on lab values. Assesses contraindications. Reviews drug interactions. Monitors for adverse effects.',
          levels: { 0: 'Did not assess.', 1: 'Incomplete assessment of precautions.', 2: 'Correctly assessed precautions.' },
          critical: false,
          teachingPoint: 'Holding a medication is an active nursing decision, not an omission — and it must be documented along with provider notification. Classic holds: digoxin for apical pulse under 60, antihypertensives for a low systolic, warfarin for a supratherapeutic INR, heparin for a falling platelet count, metformin before iodinated contrast, and potassium for oliguria. Review interactions before you give, and monitor for adverse effects after.'
        },
        {
          id: 'expiration-dates',
          title: 'Expiration Dates',
          description: 'All medications checked for expiration.',
          levels: { 0: 'Did not check.', 1: 'Incomplete checks for expiration or form.', 2: 'Correctly checked all medications.' },
          critical: false,
          teachingPoint: 'Check the manufacturer expiration on every package, and check beyond-use dates on opened or reconstituted products (multidose vials, reconstituted antibiotics, opened insulin pens). Also inspect for clarity, color, and particulate matter — a precipitate or discoloration means discard it, regardless of the printed date.'
        }
      ]
    }
  ]
};

/* =============================================================================
 * 2. SKILLS — injection and administration reference
 * ========================================================================== */
window.MEDADMIN_SKILLS = {
  routes: [
    {
      id: 'subq',
      name: 'Subcutaneous (SubQ)',
      commonMeds: ['Insulin', 'Enoxaparin', 'Heparin'],
      needleGauge: '25-31 gauge',
      needleLength: '3/16 to 5/8 inch',
      angle: '45 degrees (limited subcutaneous tissue) or 90 degrees (adequate subcutaneous tissue)',
      volumeLimit: 'Usually 1 mL or less per site',
      sites: ['Abdomen', 'Upper arms', 'Anterior thighs', 'Upper buttocks'],
      guidelines: [
        'Rotate injection sites.',
        'Pinch skin as appropriate, at least 1 inch away from the umbilicus.',
        'Inject at a 45 degree angle when subcutaneous tissue is limited.',
        'Inject at a 90 degree angle when subcutaneous tissue is adequate.',
        'Do not aspirate.',
        'Do not massage enoxaparin or heparin injection sites.',
        'Do not expel the air bubble from a prefilled enoxaparin syringe.',
        'Insulin is absorbed fastest from the abdomen, then arm, then thigh, then buttock.'
      ],
      pitfalls: [
        'Massaging a heparin or enoxaparin site causes hematoma and bruising.',
        'Aspirating a subcutaneous injection is unnecessary and increases tissue trauma.',
        'Injecting within 1 inch of the umbilicus or into a bruised, scarred, or lipohypertrophied area gives erratic absorption.',
        'Expelling the air bubble from prefilled enoxaparin removes part of the dose.',
        'Using a needle that is too long turns a subcutaneous injection into an intramuscular one and speeds absorption unpredictably.'
      ]
    },
    {
      id: 'im',
      name: 'Intramuscular (IM)',
      commonMeds: ['Vaccines', 'Antibiotics', 'Analgesics'],
      needleGauge: '20-25 gauge',
      needleLength: '1 to 1.5 inches',
      angle: '90 degrees',
      volumeLimit: 'Up to 3 mL in a large adult muscle; 1 mL or less in the deltoid; 0.5 to 1 mL in infants',
      sites: ['Ventrogluteal', 'Vastus lateralis', 'Deltoid'],
      siteDetails: [
        {
          id: 'ventrogluteal',
          name: 'Ventrogluteal (preferred adult site)',
          landmark: 'Palm on the greater trochanter, index finger on the anterior superior iliac spine, middle finger spread back along the iliac crest; inject into the V formed between the index and middle fingers.',
          notes: ['Safest IM site', 'Large muscle mass', 'Few major nerves or blood vessels', 'Accommodates up to 3 mL', 'Preferred for viscous, irritating, and larger-volume medications']
        },
        {
          id: 'vastus-lateralis',
          name: 'Vastus lateralis',
          landmark: 'Middle third of the anterior lateral thigh, one hand width below the greater trochanter and one hand width above the knee.',
          notes: ['Preferred site for infants and young children', 'Appropriate for adults', 'No major nerves or vessels nearby', 'Accommodates up to 2 mL in adults, 0.5 to 1 mL in infants']
        },
        {
          id: 'deltoid',
          name: 'Deltoid',
          landmark: '1 to 2 inches (2 to 3 finger widths) below the acromion process, in line with the axilla.',
          notes: ['Use for small medication volumes only, generally 1 mL or less', 'Most common vaccination site', 'Close to the radial and brachial nerves and the brachial artery', 'Not used in infants and small children because of inadequate muscle mass']
        }
      ],
      guidelines: [
        'Inject at a 90 degree angle.',
        'Utilize the Z-track technique when indicated (irritating or staining medications such as iron dextran).',
        'Stabilize the tissue during administration.',
        'Follow facility policy regarding aspiration.',
        'Identify the anatomical landmark every time rather than estimating by sight.',
        'Insert smoothly and steadily, inject slowly (about 1 mL per 10 seconds), then withdraw at the same angle.'
      ],
      pitfalls: [
        'Failing to landmark the deltoid can injure the radial or axillary nerve or cause shoulder injury related to vaccine administration (SIRVA).',
        'The dorsogluteal site is no longer recommended because of the risk of sciatic nerve injury.',
        'Exceeding volume limits (more than 3 mL in a large muscle, more than 1 mL in the deltoid) causes pain, poor absorption, and tissue damage.',
        'Failing to use Z-track for irritating drugs causes tracking, staining, and tissue irritation.',
        'Injecting too quickly causes pain and increases the chance of leakage from the site.'
      ]
    },
    {
      id: 'id',
      name: 'Intradermal (ID)',
      commonMeds: ['Tuberculin (TB) skin testing', 'Allergy testing', 'Local anesthetic skin wheal'],
      needleGauge: '25-27 gauge',
      needleLength: '1/4 to 5/8 inch',
      angle: '5 to 15 degrees, bevel up',
      volumeLimit: '0.1 mL typical, generally less than 0.5 mL',
      sites: ['Inner forearm', 'Upper back'],
      guidelines: [
        'Insert with the bevel up.',
        'Inject at a 5 to 15 degree angle.',
        'Form a wheal or bleb (a raised 6 to 10 mm blister) to confirm correct depth.',
        'Do not massage the site.',
        'Do not aspirate.',
        'Circle and date the site; read a TB test at 48 to 72 hours by measuring INDURATION, not redness.'
      ],
      pitfalls: [
        'No wheal formed means the medication went too deep (subcutaneous) and the test result is invalid — document and repeat at another site.',
        'Massaging the site disperses the solution and invalidates the test.',
        'Measuring erythema instead of induration produces a false positive TB reading.'
      ]
    },
    {
      id: 'iv',
      name: 'Intravenous (IV)',
      commonMeds: ['Antibiotics', 'Analgesics', 'Fluids and electrolytes', 'Cardiac medications'],
      needleGauge: 'Peripheral catheters: 18-24 gauge depending on therapy and vein; blunt cannula or needleless connector for administration',
      needleLength: 'Not applicable — administered through an existing vascular access device',
      angle: 'Not applicable',
      volumeLimit: 'Determined by the drug, the diluent volume, and the ordered infusion rate',
      sites: ['Existing peripheral IV', 'Midline', 'Central venous access device (PICC, tunneled catheter, implanted port)'],
      guidelines: [
        'Verify IV site patency before administration.',
        'Assess for infiltration (cool, pale, swollen, no blood return).',
        'Assess for phlebitis (redness, warmth, pain, palpable cord along the vein).',
        'Verify IV compatibility of the drug with the running fluid and with any other infusing medication.',
        'Verify the correct infusion rate and use a pump for all high-alert infusions.',
        'Follow facility IV medication policy for dilution, push rate, and filter requirements.',
        'Monitor the patient closely during administration.',
        'Assess for adverse reactions during and after administration.',
        'Flush according to protocol when indicated (saline, administer, saline — and heparin only if ordered).',
        'Scrub the hub or port for 15 to 20 seconds with alcohol and allow it to air dry before access.'
      ],
      pitfalls: [
        'Pushing a drug too fast: potassium chloride is NEVER given IV push, IV digoxin must be given over at least 5 minutes, IV furosemide no faster than 20 mg per minute, IV phenytoin no faster than 50 mg per minute, and vancomycin over at least 60 minutes per gram.',
        'Administering into an infiltrated site causes tissue damage and, with a vesicant, necrosis — stop the infusion, do not flush, and follow the extravasation protocol.',
        'Mixing incompatible drugs in the same line produces a precipitate; phenytoin precipitates in any dextrose-containing solution and must be given in normal saline only.',
        'Ceftriaxone must never be co-administered with calcium-containing solutions (including lactated Ringer) in neonates.',
        'Failing to flush between incompatible medications allows them to mix inside the catheter lumen.'
      ]
    },
    {
      id: 'po',
      name: 'Oral (PO)',
      commonMeds: ['Tablets', 'Capsules', 'Oral suspensions and solutions'],
      needleGauge: 'Not applicable',
      needleLength: 'Not applicable',
      angle: 'Position the patient upright (high Fowler) at 90 degrees',
      volumeLimit: 'Use a calibrated oral syringe or medication cup — never a household spoon',
      sites: ['Mouth (swallowed)', 'Sublingual', 'Buccal', 'Enteral feeding tube (per order)'],
      guidelines: [
        'Assess the ability to swallow before giving anything by mouth.',
        'Position the patient upright and keep them upright for at least 30 minutes afterward.',
        'Keep tablets and capsules in the intact wrapper until at the bedside; avoid touching them with your hands.',
        'Do not crush enteric-coated, extended-release, or sublingual tablets, and do not open capsules unless the manufacturer allows it.',
        'Use a calibrated measuring device for liquids and read at eye level at the base of the meniscus.',
        'Stay with the patient until the medication is swallowed. Do not leave medication at the bedside without a provider order.',
        'If the medication is refused and the wrapper is intact, return it to the unit dose drawer, obtain the reason, and document.'
      ],
      pitfalls: [
        'Crushing an extended-release tablet delivers the entire 12 or 24 hour dose at once — a potentially fatal error with opioids, potassium chloride, and calcium channel blockers.',
        'Giving oral medication to a patient with an unassessed swallow or an impaired gag reflex risks aspiration.',
        'Leaving pills at the bedside means you cannot verify they were taken.',
        'Failing to hold enteral feeding around phenytoin doses causes subtherapeutic levels.'
      ]
    }
  ],

  sixRights: [
    {
      right: 'Right Patient',
      detail: 'Verify with two identifiers — full name and date of birth (or medical record number). Ask the patient to state them; compare against the armband and the MAR. Room number, bed number, and age are never acceptable identifiers.',
      commonError: 'Asking a leading question ("Are you Mr. Doe?") or using the room number. Confused, sedated, and hard-of-hearing patients will agree to anything.'
    },
    {
      right: 'Right Medication',
      detail: 'Confirm the medication in the MAR matches the original provider order, and that the label matches the MAR at all three checks. Clarify anything unclear or illegible with the provider before proceeding.',
      commonError: 'Grabbing a look-alike/sound-alike drug (hydromorphone for morphine, hydrALAZINE for hydrOXYzine, Humalog for Humulin) or trusting the MAR without ever comparing it to the order.'
    },
    {
      right: 'Right Route',
      detail: 'The route must be specified in the order. Confirm the drug form is appropriate for the route and that the patient can physically use it — assess swallowing for PO, patency for IV, and the site for injections.',
      commonError: 'Assuming a route when the order does not state one, or giving a drug by a route it was never intended for (IV push of a drug that must be infused).'
    },
    {
      right: 'Right Time',
      detail: 'Scheduled medications are generally given within 30 minutes before or after the ordered time. Time-critical medications have narrower windows. Honor food, meal, and sequencing requirements, and verify the last dose given for PRN and Q-hour orders.',
      commonError: 'Giving a rapid-acting insulin before the meal tray has arrived, or giving a PRN dose sooner than the ordered interval because the previous nurse charted late.'
    },
    {
      right: 'Right Dose',
      detail: 'Calculate using Desired/Have x Quantity, convert pounds to kilograms by dividing by 2.2 first, and confirm the result is within the safe dosage range in the drug guide. Use a second nurse independent double check for high-alert medications.',
      commonError: 'A decimal error (a tenfold overdose), calculating a weight-based dose from pounds instead of kilograms, and unquestioningly preparing an unusual number of tablets or vials.'
    },
    {
      right: 'Right Documentation',
      detail: 'Document immediately AFTER administration: medication, dose, route, time, injection site, patient response, and signature. Document effectiveness of PRN analgesics on reassessment, and document holds and refusals with the reason and the provider notification.',
      commonError: 'Charting before administering. If the patient then refuses or vomits the dose, the record is false and the next nurse may believe it was given.'
    }
  ],

  additionalRights: [
    { right: 'Right Reason (Indication)', detail: 'State the clinical reason this patient is receiving this drug right now. Especially important for PRN orders.' },
    { right: 'Right Patient Education', detail: 'Explain the name, indication, action, and common side effects, then verify understanding with teach-back.' },
    { right: 'Right Assessment', detail: 'Obtain the required pre-administration data — apical pulse, blood pressure, respiratory rate, glucose, or lab value — before the dose.' },
    { right: 'Right Evaluation / Response', detail: 'Reassess after administration for the therapeutic effect and for adverse reactions.' },
    { right: 'Right to Refuse', detail: 'Respect the refusal, obtain and document the reason, notify the provider, and return an intact wrapper to the unit dose drawer.' }
  ],

  threeChecks: [
    {
      check: 'First Check',
      when: 'When removing the medication from the dispensing system (Pyxis, Omnicell, or unit dose drawer).',
      what: 'Compare the medication label with the MAR. Verbalize name, dose, route, and time. Check the expiration date and confirm the drug form is correct for the ordered route.'
    },
    {
      check: 'Second Check',
      when: 'During preparation, after hand hygiene and before drawing up, pouring, or reconstituting.',
      what: 'Compare the label with the MAR again. Verify the dose calculation and show the work. Check the expiration or beyond-use date on the prepared medication. Obtain a second nurse independent double check for high-alert medications.'
    },
    {
      check: 'Third Check (Bedside)',
      when: 'At the bedside with the patient present, immediately before administration.',
      what: 'Compare the medication with the MAR one final time. Verify two identifiers, then state the patient name, medication name, dose, route, and time. This is the last barrier before the dose becomes irreversible.'
    }
  ],

  generalPrinciples: [
    'Use two patient identifiers to identify the patient.',
    'Identify that the medication order in the MAR is the same as the provider order.',
    'Minimize distractions: stop discussions with staff, silence phone calls and pagers, and do not perform other tasks while preparing medications.',
    'Ensure the medication label matches the MAR and clarify with the provider if anything is unclear.',
    'Calculate the medication dose, use appropriate measuring devices, and ensure the dose is within the safe dosage range.',
    'Take the medication to the patient at the correct time.',
    'Review any pre-administration assessment findings such as vital signs and laboratory values.',
    'Perform hand hygiene and avoid touching tablets and capsules.',
    'Use gloves for parenteral administrations and topical applications.',
    'Do not ask another nurse to administer medications; keep medications secure at all times and only administer medications you have prepared.',
    'Be sure the label is clear and legible, that the drug is properly mixed, and check medication clarity and color.',
    'Keep tablets and capsules in the wrapper intact; if the medication is refused, return it to the unit dose drawer.',
    'All medications and syringes must be labeled; any medication found unlabeled must be discarded.',
    'Follow the six rights: right patient, right medication, right route, right time, right dose, right documentation.',
    'Inform the patient of the name, indication, action, and common side effects of each medication.',
    'Evaluate the patient knowledge of the medication and provide appropriate teaching using the teach-back technique.',
    'Stay with the patient until the medication is taken and provide assistance as necessary.',
    'Do not leave medication at the bedside without a healthcare provider order.',
    'Respect the patient right to refuse a medication; if the wrapper remains intact, return the medication to the unit dose drawer.',
    'When a medication is refused, obtain the reason and document accordingly.'
  ],

  highAlertPractices: [
    'High-alert medications require a second nurse independent double check of the drug, dose, concentration, pump settings, and patient identity.',
    'Independent means the second nurse verifies from the original order without being told your calculation.',
    'Insulin, heparin, opioids, potassium chloride, chemotherapy, anticoagulants, and neuromuscular blockers are the classic high-alert groups.',
    'Use a pump for every high-alert continuous infusion and verify the programmed rate against the order out loud.',
    'Never store concentrated electrolytes (potassium chloride, hypertonic saline) as floor stock in patient care areas.'
  ]
};

/* =============================================================================
 * 3. MAR PRACTICE CASES
 * -----------------------------------------------------------------------------
 * Each case carries a set of encoded "traps" — deliberate hazards the student
 * must identify. severity: 'critical' (would fail the signoff / harm the
 * patient), 'major' (unsafe practice, requires provider notification or a
 * hold), 'minor' (best-practice miss or documentation issue).
 * ========================================================================== */
window.MEDADMIN_MAR_CASES = [

  /* ---------------------------------------------------------------------- */
  {
    id: 'mar-1',
    difficulty: 'Hard',
    title: 'Congestive heart failure with ESRD — allergy and high-alert traps',
    patient: {
      name: 'Doe, Eric',
      mrn: '0000965',
      age: 77,
      sex: 'Male',
      codeStatus: 'Full code',
      allergies: ['hydromorphone'],
      admittingDx: 'Congestive heart failure',
      pmh: ['Diabetes mellitus type 2', 'End-stage renal disease (ESRD)', 'Hypertension']
    },
    labs: {
      'K+': '4.0 mEq/L',
      BUN: '62 mg/dL',
      Creatinine: '6.4 mg/dL',
      'Na+': '136 mEq/L',
      'Blood glucose': '160 mg/dL',
      'Last hemodialysis': 'Yesterday, tolerated well'
    },
    vitals: {
      BP: '138/74',
      HR: '65',
      RR: '25',
      Temp: '101.6 F oral',
      O2sat: '94% on 2 L nasal cannula'
    },
    currentTime: '0800',
    medTimes: ['0800', '1000', '1200', '1400'],
    ivAccess: 'Left antecubital, #20 gauge peripheral IV',
    clinicalNote: 'Alert and oriented x4. Reports pain 7/10 to the back. Ambulates with assistance. Dyspnea on exertion. Currently on 2 L oxygen via nasal cannula. S3 heart sound present on auscultation. Moderate crackles bilaterally in the lung bases. IV: left AC #20.',
    medications: [
      {
        id: 'mar1-med1',
        name: 'Dilaudid (hydromorphone)',
        dose: '1 mg',
        concentration: '2 mg/mL',
        route: 'IV',
        frequency: 'Q2hrs PRN',
        indication: 'Pain',
        holdParameters: 'Hold for respiratory rate under 12, excessive sedation, or hypotension. ABSOLUTE CONTRAINDICATION: documented hydromorphone allergy.',
        isPRN: true,
        correctAction: 'hold',
        requiredChecks: [
          'Cross-reference the BRAND name Dilaudid against the GENERIC name hydromorphone on the allergy list',
          'Ask the patient about allergies, inspect the allergy band, and verify the MAR',
          'Respiratory rate and sedation level before and after any opioid',
          'Pain rating and location before administration',
          'Reassess pain 15 to 30 minutes after an IV opioid'
        ],
        calculation: {
          needed: true,
          question: 'How many mL would deliver a 1 mg dose from a 2 mg/mL vial?',
          answer: 0.5,
          unit: 'mL',
          work: 'Desired / Have x Quantity = 1 mg / 2 mg x 1 mL = 0.5 mL. The math is correct, but the dose must NOT be drawn up or given — the patient is allergic to hydromorphone.'
        }
      },
      {
        id: 'mar1-med2',
        name: 'Prednisone',
        dose: '5 mg',
        concentration: '5 mg tablets',
        route: 'PO',
        frequency: 'BID',
        indication: 'Anti-inflammatory therapy',
        holdParameters: 'No routine hold. Report active untreated infection and significant hyperglycemia before administering.',
        isPRN: false,
        correctAction: 'give',
        requiredChecks: [
          'Assess ability to swallow and position upright',
          'Blood glucose — corticosteroids raise glucose in a diabetic patient',
          'Assess for signs of infection (this patient has a temperature of 101.6 F)',
          'Give with food to reduce gastric irritation',
          'Teach the patient never to stop a corticosteroid abruptly'
        ],
        calculation: {
          needed: true,
          question: 'How many 5 mg tablets are needed for a 5 mg dose?',
          answer: 1,
          unit: 'tablet',
          work: 'Desired / Have = 5 mg / 5 mg = 1 tablet.'
        }
      },
      {
        id: 'mar1-med3',
        name: 'Digoxin',
        dose: '0.25 mg',
        concentration: '0.5 mg/2 mL (0.25 mg/mL)',
        route: 'Rapid IV push (as written on the MAR)',
        frequency: 'Daily',
        indication: 'Heart failure — increases contractility, slows ventricular rate',
        holdParameters: 'Hold and notify the provider for apical pulse under 60 beats per minute, signs of digoxin toxicity, hypokalemia, or a digoxin level above 2.0 ng/mL.',
        isPRN: false,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Apical pulse for a FULL 60 seconds before every dose',
          'Potassium level — hypokalemia potentiates digoxin toxicity',
          'Renal function — digoxin is renally cleared and this patient has ESRD',
          'Most recent digoxin level (therapeutic 0.5 to 2.0 ng/mL)',
          'Assess for toxicity: nausea, anorexia, visual halos or yellow-green vision, confusion, new dysrhythmia',
          'Verify the ordered IV push rate against the drug guide — minimum 5 minutes'
        ],
        calculation: {
          needed: true,
          question: 'How many mL deliver 0.25 mg from a 0.5 mg/2 mL vial?',
          answer: 1,
          unit: 'mL',
          work: 'Concentration = 0.5 mg / 2 mL = 0.25 mg/mL. Desired / Have x Quantity = 0.25 mg / 0.5 mg x 2 mL = 1 mL. That 1 mL must then be pushed over at least 5 minutes, not rapidly.'
        }
      },
      {
        id: 'mar1-med4',
        name: 'Hydralazine',
        dose: '10 mg',
        concentration: '20 mg/mL',
        route: 'IV push',
        frequency: 'Q6hrs PRN',
        indication: 'Hypertension',
        holdParameters: 'Hold for systolic blood pressure under 110 mmHg.',
        isPRN: true,
        correctAction: 'hold',
        requiredChecks: [
          'Blood pressure immediately before administration and again 15 to 30 minutes after',
          'Heart rate — hydralazine causes reflex tachycardia',
          'Confirm a genuine PRN indication exists (an actual hypertensive reading)',
          'Assess for orthostatic hypotension and fall risk before ambulating'
        ],
        calculation: {
          needed: true,
          question: 'How many mL deliver 10 mg from a 20 mg/mL vial?',
          answer: 0.5,
          unit: 'mL',
          work: 'Desired / Have x Quantity = 10 mg / 20 mg x 1 mL = 0.5 mL.'
        }
      }
    ],
    traps: [
      {
        id: 'mar1-trap-allergy',
        severity: 'critical',
        trigger: 'The MAR lists Dilaudid 1 mg IV Q2hrs PRN for pain, the patient reports pain 7/10, and the allergy list reads "hydromorphone."',
        whatHappens: 'Dilaudid IS hydromorphone — the same drug under its brand name. A student who reads the brand name on the MAR and the generic name on the allergy list without connecting them administers a drug the patient is documented as allergic to. This can cause urticaria, bronchospasm, and anaphylaxis, and it is an automatic critical-error FAIL on the rubric (allergy not checked / checked incorrectly, and wrong drug administered).',
        correctAction: 'Do NOT administer. Hold the dose, notify the provider that the ordered analgesic is the drug the patient is allergic to, request a non-hydromorphone alternative for the 7/10 back pain, verify what the actual reaction was, confirm the allergy band and chart are accurate, and document the hold with the provider notification.',
        teachingPoint: 'Always cross-reference brand and generic names in BOTH directions before you accept an allergy screen as clear. Dilaudid = hydromorphone, Tylenol = acetaminophen, Zosyn = piperacillin-tazobactam (a penicillin), Ancef = cefazolin (a cephalosporin with penicillin cross-sensitivity), Coumadin = warfarin. Also screen the drug CLASS, not just the exact molecule.'
      },
      {
        id: 'mar1-trap-digoxin-rate',
        severity: 'critical',
        trigger: 'The digoxin order reads "0.25 mg daily Rapid IV push."',
        whatHappens: 'Intravenous digoxin pushed rapidly produces high transient serum concentrations and causes life-threatening dysrhythmias — bradycardia, heart block, ventricular ectopy, and ventricular fibrillation. "Rapid IV push" is not a safe route instruction for digoxin at any dose.',
        correctAction: 'Do not administer as written. Clarify the order with the provider. IV digoxin must be given undiluted or diluted in at least a fourfold volume of compatible diluent and pushed SLOWLY over a minimum of 5 minutes, with cardiac monitoring. Document the clarification and the corrected order.',
        teachingPoint: 'A nurse who administers an unsafe order shares legal responsibility for the resulting harm. The rate of an IV push is part of the "right route." Memorize the rate limits: digoxin over at least 5 minutes, furosemide no faster than 20 mg per minute, phenytoin no faster than 50 mg per minute, vancomycin at least 60 minutes per gram, and potassium chloride NEVER by IV push.'
      },
      {
        id: 'mar1-trap-apical-pulse',
        severity: 'major',
        trigger: 'The recorded heart rate is 65 and the student accepts it as clearance to give digoxin.',
        whatHappens: 'A charted radial or monitor heart rate is not the required assessment for digoxin. The 65 recorded here is borderline and may not reflect the current apical rate, and digoxin further slows conduction. Giving digoxin to a patient whose true apical rate has fallen below 60 can precipitate symptomatic bradycardia and heart block.',
        correctAction: 'Auscultate the apical pulse at the fifth intercostal space, midclavicular line, for a FULL 60 seconds immediately before the dose. Note rate, rhythm, and regularity. If the apical rate is below 60 beats per minute, hold the dose, notify the provider, and document.',
        teachingPoint: 'Digoxin requires a full-minute APICAL pulse every time — never a 15-second count multiplied by four, and never a radial pulse. In an older adult with ESRD you should also confirm the potassium and the most recent digoxin level before giving the dose.'
      },
      {
        id: 'mar1-trap-esrd-digoxin',
        severity: 'major',
        trigger: 'The patient has end-stage renal disease and is ordered digoxin 0.25 mg daily.',
        whatHappens: 'Digoxin is cleared almost entirely by the kidneys and has a narrow therapeutic index (0.5 to 2.0 ng/mL). In ESRD the drug accumulates and toxicity develops even on a standard dose. A daily 0.25 mg dose is high for a 77-year-old with ESRD; typical renal dosing is 0.125 mg daily or less.',
        correctAction: 'Verify the most recent digoxin level and renal function, assess for toxicity (anorexia, nausea, vomiting, visual halos or yellow-green vision, confusion, new dysrhythmia), and discuss the dose with the provider in light of the ESRD before administering.',
        teachingPoint: 'Renally cleared, narrow-therapeutic-index drugs — digoxin, vancomycin, gentamicin, metformin, enoxaparin — always need a renal-function check before administration. In ESRD, assume every renally cleared drug is accumulating until a level proves otherwise. Also confirm the dialysis schedule - many drugs are held until after dialysis.'
      },
      {
        id: 'mar1-trap-fever',
        severity: 'major',
        trigger: 'Oral temperature is 101.6 F and the student proceeds through the medication pass without acting on it.',
        whatHappens: 'A temperature of 101.6 F is a significant fever. In a patient with heart failure and ESRD it may signal pneumonia, a urinary tract infection, or a dialysis-access or line infection. Fever also increases myocardial oxygen demand and worsens heart failure, and this patient already has an RR of 25, an S3, and bilateral crackles.',
        correctAction: 'Report the temperature to the provider before completing the medication pass. Anticipate orders for cultures, a chest x-ray, and antipyretics or antibiotics. Recognize that the ordered prednisone is immunosuppressive and may blunt the febrile response, and include that in your report.',
        teachingPoint: 'Pre-administration assessment is a scored rubric item. Abnormal vital signs are not background information — they are data you are required to act on. A fever plus tachypnea plus new crackles in a heart-failure patient is a report-now finding, not a "chart it and move on" finding.'
      },
      {
        id: 'mar1-trap-hydralazine-prn',
        severity: 'minor',
        trigger: 'Hydralazine 10 mg IV Q6hrs PRN for hypertension is due and the blood pressure is 138/74, which is above the hold parameter of SBP under 110.',
        whatHappens: 'Because 138 is above 110, the hold parameter is technically not met, so the drug is permissible. But a PRN order requires an actual indication, and 138/74 is not hypertension. Giving it produces unnecessary hypotension, reflex tachycardia, and fall risk in a 77-year-old who ambulates with assistance.',
        correctAction: 'Do not give. Document that the systolic pressure is above the hold threshold but that no PRN indication for hypertension is present at this time. Continue to monitor and reassess the blood pressure.',
        teachingPoint: 'A hold parameter and an indication are two different gates, and BOTH must be satisfied. "Not held" does not mean "indicated." The rubric item Right Reason requires you to verbalize why THIS patient needs THIS drug RIGHT NOW; if you cannot, the correct nursing action is to withhold and document.'
      },
      {
        id: 'mar1-trap-prednisone-glucose',
        severity: 'minor',
        trigger: 'Prednisone is ordered BID for a patient with type 2 diabetes whose blood glucose is already 160 mg/dL.',
        whatHappens: 'Corticosteroids cause insulin resistance and hyperglycemia. Prednisone will push this already-elevated glucose higher, and it also masks the signs of the infection suggested by the 101.6 F temperature.',
        correctAction: 'Give the dose with food in the morning, but monitor blood glucose closely, report the trend, and teach the patient to expect higher readings while on steroids. Also teach never to stop a corticosteroid abruptly because of the risk of adrenal insufficiency.',
        teachingPoint: 'Steroid plus diabetic equals hyperglycemia; steroid plus infection equals a masked and blunted febrile response. Anticipating the predictable adverse effect and monitoring for it is what separates a passing pre-administration assessment from an incomplete one.'
      }
    ]
  },

  /* ---------------------------------------------------------------------- */
  {
    id: 'mar-2',
    difficulty: 'Hard',
    title: 'Pediatric pneumonia — weight-based dosing and safe-range verification',
    patient: {
      name: 'Nguyen, Mia',
      mrn: '0004122',
      age: 4,
      sex: 'Female',
      codeStatus: 'Full code',
      allergies: ['No known drug allergies'],
      admittingDx: 'Community-acquired pneumonia',
      pmh: ['Reactive airway disease', 'Otitis media (recurrent)']
    },
    labs: {
      WBC: '18.2 K/uL',
      Hgb: '11.8 g/dL',
      'Na+': '138 mEq/L',
      'K+': '4.2 mEq/L',
      'Blood glucose': '88 mg/dL',
      Weight: '33 lb (admission scale)'
    },
    vitals: {
      BP: '92/58',
      HR: '138',
      RR: '32',
      Temp: '102.2 F axillary',
      O2sat: '94% on room air'
    },
    currentTime: '0900',
    medTimes: ['0900', '1300', '1700', '2100'],
    ivAccess: 'Right hand #24 gauge peripheral IV, saline locked, patent with brisk blood return',
    clinicalNote: 'Four-year-old female, alert, clingy to mother, crying intermittently. Mild subcostal retractions. Coarse crackles right lower lobe. Cough productive. Taking sips of fluid, ate about a quarter of breakfast. Mother reports she gave "some childrens Tylenol" at home around 0600 but is unsure of the amount. Weight on admission scale: 33 lb.',
    medications: [
      {
        id: 'mar2-med1',
        name: 'Acetaminophen',
        dose: '15 mg/kg (weight-based order)',
        concentration: '160 mg/5 mL oral suspension',
        route: 'PO',
        frequency: 'Q4-6h PRN',
        indication: 'Fever or mild pain',
        holdParameters: 'Do not exceed 75 mg/kg per 24 hours or 5 doses in 24 hours. Hold and clarify if another acetaminophen-containing product was given within the dosing interval.',
        isPRN: true,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Convert the admission weight from pounds to kilograms before calculating',
          'Establish the exact time and amount of the dose the mother gave at home',
          'Total the 24-hour acetaminophen from ALL sources including combination products',
          'Measure with a calibrated oral syringe, never a household spoon',
          'Recheck temperature 30 to 60 minutes after the dose'
        ],
        calculation: {
          needed: true,
          question: 'The child weighs 33 lb. Calculate the ordered 15 mg/kg dose and the volume to draw from a 160 mg/5 mL suspension.',
          answer: 7,
          unit: 'mL',
          work: 'Step 1 convert weight: 33 lb / 2.2 = 15 kg. Step 2 dose: 15 kg x 15 mg/kg = 225 mg. Step 3 volume: 225 mg / 160 mg x 5 mL = 7.03 mL, rounded to 7 mL in an oral syringe. Safe-range check: maximum 75 mg/kg/day = 1125 mg/day, so 225 mg per dose up to 5 doses is within range ONLY if the home dose is accounted for.'
        }
      },
      {
        id: 'mar2-med2',
        name: 'Amoxicillin-clavulanate',
        dose: '45 mg/kg/day divided Q12h',
        concentration: '400 mg/5 mL oral suspension',
        route: 'PO',
        frequency: 'Q12h',
        indication: 'Community-acquired pneumonia',
        holdParameters: 'Hold and notify for rash, hives, wheezing, or any sign of hypersensitivity. Confirm no penicillin allergy.',
        isPRN: false,
        correctAction: 'give',
        requiredChecks: [
          'Confirm no penicillin or cephalosporin allergy with the parent and the chart',
          'Shake the suspension well and check the beyond-use date after reconstitution',
          'Give with food to reduce the diarrhea and GI upset caused by the clavulanate',
          'Measure with a calibrated oral syringe',
          'Teach the family to complete the full course'
        ],
        calculation: {
          needed: true,
          question: 'Calculate the single Q12h dose in mL for a 15 kg child on 45 mg/kg/day divided every 12 hours, using a 400 mg/5 mL suspension.',
          answer: 4.2,
          unit: 'mL',
          work: 'Step 1 daily dose: 15 kg x 45 mg/kg/day = 675 mg/day. Step 2 per dose: 675 mg / 2 doses = 337.5 mg. Step 3 volume: 337.5 mg / 400 mg x 5 mL = 4.22 mL, rounded to 4.2 mL in an oral syringe.'
        }
      },
      {
        id: 'mar2-med3',
        name: 'Morphine sulfate',
        dose: '2 mg',
        concentration: '2 mg/mL',
        route: 'IV',
        frequency: 'Q4h PRN',
        indication: 'Severe pain',
        holdParameters: 'Hold for respiratory rate below the age-appropriate minimum, oxygen saturation under 92 percent, or excessive sedation.',
        isPRN: true,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Verify the dose against the pediatric safe range of 0.05 to 0.1 mg/kg per dose',
          'Continuous pulse oximetry and frequent respiratory assessment after any pediatric opioid',
          'Use an age-appropriate pain scale (FACES or FLACC)',
          'Confirm naloxone availability and the weight-based reversal dose',
          'Second-nurse independent double check — opioids are high alert'
        ],
        calculation: {
          needed: true,
          question: 'What is the safe single-dose range of IV morphine for a 15 kg child, and does the ordered 2 mg fall within it?',
          answer: 1.5,
          unit: 'mg (upper limit of the safe range)',
          work: 'Safe range 0.05 to 0.1 mg/kg per dose. Low: 15 kg x 0.05 = 0.75 mg. High: 15 kg x 0.1 = 1.5 mg. The ordered 2 mg EXCEEDS the maximum safe single dose of 1.5 mg. Do not administer — clarify with the provider.'
        }
      },
      {
        id: 'mar2-med4',
        name: 'Ondansetron',
        dose: '2 mg',
        concentration: '2 mg/mL',
        route: 'IV',
        frequency: 'Q8h PRN',
        indication: 'Nausea and vomiting',
        holdParameters: 'Hold and notify for a prolonged QT interval or known long QT syndrome.',
        isPRN: true,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Verify against the pediatric range of 0.1 to 0.15 mg/kg per dose',
          'Confirm an actual PRN indication — no nausea or vomiting is documented in the clinical note',
          'Assess IV patency and flush before and after',
          'Push slowly over 2 to 5 minutes',
          'Monitor for headache and constipation'
        ],
        calculation: {
          needed: true,
          question: 'How many mL deliver 2 mg from a 2 mg/mL vial, and is 2 mg within the safe range for 15 kg?',
          answer: 1,
          unit: 'mL',
          work: '2 mg / 2 mg x 1 mL = 1 mL. Safe range check: 15 kg x 0.1 = 1.5 mg, 15 kg x 0.15 = 2.25 mg. The ordered 2 mg falls inside the 1.5 to 2.25 mg range, so it is safe to give.'
        }
      }
    ],
    traps: [
      {
        id: 'mar2-trap-lb-kg',
        severity: 'critical',
        trigger: 'The weight is charted in pounds (33 lb) and every order is written per kilogram.',
        whatHappens: 'A student who multiplies 33 by 15 mg/kg calculates 495 mg of acetaminophen instead of 225 mg — a 2.2-fold overdose. Applied across all the weight-based orders in this MAR, every dose is more than double what the child should receive. In a 15 kg child, repeated 2.2x acetaminophen dosing is hepatotoxic.',
        correctAction: 'Convert BEFORE calculating: 33 lb / 2.2 = 15 kg. Document the weight in kilograms, verify it against a same-day scale weight rather than a reported weight, and use kilograms for every subsequent calculation.',
        teachingPoint: 'kg = lb / 2.2 is a scored rubric item under Right Dose. In pediatrics the weight is the single most common source of a tenfold or twofold error. Always weigh in kilograms, chart in kilograms, and never accept a parent-reported weight for a drug calculation.'
      },
      {
        id: 'mar2-trap-morphine-overdose',
        severity: 'critical',
        trigger: 'The MAR contains a morphine 2 mg IV Q4h PRN order for a 15 kg four-year-old.',
        whatHappens: 'The pediatric safe range is 0.05 to 0.1 mg/kg per dose, which is 0.75 to 1.5 mg for this child. The ordered 2 mg is above the maximum. It looks like a plausible adult starting dose that was written on a pediatric chart. Given IV, an excess opioid dose in a small child causes respiratory depression and apnea.',
        correctAction: 'Do not administer. Hold the dose and clarify the order with the provider, stating the calculated safe range. Request a weight-based order. Document the clarification.',
        teachingPoint: 'The nurse is the last check on a prescribing error. Verify EVERY pediatric dose against a safe-range reference before giving it, even when a provider, a pharmacist, and the electronic record have all already touched the order. A dose outside the safe range is never given "because it was ordered."'
      },
      {
        id: 'mar2-trap-acetaminophen-home-dose',
        severity: 'major',
        trigger: 'The mother reports giving "some childrens Tylenol" at approximately 0600 but does not know the amount.',
        whatHappens: 'Acetaminophen is the leading cause of pediatric acute liver failure, and duplicate dosing from home plus hospital sources is the classic mechanism. Giving a hospital dose at 0900 without accounting for the 0600 home dose can breach both the 4 to 6 hour interval and the 75 mg/kg/day ceiling.',
        correctAction: 'Establish the exact time, formulation, and volume of the home dose before giving anything. If the amount cannot be determined, hold and clarify with the provider. Chart all acetaminophen from every source on a running 24-hour total, including combination products.',
        teachingPoint: 'Always ask about home medications, over-the-counter products, and combination products before giving an analgesic or antipyretic. Percocet, Norco, and many cold preparations all contain acetaminophen. Pediatric maximum is 75 mg/kg per day and no more than 5 doses in 24 hours; the adult ceiling is 4 g per day, or 3 g with liver disease or chronic alcohol use.'
      },
      {
        id: 'mar2-trap-measuring-device',
        severity: 'major',
        trigger: 'Two oral liquids must be measured — 7 mL and 4.2 mL.',
        whatHappens: 'Measuring a 4.2 mL dose in a medicine cup or with a household teaspoon introduces a large percentage error in a small child. A "teaspoon" ranges from 2.5 to 7 mL among household spoons, and dosing cups are inaccurate below about 5 mL.',
        correctAction: 'Use a calibrated oral syringe for every pediatric liquid dose, draw to the graduation line at eye level, and administer slowly into the buccal pocket of the cheek. Send the family home with an oral syringe and teach the exact dose in mL, never in spoons.',
        teachingPoint: 'Use appropriate measuring devices is an explicit lab-skill expectation. Oral syringes also prevent the fatal error of drawing an oral liquid into a parenteral syringe that could be connected to an IV line — oral syringes are deliberately incompatible with IV connectors.'
      },
      {
        id: 'mar2-trap-vitals',
        severity: 'major',
        trigger: 'HR 138, RR 32, temperature 102.2 F axillary, oxygen saturation 94 percent on room air with subcostal retractions.',
        whatHappens: 'A student who charts these as "abnormal for an adult" and moves on misses that retractions plus tachypnea plus a saturation drifting to 94 percent represent increased work of breathing in a child with pneumonia. Pediatric respiratory decompensation is sudden, and tachycardia and tachypnea are the earliest signs.',
        correctAction: 'Interpret the vital signs against age-appropriate norms (a four-year-old normally runs HR 80 to 120 and RR 20 to 28). Recognize that the fever partly explains the tachycardia but the retractions do not. Report the increased work of breathing, monitor oxygen saturation continuously, and reassess after the antipyretic.',
        teachingPoint: 'Pediatric vital signs must always be interpreted against age-specific ranges. Retractions, nasal flaring, and grunting are objective signs of respiratory distress that outrank any single number. Children compensate well and then crash fast.'
      },
      {
        id: 'mar2-trap-im-site',
        severity: 'minor',
        trigger: 'If an intramuscular medication is added for this four-year-old, the student must choose a site.',
        whatHappens: 'Choosing the deltoid in a small child risks injecting into inadequate muscle mass and injuring the radial or axillary nerve. Choosing the dorsogluteal risks sciatic nerve injury and is no longer recommended at any age.',
        correctAction: 'Use the vastus lateralis for infants and young children — the middle third of the anterior lateral thigh. Limit the volume to 0.5 to 1 mL in an infant and up to 2 mL in a larger child, use a 22 to 25 gauge needle of 5/8 to 1 inch depending on muscle mass, and have a second person help with positioning and comfort.',
        teachingPoint: 'Site selection is a scored injection-technique item. Vastus lateralis for infants and young children, ventrogluteal as the safest large-volume adult site, and deltoid only for small volumes of 1 mL or less in a patient with adequate muscle mass.'
      }
    ]
  },

  /* ---------------------------------------------------------------------- */
  {
    id: 'mar-3',
    difficulty: 'Hard',
    title: 'Type 2 diabetes with cellulitis — insulin, sliding scale, and high-alert double checks',
    patient: {
      name: 'Alvarez, Robert',
      mrn: '0007731',
      age: 58,
      sex: 'Male',
      codeStatus: 'Full code',
      allergies: ['No known drug allergies'],
      admittingDx: 'Right lower extremity cellulitis with uncontrolled type 2 diabetes',
      pmh: ['Type 2 diabetes mellitus (18 years)', 'Hypertension', 'Diabetic peripheral neuropathy', 'Obesity']
    },
    labs: {
      'Blood glucose (0730 fingerstick)': '342 mg/dL',
      'K+': '3.4 mEq/L',
      A1C: '9.8 percent',
      Creatinine: '1.0 mg/dL',
      eGFR: '78 mL/min/1.73m2',
      WBC: '13.4 K/uL'
    },
    vitals: {
      BP: '128/76',
      HR: '88',
      RR: '18',
      Temp: '99.4 F oral',
      O2sat: '97% on room air'
    },
    currentTime: '0730',
    medTimes: ['0730', '1130', '1630', '2100'],
    ivAccess: 'Left forearm #20 gauge peripheral IV, patent',
    clinicalNote: 'Alert and oriented x4. Right lower leg warm, erythematous, edematous with marked demarcation. Breakfast tray has NOT yet arrived on the unit; dietary reports trays out at approximately 0800. Patient states he has been "skipping shots at home because they make me shaky." Scheduled for a contrast-enhanced CT of the right leg at 1100. Reports numbness in both feet.',
    medications: [
      {
        id: 'mar3-med1',
        name: 'Insulin NPH plus Insulin Regular (mixed in one syringe)',
        dose: 'NPH 18 units + Regular 6 units',
        concentration: 'Both U-100 (100 units/mL)',
        route: 'SubQ',
        frequency: 'Daily before breakfast',
        indication: 'Basal and prandial glycemic control in type 2 diabetes',
        holdParameters: 'Hold and treat for a blood glucose under 70 mg/dL. Hold the prandial component if the patient is NPO or the meal is not going to be eaten.',
        isPRN: false,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Fingerstick blood glucose within 30 minutes before the dose',
          'Second-nurse independent double check of the insulin type, concentration, and units drawn',
          'Confirm the meal tray is present or arriving before giving the prandial component',
          'Use a U-100 insulin syringe only, never a tuberculin or 3 mL syringe',
          'Roll the cloudy NPH vial between the palms — never shake',
          'Rotate the subcutaneous site and document the site used'
        ],
        calculation: {
          needed: true,
          question: 'How many total units are in the syringe, and in what order are the two insulins drawn?',
          answer: 24,
          unit: 'units total in one U-100 syringe',
          work: '18 units NPH + 6 units Regular = 24 total units. Sequence: (1) inject 18 units of air into the NPH (cloudy) vial and withdraw the needle without drawing insulin, (2) inject 6 units of air into the Regular (clear) vial, (3) invert and withdraw 6 units of Regular, (4) withdraw 18 units of NPH to the 24 unit mark. CLEAR before CLOUDY — RN, Regular before NPH. Do not draw or give this dose yet: the breakfast tray is not at the bedside and a lispro correction dose is ordered for the same meal. Clarify the prandial plan with the provider first.'
        }
      },
      {
        id: 'mar3-med2',
        name: 'Insulin lispro (Humalog) correction scale',
        dose: '12 units for a blood glucose of 341-400 mg/dL',
        concentration: 'U-100 (100 units/mL)',
        route: 'SubQ',
        frequency: 'AC and HS per sliding scale',
        indication: 'Correction of hyperglycemia',
        holdParameters: 'Hold for a blood glucose under 70 mg/dL. Do not stack correction doses inside the 4 hour interval.',
        isPRN: false,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Match the actual fingerstick value to the correct scale row and read the units out loud',
          'Check for duplicate prandial coverage from the scheduled Regular insulin at the same meal',
          'Second-nurse independent double check',
          'Confirm the tray is present — lispro acts within 15 minutes',
          'Recheck glucose and assess for hypoglycemia at the expected peak of 1 to 2 hours'
        ],
        calculation: {
          needed: true,
          question: 'At a fingerstick of 342 mg/dL, what does the scale call for, and what total short/rapid-acting insulin would the patient receive if both this and the scheduled Regular insulin are given?',
          answer: 18,
          unit: 'units of combined rapid plus short-acting insulin',
          work: 'Scale row 341-400 = 12 units lispro. Scheduled Regular = 6 units. Combined mealtime coverage = 12 + 6 = 18 units of overlapping rapid and short-acting insulin at one meal. That overlap is what must be clarified before anything is given.'
        }
      },
      {
        id: 'mar3-med3',
        name: 'Potassium chloride extended-release',
        dose: '40 mEq',
        concentration: '20 mEq tablets',
        route: 'PO',
        frequency: 'Daily',
        indication: 'Hypokalemia (K+ 3.4 mEq/L)',
        holdParameters: 'Hold and notify for urine output under 30 mL/hr, oliguria or anuria, or a potassium level above 5.0 mEq/L.',
        isPRN: false,
        correctAction: 'give',
        requiredChecks: [
          'Verify adequate urine output before giving any potassium',
          'Confirm the most recent potassium level',
          'Give with food and a full glass of water to reduce GI irritation',
          'Never crush or allow chewing of an extended-release potassium tablet',
          'Monitor for GI upset, and for cardiac changes if the level is unstable'
        ],
        calculation: {
          needed: true,
          question: 'How many 20 mEq tablets deliver a 40 mEq dose?',
          answer: 2,
          unit: 'tablets',
          work: '40 mEq / 20 mEq per tablet = 2 tablets, swallowed whole with food and a full glass of water.'
        }
      },
      {
        id: 'mar3-med4',
        name: 'Metformin',
        dose: '1000 mg',
        concentration: '500 mg tablets',
        route: 'PO',
        frequency: 'BID with meals',
        indication: 'Type 2 diabetes mellitus',
        holdParameters: 'Hold before and for 48 hours after iodinated contrast administration. Contraindicated with eGFR under 30, acute kidney injury, hypoxemia, sepsis, or decompensated heart failure.',
        isPRN: false,
        correctAction: 'hold',
        requiredChecks: [
          'Check the procedure schedule for any contrast study',
          'Renal function (creatinine and eGFR)',
          'Assess for signs of lactic acidosis: hyperventilation, myalgia, malaise, unusual somnolence',
          'Give with meals when it is given, to reduce GI effects',
          'Monitor vitamin B12 on long-term therapy'
        ],
        calculation: {
          needed: true,
          question: 'How many 500 mg tablets equal a 1000 mg dose?',
          answer: 2,
          unit: 'tablets',
          work: '1000 mg / 500 mg per tablet = 2 tablets — but the dose must be HELD because of the contrast CT scheduled at 1100.'
        }
      }
    ],
    traps: [
      {
        id: 'mar3-trap-clear-before-cloudy',
        severity: 'critical',
        trigger: 'The order requires NPH and Regular insulin to be mixed in one syringe.',
        whatHappens: 'If the cloudy NPH is drawn first, NPH protamine contaminates the Regular insulin vial and converts part of that clear short-acting insulin into an intermediate-acting product. Every subsequent dose drawn from that vial has an unpredictable onset and duration, which produces both unexplained hyperglycemia and delayed hypoglycemia.',
        correctAction: 'Inject air into the NPH vial first WITHOUT withdrawing insulin, then inject air into the Regular vial, then draw the Regular (clear) insulin, then draw the NPH (cloudy). Clear before cloudy. RN — Regular before NPH. Administer the mixture within 5 minutes of preparing it.',
        teachingPoint: 'Only Regular insulin and rapid-acting analogs may be mixed with NPH. Insulin glargine and detemir are NEVER mixed with anything. NPH is the only cloudy insulin — roll it between your palms to resuspend it and never shake it, because shaking creates air bubbles that displace insulin volume.'
      },
      {
        id: 'mar3-trap-look-alike-insulin',
        severity: 'critical',
        trigger: 'The medication room stocks Humalog, Humulin R, and Humulin N vials with similar labels side by side.',
        whatHappens: 'Humalog (lispro, rapid) and Humulin R (Regular, short) are a classic look-alike/sound-alike pair, as are Humulin R and Humulin N. Substituting one for another changes onset, peak, and duration and causes either an unexpected hypoglycemic crash or uncontrolled hyperglycemia. Insulin is consistently among the top drugs involved in fatal medication errors.',
        correctAction: 'Read the vial label three times, confirm the exact insulin name and concentration against the MAR, and complete a second-nurse independent double check of the drug, the concentration, and the units drawn before administering.',
        teachingPoint: 'Independent means the second nurse verifies from the original order and reads the syringe themselves — you do not tell them what you drew. Insulin is a high-alert medication; the double check is a requirement, not a courtesy.'
      },
      {
        id: 'mar3-trap-tray-timing',
        severity: 'major',
        trigger: 'Rapid and short-acting insulin are due at 0730 but the breakfast tray does not arrive until approximately 0800.',
        whatHappens: 'Insulin lispro begins working within 15 minutes and peaks at 1 to 2 hours, so it must not be given until the tray is physically at the bedside. Regular insulin is correctly given about 30 minutes before the meal, so an 0730 dose for an 0800 tray is appropriately timed for the Regular component alone. The hazard here is the combination: 6 units of Regular plus a 12 unit lispro correction is 18 units of overlapping short and rapid-acting insulin aimed at one breakfast that has not arrived and that the patient may not finish.',
        correctAction: 'Confirm the tray is physically at the bedside and that the patient is going to eat before giving the prandial or correction insulin. If the tray is delayed, hold the rapid-acting correction and clarify the whole prandial plan, notify the provider or follow the unit protocol, recheck the glucose, and document.',
        teachingPoint: 'Insulin is a time-critical medication. The rule is simple: no tray, no rapid-acting insulin. If the patient becomes NPO, is going to a procedure, or refuses the meal after you have already given prandial insulin, monitor the glucose closely and be ready to treat hypoglycemia.'
      },
      {
        id: 'mar3-trap-duplicate-insulin',
        severity: 'major',
        trigger: 'Scheduled Regular insulin 6 units and a lispro correction scale calling for 12 units are both due at the same meal.',
        whatHappens: 'The patient would receive 18 units of overlapping rapid and short-acting insulin covering a single breakfast. Two mealtime insulins with overlapping action curves is duplicate therapy and a common cause of severe iatrogenic hypoglycemia several hours after breakfast.',
        correctAction: 'Do not administer both. Clarify with the provider which insulin is intended to cover the meal and which is the correction, and confirm whether the correction scale should be given in addition to or instead of the scheduled short-acting dose. Document the clarification.',
        teachingPoint: 'Reconcile the whole insulin regimen before you give any of it — basal, prandial, and correction. Ask whether the action curves overlap. Two short-acting insulins covering one meal almost always means an order that was never discontinued.'
      },
      {
        id: 'mar3-trap-metformin-contrast',
        severity: 'major',
        trigger: 'Metformin 1000 mg BID is due and a contrast-enhanced CT is scheduled for 1100.',
        whatHappens: 'Iodinated contrast can cause acute kidney injury. If renal clearance falls while metformin is on board, metformin accumulates and can cause lactic acidosis, which carries roughly a 50 percent mortality rate.',
        correctAction: 'Hold the metformin, notify the provider, and confirm the plan to resume no sooner than 48 hours after the contrast and only after renal function has been rechecked and confirmed stable. Document the hold and the notification.',
        teachingPoint: 'Metformin plus contrast equals hold. Teach the patient the early signs of lactic acidosis — hyperventilation, muscle aches, unusual fatigue or sleepiness, and abdominal discomfort — and to seek care immediately if they appear.'
      },
      {
        id: 'mar3-trap-kcl-route',
        severity: 'major',
        trigger: 'The MAR reads potassium chloride 40 mEq for a potassium of 3.4 mEq/L, and the patient has a patent peripheral IV.',
        whatHappens: 'A student who assumes the IV route, crushes the extended-release tablet, or gives it without checking urine output creates a serious hazard. Potassium chloride given IV push is uniformly fatal — it causes immediate cardiac arrest. A crushed extended-release potassium tablet dumps the entire dose at once and ulcerates the GI mucosa. Giving potassium to an oliguric patient causes hyperkalemia.',
        correctAction: 'Give by the ordered oral route only, swallowed whole with food and a full glass of water. Never crush or chew. Verify urine output above 30 mL/hr and a current potassium level first. IV potassium is ALWAYS diluted and infused on a pump, never pushed, at a maximum of 10 mEq/hr peripherally.',
        teachingPoint: 'Potassium chloride is a high-alert medication and one of the drugs most associated with fatal errors. Memorize the three absolutes: never IV push, always diluted, always on a pump. And "no pee, no K" — confirm urine output before any potassium dose.'
      },
      {
        id: 'mar3-trap-hypokalemia-insulin',
        severity: 'minor',
        trigger: 'Potassium is 3.4 mEq/L and the patient is about to receive 24 units of insulin.',
        whatHappens: 'Insulin drives potassium intracellularly along with glucose. Giving a substantial insulin dose to a patient who is already hypokalemic lowers the serum potassium further and can precipitate dysrhythmias, muscle weakness, and ileus.',
        correctAction: 'Note the interaction, give the ordered potassium replacement, and monitor the potassium and the cardiac rhythm. Report a falling potassium trend to the provider and anticipate more frequent electrolyte monitoring.',
        teachingPoint: 'Insulin, beta agonists, and sodium bicarbonate all shift potassium into the cell — which is exactly why insulin with dextrose is a treatment for hyperkalemia. Recognizing the same mechanism as a hazard in an already hypokalemic patient is the clinical-judgment step the rubric is looking for.'
      }
    ]
  },

  /* ---------------------------------------------------------------------- */
  {
    id: 'mar-4',
    difficulty: 'Hard',
    title: 'Anticoagulation gone wrong — supratherapeutic INR and suspected HIT',
    patient: {
      name: "O'Brien, Margaret",
      mrn: '0002288',
      age: 68,
      sex: 'Female',
      codeStatus: 'DNR (do not resuscitate), full treatment otherwise',
      allergies: ['sulfa (rash)'],
      admittingDx: 'Right lower extremity deep vein thrombosis with chronic atrial fibrillation',
      pmh: ['Atrial fibrillation', 'Osteoarthritis', 'GERD', 'Hypertension']
    },
    labs: {
      INR: '4.8 (goal 2.0 to 3.0)',
      'PT': '42 seconds',
      aPTT: '96 seconds',
      Hgb: '9.1 g/dL (was 11.4 on admission)',
      Platelets: '88,000/mm3 (was 210,000 three days ago)',
      Creatinine: '0.9 mg/dL'
    },
    vitals: {
      BP: '118/68',
      HR: '78 and irregularly irregular',
      RR: '18',
      Temp: '98.2 F oral',
      O2sat: '96% on room air'
    },
    currentTime: '0800',
    medTimes: ['0800', '1400', '1700', '2200'],
    ivAccess: 'Right forearm #20 gauge peripheral IV, patent',
    clinicalNote: 'Alert and oriented x4. New ecchymoses noted to both forearms. Reports gums bled "a lot" when brushing this morning. Reports one dark tarry stool overnight. Right calf remains edematous and tender. Rates calf pain 6/10. Ambulates with a walker; identified as a high fall risk.',
    medications: [
      {
        id: 'mar4-med1',
        name: 'Warfarin',
        dose: '5 mg',
        concentration: '2.5 mg tablets',
        route: 'PO',
        frequency: 'Daily at 1700',
        indication: 'Anticoagulation for DVT and atrial fibrillation',
        holdParameters: 'Hold and notify the provider for an INR above the therapeutic goal or any active bleeding.',
        isPRN: false,
        correctAction: 'hold',
        requiredChecks: [
          'Current INR before every dose',
          'Assess for bleeding: gums, urine, stool, bruising, headache, and level of consciousness',
          'Verify vitamin K (phytonadione) availability as the antidote',
          'Review interacting drugs, herbals, and dietary vitamin K consistency',
          'Confirm the daily dose against the most recent provider adjustment'
        ],
        calculation: {
          needed: true,
          question: 'How many 2.5 mg tablets equal a 5 mg dose?',
          answer: 2,
          unit: 'tablets',
          work: '5 mg / 2.5 mg per tablet = 2 tablets — but the dose must be HELD because the INR is 4.8 with active bleeding.'
        }
      },
      {
        id: 'mar4-med2',
        name: 'Heparin',
        dose: '5000 units',
        concentration: '10,000 units/mL',
        route: 'SubQ',
        frequency: 'Q8h',
        indication: 'Anticoagulation bridge',
        holdParameters: 'Hold and notify for platelets under 100,000/mm3, a drop of 50 percent or more from baseline, active bleeding, or a supratherapeutic aPTT.',
        isPRN: false,
        correctAction: 'hold',
        requiredChecks: [
          'Platelet count and trend before every dose',
          'aPTT and anti-Xa level per protocol',
          'Assess all sites for bleeding and hematoma',
          'Second-nurse independent double check — heparin is high alert',
          'Confirm protamine sulfate availability as the antidote',
          'Rotate abdominal sites at least 2 inches from the umbilicus, do not aspirate, do not massage'
        ],
        calculation: {
          needed: true,
          question: 'How many mL deliver 5000 units from a 10,000 units/mL vial?',
          answer: 0.5,
          unit: 'mL',
          work: 'Desired / Have x Quantity = 5000 units / 10,000 units x 1 mL = 0.5 mL in a 1 mL syringe with a 25 to 27 gauge, 5/8 inch needle — but the dose must be HELD for the platelet drop.'
        }
      },
      {
        id: 'mar4-med3',
        name: 'Clopidogrel',
        dose: '75 mg',
        concentration: '75 mg tablets',
        route: 'PO',
        frequency: 'Daily',
        indication: 'Antiplatelet therapy (home medication, continued on admission)',
        holdParameters: 'Hold and notify for active bleeding or a significant drop in hemoglobin or platelets.',
        isPRN: false,
        correctAction: 'hold',
        requiredChecks: [
          'Assess for bleeding from any site',
          'Hemoglobin, hematocrit, and platelet trend',
          'Review the full antithrombotic regimen for additive bleeding risk',
          'Confirm with the provider whether the home antiplatelet should continue during anticoagulation',
          'Note that there is no reversal agent'
        ],
        calculation: {
          needed: true,
          question: 'How many 75 mg tablets equal a 75 mg dose?',
          answer: 1,
          unit: 'tablet',
          work: '75 mg / 75 mg per tablet = 1 tablet — but the dose must be HELD given the INR of 4.8, the falling hemoglobin, and the active bleeding.'
        }
      },
      {
        id: 'mar4-med4',
        name: 'Percocet (oxycodone 5 mg / acetaminophen 325 mg)',
        dose: '1 to 2 tablets',
        concentration: '5 mg / 325 mg tablets',
        route: 'PO',
        frequency: 'Q6h PRN',
        indication: 'Moderate pain',
        holdParameters: 'Hold for respiratory rate under 12 or excessive sedation. Do not exceed 3 g of acetaminophen per 24 hours in an older adult.',
        isPRN: true,
        correctAction: 'give',
        requiredChecks: [
          'Pain rating, location, and quality before administration',
          'Respiratory rate and sedation level before and after',
          'Total 24-hour acetaminophen from ALL sources',
          'Bowel function — start a bowel regimen with any scheduled opioid',
          'Fall precautions before ambulating with the walker',
          'Reassess pain 30 to 60 minutes after an oral opioid and document effectiveness'
        ],
        calculation: {
          needed: true,
          question: 'If 1 tablet is given every 6 hours around the clock, how much acetaminophen does the patient receive in 24 hours, and is that within the limit for a 68-year-old?',
          answer: 1300,
          unit: 'mg of acetaminophen per 24 hours',
          work: '24 hours / 6 hours = 4 doses. 4 doses x 325 mg = 1300 mg per day, which is well within the 3 g ceiling. Note that at 2 tablets per dose the total becomes 2600 mg, still under the ceiling but leaving little room for any other acetaminophen-containing product.'
        }
      }
    ],
    traps: [
      {
        id: 'mar4-trap-inr',
        severity: 'critical',
        trigger: 'The INR is 4.8 against a goal of 2.0 to 3.0, and the patient reports bleeding gums and a dark tarry stool.',
        whatHappens: 'Giving another 5 mg of warfarin on top of a supratherapeutic INR with evidence of active bleeding drives the INR higher and can produce a fatal gastrointestinal or intracranial hemorrhage. The dark tarry stool is melena — an upper GI bleed that already explains the hemoglobin drop from 11.4 to 9.1.',
        correctAction: 'Hold the warfarin. Notify the provider immediately and report the INR, the melena, the bleeding gums, the new ecchymoses, and the hemoglobin drop. Anticipate orders for vitamin K (phytonadione), possible prothrombin complex concentrate or fresh frozen plasma, a type and screen, and serial hemoglobin. Institute bleeding precautions: soft toothbrush, electric razor, no rectal temperatures, no intramuscular injections, and fall prevention. Document the hold and the notification.',
        teachingPoint: 'Never give warfarin without looking at the current INR. Goal is 2.0 to 3.0 for most indications and 2.5 to 3.5 for a mechanical mitral valve. The antidote is vitamin K (phytonadione). A dark, tarry stool is melena until proven otherwise, and it is a report-immediately finding in any anticoagulated patient.'
      },
      {
        id: 'mar4-trap-hit',
        severity: 'critical',
        trigger: 'Platelets have fallen from 210,000 to 88,000 over three days while the patient has been on subcutaneous heparin.',
        whatHappens: 'A drop of more than 50 percent from baseline occurring 5 to 10 days after heparin exposure is the hallmark of heparin-induced thrombocytopenia. HIT is paradoxically PROTHROMBOTIC — despite the low platelets, the patient is at high risk for new arterial and venous clots, limb loss, and death. Giving another heparin dose worsens it.',
        correctAction: 'Hold the heparin and notify the provider immediately. Anticipate that ALL heparin will be stopped, including flushes and heparin-coated catheters, and that a non-heparin anticoagulant such as argatroban will be substituted. Anticipate HIT antibody testing. Do not simply transfuse platelets. Assess all extremities for new signs of thrombosis.',
        teachingPoint: 'Check a platelet count before every heparin dose and know the baseline. The 50 percent drop rule and the 5 to 10 day timing are the classic HIT pattern. Protamine sulfate reverses heparin bleeding but does not treat HIT — the treatment is stopping all heparin and starting a direct thrombin inhibitor.'
      },
      {
        id: 'mar4-trap-triple-therapy',
        severity: 'major',
        trigger: 'Warfarin, heparin, and clopidogrel are all active on the same MAR.',
        whatHappens: 'Two anticoagulants plus an antiplatelet is triple antithrombotic therapy. The bleeding risk is multiplicative, not additive, and in a patient already at INR 4.8 with melena and a falling hemoglobin it is untenable.',
        correctAction: 'Hold the clopidogrel along with the warfarin and heparin and reconcile the entire antithrombotic regimen with the provider. Clopidogrel is often a continued home medication that nobody reassessed on admission. Note that clopidogrel has no reversal agent; the only option is platelet transfusion, which is of limited benefit while the drug is still circulating.',
        teachingPoint: 'Medication reconciliation is a safety check, not paperwork. Scan the whole MAR for drugs that share a mechanism or an adverse effect: multiple anticoagulants, two QT-prolonging drugs, two nephrotoxins, two sedatives. Reviewing drug interactions is a scored item under Special Precautions.'
      },
      {
        id: 'mar4-trap-heparin-site',
        severity: 'major',
        trigger: 'A subcutaneous heparin dose must be given (in a scenario where it is not held).',
        whatHappens: 'Aspirating, massaging the site, or using the wrong site or angle causes hematoma formation and unnecessary tissue trauma. Massage in particular disperses the drug into the tissue and produces large painful bruises, which are already a concern in a patient with new ecchymoses.',
        correctAction: 'Use the abdomen at least 2 inches from the umbilicus, rotate sites, pinch the skin fold, insert at 45 to 90 degrees with a 25 to 27 gauge 5/8 inch needle, do NOT aspirate, inject slowly, withdraw, apply gentle pressure, and do NOT massage. Activate the safety device and dispose of the sharp immediately.',
        teachingPoint: 'The rubric explicitly scores "does NOT massage heparin sites" under injection technique. The same rule applies to enoxaparin, and with a prefilled enoxaparin syringe you also do not expel the air bubble because it is part of the measured dose.'
      },
      {
        id: 'mar4-trap-melena',
        severity: 'major',
        trigger: 'The clinical note contains "one dark tarry stool overnight" alongside a hemoglobin that dropped from 11.4 to 9.1.',
        whatHappens: 'A student focused only on medications reads past the note and never connects the melena to the falling hemoglobin and the supratherapeutic INR. The patient is actively bleeding into the GI tract and needs intervention, not another dose of anticoagulant.',
        correctAction: 'Recognize melena, obtain vital signs including orthostatics if the patient is stable enough, report to the provider immediately, hold all anticoagulants and antiplatelets, and anticipate a type and screen, serial hemoglobin, and possible transfusion or endoscopy.',
        teachingPoint: 'Pre-administration assessment includes reading the note, not just the vital signs and the MAR. Recognize the bleeding vocabulary: melena (dark tarry stool, upper GI), hematemesis or coffee-ground emesis, hematuria, epistaxis, and any new headache or confusion in an anticoagulated patient, which suggests intracranial hemorrhage.'
      },
      {
        id: 'mar4-trap-acetaminophen-warfarin',
        severity: 'minor',
        trigger: 'Percocet is available PRN, up to 2 tablets Q6h, in a patient on warfarin.',
        whatHappens: 'Regular acetaminophen use potentiates warfarin and raises the INR, and the acetaminophen in Percocet is easy to overlook because the order is thought of as "the pain pill." Chronic high-dose acetaminophen in a 68-year-old also risks hepatotoxicity.',
        correctAction: 'Give 1 tablet for the 6/10 calf pain rather than defaulting to 2, track the running 24-hour acetaminophen total from all sources, keep the total under 3 g in an older adult, and report the ongoing acetaminophen use as a contributor to the elevated INR.',
        teachingPoint: 'Always name the hidden ingredients in combination analgesics: Percocet and Norco both contain 325 mg of acetaminophen per tablet. Instruct the patient never to add over-the-counter Tylenol on top, and never to take NSAIDs such as ibuprofen or naproxen while anticoagulated.'
      },
      {
        id: 'mar4-trap-sulfa-allergy',
        severity: 'minor',
        trigger: 'The allergy list reads "sulfa (rash)" and the patient may be ordered a diuretic or an antibiotic later in the shift.',
        whatHappens: 'A student who does not note the sulfa allergy may accept a later order for a sulfonamide antibiotic, or a thiazide or loop diuretic, without screening it. Sulfa antibiotics can also raise the INR in a warfarin patient.',
        correctAction: 'Document the allergy and the specific reaction, verify the allergy band, and screen every new order against it. Ask specifically what the reaction was — a rash is a very different clinical risk from angioedema or Stevens-Johnson syndrome, and that distinction changes what alternatives are safe.',
        teachingPoint: 'Recording WHAT the reaction was is part of a complete allergy check. Also distinguish a true allergy from an intolerance: nausea with codeine is an intolerance, hives and wheezing are an allergy. Both belong in the chart, but they carry very different clinical weight.'
      }
    ]
  },

  /* ---------------------------------------------------------------------- */
  {
    id: 'mar-5',
    difficulty: 'Hard',
    title: 'MRSA bacteremia — vancomycin trough, rising creatinine, and IV incompatibility',
    patient: {
      name: 'Washington, Darnell',
      mrn: '0009840',
      age: 62,
      sex: 'Male',
      codeStatus: 'Full code',
      allergies: ['No known drug allergies'],
      admittingDx: 'MRSA bacteremia with left tibial osteomyelitis',
      pmh: ['Chronic kidney disease stage 3', 'Hypertension', 'Type 2 diabetes mellitus', 'Peripheral vascular disease']
    },
    labs: {
      'Vancomycin trough (drawn 0530)': '24 mcg/mL (goal 15 to 20)',
      Creatinine: '2.1 mg/dL (baseline 1.3)',
      BUN: '38 mg/dL',
      'K+': '4.8 mEq/L',
      WBC: '14.1 K/uL',
      'Urine output': '25 mL/hr over the last 8 hours'
    },
    vitals: {
      BP: '132/78',
      HR: '92',
      RR: '18',
      Temp: '100.4 F oral',
      O2sat: '96% on room air'
    },
    currentTime: '0600',
    medTimes: ['0600', '1000', '1400', '1800'],
    ivAccess: 'Right upper arm PICC, double lumen, both lumens patent with blood return; peripheral #20 left forearm',
    clinicalNote: 'Alert and oriented x4. Left lower leg wound with purulent drainage, dressing changed at 0500. Reports left leg pain 5/10. Denies tinnitus but states "things sound a little muffled today." Urine output has declined over the shift. Weight up 2.1 kg since admission. Maintenance IV of lactated Ringer at 75 mL/hr infusing through the peripheral line.',
    medications: [
      {
        id: 'mar5-med1',
        name: 'Vancomycin',
        dose: '1.25 g',
        concentration: '1.25 g in 250 mL 0.9% sodium chloride',
        route: 'IV piggyback',
        frequency: 'Q12h',
        indication: 'MRSA bacteremia and osteomyelitis',
        holdParameters: 'Hold and notify for a trough above the therapeutic goal, a rising creatinine, or signs of nephrotoxicity or ototoxicity.',
        isPRN: false,
        correctAction: 'hold',
        requiredChecks: [
          'Trough level result and the time it was drawn relative to the dose',
          'Creatinine, BUN, and urine output trend',
          'Assess hearing changes, tinnitus, and vertigo',
          'Verify the minimum infusion time of 60 minutes per gram',
          'Assess the IV site and confirm patency — vancomycin is a vesicant',
          'Monitor for vancomycin infusion reaction: flushing of the face, neck, and upper torso'
        ],
        calculation: {
          needed: true,
          question: 'If this dose were given, what is the minimum infusion time and the resulting pump rate for 250 mL?',
          answer: 167,
          unit: 'mL/hr (rounded)',
          work: 'Minimum 60 minutes per gram: 1.25 g x 60 min = 75 minutes, and practice is to round up to 90 minutes for a dose above 1 g. Rate = 250 mL / 1.5 hr = 166.7, rounded to 167 mL/hr. The dose must nonetheless be HELD because the trough is 24 mcg/mL and the creatinine has risen from 1.3 to 2.1.'
        }
      },
      {
        id: 'mar5-med2',
        name: 'Cefazolin',
        dose: '1 g',
        concentration: '1 g in 100 mL 0.9% sodium chloride',
        route: 'IV piggyback',
        frequency: 'Q8h',
        indication: 'Adjunct antibiotic coverage',
        holdParameters: 'Hold and notify for hypersensitivity signs. Dose adjustment is required in renal impairment.',
        isPRN: false,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Screen for penicillin and cephalosporin allergy',
          'Review renal dosing given the creatinine of 2.1',
          'Check for duplicate cephalosporin therapy on the MAR',
          'Infuse over 30 minutes and monitor the site',
          'Verify compatibility with any co-infusing solution'
        ],
        calculation: {
          needed: true,
          question: 'What pump rate delivers 100 mL over 30 minutes?',
          answer: 200,
          unit: 'mL/hr',
          work: '100 mL / 0.5 hr = 200 mL/hr.'
        }
      },
      {
        id: 'mar5-med3',
        name: 'Ceftriaxone',
        dose: '1 g',
        concentration: '1 g in 100 mL 0.9% sodium chloride',
        route: 'IV piggyback',
        frequency: 'Daily',
        indication: 'Broad-spectrum coverage (ordered on admission, never discontinued)',
        holdParameters: 'Do not administer with or through a line running any calcium-containing solution, including lactated Ringer.',
        isPRN: false,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Verify IV compatibility with every co-infusing fluid — lactated Ringer contains calcium',
          'Check the MAR for duplicate cephalosporin coverage with cefazolin',
          'Screen for penicillin and cephalosporin allergy',
          'Infuse over 30 minutes',
          'Flush the line before and after with normal saline'
        ],
        calculation: {
          needed: true,
          question: 'What pump rate delivers 100 mL over 30 minutes?',
          answer: 200,
          unit: 'mL/hr',
          work: '100 mL / 0.5 hr = 200 mL/hr — but the compatibility problem with the running lactated Ringer and the duplicate cephalosporin coverage must be resolved first.'
        }
      },
      {
        id: 'mar5-med4',
        name: 'Furosemide',
        dose: '40 mg',
        concentration: '10 mg/mL',
        route: 'IV push',
        frequency: 'Daily',
        indication: 'Fluid overload, 2.1 kg weight gain',
        holdParameters: 'Hold and notify for a systolic blood pressure under 90, worsening renal function, or a potassium under 3.5 mEq/L.',
        isPRN: false,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Blood pressure before and after',
          'Potassium, sodium, and magnesium levels',
          'Daily weight and strict intake and output',
          'Assess hearing — ototoxicity risk is compounded by concurrent vancomycin',
          'Push no faster than 20 mg per minute'
        ],
        calculation: {
          needed: true,
          question: 'How many mL deliver 40 mg from a 10 mg/mL vial, and over what minimum time must it be pushed?',
          answer: 4,
          unit: 'mL over at least 2 minutes',
          work: '40 mg / 10 mg x 1 mL = 4 mL. Maximum rate is 20 mg per minute, so 40 mg requires a minimum of 2 minutes. The rising creatinine, declining urine output, and concurrent vancomycin ototoxicity risk all warrant clarification before giving it.'
        }
      }
    ],
    traps: [
      {
        id: 'mar5-trap-trough',
        severity: 'critical',
        trigger: 'The vancomycin trough is 24 mcg/mL against a goal of 15 to 20, and the next dose is due at 0600.',
        whatHappens: 'A supratherapeutic vancomycin level with a creatinine that has already risen from 1.3 to 2.1 means the drug is accumulating and causing acute kidney injury. Giving the next dose worsens the nephrotoxicity and adds ototoxicity risk, which may become permanent hearing loss.',
        correctAction: 'Hold the dose and notify the provider with the trough result, the creatinine trend, the urine output of 25 mL/hr, and the report of muffled hearing. Anticipate a dose or interval adjustment, a repeat level, and possibly a pharmacy-driven pharmacokinetic consult. Document the hold and the notification.',
        teachingPoint: 'Never hang a vancomycin dose without looking at the most recent trough and renal function. Trough goal is 15 to 20 mcg/mL for serious MRSA infections such as bacteremia, endocarditis, osteomyelitis, meningitis, and pneumonia. Levels above 20 correlate directly with nephrotoxicity.'
      },
      {
        id: 'mar5-trap-ceftriaxone-calcium',
        severity: 'critical',
        trigger: 'Ceftriaxone is ordered while lactated Ringer is infusing at 75 mL/hr.',
        whatHappens: 'Ceftriaxone precipitates with calcium, and lactated Ringer contains calcium. Co-administration through the same line forms an insoluble ceftriaxone-calcium precipitate that can embolize to the lungs and kidneys. In neonates this has been fatal, and the combination is absolutely contraindicated in that population.',
        correctAction: 'Do not run ceftriaxone into a line carrying lactated Ringer or any calcium-containing solution. Use a separate lumen of the PICC, or stop the lactated Ringer and flush the line thoroughly with normal saline before and after. Verify compatibility in an IV reference or with pharmacy before hanging any piggyback.',
        teachingPoint: 'Checking IV compatibility is an explicit expectation for the IV route. Other classics: phenytoin precipitates in ANY dextrose solution and must be given in normal saline only; blood products run with normal saline only, never with lactated Ringer or dextrose. When in doubt, call pharmacy and flush between drugs.'
      },
      {
        id: 'mar5-trap-infusion-rate',
        severity: 'major',
        trigger: 'Vancomycin 1.25 g in 250 mL is hung and the student sets a convenient pump rate.',
        whatHappens: 'Infusing vancomycin too rapidly triggers a histamine-mediated infusion reaction — flushing and erythema of the face, neck, and upper torso, pruritus, and sometimes hypotension. This is a rate-related reaction, not a true allergy, and it is entirely preventable.',
        correctAction: 'Infuse a minimum of 60 minutes per gram; for 1.25 g use at least 90 minutes, which is 167 mL/hr for a 250 mL bag. Always use a pump. If flushing develops, stop the infusion, notify the provider, anticipate an antihistamine, and restart at a slower rate once the reaction resolves.',
        teachingPoint: 'Know the rate rules for the drugs you give. Vancomycin at least 60 minutes per gram, furosemide no faster than 20 mg per minute, phenytoin no faster than 50 mg per minute, digoxin over at least 5 minutes, and potassium chloride never by IV push.'
      },
      {
        id: 'mar5-trap-aki',
        severity: 'major',
        trigger: 'Creatinine has risen from 1.3 to 2.1, BUN is 38, and urine output has fallen to 25 mL/hr.',
        whatHappens: 'The patient has acute kidney injury layered on chronic kidney disease stage 3. Every renally cleared drug on the MAR now accumulates, and both vancomycin and furosemide are contributing. A student who gives the scheduled doses because they are due deepens the injury.',
        correctAction: 'Report the creatinine trend and the urine output of 25 mL/hr, which is below the 30 mL/hr threshold. Review every medication on the MAR for renal dosing, hold the nephrotoxic agents pending provider direction, maintain strict intake and output, and obtain a daily weight.',
        teachingPoint: 'Urine output under 30 mL/hr is a reportable finding on its own. Screen for the nephrotoxic combinations: vancomycin plus an aminoglycoside, vancomycin plus piperacillin-tazobactam, any of these plus an NSAID or IV contrast. Renal function determines the dose of a large share of hospital medications.'
      },
      {
        id: 'mar5-trap-ototoxicity',
        severity: 'major',
        trigger: 'The patient states that "things sound a little muffled today" while receiving both vancomycin and IV furosemide.',
        whatHappens: 'Vancomycin and loop diuretics are each ototoxic, and together the risk is compounded. Furosemide pushed rapidly is the classic cause of transient or permanent hearing loss. Muffled hearing is an early warning sign that is easy to dismiss as an offhand comment.',
        correctAction: 'Treat the comment as an assessment finding and report it. Hold the vancomycin, push the furosemide no faster than 20 mg per minute if it is given at all, and ask directly about tinnitus, vertigo, and hearing changes at every assessment.',
        teachingPoint: 'Ototoxicity is often permanent, and it presents first as tinnitus, fullness, or muffled hearing before any measurable loss. The classic ototoxic drug groups are aminoglycosides, vancomycin, loop diuretics, high-dose salicylates, and cisplatin.'
      },
      {
        id: 'mar5-trap-duplicate-cephalosporin',
        severity: 'major',
        trigger: 'Both cefazolin Q8h and ceftriaxone daily are active on the MAR.',
        whatHappens: 'Two cephalosporins provide no additional benefit, increase the antibiotic burden on already injured kidneys, and raise the risk of Clostridioides difficile infection. The ceftriaxone is a leftover empiric admission order that was never discontinued after cultures returned MRSA.',
        correctAction: 'Question the duplication with the provider or pharmacy before hanging either antibiotic. Review the culture and sensitivity results and confirm which agents remain indicated. Document the clarification.',
        teachingPoint: 'Antibiotic stewardship is a nursing responsibility. When cultures return, ask whether the empiric agents are still needed. Duplicate coverage within the same drug class is a red flag on any medication reconciliation.'
      },
      {
        id: 'mar5-trap-trough-timing',
        severity: 'minor',
        trigger: 'The trough was drawn at 0530 and the dose is due at 0600.',
        whatHappens: 'A trough must be drawn within 30 minutes BEFORE the next scheduled dose, and typically before the fourth dose once steady state is reached. If the level is drawn at the wrong time, or if the nurse gives the dose before the blood is collected, the result is uninterpretable and the entire regimen is adjusted on bad data.',
        correctAction: 'Verify that the level was drawn at the correct time relative to the dose and that it was drawn from a site not used to infuse vancomycin. Coordinate with the laboratory so the draw happens before the dose, and never give the dose until the specimen is collected.',
        teachingPoint: 'Peak and trough timing is a nursing responsibility. Trough is drawn within 30 minutes before the next dose; a peak, when ordered, is drawn 30 to 60 minutes after the infusion ends. Draw from the opposite arm or a lumen never used for the drug, and document the exact draw time.'
      }
    ]
  },

  /* ---------------------------------------------------------------------- */
  {
    id: 'mar-6',
    difficulty: 'Hard',
    title: 'Polypharmacy in an 84-year-old — digoxin toxicity and Beers criteria',
    patient: {
      name: 'Kowalski, Helen',
      mrn: '0003357',
      age: 84,
      sex: 'Female',
      codeStatus: 'DNR / DNI',
      allergies: ['codeine (nausea and vomiting — reported as intolerance)', 'latex'],
      admittingDx: 'Acute on chronic heart failure exacerbation with atrial fibrillation',
      pmh: ['Atrial fibrillation', 'Chronic heart failure with reduced ejection fraction', 'Hypertension', 'Hypothyroidism', 'Chronic kidney disease stage 3', 'Osteoarthritis', 'Chronic constipation', 'Insomnia']
    },
    labs: {
      'Digoxin level': '2.4 ng/mL (therapeutic 0.5 to 2.0)',
      'K+': '3.1 mEq/L',
      'Mg++': '1.4 mg/dL',
      'Na+': '132 mEq/L',
      Creatinine: '1.6 mg/dL',
      TSH: '0.2 mIU/L (low)',
      'Blood glucose': '96 mg/dL'
    },
    vitals: {
      BP: '104/58',
      HR: '52 apical, irregularly irregular',
      RR: '20',
      Temp: '97.6 F oral',
      O2sat: '95% on 2 L nasal cannula'
    },
    currentTime: '0900',
    medTimes: ['0900', '1300', '1700', '2100'],
    ivAccess: 'Left hand #22 gauge peripheral IV, saline locked',
    clinicalNote: 'New confusion overnight per night shift; oriented to person and place only this morning, baseline was alert and oriented x4. Reports nausea and has eaten almost nothing for two days. States she is "seeing yellow-green rings around the lights." Ambulates with a rolling walker; had a near-fall going to the bathroom at 0300. Breakfast tray at the bedside, untouched. Takes 11 scheduled medications.',
    medications: [
      {
        id: 'mar6-med1',
        name: 'Digoxin',
        dose: '0.125 mg',
        concentration: '0.125 mg tablets',
        route: 'PO',
        frequency: 'Daily',
        indication: 'Rate control in atrial fibrillation and heart failure',
        holdParameters: 'Hold and notify for an apical pulse under 60, a digoxin level above 2.0 ng/mL, hypokalemia, or any sign of toxicity.',
        isPRN: false,
        correctAction: 'hold',
        requiredChecks: [
          'Apical pulse for a full 60 seconds',
          'Current digoxin level',
          'Potassium and magnesium levels',
          'Renal function',
          'Assess for toxicity: anorexia, nausea, vomiting, visual halos or yellow-green vision, confusion, new dysrhythmia',
          'Confirm digoxin immune Fab availability as the antidote'
        ],
        calculation: {
          needed: true,
          question: 'How many 0.125 mg tablets equal a 0.125 mg dose?',
          answer: 1,
          unit: 'tablet',
          work: '0.125 mg / 0.125 mg per tablet = 1 tablet — but the dose must be HELD. Note the leading zero in 0.125 mg; writing it as .125 mg risks being misread as 125 mg, a thousandfold error.'
        }
      },
      {
        id: 'mar6-med2',
        name: 'Furosemide',
        dose: '40 mg',
        concentration: '40 mg tablets',
        route: 'PO',
        frequency: 'Daily',
        indication: 'Heart failure, fluid management',
        holdParameters: 'Hold and notify for a systolic blood pressure under 100, a potassium under 3.5 mEq/L, or worsening renal function.',
        isPRN: false,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Blood pressure — currently 104/58',
          'Potassium (3.1) and magnesium (1.4), both low',
          'Daily weight and strict intake and output',
          'Renal function and urine output',
          'Assess for orthostatic hypotension given the near-fall'
        ],
        calculation: {
          needed: true,
          question: 'How many 40 mg tablets equal a 40 mg dose?',
          answer: 1,
          unit: 'tablet',
          work: '1 tablet — but the hypokalemia, hypomagnesemia, borderline blood pressure, and digoxin toxicity all require clarification before giving another loop diuretic dose.'
        }
      },
      {
        id: 'mar6-med3',
        name: 'Levothyroxine',
        dose: '88 mcg',
        concentration: '88 mcg tablets',
        route: 'PO',
        frequency: 'Daily',
        indication: 'Hypothyroidism',
        holdParameters: 'Notify the provider for signs of over-replacement including tachycardia, palpitations, weight loss, heat intolerance, tremor, and insomnia.',
        isPRN: false,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Give on an empty stomach, 30 to 60 minutes before breakfast, at the same time daily',
          'Separate by at least 4 hours from calcium, iron, antacids, and fiber supplements',
          'Current TSH result',
          'Apical pulse and rhythm — excess thyroid hormone worsens atrial fibrillation',
          'Confirm the exact strength; levothyroxine has a narrow therapeutic index and many strengths'
        ],
        calculation: {
          needed: true,
          question: 'How many 88 mcg tablets equal an 88 mcg dose?',
          answer: 1,
          unit: 'tablet',
          work: '1 tablet. The dose is correct, but the TSH of 0.2 indicates over-replacement and the tray at the bedside creates a timing and absorption problem — both need to be addressed before this dose.'
        }
      },
      {
        id: 'mar6-med4',
        name: 'Zolpidem',
        dose: '10 mg',
        concentration: '10 mg tablets',
        route: 'PO',
        frequency: 'QHS PRN',
        indication: 'Insomnia',
        holdParameters: 'Hold for confusion, oversedation, or an unsafe mobility status.',
        isPRN: true,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Assess mental status and fall risk',
          'Verify the dose against geriatric recommendations — 5 mg maximum for an older adult and for women',
          'Confirm 7 to 8 hours of sleep opportunity remain',
          'Review the MAR for other sedating medications',
          'Institute fall precautions: bed low, call light in reach, non-skid footwear, frequent rounding'
        ],
        calculation: {
          needed: false,
          question: 'No calculation required — the clinical question is whether the dose is appropriate for an 84-year-old woman at all.',
          answer: 5,
          unit: 'mg (recommended maximum for an older adult)',
          work: 'The immediate-release geriatric maximum is 5 mg. The ordered 10 mg is double that and appears on the Beers criteria list of medications to avoid in older adults.'
        }
      },
      {
        id: 'mar6-med5',
        name: 'Potassium chloride',
        dose: '20 mEq',
        concentration: '20 mEq extended-release tablets',
        route: 'PO',
        frequency: 'Daily',
        indication: 'Hypokalemia (K+ 3.1 mEq/L)',
        holdParameters: 'Hold and notify for urine output under 30 mL/hr or a potassium above 5.0 mEq/L.',
        isPRN: false,
        correctAction: 'give',
        requiredChecks: [
          'Verify adequate urine output before giving',
          'Confirm the current potassium level',
          'Check the magnesium level — hypokalemia will not correct while magnesium is low',
          'Give with food and a full glass of water',
          'Swallow whole — never crush an extended-release potassium tablet'
        ],
        calculation: {
          needed: true,
          question: 'How many 20 mEq extended-release tablets equal a 20 mEq dose?',
          answer: 1,
          unit: 'tablet',
          work: '1 tablet, swallowed whole with food and a full glass of water. Never crushed, never chewed, and never given IV push.'
        }
      },
      {
        id: 'mar6-med6',
        name: 'Docusate sodium',
        dose: '100 mg',
        concentration: '100 mg capsules',
        route: 'PO',
        frequency: 'BID',
        indication: 'Prevention of constipation',
        holdParameters: 'Hold and notify for abdominal pain, nausea and vomiting of unclear cause, or suspected bowel obstruction.',
        isPRN: false,
        correctAction: 'clarify-order',
        requiredChecks: [
          'Assess bowel sounds and the date of the last bowel movement',
          'Assess the nausea before adding anything by mouth',
          'Encourage fluid intake — a stool softener requires water to work',
          'Assess for abdominal distention'
        ],
        calculation: {
          needed: true,
          question: 'How many 100 mg capsules equal a 100 mg dose?',
          answer: 1,
          unit: 'capsule',
          work: '1 capsule with a full glass of water — but the new nausea, anorexia, and confusion should be evaluated before adding oral medications that are not urgent.'
        }
      }
    ],
    traps: [
      {
        id: 'mar6-trap-dig-toxicity',
        severity: 'critical',
        trigger: 'Digoxin level 2.4 ng/mL, apical HR 52, potassium 3.1, plus nausea, anorexia, new confusion, and yellow-green halos around lights.',
        whatHappens: 'This is textbook digoxin toxicity — every classic sign is present at once. Administering another dose deepens the toxicity and can precipitate life-threatening bradydysrhythmias, heart block, or ventricular dysrhythmias. The confusion is being caused by the drug, not by "sundowning" or dementia.',
        correctAction: 'HOLD the digoxin. Notify the provider immediately with the level, the apical rate of 52, the potassium of 3.1, and the visual and neurologic symptoms. Anticipate a 12-lead ECG, continuous cardiac monitoring, potassium and magnesium replacement, and possibly digoxin immune Fab. Document the hold and the notification.',
        teachingPoint: 'Memorize the digoxin toxicity picture: GI first (anorexia, nausea, vomiting), then visual (yellow-green halos, blurred vision), then neurologic (confusion, weakness, fatigue), then cardiac (bradycardia, any new dysrhythmia). Therapeutic range 0.5 to 2.0 ng/mL. Antidote: digoxin immune Fab (Digibind, DigiFab). In an older adult, new confusion is a medication side effect until proven otherwise.'
      },
      {
        id: 'mar6-trap-hypokalemia-dig',
        severity: 'critical',
        trigger: 'Potassium is 3.1 mEq/L in a patient on both digoxin and a loop diuretic.',
        whatHappens: 'Hypokalemia dramatically potentiates digoxin toxicity because potassium and digoxin compete for the same binding site on the sodium-potassium ATPase pump. A patient can develop full toxicity at a "therapeutic" digoxin level when the potassium is low. Furosemide is actively driving the potassium down.',
        correctAction: 'Give the ordered potassium replacement, report the potassium of 3.1 together with the digoxin level of 2.4, hold the digoxin, and clarify whether the furosemide should also be held. Recheck the potassium after replacement.',
        teachingPoint: 'Digoxin plus a loop diuretic is one of the most dangerous common combinations in geriatrics. Always check the potassium before giving digoxin. Teach patients on both drugs to eat potassium-rich foods and to report nausea, visual changes, or a slow pulse immediately.'
      },
      {
        id: 'mar6-trap-apical-pulse',
        severity: 'critical',
        trigger: 'The apical heart rate is 52 and irregularly irregular, and the digoxin dose is due.',
        whatHappens: 'The hold parameter of an apical pulse under 60 is already met. Giving digoxin at an apical rate of 52 further slows atrioventricular conduction and can produce symptomatic bradycardia, high-grade heart block, or asystole. A student who counts a radial pulse for 15 seconds in an irregularly irregular rhythm will also undercount or overcount because of the pulse deficit.',
        correctAction: 'Auscultate the apical pulse at the fifth intercostal space, midclavicular line, for a FULL 60 seconds. Document rate, rhythm, and regularity. Hold the dose, notify the provider, and document the hold.',
        teachingPoint: 'In atrial fibrillation a radial pulse is unreliable because not every ventricular contraction generates a palpable peripheral pulse — the difference is the pulse deficit. Apical, full minute, every time for digoxin and for beta blockers.'
      },
      {
        id: 'mar6-trap-levothyroxine-timing',
        severity: 'major',
        trigger: 'Levothyroxine 88 mcg is due at 0900 with the breakfast tray already at the bedside, and the TSH is 0.2.',
        whatHappens: 'Food, calcium, iron, and antacids substantially reduce levothyroxine absorption, so giving it with a meal produces erratic and subtherapeutic levels. Separately, a TSH of 0.2 means the patient is OVER-replaced, and excess thyroid hormone worsens atrial fibrillation and increases the risk of bradyarrhythmias resolving into rapid rates, angina, and osteoporosis.',
        correctAction: 'Give levothyroxine on an empty stomach, 30 to 60 minutes before breakfast, at the same time each day, with water only. Separate it by at least 4 hours from calcium, iron, and antacids. Report the suppressed TSH and the cardiac history to the provider for dose review.',
        teachingPoint: 'Levothyroxine timing is a scored Right Time issue, not a nicety. Teach the patient to take it first thing in the morning on an empty stomach and to stay on the same manufacturer, because bioavailability varies between brands and generics for a narrow-therapeutic-index drug.'
      },
      {
        id: 'mar6-trap-zolpidem-beers',
        severity: 'major',
        trigger: 'Zolpidem 10 mg QHS PRN is ordered for an 84-year-old woman who had a near-fall at 0300 and is newly confused.',
        whatHappens: 'Zolpidem appears on the Beers criteria list of potentially inappropriate medications in older adults because it causes next-day sedation, delirium, and falls. The 10 mg dose is double the 5 mg recommended maximum for older adults and for women, whose clearance is slower. The near-fall and the new confusion are very likely drug effects.',
        correctAction: 'Do not give at the ordered dose. Clarify with the provider, recommending 5 mg or discontinuation, and offer nonpharmacologic sleep measures: reduce nighttime noise and light, cluster care, limit evening caffeine, maintain a routine. Institute fall precautions and document the near-fall.',
        teachingPoint: 'Learn the Beers criteria high-yield groups: benzodiazepines and Z-drugs, first-generation antihistamines such as diphenhydramine, anticholinergics, muscle relaxants, NSAIDs, and long-term proton pump inhibitors. In older adults, start low and go slow, and always ask whether a new symptom is actually a drug effect.'
      },
      {
        id: 'mar6-trap-magnesium',
        severity: 'major',
        trigger: 'Magnesium is 1.4 mg/dL while potassium replacement is being given for a potassium of 3.1.',
        whatHappens: 'Hypokalemia is refractory to replacement while magnesium is low, because low magnesium increases renal potassium wasting. The potassium will not correct no matter how much is given until the magnesium is repleted, and hypomagnesemia independently predisposes to torsades de pointes.',
        correctAction: 'Report the magnesium of 1.4 along with the potassium of 3.1 and anticipate an order for magnesium replacement. Recheck both levels after replacement, and keep the patient on cardiac monitoring.',
        teachingPoint: 'Replete magnesium before or alongside potassium. Loop diuretics waste potassium, magnesium, sodium, and calcium together — check the whole electrolyte panel, not just the potassium.'
      },
      {
        id: 'mar6-trap-polypharmacy',
        severity: 'minor',
        trigger: 'The patient takes 11 scheduled medications and has new confusion, nausea, anorexia, hypotension, bradycardia, and a near-fall.',
        whatHappens: 'A student who treats each order in isolation misses that the constellation of symptoms is being produced by the regimen as a whole. Polypharmacy — generally five or more medications — is an independent risk factor for adverse drug events, falls, delirium, and hospital readmission in older adults.',
        correctAction: 'Step back and review the entire MAR for additive effects: two drugs lowering the heart rate, two lowering the blood pressure, two contributing to hypokalemia, and a sedative-hypnotic on top. Report the pattern to the provider and request a medication review or a pharmacy consult. Ask about home over-the-counter and herbal products as well.',
        teachingPoint: 'In geriatrics, always ask "could this new symptom be a medication?" before assuming it is disease progression or dementia. A prescribing cascade — treating a drug side effect with another drug — is the mechanism behind many geriatric medication lists.'
      },
      {
        id: 'mar6-trap-allergy-vs-intolerance',
        severity: 'minor',
        trigger: 'The allergy list reads "codeine (nausea and vomiting)" and the patient has osteoarthritis pain.',
        whatHappens: 'Nausea and vomiting with codeine is an intolerance, not a true immune-mediated allergy. Recorded as an allergy without qualification, it may unnecessarily block a whole class of useful analgesics; treated as meaningless, it may lead to giving a related opioid without anticipating the same reaction. The latex allergy is also easy to overlook when selecting gloves, tourniquets, and IV supplies.',
        correctAction: 'Clarify with the patient what happened and document the specific reaction. Screen every order against BOTH allergies, and confirm that latex-free gloves, tourniquets, syringes, and tape are used for all care including injections.',
        teachingPoint: 'A complete allergy check documents the reaction, not just the drug name, and distinguishes allergy from intolerance from side effect. Non-drug allergies matter too — latex allergy changes your equipment, and it cross-reacts with banana, avocado, kiwi, and chestnut.'
      }
    ]
  }
];

/* =============================================================================
 * 4. DRUG REFERENCE — the study list for the signoff
 * -----------------------------------------------------------------------------
 * highAlert: true marks drugs that carry a heightened risk of significant harm
 * when used in error (ISMP high-alert classes): insulins, anticoagulants,
 * opioids, digoxin, concentrated electrolytes, and antiarrhythmics.
 * ========================================================================== */
window.MEDADMIN_DRUGS = [

  {
    id: 'tamsulosin',
    generic: 'Tamsulosin',
    brand: ['Flomax'],
    classification: 'Alpha-1 adrenergic blocker (uroselective)',
    use: 'Benign prostatic hyperplasia — relaxes smooth muscle in the prostate and bladder neck to improve urinary flow. Also used off label to help pass ureteral stones.',
    highAlert: false,
    nursingConsiderations: [
      'Give 30 minutes after the SAME meal each day for consistent absorption.',
      'Swallow the capsule whole — do not crush, chew, or open.',
      'First-dose phenomenon: syncope can occur with the first dose or after a dose increase. Give the first dose at bedtime and have the patient rise slowly.',
      'Teach the patient to change position slowly and to sit on the edge of the bed before standing.',
      'Inform any ophthalmologist before cataract surgery because of intraoperative floppy iris syndrome.',
      'Warn about retrograde ejaculation, which is harmless but distressing if unexpected.',
      'Avoid concurrent phosphodiesterase-5 inhibitors such as sildenafil because of additive hypotension.'
    ],
    monitoring: ['Blood pressure sitting and standing', 'Symptoms of dizziness or syncope', 'Urinary flow, frequency, nocturia, and post-void residual', 'Fall risk assessment'],
    sideEffects: ['Orthostatic hypotension', 'Dizziness', 'Headache', 'Retrograde ejaculation', 'Rhinitis and nasal congestion', 'Syncope with the first dose', 'Intraoperative floppy iris syndrome'],
    holdParameters: 'Hold and notify the provider for symptomatic hypotension, systolic blood pressure below the ordered threshold (commonly under 90 to 100 mmHg), or syncope.',
    antidote: 'No specific antidote. Treat hypotension with supine positioning, leg elevation, and IV fluids; vasopressors if severe.',
    atiPearl: 'Flomax makes urine FLOW — and makes blood pressure FALL. Give at bedtime after the same meal, and put fall precautions in place before the first dose.'
  },

  {
    id: 'percocet',
    generic: 'Oxycodone / acetaminophen',
    brand: ['Percocet', 'Endocet', 'Roxicet'],
    classification: 'Opioid agonist combined with a non-opioid analgesic and antipyretic (Schedule II controlled substance)',
    use: 'Moderate to moderately severe acute pain.',
    highAlert: true,
    nursingConsiderations: [
      'Assess pain with a standardized scale before administration and reassess in 30 to 60 minutes for an oral dose.',
      'Count the ACETAMINOPHEN, not just the opioid: maximum 4 g per 24 hours in a healthy adult, 3 g or less in an older adult or anyone with liver disease or chronic alcohol use.',
      'Check every other medication and over-the-counter product for hidden acetaminophen.',
      'Start a bowel regimen — a stool softener with or without a stimulant — with any scheduled opioid.',
      'Assess respiratory rate and sedation level before and after every dose.',
      'Requires controlled-substance counting, witnessed waste, and two-nurse verification of waste.',
      'Additive central nervous system depression with benzodiazepines, alcohol, and antihistamines.'
    ],
    monitoring: ['Respiratory rate and depth', 'Sedation scale', 'Pain score before and after', 'Blood pressure', 'Bowel function', 'Cumulative 24-hour acetaminophen dose', 'Liver function tests with prolonged use'],
    sideEffects: ['Respiratory depression', 'Sedation and drowsiness', 'Constipation (does not resolve with tolerance)', 'Nausea and vomiting', 'Pruritus', 'Orthostatic hypotension', 'Urinary retention', 'Hepatotoxicity from the acetaminophen component'],
    holdParameters: 'Hold and notify for a respiratory rate under 12, oxygen saturation under 90 percent, excessive sedation, or if the 24-hour acetaminophen ceiling has been reached.',
    antidote: 'Naloxone (Narcan) for the opioid component. Acetylcysteine (Mucomyst, Acetadote) for acetaminophen overdose.',
    atiPearl: 'Two drugs in one tablet means two ceilings to track. The opioid limit is respiratory rate; the acetaminophen limit is 4 g per day, or 3 g in an older adult or a liver patient.'
  },

  {
    id: 'bisacodyl',
    generic: 'Bisacodyl',
    brand: ['Dulcolax', 'Correctol'],
    classification: 'Stimulant laxative',
    use: 'Short-term treatment of constipation and bowel preparation before procedures.',
    highAlert: false,
    nursingConsiderations: [
      'Enteric-coated tablets must be swallowed whole — never crushed or chewed.',
      'Do not give within 1 hour of milk, antacids, or a proton pump inhibitor; the alkaline environment dissolves the enteric coating early and causes gastric irritation and cramping.',
      'Oral onset is 6 to 12 hours, so give at bedtime for a morning result. The suppository works in 15 to 60 minutes.',
      'For a suppository, position in the left lateral Sims position and insert past the internal sphincter against the rectal wall.',
      'Contraindicated in suspected bowel obstruction, appendicitis, or acute abdomen.',
      'Teach that chronic use causes laxative dependence and loss of normal bowel tone.'
    ],
    monitoring: ['Bowel movement frequency, consistency, and effectiveness', 'Bowel sounds and abdominal assessment', 'Fluid and electrolyte status with prolonged use', 'Abdominal cramping'],
    sideEffects: ['Abdominal cramping', 'Nausea', 'Diarrhea', 'Rectal burning with the suppository', 'Electrolyte imbalance and hypokalemia with chronic use', 'Laxative dependence'],
    holdParameters: 'Hold and notify for abdominal pain of unknown cause, absent bowel sounds, nausea and vomiting, or suspected obstruction.',
    antidote: 'None. Discontinue and provide supportive fluid and electrolyte replacement.',
    atiPearl: 'Stimulant laxative — do not crush, and no milk or antacids within an hour. Give at bedtime for a result in the morning.'
  },

  {
    id: 'erythromycin',
    generic: 'Erythromycin',
    brand: ['Ery-Tab', 'E.E.S.', 'Erythrocin', 'Romycin (ophthalmic)'],
    classification: 'Macrolide antibiotic (bacteriostatic, inhibits protein synthesis)',
    use: 'Respiratory tract infections, skin and soft tissue infections, pertussis, chlamydia, and as an alternative for penicillin-allergic patients. Ophthalmic ointment is used for neonatal eye prophylaxis. Sometimes used off label as a prokinetic for gastroparesis.',
    highAlert: false,
    nursingConsiderations: [
      'Give on an empty stomach with a full glass of water when tolerated; if GI upset is severe, give with food.',
      'Do not give with fruit juice — an acidic environment degrades the drug.',
      'Do not crush enteric-coated or delayed-release forms.',
      'Major CYP3A4 inhibitor: raises levels of warfarin, digoxin, statins, carbamazepine, theophylline, and many others. Screen the full medication list.',
      'Prolongs the QT interval; avoid combining with other QT-prolonging drugs.',
      'For neonatal ophthalmic prophylaxis, apply a thin ribbon to the lower conjunctival sac from inner to outer canthus and do not flush the eyes.',
      'Teach the patient to complete the entire course even after feeling better.'
    ],
    monitoring: ['Signs of infection resolution: temperature, white blood cell count, cultures', 'Liver function tests', 'ECG and QT interval when combined with other QT-prolonging drugs', 'Hearing with high doses or renal impairment', 'Signs of superinfection including C. difficile diarrhea and oral candidiasis'],
    sideEffects: ['Nausea, vomiting, abdominal cramping and diarrhea (very common)', 'QT prolongation and torsades de pointes', 'Hepatotoxicity and cholestatic jaundice', 'Reversible ototoxicity at high doses', 'Superinfection including C. difficile'],
    holdParameters: 'Hold and notify for signs of hepatotoxicity, a significantly prolonged QT interval, hearing changes, or severe or bloody diarrhea suggesting C. difficile.',
    antidote: 'None. Discontinue and provide supportive care.',
    atiPearl: 'Macrolides equal GI upset plus QT prolongation plus a pile of drug interactions. Before giving erythromycin, scan the MAR for warfarin, digoxin, and statins — their levels all go up.'
  },

  {
    id: 'vancomycin',
    generic: 'Vancomycin',
    brand: ['Vancocin', 'Firvanq'],
    classification: 'Glycopeptide antibiotic (bactericidal, inhibits cell wall synthesis)',
    use: 'Serious gram-positive infections, especially MRSA: bacteremia, endocarditis, osteomyelitis, pneumonia, and meningitis. ORAL vancomycin is not absorbed and is used only for C. difficile colitis.',
    highAlert: false,
    nursingConsiderations: [
      'Infuse a MINIMUM of 60 minutes per gram; a dose above 1 g generally needs 90 to 120 minutes. Always use a pump.',
      'Too-rapid infusion causes vancomycin infusion reaction (formerly red man syndrome): flushing and erythema of the face, neck, and upper torso, pruritus, and hypotension. This is a histamine rate reaction, not an allergy — slow the rate and give an antihistamine.',
      'Draw the TROUGH within 30 minutes BEFORE the next dose, usually before the fourth dose once steady state is reached. Do not give the dose until the specimen is drawn.',
      'Goal trough is 15 to 20 mcg/mL for serious MRSA infections; many institutions now dose to an AUC.',
      'Monitor renal function closely — the dose and interval depend on it.',
      'Vesicant: assess the site frequently and stop the infusion immediately for any sign of infiltration.',
      'Oral vancomycin treats only the gut; it will not treat a bloodstream infection.'
    ],
    monitoring: ['Trough level and the exact draw time', 'Serum creatinine, BUN, eGFR, and urine output', 'Hearing: tinnitus, muffled hearing, vertigo', 'Infusion site', 'Temperature, white blood cell count, and cultures', 'Vital signs during the infusion'],
    sideEffects: ['Nephrotoxicity', 'Ototoxicity, which may be permanent', 'Vancomycin infusion reaction with flushing', 'Thrombophlebitis at the IV site', 'Neutropenia with prolonged therapy'],
    holdParameters: 'Hold and notify for a trough above the therapeutic goal, a rising creatinine or falling urine output, or new hearing changes or tinnitus.',
    antidote: 'No antidote. Discontinue, provide supportive care, and consider hemodialysis in severe overdose with high-flux membranes.',
    atiPearl: 'Vancomycin equals kidneys and ears. Check the trough and the creatinine before you hang it, and run it slowly — at least an hour per gram.'
  },

  {
    id: 'hydrochlorothiazide',
    generic: 'Hydrochlorothiazide',
    brand: ['Microzide', 'HydroDIURIL', 'HCTZ'],
    classification: 'Thiazide diuretic',
    use: 'Hypertension and mild edema. Also used to reduce calcium excretion in recurrent calcium kidney stones.',
    highAlert: false,
    nursingConsiderations: [
      'Give in the MORNING to avoid nocturia; if a second dose is ordered, give it before 1600.',
      'Sulfonamide derivative — verify the patient does not have a sulfa allergy.',
      'Loses effectiveness when the glomerular filtration rate falls below about 30 mL/min.',
      'Encourage potassium-rich foods: bananas, oranges, potatoes, tomatoes, spinach, and dried fruit.',
      'Teach the patient to rise slowly because of orthostatic hypotension.',
      'Causes photosensitivity — teach sunscreen and protective clothing.',
      'Raises lithium levels and raises blood glucose in diabetic patients.'
    ],
    monitoring: ['Blood pressure sitting and standing', 'Potassium, sodium, magnesium, calcium, and uric acid', 'Daily weight and intake and output', 'Blood glucose in diabetic patients', 'Renal function', 'Signs of dehydration'],
    sideEffects: ['Hypokalemia', 'Hyponatremia', 'Hypomagnesemia', 'HYPERcalcemia (thiazides retain calcium)', 'Hyperglycemia', 'Hyperuricemia and gout flares', 'Orthostatic hypotension', 'Photosensitivity', 'Erectile dysfunction'],
    holdParameters: 'Hold and notify for systolic blood pressure under 90 to 100 mmHg per the order, potassium under 3.5 mEq/L, or signs of significant dehydration.',
    antidote: 'None. Treat with fluid and electrolyte replacement.',
    atiPearl: 'Thiazides waste everything except calcium — low potassium, low sodium, low magnesium, but HIGH calcium, HIGH glucose, and HIGH uric acid. Give it in the morning.'
  },

  {
    id: 'digoxin',
    generic: 'Digoxin',
    brand: ['Lanoxin', 'Digitek'],
    classification: 'Cardiac glycoside — positive inotrope and negative chronotrope',
    use: 'Heart failure with reduced ejection fraction (increases contractility) and rate control in atrial fibrillation and atrial flutter (slows conduction through the AV node).',
    highAlert: true,
    nursingConsiderations: [
      'Take an APICAL pulse for a FULL 60 seconds before every dose. Hold and notify for a rate under 60 in an adult, under 70 in a child, or under 90 to 110 in an infant.',
      'Narrow therapeutic index: 0.5 to 2.0 ng/mL. Toxicity is common and often subtle.',
      'HYPOKALEMIA potentiates toxicity — check the potassium before giving. Hypomagnesemia and hypercalcemia also increase risk.',
      'Renally cleared: reduce the dose in renal impairment and in older adults.',
      'IV digoxin must be pushed SLOWLY over at least 5 minutes; never rapid push.',
      'Always write and read the dose with a leading zero (0.125 mg, never .125 mg).',
      'Amiodarone, verapamil, quinidine, and erythromycin all raise digoxin levels — the digoxin dose is often halved when amiodarone is started.',
      'Teach the patient to take their own pulse daily and to report a rate under 60, nausea, anorexia, or visual changes.'
    ],
    monitoring: ['Apical pulse for a full minute before every dose', 'Serum digoxin level', 'Potassium, magnesium, and calcium', 'Renal function', 'ECG and rhythm', 'Daily weight and edema in heart failure', 'Signs of toxicity'],
    sideEffects: ['Bradycardia and heart block', 'Anorexia, nausea, and vomiting (earliest toxicity signs)', 'Visual disturbances: yellow-green halos, blurred vision', 'Confusion, weakness, and fatigue', 'Any new dysrhythmia'],
    holdParameters: 'Hold and notify for an apical pulse under 60 in an adult, a digoxin level above 2.0 ng/mL, hypokalemia, or any sign of toxicity.',
    antidote: 'Digoxin immune Fab (Digibind, DigiFab).',
    atiPearl: 'Apical pulse, full minute, every dose. Then remember the toxicity march: GI first, then yellow-green halos, then confusion, then dysrhythmias. Low potassium makes it all worse.'
  },

  {
    id: 'warfarin',
    generic: 'Warfarin',
    brand: ['Coumadin', 'Jantoven'],
    classification: 'Vitamin K antagonist anticoagulant',
    use: 'Prevention and treatment of venous thromboembolism, stroke prevention in atrial fibrillation, and anticoagulation for mechanical heart valves.',
    highAlert: true,
    nursingConsiderations: [
      'Check the INR before every dose. Goal is 2.0 to 3.0 for most indications and 2.5 to 3.5 for a mechanical mitral valve.',
      'Onset is delayed 3 to 5 days, so heparin or a low molecular weight heparin bridges the gap when starting therapy.',
      'Teach CONSISTENT vitamin K intake rather than avoidance — dark leafy greens are fine as long as the amount stays steady week to week.',
      'Enormous interaction profile: antibiotics, amiodarone, NSAIDs, acetaminophen with regular use, and many herbals raise the INR.',
      'Bleeding precautions: soft toothbrush, electric razor, no contact sports, no rectal temperatures, hold pressure longer after venipuncture.',
      'Teach the patient to carry medical identification and to tell every provider and dentist.',
      'Contraindicated in pregnancy — it is teratogenic. Heparin and enoxaparin are the pregnancy-safe choices.'
    ],
    monitoring: ['INR and prothrombin time', 'Hemoglobin, hematocrit, and platelets', 'Bleeding assessment: gums, urine, stool, bruising, headache, and level of consciousness', 'Signs of intracranial hemorrhage'],
    sideEffects: ['Bleeding and hemorrhage', 'Bruising and petechiae', 'Purple toe syndrome', 'Skin necrosis (rare, early in therapy)', 'Hepatitis'],
    holdParameters: 'Hold and notify for an INR above the therapeutic goal, any active bleeding, or a planned invasive procedure.',
    antidote: 'Vitamin K (phytonadione). For serious bleeding, add prothrombin complex concentrate or fresh frozen plasma.',
    atiPearl: 'Warfarin equals INR equals vitamin K. Keep greens CONSISTENT, not absent. Heparin bridges the first few days because warfarin takes 3 to 5 days to work.'
  },

  {
    id: 'heparin',
    generic: 'Heparin sodium',
    brand: ['Hep-Lock', 'unfractionated heparin'],
    classification: 'Anticoagulant — indirect thrombin inhibitor that potentiates antithrombin III',
    use: 'Prevention and treatment of venous thromboembolism and pulmonary embolism, acute coronary syndrome, and anticoagulation during dialysis or bypass. Low-dose subcutaneous heparin is used for DVT prophylaxis.',
    highAlert: true,
    nursingConsiderations: [
      'Monitor aPTT for a therapeutic infusion; goal is generally 1.5 to 2.5 times the control value, often reported as 60 to 80 seconds. Anti-Xa levels are used in many facilities.',
      'Prophylactic subcutaneous dosing does not require aPTT monitoring, but the platelet count still does.',
      'Check platelets before every dose and watch for heparin-induced thrombocytopenia — a drop of more than 50 percent from baseline, typically 5 to 10 days into therapy. HIT is PROTHROMBOTIC.',
      'SubQ technique: abdomen at least 2 inches from the umbilicus, rotate sites, pinch the skin, 25 to 27 gauge 5/8 inch needle at 45 to 90 degrees, DO NOT aspirate, DO NOT massage.',
      'Continuous infusions require a pump, a weight-based protocol, and a second-nurse independent double check.',
      'Onset is immediate by IV and the half-life is short (60 to 90 minutes), which is why heparin is preferred when anticoagulation may need to be reversed quickly.',
      'Safe in pregnancy — it does not cross the placenta.'
    ],
    monitoring: ['aPTT or anti-Xa level', 'Platelet count and trend', 'Hemoglobin and hematocrit', 'Bleeding assessment at all sites', 'Neurologic status for intracranial bleeding'],
    sideEffects: ['Bleeding and hemorrhage', 'Heparin-induced thrombocytopenia', 'Hematoma at injection sites', 'Hyperkalemia', 'Osteoporosis with long-term use'],
    holdParameters: 'Hold and notify for platelets under 100,000/mm3 or a drop of 50 percent from baseline, a supratherapeutic aPTT, or any active bleeding.',
    antidote: 'Protamine sulfate.',
    atiPearl: 'Heparin equals aPTT and PROTamine. Warfarin equals PT/INR and vitamin K. Never aspirate and never massage a heparin subQ site, and check the platelets before every dose.'
  },

  {
    id: 'nystatin',
    generic: 'Nystatin',
    brand: ['Mycostatin', 'Nystop', 'Bio-Statin'],
    classification: 'Polyene antifungal',
    use: 'Oral candidiasis (thrush), esophageal and intestinal candidiasis, and cutaneous or vaginal candidiasis. The oral suspension acts topically and is essentially not absorbed.',
    highAlert: false,
    nursingConsiderations: [
      'Oral suspension: swish thoroughly around the entire mouth for at least 2 minutes, then swallow (or spit if ordered) — SWISH AND SWALLOW.',
      'Give AFTER meals and after oral care so the drug stays in contact with the mucosa; do not eat or drink for 30 minutes afterward.',
      'Remove dentures before administering and disinfect them daily; thrush recurs from contaminated appliances.',
      'For infants, apply with a swab to each side of the mouth rather than having the infant swish.',
      'Continue for at least 48 hours after symptoms resolve to prevent relapse.',
      'For a topical powder or cream, keep skin folds clean and dry and apply a thin layer.',
      'Investigate WHY the patient has thrush — inhaled corticosteroids without rinsing, antibiotics, immunosuppression, or uncontrolled diabetes.'
    ],
    monitoring: ['Oral mucosa: white plaques, erythema, and comfort', 'Ability to eat and drink', 'Response to therapy after several days', 'Blood glucose if the patient is diabetic'],
    sideEffects: ['Nausea and vomiting (usually from swallowing large volumes)', 'Diarrhea', 'Unpleasant taste', 'Local irritation', 'Rash (rare)'],
    holdParameters: 'No routine hold. Notify for worsening lesions, inability to swallow, or signs of systemic infection.',
    antidote: 'None needed; the drug is not systemically absorbed.',
    atiPearl: 'Swish for 2 minutes and swallow, AFTER meals, and nothing to eat or drink for 30 minutes. Teach every patient on an inhaled steroid to rinse their mouth so they never need this.'
  },

  {
    id: 'docusate-sodium',
    generic: 'Docusate sodium',
    brand: ['Colace', 'Docusil', 'Surfak (docusate calcium)'],
    classification: 'Stool softener (emollient laxative, a surfactant)',
    use: 'Prevention of constipation and straining, especially with opioids, after myocardial infarction, after rectal or abdominal surgery, and postpartum.',
    highAlert: false,
    nursingConsiderations: [
      'Give with a FULL glass of water — the drug pulls water into the stool and does not work in a dehydrated patient.',
      'This is a preventive agent, not a rescue drug. Onset is 12 to 72 hours.',
      'Should be started with every scheduled opioid; opioid constipation does not improve with tolerance.',
      'Encourage fluids, dietary fiber, and mobility along with the drug.',
      'Do not use with mineral oil, which increases systemic absorption.',
      'Contraindicated with abdominal pain of unknown cause, nausea and vomiting, or suspected obstruction.'
    ],
    monitoring: ['Bowel movement frequency and stool consistency', 'Bowel sounds and abdominal assessment', 'Fluid intake', 'Date of the last bowel movement'],
    sideEffects: ['Mild abdominal cramping', 'Diarrhea', 'Throat irritation with the liquid form', 'Bitter taste'],
    holdParameters: 'Hold and notify for abdominal pain of unknown cause, absent bowel sounds, or suspected bowel obstruction.',
    antidote: 'None. Discontinue if diarrhea develops.',
    atiPearl: 'A stool softener needs water to work. Colace prevents constipation; it does not treat an impaction. Every opioid order should have a bowel regimen next to it.'
  },

  {
    id: 'phenytoin',
    generic: 'Phenytoin',
    brand: ['Dilantin', 'Phenytek'],
    classification: 'Hydantoin anticonvulsant (sodium channel stabilizer)',
    use: 'Tonic-clonic and complex partial seizures, status epilepticus, and seizure prophylaxis after neurosurgery or head trauma.',
    highAlert: false,
    nursingConsiderations: [
      'Therapeutic serum level is 10 to 20 mcg/mL. Above 20 causes nystagmus, ataxia, and slurred speech; above 30 causes lethargy and coma.',
      'IV: mix in NORMAL SALINE ONLY — phenytoin precipitates in any dextrose-containing solution. Use an in-line filter and flush with saline before and after.',
      'Maximum IV rate is 50 mg per minute in an adult and 25 mg per minute in an older adult, because faster rates cause hypotension and cardiac arrest. Use a pump with continuous cardiac monitoring.',
      'Extravasation causes purple glove syndrome with severe tissue injury; assess the site continuously.',
      'Gingival hyperplasia is very common — teach meticulous oral hygiene, soft toothbrush, flossing, and regular dental visits.',
      'Hold enteral feedings for 1 to 2 hours before and after an oral dose; tube feeds bind phenytoin and cause subtherapeutic levels.',
      'Never stop abruptly — it precipitates status epilepticus.',
      'Reduces the effectiveness of oral contraceptives; teach an additional method.',
      'Report any rash immediately because of the risk of Stevens-Johnson syndrome and toxic epidermal necrolysis.',
      'Teach that urine may turn pink, red, or brown, which is harmless.'
    ],
    monitoring: ['Serum phenytoin level and albumin (only free drug is active)', 'Complete blood count for blood dyscrasias', 'Liver function tests', 'Seizure frequency and description', 'Oral and gingival assessment', 'ECG and blood pressure during IV administration', 'Skin assessment for rash'],
    sideEffects: ['Gingival hyperplasia', 'Nystagmus, ataxia, and slurred speech (dose-related toxicity)', 'Hirsutism and coarsening of facial features', 'Rash including Stevens-Johnson syndrome', 'Blood dyscrasias including agranulocytosis and aplastic anemia', 'Hepatotoxicity', 'Hypotension and dysrhythmias with rapid IV push', 'Osteoporosis with long-term use'],
    holdParameters: 'Hold and notify for a level above 20 mcg/mL, any new rash, or signs of toxicity such as nystagmus, ataxia, or slurred speech.',
    antidote: 'No specific antidote. Discontinue and provide supportive care; consider activated charcoal for acute oral overdose.',
    atiPearl: 'Dilantin loves saline and hates dextrose. Level 10 to 20, watch the gums, hold tube feeds around the dose, and never push it faster than 50 mg per minute.'
  },

  {
    id: 'furosemide',
    generic: 'Furosemide',
    brand: ['Lasix'],
    classification: 'Loop diuretic',
    use: 'Edema from heart failure, hepatic cirrhosis, or renal disease; pulmonary edema; and hypertension. Also used acutely for hypercalcemia and hyperkalemia.',
    highAlert: false,
    nursingConsiderations: [
      'Give in the morning, and a second dose no later than late afternoon, to avoid nocturia.',
      'IV push no faster than 20 mg per minute (4 mg per minute for high doses) because rapid administration causes ototoxicity.',
      'Continues to work when the glomerular filtration rate is low, unlike a thiazide.',
      'Sulfonamide derivative — verify no sulfa allergy.',
      'Encourage potassium-rich foods and expect a potassium supplement.',
      'Weigh the patient daily at the same time, in the same clothing, on the same scale. A gain of 2 to 3 lb in a day or 5 lb in a week is reportable.',
      'Teach the patient to rise slowly because of orthostatic hypotension, and monitor for falls.',
      'Additive ototoxicity with aminoglycosides and vancomycin; raises lithium levels; potentiates digoxin toxicity by lowering potassium.'
    ],
    monitoring: ['Daily weight and strict intake and output', 'Blood pressure sitting and standing', 'Potassium, sodium, magnesium, calcium, chloride, BUN, and creatinine', 'Hearing: tinnitus or muffled hearing', 'Lung sounds and edema', 'Blood glucose and uric acid'],
    sideEffects: ['Hypokalemia', 'Hyponatremia and hypochloremia', 'Hypomagnesemia and hypocalcemia', 'Dehydration and orthostatic hypotension', 'Ototoxicity, especially with rapid IV push', 'Hyperglycemia and hyperuricemia', 'Photosensitivity'],
    holdParameters: 'Hold and notify for systolic blood pressure under 90 to 100 mmHg per the order, potassium under 3.5 mEq/L, significant dehydration, or worsening renal function.',
    antidote: 'None. Treat with fluid and electrolyte replacement.',
    atiPearl: 'Lasix LOSES fluid and potassium. Give it in the morning, weigh the patient daily, and push it slowly — no faster than 20 mg per minute, or you risk the ears.'
  },

  {
    id: 'potassium-chloride',
    generic: 'Potassium chloride',
    brand: ['K-Dur', 'Klor-Con', 'Micro-K', 'K-Tab'],
    classification: 'Electrolyte replacement',
    use: 'Treatment and prevention of hypokalemia, especially in patients on loop or thiazide diuretics or with GI losses.',
    highAlert: true,
    nursingConsiderations: [
      'NEVER give potassium chloride by IV push or IV bolus — it causes immediate cardiac arrest. This is one of the most lethal medication errors in nursing.',
      'IV potassium must always be DILUTED and infused on a PUMP. Maximum 10 mEq per hour through a peripheral line; up to 20 mEq per hour through a central line with continuous cardiac monitoring.',
      'Never store concentrated potassium as floor stock.',
      'Assess urine output before every dose — no pee, no K. Hold for output under 30 mL per hour.',
      'Oral: give WITH food and a FULL glass of water to reduce GI irritation and ulceration.',
      'Do not crush, chew, or allow the patient to suck on extended-release tablets. Some wax matrix shells appear in the stool intact, which is expected.',
      'Mix powders and effervescent tablets completely in at least 4 ounces of water or juice.',
      'IV potassium burns; a peripheral site may need further dilution, a slower rate, or a warm compress. Assess for phlebitis and infiltration.'
    ],
    monitoring: ['Serum potassium', 'Urine output and renal function', 'Cardiac rhythm — peaked T waves and a widened QRS signal hyperkalemia', 'Magnesium level', 'IV site for phlebitis', 'Muscle strength and GI symptoms'],
    sideEffects: ['GI irritation, nausea, and vomiting', 'GI ulceration with the oral form', 'Hyperkalemia with dysrhythmias', 'Pain and phlebitis at the IV site', 'Diarrhea'],
    holdParameters: 'Hold and notify for urine output under 30 mL per hour, oliguria or anuria, or a potassium above 5.0 mEq/L.',
    antidote: 'For hyperkalemia: IV calcium gluconate to stabilize the myocardium, then insulin with dextrose, sodium bicarbonate, or a beta agonist to shift potassium intracellularly, then sodium polystyrene sulfonate, patiromer, or dialysis to remove it.',
    atiPearl: 'NEVER IV push. Always dilute, always on a pump, never faster than 10 mEq per hour peripherally. Oral doses go down with food and a full glass of water, swallowed whole. And no pee, no K.'
  },

  {
    id: 'clopidogrel',
    generic: 'Clopidogrel',
    brand: ['Plavix'],
    classification: 'Antiplatelet — P2Y12 adenosine diphosphate receptor inhibitor',
    use: 'Prevention of thrombotic events after myocardial infarction, ischemic stroke, peripheral arterial disease, and after coronary stent placement.',
    highAlert: false,
    nursingConsiderations: [
      'Hold 5 to 7 days before elective surgery or an invasive procedure, but only on the provider order — stopping it after a recent stent risks acute stent thrombosis.',
      'A prodrug requiring CYP2C19 activation. Poor metabolizers get reduced benefit, and genetic testing is sometimes done.',
      'Avoid omeprazole and esomeprazole, which inhibit CYP2C19; pantoprazole is the preferred proton pump inhibitor.',
      'Additive bleeding risk with NSAIDs, aspirin, anticoagulants, and SSRIs.',
      'May be given with or without food; give with food if GI upset occurs.',
      'Bleeding precautions and teaching: soft toothbrush, electric razor, report black or tarry stools and unusual bruising.',
      'Teach the patient never to stop it on their own after a stent.'
    ],
    monitoring: ['Complete blood count including hemoglobin, hematocrit, and platelets', 'Bleeding assessment at all sites', 'Signs of thrombotic thrombocytopenic purpura: fever, purpura, neurologic changes, renal dysfunction, hemolytic anemia'],
    sideEffects: ['Bleeding and easy bruising', 'GI bleeding', 'Rash and pruritus', 'Diarrhea', 'Neutropenia (rare)', 'Thrombotic thrombocytopenic purpura (rare but serious)'],
    holdParameters: 'Hold and notify for active bleeding, a significant drop in hemoglobin or platelets, or a planned invasive procedure — provider order required.',
    antidote: 'No reversal agent. Platelet transfusion is the only option, and it is of limited benefit while the drug is still circulating.',
    atiPearl: 'Plavix stops platelets from clumping. There is NO antidote, effects last the 7 to 10 day life of the platelet, and a patient with a fresh stent should never stop it without talking to cardiology.'
  },

  {
    id: 'levothyroxine',
    generic: 'Levothyroxine sodium',
    brand: ['Synthroid', 'Levoxyl', 'Euthyrox', 'Unithroid'],
    classification: 'Thyroid hormone replacement (synthetic T4)',
    use: 'Hypothyroidism, myxedema coma, and suppression of thyroid-stimulating hormone in thyroid cancer.',
    highAlert: false,
    nursingConsiderations: [
      'Give on an EMPTY STOMACH, 30 to 60 minutes before breakfast, at the SAME time every day, with a full glass of water.',
      'Separate by at least 4 hours from calcium, iron, magnesium, antacids, sucralfate, and fiber or soy supplements, all of which block absorption.',
      'Narrow therapeutic index. Do not switch brands or between brand and generic without a provider order and a follow-up TSH.',
      'Full effect takes 4 to 6 weeks; TSH is rechecked 6 to 8 weeks after any dose change.',
      'Start low and titrate slowly in older adults and in anyone with coronary artery disease, because too rapid replacement causes angina, dysrhythmias, and myocardial infarction.',
      'Raises the effect of warfarin — the INR often rises when levothyroxine is started or increased.',
      'This is lifelong therapy; teach the patient never to stop it and never to double up on a missed dose.'
    ],
    monitoring: ['TSH (the primary marker) and free T4', 'Apical pulse and rhythm before administration', 'Blood pressure', 'Weight', 'Signs of over-replacement or under-replacement', 'Bone density with long-term suppressive therapy'],
    sideEffects: ['Signs of hyperthyroidism from over-replacement: tachycardia, palpitations, chest pain, tremor, nervousness, insomnia, heat intolerance, weight loss, diarrhea', 'Atrial fibrillation, especially in older adults', 'Osteoporosis with long-term over-replacement', 'Transient hair loss early in therapy'],
    holdParameters: 'No standard hold, but notify the provider for a resting heart rate above 100, new palpitations, or chest pain. A suppressed TSH indicates over-replacement and warrants dose review.',
    antidote: 'No antidote. Discontinue for overdose and treat symptomatically; a beta blocker is used to control adrenergic symptoms.',
    atiPearl: 'Empty stomach, same time, every morning, with water only — and 4 hours away from calcium and iron. A low TSH means TOO MUCH replacement.'
  },

  {
    id: 'zolpidem',
    generic: 'Zolpidem',
    brand: ['Ambien', 'Ambien CR', 'Edluar', 'Intermezzo'],
    classification: 'Non-benzodiazepine sedative-hypnotic (Z-drug, GABA-A receptor agonist; Schedule IV)',
    use: 'Short-term treatment of insomnia.',
    highAlert: false,
    nursingConsiderations: [
      'Take IMMEDIATELY before bed, with at least 7 to 8 hours available for sleep. Onset is 15 to 30 minutes.',
      'Do not take with or immediately after a meal, which delays onset.',
      'Boxed warning for complex sleep behaviors: sleepwalking, sleep-driving, sleep-eating, and phone calls with no memory of them. Discontinue permanently if any occur.',
      'On the Beers criteria list of medications to avoid in older adults because of delirium, next-day impairment, and falls.',
      'Maximum immediate-release dose is 5 mg in women and in older adults; women clear the drug more slowly.',
      'Institute fall precautions: bed in the low position, call light within reach, non-skid footwear, and frequent rounding.',
      'Additive central nervous system depression with opioids, benzodiazepines, antihistamines, and alcohol.',
      'Try nonpharmacologic sleep measures first: reduce noise and light, cluster care, limit evening caffeine and napping, and maintain a routine.'
    ],
    monitoring: ['Level of consciousness and mental status, particularly next-day grogginess', 'Fall risk assessment', 'Respiratory status when combined with other CNS depressants', 'Sleep quality and duration', 'Signs of dependence or rebound insomnia'],
    sideEffects: ['Daytime drowsiness and next-day impairment', 'Dizziness and ataxia', 'Complex sleep behaviors and amnesia', 'Confusion and delirium, especially in older adults', 'Falls', 'Headache', 'Rebound insomnia on discontinuation'],
    holdParameters: 'Hold and notify for confusion, oversedation, respiratory depression, an unsafe mobility status, or fewer than 7 to 8 hours of sleep opportunity remaining.',
    antidote: 'Flumazenil can reverse the sedation because zolpidem acts at the benzodiazepine receptor site, but it is used cautiously because of seizure risk.',
    atiPearl: 'Give it in bed, not before bed — the patient should already be lying down. Maximum 5 mg for a woman or an older adult, and expect falls if you skip that step.'
  },

  {
    id: 'prednisone',
    generic: 'Prednisone',
    brand: ['Deltasone', 'Rayos'],
    classification: 'Systemic corticosteroid (glucocorticoid)',
    use: 'Inflammatory and autoimmune conditions, asthma and COPD exacerbations, allergic reactions, adrenal insufficiency replacement, transplant rejection prophylaxis, and some cancers.',
    highAlert: false,
    nursingConsiderations: [
      'Give WITH FOOD in the MORNING to mimic the natural cortisol peak and reduce GI upset and insomnia.',
      'NEVER stop abruptly after more than about 2 weeks of therapy — taper as ordered. Abrupt withdrawal causes adrenal crisis with hypotension, hypoglycemia, and shock.',
      'Masks the signs of infection: a patient can be septic with a normal temperature and a normal white cell differential.',
      'Raises blood glucose; diabetic patients often need increased insulin while on steroids.',
      'Causes sodium and water retention with potassium loss — monitor weight, edema, blood pressure, and potassium.',
      'Long-term use causes osteoporosis; supplement calcium and vitamin D and encourage weight-bearing exercise.',
      'Teach the patient to carry medical identification and to report exposure to chickenpox or measles.',
      'Avoid live vaccines during therapy.'
    ],
    monitoring: ['Blood glucose', 'Blood pressure, weight, and edema', 'Potassium and sodium', 'Signs of infection, remembering that fever may be blunted', 'Mood and behavior changes', 'Bone density with long-term use', 'Signs of GI bleeding'],
    sideEffects: ['Hyperglycemia', 'Immunosuppression and masked infection', 'Fluid retention, edema, weight gain, and hypertension', 'Hypokalemia', 'Mood swings, euphoria, insomnia, and psychosis', 'Cushingoid appearance: moon face, buffalo hump, truncal obesity, striae', 'Osteoporosis and avascular necrosis', 'Peptic ulcer disease', 'Thin fragile skin, easy bruising, and poor wound healing', 'Cataracts and glaucoma'],
    holdParameters: 'No routine hold, but notify for active untreated infection, significant hyperglycemia, or severe psychiatric symptoms. Never omit a dose in a steroid-dependent patient without provider direction, because that can precipitate adrenal crisis.',
    antidote: 'None. Manage adrenal crisis from abrupt withdrawal with IV hydrocortisone, fluids, and glucose.',
    atiPearl: 'Steroids give you the Cushingoid four: high glucose, high blood pressure, low potassium, and a masked infection. Take with food in the morning, and NEVER stop suddenly.'
  },

  {
    id: 'loperamide',
    generic: 'Loperamide',
    brand: ['Imodium', 'Imodium A-D'],
    classification: 'Antidiarrheal — peripherally acting opioid receptor agonist',
    use: 'Symptomatic control of acute nonspecific diarrhea, chronic diarrhea from inflammatory bowel disease, and reduction of ileostomy output.',
    highAlert: false,
    nursingConsiderations: [
      'DO NOT give in infectious diarrhea — C. difficile, Salmonella, Shigella, or E. coli O157:H7 — or with a fever or bloody stools. Slowing motility traps the pathogen and toxin and can cause toxic megacolon.',
      'Maximum 16 mg per day by prescription and 8 mg per day over the counter.',
      'High doses cause QT prolongation, torsades de pointes, and cardiac arrest; loperamide is abused for its opioid effects at very high doses.',
      'Monitor and replace fluid and electrolytes, which are the real priority in diarrhea.',
      'Stop and notify if abdominal distention develops or if diarrhea persists beyond 48 hours.',
      'Not recommended in children under 2 years.'
    ],
    monitoring: ['Stool frequency, consistency, and volume', 'Fluid and electrolyte status', 'Abdominal assessment and bowel sounds', 'Temperature — fever suggests an infectious cause', 'ECG if high doses are suspected'],
    sideEffects: ['Constipation', 'Abdominal cramping and distention', 'Dizziness and drowsiness', 'Dry mouth', 'Toxic megacolon and paralytic ileus', 'QT prolongation and torsades with high doses'],
    holdParameters: 'Hold and notify for fever, bloody or black stools, suspected C. difficile, abdominal distention, or absent bowel sounds.',
    antidote: 'Naloxone can reverse severe loperamide toxicity, though prolonged or repeated dosing may be required because of the long duration of effect.',
    atiPearl: 'Fever or blood in the stool means NO antidiarrheal. You do not want to trap an infection inside the colon.'
  },

  {
    id: 'polyethylene-glycol',
    generic: 'Polyethylene glycol 3350',
    brand: ['MiraLAX', 'GlycoLax', 'GoLYTELY (with electrolytes)'],
    classification: 'Osmotic laxative',
    use: 'Occasional constipation. The electrolyte-containing formulations are used for bowel preparation before colonoscopy.',
    highAlert: false,
    nursingConsiderations: [
      'Dissolve 17 g (about one heaping tablespoon) completely in 8 ounces of water, juice, coffee, or tea.',
      'Onset is 1 to 3 days — this is not a rescue laxative.',
      'Encourage generous fluid intake; the drug works by holding water in the stool.',
      'Bowel preparation formulations require drinking a large volume over several hours; monitor for nausea, vomiting, and electrolyte shifts, and keep the patient near a bathroom.',
      'Contraindicated in known or suspected bowel obstruction.',
      'Generally well tolerated and appropriate for older adults and long-term use.'
    ],
    monitoring: ['Bowel movement frequency and consistency', 'Abdominal assessment and bowel sounds', 'Fluid and electrolyte status, especially with bowel prep volumes', 'Signs of dehydration'],
    sideEffects: ['Bloating, cramping, and flatulence', 'Nausea', 'Diarrhea with excessive use', 'Electrolyte disturbance with large bowel-prep volumes'],
    holdParameters: 'Hold and notify for suspected bowel obstruction, severe abdominal pain, or persistent nausea and vomiting.',
    antidote: 'None. Discontinue and rehydrate.',
    atiPearl: 'Osmotic laxative — it pulls water into the bowel, so it needs fluid to work and it takes 1 to 3 days. Not the drug for someone who needs relief today.'
  },

  {
    id: 'diltiazem',
    generic: 'Diltiazem',
    brand: ['Cardizem', 'Cardizem CD', 'Cartia XT', 'Tiazac'],
    classification: 'Non-dihydropyridine calcium channel blocker',
    use: 'Rate control in atrial fibrillation and atrial flutter, supraventricular tachycardia, hypertension, chronic stable and vasospastic angina.',
    highAlert: false,
    nursingConsiderations: [
      'Check apical pulse and blood pressure before every dose. Hold for a heart rate under 60 or a systolic pressure under 90, or per the order.',
      'Do NOT crush extended-release capsules or tablets.',
      'IV diltiazem requires a pump, continuous cardiac monitoring, and frequent blood pressure checks; for a bolus, push over 2 minutes.',
      'Use extreme caution with a beta blocker — the combination causes profound bradycardia and heart block.',
      'Contraindicated in second or third degree heart block without a pacemaker, sick sinus syndrome, and severe hypotension.',
      'Avoid grapefruit juice, which raises diltiazem levels.',
      'Raises digoxin, cyclosporine, and statin levels.',
      'Teach the patient to rise slowly and to report a slow pulse, swelling, or shortness of breath.'
    ],
    monitoring: ['Apical pulse and blood pressure before every dose', 'ECG and rhythm', 'Signs of heart failure: edema, weight gain, dyspnea, crackles', 'Liver and renal function with long-term use'],
    sideEffects: ['Bradycardia and AV block', 'Hypotension', 'Peripheral edema', 'Headache and dizziness', 'Constipation', 'Flushing', 'Worsening heart failure in patients with reduced ejection fraction'],
    holdParameters: 'Hold and notify for a heart rate under 60, systolic blood pressure under 90 mmHg, or new second or third degree heart block.',
    antidote: 'IV calcium chloride or calcium gluconate; also glucagon, high-dose insulin with dextrose, and vasopressors for severe overdose.',
    atiPearl: 'A calcium channel blocker slows the rate and drops the pressure. Take the apical pulse and the blood pressure BEFORE the dose, do not crush extended release, and skip the grapefruit juice.'
  },

  {
    id: 'lactulose',
    generic: 'Lactulose',
    brand: ['Enulose', 'Kristalose', 'Generlac'],
    classification: 'Osmotic laxative and ammonia-reducing agent',
    use: 'Constipation, and hepatic encephalopathy where it traps ammonia in the colon as ammonium for excretion.',
    highAlert: false,
    nursingConsiderations: [
      'For hepatic encephalopathy, titrate to 2 to 3 SOFT stools per day — that is the therapeutic endpoint, and diarrhea means the dose is too high.',
      'Mix with water, juice, or milk to improve the very sweet taste.',
      'May be given as a retention enema in a patient who cannot take oral medication; retain for 30 to 60 minutes.',
      'Monitor mental status closely in encephalopathy — improving orientation and resolving asterixis show the drug is working.',
      'Watch for dehydration, hypokalemia, and hypernatremia from excessive stooling.',
      'Onset is 24 to 48 hours orally and 30 to 60 minutes rectally.',
      'Use cautiously in diabetic patients because it contains galactose and lactose.'
    ],
    monitoring: ['Number and consistency of stools per day', 'Level of consciousness, orientation, and asterixis', 'Serum ammonia (trends matter more than a single value)', 'Potassium, sodium, and hydration status', 'Daily weight and intake and output'],
    sideEffects: ['Flatulence, bloating, and abdominal cramping', 'Diarrhea', 'Nausea', 'Dehydration', 'Hypokalemia and hypernatremia', 'Very sweet unpleasant taste'],
    holdParameters: 'Hold and notify for severe diarrhea, signs of dehydration, or suspected bowel obstruction. Do not hold simply because the patient is having stools — that is the goal.',
    antidote: 'None. Reduce the dose and replace fluids and electrolytes.',
    atiPearl: 'For hepatic encephalopathy the goal is 2 to 3 soft stools a day. Loose stools are the therapy, not a side effect — but watch the potassium.'
  },

  {
    id: 'sodium-polystyrene-sulfonate',
    generic: 'Sodium polystyrene sulfonate',
    brand: ['Kayexalate', 'SPS', 'Kionex'],
    classification: 'Potassium-binding cation exchange resin',
    use: 'Treatment of hyperkalemia — exchanges sodium for potassium in the colon so potassium is excreted in the stool.',
    highAlert: false,
    nursingConsiderations: [
      'Onset is slow, from 2 to 6 hours up to 24 hours, so it is NOT the treatment for acute life-threatening hyperkalemia with ECG changes. Calcium gluconate, insulin with dextrose, and dialysis come first.',
      'Verify active bowel sounds and the absence of ileus before administering; the drug is contraindicated in obstruction and postoperative ileus.',
      'Risk of intestinal necrosis, particularly with sorbitol-containing preparations and in postoperative or critically ill patients.',
      'Give orally mixed in water, or as a retention enema retained for 30 to 60 minutes, followed by a cleansing enema.',
      'Adds a sodium load — use cautiously in heart failure, hypertension, and edema.',
      'Can also bind calcium and magnesium, causing hypocalcemia and hypomagnesemia.',
      'Newer alternatives such as patiromer and sodium zirconium cyclosilicate are increasingly preferred.'
    ],
    monitoring: ['Serum potassium before and after, at least every 4 to 6 hours during treatment', 'ECG and cardiac rhythm', 'Bowel sounds, abdominal assessment, and stool output', 'Sodium, calcium, and magnesium', 'Signs of fluid overload'],
    sideEffects: ['Constipation or diarrhea', 'Nausea, vomiting, and anorexia', 'HYPOkalemia from overcorrection', 'Hypocalcemia and hypomagnesemia', 'Sodium and fluid retention', 'Intestinal necrosis (rare but potentially fatal)'],
    holdParameters: 'Hold and notify for absent bowel sounds, ileus, bowel obstruction, or a potassium that has already fallen into or below the normal range.',
    antidote: 'None. Stop the drug and correct any resulting hypokalemia.',
    atiPearl: 'Kayexalate makes the patient poop out potassium — so no bowel sounds means no Kayexalate. It is too slow for a hyperkalemic emergency; calcium gluconate and insulin with dextrose come first.'
  },

  {
    id: 'metformin',
    generic: 'Metformin',
    brand: ['Glucophage', 'Glucophage XR', 'Fortamet', 'Riomet'],
    classification: 'Biguanide oral antidiabetic',
    use: 'First-line treatment of type 2 diabetes mellitus. Also used for prediabetes and polycystic ovary syndrome.',
    highAlert: false,
    nursingConsiderations: [
      'HOLD before and for 48 hours after IV iodinated contrast, and restart only after renal function is confirmed stable.',
      'Contraindicated with an eGFR under 30 mL/min/1.73m2; use cautiously between 30 and 45.',
      'Give WITH MEALS to reduce GI upset. Do not crush extended-release tablets.',
      'Does not cause hypoglycemia when used alone, because it does not stimulate insulin secretion — it decreases hepatic glucose production and improves insulin sensitivity.',
      'Teach the signs of lactic acidosis, the rare but often fatal adverse effect: hyperventilation, muscle aches, unusual sleepiness, abdominal discomfort, and malaise.',
      'Risk of lactic acidosis rises with renal impairment, hepatic disease, heart failure, hypoxemia, sepsis, dehydration, and excessive alcohol use.',
      'Long-term use lowers vitamin B12; monitor for anemia and peripheral neuropathy.',
      'Hold before surgery and during any acute illness with dehydration or hypoxia.'
    ],
    monitoring: ['Blood glucose and A1C', 'Renal function: creatinine and eGFR, at least annually', 'Vitamin B12 and complete blood count with long-term use', 'Signs of lactic acidosis', 'Liver function tests'],
    sideEffects: ['Diarrhea, nausea, abdominal cramping, and a metallic taste (usually improve over time)', 'Vitamin B12 deficiency', 'Lactic acidosis (rare, high mortality)', 'Anorexia and modest weight loss'],
    holdParameters: 'Hold for iodinated contrast studies (before and 48 hours after), an eGFR under 30, acute kidney injury, sepsis, hypoxemia, dehydration, or before surgery.',
    antidote: 'No antidote. Lactic acidosis is treated with hemodialysis and supportive care.',
    atiPearl: 'Metformin plus contrast dye equals HOLD for 48 hours. Take it with meals, and it does not cause hypoglycemia by itself — but lactic acidosis is the one thing that kills.'
  },

  {
    id: 'methylergonovine',
    generic: 'Methylergonovine maleate',
    brand: ['Methergine'],
    classification: 'Ergot alkaloid uterotonic (smooth muscle stimulant)',
    use: 'Prevention and treatment of postpartum hemorrhage and uterine atony — produces sustained uterine contraction.',
    highAlert: false,
    nursingConsiderations: [
      'CHECK THE BLOOD PRESSURE BEFORE EVERY DOSE. Contraindicated in hypertension, preeclampsia, and eclampsia because it causes vasoconstriction and can precipitate a hypertensive crisis, seizure, or stroke.',
      'Common hold parameter: systolic pressure at or above 140 or diastolic at or above 90, or per facility protocol.',
      'Usual dose is 0.2 mg IM or PO. The IV route is reserved for emergencies with continuous monitoring because of the severe hypertensive risk.',
      'Assess fundal tone, position, and lochia before and after administration.',
      'Have the patient void before assessing the fundus — a full bladder displaces the uterus and causes atony.',
      'Expect strong, painful cramping; offer analgesia.',
      'Contraindicated with concurrent CYP3A4 inhibitors including erythromycin and protease inhibitors.',
      'Excreted in breast milk in small amounts; follow facility guidance on breastfeeding timing.'
    ],
    monitoring: ['Blood pressure before and after every dose', 'Fundal tone, height, and position', 'Lochia amount, color, and clots; perform pad counts and quantify blood loss', 'Pulse', 'Signs of ergot toxicity: numbness, tingling, and coldness of the extremities', 'Headache and chest pain'],
    sideEffects: ['Hypertension, sometimes severe', 'Headache', 'Nausea and vomiting', 'Painful uterine cramping', 'Dizziness', 'Palpitations and chest pain', 'Seizure and stroke in severe hypertension'],
    holdParameters: 'Hold and notify for elevated blood pressure per protocol (commonly SBP 140 or above, or DBP 90 or above), preeclampsia, or any hypertensive disorder of pregnancy.',
    antidote: 'No specific antidote. Treat severe hypertension with an antihypertensive such as labetalol or hydralazine, and manage vasospasm supportively.',
    atiPearl: 'Methergine equals blood pressure check every single time. Hypertension or preeclampsia means DO NOT GIVE — use oxytocin instead.'
  },

  {
    id: 'amiodarone',
    generic: 'Amiodarone',
    brand: ['Cordarone', 'Pacerone', 'Nexterone'],
    classification: 'Class III antiarrhythmic (potassium channel blocker with class I, II, and IV properties)',
    use: 'Life-threatening ventricular dysrhythmias, ventricular fibrillation and pulseless ventricular tachycardia during cardiac arrest, and conversion or rate control of atrial fibrillation.',
    highAlert: true,
    nursingConsiderations: [
      'IV administration requires a pump, continuous cardiac monitoring, and frequent blood pressure checks.',
      'Use an in-line filter for IV administration and non-PVC tubing or a glass container for prolonged infusions, because amiodarone leaches plasticizer from PVC.',
      'A central line is preferred for concentrations above 2 mg/mL because of severe phlebitis.',
      'Extremely long half-life of 40 to 55 days — adverse effects persist for weeks to months after the drug is stopped.',
      'Prolongs the QT interval; avoid combining with other QT-prolonging drugs and correct potassium and magnesium.',
      'RAISES digoxin levels — the digoxin dose is typically cut in half. Also raises warfarin levels, so the warfarin dose usually needs reduction and closer INR monitoring.',
      'Baseline and periodic chest x-ray, pulmonary function tests, thyroid function tests, liver function tests, and an ophthalmologic exam are required.',
      'Teach photosensitivity precautions; a blue-gray skin discoloration can develop with long-term use.',
      'Avoid grapefruit juice.'
    ],
    monitoring: ['Continuous ECG, QT interval, heart rate, and rhythm', 'Blood pressure', 'Chest x-ray and pulmonary function tests for pulmonary toxicity', 'Thyroid function tests (both hypo- and hyperthyroidism occur)', 'Liver function tests', 'Ophthalmologic exam for corneal microdeposits', 'Digoxin level and INR when co-administered', 'Potassium and magnesium'],
    sideEffects: ['Pulmonary toxicity and pulmonary fibrosis (potentially fatal)', 'Hypotension and bradycardia', 'QT prolongation and torsades de pointes', 'Hypothyroidism or hyperthyroidism', 'Hepatotoxicity', 'Corneal microdeposits and optic neuropathy', 'Blue-gray skin discoloration and photosensitivity', 'Phlebitis at the IV site', 'Peripheral neuropathy and ataxia'],
    holdParameters: 'Hold and notify for symptomatic bradycardia, heart rate under 60, systolic blood pressure under 90, a significantly prolonged QT interval, or new dyspnea and cough suggesting pulmonary toxicity.',
    antidote: 'No antidote. Manage supportively; treat bradycardia with atropine or pacing and hypotension with fluids and vasopressors.',
    atiPearl: 'Amiodarone hits the Lungs, Liver, Thyroid, and Eyes — and it lives in the body for months. Whenever it is started, look at the digoxin dose and the warfarin dose, because both levels go up.'
  },

  {
    id: 'glucagon',
    generic: 'Glucagon',
    brand: ['GlucaGen', 'Gvoke', 'Baqsimi (nasal)'],
    classification: 'Antihypoglycemic hormone (pancreatic alpha cell hormone)',
    use: 'Severe hypoglycemia in a patient who is unconscious or unable to take oral carbohydrate. Also used as an antidote for beta blocker and calcium channel blocker overdose, and to relax GI smooth muscle for radiologic procedures.',
    highAlert: false,
    nursingConsiderations: [
      'Usual adult dose is 1 mg IM, subQ, or IV. Pediatric dosing is 0.5 mg for a child under 25 kg or under 6 years.',
      'Reconstitute with the supplied diluent, use immediately, and do not use if the solution is not clear.',
      'TURN THE PATIENT ONTO THEIR SIDE — glucagon frequently causes vomiting and the patient is at high aspiration risk while unconscious.',
      'Response occurs within 5 to 20 minutes. If there is no response after 15 minutes, repeat the dose and give IV dextrose 50 percent.',
      'As soon as the patient is awake and able to swallow, give a rapidly absorbed carbohydrate followed by a protein-containing snack or meal, because glucagon depletes hepatic glycogen and the glucose will fall again.',
      'May be INEFFECTIVE when glycogen stores are depleted: starvation, adrenal insufficiency, chronic hypoglycemia, and chronic alcohol use.',
      'Teach the family or caregiver how and when to use the home glucagon kit or nasal product, and to call emergency services.'
    ],
    monitoring: ['Blood glucose every 15 minutes until stable', 'Level of consciousness and neurologic status', 'Airway and aspiration risk', 'Vital signs', 'Potassium — glucagon can cause hypokalemia', 'Recurrence of hypoglycemia over the following hours'],
    sideEffects: ['Nausea and vomiting (very common)', 'Hyperglycemia', 'Hypokalemia', 'Tachycardia and hypertension', 'Headache and dizziness', 'Allergic reaction (rare)'],
    holdParameters: 'No hold parameters — this is an emergency medication. It is contraindicated in pheochromocytoma and insulinoma.',
    antidote: 'None needed. Treat resulting hyperglycemia and hypokalemia supportively.',
    atiPearl: 'Unconscious and hypoglycemic equals glucagon — and turn the patient on their side, because they will probably vomit. When they wake up, feed them carbohydrate plus protein or the glucose crashes again.'
  },

  {
    id: 'lorazepam',
    generic: 'Lorazepam',
    brand: ['Ativan'],
    classification: 'Benzodiazepine (GABA-A receptor agonist; Schedule IV)',
    use: 'Anxiety, status epilepticus and acute seizures, alcohol withdrawal, preoperative sedation, and chemotherapy-induced nausea.',
    highAlert: false,
    nursingConsiderations: [
      'Assess respiratory rate and level of consciousness before and after every dose.',
      'IV push slowly, no faster than 2 mg per minute, diluted, with resuscitation equipment available.',
      'Profound additive respiratory depression when combined with opioids — this combination carries a boxed warning.',
      'On the Beers criteria list for older adults: causes falls, confusion, and paradoxical agitation.',
      'Never stop abruptly after prolonged use; withdrawal causes seizures. Taper as ordered.',
      'For alcohol withdrawal, dose according to a CIWA protocol and reassess frequently.',
      'Institute fall precautions and keep the bed low with the call light in reach.',
      'Teach the patient to avoid alcohol and driving.'
    ],
    monitoring: ['Respiratory rate, depth, and oxygen saturation', 'Level of consciousness and sedation scale', 'Blood pressure and heart rate', 'Fall risk', 'CIWA score in alcohol withdrawal', 'Seizure activity', 'Signs of paradoxical agitation, especially in older adults and children'],
    sideEffects: ['Respiratory depression', 'Sedation, drowsiness, and dizziness', 'Ataxia and falls', 'Confusion and anterograde amnesia', 'Hypotension', 'Paradoxical agitation', 'Physical dependence and withdrawal seizures'],
    holdParameters: 'Hold and notify for a respiratory rate under 12, oxygen saturation under 90 percent, excessive sedation, or significant hypotension.',
    antidote: 'Flumazenil (Romazicon) — used cautiously because it can precipitate seizures in benzodiazepine-dependent patients and in mixed overdoses.',
    atiPearl: 'Benzodiazepines plus opioids equals respiratory depression. Count the respirations before you give it, and remember the antidote is flumazenil.'
  },

  {
    id: 'haloperidol',
    generic: 'Haloperidol',
    brand: ['Haldol', 'Haldol Decanoate'],
    classification: 'First-generation (typical) antipsychotic — butyrophenone, dopamine D2 antagonist',
    use: 'Schizophrenia, acute psychosis, severe agitation, Tourette syndrome, and delirium with agitation. The decanoate form is a long-acting depot injection.',
    highAlert: false,
    nursingConsiderations: [
      'Boxed warning: increased mortality in older adults with dementia-related psychosis.',
      'Monitor for extrapyramidal symptoms: acute dystonia (spasm of the neck, jaw, or eyes), akathisia (motor restlessness), pseudoparkinsonism (tremor, rigidity, shuffling gait), and tardive dyskinesia (involuntary lip smacking and tongue movements, often irreversible).',
      'Treat acute dystonia urgently with IV or IM diphenhydramine or benztropine — a laryngeal or oculogyric dystonia is an emergency.',
      'Watch for neuroleptic malignant syndrome: high fever, severe muscle rigidity, altered mental status, autonomic instability, and a rising creatine kinase. This is a medical emergency — stop the drug immediately.',
      'Prolongs the QT interval. IV haloperidol is not FDA approved and requires continuous cardiac monitoring where it is used.',
      'The decanoate is a deep IM injection using the Z-track technique with a 21 gauge needle; never give the decanoate IV.',
      'Lowers the seizure threshold and causes photosensitivity and orthostatic hypotension.',
      'Monitor for anticholinergic effects: dry mouth, constipation, urinary retention, and blurred vision.'
    ],
    monitoring: ['ECG and QT interval, plus potassium and magnesium', 'Abnormal Involuntary Movement Scale (AIMS) for tardive dyskinesia', 'Temperature and muscle rigidity for neuroleptic malignant syndrome', 'Blood pressure sitting and standing', 'Complete blood count for agranulocytosis', 'Mental status and behavior', 'Bowel and bladder function'],
    sideEffects: ['Extrapyramidal symptoms including acute dystonia, akathisia, pseudoparkinsonism, and tardive dyskinesia', 'Neuroleptic malignant syndrome', 'QT prolongation and torsades de pointes', 'Sedation', 'Orthostatic hypotension', 'Anticholinergic effects', 'Lowered seizure threshold', 'Agranulocytosis (rare)', 'Photosensitivity'],
    holdParameters: 'Hold and notify for a significantly prolonged QTc, signs of neuroleptic malignant syndrome, acute dystonia, or severe hypotension.',
    antidote: 'No antidote for the drug itself. Treat extrapyramidal symptoms with diphenhydramine or benztropine; treat neuroleptic malignant syndrome by stopping the drug and giving dantrolene or bromocriptine with aggressive cooling and supportive care.',
    atiPearl: 'Haldol equals movement problems. Learn the four extrapyramidal patterns, and remember that fever plus rigidity plus altered mental status equals neuroleptic malignant syndrome — stop the drug and call the provider now.'
  },

  {
    id: 'cefazolin',
    generic: 'Cefazolin',
    brand: ['Ancef', 'Kefzol'],
    classification: 'First-generation cephalosporin antibiotic (bactericidal, beta-lactam)',
    use: 'Skin and soft tissue infections, bone and joint infections, urinary tract infections, endocarditis prophylaxis, and surgical prophylaxis against gram-positive organisms.',
    highAlert: false,
    nursingConsiderations: [
      'For surgical prophylaxis, infuse within 60 minutes before the incision so tissue levels are adequate at the time of surgery.',
      'Screen for penicillin allergy — cross-sensitivity with cephalosporins is roughly 1 to 3 percent, and a history of anaphylaxis to penicillin is generally a contraindication.',
      'Obtain cultures BEFORE the first antibiotic dose whenever possible.',
      'Infuse an IV piggyback over 30 minutes; IM injections are painful and go into a large muscle.',
      'Requires renal dose adjustment; monitor creatinine.',
      'Teach the patient to complete the entire course.',
      'Monitor for superinfection: C. difficile diarrhea and oral or vaginal candidiasis.',
      'Cephalosporins may cause a disulfiram-like reaction with alcohol and may raise the INR in patients on warfarin.'
    ],
    monitoring: ['Temperature, white blood cell count, and culture results', 'Signs of hypersensitivity: rash, urticaria, wheezing, angioedema', 'Renal function', 'IV site for phlebitis', 'Stool pattern for C. difficile', 'INR if the patient is on warfarin'],
    sideEffects: ['Diarrhea and nausea', 'Rash and hypersensitivity reactions', 'Pain and phlebitis at the injection site', 'Superinfection including C. difficile and candidiasis', 'Transient elevations in liver enzymes', 'Seizures with very high doses in renal impairment'],
    holdParameters: 'Hold and notify for any sign of hypersensitivity, a documented severe penicillin or cephalosporin allergy, or severe or bloody diarrhea.',
    antidote: 'None. Discontinue and treat anaphylaxis with epinephrine, antihistamines, corticosteroids, and airway support.',
    atiPearl: 'Ancef is the classic pre-op antibiotic — in within 60 minutes of the incision. Always ask about penicillin allergy first, and always draw the cultures before the first dose.'
  },

  {
    id: 'morphine',
    generic: 'Morphine sulfate',
    brand: ['MS Contin', 'Duramorph', 'Roxanol', 'Astramorph'],
    classification: 'Opioid agonist analgesic (Schedule II controlled substance)',
    use: 'Moderate to severe acute and chronic pain, myocardial infarction pain with preload reduction, and dyspnea in acute pulmonary edema and at end of life.',
    highAlert: true,
    nursingConsiderations: [
      'Assess respiratory rate, depth, and sedation level before and after every dose. Sedation precedes respiratory depression, so a sedation scale is the earliest warning.',
      'IV push slowly over 4 to 5 minutes, diluted, with naloxone immediately available.',
      'Never crush an extended-release tablet such as MS Contin — the entire 12-hour dose would be released at once, which can be fatal.',
      'Start a bowel regimen with any scheduled opioid; constipation is the one effect that never develops tolerance.',
      'Metabolites accumulate in renal impairment, causing prolonged sedation and neurotoxicity; hydromorphone or fentanyl is often preferred in renal failure.',
      'Requires controlled-substance count and witnessed waste with a second nurse.',
      'Reassess pain 15 to 30 minutes after an IV dose and 30 to 60 minutes after an oral dose, and document effectiveness.',
      'Additive respiratory depression with benzodiazepines, alcohol, and other CNS depressants.',
      'Use cautiously in head injury because it can mask neurologic changes and raise intracranial pressure.'
    ],
    monitoring: ['Respiratory rate, depth, and oxygen saturation', 'Sedation scale', 'Pain score before and after', 'Blood pressure — morphine causes histamine-mediated vasodilation and hypotension', 'Bowel function', 'Urinary output for retention', 'Pupil size'],
    sideEffects: ['Respiratory depression', 'Sedation', 'Constipation', 'Nausea and vomiting', 'Pruritus and flushing from histamine release', 'Hypotension', 'Urinary retention', 'Miosis (pinpoint pupils)', 'Physical dependence and tolerance'],
    holdParameters: 'Hold and notify for a respiratory rate under 12, oxygen saturation under 90 percent, excessive sedation, or significant hypotension.',
    antidote: 'Naloxone (Narcan). Note that the duration of naloxone is shorter than that of morphine, so repeat doses or an infusion may be required.',
    atiPearl: 'Count the respirations before AND after. Under 12 means hold and reassess. Naloxone is the antidote, and it wears off before the opioid does — keep watching the patient.'
  },

  {
    id: 'ceftriaxone',
    generic: 'Ceftriaxone',
    brand: ['Rocephin'],
    classification: 'Third-generation cephalosporin antibiotic (bactericidal, beta-lactam)',
    use: 'Community-acquired pneumonia, meningitis, pyelonephritis and complicated urinary tract infections, gonorrhea, Lyme disease, and intra-abdominal and pelvic infections. Penetrates the blood-brain barrier well.',
    highAlert: false,
    nursingConsiderations: [
      'NEVER mix or co-administer with calcium-containing solutions, including lactated Ringer — the combination forms a precipitate that has been fatal in neonates. Contraindicated in neonates receiving IV calcium.',
      'If a calcium-containing fluid must run through the same line, flush thoroughly with normal saline before and after; a separate line or lumen is preferred.',
      'Screen for penicillin and cephalosporin allergy.',
      'Obtain cultures before the first dose.',
      'Long half-life allows once-daily dosing, and no renal dose adjustment is generally required because of biliary excretion.',
      'IM reconstitution is painful; lidocaine 1 percent may be used as the diluent when ordered, and the IM route is given deep into a large muscle.',
      'Can cause biliary sludge or pseudocholelithiasis, especially in children; report right upper quadrant pain.',
      'Watch for C. difficile — third-generation cephalosporins are among the highest-risk antibiotics.'
    ],
    monitoring: ['Temperature, white blood cell count, and cultures', 'Signs of hypersensitivity', 'Complete blood count for hemolytic anemia and eosinophilia', 'Liver function and right upper quadrant pain', 'Stool pattern for C. difficile', 'IV site'],
    sideEffects: ['Diarrhea, including C. difficile colitis', 'Rash and hypersensitivity reactions', 'Pain at the IM or IV site', 'Biliary sludge and pseudocholelithiasis', 'Eosinophilia and hemolytic anemia (rare)', 'Elevated liver enzymes'],
    holdParameters: 'Hold and notify for any sign of hypersensitivity, a severe penicillin or cephalosporin allergy, concurrent calcium-containing IV fluid that cannot be separated, or severe or bloody diarrhea.',
    antidote: 'None. Discontinue and treat anaphylaxis with epinephrine and supportive care.',
    atiPearl: 'Rocephin and calcium do not mix — no lactated Ringer in the same line, and absolutely never in a neonate. Once daily dosing, and it crosses into the cerebrospinal fluid, which is why it is a meningitis drug.'
  },

  {
    id: 'insulin-regular',
    generic: 'Insulin human (Regular, short-acting)',
    brand: ['Humulin R', 'Novolin R', 'Humulin R U-500'],
    classification: 'Short-acting insulin',
    use: 'Glycemic control in type 1 and type 2 diabetes, diabetic ketoacidosis and hyperosmolar hyperglycemic state (by continuous IV infusion), and treatment of hyperkalemia when given with dextrose.',
    highAlert: true,
    nursingConsiderations: [
      'Onset 30 to 60 minutes, peak 2 to 3 hours, duration 5 to 8 hours. Give 30 minutes before the meal.',
      'The ONLY insulin that can be given intravenously. Regular insulin is used for all IV insulin infusions and for DKA protocols.',
      'CLEAR solution. When mixing with NPH, draw the CLEAR (Regular) insulin FIRST — clear before cloudy, RN order (Regular then NPH).',
      'Use a U-100 insulin syringe only; never a tuberculin or 3 mL syringe. U-500 requires a dedicated U-500 syringe or pen and carries an extremely high error risk.',
      'Requires a second-nurse independent double check of the insulin type, concentration, and units drawn.',
      'Confirm the meal is available before giving prandial insulin.',
      'Rotate subcutaneous injection sites to prevent lipohypertrophy; the abdomen absorbs fastest, then the arm, thigh, and buttock.',
      'IV insulin adsorbs to plastic tubing — prime the tubing with the insulin solution and use a dedicated pump.'
    ],
    monitoring: ['Blood glucose before the dose, at the expected peak, and per protocol', 'Potassium, especially with IV insulin — insulin drives potassium into the cell', 'Signs of hypoglycemia: shakiness, sweating, tachycardia, hunger, confusion, irritability', 'Injection sites for lipohypertrophy', 'A1C'],
    sideEffects: ['Hypoglycemia', 'Hypokalemia', 'Lipohypertrophy or lipoatrophy at injection sites', 'Weight gain', 'Local injection site reactions'],
    holdParameters: 'Hold and treat for a blood glucose under 70 mg/dL. Hold prandial doses if the patient is NPO or the meal is not going to be eaten.',
    antidote: 'For conscious hypoglycemia: 15 g of fast-acting carbohydrate, recheck in 15 minutes (the rule of 15). For unconscious hypoglycemia: IV dextrose 50 percent or glucagon 1 mg IM, subQ, or IV.',
    atiPearl: 'Regular insulin is the only one that goes IV, and it is the CLEAR one you draw FIRST when mixing. Onset 30 minutes, peak 2 to 3 hours — that peak is when hypoglycemia shows up.'
  },

  {
    id: 'insulin-nph',
    generic: 'Insulin isophane (NPH, intermediate-acting)',
    brand: ['Humulin N', 'Novolin N', 'ReliOn N'],
    classification: 'Intermediate-acting insulin',
    use: 'Basal glycemic control in type 1 and type 2 diabetes, usually given once or twice daily, often mixed with a short- or rapid-acting insulin.',
    highAlert: true,
    nursingConsiderations: [
      'Onset 1 to 2 hours, peak 4 to 12 hours, duration 14 to 24 hours. The peak is when hypoglycemia is most likely — if given before breakfast, watch through the afternoon.',
      'NEVER give NPH intravenously. It is a suspension.',
      'The only CLOUDY insulin. ROLL the vial gently between the palms to resuspend it — never shake, because shaking creates bubbles that displace insulin volume.',
      'When mixing with Regular insulin: inject air into the NPH vial first without withdrawing, then air into the Regular vial, then draw Regular (clear), then NPH (cloudy). Clear before cloudy.',
      'Use a U-100 insulin syringe only, and complete a second-nurse independent double check.',
      'Ensure a bedtime snack is available when NPH is given in the evening, because the peak occurs during sleep.',
      'Rotate injection sites within one anatomic region to keep absorption consistent.',
      'Never mix NPH with insulin glargine or detemir.'
    ],
    monitoring: ['Blood glucose before doses and around the expected peak', 'Overnight and early morning glucose when NPH is given at bedtime', 'Signs of hypoglycemia', 'Injection sites', 'A1C'],
    sideEffects: ['Hypoglycemia, especially at the 4 to 12 hour peak', 'Lipohypertrophy at injection sites', 'Weight gain', 'Hypokalemia', 'Local injection site reactions'],
    holdParameters: 'Hold and treat for a blood glucose under 70 mg/dL, and clarify with the provider if the patient is NPO for a prolonged period.',
    antidote: 'For conscious hypoglycemia: 15 g of fast-acting carbohydrate and recheck in 15 minutes. For unconscious hypoglycemia: IV dextrose 50 percent or glucagon 1 mg.',
    atiPearl: 'NPH is the cloudy one — roll it, never shake it, and never give it IV. Peak is 4 to 12 hours out, so an evening dose means checking the glucose overnight.'
  },

  {
    id: 'insulin-lispro',
    generic: 'Insulin lispro (rapid-acting)',
    brand: ['Humalog', 'Admelog', 'Lyumjev'],
    classification: 'Rapid-acting insulin analog',
    use: 'Mealtime (prandial) coverage and correction of hyperglycemia in type 1 and type 2 diabetes; also used in insulin pumps.',
    highAlert: true,
    nursingConsiderations: [
      'Onset 10 to 15 minutes, peak 1 to 2 hours, duration 3 to 5 hours. Give within 15 minutes BEFORE the meal or immediately after eating.',
      'THE TRAY MUST BE THERE. Confirm the meal is present and that the patient is going to eat before administering. No tray, no rapid-acting insulin.',
      'Clear solution. May be mixed with NPH — draw the lispro (clear) first — but administer immediately after mixing.',
      'Humalog and Humulin R are a classic look-alike/sound-alike pair. Read the label three times and confirm the exact product.',
      'Use a U-100 insulin syringe or the manufacturer pen, and complete a second-nurse independent double check.',
      'When used in a correction or sliding scale, match the actual fingerstick value to the correct row and read the ordered units out loud.',
      'Do not stack correction doses — respect the ordered interval, because the previous dose is still working.',
      'Rotate sites; the abdomen absorbs most rapidly and predictably.'
    ],
    monitoring: ['Fingerstick blood glucose within 30 minutes before the dose and again at the 1 to 2 hour peak', 'Meal intake — document how much the patient actually ate', 'Signs of hypoglycemia', 'Potassium', 'A1C', 'Injection sites'],
    sideEffects: ['Hypoglycemia, and it comes on fast', 'Lipohypertrophy', 'Weight gain', 'Hypokalemia', 'Injection site reactions'],
    holdParameters: 'Hold and treat for a blood glucose under 70 mg/dL. Hold if the meal tray is not present, if the patient is NPO, or if the patient is unlikely to eat.',
    antidote: 'For conscious hypoglycemia: 15 g of fast-acting carbohydrate and recheck in 15 minutes. For unconscious hypoglycemia: IV dextrose 50 percent or glucagon 1 mg.',
    atiPearl: 'Rapid-acting insulin means the food is in front of the patient right now. Lispro works in 15 minutes and peaks in about an hour — if the tray is late, hold the dose.'
  },

  {
    id: 'hydromorphone',
    generic: 'Hydromorphone',
    brand: ['Dilaudid', 'Exalgo'],
    classification: 'Opioid agonist analgesic (Schedule II controlled substance)',
    use: 'Moderate to severe pain, including in opioid-tolerant patients and in patients with renal impairment where morphine metabolites would accumulate.',
    highAlert: true,
    nursingConsiderations: [
      'Roughly 5 to 7 times more potent than morphine: 1.5 mg IV hydromorphone is approximately equal to 10 mg IV morphine. Dosing errors with this drug are frequently fatal.',
      'DILAUDID IS HYDROMORPHONE. Always cross-reference brand and generic names against the allergy list before administering.',
      'Classic look-alike/sound-alike confusion with morphine — read the label three times and verify the concentration on the vial.',
      'Assess respiratory rate, depth, and sedation before and after every dose; sedation precedes respiratory depression.',
      'IV push slowly over 2 to 3 minutes, diluted, with naloxone immediately available.',
      'Start a bowel regimen with any scheduled opioid.',
      'Requires controlled-substance count and witnessed waste with a second nurse.',
      'Reassess pain 15 to 30 minutes after an IV dose and document the response.',
      'Additive respiratory depression with benzodiazepines and other CNS depressants.'
    ],
    monitoring: ['Respiratory rate, depth, and oxygen saturation', 'Sedation scale', 'Pain score before and after', 'Blood pressure', 'Bowel function', 'Level of consciousness', 'Pupil size'],
    sideEffects: ['Respiratory depression', 'Sedation and dizziness', 'Constipation', 'Nausea and vomiting', 'Pruritus', 'Hypotension', 'Urinary retention', 'Miosis', 'Physical dependence and tolerance'],
    holdParameters: 'Hold and notify for a respiratory rate under 12, oxygen saturation under 90 percent, excessive sedation, or significant hypotension. ABSOLUTE contraindication with a documented hydromorphone or Dilaudid allergy.',
    antidote: 'Naloxone (Narcan). Repeat doses or an infusion may be needed because naloxone has a shorter duration than hydromorphone.',
    atiPearl: 'Dilaudid IS hydromorphone, and it is many times stronger than morphine. Never assume the two are interchangeable milligram for milligram, and always screen the allergy list for BOTH names.'
  },

  {
    id: 'hydralazine',
    generic: 'Hydralazine',
    brand: ['Apresoline'],
    classification: 'Direct-acting arterial vasodilator antihypertensive',
    use: 'Hypertension, hypertensive urgency and emergency, hypertension in pregnancy and preeclampsia, and heart failure in combination with isosorbide dinitrate.',
    highAlert: false,
    nursingConsiderations: [
      'CHECK THE BLOOD PRESSURE IMMEDIATELY BEFORE EVERY DOSE and again 15 to 30 minutes after, and honor the ordered hold parameter.',
      'IV onset is 5 to 20 minutes with a peak at 10 to 80 minutes; oral onset is 20 to 30 minutes with a peak at 1 to 2 hours.',
      'Causes REFLEX TACHYCARDIA — monitor the heart rate as well as the pressure. It is often paired with a beta blocker for this reason.',
      'Also causes sodium and water retention, so it is frequently combined with a diuretic.',
      'Long-term high-dose therapy can produce a drug-induced lupus-like syndrome: fever, arthralgia, myalgia, and rash. Report these symptoms.',
      'Teach the patient to rise slowly because of orthostatic hypotension, and assess fall risk.',
      'Do NOT confuse hydrALAZINE with hydrOXYzine or hydrochlorothiazide — a classic look-alike/sound-alike trio. Use tall-man lettering.',
      'A PRN antihypertensive requires an actual elevated blood pressure as the indication, not simply that the dose is due.'
    ],
    monitoring: ['Blood pressure before and 15 to 30 minutes after every dose', 'Heart rate for reflex tachycardia', 'Daily weight and edema for fluid retention', 'Antinuclear antibody titer with long-term therapy', 'Signs of lupus-like syndrome', 'Orthostatic vital signs and fall risk'],
    sideEffects: ['Hypotension', 'Reflex tachycardia and palpitations', 'Headache and flushing', 'Dizziness and orthostatic hypotension', 'Sodium and water retention with edema', 'Drug-induced lupus-like syndrome', 'Angina in patients with coronary artery disease'],
    holdParameters: 'Hold and notify for a systolic blood pressure below the ordered threshold (commonly under 110 mmHg), symptomatic hypotension, or marked tachycardia. For a PRN order, do not give without a genuine hypertensive indication.',
    antidote: 'No specific antidote. Treat hypotension with supine positioning with the legs elevated, IV fluids, and vasopressors if needed.',
    atiPearl: 'Blood pressure before and after, every time. Hydralazine drops the pressure and drives the heart rate UP — and do not mix it up with hydrOXYzine or hydrochlorothiazide.'
  }

];
