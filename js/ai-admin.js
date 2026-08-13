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
  // Owner-typed per-model note. Bounded on the way in AND on the way out, so a
  // 10,000-character paste into Firebase cannot turn one row into a page.
  var META_NOTE_MAX = 200;

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

  /* ------------------------------------------------------- studio voices ---
   * Mirrors js/voice.js (PROFILE_ORDER, DEFAULT_TTS_MODEL) and
   * netlify/functions/tts.js (DEFAULT_VOICE_LIMITS, DEFAULT_USD_PER_1K_CHARS).
   * Only ever used as a FALLBACK - MM.voice is asked first everywhere below, so
   * the live module always wins and these cannot drift into being authoritative.
   * ------------------------------------------------------------------------ */
  var VOICE_PROFILE_ORDER = ['patient', 'nurse', 'instructor', 'child', 'family'];
  var VOICE_PROFILE_LABEL = {
    patient: 'Patient', nurse: 'Nurse', instructor: 'Instructor',
    child: 'Child', family: 'Family member'
  };
  // What each role is actually used for, so the owner is casting rather than
  // guessing from a one-word label.
  var VOICE_PROFILE_USE = {
    patient: 'Every scripted patient line in the 18 simulations, and the AI patient in conversation mode. Far and away the most heard voice in the app.',
    nurse: 'Handoff, SBAR playback and the med-admin trainer\'s prompts.',
    instructor: 'Debriefs, rationales and the AI tutor reading an explanation.',
    child: 'Peds scenarios. A voice that sounds like an adult doing a child impression is worse than the device voice.',
    family: 'Family-member lines in the simulations - usually the hardest, most emotional speech in the app.'
  };
  /* What a good cast looks like per role, scored against the LIVE catalog's
     own labels rather than hardcoded voice IDs. Hardcoding IDs is how the
     model slugs went stale; matching on metadata survives ElevenLabs adding,
     renaming or retiring voices. `want` scores +2 each, `avoid` scores -3,
     and a `category` of "premade" gets +1 as a stability tiebreak. */
  var VOICE_PROFILE_CAST = {
    patient:    { want: ['female', 'middle aged', 'american', 'calm', 'conversational'],
                  avoid: ['child', 'young', 'news', 'narration', 'british', 'australian'] },
    nurse:      { want: ['female', 'young', 'american', 'conversational', 'professional'],
                  avoid: ['child', 'elderly', 'narration'] },
    instructor: { want: ['male', 'middle aged', 'american', 'calm', 'narration', 'authoritative'],
                  avoid: ['child', 'young', 'excited'] },
    child:      { want: ['child', 'young', 'kid'],
                  avoid: ['middle aged', 'old', 'elderly', 'deep', 'narration'] },
    family:     { want: ['male', 'middle aged', 'american', 'conversational', 'emotional'],
                  avoid: ['child', 'narration', 'news'] }
  };

  /**
   * autoCast(voices) -> {profile: voiceId}
   * Greedy best-match, no voice used twice (five identical voices would defeat
   * the point). Any role with no positive-scoring candidate is left unset, so
   * it keeps using the device voice rather than being mis-cast.
   */
  /**
   * sanitizeVoiceCatalog(raw) -> [voice]
   *
   * Keeps only entries that can actually be rendered and assigned: an object
   * with a usable voice_id. Everything else - null, a string, a number, an
   * entry with no id - is dropped rather than allowed to reach a render
   * function. `labels` is normalized to an object so `v.labels.gender` is
   * always safe, and name/category are coerced to strings.
   *
   * A provider that adds a field is fine; a provider that returns one bad row
   * should cost that row, not the page.
   */
  function sanitizeVoiceCatalog(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [], seen = {};
    for (var i = 0; i < raw.length; i++) {
      var v = raw[i];
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      var id = String(v.voice_id || v.id || '').trim();
      if (!id || seen[id]) continue;
      seen[id] = true;
      var lab = (v.labels && typeof v.labels === 'object' && !Array.isArray(v.labels)) ? v.labels : {};
      out.push({
        voice_id: id,
        name: String(v.name || id),
        category: String(v.category || ''),
        description: typeof v.description === 'string' ? v.description : '',
        preview_url: typeof v.preview_url === 'string' ? v.preview_url : '',
        labels: {
          accent: String(lab.accent || ''),
          age: String(lab.age || ''),
          gender: String(lab.gender || ''),
          description: String(lab.description || ''),
          use_case: String(lab.use_case || lab.useCase || '')
        }
      });
    }
    return out;
  }

  function autoCast(voices) {
    var list = Array.isArray(voices) ? voices : [];
    var out = {}, taken = {};
    var order = ['child', 'patient', 'instructor', 'family', 'nurse']; // scarcest role first
    for (var i = 0; i < order.length; i++) {
      var role = order[i], spec = VOICE_PROFILE_CAST[role];
      if (!spec) continue;
      var best = null, bestScore = 0;
      for (var j = 0; j < list.length; j++) {
        var v = (list[j] && typeof list[j] === 'object') ? list[j] : {};
        var id = String(v.voice_id || v.id || '');
        if (!id || taken[id]) continue;
        var lab = (v.labels && typeof v.labels === 'object') ? v.labels : {};
        var hay = [v.name, v.category, v.description, lab.accent, lab.age,
                   lab.gender, lab.description, lab.use_case, lab.useCase]
                  .filter(function (x) { return typeof x === 'string'; })
                  .join(' ').toLowerCase();
        var score = 0, k;
        for (k = 0; k < spec.want.length; k++) if (hay.indexOf(spec.want[k]) !== -1) score += 2;
        for (k = 0; k < spec.avoid.length; k++) if (hay.indexOf(spec.avoid[k]) !== -1) score -= 3;
        if (String(v.category || '') === 'premade') score += 1;
        if (score > bestScore) { bestScore = score; best = id; }
      }
      if (best) { out[role] = best; taken[best] = true; }
    }
    return out;
  }

  var DEFAULT_TTS_MODEL = 'eleven_flash_v2_5';
  var DEFAULT_VOICE_LIMITS = { free: 0, plus: 0, pro: 20000, instructor: -1 };
  var DEFAULT_USD_PER_1K_CHARS = 0.22;
  var TTS_MODELS_FALLBACK = [
    { id: 'eleven_flash_v2_5', label: 'Flash v2.5', latency: '~75 ms', maxChars: 40000 },
    { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5', latency: '~250-300 ms', maxChars: 40000 },
    { id: 'eleven_multilingual_v2', label: 'Multilingual v2', latency: 'slowest', maxChars: 10000 }
  ];
  var VOICE_SPEND_PATH = 'voiceSpend';
  // How many days of the voice ledger the tab reads. Bounded so the panel never
  // pulls a year of history to render two numbers.
  var VOICE_SPEND_DAYS = 14;

  // Pasted verbatim into the Firebase rules editor. Surfaced in the Voices tab
  // because an unreadable /voiceCache does not fail loudly - it just silently
  // makes every student pay again for a line somebody already bought.
  var VOICE_CACHE_RULES = [
    '"voiceCache": {',
    '  ".read":  "auth != null",',
    '  ".write": "auth != null && auth.token.email === \'codingky@gmail.com\'",',
    '  ".indexOn": ["createdAt"],',
    '  "$hash": {',
    '    ".write":    "auth != null && (!data.exists() || auth.token.email === \'codingky@gmail.com\')",',
    '    ".validate": "newData.hasChildren([\'url\',\'voiceId\',\'modelId\'])",',
    '    "hits": { ".write": "auth != null" }',
    '  }',
    '}'
  ].join('\n');

  var VOICE_STORAGE_RULES = [
    'rules_version = \'2\';',
    'service firebase.storage {',
    '  match /b/{bucket}/o {',
    '    match /voice/{profile}/{name} {',
    '      allow read: if true;',
    '      allow write: if request.auth != null',
    '                   && request.resource.size < 4 * 1024 * 1024',
    '                   && request.resource.contentType == \'audio/mpeg\';',
    '    }',
    '  }',
    '}'
  ].join('\n');

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
      // --- ranking metadata: sort control, badges, inline editor, paste import ---
      '.aia-chip.health{background:var(--tint-accent,rgba(59,130,246,.16));color:var(--accent-fg,var(--accent));font-weight:700}',
      '.aia-chip.fit{background:var(--surface3,var(--surface2));color:var(--text2)}',
      '.aia-chip.guess{background:transparent;color:var(--text3);border:1px dashed var(--border-str,#475569)}',
      '.aia-sort{display:flex;gap:var(--sp-2,8px);align-items:center;flex-wrap:wrap;margin-top:10px}',
      '.aia-sort .lbl{font-size:var(--fs-xs,12px);color:var(--text3);font-weight:600}',
      '.aia-sortpills{display:flex;gap:var(--sp-1,4px);flex-wrap:wrap}',
      '.aia-sortpills .aia-pill{min-height:36px;padding:0 10px;font-size:var(--fs-xs,12px)}',
      '.aia-sortsel{display:none}',
      '.aia-medit{display:flex;gap:var(--sp-2,8px);flex-wrap:wrap;align-items:flex-end;margin-top:8px}',
      '.aia-medit label{display:block;font-size:var(--fs-xs,12px);color:var(--text3);font-weight:600;margin-bottom:4px}',
      '.aia-medit .aia-input{width:118px;padding:8px 10px}',
      '.aia-medit .hint{font-size:var(--fs-xs,12px);color:var(--text3);padding-bottom:12px}',
      '.aia-ta{width:100%;box-sizing:border-box;min-height:150px;resize:vertical;',
      'background:var(--bg);border:1px solid var(--border,var(--surface2));color:var(--text);',
      'border-radius:var(--r-sm,8px);padding:10px 12px;font-size:var(--fs-base,14px);',
      'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.5}',
      '.aia-ta:focus{outline:none;border-color:var(--accent);box-shadow:var(--ring,0 0 0 2px rgba(59,130,246,.25))}',
      '.aia-prow{display:grid;grid-template-columns:46px minmax(0,1fr) minmax(0,1.2fr);gap:8px;',
      'padding:7px 4px;border-bottom:1px solid var(--border,var(--surface2));',
      'font-size:var(--fs-sm,13px);align-items:baseline}',
      '.aia-prow:last-child{border-bottom:none}',
      '.aia-prow.head{color:var(--text3);font-weight:700;font-size:var(--fs-xs,12px)}',
      '.aia-prow .rk{font-weight:700;color:var(--text)}',
      '.aia-prow .nm{overflow-wrap:anywhere}',
      '.aia-prow .slug{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
      'font-size:var(--fs-xs,12px);color:var(--text2);word-break:break-all}',
      '.aia-prow .slug.miss{color:var(--orange-fg,var(--orange));font-family:inherit}',
      '@media (max-width:640px){',
      '.aia-sortpills{display:none}',
      '.aia-sortsel{display:block;flex:1 1 100%}',
      '.aia-prow{grid-template-columns:38px minmax(0,1fr)}',
      '.aia-prow .slug{grid-column:1 / -1;padding-left:38px}',
      '.aia-prow.head .slug{display:none}',
      '.aia-ta{font-size:16px}',
      '.aia-medit .aia-input{width:100%}',
      '.aia-medit .aia-field{flex:1 1 130px}',
      '}',
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
      '.aia-featid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--fs-xs,12px);',
      'color:var(--text3);overflow-wrap:anywhere}',
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
      /* --- voice picker -------------------------------------------------
       * A grid of cards rather than a <select>, because choosing a voice is a
       * listening task: every card carries its own preview button, and the
       * gender / age / accent labels have to be readable at a glance next to
       * the one that is currently assigned.
       * ------------------------------------------------------------------ */
      '.aia-vpick{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));',
      'gap:var(--sp-2,8px);margin-top:10px}',
      '.aia-vcard{border:1px solid var(--border,var(--surface2));border-radius:var(--r-md,10px);',
      'background:var(--bg);padding:10px;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.aia-vcard.on{border-color:var(--accent);background:var(--tint-accent,rgba(59,130,246,.10))}',
      '.aia-vcard b{font-size:var(--fs-base,14px);color:var(--text);overflow-wrap:anywhere}',
      '.aia-vcard .vid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
      'font-size:var(--fs-xs,12px);color:var(--text3);overflow-wrap:anywhere}',
      '.aia-vbtns{display:flex;gap:var(--sp-1,6px);flex-wrap:wrap;margin-top:auto;padding-top:6px}',
      '.aia-vgroup{font-size:var(--fs-xs,12px);font-weight:700;text-transform:uppercase;',
      'letter-spacing:.04em;color:var(--text3);margin-top:14px}',
      '.aia-spoken{font-size:var(--fs-sm,13px);line-height:var(--lh-normal,1.55);color:var(--text2);',
      'background:var(--bg);border:1px dashed var(--border-str,#475569);border-radius:var(--r-sm,8px);',
      'padding:9px 11px;margin-top:8px;overflow-wrap:anywhere}',
      '.aia-spoken b{color:var(--text);font-weight:700}',
      '@media (max-width:860px){.aia-mx{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      /* One narrow block, after the 860px one so the single-column matrix wins
       * the cascade at 360px. Everything phone-sized lives here. */
      '@media (max-width:640px){',
      '.aia-mx{grid-template-columns:1fr}',
      '.aia-vpick{grid-template-columns:1fr}',
      '.aia-select{font-size:16px}',
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

  /* js/voice.js, or null. Every voice feature below feature-detects it: the
     panel must still open on a page that loaded an older voice.js. */
  function voiceMod() {
    var v = (window.MM && window.MM.voice) ? window.MM.voice : null;
    return (v && typeof v.normalizeClinicalForTTS === 'function') ? v : null;
  }

  function ttsModels() {
    var v = voiceMod();
    if (v && Array.isArray(v.TTS_MODELS) && v.TTS_MODELS.length) return v.TTS_MODELS;
    return TTS_MODELS_FALLBACK;
  }

  function voiceProfileOrder() {
    var v = voiceMod();
    if (v && Array.isArray(v.PROFILE_ORDER) && v.PROFILE_ORDER.length) return v.PROFILE_ORDER;
    return VOICE_PROFILE_ORDER;
  }

  function voiceTestLine() {
    var v = voiceMod();
    if (v && typeof v.TEST_LINE === 'string' && v.TEST_LINE) return v.TEST_LINE;
    return 'BP 92/58, HR 118, SpO2 88% on 2 L. Temp 101.6 F. Give 0.25 mg IV push q4h PRN.';
  }

  /* The 172 scripted dialogue lines, defensively. js/voice.js builds this out of
     window.ALL_SCENARIOS, which may be absent or half-loaded on whatever page
     the panel happens to be open on, so it can throw and can hand back holes. */
  function dialogueItems() {
    var v = voiceMod();
    if (!v || typeof v.dialogueList !== 'function') return [];
    var list;
    try { list = v.dialogueList(); } catch (e) { return []; }
    if (!Array.isArray(list)) return [];
    var out = [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && typeof list[i] === 'object' && typeof list[i].text === 'string' && list[i].text) {
        out.push(list[i]);
      }
    }
    return out;
  }

  function fmtChars(n) {
    var v = (typeof n === 'number' && isFinite(n)) ? Math.round(n) : 0;
    if (v < 1000) return String(v);
    if (v < 1000000) return (v / 1000).toFixed(v < 10000 ? 1 : 0) + 'k';
    return (v / 1000000).toFixed(2) + 'M';
  }

  function voiceLimitPhrase(v) {
    if (typeof v !== 'number' || !isFinite(v)) return 'not set';
    if (v < -1) return 'invalid - use -1 for unlimited';
    if (v === -1) return 'unlimited';
    if (v === 0) return 'device voices only';
    return fmtChars(v) + ' characters a day (~' + Math.round(v / 165) + ' min of speech)';
  }

  /* The two fixed image sets, defensively. js/images.js builds this list out of
   * window.MEDADMIN_DRUGS and window.ALL_SCENARIOS, either of which may be
   * absent or half-loaded on the page the admin panel happens to be open on, so
   * it can throw, and it can hand back holes. -> [] when it cannot answer. */
  function fixedItems() {
    var im = images();
    if (!im || typeof im.fixedList !== 'function') return [];
    var list;
    try { list = im.fixedList(); } catch (e) { return []; }
    if (!Array.isArray(list)) return [];
    var out = [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && typeof list[i] === 'object' && typeof list[i].prompt === 'string' && list[i].prompt) {
        out.push(list[i]);
      }
    }
    return out;
  }

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

  // The floor under every other default. Kept as a function so a caller can
  // never mutate the shared object it just read.
  function builtinDefaults() {
    return {
      enabled: true, allowModelChoice: false,
      imageLimits: { free: 0, plus: 5, pro: 40, instructor: -1 },
      tiers: {
        free: { models: [], dailyLimit: 25, maxTokens: 1024 },
        plus: { models: [], dailyLimit: 200, maxTokens: 2048 },
        pro: { models: [], dailyLimit: 1000, maxTokens: 4096 },
        instructor: { models: ['*'], dailyLimit: -1, maxTokens: 8192 }
      }
    };
  }

  /* MM.ai owns the real defaults, but it is another file and it can be an older
   * build, a stub, or half-loaded. A DEFAULT_AI_CONFIG with no `tiers` used to
   * take the whole panel down inside mergeWithDefaults, which meant one bad
   * deploy of js/ai.js blanked the only screen that could fix it. Anything
   * missing falls back to the built-in floor instead. */
  function defaults() {
    var a = ai();
    var d = (a && a.DEFAULT_AI_CONFIG && typeof a.DEFAULT_AI_CONFIG === 'object' &&
             !Array.isArray(a.DEFAULT_AI_CONFIG)) ? a.DEFAULT_AI_CONFIG : null;
    var base = builtinDefaults();
    if (!d) return base;
    var out = {}, k;
    for (k in d) { if (Object.prototype.hasOwnProperty.call(d, k)) out[k] = d[k]; }
    if (!out.tiers || typeof out.tiers !== 'object' || Array.isArray(out.tiers)) out.tiers = base.tiers;
    if (!out.imageLimits || typeof out.imageLimits !== 'object' || Array.isArray(out.imageLimits)) {
      out.imageLimits = base.imageLimits;
    }
    if (typeof out.enabled !== 'boolean') out.enabled = base.enabled;
    return out;
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

  /* How /appConfig/aiConfig/imageLimits/<tier> actually behaves, in words.
   * ONLY -1 means unlimited: js/ai.js hands the raw number to the image quota
   * check, which blocks as soon as `used >= limit`, so -7 is not "seven fewer
   * than nothing" - it is zero pictures, forever. The panel used to print
   * "-7 pictures a day", which reads like an allowance and is the opposite of
   * what the server does with it. */
  function imageLimitPhrase(v) {
    if (typeof v !== 'number' || !isFinite(v)) return 'no pictures on this plan';
    if (v === -1) return 'unlimited pictures';
    if (v === 0) return 'no pictures on this plan';
    if (v < 0) return 'no pictures on this plan - ' + v + ' is not an allowance, only -1 means unlimited';
    return v + ' picture' + (v === 1 ? '' : 's') + ' a day';
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

  /* js/ai.js is a separate file and can be an older build, a stub, or a
   * half-loaded one. Everything it hands over is treated as untrusted input:
   * a null in KNOWN_FEATURES used to reach id.charAt() and take the whole
   * Routing tab down, and an AI_FEATURES label that was an object reached
   * React as a child and did the same. */
  function knownFeatures() {
    var a = ai();
    var raw = (a && Array.isArray(a.KNOWN_FEATURES)) ? a.KNOWN_FEATURES : null;
    if (!raw) return FEATURES_FALLBACK;
    var seen = {}, out = [], i, v;
    for (i = 0; i < raw.length; i++) {
      v = raw[i];
      if (typeof v !== 'string') continue;
      v = v.trim();
      if (!v || seen[v]) continue;
      seen[v] = true;
      out.push(v);
    }
    return out.length ? out : FEATURES_FALLBACK;
  }

  // Anything that is going to be rendered has to be a string by the time it
  // leaves this file, not "probably a string".
  function asText(v, fallback) {
    if (typeof v === 'string' && v) return v;
    if (typeof v === 'number' && isFinite(v)) return String(v);
    return fallback === undefined ? '' : fallback;
  }

  /** [{id, label, desc}] in KNOWN_FEATURES order, with the student-facing labels. */
  function featureRows() {
    var a = ai();
    var byId = {};
    var list = (a && Array.isArray(a.AI_FEATURES)) ? a.AI_FEATURES : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && typeof list[i] === 'object' && typeof list[i].id === 'string' && list[i].id) {
        byId[list[i].id] = list[i];
      }
    }
    return knownFeatures().map(function (id) {
      var f = byId[id];
      return {
        id: id,
        label: asText(f && f.label, FEATURE_LABEL_EXTRA[id] || (id.charAt(0).toUpperCase() + id.slice(1))),
        desc: asText(f && f.desc, '')
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
  var ROUTE_SOURCES = ['featureModels', 'tierDefault', 'default'];

  function previewRoute(config, tier, feature) {
    var t = config.tiers[tier] || {};
    var rules = { models: modelsOf(t), featureModels: featureModelsOf(t) };
    var a = ai();
    if (a && typeof a.resolveModelWith === 'function') {
      try {
        // Shape-checked, not trusted. This is another file's return value and
        // it is about to be dereferenced in a render; a null from an older
        // build of js/ai.js used to blank the whole Routing tab.
        var r = a.resolveModelWith(rules, feature, { isOwner: false, allowModelChoice: false });
        if (r && typeof r === 'object' && typeof r.model === 'string') {
          return {
            model: r.model,
            source: ROUTE_SOURCES.indexOf(r.source) !== -1 ? r.source : '',
            ignored: typeof r.ignored === 'string' ? r.ignored : ''
          };
        }
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

  /* ==========================================================================
   * RECOMMENDED SETUP  (the pure half - no React, no Firebase, no DOM)
   * --------------------------------------------------------------------------
   * WHY THIS EXISTS AT ALL, precisely:
   *
   *   Changing DEFAULT_AI_CONFIG in js/ai.js fixes nothing for an install that
   *   already has a config in Firebase. normalizeConfig() honours EXPLICIT
   *   stored tiers: the moment /appConfig/aiConfig/tiers/plus exists - even as
   *   `{models: []}` - that empty list is the answer, and the shipped default is
   *   never consulted. That is correct behaviour (an owner who deliberately
   *   empties a tier must not have it re-filled behind him) and it is exactly
   *   why "Plus has no models assigned" survives a deploy.
   *
   *   So the fix has to be a WRITE, and it has to be one the owner triggers and
   *   can see first. Hence: preview, confirm, one set().
   *
   * WHAT IS PRESERVED, and why those five and nothing else:
   *   enabled, allowModelChoice, softCapUsd, capMode, imageLimits.<tier>,
   *   tiers.<tier>.dailyLimit and tiers.<tier>.maxTokens.
   *   Those are the numbers the owner tunes against his own wallet and his own
   *   students. The recommendation has no opinion about them; it is about WHICH
   *   MODEL answers WHICH feature. Everything else - the model lists, the
   *   per-feature routes, the model metadata - is overwritten, and the
   *   confirmation says so in those words.
   * ======================================================================== */

  // Config nodes are plain JSON by construction (Firebase cannot store anything
  // else), so a structured clone is a stringify round trip. Returns null rather
  // than a half-copy if it ever is not.
  function jsonClone(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  /** MM.ai's recommended config, deep-copied, or null if js/ai.js is too old. */
  function recommendedConfig() {
    var a = ai();
    if (!a) return null;
    if (typeof a.getRecommendedConfig === 'function') {
      try {
        var got = a.getRecommendedConfig();
        if (got && typeof got === 'object' && !Array.isArray(got)) return got;
      } catch (e) { /* fall through */ }
    }
    if (a.RECOMMENDED_AI_CONFIG && typeof a.RECOMMENDED_AI_CONFIG === 'object' &&
        !Array.isArray(a.RECOMMENDED_AI_CONFIG)) {
      return jsonClone(a.RECOMMENDED_AI_CONFIG);
    }
    return null;
  }

  /** A short price for a slug, from MM.ai's verified snapshot. '' when unknown. */
  function modelPriceLabel(slug) {
    var a = ai();
    if (a && typeof a.priceLabel === 'function') {
      try {
        var s = a.priceLabel(slug);
        if (typeof s === 'string') return s;
      } catch (e) { /* noop */ }
    }
    return '';
  }

  /**
   * buildRecommendedWrite(current, rec) -> the exact object to set() at
   * /appConfig/aiConfig, or null if `rec` is unusable.
   *
   * Pure. `current` is the merged live config (mergeWithDefaults shape) and may
   * be null. Nothing is read from the DOM, MM, or Firebase.
   */
  function buildRecommendedWrite(current, rec) {
    var out = jsonClone(rec);
    if (!out || typeof out !== 'object' || Array.isArray(out)) return null;
    if (!out.tiers || typeof out.tiers !== 'object') out.tiers = {};
    // explicitTiers is a DERIVED field of js/ai.js normalizeConfig(). Writing it
    // back into Firebase would store a computed value as though it were input.
    if (Object.prototype.hasOwnProperty.call(out, 'explicitTiers')) delete out.explicitTiers;

    var cur = (current && typeof current === 'object' && !Array.isArray(current)) ? current : null;
    if (!cur) return out;

    // --- the owner's own numbers win ---
    if (typeof cur.enabled === 'boolean') out.enabled = cur.enabled;
    out.allowModelChoice = cur.allowModelChoice === true;
    if (typeof cur.softCapUsd === 'number' && isFinite(cur.softCapUsd) && cur.softCapUsd >= 0) {
      out.softCapUsd = cur.softCapUsd;
    }
    if (cur.capMode === 'block' || cur.capMode === 'warn') out.capMode = cur.capMode;

    var curLimits = (cur.imageLimits && typeof cur.imageLimits === 'object' && !Array.isArray(cur.imageLimits))
      ? cur.imageLimits : null;
    if (curLimits && out.imageLimits && typeof out.imageLimits === 'object') {
      for (var lk in out.imageLimits) {
        if (!Object.prototype.hasOwnProperty.call(out.imageLimits, lk)) continue;
        if (typeof curLimits[lk] === 'number' && isFinite(curLimits[lk])) {
          out.imageLimits[lk] = Math.floor(curLimits[lk]);
        }
      }
    }

    var curTiers = (cur.tiers && typeof cur.tiers === 'object' && !Array.isArray(cur.tiers)) ? cur.tiers : {};
    for (var tk in out.tiers) {
      if (!Object.prototype.hasOwnProperty.call(out.tiers, tk)) continue;
      var ct = (curTiers[tk] && typeof curTiers[tk] === 'object' && !Array.isArray(curTiers[tk]))
        ? curTiers[tk] : null;
      if (!ct) continue;
      if (typeof ct.dailyLimit === 'number' && isFinite(ct.dailyLimit)) out.tiers[tk].dailyLimit = ct.dailyLimit;
      if (typeof ct.maxTokens === 'number' && isFinite(ct.maxTokens) && ct.maxTokens > 0) {
        out.tiers[tk].maxTokens = ct.maxTokens;
      }
    }

    /* modelMeta is MERGED, not replaced: the owner may have ranked or annotated
       models the recommendation says nothing about, and an "apply the routing"
       button has no business deleting his notes. The recommended entries win on
       the slugs they cover. */
    var curMeta = (cur.modelMeta && typeof cur.modelMeta === 'object' && !Array.isArray(cur.modelMeta))
      ? cur.modelMeta : null;
    if (curMeta) {
      var merged = jsonClone(curMeta) || {};
      var recMeta = (out.modelMeta && typeof out.modelMeta === 'object') ? out.modelMeta : {};
      for (var mk in recMeta) {
        if (Object.prototype.hasOwnProperty.call(recMeta, mk)) merged[mk] = recMeta[mk];
      }
      out.modelMeta = merged;
    }
    if (typeof cur.modelMetaImportedAt === 'number' && isFinite(cur.modelMetaImportedAt) &&
        cur.modelMetaImportedAt > 0) {
      out.modelMetaImportedAt = cur.modelMetaImportedAt;
    }

    return out;
  }

  /**
   * recommendedPreview(current, next) -> what the write would change, per tier.
   * Model lists are compared as sets-in-order; feature routes are compared by
   * the model that would ACTUALLY run (previewRoute), not by what is configured,
   * because a route pointing outside the allow-list is not a route.
   */
  function recommendedPreview(current, next) {
    var cur = (current && current.tiers) ? current : { tiers: {} };
    var nxt = (next && next.tiers) ? next : { tiers: {} };
    var feats = featureRows();
    var changed = 0;

    var tiers = TIER_ORDER.map(function (t) {
      var before = modelsOf(cur.tiers[t]);
      var after = modelsOf(nxt.tiers[t]);
      var modelsChanged = before.join('|') !== after.join('|');
      if (modelsChanged) changed++;

      /* A tier with an EMPTY model list does not "run models[0]" - the server
       * throws 403 no-models-configured before it ever resolves one. So the
       * before-state for that tier is not a slug, it is nothing, and every
       * feature on it counts as changed. Rendering previewRoute()'s
       * DEFAULT_MODEL fallback as though it were the current behaviour would be
       * the single most misleading thing this preview could say. */
      var wasDead = before.length === 0;

      var rows = [];
      for (var i = 0; i < feats.length; i++) {
        var f = feats[i];
        var b = previewRoute(cur, t, f.id);
        var a2 = previewRoute(nxt, t, f.id);
        var row = {
          id: f.id,
          label: f.label,
          before: wasDead ? '' : (b.model || ''),
          after: a2.model || '',
          price: modelPriceLabel(a2.model),
          changed: wasDead || (b.model || '') !== (a2.model || '')
        };
        if (row.changed) changed++;
        rows.push(row);
      }

      /* Unchanged routes still need their price shown - "what does this cost"
       * is the whole question - but one line per feature would be 14 lines of
       * noise per tier. So they are grouped by the model they land on. */
      var unchangedRows = rows.filter(function (r) { return !r.changed; });
      var groups = [], byModel = {};
      for (var j = 0; j < unchangedRows.length; j++) {
        var m = unchangedRows[j].after;
        if (!byModel[m]) { byModel[m] = { model: m, price: modelPriceLabel(m), ids: [] }; groups.push(byModel[m]); }
        byModel[m].ids.push(unchangedRows[j].id);
      }

      return {
        tier: t,
        label: TIER_LABEL[t],
        before: before,
        after: after,
        wasDead: wasDead,
        modelsChanged: modelsChanged,
        rows: rows,
        changedRows: rows.filter(function (r) { return r.changed; }),
        unchangedGroups: groups
      };
    });

    return { tiers: tiers, changedCount: changed, unchanged: changed === 0 };
  }

  /** The values the write deliberately leaves alone, as display strings. */
  function recommendedKept(current) {
    var cur = (current && typeof current === 'object') ? current : {};
    var out = [
      'AI master switch: ' + (cur.enabled === false ? 'off' : 'on'),
      'Let users choose their model: ' + (cur.allowModelChoice === true ? 'on' : 'off'),
      'Daily ceiling: $' + (typeof cur.softCapUsd === 'number' ? cur.softCapUsd : DEFAULT_SOFT_CAP_USD) +
        ' (' + (cur.capMode === 'block' ? 'stop AI' : 'warn only') + ')'
    ];
    var tiersObj = (cur.tiers && typeof cur.tiers === 'object') ? cur.tiers : {};
    var limits = (cur.imageLimits && typeof cur.imageLimits === 'object') ? cur.imageLimits : {};
    for (var i = 0; i < TIER_ORDER.length; i++) {
      var t = TIER_ORDER[i];
      var ct = tiersObj[t] || {};
      out.push(TIER_LABEL[t] + ': ' +
        (typeof ct.dailyLimit === 'number'
          ? (ct.dailyLimit === -1 ? 'unlimited messages' : ct.dailyLimit + ' messages a day')
          : 'daily limit unset') +
        ', ' + imageLimitPhrase(limits[t]) +
        (typeof ct.maxTokens === 'number' ? ', max ' + ct.maxTokens + ' tokens' : ''));
    }
    return out;
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

    /* ---- live config ----
     * Owner-gated like everything else. A non-owner renders the "owner only"
     * card and nothing below it, so subscribing here would be a read nobody
     * ever looks at - and the panel should make ZERO calls it cannot use. */
    useEffect(function () {
      if (!isOwner) { setLoading(false); return; }
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
    }, [isOwner]);

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

    // `quiet` suppresses the per-write toast. A ranking import writes one path
    // per model, and ten "Saved." toasts in a row is noise, not feedback - the
    // caller reports the whole batch once instead. Failures are never quiet.
    /* Returns a promise of true|false so a caller that needs to know (the
     * recommended-setup apply, which reports one outcome for one big write) can
     * wait. It never REJECTS - the failure is already toasted here, and an
     * unhandled rejection from the twenty existing fire-and-forget callers would
     * be a worse bug than the one being fixed. */
    function writeCfg(path, value, quiet) {
      var d = db();
      if (!d) { toast('Firebase not connected.', 'error'); return Promise.resolve(false); }
      return d.ref(CFG_PATH + (path ? '/' + path : '')).set(value).then(function () {
        if (!quiet) toast('Saved.', 'success');
        return true;
      }).catch(function (e) {
        toast('Save failed: ' + (e && e.message ? e.message : 'permission denied'), 'error');
        return false;
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
         ['routing', 'Routing'], ['voices', 'Voices'], ['tiers', 'Tiers'],
         ['users', 'People']].map(function (t) {
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
      tab === 'voices' && ce(VoicesTab, { config: config, writeCfg: writeCfg }),
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

  function normalizeModelMeta(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (var k in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      var v = raw[k];
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      out[k] = {
        healthRank: (typeof v.healthRank === 'number' && isFinite(v.healthRank) && v.healthRank > 0)
          ? Math.round(v.healthRank) : null,
        params: (typeof v.params === 'number' && isFinite(v.params) && v.params > 0) ? v.params : null,
        note: typeof v.note === 'string' ? v.note.slice(0, META_NOTE_MAX) : ''
      };
    }
    return out;
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
      /* Owner-maintained per-model metadata (healthcare rank, parameters, note),
         keyed by slugKey(). js/ai.js normalizes the same node for the rest of the
         app; this copy exists so the Models tab updates the instant a write lands
         rather than on MM.ai's next config push. Same shape, same rules: a value
         that is not a positive finite number is null, never zero. */
      modelMeta: normalizeModelMeta(raw ? raw.modelMeta : null),
      modelMetaImportedAt: (raw && typeof raw.modelMetaImportedAt === 'number' &&
        isFinite(raw.modelMetaImportedAt) && raw.modelMetaImportedAt > 0) ? raw.modelMetaImportedAt : 0,
      /* ---- ElevenLabs studio voices (see the Voices tab) ------------------
       * MM.ai.getConfig() deliberately drops these - the text layer does not
       * enforce them and never will - so the Voices tab is the only place in
       * the app that reads them out of the merged config, and js/voice.js
       * reads /appConfig/aiConfig/voiceProfiles from Firebase directly. Kept
       * here so an assignment shows up the instant the write lands rather than
       * on the next full config push. */
      voiceEnabled: !(raw && raw.voiceEnabled === false),
      voiceProfiles: normalizeVoiceProfileCfg(raw ? raw.voiceProfiles : null),
      voiceLimits: {},
      voiceUsdPer1kChars: (raw && typeof raw.voiceUsdPer1kChars === 'number' &&
        isFinite(raw.voiceUsdPer1kChars) && raw.voiceUsdPer1kChars >= 0 && raw.voiceUsdPer1kChars < 100)
        ? raw.voiceUsdPer1kChars : DEFAULT_USD_PER_1K_CHARS,
      tiers: {}
    };
    var rawVLimits = (raw && raw.voiceLimits && typeof raw.voiceLimits === 'object' && !Array.isArray(raw.voiceLimits))
      ? raw.voiceLimits : null;
    var defLimits = (d && d.imageLimits && typeof d.imageLimits === 'object' && !Array.isArray(d.imageLimits))
      ? d.imageLimits : builtinDefaults().imageLimits;
    var defTiers = (d && d.tiers && typeof d.tiers === 'object' && !Array.isArray(d.tiers))
      ? d.tiers : builtinDefaults().tiers;
    var rawLimits = (raw && raw.imageLimits && typeof raw.imageLimits === 'object' && !Array.isArray(raw.imageLimits))
      ? raw.imageLimits : null;

    var i, name;
    for (i = 0; i < TIER_ORDER.length; i++) {
      name = TIER_ORDER[i];
      var dt = defTiers[name] || { models: [], dailyLimit: 0, maxTokens: 1024 };
      // A tier written as a string / number / array in Firebase is not a tier.
      var rtRaw = (raw && raw.tiers && typeof raw.tiers === 'object' && !Array.isArray(raw.tiers))
        ? raw.tiers[name] : null;
      var rt = (rtRaw && typeof rtRaw === 'object' && !Array.isArray(rtRaw)) ? rtRaw : null;

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

      var vlim = rawVLimits ? rawVLimits[name] : undefined;
      out.voiceLimits[name] = (typeof vlim === 'number' && isFinite(vlim))
        ? Math.floor(vlim)
        : (typeof DEFAULT_VOICE_LIMITS[name] === 'number' ? DEFAULT_VOICE_LIMITS[name] : 0);
    }
    return out;
  }

  /**
   * aiConfig.voiceProfiles, defensively. Same filter the Netlify function
   * applies on read (netlify/functions/tts.js normalizeVoiceProfiles), so what
   * this panel shows as assigned is what the server will actually send. A voice
   * id that would not survive there is shown as unassigned here rather than as
   * a working assignment that silently never speaks.
   */
  function normalizeVoiceProfileCfg(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    var k, id, v, voiceId;
    for (k in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      id = String(k == null ? '' : k).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
      if (!id || VOICE_PROFILE_ORDER.indexOf(id) === -1) continue;
      v = raw[k];
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      voiceId = String(v.voiceId || v.voice_id || '').trim();
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(voiceId)) continue;
      out[id] = {
        voiceId: voiceId,
        modelId: (typeof v.modelId === 'string' && v.modelId) ? v.modelId : DEFAULT_TTS_MODEL,
        name: (typeof v.name === 'string') ? v.name.slice(0, 80) : ''
      };
    }
    return out;
  }

  /* ==========================================================================
   * CARD: APPLY RECOMMENDED SETUP   (Settings tab, directly under the switch)
   * --------------------------------------------------------------------------
   * Three states and no others:
   *   idle     - one button, plus a one-line summary of what the setup is
   *   preview  - the full diff, tier by tier, with a Write button and a Cancel
   *   (gone)   - after a successful write the live listener re-renders every tab
   *
   * Nothing is written until the second button. The preview is computed from the
   * SAME pure functions the write uses, so what is shown is what lands.
   * ======================================================================== */

  function RecommendedSetupCard(props) {
    var config = props.config;
    var writeCfg = props.writeCfg;

    var openState = useState(false);
    var open = openState[0], setOpen = openState[1];
    var busyState = useState(false);
    var busy = busyState[0], setBusy = busyState[1];

    // Recomputed only when the live config changes. previewRoute() runs
    // 4 tiers x ~14 features twice, which is cheap but not free.
    var plan = useMemo(function () {
      var rec = recommendedConfig();
      if (!rec) return null;
      var next = buildRecommendedWrite(config, rec);
      if (!next) return null;
      return { next: next, diff: recommendedPreview(config, next), kept: recommendedKept(config) };
    }, [config]);

    if (!plan) {
      return ce('div', { className: 'aia-card warn' },
        ce('p', { className: 'aia-h' }, 'Apply recommended setup'),
        ce('p', { className: 'aia-desc' },
          'This needs a build of ', ce('span', { className: 'aia-code' }, 'js/ai.js'),
          ' that exports ', ce('span', { className: 'aia-code' }, 'RECOMMENDED_AI_CONFIG'),
          '. The loaded copy does not, so there is nothing to apply. Deploy the current js/ai.js and reopen this panel.')
      );
    }

    var diff = plan.diff;

    function doApply() {
      if (busy) return;
      setBusy(true);
      var done = function (ok) {
        setBusy(false);
        if (ok !== false) {
          setOpen(false);
          toast('Recommended setup applied. Every tab now reflects the new routing.', 'success');
        }
      };
      var r;
      try { r = writeCfg('', plan.next); } catch (e) { r = null; }
      if (r && typeof r.then === 'function') { r.then(done); }
      else { done(true); }   // older writeCfg returns nothing; it toasts its own result
    }

    /* ---- one tier's block: the model list, then only the routes that MOVE --- */
    function tierBlock(t) {
      return ce('div', {
        key: t.tier,
        style: { borderTop: '1px solid var(--border,var(--surface2))', paddingTop: 10, marginTop: 10 }
      },
        ce('div', { className: 'aia-tierhead' },
          ce('span', { style: { color: TIER_COLOR[t.tier], fontWeight: 700 } }, t.label),
          ce('span', { className: 'aia-badge', style: { color: 'var(--text3)' } },
            t.after.length === 1 && t.after[0] === '*'
              ? 'every model'
              : t.after.length + ' model' + (t.after.length === 1 ? '' : 's'))
        ),

        t.modelsChanged
          ? ce('div', { className: 'aia-eff' },
              t.wasDead
                ? ce('span', { style: { color: 'var(--orange-fg,var(--orange))' } },
                    'currently has NO models assigned, so every AI call from this tier is refused ' +
                    '(403, "no models have been assigned"). ')
                : ce('span', null, 'was ', ce('b', null, t.before.join(', ')), ' -- '),
              'becomes ', ce('b', null, t.after.join(', '))
            )
          : ce('div', { className: 'aia-eff' }, 'models unchanged: ', ce('b', null, t.after.join(', '))),

        t.changedRows.map(function (r) {
          return ce('div', { key: r.id, className: 'aia-eff' },
            ce('span', { className: 'aia-featid' }, r.id), ' ',
            ce('span', { style: { color: 'var(--text3)' } }, (r.before ? r.before : 'nothing runs') + ' -> '),
            ce('b', null, r.after),
            r.price ? ce('span', { className: 'price' }, '  ' + r.price) : null
          );
        }),

        t.unchangedGroups.map(function (g) {
          return ce('div', { key: 'u-' + g.model, className: 'aia-eff', style: { color: 'var(--text3)' } },
            'unchanged: ', g.ids.join(', '), ' -> ', ce('b', null, g.model),
            g.price ? ce('span', { className: 'price' }, '  ' + g.price) : null
          );
        }),

        (!t.changedRows.length && !t.unchangedGroups.length)
          ? ce('div', { className: 'aia-eff', style: { color: 'var(--text3)' } }, 'no routable features')
          : null
      );
    }

    return ce('div', { className: 'aia-card' + (diff.unchanged ? ' ok' : '') },
      ce('div', { className: 'aia-row' },
        ce('p', { className: 'aia-h' }, 'Apply recommended setup'),
        ce('button', {
          type: 'button',
          className: 'btn ' + (open ? 'btn-outline' : 'btn-primary') + ' btn-sm',
          disabled: busy,
          'aria-expanded': open ? 'true' : 'false',
          onClick: function () { setOpen(!open); }
        }, open ? 'Close preview' : (diff.unchanged ? 'Already applied' : 'Preview changes'))
      ),

      ce('p', { className: 'aia-desc' },
        'Routes every feature to ', ce('span', { className: 'aia-code' }, 'deepseek/deepseek-v4-flash-0731'),
        ' -- the #1 model on healthcare AND, at $0.08/$0.18 per 1M tokens, near the cheapest in the catalog. ' +
        'Graded feedback (debrief and SBAR) goes to GLM 5.2 on Pro and Instructor, because that is the one ' +
        'place a deeper model is worth 6x the output price. Pictures use Nano Banana on Plus (proven output ' +
        'shape) and FLUX.2 Klein 4B on Pro and Instructor (~$0.014 an image at 156ms -- the cheapest AND the ' +
        'fastest, which is not a combination that usually exists). Free gets the three verified free slugs.'),

      diff.unchanged
        ? ce('div', { className: 'aia-note ok' },
            'Your live config already matches the recommendation. Nothing would change.')
        : ce('p', { className: 'aia-desc' },
            ce('b', null, diff.changedCount + ' change' + (diff.changedCount === 1 ? '' : 's')),
            ' from your current config. Nothing is written until you confirm.'),

      open ? ce('div', null,
        ce('p', { className: 'aia-h', style: { marginTop: 14, fontSize: 'var(--fs-base,14px)' } },
          'What changes'),
        diff.tiers.map(tierBlock),

        ce('p', { className: 'aia-h', style: { marginTop: 16, fontSize: 'var(--fs-base,14px)' } },
          'What is kept exactly as you have it'),
        ce('ul', { className: 'aia-desc', style: { margin: '6px 0 0', paddingLeft: 18 } },
          plan.kept.map(function (line, i) { return ce('li', { key: i }, line); })),

        ce('div', { className: 'aia-note warn', style: { marginTop: 14 } },
          'Confirming overwrites, in one write to ', ce('span', { className: 'aia-code' }, '/appConfig/aiConfig'),
          ': the model list on every tier, every per-feature route on every tier, and the healthcare rank / ' +
          'note for the ten models named above. It does NOT touch your daily limits, image limits, spend ' +
          'ceiling, master switch, model-choice toggle, anyone\'s tier, or any model note you wrote for a ' +
          'model the recommendation says nothing about.'),

        ce('div', { className: 'aia-row', style: { marginTop: 12 } },
          ce('button', {
            type: 'button', className: 'btn btn-primary btn-sm', disabled: busy, onClick: doApply
          }, busy ? 'Writing...' : 'Write it'),
          ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm', disabled: busy,
            onClick: function () { setOpen(false); }
          }, 'Cancel')
        )
      ) : null
    );
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

      /* Second card on the first tab, deliberately. Code defaults cannot reach an
       * install that already has explicit tiers in Firebase, so this button is
       * the only thing that fixes "Plus has no models assigned". */
      ce(RecommendedSetupCard, { config: config, writeCfg: writeCfg }),

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
   * MODEL RANKING METADATA
   * --------------------------------------------------------------------------
   * OpenRouter publishes a healthcare leaderboard, but ONLY on openrouter.ai/
   * rankings: that page hydrates client-side, the served HTML contains no health
   * data at all, and the endpoints behind it are private. /api/v1/models - the
   * one public API - carries neither a ranking nor a parameter count. A scraper
   * for any of that would be worse than nothing, because it would keep
   * "succeeding" while quietly returning an empty list.
   *
   * So the ranking here is OWNER-MAINTAINED data, kept at
   *   aiConfig.modelMeta.<slugKey> = {healthRank, params, note}
   * filled either by pasting the leaderboard text (parsed below) or by typing a
   * number on a model row. Parameter counts fall back to what can be read out of
   * the model's own name ("Qwen3 235B"), and that fallback is always labelled as
   * a guess.
   *
   * The rule everywhere below: unknown stays unknown. No badge, sorted last,
   * and excluded from the score component it is missing. Nothing is invented.
   * ======================================================================== */

  // Firebase forbids . $ # [ ] / in a key, so a slug becomes its key form.
  function slugKey(id) {
    return String(id == null ? '' : id).replace(/[/.#$\[\]]/g, '_');
  }

  /** The owner-maintained map, live config first, MM.ai's copy as the fallback. */
  function modelMetaMap(config) {
    if (config && config.modelMeta && typeof config.modelMeta === 'object' && !Array.isArray(config.modelMeta)) {
      return config.modelMeta;
    }
    var a = ai();
    if (a && typeof a.getConfig === 'function') {
      try {
        var c = a.getConfig();
        if (c && c.modelMeta && typeof c.modelMeta === 'object') return c.modelMeta;
      } catch (e) { /* noop */ }
    }
    return {};
  }

  function metaFor(meta, id) {
    var rec = meta ? meta[slugKey(id)] : null;
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      return { healthRank: null, params: null, note: '' };
    }
    return {
      healthRank: (typeof rec.healthRank === 'number' && isFinite(rec.healthRank) && rec.healthRank > 0)
        ? Math.round(rec.healthRank) : null,
      params: (typeof rec.params === 'number' && isFinite(rec.params) && rec.params > 0) ? rec.params : null,
      // Bounded HERE as well as in normalizeModelMeta: this map can also come
      // from MM.ai's copy of the config, which this file did not normalize.
      note: typeof rec.note === 'string' ? rec.note.slice(0, META_NOTE_MAX) : ''
    };
  }

  function countHealthRanks(meta) {
    var n = 0, k;
    for (k in meta) {
      if (!Object.prototype.hasOwnProperty.call(meta, k)) continue;
      if (meta[k] && typeof meta[k].healthRank === 'number' && meta[k].healthRank > 0) n++;
    }
    return n;
  }

  /* Ranks that more than one model claims. Nothing enforces uniqueness - a
   * paste can match two slugs of the same family, and the inline editor will
   * happily accept "3" twice - and two models on rank 3 score identically for
   * the health half of the fit score, so the list silently sorts on a tie the
   * owner never intended. -> [{rank, n}] ascending, or []. */
  function duplicateHealthRanks(meta) {
    var byRank = {}, k, r, out = [], key;
    for (k in meta) {
      if (!Object.prototype.hasOwnProperty.call(meta, k)) continue;
      r = meta[k] && meta[k].healthRank;
      if (typeof r !== 'number' || !isFinite(r) || r <= 0) continue;
      r = Math.round(r);
      byRank[r] = (byRank[r] || 0) + 1;
    }
    for (key in byRank) {
      if (!Object.prototype.hasOwnProperty.call(byRank, key)) continue;
      if (byRank[key] > 1) out.push({ rank: parseInt(key, 10), n: byRank[key] });
    }
    out.sort(function (a, b) { return a.rank - b.rank; });
    return out;
  }

  function metaIsEmpty(meta) {
    var k;
    for (k in meta) {
      if (!Object.prototype.hasOwnProperty.call(meta, k)) continue;
      var r = meta[k];
      if (r && ((typeof r.healthRank === 'number' && r.healthRank > 0) ||
                (typeof r.params === 'number' && r.params > 0) ||
                (typeof r.note === 'string' && r.note))) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------ parseParams --
   * Parameter counts are not in the API, but they are usually written on the tin:
   * "Qwen3 235B A22B", "llama-3.3-70b-instruct", "Mixtral 8x7B". This reads that
   * and nothing else. A quantisation width ("4-bit", "fp8") is not a parameter
   * count, a version number ("GPT-5.4") is not a parameter count, and where there
   * is no count in the text the answer is null rather than a plausible number.
   * The largest match wins, so "235B A22B" (total / active) reports the total.
   * ------------------------------------------------------------------------ */

  // 8x7B and friends: a mixture-of-experts count, multiplied out.
  var PARAM_MOE_RE = /(?:^|[^a-z0-9])(\d{1,3})\s*x\s*(\d+(?:\.\d+)?)\s*b(?![a-z0-9])/gi;
  // 235B / 70b / 1.5B / (4B). The digits must not be preceded by a letter (so the
  // "22B" in "A22B" is skipped) and the B must end the token (so "4bit" is not a
  // 4-billion-parameter model).
  var PARAM_RE = /(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*b(?![a-z0-9])/gi;
  var PARAM_MAX_B = 100000;

  function scanParams(s) {
    if (s === null || s === undefined || s === '') return null;
    var str = String(s);
    var best = null, m, v;
    PARAM_MOE_RE.lastIndex = 0;
    while ((m = PARAM_MOE_RE.exec(str)) !== null) {
      v = parseFloat(m[1]) * parseFloat(m[2]);
      if (isFinite(v) && v > 0 && v <= PARAM_MAX_B && (best === null || v > best)) best = v;
    }
    PARAM_RE.lastIndex = 0;
    while ((m = PARAM_RE.exec(str)) !== null) {
      v = parseFloat(m[1]);
      if (isFinite(v) && v > 0 && v <= PARAM_MAX_B && (best === null || v > best)) best = v;
    }
    return best;
  }

  /** Billions of parameters read out of the display name, else the slug, else null. */
  function parseParams(name, slug) {
    var v = scanParams(name);
    if (v === null) v = scanParams(slug);
    return v;
  }

  function fmtParams(b) {
    if (typeof b !== 'number' || !isFinite(b) || b <= 0) return '';
    if (b >= 1000) return (b / 1000).toFixed(b % 1000 === 0 ? 0 : 1) + 'T';
    if (b >= 10) return String(Math.round(b)) + 'B';
    return String(Math.round(b * 10) / 10) + 'B';
  }

  /* ------------------------------------------------------------- fit score ---
   * A rough guide, and it says so on the screen. Three components, all of them
   * visible in the tooltip, none of them a benchmark:
   *   healthcare rank  up to 50   rank 1 = 50, each place down keeps 90%
   *   price            up to 30   cheapest in the loaded catalog = 30, log scale
   *   context          up to 20   4K = 0 up to 128K = 20, log scale, capped
   * An unranked model scores 0 for health rather than an average or a guess, so
   * the score of an unranked model is never inflated by data that does not exist.
   * ------------------------------------------------------------------------ */

  var FIT_RANK_DECAY = 0.9;
  var FIT_CTX_LO = 4000;
  var FIT_CTX_HI = 128000;

  var FIT_EXPLAIN = [
    'Healthcare rank - up to 50 points. Rank 1 scores 50 and each place further down keeps 90% of the one above ' +
      '(rank 2 = 45, rank 5 = 33, rank 10 = 19). A model you have not ranked scores 0 here; it is never averaged ' +
      'or guessed.',
    'Price - up to 30 points. The cheapest model in the loaded catalog scores 30 and the most expensive scores 0, ' +
      'on a log scale, using the price for the modality you are looking at. A model with no listed price scores 0.',
    'Context length - up to 20 points, log scale from 4K (0 points) to 128K (20 points). Anything above 128K is ' +
      'capped, because past that point it stops mattering for a tutor message.'
  ];

  /** The price used for sorting and scoring: per token for text, per unit otherwise. */
  function effPrice(m, modality) {
    if (!m) return null;
    if (normModality(modality) === 'text') {
      var p = parseFloat(m.promptPrice);
      var c = parseFloat(m.completionPrice);
      if (!isFinite(p) && !isFinite(c)) return null;
      return (isFinite(p) ? p : 0) + (isFinite(c) ? c : 0);
    }
    return unitPriceOf(m);
  }

  /** {lo, hi} over the positive prices in a list - free models are not a bound. */
  function priceBoundsOf(models, modality) {
    var lo = null, hi = null, i, v;
    for (i = 0; i < models.length; i++) {
      v = effPrice(models[i], modality);
      if (typeof v !== 'number' || !isFinite(v) || v <= 0) continue;
      if (lo === null || v < lo) lo = v;
      if (hi === null || v > hi) hi = v;
    }
    return { lo: lo, hi: hi };
  }

  function fitParts(rank, price, ctx, bounds) {
    var health = 0;
    if (typeof rank === 'number' && isFinite(rank) && rank >= 1) {
      health = 50 * Math.pow(FIT_RANK_DECAY, rank - 1);
    }

    var money = 0;
    if (typeof price === 'number' && isFinite(price) && price >= 0) {
      if (price === 0) {
        money = 30;
      } else {
        var lo = (bounds && typeof bounds.lo === 'number' && bounds.lo > 0) ? bounds.lo : price;
        var hi = (bounds && typeof bounds.hi === 'number' && bounds.hi > lo) ? bounds.hi : lo;
        if (hi <= lo) {
          money = 30;
        } else {
          var p = Math.min(Math.max(price, lo), hi);
          var t = (Math.log(p) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
          if (!isFinite(t)) t = 0;
          money = 30 * (1 - t);
        }
      }
    }

    var context = 0;
    if (typeof ctx === 'number' && isFinite(ctx) && ctx > FIT_CTX_LO) {
      var c = Math.min(ctx, FIT_CTX_HI);
      context = 20 * ((Math.log(c) - Math.log(FIT_CTX_LO)) / (Math.log(FIT_CTX_HI) - Math.log(FIT_CTX_LO)));
    }

    var total = Math.round(health + money + context);
    if (total < 0) total = 0;
    if (total > 100) total = 100;
    return { health: health, price: money, context: context, total: total };
  }

  /* ---------------------------------------------------------------- sorting */

  var SORT_KEYS = [
    { id: 'fit', label: 'MedMaster fit', dir: -1 },
    { id: 'health', label: 'Healthcare rank', dir: 1 },
    { id: 'params', label: 'Parameters', dir: -1 },
    { id: 'price', label: 'Price', dir: 1 },
    { id: 'context', label: 'Context', dir: -1 },
    { id: 'name', label: 'Name', dir: 1 }
  ];

  function sortDefaultDir(key) {
    for (var i = 0; i < SORT_KEYS.length; i++) {
      if (SORT_KEYS[i].id === key) return SORT_KEYS[i].dir;
    }
    return -1;
  }

  function sortLabel(key) {
    for (var i = 0; i < SORT_KEYS.length; i++) {
      if (SORT_KEYS[i].id === key) return SORT_KEYS[i].label;
    }
    return key;
  }

  function cmpName(a, b) {
    var an = String(a.name || a.id || '').toLowerCase();
    var bn = String(b.name || b.id || '').toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  }

  function sortValue(row, key) {
    if (key === 'health') return (typeof row.rank === 'number') ? row.rank : null;
    if (key === 'params') return (typeof row.params === 'number') ? row.params : null;
    if (key === 'price') return (typeof row.price === 'number') ? row.price : null;
    if (key === 'context') return (typeof row.ctx === 'number' && row.ctx > 0) ? row.ctx : null;
    if (key === 'fit') return (typeof row.fit === 'number') ? row.fit : null;
    return null;
  }

  /**
   * Rows: {id, name, rank, params, price, ctx, fit}. Anything unknown is null and
   * lands at the BOTTOM in both directions - an unranked model is never
   * interleaved with the ranked ones just because the sort was reversed.
   */
  function sortRows(rows, key, dir) {
    var d = dir === -1 ? -1 : 1;
    var out = rows.slice();
    out.sort(function (a, b) {
      if (key === 'name') return cmpName(a, b) * d;
      var av = sortValue(a, key), bv = sortValue(b, key);
      var au = (av === null), bu = (bv === null);
      if (au && bu) return cmpName(a, b);
      if (au) return 1;
      if (bu) return -1;
      if (av === bv) return cmpName(a, b);
      return (av < bv ? -1 : 1) * d;
    });
    return out;
  }

  var SORT_LS_KEY = 'mm.aiadmin.modelSort';

  function readSortPref() {
    try {
      var raw = window.localStorage.getItem(SORT_LS_KEY);
      if (raw) {
        var v = JSON.parse(raw);
        if (v && typeof v.key === 'string') {
          for (var i = 0; i < SORT_KEYS.length; i++) {
            if (SORT_KEYS[i].id === v.key) {
              return { key: v.key, dir: v.dir === 1 ? 1 : v.dir === -1 ? -1 : SORT_KEYS[i].dir };
            }
          }
        }
      }
    } catch (e) { /* private mode, quota, whatever - a sort order is not worth an error */ }
    return { key: 'fit', dir: -1 };
  }

  function writeSortPref(s) {
    try { window.localStorage.setItem(SORT_LS_KEY, JSON.stringify({ key: s.key, dir: s.dir })); }
    catch (e) { /* noop */ }
  }

  /* ---------------------------------------------------- paste-import parser --
   * What openrouter.ai/rankings puts on the clipboard, one field per line:
   *     1.
   *     DeepSeek V4 Flash 0731
   *     by
   *     deepseek
   *     10T tokens
   *     191%
   * and the single-line shape some browsers produce instead:
   *     1. DeepSeek V4 Flash 0731 by deepseek
   * Token counts and percentages are statistics, not names, so they are dropped.
   * ------------------------------------------------------------------------ */

  var RANK_DOT_RE = /^#?\s*(\d{1,3})\s*[.)]\s*(.*)$/;
  var RANK_BARE_RE = /^#?\s*(\d{1,3})\s*$/;
  var BY_RE = /^by$/i;
  var PCT_RE = /^[+-]?[\d.,]+\s*%$/;
  var STAT_RE = /^[\d.,]+\s*[kmbt]?\s*(tokens?|prompts?|apps?|users?|requests?|completions?)\b/i;

  function stripStats(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[\d.,]+\s*[KMBT]?\s*tokens?\b/gi, ' ')
      .replace(/[+-]?[\d.,]+\s*%/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Fills name (and author when the text carries "... by <author>"). */
  function applyEntryText(entry, text) {
    var t = String(text || '').trim();
    if (!t) return false;
    if (/\sby$/i.test(t)) {          // "Name by" with the author on the next line
      entry.name = t.replace(/\sby$/i, '').trim();
      return true;
    }
    var low = t.toLowerCase();
    var idx = low.lastIndexOf(' by ');
    if (idx > 0) {
      entry.name = t.slice(0, idx).trim();
      entry.author = stripStats(t.slice(idx + 4));
      return false;
    }
    entry.name = t;
    return false;
  }

  /* A leaderboard is a leaderboard, not a document. Someone pasting the whole
   * rankings page (or a whole browser tab) must not be able to queue up an
   * unbounded number of Firebase writes behind one button, and a preview nobody
   * can read to the bottom is not a preview. Everything past this is dropped,
   * and the card says so rather than truncating quietly. */
  var MAX_RANK_ENTRIES = 200;

  /** -> [{rank, name, author}] in paste order, first entry per rank wins. */
  function parseRankingPaste(text) {
    var lines = String(text === null || text === undefined ? '' : text)
      .replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').split('\n');
    var out = [], cur = null, expectAuthor = false, lastRank = 0;

    function flush() {
      if (cur && cur.name) { out.push(cur); lastRank = cur.rank; }
      cur = null;
      expectAuthor = false;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      var rk = RANK_DOT_RE.exec(line);
      var bare = rk ? null : RANK_BARE_RE.exec(line);
      // A bare number is only a rank when it continues the sequence. Otherwise
      // "191" under a leaderboard row is a statistic, not a new entry.
      if (bare && !(!expectAuthor && parseInt(bare[1], 10) === lastRank + 1)) bare = null;

      if (rk || bare) {
        flush();
        cur = { rank: parseInt((rk || bare)[1], 10), name: '', author: '' };
        var rest = rk ? stripStats(rk[2]) : '';
        if (rest) expectAuthor = applyEntryText(cur, rest);
        continue;
      }
      if (!cur) continue;                       // header junk before the first rank
      if (BY_RE.test(line)) { expectAuthor = true; continue; }
      if (expectAuthor) { cur.author = stripStats(line); expectAuthor = false; continue; }
      if (PCT_RE.test(line) || STAT_RE.test(line)) continue;
      if (!cur.name) { expectAuthor = applyEntryText(cur, stripStats(line)); }
    }
    flush();

    var seen = {}, uniq = [];
    for (var j = 0; j < out.length && uniq.length < MAX_RANK_ENTRIES; j++) {
      if (seen[out[j].rank]) continue;
      seen[out[j].rank] = true;
      uniq.push(out[j]);
    }
    return uniq;
  }

  /* -------------------------------------------------------------- matching --
   * Pasted "DeepSeek V4 Flash 0731 / deepseek" has to become the slug
   * deepseek/deepseek-v4-flash-0731. Both sides are flattened to letters and
   * digits, the author (when the paste gave one) must agree with the part of the
   * slug before the slash, and the name is compared against the display name,
   * the display name after "Vendor:", and the slug tail. Exact beats prefix beats
   * contains; a variant slug (":free", ":thinking") loses to the plain one. No
   * match is reported as no match - never as the nearest thing.
   * ------------------------------------------------------------------------ */

  function normKey(s) {
    return String(s === null || s === undefined ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function authorOfSlug(id) {
    var s = String(id || '');
    var i = s.indexOf('/');
    return i === -1 ? '' : s.slice(0, i);
  }

  function modelNameKeys(m) {
    var out = [];
    var n = String((m && m.name) || '');
    if (n) {
      out.push(normKey(n));
      var ci = n.indexOf(':');
      if (ci !== -1) out.push(normKey(n.slice(ci + 1)));
    }
    var id = String((m && m.id) || '');
    var si = id.indexOf('/');
    var tail = si === -1 ? id : id.slice(si + 1);
    out.push(normKey(tail));
    var vi = tail.indexOf(':');
    if (vi !== -1) out.push(normKey(tail.slice(0, vi)));
    return out;
  }

  function matchRankEntry(entry, models) {
    var want = normKey(entry && entry.name);
    if (!want || !models || !models.length) return null;
    var wantAuthor = normKey(entry.author);
    var best = null, bestScore = 0, i, j;

    for (i = 0; i < models.length; i++) {
      var m = models[i];
      if (!m || !m.id) continue;
      var author = normKey(authorOfSlug(m.id));
      if (wantAuthor && author) {
        if (author !== wantAuthor &&
            author.indexOf(wantAuthor) !== 0 &&
            wantAuthor.indexOf(author) !== 0) continue;
      }
      var keys = modelNameKeys(m);
      var score = 0;
      for (j = 0; j < keys.length; j++) {
        var k = keys[j];
        if (!k) continue;
        if (k === want) { score = Math.max(score, 100); continue; }
        // Too short to be evidence of anything. "v4" contains-matching half the
        // catalog is how a wrong rank gets written.
        if (k.length < 4 || want.length < 4) continue;
        if (k.indexOf(want) === 0 || want.indexOf(k) === 0) score = Math.max(score, 80);
        else if (k.indexOf(want) !== -1 || want.indexOf(k) !== -1) score = Math.max(score, 60);
      }
      if (!score) continue;
      // Prefer the tightest name and the plain slug over a ":free"/":thinking" variant.
      score -= Math.min(9, Math.abs(normKey(m.id).length - want.length) / 4);
      if (String(m.id).indexOf(':') !== -1) score -= 5;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best ? { slug: best.id, name: best.name, score: bestScore } : null;
  }

  /**
   * Preview rows for the import: [{rank, pasted, author, slug, matchedName, why}].
   * `slug` null means nothing will be written for that line. A slug already
   * claimed by a better rank is reported as a duplicate rather than overwritten.
   */
  function buildImportPreview(entries, models) {
    var claimed = {}, rows = [], i;
    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      var hit = matchRankEntry(e, models);
      var row = {
        rank: e.rank, pasted: e.name, author: e.author,
        slug: null, matchedName: '', why: 'no match in the loaded catalog'
      };
      if (hit) {
        if (claimed[hit.slug]) {
          row.why = 'already matched by #' + claimed[hit.slug];
        } else {
          claimed[hit.slug] = e.rank;
          row.slug = hit.slug;
          row.matchedName = hit.name || '';
          row.why = '';
        }
      }
      rows.push(row);
    }
    return rows;
  }

  /** Writes healthRank for every matched row. Returns how many were written. */
  function applyRankImport(rows, write, now) {
    var n = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || !r.slug || typeof r.rank !== 'number' || !isFinite(r.rank) || r.rank < 1) continue;
      write('modelMeta/' + slugKey(r.slug) + '/healthRank', Math.round(r.rank), true);
      n++;
    }
    if (n) write('modelMetaImportedAt', typeof now === 'number' ? now : Date.now(), true);
    return n;
  }

  function clearHealthRanks(meta, write) {
    var n = 0, k;
    for (k in meta) {
      if (!Object.prototype.hasOwnProperty.call(meta, k)) continue;
      // These keys come out of Firebase, and this one is being pasted straight
      // into a write path. A key carrying a '/' would clear a node nobody
      // asked about; Firebase cannot store one, so it can only be junk.
      if (!k || /[/.#$\[\]]/.test(k)) continue;
      if (meta[k] && typeof meta[k].healthRank === 'number' && meta[k].healthRank > 0) {
        write('modelMeta/' + k + '/healthRank', null, true);
        n++;
      }
    }
    if (n) write('modelMetaImportedAt', null, true);
    return n;
  }

  /* A DATED SNAPSHOT, not a live feed. It is what openrouter.ai/rankings showed
   * for healthcare in August 2026 and it will go stale; the paste-import above is
   * the way to refresh it, and the button says so. */
  var SEED_SNAPSHOT_LABEL = 'August 2026';
  var SEED_HEALTH_RANKS = [
    { slug: 'deepseek/deepseek-v4-flash-0731', rank: 1 },
    { slug: 'google/gemini-3.1-flash-lite', rank: 2 },
    { slug: 'deepseek/deepseek-v4-flash', rank: 3 },
    { slug: 'z-ai/glm-5.2', rank: 4 },
    { slug: 'google/gemini-3-flash-preview', rank: 5 }
  ];

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

    // Sort order survives a reload: this is a per-device viewing preference, not
    // shared state, so localStorage is the right home for it and a failed read
    // just means the default.
    var sortState = useState(readSortPref);
    var sort = sortState[0], setSort = sortState[1];

    var editState = useState(false);
    var editMeta = editState[0], setEditMeta = editState[1];

    var fitOpenState = useState(false);
    var fitOpen = fitOpenState[0], setFitOpen = fitOpenState[1];

    function chooseSort(key) {
      setSort(function (prev) {
        var next = { key: key, dir: prev.key === key ? prev.dir : sortDefaultDir(key) };
        writeSortPref(next);
        return next;
      });
    }

    function flipSort() {
      setSort(function (prev) {
        var next = { key: prev.key, dir: prev.dir === 1 ? -1 : 1 };
        writeSortPref(next);
        return next;
      });
    }

    // Clicking the header you are already sorted by reverses it, the way a table
    // header does everywhere else.
    function pickSort(key) {
      if (sort.key === key) flipSort(); else chooseSort(key);
    }

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

    /* ---- ranking metadata, parameters, fit score, sort ----
     * meta is what YOU have recorded; everything else on the row is either from
     * OpenRouter or explicitly marked as read off the model's name. */
    var meta = useMemo(function () { return modelMetaMap(config); }, [config]);

    // Price bounds come from the WHOLE loaded catalog, not the filtered view, so
    // the price component of a score does not change as you type in the search box.
    var bounds = useMemo(function () {
      return priceBoundsOf(live.models, modality);
    }, [live.models, modality]);

    var rows = useMemo(function () {
      var out = [], i;
      for (i = 0; i < filtered.length; i++) {
        var m = filtered[i];
        var mt = metaFor(meta, m.id);
        var parsed = mt.params === null ? parseParams(m.name, m.id) : null;
        var price = effPrice(m, modality);
        var ctx = (typeof m.contextLength === 'number' && isFinite(m.contextLength) && m.contextLength > 0)
          ? m.contextLength : 0;
        var parts = fitParts(mt.healthRank, price, ctx, bounds);
        out.push({
          id: m.id, name: m.name || m.id, m: m,
          rank: mt.healthRank,
          params: mt.params !== null ? mt.params : parsed,
          paramsFrom: mt.params !== null ? 'meta' : (parsed !== null ? 'name' : ''),
          note: mt.note,
          price: price, ctx: ctx, fit: parts.total, parts: parts
        });
      }
      return out;
    }, [filtered, meta, modality, bounds]);

    var sorted = useMemo(function () {
      return sortRows(rows, sort.key, sort.dir);
    }, [rows, sort.key, sort.dir]);

    var rankedShown = useMemo(function () {
      var n = 0;
      for (var i = 0; i < rows.length; i++) { if (rows[i].rank !== null) n++; }
      return n;
    }, [rows]);

    /* The manual fallback for whatever the paste-import could not match. Blank
     * means "I do not know", which is written as an absent value, not a zero. */
    function setMetaNum(id, field, raw) {
      var path = 'modelMeta/' + slugKey(id) + '/' + field;
      var s = String(raw === null || raw === undefined ? '' : raw).trim();
      if (!s) { writeCfg(path, null); return; }
      var n = field === 'healthRank' ? parseInt(s, 10) : parseFloat(s);
      if (!isFinite(n) || n <= 0) { writeCfg(path, null); return; }
      writeCfg(path, field === 'healthRank' ? Math.round(n) : n);
    }

    function fitTitle(r) {
      return 'MedMaster fit ' + r.fit + ' out of 100 = ' +
        Math.round(r.parts.health) + ' healthcare rank + ' +
        Math.round(r.parts.price) + ' price + ' +
        Math.round(r.parts.context) + ' context. A rough guide, not a benchmark.';
    }

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

    function modelRow(r, extra) {
      var m = r.m;
      var key = slugKey(m.id);
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
          /* Badges only exist where the data does. An unranked model shows no
             rank badge at all rather than "#-" or "unranked". */
          r.rank !== null ? ce('span', {
            className: 'aia-chip health',
            title: 'Number ' + r.rank + ' on the healthcare leaderboard you imported. This is your own metadata - ' +
              'OpenRouter does not serve it through the API.'
          }, '#' + r.rank + ' health') : null,
          r.params !== null ? ce('span', {
            className: 'aia-chip' + (r.paramsFrom === 'name' ? ' guess' : ''),
            title: r.paramsFrom === 'name'
              ? 'Read out of the model name, because OpenRouter does not publish parameter counts. It is a guess ' +
                'from the text - type the real number below if it is wrong.'
              : 'Parameter count you entered by hand.'
          }, fmtParams(r.params)) : null,
          ce('span', { className: 'aia-chip fit', title: fitTitle(r) }, 'fit ' + r.fit),
          extra || null
        ),
        ce('div', { className: 'aia-mid' }, m.id),
        ce('div', { className: 'aia-meta' }, priceChips(m)),
        r.note ? ce('div', { className: 'aia-desc', style: { marginTop: 4 } }, r.note) : null,

        editMeta ? ce('div', { className: 'aia-medit' },
          ce('div', { className: 'aia-field' },
            ce('label', { htmlFor: 'aia-hr-' + key }, 'Healthcare rank'),
            ce('input', {
              id: 'aia-hr-' + key, className: 'aia-input', type: 'number', min: 1, step: 1,
              placeholder: 'unranked',
              defaultValue: r.rank === null ? '' : String(r.rank),
              key: 'hr-' + (r.rank === null ? '' : r.rank),
              'aria-label': 'Healthcare rank for ' + m.id,
              onBlur: function (e) { setMetaNum(m.id, 'healthRank', e.target.value); },
              onKeyDown: function (e) { if (e.key === 'Enter') e.target.blur(); }
            })
          ),
          ce('div', { className: 'aia-field' },
            ce('label', { htmlFor: 'aia-pb-' + key }, 'Parameters (B)'),
            ce('input', {
              id: 'aia-pb-' + key, className: 'aia-input', type: 'number', min: 0, step: 'any',
              placeholder: r.paramsFrom === 'name' ? String(r.params) + ' (from name)' : 'unknown',
              defaultValue: r.paramsFrom === 'meta' ? String(r.params) : '',
              key: 'pb-' + (r.paramsFrom === 'meta' ? r.params : ''),
              'aria-label': 'Parameter count in billions for ' + m.id,
              onBlur: function (e) { setMetaNum(m.id, 'params', e.target.value); },
              onKeyDown: function (e) { if (e.key === 'Enter') e.target.blur(); }
            })
          ),
          ce('span', { className: 'hint' }, 'Saved when you click away. Empty clears it back to unknown.')
        ) : null,

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

      /* ---- healthcare rankings: paste-import, seed, clear ---- */
      ce(RankImportCard, {
        config: config, writeCfg: writeCfg, meta: meta,
        models: textCat.models, catalogStatus: textCat.status
      }),

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
            }), 'Assigned only'),
          ce('label', { className: 'aia-check' },
            ce('input', {
              type: 'checkbox', checked: editMeta,
              disabled: live.status !== 'loaded',
              onChange: function (e) { setEditMeta(e.target.checked); }
            }), 'Edit rank / parameters')
        ),

        /* ---- sort: pills on a wide screen, one dropdown at 360px ----
         * Same state, same handler, no duplicated logic - CSS decides which
         * control is on screen. Unknown values sort to the bottom in BOTH
         * directions, so reversing the order never interleaves the models you
         * have no data for with the ones you do. */
        ce('div', { className: 'aia-sort' },
          ce('span', { className: 'lbl' }, 'Sort by'),
          ce('div', { className: 'aia-sortpills', role: 'group', 'aria-label': 'Sort models by' },
            SORT_KEYS.map(function (k) {
              var on = sort.key === k.id;
              return ce('button', {
                key: k.id, type: 'button',
                className: 'aia-pill' + (on ? ' on' : ''),
                'aria-pressed': on ? 'true' : 'false',
                disabled: live.status !== 'loaded',
                title: on ? 'Click again to reverse the order' : 'Sort by ' + k.label,
                onClick: function () { pickSort(k.id); }
              }, k.label + (on ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''));
            })
          ),
          ce('select', {
            className: 'aia-select aia-sortsel', value: sort.key,
            disabled: live.status !== 'loaded',
            'aria-label': 'Sort models by',
            onChange: function (e) { chooseSort(e.target.value); }
          }, SORT_KEYS.map(function (k) {
            return ce('option', { key: k.id, value: k.id }, k.label);
          })),
          ce('button', {
            type: 'button', className: 'aia-pill',
            disabled: live.status !== 'loaded',
            'aria-label': 'Reverse the sort order',
            onClick: flipSort
          }, sort.dir === 1 ? 'Lowest first ↑' : 'Highest first ↓')
        ),

        /* ---- what the fit score is, spelled out ---- */
        ce('div', { style: { marginTop: 8 } },
          ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm',
            'aria-expanded': fitOpen ? 'true' : 'false',
            onClick: function () { setFitOpen(!fitOpen); }
          }, fitOpen ? 'Hide how "MedMaster fit" is calculated' : 'How is "MedMaster fit" calculated?'),
          ce('p', { className: 'aia-desc' },
            'MedMaster fit is a rough guide combining healthcare ranking, price, and context. Not a benchmark.'),
          fitOpen ? ce('div', { className: 'aia-note info' },
            FIT_EXPLAIN.map(function (line, i) {
              return ce('p', { key: i, style: { margin: i ? '8px 0 0' : 0 } }, line);
            }).concat([
              ce('p', { key: 'why', style: { margin: '8px 0 0' } },
                'Nothing in it measures clinical accuracy, and nothing in it is supplied by OpenRouter. The rank ' +
                'half is whatever you imported or typed; if you have imported nothing, every score here is just ' +
                'price and context.')
            ])
          ) : null
        ),

        live.status !== 'loaded' && ce('div', { className: 'aia-empty' },
          live.status === 'loading' ? 'Loading the catalog...'
            : live.status === 'error' ? 'The catalog could not be loaded. Fix the error above and try again.'
            : 'Load the catalog above to pick models.'),

        live.status === 'loaded' && live.models.length > 0 && filtered.length === 0 && ce('div', { className: 'aia-empty' },
          'No model matches those filters.'),

        live.status === 'loaded' && filtered.length > 0 && ce('div', null,
          ce('p', { className: 'aia-desc' },
            'Showing ' + Math.min(filtered.length, MAX_MODEL_ROWS) + ' of ' + filtered.length + ' matches, ' +
            'sorted by ' + sortLabel(sort.key).toLowerCase() + '. ' +
            (rankedShown
              ? rankedShown + ' of them have a healthcare rank. '
              : 'None of them have a healthcare rank yet - import or type one and they sort to the top. ') +
            (modality === 'text'
              ? 'Prices are US dollars per million tokens: "in" is your prompt, "out" is the reply.'
              : 'These are billed per ' + unit + ', not per token. Where OpenRouter reports a per-' + unit +
                ' price it is shown as such; where it does not, the token rates are shown under their own label ' +
                'rather than being relabelled as something they are not.')),
          ce('div', { className: 'aia-list', style: { maxHeight: 520, marginTop: 6 },
            tabIndex: 0, role: 'region', 'aria-label': 'Matching OpenRouter models' },
            sorted.slice(0, MAX_MODEL_ROWS).map(function (r) {
              var isAssigned = assigned.indexOf(r.id) !== -1;
              return modelRow(r, isAssigned ? ce('span', { className: 'aia-chip' }, 'assigned') : null);
            })
          )
        ),

        /* What the five built-in entries are, and what they are NOT. Without
         * this the shipped catalog reads as "everything MedMaster can run",
         * which is how a free or image model ends up looking unsupported. */
        catalogNote() ? ce('p', { className: 'aia-desc', style: { marginTop: 12 } }, catalogNote()) : null
      )
    );
  }

  /** MM.ai's note under the built-in catalog. '' if this is an older build. */
  function catalogNote() {
    var a = ai();
    return (a && typeof a.MODEL_CATALOG_NOTE === 'string') ? a.MODEL_CATALOG_NOTE : '';
  }

  /* ==========================================================================
   * CARD: IMPORT HEALTHCARE RANKINGS  (Models tab)
   * --------------------------------------------------------------------------
   * The leaderboard only exists on openrouter.ai/rankings as rendered HTML, so
   * the honest way to get it in here is the owner's clipboard. Paste, parse,
   * LOOK AT THE PREVIEW, then write. Nothing is written before the preview has
   * been shown, and anything that did not match a real slug is left alone rather
   * than guessed at.
   * ======================================================================== */

  function RankImportCard(props) {
    var config = props.config, writeCfg = props.writeCfg;
    var models = props.models || [];
    var meta = props.meta || {};
    var catalogStatus = props.catalogStatus || 'idle';

    var openState = useState(false);
    var open = openState[0], setOpen = openState[1];

    var textState = useState('');
    var text = textState[0], setText = textState[1];

    // null until Parse has run. { rows: [...] } afterwards - an empty rows array
    // is a real answer ("nothing in that paste looked like a leaderboard").
    var prevState = useState(null);
    var preview = prevState[0], setPreview = prevState[1];

    var armState = useState(false);
    var armed = armState[0], setArmed = armState[1];

    /* One write per commit, and no more. Every button on this card writes a
     * BATCH of paths, and every one of them decides what to write from a value
     * captured at render time. Two clicks dispatched inside a single task (a
     * fast double-click, a stuck mouse, a synthetic replay) therefore both see
     * the same pre-write state and both fire the whole batch - the ranks land
     * twice and modelMetaImportedAt is stamped twice. This latch is cleared by
     * an effect with no dependency list, so it re-opens once React has
     * committed the render that the first click caused - by which point the
     * preview is gone / the seed button is gone and the guard is moot anyway. */
    var burstRef = useRef(false);
    useEffect(function () { burstRef.current = false; });
    function once() {
      if (burstRef.current) return false;
      burstRef.current = true;
      return true;
    }

    var ranked = countHealthRanks(meta);
    var dups = duplicateHealthRanks(meta);
    var isEmpty = metaIsEmpty(meta);
    var importedAt = (config && typeof config.modelMetaImportedAt === 'number') ? config.modelMetaImportedAt : 0;
    var canMatch = catalogStatus === 'loaded' && models.length > 0;

    var matches = 0;
    if (preview) {
      for (var pi = 0; pi < preview.rows.length; pi++) { if (preview.rows[pi].slug) matches++; }
    }

    function doParse() {
      var entries = parseRankingPaste(text);
      setPreview({ rows: buildImportPreview(entries, models), capped: entries.length >= MAX_RANK_ENTRIES });
    }

    function doConfirm() {
      if (!preview || !once()) return;
      var n = applyRankImport(preview.rows, writeCfg, Date.now());
      if (n) {
        toast('Imported ' + n + ' healthcare rank' + (n === 1 ? '' : 's') + '.', 'success');
        setPreview(null);
        setText('');
      } else {
        toast('Nothing matched a real model, so nothing was written.', 'error');
      }
    }

    function doSeed() {
      if (!once()) return;
      var n = applyRankImport(SEED_HEALTH_RANKS, writeCfg, Date.now());
      toast('Seeded ' + n + ' healthcare ranks from the ' + SEED_SNAPSHOT_LABEL + ' snapshot.', 'success');
    }

    function doClear() {
      if (!once()) return;
      var n = clearHealthRanks(meta, writeCfg);
      setArmed(false);
      toast(n ? ('Cleared ' + n + ' healthcare rank' + (n === 1 ? '' : 's') + '.') : 'There were none to clear.',
        n ? 'success' : 'info');
    }

    return ce('div', { className: 'aia-card' },
      ce('div', { className: 'aia-row' },
        ce('p', { className: 'aia-h' }, 'Healthcare rankings'),
        ce('button', {
          type: 'button', className: 'btn btn-outline btn-sm',
          'aria-expanded': open ? 'true' : 'false',
          onClick: function () { setOpen(!open); }
        }, open ? 'Close' : 'Import healthcare rankings')
      ),
      ce('p', { className: 'aia-desc' },
        ranked
          ? (ranked + ' model' + (ranked === 1 ? ' has' : 's have') + ' a healthcare rank' +
             (importedAt ? ', last imported ' + fmtDate(importedAt) + '.' : '.'))
          : ('No model has a healthcare rank yet, so the rank half of every fit score is currently zero.' +
             (isEmpty && !open ? ' Open this card to paste a leaderboard, or to seed the ' +
               SEED_SNAPSHOT_LABEL + ' snapshot.' : ''))),
      dups.length ? ce('div', { className: 'aia-note warn' },
        (dups.length === 1
          ? ('Two or more models share rank ' + dups[0].rank + ' (' + dups[0].n + ' of them).')
          : ('Several ranks are claimed by more than one model: ' +
             dups.map(function (d) { return 'rank ' + d.rank + ' x' + d.n; }).join(', ') + '.')) +
        ' They score the same for the healthcare half of the fit score, so the order between them is decided ' +
        'by name, not by you. Re-import the leaderboard or edit the ranks to break the tie.') : null,

      ce('p', { className: 'aia-desc' },
        'OpenRouter only publishes its healthcare leaderboard on the ',
        ce('span', { className: 'aia-code' }, 'openrouter.ai/rankings'),
        ' page - it is drawn in the browser, it is not in the page source, and the public ',
        ce('span', { className: 'aia-code' }, '/api/v1/models'),
        ' carries no ranking at all. So this is copy-and-paste on purpose: a scraper for that page would break ' +
        'silently and you would never know the numbers had stopped updating.'),

      open ? ce('div', { style: { marginTop: 10 } },
        ce('p', { className: 'aia-desc' },
          'Open openrouter.ai/rankings, choose Healthcare, select the leaderboard and copy it. Paste the whole ' +
          'thing below - the ranks, the "by <author>" lines and the token counts are all expected.'),

        ce('textarea', {
          className: 'aia-ta', value: text, spellCheck: false,
          placeholder: '1.\nDeepSeek V4 Flash 0731\nby\ndeepseek\n10T tokens\n191%\n2.\n...',
          'aria-label': 'Pasted healthcare leaderboard',
          onChange: function (e) { setText(e.target.value); }
        }),

        ce('div', { className: 'aia-run' },
          ce('button', {
            type: 'button', className: 'btn btn-primary btn-sm',
            disabled: !text.trim() || !canMatch,
            onClick: doParse
          }, 'Parse'),
          text ? ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm',
            onClick: function () { setText(''); setPreview(null); }
          }, 'Clear the box') : null
        ),

        !canMatch ? ce('div', { className: 'aia-note warn' },
          'The text catalog is not loaded, so a pasted name cannot be matched to a real slug. Load the models at ' +
          'the top of this tab first.') : null,

        preview && preview.rows.length === 0 ? ce('div', { className: 'aia-note warn' },
          'Nothing in that paste looked like a numbered leaderboard. Make sure the rank numbers came across - ' +
          'they are what the parser locks onto.') : null,

        preview && preview.capped ? ce('div', { className: 'aia-note warn' },
          'That paste had more than ' + MAX_RANK_ENTRIES + ' ranked lines. Only the first ' + MAX_RANK_ENTRIES +
          ' are read, and only those are listed below - a healthcare leaderboard is never longer than that, so ' +
          'the rest is almost certainly the rest of the page.') : null,

        preview && preview.rows.length > 0 ? ce('div', null,
          ce('p', { className: 'aia-desc', style: { marginTop: 12 } },
            matches + ' of ' + preview.rows.length + ' lines matched a model in the catalog. ' +
            'Nothing has been saved yet - check the matches first. Lines with no match are left exactly as they ' +
            'are; they are never guessed at.'),
          ce('div', { className: 'aia-list', style: { maxHeight: 300, marginTop: 6 },
            tabIndex: 0, role: 'region', 'aria-label': 'Import preview' },
            [ce('div', { className: 'aia-prow head', key: 'h' },
              ce('span', null, 'Rank'), ce('span', null, 'Pasted name'), ce('span', { className: 'slug' }, 'Matched model'))
            ].concat(preview.rows.map(function (r, i) {
              return ce('div', { className: 'aia-prow', key: i },
                ce('span', { className: 'rk' }, '#' + r.rank),
                ce('span', { className: 'nm' }, r.pasted + (r.author ? ' · ' + r.author : '')),
                ce('span', { className: 'slug' + (r.slug ? '' : ' miss') }, r.slug ? r.slug : r.why)
              );
            }))
          ),
          ce('div', { className: 'aia-run' },
            ce('button', {
              type: 'button', className: 'btn btn-primary btn-sm',
              disabled: matches === 0,
              onClick: doConfirm
            }, matches ? ('Write ' + matches + ' rank' + (matches === 1 ? '' : 's')) : 'Nothing to write'),
            ce('button', {
              type: 'button', className: 'btn btn-outline btn-sm',
              onClick: function () { setPreview(null); }
            }, 'Cancel')
          )
        ) : null,

        isEmpty ? ce('div', { style: { marginTop: 14 } },
          ce('p', { className: 'aia-desc' },
            'Nothing recorded at all yet. This seeds the five models that led OpenRouter\'s healthcare leaderboard ' +
            'in ' + SEED_SNAPSHOT_LABEL + '. It is a DATED SNAPSHOT, not a live feed - it was true once and it ' +
            'will drift, so refresh it with a paste when you care about the order.'),
          ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm', onClick: doSeed
          }, 'Seed with known healthcare rankings (' + SEED_SNAPSHOT_LABEL + ' snapshot)')
        ) : null,

        ranked ? ce('div', { style: { marginTop: 14 } },
          armed
            ? ce('div', null,
                ce('div', { className: 'aia-note warn' },
                  'This removes the healthcare rank from all ' + ranked + ' model' + (ranked === 1 ? '' : 's') +
                  '. Parameter counts and notes are kept. There is no undo, but a fresh paste puts them back.'),
                ce('div', { className: 'aia-run' },
                  ce('button', { type: 'button', className: 'btn btn-primary btn-sm', onClick: doClear },
                    'Yes, clear all ' + ranked + ' ranks'),
                  ce('button', {
                    type: 'button', className: 'btn btn-outline btn-sm',
                    onClick: function () { setArmed(false); }
                  }, 'Keep them')
                )
              )
            : ce('button', {
                type: 'button', className: 'btn btn-outline btn-sm',
                onClick: function () { setArmed(true); }
              }, 'Clear all health ranks')
        ) : null,

        ce('p', { className: 'aia-desc', style: { marginTop: 12 } },
          'Writes to ', ce('span', { className: 'aia-code' }, 'aiConfig.modelMeta.<slug>.healthRank'),
          ' and stamps ', ce('span', { className: 'aia-code' }, 'aiConfig.modelMetaImportedAt'),
          '. The slug keys have ', ce('span', { className: 'aia-code' }, '/'), ' and ',
          ce('span', { className: 'aia-code' }, '.'), ' written as ',
          ce('span', { className: 'aia-code' }, '_'), ', because Firebase will not accept them in a key.')
      ) : null
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
  var MAX_ROUTE_OPTIONS = 60;

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

    /* -> {ids, hidden}. `hidden` is how many real image models were left out.
     * A wildcard tier is allowed EVERYTHING, and OpenRouter's image list alone
     * is in the hundreds; a 300-option select is not a control on a phone, it
     * is a scroll. The models that are actually in play are always listed in
     * full (everything configured anywhere, plus whatever this cell is set to);
     * the long tail of the image catalog is capped and the count is shown, so
     * the cell never pretends the list is complete. */
    function optionsFor(tier, isImg, current) {
      var tcfg = config.tiers[tier] || {};
      var allowed = modelsOf(tcfg);
      var wildcard = allowed.indexOf('*') !== -1;
      var seen = {}, out = [], hidden = 0, i;
      function add(id) {
        if (!id || id === '*' || seen[id]) return false;
        seen[id] = true;
        out.push(id);
        return true;
      }
      if (wildcard) {
        var cfgIds = configuredIds(config);
        for (i = 0; i < cfgIds.length; i++) add(cfgIds[i]);
        if (isImg) {
          for (i = 0; i < imageCat.models.length; i++) {
            if (out.length >= MAX_ROUTE_OPTIONS && imageCat.models[i].id !== current) {
              if (!seen[imageCat.models[i].id]) hidden++;
              continue;
            }
            add(imageCat.models[i].id);
          }
        }
      } else {
        for (i = 0; i < allowed.length; i++) add(allowed[i]);
      }
      add(current);   // whatever is configured is ALWAYS selectable, cap or not
      return { ids: out, hidden: hidden };
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
          opts.ids.map(function (id) { return ce('option', { key: id, value: id }, id); })
        ),

        opts.hidden ? ce('div', { className: 'aia-cellwarn soft' },
          'Showing ' + opts.ids.length + ' of ' + (opts.ids.length + opts.hidden) + ' possible models. Add the one ' +
          'you want to a tier on the Models tab and it appears here.') : null,

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

      Promise.resolve().then(function () { return im.lookup(req); }).then(function (entry) {
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
        items = fixedItems();
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
      if (!items || !items.length) { items = fixedItems(); itemsRef.current = items; }
      if (!items.length) { toast('Nothing to export.', 'error'); return; }

      setExp({ busy: true, done: 0, total: items.length, msg: 'Finding cached images...', text: '', count: 0, skipped: [] });

      var found = [];
      var i = 0;
      function next() {
        if (i >= items.length) return Promise.resolve();
        var it = items[i++];
        return Promise.resolve()
          .then(function () { return im.lookup({ prompt: it.prompt, feature: it.feature, size: it.size }); })
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
    var fixedCount = fixedItems().length;
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
              ce('div', {
                style: {
                  color: v < -1 ? 'var(--orange-fg,var(--orange))' : 'var(--text3)',
                  fontSize: 'var(--fs-xs,12px)', marginTop: 4
                }
              },
                imageLimitPhrase(v) +
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
        (im && typeof im.STORAGE_RULES_SNIPPET === 'string' && im.STORAGE_RULES_SNIPPET) ? ce('div', null,
          ce('p', { className: 'aia-desc', style: { marginTop: 12 } },
            'And the matching Cloud Storage rules, which live in a different console tab (Storage -> Rules):'),
          ce('div', { className: 'aia-pre' }, im.STORAGE_RULES_SNIPPET)
        ) : null
      )
    );
  }

  /* ==========================================================================
   * TAB: VOICES   (ElevenLabs studio voices)
   * --------------------------------------------------------------------------
   * Five things, in the order the owner needs them:
   *
   *   1. IS IT ON, and what does ElevenLabs say the monthly bundle looks like
   *   2. CASTING - one studio voice per speaker role, chosen by listening to
   *      previews, with a "Test this voice" that speaks a real clinical line
   *      through the SAME normalizer students hear, so what he auditions is
   *      literally what they get
   *   3. LIMITS - characters a day per plan, and the blended rate the estimate
   *      is built from
   *   4. WHAT IT HAS COST and what the shared cache has saved
   *   5. PRE-GENERATE the 172 scripted dialogue lines once, then export them as
   *      a static bundle so scripted speech costs nothing forever
   *
   * Nothing here is reachable by a student. Every read is feature-detected: the
   * panel must still open if js/voice.js is an older build or absent entirely.
   * ======================================================================== */

  function VoicesTab(props) {
    var config = props.config, writeCfg = props.writeCfg;
    var v = voiceMod();
    var profiles = config.voiceProfiles || {};
    var models = ttsModels();
    var order = voiceProfileOrder();

    /* ---- state ---- */
    var catState = useState({ status: 'idle', voices: [], error: '', fetchedAt: 0, cached: false });
    var cat = catState[0], setCat = catState[1];

    var quotaState = useState({ status: 'idle', error: '' });
    var quota = quotaState[0], setQuota = quotaState[1];

    var cacheState = useState({ status: 'idle', count: 0, chars: 0, hits: 0, bytes: 0, saved: 0, error: '' });
    var cache = cacheState[0], setCache = cacheState[1];

    var spendState = useState({ status: 'idle', today: null, week: 0, weekChars: 0, error: '' });
    var spend = spendState[0], setSpend = spendState[1];

    var openState = useState('');            /* which profile's picker is expanded */
    var openFor = openState[0], setOpenFor = openState[1];

    var filterState = useState('');
    var filter = filterState[0], setFilter = filterState[1];

    var testState = useState({ profile: '', status: '', msg: '' });
    var test = testState[0], setTest = testState[1];

    var runState = useState({
      running: false, idx: 0, total: 0, done: 0, generated: 0, skipped: 0,
      chars: 0, costUsd: 0, errors: [], label: '', finished: false, stopped: false, started: false
    });
    var run = runState[0], setRun = runState[1];

    var expState = useState({ busy: false, done: 0, total: 0, msg: '', text: '', count: 0, skipped: [], bytes: 0 });
    var exp = expState[0], setExp = expState[1];

    /* Refs, not state: the pre-generate loop must never be restarted by a
       re-render, and a stop has to be visible to an in-flight iteration now. */
    var busyRef = useRef(false);
    var stopRef = useRef(false);
    var itemsRef = useRef(null);
    var cursorRef = useRef(0);
    var aliveRef = useRef(true);
    var previewRef = useRef(null);
    useEffect(function () {
      return function () {
        aliveRef.current = false;
        stopRef.current = true;
        try { if (previewRef.current) previewRef.current.pause(); } catch (e) { /* noop */ }
        try { if (v && typeof v.stopSpeaking === 'function') v.stopSpeaking(); } catch (e) { /* noop */ }
      };
    }, [v]);

    /* ---- loaders ---- */

    var loadVoices = useCallback(function () {
      var vm2 = voiceMod();
      if (!vm2 || typeof vm2.listElevenVoices !== 'function') {
        setCat({ status: 'error', voices: [], fetchedAt: 0, cached: false,
          error: 'js/voice.js is not loaded (or is an older build), so the catalog cannot be fetched.' });
        return;
      }
      setCat(function (p) { return { status: 'loading', voices: p.voices, error: '', fetchedAt: p.fetchedAt, cached: p.cached }; });
      vm2.listElevenVoices().then(function (d) {
        if (!aliveRef.current) return;
        setCat({
          status: 'loaded',
          /* Sanitize ONCE, here, rather than guarding at every render site.
             A catalog entry that is null, a string, or missing voice_id
             crashed the tab with "Cannot read properties of null (reading
             'voice_id')" - one bad row took out the whole page. Normalizing
             on arrival means every consumer downstream (cards, dropdowns,
             auto-cast, pre-generate) sees a predictable shape. */
          voices: sanitizeVoiceCatalog(d.voices),
          error: '', fetchedAt: d.fetchedAt || Date.now(), cached: d.cached === true
        });
      }, function (e) {
        if (!aliveRef.current) return;
        setCat({ status: 'error', voices: [], fetchedAt: 0, cached: false,
          error: (e && e.message) ? e.message : 'The voice catalog would not load.' });
      });
    }, []);

    var loadQuota = useCallback(function () {
      var vm2 = voiceMod();
      if (!vm2 || typeof vm2.elevenQuota !== 'function') {
        setQuota({ status: 'error', error: 'js/voice.js is not loaded.' });
        return;
      }
      setQuota({ status: 'loading', error: '' });
      vm2.elevenQuota().then(function (d) {
        if (!aliveRef.current) return;
        setQuota({
          status: 'loaded', error: '',
          used: d.used || 0, limit: d.limit || 0, remaining: d.remaining || 0,
          pct: d.pct || 0, resetsAt: d.resetsAt || 0, plan: d.tier || '', state: d.status || ''
        });
      }, function (e) {
        if (!aliveRef.current) return;
        setQuota({ status: 'error', error: (e && e.message) ? e.message : 'Could not read the ElevenLabs subscription.' });
      });
    }, []);

    var loadCache = useCallback(function () {
      var vm2 = voiceMod();
      if (!vm2 || typeof vm2.listClipCache !== 'function') {
        setCache({ status: 'error', count: 0, chars: 0, hits: 0, bytes: 0, saved: 0,
          error: 'js/voice.js is not loaded.' });
        return;
      }
      setCache(function (p) { return { status: 'loading', count: p.count, chars: p.chars, hits: p.hits, bytes: p.bytes, saved: p.saved, error: '' }; });
      vm2.listClipCache().then(function (res) {
        if (!aliveRef.current) return;
        if (!res.ok) {
          setCache({ status: 'error', count: 0, chars: 0, hits: 0, bytes: 0, saved: 0, error: res.error || 'unreadable' });
          return;
        }
        var e = res.entries || {}, k, r, count = 0, chars = 0, hits = 0, bytes = 0, saved = 0;
        for (k in e) {
          if (!Object.prototype.hasOwnProperty.call(e, k)) continue;
          r = e[k] || {};
          count++;
          var c = (typeof r.chars === 'number') ? r.chars : 0;
          var h = (typeof r.hits === 'number') ? r.hits : 0;
          chars += c;
          hits += h;
          bytes += (typeof r.bytes === 'number') ? r.bytes : 0;
          /* Characters the cache stopped anybody paying for: every hit after the
             one that created the clip is a line nobody was billed twice for. */
          saved += c * h;
        }
        setCache({ status: 'loaded', count: count, chars: chars, hits: hits, bytes: bytes, saved: saved, error: '' });
      }, function (e) {
        if (!aliveRef.current) return;
        setCache({ status: 'error', count: 0, chars: 0, hits: 0, bytes: 0, saved: 0,
          error: (e && e.message) ? e.message : 'unreadable' });
      });
    }, []);

    var loadSpend = useCallback(function () {
      var d = db();
      if (!d) { setSpend({ status: 'error', today: null, week: 0, weekChars: 0, error: 'Firebase is not connected.' }); return; }
      setSpend(function (p) { return { status: 'loading', today: p.today, week: p.week, weekChars: p.weekChars, error: '' }; });
      /* limitToLast orders by key, and the keys are YYYY-MM-DD, so this is the
         last N days. Guarded because a stub / older SDK may not expose it, and
         a missing analytic must never take the tab down. */
      var ref = d.ref(VOICE_SPEND_PATH);
      try {
        if (typeof ref.limitToLast === 'function') ref = ref.limitToLast(VOICE_SPEND_DAYS);
      } catch (e) { ref = d.ref(VOICE_SPEND_PATH); }
      ref.once('value').then(function (snap) {
        if (!aliveRef.current) return;
        var val = null;
        try { val = (snap && typeof snap.val === 'function') ? snap.val() : null; } catch (e) { val = null; }
        var days = (val && typeof val === 'object') ? val : {};
        var key = todayKey();
        var week = 0, weekChars = 0, k;
        for (k in days) {
          if (!Object.prototype.hasOwnProperty.call(days, k)) continue;
          week += num6(days[k] && days[k].total6);
          weekChars += num6(days[k] && days[k].chars);
        }
        setSpend({ status: 'loaded', today: days[key] || null, week: week, weekChars: weekChars, error: '' });
      }, function (e) {
        if (!aliveRef.current) return;
        setSpend({ status: 'denied', today: null, week: 0, weekChars: 0,
          error: (e && e.message) ? e.message : 'permission denied' });
      });
    }, []);

    /* Everything loads once, on open. Three upstream calls, all cached server
       side for ten minutes, so re-opening the tab is close to free. */
    useEffect(function () {
      if (cat.status === 'idle') loadVoices();
      if (quota.status === 'idle') loadQuota();
      if (cache.status === 'idle') loadCache();
      if (spend.status === 'idle') loadSpend();
    }, [cat.status, quota.status, cache.status, spend.status, loadVoices, loadQuota, loadCache, loadSpend]);

    /* ---- preview player ---- */

    function stopPreview() {
      try {
        if (previewRef.current) {
          previewRef.current.pause();
          previewRef.current.src = '';
        }
      } catch (e) { /* noop */ }
      previewRef.current = null;
    }

    function playPreview(url) {
      stopPreview();
      if (!url || typeof window.Audio !== 'function') {
        toast('This voice has no preview clip.', 'info');
        return;
      }
      try {
        var el = new window.Audio(url);
        previewRef.current = el;
        var p = el.play();
        if (p && typeof p['catch'] === 'function') {
          p['catch'](function () { toast('The browser would not play the preview. Tap again.', 'info'); });
        }
      } catch (e) {
        toast('Could not play the preview.', 'error');
      }
    }

    /* ---- writes ---- */

    function assign(profile, voice) {
      var cur = profiles[profile];
      writeCfg('voiceProfiles/' + profile, {
        voiceId: voice.voice_id,
        modelId: (cur && cur.modelId) ? cur.modelId : DEFAULT_TTS_MODEL,
        name: voice.name || ''
      }).then(function (okWrite) {
        if (okWrite) setOpenFor('');
      });
    }

    function unassign(profile) {
      writeCfg('voiceProfiles/' + profile, null);
    }

    /* One-click casting. Scores the LIVE catalog against each role's wanted /
       unwanted label words (see VOICE_PROFILE_CAST) and fills every role that
       gets a positive match, never reusing a voice. Roles it cannot cast
       confidently are left on the device voice rather than mis-cast. Purely a
       starting point - every assignment stays individually editable. */
    function autoAssignAll() {
      var voices = (cat && Array.isArray(cat.voices)) ? cat.voices : [];
      if (!voices.length) { toast('Load the voice catalog first.', 'info'); return; }
      var picks = autoCast(voices);
      var roles = Object.keys(picks);
      if (!roles.length) { toast('No confident matches in this catalog - assign manually.', 'info'); return; }
      var byId = {};
      for (var i = 0; i < voices.length; i++) {
        var vv = (voices[i] && typeof voices[i] === 'object') ? voices[i] : {};
        byId[String(vv.voice_id || '')] = vv;
      }
      var writes = [];
      for (var r = 0; r < roles.length; r++) {
        var role = roles[r];
        var v = byId[picks[role]] || {};
        var prev = profiles[role];
        writes.push(writeCfg('voiceProfiles/' + role, {
          voiceId: String(v.voice_id || ''),
          modelId: (prev && prev.modelId) ? prev.modelId : DEFAULT_TTS_MODEL,
          name: String(v.name || '')
        }));
      }
      Promise.all(writes).then(function (res) {
        var okCount = 0;
        for (var i = 0; i < res.length; i++) if (res[i]) okCount++;
        var skipped = VOICE_PROFILE_ORDER.length - roles.length;
        toast('Cast ' + okCount + ' of ' + VOICE_PROFILE_ORDER.length + ' roles' +
          (skipped ? ' - ' + skipped + ' left on the device voice' : '') +
          '. Preview each one and change any you do not like.', okCount ? 'success' : 'error');
      });
    }

    function setProfileModel(profile, modelId) {
      var cur = profiles[profile];
      if (!cur) { toast('Assign a voice to this role first.', 'info'); return; }
      writeCfg('voiceProfiles/' + profile, {
        voiceId: cur.voiceId, modelId: modelId, name: cur.name || ''
      });
    }

    function setVoiceLimit(tier, raw) {
      var n = parseInt(raw, 10);
      if (!isFinite(n)) { toast('Enter a whole number of characters (-1 for unlimited).', 'error'); return; }
      if (n < -1) { toast('Use -1 for unlimited, or 0 for device voices only.', 'error'); return; }
      writeCfg('voiceLimits/' + tier, n);
    }

    function setRate(raw) {
      var n = parseFloat(raw);
      if (!isFinite(n) || n < 0 || n >= 100) { toast('Enter dollars per 1000 characters, e.g. 0.22.', 'error'); return; }
      writeCfg('voiceUsdPer1kChars', n);
    }

    /* ---- test ---- */

    /**
     * Speak a real clinical line, through the real normalizer, on the real
     * server path. Two routes on purpose:
     *   assigned role  -> MM.voice.speak(), i.e. byte for byte the student path
     *   auditioning    -> a direct clip request with an explicit voiceId, which
     *                     only the owner is allowed to send
     */
    function testProfile(profile) {
      var vm2 = voiceMod();
      if (!vm2) { toast('js/voice.js is not loaded.', 'error'); return; }
      var line = voiceTestLine();
      setTest({ profile: profile, status: 'busy', msg: 'Rendering...' });
      try { vm2.stopSpeaking(); } catch (e) { /* noop */ }
      try { if (typeof vm2.prime === 'function') vm2.prime(); } catch (e) { /* noop */ }

      Promise.resolve()
        .then(function () { return vm2.speak(line, { voice: profile, force: true }); })
        .then(function (r) {
          if (!aliveRef.current) return;
          if (r && r.premium) {
            setTest({ profile: profile, status: 'ok',
              msg: 'Spoken in the studio voice (' + (r.source === 'generated' ? 'newly rendered' : 'from the ' + r.source + ' cache') + ').' });
          } else {
            setTest({ profile: profile, status: 'warn',
              msg: 'That played in your DEVICE voice, not the studio voice: ' + vm2.premiumReasonFor(profile) });
          }
          loadCache();
        }, function (e) {
          if (!aliveRef.current) return;
          setTest({ profile: profile, status: 'err', msg: (e && e.message) ? e.message : 'The test failed.' });
        });
    }

    /** Audition ONE catalog voice without assigning it. Owner-only server side. */
    function auditionVoice(profile, voice) {
      var vm2 = voiceMod();
      if (!vm2 || typeof vm2.getClip !== 'function') { toast('js/voice.js is not loaded.', 'error'); return; }
      var cur = profiles[profile];
      var modelId = (cur && cur.modelId) ? cur.modelId : DEFAULT_TTS_MODEL;
      var text = vm2.normalizeClinicalForTTS(voiceTestLine());
      var item = {
        text: text, profile: profile, voiceId: voice.voice_id, modelId: modelId,
        hash: vm2.clipHash(text, voice.voice_id, modelId)
      };
      setTest({ profile: profile, status: 'busy', msg: 'Rendering ' + voice.name + ' on the clinical line...' });
      vm2.getClip(item).then(function (entry) {
        if (!aliveRef.current) return;
        if (!entry || !entry.url) {
          setTest({ profile: profile, status: 'err',
            msg: 'ElevenLabs did not return a clip for ' + voice.name + '. ' +
                 (vm2.stats().lastError || 'Check the key and the plan.') });
          return;
        }
        setTest({ profile: profile, status: 'ok', msg: 'Playing ' + voice.name + ' reading the clinical line.' });
        stopPreview();
        playPreview(entry.url);
      }, function (e) {
        if (!aliveRef.current) return;
        setTest({ profile: profile, status: 'err', msg: (e && e.message) ? e.message : 'Audition failed.' });
      });
    }

    /* ---- pre-generate ---- */

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
          chars: prev.chars + (d.chars || 0),
          costUsd: prev.costUsd + (d.costUsd || 0),
          errors: d.error ? prev.errors.concat([d.error]) : prev.errors,
          label: d.label !== undefined ? d.label : prev.label,
          finished: prev.finished, stopped: prev.stopped, started: prev.started
        };
      });
    }

    function finishRun() {
      busyRef.current = false;
      var items = itemsRef.current || [];
      var incomplete = cursorRef.current < items.length;
      patchRun({ running: false, label: '', finished: !incomplete, stopped: incomplete });
      loadCache();
      loadQuota();
    }

    function stepRun() {
      var vm2 = voiceMod();
      var items = itemsRef.current || [];
      if (!vm2 || stopRef.current || cursorRef.current >= items.length) { finishRun(); return; }

      var i = cursorRef.current;
      var it = items[i];
      patchRun({ idx: i, label: it.label });

      Promise.resolve().then(function () { return vm2.lookupClip(it); }).then(function (entry) {
        if (entry) {
          /* Already in the shared cache or the static bundle. Not paid for
             again, not re-uploaded, not re-indexed. This is what makes the run
             resumable and re-runnable for free. */
          cursorRef.current = i + 1;
          bumpRun({ done: 1, skipped: 1 });
          return null;
        }
        return Promise.resolve(vm2.getClip(it)).then(function (made) {
          cursorRef.current = i + 1;
          if (made) {
            bumpRun({
              done: 1, generated: 1, chars: it.chars,
              costUsd: (typeof made.cost === 'number' && isFinite(made.cost)) ? made.cost : 0
            });
          } else {
            var s = vm2.stats();
            bumpRun({ done: 1, error: it.label + ' - ' + (s.lastError || 'no clip came back') });
            /* A permanent condition (the daily cap, the monthly bundle, a bad
               key) means every remaining item is one more failed round trip. */
            if (s.disabled) {
              stopRef.current = true;
              bumpRun({ error: 'Stopped: ' + s.disabledReason });
            }
          }
          return null;
        });
      })['catch'](function (e) {
        cursorRef.current = i + 1;
        bumpRun({ done: 1, error: it.label + ' - ' + ((e && e.message) ? e.message : 'failed') });
      }).then(function () { stepRun(); });
    }

    function startRun(resume) {
      var vm2 = voiceMod();
      if (!vm2) { toast('js/voice.js is not loaded, so there is nothing to pre-generate.', 'error'); return; }
      if (busyRef.current) return;                 /* never two runs at once, ever */
      var items = itemsRef.current;
      if (!resume || !items || !items.length) {
        items = dialogueItems().filter(function (it) { return !!it.voiceId; });
        itemsRef.current = items;
        cursorRef.current = 0;
      }
      if (!items.length) {
        toast('No dialogue lines with an assigned voice. Cast the roles above first.', 'error');
        return;
      }
      busyRef.current = true;
      stopRef.current = false;
      if (resume) {
        patchRun({ running: true, total: items.length, idx: cursorRef.current, finished: false, stopped: false, started: true });
      } else {
        patchRun({
          running: true, idx: 0, total: items.length, done: 0, generated: 0, skipped: 0,
          chars: 0, costUsd: 0, errors: [], label: '', finished: false, stopped: false, started: true
        });
      }
      stepRun();
    }

    function stopRun() {
      stopRef.current = true;
      patchRun({ label: 'stopping after this one...' });
    }

    function exportBundle() {
      var vm2 = voiceMod();
      if (!vm2 || typeof vm2.exportStaticVoice !== 'function') { toast('js/voice.js is not loaded.', 'error'); return; }
      var items = itemsRef.current;
      if (!items || !items.length) {
        items = dialogueItems().filter(function (it) { return !!it.voiceId; });
        itemsRef.current = items;
      }
      if (!items.length) { toast('Nothing to export.', 'error'); return; }

      setExp({ busy: true, done: 0, total: items.length, msg: 'Finding cached clips...', text: '', count: 0, skipped: [], bytes: 0 });

      var found = [], i = 0;
      function next() {
        if (i >= items.length) return Promise.resolve();
        var it = items[i++];
        return Promise.resolve().then(function () { return vm2.lookupClip(it); }).then(function (entry) {
          if (entry && entry.url) found.push({ hash: entry.hash || it.hash, url: entry.url, label: it.label });
          if (aliveRef.current) {
            setExp(function (p) {
              return { busy: true, done: i, total: items.length, msg: it.label, text: p.text, count: p.count, skipped: p.skipped, bytes: p.bytes };
            });
          }
          return next();
        }, function () { return next(); });
      }

      next().then(function () {
        return vm2.exportStaticVoice(found, function (d, t, label) {
          if (aliveRef.current) {
            setExp(function (p) {
              return { busy: true, done: d, total: t, msg: 'Encoding ' + label, text: p.text, count: p.count, skipped: p.skipped, bytes: p.bytes };
            });
          }
        });
      }).then(function (res) {
        if (!aliveRef.current) return;
        var okDl = downloadText('static-voice.js', res.text);
        setExp({
          busy: false, done: res.count, total: found.length, count: res.count,
          skipped: res.skipped || [], bytes: res.bytes || res.text.length,
          msg: okDl
            ? 'Downloaded static-voice.js with ' + res.count + ' clip' + (res.count === 1 ? '' : 's') +
              ' (' + fmtBytes(res.text.length) + ').'
            : 'This browser blocked the download - copy the text below into data/static-voice.js instead.',
          text: okDl ? '' : res.text
        });
        if (okDl) toast('Static voice bundle downloaded. Commit it as data/static-voice.js.', 'success');
      })['catch'](function (e) {
        if (!aliveRef.current) return;
        setExp({ busy: false, done: 0, total: 0, count: 0, skipped: [], text: '', bytes: 0,
          msg: 'Export failed: ' + ((e && e.message) ? e.message : 'unknown error') });
      });
    }

    /* ---- derived ---- */

    var allItems = dialogueItems();
    var castItems = allItems.filter(function (it) { return !!it.voiceId; });
    var totalChars = castItems.reduce(function (n, it) { return n + it.chars; }, 0);
    var rate = (typeof config.voiceUsdPer1kChars === 'number') ? config.voiceUsdPer1kChars : DEFAULT_USD_PER_1K_CHARS;
    var assignedCount = order.filter(function (p) { return !!profiles[p]; }).length;
    var pctRun = run.total > 0 ? Math.round((run.done / run.total) * 100) : 0;
    var normalizedTest = v ? v.normalizeClinicalForTTS(voiceTestLine()) : '';

    var voiceById = useMemo(function () {
      var m = {}, i;
      for (i = 0; i < cat.voices.length; i++) m[cat.voices[i].voice_id] = cat.voices[i];
      return m;
    }, [cat.voices]);

    /* Grouped for the picker: premade / professional / cloned / generated. The
       group is the single most useful sort - a cloned voice is one the owner
       made, and it should never be buried among two hundred stock voices. */
    var grouped = useMemo(function () {
      var q = String(filter || '').toLowerCase().trim();
      var groups = {}, orderKeys = [], i, vv, key, hay;
      for (i = 0; i < cat.voices.length; i++) {
        vv = cat.voices[i];
        if (q) {
          hay = [vv.name, vv.category, vv.labels.accent, vv.labels.age, vv.labels.gender,
                 vv.labels.description, vv.labels.useCase, vv.description].join(' ').toLowerCase();
          if (hay.indexOf(q) === -1) continue;
        }
        key = vv.category || 'other';
        if (!groups[key]) { groups[key] = []; orderKeys.push(key); }
        groups[key].push(vv);
      }
      orderKeys.sort(function (a, b) {
        var rank = { cloned: 0, professional: 1, premade: 2, generated: 3 };
        var ra = (rank[a] === undefined) ? 9 : rank[a];
        var rb = (rank[b] === undefined) ? 9 : rank[b];
        return ra - rb;
      });
      return { keys: orderKeys, map: groups };
    }, [cat.voices, filter]);

    var shownCount = grouped.keys.reduce(function (n, k) { return n + grouped.map[k].length; }, 0);

    /* ---- render helpers ---- */

    function voiceCard(profile, vv) {
      var cur = profiles[profile];
      var isOn = !!(cur && cur.voiceId === vv.voice_id);
      var bits = [vv.labels.gender, vv.labels.age, vv.labels.accent, vv.labels.useCase]
        .filter(function (s) { return !!s; });
      return ce('div', { className: 'aia-vcard' + (isOn ? ' on' : ''), key: vv.voice_id },
        ce('b', null, vv.name),
        ce('div', { className: 'vid' }, vv.voice_id),
        bits.length ? ce('div', { className: 'aia-meta' },
          bits.map(function (b, i) { return ce('span', { className: 'aia-chip', key: i }, b); })
        ) : null,
        vv.labels.description ? ce('div', { className: 'aia-eff' }, vv.labels.description) : null,
        ce('div', { className: 'aia-vbtns' },
          ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm',
            disabled: !vv.preview_url,
            title: vv.preview_url ? 'Play the ElevenLabs sample' : 'This voice has no sample clip',
            onClick: function () { playPreview(vv.preview_url); }
          }, 'Preview'),
          ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm',
            title: 'Render the clinical test line in this voice, without assigning it',
            onClick: function () { auditionVoice(profile, vv); }
          }, 'Hear the clinical line'),
          ce('button', {
            type: 'button', className: 'btn ' + (isOn ? 'btn-outline' : 'btn-primary') + ' btn-sm',
            disabled: isOn,
            onClick: function () { assign(profile, vv); }
          }, isOn ? 'Assigned' : 'Assign')
        )
      );
    }

    function profileRow(profile, idx) {
      var cur = profiles[profile];
      var known = cur ? voiceById[cur.voiceId] : null;
      var open = openFor === profile;
      var testMine = test.profile === profile ? test : null;

      return ce('div', { className: 'aia-featrow' + (idx === 0 ? ' first' : ''), key: profile },
        ce('div', { className: 'aia-row' },
          ce('div', { style: { minWidth: 0 } },
            ce('div', { className: 'aia-featname' }, VOICE_PROFILE_LABEL[profile] || profile),
            ce('div', { className: 'aia-featid' }, profile)
          ),
          cur
            ? ce('span', { className: 'aia-chip verified' }, 'studio voice')
            : ce('span', { className: 'aia-chip unknown' }, 'device voice')
        ),
        ce('p', { className: 'aia-desc' }, VOICE_PROFILE_USE[profile] || ''),

        cur ? ce('div', { className: 'aia-eff' },
          ce('b', null, (cur.name || (known ? known.name : '') || 'unnamed')),
          ' · ', ce('span', { className: 'aia-code' }, cur.voiceId),
          (cat.status === 'loaded' && !known)
            ? ce('span', { className: 'aia-cellwarn bad' },
                'This voice id is not in the ElevenLabs catalog any more. It will 404 and every line in this role ' +
                'will fall back to the device voice. Pick another one.')
            : null
        ) : ce('div', { className: 'aia-eff' },
          'No studio voice assigned, so this role uses the student\'s own device voice. That is a working ' +
          'state, not a broken one - it is exactly what Free and Plus hear.'),

        ce('div', { className: 'aia-run' },
          ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm',
            onClick: function () { setOpenFor(open ? '' : profile); setFilter(''); }
          }, open ? 'Close the voice list' : (cur ? 'Change voice' : 'Choose a voice')),
          cur ? ce('button', {
            type: 'button', className: 'btn btn-primary btn-sm',
            disabled: test.status === 'busy',
            onClick: function () { testProfile(profile); }
          }, (testMine && testMine.status === 'busy') ? 'Rendering...' : 'Test this voice') : null,
          cur ? ce('select', {
            className: 'aia-select', style: { width: 'auto', minWidth: 170 },
            value: cur.modelId || DEFAULT_TTS_MODEL,
            'aria-label': 'ElevenLabs model for the ' + profile + ' role',
            onChange: function (e) { setProfileModel(profile, e.target.value); }
          }, models.map(function (m) {
            return ce('option', { key: m.id, value: m.id }, m.label + ' (' + m.latency + ')');
          })) : null,
          cur ? ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm',
            onClick: function () { unassign(profile); }
          }, 'Use the device voice') : null
        ),

        testMine && testMine.msg ? ce('div', {
          className: 'aia-note ' + (testMine.status === 'ok' ? 'ok' : testMine.status === 'err' ? 'err' : testMine.status === 'warn' ? 'warn' : 'info'),
          role: 'status'
        }, testMine.msg) : null,

        open ? ce('div', null,
          ce('div', { className: 'aia-row', style: { marginTop: 10 } },
            ce('input', {
              className: 'aia-input', style: { flex: '1 1 200px' }, type: 'search',
              placeholder: 'Filter by name, accent, age, gender...',
              value: filter, 'aria-label': 'Filter voices',
              onChange: function (e) { setFilter(e.target.value); }
            }),
            ce('button', {
              type: 'button', className: 'btn btn-outline btn-sm',
              disabled: cat.status === 'loading',
              onClick: loadVoices
            }, cat.status === 'loading' ? 'Loading...' : 'Reload')
          ),
          cat.status === 'loading' ? ce('p', { className: 'aia-empty' }, 'Loading the ElevenLabs catalog...') : null,
          cat.status === 'error' ? ce('div', { className: 'aia-note err' }, cat.error) : null,
          cat.status === 'loaded' && shownCount === 0
            ? ce('p', { className: 'aia-empty' }, 'No voice matches "' + filter + '".') : null,
          grouped.keys.map(function (k) {
            return ce('div', { key: k },
              ce('div', { className: 'aia-vgroup' }, k + ' (' + grouped.map[k].length + ')'),
              ce('div', { className: 'aia-vpick' },
                grouped.map[k].map(function (vv) { return voiceCard(profile, vv); }))
            );
          })
        ) : null
      );
    }

    /* ---- render ---- */

    if (!v) {
      return ce('div', null, ce('div', { className: 'aia-card alert' },
        ce('p', { className: 'aia-h' }, 'js/voice.js is not loaded'),
        ce('p', { className: 'aia-desc' },
          'Studio voices live behind ', ce('span', { className: 'aia-code' }, 'MM.voice.speak()'),
          ', so this tab needs js/voice.js on the page. Everything else in the panel still works, and ' +
          'students are unaffected: with no voice layer at all the app simply never speaks.')
      ));
    }

    return ce('div', null,

      /* ---- 1. WHAT THIS IS + THE MASTER SWITCH ---- */
      ce('div', { className: 'aia-card' },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'Studio voices (ElevenLabs)'),
          Toggle(config.voiceEnabled !== false, function (on) { writeCfg('voiceEnabled', on); },
            'Studio voices on or off site-wide')
        ),
        ce('p', { className: 'aia-desc' },
          'Pro and Instructor hear ElevenLabs. Free and Plus hear their own device\'s voices, which cost nothing ' +
          'and always work - so turning this off, running out of characters, or never casting a role is never a ' +
          'broken feature for anybody. It just means the device voice reads the line.'),
        ce('p', { className: 'aia-desc' },
          'Every line is rendered ONCE and shared: it is uploaded to Storage and published to ',
          ce('span', { className: 'aia-code' }, '/voiceCache/<hash>'),
          ', so the second student to hear a sentence pays nothing, on any device, forever.'),
        ce('div', { className: 'aia-meta' },
          ce('span', { className: 'aia-chip' + (assignedCount ? ' verified' : ' unknown') },
            assignedCount + ' of ' + order.length + ' roles cast'),
          ce('span', { className: 'aia-chip' }, allItems.length + ' scripted lines'),
          ce('span', { className: 'aia-chip' }, fmtChars(totalChars) + ' characters to voice them all'),
          ce('span', { className: 'aia-chip' }, '~' + fmtUsd(totalChars / 1000 * rate) + ' one time')
        ),
        config.enabled === false ? ce('div', { className: 'aia-note warn' },
          'The master AI switch on the Settings tab is OFF, which also stops studio voices for everyone except you.') : null,
        config.voiceEnabled === false ? ce('div', { className: 'aia-note info' },
          'Studio voices are paused. Students hear their device voices; the text AI is unaffected.') : null
      ),

      /* ---- 2. THE ELEVENLABS MONTHLY BUNDLE ---- */
      ce('div', { className: 'aia-card' },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'ElevenLabs monthly characters'),
          ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm',
            disabled: quota.status === 'loading', onClick: loadQuota
          }, quota.status === 'loading' ? 'Checking...' : 'Refresh')
        ),
        quota.status === 'loaded' ? ce('div', null,
          ce('div', { className: 'aia-money' },
            fmtChars(quota.used) + ' / ' + (quota.limit ? fmtChars(quota.limit) : 'unknown')),
          ce('div', { className: 'aia-bar tall' },
            ce('i', {
              style: {
                width: Math.min(100, quota.pct) + '%',
                background: quota.pct >= 90 ? 'var(--red)' : quota.pct >= 70 ? 'var(--orange)' : 'var(--accent)'
              }
            })),
          ce('div', { className: 'aia-meta' },
            ce('span', { className: 'aia-chip' }, quota.pct + '% used'),
            ce('span', { className: 'aia-chip' }, fmtChars(quota.remaining) + ' left'),
            quota.plan ? ce('span', { className: 'aia-chip' }, quota.plan + ' plan') : null,
            quota.resetsAt ? ce('span', { className: 'aia-chip' }, 'resets ' + fmtDate(quota.resetsAt)) : null
          ),
          quota.pct >= 90 ? ce('div', { className: 'aia-note warn' },
            'Nearly out. When the bundle runs dry every student silently falls back to their device voice and the ' +
            'app keeps working - but nothing new gets rendered until it resets or you top it up.') : null
        ) : null,
        quota.status === 'loading' ? ce('p', { className: 'aia-empty' }, 'Asking ElevenLabs...') : null,
        quota.status === 'error' ? ce('div', { className: 'aia-note err' }, quota.error) : null,
        ce('p', { className: 'aia-desc' },
          'This is the SITE\'s monthly bundle, which is a different thing from a student\'s daily character cap ' +
          'below. Running out of one says nothing about the other, and the two produce deliberately different ' +
          'messages so nobody is told off for your billing.')
      ),

      /* ---- 3. CASTING ---- */
      ce('div', { className: 'aia-card' },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'Cast a voice for each speaker'),
          ce('button', {
            type: 'button', className: 'btn btn-primary btn-sm',
            disabled: cat.status !== 'loaded' || !(cat.voices && cat.voices.length),
            onClick: autoAssignAll,
            title: cat.status === 'loaded'
              ? 'Score every catalog voice against what each role needs and fill them all in'
              : 'Load the voice catalog first'
          }, 'Auto-cast all roles')
        ),
        ce('p', { className: 'aia-desc' },
          'Writes to ', ce('span', { className: 'aia-code' }, 'aiConfig.voiceProfiles.<role>'),
          '. Nothing is hardcoded: a role with no voice here uses the device voice, and that is a perfectly good ' +
          'answer for four of the five if the budget only stretches to the patient.'),
        ce('p', { className: 'aia-desc' },
          'Auto-cast is a starting point, not a verdict. It matches each role against the live catalog\'s own ' +
          'gender / age / accent labels, never picks the same voice twice, and leaves a role alone rather than ' +
          'mis-cast it. Preview each one afterwards - the patient voice is the one students hear most, so it is ' +
          'worth being fussy about.'),
        normalizedTest ? ce('div', { className: 'aia-spoken' },
          ce('b', null, 'The test line, as the model will actually receive it: '),
          normalizedTest
        ) : null,
        ce('p', { className: 'aia-desc' },
          'That is the clinical normalizer at work. Flash v2.5 turns its own number handling off for speed, so ' +
          'every line is spelled out before it is sent - "92/58" becomes "ninety two over fifty eight" here, not ' +
          '"June fifty eighth" at the bedside.'),
        order.map(profileRow)
      ),

      /* ---- 4. DAILY CAPS + RATE ---- */
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Daily character limit per plan'),
        ce('p', { className: 'aia-desc' },
          'Counted server side at ', ce('span', { className: 'aia-code' }, '/voiceUsage/<uid>/<day>'),
          ' and completely separate from the message and image allowances. A student who runs out keeps every ' +
          'feature - the lines just come out in their device\'s voice for the rest of the day.'),
        ce('div', { className: 'aia-nums', style: { marginTop: 10 } },
          TIER_ORDER.map(function (t) {
            var val = (config.voiceLimits && typeof config.voiceLimits[t] === 'number')
              ? config.voiceLimits[t] : 0;
            var premium = (t === 'pro' || t === 'instructor');
            return ce('div', { className: 'aia-field', key: t },
              ce('label', { htmlFor: 'aia-vl-' + t, style: { color: TIER_COLOR[t] } }, TIER_LABEL[t]),
              ce('input', {
                id: 'aia-vl-' + t, className: 'aia-input', type: 'number', step: 100, min: -1,
                defaultValue: val, key: t + '-' + val, disabled: !premium,
                onBlur: function (e) { setVoiceLimit(t, e.target.value); },
                onKeyDown: function (e) { if (e.key === 'Enter') e.target.blur(); }
              }),
              ce('div', {
                style: {
                  color: val < -1 ? 'var(--orange-fg,var(--orange))' : 'var(--text3)',
                  fontSize: 'var(--fs-xs,12px)', marginTop: 4
                }
              }, premium ? voiceLimitPhrase(val)
                         : 'device voices only - the server refuses studio voices on this plan whatever this says')
            );
          })
        ),
        ce('div', { className: 'aia-nums', style: { marginTop: 14 } },
          ce('div', { className: 'aia-field' },
            ce('label', { htmlFor: 'aia-vrate' }, 'Dollars per 1000 characters'),
            ce('input', {
              id: 'aia-vrate', className: 'aia-input', type: 'number', step: 0.01, min: 0,
              defaultValue: rate, key: 'rate-' + rate,
              onBlur: function (e) { setRate(e.target.value); },
              onKeyDown: function (e) { if (e.key === 'Enter') e.target.blur(); }
            }),
            ce('div', { style: { color: 'var(--text3)', fontSize: 'var(--fs-xs,12px)', marginTop: 4 } },
              'Creator ~0.22, Pro ~0.20, Scale ~0.17')
          )
        ),
        ce('p', { className: 'aia-desc' },
          'ElevenLabs bills characters against a monthly bundle and returns no per-request price, so unlike the ' +
          'text AI every dollar figure on this tab is an ESTIMATE from this rate. The character counts are exact.')
      ),

      /* ---- 5. SPEND + CACHE ---- */
      ce('div', { className: 'aia-card' },
        ce('div', { className: 'aia-row' },
          ce('p', { className: 'aia-h' }, 'What it has cost, and what the cache has saved'),
          ce('button', {
            type: 'button', className: 'btn btn-outline btn-sm',
            disabled: cache.status === 'loading',
            onClick: function () { loadCache(); loadSpend(); }
          }, cache.status === 'loading' ? 'Loading...' : 'Refresh')
        ),
        ce('div', { className: 'aia-nums' },
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, cache.status === 'loaded' ? String(cache.count) : '-'),
            ce('div', { className: 'stat-label' }, 'clips in the shared cache')),
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, cache.status === 'loaded' ? fmtChars(cache.saved) : '-'),
            ce('div', { className: 'stat-label' }, 'characters saved by cache hits')),
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' },
              cache.status === 'loaded' ? fmtUsd(cache.saved / 1000 * rate) : '-'),
            ce('div', { className: 'stat-label' }, 'not spent, because of the cache')),
          ce('div', { className: 'stat-box' },
            ce('div', { className: 'stat-value' }, cache.status === 'loaded' ? fmtBytes(cache.bytes) : '-'),
            ce('div', { className: 'stat-label' }, 'audio stored'))
        ),
        cache.status === 'error' ? ce('div', { className: 'aia-note warn' },
          'The clip index could not be read (' + cache.error + '). Nothing breaks visibly when that happens - ' +
          'every student just silently pays again for lines somebody already bought. The rule is at the bottom of ' +
          'this tab.') : null,

        spend.status === 'loaded' ? ce('div', null,
          ce('div', { className: 'aia-srow' },
            ce('span', { className: 'lbl' }, 'Today'),
            ce('span', null, fmtChars(num6(spend.today && spend.today.chars)) + ' chars · ' +
              fmtUsd(micro2usd(num6(spend.today && spend.today.total6))) + ' est · ' +
              num6(spend.today && spend.today.calls) + ' rendered')),
          ce('div', { className: 'aia-srow' },
            ce('span', { className: 'lbl' }, 'Last 14 days'),
            ce('span', null, fmtChars(spend.weekChars) + ' chars · ' + fmtUsd(micro2usd(spend.week)) + ' est')),
          (spend.today && spend.today.byProfile) ? ce('div', null,
            Object.keys(spend.today.byProfile).map(function (p) {
              return ce('div', { className: 'aia-srow', key: p },
                ce('span', { className: 'lbl' }, VOICE_PROFILE_LABEL[p] || p),
                ce('span', null, fmtChars(num6(spend.today.byProfile[p].chars)) + ' chars'));
            })
          ) : null
        ) : null,
        spend.status === 'denied' ? ce('div', { className: 'aia-note warn' },
          'The voice spend ledger is unreadable (' + spend.error + '). The feature is unaffected - only this ' +
          'number is. The ledger is written by the Netlify function, which needs FIREBASE_DB_SECRET set to get ' +
          'past the "write: false" rule on /voiceSpend.') : null,

        ce('p', { className: 'aia-desc' },
          'This session, in this tab: ',
          (function () {
            var s = v.stats();
            return s.hits + ' cache hits, ' + s.generated + ' rendered, ' + s.fallbacks +
              ' fell back to the device voice' + (s.uploadFailures ? ', ' + s.uploadFailures + ' uploads failed' : '') + '.';
          })())
      ),

      /* ---- 6. PRE-GENERATE ---- */
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'Pre-generate every scripted line'),
        ce('p', { className: 'aia-desc' },
          'The 18 simulations contain ' + allItems.length + ' scripted dialogue lines, and they are the same ' +
          'lines for every student who ever installs this app. Render them once here and every student reads ' +
          'them out of the shared cache for free. Export them afterwards and they cost nothing even to look up.'),
        ce('p', { className: 'aia-desc' },
          castItems.length
            ? (castItems.length + ' of ' + allItems.length + ' lines have a voice cast for their speaker (' +
               fmtChars(totalChars) + ' characters, about ' + fmtUsd(totalChars / 1000 * rate) +
               ' at your rate). Anything already cached is skipped without spending a character, so re-running ' +
               'is safe and the run is resumable.')
            : 'No lines can be rendered yet: cast at least one speaker role above. (Scripted dialogue in this ' +
              'app is spoken by the patient and by family members.)'),

        ce('div', { className: 'aia-run' },
          ce('button', {
            type: 'button', className: 'btn btn-primary btn-sm',
            disabled: run.running || !castItems.length,
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
            disabled: run.running || exp.busy || !castItems.length,
            onClick: exportBundle
          }, exp.busy ? 'Exporting...' : 'Export as static bundle')
        ),

        run.started ? ce('div', null,
          ce('div', { className: 'aia-runbar' }, ce('i', { style: { width: pctRun + '%' } })),
          ce('div', { className: 'aia-row', style: { marginTop: 8, fontSize: 'var(--fs-sm,13px)' } },
            ce('span', { style: { color: 'var(--text2)' } },
              run.done + ' of ' + run.total + (run.label ? ' · ' + run.label : '')),
            ce('span', { style: { fontWeight: 700 } },
              fmtChars(run.chars) + ' chars · ' + fmtUsd(run.costUsd))
          ),
          ce('div', { className: 'aia-meta' },
            ce('span', { className: 'aia-chip' }, run.generated + ' rendered'),
            ce('span', { className: 'aia-chip' }, run.skipped + ' already cached'),
            run.errors.length ? ce('span', { className: 'aia-chip warn' }, run.errors.length + ' failed') : null
          ),
          run.finished && !run.running ? ce('div', { className: 'aia-note ok' },
            'Done. ' + run.generated + ' rendered for about ' + fmtUsd(run.costUsd) + ', ' + run.skipped +
            ' were already cached. Export the bundle now so this never has to run again.') : null,
          run.stopped && !run.running ? ce('div', { className: 'aia-note warn' },
            'Stopped at item ' + (cursorRef.current + 1) + ' of ' + run.total +
            '. Nothing already rendered was lost - Resume picks up from here, and anything cached is skipped.') : null,
          run.errors.length ? ce('div', {
            className: 'aia-errlist', tabIndex: 0, role: 'region', 'aria-label': 'Pre-generate errors'
          }, run.errors.map(function (msg, i2) { return ce('div', { key: i2 }, msg); })) : null
        ) : null,

        exp.busy ? ce('div', null,
          ce('div', { className: 'aia-runbar' },
            ce('i', { style: { width: (exp.total ? Math.round((exp.done / exp.total) * 100) : 0) + '%' } })),
          ce('p', { className: 'aia-desc' }, exp.msg)
        ) : (exp.msg ? ce('div', { className: 'aia-note ' + (exp.count ? 'ok' : 'warn') }, exp.msg) : null),

        exp.skipped && exp.skipped.length ? ce('div', { className: 'aia-note warn' },
          exp.skipped.length + ' line' + (exp.skipped.length === 1 ? ' was' : 's were') +
          ' left out because no cached clip could be read for them: ' + exp.skipped.slice(0, 6).join(', ') +
          (exp.skipped.length > 6 ? '...' : '')) : null,

        exp.text ? ce('div', { className: 'aia-pre', style: { maxHeight: 200, overflow: 'auto' } },
          exp.text.slice(0, 2000) + '\n... (truncated for display - use the download button)') : null,

        ce('p', { className: 'aia-desc' },
          'The export writes ', ce('span', { className: 'aia-code' }, 'window.MM_STATIC_VOICE'),
          ' keyed by clip hash. Save it as ', ce('span', { className: 'aia-code' }, 'data/static-voice.js'),
          ' and load it before ', ce('span', { className: 'aia-code' }, 'js/voice.js'), '. ',
          'Be warned that mp3 base64 is heavy - budget 20-30 KB a line, so all ' + allItems.length +
          ' lines is a multi-megabyte file. Exporting only the most-heard scenarios is often the better trade.')
      ),

      /* ---- 7. THE RULES THAT MAKE THE SHARED CACHE WORK ---- */
      ce('div', { className: 'aia-card' },
        ce('p', { className: 'aia-h' }, 'The /voiceCache security rule'),
        ce('p', { className: 'aia-desc' },
          'The shared index is what stops the second student paying for a line the first one already bought. ' +
          'If it is not readable nothing breaks visibly - every student silently renders their own copy. ' +
          'Paste this into Firebase -> Realtime Database -> Rules:'),
        ce('div', { className: 'aia-pre' }, VOICE_CACHE_RULES),
        ce('p', { className: 'aia-desc' },
          'Read is open to any signed-in user on purpose: a cache nobody can read is not a cache. Writing a new ' +
          'entry is allowed only where one does not already exist, so a student can publish a clip they just ' +
          'paid for but can never overwrite or poison somebody else\'s.'),
        ce('p', { className: 'aia-desc', style: { marginTop: 12 } },
          'And the matching Cloud Storage rules, which live in a different console tab (Storage -> Rules):'),
        ce('div', { className: 'aia-pre' }, VOICE_STORAGE_RULES)
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

    /* clearing.busy is state, so it is not true until React re-renders. Two
     * clicks inside one task therefore both saw busy:false and both ran the
     * delete - on the one control in this panel that destroys data and bills
     * every student again. A ref flips synchronously. */
    var clearingRef = useRef(false);

    var load = useCallback(function () {
      var im = images();
      if (!im || typeof im.listCache !== 'function') {
        setCache({ status: 'error', entries: {}, error: 'js/images.js is not loaded on this page.' });
        return;
      }
      setCache(function (p) { return { status: 'loading', entries: p.entries, error: '' }; });
      // .then() turns a THROWN error into a rejection; calling im.listCache()
      // bare does not, and a synchronous throw out of another file's function
      // escapes straight through a React effect and unmounts the tree.
      Promise.resolve().then(function () { return im.listCache(); }).then(function (res) {
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
      if (clearingRef.current) return;
      clearingRef.current = true;
      setClearing({ busy: true, msg: '', ok: false });
      Promise.resolve().then(function () { return im.clearCache(); }).then(function (res) {
        clearingRef.current = false;
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
        clearingRef.current = false;
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

  /* The pure half of the ranking feature - no React, no Firebase, no DOM. It is
   * exported so the parsing and scoring rules can be tested directly instead of
   * through a rendered panel, which is the only way a paste-parser ever stays
   * honest. Nothing in the app reads these; treat them as internal. */
  AIAdminPanel.ranking = {
    slugKey: slugKey,
    parseParams: parseParams,
    fmtParams: fmtParams,
    effPrice: effPrice,
    priceBoundsOf: priceBoundsOf,
    fitParts: fitParts,
    sortRows: sortRows,
    SORT_KEYS: SORT_KEYS,
    parseRankingPaste: parseRankingPaste,
    matchRankEntry: matchRankEntry,
    buildImportPreview: buildImportPreview,
    applyRankImport: applyRankImport,
    clearHealthRanks: clearHealthRanks,
    normalizeModelMeta: normalizeModelMeta,
    metaFor: metaFor,
    SEED_HEALTH_RANKS: SEED_HEALTH_RANKS,
    FIT_EXPLAIN: FIT_EXPLAIN
  };

  /* Same deal for the recommended-setup half: the merge and the diff are pure
   * functions of (currentConfig, recommendedConfig), so they are testable
   * without Firebase, without React and without a rendered panel. The button
   * calls exactly these. */
  AIAdminPanel.recommended = {
    recommendedConfig: recommendedConfig,
    buildRecommendedWrite: buildRecommendedWrite,
    recommendedPreview: recommendedPreview,
    recommendedKept: recommendedKept,
    modelPriceLabel: modelPriceLabel
  };

  window.AIAdminPanel = AIAdminPanel;
})();
