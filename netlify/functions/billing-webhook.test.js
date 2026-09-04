/* Run: node -e "(async()=>{$(cat billing-webhook.test.js)})()"
 * Signature verification is the security boundary here — an unverified
 * webhook is an unauthenticated tier-grant endpoint, so the negative
 * cases (bad sig, tampered body, unknown price) matter more than the happy path. */
process.env.BILLING_WEBHOOK_SECRET = 'test_secret_123';
process.env.BILLING_PRICE_MAP = JSON.stringify({ 'var_plus': 'plus', 'var_pro': 'pro' });
process.env.FIREBASE_DB_URL = 'https://example.firebaseio.com';
process.env.FIREBASE_DB_SECRET = 'dbsecret';

const crypto = require('crypto');
let fails = 0;
const check = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + ' - ' + n); if (!c) fails++; };

function load(provider) {
  process.env.BILLING_PROVIDER = provider;
  delete require.cache[require.resolve('/Users/school/Documents/GitHub/medmath/netlify/functions/billing-webhook.js')];
  return require('/Users/school/Documents/GitHub/medmath/netlify/functions/billing-webhook.js');
}

// capture writes instead of hitting the network
let lastWrite = null;
global.fetch = async (url, opts) => {
  lastWrite = { url, body: JSON.parse(opts.body) };
  return { ok: true, status: 200 };
};

// ---------- Lemon Squeezy ----------
const ls = load('lemonsqueezy');
const lsBody = JSON.stringify({
  meta: { event_name: 'subscription_created', custom_data: { uid: 'user_abc' } },
  data: { id: 'sub_1', attributes: { status: 'active', customer_id: 'cus_1', variant_id: 'var_plus', renews_at: '2026-10-01T00:00:00Z' } }
});
const lsSig = crypto.createHmac('sha256', 'test_secret_123').update(lsBody, 'utf8').digest('hex');

let r = await ls.handler({ httpMethod: 'POST', body: lsBody, headers: { 'X-Signature': lsSig } });
check('LS valid signature accepted', r.statusCode === 200);
check('LS maps variant -> plus tier', lastWrite && lastWrite.body.tier === 'plus');
check('LS writes to userTiers/<uid>', lastWrite && lastWrite.url.includes('userTiers/user_abc'));

r = await ls.handler({ httpMethod: 'POST', body: lsBody, headers: { 'X-Signature': 'deadbeef' } });
check('LS bad signature REJECTED (401)', r.statusCode === 401);

r = await ls.handler({ httpMethod: 'POST', body: lsBody, headers: {} });
check('LS missing signature rejected', r.statusCode === 401);

// tampered body must fail even with the old valid signature
const tampered = lsBody.replace('var_plus', 'var_pro');
r = await ls.handler({ httpMethod: 'POST', body: tampered, headers: { 'X-Signature': lsSig } });
check('LS tampered body rejected (cannot upgrade tier)', r.statusCode === 401);

// unknown price must NOT grant a paid tier
const unknown = JSON.stringify({
  meta: { event_name: 'subscription_created', custom_data: { uid: 'u2' } },
  data: { id: 's', attributes: { status: 'active', variant_id: 'var_MYSTERY' } } });
r = await ls.handler({ httpMethod: 'POST', body: unknown,
  headers: { 'X-Signature': crypto.createHmac('sha256','test_secret_123').update(unknown,'utf8').digest('hex') } });
check('unknown price id => free, never a guess upward', lastWrite.body.tier === 'free');

// no uid => 200 skip (so provider does not retry forever)
const nouid = JSON.stringify({ meta: { event_name: 'subscription_created' }, data: { id: 's', attributes: { status: 'active', variant_id: 'var_plus' } } });
r = await ls.handler({ httpMethod: 'POST', body: nouid,
  headers: { 'X-Signature': crypto.createHmac('sha256','test_secret_123').update(nouid,'utf8').digest('hex') } });
check('missing uid => 200 skip (no infinite retry)', r.statusCode === 200 && JSON.parse(r.body).skipped);

// base64 bodies (Netlify) must verify against decoded bytes
r = await ls.handler({ httpMethod: 'POST', body: Buffer.from(lsBody).toString('base64'), isBase64Encoded: true, headers: { 'X-Signature': lsSig } });
check('base64-encoded body verifies correctly', r.statusCode === 200);

// entitlement semantics
check('past_due keeps access (grace, not lockout)', ls._test.resolveTier({ event:'subscription_updated', status:'past_due', priceId:'var_plus' }) === 'plus');
check('cancelled keeps access until period end',   ls._test.resolveTier({ event:'subscription_updated', status:'cancelled', priceId:'var_pro' }) === 'pro');
check('expired => free',                            ls._test.resolveTier({ event:'subscription_expired', status:'expired', priceId:'var_pro' }) === 'free');
check('unpaid status => free',                      ls._test.resolveTier({ event:'subscription_updated', status:'unpaid', priceId:'var_pro' }) === 'free');

// ---------- Paddle ----------
const pd = load('paddle');
const pdBody = JSON.stringify({
  event_type: 'subscription.updated',
  data: { id:'sub_p', status:'active', customer_id:'ctm', custom_data:{ uid:'user_p' },
          items:[{ price:{ id:'var_pro' } }], current_billing_period:{ ends_at:'2026-11-01T00:00:00Z' } } });
const ts = '1700000000';
const pdSig = 'ts=' + ts + ';h1=' + crypto.createHmac('sha256','test_secret_123').update(ts + ':' + pdBody,'utf8').digest('hex');
r = await pd.handler({ httpMethod:'POST', body: pdBody, headers: { 'Paddle-Signature': pdSig } });
check('Paddle valid signature accepted', r.statusCode === 200);
check('Paddle maps price -> pro', lastWrite.body.tier === 'pro');
r = await pd.handler({ httpMethod:'POST', body: pdBody, headers: { 'Paddle-Signature': 'ts='+ts+';h1=bad' } });
check('Paddle bad signature rejected', r.statusCode === 401);

// ---------- Stripe ----------
const sp = load('stripe');
const spBody = JSON.stringify({ type:'customer.subscription.updated',
  data:{ object:{ id:'sub_s', status:'active', customer:'cus', metadata:{ uid:'user_s' },
        items:{ data:[{ price:{ id:'var_plus' } }] }, current_period_end: 1790000000 } } });
const st = '1700000000';
const spSig = 't=' + st + ',v1=' + crypto.createHmac('sha256','test_secret_123').update(st + '.' + spBody,'utf8').digest('hex');
r = await sp.handler({ httpMethod:'POST', body: spBody, headers: { 'Stripe-Signature': spSig } });
check('Stripe valid signature accepted', r.statusCode === 200);
check('Stripe maps price -> plus', lastWrite.body.tier === 'plus');

// method guard
r = await sp.handler({ httpMethod:'GET', body:'', headers:{} });
check('GET rejected (405)', r.statusCode === 405);

console.log(fails ? '\n' + fails + ' FAILING' : '\nall billing webhook tests pass');
process.exit(fails ? 1 : 0);
