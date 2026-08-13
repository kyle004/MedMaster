#!/usr/bin/env node
/* ============================================================================
   MedMaster test runner
   ----------------------------------------------------------------------------
     node tests/run.js                  every suite
     node tests/run.js voice            only suites whose name contains "voice"
     node tests/run.js --verbose        print every passing assertion too
     node tests/run.js --bail           stop at the first failing suite

   Each suite file exports:  module.exports = { name, run(suite) -> Promise|void }
   Suites run in separate processes is overkill here; instead each builds its
   own jsdom world so module-scope caches cannot leak between them.
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');

var args = process.argv.slice(2);
var verbose = args.indexOf('--verbose') !== -1 || args.indexOf('-v') !== -1;
var bail = args.indexOf('--bail') !== -1;
var filters = args.filter(function (a) { return a.charAt(0) !== '-'; });

if (verbose) process.env.MM_VERBOSE = '1';

/* Dependency check with a useful message instead of a stack trace. */
try {
  require('jsdom');
  require('react');
} catch (e) {
  console.error('\nMissing test dependencies.\n');
  console.error('  cd "' + path.resolve(__dirname, '..') + '"');
  console.error('  npm install --no-save jsdom react react-dom\n');
  process.exit(2);
}

var H = require('./_harness.js');

var files = fs.readdirSync(__dirname)
  .filter(function (f) { return /\.test\.js$/.test(f); })
  .filter(function (f) {
    if (!filters.length) return true;
    return filters.some(function (q) { return f.toLowerCase().indexOf(q.toLowerCase()) !== -1; });
  })
  .sort();

if (!files.length) {
  console.error('No test files matched ' + JSON.stringify(filters) + ' in tests/');
  process.exit(2);
}

var totals = { passed: 0, failed: 0, suites: 0, failedSuites: [] };
var started = Date.now();

console.log('\nMedMaster audio test suite');
console.log('='.repeat(60));

function runOne(file) {
  var mod;
  try {
    mod = require(path.join(__dirname, file));
  } catch (e) {
    console.log('\n' + file);
    console.log('  LOAD FAILED: ' + e.message);
    totals.failed++;
    totals.failedSuites.push(file + ' (load error)');
    return Promise.resolve();
  }

  var suite = new H.Suite(mod.name || file);
  console.log('\n' + (mod.name || file));

  var t0 = Date.now();
  return Promise.resolve()
    .then(function () { return mod.run(suite); })
    .catch(function (e) {
      suite.failed++;
      suite.failures.push({ label: 'suite threw', detail: e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : String(e) });
      console.log('    FAIL  suite threw: ' + (e && e.message ? e.message : e));
    })
    .then(function () {
      var ms = Date.now() - t0;
      totals.suites++;
      totals.passed += suite.passed;
      totals.failed += suite.failed;
      if (suite.failed) totals.failedSuites.push(mod.name || file);
      console.log('  ' + (suite.failed ? 'FAILED' : 'ok') +
        '  ' + suite.passed + ' passed' +
        (suite.failed ? ', ' + suite.failed + ' failed' : '') +
        '  (' + ms + 'ms)');
    });
}

var chain = Promise.resolve();
files.forEach(function (f) {
  chain = chain.then(function () {
    if (bail && totals.failed) return null;
    return runOne(f);
  });
});

chain.then(function () {
  var secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log(totals.suites + ' suites  ' + totals.passed + ' passed  ' + totals.failed + ' failed  (' + secs + 's)');
  if (totals.failed) {
    console.log('\nFailing suites:');
    totals.failedSuites.forEach(function (s) { console.log('  - ' + s); });
    console.log('');
    process.exit(1);
  }
  console.log('');
  process.exit(0);
});
