/* =============================================================================
 * sim-engine.js - MedMaster Interactive Clinical Simulation Engine
 * -----------------------------------------------------------------------------
 * Globals exported:
 *   window.SimulationHub     - top level page component (mount this)
 *   window.SimEngine         - pure logic core (actions, guards, scoring)
 *   window.ScenarioBrowser   window.SimPreBrief      window.SimRunner
 *   window.VitalsMonitor     window.VitalSparkline   window.SimActionPanel
 *   window.SimEventLog       window.SimChartViewer   window.PatientTalkPanel
 *   window.SimSBARPanel      window.SimDoseGate      window.SimDebrief
 *   window.SimQuestionRound
 *
 * No JSX. No ES modules. No optional chaining. React via window.React.
 * Everything degrades gracefully with zero AI and zero voice.
 * ========================================================================== */
(function () {
  'use strict';

  if (!window.React) { return; }
  var ce = React.createElement;
  var useState = React.useState, useEffect = React.useEffect,
      useRef = React.useRef, useMemo = React.useMemo,
      useCallback = React.useCallback;

  /* ---------------------------------------------------------------------- *
   * 0. Constants
   * ---------------------------------------------------------------------- */
  var TIME_SCALE = 2;          // 1 real second = 2 simulated seconds
  var EXAM_SCALE = 3;          // exam mode deteriorates faster
  var TICK_MS = 400;           // real-time ticker interval
  var COST_DEFAULT = 15;       // simulated seconds consumed by an action
  var COST_ASSESS = 20;
  var COST_DISTRACTOR = 30;
  var COST_CHART = 25;
  var PASS_PCT = 80;

  var MODES = [
    { id: 'guided', name: 'Guided', tag: 'Learn',
      blurb: 'Hints on demand, pause any time, feedback the moment you act.',
      bullets: ['Pause / resume the clock', 'Hint button on every action', 'Immediate rationale'] },
    { id: 'timed', name: 'Timed', tag: 'Practice',
      blurb: 'The real clock runs. Feedback is held back until the debrief.',
      bullets: ['Full simulated clock', 'Hints available', 'Silent scoring'] },
    { id: 'exam', name: 'Exam', tag: 'Test',
      blurb: 'No hints, harsher scoring, and the patient deteriorates faster.',
      bullets: ['No hints, no pause', 'Heavier error penalties', 'Faster deterioration'] }
  ];

  /* ---------------------------------------------------------------------- *
   * 1. Tiny utilities
   * ---------------------------------------------------------------------- */
  function arr(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }
  function obj(v) { return (v && typeof v === 'object') ? v : {}; }
  function str(v) { return (v === 0 || v) ? String(v) : ''; }
  function has(v) { return v !== null && v !== undefined && v !== ''; }
  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
  function uid(p) { return (p || 'x') + '-' + Math.random().toString(36).slice(2, 9); }
  function lower(v) { return str(v).toLowerCase(); }

  function parseNum(v) {
    if (typeof v === 'number') { return isFinite(v) ? v : null; }
    var m = /-?\d+(\.\d+)?/.exec(str(v));
    return m ? parseFloat(m[0]) : null;
  }
  function parseBP(v) {
    var m = /(\d+)\s*\/\s*(\d+)/.exec(str(v));
    return m ? { sys: parseInt(m[1], 10), dia: parseInt(m[2], 10) } : null;
  }
  function fmtClock(sec) {
    var s = Math.max(0, Math.round(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function reduceMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  function MMx() { return obj(window.MM); }
  function toast(msg, kind) {
    var MM = MMx();
    if (typeof MM.toast === 'function') { try { MM.toast(msg, kind || 'info'); } catch (e) {} }
  }
  /* Screen-reader announcer. Uses the shell's shared announcer when present,
     otherwise owns one off-screen live region. Used ONLY for threshold
     crossings - the vitals grid itself is deliberately not a live region. */
  var LIVE_ID = 'sim-live-region';
  function announce(msg, urgent) {
    var m = str(msg).trim();
    if (!m) { return; }
    var MM = MMx();
    if (typeof MM.announce === 'function') {
      try { MM.announce(m, !!urgent); return; } catch (e) {}
    }
    try {
      var n = document.getElementById(LIVE_ID);
      if (!n) {
        n = document.createElement('div');
        n.id = LIVE_ID;
        n.className = 'sim-sr';
        n.setAttribute('aria-atomic', 'true');
        document.body.appendChild(n);
      }
      n.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
      n.textContent = '';
      window.setTimeout(function () { n.textContent = m; }, 60);
    } catch (e) {}
  }
  function uniqBy(list, keyFn) {
    var seen = {}, out = [];
    arr(list).forEach(function (it) {
      var k = keyFn(it);
      if (!seen[k]) { seen[k] = 1; out.push(it); }
    });
    return out;
  }

  /* ---------------------------------------------------------------------- *
   * 2. Stylesheet (injected once)
   * ---------------------------------------------------------------------- */
  function injectStyles() {
    if (document.getElementById('sim-engine-styles')) { return; }
    var css = [
      /* ---- root / tints (all derived from the palette, never re-authored) ---- */
      '.sim-root{--sim-ok:var(--green);--sim-warn:var(--orange);--sim-bad:var(--red);',
      /* clinical severity has its own ramp - it is not the difficulty ramp */
      '--sim-vwarn:var(--zone-concerning);--sim-vbad:var(--zone-critical);',
      '--sim-ok-fg:var(--green-fg);--sim-warn-fg:var(--orange-fg);--sim-bad-fg:var(--red-fg);',
      '--sim-ok-bg:color-mix(in srgb,var(--green) 12%,var(--bg));',
      '--sim-warn-bg:color-mix(in srgb,var(--zone-concerning) 12%,var(--bg));',
      '--sim-bad-bg:color-mix(in srgb,var(--zone-critical) 12%,var(--bg));',
      '--sim-ok-br:color-mix(in srgb,var(--green) 45%,transparent);',
      '--sim-warn-br:color-mix(in srgb,var(--zone-concerning) 50%,transparent);',
      '--sim-bad-br:color-mix(in srgb,var(--zone-critical) 50%,transparent);',
      '--sim-acc-bg:color-mix(in srgb,var(--accent) 12%,var(--bg));',
      '--sim-acc-br:color-mix(in srgb,var(--accent) 45%,transparent);',
      'color:var(--text);}',
      '.sim-root *:focus-visible{outline:2px solid var(--accent);outline-offset:2px;',
      'border-radius:var(--r-sm);}',
      '.sim-root button{font-family:inherit;}',
      '.sim-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;',
      'clip:rect(0 0 0 0);white-space:nowrap;border:0;}',

      /* ---- generic bits ---- */
      '.sim-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;}',
      '.sim-head h2{margin:0;font-size:20px;font-weight:800;letter-spacing:.2px;}',
      '.sim-sub{color:var(--text2);font-size:13px;margin:2px 0 0;}',
      '.sim-spacer{flex:1 1 auto;}',
      '.sim-back{background:transparent;border:1px solid var(--border);color:var(--text2);',
      'padding:var(--sp-2) var(--sp-3);border-radius:var(--r-md);cursor:pointer;font-size:var(--fs-sm);',
      'font-weight:600;min-height:44px;transition:transform var(--dur-fast) ease,',
      'border-color var(--dur-fast) ease;}',
      '.sim-back:hover{color:var(--text);border-color:var(--accent);}',
      '.sim-back:active{transform:scale(.975);background:var(--surface3);}',
      '.sim-badge{display:inline-flex;align-items:center;gap:5px;font-size:var(--fs-2xs);font-weight:800;',
      'letter-spacing:.4px;text-transform:uppercase;padding:3px var(--sp-2);border-radius:var(--r-full);',
      'border:1px solid var(--border);color:var(--text2);background:var(--surface);}',
      '.sim-badge.ok{color:var(--sim-ok-fg);border-color:var(--sim-ok-br);background:var(--sim-ok-bg);}',
      '.sim-badge.warn{color:var(--sim-warn-fg);border-color:var(--sim-warn-br);background:var(--sim-warn-bg);}',
      '.sim-badge.bad{color:var(--sim-bad-fg);border-color:var(--sim-bad-br);background:var(--sim-bad-bg);}',
      '.sim-badge.acc{color:var(--accent-fg);border-color:var(--sim-acc-br);background:var(--sim-acc-bg);}',
      '.sim-ico{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;',
      'width:30px;height:30px;border-radius:var(--r-md);background:var(--surface3);color:var(--text);',
      'font-size:10px;font-weight:800;letter-spacing:.3px;}',
      '.sim-empty{padding:var(--sp-6);text-align:center;color:var(--text3);font-size:var(--fs-sm);}',

      /* ---- browser ---- */
      '.sim-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;}',
      '.sim-search{flex:1 1 200px;min-width:150px;background:var(--surface);border:1px solid var(--border);',
      'color:var(--text);padding:9px 12px;border-radius:var(--r-md);font-size:14px;}',
      '.sim-chip{background:var(--surface);border:1px solid var(--border);color:var(--text2);',
      'padding:var(--sp-2) var(--sp-3);border-radius:var(--r-full);font-size:var(--fs-xs);font-weight:700;',
      'cursor:pointer;min-height:44px;transition:transform var(--dur-fast) ease;}',
      '.sim-chip[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff;}',
      '.sim-chip:active{transform:scale(.975);}',
      '.sim-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;}',
      '.sim-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);',
      'padding:14px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:9px;',
      'transition:transform .16s ease,border-color .16s ease;width:100%;}',
      '.sim-card:hover{transform:translateY(-2px);border-color:var(--accent);}',
      '.sim-card-top{display:flex;gap:10px;align-items:flex-start;}',
      '.sim-card-title{font-size:15px;font-weight:800;line-height:1.25;}',
      '.sim-card-one{color:var(--text2);font-size:12.5px;line-height:1.45;}',
      '.sim-card-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}',
      '.sim-progress-wrap{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);',
      'padding:14px;margin-bottom:14px;}',
      '.sim-bar{height:8px;border-radius:var(--r-full);background:var(--surface3);overflow:hidden;}',
      '.sim-bar>span{display:block;height:100%;border-radius:var(--r-full);background:var(--accent);',
      'transition:width .5s ease;}',

      /* ---- prebrief ---- */
      '.sim-two{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;align-items:start;}',
      '.sim-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px;}',
      '.sim-panel h3{margin:0 0 10px;font-size:13px;font-weight:800;text-transform:uppercase;',
      'letter-spacing:.6px;color:var(--text2);}',
      '.sim-kv{display:flex;justify-content:space-between;gap:10px;padding:6px 0;',
      'border-bottom:1px solid var(--border);font-size:13px;}',
      '.sim-kv:last-child{border-bottom:0;}',
      '.sim-kv b{color:var(--text2);font-weight:700;}',
      '.sim-list{margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:var(--text);}',
      '.sim-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;}',
      '.sim-mode{background:var(--bg);border:2px solid var(--border);border-radius:var(--r-lg);padding:12px;',
      'text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:6px;}',
      '.sim-mode[aria-pressed="true"]{border-color:var(--accent);background:var(--sim-acc-bg);}',
      '.sim-mode h4{margin:0;font-size:15px;font-weight:800;display:flex;gap:7px;align-items:center;}',

      /* ---- live sim shell ---- */
      '.sim-live{display:flex;flex-direction:column;gap:12px;}',
      '.sim-topbar{position:sticky;top:0;z-index:20;background:var(--bg);padding-bottom:8px;}',
      '.sim-stage{display:grid;grid-template-columns:1fr 330px;gap:12px;align-items:start;}',

      /* ---- monitor ---- */
      '.sim-mon{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:12px;}',
      '.sim-mon-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;}',
      '.sim-pt-name{font-weight:800;font-size:15px;}',
      '.sim-clock{font-variant-numeric:tabular-nums;font-weight:800;font-size:18px;letter-spacing:.5px;}',
      '.sim-clock.low{color:var(--sim-bad);}',
      '.sim-vitals{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,104px),1fr));',
      'gap:var(--sp-2);}',
      '.sim-vital{background:var(--bg);border:1px solid var(--border);border-left:3px solid var(--border);',
      'border-radius:var(--r-md);padding:var(--sp-2) 9px;',
      'display:flex;flex-direction:column;gap:2px;position:relative;overflow:hidden;',
      'transition:border-color var(--dur-base) ease;}',
      '.sim-vital .lab{font-size:10px;font-weight:800;letter-spacing:.7px;color:var(--text3);',
      'text-transform:uppercase;display:flex;gap:4px;align-items:center;}',
      '.sim-vital .val{font-size:var(--fs-xl);font-weight:800;font-variant-numeric:tabular-nums;',
      'line-height:1.1;white-space:normal;overflow-wrap:anywhere;}',
      '.sim-vital .unit{font-size:10px;color:var(--text3);font-weight:700;}',
      '.sim-vital .dlt{font-size:var(--fs-2xs);font-weight:700;color:var(--text3);',
      'font-variant-numeric:tabular-nums;}',
      '.sim-vital.warn{border-color:var(--sim-warn-br);border-left-color:var(--sim-vwarn);',
      'background:var(--sim-warn-bg);}',
      '.sim-vital.warn .val,.sim-vital.warn .lab{color:var(--sim-warn-fg);}',
      '.sim-vital.crit{border-color:var(--sim-bad-br);border-left-color:var(--sim-vbad);',
      'background:var(--sim-bad-bg);}',
      '.sim-vital.crit .val,.sim-vital.crit .lab{color:var(--sim-bad-fg);}',
      /* a monitor alarm that never stops is wallpaper in 30 seconds - and that
         is alarm fatigue, the exact habit this app should train out */
      '.sim-vital.crit{animation:simPulse 1.5s ease-in-out 4;}',
      '@keyframes simPulse{0%,100%{box-shadow:0 0 0 0 transparent;}',
      '50%{box-shadow:0 0 0 4px color-mix(in srgb,var(--zone-critical) 20%,transparent);}}',
      /* the value CHANGED: cue the tile, never interpolate the number */
      '.sim-vital.changed{animation:simVitalCue .9s ease-out 1;}',
      '@keyframes simVitalCue{0%{background:var(--surface3);}100%{background:var(--bg);}}',
      '.sim-vital .spark{height:20px;margin-top:2px;opacity:.85;}',
      '.sim-vital .trendmark{font-size:10px;font-weight:800;}',
      '.sim-mon-text{margin-top:9px;display:grid;gap:var(--sp-2);font-size:var(--fs-sm);',
      'color:var(--text2);overflow-wrap:anywhere;}',
      '.sim-mon-text b{color:var(--text);}',
      /* deterioration is the central dramatic beat - it does not belong in a
         4.5-second toast that auto-dismisses below the fold */
      '.sim-alert{display:flex;gap:var(--sp-3);align-items:flex-start;border-radius:var(--r-lg);',
      'padding:var(--sp-3);font-size:var(--fs-sm);line-height:1.5;border:2px solid var(--zone-critical);',
      'background:var(--sim-bad-bg);color:var(--text);}',
      '.sim-alert .mark{font-weight:800;font-size:var(--fs-md);color:var(--sim-bad-fg);line-height:1.2;}',
      '.sim-alert b{display:block;font-size:var(--fs-md);}',
      '.sim-stab{margin-top:var(--sp-3);border:1px dashed var(--border);border-radius:var(--r-md);',
      'padding:9px;}',
      '.sim-stab.ready{border-color:var(--sim-ok-br);background:var(--sim-ok-bg);}',
      '.sim-stab h5{margin:0 0 6px;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--text2);}',
      '.sim-stab ul{margin:0;padding-left:16px;font-size:12px;line-height:1.6;}',

      /* ---- action panel ---- */
      '.sim-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}',
      '.sim-tab{background:var(--surface);border:1px solid var(--border);color:var(--text2);',
      'padding:var(--sp-2) 11px;border-radius:var(--r-md);font-size:var(--fs-xs);font-weight:700;',
      'cursor:pointer;min-height:44px;transition:transform var(--dur-fast) ease;}',
      '.sim-tab[aria-selected="true"]{background:var(--accent);border-color:var(--accent);color:#fff;}',
      '.sim-tab:active{transform:scale(.975);}',
      /* The vitals dock. --sim-dock-top is the height the sticky header
         occupies; the dock parks directly beneath it so the numbers stay on
         screen no matter how long the action list is. */
      '.sim-vitalsdock{position:sticky;top:var(--sim-dock-top,72px);z-index:15;',
      'background:var(--bg);padding-bottom:8px;}',
      /* A capped, internally scrolling action list. Fifty actions in a flat
         two-column grid made the page several screens tall, which is what
         pushed the vitals away in the first place. Capping it means the whole
         simulation - vitals, tabs, actions - fits one screen on a laptop. */
      '.sim-actions{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:9px;',
      'max-height:min(46vh,420px);overflow-y:auto;overscroll-behavior:contain;',
      'padding:2px 4px 2px 2px;}',
      '.sim-actions:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}',
      /* a hairline so it reads as a scroll region rather than a clipped list */
      '.sim-actionwrap{position:relative;}',
      '.sim-actionwrap::after{content:"";position:absolute;left:0;right:0;bottom:0;height:18px;',
      'pointer-events:none;background:linear-gradient(to bottom,transparent,var(--surface));}',
      /* color is NOT optional here. A <button> does not inherit colour from
         its parent - the UA applies `buttontext`, which is near-black. Setting
         a dark background without also setting the text colour produced
         black-on-navy cards that were genuinely unreadable. */
      '.sim-action{background:var(--surface);color:var(--text);border:1px solid var(--border);',
      'border-radius:var(--r-lg);font:inherit;',
      'padding:var(--sp-3);display:flex;gap:9px;align-items:flex-start;text-align:left;cursor:pointer;',
      'width:100%;min-height:44px;',
      'transition:border-color var(--dur-fast) ease,transform var(--dur-fast) ease;}',
      '.sim-action:hover:not(:disabled){border-color:var(--accent);transform:translateY(-1px);}',
      '.sim-action:active:not(:disabled){transform:scale(.975);background:var(--surface3);}',
      '.sim-action:disabled{opacity:.45;cursor:not-allowed;}',
      /* block, or the label and its dose run together as one sentence:
         "Administer Pantoprazole80 mg IV bolus" */
      '.sim-action .txt{display:block;font-size:13px;font-weight:600;line-height:1.35;color:var(--text);}',
      '.sim-action .sub{display:block;font-size:11px;color:var(--text3);margin-top:3px;line-height:1.4;}',
      '.sim-action.done{border-color:var(--sim-ok-br);background:var(--sim-ok-bg);}',
      '.sim-action.usedbad{border-color:var(--sim-bad-br);background:var(--sim-bad-bg);}',

      /* ---- feedback ---- */
      '.sim-fb{border-radius:var(--r-lg);padding:11px var(--sp-3);display:flex;gap:var(--sp-3);',
      'align-items:flex-start;font-size:var(--fs-sm);line-height:1.5;border:1px solid var(--border);',
      'background:var(--surface);animation:simIn var(--dur-base) ease;overflow-wrap:anywhere;}',
      '@keyframes simIn{from{opacity:0;transform:translateY(-5px);}to{opacity:1;transform:none;}}',
      '.sim-fb.good{border-color:var(--sim-ok-br);background:var(--sim-ok-bg);}',
      '.sim-fb.mid{border-color:var(--sim-warn-br);background:var(--sim-warn-bg);}',
      '.sim-fb.bad{border-color:var(--sim-bad-br);background:var(--sim-bad-bg);}',
      '.sim-fb .mark{font-weight:800;font-size:var(--fs-md);line-height:1.2;}',
      '.sim-fb.good .mark{color:var(--sim-ok-fg);} .sim-fb.mid .mark{color:var(--sim-warn-fg);}',
      '.sim-fb.bad .mark{color:var(--sim-bad-fg);}',

      /* ---- log ---- */
      '.sim-log{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);',
      'display:flex;flex-direction:column;max-height:520px;}',
      '.sim-log-head{padding:10px 12px;border-bottom:1px solid var(--border);display:flex;',
      'align-items:center;gap:8px;font-size:12px;font-weight:800;text-transform:uppercase;',
      'letter-spacing:.6px;color:var(--text2);}',
      '.sim-log-body{overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;}',
      '.sim-le{display:flex;gap:8px;font-size:12.5px;line-height:1.45;padding:6px 8px;border-radius:var(--r-md);',
      'background:var(--bg);border-left:3px solid var(--border);}',
      '.sim-le time{color:var(--text3);font-variant-numeric:tabular-nums;font-weight:700;flex:0 0 auto;}',
      '.sim-le.good{border-left-color:var(--sim-ok);} .sim-le.bad{border-left-color:var(--sim-bad);}',
      '.sim-le.warn{border-left-color:var(--sim-warn);} .sim-le.vital{border-left-color:var(--accent2);}',
      '.sim-le.patient{border-left-color:var(--accent);font-style:italic;}',
      '.sim-le .k{font-weight:800;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--text3);}',

      /* ---- chart / labs ---- */
      '.sim-labrow{display:grid;grid-template-columns:1.3fr .8fr .9fr auto;gap:8px;align-items:center;',
      'padding:8px;border-radius:var(--r-md);background:var(--bg);border:1px solid var(--border);font-size:12.5px;}',
      '.sim-labrow.ab{border-color:var(--sim-warn-br);} .sim-labrow.crit{border-color:var(--sim-bad-br);}',
      '.sim-labrow .nm{font-weight:700;} .sim-labrow .rng{color:var(--text3);font-size:11px;}',
      '.sim-interp{grid-column:1/-1;color:var(--text2);font-size:12px;border-top:1px dashed var(--border);',
      'padding-top:6px;margin-top:2px;}',

      /* ---- talk ---- */
      '.sim-talk{display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;padding-right:4px;}',
      '.sim-bub{padding:9px 11px;border-radius:var(--r-lg);font-size:13px;line-height:1.5;max-width:88%;}',
      '.sim-bub.you{align-self:flex-end;background:var(--accent);color:#fff;border-bottom-right-radius:4px;}',
      '.sim-bub.pt{align-self:flex-start;background:var(--surface3);border-bottom-left-radius:4px;}',
      '.sim-bub .who{display:block;font-size:10px;font-weight:800;letter-spacing:.5px;opacity:.75;',
      'text-transform:uppercase;margin-bottom:3px;}',

      /* ---- debrief ---- */
      /* outcome first. A run in which the patient came to harm is not a quiz
         result and must not open with an animated score. */
      '.sim-outcome{border-radius:var(--r-xl);padding:var(--sp-4);border:1px solid var(--border);',
      'border-left:5px solid var(--border);background:var(--surface);display:flex;flex-direction:column;',
      'gap:var(--sp-2);margin-bottom:var(--sp-3);}',
      '.sim-outcome h2{margin:0;font-size:var(--fs-lg);font-weight:800;color:var(--text);line-height:1.3;}',
      '.sim-outcome p{margin:0;font-size:var(--fs-base);line-height:1.65;color:var(--text2);}',
      '.sim-outcome .lab{font-size:var(--fs-2xs);letter-spacing:.07em;text-transform:uppercase;',
      'color:var(--text3);font-weight:700;}',
      '.sim-outcome.good{border-color:var(--green);border-left-color:var(--green);}',
      '.sim-outcome.mixed{border-color:var(--orange);border-left-color:var(--orange);}',
      '.sim-outcome.bad{border-color:var(--red);border-left-color:var(--red);}',
      '.sim-outcome.grave{border-color:var(--red);border-left-color:var(--red);background:var(--bg);}',
      '.sim-outcome.grave h2{font-weight:700;}',
      '.sim-teach{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--sp-3);}',
      '.sim-teach li{border-left:3px solid var(--red);padding-left:var(--sp-3);}',
      '.sim-teach b{display:block;font-size:var(--fs-md);font-weight:800;color:var(--text);line-height:1.35;',
      'overflow-wrap:anywhere;}',
      '.sim-teach div{font-size:var(--fs-sm);color:var(--text2);line-height:1.6;margin-top:3px;}',
      '.sim-score-hero{display:flex;gap:var(--sp-4);align-items:center;flex-wrap:wrap;}',
      '.sim-ring{width:104px;height:104px;flex:0 0 auto;position:relative;}',
      '.sim-ring .n{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;',
      'justify-content:center;font-weight:800;font-size:26px;}',
      '.sim-ring .n small{font-size:11px;font-weight:700;color:var(--text2);letter-spacing:.5px;}',
      '.sim-catrow{display:grid;grid-template-columns:1fr;gap:8px;}',
      '.sim-cat{display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:12.5px;}',
      '.sim-cat .bar{grid-column:1/-1;}',
      '.sim-replay{display:grid;grid-template-columns:88px 1fr 1fr;gap:8px;font-size:12.5px;}',
      '.sim-replay .hd{font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--text3);}',
      '.sim-replay .cell{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:8px;}',
      '.sim-replay .cell ul{margin:0;padding-left:16px;line-height:1.6;}',

      /* ---- AI wait status (see the AI WAIT STATE block below) ---- */
      '.sim-wait{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;',
      'color:var(--text2);line-height:1.5;margin-top:6px;}',
      '.sim-wait.slow{color:var(--orange-fg,#fbbf24);}',
      '.sim-wait .secs{font-variant-numeric:tabular-nums;color:var(--text3);font-size:12px;}',
      '.sim-wait .dots{display:inline-flex;gap:3px;align-items:center;flex:0 0 auto;}',
      '.sim-wait .dots i{width:6px;height:6px;border-radius:999px;background:var(--text3);',
      'animation:simWaitBounce 1.2s infinite;}',
      '.sim-wait .dots i:nth-child(2){animation-delay:.15s;}',
      '.sim-wait .dots i:nth-child(3){animation-delay:.3s;}',
      '@keyframes simWaitBounce{0%,60%,100%{opacity:.3;transform:translateY(0);}',
      '30%{opacity:1;transform:translateY(-3px);}}',

      /* ---- modal ---- */
      '.sim-modal-bg{position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:1000;display:flex;',
      'align-items:center;justify-content:center;padding:16px;}',
      '.sim-modal{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);',
      'padding:18px;max-width:420px;width:100%;}',
      '.sim-btnrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}',

      /* ---- mobile ---- */
      '@media (max-width:900px){.sim-stage{grid-template-columns:1fr;}.sim-two{grid-template-columns:1fr;}}',
      /* On a phone the sticky dock would eat most of the screen, and an inner
         scroll region nested in the page scroll is miserable to use with a
         thumb. Below 900px the vitals ride with the page and the action list
         runs at full length. */
      '@media (max-width:900px){.sim-vitalsdock{position:static;padding-bottom:0;}',
      '.sim-actions{max-height:none;overflow:visible;}',
      '.sim-actionwrap::after{display:none;}}',
      /* Short laptop screens: give the list less room, not more scroll. */
      '@media (min-width:901px) and (max-height:760px){.sim-actions{max-height:34vh;}}',
      '@media (max-width:640px){',
      '.sim-grid{grid-template-columns:1fr;}',
      '.sim-actions{grid-template-columns:1fr;}',
      '.sim-vitals{grid-template-columns:repeat(auto-fit,minmax(96px,1fr));}',
      '.sim-replay{grid-template-columns:1fr;}',
      '.sim-head h2{font-size:var(--fs-lg);}',
      '.sim-log{max-height:280px;}',
      '.sim-labrow{grid-template-columns:1fr auto;}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '.sim-root *,.sim-root *::before,.sim-root *::after{animation:none!important;transition:none!important;}',
      /* the dots stop; the text status and the elapsed counter do not */
      '.sim-wait .dots i{animation:none!important;opacity:.55;}',
      /* keep the signal when the motion goes away */
      '.sim-vital.changed{box-shadow:inset 3px 0 0 0 var(--accent);}',
      '.sim-vital.crit{box-shadow:0 0 0 2px var(--sim-bad-br);}',
      '.sim-back:active,.sim-chip:active,.sim-tab:active,.sim-action:active{transform:none;',
      'background:var(--surface3);}',
      '}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'sim-engine-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------------------------------------------------------------------- *
   * 3. Vital ranges + classification
   * ---------------------------------------------------------------------- */
  function ageBand(patient) {
    var p = obj(patient);
    var a = lower(p.age);
    if (/hour|day|week|newborn|neonate/.test(a)) { return 'neonate'; }
    if (/month/.test(a)) { return 'infant'; }
    var yr = parseNum(a);
    if (/year/.test(a) && yr !== null) {
      if (yr < 1) { return 'infant'; }
      if (yr < 6) { return 'toddler'; }
      if (yr < 13) { return 'child'; }
      if (yr < 18) { return 'teen'; }
    }
    return 'adult';
  }

  /* [warnLo, normLo, normHi, warnHi] plus critLo/critHi */
  var RANGES = {
    adult:   { hr:[50,60,100,120,45,140], rr:[10,12,20,26,8,32], spo2:[90,95,100,100,88,100], sys:[90,100,140,160,85,180], temp:[96.5,97,99.5,100.9,95,103] },
    teen:    { hr:[50,60,100,120,45,140], rr:[10,12,22,28,8,34], spo2:[90,95,100,100,88,100], sys:[90,100,135,155,85,175], temp:[96.5,97,99.5,100.9,95,103] },
    child:   { hr:[65,70,110,140,60,180], rr:[14,18,25,35,12,45], spo2:[90,95,100,100,88,100], sys:[88,95,115,130,80,145], temp:[96.5,97,99.5,100.9,95,104] },
    toddler: { hr:[85,90,140,165,75,185], rr:[18,24,40,50,16,60], spo2:[90,95,100,100,88,100], sys:[80,86,106,120,72,135], temp:[96.5,97,99.5,100.9,95,104] },
    infant:  { hr:[95,100,160,180,85,200], rr:[22,30,53,62,20,70], spo2:[90,95,100,100,88,100], sys:[70,72,104,115,65,125], temp:[96.5,97,99.5,100.9,95,104] },
    neonate: { hr:[100,110,160,185,90,205], rr:[26,30,60,70,22,80], spo2:[90,95,100,100,88,100], sys:[60,65,95,110,55,120], temp:[97.2,97.7,99.5,100.4,96.5,101] }
  };

  function classify(key, value, band) {
    var r = RANGES[band] || RANGES.adult;
    var spec = r[key];
    if (!spec || value === null || value === undefined || !isFinite(value)) { return 'na'; }
    var warnLo = spec[0], normLo = spec[1], normHi = spec[2], warnHi = spec[3],
        critLo = spec[4], critHi = spec[5];
    if (value <= critLo || value >= critHi) { return 'crit'; }
    if (value < normLo || value > normHi) {
      if (value < warnLo || value > warnHi) { return 'crit'; }
      return 'warn';
    }
    return 'ok';
  }

  var CRIT_FLAG_WORDS = /(critical|severe|failure|arrest|shock|silent|cyanos|unrespons|seizure|hemorrhage|bradycard|apnea|late)/;
  function flagSeverity(flags) {
    var f = arr(flags).join(' ').toLowerCase();
    if (!f) { return 'ok'; }
    if (CRIT_FLAG_WORDS.test(f)) { return 'crit'; }
    return 'warn';
  }

  /* a scenario flag can escalate a vital whose raw number still looks normal -
   * this is how the classic peds crash (falling HR + RR in a hypoxic child)
   * still lights up red on the monitor. */
  var FLAG_VITAL = [
    { re: /(bradycard|tachycard|arrhythm|dysrhythm)/, key: 'hr' },
    { re: /(bradypnea|tachypnea|respirat|apnea|silent|retract|accessory|air-trapping|grunting)/, key: 'rr' },
    { re: /(hypox|desat|cyanos|spo2)/, key: 'spo2' },
    { re: /(hypotens|hypertens|shock|hemorrhage|bleeding|perfusion)/, key: 'sys' },
    { re: /(fever|hyperthermia|hypothermia|febrile)/, key: 'temp' }
  ];
  function flagStateFor(key, flags) {
    var f = arr(flags).join(' ').toLowerCase();
    if (!f) { return 'na'; }
    var sev = flagSeverity(flags);
    for (var i = 0; i < FLAG_VITAL.length; i++) {
      if (FLAG_VITAL[i].key === key && FLAG_VITAL[i].re.test(f)) { return sev; }
    }
    return 'na';
  }

  /* the state the monitor actually paints: number first, flags can escalate it */
  function vitalState(key, value, band, flags) {
    var base = classify(key, value, band);
    if (base === 'na') { return 'na'; }
    return worse(base, flagStateFor(key, flags));
  }
  function worse(a, b) {
    var rank = { na: 0, ok: 1, warn: 2, crit: 3 };
    return (rank[b] || 0) > (rank[a] || 0) ? b : a;
  }

  /* ---------------------------------------------------------------------- *
   * 4. Vitals normalisation
   * ---------------------------------------------------------------------- */
  function normVitals(entry) {
    var e = obj(entry);
    var bp = parseBP(e.bp);
    return {
      atMin: parseNum(e.atMin) === null ? 0 : parseNum(e.atMin),
      label: str(e.label),
      sys: bp ? bp.sys : null,
      dia: bp ? bp.dia : null,
      bpText: has(e.bp) ? str(e.bp) : '--',
      hr: parseNum(e.hr),
      rr: parseNum(e.rr),
      spo2: parseNum(e.spo2),
      temp: parseNum(e.temp),
      tempText: has(e.temp) ? str(e.temp) : '--',
      pain: parseNum(e.pain),
      painText: has(e.pain) ? str(e.pain) : '--',
      loc: has(e.loc) ? str(e.loc) : '--',
      other: str(e.other),
      flags: arr(e.flags),
      note: str(e.note)
    };
  }

  function degradeVitals(v, hits) {
    if (!hits) { return v; }
    var o = {};
    for (var k in v) { if (Object.prototype.hasOwnProperty.call(v, k)) { o[k] = v[k]; } }
    if (o.sys !== null) { o.sys = Math.max(40, o.sys - 8 * hits); }
    if (o.dia !== null) { o.dia = Math.max(20, o.dia - 5 * hits); }
    if (o.sys !== null && o.dia !== null) { o.bpText = o.sys + '/' + o.dia; }
    if (o.hr !== null) { o.hr = o.hr + 10 * hits; }
    if (o.rr !== null) { o.rr = o.rr + 4 * hits; }
    if (o.spo2 !== null) { o.spo2 = Math.max(50, o.spo2 - 4 * hits); }
    o.flags = arr(o.flags).concat(['harm-response']);
    return o;
  }

  /* ---------------------------------------------------------------------- *
   * 5. Deterioration guards
   * ---------------------------------------------------------------------- */
  function byOrder(a, b) {
    var x = parseNum(a.order), y = parseNum(b.order);
    return (x === null ? 99 : x) - (y === null ? 99 : y);
  }

  function buildGuards(scenario) {
    var sc = obj(scenario);
    var tl = arr(sc.vitalsTimeline);
    var ivs = arr(sc.interventions).slice().sort(byOrder);
    var preventers = ivs.filter(function (i) { return !!i.preventsDeterioration; });
    var criticals = ivs.filter(function (i) { return !!i.critical; });
    var basis = preventers.length ? preventers : criticals;
    var stages = Math.max(1, tl.length - 1);
    var guards = [];
    for (var k = 1; k < tl.length; k++) {
      var need = basis.slice(0, Math.ceil(k * basis.length / stages));
      var lastOrder = need.length ? (parseNum(need[need.length - 1].order) || 0) : 0;
      var alsoCrit = criticals.filter(function (i) {
        var o = parseNum(i.order);
        return o !== null && o <= lastOrder;
      });
      guards[k] = uniqBy(need.concat(alsoCrit), function (i) { return str(i.id) || str(i.action); });
    }
    return guards;
  }

  /* ---------------------------------------------------------------------- *
   * 6. Action catalogue
   * ---------------------------------------------------------------------- */
  var GROUPS = [
    { id: 'assess', label: 'Assess', icon: 'ASX' },
    { id: 'intervene', label: 'Interventions', icon: 'INT' },
    { id: 'meds', label: 'Medications', icon: 'RX' },
    { id: 'comm', label: 'Communication', icon: 'SBAR' },
    { id: 'educate', label: 'Education', icon: 'EDU' },
    { id: 'chart', label: 'Chart', icon: 'CHT' }
  ];

  var CAT_GROUP = {
    assessment: 'assess',
    intervention: 'intervene',
    medication: 'meds',
    communication: 'comm',
    escalation: 'comm',
    education: 'educate'
  };
  var CAT_ICON = {
    assessment: 'ASX', intervention: 'INT', medication: 'RX',
    communication: 'SBAR', escalation: '!!', education: 'EDU'
  };

  var DISTRACTORS = [
    { label: 'Document the assessment and recheck in one hour', why: 'Delaying reassessment in an unstable patient wastes the window in which you can still change the outcome.' },
    { label: 'Encourage the patient to ambulate in the hallway', why: 'Activity increases oxygen demand and is not appropriate for an unstable patient.' },
    { label: 'Offer a regular diet tray', why: 'Feeding an unstable patient risks aspiration and ignores NPO status pending procedures.' },
    { label: 'Give a complete bed bath before anything else', why: 'Hygiene is never the priority over airway, breathing, circulation, or an unstable vital sign.' },
    { label: 'Ask the family to leave and wait in the lobby', why: 'Removing support does nothing clinically and removes a source of history.' },
    { label: 'Draw a routine fasting lipid panel', why: 'A non-urgent lab does not address the presenting problem.' },
    { label: 'Schedule a physical therapy consult for tomorrow', why: 'Discharge planning is not a priority during an acute deterioration.' },
    { label: 'Wait for the next scheduled vital sign check', why: 'Waiting is a decision. In a deteriorating patient it is the wrong one.' },
    { label: 'Silence the monitor alarms so the patient can rest', why: 'Silencing alarms removes your early-warning system and is a patient-safety violation.' },
    { label: 'Give the PRN sedative so the patient stops being restless', why: 'Restlessness is an early sign of hypoxia. Sedating it masks deterioration.' }
  ];

  var MED_STOPWORDS = {
    percent: 1, continuous: 1, infusion: 1, solution: 1, oral: 1, added: 1, fluids: 1,
    routinely: 1, indicated: 1, not: 1, and: 1, with: 1, the: 1, iv: 1, drip: 1, maintenance: 1
  };

  /* every meaningful token in a drug name, longest first */
  function medTokens(med) {
    var m = obj(med);
    var raw = lower(str(m.name) + ' ' + str(m.brand) + ' ' + (typeof med === 'string' ? med : ''));
    var toks = raw.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (t) {
      return t.length >= 4 && !MED_STOPWORDS[t];
    });
    return uniqBy(toks, function (t) { return t; }).sort(function (a, b) { return b.length - a.length; });
  }
  function medNameKey(name) {
    var t = medTokens(typeof name === 'string' ? { name: name } : name);
    return t.length ? t[0] : '';
  }

  function findIvForMed(ivs, medName) {
    var toks = medTokens(typeof medName === 'string' ? { name: medName } : medName);
    for (var t = 0; t < toks.length; t++) {
      for (var i = 0; i < ivs.length; i++) {
        if (lower(ivs[i].action).indexOf(toks[t]) !== -1) { return ivs[i]; }
      }
    }
    return null;
  }

  function findCalcForMed(calcs, medName) {
    var toks = medTokens(typeof medName === 'string' ? { name: medName } : medName);
    if (!toks.length) { return null; }
    var hits = arr(calcs).filter(function (c) {
      var hay = lower(str(c.text) + ' ' + str(c.id) + ' ' + str(c.safeRange));
      for (var t = 0; t < toks.length; t++) {
        if (hay.indexOf(toks[t]) !== -1) { return true; }
      }
      return false;
    });
    return hits.length ? hits : null;
  }

  function buildActions(scenario) {
    var sc = obj(scenario);
    var ivs = arr(sc.interventions).slice().sort(byOrder);
    var out = [];
    var usedIv = {};

    /* --- graded interventions --- */
    ivs.forEach(function (iv, idx) {
      var cat = lower(iv.category) || 'intervention';
      var gid = CAT_GROUP[cat] || 'intervene';
      var id = 'iv:' + (str(iv.id) || idx);
      usedIv[id] = true;
      out.push({
        id: id, group: gid, kind: 'intervention',
        label: str(iv.action) || 'Intervention ' + (idx + 1),
        icon: CAT_ICON[cat] || 'INT',
        ivId: str(iv.id) || String(idx),
        order: parseNum(iv.order) === null ? 99 : parseNum(iv.order),
        critical: !!iv.critical,
        prevents: !!iv.preventsDeterioration,
        rationale: str(iv.rationale),
        pearl: str(iv.atiPearl),
        cost: cat === 'assessment' ? COST_ASSESS : COST_DEFAULT
      });
    });

    /* --- focused assessments not already covered --- */
    var focus = [
      'Auscultate lung sounds in all fields',
      'Assess level of consciousness and orientation',
      'Check skin colour, temperature and capillary refill',
      'Palpate the abdomen for tenderness and distention',
      'Reassess pain using an age-appropriate scale',
      'Recheck a full set of vital signs now'
    ];
    focus.forEach(function (f, i) {
      var dupe = ivs.some(function (iv) { return lower(iv.action).indexOf(lower(f).slice(0, 14)) !== -1; });
      if (dupe) { return; }
      out.push({
        id: 'fa:' + i, group: 'assess', kind: 'assess-extra', label: f, icon: 'ASX',
        rationale: 'A focused reassessment is always defensible, but it does not replace the priority action for this patient.',
        cost: COST_ASSESS
      });
    });

    /* --- medications --- */
    var meds = arr(sc.medications);
    meds.forEach(function (m, i) {
      var linked = findIvForMed(ivs, m.name);
      out.push({
        id: 'med:' + i, group: 'meds', kind: 'med',
        label: 'Administer ' + (str(m.name) || 'medication'),
        sub: str(m.dose),
        icon: m.highAlert ? 'HIGH' : 'RX',
        med: m, medIndex: i,
        ivId: linked ? (str(linked.id) || '') : '',
        order: linked ? (parseNum(linked.order) === null ? 99 : parseNum(linked.order)) : null,
        critical: linked ? !!linked.critical : false,
        prevents: linked ? !!linked.preventsDeterioration : false,
        rationale: linked ? str(linked.rationale) : str(m.action),
        pearl: str(m.atiTip),
        calcs: findCalcForMed(sc.dosageCalculations, m.name),
        cost: COST_DEFAULT
      });
    });
    arr(sc.orders).forEach(function (o, i) {
      if (lower(o.category) !== 'medication') { return; }
      var dupe = meds.some(function (m) { return lower(o.text).indexOf(medNameKey(m.name)) !== -1; });
      if (dupe) { return; }
      var linked = findIvForMed(ivs, o.text);
      out.push({
        id: 'ord:' + i, group: 'meds', kind: 'order-med',
        label: 'Carry out order: ' + str(o.text), icon: 'RX',
        ivId: linked ? (str(linked.id) || '') : '',
        order: linked ? parseNum(linked.order) : null,
        critical: linked ? !!linked.critical : false,
        prevents: linked ? !!linked.preventsDeterioration : false,
        rationale: linked ? str(linked.rationale) : 'This is a written order for this patient.',
        cost: COST_DEFAULT
      });
    });

    /* --- communication --- */
    var commSeeds = [
      { id: 'comm:sbar', label: 'Call the provider and give SBAR', icon: 'SBAR', kind: 'sbar' },
      { id: 'comm:rrt', label: 'Activate the Rapid Response Team', icon: '!!', kind: 'escalate' },
      { id: 'comm:help', label: 'Call for help / stay with the patient', icon: 'HELP', kind: 'comm' }
    ];
    commSeeds.forEach(function (c) {
      var linked = null;
      for (var i = 0; i < ivs.length; i++) {
        var t = lower(ivs[i].action);
        if (c.kind === 'sbar' && (t.indexOf('sbar') !== -1 || t.indexOf('notify') !== -1 || t.indexOf('provider') !== -1)) { linked = ivs[i]; break; }
        if (c.kind === 'escalate' && (t.indexOf('rapid response') !== -1 || t.indexOf('escalat') !== -1)) { linked = ivs[i]; break; }
      }
      if (linked && usedIv['iv:' + (str(linked.id))]) {
        /* keep the graded card, but expose the tool through it */
        out.forEach(function (a) {
          if (a.id === 'iv:' + str(linked.id)) { a.tool = c.kind; }
        });
        return;
      }
      out.push({
        id: c.id, group: 'comm', kind: c.kind, label: c.label, icon: c.icon, tool: c.kind,
        rationale: c.kind === 'sbar'
          ? 'Structured handoff communication is a graded competency in every simulation.'
          : 'Escalation is a nursing intervention. Recognising that you need help IS the intervention.',
        cost: COST_DEFAULT
      });
    });

    /* --- education --- */
    arr(sc.patientEducation).slice(0, 6).forEach(function (t, i) {
      out.push({
        id: 'edu:' + i, group: 'educate', kind: 'education',
        label: 'Teach: ' + str(t), icon: 'EDU',
        rationale: 'Patient and family teaching is scored. Teach once the patient is stable enough to learn.',
        cost: COST_DEFAULT
      });
    });

    /* --- chart access --- */
    out.push({ id: 'chart:labs', group: 'chart', kind: 'chart', tab: 'labs', label: 'Review laboratory results', icon: 'LAB', cost: COST_CHART, rationale: 'Labs are data you must go and get. They are not free information.' });
    out.push({ id: 'chart:diagnostics', group: 'chart', kind: 'chart', tab: 'diagnostics', label: 'Review diagnostic studies', icon: 'DX', cost: COST_CHART, rationale: 'Imaging and studies support but never replace your bedside assessment.' });
    out.push({ id: 'chart:orders', group: 'chart', kind: 'chart', tab: 'orders', label: 'Review provider orders', icon: 'ORD', cost: COST_CHART, rationale: 'Know what is ordered before you act on it.' });
    out.push({ id: 'chart:history', group: 'chart', kind: 'chart', tab: 'history', label: 'Review chart and history', icon: 'HX', cost: COST_CHART, rationale: 'History explains the presentation and uncovers the trigger.' });

    /* --- harmful actions from criticalErrors --- */
    arr(sc.criticalErrors).forEach(function (t, i) {
      var text = str(t);
      var label = text.charAt(0).toUpperCase() + text.slice(1);
      var gid = /medic|dose|give|administ/.test(lower(text)) ? 'meds'
        : (/notify|call|delay.*provider|escalat/.test(lower(text)) ? 'comm' : 'intervene');
      out.push({
        id: 'harm:' + i, group: gid, kind: 'harm', label: label, icon: 'X',
        harm: text, cost: COST_DEFAULT
      });
    });

    /* --- neutral distractors --- */
    var picked = DISTRACTORS.slice(0, 6);
    picked.forEach(function (d, i) {
      var dupe = out.some(function (a) { return lower(a.label) === lower(d.label); });
      if (dupe) { return; }
      out.push({
        id: 'dis:' + i, group: /diet|bath|ambulate|family/.test(lower(d.label)) ? 'intervene' : 'assess',
        kind: 'distractor', label: d.label, icon: '?', rationale: d.why, cost: COST_DISTRACTOR
      });
    });

    return out;
  }

  /* ---------------------------------------------------------------------- *
   * 7. Scoring rubric
   *    Positive weights total 100. Errors subtract on top.
   * ---------------------------------------------------------------------- */
  var WEIGHTS = {
    critical: 35,     // critical interventions performed
    ordering: 15,     // priority sequence similarity
    timeliness: 15,   // acted before deterioration fired
    assessment: 12,   // assessment thoroughness + chart use
    communication: 10,
    education: 8,
    supporting: 5     // non-critical interventions completed
  };

  /* longest strictly increasing subsequence length */
  function lisLength(seq) {
    var tails = [];
    for (var i = 0; i < seq.length; i++) {
      var v = seq[i], lo = 0, hi = tails.length;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (tails[mid] < v) { lo = mid + 1; } else { hi = mid; }
      }
      tails[lo] = v;
    }
    return tails.length;
  }

  /*
   * perf = {
   *   performedIvIds: [], ivOrderSeq: [numbers in the order performed],
   *   errors: [{text}], stagesTotal, stagesHeld, stagesPartial,
   *   assessDone, assessTotal, chartViewed, sbarDone, commDone, commTotal,
   *   eduDone, eduTotal, supportingDone, supportingTotal
   * }
   */
  function scorePerformance(scenario, perf, mode) {
    var sc = obj(scenario);
    var p = obj(perf);
    var ivs = arr(sc.interventions);
    var criticals = ivs.filter(function (i) { return !!i.critical; });
    var doneMap = {};
    arr(p.performedIvIds).forEach(function (id) { doneMap[str(id)] = true; });

    var critDone = criticals.filter(function (i) { return doneMap[str(i.id)]; });
    var critPct = criticals.length ? critDone.length / criticals.length : 1;

    var seq = arr(p.ivOrderSeq).filter(function (n) { return typeof n === 'number' && isFinite(n); });
    var orderPct;
    if (seq.length < 2) { orderPct = seq.length === 1 ? 1 : 0; }
    else { orderPct = lisLength(seq) / seq.length; }
    /* ordering credit is scaled by how much of the plan was actually attempted,
     * so a single perfectly-ordered action cannot earn full marks */
    var coverage = ivs.length ? clamp(seq.length / ivs.length, 0.35, 1) : 1;
    orderPct = orderPct * coverage;

    var stagesTotal = parseNum(p.stagesTotal) || 0;
    var timePct;
    if (!stagesTotal) { timePct = critPct; }
    else {
      timePct = ((parseNum(p.stagesHeld) || 0) + 0.4 * (parseNum(p.stagesPartial) || 0)) / stagesTotal;
    }
    timePct = clamp(timePct, 0, 1);

    var assessTotal = Math.max(1, (parseNum(p.assessTotal) || 0) + 4);
    var assessPct = clamp(((parseNum(p.assessDone) || 0) + (parseNum(p.chartViewed) || 0)) / assessTotal, 0, 1);

    var commTotal = Math.max(1, parseNum(p.commTotal) || 1);
    var commPct = clamp(((parseNum(p.commDone) || 0) + (p.sbarDone ? 1 : 0)) / (commTotal + 1), 0, 1);

    var eduTotal = Math.max(1, Math.min(3, parseNum(p.eduTotal) || 1));
    var eduPct = clamp((parseNum(p.eduDone) || 0) / eduTotal, 0, 1);

    var supTotal = parseNum(p.supportingTotal) || 0;
    var supPct = supTotal ? clamp((parseNum(p.supportingDone) || 0) / supTotal, 0, 1) : 1;

    var cats = [
      { key: 'critical', label: 'Critical interventions', weight: WEIGHTS.critical, pct: critPct,
        detail: critDone.length + ' of ' + criticals.length + ' critical actions performed' },
      { key: 'ordering', label: 'Priority ordering', weight: WEIGHTS.ordering, pct: orderPct,
        detail: seq.length
          ? ('Longest correctly ordered run: ' + lisLength(seq) + ' of ' + seq.length +
             ' performed, covering ' + Math.round(coverage * 100) + '% of the plan')
          : 'No graded interventions performed' },
      { key: 'timeliness', label: 'Timeliness', weight: WEIGHTS.timeliness, pct: timePct,
        detail: stagesTotal ? ((parseNum(p.stagesHeld) || 0) + ' of ' + stagesTotal + ' deterioration events prevented') : 'No deterioration events in this scenario' },
      { key: 'assessment', label: 'Assessment thoroughness', weight: WEIGHTS.assessment, pct: assessPct,
        detail: (parseNum(p.assessDone) || 0) + ' focused assessments, ' + (parseNum(p.chartViewed) || 0) + ' of 4 chart sections reviewed' },
      { key: 'communication', label: 'Communication', weight: WEIGHTS.communication, pct: commPct,
        detail: p.sbarDone ? 'SBAR handoff completed' : 'No SBAR handoff given' },
      { key: 'education', label: 'Patient education', weight: WEIGHTS.education, pct: eduPct,
        detail: (parseNum(p.eduDone) || 0) + ' teaching point(s) delivered' },
      { key: 'supporting', label: 'Supporting interventions', weight: WEIGHTS.supporting, pct: supPct,
        detail: (parseNum(p.supportingDone) || 0) + ' of ' + supTotal + ' non-critical interventions' }
    ];

    var earned = 0;
    cats.forEach(function (c) {
      c.earned = Math.round(c.weight * clamp(c.pct, 0, 1) * 10) / 10;
      earned += c.earned;
    });

    var perError = (mode === 'exam') ? 18 : 12;
    var errs = arr(p.errors);
    var penaltyRaw = errs.length * perError;
    var penalty = Math.min(penaltyRaw, 45);
    var total = clamp(Math.round(earned - penalty), 0, 100);

    var letter = total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'F';
    var passed = total >= PASS_PCT && errs.length === 0;

    return {
      total: total, earnedRaw: Math.round(earned * 10) / 10,
      penalty: penalty, letter: letter, passed: passed,
      passMark: PASS_PCT,
      categories: cats,
      missedCritical: criticals.filter(function (i) { return !doneMap[str(i.id)]; }),
      missedOther: ivs.filter(function (i) { return !i.critical && !doneMap[str(i.id)]; }),
      errors: errs,
      ordering: { seq: seq, lis: seq.length ? lisLength(seq) : 0 }
    };
  }

  /* ---------------------------------------------------------------------- *
   * 7b. Patient outcome
   *     A score is not an outcome. These sims used to end with a letter grade
   *     even when the patient was harmed; the live-AI module explicitly
   *     refuses to do that and this one now matches it. `kind: grave` means
   *     teaching leads and no animated score is shown.
   * ---------------------------------------------------------------------- */
  var SIM_OUTCOME_META = {
    harm: {
      id: 'harm',
      title: 'The patient came to harm',
      kind: 'grave',
      lede: 'At least one action in this run is documented as directly harmful for this patient. ' +
            'Read the next section before the score - that is where the run actually turned.'
    },
    deteriorated: {
      id: 'deteriorated',
      title: 'The patient deteriorated - the window was missed',
      kind: 'bad',
      lede: 'The patient got sicker while care continued as if nothing was changing. The interventions ' +
            'that would have held this patient were on the board the whole time.'
    },
    unstable: {
      id: 'unstable',
      title: 'Patient held - with gaps',
      kind: 'mixed',
      lede: 'You got there. Some pieces were late or missing, and on a real unit that lag is where harm hides.'
    },
    stable: {
      id: 'stable',
      title: 'Patient stable - strong performance',
      kind: 'good',
      lede: 'You worked the priorities in order and the patient held. That is the standard.'
    }
  };

  function patientOutcome(scenario, session, result) {
    var r = obj(result), s = obj(session);
    var errs = arr(r.errors).length;
    var missed = arr(r.missedCritical).length;
    var stagesTotal = Math.max(0, arr(obj(scenario).vitalsTimeline).length - 1);
    var held = Object.keys(obj(s.held)).length;
    if (errs) { return SIM_OUTCOME_META.harm; }
    if (missed && stagesTotal && held === 0) { return SIM_OUTCOME_META.deteriorated; }
    if (!r.passed) { return SIM_OUTCOME_META.unstable; }
    return SIM_OUTCOME_META.stable;
  }

  /* scenario action strings are teaching paragraphs; a turning point needs a
     headline the student can scan in one second */
  function shortAction(s) {
    var t = str(s).split(/\s+[-–]\s+/)[0];
    t = t.split(/[,;.]/)[0].trim();
    if (!t) { t = str(s).slice(0, 60); }
    if (t.length > 72) { t = t.slice(0, 69).replace(/\s+\S*$/, '') + '…'; }
    return t;
  }

  /* the concrete "this is what would have changed it" payload */
  function simTurningPoints(scenario, session, result) {
    var out = [], r = obj(result);
    arr(r.errors).slice(0, 3).forEach(function (e) {
      out.push({
        head: 'Do not: ' + shortAction(obj(e).text),
        body: 'Documented as harmful for this patient. Harm is not recoverable by doing something right ' +
              'afterwards - it is the one class of action that has to be prevented, not corrected.'
      });
    });
    arr(r.missedCritical).slice().sort(byOrder).forEach(function (iv) {
      if (out.length >= 4) { return; }
      out.push({ head: shortAction(iv.action), body: str(iv.rationale) });
    });
    if (!out.length) {
      out.push({
        head: 'Act one window earlier',
        body: 'Nothing here was wrong. The remaining margin is timing: each intervention landing one ' +
              'deterioration window sooner is what separates a hold from a rescue.'
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------------- *
   * 8. Progress + AI helpers
   * ---------------------------------------------------------------------- */
  function readSimResults() {
    var MM = MMx();
    if (typeof MM.getProgress !== 'function') { return []; }
    try { return arr(obj(MM.getProgress()).simResults); } catch (e) { return []; }
  }

  function bestScoreFor(simId) {
    var best = null;
    readSimResults().forEach(function (r) {
      if (str(r.simId) !== str(simId)) { return; }
      var v = parseNum(r.pct);
      if (v === null) { v = parseNum(r.score); }
      if (v !== null && (best === null || v > best)) { best = v; }
    });
    return best;
  }

  function saveResult(scenario, result, timeSec, mode) {
    var MM = MMx();
    var rec = {
      simId: str(scenario.id),
      date: new Date().toISOString(),
      score: result.total,
      maxScore: 100,
      pct: result.total,
      timeSec: Math.round(timeSec || 0),
      missedCritical: arr(result.missedCritical).map(function (i) { return str(i.action); }),
      errors: arr(result.errors).map(function (e) { return str(e.text); }),
      category: str(scenario.category),
      mode: str(mode),
      letter: result.letter,
      passed: !!result.passed
    };
    if (typeof MM.setProgress === 'function') {
      try {
        MM.setProgress(function (prev) {
          var next = {};
          var p = obj(prev);
          for (var k in p) { if (Object.prototype.hasOwnProperty.call(p, k)) { next[k] = p[k]; } }
          next.simResults = arr(p.simResults).concat([rec]);
          return next;
        });
      } catch (e) {}
    }
    if (typeof MM.recordActivity === 'function') {
      try {
        MM.recordActivity('sim', {
          simId: rec.simId, title: str(scenario.title), pct: rec.pct, passed: rec.passed
        });
      } catch (e) {}
    }
    return rec;
  }

  function aiAvailable() {
    var ai = obj(MMx().ai);
    if (typeof ai.chat !== 'function' && typeof ai.debriefSimulation !== 'function') { return false; }
    if (typeof ai.isAvailable === 'function') {
      try { return !!ai.isAvailable(); } catch (e) { return false; }
    }
    return true;
  }

  /* ----------------------------------------------------------------------
   * "CHECKING YOUR PLAN"
   * MM.ai.isResolving() is true until Firebase has answered with this
   * student's tier. Until then aiAvailable() is only a guess, so the debrief
   * panel must not tell them AI coaching is unavailable. Feature-detected: an
   * older cached ai.js has no isResolving and the panel behaves as before.
   * -------------------------------------------------------------------- */
  function aiResolving() {
    var ai = obj(MMx().ai);
    try { return !!(typeof ai.isResolving === 'function' && ai.isResolving()); }
    catch (e) { return false; }
  }

  function useAiResolving() {
    var st = useState(aiResolving);
    var resolving = st[0], setResolving = st[1];
    useEffect(function () {
      if (!resolving) { return undefined; }
      var ai = obj(MMx().ai);
      if (typeof ai.onResolved !== 'function') { setResolving(false); return undefined; }
      var off = ai.onResolved(function () { setResolving(false); });
      return function () { if (typeof off === 'function') { off(); } };
    }, [resolving]);
    return resolving;
  }

  /* ======================================================================
   * AI WAIT STATE  (file-local; both AI touchpoints in this file use it)
   * ----------------------------------------------------------------------
   * The Netlify function buffers SSE, so onToken can stay silent for an
   * entire generation and then deliver everything at once. "Your instructor
   * is reading the transcript..." and "Patient is thinking..." were both
   * static strings with no clock behind them, so a slow model and a dead
   * request looked exactly the same.
   *
   * This clock is keyed on wall time only: set synchronously with the busy
   * flag (acknowledgment on the next paint), ticking on its own interval (so
   * it advances with zero tokens), and escalating so slow reads as slow.
   * ==================================================================== */
  var WAIT_TICK_MS = 1000;
  var WAIT_SOON_MS = 5000;    // start showing the elapsed counter
  var WAIT_SLOW_MS = 20000;   // say out loud that this is slow
  var WAIT_LONG_MS = 45000;   // offer a retry / a way out

  function waitTier(ms) {
    if (ms >= WAIT_LONG_MS) { return 3; }
    if (ms >= WAIT_SLOW_MS) { return 2; }
    if (ms >= WAIT_SOON_MS) { return 1; }
    return 0;
  }

  var WAIT_TEXT_DEBRIEF = [
    'Sending your run to the instructor.',
    'Your instructor is reading the transcript.',
    'Still working - this model is being slow. Nothing is stuck.',
    'This is taking much longer than usual. Keep waiting, or try again.'
  ];

  var WAIT_TEXT_PATIENT = [
    'Your patient heard you.',
    'Your patient is thinking about that.',
    'Still waiting on your patient - the model is being slow.',
    'This answer is not coming quickly. Keep waiting, or stop and carry on.'
  ];

  function useAiWait() {
    var st = useState(null);
    var wait = st[0], setWait = st[1];
    var timerRef = useRef(null);
    var startRef = useRef(0);

    function clearTick() {
      if (timerRef.current) {
        try { clearInterval(timerRef.current); } catch (e) {}
        timerRef.current = null;
      }
    }
    useEffect(function () { return clearTick; }, []);

    function begin() {
      clearTick();
      startRef.current = Date.now();
      setWait({ ms: 0, tier: 0 });
      timerRef.current = setInterval(function () {
        var ms = Date.now() - startRef.current;
        setWait({ ms: ms, tier: waitTier(ms) });
      }, WAIT_TICK_MS);
    }
    function end() { clearTick(); setWait(null); }

    return { wait: wait, begin: begin, end: end };
  }

  /**
   * The one status node in this file. `data-elapsed` is real seconds and
   * advances whether or not anything has streamed. The dots are decoration:
   * prefers-reduced-motion stops them and leaves the text status intact.
   */
  function WaitNote(props) {
    var w = props.wait;
    if (!w) { return null; }
    var secs = Math.floor(w.ms / 1000);
    var texts = props.texts || WAIT_TEXT_DEBRIEF;
    return ce('div', {
      className: 'sim-wait' + (w.tier >= 2 ? ' slow' : ''),
      'data-elapsed': String(secs), 'data-tier': String(w.tier)
    },
      ce('span', { className: 'dots', 'aria-hidden': 'true' },
        ce('i', null), ce('i', null), ce('i', null)),
      /* Only the phrase is announced, and only at tier boundaries. The
         seconds are aria-hidden so nobody is read a ticking clock. */
      ce('span', { role: 'status', 'aria-live': 'polite' }, texts[w.tier]),
      w.tier >= 1 ? ce('span', { className: 'secs', 'aria-hidden': 'true' }, secs + 's') : null,
      (w.tier >= 3 && props.onRetry)
        ? ce('button', { type: 'button', className: 'btn btn-outline btn-sm', onClick: props.onRetry }, 'Try again')
        : null,
      (w.tier >= 3 && props.onCancel)
        ? ce('button', { type: 'button', className: 'btn btn-outline btn-sm', onClick: props.onCancel }, 'Stop waiting')
        : null
    );
  }

  function buildDebriefPrompt(scenario, result, logLines) {
    var sc = obj(scenario);
    var lines = [];
    lines.push('SCENARIO: ' + str(sc.fullTitle || sc.title) + ' (' + str(sc.category) + ', ' + str(sc.difficulty) + ')');
    lines.push('PATIENT: ' + str(obj(sc.patient).name) + ', ' + str(obj(sc.patient).age) + ', ' + str(obj(sc.patient).diagnosis));
    lines.push('SCORE: ' + result.total + '/100 (' + result.letter + ')');
    lines.push('CATEGORY BREAKDOWN:');
    arr(result.categories).forEach(function (c) {
      lines.push('  - ' + c.label + ': ' + c.earned + '/' + c.weight + ' (' + c.detail + ')');
    });
    lines.push('MISSED CRITICAL ACTIONS: ' + (arr(result.missedCritical).map(function (i) { return str(i.action); }).join('; ') || 'none'));
    lines.push('CRITICAL ERRORS COMMITTED: ' + (arr(result.errors).map(function (e) { return str(e.text); }).join('; ') || 'none'));
    lines.push('EVENT LOG:');
    arr(logLines).slice(0, 60).forEach(function (l) { lines.push('  ' + l); });
    return lines.join('\n');
  }

  /* MM.ai.debriefSimulation() takes (scenario, performance) only - it ignores a
     third onToken argument, and it CATCHES every error, resolving with a
     markdown page that begins with this heading. Both behaviours are wrong for
     a status UI: nothing ever streams and nothing ever rejects, so a quota wall
     rendered as a successful debrief. Hence: prefer chat() (which streams and
     rejects honestly), and if we do end up on debriefSimulation, recognise the
     sentinel and turn it back into a rejection. */
  var DEBRIEF_FAIL_MARK = '## Debrief unavailable';

  function debriefErr(code, message) {
    var e = new Error(message || 'The AI coach is unavailable right now.');
    e.code = code || 'server';
    return e;
  }

  function runAiDebrief(scenario, result, logLines, onToken) {
    var ai = obj(MMx().ai);
    if (!aiAvailable()) { return Promise.reject(debriefErr('unavailable')); }

    if (typeof ai.chat === 'function') {
      try {
        return Promise.resolve(ai.chat({
          system: 'You are an experienced nursing clinical instructor running a post-simulation debrief. ' +
            'Be warm but direct. Use short paragraphs and bullet points. Structure: What went well / ' +
            'What put the patient at risk / The one habit to change / A prediction of how this shows up on NCLEX. ' +
            'Never invent clinical data that is not in the transcript. Under 300 words.',
          messages: [{ role: 'user', content: buildDebriefPrompt(scenario, result, logLines) }],
          maxTokens: 700,
          feature: 'debrief',
          onToken: onToken
        }));
      } catch (e) {
        // A synchronous throw is still a failure, not a hang.
        return Promise.reject(e);
      }
    }

    if (typeof ai.debriefSimulation !== 'function') { return Promise.reject(debriefErr('unavailable')); }
    try {
      return Promise.resolve(ai.debriefSimulation(scenario, result)).then(function (md) {
        var text = str(md);
        if (text.indexOf(DEBRIEF_FAIL_MARK) === 0) {
          throw debriefErr('server', text.replace(DEBRIEF_FAIL_MARK, '').trim() ||
            'The AI coach is unavailable right now.');
        }
        return text;
      });
    } catch (e) { return Promise.reject(e); }
  }

  /* One line per code MM.ai.chat rejects with. `retry` is the honest half: an
     expired quota and a dropped connection are not the same offer. */
  function aiDebriefError(err) {
    var code = err && err.code ? String(err.code) : 'server';
    if (err && err.timedOut) {
      return { code: code, retry: true,
               text: 'The AI coach ran out of time on this one. Your full scored debrief is below either way.' };
    }
    if (code === 'no-auth') {
      return { code: code, retry: false,
               text: 'Sign in to get an AI debrief. Your scored debrief below is complete without it.' };
    }
    if (code === 'tier-denied') {
      return { code: code, retry: false,
               text: 'AI debrief is not included in your plan. Everything below is still yours.' };
    }
    if (code === 'quota-exceeded') {
      return { code: code, retry: false,
               text: 'You have used today\'s AI allowance. The scored debrief below is complete.' };
    }
    if (code === 'ai-disabled') {
      return { code: code, retry: false,
               text: 'AI coaching is turned off site-wide right now. The scored debrief below is complete.' };
    }
    if (code === 'network') {
      return { code: code, retry: true,
               text: 'Could not reach the AI coach - check your connection. Nothing about your run is lost.' };
    }
    if (code === 'unavailable') {
      return { code: code, retry: false,
               text: 'AI coaching is not available on this device. Everything below was generated locally.' };
    }
    return { code: 'server', retry: true,
             text: (err && err.message) ? str(err.message)
               : 'The AI coach did not answer. Your full scored debrief is below.' };
  }

  /* Kept for callers outside this module that only want the sentence. */
  function aiErrorMessage(err) { return aiDebriefError(err).text; }

  /* The same six codes, said for the in-sim patient. Deliberately OUT of
     character: a quota wall dressed up as the patient mumbling is the one
     thing a student cannot debug. */
  function aiPatientError(err) {
    var code = err && err.code ? String(err.code) : 'server';
    if (err && err.timedOut) {
      return { code: code, retry: true,
               text: 'Your patient did not answer in time. Ask again, or use the scripted prompts above.' };
    }
    if (code === 'no-auth') {
      return { code: code, retry: false,
               text: 'You are signed out, so the patient cannot answer free text. The scripted prompts above still work.' };
    }
    if (code === 'tier-denied') {
      return { code: code, retry: false,
               text: 'Free-text answers from the patient are not included in your plan. The scripted prompts above still work.' };
    }
    if (code === 'quota-exceeded') {
      return { code: code, retry: false,
               text: 'That is all your AI messages for today. The scripted prompts above still work, and the sim scores normally.' };
    }
    if (code === 'ai-disabled') {
      return { code: code, retry: false,
               text: 'AI is switched off site-wide, so the patient cannot answer free text. The scripted prompts above still work.' };
    }
    if (code === 'network') {
      return { code: code, retry: true,
               text: 'Could not reach your patient - check your connection. Your question is still in the log.' };
    }
    return { code: 'server', retry: true,
             text: (err && err.message) ? str(err.message)
               : 'Your patient did not answer that one. Try again, or ask it another way.' };
  }

  /* ---------------------------------------------------------------------- *
   * 9. UI atoms
   * ---------------------------------------------------------------------- */
  function Icon(props) {
    return ce('span', { className: 'sim-ico', 'aria-hidden': 'true', style: props.style }, props.children || props.text);
  }

  function Badge(props) {
    return ce('span', { className: 'sim-badge ' + (props.tone || '') }, props.children);
  }

  function Bar(props) {
    var pct = clamp(parseNum(props.pct) || 0, 0, 100);
    var color = props.color || 'var(--accent)';
    return ce('div', { className: 'sim-bar', role: 'img',
      'aria-label': (props.label || 'progress') + ': ' + Math.round(pct) + ' percent' },
      ce('span', { style: { width: pct + '%', background: color } }));
  }

  function ConfirmDialog(props) {
    var boxRef = useRef(null);
    useEffect(function () {
      if (boxRef.current) { try { boxRef.current.focus(); } catch (e) {} }
      function onKey(e) { if (e.key === 'Escape') { props.onCancel(); } }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, []);
    return ce('div', { className: 'sim-modal-bg', onClick: function (e) { if (e.target === e.currentTarget) { props.onCancel(); } } },
      ce('div', { className: 'sim-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title },
        ce('h3', { style: { margin: '0 0 8px', fontSize: '17px', fontWeight: 800 } }, props.title),
        ce('p', { style: { margin: 0, fontSize: '13.5px', color: 'var(--text2)', lineHeight: 1.55 } }, props.body),
        ce('div', { className: 'sim-btnrow' },
          ce('button', { className: 'btn btn-outline', onClick: props.onCancel }, props.cancelText || 'Stay in the sim'),
          ce('button', { ref: boxRef, className: 'btn btn-primary',
            style: { background: 'var(--red)', borderColor: 'var(--red)' },
            onClick: props.onConfirm }, props.confirmText || 'Quit'))));
  }

  /* --- animated number ------------------------------------------------- *
   * NEVER use this for a clinical value. Interpolating a vital sign paints
   * readings the patient never had. It is here for the score ring only.
   * ---------------------------------------------------------------------- */
  function useTween(target, ms) {
    var [val, setVal] = useState(target);
    var rafRef = useRef(null);
    var fromRef = useRef(target);
    useEffect(function () {
      if (target === null || target === undefined || !isFinite(target)) { setVal(target); return; }
      var from = fromRef.current;
      if (from === null || from === undefined || !isFinite(from) || reduceMotion()) {
        fromRef.current = target; setVal(target); return;
      }
      if (from === target) { return; }
      var start = 0, dur = ms || 900;
      function step(ts) {
        if (!start) { start = ts; }
        var t = clamp((ts - start) / dur, 0, 1);
        var e = 1 - Math.pow(1 - t, 3);
        var v = from + (target - from) * e;
        setVal(v);
        if (t < 1) { rafRef.current = window.requestAnimationFrame(step); }
        else { fromRef.current = target; setVal(target); }
      }
      rafRef.current = window.requestAnimationFrame(step);
      return function () { if (rafRef.current) { window.cancelAnimationFrame(rafRef.current); } fromRef.current = target; };
    }, [target]);
    return val;
  }

  /* --- sparkline ------------------------------------------------------- */
  function VitalSparkline(props) {
    var pts = arr(props.points).filter(function (n) { return typeof n === 'number' && isFinite(n); });
    if (pts.length < 2) { return null; }
    var w = 68, h = 20, pad = 2;
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    var span = (max - min) || 1;
    var d = pts.map(function (v, i) {
      var x = pad + (i * (w - pad * 2)) / (pts.length - 1);
      var y = h - pad - ((v - min) / span) * (h - pad * 2);
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    return ce('svg', { className: 'spark', viewBox: '0 0 ' + w + ' ' + h, width: '100%', height: h,
      preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
      ce('path', { d: d, fill: 'none', stroke: props.color || 'var(--text3)', strokeWidth: 1.6,
        strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }

  /* --- one vital tile -------------------------------------------------- *
   * The displayed number is always the charted value - it is never tweened.
   * A 900ms ease from HR 88 to 142 shows ~30 readings this patient never had,
   * which in a teaching monitor is misinformation, not polish. The change is
   * carried instead by a one-shot tile cue, a direction mark and a printed
   * delta, all of which survive prefers-reduced-motion.
   * ---------------------------------------------------------------------- */
  function VitalTile(props) {
    var v = props.value;
    var state = props.state || 'na';
    var text;
    if (props.text !== undefined && props.text !== null) { text = props.text; }
    else if (typeof v === 'number' && isFinite(v)) {
      text = String(Math.round(v * (props.dec ? 10 : 1)) / (props.dec ? 10 : 1));
    } else { text = '--'; }

    var prevRef = useRef(text);
    var changedHook = useState(false);
    var changed = changedHook[0], setChanged = changedHook[1];
    useEffect(function () {
      if (prevRef.current === text) { return; }
      prevRef.current = text;
      setChanged(true);
      var id = window.setTimeout(function () { setChanged(false); }, 1000);
      return function () { window.clearTimeout(id); };
    }, [text]);

    var pts = arr(props.points).filter(function (n) { return typeof n === 'number' && isFinite(n); });
    var delta = null;
    if (pts.length >= 2) {
      delta = Math.round((pts[pts.length - 1] - pts[pts.length - 2]) * 10) / 10;
    }

    var cls = 'sim-vital' + (state === 'warn' ? ' warn' : state === 'crit' ? ' crit' : '') +
      (changed ? ' changed' : '');
    var trend = props.trend;
    var mark = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '';
    var stateWord = state === 'crit' ? 'CRITICAL' : state === 'warn' ? 'ABNORMAL' : '';
    return ce('div', { className: cls, role: 'group',
      'aria-label': props.label + ' ' + text + ' ' + (props.unit || '') + ' ' + stateWord },
      ce('span', { className: 'lab' },
        props.label,
        stateWord ? ce('span', { className: 'trendmark', 'aria-hidden': 'true' },
          state === 'crit' ? '✖' : '!') : null,
        mark ? ce('span', { className: 'trendmark', 'aria-hidden': 'true' }, mark) : null),
      ce('span', { className: 'val' }, text,
        props.unit ? ce('span', { className: 'unit' }, ' ' + props.unit) : null),
      ce('span', { className: 'dlt', 'aria-hidden': 'true' },
        delta ? (delta > 0 ? '▲ ' : '▼ ') + Math.abs(delta) : '—'),
      ce(VitalSparkline, { points: props.points,
        color: state === 'crit' ? 'var(--sim-vbad)' : state === 'warn' ? 'var(--sim-vwarn)' : 'var(--text3)' }));
  }

  /* ---------------------------------------------------------------------- *
   * 10. VitalsMonitor
   * ---------------------------------------------------------------------- */
  function VitalsMonitor(props) {
    var v = obj(props.vitals);
    var band = props.band || 'adult';
    var trend = obj(props.trend);          // arrays keyed by vital
    var flagSev = flagSeverity(v.flags);

    function st(key, val) {
      /* a scenario flag can only make a vital look worse, never better */
      return vitalState(key, val, band, v.flags);
    }
    function dir(list, val) {
      var l = arr(list);
      if (l.length < 2 || typeof val !== 'number') { return ''; }
      var prev = l[l.length - 2];
      if (typeof prev !== 'number') { return ''; }
      if (val > prev + 0.5) { return 'up'; }
      if (val < prev - 0.5) { return 'down'; }
      return '';
    }

    var sysState = st('sys', v.sys);
    var painState = (v.pain !== null && v.pain >= 7) ? 'crit'
      : (v.pain !== null && v.pain >= 4) ? 'warn' : 'na';

    /* ---- threshold-crossing announcer ------------------------------------
     * The grid is NOT wrapped in aria-live: six numbers re-read on every
     * 400ms tick is unusable. Only a change of state for a vital is spoken,
     * and never more than once every 10 seconds.
     * -------------------------------------------------------------------- */
    var spokenRef = useRef(null);
    var lastSpeakRef = useRef(0);
    var watched = [
      ['SpO2', v.spo2, st('spo2', v.spo2)],
      ['Heart rate', v.hr, st('hr', v.hr)],
      ['Respiratory rate', v.rr, st('rr', v.rr)],
      ['Blood pressure', v.bpText, sysState],
      ['Temperature', v.tempText, st('temp', v.temp)]
    ];
    var stateKey = watched.map(function (t) { return t[2]; }).join('');
    useEffect(function () {
      var first = spokenRef.current === null;
      if (first) { spokenRef.current = {}; }
      var msgs = [], urgent = false;
      watched.forEach(function (t) {
        var prev = spokenRef.current[t[0]];
        if (t[2] === 'na' || prev === t[2]) { return; }
        spokenRef.current[t[0]] = t[2];
        if (t[2] === 'crit') { urgent = true; }
        if (first && t[2] === 'ok') { return; }
        if (prev === undefined && t[2] === 'ok') { return; }
        msgs.push(t[0] + ' ' + str(t[1]) +
          (t[2] === 'crit' ? ', critical' : t[2] === 'warn' ? ', abnormal' : ', back within limits'));
      });
      if (first || !msgs.length) { return; }
      var now = Date.now();
      if (!urgent && now - lastSpeakRef.current < 10000) { return; }
      lastSpeakRef.current = now;
      announce(msgs.join('. '), urgent);
    }, [stateKey]);

    var tiles = [
      ce(VitalTile, { key: 'bp', label: 'BP', unit: 'mmHg', text: v.bpText, state: sysState,
        points: trend.sys, trend: dir(trend.sys, v.sys) }),
      ce(VitalTile, { key: 'hr', label: 'HR', unit: 'bpm', value: v.hr, state: st('hr', v.hr),
        points: trend.hr, trend: dir(trend.hr, v.hr) }),
      ce(VitalTile, { key: 'rr', label: 'RR', unit: '/min', value: v.rr, state: st('rr', v.rr),
        points: trend.rr, trend: dir(trend.rr, v.rr) }),
      ce(VitalTile, { key: 'spo2', label: 'SpO2', unit: '%', value: v.spo2, state: st('spo2', v.spo2),
        points: trend.spo2, trend: dir(trend.spo2, v.spo2) }),
      ce(VitalTile, { key: 'temp', label: 'Temp', text: v.tempText, state: st('temp', v.temp),
        points: trend.temp, trend: dir(trend.temp, v.temp) }),
      /* pain is a number here; the sentence the patient actually said goes in
         the text row below, where it has room to be read */
      ce(VitalTile, { key: 'pain', label: 'Pain', unit: '/10', dec: false,
        value: (typeof v.pain === 'number' && isFinite(v.pain)) ? v.pain : null,
        text: (typeof v.pain === 'number' && isFinite(v.pain)) ? undefined : '--',
        state: painState,
        points: trend.pain, trend: dir(trend.pain, v.pain) })
    ];

    return ce('div', { className: 'sim-mon' },
      ce('div', { className: 'sim-mon-head' },
        ce(Icon, { text: 'PT' }),
        ce('div', null,
          ce('div', { className: 'sim-pt-name' }, str(props.name) || 'Patient'),
          ce('div', { style: { fontSize: '11.5px', color: 'var(--text2)' } },
            [str(props.age), str(props.dx)].filter(has).join(' · '))),
        ce('div', { className: 'sim-spacer' }),
        props.switcher ? props.switcher : null,
        props.clock ? props.clock : null),
      ce('div', { className: 'sim-vitals', role: 'group', 'aria-label': 'Current vital signs' }, tiles),
      ce('div', { className: 'sim-mon-text' },
        ce('div', null, ce('b', null, 'LOC: '), str(v.loc) || '--'),
        (has(v.painText) && str(v.painText) !== '--')
          ? ce('div', null, ce('b', null, 'Pain: '), str(v.painText)) : null,
        v.other ? ce('div', null, ce('b', null, 'Findings: '), v.other) : null,
        v.label ? ce('div', { style: { color: 'var(--text3)', fontSize: '11.5px' } },
          'Monitor state: ' + v.label) : null),
      props.stabilizer ? props.stabilizer : null);
  }

  /* ---------------------------------------------------------------------- *
   * 11. Event log
   * ---------------------------------------------------------------------- */
  var LOG_KIND = {
    action: { cls: '', tag: 'ACTION' },
    good: { cls: 'good', tag: 'CORRECT' },
    bad: { cls: 'bad', tag: 'HARM' },
    warn: { cls: 'warn', tag: 'ORDER' },
    vital: { cls: 'vital', tag: 'VITALS' },
    alert: { cls: 'bad', tag: 'ALERT' },
    patient: { cls: 'patient', tag: 'PATIENT' },
    info: { cls: '', tag: 'NOTE' },
    hold: { cls: 'good', tag: 'STABLE' }
  };

  function SimEventLog(props) {
    var bodyRef = useRef(null);
    var entries = arr(props.entries);
    useEffect(function () {
      var el = bodyRef.current;
      if (el) { try { el.scrollTop = el.scrollHeight; } catch (e) {} }
    }, [entries.length]);
    return ce('div', { className: 'sim-log' },
      ce('div', { className: 'sim-log-head' },
        ce('span', null, 'Event log'),
        ce('span', { className: 'sim-spacer' }),
        ce('span', { style: { fontWeight: 700, color: 'var(--text3)' } }, entries.length + ' entries')),
      /* tabIndex so the scroll region is reachable without a mouse */
      ce('div', { className: 'sim-log-body', ref: bodyRef, role: 'log', 'aria-live': 'polite',
        'aria-relevant': 'additions', tabIndex: 0, 'aria-label': 'Event log' },
        entries.length ? entries.map(function (e, i) {
          var k = LOG_KIND[e.kind] || LOG_KIND.info;
          return ce('div', { className: 'sim-le ' + k.cls, key: e.key || i },
            ce('time', null, fmtClock(e.t)),
            ce('div', null,
              ce('div', { className: 'k' }, k.tag),
              ce('div', null, e.text),
              e.detail ? ce('div', { style: { color: 'var(--text2)', marginTop: '2px' } }, e.detail) : null));
        }) : ce('div', { className: 'sim-empty' }, 'Nothing has happened yet. Start assessing.')));
  }

  /* ---------------------------------------------------------------------- *
   * 12. Action panel
   * ---------------------------------------------------------------------- */
  function SimActionPanel(props) {
    var [tab, setTab] = useState('all');
    var [q, setQ] = useState('');
    var actions = arr(props.actions);
    var doneMap = obj(props.doneMap);

    var visible = useMemo(function () {
      var needle = lower(q).trim();
      return actions.filter(function (a) {
        if (tab !== 'all' && a.group !== tab) { return false; }
        if (needle && lower(a.label).indexOf(needle) === -1 && lower(a.sub).indexOf(needle) === -1) { return false; }
        return true;
      });
    }, [actions, tab, q]);

    var tabs = [{ id: 'all', label: 'All', icon: '' }].concat(GROUPS);

    return ce('div', null,
      ce('div', { className: 'sim-filters' },
        ce('input', {
          className: 'sim-search', type: 'search', value: q,
          'aria-label': 'Search available actions',
          placeholder: 'Search actions (e.g. oxygen, albuterol, SBAR)',
          onChange: function (e) { setQ(e.target.value); }
        })),
      ce('div', { className: 'sim-tabs', role: 'tablist', 'aria-label': 'Action categories' },
        tabs.map(function (t) {
          var n = t.id === 'all' ? actions.length : actions.filter(function (a) { return a.group === t.id; }).length;
          return ce('button', {
            key: t.id, className: 'sim-tab', role: 'tab', type: 'button',
            'aria-selected': tab === t.id ? 'true' : 'false',
            onClick: function () { setTab(t.id); }
          }, t.label + ' (' + n + ')');
        })),
      visible.length
        ? ce('div', { className: 'sim-actionwrap' },
          ce('div', {
            className: 'sim-actions', tabIndex: 0, role: 'group',
            'aria-label': visible.length + ' available actions, scrollable'
          }, visible.map(function (a) {
            var used = doneMap[a.id];
            var cls = 'sim-action' + (used === 'good' ? ' done' : used === 'bad' ? ' usedbad' : '');
            return ce('button', {
              key: a.id, type: 'button', className: cls,
              disabled: !!used || !!props.locked,
              onClick: function () { props.onAct(a); },
              'aria-label': a.label + (used ? ' (already performed)' : '')
            },
              ce(Icon, { text: a.icon || '·' }),
              ce('span', { style: { flex: '1 1 auto' } },
                ce('span', { className: 'txt' }, a.label),
                a.sub ? ce('span', { className: 'sub' }, a.sub) : null,
                used ? ce('span', { className: 'sub' },
                  used === 'good' ? '✓ performed' : '✕ performed - see debrief') : null));
          })))
        : ce('div', { className: 'sim-empty' }, 'No actions match that search.'));
  }

  /* ---------------------------------------------------------------------- *
   * 13. Chart viewer
   * ---------------------------------------------------------------------- */
  function SimChartViewer(props) {
    var sc = obj(props.scenario);
    var unlocked = obj(props.unlocked);
    var [tab, setTab] = useState(props.tab || 'labs');
    useEffect(function () { if (props.tab) { setTab(props.tab); } }, [props.tab]);

    var tabs = [
      { id: 'labs', label: 'Labs' }, { id: 'diagnostics', label: 'Diagnostics' },
      { id: 'orders', label: 'Orders' }, { id: 'history', label: 'History' }
    ];

    function locked(id) {
      return !unlocked[id];
    }

    function renderLabs() {
      var labs = arr(sc.labs);
      if (!labs.length) { return ce('div', { className: 'sim-empty' }, 'No labs documented for this scenario.'); }
      var panels = {};
      labs.forEach(function (l) {
        var p = str(l.panel) || 'Other';
        if (!panels[p]) { panels[p] = []; }
        panels[p].push(l);
      });
      return ce('div', { style: { display: 'grid', gap: '12px' } },
        Object.keys(panels).map(function (p) {
          return ce('div', { key: p },
            ce('h3', null, p),
            ce('div', { style: { display: 'grid', gap: '6px' } },
              panels[p].map(function (l, i) {
                var s = lower(l.status);
                var crit = s.indexOf('critical') === 0;
                var ab = crit || s === 'high' || s === 'low';
                var tone = crit ? 'bad' : ab ? 'warn' : 'ok';
                return ce('div', { key: i, className: 'sim-labrow' + (crit ? ' crit' : ab ? ' ab' : '') },
                  ce('div', null,
                    ce('div', { className: 'nm' }, str(l.name)),
                    ce('div', { className: 'rng' }, 'Normal ' + (str(l.normalRange) || 'n/a'))),
                  ce('div', { style: { fontWeight: 800, fontVariantNumeric: 'tabular-nums' } },
                    str(l.value) + ' ' + str(l.unit)),
                  ce(Badge, { tone: tone },
                    crit ? '✖ ' + str(l.status) : ab ? '! ' + str(l.status) : '✓ normal'),
                  ce('span'),
                  l.interpretation ? ce('div', { className: 'sim-interp' }, str(l.interpretation)) : null);
              })));
        }));
    }

    function renderDx() {
      var dx = arr(sc.diagnostics);
      if (!dx.length) { return ce('div', { className: 'sim-empty' }, 'No diagnostic studies documented.'); }
      return ce('div', { style: { display: 'grid', gap: '8px' } }, dx.map(function (d, i) {
        return ce('div', { key: i, className: 'sim-labrow', style: { gridTemplateColumns: '1fr' } },
          ce('div', { className: 'nm' }, str(d.name)),
          ce('div', null, str(d.finding)),
          d.interpretation ? ce('div', { className: 'sim-interp' }, str(d.interpretation)) : null);
      }));
    }

    function renderOrders() {
      var os = arr(sc.orders);
      if (!os.length) { return ce('div', { className: 'sim-empty' }, 'No provider orders documented.'); }
      return ce('div', { style: { display: 'grid', gap: '6px' } }, os.map(function (o, i) {
        return ce('div', { key: i, className: 'sim-labrow', style: { gridTemplateColumns: '1fr auto' } },
          ce('div', null, str(o.text)),
          ce(Badge, { tone: '' }, str(o.category) || 'order'));
      }));
    }

    function renderHistory() {
      var p = obj(props.patient);
      return ce('div', { style: { display: 'grid', gap: '10px' } },
        ce('div', null,
          ce('h3', null, 'Chart'),
          [['Name', p.name], ['Age', p.age], ['DOB', p.dob], ['Sex', p.sex],
           ['Weight', p.weightKg ? p.weightKg + ' kg' : ''], ['Diagnosis', p.diagnosis],
           ['Allergies', arr(p.allergies).join(', ')], ['Code status', p.codeStatus],
           ['Gravida/Para', p.gravidaPara], ['Gestation', p.gestationalAge]]
            .filter(function (r) { return has(r[1]); })
            .map(function (r, i) {
              return ce('div', { key: i, className: 'sim-kv' }, ce('b', null, r[0]), ce('span', null, str(r[1])));
            })),
        arr(p.history).length ? ce('div', null,
          ce('h3', null, 'Relevant history'),
          ce('ul', { className: 'sim-list' }, arr(p.history).map(function (h, i) {
            return ce('li', { key: i }, str(h));
          }))) : null,
        arr(sc.comparisons).length ? ce('div', null,
          ce('h3', null, 'Comparison'),
          arr(sc.comparisons).map(function (c, ci) {
            return ce('div', { key: ci, style: { marginBottom: '8px' } },
              ce('div', { style: { fontWeight: 700, fontSize: '13px', marginBottom: '4px' } }, str(c.title)),
              ce('div', { style: { overflowX: 'auto' } },
                ce('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' } },
                  ce('thead', null, ce('tr', null, arr(c.headers).map(function (h, i) {
                    return ce('th', { key: i, style: { textAlign: 'left', padding: '5px', color: 'var(--text2)', borderBottom: '1px solid var(--border)' } }, str(h));
                  }))),
                  ce('tbody', null, arr(c.rows).map(function (row, ri) {
                    return ce('tr', { key: ri }, arr(row).map(function (cell, i) {
                      return ce('td', { key: i, style: { padding: '5px', borderBottom: '1px solid var(--border)' } }, str(cell));
                    }));
                  })))));
          })) : null);
    }

    var body;
    if (locked(tab)) {
      body = ce('div', { className: 'sim-empty' },
        ce('div', { style: { marginBottom: '10px' } },
          'This section is closed. Reviewing the chart is an action you take at the bedside.'),
        ce('button', { type: 'button', className: 'btn btn-primary btn-sm',
          onClick: function () { props.onRequest(tab); } },
          'Review ' + (tab === 'labs' ? 'laboratory results' : tab)));
    } else if (tab === 'labs') { body = renderLabs(); }
    else if (tab === 'diagnostics') { body = renderDx(); }
    else if (tab === 'orders') { body = renderOrders(); }
    else { body = renderHistory(); }

    return ce('div', null,
      ce('div', { className: 'sim-tabs', role: 'tablist', 'aria-label': 'Chart sections' },
        tabs.map(function (t) {
          return ce('button', { key: t.id, type: 'button', className: 'sim-tab', role: 'tab',
            'aria-selected': tab === t.id ? 'true' : 'false',
            onClick: function () { setTab(t.id); } },
            t.label + (unlocked[t.id] ? '' : ' (closed)'));
        })),
      body);
  }

  /* ---------------------------------------------------------------------- *
   * 14. Patient talk panel
   * ---------------------------------------------------------------------- */
  /* concept synonyms keyed by the trigger words that actually appear in the data */
  var TRIGGER_SYN = {
    greeting: ['hello', 'hi', 'hey', 'feel', 'feeling', 'doing', 'happened', 'happening', 'brings', 'today', 'name', 'going'],
    pain: ['pain', 'hurt', 'hurts', 'hurting', 'ache', 'aching', 'sore', 'scale', 'tender', 'burning', 'cramp'],
    assessment: ['press', 'pressing', 'palpate', 'exam', 'listen', 'touch', 'belly', 'abdomen', 'stomach', 'check', 'sounds', 'fundus', 'looking'],
    medication: ['medicine', 'medication', 'meds', 'drug', 'dose', 'pill', 'shot', 'injection', 'give', 'giving', 'treatment'],
    education: ['home', 'teach', 'learn', 'watch', 'discharge', 'follow', 'prevent', 'avoid', 'future', 'again'],
    escalation: ['doctor', 'provider', 'physician', 'call', 'calling', 'help', 'serious', 'emergency'],
    reassurance: ['scared', 'worried', 'worry', 'okay', 'anxious', 'afraid', 'nervous', 'calm', 'fine', 'fault'],
    breathing: ['breath', 'breathe', 'breathing', 'air', 'wheeze', 'wheezing', 'cough', 'chest', 'lungs', 'short', 'tight'],
    position: ['position', 'sit', 'sitting', 'lay', 'lie', 'upright', 'comfortable', 'pillow', 'move'],
    deterioration: ['worse', 'worsening', 'tired', 'sleepy', 'change', 'changed', 'different', 'bad', 'weaker'],
    reassessment: ['better', 'improve', 'improving', 'recheck', 'now', 'since', 'helped', 'working'],
    suctioning: ['suction', 'nose', 'congestion', 'mucus', 'stuffy', 'snot', 'nasal'],
    comfort: ['comfort', 'comfortable', 'soothe', 'calm', 'hold', 'cuddle', 'rest', 'sleep'],
    hydration: ['drink', 'drinking', 'fluid', 'fluids', 'thirsty', 'water', 'juice', 'hydrate', 'wet', 'diaper'],
    'iv-start': ['line', 'needle', 'stick', 'poke', 'catheter', 'start'],
    intervention: ['doing', 'plan', 'next', 'going', 'happens', 'now'],
    diagnosis: ['diagnosis', 'wrong', 'cause', 'caused', 'why', 'mean', 'means'],
    loc: ['awake', 'confused', 'sleepy', 'alert', 'know', 'where', 'oriented', 'remember'],
    bleeding: ['bleed', 'bleeding', 'blood', 'pad', 'clot', 'gush', 'soaked'],
    bladder: ['bladder', 'urine', 'pee', 'void', 'bathroom', 'foley', 'catheter'],
    baby: ['baby', 'infant', 'newborn', 'son', 'daughter', 'child'],
    glucose: ['sugar', 'glucose', 'diabetes', 'diabetic', 'insulin'],
    fever: ['fever', 'temperature', 'hot', 'warm', 'chills'],
    breastfeeding: ['breastfeed', 'breastfeeding', 'breast', 'latch', 'nurse', 'nursing', 'feed', 'feeding', 'milk', 'bottle'],
    partner: ['husband', 'wife', 'partner', 'family', 'mom', 'dad', 'mother', 'father'],
    contractions: ['contraction', 'contractions', 'tighten', 'labor', 'cramping'],
    fetal: ['baby', 'kick', 'kicks', 'moving', 'movement', 'heartbeat', 'monitor']
  };

  var Q_STOP = { the: 1, and: 1, you: 1, your: 1, are: 1, how: 1, what: 1, does: 1, did: 1, can: 1,
    tell: 1, about: 1, with: 1, for: 1, that: 1, this: 1, have: 1, has: 1, any: 1, was: 1, were: 1,
    would: 1, could: 1, feel: 0, please: 1, right: 1, now: 0, from: 1, more: 1, some: 1 };

  function qTokens(q) {
    return lower(q).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) {
      return w.length >= 3 && Q_STOP[w] !== 1;
    });
  }

  /* token-aware match - never a bare substring, so "breathing" cannot match "hi" */
  function tokenHit(toks, w) {
    if (!w) { return false; }
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t === w) { return true; }
      if (w.length >= 5 && t.length >= 5 && (t.indexOf(w) === 0 || w.indexOf(t) === 0)) { return true; }
    }
    return false;
  }

  function matchDialogue(dialogue, question, minScore) {
    var lines = arr(dialogue);
    if (!lines.length) { return null; }
    var threshold = (parseNum(minScore) === null) ? 3 : parseNum(minScore);
    var q = lower(question);
    var toks = qTokens(q);
    var opener = /^\s*(hi|hello|hey|good (morning|afternoon|evening))\b/.test(q) ||
      /how (are|do) you (feel|doing)/.test(q) || /what (happened|brings|is going on)/.test(q);
    var best = null, bestScore = 0;

    lines.forEach(function (d) {
      var trig = lower(d.trigger);
      var score = 0;
      if (trig) {
        var trigWords = trig.split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 3; });
        trigWords.forEach(function (w) { if (tokenHit(toks, w)) { score += 4; } });
        var syn = TRIGGER_SYN[trig];
        if (syn) {
          for (var i = 0; i < syn.length; i++) {
            if (tokenHit(toks, syn[i])) { score += 3; break; }
          }
        }
        if (opener && trig === 'greeting') { score += 5; }
      }
      var lineText = lower(d.line);
      var overlap = 0;
      toks.forEach(function (w) { if (w.length >= 5 && lineText.indexOf(w) !== -1) { overlap++; } });
      score += Math.min(overlap, 3);
      if (score > bestScore) { bestScore = score; best = d; }
    });

    return bestScore >= threshold ? best : null;
  }

  function PatientTalkPanel(props) {
    var sc = obj(props.scenario);
    var [text, setText] = useState('');
    var [busy, setBusy] = useState(false);
    var [listening, setListening] = useState(false);
    var [askErr, setAskErr] = useState(null);
    var waiter = useAiWait();
    var stopRef = useRef(null);
    var liveRef = useRef(true);
    var offResolveRef = useRef(null);
    var resolveTimerRef = useRef(null);
    /* Ref twin of `busy` plus a run counter. Enter and the Ask button and a
       finished voice transcript can all land in the same tick; without these,
       two of them start two patient turns and spend two AI messages. */
    var busyRef = useRef(false);
    var runRef = useRef(0);
    var lastAskRef = useRef('');
    var voice = obj(MMx().voice);
    var isPeds = lower(sc.category) === 'peds';
    var ttsVoice = isPeds ? 'child' : 'patient';
    var supported = (typeof voice.isSupported === 'function') ? obj(voice.isSupported()) : {};

    useEffect(function () {
      return function () {
        liveRef.current = false;
        if (stopRef.current) { try { stopRef.current(); } catch (e) {} }
        if (offResolveRef.current) { try { offResolveRef.current(); } catch (e) {} }
        if (resolveTimerRef.current) { try { clearTimeout(resolveTimerRef.current); } catch (e) {} }
        if (typeof voice.stopSpeaking === 'function') { try { voice.stopSpeaking(); } catch (e) {} }
      };
    }, []);

    function speak(line) {
      if (typeof voice.speak !== 'function') { return; }
      /* MM.voice.speak REJECTS on a browser with no speech synthesis. The
         try/catch never caught that (a rejected promise is not a throw), so
         every patient line on such a browser raised an unhandled rejection.
         Speech is a nicety here; the line is already in the transcript. */
      try {
        var sp = voice.speak(line, { voice: ttsVoice });
        if (sp && typeof sp['catch'] === 'function') { sp['catch'](function () {}); }
      } catch (e) {}
    }

    /* A tier read that never answers must not hold a sim turn open forever.
       ai.js self-resolves at 6s; this is the ceiling on top of that. */
    var RESOLVE_WAIT_MS = 7000;

    /** Every exit from a patient turn goes through here. */
    function settleTurn(runId) {
      if (runId !== runRef.current) { return false; }
      busyRef.current = false;
      if (!liveRef.current) { return false; }
      setBusy(false);
      waiter.end();
      return true;
    }

    function ask(question) {
      var qq = str(question).trim();
      if (!qq || busyRef.current) { return; }
      setText('');
      setAskErr(null);
      props.onExchange({ who: 'you', text: qq });
      var hit = matchDialogue(sc.dialogue, qq);
      if (hit) {
        props.onExchange({ who: str(hit.speaker) || 'patient', text: str(hit.line), scripted: true });
        speak(str(hit.line));
        return;
      }
      lastAskRef.current = qq;
      respond(qq);
    }

    /* Split out of ask() so a question asked before the tier has resolved -
       or one that failed - can simply be re-run without re-posting the
       student's line into the transcript a second time. */
    function respond(qq) {
      var ai = obj(MMx().ai);

      busyRef.current = true;
      var runId = ++runRef.current;
      setBusy(true);
      setAskErr(null);
      // Acknowledgment on the next paint, before any await.
      waiter.begin();

      /* We do not know this account's plan yet. Answering with the "I am not
         sure how to answer that" fallback here would be a verdict we cannot
         support - a Pro student would get the no-AI patient for the first
         second of the sim. Hold the turn (the patient is simply thinking) and
         answer properly the moment the tier lands. */
      if (!aiAvailable() && aiResolving() && typeof ai.onResolved === 'function') {
        var resolved = false;
        var onceResolved = function () {
          if (resolved) { return; }
          resolved = true;
          if (offResolveRef.current) {
            try { offResolveRef.current(); } catch (e) {}
            offResolveRef.current = null;
          }
          if (resolveTimerRef.current) {
            try { clearTimeout(resolveTimerRef.current); } catch (e) {}
            resolveTimerRef.current = null;
          }
          if (!liveRef.current || runId !== runRef.current) { return; }
          busyRef.current = false;
          respond(qq);
        };
        try {
          offResolveRef.current = ai.onResolved(onceResolved);
        } catch (e) {
          settleTurn(runId);
          return;
        }
        /* Before this, a resolution callback that never fired left the input
           reading "Patient is thinking..." and the Ask button disabled for the
           rest of the simulation. */
        resolveTimerRef.current = setTimeout(onceResolved, RESOLVE_WAIT_MS);
        return;
      }

      if (!aiAvailable()) {
        /* no AI: take the closest scripted line we can defend, otherwise stay in character */
        settleTurn(runId);
        var loose = matchDialogue(sc.dialogue, qq, 1);
        var fallback = loose
          ? str(loose.line)
          : 'I am not really sure how to answer that. Can you ask me another way?';
        props.onExchange({ who: loose ? (str(loose.speaker) || 'patient') : 'patient', text: fallback });
        speak(fallback);
        return;
      }

      var p = null;
      if (typeof ai.patientReply === 'function') {
        try { p = ai.patientReply(sc, qq, arr(props.exchanges)); } catch (e) { p = null; }
      }
      if (!p || typeof p.then !== 'function') {
        var pt = obj(sc.patient);
        try {
          p = ai.chat({
            system: 'You are role-playing a patient in a nursing simulation. Stay strictly in character, ' +
              'answer in first person in 1-3 short sentences, use plain lay language, never give medical advice ' +
              'or name your own diagnosis, and never break character. Patient: ' + str(pt.name) + ', ' +
              str(pt.age) + ', ' + str(pt.sex) + '. Presenting problem: ' + str(pt.diagnosis) + '. ' +
              'Known history: ' + arr(pt.history).join('; ') + '. ' +
              'Scripted things this patient has said: ' + arr(sc.dialogue).map(function (d) { return str(d.line); }).join(' | '),
            messages: [{ role: 'user', content: qq }],
            maxTokens: 160,
            feature: 'patient'
          });
        } catch (e) {
          // A synchronous throw used to blow up before .then and leave the
          // panel stuck on "Waiting..." with the Ask button dead.
          p = Promise.reject(e);
        }
      }

      Promise.resolve(p).then(function (reply) {
        if (!settleTurn(runId)) { return; }
        var line = str(reply).trim();
        if (!line) {
          /* An empty answer is a failure, not a patient being coy. Say so
             instead of putting words in the patient's mouth. */
          setAskErr(aiPatientError({ code: 'server' }));
          return;
        }
        props.onExchange({ who: 'patient', text: line });
        speak(line);
      }, function (e) {
        if (!settleTurn(runId)) { return; }
        /* This used to post "I... I am not sure" as if the PATIENT had said it,
           which hid a spent quota, a signed-out session and a dropped
           connection behind an in-character line the student then tried to
           work with. The student's own question stays in the transcript and
           Try again re-runs it without re-posting it. */
        setAskErr(aiPatientError(e));
      });
    }

    /* Give up on a patient turn that is not coming. The sim clock is running;
       being stuck behind a dead request is worse than losing the answer. */
    function cancelAsk() {
      if (!busyRef.current) { return; }
      runRef.current++;
      busyRef.current = false;
      if (offResolveRef.current) { try { offResolveRef.current(); } catch (e) {} offResolveRef.current = null; }
      if (resolveTimerRef.current) { try { clearTimeout(resolveTimerRef.current); } catch (e) {} resolveTimerRef.current = null; }
      setBusy(false);
      waiter.end();
      setAskErr({ code: 'cancelled', retry: true,
                  text: 'Stopped waiting. Your question is still in the log - ask it again, or use the prompts above.' });
    }

    /* Re-run the SAME question. It never re-posts the student's line, and
       busyRef is set again synchronously inside respond(), so a fast double
       tap cannot start two turns. */
    function retryAsk() {
      var qq = lastAskRef.current;
      if (!qq) { return; }
      runRef.current++;
      busyRef.current = false;
      if (offResolveRef.current) { try { offResolveRef.current(); } catch (e) {} offResolveRef.current = null; }
      if (resolveTimerRef.current) { try { clearTimeout(resolveTimerRef.current); } catch (e) {} resolveTimerRef.current = null; }
      waiter.end();
      respond(qq);
    }

    function micToggle() {
      if (listening) {
        if (stopRef.current) { try { stopRef.current(); } catch (e) {} }
        setListening(false);
        return;
      }
      if (typeof voice.listen !== 'function') { return; }
      setListening(true);
      try {
        stopRef.current = voice.listen({
          onResult: function (t) { setText(str(t)); },
          onEnd: function (finalText) { setListening(false); if (str(finalText).trim()) { ask(finalText); } },
          onError: function () { setListening(false); }
        });
      } catch (e) { setListening(false); }
    }

    var quick = uniqBy(arr(sc.dialogue), function (d) { return str(d.trigger); })
      .slice(0, 5).map(function (d) { return str(d.trigger); }).filter(has);

    var micNode = null;
    if (window.VoiceButton) {
      micNode = ce(window.VoiceButton, {
        label: 'Ask by voice', size: 'sm', voice: ttsVoice,
        onResult: function (t) { ask(t); },
        onTranscript: function (t) { ask(t); },
        onFinal: function (t) { ask(t); }
      });
    } else if (supported.stt) {
      micNode = ce('button', {
        type: 'button', className: 'btn btn-outline btn-sm',
        'aria-pressed': listening ? 'true' : 'false', onClick: micToggle
      }, listening ? '● Listening - tap to stop' : 'MIC - ask by voice');
    }

    return ce('div', null,
      ce('div', { className: 'sim-talk', tabIndex: 0, role: 'region',
        'aria-label': 'Conversation with the patient' },
        arr(props.exchanges).length
          ? arr(props.exchanges).map(function (m, i) {
              return ce('div', { key: i, className: 'sim-bub ' + (m.who === 'you' ? 'you' : 'pt') },
                ce('span', { className: 'who' }, m.who === 'you' ? 'You' : str(m.who)),
                m.text);
            })
          : ce('div', { className: 'sim-empty' },
              'Talk to your patient. Start with "How are you feeling?"')),
      quick.length ? ce('div', { className: 'sim-filters', style: { marginTop: '10px' } },
        quick.map(function (t) {
          return ce('button', { key: t, type: 'button', className: 'sim-chip', disabled: busy,
            onClick: function () { ask('Tell me about ' + t); } }, 'Ask about ' + t);
        })) : null,
      /* The honest wait. It starts on the keystroke, counts wall time and
         escalates, so a buffered stream that delivers nothing for 30 seconds
         still reads as "slow", never as "broken". */
      ce(WaitNote, {
        wait: waiter.wait, texts: WAIT_TEXT_PATIENT,
        onRetry: retryAsk, onCancel: cancelAsk
      }),
      askErr ? ce('div', { className: 'sim-fb mid', role: 'alert', 'data-code': askErr.code,
        style: { marginTop: '8px' } },
        ce('span', { className: 'mark' }, '!'),
        ce('span', null, askErr.text,
          askErr.retry ? ce('span', { className: 'sim-btnrow', style: { marginTop: '8px' } },
            ce('button', { type: 'button', className: 'btn btn-outline btn-sm', disabled: busy,
              onClick: retryAsk }, 'Try again'),
            ce('button', { type: 'button', className: 'btn btn-outline btn-sm',
              onClick: function () { setAskErr(null); } }, 'Dismiss')) : null)) : null,
      ce('div', { className: 'sim-filters', style: { marginTop: '8px' } },
        ce('input', {
          className: 'sim-search', value: text, 'aria-label': 'Ask the patient a question',
          placeholder: busy ? 'Patient is thinking...' : 'Ask the patient a question',
          onChange: function (e) { setText(e.target.value); },
          onKeyDown: function (e) { if (e.key === 'Enter') { ask(text); } }
        }),
        micNode,
        ce('button', { type: 'button', className: 'btn btn-primary btn-sm', disabled: busy,
          'aria-busy': busy ? 'true' : 'false',
          onClick: function () { ask(text); } }, busy ? 'Waiting...' : 'Ask')));
  }

  /* ---------------------------------------------------------------------- *
   * 15. SBAR panel
   * ---------------------------------------------------------------------- */
  var SBAR_FIELDS = [
    { key: 'situation', label: 'S - Situation', hint: 'Who you are, who the patient is, and what is happening right now.' },
    { key: 'background', label: 'B - Background', hint: 'Diagnosis, relevant history, what has been done so far.' },
    { key: 'assessment', label: 'A - Assessment', hint: 'Your current vitals and what you think is going on.' },
    { key: 'recommendation', label: 'R - Recommendation', hint: 'What you want from the provider. Be specific.' }
  ];

  function SimSBARPanel(props) {
    var sc = obj(props.scenario);
    var model = obj(sc.sbar);
    var [vals, setVals] = useState({ situation: '', background: '', assessment: '', recommendation: '' });
    var [showModel, setShowModel] = useState(false);
    var [sent, setSent] = useState(false);

    if (window.SBARRecorder && !props.forceTyped) {
      return ce('div', null,
        ce(window.SBARRecorder, {
          scenario: sc, sbar: model, patient: props.patient,
          onComplete: function (payload) { setSent(true); props.onComplete(obj(payload)); },
          onDone: function (payload) { setSent(true); props.onComplete(obj(payload)); }
        }),
        sent ? ce('div', { className: 'sim-fb good', style: { marginTop: '10px' } },
          ce('span', { className: 'mark' }, '✓'),
          ce('span', null, 'Report given. The provider is on the way.')) : null);
    }

    function done() {
      var filled = SBAR_FIELDS.filter(function (f) { return str(vals[f.key]).trim().length > 8; }).length;
      setSent(true);
      props.onComplete({ values: vals, filled: filled, total: SBAR_FIELDS.length });
    }

    if (sent) {
      return ce('div', null,
        ce('div', { className: 'sim-fb good' },
          ce('span', { className: 'mark' }, '✓'),
          ce('span', null, 'Report given. Your SBAR is in the event log and will be reviewed in the debrief.')),
        model.recommendation ? ce('div', { className: 'sim-panel', style: { marginTop: '10px' } },
          ce('h3', null, 'Model SBAR for this patient'),
          SBAR_FIELDS.map(function (f) {
            return model[f.key] ? ce('div', { key: f.key, style: { marginBottom: '8px', fontSize: '13px', lineHeight: 1.55 } },
              ce('b', null, f.label + ': '), str(model[f.key])) : null;
          })) : null);
    }

    return ce('div', null,
      ce('p', { style: { margin: '0 0 10px', fontSize: '13px', color: 'var(--text2)' } },
        'The provider has picked up. Give your report.'),
      SBAR_FIELDS.map(function (f) {
        return ce('div', { key: f.key, style: { marginBottom: '10px' } },
          ce('label', { htmlFor: 'sbar-' + f.key,
            style: { display: 'block', fontSize: '12px', fontWeight: 800, marginBottom: '4px' } }, f.label),
          ce('div', { style: { fontSize: '11.5px', color: 'var(--text3)', marginBottom: '4px' } }, f.hint),
          ce('textarea', {
            id: 'sbar-' + f.key, value: vals[f.key], rows: 2,
            className: 'sim-search', style: { width: '100%', resize: 'vertical', fontFamily: 'inherit' },
            onChange: function (e) {
              var v = e.target.value;
              setVals(function (prev) {
                var n = {};
                for (var k in prev) { if (Object.prototype.hasOwnProperty.call(prev, k)) { n[k] = prev[k]; } }
                n[f.key] = v; return n;
              });
            }
          }));
      }),
      ce('div', { className: 'sim-btnrow' },
        ce('button', { type: 'button', className: 'btn btn-primary', onClick: done }, 'Give report'),
        ce('button', { type: 'button', className: 'btn btn-outline',
          onClick: function () { setShowModel(!showModel); },
          'aria-expanded': showModel ? 'true' : 'false' },
          showModel ? 'Hide model report' : 'Show model report'),
        ce('button', { type: 'button', className: 'sim-back', onClick: props.onCancel }, 'Back to the bedside')),
      showModel ? ce('div', { className: 'sim-panel', style: { marginTop: '10px' } },
        ce('h3', null, 'Model SBAR'),
        SBAR_FIELDS.map(function (f) {
          return model[f.key] ? ce('div', { key: f.key, style: { marginBottom: '8px', fontSize: '13px', lineHeight: 1.55 } },
            ce('b', null, f.label + ': '), str(model[f.key])) : null;
        }),
        !model.situation ? ce('div', { className: 'sim-empty' }, 'No model report was written for this scenario.') : null) : null);
  }

  /* ---------------------------------------------------------------------- *
   * 16. Dosage calculation gate
   * ---------------------------------------------------------------------- */
  function numbersMatch(a, b) {
    var x = parseNum(a), y = parseNum(b);
    if (x === null || y === null) { return lower(a).trim() === lower(b).trim(); }
    var tol = Math.max(0.01, Math.abs(y) * 0.01);
    return Math.abs(x - y) <= tol;
  }

  function SimDoseGate(props) {
    var calcs = arr(props.calcs);
    var [idx, setIdx] = useState(0);
    var [stepIdx, setStepIdx] = useState(0);
    var [status, setStatus] = useState('');
    var [val, setVal] = useState('');
    var [tries, setTries] = useState(0);
    var [holdChoice, setHoldChoice] = useState('');

    var calc = obj(calcs[idx]);
    var steps = arr(calc.steps);
    var step = obj(steps[stepIdx]);
    var expected = has(step.answer) ? step.answer : calc.answer;

    function submit(raw) {
      var v = str(raw).trim();
      if (!v) { return; }
      if (numbersMatch(v, expected)) {
        setStatus('correct');
        window.setTimeout(function () {
          if (stepIdx + 1 < steps.length) {
            setStepIdx(stepIdx + 1); setStatus(''); setVal(''); setTries(0);
          } else {
            setStatus('step-done');
          }
        }, 550);
      } else {
        setStatus('wrong');
        setTries(tries + 1);
      }
    }

    function finishCalc(safeDecision) {
      if (idx + 1 < calcs.length && !props.singleCalc) {
        setIdx(idx + 1); setStepIdx(0); setStatus(''); setVal(''); setTries(0); setHoldChoice('');
      } else {
        props.onDone({
          correct: true,
          isSafe: calc.isSafe !== false,
          heldAndClarified: safeDecision === 'hold',
          calcId: str(calc.id)
        });
      }
    }

    var unsafe = calc.isSafe === false;
    var allStepsDone = status === 'step-done';

    return ce('div', { className: 'sim-panel', role: 'group', 'aria-label': 'Dosage calculation required' },
      ce('div', { className: 'sim-mon-head', style: { marginBottom: '8px' } },
        ce(Icon, { text: 'CALC' }),
        ce('div', null,
          ce('div', { style: { fontWeight: 800, fontSize: '14px' } }, 'Calculate before you give it'),
          ce('div', { style: { fontSize: '11.5px', color: 'var(--text2)' } },
            'Dose check ' + (idx + 1) + ' of ' + calcs.length)),
        ce('div', { className: 'sim-spacer' }),
        unsafe ? ce(Badge, { tone: 'warn' }, '! safe-dose check') : null),
      ce('p', { style: { fontSize: '13.5px', lineHeight: 1.55, margin: '0 0 10px' } }, str(calc.text)),
      has(calc.safeRange) ? ce('div', { style: { fontSize: '12px', color: 'var(--text2)', marginBottom: '10px' } },
        ce('b', null, 'Safe range: '), str(calc.safeRange)) : null,

      !allStepsDone ? ce('div', null,
        steps.length > 1 ? ce('div', { style: { fontSize: '12px', color: 'var(--text3)', marginBottom: '6px' } },
          'Step ' + (stepIdx + 1) + ' of ' + steps.length + (step.label ? ' - ' + str(step.label) : '')) : null,
        window.StepCalc
          ? ce(window.StepCalc, {
              hint: str(step.hint) || str(calc.text),
              answer: str(expected),
              unit: str(step.unit) || str(calc.unit),
              isActive: true,
              status: status === 'correct' ? 'correct' : status === 'wrong' ? 'wrong' : '',
              onResult: function (r) { submit(r); }
            })
          : ce('div', { className: 'sim-filters' },
              ce('input', {
                className: 'sim-search', value: val, inputMode: 'decimal',
                'aria-label': 'Your calculated answer',
                placeholder: 'Your answer' + (step.unit ? ' in ' + str(step.unit) : ''),
                onChange: function (e) { setVal(e.target.value); },
                onKeyDown: function (e) { if (e.key === 'Enter') { submit(val); } }
              }),
              ce('button', { type: 'button', className: 'btn btn-primary btn-sm',
                onClick: function () { submit(val); } }, 'Check')),
        status === 'wrong' ? ce('div', { className: 'sim-fb bad', style: { marginTop: '8px' } },
          ce('span', { className: 'mark' }, '✕'),
          ce('span', null, 'Not right. ' + (tries >= 1 && step.hint ? 'Set it up like this: ' + str(step.hint) : 'Recheck your setup and units.'))) : null,
        status === 'correct' ? ce('div', { className: 'sim-fb good', style: { marginTop: '8px' } },
          ce('span', { className: 'mark' }, '✓'), ce('span', null, 'Correct.')) : null,
        ce('div', { className: 'sim-btnrow' },
          ce('button', { type: 'button', className: 'sim-back', onClick: props.onCancel },
            'Cancel - do not give this medication'))) : null,

      allStepsDone ? ce('div', null,
        ce('div', { className: 'sim-fb good' },
          ce('span', { className: 'mark' }, '✓'),
          ce('span', null, 'Calculation complete: ' + str(calc.answer) + ' ' + str(calc.unit) + '.')),
        unsafe
          ? ce('div', { style: { marginTop: '10px' } },
              ce('div', { className: 'sim-fb mid' },
                ce('span', { className: 'mark' }, '!'),
                ce('span', null, 'The ordered dose does not match the safe dose you just calculated. What do you do?')),
              ce('div', { className: 'sim-btnrow' },
                ce('button', { type: 'button', className: 'btn btn-primary',
                  onClick: function () { setHoldChoice('hold'); finishCalc('hold'); } },
                  'Hold the dose and clarify with the prescriber'),
                ce('button', { type: 'button', className: 'btn btn-outline',
                  style: { borderColor: 'var(--red)', color: 'var(--red-fg)' },
                  onClick: function () {
                    setHoldChoice('give');
                    props.onDone({ correct: true, isSafe: false, heldAndClarified: false, gaveUnsafe: true, calcId: str(calc.id) });
                  } },
                  'Give the dose as ordered')))
          : ce('div', { className: 'sim-btnrow' },
              ce('button', { type: 'button', className: 'btn btn-primary',
                onClick: function () { finishCalc('give'); } },
                (idx + 1 < calcs.length && !props.singleCalc) ? 'Next dose check' : 'Administer the medication'),
              ce('button', { type: 'button', className: 'sim-back', onClick: props.onCancel }, 'Cancel'))) : null);
  }

  /* ---------------------------------------------------------------------- *
   * 17. SimRunner - the live simulation
   * ---------------------------------------------------------------------- */
  function SimRunner(props) {
    var sc = obj(props.scenario);
    var mode = str(props.mode) || 'guided';
    var isGuided = mode === 'guided';
    var isExam = mode === 'exam';
    var showFeedback = isGuided;
    var scale = isExam ? EXAM_SCALE : TIME_SCALE;

    var timeline = useMemo(function () {
      var tl = arr(sc.vitalsTimeline);
      return tl.length ? tl : [{ atMin: 0, label: 'Baseline', loc: 'No documented vitals' }];
    }, [sc]);
    var durationSec = (parseNum(sc.durationMin) || 20) * 60;
    var actions = useMemo(function () { return buildActions(sc); }, [sc]);
    var guards = useMemo(function () { return buildGuards(sc); }, [sc]);
    var band = useMemo(function () { return ageBand(sc.patient); }, [sc]);
    var ivList = useMemo(function () { return arr(sc.interventions).slice().sort(byOrder); }, [sc]);

    var [simSec, setSimSec] = useState(0);
    var [running, setRunning] = useState(true);
    var [ended, setEnded] = useState(false);
    var [cursor, setCursor] = useState(1);
    var [appliedIdx, setAppliedIdx] = useState(0);
    var [harmHits, setHarmHits] = useState(0);
    var [log, setLog] = useState([]);
    var [doneMap, setDoneMap] = useState({});
    var [performed, setPerformed] = useState([]);
    var [errors, setErrors] = useState([]);
    var [unlocked, setUnlocked] = useState({});
    var [taught, setTaught] = useState(0);
    var [sbarDone, setSbarDone] = useState(false);
    var [exchanges, setExchanges] = useState([]);
    var [feedback, setFeedback] = useState(null);
    var [panel, setPanel] = useState('actions');
    var [chartTab, setChartTab] = useState('labs');
    var [pendingDose, setPendingDose] = useState(null);
    var [held, setHeld] = useState({});
    var [partial, setPartial] = useState({});
    var [hints, setHints] = useState(0);
    var [confirmQuit, setConfirmQuit] = useState(false);
    var [activePt, setActivePt] = useState('primary');
    var [deterioration, setDeterioration] = useState(null);

    var finishedRef = useRef(false);
    var fbTimer = useRef(null);

    /* -------- derived ------------------------------------------------- */
    var doneIvSet = useMemo(function () {
      var m = {};
      performed.forEach(function (p) { if (p.ivId) { m[p.ivId] = true; } });
      return m;
    }, [performed]);

    var baseVitals = useMemo(function () {
      return normVitals(timeline[Math.min(appliedIdx, timeline.length - 1)]);
    }, [timeline, appliedIdx]);

    var vitals = useMemo(function () {
      return harmHits ? degradeVitals(baseVitals, harmHits) : baseVitals;
    }, [baseVitals, harmHits]);

    var trend = useMemo(function () {
      var out = { sys: [], hr: [], rr: [], spo2: [], temp: [], pain: [] };
      for (var i = 0; i <= Math.min(appliedIdx, timeline.length - 1); i++) {
        var n = normVitals(timeline[i]);
        out.sys.push(n.sys); out.hr.push(n.hr); out.rr.push(n.rr);
        out.spo2.push(n.spo2); out.temp.push(n.temp); out.pain.push(n.pain);
      }
      if (harmHits) {
        out.sys.push(vitals.sys); out.hr.push(vitals.hr); out.rr.push(vitals.rr);
        out.spo2.push(vitals.spo2); out.temp.push(vitals.temp); out.pain.push(vitals.pain);
      }
      return out;
    }, [timeline, appliedIdx, harmHits, vitals]);

    var secondary = obj(sc.secondaryPatient);
    var hasSecondary = !!secondary.name;
    var secVitals = useMemo(function () {
      if (!hasSecondary) { return null; }
      var stl = arr(secondary.vitalsTimeline);
      if (!stl.length) { return null; }
      var pick = stl[0], simMin = simSec / 60;
      for (var i = 0; i < stl.length; i++) {
        if ((parseNum(stl[i].atMin) || 0) <= simMin) { pick = stl[i]; }
      }
      return normVitals(pick);
    }, [hasSecondary, secondary, Math.floor(simSec / 30)]);

    var nextGuard = useMemo(function () {
      if (cursor >= timeline.length) { return null; }
      var need = arr(guards[cursor]);
      var missing = need.filter(function (iv) { return !doneIvSet[str(iv.id)]; });
      return { need: need, missing: missing, entry: timeline[cursor] };
    }, [cursor, guards, doneIvSet, timeline]);

    /* -------- logging -------------------------------------------------- */
    var pushLog = useCallback(function (kind, text, detail) {
      setLog(function (prev) {
        return prev.concat([{ key: uid('l'), t: simSec, kind: kind, text: text, detail: detail || '' }]);
      });
    }, [simSec]);

    function flash(tone, title, body) {
      if (!showFeedback) { return; }
      setFeedback({ tone: tone, title: title, body: body, key: uid('f') });
      if (fbTimer.current) { window.clearTimeout(fbTimer.current); }
      fbTimer.current = window.setTimeout(function () { setFeedback(null); }, 9000);
    }

    /* -------- boot ------------------------------------------------------ */
    useEffect(function () {
      var v0 = normVitals(timeline[0]);
      var lines = [{ key: uid('l'), t: 0, kind: 'info',
        text: 'Shift start. ' + str(obj(sc.patient).name) + ' - ' + str(obj(sc.patient).diagnosis) + '.',
        detail: 'Mode: ' + mode + '. Simulated clock runs at ' + scale + 'x real time.' }];
      if (v0.note) {
        lines.push({ key: uid('l'), t: 0, kind: 'vital', text: 'Baseline vitals: ' + v0.bpText +
          ', HR ' + str(v0.hr) + ', RR ' + str(v0.rr) + ', SpO2 ' + str(v0.spo2), detail: v0.note });
      }
      var greet = arr(sc.dialogue).filter(function (d) { return lower(d.trigger) === 'greeting'; })[0];
      if (greet) {
        lines.push({ key: uid('l'), t: 0, kind: 'patient',
          text: str(greet.speaker || 'patient').toUpperCase() + ': "' + str(greet.line) + '"' });
        setExchanges([{ who: str(greet.speaker) || 'patient', text: str(greet.line) }]);
      }
      setLog(lines);
      return function () {
        if (fbTimer.current) { window.clearTimeout(fbTimer.current); }
        var voice = obj(MMx().voice);
        if (typeof voice.stopSpeaking === 'function') { try { voice.stopSpeaking(); } catch (e) {} }
        if (typeof voice.stopListening === 'function') { try { voice.stopListening(); } catch (e) {} }
      };
    }, []);

    /* -------- ticker ---------------------------------------------------- */
    useEffect(function () {
      if (!running || ended) { return; }
      var id = window.setInterval(function () {
        setSimSec(function (s) { return s + (TICK_MS / 1000) * scale; });
      }, TICK_MS);
      return function () { window.clearInterval(id); };
    }, [running, ended, scale]);

    /* -------- deterioration engine -------------------------------------- */
    useEffect(function () {
      if (ended) { return; }
      if (cursor >= timeline.length) { return; }
      var entry = timeline[cursor];
      var at = (parseNum(entry.atMin) || 0) * 60;
      if (simSec + 0.001 < at) { return; }

      var need = arr(guards[cursor]);
      var missing = need.filter(function (iv) { return !doneIvSet[str(iv.id)]; });

      if (need.length && missing.length === 0) {
        setHeld(function (h) { var n = {}; for (var k in h) { n[k] = h[k]; } n[cursor] = true; return n; });
        setHarmHits(function (x) { return Math.max(0, x - 1); });
        setDeterioration(null);
        pushLog('hold', 'Patient held stable - deterioration prevented.',
          'Your interventions worked. "' + str(entry.label) + '" did not happen. Keep going: the next window opens soon.');
        toast('Patient stabilising - good nursing', 'success');
      } else {
        if (need.length && missing.length < need.length) {
          setPartial(function (h) { var n = {}; for (var k in h) { n[k] = h[k]; } n[cursor] = true; return n; });
        }
        setAppliedIdx(cursor);
        var nv = normVitals(entry);
        pushLog('vital', 'VITALS CHANGE - ' + (str(entry.label) || 'Deterioration') + ': ' +
          nv.bpText + ', HR ' + str(nv.hr) + ', RR ' + str(nv.rr) + ', SpO2 ' + str(nv.spo2) +
          ', ' + str(nv.loc), nv.note);
        if (arr(entry.flags).length) {
          pushLog('alert', 'Alert: ' + arr(entry.flags).join(', ').replace(/-/g, ' '),
            (showFeedback && missing.length)
              ? 'Still not done: ' + missing.map(function (m) { return str(m.action); }).join('; ')
              : '');
        }
        /* an auto-dismissing toast in a column below the fold is the wrong
           carrier for the central clinical event: this stays until acted on */
        var summary = nv.bpText + ', HR ' + str(nv.hr) + ', RR ' + str(nv.rr) +
          ', SpO2 ' + str(nv.spo2) + ', ' + str(nv.loc);
        setDeterioration({
          key: uid('a'),
          label: str(entry.label) || 'Deterioration',
          summary: summary,
          missing: (showFeedback && missing.length)
            ? missing.slice(0, 3).map(function (m) { return str(m.action); })
            : []
        });
        announce('Patient is deteriorating. ' + summary, true);
      }
      setCursor(cursor + 1);
    }, [simSec, cursor, ended]);

    /* -------- time limit ------------------------------------------------ */
    useEffect(function () {
      if (ended || simSec < durationSec) { return; }
      endSim('time');
    }, [simSec, ended]);

    /* -------- scoring / exit -------------------------------------------- */
    function buildPerf() {
      var assessIvTotal = ivList.filter(function (i) { return lower(i.category) === 'assessment'; }).length;
      var commIvTotal = ivList.filter(function (i) {
        var c = lower(i.category); return c === 'communication' || c === 'escalation';
      }).length;
      var supporting = ivList.filter(function (i) { return !i.critical; });
      var chartCount = 0;
      ['labs', 'diagnostics', 'orders', 'history'].forEach(function (k) { if (unlocked[k]) { chartCount++; } });
      var assessDone = performed.filter(function (p) { return p.group === 'assess'; }).length;
      var commDone = performed.filter(function (p) { return p.group === 'comm'; }).length;
      return {
        performedIvIds: performed.map(function (p) { return p.ivId; }).filter(has),
        ivOrderSeq: performed.filter(function (p) { return typeof p.order === 'number' && isFinite(p.order); })
          .map(function (p) { return p.order; }),
        errors: errors,
        stagesTotal: Math.max(0, timeline.length - 1),
        stagesHeld: Object.keys(held).length,
        stagesPartial: Object.keys(partial).length,
        assessDone: assessDone, assessTotal: assessIvTotal, chartViewed: chartCount,
        sbarDone: sbarDone, commDone: commDone, commTotal: commIvTotal,
        eduDone: taught, eduTotal: arr(sc.patientEducation).length,
        supportingDone: supporting.filter(function (i) { return doneIvSet[str(i.id)]; }).length,
        supportingTotal: supporting.length,
        hintsUsed: hints
      };
    }

    function endSim(reason) {
      if (finishedRef.current) { return; }
      finishedRef.current = true;
      setEnded(true);
      setRunning(false);
      var perf = buildPerf();
      var result = scorePerformance(sc, perf, mode);
      var logLines = log.concat([{ t: simSec, kind: 'info', text: 'Simulation ended (' + reason + ')' }])
        .map(function (l) { return fmtClock(l.t) + ' [' + l.kind + '] ' + l.text; });
      var rec = saveResult(sc, result, simSec, mode);
      if (typeof props.onFinish !== 'function') { return; }
      props.onFinish({
        scenario: sc, mode: mode, result: result, perf: perf, record: rec,
        log: log, logLines: logLines, timeSec: simSec, performed: performed,
        exchanges: exchanges, held: held, reason: reason
      });
    }

    /* -------- action resolution ------------------------------------------ */
    function markDone(a, verdict) {
      setDoneMap(function (m) {
        var n = {}; for (var k in m) { if (Object.prototype.hasOwnProperty.call(m, k)) { n[k] = m[k]; } }
        n[a.id] = verdict; return n;
      });
    }

    function spendTime(a) {
      if (!running || ended) { return; }
      var cost = parseNum(a && a.cost);
      setSimSec(function (s) { return s + (cost === null ? COST_DEFAULT : cost); });
    }

    function expectedNext() {
      for (var i = 0; i < ivList.length; i++) {
        if (!doneIvSet[str(ivList[i].id)]) { return ivList[i]; }
      }
      return null;
    }

    function recordPerformed(a, verdict) {
      setPerformed(function (prev) {
        return prev.concat([{
          actionId: a.id, ivId: str(a.ivId), order: (typeof a.order === 'number' ? a.order : null),
          label: a.label, atSec: simSec, verdict: verdict, group: a.group, critical: !!a.critical
        }]);
      });
    }

    function resolveAction(a, note) {
      /* harmful ------------------------------------------------------- */
      if (a.kind === 'harm') {
        markDone(a, 'bad');
        setErrors(function (e) { return e.concat([{ text: str(a.harm), atSec: simSec }]); });
        setHarmHits(function (x) { return x + 1; });
        pushLog(showFeedback ? 'bad' : 'action',
          (showFeedback ? 'HARM: ' : '') + a.label,
          showFeedback ? 'This is a documented critical error for this patient. The patient has visibly worsened.' : '');
        flash('bad', 'Critical error', 'You just did something documented as harmful for this patient: "' +
          str(a.harm) + '". Watch the monitor - the patient has deteriorated. Scoring penalty applied.');
        if (!showFeedback) { toast('Action recorded', 'info'); }
        spendTime(a);
        return;
      }

      /* neutral distractor --------------------------------------------- */
      if (a.kind === 'distractor') {
        markDone(a, 'mid');
        pushLog(showFeedback ? 'warn' : 'action', a.label,
          showFeedback ? 'No clinical benefit for this patient right now - and it cost you time.' : '');
        flash('mid', 'Not a priority', str(a.rationale) +
          ' You lost ' + Math.round(a.cost) + ' seconds of simulated time.');
        spendTime(a);
        return;
      }

      /* graded intervention -------------------------------------------- */
      if (a.ivId) {
        var expect = expectedNext();
        var inOrder = !expect || !a.order || a.order <= (parseNum(expect.order) || 99);
        var verdict = inOrder ? 'good' : 'mid';
        markDone(a, verdict === 'good' ? 'good' : 'mid');
        recordPerformed(a, verdict);
        if (verdict === 'good') {
          pushLog(showFeedback ? 'good' : 'action', a.label,
            showFeedback ? str(a.rationale) : '');
          flash('good', 'Correct - and in the right order', str(a.rationale) +
            (a.pearl ? ' ATI pearl: ' + str(a.pearl) : ''));
        } else {
          pushLog(showFeedback ? 'warn' : 'action', a.label,
            showFeedback ? 'Right action, wrong priority.' : '');
          flash('mid', 'Right action, wrong priority',
            '"' + str(expect.action) + '" should come first. ' + str(expect.rationale));
        }
        if (note) { pushLog('info', note); }
        spendTime(a);
        return;
      }

      /* ungraded but legitimate ---------------------------------------- */
      markDone(a, 'good');
      recordPerformed(a, 'neutral');
      if (a.group === 'educate') { setTaught(function (t) { return t + 1; }); }
      pushLog('action', a.label, showFeedback ? str(a.rationale) : '');
      if (a.group === 'assess') {
        flash('good', 'Assessment done', str(a.rationale) || 'Data gathered. Now act on it.');
      } else {
        flash('good', 'Done', str(a.rationale) || 'Logged.');
      }
      if (note) { pushLog('info', note); }
      spendTime(a);
    }

    function act(a) {
      if (ended) { return; }
      /* the deterioration banner stays up until the student does something */
      setDeterioration(null);
      if (a.kind === 'chart') {
        setUnlocked(function (u) {
          var n = {}; for (var k in u) { if (Object.prototype.hasOwnProperty.call(u, k)) { n[k] = u[k]; } }
          n[a.tab] = true; return n;
        });
        markDone(a, 'good');
        recordPerformed(a, 'neutral');
        setChartTab(a.tab);
        setPanel('chart');
        pushLog('action', a.label, showFeedback ? str(a.rationale) : '');
        spendTime(a);
        return;
      }
      if (a.tool === 'sbar' || a.kind === 'sbar') {
        setPanel('sbar');
        if (a.ivId) { resolveAction(a); } else { markDone(a, 'good'); recordPerformed(a, 'neutral'); spendTime(a); }
        return;
      }
      if ((a.kind === 'med' || a.kind === 'order-med') && arr(a.calcs).length) {
        setPendingDose(a);
        setPanel('dose');
        return;
      }
      resolveAction(a);
    }

    function onDoseDone(res) {
      var a = pendingDose;
      setPendingDose(null);
      setPanel('actions');
      if (!a) { return; }
      if (res.gaveUnsafe) {
        markDone(a, 'bad');
        setErrors(function (e) {
          return e.concat([{ text: 'Administered a dose outside the safe range without clarifying: ' + str(a.label), atSec: simSec }]);
        });
        setHarmHits(function (x) { return x + 1; });
        pushLog(showFeedback ? 'bad' : 'action',
          (showFeedback ? 'HARM: gave an unsafe dose of ' : 'Administered ') + str(obj(a.med).name),
          showFeedback ? 'The calculated safe dose did not match the order. The correct action was to hold and clarify.' : '');
        flash('bad', 'Unsafe dose given',
          'You calculated correctly and then gave it anyway. When the order exceeds the safe range you HOLD and clarify with the prescriber.');
        return;
      }
      if (res.heldAndClarified) {
        markDone(a, 'good');
        recordPerformed(a, 'good');
        pushLog(showFeedback ? 'good' : 'action',
          'Held ' + str(obj(a.med).name) + ' and clarified the order with the prescriber.',
          showFeedback ? 'Correct. The ordered dose was outside the safe range for this patient.' : '');
        flash('good', 'Correct - you held the dose',
          'Calculating and then refusing to give an unsafe dose is exactly right. Independent double-check saved this patient.');
        spendTime(a);
        return;
      }
      pushLog('good', 'Dose calculated and verified before administration.');
      resolveAction(a, 'Dose independently calculated before administration.');
    }

    function requestChart(tab) {
      var a = null;
      actions.forEach(function (x) { if (x.kind === 'chart' && x.tab === tab) { a = x; } });
      if (a) { act(a); }
    }

    function giveHint() {
      if (isExam) { return; }
      setHints(function (h) { return h + 1; });
      var expect = expectedNext();
      if (!expect) {
        pushLog('info', 'Hint: every documented intervention is done. Reassess and prepare your handoff.');
        flash('mid', 'Hint', 'Every documented intervention is complete. Reassess, teach, and hand off.');
        return;
      }
      var cat = lower(expect.category) || 'intervention';
      var body = 'Your next priority is a ' + cat + ' action.' +
        (expect.atiPearl ? ' Pearl: ' + str(expect.atiPearl) : '') +
        (isGuided ? ' (' + str(expect.action) + ')' : '');
      pushLog('info', 'Hint used: next priority is a ' + cat + ' action.');
      setFeedback({ tone: 'mid', title: 'Hint', body: body, key: uid('f') });
    }

    /* -------- stabiliser widget ------------------------------------------ */
    function stabilizer() {
      if (!nextGuard || !arr(nextGuard.need).length) { return null; }
      var total = nextGuard.need.length;
      var doneN = total - nextGuard.missing.length;
      var ready = nextGuard.missing.length === 0;
      var whenMin = parseNum(obj(nextGuard.entry).atMin) || 0;
      var secsLeft = Math.max(0, whenMin * 60 - simSec);
      return ce('div', { className: 'sim-stab' + (ready ? ' ready' : '') },
        ce('h5', null, ready ? '✓ Patient holding' : '! Next change in ' + fmtClock(secsLeft)),
        ce('div', { style: { fontSize: '12.5px', marginBottom: ready ? 0 : '6px' } },
          ready
            ? 'Key actions complete - the next deterioration will be prevented.'
            : doneN + ' of ' + total + ' key actions complete. Finish them before the clock reaches ' +
              whenMin + ' min to hold this patient.'),
        (!ready && isGuided) ? ce('ul', null, nextGuard.missing.slice(0, 3).map(function (m, i) {
          return ce('li', { key: i }, str(m.action));
        })) : null);
    }

    /* -------- render helpers --------------------------------------------- */
    var remaining = Math.max(0, durationSec - simSec);
    var lowTime = remaining <= 180;
    var clockNode = ce('div', { style: { textAlign: 'right' } },
      ce('div', { className: 'sim-clock' + (lowTime ? ' low' : ''),
        role: 'timer', 'aria-live': 'off' }, fmtClock(remaining)),
      ce('div', { style: { fontSize: '10px', color: 'var(--text3)', letterSpacing: '.5px', fontWeight: 700 } },
        'SIM TIME LEFT'));

    var switcherNode = hasSecondary ? ce('div', { className: 'sim-filters', style: { margin: 0 } },
      ce('button', { type: 'button', className: 'sim-chip', 'aria-pressed': activePt === 'primary' ? 'true' : 'false',
        onClick: function () { setActivePt('primary'); } }, str(obj(sc.patient).name) || 'Patient'),
      ce('button', { type: 'button', className: 'sim-chip', 'aria-pressed': activePt === 'secondary' ? 'true' : 'false',
        onClick: function () { setActivePt('secondary'); } }, str(secondary.name) || 'Second patient')) : null;

    var showSecondary = hasSecondary && activePt === 'secondary';
    var monVitals = showSecondary && secVitals ? secVitals : vitals;
    var monPatient = showSecondary ? secondary : obj(sc.patient);
    var monBand = showSecondary ? ageBand(secondary) : band;
    var monTrend = showSecondary ? {} : trend;

    var worst = ['crit', 'warn'].filter(function (lvl) {
      var keys = [['sys', vitals.sys], ['hr', vitals.hr], ['rr', vitals.rr], ['spo2', vitals.spo2]];
      return keys.some(function (k) { return classify(k[0], k[1], band) === lvl; });
    })[0] || 'ok';

    var panelTabs = [
      { id: 'actions', label: 'Actions' },
      { id: 'chart', label: 'Chart' },
      { id: 'talk', label: 'Talk to patient' },
      { id: 'sbar', label: 'SBAR' }
    ];

    var body;
    if (panel === 'dose' && pendingDose) {
      body = ce(SimDoseGate, {
        calcs: arr(pendingDose.calcs),
        onDone: onDoseDone,
        onCancel: function () { setPendingDose(null); setPanel('actions'); }
      });
    } else if (panel === 'chart') {
      body = ce(SimChartViewer, { scenario: sc, patient: monPatient, unlocked: unlocked,
        tab: chartTab, onRequest: requestChart });
    } else if (panel === 'talk') {
      body = ce(PatientTalkPanel, {
        scenario: sc, exchanges: exchanges,
        onExchange: function (m) {
          setExchanges(function (p) { return p.concat([m]); });
          if (m.who === 'you') {
            pushLog('action', 'Asked the patient: "' + str(m.text) + '"');
            if (running && !ended) { setSimSec(function (s) { return s + 10; }); }
          } else {
            pushLog('patient', str(m.who).toUpperCase() + ': "' + str(m.text) + '"');
          }
        }
      });
    } else if (panel === 'sbar') {
      body = ce(SimSBARPanel, {
        scenario: sc, patient: obj(sc.patient),
        onComplete: function (payload) {
          setSbarDone(true);
          pushLog('good', 'SBAR report given to the provider.',
            payload && payload.filled ? payload.filled + ' of ' + payload.total + ' SBAR elements documented.' : '');
          flash('good', 'Report given', 'Structured communication is graded. Your report is in the log.');
          if (running && !ended) { setSimSec(function (s) { return s + 45; }); }
        },
        onCancel: function () { setPanel('actions'); }
      });
    } else {
      body = ce(SimActionPanel, { actions: actions, doneMap: doneMap, locked: ended, onAct: act });
    }

    return ce('div', { className: 'sim-root sim-live' },
      confirmQuit ? ce(ConfirmDialog, {
        title: 'Leave this simulation?',
        body: 'Your patient is mid-scenario. If you quit now nothing is scored and this attempt is discarded.',
        confirmText: 'Quit without scoring',
        cancelText: 'Stay with my patient',
        onCancel: function () { setConfirmQuit(false); setRunning(!ended); },
        onConfirm: function () {
          finishedRef.current = true;
          setEnded(true);
          if (typeof props.onQuit === 'function') { props.onQuit(); }
        }
      }) : null,

      /* sticky status strip */
      ce('div', { className: 'sim-topbar' },
        ce('div', { className: 'sim-head', style: { marginBottom: '6px' } },
          ce('button', { type: 'button', className: 'sim-back',
            onClick: function () { setRunning(false); setConfirmQuit(true); } }, '‹ Quit sim'),
          ce('div', null,
            ce('h2', null, str(sc.title)),
            ce('div', { className: 'sim-sub' }, str(obj(sc.patient).name) + ' · ' + str(obj(sc.patient).age))),
          ce('div', { className: 'sim-spacer' }),
          ce(Badge, { tone: 'acc' }, mode),
          worst === 'crit' ? ce(Badge, { tone: 'bad' }, '✖ Critical') :
            worst === 'warn' ? ce(Badge, { tone: 'warn' }, '! Unstable') :
            ce(Badge, { tone: 'ok' }, '✓ Stable'),
          isGuided ? ce('button', { type: 'button', className: 'btn btn-outline btn-sm',
            'aria-pressed': running ? 'false' : 'true',
            onClick: function () { setRunning(!running); } }, running ? '❚❚ Pause' : '▶ Resume') : null,
          !isExam ? ce('button', { type: 'button', className: 'btn btn-outline btn-sm', onClick: giveHint }, 'Hint') : null,
          ce('button', { type: 'button', className: 'btn btn-primary btn-sm',
            onClick: function () { endSim('ended-early'); } }, 'End & debrief'),
          clockNode)),

      deterioration ? ce('div', { className: 'sim-alert', role: 'alert', key: deterioration.key },
        ce('span', { className: 'mark', 'aria-hidden': 'true' }, '✖'),
        ce('div', null,
          ce('b', null, 'The patient is deteriorating - ' + deterioration.label),
          ce('div', { style: { marginTop: '3px' } }, deterioration.summary),
          arr(deterioration.missing).length
            ? ce('div', { style: { marginTop: '6px', color: 'var(--text2)' } },
                'Still not done: ' + deterioration.missing.join('; '))
            : null),
        ce('button', { type: 'button', className: 'sim-back', style: { marginLeft: 'auto' },
          'aria-label': 'Acknowledge deterioration alert',
          onClick: function () { setDeterioration(null); } }, 'Acknowledge')) : null,

      feedback ? ce('div', { className: 'sim-fb ' + (feedback.tone === 'good' ? 'good' : feedback.tone === 'bad' ? 'bad' : 'mid'),
        role: 'status', key: feedback.key },
        ce('span', { className: 'mark' }, feedback.tone === 'good' ? '✓' : feedback.tone === 'bad' ? '✕' : '!'),
        ce('span', null, ce('b', null, feedback.title + ' - '), feedback.body),
        ce('button', { type: 'button', className: 'sim-back', style: { marginLeft: 'auto' },
          'aria-label': 'Dismiss feedback', onClick: function () { setFeedback(null); } }, '✕')) : null,

      !showFeedback ? ce('div', { style: { fontSize: '12px', color: 'var(--text3)' } },
        'Feedback is withheld until the debrief in ' + mode + ' mode. Everything you do is being recorded.') : null,

      ce('div', { className: 'sim-stage' },
        ce('div', { style: { display: 'grid', gap: '12px' } },
          /* Docked: the patient's numbers are the thing you reason FROM, so
             they must never scroll away behind a long action list. */
          ce('div', { className: 'sim-vitalsdock' },
            ce(VitalsMonitor, {
              vitals: monVitals, band: monBand, trend: monTrend,
              name: str(monPatient.name), age: str(monPatient.age), dx: str(monPatient.diagnosis),
              switcher: switcherNode, clock: null,
              stabilizer: showSecondary ? null : (isExam ? null : stabilizer())
            })),
          ce('div', { className: 'sim-panel' },
            ce('div', { className: 'sim-tabs', role: 'tablist', 'aria-label': 'Simulation panels' },
              panelTabs.map(function (t) {
                return ce('button', { key: t.id, type: 'button', className: 'sim-tab', role: 'tab',
                  'aria-selected': panel === t.id ? 'true' : 'false',
                  onClick: function () { setPanel(t.id); } }, t.label);
              })),
            body)),
        ce(SimEventLog, { entries: log })));
  }

  /* ---------------------------------------------------------------------- *
   * 18. Score ring
   * ---------------------------------------------------------------------- */
  function ScoreRing(props) {
    var pct = clamp(parseNum(props.pct) || 0, 0, 100);
    var shown = useTween(pct, 900);
    var r = 44, c = 2 * Math.PI * r;
    var color = pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--orange)' : 'var(--red)';
    return ce('div', { className: 'sim-ring' },
      ce('svg', { viewBox: '0 0 104 104', width: '104', height: '104', 'aria-hidden': 'true' },
        ce('circle', { cx: 52, cy: 52, r: r, fill: 'none', stroke: 'var(--surface3)', strokeWidth: 9 }),
        ce('circle', {
          cx: 52, cy: 52, r: r, fill: 'none', stroke: color, strokeWidth: 9, strokeLinecap: 'round',
          strokeDasharray: c, strokeDashoffset: c * (1 - (shown || 0) / 100),
          transform: 'rotate(-90 52 52)'
        })),
      ce('div', { className: 'n' }, Math.round(shown || 0),
        ce('small', null, 'OUT OF 100')));
  }

  /* ---------------------------------------------------------------------- *
   * 19. Debrief
   * ---------------------------------------------------------------------- */
  function buildReplay(scenario, session) {
    var sc = obj(scenario);
    var tl = arr(sc.vitalsTimeline);
    var ivs = arr(sc.interventions).slice().sort(byOrder);
    var performed = arr(session.performed);
    var stages = [];
    var bounds = tl.length ? tl.map(function (e) { return (parseNum(e.atMin) || 0) * 60; }) : [0];
    var endSec = Math.max(session.timeSec || 0, (parseNum(sc.durationMin) || 20) * 60);
    for (var i = 0; i < Math.max(1, bounds.length); i++) {
      var from = bounds[i] === undefined ? 0 : bounds[i];
      var to = bounds[i + 1] === undefined ? endSec : bounds[i + 1];
      var mine = performed.filter(function (p) { return p.atSec >= from && p.atSec < to; });
      var slice = Math.ceil(ivs.length / Math.max(1, bounds.length));
      var ideal = ivs.slice(i * slice, (i + 1) * slice);
      stages.push({
        idx: i,
        label: str(obj(tl[i]).label) || ('Minute ' + Math.round(from / 60)),
        from: from, to: to,
        note: str(obj(tl[i]).note),
        held: !!obj(session.held)[i],
        mine: mine, ideal: ideal
      });
    }
    return stages;
  }

  function SimDebrief(props) {
    var session = obj(props.session);
    var sc = obj(session.scenario);
    var result = obj(session.result);
    var [aiText, setAiText] = useState('');
    var [aiState, setAiState] = useState('idle');
    var [aiErr, setAiErr] = useState(null);
    var aiResolvingNow = useAiResolving();
    var waiter = useAiWait();
    var mounted = useRef(true);
    /* Ref twin of aiState: state is not synchronous, so two taps in the same
       tick used to be able to fire two debriefs and spend two messages.
       runRef also orphans an abandoned call so a late answer cannot land. */
    var busyRef = useRef(false);
    var runRef = useRef(0);

    useEffect(function () { return function () { mounted.current = false; }; }, []);

    function askAi() {
      if (busyRef.current) { return; }
      busyRef.current = true;
      var runId = ++runRef.current;
      setAiState('loading'); setAiText(''); setAiErr(null);
      // Acknowledgment first, network second - committed in the same render.
      waiter.begin();

      function settle() {
        if (runId !== runRef.current) { return false; }
        busyRef.current = false;
        if (!mounted.current) { return false; }
        waiter.end();
        return true;
      }

      runAiDebrief(sc, result, arr(session.logLines), function (chunk) {
        if (!mounted.current || runId !== runRef.current) { return; }
        setAiText(function (t) { return t + str(chunk); });
      }).then(function (full) {
        if (!settle()) { return; }
        setAiText(function (t) { return (str(full).length > t.length) ? str(full) : t; });
        setAiState('done');
      }, function (err) {
        if (!settle()) { return; }
        setAiErr(aiDebriefError(err));
        setAiState('error');
      });
    }

    /* Give up on a debrief that is not arriving. The scored debrief underneath
       is already complete, so there is always something to go back to. */
    function cancelAi() {
      if (!busyRef.current) { return; }
      runRef.current++;
      busyRef.current = false;
      waiter.end();
      setAiErr({ code: 'cancelled', retry: true,
                 text: 'Stopped waiting for the AI coach. Everything below is your full scored debrief.' });
      setAiState('error');
    }

    /* "Try again" while it is still notionally running: orphan it first, then
       re-run. busyRef is set again synchronously inside askAi, so however fast
       this is tapped it cannot start two calls. */
    function retryAi() {
      runRef.current++;
      busyRef.current = false;
      waiter.end();
      askAi();
    }

    /* The AI debrief is opt-in and its cost is disclosed, exactly as the live
       AI module does it. Auto-firing on mount spent the student's daily quota
       without asking. */
    var replay = useMemo(function () { return buildReplay(sc, session); }, [sc, session]);
    var outcome = useMemo(function () { return patientOutcome(sc, session, result); }, [sc, session, result]);
    var grave = outcome.kind === 'grave';
    var leadWithTeaching = grave || outcome.kind === 'bad';
    var teaching = useMemo(function () { return simTurningPoints(sc, session, result); }, [sc, session, result]);

    var header = ce('div', { className: 'sim-head', key: 'head' },
      ce('button', { type: 'button', className: 'sim-back', onClick: props.onBrowse }, '‹ All simulations'),
      ce('div', null,
        ce('h2', null, 'Debrief - ' + str(sc.title)),
        ce('div', { className: 'sim-sub' },
          str(session.mode) + ' mode · ' + fmtClock(session.timeSec) + ' of simulated time · ' +
          str(obj(sc.patient).name))),
      ce('div', { className: 'sim-spacer' }),
      /* no pass/grade badging above the fold when the patient was harmed */
      grave ? null : (result.passed ? ce(Badge, { tone: 'ok' }, '✓ Pass') : ce(Badge, { tone: 'bad' }, '✕ Not yet')),
      grave ? null : ce(Badge, { tone: 'acc' }, 'Grade ' + str(result.letter)));

    var outcomeCard = ce('div', { className: 'sim-outcome ' + outcome.kind, key: 'outcome' },
      ce('div', { className: 'lab' }, 'Outcome'),
      ce('h2', null, outcome.title),
      ce('p', null, outcome.lede));

    var teachingCard = ce('div', { className: 'sim-panel', key: 'teach', style: { marginBottom: '12px' } },
      ce('h3', null, 'What would have changed this outcome'),
      grave ? ce('p', { style: { margin: '0 0 10px', fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 } },
        'This is a simulation, and it is built so this can happen safely here instead of on a real unit. ' +
        'Run it again - the priorities will not have moved.') : null,
      ce('ul', { className: 'sim-teach' }, teaching.map(function (t, i) {
        return ce('li', { key: i }, ce('b', null, str(t.head)),
          t.body ? ce('div', null, str(t.body)) : null);
      })));

    var scorePanel = ce('div', { className: 'sim-panel', key: 'score', style: { marginBottom: '12px' } },
        ce('div', { className: 'sim-score-hero' },
          /* no animated ring on a run where the patient was harmed */
          grave
            ? ce('div', { style: { flex: '0 0 auto', minWidth: '104px' } },
                ce('div', { style: { fontSize: '28px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' } },
                  str(result.total) + ' / 100'),
                ce('div', { style: { fontSize: '11px', color: 'var(--text3)', fontWeight: 700, letterSpacing: '.5px' } },
                  'RECORDED FOR THIS ATTEMPT'))
            : ce(ScoreRing, { pct: result.total }),
          ce('div', { style: { flex: '1 1 240px', minWidth: '220px' } },
            ce('div', { className: 'sim-catrow' },
              arr(result.categories).map(function (c) {
                var pct = c.weight ? (c.earned / c.weight) * 100 : 0;
                return ce('div', { className: 'sim-cat', key: c.key },
                  ce('span', null, c.label,
                    ce('span', { style: { color: 'var(--text3)', fontSize: '11px' } }, ' · ' + c.detail)),
                  ce('b', { style: { fontVariantNumeric: 'tabular-nums' } }, c.earned + '/' + c.weight),
                  ce('span', { className: 'bar' },
                    ce(Bar, { pct: pct, label: c.label,
                      color: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--red)' })));
              })),
            result.penalty ? ce('div', { className: 'sim-fb bad', style: { marginTop: '10px' } },
              ce('span', { className: 'mark' }, '✕'),
              ce('span', null, 'Critical error penalty: -' + result.penalty + ' points (' +
                arr(result.errors).length + ' error' + (arr(result.errors).length === 1 ? '' : 's') + ').')) : null,
            ce('div', { style: { fontSize: '12px', color: 'var(--text3)', marginTop: '8px' } },
              'Pass mark is ' + result.passMark + ' with zero critical errors. Earned before penalties: ' +
              result.earnedRaw + '.'))),
        ce('div', { className: 'sim-btnrow' },
          ce('button', { type: 'button', className: 'btn btn-primary', onClick: props.onRetry }, 'Retry this simulation'),
          arr(sc.questions).length ? ce('button', { type: 'button', className: 'btn btn-outline',
            onClick: props.onQuestions }, 'Review the questions (' + arr(sc.questions).length + ')') : null,
          props.hasNext ? ce('button', { type: 'button', className: 'btn btn-outline',
            onClick: props.onNext }, 'Next scenario ›') : null));

    /* ---- AI coach: opt-in, cost disclosed ---- */
    var aiPanel = ce('div', { className: 'sim-panel', key: 'ai', style: { marginBottom: '12px' } },
        ce('h3', null, 'AI instructor debrief'),
        /* The wait, not a frozen sentence. The counter runs off wall time, so
           it advances through a whole generation in which the buffered proxy
           delivers no tokens at all. */
        aiState === 'loading'
          ? ce(WaitNote, {
              wait: waiter.wait, texts: WAIT_TEXT_DEBRIEF,
              onRetry: retryAi, onCancel: cancelAi
            })
          : null,
        aiText ? ce('div', { style: { fontSize: '13.5px', lineHeight: 1.65, whiteSpace: 'pre-wrap' } }, aiText) : null,
        (aiState === 'error' && aiErr) ? ce('div', {
          className: 'sim-fb mid', role: 'alert', 'data-code': aiErr.code
        },
          ce('span', { className: 'mark' }, '!'), ce('span', null, aiErr.text)) : null,
        /* Still checking: say nothing about their plan, and hold the same
           two-line footprint the real copy will take so the panel does not
           jump when it lands. No lock, no error tone, no spinner left over. */
        (aiState === 'idle' && aiResolvingNow && !aiAvailable())
          ? ce('div', { style: { fontSize: '13px', color: 'var(--text3)' }, 'aria-live': 'polite' },
              'Checking your plan...')
          : null,
        (aiState === 'idle' && !aiResolvingNow && !aiAvailable())
          ? ce('div', { style: { fontSize: '13px', color: 'var(--text2)' } },
              'AI coaching is not available on this device. Everything below is generated locally and is complete on its own.')
          : null,
        (aiState === 'idle' && aiAvailable())
          ? ce('div', { style: { fontSize: '13px', color: 'var(--text2)' } },
              'Want this walked through the way your clinical instructor would? It uses one AI message.')
          : null,
        (aiState === 'idle' && aiAvailable())
          ? ce('div', { className: 'sim-btnrow' },
              ce('button', { type: 'button', className: 'btn btn-outline btn-sm', onClick: askAi },
                'Get the full instructor debrief'))
          : null,
        /* Retry only where retrying is the right move: a plan that does not
           include this, or a spent daily allowance, will not answer differently
           in ten seconds, and a button that says otherwise is a lie. */
        (aiState === 'done' || (aiState === 'error' && aiErr && aiErr.retry))
          ? ce('div', { className: 'sim-btnrow' },
              ce('button', { type: 'button', className: 'btn btn-outline btn-sm', onClick: askAi },
                aiState === 'error' ? 'Try again' : 'Regenerate'))
          : null);

    var tail = [
      /* ---- replay ---- */
      ce('div', { className: 'sim-panel', key: 'replay', style: { marginBottom: '12px' } },
        ce('h3', null, 'Minute-by-minute replay'),
        ce('div', { className: 'sim-replay' },
          ce('div', { className: 'hd' }, 'Time'),
          ce('div', { className: 'hd' }, 'What you did'),
          ce('div', { className: 'hd' }, 'What the ideal nurse does'),
          replay.map(function (s) {
            return [
              ce('div', { className: 'cell', key: 't' + s.idx },
                ce('b', null, Math.round(s.from / 60) + '-' + Math.round(s.to / 60) + ' min'),
                ce('div', { style: { fontSize: '11px', color: 'var(--text3)', marginTop: '3px' } }, s.label),
                s.held ? ce('div', { style: { marginTop: '4px' } }, ce(Badge, { tone: 'ok' }, '✓ held')) : null),
              ce('div', { className: 'cell', key: 'm' + s.idx },
                s.mine.length
                  ? ce('ul', null, s.mine.map(function (m, i) {
                      return ce('li', { key: i, style: { color: m.verdict === 'mid' ? 'var(--orange)' : 'var(--text)' } },
                        str(m.label) + (m.verdict === 'mid' ? ' (out of order)' : ''));
                    }))
                  : ce('span', { style: { color: 'var(--text3)' } }, 'Nothing recorded in this window.')),
              ce('div', { className: 'cell', key: 'i' + s.idx },
                s.ideal.length
                  ? ce('ul', null, s.ideal.map(function (iv, i) {
                      return ce('li', { key: i }, str(iv.order) + '. ' + str(iv.action));
                    }))
                  : ce('span', { style: { color: 'var(--text3)' } }, 'Reassess and document.'),
                s.note ? ce('div', { style: { marginTop: '6px', color: 'var(--text2)', fontSize: '11.5px' } }, s.note) : null)
            ];
          }))),

      /* ---- misses + errors ---- */
      ce('div', { className: 'sim-two', key: 'misses', style: { marginBottom: '12px' } },
        ce('div', { className: 'sim-panel' },
          ce('h3', null, 'What you missed'),
          arr(result.missedCritical).length
            ? ce('div', { style: { display: 'grid', gap: '8px', marginBottom: '10px' } },
                arr(result.missedCritical).map(function (iv, i) {
                  return ce('div', { key: i, className: 'sim-fb bad' },
                    ce('span', { className: 'mark' }, '✕'),
                    ce('span', null, ce('b', null, 'CRITICAL: ' + str(iv.action)), ce('br'),
                      str(iv.rationale),
                      iv.atiPearl ? ce('div', { style: { marginTop: '4px', color: 'var(--text2)' } }, 'Pearl: ' + str(iv.atiPearl)) : null));
                }))
            : ce('div', { className: 'sim-fb good' }, ce('span', { className: 'mark' }, '✓'),
                ce('span', null, 'You performed every critical intervention. That is the standard.')),
          arr(result.missedOther).length
            ? ce('div', { style: { display: 'grid', gap: '6px' } },
                arr(result.missedOther).map(function (iv, i) {
                  return ce('div', { key: i, style: { fontSize: '12.5px', lineHeight: 1.5 } },
                    ce('b', null, '· ' + str(iv.action) + ' - '), str(iv.rationale));
                }))
            : null),
        ce('div', { className: 'sim-panel' },
          ce('h3', null, 'Critical errors'),
          arr(result.errors).length
            ? arr(result.errors).map(function (e, i) {
                return ce('div', { key: i, className: 'sim-fb bad', style: { marginBottom: '8px' } },
                  ce('span', { className: 'mark' }, '✕'),
                  ce('span', null, ce('b', null, str(e.text)), ce('br'),
                    'Committed at ' + fmtClock(e.atSec) + '. This is documented as harmful for this patient and worsened the vitals you saw on the monitor.'));
              })
            : ce('div', { className: 'sim-fb good' }, ce('span', { className: 'mark' }, '✓'),
                ce('span', null, 'No critical errors. You did nothing that harmed this patient.')))),

      /* ---- pearls ---- */
      (arr(sc.pearls).length || arr(sc.keyPoints).length)
        ? ce('div', { className: 'sim-panel', key: 'pearls', style: { marginBottom: '12px' } },
            /* no test-prep branding on a run where the patient was harmed */
            ce('h3', null, grave ? 'What this condition does, and what stops it' : 'ATI / NCLEX pearls'),
            ce('ul', { className: 'sim-list' },
              arr(sc.pearls).concat(arr(sc.keyPoints)).map(function (p, i) {
                return ce('li', { key: i }, str(p));
              })))
        : null,

      ce('div', { className: 'sim-btnrow', key: 'foot' },
        ce('button', { type: 'button', className: 'btn btn-primary', onClick: props.onRetry }, 'Retry'),
        arr(sc.questions).length ? ce('button', { type: 'button', className: 'btn btn-outline', onClick: props.onQuestions }, 'Question round') : null,
        ce('button', { type: 'button', className: 'sim-back', onClick: props.onBrowse }, 'Back to all simulations'))
    ];

    /* Outcome first. Score after. When the patient was harmed the teaching
       leads and the score is a plain recorded number, not a hero. */
    var order = leadWithTeaching
      ? [header, outcomeCard, teachingCard, scorePanel, aiPanel]
      : [header, outcomeCard, scorePanel, teachingCard, aiPanel];

    return ce('div', { className: 'sim-root' }, order.concat(tail));
  }

  /* ---------------------------------------------------------------------- *
   * 20. Post-sim question round
   * ---------------------------------------------------------------------- */
  function sameSet(a, b) {
    if (a.length !== b.length) { return false; }
    var sa = a.slice().sort(function (x, y) { return x - y; });
    var sb = b.slice().sort(function (x, y) { return x - y; });
    for (var i = 0; i < sa.length; i++) { if (sa[i] !== sb[i]) { return false; } }
    return true;
  }
  function sameSeq(a, b) {
    if (a.length !== b.length) { return false; }
    for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) { return false; } }
    return true;
  }

  function SimQuestionRound(props) {
    var qs = arr(props.questions);
    var [i, setI] = useState(0);
    var [picked, setPicked] = useState([]);
    var [revealed, setRevealed] = useState(false);
    var [correctCount, setCorrect] = useState(0);
    var [finished, setFinished] = useState(false);

    if (!qs.length) {
      return ce('div', { className: 'sim-root' },
        ce('div', { className: 'sim-empty' }, 'This scenario has no question bank.'),
        ce('button', { type: 'button', className: 'btn btn-outline', onClick: props.onBack }, 'Back'));
    }

    var q = obj(qs[Math.min(i, qs.length - 1)]);
    var type = lower(q.type) || 'multiple-choice';
    var opts = arr(q.options);
    var correct = arr(q.correct).map(function (n) { return parseNum(n); });

    function toggle(idx) {
      if (revealed) { return; }
      if (type === 'multiple-choice') { setPicked([idx]); return; }
      if (type === 'priority-order') {
        setPicked(function (p) {
          return p.indexOf(idx) !== -1 ? p.filter(function (x) { return x !== idx; }) : p.concat([idx]);
        });
        return;
      }
      setPicked(function (p) {
        return p.indexOf(idx) !== -1 ? p.filter(function (x) { return x !== idx; }) : p.concat([idx]);
      });
    }

    function submit() {
      if (!picked.length) { return; }
      var ok = type === 'priority-order' ? sameSeq(picked, correct) : sameSet(picked, correct);
      if (ok) { setCorrect(correctCount + 1); }
      setRevealed(true);
    }

    function next() {
      if (i + 1 >= qs.length) { setFinished(true); return; }
      setI(i + 1); setPicked([]); setRevealed(false);
    }

    if (finished) {
      var pct = Math.round((correctCount / qs.length) * 100);
      return ce('div', { className: 'sim-root' },
        ce('div', { className: 'sim-head' },
          ce('button', { type: 'button', className: 'sim-back', onClick: props.onBack }, '‹ Back'),
          ce('h2', null, 'Question round complete')),
        ce('div', { className: 'sim-panel', style: { textAlign: 'center' } },
          ce(ScoreRing, { pct: pct }),
          ce('p', { style: { fontSize: '15px', fontWeight: 700 } },
            correctCount + ' of ' + qs.length + ' correct'),
          ce('div', { className: 'sim-btnrow', style: { justifyContent: 'center' } },
            ce('button', { type: 'button', className: 'btn btn-outline',
              onClick: function () { setI(0); setPicked([]); setRevealed(false); setCorrect(0); setFinished(false); } },
              'Run them again'),
            ce('button', { type: 'button', className: 'btn btn-primary', onClick: props.onBack }, 'Done'))));
    }

    var isRight = revealed && (type === 'priority-order' ? sameSeq(picked, correct) : sameSet(picked, correct));

    return ce('div', { className: 'sim-root' },
      ce('div', { className: 'sim-head' },
        ce('button', { type: 'button', className: 'sim-back', onClick: props.onBack }, '‹ Back to debrief'),
        ce('div', null,
          ce('h2', null, 'Question ' + (i + 1) + ' of ' + qs.length),
          ce('div', { className: 'sim-sub' }, str(props.title))),
        ce('div', { className: 'sim-spacer' }),
        ce(Badge, { tone: 'acc' }, type.replace('-', ' ')),
        q.difficulty ? ce(Badge, null, str(q.difficulty)) : null),
      ce('div', { className: 'sim-panel' },
        ce(Bar, { pct: (i / qs.length) * 100, label: 'Question progress' }),
        ce('p', { style: { fontSize: '15px', lineHeight: 1.6, fontWeight: 600, margin: '12px 0' } }, str(q.text)),
        type === 'select-all' ? ce('div', { style: { fontSize: '12px', color: 'var(--text2)', marginBottom: '8px' } },
          'Select all that apply.') : null,
        type === 'priority-order' ? ce('div', { style: { fontSize: '12px', color: 'var(--text2)', marginBottom: '8px' } },
          'Tap the options in the correct order. Tap again to remove.') : null,
        ce('div', { style: { display: 'grid', gap: '8px' } },
          opts.map(function (o, idx) {
            var sel = picked.indexOf(idx) !== -1;
            var isCorrectOpt = correct.indexOf(idx) !== -1;
            var tone = '';
            if (revealed) {
              if (isCorrectOpt) { tone = 'done'; }
              else if (sel) { tone = 'usedbad'; }
            }
            var rank = type === 'priority-order' && sel ? (picked.indexOf(idx) + 1) : null;
            return ce('button', {
              key: idx, type: 'button',
              className: 'sim-action ' + tone,
              disabled: revealed,
              'aria-pressed': sel ? 'true' : 'false',
              style: sel && !revealed ? { borderColor: 'var(--accent)', background: 'var(--sim-acc-bg)' } : null,
              onClick: function () { toggle(idx); }
            },
              ce(Icon, { text: rank !== null ? String(rank) : String.fromCharCode(65 + idx) }),
              ce('span', { className: 'txt', style: { flex: '1 1 auto' } }, str(o)),
              revealed && isCorrectOpt ? ce('span', { style: { color: 'var(--green-fg)', fontWeight: 800 } }, '✓') : null,
              revealed && sel && !isCorrectOpt ? ce('span', { style: { color: 'var(--red-fg)', fontWeight: 800 } }, '✕') : null);
          })),
        revealed
          ? ce('div', { style: { marginTop: '12px' } },
              ce('div', { className: 'sim-fb ' + (isRight ? 'good' : 'bad') },
                ce('span', { className: 'mark' }, isRight ? '✓' : '✕'),
                ce('span', null, ce('b', null, isRight ? 'Correct. ' : 'Not quite. '), str(q.rationale))),
              q.atiPearl ? ce('div', { className: 'sim-fb mid', style: { marginTop: '8px' } },
                ce('span', { className: 'mark' }, '★'),
                ce('span', null, ce('b', null, 'ATI pearl: '), str(q.atiPearl))) : null,
              ce('div', { className: 'sim-btnrow' },
                ce('button', { type: 'button', className: 'btn btn-primary', onClick: next },
                  i + 1 >= qs.length ? 'See results' : 'Next question')))
          : ce('div', { className: 'sim-btnrow' },
              ce('button', { type: 'button', className: 'btn btn-primary', disabled: !picked.length, onClick: submit },
                'Submit answer'))));
  }

  /* ---------------------------------------------------------------------- *
   * 21. Scenario browser
   * ---------------------------------------------------------------------- */
  function patientOneLiner(sc) {
    var p = obj(sc.patient);
    var bits = [str(p.name), str(p.age), str(p.diagnosis)].filter(has);
    var line = bits.join(', ');
    return line || str(sc.summary).slice(0, 90);
  }

  function ScenarioBrowser(props) {
    var all = arr(props.scenarios);
    var [cat, setCat] = useState('all');
    var [diff, setDiff] = useState('all');
    var [status, setStatus] = useState('all');
    var [q, setQ] = useState('');
    var results = props.results || readSimResults();

    var bestMap = useMemo(function () {
      var m = {};
      arr(results).forEach(function (r) {
        var v = parseNum(r.pct); if (v === null) { v = parseNum(r.score); }
        var id = str(r.simId);
        if (v !== null && (m[id] === undefined || v > m[id])) { m[id] = v; }
      });
      return m;
    }, [results]);

    var cats = useMemo(function () {
      return uniqBy(all.map(function (s) { return str(s.category); }).filter(has), function (x) { return x; });
    }, [all]);

    var shown = all.filter(function (s) {
      if (cat !== 'all' && str(s.category) !== cat) { return false; }
      if (diff !== 'all' && lower(s.difficulty) !== lower(diff)) { return false; }
      var done = bestMap[str(s.id)] !== undefined;
      if (status === 'done' && !done) { return false; }
      if (status === 'todo' && done) { return false; }
      if (status === 'passed' && !(done && bestMap[str(s.id)] >= PASS_PCT)) { return false; }
      var needle = lower(q).trim();
      if (needle) {
        var hay = lower([s.title, s.fullTitle, s.summary, obj(s.patient).diagnosis,
          obj(s.patient).name, s.category].join(' '));
        if (hay.indexOf(needle) === -1) { return false; }
      }
      return true;
    });

    var completed = all.filter(function (s) { return bestMap[str(s.id)] !== undefined; }).length;
    var passedN = all.filter(function (s) { return bestMap[str(s.id)] >= PASS_PCT; }).length;
    var avg = 0, n = 0;
    all.forEach(function (s) {
      var v = bestMap[str(s.id)];
      if (v !== undefined) { avg += v; n++; }
    });
    avg = n ? Math.round(avg / n) : 0;

    function chip(list, val, setter, labelPrefix) {
      return list.map(function (o) {
        return ce('button', {
          key: o.id, type: 'button', className: 'sim-chip',
          'aria-pressed': val === o.id ? 'true' : 'false',
          onClick: function () { setter(o.id); }
        }, o.label);
      });
    }

    return ce('div', { className: 'sim-root' },
      ce('div', { className: 'sim-head' },
        ce('div', null,
          ce('h2', null, 'Clinical Simulations'),
          ce('div', { className: 'sim-sub' },
            'Run a full patient scenario in real time. Your decisions change what happens.'))),

      ce('div', { className: 'sim-progress-wrap' },
        ce('div', { style: { display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' } },
          ce('div', null,
            ce('div', { style: { fontSize: '22px', fontWeight: 800 } }, completed + ' / ' + all.length),
            ce('div', { style: { fontSize: '11px', color: 'var(--text2)', letterSpacing: '.5px' } }, 'ATTEMPTED')),
          ce('div', null,
            ce('div', { style: { fontSize: '22px', fontWeight: 800, color: 'var(--green-fg)' } }, String(passedN)),
            ce('div', { style: { fontSize: '11px', color: 'var(--text2)', letterSpacing: '.5px' } }, 'PASSED (' + PASS_PCT + '+)')),
          ce('div', null,
            ce('div', { style: { fontSize: '22px', fontWeight: 800 } }, avg ? avg + '%' : '--'),
            ce('div', { style: { fontSize: '11px', color: 'var(--text2)', letterSpacing: '.5px' } }, 'AVERAGE BEST')),
          ce('div', { className: 'sim-spacer' })),
        ce(Bar, { pct: all.length ? (completed / all.length) * 100 : 0, label: 'Simulations attempted' })),

      ce('div', { className: 'sim-filters' },
        ce('input', {
          className: 'sim-search', type: 'search', value: q, 'aria-label': 'Search simulations',
          placeholder: 'Search by title, patient, or diagnosis',
          onChange: function (e) { setQ(e.target.value); }
        })),
      ce('div', { className: 'sim-filters' },
        chip([{ id: 'all', label: 'All courses' }].concat(cats.map(function (c) { return { id: c, label: c }; })), cat, setCat),
        ce('span', { style: { width: '10px' } }),
        chip([{ id: 'all', label: 'Any level' }, { id: 'Easy', label: 'Easy' },
          { id: 'Medium', label: 'Medium' }, { id: 'Hard', label: 'Hard' }], diff, setDiff),
        ce('span', { style: { width: '10px' } }),
        chip([{ id: 'all', label: 'Any status' }, { id: 'todo', label: 'Not attempted' },
          { id: 'done', label: 'Attempted' }, { id: 'passed', label: 'Passed' }], status, setStatus)),

      shown.length
        ? ce('div', { className: 'sim-grid' }, shown.map(function (s) {
            var best = bestMap[str(s.id)];
            var tone = best === undefined ? '' : best >= PASS_PCT ? 'ok' : 'warn';
            return ce('button', {
              key: str(s.id), type: 'button', className: 'sim-card',
              onClick: function () { props.onPick(s); },
              'aria-label': str(s.title) + ', ' + str(s.difficulty) +
                (best === undefined ? ', not attempted' : ', best score ' + best)
            },
              ce('div', { className: 'sim-card-top' },
                ce(Icon, { text: str(s.icon).slice(0, 4) || 'SIM' }),
                ce('div', { style: { flex: '1 1 auto' } },
                  ce('div', { className: 'sim-card-title' }, str(s.title)),
                  ce('div', { style: { fontSize: '11px', color: 'var(--text3)', marginTop: '2px' } },
                    str(s.category) + (s.course ? ' · ' + str(s.course) : ''))),
                best !== undefined
                  ? ce(Badge, { tone: tone }, (best >= PASS_PCT ? '✓ ' : '· ') + best + '%')
                  : null),
              ce('div', { className: 'sim-card-one' }, patientOneLiner(s)),
              ce('div', { className: 'sim-card-meta' },
                ce(Badge, { tone: lower(s.difficulty) === 'hard' ? 'bad' : lower(s.difficulty) === 'medium' ? 'warn' : 'ok' },
                  str(s.difficulty) || 'Medium'),
                ce(Badge, null, (parseNum(s.durationMin) || 20) + ' min'),
                s.highYield ? ce(Badge, { tone: 'acc' }, '★ High yield') : null,
                obj(s.secondaryPatient).name ? ce(Badge, null, '2 patients') : null));
          }))
        : ce('div', { className: 'sim-empty' }, 'No simulations match those filters.'));
  }

  /* ---------------------------------------------------------------------- *
   * 22. Pre-brief
   * ---------------------------------------------------------------------- */
  function SimPreBrief(props) {
    var sc = obj(props.scenario);
    var p = obj(sc.patient);
    var [mode, setMode] = useState('guided');

    return ce('div', { className: 'sim-root' },
      ce('div', { className: 'sim-head' },
        ce('button', { type: 'button', className: 'sim-back', onClick: props.onBack }, '‹ All simulations'),
        ce('div', null,
          ce('h2', null, str(sc.fullTitle) || str(sc.title)),
          ce('div', { className: 'sim-sub' }, str(sc.summary))),
        ce('div', { className: 'sim-spacer' }),
        ce(Badge, { tone: lower(sc.difficulty) === 'hard' ? 'bad' : 'warn' }, str(sc.difficulty) || 'Medium'),
        ce(Badge, null, (parseNum(sc.durationMin) || 20) + ' min'),
        sc.highYield ? ce(Badge, { tone: 'acc' }, '★ High yield') : null),

      ce('div', { className: 'sim-two' },
        ce('div', { style: { display: 'grid', gap: '12px' } },
          arr(sc.objectives).length ? ce('div', { className: 'sim-panel' },
            ce('h3', null, 'During this simulation you are expected to'),
            ce('ul', { className: 'sim-list' }, arr(sc.objectives).map(function (o, i) {
              return ce('li', { key: i }, str(o));
            }))) : null,

          arr(sc.successChecklist).length ? ce('div', { className: 'sim-panel' },
            ce('h3', null, 'Required prior knowledge'),
            ce('ul', { className: 'sim-list' }, arr(sc.successChecklist).map(function (o, i) {
              return ce('li', { key: i }, str(o));
            }))) : null,

          ce('div', { className: 'sim-panel' },
            ce('h3', null, 'Choose your mode'),
            ce('div', { className: 'sim-modes', role: 'radiogroup', 'aria-label': 'Simulation mode' },
              MODES.map(function (m) {
                return ce('button', {
                  key: m.id, type: 'button', className: 'sim-mode', role: 'radio',
                  'aria-checked': mode === m.id ? 'true' : 'false',
                  'aria-pressed': mode === m.id ? 'true' : 'false',
                  onClick: function () { setMode(m.id); }
                },
                  ce('h4', null, m.name,
                    ce(Badge, { tone: mode === m.id ? 'acc' : '' }, m.tag)),
                  ce('div', { style: { fontSize: '12.5px', color: 'var(--text2)', lineHeight: 1.5 } }, m.blurb),
                  ce('ul', { className: 'sim-list', style: { fontSize: '12px' } },
                    m.bullets.map(function (b, i) { return ce('li', { key: i }, b); })));
              })),
            ce('div', { className: 'sim-btnrow' },
              ce('button', { type: 'button', className: 'btn btn-primary',
                onClick: function () { props.onStart(mode); } },
                'I am ready - start the simulation'),
              ce('button', { type: 'button', className: 'sim-back', onClick: props.onBack }, 'Not yet')))),

        ce('div', { style: { display: 'grid', gap: '12px' } },
          ce('div', { className: 'sim-panel' },
            ce('h3', null, 'Patient chart'),
            [['Name', p.name], ['Age', p.age], ['DOB', p.dob], ['Sex', p.sex],
             ['Weight', p.weightKg ? p.weightKg + ' kg' : ''], ['Diagnosis', p.diagnosis],
             ['Gravida/Para', p.gravidaPara], ['Gestation', p.gestationalAge]]
              .filter(function (r) { return has(r[1]); })
              .map(function (r, i) {
                return ce('div', { key: i, className: 'sim-kv' }, ce('b', null, r[0]), ce('span', null, str(r[1])));
              }),
            ce('div', { className: 'sim-kv' }, ce('b', null, 'Allergies'),
              ce('span', { style: { color: arr(p.allergies).join('').toUpperCase() === 'NKDA' ? 'var(--text)' : 'var(--orange)', fontWeight: 700 } },
                arr(p.allergies).join(', ') || 'Not documented')),
            ce('div', { className: 'sim-kv' }, ce('b', null, 'Code status'),
              ce('span', { style: { fontWeight: 700 } }, str(p.codeStatus) || 'Not documented'))),

          arr(p.history).length ? ce('div', { className: 'sim-panel' },
            ce('h3', null, 'History'),
            ce('ul', { className: 'sim-list' }, arr(p.history).map(function (h, i) {
              return ce('li', { key: i }, str(h));
            }))) : null,

          obj(sc.secondaryPatient).name ? ce('div', { className: 'sim-panel' },
            ce('h3', null, 'Second patient'),
            ce('div', { style: { fontSize: '13px', lineHeight: 1.55 } },
              ce('b', null, str(obj(sc.secondaryPatient).name)), ' · ',
              str(obj(sc.secondaryPatient).age), ' · ',
              str(obj(sc.secondaryPatient).diagnosis),
              ce('div', { style: { color: 'var(--text2)', marginTop: '6px' } },
                'You will be able to switch between both patients on the monitor during the sim.'))) : null,

          ce('div', { className: 'sim-panel' },
            ce('h3', null, 'How scoring works'),
            ce('div', { style: { display: 'grid', gap: '6px', fontSize: '12.5px' } },
              [['Critical interventions', WEIGHTS.critical], ['Priority ordering', WEIGHTS.ordering],
               ['Timeliness', WEIGHTS.timeliness], ['Assessment thoroughness', WEIGHTS.assessment],
               ['Communication', WEIGHTS.communication], ['Patient education', WEIGHTS.education],
               ['Supporting interventions', WEIGHTS.supporting]].map(function (r, i) {
                return ce('div', { key: i, className: 'sim-kv' },
                  ce('b', null, r[0]), ce('span', null, r[1] + ' pts'));
              }),
              ce('div', { style: { color: 'var(--text2)', marginTop: '4px' } },
                'Each critical error costs 12 points (18 in exam mode). Pass mark ' + PASS_PCT + ' with zero critical errors.'))))));
  }

  /* ---------------------------------------------------------------------- *
   * 23. SimulationHub - top level
   * ---------------------------------------------------------------------- */
  function SimulationHub(props) {
    injectStyles();
    var [view, setView] = useState('browser');
    var [scenario, setScenario] = useState(null);
    var [mode, setMode] = useState('guided');
    var [session, setSession] = useState(null);
    var [runKey, setRunKey] = useState(0);
    var [tick, setTick] = useState(0);   // forces a re-read of progress after a run

    var scenarios = useMemo(function () {
      var given = arr(props && props.scenarios);
      if (given.length) { return given; }
      var all = arr(window.ALL_SCENARIOS);
      if (all.length) { return all; }
      return arr(window.SCENARIOS_MS2A)
        .concat(arr(window.SCENARIOS_MS2B))
        .concat(arr(window.SCENARIOS_OB))
        .concat(arr(window.SCENARIOS_PEDS));
    }, [props && props.scenarios]);

    var results = useMemo(function () { return readSimResults(); }, [tick, view]);

    function idxOf(sc) {
      for (var i = 0; i < scenarios.length; i++) {
        if (str(scenarios[i].id) === str(obj(sc).id)) { return i; }
      }
      return -1;
    }
    var nextScenario = scenario ? scenarios[idxOf(scenario) + 1] : null;

    useEffect(function () {
      try { window.scrollTo(0, 0); } catch (e) {}
    }, [view]);

    if (view === 'prebrief' && scenario) {
      return ce(SimPreBrief, {
        scenario: scenario,
        onBack: function () { setView('browser'); },
        onStart: function (m) { setMode(m); setRunKey(runKey + 1); setView('sim'); }
      });
    }

    if (view === 'sim' && scenario) {
      return ce(SimRunner, {
        key: 'run-' + str(scenario.id) + '-' + runKey,
        scenario: scenario, mode: mode,
        onQuit: function () { setView('browser'); setTick(tick + 1); },
        onFinish: function (s) { setSession(s); setTick(tick + 1); setView('debrief'); }
      });
    }

    if (view === 'debrief' && session) {
      return ce(SimDebrief, {
        session: session,
        hasNext: !!nextScenario,
        onRetry: function () { setRunKey(runKey + 1); setView('sim'); },
        onQuestions: function () { setView('questions'); },
        onNext: function () {
          if (!nextScenario) { return; }
          setScenario(nextScenario); setSession(null); setView('prebrief');
        },
        onBrowse: function () { setView('browser'); }
      });
    }

    if (view === 'questions' && scenario) {
      return ce(SimQuestionRound, {
        questions: arr(scenario.questions),
        title: str(scenario.title),
        onBack: function () { setView(session ? 'debrief' : 'browser'); }
      });
    }

    return ce(ScenarioBrowser, {
      scenarios: scenarios,
      results: results,
      onPick: function (s) { setScenario(s); setSession(null); setView('prebrief'); }
    });
  }

  /* ---------------------------------------------------------------------- *
   * 24. Exports
   * ---------------------------------------------------------------------- */
  injectStyles();

  window.SimEngine = {
    TIME_SCALE: TIME_SCALE,
    EXAM_SCALE: EXAM_SCALE,
    PASS_PCT: PASS_PCT,
    WEIGHTS: WEIGHTS,
    MODES: MODES,
    buildActions: buildActions,
    buildGuards: buildGuards,
    buildReplay: buildReplay,
    scorePerformance: scorePerformance,
    patientOutcome: patientOutcome,
    simTurningPoints: simTurningPoints,
    shortAction: shortAction,
    OUTCOME_META: SIM_OUTCOME_META,
    normVitals: normVitals,
    degradeVitals: degradeVitals,
    classify: classify,
    vitalState: vitalState,
    ageBand: ageBand,
    matchDialogue: matchDialogue,
    readSimResults: readSimResults,
    bestScoreFor: bestScoreFor,
    saveResult: saveResult,
    fmtClock: fmtClock,
    lisLength: lisLength
  };

  window.SimulationHub = SimulationHub;
  window.ScenarioBrowser = ScenarioBrowser;
  window.SimPreBrief = SimPreBrief;
  window.SimRunner = SimRunner;
  window.VitalsMonitor = VitalsMonitor;
  window.VitalSparkline = VitalSparkline;
  window.SimActionPanel = SimActionPanel;
  window.SimEventLog = SimEventLog;
  window.SimChartViewer = SimChartViewer;
  window.PatientTalkPanel = PatientTalkPanel;
  window.SimSBARPanel = SimSBARPanel;
  window.SimDoseGate = SimDoseGate;
  window.SimDebrief = SimDebrief;
  window.SimQuestionRound = SimQuestionRound;
})();
