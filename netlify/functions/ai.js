'use strict';
/* ============================================================================
 * MedMaster AI proxy  —  netlify/functions/ai.js
 * ----------------------------------------------------------------------------
 * Keeps the owner's Anthropic API key on the server. The browser never sees it.
 *
 * Flow for every request:
 *   1. CORS preflight / method check
 *   2. Verify the caller's Firebase ID token (RS256 + Google's public x509 certs)
 *   3. Load the user's tier (/userTiers/<uid>) and app AI config (/appConfig/aiConfig)
 *   4. Enforce: AI enabled, model allowlist, daily quota, maxTokens cap
 *   5. Proxy to https://api.anthropic.com/v1/messages (streaming or not)
 *   6. Record one usage tick in /aiUsage/<uid>/<YYYY-MM-DD>
 *
 * Environment variables (set in Netlify -> Site settings -> Environment variables):
 *   ANTHROPIC_API_KEY    (required)  sk-ant-...
 *   FIREBASE_DB_URL      (required)  https://medmaster-a2507-default-rtdb.firebaseio.com
 *   FIREBASE_PROJECT_ID  (optional)  medmaster-a2507  (derived from DB URL if absent)
 *   FIREBASE_DB_SECRET   (optional)  legacy DB secret; if absent we forward the
 *                                    user's own ID token to the Realtime Database
 *                                    REST API and rely on security rules.
 *
 * No external dependencies — Netlify has no package.json here. Node 18+ globals
 * (fetch, AbortController, TextDecoder) and node:crypto only.
 * ==========================================================================*/

var crypto = require('crypto');

/* ------------------------------------------------------------------ config */

var OWNER_EMAIL         = 'codingky@gmail.com';
var ANTHROPIC_URL       = 'https://api.anthropic.com/v1/messages';
var ANTHROPIC_VERSION   = '2023-06-01';
var GOOGLE_CERT_URL     = 'https://www.googleapis.com/service_accounts/v1/cert/securetoken@system.gserviceaccount.com';
var QUOTA_TZ            = 'America/New_York'; // day boundary for daily limits (client uses the same)
var UPSTREAM_TIMEOUT_MS = 120000;
var MAX_MESSAGES        = 60;
var MAX_CHARS_TOTAL     = 200000;

// Mirror of DEFAULT_AI_CONFIG in js/ai.js. Used when /appConfig/aiConfig is
// missing or unreadable so the app still works on a fresh deploy.
var DEFAULT_AI_CONFIG = {
  enabled: true,
  allowModelChoice: false,
  tiers: {
    free:       { models: ['claude-haiku-4-5-20251001'], dailyLimit: 25, maxTokens: 1024 },
    plus:       { models: ['claude-haiku-4-5-20251001', 'claude-sonnet-5'], dailyLimit: 200, maxTokens: 2048 },
    pro:        { models: ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5', 'claude-fable-5'], dailyLimit: 1000, maxTokens: 4096 },
    instructor: { models: ['*'], dailyLimit: -1, maxTokens: 8192 }
  }
};

var DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/* ------------------------------------------------------------- tiny helpers */

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
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
  // Server-side only. Never echoed to the client.
  try {
    console.error('[ai] ' + where + ': ' + (err && err.stack ? err.stack : String(err)));
  } catch (e) { /* ignore */ }
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
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
  } catch (e) {
    return date.toISOString().slice(0, 10);
  }
}

// Timestamp (ms) of the next local-midnight rollover in QUOTA_TZ.
// Walks forward in coarse then fine steps so we never hand-roll timezone math.
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

// Google publishes the signing certificates as { kid: "-----BEGIN CERTIFICATE-----..." }.
// Cached in module scope for the lifetime of the warm lambda, honoring max-age.
var certCache = { certs: null, expiresAt: 0 };

function getGoogleCerts() {
  var now = Date.now();
  if (certCache.certs && now < certCache.expiresAt) return Promise.resolve(certCache.certs);
  return fetchWithTimeout(GOOGLE_CERT_URL, { method: 'GET' }, 10000).then(function (res) {
    if (!res.ok) throw new Error('cert fetch status ' + res.status);
    var cc = res.headers.get('cache-control') || '';
    var m = /max-age=(\d+)/i.exec(cc);
    var ttl = m ? parseInt(m[1], 10) * 1000 : 3600000;
    if (!(ttl > 60000)) ttl = 3600000;
    return res.json().then(function (certs) {
      certCache.certs = certs;
      certCache.expiresAt = Date.now() + ttl;
      return certs;
    });
  });
}

function verifySignature(signingInput, signatureB64url, certPem) {
  var sig = b64urlToBuffer(signatureB64url);
  var key = certPem;
  // Prefer extracting the SPKI public key; fall back to letting OpenSSL read the cert.
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

/**
 * Verify a Firebase Auth ID token without the Admin SDK.
 * Resolves { uid, email, emailVerified, claims } or rejects with an Error.
 */
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
    var skew = 300; // 5 minutes of clock tolerance

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

// The function has no service-account credentials. It authenticates to the RTDB
// REST API either with the optional legacy DB secret (full access) or with the
// caller's own ID token (rules-scoped). See AI_SETUP.md for the matching rules.
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

function dbPut(path, value, idToken) {
  var base = dbBase();
  if (!base) return Promise.resolve(null);
  var url = base + '/' + path + '.json?' + dbAuthParam(idToken);
  return fetchWithTimeout(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  }, 10000).then(function (res) {
    if (!res.ok) {
      logErr('dbPut ' + path, new Error('status ' + res.status));
      return null;
    }
    return res.json().catch(function () { return null; });
  }).catch(function (e) {
    logErr('dbPut ' + path, e);
    return null;
  });
}

/* ------------------------------------------------------------- tier plumbing */

function normalizeConfig(raw) {
  var cfg = {
    enabled: true,
    allowModelChoice: false,
    tiers: {}
  };
  var src = (raw && typeof raw === 'object') ? raw : {};
  cfg.enabled = src.enabled !== false;
  cfg.allowModelChoice = src.allowModelChoice === true;

  var name, dt, st;
  for (name in DEFAULT_AI_CONFIG.tiers) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_AI_CONFIG.tiers, name)) continue;
    dt = DEFAULT_AI_CONFIG.tiers[name];
    cfg.tiers[name] = {
      models: dt.models.slice(),
      dailyLimit: dt.dailyLimit,
      maxTokens: dt.maxTokens
    };
  }
  var srcTiers = (src.tiers && typeof src.tiers === 'object') ? src.tiers : {};
  for (name in srcTiers) {
    if (!Object.prototype.hasOwnProperty.call(srcTiers, name)) continue;
    st = srcTiers[name] || {};
    var base = cfg.tiers[name] || { models: [], dailyLimit: 0, maxTokens: 1024 };
    cfg.tiers[name] = {
      models: Array.isArray(st.models) ? st.models.slice()
            : (st.models && typeof st.models === 'object') ? Object.keys(st.models).filter(function (k) { return st.models[k]; })
            : base.models,
      dailyLimit: typeof st.dailyLimit === 'number' ? st.dailyLimit : base.dailyLimit,
      maxTokens: typeof st.maxTokens === 'number' ? st.maxTokens : base.maxTokens
    };
  }
  return cfg;
}

function resolveTier(cfg, email, tierRecord) {
  if (email && email === OWNER_EMAIL) return 'instructor';
  var t = 'free';
  if (tierRecord && typeof tierRecord === 'object' && typeof tierRecord.tier === 'string') {
    t = tierRecord.tier;
    var exp = tierRecord.expiresAt;
    if (exp && typeof exp === 'number' && Date.now() > exp) t = 'free';
  }
  if (!cfg.tiers[t]) t = 'free';
  return t;
}

function tierAllowsModel(rules, modelId) {
  if (!rules || !Array.isArray(rules.models)) return false;
  if (rules.models.indexOf('*') !== -1) return true;
  return rules.models.indexOf(modelId) !== -1;
}

/* ------------------------------------------------------ request sanitization */

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return null;
  var out = [];
  var total = 0;
  var i, m, role, content;
  for (i = 0; i < raw.length && out.length < MAX_MESSAGES; i++) {
    m = raw[i];
    if (!m || typeof m !== 'object') continue;
    role = m.role === 'assistant' ? 'assistant' : 'user';
    content = m.content;
    if (typeof content === 'string') {
      if (!content.length) continue;
      total += content.length;
    } else if (Array.isArray(content)) {
      // Allow structured blocks but only text ones — no images/tools from the client.
      var blocks = [];
      for (var j = 0; j < content.length; j++) {
        var b = content[j];
        if (b && b.type === 'text' && typeof b.text === 'string') {
          blocks.push({ type: 'text', text: b.text });
          total += b.text.length;
        }
      }
      if (!blocks.length) continue;
      content = blocks;
    } else {
      continue;
    }
    if (total > MAX_CHARS_TOTAL) break;
    out.push({ role: role, content: content });
  }
  return out.length ? out : null;
}

/* ------------------------------------------------------------ SSE aggregation */

// Netlify's classic (exports.handler) runtime buffers the response body, so we
// read the upstream SSE stream fully and hand back the raw event text with an
// SSE content type. The browser client parses it with the same reader either
// way, so nothing downstream has to change. (True incremental streaming would
// require a Netlify Edge Function / Functions 2.0 handler.)
function readSSE(res) {
  if (!res.body || typeof res.body.getReader !== 'function') {
    return res.text();
  }
  var reader = res.body.getReader();
  var decoder = new TextDecoder('utf-8');
  var chunks = '';
  function pump() {
    return reader.read().then(function (r) {
      if (r.done) {
        chunks += decoder.decode();
        return chunks;
      }
      chunks += decoder.decode(r.value, { stream: true });
      if (chunks.length > 8 * 1024 * 1024) { // hard safety cap
        try { reader.cancel(); } catch (e) {}
        return chunks;
      }
      return pump();
    });
  }
  return pump();
}

function textFromAnthropic(data) {
  var out = '';
  if (data && Array.isArray(data.content)) {
    for (var i = 0; i < data.content.length; i++) {
      var block = data.content[i];
      if (block && block.type === 'text' && typeof block.text === 'string') out += block.text;
    }
  }
  return out;
}

/* --------------------------------------------------------------- the handler */

exports.handler = function (event) {
  var origin = (event && event.headers && (event.headers.origin || event.headers.Origin)) || '*';

  // ---- 1. preflight / method ------------------------------------------------
  if (event && event.httpMethod === 'OPTIONS') {
    return Promise.resolve({ statusCode: 204, headers: corsHeaders(origin), body: '' });
  }
  if (!event || event.httpMethod !== 'POST') {
    return Promise.resolve(fail(405, 'server', 'Use POST.', origin));
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logErr('config', new Error('ANTHROPIC_API_KEY is not set'));
    return Promise.resolve(fail(500, 'server', 'AI is not configured on the server yet.', origin));
  }

  var projectId = projectIdFromEnv();
  if (!projectId || !dbBase()) {
    logErr('config', new Error('FIREBASE_DB_URL / FIREBASE_PROJECT_ID missing'));
    return Promise.resolve(fail(500, 'server', 'AI is not configured on the server yet.', origin));
  }

  var body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return Promise.resolve(fail(400, 'server', 'Malformed request body.', origin));
  }

  var idToken = body.idToken;
  if (!idToken) {
    return Promise.resolve(fail(401, 'no-auth', 'You need to be signed in to use AI features.', origin));
  }

  var messages = sanitizeMessages(body.messages);
  if (!messages) {
    return Promise.resolve(fail(400, 'server', 'No messages supplied.', origin));
  }

  var user = null, cfg = null, tier = 'free', rules = null, model = DEFAULT_MODEL;
  var isOwner = false, usedToday = 0, limit = 0, key = '';

  // ---- 2. verify the ID token ----------------------------------------------
  return verifyIdToken(idToken, projectId).catch(function (e) {
    logErr('token verify', e);
    throw { httpStatus: 401, code: 'no-auth', message: 'Your session expired. Sign in again to keep using AI.' };
  }).then(function (u) {
    user = u;
    isOwner = (u.email === OWNER_EMAIL);

    // ---- 3. tier + config --------------------------------------------------
    return Promise.all([
      dbGet('userTiers/' + encodeURIComponent(u.uid), idToken),
      dbGet('appConfig/aiConfig', idToken)
    ]);
  }).then(function (pair) {
    cfg = normalizeConfig(pair[1]);
    tier = resolveTier(cfg, user.email, pair[0]);
    rules = cfg.tiers[tier] || cfg.tiers.free || DEFAULT_AI_CONFIG.tiers.free;

    // ---- 4a. global kill switch (owner bypasses) ---------------------------
    if (cfg.enabled === false && !isOwner) {
      throw { httpStatus: 503, code: 'ai-disabled', message: 'AI features are temporarily turned off. Check back soon.' };
    }

    // ---- 4b. model allowlist -----------------------------------------------
    model = (typeof body.model === 'string' && body.model) ? body.model : null;
    if (!model) {
      model = (Array.isArray(rules.models) && rules.models.length && rules.models[0] !== '*')
        ? rules.models[0] : DEFAULT_MODEL;
    }
    if (!isOwner && !tierAllowsModel(rules, model)) {
      throw {
        httpStatus: 403,
        code: 'tier-denied',
        message: 'Your ' + tier + ' plan does not include ' + model + '.',
        extra: { allowedModels: Array.isArray(rules.models) ? rules.models : [], tier: tier }
      };
    }

    // ---- 4c. daily quota ----------------------------------------------------
    key = dayKey(new Date(), QUOTA_TZ);
    limit = typeof rules.dailyLimit === 'number' ? rules.dailyLimit : 0;
    if (isOwner) limit = -1;
    if (limit === 0) {
      throw {
        httpStatus: 429, code: 'quota-exceeded',
        message: 'Your plan has no AI calls available.',
        extra: { used: 0, limit: 0, resetsAt: nextResetMs(QUOTA_TZ) }
      };
    }
    if (limit < 0) return 0; // unlimited — skip the read
    return dbGet('aiUsage/' + encodeURIComponent(user.uid) + '/' + key, idToken);
  }).then(function (count) {
    usedToday = typeof count === 'number' ? count : 0;
    if (limit >= 0 && usedToday >= limit) {
      throw {
        httpStatus: 429, code: 'quota-exceeded',
        message: 'You have used all ' + limit + ' of your AI messages for today.',
        extra: { used: usedToday, limit: limit, resetsAt: nextResetMs(QUOTA_TZ) }
      };
    }

    // ---- 5. build + send the upstream request -------------------------------
    var capTokens = typeof rules.maxTokens === 'number' && rules.maxTokens > 0 ? rules.maxTokens : 1024;
    var wanted = typeof body.maxTokens === 'number' && body.maxTokens > 0 ? Math.floor(body.maxTokens) : capTokens;
    var maxTokens = Math.max(16, Math.min(wanted, capTokens));

    var temperature = 1;
    if (typeof body.temperature === 'number' && isFinite(body.temperature)) {
      temperature = Math.max(0, Math.min(1, body.temperature));
    }

    var payload = {
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      messages: messages
    };
    if (typeof body.system === 'string' && body.system.trim()) {
      payload.system = body.system.slice(0, 40000);
    }
    var wantStream = body.stream === true;
    if (wantStream) payload.stream = true;

    return fetchWithTimeout(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify(payload)
    }, UPSTREAM_TIMEOUT_MS).then(function (res) {
      if (!res.ok) {
        // Log the real upstream body server-side; give the client a safe summary.
        return res.text().then(function (t) {
          logErr('anthropic ' + res.status, new Error(t.slice(0, 2000)));
          var msg = 'The AI service could not complete that request.';
          if (res.status === 429) msg = 'The AI service is rate limited right now. Try again in a moment.';
          if (res.status === 529 || res.status === 503) msg = 'The AI service is overloaded. Try again in a moment.';
          if (res.status === 401 || res.status === 403) msg = 'The AI service rejected the server key. The site owner has been notified.';
          if (res.status === 400) msg = 'That request was not valid for the selected model.';
          throw { httpStatus: 502, code: 'server', message: msg };
        }, function () {
          throw { httpStatus: 502, code: 'server', message: 'The AI service could not complete that request.' };
        });
      }

      // Count the call now that upstream accepted it.
      var bump = recordUsage(user.uid, key, usedToday, limit, idToken);

      if (wantStream) {
        return readSSE(res).then(function (sse) {
          return bump.then(function () {
            var headers = corsHeaders(origin);
            headers['Content-Type'] = 'text/event-stream; charset=utf-8';
            headers['Cache-Control'] = 'no-cache, no-store';
            headers['X-MM-Tier'] = tier;
            headers['X-MM-Model'] = model;
            headers['X-MM-Used'] = String(limit < 0 ? -1 : usedToday + 1);
            headers['X-MM-Limit'] = String(limit);
            return { statusCode: 200, headers: headers, body: sse };
          });
        });
      }

      return res.json().then(function (data) {
        return bump.then(function () {
          var usage = data && data.usage ? data.usage : {};
          return json(200, {
            text: textFromAnthropic(data),
            model: data && data.model ? data.model : model,
            stopReason: data ? data.stop_reason : null,
            tier: tier,
            used: limit < 0 ? -1 : usedToday + 1,
            limit: limit,
            resetsAt: nextResetMs(QUOTA_TZ),
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0
          }, origin);
        });
      });
    }, function (e) {
      logErr('anthropic fetch', e);
      var aborted = e && (e.name === 'AbortError' || String(e).indexOf('abort') !== -1);
      throw {
        httpStatus: 504,
        code: 'server',
        message: aborted ? 'The AI took too long to respond. Try a shorter request.'
                         : 'Could not reach the AI service. Try again in a moment.'
      };
    });
  }).catch(function (e) {
    if (e && e.code && e.httpStatus) {
      return fail(e.httpStatus, e.code, e.message, origin, e.extra);
    }
    logErr('unhandled', e);
    return fail(500, 'server', 'Something went wrong on our end. Try again in a moment.', origin);
  });
};

/* --------------------------------------------------------------- usage write */

// Best-effort: never fail the user's request because the counter write failed.
function recordUsage(uid, key, currentCount, limit, idToken) {
  if (limit < 0) return Promise.resolve(); // unlimited tiers are not metered
  var path = 'aiUsage/' + encodeURIComponent(uid) + '/' + key;
  // Prefer the RTDB atomic server-side increment so parallel calls cannot race.
  return dbPut(path, { '.sv': { increment: 1 } }, idToken).then(function (r) {
    if (r === null) return dbPut(path, currentCount + 1, idToken);
    return r;
  }).catch(function (e) {
    logErr('recordUsage', e);
    return null;
  });
}
