'use strict';
/* ============================================================================
   billing-webhook.test.js  —  netlify/functions/billing-webhook.js
   ----------------------------------------------------------------------------
   The signature check IS the security boundary. An unverified webhook is an
   unauthenticated "make me Pro" endpoint, so this suite is weighted toward the
   negative cases: forged signature, replayed-but-tampered body, unknown price
   id, missing account attribution.

   All three provider adapters are exercised (Lemon Squeezy, Paddle, Stripe)
   because the provider is meant to be swappable by env var, and an adapter that
   was never run is an adapter that does not work.

   Run:  node tests/run.js billing
   ========================================================================== */

var crypto = require('crypto');
var path = require('path');

var FN = path.join(__dirname, '..', 'netlify', 'functions', 'billing-webhook.js');
var SECRET = 'test_secret_123';

function load(provider) {
  process.env.BILLING_PROVIDER = provider;
  process.env.BILLING_WEBHOOK_SECRET = SECRET;
  process.env.BILLING_PRICE_MAP = JSON.stringify({ var_plus: 'plus', var_pro: 'pro' });
  process.env.FIREBASE_DB_URL = 'https://example.firebaseio.com';
  process.env.FIREBASE_DB_SECRET = 'dbsecret';
  delete require.cache[require.resolve(FN)];
  return require(FN);
}

function hmacHex(data) {
  return crypto.createHmac('sha256', SECRET).update(data, 'utf8').digest('hex');
}

module.exports = {
  name: 'billing-webhook',

  run: function (t) {
    // Capture the RTDB write instead of performing it.
    var lastWrite = null;
    var realFetch = global.fetch;
    global.fetch = function (url, opts) {
      lastWrite = { url: url, body: JSON.parse(opts.body) };
      return Promise.resolve({ ok: true, status: 200 });
    };

    function restore() { global.fetch = realFetch; }

    var ls = load('lemonsqueezy');

    var lsBody = JSON.stringify({
      meta: { event_name: 'subscription_created', custom_data: { uid: 'user_abc' } },
      data: { id: 'sub_1', attributes: {
        status: 'active', customer_id: 'cus_1', variant_id: 'var_plus', renews_at: '2026-10-01T00:00:00Z' } }
    });
    var lsSig = hmacHex(lsBody);

    return Promise.resolve()
      .then(function () {
        t.group('Lemon Squeezy — happy path');
        return ls.handler({ httpMethod: 'POST', body: lsBody, headers: { 'X-Signature': lsSig } });
      })
      .then(function (r) {
        t.eq(r.statusCode, 200, 'valid signature accepted');
        t.eq(lastWrite && lastWrite.body.tier, 'plus', 'variant id maps to the plus tier');
        t.ok(lastWrite && lastWrite.url.indexOf('userTiers/user_abc') !== -1,
             'writes to userTiers/<uid>, the node ai.js already reads');

        t.group('forged and tampered requests');
        return ls.handler({ httpMethod: 'POST', body: lsBody, headers: { 'X-Signature': 'deadbeef' } });
      })
      .then(function (r) {
        t.eq(r.statusCode, 401, 'forged signature rejected');
        return ls.handler({ httpMethod: 'POST', body: lsBody, headers: {} });
      })
      .then(function (r) {
        t.eq(r.statusCode, 401, 'missing signature rejected');
        // Re-sign nothing: keep the valid signature, change the tier in the body.
        var tampered = lsBody.replace('var_plus', 'var_pro');
        return ls.handler({ httpMethod: 'POST', body: tampered, headers: { 'X-Signature': lsSig } });
      })
      .then(function (r) {
        t.eq(r.statusCode, 401, 'body tampered to upgrade the tier is rejected');

        t.group('attribution and unknown ids');
        var unknown = JSON.stringify({
          meta: { event_name: 'subscription_created', custom_data: { uid: 'u2' } },
          data: { id: 's', attributes: { status: 'active', variant_id: 'var_MYSTERY' } } });
        return ls.handler({ httpMethod: 'POST', body: unknown, headers: { 'X-Signature': hmacHex(unknown) } });
      })
      .then(function () {
        t.eq(lastWrite.body.tier, 'free', 'an unmapped price id resolves to free, never upward');
        var nouid = JSON.stringify({
          meta: { event_name: 'subscription_created' },
          data: { id: 's', attributes: { status: 'active', variant_id: 'var_plus' } } });
        return ls.handler({ httpMethod: 'POST', body: nouid, headers: { 'X-Signature': hmacHex(nouid) } });
      })
      .then(function (r) {
        t.eq(r.statusCode, 200, 'unattributable event returns 200 so the provider stops retrying');
        t.ok(JSON.parse(r.body).skipped, 'and reports that it skipped rather than guessing by email');

        t.group('transport');
        return ls.handler({ httpMethod: 'POST', isBase64Encoded: true,
                            body: Buffer.from(lsBody).toString('base64'),
                            headers: { 'X-Signature': lsSig } });
      })
      .then(function (r) {
        t.eq(r.statusCode, 200, 'base64 body verifies against the decoded bytes (Netlify encodes them)');

        t.group('entitlement semantics');
        var rt = ls._test.resolveTier;
        t.eq(rt({ event: 'subscription_updated', status: 'past_due', priceId: 'var_plus' }), 'plus',
             'past_due keeps access — card retry must not lock a student out mid-exam-prep');
        t.eq(rt({ event: 'subscription_updated', status: 'cancelled', priceId: 'var_pro' }), 'pro',
             'cancelled keeps access to the end of the paid period');
        t.eq(rt({ event: 'subscription_expired', status: 'expired', priceId: 'var_pro' }), 'free',
             'expired drops to free');
        t.eq(rt({ event: 'subscription_updated', status: 'unpaid', priceId: 'var_pro' }), 'free',
             'unpaid drops to free');

        t.group('Paddle adapter');
        var pd = load('paddle');
        var pdBody = JSON.stringify({
          event_type: 'subscription.updated',
          data: { id: 'sub_p', status: 'active', customer_id: 'ctm', custom_data: { uid: 'user_p' },
                  items: [{ price: { id: 'var_pro' } }],
                  current_billing_period: { ends_at: '2026-11-01T00:00:00Z' } } });
        var ts = '1700000000';
        var sig = 'ts=' + ts + ';h1=' + hmacHex(ts + ':' + pdBody);
        return pd.handler({ httpMethod: 'POST', body: pdBody, headers: { 'Paddle-Signature': sig } })
          .then(function (r2) {
            t.eq(r2.statusCode, 200, 'valid Paddle signature accepted');
            t.eq(lastWrite.body.tier, 'pro', 'Paddle price id maps to pro');
            return pd.handler({ httpMethod: 'POST', body: pdBody,
                                headers: { 'Paddle-Signature': 'ts=' + ts + ';h1=bad' } });
          })
          .then(function (r3) { t.eq(r3.statusCode, 401, 'forged Paddle signature rejected'); });
      })
      .then(function () {
        t.group('Stripe adapter');
        var sp = load('stripe');
        var spBody = JSON.stringify({
          type: 'customer.subscription.updated',
          data: { object: { id: 'sub_s', status: 'active', customer: 'cus', metadata: { uid: 'user_s' },
                  items: { data: [{ price: { id: 'var_plus' } }] }, current_period_end: 1790000000 } } });
        var st = '1700000000';
        var sig = 't=' + st + ',v1=' + hmacHex(st + '.' + spBody);
        return sp.handler({ httpMethod: 'POST', body: spBody, headers: { 'Stripe-Signature': sig } })
          .then(function (r) {
            t.eq(r.statusCode, 200, 'valid Stripe signature accepted');
            t.eq(lastWrite.body.tier, 'plus', 'Stripe price id maps to plus');
            return sp.handler({ httpMethod: 'GET', body: '', headers: {} });
          })
          .then(function (r) { t.eq(r.statusCode, 405, 'non-POST rejected'); });
      })
      .then(restore, function (e) { restore(); throw e; });
  }
};
