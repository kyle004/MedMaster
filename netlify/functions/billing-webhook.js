/* ============================================================================
 * netlify/functions/billing-webhook.js   ->   POST /api/billing/webhook
 *
 * Turns a payment provider's subscription events into a tier in Firebase.
 *
 * PROVIDER-AGNOSTIC ON PURPOSE. The provider choice (Lemon Squeezy vs Paddle vs
 * Stripe) is a business decision that can change; it should not be load-bearing
 * in the code. Everything provider-specific lives in ADAPTERS below — signature
 * verification, event-name mapping, and where the fields sit in the payload.
 * Everything after `normalise()` is shared. Swapping provider is writing one
 * adapter, not a rewrite.
 *
 * WHAT IT WRITES
 *   userTiers/<uid> = {
 *     tier, status, provider, subscriptionId, customerId,
 *     currentPeriodEnd, updatedAt, priceId
 *   }
 *   `tier` is what ai.js already reads for quota + model routing, so the rest of
 *   the app needs no changes — a paid webhook simply raises the tier.
 *
 * SECURITY
 *   - Signature verified before ANY parsing of the body as meaningful data.
 *     An unverified webhook is an unauthenticated tier-grant endpoint.
 *   - Constant-time comparison, so a wrong signature cannot be brute-forced by
 *     timing the reply.
 *   - Writes use FIREBASE_DB_SECRET (server-side, rules-bypassing). The client
 *     must NEVER be able to write userTiers — see firebase-rules.json, where
 *     userTiers/$uid is owner-only.
 *
 * ENV
 *   BILLING_PROVIDER        'lemonsqueezy' | 'paddle' | 'stripe'
 *   BILLING_WEBHOOK_SECRET  signing secret from the provider dashboard
 *   FIREBASE_DB_URL, FIREBASE_DB_SECRET   (same vars ai.js already uses)
 * ========================================================================== */

'use strict';

var crypto = require('crypto');

var PROVIDER = (process.env.BILLING_PROVIDER || 'lemonsqueezy').toLowerCase();
var SECRET   = process.env.BILLING_WEBHOOK_SECRET || '';

/* Price/variant id -> tier. Set these to the ids from your provider dashboard.
 * Unknown ids deliberately resolve to 'free' rather than guessing upward: a
 * typo must never hand out a paid tier. */
var PRICE_TIERS = {};
try { PRICE_TIERS = JSON.parse(process.env.BILLING_PRICE_MAP || '{}'); } catch (e) { PRICE_TIERS = {}; }

/* Which subscription states still entitle the user to their paid tier.
 * `past_due` intentionally KEEPS access: the card failed, the provider is
 * retrying, and locking a nursing student out of their exam prep mid-retry is
 * worse for both sides than a few days of grace. `cancelled` also keeps access
 * until currentPeriodEnd — they paid for that period. */
var ENTITLING = ['active', 'trialing', 'past_due', 'cancelled', 'paused'];

/* -------------------------------------------------------------- utilities -- */

function timingSafeEqual(a, b) {
  var ba = Buffer.from(String(a) || '', 'utf8');
  var bb = Buffer.from(String(b) || '', 'utf8');
  if (ba.length !== bb.length) return false;          // length alone is not secret
  try { return crypto.timingSafeEqual(ba, bb); } catch (e) { return false; }
}

function json(statusCode, obj) {
  return { statusCode: statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

function dbBase() { return String(process.env.FIREBASE_DB_URL || '').replace(/\/+$/, ''); }

function dbPatch(path, value) {
  var base = dbBase();
  var secret = process.env.FIREBASE_DB_SECRET;
  if (!base || !secret) return Promise.reject(new Error('FIREBASE_DB_URL / FIREBASE_DB_SECRET missing'));
  var url = base + '/' + path + '.json?auth=' + encodeURIComponent(secret);
  return fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  }).then(function (r) {
    if (!r.ok) throw new Error('rtdb ' + r.status);
    return true;
  });
}

/* --------------------------------------------------------------- adapters -- */

var ADAPTERS = {
  lemonsqueezy: {
    verify: function (raw, headers) {
      var sig = headers['x-signature'] || headers['X-Signature'] || '';
      var digest = crypto.createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex');
      return timingSafeEqual(digest, sig);
    },
    normalise: function (body) {
      var meta = body.meta || {};
      var data = body.data || {};
      var attr = data.attributes || {};
      return {
        event: String(meta.event_name || ''),
        // custom_data is set when the checkout is created — this is how a
        // payment is tied back to a Firebase uid. Without it the event is
        // unattributable and must be rejected, not guessed at by email.
        uid: (meta.custom_data && (meta.custom_data.uid || meta.custom_data.user_id)) || '',
        status: String(attr.status || ''),
        subscriptionId: String(data.id || ''),
        customerId: String(attr.customer_id || ''),
        priceId: String(attr.variant_id || ''),
        periodEnd: attr.renews_at || attr.ends_at || null
      };
    }
  },

  paddle: {
    verify: function (raw, headers) {
      // Paddle Billing sends "ts=...;h1=..." and signs `ts:body`.
      var header = headers['paddle-signature'] || headers['Paddle-Signature'] || '';
      var parts = {};
      String(header).split(';').forEach(function (kv) {
        var i = kv.indexOf('=');
        if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
      });
      if (!parts.ts || !parts.h1) return false;
      var digest = crypto.createHmac('sha256', SECRET).update(parts.ts + ':' + raw, 'utf8').digest('hex');
      return timingSafeEqual(digest, parts.h1);
    },
    normalise: function (body) {
      var d = body.data || {};
      var items = Array.isArray(d.items) ? d.items : [];
      return {
        event: String(body.event_type || ''),
        uid: (d.custom_data && (d.custom_data.uid || d.custom_data.user_id)) || '',
        status: String(d.status || ''),
        subscriptionId: String(d.id || ''),
        customerId: String(d.customer_id || ''),
        priceId: String((items[0] && items[0].price && items[0].price.id) || ''),
        periodEnd: (d.current_billing_period && d.current_billing_period.ends_at) || null
      };
    }
  },

  stripe: {
    verify: function (raw, headers) {
      var header = headers['stripe-signature'] || headers['Stripe-Signature'] || '';
      var parts = {};
      String(header).split(',').forEach(function (kv) {
        var i = kv.indexOf('=');
        if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
      });
      if (!parts.t || !parts.v1) return false;
      var digest = crypto.createHmac('sha256', SECRET).update(parts.t + '.' + raw, 'utf8').digest('hex');
      return timingSafeEqual(digest, parts.v1);
    },
    normalise: function (body) {
      var o = (body.data && body.data.object) || {};
      var item = (o.items && o.items.data && o.items.data[0]) || {};
      return {
        event: String(body.type || ''),
        uid: (o.metadata && (o.metadata.uid || o.metadata.user_id)) || '',
        status: String(o.status || ''),
        subscriptionId: String(o.id || ''),
        customerId: String(o.customer || ''),
        priceId: String((item.price && item.price.id) || ''),
        periodEnd: o.current_period_end ? new Date(o.current_period_end * 1000).toISOString() : null
      };
    }
  }
};

/* Events that mean "this subscription ended for good". Everything else is
 * treated as an update, and the STATUS decides entitlement — not the event name.
 * Mapping on status rather than on ~20 provider-specific event names is what
 * keeps the three adapters small. */
function isTerminal(evt) {
  return /expired|deleted|canceled_immediately|payment_failed_final/i.test(evt);
}

function resolveTier(n) {
  if (isTerminal(n.event)) return 'free';
  if (ENTITLING.indexOf(n.status) === -1) return 'free';
  return PRICE_TIERS[n.priceId] || 'free';
}

/* ----------------------------------------------------------------- handler -- */

exports.handler = function (event) {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!SECRET) return json(500, { ok: false, error: 'BILLING_WEBHOOK_SECRET not set' });

  var adapter = ADAPTERS[PROVIDER];
  if (!adapter) return json(500, { ok: false, error: 'unknown BILLING_PROVIDER: ' + PROVIDER });

  // Netlify may base64 the body; the signature is over the RAW bytes, so decode
  // before verifying or every signature check fails.
  var raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');

  var headers = {};
  Object.keys(event.headers || {}).forEach(function (k) { headers[k.toLowerCase()] = event.headers[k]; });

  if (!adapter.verify(raw, headers)) {
    // No detail in the reply: a precise error tells an attacker how close they got.
    return json(401, { ok: false, error: 'bad signature' });
  }

  var body;
  try { body = JSON.parse(raw); } catch (e) { return json(400, { ok: false, error: 'bad json' }); }

  var n;
  try { n = adapter.normalise(body); } catch (e) { return json(400, { ok: false, error: 'bad payload' }); }

  if (!n.uid) {
    // 200 on purpose: the payload was authentic, it just is not ours to act on
    // (or the checkout was created without custom_data). Returning non-2xx would
    // make the provider retry this forever.
    return json(200, { ok: true, skipped: 'no uid in custom_data' });
  }

  var tier = resolveTier(n);
  var record = {
    tier: tier,
    status: n.status || (isTerminal(n.event) ? 'expired' : ''),
    provider: PROVIDER,
    subscriptionId: n.subscriptionId,
    customerId: n.customerId,
    priceId: n.priceId,
    currentPeriodEnd: n.periodEnd || null,
    updatedAt: Date.now()
  };

  return dbPatch('userTiers/' + encodeURIComponent(n.uid), record)
    .then(function () { return json(200, { ok: true, uid: n.uid, tier: tier, event: n.event }); })
    .catch(function (e) {
      // 500 so the provider RETRIES. Dropping this silently would leave a paying
      // customer on the free tier with no trace.
      return json(500, { ok: false, error: (e && e.message) || 'write failed' });
    });
};

exports._test = { ADAPTERS: ADAPTERS, resolveTier: resolveTier, isTerminal: isTerminal, timingSafeEqual: timingSafeEqual };
