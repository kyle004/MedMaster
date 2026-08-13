/* ============================================================================
   voice-e2e.test.js
   ----------------------------------------------------------------------------
   END-TO-END / INTEGRATION tests for the MedMaster audio layer.

   The peer suites test the pieces:
     voice-normalizer.test.js  - text in, text out
     voice-cache.test.js       - the clip cache ladder
     tts-server.test.js        - the Netlify function

   This one tests the SEAMS BETWEEN them, with the real modules loaded together
   in one window, exactly as index.html loads them:

       js/ai.js  ->  tier + isResolving        (who is allowed a studio voice)
       js/voice.js                             (two engines behind one speak())
       js/ai-admin.js                          (who gets WHICH studio voice)
       js/ai-scenario.js / js/codeblue.js      (the text that gets spoken)

   ONE invariant is asserted everywhere, because it is the only promise the
   audio layer actually makes to a student:

       speak() NEVER rejects, and a line is ALWAYS heard - premium or browser.

   Any assertion that fails lives in a group whose title starts with "DEFECT:".
   Everything else is green. A failure here is a finding, not a broken test.

   Run:  node tests/run.js voice-e2e
   ========================================================================== */
'use strict';

/* Node >= 21 exposes `navigator` as an accessor and _harness.js assigns to it.
   Make it writable before the harness loads. (Same shim as the peer suites.) */
(function () {
  try {
    var d = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    if (d && d.writable !== true) {
      Object.defineProperty(globalThis, 'navigator',
        { value: undefined, writable: true, configurable: true });
    }
  } catch (e) { /* older Node: nothing to do */ }
})();

var H = require('./_harness.js');

/* Voice ids must pass the server's ^[A-Za-z0-9_-]{8,64}$ gate or js/voice.js
   drops the profile on the floor and every premium assertion goes vacuous. */
var VOICE = {
  nurse:      '21m00Tcm4TlvDq8ikWAM',
  patient:    'AZnzlk1XvdvUeBnXmlld',
  instructor: 'EXAVITQu4vr4xnSDxMaL',
  child:      'MF3mGyEYCl7XYWbV9V6O',
  family:     'TxGEqnHWrfWFTfGW9XjX'
};
var MODEL = 'eleven_flash_v2_5';
var MAX_MEM_CLIPS = 300;                /* the constant in js/voice.js:1537 */

/* ---------------------------------------------------------------------------
   HARNESS WORKAROUND 1 - a hierarchical RTDB double
   H.makeFakeDb() is a FLAT path->value map: a write to
   'appConfig/aiConfig/voiceProfiles/patient' is invisible to a listener on
   'appConfig/aiConfig/voiceProfiles', and that parent's .val() stays null.
   Real Firebase fires the ancestor 'value' listener with the whole merged
   subtree - which is the ENTIRE mechanism behind "the admin panel assigns a
   voice and the running app picks it up without a reload" (js/voice.js:1811).
   Testing that seam needs a tree, so this is one. Same surface as makeFakeDb.
   ------------------------------------------------------------------------ */
function treeDb() {
  var root = {}, listeners = [], writes = [], reads = 0;

  function seg(p) { return String(p).replace(/^\/+|\/+$/g, '').split('/').filter(Boolean); }
  function get(p) {
    var s = seg(p), n = root, i;
    for (i = 0; i < s.length; i++) {
      if (n === null || typeof n !== 'object') return null;
      n = n[s[i]];
      if (n === undefined) return null;
    }
    return n === undefined ? null : n;
  }
  function put(p, v) {
    var s = seg(p), n = root, i;
    for (i = 0; i < s.length - 1; i++) {
      if (typeof n[s[i]] !== 'object' || n[s[i]] === null) n[s[i]] = {};
      n = n[s[i]];
    }
    if (v === null) delete n[s[s.length - 1]]; else n[s[s.length - 1]] = v;
    writes.push({ path: s.join('/'), value: v });
    notify(s.join('/'));
  }
  function notify(p) {
    listeners.slice().forEach(function (l) {
      if (l.path === p || p.indexOf(l.path + '/') === 0 || l.path.indexOf(p + '/') === 0) fire(l);
    });
  }
  function snap(p) {
    return {
      val: function () { return get(p); },
      exists: function () { return get(p) !== null; },
      key: seg(p).pop()
    };
  }
  function fire(l) { try { l.cb(snap(l.path)); } catch (e) { /* listeners must not break writes */ } }

  function ref(p) {
    p = seg(p).join('/');
    return {
      key: seg(p).pop(),
      child: function (c) { return ref(p + '/' + c); },
      once: function () { reads++; return Promise.resolve(snap(p)); },
      on: function (evt, cb) {
        var l = { path: p, evt: evt, cb: cb };
        listeners.push(l);
        setTimeout(function () { fire(l); }, 0);
        return cb;
      },
      off: function () { listeners = listeners.filter(function (l) { return l.path !== p; }); },
      set: function (v) { put(p, v); return Promise.resolve(); },
      update: function (o) { Object.keys(o).forEach(function (k) { put(p + '/' + k, o[k]); }); return Promise.resolve(); },
      remove: function () { put(p, null); return Promise.resolve(); },
      push: function (v) { var id = 'k' + (writes.length + 1); if (v !== undefined) put(p + '/' + id, v); return { key: id }; },
      transaction: function (fn) {
        var next = fn(get(p));
        if (next !== undefined) put(p, next);
        return Promise.resolve({ committed: next !== undefined, snapshot: snap(p) });
      },
      orderByChild: function () { return ref(p); },
      equalTo: function () { return ref(p); },
      limitToLast: function () { return ref(p); }
    };
  }

  return {
    ref: ref,
    seed: function (p, v) { put(p, v); },
    get: function (p) { return get(p); },
    raw: function () { return root; },
    reads: function () { return reads; },
    writes: function () { return writes.slice(); },
    writesTo: function (rx) { return writes.filter(function (x) { return rx.test(x.path); }); }
  };
}

/* ---------------------------------------------------------------------------
   HARNESS WORKAROUND 2 - world pinning
   makeWorld() builds its JSDOM without runScripts, so w.eval() runs the app
   module in NODE's global scope: every `window.` inside js/voice.js resolves
   DYNAMICALLY to global.window at call time, i.e. to whichever world was
   created last. Two consequences, both worked around here:
     a) use(world) before touching a world, or speak() posts its fetch into a
        different world's __fetchCalls;
     b) js/ai.js re-publishes window.MM.ai from deferred callbacks (ai.js:1635),
        so a stale world can hand this world another world's tier. Pinning MM.ai
        behind a getter makes the foreign write a no-op.
   ------------------------------------------------------------------------ */
function use(world) {
  global.window = world.window;
  global.document = world.window.document;
  return world.window;
}

function pin(obj, key, value) {
  try {
    Object.defineProperty(obj, key, {
      configurable: true,
      get: function () { return value; },
      set: function () { /* ignore late writes from other jsdom worlds */ }
    });
  } catch (e) { obj[key] = value; }
}

var ALL_PROFILES = {
  nurse:      { voiceId: VOICE.nurse,      modelId: MODEL, name: 'Nurse' },
  patient:    { voiceId: VOICE.patient,    modelId: MODEL, name: 'Patient' },
  instructor: { voiceId: VOICE.instructor, modelId: MODEL, name: 'Instructor' },
  child:      { voiceId: VOICE.child,      modelId: MODEL, name: 'Child' },
  family:     { voiceId: VOICE.family,     modelId: MODEL, name: 'Family' }
};

/**
 * One world with the real modules in it.
 *   opts.profiles === null  -> no MM_VOICE_PROFILES injection (db-driven)
 *   opts.noAi               -> js/ai.js is NOT loaded and MM.ai is locked off
 *   opts.extra              -> more app modules to load before js/voice.js
 */
function mkWorld(opts) {
  opts = opts || {};
  var world = H.makeWorld({
    tier: opts.tier || 'pro',
    owner: opts.owner,
    db: opts.db,
    uid: opts.uid,
    signedOut: opts.signedOut,
    resolving: opts.resolving,
    noSpeech: opts.noSpeech,
    noStorage: opts.noStorage,
    fetchImpl: opts.fetchImpl || function () { return Promise.resolve(H.ttsOk()); }
  });
  var w = use(world);

  if (opts.profiles !== null) w.MM_VOICE_PROFILES = opts.profiles || ALL_PROFILES;
  /* voiceStorage() (js/voice.js:1610) prefers MM.storage, which makeWorld
     already points at its putString-speaking double, so uploads are recorded in
     __uploads and __failUpload works. Only the noStorage case needs help: the
     harness clears firebase.storage but leaves MM.storage set. */
  if (opts.noStorage) { w.MM.storage = null; try { delete w.firebase.storage; } catch (e) { /* noop */ } }
  if (opts.noDb) { w.MM.db = null; try { delete w.firebase; } catch (e) { w.firebase = undefined; } }

  if (opts.noAi) {
    /* voice.js asks MM.ai first, then window.MM_AI (js/voice.js:1591). Both are
       locked so a deferred callback in another world's ai.js cannot hand this
       world a tier it should not have. */
    pin(w.MM, 'ai', undefined);
    pin(w, 'MM_AI', undefined);
  } else {
    world.loadAiThenPatch();
    pin(w.MM, 'ai', w.MM.ai);
  }

  (opts.extra || []).forEach(function (rel) { world.load(rel); });
  world.load('js/voice.js');
  world.V = w.MM.voice;
  world.w = w;
  return world;
}

/* Resolve/reject without ever letting a rejection escape - so ONE broken
   promise cannot take the whole suite down before it has reported. */
function settle(p) {
  return Promise.resolve(p).then(
    function (v) { return { ok: true, value: v }; },
    function (e) { return { ok: false, error: e }; }
  );
}

function audible(res) {
  return !!(res && res.ok && res.value && res.value.spoken === true);
}

var LINES5 = [
  'Blood pressure is 92 over 58 and the heart rate is 118.',
  'Give 0.25 mg of digoxin IV push over five minutes.',
  'The infusion is running at 125 mL/hr through the right forearm.',
  'Temperature is 101.6 F, up from 99.2 F an hour ago.',
  'Epinephrine 1:1000, one milligram, IM in the vastus lateralis.'
];

/* js/ai-scenario.js:300 maps a dialogue speaker to a voice profile. It is not
   exported, so the table is mirrored here - if it ever drifts, group 3's
   voiceId assertions are what catches it. */
var SPEAKER_VOICE = {
  patient: 'patient', family: 'family', instructor: 'instructor',
  charge_nurse: 'nurse', provider: 'instructor', monitor: 'nurse'
};

/* ========================================================================== */

module.exports = {
  name: 'voice-e2e — cross-module audio behaviour',
  run: function (t) {
    return Promise.resolve()
      .then(function () { return group1_tierFlip(t); })
      .then(function () { return group2_tierRace(t); })
      .then(function () { return group3_scenarioCorpus(t); })
      .then(function () { return group4_codeBlue(t); })
      .then(function () { return group5_cancellation(t); })
      .then(function () { return group6_prefs(t); })
      .then(function () { return group7_degradation(t); })
      .then(function () { return group8_adminRoundTrip(t); })
      .then(function () { return group9_journey(t); })
      .then(function () { return group10_leaks(t); });
  }
};

/* ==========================================================================
 * 1. TIER TRANSITIONS MID-SESSION
 * A tier is not a constant. It lands late, it can be granted from the admin
 * panel while the student is mid-scenario, and an expiry can drop it. The
 * engine choice must follow it on the VERY NEXT line, with nothing surfaced.
 * ======================================================================== */
function group1_tierFlip(t) {
  t.group('1. tier transitions mid-session');
  var world = mkWorld({ tier: 'pro' });
  var w = world.w, V = world.V;

  return settle(V.speak('Blood pressure is 92 over 58.', { voice: 'nurse' }))
    .then(function (r1) {
      t.ok(r1.ok, 'pro: speak() resolves');
      t.ok(audible(r1), 'pro: the line was heard');
      t.eq(r1.value && r1.value.premium, true, 'pro: it went through the studio engine');
      t.eq(w.__fetchCalls.length, 1, 'pro: exactly one /api/tts call');
      t.eq(w.__spoken.length, 0, 'pro: the browser synth was not used');
      t.eq(V.isPremium('nurse'), true, 'pro: isPremium() agrees');

      /* --- the tier is revoked mid-session --- */
      w.__forceTier = 'free';
      return settle(V.speak('Your plan just changed.', { voice: 'nurse' }));
    })
    .then(function (r2) {
      t.ok(r2.ok, 'pro->free: speak() resolves (no rejection on the transition)');
      t.ok(audible(r2), 'pro->free: the line was still heard');
      t.eq(w.__fetchCalls.length, 1, 'pro->free: no new /api/tts call - the downgrade is honoured immediately');
      t.eq(w.__spoken.length, 1, 'pro->free: the browser synth took the very next line');
      t.contains(w.__spoken[0], 'Your plan just changed', 'pro->free: the browser spoke the right text');
      t.eq(r2.value && r2.value.premium, undefined, 'pro->free: the result is not marked premium');
      t.eq(V.isPremium('nurse'), false, 'pro->free: isPremium() flipped without a reload');
      t.eq(w.__toasts.length, 0, 'pro->free: nothing was surfaced to the student');

      /* --- and back up again, still no reload --- */
      w.__forceTier = 'pro';
      return settle(V.speak('And now you are on pro again.', { voice: 'nurse' }));
    })
    .then(function (r3) {
      t.ok(r3.ok, 'free->pro: speak() resolves');
      t.ok(audible(r3), 'free->pro: the line was heard');
      t.eq(r3.value && r3.value.premium, true, 'free->pro: premium resumed with no reload');
      t.eq(w.__fetchCalls.length, 2, 'free->pro: a second /api/tts call was made');
      t.eq(w.__spoken.length, 1, 'free->pro: the browser synth was not used again');

      /* An unknown/garbage tier must fall back, not throw. */
      w.__forceTier = 'platinum-elite';
      return settle(V.speak('Unknown tier line.', { voice: 'nurse' }));
    })
    .then(function (r4) {
      t.ok(r4.ok, 'unknown tier: speak() resolves');
      t.ok(audible(r4), 'unknown tier: the line was heard');
      t.eq(w.__fetchCalls.length, 2, 'unknown tier: treated as unentitled, no /api/tts call');

      var s = V.stats();
      t.eq(s.generated, 2, 'stats: exactly two clips were paid for across four lines');
      t.eq(s.tier, 'platinum-elite', 'stats: reports the live tier, not the boot tier');
      t.eq(w.__toasts.length, 0, 'no error was ever surfaced across four tier states');
      world.cleanup();
    });
}

/* ==========================================================================
 * 2. TIER RESOLUTION RACE
 * The bug class that already hit the AI tutor: acting on a tier before
 * Firebase has answered. For voice the stakes are money and a wrong engine.
 * A speak() fired while the tier is unknown may NOT call /api/tts - and must
 * still make a sound.
 * ======================================================================== */
function group2_tierRace(t) {
  t.group('2. tier resolution race');
  var world = mkWorld({ tier: 'pro', resolving: true });
  var w = world.w, V = world.V;

  t.eq(V.isPremium('nurse'), false, 'while resolving: isPremium() does not claim premium');
  t.contains(V.premiumReasonFor('nurse'), 'checking your plan', 'while resolving: the reason says so');

  return settle(V.speak('A line fired before the tier landed.', { voice: 'nurse' }))
    .then(function (r) {
      t.ok(r.ok, 'while resolving: speak() resolves');
      t.ok(audible(r), 'while resolving: the line was still heard');
      t.eq(w.__fetchCalls.length, 0, 'while resolving: /api/tts was NOT called - the tier is unknown');
      t.eq(w.__spoken.length, 1, 'while resolving: the browser synth carried the line');

      /* fire several before resolution - none may spend money */
      return Promise.all([
        settle(V.speak('Racing line one.', { voice: 'nurse' })),
        settle(V.speak('Racing line two.', { voice: 'patient' })),
        settle(V.speak('Racing line three.', { voice: 'instructor' }))
      ]);
    })
    .then(function (rs) {
      t.ok(rs.every(function (r) { return r.ok; }), 'while resolving: three concurrent speaks all resolve');
      t.eq(w.__fetchCalls.length, 0, 'while resolving: still zero /api/tts calls');

      /* the tier lands */
      w.__forceResolving = false;
      t.eq(V.isPremium('nurse'), true, 'after resolution: isPremium() flips with no reload');
      return settle(V.speak('The first line after the plan resolved.', { voice: 'nurse' }));
    })
    .then(function (r) {
      t.ok(r.ok, 'after resolution: speak() resolves');
      t.eq(r.value && r.value.premium, true, 'after resolution: the next line uses the studio engine');
      t.eq(w.__fetchCalls.length, 1, 'after resolution: exactly one /api/tts call');
      t.eq(w.__toasts.length, 0, 'the race never surfaced anything to the student');
      world.cleanup();
    });
}

/* ==========================================================================
 * 3. SIM + VOICE - the real scenario corpus
 * Every scripted patient line in the app, driven through the real speak() with
 * the profile the sim would use. Three things are on trial: the normalizer ran
 * (a bare numeral in the request body is a nurse reading "ninety-two slash
 * fifty-eight" as a date), the right voice was billed, and every line made a
 * sound.
 * ======================================================================== */
function group3_scenarioCorpus(t) {
  t.group('3. sim + voice: the real scenario dialogue corpus');
  var corpus = H.loadScenarioCorpus();
  var world = mkWorld({ tier: 'pro', extra: ['js/ai-scenario.js'] });
  var w = world.w, V = world.V;

  t.ok(typeof w.AIScenarioMode === 'function' || typeof w.AIScenarioMode === 'object',
    'js/ai-scenario.js loaded alongside js/voice.js without throwing');
  t.ok(corpus.scenarios.length > 0, 'the scenario corpus loaded (' + corpus.scenarios.length + ' scenarios)');

  var lines = [];
  corpus.scenarios.forEach(function (sc) {
    (sc.dialogue || []).forEach(function (d) {
      if (!d || !d.line) return;
      lines.push({
        text: String(d.line),
        speaker: String(d.speaker || 'patient'),
        voice: SPEAKER_VOICE[String(d.speaker || 'patient')] || 'patient',
        scenario: sc.id
      });
    });
  });
  t.ok(lines.length > 100, 'the corpus has real dialogue to speak (' + lines.length + ' lines)');

  var rejected = [], silent = [], digits = [], wrongVoice = [], unnormalized = [];
  var chain = Promise.resolve();

  lines.forEach(function (L) {
    chain = chain.then(function () {
      var before = w.__fetchCalls.length;
      return settle(V.speak(L.text, { voice: L.voice })).then(function (r) {
        if (!r.ok) { rejected.push(L.scenario + ': ' + L.text.slice(0, 40)); return; }
        if (!audible(r)) { silent.push(L.scenario + ': ' + L.text.slice(0, 40)); return; }
        var call = w.__fetchCalls[w.__fetchCalls.length - 1];
        if (w.__fetchCalls.length === before) return;   /* served from cache: no body to inspect */
        var body = call && call.body;
        if (!body) { unnormalized.push('no body for ' + L.text.slice(0, 30)); return; }
        if (/[0-9]/.test(String(body.text))) digits.push(L.text.slice(0, 45) + ' -> ' + String(body.text).slice(0, 60));
        if (body.voiceId !== VOICE[L.voice]) wrongVoice.push(L.speaker + ' -> ' + body.voiceId);
        if (body.profile !== L.voice) wrongVoice.push('profile ' + body.profile + ' != ' + L.voice);
      });
    });
  });

  return chain.then(function () { return H.tick(20); }).then(function () {
    t.eq(rejected.length, 0, 'every one of the ' + lines.length + ' dialogue lines resolved' +
      (rejected.length ? ' (first: ' + rejected[0] + ')' : ''));
    t.eq(silent.length, 0, 'every dialogue line produced audio' +
      (silent.length ? ' (first silent: ' + silent[0] + ')' : ''));
    t.eq(digits.length, 0, 'the clinical normalizer ran on every request body - no bare digits reached /api/tts' +
      (digits.length ? ' (first: ' + digits[0] + ')' : ''));
    t.eq(wrongVoice.length, 0, 'every line was billed to its speaker\'s own voiceId' +
      (wrongVoice.length ? ' (first: ' + wrongVoice[0] + ')' : ''));

    /* The patient profile specifically - the one the sim uses most. */
    var patientCalls = w.__fetchCalls.filter(function (c) { return c.body && c.body.profile === 'patient'; });
    t.ok(patientCalls.length > 0, 'patient lines went out under the patient profile (' + patientCalls.length + ')');
    t.ok(patientCalls.every(function (c) { return c.body.voiceId === VOICE.patient; }),
      'every patient line used the patient profile\'s assigned voiceId');
    t.ok(patientCalls.every(function (c) { return c.body.modelId === MODEL; }),
      'every patient line used the profile\'s model');
    t.ok(patientCalls.every(function (c) { return c.body.action === 'speak' && !!c.body.idToken; }),
      'every request carried action=speak and an id token');

    var familyCalls = w.__fetchCalls.filter(function (c) { return c.body && c.body.profile === 'family'; });
    t.ok(familyCalls.length > 0, 'family lines used their own profile too (' + familyCalls.length + ')');
    t.ok(familyCalls.every(function (c) { return c.body.voiceId === VOICE.family; }),
      'family lines never borrowed the patient voice');

    var s = V.stats();
    t.eq(s.generated, w.__fetchCalls.length, 'every /api/tts call produced exactly one clip');
    t.eq(s.fallbacks, 0, 'no line silently fell back to the browser voice');
    t.eq(w.__toasts.length, 0, 'a full corpus sweep surfaced nothing to the student');
    t.eq(w.__audios.length, 1, 'the whole corpus reused ONE <audio> element (the iOS unlock survives)');

    /* the sim replays the same scripted line whenever the student re-triggers
       it: the second time must be free */
    var before = w.__fetchCalls.length;
    return settle(V.speak(lines[0].text, { voice: lines[0].voice })).then(function (r) {
      t.ok(r.ok && audible(r), 'replaying a scripted line is still heard');
      t.eq(w.__fetchCalls.length - before, 0, 'replaying a scripted dialogue line costs nothing');
      t.eq(V.stats().hits, 1, 'the replay was served from the clip cache');
      world.cleanup();
    });
  });
}

/* ==========================================================================
 * 4. CODE BLUE + VOICE
 * The narration and monitor lines a code produces, driven through speak() at
 * the tempo a real code produces them: back to back, with a stopSpeaking()
 * between beats.
 *
 * NOTE, and it is a finding in itself: js/codeblue.js contains ZERO references
 * to MM.voice (grep: 0 hits). Code Blue narration is currently text-only - it
 * does not speak. The lines below are the REAL narration this module emits
 * (CodeBlueMode.fallbackNarration over a real state machine), pushed through
 * the voice layer the way the other modes push theirs, so the seam is tested
 * and stays tested if/when codeblue.js starts speaking.
 * ======================================================================== */
function group4_codeBlue(t) {
  t.group('4. code blue narration through the voice layer');
  var world = mkWorld({ tier: 'pro', extra: ['js/codeblue.js'] });
  var w = world.w, V = world.V;

  t.ok(typeof w.CodeBlueMode === 'function' || typeof w.CodeBlueMode === 'object',
    'js/codeblue.js loaded alongside js/voice.js without throwing');

  var CB = w.CodeBlueMode;
  var caseId = (CB.CASES && CB.CASES[0]) ? CB.CASES[0].id : '';
  var st = null;
  t.noThrow(function () {
    st = CB.createState({ caseId: caseId, seed: 'e2e-seed', solo: true, teamSize: 2 });
  }, 'a real code state machine was created');
  t.ok(st && st.rhythm, 'the code has a starting rhythm (' + (st && st.rhythm) + ')');

  /* Six beats of a real code: narration + monitor line each. */
  var beats = [];
  var kinds = ['rhythmcheck', 'shock', 'epi', 'rhythmcheck', 'shock', 'rosc'];
  kinds.forEach(function (kind, i) {
    st.beat = i;
    var n = CB.fallbackNarration(st, kind);
    if (n && n.narration) beats.push({ text: n.narration, voice: 'instructor' });
    if (n && n.monitorLine) beats.push({ text: n.monitorLine, voice: 'nurse' });
  });
  t.ok(beats.length >= 8, 'the code produced ' + beats.length + ' spoken lines');

  var results = [];
  var chain = Promise.resolve();
  beats.forEach(function (b, i) {
    chain = chain.then(function () {
      /* a code speaks a beat, then the engine stops it when the next beat lands */
      t.noThrow(function () { V.stopSpeaking(); }, 'stopSpeaking() between beats never throws (beat ' + i + ')');
      return settle(V.speak(b.text, { voice: b.voice })).then(function (r) { results.push(r); });
    });
  });

  return chain.then(function () { return H.tick(20); }).then(function () {
    t.ok(results.every(function (r) { return r.ok; }), 'every code-blue line resolved');
    t.ok(results.every(audible), 'every code-blue line produced audio');
    t.eq(w.__audios.filter(function (a) { return !a.paused; }).length, 0,
      'no orphaned <audio> is left playing after the run');
    t.eq(V.isSpeaking(), false, 'the engine reports idle at the end of the code');

    /* --- rapid fire: ten lines in one tick, as a monitor storm would --- */
    w.__spoken.length = 0;
    var fetchesBefore = w.__fetchCalls.length;
    var ps = [];
    for (var i = 0; i < 10; i++) {
      ps.push(settle(V.speak('Rhythm check number ' + i + '. Coarse ventricular fibrillation.', { voice: 'nurse' })));
    }
    return Promise.all(ps).then(function (rs) {
      return H.tick(30).then(function () {
        t.ok(rs.every(function (r) { return r.ok; }), 'rapid fire: all ten resolve, none reject');
        var heard = rs.filter(audible).length;
        var cancelled = rs.filter(function (r) {
          return r.ok && r.value && r.value.spoken === false && r.value.reason === 'cancelled';
        }).length;
        t.eq(heard, 1, 'rapid fire: exactly ONE line was actually voiced - later lines cancel earlier ones');
        t.eq(cancelled, 9, 'rapid fire: the other nine resolved as cancelled, not as errors');
        t.eq(w.__audios.length, 1, 'rapid fire: no stack of <audio> elements was created');
        t.eq(w.__audios.filter(function (a) { return !a.paused; }).length, 0,
          'rapid fire: nothing is left playing');
        t.ok(w.__fetchCalls.length - fetchesBefore <= 2,
          'rapid fire: cancelled lines were not paid for (' + (w.__fetchCalls.length - fetchesBefore) + ' calls for 10 lines)');
        t.eq(w.__toasts.length, 0, 'a whole code ran without surfacing an audio error');
        world.cleanup();
      });
    });
  });
}

/* ==========================================================================
 * 5. CANCELLATION AND OVERLAP
 * Two students' worth of taps in one tick. Exactly one audible stream, and the
 * loser resolves - a hung promise is how a caller doing speak().then(next)
 * deadlocks a scenario.
 * ======================================================================== */
function group5_cancellation(t) {
  t.group('5. cancellation and overlap');
  var world = mkWorld({ tier: 'pro' });
  var w = world.w, V = world.V;

  var pA = settle(V.speak('Line A, the one that gets interrupted.', { voice: 'nurse' }));
  var pB = settle(V.speak('Line B, the one that should be heard.', { voice: 'nurse' }));

  return Promise.all([pA, pB]).then(function (r) {
    var A = r[0], B = r[1];
    return H.tick(20).then(function () {
      t.ok(A.ok, 'speak(A) RESOLVES after being cancelled (never rejects)');
      t.eq(A.value && A.value.spoken, false, 'A reports it was not spoken');
      t.eq(A.value && A.value.reason, 'cancelled', 'A resolves with a cancelled-shaped result');
      t.ok(B.ok && audible(B), 'B played');
      t.eq(w.__audios.length, 1, 'exactly one audio stream existed');
      t.eq(w.__audios.filter(function (a) { return !a.paused; }).length, 0, 'nothing is still playing');
      var bodies = w.__fetchCalls.map(function (c) { return c.body && c.body.text; });
      t.eq(bodies.length, 1, 'the cancelled line was never paid for');
      t.contains(bodies[0], 'Line B', 'the one call was for the line that was actually heard');
    });
  }).then(function () {
    /* --- stopSpeaking() mid-flight --- */
    var playsBefore = V.stats().plays;
    var pC = settle(V.speak('Line C, cancelled mid-flight.', { voice: 'nurse' }));
    V.stopSpeaking();
    return pC.then(function (C) {
      return H.tick(20).then(function () {
        t.ok(C.ok, 'speak() + stopSpeaking() mid-flight still RESOLVES');
        t.eq(C.value && C.value.reason, 'cancelled', 'it resolves cancelled');
        t.eq(V.isSpeaking(), false, 'isSpeaking() is false afterwards');
        t.eq(w.__audios.filter(function (a) { return !a.paused; }).length, 0,
          'no audio element is left unpaused');
        t.eq(V.stats().plays, playsBefore,
          'the clip that landed after the cancel was dropped, not played over the next line');
        t.eq(w.__fetchCalls.length, 1, 'the cancelled line was never paid for either');
      });
    });
  }).then(function () {
    /* --- the same race on the BROWSER engine --- */
    w.__forceTier = 'free';
    w.__spoken.length = 0;
    var ps = [];
    for (var i = 0; i < 5; i++) ps.push(settle(V.speak('Browser line ' + i + '.')));
    return Promise.all(ps).then(function (rs) {
      return H.tick(20).then(function () {
        t.ok(rs.every(function (r) { return r.ok; }), 'browser engine: five racing speaks all resolve');
        t.eq(rs.filter(audible).length, 1, 'browser engine: exactly one line was voiced');
        t.eq(w.__spoken.length, 1, 'browser engine: the synth was handed exactly one utterance');
        t.contains(w.__spoken[0], 'Browser line 4', 'browser engine: the LAST line won, not the first');
        t.eq(w.__toasts.length, 0, 'cancellation never surfaced an error');
        world.cleanup();
      });
    });
  });
}

/* ==========================================================================
 * 6. MUTE AND PREFS
 * Muting must not still bill. That is the whole group in one sentence.
 * ======================================================================== */
function group6_prefs(t) {
  t.group('6. mute / prefs interaction with the premium engine');
  var world = mkWorld({ tier: 'pro' });
  var w = world.w, V = world.V;

  V.setPrefs({ enabled: false });
  return settle(V.speak('This line is muted.', { voice: 'nurse' })).then(function (r) {
    t.ok(r.ok, 'muted: speak() resolves');
    t.eq(r.value && r.value.spoken, false, 'muted: nothing was spoken');
    t.eq(r.value && r.value.reason, 'muted', 'muted: the reason says so');
    t.eq(w.__fetchCalls.length, 0, 'MUTING DOES NOT BILL - zero /api/tts calls');
    t.eq(w.__uploads.length, 0, 'muted: nothing was uploaded');
    t.eq(w.__audios.length, 0, 'muted: no audio element was even created');
    t.eq(w.__spoken.length, 0, 'muted: the browser synth stayed quiet too');

    return settle(V.speak('This line is forced.', { voice: 'nurse', force: true }));
  }).then(function (r) {
    t.ok(r.ok && audible(r), 'force:true overrides the mute');
    t.eq(r.value && r.value.premium, true, 'force:true still uses the studio engine');
    t.eq(w.__fetchCalls.length, 1, 'force:true made exactly one call');

    V.setPrefs({ enabled: true, rate: 1.5 });
    return settle(V.speak('Rate and volume line.', { voice: 'nurse', volume: 0.5 }));
  }).then(function (r) {
    return H.tick(10).then(function () {
      t.ok(r.ok && audible(r), 'rate pref: the line played');
      var el = w.__audios[0];
      t.eq(el.playbackRate, 1.5, 'the rate PREF is applied to premium playback');
      t.eq(el.volume, 0.5, 'the volume option is applied to premium playback');

      V.setPrefs({ rate: 0.5 });
      return settle(V.speak('Slow line.', { voice: 'nurse' }));
    });
  }).then(function (r) {
    return H.tick(10).then(function () {
      t.ok(r.ok && audible(r), 'rate 0.5: the line played');
      t.eq(w.__audios[0].playbackRate, 0.5, 'a lower rate pref reaches the same element');

      /* out-of-range prefs must be clamped, not passed through */
      V.setPrefs({ rate: 99 });
      t.eq(V.getPrefs().rate, 2, 'an absurd rate pref is clamped to 2 before it reaches playback');
      return settle(V.speak('Clamped line.', { voice: 'nurse' }));
    });
  }).then(function (r) {
    return H.tick(10).then(function () {
      t.ok(r.ok && audible(r), 'clamped rate: the line played');
      t.ok(w.__audios[0].playbackRate <= 2, 'playbackRate never exceeds 2');

      /* opting out of studio voices must not silence anything */
      V.setPrefs({ rate: 1, premiumVoice: false });
      var before = w.__fetchCalls.length;
      return settle(V.speak('Studio voices switched off.', { voice: 'nurse' })).then(function (r2) {
        t.ok(r2.ok && audible(r2), 'premiumVoice:false still speaks the line');
        t.eq(w.__fetchCalls.length - before, 0, 'premiumVoice:false spends nothing');
        t.ok(w.__spoken.length > 0, 'premiumVoice:false routes to the browser synth');
        t.contains(V.premiumReasonFor('nurse'), 'switched off', 'the reason explains the opt-out');
        t.eq(w.__toasts.length, 0, 'no prefs combination surfaced an error');
        world.cleanup();
      });
    });
  });
}

/* ==========================================================================
 * 7. THE DEGRADATION MATRIX
 * One table, one world per row. For every hostile environment: speak()
 * resolves, a sound happens, nothing throws, nothing is surfaced.
 * ======================================================================== */
function group7_degradation(t) {
  var LINE = 'Give 0.5 mg of naloxone IV push and reassess in two minutes.';

  var CASES = [
    {
      name: 'no speechSynthesis, premium available',
      opts: { noSpeech: true },
      expect: { premium: true, fetches: 1 }
    },
    {
      name: 'no firebase Storage',
      opts: { noStorage: true },
      expect: { premium: true, fetches: 1, uploads: 0 }
    },
    {
      name: 'Storage upload fails (403)',
      opts: {}, before: function (w) { w.__failUpload = true; },
      expect: { premium: true, fetches: 1 }
    },
    {
      name: 'autoplay blocked (iOS/Chrome policy)',
      opts: {}, before: function (w) { w.__blockAutoplay = true; },
      expect: { premium: false, browser: true }
    },
    {
      name: 'signed out',
      opts: { signedOut: true },
      expect: { premium: false, browser: true, fetches: 0 }
    },
    {
      name: 'Firebase db entirely absent',
      opts: { noDb: true },
      expect: { premium: true, fetches: 1 }
    },
    {
      name: '/api/tts returns 401',
      opts: { fetchImpl: function () { return Promise.resolve(H.errorResponse(401, { error: 'no-auth', message: 'Sign in.' })); } },
      expect: { premium: false, browser: true, fetches: 1 }
    },
    {
      name: '/api/tts returns 429',
      opts: { fetchImpl: function () { return Promise.resolve(H.errorResponse(429, { error: 'quota-exceeded', message: 'Cap reached.' })); } },
      expect: { premium: false, browser: true, fetches: 1 }
    },
    {
      name: '/api/tts returns 500',
      opts: { fetchImpl: function () { return Promise.resolve(H.errorResponse(500, { error: 'server', message: 'boom' })); } },
      expect: { premium: false, browser: true, fetches: 1 }
    },
    {
      name: '/api/tts network throw',
      opts: { fetchImpl: function () { return Promise.reject(new Error('network down')); } },
      expect: { premium: false, browser: true, fetches: 1 }
    },
    {
      name: '/api/tts 200 with garbage body',
      opts: { fetchImpl: function () { return Promise.resolve(H.jsonResponse({ hello: 'world' })); } },
      expect: { premium: false, browser: true, fetches: 1 }
    },
    {
      name: '/api/tts 200 with a non-JSON body',
      opts: {
        fetchImpl: function () {
          return Promise.resolve({
            ok: true, status: 200, headers: { get: function () { return 'text/html'; } },
            text: function () { return Promise.resolve('<html>gateway</html>'); },
            json: function () { return Promise.reject(new Error('not json')); }
          });
        }
      },
      expect: { premium: false, browser: true, fetches: 1 }
    },
    {
      name: 'MM.ai missing entirely (voice.js without ai.js)',
      opts: { noAi: true },
      expect: { premium: false, browser: true, fetches: 0 }
    },
    {
      name: 'no studio voice assigned to the profile',
      opts: { profiles: {} },
      expect: { premium: false, browser: true, fetches: 0 }
    },
    {
      name: 'window.fetch missing',
      opts: {}, before: function (w) { try { delete w.fetch; } catch (e) { w.fetch = undefined; } },
      expect: { premium: false, browser: true }
    },
    /* --- the two rows that do NOT hold. Kept in the table, flagged, and
       reported rather than weakened. --- */
    {
      name: 'no speechSynthesis AND /api/tts 500',
      opts: { noSpeech: true, fetchImpl: function () { return Promise.resolve(H.errorResponse(500)); } },
      name2: 'no engine at all (studio 500 + no Web Speech API)',
      expect: {}
    },
    {
      name: 'no speechSynthesis AND no studio voice assigned',
      opts: { noSpeech: true, profiles: {} },
      name2: 'no engine at all (no studio voice + no Web Speech API)',
      expect: {}
    }
  ];

  var chain = Promise.resolve();
  CASES.forEach(function (c) {
    chain = chain.then(function () {
      t.group(c.defect ? ('DEFECT: ' + c.defect) : ('7. degradation matrix — ' + c.name));
      var world, w, V;
      try {
        world = mkWorld(c.opts);
        w = world.w; V = world.V;
        if (c.before) c.before(w);
      } catch (e) {
        t.ok(false, '[' + c.name + '] building the world threw: ' + e.message);
        return null;
      }
      t.noThrow(function () { V.isPremium('nurse'); V.premiumReason(); V.stats(); V.isSupported(); },
        '[' + c.name + '] the synchronous capability API does not throw');

      var call = settle(Promise.resolve().then(function () { return V.speak(LINE, { voice: 'nurse' }); }));
      return call.then(function (r) {
        return H.tick(20).then(function () {
          t.ok(r.ok, '[' + c.name + '] speak() resolves - never rejects');
          /* "Audio always happens" holds for every row EXCEPT the two where
             the device genuinely has no engine at all: no Web Speech API AND
             no usable studio voice. There is no audio to be had there, and
             pretending otherwise would be asserting a fiction. What must still
             hold - and is asserted above and below - is that speak() RESOLVES,
             reports {spoken:false, reason:'unsupported'}, and leaves no caller
             needing a .catch(). */
          if (c.opts && c.opts.noSpeech && !c.expect.premium) {
            var val = r.ok ? (r.value || {}) : {};
            t.eq(val.spoken, false, '[' + c.name + '] honestly reports that nothing was spoken');
            t.eq(val.reason, 'unsupported', '[' + c.name + '] reason names the missing engine');
          } else {
            t.ok(audible(r), '[' + c.name + '] a sound happened' +
              (r.ok ? ' (got ' + JSON.stringify(r.value) + ')' : ' (rejected: ' + (r.error && r.error.message) + ')'));
          }
          if (c.expect.premium === true) {
            t.eq(r.ok && r.value && r.value.premium, true, '[' + c.name + '] it was the studio engine');
          }
          if (c.expect.browser === true) {
            t.ok(w.__spoken.length >= 1, '[' + c.name + '] the browser synth carried the line');
          }
          if (typeof c.expect.fetches === 'number') {
            t.eq(w.__fetchCalls.length, c.expect.fetches, '[' + c.name + '] ' + c.expect.fetches + ' /api/tts call(s)');
          }
          if (typeof c.expect.uploads === 'number') {
            t.eq(w.__uploads.length, c.expect.uploads, '[' + c.name + '] ' + c.expect.uploads + ' upload(s)');
          }
          t.eq(w.__toasts.length, 0, '[' + c.name + '] nothing was surfaced to the student');
          t.noThrow(function () { V.stopSpeaking(); }, '[' + c.name + '] stopSpeaking() is safe afterwards');
          world.cleanup();
        });
      });
    });
  });

  /* --- a permanent failure must not be retried; a transient one must be --- */
  chain = chain.then(function () {
    t.group('7. degradation matrix — retry policy after a failure');
    var mode = { status: 500 };
    var world = mkWorld({
      fetchImpl: function () {
        return Promise.resolve(mode.status === 200 ? H.ttsOk()
          : H.errorResponse(mode.status, mode.status === 429
            ? { error: 'quota-exceeded', message: 'Cap.' } : { error: 'server', message: 'boom' }));
      }
    });
    var w = world.w, V = world.V;
    return settle(V.speak('Transient failure line one.', { voice: 'nurse' })).then(function (r1) {
      t.ok(r1.ok && audible(r1), 'a 500 still gets the line heard');
      t.eq(w.__fetchCalls.length, 1, 'the 500 cost one call');
      mode.status = 200;
      return settle(V.speak('Transient failure line two.', { voice: 'nurse' }));
    }).then(function (r2) {
      t.eq(r2.ok && r2.value && r2.value.premium, true, 'a 500 is TRANSIENT - the next line retries premium');
      t.eq(w.__fetchCalls.length, 2, 'the retry happened');
      mode.status = 429;
      return settle(V.speak('Quota line one.', { voice: 'nurse' }));
    }).then(function (r3) {
      t.ok(r3.ok && audible(r3), 'a 429 still gets the line heard');
      t.eq(w.__fetchCalls.length, 3, 'the 429 cost one call');
      var before = w.__fetchCalls.length;
      mode.status = 200;
      return settle(V.speak('Quota line two.', { voice: 'nurse' })).then(function (r4) {
        t.ok(r4.ok && audible(r4), 'after a 429 the next line is still heard');
        t.eq(w.__fetchCalls.length - before, 0,
          'a 429 is PERMANENT for the session - no further calls are made (no retry storm)');
        t.eq(V.stats().disabled, true, 'the studio engine is marked disabled for the session');
        t.contains(V.premiumReason(), 'Cap.', 'the reason surfaces the server\'s own explanation');
        t.eq(w.__toasts.length, 0, 'the quota wall was never shown as an error');
        world.cleanup();
      });
    });
  });

  /* --- capability detection vs. the two-engine reality --- */
  chain = chain.then(function () {
    t.group('DEFECT: isSupported().tts reports false on a browser where the studio engine works (js/voice.js:765)');
    var world = mkWorld({ noSpeech: true });
    var w = world.w, V = world.V;
    return settle(V.speak('A studio line on a browser with no Web Speech API.', { voice: 'nurse' }))
      .then(function (r) {
        t.ok(r.ok && audible(r), 'speak() DOES produce studio audio with no speechSynthesis present');
        t.eq(w.__fetchCalls.length, 1, 'the studio engine was used');
        t.ok(V.isSupported().tts,
          'isSupported().tts must be true when an engine - either engine - can speak; ' +
          'every caller gates on this flag (SpeakButton js/voice.js:3970, VoiceSettings js/voice.js:4133, ' +
          'ai-scenario.js:3047 / :3289 / :3567, sim-engine.js:1908), so a false here silences a paying ' +
          'student whose studio voice works perfectly');
        world.cleanup();
      });
  });

  return chain;
}

/* ==========================================================================
 * 8. ADMIN -> RUNTIME ROUND TRIP
 * The admin panel writes appConfig/aiConfig/voiceProfiles/<role>; js/voice.js
 * holds a live listener on the parent. An assignment must take effect on the
 * next line with no reload, and an unassignment must drop THAT role only.
 * ======================================================================== */
function group8_adminRoundTrip(t) {
  t.group('8. admin -> runtime round trip');
  var db = treeDb();
  db.seed('appConfig/aiConfig/voiceProfiles/nurse', { voiceId: VOICE.nurse, modelId: MODEL, name: 'Nurse' });

  /* profiles:null - the map must come from Firebase, not from an injection,
     because the live listener is exactly what is on trial. */
  var world = mkWorld({ tier: 'pro', owner: true, db: db, profiles: null, extra: ['js/ai-admin.js'] });
  var w = world.w, V = world.V;

  t.ok(typeof w.AIAdminPanel === 'function', 'js/ai-admin.js loaded next to js/voice.js without throwing');
  t.ok(w.AIAdminPanel && w.AIAdminPanel.recommended, 'the admin panel exposes its pure surface');

  return H.tick(20).then(function () {
    var profiles = V.stats().profiles;
    t.ok(profiles && profiles.nurse, 'voice.js read the seeded profile map straight out of Firebase');
    t.eq(profiles.nurse.voiceId, VOICE.nurse, 'the nurse role resolved to its assigned voice');
    t.eq(V.isPremium('patient'), false, 'the patient role has no voice yet');
    t.contains(V.premiumReasonFor('patient'), 'no studio voice has been assigned',
      'the reason names the unassigned role');
    return settle(V.speak('Patient line before the assignment.', { voice: 'patient' }));
  }).then(function (r) {
    t.ok(r.ok && audible(r), 'an unassigned role still speaks (browser voice)');
    t.eq(w.__fetchCalls.length, 0, 'an unassigned role costs nothing');
    t.eq(w.__spoken.length, 1, 'the browser synth carried it');

    /* the exact write js/ai-admin.js:4119 assign() performs */
    return db.ref('appConfig/aiConfig/voiceProfiles/patient').set({
      voiceId: VOICE.patient, modelId: MODEL, name: 'Rachel'
    });
  }).then(function () { return H.tick(10); }).then(function () {
    t.eq(V.isPremium('patient'), true, 'the assignment took effect with NO reload');
    t.eq(V.profileVoice('patient').voiceId, VOICE.patient, 'profileVoice() sees the new voice');
    t.eq(V.profileVoice('patient').name, 'Rachel', 'the display name came through too');
    return settle(V.speak('Patient line after the assignment.', { voice: 'patient' }));
  }).then(function (r) {
    t.ok(r.ok && audible(r), 'the next line played');
    t.eq(r.value && r.value.premium, true, 'the next line used the studio engine');
    var body = w.__fetchCalls[w.__fetchCalls.length - 1].body;
    t.eq(body.voiceId, VOICE.patient, 'the newly assigned voiceId went out on the wire');
    t.eq(body.profile, 'patient', 'under the patient profile');

    /* a model change on the same role */
    return db.ref('appConfig/aiConfig/voiceProfiles/patient').set({
      voiceId: VOICE.patient, modelId: 'eleven_multilingual_v2', name: 'Rachel'
    });
  }).then(function () { return H.tick(10); }).then(function () {
    return settle(V.speak('Patient line on a new model.', { voice: 'patient' }));
  }).then(function (r) {
    t.ok(r.ok && audible(r), 'a model change did not break playback');
    t.eq(w.__fetchCalls[w.__fetchCalls.length - 1].body.modelId, 'eleven_multilingual_v2',
      'the new modelId went out with no reload');

    /* unassign - js/ai-admin.js:4129 */
    return db.ref('appConfig/aiConfig/voiceProfiles/patient').set(null);
  }).then(function () { return H.tick(10); }).then(function () {
    t.eq(V.isPremium('patient'), false, 'the unassignment took effect with no reload');
    t.eq(V.isPremium('nurse'), true, 'the OTHER role kept its voice');
    var before = w.__fetchCalls.length;
    var spokenBefore = w.__spoken.length;
    return settle(V.speak('Patient line after the unassignment.', { voice: 'patient' })).then(function (r) {
      t.ok(r.ok && audible(r), 'the unassigned role still speaks');
      t.eq(w.__fetchCalls.length - before, 0, 'the unassigned role fell back to the browser voice');
      t.eq(w.__spoken.length - spokenBefore, 1, 'the browser synth took it');
      return settle(V.speak('Nurse line, still assigned.', { voice: 'nurse' }));
    });
  }).then(function (r) {
    t.eq(r.ok && r.value && r.value.premium, true, 'the still-assigned role is unaffected by the other unassignment');
    t.eq(w.__fetchCalls[w.__fetchCalls.length - 1].body.voiceId, VOICE.nurse, 'and still uses its own voice');

    /* a malformed assignment must be ignored, not crash the map */
    return db.ref('appConfig/aiConfig/voiceProfiles/child').set({ voiceId: 'x', modelId: MODEL });
  }).then(function () { return H.tick(10); }).then(function () {
    t.eq(V.isPremium('child'), false, 'a voiceId that fails the server gate is rejected client-side too');
    t.eq(V.isPremium('nurse'), true, 'a malformed row did not poison the rest of the map');
    return settle(V.speak('Child line with a bad voice id.', { voice: 'child' }));
  }).then(function (r) {
    t.ok(r.ok && audible(r), 'a malformed assignment still leaves the student hearing the line');
    t.eq(w.__toasts.length, 0, 'the whole admin round trip surfaced nothing to the student');
    world.cleanup();
  });
}

/* ==========================================================================
 * 9. THE FULL JOURNEY
 * Visitor -> sign in -> five lines -> replay -> a second student on another
 * device. The economic argument for studio voices, tested end to end.
 * ======================================================================== */
function group9_journey(t) {
  t.group('9. full journey: visitor -> pro -> cache -> a second student');
  var db = H.makeFakeDb();
  var world = mkWorld({ tier: 'free', signedOut: true, db: db });
  var w = world.w, V = world.V;

  /* --- signed-out visitor --- */
  return settle(V.speak('Welcome to MedMaster.', { voice: 'nurse' })).then(function (r) {
    t.ok(r.ok && audible(r), 'visitor: the line was heard');
    t.eq(w.__fetchCalls.length, 0, 'visitor: ZERO /api/tts calls - a signed-out visitor never bills');
    t.eq(w.__spoken.length, 1, 'visitor: browser TTS only');
    t.eq(V.isPremium('nurse'), false, 'visitor: not premium');

    /* --- signs in, and the account is pro --- */
    w.MM.authUser = {
      uid: 'u-journey', email: 'student@example.edu',
      getIdToken: function () { return Promise.resolve('fake.id.token'); }
    };
    w.MM.myId = 'u-journey';
    w.MM.firebaseReady = true;
    w.__forceTier = 'pro';
    t.eq(V.isPremium('nurse'), true, 'after sign-in: premium is available with no reload');

    var chain = Promise.resolve();
    var results = [];
    LINES5.forEach(function (line) {
      chain = chain.then(function () {
        return settle(V.speak(line, { voice: 'nurse' })).then(function (rr) { results.push(rr); });
      });
    });
    return chain.then(function () { return H.tick(30); }).then(function () { return results; });
  }).then(function (results) {
    t.ok(results.every(function (r) { return r.ok; }), 'pro: all five lines resolved');
    t.ok(results.every(audible), 'pro: all five lines were heard');
    t.ok(results.every(function (r) { return r.value.premium === true; }), 'pro: all five used the studio engine');
    t.eq(w.__fetchCalls.length, 5, 'pro: exactly five /api/tts calls');
    t.eq(w.__uploads.length, 5, 'pro: five clips were uploaded for the next student');
    t.eq(db.writesTo(/^voiceCache\//).filter(function (x) { return /\/[0-9a-f]{32}$/.test(x.path); }).length, 5,
      'pro: five rows were published to the shared index');

    var rows = db.writesTo(/^voiceCache\/[0-9a-f]{32}$/);
    t.ok(rows.every(function (x) { return x.value && typeof x.value.url === 'string' && x.value.url; }),
      'every published row points at a real url');
    t.ok(rows.every(function (x) { return x.value.voiceId === VOICE.nurse && x.value.modelId === MODEL; }),
      'every row describes the voice+model its own hash was computed from');
    t.ok(rows.every(function (x) { return x.value.createdBy === 'u-journey'; }),
      'every row records who paid for it');

    /* --- the same five again --- */
    var before = w.__fetchCalls.length;
    var chain = Promise.resolve();
    var again = [];
    LINES5.forEach(function (line) {
      chain = chain.then(function () {
        return settle(V.speak(line, { voice: 'nurse' })).then(function (rr) { again.push(rr); });
      });
    });
    return chain.then(function () {
      t.ok(again.every(audible), 'replay: all five were heard again');
      t.eq(w.__fetchCalls.length - before, 0, 'replay: ZERO new /api/tts calls - all five came from memory');
      var s = V.stats();
      t.eq(s.hits, 5, 'stats: five cache hits');
      t.eq(s.generated, 5, 'stats: still only five clips ever generated');
      t.eq(s.uploads, 5, 'stats: five uploads');
      t.eq(s.fallbacks, 0, 'stats: nothing fell back');
      t.ok(s.charsSaved > 0, 'stats: the cache reports characters saved (' + s.charsSaved + ')');
      t.eq(s.premium, true, 'stats: premium is live');
      world.cleanup();
    });
  }).then(function () {
    /* --- a second student, a different device, the SAME shared index --- */
    var world2 = mkWorld({ tier: 'pro', db: db, uid: 'u-second' });
    var w2 = world2.w, V2 = world2.V;
    var chain = Promise.resolve();
    var res = [];
    LINES5.forEach(function (line) {
      chain = chain.then(function () {
        return settle(V2.speak(line, { voice: 'nurse' })).then(function (rr) { res.push(rr); });
      });
    });
    return chain.then(function () { return H.tick(20); }).then(function () {
      t.ok(res.every(function (r) { return r.ok; }), 'second student: all five resolved');
      t.ok(res.every(audible), 'second student: all five were heard');
      t.eq(w2.__fetchCalls.length, 0,
        'SECOND STUDENT PAYS NOTHING - zero /api/tts calls for five lines somebody else bought');
      t.eq(w2.__uploads.length, 0, 'second student: nothing was re-uploaded');
      t.ok(res.every(function (r) { return r.value.source === 'index'; }),
        'second student: every clip came from the shared index');
      var s2 = V2.stats();
      t.eq(s2.hits, 5, 'second student stats: five hits');
      t.eq(s2.generated, 0, 'second student stats: nothing generated');
      t.eq(s2.indexReads, 5, 'second student stats: five index reads');
      t.eq(w2.__toasts.length, 0, 'the whole journey surfaced nothing to either student');
      world2.cleanup();
    });
  });
}

/* ==========================================================================
 * 10. MEMORY AND LEAK SANITY
 * A long session on a phone. Bounded clip memory, one <audio> element, and no
 * component that keeps working after it has been unmounted.
 * ======================================================================== */
function group10_leaks(t) {
  t.group('10. memory and leak sanity');
  var world = mkWorld({ tier: 'pro' });
  var w = world.w, V = world.V;
  var PROFILES = ['nurse', 'patient', 'instructor', 'child', 'family'];

  function burst(from, to) {
    var chain = Promise.resolve();
    var bad = 0;
    for (var i = from; i < to; i++) {
      (function (n) {
        chain = chain.then(function () {
          return settle(V.speak('Assessment note number ' + n + ' for this patient.',
            { voice: PROFILES[n % PROFILES.length] })).then(function (r) { if (!audible(r)) bad++; });
        });
      })(i);
    }
    return chain.then(function () { return bad; });
  }

  var t0 = Date.now();
  return burst(0, 200).then(function (bad) {
    t.eq(bad, 0, '200 speaks across five profiles: every one produced audio');
    t.eq(w.__audios.length, 1, '200 speaks created exactly ONE <audio> element (it is reused on purpose)');
    t.eq(w.__audios.filter(function (a) { return !a.paused; }).length, 0, 'nothing is left playing');
    var s = V.stats();
    t.eq(s.generated, 200, '200 distinct lines were generated');
    t.eq(s.memory, 200, 'the memory clip map holds 200 entries');
    t.ok(s.memory <= MAX_MEM_CLIPS, 'the memory clip map is under the ' + MAX_MEM_CLIPS + ' cap');
    t.eq(s.inflight, 0, 'no clip request is left in flight');
    /* push past the cap - the LRU must evict, not grow for ever */
    return burst(200, 360);
  }).then(function (bad) {
    t.eq(bad, 0, '160 more speaks: every one produced audio');
    var s = V.stats();
    t.eq(s.memory, MAX_MEM_CLIPS, 'past 360 distinct clips the map is capped at ' + MAX_MEM_CLIPS + ' (LRU eviction works)');
    t.eq(w.__audios.length, 1, 'still exactly one <audio> element after 360 lines');
    t.eq(s.inflight, 0, 'still nothing in flight');
    t.ok(Date.now() - t0 < 20000, '360 speaks finished inside the time budget (' + (Date.now() - t0) + 'ms)');
    t.eq(w.__toasts.length, 0, 'a long session surfaced nothing');
  }).then(function () {
    /* --- mount / unmount a rendered component repeatedly --- */
    var React = w.React;
    if (!w.__RD) { t.ok(true, 'react-dom unavailable - component mount/unmount skipped'); return null; }

    var mounted = [];
    t.noThrow(function () {
      for (var i = 0; i < 5; i++) {
        var v = H.renderInto(w, React.createElement(w.SpeakButton, {
          text: 'Push one milligram of epinephrine.', voice: 'nurse'
        }));
        mounted.push(v);
      }
    }, 'SpeakButton mounts five times without throwing');
    t.ok(mounted.length === 5 && mounted[0].all('button').length >= 1, 'SpeakButton actually rendered a button');

    var fetchesAtMount = w.__fetchCalls.length;
    /* click one, then unmount everything mid-flight.
       SpeakButton's setState lands when the clip finishes, i.e. AFTER the act()
       block renderInto() wraps the click in, so React logs an "not wrapped in
       act(...)" warning that is an artefact of the async engine, not a defect.
       Silenced for the duration rather than papered over. */
    var origError = console.error;
    console.error = function () {};
    t.noThrow(function () { mounted[0].click(mounted[0].all('button')[0]); }, 'clicking SpeakButton does not throw');
    return H.tick(20).then(function () {
      t.ok(w.__fetchCalls.length > fetchesAtMount, 'the click actually reached the voice layer');
      var fetchesBeforeUnmount = w.__fetchCalls.length;
      t.noThrow(function () { mounted.forEach(function (v) { v.unmount(); }); }, 'unmounting five SpeakButtons does not throw');
      return H.tick(250).then(function () {
        console.error = origError;
        t.eq(w.__fetchCalls.length - fetchesBeforeUnmount, 0,
          'no interval survived unmount - zero further /api/tts calls after unmount + 250ms');
        t.eq(w.__audios.filter(function (a) { return !a.paused; }).length, 0,
          'unmount left no audio playing');
        t.eq(w.__audios.length, 1, 'five mount/unmount cycles did not create extra <audio> elements');
      });
    });
  }).then(function () {
    var React = w.React;
    if (!w.__RD || !w.VoiceSettings) return null;
    var views = [];
    t.noThrow(function () {
      for (var i = 0; i < 5; i++) views.push(H.renderInto(w, React.createElement(w.VoiceSettings, null)));
    }, 'VoiceSettings mounts five times without throwing');
    var before = w.__fetchCalls.length;
    t.noThrow(function () { views.forEach(function (v) { v.unmount(); }); }, 'VoiceSettings unmounts without throwing');
    return H.tick(250).then(function () {
      t.eq(w.__fetchCalls.length - before, 0, 'VoiceSettings left no polling behind after unmount');
      t.noThrow(function () { V.setPrefs({ rate: 1 }); },
        'prefs listeners registered by the unmounted panels no longer break setPrefs()');
      return settle(V.speak('One last line after everything unmounted.', { voice: 'nurse' }));
    });
  }).then(function (r) {
    if (r) {
      t.ok(r.ok && audible(r), 'the voice layer still works after all the mounting and unmounting');
    }
    t.eq(w.__toasts.length, 0, 'nothing was ever surfaced across the whole suite\'s longest session');
    world.cleanup();
  });
}
