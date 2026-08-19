/* ============================================================================
 * MedMaster - data/headtotoe.js
 * The ICHS Head-to-Toe Assessment Rubric.
 *
 * GENERATED from the iOS source of truth
 * (MedMaster/Features/HeadToToe/HeadToToeData.swift) rather than retyped, so the
 * two platforms cannot drift. If you change the rubric, change it there and
 * re-generate — a hand edit here will be silently overwritten.
 *
 * Transcribed from the student's own graded sheet: 13 categories, 71 items,
 * exactly 100 points. Category subtotals were reconciled against the printed
 * sheet before this file existed.
 * ==========================================================================*/
window.H2T_RUBRIC = {
  totalPoints: 100,
  cohorts: {
    fundamentals: { label: 'Fundamentals', passMark: 78, timeLimitSeconds: 900 },
    medSurg1:     { label: 'Med Surg 1',   passMark: 75, timeLimitSeconds: 720 },
    medSurg2:     { label: 'Med Surg 2',   passMark: 75, timeLimitSeconds: 720 },
    capstone:     { label: 'Capstone',     passMark: 78, timeLimitSeconds: 720 }
  },
  cranialNerves: ['I Olfactory','II Optic','III Oculomotor','IV Trochlear','V Trigeminal','VI Abducens','VII Facial','VIII Vestibulocochlear','IX Glossopharyngeal','X Vagus','XI Accessory','XII Hypoglossal'],
  categories: [
  {
    "id": "general",
    "name": "General Survey & Introduction",
    "points": 10,
    "items": [
      {
        "id": "kiwep",
        "text": "Performs KIWEP (Knock, Introduce, Wash hands, Explain, provide Privacy)",
        "points": 5,
        "cues": [
          "knock",
          "my name is",
          "wash my hands",
          "hand hygiene",
          "explain",
          "privacy",
          "curtain"
        ]
      },
      {
        "id": "verify_id",
        "text": "Verifies ID",
        "points": 1,
        "cues": [
          "date of birth",
          "two identifiers",
          "verify your name",
          "armband",
          "wristband"
        ]
      },
      {
        "id": "general_obs",
        "text": "Observes Posture, Hygiene, Affect, and Mobility aids",
        "points": 4,
        "cues": [
          "posture",
          "hygiene",
          "affect",
          "mobility",
          "walker",
          "cane"
        ]
      }
    ]
  },
  {
    "id": "vitals",
    "name": "Vital Signs & Pain",
    "points": 15,
    "items": [
      {
        "id": "temp",
        "text": "Temperature \u2014 measures and states normal range",
        "points": 2,
        "cues": [
          "temperature",
          "temp",
          "97",
          "98.6",
          "afebrile"
        ]
      },
      {
        "id": "hr",
        "text": "HR \u2014 measures and states normal range",
        "points": 2,
        "cues": [
          "heart rate",
          "pulse",
          "60 to 100",
          "beats per minute"
        ]
      },
      {
        "id": "rr",
        "text": "RR \u2014 measures and states normal range",
        "points": 2,
        "cues": [
          "respiratory rate",
          "respirations",
          "12 to 20",
          "breaths per minute"
        ]
      },
      {
        "id": "bp",
        "text": "BP \u2014 measures and states normal range",
        "points": 2,
        "cues": [
          "blood pressure",
          "systolic",
          "diastolic",
          "120 over 80"
        ]
      },
      {
        "id": "spo2",
        "text": "O2 sat \u2014 measures and states normal range",
        "points": 2,
        "cues": [
          "oxygen saturation",
          "o2 sat",
          "pulse ox",
          "95",
          "spo2"
        ]
      },
      {
        "id": "pain",
        "text": "Assesses Pain using appropriate Pain Scale (numeric), PQRST/OLDCARTS",
        "points": 5,
        "cues": [
          "pain scale",
          "zero to ten",
          "0 to 10",
          "pqrst",
          "oldcarts",
          "provocation",
          "quality",
          "radiation",
          "severity",
          "timing",
          "onset"
        ]
      }
    ]
  },
  {
    "id": "neuro",
    "name": "Neurological",
    "points": 10,
    "items": [
      {
        "id": "loc",
        "text": "Assesses LOC",
        "points": 1,
        "cues": [
          "level of consciousness",
          "alert",
          "loc"
        ]
      },
      {
        "id": "orientation",
        "text": "Orientation",
        "points": 4,
        "cues": [
          "oriented",
          "person place time",
          "a and o",
          "what year",
          "where are you"
        ]
      },
      {
        "id": "strength",
        "text": "Strength (BUE/BLE)",
        "points": 2,
        "cues": [
          "squeeze my hands",
          "grip strength",
          "push against",
          "pull",
          "bilateral upper",
          "bilateral lower"
        ]
      },
      {
        "id": "cranial",
        "text": "Cranial nerves \u2014 instructor selects 3 CNs to assess",
        "points": 3,
        "cues": [
          "cranial nerve",
          "follow my finger",
          "smile for me",
          "shrug",
          "stick out your tongue",
          "puff your cheeks"
        ]
      }
    ]
  },
  {
    "id": "heent",
    "name": "HEENT",
    "points": 6,
    "items": [
      {
        "id": "head",
        "text": "Inspects Head/Scalp",
        "points": 2,
        "cues": [
          "head",
          "scalp",
          "lesions"
        ]
      },
      {
        "id": "eyes",
        "text": "Eyes",
        "points": 1,
        "cues": [
          "eyes",
          "pupils",
          "perrla",
          "sclera",
          "conjunctiva"
        ]
      },
      {
        "id": "ears",
        "text": "Ears",
        "points": 1,
        "cues": [
          "ears",
          "hearing",
          "drainage"
        ]
      },
      {
        "id": "nose",
        "text": "Nose patency",
        "points": 1,
        "cues": [
          "nose",
          "patency",
          "nostril",
          "breathe through"
        ]
      },
      {
        "id": "oral",
        "text": "Oral mucosa",
        "points": 1,
        "cues": [
          "oral mucosa",
          "mouth",
          "tongue",
          "moist",
          "gums"
        ]
      }
    ]
  },
  {
    "id": "neck",
    "name": "Neck",
    "points": 6,
    "items": [
      {
        "id": "neck_sym",
        "text": "Inspects for Symmetry",
        "points": 1,
        "cues": [
          "symmetry",
          "symmetric",
          "neck"
        ]
      },
      {
        "id": "carotids",
        "text": "Palpates Carotids",
        "points": 1,
        "cues": [
          "carotid",
          "palpate the carotid",
          "one side at a time"
        ]
      },
      {
        "id": "bruit",
        "text": "Assesses for Carotid Bruit",
        "points": 1,
        "cues": [
          "bruit",
          "listen to the carotid"
        ]
      },
      {
        "id": "lymph",
        "text": "Palpates Lymph nodes",
        "points": 1,
        "cues": [
          "lymph node",
          "lymph"
        ]
      },
      {
        "id": "jvd",
        "text": "Assesses JVD",
        "points": 1,
        "cues": [
          "jvd",
          "jugular",
          "jugular venous distension"
        ]
      },
      {
        "id": "trachea",
        "text": "Trachea midline",
        "points": 1,
        "cues": [
          "trachea",
          "midline"
        ]
      }
    ]
  },
  {
    "id": "resp",
    "name": "Respiratory",
    "points": 8,
    "items": [
      {
        "id": "resp_sym",
        "text": "Inspects Symmetry",
        "points": 1,
        "cues": [
          "chest symmetry",
          "symmetric",
          "chest rise"
        ]
      },
      {
        "id": "effort",
        "text": "Effort",
        "points": 1,
        "cues": [
          "effort",
          "accessory muscle",
          "labored",
          "work of breathing"
        ]
      },
      {
        "id": "lungs_ant",
        "text": "Auscultates Lungs Anterior",
        "points": 1,
        "cues": [
          "anterior",
          "front"
        ]
      },
      {
        "id": "lungs_post",
        "text": "Posterior",
        "points": 1,
        "cues": [
          "posterior",
          "back"
        ]
      },
      {
        "id": "lungs_loc",
        "text": "In 8-10 locations",
        "points": 1,
        "cues": [
          "8 locations",
          "10 locations",
          "eight",
          "ten",
          "compare side to side"
        ]
      },
      {
        "id": "cough",
        "text": "Checks Cough",
        "points": 1,
        "cues": [
          "cough"
        ]
      },
      {
        "id": "sputum",
        "text": "Assesses Sputum",
        "points": 1,
        "cues": [
          "sputum",
          "phlegm",
          "productive"
        ]
      },
      {
        "id": "o2use",
        "text": "Oxygen use",
        "points": 1,
        "cues": [
          "oxygen",
          "nasal cannula",
          "room air",
          "liters"
        ]
      }
    ]
  },
  {
    "id": "cv",
    "name": "Cardiovascular",
    "points": 13,
    "items": [
      {
        "id": "temporal",
        "text": "Palpates Temporal pulse",
        "points": 1,
        "cues": [
          "temporal"
        ]
      },
      {
        "id": "brachial",
        "text": "Brachial",
        "points": 1,
        "cues": [
          "brachial"
        ]
      },
      {
        "id": "radial",
        "text": "Radial",
        "points": 1,
        "cues": [
          "radial"
        ]
      },
      {
        "id": "ulnar",
        "text": "Ulnar",
        "points": 1,
        "cues": [
          "ulnar"
        ]
      },
      {
        "id": "femoral",
        "text": "Femoral",
        "points": 1,
        "cues": [
          "femoral"
        ]
      },
      {
        "id": "popliteal",
        "text": "Popliteal",
        "points": 1,
        "cues": [
          "popliteal"
        ]
      },
      {
        "id": "pt_pulse",
        "text": "PT (posterior tibial)",
        "points": 1,
        "cues": [
          "posterior tibial",
          "pt pulse"
        ]
      },
      {
        "id": "dp_pulse",
        "text": "DP (dorsalis pedis)",
        "points": 1,
        "cues": [
          "dorsalis pedis",
          "dp pulse",
          "pedal"
        ]
      },
      {
        "id": "apical",
        "text": "Auscultates Apical Pulse",
        "points": 1,
        "cues": [
          "apical",
          "point of maximal impulse",
          "pmi"
        ]
      },
      {
        "id": "cap_refill",
        "text": "Checks Capillary Refill",
        "points": 1,
        "cues": [
          "capillary refill",
          "cap refill",
          "blanch"
        ]
      },
      {
        "id": "diaphragm",
        "text": "Auscultates Heart Sounds with Diaphragm",
        "points": 1,
        "cues": [
          "diaphragm",
          "s1",
          "s2"
        ]
      },
      {
        "id": "bell",
        "text": "& Bell",
        "points": 1,
        "cues": [
          "bell",
          "murmur",
          "s3",
          "s4"
        ]
      },
      {
        "id": "edema",
        "text": "Assesses Edema",
        "points": 1,
        "cues": [
          "edema",
          "swelling",
          "pitting"
        ]
      }
    ]
  },
  {
    "id": "gi",
    "name": "Gastrointestinal",
    "points": 5,
    "items": [
      {
        "id": "flat",
        "text": "Lays Flat prior",
        "points": 1,
        "cues": [
          "lay flat",
          "lie flat",
          "supine",
          "lower the head of bed"
        ]
      },
      {
        "id": "gi_inspect",
        "text": "Inspects abdomen",
        "points": 1,
        "cues": [
          "inspect",
          "abdomen",
          "distension",
          "contour"
        ]
      },
      {
        "id": "bowel",
        "text": "Auscultates Bowel Sounds",
        "points": 1,
        "cues": [
          "bowel sounds",
          "four quadrants",
          "listen to the abdomen"
        ]
      },
      {
        "id": "gi_palp",
        "text": "Palpates",
        "points": 1,
        "cues": [
          "palpate",
          "tenderness",
          "soft"
        ]
      },
      {
        "id": "last_bm",
        "text": "Asks about last BM",
        "points": 1,
        "cues": [
          "last bowel movement",
          "bm",
          "last time you had"
        ]
      }
    ]
  },
  {
    "id": "gu",
    "name": "Genitourinary",
    "points": 4,
    "items": [
      {
        "id": "bladder",
        "text": "Palpates Bladder",
        "points": 1,
        "cues": [
          "bladder",
          "suprapubic"
        ]
      },
      {
        "id": "retention",
        "text": "Assesses for Retention",
        "points": 1,
        "cues": [
          "retention",
          "emptying",
          "fully void"
        ]
      },
      {
        "id": "gu_questions",
        "text": "Asks 2 gender-specific questions",
        "points": 2,
        "cues": [
          "burning",
          "urinate",
          "discharge",
          "menstrual",
          "prostate",
          "frequency"
        ]
      }
    ]
  },
  {
    "id": "msk",
    "name": "Musculoskeletal",
    "points": 7,
    "items": [
      {
        "id": "rom",
        "text": "Assesses ROM Flexion and Extension of BUE/BLE",
        "points": 4,
        "cues": [
          "range of motion",
          "flexion",
          "extension",
          "bend your",
          "straighten"
        ]
      },
      {
        "id": "spine",
        "text": "Spine alignment",
        "points": 1,
        "cues": [
          "spine",
          "alignment",
          "curvature"
        ]
      },
      {
        "id": "gait",
        "text": "Gait",
        "points": 1,
        "cues": [
          "gait",
          "walk for me",
          "ambulate"
        ]
      },
      {
        "id": "msk_sym",
        "text": "Symmetry",
        "points": 1,
        "cues": [
          "symmetry",
          "equal",
          "both sides"
        ]
      }
    ]
  },
  {
    "id": "integ",
    "name": "Integumentary",
    "points": 7,
    "items": [
      {
        "id": "color",
        "text": "Assesses Skin Color",
        "points": 1,
        "cues": [
          "skin color",
          "pallor",
          "cyanosis",
          "jaundice"
        ]
      },
      {
        "id": "moisture",
        "text": "Moisture",
        "points": 1,
        "cues": [
          "moisture",
          "dry",
          "diaphoretic",
          "clammy"
        ]
      },
      {
        "id": "skin_temp",
        "text": "Temperature",
        "points": 1,
        "cues": [
          "skin temperature",
          "warm",
          "cool to touch"
        ]
      },
      {
        "id": "turgor",
        "text": "Turgor",
        "points": 1,
        "cues": [
          "turgor",
          "tenting",
          "pinch the skin"
        ]
      },
      {
        "id": "lesions",
        "text": "Lesions/Pressure injuries",
        "points": 2,
        "cues": [
          "lesion",
          "pressure injury",
          "pressure ulcer",
          "wound",
          "breakdown"
        ]
      },
      {
        "id": "nails",
        "text": "Nails",
        "points": 1,
        "cues": [
          "nails",
          "clubbing",
          "nail beds"
        ]
      }
    ]
  },
  {
    "id": "comm",
    "name": "Communication, Professionalism, & Patient Privacy",
    "points": 4,
    "items": [
      {
        "id": "therapeutic",
        "text": "Uses therapeutic, clear, and respectful interaction throughout",
        "points": 1,
        "cues": [
          "is that okay",
          "let me know if",
          "are you comfortable",
          "thank you"
        ]
      },
      {
        "id": "privacy",
        "text": "Maintains patient privacy",
        "points": 1,
        "cues": [
          "privacy",
          "curtain",
          "cover you",
          "drape"
        ]
      },
      {
        "id": "terminology",
        "text": "Uses correct medical terminology throughout assessment",
        "points": 2,
        "cues": []
      }
    ]
  },
  {
    "id": "safety",
    "name": "Patient Safety and Appropriate Assessment Technique",
    "points": 5,
    "items": [
      {
        "id": "steth",
        "text": "Places stethoscope in ears correctly",
        "points": 1,
        "cues": [
          "stethoscope"
        ]
      },
      {
        "id": "lines",
        "text": "Assesses IV lines and drains",
        "points": 1,
        "cues": [
          "iv",
          "line",
          "drain",
          "foley",
          "tubing"
        ]
      },
      {
        "id": "linens",
        "text": "Removes linens/articles of clothing appropriately throughout assessment",
        "points": 1,
        "cues": [
          "gown",
          "blanket",
          "linens",
          "lift your"
        ]
      },
      {
        "id": "palpation",
        "text": "Palpates correctly",
        "points": 1,
        "cues": []
      },
      {
        "id": "bed_safety",
        "text": "Performs bed safety check prior to leaving patient's room",
        "points": 1,
        "cues": [
          "bed alarm",
          "call light",
          "side rails",
          "bed low",
          "call bell",
          "within reach"
        ]
      }
    ]
  }
]
};
