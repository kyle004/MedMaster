/* ============================================================================
 * MedMaster - js/ai-admin.js
 * window.AIAdminPanel : owner-only control room for the AI layer.
 *
 * Tabs: Settings | Tiers | Users | Usage
 *   - master AI on/off switch and "let users pick their model"
 *   - per-tier editor (allowed models, daily limit, max tokens)
 *   - user tier manager (search by email, grant a tier, optional expiry)
 *   - usage dashboard (today's calls by tier, top users)
 *   - Test connection: makes one real AI call and reports success or the code
 *
 * Writes to /appConfig/aiConfig and /userTiers/<uid>.
 * Requires js/ai.js to be loaded first (uses MM.ai.MODEL_CATALOG + MM.ai.chat).
 * ==========================================================================*/
(function () {
  'use strict';

  var ce = React.createElement;
  var useState = React.useState, useEffect = React.useEffect,
      useRef = React.useRef, useMemo = React.useMemo,
      useCallback = React.useCallback;

  var OWNER_EMAIL = 'codingky@gmail.com';
  var CFG_PATH = 'appConfig/aiConfig';
  var TIER_ORDER = ['free', 'plus', 'pro', 'instructor'];
  var TIER_LABEL = { free: 'Free', plus: 'Plus', pro: 'Pro', instructor: 'Instructor' };
  var TIER_COLOR = { free: 'var(--text3)', plus: 'var(--accent)', pro: 'var(--accent2)', instructor: 'var(--green)' };

  /* ------------------------------------------------------------------ styles */

  if (!document.getElementById('ai-admin-styles')) {
    var st = document.createElement('style');
    st.id = 'ai-admin-styles';
    st.textContent = [
      '.aia-wrap{max-width:960px;margin:0 auto}',
      '.aia-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}',
      '.aia-tab{flex:1 1 auto;min-width:88px;padding:8px 12px;border-radius:8px;border:1px solid var(--surface2);',
      'background:var(--surface);color:var(--text2);font-size:.85rem;font-weight:600;cursor:pointer;transition:all .15s}',
      '.aia-tab:hover{color:var(--text);border-color:var(--accent)}',
      '.aia-tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.aia-tab.on{background:var(--accent);border-color:var(--accent);color:#fff}',
      '.aia-card{background:var(--surface);border:1px solid var(--surface2);border-radius:12px;padding:16px;margin-bottom:14px}',
      '.aia-card.alert{border-color:var(--red)}',
      '.aia-card.ok{border-color:var(--green)}',
      '.aia-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.aia-h{font-weight:700;font-size:1rem;display:flex;align-items:center;gap:8px;margin:0}',
      '.aia-desc{color:var(--text3);font-size:.85rem;line-height:1.5;margin:6px 0 0}',
      '.aia-toggle{width:46px;height:26px;border-radius:13px;border:none;cursor:pointer;position:relative;flex:0 0 auto;',
      'background:var(--surface2);transition:background .2s}',
      '.aia-toggle.on{background:var(--green)}',
      '.aia-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.aia-toggle span{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;',
      'transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.4)}',
      '.aia-toggle.on span{left:23px}',
      '.aia-tierhead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}',
      '.aia-badge{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 9px;',
      'border-radius:999px;background:var(--surface2);color:var(--text2)}',
      '.aia-models{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin:10px 0}',
      '.aia-model{display:flex;gap:9px;align-items:flex-start;padding:9px 10px;border-radius:9px;cursor:pointer;',
      'border:1px solid var(--surface2);background:var(--bg);transition:border-color .15s}',
      '.aia-model:hover{border-color:var(--accent)}',
      '.aia-model.on{border-color:var(--accent);background:rgba(59,130,246,.10)}',
      '.aia-model input{margin-top:3px;flex:0 0 auto;accent-color:var(--accent)}',
      '.aia-model b{display:block;font-size:.86rem;color:var(--text)}',
      '.aia-model small{display:block;color:var(--text3);font-size:.74rem;line-height:1.35;margin-top:2px}',
      '.aia-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:6px}',
      '.aia-field label{display:block;font-size:.75rem;color:var(--text3);margin-bottom:4px;font-weight:600}',
      '.aia-input{width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--surface2);',
      'color:var(--text);border-radius:8px;padding:8px 10px;font-size:.9rem;font-family:inherit}',
      '.aia-input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 2px rgba(59,130,246,.25)}',
      '.aia-list{max-height:340px;overflow-y:auto;-webkit-overflow-scrolling:touch}',
      '.aia-user{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--surface2);flex-wrap:wrap}',
      '.aia-user:last-child{border-bottom:none}',
      '.aia-user .who{flex:1 1 180px;min-width:0}',
      '.aia-user .who b{display:block;font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.aia-user .who small{color:var(--text3);font-size:.75rem;overflow:hidden;text-overflow:ellipsis;',
      'white-space:nowrap;display:block}',
      '.aia-pills{display:flex;gap:4px;flex-wrap:wrap}',
      '.aia-pill{font-size:.74rem;font-weight:600;padding:4px 9px;border-radius:999px;cursor:pointer;',
      'border:1px solid var(--surface2);background:var(--bg);color:var(--text2);transition:all .15s}',
      '.aia-pill:hover{border-color:var(--accent);color:var(--text)}',
      '.aia-pill:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.aia-pill.on{background:var(--accent);border-color:var(--accent);color:#fff}',
      '.aia-bar{height:7px;border-radius:4px;background:var(--surface2);overflow:hidden;margin-top:5px}',
      '.aia-bar i{display:block;height:100%;background:var(--accent);border-radius:4px}',
      '.aia-note{font-size:.82rem;padding:9px 11px;border-radius:8px;line-height:1.45;margin-top:10px;word-break:break-word}',
      '.aia-note.ok{background:rgba(34,197,94,.12);color:var(--green)}',
      '.aia-note.err{background:rgba(239,68,68,.12);color:var(--red)}',
      '.aia-note.info{background:rgba(59,130,246,.12);color:var(--accent)}',
      '.aia-empty{text-align:center;color:var(--text3);padding:22px 10px;font-size:.88rem}',
      '.aia-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem;',
      'background:var(--bg);border:1px solid var(--surface2);border-radius:6px;padding:2px 6px;color:var(--text2)}',
      '@media (max-width:640px){',
      '.aia-card{padding:13px}',
      '.aia-models{grid-template-columns:1fr}',
      '.aia-tab{min-width:0;flex:1 1 44%;font-size:.8rem;padding:8px 6px}',
      '.aia-user .who{flex:1 1 100%}',
      '.aia-h{font-size:.94rem}',
      '}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ----------------------------------------------------------------- helpers */

  function mm() { return window.MM || {}; }

  function db() {
    var m = mm();
    if (m.db) return m.db;
    try {
      if (window.firebase && window.firebase.apps && window.firebase.apps.length) {
        return window.firebase.database();
      }
    } catch (e) { /* noop */ }
    return null;
  }

  function ai() { return (window.MM && window.MM.ai) ? window.MM.ai : window.MM_AI; }

  function toast(msg, type) {
    var m = mm();
    if (typeof m.toast === 'function') { m.toast(msg, type || 'info'); }
  }

  function catalog() {
    var a = ai();
    return (a && a.MODEL_CATALOG) ? a.MODEL_CATALOG : [];
  }

  function defaults() {
    var a = ai();
    if (a && a.DEFAULT_AI_CONFIG) return a.DEFAULT_AI_CONFIG;
    return {
      enabled: true, allowModelChoice: false,
      tiers: {
        free: { models: [], dailyLimit: 25, maxTokens: 1024 },
        plus: { models: [], dailyLimit: 200, maxTokens: 2048 },
        pro: { models: [], dailyLimit: 1000, maxTokens: 4096 },
        instructor: { models: ['*'], dailyLimit: -1, maxTokens: 8192 }
      }
    };
  }

  function todayKey() {
    var a = ai();
    if (a && typeof a.dayKey === 'function') return a.dayKey();
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
    } catch (e) { return new Date().toISOString().slice(0, 10); }
  }

  function normTier(rec) {
    if (!rec) return 'free';
    if (typeof rec === 'string') return rec;
    if (typeof rec.tier !== 'string') return 'free';
    if (rec.expiresAt && typeof rec.expiresAt === 'number' && Date.now() > rec.expiresAt) return 'free';
    return rec.tier;
  }

  function modelsOf(tierCfg) {
    if (!tierCfg) return [];
    var m = tierCfg.models;
    if (Array.isArray(m)) return m;
    if (m && typeof m === 'object') {
      return Object.keys(m).filter(function (k) { return !!m[k]; })
        .map(function (k) { return typeof m[k] === 'string' ? m[k] : k; });
    }
    return [];
  }

  function fmtDate(ms) {
    if (!ms) return '';
    try { return new Date(ms).toLocaleDateString(); } catch (e) { return ''; }
  }

  function toDateInput(ms) {
    if (!ms) return '';
    try {
      var d = new Date(ms);
      var mo = String(d.getMonth() + 1);
      var da = String(d.getDate());
      if (mo.length < 2) mo = '0' + mo;
      if (da.length < 2) da = '0' + da;
      return d.getFullYear() + '-' + mo + '-' + da;
    } catch (e) { return ''; }
  }

  /* ------------------------------------------------------------ small pieces */

  function Toggle(on, onChange, label) {
    return ce('button', {
      type: 'button',
      className: 'aia-toggle' + (on ? ' on' : ''),
      'aria-pressed': on ? 'true' : 'false',
      'aria-label': label || 'toggle',
      onClick: function () { onChange(!on); }
    }, ce('span', null));
  }

  function Card(props, children) {
    return ce('div', { className: 'aia-card' + (props && props.mod ? ' ' + props.mod : '') }, children);
  }

  /* ==========================================================================
   * MAIN COMPONENT
   * ======================================================================== */

  function AIAdminPanel(props) {
    var p = props || {};
    var isOwner = p.isSuperAdmin === true ||
      (mm().authUser && String(mm().authUser.email || '').toLowerCase() === OWNER_EMAIL);

    var tabState = useState('settings');
    var tab = tabState[0], setTab = tabState[1];

    var cfgState = useState(null);
    var cfg = cfgState[0], setCfg = cfgState[1];

    var loadState = useState(true);
    var loading = loadState[0], setLoading = loadState[1];

    var metaState = useState({});
    var userMeta = metaState[0], setUserMeta = metaState[1];

    var tiersState = useState({});
    var userTiers = tiersState[0], setUserTiers = tiersState[1];

    var usageState = useState({});
    var usage = usageState[0], setUsage = usageState[1];

    var usageLoadState = useState(false);
    var usageLoaded = usageLoadState[0], setUsageLoaded = usageLoadState[1];

    var errState = useState('');
    var loadError = errState[0], setLoadError = errState[1];

    var mounted = useRef(true);
    useEffect(function () { return function () { mounted.current = false; }; }, []);

    /* ---- live config ---- */
    useEffect(function () {
      var d = db();
      if (!d) { setLoading(false); setLoadError('Firebase is not connected, so AI settings cannot be loaded.'); return; }
      var ref = d.ref(CFG_PATH);
      var cb = ref.on('value', function (snap) {
        if (!mounted.current) return;
        var raw = snap.val();
        setCfg(mergeWithDefaults(raw));
        setLoading(false);
        setLoadError('');
      }, function (e) {
        if (!mounted.current) return;
        setLoading(false);
        setLoadError('Could not read /appConfig/aiConfig: ' + (e && e.message ? e.message : 'permission denied'));
      });
      return function () { try { ref.off('value', cb); } catch (e) { /* noop */ } };
    }, []);

    /* ---- users + tiers (owner only, one-time reads with live tier updates) ---- */
    useEffect(function () {
      if (!isOwner) return;
      var d = db();
      if (!d) return;
      var tRef = d.ref('userTiers');
      var tCb = tRef.on('value', function (snap) {
        if (mounted.current) setUserTiers(snap.val() || {});
      }, function () { /* rules may block; leave empty */ });

      d.ref('userMeta').once('value').then(function (snap) {
        if (mounted.current) setUserMeta(snap.val() || {});
      }).catch(function () { /* noop */ });

      return function () { try { tRef.off('value', tCb); } catch (e) { /* noop */ } };
    }, [isOwner]);

    /* ---- usage (loaded when the Usage tab is first opened) ---- */
    var loadUsage = useCallback(function () {
      var d = db();
      if (!d) return;
      setUsageLoaded(false);
      d.ref('aiUsage').once('value').then(function (snap) {
        if (!mounted.current) return;
        setUsage(snap.val() || {});
        setUsageLoaded(true);
      }).catch(function () {
        if (!mounted.current) return;
        setUsage({});
        setUsageLoaded(true);
      });
    }, []);

    useEffect(function () {
      if (tab === 'usage' && !usageLoaded) loadUsage();
    }, [tab, usageLoaded, loadUsage]);

    /* ---- writers ---- */

    function writeCfg(path, value) {
      var d = db();
      if (!d) { toast('Firebase not connected.', 'error'); return; }
      d.ref(CFG_PATH + (path ? '/' + path : '')).set(value).then(function () {
        toast('Saved.', 'success');
      }).catch(function (e) {
        toast('Save failed: ' + (e && e.message ? e.message : 'permission denied'), 'error');
      });
    }

    function setUserTier(uid, tier, expiresAt) {
      var d = db();
      if (!d) { toast('Firebase not connected.', 'error'); return; }
      var me = mm().authUser;
      var rec = {
        tier: tier,
        grantedBy: me && me.email ? me.email : OWNER_EMAIL,
        grantedAt: Date.now(),
        expiresAt: expiresAt ? expiresAt : null
      };
      d.ref('userTiers/' + uid).set(rec).then(function () {
        toast('Tier set to ' + tier + '.', 'success');
      }).catch(function (e) {
        toast('Could not set tier: ' + (e && e.message ? e.message : 'permission denied'), 'error');
      });
    }

    /* ---- render ---- */

    if (!isOwner) {
      return ce('div', { className: 'aia-wrap' },
        ce('div', { className: 'aia-card alert' },
          ce('p', { className: 'aia-h' }, 'Owner only'),
          ce('p', { className: 'aia-desc' }, 'AI settings can only be changed by the site owner.')
        )
      );
    }

    if (loading) {
      return ce('div', { className: 'aia-wrap' },
        ce('div', { className: 'aia-card' }, ce('p', { className: 'aia-empty' }, 'Loading AI settings...'))
      );
    }

    var config = cfg || mergeWithDefaults(null);

    return ce('div', { className: 'aia-wrap' },
      ce('div', { className: 'aia-tabs', role: 'tablist' },
        [['settings', 'Settings'], ['tiers', 'Tiers'], ['users', 'Users'], ['usage', 'Usage']].map(function (t) {
          return ce('button', {
            key: t[0], type: 'button', role: 'tab',
            'aria-selected': tab === t[0] ? 'true' : 'false',
            className: 'aia-tab' + (tab === t[0] ? ' on' : ''),
            onClick: function () { setTab(t[0]); }
          }, t[1]);
        })
      ),

      loadError && ce('div', { className: 'aia-note err' }, loadError),

      tab === 'settings' && ce(SettingsTab, { config: config, writeCfg: writeCfg }),
      tab === 'tiers' && ce(TiersTab, { config: config, writeCfg: writeCfg }),
      tab === 'users' && ce(UsersTab, {
        userMeta: userMeta, userTiers: userTiers, setUserTier: setUserTier, config: config
      }),
      tab === 'usage' && ce(UsageTab, {
        usage: usage, loaded: usageLoaded, reload: loadUsage,
        userMeta: userMeta, userTiers: userTiers, config: config
      })
    );
  }

  function mergeWithDefaults(raw) {
    var d = defaults();
    var out = {
      enabled: raw && typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
      allowModelChoice: raw && raw.allowModelChoice === true,
      tiers: {}
    };
    var i, name;
    for (i = 0; i < TIER_ORDER.length; i++) {
      name = TIER_ORDER[i];
      var dt = d.tiers[name] || { models: [], dailyLimit: 0, maxTokens: 1024 };
      var rt = (raw && raw.tiers && raw.tiers[name]) ? raw.tiers[name] : null;
      out.tiers[name] = {
        models: rt ? modelsOf(rt) : (Array.isArray(dt.models) ? dt.models.slice() : []),
        dailyLimit: rt && typeof rt.dailyLimit === 'number' ? rt.dailyLimit : dt.dailyLimit,
        maxTokens: rt && typeof rt.maxTokens === 'number' ? rt.maxTokens : dt.maxTokens
      };
    }
    return out;
  }

  /* ==========================================================================
   * TAB: SETTINGS
   * ======================================================================== */

  function SettingsTab(props) {
    var config = props.config, writeCfg = props.writeCfg;

    var testState = useState(null);
    var test = testState[0], setTest = testState[1];
    var busyState = useState(false);
    var busy = busyState[0], setBusy = busyState[1];

    function runTest() {
      var a = ai();
      if (!a || typeof a.chat !== 'function') {
        setTest({ ok: false, msg: 'js/ai.js is not loaded, so MM.ai.chat does not exist.' });
        return;
      }
      setBusy(true);
      setTest(null);
      var started = Date.now();
      a.chat({
        system: 'You are a connection test. Reply with exactly the two words: CONNECTION OK',
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 24,
        temperature: 0
      }).then(function (text) {
        setBusy(false);
        var ms = Date.now() - started;
        setTest({
          ok: true,
          msg: 'Success in ' + ms + ' ms. Model replied: "' + String(text).trim().slice(0, 120) + '"'
        });
      }).catch(function (e) {
        setBusy(false);
        var code = (e && e.code) ? e.code : 'server';
        var hint = {
          'no-auth': 'The Firebase ID token was rejected. Check FIREBASE_PROJECT_ID in Netlify - it must match your Firebase project exactly.',
          'tier-denied': 'The model is not on this tier\'s allowlist. Fix it on the Tiers tab.',
          'quota-exceeded': 'The daily limit for this account has been reached.',
          'ai-disabled': 'The master switch above is off.',
          'network': 'The browser could not reach /api/ai. Confirm the function deployed and the netlify.toml redirect exists.',
          'server': 'The function returned an error. Check the Netlify function log for ai - the usual cause is a missing ANTHROPIC_API_KEY or FIREBASE_DB_URL.'
        }[code];
        setTest({ ok: false, msg: 'Failed [' + code + ']: ' + (e && e.message ? e.message : 'unknown') + (hint ? ' -- ' + hint : '') });
      });
    }

    return ce('div', null,
      // master switch
      ce('div', { className: 'aia-card' + (config.enabled ? ' ok' : ' alert') },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'AI features'),
          Toggle(config.enabled, function (v) { writeCfg('enabled', v); }, 'Enable AI features')
        ),
        ce('p', { className: 'aia-desc' }, config.enabled
          ? 'AI is ON. Students can use the tutor, patient roleplay, SBAR grading, and debriefs within their tier limits.'
          : 'AI is OFF for everyone except you. Students see a friendly "AI is turned off" message instead of an error.')
      ),

      // model choice
      ce('div', { className: 'aia-card' },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'Let users choose their model'),
          Toggle(config.allowModelChoice, function (v) { writeCfg('allowModelChoice', v); }, 'Allow model choice')
        ),
        ce('p', { className: 'aia-desc' }, config.allowModelChoice
          ? 'Users can pick any model their tier allows. Their choice is remembered on their device.'
          : 'Users always get the first model listed for their tier. Turn this on to expose a model picker in Settings.')
      ),

      // test connection
      ce('div', { className: 'aia-card' },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'Test connection'),
          ce('button', {
            type: 'button', className: 'btn btn-primary btn-sm',
            disabled: busy, onClick: runTest
          }, busy ? 'Testing...' : 'Run test')
        ),
        ce('p', { className: 'aia-desc' },
          'Makes one real AI call through /api/ai using your account. This costs a fraction of a cent and proves the whole chain: Firebase token, tier check, Netlify function, Anthropic key.'),
        test && ce('div', { className: 'aia-note ' + (test.ok ? 'ok' : 'err') }, test.msg)
      ),

      // reference
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Where things live'),
        ce('p', { className: 'aia-desc' },
          'Config: ', ce('span', { className: 'aia-code' }, '/appConfig/aiConfig'), ' - ',
          'Tiers: ', ce('span', { className: 'aia-code' }, '/userTiers/<uid>'), ' - ',
          'Usage: ', ce('span', { className: 'aia-code' }, '/aiUsage/<uid>/<date>'), '.'),
        ce('p', { className: 'aia-desc' },
          'The Anthropic key is only in the Netlify environment variable ',
          ce('span', { className: 'aia-code' }, 'ANTHROPIC_API_KEY'),
          '. It is never sent to the browser. Daily limits reset at midnight Eastern.')
      )
    );
  }

  /* ==========================================================================
   * TAB: TIERS
   * ======================================================================== */

  function TiersTab(props) {
    var config = props.config, writeCfg = props.writeCfg;
    var models = catalog();

    function toggleModel(tier, id, on) {
      var cur = modelsOf(config.tiers[tier]).slice();
      var i = cur.indexOf(id);
      if (on && i === -1) cur.push(id);
      if (!on && i !== -1) cur.splice(i, 1);
      writeCfg('tiers/' + tier + '/models', cur);
    }

    function toggleAll(tier, on) {
      writeCfg('tiers/' + tier + '/models', on ? ['*'] : models.map(function (m) { return m.id; }));
    }

    function setNum(tier, field, raw, min) {
      var n = parseInt(raw, 10);
      if (!isFinite(n)) return;
      if (n < min) n = min;
      writeCfg('tiers/' + tier + '/' + field, n);
    }

    return ce('div', null,
      ce('div', { className: 'aia-note info' },
        'Daily limit -1 means unlimited. Max tokens caps how long a single AI reply can be, which is the main cost lever. The server enforces all of this - changing it in the browser cannot be bypassed.'),

      TIER_ORDER.map(function (tier) {
        var t = config.tiers[tier] || { models: [], dailyLimit: 0, maxTokens: 1024 };
        var list = modelsOf(t);
        var all = list.indexOf('*') !== -1;

        return ce('div', { className: 'aia-card', key: tier },
          ce('div', { className: 'aia-tierhead' },
            ce('p', { className: 'aia-h' },
              ce('span', { style: { color: TIER_COLOR[tier] } }, '\u25CF'),
              TIER_LABEL[tier] + ' tier'
            ),
            ce('span', { className: 'aia-badge' },
              (all ? 'all models' : list.length + ' model' + (list.length === 1 ? '' : 's')) + ' \u00B7 ' +
              (t.dailyLimit < 0 ? 'unlimited' : t.dailyLimit + '/day'))
          ),

          ce('label', { className: 'aia-model' + (all ? ' on' : ''), style: { marginBottom: 8 } },
            ce('input', {
              type: 'checkbox', checked: all,
              onChange: function (e) { toggleAll(tier, e.target.checked); }
            }),
            ce('span', null,
              ce('b', null, 'Every model (*)'),
              ce('small', null, 'Automatically includes any model added to the catalog later. Best for the instructor tier.')
            )
          ),

          !all && ce('div', { className: 'aia-models' },
            models.map(function (m) {
              var on = list.indexOf(m.id) !== -1;
              return ce('label', { className: 'aia-model' + (on ? ' on' : ''), key: m.id },
                ce('input', {
                  type: 'checkbox', checked: on,
                  onChange: function (e) { toggleModel(tier, m.id, e.target.checked); }
                }),
                ce('span', null,
                  ce('b', null, m.name),
                  ce('small', null, m.description),
                  ce('small', { style: { opacity: 0.7 } }, m.id)
                )
              );
            })
          ),

          !all && list.length === 0 && ce('div', { className: 'aia-note err' },
            'No models selected - users on this tier cannot use AI at all.'),

          ce('div', { className: 'aia-nums' },
            ce('div', { className: 'aia-field' },
              ce('label', { htmlFor: 'aia-dl-' + tier }, 'Daily message limit'),
              ce('input', {
                id: 'aia-dl-' + tier, className: 'aia-input', type: 'number', min: -1, step: 1,
                defaultValue: t.dailyLimit,
                key: tier + '-dl-' + t.dailyLimit,
                onBlur: function (e) { setNum(tier, 'dailyLimit', e.target.value, -1); },
                onKeyDown: function (e) { if (e.key === 'Enter') e.target.blur(); }
              })
            ),
            ce('div', { className: 'aia-field' },
              ce('label', { htmlFor: 'aia-mt-' + tier }, 'Max tokens per reply'),
              ce('input', {
                id: 'aia-mt-' + tier, className: 'aia-input', type: 'number', min: 64, step: 64,
                defaultValue: t.maxTokens,
                key: tier + '-mt-' + t.maxTokens,
                onBlur: function (e) { setNum(tier, 'maxTokens', e.target.value, 64); },
                onKeyDown: function (e) { if (e.key === 'Enter') e.target.blur(); }
              })
            )
          ),
          ce('p', { className: 'aia-desc' }, 'Click out of a number box to save it.')
        );
      })
    );
  }

  /* ==========================================================================
   * TAB: USERS
   * ======================================================================== */

  function UsersTab(props) {
    var userMeta = props.userMeta || {};
    var userTiers = props.userTiers || {};
    var setUserTier = props.setUserTier;

    var qState = useState('');
    var q = qState[0], setQ = qState[1];
    var openState = useState('');
    var open = openState[0], setOpen = openState[1];
    var expState = useState('');
    var expiry = expState[0], setExpiry = expState[1];

    var rows = useMemo(function () {
      var out = [];
      var uid;
      for (uid in userMeta) {
        if (!Object.prototype.hasOwnProperty.call(userMeta, uid)) continue;
        var m = userMeta[uid] || {};
        out.push({
          uid: uid,
          email: String(m.email || '').toLowerCase(),
          username: m.username || 'Anonymous',
          rec: userTiers[uid] || null,
          tier: normTier(userTiers[uid])
        });
      }
      // Include tier records for users with no /userMeta entry.
      for (uid in userTiers) {
        if (!Object.prototype.hasOwnProperty.call(userTiers, uid)) continue;
        if (userMeta[uid]) continue;
        out.push({ uid: uid, email: '', username: '(no profile)', rec: userTiers[uid], tier: normTier(userTiers[uid]) });
      }
      out.sort(function (a, b) {
        var ai2 = TIER_ORDER.indexOf(a.tier), bi = TIER_ORDER.indexOf(b.tier);
        if (ai2 !== bi) return bi - ai2;
        return a.email < b.email ? -1 : a.email > b.email ? 1 : 0;
      });
      return out;
    }, [userMeta, userTiers]);

    var filtered = useMemo(function () {
      var s = q.trim().toLowerCase();
      if (!s) return rows.filter(function (r) { return r.tier !== 'free'; }).slice(0, 60);
      return rows.filter(function (r) {
        return r.email.indexOf(s) !== -1 ||
               String(r.username).toLowerCase().indexOf(s) !== -1 ||
               r.uid.toLowerCase().indexOf(s) !== -1;
      }).slice(0, 60);
    }, [rows, q]);

    var counts = useMemo(function () {
      var c = { free: 0, plus: 0, pro: 0, instructor: 0 };
      for (var i = 0; i < rows.length; i++) {
        if (c[rows[i].tier] == null) c[rows[i].tier] = 0;
        c[rows[i].tier]++;
      }
      return c;
    }, [rows]);

    function apply(uid, tier) {
      var ms = null;
      if (expiry) {
        var t = Date.parse(expiry + 'T23:59:59');
        if (isFinite(t)) ms = t;
      }
      setUserTier(uid, tier, ms);
    }

    return ce('div', null,
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Who is on what plan'),
        ce('div', { className: 'stats-row', style: { marginTop: 10 } },
          TIER_ORDER.map(function (t) {
            return ce('div', { className: 'stat-box', key: t },
              ce('div', { className: 'stat-value', style: { color: TIER_COLOR[t] } }, String(counts[t] || 0)),
              ce('div', { className: 'stat-label' }, TIER_LABEL[t])
            );
          })
        ),
        ce('p', { className: 'aia-desc' },
          'Free is the default - nobody needs a record to be on Free. ' + rows.length + ' user profiles loaded.')
      ),

      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Grant a tier'),
        ce('input', {
          className: 'aia-input', style: { marginTop: 10 },
          type: 'search', placeholder: 'Search by email, name, or uid...',
          value: q, onChange: function (e) { setQ(e.target.value); },
          'aria-label': 'Search users'
        }),
        ce('div', { className: 'aia-field', style: { marginTop: 10 } },
          ce('label', { htmlFor: 'aia-expiry' }, 'Optional expiry for the next grant (blank = never expires)'),
          ce('input', {
            id: 'aia-expiry', className: 'aia-input', type: 'date',
            value: expiry, onChange: function (e) { setExpiry(e.target.value); }
          })
        ),

        ce('div', { className: 'aia-list', style: { marginTop: 12 } },
          filtered.length === 0 && ce('div', { className: 'aia-empty' },
            q ? 'No user matches "' + q + '".' : 'No paid users yet. Search for an email to grant one.'),

          filtered.map(function (r) {
            var isOpen = open === r.uid;
            return ce('div', { className: 'aia-user', key: r.uid },
              ce('div', { className: 'who' },
                ce('b', null, r.username),
                ce('small', null, r.email || r.uid)
              ),
              ce('span', {
                className: 'aia-badge',
                style: { color: TIER_COLOR[r.tier], borderColor: TIER_COLOR[r.tier] }
              }, TIER_LABEL[r.tier] || r.tier),
              r.rec && r.rec.expiresAt ? ce('small', { style: { color: 'var(--orange)', fontSize: '.72rem' } },
                'expires ' + fmtDate(r.rec.expiresAt)) : null,
              ce('button', {
                type: 'button', className: 'btn btn-outline btn-sm',
                onClick: function () {
                  setOpen(isOpen ? '' : r.uid);
                  if (!isOpen) setExpiry(toDateInput(r.rec ? r.rec.expiresAt : 0));
                }
              }, isOpen ? 'Close' : 'Change'),

              isOpen && ce('div', { style: { flex: '1 1 100%', paddingTop: 8 } },
                ce('div', { className: 'aia-pills' },
                  TIER_ORDER.map(function (t) {
                    return ce('button', {
                      key: t, type: 'button',
                      className: 'aia-pill' + (r.tier === t ? ' on' : ''),
                      onClick: function () { apply(r.uid, t); }
                    }, TIER_LABEL[t]);
                  }),
                  ce('button', {
                    type: 'button', className: 'aia-pill',
                    style: { color: 'var(--red)' },
                    onClick: function () { apply(r.uid, 'free'); setExpiry(''); }
                  }, 'Reset to Free')
                ),
                r.rec && r.rec.grantedBy ? ce('p', { className: 'aia-desc' },
                  'Granted by ' + r.rec.grantedBy + (r.rec.grantedAt ? ' on ' + fmtDate(r.rec.grantedAt) : '')) : null
              )
            );
          })
        )
      )
    );
  }

  /* ==========================================================================
   * TAB: USAGE
   * ======================================================================== */

  function UsageTab(props) {
    var usage = props.usage || {};
    var userMeta = props.userMeta || {};
    var userTiers = props.userTiers || {};
    var loaded = props.loaded, reload = props.reload;

    var today = todayKey();

    var stats = useMemo(function () {
      var byTier = { free: 0, plus: 0, pro: 0, instructor: 0 };
      var users = [];
      var totalToday = 0, totalAll = 0, activeToday = 0;
      var uid, days, d, n, mine;

      for (uid in usage) {
        if (!Object.prototype.hasOwnProperty.call(usage, uid)) continue;
        days = usage[uid];
        if (!days || typeof days !== 'object') continue;
        mine = 0;
        for (d in days) {
          if (!Object.prototype.hasOwnProperty.call(days, d)) continue;
          n = typeof days[d] === 'number' ? days[d] : 0;
          totalAll += n;
          if (d === today) mine += n;
        }
        totalToday += mine;
        if (mine > 0) activeToday++;
        var tier = normTier(userTiers[uid]);
        if (byTier[tier] == null) byTier[tier] = 0;
        byTier[tier] += mine;
        var m = userMeta[uid] || {};
        users.push({
          uid: uid, today: mine, tier: tier,
          name: m.username || '(unknown)', email: m.email || uid
        });
      }
      users.sort(function (a, b) { return b.today - a.today; });
      return {
        byTier: byTier, users: users.slice(0, 25),
        totalToday: totalToday, totalAll: totalAll, activeToday: activeToday
      };
    }, [usage, userMeta, userTiers, today]);

    var maxUser = stats.users.length ? Math.max(1, stats.users[0].today) : 1;

    return ce('div', null,
      ce('div', { className: 'aia-card' },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'Usage - ' + today),
          ce('button', { type: 'button', className: 'btn btn-outline btn-sm', onClick: reload },
            loaded ? 'Refresh' : 'Loading...')
        ),
        ce('div', { className: 'stats-row', style: { marginTop: 10 } },
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, String(stats.totalToday)),
            ce('div', { className: 'stat-label' }, 'Calls today')
          ),
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, String(stats.activeToday)),
            ce('div', { className: 'stat-label' }, 'Active users')
          ),
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, String(stats.totalAll)),
            ce('div', { className: 'stat-label' }, 'Calls all time')
          )
        ),
        ce('p', { className: 'aia-desc' },
          'Instructor-tier accounts (including yours) are unlimited and are not metered, so they may show 0.')
      ),

      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Today by tier'),
        TIER_ORDER.map(function (t) {
          var v = stats.byTier[t] || 0;
          var pct = stats.totalToday > 0 ? Math.round((v / stats.totalToday) * 100) : 0;
          return ce('div', { key: t, style: { marginTop: 10 } },
            ce('div', { className: 'aia-row', style: { fontSize: '.85rem' } },
              ce('span', { style: { color: TIER_COLOR[t], fontWeight: 600 } }, TIER_LABEL[t]),
              ce('span', { style: { color: 'var(--text3)' } }, v + ' call' + (v === 1 ? '' : 's') + ' (' + pct + '%)')
            ),
            ce('div', { className: 'aia-bar' },
              ce('i', { style: { width: pct + '%', background: TIER_COLOR[t] } }))
          );
        })
      ),

      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Top users today'),
        !loaded && ce('div', { className: 'aia-empty' }, 'Loading usage...'),
        loaded && stats.users.length === 0 && ce('div', { className: 'aia-empty' }, 'No AI usage recorded yet.'),
        ce('div', { className: 'aia-list' },
          stats.users.filter(function (u) { return u.today > 0; }).map(function (u) {
            return ce('div', { className: 'aia-user', key: u.uid },
              ce('div', { className: 'who' },
                ce('b', null, u.name),
                ce('small', null, u.email)
              ),
              ce('span', { className: 'aia-badge', style: { color: TIER_COLOR[u.tier] } }, TIER_LABEL[u.tier] || u.tier),
              ce('span', { style: { fontWeight: 700, minWidth: 34, textAlign: 'right' } }, String(u.today)),
              ce('div', { style: { flex: '1 1 100%' } },
                ce('div', { className: 'aia-bar' },
                  ce('i', { style: { width: Math.round((u.today / maxUser) * 100) + '%' } })))
            );
          })
        )
      )
    );
  }

  window.AIAdminPanel = AIAdminPanel;
})();
