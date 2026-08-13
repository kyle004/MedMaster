/* ============================================================================
   MedMaster test harness
   ----------------------------------------------------------------------------
   Shared scaffolding for the audio test suites. No framework, no build step -
   the same constraints as the app itself.

   Run everything:   node tests/run.js
   Run one file:     node tests/run.js voice-normalizer
   Verbose:          node tests/run.js --verbose

   Requires jsdom + react + react-dom. If they are missing the runner explains
   how to install them rather than dumping a stack trace.
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');

var APP_ROOT = path.resolve(__dirname, '..');

/* ---------------------------------------------------------------- assertions */

function Suite(name) {
  this.name = name;
  this.passed = 0;
  this.failed = 0;
  this.failures = [];
  this.section = '';
}

Suite.prototype.group = function (title) {
  this.section = title;
  if (process.env.MM_VERBOSE) console.log('\n  ' + title);
};

Suite.prototype._record = function (ok, label, detail) {
  if (ok) {
    this.passed++;
    if (process.env.MM_VERBOSE) console.log('    PASS  ' + label);
  } else {
    this.failed++;
    var where = this.section ? this.section + ' > ' : '';
    this.failures.push({ label: where + label, detail: detail || '' });
    console.log('    FAIL  ' + where + label + (detail ? '\n          ' + detail : ''));
  }
  return ok;
};

/** Truthy assertion. */
Suite.prototype.ok = function (cond, label) {
  return this._record(!!cond, label);
};

/** Strict equality with a readable diff. */
Suite.prototype.eq = function (actual, expected, label) {
  var ok = actual === expected;
  return this._record(ok, label, ok ? '' :
    'expected: ' + JSON.stringify(expected) + '\n          actual:   ' + JSON.stringify(actual));
};

/** Deep equality via JSON (sufficient for the plain data these tests use). */
Suite.prototype.deepEq = function (actual, expected, label) {
  var a = JSON.stringify(actual), b = JSON.stringify(expected);
  return this._record(a === b, label, a === b ? '' :
    'expected: ' + b + '\n          actual:   ' + a);
};

/** Substring match, case-insensitive - the workhorse for spoken-text checks. */
Suite.prototype.contains = function (haystack, needle, label) {
  var h = String(haystack == null ? '' : haystack).toLowerCase();
  var n = String(needle == null ? '' : needle).toLowerCase();
  var ok = h.indexOf(n) !== -1;
  return this._record(ok, label, ok ? '' :
    'wanted substring: ' + JSON.stringify(needle) + '\n          in:               ' + JSON.stringify(haystack));
};

Suite.prototype.notContains = function (haystack, needle, label) {
  var h = String(haystack == null ? '' : haystack).toLowerCase();
  var n = String(needle == null ? '' : needle).toLowerCase();
  var ok = h.indexOf(n) === -1;
  return this._record(ok, label, ok ? '' :
    'did NOT want: ' + JSON.stringify(needle) + '\n          in:           ' + JSON.stringify(haystack));
};

Suite.prototype.match = function (value, re, label) {
  var ok = re.test(String(value == null ? '' : value));
  return this._record(ok, label, ok ? '' :
    'wanted /' + re.source + '/\n          got: ' + JSON.stringify(value));
};

/** Asserts fn() throws. Used sparingly - most of this code must NOT throw. */
Suite.prototype.throws = function (fn, label) {
  var threw = false;
  try { fn(); } catch (e) { threw = true; }
  return this._record(threw, label, 'expected a throw, got none');
};

/** Asserts fn() does NOT throw - the far more common requirement here. */
Suite.prototype.noThrow = function (fn, label) {
  try { fn(); return this._record(true, label); }
  catch (e) { return this._record(false, label, 'threw: ' + e.message); }
};

/** Asserts a promise resolves (never rejects) - the voice contract. */
Suite.prototype.resolves = function (p, label) {
  var self = this;
  return Promise.resolve(p).then(
    function (v) { self._record(true, label); return v; },
    function (e) { self._record(false, label, 'rejected with: ' + (e && e.message ? e.message : e)); return null; }
  );
};

/* ------------------------------------------------------------- jsdom world */

/**
 * makeWorld(opts) -> {window, cleanup}
 *
 * A fresh jsdom window with the globals the modules expect, plus the mocks
 * they reach for. Each suite gets its own world so state cannot leak between
 * tests (the modules keep module-scope caches - that is the point of the
 * isolation).
 *
 * opts:
 *   tier          'free' | 'plus' | 'pro' | 'instructor'  (default 'pro')
 *   owner         bool - signed in as codingky@gmail.com
 *   signedOut     bool - no authUser at all
 *   resolving     bool - MM.ai.isResolving() returns true
 *   noStorage     bool - firebase.storage() missing (degrade path)
 *   noSpeech      bool - window.speechSynthesis missing (no browser TTS)
 *   fetchImpl     function - replaces global fetch
 *   voiceProfiles object   - seeds appConfig/aiConfig/voiceProfiles
 *   db            object   - a FakeDb (see makeFakeDb); one is created if absent
 */
function makeWorld(opts) {
  opts = opts || {};
  var JSDOM = require('jsdom').JSDOM;
  var dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>', {
    url: 'https://medmaster.guru/',
    pretendToBeVisual: true
  });
  var w = dom.window;

  /* Node globals the modules touch directly.
     `navigator` is a getter-only global on Node >= 21, so a plain assignment
     throws. defineProperty works on every version. */
  global.window = w;
  global.document = w.document;
  try {
    Object.defineProperty(global, 'navigator', {
      value: w.navigator, writable: true, configurable: true
    });
  } catch (e) { /* older Node: the plain assignment below is fine */
    try { global.navigator = w.navigator; } catch (e2) {}
  }
  global.self = w;
  global.localStorage = w.localStorage;
  global.HTMLElement = w.HTMLElement;
  global.Element = w.Element;
  global.Node = w.Node;
  global.Event = w.Event;
  global.CustomEvent = w.CustomEvent;
  global.Blob = w.Blob;
  global.requestAnimationFrame = function (cb) { return setTimeout(cb, 0); };
  global.cancelAnimationFrame = function (id) { clearTimeout(id); };
  global.IS_REACT_ACT_ENVIRONMENT = true;

  /* React, shared instance so hooks work across module boundaries. */
  var React = require('react');
  w.React = React;
  global.React = React;
  try {
    var RD = require('react-dom/client');
    w.ReactDOM = {
      createRoot: RD.createRoot,
      render: function (el, host) { var r = RD.createRoot(host); r.render(el); return r; }
    };
    w.__RD = RD;
  } catch (e) { /* react-dom optional for pure-logic suites */ }

  /* --- speech synthesis (browser TTS) --- */
  var spoken = [];
  if (!opts.noSpeech) {
    var voices = [
      { name: 'Samantha', lang: 'en-US', default: true },
      { name: 'Daniel', lang: 'en-GB' },
      { name: 'Alex', lang: 'en-US' }
    ];
    w.speechSynthesis = {
      speaking: false, paused: false, pending: false,
      getVoices: function () { return voices; },
      onvoiceschanged: null,
      speak: function (u) {
        spoken.push(u.text);
        w.speechSynthesis.speaking = true;
        setTimeout(function () {
          w.speechSynthesis.speaking = false;
          if (typeof u.onend === 'function') u.onend({});
        }, 1);
      },
      cancel: function () { w.speechSynthesis.speaking = false; },
      pause: function () {}, resume: function () {}
    };
    w.SpeechSynthesisUtterance = function (t) {
      this.text = t; this.rate = 1; this.pitch = 1; this.volume = 1;
      this.voice = null; this.onend = null; this.onerror = null; this.onstart = null;
    };
  }
  w.__spoken = spoken;

  /* --- Audio element (ElevenLabs playback) --- */
  var audios = [];
  w.__audios = audios;
  w.Audio = function (src) {
    var self = this;
    this.src = src || '';
    this.paused = true;
    this.currentTime = 0;
    this.playbackRate = 1;
    this.volume = 1;
    this.preload = '';
    this._handlers = {};
    this.play = function () {
      if (w.__blockAutoplay) return Promise.reject(new Error('NotAllowedError'));
      self.paused = false;
      setTimeout(function () {
        if (self.paused) return;
        self.paused = true;
        if (typeof self.onended === 'function') self.onended({});
        if (self._handlers.ended) self._handlers.ended.forEach(function (f) { f({}); });
      }, 1);
      return Promise.resolve();
    };
    this.pause = function () { self.paused = true; };
    this.load = function () {};
    this.addEventListener = function (k, f) {
      (self._handlers[k] = self._handlers[k] || []).push(f);
    };
    this.removeEventListener = function (k, f) {
      if (!self._handlers[k]) return;
      self._handlers[k] = self._handlers[k].filter(function (x) { return x !== f; });
    };
    audios.push(this);
  };

  /* --- fetch --- */
  var calls = [];
  w.__fetchCalls = calls;
  var fetchImpl = opts.fetchImpl || function () {
    return Promise.resolve(jsonResponse({ ok: true }));
  };
  w.fetch = global.fetch = function (url, init) {
    calls.push({ url: String(url), init: init || {}, body: parseBody(init) });
    return fetchImpl(String(url), init || {}, calls.length);
  };

  /* --- firebase --- */
  var db = opts.db || makeFakeDb();
  w.__db = db;
  var uploads = [];
  w.__uploads = uploads;
  /* Storage double. js/voice.js uploads base64 with putString(), not put(),
     so BOTH must be recorded or every upload assertion is silently vacuous. */
  function storageRef(p) {
    function record(payload) {
      if (w.__failUpload) return Promise.reject(new Error('storage 403'));
      uploads.push({ path: p, size: (payload && (payload.size || payload.length)) || 0 });
      return Promise.resolve({
        ref: { getDownloadURL: function () { return Promise.resolve('https://storage.test/' + p); } },
        metadata: { fullPath: p }
      });
    }
    return {
      fullPath: p,
      child: function (c) { return storageRef(p + '/' + c); },
      put: record,
      putString: function (data) { return record(data); },
      getDownloadURL: function () { return Promise.resolve('https://storage.test/' + p); },
      delete: function () { return Promise.resolve(); }
    };
  }
  var storage = opts.noStorage ? null : { ref: storageRef };

  w.firebase = {
    /* voiceStorage() checks firebase.apps before using storage(); without it
       the whole upload+publish half of the cache ladder no-ops. */
    apps: [{ name: '[DEFAULT]' }],
    initializeApp: function () { return {}; },
    database: Object.assign(function () { return db; }, { ServerValue: { TIMESTAMP: 0 } }),
    auth: function () {
      return {
        onAuthStateChanged: function (cb) { setTimeout(function () { cb(null); }, 0); return function () {}; },
        signOut: function () { return Promise.resolve(); }
      };
    },
    storage: opts.noStorage ? undefined : function () { return storage; }
  };
  if (opts.noStorage) delete w.firebase.storage;
  /* Some call sites prefer MM.storage over firebase.storage(). */
  w.__storage = storage;

  /* --- MM bridge --- */
  var tier = opts.tier || 'pro';
  var email = opts.owner ? 'codingky@gmail.com' : 'student@example.edu';
  var toasts = [];
  w.__toasts = toasts;
  w.MM = {
    authUser: opts.signedOut ? null : {
      uid: opts.uid || 'u-test',
      email: email,
      getIdToken: function () { return Promise.resolve('fake.id.token'); }
    },
    myId: opts.signedOut ? '' : (opts.uid || 'u-test'),
    isSuperAdmin: !!opts.owner,
    isAdmin: !!opts.owner,
    userTier: tier,
    db: db,
    firebaseReady: !opts.signedOut,
    siteConfig: {},
    getProgress: function () { return opts.progress || {}; },
    setProgress: function () {},
    navigate: function () {},
    toast: function (m, t) { toasts.push({ msg: String(m), type: t || 'info' }); },
    storage: storage
  };

  if (opts.voiceProfiles) db.seed('appConfig/aiConfig/voiceProfiles', opts.voiceProfiles);
  if (opts.aiConfig) db.seed('appConfig/aiConfig', opts.aiConfig);

  /* Overridable tier reporting for suites that load ai.js. */
  w.__forceTier = tier;
  w.__forceResolving = !!opts.resolving;

  return {
    window: w,
    dom: dom,
    db: db,
    /** Load an app module into this world.
     *  jsdom is created without runScripts, so w.eval() executes the module in
     *  NODE's global scope - `window` inside it resolves dynamically to
     *  whichever world was created last. Closures stay isolated but globals do
     *  not, so a stale world's deferred callback can republish itself into the
     *  newest world. Pinning global.window for the duration of the eval keeps
     *  each module bound to the world that loaded it. */
    load: function (rel) {
      var p = path.join(APP_ROOT, rel);
      var prev = global.window;
      global.window = w;
      try { w.eval(fs.readFileSync(p, 'utf8')); }
      finally { if (prev && prev !== w) global.window = prev; }
      return w;
    },
    /** Load a module and patch MM.ai's tier reporting to match opts. */
    loadAiThenPatch: function () {
      this.load('js/ai.js');
      if (w.MM && w.MM.ai) {
        w.MM.ai.getTier = function () { return w.__forceTier; };
        w.MM.ai.isResolving = function () { return !!w.__forceResolving; };
        w.MM.ai.onResolved = function (cb) {
          setTimeout(function () { try { cb(); } catch (e) {} }, 0);
          return function () {};
        };
      }
      return w;
    },
    cleanup: function () {
      try { dom.window.close(); } catch (e) {}
      delete global.window; delete global.document; delete global.navigator;
      delete global.self; delete global.localStorage;
    }
  };
}

/* ------------------------------------------------------------- fake RTDB */

/**
 * A minimal Firebase Realtime Database double: path-keyed store with on/once/
 * set/update/remove/transaction and child_added replay. Enough for the cache
 * index and config reads these modules do, and it records every write so a
 * test can assert on the exact path written.
 */
function makeFakeDb() {
  var store = {};
  var listeners = {};
  var writes = [];

  function get(p) { return store[p] === undefined ? null : store[p]; }
  function set(p, v) {
    if (v === null) delete store[p]; else store[p] = v;
    writes.push({ path: p, value: v });
    fire(p);
  }
  function fire(p) {
    (listeners[p] || []).forEach(function (l) {
      try { l.cb({ val: function () { return get(p); }, key: p.split('/').pop(), exists: function () { return get(p) !== null; } }); }
      catch (e) {}
    });
  }

  function ref(p) {
    p = String(p).replace(/^\/+|\/+$/g, '');
    return {
      key: p.split('/').pop(),
      child: function (c) { return ref(p + '/' + c); },
      once: function () {
        return Promise.resolve({
          val: function () { return get(p); },
          exists: function () { return get(p) !== null; },
          key: p.split('/').pop()
        });
      },
      on: function (evt, cb) {
        (listeners[p] = listeners[p] || []).push({ evt: evt, cb: cb });
        setTimeout(function () {
          cb({ val: function () { return get(p); }, key: p.split('/').pop(), exists: function () { return get(p) !== null; } });
        }, 0);
        return cb;
      },
      off: function () { listeners[p] = []; },
      set: function (v) { set(p, v); return Promise.resolve(); },
      update: function (o) {
        Object.keys(o).forEach(function (k) { set(p + '/' + k, o[k]); });
        return Promise.resolve();
      },
      remove: function () { set(p, null); return Promise.resolve(); },
      push: function (v) {
        var id = 'k' + (writes.length + 1);
        if (v !== undefined) set(p + '/' + id, v);
        return { key: id };
      },
      transaction: function (fn) {
        var next = fn(get(p));
        if (next !== undefined) set(p, next);
        return Promise.resolve({ committed: next !== undefined, snapshot: { val: function () { return get(p); } } });
      },
      orderByChild: function () { return ref(p); },
      equalTo: function () { return ref(p); },
      limitToLast: function () { return ref(p); }
    };
  }

  return {
    ref: ref,
    seed: function (p, v) { store[String(p).replace(/^\/+|\/+$/g, '')] = v; },
    raw: function () { return store; },
    get: function (p) { return get(String(p).replace(/^\/+|\/+$/g, '')); },
    writes: function () { return writes.slice(); },
    writesTo: function (rx) { return writes.filter(function (x) { return rx.test(x.path); }); },
    reset: function () { store = {}; listeners = {}; writes = []; }
  };
}

/* -------------------------------------------------------------- responses */

function jsonResponse(obj, status) {
  var body = JSON.stringify(obj);
  return {
    ok: (status || 200) < 400,
    status: status || 200,
    headers: { get: function () { return 'application/json'; } },
    json: function () { return Promise.resolve(obj); },
    text: function () { return Promise.resolve(body); },
    arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(8)); }
  };
}

function errorResponse(status, bodyObj) {
  return jsonResponse(bodyObj || { error: 'server', message: 'boom' }, status);
}

/** A believable /api/tts success payload. */
function ttsOk(extra) {
  var base = {
    ok: true,
    b64: 'SUQzBAAAAAAA',            // tiny fake mp3 header, valid base64
    mime: 'audio/mpeg',
    voiceId: 'voice-A',
    modelId: 'eleven_flash_v2_5',
    chars: 42,
    cost: 0.0000092
  };
  if (extra) Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
  return jsonResponse(base);
}

function parseBody(init) {
  if (!init || !init.body) return null;
  try { return JSON.parse(init.body); } catch (e) { return init.body; }
}

/* ------------------------------------------------------------ react utils */

function renderInto(w, element) {
  var host = w.document.createElement('div');
  w.document.body.appendChild(host);
  var root = w.__RD.createRoot(host);
  var React = require('react');
  var act = React.act;
  var ow = console.warn, oe = console.error;
  console.warn = function () {}; console.error = function () {};
  try {
    act(function () { root.render(element); });
  } finally {
    console.warn = ow; console.error = oe;
  }
  return {
    host: host,
    root: root,
    text: function () { return (host.textContent || '').replace(/\s+/g, ' ').trim(); },
    find: function (sel) { return host.querySelector(sel); },
    all: function (sel) { return Array.prototype.slice.call(host.querySelectorAll(sel)); },
    button: function (rx) {
      return this.all('button').filter(function (b) { return rx.test(b.textContent || ''); })[0] || null;
    },
    click: function (el) {
      if (!el) return;
      var ow2 = console.error; console.error = function () {};
      try { act(function () { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }); }
      finally { console.error = ow2; }
    },
    unmount: function () {
      var oe2 = console.error; console.error = function () {};
      try { act(function () { root.unmount(); }); } finally { console.error = oe2; }
    }
  };
}

/** Let pending promises and timers flush. */
function tick(ms) {
  return new Promise(function (r) { setTimeout(r, ms || 5); });
}

/**
 * actTick(ms) - flush timers AND promises INSIDE React's act(), so any state
 * update they trigger is applied and re-rendered before the caller asserts.
 *
 * Plain tick() is not enough for a component that loads asynchronously: the
 * Firebase listener and the /api fetch both resolve outside the initial act()
 * block, so without this the DOM is still showing "Loading..." when the test
 * reads it, and every content assertion fails for the wrong reason.
 *
 * React's act() noise is silenced here rather than at each call site.
 */
function actTick(ms) {
  var React = require('react');
  var act = React.act;
  if (typeof act !== 'function') return tick(ms);
  var ow = console.warn, oe = console.error;
  console.warn = function () {}; console.error = function () {};
  /* React's act() returns a bare THENABLE ({then}), not a Promise. Calling
     .then() on it directly returns whatever their then() returns - which is
     undefined - so the chain silently breaks with "Cannot read properties of
     undefined (reading 'then')" one link later. Promise.resolve() adopts the
     thenable and gives back a real Promise. */
  return Promise.resolve(act(function () {
    return new Promise(function (r) { setTimeout(r, ms || 30); });
  })).then(function () {
    console.warn = ow; console.error = oe;
  }, function (e) {
    console.warn = ow; console.error = oe;
    throw e;
  });
}

/* Real scenario data, for corpus sweeps. */
function loadScenarioCorpus() {
  var sandbox = { window: {} };
  ['scenarios-ms2a', 'scenarios-ms2b', 'scenarios-ob', 'scenarios-peds', 'medadmin'].forEach(function (f) {
    var code = fs.readFileSync(path.join(APP_ROOT, 'data', f + '.js'), 'utf8');
    /* eslint-disable no-new-func */
    (new Function('window', code))(sandbox.window);
  });
  var w = sandbox.window;
  return {
    scenarios: [].concat(w.SCENARIOS_MS2A || [], w.SCENARIOS_MS2B || [],
                         w.SCENARIOS_OB || [], w.SCENARIOS_PEDS || []),
    marCases: w.MEDADMIN_MAR_CASES || [],
    drugs: w.MEDADMIN_DRUGS || []
  };
}

module.exports = {
  Suite: Suite,
  makeWorld: makeWorld,
  makeFakeDb: makeFakeDb,
  jsonResponse: jsonResponse,
  errorResponse: errorResponse,
  ttsOk: ttsOk,
  renderInto: renderInto,
  tick: tick,
  actTick: actTick,
  loadScenarioCorpus: loadScenarioCorpus,
  APP_ROOT: APP_ROOT
};
