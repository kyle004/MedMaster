#!/usr/bin/env node
/* ============================================================================
   MedMaster test runner
   ----------------------------------------------------------------------------
     node tests/run.js                  every suite
     node tests/run.js voice            only suites whose name contains "voice"
     node tests/run.js --verbose        print every passing assertion too
     node tests/run.js --bail           stop at the first failing suite
     node tests/run.js --inband         run in ONE process (debugging only)

   Each suite runs in its OWN CHILD PROCESS by default.

   Why: the app modules are loaded with `w.eval()` into a jsdom window, but
   jsdom is built without `runScripts`, so every `window.` reference inside a
   module resolves DYNAMICALLY to Node's `global.window` at call time - i.e. to
   whichever world was created most recently, anywhere in the process. Add a
   module-scope timer (voice.js schedules a profile retry; ai.js re-publishes
   MM.ai) and a suite can reach across into a later suite's world and corrupt
   it. That produced failures that appeared only in the full run and never in
   isolation, which is the worst kind of test to debug.

   Process isolation removes the shared mutable global entirely. It costs a few
   hundred ms per suite and buys results that mean what they say.

   A suite file exports:  module.exports = { name, run(suite) -> Promise|void }
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var args = process.argv.slice(2);
var verbose = args.indexOf('--verbose') !== -1 || args.indexOf('-v') !== -1;
var bail = args.indexOf('--bail') !== -1;
var inband = args.indexOf('--inband') !== -1;
var filters = args.filter(function (a) { return a.charAt(0) !== '-'; });

if (verbose) process.env.MM_VERBOSE = '1';

/* ------------------------------------------------------------------ child */
/* When invoked as `node tests/run.js --child <file>` we run exactly one suite
   and report the tally back on the last line of stdout as JSON. */
var childIdx = args.indexOf('--child');
if (childIdx !== -1) {
  runAsChild(args[childIdx + 1]);
} else {
  runAsParent();
}

function loadHarness() {
  try {
    require('jsdom');
    require('react');
  } catch (e) {
    console.error('\nMissing test dependencies.\n');
    console.error('  cd "' + path.resolve(__dirname, '..') + '"');
    console.error('  npm install --no-save jsdom react react-dom\n');
    process.exit(2);
  }
  return require('./_harness.js');
}

function runAsChild(file) {
  var H = loadHarness();
  var mod;
  try {
    mod = require(path.join(__dirname, file));
  } catch (e) {
    console.log('  LOAD FAILED: ' + e.message);
    console.log('__MM_RESULT__' + JSON.stringify({ passed: 0, failed: 1, name: file }));
    process.exit(1);
  }

  var suite = new H.Suite(mod.name || file);
  Promise.resolve()
    .then(function () { return mod.run(suite); })
    .catch(function (e) {
      suite.failed++;
      console.log('    FAIL  suite threw: ' + (e && e.message ? e.message : e));
      if (e && e.stack) console.log('          ' + e.stack.split('\n').slice(1, 4).join('\n          '));
    })
    .then(function () {
      console.log('__MM_RESULT__' + JSON.stringify({
        passed: suite.passed, failed: suite.failed, name: mod.name || file
      }));
      /* A suite may leave timers or open handles; we have our answer, so leave
         rather than hang the run waiting for them. */
      process.exit(suite.failed ? 1 : 0);
    });
}

function runAsParent() {
  loadHarness();

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

  console.log('\nMedMaster test suite' + (inband ? '  (in-band)' : '  (isolated processes)'));
  console.log('='.repeat(62));

  var chain = Promise.resolve();
  files.forEach(function (f) {
    chain = chain.then(function () {
      if (bail && totals.failed) return null;
      return inband ? runInBand(f, totals) : runIsolated(f, totals);
    });
  });

  chain.then(function () {
    var secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(62));
    console.log(totals.suites + ' suites  ' + totals.passed + ' passed  ' +
                totals.failed + ' failed  (' + secs + 's)');
    if (totals.failed) {
      console.log('\nFailing suites:');
      totals.failedSuites.forEach(function (s) { console.log('  - ' + s); });
      console.log('');
      process.exit(1);
    }
    console.log('');
    process.exit(0);
  });
}

function runIsolated(file, totals) {
  return new Promise(function (resolve) {
    var t0 = Date.now();
    var out = '';
    var child = childProcess.spawn(
      process.execPath, [__filename, '--child', file],
      { env: process.env, cwd: path.resolve(__dirname, '..') }
    );
    child.stdout.on('data', function (d) { out += d.toString(); });
    child.stderr.on('data', function (d) { out += d.toString(); });
    child.on('close', function () {
      var result = { passed: 0, failed: 1, name: file };
      var m = /__MM_RESULT__(\{.*\})/.exec(out);
      if (m) {
        try { result = JSON.parse(m[1]); } catch (e) {}
      }
      var body = out.replace(/__MM_RESULT__\{.*\}\s*/, '');

      console.log('\n' + (result.name || file));
      if (body.trim()) console.log(body.replace(/\s+$/, ''));

      totals.suites++;
      totals.passed += result.passed;
      totals.failed += result.failed;
      if (result.failed) totals.failedSuites.push(result.name || file);

      console.log('  ' + (result.failed ? 'FAILED' : 'ok') +
        '  ' + result.passed + ' passed' +
        (result.failed ? ', ' + result.failed + ' failed' : '') +
        '  (' + (Date.now() - t0) + 'ms)');
      resolve();
    });
  });
}

/* --inband: the old behaviour, kept because a debugger is far easier to attach
   to one process. Results here can be polluted by cross-suite leakage. */
function runInBand(file, totals) {
  var H = require('./_harness.js');
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
      console.log('    FAIL  suite threw: ' + (e && e.message ? e.message : e));
    })
    .then(function () {
      totals.suites++;
      totals.passed += suite.passed;
      totals.failed += suite.failed;
      if (suite.failed) totals.failedSuites.push(mod.name || file);
      console.log('  ' + (suite.failed ? 'FAILED' : 'ok') + '  ' + suite.passed + ' passed' +
        (suite.failed ? ', ' + suite.failed + ' failed' : '') + '  (' + (Date.now() - t0) + 'ms)');
    });
}
