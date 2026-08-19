/* ============================================================================
 * MedMaster — AI ROUTING POLICY
 * ----------------------------------------------------------------------------
 * Decides WHICH OpenRouter model each AI feature should use, per tier, from the
 * live catalog — so the routing table stops being a hand-maintained list that
 * silently rots every time a model is renamed, repriced or retired.
 *
 * THE IDEA
 *   Every feature is classified by what it actually needs, not by name:
 *
 *     structured — the prompt already contains the rules, the rubric and the
 *                  shape of the answer. The model is filling in a form. Buy the
 *                  cheapest fast model that can follow instructions.
 *     reasoning  — the student is asking an open question and the answer has to
 *                  be *right* (AI tutor). Worth paying more for, within a cap.
 *     image      — billed per image, not per token; ranked separately.
 *
 * WHY A POLICY AND NOT A HARD-CODED LIST
 *   Prices and rankings move weekly. A policy survives that; a list does not.
 *   `selectModels()` re-derives the whole routing table from whatever the
 *   catalog says today, and every choice it makes is explainable (see `.why`).
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 *   It does not apply anything. It returns a *proposal*. Auto-swapping the model
 *   that writes nursing scenarios, with no human in the loop, is not a thing this
 *   app should do quietly — a model nobody evaluated could be generating clinical
 *   content overnight. The admin reviews a diff and applies it.
 * ========================================================================== */

'use strict';

/* ---------------------------------------------------------------- classes ---
 * Price ceilings are USD per 1M tokens, matching how OpenRouter quotes them.
 * `blended` is (in + out) / 2 — one number to rank on, since most of our calls
 * are short prompts with short answers.
 * ------------------------------------------------------------------------- */
var CLASSES = {
  structured: {
    label: 'Rule-bound generation',
    // Scenario/sim/rubric work: the instructions carry the intelligence.
    maxInPerM: 0.20,
    maxOutPerM: 0.60,
    maxBlendedPerM: 0.30,
    // Cost dominates; a little quality signal breaks ties.
    weights: { price: 0.70, speed: 0.20, quality: 0.10 }
  },
  reasoning: {
    label: 'Open-ended answers',
    // AI tutor. "ideally under 20c, never over 50c per 1M in/out."
    maxInPerM: 0.50,
    maxOutPerM: 0.50,
    maxBlendedPerM: 0.50,
    preferredBlendedPerM: 0.20,   // anything at or under this gets a bonus
    weights: { price: 0.35, speed: 0.15, quality: 0.50 }
  },
  image: {
    label: 'Image generation',
    maxImagePrice: 0.06,          // USD per image
    weights: { price: 0.60, speed: 0.10, quality: 0.30 }
  }
};

/* Feature -> class. Mirrors KNOWN_FEATURES in ai.js. */
var FEATURE_CLASS = {
  tutor:     'reasoning',   // the one place a student asks something open-ended
  patient:   'structured',  // persona + revealed-facts contract does the work
  sim:       'structured',
  medadmin:  'structured',
  codeblue:  'structured',
  questions: 'structured',
  debrief:   'structured',
  sbar:      'structured',
  community: 'structured',
  admin:     'structured',
  other:     'structured',
  image:     'image',
  mnemonic:  'image',
  avatar:    'image'
};

/* ------------------------------------------------------------------ tiers ---
 * Free is not "the cheap tier" — it is the FAST tier. A free user judges the
 * whole app on how quickly the first answer appears, and a huge slow flagship
 * on a free slug is the worst of both worlds: no revenue and a bad first
 * impression. So free weights speed hardest and caps size.
 * ------------------------------------------------------------------------- */
var TIER_POLICY = {
  // `allowFreeSlugs` matters more than it looks. A ":free" slug prices at zero,
  // so on price alone it wins every comparison — which had paid tiers routing
  // scenario generation to free endpoints. Those are rate-limited and can queue
  // or drop under load, so a paying student would get a worse experience than
  // the policy thinks it is buying. Free slugs are for the free tier only.
  free:       { requireFree: true,  allowFreeSlugs: true,  speedBias: 2.0, maxParams: 120, label: 'Free' },
  plus:       { requireFree: false, allowFreeSlugs: false, speedBias: 1.0, label: 'Plus' },
  pro:        { requireFree: false, allowFreeSlugs: false, speedBias: 0.6, label: 'Pro' },
  instructor: { requireFree: false, allowFreeSlugs: false, speedBias: 0.6, label: 'Instructor' }
};

/* -------------------------------------------------------------- utilities -- */

/** OpenRouter quotes per-token USD strings. Convert to USD per 1M tokens. */
function perMillion(priceStr) {
  var n = parseFloat(priceStr);
  if (!isFinite(n) || n < 0) return null;
  return n * 1e6;
}

/** Rough parameter count in billions, parsed from the slug ("...-120b-..."). */
function paramsB(id) {
  var m = /(\d+(?:\.\d+)?)\s*b(?:[^a-z]|$)/i.exec(String(id || ''));
  return m ? parseFloat(m[1]) : null;
}

/**
 * Speed proxy. OpenRouter's catalog carries no latency figure, so this is an
 * explicit heuristic rather than a measurement: smaller models answer sooner,
 * and slugs vendors label "flash"/"lite"/"mini"/"turbo" are the fast SKUs.
 * Documented as a guess so nobody mistakes it for telemetry.
 */
function speedScore(model) {
  var id = String(model.id || '').toLowerCase();
  var s = 0.5;
  if (/flash|lite|mini|turbo|instant|fast|haiku|small/.test(id)) s += 0.35;
  if (/ultra|opus|max|large|405b|540b|550b/.test(id)) s -= 0.30;
  var p = paramsB(id);
  if (p !== null) {
    if (p <= 10) s += 0.20;
    else if (p <= 40) s += 0.10;
    else if (p >= 200) s -= 0.25;
  }
  return Math.max(0, Math.min(1, s));
}

/**
 * Quality signal. `ranking` is an optional caller-supplied map of
 * slug -> 0..1 (e.g. a health-domain leaderboard). Without it we fall back to a
 * weak prior from the slug, which is honestly not much — hence the low weight
 * on `quality` for structured work, where it barely matters.
 */
function qualityScore(model, ranking) {
  var id = String(model.id || '').toLowerCase();
  if (ranking && typeof ranking[model.id] === 'number') {
    return Math.max(0, Math.min(1, ranking[model.id]));
  }
  var q = 0.5;
  if (/ultra|opus|pro\b|max|large/.test(id)) q += 0.20;
  if (/lite|mini|nano|tiny/.test(id)) q -= 0.10;
  if (/:free/.test(id)) q -= 0.05;
  return Math.max(0, Math.min(1, q));
}

module.exports = {
  CLASSES: CLASSES,
  FEATURE_CLASS: FEATURE_CLASS,
  TIER_POLICY: TIER_POLICY,
  perMillion: perMillion,
  paramsB: paramsB,
  speedScore: speedScore,
  qualityScore: qualityScore
};
