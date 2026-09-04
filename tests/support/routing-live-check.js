/* Runs the routing engine against a real OpenRouter catalog dump and prints the
 * proposal. Not part of the request path — a developer sanity check.
 *
 *   curl -s https://openrouter.ai/api/v1/models -o /tmp/or_models.json
 *   node routing-live-check.js
 */
'use strict';
var fs = require('fs');
var selectModels = require('../../netlify/functions/lib/routing-select').selectModels;

var path = process.env.OR_CATALOG || '/tmp/or_models.json';
var raw = JSON.parse(fs.readFileSync(path, 'utf8')).data;

// Shape the live catalog the way ai.js's trimModel() does.
var catalog = raw.map(function (m) {
  var pr = m.pricing || {}, arch = m.architecture || {};
  return {
    id: m.id,
    prompt: pr.prompt,
    completion: pr.completion,
    imagePrice: pr.image,
    imageOutputPrice: pr.image_output,
    outputModalities: arch.output_modalities || [],
    benchmarks: m.benchmarks,
    free: /:free$/.test(m.id)
  };
});

var res = selectModels(catalog, {});
console.log('catalog size:', catalog.length);
['free', 'plus', 'pro', 'instructor'].forEach(function (tier) {
  if (!res.detail[tier]) return;
  console.log('\n' + tier.toUpperCase());
  ['tutor', 'sim', 'medadmin', 'questions', 'patient', 'image'].forEach(function (f) {
    var d = res.detail[tier][f];
    console.log('  ' + f.padEnd(10) + (d ? d.model.padEnd(44) + d.why : '(unresolved)'));
  });
});
console.log('\nunresolved: ' + (res.unresolved.map(function (u) { return u.tier + '/' + u.feature; }).join(', ') || 'none'));
