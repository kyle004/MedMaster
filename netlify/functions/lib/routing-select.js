/* ============================================================================
 * MedMaster — ROUTING SELECTION ENGINE
 * ----------------------------------------------------------------------------
 * Turns a live OpenRouter catalog into a PROPOSED routing table:
 *     { tier -> { feature -> modelId } }  plus a per-choice explanation.
 *
 * Pure and dependency-free so it can be unit-tested without a network, and so
 * the admin UI and the Netlify function can share one implementation.
 * ========================================================================== */

'use strict';

var P = require('./routing-policy');

/** Does this model satisfy the class's hard price ceilings? */
function withinBudget(cls, priced) {
  if (cls.maxImagePrice != null) {
    return priced.imagePrice != null && priced.imagePrice <= cls.maxImagePrice;
  }
  if (priced.inPerM == null || priced.outPerM == null) return false;
  if (cls.maxInPerM != null && priced.inPerM > cls.maxInPerM) return false;
  if (cls.maxOutPerM != null && priced.outPerM > cls.maxOutPerM) return false;
  if (cls.maxBlendedPerM != null && priced.blendedPerM > cls.maxBlendedPerM) return false;
  return true;
}

/** Normalise one trimmed catalog entry into the numbers we rank on. */
function priceOf(model) {
  var inPerM = P.perMillion(model.prompt);
  var outPerM = P.perMillion(model.completion);
  var imagePrice = model.imagePrice != null ? parseFloat(model.imagePrice) : null;
  if (!isFinite(imagePrice)) imagePrice = null;
  return {
    inPerM: inPerM,
    outPerM: outPerM,
    blendedPerM: (inPerM != null && outPerM != null) ? (inPerM + outPerM) / 2 : null,
    imagePrice: imagePrice
  };
}

/**
 * Score a candidate 0..1. Higher is better.
 * Price is normalised against the class ceiling so "cheap" means cheap
 * *relative to what this class is allowed to spend*, not in absolute terms.
 */
function scoreModel(model, cls, tierPolicy, ranking) {
  var priced = priceOf(model);
  if (!withinBudget(cls, priced)) return null;

  var priceScore;
  if (cls.maxImagePrice != null) {
    priceScore = 1 - (priced.imagePrice / cls.maxImagePrice);
  } else {
    priceScore = 1 - (priced.blendedPerM / cls.maxBlendedPerM);
    // Reward comfortably beating the "ideally under" target.
    if (cls.preferredBlendedPerM != null && priced.blendedPerM <= cls.preferredBlendedPerM) {
      priceScore = Math.min(1, priceScore + 0.15);
    }
  }
  priceScore = Math.max(0, Math.min(1, priceScore));

  var speed = P.speedScore(model);
  var quality = P.qualityScore(model, ranking);

  var w = cls.weights;
  // Free tier leans on speed; paid tiers lean back toward quality.
  var speedW = w.speed * (tierPolicy.speedBias || 1);
  var total = (w.price * priceScore) + (speedW * speed) + (w.quality * quality);
  // Renormalise so tiers stay comparable after the speed bias.
  total = total / (w.price + speedW + w.quality);

  return {
    id: model.id,
    score: total,
    priced: priced,
    speed: speed,
    quality: quality,
    why: explain(model, priced, cls, speed, quality)
  };
}

function explain(model, priced, cls, speed, quality) {
  var bits = [];
  if (cls.maxImagePrice != null) {
    bits.push('$' + priced.imagePrice.toFixed(4) + '/image');
  } else {
    bits.push('$' + priced.inPerM.toFixed(3) + ' in / $' + priced.outPerM.toFixed(3) + ' out per 1M');
  }
  bits.push('speed ' + Math.round(speed * 100) + '%');
  bits.push('quality ' + Math.round(quality * 100) + '%');
  return bits.join(' · ');
}

/** Does a model qualify for a tier at all (free-slug requirement, size cap)? */
function eligibleForTier(model, tierPolicy) {
  var isFreeSlug = /:free$/.test(String(model.id || '')) || model.free === true;
  if (tierPolicy.requireFree && !isFreeSlug) return false;
  if (isFreeSlug && tierPolicy.allowFreeSlugs === false) return false;
  if (tierPolicy.maxParams != null) {
    var p = P.paramsB(model.id);
    if (p !== null && p > tierPolicy.maxParams) return false;
  }
  return true;
}

/** Text vs image capability, from OpenRouter's own architecture block. */
function supportsClass(model, className) {
  var out = Array.isArray(model.outputModalities) ? model.outputModalities : [];
  if (className === 'image') return out.indexOf('image') !== -1;
  // A text feature must not be routed to an image-only model.
  if (out.length && out.indexOf('text') === -1) return false;
  return true;
}

/**
 * Build the full proposal.
 *
 * @param catalog  array of trimMoodel()-shaped entries
 * @param opts     { ranking, features, tiers }
 * @returns { routing: {tier:{feature:id}}, detail: {...}, unresolved: [...] }
 */
function selectModels(catalog, opts) {
  opts = opts || {};
  var ranking = opts.ranking || null;
  var features = opts.features || Object.keys(P.FEATURE_CLASS);
  var tiers = opts.tiers || Object.keys(P.TIER_POLICY);

  var routing = {}, detail = {}, unresolved = [];

  tiers.forEach(function (tier) {
    var tp = P.TIER_POLICY[tier];
    if (!tp) return;
    routing[tier] = {};
    detail[tier] = {};

    features.forEach(function (feature) {
      var className = P.FEATURE_CLASS[feature];
      var cls = P.CLASSES[className];
      if (!cls) return;

      var best = null;
      for (var i = 0; i < catalog.length; i++) {
        var m = catalog[i];
        if (!eligibleForTier(m, tp)) continue;
        if (!supportsClass(m, className)) continue;
        var scored = scoreModel(m, cls, tp, ranking);
        if (!scored) continue;
        if (!best || scored.score > best.score) best = scored;
      }

      if (best) {
        routing[tier][feature] = best.id;
        detail[tier][feature] = {
          model: best.id, class: className, score: Math.round(best.score * 1000) / 1000, why: best.why
        };
      } else {
        // No candidate cleared the ceilings. Say so loudly rather than
        // silently leaving the feature on a stale slug.
        unresolved.push({ tier: tier, feature: feature, class: className,
                          reason: 'no model met the ' + className + ' budget for the ' + tier + ' tier' });
      }
    });
  });

  return { routing: routing, detail: detail, unresolved: unresolved };
}

/** Diff a proposal against the routing currently in force. */
function diffRouting(current, proposed) {
  var changes = [];
  Object.keys(proposed).forEach(function (tier) {
    Object.keys(proposed[tier]).forEach(function (feature) {
      var now = (current && current[tier] && current[tier][feature]) || null;
      var next = proposed[tier][feature];
      if (now !== next) changes.push({ tier: tier, feature: feature, from: now, to: next });
    });
  });
  return changes;
}

module.exports = { selectModels: selectModels, diffRouting: diffRouting, scoreModel: scoreModel, priceOf: priceOf };
