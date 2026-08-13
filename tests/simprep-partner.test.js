/* ============================================================================
   simprep-partner.test.js
   ----------------------------------------------------------------------------
   Guards js/simprep-partner.js - the partner (two-or-more student) layer of the
   Clinical Simulation Prep section.

   What this suite is actually protecting:

   1. FEATURE DETECTION CANNOT FAIL. js/simprep.js and js/simprep-sim.js both
      check for window.MM.simprepPartner and fall back to solo when it is
      absent. So the object has to exist at MODULE LOAD - before React is
      touched, before Firebase is touched, whatever order the shell loads the
      scripts in - and every method on it has to be safe to call with no room,
      no auth and no network. A partner layer that throws into somebody else's
      render is worse than no partner layer.

   2. THE RUBRIC IS NOT LAST-WRITE-WINS. Two students marking the same item in
      the same second is the normal case. The heavier ROLE wins, the loser is
      KEPT, and the answer is the same on both screens whichever order the two
      events arrive in. If this regresses, somebody gets a wrong grade and
      there is no trace of the mark that was thrown away.

   3. THE CLOCK CANNOT LIE. Elapsed time is derived from timestamps stored in
      the room, never from a local Date.now(). Asserted twice: by scanning the
      fold for a clock read, and by moving Date.now() to a wild value and
      re-folding the same events to the same answer.

   4. NOTHING FREEZES. A late joiner replays the log and sees a paused run as
      paused. A dead host does not stop the clock, because the host was never
      computing it. A denied write degrades to a flag.

   5. NAMESPACING. These rooms share /codeblue/rooms with Code Blue and MS2
      Lab. Code Blue's lobby filters on status === 'open'; a partner room must
      never carry that value, and must never be joinable through this module.

   Run:  node tests/run.js simprep-partner
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./_harness.js');
var React = require('react');

var MODULE = 'js/simprep-partner.js';

/* Only real shipped modules. The working folder accumulates orphaned
   `.fuse_hidden*` copies that readdir returns FIRST (dotfiles sort early);
   reading one means linting a ghost copy of a module instead of the real one.
   Same filter as ui-contrast.test.js and ms2lab.test.js. */
function jsFiles() {
  return fs.readdirSync(path.join(H.APP_ROOT, 'js'))
    .filter(function (f) { return /\.js$/.test(f) && f.charAt(0) !== '.'; })
    .map(function (f) { return 'js/' + f; });
}
function read(rel) { return fs.readFileSync(path.join(H.APP_ROOT, rel), 'utf8'); }

/** Strip comments, string literals and regex literals before scanning source
    for ES5 violations - otherwise a comment full of prose reads as spread
    syntax and a markdown fence in a regex reads as a template literal. */
function stripCode(src) {
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/\/(?:[^/\\\n[]|\\.|\[[^\]\n]*\])+\/[gimsuy]*/g, '/RE/');
}

/* ==========================================================================
   A Realtime Database double with the semantics this module actually relies
   on: child_added replay in key order, write-if-absent transactions, and a
   deny list so the "the rule said no" path can be exercised on purpose.
   The harness's makeFakeDb() fires `on('child_added')` as a single value
   callback, which would make every event-log assertion vacuous.
   ========================================================================== */
function makeRoomDb(opts) {
  opts = opts || {};
  var tree = {};
  var listeners = [];
  var writes = [];
  var seq = 0;
  var deny = opts.deny || null;                 // RegExp matched against the path
  var occupied = !!opts.occupied;               // every room code reads as taken

  function segs(p) {
    return String(p).replace(/^\/+|\/+$/g, '').split('/').filter(function (s) { return !!s; });
  }
  function norm(p) { return segs(p).join('/'); }
  function getAt(p) {
    var s = segs(p), n = tree, i;
    if (occupied && /^codeblue\/rooms\/[A-Z]{4}$/.test(norm(p)) && !getRaw(p)) {
      return { code: 'TAKEN', status: 'simprep-open' };
    }
    for (i = 0; i < s.length; i++) {
      if (n === null || typeof n !== 'object') { return null; }
      n = n[s[i]];
    }
    return n === undefined ? null : n;
  }
  function getRaw(p) {
    var s = segs(p), n = tree, i;
    for (i = 0; i < s.length; i++) {
      if (n === null || typeof n !== 'object') { return null; }
      n = n[s[i]];
    }
    return n === undefined ? null : n;
  }
  function snap(p, key) {
    return {
      key: key === undefined ? segs(p).pop() : key,
      val: function () { return getAt(p); },
      exists: function () { return getAt(p) !== null; }
    };
  }
  function fireValue(p) {
    listeners.slice(0).forEach(function (l) {
      if (l.evt !== 'value') { return; }
      if (l.path !== p && p.indexOf(l.path + '/') !== 0 && l.path.indexOf(p + '/') !== 0) { return; }
      try { l.cb(snap(l.path)); } catch (e) {}
    });
  }
  function fireChildAdded(parent, key) {
    listeners.slice(0).forEach(function (l) {
      if (l.evt !== 'child_added' || l.path !== parent) { return; }
      if (l.seen[key]) { return; }
      l.seen[key] = true;
      try { l.cb(snap(parent + '/' + key, key)); } catch (e) {}
    });
  }
  function setAt(p, v) {
    var s = segs(p), n = tree, i;
    for (i = 0; i < s.length - 1; i++) {
      if (!n[s[i]] || typeof n[s[i]] !== 'object') { n[s[i]] = {}; }
      n = n[s[i]];
    }
    var leaf = s[s.length - 1];
    if (v === null) { delete n[leaf]; } else { n[leaf] = v; }
    writes.push({ path: norm(p), value: v });
    fireValue(norm(p));
    if (s.length > 1) { fireChildAdded(s.slice(0, s.length - 1).join('/'), leaf); }
  }
  function denied(p) { return !!(deny && deny.test(norm(p))); }

  function ref(p) {
    var full = norm(p);
    return {
      key: segs(full).pop() || null,
      path: full,
      child: function (c) { return ref(full + '/' + c); },
      once: function (evt, cb, errCb) {
        var s = snap(full);
        if (cb) { setTimeout(function () { try { cb(s); } catch (e) {} }, 0); }
        void errCb;
        return Promise.resolve(s);
      },
      on: function (evt, cb, errCb) {
        var l = { path: full, evt: evt, cb: cb, err: errCb, seen: {} };
        listeners.push(l);
        setTimeout(function () {
          if (evt === 'value') { try { cb(snap(full)); } catch (e) {} return; }
          if (evt === 'child_added') {
            var cur = getAt(full) || {};
            Object.keys(cur).sort().forEach(function (k) {
              if (l.seen[k]) { return; }
              l.seen[k] = true;
              try { cb(snap(full + '/' + k, k)); } catch (e) {}
            });
          }
        }, 0);
        return cb;
      },
      off: function (evt, cb) {
        listeners = listeners.filter(function (l) {
          return !(l.path === full && (!cb || l.cb === cb));
        });
      },
      set: function (v) {
        if (denied(full)) { return Promise.reject(new Error('PERMISSION_DENIED')); }
        setAt(full, v);
        return Promise.resolve();
      },
      update: function (o) {
        if (denied(full)) { return Promise.reject(new Error('PERMISSION_DENIED')); }
        Object.keys(o).forEach(function (k) { setAt(full + '/' + k, o[k]); });
        return Promise.resolve();
      },
      remove: function () { setAt(full, null); return Promise.resolve(); },
      push: function (v) {
        seq++;
        /* 'p' so a pushed key always sorts AFTER the 'e....' keys a seeded
           room already holds - real push keys are monotonic and a double that
           recycles them silently overwrites the history under test. */
        var key = 'p' + ('000' + seq).slice(-4);
        if (denied(full)) {
          var rejected = Promise.reject(new Error('PERMISSION_DENIED'));
          /* Swallow the default unhandled-rejection: the module attaches its
             own catch, which is exactly what is under test. */
          rejected.catch(function () {});
          return {
            key: key,
            then: function (a, b) { return rejected.then(a, b); },
            catch: function (b) { return rejected.catch(b); }
          };
        }
        if (v !== undefined) { setAt(full + '/' + key, v); }
        var okp = Promise.resolve();
        return {
          key: key,
          then: function (a, b) { return okp.then(a, b); },
          catch: function (b) { return okp.catch(b); }
        };
      },
      transaction: function (fn, cb) {
        var cur = getAt(full);
        var next;
        try { next = fn(cur); } catch (e) { next = undefined; }
        var committed = next !== undefined;
        if (committed && !denied(full)) { setAt(full, next); }
        else if (committed) { committed = false; }
        if (cb) { setTimeout(function () { cb(null, committed); }, 0); }
        return Promise.resolve({ committed: committed, snapshot: snap(full) });
      },
      onDisconnect: function () {
        return {
          update: function () { return Promise.resolve(); },
          set: function () { return Promise.resolve(); },
          cancel: function () { return Promise.resolve(); }
        };
      },
      orderByChild: function () { return ref(full); },
      equalTo: function () { return ref(full); },
      limitToLast: function () { return ref(full); }
    };
  }

  return {
    ref: ref,
    seed: function (p, v) { setAt(p, v); writes.length = 0; },
    get: function (p) { return getRaw(p); },
    writes: function () { return writes.slice(0); },
    writesTo: function (rx) { return writes.filter(function (w) { return rx.test(w.path); }); },
    listenerCount: function () { return listeners.length; }
  };
}

/* -------------------------------------------------------------- utilities */

function ev(k, body) {
  var o = {};
  Object.keys(body || {}).forEach(function (x) { o[x] = body[x]; });
  o._k = k;
  return o;
}
function actIn(fn) {
  var ow = console.warn, oe = console.error;
  console.warn = function () {}; console.error = function () {};
  try { React.act(fn); } finally { console.warn = ow; console.error = oe; }
}
function tick(ms) { return new Promise(function (r) { setTimeout(r, ms || 10); }); }
function numOrT(v) { var n = typeof v === 'number' ? v : parseFloat(v); return isFinite(n) ? n : 0; }

/* A room already halfway through a run, paused, written by "the other
   student" before we ever connect. T0 is deliberately not near Date.now(). */
var T0 = 1700000000000;
function seedLiveRoom(db, code, extra) {
  db.seed('codeblue/rooms/' + code, {
    code: code,
    name: 'Sam - Simulation together',
    hostId: 'u-sam',
    hostName: 'Sam',
    createdAt: T0 - 60000,
    status: 'simprep-live',
    cfg: { kind: 'sim', topicId: 'nur2212-sepsis', mode: '', durationSec: 1200 },
    players: {
      'u-sam': { name: 'Sam', role: 'runner', connected: true, alive: true,
        lastSeen: T0 + 5000, joinedAt: T0 - 60000 }
    },
    events: {
      e0001: { t: 'activity', kind: 'sim', topicId: 'nur2212-sepsis', by: 'u-sam', byName: 'Sam', at: T0 - 30000 },
      e0002: { t: 'role', uid: 'u-sam', role: 'runner', by: 'u-sam', byName: 'Sam', at: T0 - 29000 },
      e0003: { t: 'start', durationSec: 1200, by: 'u-sam', byName: 'Sam', at: T0 },
      e0004: { t: 'action', text: 'Introduced self, checked two identifiers', by: 'u-sam', byName: 'Sam', at: T0 + 20000 },
      e0005: { t: 'mark', itemId: 'r1', verdict: 'good', label: 'Hand hygiene', role: 'proctor', by: 'u-sam', byName: 'Sam', at: T0 + 25000 },
      e0006: { t: 'pause', reason: 'question about the order set', by: 'u-sam', byName: 'Sam', at: T0 + 60000 }
    }
  });
  if (extra) { Object.keys(extra).forEach(function (k) { db.seed(k, extra[k]); }); }
}

module.exports = {
  name: 'simprep-partner — shared rooms, shared clock, un-clobberable rubric',

  run: function (t) {
    var src = read(MODULE);

    /* A refused set()/update() REJECTS; it does not throw. An uncaught one
       kills the Node process outright and, in a browser, prints a stack the
       student cannot act on. This whole suite runs under a watcher, and the
       assertion at the end is what stops that regression coming back - it has
       already happened once, on the /players mirror write in swapRoles(). */
    var unhandled = [];
    process.on('unhandledRejection', function (e) {
      unhandled.push(String((e && e.message) || e));
    });

    /* ====================================================================== */
    t.group('the file is a real shipped module, ES5, no build step');

    t.ok(jsFiles().indexOf(MODULE) !== -1,
      MODULE + ' is a real shipped module (and the .fuse_hidden ghosts are filtered out)');

    var stripped = stripCode(src);
    var es5 = [
      ['arrow function', /=>/],
      ['const declaration', /(^|[^A-Za-z0-9_$.])const\s+[A-Za-z_$]/],
      ['let declaration', /(^|[^A-Za-z0-9_$.])let\s+[A-Za-z_$]/],
      ['template literal', /`/],
      ['spread or rest', /\.\.\./],
      ['optional chaining', /\?\./],
      ['nullish coalescing', /\?\?/],
      ['array destructuring', /(?:var|const|let)\s*\[/],
      ['object destructuring', /(?:var|const|let)\s*\{/],
      ['for-of', /for\s*\(\s*(?:var\s+)?[A-Za-z_$]+\s+of\s/],
      ['async function', /(^|[^A-Za-z0-9_$.])async(?:\s+function|\s*\()/],
      ['await', /(^|[^A-Za-z0-9_$.])await\s/],
      ['class declaration', /(^|[^A-Za-z0-9_$.])class\s+[A-Za-z_$]/],
      ['exponent operator', /\*\*/]
    ];
    es5.forEach(function (c) {
      t.ok(!c[1].test(stripped), 'no ' + c[0] + ' in ' + MODULE);
    });
    t.match(src, /React\.createElement/, 'renders through React.createElement, not JSX');
    t.notContains(stripped, 'JSX', 'no JSX anywhere');

    /* ====================================================================== */
    t.group('the API object exists at module load — feature detection');

    var w0 = H.makeWorld({ tier: 'pro' });
    var w = w0.window;
    /* Loaded with no db and no auth on purpose: feature detection has to
       succeed in the worst world the shell can hand us. */
    w.MM.db = null;
    w.MM.authUser = null;
    w.MM.myId = '';
    w0.load(MODULE);

    var api = w.MM && w.MM.simprepPartner;
    t.eq(typeof api, 'object', 'window.MM.simprepPartner is published at module load');

    var CONTRACT = ['createRoom', 'joinRoom', 'leaveRoom', 'subscribe', 'setActivity',
      'publish', 'onEvent', 'getRoom', 'isHost'];
    CONTRACT.forEach(function (fn) {
      t.eq(typeof (api || {})[fn], 'function',
        'MM.simprepPartner.' + fn + '() is on the object the other two modules code against');
    });

    t.eq(typeof w.SimPrepPartner, 'function', 'window.SimPrepPartner is the lobby component');
    t.ok(w.document.getElementById('simprep-partner-styles'),
      'the stylesheet is injected at load, not at first render');

    var reg = w.MMPause;
    t.ok(reg && reg.controls && reg.controls['simprep-partner'],
      'registered in window.MMPause under the id "simprep-partner"');
    var ctl = reg && reg.controls && reg.controls['simprep-partner'];
    ['isPaused', 'canPause', 'pause', 'resume', 'toggle', 'stats', 'subscribe'].forEach(function (k) {
      t.eq(typeof (ctl || {})[k], 'function', 'pauseControl.' + k + '() matches sim-engine\'s contract');
    });
    ['pause', 'resume', 'togglePause', 'isPaused', 'canPause', 'onPauseChange', 'pauseStats']
      .forEach(function (k) {
        t.eq(typeof api[k], 'function', 'MM.simprepPartner.' + k + '() — the shared pause verbs');
      });

    /* ====================================================================== */
    t.group('every method is safe with no room, no auth and no network');

    t.eq(api.getRoom(), null, 'getRoom() is null with no room');
    t.eq(api.isHost(), false, 'isHost() is false with no room');
    t.eq(api.inRoom(), false, 'inRoom() is false with no room');
    t.eq(api.isPaused(), false, 'isPaused() is false with no room');
    t.eq(api.canPause(), false, 'canPause() is false with no room');
    t.noThrow(function () { api.pause('x'); }, 'pause() with no room does not throw');
    t.noThrow(function () { api.resume(); }, 'resume() with no room does not throw');
    t.noThrow(function () { api.togglePause(); }, 'togglePause() with no room does not throw');
    t.noThrow(function () { api.pauseStats(); }, 'pauseStats() with no room does not throw');
    t.eq(api.pauseStats().active, false, 'pauseStats() reports inactive with no room');
    t.eq(api.setActivity({ kind: 'study' }), null, 'setActivity() with no room returns falsy');
    t.eq(api.setRole('runner'), null, 'setRole() with no room returns falsy');
    t.eq(api.swapRoles(), null, 'swapRoles() with no room returns falsy');
    t.eq(api.startRun(1200), null, 'startRun() with no room returns falsy');

    t.noThrow(function () {
      var off = api.subscribe(function () {});
      off();
      var off2 = api.onEvent(function () {});
      off2();
    }, 'subscribe()/onEvent() with no room hand back a working off()');
    t.eq(typeof api.subscribe(null), 'function', 'subscribe(non-function) still returns an off()');
    t.eq(typeof api.onEvent(null), 'function', 'onEvent(non-function) still returns an off()');

    var noRoomSeen = 'unset';
    api.subscribe(function (st) { noRoomSeen = st; })();
    t.eq(noRoomSeen, null, 'a subscriber with no room is called immediately with null, not left hanging');

    return Promise.resolve()
      .then(function () {
        return Promise.all([
          t.resolves(api.publish({ t: 'mark' }), 'publish() with no room RESOLVES (never rejects)'),
          t.resolves(api.leaveRoom(), 'leaveRoom() with no room resolves'),
          t.resolves(api.closeRoom(), 'closeRoom() with no room resolves'),
          t.resolves(api.createRoom({ kind: 'sim' }), 'createRoom() with no db resolves (does not reject)'),
          t.resolves(api.joinRoom('ABCD'), 'joinRoom() with no db resolves'),
          t.resolves(api.joinRoom(''), 'joinRoom("") resolves'),
          t.resolves(api.joinRoom(null), 'joinRoom(null) resolves')
        ]);
      })
      .then(function (res) {
        t.eq(res[0], null, 'publish() with no room resolves falsy');
        t.eq(res[3], null, 'createRoom() with no db resolves falsy');
        t.eq(res[4], null, 'joinRoom() with no db resolves falsy');
        t.ok(String(api.lastError()).length > 0, 'the reason is filed in lastError() instead of thrown');

        /* ================================================================== */
        t.group('the fold: pure, total, and it never reads a clock');

        var M = w.SimPrepPartner;
        ['initialShared', 'applyEvent', 'foldEvents', 'elapsedMs', 'electHost', 'mergeMark',
          'swapMap', 'visibleAnswers', 'readyToReveal', 'hostIsStale']
          .forEach(function (fn) {
            t.eq(typeof M[fn], 'function', 'SimPrepPartner.' + fn + '() is exported for testing');
          });

        /* Source scan: the whole fold section must contain no clock read. */
        var a = src.indexOf('function initialShared');
        var b = src.indexOf('function isAlive');
        t.ok(a > 0 && b > a, 'the fold section is locatable in the source');
        var foldSrc = src.slice(a, b);
        t.ok(foldSrc.indexOf('Date.now') === -1,
          'the fold section contains no Date.now() — elapsed time is derived, never sampled');
        t.ok(foldSrc.indexOf('localNow(') === -1,
          'the fold section does not reach the module\'s one wall-clock helper either');
        t.match(src, /localNow\(\)\s*\+\s*serverOffsetMs/,
          'sharedNow() is the local clock PLUS the RTDB server offset — the only wall clock in the file');
        t.match(src, /\.info\/serverTimeOffset/,
          'the skew correction comes from .info/serverTimeOffset (a synthetic path needing no rule)');

        t.noThrow(function () { M.applyEvent(null, null); }, 'applyEvent(null, null) does not throw');
        t.noThrow(function () { M.applyEvent(undefined, { t: 'wat' }); }, 'an unknown event type is ignored, not thrown on');
        t.noThrow(function () { M.foldEvents(M.initialShared({}), 'not an array'); }, 'foldEvents tolerates garbage');
        t.eq(M.elapsedMs(null, 0), 0, 'elapsedMs(null) is 0');

        /* An unstamped start is dropped rather than falling back to a clock. */
        var noStamp = M.applyEvent(M.initialShared({}), { t: 'start', durationSec: 600 });
        t.eq(noStamp.run.started, false,
          'a start event with no timestamp is DROPPED — there is no local-clock fallback to guess with');

        /* ================================================================== */
        t.group('shared time is derived from stored timestamps, not local clocks');

        var evs = [
          ev('e0001', { t: 'start', durationSec: 1200, by: 'u-a', byName: 'Alex', at: T0 }),
          ev('e0002', { t: 'pause', by: 'u-b', byName: 'Sam', at: T0 + 60000 }),
          ev('e0003', { t: 'resume', by: 'u-b', byName: 'Sam', at: T0 + 90000 })
        ];
        var folded = M.foldEvents(M.initialShared({}), evs);
        t.eq(folded.run.pausedMs, 30000, 'a 30s pause is held, to the millisecond, from the stored stamps');
        t.eq(M.elapsedMs(folded, T0 + 120000), 90000,
          'two minutes of wall time minus a 30s hold is 90s of run time');
        t.eq(M.elapsedMs(folded, T0 + 120000), M.elapsedMs(folded, T0 + 120000),
          'elapsedMs is pure — same input, same answer');
        t.eq(M.remainingSec(folded, T0 + 120000), 1200 - 90, 'the countdown agrees with the derivation');

        /* The real test: move the local clock somewhere absurd and re-fold. */
        var realNow = Date.now;
        var frozen;
        try {
          Date.now = function () { return T0 + 999999999; };
          frozen = M.foldEvents(M.initialShared({}), evs);
        } finally { Date.now = realNow; }
        t.deepEq(frozen.run, folded.run,
          'a client whose system clock is eleven days out folds the SAME run state — ' +
          'no part of the fold samples the local clock');
        t.eq(M.elapsedMs(frozen, T0 + 120000), 90000,
          'and derives the same elapsed time from the same stored stamps');

        /* Resume must not fast-forward: at the instant the room resumes, the
           clock reads exactly what it read when the pause started. A resume
           that credited the wall time spent paused would read 90s here. */
        t.eq(M.elapsedMs(folded, T0 + 90000), 60000,
          'at the instant of resume the run reads 60s, not 90s — resume never fast-forwards');

        /* Paused clock is frozen while paused. */
        var stillPaused = M.foldEvents(M.initialShared({}), evs.slice(0, 2));
        t.eq(M.elapsedMs(stillPaused, T0 + 60000), 60000, 'the clock reads 60s at the moment of the pause');
        t.eq(M.elapsedMs(stillPaused, T0 + 300000), 60000,
          'and still reads 60s four minutes later — pause freezes it for everybody');

        /* ================================================================== */
        t.group('simultaneous rubric writes do not clobber each other');

        function markEv(k, uid, name, role, verdict, at) {
          return ev(k, { t: 'mark', itemId: 'r7', verdict: verdict, label: 'Recognised sepsis criteria',
            role: role, by: uid, byName: name, at: at });
        }
        var base = [ev('e0001', { t: 'start', by: 'u-a', byName: 'Alex', at: T0 })];

        /* Proctor second. */
        var orderA = M.foldEvents(M.initialShared({}), base.concat([
          markEv('e0002', 'u-a', 'Alex', 'runner', 'good', T0 + 10000),
          markEv('e0003', 'u-b', 'Sam', 'proctor', 'missed', T0 + 10040)
        ]));
        /* Proctor first — 40ms the other way. */
        var orderB = M.foldEvents(M.initialShared({}), base.concat([
          markEv('e0002', 'u-b', 'Sam', 'proctor', 'missed', T0 + 10000),
          markEv('e0003', 'u-a', 'Alex', 'runner', 'good', T0 + 10040)
        ]));

        t.eq(orderA.marks.r7.verdict, 'missed',
          'the proctor\'s verdict stands when the proctor marks SECOND');
        t.eq(orderB.marks.r7.verdict, 'missed',
          'and when the proctor marks FIRST — role weight decides, not arrival order');
        t.eq(orderA.marks.r7.by, 'u-b', 'the winning mark is attributed to the proctor');
        t.eq(orderB.marks.r7.by, 'u-b', 'in both orders');
        t.eq(orderA.marks.r7.conflict, true, 'the disagreement is flagged, not hidden');
        t.eq(orderB.marks.r7.conflict, true, 'in both orders');
        t.eq(orderA.marks.r7.contested.length, 1, 'the losing verdict is KEPT — nothing is thrown away');
        t.eq(orderA.marks.r7.contested[0].verdict, 'good', 'and it is the runner\'s "good" that is kept');
        t.eq(orderA.marks.r7.contested[0].by, 'u-a', 'with the name of who wrote it');
        t.eq(orderB.marks.r7.contested[0].by, 'u-a', 'in both orders');
        t.contains(JSON.stringify(orderA.log), 'Disagreement',
          'the shared log names the disagreement so the pair can talk it through');

        /* Two people, same verdict: a co-sign, not a conflict. */
        var agreed = M.foldEvents(M.initialShared({}), base.concat([
          markEv('e0002', 'u-a', 'Alex', 'recorder', 'good', T0 + 10000),
          markEv('e0003', 'u-b', 'Sam', 'proctor', 'good', T0 + 10040)
        ]));
        t.eq(agreed.marks.r7.conflict, false, 'two people marking the same verdict is not a conflict');
        t.eq(agreed.marks.r7.coSigned.length, 1, 'the second mark is recorded as a co-sign');
        t.eq(agreed.marks.r7.verdict, 'good', 'and the verdict is unchanged');

        /* Same person twice: a correction, and it settles the argument. */
        var corrected = M.foldEvents(M.initialShared({}), base.concat([
          markEv('e0002', 'u-b', 'Sam', 'proctor', 'missed', T0 + 10000),
          markEv('e0003', 'u-a', 'Alex', 'runner', 'good', T0 + 10040),
          markEv('e0004', 'u-b', 'Sam', 'proctor', 'good', T0 + 30000)
        ]));
        t.eq(corrected.marks.r7.verdict, 'good', 'a proctor may correct their own mark');
        t.eq(corrected.marks.r7.conflict, false,
          'and once they agree with the person who contested them, the conflict is settled');

        /* Order-independence overall: the fold sorts by push key, so two
           clients that received the same events in different network orders
           still agree byte for byte. */
        var shuffled = base.concat([
          markEv('e0003', 'u-b', 'Sam', 'proctor', 'missed', T0 + 10040),
          markEv('e0002', 'u-a', 'Alex', 'runner', 'good', T0 + 10000)
        ]);
        t.deepEq(M.foldEvents(M.initialShared({}), shuffled).marks,
          orderA.marks,
          'events delivered out of order fold to identical state — push-key order is canonical');

        /* Withdrawing a mark is explicit, never implicit. */
        var withdrawn = M.applyEvent(orderA,
          ev('e0009', { t: 'unmark', itemId: 'r7', by: 'u-b', byName: 'Sam', at: T0 + 40000 }));
        t.eq(!!withdrawn.marks.r7, false, 'unmark clears the item');
        t.contains(JSON.stringify(withdrawn.log), 'withdrew', 'and says so in the shared log');

        /* Only the proctor marks — unless nobody took the seat. */
        t.eq(M.canMarkRubric('runner', { 'u-b': 'proctor' }), false,
          'with a proctor seated, the runner does not mark the rubric');
        t.eq(M.canMarkRubric('proctor', { 'u-b': 'proctor' }), true, 'the proctor does');
        t.eq(M.canMarkRubric('runner', { 'u-a': 'runner' }), true,
          'with nobody in the proctor seat everyone is on the hook — which is also true in the lab');

        /* ================================================================== */
        t.group('a role swap preserves the run');

        var mid = M.foldEvents(M.initialShared({ durationSec: 1200 }), [
          ev('e0001', { t: 'role', uid: 'u-a', role: 'runner', by: 'u-a', byName: 'Alex', at: T0 - 1000 }),
          ev('e0002', { t: 'role', uid: 'u-b', role: 'proctor', by: 'u-b', byName: 'Sam', at: T0 - 900 }),
          ev('e0003', { t: 'start', durationSec: 1200, by: 'u-a', byName: 'Alex', at: T0 }),
          ev('e0004', { t: 'action', text: 'Full set of vitals', by: 'u-a', byName: 'Alex', at: T0 + 15000 }),
          ev('e0005', { t: 'mark', itemId: 'r1', verdict: 'good', label: 'Hand hygiene',
            role: 'proctor', by: 'u-b', byName: 'Sam', at: T0 + 20000 }),
          ev('e0006', { t: 'pause', by: 'u-b', byName: 'Sam', at: T0 + 40000 }),
          ev('e0007', { t: 'resume', by: 'u-b', byName: 'Sam', at: T0 + 50000 })
        ]);
        var swapMapVal = M.swapMap(mid.roles, ['u-a', 'u-b']);
        var after = M.applyEvent(mid,
          ev('e0008', { t: 'swap', map: swapMapVal, round: 2, by: 'u-a', byName: 'Alex', at: T0 + 60000 }));

        t.eq(after.run.startedAt, mid.run.startedAt, 'the swap does not restart the clock');
        t.eq(after.run.pausedMs, mid.run.pausedMs, 'the held pause time carries over');
        t.eq(after.run.paused, false, 'and the run is still running, not torn down');
        t.deepEq(after.marks, mid.marks, 'the rubric marks survive the swap');
        t.eq(after.actions.length, mid.actions.length, 'the action log survives the swap');
        t.eq(after.round, 2, 'the round counter moves on');
        t.eq(after.roles['u-a'], 'proctor', 'whoever ran now proctors');
        t.eq(after.roles['u-b'], 'runner', 'and whoever proctored now runs');
        t.eq(M.elapsedMs(after, T0 + 120000), M.elapsedMs(mid, T0 + 120000),
          'the shared clock reads identically either side of the swap');

        var swapBack = M.applyEvent(after, ev('e0009', {
          t: 'swap', map: M.swapMap(after.roles, ['u-a', 'u-b']), round: 3,
          by: 'u-a', byName: 'Alex', at: T0 + 70000
        }));
        t.eq(swapBack.roles['u-a'], 'runner', 'a second swap puts them back — it is a rotation, not a scramble');
        t.eq(swapBack.roles['u-b'], 'proctor', 'for both seats');

        /* Three and four students still all get a seat. */
        var three = M.swapMap({ 'u-a': 'runner', 'u-b': 'proctor', 'u-c': 'recorder' },
          ['u-a', 'u-b', 'u-c']);
        t.eq(Object.keys(three).length, 3, 'a three-student swap seats all three');
        t.ok(Object.keys(three).map(function (k) { return three[k]; }).indexOf('runner') !== -1,
          'and there is still a runner afterwards');
        t.noThrow(function () { M.swapMap({}, []); }, 'swapping an empty room does not throw');

        /* ================================================================== */
        t.group('quiz answers are hidden until the room reveals them');

        var quiz = M.foldEvents(M.initialShared({}), [
          ev('e0001', { t: 'start', by: 'u-a', byName: 'Alex', at: T0 }),
          ev('e0002', { t: 'answer', qid: 'q1', choice: 'B', correct: true, by: 'u-a', byName: 'Alex', at: T0 + 5000 })
        ]);
        var beforeReveal = M.visibleAnswers(quiz, 'q1', 'u-b');
        t.eq(beforeReveal.revealed, false, 'the question is not revealed yet');
        t.eq(beforeReveal.answers['u-a'].hidden, true,
          'so the partner cannot see what Alex chose — nobody peeks');
        t.eq(M.visibleAnswers(quiz, 'q1', 'u-a').answers['u-a'].choice, 'B',
          'but you can always see your own answer');
        t.eq(M.readyToReveal(quiz, 'q1', ['u-a', 'u-b']), false, 'not ready while one of them has not answered');

        var both = M.applyEvent(quiz,
          ev('e0003', { t: 'answer', qid: 'q1', choice: 'C', correct: false, by: 'u-b', byName: 'Sam', at: T0 + 6000 }));
        t.eq(M.readyToReveal(both, 'q1', ['u-a', 'u-b']), true, 'ready once both have answered');

        var shown = M.applyEvent(both,
          ev('e0004', { t: 'reveal', qid: 'q1', by: 'u-a', byName: 'Alex', at: T0 + 7000 }));
        t.eq(M.visibleAnswers(shown, 'q1', 'u-b').answers['u-a'].choice, 'B',
          'after the reveal both answers are visible at once');
        t.eq(shown.study.tally['u-a'].right, 1, 'and the "who got it right" tally counts the right one');
        t.eq(shown.study.tally['u-b'].wrong, 1, 'and the wrong one');

        var lateChange = M.applyEvent(shown,
          ev('e0005', { t: 'answer', qid: 'q1', choice: 'B', correct: true, by: 'u-b', byName: 'Sam', at: T0 + 8000 }));
        t.eq(lateChange.study.answers.q1['u-b'].choice, 'C',
          'you cannot change your answer after the reveal');
        t.eq(lateChange.study.tally['u-b'].wrong, 1, 'and the tally cannot be re-run');

        /* Shared deck position and tab. */
        var deck = M.foldEvents(M.initialShared({}), [
          ev('e0001', { t: 'start', by: 'u-a', byName: 'Alex', at: T0 }),
          ev('e0002', { t: 'deck', index: 4, total: 9, by: 'u-a', byName: 'Alex', at: T0 + 1000 }),
          ev('e0003', { t: 'tab', tab: 'flashcards', by: 'u-b', byName: 'Sam', at: T0 + 2000 })
        ]);
        t.eq(deck.study.deckIndex, 4, 'the flashcard position is shared');
        t.eq(deck.study.tab, 'flashcards', 'and so is the tab');

        /* Coach prompts. */
        var coached = M.applyEvent(deck, ev('e0004', {
          t: 'prompt', index: 1, text: 'What are you missing before you escalate?',
          by: 'u-b', byName: 'Sam', at: T0 + 3000
        }));
        t.eq(coached.coach.prompts.length, 1, 'a coach prompt lands in the room');
        t.contains(JSON.stringify(coached.log), 'missing', 'and is read back in the shared log');

        /* ================================================================== */
        t.group('host disconnect does not freeze the room');

        var players = {
          'u-sam': { name: 'Sam', joinedAt: T0 - 60000, connected: false, alive: false, lastSeen: T0 - 50000 },
          'u-b': { name: 'Bo', joinedAt: T0 - 30000, connected: true, alive: true, lastSeen: T0 },
          'u-c': { name: 'Cy', joinedAt: T0 - 20000, connected: true, alive: true, lastSeen: T0 }
        };
        t.eq(M.hostIsStale(players, 'u-sam', T0), true, 'a disconnected host reads as stale');
        t.eq(M.hostIsStale(players, 'u-b', T0), false, 'a live host does not');
        t.eq(M.hostIsStale(players, '', T0), true, 'a room with no host at all is stale (somebody must take it)');
        t.eq(M.electHost(players, 'u-sam', T0), 'u-b',
          'the longest-tenured connected player inherits the room');
        t.eq(M.electHost(players, 'u-sam', T0), M.electHost(players, 'u-sam', T0),
          'the election is deterministic, so two clients cannot both think they are next');
        var tied = {
          'u-z': { joinedAt: T0, connected: true, alive: true, lastSeen: T0 },
          'u-a': { joinedAt: T0, connected: true, alive: true, lastSeen: T0 }
        };
        t.eq(M.electHost(tied, 'u-sam', T0), 'u-a', 'an exact tenure tie falls to the lower uid, never to both');
        t.eq(M.electHost({ 'u-sam': players['u-sam'] }, 'u-sam', T0), '',
          'a room with nobody left elects nobody rather than electing the corpse');

        /* The actual claim: the run does not depend on the host existing. */
        var hostless = M.foldEvents(M.initialShared({ durationSec: 1200 }), [
          ev('e0001', { t: 'start', durationSec: 1200, by: 'u-sam', byName: 'Sam', at: T0 }),
          ev('e0002', { t: 'action', text: 'Suctioned airway', by: 'u-b', byName: 'Bo', at: T0 + 10000 })
        ]);
        t.eq(M.elapsedMs(hostless, T0 + 60000), 60000,
          'the clock keeps deriving with the host gone — there is no host engine to stop');
        t.ok(M.elapsedMs(hostless, T0 + 120000) > M.elapsedMs(hostless, T0 + 60000),
          'and it keeps moving');
        var stillWorks = M.applyEvent(hostless,
          ev('e0003', { t: 'mark', itemId: 'r2', verdict: 'good', label: 'Repositioned',
            role: 'proctor', by: 'u-b', byName: 'Bo', at: T0 + 70000 }));
        t.eq(stillWorks.marks.r2.verdict, 'good',
          'and the surviving partner can still mark the rubric with no host present');
        t.match(src, /transaction\(function \(cur\) \{[\s\S]{0,200}str\(cur\) !== hostId/,
          'promotion is a write-if-unchanged transaction, the same claim codeblue.js uses');

        w0.cleanup();

        /* ================================================================== */
        t.group('the wire: creating, joining, and the namespace');

        var db1 = makeRoomDb();
        var w1 = H.makeWorld({ db: db1, uid: 'u-me' });
        w1.load(MODULE);
        var W1 = w1.window;
        var A1 = W1.MM.simprepPartner;

        return A1.createRoom({ kind: 'sim', topicId: 'nur2212-dka', durationSec: 1200 })
          .then(function (res) {
            t.ok(res && /^[A-Z]{4}$/.test(String(res.code)),
              'createRoom() resolves a four-letter code');
            t.eq(res.roomId, res.code, 'roomId and code are the same handle');
            t.ok(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(res.code),
              'the code alphabet has no I, O, 0 or 1 — it gets read aloud more than typed');

            var record = db1.get('codeblue/rooms/' + res.code);
            t.ok(!!record, 'the room was claimed under codeblue/rooms — the ONE ruled room path');
            t.eq(record.status, 'simprep-open',
              'status is "simprep-open"');
            t.notContains(String(record.status), 'ms2lab',
              'and not ms2lab\'s namespace either');
            t.eq(W1.SimPrepPartner.ROOM_STATUS_OPEN === 'open', false,
              'ROOM_STATUS_OPEN is NEVER the literal "open" — that string is what puts a room ' +
              'in Code Blue\'s lobby');

            /* Prove the claim against Code Blue's actual query, read from its
               source rather than assumed. */
            var cb = read('js/codeblue.js');
            t.match(cb, /orderByChild\('status'\)\.equalTo\('open'\)/,
              'codeblue.js still lists its lobby with equalTo("open") — the assumption holds');
            t.match(cb, /r\.status === 'open'/,
              'and re-filters the list on status === "open"');
            var mine = [W1.SimPrepPartner.ROOM_STATUS_OPEN, W1.SimPrepPartner.ROOM_STATUS_LIVE,
              W1.SimPrepPartner.ROOM_STATUS_DONE];
            mine.forEach(function (s) {
              t.ok(s !== 'open' && s !== 'running' && s !== 'done',
                'partner status "' + s + '" cannot satisfy the Code Blue lobby filter');
              t.ok(s !== 'ms2lab-open' && s !== 'ms2lab-done',
                'partner status "' + s + '" does not collide with the MS2 lab namespace');
            });

            t.eq(A1.isHost(), true, 'the creator is the host');
            t.ok(!!A1.getRoom(), 'and is already in the room — no second join round trip');
            t.eq(A1.getRoom().code, res.code, 'getRoom() reports the room we just made');

            /* Every path this module writes has to be one the rules already
               cover. A path outside codeblue/rooms would need a new rule. */
            var stray = db1.writes().filter(function (x) {
              return x.path.indexOf('codeblue/rooms/') !== 0;
            });
            t.eq(stray.length, 0,
              'every write lands under codeblue/rooms — no new Firebase rule is needed' +
              (stray.length ? ' (stray: ' + stray.map(function (s) { return s.path; }).join(', ') + ')' : ''));
            t.eq(W1.SimPrepPartner.ROOM_BASE, 'codeblue/rooms',
              'and the module says so out loud');

            return A1.leaveRoom();
          })
          .then(function () {
            t.eq(A1.getRoom(), null, 'leaveRoom() clears the session');
            t.eq(A1.isHost(), false, 'and the host flag with it');

            /* A Code Blue room must not be joinable through this module. */
            db1.seed('codeblue/rooms/ZZZZ', {
              code: 'ZZZZ', status: 'open', hostId: 'u-other', events: {}
            });
            db1.seed('codeblue/rooms/YYYY', {
              code: 'YYYY', status: 'ms2lab-open', hostId: 'u-other', events: {}
            });
            return A1.joinRoom('ZZZZ');
          })
          .then(function (st) {
            t.eq(st, null, 'joinRoom() REFUSES a Code Blue room (status "open")');
            t.contains(A1.lastError(), 'different kind of room',
              'and says why, rather than dropping a sim-prep UI on somebody else\'s arrest');
            return A1.joinRoom('YYYY');
          })
          .then(function (st) {
            t.eq(st, null, 'joinRoom() refuses an MS2 lab room too');
            return A1.joinRoom('QQQQ');
          })
          .then(function (st) {
            t.eq(st, null, 'joinRoom() on a code that does not exist resolves null');
            t.contains(A1.lastError(), 'QQQQ', 'and names the code so the pair can re-check it');
            return A1.joinRoom('AB');
          })
          .then(function (st) {
            t.eq(st, null, 'a short code is rejected before it hits the network');
            w1.cleanup();

            /* ============================================================== */
            t.group('a late joiner sees the current state, including a paused run');

            var db2 = makeRoomDb();
            seedLiveRoom(db2, 'LATE');
            db2.seed('.info/serverTimeOffset', 0);
            var w2 = H.makeWorld({ db: db2, uid: 'u-late' });
            w2.load(MODULE);
            var W2 = w2.window;
            var A2 = W2.MM.simprepPartner;

            var seenEvents = [];
            A2.onEvent(function (e) { seenEvents.push(e); });

            return A2.joinRoom('late').then(function (st) {
              return tick(30).then(function () { return st; });
            }).then(function () {
              var room = A2.getRoom();
              t.ok(!!room, 'a late joiner gets a room state');
              t.eq(room.code, 'LATE', 'normalised from lower case — a code is read aloud, not typed carefully');
              t.eq(room.run.started, true, 'the run that started before we arrived reads as started');
              t.eq(room.run.paused, true,
                'AND A PAUSED RUN READS AS PAUSED — the whole point of replaying the log on join');
              t.eq(room.run.pausedByName, 'Sam', 'with the name of who paused it');
              t.contains(String(room.run.pauseReason), 'order set', 'and the reason they gave');
              t.eq(room.run.startedAt, T0, 'the start timestamp came from the room, not from our clock');
              t.eq(W2.SimPrepPartner.elapsedMs(room.shared, T0 + 300000), 60000,
                'and the shared clock is frozen at the pause, four minutes of wall time later');
              t.eq(room.marks.r1.verdict, 'good', 'the mark made before we joined is here');
              t.eq(room.actions.length, 1, 'so is the action log');
              t.eq(String(room.activity.kind), 'sim', 'and the activity the room is on');
              t.eq(String(room.activity.topicId), 'nur2212-sepsis', 'and the topic');
              t.ok(seenEvents.length >= 6,
                'onEvent() replayed the whole log to a subscriber that registered before the join (' +
                seenEvents.length + ' events)');
              t.eq(room.isHost, false, 'the late joiner is not the host');
              t.eq(A2.isPaused(), true, 'the pause hub agrees the room is paused');
              t.eq(A2.canPause(), false, 'and refuses to pause an already-paused run');
              t.eq(A2.pauseStats().pausedByName, 'Sam', 'pauseStats() names who paused, for the UI');

              /* Any participant may resume - not just the host, and not just
                 the person who paused. */
              return A2.resumeRun();
            }).then(function () {
              return tick(20);
            }).then(function () {
              var room = A2.getRoom();
              t.eq(room.run.paused, false, 'any participant may resume the room, not just the host');
              t.eq(room.denied, false, 'and the write was accepted');

              /* ---- interop with the two modules that code against this ---- */
              t.ok(Array.isArray(room.peers),
                'roomState.peers is an ARRAY — js/simprep.js reads peers||members||players ' +
                'and arr() of a uid-keyed map is empty');
              t.ok(Array.isArray(room.members), 'and so is roomState.members');
              t.eq(typeof room.players, 'object', 'while roomState.players stays the raw RTDB map');
              var anyEvent = seenEvents[seenEvents.length - 1];
              t.eq(anyEvent.type, anyEvent.t,
                'events carry a `type` alias — the sibling modules read kind/type, not t');
              t.eq(anyEvent.uid, anyEvent.by, 'and a `uid` alias for `by`');
              t.eq(anyEvent.who, anyEvent.byName, 'and `who`/`name` for `byName`');

              /* Presence: we announced ourselves before reading anything. */
              t.ok(!!db2.get('codeblue/rooms/LATE/players/u-late'),
                'the joiner registered in /players immediately — announce first, ask questions after');
              t.eq(db2.get('codeblue/rooms/LATE/players/u-late').alive, true,
                'with the alive flag codeblue.js uses');

              /* Rejoining after a drop is just another replay. */
              return A2.leaveRoom().then(function () { return A2.joinRoom('LATE'); });
            }).then(function () {
              return tick(30);
            }).then(function () {
              var room = A2.getRoom();
              t.ok(!!room, 'a network drop and rejoin lands back in the room');
              t.eq(room.run.started, true, 'with the run intact');
              t.eq(room.marks.r1.verdict, 'good', 'and the rubric intact');
              t.eq(room.run.paused, false, 'and the resume we published still applied — no double-count');
              return A2.leaveRoom();
            }).then(function () {
              w2.cleanup();

              /* ============================================================ */
              t.group('clock skew between clients');

              var db3 = makeRoomDb();
              seedLiveRoom(db3, 'SKEW');
              /* This client's system clock is four minutes fast; the server
                 offset says so. */
              db3.seed('.info/serverTimeOffset', -240000);
              var w3 = H.makeWorld({ db: db3, uid: 'u-fast' });
              w3.load(MODULE);
              var W3 = w3.window;
              var A3 = W3.MM.simprepPartner;

              return A3.joinRoom('SKEW').then(function () {
                return tick(30);
              }).then(function () {
                var drift = A3.sharedNow() - Date.now();
                t.ok(Math.abs(drift + 240000) < 2000,
                  'sharedNow() corrects a four-minute-fast phone back onto server time (drift ' +
                  Math.round(drift / 1000) + 's)');
                t.eq(A3.serverOffset(), -240000, 'the offset came from .info/serverTimeOffset');
                var room = A3.getRoom();
                t.eq(room.serverOffsetMs, -240000, 'and rides along in the room state for the UI');

                /* The event this client writes must be stamped in server time,
                   not in its own wrong time. */
                return A3.logAction('Called the provider', 'comm');
              }).then(function () {
                return tick(20);
              }).then(function () {
                var evts = db3.get('codeblue/rooms/SKEW/events');
                var mineEv = Object.keys(evts).map(function (k) { return evts[k]; })
                  .filter(function (e) { return e.by === 'u-fast'; })[0];
                t.ok(!!mineEv, 'the action reached the shared log');
                t.ok(Math.abs(mineEv.at - (Date.now() - 240000)) < 3000,
                  'and it is stamped in SHARED time, not in this phone\'s four-minutes-fast clock');

                /* A caller that stamps its own at() must not be able to
                   reintroduce the skew this module exists to remove.
                   js/simprep.js publishes at: nowMs() on every event. */
                return A3.publish({ kind: 'study_answer', at: Date.now(), label: 'Q3' });
              }).then(function () {
                return tick(20);
              }).then(function () {
                var evts = db3.get('codeblue/rooms/SKEW/events');
                var theirs = Object.keys(evts).map(function (k) { return evts[k]; })
                  .filter(function (e) { return e.t === 'study_answer'; })[0];
                t.ok(!!theirs,
                  'an event published with `kind` instead of `t` is accepted — js/simprep.js ' +
                  'has its own vocabulary and this file must not silently drop it');
                t.ok(Math.abs(theirs.at - (Date.now() - 240000)) < 3000,
                  'and it is RE-STAMPED in shared time even though the caller supplied its own');
                t.ok(Math.abs(numOrT(theirs.clientAt) - Date.now()) < 3000,
                  'with the caller\'s original stamp kept as clientAt');
                return A3.leaveRoom();
              }).then(function () {
                w3.cleanup();

                /* ========================================================== */
                t.group('a denied Firebase write degrades without throwing');

                var db4 = makeRoomDb({ deny: /\/events$/ });
                seedLiveRoom(db4, 'DENY');
                var w4 = H.makeWorld({ db: db4, uid: 'u-denied' });
                w4.load(MODULE);
                var W4 = w4.window;
                var A4 = W4.MM.simprepPartner;

                return A4.joinRoom('DENY').then(function () {
                  return tick(30);
                }).then(function () {
                  t.ok(!!A4.getRoom(), 'the room still loads read-only when writes are refused');
                  var p = null;
                  t.noThrow(function () {
                    p = A4.publish({ t: 'mark', itemId: 'r9', verdict: 'good', label: 'x' });
                  }, 'publish() into a denied path does not throw synchronously');
                  return t.resolves(p, 'and the promise RESOLVES rather than rejecting into a render path');
                }).then(function () {
                  return tick(30);
                }).then(function () {
                  var room = A4.getRoom();
                  t.eq(room.denied, true,
                    'the room reports denied:true so the caller can fall back to solo');
                  t.ok(String(room.error).length > 0, 'with a sentence a student can read');
                  t.eq(room.run.started, true, 'and everything already read stays correct');
                  t.noThrow(function () { A4.pause('x'); }, 'pausing through a denied path does not throw');
                  t.noThrow(function () { A4.swapRoles(); }, 'swapping seats through a denied path does not throw');
                  t.noThrow(function () { A4.setActivity({ kind: 'study' }); }, 'setActivity() does not throw');
                  return A4.leaveRoom();
                }).then(function () {
                  w4.cleanup();

                  /* -------------------------------------------------------- */
                  t.group('the event log is the ledger; /players is only a badge');

                  /* Under the deployed rules a client may write /players/<its
                     own uid>. Seating a PARTNER writes /players/<their uid>,
                     which is the one write in this module a tightened rule
                     could refuse. It must not matter: the swap EVENT is what
                     the fold reads. */
                  var db6 = makeRoomDb({ deny: /players\/u-sam$/ });
                  seedLiveRoom(db6, 'SEAT');
                  var w6a = H.makeWorld({ db: db6, uid: 'u-me' });
                  w6a.load(MODULE);
                  var A6 = w6a.window.MM.simprepPartner;
                  return A6.joinRoom('SEAT').then(function () {
                    return tick(30);
                  }).then(function () {
                    t.noThrow(function () { A6.swapRoles(); },
                      'seating a partner whose /players node is refused does not throw');
                    return tick(30);
                  }).then(function () {
                    var room = A6.getRoom();
                    t.eq(db6.get('codeblue/rooms/SEAT/players/u-sam').role, 'runner',
                      'the refused mirror write left Sam\'s /players badge on the old role');
                    t.ok(room.roles['u-sam'] !== 'runner',
                      'but the fold moved Sam anyway — the swap event is authoritative, ' +
                      'not the presence record');
                    var sam = room.roster.filter(function (r) { return r.uid === 'u-sam'; })[0];
                    t.eq(sam.role, room.roles['u-sam'],
                      'and the roster the UI renders reads the fold, not /players');
                    t.eq(room.run.started, true, 'with the run untouched by any of it');
                    return A6.leaveRoom();
                  }).then(function () {
                    w6a.cleanup();
                  });
                }).then(function () {

                  /* -------------------------------------------------------- */
                  t.group('a room code collision retries rather than colliding');

                  /* Every code reads as already claimed, so the write-if-absent
                     transaction can never commit. It must give up cleanly. */
                  var db5 = makeRoomDb({ occupied: true });
                  var w5 = H.makeWorld({ db: db5, uid: 'u-unlucky' });
                  w5.load(MODULE);
                  var A5 = w5.window.MM.simprepPartner;
                  return A5.createRoom({ kind: 'study', topicId: 'x' }).then(function (res) {
                    t.eq(res, null,
                      'when every code is taken the claim gives up instead of stealing a room');
                    t.contains(A5.lastError(), 'free room code', 'and says so');
                    t.eq(db5.writesTo(/^codeblue\/rooms\/[A-Z]{4}$/).length, 0,
                      'and nothing was overwritten — the transaction refuses a non-empty node');
                    w5.cleanup();

                    /* ------------------------------------------------------ */
                    t.group('it renders');

                    var w6 = H.makeWorld({ signedOut: true });
                    w6.load(MODULE);
                    var r6 = H.renderInto(w6.window,
                      React.createElement(w6.window.SimPrepPartner, {}));
                    t.contains(r6.text(), 'signed in',
                      'signed out, the lobby says so in words instead of rendering an empty room');
                    t.contains(r6.text(), 'swap', 'and explains the swap, which is the point of the mode');
                    r6.unmount();
                    w6.cleanup();

                    var db7 = makeRoomDb();
                    var w7 = H.makeWorld({ db: db7, uid: 'u-me' });
                    w7.load(MODULE);
                    var r7 = H.renderInto(w7.window,
                      React.createElement(w7.window.SimPrepPartner, {
                        authUser: w7.window.MM.authUser
                      }));
                    t.contains(r7.text(), 'Open a room', 'signed in, the lobby offers a room');
                    t.contains(r7.text(), 'Join with a code', 'and a way to join one');
                    t.eq(w7.window.SimPrepPartner.discoverTopics().length, 0,
                      'with no data file loaded the topic list is empty rather than throwing');
                    t.contains(r7.text(), 'topic list has not loaded',
                      'and the lobby says so and still lets you open a room');
                    t.ok(r7.all('button.spp-btn').length > 3, 'with real controls');
                    t.ok(!!r7.find('.spp-root'), 'under the spp- prefix, so nothing collides with another module');
                    r7.unmount();

                    var styleTags = w7.window.document.querySelectorAll('style');
                    var css = Array.prototype.map.call(styleTags, function (s) {
                      return s.textContent;
                    }).join('\n');
                    t.match(css, /\.spp-btn\{[^}]*color:/,
                      'the injected CSS gives .spp-btn its own color (a button does not inherit one)');
                    t.match(css, /\.spp-btn\{[^}]*background:/, 'and its own background');
                    t.eq(w7.window.document.querySelectorAll('#simprep-partner-styles').length, 1,
                      'the stylesheet is injected exactly once');
                    w7.cleanup();

                    /* -------------------------------------------------------- */
                    t.group('the topic list is discovered, never required');

                    /* The real data file, keyed on `topic_id` - the spelling
                       js/simprep.js and js/simprep-sim.js resolve against, so
                       it is the one that has to survive into the room's cfg. */
                    var w8 = H.makeWorld({ db: makeRoomDb(), uid: 'u-me' });
                    w8.load('data/nur2212-scenarios.js');
                    w8.load(MODULE);
                    var found = w8.window.SimPrepPartner.discoverTopics();
                    t.ok(found.length >= 8,
                      'with data/nur2212-scenarios.js loaded the lobby finds the topics (' +
                      found.length + ')');
                    t.ok(found.filter(function (x) { return !x.id || !x.title; }).length === 0,
                      'each one carries the topic_id and title the other modules resolve against');
                    var r8 = H.renderInto(w8.window,
                      React.createElement(w8.window.SimPrepPartner, {
                        authUser: w8.window.MM.authUser
                      }));
                    t.ok(r8.all('select option').length >= 8, 'and offers them as a picker');
                    t.notContains(r8.text(), 'topic list has not loaded',
                      'and drops the "not loaded yet" fallback');
                    r8.unmount();
                    w8.cleanup();

                    return tick(60).then(function () {
                      t.group('no write leaves a rejection on the floor');
                      t.eq(unhandled.length, 0,
                        'not one unhandled promise rejection across every denied write in this ' +
                        'suite — a refused set()/update() rejects rather than throwing, and an ' +
                        'uncaught one takes the whole page down with it' +
                        (unhandled.length ? ' (' + unhandled.slice(0, 4).join(', ') + ')' : ''));
                    });
                  });
                });
              });
            });
          });
      });
  }
};
