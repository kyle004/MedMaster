/* =============================================================================
 * MedMaster :: js/ms2lab.js
 * MED-SURG II SIMULATION LAB  ->  window.MS2LabMode
 * -----------------------------------------------------------------------------
 * The eight NUR2212C simulation-lab packets, run the way the school runs them:
 * a 20-minute proctored checkoff against the packet's own numbered activity
 * steps. The student is handed the chart, performs the steps in order, gives
 * SBAR, escalates, and is marked step by step.
 *
 * DESIGN RULE #1 - THE PACKET IS AUTHORITATIVE. `activitySteps` IS the rubric;
 * it is what the proctor marks. Nothing in this file invents a second rubric,
 * re-words a step, or grades anything the packet does not grade. Where a packet
 * contains a real defect (the ICP orders read "Maintain oxygen SpO2 <95%") the
 * defect is SHOWN, in the packet's own words, next to the note explaining it.
 * Noticing a bad order is a nursing skill and they will meet the same packet in
 * the lab.
 *
 * DESIGN RULE #2 - NOTHING IS EVER CONSUMED BY AN ACCIDENT. Out of sequence is
 * a HELD-BACK attempt, not a spent one: the control stays enabled, it shakes,
 * it coaches by PHASE without naming the step, and a second activation within
 * 8 seconds commits it as out-of-sequence. Identical semantics to
 * js/sim-engine.js section 5b, gating only on `critical` steps.
 *
 * DESIGN RULE #3 - NEVER ACCUMULATE A CLOCK. Elapsed time is derived from
 * timestamps carried in the run state (startedAt, pausedAt, pausedMs), so a
 * backgrounded tab, a refresh or a second student's phone can never
 * desynchronise it, and resume can never fast-forward.
 *
 * DESIGN RULE #4 - THE RUN IS A FOLD OVER AN EVENT LIST. `applyEvent(run, evt)`
 * is pure. Solo keeps the list in memory; a room keeps it in
 * /codeblue/rooms/<code>/events and every client folds the same list, so the
 * clock, the pause and the step log are shared with no host engine at all.
 *
 * DESIGN RULE #5 - AI IS AN ACCESSORY, NEVER A GATE. The AI plays the patient
 * and reads the SBAR. It is handed the chart, labs, orders and rubric as fixed
 * ground truth and told it may not contradict them. Every failure path lands in
 * solo mode with the rubric scoring untouched.
 *
 * Contract: IIFE, no JSX, no ES modules, ES5 only (var/function - no arrow
 * functions, template literals, const/let, spread or optional chaining),
 * window export, CSS variables with fallbacks, legible at 360px, honours
 * prefers-reduced-motion.
 * ========================================================================== */
(function () {
  'use strict';

  if (!window.React) { return; }

  var ce = React.createElement;
  var useState = React.useState, useEffect = React.useEffect,
      useRef = React.useRef, useMemo = React.useMemo,
      useCallback = React.useCallback;

  /* ==========================================================================
   * 1. TINY HELPERS
   * ======================================================================== */

  function isFn(f) { return typeof f === 'function'; }
  function obj(v) { return (v && typeof v === 'object') ? v : {}; }
  function arr(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function lower(v) { return str(v).toLowerCase(); }
  function numOr(v, d) {
    var n = (typeof v === 'number') ? v : parseFloat(v);
    return isFinite(n) ? n : d;
  }
  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
  function uid(p) { return str(p || 'x') + '-' + Math.random().toString(36).slice(2, 9); }
  function nowMs() { return Date.now(); }
  function keysOf(o) {
    var out = [], k, s = obj(o);
    for (k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) { out.push(k); } }
    return out;
  }
  function shallow(o) {
    var out = {}, k, s = obj(o);
    for (k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) { out[k] = s[k]; } }
    return out;
  }
  function cut(v, n) {
    var t = str(v);
    if (t.length <= n) { return t; }
    var head = t.slice(0, n - 1);
    var trimmed = head.replace(/\s+\S*$/, '');
    return (trimmed.length > n * 0.6 ? trimmed : head) + '…';
  }
  /** mm:ss, never negative. */
  function fmtClock(sec) {
    var s = Math.max(0, Math.round(numOr(sec, 0)));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function MMx() { return obj(window.MM); }
  function aiApi() { return obj(MMx().ai); }
  function toast(msg, kind) {
    var MM = MMx();
    if (isFn(MM.toast)) { try { MM.toast(str(msg), kind || 'info'); } catch (e) {} }
  }
  function reduceMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  /* Screen-reader announcer. Uses the shell's shared announcer when there is
     one, otherwise owns a single off-screen live region. Only threshold events
     go through here - a rubric list that announces every render is noise. */
  var LIVE_ID = 'ms2-live-region';
  function announce(msg, urgent) {
    var m = str(msg).trim();
    if (!m) { return; }
    var MM = MMx();
    if (isFn(MM.announce)) {
      try { MM.announce(m, !!urgent); return; } catch (e) {}
    }
    try {
      var n = document.getElementById(LIVE_ID);
      if (!n) {
        n = document.createElement('div');
        n.id = LIVE_ID;
        n.className = 'ms2-sr';
        n.setAttribute('aria-atomic', 'true');
        document.body.appendChild(n);
      }
      n.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
      n.textContent = '';
      window.setTimeout(function () { n.textContent = m; }, 60);
    } catch (e) {}
  }

  /* ==========================================================================
   * 2. STYLESHEET (injected once)
   * ======================================================================== */

  function injectStyles() {
    try {
      if (!document || !document.getElementById) { return; }
      if (document.getElementById('ms2lab-styles')) { return; }
    } catch (e) { return; }

    var css = [
      /* ---- root ---- */
      '.ms2-root{--ms2-ok:var(--green,#22c55e);--ms2-warn:var(--orange,#f59e0b);',
      '--ms2-bad:var(--red,#ef4444);--ms2-acc:var(--accent,#3b82f6);',
      '--ms2-ok-fg:var(--green-fg,#4ade80);--ms2-warn-fg:var(--orange-fg,#fbbf24);',
      '--ms2-bad-fg:var(--red-fg,#f87171);',
      '--ms2-ok-bg:color-mix(in srgb,var(--green,#22c55e) 12%,var(--bg,#0b1220));',
      '--ms2-warn-bg:color-mix(in srgb,var(--orange,#f59e0b) 13%,var(--bg,#0b1220));',
      '--ms2-bad-bg:color-mix(in srgb,var(--red,#ef4444) 12%,var(--bg,#0b1220));',
      '--ms2-acc-bg:color-mix(in srgb,var(--accent,#3b82f6) 12%,var(--bg,#0b1220));',
      '--ms2-ok-br:color-mix(in srgb,var(--green,#22c55e) 45%,transparent);',
      '--ms2-warn-br:color-mix(in srgb,var(--orange,#f59e0b) 52%,transparent);',
      '--ms2-bad-br:color-mix(in srgb,var(--red,#ef4444) 50%,transparent);',
      '--ms2-acc-br:color-mix(in srgb,var(--accent,#3b82f6) 45%,transparent);',
      'color:var(--text,#e5e7eb);}',
      '.ms2-root *:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:2px;',
      'border-radius:var(--r-sm,6px);}',
      '.ms2-root button{font-family:inherit;color:var(--text,#e5e7eb);}',
      '.ms2-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;',
      'clip:rect(0 0 0 0);white-space:nowrap;border:0;}',

      /* ---- generic ---- */
      '.ms2-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;}',
      '.ms2-head h2{margin:0;font-size:20px;font-weight:800;letter-spacing:.2px;color:var(--text,#e5e7eb);}',
      '.ms2-sub{color:var(--text2,#9ca3af);font-size:13px;margin:2px 0 0;line-height:1.5;}',
      '.ms2-dim{color:var(--text3,#6b7280);font-size:12px;line-height:1.5;}',
      '.ms2-spacer{flex:1 1 auto;}',
      '.ms2-btn{background:var(--surface,#111827);border:1px solid var(--border,#243043);',
      'color:var(--text,#e5e7eb);padding:9px 14px;border-radius:var(--r-md,10px);cursor:pointer;',
      'font-size:13px;font-weight:700;min-height:44px;',
      'transition:border-color .15s ease,transform .15s ease;}',
      '.ms2-btn:hover:not(:disabled){border-color:var(--accent,#3b82f6);}',
      '.ms2-btn:active:not(:disabled){transform:scale(.975);}',
      '.ms2-btn:disabled{opacity:.45;cursor:not-allowed;}',
      '.ms2-btn.go{background:var(--accent,#3b82f6);border-color:var(--accent,#3b82f6);',
      'color:var(--text-on-fill,#ffffff);}',
      '.ms2-btn.danger{color:var(--ms2-bad-fg);border-color:var(--ms2-bad-br);',
      'background:var(--ms2-bad-bg);}',
      '.ms2-btn.sm{min-height:34px;padding:5px 10px;font-size:12px;font-weight:700;}',
      '.ms2-card{background:var(--surface,#111827);border:1px solid var(--border,#243043);',
      'border-radius:var(--r-lg,14px);padding:14px;color:var(--text,#e5e7eb);}',
      '.ms2-card+.ms2-card{margin-top:12px;}',
      '.ms2-card h3{margin:0 0 6px;font-size:15px;font-weight:800;color:var(--text,#e5e7eb);}',
      '.ms2-badge{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;',
      'letter-spacing:.4px;text-transform:uppercase;padding:3px 8px;border-radius:999px;',
      'border:1px solid var(--border,#243043);color:var(--text2,#9ca3af);',
      'background:var(--surface2,#0f172a);}',
      '.ms2-badge.ok{color:var(--ms2-ok-fg);border-color:var(--ms2-ok-br);background:var(--ms2-ok-bg);}',
      '.ms2-badge.warn{color:var(--ms2-warn-fg);border-color:var(--ms2-warn-br);background:var(--ms2-warn-bg);}',
      '.ms2-badge.bad{color:var(--ms2-bad-fg);border-color:var(--ms2-bad-br);background:var(--ms2-bad-bg);}',
      '.ms2-badge.acc{color:var(--accent-fg,#93c5fd);border-color:var(--ms2-acc-br);background:var(--ms2-acc-bg);}',
      '.ms2-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}',
      '.ms2-note{border-left:3px solid var(--ms2-warn-br);background:var(--ms2-warn-bg);',
      'color:var(--text,#e5e7eb);padding:10px 12px;border-radius:var(--r-md,10px);',
      'font-size:12.5px;line-height:1.55;}',
      '.ms2-banner{border:1px solid var(--ms2-acc-br);background:var(--ms2-acc-bg);',
      'color:var(--text,#e5e7eb);padding:10px 12px;border-radius:var(--r-md,10px);',
      'font-size:12.5px;line-height:1.55;}',
      '.ms2-banner.bad{border-color:var(--ms2-bad-br);background:var(--ms2-bad-bg);}',
      '.ms2-banner.ok{border-color:var(--ms2-ok-br);background:var(--ms2-ok-bg);}',
      '.ms2-banner.warn{border-color:var(--ms2-warn-br);background:var(--ms2-warn-bg);}',
      '.ms2-empty{padding:28px;text-align:center;color:var(--text3,#6b7280);font-size:13px;}',

      /* ---- picker ---- */
      '.ms2-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(275px,1fr));gap:12px;}',
      '.ms2-topic{background:var(--surface,#111827);border:1px solid var(--border,#243043);',
      'border-radius:var(--r-lg,14px);padding:14px;text-align:left;cursor:pointer;width:100%;',
      'display:flex;flex-direction:column;gap:8px;color:var(--text,#e5e7eb);',
      'transition:transform .16s ease,border-color .16s ease;}',
      '.ms2-topic:hover{transform:translateY(-2px);border-color:var(--accent,#3b82f6);}',
      '.ms2-topic-t{font-size:15px;font-weight:800;line-height:1.25;color:var(--text,#e5e7eb);}',
      '.ms2-topic-s{font-size:12.5px;color:var(--text2,#9ca3af);line-height:1.45;}',
      '.ms2-ready{height:6px;border-radius:999px;background:var(--surface3,#1f2937);overflow:hidden;}',
      '.ms2-ready>span{display:block;height:100%;border-radius:999px;background:var(--accent,#3b82f6);}',
      '.ms2-ready.pass>span{background:var(--green,#22c55e);}',
      '.ms2-ready.near>span{background:var(--orange,#f59e0b);}',

      /* ---- run shell ---- */
      '.ms2-stage{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;',
      'align-items:start;}',
      '.ms2-bar{position:sticky;top:64px;z-index:20;display:flex;gap:10px;flex-wrap:wrap;',
      'align-items:center;background:var(--surface,#111827);',
      'border:1px solid var(--border,#243043);border-radius:var(--r-lg,14px);padding:10px 12px;',
      'margin-bottom:12px;color:var(--text,#e5e7eb);}',
      '.ms2-clock{font-variant-numeric:tabular-nums;font-size:22px;font-weight:800;',
      'letter-spacing:.5px;color:var(--text,#e5e7eb);}',
      '.ms2-clock.low{color:var(--ms2-warn-fg);}',
      '.ms2-clock.out{color:var(--ms2-bad-fg);}',
      '.ms2-prog{font-size:12px;color:var(--text2,#9ca3af);font-weight:700;}',

      /* ---- rubric ---- */
      '.ms2-steps{display:flex;flex-direction:column;gap:8px;}',
      /* .ms2-errbtn is the critical-error watch line. It shares the step
         layout deliberately - it is the same physical affordance - but it is a
         DIFFERENT class, so nothing (a test, a future feature, a stylesheet
         override) can ever confuse "a rubric step" with "an error mark". */
      '.ms2-step,.ms2-errbtn{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;',
      'background:var(--surface2,#0f172a);border:1px solid var(--border,#243043);',
      'color:var(--text,#e5e7eb);border-radius:var(--r-md,10px);padding:10px 12px;',
      'cursor:pointer;min-height:44px;',
      'transition:border-color .15s ease,transform .15s ease;}',
      '.ms2-step:hover:not(:disabled),.ms2-errbtn:hover:not(:disabled){border-color:var(--accent,#3b82f6);}',
      '.ms2-step:active:not(:disabled),.ms2-errbtn:active:not(:disabled){transform:scale(.99);}',
      '.ms2-step:disabled,.ms2-errbtn:disabled{opacity:.55;cursor:default;}',
      '.ms2-step .n,.ms2-errbtn .n{flex:0 0 auto;width:26px;height:26px;border-radius:8px;',
      'display:inline-flex;align-items:center;justify-content:center;font-size:11px;',
      'font-weight:800;background:var(--surface3,#1f2937);color:var(--text,#e5e7eb);}',
      '.ms2-step .txt,.ms2-errbtn .txt{display:block;font-size:13px;font-weight:600;line-height:1.4;',
      'color:var(--text,#e5e7eb);}',
      '.ms2-step .sub,.ms2-errbtn .sub{display:block;font-size:11px;line-height:1.45;margin-top:3px;',
      'color:var(--text3,#6b7280);}',
      '.ms2-step .warn,.ms2-errbtn .warn{display:block;font-size:11px;font-weight:800;line-height:1.45;',
      'margin-top:4px;color:var(--ms2-warn-fg);}',
      '.ms2-step.done{border-color:var(--ms2-ok-br);background:var(--ms2-ok-bg);}',
      '.ms2-step.usedmid,.ms2-errbtn.usedmid{border-color:var(--ms2-warn-br);',
      'background:var(--ms2-warn-bg);color:var(--text,#e5e7eb);}',
      /* HELD BACK, not consumed - still live, still clickable. The shake is the
         whole repercussion; losing the step never was one. */
      '.ms2-step.outorder{border-color:var(--ms2-warn-br);background:var(--ms2-warn-bg);',
      'color:var(--text,#e5e7eb);animation:ms2Shake .45s ease;}',
      '@keyframes ms2Shake{10%,90%{transform:translateX(-2px);}20%,80%{transform:translateX(3px);}',
      '30%,50%,70%{transform:translateX(-5px);}40%,60%{transform:translateX(5px);}100%{transform:none;}}',
      '@media (prefers-reduced-motion:reduce){.ms2-step.outorder{animation:none;}',
      '.ms2-topic:hover{transform:none;}}',

      /* ---- chart ---- */
      '.ms2-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}',
      '.ms2-tab{background:var(--surface2,#0f172a);border:1px solid var(--border,#243043);',
      'color:var(--text2,#9ca3af);padding:6px 11px;border-radius:999px;font-size:12px;',
      'font-weight:700;cursor:pointer;min-height:34px;}',
      '.ms2-tab[aria-selected="true"]{background:var(--accent,#3b82f6);',
      'border-color:var(--accent,#3b82f6);color:var(--text-on-fill,#ffffff);}',
      '.ms2-tab .k{opacity:.7;font-size:10px;margin-left:4px;}',
      '.ms2-pane{max-height:520px;overflow-y:auto;}',
      '.ms2-kv{display:grid;grid-template-columns:minmax(90px,auto) 1fr;gap:4px 12px;',
      'font-size:12.5px;line-height:1.5;}',
      '.ms2-kv dt{color:var(--text3,#6b7280);font-weight:700;}',
      '.ms2-kv dd{margin:0;color:var(--text,#e5e7eb);}',
      '.ms2-tbl{width:100%;border-collapse:collapse;font-size:12.5px;}',
      '.ms2-tbl th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;',
      'color:var(--text3,#6b7280);padding:5px 6px;border-bottom:1px solid var(--border,#243043);}',
      '.ms2-tbl td{padding:5px 6px;border-bottom:1px solid var(--border,#243043);',
      'color:var(--text,#e5e7eb);vertical-align:top;}',
      '.ms2-tbl tr.abn td{background:var(--ms2-warn-bg);}',
      '.ms2-tbl tr.crit td{background:var(--ms2-bad-bg);}',
      '.ms2-tbl .rng{color:var(--text3,#6b7280);font-size:11px;white-space:nowrap;}',
      '.ms2-li{font-size:12.5px;line-height:1.55;color:var(--text,#e5e7eb);',
      'padding:6px 0;border-bottom:1px solid var(--border,#243043);}',
      '.ms2-li:last-child{border-bottom:0;}',
      '.ms2-li .at{color:var(--text3,#6b7280);font-size:11px;font-weight:700;',
      'display:inline-block;min-width:96px;}',

      /* ---- sbar + text ---- */
      '.ms2-ta{width:100%;box-sizing:border-box;background:var(--surface2,#0f172a);',
      'border:1px solid var(--border,#243043);color:var(--text,#e5e7eb);border-radius:var(--r-md,10px);',
      'padding:9px 11px;font-size:13px;font-family:inherit;line-height:1.5;min-height:64px;',
      'resize:vertical;}',
      '.ms2-in{width:100%;box-sizing:border-box;background:var(--surface2,#0f172a);',
      'border:1px solid var(--border,#243043);color:var(--text,#e5e7eb);border-radius:var(--r-md,10px);',
      'padding:9px 11px;font-size:13px;font-family:inherit;min-height:44px;}',
      '.ms2-lbl{display:block;font-size:11px;font-weight:800;letter-spacing:.4px;',
      'text-transform:uppercase;color:var(--text3,#6b7280);margin:10px 0 4px;}',

      /* ---- log + feedback ---- */
      '.ms2-fb{border-radius:var(--r-md,10px);padding:10px 12px;font-size:12.5px;line-height:1.55;',
      'border:1px solid var(--ms2-acc-br);background:var(--ms2-acc-bg);color:var(--text,#e5e7eb);}',
      '.ms2-fb.mid{border-color:var(--ms2-warn-br);background:var(--ms2-warn-bg);}',
      '.ms2-fb.bad{border-color:var(--ms2-bad-br);background:var(--ms2-bad-bg);}',
      '.ms2-fb.good{border-color:var(--ms2-ok-br);background:var(--ms2-ok-bg);}',
      '.ms2-fb b{display:block;font-size:12px;font-weight:800;margin-bottom:3px;',
      'color:var(--text,#e5e7eb);}',
      '.ms2-log{max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;}',
      '.ms2-le{font-size:12px;line-height:1.5;color:var(--text2,#9ca3af);',
      'border-left:2px solid var(--border,#243043);padding:2px 0 2px 8px;}',
      '.ms2-le .t{color:var(--text3,#6b7280);font-variant-numeric:tabular-nums;margin-right:6px;}',
      '.ms2-le.good{border-left-color:var(--ms2-ok-br);}',
      '.ms2-le.warn{border-left-color:var(--ms2-warn-br);}',
      '.ms2-le.bad{border-left-color:var(--ms2-bad-br);}',
      '.ms2-le.patient{border-left-color:var(--ms2-acc-br);color:var(--text,#e5e7eb);',
      'font-style:italic;}',

      /* ---- pause veil ---- */
      '.ms2-pausehost{position:relative;}',
      '.ms2-veil{position:absolute;inset:0;z-index:30;display:flex;align-items:flex-start;',
      'justify-content:center;padding:16px;',
      'background:color-mix(in srgb,var(--bg,#0b1220) 74%,transparent);}',
      '.ms2-veilcard{position:sticky;top:80px;background:var(--surface,#111827);',
      'color:var(--text,#e5e7eb);border:2px solid var(--accent,#3b82f6);',
      'border-radius:var(--r-xl,18px);padding:18px;max-width:360px;text-align:center;',
      'display:flex;flex-direction:column;gap:8px;align-items:center;}',
      '.ms2-veilcard h3{margin:0;font-size:16px;font-weight:800;color:var(--text,#e5e7eb);}',

      /* ---- debrief marks ---- */
      '.ms2-mark{display:flex;gap:10px;align-items:flex-start;padding:9px 0;',
      'border-bottom:1px solid var(--border,#243043);}',
      '.ms2-mark:last-child{border-bottom:0;}',
      '.ms2-mark .m{flex:0 0 auto;width:24px;height:24px;border-radius:7px;font-size:12px;',
      'font-weight:800;display:inline-flex;align-items:center;justify-content:center;',
      'background:var(--surface3,#1f2937);color:var(--text,#e5e7eb);}',
      '.ms2-mark.good .m{background:var(--ms2-ok-bg);color:var(--ms2-ok-fg);}',
      '.ms2-mark.mid .m{background:var(--ms2-warn-bg);color:var(--ms2-warn-fg);}',
      '.ms2-mark.miss .m{background:var(--ms2-bad-bg);color:var(--ms2-bad-fg);}',
      '.ms2-mark .b{flex:1 1 auto;min-width:0;}',
      '.ms2-verdict{font-size:26px;font-weight:900;letter-spacing:.3px;',
      'color:var(--text,#e5e7eb);}',
      '.ms2-verdict.pass{color:var(--ms2-ok-fg);}',
      '.ms2-verdict.notyet{color:var(--ms2-warn-fg);}',
      '.ms2-verdict.fail{color:var(--ms2-bad-fg);}',
      '.ms2-side{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',

      /* ---- roles / room ---- */
      '.ms2-roles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;}',
      '.ms2-role{background:var(--surface2,#0f172a);border:1px solid var(--border,#243043);',
      'border-radius:var(--r-md,10px);padding:9px 11px;text-align:left;cursor:pointer;',
      'color:var(--text,#e5e7eb);font-size:12.5px;min-height:44px;}',
      '.ms2-role[aria-pressed="true"]{border-color:var(--accent,#3b82f6);',
      'background:var(--ms2-acc-bg);}',
      '.ms2-role b{display:block;font-size:13px;font-weight:800;color:var(--text,#e5e7eb);}',
      '.ms2-role span{display:block;font-size:11px;color:var(--text3,#6b7280);margin-top:2px;}',
      '.ms2-code{font-size:30px;font-weight:900;letter-spacing:8px;',
      'font-variant-numeric:tabular-nums;color:var(--text,#e5e7eb);}',

      /* ---- responsive ---- */
      '@media (max-width:900px){.ms2-stage{grid-template-columns:minmax(0,1fr);}',
      '.ms2-bar{position:static;}.ms2-pane{max-height:none;}',
      '.ms2-side{grid-template-columns:1fr;}}'
    ].join('');

    try {
      var st = document.createElement('style');
      st.id = 'ms2lab-styles';
      st.textContent = css;
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  }

  /* ==========================================================================
   * 3. THE PACKETS
   * The data file is loaded by the shell as a separate <script>. If it never
   * arrived, every entry point here has to say so in words rather than throw -
   * the same contract the shell's modulePage() honours for a missing module.
   * ======================================================================== */

  function allSims() {
    var list = arr(window.MS2_LAB_SIMS);
    return list.filter(function (s) {
      return !!(obj(s).id && arr(obj(s).activitySteps).length);
    });
  }
  function contentOk() { return allSims().length > 0; }
  function simById(id) {
    var want = str(id), list = allSims(), i;
    for (i = 0; i < list.length; i++) { if (str(list[i].id) === want) { return list[i]; } }
    return null;
  }

  /* ==========================================================================
   * 4. THE RUBRIC
   * --------------------------------------------------------------------------
   * `activitySteps` is not a quiz and it is not a suggestion - it is the sheet
   * the proctor marks. So the model here is deliberately thin: keep the steps
   * exactly as authored, in the order authored, and add only the two derived
   * things the interaction needs - a stable id and a rank among the CRITICAL
   * steps (ordering is judged against criticals only, never against the whole
   * list, for the reason spelled out in js/sim-engine.js section 5b).
   * ======================================================================== */

  /* How many steps of local reordering are never penalised. The packets run
     10-14 steps, roughly a fifth of a full sim-engine scenario, so the window
     is 2 rather than 3: a student may swap neighbouring steps freely (verify
     identity then hand hygiene, or assess then read the labs) and is only held
     back when they have genuinely skipped ahead. */
  var GATE_LOOKAHEAD = 2;
  /* How long a held-back step stays armed for the override. Same 8s as
     js/sim-engine.js - long enough to read the coaching line, short enough
     that an override has to be a decision. */
  var ARM_MS = 8000;
  var PASS_PCT = 80;
  var HINT_CAP = 8;

  /* The packet's own phase vocabulary. `line` is the coaching sentence for a
     held-back step: it names the PHASE that is unfinished and never the step,
     because a coaching line that hands over the answer is not coaching. */
  var PHASES = {
    prep: {
      id: 'prep', label: 'Preparation', short: 'PREP',
      line: 'The preparation steps are not finished yet.',
      why: 'Chart review, two identifiers and hand hygiene are marked on every ' +
        'checkoff and they are marked before anything else. A finding you gather ' +
        'before you have confirmed who the patient is belongs to nobody.'
    },
    assess: {
      id: 'assess', label: 'Assessment', short: 'ASSESS',
      line: 'The focused assessment is not complete yet.',
      why: 'You cannot interpret, intervene or hand off data you have not ' +
        'collected. The proctor is watching for a systematic, hands-on ' +
        'assessment, not a glance at the monitor.'
    },
    interpret: {
      id: 'interpret', label: 'Interpretation', short: 'INTERPRET',
      line: 'The findings have not been interpreted out loud yet.',
      why: 'This is the step students lose points on. The packet wants you to ' +
        'SAY what the numbers mean - read the labs and the diagnostics and name ' +
        'the pattern before you act on it.'
    },
    intervene: {
      id: 'intervene', label: 'Intervention', short: 'INTERVENE',
      line: 'A hands-on intervention is still open.',
      why: 'Priority-setting is scored here: airway and breathing, then ' +
        'circulation, then everything else, and provider orders implemented as ' +
        'written unless you have a reason to question them.'
    },
    communicate: {
      id: 'communicate', label: 'Communication', short: 'SBAR',
      line: 'The SBAR report has not been given yet.',
      why: 'SBAR is a graded step in its own right. It comes after you have ' +
        'something to report and before - or alongside - escalation, never ' +
        'instead of the assessment that fills it.'
    },
    escalate: {
      id: 'escalate', label: 'Escalation', short: 'ESCALATE',
      line: 'Care has not been escalated yet.',
      why: 'Escalation is the last graded step and the one that most often runs ' +
        'out of clock. Rapid Response, provider at the bedside, higher level of ' +
        'care - name it and ask for it.'
    }
  };
  var PHASE_ORDER = ['prep', 'assess', 'interpret', 'intervene', 'communicate', 'escalate'];
  function phaseMeta(id) { return PHASES[lower(id)] || PHASES.intervene; }

  /**
   * buildRubric(sim) -> { steps:[rec], criticals:[rec], byId:{}, lookahead, total }
   * rec = { id, n, idx, rank, text, critical, phase, evidence, coachTip }
   *
   * `id` is derived from the packet's own step number, so a room event written
   * by one student resolves to the same step on everyone else's screen.
   * `rank` is the position among CRITICAL steps and is -1 for the rest, so the
   * gate never does arithmetic on the printed step numbers.
   */
  function buildRubric(sim) {
    var steps = arr(obj(sim).activitySteps);
    var out = [], criticals = [], byId = {};
    steps.forEach(function (s, i) {
      var v = obj(s);
      var n = numOr(v.n, i + 1);
      var rec = {
        id: 's' + n,
        n: n,
        idx: i,
        rank: -1,
        text: str(v.text),
        critical: !!v.critical,
        phase: PHASES[lower(v.phase)] ? lower(v.phase) : 'intervene',
        evidence: str(v.evidence),
        coachTip: str(v.coachTip)
      };
      if (rec.critical) { rec.rank = criticals.length; criticals.push(rec); }
      byId[rec.id] = rec;
      out.push(rec);
    });
    return {
      steps: out, criticals: criticals, byId: byId,
      lookahead: GATE_LOOKAHEAD, total: out.length
    };
  }

  /**
   * orderGate(rubric, doneIds, stepId) -> null | gate
   *
   * null means "this is fine". A gate names the PHASE of the earliest skipped
   * critical step and deliberately carries no step text at all.
   *
   * Only CRITICAL steps gate and only CRITICAL steps are gated. The packets end
   * with a non-critical housekeeping line ("Complete tasks within the 20-minute
   * simulation time", "Participate in debriefing") and flagging a student for
   * ticking that early would be a bug wearing a rubric.
   */
  function orderGate(rubric, doneIds, stepId) {
    var r = obj(rubric), done = obj(doneIds);
    var me = obj(r.byId)[str(stepId)];
    if (!me || !me.critical) { return null; }
    var look = numOr(r.lookahead, GATE_LOOKAHEAD);
    var blockers = arr(r.criticals).filter(function (c) {
      if (c.id === me.id || done[c.id]) { return false; }
      return (c.rank + look) < me.rank;
    });
    if (!blockers.length) { return null; }
    blockers.sort(function (a, b) { return a.rank - b.rank; });
    var top = blockers[0];
    return {
      phase: top.phase,
      label: phaseMeta(top.phase).label,
      count: blockers.length,
      skipped: blockers.length,
      myPhase: me.phase
    };
  }

  /** The coaching sentence for a held-back step. Names a phase and how much
   *  work is open in front of it - never the step, never its number. */
  function gateCoachLine(gate) {
    var g = obj(gate);
    var meta = phaseMeta(g.phase);
    var n = Math.max(1, numOr(g.count, 1));
    return meta.line + ' ' + (n === 1
      ? 'One graded step earlier in the packet is still open'
      : n + ' graded steps earlier in the packet are still open') +
      ', and this one sits below them in the order the proctor marks.';
  }

  /** Reading gate: an interpretation step the student has not opened the chart
   *  for. Same held-back interaction, different sentence - "you have not read
   *  it yet" is a different mistake from "you are out of order" and saying so
   *  is the entire teaching value. */
  function readGate(rubric, seen, stepId) {
    var r = obj(rubric), s = obj(seen);
    var me = obj(r.byId)[str(stepId)];
    if (!me || me.phase !== 'interpret') { return null; }
    if (s.labs || s.diagnostics) { return null; }
    return { kind: 'read' };
  }
  function readCoachLine() {
    return 'You have not opened the laboratory or diagnostic results yet. ' +
      'An interpretation step is marked on what you SAY the values mean, and ' +
      'the proctor can see that you never looked.';
  }

  /** The step the student should be working on: the earliest undone critical,
   *  falling back to the earliest undone step of any kind. */
  function nextStep(rubric, doneIds) {
    var done = obj(doneIds);
    var open = arr(obj(rubric).criticals).filter(function (c) { return !done[c.id]; });
    if (open.length) { return open[0]; }
    var any = arr(obj(rubric).steps).filter(function (c) { return !done[c.id]; });
    return any.length ? any[0] : null;
  }

  /**
   * hintForTier(target, tier, ctx) -> {tier, title, body, weight}
   *
   * Tier 1 gives the PHASE and nothing else. Tier 2 gives why that phase is
   * time-critical right now. Only tier 3 names the step, and it names it in the
   * packet's own words plus the coach tip.
   *
   * Tiers 1 and 2 must never contain the step text. The test suite asserts
   * exactly that, because a "hint" that leaks the answer is just the answer
   * with a penalty attached.
   */
  function hintForTier(target, tier, ctx) {
    var t = clamp(Math.round(numOr(tier, 1)), 1, 3);
    var c = obj(ctx);
    var tgt = obj(target);
    var meta = phaseMeta(tgt.phase);
    var body;
    if (t === 1) {
      body = meta.line + ' The next mark on the sheet is a ' + meta.label.toUpperCase() +
        ' step. Work the packet in the order it is printed: preparation, assessment, ' +
        'interpretation, intervention, SBAR, escalation.';
    } else if (t === 2) {
      var left = numOr(c.secsLeft, -1);
      var when = left >= 0
        ? ' You have ' + fmtClock(left) + ' left on the clock.'
        : '';
      body = meta.why + when;
    } else {
      body = str(tgt.text) +
        (tgt.coachTip ? ' ' + str(tgt.coachTip) : '') +
        (tgt.evidence ? ' The proctor is looking for: ' + str(tgt.evidence) + '.' : '');
    }
    return {
      tier: t,
      weight: t,
      title: t === 3 ? 'Hint 3/3 - the step'
        : (t === 2 ? 'Hint 2/3 - why it matters now' : 'Hint 1/3 - the phase'),
      body: body
    };
  }

  /* ==========================================================================
   * 5. THE RUN - a pure fold over an event list
   * --------------------------------------------------------------------------
   * Solo keeps the list in memory. A room keeps it in RTDB under /events and
   * every client folds the same list in push-key order, so the clock, the
   * pause, the marks and the log are shared without a host engine and without a
   * single line of merge logic.
   *
   * Nothing in here reads the wall clock. `startedAt`, `pausedAt` and
   * `pausedMs` are timestamps carried in state and elapsed time is DERIVED from
   * them, so a backgrounded tab cannot drift and resume cannot fast-forward.
   * ======================================================================== */

  var EV_START = 'start', EV_STEP = 'step', EV_CHART = 'chart', EV_HINT = 'hint',
      EV_ERROR = 'error', EV_UNERROR = 'unerror', EV_SBAR = 'sbar', EV_ASK = 'ask',
      EV_SAY = 'say', EV_PAUSE = 'pause', EV_RESUME = 'resume', EV_END = 'end',
      EV_NOTE = 'note';

  function initialRun(opts) {
    var o = obj(opts);
    return {
      simId: str(o.simId),
      durationSec: Math.max(0, Math.round(numOr(o.durationSec, 0))),
      startedAt: numOr(o.startedAt, 0),
      paused: false,
      pausedAt: 0,
      pausedMs: 0,
      pauseCount: 0,
      done: {},          // stepId -> {verdict:'good'|'mid', by, byName, atSec}
      order: [],         // stepIds in the order they were performed
      seen: {},          // chart tab id -> true
      hints: [],         // {stepId, tier, by, atSec}
      errors: [],        // {idx, text, by, byName, atSec}
      sbar: null,        // {situation, background, assessment, recommendation, by, atSec}
      log: [],
      ended: false,
      endedReason: ''
    };
  }

  /** Elapsed simulated-lab time in ms, derived - never accumulated. */
  function elapsedMs(run, now) {
    var r = obj(run);
    if (!r.startedAt) { return 0; }
    var n = numOr(now, nowMs());
    var held = numOr(r.pausedMs, 0) +
      (r.paused && r.pausedAt ? Math.max(0, n - r.pausedAt) : 0);
    return Math.max(0, n - r.startedAt - held);
  }
  function elapsedSec(run, now) { return Math.floor(elapsedMs(run, now) / 1000); }
  /** Seconds left, or null when the packet states no time limit. */
  function remainingSec(run, now) {
    var r = obj(run);
    if (!numOr(r.durationSec, 0)) { return null; }
    return Math.max(0, r.durationSec - elapsedSec(r, now));
  }
  function expired(run, now) {
    var left = remainingSec(run, now);
    return left !== null && left <= 0;
  }

  function pushLog(run, kind, text, detail, at) {
    run.log = run.log.concat([{
      key: uid('l'), kind: str(kind), text: str(text),
      detail: str(detail || ''), atSec: Math.max(0, Math.round(numOr(at, 0)))
    }]);
  }

  /**
   * applyEvent(run, evt) -> run'
   * Pure, total, and tolerant of anything RTDB hands back. An event it does not
   * recognise is ignored rather than thrown on: a client running an older build
   * must degrade to "did not see that" and never to a white screen.
   */
  function applyEvent(run, evt) {
    var r = shallow(obj(run));
    var e = obj(evt);
    var t = str(e.t);
    var at = numOr(e.at, 0);
    var secs = r.startedAt && at ? Math.max(0, Math.floor((at - r.startedAt -
      numOr(r.pausedMs, 0)) / 1000)) : 0;
    var who = str(e.byName) || 'The nurse';

    if (t === EV_START) {
      r.startedAt = at || nowMs();
      r.paused = false; r.pausedAt = 0; r.pausedMs = 0; r.pauseCount = 0;
      r.log = [];
      pushLog(r, 'info', 'Simulation started.',
        (r.durationSec
          ? 'You have ' + Math.round(r.durationSec / 60) + ' minutes, the same as the lab.'
          : 'The packet states no time limit for this topic, so the clock counts up only.'), 0);
      return r;
    }
    if (!r.startedAt) { return r; }        // nothing lands before the start

    if (t === EV_STEP) {
      var id = str(e.id);
      if (!id || obj(r.done)[id]) { return r; }
      var verdict = (str(e.verdict) === 'mid') ? 'mid' : 'good';
      var nd = shallow(r.done);
      nd[id] = { verdict: verdict, by: str(e.by), byName: str(e.byName), atSec: secs };
      r.done = nd;
      r.order = r.order.concat([id]);
      pushLog(r, verdict === 'mid' ? 'warn' : 'good',
        who + ': ' + str(e.label || id) +
        (verdict === 'mid' ? '  (out of sequence)' : ''),
        str(e.detail || ''), secs);
      return r;
    }
    if (t === EV_CHART) {
      var tab = str(e.tab);
      if (!tab || obj(r.seen)[tab]) { return r; }
      var ns = shallow(r.seen);
      ns[tab] = true;
      r.seen = ns;
      return r;
    }
    if (t === EV_HINT) {
      r.hints = r.hints.concat([{
        stepId: str(e.id), tier: clamp(Math.round(numOr(e.tier, 1)), 1, 3),
        by: str(e.by), atSec: secs
      }]);
      return r;
    }
    if (t === EV_ERROR) {
      var idx = Math.round(numOr(e.idx, -1));
      if (idx < 0) { return r; }
      var dupe = r.errors.filter(function (x) { return x.idx === idx; }).length;
      if (dupe) { return r; }
      r.errors = r.errors.concat([{
        idx: idx, text: str(e.text), by: str(e.by), byName: str(e.byName), atSec: secs
      }]);
      pushLog(r, 'bad', 'CRITICAL ERROR marked: ' + cut(str(e.text), 110),
        'Marked by ' + who + '. Any entry on the packet\'s critical-error list is a ' +
        'hard fail in the lab, whatever else went right.', secs);
      return r;
    }
    if (t === EV_UNERROR) {
      var rid = Math.round(numOr(e.idx, -1));
      r.errors = r.errors.filter(function (x) { return x.idx !== rid; });
      pushLog(r, 'info', 'A critical-error mark was withdrawn.',
        'Withdrawn by ' + who + '.', secs);
      return r;
    }
    if (t === EV_SBAR) {
      var s = obj(e.sbar);
      r.sbar = {
        situation: str(s.situation), background: str(s.background),
        assessment: str(s.assessment), recommendation: str(s.recommendation),
        by: str(e.by), byName: str(e.byName), atSec: secs
      };
      pushLog(r, 'good', who + ' gave the SBAR report.', '', secs);
      return r;
    }
    if (t === EV_ASK) {
      pushLog(r, 'info', who + ' asked: "' + cut(str(e.text), 160) + '"', '', secs);
      return r;
    }
    if (t === EV_SAY) {
      pushLog(r, 'patient', 'PATIENT: "' + cut(str(e.text), 320) + '"', str(e.detail || ''), secs);
      return r;
    }
    if (t === EV_NOTE) {
      pushLog(r, str(e.kind) || 'info', str(e.text), str(e.detail || ''), secs);
      return r;
    }
    if (t === EV_PAUSE) {
      if (r.paused || r.ended) { return r; }
      r.paused = true;
      r.pausedAt = at || nowMs();
      r.pauseCount = numOr(r.pauseCount, 0) + 1;
      pushLog(r, 'info', 'Simulation paused' + (e.byName ? ' by ' + who : '') + '.',
        'The countdown is frozen. Nothing advances until somebody resumes.', secs);
      return r;
    }
    if (t === EV_RESUME) {
      if (!r.paused) { return r; }
      var held = r.pausedAt ? Math.max(0, (at || nowMs()) - r.pausedAt) : 0;
      r.paused = false;
      r.pausedAt = 0;
      r.pausedMs = numOr(r.pausedMs, 0) + held;
      pushLog(r, 'info', 'Simulation resumed.',
        'Paused for ' + fmtClock(held / 1000) + ' of real time. The countdown picks up ' +
        'exactly where it stopped - no time was skipped forward.', secs);
      return r;
    }
    if (t === EV_END) {
      if (r.ended) { return r; }
      r.ended = true;
      r.endedReason = str(e.reason) || 'ended';
      if (r.paused) {
        var h2 = r.pausedAt ? Math.max(0, (at || nowMs()) - r.pausedAt) : 0;
        r.paused = false; r.pausedAt = 0;
        r.pausedMs = numOr(r.pausedMs, 0) + h2;
      }
      r.endedAt = at || nowMs();
      pushLog(r, 'info', 'Simulation ended (' + r.endedReason + ').', '', secs);
      return r;
    }
    return r;
  }

  function foldEvents(base, events) {
    var run = base;
    arr(events).forEach(function (e) { run = applyEvent(run, e); });
    return run;
  }

  /* ==========================================================================
   * 6. PROCTOR SCORING
   * --------------------------------------------------------------------------
   * Scored against `activitySteps` and nothing else. Each step is marked done,
   * done out of sequence, or missed, exactly as it would be on the sheet. There
   * is no invented rubric, no partial credit inside a step, and no category the
   * packet does not have.
   * ======================================================================== */

  function scoreRun(sim, run) {
    var s = obj(sim);
    var r = obj(run);
    var rubric = buildRubric(s);
    var done = obj(r.done);

    var marks = rubric.steps.map(function (st) {
      var d = obj(done[st.id]);
      var verdict = d.verdict === 'good' ? 'done'
        : d.verdict === 'mid' ? 'out-of-sequence' : 'missed';
      return {
        id: st.id, n: st.n, text: st.text, critical: st.critical, phase: st.phase,
        evidence: st.evidence, coachTip: st.coachTip,
        verdict: verdict,
        atSec: numOr(d.atSec, null),
        by: str(d.byName)
      };
    });

    var doneCount = marks.filter(function (m) { return m.verdict === 'done'; }).length;
    var midCount = marks.filter(function (m) { return m.verdict === 'out-of-sequence'; }).length;
    var missed = marks.filter(function (m) { return m.verdict === 'missed'; });
    var criticalMissed = missed.filter(function (m) { return m.critical; });

    /* An out-of-sequence step was still performed; the packet marks it, so it
       carries half a mark rather than none. This is the only place in the file
       that weighs anything, and it weighs steps - not points, not categories. */
    var total = Math.max(1, rubric.total);
    var raw = (doneCount + midCount * 0.5) / total * 100;

    var hintWeight = arr(r.hints).reduce(function (n, h) {
      return n + clamp(Math.round(numOr(h.tier, 1)), 1, 3);
    }, 0);
    var hintPenalty = Math.min(HINT_CAP, hintWeight);
    var pct = Math.round(clamp(raw - hintPenalty, 0, 100));

    var packetErrors = arr(s.criticalErrors);
    var errors = arr(r.errors).map(function (e) {
      return {
        idx: e.idx,
        text: str(e.text) || str(packetErrors[e.idx]) || 'Critical error',
        by: str(e.byName), atSec: numOr(e.atSec, null)
      };
    });

    var hardFail = errors.length > 0;
    var reasons = [];
    errors.forEach(function (e) {
      reasons.push('Critical error observed: ' + e.text);
    });
    criticalMissed.forEach(function (m) {
      reasons.push('Critical step ' + m.n + ' not performed: ' + m.text);
    });
    if (!hardFail && pct < PASS_PCT && !criticalMissed.length) {
      reasons.push('Overall step completion ' + pct + '% is below the ' + PASS_PCT +
        '% the checkoff expects.');
    }

    var verdict = hardFail ? 'fail'
      : (criticalMissed.length || pct < PASS_PCT) ? 'not-yet' : 'pass';

    return {
      simId: str(s.id),
      marks: marks,
      total: rubric.total,
      criticalTotal: rubric.criticals.length,
      done: doneCount,
      outOfSequence: midCount,
      missed: missed.length,
      criticalMissed: criticalMissed,
      hintsUsed: arr(r.hints).length,
      hintPenalty: hintPenalty,
      pct: pct,
      rawPct: Math.round(raw),
      errors: errors,
      hardFail: hardFail,
      passed: verdict === 'pass',
      verdict: verdict,
      reasons: reasons,
      timeSec: elapsedSec(r, numOr(r.endedAt, nowMs())),
      overtime: !!(numOr(r.durationSec, 0) &&
        elapsedSec(r, numOr(r.endedAt, nowMs())) > r.durationSec),
      pausedMs: numOr(r.pausedMs, 0),
      pauseCount: numOr(r.pauseCount, 0),
      sbar: r.sbar || null,
      expectedSbar: obj(s.expectedSbar)
    };
  }

  var VERDICT_META = {
    pass: { label: 'PASS', cls: 'pass',
      line: 'You performed every critical step on the sheet with no critical errors. ' +
        'That is a pass on this packet.' },
    'not-yet': { label: 'NOT YET', cls: 'notyet',
      line: 'Not a fail - a not-yet. The steps below that are marked missed are the ' +
        'ones between you and the checkoff.' },
    fail: { label: 'HARD FAIL', cls: 'fail',
      line: 'A critical error was observed. In the lab that ends the checkoff on the spot, ' +
        'whatever else went right, so it ends it here too.' }
  };

  /* ==========================================================================
   * 7. PAUSE CONTROL (shared convention)
   * --------------------------------------------------------------------------
   * Verb for verb what js/sim-engine.js and js/ai-scenario.js expose, so the
   * shell - or a parent, or a test - can pause whatever is running without
   * knowing which engine it is:
   *
   *   pause(reason)  resume()  togglePause()  -> bool
   *   isPaused()     canPause()               -> bool
   *   onPauseChange(cb) -> off()              -> cb(paused, stats)
   *   pauseStats() -> {active,paused,pauseCount,pausedMs,pausedSec,mode,simSec}
   *
   * Bundled as `.pauseControl` and registered in window.MMPause under the id
   * 'ms2lab'. The controller is written in by the mounted runner and cleared on
   * unmount: nothing here outlives the component and nothing here ticks.
   * ======================================================================== */

  function createPauseHub(id) {
    var host = null;
    var subs = [];
    function stats() {
      if (!host) {
        return { active: false, paused: false, pauseCount: 0, pausedMs: 0,
          pausedSec: 0, mode: '', simSec: 0 };
      }
      return host.stats();
    }
    function emit() {
      var snap = stats();
      subs.slice().forEach(function (fn) { try { fn(!!snap.paused, snap); } catch (e) {} });
    }
    var hub = {
      id: str(id) || 'ms2lab',
      pauseRun: function (reason) { return !!(host && host.pause(reason)); },
      resumeRun: function () { return !!(host && host.resume()); },
      togglePauseRun: function () { return !!(host && host.toggle()); },
      isRunPaused: function () { return !!(host && host.isPaused()); },
      canPauseRun: function () { return !!(host && host.canPause()); },
      pauseStats: stats,
      onPauseChange: function (cb) {
        if (!isFn(cb)) { return function () {}; }
        subs.push(cb);
        return function () {
          subs = subs.filter(function (f) { return f !== cb; });
        };
      },
      _attach: function (h) {
        host = h; emit();
        return function () { if (host === h) { host = null; emit(); } };
      },
      _changed: emit
    };
    hub.pauseControl = {
      id: hub.id,
      isActive: function () { return !!host; },
      isPaused: hub.isRunPaused,
      canPause: hub.canPauseRun,
      pause: hub.pauseRun,
      resume: hub.resumeRun,
      toggle: hub.togglePauseRun,
      stats: hub.pauseStats,
      subscribe: hub.onPauseChange
    };
    return hub;
  }

  function registerPauseControl(ctl) {
    try {
      var reg = window.MMPause;
      if (!reg || typeof reg !== 'object') { reg = window.MMPause = {}; }
      if (!reg.controls || typeof reg.controls !== 'object') { reg.controls = {}; }
      if (!isFn(reg.register)) {
        reg.register = function (c) { if (c && c.id) { reg.controls[c.id] = c; } return c; };
        reg.get = function (k) { return obj(reg.controls)[str(k)] || null; };
        reg.all = function () {
          return keysOf(reg.controls).map(function (k) { return reg.controls[k]; });
        };
        reg.pauseAll = function (why) {
          reg.all().forEach(function (c) { try { c.pause(why); } catch (e) {} });
        };
        reg.resumeAll = function () {
          reg.all().forEach(function (c) { try { c.resume(); } catch (e) {} });
        };
      }
      reg.register(ctl);
    } catch (e) {}
  }

  var labPause = createPauseHub('ms2lab');
  registerPauseControl(labPause.pauseControl);

  /* The stylesheet goes in at load, not at first render. A page that mounts and
     paints before its CSS exists is a page that flashes unstyled, and a test
     that asserts on the injected rules should not have to mount a component
     first. MS2LabMode calls it again on render; injectStyles() is idempotent. */
  injectStyles();

  /* ==========================================================================
   * 8. THE AI PROCTOR
   * --------------------------------------------------------------------------
   * One convention, borrowed whole from js/ai-scenario.js: MM.ai.chat() onto
   * the /api/ai Netlify function, strict-JSON replies, completeTruncatedJSON()
   * salvage, one low-temperature repair attempt, hard token caps, and feature
   * tags that the server routes through tiers[t].featureModels[f].
   *
   * The AI plays two parts and neither of them may contradict the packet. The
   * chart, the labs, the orders, the MAR, the vitals and the rubric go into the
   * system prompt as FIXED GROUND TRUTH, and the model is told in as many words
   * that inventing a value is the one unrecoverable error. Everything it
   * returns is advisory: the rubric score is computed locally from
   * `activitySteps` and the AI cannot move it.
   * ======================================================================== */

  /* Feature tags. These are real ids from KNOWN_FEATURES in js/ai.js and
     netlify/functions/ai.js - an id those lists do not know is silently filed
     as 'other' and loses its per-tier model routing, so no new one is invented
     here. */
  var F_PATIENT = 'patient';   // the patient's voice
  var F_SBAR    = 'sbar';      // reading the handoff
  var F_DEBRIEF = 'debrief';   // the closing teaching paragraph

  /* Ceilings are set for the worst case, not the average: a reply that hits the
     ceiling is not "slightly long", it is unparseable. Unused ceiling costs
     nothing - generation stops at the closing brace either way. */
  var PATIENT_MAX_TOKENS = 700;
  var SBAR_MAX_TOKENS    = 1400;
  var DEBRIEF_MAX_TOKENS = 1200;
  var REPAIR_MAX_TOKENS  = 1800;
  var PATIENT_TEMP = 0.6;
  var GRADE_TEMP   = 0.2;
  var REPAIR_TEMP  = 0.2;

  var REPAIR_MESSAGE = 'That reply was not valid JSON. Reply again with the same content ' +
    'as a single JSON object and nothing else - no prose, no markdown fence, no trailing text.';

  function aiReady() {
    var ai = aiApi();
    if (!isFn(ai.chat)) { return false; }
    if (!isFn(ai.isAvailable)) { return true; }
    try { return !!ai.isAvailable(); } catch (e) { return false; }
  }

  function stripFences(s) {
    return str(s).replace(/^\s*```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  function outermostObject(s) {
    var t = str(s);
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    return (a !== -1 && b > a) ? t.slice(a, b + 1) : '';
  }

  /** parseJsonReply(raw) -> object|null. The raw reply is tried FIRST, because
   *  a well-formed reply is the common case and any rewriting can only damage
   *  it. Only then do we start guessing. */
  function parseJsonReply(raw) {
    if (raw && typeof raw === 'object' && !arr(raw).length && !(raw instanceof Array)) {
      if (Object.prototype.toString.call(raw) === '[object Object]') { return raw; }
    }
    var whole = str(raw).trim();
    if (!whole) { return null; }
    var tries = [whole, stripFences(whole), outermostObject(whole),
      outermostObject(stripFences(whole))];
    var i, v;
    for (i = 0; i < tries.length; i++) {
      if (!tries[i]) { continue; }
      try {
        v = JSON.parse(tries[i]);
        if (v && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]') {
          return v;
        }
      } catch (e) { /* next shape */ }
    }
    /* trailing-comma repair, the other cheap one */
    try {
      v = JSON.parse(str(tries[2] || whole).replace(/,\s*([}\]])/g, '$1'));
      if (v && typeof v === 'object') { return v; }
    } catch (e) {}
    return null;
  }

  /**
   * completeTruncatedJSON(raw) - best-effort recovery of a JSON object cut off
   * mid-generation by a token ceiling. Find the outermost '{', walk it tracking
   * string/escape state and bracket depth, then append the closers the walk
   * still owes. A field that was mid-word when the cut happened stays clipped -
   * that is cosmetic - but no field is ever invented.
   */
  function completeTruncatedJSON(raw) {
    var s = str(raw);
    var start = s.indexOf('{');
    if (start === -1) { return null; }
    s = s.slice(start).replace(/```\s*$/, '');

    var inStr = false, esc = false, stack = [], i, ch;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      if (esc) { esc = false; continue; }
      if (ch === '\\') { if (inStr) { esc = true; } continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) { continue; }
      if (ch === '{') { stack.push('}'); }
      else if (ch === '[') { stack.push(']'); }
      else if (ch === '}' || ch === ']') {
        if (stack.length && stack[stack.length - 1] === ch) { stack.pop(); }
        else { return null; }   // structurally broken beyond truncation
      }
    }
    if (!stack.length && !inStr) { return null; }   // it was complete; failure is elsewhere

    var fixed = s;
    if (inStr) { fixed += '"'; }
    fixed = fixed.replace(/[,:]\s*$/, '');
    while (stack.length) { fixed += stack.pop(); }

    var parsed = null;
    try { parsed = JSON.parse(fixed); } catch (e) { return null; }
    if (!parsed || typeof parsed !== 'object') { return null; }
    /* only accept a salvage that still carries something usable */
    var hasCore = !!(str(parsed.say) || str(parsed.comment) || str(parsed.verdict) ||
      arr(parsed.missedFacts).length || typeof parsed.score === 'number');
    return hasCore ? parsed : null;
  }

  /**
   * askJson(opts) -> Promise<object|null>
   * Never rejects. A null return means "the AI could not answer this turn",
   * which every caller handles by degrading rather than by stopping.
   */
  function askJson(opts) {
    var o = obj(opts);
    var ai = aiApi();
    if (!isFn(ai.chat)) { return Promise.resolve(null); }

    var budget = Math.max(200, Math.round(numOr(o.maxTokens, PATIENT_MAX_TOKENS)));
    var base = {
      system: str(o.system),
      messages: arr(o.messages),
      feature: str(o.feature) || F_PATIENT,
      json: true
    };

    var first;
    try {
      first = ai.chat({
        system: base.system, messages: base.messages, feature: base.feature,
        maxTokens: budget, temperature: numOr(o.temperature, PATIENT_TEMP), json: true
      });
    } catch (e) {
      /* ai.chat throwing SYNCHRONOUSLY is what turns a failed turn into a hang:
         the caller's .then never runs and the panel sits busy forever. */
      return Promise.resolve(null);
    }

    return Promise.resolve(first).then(function (raw) {
      var parsed = parseJsonReply(raw);
      if (parsed) { return parsed; }
      var salvaged = completeTruncatedJSON(str(raw));
      if (salvaged) { return salvaged; }
      /* One repair at low temperature, ALWAYS at the bigger ceiling: resending
         the same budget just truncates the repair identically. */
      var repair = base.messages.concat([
        { role: 'assistant', content: str(raw).slice(0, 1200) || '(empty reply)' },
        { role: 'user', content: REPAIR_MESSAGE }
      ]);
      return Promise.resolve(ai.chat({
        system: base.system, messages: repair, feature: base.feature,
        maxTokens: REPAIR_MAX_TOKENS, temperature: REPAIR_TEMP, json: true
      })).then(function (raw2) {
        return parseJsonReply(raw2) || completeTruncatedJSON(str(raw2));
      }, function () { return null; });
    }, function () { return null; });
  }

  /* ---- ground truth ------------------------------------------------------
   * Everything the model is allowed to know, in the packet's own words. This
   * block is the difference between an AI that helps and an AI that quietly
   * teaches the student a set of vitals their proctor has never heard of.
   * ---------------------------------------------------------------------- */
  function groundTruth(sim) {
    var s = obj(sim);
    var c = obj(s.chart);
    var lines = [];
    lines.push('COURSE: ' + str(s.course) + ' - ' + str(s.courseTitle));
    lines.push('TOPIC: ' + str(s.topic));
    lines.push('CURRENT TIME IN THE SIMULATION: ' + str(s.currentTime));
    lines.push('');
    lines.push('CASE: ' + str(s.caseOverview));
    lines.push('');
    lines.push('PATIENT CHART (verbatim):');
    lines.push('  Name ' + str(c.name) + ' | Age ' + str(c.age) + ' | DOB ' + str(c.dob) +
      ' | Sex ' + str(c.sex));
    lines.push('  Height ' + str(c.heightRaw) + ' | Weight ' + str(c.weightKg) + ' kg');
    lines.push('  Allergies: ' + (arr(c.allergies).join(', ') || 'none charted'));
    lines.push('  Code status: ' + str(c.codeStatus) + ' | Isolation: ' + str(c.isolation) +
      ' | Diet: ' + str(c.diet));
    lines.push('  Admitting diagnosis: ' + str(c.admittingDx));
    lines.push('  Admitted ' + str(c.admitDate) + ' | Unit: ' + str(c.facility));
    if (str(s.medicalHistory)) { lines.push('  History: ' + str(s.medicalHistory)); }

    if (arr(s.initialAssessment).length) {
      lines.push('');
      lines.push('INITIAL ASSESSMENT BY SYSTEM (verbatim):');
      arr(s.initialAssessment).forEach(function (a) {
        lines.push('  ' + str(obj(a).system) + ': ' + arr(obj(a).findings).join(', '));
      });
    }
    if (arr(s.vitals).length) {
      lines.push('');
      lines.push('VITAL SIGNS (verbatim - these are the ONLY vitals that exist):');
      arr(s.vitals).forEach(function (v) {
        var o2 = obj(v);
        lines.push('  ' + str(o2.at) + ': BP ' + str(o2.bp) + ' (MAP ' + str(o2.map) +
          '), HR ' + str(o2.hr) + ', RR ' + str(o2.rr) + ', Temp ' + str(o2.temp) +
          ', SpO2 ' + str(o2.spo2) + (str(o2.pain) ? ', Pain ' + str(o2.pain) : '') +
          ', LOC ' + str(o2.loc));
      });
    }
    if (arr(s.notes).length) {
      lines.push('');
      lines.push('NURSING NOTES:');
      arr(s.notes).forEach(function (n) {
        lines.push('  ' + str(obj(n).at) + ' - ' + str(obj(n).text));
      });
    }
    if (arr(s.providerOrders).length) {
      lines.push('');
      lines.push('PROVIDER ORDERS (verbatim, INCLUDING any that read oddly - do not correct them):');
      arr(s.providerOrders).forEach(function (o3) {
        lines.push('  - ' + str(obj(o3).text) + ' [' + str(obj(o3).category) + ']');
      });
    }
    if (arr(s.mar).length) {
      lines.push('');
      lines.push('MAR:');
      arr(s.mar).forEach(function (m) {
        lines.push('  ' + str(obj(m).at) + ' - ' + str(obj(m).text));
      });
    }
    if (arr(s.labs).length) {
      lines.push('');
      lines.push('LABS (value, then the normal range PRINTED IN THE PACKET):');
      arr(s.labs).forEach(function (l) {
        var o4 = obj(l);
        lines.push('  ' + str(o4.panel) + ' / ' + str(o4.name) + ': ' + str(o4.value) +
          '  (normal ' + str(o4.normalRange) + ')  [' + str(o4.status) + ']');
      });
    }
    if (arr(s.diagnostics).length) {
      lines.push('');
      lines.push('DIAGNOSTICS:');
      arr(s.diagnostics).forEach(function (d) {
        lines.push('  ' + str(obj(d).name) + ': ' + str(obj(d).finding));
      });
    }
    lines.push('');
    lines.push('THE GRADED ACTIVITY STEPS (this is the proctor\'s marking sheet, in order):');
    arr(s.activitySteps).forEach(function (a) {
      var o5 = obj(a);
      lines.push('  ' + numOr(o5.n, 0) + '. ' + str(o5.text) +
        (o5.critical ? '  [CRITICAL]' : '  [not critical]'));
    });
    lines.push('');
    lines.push('CRITICAL ERRORS (the packet\'s own list - any one of these ends the checkoff):');
    arr(s.criticalErrors).forEach(function (e) { lines.push('  - ' + str(e)); });
    if (str(s.sourceNote)) {
      lines.push('');
      lines.push('KNOWN DEFECTS AND CAVEATS IN THIS PACKET (surface them, never hide them): ' +
        str(s.sourceNote));
    }
    return lines.join('\n');
  }

  var GROUND_RULES = [
    '',
    '--- RULES THAT OUTRANK EVERYTHING ELSE ---',
    '1. THE PACKET IS THE TRUTH. The chart, vitals, labs, orders, MAR and rubric above are fixed. Never invent, adjust, round, extrapolate or "correct" a value. If the student asks for something the packet does not contain, say plainly that it is not charted.',
    '2. NEVER CONTRADICT THE PACKET. If real-world practice differs from what is charted, the charted value still stands and you may note the discrepancy as a teaching point - which is exactly what a defective order is for.',
    '3. STUDY AID ONLY. This is a nursing student rehearsing a school simulation checkoff. It is not patient care and you are not a licensed instructor.',
    '4. NEVER HAND OVER THE RUBRIC. Do not tell the student which activity step comes next, and do not list the steps. They are being marked on knowing that.',
    '5. STRICT JSON. Reply with a single JSON object and nothing else. No prose before or after, no markdown fence.'
  ].join('\n');

  function patientSystem(sim) {
    var s = obj(sim);
    var c = obj(s.chart);
    return [
      'You are ' + (str(c.name) || 'the patient') + ', a ' + str(c.age) + ' ' + str(c.sex) +
        ' in a nursing simulation lab, played for a student who is being checked off on the ' +
        'packet below. You speak ONLY as the patient - first person, plain words, the way a ' +
        'sick person actually talks. Short. Breathless or confused or in pain exactly as much ' +
        'as the charted assessment says you are, and no more.',
      '',
      'You answer what the patient could answer: symptoms, history, how you feel, what you ' +
        'remember. You do NOT know your lab values, you do NOT read the monitor for the ' +
        'student, and you do NOT coach. If the student asks something a patient could not ' +
        'know, say so in character.',
      '',
      groundTruth(s),
      GROUND_RULES,
      '',
      'REPLY SHAPE (exactly these keys):',
      '{"say":"<what the patient says out loud, 1-3 short sentences, first person>",' +
        '"observable":"<what the student would SEE or HEAR at the bedside right now, one ' +
        'sentence drawn only from the charted assessment, or an empty string>",' +
        '"offPacket":<true only if the question asked for something the packet does not contain>}'
    ].join('\n');
  }

  function sbarSystem(sim) {
    var s = obj(sim);
    return [
      'You are a clinical simulation proctor for ' + str(s.course) + ', reading a nursing ' +
        'student\'s SBAR handoff for the topic "' + str(s.topic) + '". You mark it against ' +
        'the packet and against the reference SBAR below, and you are specific, brief and ' +
        'fair. You never invent a fact the packet does not contain, and you never mark a ' +
        'student down for a value that is not in the packet.',
      '',
      groundTruth(s),
      '',
      'THE REFERENCE SBAR THIS PACKET EXPECTS:',
      'S: ' + str(obj(s.expectedSbar).situation),
      'B: ' + str(obj(s.expectedSbar).background),
      'A: ' + str(obj(s.expectedSbar).assessment),
      'R: ' + str(obj(s.expectedSbar).recommendation),
      GROUND_RULES,
      '',
      'REPLY SHAPE (exactly these keys):',
      '{"score":<0-100 integer for the SBAR alone>,' +
        '"situation":{"met":<bool>,"note":"<one sentence>"},' +
        '"background":{"met":<bool>,"note":"<one sentence>"},' +
        '"assessment":{"met":<bool>,"note":"<one sentence>"},' +
        '"recommendation":{"met":<bool>,"note":"<one sentence>"},' +
        '"missedFacts":["<a value or finding from the packet the report should have carried>"],' +
        '"strongest":"<one sentence on the best thing about the report>",' +
        '"comment":"<two sentences of coaching, no rubric steps named>"}'
    ].join('\n');
  }

  function debriefSystem(sim) {
    var s = obj(sim);
    return [
      'You are a clinical simulation instructor writing the closing teaching paragraph of a ' +
        'debrief for ' + str(s.course) + ', topic "' + str(s.topic) + '". The student has ' +
        'already been marked step by step by the app; the marks are final and you may not ' +
        'change them. Your job is the teaching, not the grade.',
      '',
      groundTruth(s),
      GROUND_RULES,
      '',
      'REPLY SHAPE (exactly these keys):',
      '{"comment":"<3-5 sentences: what the pattern of marks says about this student\'s ' +
        'clinical reasoning, in plain words, addressed to them as \\"you\\">",' +
        '"focus":["<a specific thing to drill before the real checkoff>"],' +
        '"nextRep":"<one sentence: what to do differently on the next run>"}'
    ].join('\n');
  }

  /** askPatient - never rejects; null means "run it without the patient voice". */
  function askPatient(sim, question, history) {
    if (!aiReady()) { return Promise.resolve(null); }
    var msgs = arr(history).slice(-6).concat([
      { role: 'user', content: 'The student at the bedside says: "' + cut(str(question), 500) + '"' }
    ]);
    return askJson({
      system: patientSystem(sim), messages: msgs, feature: F_PATIENT,
      maxTokens: PATIENT_MAX_TOKENS, temperature: PATIENT_TEMP
    }).then(function (p) {
      if (!p) { return null; }
      return {
        say: cut(str(p.say), 600),
        observable: cut(str(p.observable), 400),
        offPacket: !!p.offPacket
      };
    });
  }

  /** gradeSbar - never rejects; null means the local comparison stands alone. */
  function gradeSbar(sim, sbar) {
    if (!aiReady()) { return Promise.resolve(null); }
    var s = obj(sbar);
    var body = 'The student gave this SBAR:\n\nS: ' + (str(s.situation) || '(nothing said)') +
      '\nB: ' + (str(s.background) || '(nothing said)') +
      '\nA: ' + (str(s.assessment) || '(nothing said)') +
      '\nR: ' + (str(s.recommendation) || '(nothing said)');
    return askJson({
      system: sbarSystem(sim), messages: [{ role: 'user', content: body }],
      feature: F_SBAR, maxTokens: SBAR_MAX_TOKENS, temperature: GRADE_TEMP
    }).then(function (p) {
      if (!p) { return null; }
      function part(k) {
        var v = obj(p[k]);
        return { met: !!v.met, note: cut(str(v.note), 300) };
      }
      return {
        score: clamp(Math.round(numOr(p.score, 0)), 0, 100),
        situation: part('situation'), background: part('background'),
        assessment: part('assessment'), recommendation: part('recommendation'),
        missedFacts: arr(p.missedFacts).slice(0, 8).map(function (x) { return cut(str(x), 200); }),
        strongest: cut(str(p.strongest), 300),
        comment: cut(str(p.comment), 700)
      };
    });
  }

  /** aiDebrief - never rejects; null means the packet's own debrief stands. */
  function aiDebrief(sim, score) {
    if (!aiReady()) { return Promise.resolve(null); }
    var sc = obj(score);
    var body = 'Marks for this run:\n' + arr(sc.marks).map(function (m) {
      return '  ' + m.n + '. [' + m.verdict + ']' + (m.critical ? '[critical]' : '') + ' ' + m.text;
    }).join('\n') +
      '\n\nOverall ' + numOr(sc.pct, 0) + '%, verdict ' + str(sc.verdict) +
      ', hints used ' + numOr(sc.hintsUsed, 0) +
      ', time ' + fmtClock(numOr(sc.timeSec, 0)) +
      (arr(sc.errors).length
        ? '\nCritical errors observed: ' + arr(sc.errors).map(function (e) { return e.text; }).join(' | ')
        : '\nNo critical errors observed.');
    return askJson({
      system: debriefSystem(sim), messages: [{ role: 'user', content: body }],
      feature: F_DEBRIEF, maxTokens: DEBRIEF_MAX_TOKENS, temperature: GRADE_TEMP
    }).then(function (p) {
      if (!p) { return null; }
      return {
        comment: cut(str(p.comment), 1200),
        focus: arr(p.focus).slice(0, 5).map(function (x) { return cut(str(x), 200); }),
        nextRep: cut(str(p.nextRep), 300)
      };
    });
  }

  /* ==========================================================================
   * 9. PERSISTENCE
   * --------------------------------------------------------------------------
   * The result lands in three places, in descending order of how much we are
   * allowed to depend on it:
   *   1. progress.simResults via setProgress   - always works, local, primary
   *   2. MM.recordActivity('ms2lab', ...)      - the activity feed, if present
   *   3. /ms2lab/results/<uid>                 - cross-device history
   *
   * (3) HAS NO RULE IN firebase-rules.json TODAY. That file is not this
   * module's to edit, so the write is attempted, the denial is swallowed, and
   * the run is completely unaffected. MS2LabMode.RESULTS_RULES carries the
   * exact snippet that needs adding. Until it is added this is a silent no-op
   * and nothing else changes.
   * ======================================================================== */

  var RESULTS_PATH = 'ms2lab/results';
  var RESULTS_RULES = {
    ms2lab: {
      results: {
        '$uid': {
          '.read': "auth != null && (auth.uid === $uid || (auth.token.email === 'codingky@gmail.com' && auth.token.email_verified === true))",
          '.write': 'auth != null && auth.uid === $uid',
          '.indexOn': ['date']
        }
      }
    }
  };

  function persistResult(sim, score, run, ctx) {
    var s = obj(sim), sc = obj(score), c = obj(ctx);
    var rec = {
      simId: str(s.id),
      date: new Date().toISOString(),
      course: str(s.course),
      topic: cut(str(s.topic), 120),
      score: numOr(sc.pct, 0),
      maxScore: 100,
      pct: numOr(sc.pct, 0),
      rawPct: numOr(sc.rawPct, 0),
      timeSec: numOr(sc.timeSec, 0),
      stepsTotal: numOr(sc.total, 0),
      stepsDone: numOr(sc.done, 0),
      stepsOutOfSequence: numOr(sc.outOfSequence, 0),
      stepsMissed: numOr(sc.missed, 0),
      missedCritical: arr(sc.criticalMissed).map(function (m) {
        return 'Step ' + m.n + ': ' + cut(str(m.text), 140);
      }),
      errors: arr(sc.errors).map(function (e) { return cut(str(e.text), 200); }),
      criticalError: !!sc.hardFail,
      verdict: str(sc.verdict),
      passed: !!sc.passed,
      hintsUsed: numOr(sc.hintsUsed, 0),
      hintPenalty: numOr(sc.hintPenalty, 0),
      pausedMs: Math.round(numOr(sc.pausedMs, 0)),
      pauseCount: numOr(sc.pauseCount, 0),
      overtime: !!sc.overtime,
      durationMin: numOr(obj(run).durationSec, 0)
        ? Math.round(numOr(obj(run).durationSec, 0) / 60) : null,
      packetStatesDuration: numOr(s.durationMin, null) !== null,
      runMode: str(c.runMode) || 'solo',
      role: str(c.role) || '',
      roomId: str(c.roomId) || '',
      category: 'Med-Surg II Simulation Lab',
      mode: 'ms2lab'
    };

    var MM = MMx();
    var setP = isFn(c.setProgress) ? c.setProgress : MM.setProgress;
    if (isFn(setP)) {
      try {
        setP(function (prev) {
          var next = shallow(prev);
          next.simResults = arr(obj(prev).simResults).concat([rec]);
          return next;
        });
      } catch (e) {}
    }
    if (isFn(MM.recordActivity)) {
      try {
        MM.recordActivity('ms2lab', {
          simId: rec.simId, title: rec.topic, pct: rec.pct,
          verdict: rec.verdict, passed: rec.passed, runMode: rec.runMode
        });
      } catch (e) {}
    }
    /* Best effort, and genuinely optional - see RESULTS_RULES above. */
    var db = c.db || MM.db;
    var uidNow = str(c.uid);
    if (db && uidNow) {
      try {
        var p = db.ref(RESULTS_PATH + '/' + uidNow).push(rec);
        if (p && isFn(p.catch)) { p.catch(function () {}); }
      } catch (e) { /* permission denied is a non-event here */ }
    }
    return rec;
  }

  /** Best prior percentage for a topic, for the readiness bar on the picker. */
  function bestFor(progress, simId) {
    var rows = arr(obj(progress).simResults).filter(function (r) {
      return str(obj(r).simId) === str(simId) && str(obj(r).mode) === 'ms2lab';
    });
    if (!rows.length) { return null; }
    var best = 0, passed = false, n = rows.length;
    rows.forEach(function (r) {
      var p = numOr(r.pct, 0);
      if (p > best) { best = p; }
      if (r.passed) { passed = true; }
    });
    return { best: Math.round(best), passed: passed, attempts: n };
  }

  /* ==========================================================================
   * 10. ROOMS - Code Blue's infrastructure, reused as-is
   * --------------------------------------------------------------------------
   * There is exactly one room system in this app and it lives at
   * /codeblue/rooms/<CODE>. It already has: a four-letter code claimed with a
   * write-if-absent transaction, a /players roster with presence heartbeats
   * that only the owning uid may write, a write-once /events list, and a rule
   * block in firebase-rules.json. Building a second one would mean a second set
   * of rules, a second collision window and a second set of bugs.
   *
   * So this reuses it, with two deliberate differences:
   *
   *   status is 'ms2lab-open', never 'open'. Code Blue's lobby lists rooms
   *   filtered on status === 'open', so a simulation-lab room cannot appear in
   *   the Code Blue room list and no code student can walk into the wrong
   *   exercise from the wrong lobby.
   *
   *   there is no host engine. Nothing in a checkoff advances on its own, so
   *   every client folds the same /events list with applyEvent() and arrives at
   *   the same run. No authoritative writer, no heartbeat, no promotion.
   * ======================================================================== */

  var ROOM_BASE = 'codeblue/rooms';
  var ROOM_STATUS_OPEN = 'ms2lab-open';
  var ROOM_STATUS_DONE = 'ms2lab-done';
  var ROOM_STALE_MS = 3 * 60 * 60 * 1000;

  /* I, O, 0 and 1 are gone, for the same reason Code Blue dropped them: a code
     gets read aloud across a study table more often than it gets typed. */
  var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  function randCode() {
    var s = '', i;
    for (i = 0; i < 4; i++) {
      s += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
    }
    return s;
  }
  function normalizeCode(v) {
    return str(v).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  }
  function roomRef(db, id) { return db.ref(ROOM_BASE + '/' + id); }

  /**
   * The four roles a med-surg simulation actually runs with. Not code-team
   * roles - there is no compressor and no defibrillator here.
   */
  var LAB_ROLES = [
    { id: 'primary', label: 'Primary nurse',
      blurb: 'Performs the assessment and the interventions. This is the student being checked off.' },
    { id: 'second', label: 'Second nurse',
      blurb: 'Second pair of hands: gathers equipment, gets the vitals, makes the call.' },
    { id: 'recorder', label: 'Recorder',
      blurb: 'Runs the chart and writes the SBAR. Reads back what is ordered.' },
    { id: 'proctor', label: 'Student proctor',
      blurb: 'Marks the rubric and watches for critical errors. Does not touch the patient.' }
  ];
  function roleMeta(id) {
    var want = str(id), i;
    for (i = 0; i < LAB_ROLES.length; i++) { if (LAB_ROLES[i].id === want) { return LAB_ROLES[i]; } }
    return { id: '', label: 'Observer', blurb: 'Watching this run.' };
  }
  /** Only the proctor marks critical errors - unless nobody claimed the role,
   *  in which case the whole team is on the hook, which is also true in the lab. */
  function canMarkErrors(role, players) {
    if (str(role) === 'proctor') { return true; }
    var taken = keysOf(players).filter(function (k) {
      return str(obj(obj(players)[k]).role) === 'proctor' &&
        obj(obj(players)[k]).connected !== false;
    });
    return taken.length === 0;
  }
  /** The proctor is not the one performing steps. Soft, not enforced: a pair
   *  practising alone will swap roles mid-run and blocking that helps nobody. */
  function isHandsOn(role) { return str(role) !== 'proctor'; }

  /**
   * createLabRoom - claim a code with a write-if-absent transaction and retry
   * on collision. The transaction is what keeps this namespace safely shared
   * with Code Blue: neither module can ever claim a node the other holds.
   */
  function createLabRoom(db, cfg, myUid, myName, name, done) {
    if (!db) { done('This needs a connection to work.'); return; }
    var tries = 0;
    function attempt() {
      tries++;
      if (tries > 8) { done('Could not find a free room code. Try again in a moment.'); return; }
      var code = randCode();
      var ref = roomRef(db, code);
      var record = {
        code: code,
        name: cut(str(name) || ('MS2 Lab - ' + str(obj(cfg).topic)), 64),
        hostId: str(myUid),
        hostName: cut(str(myName) || 'Host', 32),
        createdAt: nowMs(),
        status: ROOM_STATUS_OPEN,
        cfg: cfg
      };
      var settled = false;
      function finish(err, committed) {
        if (settled) { return; }
        settled = true;
        if (err) { done('Could not create the room.'); return; }
        if (committed) { done(null, code); return; }
        attempt();
      }
      try {
        /* transaction() answers through a callback on the real SDK and through
           a promise on some doubles. Take whichever arrives - settling once is
           guarded, so hearing twice is harmless and hearing once is enough. */
        var tx = ref.transaction(function (cur) {
          /* Any child at all means the node is taken - including an orphaned
             /events from a room that was cleaned up badly. */
          if (cur !== null && cur !== undefined) { return undefined; }
          return record;
        }, finish);
        if (tx && isFn(tx.then)) {
          tx.then(function (res) { finish(null, !!obj(res).committed); },
            function () { finish(new Error('transaction failed')); });
        }
      } catch (e) { done('Could not create the room.'); }
    }
    attempt();
  }

  /**
   * useLabRoom(db, roomId, myUid, myName) -> {meta, players, events, err, ...}
   *
   * Subscribes field by field rather than to the whole room node: subscribing
   * to $roomId would stream /events back to every client on every write, which
   * is the single most expensive mistake this file could make.
   */
  function useLabRoom(db, roomId, myUid, myName) {
    var metaH = useState(null);
    var meta = metaH[0], setMeta = metaH[1];
    var playersH = useState({});
    var players = playersH[0], setPlayers = playersH[1];
    var evH = useState([]);
    var events = evH[0], setEvents = evH[1];
    var errH = useState('');
    var err = errH[0], setErr = errH[1];
    var deniedH = useState(false);
    var denied = deniedH[0], setDenied = deniedH[1];

    var seenRef = useRef({});
    var metaRef = useRef({});

    var patchMeta = useCallback(function (patch) {
      var n = shallow(metaRef.current), k;
      for (k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) { n[k] = patch[k]; }
      }
      metaRef.current = n;
      setMeta(n);
    }, []);

    useEffect(function () {
      if (!db || !roomId) { return undefined; }
      var base, hRef, sRef, pRef, eRef, onH, onS, onP, onE;
      try {
        base = roomRef(db, roomId);
        hRef = base.child('hostId');
        sRef = base.child('status');
        pRef = base.child('players');
        eRef = base.child('events');
      } catch (e) { setErr('Could not reach that room.'); return undefined; }

      try {
        onH = hRef.on('value', function (snap) { patchMeta({ hostId: str(snap.val()) }); },
          function () { setErr('Lost the connection to this room.'); });
        onS = sRef.on('value', function (snap) { patchMeta({ status: str(snap.val()) }); });
        base.child('cfg').once('value', function (snap) {
          patchMeta({ cfg: obj(snap.val()), cfgReady: true });
        }, function () { patchMeta({ cfgReady: true }); });
        base.child('hostName').once('value', function (snap) {
          patchMeta({ hostName: str(snap.val()) });
        });
        onP = pRef.on('value', function (snap) { setPlayers(obj(snap.val())); });
        /* child_added, not value: /events is append-only and write-once, so a
           full re-read on every submission would grow quadratically over a
           twenty-minute run with four students in the room. */
        onE = eRef.on('child_added', function (snap) {
          var k = str(snap.key);
          if (seenRef.current[k]) { return; }
          seenRef.current[k] = true;
          var v = obj(snap.val());
          v._k = k;
          setEvents(function (prev) {
            return prev.concat([v]).sort(function (a, b) {
              return str(a._k) < str(b._k) ? -1 : (str(a._k) > str(b._k) ? 1 : 0);
            });
          });
        });
      } catch (e) { setErr('Could not reach that room.'); }

      return function () {
        try { hRef.off('value', onH); } catch (e) {}
        try { sRef.off('value', onS); } catch (e) {}
        try { pRef.off('value', onP); } catch (e) {}
        try { eRef.off('child_added', onE); } catch (e) {}
      };
    }, [db, roomId, patchMeta]);

    /* ---- presence ---- */
    useEffect(function () {
      if (!db || !roomId || !myUid) { return undefined; }
      var me;
      try { me = roomRef(db, roomId).child('players').child(myUid); }
      catch (e) { return undefined; }
      /* clearInterval does not un-queue a callback already scheduled; without
         this flag a heartbeat in flight when the student leaves lands AFTER the
         cleanup and re-marks them connected, leaving a ghost in the roster. */
      var alive = true;
      function beat() {
        if (!alive) { return; }
        try {
          me.update({ name: cut(str(myName) || 'Student', 32), lastSeen: nowMs(), connected: true });
        } catch (e) {}
      }
      /* Announce first, ask questions afterwards: until /players/<uid> exists
         this student is not in anybody's roster. */
      beat();
      try {
        if (isFn(me.onDisconnect)) { me.onDisconnect().update({ connected: false }); }
      } catch (e) {}
      var iv = window.setInterval(beat, 15000);
      return function () {
        alive = false;
        window.clearInterval(iv);
        try { me.update({ connected: false, lastSeen: nowMs() }); } catch (e) {}
      };
    }, [db, roomId, myUid, myName]);

    var submit = useCallback(function (evt) {
      if (!db || !roomId) { return; }
      var payload = shallow(evt);
      payload.at = numOr(payload.at, nowMs());
      /* RTDB deletes undefined keys and rejects NaN outright, killing the whole
         write. Scrub before sending rather than after being surprised. */
      keysOf(payload).forEach(function (k) {
        var v = payload[k];
        if (v === undefined) { delete payload[k]; }
        else if (typeof v === 'number' && !isFinite(v)) { payload[k] = 0; }
      });
      try {
        var p = roomRef(db, roomId).child('events').push(payload);
        if (p && isFn(p.catch)) {
          p.catch(function () { setDenied(true); });
        }
      } catch (e) { setDenied(true); }
    }, [db, roomId]);

    var setRole = useCallback(function (role) {
      if (!db || !roomId || !myUid) { return; }
      try {
        roomRef(db, roomId).child('players').child(myUid).update({ role: str(role) });
      } catch (e) { setDenied(true); }
    }, [db, roomId, myUid]);

    var closeRoom = useCallback(function () {
      if (!db || !roomId) { return; }
      try { roomRef(db, roomId).child('status').set(ROOM_STATUS_DONE); } catch (e) {}
    }, [db, roomId]);

    var myRole = str(obj(obj(players)[myUid]).role);
    return {
      meta: obj(meta), players: obj(players), events: events,
      err: err, denied: denied,
      isHost: !!str(obj(meta).hostId) && str(obj(meta).hostId) === str(myUid),
      myRole: myRole,
      submit: submit, setRole: setRole, closeRoom: closeRoom
    };
  }

  /* ==========================================================================
   * 11. SHARED UI BITS
   * ======================================================================== */

  function Badge(props) {
    return ce('span', { className: 'ms2-badge ' + (props.tone || '') }, props.children);
  }

  function ContentMissing(props) {
    return ce('div', { className: 'ms2-root' },
      ce('div', { className: 'ms2-empty' },
        ce('div', { style: { fontSize: '2.2rem', marginBottom: 10 } }, '📄'),
        ce('h2', { style: { fontSize: '1.05rem', marginBottom: 8, color: 'var(--text,#e5e7eb)' } },
          'The simulation lab packets could not load'),
        ce('div', { style: { fontSize: '0.9rem', maxWidth: 460, margin: '0 auto 14px' } },
          'data/ms2lab.js did not download, so there is nothing to run. Check your ' +
          'connection and reload. Nothing else in the app is affected.'),
        ce('button', {
          type: 'button', className: 'ms2-btn go',
          onClick: function () { try { window.location.reload(); } catch (e) {} }
        }, 'Reload')));
  }

  function SignedOut() {
    return ce('div', { className: 'ms2-root' },
      ce('div', { className: 'ms2-card' },
        ce('h3', null, '🩺  Med-Surg II Simulation Lab'),
        ce('p', { className: 'ms2-sub' },
          'The eight NUR2212C simulation packets, run the way the lab runs them: ' +
          'twenty minutes, the chart in front of you, and the packet\'s own activity ' +
          'steps as the marking sheet.'),
        ce('div', { className: 'ms2-banner', style: { marginTop: 12 } },
          'Sign in to run one. Your marks land on your dashboard, and a room lets your ' +
          'partner take the second nurse or the proctor seat.'),
        ce('div', { className: 'ms2-row', style: { marginTop: 12 } },
          ce('button', {
            type: 'button', className: 'ms2-btn go',
            onClick: function () { if (isFn(MMx().navigate)) { MMx().navigate('home'); } }
          }, 'Sign in from the account menu'))));
  }

  /** The packet's own caveats, shown rather than hidden. */
  function SourceNote(props) {
    var note = str(props.note);
    if (!note) { return null; }
    return ce('div', { className: 'ms2-note' },
      ce('b', { style: { display: 'block', marginBottom: 3 } },
        'About this packet - read it, you will meet it in the lab'),
      note);
  }

  /* ==========================================================================
   * 12. TOPIC PICKER
   * ======================================================================== */

  function Picker(props) {
    var p = obj(props);
    var sims = allSims();
    var progress = obj(p.progress);

    return ce('div', { className: 'ms2-root' },
      ce('div', { className: 'ms2-head' },
        ce('div', null,
          ce('h2', null, 'Med-Surg II Simulation Lab'),
          ce('p', { className: 'ms2-sub' },
            'NUR2212C. Eight topics, marked against the activity steps printed in your ' +
            'packet. Pass here and you have done exactly what the proctor is going to ask for.')),
        ce('div', { className: 'ms2-spacer' }),
        ce(Badge, { tone: 'acc' }, sims.length + ' topics')),

      ce('div', { className: 'ms2-grid' }, sims.map(function (s) {
        var best = bestFor(progress, s.id);
        var pct = best ? best.best : 0;
        var cls = 'ms2-ready' + (best && best.passed ? ' pass' : (pct >= 60 ? ' near' : ''));
        var crit = arr(s.activitySteps).filter(function (a) { return obj(a).critical; }).length;
        return ce('button', {
          key: s.id, type: 'button', className: 'ms2-topic',
          onClick: function () { if (isFn(p.onPick)) { p.onPick(s.id); } },
          'aria-label': str(s.topic) + '. ' + (best
            ? 'Best score ' + pct + ' percent over ' + best.attempts + ' attempts.'
            : 'Not attempted yet.')
        },
          ce('div', { className: 'ms2-row' },
            ce(Badge, { tone: 'acc' }, str(s.course)),
            ce(Badge, null, numOr(s.durationMin, null) === null
              ? 'no stated time' : numOr(s.durationMin, 0) + ' min'),
            ce(Badge, null, arr(s.activitySteps).length + ' steps'),
            crit ? ce(Badge, { tone: 'warn' }, crit + ' critical') : null),
          ce('div', { className: 'ms2-topic-t' }, str(s.topic)),
          ce('div', { className: 'ms2-topic-s' }, cut(str(s.caseOverview), 165)),
          ce('div', { className: cls }, ce('span', { style: { width: pct + '%' } })),
          ce('div', { className: 'ms2-dim' }, best
            ? ('Best ' + pct + '%  ·  ' + best.attempts + ' attempt' +
               (best.attempts === 1 ? '' : 's') +
               (best.passed ? '  ·  passed' : '  ·  not passed yet'))
            : 'Not attempted yet'));
      })),

      ce('div', { className: 'ms2-card', style: { marginTop: 14 } },
        ce('h3', null, 'How this is marked'),
        ce('p', { className: 'ms2-sub' },
          'Every topic is scored against the numbered activity steps in its own packet - ' +
          'each step done, done out of sequence, or missed. Nothing else is invented. ' +
          'Any entry on the packet\'s critical-error list ends the run as a hard fail, ' +
          'exactly as it would in the lab.'),
        ce('p', { className: 'ms2-sub' },
          'Out of sequence never costs you the step: the first attempt is held back with ' +
          'a coaching line, the control stays live, and a second activation performs it ' +
          'anyway and records it as out of sequence.')));
  }

  /* ==========================================================================
   * 13. PRE-BRIEF - the packet's own front matter
   * ======================================================================== */

  var DURATION_CHOICES = [15, 20, 25, 30, 0];

  function PreBrief(props) {
    var p = obj(props);
    var s = obj(p.sim);
    var packetMin = numOr(s.durationMin, null);

    var tickedH = useState({});
    var ticked = tickedH[0], setTicked = tickedH[1];
    var minsH = useState(packetMin === null ? 0 : packetMin);
    var mins = minsH[0], setMins = minsH[1];
    var modeH = useState('solo');
    var mode = modeH[0], setMode = modeH[1];

    var knowledge = arr(s.requiredKnowledge);
    var tickedCount = keysOf(ticked).filter(function (k) { return ticked[k]; }).length;
    var aiOk = aiReady();

    function toggle(i) {
      setTicked(function (prev) {
        var n = shallow(prev);
        n[i] = !n[i];
        return n;
      });
    }

    var MODES = [
      { id: 'solo', label: 'Solo', blurb: 'You against the rubric. No AI, no partner, no network.' },
      { id: 'ai', label: 'AI proctor', blurb: 'The AI plays the patient and reads your SBAR. It cannot contradict the packet.' },
      { id: 'room', label: 'With partners', blurb: 'A room your group joins by code. Primary nurse, second nurse, recorder, student proctor.' }
    ];

    return ce('div', { className: 'ms2-root' },
      ce('div', { className: 'ms2-head' },
        ce('button', { type: 'button', className: 'ms2-btn sm', onClick: p.onBack }, '‹ Topics'),
        ce('div', null,
          ce('h2', null, str(s.topic)),
          ce('p', { className: 'ms2-sub' }, str(s.course) + ' · ' + str(s.courseTitle))),
        ce('div', { className: 'ms2-spacer' })),

      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'Introduction'),
        ce('p', { className: 'ms2-sub' }, str(s.introduction))),

      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'End of Program Student Learning Outcomes'),
        ce('p', { className: 'ms2-dim' },
          'The six outcomes this simulation is mapped to, exactly as they are printed.'),
        ce('ol', { style: { margin: '8px 0 0', paddingLeft: 20 } },
          arr(s.outcomes).map(function (o) {
            return ce('li', { key: numOr(obj(o).n, 0), className: 'ms2-sub' }, str(obj(o).text));
          }))),

      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'Required knowledge - tick what you already have'),
        ce('p', { className: 'ms2-dim' },
          'This is the packet\'s own preparation list. It is a self-assessment, not a gate: ' +
          'you can start with none of it ticked, and the run will show you which of these ' +
          'you were actually short on.'),
        ce('div', { style: { marginTop: 8 } }, knowledge.map(function (k, i) {
          return ce('label', {
            key: i,
            style: {
              display: 'flex', gap: 9, alignItems: 'flex-start', padding: '6px 0',
              fontSize: 12.5, lineHeight: 1.5, cursor: 'pointer',
              color: 'var(--text,#e5e7eb)'
            }
          },
            ce('input', {
              type: 'checkbox', checked: !!ticked[i],
              onChange: function () { toggle(i); },
              style: { marginTop: 2, flex: '0 0 auto' }
            }),
            ce('span', null, str(k)));
        })),
        ce('div', { className: 'ms2-dim', style: { marginTop: 6 } },
          tickedCount + ' of ' + knowledge.length + ' ticked' +
          (tickedCount < knowledge.length
            ? '. The unticked ones are what to read tonight.'
            : '. Good - now prove it.'))),

      ce(SourceNote, { note: str(s.sourceNote) }),

      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'Time on the clock'),
        packetMin === null
          ? ce('div', null,
            ce('div', { className: 'ms2-banner warn' },
              'This packet does not state a simulation length. The other seven print ' +
              '20 minutes; this one prints nothing, so nothing is assumed on your behalf. ' +
              'Pick what your instructor told you, or run it untimed.'),
            ce('div', { className: 'ms2-row', style: { marginTop: 10 } },
              DURATION_CHOICES.map(function (m) {
                return ce('button', {
                  key: m, type: 'button', className: 'ms2-btn sm',
                  'aria-pressed': mins === m ? 'true' : 'false',
                  style: mins === m
                    ? { borderColor: 'var(--accent,#3b82f6)', background: 'var(--ms2-acc-bg)' }
                    : null,
                  onClick: function () { setMins(m); }
                }, m === 0 ? 'No limit' : m + ' min');
              })))
          : ce('div', { className: 'ms2-sub' },
            'The packet states ' + packetMin + ' minutes. That is the clock you get, ' +
            'and step ' + arr(s.activitySteps).length + ' is "complete tasks within the ' +
            packetMin + '-minute simulation time" - the clock is itself a graded step.')),

      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'How are you running it?'),
        ce('div', { className: 'ms2-roles' }, MODES.map(function (m) {
          var off = m.id === 'ai' && !aiOk;
          return ce('button', {
            key: m.id, type: 'button', className: 'ms2-role',
            'aria-pressed': mode === m.id ? 'true' : 'false',
            onClick: function () { setMode(m.id); }
          },
            ce('b', null, m.label + (off ? '  (unavailable)' : '')),
            ce('span', null, off
              ? 'AI is not available on your plan or is switched off. Pick solo - the ' +
                'rubric and the marking are identical.'
              : m.blurb));
        }))),

      ce('div', { className: 'ms2-row', style: { marginTop: 14 } },
        ce('button', {
          type: 'button', className: 'ms2-btn go',
          onClick: function () {
            if (isFn(p.onStart)) {
              p.onStart({
                mode: (mode === 'ai' && !aiOk) ? 'solo' : mode,
                durationMin: packetMin === null ? mins : packetMin,
                knowledgeTicked: tickedCount,
                knowledgeTotal: knowledge.length
              });
            }
          }
        }, mode === 'room' ? 'Set up the room ›' : 'Start the simulation ›'),
        ce('button', { type: 'button', className: 'ms2-btn', onClick: p.onBack }, 'Not yet')));
  }

  /* ==========================================================================
   * 14. THE CHART
   * --------------------------------------------------------------------------
   * Everything the student is handed, one keystroke apart. A student loses the
   * checkoff to fumbling for the potassium, so: eight fixed tabs, number keys
   * 1-8 jump straight to them, nothing is hidden behind an unlock, and the
   * printed normal range sits next to every value because that is what the
   * packet prints.
   * ======================================================================== */

  var CHART_TABS = [
    { id: 'patient', label: 'Patient' },
    { id: 'assessment', label: 'Assessment' },
    { id: 'vitals', label: 'Vitals' },
    { id: 'labs', label: 'Labs' },
    { id: 'diagnostics', label: 'Diagnostics' },
    { id: 'orders', label: 'Orders' },
    { id: 'mar', label: 'MAR' },
    { id: 'notes', label: 'Notes' }
  ];

  function labRowClass(status) {
    var s = lower(status);
    if (s === 'critical-high' || s === 'critical-low') { return 'crit'; }
    if (s === 'high' || s === 'low') { return 'abn'; }
    return '';
  }
  function labFlag(status) {
    var s = lower(status);
    if (s === 'critical-high') { return 'CRITICAL HIGH'; }
    if (s === 'critical-low') { return 'CRITICAL LOW'; }
    if (s === 'high') { return 'HIGH'; }
    if (s === 'low') { return 'LOW'; }
    return '';
  }

  function ChartPanel(props) {
    var p = obj(props);
    var s = obj(p.sim);
    var tab = str(p.tab) || 'patient';
    var onTab = isFn(p.onTab) ? p.onTab : function () {};
    var showWhy = !!p.showInterpretation;

    var panes = {};

    panes.patient = function () {
      var c = obj(s.chart);
      return ce('div', null,
        ce('dl', { className: 'ms2-kv' },
          ce('dt', null, 'Name'), ce('dd', null, str(c.name)),
          ce('dt', null, 'Age / DOB'), ce('dd', null, str(c.age) + '  ·  ' + str(c.dob)),
          ce('dt', null, 'Sex'), ce('dd', null, str(c.sex)),
          ce('dt', null, 'Height'), ce('dd', null, str(c.heightRaw) +
            (numOr(c.heightCm, 0) ? '  (' + numOr(c.heightCm, 0) + ' cm)' : '')),
          ce('dt', null, 'Weight'), ce('dd', null, str(c.weightKg) + ' kg'),
          ce('dt', null, 'Allergies'), ce('dd', null, arr(c.allergies).join(', ') || 'none charted'),
          ce('dt', null, 'Code status'), ce('dd', null, str(c.codeStatus)),
          ce('dt', null, 'Isolation'), ce('dd', null, str(c.isolation)),
          ce('dt', null, 'Diet'), ce('dd', null, str(c.diet)),
          ce('dt', null, 'Admitting Dx'), ce('dd', null, str(c.admittingDx)),
          ce('dt', null, 'Admitted'), ce('dd', null, str(c.admitDate) + '  ·  ' + str(c.facility)),
          ce('dt', null, 'Time now'), ce('dd', null, str(s.currentTime))),
        str(s.medicalHistory)
          ? ce('div', { style: { marginTop: 10 } },
            ce('span', { className: 'ms2-lbl' }, 'Medical history'),
            ce('div', { className: 'ms2-sub' }, str(s.medicalHistory)))
          : null,
        ce('div', { style: { marginTop: 10 } },
          ce('span', { className: 'ms2-lbl' }, 'Case overview'),
          ce('div', { className: 'ms2-sub' }, str(s.caseOverview))));
    };

    panes.assessment = function () {
      var list = arr(s.initialAssessment);
      if (!list.length) { return ce('div', { className: 'ms2-empty' }, 'No initial assessment charted.'); }
      return ce('div', null, list.map(function (a, i) {
        return ce('div', { key: i, className: 'ms2-li' },
          ce('b', { style: { display: 'block', fontSize: 12.5 } }, str(obj(a).system)),
          ce('span', { className: 'ms2-sub' }, arr(obj(a).findings).join(' · ')));
      }));
    };

    panes.vitals = function () {
      var list = arr(s.vitals);
      if (!list.length) { return ce('div', { className: 'ms2-empty' }, 'No vital signs charted.'); }
      return ce('div', { style: { overflowX: 'auto' } },
        ce('table', { className: 'ms2-tbl' },
          ce('thead', null, ce('tr', null,
            ce('th', null, 'Time'), ce('th', null, 'BP'), ce('th', null, 'MAP'),
            ce('th', null, 'HR'), ce('th', null, 'RR'), ce('th', null, 'Temp'),
            ce('th', null, 'SpO2'), ce('th', null, 'Pain'), ce('th', null, 'LOC'))),
          ce('tbody', null, list.map(function (v, i) {
            var o = obj(v);
            return ce('tr', { key: i, className: arr(o.flags).length ? 'abn' : '' },
              ce('td', null, str(o.at)), ce('td', null, str(o.bp)),
              ce('td', null, str(o.map)), ce('td', null, str(o.hr)),
              ce('td', null, str(o.rr)), ce('td', null, str(o.temp)),
              ce('td', null, str(o.spo2)), ce('td', null, str(o.pain) || '—'),
              ce('td', null, str(o.loc) +
                (arr(o.flags).length ? '  (' + arr(o.flags).join(', ') + ')' : '') +
                (str(o.note) ? '  ' + str(o.note) : '')));
          }))));
    };

    panes.labs = function () {
      var list = arr(s.labs);
      if (!list.length) { return ce('div', { className: 'ms2-empty' }, 'No laboratory results charted.'); }
      var panels = [], seen = {};
      list.forEach(function (l) {
        var pn = str(obj(l).panel) || 'Other';
        if (!seen[pn]) { seen[pn] = 1; panels.push(pn); }
      });
      return ce('div', null, panels.map(function (pn) {
        return ce('div', { key: pn, style: { marginBottom: 12 } },
          ce('span', { className: 'ms2-lbl' }, pn),
          ce('div', { style: { overflowX: 'auto' } },
            ce('table', { className: 'ms2-tbl' },
              ce('thead', null, ce('tr', null,
                ce('th', null, 'Test'), ce('th', null, 'Result'),
                ce('th', null, 'Normal (as printed)'), ce('th', null, ''))),
              ce('tbody', null, list.filter(function (l) {
                return (str(obj(l).panel) || 'Other') === pn;
              }).map(function (l, i) {
                var o = obj(l);
                return ce('tr', { key: i, className: labRowClass(o.status) },
                  ce('td', null, str(o.name)),
                  ce('td', null, ce('b', null, str(o.value))),
                  ce('td', { className: 'rng' }, str(o.normalRange)),
                  ce('td', null,
                    labFlag(o.status)
                      ? ce('span', {
                        className: 'ms2-badge ' +
                          (labRowClass(o.status) === 'crit' ? 'bad' : 'warn')
                      }, labFlag(o.status))
                      : null,
                    showWhy && str(o.interpretation)
                      ? ce('div', { className: 'ms2-dim', style: { marginTop: 3 } },
                        str(o.interpretation))
                      : null));
              })))));
      }));
    };

    panes.diagnostics = function () {
      var list = arr(s.diagnostics);
      if (!list.length) {
        return ce('div', { className: 'ms2-empty' },
          'This packet charts no imaging or diagnostic studies. That is not an oversight ' +
          'in the app - there is nothing printed.');
      }
      return ce('div', null, list.map(function (d, i) {
        var o = obj(d);
        return ce('div', { key: i, className: 'ms2-li' },
          ce('b', { style: { display: 'block', fontSize: 12.5 } }, str(o.name)),
          ce('span', { className: 'ms2-sub' }, str(o.finding)),
          showWhy && str(o.interpretation)
            ? ce('div', { className: 'ms2-dim', style: { marginTop: 4 } }, str(o.interpretation))
            : null);
      }));
    };

    panes.orders = function () {
      var list = arr(s.providerOrders);
      if (!list.length) { return ce('div', { className: 'ms2-empty' }, 'No provider orders charted.'); }
      return ce('div', null,
        ce('div', { className: 'ms2-dim', style: { marginBottom: 6 } },
          'Verbatim from the packet, including anything that reads oddly. Questioning an ' +
          'order you cannot safely carry out is a nursing action, not a typo to fix quietly.'),
        list.map(function (o, i) {
          return ce('div', { key: i, className: 'ms2-li' },
            ce('span', { className: 'ms2-badge' }, str(obj(o).category)),
            ce('span', { style: { marginLeft: 8 } }, str(obj(o).text)));
        }));
    };

    panes.mar = function () {
      var list = arr(s.mar);
      if (!list.length) { return ce('div', { className: 'ms2-empty' }, 'No medications charted.'); }
      return ce('div', null, list.map(function (m, i) {
        return ce('div', { key: i, className: 'ms2-li' },
          ce('span', { className: 'at' }, str(obj(m).at)),
          str(obj(m).text));
      }));
    };

    panes.notes = function () {
      var list = arr(s.notes);
      if (!list.length) { return ce('div', { className: 'ms2-empty' }, 'No nursing notes charted.'); }
      return ce('div', null, list.map(function (n, i) {
        return ce('div', { key: i, className: 'ms2-li' },
          ce('span', { className: 'at' }, str(obj(n).at)),
          str(obj(n).text));
      }));
    };

    var render = panes[tab] || panes.patient;

    return ce('div', { className: 'ms2-card' },
      ce('div', { className: 'ms2-tabs', role: 'tablist', 'aria-label': 'Patient chart' },
        CHART_TABS.map(function (t, i) {
          return ce('button', {
            key: t.id, type: 'button', className: 'ms2-tab', role: 'tab',
            'aria-selected': tab === t.id ? 'true' : 'false',
            onClick: function () { onTab(t.id); }
          }, t.label, ce('span', { className: 'k' }, i + 1));
        })),
      ce('div', { className: 'ms2-pane', role: 'tabpanel' }, render()));
  }

  /* ==========================================================================
   * 15. THE RUN
   * ======================================================================== */

  /** "Complete tasks within the 20-minute simulation time" - six of the eight
   *  packets end on this line. It is a real graded step, so it stays on the
   *  sheet and stays clickable, but you cannot claim it while the graded work
   *  is still open or after the clock has gone. */
  function isTimingStep(rec) {
    return /\bwithin\b[^.]*\bminute/i.test(str(obj(rec).text));
  }
  function isSbarStep(rec) {
    var r = obj(rec);
    return r.phase === 'communicate' && /\bsbar\b/i.test(str(r.text));
  }

  /** A one-line summary of what an assessment step actually turned up, built
   *  from the packet and nothing else. */
  function assessmentReveal(sim) {
    var s = obj(sim);
    var bits = arr(s.initialAssessment).map(function (a) {
      return str(obj(a).system) + ': ' + arr(obj(a).findings).join(', ');
    });
    var v = arr(s.vitals);
    var last = obj(v[v.length - 1]);
    if (last.at) {
      bits.push('Vitals at ' + str(last.at) + ': BP ' + str(last.bp) + ', HR ' + str(last.hr) +
        ', RR ' + str(last.rr) + ', Temp ' + str(last.temp) + ', SpO2 ' + str(last.spo2) +
        ', ' + str(last.loc));
    }
    return bits.join('  |  ');
  }
  /** What the labs are shouting, for an interpretation step. Abnormals only -
   *  the normals are on the Labs tab and repeating them is noise. */
  function interpretReveal(sim) {
    var s = obj(sim);
    var abn = arr(s.labs).filter(function (l) { return lower(obj(l).status) !== 'normal'; });
    if (!abn.length) { return 'Every charted value is inside the packet\'s printed range.'; }
    return abn.map(function (l) {
      return str(obj(l).name) + ' ' + str(obj(l).value) +
        ' (normal ' + str(obj(l).normalRange) + ')';
    }).join('  ·  ');
  }

  function Runner(props) {
    var p = obj(props);
    var s = obj(p.sim);
    var net = p.net && obj(p.net).active ? obj(p.net) : null;
    var myUid = str(p.uid) || str(MMx().myId) || 'local';
    var myName = cut(str(p.name) || 'Student', 32);
    var runMode = str(p.runMode) || 'solo';
    var role = str(p.role);
    var durationSec = Math.max(0, Math.round(numOr(p.durationMin, 0) * 60));

    var rubric = useMemo(function () { return buildRubric(s); }, [s]);

    /* ---- the event list ------------------------------------------------ */
    var localH = useState([]);
    var localEvents = localH[0], setLocalEvents = localH[1];
    var events = net ? arr(net.events) : localEvents;

    var run = useMemo(function () {
      return foldEvents(initialRun({ simId: str(s.id), durationSec: durationSec }), events);
    }, [events, s, durationSec]);
    var runRef = useRef(run);
    runRef.current = run;

    var emit = useCallback(function (evt) {
      var e = shallow(evt);
      e.at = nowMs();
      e.by = myUid;
      e.byName = myName;
      if (net) { net.submit(e); }
      else { setLocalEvents(function (prev) { return prev.concat([e]); }); }
    }, [net, myUid, myName]);
    var emitRef = useRef(emit);
    emitRef.current = emit;

    /* ---- local, per-student UI state ----------------------------------- */
    var armedH = useState(null);          // the held-back step, never shared
    var armed = armedH[0], setArmed = armedH[1];
    var fbH = useState(null);
    var feedback = fbH[0], setFeedback = fbH[1];
    var tabH = useState('patient');
    var chartTab = tabH[0], setChartTab = tabH[1];
    var hintH = useState({ id: '', tier: 0 });
    var hint = hintH[0], setHint = hintH[1];
    var panelH = useState('rubric');
    var panel = panelH[0], setPanel = panelH[1];
    var sbarH = useState({ situation: '', background: '', assessment: '', recommendation: '' });
    var sbarDraft = sbarH[0], setSbarDraft = sbarH[1];
    var askH = useState('');
    var askText = askH[0], setAskText = askH[1];
    var aiH = useState({ busy: false, degraded: false, why: '' });
    var aiState = aiH[0], setAiState = aiH[1];
    var sbarAiH = useState(null);
    var sbarAi = sbarAiH[0], setSbarAi = sbarAiH[1];
    var tickH = useState(0);
    var setTick = tickH[1];

    var pendingSbarRef = useRef(null);
    var armTimer = useRef(null);
    var fbTimer = useRef(null);
    var aliveRef = useRef(true);
    var startedRef = useRef(false);
    var finishedRef = useRef(false);
    var patientHistRef = useRef([]);

    var wantAi = runMode === 'ai';
    var reduce = reduceMotion();

    /* ---- clock --------------------------------------------------------- */
    var left = remainingSec(run, nowMs());
    var elapsed = elapsedSec(run, nowMs());
    var isExpired = expired(run, nowMs());
    var clockActive = !!run.startedAt && !run.paused && !run.ended;

    useEffect(function () {
      if (!clockActive) { return undefined; }
      /* The interval is DROPPED on pause and a fresh one starts on resume, and
         nothing here accumulates: it only asks the run what time it is. So a
         paused clock is frozen and a resumed one cannot catch up. */
      var id = window.setInterval(function () {
        setTick(function (n) { return n + 1; });
      }, 500);
      return function () { window.clearInterval(id); };
    }, [clockActive]);

    useEffect(function () {
      return function () {
        aliveRef.current = false;
        if (armTimer.current) { window.clearTimeout(armTimer.current); }
        if (fbTimer.current) { window.clearTimeout(fbTimer.current); }
      };
    }, []);

    /* Solo and AI runs start themselves. A room waits for somebody to press
       Start, because a checkoff that begins while half the group is still
       reading the chart is not a checkoff. */
    useEffect(function () {
      if (startedRef.current || run.startedAt) { return; }
      if (net) { return; }
      startedRef.current = true;
      emitRef.current({ t: EV_START });
    }, [net, run.startedAt]);

    /* ---- feedback ------------------------------------------------------ */
    function notice(tone, title, body) {
      setFeedback({ tone: str(tone), title: str(title), body: str(body), key: uid('f') });
      if (fbTimer.current) { window.clearTimeout(fbTimer.current); }
      fbTimer.current = window.setTimeout(function () {
        if (aliveRef.current) { setFeedback(null); }
      }, 11000);
    }
    function disarm() {
      if (armTimer.current) { window.clearTimeout(armTimer.current); armTimer.current = null; }
      setArmed(null);
    }

    /* ---- pause --------------------------------------------------------- */
    function pauseStatsNow() {
      var r = runRef.current;
      return {
        active: !r.ended, paused: !!r.paused, mode: runMode,
        pauseCount: numOr(r.pauseCount, 0),
        pausedMs: numOr(r.pausedMs, 0) +
          (r.paused && r.pausedAt ? Math.max(0, nowMs() - r.pausedAt) : 0),
        pausedSec: Math.floor((numOr(r.pausedMs, 0) +
          (r.paused && r.pausedAt ? Math.max(0, nowMs() - r.pausedAt) : 0)) / 1000),
        simSec: elapsedSec(r, nowMs())
      };
    }
    function doPause(reason) {
      var r = runRef.current;
      if (r.ended || r.paused || !r.startedAt) { return false; }
      disarm();
      emitRef.current({ t: EV_PAUSE, reason: str(reason || '') });
      announce('Simulation paused. The countdown is frozen.', false);
      return true;
    }
    function doResume() {
      var r = runRef.current;
      if (!r.paused) { return false; }
      emitRef.current({ t: EV_RESUME });
      announce('Simulation resumed.', false);
      return true;
    }
    function togglePause() {
      if (runRef.current.paused) { doResume(); return false; }
      doPause();
      return true;
    }
    var pauseApiRef = useRef(null);
    pauseApiRef.current = {
      isPaused: function () { return !!runRef.current.paused; },
      canPause: function () { return !runRef.current.ended && !!runRef.current.startedAt; },
      pause: function (r) { return doPause(r); },
      resume: function () { return doResume(); },
      toggle: function () { return togglePause(); },
      stats: function () { return pauseStatsNow(); }
    };
    useEffect(function () {
      return labPause._attach({
        isPaused: function () { return pauseApiRef.current.isPaused(); },
        canPause: function () { return pauseApiRef.current.canPause(); },
        pause: function (r) { return pauseApiRef.current.pause(r); },
        resume: function () { return pauseApiRef.current.resume(); },
        toggle: function () { return pauseApiRef.current.toggle(); },
        stats: function () { return pauseApiRef.current.stats(); }
      });
    }, []);
    useEffect(function () {
      labPause._changed();
    }, [run.paused, run.pauseCount, run.pausedMs, run.ended]);

    /* ---- keyboard: p pauses, 1-8 jump the chart ------------------------ */
    useEffect(function () {
      function typingTarget(el) {
        if (!el || typeof el !== 'object') { return false; }
        try {
          if (el.isContentEditable) { return true; }
          var tag = lower(el.tagName);
          if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option') {
            return true;
          }
          if (isFn(el.closest) && el.closest('input,textarea,select,[contenteditable="true"]')) {
            return true;
          }
        } catch (e) { return false; }
        return false;
      }
      function onKey(e) {
        if (e.altKey || e.ctrlKey || e.metaKey) { return; }
        if (typingTarget(e.target)) { return; }
        var k = str(e.key);
        if (k === 'p' || k === 'P') { e.preventDefault(); togglePause(); return; }
        if (/^[1-8]$/.test(k)) {
          var t = CHART_TABS[parseInt(k, 10) - 1];
          if (t) {
            e.preventDefault();
            setChartTab(t.id);
            setPanel('rubric');
            emitRef.current({ t: EV_CHART, tab: t.id });
          }
        }
      }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, []);

    function openTab(id) {
      setChartTab(id);
      emitRef.current({ t: EV_CHART, tab: id });
    }

    /* ---- performing a step --------------------------------------------- */
    function holdBack(rec, og, rg) {
      var coach = og ? gateCoachLine(og) : readCoachLine();
      if (armTimer.current) { window.clearTimeout(armTimer.current); }
      setArmed({ id: rec.id, key: uid('arm') });
      armTimer.current = window.setTimeout(function () {
        if (aliveRef.current) { setArmed(null); }
      }, ARM_MS);
      notice('mid', og ? 'Hold on - check the order' : 'Hold on - you have not read it yet',
        coach + ' This has NOT been recorded and you have not lost it. Do the earlier work ' +
        'first, or activate this step again within ' + Math.round(ARM_MS / 1000) +
        ' seconds to perform it anyway and take the out-of-sequence mark.');
      announce(coach + ' Step held back, not recorded.', true);
    }

    function commit(rec, verdict) {
      var detail = '';
      if (rec.phase === 'assess') { detail = assessmentReveal(s); }
      else if (rec.phase === 'interpret') { detail = interpretReveal(s); }
      else if (rec.evidence) { detail = 'Marked for: ' + rec.evidence; }

      emitRef.current({
        t: EV_STEP, id: rec.id, verdict: verdict,
        label: rec.n + '. ' + rec.text, detail: detail
      });
      setHint({ id: '', tier: 0 });

      if (verdict === 'mid') {
        notice('mid', 'Done - but out of sequence',
          'Recorded as out of sequence. That is your call to make and the step is not lost, ' +
          'but on the sheet it is half a mark and the proctor will ask you why.');
        announce('Step performed out of sequence.', true);
      } else if (rec.phase === 'assess') {
        notice('good', 'Assessment performed', detail || 'Findings gathered. Now say what they mean.');
      } else if (rec.phase === 'interpret') {
        notice('good', 'Interpretation recorded',
          'Say it out loud in the lab - the proctor marks what you verbalise. ' + detail);
      } else if (rec.phase === 'escalate') {
        notice('good', 'Care escalated', rec.coachTip || 'Escalation recorded.');
      } else {
        notice('good', 'Step ' + rec.n + ' recorded', rec.coachTip || '');
      }
    }

    function act(rec) {
      var r = runRef.current;
      if (r.ended) { return; }
      if (!r.startedAt) {
        notice('mid', 'Not started', 'Somebody needs to start the simulation first.');
        return;
      }
      if (r.paused) {
        notice('mid', 'The simulation is paused', 'Resume the clock to keep working.');
        return;
      }
      if (obj(r.done)[rec.id]) { return; }
      if (net && !isHandsOn(role) && !isTimingStep(rec)) {
        notice('mid', 'That is not your seat',
          'You claimed the student-proctor role. You mark the sheet and watch for critical ' +
          'errors; the primary and second nurse perform the steps. Change role in the room ' +
          'panel if you meant to be hands on.');
        return;
      }

      /* The timing line is a real graded step and a real claim. You cannot make
         it while graded work is open, and you cannot make it after the clock
         has gone - there is no override for either, because both would be
         documenting something that did not happen. */
      if (isTimingStep(rec)) {
        if (isExpired) {
          notice('bad', 'The clock has run out',
            'This step is marked missed. In the lab the proctor stops you here, and what ' +
            'is unfinished stays unfinished.');
          return;
        }
        var stillOpen = rubric.criticals.filter(function (c) { return !obj(r.done)[c.id]; });
        if (stillOpen.length) {
          notice('mid', 'Not finished yet',
            stillOpen.length + ' graded step' + (stillOpen.length === 1 ? ' is' : 's are') +
            ' still open, so you have not completed the tasks within the time. ' +
            'Come back to this line last.');
          return;
        }
      }

      var og = orderGate(rubric, r.done, rec.id);
      var rg = og ? null : readGate(rubric, r.seen, rec.id);
      if (og || rg) {
        var isArmed = !!(armed && armed.id === rec.id);
        if (!isArmed) { holdBack(rec, og, rg); return; }
        disarm();
      } else if (armed) {
        /* any other choice clears the armed state - an override has to be the
           very next thing you do, or it was not an override */
        disarm();
      }

      var verdict = (og || rg) ? 'mid' : 'good';

      if (isSbarStep(rec)) {
        /* The SBAR step is not a click, it is a report. Open the composer and
           commit when it is given. */
        setPanel('sbar');
        setArmed(null);
        pendingSbarRef.current = { rec: rec, verdict: verdict };
        notice('good', 'Give your SBAR',
          'Write the four parts. It is compared side by side with the report this packet ' +
          'expects, and in AI mode the proctor reads it.');
        return;
      }

      if (rec.phase === 'interpret' && !obj(r.seen).labs) { openTab('labs'); }
      commit(rec, verdict);
    }

    function submitSbar() {
      var pend = pendingSbarRef.current;
      var draft = sbarDraft;
      var any = str(draft.situation) || str(draft.background) ||
        str(draft.assessment) || str(draft.recommendation);
      if (!any) {
        notice('mid', 'Nothing to hand off',
          'An empty SBAR is a missed step. Say something in at least one of the four parts.');
        return;
      }
      emitRef.current({ t: EV_SBAR, sbar: draft });
      if (pend) {
        commit(pend.rec, pend.verdict);
        pendingSbarRef.current = null;
      }
      setPanel('rubric');
      if (wantAi && aiReady()) { runSbarGrade(draft); }
    }

    function runSbarGrade(draft) {
      setAiState({ busy: true, degraded: aiState.degraded, why: aiState.why });
      gradeSbar(s, draft).then(function (res) {
        if (!aliveRef.current) { return; }
        if (!res) {
          setAiState({ busy: false, degraded: true,
            why: 'The AI proctor could not read the SBAR. Your report is still saved and ' +
              'is shown next to the packet\'s reference report in the debrief.' });
          return;
        }
        setSbarAi(res);
        setAiState({ busy: false, degraded: false, why: '' });
        emitRef.current({
          t: EV_NOTE, kind: 'info',
          text: 'AI proctor read the SBAR: ' + numOr(res.score, 0) + '/100.',
          detail: str(res.comment)
        });
      });
    }

    /* ---- the patient answers ------------------------------------------- */
    function doAsk() {
      var q = str(askText).trim();
      if (!q) { return; }
      setAskText('');
      emitRef.current({ t: EV_ASK, text: q });
      if (!wantAi || !aiReady()) {
        emitRef.current({
          t: EV_NOTE, kind: 'info',
          text: 'Question logged. Without the AI proctor the patient does not answer here - ' +
            'the charted assessment is on the Assessment tab.'
        });
        return;
      }
      setAiState({ busy: true, degraded: false, why: '' });
      askPatient(s, q, patientHistRef.current).then(function (res) {
        if (!aliveRef.current) { return; }
        if (!res) {
          setAiState({ busy: false, degraded: true,
            why: 'The AI patient did not answer. Running as solo from here - the chart, ' +
              'the rubric and your marks are completely unaffected.' });
          return;
        }
        setAiState({ busy: false, degraded: false, why: '' });
        patientHistRef.current = patientHistRef.current.concat([
          { role: 'user', content: q },
          { role: 'assistant', content: JSON.stringify({ say: res.say }) }
        ]).slice(-8);
        emitRef.current({
          t: EV_SAY, text: res.say || 'I am not sure.',
          detail: res.observable || ''
        });
      });
    }

    /* ---- critical errors ----------------------------------------------- */
    var packetErrors = arr(s.criticalErrors);
    var markedIdx = {};
    arr(run.errors).forEach(function (e) { markedIdx[e.idx] = true; });
    var mayMark = !net || canMarkErrors(role, obj(p.players));

    function markError(i) {
      if (run.ended) { return; }
      if (markedIdx[i]) {
        emitRef.current({ t: EV_UNERROR, idx: i });
        return;
      }
      emitRef.current({ t: EV_ERROR, idx: i, text: str(packetErrors[i]) });
      notice('bad', 'Critical error recorded',
        'Any entry on this list ends the checkoff in the lab, so it ends this run as a hard ' +
        'fail too. If that was a mis-tap, tap it again to withdraw it before the debrief.');
      announce('Critical error marked.', true);
    }

    /* ---- hints ---------------------------------------------------------- */
    var target = nextStep(rubric, run.done);
    function askHint() {
      if (!target) { return; }
      var tier = (hint.id === target.id ? hint.tier : 0) + 1;
      if (tier > 3) { tier = 3; }
      var h = hintForTier(target, tier, { secsLeft: left === null ? -1 : left });
      setHint({ id: target.id, tier: tier });
      emitRef.current({ t: EV_HINT, id: target.id, tier: tier });
      notice(tier === 3 ? 'mid' : 'good', h.title, h.body +
        (tier < 3 ? '  (asking again costs more)' : ''));
    }

    /* ---- finishing ------------------------------------------------------ */
    function finish(reason) {
      if (finishedRef.current) { return; }
      finishedRef.current = true;
      emitRef.current({ t: EV_END, reason: str(reason) || 'ended' });
      var ended = applyEvent(runRef.current, { t: EV_END, at: nowMs(), reason: reason });
      if (isFn(p.onFinish)) { p.onFinish({ run: ended, sim: s, sbarAi: sbarAi }); }
    }
    useEffect(function () {
      if (run.ended && !finishedRef.current) {
        finishedRef.current = true;
        if (isFn(p.onFinish)) { p.onFinish({ run: run, sim: s, sbarAi: sbarAi }); }
      }
    }, [run.ended]);

    /* ---- render --------------------------------------------------------- */
    var doneCount = keysOf(run.done).length;
    var interpretedYet = !!run.ended || rubric.steps.filter(function (rec) {
      return rec.phase === 'interpret' && obj(run.done)[rec.id];
    }).length > 0;
    var clockCls = 'ms2-clock' + (isExpired ? ' out' : (left !== null && left <= 120 ? ' low' : ''));
    var clockText = left === null ? ('+' + fmtClock(elapsed)) : fmtClock(left);

    var bar = ce('div', { className: 'ms2-bar' },
      ce('div', null,
        ce('div', { className: clockCls, 'aria-label': 'Time remaining' },
          isExpired ? 'TIME' : clockText),
        ce('div', { className: 'ms2-dim' }, left === null
          ? 'no stated limit - counting up'
          : (isExpired ? 'the proctor would have stopped you' : 'remaining'))),
      ce('div', { className: 'ms2-prog' },
        doneCount + ' / ' + rubric.total + ' steps  ·  ' +
        rubric.criticals.filter(function (c) { return obj(run.done)[c.id]; }).length +
        ' / ' + rubric.criticals.length + ' critical'),
      arr(run.errors).length
        ? ce(Badge, { tone: 'bad' }, arr(run.errors).length + ' critical error' +
          (arr(run.errors).length === 1 ? '' : 's'))
        : null,
      ce('div', { className: 'ms2-spacer' }),
      ce(Badge, { tone: 'acc' }, runMode === 'room'
        ? ('Room ' + str(p.roomId) + (role ? ' · ' + roleMeta(role).label : ''))
        : (runMode === 'ai' ? 'AI proctor' : 'Solo')),
      ce('button', {
        type: 'button', className: 'ms2-btn sm', onClick: askHint, disabled: !target || run.ended
      }, 'Hint'),
      ce('button', {
        type: 'button', className: 'ms2-btn sm', onClick: togglePause,
        disabled: !run.startedAt || run.ended
      }, run.paused ? '▶ Resume' : '❚❚ Pause'),
      ce('button', {
        type: 'button', className: 'ms2-btn sm danger',
        onClick: function () { finish('student ended the run'); }
      }, 'End & debrief'));

    var stepList = ce('div', { className: 'ms2-card' },
      ce('h3', null, 'Activity steps - the marking sheet'),
      ce('p', { className: 'ms2-dim' },
        'Printed in your packet, in this order. Perform them; do not just read them. ' +
        'Nothing here is ever taken away from you by a mis-tap.'),
      ce('div', { className: 'ms2-steps', style: { marginTop: 10 } },
        rubric.steps.map(function (rec) {
          var d = obj(obj(run.done)[rec.id]);
          var used = str(d.verdict);
          var isArmed = !!(armed && armed.id === rec.id) && !used;
          var cls = 'ms2-step' +
            (used === 'good' ? ' done' : used === 'mid' ? ' usedmid' : '') +
            (isArmed ? ' outorder' : '');
          return ce('button', {
            key: rec.id + (isArmed ? '-' + armed.key : ''),
            type: 'button', className: cls,
            disabled: !!used,
            onClick: function () { act(rec); },
            'aria-label': 'Step ' + rec.n + '. ' + rec.text +
              (used === 'mid' ? ' (performed out of sequence)'
                : used ? ' (performed)' : '') +
              (isArmed ? ' - held back, activate again to perform it anyway' : '')
          },
            ce('span', { className: 'n' }, rec.n),
            ce('span', { style: { flex: '1 1 auto', minWidth: 0 } },
              ce('span', { className: 'txt' }, rec.text),
              ce('span', { className: 'sub' },
                phaseMeta(rec.phase).label + (rec.critical ? '  ·  critical' : '')),
              isArmed
                ? ce('span', { className: 'warn' },
                  '! Out of sequence. Tap again to do it anyway.')
                : null,
              used
                ? ce('span', { className: used === 'mid' ? 'warn' : 'sub' },
                  used === 'good' ? '✓ performed'
                    : '△ performed out of sequence')
                : null));
        })));

    var errorWatch = ce('div', { className: 'ms2-card' },
      ce('h3', null, 'Critical errors - the packet\'s own list'),
      ce('p', { className: 'ms2-dim' }, mayMark
        ? 'Any one of these ends the checkoff. Mark it the moment you see it - yours or your ' +
          'partner\'s. Tap a marked line again to withdraw it.'
        : 'The student proctor marks these. You can read them; they are the list you are ' +
          'being watched against.'),
      ce('div', { style: { marginTop: 8 } }, packetErrors.map(function (e, i) {
        var on = !!markedIdx[i];
        return ce('button', {
          key: i, type: 'button',
          className: 'ms2-errbtn' + (on ? ' usedmid' : ''),
          disabled: !mayMark || run.ended,
          onClick: function () { markError(i); },
          'aria-pressed': on ? 'true' : 'false'
        },
          ce('span', { className: 'n' }, on ? '✕' : '·'),
          ce('span', { style: { flex: '1 1 auto', minWidth: 0 } },
            ce('span', { className: 'txt' }, str(e)),
            on ? ce('span', { className: 'warn' }, 'Marked - this is a hard fail') : null));
      })));

    var sbarPanel = ce('div', { className: 'ms2-card' },
      ce('h3', null, 'SBAR handoff'),
      ce('p', { className: 'ms2-dim' },
        'Write it the way you would say it. It is shown next to the report this packet ' +
        'expects when you get to the debrief.'),
      ['situation', 'background', 'assessment', 'recommendation'].map(function (k) {
        return ce('div', { key: k },
          ce('span', { className: 'ms2-lbl' }, k),
          ce('textarea', {
            className: 'ms2-ta', value: str(sbarDraft[k]),
            'aria-label': 'SBAR ' + k,
            onChange: function (ev) {
              var v = ev.target.value;
              setSbarDraft(function (prev) {
                var n = shallow(prev);
                n[k] = v;
                return n;
              });
            }
          }));
      }),
      ce('div', { className: 'ms2-row', style: { marginTop: 10 } },
        ce('button', { type: 'button', className: 'ms2-btn go', onClick: submitSbar },
          'Give the report'),
        ce('button', {
          type: 'button', className: 'ms2-btn',
          onClick: function () { setPanel('rubric'); }
        }, 'Back to the steps')),
      sbarAi
        ? ce('div', { className: 'ms2-banner', style: { marginTop: 10 } },
          ce('b', null, 'AI proctor: ' + numOr(sbarAi.score, 0) + '/100'),
          ce('div', null, str(sbarAi.comment)))
        : null);

    var askPanel = ce('div', { className: 'ms2-card' },
      ce('h3', null, 'Ask the patient'),
      ce('p', { className: 'ms2-dim' }, wantAi && aiReady()
        ? 'The AI plays the patient and is held to this packet: it answers from the charted ' +
          'assessment and says so when something is not charted. It will not tell you the ' +
          'next step.'
        : 'Running without the AI patient. Questions are logged for the debrief; the charted ' +
          'assessment is on the Assessment tab.'),
      ce('div', { className: 'ms2-row', style: { marginTop: 8 } },
        ce('input', {
          className: 'ms2-in', style: { flex: '1 1 200px' }, value: askText,
          'aria-label': 'Ask the patient a question',
          placeholder: 'Can you tell me how your breathing feels right now?',
          onChange: function (ev) { setAskText(ev.target.value); },
          onKeyDown: function (ev) { if (str(ev.key) === 'Enter') { doAsk(); } }
        }),
        ce('button', {
          type: 'button', className: 'ms2-btn', onClick: doAsk, disabled: aiState.busy
        }, aiState.busy ? 'Asking…' : 'Ask')));

    var logPanel = ce('div', { className: 'ms2-card' },
      ce('h3', null, 'Run log'),
      ce('div', { className: 'ms2-log' }, arr(run.log).slice().reverse().map(function (l) {
        return ce('div', { key: l.key, className: 'ms2-le ' + str(l.kind) },
          ce('span', { className: 't' }, fmtClock(l.atSec)),
          ce('span', null, str(l.text)),
          str(l.detail)
            ? ce('div', { className: 'ms2-dim', style: { marginTop: 2 } }, str(l.detail))
            : null);
      })));

    var body = ce('div', { className: 'ms2-stage' },
      ce('div', null,
        feedback
          ? ce('div', { key: feedback.key, className: 'ms2-fb ' + feedback.tone,
            style: { marginBottom: 10 } },
            ce('b', null, feedback.title), feedback.body)
          : null,
        aiState.degraded
          ? ce('div', { className: 'ms2-banner warn', style: { marginBottom: 10 } },
            ce('b', null, 'Running without the AI'), str(aiState.why))
          : null,
        panel === 'sbar' ? sbarPanel : stepList,
        panel === 'sbar' ? null : ce('div', { style: { marginTop: 12 } },
          ce('button', {
            type: 'button', className: 'ms2-btn sm',
            onClick: function () { setPanel('sbar'); }
          }, 'Open the SBAR composer')),
        errorWatch),
      ce('div', null,
        ce(ChartPanel, {
          sim: s, tab: chartTab, onTab: openTab,
          /* The "what this value means" line appears only AFTER the student has
             performed an interpretation step. Showing it up front would be
             handing over the one thing this packet is actually testing. */
          showInterpretation: interpretedYet
        }),
        askPanel,
        logPanel,
        ce('div', { className: 'ms2-card' },
          ce(SourceNote, { note: str(s.sourceNote) }))));

    return ce('div', { className: 'ms2-root' },
      bar,
      ce('div', { className: 'ms2-pausehost' },
        body,
        run.paused
          ? ce('div', { className: 'ms2-veil' },
            ce('div', { className: 'ms2-veilcard' },
              ce('h3', null, 'Paused'),
              ce('div', { className: 'ms2-sub' },
                'The countdown is frozen and nothing advances. When you resume it picks up ' +
                'exactly where it stopped - no time is skipped forward.' +
                (net ? ' Everyone in the room is paused with you.' : '')),
              ce('button', { type: 'button', className: 'ms2-btn go', onClick: doResume },
                'Resume')))
          : null));
  }

  /* ==========================================================================
   * 16. DEBRIEF
   * --------------------------------------------------------------------------
   * The outcome first, the score second, and the teaching in the packet's own
   * words. A student who reads only the top of this page should still know
   * whether they would have passed and exactly which steps stood between them
   * and passing.
   * ======================================================================== */

  function MarkRow(props) {
    var m = obj(props.mark);
    var cls = m.verdict === 'done' ? 'good' : (m.verdict === 'out-of-sequence' ? 'mid' : 'miss');
    var glyph = m.verdict === 'done' ? '✓' : (m.verdict === 'out-of-sequence' ? '△' : '✕');
    return ce('div', { className: 'ms2-mark ' + cls },
      ce('span', { className: 'm' }, glyph),
      ce('span', { className: 'b' },
        ce('div', { style: { fontSize: 13, fontWeight: 700, color: 'var(--text,#e5e7eb)' } },
          m.n + '. ' + str(m.text)),
        ce('div', { className: 'ms2-dim' },
          phaseMeta(m.phase).label +
          (m.critical ? '  ·  critical' : '') +
          '  ·  ' + (m.verdict === 'done' ? 'performed'
            : m.verdict === 'out-of-sequence' ? 'performed out of sequence' : 'MISSED') +
          (m.atSec !== null && m.atSec !== undefined ? '  ·  at ' + fmtClock(m.atSec) : '') +
          (str(m.by) ? '  ·  ' + str(m.by) : '')),
        m.verdict === 'missed' && str(m.coachTip)
          ? ce('div', { className: 'ms2-sub', style: { marginTop: 3 } }, str(m.coachTip))
          : null,
        m.verdict === 'missed' && str(m.evidence)
          ? ce('div', { className: 'ms2-dim', style: { marginTop: 2 } },
            'The proctor was looking for: ' + str(m.evidence))
          : null));
  }

  function SbarCompare(props) {
    var mine = obj(props.mine);
    var want = obj(props.expected);
    var ai = props.ai ? obj(props.ai) : null;
    var parts = [
      ['situation', 'Situation'], ['background', 'Background'],
      ['assessment', 'Assessment'], ['recommendation', 'Recommendation']
    ];
    return ce('div', null, parts.map(function (pr) {
      var k = pr[0];
      var aiPart = ai ? obj(ai[k]) : null;
      return ce('div', { key: k, style: { marginBottom: 12 } },
        ce('span', { className: 'ms2-lbl' }, pr[1]),
        ce('div', { className: 'ms2-side' },
          ce('div', { className: 'ms2-card', style: { margin: 0 } },
            ce('div', { className: 'ms2-dim', style: { marginBottom: 4 } }, 'What you said'),
            ce('div', { className: 'ms2-sub' }, str(mine[k]) || '— nothing said —'),
            aiPart
              ? ce('div', {
                className: 'ms2-badge ' + (aiPart.met ? 'ok' : 'warn'),
                style: { marginTop: 6 }
              }, aiPart.met ? 'covered' : 'gap')
              : null,
            aiPart && str(aiPart.note)
              ? ce('div', { className: 'ms2-dim', style: { marginTop: 4 } }, str(aiPart.note))
              : null),
          ce('div', { className: 'ms2-card', style: { margin: 0 } },
            ce('div', { className: 'ms2-dim', style: { marginBottom: 4 } },
              'What this packet expects'),
            ce('div', { className: 'ms2-sub' }, str(want[k]) || '—'))));
    }));
  }

  function Debrief(props) {
    var p = obj(props);
    var s = obj(p.sim);
    var run = obj(p.run);
    var score = useMemo(function () { return scoreRun(s, run); }, [s, run]);
    var meta = VERDICT_META[score.verdict] || VERDICT_META['not-yet'];

    var aiH = useState(null);
    var ai = aiH[0], setAi = aiH[1];
    var busyH = useState(false);
    var busy = busyH[0], setBusy = busyH[1];
    var savedRef = useRef(false);
    var aliveRef = useRef(true);

    useEffect(function () { return function () { aliveRef.current = false; }; }, []);

    /* Persist exactly once, whatever React does with this component. */
    useEffect(function () {
      if (savedRef.current) { return; }
      savedRef.current = true;
      try {
        persistResult(s, score, run, {
          setProgress: p.setProgress, uid: p.uid, db: p.db,
          runMode: p.runMode, role: p.role, roomId: p.roomId
        });
      } catch (e) {}
    }, []);

    useEffect(function () {
      if (str(p.runMode) !== 'ai' || !aiReady()) { return; }
      setBusy(true);
      aiDebrief(s, score).then(function (res) {
        if (!aliveRef.current) { return; }
        setBusy(false);
        setAi(res);
      });
    }, []);

    var missedCritical = arr(score.criticalMissed);

    return ce('div', { className: 'ms2-root' },
      ce('div', { className: 'ms2-head' },
        ce('div', null,
          ce('h2', null, 'Debrief - ' + str(s.topic)),
          ce('p', { className: 'ms2-sub' }, str(s.course) + ' simulation lab checkoff')),
        ce('div', { className: 'ms2-spacer' })),

      /* ---- verdict ---- */
      ce('div', { className: 'ms2-card' },
        ce('div', { className: 'ms2-verdict ' + meta.cls }, meta.label),
        ce('p', { className: 'ms2-sub' }, meta.line),
        ce('div', { className: 'ms2-row', style: { marginTop: 10 } },
          ce(Badge, { tone: score.pct >= PASS_PCT ? 'ok' : 'warn' }, score.pct + '%'),
          ce(Badge, null, score.done + ' performed'),
          score.outOfSequence
            ? ce(Badge, { tone: 'warn' }, score.outOfSequence + ' out of sequence') : null,
          score.missed ? ce(Badge, { tone: 'bad' }, score.missed + ' missed') : null,
          ce(Badge, null, fmtClock(score.timeSec) +
            (score.overtime ? ' (over time)' : '')),
          score.hintsUsed
            ? ce(Badge, null, score.hintsUsed + ' hints, -' + score.hintPenalty) : null,
          score.pauseCount
            ? ce(Badge, null, score.pauseCount + ' pause' + (score.pauseCount === 1 ? '' : 's') +
              ', ' + fmtClock(score.pausedMs / 1000)) : null),
        arr(score.reasons).length
          ? ce('div', { className: 'ms2-banner ' + (score.hardFail ? 'bad' : 'warn'),
            style: { marginTop: 12 } },
            ce('b', null, score.hardFail ? 'Why this is a hard fail' : 'What is standing in the way'),
            ce('ul', { style: { margin: '6px 0 0', paddingLeft: 18 } },
              arr(score.reasons).map(function (r, i) {
                return ce('li', { key: i, style: { fontSize: 12.5, lineHeight: 1.55 } }, r);
              })))
          : ce('div', { className: 'ms2-banner ok', style: { marginTop: 12 } },
            'Every critical step performed, no critical errors, inside the time. ' +
            'That is the checkoff.')),

      /* ---- critical errors ---- */
      arr(score.errors).length
        ? ce('div', { className: 'ms2-card' },
          ce('h3', null, 'Critical errors observed'),
          ce('p', { className: 'ms2-dim' },
            'These are the packet\'s own words. Any one of them is an automatic fail in the ' +
            'lab regardless of the rest of the sheet, which is why nothing above can rescue it.'),
          arr(score.errors).map(function (e, i) {
            return ce('div', { key: i, className: 'ms2-banner bad', style: { marginTop: 8 } },
              str(e.text) +
              (e.atSec !== null && e.atSec !== undefined ? '  (at ' + fmtClock(e.atSec) + ')' : '') +
              (str(e.by) ? '  - marked by ' + str(e.by) : ''));
          }))
        : null,

      /* ---- the sheet ---- */
      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'The marking sheet, step by step'),
        ce('p', { className: 'ms2-dim' },
          score.done + ' performed · ' + score.outOfSequence + ' out of sequence · ' +
          score.missed + ' missed, of ' + score.total + ' steps (' +
          score.criticalTotal + ' critical).'),
        ce('div', { style: { marginTop: 8 } }, arr(score.marks).map(function (m) {
          return ce(MarkRow, { key: m.id, mark: m });
        }))),

      missedCritical.length
        ? ce('div', { className: 'ms2-card' },
          ce('h3', null, 'The critical steps you did not perform'),
          ce('p', { className: 'ms2-dim' },
            'These are the ones that decide the checkoff. Everything else is polish.'),
          missedCritical.map(function (m) {
            return ce('div', { key: m.id, className: 'ms2-banner warn', style: { marginTop: 8 } },
              ce('b', null, 'Step ' + m.n + '. ' + str(m.text)),
              str(m.coachTip) ? ce('div', { style: { marginTop: 4 } }, str(m.coachTip)) : null);
          }))
        : null,

      /* ---- SBAR ---- */
      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'Your SBAR next to the one this packet expects'),
        score.sbar
          ? ce(SbarCompare, {
            mine: score.sbar, expected: score.expectedSbar, ai: p.sbarAi || null
          })
          : ce('div', { className: 'ms2-banner warn' },
            'You did not give an SBAR. It is a graded step in every one of these packets, ' +
            'and it is the step students most often run out of clock for. Here is what this ' +
            'one expects:'),
        !score.sbar
          ? ce(SbarCompare, { mine: {}, expected: score.expectedSbar, ai: null })
          : null),

      /* ---- packet teaching ---- */
      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'Debriefing questions'),
        ce('p', { className: 'ms2-dim' },
          'Straight from the packet. Your instructor will ask some of these out loud.'),
        ce('ol', { style: { margin: '8px 0 0', paddingLeft: 20 } },
          arr(s.debriefQuestions).map(function (q, i) {
            return ce('li', { key: i, className: 'ms2-sub', style: { marginBottom: 6 } }, str(q));
          }))),

      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'Pearls'),
        ce('ul', { style: { margin: '4px 0 0', paddingLeft: 20 } },
          arr(s.pearls).map(function (q, i) {
            return ce('li', { key: i, className: 'ms2-sub', style: { marginBottom: 5 } }, str(q));
          }))),

      ce(SourceNote, { note: str(s.sourceNote) }),

      busy
        ? ce('div', { className: 'ms2-banner', style: { marginTop: 12 } },
          'The AI instructor is reading your run…')
        : null,
      ai
        ? ce('div', { className: 'ms2-card' },
          ce('h3', null, 'From the AI instructor'),
          ce('p', { className: 'ms2-sub' }, str(ai.comment)),
          arr(ai.focus).length
            ? ce('ul', { style: { margin: '6px 0 0', paddingLeft: 20 } },
              arr(ai.focus).map(function (f, i) {
                return ce('li', { key: i, className: 'ms2-sub' }, str(f));
              }))
            : null,
          str(ai.nextRep)
            ? ce('div', { className: 'ms2-banner', style: { marginTop: 10 } }, str(ai.nextRep))
            : null)
        : null,

      ce('div', { className: 'ms2-row', style: { marginTop: 14 } },
        ce('button', { type: 'button', className: 'ms2-btn go', onClick: p.onAgain }, 'Run it again'),
        ce('button', { type: 'button', className: 'ms2-btn', onClick: p.onExit }, 'Back to topics')));
  }

  /* ==========================================================================
   * 17. ROOMS - lobby and runner
   * ======================================================================== */

  function RoomLobby(props) {
    var p = obj(props);
    var s = obj(p.sim);
    var db = p.db;

    var codeH = useState('');
    var code = codeH[0], setCode = codeH[1];
    var errH = useState('');
    var err = errH[0], setErr = errH[1];
    var busyH = useState(false);
    var busy = busyH[0], setBusy = busyH[1];

    function doCreate() {
      if (busy) { return; }
      if (!db) { setErr('A room needs a connection. You can still run this solo.'); return; }
      setErr('');
      setBusy(true);
      createLabRoom(db, {
        mode: 'ms2lab', simId: str(s.id), topic: cut(str(s.topic), 80),
        course: str(s.course), durationMin: numOr(p.durationMin, 0)
      }, p.myUid, p.myName, 'MS2 Lab - ' + cut(str(s.topic), 40), function (e, id) {
        setBusy(false);
        if (e) { setErr(e); return; }
        if (isFn(p.onEnter)) { p.onEnter(id); }
      });
    }

    function doJoin() {
      var c = normalizeCode(code);
      if (c.length !== 4) { setErr('A room code is four letters.'); return; }
      if (!db) { setErr('A room needs a connection.'); return; }
      setErr('');
      setBusy(true);
      try {
        roomRef(db, c).child('status').once('value', function (snap) {
          setBusy(false);
          var st = str(snap.val());
          if (!st) { setErr('No room with the code ' + c + '. Check it with whoever set it up.'); return; }
          if (st === ROOM_STATUS_DONE) { setErr('That room has already been run.'); return; }
          if (st !== ROOM_STATUS_OPEN) {
            setErr('The code ' + c + ' belongs to a different exercise, not a simulation lab room.');
            return;
          }
          if (isFn(p.onEnter)) { p.onEnter(c); }
        }, function () { setBusy(false); setErr('Could not reach that room.'); });
      } catch (e) { setBusy(false); setErr('Could not reach that room.'); }
    }

    return ce('div', { className: 'ms2-root' },
      ce('div', { className: 'ms2-head' },
        ce('button', { type: 'button', className: 'ms2-btn sm', onClick: p.onBack }, '‹ Back'),
        ce('div', null,
          ce('h2', null, 'Run it with your partners'),
          ce('p', { className: 'ms2-sub' }, str(s.topic) + '  ·  ' + str(s.course))),
        ce('div', { className: 'ms2-spacer' })),

      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'The seats'),
        ce('div', { className: 'ms2-roles' }, LAB_ROLES.map(function (r) {
          return ce('div', { key: r.id, className: 'ms2-role' },
            ce('b', null, r.label), ce('span', null, r.blurb));
        })),
        ce('p', { className: 'ms2-dim', style: { marginTop: 8 } },
          'One shared clock, one shared pause, one shared step log. Anybody can pause; ' +
          'everybody is paused. The proctor seat is the one that marks critical errors - ' +
          'if nobody takes it, the whole team can mark them.')),

      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'Start a room'),
        ce('p', { className: 'ms2-dim' },
          'You get a four-letter code. Read it out; they type it in.'),
        ce('button', {
          type: 'button', className: 'ms2-btn go', onClick: doCreate, disabled: busy
        }, busy ? 'Working…' : 'Create the room')),

      ce('div', { className: 'ms2-card' },
        ce('h3', null, 'Join a room'),
        ce('div', { className: 'ms2-row' },
          ce('input', {
            className: 'ms2-in', style: { flex: '0 1 160px', letterSpacing: 4, fontWeight: 800 },
            value: code, maxLength: 4, 'aria-label': 'Room code',
            placeholder: 'ABCD',
            onChange: function (e) { setCode(normalizeCode(e.target.value)); },
            onKeyDown: function (e) { if (str(e.key) === 'Enter') { doJoin(); } }
          }),
          ce('button', {
            type: 'button', className: 'ms2-btn', onClick: doJoin, disabled: busy
          }, 'Join'))),

      err ? ce('div', { className: 'ms2-banner bad' }, err) : null);
  }

  function RoomRunner(props) {
    var p = obj(props);
    var db = p.db;
    var roomId = str(p.roomId);
    var net = useLabRoom(db, roomId, str(p.myUid), str(p.myName));
    var cfg = obj(net.meta.cfg);
    var sim = simById(str(cfg.simId)) || obj(p.sim);
    var durationMin = numOr(cfg.durationMin, numOr(p.durationMin, 0));

    var startedH = useState(false);
    var startedH2 = startedH[1];
    var startedRef = useRef(false);

    var run = useMemo(function () {
      return foldEvents(initialRun({
        simId: str(obj(sim).id),
        durationSec: Math.max(0, Math.round(durationMin * 60))
      }), net.events);
    }, [net.events, sim, durationMin]);

    if (!net.meta.cfgReady && !obj(sim).id) {
      return ce('div', { className: 'ms2-root' },
        ce('div', { className: 'ms2-empty' }, 'Joining room ' + roomId + '…'));
    }
    if (!obj(sim).id) {
      return ce('div', { className: 'ms2-root' },
        ce('div', { className: 'ms2-banner bad' },
          'Room ' + roomId + ' points at a topic this build does not have. Ask whoever set ' +
          'it up to reload, or run the topic solo.'),
        ce('button', { type: 'button', className: 'ms2-btn', onClick: p.onExit }, 'Back'));
    }

    var connected = keysOf(net.players).filter(function (k) {
      return obj(net.players[k]).connected !== false;
    });
    var takenRoles = {};
    connected.forEach(function (k) {
      var r = str(obj(net.players[k]).role);
      if (r) { takenRoles[r] = str(obj(net.players[k]).name) || 'Student'; }
    });

    var roster = ce('div', { className: 'ms2-card' },
      ce('h3', null, 'Room ' + roomId),
      ce('div', { className: 'ms2-code' }, roomId),
      ce('p', { className: 'ms2-dim' },
        connected.length + ' connected  ·  host ' + (str(net.meta.hostName) || 'unknown')),
      net.denied
        ? ce('div', { className: 'ms2-banner warn' },
          'This room is read-only for you right now - a write was refused. Everything still ' +
          'renders and you can keep following along, but your actions are not reaching the ' +
          'others. Run it solo if that is not good enough, and tell whoever runs the app ' +
          'that the room rules need checking.')
        : null,
      net.err ? ce('div', { className: 'ms2-banner bad' }, net.err) : null,
      ce('span', { className: 'ms2-lbl' }, 'Your seat'),
      ce('div', { className: 'ms2-roles' }, LAB_ROLES.map(function (r) {
        var mine = net.myRole === r.id;
        var who = takenRoles[r.id];
        return ce('button', {
          key: r.id, type: 'button', className: 'ms2-role',
          'aria-pressed': mine ? 'true' : 'false',
          onClick: function () { net.setRole(mine ? '' : r.id); }
        },
          ce('b', null, r.label),
          ce('span', null, mine ? 'You' : (who ? who : r.blurb)));
      })),
      ce('div', { className: 'ms2-row', style: { marginTop: 10 } },
        !run.startedAt
          ? ce('button', {
            type: 'button', className: 'ms2-btn go',
            onClick: function () {
              if (startedRef.current) { return; }
              startedRef.current = true;
              startedH2(true);
              net.submit({ t: EV_START, at: nowMs(), by: str(p.myUid), byName: str(p.myName) });
            }
          }, 'Start the simulation for everyone')
          : null,
        ce('button', {
          type: 'button', className: 'ms2-btn',
          onClick: function () { if (net.isHost) { net.closeRoom(); } if (isFn(p.onExit)) { p.onExit(); } }
        }, net.isHost ? 'Close the room' : 'Leave')));

    return ce('div', null,
      roster,
      ce(Runner, {
        sim: sim, durationMin: durationMin, runMode: 'room',
        net: { active: true, events: net.events, submit: net.submit },
        role: net.myRole, players: net.players, roomId: roomId,
        uid: str(p.myUid), name: str(p.myName),
        onFinish: p.onFinish, onQuit: p.onExit
      }));
  }

  /* ==========================================================================
   * 18. THE PAGE
   * ======================================================================== */

  function MS2LabMode(props) {
    var p = obj(props);
    injectStyles();

    var MM = MMx();
    var authUser = p.authUser || MM.authUser || null;
    var db = MM.db || null;
    var myUid = str(authUser && authUser.uid ? authUser.uid : (MM.myId || ''));
    var myName = cut(str(
      (authUser && authUser.displayName) ? authUser.displayName :
        (authUser && authUser.email) ? String(authUser.email).split('@')[0] : 'Student'
    ) || 'Student', 32);

    var screenH = useState('pick');
    var screen = screenH[0], setScreen = screenH[1];
    var simIdH = useState('');
    var simId = simIdH[0], setSimId = simIdH[1];
    var setupH = useState(null);
    var setup = setupH[0], setSetup = setupH[1];
    var roomH = useState('');
    var roomId = roomH[0], setRoomId = roomH[1];
    var resultH = useState(null);
    var result = resultH[0], setResult = resultH[1];
    var nonceH = useState(0);
    var nonce = nonceH[0], setNonce = nonceH[1];

    var toPicker = useCallback(function () {
      setScreen('pick'); setSimId(''); setSetup(null); setRoomId(''); setResult(null);
    }, []);

    /* The data file is a separate <script>; if it never arrived, say so in
       words. Same contract as the shell's modulePage() for a missing module. */
    if (!contentOk()) { return ce(ContentMissing, null); }
    if (!authUser || !myUid) { return ce(SignedOut, null); }

    var sim = simById(simId);

    if (screen === 'debrief' && result) {
      return ce(Debrief, {
        sim: obj(result.sim), run: obj(result.run), sbarAi: result.sbarAi || null,
        setProgress: isFn(p.setProgress) ? p.setProgress : null,
        uid: myUid, db: db, runMode: str(obj(setup).mode) || 'solo',
        role: str(result.role), roomId: roomId,
        onExit: toPicker,
        onAgain: function () {
          setResult(null);
          setNonce(nonce + 1);
          setScreen(str(obj(setup).mode) === 'room' ? 'room' : 'run');
        }
      });
    }

    if (screen === 'room' && sim && roomId) {
      return ce(RoomRunner, {
        key: 'room-' + roomId + '-' + nonce,
        db: db, roomId: roomId, sim: sim,
        durationMin: numOr(obj(setup).durationMin, 0),
        myUid: myUid, myName: myName,
        onExit: toPicker,
        onFinish: function (payload) {
          setResult({ run: obj(payload).run, sim: obj(payload).sim || sim,
            sbarAi: obj(payload).sbarAi, role: str(obj(payload).role) });
          setScreen('debrief');
        }
      });
    }

    if (screen === 'lobby' && sim) {
      return ce(RoomLobby, {
        sim: sim, db: db, myUid: myUid, myName: myName,
        durationMin: numOr(obj(setup).durationMin, 0),
        onBack: function () { setScreen('brief'); },
        onEnter: function (id) { setRoomId(id); setScreen('room'); setNonce(nonce + 1); }
      });
    }

    if (screen === 'run' && sim && setup) {
      return ce(Runner, {
        key: 'run-' + simId + '-' + nonce,
        sim: sim, durationMin: numOr(setup.durationMin, 0),
        runMode: str(setup.mode) === 'ai' ? 'ai' : 'solo',
        uid: myUid, name: myName, net: null, role: '',
        onQuit: toPicker,
        onFinish: function (payload) {
          setResult({ run: obj(payload).run, sim: obj(payload).sim || sim,
            sbarAi: obj(payload).sbarAi, role: '' });
          setScreen('debrief');
        }
      });
    }

    if (screen === 'brief' && sim) {
      return ce(PreBrief, {
        sim: sim,
        onBack: toPicker,
        onStart: function (cfg) {
          setSetup(cfg);
          setNonce(nonce + 1);
          setScreen(str(cfg.mode) === 'room' ? 'lobby' : 'run');
        }
      });
    }

    return ce(Picker, {
      progress: p.progress,
      onPick: function (id) { setSimId(id); setScreen('brief'); }
    });
  }

  /* ==========================================================================
   * 19. EXPORTS
   * The logic hangs off the component so it can be unit tested without React
   * and so a future instructor dashboard can replay a run from its event list.
   * ======================================================================== */

  /* data + rubric */
  MS2LabMode.allSims = allSims;
  MS2LabMode.contentOk = contentOk;
  MS2LabMode.simById = simById;
  MS2LabMode.buildRubric = buildRubric;
  MS2LabMode.orderGate = orderGate;
  MS2LabMode.gateCoachLine = gateCoachLine;
  MS2LabMode.readGate = readGate;
  MS2LabMode.readCoachLine = readCoachLine;
  MS2LabMode.nextStep = nextStep;
  MS2LabMode.hintForTier = hintForTier;
  MS2LabMode.isTimingStep = isTimingStep;
  MS2LabMode.isSbarStep = isSbarStep;
  MS2LabMode.PHASES = PHASES;
  MS2LabMode.PHASE_ORDER = PHASE_ORDER;
  MS2LabMode.phaseMeta = phaseMeta;
  MS2LabMode.GATE_LOOKAHEAD = GATE_LOOKAHEAD;
  MS2LabMode.ARM_MS = ARM_MS;
  MS2LabMode.PASS_PCT = PASS_PCT;
  MS2LabMode.HINT_CAP = HINT_CAP;
  MS2LabMode.CHART_TABS = CHART_TABS;
  MS2LabMode.DURATION_CHOICES = DURATION_CHOICES;

  /* run model */
  MS2LabMode.initialRun = initialRun;
  MS2LabMode.applyEvent = applyEvent;
  MS2LabMode.foldEvents = foldEvents;
  MS2LabMode.elapsedMs = elapsedMs;
  MS2LabMode.elapsedSec = elapsedSec;
  MS2LabMode.remainingSec = remainingSec;
  MS2LabMode.expired = expired;
  MS2LabMode.scoreRun = scoreRun;
  MS2LabMode.VERDICT_META = VERDICT_META;
  MS2LabMode.EVENTS = {
    START: EV_START, STEP: EV_STEP, CHART: EV_CHART, HINT: EV_HINT,
    ERROR: EV_ERROR, UNERROR: EV_UNERROR, SBAR: EV_SBAR, ASK: EV_ASK,
    SAY: EV_SAY, PAUSE: EV_PAUSE, RESUME: EV_RESUME, END: EV_END, NOTE: EV_NOTE
  };

  /* ---- pause / resume -----------------------------------------------------
   * Exactly the names js/sim-engine.js, js/ai-scenario.js and js/codeblue.js
   * expose, so anything that can pause one engine can pause all four without
   * knowing which is mounted. Registered in window.MMPause under 'ms2lab'.
   * --------------------------------------------------------------------- */
  MS2LabMode.pause = labPause.pauseRun;
  MS2LabMode.resume = labPause.resumeRun;
  MS2LabMode.togglePause = labPause.togglePauseRun;
  MS2LabMode.isPaused = labPause.isRunPaused;
  MS2LabMode.canPause = labPause.canPauseRun;
  MS2LabMode.onPauseChange = labPause.onPauseChange;
  MS2LabMode.pauseStats = labPause.pauseStats;
  MS2LabMode.pauseControl = labPause.pauseControl;
  MS2LabMode.pauseRun = labPause.pauseRun;
  MS2LabMode.resumeRun = labPause.resumeRun;
  MS2LabMode.togglePauseRun = labPause.togglePauseRun;
  MS2LabMode.isRunPaused = labPause.isRunPaused;
  MS2LabMode.canPauseRun = labPause.canPauseRun;

  /* AI */
  MS2LabMode.aiReady = aiReady;
  MS2LabMode.parseJsonReply = parseJsonReply;
  MS2LabMode.completeTruncatedJSON = completeTruncatedJSON;
  MS2LabMode.groundTruth = groundTruth;
  MS2LabMode.patientSystem = patientSystem;
  MS2LabMode.sbarSystem = sbarSystem;
  MS2LabMode.debriefSystem = debriefSystem;
  MS2LabMode.askPatient = askPatient;
  MS2LabMode.gradeSbar = gradeSbar;
  MS2LabMode.aiDebrief = aiDebrief;
  MS2LabMode.AI_FEATURES = { patient: F_PATIENT, sbar: F_SBAR, debrief: F_DEBRIEF };
  MS2LabMode.TOKEN_CAPS = {
    patient: PATIENT_MAX_TOKENS, sbar: SBAR_MAX_TOKENS,
    debrief: DEBRIEF_MAX_TOKENS, repair: REPAIR_MAX_TOKENS
  };

  /* persistence + rooms */
  MS2LabMode.persistResult = persistResult;
  MS2LabMode.bestFor = bestFor;
  MS2LabMode.RESULTS_PATH = RESULTS_PATH;
  MS2LabMode.RESULTS_RULES = RESULTS_RULES;
  MS2LabMode.ROOM_BASE = ROOM_BASE;
  MS2LabMode.ROOM_STATUS_OPEN = ROOM_STATUS_OPEN;
  MS2LabMode.ROOM_STATUS_DONE = ROOM_STATUS_DONE;
  MS2LabMode.ROOM_STALE_MS = ROOM_STALE_MS;
  MS2LabMode.randCode = randCode;
  MS2LabMode.normalizeCode = normalizeCode;
  MS2LabMode.createRoom = createLabRoom;
  MS2LabMode.LAB_ROLES = LAB_ROLES;
  MS2LabMode.roleMeta = roleMeta;
  MS2LabMode.canMarkErrors = canMarkErrors;
  MS2LabMode.isHandsOn = isHandsOn;

  /* components */
  MS2LabMode.Picker = Picker;
  MS2LabMode.PreBrief = PreBrief;
  MS2LabMode.ChartPanel = ChartPanel;
  MS2LabMode.Runner = Runner;
  MS2LabMode.Debrief = Debrief;
  MS2LabMode.RoomLobby = RoomLobby;
  MS2LabMode.RoomRunner = RoomRunner;

  window.MS2LabMode = MS2LabMode;
  window.MS2Lab = MS2LabMode;
  window.MS2LabRunner = Runner;
  window.MS2LabPicker = Picker;
  window.MS2LabPreBrief = PreBrief;
  window.MS2LabDebrief = Debrief;
})();
