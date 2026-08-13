/* ============================================================================
   firebase-rules.test.js
   ----------------------------------------------------------------------------
   Validates firebase-rules.json against the RULES grammar, not just JSON.

   Why this exists: valid JSON is not a valid ruleset. Firebase treats every key
   that is not a rule keyword as a CHILD PATH, so a documentation key like
   `"//": "some note"` parses fine as JSON and then fails to publish with
   "Expected '{'" - because a child path must map to an object. That exact
   mistake shipped once; this suite makes it impossible to ship twice.

   It also asserts the security properties the audio/AI work depends on, so a
   future edit cannot quietly re-open a hole that was already closed.

   Run:  node tests/run.js firebase-rules
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./_harness.js');

var RULES_PATH = path.join(H.APP_ROOT, 'firebase-rules.json');
var OWNER = "auth.token.email === 'codingky@gmail.com'";
var VERIFIED = "auth.token.email_verified === true";

/* The complete set of keys Firebase treats as rules rather than child paths. */
var RULE_KEYS = ['.read', '.write', '.validate', '.indexOn', '.priority'];

function isRuleKey(k) { return RULE_KEYS.indexOf(k) !== -1; }

/** Walk the tree and collect every grammar violation, with its path. */
function grammarProblems(rules) {
  var problems = [];
  (function walk(node, p) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      problems.push({ path: p || '/', msg: 'expected an object, got ' +
        (Array.isArray(node) ? 'array' : typeof node) });
      return;
    }
    Object.keys(node).forEach(function (k) {
      var v = node[k];
      var p2 = p + '/' + k;
      if (isRuleKey(k)) {
        if (k === '.indexOn') {
          if (!Array.isArray(v) && typeof v !== 'string') {
            problems.push({ path: p2, msg: '.indexOn must be an array or string' });
          }
        } else if (typeof v !== 'string' && typeof v !== 'boolean') {
          problems.push({ path: p2, msg: k + ' must be a string or boolean, got ' + typeof v });
        }
      } else if (k.charAt(0) === '.') {
        problems.push({ path: p2, msg: 'unknown rule keyword "' + k + '"' });
      } else {
        /* A child path MUST map to an object. This is the "Expected '{'" case. */
        if (v === null || typeof v !== 'object' || Array.isArray(v)) {
          problems.push({
            path: p2,
            msg: 'child path "' + k + '" maps to ' + (Array.isArray(v) ? 'an array' : typeof v) +
                 ' - Firebase requires an object here and rejects the whole ruleset with "Expected \'{\'"'
          });
        } else {
          walk(v, p2);
        }
      }
    });
  })(rules, '');
  return problems;
}

/** Every rule EXPRESSION string in the tree, with its path. */
function expressions(rules) {
  var out = [];
  (function walk(node, p) {
    if (!node || typeof node !== 'object') return;
    Object.keys(node).forEach(function (k) {
      var v = node[k], p2 = p + '/' + k;
      if (isRuleKey(k)) {
        if (typeof v === 'string') out.push({ path: p2, expr: v });
      } else if (v && typeof v === 'object') {
        walk(v, p2);
      }
    });
  })(rules, '');
  return out;
}

/** Balanced-bracket / quote check - catches a truncated or spliced expression. */
function balanced(expr) {
  var depth = 0, inStr = false, quote = '';
  for (var i = 0; i < expr.length; i++) {
    var c = expr.charAt(i);
    if (inStr) { if (c === quote) inStr = false; continue; }
    if (c === "'" || c === '"') { inStr = true; quote = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth < 0) return false; }
  }
  return depth === 0 && !inStr;
}

module.exports = {
  name: 'firebase-rules — grammar and security invariants',

  run: function (t) {
    var raw = fs.readFileSync(RULES_PATH, 'utf8');
    var doc = null;

    t.group('the file parses at all');
    t.noThrow(function () { doc = JSON.parse(raw); }, 'firebase-rules.json is valid JSON');
    if (!doc) return;
    t.ok(doc.rules && typeof doc.rules === 'object', 'has a top-level "rules" object');

    /* --------------------------------------------------------------------- */
    t.group('rules GRAMMAR (valid JSON is not enough)');

    var problems = grammarProblems(doc.rules);
    t.eq(problems.length, 0, 'no grammar violations' +
      (problems.length ? ' — ' + problems.map(function (p) { return p.path + ': ' + p.msg; }).join(' | ') : ''));

    /* The specific mistake that shipped: a documentation key.
       Narrow on purpose - "comments" is a legitimate child node under
       /community, and a node called "notes" or "readme" would be too. What
       actually breaks Firebase is a NON-rule key whose value is a string
       instead of an object, so that is exactly what we look for. */
    var commentKeys = [];
    (function findComments(node, p) {
      if (!node || typeof node !== 'object') return;
      Object.keys(node).forEach(function (k) {
        var v = node[k];
        var looksLikeDoc = (k === '//' || k === '#' || k === '$comment' || k === '_comment');
        if (!isRuleKey(k) && looksLikeDoc && typeof v !== 'object') {
          commentKeys.push(p + '/' + k);
        }
        if (v && typeof v === 'object') findComments(v, p + '/' + k);
      });
    })(doc.rules, '');
    t.eq(commentKeys.length, 0,
      'no "//" documentation keys — Firebase reads any non-rule key as a child path, ' +
      'so a string value there fails to publish with "Expected \'{\'"' +
      (commentKeys.length ? ' (found: ' + commentKeys.join(', ') + ')' : ''));

    var exprs = expressions(doc.rules);
    t.ok(exprs.length > 30, 'found ' + exprs.length + ' rule expressions to check');

    var unbalanced = exprs.filter(function (e) { return !balanced(e.expr); });
    t.eq(unbalanced.length, 0, 'every expression has balanced parens and quotes' +
      (unbalanced.length ? ' — ' + unbalanced.map(function (e) { return e.path; }).join(', ') : ''));

    /* A stray smart quote from a copy-paste breaks Firebase with a cryptic error. */
    var smart = exprs.filter(function (e) { return /[‘’“”]/.test(e.expr); });
    t.eq(smart.length, 0, 'no smart quotes in any expression' +
      (smart.length ? ' — ' + smart.map(function (e) { return e.path; }).join(', ') : ''));

    /* --------------------------------------------------------------------- */
    t.group('owner checks require a VERIFIED email');

    var ownerExprs = exprs.filter(function (e) { return e.expr.indexOf(OWNER) !== -1; });
    t.ok(ownerExprs.length >= 30, ownerExprs.length + ' expressions reference the owner email');

    var unverified = ownerExprs.filter(function (e) { return e.expr.indexOf(VERIFIED) === -1; });
    t.eq(unverified.length, 0,
      'every owner check also requires email_verified — an unverified token asserting the ' +
      'owner address must not inherit owner powers' +
      (unverified.length ? ' (missing at: ' + unverified.map(function (e) { return e.path; }).join(', ') + ')' : ''));

    /* The two that matter most: they can re-grant everything else. */
    var cfgWrite = exprs.filter(function (e) { return e.path === '/appConfig/aiConfig/.write'; })[0];
    t.ok(cfgWrite && cfgWrite.expr.indexOf(VERIFIED) !== -1,
      'appConfig/aiConfig write is verified-owner only (it controls tiers, models and caps)');
    var tierWrite = exprs.filter(function (e) { return e.path === '/userTiers/$uid/.write'; })[0];
    t.ok(tierWrite && tierWrite.expr.indexOf(VERIFIED) !== -1,
      'userTiers/$uid write is verified-owner only (it decides who is Pro)');

    /* --------------------------------------------------------------------- */
    t.group('metered counters can only go UP');

    ['aiUsage', 'voiceUsage'].forEach(function (node) {
      var day = doc.rules[node] && doc.rules[node].$uid && doc.rules[node].$uid.$day;
      t.ok(!!day, node + '/$uid/$day exists');
      if (!day) return;
      t.ok(typeof day['.validate'] === 'string' && day['.validate'].indexOf('>=') !== -1,
        node + ' has a monotonic .validate — without it the metered student can reset ' +
        'their own daily cap from the browser console');
      t.contains(day['.validate'], 'newData.isNumber()',
        node + ' validates that the counter stays a number');
      t.contains(day['.write'], 'auth.uid === $uid',
        node + ' is still writable by the student (the server forwards their token)');
    });

    /* --------------------------------------------------------------------- */
    t.group('ledgers are server-only');

    ['aiSpend', 'voiceSpend'].forEach(function (node) {
      var n = doc.rules[node];
      t.ok(!!n, node + ' exists');
      if (!n) return;
      t.eq(n['.write'], false, node + ' is not client-writable at all (money is server-truth)');
      t.contains(String(n['.read']), VERIFIED, node + ' is readable only by the verified owner');
    });

    /* --------------------------------------------------------------------- */
    t.group('shared caches: readable by all, poisonable by none');

    ['voiceCache', 'imageCache'].forEach(function (node) {
      var n = doc.rules[node];
      t.ok(!!n, node + ' exists');
      if (!n) return;
      t.contains(String(n['.read']), 'auth != null',
        node + ' is readable by any signed-in student (a cache nobody can read is not a cache)');
      var hash = n.$hash || {};
      t.contains(String(hash['.write']), '!data.exists()',
        node + ' entries are write-once — a student can publish a clip they paid for ' +
        'but can never overwrite someone else\'s');
      t.ok(typeof hash['.validate'] === 'string' && hash['.validate'].indexOf('hasChildren') !== -1,
        node + ' validates the shape of a published entry');
    });

    /* --------------------------------------------------------------------- */
    t.group('per-user data stays per-user');

    var progress = doc.rules.userProgress && doc.rules.userProgress.$uid;
    t.ok(progress && progress['.read'].indexOf('auth.uid === $uid') !== -1,
      'userProgress is readable only by its owner');
    t.ok(progress && progress['.write'].indexOf('auth.uid === $uid') !== -1,
      'userProgress is writable only by its owner');

    var results = doc.rules.codeblue && doc.rules.codeblue.results && doc.rules.codeblue.results.$uid;
    t.ok(results && results['.write'].indexOf('auth.uid === $uid') !== -1,
      'code blue results are writable only by the player they belong to');

    var events = doc.rules.codeblue && doc.rules.codeblue.rooms &&
                 doc.rules.codeblue.rooms.$roomId && doc.rules.codeblue.rooms.$roomId.events;
    t.ok(events && events.$eventId && String(events.$eventId['.write']).indexOf('!data.exists()') !== -1,
      'code blue events are write-once — a replayed event cannot rewrite history');

    /* --------------------------------------------------------------------- */
    t.group('nothing is world-writable');

    var worldWritable = exprs.filter(function (e) {
      return /\.write$/.test(e.path) && (e.expr === 'true' || e.expr === true);
    });
    t.eq(worldWritable.length, 0, 'no path is writable without auth' +
      (worldWritable.length ? ' — ' + worldWritable.map(function (e) { return e.path; }).join(', ') : ''));

    var adminsNode = doc.rules.admins || {};
    t.eq(adminsNode['.write'], false, 'the /admins list cannot be written from a client at all');

    /* --------------------------------------------------------------------- */
    t.group('the deployed copy matches the source of truth');

    var deployed = path.join(H.APP_ROOT, '..', '..', 'Documents', 'GitHub', 'medmath', 'firebase-rules.json');
    if (fs.existsSync(deployed)) {
      t.eq(fs.readFileSync(deployed, 'utf8').trim(), raw.trim(),
        'the copy in the deploy folder is identical to firebase-rules.json');
    } else {
      t.ok(true, 'deploy folder not reachable from here — skipped (not a failure)');
    }
  }
};
