/* ============================================================================
 * MedMaster - js/ai-admin.js
 * window.AIAdminPanel : owner-only control room for the AI layer.
 *
 * Tabs: Spend | Settings | Models | Routing | Tiers | People
 *   - SPEND (default): real dollars from /aiSpend/<date> - today's total against
 *     an editable daily ceiling, per feature, per model, per person, plus the
 *     call counts that free models produce. The ceiling is enforceable: switch it
 *     to "Stop AI for the day" and the Netlify function refuses calls over it.
 *   - master AI on/off switch and "let users pick their model"
 *   - LIVE OpenRouter model picker: loads the real catalog through the Netlify
 *     function (owner-only action, auto-loaded once when the panel opens), shows
 *     price + context length, assigns models to tiers by clicking, and flags any
 *     configured slug that does not exist OR has not been checked
 *   - ROUTING: a feature x tier matrix of which model answers which part of the
 *     app, showing the model that will ACTUALLY be used (not just the one that
 *     was configured) with its real price, plus the daily image caps and the
 *     pre-generate tool for the two fixed image sets
 *   - IMAGE CACHE (on Spend): how many pictures are in the shared cache, how
 *     much they weigh, and how much money the cache has avoided spending
 *   - per-tier editor (allowed models, daily limit, max tokens)
 *   - user tier manager (search by email, grant a tier, optional expiry)
 *   - ban read-back with an unban action for both ban systems
 *   - Test connection: makes one real AI call and reports success or the code
 *
 * Writes to /appConfig/aiConfig and /userTiers/<uid>; removes from /bannedUsers
 * and /community/banned. Reads /aiUsage and /aiSpend.
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
  // Tier gets its own ramp. It used to borrow --text3 / --green, which made Free
  // read as "disabled" in one view and "success" in another, in this same file.
  var TIER_COLOR = {
    free: 'var(--tier-free,#94a3b8)',
    plus: 'var(--tier-plus,#60a5fa)',
    pro: 'var(--tier-pro,#a78bfa)',
    instructor: 'var(--tier-inst,#2dd4bf)'
  };
  var SPEND_PATH = 'aiSpend';
  var DEFAULT_SOFT_CAP_USD = 2;

  // Pasted verbatim into the Firebase rules editor when the ledger is unreadable.
  var SPEND_RULES_SNIPPET = [
    '"aiSpend": {',
    '  ".read":  "auth != null && auth.token.email === \'codingky@gmail.com\'",',
    '  "$day":   { ".write": "auth != null" }',
    '}'
  ].join('\n');

  /* ---------------------------------------------------------- image routing --
   * The three features that produce a PICTURE rather than text. Pointing one of
   * them at a text-only model is the single most likely routing mistake, and it
   * fails at the worst possible moment - in front of a student - so it is
   * flagged here instead.
   * ------------------------------------------------------------------------ */
  var IMAGE_FEATURES = ['image', 'mnemonic', 'avatar'];

  // Every feature id the server will route (mirror of KNOWN_FEATURES in js/ai.js).
  // Only used if MM.ai is somehow absent; the live list always wins.
  var FEATURES_FALLBACK = [
    'tutor', 'sim', 'patient', 'medadmin', 'community', 'questions', 'debrief', 'sbar', 'admin',
    'image', 'codeblue', 'mnemonic', 'avatar', 'other'
  ];

  // Friendly names for the routable ids that have no entry in MM.ai.AI_FEATURES
  // (that list is the STUDENT-facing plan matrix; these are internal call sites).
  var FEATURE_LABEL_EXTRA = {
    sim: 'Written simulation helper',
    medadmin: 'Med-admin trainer',
    community: 'Community tools',
    admin: 'Admin panel and connection test',
    other: 'Anything not tagged'
  };

  // Fallback for the image cache rules, used only if js/images.js did not load.
  var IMAGE_CACHE_RULES_FALLBACK = [
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

  /* ------------------------------------------------------------------ styles */

  if (!document.getElementById('ai-admin-styles')) {
    var st = document.createElement('style');
    st.id = 'ai-admin-styles';
    st.textContent = [
      '.aia-wrap{max-width:960px;margin:0 auto}',
      '.aia-tabs{display:flex;gap:var(--sp-2,6px);flex-wrap:wrap;margin-bottom:var(--sp-4,16px)}',
      '.aia-tab{flex:1 1 auto;min-width:88px;min-height:44px;padding:var(--sp-2,8px) var(--sp-3,12px);',
      'border-radius:var(--r-md,10px);border:1px solid var(--border,var(--surface2));',
      'background:var(--surface);color:var(--text2);font-size:var(--fs-base,14px);font-weight:600;cursor:pointer;',
      'transition:color var(--dur-micro,.12s) ease,border-color var(--dur-micro,.12s) ease,background var(--dur-micro,.12s) ease}',
      '.aia-tab:hover{color:var(--text);border-color:var(--accent)}',
      '.aia-tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.aia-tab:active{transform:scale(.975);transition:transform var(--dur-press,.08s) ease}',
      '.aia-tab.on{background:var(--accent);border-color:var(--accent);color:#fff}',
      '.aia-card{background:var(--surface);border:1px solid var(--border,var(--surface2));',
      'border-radius:var(--r-lg,14px);padding:var(--sp-4,16px);margin-bottom:var(--sp-3,14px)}',
      '.aia-card.alert{border-color:var(--red)}',
      '.aia-card.ok{border-color:var(--green)}',
      '.aia-card.warn{border-color:var(--orange)}',
      '.aia-row{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3,12px);flex-wrap:wrap}',
      '.aia-h{font-weight:700;font-size:var(--fs-md,16px);display:flex;align-items:center;gap:var(--sp-2,8px);margin:0}',
      '.aia-desc{color:var(--text3);font-size:var(--fs-base,14px);line-height:var(--lh-normal,1.5);margin:6px 0 0}',
      '.aia-toggle{width:48px;height:28px;border-radius:var(--r-full,999px);border:none;cursor:pointer;position:relative;',
      'flex:0 0 auto;background:var(--surface3,var(--surface2));transition:background var(--dur-state,.2s) ease}',
      '.aia-toggle.on{background:var(--green)}',
      '.aia-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.aia-toggle span{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:var(--r-full,999px);',
      'background:var(--text-on-fill,#fff);transition:left var(--dur-state,.2s) ease;box-shadow:var(--el-1,0 1px 3px rgba(0,0,0,.3))}',
      '.aia-toggle.on span{left:23px}',
      '.aia-tierhead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}',
      '.aia-badge{font-size:var(--fs-xs,12px);font-weight:700;text-transform:uppercase;letter-spacing:.04em;',
      'padding:3px 9px;border-radius:var(--r-full,999px);background:var(--surface3,var(--surface2));color:var(--text2)}',
      '.aia-models{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--sp-2,8px);margin:10px 0}',
      '.aia-model{display:flex;gap:9px;align-items:flex-start;padding:var(--sp-3,10px);border-radius:var(--r-md,10px);',
      'cursor:pointer;min-height:44px;box-sizing:border-box;',
      'border:1px solid var(--border,var(--surface2));background:var(--bg);transition:border-color var(--dur-micro,.12s) ease}',
      '.aia-model:hover{border-color:var(--accent)}',
      '.aia-model:active{transform:scale(.99);transition:transform var(--dur-press,.08s) ease}',
      '.aia-model.on{border-color:var(--accent);background:var(--tint-accent,rgba(59,130,246,.10))}',
      '.aia-model.unverified{border-color:var(--border-str,#475569);border-style:dashed}',
      '.aia-model.bad{border-color:var(--red)}',
      '.aia-model input{margin-top:3px;flex:0 0 auto;accent-color:var(--accent);width:18px;height:18px}',
      '.aia-model b{display:block;font-size:var(--fs-base,14px);color:var(--text)}',
      '.aia-model small{display:block;color:var(--text3);font-size:var(--fs-xs,12px);',
      'line-height:var(--lh-normal,1.5);margin-top:2px;overflow-wrap:anywhere}',
      '.aia-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:6px}',
      '.aia-field label{display:block;font-size:var(--fs-xs,12px);color:var(--text3);margin-bottom:4px;font-weight:600}',
      '.aia-input{width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--border,var(--surface2));',
      'color:var(--text);border-radius:var(--r-sm,8px);padding:10px 12px;min-height:44px;',
      'font-size:var(--fs-base,14px);font-family:inherit}',
      '.aia-input:focus{outline:none;border-color:var(--accent);box-shadow:var(--ring,0 0 0 2px rgba(59,130,246,.25))}',
      '.aia-list{max-height:340px;overflow-y:auto;-webkit-overflow-scrolling:touch}',
      '.aia-list:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.aia-user{display:flex;align-items:center;gap:10px;padding:9px 4px;',
      'border-bottom:1px solid var(--border,var(--surface2));flex-wrap:wrap}',
      '.aia-user:last-child{border-bottom:none}',
      '.aia-user .who{flex:1 1 180px;min-width:0}',
      '.aia-user .who b{display:block;font-size:var(--fs-base,14px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.aia-user .who small{color:var(--text3);font-size:var(--fs-xs,12px);overflow:hidden;text-overflow:ellipsis;',
      'white-space:nowrap;display:block}',
      '.aia-pills{display:flex;gap:var(--sp-1,4px);flex-wrap:wrap}',
      '.aia-pill{font-size:var(--fs-sm,13px);font-weight:600;padding:0 12px;min-height:44px;',
      'border-radius:var(--r-full,999px);cursor:pointer;border:1px solid var(--border,var(--surface2));',
      'background:var(--bg);color:var(--text2);',
      'transition:color var(--dur-micro,.12s) ease,border-color var(--dur-micro,.12s) ease}',
      '.aia-pill:hover{border-color:var(--accent);color:var(--text)}',
      '.aia-pill:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.aia-pill:active{transform:scale(.975);transition:transform var(--dur-press,.08s) ease}',
      '.aia-pill.on{background:var(--accent);border-color:var(--accent);color:#fff}',
      '.aia-bar{height:8px;border-radius:var(--r-full,999px);background:var(--surface3,var(--surface2));',
      'overflow:hidden;margin-top:5px}',
      '.aia-bar i{display:block;height:100%;background:var(--accent);border-radius:var(--r-full,999px);',
      'transition:width var(--dur-data,.48s) linear}',
      '.aia-bar.tall{height:14px}',
      '.aia-note{font-size:var(--fs-base,14px);padding:10px 12px;border-radius:var(--r-sm,8px);',
      'line-height:var(--lh-normal,1.5);margin-top:10px;overflow-wrap:anywhere}',
      '.aia-note.ok{background:var(--tint-green,rgba(34,197,94,.12));color:var(--green-fg,var(--green))}',
      '.aia-note.err{background:var(--tint-red,rgba(239,68,68,.12));color:var(--red-fg,var(--red))}',
      '.aia-note.warn{background:var(--tint-orange,rgba(245,158,11,.12));color:var(--orange-fg,var(--orange))}',
      '.aia-note.info{background:var(--tint-accent,rgba(59,130,246,.12));color:var(--accent-fg,var(--accent))}',
      '.aia-empty{text-align:center;color:var(--text3);padding:22px 10px;font-size:var(--fs-base,14px)}',
      '.aia-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--fs-xs,12px);',
      'background:var(--bg);border:1px solid var(--border,var(--surface2));border-radius:var(--r-sm,6px);',
      'padding:2px 6px;color:var(--text2)}',
      '.aia-pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--fs-xs,12px);',
      'background:var(--bg);border:1px solid var(--border,var(--surface2));border-radius:var(--r-sm,6px);',
      'padding:10px 12px;color:var(--text2);white-space:pre;overflow-x:auto;margin-top:10px;line-height:1.5}',
      // --- live OpenRouter catalog ---
      '.aia-mrow{padding:10px 4px;border-bottom:1px solid var(--border,var(--surface2))}',
      '.aia-mrow:last-child{border-bottom:none}',
      '.aia-mtop{display:flex;align-items:baseline;gap:var(--sp-2,8px);flex-wrap:wrap}',
      '.aia-mtop b{font-size:var(--fs-base,14px)}',
      '.aia-mid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--fs-xs,12px);',
      'color:var(--text3);word-break:break-all}',
      '.aia-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}',
      '.aia-chip{font-size:var(--fs-xs,12px);padding:2px 8px;border-radius:var(--r-full,999px);',
      'background:var(--surface3,var(--surface2));color:var(--text2)}',
      '.aia-chip.free{background:var(--tint-green,rgba(34,197,94,.16));color:var(--green-fg,var(--green))}',
      '.aia-chip.warn{background:var(--tint-red,rgba(239,68,68,.14));color:var(--red-fg,var(--red))}',
      '.aia-chip.unknown{background:transparent;color:var(--text3);border:1px dashed var(--border-str,#475569)}',
      '.aia-chip.verified{background:var(--tint-accent,rgba(59,130,246,.12));color:var(--accent-fg,var(--accent))}',
      '.aia-filters{display:flex;gap:var(--sp-2,8px);flex-wrap:wrap;align-items:center;margin-top:10px}',
      '.aia-filters .aia-input{flex:1 1 200px}',
      '.aia-check{display:flex;align-items:center;gap:6px;font-size:var(--fs-base,14px);color:var(--text2);',
      'cursor:pointer;white-space:nowrap;min-height:44px}',
      '.aia-check input{accent-color:var(--accent);width:18px;height:18px}',
      // --- spend ---
      '.aia-money{font-size:var(--fs-3xl,40px);font-weight:800;line-height:var(--lh-tight,1.2);color:var(--text)}',
      '.aia-money.over{color:var(--red-fg,var(--red))}',
      '.aia-money.near{color:var(--orange-fg,var(--orange))}',
      '.aia-srow{display:flex;align-items:center;gap:var(--sp-2,8px);margin-top:10px;flex-wrap:wrap}',
      '.aia-srow .lbl{flex:1 1 140px;min-width:0;font-size:var(--fs-sm,13px);color:var(--text2);overflow-wrap:anywhere}',
      '.aia-srow .amt{font-weight:700;font-size:var(--fs-sm,13px);min-width:72px;text-align:right}',
      '.aia-srow .bar{flex:1 1 100%}',
      /* --- routing matrix -----------------------------------------------
       * Never a horizontally scrolling table. On a wide screen the four tier
       * cells sit side by side and read as a matrix row; at 360px the same
       * markup stacks into a per-feature card. Same DOM, no duplicate render.
       * ------------------------------------------------------------------ */
      '.aia-mx{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--sp-2,8px);margin-top:10px}',
      '.aia-mxhead{display:none}',
      '.aia-cell{border:1px solid var(--border,var(--surface2));border-radius:var(--r-md,10px);',
      'background:var(--bg);padding:var(--sp-2,9px);min-width:0}',
      '.aia-cell.flag{border-color:var(--red)}',
      '.aia-cell.warn{border-color:var(--orange)}',
      '.aia-cell .tier{font-size:var(--fs-xs,12px);font-weight:700;text-transform:uppercase;',
      'letter-spacing:.04em;margin-bottom:5px}',
      '.aia-select{width:100%;box-sizing:border-box;background:var(--surface);color:var(--text);',
      'border:1px solid var(--border,var(--surface2));border-radius:var(--r-sm,8px);',
      'padding:9px 8px;min-height:44px;font-size:var(--fs-sm,13px);font-family:inherit}',
      '.aia-select:focus{outline:none;border-color:var(--accent);box-shadow:var(--ring,0 0 0 2px rgba(59,130,246,.25))}',
      '.aia-eff{margin-top:6px;font-size:var(--fs-xs,12px);color:var(--text2);overflow-wrap:anywhere;line-height:1.45}',
      '.aia-eff b{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--text);font-weight:600}',
      '.aia-eff .price{color:var(--text3)}',
      '.aia-cellwarn{margin-top:6px;font-size:var(--fs-xs,12px);line-height:1.45;overflow-wrap:anywhere}',
      '.aia-cellwarn.bad{color:var(--red-fg,var(--red))}',
      '.aia-cellwarn.soft{color:var(--orange-fg,var(--orange))}',
      '.aia-featname{font-weight:700;font-size:var(--fs-base,14px);color:var(--text)}',
      '.aia-featid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--fs-xs,12px);color:var(--text3)}',
      '.aia-run{display:flex;gap:var(--sp-2,8px);flex-wrap:wrap;align-items:center;margin-top:10px}',
      '.aia-errlist{max-height:180px;overflow-y:auto;margin-top:8px}',
      '.aia-errlist div{font-size:var(--fs-xs,12px);color:var(--red-fg,var(--red));',
      'padding:3px 0;border-bottom:1px solid var(--border,var(--surface2));overflow-wrap:anywhere}',
      '.aia-runbar{height:10px;border-radius:var(--r-full,999px);background:var(--surface3,var(--surface2));',
      'overflow:hidden;margin-top:8px}',
      '.aia-runbar i{display:block;height:100%;background:var(--accent);border-radius:var(--r-full,999px);',
      'transition:width var(--dur-data,.3s) linear}',
      '.aia-featrow{border-top:1px solid var(--border,var(--surface2));padding-top:14px;margin-top:14px}',
      '.aia-featrow.first{border-top:none;padding-top:0;margin-top:0}',
      '@media (max-width:860px){.aia-mx{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media (max-width:640px){',
      '.aia-mx{grid-template-columns:1fr}',
      '.aia-select{font-size:16px}',
      '}',
      '@media (max-width:640px){',
      '.aia-card{padding:13px}',
      '.aia-models{grid-template-columns:1fr}',
      '.aia-tab{min-width:0;flex:1 1 44%;font-size:var(--fs-sm,13px);padding:8px 6px;min-height:44px}',
      '.aia-user .who{flex:1 1 100%}',
      '.aia-h{font-size:var(--fs-base,15px)}',
      // 16px minimum stops iOS Safari zooming the whole panel on focus
      '.aia-input{font-size:16px}',
      '.aia-money{font-size:var(--fs-2xl,28px)}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '.aia-tab,.aia-pill,.aia-model,.aia-toggle,.aia-toggle span,.aia-bar i{transition:none}',
      '.aia-tab:active,.aia-pill:active,.aia-model:active{transform:none}',
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

  function images() { return (window.MM && window.MM.images) ? window.MM.images : window.MM_IMAGES; }

  function imageCacheRules() {
    var im = images();
    if (im && typeof im.RULES_SNIPPET === 'string' && im.RULES_SNIPPET) return im.RULES_SNIPPET;
    return IMAGE_CACHE_RULES_FALLBACK;
  }

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

  function verifiedIds() {
    var a = ai();
    return (a && Array.isArray(a.VERIFIED_MODEL_IDS)) ? a.VERIFIED_MODEL_IDS : [];
  }

  function freeHint() {
    var a = ai();
    if (a && typeof a.getFreeModelHint === 'function') { try { return a.getFreeModelHint(); } catch (e) { /* noop */ } }
    if (a && typeof a.FREE_MODEL_HINT === 'string') return a.FREE_MODEL_HINT;
    return 'No free models are assigned yet. Load the OpenRouter catalog and pick a couple of free ones.';
  }

  function endpoint() {
    if (window.MM_AI_ENDPOINT) return window.MM_AI_ENDPOINT;
    var a = ai();
    if (a && typeof a.ENDPOINT === 'string' && a.ENDPOINT) return a.ENDPOINT;
    return '/api/ai';
  }

  // OpenRouter quotes prices per token as strings ("0.0000004"). Humans think
  // in dollars per million tokens, so convert.
  function fmtPrice(raw) {
    if (raw === '' || raw == null) return 'n/a';
    var n = parseFloat(raw);
    if (!isFinite(n)) return 'n/a';
    if (n === 0) return 'free';
    var perM = n * 1000000;
    if (perM >= 100) return '$' + perM.toFixed(0) + '/M';
    if (perM >= 1) return '$' + perM.toFixed(2) + '/M';
    return '$' + perM.toFixed(3) + '/M';
  }

  function fmtContext(n) {
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) return 'ctx n/a';
    if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M ctx';
    if (n >= 1000) return Math.round(n / 1000) + 'K ctx';
    return n + ' ctx';
  }

  /* ------------------------------------------------------------- modality ----
   * OpenRouter's ?output_modalities= filter is the ONLY honest answer to "can
   * this model produce a picture". A slug heuristic ("does it contain the word
   * image") is a naming convention, not a capability, and it is wrong in both
   * directions. Everything below treats the loaded image / video catalog as the
   * truth and says so plainly when that catalog has not been loaded yet.
   * ------------------------------------------------------------------------ */

  var MODALITIES = [
    { id: 'text',  label: 'Text',  unit: 'token' },
    { id: 'image', label: 'Image', unit: 'image' },
    { id: 'video', label: 'Video', unit: 'video' }
  ];

  function emptyCatalog() {
    return { status: 'idle', models: [], error: '', fetchedAt: 0, cached: false };
  }

  function normModality(v) {
    return (v === 'image' || v === 'video') ? v : 'text';
  }

  function modalityUnit(modality) {
    return normModality(modality) === 'video' ? 'video' : 'image';
  }

  /**
   * The per-image (or per-video) price, in dollars, or null when the catalog did
   * not report one. OpenRouter puts it in `pricing.image`; whatever shape of that
   * reaches us is accepted, and its ABSENCE is reported as absence rather than
   * quietly rendered as a token price wearing the wrong label.
   */
  function unitPriceOf(m) {
    if (!m || typeof m !== 'object') return null;
    var raw = null;
    if (m.imagePrice !== undefined && m.imagePrice !== null && m.imagePrice !== '') raw = m.imagePrice;
    else if (m.unitPrice !== undefined && m.unitPrice !== null && m.unitPrice !== '') raw = m.unitPrice;
    else if (m.pricing && typeof m.pricing === 'object') {
      if (m.pricing.image !== undefined && m.pricing.image !== null && m.pricing.image !== '') raw = m.pricing.image;
      else if (m.pricing.video !== undefined && m.pricing.video !== null && m.pricing.video !== '') raw = m.pricing.video;
    }
    if (raw === null) return null;
    var n = parseFloat(raw);
    if (!isFinite(n) || n < 0) return null;
    return n;
  }

  // A per-image price is a whole dollar amount already - it must never be
  // multiplied by a million the way a per-token price is.
  function fmtPerUnit(n, unit) {
    if (typeof n !== 'number' || !isFinite(n)) return '';
    if (n === 0) return 'free per ' + unit;
    if (n < 0.001) return '$' + n.toFixed(5) + ' per ' + unit;
    if (n < 1) return '$' + n.toFixed(4) + ' per ' + unit;
    return '$' + n.toFixed(2) + ' per ' + unit;
  }

  /**
   * One short price string for inline display next to a routed model.
   * Text: "in $0.40/M, out $1.20/M" (per million TOKENS).
   * Image/video: "$0.03 per image" when the catalog reported it, otherwise an
   * explicit "per-image price not listed" - never a token price mislabelled.
   */
  function priceSummary(m, modality) {
    if (!m) return '';
    var mod = normModality(modality);
    if (mod === 'text') {
      return 'in ' + fmtPrice(m.promptPrice) + ', out ' + fmtPrice(m.completionPrice) + ' per 1M tokens';
    }
    var unit = modalityUnit(mod);
    var per = unitPriceOf(m);
    if (per !== null) return fmtPerUnit(per, unit);
    return 'per-' + unit + ' price not listed by OpenRouter (token rates: in ' +
      fmtPrice(m.promptPrice) + ', out ' + fmtPrice(m.completionPrice) + ' per 1M tokens)';
  }

  /* --------------------------------------------------------------- money ----
   * The ledger stores INTEGER microdollars ($0.000123 -> 123) because RTDB's
   * atomic increment is exact for integers and lossy for floats. Everything
   * below converts on the way out; nothing rounds on the way in.
   * ------------------------------------------------------------------------ */

  function micro2usd(m) {
    var n = typeof m === 'number' && isFinite(m) ? m : 0;
    return n / 1e6;
  }

  // Sub-cent numbers are the norm here, so $0.00 would hide almost everything.
  function fmtUsd(v) {
    var n = typeof v === 'number' && isFinite(v) ? v : 0;
    if (n === 0) return '$0.00';
    if (n < 0.01) return '$' + n.toFixed(4);
    if (n < 1) return '$' + n.toFixed(3);
    return '$' + n.toFixed(2);
  }

  function num6(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }

  // '2026-08-11' -> '2026-08'
  function monthOf(day) { return String(day || '').slice(0, 7); }

  // Hours elapsed in the quota day (Eastern), floored at 1 so the pace estimate
  // cannot divide by zero right after midnight.
  function hoursElapsed() {
    try {
      var s = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: false
      }).format(new Date());
      var parts = String(s).split(':');
      var h = parseInt(parts[0], 10);
      var mi = parseInt(parts[1], 10);
      if (!isFinite(h)) return 1;
      return Math.max(1, h + (isFinite(mi) ? mi / 60 : 0));
    } catch (e) { return 12; }
  }

  // Every model id configured across every tier, minus the '*' wildcard.
  function configuredIds(config) {
    var seen = {}, out = [], i, j, list;
    for (i = 0; i < TIER_ORDER.length; i++) {
      list = modelsOf(config.tiers[TIER_ORDER[i]]);
      for (j = 0; j < list.length; j++) {
        if (list[j] === '*' || seen[list[j]]) continue;
        seen[list[j]] = true;
        out.push(list[j]);
      }
    }
    return out;
  }

  function fmtBytes(n) {
    var v = typeof n === 'number' && isFinite(n) ? n : 0;
    if (v <= 0) return '0 B';
    if (v < 1024) return v + ' B';
    if (v < 1024 * 1024) return (v / 1024).toFixed(0) + ' KB';
    return (v / (1024 * 1024)).toFixed(v < 10 * 1024 * 1024 ? 1 : 0) + ' MB';
  }

  /* ------------------------------------------------------------- routing ----
   * The three functions below answer, for the admin UI only, "which model will
   * this feature actually run on for this tier". The server is the only thing
   * that decides it for real; MM.ai.resolveModelWith is the shared pure copy of
   * that order, so it is preferred whenever js/ai.js is loaded.
   * ------------------------------------------------------------------------ */

  function knownFeatures() {
    var a = ai();
    if (a && Array.isArray(a.KNOWN_FEATURES) && a.KNOWN_FEATURES.length) return a.KNOWN_FEATURES;
    return FEATURES_FALLBACK;
  }

  /** [{id, label, desc}] in KNOWN_FEATURES order, with the student-facing labels. */
  function featureRows() {
    var a = ai();
    var byId = {};
    var list = (a && Array.isArray(a.AI_FEATURES)) ? a.AI_FEATURES : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id) byId[list[i].id] = list[i];
    }
    return knownFeatures().map(function (id) {
      var f = byId[id];
      return {
        id: id,
        label: (f && f.label) ? f.label : (FEATURE_LABEL_EXTRA[id] || (id.charAt(0).toUpperCase() + id.slice(1))),
        desc: (f && f.desc) ? f.desc : ''
      };
    });
  }

  function featureModelsOf(tierCfg) {
    if (!tierCfg) return {};
    var fm = tierCfg.featureModels;
    if (!fm || typeof fm !== 'object' || Array.isArray(fm)) return {};
    return fm;
  }

  /**
   * -> { model, source, ignored }
   *   source  'featureModels' | 'tierDefault' | 'default'
   *   ignored a configured slug the tier does not allow, which the SERVER DROPS
   *           silently. Surfacing it is the whole reason this preview exists.
   */
  function previewRoute(config, tier, feature) {
    var t = config.tiers[tier] || {};
    var rules = { models: modelsOf(t), featureModels: featureModelsOf(t) };
    var a = ai();
    if (a && typeof a.resolveModelWith === 'function') {
      try {
        return a.resolveModelWith(rules, feature, { isOwner: false, allowModelChoice: false });
      } catch (e) { /* fall through to the local copy */ }
    }
    // Local mirror of the same order, for the case where js/ai.js is missing.
    var fallback = (a && a.DEFAULT_MODEL) ? a.DEFAULT_MODEL : '';
    var out = { model: fallback, source: 'default', ignored: '' };
    var wildcard = rules.models.indexOf('*') !== -1;
    var pick = typeof rules.featureModels[feature] === 'string' ? rules.featureModels[feature].trim() : '';
    if (pick) {
      if (wildcard || rules.models.indexOf(pick) !== -1) return { model: pick, source: 'featureModels', ignored: '' };
      out.ignored = pick;
    }
    if (rules.models.length && rules.models[0] && rules.models[0] !== '*') {
      out.model = rules.models[0];
      out.source = 'tierDefault';
    }
    return out;
  }

  // Heuristic, and only ever worded as one: OpenRouter's image models all carry
  // "image" in the slug today (google/gemini-3.1-flash-image), but that is a
  // naming convention, not a guarantee, and the server detects the real answer
  // from the RESPONSE. So this warns; it never blocks.
  function looksLikeImageModel(slug) {
    return String(slug == null ? '' : slug).toLowerCase().indexOf('image') !== -1;
  }

  /** The catalog record for a slug, or null. */
  function findModel(cat, id) {
    if (!cat || !Array.isArray(cat.models) || !id) return null;
    for (var i = 0; i < cat.models.length; i++) {
      if (cat.models[i] && cat.models[i].id === id) return cat.models[i];
    }
    return null;
  }

  /**
   * THE real capability answer, from OpenRouter's own output_modalities filter:
   *   'ok'        - it is in the image catalog, so it can produce a picture
   *   'text-only' - the image catalog IS loaded and this slug is not in it
   *   'unknown'   - the image catalog has not been loaded, so we do not know
   *
   * The third state exists on purpose. looksLikeImageModel() above is only ever
   * consulted while we are in it, and only ever worded as the guess it is.
   */
  function imageCapability(imageCat, slug) {
    if (!slug) return 'unknown';
    if (!imageCat || imageCat.status !== 'loaded' || !imageCat.models.length) return 'unknown';
    return findModel(imageCat, slug) ? 'ok' : 'text-only';
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

    // status: 'idle' | 'loading' | 'loaded' | 'denied'
    var spendState = useState({ status: 'idle', days: {}, error: '' });
    var spend = spendState[0], setSpend = spendState[1];

    var bansState = useState({ status: 'idle', site: {}, community: {} });
    var bans = bansState[0], setBans = bansState[1];

    var errState = useState('');
    var loadError = errState[0], setLoadError = errState[1];

    /* Live OpenRouter catalogs, ONE PER OUTPUT MODALITY. The server asks
     * openrouter.ai/api/v1/models?output_modalities=<m> and caches each answer
     * for ten minutes, so these are authoritative capability data - which is why
     * the routing checks below never guess from a slug. Each modality is loaded
     * lazily and cached separately here too, so switching back and forth is free.
     * status: 'idle' | 'loading' | 'loaded' | 'error' */
    var catState = useState({ text: emptyCatalog(), image: emptyCatalog(), video: emptyCatalog() });
    var catalogs = catState[0], setCatalogs = catState[1];
    var live = catalogs.text;

    var mounted = useRef(true);
    useEffect(function () { return function () { mounted.current = false; }; }, []);

    /* ---- load one modality's catalog through the owner-only action ---- */
    var loadCatalog = useCallback(function (modalityRaw) {
      var modality = normModality(modalityRaw);

      function put(patch) {
        setCatalogs(function (prev) {
          var next = { text: prev.text, image: prev.image, video: prev.video };
          var cur = next[modality] || emptyCatalog();
          next[modality] = {
            status: patch.status,
            models: patch.models !== undefined ? patch.models : cur.models,
            error: patch.error !== undefined ? patch.error : '',
            fetchedAt: patch.fetchedAt !== undefined ? patch.fetchedAt : cur.fetchedAt,
            cached: patch.cached !== undefined ? patch.cached : cur.cached
          };
          return next;
        });
      }

      var user = mm().authUser;
      if (!user || typeof user.getIdToken !== 'function') {
        put({ status: 'error', models: [], fetchedAt: 0, cached: false,
          error: 'You are not signed in, so the server cannot verify you are the owner.' });
        return;
      }
      put({ status: 'loading', error: '' });
      Promise.resolve().then(function () {
        return user.getIdToken();
      }).then(function (tok) {
        return fetch(endpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'listModels', idToken: tok, modality: modality })
        });
      }).then(function (res) {
        return res.text().then(function (t) {
          var data = null;
          try { data = JSON.parse(t); } catch (e) { data = null; }
          if (!res.ok) {
            throw new Error((data && data.message) ? data.message : ('OpenRouter request failed (' + res.status + ').'));
          }
          return data;
        });
      }).then(function (data) {
        if (!mounted.current) return;
        var list = (data && Array.isArray(data.models)) ? data.models : [];
        put({
          status: 'loaded', models: list, error: '',
          fetchedAt: (data && typeof data.fetchedAt === 'number') ? data.fetchedAt : Date.now(),
          cached: !!(data && data.cached)
        });
      }).catch(function (e) {
        if (!mounted.current) return;
        put({
          status: 'error', models: [], fetchedAt: 0, cached: false,
          error: (e && e.message) ? e.message : 'Could not load the OpenRouter model list.'
        });
      });
    }, []);

    // Kept as its own identity so the Models and Tiers tabs keep the exact
    // "load the text catalog" button they already had.
    var loadModels = useCallback(function () { loadCatalog('text'); }, [loadCatalog]);

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

      /* Merge three sources so a person can be granted a tier even if they
         have no /userMeta record.
           userMeta  - the real profile (email, username, status)
           userStats - written on every progress sync; has username, no email
           presence  - whoever is connected right now
         Historically a rules bug rejected the self-seeded userMeta write for
         everyone except the owner, so accounts that predate the fix exist only
         in userStats/presence. Merging means they are grantable immediately
         instead of only after each person signs in again. userMeta always wins
         on conflict; the others only fill gaps. */
      var merged = {};
      function absorb(snapVal, source) {
        if (!snapVal) return;
        for (var uid in snapVal) {
          if (!Object.prototype.hasOwnProperty.call(snapVal, uid)) continue;
          var rec = snapVal[uid] || {};
          var cur = merged[uid] || {};
          merged[uid] = {
            username: cur.username || rec.username || rec.name || '',
            email: cur.email || rec.email || '',
            status: cur.status || rec.status || '',
            signupAt: cur.signupAt || rec.signupAt || rec.lastSync || rec.lastSeen || null,
            // Track where we learned about this person so the UI can say
            // "no profile yet" rather than pretending the record is complete.
            sources: (cur.sources || []).concat([source])
          };
        }
      }

      Promise.all([
        d.ref('userMeta').once('value').then(function (s) { return s.val(); }).catch(function () { return null; }),
        d.ref('userStats').once('value').then(function (s) { return s.val(); }).catch(function () { return null; }),
        d.ref('presence').once('value').then(function (s) { return s.val(); }).catch(function () { return null; })
      ]).then(function (res) {
        if (!mounted.current) return;
        absorb(res[0], 'userMeta');
        absorb(res[1], 'userStats');
        absorb(res[2], 'presence');
        setUserMeta(merged);
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

    /* ---- spend ledger (money) ---- */
    var loadSpend = useCallback(function () {
      var d = db();
      if (!d) { setSpend({ status: 'denied', days: {}, error: 'Firebase is not connected.' }); return; }
      setSpend(function (prev) { return { status: 'loading', days: prev.days, error: '' }; });
      d.ref(SPEND_PATH).once('value').then(function (snap) {
        if (!mounted.current) return;
        setSpend({ status: 'loaded', days: snap.val() || {}, error: '' });
      }).catch(function (e) {
        if (!mounted.current) return;
        // Almost always a missing security rule rather than a real outage, and
        // the difference matters: one is "nothing spent", the other is "you are
        // flying blind". Never conflate them.
        setSpend({
          status: 'denied', days: {},
          error: (e && e.message) ? e.message : 'permission denied'
        });
      });
    }, []);

    /* ---- ban read-back (the only permanent action in the app) ---- */
    var loadBans = useCallback(function () {
      var d = db();
      if (!d) return;
      setBans(function (prev) { return { status: 'loading', site: prev.site, community: prev.community }; });
      Promise.all([
        d.ref('bannedUsers').once('value').then(function (s) { return s.val() || {}; }, function () { return null; }),
        d.ref('community/banned').once('value').then(function (s) { return s.val() || {}; }, function () { return null; })
      ]).then(function (r) {
        if (!mounted.current) return;
        setBans({ status: 'loaded', site: r[0] || {}, community: r[1] || {} });
      });
    }, []);

    function unban(scope, uid) {
      var d = db();
      if (!d) { toast('Firebase not connected.', 'error'); return; }
      var path = scope === 'community' ? ('community/banned/' + uid) : ('bannedUsers/' + uid);
      d.ref(path).remove().then(function () {
        toast('Unbanned. They can post again immediately.', 'success');
        loadBans();
      }).catch(function (e) {
        toast('Could not unban: ' + (e && e.message ? e.message : 'permission denied'), 'error');
      });
    }

    useEffect(function () {
      if (tab === 'spend' && !usageLoaded) loadUsage();
      if (tab === 'spend' && spend.status === 'idle') loadSpend();
      if (tab === 'users' && bans.status === 'idle') loadBans();
    }, [tab, usageLoaded, loadUsage, spend.status, loadSpend, bans.status, loadBans]);

    /* ---- auto-load the OpenRouter catalog once, on open --------------------
     * Until this ran, slugState() answered 'unknown' for every model and the
     * Tiers tab rendered a dead slug as a perfectly healthy assigned model. The
     * server caches the catalog for ten minutes, so this is close to free.
     * -------------------------------------------------------------------- */
    var autoTried = useRef(false);
    useEffect(function () {
      if (!isOwner || autoTried.current) return;
      autoTried.current = true;
      loadCatalog('text');
    }, [isOwner, loadCatalog]);

    /* ---- and the IMAGE catalog the moment Routing is opened ----------------
     * The routing matrix has to be able to say "that model cannot make a
     * picture", and the only honest source for that is OpenRouter's own
     * output_modalities filter. Loading it lazily (rather than on open) keeps
     * the panel to one upstream call for anyone who never opens this tab.
     * -------------------------------------------------------------------- */
    useEffect(function () {
      if (!isOwner || tab !== 'routing') return;
      if (catalogs.image.status === 'idle') loadCatalog('image');
    }, [isOwner, tab, catalogs.image.status, loadCatalog]);

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
        [['spend', 'Spend'], ['settings', 'Settings'], ['models', 'Models'],
         ['routing', 'Routing'], ['tiers', 'Tiers'], ['users', 'People']].map(function (t) {
          return ce('button', {
            key: t[0], type: 'button', role: 'tab',
            'aria-selected': tab === t[0] ? 'true' : 'false',
            className: 'aia-tab' + (tab === t[0] ? ' on' : ''),
            onClick: function () { setTab(t[0]); }
          }, t[1]);
        })
      ),

      loadError && ce('div', { className: 'aia-note err' }, loadError),

      tab === 'settings' && ce(SettingsTab, { config: config, writeCfg: writeCfg, spend: spend }),
      tab === 'models' && ce(ModelsTab, {
        config: config, writeCfg: writeCfg, live: live, loadModels: loadModels,
        catalogs: catalogs, loadCatalog: loadCatalog
      }),
      tab === 'routing' && ce(RoutingTab, {
        config: config, writeCfg: writeCfg, catalogs: catalogs, loadCatalog: loadCatalog
      }),
      tab === 'tiers' && ce(TiersTab, {
        config: config, writeCfg: writeCfg, live: live, loadModels: loadModels
      }),
      tab === 'users' && ce(UsersTab, {
        userMeta: userMeta, userTiers: userTiers, setUserTier: setUserTier, config: config,
        bans: bans, unban: unban, reloadBans: loadBans
      }),
      tab === 'spend' && ce(SpendTab, {
        spend: spend, reloadSpend: loadSpend,
        usage: usage, loaded: usageLoaded, reload: loadUsage,
        userMeta: userMeta, userTiers: userTiers, config: config,
        writeCfg: writeCfg, setUserTier: setUserTier
      })
    );
  }

  function mergeWithDefaults(raw) {
    var d = defaults();
    var out = {
      enabled: raw && typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
      allowModelChoice: raw && raw.allowModelChoice === true,
      softCapUsd: (raw && typeof raw.softCapUsd === 'number' && isFinite(raw.softCapUsd) && raw.softCapUsd >= 0)
        ? raw.softCapUsd
        : (typeof d.softCapUsd === 'number' ? d.softCapUsd : DEFAULT_SOFT_CAP_USD),
      capMode: (raw && raw.capMode === 'block') ? 'block' : 'warn',
      // Per-day IMAGE cap, deliberately separate from dailyLimit: one picture
      // costs several messages, so the two allowances are never one number.
      imageLimits: {},
      tiers: {}
    };
    var defLimits = (d && d.imageLimits && typeof d.imageLimits === 'object')
      ? d.imageLimits : { free: 0, plus: 5, pro: 40, instructor: -1 };
    var rawLimits = (raw && raw.imageLimits && typeof raw.imageLimits === 'object' && !Array.isArray(raw.imageLimits))
      ? raw.imageLimits : null;

    var i, name;
    for (i = 0; i < TIER_ORDER.length; i++) {
      name = TIER_ORDER[i];
      var dt = d.tiers[name] || { models: [], dailyLimit: 0, maxTokens: 1024 };
      var rt = (raw && raw.tiers && raw.tiers[name]) ? raw.tiers[name] : null;

      // featureModels is admin-written free-form data out of Firebase, so it is
      // normalized through MM.ai when that is available (same filter the server
      // applies) and defensively copied when it is not. An unknown feature id or
      // a non-string value is dropped rather than rendered as a live route.
      var fmRaw = rt ? rt.featureModels : (dt ? dt.featureModels : null);
      var fm = {};
      var a = ai();
      if (a && typeof a.normalizeFeatureModels === 'function') {
        try { fm = a.normalizeFeatureModels(fmRaw); } catch (e) { fm = {}; }
      } else if (fmRaw && typeof fmRaw === 'object' && !Array.isArray(fmRaw)) {
        for (var k in fmRaw) {
          if (!Object.prototype.hasOwnProperty.call(fmRaw, k)) continue;
          if (typeof fmRaw[k] === 'string' && fmRaw[k]) fm[k] = fmRaw[k];
        }
      }

      out.tiers[name] = {
        models: rt ? modelsOf(rt) : (Array.isArray(dt.models) ? dt.models.slice() : []),
        dailyLimit: rt && typeof rt.dailyLimit === 'number' ? rt.dailyLimit : dt.dailyLimit,
        maxTokens: rt && typeof rt.maxTokens === 'number' ? rt.maxTokens : dt.maxTokens,
        featureModels: fm
      };

      var lim = rawLimits ? rawLimits[name] : undefined;
      out.imageLimits[name] = (typeof lim === 'number' && isFinite(lim))
        ? Math.floor(lim)
        : (typeof defLimits[name] === 'number' ? defLimits[name] : 0);
    }
    return out;
  }

  /* ==========================================================================
   * TAB: SETTINGS
   * ======================================================================== */

  function SettingsTab(props) {
    var config = props.config, writeCfg = props.writeCfg;
    var spend = props.spend || { status: 'idle' };

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
        temperature: 0,
        feature: 'admin'
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
          'tier-denied': 'The model is not on this tier\'s allowlist. Fix it on the Models or Tiers tab.',
          'quota-exceeded': 'The daily limit for this account has been reached.',
          'ai-disabled': 'The master switch above is off.',
          'network': 'The browser could not reach /api/ai. Confirm the function deployed and the netlify.toml redirect exists.',
          'server': 'The function returned an error. Check the Netlify function log for ai - the usual causes are a missing OPENROUTER_API_KEY or FIREBASE_DB_URL, an OpenRouter balance of $0, or a model slug that does not exist.'
        }[code];
        // The server tags OpenRouter-specific failures so they do not all read the same.
        var reason = (e && e.reason) ? {
          'insufficient-credits': 'Your OpenRouter balance is empty. Top it up at openrouter.ai/credits.',
          'unknown-model': 'That model slug does not exist on OpenRouter. Load the live catalog on the Models tab and pick a real one.',
          'bad-key': 'OPENROUTER_API_KEY is wrong or revoked. Make a new key at openrouter.ai/keys and redeploy.',
          'upstream-rate-limit': 'OpenRouter is rate limiting that model. Try again shortly or use a different one.',
          'provider-down': 'The upstream provider for that model is down. Try another model.'
        }[e.reason] : '';
        setTest({ ok: false, msg: 'Failed [' + code + ']: ' + (e && e.message ? e.message : 'unknown') +
          (reason ? ' -- ' + reason : (hint ? ' -- ' + hint : '')) });
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
          'Makes one real AI call through /api/ai using your account. It costs whatever OpenRouter charges for a couple of tokens on the selected model, and it proves the whole chain: Firebase token, tier check, Netlify function, OpenRouter key.'),
        test && ce('div', { className: 'aia-note ' + (test.ok ? 'ok' : 'err') }, test.msg)
      ),

      // reference
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Where things live'),
        ce('p', { className: 'aia-desc' },
          'Config: ', ce('span', { className: 'aia-code' }, '/appConfig/aiConfig'), ' - ',
          'Tiers: ', ce('span', { className: 'aia-code' }, '/userTiers/<uid>'), ' - ',
          'Calls: ', ce('span', { className: 'aia-code' }, '/aiUsage/<uid>/<date>'), ' - ',
          'Money: ', ce('span', { className: 'aia-code' }, '/aiSpend/<date>'), '.'),
        ce('p', { className: 'aia-desc' },
          'The OpenRouter key is only in the Netlify environment variable ',
          ce('span', { className: 'aia-code' }, 'OPENROUTER_API_KEY'),
          ' (get one at openrouter.ai/keys). It is never sent to the browser. Daily limits reset at midnight Eastern.'),
        ce('p', { className: 'aia-desc' },
          'OpenRouter bills per model and the prices vary enormously, so there is no fixed cost per message. ' +
          'The Models tab shows each model\'s real price before you assign it to a tier, and the Spend tab now ' +
          'shows what was actually billed, per model, per feature and per person, against a daily ceiling you set. ' +
          'A spend cap on your OpenRouter account is still worth having as the last line of defence.'),
        spend.status === 'denied' ? ce('div', { className: 'aia-note err' },
          'Heads up: the spend ledger at /aiSpend is not readable, so the Spend tab cannot show money. ' +
          'Open Spend for the exact security rule to paste.') : null
      )
    );
  }

  /* ==========================================================================
   * TAB: MODELS  (live OpenRouter catalog)
   * ------------------------------------------------------------------------
   * The key never leaves the server, so the browser asks the Netlify function
   * for the catalog with {action:'listModels'}. That action verifies the caller
   * is the owner and caches the answer for ten minutes.
   * ======================================================================== */

  var MAX_MODEL_ROWS = 80;

  function ModelsTab(props) {
    var config = props.config, writeCfg = props.writeCfg;
    var catalogs = props.catalogs || { text: emptyCatalog(), image: emptyCatalog(), video: emptyCatalog() };
    var loadCatalog = props.loadCatalog || props.loadModels || function () {};

    /* Which output modality this tab is showing. Each one is a separate
     * upstream list (?output_modalities=) and a separate client-side cache, so
     * switching tabs never refetches something already loaded. */
    var modState = useState('text');
    var modality = normModality(modState[0]), setModality = modState[1];
    var unit = modalityUnit(modality);

    var live = catalogs[modality] || emptyCatalog();
    var textCat = catalogs.text || emptyCatalog();

    var qState = useState('');
    var q = qState[0], setQ = qState[1];
    var freeState = useState(false);
    var freeOnly = freeState[0], setFreeOnly = freeState[1];
    var assignedState = useState(false);
    var assignedOnly = assignedState[0], setAssignedOnly = assignedState[1];

    // Load a modality the first time it is looked at, never twice.
    useEffect(function () {
      if (live.status === 'idle') loadCatalog(modality);
    }, [modality, live.status, loadCatalog]);

    var textIds = useMemo(function () {
      var map = {};
      for (var i = 0; i < textCat.models.length; i++) map[textCat.models[i].id] = textCat.models[i];
      return map;
    }, [textCat.models]);

    var assigned = useMemo(function () { return configuredIds(config); }, [config]);

    /* The safety net for the unverified slugs: anything configured (or shipped
     * in MODEL_CATALOG) that OpenRouter has never heard of. Always judged
     * against the TEXT catalog, which is the unfiltered full list - judging it
     * against the image list would condemn every text model on the site. */
    var problems = useMemo(function () {
      if (textCat.status !== 'loaded' || !textCat.models.length) return { configured: [], catalog: [] };
      var i, bad = [], badCat = [];
      for (i = 0; i < assigned.length; i++) {
        if (!textIds[assigned[i]]) bad.push(assigned[i]);
      }
      var cat = catalog();
      for (i = 0; i < cat.length; i++) {
        if (!textIds[cat[i].id] && bad.indexOf(cat[i].id) === -1) badCat.push(cat[i].id);
      }
      return { configured: bad, catalog: badCat };
    }, [textCat.status, textCat.models, textIds, assigned]);

    var filtered = useMemo(function () {
      var s = q.trim().toLowerCase();
      var out = [];
      for (var i = 0; i < live.models.length; i++) {
        var m = live.models[i];
        if (freeOnly && !m.isFree) continue;
        if (assignedOnly && assigned.indexOf(m.id) === -1) continue;
        if (s && m.id.toLowerCase().indexOf(s) === -1 && String(m.name).toLowerCase().indexOf(s) === -1) continue;
        out.push(m);
      }
      return out;
    }, [live.models, q, freeOnly, assignedOnly, assigned]);

    function toggle(tier, id) {
      var cur = modelsOf(config.tiers[tier]).slice();
      var i = cur.indexOf(id);
      if (i === -1) cur.push(id); else cur.splice(i, 1);
      writeCfg('tiers/' + tier + '/models', cur);
    }

    function tierPills(id) {
      return ce('div', { className: 'aia-pills', style: { marginTop: 7 } },
        TIER_ORDER.map(function (tier) {
          var list = modelsOf(config.tiers[tier]);
          var all = list.indexOf('*') !== -1;
          var on = all || list.indexOf(id) !== -1;
          return ce('button', {
            key: tier, type: 'button',
            className: 'aia-pill' + (on ? ' on' : ''),
            disabled: all,
            title: all ? TIER_LABEL[tier] + ' is set to every model (*)' : 'Add or remove for ' + TIER_LABEL[tier],
            onClick: function () { if (!all) toggle(tier, id); }
          }, TIER_LABEL[tier]);
        })
      );
    }

    /* Price chips, labelled for the modality being shown. An image model is
     * billed PER PICTURE, so printing its token rate under a "per 1M tokens"
     * heading would be a wrong number with a confident label. When OpenRouter
     * does not report a per-image price we say that, and keep the token rates
     * under their own correct label. */
    function priceChips(m) {
      if (modality === 'text') {
        return [
          ce('span', { className: 'aia-chip', key: 'in' }, 'in ' + fmtPrice(m.promptPrice) + ' /M tok'),
          ce('span', { className: 'aia-chip', key: 'out' }, 'out ' + fmtPrice(m.completionPrice) + ' /M tok'),
          ce('span', { className: 'aia-chip', key: 'ctx' }, fmtContext(m.contextLength))
        ];
      }
      var per = unitPriceOf(m);
      var chips = [];
      if (per !== null) {
        chips.push(ce('span', { className: 'aia-chip', key: 'per' }, fmtPerUnit(per, unit)));
      } else {
        chips.push(ce('span', { className: 'aia-chip unknown', key: 'per' }, 'per-' + unit + ' price not listed'));
        chips.push(ce('span', { className: 'aia-chip', key: 'in' }, 'in ' + fmtPrice(m.promptPrice) + ' /M tok'));
        chips.push(ce('span', { className: 'aia-chip', key: 'out' }, 'out ' + fmtPrice(m.completionPrice) + ' /M tok'));
      }
      chips.push(ce('span', { className: 'aia-chip', key: 'ctx' }, fmtContext(m.contextLength)));
      return chips;
    }

    function modelRow(m, extra) {
      // `isFree` is computed server-side from the TOKEN prices only. On an image
      // model that is not the same claim as "this picture is free", so it is
      // never rendered as one.
      var freeChip = m.isFree
        ? (modality === 'text'
            ? ce('span', { className: 'aia-chip free' }, 'FREE')
            : (unitPriceOf(m) === 0
                ? ce('span', { className: 'aia-chip free' }, 'FREE')
                : ce('span', { className: 'aia-chip' }, 'no token charge')))
        : null;
      return ce('div', { className: 'aia-mrow', key: m.id },
        ce('div', { className: 'aia-mtop' },
          ce('b', null, m.name),
          freeChip,
          extra || null
        ),
        ce('div', { className: 'aia-mid' }, m.id),
        ce('div', { className: 'aia-meta' }, priceChips(m)),
        tierPills(m.id)
      );
    }

    var freeTierEmpty = modelsOf(config.tiers.free).length === 0;

    return ce('div', null,

      /* ---- loader / status / modality ---- */
      ce('div', { className: 'aia-card' },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'OpenRouter model catalog'),
          ce('button', {
            type: 'button', className: 'btn btn-primary btn-sm',
            disabled: live.status === 'loading',
            onClick: function () { loadCatalog(modality); }
          }, live.status === 'loading' ? 'Loading...'
             : live.status === 'loaded' ? 'Reload models'
             : 'Load models from OpenRouter')
        ),
        ce('p', { className: 'aia-desc' },
          'Pulls the real, current list from openrouter.ai using your server key, then lets you assign models to tiers by clicking. ' +
          'The server caches each list for 10 minutes, so a reload inside that window is free.'),

        /* The three output modalities. This is not a text filter over one list -
         * each is a separate upstream query (?output_modalities=image), which is
         * why it is the authoritative answer to "can this model make a picture"
         * instead of a guess based on whether the slug contains the word. */
        ce('div', { className: 'aia-pills', style: { marginTop: 10 }, role: 'tablist',
          'aria-label': 'Output modality' },
          MODALITIES.map(function (md) {
            var c = catalogs[md.id] || emptyCatalog();
            var n = c.status === 'loaded' ? ' (' + c.models.length + ')' : '';
            return ce('button', {
              key: md.id, type: 'button', role: 'tab',
              'aria-selected': modality === md.id ? 'true' : 'false',
              className: 'aia-pill' + (modality === md.id ? ' on' : ''),
              onClick: function () { setModality(md.id); }
            }, md.label + n);
          })
        ),
        ce('p', { className: 'aia-desc' },
          modality === 'text'
            ? 'Text: every model OpenRouter offers. Prices are per million tokens.'
            : modality === 'image'
              ? 'Image: only models whose OUTPUT is a picture, straight from OpenRouter\'s output_modalities filter. These are the only models the image, mnemonic and avatar features can use. They are billed per picture, not per token.'
              : 'Video: only models whose output is a video clip. Nothing in the app routes to these yet - the list is here so you can see what exists and what it costs.'),

        live.status === 'idle' && ce('div', { className: 'aia-note info' },
          'Not loaded yet. Click the button to fetch the live ' + modality + ' catalog. Nothing below will be accurate until you do.'),
        live.status === 'loading' && ce('div', { className: 'aia-note info' },
          'Asking OpenRouter for its ' + modality + ' model list...'),
        live.status === 'error' && ce('div', { className: 'aia-note err' }, live.error),
        live.status === 'loaded' && live.models.length === 0 && ce('div', { className: 'aia-note err' },
          modality === 'text'
            ? 'OpenRouter returned an empty catalog. That is almost certainly a key or account problem - check openrouter.ai/keys.'
            : 'OpenRouter returned no ' + modality + '-output models. Either the filter returned nothing today, or the key cannot see them.'),
        live.status === 'loaded' && live.models.length > 0 && ce('div', { className: 'aia-note ok' },
          live.models.length + ' ' + modality + ' models loaded' + (live.cached ? ' (from the server cache)' : '') +
          (live.fetchedAt ? ' at ' + new Date(live.fetchedAt).toLocaleTimeString() : '') + '.')
      ),

      /* ---- validation: slugs that do not exist ---- */
      (problems.configured.length > 0 || problems.catalog.length > 0) && ce('div', { className: 'aia-card alert' },
        ce('p', { className: 'aia-h' }, '⚠ Model IDs that do not exist on OpenRouter'),
        problems.configured.length > 0 && ce('div', null,
          ce('p', { className: 'aia-desc' },
            'These are assigned to a tier right now and WILL FAIL with a "model does not exist" error the moment a student uses them. Remove or replace each one:'),
          ce('div', { style: { marginTop: 8 } },
            problems.configured.map(function (id) {
              return ce('div', { className: 'aia-mrow', key: id },
                ce('div', { className: 'aia-mtop' },
                  ce('b', null, id),
                  ce('span', { className: 'aia-chip warn' }, 'NOT ON OPENROUTER')),
                ce('div', { className: 'aia-meta' },
                  TIER_ORDER.filter(function (t) { return modelsOf(config.tiers[t]).indexOf(id) !== -1; })
                    .map(function (t) { return ce('span', { className: 'aia-chip', key: t }, TIER_LABEL[t]); })
                ),
                tierPills(id)
              );
            })
          )
        ),
        problems.catalog.length > 0 && ce('p', { className: 'aia-desc', style: { marginTop: 10 } },
          'Also in MODEL_CATALOG (js/ai.js) but missing from the live catalog, so do not assign them: ' +
          problems.catalog.join(', ') + '. Only ' + verifiedIds().join(' and ') + ' were ever verified.')
      ),

      /* ---- free tier reminder ---- */
      freeTierEmpty && ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Free tier has no models'),
        ce('p', { className: 'aia-desc' }, freeHint()),
        live.status === 'loaded' && ce('button', {
          type: 'button', className: 'btn btn-outline btn-sm', style: { marginTop: 10 },
          onClick: function () { setFreeOnly(true); setQ(''); setAssignedOnly(false); }
        }, 'Show free models only')
      ),

      /* ---- the searchable list ---- */
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Assign models to tiers'),
        ce('div', { className: 'aia-filters' },
          ce('input', {
            className: 'aia-input', type: 'search',
            placeholder: 'Filter by name or slug, e.g. "deepseek" or ":free"...',
            value: q, onChange: function (e) { setQ(e.target.value); },
            disabled: live.status !== 'loaded',
            'aria-label': 'Filter models'
          }),
          ce('label', { className: 'aia-check' },
            ce('input', {
              type: 'checkbox', checked: freeOnly,
              disabled: live.status !== 'loaded',
              onChange: function (e) { setFreeOnly(e.target.checked); }
            }), 'Free only'),
          ce('label', { className: 'aia-check' },
            ce('input', {
              type: 'checkbox', checked: assignedOnly,
              disabled: live.status !== 'loaded',
              onChange: function (e) { setAssignedOnly(e.target.checked); }
            }), 'Assigned only')
        ),

        live.status !== 'loaded' && ce('div', { className: 'aia-empty' },
          live.status === 'loading' ? 'Loading the catalog...'
            : live.status === 'error' ? 'The catalog could not be loaded. Fix the error above and try again.'
            : 'Load the catalog above to pick models.'),

        live.status === 'loaded' && live.models.length > 0 && filtered.length === 0 && ce('div', { className: 'aia-empty' },
          'No model matches those filters.'),

        live.status === 'loaded' && filtered.length > 0 && ce('div', null,
          ce('p', { className: 'aia-desc' },
            'Showing ' + Math.min(filtered.length, MAX_MODEL_ROWS) + ' of ' + filtered.length + ' matches. ' +
            (modality === 'text'
              ? 'Prices are US dollars per million tokens: "in" is your prompt, "out" is the reply.'
              : 'These are billed per ' + unit + ', not per token. Where OpenRouter reports a per-' + unit +
                ' price it is shown as such; where it does not, the token rates are shown under their own label ' +
                'rather than being relabelled as something they are not.')),
          ce('div', { className: 'aia-list', style: { maxHeight: 520, marginTop: 6 },
            tabIndex: 0, role: 'region', 'aria-label': 'Matching OpenRouter models' },
            filtered.slice(0, MAX_MODEL_ROWS).map(function (m) {
              var isAssigned = assigned.indexOf(m.id) !== -1;
              return modelRow(m, isAssigned ? ce('span', { className: 'aia-chip' }, 'assigned') : null);
            })
          )
        )
      )
    );
  }

  /* ==========================================================================
   * TAB: ROUTING
   * --------------------------------------------------------------------------
   * Four things live here, and they are the same subject:
   *
   *   1. THE MATRIX - feature x tier, which model answers which part of the app.
   *      Every cell shows the EFFECTIVE model (what the server will really pick),
   *      not just what was typed into the config, because those two differ far
   *      more often than anyone expects and the difference is silent.
   *   2. IMAGE LIMITS - the per-day picture cap, which is a completely separate
   *      allowance from the daily message limit and is always described as one.
   *   3. PRE-GENERATE - fill the shared cache for the two FIXED image sets so
   *      they cost nothing at runtime, and export them into the repo so they
   *      cost nothing ever again.
   *   4. The /imageCache security rule, because an unreadable index does not
   *      fail loudly - it just quietly makes every student pay again.
   * ======================================================================== */

  /** A per-image price when the model makes pictures, a token price otherwise. */
  function routedPrice(catalogs, slug) {
    if (!slug) return '';
    var imgRec = findModel(catalogs.image, slug);
    if (imgRec) return priceSummary(imgRec, 'image');
    var txtRec = findModel(catalogs.text, slug);
    if (txtRec) return priceSummary(txtRec, 'text');
    return '';
  }

  function downloadText(filename, text) {
    try {
      if (typeof Blob !== 'function' || !window.URL || typeof window.URL.createObjectURL !== 'function') return false;
      var blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
      var url = window.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try { document.body.removeChild(a); } catch (e) { /* noop */ }
        try { window.URL.revokeObjectURL(url); } catch (e) { /* noop */ }
      }, 0);
      return true;
    } catch (e) { return false; }
  }

  var CLEAR_CACHE_PHRASE = 'DELETE THE IMAGES';

  function RoutingTab(props) {
    var config = props.config, writeCfg = props.writeCfg;
    var catalogs = props.catalogs || { text: emptyCatalog(), image: emptyCatalog(), video: emptyCatalog() };
    var loadCatalog = props.loadCatalog || function () {};
    var imageCat = catalogs.image || emptyCatalog();

    var rows = useMemo(function () { return featureRows(); }, []);

    /* ---------------------------------------------------------------- matrix */

    function setRoute(tier, featureId, slug) {
      // '' means "no override" -> the key is REMOVED, not written as empty. An
      // empty string in featureModels is junk the server has to filter; absence
      // is the actual state being expressed.
      writeCfg('tiers/' + tier + '/featureModels/' + featureId, slug ? slug : null);
    }

    function optionsFor(tier, isImg, current) {
      var tcfg = config.tiers[tier] || {};
      var allowed = modelsOf(tcfg);
      var wildcard = allowed.indexOf('*') !== -1;
      var seen = {}, out = [], i;
      function add(id) {
        if (!id || id === '*' || seen[id]) return;
        seen[id] = true;
        out.push(id);
      }
      if (wildcard) {
        // Instructor is allowed everything, so offer everything that is actually
        // in play: assigned models, plus the real image models when the feature
        // makes pictures. A 300-row select would be unusable on a phone.
        var cfgIds = configuredIds(config);
        for (i = 0; i < cfgIds.length; i++) add(cfgIds[i]);
        if (isImg) for (i = 0; i < imageCat.models.length; i++) add(imageCat.models[i].id);
      } else {
        for (i = 0; i < allowed.length; i++) add(allowed[i]);
      }
      add(current);
      return out;
    }

    function cell(feature, tier) {
      var isImg = IMAGE_FEATURES.indexOf(feature.id) !== -1;
      var tcfg = config.tiers[tier] || {};
      var allowed = modelsOf(tcfg);
      var wildcard = allowed.indexOf('*') !== -1;
      var fm = featureModelsOf(tcfg);
      var current = typeof fm[feature.id] === 'string' ? fm[feature.id] : '';
      var route = previewRoute(config, tier, feature.id);
      var price = routedPrice(catalogs, route.model);
      var cap = isImg ? imageCapability(imageCat, route.model) : 'ok';

      var bad = !!route.ignored || (isImg && cap === 'text-only');
      var soft = !bad && ((isImg && cap === 'unknown') || (!wildcard && allowed.length === 0));

      var opts = optionsFor(tier, isImg, current);

      return ce('div', {
        key: tier,
        className: 'aia-cell' + (bad ? ' flag' : soft ? ' warn' : '')
      },
        ce('div', { className: 'tier', style: { color: TIER_COLOR[tier] } }, TIER_LABEL[tier]),

        ce('select', {
          className: 'aia-select',
          value: current,
          'aria-label': feature.label + ' model for ' + TIER_LABEL[tier],
          onChange: function (e) { setRoute(tier, feature.id, e.target.value); }
        },
          ce('option', { value: '' }, 'Tier default'),
          opts.map(function (id) { return ce('option', { key: id, value: id }, id); })
        ),

        /* The effective model, ALWAYS. "Tier default" is not an answer to
         * "what will run"; the slug is. */
        ce('div', { className: 'aia-eff' },
          'runs on ', ce('b', null, route.model || '(nothing configured)'),
          route.source === 'tierDefault' ? ' - first model on the tier' :
          route.source === 'default' ? ' - the built-in fallback, because this tier lists no models' : '',
          price ? ce('span', { className: 'price' }, ' · ' + price) : null
        ),

        route.ignored ? ce('div', { className: 'aia-cellwarn bad' },
          'Set to ' + route.ignored + ', but ' + TIER_LABEL[tier] + ' does not allow that model, so the server ' +
          'ignores it and uses ' + (route.model || 'the fallback') + ' instead. Add it to this tier on the Models ' +
          'tab, or pick one from the list above.') : null,

        (isImg && cap === 'text-only') ? ce('div', { className: 'aia-cellwarn bad' },
          route.model + ' does not produce images. OpenRouter\'s image-output list does not contain it, so this ' +
          'feature will fail in front of a student. Pick a model from the Image tab of the Models catalog.') : null,

        (isImg && cap === 'unknown') ? ce('div', { className: 'aia-cellwarn soft' },
          imageCat.status === 'loading'
            ? 'Checking the image catalog...'
            : ('Cannot verify this makes pictures until the image catalog loads' +
               (route.model && !looksLikeImageModel(route.model)
                 ? '. The slug does not look like an image model, but that is a guess, not the answer.' : '.'))) : null,

        (!wildcard && allowed.length === 0) ? ce('div', { className: 'aia-cellwarn soft' },
          TIER_LABEL[tier] + ' has no models assigned, so nothing here can run for them yet.') : null
      );
    }

    /* --------------------------------------------------------- image limits */

    function setImageLimit(tier, raw) {
      var n = parseInt(raw, 10);
      if (!isFinite(n)) return;
      if (n < -1) n = -1;
      writeCfg('imageLimits/' + tier, n);
    }

    /* -------------------------------------------------------- pre-generate */

    var runState = useState({
      running: false, idx: 0, total: 0, done: 0, generated: 0, skipped: 0,
      costUsd: 0, errors: [], label: '', finished: false, stopped: false, started: false
    });
    var run = runState[0], setRun = runState[1];

    var expState = useState({ busy: false, done: 0, total: 0, msg: '', text: '', count: 0, skipped: [] });
    var exp = expState[0], setExp = expState[1];

    // Refs, not state: the loop must never be restarted by a re-render, and a
    // stop has to be visible to an in-flight iteration immediately.
    var busyRef = useRef(false);
    var stopRef = useRef(false);
    var itemsRef = useRef(null);
    var cursorRef = useRef(0);
    var aliveRef = useRef(true);
    useEffect(function () { return function () { aliveRef.current = false; stopRef.current = true; }; }, []);

    function patchRun(patch) {
      if (!aliveRef.current) return;
      setRun(function (prev) {
        var next = {}, k;
        for (k in prev) { if (Object.prototype.hasOwnProperty.call(prev, k)) next[k] = prev[k]; }
        for (k in patch) { if (Object.prototype.hasOwnProperty.call(patch, k)) next[k] = patch[k]; }
        return next;
      });
    }

    function bumpRun(d) {
      if (!aliveRef.current) return;
      setRun(function (prev) {
        return {
          running: prev.running, idx: prev.idx, total: prev.total,
          done: prev.done + (d.done || 0),
          generated: prev.generated + (d.generated || 0),
          skipped: prev.skipped + (d.skipped || 0),
          costUsd: prev.costUsd + (d.costUsd || 0),
          errors: d.error ? prev.errors.concat([d.error]) : prev.errors,
          label: d.label !== undefined ? d.label : prev.label,
          finished: prev.finished, stopped: prev.stopped, started: prev.started
        };
      });
    }

    function finish() {
      busyRef.current = false;
      var items = itemsRef.current || [];
      var incomplete = cursorRef.current < items.length;
      patchRun({ running: false, label: '', finished: !incomplete, stopped: incomplete });
    }

    function step() {
      var im = images();
      var items = itemsRef.current || [];
      if (!im || stopRef.current || cursorRef.current >= items.length) { finish(); return; }

      var i = cursorRef.current;
      var it = items[i];
      patchRun({ idx: i, label: it.label });

      var req = { prompt: it.prompt, feature: it.feature, size: it.size };

      Promise.resolve(im.lookup(req)).then(function (entry) {
        if (entry) {
          // Already in the shared cache (or the static bundle). Not paid for
          // again, not re-uploaded, not re-indexed. This is what makes the run
          // resumable for free.
          cursorRef.current = i + 1;
          bumpRun({ done: 1, skipped: 1 });
          return null;
        }
        return Promise.resolve(im.get(req)).then(function (made) {
          cursorRef.current = i + 1;
          if (made) {
            bumpRun({ done: 1, generated: 1, costUsd: (typeof made.cost === 'number' && isFinite(made.cost)) ? made.cost : 0 });
          } else {
            var le = im.lastError;
            bumpRun({ done: 1, error: it.label + ' - ' + ((le && le.message) ? le.message : 'no image came back') });
            // The daily cap or a hard block: keep going and you get one failed
            // round trip per remaining item for nothing.
            if (typeof im.isBlocked === 'function' && im.isBlocked()) stopRef.current = true;
          }
          return null;
        });
      }).catch(function (e) {
        cursorRef.current = i + 1;
        bumpRun({ done: 1, error: it.label + ' - ' + ((e && e.message) ? e.message : 'failed') });
      }).then(function () {
        step();
      });
    }

    function startRun(resume) {
      var im = images();
      if (!im || typeof im.fixedList !== 'function') {
        toast('js/images.js is not loaded, so there is nothing to pre-generate.', 'error');
        return;
      }
      if (busyRef.current) return;   // never two runs at once, ever
      var items = itemsRef.current;
      if (!resume || !items || !items.length) {
        items = im.fixedList();
        itemsRef.current = items;
        cursorRef.current = 0;
      }
      if (!items.length) {
        toast('No drug or scenario data is loaded on this page, so there is nothing to generate.', 'error');
        return;
      }
      busyRef.current = true;
      stopRef.current = false;
      if (resume) {
        patchRun({ running: true, total: items.length, idx: cursorRef.current, finished: false, stopped: false, started: true });
      } else {
        patchRun({
          running: true, idx: 0, total: items.length, done: 0, generated: 0, skipped: 0,
          costUsd: 0, errors: [], label: '', finished: false, stopped: false, started: true
        });
      }
      step();
    }

    function stopRun() {
      stopRef.current = true;
      patchRun({ label: 'stopping after this one...' });
    }

    /* ------------------------------------------------------- static export */

    function exportBundle() {
      var im = images();
      if (!im || typeof im.exportStatic !== 'function') {
        toast('js/images.js is not loaded.', 'error');
        return;
      }
      var items = itemsRef.current;
      if (!items || !items.length) { items = im.fixedList(); itemsRef.current = items; }
      if (!items.length) { toast('Nothing to export.', 'error'); return; }

      setExp({ busy: true, done: 0, total: items.length, msg: 'Finding cached images...', text: '', count: 0, skipped: [] });

      var found = [];
      var i = 0;
      function next() {
        if (i >= items.length) return Promise.resolve();
        var it = items[i++];
        return Promise.resolve(im.lookup({ prompt: it.prompt, feature: it.feature, size: it.size }))
          .then(function (entry) {
            if (entry && entry.url) found.push({ hash: entry.hash || it.hash, url: entry.url, label: it.label });
            if (aliveRef.current) {
              setExp(function (p) { return { busy: true, done: i, total: items.length, msg: it.label, text: p.text, count: p.count, skipped: p.skipped }; });
            }
            return next();
          }, function () { return next(); });
      }

      next().then(function () {
        return im.exportStatic(found, function (d, t, label) {
          if (aliveRef.current) {
            setExp(function (p) { return { busy: true, done: d, total: t, msg: 'Encoding ' + label, text: p.text, count: p.count, skipped: p.skipped }; });
          }
        });
      }).then(function (res) {
        if (!aliveRef.current) return;
        var ok = downloadText('static-images.js', res.text);
        setExp({
          busy: false, done: res.count, total: found.length,
          msg: ok ? 'Downloaded static-images.js with ' + res.count + ' image' + (res.count === 1 ? '' : 's') + '.'
                  : 'This browser blocked the download - copy the text below into data/static-images.js instead.',
          text: ok ? '' : res.text,
          count: res.count,
          skipped: res.skipped || []
        });
        if (ok) toast('Static bundle downloaded. Commit it as data/static-images.js.', 'success');
      }).catch(function (e) {
        if (!aliveRef.current) return;
        setExp({ busy: false, done: 0, total: 0, count: 0, skipped: [], text: '',
          msg: 'Export failed: ' + ((e && e.message) ? e.message : 'unknown error') });
      });
    }

    /* ----------------------------------------------------------- rendering */

    var im = images();
    var fixedCount = 0;
    if (im && typeof im.fixedList === 'function') {
      try { fixedCount = im.fixedList().length; } catch (e) { fixedCount = 0; }
    }
    var pctRun = run.total > 0 ? Math.round((run.done / run.total) * 100) : 0;

    return ce('div', null,

      /* ---- what this tab is, and whether it can tell the truth yet ---- */
      ce('div', { className: 'aia-card' },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'Which model answers which part of the app'),
          ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm',
            disabled: imageCat.status === 'loading',
            onClick: function () { loadCatalog('image'); }
          }, imageCat.status === 'loading' ? 'Loading...' : 'Reload image catalog')
        ),
        ce('p', { className: 'aia-desc' },
          'Each cell picks the model for one feature on one plan. "Tier default" means the first model on that ' +
          'tier\'s list - and the cell still tells you which slug that actually is, because the whole point of ' +
          'this screen is that the configured value and the effective value are not the same thing.'),
        ce('p', { className: 'aia-desc' },
          'The server re-resolves all of this on every call and is the only thing that enforces it. A model that ' +
          'is not on the tier\'s allow-list is silently dropped there, which is exactly why it is shouted about here.'),

        imageCat.status === 'loaded' && imageCat.models.length > 0 && ce('div', { className: 'aia-note ok' },
          imageCat.models.length + ' image-output models known, so the picture features below are checked against ' +
          'real capability data rather than a guess about the slug.'),
        imageCat.status === 'error' && ce('div', { className: 'aia-note warn' },
          'The image catalog did not load (' + imageCat.error + '), so image capability cannot be verified below.'),
        imageCat.status === 'idle' && ce('div', { className: 'aia-note info' },
          'Loading the image catalog so the picture features can be checked...')
      ),

      /* ---- THE MATRIX ---- */
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Feature routing'),
        ce('p', { className: 'aia-desc' },
          'Writes to ', ce('span', { className: 'aia-code' }, 'aiConfig.tiers.<tier>.featureModels.<feature>'), '.'),
        rows.map(function (f, i) {
          var isImg = IMAGE_FEATURES.indexOf(f.id) !== -1;
          return ce('div', { className: 'aia-featrow' + (i === 0 ? ' first' : ''), key: f.id },
            ce('div', { className: 'aia-row' },
              ce('div', { style: { minWidth: 0 } },
                ce('div', { className: 'aia-featname' }, f.label),
                ce('div', { className: 'aia-featid' }, f.id)
              ),
              isImg ? ce('span', { className: 'aia-chip' }, 'makes a picture') : null
            ),
            ce('div', { className: 'aia-mx' },
              TIER_ORDER.map(function (t) { return cell(f, t); })
            )
          );
        })
      ),

      /* ---- IMAGE LIMITS ---- */
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Daily image limit per plan'),
        ce('p', { className: 'aia-desc' },
          'This is a SEPARATE allowance from the daily message limit on the Tiers tab, and it is counted ' +
          'separately on the server (/aiUsage/<uid>/<day>_img). A picture costs several times what a tutor ' +
          'message costs, so a student can be nowhere near their message limit and still be out of pictures - ' +
          'and running out of pictures never touches the tutor.'),
        ce('div', { className: 'aia-nums', style: { marginTop: 10 } },
          TIER_ORDER.map(function (t) {
            var v = (config.imageLimits && typeof config.imageLimits[t] === 'number') ? config.imageLimits[t] : 0;
            var msgs = (config.tiers[t] && typeof config.tiers[t].dailyLimit === 'number') ? config.tiers[t].dailyLimit : 0;
            return ce('div', { className: 'aia-field', key: t },
              ce('label', { htmlFor: 'aia-img-' + t, style: { color: TIER_COLOR[t] } }, TIER_LABEL[t]),
              ce('input', {
                id: 'aia-img-' + t, className: 'aia-input', type: 'number', step: 1, min: -1,
                defaultValue: v, key: t + '-' + v,
                onBlur: function (e) { setImageLimit(t, e.target.value); },
                onKeyDown: function (e) { if (e.key === 'Enter') e.target.blur(); }
              }),
              ce('div', { style: { color: 'var(--text3)', fontSize: 'var(--fs-xs,12px)', marginTop: 4 } },
                (v === -1 ? 'unlimited pictures' : v === 0 ? 'no pictures on this plan' : v + ' pictures a day') +
                ' · ' + (msgs === -1 ? 'unlimited messages' : msgs + ' messages a day'))
            );
          })
        ),
        ce('p', { className: 'aia-desc' },
          ce('span', { className: 'aia-code' }, '-1'), ' is unlimited, ',
          ce('span', { className: 'aia-code' }, '0'), ' means pictures are not part of that plan. ',
          'Writes to ', ce('span', { className: 'aia-code' }, 'aiConfig.imageLimits.<tier>'), '.')
      ),

      /* ---- PRE-GENERATE ---- */
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Pre-generate the fixed image sets'),
        ce('p', { className: 'aia-desc' },
          'There are exactly two sets of pictures this app needs, and they are the same for every student who ' +
          'ever installs it: 37 drug mnemonics and 18 patient portraits. Generate them once here and every ' +
          'student reads them out of the shared cache for free. Export them afterwards and they cost nothing ' +
          'even to look up.'),
        ce('p', { className: 'aia-desc' },
          fixedCount
            ? (fixedCount + ' items found on this page. Anything already in the cache is skipped without spending ' +
               'a cent, so re-running is safe and the run is resumable.')
            : 'No items found - window.MEDADMIN_DRUGS and window.ALL_SCENARIOS are not loaded on this page.'),

        ce('div', { className: 'aia-run' },
          ce('button', {
            type: 'button', className: 'btn btn-primary btn-sm',
            disabled: run.running || !fixedCount,
            onClick: function () { startRun(false); }
          }, run.running ? 'Running...' : run.started ? 'Start over' : 'Start'),
          (run.stopped && !run.running) ? ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm',
            onClick: function () { startRun(true); }
          }, 'Resume from ' + (cursorRef.current + 1)) : null,
          run.running ? ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm', onClick: stopRun
          }, 'Stop') : null,
          ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm',
            disabled: run.running || exp.busy || !fixedCount,
            onClick: exportBundle
          }, exp.busy ? 'Exporting...' : 'Export as static bundle')
        ),

        run.started ? ce('div', null,
          ce('div', { className: 'aia-runbar' },
            ce('i', { style: { width: pctRun + '%' } })),
          ce('div', { className: 'aia-row', style: { marginTop: 8, fontSize: 'var(--fs-sm,13px)' } },
            ce('span', { style: { color: 'var(--text2)' } },
              run.done + ' of ' + run.total + (run.label ? ' · ' + run.label : '')),
            ce('span', { style: { fontWeight: 700 } }, 'spent ' + fmtUsd(run.costUsd))
          ),
          ce('div', { className: 'aia-meta' },
            ce('span', { className: 'aia-chip' }, run.generated + ' generated'),
            ce('span', { className: 'aia-chip' }, run.skipped + ' already cached'),
            run.errors.length ? ce('span', { className: 'aia-chip warn' }, run.errors.length + ' failed') : null
          ),
          run.finished && !run.running ? ce('div', { className: 'aia-note ok' },
            'Done. ' + run.generated + ' generated for ' + fmtUsd(run.costUsd) + ', ' + run.skipped +
            ' were already cached. Export the bundle now so this never has to run again.') : null,
          run.stopped && !run.running ? ce('div', { className: 'aia-note warn' },
            'Stopped at item ' + (cursorRef.current + 1) + ' of ' + run.total +
            '. Nothing already generated was lost - Resume picks up from here, and anything cached is skipped.') : null,
          run.errors.length ? ce('div', { className: 'aia-errlist', tabIndex: 0, role: 'region',
            'aria-label': 'Pre-generate errors' },
            run.errors.map(function (msg, i2) { return ce('div', { key: i2 }, msg); })) : null
        ) : null,

        exp.busy ? ce('div', null,
          ce('div', { className: 'aia-runbar' },
            ce('i', { style: { width: (exp.total ? Math.round((exp.done / exp.total) * 100) : 0) + '%' } })),
          ce('p', { className: 'aia-desc' }, exp.msg)
        ) : (exp.msg ? ce('div', { className: 'aia-note ' + (exp.count ? 'ok' : 'warn') }, exp.msg) : null),

        exp.skipped && exp.skipped.length ? ce('div', { className: 'aia-note warn' },
          exp.skipped.length + ' item' + (exp.skipped.length === 1 ? ' was' : 's were') +
          ' left out because no cached image could be read for them: ' + exp.skipped.slice(0, 8).join(', ') +
          (exp.skipped.length > 8 ? '...' : '')) : null,

        exp.text ? ce('div', { className: 'aia-pre', style: { maxHeight: 220, overflow: 'auto' } },
          exp.text.slice(0, 4000) + (exp.text.length > 4000 ? '\n... (truncated for display - use the download button)' : '')) : null,

        ce('p', { className: 'aia-desc' },
          'The export writes ', ce('span', { className: 'aia-code' }, 'window.MM_STATIC_IMAGES'),
          ' keyed by prompt hash. Save it as ', ce('span', { className: 'aia-code' }, 'data/static-images.js'),
          ', load it before ', ce('span', { className: 'aia-code' }, 'js/images.js'),
          ', and those pictures become step 2 of the lookup: no generation, no Firebase read, no download, ever again.')
      ),

      /* ---- the rule that makes the shared cache work at all ---- */
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'The /imageCache security rule'),
        ce('p', { className: 'aia-desc' },
          'The shared index is what stops the second student paying for a picture the first one already bought. ' +
          'If it is not readable, nothing breaks visibly - every student just silently generates their own copy. ' +
          'Paste this into Firebase -> Realtime Database -> Rules next to the aiUsage block:'),
        ce('div', { className: 'aia-pre' }, imageCacheRules()),
        ce('p', { className: 'aia-desc' },
          'Read is open to any signed-in user on purpose: a cache nobody can read is not a cache. Writing a new ' +
          'entry is allowed only where one does not already exist, so a student can publish a picture they just ' +
          'paid for but can never overwrite or poison somebody else\'s.'),
        (im && im.STORAGE_RULES_SNIPPET) ? ce('div', null,
          ce('p', { className: 'aia-desc', style: { marginTop: 12 } },
            'And the matching Cloud Storage rules, which live in a different console tab (Storage -> Rules):'),
          ce('div', { className: 'aia-pre' }, im.STORAGE_RULES_SNIPPET)
        ) : null
      )
    );
  }

  /* ==========================================================================
   * TAB: TIERS
   * ======================================================================== */

  function TiersTab(props) {
    var config = props.config, writeCfg = props.writeCfg;
    var live = props.live || { status: 'idle', models: [] };
    var loadModels = props.loadModels;
    var models = catalog();

    var liveIds = useMemo(function () {
      var map = {};
      for (var i = 0; i < live.models.length; i++) map[live.models[i].id] = live.models[i];
      return map;
    }, [live.models]);

    var checked = live.status === 'loaded' && live.models.length > 0;

    // 'ok' | 'missing' | 'unknown' for one slug against the live catalog.
    // 'unknown' means WE HAVE NOT CHECKED. It used to render as nothing at all,
    // so a dead slug appeared as a healthy assigned model. It is now a visible,
    // visually distinct dashed "unverified" chip.
    function slugState(id) {
      if (!checked) return 'unknown';
      return liveIds[id] ? 'ok' : 'missing';
    }

    function stateChip(st) {
      if (st === 'missing') return ce('span', { className: 'aia-chip warn' }, 'NOT ON OPENROUTER');
      if (st === 'ok') return ce('span', { className: 'aia-chip verified' }, 'verified');
      return ce('span', { className: 'aia-chip unknown', title: 'The live catalog has not been loaded this session, so this slug has not been checked.' }, 'unverified');
    }

    function stateNote(st) {
      if (st === 'missing') {
        return ce('small', { style: { color: 'var(--red-fg,var(--red))', fontWeight: 600 } },
          'This model ID does not exist on OpenRouter and will fail for every student who hits it.');
      }
      if (st === 'unknown') {
        return ce('small', { style: { color: 'var(--text3)' } },
          'Not checked against OpenRouter yet - load the live catalog to confirm this slug is real.');
      }
      return null;
    }

    function toggleModel(tier, id, on) {
      var cur = modelsOf(config.tiers[tier]).slice();
      var i = cur.indexOf(id);
      if (on && i === -1) cur.push(id);
      if (!on && i !== -1) cur.splice(i, 1);
      writeCfg('tiers/' + tier + '/models', cur);
    }

    // Unchecking "Every model (*)" CLEARS the list. It used to write every
    // hardcoded catalog slug instead - including the three that were never
    // verified against OpenRouter - so the box that looked like "grant nothing"
    // silently granted five models, three of them broken.
    function toggleAll(tier, on) {
      writeCfg('tiers/' + tier + '/models', on ? ['*'] : []);
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

      !checked && ce('div', { className: 'aia-card warn' },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'Nothing below has been checked against OpenRouter'),
          ce('button', {
            type: 'button', className: 'btn btn-primary btn-sm',
            disabled: live.status === 'loading',
            onClick: function () { if (loadModels) loadModels(); }
          }, live.status === 'loading' ? 'Loading...' : 'Load the live catalog')
        ),
        ce('p', { className: 'aia-desc' },
          'Every slug on this page is marked "unverified" until the live catalog loads. Three of the five slugs ' +
          'hardcoded in js/ai.js were never verified against OpenRouter, and an assigned slug that does not ' +
          'exist looks exactly like a working one until a student hits it.' +
          (live.status === 'error' ? ' The last load failed: ' + live.error : ''))
      ),

      TIER_ORDER.map(function (tier) {
        var t = config.tiers[tier] || { models: [], dailyLimit: 0, maxTokens: 1024 };
        var list = modelsOf(t);
        var all = list.indexOf('*') !== -1;
        // Assigned slugs that are not in MODEL_CATALOG (usually picked on the Models tab).
        var offCatalog = list.filter(function (id) {
          if (id === '*') return false;
          for (var i = 0; i < models.length; i++) { if (models[i].id === id) return false; }
          return true;
        });
        var badSlugs = list.filter(function (id) { return id !== '*' && slugState(id) === 'missing'; });

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
              var st2 = slugState(m.id);
              var lm = liveIds[m.id];
              return ce('label', {
                className: 'aia-model' + (on ? ' on' : '') +
                  (on && st2 === 'missing' ? ' bad' : on && st2 === 'unknown' ? ' unverified' : ''),
                key: m.id
              },
                ce('input', {
                  type: 'checkbox', checked: on,
                  onChange: function (e) { toggleModel(tier, m.id, e.target.checked); }
                }),
                ce('span', null,
                  ce('b', null, m.name, ' ', stateChip(st2)),
                  ce('small', null, m.description),
                  ce('small', { style: { opacity: 0.7 } }, m.id),
                  stateNote(st2),
                  st2 === 'ok' && lm ? ce('small', { style: { opacity: 0.75 } },
                    'in ' + fmtPrice(lm.promptPrice) + ' / out ' + fmtPrice(lm.completionPrice) +
                    ' / ' + fmtContext(lm.contextLength)) : null
                )
              );
            }),

            // Slugs assigned from the live catalog that are not in MODEL_CATALOG.
            offCatalog.map(function (id) {
              var lm = liveIds[id];
              var st3 = slugState(id);
              return ce('label', {
                className: 'aia-model on' + (st3 === 'missing' ? ' bad' : st3 === 'unknown' ? ' unverified' : ''),
                key: 'x-' + id
              },
                ce('input', {
                  type: 'checkbox', checked: true,
                  onChange: function () { toggleModel(tier, id, false); }
                }),
                ce('span', null,
                  ce('b', null, lm ? lm.name : id, ' ', stateChip(st3)),
                  // Only claim it came from the live catalog when we can see it there.
                  ce('small', null, st3 === 'ok'
                    ? 'Picked from the live OpenRouter catalog.'
                    : 'Assigned by hand or in an earlier session.'),
                  ce('small', { style: { opacity: 0.7 } }, id),
                  stateNote(st3),
                  lm ? ce('small', { style: { opacity: 0.75 } },
                    'in ' + fmtPrice(lm.promptPrice) + ' / out ' + fmtPrice(lm.completionPrice) +
                    ' / ' + fmtContext(lm.contextLength)) : null
                )
              );
            })
          ),

          !all && badSlugs.length > 0 && ce('div', { className: 'aia-note err' },
            badSlugs.length + ' model ID' + (badSlugs.length === 1 ? '' : 's') +
            ' on this tier do not exist on OpenRouter and will fail: ' + badSlugs.join(', ') + '.'),

          !all && !checked && list.length > 0 && ce('div', { className: 'aia-note warn' },
            list.length + ' model ID' + (list.length === 1 ? '' : 's') + ' assigned here, none of them checked ' +
            'against OpenRouter yet. Load the live catalog before you trust this tier.'),

          !all && list.length === 0 && ce('div', { className: 'aia-note err' },
            tier === 'free'
              ? 'No models selected. Free students get the "the AI tutor is not switched on yet" screen - which is a setup message, not a paywall, and deliberately carries no upgrade prompt. Pick free models on the Models tab.'
              : 'No models selected - users on this tier cannot use AI at all.'),

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

  /* ---------------------------------------------------------------- bans ----
   * The ONLY permanent action in the whole app, and until now the only one with
   * no read-back and no undo anywhere in any UI: a misclick on the click-twice
   * ban button was unfixable outside the Firebase console.
   *
   * Both ban systems are written from files this module does not own
   * (MedMathTutor.html -> /bannedUsers, community.js -> /community/banned), but
   * both nodes are readable with the owner's credentials, so the read-back and
   * the remove live here.
   * ------------------------------------------------------------------------ */
  function BansCard(props) {
    var bans = props.bans || { status: 'idle', site: {}, community: {} };
    var userMeta = props.userMeta || {};
    var unban = props.unban, reload = props.reloadBans;

    var confirmState = useState('');
    var confirming = confirmState[0], setConfirming = confirmState[1];

    var rows = useMemo(function () {
      var out = [], uid, seen = {};
      function push(scope, id, rec) {
        var m = userMeta[id] || {};
        out.push({
          key: scope + ':' + id, scope: scope, uid: id,
          name: m.username || '(no profile)',
          email: m.email || id,
          reason: (rec && typeof rec === 'object' && rec.reason) ? rec.reason : '',
          at: (rec && typeof rec === 'object' && typeof rec.at === 'number') ? rec.at
            : (rec && typeof rec === 'object' && typeof rec.bannedAt === 'number') ? rec.bannedAt : 0
        });
        seen[scope + id] = true;
      }
      for (uid in bans.site) {
        if (!Object.prototype.hasOwnProperty.call(bans.site, uid)) continue;
        if (!bans.site[uid]) continue;
        push('site', uid, bans.site[uid]);
      }
      for (uid in bans.community) {
        if (!Object.prototype.hasOwnProperty.call(bans.community, uid)) continue;
        if (!bans.community[uid]) continue;
        push('community', uid, bans.community[uid]);
      }
      return out;
    }, [bans, userMeta]);

    return ce('div', { className: 'aia-card' + (rows.length ? ' warn' : '') },
      ce('div', { className: 'aia-row' },
        ce('p', { className: 'aia-h' }, 'Banned accounts'),
        ce('button', { type: 'button', className: 'btn btn-outline btn-sm', onClick: reload },
          bans.status === 'loading' ? 'Loading...' : 'Refresh')
      ),
      ce('p', { className: 'aia-desc' },
        'Site bans live at ', ce('span', { className: 'aia-code' }, '/bannedUsers'),
        ' and community bans at ', ce('span', { className: 'aia-code' }, '/community/banned'),
        '. Removing a ban takes effect immediately and does not restore anything that was deleted.'),

      bans.status === 'idle' && ce('div', { className: 'aia-empty' }, 'Not loaded yet.'),
      bans.status === 'loaded' && rows.length === 0 && ce('div', { className: 'aia-empty' },
        'Nobody is banned. Ban records show up here the moment one is written.'),

      ce('div', { className: 'aia-list', tabIndex: rows.length ? 0 : -1, role: 'region', 'aria-label': 'Banned accounts' },
        rows.map(function (r) {
          var armed = confirming === r.key;
          return ce('div', { className: 'aia-user', key: r.key },
            ce('div', { className: 'who' },
              ce('b', null, r.name),
              ce('small', null, r.email)
            ),
            ce('span', { className: 'aia-badge' }, r.scope === 'community' ? 'Community' : 'Site-wide'),
            r.at ? ce('small', { style: { color: 'var(--text3)' } }, fmtDate(r.at)) : null,
            armed
              ? ce('button', {
                  type: 'button', className: 'btn btn-primary btn-sm',
                  onClick: function () { setConfirming(''); unban(r.scope, r.uid); }
                }, 'Yes, unban ' + r.name)
              : ce('button', {
                  type: 'button', className: 'btn btn-outline btn-sm',
                  onClick: function () { setConfirming(r.key); }
                }, 'Unban'),
            armed ? ce('button', {
              type: 'button', className: 'btn btn-outline btn-sm',
              onClick: function () { setConfirming(''); }
            }, 'Cancel') : null,
            r.reason ? ce('div', { style: { flex: '1 1 100%' } },
              ce('small', { style: { color: 'var(--text3)' } }, 'Reason: ' + r.reason)) : null
          );
        })
      )
    );
  }

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

        ce('div', { className: 'aia-list', style: { marginTop: 12 },
          tabIndex: 0, role: 'region', 'aria-label': 'User list' },
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
              r.rec && r.rec.expiresAt ? ce('small', { style: { color: 'var(--orange-fg,var(--orange))', fontSize: 'var(--fs-xs,12px)' } },
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
                    style: { color: 'var(--red-fg,var(--red))' },
                    onClick: function () { apply(r.uid, 'free'); setExpiry(''); }
                  }, 'Reset to Free')
                ),
                r.rec && r.rec.grantedBy ? ce('p', { className: 'aia-desc' },
                  'Granted by ' + r.rec.grantedBy + (r.rec.grantedAt ? ' on ' + fmtDate(r.rec.grantedAt) : '')) : null
              )
            );
          })
        )
      ),

      ce(BansCard, {
        bans: props.bans, unban: props.unban, reloadBans: props.reloadBans, userMeta: userMeta
      })
    );
  }

  /* ==========================================================================
   * TAB: SPEND   (money first, calls second)
   * --------------------------------------------------------------------------
   * The Netlify function receives OpenRouter's real dollar cost on every call
   * and used to throw it away, so this tab could only ever show call COUNTS -
   * and 129 calls is either $0.00 or $18 depending on which model answered.
   * The server now writes an integer-microdollar ledger to /aiSpend/<day>; this
   * reads it back and puts a number, a ceiling and a name next to each other.
   * ======================================================================== */

  function SpendBars(props) {
    var rows = props.rows || [];
    var total = props.total || 0;
    if (!rows.length) return ce('div', { className: 'aia-empty' }, props.empty || 'Nothing recorded yet.');
    var max = Math.max.apply(null, rows.map(function (r) { return r.usd; }).concat([0.0000001]));
    return ce('div', null,
      rows.map(function (r) {
        var pctOfTotal = total > 0 ? Math.round((r.usd / total) * 100) : 0;
        return ce('div', { className: 'aia-srow', key: r.key },
          ce('span', { className: 'lbl' }, r.label),
          ce('span', { className: 'amt' }, fmtUsd(r.usd)),
          ce('span', { style: { color: 'var(--text3)', fontSize: 'var(--fs-xs,12px)', minWidth: 38, textAlign: 'right' } },
            pctOfTotal + '%'),
          ce('div', { className: 'bar' },
            ce('div', { className: 'aia-bar' },
              ce('i', { style: { width: Math.round((r.usd / max) * 100) + '%', background: r.color || 'var(--accent)' } })))
        );
      })
    );
  }

  /* ==========================================================================
   * SPEND: THE IMAGE CACHE
   * --------------------------------------------------------------------------
   * The cache is a money screen, which is why it lives here rather than next to
   * the routing controls. Every row in /imageCache is a picture that was paid
   * for exactly once, and every hit on one of those rows is a picture that was
   * NOT paid for. Both numbers come out of data that already exists: the index
   * itself, and the spend ledger above.
   * ======================================================================== */

  // Everything the ledger attributed to a picture-producing feature, all time.
  // /aiSpend/<day>/byFeature/<feature>6, in integer microdollars.
  function imageSpendUsd(days) {
    var total6 = 0, k, i, bf;
    if (!days || typeof days !== 'object') return 0;
    for (k in days) {
      if (!Object.prototype.hasOwnProperty.call(days, k)) continue;
      bf = days[k] && days[k].byFeature;
      if (!bf || typeof bf !== 'object') continue;
      for (i = 0; i < IMAGE_FEATURES.length; i++) {
        total6 += num6(bf[IMAGE_FEATURES[i] + '6']);
      }
    }
    return micro2usd(total6);
  }

  function ImageCacheCard(props) {
    var spend = props.spend || { status: 'idle', days: {} };

    var cacheState = useState({ status: 'idle', entries: {}, error: '' });
    var cache = cacheState[0], setCache = cacheState[1];

    var phraseState = useState('');
    var phrase = phraseState[0], setPhrase = phraseState[1];

    var clearState = useState({ busy: false, msg: '', ok: false });
    var clearing = clearState[0], setClearing = clearState[1];

    var aliveRef = useRef(true);
    useEffect(function () { return function () { aliveRef.current = false; }; }, []);

    var load = useCallback(function () {
      var im = images();
      if (!im || typeof im.listCache !== 'function') {
        setCache({ status: 'error', entries: {}, error: 'js/images.js is not loaded on this page.' });
        return;
      }
      setCache(function (p) { return { status: 'loading', entries: p.entries, error: '' }; });
      Promise.resolve(im.listCache()).then(function (res) {
        if (!aliveRef.current) return;
        if (res && res.ok) setCache({ status: 'loaded', entries: res.entries || {}, error: '' });
        else setCache({ status: 'denied', entries: {}, error: (res && res.error) ? res.error : 'permission denied' });
      }).catch(function (e) {
        if (!aliveRef.current) return;
        setCache({ status: 'denied', entries: {}, error: (e && e.message) ? e.message : 'permission denied' });
      });
    }, []);

    useEffect(function () { if (cache.status === 'idle') load(); }, [cache.status, load]);

    var derived = useMemo(function () {
      var entries = cache.entries || {};
      var count = 0, bytes = 0, hits = 0;
      var byFeature = {}, order = [];
      var h, rec, f;
      for (h in entries) {
        if (!Object.prototype.hasOwnProperty.call(entries, h)) continue;
        rec = entries[h];
        if (!rec || typeof rec !== 'object') continue;
        count++;
        var b = num6(rec.bytes);
        var ht = num6(rec.hits);
        bytes += b;
        hits += ht;
        f = (typeof rec.feature === 'string' && rec.feature) ? rec.feature : 'unattributed';
        if (!byFeature[f]) { byFeature[f] = { feature: f, n: 0, bytes: 0, hits: 0 }; order.push(f); }
        byFeature[f].n++;
        byFeature[f].bytes += b;
        byFeature[f].hits += ht;
      }
      var rows = order.map(function (k) { return byFeature[k]; });
      rows.sort(function (a, b2) { return b2.n - a.n; });

      var imgSpend = imageSpendUsd(spend.days);
      // Each cached row was generated exactly once, so total picture spend
      // divided by rows is the real average cost of one generation. It is only
      // meaningful once the ledger is readable AND something is cached.
      var avgGen = count > 0 ? imgSpend / count : 0;
      return {
        count: count, bytes: bytes, hits: hits, rows: rows,
        imgSpend: imgSpend, avgGen: avgGen, avoided: hits * avgGen
      };
    }, [cache.entries, spend.days]);

    var sess = null;
    var im0 = images();
    if (im0 && typeof im0.stats === 'function') {
      try { sess = im0.stats(); } catch (e) { sess = null; }
    }

    function doClear() {
      var im = images();
      if (!im || typeof im.clearCache !== 'function') return;
      setClearing({ busy: true, msg: '', ok: false });
      Promise.resolve(im.clearCache()).then(function (res) {
        if (!aliveRef.current) return;
        if (res && res.ok) {
          setClearing({ busy: false, ok: true,
            msg: 'Cleared. ' + res.removed + ' stored image' + (res.removed === 1 ? '' : 's') + ' deleted' +
              (res.storageFailed ? ', ' + res.storageFailed + ' could not be removed from Storage and are now orphaned blobs' : '') +
              '. Every one of them will be generated and billed again the next time it is asked for.' });
          setPhrase('');
          load();
        } else {
          setClearing({ busy: false, ok: false,
            msg: 'Could not clear the cache: ' + ((res && res.error) ? res.error : 'permission denied') });
        }
      }).catch(function (e) {
        if (!aliveRef.current) return;
        setClearing({ busy: false, ok: false,
          msg: 'Could not clear the cache: ' + ((e && e.message) ? e.message : 'unknown error') });
      });
    }

    var armed = phrase.trim().toUpperCase() === CLEAR_CACHE_PHRASE;

    return ce('div', { className: 'aia-card' },
      ce('div', { className: 'aia-row' },
        ce('p', { className: 'aia-h' }, 'Image cache'),
        ce('button', {
          type: 'button', className: 'btn btn-outline btn-sm',
          disabled: cache.status === 'loading', onClick: load
        }, cache.status === 'loading' ? 'Loading...' : 'Refresh')
      ),
      ce('p', { className: 'aia-desc' },
        'Every picture in the app is generated once, by whoever asks for it first, and then shared with every ' +
        'other student through /imageCache. These are the pictures nobody has to buy again.'),

      cache.status === 'denied' ? ce('div', null,
        ce('div', { className: 'aia-note err' },
          'Firebase said: ' + (cache.error || 'permission denied') + '. This does not fail loudly anywhere - it ' +
          'just means the shared index is invisible, so every student silently generates and pays for their own ' +
          'copy of every picture. Paste this into Firebase -> Realtime Database -> Rules:'),
        ce('div', { className: 'aia-pre' }, imageCacheRules())
      ) : null,

      cache.status === 'loaded' ? ce('div', null,
        ce('div', { className: 'stats-row', style: { marginTop: 10 } },
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, String(derived.count)),
            ce('div', { className: 'stat-label' }, 'Cached images')),
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, fmtBytes(derived.bytes)),
            ce('div', { className: 'stat-label' }, 'Stored')),
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, String(derived.hits)),
            ce('div', { className: 'stat-label' }, 'Cache hits')),
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value', style: { color: 'var(--green)' } }, fmtUsd(derived.avoided)),
            ce('div', { className: 'stat-label' }, 'Spend avoided'))
        ),

        ce('p', { className: 'aia-desc' },
          derived.count === 0
            ? 'Nothing is cached yet. The first student to open a mnemonic or a patient portrait will generate ' +
              'one, and from then on it is free for everybody.'
            : (derived.hits + ' hit' + (derived.hits === 1 ? '' : 's') + ' x ' + fmtUsd(derived.avgGen) +
               ' average generation cost = ' + fmtUsd(derived.avoided) + ' not spent. The average comes from the ' +
               'ledger above: ' + fmtUsd(derived.imgSpend) + ' of picture spend all time, across ' + derived.count +
               ' generated image' + (derived.count === 1 ? '' : 's') + '.')),

        spend.status === 'denied' && derived.count > 0 ? ce('div', { className: 'aia-note warn' },
          'The spend ledger is unreadable, so the average generation cost is $0 and "spend avoided" is ' +
          'understated to nothing. Fix the /aiSpend rule above and this number becomes real.') : null,

        derived.rows.length ? ce('div', { style: { marginTop: 12 } },
          ce('p', { className: 'aia-desc' }, 'By feature'),
          derived.rows.map(function (r) {
            return ce('div', { className: 'aia-srow', key: r.feature },
              ce('span', { className: 'lbl' }, r.feature),
              ce('span', { className: 'amt' }, r.n + ' img'),
              ce('small', { style: { color: 'var(--text3)', minWidth: 76, textAlign: 'right' } }, fmtBytes(r.bytes)),
              ce('small', { style: { color: 'var(--text3)', minWidth: 66, textAlign: 'right' } },
                r.hits + ' hit' + (r.hits === 1 ? '' : 's'))
            );
          })
        ) : null
      ) : null,

      sess ? ce('p', { className: 'aia-desc', style: { marginTop: 12 } },
        'This browser session: ' + sess.hits + ' served from cache, ' + sess.misses + ' missed, ' +
        sess.generated + ' generated' +
        (sess.uploadFailures ? ', ' + sess.uploadFailures + ' upload failure' + (sess.uploadFailures === 1 ? '' : 's') +
          ' (those images worked, they just could not be shared)' : '') +
        (sess.quotaBlocked ? '. The daily image cap has been hit, so nothing more will generate until midnight Eastern.' : '.')) : null,

      /* ---- the destructive bit, behind a sentence you have to mean ---- */
      ce('div', { style: { marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border,var(--surface2))' } },
        ce('p', { className: 'aia-h' }, 'Clear the cache'),
        ce('p', { className: 'aia-desc' },
          'This deletes all ' + derived.count + ' stored image' + (derived.count === 1 ? '' : 's') +
          ' and the whole shared index. Nothing is recoverable. Every picture will be GENERATED AGAIN and ' +
          'BILLED AGAIN the next time any student asks for it, and the pre-generate run has to be redone. ' +
          'Only do this if a prompt template or the routed model changed and the old pictures are wrong. ' +
          'Type ' + CLEAR_CACHE_PHRASE + ' below if you mean it.'),
        ce('div', { className: 'aia-run' },
          ce('input', {
            className: 'aia-input', style: { flex: '1 1 200px' }, type: 'text',
            placeholder: 'Type ' + CLEAR_CACHE_PHRASE + ' to confirm',
            'aria-label': 'Type ' + CLEAR_CACHE_PHRASE + ' to confirm clearing the image cache',
            value: phrase, onChange: function (e) { setPhrase(e.target.value); }
          }),
          ce('button', {
            type: 'button',
            className: 'btn btn-sm ' + (armed ? 'btn-primary' : 'btn-outline'),
            style: armed ? { background: 'var(--red)', borderColor: 'var(--red)' } : null,
            disabled: !armed || clearing.busy,
            onClick: doClear
          }, clearing.busy ? 'Clearing...' : 'Clear cache')
        ),
        clearing.msg ? ce('div', { className: 'aia-note ' + (clearing.ok ? 'ok' : 'err') }, clearing.msg) : null
      )
    );
  }

  function SpendTab(props) {
    var spend = props.spend || { status: 'idle', days: {}, error: '' };
    var usage = props.usage || {};
    var userMeta = props.userMeta || {};
    var userTiers = props.userTiers || {};
    var config = props.config || {};
    var loaded = props.loaded, reload = props.reload, reloadSpend = props.reloadSpend;
    var writeCfg = props.writeCfg, setUserTier = props.setUserTier;

    var today = todayKey();
    var cap = typeof config.softCapUsd === 'number' ? config.softCapUsd : DEFAULT_SOFT_CAP_USD;
    var blocking = config.capMode === 'block';

    var money = useMemo(function () {
      var days = spend.days || {};
      var d = days[today] || {};
      var todayUsd = micro2usd(num6(d.total6));
      var monthUsd = 0, allUsd = 0, k;
      var thisMonth = monthOf(today);
      for (k in days) {
        if (!Object.prototype.hasOwnProperty.call(days, k)) continue;
        var t6 = num6(days[k] && days[k].total6);
        allUsd += micro2usd(t6);
        if (monthOf(k) === thisMonth) monthUsd += micro2usd(t6);
      }

      function rowsFrom(obj, strip) {
        var out = [], key;
        if (!obj || typeof obj !== 'object') return out;
        for (key in obj) {
          if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
          var v = num6(obj[key]);
          if (!v) continue;
          out.push({ key: key, label: strip ? key.replace(/6$/, '') : key, usd: micro2usd(v) });
        }
        out.sort(function (a, b) { return b.usd - a.usd; });
        return out;
      }

      var users = [];
      var byUser = d.byUser || {};
      for (k in byUser) {
        if (!Object.prototype.hasOwnProperty.call(byUser, k)) continue;
        var rec = byUser[k] || {};
        var m = userMeta[k] || {};
        users.push({
          uid: k,
          usd: micro2usd(num6(rec.usd6)),
          n: num6(rec.n),
          tier: normTier(userTiers[k]),
          name: m.username || '(unknown)',
          email: m.email || k
        });
      }
      users.sort(function (a, b) { return b.usd - a.usd; });

      return {
        todayUsd: todayUsd,
        monthUsd: monthUsd,
        allUsd: allUsd,
        calls: num6(d.calls),
        byModel: rowsFrom(d.byModel, true),
        byFeature: rowsFrom(d.byFeature, true),
        users: users,
        hasAnyDay: Object.keys(days).length > 0
      };
    }, [spend.days, today, userMeta, userTiers]);

    // Call counts (the old Usage tab) still matter - they are the only signal
    // for free models, which cost nothing and therefore never touch the ledger.
    var calls = useMemo(function () {
      var byTier = { free: 0, plus: 0, pro: 0, instructor: 0 };
      var totalToday = 0, totalAll = 0, activeToday = 0;
      var uid, days, d, n, mine;
      for (uid in usage) {
        if (!Object.prototype.hasOwnProperty.call(usage, uid)) continue;
        days = usage[uid];
        if (!days || typeof days !== 'object') continue;
        mine = 0;
        for (d in days) {
          if (!Object.prototype.hasOwnProperty.call(days, d)) continue;
          // Tolerate both the scalar counter and a future object shape.
          n = typeof days[d] === 'number' ? days[d]
            : (days[d] && typeof days[d].n === 'number') ? days[d].n : 0;
          totalAll += n;
          if (d === today) mine += n;
        }
        totalToday += mine;
        if (mine > 0) activeToday++;
        var tier = normTier(userTiers[uid]);
        if (byTier[tier] == null) byTier[tier] = 0;
        byTier[tier] += mine;
      }
      return { byTier: byTier, totalToday: totalToday, totalAll: totalAll, activeToday: activeToday };
    }, [usage, userTiers, today]);

    var pct = cap > 0 ? Math.min(100, Math.round((money.todayUsd / cap) * 100)) : 0;
    var tone = cap > 0 && money.todayUsd >= cap ? 'over' : cap > 0 && pct >= 70 ? 'near' : 'ok';
    var pace = money.todayUsd / hoursElapsed() * 24;

    function setCap(raw) {
      var n = parseFloat(raw);
      if (!isFinite(n) || n < 0) return;
      writeCfg('softCapUsd', Math.round(n * 100) / 100);
    }

    return ce('div', null,

      /* ---- the number, and the ceiling to read it against ---- */
      ce('div', { className: 'aia-card ' + (tone === 'over' ? 'alert' : tone === 'near' ? 'warn' : 'ok') },
        ce('div', { className: 'aia-row' },
          ce('div', null,
            ce('div', { className: 'aia-money ' + tone }, fmtUsd(money.todayUsd)),
            ce('div', { style: { color: 'var(--text3)', fontSize: 'var(--fs-sm,13px)' } },
              'spent today (' + today + ') on ' + money.calls + ' billed call' + (money.calls === 1 ? '' : 's'))
          ),
          ce('div', { style: { textAlign: 'right' } },
            ce('span', { className: 'aia-badge' }, 'ceiling ' + fmtUsd(cap)),
            ce('div', { style: { marginTop: 8 } },
              ce('button', { type: 'button', className: 'btn btn-outline btn-sm', onClick: reloadSpend },
                spend.status === 'loading' ? 'Loading...' : 'Refresh'))
          )
        ),
        ce('div', { className: 'aia-bar tall' },
          ce('i', {
            style: {
              width: pct + '%',
              background: tone === 'over' ? 'var(--red)' : tone === 'near' ? 'var(--orange)' : 'var(--green)'
            }
          })),
        ce('p', { className: 'aia-desc' },
          tone === 'over'
            ? (blocking
                ? 'Over the ceiling. AI is BLOCKED for everyone except you until midnight Eastern.'
                : 'Over the ceiling. AI is still ON - this is a warning, not a brake. Switch the ceiling to "stop AI" below if you want it enforced.')
            : 'At this pace, about ' + fmtUsd(pace) + ' by midnight, and ' + fmtUsd(money.monthUsd) +
              ' so far this month (' + fmtUsd(money.allUsd) + ' all time).'),

        ce('div', { className: 'aia-nums', style: { marginTop: 12 } },
          ce('div', { className: 'aia-field' },
            ce('label', { htmlFor: 'aia-cap' }, 'Daily ceiling in US dollars'),
            ce('input', {
              id: 'aia-cap', className: 'aia-input', type: 'number', min: 0, step: 0.5,
              defaultValue: cap, key: 'cap-' + cap,
              onBlur: function (e) { setCap(e.target.value); },
              onKeyDown: function (e) { if (e.key === 'Enter') e.target.blur(); }
            })
          ),
          ce('div', { className: 'aia-field' },
            ce('label', null, 'What happens at the ceiling'),
            ce('div', { className: 'aia-pills' },
              ce('button', {
                type: 'button', className: 'aia-pill' + (blocking ? '' : ' on'),
                onClick: function () { writeCfg('capMode', 'warn'); }
              }, 'Just warn me'),
              ce('button', {
                type: 'button', className: 'aia-pill' + (blocking ? ' on' : ''),
                onClick: function () { writeCfg('capMode', 'block'); }
              }, 'Stop AI for the day')
            )
          )
        ),
        ce('p', { className: 'aia-desc' },
          blocking
            ? 'The server checks the ledger before every call. Once the day is over the ceiling, students get a plain "AI is paused for today, it comes back at midnight Eastern" message that does not blame them. You are never locked out.'
            : 'The ceiling is only reported here. Nothing stops spending until you switch this to "Stop AI for the day".')
      ),

      /* ---- is the ledger even recording? ---- */
      spend.status === 'denied' && ce('div', { className: 'aia-card alert' },
        ce('p', { className: 'aia-h' }, 'The spend ledger is unreadable'),
        ce('p', { className: 'aia-desc' },
          'Firebase said: ' + (spend.error || 'permission denied') + '. That is almost always a missing security ' +
          'rule rather than an outage - and it means the numbers above are not "nothing spent", they are ' +
          '"we cannot see". Paste this next to the existing aiUsage block in Firebase -> Realtime Database -> Rules:'),
        ce('div', { className: 'aia-pre' }, SPEND_RULES_SNIPPET)),

      spend.status === 'loaded' && !money.hasAnyDay && ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'No spend recorded yet'),
        ce('p', { className: 'aia-desc' },
          'Either nothing has been spent since the ledger went in, or every call so far ran on a free model ' +
          '(free models cost $0 and are never written here - watch the call counts below instead). ' +
          'If billed calls are happening and this stays empty, check the aiSpend rule in the card above.')),

      /* ---- where the money went ---- */
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Where the money went today'),
        ce('p', { className: 'aia-desc' }, 'By feature'),
        ce(SpendBars, { rows: money.byFeature, total: money.todayUsd,
          empty: 'No billed calls today.' }),
        ce('p', { className: 'aia-desc', style: { marginTop: 14 } }, 'By model'),
        ce(SpendBars, { rows: money.byModel, total: money.todayUsd,
          empty: 'No billed calls today.' })),

      /* ---- the money NOT spent ---- */
      ce(ImageCacheCard, { spend: spend }),

      /* ---- and who spent it ---- */
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Top spenders today'),
        money.users.length === 0 && ce('div', { className: 'aia-empty' },
          spend.status === 'denied' ? 'Not readable - fix the rule in the card above.'
            : spend.status === 'loaded' ? 'Nobody has spent anything today.'
            : 'Loading...'),
        ce('div', { className: 'aia-list', tabIndex: money.users.length ? 0 : -1, role: 'region',
          'aria-label': 'Top spenders today' },
          money.users.slice(0, 10).map(function (u) {
            var dominant = money.todayUsd > 0 && u.usd > money.todayUsd * 0.35;
            return ce('div', { className: 'aia-user', key: u.uid },
              ce('div', { className: 'who' },
                ce('b', null, u.name),
                ce('small', null, u.email)
              ),
              ce('span', { className: 'aia-badge', style: { color: TIER_COLOR[u.tier] } },
                TIER_LABEL[u.tier] || u.tier),
              ce('span', { style: { fontWeight: 700, minWidth: 72, textAlign: 'right' } }, fmtUsd(u.usd)),
              ce('small', { style: { color: 'var(--text3)' } }, u.n + ' call' + (u.n === 1 ? '' : 's')),
              dominant && u.tier !== 'free' && setUserTier ? ce('button', {
                type: 'button', className: 'btn btn-outline btn-sm',
                onClick: function () { setUserTier(u.uid, 'free', null); }
              }, 'Move to Free') : null
            );
          })
        )),

      /* ---- call counts: the only signal free models produce ---- */
      ce('div', { className: 'aia-card' },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'Calls - ' + today),
          ce('button', { type: 'button', className: 'btn btn-outline btn-sm', onClick: reload },
            loaded ? 'Refresh' : 'Loading...')
        ),
        ce('div', { className: 'stats-row', style: { marginTop: 10 } },
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, loaded ? String(calls.totalToday) : '--'),
            ce('div', { className: 'stat-label' }, 'Calls today')
          ),
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, loaded ? String(calls.activeToday) : '--'),
            ce('div', { className: 'stat-label' }, 'Active users')
          ),
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, loaded ? String(calls.totalAll) : '--'),
            ce('div', { className: 'stat-label' }, 'Calls all time')
          )
        ),
        !loaded && ce('p', { className: 'aia-desc' }, 'Reading /aiUsage...'),
        TIER_ORDER.map(function (t) {
          var v = calls.byTier[t] || 0;
          var p2 = calls.totalToday > 0 ? Math.round((v / calls.totalToday) * 100) : 0;
          return ce('div', { key: t, style: { marginTop: 10 } },
            ce('div', { className: 'aia-row', style: { fontSize: 'var(--fs-sm,13px)' } },
              ce('span', { style: { color: TIER_COLOR[t], fontWeight: 600 } }, TIER_LABEL[t]),
              ce('span', { style: { color: 'var(--text3)' } }, v + ' call' + (v === 1 ? '' : 's') + ' (' + p2 + '%)')
            ),
            ce('div', { className: 'aia-bar' },
              ce('i', { style: { width: p2 + '%', background: TIER_COLOR[t] } }))
          );
        }),
        ce('p', { className: 'aia-desc' },
          'Instructor and owner accounts are unlimited but they ARE metered now - their calls are the most ' +
          'likely to be expensive, so a dashboard that showed them as 0 was hiding the biggest line item.')
      )
    );
  }

  window.AIAdminPanel = AIAdminPanel;
})();
