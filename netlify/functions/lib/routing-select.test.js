/* Guardrail tests for the routing engine. Run: node lib/routing-select.test.js */
'use strict';
var { selectModels } = require('./routing-select');

var perTok = function (perM) { return String(perM / 1e6); };
var catalog = [
  { id:'deepseek/deepseek-v4-flash-0731', prompt:perTok(0.0603), completion:perTok(0.1026), outputModalities:['text'] },
  { id:'google/gemini-2.5-flash-lite',    prompt:perTok(0.10),   completion:perTok(0.40),   outputModalities:['text'] },
  { id:'openai/gpt-5.6-luna',             prompt:perTok(0.10),   completion:perTok(0.60),   outputModalities:['text'] },
  { id:'anthropic/claude-opus-4',         prompt:perTok(15.0),   completion:perTok(75.0),   outputModalities:['text'] },
  { id:'nvidia/nemotron-3-ultra-550b-a55b:free', prompt:'0', completion:'0', free:true, outputModalities:['text'] },
  { id:'meta/llama-4-8b-instruct:free',   prompt:'0', completion:'0', free:true, outputModalities:['text'] },
  { id:'google/gemini-2.5-flash-image',   prompt:'0', completion:'0', imagePrice:'0.03', outputModalities:['image'] }
];
var ranking = { 'deepseek/deepseek-v4-flash-0731': 1.0, 'openai/gpt-5.6-luna': 0.85 };
var r = selectModels(catalog, { ranking }).routing;

var fails = 0;
function check(name, cond) { console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name); if (!cond) fails++; }

check('free tier uses only :free slugs',
  Object.keys(r.free).every(function (f) { return /:free$/.test(r.free[f]); }));
check('free tier avoids the 550B ultra (slow first impression)',
  Object.keys(r.free).every(function (f) { return r.free[f].indexOf('550b') === -1; }));
check('paid tiers never route to a :free slug',
  ['plus','pro','instructor'].every(function (t) {
    return Object.keys(r[t]).every(function (f) { return !/:free$/.test(r[t][f]); }); }));
check('over-budget flagship never selected anywhere',
  JSON.stringify(r).indexOf('claude-opus-4') === -1);
check('image features route to an image-capable model',
  r.pro.image === 'google/gemini-2.5-flash-image');
check('text features never route to an image-only model',
  ['tutor','sim','questions'].every(function (f) { return r.pro[f] !== 'google/gemini-2.5-flash-image'; }));
check('tutor stays within the $0.50/1M reasoning cap',
  r.pro.tutor === 'deepseek/deepseek-v4-flash-0731' || r.pro.tutor === 'openai/gpt-5.6-luna');

// A catalog where nothing qualifies must fail loudly, not silently pick junk.
var poor = selectModels([{ id:'x/expensive', prompt:perTok(99), completion:perTok(99), outputModalities:['text'] }], {});
check('impossible budget reports unresolved instead of guessing',
  poor.unresolved.length > 0 && Object.keys(poor.routing.pro).length === 0);

console.log(fails ? '\n' + fails + ' FAILING' : '\nall guardrails pass');
process.exit(fails ? 1 : 0);
