'use strict';
/* ============================================================================
 * MedMaster AI proxy  —  netlify/functions/ai.js
 * ----------------------------------------------------------------------------
 * Keeps the owner's OpenRouter API key on the server. The browser never sees it.
 *
 * Two actions, both POST /api/ai:
 *
 *   { action: 'chat' }        (the default — omit `action` and you get this)
 *     1. CORS preflight / method check
 *     2. Verify the caller's Firebase ID token (RS256 + Google's public x509 certs)
 *     3. Load the user's tier (/userTiers/<uid>) and app AI config (/appConfig/aiConfig)
 *     4. Enforce: AI enabled, model allowlist, daily quota, maxTokens cap,
 *        and the owner's daily DOLLAR ceiling (/appConfig/aiConfig/softCapUsd)
 *     5. Proxy to https://openrouter.ai/api/v1/chat/completions (streaming or not)
 *     6. Record one usage tick in /aiUsage/<uid>/<YYYY-MM-DD> and the real dollar
 *        cost OpenRouter reported into /aiSpend/<YYYY-MM-DD> (see SPEND LEDGER)
 *
 *   { action: 'listModels' }  (OWNER ONLY)
 *     Server-side fetch of https://openrouter.ai/api/v1/models, trimmed down to
 *     {id, name, contextLength, promptPrice, completionPrice, isFree} and cached
 *     in module memory for ten minutes. Powers the Admin Panel model picker.
 *
 * WHO IS THE OWNER
 *   OWNER_EMAIL *and* a verified email claim. `email` on a Firebase ID token is
 *   only as trustworthy as the sign-in provider that put it there, so the
 *   `email_verified` flag is load-bearing everywhere the owner is granted
 *   something — see isOwnerUser() below. tts.js applies the identical rule.
 *
 * QUOTA IS RESERVED, NOT TALLIED
 *   /aiUsage/<uid>/<day> is INCREMENTED before the upstream call and the value
 *   the increment returns is checked, rather than read first and written after.
 *   A read-then-write gate is a TOCTOU hole: N parallel tabs all read the same
 *   stale total and all pass, so the daily limit multiplies by N. A request that
 *   turns out to have cost nothing (upstream 4xx/5xx, network failure, an image
 *   model that returned no image) refunds its reservation. Same discipline, same
 *   wording, as tts.js.
 *
 * OpenRouter speaks the OpenAI chat-completions shape, NOT the Anthropic shape:
 *   - the system prompt is the first message with role 'system', not a top-level field
 *   - non-streaming text is at data.choices[0].message.content
 *   - streaming deltas are at choices[0].delta.content and end with `data: [DONE]`
 *   - usage is {prompt_tokens, completion_tokens}, and OpenRouter reports the real
 *     dollar cost, so nothing here needs a hardcoded per-model price table
 *     (prices vary enormously across the catalog and change without notice)
 *
 * Environment variables (set in Netlify -> Site settings -> Environment variables):
 *   OPENROUTER_API_KEY   (required)  sk-or-v1-...   from https://openrouter.ai/keys
 *   FIREBASE_DB_URL      (required)  https://medmaster-a2507-default-rtdb.firebaseio.com
 *   FIREBASE_PROJECT_ID  (optional)  medmaster-a2507  (derived from DB URL if absent)
 *   FIREBASE_DB_SECRET   (optional)  legacy DB secret; if absent we forward the
 *                                    user's own ID token to the Realtime Database
 *                                    REST API and rely on security rules.
 *
 * No external dependencies — Netlify has no package.json here. Node 18+ globals
 * (fetch, AbortController, TextDecoder) and node:crypto only.
 *
 * ----------------------------------------------------------------------------
 * SPEND LEDGER  —  /aiSpend/<YYYY-MM-DD>   (all money stored as INTEGER
 * microdollars, because RTDB's atomic {'.sv':{increment:n}} is exact for
 * integers and lossy for floats. $0.000123 -> 123.)
 *
 *   /aiSpend/<day>/total6                 microdollars spent site-wide that day
 *   /aiSpend/<day>/calls                  number of billed calls that day
 *   /aiSpend/<day>/byModel/<slug>6        microdollars per model  (slug sanitized)
 *   /aiSpend/<day>/byFeature/<feature>6   microdollars per feature (tutor/sim/…)
 *   /aiSpend/<day>/byUser/<uid>/usd6      microdollars per user
 *   /aiSpend/<day>/byUser/<uid>/n         calls per user
 *
 * The whole ledger is written with ONE multi-path RTDB PATCH per call.
 *
 * REQUIRED SECURITY RULES — paste this next to the existing "aiUsage" block or
 * the ledger silently writes nothing (every write here is best-effort and never
 * fails the student's request). Admin Panel -> AI -> Spend shows the same
 * snippet and tells the owner when the node is unreadable.
 *
 *   "aiSpend": {
 *     ".read":  "auth != null && auth.token.email === 'codingky@gmail.com'",
 *     "$day":   { ".write": "auth != null" }
 *   }
 *
 * (Writes are increment-only server values issued by this function on behalf of
 * the signed-in caller; nothing in the browser ever writes here.)
 * ==========================================================================*/

var crypto = require('crypto');

/* ------------------------------------------------------------------ config */

var OWNER_EMAIL         = 'codingky@gmail.com';
var OPENROUTER_URL      = 'https://openrouter.ai/api/v1/chat/completions';
var OPENROUTER_MODELS   = 'https://openrouter.ai/api/v1/models';
// OpenRouter attribution headers — these put the app on the OpenRouter leaderboard
// and are what shows up in the activity log next to each request.
var OPENROUTER_REFERER  = 'https://medmaster.guru';
var OPENROUTER_TITLE    = 'MedMaster';
// Ask OpenRouter to report token counts and the real dollar cost. Set to false if
// a provider ever rejects the field; everything else keeps working without it.
var REQUEST_USAGE_ACCOUNTING = true;
// Google's public x509 signing certificates for Firebase ID tokens, as
// { kid: "-----BEGIN CERTIFICATE-----..." }. This exact path matters — the
// /service_accounts/v1/cert/ form 404s, which silently breaks every token
// verification and surfaces to students as "your session expired".
// Both entries return the same shape; the second is a documented mirror kept
// as a fallback so one endpoint change cannot take AI down again.
var GOOGLE_CERT_URLS = [
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
  'https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com'
];
var GOOGLE_CERT_URL     = GOOGLE_CERT_URLS[0];
var QUOTA_TZ            = 'America/New_York'; // day boundary for daily limits (client uses the same)
var UPSTREAM_TIMEOUT_MS = 120000;
var MODELS_TIMEOUT_MS   = 20000;
var MODELS_CACHE_MS     = 10 * 60 * 1000; // ten minutes, so the admin panel cannot hammer it
var MAX_MESSAGES        = 60;
var MAX_CHARS_TOTAL     = 200000;

// Daily dollar ceiling defaults, overridable from /appConfig/aiConfig.
//   capMode 'warn'  -> the number is only reported in the admin panel
//   capMode 'block' -> the function refuses new calls once the day is over cap
var DEFAULT_SOFT_CAP_USD = 2;
var DEFAULT_CAP_MODE     = 'warn';
// Features a caller may tag a request with. Anything else is filed as 'other'.
// This list is doing two jobs now:
//   1. spend attribution  (/aiSpend/<day>/byFeature/<feature>6)
//   2. PER-FEATURE MODEL ROUTING — a tier may name a different model per feature
//      via tiers[tier].featureModels[<id>]. Only ids in this list are routable;
//      anything else is dropped by normalizeFeatureModels().
// Mirrored by KNOWN_FEATURES in js/ai.js. Keep the two in sync.
var KNOWN_FEATURES = [
  'tutor', 'sim', 'patient', 'medadmin', 'community', 'questions', 'debrief', 'sbar', 'admin',
  // added for routing: image generation, code-blue drill, mnemonic art, avatars
  'image', 'codeblue', 'mnemonic', 'avatar',
  'other'
];

/* ---------------------------------------------------------------- images ---
 * Image generation ({ action: 'generateImage' }) rides the same OpenRouter
 * /chat/completions endpoint, but is metered separately because one image costs
 * far more than one tutor message. See handleGenerateImage() below.
 * ------------------------------------------------------------------------- */
var IMAGE_TIMEOUT_MS      = 60000;   // images are slow; chat's 120s is for text
var DEFAULT_IMAGE_SIZE    = '512x512';
var MAX_IMAGE_PROMPT_CHARS = 4000;
// Stricter per-day cap, kept apart from the text dailyLimit. Overridable from
// /appConfig/aiConfig/imageLimits. -1 = unlimited, 0 = not in this plan.
// PER MONTH (not per day — see monthKey). Modelled against real OpenRouter
// prices at $0.03/image: plus 15/mo = $0.45, pro 50/mo = $1.50. Instructor is
// capped rather than unlimited because -1 is unbounded financial exposure on a
// single account.
var DEFAULT_IMAGE_LIMITS  = { free: 0, plus: 15, pro: 50, instructor: 200 };
// Image calls are counted at /aiUsage/<uid>/<YYYY-MM-DD>_img so they never eat
// into the student's text allowance (and text calls never eat into images).
var IMAGE_USAGE_SUFFIX    = '_img';

/* --------------------------------------------------------- verified slugs ---
 * Every slug below was present in OpenRouter's live /api/v1/models catalog on
 * 2026-08-12, with the prices and context lengths recorded in MODEL_PRICING.md.
 * The old note here said only two were confirmed and the rest might 404; that
 * is no longer true and the warning has been removed rather than left to rot.
 *
 * MIRROR OF js/ai.js. VERIFIED_TEXT_MODELS / _FREE_ / _IMAGE_ / _VIDEO_ and the
 * DEFAULT_AI_CONFIG below must stay byte-identical to the client copy - the
 * client previews the routing decision and the server enforces it, so a drift
 * between the two shows up as "the panel said one model, the bill says another".
 * ------------------------------------------------------------------------- */
var VERIFIED_TEXT_MODELS = [
  'deepseek/deepseek-v4-flash-0731',
  'google/gemini-3.1-flash-lite',
  'deepseek/deepseek-v4-flash',
  'z-ai/glm-5.2',
  'google/gemini-3-flash-preview',
  'deepseek/deepseek-v4-pro',
  'tencent/hy3',
  'xiaomi/mimo-v2.5',
  'google/gemini-3.6-flash',
  'qwen/qwen3.8-max'
];

var VERIFIED_FREE_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
  'poolside/laguna-s-2.1:free',
  'poolside/laguna-xs-2.1:free',
  'inclusionai/ling-3.0-tiny:free',
  'liquid/lfm-2.5-2.6b:free',
  'cohere/north-mini-code:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nvidia/nemotron-3.5-content-safety:free'
];

var VERIFIED_IMAGE_MODELS = [
  'x-ai/grok-imagine-image-2.0',
  'qwen/qwen-image-3',
  'qwen/qwen-image-3-pro',
  'black-forest-labs/flux.2-klein-4b',
  'black-forest-labs/flux.2-pro',
  'black-forest-labs/flux.2-max',
  'recraft/recraft-v4.1-utility',
  'recraft/recraft-v4.1',
  'recraft/recraft-v4',
  'recraft/recraft-v3',
  'krea/krea-2-medium-turbo',
  'bytedance-seed/seedream-4.5',
  'google/gemini-2.5-flash-image',
  'google/gemini-3.1-flash-image',
  'google/gemini-3.1-flash-lite-image',
  'google/gemini-3-pro-image',
  'openai/gpt-image-1-mini',
  'openai/gpt-image-2',
  'openai/gpt-5.4-image-2',
  'microsoft/mai-image-2.5-pro'
];

var VERIFIED_VIDEO_MODELS = [
  'bytedance/seedance-2.0-mini',
  'bytedance/seedance-2.5',
  'bytedance/seedance-2.0-fast',
  'bytedance/seedance-2.0',
  'bytedance/seedance-1.5-pro',
  'black-forest-labs/flux-3-video',
  'minimax/hailuo-3',
  'minimax/hailuo-2.3',
  'runway/aleph-2',
  'runway/gen-4.5',
  'x-ai/grok-imagine-video-1.5',
  'x-ai/grok-imagine-video',
  'alibaba/happyhorse-1.1',
  'alibaba/happyhorse-1.0',
  'alibaba/wan-2.7',
  'alibaba/wan-2.6',
  'kwaivgi/kling-v3.0-pro',
  'kwaivgi/kling-v3.0-std',
  'kwaivgi/kling-video-o1',
  'google/veo-3.1-fast',
  'google/veo-3.1-lite',
  'google/veo-3.1',
  'openai/sora-2-pro'
];

// The five paid TEXT models the tier defaults are built from, in healthcare
// rank order. Kept as its own name because DEFAULT_MODEL comes off the front.
var VERIFIED_PAID_MODELS = VERIFIED_TEXT_MODELS.slice(0, 5);

var VERIFIED_MODEL_IDS = []
  .concat(VERIFIED_TEXT_MODELS, VERIFIED_FREE_MODELS, VERIFIED_IMAGE_MODELS, VERIFIED_VIDEO_MODELS);

/* ------------------------------------------------------ default AI config ---
 * EXACT mirror of DEFAULT_AI_CONFIG in js/ai.js, which is itself a copy of
 * RECOMMENDED_AI_CONFIG there. Used when /appConfig/aiConfig is missing or
 * unreadable so the app still works on a fresh deploy.
 *
 * THE ROUTING ARGUMENT, in one line each (the long form lives in js/ai.js):
 *   - deepseek/deepseek-v4-flash-0731 is #1 on healthcare AND $0.08/$0.18 per
 *     1M tokens, so it is the workhorse for every text feature on every tier.
 *   - z-ai/glm-5.2 ($0.49/$1.54) takes debrief and SBAR on Pro/Instructor only:
 *     graded feedback, once per simulation, worth the deeper model.
 *   - images: gemini-2.5-flash-image (~$0.039, proven response shape) on Plus,
 *     flux.2-klein-4b (~$0.014 at 156ms, cheapest AND fastest) on Pro+.
 *   - free: three ':free' slugs verified live on 2026-08-12, Nemotron 3 Ultra
 *     (550B total / 55B active MoE, 1M context) first.
 *
 * `featureModels` is optional on every tier: { <KNOWN_FEATURES id>: '<slug>' }.
 * It only ever picks BETWEEN models the tier already allows — see
 * resolveModelWith(). Every entry below names a model in the same tier's list.
 * ------------------------------------------------------------------------- */
var DEFAULT_AI_CONFIG = {
  enabled: true,
  allowModelChoice: false,
  softCapUsd: DEFAULT_SOFT_CAP_USD,
  capMode: DEFAULT_CAP_MODE,
  imageLimits: { free: 0, plus: 5, pro: 40, instructor: -1 },
  tiers: {
    // Free gets a small real allowance rather than a wall (see DR10).
    free: {
      models: [
        'nvidia/nemotron-3-ultra-550b-a55b:free',
        'nvidia/nemotron-3-super-120b-a12b:free',
        'google/gemma-4-31b-it:free'
      ],
      // Text is ~$0.000124 per call, so 15/day costs about $0.06/user/month —
      // a far better free trial than 5 for effectively the same money.
      dailyLimit: 15,
      maxTokens: 1024,
      featureModels: {
        tutor: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        patient: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        codeblue: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        sim: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        medadmin: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        community: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        questions: 'nvidia/nemotron-3-ultra-550b-a55b:free'
      }
    },
    plus: {
      models: [
        'deepseek/deepseek-v4-flash-0731',
        'deepseek/deepseek-v4-flash',
        'google/gemini-3.1-flash-lite',
        'google/gemini-2.5-flash-image'
      ],
      dailyLimit: 150,
      maxTokens: 2048,
      featureModels: {
        tutor: 'deepseek/deepseek-v4-flash-0731',
        patient: 'deepseek/deepseek-v4-flash-0731',
        codeblue: 'deepseek/deepseek-v4-flash-0731',
        sim: 'deepseek/deepseek-v4-flash-0731',
        medadmin: 'deepseek/deepseek-v4-flash-0731',
        community: 'deepseek/deepseek-v4-flash-0731',
        questions: 'deepseek/deepseek-v4-flash-0731',
        debrief: 'deepseek/deepseek-v4-flash-0731',
        sbar: 'deepseek/deepseek-v4-flash-0731',
        image: 'google/gemini-2.5-flash-image',
        mnemonic: 'google/gemini-2.5-flash-image',
        avatar: 'google/gemini-2.5-flash-image'
      }
    },
    pro: {
      models: [
        'deepseek/deepseek-v4-flash-0731',
        'deepseek/deepseek-v4-flash',
        'google/gemini-3.1-flash-lite',
        'google/gemini-2.5-flash-image',
        'z-ai/glm-5.2',
        'google/gemini-3-flash-preview',
        'black-forest-labs/flux.2-klein-4b',
        'qwen/qwen-image-3'
      ],
      dailyLimit: 500,
      maxTokens: 4096,
      featureModels: {
        tutor: 'deepseek/deepseek-v4-flash-0731',
        patient: 'deepseek/deepseek-v4-flash-0731',
        codeblue: 'deepseek/deepseek-v4-flash-0731',
        sim: 'deepseek/deepseek-v4-flash-0731',
        medadmin: 'deepseek/deepseek-v4-flash-0731',
        community: 'deepseek/deepseek-v4-flash-0731',
        questions: 'deepseek/deepseek-v4-flash-0731',
        debrief: 'z-ai/glm-5.2',
        sbar: 'z-ai/glm-5.2',
        image: 'black-forest-labs/flux.2-klein-4b',
        mnemonic: 'black-forest-labs/flux.2-klein-4b',
        avatar: 'black-forest-labs/flux.2-klein-4b'
      }
    },
    instructor: {
      models: ['*'],
      // Was -1 (unlimited). A single compromised or runaway instructor account
      // could then bill without bound; 2000/day is ~$7.44/mo at current prices
      // and still far beyond any real teaching use.
      dailyLimit: 2000,
      maxTokens: 8192,
      featureModels: {
        tutor: 'deepseek/deepseek-v4-flash-0731',
        patient: 'deepseek/deepseek-v4-flash-0731',
        codeblue: 'deepseek/deepseek-v4-flash-0731',
        sim: 'deepseek/deepseek-v4-flash-0731',
        medadmin: 'deepseek/deepseek-v4-flash-0731',
        community: 'deepseek/deepseek-v4-flash-0731',
        questions: 'deepseek/deepseek-v4-flash-0731',
        debrief: 'z-ai/glm-5.2',
        sbar: 'z-ai/glm-5.2',
        image: 'black-forest-labs/flux.2-klein-4b',
        mnemonic: 'black-forest-labs/flux.2-klein-4b',
        avatar: 'black-forest-labs/flux.2-klein-4b'
      }
    }
  }
};

// #1 on healthcare and near-cheapest, so the last-resort fallback costs nothing
// to make the best one. Identical to DEFAULT_MODEL in js/ai.js.
var DEFAULT_MODEL = 'deepseek/deepseek-v4-flash-0731';

/* ------------------------------------------------------------- tiny helpers */

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Expose-Headers': 'X-MM-Tier, X-MM-Model, X-MM-Used, X-MM-Limit, X-MM-Prompt-Tokens, X-MM-Completion-Tokens, X-MM-Cost',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    // Defence in depth, and identical to tts.js. Everything this file returns is
    // JSON or SSE, some of it containing caller-influenced strings; nosniff stops
    // a browser deciding for itself that one of them is HTML. Set here rather
    // than in json() so the 204 preflight and warmup replies carry it too.
    'X-Content-Type-Options': 'nosniff'
  };
}

/**
 * A caller-supplied `action` that is about to be echoed back in an error.
 * Reduced to a short, boring charset: the diagnostic value is "which word did
 * you send", and no part of that needs punctuation, markup or 200 characters.
 * The untouched value is already in the server log if it is ever needed.
 * Mirrors safeAction() in tts.js.
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
  // Server-side only. Never echoed to the client.
  try {
    console.error('[ai] ' + where + ': ' + (err && err.stack ? err.stack : String(err)));
  } catch (e) { /* ignore */ }
}

// Non-fatal misconfiguration (a featureModels entry outside the tier's
// allow-list, an unusable size, ...). Server-side only, never echoed.
function logWarn(where, message) {
  try {
    console.warn('[ai] ' + where + ': ' + String(message));
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

/* Images are metered per MONTH, not per day.
 *
 * WHY: one image costs about what 240 tutor messages cost, so the image cap is
 * effectively the whole cost model. A *daily* image cap multiplies by 30 — the
 * old plus tier (5 images/day) was a $4.50/mo liability against a $7.99 price,
 * and pro (40/day) was $36/mo, which no sane price covers. A monthly bucket lets
 * a student generate a burst when they actually need art without turning that
 * burst into a recurring monthly floor. */
function monthKey(date, tz) {
  return dayKey(date, tz).slice(0, 7);   // YYYY-MM
}

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

/** Timestamp (ms) of the next MONTH rollover in QUOTA_TZ — the image reset. */
function nextMonthResetMs(tz) {
  var now = new Date();
  var k = monthKey(now, tz);
  var probe = new Date(now.getTime());
  // Step a day at a time until the YYYY-MM label changes. Slower than date maths
  // and immune to it: no month-length or DST special cases to get wrong.
  for (var i = 0; i < 40; i++) {
    probe = new Date(probe.getTime() + 86400000);
    if (monthKey(probe, tz) !== k) break;
  }
  probe.setHours(0, 0, 0, 0);
  return probe.getTime();
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

  // Try each known endpoint in order. Only the last failure is reported, and
  // the error names every URL tried so a future 404 is diagnosable from the
  // log line alone rather than requiring a code read.
  function attempt(i, lastErr) {
    if (i >= GOOGLE_CERT_URLS.length) {
      throw new Error('cert fetch failed from all endpoints (' +
        GOOGLE_CERT_URLS.join(', ') + ') - last error: ' +
        (lastErr && lastErr.message ? lastErr.message : 'unknown'));
    }
    return fetchWithTimeout(GOOGLE_CERT_URLS[i], { method: 'GET' }, 10000).then(function (res) {
      if (!res.ok) throw new Error('cert fetch status ' + res.status + ' from ' + GOOGLE_CERT_URLS[i]);
      var cc = res.headers.get('cache-control') || '';
      var m = /max-age=(\d+)/i.exec(cc);
      var ttl = m ? parseInt(m[1], 10) * 1000 : 3600000;
      if (!(ttl > 60000)) ttl = 3600000;
      return res.json().then(function (certs) {
        // A valid response is a non-empty map of kid -> PEM string.
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

/**
 * Sentinel for "the write did not happen" — a transport error or a non-2xx.
 *
 * It has to be distinguishable from a successful write that simply has no
 * payload to report: RTDB answers 204/empty for ?print=silent, and `null` is
 * also a perfectly legitimate JSON body. Collapsing both onto `null` made
 * recordUsage follow a SUCCESSFUL atomic increment with a non-atomic absolute
 * overwrite, clobbering every other in-flight request's ticks. Identity
 * comparison (r === DB_FAILED) is the only correct test. Mirrors tts.js.
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

// Multi-path update. RTDB's REST PATCH accepts deep keys ("a/b/c") and server
// values ({'.sv':{increment:n}}) per key, so the whole spend ledger for one call
// lands in a single request instead of six.
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

/* ------------------------------------------------------------- tier plumbing */

/**
 * Is this verified token the owner?
 *
 * BOTH halves are required, and the second half is the security-relevant one.
 * `email` is a claim, not an identity: Firebase will happily mint a token
 * carrying any address for sign-in methods that never prove control of the
 * mailbox (custom tokens, an admin-created account, some federated providers,
 * anything that ends up unverified). Comparing the address alone hands a
 * stranger the owner's powers — the model allow-list, the daily quota, the site
 * spend cap, the kill switch, arbitrary model selection, and the owner-only
 * catalog endpoint. `email_verified` is what turns the claim into evidence, so
 * it is checked at EVERY owner comparison in this file. tts.js applies the
 * identical rule via its own isOwnerUser().
 */
function isOwnerUser(u) {
  return !!u && u.email === OWNER_EMAIL && u.emailVerified === true;
}

/* ------------------------------------------------------ in-flight reservations
 *
 * Calls this CONTAINER has already reserved against a student's day but has not
 * finished serving, keyed <safe uid>/<usage key>.
 *
 * The durable record is the atomic RTDB increment; this map exists only because
 * the increment's RESULT is not knowable to the requests that are already past
 * their own read. Two requests handled by the same warm lambda would otherwise
 * both read the same stale daily total and both pass the gate. Entries are
 * added the instant the gate is passed (synchronously, so there is no await
 * between the check and the reservation) and removed when the request ends.
 * Mirrors charHolds in tts.js, which meters characters rather than calls.
 * ------------------------------------------------------------------------- */
var callHolds = Object.create(null);

function heldCalls(k) {
  var n = callHolds[k];
  return (typeof n === 'number' && isFinite(n) && n > 0) ? n : 0;
}

function holdCalls(k, n) {
  callHolds[k] = heldCalls(k) + (n > 0 ? n : 0);
}

function releaseCalls(k, n) {
  var left = heldCalls(k) - (n > 0 ? n : 0);
  if (left > 0) callHolds[k] = left; else delete callHolds[k];
}

/**
 * Sanitize a tier's `featureModels` map on read.
 *
 * This is admin-written data coming back out of Firebase, so it can be anything:
 * an object keyed by index, a stray array, numbers, nulls, a feature id that no
 * longer exists. Everything that is not `<known feature id> -> <non-empty string>`
 * is dropped silently. It can never do more than choose between models the tier
 * is already allowed to use (resolveModelWith() re-checks the allow-list), so a
 * junk value degrades to the tier default and never escalates anything.
 */
function normalizeFeatureModels(raw) {
  var out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  var k, id, v;
  for (k in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    id = String(k == null ? '' : k).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
    if (!id || KNOWN_FEATURES.indexOf(id) === -1) continue;
    v = raw[k];
    if (typeof v !== 'string') continue;
    v = v.trim();
    if (!v || v.length > 200) continue;
    out[id] = v;
  }
  return out;
}

// Per-day image cap by tier. Same defensive read: only finite numbers survive.
function normalizeImageLimits(raw) {
  var out = {}, k, n;
  for (k in DEFAULT_IMAGE_LIMITS) {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_IMAGE_LIMITS, k)) out[k] = DEFAULT_IMAGE_LIMITS[k];
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

// -1 for the owner, then the configured value, then the shipped default, then 0.
function imageLimitFor(cfg, tier, isOwner) {
  if (isOwner) return -1;
  var limits = (cfg && cfg.imageLimits && typeof cfg.imageLimits === 'object') ? cfg.imageLimits : DEFAULT_IMAGE_LIMITS;
  var v = limits[tier];
  if (typeof v === 'number' && isFinite(v)) return Math.floor(v);
  v = DEFAULT_IMAGE_LIMITS[tier];
  return typeof v === 'number' ? v : 0;
}

/* ============================================================================
 * MODEL RESOLUTION  —  the one order, mirrored byte-for-byte in js/ai.js
 * ----------------------------------------------------------------------------
 *   1. an explicit `model` from the caller, ONLY if the caller is the owner or
 *      the config allows model choice. Otherwise the field is ignored outright.
 *   2. tiers[tier].featureModels[feature], if it names a model the tier allows
 *   3. tiers[tier].models[0], the tier default
 *   4. DEFAULT_MODEL
 *
 * A featureModels entry pointing at a model outside the tier's allow-list is a
 * MISCONFIGURATION, not a grant: it is ignored, reported on `ignored`, and the
 * caller falls through to the tier default. Nothing in here can widen access —
 * whatever comes out is still run through tierAllowsModel() by the caller.
 * ==========================================================================*/
function resolveModelWith(rules, feature, opts) {
  var o = opts || {};
  var r = (rules && typeof rules === 'object') ? rules : {};
  var models = Array.isArray(r.models) ? r.models : [];
  var wildcard = models.indexOf('*') !== -1;
  var isOwner = o.isOwner === true;
  var allowed = function (m) { return !!m && (wildcard || isOwner || models.indexOf(m) !== -1); };
  var out = { model: DEFAULT_MODEL, source: 'default', ignored: '' };

  // 1. caller override
  var requested = (typeof o.requested === 'string') ? o.requested.trim() : '';
  if (requested && (isOwner || o.allowModelChoice === true)) {
    out.model = requested;
    out.source = 'caller';
    return out;
  }

  // 2. per-feature routing
  var fm = (r.featureModels && typeof r.featureModels === 'object' && !Array.isArray(r.featureModels))
    ? r.featureModels : null;
  var pick = (fm && typeof feature === 'string' && typeof fm[feature] === 'string') ? fm[feature].trim() : '';
  if (pick) {
    if (allowed(pick)) {
      out.model = pick;
      out.source = 'featureModels';
      return out;
    }
    out.ignored = pick; // degrade, never escalate
  }

  // 3. tier default  (a bare '*' is an allow-list, not a usable slug)
  if (models.length && typeof models[0] === 'string' && models[0] && models[0] !== '*') {
    out.model = models[0];
    out.source = 'tierDefault';
    return out;
  }

  // 4. shipped default
  return out;
}

function normalizeConfig(raw) {
  var cfg = {
    enabled: true,
    allowModelChoice: false,
    softCapUsd: DEFAULT_SOFT_CAP_USD,
    capMode: DEFAULT_CAP_MODE,
    imageLimits: normalizeImageLimits(null),
    tiers: {}
  };
  var src = (raw && typeof raw === 'object') ? raw : {};
  cfg.enabled = src.enabled !== false;
  cfg.allowModelChoice = src.allowModelChoice === true;
  if (typeof src.softCapUsd === 'number' && isFinite(src.softCapUsd) && src.softCapUsd >= 0) {
    cfg.softCapUsd = src.softCapUsd;
  }
  if (src.capMode === 'block' || src.capMode === 'warn') cfg.capMode = src.capMode;
  cfg.imageLimits = normalizeImageLimits(src.imageLimits);

  var name, dt, st;
  for (name in DEFAULT_AI_CONFIG.tiers) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_AI_CONFIG.tiers, name)) continue;
    dt = DEFAULT_AI_CONFIG.tiers[name];
    cfg.tiers[name] = {
      models: dt.models.slice(),
      dailyLimit: dt.dailyLimit,
      maxTokens: dt.maxTokens,
      featureModels: normalizeFeatureModels(dt.featureModels)
    };
  }
  var srcTiers = (src.tiers && typeof src.tiers === 'object') ? src.tiers : {};
  for (name in srcTiers) {
    if (!Object.prototype.hasOwnProperty.call(srcTiers, name)) continue;
    st = srcTiers[name] || {};
    var base = cfg.tiers[name] || { models: [], dailyLimit: 0, maxTokens: 1024, featureModels: {} };
    cfg.tiers[name] = {
      models: Array.isArray(st.models) ? st.models.slice()
            : (st.models && typeof st.models === 'object') ? Object.keys(st.models).filter(function (k) { return st.models[k]; })
            : base.models,
      dailyLimit: typeof st.dailyLimit === 'number' ? st.dailyLimit : base.dailyLimit,
      maxTokens: typeof st.maxTokens === 'number' ? st.maxTokens : base.maxTokens,
      // Absent -> keep whatever the default tier shipped with. Present but junk
      // -> an empty map, i.e. no routing, i.e. models[0]. Never a throw.
      featureModels: (st.featureModels === undefined || st.featureModels === null)
        ? base.featureModels
        : normalizeFeatureModels(st.featureModels)
    };
  }
  return cfg;
}

/**
 * `email` here means "an email this function has already accepted as proof of
 * identity". Call sites pass the address ONLY when isOwnerUser() said yes; an
 * unverified owner-email claim arrives as '' and resolves like anybody else's,
 * so the owner shortcut cannot become a second, softer owner check that skips
 * the verified flag.
 */
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

/* --------------------------------------------------------- OpenRouter plumbing */

function openRouterHeaders(apiKey, extra) {
  var h = {
    'Authorization': 'Bearer ' + apiKey,
    'HTTP-Referer': OPENROUTER_REFERER,
    'X-Title': OPENROUTER_TITLE
  };
  if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k]; } }
  return h;
}

/**
 * Turn {system, messages} into the OpenAI-style message array OpenRouter wants.
 * The system prompt is NOT a top-level field here — it is the first message.
 */
function buildChatMessages(system, messages) {
  var out = [];
  if (typeof system === 'string' && system.trim()) {
    out.push({ role: 'system', content: system.slice(0, 40000) });
  }
  for (var i = 0; i < messages.length; i++) out.push(messages[i]);
  return out;
}

// choices[0].message.content is normally a plain string, but a few providers
// return OpenAI's structured-part array. Accept both.
function textFromOpenRouter(data) {
  if (!data || !Array.isArray(data.choices) || !data.choices.length) return '';
  var msg = data.choices[0] ? data.choices[0].message : null;
  if (!msg) return '';
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    var out = '';
    for (var i = 0; i < msg.content.length; i++) {
      var part = msg.content[i];
      if (part && typeof part.text === 'string') out += part.text;
    }
    return out;
  }
  return '';
}

function finishReason(data) {
  if (!data || !Array.isArray(data.choices) || !data.choices.length) return null;
  var c = data.choices[0];
  return (c && typeof c.finish_reason === 'string') ? c.finish_reason : null;
}

// OpenRouter reports {prompt_tokens, completion_tokens} (plus `cost` in dollars
// when usage accounting is on). Anthropic's input_tokens/output_tokens are gone.
function normalizeUsage(u) {
  var usage = (u && typeof u === 'object') ? u : {};
  return {
    promptTokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
    completionTokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0,
    totalTokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : 0,
    cost: typeof usage.cost === 'number' ? usage.cost : null
  };
}

/* ------------------------------------------------------- image plumbing --- */

/**
 * PROMPT HASH  —  the image cache key. Mirrored exactly by MM.ai.promptHash()
 * in js/ai.js so the browser can look in its cache before spending a call.
 *
 * THE ALGORITHM, verbatim (any change here is a breaking change):
 *
 *   p = String(prompt).trim().toLowerCase()      // prompt is normalized
 *   m = String(model)                            // model is NOT normalized
 *   s = String(size || '512x512')                // size is NOT normalized
 *   hex = sha256_hex(p + "\n" + m + "\n" + s)    // UTF-8 bytes, lowercase hex
 *   return hex.slice(0, 32)                      // first 32 hex chars = 128 bits
 *
 * Deterministic across calls, processes and languages. Nothing else is folded
 * in — no salt, no date, no uid — because two users asking for the same picture
 * must land on the same cache entry.
 */
function promptHash(prompt, model, size) {
  var p = String(prompt == null ? '' : prompt).trim().toLowerCase();
  var m = String(model == null ? '' : model);
  var s = String(size == null || size === '' ? DEFAULT_IMAGE_SIZE : size);
  return crypto.createHash('sha256').update(p + '\n' + m + '\n' + s, 'utf8').digest('hex').slice(0, 32);
}

// "512x512" -> "512x512"; anything unusable -> the default. Bounded so a hostile
// value cannot end up in a cache key or a log line unchecked.
function normalizeImageSize(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  var m = /^(\d{2,4})\s*[x*]\s*(\d{2,4})$/.exec(s);
  if (!m) return DEFAULT_IMAGE_SIZE;
  var w = Math.max(64, Math.min(2048, parseInt(m[1], 10)));
  var h = Math.max(64, Math.min(2048, parseInt(m[2], 10)));
  return w + 'x' + h;
}

// A hint, never an allow-list: OpenRouter adds image models constantly, so the
// real capability test is "did it actually return an image" (see below). This
// only sharpens the error message when it did not.
function looksLikeImageModel(slug) {
  return String(slug == null ? '' : slug).toLowerCase().indexOf('image') !== -1;
}

// 'data:image/png;base64,AAAA...' -> { mime, b64 }. Also accepts a bare base64
// blob (some providers omit the data: prefix entirely). Returns null otherwise.
function parseImageData(v) {
  if (typeof v !== 'string') return null;
  var s = v.trim();
  if (!s) return null;
  var m = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(s);
  if (m) {
    var b64 = m[2].replace(/\s+/g, '');
    if (!b64) return null;
    return { mime: m[1].toLowerCase(), b64: b64 };
  }
  if (s.indexOf('data:') === 0) return null;       // a data URL we cannot read
  if (/^https?:\/\//i.test(s)) return null;         // a remote URL is not base64
  var bare = s.replace(/\s+/g, '');
  if (bare.length >= 64 && /^[A-Za-z0-9+/]+={0,2}$/.test(bare)) {
    return { mime: 'image/png', b64: bare };
  }
  return null;
}

// One entry of a message.images array, or one structured content part. Providers
// disagree wildly on the shape, so every plausible one is unwrapped here.
function imageFromCandidate(c) {
  if (!c) return null;
  if (typeof c === 'string') return parseImageData(c);
  if (typeof c !== 'object') return null;

  var direct = parseImageData(c.b64_json) || parseImageData(c.b64) || parseImageData(c.data) ||
               parseImageData(c.url) || parseImageData(c.image) || parseImageData(c.image_data);
  if (direct) return direct;

  if (c.image_url) {
    if (typeof c.image_url === 'string') { var a = parseImageData(c.image_url); if (a) return a; }
    else if (typeof c.image_url === 'object') {
      var b = parseImageData(c.image_url.url) || parseImageData(c.image_url.b64_json) ||
              parseImageData(c.image_url.data);
      if (b) return b;
    }
  }
  // Anthropic-ish { source: { data, media_type } }
  if (c.source && typeof c.source === 'object') {
    var s = parseImageData(c.source.data) || parseImageData(c.source.url);
    if (s) {
      if (typeof c.source.media_type === 'string' && c.source.media_type.indexOf('image/') === 0) {
        s.mime = c.source.media_type;
      }
      return s;
    }
  }
  if (c.inlineData && typeof c.inlineData === 'object') {
    var g = parseImageData(c.inlineData.data);
    if (g) {
      if (typeof c.inlineData.mimeType === 'string' && c.inlineData.mimeType.indexOf('image/') === 0) {
        g.mime = c.inlineData.mimeType;
      }
      return g;
    }
  }
  return null;
}

/**
 * Pull one image out of an OpenRouter chat-completions response.
 *
 * Two documented shapes, both handled, plus the OpenAI /images fallback:
 *   choices[0].message.images   = [ 'data:image/png;base64,...' ]
 *                              or [ { type:'image_url', image_url:{ url:'data:...' } } ]
 *   choices[0].message.content  = [ { type:'image_url', image_url:{ url:'data:...' } }, ... ]
 *   data.data                   = [ { b64_json:'...' } ]
 *
 * Returns { b64, mime } with NO data: prefix, or null when the model produced
 * no image at all — which is how "this model cannot make images" is detected.
 */
function imageFromOpenRouter(data) {
  if (!data || typeof data !== 'object') return null;
  var i, hit;
  var choices = Array.isArray(data.choices) ? data.choices : [];
  var msg = (choices.length && choices[0]) ? choices[0].message : null;

  if (msg && typeof msg === 'object') {
    if (Array.isArray(msg.images)) {
      for (i = 0; i < msg.images.length; i++) {
        hit = imageFromCandidate(msg.images[i]);
        if (hit) return hit;
      }
    }
    if (Array.isArray(msg.content)) {
      for (i = 0; i < msg.content.length; i++) {
        var part = msg.content[i];
        if (!part || typeof part !== 'object') continue;
        if (part.type && String(part.type).indexOf('text') === 0) continue;
        hit = imageFromCandidate(part);
        if (hit) return hit;
      }
    }
    hit = imageFromCandidate(msg.image) || imageFromCandidate(msg.image_url);
    if (hit) return hit;
  }

  if (Array.isArray(data.data)) {
    for (i = 0; i < data.data.length; i++) {
      hit = imageFromCandidate(data.data[i]);
      if (hit) return hit;
    }
  }
  return null;
}

// Trim one entry of https://openrouter.ai/api/v1/models down to what the admin
// panel needs. Prices are per-token USD strings such as "0.0000004".
function trimModel(m) {
  if (!m || typeof m !== 'object' || typeof m.id !== 'string' || !m.id) return null;
  var pricing = (m.pricing && typeof m.pricing === 'object') ? m.pricing : {};
  var prompt = priceString(pricing.prompt);
  var completion = priceString(pricing.completion);
  var ctx = 0;
  if (typeof m.context_length === 'number') ctx = m.context_length;
  else if (m.top_provider && typeof m.top_provider.context_length === 'number') ctx = m.top_provider.context_length;

  // Image and video models are billed per output, not per token, so their real
  // cost lives in pricing.image / pricing.video and both token rates read "0".
  // Without these the admin UI would show an image model as FREE. Capability is
  // taken from OpenRouter's own architecture block rather than guessed.
  var imagePrice = priceString(pricing.image);
  var videoPrice = priceString(pricing.video);
  var arch = (m.architecture && typeof m.architecture === 'object') ? m.architecture : {};
  var outMods = Array.isArray(arch.output_modalities) ? arch.output_modalities : [];
  var inMods = Array.isArray(arch.input_modalities) ? arch.input_modalities : [];

  // Only claim "free" when every price we know about is zero. A model billed
  // per image with zero token rates is emphatically not free.
  var tokensFree = isZeroPrice(prompt) && isZeroPrice(completion);
  var perOutputFree = (imagePrice === '' || isZeroPrice(imagePrice)) &&
                      (videoPrice === '' || isZeroPrice(videoPrice));

  return {
    id: m.id,
    name: (typeof m.name === 'string' && m.name) ? m.name : m.id,
    contextLength: ctx,
    promptPrice: prompt,
    completionPrice: completion,
    imagePrice: imagePrice,
    videoPrice: videoPrice,
    outputModalities: outMods,
    inputModalities: inMods,
    canOutputImage: outMods.indexOf('image') !== -1,
    canOutputVideo: outMods.indexOf('video') !== -1,
    canInputImage: inMods.indexOf('image') !== -1,
    isFree: tokensFree && perOutputFree
  };
}

function priceString(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && isFinite(v)) return String(v);
  return '';
}

function isZeroPrice(s) {
  if (s === '') return false;
  var n = parseFloat(s);
  return isFinite(n) && n === 0;
}

// Module-scope cache: warm lambdas reuse it, cold starts refetch.
var modelsCache = { list: null, fetchedAt: 0, expiresAt: 0 };

/**
 * Fetch the OpenRouter catalog for one output modality.
 *
 * OpenRouter exposes ?output_modalities=image|video, which is authoritative —
 * far better than guessing capability from the slug. Each modality is cached
 * separately because they are separate upstream calls.
 *
 * modality: 'text' (default, unfiltered) | 'image' | 'video'
 */
function modalityUrl(modality) {
  if (modality === 'image' || modality === 'video') {
    return OPENROUTER_MODELS + '?output_modalities=' + encodeURIComponent(modality);
  }
  return OPENROUTER_MODELS;
}

function normalizeModality(v) {
  var m = String(v == null ? '' : v).toLowerCase().trim();
  return (m === 'image' || m === 'video') ? m : 'text';
}

function getOpenRouterModels(apiKey, modality) {
  var mod = normalizeModality(modality);
  var now = Date.now();
  if (!modelsCache.byModality) modelsCache.byModality = {};
  var hit = modelsCache.byModality[mod];
  if (hit && hit.list && now < hit.expiresAt) {
    return Promise.resolve({ list: hit.list, fetchedAt: hit.fetchedAt, cached: true, modality: mod });
  }
  return fetchWithTimeout(modalityUrl(mod), {
    method: 'GET',
    headers: openRouterHeaders(apiKey)
  }, MODELS_TIMEOUT_MS).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (t) {
        logErr('openrouter models ' + res.status, new Error(String(t).slice(0, 1000)));
        var msg = 'OpenRouter would not return its model list.';
        if (res.status === 401) msg = 'OpenRouter rejected OPENROUTER_API_KEY. Check the key in Netlify and redeploy.';
        if (res.status === 429) msg = 'OpenRouter is rate limiting the model list. Try again in a minute.';
        throw { httpStatus: 502, code: 'server', message: msg };
      }, function () {
        throw { httpStatus: 502, code: 'server', message: 'OpenRouter would not return its model list.' };
      });
    }
    return res.json().then(function (data) {
      var raw = (data && Array.isArray(data.data)) ? data.data : [];
      var list = [];
      for (var i = 0; i < raw.length; i++) {
        var t = trimModel(raw[i]);
        if (t) list.push(t);
      }
      list.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      if (!modelsCache.byModality) modelsCache.byModality = {};
      modelsCache.byModality[mod] = {
        list: list, fetchedAt: Date.now(), expiresAt: Date.now() + MODELS_CACHE_MS
      };
      // Keep the legacy flat fields pointing at the text catalog so any older
      // caller that reads modelsCache.list directly still works.
      if (mod === 'text') {
        modelsCache.list = list;
        modelsCache.fetchedAt = modelsCache.byModality[mod].fetchedAt;
        modelsCache.expiresAt = modelsCache.byModality[mod].expiresAt;
      }
      return { list: list, fetchedAt: modelsCache.byModality[mod].fetchedAt, cached: false, modality: mod };
    });
  }, function (e) {
    logErr('openrouter models fetch', e);
    throw { httpStatus: 504, code: 'server', message: 'Could not reach OpenRouter to load the model list.' };
  });
}

/* ------------------------------------------------------------ SSE aggregation */

// OpenRouter emits SSE comment lines (": OPENROUTER PROCESSING") as keepalives
// while a slow provider warms up. They are legal SSE but a naive `data:` parser
// that does not skip them can trip over them, so strip them before we hand the
// buffered stream to the browser. The client parser skips them too, belt and braces.
function stripSSEComments(text) {
  var lines = String(text == null ? '' : text).split('\n');
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].charAt(0) === ':') continue;
    out.push(lines[i]);
  }
  return out.join('\n');
}

// Pull the last `usage` object out of a buffered OpenAI-style SSE body so the
// real token counts can ride back on the response headers.
function usageFromSSE(text) {
  var lines = String(text == null ? '' : text).split('\n');
  var found = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf('data:') !== 0) continue;
    var payload = line.slice(5).replace(/^ /, '');
    if (!payload || payload === '[DONE]') continue;
    try {
      var evt = JSON.parse(payload);
      if (evt && evt.usage && typeof evt.usage === 'object') found = evt.usage;
    } catch (e) { /* partial or non-JSON frame — ignore */ }
  }
  return normalizeUsage(found);
}

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

/* ------------------------------------------------- action: listModels (owner) */

// Owner-only. The key never leaves the server; the browser only ever sees the
// trimmed catalog. Cached in module memory for MODELS_CACHE_MS.
function handleListModels(idToken, projectId, apiKey, origin, modality) {
  var mod = normalizeModality(modality);
  return verifyIdToken(idToken, projectId).catch(function (e) {
    logErr('token verify (listModels)', e);
    throw { httpStatus: 401, code: 'no-auth', message: 'Your session expired. Sign in again.' };
  }).then(function (u) {
    if (!isOwnerUser(u)) {   // verified owner email only — see isOwnerUser()
      throw { httpStatus: 403, code: 'tier-denied', message: 'The OpenRouter model catalog is owner only.' };
    }
    return getOpenRouterModels(apiKey, mod);
  }).then(function (r) {
    return json(200, {
      models: r.list,
      count: r.list.length,
      modality: r.modality || mod,
      fetchedAt: r.fetchedAt,
      cached: r.cached,
      cacheMs: MODELS_CACHE_MS
    }, origin);
  }).catch(function (e) {
    if (e && e.code && e.httpStatus) return fail(e.httpStatus, e.code, e.message, origin, e.extra);
    logErr('listModels unhandled', e);
    return fail(500, 'server', 'Could not load the OpenRouter model list.', origin);
  });
}

/* ------------------------------------------- shared upstream error mapping */

/**
 * Turn a non-2xx OpenRouter response into the throwable this file uses. The
 * real upstream body is logged server-side; the client only ever gets the safe
 * summary plus a machine-readable `reason` (js/ai.js REASON_TEXT renders it).
 * Shared by chat and generateImage so the two can never drift apart.
 */
function upstreamError(status, bodyText, model) {
  logErr('openrouter ' + status + ' [' + model + ']', new Error(String(bodyText).slice(0, 2000)));
  var msg = 'The AI service could not complete that request.';
  var extra = null;

  if (status === 401) {
    msg = 'OpenRouter rejected the server key. The site owner needs to check OPENROUTER_API_KEY.';
    extra = { reason: 'bad-key' };
  } else if (status === 402) {
    // NOT the student's daily quota — the owner's OpenRouter balance is empty.
    msg = 'The site owner\'s OpenRouter account is out of credits, so AI is paused for everyone. ' +
          'This is not your daily limit. Add credit at openrouter.ai/credits to turn it back on.';
    extra = { reason: 'insufficient-credits' };
  } else if (status === 404) {
    // Almost always a model slug that does not exist on OpenRouter.
    msg = 'The model "' + model + '" does not exist on OpenRouter. ' +
          'Fix the model ID in Admin Panel -> AI -> Models.';
    extra = { reason: 'unknown-model', model: model };
  } else if (status === 429) {
    msg = 'OpenRouter is rate limiting this model right now. Try again in a moment.';
    extra = { reason: 'upstream-rate-limit' };
  } else if (status === 502 || status === 503) {
    msg = 'The model provider is overloaded or down. Try again in a moment, or pick another model.';
    extra = { reason: 'provider-down' };
  } else if (status === 400) {
    msg = 'That request was not valid for the selected model.';
    extra = { reason: 'bad-request', model: model };
  }
  return { httpStatus: 502, code: 'server', message: msg, extra: extra };
}

/**
 * Did this 4xx come from the model refusing `response_format`?
 *
 * OpenRouter lists response_format in `supported_parameters` for most models,
 * but a handful of providers still 400 on it, and they all say so in the body
 * one of three ways: they name the parameter, they use OpenAI's
 * "unsupported_parameter" code, or they complain about json_object /
 * json_schema specifically. Anything that matches is worth one silent retry
 * WITHOUT the parameter - a structured-output nicety must never be the reason
 * a student's turn fails.
 */
var RE_RESPONSE_FORMAT_REJECT = /response_?format|unsupported_?parameter|json_object|json_schema/i;

function rejectsResponseFormat(status, bodyText) {
  if (!(status >= 400 && status < 500)) return false;
  return RE_RESPONSE_FORMAT_REJECT.test(String(bodyText == null ? '' : bodyText));
}

/* ------------------------------------------- action: generateImage (wire contract)
 *
 *   POST /api/ai
 *   { action:'generateImage', idToken, feature:'mnemonic'|'avatar'|'image',
 *     prompt:'...', size:'512x512'?, model:'<override>'? }
 *
 *   200 { ok:true, b64, mime, model, promptHash, cost }
 *   err { error:<code>, message, ... }  with code one of
 *        no-auth | tier-denied | quota-exceeded | ai-disabled | network | server
 *        | image-unsupported   (the resolved model cannot produce images)
 *
 * Everything chat() enforces is enforced here — kill switch, dollar ceiling,
 * model allow-list, spend recording — with ONE deliberate difference: the daily
 * quota is the IMAGE cap (aiConfig.imageLimits[tier]), counted at
 * /aiUsage/<uid>/<day>_img. Images cost multiples of a tutor message, so they
 * get their own, stricter budget and never consume the text allowance.
 * ------------------------------------------------------------------------- */
function handleGenerateImage(body, idToken, projectId, apiKey, origin) {
  var user = null, cfg = null, tier = 'free', rules = null, model = DEFAULT_MODEL;
  var isOwner = false, usedToday = 0, limit = 0, spent6 = 0;
  var key = dayKey(new Date(), QUOTA_TZ);
  // Monthly bucket — see monthKey(). Text quota stays daily.
  var imgKey = monthKey(new Date(), QUOTA_TZ) + IMAGE_USAGE_SUFFIX;
  // Drives routing AND spend attribution, so the Spend tab breaks image cost out
  // per feature. An unrecognised tag files as 'image' rather than 'other'.
  var feature = normalizeFeature(body.feature, 'image');
  var size = normalizeImageSize(body.size);
  var prompt = (typeof body.prompt === 'string') ? body.prompt.trim() : '';
  var hash = '';
  // The in-flight reservation this request owns, if it got as far as taking one.
  var holdKey = '', held = false;

  function releaseHold() {
    if (!held) return;
    held = false;
    releaseCalls(holdKey, 1);
  }

  /**
   * Hand the reserved image back. Called when the request produced no picture:
   * an upstream failure, or a model that answered without one. The wire contract
   * above is explicit that only a delivered image costs one of the day's images,
   * so the reservation is undone rather than kept. (tts.js deliberately does the
   * opposite for a billed-but-empty clip — see the note there.)
   */
  function refundHold() {
    if (!held) return Promise.resolve(null);
    releaseHold();
    return refundUsage(user && user.uid, imgKey, idToken);
  }

  if (!prompt) {
    return Promise.resolve(fail(400, 'server', 'No image prompt supplied.', origin));
  }
  if (prompt.length > MAX_IMAGE_PROMPT_CHARS) prompt = prompt.slice(0, MAX_IMAGE_PROMPT_CHARS);

  return verifyIdToken(idToken, projectId).catch(function (e) {
    logErr('token verify (generateImage)', e);
    throw { httpStatus: 401, code: 'no-auth', message: 'Your session expired. Sign in again to keep using AI.' };
  }).then(function (u) {
    user = u;
    // A verified owner email, never the bare claim — see isOwnerUser().
    isOwner = isOwnerUser(u);
    holdKey = safeKey(u.uid) + '/' + imgKey;
    return Promise.all([
      dbGet('userTiers/' + encodeURIComponent(u.uid), idToken),
      dbGet('appConfig/aiConfig', idToken),
      readSpendToday(key, idToken)
    ]);
  }).then(function (trio) {
    cfg = normalizeConfig(trio[1]);
    // Only a VERIFIED owner email earns the instructor shortcut in resolveTier.
    tier = resolveTier(cfg, isOwner ? user.email : '', trio[0]);
    rules = cfg.tiers[tier] || cfg.tiers.free || DEFAULT_AI_CONFIG.tiers.free;
    spent6 = typeof trio[2] === 'number' ? trio[2] : 0;

    // ---- global kill switch (owner bypasses) --------------------------------
    if (cfg.enabled === false && !isOwner) {
      throw { httpStatus: 503, code: 'ai-disabled', message: 'AI features are temporarily turned off. Check back soon.' };
    }

    // ---- daily DOLLAR ceiling -----------------------------------------------
    var cap6 = Math.round((typeof cfg.softCapUsd === 'number' ? cfg.softCapUsd : DEFAULT_SOFT_CAP_USD) * 1e6);
    if (!isOwner && cfg.capMode === 'block' && cap6 > 0 && spent6 >= cap6) {
      throw {
        httpStatus: 503,
        code: 'ai-disabled',
        message: 'AI is paused for the rest of today: the site hit its daily AI budget of $' +
                 (cap6 / 1e6).toFixed(2) + '. This is not your personal limit and nothing you did. ' +
                 'It resets at midnight Eastern, and everything else in MedMaster still works.',
        extra: { reason: 'spend-cap', resetsAt: nextResetMs(QUOTA_TZ) }
      };
    }

    // ---- model routing + allow-list (identical order to chat) ---------------
    var picked = resolveModelWith(rules, feature, {
      requested: body.model,
      isOwner: isOwner,
      allowModelChoice: cfg.allowModelChoice === true
    });
    model = picked.model;
    if (picked.ignored) {
      logWarn('featureModels', 'tier "' + tier + '" routes feature "' + feature + '" to "' +
        picked.ignored + '", which is not in its allow-list — falling back to ' + model);
    }
    hash = promptHash(prompt, model, size);

    if (!isOwner && (!Array.isArray(rules.models) || rules.models.length === 0)) {
      throw {
        httpStatus: 403,
        code: 'tier-denied',
        message: 'AI is not set up for the ' + tier + ' plan yet. No models have been assigned to it.',
        extra: { allowedModels: [], tier: tier, reason: 'no-models-configured' }
      };
    }
    if (!isOwner && !tierAllowsModel(rules, model)) {
      throw {
        httpStatus: 403,
        code: 'tier-denied',
        message: 'Your ' + tier + ' plan does not include ' + model + '.',
        extra: { allowedModels: Array.isArray(rules.models) ? rules.models : [], tier: tier }
      };
    }

    // ---- the IMAGE cap ------------------------------------------------------
    limit = imageLimitFor(cfg, tier, isOwner);
    if (limit === 0) {
      throw {
        httpStatus: 429, code: 'quota-exceeded',
        message: 'AI image generation is not part of the ' + tier + ' plan (0 images a day). ' +
                 'Everything else in MedMaster is unaffected.',
        extra: { used: 0, limit: 0, kind: 'image', tier: tier, resetsAt: nextMonthResetMs(QUOTA_TZ) }
      };
    }
    if (limit < 0) return 0; // unlimited — skip the read
    return dbGet(usagePathFor(user.uid, imgKey), idToken);
  }).then(function (count) {
    usedToday = typeof count === 'number' ? count : 0;

    /* ---- RESERVE, then check ----------------------------------------------
     * Identical discipline to tts.js, for the identical reason: reading the
     * counter here and writing it after the render is a TOCTOU hole, and with
     * images the unit being multiplied by the number of open tabs is the most
     * expensive call the app makes. See the reservation note on callHolds.
     */
    var inflight = heldCalls(holdKey);
    if (limit >= 0 && usedToday + inflight >= limit) {
      throw {
        httpStatus: 429, code: 'quota-exceeded',
        message: 'You have used all ' + limit + ' of your AI images for this month (the monthly image ' +
                 'limit is ' + limit + ', separate from your AI messages). It resets on the 1st.',
        extra: { used: usedToday + inflight, limit: limit, kind: 'image', tier: tier, resetsAt: nextMonthResetMs(QUOTA_TZ) }
      };
    }
    holdCalls(holdKey, 1);
    held = true;
    return recordUsage(user.uid, imgKey, usedToday, limit, idToken);
  }).then(function (afterIncrement) {
    // What the atomic increment says the student's day now totals. A number is
    // authoritative; DB_FAILED or a payload-less success tells us nothing, and
    // "nothing" must not become a denial.
    if (limit >= 0 && typeof afterIncrement === 'number' && isFinite(afterIncrement) && afterIncrement > limit) {
      return refundHold().then(function () {
        throw {
          httpStatus: 429, code: 'quota-exceeded',
          message: 'You have used all ' + limit + ' of your AI images for today (the daily image limit is ' +
                   limit + ', separate from your AI messages). It resets at midnight Eastern.',
          extra: {
            used: afterIncrement - 1, limit: limit, kind: 'image', tier: tier,
            reason: 'quota-race', resetsAt: nextMonthResetMs(QUOTA_TZ)
          }
        };
      });
    }

    // ---- upstream -----------------------------------------------------------
    // OpenRouter serves image models through /chat/completions; `modalities`
    // asks for an image back. There is no size parameter on this endpoint, so
    // `size` is carried for the cache key and the response echo only — it is
    // deliberately NOT appended to the prompt, because image models happily
    // render stray instruction text into the picture.
    var capTokens = (typeof rules.maxTokens === 'number' && rules.maxTokens > 0) ? rules.maxTokens : 1024;
    var payload = {
      model: model,
      modalities: ['image', 'text'],
      messages: [{ role: 'user', content: prompt }],
      max_tokens: Math.max(256, Math.min(capTokens, 2048))
    };
    if (REQUEST_USAGE_ACCOUNTING) payload.usage = { include: true };

    return fetchWithTimeout(OPENROUTER_URL, {
      method: 'POST',
      headers: openRouterHeaders(apiKey, { 'content-type': 'application/json' }),
      body: JSON.stringify(payload)
    }, IMAGE_TIMEOUT_MS).then(function (res) {
      if (!res.ok) {
        // Nothing was generated and nothing was billed: give the reserved image
        // back before reporting the failure.
        return refundHold().then(function () {
          return res.text().then(function (t) {
            throw upstreamError(res.status, t, model);
          }, function () {
            throw { httpStatus: 502, code: 'server', message: 'The AI service could not complete that request.' };
          });
        });
      }
      return res.json().then(function (data) {
        var u = normalizeUsage(data && data.usage);
        var img = imageFromOpenRouter(data);

        if (!img) {
          // Capability is detected from the RESPONSE, never from an allow-list of
          // slugs — OpenRouter adds image models constantly. The slug is only a
          // hint used to word the message.
          //
          // OpenRouter still billed for the tokens, so the SPEND is recorded;
          // the student got no picture, so the reserved image is handed back.
          // Spend and quota are separate questions and this is a case where the
          // two answers differ.
          return Promise.all([
            recordSpend(user.uid, key, u.cost, model, feature, idToken),
            refundHold()
          ]).then(function () {
            throw {
              httpStatus: 502, code: 'image-unsupported',
              message: looksLikeImageModel(model)
                ? 'The model "' + model + '" is set up for images but returned none this time. Try again in a moment.'
                : 'The model "' + model + '" cannot generate images. Point the ' + feature +
                  ' feature at an image-capable model in Admin Panel -> AI -> Models.',
              extra: { model: model, feature: feature, tier: tier, reason: 'no-image-returned' }
            };
          });
        }

        // The image itself was already reserved before the call; only the money
        // is still outstanding.
        return recordSpend(user.uid, key, u.cost, model, feature, idToken).then(function () {
          return json(200, {
            ok: true,
            b64: img.b64,
            mime: img.mime,
            model: model,
            promptHash: hash,
            cost: (typeof u.cost === 'number' && isFinite(u.cost)) ? u.cost : 0,
            // --- additive, beyond the wire contract ---
            size: size,
            feature: feature,
            tier: tier,
            used: limit < 0 ? -1 : usedToday + 1,
            limit: limit,
            resetsAt: nextResetMs(QUOTA_TZ),
            upstreamModel: (data && typeof data.model === 'string') ? data.model : model,
            promptTokens: u.promptTokens,
            completionTokens: u.completionTokens
          }, origin);
        });
      });
    }, function (e) {
      logErr('openrouter image fetch', e);
      var aborted = e && (e.name === 'AbortError' || String(e).indexOf('abort') !== -1);
      var thrown = {
        httpStatus: 504,
        code: 'network',
        message: aborted
          ? 'The image took longer than ' + Math.round(IMAGE_TIMEOUT_MS / 1000) + ' seconds to generate. Try a simpler prompt.'
          : 'Could not reach the AI service. Try again in a moment.'
      };
      // Never reached OpenRouter, so nothing was billed and nothing was made.
      return refundHold().then(function () { throw thrown; });
    });
  }).then(function (out) {
    releaseHold();
    return out;
  }, function (e) {
    releaseHold();
    throw e;
  }).catch(function (e) {
    if (e && e.code && e.httpStatus) return fail(e.httpStatus, e.code, e.message, origin, e.extra);
    logErr('generateImage unhandled', e);
    return fail(500, 'server', 'Something went wrong on our end. Try again in a moment.', origin);
  });
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

  var apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logErr('config', new Error('OPENROUTER_API_KEY is not set'));
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

  // ---- 1b. which action? ----------------------------------------------------
  var qs = (event.queryStringParameters && typeof event.queryStringParameters === 'object')
    ? event.queryStringParameters : {};
  var action = 'chat';
  if (typeof body.action === 'string' && body.action) action = body.action;
  else if (typeof qs.action === 'string' && qs.action) action = qs.action;

  /* ---- warmup: the only unauthenticated action ------------------------------
   * Does nothing at all. Its entire job is to make Netlify boot the container
   * so the FIRST real call of a session is not paying for a cold start on top
   * of a slow model. It reads no body fields, touches no Firebase, calls no
   * upstream, spends nothing, and returns before any auth work - so there is
   * nothing here to abuse beyond an empty 204 that CORS already allows. */
  if (action === 'warmup') {
    return Promise.resolve({ statusCode: 204, headers: corsHeaders(origin), body: '' });
  }

  var idToken = body.idToken;
  if (!idToken) {
    return Promise.resolve(fail(401, 'no-auth', 'You need to be signed in to use AI features.', origin));
  }

  if (action === 'listModels') {
    return handleListModels(idToken, projectId, apiKey, origin, body.modality);
  }
  if (action === 'generateImage') {
    return handleGenerateImage(body, idToken, projectId, apiKey, origin);
  }
  if (action !== 'chat') {
    // The echo is sanitized, not raw: see safeAction(). The full value is in the
    // server log if anyone ever needs it.
    logWarn('action', 'unknown action "' + String(action).slice(0, 120) + '"');
    return Promise.resolve(fail(400, 'server', 'Unknown action "' + safeAction(action) + '".', origin));
  }

  var messages = sanitizeMessages(body.messages);
  if (!messages) {
    return Promise.resolve(fail(400, 'server', 'No messages supplied.', origin));
  }

  var user = null, cfg = null, tier = 'free', rules = null, model = DEFAULT_MODEL;
  var isOwner = false, usedToday = 0, limit = 0, spent6 = 0;
  var key = dayKey(new Date(), QUOTA_TZ);
  // Which part of the app spent this money. Purely for attribution in the admin
  // panel; it can never widen what the caller is allowed to do.
  var feature = normalizeFeature(body.feature);
  // The in-flight reservation this request owns, if it got as far as taking one.
  var holdKey = '', held = false;

  function releaseHold() {
    if (!held) return;
    held = false;
    releaseCalls(holdKey, 1);
  }

  /**
   * Hand the reserved call back. Only for requests that produced nothing and
   * cost nothing — an upstream 4xx/5xx or a network failure. A turn that reached
   * the model keeps its tick.
   */
  function refundHold() {
    if (!held) return Promise.resolve(null);
    releaseHold();
    return refundUsage(user && user.uid, key, idToken);
  }

  // ---- 2. verify the ID token ----------------------------------------------
  return verifyIdToken(idToken, projectId).catch(function (e) {
    logErr('token verify', e);
    throw { httpStatus: 401, code: 'no-auth', message: 'Your session expired. Sign in again to keep using AI.' };
  }).then(function (u) {
    user = u;
    // A verified owner email, never the bare claim — see isOwnerUser().
    isOwner = isOwnerUser(u);
    holdKey = safeKey(u.uid) + '/' + key;

    // ---- 3. tier + config + today's spend -----------------------------------
    return Promise.all([
      dbGet('userTiers/' + encodeURIComponent(u.uid), idToken),
      dbGet('appConfig/aiConfig', idToken),
      readSpendToday(key, idToken)
    ]);
  }).then(function (pair) {
    cfg = normalizeConfig(pair[1]);
    // Only a VERIFIED owner email earns the instructor shortcut in resolveTier.
    tier = resolveTier(cfg, isOwner ? user.email : '', pair[0]);
    rules = cfg.tiers[tier] || cfg.tiers.free || DEFAULT_AI_CONFIG.tiers.free;
    spent6 = typeof pair[2] === 'number' ? pair[2] : 0;

    // ---- 4a. global kill switch (owner bypasses) ---------------------------
    if (cfg.enabled === false && !isOwner) {
      throw { httpStatus: 503, code: 'ai-disabled', message: 'AI features are temporarily turned off. Check back soon.' };
    }

    // ---- 4a-ii. daily DOLLAR ceiling ---------------------------------------
    // This is a site-wide budget brake, not a per-student limit, so it reads as
    // "AI is off right now" rather than "you did something wrong". Only bites
    // when the owner has explicitly chosen capMode 'block'. The owner is never
    // locked out of his own admin panel by it.
    var cap6 = Math.round((typeof cfg.softCapUsd === 'number' ? cfg.softCapUsd : DEFAULT_SOFT_CAP_USD) * 1e6);
    if (!isOwner && cfg.capMode === 'block' && cap6 > 0 && spent6 >= cap6) {
      throw {
        httpStatus: 503,
        code: 'ai-disabled',
        message: 'AI is paused for the rest of today: the site hit its daily AI budget of $' +
                 (cap6 / 1e6).toFixed(2) + '. This is not your personal limit and nothing you did. ' +
                 'It resets at midnight Eastern, and everything else in MedMaster still works.',
        extra: { reason: 'spend-cap', resetsAt: nextResetMs(QUOTA_TZ) }
      };
    }

    // ---- 4b. model routing + allowlist -------------------------------------
    // Order: caller override (owner / allowModelChoice only) -> featureModels[feature]
    //     -> tier models[0] -> DEFAULT_MODEL. Identical to MM.ai.resolveModelFor().
    var picked = resolveModelWith(rules, feature, {
      requested: body.model,
      isOwner: isOwner,
      allowModelChoice: cfg.allowModelChoice === true
    });
    model = picked.model;
    if (picked.ignored) {
      // A misconfiguration must degrade quietly, not 500 and not escalate.
      logWarn('featureModels', 'tier "' + tier + '" routes feature "' + feature + '" to "' +
        picked.ignored + '", which is not in its allow-list — falling back to ' + model);
    }
    // A tier with an empty model list is not "denied", it is "not set up yet".
    // The free tier ships that way on purpose until the owner picks real
    // OpenRouter free slugs from the live catalog.
    if (!isOwner && (!Array.isArray(rules.models) || rules.models.length === 0)) {
      throw {
        httpStatus: 403,
        code: 'tier-denied',
        message: 'AI is not set up for the ' + tier + ' plan yet. No models have been assigned to it.',
        extra: { allowedModels: [], tier: tier, reason: 'no-models-configured' }
      };
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
    return dbGet(usagePathFor(user.uid, key), idToken);
  }).then(function (count) {
    usedToday = typeof count === 'number' ? count : 0;

    /* ---- 4d. RESERVE, then check -------------------------------------------
     * The old shape read the counter here and wrote it after the model replied,
     * which is a textbook TOCTOU: every concurrent request read the same stale
     * total, every one of them passed, and the daily limit multiplied by the
     * number of open tabs.
     *
     * The budget is now taken BEFORE the money is spent, in two layers:
     *
     *   1. `callHolds` covers requests this container is already handling. The
     *      check and the hold happen in the same synchronous block, so a second
     *      request cannot slip between them.
     *   2. The RTDB increment below is the cross-container answer. It is atomic
     *      and it RETURNS the post-increment total, so a request that only finds
     *      out it lost the race after incrementing can hand the tick back and
     *      deny before calling OpenRouter.
     *
     * Residual window: two containers may both issue an increment, but the loser
     * sees its own post-increment value exceed the limit and refunds, so the
     * overshoot is bounded by one call per racing container rather than
     * unbounded. Fail-open wherever the counter is unreadable — a broken counter
     * must not lock students out. tts.js does the same thing with characters.
     */
    var inflight = heldCalls(holdKey);
    if (limit >= 0 && usedToday + inflight >= limit) {
      throw {
        httpStatus: 429, code: 'quota-exceeded',
        message: 'You have used all ' + limit + ' of your AI messages for today.',
        extra: { used: usedToday + inflight, limit: limit, resetsAt: nextResetMs(QUOTA_TZ) }
      };
    }
    holdCalls(holdKey, 1);
    held = true;
    return recordUsage(user.uid, key, usedToday, limit, idToken);
  }).then(function (afterIncrement) {
    // What the atomic increment says the student's day now totals. A number is
    // authoritative; DB_FAILED or a payload-less success tells us nothing, and
    // "nothing" must not become a denial.
    if (limit >= 0 && typeof afterIncrement === 'number' && isFinite(afterIncrement) && afterIncrement > limit) {
      return refundHold().then(function () {
        throw {
          httpStatus: 429, code: 'quota-exceeded',
          message: 'You have used all ' + limit + ' of your AI messages for today.',
          extra: {
            used: afterIncrement - 1, limit: limit,
            reason: 'quota-race', resetsAt: nextResetMs(QUOTA_TZ)
          }
        };
      });
    }

    // ---- 5. build + send the upstream request -------------------------------
    var capTokens = typeof rules.maxTokens === 'number' && rules.maxTokens > 0 ? rules.maxTokens : 1024;
    var wanted = typeof body.maxTokens === 'number' && body.maxTokens > 0 ? Math.floor(body.maxTokens) : capTokens;
    var maxTokens = Math.max(16, Math.min(wanted, capTokens));

    // OpenAI-style temperature range is 0-2, unlike Anthropic's 0-1.
    var temperature = 1;
    if (typeof body.temperature === 'number' && isFinite(body.temperature)) {
      temperature = Math.max(0, Math.min(2, body.temperature));
    }

    var wantStream = body.stream === true;

    /* Structured output, opt-in per call (js/ai.js chat({json:true})). The
       scenario engine needs ONE raw JSON object per turn, and asking for it
       through response_format removes almost every "the model wrapped it in
       prose" parse failure. Not every model accepts the parameter, so it is
       always retried once without it - see rejectsResponseFormat(). */
    var wantJson = body.json === true;

    // OpenRouter / OpenAI shape: no top-level `system`, it is the first message.
    function buildPayload(withJson) {
      var payload = {
        model: model,
        messages: buildChatMessages(body.system, messages),
        max_tokens: maxTokens,
        temperature: temperature,
        stream: wantStream
      };
      if (REQUEST_USAGE_ACCOUNTING) payload.usage = { include: true };
      if (withJson) payload.response_format = { type: 'json_object' };
      return payload;
    }

    // Resolves with an OK upstream response, or rejects with this file's
    // {httpStatus, code, message} throwable. One automatic retry, and only
    // ever to drop response_format.
    function sendUpstream(withJson) {
      return fetchWithTimeout(OPENROUTER_URL, {
        method: 'POST',
        headers: openRouterHeaders(apiKey, { 'content-type': 'application/json' }),
        body: JSON.stringify(buildPayload(withJson))
      }, UPSTREAM_TIMEOUT_MS).then(function (res) {
        if (res.ok) return res;
        // Log the real upstream body server-side; give the client a safe summary.
        return res.text().then(function (t) {
          if (withJson && rejectsResponseFormat(res.status, t)) {
            logWarn('response_format', 'model "' + model + '" rejected response_format (' +
              res.status + ') - retrying once without it');
            return sendUpstream(false);
          }
          throw upstreamError(res.status, t, model);
        }, function () {
          throw { httpStatus: 502, code: 'server', message: 'The AI service could not complete that request.' };
        });
      }, function (e) {
        logErr('openrouter fetch', e);
        var aborted = e && (e.name === 'AbortError' || String(e).indexOf('abort') !== -1);
        throw {
          httpStatus: 504,
          code: 'server',
          message: aborted ? 'The AI took too long to respond. Try a shorter request.'
                           : 'Could not reach the AI service. Try again in a moment.'
        };
      });
    }

    return sendUpstream(wantJson).then(function (res) {
      // The call was counted before it was made — see the reservation note above.
      if (wantStream) {
        return readSSE(res).then(function (raw) {
          var sse = stripSSEComments(raw);
          var u = usageFromSSE(sse);
          return recordSpend(user.uid, key, u.cost, model, feature, idToken).then(function () {
            var headers = corsHeaders(origin);
            headers['Content-Type'] = 'text/event-stream; charset=utf-8';
            headers['Cache-Control'] = 'no-cache, no-store';
            headers['X-MM-Tier'] = tier;
            headers['X-MM-Model'] = model;
            headers['X-MM-Used'] = String(limit < 0 ? -1 : usedToday + 1);
            headers['X-MM-Limit'] = String(limit);
            headers['X-MM-Prompt-Tokens'] = String(u.promptTokens);
            headers['X-MM-Completion-Tokens'] = String(u.completionTokens);
            if (u.cost != null) headers['X-MM-Cost'] = String(u.cost);
            return { statusCode: 200, headers: headers, body: sse };
          });
        });
      }

      return res.json().then(function (data) {
        // Real reported usage from OpenRouter. There is no local price table:
        // per-model pricing varies too widely to guess, so `cost` is whatever
        // OpenRouter actually billed (null if it did not report one).
        var u = normalizeUsage(data && data.usage);
        return recordSpend(user.uid, key, u.cost, model, feature, idToken).then(function () {
          return json(200, {
            text: textFromOpenRouter(data),
            model: data && data.model ? data.model : model,
            stopReason: finishReason(data),
            tier: tier,
            used: limit < 0 ? -1 : usedToday + 1,
            limit: limit,
            resetsAt: nextResetMs(QUOTA_TZ),
            promptTokens: u.promptTokens,
            completionTokens: u.completionTokens,
            totalTokens: u.totalTokens,
            cost: u.cost,
            // Legacy aliases so anything still reading the old names keeps working.
            inputTokens: u.promptTokens,
            outputTokens: u.completionTokens
          }, origin);
        });
      });
    }, function (e) {
      // sendUpstream itself failed: a 4xx/5xx or a network error, so OpenRouter
      // never ran the model and never billed for it. Give the student their
      // reserved call back before reporting the failure — a misconfigured model
      // slug must not quietly eat a day's allowance.
      return refundHold().then(function () { throw e; });
    });
  }).then(function (out) {
    releaseHold();
    return out;
  }, function (e) {
    releaseHold();
    throw e;
  }).catch(function (e) {
    if (e && e.code && e.httpStatus) {
      return fail(e.httpStatus, e.code, e.message, origin, e.extra);
    }
    logErr('unhandled', e);
    return fail(500, 'server', 'Something went wrong on our end. Try again in a moment.', origin);
  });
};

/* --------------------------------------------------------- usage + spend write */

/**
 * /aiUsage/<uid>/<day>  (and <day>_img for images), built in ONE place so the
 * read and the write can never disagree about the key.
 *
 * safeKey, not encodeURIComponent: this path segment is an RTDB KEY. RTDB
 * rejects a key containing . # $ / [ ] with a 400, and encodeURIComponent
 * leaves '.' (and ! ~ * ' ( )) untouched, so a dotted uid would make the quota
 * read AND the quota write fail silently — dbGet swallows the error to null and
 * recordUsage is best-effort — leaving the daily limit unenforceable for that
 * account. Firebase's own uids are alphanumeric, but `sub` is accepted as any
 * 1..128-character string, which includes custom-token uids. The spend ledger
 * has always used safeKey; this is the same key by the same rule.
 * encodeURIComponent still wraps it so characters that are legal in an RTDB key
 * but not in a URL path (% ? &) cannot deform the request. Mirrors tts.js.
 */
function usagePathFor(uid, key) {
  return 'aiUsage/' + encodeURIComponent(safeKey(uid)) + '/' + key;
}

// Best-effort: never fail the user's request because the counter write failed.
// Instructor / owner accounts ARE counted now — their calls are the most likely
// to be expensive, and a Usage tab that reads 0 for the biggest spender is worse
// than useless. `limit < 0` only means "no quota", never "do not measure".
//
// Resolves with the post-increment total RTDB reports, so the caller can tell
// whether the reservation overshot the cap. Called BEFORE the upstream request.
function recordUsage(uid, key, currentCount, limit, idToken) {
  var path = usagePathFor(uid, key);
  // Prefer the RTDB atomic server-side increment so parallel calls cannot race.
  return dbPut(path, { '.sv': { increment: 1 } }, idToken).then(function (r) {
    // ONLY a real transport failure earns the non-atomic absolute rewrite, and
    // only when the pre-read count is trustworthy (unlimited tiers skip the
    // read, so there is nothing safe to fall back to — leave it alone rather
    // than clobber the day with 1). A successful write that reported null —
    // RTDB does that for several shapes, and for 204/print=silent — used to
    // land here too, and the absolute value it wrote clobbered every concurrent
    // request's ticks.
    if (dbWriteFailed(r) && limit >= 0) return dbPut(path, currentCount + 1, idToken);
    return r;
  }).catch(function (e) {
    logErr('recordUsage', e);
    return null;
  });
}

/**
 * Give back a call reserved for a request that never cost anything. Atomic and
 * best-effort, exactly like the reservation it undoes.
 */
function refundUsage(uid, key, idToken) {
  if (!uid) return Promise.resolve(null);
  return dbPut(usagePathFor(uid, key), { '.sv': { increment: -1 } }, idToken)
    .catch(function (e) {
      logErr('refundUsage', e);
      return null;
    });
}

// RTDB keys cannot contain . # $ / [ ]
function safeKey(s) {
  return String(s == null ? '' : s).replace(/[.#$/[\]]/g, '_').slice(0, 120) || 'unknown';
}

// Bounded on purpose: the feature tag becomes an RTDB key, so an unrecognised
// (or hostile) value is filed under 'other' rather than growing the ledger a new
// child per request.
function normalizeFeature(v, dflt) {
  var fallback = (typeof dflt === 'string' && KNOWN_FEATURES.indexOf(dflt) !== -1) ? dflt : 'other';
  var f = String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  if (!f) return fallback;
  return KNOWN_FEATURES.indexOf(f) === -1 ? fallback : f;
}

/**
 * Persist the real dollar cost OpenRouter reported. Money is stored as INTEGER
 * microdollars so the atomic increment is exact. Best-effort and never awaited
 * for correctness — a failed ledger write must not cost the student their reply.
 */
function recordSpend(uid, key, cost, model, feature, idToken) {
  if (typeof cost !== 'number' || !isFinite(cost) || cost <= 0) return Promise.resolve(null);
  var micro = Math.round(cost * 1e6);
  if (!(micro > 0)) return Promise.resolve(null);
  var inc = { '.sv': { increment: micro } };
  var one = { '.sv': { increment: 1 } };
  var day = 'aiSpend/' + key + '/';
  var patch = {};
  patch[day + 'total6'] = inc;
  patch[day + 'calls'] = one;
  patch[day + 'byModel/' + safeKey(model) + '6'] = inc;
  patch[day + 'byFeature/' + safeKey(feature) + '6'] = inc;
  patch[day + 'byUser/' + safeKey(uid) + '/usd6'] = inc;
  patch[day + 'byUser/' + safeKey(uid) + '/n'] = one;
  return dbPatch('', patch, idToken).catch(function (e) {
    logErr('recordSpend', e);
    return null;
  });
}

// Microdollars spent site-wide on `key`'s day. Returns 0 when the node is
// unreadable (missing rules) — the ceiling can only ever under-report, never
// lock people out because of a permissions problem.
function readSpendToday(key, idToken) {
  return dbGet('aiSpend/' + key + '/total6', idToken).then(function (v) {
    return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0;
  }).catch(function () { return 0; });
}

/* --------------------------------------------------------------- test surface
 * Pure helpers, exported so the parity tests can prove the client and the server
 * resolve the same model and compute the same promptHash for the same inputs.
 * Netlify only ever calls exports.handler; nothing here is reachable over HTTP.
 * ------------------------------------------------------------------------- */
exports._internals = {
  KNOWN_FEATURES: KNOWN_FEATURES,
  DEFAULT_MODEL: DEFAULT_MODEL,
  DEFAULT_AI_CONFIG: DEFAULT_AI_CONFIG,
  // Exported so a test can assert the client and server verified lists match.
  VERIFIED_MODEL_IDS: VERIFIED_MODEL_IDS,
  VERIFIED_TEXT_MODELS: VERIFIED_TEXT_MODELS,
  VERIFIED_FREE_MODELS: VERIFIED_FREE_MODELS,
  VERIFIED_IMAGE_MODELS: VERIFIED_IMAGE_MODELS,
  VERIFIED_VIDEO_MODELS: VERIFIED_VIDEO_MODELS,
  VERIFIED_PAID_MODELS: VERIFIED_PAID_MODELS,
  DEFAULT_IMAGE_LIMITS: DEFAULT_IMAGE_LIMITS,
  IMAGE_USAGE_SUFFIX: IMAGE_USAGE_SUFFIX,
  IMAGE_TIMEOUT_MS: IMAGE_TIMEOUT_MS,
  normalizeConfig: normalizeConfig,
  normalizeFeature: normalizeFeature,
  normalizeFeatureModels: normalizeFeatureModels,
  normalizeImageLimits: normalizeImageLimits,
  normalizeImageSize: normalizeImageSize,
  imageLimitFor: imageLimitFor,
  resolveModelWith: resolveModelWith,
  rejectsResponseFormat: rejectsResponseFormat,
  promptHash: promptHash,
  imageFromOpenRouter: imageFromOpenRouter,
  looksLikeImageModel: looksLikeImageModel,
  safeKey: safeKey,
  safeAction: safeAction,
  isOwnerUser: isOwnerUser,
  usagePathFor: usagePathFor,
  resolveTier: resolveTier
};
