'use strict';
/* ============================================================================
 * MedMaster ElevenLabs proxy  —  netlify/functions/tts.js
 * ----------------------------------------------------------------------------
 * Keeps ELEVENLABS_API_KEY on the server. The browser never sees it.
 *
 * This file is a deliberate mirror of netlify/functions/ai.js: same token
 * verification, same RTDB helpers, same fail() shape and error codes, same
 * spend-ledger discipline. Where the two differ it is only because the unit of
 * account differs — ai.js meters MESSAGES and dollars reported by OpenRouter,
 * this file meters CHARACTERS and dollars ESTIMATED from them, because
 * ElevenLabs bills per character and does not return a per-request price.
 *
 * Three actions, all POST /api/tts:
 *
 *   { action:'speak', idToken, text, profile, voiceId?, modelId? }
 *     -> { ok, b64, mime:'audio/mpeg', voiceId, modelId, chars, cost, ... }
 *     Returns BASE64 rather than a stream so the client can cache and upload it
 *     exactly the way js/images.js caches a generated picture. That is the whole
 *     economic argument for this feature: one student pays for a line once and
 *     every other student on earth reads it out of Firebase for free.
 *
 *   { action:'listVoices', idToken }   OWNER ONLY
 *     Proxies GET /v1/voices, trimmed to what the admin picker needs, cached in
 *     module memory for ten minutes so the panel cannot hammer ElevenLabs.
 *
 *   { action:'quota', idToken }        OWNER ONLY
 *     Proxies GET /v1/user/subscription -> characters used / limit / reset date.
 *
 * WHO IS THE OWNER
 *   OWNER_EMAIL *and* a verified email claim. `email` on a Firebase ID token is
 *   only as trustworthy as the sign-in provider that put it there, so the
 *   `email_verified` flag is load-bearing everywhere the owner is granted
 *   something — see isOwnerUser() below. ai.js applies the identical rule.
 *
 * ERROR CODES  (the documented set five client modules branch on; unchanged)
 *   no-auth | tier-denied | quota-exceeded | ai-disabled | network | server
 *   Machine-readable `reason` values that ride along with them:
 *     elevenlabs-quota | bad-key | bad-voice | bad-voice-or-model |
 *     upstream-rate-limit | provider-down | bad-request | too-long |
 *     no-voice-configured | browser-voice-plan | spend-cap | voice-disabled |
 *     not-configured | empty-audio |
 *     not-audio     (502/server: upstream 200 whose content-type is not audio/*;
 *                    NEVER relabelled, because the client caches what it is given
 *                    into shared Firebase Storage)
 *     quota-race    (429/quota-exceeded: the atomic reservation overshot the
 *                    daily character cap — see "RESERVE THEN SPEND" below)
 *
 * WHO MAY CALL speak
 *   Only `pro` and `instructor` (the owner is always allowed). Everyone else
 *   gets `tier-denied` with a message that says, in as many words, that browser
 *   voices are what their plan uses and that this is NOT an error. The client
 *   treats a tier-denied as "use the browser voice" and never shows it.
 *
 * QUOTAS AND MONEY
 *   /voiceUsage/<uid>/<YYYY-MM-DD>      characters this student spent today
 *   /voiceSpend/<YYYY-MM-DD>/...        site-wide ledger (see below)
 *   aiConfig.voiceLimits[tier]          characters/day. -1 unlimited, 0 = not
 *                                       in this plan. Defaults: free 0, plus 0,
 *                                       pro 20000, instructor -1.
 *   aiConfig.enabled                    the existing global kill switch
 *   aiConfig.softCapUsd / capMode       the existing daily dollar ceiling
 *
 *   SPEND LEDGER  —  money is INTEGER MICRODOLLARS, exactly as in ai.js, because
 *   RTDB's atomic {'.sv':{increment:n}} is exact for integers and lossy for
 *   floats:
 *     /voiceSpend/<day>/total6                  microdollars, site-wide
 *     /voiceSpend/<day>/chars                   characters, site-wide
 *     /voiceSpend/<day>/calls                   billed calls
 *     /voiceSpend/<day>/byProfile/<p>/{usd6,chars}
 *     /voiceSpend/<day>/byUser/<uid>/{usd6,chars,n}
 *   Written with ONE multi-path PATCH. Every write here is best-effort: a failed
 *   ledger write must never cost a student their audio.
 *
 *   RESERVE THEN SPEND  —  the daily character cap is enforced by INCREMENTING
 *   /voiceUsage/<uid>/<day> BEFORE the ElevenLabs call and reading the value the
 *   increment returned, not by reading first and writing after. A read-then-write
 *   gate is a TOCTOU hole: N parallel tabs all read the same stale total and all
 *   pass, so the cap multiplies by N. See reserveCharacters() in handleSpeak.
 *
 *   SPEND is recorded separately from QUOTA and asks a different question:
 *   "did ElevenLabs bill us" (spend) versus "how much of today's allowance has
 *   this student used" (quota). A 200 with an unusable body still cost money and
 *   is still recorded to /voiceSpend; a 4xx did not, and the reservation is
 *   handed back.
 *
 * ELEVENLABS FACTS THIS FILE DEPENDS ON (verified against their docs):
 *   POST /v1/text-to-speech/{voice_id}   header xi-api-key, body
 *        { text, model_id, voice_settings? }, returns audio/mpeg
 *   GET  /v1/voices                      the voice catalog
 *   GET  /v1/user/subscription           character_count / character_limit
 *   eleven_flash_v2_5        ~75ms, cheapest, 32 languages, 40k char limit
 *   eleven_turbo_v2_5        ~250-300ms, balanced,          40k char limit
 *   eleven_multilingual_v2   highest quality,               10k char limit
 *
 *   *** Flash v2.5 DISABLES number normalization to save latency. ***
 *   ElevenLabs' own guidance is to normalize the text yourself before sending.
 *   This app is nothing but vitals and doses, so the client runs every line
 *   through MM.voice.normalizeClinicalForTTS() first and this function asks for
 *   apply_text_normalization:'off' to stop the two fighting each other. If a
 *   model rejects that parameter the request is retried once without it, the
 *   same way ai.js retries once without response_format.
 *
 * Environment variables (Netlify -> Site settings -> Environment variables):
 *   ELEVENLABS_API_KEY   (required)  key permissions: Text to Speech, Voices
 *                                    (read), Models, User
 *   FIREBASE_DB_URL      (required)  https://<project>-default-rtdb.firebaseio.com
 *   FIREBASE_PROJECT_ID  (optional)  derived from the DB URL when absent
 *   FIREBASE_DB_SECRET   (optional)  legacy DB secret. Without it the caller's
 *                                    own ID token is forwarded to the RTDB REST
 *                                    API and security rules apply — which means
 *                                    /voiceSpend (".write": false) is only
 *                                    written when the secret IS set. That is a
 *                                    missing analytic, never a broken feature.
 *
 * No dependencies — Node 18 globals (fetch, AbortController) and node:crypto.
 * ==========================================================================*/

var crypto = require('crypto');

/* ------------------------------------------------------------------ config */

var OWNER_EMAIL       = 'codingky@gmail.com';
var ELEVEN_BASE       = 'https://api.elevenlabs.io/v1';
var ELEVEN_TTS_URL    = ELEVEN_BASE + '/text-to-speech/';
var ELEVEN_VOICES_URL = ELEVEN_BASE + '/voices';
var ELEVEN_SUB_URL    = ELEVEN_BASE + '/user/subscription';

var GOOGLE_CERT_URLS = [
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
  'https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com'
];

var QUOTA_TZ           = 'America/New_York';  // same day boundary as ai.js and the client
var TTS_TIMEOUT_MS     = 45000;               // one short clinical line; 45s is generous
var META_TIMEOUT_MS    = 20000;               // /voices and /user/subscription
var VOICES_CACHE_MS    = 10 * 60 * 1000;      // ten minutes, module scope

/* The five speaker roles the app has. Mirrors VOICE_PROFILES in js/voice.js.
 * Bounded on purpose: the profile id becomes an RTDB key in the ledger and a
 * folder name in Storage, so an unrecognised value is filed as 'other' rather
 * than growing the ledger a new child per request. */
var PROFILE_IDS = ['patient', 'nurse', 'instructor', 'child', 'family', 'other'];
var DEFAULT_PROFILE = 'nurse';

/* Only pro and instructor may spend real characters. Everyone else uses the
 * browser's own voices, which cost nothing and always work. */
var PREMIUM_TIERS = ['pro', 'instructor'];

/* Characters per day, per plan. -1 unlimited, 0 = not part of that plan.
 * Overridable from /appConfig/aiConfig/voiceLimits.
 * 20000 characters is roughly 55 minutes of speech, or ~120 scripted lines. */
var DEFAULT_VOICE_LIMITS = { free: 0, plus: 0, pro: 20000, instructor: -1 };

/* Estimated dollars per 1000 characters. ElevenLabs bills per character against
 * a monthly bundle and returns no per-request price, so unlike ai.js there is
 * nothing authoritative to record — this is the owner's own blended rate and it
 * is meant to be edited. Creator is ~$0.22/1k, Pro ~$0.20/1k, Scale ~$0.17/1k.
 * Overridable from /appConfig/aiConfig/voiceUsdPer1kChars. */
var DEFAULT_USD_PER_1K_CHARS = 0.22;

var DEFAULT_SOFT_CAP_USD = 2;
var DEFAULT_CAP_MODE     = 'warn';

/* The models this function will send. Anything else falls back to flash: an
 * unknown model_id is a 422 from ElevenLabs, and a student losing their audio
 * because of a typo in the admin panel is not an acceptable failure mode. */
var TTS_MODELS = {
  'eleven_flash_v2_5':      { maxChars: 40000, label: 'Flash v2.5' },
  'eleven_turbo_v2_5':      { maxChars: 40000, label: 'Turbo v2.5' },
  'eleven_multilingual_v2': { maxChars: 10000, label: 'Multilingual v2' }
};
var DEFAULT_MODEL_ID = 'eleven_flash_v2_5';

/* Hard ceiling on one request regardless of the model's own limit. A single
 * spoken line in this app is a sentence or two; anything past this is a bug in
 * the caller, and letting it through would be a five-figure character bill. */
var MAX_TEXT_CHARS = 5000;

/* ------------------------------------------------------------- tiny helpers */

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Expose-Headers': 'X-MM-Tier, X-MM-Voice, X-MM-Model, X-MM-Chars, X-MM-Used, X-MM-Limit',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    // Defence in depth. Every response this file produces is JSON (or empty),
    // and some of them contain caller-influenced strings; nosniff stops a
    // browser deciding for itself that one of them is HTML. Set here rather
    // than in json() so the 204 preflight and warmup replies carry it too.
    'X-Content-Type-Options': 'nosniff'
  };
}

/**
 * A caller-supplied `action` that is about to be echoed back in an error.
 * Reduced to a short, boring charset: the diagnostic value is "which word did
 * you send", and no part of that needs punctuation, markup or 200 characters.
 * The untouched value is already in the server log if it is ever needed.
 */
function safeAction(v) {
  var s = String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  return s || 'unknown';
}

function json(status, obj, origin, extra) {
  var headers = corsHeaders(origin);
  headers['Content-Type'] = 'application/json; charset=utf-8';
  headers['Cache-Control'] = 'no-store';
  if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) headers[k] = extra[k]; } }
  return { statusCode: status, headers: headers, body: JSON.stringify(obj) };
}

function fail(status, code, message, origin, extra) {
  var body = { error: code, message: message };
  if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) body[k] = extra[k]; } }
  return json(status, body, origin);
}

function logErr(where, err) {
  try {
    console.error('[tts] ' + where + ': ' + (err && err.stack ? err.stack : String(err)));
  } catch (e) { /* ignore */ }
}

function logWarn(where, message) {
  try { console.warn('[tts] ' + where + ': ' + String(message)); } catch (e) { /* ignore */ }
}

function b64urlToBuffer(str) {
  var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  return Buffer.from(s, 'base64');
}

function b64urlToJSON(str) {
  return JSON.parse(b64urlToBuffer(str).toString('utf8'));
}

function fetchWithTimeout(url, opts, ms) {
  var ctl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = null;
  var options = Object.assign({}, opts || {});
  if (ctl) {
    options.signal = ctl.signal;
    timer = setTimeout(function () { try { ctl.abort(); } catch (e) {} }, ms || 30000);
  }
  return fetch(url, options).then(function (r) {
    if (timer) clearTimeout(timer);
    return r;
  }, function (e) {
    if (timer) clearTimeout(timer);
    throw e;
  });
}

/* --------------------------------------------------------- date / quota keys */

function dayKey(date, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
  } catch (e) {
    return date.toISOString().slice(0, 10);
  }
}

// Timestamp (ms) of the next local-midnight rollover in QUOTA_TZ. Coarse then
// fine so no timezone maths is hand-rolled. Identical to ai.js.
function nextResetMs(tz) {
  var now = new Date();
  var key = dayKey(now, tz);
  var i, j, coarse, lo, fine;
  for (i = 1; i <= 48 * 4; i++) {
    coarse = new Date(now.getTime() + i * 15 * 60000);
    if (dayKey(coarse, tz) !== key) {
      lo = new Date(coarse.getTime() - 15 * 60000);
      for (j = 1; j <= 15; j++) {
        fine = new Date(lo.getTime() + j * 60000);
        if (dayKey(fine, tz) !== key) return fine.getTime();
      }
      return coarse.getTime();
    }
  }
  return now.getTime() + 86400000;
}

/* ------------------------------------------- Firebase ID token verification */

var certCache = { certs: null, expiresAt: 0 };

function getGoogleCerts() {
  var now = Date.now();
  if (certCache.certs && now < certCache.expiresAt) return Promise.resolve(certCache.certs);

  function attempt(i, lastErr) {
    if (i >= GOOGLE_CERT_URLS.length) {
      throw new Error('cert fetch failed from all endpoints (' + GOOGLE_CERT_URLS.join(', ') +
        ') - last error: ' + (lastErr && lastErr.message ? lastErr.message : 'unknown'));
    }
    return fetchWithTimeout(GOOGLE_CERT_URLS[i], { method: 'GET' }, 10000).then(function (res) {
      if (!res.ok) throw new Error('cert fetch status ' + res.status + ' from ' + GOOGLE_CERT_URLS[i]);
      var cc = res.headers.get('cache-control') || '';
      var m = /max-age=(\d+)/i.exec(cc);
      var ttl = m ? parseInt(m[1], 10) * 1000 : 3600000;
      if (!(ttl > 60000)) ttl = 3600000;
      return res.json().then(function (certs) {
        if (!certs || typeof certs !== 'object' || Array.isArray(certs)) {
          throw new Error('cert payload not an object from ' + GOOGLE_CERT_URLS[i]);
        }
        var kids = Object.keys(certs);
        if (!kids.length || String(certs[kids[0]]).indexOf('BEGIN CERTIFICATE') === -1) {
          throw new Error('cert payload not x509 PEM from ' + GOOGLE_CERT_URLS[i]);
        }
        certCache.certs = certs;
        certCache.expiresAt = Date.now() + ttl;
        return certs;
      });
    }).catch(function (e) {
      return attempt(i + 1, e);
    });
  }
  return attempt(0, null);
}

function verifySignature(signingInput, signatureB64url, certPem) {
  var sig = b64urlToBuffer(signatureB64url);
  var key = certPem;
  try {
    if (typeof crypto.X509Certificate === 'function') {
      key = new crypto.X509Certificate(certPem).publicKey;
    }
  } catch (e) {
    key = certPem;
  }
  var v = crypto.createVerify('RSA-SHA256');
  v.update(signingInput);
  v.end();
  return v.verify(key, sig);
}

/** Verify a Firebase Auth ID token without the Admin SDK. */
function verifyIdToken(idToken, projectId) {
  return Promise.resolve().then(function () {
    if (!idToken || typeof idToken !== 'string') throw new Error('missing token');
    var parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('malformed token');

    var header, payload;
    try {
      header = b64urlToJSON(parts[0]);
      payload = b64urlToJSON(parts[1]);
    } catch (e) {
      throw new Error('undecodable token');
    }

    if (!header || header.alg !== 'RS256') throw new Error('bad alg');
    if (!header.kid || typeof header.kid !== 'string') throw new Error('missing kid');

    var nowSec = Math.floor(Date.now() / 1000);
    var skew = 300;

    if (!payload || typeof payload !== 'object') throw new Error('bad payload');
    if (payload.aud !== projectId) throw new Error('bad aud');
    if (payload.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('bad iss');
    if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) throw new Error('bad sub');
    if (typeof payload.exp !== 'number' || payload.exp + skew < nowSec) throw new Error('expired');
    if (typeof payload.iat !== 'number' || payload.iat - skew > nowSec) throw new Error('issued in the future');
    if (payload.auth_time && payload.auth_time - skew > nowSec) throw new Error('auth_time in the future');

    return getGoogleCerts().then(function (certs) {
      var pem = certs && certs[header.kid];
      if (!pem) throw new Error('unknown kid');
      var ok = false;
      try {
        ok = verifySignature(parts[0] + '.' + parts[1], parts[2], pem);
      } catch (e) {
        logErr('signature verify threw', e);
        ok = false;
      }
      if (!ok) throw new Error('bad signature');
      return {
        uid: payload.sub,
        email: typeof payload.email === 'string' ? payload.email.toLowerCase() : '',
        emailVerified: payload.email_verified === true,
        claims: payload
      };
    });
  });
}

/* ------------------------------------------------- Firebase Realtime Database */

function dbBase() {
  var url = process.env.FIREBASE_DB_URL || '';
  return String(url).replace(/\/+$/, '');
}

function projectIdFromEnv() {
  if (process.env.FIREBASE_PROJECT_ID) return String(process.env.FIREBASE_PROJECT_ID).trim();
  var m = /^https?:\/\/([^.]+?)(?:-default-rtdb)?\./.exec(dbBase());
  return m ? m[1] : '';
}

function dbAuthParam(idToken) {
  var secret = process.env.FIREBASE_DB_SECRET;
  if (secret) return 'auth=' + encodeURIComponent(secret);
  return 'auth=' + encodeURIComponent(idToken || '');
}

function dbGet(path, idToken) {
  var base = dbBase();
  if (!base) return Promise.resolve(null);
  var url = base + '/' + path + '.json?' + dbAuthParam(idToken);
  return fetchWithTimeout(url, { method: 'GET' }, 10000).then(function (res) {
    if (!res.ok) {
      logErr('dbGet ' + path, new Error('status ' + res.status));
      return null;
    }
    return res.json();
  }).catch(function (e) {
    logErr('dbGet ' + path, e);
    return null;
  });
}

/**
 * Sentinel for "the write did not happen" — a transport error or a non-2xx.
 *
 * It has to be distinguishable from a successful write that simply has no
 * payload to report: RTDB answers 204/empty for ?print=silent, and `null` is
 * also a perfectly legitimate JSON body. Collapsing both onto `null` is what
 * made recordUsage follow a SUCCESSFUL atomic increment with a non-atomic
 * absolute overwrite, clobbering every other in-flight request's characters.
 * Identity comparison (r === DB_FAILED) is the only correct test.
 */
var DB_FAILED = { dbWriteFailed: true };

function dbWriteFailed(r) { return r === DB_FAILED; }

function dbPut(path, value, idToken) {
  var base = dbBase();
  if (!base) return Promise.resolve(DB_FAILED);
  var url = base + '/' + path + '.json?' + dbAuthParam(idToken);
  return fetchWithTimeout(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  }, 10000).then(function (res) {
    if (!res.ok) {
      logErr('dbPut ' + path, new Error('status ' + res.status));
      return DB_FAILED;
    }
    // The write landed. An unreadable/absent body (204, print=silent) is a
    // success with nothing to report, NOT a failure.
    return res.json().catch(function () { return null; });
  }).catch(function (e) {
    logErr('dbPut ' + path, e);
    return DB_FAILED;
  });
}

// Multi-path update: deep keys plus {'.sv':{increment:n}} per key, so the whole
// ledger for one call is one request.
function dbPatch(path, obj, idToken) {
  var base = dbBase();
  if (!base) return Promise.resolve(DB_FAILED);
  var url = base + '/' + (path ? path : '') + '.json?' + dbAuthParam(idToken);
  return fetchWithTimeout(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  }, 10000).then(function (res) {
    if (!res.ok) {
      logErr('dbPatch ' + path, new Error('status ' + res.status));
      return DB_FAILED;
    }
    return res.json().catch(function () { return null; });
  }).catch(function (e) {
    logErr('dbPatch ' + path, e);
    return DB_FAILED;
  });
}

/* ------------------------------------------------------------ config reading */

// RTDB keys cannot contain . # $ / [ ]
function safeKey(s) {
  return String(s == null ? '' : s).replace(/[.#$/[\]]/g, '_').slice(0, 120) || 'unknown';
}

/**
 * Is this verified token the owner?
 *
 * BOTH halves are required, and the second half is the security-relevant one.
 * `email` is a claim, not an identity: Firebase will happily mint a token
 * carrying any address for sign-in methods that never prove control of the
 * mailbox (custom tokens, an admin-created account, some federated providers,
 * anything that ends up unverified). Comparing the address alone hands a
 * stranger the owner's powers here — the tier gate, the character cap, the site
 * spend cap, both kill switches, arbitrary voiceId/modelId, and the two
 * owner-only admin endpoints. `email_verified` is what turns the claim into
 * evidence, so it is checked at EVERY owner comparison in this file, and ai.js
 * does exactly the same.
 */
function isOwnerUser(u) {
  return !!u && u.email === OWNER_EMAIL && u.emailVerified === true;
}

function normalizeProfile(v) {
  var p = String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  if (!p) return DEFAULT_PROFILE;
  return PROFILE_IDS.indexOf(p) === -1 ? 'other' : p;
}

// An ElevenLabs voice id is an opaque 20-char alphanumeric string. Bounded here
// so a hostile config value cannot be pasted into a URL path.
function normalizeVoiceId(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(s)) return '';
  return s;
}

function normalizeModelId(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return DEFAULT_MODEL_ID;
  if (Object.prototype.hasOwnProperty.call(TTS_MODELS, s)) return s;
  logWarn('modelId', 'unknown ElevenLabs model "' + s.slice(0, 60) + '" - using ' + DEFAULT_MODEL_ID);
  return DEFAULT_MODEL_ID;
}

/**
 * Voice settings are optional and are only sent when the owner configured them.
 * ElevenLabs applies each voice's own saved defaults otherwise, which is almost
 * always better than a generic 0.5/0.75 we invented.
 */
function normalizeVoiceSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  var out = {};
  var n;
  if (typeof raw.stability === 'number' && isFinite(raw.stability)) {
    out.stability = Math.max(0, Math.min(1, raw.stability));
  }
  if (typeof raw.similarity_boost === 'number' && isFinite(raw.similarity_boost)) {
    out.similarity_boost = Math.max(0, Math.min(1, raw.similarity_boost));
  } else if (typeof raw.similarityBoost === 'number' && isFinite(raw.similarityBoost)) {
    out.similarity_boost = Math.max(0, Math.min(1, raw.similarityBoost));
  }
  n = (typeof raw.style === 'number') ? raw.style : (typeof raw.styleExaggeration === 'number' ? raw.styleExaggeration : null);
  if (typeof n === 'number' && isFinite(n)) out.style = Math.max(0, Math.min(1, n));
  if (raw.use_speaker_boost === true || raw.useSpeakerBoost === true) out.use_speaker_boost = true;
  if (raw.use_speaker_boost === false || raw.useSpeakerBoost === false) out.use_speaker_boost = false;
  if (typeof raw.speed === 'number' && isFinite(raw.speed)) {
    out.speed = Math.max(0.7, Math.min(1.2, raw.speed));
  }
  return Object.keys(out).length ? out : null;
}

/**
 * aiConfig.voiceProfiles -> { <profile>: {voiceId, modelId, name, settings} }
 *
 * Admin-written data coming back out of Firebase, so it can be anything: an
 * object keyed by index, a stray array, a profile id that no longer exists, a
 * voice id with a slash in it. Everything that is not a usable pair is dropped
 * silently — and a dropped profile simply uses the browser voice, which is the
 * correct behaviour for a misconfiguration, not an error.
 */
function normalizeVoiceProfiles(raw) {
  var out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  var k, id, v, voiceId, settings;
  for (k in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    id = String(k == null ? '' : k).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
    if (!id || PROFILE_IDS.indexOf(id) === -1 || id === 'other') continue;
    v = raw[k];
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    voiceId = normalizeVoiceId(v.voiceId || v.voice_id);
    if (!voiceId) continue;
    settings = normalizeVoiceSettings(v.settings || v.voiceSettings);
    out[id] = {
      voiceId: voiceId,
      modelId: normalizeModelId(v.modelId || v.model_id),
      name: (typeof v.name === 'string') ? v.name.slice(0, 80) : '',
      settings: settings
    };
  }
  return out;
}

function normalizeVoiceLimits(raw) {
  var out = {}, k, n;
  for (k in DEFAULT_VOICE_LIMITS) {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_VOICE_LIMITS, k)) out[k] = DEFAULT_VOICE_LIMITS[k];
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (k in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    n = raw[k];
    if (typeof n !== 'number' || !isFinite(n)) continue;
    out[String(k)] = Math.floor(n);
  }
  return out;
}

/**
 * Only the fields this function actually enforces. Deliberately NOT a copy of
 * ai.js's normalizeConfig: the tier MODEL rules are irrelevant here, and
 * duplicating them would be one more thing to keep in sync for no benefit.
 */
function normalizeConfig(raw) {
  var src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  var cfg = {
    enabled: src.enabled !== false,
    softCapUsd: DEFAULT_SOFT_CAP_USD,
    capMode: DEFAULT_CAP_MODE,
    voiceLimits: normalizeVoiceLimits(src.voiceLimits),
    voiceProfiles: normalizeVoiceProfiles(src.voiceProfiles),
    usdPer1kChars: DEFAULT_USD_PER_1K_CHARS,
    voiceEnabled: src.voiceEnabled !== false,
    knownTiers: {}
  };
  if (typeof src.softCapUsd === 'number' && isFinite(src.softCapUsd) && src.softCapUsd >= 0) {
    cfg.softCapUsd = src.softCapUsd;
  }
  if (src.capMode === 'block' || src.capMode === 'warn') cfg.capMode = src.capMode;
  if (typeof src.voiceUsdPer1kChars === 'number' && isFinite(src.voiceUsdPer1kChars) &&
      src.voiceUsdPer1kChars >= 0 && src.voiceUsdPer1kChars < 100) {
    cfg.usdPer1kChars = src.voiceUsdPer1kChars;
  }
  // Which tier names exist at all, so resolveTier can fall back to 'free' for a
  // record naming a tier the owner deleted.
  var t, tiers = (src.tiers && typeof src.tiers === 'object') ? src.tiers : {};
  for (t in DEFAULT_VOICE_LIMITS) {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_VOICE_LIMITS, t)) cfg.knownTiers[t] = true;
  }
  for (t in tiers) {
    if (Object.prototype.hasOwnProperty.call(tiers, t)) cfg.knownTiers[String(t)] = true;
  }
  return cfg;
}

/**
 * `email` here means "an email this function has already accepted as proof of
 * identity". Call sites pass the address ONLY when isOwnerUser() said yes (see
 * handleSpeak); an unverified owner-email claim arrives as '' and resolves like
 * anybody else's, which keeps the owner shortcut from becoming a second, softer
 * owner check that skips the verified flag.
 */
function resolveTier(cfg, email, tierRecord) {
  if (email && email === OWNER_EMAIL) return 'instructor';
  var t = 'free';
  if (tierRecord && typeof tierRecord === 'object' && typeof tierRecord.tier === 'string') {
    t = tierRecord.tier;
    var exp = tierRecord.expiresAt;
    if (exp && typeof exp === 'number' && Date.now() > exp) t = 'free';
  } else if (typeof tierRecord === 'string' && tierRecord) {
    t = tierRecord;
  }
  if (!cfg.knownTiers[t]) t = 'free';
  return t;
}

// -1 for the owner, then the configured value, then the shipped default, then 0.
function voiceLimitFor(cfg, tier, isOwner) {
  if (isOwner) return -1;
  var limits = (cfg && cfg.voiceLimits && typeof cfg.voiceLimits === 'object') ? cfg.voiceLimits : DEFAULT_VOICE_LIMITS;
  var v = limits[tier];
  if (typeof v === 'number' && isFinite(v)) return Math.floor(v);
  v = DEFAULT_VOICE_LIMITS[tier];
  return typeof v === 'number' ? v : 0;
}

function tierMayUsePremiumVoice(tier, isOwner) {
  if (isOwner) return true;
  return PREMIUM_TIERS.indexOf(tier) !== -1;
}

function estimateCostUsd(chars, usdPer1k) {
  var rate = (typeof usdPer1k === 'number' && isFinite(usdPer1k) && usdPer1k >= 0)
    ? usdPer1k : DEFAULT_USD_PER_1K_CHARS;
  var n = (typeof chars === 'number' && isFinite(chars) && chars > 0) ? chars : 0;
  return (n / 1000) * rate;
}

/* ------------------------------------------------------- ElevenLabs plumbing */

function elevenHeaders(apiKey, extra) {
  var h = { 'xi-api-key': apiKey, 'accept': 'audio/mpeg' };
  if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k]; } }
  return h;
}

/**
 * Did ElevenLabs say "your monthly characters are gone", as opposed to any of
 * the other things it says with a 401?
 *
 * This distinction is the whole reason the function reads the error body at
 * all. "The site's monthly ElevenLabs characters are used up" and "you have
 * used your 20,000 characters for today" are completely different sentences
 * with completely different fixes, and conflating them means a student is told
 * off for something the owner has to fix.
 */
function isQuotaExhausted(status, bodyText) {
  if (status !== 401 && status !== 402 && status !== 403) return false;
  // 402 needs no corroboration from the body. Payment Required has exactly one
  // meaning — the plan will not pay for this call — and ElevenLabs sends it with
  // whatever wording it likes. Making the billing message conditional on five
  // English substrings turned the clearest status code in the protocol into the
  // vaguest message in this file.
  if (status === 402) return true;
  var s = String(bodyText == null ? '' : bodyText).toLowerCase();
  return s.indexOf('quota_exceeded') !== -1 ||
         s.indexOf('quota exceeded') !== -1 ||
         s.indexOf('character limit') !== -1 ||
         s.indexOf('out of characters') !== -1 ||
         s.indexOf('max_character_limit_exceeded') !== -1;
}

// Did this 4xx come from the model refusing apply_text_normalization? Some
// models accept only a subset of its values, and a latency nicety must never be
// the reason a student's line fails. Mirrors rejectsResponseFormat() in ai.js.
var RE_NORMALIZATION_REJECT = /apply_text_normalization|text_normalization|normalization/i;

function rejectsNormalizationFlag(status, bodyText) {
  if (!(status >= 400 && status < 500)) return false;
  return RE_NORMALIZATION_REJECT.test(String(bodyText == null ? '' : bodyText));
}

/**
 * Turn a non-2xx ElevenLabs response into this file's {httpStatus, code,
 * message, extra} throwable. The real body is logged server-side; the client
 * only ever gets the safe summary plus a machine-readable `reason`.
 */
function upstreamError(status, bodyText, voiceId, modelId) {
  logErr('elevenlabs ' + status + ' [' + voiceId + ' / ' + modelId + ']',
    new Error(String(bodyText).slice(0, 2000)));

  if (isQuotaExhausted(status, bodyText)) {
    // NOT the student's daily limit. Say so in the first clause, because this
    // message is the one most likely to be read by somebody who did nothing.
    return {
      httpStatus: 503,
      code: 'ai-disabled',
      message: 'Studio voices are off for now because the site\'s monthly ElevenLabs characters are used up. ' +
               'This is not your daily limit and nothing you did — the site owner has to top the plan up. ' +
               'Everything is still read aloud in your device\'s own voice in the meantime.',
      extra: { reason: 'elevenlabs-quota' }
    };
  }

  var msg = 'The voice service could not read that line.';
  var extra = null;

  if (status === 401 || status === 403) {
    msg = 'ElevenLabs rejected the server key. The site owner needs to check ELEVENLABS_API_KEY in Netlify ' +
          'and confirm it still has the Text to Speech permission.';
    extra = { reason: 'bad-key' };
  } else if (status === 404) {
    msg = 'That ElevenLabs voice no longer exists. Reassign the profile in Admin Panel -> AI -> Voices.';
    extra = { reason: 'bad-voice', voiceId: voiceId };
  } else if (status === 422) {
    // 422 is ElevenLabs' validation error and in practice it is always one of
    // these two fields, so the message names both rather than saying "invalid".
    msg = 'ElevenLabs would not accept that voice or model. The voice id "' + voiceId + '" or the model "' +
          modelId + '" is wrong for this account — fix it in Admin Panel -> AI -> Voices.';
    extra = { reason: 'bad-voice-or-model', voiceId: voiceId, modelId: modelId };
  } else if (status === 429) {
    msg = 'ElevenLabs is rate limiting the site right now (too many voice requests at once). ' +
          'Try again in a moment.';
    extra = { reason: 'upstream-rate-limit' };
  } else if (status === 502 || status === 503 || status === 504) {
    msg = 'The voice provider is overloaded or down. Try again in a moment.';
    extra = { reason: 'provider-down' };
  } else if (status === 400) {
    msg = 'That request was not valid for the selected voice.';
    extra = { reason: 'bad-request', voiceId: voiceId, modelId: modelId };
  }
  return { httpStatus: 502, code: 'server', message: msg, extra: extra };
}

/* ----------------------------------------------- action: listVoices (owner) */

var voicesCache = { list: null, fetchedAt: 0, expiresAt: 0 };

// One entry of GET /v1/voices, trimmed to what the admin picker renders. The
// full record carries fine-tuning state, sample lists and sharing metadata that
// the panel has no use for and that would be several hundred KB over the wire.
function trimVoice(v) {
  if (!v || typeof v !== 'object') return null;
  var id = (typeof v.voice_id === 'string' && v.voice_id) ? v.voice_id : '';
  if (!id) return null;
  var labels = (v.labels && typeof v.labels === 'object' && !Array.isArray(v.labels)) ? v.labels : {};
  function lab(k) {
    var s = labels[k];
    return (typeof s === 'string') ? s.slice(0, 60) : '';
  }
  return {
    voice_id: id,
    name: (typeof v.name === 'string' && v.name) ? v.name.slice(0, 80) : id,
    category: (typeof v.category === 'string' && v.category) ? v.category.slice(0, 40) : 'generated',
    labels: {
      accent: lab('accent'),
      age: lab('age'),
      gender: lab('gender'),
      description: lab('description') || lab('descriptive'),
      useCase: lab('use_case') || lab('use case')
    },
    preview_url: (typeof v.preview_url === 'string' && /^https:\/\//i.test(v.preview_url)) ? v.preview_url : '',
    description: (typeof v.description === 'string') ? v.description.slice(0, 300) : ''
  };
}

function getElevenVoices(apiKey) {
  var now = Date.now();
  if (voicesCache.list && now < voicesCache.expiresAt) {
    return Promise.resolve({ list: voicesCache.list, fetchedAt: voicesCache.fetchedAt, cached: true });
  }
  return fetchWithTimeout(ELEVEN_VOICES_URL, {
    method: 'GET',
    headers: { 'xi-api-key': apiKey, 'accept': 'application/json' }
  }, META_TIMEOUT_MS).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (t) {
        throw upstreamError(res.status, t, '(catalog)', '(catalog)');
      }, function () {
        throw { httpStatus: 502, code: 'server', message: 'ElevenLabs would not return its voice list.' };
      });
    }
    return res.json().then(function (data) {
      var raw = (data && Array.isArray(data.voices)) ? data.voices : [];
      var list = [];
      for (var i = 0; i < raw.length; i++) {
        var t = trimVoice(raw[i]);
        if (t) list.push(t);
      }
      list.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      voicesCache.list = list;
      voicesCache.fetchedAt = Date.now();
      voicesCache.expiresAt = voicesCache.fetchedAt + VOICES_CACHE_MS;
      return { list: list, fetchedAt: voicesCache.fetchedAt, cached: false };
    });
  }, function (e) {
    if (e && e.code && e.httpStatus) throw e;
    logErr('elevenlabs voices fetch', e);
    throw { httpStatus: 504, code: 'network', message: 'Could not reach ElevenLabs to load the voice list.' };
  });
}

function handleListVoices(idToken, projectId, apiKey, origin) {
  return verifyIdToken(idToken, projectId).catch(function (e) {
    logErr('token verify (listVoices)', e);
    throw { httpStatus: 401, code: 'no-auth', message: 'Your session expired. Sign in again.' };
  }).then(function (u) {
    if (!isOwnerUser(u)) {   // verified owner email only — see isOwnerUser()
      throw { httpStatus: 403, code: 'tier-denied', message: 'The ElevenLabs voice catalog is owner only.' };
    }
    return getElevenVoices(apiKey);
  }).then(function (r) {
    return json(200, {
      ok: true,
      voices: r.list,
      count: r.list.length,
      fetchedAt: r.fetchedAt,
      cached: r.cached,
      cacheMs: VOICES_CACHE_MS,
      models: modelCatalog()
    }, origin);
  }).catch(function (e) {
    if (e && e.code && e.httpStatus) return fail(e.httpStatus, e.code, e.message, origin, e.extra);
    logErr('listVoices unhandled', e);
    return fail(500, 'server', 'Could not load the ElevenLabs voice list.', origin);
  });
}

// The three models this function will actually send, for the admin picker.
function modelCatalog() {
  var out = [], k;
  for (k in TTS_MODELS) {
    if (!Object.prototype.hasOwnProperty.call(TTS_MODELS, k)) continue;
    out.push({ id: k, label: TTS_MODELS[k].label, maxChars: TTS_MODELS[k].maxChars, isDefault: k === DEFAULT_MODEL_ID });
  }
  return out;
}

/* ---------------------------------------------------- action: quota (owner) */

function handleQuota(idToken, projectId, apiKey, origin) {
  return verifyIdToken(idToken, projectId).catch(function (e) {
    logErr('token verify (quota)', e);
    throw { httpStatus: 401, code: 'no-auth', message: 'Your session expired. Sign in again.' };
  }).then(function (u) {
    if (!isOwnerUser(u)) {   // verified owner email only — see isOwnerUser()
      throw { httpStatus: 403, code: 'tier-denied', message: 'The ElevenLabs subscription details are owner only.' };
    }
    return fetchWithTimeout(ELEVEN_SUB_URL, {
      method: 'GET',
      headers: { 'xi-api-key': apiKey, 'accept': 'application/json' }
    }, META_TIMEOUT_MS);
  }).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (t) {
        throw upstreamError(res.status, t, '(subscription)', '(subscription)');
      }, function () {
        throw { httpStatus: 502, code: 'server', message: 'ElevenLabs would not return the subscription details.' };
      });
    }
    return res.json().then(function (d) {
      var data = (d && typeof d === 'object') ? d : {};
      var used = (typeof data.character_count === 'number') ? data.character_count : 0;
      var limit = (typeof data.character_limit === 'number') ? data.character_limit : 0;
      // ElevenLabs reports the reset as unix SECONDS. Send milliseconds so the
      // browser can hand it straight to new Date() like every other timestamp
      // in this app.
      var resetSec = (typeof data.next_character_count_reset_unix === 'number')
        ? data.next_character_count_reset_unix : 0;
      return json(200, {
        ok: true,
        used: used,
        limit: limit,
        remaining: limit > 0 ? Math.max(0, limit - used) : 0,
        pct: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0,
        resetsAt: resetSec > 0 ? resetSec * 1000 : 0,
        tier: (typeof data.tier === 'string') ? data.tier : '',
        status: (typeof data.status === 'string') ? data.status : '',
        canExtend: data.can_extend_character_limit === true,
        usdPer1kChars: DEFAULT_USD_PER_1K_CHARS
      }, origin);
    });
  }).catch(function (e) {
    if (e && e.code && e.httpStatus) return fail(e.httpStatus, e.code, e.message, origin, e.extra);
    logErr('quota unhandled', e);
    return fail(500, 'server', 'Could not read the ElevenLabs subscription.', origin);
  });
}

/* ------------------------------------------------------- in-flight reservations
 *
 * Characters this CONTAINER has already reserved against a student's day but
 * has not finished spending, keyed <safe uid>/<YYYY-MM-DD>.
 *
 * The durable record is the atomic RTDB increment; this map exists only because
 * the increment's RESULT is not knowable to the requests that are already past
 * their own read. Two requests handled by the same warm lambda would otherwise
 * both read the same stale daily total and both pass the gate. Entries are
 * added the instant the gate is passed (synchronously, so there is no await
 * between the check and the reservation) and removed when the request ends.
 * ------------------------------------------------------------------------- */
var charHolds = Object.create(null);

function heldChars(k) {
  var n = charHolds[k];
  return (typeof n === 'number' && isFinite(n) && n > 0) ? n : 0;
}

function holdChars(k, n) {
  charHolds[k] = heldChars(k) + (n > 0 ? n : 0);
}

function releaseChars(k, n) {
  var left = heldChars(k) - (n > 0 ? n : 0);
  if (left > 0) charHolds[k] = left; else delete charHolds[k];
}

/* ------------------------------------------------------------ action: speak */

/**
 * POST /api/tts
 * { action:'speak', idToken, text, profile, voiceId?, modelId? }
 *
 * 200 { ok:true, b64, mime:'audio/mpeg', voiceId, modelId, chars, cost, ... }
 * err { error:<code>, message, ... } with code one of
 *      no-auth | tier-denied | quota-exceeded | ai-disabled | network | server
 *
 * `voiceId` / `modelId` from the caller are honoured ONLY for the owner — that
 * is what makes the admin panel's "Test this voice" button able to audition a
 * voice before assigning it. For everybody else the profile is the only input
 * and the mapping lives in aiConfig.voiceProfiles.
 */
function handleSpeak(body, idToken, projectId, apiKey, origin) {
  var user = null, cfg = null, tier = 'free', isOwner = false;
  var usedToday = 0, limit = 0, spent6 = 0;
  var key = dayKey(new Date(), QUOTA_TZ);
  var profile = normalizeProfile(body.profile);
  var voiceId = '', modelId = DEFAULT_MODEL_ID, settings = null;
  var text = (typeof body.text === 'string') ? body.text.replace(/\s+/g, ' ').trim() : '';
  var chars = 0;
  // The in-flight reservation this request owns, if it got as far as taking one.
  var holdKey = '', held = false;

  function releaseHold() {
    if (!held) return;
    held = false;
    releaseChars(holdKey, chars);
  }

  /**
   * Hand the reserved characters back. Called only when ElevenLabs did NOT bill
   * us — a 4xx/5xx, a network failure, or a 200 that was not audio at all. A
   * request that reached synthesis keeps its reservation even when the bytes
   * turn out to be unusable, because the characters really were consumed.
   */
  function refundHold() {
    if (!held) return Promise.resolve(null);
    releaseHold();
    return refundUsage(user && user.uid, key, chars, idToken);
  }

  if (!text) {
    return Promise.resolve(fail(400, 'server', 'No text supplied to speak.', origin));
  }
  if (text.length > MAX_TEXT_CHARS) {
    // Refuse rather than silently truncate: half a sentence read in a studio
    // voice is worse than the whole sentence read by the browser, and the
    // client falls back to the browser on any failure.
    return Promise.resolve(fail(400, 'server',
      'That line is ' + text.length + ' characters, past the ' + MAX_TEXT_CHARS +
      '-character limit for one spoken line.', origin, { reason: 'too-long', chars: text.length }));
  }
  chars = text.length;

  return verifyIdToken(idToken, projectId).catch(function (e) {
    logErr('token verify (speak)', e);
    throw { httpStatus: 401, code: 'no-auth', message: 'Your session expired. Sign in again.' };
  }).then(function (u) {
    user = u;
    // A verified owner email, never the bare claim — see isOwnerUser().
    isOwner = isOwnerUser(u);
    holdKey = safeKey(u.uid) + '/' + key;
    return Promise.all([
      dbGet('userTiers/' + encodeURIComponent(u.uid), idToken),
      dbGet('appConfig/aiConfig', idToken),
      readSpendToday(key, idToken)
    ]);
  }).then(function (trio) {
    cfg = normalizeConfig(trio[1]);
    // Only a VERIFIED owner email earns the instructor shortcut inside
    // resolveTier; anything else resolves from the tier record like normal.
    tier = resolveTier(cfg, isOwner ? user.email : '', trio[0]);
    spent6 = typeof trio[2] === 'number' ? trio[2] : 0;

    /* ---- global kill switch (owner bypasses) ------------------------------ */
    if (cfg.enabled === false && !isOwner) {
      throw {
        httpStatus: 503, code: 'ai-disabled',
        message: 'AI features are temporarily turned off. Your device\'s own voice still reads everything aloud.'
      };
    }
    // A voice-only switch, so the owner can pause ElevenLabs without pausing the
    // tutor. Absent means on.
    if (cfg.voiceEnabled === false && !isOwner) {
      throw {
        httpStatus: 503, code: 'ai-disabled',
        message: 'Studio voices are paused right now. Everything is still read aloud in your device\'s own voice.',
        extra: { reason: 'voice-disabled' }
      };
    }

    /* ---- daily DOLLAR ceiling (shared with the text AI) ------------------- */
    var cap6 = Math.round((typeof cfg.softCapUsd === 'number' ? cfg.softCapUsd : DEFAULT_SOFT_CAP_USD) * 1e6);
    if (!isOwner && cfg.capMode === 'block' && cap6 > 0 && spent6 >= cap6) {
      throw {
        httpStatus: 503, code: 'ai-disabled',
        message: 'Studio voices are paused for the rest of today: the site hit its daily AI budget of $' +
                 (cap6 / 1e6).toFixed(2) + '. This is not your personal limit and nothing you did. ' +
                 'It resets at midnight Eastern, and your device\'s own voice still reads everything aloud.',
        extra: { reason: 'spend-cap', resetsAt: nextResetMs(QUOTA_TZ) }
      };
    }

    /* ---- the plan boundary ------------------------------------------------
     * Worded very deliberately. A free or plus student hitting this has not
     * done anything wrong and is not missing a feature — they get the same
     * words in their own device's voice. The client never surfaces this at all;
     * it just uses the browser path. */
    if (!tierMayUsePremiumVoice(tier, isOwner)) {
      throw {
        httpStatus: 403, code: 'tier-denied',
        message: 'The ' + tier + ' plan uses your device\'s built-in voices, which is why nothing here is missing ' +
                 'or broken — every line is still read aloud, just not in a studio voice. This is not an error.',
        extra: { reason: 'browser-voice-plan', tier: tier, premiumTiers: PREMIUM_TIERS }
      };
    }

    /* ---- which voice ------------------------------------------------------ */
    var assigned = cfg.voiceProfiles[profile] || null;
    var requestedVoice = normalizeVoiceId(body.voiceId);
    var requestedModel = (typeof body.modelId === 'string' && body.modelId) ? normalizeModelId(body.modelId) : '';

    if (requestedVoice && isOwner) {
      voiceId = requestedVoice;
      modelId = requestedModel || (assigned ? assigned.modelId : DEFAULT_MODEL_ID);
      settings = null;                 // auditioning: hear the voice's own defaults
    } else if (assigned) {
      voiceId = assigned.voiceId;
      modelId = (isOwner && requestedModel) ? requestedModel : assigned.modelId;
      settings = assigned.settings;
    }

    if (!voiceId) {
      throw {
        httpStatus: 400, code: 'server',
        message: 'No ElevenLabs voice is assigned to the "' + profile + '" role yet, so that role uses the ' +
                 'browser voice. Assign one in Admin Panel -> AI -> Voices.',
        extra: { reason: 'no-voice-configured', profile: profile }
      };
    }

    var modelMax = TTS_MODELS[modelId] ? TTS_MODELS[modelId].maxChars : 10000;
    if (chars > modelMax) {
      throw {
        httpStatus: 400, code: 'server',
        message: 'That line is ' + chars + ' characters and ' + modelId + ' accepts ' + modelMax + '.',
        extra: { reason: 'too-long', chars: chars, maxChars: modelMax }
      };
    }

    /* ---- the per-day CHARACTER cap ---------------------------------------- */
    limit = voiceLimitFor(cfg, tier, isOwner);
    if (limit === 0) {
      throw {
        httpStatus: 429, code: 'quota-exceeded',
        message: 'Studio voices are not part of the ' + tier + ' plan (0 characters a day). ' +
                 'Everything is still read aloud in your device\'s own voice.',
        extra: { used: 0, limit: 0, kind: 'voice', tier: tier, resetsAt: nextResetMs(QUOTA_TZ) }
      };
    }
    if (limit < 0) return 0;   // unlimited — skip the read
    return dbGet(usagePathFor(user.uid, key), idToken);
  }).then(function (count) {
    usedToday = typeof count === 'number' ? count : 0;

    /* ---- RESERVE, then check ---------------------------------------------
     * The old shape read the counter here and wrote it after the render, which
     * is a textbook TOCTOU: every concurrent request read the same stale total,
     * every one of them passed, and the daily cap multiplied by the number of
     * open tabs.
     *
     * The budget is now taken BEFORE the money is spent, in two layers:
     *
     *   1. `charHolds` covers requests this container is already handling. The
     *      check and the hold happen in the same synchronous block, so a second
     *      request cannot slip between them.
     *   2. The RTDB increment below is the cross-container answer. It is atomic
     *      and it RETURNS the post-increment total, so a request that only finds
     *      out it lost the race after incrementing can hand the characters back
     *      and deny before calling ElevenLabs.
     *
     * Residual window: between two containers' increments both may still be
     * issued, but the loser sees its own post-increment value exceed the limit
     * and refunds, so the overshoot is bounded by one request per racing
     * container rather than unbounded. Fail-open is deliberate everywhere the
     * counter is unreadable — a broken counter must not silence the tutor.
     */
    var inflight = heldChars(holdKey);
    if (limit >= 0 && usedToday + inflight + chars > limit) {
      throw {
        httpStatus: 429, code: 'quota-exceeded',
        message: 'You have used ' + (usedToday + inflight) + ' of your ' + limit + ' studio-voice characters for today, and ' +
                 'this line needs ' + chars + ' more. It resets at midnight Eastern — until then everything is ' +
                 'still read aloud in your device\'s own voice.',
        extra: {
          used: usedToday + inflight, limit: limit, needed: chars, kind: 'voice',
          tier: tier, resetsAt: nextResetMs(QUOTA_TZ)
        }
      };
    }
    holdChars(holdKey, chars);
    held = true;
    return recordUsage(user.uid, key, chars, usedToday, limit, idToken);
  }).then(function (afterIncrement) {
    // What the atomic increment says the student's day now totals. A number is
    // authoritative; DB_FAILED or a payload-less success tells us nothing, and
    // "nothing" must not become a denial.
    if (limit >= 0 && typeof afterIncrement === 'number' && isFinite(afterIncrement) && afterIncrement > limit) {
      return refundHold().then(function () {
        throw {
          httpStatus: 429, code: 'quota-exceeded',
          message: 'You have used all ' + limit + ' of your studio-voice characters for today. ' +
                   'It resets at midnight Eastern — until then everything is still read aloud in your ' +
                   'device\'s own voice.',
          extra: {
            used: afterIncrement - chars, limit: limit, needed: chars, kind: 'voice',
            tier: tier, reason: 'quota-race', resetsAt: nextResetMs(QUOTA_TZ)
          }
        };
      });
    }

    /* ---- upstream --------------------------------------------------------- */
    function buildPayload(withNormalizationFlag) {
      var payload = { text: text, model_id: modelId };
      if (settings) payload.voice_settings = settings;
      // We normalized the clinical text ourselves (Flash disables ElevenLabs'
      // own number normalization anyway). Telling it 'off' explicitly stops the
      // other two models from re-reading "92 over 58" as a date.
      if (withNormalizationFlag) payload.apply_text_normalization = 'off';
      return payload;
    }

    function sendUpstream(withNormalizationFlag) {
      return fetchWithTimeout(ELEVEN_TTS_URL + encodeURIComponent(voiceId), {
        method: 'POST',
        headers: elevenHeaders(apiKey, { 'content-type': 'application/json' }),
        body: JSON.stringify(buildPayload(withNormalizationFlag))
      }, TTS_TIMEOUT_MS).then(function (res) {
        if (res.ok) return res;
        return res.text().then(function (t) {
          if (withNormalizationFlag && rejectsNormalizationFlag(res.status, t)) {
            logWarn('apply_text_normalization',
              'model "' + modelId + '" rejected apply_text_normalization (' + res.status + ') - retrying once without it');
            return sendUpstream(false);
          }
          throw upstreamError(res.status, t, voiceId, modelId);
        }, function () {
          throw { httpStatus: 502, code: 'server', message: 'The voice service could not read that line.' };
        });
      }, function (e) {
        logErr('elevenlabs fetch', e);
        var aborted = e && (e.name === 'AbortError' || String(e).indexOf('abort') !== -1);
        throw {
          httpStatus: 504, code: 'network',
          message: aborted
            ? 'The voice took longer than ' + Math.round(TTS_TIMEOUT_MS / 1000) + ' seconds to render.'
            : 'Could not reach the voice service. Try again in a moment.'
        };
      });
    }

    return sendUpstream(true).then(function (res) {
      /* ---- is this actually audio? -----------------------------------------
       * A 200 whose content-type is not audio/* is a Cloudflare interstitial, a
       * maintenance page, or a JSON error some proxy decided to serve with a
       * 200 — it is never a clip. The old code REWROTE the label to audio/mpeg,
       * which is the worst available answer: the client base64-decodes it,
       * plays silence, and then (see the header) uploads it to Firebase Storage
       * where every other student on earth reads the same poisoned entry
       * forever. Reject instead, and never relabel. Nothing was synthesized, so
       * the reservation goes back and no spend is recorded.
       */
      var ctype = String(res.headers.get('content-type') || '').toLowerCase().trim();
      if (ctype && ctype.slice(0, 6) !== 'audio/') {
        logWarn('upstream content-type', 'ElevenLabs returned 200 with "' + ctype.slice(0, 60) +
          '" for voice ' + voiceId + ' - refusing to serve it as audio');
        return refundHold().then(function () {
          throw {
            httpStatus: 502, code: 'server',
            message: 'The voice service answered with something that is not audio, so nothing was played. ' +
                     'Try again in a moment.',
            extra: { reason: 'not-audio', voiceId: voiceId }
          };
        });
      }

      return res.arrayBuffer().then(function (buf) {
        var bytes = Buffer.from(buf);
        var cost = estimateCostUsd(chars, cfg.usdPer1kChars);

        /* ---- SPEND is recorded before the clip is judged ---------------------
         * ElevenLabs deducts characters at synthesis, not at download: by the
         * time these bytes arrive the site has been billed whether or not they
         * are usable. Recording spend only on success left the ledger flat for
         * calls that really cost money, so the dollar ceiling under-counted and
         * a client retrying an empty clip looped for free.
         *
         * QUOTA is a different question and is already answered: the characters
         * were reserved up front, before the call, and a request that reached
         * synthesis does not get them back. Spend asks "what did this cost the
         * site"; quota asks "how much of today's allowance did this student
         * commit". Both are yes here; only the audio is missing.
         */
        return recordSpend(user.uid, key, chars, cost, profile, idToken).then(function () {
          // ElevenLabs answers 200 with an empty body if a voice is mid-deletion.
          // An empty clip would be cached forever as silence, so treat it as a
          // failure and let the client fall back to the browser voice.
          if (!bytes || bytes.length < 256) {
            throw {
              httpStatus: 502, code: 'server',
              message: 'ElevenLabs returned an empty clip for that line.',
              extra: { reason: 'empty-audio', voiceId: voiceId }
            };
          }
          return json(200, {
            ok: true,
            b64: bytes.toString('base64'),
            mime: 'audio/mpeg',
            voiceId: voiceId,
            modelId: modelId,
            chars: chars,
            cost: cost,
            // --- additive, beyond the wire contract ---
            profile: profile,
            tier: tier,
            bytes: bytes.length,
            used: limit < 0 ? -1 : usedToday + chars,
            limit: limit,
            resetsAt: nextResetMs(QUOTA_TZ),
            usdPer1kChars: cfg.usdPer1kChars
          }, origin, {
            'X-MM-Tier': tier,
            'X-MM-Voice': voiceId,
            'X-MM-Model': modelId,
            'X-MM-Chars': String(chars),
            'X-MM-Used': String(limit < 0 ? -1 : usedToday + chars),
            'X-MM-Limit': String(limit)
          });
        });
      });
    }, function (e) {
      // sendUpstream itself failed: a 4xx/5xx or a network error, so ElevenLabs
      // never synthesized anything and never billed for it. Give the student
      // their reserved characters back before reporting the failure — a
      // misconfigured voice must not quietly eat a day's allowance.
      return refundHold().then(function () { throw e; });
    });
  }).then(function (out) {
    releaseHold();
    return out;
  }, function (e) {
    releaseHold();
    throw e;
  }).catch(function (e) {
    if (e && e.code && e.httpStatus) return fail(e.httpStatus, e.code, e.message, origin, e.extra);
    logErr('speak unhandled', e);
    return fail(500, 'server', 'Something went wrong on our end. Try again in a moment.', origin);
  });
}

/* --------------------------------------------------------------- the handler */

exports.handler = function (event) {
  var origin = (event && event.headers && (event.headers.origin || event.headers.Origin)) || '*';

  if (event && event.httpMethod === 'OPTIONS') {
    return Promise.resolve({ statusCode: 204, headers: corsHeaders(origin), body: '' });
  }
  if (!event || event.httpMethod !== 'POST') {
    return Promise.resolve(fail(405, 'server', 'Use POST.', origin));
  }

  var apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    logErr('config', new Error('ELEVENLABS_API_KEY is not set'));
    // Deliberately a 503 with ai-disabled rather than a 500: the client reads
    // this as "premium voices are off", falls back to the browser, and stops
    // asking for the rest of the session.
    return Promise.resolve(fail(503, 'ai-disabled',
      'Studio voices are not configured on the server yet. Everything is still read aloud in your device\'s own voice.',
      origin, { reason: 'not-configured' }));
  }

  var projectId = projectIdFromEnv();
  if (!projectId || !dbBase()) {
    logErr('config', new Error('FIREBASE_DB_URL / FIREBASE_PROJECT_ID missing'));
    return Promise.resolve(fail(500, 'server', 'Studio voices are not configured on the server yet.', origin));
  }

  var body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return Promise.resolve(fail(400, 'server', 'Malformed request body.', origin));
  }

  var qs = (event.queryStringParameters && typeof event.queryStringParameters === 'object')
    ? event.queryStringParameters : {};
  var action = 'speak';
  if (typeof body.action === 'string' && body.action) action = body.action;
  else if (typeof qs.action === 'string' && qs.action) action = qs.action;

  // The only unauthenticated action: boots the container so the first real line
  // of a session is not paying for a cold start on top of the render. Reads no
  // body fields, touches no Firebase, spends nothing.
  if (action === 'warmup') {
    return Promise.resolve({ statusCode: 204, headers: corsHeaders(origin), body: '' });
  }

  var idToken = body.idToken;
  if (!idToken) {
    return Promise.resolve(fail(401, 'no-auth', 'You need to be signed in for studio voices.', origin));
  }

  if (action === 'listVoices') return handleListVoices(idToken, projectId, apiKey, origin);
  if (action === 'quota')      return handleQuota(idToken, projectId, apiKey, origin);
  if (action === 'speak')      return handleSpeak(body, idToken, projectId, apiKey, origin);

  // The echo is sanitized, not raw: see safeAction(). The full value is in the
  // server log if anyone ever needs it.
  logWarn('action', 'unknown action "' + String(action).slice(0, 120) + '"');
  return Promise.resolve(fail(400, 'server', 'Unknown action "' + safeAction(action) + '".', origin));
};

/* --------------------------------------------------------- usage + spend write */

/**
 * /voiceUsage/<uid>/<day>, built in ONE place so the read and the write can
 * never disagree about the key.
 *
 * safeKey, not encodeURIComponent: this path segment is an RTDB KEY. RTDB
 * rejects a key containing . # $ / [ ] with a 400, and encodeURIComponent
 * leaves '.' (and ! ~ * ' ( )) untouched, so a dotted uid used to make the
 * quota read AND the quota write fail silently — dbGet swallows the error to
 * null and recordUsage is best-effort — leaving the daily cap unenforceable for
 * that account. Firebase's own uids are alphanumeric, but `sub` is accepted as
 * any 1..128-character string, which includes custom-token uids. The ledger at
 * recordSpend() has always used safeKey; this is the same key by the same rule.
 * encodeURIComponent still wraps it so characters that are legal in an RTDB key
 * but not in a URL path (% ? &) cannot deform the request.
 */
function usagePathFor(uid, key) {
  return 'voiceUsage/' + encodeURIComponent(safeKey(uid)) + '/' + key;
}

/**
 * Characters, not calls. Best-effort: never fail the student's audio because a
 * counter write failed. Owner and instructor accounts ARE counted — `limit < 0`
 * means "no quota", never "do not measure", and the unlimited accounts are the
 * ones most likely to spend real money.
 *
 * Resolves with the post-increment total RTDB reports, so the caller can tell
 * whether the reservation overshot the cap. Called BEFORE the ElevenLabs
 * request: see the RESERVE-THEN-SPEND note in the file header.
 */
function recordUsage(uid, key, chars, currentCount, limit, idToken) {
  if (!(chars > 0)) return Promise.resolve(null);
  var path = usagePathFor(uid, key);
  return dbPut(path, { '.sv': { increment: chars } }, idToken).then(function (r) {
    // ONLY a real transport failure earns the non-atomic absolute rewrite, and
    // only when the pre-read count is trustworthy (unlimited tiers skip the
    // read). A successful write that reported null — RTDB does that for several
    // shapes, and for 204/print=silent — used to land here too, and the
    // absolute value it wrote clobbered every concurrent request's characters.
    if (dbWriteFailed(r) && limit >= 0) return dbPut(path, currentCount + chars, idToken);
    return r;
  }).catch(function (e) {
    logErr('recordUsage', e);
    return null;
  });
}

/**
 * Give back characters reserved for a call that never cost anything. Atomic and
 * best-effort, exactly like the reservation it undoes.
 */
function refundUsage(uid, key, chars, idToken) {
  if (!(chars > 0) || !uid) return Promise.resolve(null);
  return dbPut(usagePathFor(uid, key), { '.sv': { increment: -chars } }, idToken)
    .catch(function (e) {
      logErr('refundUsage', e);
      return null;
    });
}

/**
 * Money as INTEGER microdollars so the atomic increment is exact. Characters as
 * plain integers next to it, because with ElevenLabs the character count is the
 * honest number and the dollars are an estimate from a rate the owner typed.
 */
function recordSpend(uid, key, chars, cost, profile, idToken) {
  var micro = (typeof cost === 'number' && isFinite(cost) && cost > 0) ? Math.round(cost * 1e6) : 0;
  if (!(chars > 0) && !(micro > 0)) return Promise.resolve(null);
  var incC = { '.sv': { increment: chars > 0 ? chars : 0 } };
  var incU = { '.sv': { increment: micro } };
  var one = { '.sv': { increment: 1 } };
  var day = 'voiceSpend/' + key + '/';
  var patch = {};
  patch[day + 'total6'] = incU;
  patch[day + 'chars'] = incC;
  patch[day + 'calls'] = one;
  patch[day + 'byProfile/' + safeKey(profile) + '/usd6'] = incU;
  patch[day + 'byProfile/' + safeKey(profile) + '/chars'] = incC;
  patch[day + 'byUser/' + safeKey(uid) + '/usd6'] = incU;
  patch[day + 'byUser/' + safeKey(uid) + '/chars'] = incC;
  patch[day + 'byUser/' + safeKey(uid) + '/n'] = one;
  return dbPatch('', patch, idToken).catch(function (e) {
    logErr('recordSpend', e);
    return null;
  });
}

/**
 * Microdollars spent site-wide on VOICE on `key`'s day, plus whatever the text
 * AI spent, because the ceiling in aiConfig.softCapUsd is one budget for the
 * whole site rather than two half-budgets that can each be under cap while the
 * bill is double. Returns 0 when either node is unreadable — the ceiling can
 * only ever under-report, never lock people out over a permissions problem.
 */
function readSpendToday(key, idToken) {
  return Promise.all([
    dbGet('voiceSpend/' + key + '/total6', idToken),
    dbGet('aiSpend/' + key + '/total6', idToken)
  ]).then(function (pair) {
    var a = (typeof pair[0] === 'number' && isFinite(pair[0]) && pair[0] > 0) ? pair[0] : 0;
    var b = (typeof pair[1] === 'number' && isFinite(pair[1]) && pair[1] > 0) ? pair[1] : 0;
    return a + b;
  }).catch(function () { return 0; });
}

/* --------------------------------------------------------------- test surface
 * Pure helpers, exported so the tests can prove the tier gate, the character
 * cap and the error mapping without a live ElevenLabs key or a live Firebase.
 * Netlify only ever calls exports.handler; nothing here is reachable over HTTP.
 * ------------------------------------------------------------------------- */
exports._internals = {
  OWNER_EMAIL: OWNER_EMAIL,
  PROFILE_IDS: PROFILE_IDS,
  PREMIUM_TIERS: PREMIUM_TIERS,
  DEFAULT_VOICE_LIMITS: DEFAULT_VOICE_LIMITS,
  DEFAULT_MODEL_ID: DEFAULT_MODEL_ID,
  DEFAULT_USD_PER_1K_CHARS: DEFAULT_USD_PER_1K_CHARS,
  TTS_MODELS: TTS_MODELS,
  MAX_TEXT_CHARS: MAX_TEXT_CHARS,
  VOICES_CACHE_MS: VOICES_CACHE_MS,
  normalizeConfig: normalizeConfig,
  normalizeProfile: normalizeProfile,
  normalizeVoiceId: normalizeVoiceId,
  normalizeModelId: normalizeModelId,
  normalizeVoiceProfiles: normalizeVoiceProfiles,
  normalizeVoiceLimits: normalizeVoiceLimits,
  normalizeVoiceSettings: normalizeVoiceSettings,
  resolveTier: resolveTier,
  voiceLimitFor: voiceLimitFor,
  tierMayUsePremiumVoice: tierMayUsePremiumVoice,
  estimateCostUsd: estimateCostUsd,
  isQuotaExhausted: isQuotaExhausted,
  rejectsNormalizationFlag: rejectsNormalizationFlag,
  upstreamError: upstreamError,
  trimVoice: trimVoice,
  modelCatalog: modelCatalog,
  dayKey: dayKey,
  safeKey: safeKey,
  safeAction: safeAction,
  isOwnerUser: isOwnerUser,
  usagePathFor: usagePathFor
};
