/* ============================================================================
 * MedMaster - js/images.js
 * window.MM.images : the client-side image cache.
 *
 * THE ONE RULE THIS FILE EXISTS FOR:
 *   NOBODY PAYS TWICE FOR THE SAME PICTURE.
 *
 * An AI image costs several times what a tutor message costs, and the two image
 * sets this app actually needs (37 drug mnemonics, 18 patient portraits) are
 * FIXED - the same 55 pictures for every student who ever installs it. So the
 * generate call is the last resort, never the first move, and every image that
 * does get generated is uploaded once and then shared with every other student
 * through a public index in Firebase.
 *
 * LOOKUP ORDER for get() - each step is cheaper than the one below it:
 *   1. in-memory map            this page session, free, instant
 *   2. window.MM_STATIC_IMAGES  images bundled into the repo, free forever,
 *                               zero network of any kind (see exportStatic())
 *   3. /imageCache/<promptHash> the SHARED index. One student anywhere in the
 *                               world generated it once; everybody else reads
 *                               a URL. This is the whole point.
 *   4. POST /api/ai generateImage, then upload to Storage and write step 3 so
 *                               this is the last time anyone pays for it.
 *
 * PROMISES THIS MODULE MAKES TO ITS CALLERS:
 *   - get() NEVER rejects. It resolves with an entry or with null. A missing
 *     image degrades to no image; it never becomes an error screen in a feature
 *     that was only trying to decorate itself.
 *   - get() never blocks on generation for a cached image: steps 1 and 2 return
 *     synchronously-resolved promises, so a caller can render a placeholder and
 *     swap it when the promise lands.
 *   - two concurrent callers asking for the same picture make ONE network call.
 *   - a Firebase Storage failure downgrades to a session-only data: URL. The
 *     caller still gets a usable image; only the sharing is lost.
 *   - the daily image cap is hit at most once per session: the first
 *     quota-exceeded stops every later attempt and toasts exactly one time.
 *
 * Load order: AFTER js/ai.js (it consumes MM.ai.promptHash / resolveModelWith)
 * and after firebase-storage-compat.js. Everything is feature-detected; with no
 * Firebase at all this still works as an in-memory cache plus generation.
 * ==========================================================================*/
(function () {
  'use strict';

  /* ==========================================================================
   * CONSTANTS
   * ======================================================================== */

  var CACHE_PATH   = 'imageCache';   // /imageCache/<promptHash>
  var STORAGE_ROOT = 'images';       // images/<feature>/<promptHash>.png
  var FALLBACK_SIZE = '512x512';
  var TIER_WAIT_MS = 8000;           // hard ceiling on "the tier is still resolving"

  // Which feature id each fixed set is generated under. Exported so the admin
  // pre-generate tool and the runtime callers file their spend the same way and
  // land on the same Storage path.
  var DRUG_FEATURE    = 'mnemonic';
  var PORTRAIT_FEATURE = 'image';

  // Retained data: URLs, for "Export as static bundle". Bounded, because a
  // 512x512 PNG is a few hundred KB of base64 and 55 of them is real memory.
  var MAX_MEM_DATA_URLS = 140;

  /* Paste-ready security rules. Surfaced in the admin UI (Spend -> Image cache)
   * and printed in the build report, because an unreadable /imageCache does not
   * fail loudly - it just silently makes every student pay again. */
  var RULES_SNIPPET = [
    '"imageCache": {',
    '  ".read":  "auth != null",',
    '  ".write": "auth != null && auth.token.email === \'codingky@gmail.com\'",',
    '  "$hash": {',
    '    ".write":    "auth != null && !data.exists()",',
    '    ".validate": "newData.hasChildren([\'url\',\'mime\',\'model\'])",',
    '    "hits": { ".write": "auth != null" }',
    '  }',
    '}'
  ].join('\n');

  /* The matching Cloud Storage rules. Different console, different file. */
  var STORAGE_RULES_SNIPPET = [
    'rules_version = \'2\';',
    'service firebase.storage {',
    '  match /b/{bucket}/o {',
    '    match /images/{feature}/{name} {',
    '      allow read: if true;',
    '      allow write: if request.auth != null',
    '                   && request.resource.size < 6 * 1024 * 1024',
    '                   && request.resource.contentType.matches(\'image/.*\');',
    '    }',
    '  }',
    '}'
  ].join('\n');

  /* ==========================================================================
   * SESSION STATE
   * ======================================================================== */

  var mem = {};          // promptHash -> entry
  var inflight = {};     // promptHash -> Promise (concurrency de-duplication)
  var dataUrls = {};     // promptHash -> 'data:image/png;base64,...'
  var dataUrlOrder = [];

  var stats = { hits: 0, misses: 0, generated: 0, bytes: 0, indexReads: 0, uploads: 0, uploadFailures: 0 };

  var session = {
    // Set by the first quota-exceeded{kind:'image'}. Everything after it skips
    // generation outright: the cap does not un-hit itself before midnight, so
    // re-asking is 20 more failed round trips and 20 more identical toasts.
    quotaBlocked: false,
    quotaToasted: false,
    // tier-denied / ai-disabled are equally permanent for this session, but they
    // are a plan boundary rather than something the student did, so no toast.
    hardBlocked: false,
    blockReason: ''
  };

  /* ==========================================================================
   * SMALL HELPERS  (everything feature-detected; nothing here may throw)
   * ======================================================================== */

  function mm() {
    if (!window.MM) window.MM = {};
    return window.MM;
  }

  function ai() {
    var m = mm();
    if (m.ai) return m.ai;
    if (window.MM_AI) return window.MM_AI;
    return null;
  }

  function toast(msg, type) {
    var m = mm();
    if (typeof m.toast === 'function') {
      try { m.toast(msg, type || 'info'); } catch (e) { /* a bad toast must not break an image */ }
    }
  }

  function db() {
    var m = mm();
    if (m.db) return m.db;
    try {
      if (window.firebase && window.firebase.apps && window.firebase.apps.length &&
          typeof window.firebase.database === 'function') {
        return window.firebase.database();
      }
    } catch (e) { /* noop */ }
    return null;
  }

  /**
   * Firebase Storage, or null. MM.storage is honoured first so the shell (and
   * the tests) can inject one. Storage is genuinely optional: without it the
   * module still generates and still serves, it just cannot share.
   */
  function storage() {
    var m = mm();
    if (m.storage) return m.storage;
    try {
      if (window.firebase && window.firebase.apps && window.firebase.apps.length &&
          typeof window.firebase.storage === 'function') {
        return window.firebase.storage();
      }
    } catch (e) { /* noop */ }
    return null;
  }

  function storageAvailable() { return !!storage(); }

  function uid() {
    var m = mm();
    if (m.authUser && m.authUser.uid) return m.authUser.uid;
    return '';
  }

  function isOwner() {
    var m = mm();
    var a = ai();
    var owner = (a && a.OWNER_EMAIL) ? a.OWNER_EMAIL : 'codingky@gmail.com';
    if (m.isSuperAdmin === true) return true;
    if (m.authUser && m.authUser.email) {
      return String(m.authUser.email).toLowerCase() === String(owner).toLowerCase();
    }
    return false;
  }

  function endpoint() {
    if (window.MM_AI_ENDPOINT) return window.MM_AI_ENDPOINT;
    var a = ai();
    if (a && typeof a.endpoint === 'function') {
      try { return a.endpoint(); } catch (e) { /* noop */ }
    }
    if (a && typeof a.ENDPOINT === 'string' && a.ENDPOINT) return a.ENDPOINT;
    return '/api/ai';
  }

  function defaultSize() {
    var a = ai();
    if (a && typeof a.DEFAULT_IMAGE_SIZE === 'string' && a.DEFAULT_IMAGE_SIZE) return a.DEFAULT_IMAGE_SIZE;
    return FALLBACK_SIZE;
  }

  function normFeature(f) {
    var s = String(f == null ? '' : f).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
    if (!s) return 'image';
    var a = ai();
    if (a && Array.isArray(a.KNOWN_FEATURES) && a.KNOWN_FEATURES.indexOf(s) === -1) return 'image';
    return s;
  }

  /**
   * The model this feature's image will actually be generated on.
   *
   * Deliberately mirrors the SERVER's resolution (resolveModelWith with the real
   * owner / allowModelChoice flags) rather than MM.ai.resolveModelFor, because
   * resolveModelFor also folds in the per-device model picker - a value the
   * server never sees for images, which would make our hash disagree with the
   * server's for no reason. When the two do disagree anyway, the server's
   * returned promptHash wins; see storeGenerated().
   */
  function resolveModel(feature, requested) {
    var a = ai();
    if (!a) return '';
    try {
      if (typeof a.resolveModelWith === 'function' && typeof a.getTierRules === 'function') {
        var tier = (typeof a.getTier === 'function') ? a.getTier() : 'free';
        var r = a.resolveModelWith(a.getTierRules(tier), feature, {
          requested: requested || '',
          isOwner: isOwner(),
          allowModelChoice: !!(typeof a.getConfig === 'function' && a.getConfig() &&
                               a.getConfig().allowModelChoice === true)
        });
        if (r && r.model) return r.model;
      }
      if (typeof a.resolveModelFor === 'function') return a.resolveModelFor(feature, { model: requested });
    } catch (e) { /* noop */ }
    return (a && a.DEFAULT_MODEL) ? a.DEFAULT_MODEL : '';
  }

  /** Never reimplemented here - the server's key and this key must be one algorithm. */
  function hashOf(prompt, model, size) {
    var a = ai();
    if (!a || typeof a.promptHash !== 'function') return '';
    try { return a.promptHash(prompt, model, size); } catch (e) { return ''; }
  }

  function b64Bytes(b64) {
    var s = String(b64 || '');
    if (!s) return 0;
    var pad = 0;
    if (s.charAt(s.length - 1) === '=') pad++;
    if (s.charAt(s.length - 2) === '=') pad++;
    return Math.max(0, Math.floor(s.length * 3 / 4) - pad);
  }

  function dataUrlOf(mime, b64) {
    return 'data:' + (mime || 'image/png') + ';base64,' + b64;
  }

  function rememberDataUrl(hash, url) {
    if (!hash || !url || String(url).indexOf('data:') !== 0) return;
    if (!dataUrls[hash]) dataUrlOrder.push(hash);
    dataUrls[hash] = url;
    while (dataUrlOrder.length > MAX_MEM_DATA_URLS) {
      var drop = dataUrlOrder.shift();
      if (drop !== hash) delete dataUrls[drop];
    }
  }

  function setError(e) {
    api.lastError = e || null;
    return e;
  }

  /* ==========================================================================
   * STEP 2 - THE STATIC BUNDLE
   * --------------------------------------------------------------------------
   * window.MM_STATIC_IMAGES is an optional map the repo may ship:
   *     window.MM_STATIC_IMAGES = { '<promptHash>': '<data: or /path URL>' }
   * Absent by default, and absence is normal - never an error. Produced by the
   * admin panel's "Export as static bundle" from exportStatic() below.
   * ======================================================================== */

  function staticLookup(hash) {
    var map = window.MM_STATIC_IMAGES;
    if (!map || typeof map !== 'object' || !hash) return null;
    var v = map[hash];
    if (typeof v !== 'string' || !v) return null;
    return v;
  }

  function mimeFromUrl(url, fallback) {
    var m = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,/i.exec(String(url || ''));
    if (m) return m[1].toLowerCase();
    if (/\.jpe?g($|\?)/i.test(String(url || ''))) return 'image/jpeg';
    if (/\.webp($|\?)/i.test(String(url || ''))) return 'image/webp';
    return fallback || 'image/png';
  }

  /* ==========================================================================
   * STEP 3 - THE SHARED FIREBASE INDEX
   * ======================================================================== */

  /** Read /imageCache/<hash>. Resolves with the record or null. Never rejects. */
  function readIndex(hash) {
    var d = db();
    if (!d || !hash) return Promise.resolve(null);
    stats.indexReads++;
    return new Promise(function (resolve) {
      var settled = false;
      function done(v) { if (!settled) { settled = true; resolve(v); } }
      try {
        d.ref(CACHE_PATH + '/' + hash).once('value').then(function (snap) {
          var val = null;
          try { val = snap && typeof snap.val === 'function' ? snap.val() : null; } catch (e) { val = null; }
          if (!val || typeof val !== 'object' || typeof val.url !== 'string' || !val.url) { done(null); return; }
          done(val);
        }, function (e) {
          // Almost always a missing rule (see RULES_SNIPPET). Not fatal: it just
          // means this student pays for a picture somebody already bought.
          setError(e);
          done(null);
        });
      } catch (e) { setError(e); done(null); }
    });
  }

  /** Write the index entry. Fire and forget - a failed write only costs sharing. */
  function writeIndex(hash, rec) {
    var d = db();
    if (!d || !hash) return Promise.resolve(false);
    return new Promise(function (resolve) {
      try {
        var p = d.ref(CACHE_PATH + '/' + hash).set(rec);
        if (p && typeof p.then === 'function') {
          p.then(function () { resolve(true); }, function (e) { setError(e); resolve(false); });
        } else { resolve(true); }
      } catch (e) { setError(e); resolve(false); }
    });
  }

  /**
   * Count a shared-cache hit on the entry itself. This is the only number that
   * can honestly answer "how much has the cache saved us", because it counts
   * hits across every student and every device, not just this tab.
   */
  function bumpHit(hash) {
    var d = db();
    if (!d || !hash) return;
    try {
      var inc = null;
      if (window.firebase && window.firebase.database && window.firebase.database.ServerValue &&
          typeof window.firebase.database.ServerValue.increment === 'function') {
        inc = window.firebase.database.ServerValue.increment(1);
      }
      if (inc === null) return;              // old SDK: skip rather than race a read-modify-write
      var p = d.ref(CACHE_PATH + '/' + hash + '/hits').set(inc);
      if (p && typeof p.catch === 'function') p.catch(function () { /* non-fatal */ });
    } catch (e) { /* non-fatal */ }
  }

  /* ==========================================================================
   * STEP 4 - GENERATE, THEN MAKE SURE NOBODY EVER PAYS FOR IT AGAIN
   * ======================================================================== */

  function whenTierReady() {
    var a = ai();
    if (!a || typeof a.isResolving !== 'function') return Promise.resolve();
    var resolving = false;
    try { resolving = a.isResolving() === true; } catch (e) { resolving = false; }
    if (!resolving) return Promise.resolve();
    if (typeof a.onResolved !== 'function') return Promise.resolve();
    return new Promise(function (resolve) {
      var done = false;
      var off = null;
      function finish() { if (done) return; done = true; try { if (off) off(); } catch (e) { /* noop */ } resolve(); }
      try { off = a.onResolved(finish); } catch (e) { finish(); return; }
      setTimeout(finish, TIER_WAIT_MS);
    });
  }

  function getIdToken() {
    var m = mm();
    if (!m.authUser || typeof m.authUser.getIdToken !== 'function') {
      var e = new Error('You need to be signed in for generated pictures.');
      e.code = 'no-auth';
      return Promise.reject(e);
    }
    return Promise.resolve().then(function () { return m.authUser.getIdToken(); })
      .then(function (tok) {
        if (!tok) { var e2 = new Error('no token'); e2.code = 'no-auth'; throw e2; }
        return tok;
      });
  }

  function errFromBody(status, text) {
    var data = null;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    var code = (data && typeof data.error === 'string') ? data.error
      : status === 401 ? 'no-auth'
      : status === 403 ? 'tier-denied'
      : status === 429 ? 'quota-exceeded'
      : status === 503 ? 'ai-disabled'
      : 'server';
    var a = ai();
    var friendly = (a && a.FRIENDLY && a.FRIENDLY[code]) ? a.FRIENDLY[code] : 'That picture could not be made.';
    var e = new Error((data && data.message) ? data.message : friendly);
    e.code = code;
    e.status = status;
    if (data) {
      if (typeof data.kind === 'string') e.kind = data.kind;
      if (typeof data.limit === 'number') e.limit = data.limit;
      if (typeof data.used === 'number') e.used = data.used;
      if (typeof data.resetsAt === 'number') e.resetsAt = data.resetsAt;
      if (typeof data.reason === 'string') e.reason = data.reason;
      if (typeof data.model === 'string') e.model = data.model;
      if (typeof data.feature === 'string') e.feature = data.feature;
    }
    return e;
  }

  /**
   * The daily image cap, handled exactly once per session.
   *
   * Twelve mnemonic tiles rendering at once used to mean twelve identical "you
   * are out of images" toasts and twelve pointless round trips. The first one
   * closes the door for the session.
   */
  function handleQuota(e) {
    if (!e || e.code !== 'quota-exceeded') return false;
    if (e.kind && e.kind !== 'image') return false;   // the TEXT cap - not ours to swallow
    session.quotaBlocked = true;
    if (!session.quotaToasted) {
      session.quotaToasted = true;
      var msg = e.limit === 0
        ? 'Generated pictures are not part of your plan. Everything else here still works.'
        : 'That is all of today\'s AI pictures (' + (e.limit || 'the daily limit') +
          ' a day, separate from your AI messages). They reset at midnight Eastern - the rest of the app is unaffected.';
      toast(msg, 'info');
    }
    return true;
  }

  function generationBlocked() {
    return session.quotaBlocked || session.hardBlocked;
  }

  /** POST /api/ai generateImage. Resolves with the parsed body, or rejects. */
  function callGenerate(prompt, feature, size, requestedModel) {
    return whenTierReady().then(getIdToken).then(function (tok) {
      var body = {
        action: 'generateImage',
        idToken: tok,
        feature: feature,
        prompt: prompt,
        size: size
      };
      // Only sent when the CALLER named one. Sending our locally-resolved model
      // would be a no-op for students (the server ignores it) and would change
      // the owner's routing behind their back.
      if (requestedModel) body.model = requestedModel;
      return fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }).then(function (res) {
      return Promise.resolve(res.text()).then(function (text) {
        if (!res.ok) throw errFromBody(res.status, text);
        var data = null;
        try { data = JSON.parse(text); } catch (e) { data = null; }
        if (!data || data.ok !== true || typeof data.b64 !== 'string' || !data.b64) {
          var e2 = new Error('The image service returned nothing usable.');
          e2.code = 'server';
          throw e2;
        }
        return data;
      });
    }, function (e) {
      if (e && e.code) throw e;
      var ne = new Error('Could not reach the image service.');
      ne.code = 'network';
      throw ne;
    });
  }

  /** Upload to images/<feature>/<hash>.png. Resolves {url, path} or null. Never rejects. */
  function upload(hash, feature, b64, mime) {
    var s = storage();
    if (!s || !hash) return Promise.resolve(null);
    var path = STORAGE_ROOT + '/' + feature + '/' + hash + '.png';
    return new Promise(function (resolve) {
      var settled = false;
      function done(v) { if (!settled) { settled = true; resolve(v); } }
      try {
        var ref = s.ref(path);
        Promise.resolve(ref.putString(b64, 'base64', { contentType: mime || 'image/png' }))
          .then(function () { return ref.getDownloadURL(); })
          .then(function (url) {
            if (typeof url !== 'string' || !url) { stats.uploadFailures++; done(null); return; }
            stats.uploads++;
            done({ url: url, path: path });
          }, function (e) {
            // The single most important catch in this file. A Storage rule that
            // is not deployed yet, a bucket that does not exist, an offline
            // phone - none of those may reach the feature that asked for a
            // picture. It gets the data: URL and never knows.
            stats.uploadFailures++;
            setError(e);
            done(null);
          });
      } catch (e) {
        stats.uploadFailures++;
        setError(e);
        done(null);
      }
    });
  }

  /**
   * Everything after a successful generate: upload, publish the index entry,
   * and build the entry the caller gets. Any failure downgrades cleanly to the
   * session-only data: URL.
   */
  function storeGenerated(localHash, feature, size, data) {
    // The server's promptHash is authoritative - it was computed from the model
    // the server actually used. When the two differ (a per-device model choice,
    // a config that changed mid-session) the shared index must be keyed by the
    // server's, or the next student misses a cache entry that exists.
    var hash = (typeof data.promptHash === 'string' && data.promptHash) ? data.promptHash : localHash;
    var mime = (typeof data.mime === 'string' && data.mime) ? data.mime : 'image/png';
    var model = (typeof data.model === 'string' && data.model) ? data.model : '';
    var bytes = b64Bytes(data.b64);
    var dUrl = dataUrlOf(mime, data.b64);

    stats.generated++;
    stats.bytes += bytes;
    rememberDataUrl(hash, dUrl);
    if (localHash && localHash !== hash) rememberDataUrl(localHash, dUrl);

    return upload(hash, feature, data.b64, mime).then(function (up) {
      var entry = {
        url: up ? up.url : dUrl,
        source: 'generated',
        mime: mime,
        cached: false,
        shared: !!up,
        hash: hash,
        model: model,
        size: size,
        feature: feature,
        bytes: bytes,
        cost: (typeof data.cost === 'number' && isFinite(data.cost)) ? data.cost : 0,
        dataUrl: dUrl
      };
      if (!up) {
        // Usable image, session only. Say so on the entry rather than in a
        // toast; the student did not do anything and cannot fix it.
        entry.note = 'storage-unavailable';
        remember(hash, entry);
        if (localHash && localHash !== hash) remember(localHash, entry);
        return entry;
      }
      var rec = {
        url: up.url,
        mime: mime,
        feature: feature,
        model: model,
        size: size,
        bytes: bytes,
        path: up.path,
        hits: 0,
        createdAt: Date.now(),
        createdBy: uid() || 'anon'
      };
      return writeIndex(hash, rec).then(function () {
        remember(hash, entry);
        if (localHash && localHash !== hash) remember(localHash, entry);
        return entry;
      });
    });
  }

  function remember(hash, entry) {
    if (!hash || !entry) return;
    mem[hash] = entry;
  }

  function fromIndex(hash, rec, feature, size) {
    var entry = {
      url: rec.url,
      source: 'index',
      mime: (typeof rec.mime === 'string' && rec.mime) ? rec.mime : mimeFromUrl(rec.url),
      cached: true,
      shared: true,
      hash: hash,
      model: typeof rec.model === 'string' ? rec.model : '',
      size: typeof rec.size === 'string' ? rec.size : size,
      feature: typeof rec.feature === 'string' ? rec.feature : feature,
      bytes: typeof rec.bytes === 'number' ? rec.bytes : 0,
      cost: 0,
      createdBy: typeof rec.createdBy === 'string' ? rec.createdBy : '',
      createdAt: typeof rec.createdAt === 'number' ? rec.createdAt : 0
    };
    return entry;
  }

  /* ==========================================================================
   * PUBLIC: get()
   * ======================================================================== */

  /**
   * MM.images.get({ prompt, feature, size, model, allowGenerate })
   *   -> Promise<{ url, source, mime, cached, ... } | null>
   *
   * source: 'memory' | 'static' | 'index' | 'generated'
   * cached: true when it came out of a cache rather than off the wire.
   * NEVER rejects. null means "no picture" - render the placeholder and move on.
   */
  function get(opts) {
    var o = opts || {};
    var prompt = String(o.prompt == null ? '' : o.prompt);
    if (!prompt.trim()) return Promise.resolve(null);

    var feature = normFeature(o.feature);
    var size = (typeof o.size === 'string' && o.size) ? o.size : defaultSize();
    var model = o.model ? String(o.model) : resolveModel(feature, '');
    var hash = hashOf(prompt, model, size);
    var allowGenerate = o.allowGenerate !== false;

    if (!hash) {
      // No MM.ai means no shared key, which means no cache. Refuse rather than
      // generate: an uncacheable image is exactly the thing this file exists to
      // prevent, and js/ai.js not being loaded is a build error, not a runtime
      // condition to paper over.
      setError(new Error('MM.ai.promptHash is unavailable, so images cannot be cached or generated.'));
      return Promise.resolve(null);
    }

    /* --- 1. this page session ------------------------------------------- */
    if (mem[hash]) {
      stats.hits++;
      var hit = mem[hash];
      var copy = {};
      for (var k in hit) { if (Object.prototype.hasOwnProperty.call(hit, k)) copy[k] = hit[k]; }
      copy.source = 'memory';
      copy.cached = true;
      return Promise.resolve(copy);
    }

    /* --- 2. the bundled static set (zero network of any kind) ------------ */
    var stat = staticLookup(hash);
    if (stat) {
      var sEntry = {
        url: stat, source: 'static', mime: mimeFromUrl(stat), cached: true, shared: true,
        hash: hash, model: model, size: size, feature: feature, bytes: 0, cost: 0
      };
      stats.hits++;
      remember(hash, sEntry);
      rememberDataUrl(hash, stat);
      return Promise.resolve(sEntry);
    }

    /* --- de-duplicate concurrent callers --------------------------------- */
    if (inflight[hash]) return inflight[hash];

    var p = readIndex(hash).then(function (rec) {
      /* --- 3. the shared index across every student --------------------- */
      if (rec) {
        var entry = fromIndex(hash, rec, feature, size);
        stats.hits++;
        stats.bytes += entry.bytes;
        remember(hash, entry);
        bumpHit(hash);
        return entry;
      }

      stats.misses++;

      /* --- 4. pay for it, once, for everybody --------------------------- */
      if (!allowGenerate) return null;
      if (generationBlocked()) return null;

      return callGenerate(prompt, feature, size, o.model ? String(o.model) : '')
        .then(function (data) { return storeGenerated(hash, feature, size, data); })
        .catch(function (e) {
          setError(e);
          if (!handleQuota(e)) {
            if (e && (e.code === 'tier-denied' || e.code === 'ai-disabled')) {
              // A plan boundary or a site-wide switch. Neither changes before a
              // reload, so stop asking; and neither is the student's doing, so
              // no toast - the feature shows its own placeholder.
              session.hardBlocked = true;
              session.blockReason = e.code;
            }
          }
          return null;
        });
    }).catch(function (e) {
      setError(e);
      return null;
    });

    // Clear the de-dup slot on BOTH paths, and only after the value is settled,
    // so a second caller arriving one tick later still joins this call.
    inflight[hash] = p.then(function (v) {
      delete inflight[hash];
      return v;
    }, function (e) {
      delete inflight[hash];
      setError(e);
      return null;
    });
    return inflight[hash];
  }

  /* ==========================================================================
   * PUBLIC: peek / preload / lookup / stats
   * ======================================================================== */

  /**
   * MM.images.peek({ prompt, model, size }) -> entry | null
   * Synchronous, no network of any kind. Memory and the static bundle only -
   * for render paths that must decide "placeholder or picture" before paint.
   */
  function peek(opts) {
    var o = opts || {};
    var prompt = String(o.prompt == null ? '' : o.prompt);
    if (!prompt.trim()) return null;
    var feature = normFeature(o.feature);
    var size = (typeof o.size === 'string' && o.size) ? o.size : defaultSize();
    var model = o.model ? String(o.model) : resolveModel(feature, '');
    var hash = hashOf(prompt, model, size);
    if (!hash) return null;
    if (mem[hash]) return mem[hash];
    var stat = staticLookup(hash);
    if (!stat) return null;
    return {
      url: stat, source: 'static', mime: mimeFromUrl(stat), cached: true, shared: true,
      hash: hash, model: model, size: size, feature: feature, bytes: 0, cost: 0
    };
  }

  /** Cache-only lookup that IS allowed to touch the index. Never generates. */
  function lookup(opts) {
    var o = {};
    for (var k in (opts || {})) {
      if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    }
    o.allowGenerate = false;
    return get(o);
  }

  /**
   * MM.images.preload([{prompt, feature, size, allowGenerate}, ...])
   *
   * Cache lookups all go at once (they are reads and cheap). Anything that
   * would have to be GENERATED is done strictly one at a time afterwards -
   * firing 37 image generations in parallel is how you spend a month's budget
   * in nine seconds.
   */
  function preload(list) {
    var items = Array.isArray(list) ? list : [];
    if (!items.length) return Promise.resolve([]);
    var results = new Array(items.length);
    var needGen = [];

    return Promise.all(items.map(function (it, i) {
      var o = it || {};
      return lookup(o).then(function (entry) {
        results[i] = entry;
        if (!entry && o.allowGenerate !== false) needGen.push(i);
      });
    })).then(function () {
      var idx = 0;
      function next() {
        if (idx >= needGen.length) return Promise.resolve();
        var i = needGen[idx++];
        if (generationBlocked()) { return Promise.resolve(); }
        return get(items[i]).then(function (entry) {
          results[i] = entry;
          return next();
        });
      }
      return next();
    }).then(function () { return results; });
  }

  function statsSnapshot() {
    return {
      hits: stats.hits,
      misses: stats.misses,
      generated: stats.generated,
      bytes: stats.bytes,
      indexReads: stats.indexReads,
      uploads: stats.uploads,
      uploadFailures: stats.uploadFailures,
      quotaBlocked: session.quotaBlocked,
      hardBlocked: session.hardBlocked,
      blockReason: session.blockReason,
      memory: Object.keys(mem).length
    };
  }

  function isAvailable() {
    var a = ai();
    return !!(a && typeof a.promptHash === 'function');
  }

  /* ==========================================================================
   * PROMPT TEMPLATES
   * --------------------------------------------------------------------------
   * These live HERE, not in the admin panel and not in the feature that renders
   * them, because the prompt IS the cache key. One character of drift between
   * the pre-generate tool and the runtime caller and the whole fixed set is
   * paid for twice. Every consumer calls these functions; nobody writes their
   * own string.
   * ======================================================================== */

  function firstSentence(s, max) {
    var t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    var cut = t.search(/[.;—]\s/);
    if (cut > 20) t = t.slice(0, cut);
    var lim = max || 180;
    if (t.length > lim) t = t.slice(0, lim).replace(/\s+\S*$/, '');
    return t.replace(/[.,;\s]+$/, '');
  }

  /**
   * MM.images.drugMnemonicPrompt(drug) -> string
   *
   * One absurd picture, one subject, tied to the mechanism or the side effect
   * that actually gets tested. No text in the image: generated lettering is
   * unreliable and a misspelled drug name on a memory aid is worse than none.
   */
  function drugMnemonicPrompt(drug) {
    var d = drug || {};
    var name = String(d.generic || d.name || d.id || '').trim();
    if (!name) return '';
    var cls = firstSentence(d.classification, 90);
    var mech = firstSentence(d.use, 150);
    var se = '';
    if (Array.isArray(d.sideEffects) && d.sideEffects.length) se = firstSentence(d.sideEffects[0], 80);

    var hook = [];
    if (mech) hook.push('what it does: ' + mech);
    if (se) hook.push('its hallmark side effect: ' + se);

    return [
      'A single-subject mnemonic illustration for a nursing student, built as a visual pun.',
      'Drug name: ' + name + '.' + (cls ? ' Drug class: ' + cls + '.' : ''),
      'Make one memorable, absurd, slightly ridiculous image that links the SOUND of the name "' + name +
        '" to ' + (hook.length ? hook.join(', and ') : 'what the drug does') + '.',
      'Exactly one subject, centred, filling the frame, on a plain flat background.',
      'Bold simple shapes, high contrast, clean cartoon illustration style, friendly and memorable.',
      'No text, no words, no letters, no numbers, no logos, no watermarks.',
      'Nothing gory, nothing frightening, nothing that mocks a patient - classroom safe.'
    ].join(' ');
  }

  function ageWords(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return { text: 'adult', years: 30 };
    var m = /(\d+)\s*(year|yr|month|mo|week|wk|day)/i.exec(s);
    if (!m) {
      var bare = /(\d+)/.exec(s);
      if (bare) return { text: bare[1] + '-year-old', years: parseInt(bare[1], 10) };
      return { text: s.toLowerCase(), years: 30 };
    }
    var n = parseInt(m[1], 10);
    var unit = m[2].toLowerCase();
    if (unit.indexOf('year') === 0 || unit === 'yr') return { text: n + '-year-old', years: n };
    if (unit.indexOf('month') === 0 || unit === 'mo') return { text: n + '-month-old', years: n / 12 };
    if (unit.indexOf('week') === 0 || unit === 'wk') return { text: n + '-week-old', years: n / 52 };
    return { text: n + '-day-old', years: n / 365 };
  }

  function personWord(sex, years) {
    var s = String(sex == null ? '' : sex).toLowerCase();
    var male = s.indexOf('m') === 0;
    var female = s.indexOf('f') === 0;
    if (years < 1) return male ? 'baby boy' : female ? 'baby girl' : 'infant';
    if (years < 13) return male ? 'boy' : female ? 'girl' : 'child';
    if (years < 18) return male ? 'teenage boy' : female ? 'teenage girl' : 'teenager';
    return male ? 'man' : female ? 'woman' : 'adult';
  }

  /**
   * MM.images.patientPortraitPrompt(scenario) -> string
   *
   * A clinical photograph of THIS scenario's patient: age, sex, condition and
   * setting, and nothing else.
   *
   * The patient's NAME is deliberately never in the prompt. Names steer image
   * models toward real people, and the one thing a patient portrait in a study
   * app must never be is a recognisable human being who did not consent to it.
   * The prompt says so explicitly as well, because the negative instruction is
   * cheap and the failure mode is not.
   */
  function patientPortraitPrompt(scenario) {
    var s = scenario || {};
    var p = s.patient || {};
    var age = ageWords(p.age);
    var who = personWord(p.sex, age.years);
    var dx = firstSentence(p.diagnosis || s.fullTitle || s.title, 120);
    var unit = firstSentence(p.unit, 40);

    return [
      'A clinical photograph of a patient, for a nursing school case study.',
      'Subject: a completely fictional ' + age.text + ' ' + who +
        (dx ? ', in hospital being treated for ' + dx : ', in hospital') + '.',
      unit ? 'Setting: a ' + unit + ' room.' : 'Setting: a hospital room.',
      'Framing: waist-up, lying or sitting in a hospital bed in a hospital gown, facing the camera,',
      'even clinical lighting, ordinary monitoring equipment blurred in the background.',
      'The face and body language should read as somebody who is unwell in a way consistent with that condition, and no more than that.',
      'The person must be entirely invented and unremarkable: do NOT depict, imitate or resemble any real, famous, public or identifiable person,',
      'do not reproduce any recognisable face, and include no names, no text, no signage, no badges and no watermarks.',
      'Respectful and non-graphic: no wounds, no blood, no exposed body, nothing distressing.'
    ].join(' ');
  }

  /* ==========================================================================
   * THE TWO FIXED SETS
   * --------------------------------------------------------------------------
   * 37 drug mnemonics + 18 patient portraits = the entire image budget of this
   * app, forever, if they are generated once and exported into the repo. The
   * admin pre-generate tool walks exactly this list.
   * ======================================================================== */

  function fixedSets() {
    var out = { drugs: [], portraits: [] };
    var size = defaultSize();
    var i, prompt;

    var drugs = Array.isArray(window.MEDADMIN_DRUGS) ? window.MEDADMIN_DRUGS : [];
    for (i = 0; i < drugs.length; i++) {
      prompt = drugMnemonicPrompt(drugs[i]);
      if (!prompt) continue;
      out.drugs.push({
        kind: 'drug',
        id: String(drugs[i].id || drugs[i].generic || ('drug-' + i)),
        label: String(drugs[i].generic || drugs[i].id || ('Drug ' + (i + 1))),
        feature: DRUG_FEATURE,
        size: size,
        prompt: prompt
      });
    }

    var scen = Array.isArray(window.ALL_SCENARIOS) ? window.ALL_SCENARIOS : [];
    for (i = 0; i < scen.length; i++) {
      prompt = patientPortraitPrompt(scen[i]);
      if (!prompt) continue;
      out.portraits.push({
        kind: 'portrait',
        id: String(scen[i].id || ('sim-' + i)),
        label: String(scen[i].title || scen[i].id || ('Scenario ' + (i + 1))),
        feature: PORTRAIT_FEATURE,
        size: size,
        prompt: prompt
      });
    }
    return out;
  }

  /** Every fixed item as one flat list, with its cache key already computed. */
  function fixedList() {
    var sets = fixedSets();
    var all = sets.drugs.concat(sets.portraits);
    for (var i = 0; i < all.length; i++) {
      all[i].model = resolveModel(all[i].feature, '');
      all[i].hash = hashOf(all[i].prompt, all[i].model, all[i].size);
    }
    return all;
  }

  /* ==========================================================================
   * ADMIN SURFACE  (owner-only tooling; nothing here runs for a student)
   * ======================================================================== */

  /** Read the whole shared index. Resolves {ok, entries:{hash:rec}, error}. */
  function listCache() {
    var d = db();
    if (!d) return Promise.resolve({ ok: false, entries: {}, error: 'Firebase is not connected.' });
    return new Promise(function (resolve) {
      try {
        d.ref(CACHE_PATH).once('value').then(function (snap) {
          var v = null;
          try { v = snap && typeof snap.val === 'function' ? snap.val() : null; } catch (e) { v = null; }
          resolve({ ok: true, entries: (v && typeof v === 'object') ? v : {}, error: '' });
        }, function (e) {
          resolve({ ok: false, entries: {}, error: (e && e.message) ? e.message : 'permission denied' });
        });
      } catch (e) {
        resolve({ ok: false, entries: {}, error: (e && e.message) ? e.message : 'permission denied' });
      }
    });
  }

  /**
   * Delete every stored object we know a path for, then drop the whole index.
   * Storage deletes are best effort and reported, never fatal: an orphaned blob
   * costs pennies of storage, whereas a half-deleted index that still points at
   * dead URLs is broken images for every student.
   */
  function clearCache() {
    var d = db();
    var s = storage();
    return listCache().then(function (res) {
      var entries = res.entries || {};
      var paths = [];
      for (var h in entries) {
        if (!Object.prototype.hasOwnProperty.call(entries, h)) continue;
        var rec = entries[h];
        if (rec && typeof rec.path === 'string' && rec.path) paths.push(rec.path);
      }
      var failed = 0;
      function delNext(i) {
        if (!s || i >= paths.length) return Promise.resolve();
        return new Promise(function (resolve) {
          try {
            Promise.resolve(s.ref(paths[i]).delete()).then(function () { resolve(); },
              function () { failed++; resolve(); });
          } catch (e) { failed++; resolve(); }
        }).then(function () { return delNext(i + 1); });
      }
      return delNext(0).then(function () {
        if (!d) return { ok: false, removed: 0, storageFailed: failed, error: 'Firebase is not connected.' };
        return new Promise(function (resolve) {
          try {
            Promise.resolve(d.ref(CACHE_PATH).remove()).then(function () {
              mem = {};
              dataUrls = {};
              dataUrlOrder = [];
              resolve({ ok: true, removed: paths.length, storageFailed: failed, error: '' });
            }, function (e) {
              resolve({ ok: false, removed: 0, storageFailed: failed,
                error: (e && e.message) ? e.message : 'permission denied' });
            });
          } catch (e) {
            resolve({ ok: false, removed: 0, storageFailed: failed,
              error: (e && e.message) ? e.message : 'permission denied' });
          }
        });
      });
    });
  }

  /**
   * A data: URL for one hash, for the static bundle export. Uses the copy kept
   * in memory when we generated it; otherwise fetches the stored image and
   * converts. Resolves null rather than rejecting.
   */
  function dataUrlFor(hash, url) {
    if (dataUrls[hash]) return Promise.resolve(dataUrls[hash]);
    var src = url || (mem[hash] && mem[hash].url) || '';
    if (!src) return Promise.resolve(null);
    if (String(src).indexOf('data:') === 0) { rememberDataUrl(hash, src); return Promise.resolve(src); }
    if (typeof fetch !== 'function') return Promise.resolve(null);
    return fetch(src).then(function (r) {
      if (!r.ok) return null;
      return r.blob();
    }).then(function (blob) {
      if (!blob) return null;
      if (typeof FileReader !== 'function') return null;
      return new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () {
          var v = String(fr.result || '');
          if (v.indexOf('data:') === 0) { rememberDataUrl(hash, v); resolve(v); } else resolve(null);
        };
        fr.onerror = function () { resolve(null); };
        try { fr.readAsDataURL(blob); } catch (e) { resolve(null); }
      });
    }).catch(function (e) { setError(e); return null; });
  }

  /**
   * Build the text of a drop-in JS file:
   *     window.MM_STATIC_IMAGES = { "<promptHash>": "<dataURL>", ... };
   * Saved into the repo and loaded before js/images.js, it turns step 2 of the
   * lookup order into a permanent hit: those pictures are then free for every
   * student forever, with no Firebase read and no generation, ever again.
   *
   * items: [{hash, url, label}]. onProgress(done, total, label) is optional.
   */
  function exportStatic(items, onProgress) {
    var list = Array.isArray(items) ? items : [];
    var map = {};
    var skipped = [];
    var i = 0;

    function step() {
      if (i >= list.length) return Promise.resolve();
      var it = list[i++] || {};
      if (typeof onProgress === 'function') {
        try { onProgress(i, list.length, it.label || it.hash || ''); } catch (e) { /* noop */ }
      }
      if (!it.hash) return step();
      return dataUrlFor(it.hash, it.url).then(function (d) {
        if (d) map[it.hash] = d; else skipped.push(it.label || it.hash);
        return step();
      });
    }

    return step().then(function () {
      var keys = Object.keys(map);
      var lines = [
        '/* MedMaster static image bundle - generated ' + new Date().toISOString() + '',
        ' *',
        ' * ' + keys.length + ' image' + (keys.length === 1 ? '' : 's') + ', keyed by MM.ai.promptHash(prompt, model, size).',
        ' *',
        ' * Drop this file in the repo and load it BEFORE js/images.js:',
        ' *   <script src="data/static-images.js"></script>',
        ' *',
        ' * Every hash in here is step 2 of the image lookup order, which means it',
        ' * costs nothing: no generation, no Firebase read, no Storage download, for',
        ' * anybody, ever. If a prompt template, the routed model, or the image size',
        ' * changes, the hash changes and these entries simply stop matching - they',
        ' * are never wrong, only unused. Re-export from Admin -> AI -> Routing.',
        ' */',
        'window.MM_STATIC_IMAGES = {'
      ];
      for (var j = 0; j < keys.length; j++) {
        lines.push('  ' + JSON.stringify(keys[j]) + ': ' + JSON.stringify(map[keys[j]]) +
          (j < keys.length - 1 ? ',' : ''));
      }
      lines.push('};');
      lines.push('');
      return { text: lines.join('\n'), count: keys.length, skipped: skipped };
    });
  }

  /** Session reset, for the admin panel after a config change. Never clears Firebase. */
  function resetSession() {
    mem = {};
    inflight = {};
    session.quotaBlocked = false;
    session.quotaToasted = false;
    session.hardBlocked = false;
    session.blockReason = '';
    stats.hits = 0; stats.misses = 0; stats.generated = 0; stats.bytes = 0;
    stats.indexReads = 0; stats.uploads = 0; stats.uploadFailures = 0;
    api.lastError = null;
  }

  /* ==========================================================================
   * EXPORT
   * ======================================================================== */

  var api = {
    // --- the contract surface ---
    get: get,
    peek: peek,
    preload: preload,
    stats: statsSnapshot,
    isAvailable: isAvailable,
    lastError: null,

    // --- cache-only lookup (index included, generation never) ---
    lookup: lookup,

    // --- prompt templates: the cache key, so nobody may hand-roll one ---
    drugMnemonicPrompt: drugMnemonicPrompt,
    patientPortraitPrompt: patientPortraitPrompt,
    fixedSets: fixedSets,
    fixedList: fixedList,

    // --- admin tooling ---
    listCache: listCache,
    clearCache: clearCache,
    dataUrlFor: dataUrlFor,
    exportStatic: exportStatic,
    resetSession: resetSession,

    // --- introspection ---
    hashFor: function (o) {
      var opt = o || {};
      var feature = normFeature(opt.feature);
      var size = (typeof opt.size === 'string' && opt.size) ? opt.size : defaultSize();
      var model = opt.model ? String(opt.model) : resolveModel(feature, '');
      return hashOf(String(opt.prompt == null ? '' : opt.prompt), model, size);
    },
    modelFor: function (feature) { return resolveModel(normFeature(feature), ''); },
    storageAvailable: storageAvailable,
    isBlocked: generationBlocked,
    CACHE_PATH: CACHE_PATH,
    STORAGE_ROOT: STORAGE_ROOT,
    DRUG_FEATURE: DRUG_FEATURE,
    PORTRAIT_FEATURE: PORTRAIT_FEATURE,
    RULES_SNIPPET: RULES_SNIPPET,
    STORAGE_RULES_SNIPPET: STORAGE_RULES_SNIPPET
  };

  mm().images = api;
  window.MM_IMAGES = api;
})();
