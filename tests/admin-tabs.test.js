/* ============================================================================
   admin-tabs.test.js
   ----------------------------------------------------------------------------
   Renders EVERY tab of the AI admin panel, in every state that matters.

   Why this exists: `VoicesTab` shipped calling arr()/obj()/str()/keys() -
   helper idioms that exist in js/voice.js and js/ai.js but NOT in
   js/ai-admin.js. `node --check` passed (they are syntactically valid calls),
   1,583 other assertions passed, and the tab still died with
   "ReferenceError: arr is not defined" the first time a human opened it.

   A reference error inside a render function is invisible until that exact
   function renders. So: render all of them, in the states the owner actually
   hits - catalog not loaded, loaded, failed, junk - and assert no error
   boundary fires. Plus a static sweep for the same class of mistake on code
   paths no test happens to reach.

   Run:  node tests/run.js admin-tabs
   ========================================================================== */
'use strict';

/* Node >= 21 makes `navigator` accessor-only; the harness assigns to it. */
(function () {
  try {
    var d = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    if (d && d.writable !== true) {
      Object.defineProperty(globalThis, 'navigator',
        { value: undefined, writable: true, configurable: true });
    }
  } catch (e) { /* older Node is fine */ }
})();

var fs = require('fs');
var path = require('path');
var H = require('./_harness.js');

var TABS = ['spend', 'settings', 'models', 'routing', 'tiers', 'voices', 'people'];

/* A believable ElevenLabs catalog: enough label variety for autoCast to score
   against, including a child voice and a narration voice it should avoid. */
var VOICE_CATALOG = [
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'premade',
    labels: { accent: 'american', age: 'young', gender: 'female', use_case: 'conversational' } },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', category: 'premade',
    labels: { accent: 'american', age: 'middle aged', gender: 'female', use_case: 'calm' } },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Adam', category: 'premade',
    labels: { accent: 'american', age: 'middle aged', gender: 'male', use_case: 'narration' } },
  { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', category: 'premade',
    labels: { accent: 'american', age: 'child', gender: 'female', use_case: 'kid' } },
  { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', category: 'premade',
    labels: { accent: 'american', age: 'middle aged', gender: 'male', use_case: 'emotional' } },
  { voice_id: 'VR6AewLTigWG4xSO9mYs', name: 'Arnold', category: 'cloned',
    labels: { accent: 'british', age: 'old', gender: 'male', use_case: 'news' } }
];

var MODEL_CATALOG = [
  { id: 'deepseek/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash',
    promptPrice: '0.00000008', completionPrice: '0.00000018',
    contextLength: 1049000, isFree: false, outputModalities: ['text'] },
  { id: 'google/gemini-2.5-flash-image', name: 'Nano Banana',
    promptPrice: '0.0000003', completionPrice: '0.0000025', imagePrice: '0.0000003',
    contextLength: 32768, isFree: false, outputModalities: ['image'], canOutputImage: true }
];

function defaultFetch(url, init) {
  var body = {};
  try { body = JSON.parse((init && init.body) || '{}'); } catch (e) {}
  if (body.action === 'listVoices') return Promise.resolve(H.jsonResponse({ voices: VOICE_CATALOG }));
  if (body.action === 'listModels') {
    return Promise.resolve(H.jsonResponse({ models: MODEL_CATALOG, modality: body.modality || 'text' }));
  }
  if (body.action === 'quota') {
    return Promise.resolve(H.jsonResponse({ used: 4200, limit: 100000, remaining: 95800, plan: 'creator' }));
  }
  if (body.action === 'speak') return Promise.resolve(H.ttsOk());
  return Promise.resolve(H.jsonResponse({ ok: true }));
}

function adminWorld(opts) {
  opts = opts || {};
  var world = H.makeWorld({
    owner: true,
    tier: 'instructor',
    uid: 'owner-1',
    aiConfig: {
      enabled: true,
      tiers: {
        free: { models: [], dailyLimit: 25, maxTokens: 1024 },
        plus: { models: ['deepseek/deepseek-v4-flash-0731'], dailyLimit: 200, maxTokens: 2048 },
        pro: { models: ['deepseek/deepseek-v4-flash-0731'], dailyLimit: 600, maxTokens: 4096 },
        instructor: { models: ['*'], dailyLimit: -1, maxTokens: 8192 }
      },
      voiceProfiles: opts.voiceProfiles || {},
      voiceLimits: { free: 0, plus: 0, pro: 20000, instructor: -1 }
    },
    fetchImpl: opts.fetchImpl || defaultFetch
  });
  world.loadAiThenPatch();
  world.load('js/voice.js');
  world.load('js/ai-admin.js');
  return world;
}

function mount(world) {
  var w = world.window;
  return H.renderInto(w, w.React.createElement(w.AIAdminPanel, { firebaseDb: world.db }));
}

/** Click a tab by visible label, tolerating emoji prefixes. */
function openTab(view, name) {
  var rx = new RegExp(name, 'i');
  var btn = view.all('button').filter(function (b) { return rx.test((b.textContent || '').trim()); })[0];
  if (btn) view.click(btn);
  return btn;
}

function findBtn(view, rx) {
  return view.all('button').filter(function (b) { return rx.test(b.textContent || ''); })[0] || null;
}

/** The two assertions every rendered state must satisfy. */
function assertClean(t, view, where) {
  var txt = view.text();
  t.notContains(txt, 'is not defined',
    where + ': no ReferenceError (the arr/obj/str/keys class of bug)');
  t.notContains(txt, 'hit a problem', where + ': the error boundary did not trip');
}

module.exports = {
  name: 'admin-tabs — every AI admin tab renders',

  run: function (t) {
    /* ==================================================================== */
    /* 1. mount + every tab                                                 */
    /* ==================================================================== */
    var world = adminWorld();
    var w = world.window;
    var view = null;

    t.group('the panel mounts');
    t.eq(typeof w.AIAdminPanel, 'function', 'AIAdminPanel is exported');
    t.noThrow(function () { view = mount(world); }, 'it renders for the owner without throwing');
    if (!view) { world.cleanup(); return; }

    return H.actTick(80).then(function () {
      t.ok(view.text().length > 50, 'it renders real content once the config loads');
      t.notContains(view.text(), 'Owner only', 'the owner is not shown the owner-only wall');

      t.group('every tab renders — the regression this suite exists for');
      TABS.forEach(function (tab) {
        var threw = null;
        try { openTab(view, tab); } catch (e) { threw = e; }
        t.ok(!threw, 'the "' + tab + '" tab opens without throwing' + (threw ? ' — ' + threw.message : ''));
        assertClean(t, view, 'the "' + tab + '" tab');
        t.ok(view.text().length > 40, 'the "' + tab + '" tab renders content');
      });

      /* ------------------------------------------------------------------ */
      t.group('static sweep: no borrowed helper vocabulary');

      /* The other half of the guard. A render path no test reaches can still
         call an undefined helper; this catches it without executing it. */
      var src = fs.readFileSync(path.join(H.APP_ROOT, 'js/ai-admin.js'), 'utf8');
      ['arr', 'obj', 'str', 'keys', 'numOr', 'isFn'].forEach(function (fn) {
        var declared = new RegExp('function\\s+' + fn + '\\s*\\(|var\\s+' + fn + '\\s*=').test(src);
        var called = new RegExp('(^|[^.\\w$])' + fn + '\\s*\\(', 'm').test(src);
        t.ok(!called || declared,
          'ai-admin.js does not call ' + fn + '() without defining it' +
          (called && !declared ? ' — IT DOES, and that is a ReferenceError waiting to render' : ''));
      });

      view.unmount();
      world.cleanup();
    })

    /* ==================================================================== */
    /* 2. Voices tab with a working catalog + auto-cast                     */
    /* ==================================================================== */
    .then(function () {
      t.group('Voices tab: catalog loads and auto-cast works');
      var W = adminWorld();
      var v = mount(W);

      return H.actTick(80).then(function () {
        openTab(v, 'voices');
        return H.actTick(40);
      }).then(function () {
        assertClean(t, v, 'Voices tab before loading');

        var loadBtn = findBtn(v, /load|catalog|refresh/i);
        t.ok(!!loadBtn, 'the Voices tab offers a way to load the catalog');
        if (loadBtn) t.noThrow(function () { v.click(loadBtn); }, 'clicking load does not throw');
        return H.actTick(120);
      }).then(function () {
        assertClean(t, v, 'Voices tab after the catalog loads');

        var castBtn = findBtn(v, /auto-cast/i);
        t.ok(!!castBtn, 'the "Auto-cast all roles" button is present');
        if (castBtn) t.noThrow(function () { v.click(castBtn); }, 'auto-cast runs without throwing');
        return H.actTick(120);
      }).then(function () {
        assertClean(t, v, 'Voices tab after auto-cast');

        var written = W.db.writesTo(/voiceProfiles/);
        t.ok(written.length >= 1, 'auto-cast wrote at least one voice profile (wrote ' + written.length + ')');

        var assigned = {};
        written.forEach(function (wr) {
          var role = wr.path.split('/').pop();
          if (wr.value && wr.value.voiceId) assigned[role] = wr.value.voiceId;
        });
        var ids = Object.keys(assigned).map(function (k) { return assigned[k]; });
        var uniq = ids.filter(function (x, i) { return ids.indexOf(x) === i; });
        t.eq(ids.length, uniq.length, 'no voice is cast in two roles at once');

        if (assigned.child) {
          t.eq(assigned.child, 'MF3mGyEYCl7XYWbV9V6O',
            'the child role got the child-labelled voice, not an adult doing an impression');
        }
        Object.keys(assigned).forEach(function (role) {
          if (role === 'family') return;
          t.ok(assigned[role] !== 'VR6AewLTigWG4xSO9mYs',
            'the british news-narration voice was not cast as the ' + role);
        });

        v.unmount();
        W.cleanup();
      });
    })

    /* ==================================================================== */
    /* 3. catalog fails to load                                             */
    /* ==================================================================== */
    .then(function () {
      t.group('Voices tab degrades when the catalog cannot load');
      var W = adminWorld({
        fetchImpl: function () {
          return Promise.resolve(H.errorResponse(500, { error: 'server', message: 'boom' }));
        }
      });
      var v = mount(W);

      return H.actTick(80).then(function () {
        openTab(v, 'voices');
        return H.actTick(40);
      }).then(function () {
        var loadBtn = findBtn(v, /load|catalog|refresh/i);
        if (loadBtn) t.noThrow(function () { v.click(loadBtn); }, 'a failing catalog load does not throw');
        return H.actTick(120);
      }).then(function () {
        assertClean(t, v, 'Voices tab on the failure path');

        var castBtn = findBtn(v, /auto-cast/i);
        if (castBtn) {
          t.ok(castBtn.disabled === true || castBtn.hasAttribute('disabled'),
            'auto-cast is disabled while there is no catalog to cast from');
          t.noThrow(function () { v.click(castBtn); }, 'clicking a disabled auto-cast is harmless');
        }
        v.unmount();
        W.cleanup();
      });
    })

    /* ==================================================================== */
    /* 4. catalog full of junk                                              */
    /* ==================================================================== */
    .then(function () {
      t.group('Voices tab survives a catalog of junk');
      var W = adminWorld({
        fetchImpl: function (url, init) {
          var body = {};
          try { body = JSON.parse((init && init.body) || '{}'); } catch (e) {}
          if (body.action === 'listVoices') {
            /* every shape a real API might return on a bad day */
            return Promise.resolve(H.jsonResponse({ voices: [
              null, undefined, 'a string', 42, [],
              {}, { voice_id: '' }, { voice_id: 'ok-1' },
              { voice_id: 'ok-2', labels: null },
              { voice_id: 'ok-3', labels: 'not an object' },
              { voice_id: 'ok-4', name: null, category: 7 }
            ] }));
          }
          return defaultFetch(url, init);
        }
      });
      var v = mount(W);

      return H.actTick(80).then(function () {
        openTab(v, 'voices');
        return H.actTick(40);
      }).then(function () {
        var loadBtn = findBtn(v, /load|catalog|refresh/i);
        if (loadBtn) t.noThrow(function () { v.click(loadBtn); }, 'a junk catalog does not throw on load');
        return H.actTick(120);
      }).then(function () {
        assertClean(t, v, 'Voices tab with a junk catalog');
        var castBtn = findBtn(v, /auto-cast/i);
        if (castBtn && !castBtn.disabled) {
          t.noThrow(function () { v.click(castBtn); }, 'auto-cast survives a catalog of junk');
        }
        return H.actTick(80);
      }).then(function () {
        assertClean(t, v, 'Voices tab after casting from junk');
        v.unmount();
        W.cleanup();
      });
    })

    /* ==================================================================== */
    /* 5. autoCast as a pure function — hostile input                        */
    /* ==================================================================== */
    .then(function () {
      t.group('autoCast never throws on hostile input');
      var W = adminWorld();
      var cast = W.window.AIAdminPanel && W.window.AIAdminPanel.autoCast;

      if (typeof cast !== 'function') {
        t.ok(true, 'autoCast is not exported — covered through the UI above instead');
      } else {
        [undefined, null, [], {}, 'string', 42,
         [null], [undefined], [{}], [{ voice_id: null }], [{ labels: 'x' }],
         [{ voice_id: 'a', labels: { gender: null, age: 7 } }]
        ].forEach(function (input, i) {
          t.noThrow(function () { cast(input); }, 'autoCast survives hostile input #' + i);
        });
        var picks = cast(VOICE_CATALOG);
        t.ok(picks && typeof picks === 'object', 'autoCast returns an object for a real catalog');
        var vals = Object.keys(picks).map(function (k) { return picks[k]; });
        t.eq(vals.length, vals.filter(function (x, i) { return vals.indexOf(x) === i; }).length,
          'autoCast never reuses a voice across roles');
      }
      W.cleanup();
    })

    /* ==================================================================== */
    /* 6. non-owner                                                          */
    /* ==================================================================== */
    .then(function () {
      t.group('a non-owner sees the wall, not the panel');
      var W = H.makeWorld({ tier: 'pro', uid: 'student-1' });
      W.loadAiThenPatch();
      W.load('js/voice.js');
      W.load('js/ai-admin.js');
      var v = null;
      t.noThrow(function () { v = mount(W); }, 'the panel renders for a non-owner without throwing');

      return H.actTick(60).then(function () {
        if (v) {
          t.contains(v.text(), 'Owner only', 'a pro student is stopped at the owner wall');
          assertClean(t, v, 'the owner wall');
          v.unmount();
        }
        W.cleanup();
      });
    });
  }
};
