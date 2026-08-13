/* ============================================================================
   voice-cache.test.js
   ----------------------------------------------------------------------------
   Adversarial tests for the ElevenLabs clip cache ladder in js/voice.js §8c:

       memory -> window.MM_STATIC_VOICE -> /voiceCache/<hash> -> POST /api/tts
                 -> Storage upload -> publish the shared index

   Two things are on trial here.
     1. MONEY. The index is the whole economic argument for studio voices: one
        student anywhere pays for a line and every other student streams it.
        If a hit is missed, or a row is published that points at nothing, or a
        row is keyed by a voice that was not actually used, the app either
        pays twice or serves the wrong audio forever.
     2. SILENCE. speak() must never reject and the student must always hear
        the line - premium or browser. Every group asserts that.

   Run:  node tests/run.js voice-cache
   ========================================================================== */
'use strict';

/* Node >= 21 exposes `navigator` as an accessor and _harness.js assigns to it.
   Make it writable before the harness loads. (Same shim as the normalizer
   suite; see the comment there.) */
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

var VOICE_NURSE = '21m00Tcm4TlvDq8ikWAM';   /* must pass the server's ^[A-Za-z0-9_-]{8,64}$ gate */
var VOICE_PATIENT = 'AZnzlk1XvdvUeBnXmlld';
var MODEL = 'eleven_flash_v2_5';
var MAX_MEM_CLIPS = 300;                    /* the constant in js/voice.js:1487 */

/* ---------------------------------------------------------------------------
   The harness's Storage double only implements put(); js/voice.js uploads with
   putString(b64,'base64',{contentType}) and then getDownloadURL(). A double
   that only speaks put() records nothing and never fails, so both the "an
   upload happened" and the "the upload failed" assertions would be vacuous.
   This one speaks the API the app actually calls and keeps the harness's
   window.__uploads / window.__failUpload contract intact.
   ------------------------------------------------------------------------ */
function storageDouble(w) {
  return {
    ref: function (p) {
      return {
        putString: function (b64) {
          if (w.__failUpload) return Promise.reject(new Error('storage/unauthorized'));
          w.__uploads.push({ path: p, size: String(b64 || '').length });
          return Promise.resolve({ metadata: { fullPath: p } });
        },
        put: function (blob) {
          if (w.__failUpload) return Promise.reject(new Error('storage/unauthorized'));
          w.__uploads.push({ path: p, size: (blob && blob.size) || 0 });
          return Promise.resolve({});
        },
        getDownloadURL: function () {
          if (w.__failUpload) return Promise.reject(new Error('storage/object-not-found'));
          return Promise.resolve('https://storage.test/' + p);
        }
      };
    }
  };
}

/* One premium-capable world. Every knob the tests need is a parameter so a
   world can be rebuilt from scratch to prove that nothing carried over in a
   module-scope cache. */
function mkWorld(opts) {
  opts = opts || {};
  var world = H.makeWorld({
    tier: opts.tier || 'pro',
    db: opts.db,
    uid: opts.uid,
    signedOut: opts.signedOut,
    fetchImpl: opts.fetchImpl || function () { return Promise.resolve(H.ttsOk()); }
  });
  var w = world.window;
  w.MM_VOICE_PROFILES = opts.profiles || {
    nurse: { voiceId: VOICE_NURSE, modelId: MODEL },
    patient: { voiceId: VOICE_PATIENT, modelId: MODEL }
  };
  /* MM.storage is voiceStorage()'s first choice (js/voice.js:1561). The harness
     never sets firebase.apps, so without this every upload silently no-ops. */
  if (!opts.noStorage) w.MM.storage = storageDouble(w);
  world.loadAiThenPatch();
  world.load('js/voice.js');
  world.V = w.MM.voice;

  /* HARNESS ISOLATION GAP, worked around here rather than in _harness.js:
     makeWorld() builds its JSDOM without runScripts, so w.eval() executes the
     app module in NODE's global scope, where `window` resolves dynamically to
     global.window - i.e. to whichever world was created LAST. Module closures
     stay separate, but a deferred callback inside an older world's js/ai.js
     re-publishes `window.MM.ai = api` into the NEWEST world, which silently
     gives that world another world's tier. That made the free-tier assertions
     flake roughly one run in three. Pinning MM.ai makes the foreign write a
     no-op for this world. */
  var pinnedAi = w.MM.ai;
  try {
    Object.defineProperty(w.MM, 'ai', {
      configurable: true,
      get: function () { return pinnedAi; },
      set: function () { /* ignore late writes from other jsdom worlds */ }
    });
  } catch (e) { /* noop */ }

  return world;
}

/* A FakeDb that also counts reads, so "0 db reads" can be asserted. */
function countingDb() {
  var db = H.makeFakeDb();
  var reads = [];
  var inner = db.ref;
  db.ref = function (p) {
    var r = inner(p);
    var once = r.once;
    r.once = function () { reads.push(String(p)); return once.apply(r, arguments); };
    return r;
  };
  db.reads = function (rx) {
    return rx ? reads.filter(function (p) { return rx.test(p); }) : reads.slice();
  };
  db.resetReads = function () { reads.length = 0; };
  return db;
}

/* getAudioEl() reuses ONE element for the whole session (the iOS unlock), so
   "what played" is the element's current src, not a per-clip Audio object. */
function lastSrc(w) {
  var el = w.__audios[w.__audios.length - 1];
  return el ? String(el.src || '') : '';
}

module.exports = {
  name: 'voice-cache - ElevenLabs clip ladder',

  run: function (t) {
    var worlds = [];
    function keep(w) { worlds.push(w); return w; }

    /* ================================================================== *
     * 1. HASHING
     * ================================================================== */
    t.group('hashing');

    var HW = keep(mkWorld());
    var HV = HW.V;

    var h1 = HV.clipHash('one hundred twenty five milliliters per hour', VOICE_NURSE, MODEL);
    t.match(h1, /^[0-9a-f]{32}$/, 'the key is 32 lowercase hex chars');
    t.eq(HV.clipHash('one hundred twenty five milliliters per hour', VOICE_NURSE, MODEL), h1,
      'same text + voice + model -> same key');
    t.ok(HV.clipHash('a different line entirely', VOICE_NURSE, MODEL) !== h1,
      'different text -> different key');
    t.ok(HV.clipHash('one hundred twenty five milliliters per hour', VOICE_PATIENT, MODEL) !== h1,
      'different voice -> different key');
    t.ok(HV.clipHash('one hundred twenty five milliliters per hour', VOICE_NURSE, 'eleven_turbo_v2_5') !== h1,
      'different model -> different key');
    t.eq(HV.clipHash('  ONE Hundred twenty five Milliliters Per Hour  ', VOICE_NURSE, MODEL), h1,
      'the key is case- and whitespace-insensitive (promptHash trims + lowercases)');
    t.eq(HV.clipHash('', '', ''), HV.clipHash(null, null, null), 'null and empty hash alike');

    var reqA = HV.clipRequest('BP 92/58, HR 118.', { voice: 'nurse' });
    var reqB = HV.clipRequest('**BP** 92/58,   HR 118.', { voice: 'nurse' });
    var reqC = HV.clipRequest('BP 92/58, HR 118.\n', { voice: 'nurse' });
    var reqD = HV.clipRequest('BP 92/58, HR 118.', { voice: 'patient' });
    t.eq(reqB.hash, reqA.hash, 'markdown differences normalize to the same clip');
    t.eq(reqC.hash, reqA.hash, 'trailing whitespace normalizes to the same clip');
    t.ok(reqD.hash !== reqA.hash, 'a different profile voice is a different clip');
    t.eq(reqA.modelId, MODEL, 'the request carries the profile model');
    t.eq(reqA.voiceId, VOICE_NURSE, 'the request carries the profile voice');
    t.eq(HV.clipRequest('   ', { voice: 'nurse' }), null, 'a blank line has no clip request');
    t.eq(HV.clipRequest('anything', { voice: 'nobody' }).voiceId, VOICE_NURSE,
      'an unknown profile falls back to the default (nurse)');

    /* stability across a completely fresh world */
    var HW2 = keep(mkWorld());
    t.eq(HW2.V.clipHash('one hundred twenty five milliliters per hour', VOICE_NURSE, MODEL), h1,
      'the key is stable across worlds (a hash is a contract, not session state)');
    t.eq(HW2.V.clipRequest('BP 92/58, HR 118.', { voice: 'nurse' }).hash, reqA.hash,
      'clipRequest is stable across worlds');

    var chain = Promise.resolve();

    /* ================================================================== *
     * 2. LADDER: MISS -> generate -> upload -> publish
     * ================================================================== */
    chain = chain.then(function () {
      t.group('ladder: a miss pays once and publishes for everybody');

      var db = countingDb();
      var W = keep(mkWorld({ db: db }));
      var line = 'Blood pressure is 92 over 58 and dropping.';
      var req = W.V.clipRequest(line, { voice: 'nurse' });

      return t.resolves(W.V.speak(line, { voice: 'nurse' }), 'speak() resolves on a cold cache')
        .then(function (res) {
          t.ok(res && res.spoken === true, 'the line was spoken');
          t.eq(res.premium, true, 'it was spoken by the studio voice');
          t.eq(res.source, 'generated', 'source is "generated" on a cold cache');
          t.eq(W.window.__fetchCalls.length, 1, 'exactly ONE /api/tts call');
          t.contains(W.window.__fetchCalls[0].url, '/api/tts', 'it called the tts endpoint');
          t.eq(W.window.__fetchCalls[0].body.action, 'speak', 'action=speak');
          t.eq(W.window.__fetchCalls[0].body.voiceId, VOICE_NURSE, 'the voice id was sent');
          t.notContains(W.window.__fetchCalls[0].body.text, '92/58',
            'the SERVER receives normalized text, never raw clinical shorthand');
          t.eq(W.window.__spoken.length, 0, 'the browser synth was not used');
          t.contains(lastSrc(W.window), 'data:audio/mpeg;base64,',
            'playback came from the data URL, not a round trip through Storage');
          return H.tick(20);
        })
        .then(function () {
          t.eq(W.window.__uploads.length, 1, 'exactly ONE Storage upload');
          t.eq(W.window.__uploads[0].path, 'voice/nurse/' + req.hash + '.mp3',
            'uploaded to voice/<profile>/<hash>.mp3');
          var rows = db.writesTo(/^voiceCache\//);
          t.eq(rows.length, 1, 'exactly ONE index write');
          t.eq(rows[0].path, 'voiceCache/' + req.hash, 'written to /voiceCache/<hash>');
          var rec = rows[0].value;
          t.ok(rec && typeof rec.url === 'string' && rec.url.indexOf('https://storage.test/') === 0,
            'the row carries a Storage url');
          t.eq(rec.modelId, MODEL, 'the row carries the model id');
          t.eq(rec.profile, 'nurse', 'the row carries the profile');
          t.eq(typeof rec.chars, 'number', 'the row carries a char count');
          t.eq(rec.createdBy, 'u-test', 'the row records who paid for it');
          t.eq(db.reads(/^voiceCache\//).length, 1, 'the index was read exactly once');
          var s = W.V.stats();
          t.eq(s.misses, 1, 'stats: one miss');
          t.eq(s.generated, 1, 'stats: one generation');
          t.eq(s.hits, 0, 'stats: no hits yet');
          t.eq(s.uploads, 1, 'stats: one upload');
          t.eq(s.uploadFailures, 0, 'stats: no upload failures');
          t.eq(s.inflight, 0, 'stats: nothing left in flight');
        });
    });

    /* ================================================================== *
     * 3. LADDER: memory hit
     * ================================================================== */
    chain = chain.then(function () {
      t.group('ladder: memory hit costs nothing');

      var db = countingDb();
      var W = keep(mkWorld({ db: db }));
      var line = 'I gave the 0.25 mg IV push.';

      return W.V.speak(line, { voice: 'nurse' }).then(function () {
        return H.tick(20);
      }).then(function () {
        var fetchesAfterFirst = W.window.__fetchCalls.length;
        var uploadsAfterFirst = W.window.__uploads.length;
        db.resetReads();
        return t.resolves(W.V.speak(line, { voice: 'nurse' }), 'the second speak() resolves')
          .then(function (res) {
            t.eq(res.source, 'memory', 'served from memory');
            t.eq(res.spoken, true, 'and it was actually spoken');
            t.eq(W.window.__fetchCalls.length, fetchesAfterFirst, 'ZERO extra fetches');
            t.eq(W.window.__uploads.length, uploadsAfterFirst, 'ZERO extra uploads');
            t.eq(db.reads(/^voiceCache\//).length, 0, 'ZERO extra index reads');
            t.eq(db.writesTo(/^voiceCache\//).length, 1, 'the index was not rewritten');
            t.eq(W.V.stats().hits, 1, 'stats: one hit');
            t.ok(W.V.stats().charsSaved > 0, 'stats: charsSaved moved');
          });
      });
    });

    /* ================================================================== *
     * 4. LADDER: the static bundle
     * ================================================================== */
    chain = chain.then(function () {
      t.group('ladder: static bundle is free and offline');

      var db = countingDb();
      var W = keep(mkWorld({ db: db }));
      var line = 'This line ships inside the repo.';
      var req = W.V.clipRequest(line, { voice: 'nurse' });
      W.window.MM_STATIC_VOICE = {};
      W.window.MM_STATIC_VOICE[req.hash] = 'data:audio/mpeg;base64,U1RBVElD';
      db.resetReads();

      return t.resolves(W.V.speak(line, { voice: 'nurse' }), 'speak() resolves from the bundle')
        .then(function (res) {
          t.eq(res.source, 'static', 'served from the static bundle');
          t.eq(res.spoken, true, 'and it was spoken');
          t.eq(W.window.__fetchCalls.length, 0, 'ZERO fetches');
          t.eq(db.reads().length, 0, 'ZERO db reads of ANY path');
          t.eq(W.V.stats().indexReads, 0, 'the index was never touched');
          t.eq(lastSrc(W.window), 'data:audio/mpeg;base64,U1RBVElD', 'the bundled clip played');
          t.eq(W.window.__uploads.length, 0, 'nothing was uploaded');
          t.eq(W.V.stats().hits, 1, 'stats: counted as a hit');
          /* junk in the bundle must not be trusted */
          var line2 = 'This bundle entry is junk.';
          var req2 = W.V.clipRequest(line2, { voice: 'nurse' });
          W.window.MM_STATIC_VOICE[req2.hash] = 12345;
          return t.resolves(W.V.speak(line2, { voice: 'nurse' }),
            'a non-string bundle entry does not break speak()')
            .then(function (r2) {
              t.eq(r2.source, 'generated', 'a non-string bundle entry falls through to generation');
            });
        });
    });

    /* ================================================================== *
     * 5. LADDER: index hit
     * ================================================================== */
    chain = chain.then(function () {
      t.group('ladder: index hit plays the shared mp3');

      var db = countingDb();
      var W = keep(mkWorld({ db: db }));
      var line = 'Somebody already paid for this sentence.';
      var req = W.V.clipRequest(line, { voice: 'nurse' });
      db.seed('voiceCache/' + req.hash, {
        url: 'https://storage.test/voice/nurse/' + req.hash + '.mp3',
        voiceId: VOICE_NURSE, modelId: MODEL, profile: 'nurse', chars: 40, bytes: 9000, hits: 7
      });

      return t.resolves(W.V.speak(line, { voice: 'nurse' }), 'speak() resolves from the index')
        .then(function (res) {
          t.eq(res.source, 'index', 'served from the shared index');
          t.eq(res.spoken, true, 'and it was spoken');
          t.eq(W.window.__fetchCalls.length, 0, 'ZERO /api/tts calls');
          t.eq(W.window.__uploads.length, 0, 'ZERO uploads');
          t.contains(lastSrc(W.window), 'https://storage.test/voice/nurse/' + req.hash + '.mp3',
            'audio played from the indexed url');
          t.eq(db.writesTo(/^voiceCache\/[^/]+$/).length, 0, 'a hit does not rewrite the row');
          t.eq(W.V.stats().hits, 1, 'stats: one hit');
          t.eq(W.V.stats().generated, 0, 'stats: nothing generated');
          t.eq(W.V.stats().charsSaved, 40, 'stats: charsSaved uses the row char count');
        });
    });

    /* ================================================================== *
     * 6. CONCURRENCY
     * ================================================================== */
    chain = chain.then(function () {
      t.group('concurrency');

      var db = countingDb();
      var W = keep(mkWorld({ db: db }));
      var V = W.V;
      var same = V.clipRequest('Eight callers want this exact line.', { voice: 'nurse' });
      var ps = [];
      for (var i = 0; i < 8; i++) ps.push(V.getClip(same));

      return Promise.all(ps).then(function (rs) {
        t.eq(W.window.__fetchCalls.length, 1, '8 simultaneous requests for ONE line -> 1 fetch');
        t.eq(rs.length, 8, 'all 8 resolved');
        t.ok(rs.every(function (r) { return r && r.url === rs[0].url; }),
          'all 8 got the identical clip');
        t.ok(rs.every(function (r) { return r && r.hash === same.hash; }), 'all 8 share the hash');
        return H.tick(20);
      }).then(function () {
        t.eq(W.window.__uploads.length, 1, 'and exactly ONE upload');
        t.eq(db.writesTo(/^voiceCache\//).length, 1, 'and exactly ONE index write');
        t.eq(W.V.stats().inflight, 0, 'the de-dup table drained');

        var ps2 = [], j;
        for (j = 0; j < 8; j++) {
          ps2.push(W.V.getClip(W.V.clipRequest('Distinct line number ' + j + ' here.', { voice: 'nurse' })));
        }
        return Promise.all(ps2).then(function () {
          t.eq(W.window.__fetchCalls.length, 9, '8 simultaneous DIFFERENT lines -> 8 more fetches');
          return H.tick(30);
        }).then(function () {
          t.eq(W.window.__uploads.length, 9, '8 more uploads');
          t.eq(db.writesTo(/^voiceCache\//).length, 9, '8 more index rows');
        });
      }).then(function () {
        /* interleaved: 4 repeats of an already-cached line + 4 brand new ones */
        var before = W.window.__fetchCalls.length;
        var mixed = [], k;
        for (k = 0; k < 4; k++) {
          mixed.push(W.V.getClip(same));
          mixed.push(W.V.getClip(W.V.clipRequest('Interleaved fresh line ' + k + '.', { voice: 'nurse' })));
        }
        return Promise.all(mixed).then(function (rs) {
          t.eq(W.window.__fetchCalls.length - before, 4,
            'interleaved same+different -> only the 4 new lines cost a fetch');
          t.ok(rs.every(function (r) { return r && r.url; }), 'every interleaved caller got a clip');
        });
      }).then(function () {
        /* the same thing through the public speak() path. speak() cancels the
           previous utterance by design, so the earlier 7 must resolve as
           'cancelled' rather than hang or reject. */
        var D = keep(mkWorld({ db: countingDb() }));
        var ps3 = [], n;
        for (n = 0; n < 8; n++) ps3.push(D.V.speak('Eight overlapping speak calls.', { voice: 'nurse' }));
        return t.resolves(Promise.all(ps3), '8 overlapping speak() calls all resolve')
          .then(function (rs) {
            t.eq(D.window.__fetchCalls.length, 1, '8 overlapping speak()s -> 1 fetch');
            t.ok(rs.filter(function (r) { return r && r.spoken; }).length >= 1,
              'the surviving call actually spoke');
            t.ok(rs.every(function (r) { return r && (r.spoken || r.reason === 'cancelled'); }),
              'the superseded calls resolve as cancelled, never reject');
            return H.tick(20);
          }).then(function () {
            t.eq(D.window.__uploads.length, 1, 'and exactly 1 upload');
          });
      });
    });

    /* ================================================================== *
     * 7. CROSS-STUDENT SHARING  -  the economic claim
     * ================================================================== */
    chain = chain.then(function () {
      t.group('cross-student sharing');

      var db = countingDb();
      var A = keep(mkWorld({ db: db, uid: 'student-A' }));
      var line = 'Mister Alvarez, I am going to hang your antibiotic now.';

      return A.V.speak(line, { voice: 'nurse' }).then(function (r) {
        t.eq(r.source, 'generated', 'student A paid for the line');
        return H.tick(20);
      }).then(function () {
        t.eq(db.writesTo(/^voiceCache\//).length, 1, 'student A published the index row');

        /* A completely fresh world: new jsdom, new module scope, new memory
           cache, new static bundle - only the database is shared. */
        var B = keep(mkWorld({ db: db, uid: 'student-B' }));
        t.eq(B.V.stats().memory, 0, 'student B starts with an empty memory cache');
        return t.resolves(B.V.speak(line, { voice: 'nurse' }), 'student B speak() resolves')
          .then(function (r2) {
            t.eq(r2.source, 'index', 'student B was served from the shared index');
            t.eq(r2.spoken, true, 'student B heard the line');
            t.eq(B.window.__fetchCalls.length, 0, 'student B made ZERO ElevenLabs calls');
            t.eq(B.window.__uploads.length, 0, 'student B uploaded nothing');
            t.eq(B.window.__spoken.length, 0, 'student B did not fall back to the browser voice');
            t.contains(lastSrc(B.window), 'https://storage.test/', 'student B streamed the shared mp3');
            t.eq(db.writesTo(/^voiceCache\/[^/]+$/).length, 1, 'no duplicate row was written');

            /* a third student on a different profile does NOT get the nurse clip */
            var C = keep(mkWorld({ db: db, uid: 'student-C' }));
            return C.V.speak(line, { voice: 'patient' }).then(function (r3) {
              t.eq(r3.source, 'generated',
                'a different voice is a different clip - the index is keyed by voice');
              t.eq(C.window.__fetchCalls.length, 1, 'and it costs exactly one call');
            });
          });
      });
    });

    /* ================================================================== *
     * 8. STORAGE FAILURE MUST NOT POISON THE SHARED INDEX
     * ================================================================== */
    chain = chain.then(function () {
      t.group('storage failure');

      var db = countingDb();
      var W = keep(mkWorld({ db: db }));
      W.window.__failUpload = true;
      var line = 'The bucket rules are not deployed yet.';

      return t.resolves(W.V.speak(line, { voice: 'nurse' }), 'speak() still resolves')
        .then(function (res) {
          t.eq(res.spoken, true, 'the student still heard the line');
          t.eq(res.premium, true, 'from the studio voice, out of the data URL');
          t.contains(lastSrc(W.window), 'data:audio/mpeg;base64,', 'played from the data URL');
          return H.tick(30);
        })
        .then(function () {
          t.deepEq(db.writesTo(/^voiceCache\//), [],
            'NO index row was published - a row pointing at a failed upload would ' +
            'poison the shared cache for every student');
          t.eq(W.window.__uploads.length, 0, 'nothing reached Storage');
          t.eq(W.V.stats().uploadFailures, 1, 'stats: the failure was counted');
          t.eq(W.V.stats().generated, 1, 'stats: the clip was still generated');
          t.eq(W.V.stats().disabled, false, 'a Storage failure does not disable studio voices');

          /* and the next student is not handed a dead url */
          var B = keep(mkWorld({ db: db }));
          return t.resolves(B.V.speak(line, { voice: 'nurse' }), 'the next student also resolves')
            .then(function (r2) {
              t.eq(r2.source, 'generated', 'the next student regenerates rather than reading a dead row');
              t.eq(r2.spoken, true, 'and hears the line');
            });
        });
    });

    /* ================================================================== *
     * 9. MALFORMED INDEX ROWS
     * ================================================================== */
    chain = chain.then(function () {
      t.group('malformed index rows');

      var db = countingDb();
      var W = keep(mkWorld({ db: db }));
      var V = W.V;
      var bad = [
        { label: 'missing url', row: { voiceId: VOICE_NURSE, modelId: MODEL } },
        { label: 'null row', row: null },
        { label: 'numeric url', row: { url: 12345 } },
        { label: 'empty url', row: { url: '' } },
        { label: 'a bare string', row: 'https://storage.test/nope.mp3' },
        { label: 'an array', row: ['https://storage.test/nope.mp3'] },
        { label: 'url object', row: { url: { href: 'x' } } },
        { label: 'boolean row', row: true }
      ];
      var reqs = bad.map(function (b, i) {
        var r = V.clipRequest('Malformed row case number ' + i + '.', { voice: 'nurse' });
        db.seed('voiceCache/' + r.hash, b.row);
        return r;
      });

      return t.resolves(Promise.all(reqs.map(function (r) { return V.getClip(r); })),
        'a malformed index row never rejects')
        .then(function (rs) {
          rs.forEach(function (r, i) {
            t.ok(r && r.source === 'generated',
              bad[i].label + ' is ignored and the clip is regenerated');
            t.ok(r && typeof r.url === 'string' && r.url,
              bad[i].label + ' still yields a playable url');
          });
          t.eq(W.window.__fetchCalls.length, bad.length,
            'every malformed row fell through to exactly one generation');
          /* and a row with the right url but junk metadata is still usable */
          var ok = V.clipRequest('A row with junk metadata but a good url.', { voice: 'nurse' });
          db.seed('voiceCache/' + ok.hash, {
            url: 'https://storage.test/good.mp3', voiceId: 42, modelId: null, chars: 'lots'
          });
          return V.getClip(ok).then(function (r) {
            t.eq(r.source, 'index', 'a good url with junk metadata is still an index hit');
            t.eq(r.voiceId, VOICE_NURSE, 'a non-string voiceId falls back to the requested voice');
            t.eq(r.modelId, MODEL, 'a null modelId falls back to the requested model');
            t.eq(r.chars, ok.text.length, 'a non-numeric char count falls back to the text length');
          });
        });
    });

    /* ================================================================== *
     * 10. FAILURE MODES  -  audio always happens
     * ================================================================== */
    chain = chain.then(function () {
      t.group('failure modes always end in audio');

      /* expectPublish: a clip that was generated fine but could not be PLAYED
         (autoplay policy) is still worth sharing; a clip that never existed
         must never reach the index. */
      function failWorld(label, fetchImpl, extra, expectPublish) {
        var W = keep(mkWorld({ db: countingDb(), fetchImpl: fetchImpl }));
        if (extra) extra(W);
        return t.resolves(W.V.speak('Everything that can go wrong, goes wrong.', { voice: 'nurse' }),
          label + ': speak() resolves')
          .then(function (res) {
            t.ok(res && res.spoken === true, label + ': the line was still spoken');
            t.eq(W.window.__spoken.length, 1, label + ': the browser voice took over');
            return H.tick(20).then(function () {
              var rows = W.db.writesTo(/^voiceCache\//);
              if (expectPublish) {
                t.eq(rows.length, 1, label + ': the good clip was still shared');
              } else {
                t.deepEq(rows, [], label + ': nothing was published to the shared index');
              }
              return W;
            });
          });
      }

      return failWorld('500', function () { return Promise.resolve(H.errorResponse(500)); })
        .then(function (W) {
          t.eq(W.V.stats().disabled, false, '500 is transient: studio voices stay enabled');
          t.eq(W.V.stats().fallbacks, 1, 'stats: one fallback');
          return W.V.speak('A second line after the 500.', { voice: 'nurse' }).then(function () {
            t.eq(W.window.__fetchCalls.length, 2, 'a transient failure IS retried on the next line');
          });
        })
        .then(function () {
          return failWorld('401', function () {
            return Promise.resolve(H.errorResponse(401, { error: 'no-auth', message: 'sign in' }));
          });
        })
        .then(function (W) {
          t.eq(W.V.stats().disabled, true, '401 is permanent for the session');
          return W.V.speak('Another line after the 401.', { voice: 'nurse' }).then(function (r) {
            t.eq(r.spoken, true, 'and the student still hears it');
            t.eq(W.window.__fetchCalls.length, 1, 'no further money is spent after a permanent failure');
          });
        })
        .then(function () {
          return failWorld('429 quota', function () {
            return Promise.resolve(H.errorResponse(429, { error: 'quota-exceeded', message: 'out of characters' }));
          });
        })
        .then(function (W) {
          t.eq(W.V.stats().disabled, true, '429 disables studio voices for the session');
          t.contains(W.V.stats().disabledReason, 'characters', 'the reason is human readable');
        })
        .then(function () {
          return failWorld('malformed 200', function () { return Promise.resolve(H.jsonResponse({ ok: true })); });
        })
        .then(function (W) {
          t.eq(W.V.stats().disabled, false, 'a malformed 200 is treated as transient');
        })
        .then(function () {
          return failWorld('network down', function () { return Promise.reject(new Error('offline')); });
        })
        .then(function () {
          return failWorld('empty body', function () { return Promise.resolve(H.jsonResponse({ ok: true, b64: '' })); });
        })
        .then(function () {
          return failWorld('blocked autoplay', null,
            function (W) { W.window.__blockAutoplay = true; }, true);
        })
        .then(function () {
          /* an index row whose mp3 is gone: the clip must be evicted so the
             next attempt can re-read or regenerate rather than replaying a
             dead url out of memory forever. */
          var db = countingDb();
          var W = keep(mkWorld({ db: db }));
          var line = 'This row points at a deleted object.';
          var req = W.V.clipRequest(line, { voice: 'nurse' });
          db.seed('voiceCache/' + req.hash, { url: 'https://storage.test/deleted.mp3' });
          W.window.__blockAutoplay = true;
          return t.resolves(W.V.speak(line, { voice: 'nurse' }), 'dead index url: speak() resolves')
            .then(function (r) {
              t.eq(r.spoken, true, 'dead index url: the browser voice covered it');
              t.eq(W.V.stats().memory, 0, 'the dead clip was evicted from memory');
            });
        })
        .then(function () {
          /* tiers and sign-in state: no money, still audio */
          var F = keep(mkWorld({ db: countingDb(), tier: 'free' }));
          return t.resolves(F.V.speak('A free-tier student.', { voice: 'nurse' }), 'free tier resolves')
            .then(function (r) {
              t.eq(r.spoken, true, 'free tier still hears the line');
              t.eq(F.window.__fetchCalls.length, 0, 'free tier never calls the paid API');
              t.eq(F.window.__spoken.length, 1, 'free tier used the browser voice');
              t.eq(F.V.stats().premium, false, 'stats: not premium');
            });
        })
        .then(function () {
          var S = keep(mkWorld({ db: countingDb(), signedOut: true }));
          return t.resolves(S.V.speak('A signed-out visitor.', { voice: 'nurse' }), 'signed out resolves')
            .then(function (r) {
              t.eq(r.spoken, true, 'signed out still hears the line');
              t.eq(S.window.__fetchCalls.length, 0, 'no token, no call');
            });
        })
        .then(function () {
          var P = keep(mkWorld({ db: countingDb(), profiles: {} }));
          return t.resolves(P.V.speak('No voice is assigned to this role.', { voice: 'nurse' }),
            'unassigned profile resolves')
            .then(function (r) {
              t.eq(r.spoken, true, 'an unassigned profile still speaks');
              t.eq(P.window.__fetchCalls.length, 0, 'and costs nothing');
              t.contains(P.V.premiumReason(), 'No studio voice', 'premiumReason explains why');
            });
        })
        .then(function () {
          var M = keep(mkWorld({ db: countingDb() }));
          M.V.setPrefs({ premiumVoice: false });
          return t.resolves(M.V.speak('Studio voices switched off by the student.', { voice: 'nurse' }),
            'premiumVoice=false resolves')
            .then(function (r) {
              t.eq(r.spoken, true, 'the line is still read aloud');
              t.eq(M.window.__fetchCalls.length, 0, 'and the opt-out is honoured');
              M.V.setPrefs({ premiumVoice: true });
            });
        });
    });

    /* ================================================================== *
     * 10b. LIMITS AND MISSING ENGINES
     * ================================================================== */
    chain = chain.then(function () {
      t.group('limits and missing engines');

      var L = keep(mkWorld({ db: countingDb() }));
      var huge = new Array(400).join('The patient is short of breath and anxious. ');
      t.ok(huge.length > 5000, 'built a ' + huge.length + '-char line (over MAX_PREMIUM_CHARS)');
      return t.resolves(L.V.speak(huge, { voice: 'nurse' }), 'an over-long line resolves')
        .then(function (r) {
          t.eq(r.spoken, true, 'an over-long line is still read aloud');
          t.eq(L.window.__fetchCalls.length, 0, 'and is never sent to the paid API');
          t.ok(L.window.__spoken.length >= 1, 'the browser voice chunked it');
        })
        .then(function () {
          /* No speechSynthesis at all (some Android WebViews). The premium path
             must still work on its own. */
          var NS = keep(mkWorld({ db: countingDb() }));
          delete NS.window.speechSynthesis;
          delete NS.window.SpeechSynthesisUtterance;
          return t.resolves(NS.V.speak('No browser synth, studio voice only.', { voice: 'nurse' }),
            'no browser synth: the premium path alone resolves')
            .then(function (r) {
              t.eq(r.spoken, true, 'the studio voice carried the line with no synth present');
              t.eq(r.premium, true, 'and it really was the premium path');
            });
        })
        .then(function () {
          /* Both engines gone - no studio voice AND no Web Speech API.
             This USED to be the one path where speak() rejected, which broke
             the module's own stated contract and produced unhandled rejections
             on every patient line (sim-engine.js still carries a local .catch()
             workaround for it, and ai-scenario.js's applyHint used a bare
             try/catch that cannot catch a rejection at all).
             It now RESOLVES with {spoken:false, reason:'unsupported'} - there
             is genuinely no audio to be had on such a device, but that is a
             normal outcome, not an exception. No caller needs a catch. */
          var NS2 = keep(mkWorld({
            db: countingDb(),
            fetchImpl: function () { return Promise.resolve(H.errorResponse(500)); }
          }));
          delete NS2.window.speechSynthesis;
          delete NS2.window.SpeechSynthesisUtterance;
          return NS2.V.speak('Both engines are gone.', { voice: 'nurse' }).then(
            function (res) {
              var r = res || {};
              t.ok(true, 'both engines gone: speak() resolves rather than rejecting');
              t.eq(r.spoken, false, 'both engines gone: reports that nothing was spoken');
              return t.eq(r.reason, 'unsupported',
                'both engines gone: reason names the missing engine, not an error');
            },
            function (e) {
              return t.ok(false, 'both engines gone: speak() REJECTED - ' +
                'the never-reject contract is broken again (' + (e && e.message) + ')');
            }
          );
        });
    });

    /* ================================================================== *
     * 11. stats() across a scripted sequence
     * ================================================================== */
    chain = chain.then(function () {
      t.group('stats() counters');

      var db = countingDb();
      var W = keep(mkWorld({ db: db }));
      var V = W.V;
      var l1 = 'Counter line one.', l2 = 'Counter line two.';
      var seeded = V.clipRequest('Counter line three, pre-seeded.', { voice: 'nurse' });
      db.seed('voiceCache/' + seeded.hash, { url: 'https://storage.test/three.mp3', chars: 11 });

      var s0 = V.stats();
      t.eq(s0.hits, 0, 'start: 0 hits');
      t.eq(s0.misses, 0, 'start: 0 misses');
      t.eq(s0.generated, 0, 'start: 0 generated');
      t.eq(s0.memory, 0, 'start: empty memory');
      t.eq(s0.tier, 'pro', 'start: tier reported');
      t.eq(s0.storageAvailable, true, 'start: storage detected');
      t.eq(s0.premium, true, 'start: premium is on');

      return V.speak(l1, { voice: 'nurse' })                      /* miss + generate */
        .then(function () { return V.speak(l1, { voice: 'nurse' }); })   /* memory hit */
        .then(function () { return V.speak(l2, { voice: 'nurse' }); })   /* miss + generate */
        .then(function () { return V.getClip(seeded); })                  /* index hit */
        .then(function () { return V.speak(l1, { voice: 'nurse' }); })   /* memory hit */
        .then(function () { return H.tick(30); })
        .then(function () {
          var s = V.stats();
          t.eq(s.generated, 2, 'generated: 2 (two distinct new lines)');
          t.eq(s.misses, 2, 'misses: 2');
          t.eq(s.hits, 3, 'hits: 3 (two memory + one index)');
          t.eq(s.indexReads, 3, 'indexReads: 3 (only the non-memory lookups)');
          t.eq(s.uploads, 2, 'uploads: 2');
          t.eq(s.plays, 4, 'plays: 4 (getClip does not play)');
          t.eq(s.fallbacks, 0, 'fallbacks: 0 - nothing degraded');
          t.eq(s.memory, 3, 'memory: 3 distinct clips');
          t.eq(s.chars, 84, 'chars: the two generated lines, as reported by the server');
          t.ok(s.charsSaved > 0, 'charsSaved: moved on every hit');
          t.eq(s.inflight, 0, 'inflight: drained');
          t.eq(s.lastError, '', 'lastError: clean run');
          t.deepEq(Object.keys(s.profiles).sort(), ['nurse', 'patient'], 'profiles are reported');
        });
    });

    /* ================================================================== *
     * 12. DEFECT: the in-memory clip cache is unbounded
     * ------------------------------------------------------------------
     * MAX_MEM_CLIPS (js/voice.js:1487) is only applied by rememberClipData()
     * (js/voice.js:2068) to _clipData. rememberClip() (js/voice.js:2078)
     * writes _clipMem[hash] = entry with no bound at all, and every generated
     * entry holds `url` AND `dataUrl` - the whole base64 mp3. So evicting
     * _clipData frees nothing (the same string is still referenced from
     * _clipMem) and a long session grows without limit: at ~25 KB per short
     * line, the 172 scripted dialogue lines plus AI chatter is tens of MB on
     * a phone.
     * ================================================================== */
    chain = chain.then(function () {
      t.group('DEFECT: unbounded in-memory clip cache');

      var W = keep(mkWorld({ db: countingDb() }));
      var V = W.V;
      var n = MAX_MEM_CLIPS + 20;
      var step = Promise.resolve();
      var first = V.clipRequest('Bounded cache line number 0 of the sweep.', { voice: 'nurse' });

      for (var i = 0; i < n; i++) {
        (function (i) {
          step = step.then(function () {
            return V.getClip(V.clipRequest('Bounded cache line number ' + i + ' of the sweep.',
              { voice: 'nurse' }));
          });
        })(i);
      }

      return step.then(function () { return H.tick(30); }).then(function () {
        var s = V.stats();
        t.eq(s.generated, n, 'all ' + n + ' clips were generated');
        t.eq(W.window.__fetchCalls.length, n, 'one fetch each');
        t.ok(s.memory <= MAX_MEM_CLIPS,
          'memory must stay within MAX_MEM_CLIPS (' + MAX_MEM_CLIPS + '), got ' + s.memory);
        /* correctness must survive whatever the bound does */
        return V.getClip(first).then(function (r) {
          t.ok(r && r.url, 'a clip is still resolvable after the cache filled up');
          t.ok(r.source === 'memory' || r.source === 'index' || r.source === 'generated',
            'and it comes from a legitimate ladder step (' + (r && r.source) + ')');
          t.eq(V.stats().inflight, 0, 'nothing stuck in flight after ' + n + ' clips');
        });
      });
    });

    /* ================================================================== *
     * 13. DEFECT: the published row can name a voice that was never used
     * ------------------------------------------------------------------
     * netlify/functions/tts.js:949-957 ignores the client's voiceId for
     * everybody except the owner and uses the voice assigned server-side.
     * resolveClip (js/voice.js:2295) keys the clip by the CLIENT's voiceId
     * but records the SERVER's voiceId in the shared row, and publishes it
     * anyway. If the two ever disagree - a stale voiceProfiles read, an admin
     * changing the assignment mid-session - the shared index permanently
     * serves audio in one voice under the hash of another, for every student,
     * with no way to invalidate it.
     * ================================================================== */
    chain = chain.then(function () {
      t.group('DEFECT: index row keyed by one voice, generated with another');

      var db = countingDb();
      var W = keep(mkWorld({
        db: db,
        fetchImpl: function () { return Promise.resolve(H.ttsOk({ voiceId: 'ServerPickedOtherVoice' })); }
      }));
      var req = W.V.clipRequest('The server used a different voice than we asked for.',
        { voice: 'nurse' });

      return t.resolves(W.V.getClip(req), 'the mismatch does not break generation')
        .then(function () { return H.tick(30); })
        .then(function () {
          var row = db.get('voiceCache/' + req.hash);
          t.ok(row, 'a row was published');
          t.eq(row && row.voiceId, req.voiceId,
            'the published row must name the voice the hash was computed from (' +
            req.voiceId + '), or the row must not be published at all');
        });
    });

    return chain.then(function () {
      return H.tick(20);
    }).then(function () {
      worlds.forEach(function (w) { try { w.cleanup(); } catch (e) { /* noop */ } });
    });
  }
};
