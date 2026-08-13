/* =============================================================================
 * MedMaster :: js/simprep-sim.js
 * CLINICAL SIMULATION PREP  ->  window.SimPrepSimMode + window.SimPrepCoachMode
 * -----------------------------------------------------------------------------
 * Two surfaces over one deterministic engine:
 *
 *   window.SimPrepSimMode    a stateful 20-minute virtual patient encounter
 *                            (handoff -> active -> deteriorating ->
 *                            stabilized_or_transferred, plus optional
 *                            critical_event)
 *   window.SimPrepCoachMode  a glanceable checklist/timer surface for
 *                            rehearsing in a real sim room with a mannequin
 *
 * Content comes from window.NUR2212_SCENARIOS (data/nur2212-scenarios.js).
 * Study links come from window.SimPrepStudy when it exists. Partner rooms come
 * from window.MM.simprepPartner when it exists. All three are feature-detected;
 * none of them is a hard dependency and a missing one is never a white screen.
 *
 * -----------------------------------------------------------------------------
 * DESIGN RULE #1 - THE ENGINE OWNS THE FACTS. Vitals, labs, orders, the MAR,
 * hidden findings, deterioration, state transitions and the score are computed
 * here, from the scenario object, deterministically. The LLM is a LANGUAGE
 * INTERFACE and nothing else: it may (a) map free text onto an allowed intent
 * id, (b) speak in the patient/family/provider voice, and (c) write debrief
 * prose. It may never introduce a provider order, a medication, a dose, a
 * route, a lab value, a diagnostic result, an allergy, a code status, a vital
 * sign or a device setting.
 *
 * That rule is enforced in CODE, in two independent layers, not in a prompt:
 *
 *   Layer 1 - KEY ALLOW-LIST (validateAIReply). A model reply is destructured
 *             into exactly five fields. `orders`, `medication`, `dose`, `labs`,
 *             `vitals`, `allergies`, `code_status` and anything else are
 *             discarded before the object is looked at, and each discard is
 *             recorded as a violation. There is no code path from a model key
 *             to patient state - the only write the AI can cause is an intent
 *             id that was already in allowed_action_intents.
 *
 *   Layer 2 - SOURCE TRACEABILITY (sanitizeAIText). The one free-text field is
 *             split into sentences and every sentence must be traceable to the
 *             scenario object: every number, every value+unit pair, every named
 *             medication, every lab/vital/device claim, every allergy or code
 *             status statement, and every qualitative clinical finding. An
 *             untraceable sentence is DROPPED, not softened. A sentence that
 *             names a real scenario finding the learner has not uncovered yet
 *             is also dropped - the guard is reveal-aware, so the model cannot
 *             leak a hidden finding by talking about it.
 *
 * DESIGN RULE #2 - HIDDEN INFORMATION IS HIDDEN EVERYWHERE. There is exactly
 * one reveal ledger (run.revealed) and every surface - chart, monitor, cue
 * screen, dialogue, hints, "what am I missing", the debrief - reads it. Lung
 * sounds need auscultation, pupils need a neuro check, pain detail needs
 * symptom questions, labs need the lab panel. A diagnosis documented in the
 * chart is chart data; one that is not documented is never announced.
 *
 * DESIGN RULE #3 - NEVER ACCUMULATE A CLOCK. Elapsed time is derived from
 * timestamps carried in the run (startedAt, pausedAt, pausedMs), exactly as
 * js/ms2lab.js does it, so a backgrounded tab, a refresh, a partner's phone or
 * a long pause can never desynchronise it and resume can never fast-forward.
 *
 * DESIGN RULE #4 - THE RUN IS A FOLD OVER AN EVENT LIST. applyEvent(run, evt)
 * is pure and contains no randomness. Solo keeps the list in memory; a partner
 * room keeps it in the shared feed and every client folds the same list, so the
 * clock, the pause and the action log are shared with no host engine at all.
 *
 * DESIGN RULE #5 - NOTHING IS CONSUMED BY AN ACCIDENT. Identical semantics to
 * js/sim-engine.js section 5b and js/ms2lab.js: a first unsafe or out-of-order
 * activation is HELD BACK - nothing is recorded, the control stays ENABLED, it
 * shakes, it coaches without naming the answer, and a second activation within
 * 8 seconds commits it. No control the learner may still need is ever disabled.
 *
 * DESIGN RULE #6 - DO NOT SCORE WHAT THE SOURCE CONTRADICTS. An item whose
 * source fact is named in an unresolved `source_discrepancies` entry is removed
 * from BOTH the numerator and the denominator. It is shown in a "Source issue -
 * verify with instructor" panel instead. And there is never an automatic course
 * failure unless an instructor explicitly configures one.
 *
 * Contract: IIFE, no JSX, no ES modules, ES5 only (var/function - no arrow
 * functions, template literals, const/let, spread, destructuring or optional
 * chaining), window export, CSS injected once with the spx- prefix, CSS
 * variables with fallbacks, legible at 360px, honours prefers-reduced-motion.
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
  function setAdd(map, key) {
    var n = shallow(map);
    n[str(key)] = true;
    return n;
  }
  function uniq(list) {
    var seen = {}, out = [];
    arr(list).forEach(function (v) {
      var k = str(v);
      if (!seen[k]) { seen[k] = 1; out.push(v); }
    });
    return out;
  }
  function cut(v, n) {
    var s = str(v);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function fmtClock(sec) {
    var s = Math.max(0, Math.round(numOr(sec, 0)));
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
    if (isFn(MM.toast)) { try { MM.toast(str(msg), kind || 'info'); } catch (e) {} }
  }
  var LIVE_ID = 'spx-live-region';
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
        n.className = 'spx-sr';
        n.setAttribute('aria-atomic', 'true');
        document.body.appendChild(n);
      }
      n.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
      n.textContent = '';
      window.setTimeout(function () { n.textContent = m; }, 60);
    } catch (e) {}
  }

  /* Word-level normalisation used by every matcher and every guard. Keeps
     digits, letters, dots inside numbers and slashes inside a BP reading. */
  function normText(v) {
    return lower(v)
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^a-z0-9%./+\-'\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function words(v) {
    return normText(v).split(' ').filter(function (w) { return !!w; });
  }
  var STOP = {};
  ('a an and are as at be been but by for from had has have her him his i if in into is it its'
    + ' me my no not of on or our per she that the their them then there these they this to was'
    + ' we were what when which who will with you your do does did done get got give given also'
    + ' new now next each any all some more most very can could should would may might must')
    .split(' ').forEach(function (w) { STOP[w] = true; });
  function sigWords(v) {
    return words(v).filter(function (w) { return w.length >= 4 && !STOP[w]; });
  }

  /* ==========================================================================
   * 2. STYLESHEET (injected once, spx- prefix)
   * ======================================================================== */

  function injectStyles() {
    try {
      if (!document || !document.getElementById) { return; }
      if (document.getElementById('simprep-sim-styles')) { return; }
    } catch (e) { return; }

    var css = [
      /* ---- root ---- */
      '.spx-root{--spx-ok:var(--green,#22c55e);--spx-warn:var(--orange,#f59e0b);',
      '--spx-bad:var(--red,#ef4444);--spx-acc:var(--accent,#3b82f6);',
      '--spx-ok-fg:var(--green-fg,#4ade80);--spx-warn-fg:var(--orange-fg,#fbbf24);',
      '--spx-bad-fg:var(--red-fg,#f87171);',
      '--spx-ok-bg:color-mix(in srgb,var(--green,#22c55e) 12%,var(--bg,#0b1220));',
      '--spx-warn-bg:color-mix(in srgb,var(--orange,#f59e0b) 13%,var(--bg,#0b1220));',
      '--spx-bad-bg:color-mix(in srgb,var(--red,#ef4444) 12%,var(--bg,#0b1220));',
      '--spx-acc-bg:color-mix(in srgb,var(--accent,#3b82f6) 12%,var(--bg,#0b1220));',
      '--spx-ok-br:color-mix(in srgb,var(--green,#22c55e) 45%,transparent);',
      '--spx-warn-br:color-mix(in srgb,var(--orange,#f59e0b) 52%,transparent);',
      '--spx-bad-br:color-mix(in srgb,var(--red,#ef4444) 50%,transparent);',
      '--spx-acc-br:color-mix(in srgb,var(--accent,#3b82f6) 45%,transparent);',
      'color:var(--text,#e5e7eb);display:block;}',
      '.spx-root *:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:2px;',
      'border-radius:var(--r-sm,6px);}',
      '.spx-root button{font-family:inherit;color:var(--text,#e5e7eb);}',
      '.spx-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;',
      'clip:rect(0 0 0 0);white-space:nowrap;border:0;}',

      /* ---- generic ---- */
      '.spx-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;}',
      '.spx-head h2{margin:0;font-size:20px;font-weight:800;letter-spacing:.2px;',
      'color:var(--text,#e5e7eb);}',
      '.spx-sub{color:var(--text2,#9ca3af);font-size:13px;margin:2px 0 0;line-height:1.5;}',
      '.spx-dim{color:var(--text3,#6b7280);font-size:12px;line-height:1.55;}',
      '.spx-spacer{flex:1 1 auto;}',
      '.spx-btn{background:var(--surface,#111827);border:1px solid var(--border,#243043);',
      'color:var(--text,#e5e7eb);padding:9px 14px;border-radius:var(--r-md,10px);cursor:pointer;',
      'font-size:13px;font-weight:700;min-height:44px;text-align:left;',
      'transition:border-color .15s ease,transform .15s ease;}',
      '.spx-btn:hover:not(:disabled){border-color:var(--accent,#3b82f6);}',
      '.spx-btn:active:not(:disabled){transform:scale(.975);}',
      '.spx-btn:disabled{opacity:.45;cursor:not-allowed;}',
      '.spx-btn.go{background:var(--accent,#3b82f6);border-color:var(--accent,#3b82f6);',
      'color:var(--text-on-fill,#ffffff);}',
      '.spx-btn.warn{background:var(--spx-warn-bg);border-color:var(--spx-warn-br);',
      'color:var(--spx-warn-fg);}',
      '.spx-btn.danger{background:var(--spx-bad-bg);border-color:var(--spx-bad-br);',
      'color:var(--spx-bad-fg);}',
      '.spx-btn.sm{min-height:36px;padding:6px 10px;font-size:12px;}',
      '.spx-btn.big{min-height:56px;font-size:15px;font-weight:800;text-align:center;',
      'justify-content:center;}',
      '.spx-card{background:var(--surface,#111827);border:1px solid var(--border,#243043);',
      'border-radius:var(--r-lg,14px);padding:14px;color:var(--text,#e5e7eb);}',
      '.spx-card+.spx-card{margin-top:12px;}',
      '.spx-card h3{margin:0 0 6px;font-size:15px;font-weight:800;color:var(--text,#e5e7eb);}',
      '.spx-badge{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;',
      'letter-spacing:.4px;text-transform:uppercase;padding:3px 8px;border-radius:999px;',
      'border:1px solid var(--border,#243043);color:var(--text2,#9ca3af);',
      'background:var(--surface2,#0f172a);}',
      '.spx-badge.ok{color:var(--spx-ok-fg);border-color:var(--spx-ok-br);background:var(--spx-ok-bg);}',
      '.spx-badge.warn{color:var(--spx-warn-fg);border-color:var(--spx-warn-br);',
      'background:var(--spx-warn-bg);}',
      '.spx-badge.bad{color:var(--spx-bad-fg);border-color:var(--spx-bad-br);',
      'background:var(--spx-bad-bg);}',
      '.spx-badge.acc{color:var(--accent-fg,#93c5fd);border-color:var(--spx-acc-br);',
      'background:var(--spx-acc-bg);}',
      '.spx-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}',
      '.spx-note{border-left:3px solid var(--spx-warn-br);background:var(--spx-warn-bg);',
      'color:var(--text,#e5e7eb);padding:10px 12px;border-radius:var(--r-md,10px);',
      'font-size:12.5px;line-height:1.55;}',
      '.spx-note.bad{border-left-color:var(--spx-bad-br);background:var(--spx-bad-bg);}',
      '.spx-note.ok{border-left-color:var(--spx-ok-br);background:var(--spx-ok-bg);}',
      '.spx-note.acc{border-left-color:var(--spx-acc-br);background:var(--spx-acc-bg);}',
      '.spx-empty{padding:22px;text-align:center;color:var(--text3,#6b7280);font-size:13px;}',
      '.spx-input{width:100%;background:var(--surface2,#0f172a);color:var(--text,#e5e7eb);',
      'border:1px solid var(--border,#243043);border-radius:var(--r-md,10px);padding:10px 12px;',
      'font-size:14px;font-family:inherit;min-height:44px;box-sizing:border-box;}',
      '.spx-ta{width:100%;background:var(--surface2,#0f172a);color:var(--text,#e5e7eb);',
      'border:1px solid var(--border,#243043);border-radius:var(--r-md,10px);padding:10px 12px;',
      'font-size:13.5px;font-family:inherit;line-height:1.5;min-height:74px;resize:vertical;',
      'box-sizing:border-box;}',

      /* ---- the permanent, non-dismissible practice-only label ---- */
      '.spx-onlylabel{position:sticky;top:0;z-index:9;display:flex;align-items:center;gap:8px;',
      'background:var(--spx-warn-bg);border:1px solid var(--spx-warn-br);',
      'color:var(--spx-warn-fg);border-radius:var(--r-md,10px);padding:8px 12px;',
      'font-size:12px;font-weight:800;letter-spacing:.3px;line-height:1.4;margin-bottom:10px;}',
      '.spx-onlylabel .spx-oltag{flex:0 0 auto;font-size:10px;padding:2px 6px;border-radius:6px;',
      'background:var(--spx-warn-br);color:var(--text,#e5e7eb);}',
      '.spx-onlyfoot{position:fixed;left:0;right:0;bottom:0;z-index:8;text-align:center;',
      'background:var(--spx-warn-bg);border-top:1px solid var(--spx-warn-br);',
      'color:var(--spx-warn-fg);font-size:11px;font-weight:800;letter-spacing:.3px;',
      'padding:5px 10px;pointer-events:none;}',

      /* ---- picker ---- */
      '.spx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;}',
      '.spx-tile{background:var(--surface,#111827);border:1px solid var(--border,#243043);',
      'color:var(--text,#e5e7eb);border-radius:var(--r-lg,14px);padding:14px;cursor:pointer;',
      'text-align:left;display:flex;flex-direction:column;gap:8px;width:100%;',
      'transition:border-color .16s ease,transform .16s ease;}',
      '.spx-tile:hover{border-color:var(--accent,#3b82f6);}',
      '.spx-tile:active{transform:scale(.99);}',
      '.spx-tile .spx-t{font-size:14.5px;font-weight:800;line-height:1.35;',
      'color:var(--text,#e5e7eb);display:block;}',
      '.spx-tile .spx-d{font-size:12px;color:var(--text2,#9ca3af);line-height:1.5;display:block;}',

      /* ---- runner shell ---- */
      '.spx-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;',
      'background:var(--surface,#111827);border:1px solid var(--border,#243043);',
      'border-radius:var(--r-lg,14px);padding:10px 12px;color:var(--text,#e5e7eb);',
      'position:sticky;top:0;z-index:6;}',
      '.spx-clock{font-variant-numeric:tabular-nums;font-weight:800;font-size:22px;',
      'letter-spacing:.5px;color:var(--text,#e5e7eb);}',
      '.spx-clock.low{color:var(--spx-bad-fg);}',
      '.spx-state{font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;',
      'padding:3px 9px;border-radius:999px;border:1px solid var(--spx-acc-br);',
      'background:var(--spx-acc-bg);color:var(--accent-fg,#93c5fd);}',
      '.spx-state.deteriorating{border-color:var(--spx-warn-br);background:var(--spx-warn-bg);',
      'color:var(--spx-warn-fg);}',
      '.spx-state.critical_event{border-color:var(--spx-bad-br);background:var(--spx-bad-bg);',
      'color:var(--spx-bad-fg);}',
      '.spx-state.stabilized_or_transferred{border-color:var(--spx-ok-br);',
      'background:var(--spx-ok-bg);color:var(--spx-ok-fg);}',
      '.spx-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,340px);gap:12px;',
      'margin-top:12px;align-items:start;}',
      '.spx-side{display:flex;flex-direction:column;gap:12px;}',

      /* ---- actions ---- */
      '.spx-acts{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;',
      'max-height:340px;overflow-y:auto;padding-right:2px;}',
      '.spx-act{background:var(--surface2,#0f172a);border:1px solid var(--border,#243043);',
      'color:var(--text,#e5e7eb);border-radius:var(--r-md,10px);padding:10px 12px;cursor:pointer;',
      'text-align:left;font-size:13px;font-weight:700;min-height:48px;width:100%;',
      'transition:border-color .15s ease,transform .15s ease;}',
      '.spx-act:hover{border-color:var(--accent,#3b82f6);}',
      '.spx-act .spx-al{display:block;font-size:13px;font-weight:700;line-height:1.35;',
      'color:var(--text,#e5e7eb);}',
      '.spx-act .spx-ac{display:block;font-size:10.5px;font-weight:700;letter-spacing:.3px;',
      'text-transform:uppercase;color:var(--text3,#6b7280);margin-top:3px;}',
      '.spx-act.done{border-color:var(--spx-ok-br);background:var(--spx-ok-bg);',
      'color:var(--text,#e5e7eb);}',
      '.spx-act.crit{border-left:3px solid var(--spx-acc-br);}',
      '.spx-act.armed{border-color:var(--spx-warn-br);background:var(--spx-warn-bg);',
      'color:var(--text,#e5e7eb);animation:spxShake .34s ease;}',
      '@keyframes spxShake{0%,100%{transform:translateX(0);}20%{transform:translateX(-5px);}',
      '45%{transform:translateX(4px);}70%{transform:translateX(-2px);}}',
      '@media (prefers-reduced-motion:reduce){.spx-act.armed{animation:none;',
      'box-shadow:0 0 0 2px var(--spx-warn-br);}.spx-btn:active{transform:none;}}',

      /* ---- log / transcript ---- */
      '.spx-log{max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;}',
      '.spx-line{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.5;',
      'color:var(--text,#e5e7eb);border-left:2px solid var(--border,#243043);padding-left:8px;}',
      '.spx-line.warn{border-left-color:var(--spx-warn-br);}',
      '.spx-line.bad{border-left-color:var(--spx-bad-br);}',
      '.spx-line.good{border-left-color:var(--spx-ok-br);}',
      '.spx-line .spx-tt{flex:0 0 auto;font-variant-numeric:tabular-nums;color:var(--text3,#6b7280);',
      'font-size:11px;padding-top:2px;}',
      '.spx-line .spx-lb{color:var(--text,#e5e7eb);}',
      '.spx-line .spx-ld{display:block;color:var(--text2,#9ca3af);font-size:12px;margin-top:2px;}',

      /* ---- chart ---- */
      '.spx-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}',
      '.spx-tab{background:var(--surface2,#0f172a);border:1px solid var(--border,#243043);',
      'color:var(--text2,#9ca3af);border-radius:999px;padding:6px 12px;font-size:12px;',
      'font-weight:700;cursor:pointer;min-height:38px;}',
      '.spx-tab[aria-pressed="true"]{background:var(--accent,#3b82f6);',
      'border-color:var(--accent,#3b82f6);color:var(--text-on-fill,#ffffff);}',
      '.spx-tbl{width:100%;border-collapse:collapse;font-size:12.5px;color:var(--text,#e5e7eb);}',
      '.spx-tbl th{text-align:left;font-size:10.5px;letter-spacing:.4px;text-transform:uppercase;',
      'color:var(--text3,#6b7280);padding:5px 8px;border-bottom:1px solid var(--border,#243043);}',
      '.spx-tbl td{padding:5px 8px;border-bottom:1px solid var(--border,#243043);',
      'color:var(--text,#e5e7eb);vertical-align:top;}',
      '.spx-locked{color:var(--text3,#6b7280);font-style:italic;}',

      /* ---- coach mode ---- */
      '.spx-coach{display:flex;flex-direction:column;gap:12px;padding-bottom:34px;}',
      '.spx-coachtop{display:flex;align-items:center;gap:12px;flex-wrap:wrap;',
      'background:var(--surface,#111827);border:1px solid var(--border,#243043);',
      'border-radius:var(--r-lg,14px);padding:12px;color:var(--text,#e5e7eb);',
      'position:sticky;top:0;z-index:6;}',
      '.spx-bigclock{font-variant-numeric:tabular-nums;font-weight:900;font-size:44px;',
      'line-height:1;letter-spacing:1px;color:var(--text,#e5e7eb);}',
      '.spx-bigclock.low{color:var(--spx-bad-fg);}',
      '.spx-bigcard{background:var(--surface,#111827);border:2px solid var(--spx-acc-br);',
      'border-radius:var(--r-lg,14px);padding:20px;text-align:center;min-height:150px;',
      'display:flex;flex-direction:column;justify-content:center;gap:10px;',
      'color:var(--text,#e5e7eb);}',
      '.spx-bigcard .spx-step{font-size:24px;font-weight:900;line-height:1.25;',
      'color:var(--text,#e5e7eb);}',
      '.spx-bigcard .spx-meta{font-size:12px;font-weight:800;letter-spacing:.4px;',
      'text-transform:uppercase;color:var(--text2,#9ca3af);}',
      '.spx-coachbar{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;}',
      '.spx-coachbar .spx-btn{text-align:center;min-height:58px;font-size:13px;font-weight:800;}',
      '.spx-mic{background:var(--surface2,#0f172a);border:1px solid var(--border,#243043);',
      'color:var(--text2,#9ca3af);border-radius:999px;padding:7px 14px;font-size:12px;',
      'font-weight:800;cursor:pointer;min-height:40px;}',
      '.spx-mic.on{background:var(--spx-bad-bg);border-color:var(--spx-bad-br);',
      'color:var(--spx-bad-fg);}',
      '.spx-heard{font-size:12.5px;color:var(--text2,#9ca3af);line-height:1.5;min-height:18px;}',

      /* ---- debrief ---- */
      '.spx-score{display:flex;flex-wrap:wrap;gap:10px;}',
      '.spx-scell{flex:1 1 150px;background:var(--surface2,#0f172a);',
      'border:1px solid var(--border,#243043);border-radius:var(--r-md,10px);padding:10px 12px;',
      'color:var(--text,#e5e7eb);}',
      '.spx-scell .spx-sn{display:block;font-size:11px;font-weight:800;letter-spacing:.3px;',
      'text-transform:uppercase;color:var(--text3,#6b7280);}',
      '.spx-scell .spx-sv{display:block;font-size:20px;font-weight:900;',
      'color:var(--text,#e5e7eb);font-variant-numeric:tabular-nums;}',
      '.spx-prov{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.3px;',
      'text-transform:uppercase;padding:2px 6px;border-radius:5px;margin-left:6px;',
      'border:1px solid var(--border,#243043);background:var(--surface2,#0f172a);',
      'color:var(--text2,#9ca3af);}',
      '.spx-prov.school_file{border-color:var(--spx-ok-br);color:var(--spx-ok-fg);',
      'background:var(--spx-ok-bg);}',
      '.spx-prov.generated_supplemental_practice{border-color:var(--spx-warn-br);',
      'color:var(--spx-warn-fg);background:var(--spx-warn-bg);}',
      '.spx-prov.instructor_override{border-color:var(--spx-acc-br);',
      'color:var(--accent-fg,#93c5fd);background:var(--spx-acc-bg);}',
      '.spx-list{margin:6px 0 0;padding-left:18px;font-size:12.5px;line-height:1.6;',
      'color:var(--text,#e5e7eb);}',
      '.spx-list li{margin-bottom:3px;}',

      /* ---- narrow ---- */
      '@media (max-width:900px){.spx-cols{grid-template-columns:minmax(0,1fr);}',
      '.spx-acts{max-height:none;overflow:visible;}',
      '.spx-bigclock{font-size:36px;}}',
      '@media (max-width:400px){.spx-bigcard .spx-step{font-size:20px;}}'
    ].join('');

    try {
      var tag = document.createElement('style');
      tag.id = 'simprep-sim-styles';
      tag.textContent = css;
      (document.head || document.documentElement).appendChild(tag);
    } catch (e) {}
  }

  /* ==========================================================================
   * 3. CONTENT ACCESS  (feature-detected; a missing global is never a crash)
   * ======================================================================== */

  function allScenarios() {
    var g = window.NUR2212_SCENARIOS;
    if (!g) { return []; }
    var list = arr(g);
    if (!list.length && obj(g).scenarios) { list = arr(obj(g).scenarios); }
    return list.filter(function (s) { return !!str(obj(s).topic_id); });
  }
  function contentOk() { return allScenarios().length > 0; }
  function scenarioById(id) {
    var want = str(id), list = allScenarios(), i;
    for (i = 0; i < list.length; i++) {
      if (str(list[i].topic_id) === want) { return list[i]; }
    }
    return null;
  }
  function provenanceOf(sc) {
    var p = lower(obj(sc).provenance);
    if (p === 'school_file' || p === 'instructor_override') { return p; }
    return p ? p : 'generated_supplemental_practice';
  }
  var PROV_LABEL = {
    school_file: 'School source',
    generated_supplemental_practice: 'Supplemental',
    instructor_override: 'Instructor override'
  };
  function provenanceLabel(sc) {
    return PROV_LABEL[provenanceOf(sc)] || 'Supplemental';
  }
  function durationMinutes(sc) {
    return clamp(Math.round(numOr(obj(sc).duration_minutes, 20)), 1, 120);
  }

  /* Study-mode cross-links. window.SimPrepStudy is written by another module
     and may expose any of several shapes, or none at all. */
  function studyLink(topicId, sectionKey, label) {
    var S = window.SimPrepStudy;
    var base = { topicId: str(topicId), section: str(sectionKey), label: str(label), href: '' };
    if (!S) { return null; }
    try {
      if (isFn(S.linkFor)) { return obj(S.linkFor(topicId, sectionKey)) || base; }
      if (isFn(S.sectionFor)) {
        var sec = S.sectionFor(topicId, sectionKey);
        if (sec) { base.section = str(obj(sec).id || sectionKey); base.label = str(obj(sec).title || label); }
        return base;
      }
      if (isFn(S.hasTopic) && !S.hasTopic(topicId)) { return null; }
    } catch (e) { return base; }
    return base;
  }

  /* ==========================================================================
   * 4. THE FACT LEDGER
   * --------------------------------------------------------------------------
   * Every atomic, revealable fact in a scenario, each with a stable key, the
   * assessment DOMAIN that uncovers it, and its provenance. This single list is
   * what the chart renders, what the reveal ledger keys on, and what the
   * no-hallucination guard checks candidate AI prose against.
   * ======================================================================== */

  /* Domains a physical assessment can uncover. */
  var D_AIRWAY   = 'airway';
  var D_LUNGS    = 'lungs';
  var D_CARDIO   = 'cardio';
  var D_PERFUSE  = 'perfusion';
  var D_NEURO    = 'neuro';
  var D_PAIN     = 'pain';
  var D_ABD      = 'abdomen';
  var D_GU       = 'urinary';
  var D_GENERAL  = 'general';
  var D_LAB      = 'labs';
  var D_CHART    = 'chart';
  var D_VITALS   = 'vitals';

  var DOMAIN_LABEL = {};
  DOMAIN_LABEL[D_AIRWAY] = 'Airway';
  DOMAIN_LABEL[D_LUNGS] = 'Lung sounds and breathing';
  DOMAIN_LABEL[D_CARDIO] = 'Cardiovascular';
  DOMAIN_LABEL[D_PERFUSE] = 'Skin and perfusion';
  DOMAIN_LABEL[D_NEURO] = 'Neuro and pupils';
  DOMAIN_LABEL[D_PAIN] = 'Pain and symptoms';
  DOMAIN_LABEL[D_ABD] = 'Abdomen and GI';
  DOMAIN_LABEL[D_GU] = 'Urinary output';
  DOMAIN_LABEL[D_GENERAL] = 'General appearance';
  DOMAIN_LABEL[D_LAB] = 'Laboratory data';
  DOMAIN_LABEL[D_CHART] = 'Chart, orders and MAR';
  DOMAIN_LABEL[D_VITALS] = 'Vital signs';

  /* Keyword -> domain. Ordered: the FIRST list that matches wins, so the
     narrow systems are tested before the catch-alls. */
  var DOMAIN_KEYS = [
    [D_AIRWAY,  ['airway', 'aspirat', 'stridor', 'gurgl', 'secretion', 'suction', 'intubat',
                 'protect the airway', 'emesis in the mouth']],
    [D_LUNGS,   ['lung', 'breath sound', 'crackle', 'rale', 'wheez', 'rhonchi', 'diminish',
                 'auscult', 'respirat', 'dyspnea', 'shortness of breath', 'sob', 'tachypn',
                 'accessory muscle', 'retract', 'cough', 'sputum', 'spo2', 'o2 sat', 'oxygen',
                 'desat', 'hypox', 'work of breathing', 'chest expansion']],
    [D_NEURO,   ['pupil', 'perrla', 'neuro', 'loc', 'level of consciousness', 'conscious',
                 'confus', 'lethargic', 'obtund', 'orient', 'gcs', 'posturing', 'seizure',
                 'somnolen', 'asterixis', 'encephalopath', 'mental status', 'syncope']],
    [D_PAIN,    ['pain', 'ache', 'aching', 'tender', 'discomfort', 'guard', 'rebound',
                 'cramp', 'rovsing', 'burning', 'sore']],
    [D_PERFUSE, ['pale', 'pallor', 'diaphor', 'clammy', 'cool extrem', 'cap refill',
                 'capillary refill', 'cyanos', 'mottl', 'jaundice', 'petechia', 'ecchymos',
                 'bruis', 'skin', 'edema', 'turgor', 'oozing', 'bleeding from']],
    [D_CARDIO,  ['tachycard', 'bradycard', 'blood pressure', 'hypotens', 'hyperten', 'pulse',
                 'rhythm', 'jvd', 'jugular', 'murmur', 'map', 'perfusion', 'cardiac', 'heart']],
    [D_ABD,     ['emesis', 'hematemesis', 'melena', 'nausea', 'vomit', 'stool', 'abdom',
                 'bowel', 'distend', 'npo', 'ascites', 'gi ', 'gastric', 'ostomy', 'flatus',
                 'appendic', 'mcburney', 'incision']],
    [D_GU,      ['urine', 'urinary', 'output', 'foley', 'oliguri', 'anuri', 'catheter',
                 'intake and output']],
    [D_GENERAL, ['weak', 'fatigue', 'dizz', 'anxious', 'restless', 'fever', 'chills',
                 'malaise', 'appear', 'diaphoresis']]
  ];

  function domainOf(text, fallback) {
    var t = lower(text);
    var i, j, keys;
    for (i = 0; i < DOMAIN_KEYS.length; i++) {
      keys = DOMAIN_KEYS[i][1];
      for (j = 0; j < keys.length; j++) {
        if (t.indexOf(keys[j]) !== -1) { return DOMAIN_KEYS[i][0]; }
      }
    }
    return fallback || D_GENERAL;
  }

  /**
   * buildFacts(sc) -> the fact ledger + the traceability corpus.
   * Pure, cheap and memoised per scenario object.
   */
  var FACT_CACHE = [];
  function buildFacts(sc) {
    var s = obj(sc), i;
    for (i = 0; i < FACT_CACHE.length; i++) {
      if (FACT_CACHE[i].sc === s) { return FACT_CACHE[i].facts; }
    }
    var built = buildFactsUncached(s);
    FACT_CACHE.push({ sc: s, facts: built });
    if (FACT_CACHE.length > 24) { FACT_CACHE.shift(); }
    return built;
  }

  function buildFactsUncached(s) {
    var facts = [];
    var prov = provenanceOf(s);

    function push(key, kind, text, domain, source) {
      if (!str(text)) { return; }
      facts.push({
        key: key, kind: kind, text: str(text), domain: domain,
        provenance: prov, source: str(source || obj(s).source_file)
      });
    }

    /* The handoff itself is visible from the start - it is the report. */
    push('intro', 'intro', str(s.case_intro), D_GENERAL);

    arr(s.initial_findings).forEach(function (f, i2) {
      push('finding:' + i2, 'finding', str(f), domainOf(f, D_GENERAL));
    });
    arr(s.vital_trends).forEach(function (v, i2) {
      var o = obj(v);
      var txt = str(o.time) + ' - BP ' + str(o.bp) + ', HR ' + str(o.hr) + ', RR ' + str(o.rr) +
        ', SpO2 ' + str(o.spo2) + ', Temp ' + str(o.temp);
      push('vital:' + i2, 'vital', txt, D_VITALS);
    });
    arr(s.labs).forEach(function (l, i2) {
      var o = obj(l);
      push('lab:' + i2, 'lab', str(o.test) + ': ' + str(o.result) +
        (str(o.interpretation) ? ' (' + str(o.interpretation) + ')' : ''), D_LAB);
    });
    arr(s.diagnostics).forEach(function (d, i2) {
      push('dx:' + i2, 'diagnostic', str(d), D_LAB);
    });
    arr(s.orders).forEach(function (o, i2) {
      push('order:' + i2, 'order', str(o), D_CHART);
    });
    arr(s.mar).forEach(function (m, i2) {
      push('mar:' + i2, 'mar', str(m), D_CHART);
    });
    arr(s.deterioration_cues).forEach(function (c, i2) {
      push('cue:' + i2, 'cue', str(c), domainOf(c, D_GENERAL));
    });

    /* ---- the traceability corpus -------------------------------------- *
     * Only AUTHORED CLINICAL PROSE goes in. Scoring weights, durations and
     * schema plumbing deliberately do not, or "30" would become a traceable
     * clinical number and the dose guard would have a hole in it.
     * ------------------------------------------------------------------- */
    var corpusParts = [str(s.title), str(s.case_intro)];
    ['initial_findings', 'diagnostics', 'orders', 'mar', 'deterioration_cues',
      'sbar_expected', 'debrief_points', 'exam_mode_rules', 'source_discrepancies']
      .forEach(function (k) {
        arr(s[k]).forEach(function (v) { corpusParts.push(str(v)); });
      });
    arr(s.vital_trends).forEach(function (v) {
      var o = obj(v);
      corpusParts.push(str(o.time) + ' ' + str(o.bp) + ' ' + str(o.hr) + ' ' + str(o.rr) +
        ' ' + str(o.spo2) + ' ' + str(o.temp));
    });
    arr(s.labs).forEach(function (l) {
      var o = obj(l);
      corpusParts.push(str(o.test) + ' ' + str(o.result) + ' ' + str(o.interpretation));
    });
    arr(s.allowed_action_intents).forEach(function (a) { corpusParts.push(str(obj(a).label)); });
    arr(s.provider_branches).forEach(function (b) {
      var o = obj(b);
      corpusParts.push(str(o.response));
      arr(o.orders).forEach(function (x) { corpusParts.push(str(x)); });
    });
    var lesson = obj(s.lesson);
    keysOf(lesson).forEach(function (k) {
      var v = lesson[k];
      if (typeof v === 'string') { corpusParts.push(v); }
      else if (Object.prototype.toString.call(v) === '[object Array]') {
        v.forEach(function (x) { if (typeof x === 'string') { corpusParts.push(x); } });
      }
    });

    var corpusRaw = corpusParts.join(' \n ');
    var corpus = normText(corpusRaw.replace(/,(?=\d)/g, ''));

    return {
      sc: s,
      facts: facts,
      byKey: (function () {
        var m = {};
        facts.forEach(function (f) { m[f.key] = f; });
        return m;
      })(),
      corpus: corpus,
      corpusTight: corpus.replace(/\s+/g, ''),
      numbers: numberSet(corpus),
      pairs: unitPairSet(corpus),
      meds: medLexicon(s),
      labTests: (function () {
        var m = {};
        arr(s.labs).forEach(function (l) {
          normText(obj(l).test).split(' ').forEach(function (w) { if (w) { m[w] = true; } });
          m[normText(obj(l).test)] = true;
        });
        return m;
      })(),
      provenance: prov
    };
  }

  function numberSet(normalized) {
    var m = {}, re = /\d+(?:\.\d+)?/g, x;
    while ((x = re.exec(normalized))) { m[x[0]] = true; }
    return m;
  }

  var UNIT_RE = '(%|mg\\/kg|mcg\\/kg|mg|mcg|mg\\b|g|kg|ml|l|units?|unit|meq|mmol|mmhg|gtt|bpm|lpm|cm|mm|f|c)';
  function unitPairSet(normalized) {
    var m = {}, re = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + UNIT_RE, 'g'), x;
    while ((x = re.exec(normalized))) { m[x[1] + normUnit(x[2])] = true; }
    return m;
  }
  function normUnit(u) {
    var t = lower(u).replace(/\s+/g, '');
    if (t === 'units' || t === 'unit') { return 'unit'; }
    if (t === 'ml') { return 'ml'; }
    if (t === 'l') { return 'l'; }
    return t;
  }

  /* --------------------------------------------------------------------------
   * Medication lexicon. Built from the scenario's own orders and MAR - those
   * are the ONLY medications that exist inside a run. COMMON_MEDS and the
   * suffix list exist purely so the guard can RECOGNISE a drug name the
   * scenario does not contain and reject it; they never authorise anything.
   * ------------------------------------------------------------------------ */
  var COMMON_MEDS = ('acetaminophen tylenol ibuprofen morphine hydromorphone dilaudid fentanyl'
    + ' ketorolac toradol naloxone narcan furosemide lasix bumetanide spironolactone'
    + ' metoprolol carvedilol labetalol hydralazine nitroglycerin nitroprusside amiodarone'
    + ' adenosine atropine epinephrine norepinephrine levophed dopamine dobutamine vasopressin'
    + ' heparin enoxaparin lovenox warfarin coumadin alteplase tpa protamine vitamin'
    + ' pantoprazole protonix famotidine pepcid ondansetron zofran promethazine phenergan'
    + ' octreotide vasopressin lactulose rifaximin albumin insulin regular lantus glucagon'
    + ' dextrose d50 potassium chloride magnesium calcium bicarbonate sodium saline'
    + ' vancomycin piperacillin tazobactam zosyn ceftriaxone rocephin cefazolin ancef'
    + ' meropenem levofloxacin ciprofloxacin azithromycin metronidazole flagyl gentamicin'
    + ' methylprednisolone solumedrol prednisone dexamethasone hydrocortisone albuterol'
    + ' ipratropium duoneb budesonide mannitol hypertonic levetiracetam keppra phenytoin'
    + ' propofol midazolam versed lorazepam ativan dexmedetomidine precedex succinylcholine'
    + ' rocuronium vecuronium ondansetron docusate senna polyethylene lactated ringers'
    + ' cryoprecipitate platelets plasma ffp prbc prbcs').split(' ');
  var COMMON_MED_MAP = {};
  COMMON_MEDS.forEach(function (m) { if (m) { COMMON_MED_MAP[m] = true; } });

  /* Only STRONG drug suffixes. The weak ones (-ine, -one, -ide, -ol, -ase)
     match "line", "done", "side", "protocol" and "increase", and a false
     positive here would charge a student a safety penalty for saying "I check
     the line" - so they are deliberately absent. A drug this heuristic misses
     is caught by COMMON_MEDS or, failing that, by the dose and number guards. */
  var MED_SUFFIX = /(?:cillin|mycin|oxacin|prazole|azole|sartan|pril|olol|statin|parin|setron|dipine|tidine|caine|zepam|zolam|micin|cycline|mab|nib|tropium|terol)$/;
  var MED_STOPWORDS = {
    protocol: true, control: true, alcohol: true, symbol: true, capital: true,
    hospital: true, careful: true, painful: true, helpful: true
  };

  function looksLikeMed(w) {
    var t = lower(w);
    if (COMMON_MED_MAP[t]) { return true; }
    if (t.length < 7) { return false; }
    if (MED_STOPWORDS[t] === true) { return false; }
    return MED_SUFFIX.test(t);
  }

  function medLexicon(s) {
    var m = {};
    function scan(line) {
      var src = str(line);
      words(src).forEach(function (w) {
        if (COMMON_MED_MAP[w]) { m[w] = src; }
        else if (looksLikeMed(w)) { m[w] = src; }
      });
      /* two-word fluid names the token scan splits apart */
      var n = normText(src);
      ['normal saline', 'sodium chloride', 'lactated ringers', 'packed red',
        'whole blood', 'fresh frozen'].forEach(function (p) {
          if (n.indexOf(p) !== -1) { m[p] = src; }
        });
    }
    arr(obj(s).orders).forEach(scan);
    arr(obj(s).mar).forEach(scan);
    arr(obj(s).provider_branches).forEach(function (b) { arr(obj(b).orders).forEach(scan); });
    return m;
  }

  /**
   * namedMedIn(text, facts) -> {name, ordered, source} or null.
   * `ordered` is true only when the medication appears in this scenario's own
   * orders or MAR. Nothing here ever creates an order.
   */
  function namedMedIn(text, facts) {
    var f = obj(facts);
    var lex = obj(f.meds);
    var n = normText(text);
    var found = null;
    keysOf(lex).forEach(function (name) {
      if (found) { return; }
      if (n.indexOf(name) !== -1) { found = { name: name, ordered: true, source: str(lex[name]) }; }
    });
    if (found) { return found; }
    var ws = words(n), i, w, rel;
    for (i = 0; i < ws.length; i++) {
      w = ws[i];
      if (!looksLikeMed(w) || lex[w]) { continue; }
      /* "PRBC" and "PRBCs" are the same product. A singular/plural or stem
         mismatch against the scenario's own MAR must never be read as an
         unordered medication - that would charge a safety penalty for a
         critical action the sheet explicitly orders. */
      rel = null;
      keysOf(lex).forEach(function (k) {
        if (rel || k.length < 4 || w.length < 4) { return; }
        if (k.indexOf(w) === 0 || w.indexOf(k) === 0) { rel = k; }
      });
      if (rel) { return { name: w, ordered: true, source: str(lex[rel]) }; }
      return { name: w, ordered: false, source: '' };
    }
    return null;
  }

  /* ==========================================================================
   * 5. THE NO-HALLUCINATION GUARD
   * --------------------------------------------------------------------------
   * Two layers. Layer 1 (validateAIReply) is a key allow-list on the parsed
   * object: nothing outside five known fields can reach the caller, so there is
   * no code path at all from a model-invented `orders` array to patient state.
   * Layer 2 (sanitizeAIText) is source traceability on the one free-text field.
   *
   * WHAT LAYER 2 CANNOT CATCH, stated plainly so nobody assumes otherwise:
   *   - Plausible non-clinical prose. "You look tired" carries no number, no
   *     drug, no lab, no listed finding, so it passes. That is by design; it is
   *     bedside manner, not a fact claim.
   *   - A wrong INFERENCE built only from true facts ("your Hgb of 6.8 means
   *     you need surgery"). Every token is traceable; the conclusion is not.
   *     Practice mode marks AI prose as coaching, never as chart data, and the
   *     debrief always cites the source fact behind a scored item.
   *   - A finding phrased in words the scenario never uses AND that is not in
   *     FINDING_TERMS. The term list is broad, but it is a list.
   * The engine's defence against all three is structural: AI prose is never a
   * fact source. Only the ledger is.
   * ======================================================================== */

  var V_ORDER = 'order', V_MED = 'medication', V_DOSE = 'dose', V_LAB = 'lab',
      V_VITAL = 'vital', V_DEVICE = 'device', V_ALLERGY = 'allergy',
      V_CODE = 'code_status', V_FINDING = 'finding', V_HIDDEN = 'hidden',
      V_NUMBER = 'number', V_KEY = 'rejected_key', V_INTENT = 'intent';

  /* Keys a model reply may contain. Everything else is discarded outright. */
  var REPLY_ALLOWED_KEYS = ['intent', 'target', 'confidence', 'requires_order',
    'matched_source_fact', 'say', 'clarify'];
  /* Keys that, if present at all, are recorded as fabrication attempts. */
  var REPLY_FORBIDDEN_KEYS = {
    orders: V_ORDER, new_orders: V_ORDER, order: V_ORDER, provider_orders: V_ORDER,
    medication: V_MED, medications: V_MED, meds: V_MED, mar: V_MED,
    dose: V_DOSE, doses: V_DOSE, route: V_DOSE, rate: V_DOSE,
    lab: V_LAB, labs: V_LAB, lab_values: V_LAB, results: V_LAB, diagnostics: V_LAB,
    vitals: V_VITAL, vital_signs: V_VITAL, bp: V_VITAL, hr: V_VITAL, spo2: V_VITAL,
    rr: V_VITAL, temp: V_VITAL,
    allergies: V_ALLERGY, allergy: V_ALLERGY,
    code_status: V_CODE, code: V_CODE,
    device: V_DEVICE, device_settings: V_DEVICE, vent_settings: V_DEVICE,
    fio2: V_DEVICE, peep: V_DEVICE,
    findings: V_FINDING, new_findings: V_FINDING, reveal: V_FINDING,
    diagnosis: V_FINDING, state: V_FINDING, score: V_FINDING, deterioration: V_FINDING
  };

  var ORDER_CLAIM_RE = new RegExp(
    '\\b(new order|newly ordered|orders? (?:are|is|for|to)|the (?:provider|doctor|physician|md|np|pa|hospitalist|intensivist|surgeon)'
    + ' (?:orders?|ordered|wants|says to|would like|has ordered|is ordering)'
    + '|i(?:\'m| am|ll| will)? ?(?:going to )?(?:order|prescrib)'
    + '|let(?:\'s| us) (?:start|give|hang|push|order)'
    + '|go ahead and (?:give|start|hang|push)'
    + '|stat order|verbal order|standing order|per (?:the )?(?:new )?order)\\b', 'i');

  var LAB_TERMS = ('hemoglobin hgb hct hematocrit platelet platelets wbc rbc inr pt aptt ptt'
    + ' potassium sodium chloride bicarb bicarbonate bun creatinine glucose lactate lactic'
    + ' troponin bnp ammonia bilirubin albumin ast alt alkaline amylase lipase d-dimer'
    + ' fibrinogen abg ph pco2 po2 paco2 pao2 magnesium calcium phosphate culture'
    + ' procalcitonin crp esr').split(' ');
  var VITAL_TERMS = ('bp blood pressure map heart rate hr pulse rr respiratory rate respirations'
    + ' spo2 sat sats saturation oxygen temperature temp afebrile febrile').split(' ');
  var DEVICE_TERMS = ('fio2 peep tidal volume ventilator vent nasal cannula non-rebreather'
    + ' rebreather venturi bipap cpap high-flow liters l/min lpm suction pacer pacing'
    + ' defibrillator joules drip infusion pump').split(' ');
  /* Qualitative clinical assertions. If one of these words appears, the claim
     must be traceable to the scenario's own prose. Deliberately excludes
     everyday words like "clear" and "absent" - the cost of a false positive is
     a dropped sentence of bedside manner, but the cost of a term list padded
     with English is a guard nobody trusts. */
  var FINDING_TERMS = ('crackles rales wheezing wheezes rhonchi stridor diminished'
    + ' pupils perrla sluggish nonreactive anisocoria'
    + ' guarding rebound rigid distended hyperactive hypoactive tympanic'
    + ' jaundiced icteric cyanotic mottled diaphoretic clammy ashen'
    + ' jvd jugular murmur gallop edema pitting petechiae ecchymosis purpura'
    + ' melena hematemesis hematochezia hematuria asterixis posturing decerebrate'
    + ' decorticate nuchal photophobia mcburney rovsing psoas obturator turgor').split(' ');

  /* Sentence split without lookbehind: a lookbehind literal is a PARSE error on
     older engines, which would take the whole module down before the try/catch
     around it could ever run. */
  function sentencesOf(text) {
    var t = str(text).replace(/\s+/g, ' ').trim();
    if (!t) { return []; }
    var out = [], buf = '', i, ch, nx;
    for (i = 0; i < t.length; i++) {
      ch = t.charAt(i);
      buf += ch;
      if (ch === '.' || ch === '!' || ch === '?') {
        nx = t.charAt(i + 1);
        if (nx === '' || nx === ' ') {
          if (buf.trim()) { out.push(buf.trim()); }
          buf = '';
        }
      }
    }
    if (buf.trim()) { out.push(buf.trim()); }
    return out;
  }

  function hasTerm(normalized, term) {
    var t = lower(term);
    if (t.indexOf(' ') !== -1 || t.indexOf('/') !== -1 || t.indexOf('-') !== -1) {
      return normalized.indexOf(t) !== -1;
    }
    return new RegExp('(^| )' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($| )').test(normalized);
  }
  function anyTerm(normalized, list) {
    var i;
    for (i = 0; i < list.length; i++) { if (hasTerm(normalized, list[i])) { return list[i]; } }
    return '';
  }

  /**
   * checkSentence(sentence, facts, revealed) -> [violations]
   * Empty array means every claim in the sentence is traceable to the scenario
   * object AND already uncovered by the learner.
   */
  function checkSentence(sentence, facts, revealed) {
    var f = obj(facts);
    var out = [];
    var raw = str(sentence);
    var n = normText(raw.replace(/,(?=\d)/g, ''));
    if (!n) { return out; }

    /* --- untraceable numbers ------------------------------------------- */
    var re = /\d+(?:\.\d+)?/g, m, nums = [];
    while ((m = re.exec(n))) { nums.push(m[0]); }
    var bad = [];
    nums.forEach(function (x) { if (!obj(f.numbers)[x]) { bad.push(x); } });

    /* --- untraceable value+unit pairs (a fabricated DOSE) --------------- */
    var pre = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + UNIT_RE, 'g'), p;
    var badPairs = [];
    while ((p = pre.exec(n))) {
      var key = p[1] + normUnit(p[2]);
      if (!obj(f.pairs)[key]) { badPairs.push(key); }
    }
    if (badPairs.length) {
      out.push({ kind: V_DOSE, token: badPairs.join(', '),
        why: 'a quantity with a unit that does not appear anywhere in this scenario' });
    }

    /* --- fabricated medication ------------------------------------------ */
    var med = namedMedIn(n, f);
    if (med && !med.ordered) {
      out.push({ kind: V_MED, token: med.name,
        why: 'names a medication that is not in this scenario\'s orders or MAR' });
    }

    /* --- a claimed provider order --------------------------------------- */
    if (ORDER_CLAIM_RE.test(raw)) {
      if (!traceableOrderClaim(n, f)) {
        out.push({ kind: V_ORDER, token: cut(raw, 90),
          why: 'states a provider order that is not pre-authored in this scenario' });
      }
    }

    /* --- lab / vital / device claims carrying an untraceable number ----- */
    if (bad.length || badPairs.length) {
      var labTerm = anyTerm(n, LAB_TERMS);
      var vitalTerm = anyTerm(n, VITAL_TERMS);
      var devTerm = anyTerm(n, DEVICE_TERMS);
      if (!bad.length) { bad = badPairs.slice(); }
      if (labTerm) {
        out.push({ kind: V_LAB, token: labTerm + ' ' + bad.join(', '),
          why: 'reports a laboratory value this scenario does not contain' });
      }
      if (vitalTerm) {
        out.push({ kind: V_VITAL, token: vitalTerm + ' ' + bad.join(', '),
          why: 'reports a vital sign this scenario does not contain' });
      }
      if (devTerm) {
        out.push({ kind: V_DEVICE, token: devTerm + ' ' + bad.join(', '),
          why: 'reports a device setting this scenario does not contain' });
      }
      if (!labTerm && !vitalTerm && !devTerm && !badPairs.length) {
        out.push({ kind: V_NUMBER, token: bad.join(', '),
          why: 'states a number that is not in this scenario' });
      }
    }

    /* --- allergies and code status -------------------------------------- */
    if (/\ballerg/i.test(raw) && str(f.corpus).indexOf('allerg') === -1) {
      out.push({ kind: V_ALLERGY, token: 'allergy',
        why: 'this scenario documents no allergy information' });
    }
    if (/\b(dnr|dni|do not resuscitate|full code|code status)\b/i.test(raw)
        && !/code status|dnr|dni|full code|resuscitate/.test(str(f.corpus))) {
      out.push({ kind: V_CODE, token: 'code status',
        why: 'this scenario documents no code status' });
    }

    /* --- qualitative clinical findings ---------------------------------- */
    var ft = anyTerm(n, FINDING_TERMS);
    if (ft && !hasTerm(str(f.corpus), ft) && str(f.corpus).indexOf(ft.split('-')[0]) === -1) {
      out.push({ kind: V_FINDING, token: ft,
        why: 'asserts a physical finding this scenario never documents' });
    }

    /* --- hidden-information leak ----------------------------------------
     * A real scenario fact the learner has NOT uncovered may not be spoken,
     * hinted at or narrated. This is what stops the model announcing the lung
     * sounds before anyone put a stethoscope on the chest. */
    var seen = obj(revealed);
    arr(f.facts).forEach(function (fact) {
      if (seen[fact.key]) { return; }
      if (fact.kind === 'intro') { return; }
      var toks = sigWords(fact.text);
      if (!toks.length) { return; }
      var hits = 0;
      toks.forEach(function (w) { if (tokenEcho(n, w)) { hits++; } });
      if (hits >= 2 || (hits >= 1 && (hits / toks.length) >= 0.5)) {
        out.push({ kind: V_HIDDEN, token: cut(fact.text, 60), factKey: fact.key,
          why: 'describes a finding the learner has not uncovered yet' });
      }
    });

    return out;
  }

  /** Word match that also catches an inflection ("tachycardic" for
      "tachycardia"). Used only by the hidden-leak guard, where a false
      positive costs one dropped sentence and a false negative costs the
      learner an answer they were supposed to earn. */
  function tokenEcho(normalized, token) {
    var w = lower(token);
    if (hasTerm(normalized, w)) { return true; }
    if (w.length < 7) { return false; }
    var stem = w.slice(0, 6).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^| )' + stem).test(normalized);
  }

  /** A claimed order is only allowed when the scenario already authored it. */
  function traceableOrderClaim(normalizedSentence, facts) {
    var f = obj(facts);
    var lines = [];
    arr(obj(f.sc).orders).forEach(function (o) { lines.push(str(o)); });
    arr(obj(f.sc).mar).forEach(function (o) { lines.push(str(o)); });
    arr(obj(f.sc).provider_branches).forEach(function (b) {
      arr(obj(b).orders).forEach(function (o) { lines.push(str(o)); });
    });
    var best = 0;
    lines.forEach(function (line) {
      var toks = sigWords(line);
      if (!toks.length) { return; }
      var hits = 0;
      toks.forEach(function (w) { if (hasTerm(normalizedSentence, w)) { hits++; } });
      var frac = hits / toks.length;
      if (frac > best) { best = frac; }
    });
    return best >= 0.5;
  }

  /**
   * sanitizeAIText(text, facts, revealed) ->
   *   {text, dropped:[{sentence, violations}], violations:[], blocked:bool}
   * Untraceable sentences are removed. `blocked` means nothing survived.
   */
  function sanitizeAIText(text, facts, revealed) {
    var kept = [], dropped = [], all = [];
    sentencesOf(text).forEach(function (s) {
      var v = checkSentence(s, facts, revealed);
      if (v.length) {
        dropped.push({ sentence: s, violations: v });
        v.forEach(function (x) { all.push(x); });
      } else {
        kept.push(s);
      }
    });
    var outText = kept.join(' ').trim();
    return {
      text: outText,
      dropped: dropped,
      violations: all,
      blocked: !outText && (dropped.length > 0)
    };
  }

  /**
   * validateAIReply(raw, sc, run) - LAYER 1.
   * Destructures a model reply down to a five-field shape. Anything else is
   * dropped and recorded. The returned object is the ONLY thing the engine ever
   * sees from a model, and none of its fields can create a fact.
   */
  function validateAIReply(raw, sc, run) {
    var facts = buildFacts(sc);
    var revealed = obj(obj(run).revealed);
    var out = {
      intent: '', target: '', confidence: 0, requires_order: false,
      matched_source_fact: '', say: '', clarify: '',
      violations: [], rejectedKeys: [], dropped: []
    };
    var r = obj(raw);

    keysOf(r).forEach(function (k) {
      var lk = lower(k);
      if (REPLY_ALLOWED_KEYS.indexOf(lk) !== -1) { return; }
      out.rejectedKeys.push(k);
      var kind = REPLY_FORBIDDEN_KEYS[lk] || V_KEY;
      out.violations.push({ kind: kind, token: k,
        why: 'a model reply may not carry a "' + k + '" field; the engine owns that' });
    });

    var allowed = allowedIntents(sc);
    var want = str(r.intent).trim();
    if (want) {
      var ok = false;
      allowed.forEach(function (a) { if (a.id === want) { ok = true; } });
      if (ok) { out.intent = want; }
      else {
        out.violations.push({ kind: V_INTENT, token: want,
          why: 'not an id in allowed_action_intents' });
      }
    }

    out.confidence = clamp(numOr(r.confidence, 0), 0, 1);
    /* A model may never be more certain than a deterministic exact match. */
    if (out.confidence > AI_CONF_CAP) { out.confidence = AI_CONF_CAP; }

    var tgt = str(r.target).trim();
    if (tgt) {
      if (facts.byKey[tgt]) { out.target = tgt; }
      else if (normText(tgt) && facts.corpus.indexOf(normText(tgt)) !== -1) { out.target = tgt; }
      else { out.violations.push({ kind: V_FINDING, token: tgt, why: 'target is not a scenario fact' }); }
    }

    var msf = str(r.matched_source_fact).trim();
    if (msf) {
      if (facts.corpus.indexOf(normText(msf)) !== -1) { out.matched_source_fact = msf; }
      else {
        out.violations.push({ kind: V_FINDING, token: cut(msf, 60),
          why: 'matched_source_fact does not appear in the scenario' });
      }
    }

    /* Advisory only. The engine recomputes this from the scenario's own MAR. */
    out.requires_order = r.requires_order === true;

    var sayRes = sanitizeAIText(str(r.say), facts, revealed);
    out.say = sayRes.text;
    out.dropped = sayRes.dropped;
    sayRes.violations.forEach(function (v) { out.violations.push(v); });

    var clarRes = sanitizeAIText(str(r.clarify), facts, revealed);
    out.clarify = clarRes.text;
    clarRes.violations.forEach(function (v) { out.violations.push(v); });

    return out;
  }

  /* ==========================================================================
   * 6. INTENT MATCHING
   * --------------------------------------------------------------------------
   * A deterministic synonym + token-overlap matcher first, so the whole mode
   * works with the AI switched off, offline or failing. The LLM is used only to
   * WIDEN it when the deterministic score lands under the clarify threshold,
   * and its answer is re-validated against allowed_action_intents before it can
   * mean anything. Exact phrasing is never required.
   * ======================================================================== */

  var CLARIFY_BELOW = 0.6;   // below this we ask, we do not guess
  var AMBIGUOUS_GAP = 0.06;  // two candidates this close is also a clarify
  var AI_CONF_CAP   = 0.8;

  /* Intents the ENGINE always provides. They are the reveal mechanism (you
     cannot auscultate without an auscultate action) and they are not orders, so
     providing them invents nothing. A builtin whose id is also in the
     scenario's own allowed_action_intents keeps the SCENARIO's label and
     category - the school file outranks this list. */
  var BUILTIN_INTENTS = [
    { id: 'hand_hygiene', label: 'Perform hand hygiene / standard precautions', category: 'safety' },
    { id: 'verify_identity', label: 'Use two patient identifiers', category: 'safety' },
    { id: 'abc_assessment', label: 'Perform immediate ABC assessment', category: 'assessment' },
    { id: 'auscultate_lungs', label: 'Auscultate lung sounds', category: 'assessment' },
    { id: 'check_oxygenation', label: 'Check oxygen saturation (pulse oximetry)', category: 'assessment' },
    { id: 'check_pupils', label: 'Check pupils / neuro assessment', category: 'assessment' },
    { id: 'ask_pain', label: 'Ask about pain and symptoms', category: 'assessment' },
    { id: 'check_vitals', label: 'Take a full set of vital signs', category: 'assessment' },
    { id: 'assess_abdomen', label: 'Assess the abdomen', category: 'assessment' },
    { id: 'assess_skin', label: 'Assess skin, colour and perfusion', category: 'assessment' },
    { id: 'assess_output', label: 'Assess urine output / intake and output', category: 'assessment' },
    { id: 'focused_assessment', label: 'Perform condition-specific focused assessment', category: 'assessment' },
    { id: 'open_labs', label: 'Open the lab panel', category: 'assessment' },
    { id: 'review_chart', label: 'Review the chart, orders and MAR', category: 'assessment' },
    { id: 'review_trends', label: 'Compare current data with prior trends', category: 'clinical_reasoning' },
    { id: 'implement_orders', label: 'Implement/verify active provider orders', category: 'intervention' },
    { id: 'position_patient', label: 'Reposition the patient', category: 'intervention' },
    { id: 'reassess', label: 'Reassess response after interventions', category: 'reassessment' },
    { id: 'sbar', label: 'Communicate using SBAR / escalate to the provider', category: 'communication' },
    { id: 'document', label: 'Document assessment, interventions and response', category: 'documentation' },
    { id: 'educate', label: 'Provide patient education', category: 'documentation' }
  ];

  var SYNONYMS = {
    hand_hygiene: ['hand hygiene', 'wash my hands', 'wash hands', 'washing my hands', 'sanitize my hands',
      'hand sanitizer', 'foam in', 'gel in', 'alcohol rub', 'hand rub', 'clean my hands', 'scrub in'],
    verify_identity: ['two identifiers', '2 identifiers', 'two patient identifiers', 'check the armband',
      'check her armband', 'check his armband', 'identify the patient', 'verify the patient',
      'name and date of birth', 'name and dob', 'check the wristband', 'verify identity', 'confirm identity',
      'ask his name', 'ask her name'],
    abc_assessment: ['abc', 'abcs', 'airway breathing circulation', 'primary survey', 'check airway',
      'assess airway', 'assess the airway', 'airway and breathing', 'is the airway patent',
      'check breathing and circulation', 'primary assessment', 'a b c'],
    auscultate_lungs: ['listen to lungs', 'listen to the lungs', 'auscultate lungs', 'auscultate the lungs',
      'lung sounds', 'breath sounds', 'listen to the chest', 'listen to her chest', 'listen to his chest',
      'stethoscope on the lungs', 'auscultate the chest', 'check lung sounds', 'listen to breath sounds',
      'assess lung sounds'],
    check_oxygenation: ['check o2 sat', 'check the o2 sat', 'o2 sat', 'o2 sats', 'oxygen sat',
      'pulse ox', 'pulse oximetry', 'pulse oximeter', 'spo2', 'sp o2', 'oxygen saturation',
      'check the sats', 'check her sats', 'check his sats', 'sat probe', 'put the probe on',
      'check saturation', 'oximetry'],
    check_pupils: ['check pupils', 'check her pupils', 'check his pupils', 'pupil check', 'pupils',
      'perrla', 'pupillary response', 'penlight', 'pupil reaction', 'neuro check', 'neuro assessment',
      'neurological assessment', 'assess neuro status', 'check level of consciousness',
      'assess loc', 'gcs', 'glasgow'],
    ask_pain: ['pain scale', 'rate your pain', 'rate his pain', 'rate her pain', 'ask about pain',
      'pain assessment', 'assess pain', 'opqrst', 'where does it hurt', 'how bad is the pain',
      'are you in pain', 'ask about symptoms', 'symptom questions', 'zero to ten', '0 to 10',
      'what does the pain feel like'],
    check_vitals: ['vital signs', 'take vitals', 'get vitals', 'full set of vitals', 'recheck vitals',
      'check vitals', 'blood pressure and heart rate', 'take her vitals', 'take his vitals',
      'cycle the cuff', 'get a manual pressure', 'vs'],
    assess_abdomen: ['assess the abdomen', 'abdominal assessment', 'palpate the abdomen',
      'listen to bowel sounds', 'bowel sounds', 'check the abdomen', 'auscultate the abdomen',
      'assess for distention', 'check the incision'],
    assess_skin: ['assess skin', 'check skin', 'skin assessment', 'check capillary refill',
      'cap refill', 'check color', 'check for cyanosis', 'look at her skin', 'look at his skin',
      'check perfusion', 'check the extremities'],
    assess_output: ['urine output', 'check the foley', 'intake and output', 'strict i and o',
      'strict io', 'measure output', 'check urine', 'i and o'],
    focused_assessment: ['focused assessment', 'head to toe', 'head-to-toe', 'system assessment',
      'focused exam', 'secondary assessment', 'targeted assessment', 'assess the patient thoroughly',
      'full assessment'],
    open_labs: ['open the labs', 'look at the labs', 'check the labs', 'review the labs', 'lab panel',
      'pull up the labs', 'see the lab results', 'lab results', 'check the hemoglobin',
      'check the cbc', 'look at the bloodwork', 'read the labs'],
    review_chart: ['review the chart', 'look at the chart', 'check the orders', 'review the orders',
      'look at the mar', 'check the mar', 'read the chart', 'pull up the chart', 'check the history',
      'look at the medication record', 'verify the orders'],
    review_trends: ['compare the trends', 'look at the trend', 'compare with earlier', 'trend the vitals',
      'compare to the last set', 'look at the previous vitals', 'how have the vitals changed',
      'compare current data with prior'],
    implement_orders: ['implement the orders', 'carry out the orders', 'follow the orders',
      'start the ordered', 'do what is ordered', 'complete the ordered interventions',
      'put the ordered', 'begin the ordered'],
    position_patient: ['reposition', 'sit her up', 'sit him up', 'high fowlers', 'semi fowlers',
      'raise the head of the bed', 'hob up', 'turn the patient', 'side lying', 'lateral position',
      'position the patient', 'lay her flat', 'trendelenburg'],
    reassess: ['reassess', 're-assess', 'recheck', 'check again', 'evaluate the response',
      'see if it worked', 'follow up on the intervention', 'reevaluate', 're-evaluate',
      'assess the response', 'did it help'],
    sbar: ['sbar', 'call the provider', 'call the doctor', 'call the physician', 'notify the provider',
      'notify the doctor', 'page the provider', 'page the doctor', 'call the rapid response',
      'call rrt', 'rapid response', 'escalate', 'call the md', 'give report', 'hand off',
      'call the hospitalist', 'i would call', 'notify the surgeon'],
    document: ['document', 'chart it', 'charting', 'write a note', 'record the assessment',
      'document the response', 'note in the chart', 'enter it in the chart'],
    educate: ['educate the patient', 'teach the patient', 'patient education', 'explain to the patient',
      'teach back', 'teach-back', 'explain what is happening', 'reassure the patient and explain']
  };

  /* Utterances that mean nothing operationally. Coach mode refuses to complete
     an intervention from any of them, per the checkoff spec. */
  var VAGUE_RE = [
    /\b(take|taking) care of (the patient|him|her|them|my patient)\b/i,
    /\bcare for (the patient|him|her|them)\b/i,
    /\blook after (the patient|him|her|them)\b/i,
    /\bdo (everything|whatever|what i need|my job|the right thing)\b/i,
    /\b(handle|manage|deal with) (it|the patient|the situation)\b/i,
    /\bi (help|helped) (the patient|him|her|them)\b/i,
    /\bnursing (care|interventions)\b/i,
    /^\s*(i )?(assess|check|do|start|give|monitor|watch)( the)?( patient| everything| stuff| things)?\s*[.!]?\s*$/i,
    /^\s*(ok|okay|yes|no|done|next|um+|uh+|hmm+)\s*[.!?]?\s*$/i
  ];
  function isVague(text) {
    var t = str(text).trim();
    if (!t) { return true; }
    var i;
    for (i = 0; i < VAGUE_RE.length; i++) { if (VAGUE_RE[i].test(t)) { return true; } }
    return sigWords(t).length < 1;
  }

  /** The controlled vocabulary for a scenario: its own list, plus builtins. */
  var INTENT_CACHE = [];
  function allowedIntents(sc) {
    var s = obj(sc), i;
    for (i = 0; i < INTENT_CACHE.length; i++) {
      if (INTENT_CACHE[i].sc === s) { return INTENT_CACHE[i].list; }
    }
    var seen = {}, list = [];
    arr(s.allowed_action_intents).forEach(function (a) {
      var o = obj(a), id = str(o.id);
      if (!id || seen[id]) { return; }
      seen[id] = 1;
      list.push({
        id: id, label: str(o.label) || id.replace(/_/g, ' '),
        category: lower(o.category) || 'intervention', scenario: true
      });
    });
    BUILTIN_INTENTS.forEach(function (b) {
      if (seen[b.id]) { return; }
      seen[b.id] = 1;
      list.push({ id: b.id, label: b.label, category: b.category, scenario: false });
    });
    INTENT_CACHE.push({ sc: s, list: list });
    if (INTENT_CACHE.length > 24) { INTENT_CACHE.shift(); }
    return list;
  }
  function intentById(sc, id) {
    var list = allowedIntents(sc), i;
    for (i = 0; i < list.length; i++) { if (list[i].id === str(id)) { return list[i]; } }
    return null;
  }

  /** Score one intent against an utterance. 0..1. */
  function scoreIntent(said, intent) {
    var n = normText(said);
    if (!n) { return 0; }
    var best = 0;

    var syns = arr(SYNONYMS[intent.id]).slice();
    /* the intent's own label is always a synonym, and so are its id words */
    syns.push(normText(intent.label));
    syns.push(str(intent.id).replace(/_/g, ' '));

    syns.forEach(function (raw) {
      var s = normText(raw);
      if (!s) { return; }
      if (n === s) { best = Math.max(best, 1); return; }
      if (n.indexOf(s) !== -1) {
        /* longer synonyms are more specific, so they win ties */
        best = Math.max(best, Math.min(0.97, 0.78 + 0.012 * s.length));
        return;
      }
      var toks = words(s).filter(function (w) { return !STOP[w]; });
      if (!toks.length) { return; }
      var hits = 0;
      toks.forEach(function (w) { if (hasTerm(n, w)) { hits++; } });
      var frac = hits / toks.length;
      if (frac >= 0.6) { best = Math.max(best, Math.min(0.9, 0.34 + 0.56 * frac)); }
    });

    return best;
  }

  /**
   * matchIntent(text, sc, opts) ->
   *   {intent, target, confidence, requires_order, matched_source_fact,
   *    alternatives, needsClarification, clarify, vague, source}
   * Deterministic. Never throws. `intent` is '' when we should ask instead.
   */
  function matchIntent(text, sc, opts) {
    var o = obj(opts);
    var facts = buildFacts(sc);
    var said = str(text);
    var base = {
      intent: '', target: '', confidence: 0, requires_order: false,
      matched_source_fact: '', alternatives: [], needsClarification: true,
      clarify: '', vague: false, source: 'deterministic', said: said
    };

    if (isVague(said)) {
      base.vague = true;
      base.clarify = 'Say the specific action - for example "I auscultate the lungs", ' +
        '"I check the pupils", or "I call the provider with SBAR". ' +
        '"' + cut(said.trim(), 40) + '" is not a nursing action I can mark.';
      return base;
    }

    var scored = [];
    allowedIntents(sc).forEach(function (it) {
      var sc2 = scoreIntent(said, it);
      if (sc2 > 0) { scored.push({ id: it.id, label: it.label, category: it.category, score: sc2 }); }
    });
    scored.sort(function (a, b) { return b.score - a.score; });

    base.alternatives = scored.slice(0, 3).map(function (x) {
      return { intent: x.id, label: x.label, confidence: Math.round(x.score * 100) / 100 };
    });

    if (!scored.length) {
      base.clarify = 'I could not map that to an action in this scenario. Try naming the ' +
        'assessment, the intervention or the person you are calling.';
      return base;
    }

    var top = scored[0];
    base.confidence = Math.round(top.score * 100) / 100;

    var ambiguous = scored.length > 1 && (top.score - scored[1].score) < AMBIGUOUS_GAP
      && scored[1].score >= CLARIFY_BELOW;
    if (top.score < CLARIFY_BELOW || ambiguous) {
      base.clarify = ambiguous
        ? 'Did you mean "' + top.label + '" or "' + scored[1].label + '"? Say which one.'
        : 'I am not confident enough to act on that. Say the action in a few plain words - ' +
          'for example "I listen to the lungs" or "I call the provider".';
      return base;
    }

    base.intent = top.id;
    base.needsClarification = false;

    /* --- what this action touches, straight out of the scenario --------- */
    var med = namedMedIn(said, facts);
    var it2 = intentById(sc, top.id) || { category: top.category };
    var cat = lower(it2.category);

    if (med) {
      base.target = med.name;
      base.requires_order = true;
      base.matched_source_fact = med.ordered ? med.source : '';
    } else if (cat === 'intervention') {
      base.requires_order = true;
      base.matched_source_fact = firstOrderMatching(said, sc);
      base.target = base.matched_source_fact;
    } else {
      var f = firstFactMatching(said, facts);
      if (f) { base.target = f.key; base.matched_source_fact = f.text; }
    }
    if (!base.matched_source_fact) {
      base.matched_source_fact = sourceFactForIntent(top.id, sc);
    }
    return base;
  }

  function firstOrderMatching(said, sc) {
    var n = normText(said), best = '', bestFrac = 0;
    arr(obj(sc).orders).forEach(function (o) {
      var toks = sigWords(o);
      if (!toks.length) { return; }
      var hits = 0;
      toks.forEach(function (w) { if (hasTerm(n, w)) { hits++; } });
      var frac = hits / toks.length;
      if (frac > bestFrac && frac >= 0.34) { bestFrac = frac; best = str(o); }
    });
    return best;
  }
  function firstFactMatching(said, facts) {
    var n = normText(said), best = null, bestFrac = 0;
    arr(obj(facts).facts).forEach(function (f) {
      if (f.kind === 'intro') { return; }
      var toks = sigWords(f.text);
      if (!toks.length) { return; }
      var hits = 0;
      toks.forEach(function (w) { if (hasTerm(n, w)) { hits++; } });
      var frac = hits / toks.length;
      if (frac > bestFrac && frac >= 0.5) { bestFrac = frac; best = f; }
    });
    return best;
  }
  /** The scenario line an intent is graded against, for debrief provenance. */
  function sourceFactForIntent(intentId, sc) {
    var it = intentById(sc, intentId);
    if (it && it.scenario) { return 'allowed_action_intents: ' + it.label; }
    var s = obj(sc);
    if (intentId === 'open_labs' && arr(s.labs).length) { return 'labs (' + arr(s.labs).length + ' results on the sheet)'; }
    if (intentId === 'review_chart' && arr(s.orders).length) { return 'orders (' + arr(s.orders).length + ' on the sheet)'; }
    if (intentId === 'sbar' && arr(s.sbar_expected).length) { return 'sbar_expected'; }
    if (intentId === 'check_vitals' && arr(s.vital_trends).length) { return 'vital_trends'; }
    return it ? ('engine intent: ' + it.label) : '';
  }

  /* ==========================================================================
   * 7. REVEAL RULES
   * --------------------------------------------------------------------------
   * One ledger, one set of rules. Lung sounds need auscultation. Pupils need a
   * neuro check. Pain detail needs symptom questions. Labs need the lab panel.
   * `focused_assessment` deliberately does NOT include lungs, neuro or pain -
   * a generic head-to-toe is not a stethoscope on the chest.
   * ======================================================================== */

  var REVEAL_MAP = {
    abc_assessment:     [D_AIRWAY, D_LUNGS, D_CARDIO],
    auscultate_lungs:   [D_LUNGS, D_AIRWAY],
    check_oxygenation:  [D_LUNGS],
    check_pupils:       [D_NEURO],
    ask_pain:           [D_PAIN],
    check_vitals:       [D_VITALS],
    review_trends:      [D_VITALS],
    assess_abdomen:     [D_ABD],
    assess_skin:        [D_PERFUSE],
    assess_output:      [D_GU],
    focused_assessment: [D_GENERAL, D_PERFUSE, D_ABD, D_GU, D_CARDIO],
    open_labs:          [D_LAB],
    review_chart:       [D_CHART],
    implement_orders:   [D_CHART],
    reassess:           [D_VITALS, D_GENERAL],
    sbar:               [],
    document:           [],
    educate:            [],
    hand_hygiene:       [],
    verify_identity:    [],
    position_patient:   []
  };

  /** Which assessment domains an intent uncovers. Data-driven for the
      topic_specific intents, whose labels are authored per scenario. */
  function domainsForIntent(intentId, sc) {
    var mapped = REVEAL_MAP[str(intentId)];
    if (mapped) { return mapped.slice(); }
    var it = intentById(sc, intentId);
    if (!it) { return []; }
    var cat = lower(it.category);
    if (cat === 'assessment' || cat === 'clinical_reasoning' || cat === 'topic_specific'
        || cat === 'reassessment') {
      return [domainOf(it.label, D_GENERAL)];
    }
    return [];
  }

  /** The fact keys an intent uncovers, given the current run. */
  function revealsFor(intentId, sc, run) {
    var facts = buildFacts(sc);
    var doms = domainsForIntent(intentId, sc);
    if (!doms.length) { return []; }
    var want = {};
    doms.forEach(function (d) { want[d] = true; });
    var out = [];
    var deteriorating = obj(run).state === 'deteriorating' || obj(run).state === 'critical_event';
    arr(facts.facts).forEach(function (f) {
      if (!want[f.domain]) { return; }
      /* Deterioration cues are only there to be found once the patient is
         actually deteriorating. Before that they do not exist yet. */
      if (f.kind === 'cue' && !deteriorating) { return; }
      /* Vitals: a spot check gives you the CURRENT reading. The historical
         trend takes a deliberate trend review. */
      if (f.kind === 'vital' && str(intentId) === 'check_vitals') {
        if (f.key !== lastVitalKey(facts)) { return; }
      }
      out.push(f.key);
    });
    return out;
  }
  function lastVitalKey(facts) {
    var last = '';
    arr(obj(facts).facts).forEach(function (f) { if (f.kind === 'vital') { last = f.key; } });
    return last;
  }

  /**
   * initialReveals(sc) - what the handoff itself legitimately discloses.
   * The case_intro IS the report, so a finding the report already states is not
   * hidden information; leaving it "hidden" would make the guard drop the
   * simulator's own opening narration.
   */
  function initialReveals(sc) {
    var facts = buildFacts(sc);
    var intro = normText(obj(sc).case_intro);
    var m = { intro: true };
    arr(facts.facts).forEach(function (f) {
      if (f.kind !== 'finding') { return; }
      var toks = sigWords(f.text);
      if (!toks.length) { return; }
      var hits = 0;
      toks.forEach(function (w) { if (tokenEcho(intro, w)) { hits++; } });
      if ((hits / toks.length) >= 0.7) { m[f.key] = true; }
    });
    return m;
  }

  /* ==========================================================================
   * 8. THE RUN - a pure fold over an event list
   * ======================================================================== */

  var S_HANDOFF = 'handoff';
  var S_ACTIVE = 'active';
  var S_DETERIORATING = 'deteriorating';
  var S_CRITICAL = 'critical_event';
  var S_STABILIZED = 'stabilized_or_transferred';
  var STATE_ORDER = [S_HANDOFF, S_ACTIVE, S_DETERIORATING, S_CRITICAL, S_STABILIZED];
  var STATE_LABEL = {};
  STATE_LABEL[S_HANDOFF] = 'Handoff';
  STATE_LABEL[S_ACTIVE] = 'Active';
  STATE_LABEL[S_DETERIORATING] = 'Deteriorating';
  STATE_LABEL[S_CRITICAL] = 'Critical event';
  STATE_LABEL[S_STABILIZED] = 'Stabilized / transferred';

  var EV_START = 'start', EV_ACT = 'act', EV_HINT = 'hint', EV_SBAR = 'sbar',
      EV_SAY = 'say', EV_AI = 'ai', EV_PAUSE = 'pause', EV_RESUME = 'resume',
      EV_TICK = 'tick', EV_END = 'end', EV_NOTE = 'note', EV_ASK = 'ask';

  var HANDOFF_MAX_SEC = 90;
  var EFFECT_DELAY_SEC = 45;
  var ARM_MS = 8000;
  var CRIT_EVENT_AT = 3;
  var UNSAFE_PENALTY = 10;    // points, inside the safety band
  var MAX_CHECK_ITER = 200;

  var DEFAULT_WEIGHTS = {
    safety: 30,
    assessment_recognition: 25,
    prioritization_interventions: 25,
    communication: 10,
    reassessment_documentation_education: 10
  };
  var CATEGORY_ORDER = ['safety', 'assessment_recognition', 'prioritization_interventions',
    'communication', 'reassessment_documentation_education'];
  var CATEGORY_LABEL = {
    safety: 'Safety',
    assessment_recognition: 'Assessment / recognition',
    prioritization_interventions: 'Prioritization / interventions',
    communication: 'Communication',
    reassessment_documentation_education: 'Reassessment / documentation / education'
  };

  /**
   * resolveWeights(sc, opts) - the rubric, with instructor customisation.
   * Scenario `scoring` outranks the packaged default; an explicit
   * opts.weights outranks both. Nothing is normalised to 100 behind the
   * instructor's back - if they choose weights that total 120, the report says
   * 120.
   */
  function resolveWeights(sc, opts) {
    var w = shallow(DEFAULT_WEIGHTS);
    var fromScenario = obj(obj(sc).scoring);
    CATEGORY_ORDER.forEach(function (k) {
      if (typeof fromScenario[k] === 'number' && isFinite(fromScenario[k]) && fromScenario[k] >= 0) {
        w[k] = fromScenario[k];
      }
    });
    var custom = obj(obj(opts).weights);
    CATEGORY_ORDER.forEach(function (k) {
      if (typeof custom[k] === 'number' && isFinite(custom[k]) && custom[k] >= 0) { w[k] = custom[k]; }
    });
    return w;
  }
  function weightTotal(w) {
    var t = 0;
    CATEGORY_ORDER.forEach(function (k) { t += numOr(obj(w)[k], 0); });
    return t;
  }

  function normOpts(sc, opts) {
    var o = obj(opts);
    return {
      mode: lower(o.mode) === 'exam' ? 'exam' : 'practice',
      durationMin: clamp(Math.round(numOr(o.durationMin, durationMinutes(sc))), 1, 120),
      weights: resolveWeights(sc, o),
      /* The rubric is explicit: never an automatic course failure unless the
         instructor configured one. Default OFF, and it stays off unless this
         is literally true. */
      autoFail: o.autoFail === true,
      autoFailThreshold: clamp(Math.round(numOr(o.autoFailThreshold, 2)), 1, 20),
      requireReassessBeforeEnd: o.requireReassessBeforeEnd !== false,
      requireSbarBeforeEnd: o.requireSbarBeforeEnd !== false,
      endOnStabilize: o.endOnStabilize !== false,
      showRationale: o.showRationale !== false,
      hintsEnabled: lower(o.mode) === 'exam' ? false : (o.hintsEnabled !== false),
      coachStyle: COACH_STYLES_MAP[lower(o.coachStyle)] ? lower(o.coachStyle) : 'coach',
      overrides: obj(o.overrides),
      allowAi: o.allowAi !== false
    };
  }

  function initialRun(sc, opts) {
    var s = obj(sc);
    var o = normOpts(s, opts);
    var startedAt = numOr(obj(opts).startedAt, nowMs());
    return {
      topicId: str(s.topic_id),
      mode: o.mode,
      durationMin: o.durationMin,
      opts: o,
      startedAt: startedAt,
      pausedAt: 0,
      pausedMs: 0,
      pauseCount: 0,
      endedAt: 0,
      endReason: '',
      state: S_HANDOFF,
      stateHistory: [{ state: S_HANDOFF, atSec: 0, reason: 'start' }],
      revealed: initialReveals(s),
      done: {},
      actions: [],
      log: [{ seq: 0, atSec: 0, kind: 'info', text: 'Handoff received.',
        detail: 'Only the report and the visible chart header are open. ' +
          'Everything else has to be assessed.' }],
      transcript: [],
      unsafe: [],
      penalties: [],
      hints: [],
      pending: [],
      deteriorationCount: 0,
      deteriorationReasons: [],
      scriptedFired: false,
      nextCheckSec: firstCheckSec(o.durationMin),
      sbar: { given: false, text: '', sections: {}, atSec: 0 },
      reassessCredits: 0,
      reassessAttempts: 0,
      interventionCount: 0,
      sinceReassess: 0,
      /* NEVER WRITTEN. Present so the property exists to assert on: no code
         path in this module appends an order, and the suite proves it. */
      createdOrders: [],
      aiViolations: [],
      aiCalls: 0,
      seq: 1
    };
  }
  function firstCheckSec(durationMin) {
    return Math.max(60, Math.round(numOr(durationMin, 20) * 60 * 0.4));
  }
  function checkEverySec(run) {
    return Math.max(60, Math.round(numOr(obj(run).durationMin, 20) * 60 * 0.2));
  }
  function scriptedDeteriorateSec(run) {
    return Math.round(numOr(obj(run).durationMin, 20) * 60 * 0.6);
  }

  /* -------- the clock: derived, never accumulated ----------------------- */
  function elapsedMs(run, now) {
    var r = obj(run);
    if (!r.startedAt) { return 0; }
    var end = r.endedAt ? r.endedAt : (r.pausedAt ? r.pausedAt : numOr(now, nowMs()));
    return Math.max(0, end - r.startedAt - numOr(r.pausedMs, 0));
  }
  function elapsedSec(run, now) { return Math.floor(elapsedMs(run, now) / 1000); }
  function totalSec(run) { return Math.round(numOr(obj(run).durationMin, 20) * 60); }
  function remainingSec(run, now) { return Math.max(0, totalSec(run) - elapsedSec(run, now)); }
  function expired(run, now) { return remainingSec(run, now) <= 0; }
  function isPausedRun(run) { return !!obj(run).pausedAt; }

  /* -------- critical actions -------------------------------------------- */
  function criticalIds(sc) {
    var out = [], seen = {};
    arr(obj(sc).critical_actions).forEach(function (c) {
      var id = str(c);
      if (id && !seen[id]) { seen[id] = 1; out.push(id); }
    });
    return out;
  }
  function doneCriticals(run, sc) {
    var d = obj(obj(run).done);
    return criticalIds(sc).filter(function (id) { return !!d[id]; });
  }
  function missedCriticals(run, sc) {
    var d = obj(obj(run).done);
    return criticalIds(sc).filter(function (id) { return !d[id]; });
  }

  /* -------- log helpers -------------------------------------------------- */
  function pushLog(r, kind, text, detail, atSec) {
    r.log = r.log.concat([{
      seq: r.seq, atSec: numOr(atSec, 0), kind: str(kind),
      text: str(text), detail: str(detail)
    }]);
    r.seq = r.seq + 1;
    return r;
  }
  function setState(r, next, atSec, reason) {
    if (r.state === next) { return r; }
    r.state = next;
    r.stateHistory = r.stateHistory.concat([{ state: next, atSec: numOr(atSec, 0), reason: str(reason) }]);
    /* Walking off the handoff is not a change in the PATIENT, so it must not
       make a reassessment scoreable. Only a real clinical transition counts. */
    if (next !== S_ACTIVE) { r.sinceReassess = r.sinceReassess + 1; }
    pushLog(r, next === S_STABILIZED ? 'good' : (next === S_ACTIVE ? 'info' : 'warn'),
      'Patient state: ' + (STATE_LABEL[next] || next), stateDetail(next, reason), atSec);
    return r;
  }
  function stateDetail(next, reason) {
    if (next === S_ACTIVE) { return 'You are at the bedside. The problem is present but the patient is holding.'; }
    if (next === S_DETERIORATING) {
      return 'The patient is losing ground. Trigger: ' + str(reason).replace(/_/g, ' ') + '.';
    }
    if (next === S_CRITICAL) { return 'This is now a critical event. Escalate.'; }
    if (next === S_STABILIZED) { return 'Recognised, treated, reassessed and escalated. The patient is stable for handoff.'; }
    return '';
  }
  function addDeterioration(r, reason, atSec, sc) {
    r.deteriorationCount = r.deteriorationCount + 1;
    r.deteriorationReasons = r.deteriorationReasons.concat([{ reason: str(reason), atSec: numOr(atSec, 0) }]);
    var hasCrit = hasCriticalEventBranch(sc);
    if (hasCrit && r.deteriorationCount >= CRIT_EVENT_AT) {
      setState(r, S_CRITICAL, atSec, reason);
    } else if (r.state !== S_CRITICAL && r.state !== S_STABILIZED) {
      setState(r, S_DETERIORATING, atSec, reason);
    }
    return r;
  }
  function hasCriticalEventBranch(sc) {
    var found = false;
    arr(obj(sc).deterioration_triggers).forEach(function (t) {
      var e = lower(obj(t).effect) + ' ' + lower(obj(t).trigger);
      if (e.indexOf('critical_event') !== -1 || e.indexOf('critical event') !== -1
        || e.indexOf('arrest') !== -1) { found = true; }
    });
    if (obj(sc).critical_event) { found = true; }
    return found;
  }

  /**
   * advanceTo(r, atMs, sc) - the ONLY place time-driven change happens.
   * Deterministic: identical inputs give an identical run. No Math.random, no
   * wall-clock read, no improvisation.
   */
  function advanceTo(r, atMs, sc) {
    if (r.endedAt) { return r; }
    if (r.pausedAt) { return r; }               // frozen: clock, timers, everything
    var sec = elapsedSec(r, atMs);

    /* 1. handoff -> active */
    if (r.state === S_HANDOFF && (r.actions.length > 0 || sec >= HANDOFF_MAX_SEC)) {
      setState(r, S_ACTIVE, sec, 'handoff_complete');
    }

    /* 2. scheduled intervention effects land after a realistic delay */
    if (r.pending.length) {
      var still = [], fired = [];
      r.pending.forEach(function (p) {
        if (numOr(p.atSec, 0) <= sec) { fired.push(p); } else { still.push(p); }
      });
      if (fired.length) {
        r.pending = still;
        fired.forEach(function (p) {
          pushLog(r, 'good', 'Effect: ' + str(p.text), str(p.detail), sec);
          r.sinceReassess = r.sinceReassess + 1;
          if (p.reveals) { arr(p.reveals).forEach(function (k) { r.revealed = setAdd(r.revealed, k); }); }
        });
      }
    }

    /* 3. missed-critical checkpoints */
    var guard = 0;
    while (r.nextCheckSec <= sec && guard < MAX_CHECK_ITER) {
      guard++;
      if (missedCriticals(r, sc).length >= 2 && r.state !== S_STABILIZED) {
        addDeterioration(r, 'missed_criticals', r.nextCheckSec, sc);
      }
      r.nextCheckSec = r.nextCheckSec + checkEverySec(r);
    }

    /* 4. scripted progression - one scripted push, and only if work is open */
    if (!r.scriptedFired && sec >= scriptedDeteriorateSec(r)) {
      r.scriptedFired = true;
      if (missedCriticals(r, sc).length > 0 && r.state !== S_STABILIZED) {
        addDeterioration(r, 'time', sec, sc);
      }
    }

    /* 5. recovery */
    maybeStabilize(r, sec, sc);

    /* 6. the clock runs out */
    if (!r.endedAt && sec >= totalSec(r)) {
      r.endedAt = r.startedAt + (totalSec(r) * 1000) + numOr(r.pausedMs, 0);
      r.endReason = 'time';
      pushLog(r, 'warn', 'Time is up.', 'The 20-minute window closed. Everything you did is in the debrief.', sec);
    }
    return r;
  }

  function maybeStabilize(r, sec, sc) {
    if (r.state !== S_DETERIORATING && r.state !== S_CRITICAL) { return r; }
    var crits = criticalIds(sc);
    var doneN = doneCriticals(r, sc).length;
    var need = crits.length ? Math.ceil(crits.length * 0.6) : 0;
    if (!r.sbar.given) { return r; }
    if (r.reassessCredits < 1) { return r; }
    if (doneN < need) { return r; }
    setState(r, S_STABILIZED, sec, 'appropriate_escalation_after_deterioration');
    if (r.opts.endOnStabilize && !r.endedAt) {
      r.endedAt = r.startedAt + (sec * 1000) + numOr(r.pausedMs, 0);
      r.endReason = 'stabilized';
    }
    return r;
  }

  /** Shallow clone with the mutable containers detached. */
  function cloneRun(run) {
    var r = shallow(run);
    r.revealed = shallow(run.revealed);
    r.done = shallow(run.done);
    r.sbar = shallow(run.sbar);
    r.opts = shallow(run.opts);
    r.actions = arr(run.actions).slice();
    r.log = arr(run.log).slice();
    r.transcript = arr(run.transcript).slice();
    r.unsafe = arr(run.unsafe).slice();
    r.penalties = arr(run.penalties).slice();
    r.hints = arr(run.hints).slice();
    r.pending = arr(run.pending).slice();
    r.stateHistory = arr(run.stateHistory).slice();
    r.deteriorationReasons = arr(run.deteriorationReasons).slice();
    r.createdOrders = arr(run.createdOrders).slice();
    r.aiViolations = arr(run.aiViolations).slice();
    return r;
  }

  /**
   * applyEvent(run, evt, sc) -> a NEW run. Pure. No randomness anywhere.
   * evt: {type, at, ...}
   */
  function applyEvent(run, evt, sc) {
    var e = obj(evt);
    var r = cloneRun(obj(run));
    var at = numOr(e.at, nowMs());

    if (e.type === EV_PAUSE) {
      if (!r.endedAt && !r.pausedAt) {
        r.pausedAt = at;
        r.pauseCount = r.pauseCount + 1;
        pushLog(r, 'info', 'Paused.', 'The clock, the deterioration timers and every scheduled ' +
          'effect are frozen. Nothing advances until you resume, and resume picks up exactly ' +
          'where it stopped.', elapsedSec(r, at));
      }
      return r;
    }
    if (e.type === EV_RESUME) {
      if (r.pausedAt) {
        var held = Math.max(0, at - r.pausedAt);
        r.pausedMs = numOr(r.pausedMs, 0) + held;
        r.pausedAt = 0;
        pushLog(r, 'info', 'Resumed.', 'Paused for ' + fmtClock(held / 1000) +
          ' of real time. No simulated time was skipped.', elapsedSec(r, at));
      }
      return advanceTo(r, at, sc);
    }

    advanceTo(r, at, sc);
    if (r.endedAt && e.type !== EV_END && e.type !== EV_NOTE) { return r; }
    var sec = elapsedSec(r, at);

    switch (e.type) {
      case EV_START:
        pushLog(r, 'info', 'Run started.', 'Mode: ' + r.mode + '. ' + r.durationMin + ' minutes.', sec);
        return r;

      case EV_ACT:
        return applyAct(r, e, sc, sec);

      case EV_HINT:
        if (r.mode === 'exam' || !r.opts.hintsEnabled) { return r; }
        r.hints = r.hints.concat([{ atSec: sec, tier: clamp(Math.round(numOr(e.tier, 1)), 1, 3),
          intent: str(e.intent) }]);
        pushLog(r, 'info', 'Hint used (tier ' + clamp(Math.round(numOr(e.tier, 1)), 1, 3) + ').',
          str(e.text), sec);
        return r;

      case EV_SBAR:
        return applySbar(r, e, sc, sec);

      case EV_SAY:
        r.transcript = r.transcript.concat([{ who: 'learner', text: cut(str(e.text), 400), atSec: sec }]);
        return r;

      case EV_AI:
        /* Only ever reached with text that already went through
           sanitizeAIText(). The engine re-guards it anyway - a caller that
           forgets is a bug, not a licence. */
        return applyAiLine(r, e, sc, sec);

      case EV_ASK:
        r.transcript = r.transcript.concat([{ who: 'learner', text: cut(str(e.text), 400), atSec: sec }]);
        return r;

      case EV_NOTE:
        pushLog(r, str(e.kind) || 'info', str(e.text), str(e.detail), sec);
        return r;

      case EV_END:
        if (!r.endedAt) {
          r.endedAt = at;
          r.endReason = str(e.reason) || 'ended';
          pushLog(r, 'info', 'Scenario ended.', str(e.detail), sec);
        }
        return r;

      case EV_TICK:
      default:
        return r;
    }
  }

  /* -------- the consequence table (deterministic) ------------------------ */
  function applyAct(r, e, sc, sec) {
    var intentId = str(e.intent);
    var it = intentById(sc, intentId);
    if (!it) {
      pushLog(r, 'warn', 'Unrecognised action ignored.',
        'That action is not in this scenario\'s controlled vocabulary, so nothing was recorded.', sec);
      return r;
    }
    var cat = lower(it.category);
    var said = str(e.said);
    var facts = buildFacts(sc);
    var med = e.med ? obj(e.med) : namedMedIn(said || it.label, facts);
    var isCritical = criticalIds(sc).indexOf(intentId) !== -1;

    /* The first thing the learner does ends the handoff. advanceTo() runs
       BEFORE the event is applied, so this cannot live there - the action does
       not exist yet at that point. */
    if (r.state === S_HANDOFF) { setState(r, S_ACTIVE, sec, 'handoff_complete'); }

    /* --- unsafe / unordered medication -------------------------------- *
     * Safety penalty, NO medication effect, and the order is NOT created.
     * There is no branch below this that can add to createdOrders. */
    if (med && !med.ordered) {
      r.unsafe = r.unsafe.concat([{
        atSec: sec, intent: intentId, kind: 'unordered_medication',
        text: 'Gave ' + med.name + ' with no active order or MAR entry for it.',
        med: med.name
      }]);
      r.penalties = r.penalties.concat([{
        atSec: sec, category: 'safety', points: UNSAFE_PENALTY,
        text: 'Administered ' + med.name + ' without an order.',
        source: 'SOURCE_RULES: medication administration requires an active order/MAR branch'
      }]);
      pushLog(r, 'bad', 'Order check failed: ' + med.name,
        'There is no order and no MAR entry for ' + med.name + ' in this chart. Nothing was given, ' +
        'the patient state did not change, and no order was created. Verify the order before you ' +
        'reach for a medication.', sec);
      addDeterioration(r, 'unsafe_action', sec, sc);
      /* createdOrders is deliberately untouched. */
      return r;
    }

    /* --- held-back first attempt for an out-of-sequence critical ------- *
     * Handled by the UI layer (it owns the arm timer). By the time an act
     * event reaches here it is a committed action. */

    r.actions = r.actions.concat([{
      atSec: sec, intent: intentId, label: it.label, category: cat,
      said: cut(said, 200), critical: isCritical,
      source: str(e.source) || sourceFactForIntent(intentId, sc)
    }]);

    /* --- reassessment scores only after an intervention or state change */
    if (cat === 'reassessment' || intentId === 'reassess') {
      r.reassessAttempts = r.reassessAttempts + 1;
      if (r.interventionCount > 0 || r.sinceReassess > 0) {
        r.reassessCredits = r.reassessCredits + 1;
        r.sinceReassess = 0;
        r.done = setAdd(r.done, intentId);
        pushLog(r, 'good', it.label,
          'Reassessment after a change - this is where the points are.', sec);
      } else {
        pushLog(r, 'warn', it.label,
          'Nothing has changed yet. A reassessment earns credit after an intervention or a ' +
          'change in the patient, not before one.', sec);
      }
    } else {
      r.done = setAdd(r.done, intentId);
    }

    /* --- reveals -------------------------------------------------------- */
    var keys = revealsFor(intentId, sc, r);
    var newly = [];
    keys.forEach(function (k) {
      if (!r.revealed[k]) { newly.push(k); }
      r.revealed = setAdd(r.revealed, k);
    });
    if (newly.length) {
      var txt = newly.map(function (k) { return str(obj(facts.byKey[k]).text); })
        .filter(function (x) { return !!x; });
      pushLog(r, 'good', it.label, txt.join(' | '), sec);
    } else if (cat === 'assessment' || cat === 'clinical_reasoning') {
      pushLog(r, 'info', it.label,
        'Done. Nothing new in that system beyond what you already have.', sec);
    }

    /* --- interventions take effect after a realistic delay -------------- */
    if (cat === 'intervention' || cat === 'topic_specific') {
      r.interventionCount = r.interventionCount + 1;
      r.sinceReassess = r.sinceReassess + 1;
      var srcFact = med && med.ordered ? med.source : (str(e.source) || firstOrderMatching(said, sc));
      r.pending = r.pending.concat([{
        atSec: sec + EFFECT_DELAY_SEC, text: it.label,
        detail: srcFact ? ('Carried out per the chart: "' + cut(srcFact, 110) + '". ' +
          'Now reassess - the response is the point.')
          : 'Carried out. Now reassess - the response is the point.',
        reveals: []
      }]);
      if (!newly.length) {
        pushLog(r, 'good', it.label,
          srcFact ? ('Started. Source: "' + cut(srcFact, 110) + '".') : 'Started.', sec);
      }
    }

    if (cat === 'safety') {
      pushLog(r, 'good', it.label, 'Safety step recorded.', sec);
    }
    if (cat === 'documentation') {
      pushLog(r, 'good', it.label, 'Documented.', sec);
    }

    maybeStabilize(r, sec, sc);
    return r;
  }

  function applySbar(r, e, sc, sec) {
    var text = str(e.text);
    var sections = obj(e.sections);
    r.sbar = {
      given: true,
      text: cut(text, 2000),
      sections: {
        s: str(sections.s || sections.situation),
        b: str(sections.b || sections.background),
        a: str(sections.a || sections.assessment),
        rr: str(sections.r || sections.recommendation)
      },
      atSec: sec
    };
    r.done = setAdd(r.done, 'sbar');
    r.actions = r.actions.concat([{
      atSec: sec, intent: 'sbar', label: 'Communicate using SBAR / escalate',
      category: 'communication', said: cut(text, 200),
      critical: criticalIds(sc).indexOf('sbar') !== -1,
      source: arr(obj(sc).sbar_expected).length ? 'sbar_expected' : 'engine intent: SBAR'
    }]);
    r.sinceReassess = r.sinceReassess + 1;
    pushLog(r, 'good', 'SBAR given to the provider.', sbarCoverageLine(r, sc), sec);
    maybeStabilize(r, sec, sc);
    return r;
  }
  function sbarCoverageLine(r, sc) {
    var cov = sbarCoverage(r, sc);
    return 'Covered ' + cov.hit + ' of ' + cov.total + ' expected elements.';
  }

  function applyAiLine(r, e, sc, sec) {
    var facts = buildFacts(sc);
    var res = sanitizeAIText(str(e.text), facts, r.revealed);
    if (res.violations.length) {
      r.aiViolations = r.aiViolations.concat(res.violations.map(function (v) {
        var x = shallow(v); x.atSec = sec; x.who = str(e.who) || 'patient'; return x;
      }));
    }
    if (!res.text) { return r; }
    r.transcript = r.transcript.concat([{
      who: str(e.who) || 'patient', text: res.text, atSec: sec, sourceChecked: true
    }]);
    return r;
  }

  function foldEvents(sc, opts, events) {
    var r = initialRun(sc, opts);
    arr(events).forEach(function (e) { r = applyEvent(r, e, sc); });
    return r;
  }

  /* ==========================================================================
   * 9. PROVIDER / RRT INTERACTION
   * --------------------------------------------------------------------------
   * The AI may play the voice. It may NOT give an order. New orders exist only
   * when an instructor pre-authored them in scenario.provider_branches; with no
   * such branch the provider acknowledges the SBAR and the scenario holds or
   * ends. There is no improvisation path.
   * ======================================================================== */

  function providerResponse(sc, run) {
    var branches = arr(obj(sc).provider_branches);
    var r = obj(run);
    var chosen = null;
    branches.forEach(function (b) {
      if (chosen) { return; }
      var o = obj(b);
      var when = lower(o.when || o.trigger);
      if (!when || when === 'sbar' || when === 'any') { chosen = o; return; }
      if (when === 'deteriorating' && r.state === S_DETERIORATING) { chosen = o; return; }
      if (when === 'critical_event' && r.state === S_CRITICAL) { chosen = o; }
    });
    if (chosen) {
      return {
        authored: true,
        text: str(chosen.response),
        newOrders: arr(chosen.orders).map(function (x) { return str(x); }),
        endsScenario: chosen.ends === true,
        source: 'provider_branches'
      };
    }
    return {
      authored: false,
      text: 'Thank you for the report. Continue the orders you already have, keep monitoring, ' +
        'and I am on my way. I am not adding anything new over the phone.',
      newOrders: [],
      endsScenario: false,
      source: 'no pre-authored provider branch in this scenario - the simulator holds rather ' +
        'than inventing an order'
    };
  }

  /* ==========================================================================
   * 10. HINTS, "WHAT AM I MISSING", CLARIFICATION
   * ======================================================================== */

  /** The next thing that should happen, in defensible priority order. */
  function nextPriority(run, sc) {
    var r = obj(run);
    var d = obj(r.done);
    var order = ['hand_hygiene', 'verify_identity', 'abc_assessment'];
    var i, it;
    for (i = 0; i < order.length; i++) {
      if (!d[order[i]] && intentById(sc, order[i])) {
        it = intentById(sc, order[i]);
        return { intent: it.id, label: it.label, category: it.category, band: 'safety-first',
          source: sourceFactForIntent(it.id, sc) };
      }
    }
    var missed = missedCriticals(r, sc);
    if (missed.length) {
      it = intentById(sc, missed[0]) || { id: missed[0], label: missed[0].replace(/_/g, ' '),
        category: 'intervention' };
      return { intent: it.id, label: it.label, category: it.category, band: 'critical action',
        source: sourceFactForIntent(it.id, sc) };
    }
    if (r.interventionCount > 0 && r.sinceReassess > 0) {
      it = intentById(sc, 'reassess');
      if (it) {
        return { intent: it.id, label: it.label, category: it.category, band: 'reassessment',
          source: sourceFactForIntent(it.id, sc) };
      }
    }
    if (!r.sbar.given) {
      it = intentById(sc, 'sbar');
      if (it) {
        return { intent: it.id, label: it.label, category: it.category, band: 'communication',
          source: sourceFactForIntent(it.id, sc) };
      }
    }
    if (!d.document && intentById(sc, 'document')) {
      it = intentById(sc, 'document');
      return { intent: it.id, label: it.label, category: it.category, band: 'documentation',
        source: sourceFactForIntent(it.id, sc) };
    }
    return null;
  }

  /**
   * whatAmIMissing(run, sc) -> EXACTLY ONE missed critical action, or null.
   * Never a dump. The checkoff spec is explicit and so is the return type.
   */
  function whatAmIMissing(run, sc) {
    var missed = missedCriticals(run, sc);
    if (!missed.length) {
      var nx = nextPriority(run, sc);
      if (nx && (nx.band === 'reassessment' || nx.band === 'communication')) { return nx; }
      return null;
    }
    /* Priority inside the missed set: safety, then airway/breathing, then the
       order the scenario itself listed them in. */
    var ranked = missed.slice().sort(function (a, b) {
      return missRank(a, sc) - missRank(b, sc);
    });
    var id = ranked[0];
    var it = intentById(sc, id) || { id: id, label: str(id).replace(/_/g, ' '), category: 'intervention' };
    return {
      intent: it.id, label: it.label, category: it.category, band: 'critical action',
      source: sourceFactForIntent(it.id, sc)
    };
  }
  function missRank(id, sc) {
    var it = intentById(sc, id);
    var cat = it ? lower(it.category) : '';
    var base = criticalIds(sc).indexOf(id);
    if (cat === 'safety') { return -200 + base; }
    if (id === 'abc_assessment' || domainOf(it ? it.label : id, '') === D_AIRWAY) { return -100 + base; }
    if (cat === 'assessment') { return base; }
    if (cat === 'communication') { return 100 + base; }
    return 50 + base;
  }

  /**
   * hintFor(run, sc, tier) - the three-rung ladder. Exam mode gets nothing at
   * all: no hint, no cue, no category, no colour-coded diagnosis clue.
   */
  function hintFor(run, sc, tier) {
    var r = obj(run);
    if (r.mode === 'exam' || !obj(r.opts).hintsEnabled) { return null; }
    var t = clamp(Math.round(numOr(tier, 1)), 1, 3);
    var nx = nextPriority(r, sc);
    if (!nx) {
      return { tier: t, title: 'Nothing open', body: 'Every critical action on this sheet is done. ' +
        'Reassess, document, and close the loop with the provider.' };
    }
    if (t === 1) {
      return { tier: 1, title: 'Cue', body: 'Look at ' + bandCue(nx.band) + '.' };
    }
    if (t === 2) {
      return { tier: 2, title: 'Category', body: 'The open step is in the ' +
        (CATEGORY_HINT[nx.category] || nx.category) + ' band.' };
    }
    return { tier: 3, title: 'Next action', body: nx.label };
  }
  var CATEGORY_HINT = {
    safety: 'safety', assessment: 'assessment', clinical_reasoning: 'clinical reasoning',
    intervention: 'intervention', reassessment: 'reassessment',
    communication: 'communication', documentation: 'documentation',
    topic_specific: 'condition-specific'
  };
  function bandCue(band) {
    if (band === 'safety-first') { return 'what you do before you touch any patient'; }
    if (band === 'critical action') { return 'the highest immediate threat to this patient'; }
    if (band === 'reassessment') { return 'whether what you did actually worked'; }
    if (band === 'communication') { return 'who else needs to know, and how you would say it'; }
    return 'the record';
  }

  /* ==========================================================================
   * 11. SBAR COVERAGE
   * ======================================================================== */

  function sbarCoverage(run, sc) {
    var expected = arr(obj(sc).sbar_expected);
    var said = normText(str(obj(obj(run).sbar).text) + ' ' +
      keysOf(obj(obj(run).sbar).sections).map(function (k) {
        return str(obj(obj(run).sbar).sections[k]);
      }).join(' '));
    var rows = expected.map(function (line) {
      var toks = sigWords(line);
      var hits = 0;
      toks.forEach(function (w) { if (tokenEcho(said, w)) { hits++; } });
      var frac = toks.length ? hits / toks.length : 0;
      return { line: str(line), covered: frac >= 0.28, frac: Math.round(frac * 100) / 100 };
    });
    var hit = rows.filter(function (x) { return x.covered; }).length;
    return { rows: rows, hit: hit, total: rows.length,
      pct: rows.length ? Math.round((hit / rows.length) * 100) : 0 };
  }

  /**
   * sbarTemplate(run, sc) - a fill-in built ONLY from what the learner has
   * actually uncovered. It never pre-fills a finding they have not earned.
   */
  function sbarTemplate(run, sc) {
    var facts = buildFacts(sc);
    var seen = obj(obj(run).revealed);
    function textsOf(pred) {
      return arr(facts.facts).filter(function (f) { return seen[f.key] && pred(f); })
        .map(function (f) { return f.text; });
    }
    return {
      s: textsOf(function (f) { return f.kind === 'intro'; }).join(' '),
      /* MAR first: what has already been given is the part of the background a
         provider actually needs, and it is the part a learner forgets. */
      b: textsOf(function (f) { return f.kind === 'mar'; })
        .concat(textsOf(function (f) { return f.kind === 'order'; }))
        .slice(0, 6).join('; '),
      a: textsOf(function (f) { return f.kind === 'finding' || f.kind === 'cue' || f.kind === 'vital'; })
        .slice(0, 6).join('; '),
      r: '',
      uncovered: arr(facts.facts).filter(function (f) { return !seen[f.key] && f.kind !== 'intro'; }).length
    };
  }

  /* ==========================================================================
   * 12. SOURCE DISCREPANCIES
   * --------------------------------------------------------------------------
   * An unresolved contradictory or likely-typo source fact is not scored at
   * all: it leaves the numerator AND the denominator. It is surfaced in a
   * "Source issue - verify with instructor" panel instead, and an instructor
   * override resolves it with an audit trail.
   * ======================================================================== */

  function discrepancies(sc, opts) {
    var over = obj(obj(opts).overrides);
    var byTopic = obj(over[str(obj(sc).topic_id)]);
    return arr(obj(sc).source_discrepancies).map(function (d, i) {
      var res = byTopic['d' + i] || byTopic[String(i)] || null;
      return {
        index: i, text: str(d),
        resolved: !!res,
        resolution: res ? str(obj(res).text || res) : '',
        resolvedBy: res ? str(obj(res).by) : '',
        resolvedAt: res ? numOr(obj(res).at, 0) : 0,
        tokens: sigWords(d)
      };
    });
  }
  function unresolvedDiscrepancies(sc, opts) {
    return discrepancies(sc, opts).filter(function (d) { return !d.resolved; });
  }

  /** Is this scored item implicated by an unresolved source issue? */
  function itemBlocked(item, sc, opts) {
    var open = unresolvedDiscrepancies(sc, opts);
    if (!open.length) { return null; }
    var hay = normText(str(obj(item).sourceFact) + ' ' + str(obj(item).label));
    if (!hay) { return null; }
    var hit = null;
    open.forEach(function (d) {
      if (hit) { return; }
      var toks = d.tokens.filter(function (w) {
        return w !== 'source' && w !== 'file' && w !== 'sheet' && w !== 'page'
          && w !== 'verify' && w !== 'instructor' && w !== 'school' && w !== 'student'
          && w !== 'version' && w !== 'phrase' && w !== 'wording' && w !== 'displays'
          && w !== 'labeled' && w !== 'intended' && w !== 'before' && w !== 'repeats'
          && w !== 'also' && w !== 'simulation' && w !== 'faculty';
      });
      if (toks.length < 2) { return; }
      var hits = 0;
      toks.forEach(function (w) { if (tokenEcho(hay, w)) { hits++; } });
      if (hits >= 2) { hit = d; }
    });
    return hit;
  }

  /* ==========================================================================
   * 13. SCORING
   * ======================================================================== */

  /** The scored item list, straight out of the scenario. */
  function scoreItems(run, sc) {
    var r = obj(run);
    var d = obj(r.done);
    var items = [];
    var prov = provenanceOf(sc);
    var crits = criticalIds(sc);

    function add(id, category, label, credited, sourceFact, detail) {
      items.push({
        id: id, category: category, label: label, credited: !!credited,
        sourceFact: str(sourceFact), provenance: prov,
        sourceFile: str(obj(sc).source_file), detail: str(detail),
        critical: crits.indexOf(id) !== -1
      });
    }

    /* -- safety ---------------------------------------------------------- */
    allowedIntents(sc).forEach(function (it) {
      if (lower(it.category) !== 'safety') { return; }
      add(it.id, 'safety', it.label, !!d[it.id], sourceFactForIntent(it.id, sc));
    });
    add('order_verification', 'safety', 'Verified the active orders before acting',
      !!d.review_chart || !!d.implement_orders,
      arr(obj(sc).orders).length ? 'orders (' + arr(obj(sc).orders).length + ' on the sheet)' : '');
    add('no_unsafe_actions', 'safety', 'No unsafe or unordered medication administration',
      arr(r.unsafe).length === 0,
      'SOURCE_RULES: medication administration requires an active order/MAR branch');

    /* -- assessment / recognition ---------------------------------------- */
    allowedIntents(sc).forEach(function (it) {
      var cat = lower(it.category);
      if (cat !== 'assessment' && cat !== 'clinical_reasoning') { return; }
      if (it.id === 'open_labs' || it.id === 'review_chart') { return; }
      add(it.id, 'assessment_recognition', it.label, !!d[it.id], sourceFactForIntent(it.id, sc));
    });
    if (arr(obj(sc).labs).length) {
      add('open_labs', 'assessment_recognition', 'Reviewed the laboratory data', !!d.open_labs,
        'labs (' + arr(obj(sc).labs).length + ' results on the sheet)');
    }
    if (arr(obj(sc).vital_trends).length > 1) {
      add('review_trends', 'assessment_recognition', 'Compared the current data with the prior trend',
        !!d.review_trends, 'vital_trends');
    }

    /* -- prioritization / interventions ---------------------------------- */
    allowedIntents(sc).forEach(function (it) {
      var cat = lower(it.category);
      if (cat !== 'intervention' && cat !== 'topic_specific') { return; }
      add(it.id, 'prioritization_interventions', it.label, !!d[it.id],
        firstOrderMatching(it.label, sc) || sourceFactForIntent(it.id, sc));
    });
    if (crits.length) {
      add('critical_actions', 'prioritization_interventions',
        'Completed the critical actions for this scenario',
        doneCriticals(r, sc).length === crits.length,
        'critical_actions: ' + crits.join(', '),
        doneCriticals(r, sc).length + ' of ' + crits.length + ' completed');
    }

    /* -- communication ---------------------------------------------------- */
    add('sbar', 'communication', 'Gave SBAR / escalated appropriately', !!r.sbar.given,
      arr(obj(sc).sbar_expected).length ? 'sbar_expected' : 'engine intent: SBAR');
    if (arr(obj(sc).sbar_expected).length) {
      var cov = sbarCoverage(r, sc);
      add('sbar_complete', 'communication', 'SBAR covered the expected elements',
        cov.total > 0 && cov.hit >= Math.ceil(cov.total * 0.75), 'sbar_expected',
        cov.hit + ' of ' + cov.total + ' elements covered');
    }

    /* -- reassessment / documentation / education ------------------------- */
    add('reassess', 'reassessment_documentation_education',
      'Reassessed after an intervention or a change in the patient',
      r.reassessCredits > 0, sourceFactForIntent('reassess', sc));
    allowedIntents(sc).forEach(function (it) {
      if (lower(it.category) !== 'documentation') { return; }
      add(it.id, 'reassessment_documentation_education', it.label, !!d[it.id],
        sourceFactForIntent(it.id, sc));
    });

    return items;
  }

  /**
   * scoreRun(run, sc, opts) -> the rubric result.
   *   - instructor-customisable weights
   *   - unsafe-action penalties inside the safety band
   *   - items implicated by an UNRESOLVED source discrepancy are removed from
   *     BOTH numerator and denominator
   *   - autoFailed is false unless an instructor explicitly configured it
   */
  function scoreRun(run, sc, opts) {
    var r = obj(run);
    var o = normOpts(sc, opts && keysOf(obj(opts)).length ? opts : obj(r.opts));
    var weights = o.weights;
    var items = scoreItems(r, sc);
    var blocked = [];

    items.forEach(function (it) {
      var d = itemBlocked(it, sc, o);
      if (d) { it.blocked = true; it.blockedBy = d; blocked.push(it); }
      else { it.blocked = false; }
    });

    var categories = CATEGORY_ORDER.map(function (cat) {
      var mine = items.filter(function (i) { return i.category === cat && !i.blocked; });
      var weight = numOr(weights[cat], 0);
      var possible = mine.length;
      var got = mine.filter(function (i) { return i.credited; }).length;
      var earned = possible ? (weight * got / possible) : (weight ? weight : 0);
      var scored = possible > 0;
      var pen = 0;
      arr(r.penalties).forEach(function (p) { if (p.category === cat) { pen += numOr(p.points, 0); } });
      var final = clamp(earned - pen, 0, weight);
      return {
        id: cat, label: CATEGORY_LABEL[cat] || cat, weight: weight,
        possible: possible, got: got, penalty: pen,
        earned: Math.round(final * 10) / 10,
        scored: scored,
        items: mine,
        blockedItems: items.filter(function (i) { return i.category === cat && i.blocked; })
      };
    });

    var denom = 0, num = 0;
    categories.forEach(function (c) {
      if (!c.scored) { return; }
      denom += c.weight;
      num += c.earned;
    });
    var pct = denom > 0 ? Math.round((num / denom) * 100) : 0;

    /* Never an automatic course failure unless the instructor configured one.
       The rubric says so in one sentence and this is that sentence in code. */
    var missedCrit = missedCriticals(r, sc).length;
    var autoFailed = false, autoFailReason = '';
    if (o.autoFail === true) {
      if (arr(r.unsafe).length > 0) {
        autoFailed = true;
        autoFailReason = 'Instructor-configured: an unsafe action ends the attempt.';
      } else if (missedCrit >= o.autoFailThreshold) {
        autoFailed = true;
        autoFailReason = 'Instructor-configured: ' + missedCrit + ' critical actions missed ' +
          '(threshold ' + o.autoFailThreshold + ').';
      }
    }

    return {
      categories: categories,
      total: Math.round(num * 10) / 10,
      possible: denom,
      configuredTotal: weightTotal(weights),
      pct: pct,
      penalties: arr(r.penalties).slice(),
      unsafeCount: arr(r.unsafe).length,
      criticalsDone: doneCriticals(r, sc).length,
      criticalsTotal: criticalIds(sc).length,
      criticalsMissed: missedCriticals(r, sc),
      notScored: blocked,
      openDiscrepancies: unresolvedDiscrepancies(sc, o),
      autoFailed: autoFailed,
      autoFailReason: autoFailReason,
      autoFailConfigured: o.autoFail === true,
      weights: weights,
      provenance: provenanceOf(sc),
      sourceFile: str(obj(sc).source_file)
    };
  }

  /* ==========================================================================
   * 14. DEBRIEF
   * --------------------------------------------------------------------------
   * Reveal-aware. A fact the learner never uncovered is named by its SYSTEM
   * while the run is still live ("Lung sounds - never auscultated"), and only
   * spelled out once the run has ended, which is the point at which it becomes
   * teaching rather than a leak.
   * ======================================================================== */

  function buildDebrief(run, sc, opts) {
    var r = obj(run);
    var o = normOpts(sc, opts && keysOf(obj(opts)).length ? opts : obj(r.opts));
    var ended = !!r.endedAt;
    var facts = buildFacts(sc);
    var seen = obj(r.revealed);
    var score = scoreRun(r, sc, o);

    var timeline = arr(r.actions).map(function (a) {
      return {
        atSec: a.atSec, clock: fmtClock(a.atSec), label: a.label, intent: a.intent,
        category: a.category, critical: !!a.critical, source: str(a.source),
        provenance: provenanceOf(sc)
      };
    });

    var missedData = arr(facts.facts).filter(function (f) {
      return !seen[f.key] && f.kind !== 'intro';
    }).map(function (f) {
      return {
        key: f.key, kind: f.kind, domain: f.domain,
        label: (DOMAIN_LABEL[f.domain] || f.domain) + ' - never assessed',
        /* THE LEAK GATE. Empty until the run is over. */
        text: ended ? f.text : '',
        provenance: f.provenance, source: f.source
      };
    });

    var cov = sbarCoverage(r, sc);
    var remediation = remediationPlan(r, sc, score, cov, missedData);

    return {
      topicId: str(sc.topic_id),
      title: str(sc.title),
      ended: ended,
      endReason: str(r.endReason),
      mode: r.mode,
      state: r.state,
      elapsedSec: elapsedSec(r, r.endedAt || nowMs()),
      timeline: timeline,
      criticalsCompleted: doneCriticals(r, sc).map(function (id) {
        var it = intentById(sc, id);
        return { intent: id, label: it ? it.label : id, source: sourceFactForIntent(id, sc),
          provenance: provenanceOf(sc) };
      }),
      criticalsMissed: missedCriticals(r, sc).map(function (id) {
        var it = intentById(sc, id);
        return { intent: id, label: it ? it.label : id, source: sourceFactForIntent(id, sc),
          provenance: provenanceOf(sc) };
      }),
      unsafeActions: arr(r.unsafe).slice(),
      outOfOrder: outOfOrderActions(r, sc),
      missedData: missedData,
      reassessed: r.reassessCredits > 0,
      reassessAttempts: r.reassessAttempts,
      prematureReassessments: Math.max(0, r.reassessAttempts - r.reassessCredits),
      sbar: { given: !!r.sbar.given, coverage: cov },
      deterioration: arr(r.deteriorationReasons).slice(),
      score: score,
      remediation: remediation,
      studyLinks: studyLinks(sc, score, missedData),
      sourceIssues: discrepancies(sc, o),
      aiViolations: arr(r.aiViolations).slice(),
      provenance: provenanceOf(sc),
      sourceFile: str(sc.source_file),
      educationOnly: obj(sc).education_only !== false
    };
  }

  /** A single flat string of everything the debrief would show. The suite uses
      it to prove nothing hidden leaks through this surface. */
  function debriefText(run, sc, opts) {
    var d = buildDebrief(run, sc, opts);
    var parts = [d.title, d.endReason, d.state];
    d.timeline.forEach(function (t) { parts.push(t.label + ' ' + t.source); });
    d.criticalsCompleted.forEach(function (c) { parts.push(c.label + ' ' + c.source); });
    d.criticalsMissed.forEach(function (c) { parts.push(c.label + ' ' + c.source); });
    d.unsafeActions.forEach(function (u) { parts.push(str(u.text)); });
    d.outOfOrder.forEach(function (u) { parts.push(str(u.text)); });
    d.missedData.forEach(function (m) { parts.push(m.label + ' ' + m.text); });
    d.remediation.forEach(function (m) { parts.push(m.title + ' ' + m.body); });
    d.sourceIssues.forEach(function (s) { parts.push(s.text); });
    d.score.categories.forEach(function (c) {
      parts.push(c.label + ' ' + c.earned);
      c.items.forEach(function (i) { parts.push(i.label + ' ' + i.sourceFact + ' ' + i.detail); });
    });
    return parts.join(' \n ');
  }

  function outOfOrderActions(run, sc) {
    var r = obj(run);
    var out = [];
    var sawAssessment = false, sawHygiene = false;
    arr(r.actions).forEach(function (a) {
      var cat = lower(a.category);
      if (a.intent === 'hand_hygiene') { sawHygiene = true; }
      if (cat === 'assessment') { sawAssessment = true; }
      if ((cat === 'intervention' || cat === 'topic_specific') && !sawAssessment) {
        out.push({ atSec: a.atSec, intent: a.intent,
          text: 'Intervened (' + a.label + ') before any assessment was performed.' });
      }
      if (cat !== 'safety' && !sawHygiene && intentById(sc, 'hand_hygiene')) {
        out.push({ atSec: a.atSec, intent: a.intent,
          text: 'Touched the patient (' + a.label + ') before hand hygiene was recorded.' });
        sawHygiene = true; // report it once, not on every action
      }
    });
    if (r.reassessAttempts > r.reassessCredits) {
      out.push({ atSec: 0, intent: 'reassess',
        text: (r.reassessAttempts - r.reassessCredits) + ' reassessment(s) before anything had ' +
          'changed - a reassessment earns credit after an intervention, not before one.' });
    }
    return out;
  }

  /** Exactly three, personalised, ordered by what would move the needle most. */
  function remediationPlan(run, sc, score, cov, missedData) {
    var r = obj(run);
    var cand = [];
    if (arr(r.unsafe).length) {
      cand.push({ weight: 100, title: 'Order verification before any medication',
        body: 'You gave ' + arr(r.unsafe).map(function (u) { return str(u.med); }).join(', ') +
          ' with no order and no MAR entry. Before any medication: find the order, find the MAR ' +
          'entry, check the five rights. If it is not charted, it does not exist.',
        section: 'meds' });
    }
    var missed = missedCriticals(r, sc);
    if (missed.length) {
      var it = intentById(sc, missed[0]);
      cand.push({ weight: 90, title: 'Critical action missed: ' + (it ? it.label : missed[0]),
        body: 'This scenario lists ' + criticalIds(sc).length + ' critical actions and you ' +
          'completed ' + doneCriticals(r, sc).length + '. Work the list in priority order: ' +
          'safety, airway and breathing, circulation, then escalation.',
        section: 'in_room_sequence' });
    }
    if (!r.sbar.given) {
      cand.push({ weight: 80, title: 'Escalate with SBAR',
        body: 'No report went to the provider. Practise the four lines out loud until you can ' +
          'give them in under thirty seconds.', section: 'sbar' });
    } else if (obj(cov).total && obj(cov).hit < obj(cov).total) {
      cand.push({ weight: 55, title: 'Tighten the SBAR',
        body: 'You covered ' + cov.hit + ' of ' + cov.total + ' expected elements. The missing ' +
          'ones are the ones the provider needs to act on.', section: 'sbar' });
    }
    if (r.reassessCredits === 0) {
      cand.push({ weight: 70, title: 'Reassess after every intervention',
        body: 'Nothing you did was followed by a reassessment. The intervention is half the ' +
          'work; the response is the other half and it is where the points are.',
        section: 'in_room_sequence' });
    }
    var labMissed = arr(missedData).filter(function (m) { return m.kind === 'lab'; }).length;
    if (labMissed) {
      cand.push({ weight: 60, title: 'Open the labs',
        body: 'You never opened the lab panel, so ' + labMissed + ' results on this sheet were ' +
          'never seen. The lab data is usually what tells you how bad this is.', section: 'labs' });
    }
    var domMissed = {};
    arr(missedData).forEach(function (m) {
      if (m.kind === 'finding') { domMissed[m.domain] = (domMissed[m.domain] || 0) + 1; }
    });
    keysOf(domMissed).forEach(function (d) {
      cand.push({ weight: 40 + domMissed[d], title: 'Assess: ' + (DOMAIN_LABEL[d] || d),
        body: 'There were findings in that system you never went looking for.', section: 'red_flags' });
    });
    if (arr(r.hints).length >= 4) {
      cand.push({ weight: 30, title: 'Run it once without hints',
        body: 'You used ' + arr(r.hints).length + ' hints. Try the same scenario in exam mode.',
        section: 'overview' });
    }

    /* Time to the first ABC assessment - the one debrief metric the spec names
       that is pure timing. */
    var abc = arr(r.actions).filter(function (a) {
      return a.intent === 'abc_assessment' || lower(a.label).indexOf('abc') !== -1;
    })[0];
    if (!abc) {
      cand.push({ weight: 85, title: 'Start with ABCs',
        body: 'No airway-breathing-circulation assessment appears anywhere in your timeline. ' +
          'It is the first thing you do, every time, before anything else.', section: 'red_flags' });
    } else if (abc.atSec > 60) {
      cand.push({ weight: 45, title: 'Get to ABCs faster',
        body: 'Your first ABC assessment was at ' + fmtClock(abc.atSec) + '. In a twenty-minute ' +
          'window that is time you do not get back. Target the first minute.',
        section: 'in_room_sequence' });
    }

    /* Always-available closers, so the plan is always three things. They are
       still personalised - each one names what this run actually did. */
    cand.push({ weight: 14, title: 'Rehearse it in the room',
      body: 'Run this same scenario in Room / Checkoff Coach mode with the mannequin and say ' +
        'every step out loud. Saying it is what makes it survive the checkoff.',
      section: 'in_room_sequence' });
    cand.push({ weight: 12, title: 'Give the SBAR from memory',
      body: 'Close the app and give this patient\'s SBAR out loud in under thirty seconds. ' +
        'If you cannot, that is the gap, not the pathophysiology.', section: 'sbar' });
    cand.push({ weight: 10, title: 'Run it again for speed',
      body: 'You finished in ' + fmtClock(elapsedSec(r, r.endedAt || r.startedAt)) +
        '. You have the sequence - now compress it into the twenty minutes you actually get.',
      section: 'overview' });

    cand.sort(function (a, b) { return b.weight - a.weight; });
    return cand.slice(0, 3);
  }

  function studyLinks(sc, score, missedData) {
    var out = [];
    var topicId = str(obj(sc).topic_id);
    var wanted = {};
    arr(obj(score).categories).forEach(function (c) {
      if (c.possible && c.got < c.possible) { wanted[STUDY_SECTION_FOR[c.id] || 'overview'] = true; }
    });
    arr(missedData).forEach(function (m) {
      if (m.kind === 'lab') { wanted.labs = true; }
      if (m.kind === 'order' || m.kind === 'mar') { wanted.meds = true; }
      if (m.kind === 'cue') { wanted.deterioration_cues = true; }
    });
    keysOf(wanted).forEach(function (k) {
      var l = studyLink(topicId, k, STUDY_SECTION_LABEL[k] || k);
      if (l) { out.push(l); }
    });
    return out;
  }
  var STUDY_SECTION_FOR = {
    safety: 'common_mistakes',
    assessment_recognition: 'red_flags',
    prioritization_interventions: 'in_room_sequence',
    communication: 'sbar',
    reassessment_documentation_education: 'in_room_sequence'
  };
  var STUDY_SECTION_LABEL = {
    overview: '60-second overview', red_flags: 'Red flags / what to notice first',
    in_room_sequence: 'In-room action sequence', sbar: 'SBAR builder',
    labs: 'Labs for this patient', meds: 'Medications and MAR timeline',
    common_mistakes: 'Common mistakes', deterioration_cues: 'Deterioration cues'
  };

  /* ==========================================================================
   * 15. COMPLETION GATE
   * --------------------------------------------------------------------------
   * The learner must explicitly reassess AND give SBAR/escalation before the
   * scenario counts as complete, unless the instructor turns those off.
   * ======================================================================== */

  function completionBlockers(run, sc, opts) {
    var r = obj(run);
    var o = normOpts(sc, opts && keysOf(obj(opts)).length ? opts : obj(r.opts));
    var out = [];
    if (o.requireReassessBeforeEnd && r.reassessCredits < 1) {
      out.push({ id: 'reassess', text: 'State a reassessment - what changed after what you did?' });
    }
    if (o.requireSbarBeforeEnd && !r.sbar.given) {
      out.push({ id: 'sbar', text: 'Give SBAR / escalate before you close the scenario.' });
    }
    return out;
  }
  function canComplete(run, sc, opts) {
    return completionBlockers(run, sc, opts).length === 0;
  }

  /* ==========================================================================
   * 16. COACH REHEARSAL STYLES
   * ======================================================================== */

  var COACH_STYLES = [
    { id: 'silent', name: 'Silent examiner',
      blurb: 'No hints, no prompts, no dialogue. You are being watched, not helped.',
      hints: false, dialogue: false, prompts: false },
    { id: 'coach', name: 'Coach',
      blurb: 'Hints only when you ask for them. Nothing volunteered.',
      hints: true, dialogue: false, prompts: false },
    { id: 'callresponse', name: 'Call-and-response',
      blurb: 'The app plays the patient, the family and the provider so you can practise talking.',
      hints: true, dialogue: true, prompts: true },
    { id: 'checklist', name: 'Checklist only',
      blurb: 'The list and the clock. No AI dialogue at all.',
      hints: true, dialogue: false, prompts: false }
  ];
  var COACH_STYLES_MAP = {};
  COACH_STYLES.forEach(function (s) { COACH_STYLES_MAP[s.id] = s; });
  function coachStyle(id) { return COACH_STYLES_MAP[lower(id)] || COACH_STYLES_MAP.coach; }

  /* ==========================================================================
   * 17. PAUSE CONTROL  (the shared convention - identical verbs to
   *     js/sim-engine.js, js/ai-scenario.js, js/codeblue.js and js/ms2lab.js)
   * ======================================================================== */

  function createPauseHub(id) {
    var host = null;
    var subs = [];
    function stats() {
      if (!host) {
        return { active: false, paused: false, pauseCount: 0, pausedMs: 0, pausedSec: 0,
          mode: '', simSec: 0 };
      }
      return host.stats();
    }
    function emit() {
      var snap = stats();
      subs.slice().forEach(function (fn) { try { fn(!!snap.paused, snap); } catch (e) {} });
    }
    var hub = {
      id: str(id) || 'simprep-sim',
      pauseRun: function (reason) { return !!(host && host.pause(reason)); },
      resumeRun: function () { return !!(host && host.resume()); },
      togglePauseRun: function () { return !!(host && host.toggle()); },
      isRunPaused: function () { return !!(host && host.isPaused()); },
      canPauseRun: function () { return !!(host && host.canPause()); },
      pauseStats: stats,
      onPauseChange: function (cb) {
        if (!isFn(cb)) { return function () {}; }
        subs.push(cb);
        return function () { subs = subs.filter(function (f) { return f !== cb; }); };
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

  var simprepPause = createPauseHub('simprep-sim');
  registerPauseControl(simprepPause.pauseControl);

  /* ==========================================================================
   * 18. PARTNER BRIDGE  (optional - solo is the default and the fallback)
   * ======================================================================== */

  function partnerApi() {
    var p = obj(MMx().simprepPartner);
    return isFn(p.subscribe) ? p : null;
  }
  function partnerRoom() {
    var p = partnerApi();
    if (!p || !isFn(p.getRoom)) { return null; }
    try { return p.getRoom() || null; } catch (e) { return null; }
  }
  function partnerIsHost() {
    var p = partnerApi();
    if (!p || !isFn(p.isHost)) { return true; }
    try { return !!p.isHost(); } catch (e) { return true; }
  }
  function partnerPublish(evt) {
    var p = partnerApi();
    if (!p || !isFn(p.publish)) { return false; }
    try { p.publish(evt); return true; } catch (e) { return false; }
  }
  function partnerOnEvent(cb) {
    var p = partnerApi();
    if (!p || !isFn(p.onEvent)) { return function () {}; }
    try {
      var off = p.onEvent(cb);
      return isFn(off) ? off : function () {};
    } catch (e) { return function () {}; }
  }
  function partnerSetActivity(a) {
    var p = partnerApi();
    if (!p || !isFn(p.setActivity)) { return; }
    try { p.setActivity(a); } catch (e) {}
  }

  /* ==========================================================================
   * 19. AI LAYER  (accessory, never a gate)
   * --------------------------------------------------------------------------
   * Follows the /api/ai conventions in js/ai-scenario.js: strict JSON, a
   * completeTruncatedJSON() salvage before any repair round-trip, hard token
   * caps, and tier routing through aiConfig.tiers[t].featureModels[feature].
   * Every failure path lands on the deterministic matcher with the run intact.
   * ======================================================================== */

  var F_INTENT  = 'patient';   // the language interface (routed like the patient voice)
  var F_VOICE   = 'patient';   // role-play
  var F_SBAR    = 'sbar';
  var F_DEBRIEF = 'debrief';

  var INTENT_MAX_TOKENS  = 300;
  var VOICE_MAX_TOKENS   = 420;
  var DEBRIEF_MAX_TOKENS = 1100;
  var REPAIR_MAX_TOKENS  = 700;
  var INTENT_TEMP = 0.1;
  var VOICE_TEMP  = 0.6;

  function aiApi() { return obj(MMx().ai); }
  function aiReady() {
    var ai = aiApi();
    if (!isFn(ai.chat)) { return false; }
    if (!isFn(ai.isAvailable)) { return true; }
    try { return !!ai.isAvailable(); } catch (e) { return false; }
  }

  function stripFences(s) {
    return str(s).replace(/^\s*```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  function parseJsonReply(raw) {
    var s = stripFences(raw).trim();
    if (!s) { return null; }
    try { return JSON.parse(s); } catch (e) {}
    var start = s.indexOf('{');
    if (start > 0) {
      try { return JSON.parse(s.slice(start)); } catch (e2) {}
    }
    return completeTruncatedJSON(s);
  }

  /** Same salvage as js/ai-scenario.js: close what the token ceiling cut off,
      invent nothing. */
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
      if (ch === '{' || ch === '[') { stack.push(ch); }
      else if (ch === '}' || ch === ']') { stack.pop(); }
    }
    var tail = '';
    if (inStr) { tail += '"'; }
    var out = s.replace(/,\s*$/, '');
    for (i = stack.length - 1; i >= 0; i--) { tail += (stack[i] === '{' ? '}' : ']'); }
    try {
      var parsed = JSON.parse(out + tail);
      return (parsed && typeof parsed === 'object') ? parsed : null;
    } catch (e) { return null; }
  }

  /** The ground truth handed to every prompt. Verbatim, and labelled as the
      only facts that exist. */
  function groundTruth(sc, run) {
    var s = obj(sc);
    var seen = obj(obj(run).revealed);
    var facts = buildFacts(s);
    var lines = [];
    lines.push('SCENARIO: ' + str(s.title) + '  [provenance: ' + provenanceOf(s) +
      (str(s.source_file) ? ', source file: ' + str(s.source_file) : '') + ']');
    lines.push('This is a nursing STUDY SIMULATION. Education only. Not real patient care.');
    lines.push('');
    lines.push('HANDOFF (the learner has this): ' + str(s.case_intro));
    lines.push('');
    lines.push('ALLOWED ACTION INTENT IDS (the ONLY ids you may return):');
    allowedIntents(s).forEach(function (a) {
      lines.push('  ' + a.id + ' = ' + a.label + '  [' + a.category + ']');
    });
    lines.push('');
    lines.push('FACTS THE LEARNER HAS ALREADY UNCOVERED (you may refer to these):');
    var any = false;
    arr(facts.facts).forEach(function (f) {
      if (!seen[f.key] || f.kind === 'intro') { return; }
      any = true;
      lines.push('  - ' + f.text);
    });
    if (!any) { lines.push('  (nothing yet beyond the handoff)'); }
    lines.push('');
    lines.push('FACTS THE LEARNER HAS NOT UNCOVERED: you must NOT mention, hint at, ' +
      'paraphrase or allude to any assessment finding, lab, order, MAR entry or vital sign ' +
      'that is not in the list above. If asked about one, say the learner has not assessed it yet.');
    lines.push('');
    lines.push('ABSOLUTE PROHIBITIONS. You may never state: a provider order, a medication, ' +
      'a dose, a route, a rate, a lab value, a diagnostic result, an allergy, a code status, ' +
      'a vital sign, or a device setting - unless it is verbatim in the list above. There is ' +
      'no situation in which you invent one. If the learner asks for something that is not ' +
      'there, say it is not in the chart and to verify with the provider or the instructor.');
    return lines.join('\n');
  }

  var INTENT_SYSTEM_TAIL = [
    '',
    'YOUR ONLY JOB: map the learner\'s words onto ONE allowed action intent id.',
    'Reply with a single JSON object and nothing else:',
    '{"intent":"<one id from the list, or empty string>","target":"<a scenario fact or empty>",',
    ' "confidence":0.0-1.0,"requires_order":true|false,"matched_source_fact":"<verbatim scenario text or empty>",',
    ' "clarify":"<one short question, only when confidence is low>"}',
    'Accept clinically equivalent wording - "check O2 sat", "pulse ox" and "SpO2" are the same intent.',
    'Never require exact phrasing. If you are not confident, return an empty intent and a clarify question.',
    'Do NOT include any other field. Do NOT narrate. Do NOT give an order.'
  ].join('\n');

  /**
   * aiWidenIntent(text, sc, run) -> Promise<match|null>
   * Used ONLY when the deterministic matcher lands under the clarify
   * threshold. Any failure resolves to null and the caller keeps its
   * deterministic answer. Never rejects.
   */
  function aiWidenIntent(text, sc, run) {
    if (!aiReady() || !obj(obj(run).opts).allowAi) { return Promise.resolve(null); }
    var ai = aiApi();
    var sys = groundTruth(sc, run) + INTENT_SYSTEM_TAIL;
    var call;
    try {
      call = ai.chat({
        system: sys,
        messages: [{ role: 'user', content: 'Learner said: "' + cut(str(text), 300) + '"' }],
        maxTokens: INTENT_MAX_TOKENS,
        temperature: INTENT_TEMP,
        json: true,
        feature: F_INTENT
      });
    } catch (e) { return Promise.resolve(null); }
    return Promise.resolve(call).then(function (raw) {
      var parsed = parseJsonReply(raw);
      if (!parsed) { return null; }
      var v = validateAIReply(parsed, sc, run);
      if (!v.intent) { return null; }
      var det = matchIntent(text, sc, {});
      /* The engine recomputes the consequential fields. The model's job ended
         at naming an id. */
      return {
        intent: v.intent,
        target: v.target,
        confidence: Math.max(v.confidence, 0.6),
        requires_order: det.intent === v.intent ? det.requires_order
          : (lower(str(obj(intentById(sc, v.intent)).category)) === 'intervention'),
        matched_source_fact: v.matched_source_fact || sourceFactForIntent(v.intent, sc),
        alternatives: det.alternatives,
        needsClarification: false,
        clarify: '',
        vague: false,
        source: 'ai',
        violations: v.violations,
        said: str(text)
      };
    }, function () { return null; });
  }

  /**
   * resolveIntent(text, sc, run) -> Promise<match>
   * Deterministic first, AI only to widen, and the deterministic answer is
   * always the floor. Never rejects, never blocks the run.
   */
  function resolveIntent(text, sc, run) {
    var det = matchIntent(text, sc, {});
    if (det.intent || det.vague) { return Promise.resolve(det); }
    return aiWidenIntent(text, sc, run).then(function (ai) {
      return ai || det;
    }, function () { return det; });
  }

  var VOICE_SYSTEM_TAIL = [
    '',
    'YOUR ONLY JOB: speak one short line in the voice you are asked for (patient, family ' +
      'member, or provider on the phone). Two sentences at most.',
    'Reply with a single JSON object: {"say":"<the line>"}',
    'The patient answers ONLY what was asked. The patient does not volunteer an assessment ' +
      'finding, does not diagnose, and does not know their lab values.',
    'A provider may acknowledge an SBAR but may NOT give any new order. If asked for one, say ' +
      'you will assess at the bedside and to continue the existing orders.',
    'Do NOT include any other field.'
  ].join('\n');

  /**
   * aiSpeak(who, prompt, sc, run) -> Promise<{text, violations}>
   * The returned text has already been through both guard layers. On any
   * failure it resolves with an empty string and the caller falls back to
   * authored or silence - never to an unchecked line.
   */
  function aiSpeak(who, prompt, sc, run) {
    var empty = { text: '', violations: [], ok: false };
    if (!aiReady() || !obj(obj(run).opts).allowAi) { return Promise.resolve(empty); }
    var ai = aiApi();
    var sys = groundTruth(sc, run) + VOICE_SYSTEM_TAIL +
      '\n\nYou are speaking as: ' + str(who) + '.';
    var call;
    try {
      call = ai.chat({
        system: sys,
        messages: [{ role: 'user', content: cut(str(prompt), 600) }],
        maxTokens: VOICE_MAX_TOKENS,
        temperature: VOICE_TEMP,
        json: true,
        feature: F_VOICE
      });
    } catch (e) { return Promise.resolve(empty); }
    return Promise.resolve(call).then(function (raw) {
      var parsed = parseJsonReply(raw);
      if (!parsed) { return empty; }
      var v = validateAIReply(parsed, sc, run);
      return { text: v.say, violations: v.violations, ok: !!v.say };
    }, function () { return empty; });
  }

  /**
   * aiDebrief(run, sc) -> Promise<{text, violations}>
   * Prose only. Every number in the deterministic debrief is already computed;
   * the model is here to say it like a clinical instructor would, and its prose
   * goes through the same guard as everything else.
   */
  function aiDebrief(run, sc) {
    var empty = { text: '', violations: [], ok: false };
    if (!aiReady() || !obj(obj(run).opts).allowAi) { return Promise.resolve(empty); }
    var ai = aiApi();
    var d = buildDebrief(run, sc);
    var sys = groundTruth(sc, run) + '\n\nYOUR ONLY JOB: write a short debrief paragraph ' +
      '(120 words maximum) for a nursing student, in the voice of a supportive clinical ' +
      'instructor. Use ONLY the performance summary below and the facts above. Introduce no ' +
      'new clinical facts, no numbers that are not given to you, and no orders.\n' +
      'Reply with a single JSON object: {"say":"<the paragraph>"}';
    var summary = [
      'Mode: ' + d.mode + '. Final state: ' + d.state + '.',
      'Critical actions completed: ' + d.criticalsCompleted.length + ' of ' +
        (d.criticalsCompleted.length + d.criticalsMissed.length) + '.',
      'Unsafe actions: ' + d.unsafeActions.length + '.',
      'Reassessed after an intervention: ' + (d.reassessed ? 'yes' : 'no') + '.',
      'SBAR given: ' + (d.sbar.given ? 'yes' : 'no') + '.',
      'Score: ' + d.score.total + ' of ' + d.score.possible + '.'
    ].join('\n');
    var call;
    try {
      call = ai.chat({
        system: sys,
        messages: [{ role: 'user', content: summary }],
        maxTokens: DEBRIEF_MAX_TOKENS,
        temperature: 0.5,
        json: true,
        feature: F_DEBRIEF
      });
    } catch (e) { return Promise.resolve(empty); }
    return Promise.resolve(call).then(function (raw) {
      var parsed = parseJsonReply(raw);
      if (!parsed) { return empty; }
      var v = validateAIReply(parsed, sc, run);
      return { text: v.say, violations: v.violations, ok: !!v.say };
    }, function () { return empty; });
  }

  /* ==========================================================================
   * 20. SHARED PRESENTATION BITS
   * ======================================================================== */

  function Badge(p) {
    var o = obj(p);
    return ce('span', { className: 'spx-badge' + (o.tone ? ' ' + o.tone : '') }, o.children);
  }

  function ProvBadge(p) {
    var sc = obj(obj(p).sc);
    var prov = provenanceOf(sc);
    return ce('span', {
      className: 'spx-prov ' + prov,
      title: str(sc.source_file) ? ('Source file: ' + str(sc.source_file)) : 'No school file imported yet'
    }, provenanceLabel(sc));
  }

  /**
   * SafetyLabel - the permanent, non-dismissible practice-only notice.
   * There is no close button, no collapsed state and no prop that hides it.
   * It is sticky at the top AND fixed at the bottom of the coach surface, so
   * it cannot be scrolled away either.
   */
  function SafetyLabel(p) {
    var foot = obj(p).foot;
    if (foot) {
      return ce('div', { className: 'spx-onlyfoot', role: 'note' },
        'SIMULATION / MANNEQUIN PRACTICE ONLY - NOT REAL-PATIENT CLINICAL DECISION SUPPORT');
    }
    return ce('div', { className: 'spx-onlylabel', role: 'note' },
      ce('span', { className: 'spx-oltag' }, 'PRACTICE ONLY'),
      ce('span', null, 'Simulation / mannequin practice only. This is not real-patient ' +
        'clinical decision support. Follow your clinical instructor, your facility policy ' +
        'and your state nurse practice act for anything involving a real patient.'));
  }

  function ContentMissing(p) {
    injectStyles();
    return ce('div', { className: 'spx-root' },
      ce(SafetyLabel, null),
      ce('div', { className: 'spx-card' },
        ce('h3', null, 'Clinical Simulation Prep content did not load'),
        ce('p', { className: 'spx-sub' },
          'The scenario file (data/nur2212-scenarios.js, which publishes ' +
          'window.NUR2212_SCENARIOS) is not on the page, so there is nothing to run. ' +
          'Nothing has been lost and nothing is broken - the module is waiting on its data.'),
        ce('p', { className: 'spx-dim' },
          'If you are wiring this up: add the data script BEFORE js/simprep-sim.js. ' +
          'If you are studying: reload the page, and if it happens again the deploy is ' +
          'missing a file.'),
        isFn(obj(p).onNav)
          ? ce('button', { className: 'spx-btn', type: 'button',
              onClick: function () { obj(p).onNav('home'); } }, 'Back')
          : null));
  }

  function Section(p) {
    var o = obj(p);
    return ce('div', { className: 'spx-card' },
      o.title ? ce('h3', null, o.title) : null,
      o.sub ? ce('p', { className: 'spx-sub' }, o.sub) : null,
      o.children);
  }

  function LogList(p) {
    var lines = arr(obj(p).lines);
    if (!lines.length) { return ce('div', { className: 'spx-empty' }, 'Nothing yet.'); }
    return ce('div', { className: 'spx-log' },
      lines.slice(-60).reverse().map(function (l) {
        return ce('div', { className: 'spx-line ' + str(l.kind), key: 'l' + l.seq },
          ce('span', { className: 'spx-tt' }, fmtClock(l.atSec)),
          ce('span', { className: 'spx-lb' }, str(l.text),
            str(l.detail) ? ce('span', { className: 'spx-ld' }, str(l.detail)) : null));
      }));
  }

  /* ==========================================================================
   * 21. THE RUN HOOK  (clock, events, pause, partner)
   * ======================================================================== */

  function useRun(sc, setup) {
    var optsRef = useRef(setup);
    optsRef.current = setup;

    var runH = useState(function () { return initialRun(sc, setup); });
    var run = runH[0], setRun = runH[1];
    var runRef = useRef(run);
    runRef.current = run;

    var meRef = useRef('spx' + Math.random().toString(36).slice(2, 9));

    var dispatch = useCallback(function (evt, opts) {
      var e = shallow(obj(evt));
      if (!e.at) { e.at = nowMs(); }
      if (!e.by) { e.by = meRef.current; }
      setRun(function (prev) { return applyEvent(prev, e, sc); });
      if (!obj(opts).noShare && partnerRoom()) { partnerPublish(e); }
    }, [sc]);

    /* Partner echo: fold everything that did not originate here. */
    useEffect(function () {
      if (!partnerRoom()) { return undefined; }
      var off = partnerOnEvent(function (evt) {
        var e = obj(evt);
        if (!e || !e.type) { return; }
        if (e.by === meRef.current) { return; }
        setRun(function (prev) { return applyEvent(prev, e, sc); });
      });
      return function () { try { off(); } catch (e) {} };
    }, [sc]);

    /* Ticker. Stops dead while paused or ended - which is what "frozen" means.
       Nothing here accumulates: every tick just re-derives from timestamps. */
    var ended = !!run.endedAt;
    var paused = !!run.pausedAt;
    useEffect(function () {
      if (ended || paused) { return undefined; }
      var id = window.setInterval(function () {
        setRun(function (prev) { return applyEvent(prev, { type: EV_TICK, at: nowMs() }, sc); });
      }, 1000);
      return function () { window.clearInterval(id); };
    }, [ended, paused, sc]);

    /* -------- the shared pause verbs --------------------------------- */
    var pauseApiRef = useRef(null);
    pauseApiRef.current = {
      isPaused: function () { return !!runRef.current.pausedAt; },
      canPause: function () { return !runRef.current.endedAt; },
      pause: function (reason) {
        if (runRef.current.endedAt || runRef.current.pausedAt) { return false; }
        dispatch({ type: EV_PAUSE, reason: str(reason) });
        return true;
      },
      resume: function () {
        if (!runRef.current.pausedAt) { return false; }
        dispatch({ type: EV_RESUME });
        return true;
      },
      toggle: function () {
        if (runRef.current.pausedAt) { return !pauseApiRef.current.resume(); }
        pauseApiRef.current.pause();
        return true;
      },
      stats: function () {
        var r = runRef.current;
        var held = numOr(r.pausedMs, 0) + (r.pausedAt ? Math.max(0, nowMs() - r.pausedAt) : 0);
        return {
          active: !r.endedAt, paused: !!r.pausedAt, mode: r.mode,
          pauseCount: numOr(r.pauseCount, 0), pausedMs: held,
          pausedSec: Math.floor(held / 1000), simSec: elapsedSec(r, nowMs())
        };
      }
    };
    useEffect(function () {
      return simprepPause._attach({
        isPaused: function () { return pauseApiRef.current.isPaused(); },
        canPause: function () { return pauseApiRef.current.canPause(); },
        pause: function (r) { return pauseApiRef.current.pause(r); },
        resume: function () { return pauseApiRef.current.resume(); },
        toggle: function () { return pauseApiRef.current.toggle(); },
        stats: function () { return pauseApiRef.current.stats(); }
      });
    }, []);
    useEffect(function () { simprepPause._changed(); },
      [run.pausedAt, run.pauseCount, run.pausedMs, run.endedAt]);

    return {
      run: run, setRun: setRun, dispatch: dispatch,
      pause: function (r) { return pauseApiRef.current.pause(r); },
      resume: function () { return pauseApiRef.current.resume(); },
      toggle: function () { return pauseApiRef.current.toggle(); },
      isPaused: function () { return pauseApiRef.current.isPaused(); },
      me: meRef.current
    };
  }

  /* ==========================================================================
   * 22. SCENARIO PICKER + PRE-BRIEF
   * ======================================================================== */

  function Picker(p) {
    var o = obj(p);
    var list = allScenarios();
    return ce('div', null,
      ce('div', { className: 'spx-head' },
        ce('div', null,
          ce('h2', null, str(o.heading) || 'Clinical Simulation Prep'),
          ce('p', { className: 'spx-sub' },
            'Twelve NUR2212 topics. Pick one and run it the way the lab runs it.'))),
      ce('div', { className: 'spx-grid' },
        list.map(function (sc) {
          return ce('button', {
            className: 'spx-tile', type: 'button', key: str(sc.topic_id),
            onClick: function () { if (isFn(o.onPick)) { o.onPick(str(sc.topic_id)); } }
          },
            ce('span', { className: 'spx-t' }, str(sc.title)),
            ce('span', { className: 'spx-d' },
              durationMinutes(sc) + ' minutes  |  ' +
              criticalIds(sc).length + ' critical actions  |  ' +
              arr(sc.labs).length + ' labs'),
            ce('span', { className: 'spx-row' },
              ce(ProvBadge, { sc: sc }),
              arr(sc.source_discrepancies).length
                ? ce('span', { className: 'spx-badge warn' }, 'Source issue')
                : null));
        })));
  }

  function PreBrief(p) {
    var o = obj(p);
    var sc = obj(o.sc);
    var modeH = useState('practice');
    var mode = modeH[0], setMode = modeH[1];
    var styleH = useState('coach');
    var style = styleH[0], setStyle = styleH[1];
    var reqH = useState(true);
    var req = reqH[0], setReq = reqH[1];

    return ce('div', null,
      ce('div', { className: 'spx-head' },
        ce('div', null,
          ce('h2', null, str(sc.title)),
          ce('p', { className: 'spx-sub' },
            durationMinutes(sc) + '-minute encounter. ' + criticalIds(sc).length +
            ' critical actions.')),
        ce('span', { className: 'spx-spacer' }),
        ce(ProvBadge, { sc: sc })),

      ce(Section, { title: 'Handoff' },
        ce('p', { className: 'spx-sub' }, str(sc.case_intro) || 'No handoff on the sheet.')),

      arr(sc.source_discrepancies).length
        ? ce(Section, { title: 'Source issue - verify with instructor' },
            ce('p', { className: 'spx-dim' },
              'These are shown exactly as the source file words them. Nothing here has been ' +
              'silently repaired, and none of it is scored until an instructor resolves it.'),
            ce('ul', { className: 'spx-list' },
              arr(sc.source_discrepancies).map(function (d, i) {
                return ce('li', { key: 'sd' + i }, str(d));
              })))
        : null,

      ce(Section, { title: 'Mode' },
        ce('div', { className: 'spx-row' },
          ce('button', {
            className: 'spx-btn' + (mode === 'practice' ? ' go' : ''), type: 'button',
            'aria-pressed': mode === 'practice',
            onClick: function () { setMode('practice'); }
          }, 'Practice - hints, rationale, pause'),
          ce('button', {
            className: 'spx-btn' + (mode === 'exam' ? ' go' : ''), type: 'button',
            'aria-pressed': mode === 'exam',
            onClick: function () { setMode('exam'); }
          }, 'Exam - no hints, no score until debrief')),
        ce('p', { className: 'spx-dim', style: { marginTop: '8px' } },
          mode === 'exam'
            ? 'Exam mode: no hints, no running score, no diagnosis clue, no next-step prompt. ' +
              'The patient answers only what you ask.'
            : 'Practice mode: a three-rung hint ladder (cue, then category, then the action), ' +
              'rationale you can toggle, and pause or restart whenever you want.')),

      ce(Section, { title: 'Rehearsal style' },
        ce('div', { className: 'spx-row' },
          COACH_STYLES.map(function (s) {
            return ce('button', {
              className: 'spx-btn sm' + (style === s.id ? ' go' : ''), type: 'button',
              key: s.id, 'aria-pressed': style === s.id,
              onClick: function () { setStyle(s.id); }
            }, s.name);
          })),
        ce('p', { className: 'spx-dim', style: { marginTop: '8px' } }, coachStyle(style).blurb)),

      ce(Section, { title: 'Completion' },
        ce('button', {
          className: 'spx-btn' + (req ? ' go' : ''), type: 'button', 'aria-pressed': req,
          onClick: function () { setReq(!req); }
        }, req ? 'Reassessment + SBAR required to complete' : 'Completion requirements off'),
        ce('p', { className: 'spx-dim', style: { marginTop: '8px' } },
          'On by default: you have to state a reassessment and give SBAR / escalate before ' +
          'the scenario counts as finished. An instructor can turn that off.')),

      ce('div', { className: 'spx-row', style: { marginTop: '12px' } },
        ce('button', {
          className: 'spx-btn go big', type: 'button',
          onClick: function () {
            if (isFn(o.onStart)) {
              o.onStart({
                mode: mode, coachStyle: style,
                requireReassessBeforeEnd: req, requireSbarBeforeEnd: req
              });
            }
          }
        }, 'Start the ' + durationMinutes(sc) + '-minute run'),
        isFn(o.onBack) ? ce('button', { className: 'spx-btn', type: 'button', onClick: o.onBack },
          'Back') : null));
  }

  /* ==========================================================================
   * 23. CHART PANEL  (reveal-gated, every tab)
   * ======================================================================== */

  function ChartPanel(p) {
    var o = obj(p);
    var sc = obj(o.sc), run = obj(o.run);
    var facts = buildFacts(sc);
    var seen = obj(run.revealed);
    var tabH = useState('vitals');
    var tab = tabH[0], setTab = tabH[1];

    function rows(kind) {
      return arr(facts.facts).filter(function (f) { return f.kind === kind; });
    }
    function locked(what, how) {
      return ce('p', { className: 'spx-locked' },
        what + ' are not open yet. ' + how);
    }

    var body;
    if (tab === 'vitals') {
      var vr = rows('vital').filter(function (f) { return seen[f.key]; });
      body = vr.length
        ? ce('table', { className: 'spx-tbl' },
            ce('thead', null, ce('tr', null,
              ce('th', null, 'Time'), ce('th', null, 'BP'), ce('th', null, 'HR'),
              ce('th', null, 'RR'), ce('th', null, 'SpO2'), ce('th', null, 'Temp'))),
            ce('tbody', null, arr(sc.vital_trends).map(function (v, i) {
              if (!seen['vital:' + i]) { return null; }
              var x = obj(v);
              return ce('tr', { key: 'v' + i },
                ce('td', null, str(x.time)), ce('td', null, str(x.bp)),
                ce('td', null, str(x.hr)), ce('td', null, str(x.rr)),
                ce('td', null, str(x.spo2)), ce('td', null, str(x.temp)));
            })))
        : locked('Vital signs', 'Take a set of vitals, or review the trend, and they appear here.');
    } else if (tab === 'labs') {
      var lr = rows('lab').filter(function (f) { return seen[f.key]; });
      body = lr.length
        ? ce('table', { className: 'spx-tbl' },
            ce('thead', null, ce('tr', null,
              ce('th', null, 'Test'), ce('th', null, 'Result'), ce('th', null, 'Reads as'))),
            ce('tbody', null, arr(sc.labs).map(function (l, i) {
              if (!seen['lab:' + i]) { return null; }
              var x = obj(l);
              return ce('tr', { key: 'lb' + i },
                ce('td', null, str(x.test)), ce('td', null, str(x.result)),
                ce('td', null, str(x.interpretation)));
            })))
        : locked('Laboratory results', 'Open the lab panel to review them.');
    } else if (tab === 'orders') {
      var or2 = rows('order').filter(function (f) { return seen[f.key]; });
      body = or2.length
        ? ce('ul', { className: 'spx-list' }, or2.map(function (f) {
            return ce('li', { key: f.key }, f.text);
          }))
        : locked('Provider orders', 'Review the chart to open them.');
    } else if (tab === 'mar') {
      var mr = rows('mar').filter(function (f) { return seen[f.key]; });
      body = mr.length
        ? ce('ul', { className: 'spx-list' }, mr.map(function (f) {
            return ce('li', { key: f.key }, f.text);
          }))
        : locked('The MAR', 'Review the chart to open it.');
    } else {
      var dr = rows('diagnostic').filter(function (f) { return seen[f.key]; });
      body = dr.length
        ? ce('ul', { className: 'spx-list' }, dr.map(function (f) {
            return ce('li', { key: f.key }, f.text);
          }))
        : locked('Diagnostics', 'Open the labs or the chart to review them.');
    }

    return ce('div', { className: 'spx-card' },
      ce('div', { className: 'spx-tabs' },
        [['vitals', 'Vitals'], ['labs', 'Labs'], ['orders', 'Orders'], ['mar', 'MAR'],
         ['dx', 'Diagnostics']].map(function (t) {
          return ce('button', {
            className: 'spx-tab', type: 'button', key: t[0],
            'aria-pressed': tab === t[0],
            onClick: function () { setTab(t[0]); }
          }, t[1]);
        })),
      body,
      ce('p', { className: 'spx-dim', style: { marginTop: '8px' } },
        'Only what you have actually looked at appears here. ',
        ce(ProvBadge, { sc: sc })));
  }

  /* ==========================================================================
   * 24. EMERGENCY CUE VIEW  (uncovered findings + the source escalation
   *     threshold, and nothing else)
   * ======================================================================== */

  function CueView(p) {
    var o = obj(p);
    var sc = obj(o.sc), run = obj(o.run);
    var facts = buildFacts(sc);
    var seen = obj(run.revealed);
    var found = arr(facts.facts).filter(function (f) {
      return seen[f.key] && (f.kind === 'cue' || f.kind === 'finding');
    });
    var thresholds = arr(sc.orders).filter(function (x) {
      return /notify|call|report|provider|hold|maintain|greater|less|>|</i.test(str(x));
    });
    return ce('div', { className: 'spx-card' },
      ce('h3', null, 'Emergency cues'),
      ce('p', { className: 'spx-dim' },
        'Only what you have uncovered. Cues you have not assessed for are not listed - ' +
        'finding them is the exercise.'),
      found.length
        ? ce('ul', { className: 'spx-list' }, found.map(function (f) {
            return ce('li', { key: f.key }, f.text);
          }))
        : ce('p', { className: 'spx-locked' }, 'Nothing uncovered yet. Assess.'),
      ce('h3', { style: { marginTop: '12px' } }, 'Escalation threshold, per the source'),
      thresholds.length
        ? ce('ul', { className: 'spx-list' }, thresholds.map(function (x, i) {
            return ce('li', { key: 'th' + i }, str(x));
          }))
        : ce('p', { className: 'spx-locked' },
            'This sheet does not state a numeric threshold. Follow your facility policy and ' +
            'escalate on trend, not on a single number.'),
      ce('p', { className: 'spx-dim', style: { marginTop: '8px' } }, ce(ProvBadge, { sc: sc })));
  }

  /* ==========================================================================
   * 25. SBAR COMPOSER
   * ======================================================================== */

  function SbarPanel(p) {
    var o = obj(p);
    var sc = obj(o.sc), run = obj(o.run);
    var tpl = sbarTemplate(run, sc);
    var vH = useState({ s: tpl.s, b: tpl.b, a: tpl.a, r: '' });
    var v = vH[0], setV = vH[1];
    function field(key, label, hint) {
      return ce('div', { style: { marginBottom: '10px' } },
        ce('label', { className: 'spx-dim', htmlFor: 'spx-sbar-' + key },
          label + ' - ' + hint),
        ce('textarea', {
          className: 'spx-ta', id: 'spx-sbar-' + key, value: str(v[key]),
          onChange: function (e) {
            var n = shallow(v); n[key] = e.target.value; setV(n);
          }
        }));
    }
    return ce('div', { className: 'spx-card' },
      ce('h3', null, 'SBAR to the provider'),
      ce('p', { className: 'spx-dim' },
        'Pre-filled from what you have actually uncovered' +
        (tpl.uncovered ? ' - ' + tpl.uncovered + ' item(s) on this sheet are still unassessed, ' +
          'so they are not in here.' : '.')),
      field('s', 'S', 'who this is and what is happening right now'),
      field('b', 'B', 'the relevant history and what has already been done'),
      field('a', 'A', 'what you think is going on'),
      field('r', 'R', 'what you are asking the provider to do'),
      ce('div', { className: 'spx-row' },
        ce('button', {
          className: 'spx-btn go', type: 'button',
          onClick: function () {
            if (isFn(o.onSubmit)) {
              o.onSubmit({
                text: ['S: ' + v.s, 'B: ' + v.b, 'A: ' + v.a, 'R: ' + v.r].join('\n'),
                sections: { s: v.s, b: v.b, a: v.a, r: v.r }
              });
            }
          }
        }, 'Give the report'),
        isFn(o.onClose)
          ? ce('button', { className: 'spx-btn', type: 'button', onClick: o.onClose }, 'Back')
          : null));
  }

  /* ==========================================================================
   * 26. THE RUNNER
   * ======================================================================== */

  function Runner(p) {
    var o = obj(p);
    var sc = obj(o.sc);
    var setup = obj(o.setup);
    var hook = useRun(sc, setup);
    var run = hook.run;
    var dispatch = hook.dispatch;

    var isExam = run.mode === 'exam';
    var panelH = useState('actions');
    var panel = panelH[0], setPanel = panelH[1];
    var armedH = useState(null);
    var armed = armedH[0], setArmed = armedH[1];
    var noticeH = useState(null);
    var notice = noticeH[0], setNotice = noticeH[1];
    var sayH = useState('');
    var say = sayH[0], setSay = sayH[1];
    var busyH = useState(false);
    var busy = busyH[0], setBusy = busyH[1];
    var hintH = useState(null);
    var hint = hintH[0], setHint = hintH[1];
    var tierRef = useRef(0);
    var armTimer = useRef(0);
    var noticeTimer = useRef(0);

    useEffect(function () {
      dispatch({ type: EV_START });
      partnerSetActivity({ kind: 'simprep-sim', topicId: str(sc.topic_id), mode: run.mode });
      return function () {
        if (armTimer.current) { window.clearTimeout(armTimer.current); }
        if (noticeTimer.current) { window.clearTimeout(noticeTimer.current); }
      };
    }, []);

    function flash(tone, title, body) {
      setNotice({ tone: tone, title: title, body: body });
      if (noticeTimer.current) { window.clearTimeout(noticeTimer.current); }
      noticeTimer.current = window.setTimeout(function () { setNotice(null); }, 9000);
    }
    function disarm() {
      if (armTimer.current) { window.clearTimeout(armTimer.current); armTimer.current = 0; }
      setArmed(null);
    }

    /* ---- the hold-back gate (identical semantics to js/sim-engine.js) --- */
    function gateFor(intentId) {
      if (isExam) { return null; }             // exam never holds an action back
      var it = intentById(sc, intentId);
      if (!it) { return null; }
      var med = namedMedIn(it.label, buildFacts(sc));
      if (med && !med.ordered) { return 'order-check'; }
      var cat = lower(it.category);
      if (cat !== 'intervention' && cat !== 'topic_specific') { return null; }
      var nx = nextPriority(run, sc);
      if (nx && nx.band === 'safety-first') { return 'safety-first'; }
      if (nx && nx.band === 'critical action' && nx.intent !== intentId
        && lower(str(obj(intentById(sc, nx.intent)).category)) === 'assessment') {
        return 'assess-first';
      }
      return null;
    }
    function gateLine(gate) {
      if (gate === 'order-check') {
        return 'Before any medication: is there an order, and is there a MAR entry? ' +
          'Check the chart.';
      }
      if (gate === 'safety-first') {
        return 'There is a step that comes before you touch this patient at all.';
      }
      return 'There is an assessment still open that this intervention depends on.';
    }

    function act(intentId, said, medOverride) {
      if (run.endedAt) { return; }
      if (run.pausedAt) { toast('Paused. Resume to keep working.', 'info'); return; }
      var gate = gateFor(intentId);
      var isArmed = !!(armed && armed.id === intentId);
      if (gate && !isArmed) {
        /* HELD BACK. Nothing recorded, the control stays enabled, it shakes. */
        setArmed({ id: intentId, key: 'a' + nowMs() });
        if (armTimer.current) { window.clearTimeout(armTimer.current); }
        armTimer.current = window.setTimeout(function () { setArmed(null); }, ARM_MS);
        flash('warn', 'Held back - nothing was recorded',
          gateLine(gate) + ' This has NOT been recorded and you have not lost it. Do the ' +
          'higher-priority thing first, or activate the same control again within ' +
          Math.round(ARM_MS / 1000) + ' seconds to do it anyway.');
        announce('Action held back. Nothing recorded.', true);
        return;
      }
      disarm();
      dispatch({ type: EV_ACT, intent: intentId, said: str(said), med: medOverride || null });
      setHint(null);
      tierRef.current = 0;
    }

    /* ---- free text -> intent -------------------------------------------- */
    function submitSay() {
      var text = str(say).trim();
      if (!text) { return; }
      setSay('');
      setBusy(true);
      dispatch({ type: EV_SAY, text: text });
      resolveIntent(text, sc, run).then(function (m) {
        setBusy(false);
        if (m.vague) {
          flash('warn', 'Too vague to mark', m.clarify);
          return;
        }
        if (!m.intent) {
          flash('warn', 'Say that another way', m.clarify ||
            'I could not map that to an action in this scenario.');
          return;
        }
        var med = namedMedIn(text, buildFacts(sc));
        act(m.intent, text, med);
      }, function () {
        setBusy(false);
        flash('warn', 'Say that another way',
          'I could not map that to an action in this scenario.');
      });
    }

    function askPatient() {
      var text = str(say).trim();
      if (!text) { return; }
      setSay('');
      dispatch({ type: EV_ASK, text: text });
      var style = coachStyle(run.opts.coachStyle);
      if (!style.dialogue && run.opts.coachStyle === 'checklist') { return; }
      setBusy(true);
      aiSpeak('the patient', text, sc, run).then(function (res) {
        setBusy(false);
        if (res.ok) { dispatch({ type: EV_AI, who: 'patient', text: res.text }); }
        else {
          dispatch({ type: EV_NOTE, kind: 'info',
            text: 'The patient does not answer that.',
            detail: 'Either it is not in this chart, or you have not assessed it yet.' });
        }
      }, function () { setBusy(false); });
    }

    function giveSbar(payload) {
      dispatch({ type: EV_SBAR, text: str(obj(payload).text), sections: obj(payload).sections });
      setPanel('actions');
      var resp = providerResponse(sc, run);
      dispatch({ type: EV_NOTE, kind: resp.authored ? 'good' : 'info',
        text: 'Provider: ' + resp.text,
        detail: resp.authored ? ('Pre-authored branch. ' + (resp.newOrders.length
          ? 'New orders from the instructor branch: ' + resp.newOrders.join('; ') : ''))
          : resp.source });
    }

    function askHint() {
      if (isExam) { return; }
      tierRef.current = clamp(tierRef.current + 1, 1, 3);
      var h = hintFor(run, sc, tierRef.current);
      if (!h) { return; }
      setHint(h);
      dispatch({ type: EV_HINT, tier: h.tier, text: h.body });
    }

    function endRun() {
      var blockers = completionBlockers(run, sc, run.opts);
      if (blockers.length) {
        flash('warn', 'Not finished yet',
          blockers.map(function (b) { return b.text; }).join(' '));
        return;
      }
      dispatch({ type: EV_END, reason: 'learner' });
    }

    useEffect(function () {
      if (run.endedAt && isFn(o.onFinish)) { o.onFinish(run); }
    }, [run.endedAt]);

    /* ---- render ---------------------------------------------------------- */
    var remain = remainingSec(run, nowMs());
    var missing = whatAmIMissing(run, sc);
    var groups = {};
    allowedIntents(sc).forEach(function (it) {
      var cat = lower(it.category);
      (groups[cat] = groups[cat] || []).push(it);
    });

    return ce('div', { className: 'spx-root' },
      ce(SafetyLabel, null),

      ce('div', { className: 'spx-bar' },
        ce('span', { className: 'spx-clock' + (remain <= 120 ? ' low' : '') }, fmtClock(remain)),
        ce('span', { className: 'spx-state ' + run.state }, STATE_LABEL[run.state] || run.state),
        ce('span', { className: 'spx-badge' + (isExam ? ' bad' : ' acc') },
          isExam ? 'Exam' : 'Practice'),
        partnerRoom() ? ce('span', { className: 'spx-badge acc' },
          partnerIsHost() ? 'Room - running' : 'Room - observing') : null,
        ce('span', { className: 'spx-spacer' }),
        ce('button', {
          className: 'spx-btn sm', type: 'button',
          onClick: function () { hook.toggle(); }
        }, run.pausedAt ? 'Resume' : 'Pause'),
        !isExam ? ce('button', { className: 'spx-btn sm', type: 'button', onClick: askHint },
          'Hint') : null,
        ce('button', { className: 'spx-btn sm go', type: 'button', onClick: endRun }, 'Finish')),

      run.pausedAt
        ? ce('div', { className: 'spx-note acc', style: { marginTop: '10px' } },
            'Paused. The clock, the deterioration timers and every scheduled effect are frozen. ' +
            'Resume picks up exactly where it stopped.')
        : null,

      notice
        ? ce('div', { className: 'spx-note ' + (notice.tone === 'bad' ? 'bad' : ''),
            style: { marginTop: '10px' } },
            ce('strong', null, notice.title), ' ', notice.body)
        : null,

      hint && !isExam
        ? ce('div', { className: 'spx-note acc', style: { marginTop: '10px' } },
            ce('strong', null, hint.title + ': '), hint.body)
        : null,

      ce('div', { className: 'spx-cols' },
        ce('div', null,
          panel === 'chart' ? ce(ChartPanel, { sc: sc, run: run }) : null,
          panel === 'cues' ? ce(CueView, { sc: sc, run: run }) : null,
          panel === 'sbar'
            ? ce(SbarPanel, { sc: sc, run: run, onSubmit: giveSbar,
                onClose: function () { setPanel('actions'); } })
            : null,

          panel === 'actions'
            ? ce('div', { className: 'spx-card' },
                ce('h3', null, 'What do you do?'),
                ce('div', { className: 'spx-row', style: { marginBottom: '8px' } },
                  ce('input', {
                    className: 'spx-input', type: 'text', value: say,
                    placeholder: 'Say it in your own words - "I listen to the lungs"',
                    'aria-label': 'Describe your action in your own words',
                    onChange: function (e) { setSay(e.target.value); },
                    onKeyDown: function (e) { if (e.key === 'Enter') { submitSay(); } }
                  })),
                ce('div', { className: 'spx-row', style: { marginBottom: '10px' } },
                  ce('button', { className: 'spx-btn sm go', type: 'button',
                    onClick: submitSay, disabled: busy }, busy ? 'Working' : 'Do it'),
                  ce('button', { className: 'spx-btn sm', type: 'button',
                    onClick: askPatient, disabled: busy }, 'Ask the patient')),
                CATEGORY_GROUPS.map(function (g) {
                  var list = arr(groups[g.id]);
                  if (!list.length) { return null; }
                  return ce('div', { key: g.id, style: { marginBottom: '10px' } },
                    ce('p', { className: 'spx-dim' }, g.label),
                    ce('div', { className: 'spx-acts' }, list.map(function (it) {
                      var done = !!run.done[it.id];
                      var isArmed = !!(armed && armed.id === it.id);
                      var isCrit = criticalIds(sc).indexOf(it.id) !== -1;
                      return ce('button', {
                        className: 'spx-act' + (done ? ' done' : '') + (isCrit ? ' crit' : '') +
                          (isArmed ? ' armed' : ''),
                        type: 'button', key: it.id + (isArmed ? armed.key : ''),
                        onClick: function () {
                          if (it.id === 'sbar') { setPanel('sbar'); return; }
                          if (it.id === 'open_labs' || it.id === 'review_chart') {
                            act(it.id, it.label); setPanel('chart'); return;
                          }
                          act(it.id, it.label);
                        }
                      },
                        ce('span', { className: 'spx-al' }, it.label),
                        ce('span', { className: 'spx-ac' },
                          (isCrit ? 'CRITICAL - ' : '') + (done ? 'done' : g.label)));
                    })));
                }))
            : null,

          ce('div', { className: 'spx-row', style: { marginTop: '10px' } },
            [['actions', 'Actions'], ['chart', 'Chart'], ['cues', 'Emergency cues'],
             ['sbar', 'SBAR']].map(function (t) {
              return ce('button', {
                className: 'spx-btn sm', type: 'button', key: t[0],
                'aria-pressed': panel === t[0],
                onClick: function () { setPanel(t[0]); }
              }, t[1]);
            }))),

        ce('div', { className: 'spx-side' },
          !isExam
            ? ce('div', { className: 'spx-card' },
                ce('h3', null, 'What am I missing?'),
                missing
                  ? ce('p', { className: 'spx-sub' }, missing.label)
                  : ce('p', { className: 'spx-sub' },
                      'Nothing critical is open. Reassess and close the loop.'),
                ce('p', { className: 'spx-dim' },
                  'One thing at a time - the highest priority still open, never the whole list.'))
            : null,
          ce('div', { className: 'spx-card' },
            ce('h3', null, 'Event log'),
            ce(LogList, { lines: run.log })),
          arr(run.transcript).length
            ? ce('div', { className: 'spx-card' },
                ce('h3', null, 'Conversation'),
                arr(run.transcript).slice(-8).map(function (t, i) {
                  return ce('p', { className: 'spx-sub', key: 'tx' + i },
                    ce('strong', null, str(t.who).toUpperCase() + ': '), str(t.text));
                }))
            : null,
          arr(sc.source_discrepancies).length
            ? ce('div', { className: 'spx-card' },
                ce('h3', null, 'Source issue - verify with instructor'),
                ce('ul', { className: 'spx-list' },
                  arr(sc.source_discrepancies).map(function (d, i) {
                    return ce('li', { key: 'sd' + i }, str(d));
                  })),
                ce('p', { className: 'spx-dim' },
                  'Not scored until an instructor resolves it.'))
            : null)));
  }

  var CATEGORY_GROUPS = [
    { id: 'safety', label: 'Safety' },
    { id: 'assessment', label: 'Assessment' },
    { id: 'clinical_reasoning', label: 'Clinical reasoning' },
    { id: 'intervention', label: 'Interventions' },
    { id: 'topic_specific', label: 'Condition-specific' },
    { id: 'reassessment', label: 'Reassessment' },
    { id: 'communication', label: 'Communication' },
    { id: 'documentation', label: 'Documentation and education' }
  ];

  /* ==========================================================================
   * 27. DEBRIEF SCREEN
   * ======================================================================== */

  function Debrief(p) {
    var o = obj(p);
    var sc = obj(o.sc), run = obj(o.run);
    var d = useMemo(function () { return buildDebrief(run, sc, run.opts); }, [run, sc]);
    var proseH = useState('');
    var prose = proseH[0], setProse = proseH[1];

    useEffect(function () {
      var live = true;
      aiDebrief(run, sc).then(function (res) {
        if (live && res.ok) { setProse(res.text); }
      }, function () {});
      return function () { live = false; };
    }, []);

    function itemRow(i) {
      return ce('li', { key: i.id },
        (i.credited ? '✓ ' : '✗ ') + i.label,
        ce('span', { className: 'spx-prov ' + i.provenance },
          PROV_LABEL[i.provenance] || i.provenance),
        i.sourceFact ? ce('span', { className: 'spx-ld' }, 'Source: ' + i.sourceFact) : null,
        i.detail ? ce('span', { className: 'spx-ld' }, i.detail) : null);
    }

    return ce('div', { className: 'spx-root' },
      ce(SafetyLabel, null),
      ce('div', { className: 'spx-head' },
        ce('div', null,
          ce('h2', null, 'Debrief - ' + str(sc.title)),
          ce('p', { className: 'spx-sub' },
            'Final state: ' + (STATE_LABEL[d.state] || d.state) + '. ' +
            'Time on the clock: ' + fmtClock(d.elapsedSec) + '. Mode: ' + d.mode + '.')),
        ce('span', { className: 'spx-spacer' }),
        ce(ProvBadge, { sc: sc })),

      d.score.autoFailed
        ? ce('div', { className: 'spx-note bad' },
            ce('strong', null, 'Instructor-configured attempt failure. '), d.score.autoFailReason)
        : ce('div', { className: 'spx-note ok' },
            'No automatic course failure. Penalties are applied inside the rubric; ' +
            'this app never declares a failed course unless an instructor configures it.'),

      ce(Section, { title: 'Score' },
        ce('div', { className: 'spx-score' },
          ce('div', { className: 'spx-scell' },
            ce('span', { className: 'spx-sn' }, 'Total'),
            ce('span', { className: 'spx-sv' }, d.score.total + ' / ' + d.score.possible)),
          d.score.categories.map(function (c) {
            return ce('div', { className: 'spx-scell', key: c.id },
              ce('span', { className: 'spx-sn' }, c.label),
              ce('span', { className: 'spx-sv' },
                c.scored ? (c.earned + ' / ' + c.weight) : 'not scored'),
              c.penalty ? ce('span', { className: 'spx-sn' }, '-' + c.penalty + ' penalty') : null);
          })),
        d.score.possible !== d.score.configuredTotal
          ? ce('p', { className: 'spx-dim', style: { marginTop: '8px' } },
              'Configured rubric totals ' + d.score.configuredTotal + '. ' +
              (d.score.configuredTotal - d.score.possible) + ' point(s) were removed from the ' +
              'denominator because the source facts behind them are unresolved.')
          : null),

      arr(d.score.notScored).length
        ? ce(Section, { title: 'Not scored - source issue, verify with instructor',
            sub: 'An unresolved contradiction or likely typo in the source file. It is not ' +
              'counted for or against you until an instructor resolves it.' },
            ce('ul', { className: 'spx-list' }, arr(d.score.notScored).map(function (i) {
              return ce('li', { key: 'ns' + i.id }, i.label,
                ce('span', { className: 'spx-ld' }, 'Source issue: ' +
                  str(obj(i.blockedBy).text)));
            })))
        : null,

      prose ? ce(Section, { title: 'From your instructor' },
        ce('p', { className: 'spx-sub' }, prose)) : null,

      ce(Section, { title: 'Timeline' },
        arr(d.timeline).length
          ? ce('ul', { className: 'spx-list' }, arr(d.timeline).map(function (t, i) {
              return ce('li', { key: 'tl' + i },
                t.clock + '  ' + t.label + (t.critical ? '  [critical]' : ''),
                t.source ? ce('span', { className: 'spx-ld' }, 'Source: ' + t.source) : null);
            }))
          : ce('p', { className: 'spx-locked' }, 'No actions were recorded.')),

      ce(Section, { title: 'Critical actions' },
        ce('p', { className: 'spx-sub' },
          arr(d.criticalsCompleted).length + ' completed, ' +
          arr(d.criticalsMissed).length + ' missed.'),
        arr(d.criticalsMissed).length
          ? ce('ul', { className: 'spx-list' }, arr(d.criticalsMissed).map(function (c) {
              return ce('li', { key: 'cm' + c.intent }, 'Missed: ' + c.label,
                ce('span', { className: 'spx-prov ' + c.provenance },
                  PROV_LABEL[c.provenance] || c.provenance));
            }))
          : null),

      arr(d.unsafeActions).length || arr(d.outOfOrder).length
        ? ce(Section, { title: 'Unsafe or out-of-order' },
            ce('ul', { className: 'spx-list' },
              arr(d.unsafeActions).map(function (u, i) {
                return ce('li', { key: 'ua' + i }, str(u.text));
              }).concat(arr(d.outOfOrder).map(function (u, i) {
                return ce('li', { key: 'oo' + i }, str(u.text));
              }))))
        : null,

      ce(Section, { title: 'Data you never looked at',
        sub: 'Everything on this sheet you did not uncover.' },
        arr(d.missedData).length
          ? ce('ul', { className: 'spx-list' }, arr(d.missedData).map(function (m) {
              return ce('li', { key: m.key }, m.text || m.label);
            }))
          : ce('p', { className: 'spx-sub' }, 'You uncovered everything on the sheet.')),

      ce(Section, { title: 'Reassessment and SBAR' },
        ce('p', { className: 'spx-sub' },
          'Reassessed after an intervention: ' + (d.reassessed ? 'yes' : 'no') +
          (d.prematureReassessments ? ' (' + d.prematureReassessments +
            ' premature reassessment(s) - nothing had changed yet)' : '') + '. ' +
          'SBAR given: ' + (d.sbar.given ? 'yes' : 'no') +
          (d.sbar.given && d.sbar.coverage.total
            ? ' (' + d.sbar.coverage.hit + ' of ' + d.sbar.coverage.total + ' expected elements)'
            : '') + '.')),

      ce(Section, { title: 'Your three things' },
        ce('ol', { className: 'spx-list' }, arr(d.remediation).map(function (r, i) {
          return ce('li', { key: 'rm' + i }, ce('strong', null, r.title), ' ', r.body);
        })),
        arr(d.studyLinks).length
          ? ce('p', { className: 'spx-dim', style: { marginTop: '8px' } },
              'Study sections: ' + arr(d.studyLinks).map(function (l) {
                return str(l.label || l.section);
              }).join(', '))
          : null),

      ce(Section, { title: 'Scored items and their sources' },
        d.score.categories.map(function (c) {
          return ce('div', { key: 'cat' + c.id, style: { marginBottom: '10px' } },
            ce('p', { className: 'spx-dim' }, c.label),
            ce('ul', { className: 'spx-list' }, arr(c.items).map(itemRow)));
        })),

      arr(d.aiViolations).length
        ? ce(Section, { title: 'Blocked by the source guard',
            sub: 'Statements the language layer produced that were not traceable to this ' +
              'scenario. They were dropped before you ever saw them; they are listed here so ' +
              'the guard is auditable, not so you have to read them.' },
            ce('ul', { className: 'spx-list' }, arr(d.aiViolations).slice(0, 12).map(function (v, i) {
              return ce('li', { key: 'av' + i }, str(v.kind) + ': ' + str(v.why));
            })))
        : null,

      ce('div', { className: 'spx-row', style: { marginTop: '12px' } },
        isFn(o.onAgain) ? ce('button', { className: 'spx-btn go', type: 'button',
          onClick: o.onAgain }, 'Run it again') : null,
        isFn(o.onExit) ? ce('button', { className: 'spx-btn', type: 'button',
          onClick: o.onExit }, 'Back to the topic list') : null));
  }

  /* ==========================================================================
   * 28. window.SimPrepSimMode
   * ======================================================================== */

  function SimPrepSimMode(props) {
    var p = obj(props);
    injectStyles();

    var screenH = useState(str(p.topicId) ? 'brief' : 'pick');
    var screen = screenH[0], setScreen = screenH[1];
    var idH = useState(str(p.topicId));
    var topicId = idH[0], setTopicId = idH[1];
    var setupH = useState(null);
    var setup = setupH[0], setSetup = setupH[1];
    var resultH = useState(null);
    var result = resultH[0], setResult = resultH[1];
    var nonceH = useState(0);
    var nonce = nonceH[0], setNonce = nonceH[1];

    useEffect(function () {
      if (str(p.topicId) && str(p.topicId) !== topicId) {
        setTopicId(str(p.topicId));
        setScreen('brief');
      }
    }, [p.topicId]);

    if (!contentOk()) { return ce(ContentMissing, { onNav: p.onNav }); }

    var sc = scenarioById(topicId);

    if (screen === 'debrief' && result && sc) {
      return ce(Debrief, {
        sc: sc, run: result,
        onExit: function () { setResult(null); setScreen('pick'); },
        onAgain: function () { setResult(null); setNonce(nonce + 1); setScreen('run'); }
      });
    }
    if (screen === 'run' && sc && setup) {
      return ce(Runner, {
        key: 'run-' + topicId + '-' + nonce,
        sc: sc, setup: setup,
        onFinish: function (run) { setResult(run); setScreen('debrief'); }
      });
    }
    if (screen === 'brief' && sc) {
      return ce('div', { className: 'spx-root' },
        ce(SafetyLabel, null),
        ce(PreBrief, {
          sc: sc,
          onBack: function () { setScreen('pick'); },
          onStart: function (cfg) {
            var s = shallow(obj(cfg));
            s.durationMin = durationMinutes(sc);
            s.overrides = obj(obj(p.progress).simprepOverrides);
            setSetup(s);
            setScreen('run');
          }
        }));
    }

    return ce('div', { className: 'spx-root' },
      ce(SafetyLabel, null),
      ce(Picker, {
        heading: 'Clinical Simulation Prep - Simulation Mode',
        onPick: function (id) { setTopicId(id); setScreen('brief'); }
      }));
  }

  /* ==========================================================================
   * 29. window.SimPrepCoachMode
   * --------------------------------------------------------------------------
   * Glanceable. Big clock, ONE checklist card, five buttons, optional voice
   * that listens only when explicitly switched on, and a practice-only label
   * that is neither dismissible nor scrollable away.
   * ======================================================================== */

  function CoachRunner(p) {
    var o = obj(p);
    var sc = obj(o.sc);
    var setup = obj(o.setup);
    var hook = useRun(sc, setup);
    var run = hook.run;
    var dispatch = hook.dispatch;
    var style = coachStyle(run.opts.coachStyle);

    var viewH = useState('checklist');
    var view = viewH[0], setView = viewH[1];
    var micH = useState(false);
    var mic = micH[0], setMic = micH[1];
    var heardH = useState('');
    var heard = heardH[0], setHeard = heardH[1];
    var msgH = useState(null);
    var msg = msgH[0], setMsg = msgH[1];
    var missH = useState(null);
    var miss = missH[0], setMiss = missH[1];
    var typedH = useState('');
    var typed = typedH[0], setTyped = typedH[1];
    var stopRef = useRef(null);
    var msgTimer = useRef(0);

    useEffect(function () {
      dispatch({ type: EV_START });
      partnerSetActivity({ kind: 'simprep-coach', topicId: str(sc.topic_id), mode: run.mode });
      return function () {
        if (stopRef.current) { try { stopRef.current(); } catch (e) {} stopRef.current = null; }
        if (msgTimer.current) { window.clearTimeout(msgTimer.current); }
      };
    }, []);

    function note(tone, text) {
      setMsg({ tone: tone, text: text });
      if (msgTimer.current) { window.clearTimeout(msgTimer.current); }
      msgTimer.current = window.setTimeout(function () { setMsg(null); }, 8000);
      announce(text, tone === 'bad');
    }

    var card = nextPriority(run, sc);

    /* ---- utterance -> action -------------------------------------------- */
    function handleUtterance(text) {
      var t = str(text).trim();
      if (!t) { return; }
      dispatch({ type: EV_SAY, text: t });
      var m = matchIntent(t, sc, {});
      /* A vague statement NEVER completes an intervention. */
      if (m.vague) { note('warn', m.clarify); return; }
      if (!m.intent) {
        note('warn', m.clarify || 'Say the action in a few plain words.');
        return;
      }
      var med = namedMedIn(t, buildFacts(sc));
      if (med && !med.ordered) {
        note('bad', 'There is no order and no MAR entry for ' + med.name +
          ' in this chart. Nothing was marked and no order was created.');
      }
      dispatch({ type: EV_ACT, intent: m.intent, said: t, med: med });
      note('ok', 'Marked: ' + (intentById(sc, m.intent) || { label: m.intent }).label);
    }

    function toggleMic() {
      var voice = obj(MMx().voice);
      if (mic) {
        if (stopRef.current) { try { stopRef.current(); } catch (e) {} stopRef.current = null; }
        setMic(false);
        note('ok', 'Microphone off.');
        return;
      }
      if (!isFn(voice.listen) || (isFn(voice.isSupported) && !voice.isSupported())) {
        note('warn', 'Voice input is not available in this browser. Type the action instead - ' +
          'everything works without the microphone.');
        return;
      }
      setMic(true);
      note('ok', 'Listening. Say what you are doing. Tap the button again to stop.');
      try {
        stopRef.current = voice.listen({
          continuous: true,
          interimResults: true,
          resetOnFinal: true,
          onResult: function (full, isFinal) {
            setHeard(str(full));
            if (isFinal) { handleUtterance(full); setHeard(''); }
          },
          onError: function () {
            setMic(false); stopRef.current = null;
            note('warn', 'The microphone stopped. Type the action instead.');
          },
          onEnd: function () { stopRef.current = null; setMic(false); }
        });
      } catch (e) {
        setMic(false);
        note('warn', 'The microphone could not start. Type the action instead.');
      }
    }

    function iDidThis() {
      if (!card) { note('ok', 'Nothing is open. Reassess and close the loop.'); return; }
      dispatch({ type: EV_ACT, intent: card.intent, said: card.label });
      note('ok', 'Marked: ' + card.label);
      setMiss(null);
    }

    function showMissing() {
      var one = whatAmIMissing(run, sc);
      setMiss(one);
      if (!one) { note('ok', 'Nothing critical is open.'); }
      else if (!style.hints) {
        note('warn', 'Silent examiner: hints are off for this rehearsal.');
        setMiss(null);
      }
    }

    function finish() {
      var blockers = completionBlockers(run, sc, run.opts);
      if (blockers.length) {
        note('warn', blockers.map(function (b) { return b.text; }).join(' '));
        return;
      }
      dispatch({ type: EV_END, reason: 'learner' });
    }

    useEffect(function () {
      if (run.endedAt && isFn(o.onFinish)) { o.onFinish(run); }
    }, [run.endedAt]);

    var remain = remainingSec(run, nowMs());
    var crits = criticalIds(sc);

    return ce('div', { className: 'spx-root spx-coach' },
      ce(SafetyLabel, null),

      ce('div', { className: 'spx-coachtop' },
        ce('span', { className: 'spx-bigclock' + (remain <= 120 ? ' low' : '') }, fmtClock(remain)),
        ce('div', null,
          ce('div', { style: { fontWeight: 800, fontSize: '14px' } }, str(sc.title)),
          ce('div', { className: 'spx-dim' },
            doneCriticals(run, sc).length + ' / ' + crits.length + ' critical actions')),
        ce('span', { className: 'spx-spacer' }),
        ce('span', { className: 'spx-badge' + (run.mode === 'exam' ? ' bad' : ' acc') },
          run.mode === 'exam' ? 'Exam' : 'Practice'),
        ce('span', { className: 'spx-badge' }, style.name),
        ce('button', { className: 'spx-btn sm', type: 'button',
          onClick: function () { hook.toggle(); } }, run.pausedAt ? 'Resume' : 'Pause')),

      run.pausedAt
        ? ce('div', { className: 'spx-note acc' },
            'Paused. The clock is frozen and resume does not fast-forward.')
        : null,

      msg ? ce('div', { className: 'spx-note ' + (msg.tone === 'bad' ? 'bad' :
        (msg.tone === 'ok' ? 'ok' : '')) }, msg.text) : null,

      view === 'checklist'
        ? ce('div', { className: 'spx-bigcard' },
            ce('div', { className: 'spx-meta' }, card ? card.band : 'complete'),
            ce('div', { className: 'spx-step' },
              card ? card.label : 'Everything on the sheet is done. Finish when you are ready.'),
            card && card.source && run.mode !== 'exam'
              ? ce('div', { className: 'spx-dim' }, 'Source: ' + card.source)
              : null)
        : null,
      view === 'chart' ? ce(ChartPanel, { sc: sc, run: run }) : null,
      view === 'cues' ? ce(CueView, { sc: sc, run: run }) : null,

      miss
        ? ce('div', { className: 'spx-note' },
            ce('strong', null, 'The one thing: '), miss.label)
        : null,

      ce('div', { className: 'spx-coachbar' },
        ce('button', { className: 'spx-btn go', type: 'button', onClick: iDidThis }, 'I did this'),
        ce('button', { className: 'spx-btn', type: 'button',
          onClick: function () { setView(view === 'chart' ? 'checklist' : 'chart'); } }, 'Chart'),
        ce('button', { className: 'spx-btn', type: 'button', onClick: showMissing },
          'What am I missing?'),
        ce('button', { className: 'spx-btn', type: 'button',
          onClick: function () { setView('sbar'); } }, 'SBAR'),
        ce('button', { className: 'spx-btn', type: 'button',
          onClick: function () { handleUtterance('I reassess the patient after the intervention'); } },
          'Reassess')),

      view === 'sbar'
        ? ce(SbarPanel, {
            sc: sc, run: run,
            onClose: function () { setView('checklist'); },
            onSubmit: function (payload) {
              dispatch({ type: EV_SBAR, text: str(obj(payload).text),
                sections: obj(payload).sections });
              var resp = providerResponse(sc, run);
              dispatch({ type: EV_NOTE, kind: 'info', text: 'Provider: ' + resp.text,
                detail: resp.source });
              setView('checklist');
              note('ok', 'Report given.');
            }
          })
        : null,

      ce('div', { className: 'spx-row' },
        ce('button', {
          className: 'spx-mic' + (mic ? ' on' : ''), type: 'button',
          'aria-pressed': mic,
          onClick: toggleMic
        }, mic ? 'Listening - tap to stop' : 'Voice off - tap to listen'),
        ce('button', {
          className: 'spx-btn sm', type: 'button',
          onClick: function () { setView(view === 'cues' ? 'checklist' : 'cues'); }
        }, 'Emergency cues'),
        ce('button', { className: 'spx-btn sm go', type: 'button', onClick: finish }, 'Finish')),

      ce('p', { className: 'spx-heard' },
        mic ? (heard ? 'Heard: ' + heard : 'Listening...')
            : 'The microphone is off. It only listens when you switch it on.'),

      ce('div', { className: 'spx-row' },
        ce('input', {
          className: 'spx-input', type: 'text', value: typed,
          placeholder: 'Or type the action - "I check the pupils"',
          'aria-label': 'Type the action you performed',
          onChange: function (e) { setTyped(e.target.value); },
          onKeyDown: function (e) {
            if (e.key === 'Enter') { handleUtterance(typed); setTyped(''); }
          }
        }),
        ce('button', {
          className: 'spx-btn sm', type: 'button',
          onClick: function () { handleUtterance(typed); setTyped(''); }
        }, 'Mark it')),

      ce('div', { className: 'spx-card' },
        ce('h3', null, 'Marked so far'),
        arr(run.actions).length
          ? ce('ul', { className: 'spx-list' }, arr(run.actions).slice(-8).map(function (a, i) {
              return ce('li', { key: 'ca' + i }, fmtClock(a.atSec) + '  ' + a.label);
            }))
          : ce('p', { className: 'spx-locked' }, 'Nothing marked yet.')),

      ce(SafetyLabel, { foot: true }));
  }

  function SimPrepCoachMode(props) {
    var p = obj(props);
    injectStyles();

    var screenH = useState(str(p.topicId) ? 'brief' : 'pick');
    var screen = screenH[0], setScreen = screenH[1];
    var idH = useState(str(p.topicId));
    var topicId = idH[0], setTopicId = idH[1];
    var setupH = useState(null);
    var setup = setupH[0], setSetup = setupH[1];
    var resultH = useState(null);
    var result = resultH[0], setResult = resultH[1];
    var nonceH = useState(0);
    var nonce = nonceH[0], setNonce = nonceH[1];

    if (!contentOk()) { return ce(ContentMissing, { onNav: p.onNav }); }
    var sc = scenarioById(topicId);

    if (screen === 'debrief' && result && sc) {
      return ce(Debrief, {
        sc: sc, run: result,
        onExit: function () { setResult(null); setScreen('pick'); },
        onAgain: function () { setResult(null); setNonce(nonce + 1); setScreen('run'); }
      });
    }
    if (screen === 'run' && sc && setup) {
      return ce(CoachRunner, {
        key: 'coach-' + topicId + '-' + nonce,
        sc: sc, setup: setup,
        onFinish: function (run) { setResult(run); setScreen('debrief'); }
      });
    }
    if (screen === 'brief' && sc) {
      return ce('div', { className: 'spx-root' },
        ce(SafetyLabel, null),
        ce(PreBrief, {
          sc: sc,
          onBack: function () { setScreen('pick'); },
          onStart: function (cfg) {
            var s = shallow(obj(cfg));
            s.durationMin = durationMinutes(sc);
            s.overrides = obj(obj(p.progress).simprepOverrides);
            setSetup(s);
            setScreen('run');
          }
        }),
        ce(SafetyLabel, { foot: true }));
    }

    return ce('div', { className: 'spx-root' },
      ce(SafetyLabel, null),
      ce(Picker, {
        heading: 'Room / Checkoff Coach - mannequin rehearsal',
        onPick: function (id) { setTopicId(id); setScreen('brief'); }
      }),
      ce(SafetyLabel, { foot: true }));
  }

  /* ==========================================================================
   * 30. EXPORTS
   * The logic hangs off the components so it can be unit tested without React,
   * and so an instructor dashboard can replay a run from its event list.
   * ======================================================================== */

  /* content */
  SimPrepSimMode.allScenarios = allScenarios;
  SimPrepSimMode.contentOk = contentOk;
  SimPrepSimMode.scenarioById = scenarioById;
  SimPrepSimMode.provenanceOf = provenanceOf;
  SimPrepSimMode.provenanceLabel = provenanceLabel;
  SimPrepSimMode.durationMinutes = durationMinutes;
  SimPrepSimMode.studyLink = studyLink;

  /* facts + reveal */
  SimPrepSimMode.buildFacts = buildFacts;
  SimPrepSimMode.domainOf = domainOf;
  SimPrepSimMode.DOMAINS = {
    airway: D_AIRWAY, lungs: D_LUNGS, cardio: D_CARDIO, perfusion: D_PERFUSE,
    neuro: D_NEURO, pain: D_PAIN, abdomen: D_ABD, urinary: D_GU, general: D_GENERAL,
    labs: D_LAB, chart: D_CHART, vitals: D_VITALS
  };
  SimPrepSimMode.DOMAIN_LABEL = DOMAIN_LABEL;
  SimPrepSimMode.revealsFor = revealsFor;
  SimPrepSimMode.domainsForIntent = domainsForIntent;
  SimPrepSimMode.initialReveals = initialReveals;

  /* the guard */
  SimPrepSimMode.checkSentence = checkSentence;
  SimPrepSimMode.sanitizeAIText = sanitizeAIText;
  SimPrepSimMode.validateAIReply = validateAIReply;
  SimPrepSimMode.namedMedIn = namedMedIn;
  SimPrepSimMode.medLexicon = medLexicon;
  SimPrepSimMode.VIOLATIONS = {
    order: V_ORDER, medication: V_MED, dose: V_DOSE, lab: V_LAB, vital: V_VITAL,
    device: V_DEVICE, allergy: V_ALLERGY, code_status: V_CODE, finding: V_FINDING,
    hidden: V_HIDDEN, number: V_NUMBER, rejected_key: V_KEY, intent: V_INTENT
  };
  SimPrepSimMode.REPLY_ALLOWED_KEYS = REPLY_ALLOWED_KEYS;

  /* intent matching */
  SimPrepSimMode.matchIntent = matchIntent;
  SimPrepSimMode.resolveIntent = resolveIntent;
  SimPrepSimMode.aiWidenIntent = aiWidenIntent;
  SimPrepSimMode.allowedIntents = allowedIntents;
  SimPrepSimMode.intentById = intentById;
  SimPrepSimMode.isVague = isVague;
  SimPrepSimMode.SYNONYMS = SYNONYMS;
  SimPrepSimMode.BUILTIN_INTENTS = BUILTIN_INTENTS;
  SimPrepSimMode.CLARIFY_BELOW = CLARIFY_BELOW;
  SimPrepSimMode.AI_CONF_CAP = AI_CONF_CAP;

  /* run model */
  SimPrepSimMode.initialRun = initialRun;
  SimPrepSimMode.applyEvent = applyEvent;
  SimPrepSimMode.foldEvents = foldEvents;
  SimPrepSimMode.elapsedMs = elapsedMs;
  SimPrepSimMode.elapsedSec = elapsedSec;
  SimPrepSimMode.remainingSec = remainingSec;
  SimPrepSimMode.totalSec = totalSec;
  SimPrepSimMode.expired = expired;
  SimPrepSimMode.isPausedRun = isPausedRun;
  SimPrepSimMode.criticalIds = criticalIds;
  SimPrepSimMode.doneCriticals = doneCriticals;
  SimPrepSimMode.missedCriticals = missedCriticals;
  SimPrepSimMode.normOpts = normOpts;
  SimPrepSimMode.STATES = {
    handoff: S_HANDOFF, active: S_ACTIVE, deteriorating: S_DETERIORATING,
    critical_event: S_CRITICAL, stabilized_or_transferred: S_STABILIZED
  };
  SimPrepSimMode.STATE_ORDER = STATE_ORDER;
  SimPrepSimMode.STATE_LABEL = STATE_LABEL;
  SimPrepSimMode.EVENTS = {
    START: EV_START, ACT: EV_ACT, HINT: EV_HINT, SBAR: EV_SBAR, SAY: EV_SAY,
    AI: EV_AI, PAUSE: EV_PAUSE, RESUME: EV_RESUME, TICK: EV_TICK, END: EV_END,
    NOTE: EV_NOTE, ASK: EV_ASK
  };
  SimPrepSimMode.ARM_MS = ARM_MS;
  SimPrepSimMode.EFFECT_DELAY_SEC = EFFECT_DELAY_SEC;
  SimPrepSimMode.HANDOFF_MAX_SEC = HANDOFF_MAX_SEC;

  /* coaching */
  SimPrepSimMode.nextPriority = nextPriority;
  SimPrepSimMode.whatAmIMissing = whatAmIMissing;
  SimPrepSimMode.hintFor = hintFor;
  SimPrepSimMode.providerResponse = providerResponse;
  SimPrepSimMode.completionBlockers = completionBlockers;
  SimPrepSimMode.canComplete = canComplete;
  SimPrepSimMode.COACH_STYLES = COACH_STYLES;
  SimPrepSimMode.coachStyle = coachStyle;

  /* scoring + debrief */
  SimPrepSimMode.DEFAULT_WEIGHTS = DEFAULT_WEIGHTS;
  SimPrepSimMode.CATEGORY_ORDER = CATEGORY_ORDER;
  SimPrepSimMode.CATEGORY_LABEL = CATEGORY_LABEL;
  SimPrepSimMode.resolveWeights = resolveWeights;
  SimPrepSimMode.scoreItems = scoreItems;
  SimPrepSimMode.scoreRun = scoreRun;
  SimPrepSimMode.buildDebrief = buildDebrief;
  SimPrepSimMode.debriefText = debriefText;
  SimPrepSimMode.sbarCoverage = sbarCoverage;
  SimPrepSimMode.sbarTemplate = sbarTemplate;
  SimPrepSimMode.discrepancies = discrepancies;
  SimPrepSimMode.unresolvedDiscrepancies = unresolvedDiscrepancies;
  SimPrepSimMode.itemBlocked = itemBlocked;
  SimPrepSimMode.UNSAFE_PENALTY = UNSAFE_PENALTY;

  /* AI */
  SimPrepSimMode.aiReady = aiReady;
  SimPrepSimMode.parseJsonReply = parseJsonReply;
  SimPrepSimMode.completeTruncatedJSON = completeTruncatedJSON;
  SimPrepSimMode.groundTruth = groundTruth;
  SimPrepSimMode.aiSpeak = aiSpeak;
  SimPrepSimMode.aiDebrief = aiDebrief;
  SimPrepSimMode.AI_FEATURES = { intent: F_INTENT, voice: F_VOICE, sbar: F_SBAR, debrief: F_DEBRIEF };
  SimPrepSimMode.TOKEN_CAPS = {
    intent: INTENT_MAX_TOKENS, voice: VOICE_MAX_TOKENS,
    debrief: DEBRIEF_MAX_TOKENS, repair: REPAIR_MAX_TOKENS
  };

  /* partner (optional) */
  SimPrepSimMode.partnerApi = partnerApi;
  SimPrepSimMode.partnerRoom = partnerRoom;
  SimPrepSimMode.partnerIsHost = partnerIsHost;

  /* pause - exactly the names every other engine exposes */
  SimPrepSimMode.pause = simprepPause.pauseRun;
  SimPrepSimMode.resume = simprepPause.resumeRun;
  SimPrepSimMode.togglePause = simprepPause.togglePauseRun;
  SimPrepSimMode.isPaused = simprepPause.isRunPaused;
  SimPrepSimMode.canPause = simprepPause.canPauseRun;
  SimPrepSimMode.onPauseChange = simprepPause.onPauseChange;
  SimPrepSimMode.pauseStats = simprepPause.pauseStats;
  SimPrepSimMode.pauseControl = simprepPause.pauseControl;
  SimPrepSimMode.pauseRun = simprepPause.pauseRun;
  SimPrepSimMode.resumeRun = simprepPause.resumeRun;
  SimPrepSimMode.togglePauseRun = simprepPause.togglePauseRun;
  SimPrepSimMode.isRunPaused = simprepPause.isRunPaused;
  SimPrepSimMode.canPauseRun = simprepPause.canPauseRun;

  /* sub-components */
  SimPrepSimMode.Picker = Picker;
  SimPrepSimMode.PreBrief = PreBrief;
  SimPrepSimMode.Runner = Runner;
  SimPrepSimMode.ChartPanel = ChartPanel;
  SimPrepSimMode.CueView = CueView;
  SimPrepSimMode.SbarPanel = SbarPanel;
  SimPrepSimMode.Debrief = Debrief;
  SimPrepSimMode.SafetyLabel = SafetyLabel;
  SimPrepSimMode.ContentMissing = ContentMissing;
  SimPrepSimMode.injectStyles = injectStyles;

  /* The coach surface shares the whole engine - one source of truth. Object
     keys OF A FUNCTION, so this cannot go through keysOf() (which normalises a
     function to {} and would silently copy nothing). */
  Object.keys(SimPrepSimMode).forEach(function (k) {
    SimPrepCoachMode[k] = SimPrepSimMode[k];
  });
  SimPrepCoachMode.CoachRunner = CoachRunner;

  window.SimPrepSimMode = SimPrepSimMode;
  window.SimPrepCoachMode = SimPrepCoachMode;
})();
