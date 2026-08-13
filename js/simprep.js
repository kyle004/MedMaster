/* =============================================================================
 * MedMaster :: js/simprep.js
 * CLINICAL SIMULATION PREP  ->  window.SimPrepHub, window.SimPrepStudy
 * -----------------------------------------------------------------------------
 * The NUR2212 simulation-study section: twelve topics, fourteen lesson tabs per
 * topic, eight retrieval drills, and a mastery schedule that only moves when the
 * student actually retrieves something.
 *
 * DESIGN RULE #1 - THE SCHOOL FILE IS THE CHART. Every school-specific number,
 * order and MAR line is rendered verbatim from the scenario data and carries a
 * provenance badge. Nothing here writes clinical content of its own. The drills
 * are BUILT FROM the chart - Order vs No Order reads `orders`, Already Done
 * reads `mar`, Trend Spotter reads `vital_trends`, Lab Triage reads `labs`. If a
 * topic has no ABG, the ABG drill says so rather than inventing one.
 *
 * DESIGN RULE #2 - A DISPUTED ITEM IS NOT SCORED. `source_discrepancies` is
 * loaded per topic, shown in its own panel in the school's own words, and every
 * item it touches is rendered but withheld from grading and from the mastery
 * schedule until an instructor override exists. Silently "fixing" a typo would
 * teach the student something the proctor will not accept.
 *
 * DESIGN RULE #3 - AN OVERRIDE OUTRANKS THE SCHOOL FILE AND NEVER ERASES IT.
 * Every override records who, when, the original value and the replacement, and
 * both values stay on screen side by side forever. Revoking an override does not
 * delete it; it deactivates it and the audit trail keeps growing.
 *
 * DESIGN RULE #4 - OPENING A CARD IS NOT LEARNING. Confidence is 0-5 per CONCEPT
 * (topic + concept tag), it rises only on an unhinted successful retrieval, it
 * falls on a miss - two points if the student said they were sure - and a topic
 * is "ready" only when every concept it touches is at 4 or better with real
 * unhinted reps behind it. Cards opened are counted and shown, and deliberately
 * do not feed mastery.
 *
 * DESIGN RULE #5 - EVERY EXTERNAL THING IS OPTIONAL. The two data globals, the
 * Simulation and Checkoff modules, the partner layer, Firebase, MM.ai: each is
 * feature-detected, each degrades to a written explanation, none can throw.
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
  function uniq(list) {
    var seen = {}, out = [];
    arr(list).forEach(function (v) {
      var k = str(v);
      if (!k || seen[k]) { return; }
      seen[k] = 1; out.push(v);
    });
    return out;
  }
  /** Deterministic 32-bit string hash. Stable ids for discrepancies. */
  function hash32(s) {
    var h = 2166136261, i, t = str(s);
    for (i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  /** Deterministic shuffle - the same topic always presents the same order, so
      a student who returns to a drill is not silently re-randomised mid-study. */
  function seededOrder(list, seed) {
    var src = arr(list).slice();
    var s = 0, i, j, tmp;
    var k = str(seed);
    for (i = 0; i < k.length; i++) { s = (s * 31 + k.charCodeAt(i)) >>> 0; }
    for (i = src.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) >>> 0;
      j = s % (i + 1);
      tmp = src[i]; src[i] = src[j]; src[j] = tmp;
    }
    return src;
  }
  function MMx() { return obj(window.MM); }
  function toast(msg, kind) {
    var MM = MMx();
    if (isFn(MM.toast)) { try { MM.toast(str(msg), kind || 'info'); } catch (e) {} }
  }
  function reduceMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  var LIVE_ID = 'sp-live-region';
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
        n.className = 'sp-sr';
        n.setAttribute('aria-atomic', 'true');
        document.body.appendChild(n);
      }
      n.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
      n.textContent = '';
      window.setTimeout(function () { n.textContent = m; }, 60);
    } catch (e) {}
  }
  function pct(n, d) {
    var den = numOr(d, 0);
    if (!den) { return 0; }
    return Math.round((numOr(n, 0) / den) * 100);
  }
  function plural(n, one, many) {
    return numOr(n, 0) === 1 ? one : (many || (one + 's'));
  }

  /* ==========================================================================
   * 2. STYLESHEET (injected once)
   * --------------------------------------------------------------------------
   * Prefix `sp-` on every class. Custom properties are prefixed `--spx-` rather
   * than `--sp-`, because the shell already owns `--sp-1 … --sp-10` as its
   * spacing scale and a collision there would resize the whole app.
   *
   * Contrast rules honoured throughout: every control that paints a background
   * also declares its own `color` (a <button> does not inherit one), and no rule
   * hardcodes a near-black text colour - `--text-on-fill` is the only dark ink
   * and it is only ever used on a light fill.
   * ======================================================================== */

  function injectStyles() {
    try {
      if (!document || !document.getElementById) { return; }
      if (document.getElementById('simprep-styles')) { return; }
    } catch (e) { return; }

    var css = [
      /* ---- root + tokens ---- */
      '.sp-root{--spx-ok:var(--green,#22c55e);--spx-warn:var(--orange,#f59e0b);',
      '--spx-bad:var(--red,#ef4444);--spx-acc:var(--accent,#3b82f6);',
      '--spx-vio:var(--accent2,#8b5cf6);',
      '--spx-ok-fg:var(--green-fg,#4ade80);--spx-warn-fg:var(--orange-fg,#fbbf24);',
      '--spx-bad-fg:var(--red-fg,#f87171);--spx-acc-fg:var(--accent-fg,#60a5fa);',
      '--spx-vio-fg:var(--accent2-fg,#a78bfa);',
      '--spx-ok-bg:color-mix(in srgb,var(--green,#22c55e) 13%,var(--bg,#0f172a));',
      '--spx-warn-bg:color-mix(in srgb,var(--orange,#f59e0b) 14%,var(--bg,#0f172a));',
      '--spx-bad-bg:color-mix(in srgb,var(--red,#ef4444) 13%,var(--bg,#0f172a));',
      '--spx-acc-bg:color-mix(in srgb,var(--accent,#3b82f6) 13%,var(--bg,#0f172a));',
      '--spx-vio-bg:color-mix(in srgb,var(--accent2,#8b5cf6) 15%,var(--bg,#0f172a));',
      '--spx-ok-br:color-mix(in srgb,var(--green,#22c55e) 48%,transparent);',
      '--spx-warn-br:color-mix(in srgb,var(--orange,#f59e0b) 55%,transparent);',
      '--spx-bad-br:color-mix(in srgb,var(--red,#ef4444) 52%,transparent);',
      '--spx-acc-br:color-mix(in srgb,var(--accent,#3b82f6) 48%,transparent);',
      '--spx-vio-br:color-mix(in srgb,var(--accent2,#8b5cf6) 55%,transparent);',
      '--spx-gap:1.55;--spx-track:0;',
      'color:var(--text,#f1f5f9);font-size:1rem;}',
      /* Adjustable text size: the root carries a scale factor and everything
         inside is sized in em, so one control resizes the whole section. */
      '.sp-root.t-s{font-size:0.92rem;}',
      '.sp-root.t-m{font-size:1rem;}',
      '.sp-root.t-l{font-size:1.14rem;}',
      '.sp-root.t-xl{font-size:1.3rem;}',
      /* Dyslexia-friendly spacing: wider tracking, looser lines, no justified
         text, and a slightly heavier body weight. */
      '.sp-root.sp-dys{--spx-gap:1.9;--spx-track:0.035em;}',
      '.sp-root.sp-dys p,.sp-root.sp-dys li,.sp-root.sp-dys .sp-body,',
      '.sp-root.sp-dys .sp-sub{letter-spacing:var(--spx-track);word-spacing:0.09em;',
      'line-height:var(--spx-gap);}',
      /* Extra-contrast mode: stronger borders, flat high-contrast surfaces. */
      '.sp-root.sp-hc{--spx-ok-bg:var(--surface2,#273549);--spx-warn-bg:var(--surface2,#273549);',
      '--spx-bad-bg:var(--surface2,#273549);--spx-acc-bg:var(--surface2,#273549);',
      '--spx-vio-bg:var(--surface2,#273549);}',
      '.sp-root.sp-hc .sp-card,.sp-root.sp-hc .sp-btn,.sp-root.sp-hc .sp-tab,',
      '.sp-root.sp-hc .sp-opt{border-width:2px;border-color:var(--border-str,#475569);}',
      '.sp-root.sp-hc .sp-sub,.sp-root.sp-hc .sp-dim{color:var(--text2,#cbd5e1);}',
      '.sp-root *:focus-visible{outline:3px solid var(--accent,#3b82f6);outline-offset:2px;',
      'border-radius:var(--r-sm,6px);}',
      '.sp-root button{font-family:inherit;color:var(--text,#f1f5f9);}',
      '.sp-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;',
      'clip:rect(0 0 0 0);white-space:nowrap;border:0;}',

      /* ---- generic furniture ---- */
      '.sp-head{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px;}',
      '.sp-head h2{margin:0;font-size:1.35em;font-weight:800;letter-spacing:.2px;',
      'line-height:1.25;color:var(--text,#f1f5f9);}',
      '.sp-sub{color:var(--text2,#cbd5e1);font-size:0.86em;margin:3px 0 0;line-height:1.55;}',
      '.sp-dim{color:var(--text3,#a8b6c8);font-size:0.8em;line-height:1.5;}',
      '.sp-body{color:var(--text,#f1f5f9);font-size:0.92em;line-height:1.6;}',
      '.sp-spacer{flex:1 1 auto;}',
      '.sp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}',
      '.sp-col{display:flex;flex-direction:column;gap:10px;}',
      '.sp-btn{background:var(--surface,#1e293b);border:1px solid var(--border,#334155);',
      'color:var(--text,#f1f5f9);padding:10px 14px;border-radius:var(--r-md,10px);cursor:pointer;',
      'font-size:0.85em;font-weight:700;min-height:44px;line-height:1.3;',
      'transition:border-color .15s ease,transform .15s ease;}',
      '.sp-btn:hover:not(:disabled){border-color:var(--accent,#3b82f6);}',
      '.sp-btn:active:not(:disabled){transform:scale(.975);}',
      '.sp-btn:disabled{opacity:.45;cursor:not-allowed;}',
      '.sp-btn.go{background:var(--accent,#3b82f6);border-color:var(--accent,#3b82f6);',
      'color:var(--text-on-fill,#0f172a);}',
      '.sp-btn.ghost{background:transparent;color:var(--text2,#cbd5e1);}',
      '.sp-btn.danger{color:var(--spx-bad-fg);border-color:var(--spx-bad-br);',
      'background:var(--spx-bad-bg);}',
      '.sp-btn.sm{min-height:36px;padding:6px 11px;font-size:0.78em;}',
      '.sp-btn.wide{width:100%;justify-content:center;}',
      '.sp-card{background:var(--surface,#1e293b);border:1px solid var(--border,#334155);',
      'border-radius:var(--r-lg,14px);padding:14px;color:var(--text,#f1f5f9);}',
      '.sp-card+.sp-card{margin-top:12px;}',
      '.sp-card h3{margin:0 0 6px;font-size:1em;font-weight:800;line-height:1.3;',
      'color:var(--text,#f1f5f9);}',
      '.sp-card h4{margin:12px 0 5px;font-size:0.86em;font-weight:800;letter-spacing:.3px;',
      'text-transform:uppercase;color:var(--text3,#a8b6c8);}',
      '.sp-empty{padding:26px;text-align:center;color:var(--text3,#a8b6c8);font-size:0.88em;',
      'line-height:1.6;}',
      '.sp-note{border-left:3px solid var(--spx-warn-br);background:var(--spx-warn-bg);',
      'color:var(--text,#f1f5f9);padding:10px 12px;border-radius:var(--r-md,10px);',
      'font-size:0.85em;line-height:1.6;}',
      '.sp-banner{border:1px solid var(--spx-acc-br);background:var(--spx-acc-bg);',
      'color:var(--text,#f1f5f9);padding:10px 12px;border-radius:var(--r-md,10px);',
      'font-size:0.85em;line-height:1.6;}',
      '.sp-banner.bad{border-color:var(--spx-bad-br);background:var(--spx-bad-bg);}',
      '.sp-banner.ok{border-color:var(--spx-ok-br);background:var(--spx-ok-bg);}',
      '.sp-banner.warn{border-color:var(--spx-warn-br);background:var(--spx-warn-bg);}',
      '.sp-banner.vio{border-color:var(--spx-vio-br);background:var(--spx-vio-bg);}',
      '.sp-badge{display:inline-flex;align-items:center;gap:5px;font-size:0.66em;font-weight:800;',
      'letter-spacing:.5px;text-transform:uppercase;padding:3px 8px;border-radius:999px;',
      'border:1px solid var(--border,#334155);color:var(--text2,#cbd5e1);',
      'background:var(--surface2,#273549);white-space:nowrap;}',
      '.sp-badge.ok{color:var(--spx-ok-fg);border-color:var(--spx-ok-br);background:var(--spx-ok-bg);}',
      '.sp-badge.warn{color:var(--spx-warn-fg);border-color:var(--spx-warn-br);background:var(--spx-warn-bg);}',
      '.sp-badge.bad{color:var(--spx-bad-fg);border-color:var(--spx-bad-br);background:var(--spx-bad-bg);}',
      '.sp-badge.acc{color:var(--spx-acc-fg);border-color:var(--spx-acc-br);background:var(--spx-acc-bg);}',
      '.sp-badge.vio{color:var(--spx-vio-fg);border-color:var(--spx-vio-br);background:var(--spx-vio-bg);}',

      /* ---- provenance badges ----------------------------------------------
         These three must never be mistaken for one another, so they differ on
         FOUR axes at once: colour, border STYLE, leading glyph and wording. A
         colour-blind student reading a greyscale screenshot can still tell a
         school number from a supplemental one. */
      '.sp-prov{display:inline-flex;align-items:center;gap:6px;font-size:0.66em;font-weight:800;',
      'letter-spacing:.5px;text-transform:uppercase;padding:3px 9px;border-radius:var(--r-sm,6px);',
      'white-space:nowrap;line-height:1.35;}',
      '.sp-prov .g{font-size:1.05em;line-height:1;}',
      '.sp-prov.school{color:var(--spx-acc-fg);background:var(--spx-acc-bg);',
      'border:2px solid var(--spx-acc-br);border-left-width:6px;}',
      '.sp-prov.supp{color:var(--spx-warn-fg);background:var(--spx-warn-bg);',
      'border:2px dashed var(--spx-warn-br);}',
      '.sp-prov.override{color:var(--spx-vio-fg);background:var(--spx-vio-bg);',
      'border:2px double var(--spx-vio-fg);}',
      '.sp-prov.unknown{color:var(--text3,#a8b6c8);background:var(--surface2,#273549);',
      'border:2px dotted var(--border-str,#475569);}',
      '.sp-suppbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;',
      'border:2px dashed var(--spx-warn-br);background:var(--spx-warn-bg);',
      'color:var(--text,#f1f5f9);border-radius:var(--r-md,10px);padding:9px 12px;',
      'font-size:0.82em;font-weight:700;line-height:1.5;}',

      /* ---- hub ---- */
      '.sp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:12px;}',
      '.sp-topic{background:var(--surface,#1e293b);border:1px solid var(--border,#334155);',
      'border-radius:var(--r-lg,14px);padding:14px;text-align:left;cursor:pointer;width:100%;',
      'display:flex;flex-direction:column;gap:8px;color:var(--text,#f1f5f9);',
      'transition:transform .16s ease,border-color .16s ease;}',
      '.sp-topic:hover{transform:translateY(-2px);border-color:var(--accent,#3b82f6);}',
      '.sp-topic.supp{border-style:dashed;border-color:var(--spx-warn-br);}',
      '.sp-topic-t{font-size:0.98em;font-weight:800;line-height:1.3;color:var(--text,#f1f5f9);}',
      '.sp-topic-s{font-size:0.82em;color:var(--text2,#cbd5e1);line-height:1.5;}',
      '.sp-meter{height:8px;border-radius:999px;background:var(--surface3,#334155);overflow:hidden;}',
      '.sp-meter>span{display:block;height:100%;border-radius:999px;background:var(--accent,#3b82f6);',
      'transition:width .4s ease;}',
      '.sp-meter.ready>span{background:var(--green,#22c55e);}',
      '.sp-meter.near>span{background:var(--orange,#f59e0b);}',
      '.sp-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;}',
      '.sp-mode{background:var(--surface2,#273549);border:1px solid var(--border,#334155);',
      'border-radius:var(--r-md,10px);padding:12px;text-align:left;cursor:pointer;',
      'color:var(--text,#f1f5f9);min-height:44px;font-size:0.86em;line-height:1.5;}',
      '.sp-mode:hover:not(:disabled){border-color:var(--accent,#3b82f6);}',
      '.sp-mode:disabled{opacity:.6;cursor:not-allowed;}',
      '.sp-mode b{display:block;font-size:1.05em;font-weight:800;margin-bottom:3px;',
      'color:var(--text,#f1f5f9);}',
      '.sp-mode span{display:block;color:var(--text3,#a8b6c8);font-size:0.92em;}',

      /* ---- tab strip: thumb-reachable on a phone ---- */
      '.sp-study{display:flex;flex-direction:column;gap:12px;}',
      '.sp-tabwrap{order:0;position:sticky;top:60px;z-index:18;',
      'background:var(--bg,#0f172a);padding:6px 0;}',
      '.sp-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:thin;',
      '-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;padding:2px 2px 6px;}',
      '.sp-tab{flex:0 0 auto;scroll-snap-align:center;background:var(--surface2,#273549);',
      'border:1px solid var(--border,#334155);color:var(--text2,#cbd5e1);',
      'padding:8px 13px;border-radius:999px;font-size:0.78em;font-weight:700;cursor:pointer;',
      'min-height:44px;white-space:nowrap;}',
      '.sp-tab[aria-selected="true"]{background:var(--accent,#3b82f6);',
      'border-color:var(--accent,#3b82f6);color:var(--text-on-fill,#0f172a);}',
      '.sp-tab .dot{display:inline-block;width:7px;height:7px;border-radius:999px;',
      'margin-left:6px;background:var(--orange,#f59e0b);vertical-align:middle;}',
      '.sp-tab[aria-selected="true"] .dot{background:var(--text-on-fill,#0f172a);}',
      '.sp-pane{order:1;min-height:120px;}',
      '.sp-pager{order:3;display:flex;gap:8px;align-items:center;}',
      '.sp-pager .sp-btn{flex:1 1 0;justify-content:center;}',

      /* ---- lesson content ---- */
      '.sp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px;}',
      '.sp-list li{font-size:0.88em;line-height:1.6;color:var(--text,#f1f5f9);',
      'padding-left:20px;position:relative;}',
      '.sp-list li:before{content:"";position:absolute;left:4px;top:0.62em;width:7px;height:7px;',
      'border-radius:2px;background:var(--spx-acc-fg);}',
      '.sp-list.flag li:before{background:var(--spx-bad-fg);border-radius:999px;}',
      '.sp-list.step{counter-reset:spstep;}',
      '.sp-list.step li{padding-left:32px;}',
      '.sp-list.step li:before{counter-increment:spstep;content:counter(spstep);',
      'left:0;top:0.05em;width:22px;height:22px;border-radius:7px;font-size:0.78em;',
      'font-weight:800;display:flex;align-items:center;justify-content:center;',
      'background:var(--surface3,#334155);color:var(--text,#f1f5f9);}',
      '.sp-chain{display:flex;flex-direction:column;gap:0;}',
      '.sp-chain .lnk{display:flex;gap:10px;align-items:flex-start;padding:9px 11px;',
      'background:var(--surface2,#273549);border:1px solid var(--border,#334155);',
      'border-radius:var(--r-md,10px);font-size:0.88em;line-height:1.55;',
      'color:var(--text,#f1f5f9);}',
      '.sp-chain .arrow{align-self:center;color:var(--text3,#a8b6c8);font-size:1.1em;',
      'padding:2px 0;line-height:1;}',
      '.sp-chain .n{flex:0 0 auto;width:22px;height:22px;border-radius:7px;font-size:0.75em;',
      'font-weight:800;display:inline-flex;align-items:center;justify-content:center;',
      'background:var(--surface3,#334155);color:var(--text,#f1f5f9);}',
      '.sp-tbl{width:100%;border-collapse:collapse;font-size:0.84em;}',
      '.sp-tbl th{text-align:left;font-size:0.82em;text-transform:uppercase;letter-spacing:.4px;',
      'color:var(--text3,#a8b6c8);padding:6px;border-bottom:1px solid var(--border,#334155);',
      'white-space:nowrap;}',
      '.sp-tbl td{padding:6px;border-bottom:1px solid var(--border,#334155);',
      'color:var(--text,#f1f5f9);vertical-align:top;line-height:1.5;}',
      '.sp-tbl tr.up td{background:var(--spx-bad-bg);}',
      '.sp-tbl tr.down td{background:var(--spx-warn-bg);}',
      '.sp-tbl tr.flag td{background:var(--spx-warn-bg);}',
      '.sp-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}',
      '.sp-li{font-size:0.86em;line-height:1.6;color:var(--text,#f1f5f9);padding:8px 0;',
      'border-bottom:1px solid var(--border,#334155);display:flex;gap:9px;',
      'align-items:flex-start;flex-wrap:wrap;}',
      '.sp-li:last-child{border-bottom:0;}',
      '.sp-li .at{color:var(--text3,#a8b6c8);font-size:0.9em;font-weight:800;',
      'font-variant-numeric:tabular-nums;flex:0 0 auto;}',
      '.sp-li .tx{flex:1 1 160px;min-width:0;}',

      /* ---- drills ---- */
      '.sp-opt{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;',
      'background:var(--surface2,#273549);border:1px solid var(--border,#334155);',
      'color:var(--text,#f1f5f9);border-radius:var(--r-md,10px);padding:11px 12px;',
      'cursor:pointer;min-height:48px;font-size:0.87em;line-height:1.55;',
      'transition:border-color .15s ease,transform .12s ease;}',
      '.sp-opt:hover:not(:disabled){border-color:var(--accent,#3b82f6);}',
      '.sp-opt:active:not(:disabled){transform:scale(.99);}',
      '.sp-opt:disabled{cursor:default;}',
      '.sp-opt[aria-pressed="true"]{border-color:var(--accent,#3b82f6);background:var(--spx-acc-bg);}',
      '.sp-opt.right{border-color:var(--spx-ok-br);background:var(--spx-ok-bg);}',
      '.sp-opt.wrong{border-color:var(--spx-bad-br);background:var(--spx-bad-bg);}',
      '.sp-opt.miss{border-color:var(--spx-warn-br);background:var(--spx-warn-bg);}',
      '.sp-opt .mk{flex:0 0 auto;width:26px;height:26px;border-radius:8px;font-size:0.8em;',
      'font-weight:800;display:inline-flex;align-items:center;justify-content:center;',
      'background:var(--surface3,#334155);color:var(--text,#f1f5f9);}',
      '.sp-opt .tx{flex:1 1 auto;min-width:0;display:block;color:var(--text,#f1f5f9);}',
      '.sp-opt .sub{display:block;font-size:0.86em;margin-top:4px;line-height:1.5;',
      'color:var(--text3,#a8b6c8);}',
      '.sp-yn{display:flex;gap:8px;flex-wrap:wrap;}',
      '.sp-yn .sp-btn{flex:1 1 120px;justify-content:center;}',
      '.sp-fb{border-radius:var(--r-md,10px);padding:11px 12px;font-size:0.85em;line-height:1.6;',
      'border:1px solid var(--spx-acc-br);background:var(--spx-acc-bg);color:var(--text,#f1f5f9);}',
      '.sp-fb.good{border-color:var(--spx-ok-br);background:var(--spx-ok-bg);}',
      '.sp-fb.bad{border-color:var(--spx-bad-br);background:var(--spx-bad-bg);}',
      '.sp-fb.mid{border-color:var(--spx-warn-br);background:var(--spx-warn-bg);}',
      '.sp-fb b{display:block;font-size:0.95em;font-weight:800;margin-bottom:4px;',
      'color:var(--text,#f1f5f9);}',
      '.sp-flip{background:var(--surface2,#273549);border:1px solid var(--border,#334155);',
      'border-radius:var(--r-lg,14px);padding:20px 16px;min-height:150px;width:100%;',
      'display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;',
      'text-align:center;cursor:pointer;color:var(--text,#f1f5f9);font-size:1.02em;',
      'line-height:1.55;}',
      '.sp-flip:hover{border-color:var(--accent,#3b82f6);}',
      '.sp-flip .face{font-weight:700;font-size:1.02em;}',
      '.sp-flip .back{color:var(--spx-ok-fg);font-weight:600;font-size:0.95em;}',
      '.sp-ta{width:100%;box-sizing:border-box;background:var(--surface2,#273549);',
      'border:1px solid var(--border,#334155);color:var(--text,#f1f5f9);',
      'border-radius:var(--r-md,10px);padding:10px 11px;font-size:0.9em;font-family:inherit;',
      'line-height:1.6;min-height:72px;resize:vertical;}',
      '.sp-in{width:100%;box-sizing:border-box;background:var(--surface2,#273549);',
      'border:1px solid var(--border,#334155);color:var(--text,#f1f5f9);',
      'border-radius:var(--r-md,10px);padding:10px 11px;font-size:0.9em;font-family:inherit;',
      'min-height:44px;}',
      '.sp-lbl{display:block;font-size:0.74em;font-weight:800;letter-spacing:.45px;',
      'text-transform:uppercase;color:var(--text3,#a8b6c8);margin:12px 0 5px;}',
      '.sp-conf{display:flex;gap:5px;flex-wrap:wrap;}',
      '.sp-pip{width:15px;height:15px;border-radius:4px;background:var(--surface3,#334155);',
      'display:inline-block;}',
      '.sp-pip.on{background:var(--green,#22c55e);}',
      '.sp-pip.mid{background:var(--orange,#f59e0b);}',

      /* ---- source issue + override ---- */
      '.sp-issue{border:2px solid var(--spx-warn-br);background:var(--spx-warn-bg);',
      'border-radius:var(--r-md,10px);padding:12px;color:var(--text,#f1f5f9);}',
      '.sp-issue.resolved{border-color:var(--spx-vio-br);background:var(--spx-vio-bg);',
      'border-style:double;border-width:4px;}',
      '.sp-issue h4{margin:0 0 6px;font-size:0.8em;letter-spacing:.4px;text-transform:uppercase;',
      'color:var(--text2,#cbd5e1);}',
      '.sp-issue .q{font-size:0.88em;line-height:1.6;color:var(--text,#f1f5f9);',
      'border-left:3px solid var(--spx-warn-br);padding-left:10px;margin:8px 0;}',
      '.sp-audit{font-size:0.78em;line-height:1.6;color:var(--text2,#cbd5e1);',
      'background:var(--surface2,#273549);border:1px solid var(--border,#334155);',
      'border-radius:var(--r-sm,6px);padding:9px 10px;margin-top:8px;}',
      '.sp-audit dt{font-weight:800;color:var(--text3,#a8b6c8);text-transform:uppercase;',
      'font-size:0.86em;letter-spacing:.35px;}',
      '.sp-audit dd{margin:0 0 6px;color:var(--text,#f1f5f9);}',
      '.sp-audit dd:last-child{margin-bottom:0;}',
      '.sp-strike{text-decoration:line-through;text-decoration-thickness:2px;',
      'color:var(--text3,#a8b6c8);}',
      '.sp-nosc{display:inline-flex;align-items:center;gap:5px;font-size:0.7em;font-weight:800;',
      'letter-spacing:.4px;text-transform:uppercase;padding:2px 7px;border-radius:var(--r-sm,6px);',
      'border:2px dashed var(--spx-warn-br);background:var(--spx-warn-bg);',
      'color:var(--spx-warn-fg);white-space:nowrap;}',

      /* ---- partner presence ---- */
      '.sp-partner{display:flex;gap:8px;align-items:center;flex-wrap:wrap;',
      'border:1px solid var(--spx-vio-br);background:var(--spx-vio-bg);',
      'color:var(--text,#f1f5f9);border-radius:var(--r-md,10px);padding:8px 11px;',
      'font-size:0.8em;line-height:1.5;}',
      '.sp-who{display:inline-flex;align-items:center;gap:5px;background:var(--surface2,#273549);',
      'border:1px solid var(--border,#334155);border-radius:999px;padding:3px 9px;',
      'font-size:0.92em;font-weight:700;color:var(--text,#f1f5f9);}',
      '.sp-who .live{width:7px;height:7px;border-radius:999px;background:var(--green,#22c55e);}',

      /* ---- a11y toolbar ---- */
      '.sp-a11y{display:flex;gap:6px;align-items:center;flex-wrap:wrap;',
      'background:var(--surface2,#273549);border:1px solid var(--border,#334155);',
      'border-radius:var(--r-md,10px);padding:7px 9px;color:var(--text2,#cbd5e1);',
      'font-size:0.76em;}',
      '.sp-a11y .sp-btn{min-height:38px;padding:5px 10px;font-size:0.95em;}',
      '.sp-a11y .sp-btn[aria-pressed="true"]{background:var(--accent,#3b82f6);',
      'border-color:var(--accent,#3b82f6);color:var(--text-on-fill,#0f172a);}',

      /* ---- responsive: below 700px the tab strip parks at the BOTTOM of the
         viewport, where a thumb can actually reach it one-handed ---- */
      '@media (max-width:700px){',
      '.sp-tabwrap{order:2;position:sticky;top:auto;bottom:0;z-index:22;',
      'padding:6px 0 max(6px,env(safe-area-inset-bottom));',
      'border-top:1px solid var(--border,#334155);',
      'box-shadow:0 -6px 18px rgba(0,0,0,0.35);}',
      '.sp-tabs{padding-bottom:2px;}',
      '.sp-tab{min-height:46px;font-size:0.82em;}',
      '.sp-pager{order:1;}',
      '.sp-grid{grid-template-columns:minmax(0,1fr);}',
      '.sp-modes{grid-template-columns:minmax(0,1fr);}',
      '.sp-yn .sp-btn{flex:1 1 100%;}',
      '}',
      '@media (prefers-reduced-motion:reduce){.sp-topic:hover{transform:none;}',
      '.sp-meter>span{transition:none;}.sp-opt:active:not(:disabled){transform:none;}',
      '.sp-btn:active:not(:disabled){transform:none;}}'
    ].join('');

    try {
      var st = document.createElement('style');
      st.id = 'simprep-styles';
      st.textContent = css;
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  }

  /* ==========================================================================
   * 3. CONTENT ACCESS
   * --------------------------------------------------------------------------
   * data/nur2212-scenarios.js and data/nur2212-study.js are separate <script>
   * tags. Either can be missing (bad deploy, blocked CDN, an ad blocker eating a
   * filename it dislikes) and neither may take the section down. Everything
   * below returns an empty shape rather than throwing, and the two entry points
   * render a written explanation when the content is not there - the same
   * contract the shell's modulePage() honours for a missing module.
   * ======================================================================== */

  function rawTopics() { return arr(window.NUR2212_SCENARIOS); }
  function rawStudy() { return obj(window.NUR2212_STUDY); }

  function allTopics() {
    return rawTopics().filter(function (t) { return !!str(obj(t).topic_id); });
  }
  function topicById(id) {
    var want = str(id);
    var hit = allTopics().filter(function (t) { return str(t.topic_id) === want; });
    return hit.length ? hit[0] : null;
  }
  function scenariosOk() { return allTopics().length > 0; }
  function studyOk() {
    var s = rawStudy();
    return arr(s.flashcards).length > 0 || arr(s.quizzes).length > 0;
  }
  /** The section can run on scenarios alone; the study pack only adds cards and
      quizzes. Scenarios are the floor. */
  function contentOk() { return scenariosOk(); }

  function flashcardsFor(topicId) {
    var want = str(topicId);
    return arr(rawStudy().flashcards).filter(function (c) {
      return str(obj(c).topic_id) === want && str(obj(c).front);
    });
  }
  function quizzesFor(topicId) {
    var want = str(topicId);
    return arr(rawStudy().quizzes).filter(function (q) {
      return str(obj(q).topic_id) === want && str(obj(q).question);
    });
  }
  function playbook() { return obj(rawStudy().playbook); }
  function sourceRules() {
    var direct = arr(rawStudy().sourceRules);
    return direct.map(function (r) {
      return typeof r === 'string' ? r : str(obj(r).text || obj(r).rule || obj(r).label);
    }).filter(function (r) { return !!r; });
  }
  function lessonOf(topic) { return obj(obj(topic).lesson); }

  /* ==========================================================================
   * 4. PROVENANCE
   * --------------------------------------------------------------------------
   * Three states, and they must never be confusable. Colour alone is not a
   * distinction (a colour-blind student, a greyscale print of a study sheet, a
   * phone in sunlight), so each carries its own glyph, its own border STYLE and
   * its own words as well as its own colour.
   * ======================================================================== */

  var PROV = {
    school_file: {
      key: 'school', cls: 'school', glyph: '▣', label: 'School source',
      aria: 'School source. This is printed on the school simulation sheet.',
      blurb: 'Printed on the school simulation sheet. Treat it as the chart.'
    },
    generated_supplemental_practice: {
      key: 'supp', cls: 'supp', glyph: '◇', label: 'Supplemental',
      aria: 'Supplemental practice content. Not from a school sheet. Verify against your school checklist.',
      blurb: 'Practice material written to fill a gap, NOT a school sheet. ' +
             'Verify every detail against your school checklist before the checkoff.'
    },
    instructor_override: {
      key: 'override', cls: 'override', glyph: '✚', label: 'Instructor override',
      aria: 'Instructor override. An instructor corrected the school sheet here; the original is still shown.',
      blurb: 'An instructor corrected the school sheet here. The original wording is kept below it.'
    }
  };
  var PROV_UNKNOWN = {
    key: 'unknown', cls: 'unknown', glyph: '?', label: 'Unlabelled',
    aria: 'Provenance not recorded for this item.',
    blurb: 'This item carries no provenance label. Treat it as unverified.'
  };

  /** Accepts the schema values and the shorter strings the question banks use
      ("school", "supplemental"), because the two files were authored apart. */
  function provMeta(v) {
    var k = lower(v).replace(/[\s-]+/g, '_');
    if (PROV[k]) { return PROV[k]; }
    if (k === 'school' || k === 'school_source' || k === 'schoolfile') { return PROV.school_file; }
    if (k.indexOf('supplement') !== -1 || k.indexOf('generated') !== -1) {
      return PROV.generated_supplemental_practice;
    }
    if (k.indexOf('override') !== -1 || k.indexOf('instructor') !== -1) {
      return PROV.instructor_override;
    }
    return PROV_UNKNOWN;
  }
  function isSupplemental(topic) {
    return provMeta(obj(topic).provenance).key === 'supp';
  }
  function supplementalLabel() { return 'Supplemental - verify school checklist'; }

  /* ==========================================================================
   * 5. SOURCE DISCREPANCIES
   * --------------------------------------------------------------------------
   * `source_discrepancies` arrives as plain sentences written by whoever read
   * the school sheet. They are shown verbatim - rule 2 of SOURCE_RULES is that a
   * suspected typo is surfaced, never repaired - and they also have to be
   * MATCHED against the chart so the item they touch can be withheld from
   * scoring.
   *
   * The matcher is deliberately conservative and deliberately explainable. Each
   * discrepancy yields signals:
   *   - quoted phrases  (weight 2)  the school's own wording, quoted by the note
   *   - distinctive words >= 5 chars, minus a stopword list      (weight 1)
   *   - acronyms of 2+ capitals                                  (weight 1)
   *   - numbers of 2+ characters                                 (weight 1)
   * An item is disputed at a total weight of 2 or more, so one incidental word
   * is never enough. Notes about the DOCUMENT rather than the chart ("the header
   * says Faculty", "page 1 displays…") are classified `document` scope and never
   * dispute an item at all - otherwise the word "Student" would poison the whole
   * topic.
   * ======================================================================== */

  var STOP = ('the a an and or but of in on at to for with without from by is are was were be been ' +
    'this that these those it its as if then than so not no nor do does did done have has had ' +
    'which what when where who whom whose how why also only just even still yet more most less ' +
    'least very much many any some each other another same such per into onto over under about ' +
    'before after during while because although though however therefore thus hence ' +
    'verify verified verifying instructor instructors school schools sheet sheets sheeting ' +
    'file files filename header headers page pages label labels labeled labelled display displays ' +
    'displayed says said write writes written wording word words phrase phrases repeat repeats ' +
    'repeated appear appears appeared appearing listed listing lists list contain contains ' +
    'containing actually actual likely appears apparently intended intent should would could ' +
    'must might treat treated treating rather silently correcting corrected correction ' +
    'inconsistency inconsistent discrepancy discrepancies topic topics section sections ' +
    'student students faculty version versions original originally complete completely ' +
    'documentation document documents case cases their there where whether before after ' +
    'question questions answer answers example examples provider providers order orders ' +
    'ordered ordering following follow follows given give gives using used usual usually ' +
    'general generally specific specifically item items entry entries value values ' +
    'possible possibly support supported supports scoring scored score scores app apps'
  ).split(/\s+/);
  var STOPSET = (function () {
    var m = {}, i;
    for (i = 0; i < STOP.length; i++) { m[STOP[i]] = 1; }
    return m;
  })();

  function quotedPhrases(text) {
    var out = [], m;
    var re = /["“”']([^"“”']{3,90})["“”']/g;
    var t = str(text);
    while ((m = re.exec(t))) {
      var q = m[1].replace(/[.,;:]+$/, '').trim();
      if (q.length >= 3) { out.push(q); }
    }
    return uniq(out);
  }
  function distinctWords(text) {
    var out = [], m;
    var re = /[a-zA-Z][a-zA-Z-]{4,}/g;
    var t = str(text);
    while ((m = re.exec(t))) {
      var w = m[0].toLowerCase();
      if (!STOPSET[w]) { out.push(w); }
    }
    return uniq(out);
  }
  function acronyms(text) {
    var out = [], m;
    var re = /\b([A-Z][A-Z0-9]{1,7})\b/g;
    var t = str(text);
    while ((m = re.exec(t))) { out.push(m[1]); }
    return uniq(out).filter(function (a) { return a !== 'IV' ? true : true; });
  }
  function numbersIn(text) {
    var out = [], m;
    var re = /\b(\d{1,4}(?:\.\d{1,2})?)\b/g;
    var t = str(text);
    while ((m = re.exec(t))) { if (m[1].length >= 2) { out.push(m[1]); } }
    return uniq(out);
  }
  /** Notes about the paperwork, not the chart. */
  function isDocumentScope(text) {
    var t = lower(text);
    return /\b(header|filename|file name|page\s*1|labels the topic|is labeled|labelled|title of the (file|document)|cover page)\b/.test(t);
  }

  /** Normalise one topic's `source_discrepancies` (strings or objects). */
  function discrepanciesFor(topic) {
    var tp = obj(topic);
    var tid = str(tp.topic_id);
    return arr(tp.source_discrepancies).map(function (d, i) {
      var text = (typeof d === 'string') ? d : str(obj(d).text || obj(d).issue || obj(d).note);
      var t = str(text).trim();
      if (!t) { return null; }
      var explicitId = (typeof d === 'object') ? str(obj(d).id) : '';
      return {
        id: explicitId || (tid + ':' + hash32(lower(t).replace(/\s+/g, ' '))),
        topicId: tid,
        index: i,
        text: t,
        scope: isDocumentScope(t) ? 'document' : 'chart',
        quoted: quotedPhrases(t),
        words: distinctWords(t),
        acros: acronyms(t),
        nums: numbersIn(t)
      };
    }).filter(function (d) { return !!d; });
  }

  /** Weighted match of one chart item against one discrepancy. */
  function disputeWeight(disc, subject) {
    var d = obj(disc);
    var s = str(subject);
    if (!s) { return 0; }
    var lo = ' ' + lower(s).replace(/[^a-z0-9.%<>/-]+/g, ' ') + ' ';
    var w = 0, i;
    for (i = 0; i < arr(d.quoted).length; i++) {
      if (lo.indexOf(lower(d.quoted[i])) !== -1) { w += 2; }
    }
    for (i = 0; i < arr(d.words).length; i++) {
      if (lo.indexOf(' ' + d.words[i]) !== -1) { w += 1; }
    }
    for (i = 0; i < arr(d.acros).length; i++) {
      if ((' ' + s + ' ').indexOf(' ' + d.acros[i]) !== -1 ||
          (' ' + s + ' ').indexOf('"' + d.acros[i]) !== -1) { w += 1; }
    }
    for (i = 0; i < arr(d.nums).length; i++) {
      if (lo.indexOf(' ' + d.nums[i]) !== -1) { w += 1; }
    }
    return w;
  }
  var DISPUTE_THRESHOLD = 2;

  /**
   * disputesOn(topic, subject) -> [discrepancy]
   * Every chart-scoped discrepancy this piece of text collides with.
   */
  function disputesOn(topic, subject) {
    return discrepanciesFor(topic).filter(function (d) {
      return d.scope === 'chart' && disputeWeight(d, subject) >= DISPUTE_THRESHOLD;
    });
  }

  /* ==========================================================================
   * 6. INSTRUCTOR OVERRIDES
   * --------------------------------------------------------------------------
   * An override outranks the school file (SOURCE_RULES 3, and the master
   * prompt's authority order puts it above `school_file`) - and it must never
   * erase it. So the record always carries `originalText`, the UI always renders
   * the original struck through beside the replacement, and revoking an override
   * flips `active` rather than deleting anything. Superseding one pushes the old
   * record onto `history`, which only ever grows.
   *
   * Primary store is progress.simprep.overrides via setProgress - local, always
   * writable, no rules needed. The Firebase mirror at /simprep/overrides/<uid>
   * is best-effort for cross-device: HAS NO RULE TODAY, so the write is denied
   * and swallowed. SimPrepStudy.OVERRIDE_RULES carries the snippet to add.
   * ======================================================================== */

  var OVERRIDE_PATH = 'simprep/overrides';
  var OVERRIDE_RULES = {
    simprep: {
      overrides: {
        '$uid': {
          '.read': "auth != null && (auth.uid === $uid || (auth.token.email === 'codingky@gmail.com' && auth.token.email_verified === true))",
          '.write': 'auth != null && auth.uid === $uid',
          '$discId': {
            '.validate': "newData.hasChildren(['discrepancyId','topicId','originalText','at'])"
          }
        }
      }
    }
  };

  function makeOverride(input) {
    var i = obj(input);
    return {
      id: str(i.id) || (str(i.discrepancyId) + ':' + hash32(str(i.at) + str(i.replacementText))),
      discrepancyId: str(i.discrepancyId),
      topicId: str(i.topicId),
      /* Position in the topic's own `source_discrepancies` array. Carried only
         so the interop projection below can address it the way js/simprep-sim.js
         addresses it (`progress.simprepOverrides[topic]['d' + index]`). */
      discIndex: numOr(i.discIndex, -1),
      /* The school sheet's own words. Never blanked, never edited. */
      originalText: str(i.originalText),
      replacementText: str(i.replacementText),
      note: cut(str(i.note), 600),
      /* Who said so, and who typed it in. Both, always - a student may be the
         one entering what their instructor told them in post-conference, and
         the trail has to make that visible rather than dress it up as faculty. */
      instructorName: cut(str(i.instructorName), 80),
      recordedByUid: str(i.recordedByUid),
      recordedByName: cut(str(i.recordedByName), 80),
      recordedByEmail: cut(str(i.recordedByEmail), 120),
      recordedByRole: str(i.recordedByRole) || 'student',
      at: str(i.at) || new Date().toISOString(),
      active: i.active === false ? false : true,
      history: arr(i.history)
    };
  }

  function overridesFrom(progress) {
    return obj(obj(obj(progress).simprep).overrides);
  }
  /** The live override for a discrepancy, or null. Inactive records stay in the
      store and are returned by overrideRecord(), just not by this. */
  function activeOverride(progress, discId) {
    var rec = overridesFrom(progress)[str(discId)];
    return (rec && rec.active !== false) ? rec : null;
  }
  function overrideRecord(progress, discId) {
    return overridesFrom(progress)[str(discId)] || null;
  }

  /* --------------------------------------------------------------------------
   * INTEROP WITH SIMULATION MODE
   * js/simprep-sim.js keeps its overrides at
   *   progress.simprepOverrides[topic_id]['d' + index] = {text, by, at}
   * addressed by POSITION in the topic's `source_discrepancies` array. This
   * module keeps a full audit record keyed by a content hash, which survives a
   * reordered data file. Neither shape is going to change under the other, so
   * the two are projected onto each other: every save here writes the sim
   * module's projection as well, and every read here honours an override the
   * sim module recorded. An override an instructor gave in one mode has to
   * outrank the school file in both, or the student gets scored two different
   * ways on the same disputed line.
   * ------------------------------------------------------------------------ */
  var INTEROP_KEY = 'simprepOverrides';

  function interopMap(progress) { return obj(obj(progress)[INTEROP_KEY]); }

  /** An override the sim module recorded for this discrepancy, or null. */
  function interopOverride(progress, discId) {
    var id = str(discId);
    var cut2 = id.indexOf(':');
    if (cut2 <= 0) { return null; }
    var tid = id.slice(0, cut2);
    var byTopic = obj(interopMap(progress)[tid]);
    if (!keysOf(byTopic).length) { return null; }
    var topic = topicById(tid);
    if (!topic) { return null; }
    var hit = discrepanciesFor(topic).filter(function (d) { return d.id === id; })[0];
    if (!hit) { return null; }
    var rec = byTopic['d' + hit.index];
    if (rec === undefined || rec === null) { rec = byTopic[String(hit.index)]; }
    return (rec === undefined || rec === null) ? null : rec;
  }

  /** Write (or clear) the sim module's projection of one override record. */
  function applyInterop(root, rec) {
    var r = obj(rec);
    var idx = numOr(r.discIndex, -1);
    if (!root || idx < 0 || !str(r.topicId)) { return; }
    var map = shallow(obj(root[INTEROP_KEY]));
    var byTopic = shallow(obj(map[str(r.topicId)]));
    var key = 'd' + idx;
    if (r.active === false) {
      delete byTopic[key];
    } else {
      byTopic[key] = {
        text: str(r.replacementText),
        by: str(r.instructorName) || str(r.recordedByName),
        at: (function () { var n = Date.parse(str(r.at)); return isFinite(n) ? n : nowMs(); })(),
        /* Not read by the sim module, and never dropped: the school file's own
           words travel with the projection too. */
        original: str(r.originalText),
        discrepancyId: str(r.discrepancyId)
      };
    }
    map[str(r.topicId)] = byTopic;
    root[INTEROP_KEY] = map;
  }

  /** Is this discrepancy settled - i.e. may items it touches now be scored? */
  function isResolved(progress, discId) {
    if (activeOverride(progress, discId)) { return true; }
    return !!interopOverride(progress, discId);
  }

  /* ==========================================================================
   * 7. PROGRESS SHAPE + SAFE WRITES
   * --------------------------------------------------------------------------
   * `progress` is one shared object for the whole app: quiz history, sim
   * results, streaks, a dozen other modules' keys. Every write here therefore
   * copies the parent, copies the `simprep` branch, copies the sub-branch it
   * touches, and returns a NEW object - so no sibling key is ever dropped, and
   * two modules writing in the same tick cannot clobber one another.
   * ======================================================================== */

  var NS = 'simprep';
  var STATE_VERSION = 1;

  function emptyState() {
    return {
      v: STATE_VERSION,
      concepts: {},   /* 'topic|tag' -> concept record */
      overrides: {},  /* discrepancyId -> override record */
      prefs: {},      /* text size, dyslexia spacing, contrast, intervals */
      opened: {},     /* cards/tabs opened - counted, NEVER mastery */
      log: []         /* recent graded attempts, newest last, capped */
    };
  }
  function stateOf(progress) {
    var s = obj(obj(progress)[NS]);
    return {
      v: numOr(s.v, STATE_VERSION),
      concepts: obj(s.concepts),
      overrides: obj(s.overrides),
      prefs: obj(s.prefs),
      opened: obj(s.opened),
      log: arr(s.log)
    };
  }
  /**
   * mutate(setProgress, fn) - fn(branch, root) receives a WORKING COPY of the
   * simprep branch, and the copied parent object for the rare write that has to
   * reach a sibling key (the Simulation-Mode override projection). Everything
   * above the branch is copied, not shared, so no other module's key can be
   * dropped by a write from here.
   */
  function mutate(setProgress, fn) {
    if (!isFn(setProgress) || !isFn(fn)) { return; }
    try {
      setProgress(function (prev) {
        var next = shallow(prev);              /* keep every sibling module key */
        var cur = stateOf(prev);
        var work = {
          v: STATE_VERSION,
          concepts: shallow(cur.concepts),
          overrides: shallow(cur.overrides),
          prefs: shallow(cur.prefs),
          opened: shallow(cur.opened),
          log: cur.log.slice()
        };
        try { fn(work, next); } catch (e) { return prev; }
        if (work.log.length > 240) { work.log = work.log.slice(work.log.length - 240); }
        next[NS] = work;
        return next;
      });
    } catch (e) {}
  }

  /* ==========================================================================
   * 8. MASTERY + SPACED REPETITION
   * --------------------------------------------------------------------------
   * The spec is explicit that a topic is NOT mastered because the learner opened
   * every card, so nothing in this section can be moved by opening anything.
   *
   * The unit is a CONCEPT, not a topic: `topic_id | tag`, where tag is one of
   * the concept tags the spec names (assessment, labs, meds/orders,
   * deterioration, prioritization, SBAR) plus the flashcard tags the question
   * bank uses. A topic's readiness is DERIVED from its concepts and is never
   * stored, so it cannot drift away from the retrieval evidence underneath it.
   *
   * Confidence 0-5:
   *   unhinted correct       -> +1, advance one interval step
   *   hinted correct         -> unchanged, step unchanged, due again this session
   *   miss, was confident    -> -2, back to step 0     (spec: "reset or reduce
   *                                                     after high-confidence
   *                                                     misses")
   *   miss, was not confident-> -1, back to step 0
   * "Was confident" means the stored confidence is already 4+ OR the learner
   * ticked "I'm sure" before answering.
   *
   * Schedule: same session -> 1d -> 3d -> 7d -> 14d, and the array is a pref, so
   * an instructor or a student cramming for Thursday can compress it.
   * ======================================================================== */

  var DAY_MS = 86400000;
  var SAME_SESSION_MS = 10 * 60 * 1000;    /* "same session" = back in 10 min */
  var DEFAULT_INTERVALS = [0, 1, 3, 7, 14]; /* days; 0 means same session */
  var MAX_CONF = 5;
  var HIGH_CONF = 4;                        /* at or above this, a miss stings */
  var READY_CONF = 4;                       /* per-concept bar for "ready" */
  var READY_REPS = 2;                       /* unhinted successes required too */

  /* The concept tags. `key` is what gets stored; `label` is what a student
     reads; `aka` folds in the various spellings the two data files use. */
  var TAGS = [
    { key: 'assessment', label: 'Assessment', aka: ['assessment', 'assess', 'red_flags', 'redflags', 'findings'] },
    { key: 'labs', label: 'Labs & diagnostics', aka: ['labs', 'lab', 'diagnostics', 'abg', 'results'] },
    { key: 'meds_orders', label: 'Meds & orders', aka: ['meds', 'medications', 'orders', 'meds_orders', 'mar', 'medication'] },
    { key: 'deterioration', label: 'Deterioration', aka: ['deterioration', 'deteriorating', 'cues', 'trend', 'trends'] },
    { key: 'prioritization', label: 'Prioritization', aka: ['prioritization', 'priority', 'sequence', 'in_room', 'ordering'] },
    { key: 'sbar', label: 'SBAR', aka: ['sbar', 'communication', 'handoff', 'escalation'] },
    { key: 'patho', label: 'Patho chain', aka: ['patho', 'pathophysiology', 'mechanism', 'chain'] },
    { key: 'rapid_recall', label: 'Rapid recall', aka: ['rapid_recall', 'rapid', 'recall', 'sixty_second'] },
    { key: 'simulation_goal', label: 'What the sim tests', aka: ['simulation_goal', 'goal', 'testing'] },
    { key: 'mnemonic', label: 'Memory hooks', aka: ['mnemonic', 'memory_hook', 'hook'] }
  ];
  var TAG_INDEX = (function () {
    var m = {}, i, j;
    for (i = 0; i < TAGS.length; i++) {
      m[TAGS[i].key] = TAGS[i];
      for (j = 0; j < TAGS[i].aka.length; j++) { m[TAGS[i].aka[j]] = TAGS[i]; }
    }
    return m;
  })();
  function tagKey(v) {
    var k = lower(v).replace(/[\s/-]+/g, '_');
    return TAG_INDEX[k] ? TAG_INDEX[k].key : 'rapid_recall';
  }
  function tagLabel(key) {
    return TAG_INDEX[key] ? TAG_INDEX[key].label : str(key);
  }
  function conceptKey(topicId, tag) { return str(topicId) + '|' + tagKey(tag); }
  function splitConcept(k) {
    var i = str(k).indexOf('|');
    return i === -1 ? { topicId: str(k), tag: '' }
                    : { topicId: str(k).slice(0, i), tag: str(k).slice(i + 1) };
  }

  function intervalsOf(progress) {
    var raw = arr(stateOf(progress).prefs.intervals);
    var out = raw.map(function (n) { return numOr(n, -1); })
                 .filter(function (n) { return n >= 0; });
    return out.length ? out : DEFAULT_INTERVALS;
  }
  function dueAt(stepIdx, intervals, from) {
    var iv = arr(intervals).length ? intervals : DEFAULT_INTERVALS;
    var i = clamp(numOr(stepIdx, 0), 0, iv.length - 1);
    var days = numOr(iv[i], 0);
    var base = numOr(from, nowMs());
    return base + (days > 0 ? days * DAY_MS : SAME_SESSION_MS);
  }

  /**
   * isDueNow(rec) - a concept is "due" when its next review has arrived OR is
   * inside the same-session window. A miss reschedules for "same session", and
   * a same-session item that did not count as due would never show up in the
   * queue that is supposed to bring it back - which is the entire mechanism.
   */
  function isDueNow(rec) {
    var r = obj(rec);
    if (numOr(r.reps, 0) <= 0) { return false; }
    return (numOr(r.due, 0) - nowMs()) <= SAME_SESSION_MS;
  }

  function blankConcept(topicId, tag) {
    return {
      topic: str(topicId), tag: tagKey(tag),
      conf: 0, step: 0, reps: 0, hits: 0, hintedHits: 0, misses: 0,
      last: 0, due: 0, lastResult: ''
    };
  }
  function conceptOf(progress, topicId, tag) {
    var rec = stateOf(progress).concepts[conceptKey(topicId, tag)];
    if (!rec) { return blankConcept(topicId, tag); }
    var b = blankConcept(topicId, tag);
    var out = shallow(b), k;
    for (k in obj(rec)) {
      if (Object.prototype.hasOwnProperty.call(rec, k)) { out[k] = rec[k]; }
    }
    out.conf = clamp(numOr(out.conf, 0), 0, MAX_CONF);
    return out;
  }

  /**
   * gradeConcept(rec, outcome, intervals) -> new record  (PURE)
   * outcome: {correct, hinted, sure, at}
   */
  function gradeConcept(rec, outcome, intervals) {
    var r = shallow(obj(rec));
    var o = obj(outcome);
    var iv = arr(intervals).length ? intervals : DEFAULT_INTERVALS;
    var at = numOr(o.at, nowMs());
    var conf = clamp(numOr(r.conf, 0), 0, MAX_CONF);
    var step = clamp(numOr(r.step, 0), 0, iv.length - 1);
    var wasConfident = (conf >= HIGH_CONF) || !!o.sure;

    r.reps = numOr(r.reps, 0) + 1;
    r.last = at;

    if (o.correct && !o.hinted) {
      r.conf = clamp(conf + 1, 0, MAX_CONF);
      r.hits = numOr(r.hits, 0) + 1;
      r.step = clamp(step + 1, 0, iv.length - 1);
      r.lastResult = 'hit';
    } else if (o.correct && o.hinted) {
      /* Recognising the answer once it was pointed at is not retrieval. It buys
         nothing, and it comes back this session. */
      r.conf = conf;
      r.hintedHits = numOr(r.hintedHits, 0) + 1;
      r.step = step;
      r.lastResult = 'hinted';
    } else {
      r.conf = clamp(conf - (wasConfident ? 2 : 1), 0, MAX_CONF);
      r.misses = numOr(r.misses, 0) + 1;
      r.step = 0;
      r.lastResult = wasConfident ? 'miss-sure' : 'miss';
    }
    r.due = dueAt(o.correct && !o.hinted ? r.step : 0, iv,
                  (o.correct && !o.hinted) ? at : at);
    if (!(o.correct && !o.hinted)) { r.due = at + SAME_SESSION_MS; }
    return r;
  }

  /**
   * recordAttempt(setProgress, progress, spec)
   * spec: {topicId, tag, correct, hinted, sure, drill, label, scored}
   * `scored:false` (a disputed item with no override) writes an audit line and
   * leaves the concept untouched - that is the whole point of the gate.
   */
  function recordAttempt(setProgress, progress, spec) {
    var s = obj(spec);
    var key = conceptKey(s.topicId, s.tag);
    var iv = intervalsOf(progress);
    var at = nowMs();
    var scored = s.scored !== false;
    mutate(setProgress, function (w) {
      if (scored) {
        var prevRec = w.concepts[key] || blankConcept(s.topicId, s.tag);
        w.concepts[key] = gradeConcept(prevRec, {
          correct: !!s.correct, hinted: !!s.hinted, sure: !!s.sure, at: at
        }, iv);
      }
      w.log.push({
        at: at, topic: str(s.topicId), tag: tagKey(s.tag), drill: str(s.drill),
        label: cut(str(s.label), 120),
        correct: !!s.correct, hinted: !!s.hinted, sure: !!s.sure, scored: scored,
        reason: scored ? '' : str(s.reason || 'source issue - not scored until an instructor override exists')
      });
    });
  }

  /** Opening a card is recorded, and deliberately does not touch mastery. */
  function recordOpened(setProgress, topicId, what) {
    var k = str(topicId) + '#' + str(what);
    mutate(setProgress, function (w) {
      w.opened[k] = numOr(w.opened[k], 0) + 1;
    });
  }

  /** Every concept a topic can exercise, from the content that is actually there. */
  function conceptsForTopic(topic) {
    var t = obj(topic);
    var keys = ['assessment', 'labs', 'meds_orders', 'deterioration', 'prioritization', 'sbar'];
    var out = [];
    keys.forEach(function (k) {
      var has = true;
      if (k === 'labs') { has = arr(t.labs).length > 0 || arr(t.diagnostics).length > 0; }
      if (k === 'meds_orders') { has = arr(t.orders).length > 0 || arr(t.mar).length > 0; }
      if (k === 'deterioration') { has = arr(t.deterioration_cues).length > 0 || arr(t.vital_trends).length > 1; }
      if (k === 'sbar') { has = arr(t.sbar_expected).length > 0; }
      if (k === 'assessment') { has = arr(t.initial_findings).length > 0; }
      if (k === 'prioritization') { has = arr(t.critical_actions).length > 0 || arr(lessonOf(t).inRoomSequence).length > 0; }
      if (has) { out.push(k); }
    });
    /* Whatever the flashcards actually tag, too. */
    flashcardsFor(t.topic_id).forEach(function (c) {
      var k = tagKey(obj(c).tag);
      if (out.indexOf(k) === -1) { out.push(k); }
    });
    return out;
  }

  /**
   * topicMastery(progress, topic) -> {pct, ready, concepts[], dueCount, weakest}
   * DERIVED. Nothing writes this.
   */
  function topicMastery(progress, topic) {
    var t = obj(topic);
    var tid = str(t.topic_id);
    var keys = conceptsForTopic(t);
    var now = nowMs();
    var recs = keys.map(function (k) {
      var r = conceptOf(progress, tid, k);
      r.dueNow = isDueNow(r);
      r.ready = r.conf >= READY_CONF && numOr(r.hits, 0) >= READY_REPS;
      return r;
    });
    var total = recs.length * MAX_CONF;
    var got = 0, due = 0, ready = 0, touched = 0;
    recs.forEach(function (r) {
      got += r.conf;
      if (r.dueNow) { due++; }
      if (r.ready) { ready++; }
      if (numOr(r.reps, 0) > 0) { touched++; }
    });
    var weakest = recs.slice().sort(function (a, b) {
      if (a.conf !== b.conf) { return a.conf - b.conf; }
      return numOr(a.hits, 0) - numOr(b.hits, 0);
    })[0] || null;
    return {
      topicId: tid,
      pct: total ? Math.round((got / total) * 100) : 0,
      conceptCount: recs.length,
      readyCount: ready,
      touchedCount: touched,
      dueCount: due,
      /* Ready means every concept cleared the bar with real unhinted reps.
         Not "I read the tabs". */
      ready: recs.length > 0 && ready === recs.length,
      concepts: recs,
      weakest: weakest
    };
  }

  /** Cross-topic roll-up per bare tag, for the hub's "what is weak everywhere". */
  function tagRollup(progress) {
    var st = stateOf(progress);
    var byTag = {};
    keysOf(st.concepts).forEach(function (k) {
      var parts = splitConcept(k);
      var rec = obj(st.concepts[k]);
      var t = byTag[parts.tag] || (byTag[parts.tag] = {
        tag: parts.tag, label: tagLabel(parts.tag), n: 0, sum: 0, misses: 0, due: 0
      });
      t.n++;
      t.sum += clamp(numOr(rec.conf, 0), 0, MAX_CONF);
      t.misses += numOr(rec.misses, 0);
      if (isDueNow(rec)) { t.due++; }
    });
    return keysOf(byTag).map(function (k) {
      var t = byTag[k];
      t.avg = t.n ? (t.sum / t.n) : 0;
      return t;
    }).sort(function (a, b) { return a.avg - b.avg; });
  }

  /** What the student should revisit right now, weakest and most overdue first. */
  function dueQueue(progress, limit) {
    var st = stateOf(progress);
    var now = nowMs();
    var rows = keysOf(st.concepts).map(function (k) {
      var rec = obj(st.concepts[k]);
      var parts = splitConcept(k);
      return {
        key: k, topicId: parts.topicId, tag: parts.tag, label: tagLabel(parts.tag),
        conf: clamp(numOr(rec.conf, 0), 0, MAX_CONF),
        due: numOr(rec.due, 0), reps: numOr(rec.reps, 0),
        overdueMs: now - numOr(rec.due, 0)
      };
    }).filter(function (r) { return isDueNow(r); });
    rows.sort(function (a, b) {
      if (a.conf !== b.conf) { return a.conf - b.conf; }
      return b.overdueMs - a.overdueMs;
    });
    return rows.slice(0, numOr(limit, 8));
  }

  function fmtDue(ms) {
    var d = numOr(ms, 0) - nowMs();
    if (!numOr(ms, 0)) { return 'not started'; }
    if (d <= 0) { return 'due now'; }
    if (d < 3600000) { return 'in ' + Math.max(1, Math.round(d / 60000)) + ' min'; }
    if (d < DAY_MS) { return 'in ' + Math.round(d / 3600000) + ' h'; }
    return 'in ' + Math.round(d / DAY_MS) + ' ' + plural(Math.round(d / DAY_MS), 'day');
  }

  /* ==========================================================================
   * 9. CHART PARSERS
   * --------------------------------------------------------------------------
   * The school sheets write vitals as strings ("142/86", "88%", "101.8 F") and
   * labs as free text. Nothing here rewrites those strings - they are rendered
   * verbatim everywhere. These readers exist only so a drill can compute whether
   * a number moved, and they all fail soft to null.
   * ======================================================================== */

  function firstNum(v) {
    var m = /-?\d+(?:\.\d+)?/.exec(str(v));
    return m ? parseFloat(m[0]) : null;
  }
  function systolicOf(bp) {
    var m = /(\d{2,3})\s*\/\s*(\d{2,3})/.exec(str(bp));
    return m ? parseFloat(m[1]) : firstNum(bp);
  }
  function diastolicOf(bp) {
    var m = /(\d{2,3})\s*\/\s*(\d{2,3})/.exec(str(bp));
    return m ? parseFloat(m[2]) : null;
  }
  function firstSentence(text, max) {
    var t = str(text).trim();
    var m = /^[\s\S]*?[.!?](\s|$)/.exec(t);
    var s = m ? m[0].trim() : t;
    return cut(s, numOr(max, 190));
  }
  /** A MAR/orders line that is a note about the absence of content, not content. */
  function isMetaLine(line) {
    var t = lower(line);
    if (!t) { return true; }
    return /no (universal|routine)? ?medication|no medications administered|should be configured|scenario-specific|not hard-?code|hard-?coded|instructor\/scenario orders control|come from the active mar|practice-only|example orders|must be substituted|must be scenario/.test(t);
  }
  function realLines(list) {
    return arr(list).map(function (x) { return str(x).trim(); })
      .filter(function (x) { return !!x && !isMetaLine(x); });
  }
  function metaLines(list) {
    return arr(list).map(function (x) { return str(x).trim(); })
      .filter(function (x) { return !!x && isMetaLine(x); });
  }
  /** "1015 - pantoprazole 80 mg IV" -> {at:'1015', text:'pantoprazole 80 mg IV'} */
  function splitTimed(line) {
    var t = str(line).trim();
    var m = /^(\d{3,4})\s*[-–—:]\s*(.+)$/.exec(t);
    if (m) { return { at: m[1], text: m[2].trim(), raw: t }; }
    return { at: '', text: t, raw: t };
  }

  /* ==========================================================================
   * 10. THE EIGHT HIGH-YIELD DRILLS
   * --------------------------------------------------------------------------
   * Every builder is a PURE function of the scenario data. None of them holds a
   * hardcoded clinical fact about a topic: Order vs No Order reads `orders`,
   * Already Done reads `mar`, Trend Spotter reads `vital_trends`, Lab Triage
   * reads `labs`, ABG Sprint reads the ABG rows out of `labs`, Shock Type Match
   * reads the titles and case text, SBAR Builder reads `sbar_expected`, and
   * Look-Alike Compare reads the findings of the topics being compared.
   *
   * Each returns either a drill object or `{ok:false, why:'…'}` so the tab can
   * explain in words why this chart cannot support that drill, which is itself
   * worth knowing ("this chart has no ABG").
   * ======================================================================== */

  var DRILLS = [
    { id: 'trend', label: 'Trend Spotter', tag: 'deterioration' },
    { id: 'labtriage', label: 'Lab Triage', tag: 'labs' },
    { id: 'ordercheck', label: 'Order vs. No Order', tag: 'meds_orders' },
    { id: 'alreadydone', label: 'Already Done', tag: 'meds_orders' },
    { id: 'abg', label: 'ABG Sprint', tag: 'labs' },
    { id: 'shock', label: 'Shock Type Match', tag: 'prioritization' },
    { id: 'sbar', label: 'SBAR Builder', tag: 'sbar' },
    { id: 'lookalike', label: 'Look-Alike Compare', tag: 'assessment' }
  ];
  function drillMeta(id) {
    var hit = DRILLS.filter(function (d) { return d.id === str(id); });
    return hit.length ? hit[0] : { id: str(id), label: str(id), tag: 'rapid_recall' };
  }

  /* ---------------------------------------------------------------- 10.1 */
  /* TREND SPOTTER - two or three vital sets, "what is deteriorating?"        */

  var VITAL_PARAMS = [
    { key: 'bp', label: 'Blood pressure', read: systolicOf, unit: 'systolic' },
    { key: 'hr', label: 'Heart rate', read: firstNum, unit: 'bpm' },
    { key: 'rr', label: 'Respiratory rate', read: firstNum, unit: 'breaths/min' },
    { key: 'spo2', label: 'SpO2', read: firstNum, unit: '%' },
    { key: 'temp', label: 'Temperature', read: firstNum, unit: 'F' }
  ];

  /** Direction table. Returns '' (not worrying) or a short reason. */
  function worseningReason(key, first, last) {
    var d = last - first;
    if (key === 'spo2') { return d <= -2 ? 'falling oxygen saturation' : ''; }
    if (key === 'hr') { return d >= 8 ? 'rising heart rate' : ''; }
    if (key === 'rr') { return d >= 3 ? 'rising respiratory rate' : ''; }
    if (key === 'temp') { return d >= 0.5 ? 'rising temperature' : ''; }
    if (key === 'bp') {
      if (d <= -8) { return 'falling systolic pressure'; }
      if (d >= 10) { return 'rising systolic pressure'; }
      return '';
    }
    return '';
  }

  function buildTrendSpotter(topic) {
    var t = obj(topic);
    var rows = arr(t.vital_trends).filter(function (r) { return !!obj(r); });
    if (rows.length < 2) {
      return { ok: false, id: 'trend', why: rows.length === 1
        ? 'This chart records ONE set of vital signs, so there is no trend to read. ' +
          'That is worth noticing on its own: you would be the one taking the second set.'
        : 'This chart records no vital-sign trend.' };
    }
    var show = rows.slice(0, 3);
    if (rows.length > 3) { show = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]]; }
    var first = obj(show[0]), last = obj(show[show.length - 1]);
    var params = VITAL_PARAMS.map(function (p) {
      var a = p.read(first[p.key]), b = p.read(last[p.key]);
      if (a === null || b === null) { return null; }
      var why = worseningReason(p.key, a, b);
      return {
        key: p.key, label: p.label, unit: p.unit,
        firstRaw: str(first[p.key]), lastRaw: str(last[p.key]),
        first: a, last: b, delta: Math.round((b - a) * 10) / 10,
        worse: !!why, why: why
      };
    }).filter(function (p) { return !!p; });

    var answers = params.filter(function (p) { return p.worse; })
                        .map(function (p) { return p.key; });
    return {
      ok: true, id: 'trend', tag: 'deterioration',
      prompt: 'Compare the vital-sign sets from this chart. Tap every parameter that is moving ' +
              'in the wrong direction, then check your answer.',
      rows: show, params: params, answers: answers,
      stable: answers.length === 0,
      stableLabel: 'Nothing - this patient is stable or improving',
      cues: arr(t.deterioration_cues).slice(0, 6)
    };
  }

  /* ---------------------------------------------------------------- 10.2 */
  /* LAB TRIAGE - tap the three most urgent findings                         */

  var TEST_WEIGHT = {
    'pao2': 3, 'lactate': 3, 'hgb': 3, 'hemoglobin': 3, 'spo2': 3,
    'ph': 2.5, 'hct': 2.5, 'platelets': 2.5, 'ammonia': 2.5, 'fibrinogen': 2.5,
    'paco2': 2, 'inr': 2, 'troponin': 2, 'potassium': 2, 'bnp': 1.5,
    'd-dimer': 1.5, 'wbc': 1.5, 'glucose': 1.5, 'sodium': 1.5, 'aptt': 1.5,
    'pt': 1.5, 'blood cultures': 1.5, 'neutrophils': 0.8, 'crp': 0.8,
    'bun': 1, 'creatinine': 1, 'gfr': 1, 'ast': 1, 'alt': 1, 'rbc': 1,
    'total bilirubin': 1, 'albumin': 0.5, 'hco3': 1
  };
  function labUrgency(lab) {
    var l = obj(lab);
    var s = lower(l.interpretation) + ' ' + lower(l.result);
    if (/critic|severe|marked|profound|dangerous|life-threat|grossly/.test(s)) { return 3; }
    if (/\bnormal\b|\bwnl\b|within range|no growth/.test(s) && !/abnormal|below normal|above normal/.test(s)) { return 0; }
    if (/upper end|lower end|borderline|slight|mild/.test(s)) { return 1; }
    if (/alkalem|acidem|alkalos|acidos|hypox|anemi|thrombocytopen|coagulopath/.test(s)) { return 2; }
    if (/high|low|elevat|prolong|decreas|increas|abnormal|positive|reduc|rising|falling|consum/.test(s)) { return 2; }
    if (/pending|sent|collect/.test(s)) { return 0.5; }
    return 1;
  }
  function labScore(lab) {
    var name = lower(obj(lab).test).replace(/\s+/g, ' ').trim();
    var w = TEST_WEIGHT[name];
    if (w === undefined) { w = 1; }
    return labUrgency(lab) * 10 + w;
  }

  function buildLabTriage(topic) {
    var t = obj(topic);
    var labs = arr(t.labs).filter(function (l) { return !!str(obj(l).test); });
    if (labs.length < 4) {
      return { ok: false, id: 'labtriage', why: 'This chart lists ' + labs.length + ' ' +
        plural(labs.length, 'lab value') + ' - too few to triage. Read them in the ' +
        'Labs & Diagnostics tab instead.' };
    }
    var ranked = labs.map(function (l, i) {
      return {
        idx: i, test: str(l.test), result: str(l.result),
        interpretation: str(l.interpretation),
        score: labScore(l), urgency: labUrgency(l)
      };
    }).sort(function (a, b) { return b.score - a.score; });

    var cutoff = ranked[2].score;
    var answers = ranked.filter(function (r) { return r.score >= cutoff && r.urgency > 0; })
                        .map(function (r) { return r.idx; });
    return {
      ok: true, id: 'labtriage', tag: 'labs',
      prompt: 'Three of these need to be in your first sentence to the provider. Tap the three ' +
              'most urgent, then check.',
      items: labs.map(function (l, i) {
        return { idx: i, test: str(l.test), result: str(l.result), interpretation: str(l.interpretation) };
      }),
      ranked: ranked, answers: answers, pickCount: 3
    };
  }

  /* ---------------------------------------------------------------- 10.3 */
  /* ORDER vs NO ORDER - is this action permitted by THIS chart?             */

  var DISTRACTORS = [
    { text: 'Give furosemide 40 mg IV push', tokens: ['furosemide', 'lasix'] },
    { text: 'Transfuse 2 units of packed red blood cells', tokens: ['prbc', 'packed red', 'transfus'] },
    { text: 'Insert a nasogastric tube to low intermittent suction', tokens: ['nasogastric', 'ng tube', 'suction'] },
    { text: 'Start a heparin infusion', tokens: ['heparin'] },
    { text: 'Give morphine 2 mg IV for pain', tokens: ['morphine'] },
    { text: 'Give mannitol 20% IV', tokens: ['mannitol'] },
    { text: 'Run a 1 L normal saline bolus', tokens: ['sodium chloride', 'normal saline', 'saline', 'bolus'] },
    { text: 'Keep the patient NPO', tokens: ['npo', 'nothing by mouth'] },
    { text: 'Obtain a STAT 12-lead ECG', tokens: ['ekg', 'ecg', '12-lead', 'electrocardio'] },
    { text: 'Give ondansetron 4 mg IV for nausea', tokens: ['ondansetron', 'zofran'] },
    { text: 'Give lactulose 30 mL PO', tokens: ['lactulose'] },
    { text: 'Give acetaminophen 650 mg PO', tokens: ['acetaminophen', 'tylenol'] },
    { text: 'Titrate oxygen by nasal cannula to the ordered target', tokens: ['oxygen', 'nasal cannula', 'o2 '] },
    { text: 'Draw blood cultures before the first antibiotic', tokens: ['culture'] },
    { text: 'Give vancomycin 1 g IV', tokens: ['vancomycin'] },
    { text: 'Give cefepime 2 g IV', tokens: ['cefepime'] },
    { text: 'Raise the head of the bed to 30 degrees', tokens: ['head of bed', 'fowler', '30 degrees', 'hob'] },
    { text: 'Insert an indwelling urinary catheter', tokens: ['catheter', 'foley'] },
    { text: 'Give enoxaparin 40 mg subcutaneously', tokens: ['enoxaparin', 'lovenox'] },
    { text: 'Start a norepinephrine infusion', tokens: ['norepinephrine', 'levophed', 'vasopress'] },
    { text: 'Give albuterol by nebulizer', tokens: ['albuterol', 'nebuliz'] },
    { text: 'Give pantoprazole 80 mg IV', tokens: ['pantoprazole', 'protonix'] },
    { text: 'Transfuse fresh frozen plasma', tokens: ['plasma', 'ffp'] },
    { text: 'Send a STAT lactate', tokens: ['lactate'] },
    { text: 'Place the patient on continuous cardiac monitoring', tokens: ['cardiac monitor', 'telemetry'] },
    { text: 'Give a 20% mannitol infusion over 30 minutes', tokens: ['mannitol'] },
    { text: 'Start hourly neurologic checks', tokens: ['neuro check', 'neurologic check'] },
    { text: 'Order a STAT CT of the head', tokens: ['ct head', 'head ct'] }
  ];

  /** Distractors that collide with nothing already written in the chart. */
  function safeDistractors(haystackLines, seed, count) {
    var hay = ' ' + lower(arr(haystackLines).join(' | ')) + ' ';
    var free = DISTRACTORS.filter(function (d) {
      var i;
      for (i = 0; i < d.tokens.length; i++) {
        if (hay.indexOf(d.tokens[i]) !== -1) { return false; }
      }
      return true;
    });
    return seededOrder(free, seed).slice(0, numOr(count, 4));
  }

  function buildOrderCheck(topic) {
    var t = obj(topic);
    var tid = str(t.topic_id);
    var allOrders = arr(t.orders).map(function (o) { return str(o).trim(); })
                                 .filter(function (o) { return !!o; });
    if (!allOrders.length) {
      return { ok: false, id: 'ordercheck', why: 'This chart carries no order list at all.' };
    }
    var real = realLines(allOrders);
    var practice = metaLines(allOrders);
    /* Every "yes" item is an order line, VERBATIM. Nothing is paraphrased -
       the checkoff will hand the student the same sentence. */
    var yes = (real.length ? real : practice).slice(0, 6).map(function (o) {
      return {
        text: o, inChart: true, verbatim: true,
        source: real.length ? 'orders' : 'practice-example line'
      };
    });
    var no = safeDistractors(allOrders.concat(arr(t.mar)), tid + ':orders', 4)
      .map(function (d) {
        return { text: d.text, inChart: false, verbatim: false, source: 'not written anywhere in this chart' };
      });
    return {
      ok: true, id: 'ordercheck', tag: 'meds_orders',
      prompt: 'One action at a time: is it written in THIS chart\'s orders? Not "is it reasonable" - ' +
              'is it ordered. A medication with no order and no MAR branch is a call to the provider, ' +
              'not a dose.',
      orders: allOrders,
      hasRealOrders: real.length > 0,
      practiceOnly: real.length === 0,
      items: seededOrder(yes.concat(no), tid + ':oc')
    };
  }

  /* ---------------------------------------------------------------- 10.4 */
  /* ALREADY DONE - what does the MAR say was actually given?                */

  function buildAlreadyDone(topic) {
    var t = obj(topic);
    var tid = str(t.topic_id);
    var allMar = arr(t.mar).map(function (m) { return str(m).trim(); })
                           .filter(function (m) { return !!m; });
    var given = realLines(allMar).map(function (m) {
      var s = splitTimed(m);
      return { text: m, at: s.at, body: s.text, given: true };
    });
    var notes = metaLines(allMar);
    /* Distractors must not collide with the MAR OR the orders, or "not given
       yet" becomes ambiguous with "ordered but not given". */
    var no = safeDistractors(allMar.concat(arr(t.orders)), tid + ':mar', given.length ? 4 : 5)
      .map(function (d) { return { text: d.text, at: '', body: d.text, given: false }; });

    return {
      ok: true, id: 'alreadydone', tag: 'meds_orders',
      prompt: given.length
        ? 'Before you give anything, you read the MAR. Which of these has ALREADY been given to ' +
          'this patient on this sheet?'
        : 'This MAR records nothing as administered. That is the answer to the drill, and it is ' +
          'the answer you would give at the bedside: check the MAR, then say what you found.',
      mar: allMar, given: given, notes: notes,
      emptyMar: given.length === 0,
      items: seededOrder(given.concat(no), tid + ':ad')
    };
  }

  /* ---------------------------------------------------------------- 10.5 */
  /* ABG SPRINT - reads the gas out of `labs`; borrows one when there is none */

  function abgFrom(topic) {
    var t = obj(topic);
    var get = function (name) {
      var hit = arr(t.labs).filter(function (l) {
        return lower(obj(l).test).replace(/\s+/g, '') === name;
      });
      return hit.length ? hit[0] : null;
    };
    var ph = get('ph'), co2 = get('paco2'), o2 = get('pao2'), hco3 = get('hco3');
    if (!ph || !co2) { return null; }
    return {
      topicId: str(t.topic_id), title: str(t.title),
      ph: ph, paco2: co2, pao2: o2, hco3: hco3,
      phN: firstNum(ph.result), co2N: firstNum(co2.result),
      o2N: o2 ? firstNum(o2.result) : null,
      hco3N: hco3 ? firstNum(hco3.result) : null
    };
  }
  function interpretAbg(g) {
    var a = obj(g);
    var ph = numOr(a.phN, null), co2 = numOr(a.co2N, null), hco3 = numOr(a.hco3N, null);
    var acid = ph !== null && ph < 7.35;
    var alk = ph !== null && ph > 7.45;
    var primary = 'uncertain';
    if (ph === null || co2 === null) {
      primary = 'uncertain';
    } else if (acid) {
      primary = co2 > 45 ? 'respiratory acidosis'
        : (hco3 !== null && hco3 < 22 ? 'metabolic acidosis' : 'acidosis');
    } else if (alk) {
      primary = co2 < 35 ? 'respiratory alkalosis'
        : (hco3 !== null && hco3 > 26 ? 'metabolic alkalosis' : 'alkalosis');
    } else {
      primary = 'pH within range';
    }
    var comp = 'uncompensated';
    if (ph !== null && !acid && !alk && co2 !== null && (co2 < 35 || co2 > 45)) {
      comp = 'fully compensated';
    } else if ((acid || alk) && hco3 !== null && co2 !== null) {
      var respPrimary = primary.indexOf('respiratory') === 0;
      if (respPrimary && ((co2 > 45 && hco3 > 26) || (co2 < 35 && hco3 < 22))) {
        comp = 'partially compensated';
      } else if (!respPrimary && ((hco3 < 22 && co2 < 35) || (hco3 > 26 && co2 > 45))) {
        comp = 'partially compensated';
      }
    }
    var oxy = 'not measured';
    if (a.o2N !== null && a.o2N !== undefined) {
      var o = numOr(a.o2N, 0);
      oxy = o < 60 ? 'severe hypoxemia' : (o < 80 ? 'hypoxemia' : 'adequate oxygenation');
    }
    return { primary: primary, compensation: comp, oxygenation: oxy };
  }

  function buildAbgSprint(topic) {
    var own = abgFrom(topic);
    var borrowed = null;
    if (!own) {
      /* The spec calls out ARDS and PE for this drill; look for any charted gas
         and prefer those two, but only ever from real scenario data. */
      var pool = allTopics().filter(function (t) { return !!abgFrom(t); });
      var pref = pool.filter(function (t) {
        var id = str(t.topic_id);
        return id === 'ards' || id === 'pulmonary_embolism';
      });
      var pick = (pref.length ? pref : pool)[0];
      if (pick) { borrowed = abgFrom(pick); }
    }
    var gas = own || borrowed;
    if (!gas) {
      return { ok: false, id: 'abg', why: 'No chart in this section carries an arterial blood gas.' };
    }
    var truth = interpretAbg(gas);
    return {
      ok: true, id: 'abg', tag: 'labs',
      borrowed: !own,
      sourceTopicId: gas.topicId, sourceTitle: gas.title,
      prompt: own
        ? 'Read this gas the way you will have to read it out loud. Three answers, thirty seconds.'
        : 'This chart carries no ABG. The gas below is the real one from ' + gas.title +
          ' - it is that chart\'s value, not this one\'s.',
      gas: gas, truth: truth,
      steps: [
        { key: 'primary', q: 'What is the primary disturbance?',
          choices: ['respiratory acidosis', 'respiratory alkalosis', 'metabolic acidosis',
                    'metabolic alkalosis', 'pH within range'],
          answer: truth.primary },
        { key: 'compensation', q: 'How compensated is it?',
          choices: ['uncompensated', 'partially compensated', 'fully compensated'],
          answer: truth.compensation },
        { key: 'oxygenation', q: 'What about oxygenation?',
          choices: ['severe hypoxemia', 'hypoxemia', 'adequate oxygenation', 'not measured'],
          answer: truth.oxygenation }
      ]
    };
  }

  /* ---------------------------------------------------------------- 10.6 */
  /* SHOCK TYPE MATCH                                                        */

  var SHOCK_TYPES = [
    { key: 'hypovolemic', label: 'Hypovolemic', hint: 'lost volume - blood, plasma, or fluid' },
    { key: 'distributive', label: 'Distributive / septic', hint: 'the pipes dilate; volume is in the wrong place' },
    { key: 'obstructive', label: 'Obstructive', hint: 'something mechanical blocks flow through the pump' },
    { key: 'cardiogenic', label: 'Cardiogenic', hint: 'the pump itself fails' }
  ];
  var SHOCK_KEYWORDS = [
    { key: 'hypovolemic', re: /hypovolem/i, from: 'stated' },
    { key: 'distributive', re: /septic shock|distributive/i, from: 'stated' },
    { key: 'obstructive', re: /obstructive shock/i, from: 'stated' },
    { key: 'cardiogenic', re: /cardiogenic/i, from: 'stated' },
    { key: 'hypovolemic', re: /hemorrhag|gi bleed|blood loss|hematemesis/i, from: 'inferred' },
    { key: 'distributive', re: /\bsepsis\b|septic|anaphyla/i, from: 'inferred' },
    { key: 'obstructive', re: /pulmonary embol|tamponade|tension pneumothorax/i, from: 'inferred' },
    { key: 'cardiogenic', re: /heart failure|cardiac failure|myocardial infarct/i, from: 'inferred' }
  ];
  /**
   * shockTypeOf(topic) -> {key, from} | null
   * `from:'stated'` means the school text names the shock type itself, which is
   * the only authority that matters. `from:'inferred'` is a textbook
   * classification of the topic and is labelled as such on the card, because a
   * classification is an explanation and never a chart fact (SOURCE_RULES 4).
   */
  function shockTypeOf(topic) {
    var t = obj(topic);
    var text = str(t.title) + ' ' + str(t.case_intro) + ' ' +
               arr(t.deterioration_cues).join(' ');
    var i;
    for (i = 0; i < SHOCK_KEYWORDS.length; i++) {
      if (SHOCK_KEYWORDS[i].re.test(text)) {
        return { key: SHOCK_KEYWORDS[i].key, from: SHOCK_KEYWORDS[i].from };
      }
    }
    return null;
  }

  function buildShockMatch(topic) {
    var here = obj(topic);
    var cards = [];
    allTopics().forEach(function (t) {
      var st = shockTypeOf(t);
      if (!st) { return; }
      cards.push({
        topicId: str(t.topic_id), title: str(t.title),
        stem: firstSentence(t.case_intro, 170),
        answer: st.key, from: st.from,
        provenance: str(t.provenance)
      });
    });
    if (cards.length < 2) {
      return { ok: false, id: 'shock', why: 'Not enough charts in this section name or imply a shock state.' };
    }
    var mine = cards.filter(function (c) { return c.topicId === str(here.topic_id); });
    var others = cards.filter(function (c) { return c.topicId !== str(here.topic_id); });
    var deck = mine.concat(seededOrder(others, str(here.topic_id) + ':shock')).slice(0, 5);
    return {
      ok: true, id: 'shock', tag: 'prioritization',
      prompt: 'Four shock states, and the treatment for one of them will kill a patient in another. ' +
              'Match each case to its state.',
      types: SHOCK_TYPES, cards: deck,
      thisTopicHasShock: mine.length > 0
    };
  }

  /* ---------------------------------------------------------------- 10.7 */
  /* SBAR BUILDER - graded on completeness, never on wording                 */

  var SBAR_LETTERS = [
    { key: 'S', label: 'Situation', ask: 'Who is this, and what is wrong right now?' },
    { key: 'B', label: 'Background', ask: 'What brought them here and what has already been done?' },
    { key: 'A', label: 'Assessment', ask: 'What did YOU find - numbers, not adjectives.' },
    { key: 'R', label: 'Recommendation', ask: 'What do you want, and how soon?' }
  ];
  /** Key elements of an expected SBAR line: distinctive words + numbers. */
  function sbarElements(line) {
    var body = str(line).replace(/^\s*[SBAR]\s*[:.-]\s*/i, '');
    var words = distinctWords(body).filter(function (w) { return w.length >= 5; });
    var nums = numbersIn(body);
    return uniq(nums.concat(words)).slice(0, 12);
  }
  function buildSbar(topic) {
    var t = obj(topic);
    var expected = arr(t.sbar_expected).map(function (x) { return str(x); })
                                       .filter(function (x) { return !!x; });
    if (!expected.length) {
      return { ok: false, id: 'sbar', why: 'This chart carries no expected SBAR to grade against.' };
    }
    var letters = SBAR_LETTERS.map(function (L, i) {
      var line = expected.filter(function (x) {
        return new RegExp('^\\s*' + L.key + '\\s*[:.-]', 'i').test(x);
      })[0] || expected[i] || '';
      return {
        key: L.key, label: L.label, ask: L.ask,
        expected: line, elements: sbarElements(line)
      };
    });
    return {
      ok: true, id: 'sbar', tag: 'sbar',
      prompt: 'Build the call. You are graded on whether the information is THERE, never on the ' +
              'words you chose - say it however you say it.',
      letters: letters, expected: expected
    };
  }
  /** gradeSbar(drill, answers) -> per-letter coverage. Pure. */
  function gradeSbar(drill, answers) {
    var d = obj(drill), a = obj(answers);
    var rows = arr(d.letters).map(function (L) {
      var text = ' ' + lower(a[L.key]).replace(/[^a-z0-9.%<>/ -]+/g, ' ') + ' ';
      var hit = [], missed = [];
      arr(L.elements).forEach(function (el) {
        if (text.indexOf(lower(el)) !== -1) { hit.push(el); } else { missed.push(el); }
      });
      var need = arr(L.elements).length;
      var cov = need ? Math.round((hit.length / need) * 100) : (str(a[L.key]).trim() ? 100 : 0);
      return {
        key: L.key, label: L.label, coverage: cov, hit: hit, missed: missed,
        empty: !str(a[L.key]).trim(),
        ok: !!str(a[L.key]).trim() && cov >= 50
      };
    });
    var okCount = rows.filter(function (r) { return r.ok; }).length;
    return {
      rows: rows,
      complete: rows.length > 0 && okCount === rows.length,
      coverage: rows.length ? Math.round(rows.reduce(function (s, r) { return s + r.coverage; }, 0) / rows.length) : 0
    };
  }

  /* ---------------------------------------------------------------- 10.8 */
  /* LOOK-ALIKE COMPARE                                                      */

  var LOOKALIKE_GROUPS = [
    { id: 'resp', label: 'Pneumonia vs ARDS vs heart failure vs PE',
      members: ['pneumonia', 'ards', 'heart_failure', 'pulmonary_embolism'] },
    { id: 'coag', label: 'Sepsis vs DIC', members: ['sepsis', 'dic'] },
    { id: 'abdo', label: 'Appendicitis vs bowel obstruction',
      members: ['appendicitis', 'bowel_obstruction'] }
  ];
  function groupsFor(topicId) {
    var id = str(topicId);
    return LOOKALIKE_GROUPS.filter(function (g) { return g.members.indexOf(id) !== -1; });
  }
  /** Findings that belong to exactly one member of the group. */
  function discriminators(members) {
    var rows = [];
    members.forEach(function (t) {
      var tid = str(obj(t).topic_id);
      arr(obj(t).initial_findings).forEach(function (f) {
        rows.push({ topicId: tid, text: str(f), from: 'initial findings' });
      });
      arr(obj(t).diagnostics).forEach(function (f) {
        rows.push({ topicId: tid, text: str(f), from: 'diagnostics' });
      });
      arr(obj(t).labs).forEach(function (l) {
        var lab = obj(l);
        if (labUrgency(lab) >= 2) {
          rows.push({ topicId: tid, from: 'labs',
            text: str(lab.test) + ' ' + str(lab.result) + ' (' + str(lab.interpretation) + ')' });
        }
      });
    });
    /* A finding is a discriminator only if its distinctive words do not also
       appear under another member. */
    return rows.filter(function (r) {
      if (str(r.text).length < 12) { return false; }
      var mine = distinctWords(r.text);
      if (!mine.length) { return false; }
      var clash = rows.filter(function (o) {
        if (o.topicId === r.topicId) { return false; }
        var lo = ' ' + lower(o.text) + ' ';
        var shared = mine.filter(function (w) { return lo.indexOf(w) !== -1; });
        return shared.length >= Math.max(1, Math.ceil(mine.length * 0.5));
      });
      return clash.length === 0;
    });
  }

  function buildLookAlike(topic) {
    var here = obj(topic);
    var gs = groupsFor(here.topic_id);
    var group = gs.length ? gs[0] : LOOKALIKE_GROUPS[0];
    var members = arr(group.members).map(topicById).filter(function (t) { return !!t; });
    if (members.length < 2) {
      return { ok: false, id: 'lookalike', why: 'The look-alike partners for this topic are not loaded.' };
    }
    var disc = discriminators(members);
    var items = seededOrder(disc, str(here.topic_id) + ':la').slice(0, 6);
    return {
      ok: true, id: 'lookalike', tag: 'assessment',
      inGroup: gs.length > 0,
      group: group,
      members: members.map(function (t) {
        return {
          topicId: str(t.topic_id), title: str(t.title), provenance: str(t.provenance),
          findings: arr(t.initial_findings).slice(0, 6),
          cues: arr(t.deterioration_cues).slice(0, 5),
          diagnostics: arr(t.diagnostics).slice(0, 3),
          topLabs: arr(t.labs).map(function (l, i) { return { lab: l, s: labScore(l), i: i }; })
            .sort(function (a, b) { return b.s - a.s; }).slice(0, 4)
            .map(function (x) { return x.lab; })
        };
      }),
      prompt: items.length
        ? 'One finding at a time. Which of these charts does it belong to? These are the ' +
          'discriminators - the findings that appear in exactly one of them.'
        : 'These charts overlap too much to pull clean discriminators automatically. ' +
          'Use the side-by-side below.',
      items: items
    };
  }

  function buildDrill(id, topic) {
    switch (str(id)) {
      case 'trend': return buildTrendSpotter(topic);
      case 'labtriage': return buildLabTriage(topic);
      case 'ordercheck': return buildOrderCheck(topic);
      case 'alreadydone': return buildAlreadyDone(topic);
      case 'abg': return buildAbgSprint(topic);
      case 'shock': return buildShockMatch(topic);
      case 'sbar': return buildSbar(topic);
      case 'lookalike': return buildLookAlike(topic);
      default: return { ok: false, id: str(id), why: 'Unknown drill.' };
    }
  }

  /* ==========================================================================
   * 11. PARTNER LAYER (entirely optional)
   * --------------------------------------------------------------------------
   * js/simprep-partner.js may publish window.MM.simprepPartner with
   * {createRoom, joinRoom, leaveRoom, subscribe, setActivity, publish, onEvent,
   *  getRoom, isHost}. Every one of those is called through a guard: if the file
   *  never loaded, if it loaded and threw, or if it exposes a different subset,
   *  Study Mode behaves exactly as it does solo and says nothing about it.
   * ======================================================================== */

  function partnerApi() {
    var p = MMx().simprepPartner;
    return (p && typeof p === 'object') ? p : null;
  }
  function callPartner(name, a, b) {
    var p = partnerApi();
    if (!p || !isFn(p[name])) { return null; }
    try { return p[name](a, b); } catch (e) { return null; }
  }

  /**
   * usePartner(activity) -> {available, room, peers, events, publish}
   * Subscribes while mounted, unsubscribes on unmount, and never lets a partner
   * error escape into the render tree.
   */
  function usePartner(activity) {
    var api = partnerApi();
    var availH = useState(!!api);
    var available = availH[0], setAvailable = availH[1];
    var roomH = useState(function () { return callPartner('getRoom') || null; });
    var room = roomH[0], setRoom = roomH[1];
    var peersH = useState([]);
    var peers = peersH[0], setPeers = peersH[1];
    var feedH = useState([]);
    var feed = feedH[0], setFeed = feedH[1];
    var actRef = useRef('');

    useEffect(function () {
      var p = partnerApi();
      setAvailable(!!p);
      if (!p) { return undefined; }
      var offs = [];
      if (isFn(p.subscribe)) {
        try {
          var off = p.subscribe(function (state) {
            var s = obj(state);
            setRoom(s.room !== undefined ? s.room : (callPartner('getRoom') || null));
            setPeers(arr(s.peers || s.members || s.players));
          });
          if (isFn(off)) { offs.push(off); }
        } catch (e) {}
      }
      if (isFn(p.onEvent)) {
        try {
          var offE = p.onEvent(function (evt) {
            var e = obj(evt);
            setFeed(function (prev) {
              return arr(prev).concat([{
                at: numOr(e.at, nowMs()), kind: str(e.kind || e.type),
                who: cut(str(e.who || e.name || e.uid), 28),
                text: cut(str(e.text || e.label), 140)
              }]).slice(-12);
            });
          });
          if (isFn(offE)) { offs.push(offE); }
        } catch (e) {}
      }
      return function () {
        offs.forEach(function (f) { try { f(); } catch (e) {} });
      };
    }, []);

    /* Tell the room what this student is looking at, but only when it changes -
       a setActivity on every render would be a write storm. */
    useEffect(function () {
      var a = obj(activity);
      var sig = str(a.kind) + '|' + str(a.topicId) + '|' + str(a.mode);
      if (sig === actRef.current) { return; }
      actRef.current = sig;
      callPartner('setActivity', { kind: str(a.kind) || 'study', topicId: str(a.topicId), mode: str(a.mode) || 'study' });
    }, [obj(activity).kind, obj(activity).topicId, obj(activity).mode]);

    var publish = useCallback(function (kind, payload) {
      var p = obj(payload);
      callPartner('publish', {
        kind: str(kind), at: nowMs(), topicId: str(p.topicId),
        label: cut(str(p.label), 140), text: cut(str(p.text), 140),
        correct: p.correct === undefined ? null : !!p.correct,
        tag: str(p.tag), mode: 'study'
      });
    }, []);

    return {
      available: available, room: room, peers: arr(peers), events: arr(feed), publish: publish
    };
  }

  /* ==========================================================================
   * 12. SHARED UI
   * ======================================================================== */

  function Badge(props) {
    return ce('span', { className: 'sp-badge ' + (props.tone || '') }, props.children);
  }

  /** The provenance chip. Never rendered without its words. */
  function ProvBadge(props) {
    var m = provMeta(props.value);
    return ce('span', {
      className: 'sp-prov ' + m.cls,
      title: m.blurb,
      'aria-label': m.aria
    },
      ce('span', { className: 'g', 'aria-hidden': 'true' }, m.glyph),
      props.short ? m.label : (props.children || m.label));
  }

  /** The persistent supplemental warning. Rendered at the top of every screen
      that shows a supplemental topic, not once at the start. */
  function SupplementalBar(props) {
    if (!props.on) { return null; }
    return ce('div', { className: 'sp-suppbar', role: 'note' },
      ce('span', { 'aria-hidden': 'true' }, '◇'),
      ce('span', null, supplementalLabel()),
      ce('span', { style: { fontWeight: 400, opacity: 0.92 } },
        '- there is no school sheet behind this topic yet. Nothing here may be treated ' +
        'as a provider order for your checkoff.'));
  }

  /** "Not scored" chip - a disputed item that no override has settled. */
  function NotScored(props) {
    return ce('span', {
      className: 'sp-nosc',
      title: 'A source discrepancy touches this item. It is shown, and it is not scored, ' +
             'until an instructor override is recorded.'
    },
      ce('span', { 'aria-hidden': 'true' }, '⚠'),
      props.children || 'Not scored - source issue');
  }

  function Meter(props) {
    var v = clamp(numOr(props.value, 0), 0, 100);
    var cls = 'sp-meter' + (props.ready ? ' ready' : (v >= 55 ? ' near' : ''));
    return ce('div', {
      className: cls, role: 'img',
      'aria-label': str(props.label || 'progress') + ' ' + v + ' percent'
    }, ce('span', { style: { width: v + '%' } }));
  }

  function ConfPips(props) {
    var n = clamp(numOr(props.value, 0), 0, MAX_CONF);
    var pips = [];
    var i;
    for (i = 0; i < MAX_CONF; i++) {
      pips.push(ce('span', {
        key: i,
        className: 'sp-pip' + (i < n ? (n >= READY_CONF ? ' on' : ' mid') : '')
      }));
    }
    return ce('span', {
      className: 'sp-conf', role: 'img',
      'aria-label': 'confidence ' + n + ' of ' + MAX_CONF
    }, pips);
  }

  function ContentMissing(props) {
    var which = arr(props.missing);
    return ce('div', { className: 'sp-root t-m' },
      ce('div', { className: 'sp-empty' },
        ce('div', { style: { fontSize: '2.2rem', marginBottom: 10 } }, '📄'),
        ce('h2', { style: { fontSize: '1.05rem', marginBottom: 8, color: 'var(--text,#f1f5f9)' } },
          'Clinical Simulation Prep content failed to load'),
        ce('div', { style: { maxWidth: 480, margin: '0 auto 12px', lineHeight: 1.65 } },
          which.length
            ? ('These data files did not download: ' + which.join(', ') + '. ' +
               'Nothing else in the app is affected.')
            : 'The scenario data did not download. Nothing else in the app is affected.'),
        ce('div', { className: 'sp-dim', style: { maxWidth: 480, margin: '0 auto 14px' } },
          'Check your connection and reload. If it keeps happening your network may be ' +
          'blocking the script.'),
        ce('button', {
          type: 'button', className: 'sp-btn go',
          onClick: function () { try { window.location.reload(); } catch (e) {} }
        }, 'Reload')));
  }

  /** Accessibility toolbar. Every setting persists in progress.simprep.prefs. */
  function A11yBar(props) {
    var prefs = obj(props.prefs);
    var set = isFn(props.onSet) ? props.onSet : function () {};
    var sizes = [
      { k: 's', label: 'A', title: 'Small text' },
      { k: 'm', label: 'A', title: 'Normal text' },
      { k: 'l', label: 'A', title: 'Large text' },
      { k: 'xl', label: 'A', title: 'Extra large text' }
    ];
    var cur = str(prefs.textSize) || 'm';
    return ce('div', { className: 'sp-a11y', role: 'group', 'aria-label': 'Reading settings' },
      ce('span', { style: { fontWeight: 800, letterSpacing: '.4px' } }, 'READING'),
      sizes.map(function (s, i) {
        return ce('button', {
          key: s.k, type: 'button', className: 'sp-btn sm',
          'aria-pressed': cur === s.k ? 'true' : 'false',
          title: s.title, 'aria-label': s.title,
          style: { fontSize: (0.72 + i * 0.14) + 'em' },
          onClick: function () { set('textSize', s.k); }
        }, s.label);
      }),
      ce('button', {
        type: 'button', className: 'sp-btn sm',
        'aria-pressed': prefs.dyslexia ? 'true' : 'false',
        onClick: function () { set('dyslexia', !prefs.dyslexia); }
      }, 'Letter spacing'),
      ce('button', {
        type: 'button', className: 'sp-btn sm',
        'aria-pressed': prefs.contrast ? 'true' : 'false',
        onClick: function () { set('contrast', !prefs.contrast); }
      }, 'Extra contrast'));
  }

  function rootClass(prefs, extra) {
    var p = obj(prefs);
    return 'sp-root t-' + (str(p.textSize) || 'm') +
      (p.dyslexia ? ' sp-dys' : '') + (p.contrast ? ' sp-hc' : '') +
      (extra ? ' ' + extra : '');
  }

  /** Partner presence strip. Renders nothing at all when there is no room. */
  function PartnerStrip(props) {
    var p = obj(props.partner);
    if (!p.available || !p.room) { return null; }
    var peers = arr(p.peers);
    return ce('div', { className: 'sp-partner' },
      ce('span', { style: { fontWeight: 800 } }, 'Studying together'),
      peers.length
        ? peers.slice(0, 6).map(function (x, i) {
            var who = obj(x);
            return ce('span', { key: str(who.uid) || i, className: 'sp-who' },
              ce('span', { className: 'live', 'aria-hidden': 'true' }),
              cut(str(who.name || who.displayName || who.uid) || 'Partner', 22),
              str(who.topicId) ? ce('span', { className: 'sp-dim' }, ' · ' + cut(str(who.topicId), 18)) : null);
          })
        : ce('span', { className: 'sp-dim' }, 'waiting for your partner to join'),
      arr(p.events).length
        ? ce('span', { className: 'sp-dim', style: { flex: '1 1 100%' } },
            cut(str(arr(p.events)[arr(p.events).length - 1].who) + ' ' +
                str(arr(p.events)[arr(p.events).length - 1].text), 90))
        : null);
  }

  /* ==========================================================================
   * 13. SOURCE ISSUE PANEL + INSTRUCTOR OVERRIDE SCREEN
   * --------------------------------------------------------------------------
   * The panel is per topic and always present when the topic has discrepancies:
   * the school's sentence, verbatim, plus what it costs the student (the items
   * it touches are not scored) and the way out (an instructor override).
   *
   * The override form is the audit trail. It captures who said so, who typed it,
   * when, the ORIGINAL wording and the replacement, and it renders both from
   * then on - the original struck through, never gone.
   * ======================================================================== */

  function OverrideAudit(props) {
    var o = obj(props.record);
    if (!o.discrepancyId) { return null; }
    var hist = arr(o.history);
    return ce('dl', { className: 'sp-audit' },
      ce('dt', null, 'Original - school file'),
      ce('dd', null, ce('span', { className: 'sp-strike' }, str(o.originalText) || '(not recorded)')),
      ce('dt', null, 'Replacement - instructor'),
      ce('dd', null, str(o.replacementText) || '(no replacement text given)'),
      str(o.note) ? ce('dt', null, 'Note') : null,
      str(o.note) ? ce('dd', null, str(o.note)) : null,
      ce('dt', null, 'Attributed to'),
      ce('dd', null, str(o.instructorName) || '(unnamed instructor)'),
      ce('dt', null, 'Recorded by'),
      ce('dd', null,
        (str(o.recordedByName) || 'unknown') +
        (str(o.recordedByEmail) ? ' (' + str(o.recordedByEmail) + ')' : '') +
        ' · role: ' + (str(o.recordedByRole) || 'student')),
      ce('dt', null, 'Recorded at'),
      ce('dd', null, str(o.at)),
      ce('dt', null, 'Status'),
      ce('dd', null, o.active === false
        ? 'REVOKED - the school file applies again. The record is kept.'
        : 'ACTIVE - this outranks the school file.'),
      hist.length ? ce('dt', null, 'Earlier records (' + hist.length + ')') : null,
      hist.length ? ce('dd', null, hist.map(function (h, i) {
        return ce('div', { key: i, style: { marginTop: 4 } },
          str(obj(h).at) + ' · ' + cut(str(obj(h).replacementText), 90) +
          ' · ' + (str(obj(h).recordedByName) || 'unknown'));
      })) : null);
  }

  function OverrideForm(props) {
    var disc = obj(props.disc);
    var existing = obj(props.existing);
    var replH = useState(str(existing.replacementText));
    var repl = replH[0], setRepl = replH[1];
    var noteH = useState('');
    var note = noteH[0], setNote = noteH[1];
    var whoH = useState(str(existing.instructorName));
    var who = whoH[0], setWho = whoH[1];
    var origH = useState(str(existing.originalText) || str(disc.text));
    var orig = origH[0], setOrig = origH[1];

    function submit() {
      if (!str(repl).trim()) {
        toast('Type what the instructor said it should be.', 'warn');
        return;
      }
      if (!str(who).trim()) {
        toast('Name the instructor. An override with no name is not an audit trail.', 'warn');
        return;
      }
      if (isFn(props.onSave)) {
        props.onSave({
          discrepancyId: str(disc.id), topicId: str(disc.topicId),
          originalText: str(orig), replacementText: str(repl).trim(),
          note: str(note).trim(), instructorName: str(who).trim()
        });
      }
    }

    return ce('div', { className: 'sp-card', style: { marginTop: 10 } },
      ce('h3', null, 'Record an instructor override'),
      ce('p', { className: 'sp-sub' },
        'This outranks the school file from now on. It does not replace it: the original stays ' +
        'on screen, struck through, permanently.'),
      ce('label', { className: 'sp-lbl', htmlFor: 'spo-orig-' + disc.id }, 'Original - as the school file has it'),
      ce('textarea', {
        id: 'spo-orig-' + disc.id, className: 'sp-ta', value: orig,
        onChange: function (e) { setOrig(e.target.value); },
        'aria-describedby': 'spo-orighelp-' + disc.id
      }),
      ce('div', { id: 'spo-orighelp-' + disc.id, className: 'sp-dim' },
        'Pre-filled from the source note. Correct it to the sheet\'s exact wording if you have it in front of you.'),
      ce('label', { className: 'sp-lbl', htmlFor: 'spo-repl-' + disc.id }, 'Replacement - what the instructor said'),
      ce('textarea', {
        id: 'spo-repl-' + disc.id, className: 'sp-ta', value: repl,
        onChange: function (e) { setRepl(e.target.value); }
      }),
      ce('label', { className: 'sp-lbl', htmlFor: 'spo-who-' + disc.id }, 'Instructor'),
      ce('input', {
        id: 'spo-who-' + disc.id, className: 'sp-in', type: 'text', value: who,
        placeholder: 'Name of the instructor who said it',
        onChange: function (e) { setWho(e.target.value); }
      }),
      ce('label', { className: 'sp-lbl', htmlFor: 'spo-note-' + disc.id }, 'Note (optional)'),
      ce('input', {
        id: 'spo-note-' + disc.id, className: 'sp-in', type: 'text', value: note,
        placeholder: 'Where and when they said it - post-conference, email, lab brief',
        onChange: function (e) { setNote(e.target.value); }
      }),
      props.canVerify ? null : ce('div', { className: 'sp-note', style: { marginTop: 10 } },
        'You are not signed in as an instructor account, so this is recorded as ' +
        'STUDENT-ENTERED and attributed to the instructor you name. It still unlocks scoring ' +
        'for the disputed item, and the trail shows exactly who typed it.'),
      ce('div', { className: 'sp-row', style: { marginTop: 12 } },
        ce('button', { type: 'button', className: 'sp-btn go', onClick: submit }, 'Save override'),
        ce('button', {
          type: 'button', className: 'sp-btn ghost',
          onClick: function () { if (isFn(props.onCancel)) { props.onCancel(); } }
        }, 'Cancel')));
  }

  /**
   * SourceIssuePanel - one topic's discrepancies, the scoring consequence, and
   * the override screen.
   */
  function SourceIssuePanel(props) {
    var topic = obj(props.topic);
    var progress = props.progress;
    var discs = discrepanciesFor(topic);
    var openH = useState('');
    var open = openH[0], setOpen = openH[1];

    if (!discs.length) { return null; }

    return ce('div', { className: 'sp-card' },
      ce('div', { className: 'sp-row' },
        ce('h3', { style: { margin: 0 } }, '⚠  Source issue - verify with instructor'),
        ce('div', { className: 'sp-spacer' }),
        ce(Badge, { tone: 'warn' }, discs.length + ' ' + plural(discs.length, 'issue'))),
      ce('p', { className: 'sp-sub' },
        'These are printed exactly as the school sheet has them. Nothing here has been quietly ' +
        'repaired - noticing a bad line is a nursing skill, and you will meet the same sheet in ' +
        'the lab. Anything an unresolved issue touches is SHOWN but NOT SCORED.'),

      discs.map(function (d) {
        var rec = overrideRecord(progress, d.id);
        /* An override recorded in Simulation Mode settles the same issue. It
           has no audit record here, so it is shown as what it is. */
        var fromSim = (!rec || rec.active === false) ? interopOverride(progress, d.id) : null;
        var live = (rec && rec.active !== false) || !!fromSim;
        return ce('div', {
          key: d.id,
          className: 'sp-issue' + (live ? ' resolved' : ''),
          style: { marginTop: 10 }
        },
          ce('div', { className: 'sp-row' },
            ce(ProvBadge, { value: live ? 'instructor_override' : obj(topic).provenance, short: true }),
            live ? ce(Badge, { tone: 'vio' }, 'Override active') : ce(NotScored, null, 'Blocks scoring'),
            ce('div', { className: 'sp-spacer' }),
            ce(Badge, null, d.scope === 'document' ? 'Paperwork mismatch' : 'Chart item')),
          ce('div', { className: 'q' }, d.text),
          d.scope === 'document'
            ? ce('div', { className: 'sp-dim' },
                'This one is about the paperwork, not the patient data, so it does not block any ' +
                'item from being scored. It still needs verifying before your checkoff.')
            : null,
          rec ? ce(OverrideAudit, { record: rec }) : null,
          fromSim ? ce('dl', { className: 'sp-audit' },
            ce('dt', null, 'Override recorded in Simulation Mode'),
            ce('dd', null, str(obj(fromSim).text) || '(no replacement text recorded)'),
            ce('dt', null, 'Attributed to'),
            ce('dd', null, str(obj(fromSim).by) || '(unnamed)'),
            str(obj(fromSim).original) ? ce('dt', null, 'Original - school file') : null,
            str(obj(fromSim).original)
              ? ce('dd', null, ce('span', { className: 'sp-strike' }, str(obj(fromSim).original)))
              : null) : null,
          ce('div', { className: 'sp-row', style: { marginTop: 10 } },
            ce('button', {
              type: 'button', className: 'sp-btn sm',
              'aria-expanded': open === d.id ? 'true' : 'false',
              onClick: function () { setOpen(open === d.id ? '' : d.id); }
            }, rec ? 'Record a new override' : 'Record an instructor override'),
            live ? ce('button', {
              type: 'button', className: 'sp-btn sm danger',
              onClick: function () { if (isFn(props.onRevoke)) { props.onRevoke(d.id); } }
            }, 'Revoke (keeps the record)') : null),
          open === d.id
            ? ce(OverrideForm, {
                disc: d, existing: rec || {}, canVerify: !!props.canVerify,
                onCancel: function () { setOpen(''); },
                onSave: function (payload) {
                  if (isFn(props.onSave)) { props.onSave(payload); }
                  setOpen('');
                }
              })
            : null);
      }));
  }

  /**
   * Everything a screen needs to know about whether an item may be scored.
   * Returns {scored, disputes[], blocking[], resolvedBy[]}.
   */
  function scoreGate(topic, progress, subject) {
    var ds = disputesOn(topic, subject);
    var blocking = ds.filter(function (d) { return !isResolved(progress, d.id); });
    var resolved = ds.filter(function (d) { return isResolved(progress, d.id); });
    return {
      scored: blocking.length === 0,
      disputes: ds, blocking: blocking, resolvedBy: resolved
    };
  }

  /** Inline "this line is disputed" marker used beside chart items. */
  function DisputeMark(props) {
    var g = obj(props.gate);
    if (!arr(g.disputes).length) { return null; }
    if (arr(g.blocking).length) {
      return ce('span', { className: 'sp-row', style: { gap: 6 } },
        ce(NotScored, null),
        ce('span', { className: 'sp-dim' }, cut(arr(g.blocking)[0].text, 130)));
    }
    return ce('span', { className: 'sp-row', style: { gap: 6 } },
      ce(ProvBadge, { value: 'instructor_override', short: true }),
      ce('span', { className: 'sp-dim' }, 'settled by an override; the original is in the source panel'));
  }

  /* ==========================================================================
   * 14. DRILL COMPONENTS
   * --------------------------------------------------------------------------
   * Shared contract for all eight:
   *   props.topic     the scenario object
   *   props.drill     the object a build*() returned
   *   props.gate(txt) -> scoreGate() for one subject line
   *   props.onGraded({tag, correct, hinted, sure, label, scored, reason})
   * A drill NEVER writes progress itself; it reports and the page records. That
   * keeps the "disputed item is not scored" decision in exactly one place.
   * ======================================================================== */

  function DrillShell(props) {
    return ce('div', { className: 'sp-card' },
      ce('div', { className: 'sp-row' },
        ce('h3', { style: { margin: 0 } }, props.title),
        ce('div', { className: 'sp-spacer' }),
        ce(Badge, { tone: 'acc' }, tagLabel(props.tag)),
        props.right || null),
      props.prompt ? ce('p', { className: 'sp-sub' }, props.prompt) : null,
      props.children);
  }

  function DrillUnavailable(props) {
    return ce(DrillShell, { title: props.title, tag: props.tag },
      ce('div', { className: 'sp-note', style: { marginTop: 8 } }, str(props.why)));
  }

  function SureToggle(props) {
    return ce('button', {
      type: 'button', className: 'sp-btn sm',
      'aria-pressed': props.on ? 'true' : 'false',
      title: 'If you tick this and get it wrong, your confidence drops two points instead of one. ' +
             'That is the point - a confident miss is the dangerous one.',
      onClick: function () { if (isFn(props.onToggle)) { props.onToggle(!props.on); } }
    }, props.on ? "I'm sure ✓" : "I'm sure");
  }

  function Feedback(props) {
    if (!props.show) { return null; }
    var tone = props.correct ? 'good' : (props.partial ? 'mid' : 'bad');
    return ce('div', { className: 'sp-fb ' + tone, style: { marginTop: 10 }, role: 'status' },
      ce('b', null, props.title ||
        (props.correct ? 'Right' : (props.partial ? 'Partly' : 'Not this time'))),
      props.children);
  }

  /* --------------------------------------------------------------- 14.1 */
  function TrendSpotterDrill(props) {
    var d = obj(props.drill);
    var pickH = useState({});
    var pick = pickH[0], setPick = pickH[1];
    var doneH = useState(false);
    var done = doneH[0], setDone = doneH[1];
    var hintH = useState(false);
    var hint = hintH[0], setHint = hintH[1];
    var sureH = useState(false);
    var sure = sureH[0], setSure = sureH[1];
    var stableH = useState(false);
    var stable = stableH[0], setStable = stableH[1];

    if (!d.ok) {
      return ce(DrillUnavailable, { title: 'Trend Spotter', tag: 'deterioration', why: d.why });
    }
    var gate = isFn(props.gate) ? props.gate(arr(d.rows).map(function (r) {
      return keysOf(obj(r)).map(function (k) { return str(obj(r)[k]); }).join(' ');
    }).join(' ')) : { scored: true, blocking: [] };

    function toggle(k) {
      if (done) { return; }
      var next = shallow(pick);
      if (next[k]) { delete next[k]; } else { next[k] = 1; }
      setPick(next);
      setStable(false);
    }
    function check() {
      var chosen = stable ? [] : keysOf(pick);
      var want = arr(d.answers);
      var ok = chosen.length === want.length && want.filter(function (k) {
        return chosen.indexOf(k) !== -1;
      }).length === want.length;
      if (d.stable && stable) { ok = true; }
      setDone(true);
      if (isFn(props.onGraded)) {
        props.onGraded({
          tag: 'deterioration', correct: ok, hinted: hint, sure: sure,
          label: 'Trend Spotter', scored: gate.scored,
          reason: gate.scored ? '' : 'vital-sign row is under a source discrepancy'
        });
      }
      announce(ok ? 'Correct.' : 'Not correct. Review the reasons shown.', false);
    }
    function reset() { setPick({}); setDone(false); setHint(false); setStable(false); }

    var chosenNow = stable ? [] : keysOf(pick);
    var correctNow = chosenNow.length === arr(d.answers).length &&
      arr(d.answers).filter(function (k) { return chosenNow.indexOf(k) !== -1; }).length === arr(d.answers).length;
    if (d.stable && stable) { correctNow = true; }

    return ce(DrillShell, {
      title: 'Trend Spotter', tag: 'deterioration', prompt: d.prompt,
      right: ce(SureToggle, { on: sure, onToggle: setSure })
    },
      gate.scored ? null : ce('div', { style: { marginBottom: 8 } }, ce(DisputeMark, { gate: gate })),
      ce('div', { className: 'sp-scroll' },
        ce('table', { className: 'sp-tbl' },
          ce('thead', null, ce('tr', null,
            ce('th', null, 'Time'),
            arr(d.params).map(function (p) { return ce('th', { key: p.key }, p.label); }))),
          ce('tbody', null, arr(d.rows).map(function (r, i) {
            return ce('tr', { key: i },
              ce('td', null, ce('b', null, str(obj(r).time) || ('set ' + (i + 1)))),
              arr(d.params).map(function (p) {
                return ce('td', { key: p.key }, str(obj(r)[p.key]));
              }));
          })))),
      ce('div', { className: 'sp-col', style: { marginTop: 12 } },
        arr(d.params).map(function (p) {
          var cls = 'sp-opt';
          if (done) {
            if (p.worse && pick[p.key]) { cls += ' right'; }
            else if (!p.worse && pick[p.key]) { cls += ' wrong'; }
            else if (p.worse && !pick[p.key]) { cls += ' miss'; }
          }
          return ce('button', {
            key: p.key, type: 'button', className: cls, disabled: done,
            'aria-pressed': pick[p.key] ? 'true' : 'false',
            onClick: function () { toggle(p.key); }
          },
            ce('span', { className: 'mk', 'aria-hidden': 'true' },
              done ? (p.worse ? '↯' : '·') : (pick[p.key] ? '✓' : '')),
            ce('span', { className: 'tx' }, p.label,
              ce('span', { className: 'sub' },
                p.firstRaw + '  →  ' + p.lastRaw +
                (done ? (p.worse ? '  ·  ' + p.why : '  ·  not moving the wrong way') : ''))));
        }),
        ce('button', {
          type: 'button',
          className: 'sp-opt' + (done && d.stable && stable ? ' right' : (done && stable ? ' wrong' : '')),
          disabled: done, 'aria-pressed': stable ? 'true' : 'false',
          onClick: function () { if (!done) { setStable(!stable); setPick({}); } }
        },
          ce('span', { className: 'mk', 'aria-hidden': 'true' }, stable ? '✓' : ''),
          ce('span', { className: 'tx' }, d.stableLabel))),

      ce('div', { className: 'sp-row', style: { marginTop: 12 } },
        done
          ? ce('button', { type: 'button', className: 'sp-btn', onClick: reset }, 'Again')
          : ce('button', { type: 'button', className: 'sp-btn go', onClick: check }, 'Check'),
        !done ? ce('button', {
          type: 'button', className: 'sp-btn ghost',
          onClick: function () { setHint(true); }
        }, 'Hint') : null),
      hint && !done ? ce('div', { className: 'sp-note', style: { marginTop: 8 } },
        'Read down each column, not across each row. ' + arr(d.answers).length + ' ' +
        plural(arr(d.answers).length, 'parameter') + ' ' +
        (arr(d.answers).length === 1 ? 'is' : 'are') + ' moving the wrong way. ' +
        'A hint means this one will not raise your confidence.') : null,
      ce(Feedback, { show: done, correct: correctNow },
        ce('div', null, arr(d.params).filter(function (p) { return p.worse; }).length
          ? arr(d.params).filter(function (p) { return p.worse; }).map(function (p) {
              return ce('div', { key: p.key }, '• ' + p.label + ': ' + p.firstRaw + ' → ' +
                p.lastRaw + ' - ' + p.why);
            })
          : 'Nothing is moving the wrong way in this pair of sets.'),
        arr(d.cues).length
          ? ce('div', { style: { marginTop: 8 } },
              ce('b', null, 'What this chart says to watch for'),
              arr(d.cues).map(function (c, i) { return ce('div', { key: i }, '• ' + str(c)); }))
          : null));
  }

  /* --------------------------------------------------------------- 14.2 */
  function LabTriageDrill(props) {
    var d = obj(props.drill);
    var pickH = useState({});
    var pick = pickH[0], setPick = pickH[1];
    var doneH = useState(false);
    var done = doneH[0], setDone = doneH[1];
    var hintH = useState(false);
    var hint = hintH[0], setHint = hintH[1];
    var sureH = useState(false);
    var sure = sureH[0], setSure = sureH[1];

    if (!d.ok) {
      return ce(DrillUnavailable, { title: 'Lab Triage', tag: 'labs', why: d.why });
    }
    var chosen = keysOf(pick);
    function toggle(i) {
      if (done) { return; }
      var k = String(i);
      var next = shallow(pick);
      if (next[k]) { delete next[k]; }
      else if (keysOf(next).length < numOr(d.pickCount, 3)) { next[k] = 1; }
      else { toast('Three only. Which one are you dropping?', 'info'); return; }
      setPick(next);
    }
    function check() {
      var ok = chosen.length === numOr(d.pickCount, 3) && chosen.filter(function (k) {
        return arr(d.answers).indexOf(parseInt(k, 10)) !== -1;
      }).length === chosen.length;
      /* Grade every pick against its own row, so one disputed lab withholds the
         whole item rather than quietly scoring around it. */
      var anyBlocked = false;
      chosen.forEach(function (k) {
        var item = arr(d.items)[parseInt(k, 10)];
        var g = isFn(props.gate)
          ? props.gate(str(obj(item).test) + ' ' + str(obj(item).result) + ' ' + str(obj(item).interpretation))
          : { scored: true };
        if (!g.scored) { anyBlocked = true; }
      });
      setDone(true);
      if (isFn(props.onGraded)) {
        props.onGraded({
          tag: 'labs', correct: ok, hinted: hint, sure: sure, label: 'Lab Triage',
          scored: !anyBlocked,
          reason: anyBlocked ? 'one of the chosen labs is under a source discrepancy' : ''
        });
      }
    }

    return ce(DrillShell, {
      title: 'Lab Triage', tag: 'labs', prompt: d.prompt,
      right: ce(SureToggle, { on: sure, onToggle: setSure })
    },
      ce('div', { className: 'sp-col' }, arr(d.items).map(function (it) {
        var k = String(it.idx);
        var isAns = arr(d.answers).indexOf(it.idx) !== -1;
        var g = isFn(props.gate)
          ? props.gate(it.test + ' ' + it.result + ' ' + it.interpretation)
          : { scored: true, disputes: [] };
        var cls = 'sp-opt';
        if (done) {
          if (isAns && pick[k]) { cls += ' right'; }
          else if (!isAns && pick[k]) { cls += ' wrong'; }
          else if (isAns) { cls += ' miss'; }
        }
        return ce('button', {
          key: k, type: 'button', className: cls, disabled: done,
          'aria-pressed': pick[k] ? 'true' : 'false',
          onClick: function () { toggle(it.idx); }
        },
          ce('span', { className: 'mk', 'aria-hidden': 'true' }, pick[k] ? '✓' : ''),
          ce('span', { className: 'tx' },
            ce('b', null, it.test + '  ' + it.result),
            ce('span', { className: 'sub' }, it.interpretation ||
              'no interpretation printed on the sheet'),
            arr(g.disputes).length
              ? ce('span', { className: 'sub' }, ce(DisputeMark, { gate: g }))
              : null));
      })),
      ce('div', { className: 'sp-row', style: { marginTop: 12 } },
        done
          ? ce('button', {
              type: 'button', className: 'sp-btn',
              onClick: function () { setPick({}); setDone(false); setHint(false); }
            }, 'Again')
          : ce('button', {
              type: 'button', className: 'sp-btn go',
              disabled: chosen.length !== numOr(d.pickCount, 3), onClick: check
            }, 'Check (' + chosen.length + '/' + numOr(d.pickCount, 3) + ')'),
        !done ? ce('button', {
          type: 'button', className: 'sp-btn ghost', onClick: function () { setHint(true); }
        }, 'Hint') : null),
      hint && !done ? ce('div', { className: 'sp-note', style: { marginTop: 8 } },
        'Rank by what kills first: oxygenation and perfusion before renal function, ' +
        'and a value the sheet calls "severely" anything goes first.') : null,
      ce(Feedback, {
        show: done,
        correct: chosen.length === numOr(d.pickCount, 3) && chosen.filter(function (k) {
          return arr(d.answers).indexOf(parseInt(k, 10)) !== -1;
        }).length === chosen.length
      },
        ce('div', null, 'Ranked by urgency from this chart:'),
        arr(d.ranked).slice(0, 5).map(function (r, i) {
          return ce('div', { key: r.idx },
            (i + 1) + '. ' + r.test + ' ' + r.result +
            (r.interpretation ? ' - ' + r.interpretation : ''));
        })));
  }

  /* --------------------------------------------------------------- 14.3 */
  /** Shared yes/no runner for Order vs No Order and Already Done. */
  function YesNoDrill(props) {
    var d = obj(props.drill);
    var items = arr(d.items);
    var iH = useState(0);
    var i = iH[0], setI = iH[1];
    var ansH = useState(null);
    var ans = ansH[0], setAns = ansH[1];
    var hintH = useState(false);
    var hint = hintH[0], setHint = hintH[1];
    var sureH = useState(false);
    var sure = sureH[0], setSure = sureH[1];
    var scoreH = useState({ n: 0, right: 0 });
    var score = scoreH[0], setScore = scoreH[1];

    if (!items.length) {
      return ce(DrillUnavailable, { title: props.title, tag: props.tag,
        why: str(d.why) || 'Nothing in this chart to build this drill from.' });
    }
    var item = obj(items[clamp(i, 0, items.length - 1)]);
    var truth = props.truthKey === 'given' ? !!item.given : !!item.inChart;
    var gate = isFn(props.gate) ? props.gate(str(item.text)) : { scored: true, disputes: [] };

    function answer(saidYes) {
      if (ans !== null) { return; }
      var ok = saidYes === truth;
      setAns(saidYes);
      setScore({ n: score.n + 1, right: score.right + (ok ? 1 : 0) });
      if (isFn(props.onGraded)) {
        props.onGraded({
          tag: props.tag, correct: ok, hinted: hint, sure: sure,
          label: props.title + ': ' + cut(str(item.text), 60),
          scored: gate.scored,
          reason: gate.scored ? '' : 'this line is under a source discrepancy'
        });
      }
      announce(ok ? 'Correct.' : 'Incorrect.', false);
    }
    function next() {
      setAns(null); setHint(false);
      setI(i + 1 >= items.length ? 0 : i + 1);
    }

    return ce(DrillShell, {
      title: props.title, tag: props.tag, prompt: d.prompt,
      right: ce('span', { className: 'sp-row', style: { gap: 6 } },
        ce(SureToggle, { on: sure, onToggle: setSure }),
        ce(Badge, null, score.right + '/' + score.n))
    },
      d.practiceOnly ? ce('div', { className: 'sp-suppbar', style: { marginBottom: 10 } },
        ce('span', { 'aria-hidden': 'true' }, '◇'),
        ce('span', null, 'This chart has no school order list - the "in the chart" line below is a ' +
          'practice example, quoted verbatim. Substitute your school sheet when you get one.')) : null,
      d.emptyMar ? ce('div', { className: 'sp-note', style: { marginBottom: 10 } },
        'This MAR records nothing as administered' +
        (arr(d.notes).length ? ': "' + cut(arr(d.notes)[0], 190) + '"' : '.') +
        ' Every answer below is therefore "no".') : null,

      ce('div', { className: 'sp-card', style: { background: 'var(--surface2,#273549)' } },
        ce('div', { className: 'sp-row' },
          ce(ProvBadge, { value: truth ? obj(props.topic).provenance : 'generated_supplemental_practice', short: true }),
          truth
            ? ce(Badge, { tone: 'acc' }, str(item.source || 'from this chart'))
            : ce(Badge, null, 'candidate action'),
          arr(gate.disputes).length ? ce(NotScored, null) : null),
        ce('div', { className: 'sp-body', style: { marginTop: 8, fontWeight: 700 } },
          (str(item.at) ? item.at + '  ·  ' : '') + str(item.text))),

      ce('div', { className: 'sp-yn', style: { marginTop: 12 } },
        ce('button', {
          type: 'button', disabled: ans !== null,
          className: 'sp-btn' + (ans !== null ? (truth ? ' go' : (ans === true ? ' danger' : '')) : ''),
          onClick: function () { answer(true); }
        }, props.yesLabel),
        ce('button', {
          type: 'button', disabled: ans !== null,
          className: 'sp-btn' + (ans !== null ? (!truth ? ' go' : (ans === false ? ' danger' : '')) : ''),
          onClick: function () { answer(false); }
        }, props.noLabel)),

      ans === null ? ce('div', { className: 'sp-row', style: { marginTop: 10 } },
        ce('button', {
          type: 'button', className: 'sp-btn ghost sm', onClick: function () { setHint(true); }
        }, 'Hint'),
        ce('button', {
          type: 'button', className: 'sp-btn ghost sm', onClick: next
        }, 'Skip')) : null,
      hint && ans === null ? ce('div', { className: 'sp-note', style: { marginTop: 8 } },
        str(props.hint)) : null,

      ce(Feedback, { show: ans !== null, correct: ans === truth },
        ce('div', null, str(props.explain ? props.explain(item, truth) : '')),
        ce('div', { style: { marginTop: 8 } },
          ce('button', { type: 'button', className: 'sp-btn sm go', onClick: next }, 'Next'))));
  }

  function OrderCheckDrill(props) {
    var d = obj(props.drill);
    if (!d.ok) {
      return ce(DrillUnavailable, { title: 'Order vs. No Order', tag: 'meds_orders', why: d.why });
    }
    return ce(YesNoDrill, {
      title: 'Order vs. No Order', tag: 'meds_orders', truthKey: 'inChart',
      drill: d, topic: props.topic, gate: props.gate, onGraded: props.onGraded,
      yesLabel: 'Yes - it is ordered here', noLabel: 'No - not in this chart',
      hint: 'Open the Orders / MAR tab in your head. If you cannot picture the line, ' +
            'the answer is no - and "no" means you call the provider, not that you skip it.',
      explain: function (item, truth) {
        return truth
          ? 'This line is in the chart, word for word: "' + str(item.text) + '". You may carry it out.'
          : 'Nothing in this chart authorises that. A medication or intervention needs an active ' +
            'order or MAR branch - without one, the correct action is to call the provider. ' +
            'Doing it anyway is an unsafe action and it is scored as one.';
      }
    });
  }

  function AlreadyDoneDrill(props) {
    var d = obj(props.drill);
    if (!d.ok) {
      return ce(DrillUnavailable, { title: 'Already Done', tag: 'meds_orders', why: d.why });
    }
    return ce(YesNoDrill, {
      title: 'Already Done', tag: 'meds_orders', truthKey: 'given',
      drill: d, topic: props.topic, gate: props.gate, onGraded: props.onGraded,
      yesLabel: 'Yes - already given', noLabel: 'No - not given',
      hint: 'The MAR only records what went IN. An order that exists but has no MAR entry ' +
            'has not been given yet.',
      explain: function (item, truth) {
        return truth
          ? 'The MAR records it' + (str(item.at) ? ' at ' + str(item.at) : '') + ': "' +
            str(item.text) + '". Giving it again is a duplicate dose.'
          : 'There is no MAR entry for that on this sheet. Ordered is not the same as given, ' +
            'and "I assumed the last nurse did it" is how a dose gets missed or doubled.';
      }
    });
  }

  /* --------------------------------------------------------------- 14.5 */
  function AbgDrill(props) {
    var d = obj(props.drill);
    var pickH = useState({});
    var pick = pickH[0], setPick = pickH[1];
    var doneH = useState(false);
    var done = doneH[0], setDone = doneH[1];
    var sureH = useState(false);
    var sure = sureH[0], setSure = sureH[1];

    if (!d.ok) {
      return ce(DrillUnavailable, { title: 'ABG Sprint', tag: 'labs', why: d.why });
    }
    var gas = obj(d.gas);
    var rows = [
      { k: 'pH', v: obj(gas.ph) }, { k: 'PaCO2', v: obj(gas.paco2) },
      { k: 'PaO2', v: obj(gas.pao2) }, { k: 'HCO3', v: obj(gas.hco3) }
    ].filter(function (r) { return !!str(r.v.test); });

    function choose(stepKey, val) {
      if (done) { return; }
      var next = shallow(pick);
      next[stepKey] = val;
      setPick(next);
    }
    function check() {
      var steps = arr(d.steps);
      var right = steps.filter(function (s) { return pick[s.key] === s.answer; }).length;
      var ok = right === steps.length;
      var gate = isFn(props.gate)
        ? props.gate(rows.map(function (r) {
            return str(r.v.test) + ' ' + str(r.v.result) + ' ' + str(r.v.interpretation);
          }).join(' '))
        : { scored: true };
      setDone(true);
      if (isFn(props.onGraded)) {
        props.onGraded({
          tag: 'labs', correct: ok, hinted: false, sure: sure, label: 'ABG Sprint',
          topicIdOverride: d.borrowed ? str(d.sourceTopicId) : '',
          scored: gate.scored,
          reason: gate.scored ? '' : 'an ABG value on this sheet is disputed'
        });
      }
    }

    return ce(DrillShell, {
      title: 'ABG Sprint', tag: 'labs', prompt: d.prompt,
      right: ce(SureToggle, { on: sure, onToggle: setSure })
    },
      d.borrowed ? ce('div', { className: 'sp-banner warn', style: { marginBottom: 10 } },
        'Borrowed gas: these values belong to ' + str(d.sourceTitle) + ', not to this chart. ' +
        'They are scored against that topic\'s labs, not this one\'s.') : null,
      ce('div', { className: 'sp-scroll' },
        ce('table', { className: 'sp-tbl' },
          ce('thead', null, ce('tr', null,
            ce('th', null, 'Gas'), ce('th', null, 'Result'), ce('th', null, 'Sheet says'))),
          ce('tbody', null, rows.map(function (r) {
            return ce('tr', { key: r.k },
              ce('td', null, ce('b', null, str(r.v.test))),
              ce('td', null, str(r.v.result)),
              ce('td', null, str(r.v.interpretation)));
          })))),
      arr(d.steps).map(function (s) {
        return ce('div', { key: s.key, style: { marginTop: 12 } },
          ce('div', { className: 'sp-lbl' }, s.q),
          ce('div', { className: 'sp-col' }, arr(s.choices).map(function (c) {
            var cls = 'sp-opt';
            if (done) {
              if (c === s.answer) { cls += ' right'; }
              else if (pick[s.key] === c) { cls += ' wrong'; }
            }
            return ce('button', {
              key: c, type: 'button', className: cls, disabled: done,
              'aria-pressed': pick[s.key] === c ? 'true' : 'false',
              onClick: function () { choose(s.key, c); }
            },
              ce('span', { className: 'mk', 'aria-hidden': 'true' }, pick[s.key] === c ? '✓' : ''),
              ce('span', { className: 'tx' }, c));
          })));
      }),
      ce('div', { className: 'sp-row', style: { marginTop: 12 } },
        done
          ? ce('button', {
              type: 'button', className: 'sp-btn',
              onClick: function () { setPick({}); setDone(false); }
            }, 'Again')
          : ce('button', {
              type: 'button', className: 'sp-btn go',
              disabled: keysOf(pick).length < arr(d.steps).length, onClick: check
            }, 'Check')),
      ce(Feedback, {
        show: done,
        correct: arr(d.steps).filter(function (s) { return pick[s.key] === s.answer; }).length === arr(d.steps).length
      },
        arr(d.steps).map(function (s) {
          return ce('div', { key: s.key }, '• ' + s.q + '  ' + s.answer);
        })));
  }

  /* --------------------------------------------------------------- 14.6 */
  function ShockDrill(props) {
    var d = obj(props.drill);
    var pickH = useState({});
    var pick = pickH[0], setPick = pickH[1];
    var doneH = useState(false);
    var done = doneH[0], setDone = doneH[1];
    var sureH = useState(false);
    var sure = sureH[0], setSure = sureH[1];

    if (!d.ok) {
      return ce(DrillUnavailable, { title: 'Shock Type Match', tag: 'prioritization', why: d.why });
    }
    function check() {
      var cards = arr(d.cards);
      var right = cards.filter(function (c) { return pick[c.topicId] === c.answer; }).length;
      setDone(true);
      if (isFn(props.onGraded)) {
        props.onGraded({
          tag: 'prioritization', correct: right === cards.length, hinted: false, sure: sure,
          label: 'Shock Type Match', scored: true
        });
      }
    }
    return ce(DrillShell, {
      title: 'Shock Type Match', tag: 'prioritization', prompt: d.prompt,
      right: ce(SureToggle, { on: sure, onToggle: setSure })
    },
      ce('div', { className: 'sp-row', style: { marginBottom: 10 } },
        arr(d.types).map(function (tp) {
          return ce('span', { key: tp.key, className: 'sp-badge acc', title: tp.hint },
            tp.label);
        })),
      arr(d.cards).map(function (c) {
        return ce('div', { key: c.topicId, className: 'sp-card',
          style: { background: 'var(--surface2,#273549)', marginTop: 10 } },
          ce('div', { className: 'sp-row' },
            ce(ProvBadge, { value: c.provenance, short: true }),
            c.from === 'inferred'
              ? ce(Badge, { tone: 'warn' }, 'classification inferred, not on the sheet')
              : ce(Badge, { tone: 'ok' }, 'named on the sheet')),
          ce('div', { className: 'sp-body', style: { margin: '8px 0' } }, c.stem),
          ce('div', { className: 'sp-row' }, arr(d.types).map(function (tp) {
            var cls = 'sp-btn sm';
            if (done) {
              if (tp.key === c.answer) { cls += ' go'; }
              else if (pick[c.topicId] === tp.key) { cls += ' danger'; }
            }
            return ce('button', {
              key: tp.key, type: 'button', className: cls, disabled: done,
              'aria-pressed': pick[c.topicId] === tp.key ? 'true' : 'false',
              onClick: function () {
                if (done) { return; }
                var next = shallow(pick); next[c.topicId] = tp.key; setPick(next);
              }
            }, tp.label);
          })),
          done ? ce('div', { className: 'sp-dim', style: { marginTop: 6 } },
            cut(str(c.title), 90)) : null);
      }),
      ce('div', { className: 'sp-row', style: { marginTop: 12 } },
        done
          ? ce('button', {
              type: 'button', className: 'sp-btn',
              onClick: function () { setPick({}); setDone(false); }
            }, 'Again')
          : ce('button', {
              type: 'button', className: 'sp-btn go',
              disabled: keysOf(pick).length < arr(d.cards).length, onClick: check
            }, 'Check')),
      ce(Feedback, {
        show: done,
        correct: arr(d.cards).filter(function (c) { return pick[c.topicId] === c.answer; }).length === arr(d.cards).length
      },
        arr(d.types).map(function (tp) {
          return ce('div', { key: tp.key }, '• ' + tp.label + ' - ' + tp.hint);
        })));
  }

  /* --------------------------------------------------------------- 14.7 */
  function SbarDrill(props) {
    var d = obj(props.drill);
    var valH = useState({ S: '', B: '', A: '', R: '' });
    var val = valH[0], setVal = valH[1];
    var resH = useState(null);
    var res = resH[0], setRes = resH[1];
    var showH = useState(false);
    var show = showH[0], setShow = showH[1];

    if (!d.ok) {
      return ce(DrillUnavailable, { title: 'SBAR Builder', tag: 'sbar', why: d.why });
    }
    var gate = isFn(props.gate) ? props.gate(arr(d.expected).join(' ')) : { scored: true, disputes: [] };

    function grade() {
      var r = gradeSbar(d, val);
      setRes(r);
      if (isFn(props.onGraded)) {
        props.onGraded({
          tag: 'sbar', correct: r.complete, hinted: show, sure: false,
          label: 'SBAR Builder', scored: gate.scored,
          reason: gate.scored ? '' : 'the expected SBAR references a disputed value'
        });
      }
      announce('SBAR completeness ' + r.coverage + ' percent.', false);
    }

    return ce(DrillShell, { title: 'SBAR Builder', tag: 'sbar', prompt: d.prompt },
      ce('div', { className: 'sp-banner', style: { marginBottom: 10 } },
        'Graded on completeness only. There is no phrase you have to hit - if the information ' +
        'is in there in any words, it counts.'),
      arr(gate.disputes).length ? ce('div', { style: { marginBottom: 8 } },
        ce(DisputeMark, { gate: gate })) : null,
      arr(d.letters).map(function (L) {
        var row = res ? arr(res.rows).filter(function (x) { return x.key === L.key; })[0] : null;
        return ce('div', { key: L.key },
          ce('label', { className: 'sp-lbl', htmlFor: 'sp-sbar-' + L.key },
            L.key + ' - ' + L.label + '  ·  ' + L.ask),
          ce('textarea', {
            id: 'sp-sbar-' + L.key, className: 'sp-ta', value: val[L.key],
            placeholder: 'Say it the way you would say it on the phone',
            onChange: function (e) {
              var next = shallow(val); next[L.key] = e.target.value; setVal(next);
            }
          }),
          row ? ce('div', {
            className: 'sp-fb ' + (row.ok ? 'good' : (row.coverage >= 25 ? 'mid' : 'bad')),
            style: { marginTop: 6 }
          },
            ce('b', null, L.key + ': ' + row.coverage + '% of the expected elements'),
            row.missed.length
              ? ce('div', null, 'Not mentioned: ' + row.missed.join(', '))
              : ce('div', null, 'Everything the sheet expects is in there.')) : null);
      }),
      ce('div', { className: 'sp-row', style: { marginTop: 12 } },
        ce('button', { type: 'button', className: 'sp-btn go', onClick: grade }, 'Grade my SBAR'),
        ce('button', {
          type: 'button', className: 'sp-btn ghost',
          'aria-expanded': show ? 'true' : 'false',
          onClick: function () { setShow(!show); }
        }, show ? 'Hide the sheet\'s version' : 'Show the sheet\'s version')),
      show ? ce('div', { className: 'sp-note', style: { marginTop: 10 } },
        ce('b', { style: { display: 'block', marginBottom: 4 } },
          'From the school sheet - looking at this counts as a hint'),
        arr(d.expected).map(function (x, i) {
          return ce('div', { key: i, style: { marginBottom: 4 } }, x);
        })) : null,
      res ? ce('div', {
        className: 'sp-fb ' + (res.complete ? 'good' : 'mid'), style: { marginTop: 10 }
      },
        ce('b', null, res.complete
          ? 'Complete - every section carries what it needs'
          : 'Incomplete - ' + res.coverage + '% overall'),
        ce('div', null, 'You are never graded on wording here, only on whether the information ' +
          'is present. Fill the gaps listed above and grade again.')) : null);
  }

  /* --------------------------------------------------------------- 14.8 */
  function LookAlikeDrill(props) {
    var d = obj(props.drill);
    var iH = useState(0);
    var i = iH[0], setI = iH[1];
    var ansH = useState('');
    var ans = ansH[0], setAns = ansH[1];
    var sureH = useState(false);
    var sure = sureH[0], setSure = sureH[1];
    var tableH = useState(false);
    var table = tableH[0], setTable = tableH[1];

    if (!d.ok) {
      return ce(DrillUnavailable, { title: 'Look-Alike Compare', tag: 'assessment', why: d.why });
    }
    var items = arr(d.items);
    var item = items.length ? obj(items[clamp(i, 0, items.length - 1)]) : null;

    function answer(tid) {
      if (ans || !item) { return; }
      setAns(tid);
      if (isFn(props.onGraded)) {
        props.onGraded({
          tag: 'assessment', correct: tid === item.topicId, hinted: false, sure: sure,
          label: 'Look-Alike: ' + cut(str(item.text), 60), scored: true
        });
      }
    }

    return ce(DrillShell, {
      title: 'Look-Alike Compare', tag: 'assessment', prompt: d.prompt,
      right: ce(SureToggle, { on: sure, onToggle: setSure })
    },
      ce('div', { className: 'sp-row', style: { marginBottom: 10 } },
        ce(Badge, { tone: 'acc' }, str(obj(d.group).label)),
        d.inGroup ? null : ce(Badge, { tone: 'warn' }, 'this topic is not in a look-alike set')),

      item ? ce('div', null,
        ce('div', { className: 'sp-card', style: { background: 'var(--surface2,#273549)' } },
          ce('div', { className: 'sp-dim' }, 'From the ' + str(item.from) + ' of one of these charts'),
          ce('div', { className: 'sp-body', style: { marginTop: 6, fontWeight: 700 } }, str(item.text))),
        ce('div', { className: 'sp-col', style: { marginTop: 10 } },
          arr(d.members).map(function (m) {
            var cls = 'sp-opt';
            if (ans) {
              if (m.topicId === item.topicId) { cls += ' right'; }
              else if (ans === m.topicId) { cls += ' wrong'; }
            }
            return ce('button', {
              key: m.topicId, type: 'button', className: cls, disabled: !!ans,
              onClick: function () { answer(m.topicId); }
            },
              ce('span', { className: 'mk', 'aria-hidden': 'true' }, ''),
              ce('span', { className: 'tx' }, cut(m.title, 90)));
          })),
        ans ? ce('div', { className: 'sp-row', style: { marginTop: 10 } },
          ce('button', {
            type: 'button', className: 'sp-btn go sm',
            onClick: function () { setAns(''); setI(i + 1 >= items.length ? 0 : i + 1); }
          }, 'Next finding')) : null) : null,

      ce('div', { className: 'sp-row', style: { marginTop: 12 } },
        ce('button', {
          type: 'button', className: 'sp-btn', 'aria-expanded': table ? 'true' : 'false',
          onClick: function () { setTable(!table); }
        }, table ? 'Hide side-by-side' : 'Show side-by-side')),
      table ? ce('div', { className: 'sp-scroll', style: { marginTop: 10 } },
        ce('table', { className: 'sp-tbl' },
          ce('thead', null, ce('tr', null,
            ce('th', null, ''),
            arr(d.members).map(function (m) {
              return ce('th', { key: m.topicId }, cut(m.title, 42));
            }))),
          ce('tbody', null,
            ce('tr', null, ce('td', null, ce('b', null, 'What you see')),
              arr(d.members).map(function (m) {
                return ce('td', { key: m.topicId }, arr(m.findings).map(function (f, k) {
                  return ce('div', { key: k }, '• ' + str(f));
                }));
              })),
            ce('tr', null, ce('td', null, ce('b', null, 'Top labs')),
              arr(d.members).map(function (m) {
                return ce('td', { key: m.topicId }, arr(m.topLabs).map(function (l, k) {
                  return ce('div', { key: k }, '• ' + str(obj(l).test) + ' ' + str(obj(l).result));
                }));
              })),
            ce('tr', null, ce('td', null, ce('b', null, 'Deterioration')),
              arr(d.members).map(function (m) {
                return ce('td', { key: m.topicId }, arr(m.cues).map(function (c, k) {
                  return ce('div', { key: k }, '• ' + str(c));
                }));
              }))))) : null);
  }

  /* ==========================================================================
   * 15. FLASHCARDS, QUIZ, TEACH-BACK
   * --------------------------------------------------------------------------
   * The flashcard deck is where "opening a card is not learning" is enforced in
   * the UI as well as the maths: flipping the card records an OPEN and nothing
   * else. Mastery moves only when the student then says which of the three
   * things happened - got it cold, needed the hint, missed it.
   * ======================================================================== */

  function FlashcardDeck(props) {
    var cards = arr(props.cards);
    var iH = useState(0);
    var i = iH[0], setI = iH[1];
    var flipH = useState(false);
    var flip = flipH[0], setFlip = flipH[1];
    var hintH = useState(false);
    var hint = hintH[0], setHint = hintH[1];
    var tallyH = useState({ got: 0, hinted: 0, missed: 0 });
    var tally = tallyH[0], setTally = tallyH[1];

    if (!cards.length) {
      return ce('div', { className: 'sp-empty' },
        'No flashcards were published for this topic. The other tabs still work; the study ' +
        'pack (data/nur2212-study.js) is what carries the deck.');
    }
    var card = obj(cards[clamp(i, 0, cards.length - 1)]);
    var gate = isFn(props.gate) ? props.gate(str(card.front) + ' ' + str(card.back))
                                : { scored: true, disputes: [] };

    function reveal() {
      if (flip) { return; }
      setFlip(true);
      if (isFn(props.onOpened)) { props.onOpened('card:' + hash32(str(card.front))); }
    }
    function grade(kind) {
      var spec = {
        tag: tagKey(card.tag),
        correct: kind !== 'missed',
        hinted: kind === 'hinted' || hint,
        sure: false,
        label: cut(str(card.front), 70),
        scored: gate.scored,
        reason: gate.scored ? '' : 'this card quotes a disputed value'
      };
      if (isFn(props.onGraded)) { props.onGraded(spec); }
      var nt = shallow(tally);
      nt[kind === 'missed' ? 'missed' : (kind === 'hinted' ? 'hinted' : 'got')]++;
      setTally(nt);
      setFlip(false); setHint(false);
      setI(i + 1 >= cards.length ? 0 : i + 1);
    }

    return ce('div', null,
      ce('div', { className: 'sp-row', style: { marginBottom: 10 } },
        ce(Badge, { tone: 'acc' }, tagLabel(tagKey(card.tag))),
        ce(ProvBadge, { value: card.provenance, short: true }),
        arr(gate.blocking).length ? ce(NotScored, null) : null,
        ce('div', { className: 'sp-spacer' }),
        ce(Badge, null, (i + 1) + ' / ' + cards.length),
        ce(Badge, { tone: 'ok' }, tally.got + ' cold'),
        ce(Badge, { tone: 'warn' }, tally.hinted + ' hinted'),
        ce(Badge, { tone: 'bad' }, tally.missed + ' missed')),

      ce('button', {
        type: 'button', className: 'sp-flip', onClick: reveal,
        'aria-live': 'polite',
        'aria-label': flip ? 'Answer shown. ' + str(card.back) : 'Question. Activate to reveal the answer.'
      },
        ce('span', { className: 'face' }, str(card.front)),
        flip
          ? ce('span', { className: 'back' }, str(card.back))
          : ce('span', { className: 'sp-dim' }, 'Say your answer out loud first, then tap to check')),

      !flip ? ce('div', { className: 'sp-row', style: { marginTop: 10 } },
        ce('button', {
          type: 'button', className: 'sp-btn ghost sm',
          'aria-pressed': hint ? 'true' : 'false',
          onClick: function () { setHint(true); }
        }, hint ? 'Hint used' : 'I need a hint'),
        hint ? ce('span', { className: 'sp-dim' },
          'First words: "' + cut(str(card.back).split(/\s+/).slice(0, 3).join(' '), 40) + '…"') : null) : null,

      flip ? ce('div', null,
        ce('div', { className: 'sp-yn', style: { marginTop: 12 } },
          ce('button', {
            type: 'button', className: 'sp-btn go',
            onClick: function () { grade('got'); }
          }, 'Got it, no help'),
          ce('button', {
            type: 'button', className: 'sp-btn',
            onClick: function () { grade('hinted'); }
          }, 'Needed a hint'),
          ce('button', {
            type: 'button', className: 'sp-btn danger',
            onClick: function () { grade('missed'); }
          }, 'Missed it')),
        ce('div', { className: 'sp-dim', style: { marginTop: 8 } },
          'Only "got it, no help" raises this concept. Reading the back of a card is not ' +
          'retrieval, and the schedule will not pretend it was.')) : null);
  }

  /* ------------------------------------------------------------------- */
  function QuizRunner(props) {
    var qs = arr(props.quizzes);
    var iH = useState(0);
    var i = iH[0], setI = iH[1];
    var pickH = useState(null);
    var pick = pickH[0], setPick = pickH[1];
    var orderH = useState([]);
    var order = orderH[0], setOrder = orderH[1];
    var textH = useState('');
    var text = textH[0], setText = textH[1];
    var doneH = useState(false);
    var done = doneH[0], setDone = doneH[1];
    var scoreH = useState({ n: 0, right: 0 });
    var score = scoreH[0], setScore = scoreH[1];

    if (!qs.length) {
      return ce('div', { className: 'sp-empty' },
        'No quiz items were published for this topic. The drills in the other tabs are built ' +
        'from the chart itself and still work.');
    }
    var q = obj(qs[clamp(i, 0, qs.length - 1)]);
    var type = str(q.type) || 'single_best_answer';
    var subject = str(q.question) + ' ' + arr(q.choices).join(' ') + ' ' +
                  arr(q.items).join(' ') + ' ' + arr(q.accepted_answers).join(' ');
    var gate = isFn(props.gate) ? props.gate(subject) : { scored: true, disputes: [], blocking: [] };

    function conceptTagFor(qq) {
      var t = lower(str(qq.question) + ' ' + str(qq.rationale));
      if (/sbar|hand-?off|notify|escalat/.test(t)) { return 'sbar'; }
      if (/lab|abg|lactate|hemoglobin|platelet|inr|gas\b/.test(t)) { return 'labs'; }
      if (/order|mar|medication|dose|administer/.test(t)) { return 'meds_orders'; }
      if (/deteriorat|worsen|cue|trend/.test(t)) { return 'deterioration'; }
      if (/order the|sequence|first|priorit/.test(t) || str(qq.type) === 'ordering') { return 'prioritization'; }
      return 'assessment';
    }
    function submit() {
      var ok = false;
      if (type === 'single_best_answer') {
        ok = pick !== null && pick === numOr(q.correct_index, -1);
      } else if (type === 'ordering') {
        var want = arr(q.correct_order).map(function (x) { return numOr(x, -1); });
        ok = order.length === want.length && order.filter(function (v, k) {
          return v === want[k];
        }).length === want.length;
      } else {
        var t = lower(text);
        ok = !!t.trim() && arr(q.accepted_answers).filter(function (a) {
          var words = distinctWords(a).filter(function (w) { return w.length >= 5; });
          if (!words.length) { return t.indexOf(lower(a)) !== -1; }
          var hits = words.filter(function (w) { return t.indexOf(w) !== -1; });
          return hits.length >= Math.ceil(words.length / 2);
        }).length > 0;
      }
      setDone(true);
      setScore({ n: score.n + 1, right: score.right + (ok ? 1 : 0) });
      if (isFn(props.onGraded)) {
        props.onGraded({
          tag: conceptTagFor(q), correct: ok, hinted: false, sure: false,
          label: cut(str(q.question), 70), scored: gate.scored,
          reason: gate.scored ? '' : 'this question turns on a disputed value'
        });
      }
    }
    function next() {
      setPick(null); setOrder([]); setText(''); setDone(false);
      setI(i + 1 >= qs.length ? 0 : i + 1);
    }

    var body = null;
    if (type === 'single_best_answer') {
      body = ce('div', { className: 'sp-col' }, arr(q.choices).map(function (c, k) {
        var cls = 'sp-opt';
        if (done) {
          if (k === numOr(q.correct_index, -1)) { cls += ' right'; }
          else if (pick === k) { cls += ' wrong'; }
        }
        return ce('button', {
          key: k, type: 'button', className: cls, disabled: done,
          'aria-pressed': pick === k ? 'true' : 'false',
          onClick: function () { if (!done) { setPick(k); } }
        },
          ce('span', { className: 'mk', 'aria-hidden': 'true' }, String.fromCharCode(65 + k)),
          ce('span', { className: 'tx' }, str(c)));
      }));
    } else if (type === 'ordering') {
      body = ce('div', null,
        ce('div', { className: 'sp-dim', style: { marginBottom: 8 } },
          'Tap them in the order you would do them. Tap a chosen step again to take it back.'),
        ce('div', { className: 'sp-col' }, arr(q.items).map(function (it, k) {
          var at = order.indexOf(k);
          var cls = 'sp-opt';
          if (done) {
            var want = arr(q.correct_order).map(function (x) { return numOr(x, -1); });
            cls += (want[at] === k && at !== -1) ? ' right' : (at !== -1 ? ' wrong' : ' miss');
          }
          return ce('button', {
            key: k, type: 'button', className: cls, disabled: done,
            'aria-pressed': at !== -1 ? 'true' : 'false',
            onClick: function () {
              if (done) { return; }
              if (at === -1) { setOrder(order.concat([k])); }
              else { setOrder(order.filter(function (v) { return v !== k; })); }
            }
          },
            ce('span', { className: 'mk', 'aria-hidden': 'true' }, at === -1 ? '' : String(at + 1)),
            ce('span', { className: 'tx' }, str(it)));
        })),
        done ? ce('div', { className: 'sp-note', style: { marginTop: 8 } },
          'Correct order: ' + arr(q.correct_order).map(function (x, n) {
            return (n + 1) + '. ' + str(arr(q.items)[numOr(x, 0)]);
          }).join('   ')) : null);
    } else {
      body = ce('div', null,
        ce('textarea', {
          className: 'sp-ta', value: text, disabled: done,
          placeholder: 'Your own words. No phrase is required.',
          onChange: function (e) { setText(e.target.value); }
        }),
        done ? ce('div', { className: 'sp-note', style: { marginTop: 8 } },
          ce('b', { style: { display: 'block', marginBottom: 4 } }, 'Any of these count'),
          arr(q.accepted_answers).map(function (a, k) {
            return ce('div', { key: k }, '• ' + str(a));
          })) : null);
    }

    var canSubmit = type === 'single_best_answer' ? pick !== null
      : (type === 'ordering' ? order.length === arr(q.items).length : !!str(text).trim());

    return ce('div', null,
      ce('div', { className: 'sp-row', style: { marginBottom: 10 } },
        ce(Badge, { tone: 'acc' }, str(type).replace(/_/g, ' ')),
        ce(Badge, null, str(q.difficulty) || 'unrated'),
        ce(ProvBadge, { value: q.provenance, short: true }),
        arr(gate.blocking).length ? ce(NotScored, null) : null,
        ce('div', { className: 'sp-spacer' }),
        ce(Badge, null, (i + 1) + ' / ' + qs.length),
        ce(Badge, { tone: 'ok' }, score.right + '/' + score.n)),
      ce('div', { className: 'sp-body', style: { fontWeight: 700, marginBottom: 10 } },
        str(q.question)),
      arr(gate.blocking).length ? ce('div', { style: { marginBottom: 8 } },
        ce(DisputeMark, { gate: gate })) : null,
      body,
      ce('div', { className: 'sp-row', style: { marginTop: 12 } },
        done
          ? ce('button', { type: 'button', className: 'sp-btn go', onClick: next }, 'Next question')
          : ce('button', {
              type: 'button', className: 'sp-btn go', disabled: !canSubmit, onClick: submit
            }, 'Answer')),
      done ? ce('div', { className: 'sp-fb', style: { marginTop: 10 } },
        ce('b', null, 'Why'), str(q.rationale) || 'No rationale was published for this item.') : null);
  }

  /* ------------------------------------------------------------------- */
  function TeachBack(props) {
    var topic = obj(props.topic);
    var lesson = lessonOf(topic);
    var rapid = arr(lesson.rapidFire);
    var valH = useState('');
    var val = valH[0], setVal = valH[1];
    var resH = useState(null);
    var res = resH[0], setRes = resH[1];
    var openH = useState({});
    var open = openH[0], setOpen = openH[1];

    /* The model answer for the teach-back is the chart's own story + chain, so
       completeness is measured against real content, not an invented rubric. */
    var model = [str(lesson.caseStory) || str(topic.case_intro)]
      .concat(arr(lesson.pathoChain).map(function (x) { return str(obj(x).text || x); }))
      .concat(arr(topic.deterioration_cues).slice(0, 3))
      .join(' ');
    var elements = uniq(numbersIn(model).concat(
      distinctWords(model).filter(function (w) { return w.length >= 6; })
    )).slice(0, 14);

    function grade() {
      var t = ' ' + lower(val).replace(/[^a-z0-9.%<>/ -]+/g, ' ') + ' ';
      var hit = elements.filter(function (e) { return t.indexOf(lower(e)) !== -1; });
      var cov = elements.length ? Math.round((hit.length / elements.length) * 100) : 0;
      setRes({ coverage: cov, hit: hit, missed: elements.filter(function (e) {
        return hit.indexOf(e) === -1;
      }) });
      if (isFn(props.onGraded)) {
        props.onGraded({
          tag: 'patho', correct: cov >= 50, hinted: false, sure: false,
          label: 'Teach-back', scored: true
        });
      }
    }

    return ce('div', null,
      ce('div', { className: 'sp-card' },
        ce('h3', null, 'Teach it back'),
        ce('p', { className: 'sp-sub' },
          'Explain this case to somebody who has not read the sheet - what is happening inside ' +
          'the patient, what you would see, and what you would do. You are scored on how much of ' +
          'the case you covered, never on phrasing.'),
        ce('textarea', {
          className: 'sp-ta', value: val, style: { minHeight: 130 },
          placeholder: 'Out loud is better. Type the short version here.',
          onChange: function (e) { setVal(e.target.value); }
        }),
        ce('div', { className: 'sp-row', style: { marginTop: 10 } },
          ce('button', {
            type: 'button', className: 'sp-btn go', disabled: !str(val).trim(), onClick: grade
          }, 'Check my coverage')),
        res ? ce('div', {
          className: 'sp-fb ' + (res.coverage >= 50 ? 'good' : 'mid'), style: { marginTop: 10 }
        },
          ce('b', null, res.coverage + '% of the case covered'),
          res.missed.length
            ? ce('div', null, 'You did not mention: ' + res.missed.slice(0, 10).join(', '))
            : ce('div', null, 'You covered everything the chart carries.')) : null),

      rapid.length ? ce('div', { className: 'sp-card' },
        ce('h3', null, 'Rapid fire'),
        ce('p', { className: 'sp-sub' },
          'Answer out loud, then open it. Say which way it went - that is what moves the schedule.'),
        rapid.map(function (r, i) {
          var q = str(obj(r).q), a = str(obj(r).a);
          var isOpen = !!open[i];
          return ce('div', { key: i, className: 'sp-card',
            style: { background: 'var(--surface2,#273549)', marginTop: 8 } },
            ce('div', { className: 'sp-body', style: { fontWeight: 700 } }, q),
            isOpen ? ce('div', { className: 'sp-body', style: { marginTop: 6 } }, a) : null,
            ce('div', { className: 'sp-row', style: { marginTop: 8 } },
              ce('button', {
                type: 'button', className: 'sp-btn sm',
                'aria-expanded': isOpen ? 'true' : 'false',
                onClick: function () {
                  var n = shallow(open); n[i] = !isOpen; setOpen(n);
                  if (!isOpen && isFn(props.onOpened)) { props.onOpened('rapid:' + i); }
                }
              }, isOpen ? 'Hide' : 'Show answer'),
              isOpen ? ce('button', {
                type: 'button', className: 'sp-btn sm go',
                onClick: function () {
                  if (isFn(props.onGraded)) {
                    props.onGraded({ tag: 'rapid_recall', correct: true, hinted: false,
                      sure: false, label: cut(q, 60), scored: true });
                  }
                }
              }, 'I had it') : null,
              isOpen ? ce('button', {
                type: 'button', className: 'sp-btn sm danger',
                onClick: function () {
                  if (isFn(props.onGraded)) {
                    props.onGraded({ tag: 'rapid_recall', correct: false, hinted: false,
                      sure: true, label: cut(q, 60), scored: true });
                  }
                }
              }, 'I did not') : null));
        })) : null,

      arr(lesson.references).length ? ce('div', { className: 'sp-card' },
        ce('h3', null, 'Where this came from'),
        ce('ul', { className: 'sp-list' }, arr(lesson.references).map(function (r, i) {
          var ref = obj(r);
          return ce('li', { key: i },
            str(ref.url)
              ? ce('a', { href: str(ref.url), target: '_blank', rel: 'noopener noreferrer',
                  style: { color: 'var(--accent-fg,#60a5fa)' } }, str(ref.label) || str(ref.url))
              : str(ref.label));
        }))) : null);
  }

  /* ==========================================================================
   * 16. THE FOURTEEN LESSON TABS
   * --------------------------------------------------------------------------
   * Exactly the list in STUDY_MODE_SPEC.md, in the spec's order. Every one of
   * them renders for every topic - where a topic has nothing for a tab, the tab
   * says so in words, because "this chart has no ABG" and "this chart records
   * one set of vitals" are themselves facts worth carrying into the lab.
   * ======================================================================== */

  var TABS = [
    { id: 'review', label: '60-Second Review', short: '60 sec', tag: 'simulation_goal' },
    { id: 'story', label: 'Case Story', short: 'Story', tag: 'assessment' },
    { id: 'patho', label: 'Patho Chain', short: 'Patho', tag: 'patho' },
    { id: 'redflags', label: 'Assessment / Red Flags', short: 'Red flags', tag: 'assessment' },
    { id: 'vitals', label: 'Vitals Trend', short: 'Vitals', tag: 'deterioration' },
    { id: 'labs', label: 'Labs & Diagnostics', short: 'Labs', tag: 'labs' },
    { id: 'orders', label: 'Orders / MAR', short: 'Orders', tag: 'meds_orders' },
    { id: 'sequence', label: 'In-Room Sequence', short: 'Sequence', tag: 'prioritization' },
    { id: 'deterioration', label: 'Deterioration', short: 'Deterioration', tag: 'deterioration' },
    { id: 'sbar', label: 'SBAR', short: 'SBAR', tag: 'sbar' },
    { id: 'mistakes', label: 'Common Mistakes', short: 'Mistakes', tag: 'assessment' },
    { id: 'cards', label: 'Flashcards', short: 'Cards', tag: 'rapid_recall' },
    { id: 'quiz', label: 'Quiz', short: 'Quiz', tag: 'assessment' },
    { id: 'teach', label: 'Teach-Back', short: 'Teach', tag: 'patho' }
  ];
  function tabMeta(id) {
    var hit = TABS.filter(function (t) { return t.id === str(id); });
    return hit.length ? hit[0] : TABS[0];
  }

  /** A chart line with its provenance chip and its dispute state. */
  function ChartLine(props) {
    var gate = isFn(props.gate) ? props.gate(str(props.text)) : { scored: true, disputes: [] };
    var t = splitTimed(props.text);
    return ce('div', { className: 'sp-li' },
      t.at ? ce('span', { className: 'at' }, t.at) : null,
      ce('span', { className: 'tx' },
        str(props.text),
        arr(gate.disputes).length
          ? ce('div', { style: { marginTop: 5 } }, ce(DisputeMark, { gate: gate }))
          : null),
      props.showProv === false ? null : ce(ProvBadge, { value: props.provenance, short: true }));
  }

  function EmptyNote(props) {
    return ce('div', { className: 'sp-note' }, props.children);
  }

  function renderTab(id, ctx) {
    var c = obj(ctx);
    var topic = obj(c.topic);
    var lesson = lessonOf(topic);
    var gate = c.gate;
    var prov = str(topic.provenance);

    /* ------------------------------------------------------------ 60 sec */
    if (id === 'review') {
      var crit = arr(topic.critical_actions);
      var intents = arr(topic.allowed_action_intents);
      return ce('div', null,
        ce('div', { className: 'sp-card' },
          ce('div', { className: 'sp-row' },
            ce(ProvBadge, { value: prov }),
            numOr(topic.duration_minutes, 0)
              ? ce(Badge, { tone: 'acc' }, numOr(topic.duration_minutes, 0) + ' min sim') : null,
            topic.education_only ? ce(Badge, { tone: 'warn' }, 'Education only') : null,
            str(topic.source_file) ? ce(Badge, null, cut(str(topic.source_file), 34)) : null),
          ce('h3', { style: { marginTop: 10 } }, 'What this sim is testing'),
          ce('p', { className: 'sp-body' },
            str(lesson.testing) ||
            'The sheet does not state it in one line. From the chart: ' +
            (crit.length ? crit.length + ' critical actions, ' : '') +
            (arr(topic.orders).length ? arr(topic.orders).length + ' orders to work inside, and ' : '') +
            'a deterioration you are expected to catch before it declares itself.'),
          str(lesson.memoryHook) ? ce('div', { className: 'sp-banner', style: { marginTop: 10 } },
            ce('b', null, 'Memory hook: '), str(lesson.memoryHook)) : null),

        crit.length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'The actions that must happen'),
          ce('ul', { className: 'sp-list' }, crit.map(function (a, i) {
            var m = intents.filter(function (x) { return str(obj(x).id) === str(a); })[0];
            return ce('li', { key: i }, m ? str(obj(m).label) : str(a).replace(/_/g, ' '));
          }))) : null,

        arr(lesson.redFlags).length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'Notice first'),
          ce('ul', { className: 'sp-list flag' }, arr(lesson.redFlags).slice(0, 5).map(function (f, i) {
            return ce('li', { key: i }, str(f));
          }))) : null);
    }

    /* ----------------------------------------------------------- story */
    if (id === 'story') {
      return ce('div', null,
        ce('div', { className: 'sp-card' },
          ce('div', { className: 'sp-row' }, ce(ProvBadge, { value: prov })),
          ce('h3', { style: { marginTop: 8 } }, 'Handoff'),
          ce('p', { className: 'sp-body' }, str(topic.case_intro) || 'No case introduction is recorded.'),
          str(lesson.caseStory) ? ce('p', { className: 'sp-body', style: { marginTop: 10 } },
            str(lesson.caseStory)) : null),
        arr(topic.initial_findings).length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'What you walk in on'),
          arr(topic.initial_findings).map(function (f, i) {
            return ce(ChartLine, { key: i, text: str(f), provenance: prov, gate: gate });
          })) : ce('div', { className: 'sp-card' },
            ce(EmptyNote, null, 'This sheet lists no initial findings. You would be building the ' +
              'picture from your own assessment.')));
    }

    /* ----------------------------------------------------------- patho */
    if (id === 'patho') {
      var chain = arr(lesson.pathoChain);
      if (!chain.length) {
        return ce('div', { className: 'sp-card' },
          ce('h3', null, 'Patho chain'),
          ce(EmptyNote, null,
            'No pathophysiology chain was published for this topic in the study pack. ' +
            'The Case Story and Deterioration tabs carry what the school sheet says.'));
      }
      return ce('div', { className: 'sp-card' },
        ce('h3', null, 'Cause → consequence'),
        ce('p', { className: 'sp-sub' },
          'Learn the chain, not the list. If you can say why each link produces the next one, ' +
          'you can rebuild every red flag on the spot.'),
        ce('div', { className: 'sp-chain', style: { marginTop: 10 } }, chain.map(function (l, i) {
          var text = str(obj(l).text || l);
          return ce('div', { key: i },
            i ? ce('div', { className: 'arrow', 'aria-hidden': 'true' }, '↓') : null,
            ce('div', { className: 'lnk' },
              ce('span', { className: 'n' }, String(i + 1)),
              ce('span', null, text)));
        })));
    }

    /* -------------------------------------------------------- red flags */
    if (id === 'redflags') {
      var assessIntents = arr(topic.allowed_action_intents).filter(function (x) {
        return lower(obj(x).category).indexOf('assess') !== -1;
      });
      return ce('div', null,
        arr(lesson.redFlags).length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'Red flags'),
          ce('ul', { className: 'sp-list flag' }, arr(lesson.redFlags).map(function (f, i) {
            return ce('li', { key: i }, str(f));
          }))) : null,
        arr(topic.initial_findings).length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'Findings on this sheet'),
          arr(topic.initial_findings).map(function (f, i) {
            return ce(ChartLine, { key: i, text: str(f), provenance: prov, gate: gate });
          })) : null,
        assessIntents.length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'Assessments this scenario recognises'),
          ce('ul', { className: 'sp-list' }, assessIntents.map(function (a, i) {
            return ce('li', { key: i }, str(obj(a).label));
          })),
          ce('div', { className: 'sp-dim', style: { marginTop: 8 } },
            'Say any of these however you like - the engine matches meaning, not phrasing.')) : null,
        (!arr(lesson.redFlags).length && !arr(topic.initial_findings).length)
          ? ce('div', { className: 'sp-card' }, ce(EmptyNote, null,
              'Neither the sheet nor the study pack lists findings for this topic.'))
          : null);
    }

    /* ----------------------------------------------------------- vitals */
    if (id === 'vitals') {
      var rows = arr(topic.vital_trends);
      return ce('div', null,
        ce('div', { className: 'sp-card' },
          ce('div', { className: 'sp-row' },
            ce('h3', { style: { margin: 0 } }, 'Vital signs as charted'),
            ce('div', { className: 'sp-spacer' }),
            ce(ProvBadge, { value: prov, short: true })),
          rows.length ? ce('div', { className: 'sp-scroll', style: { marginTop: 8 } },
            ce('table', { className: 'sp-tbl' },
              ce('thead', null, ce('tr', null,
                ce('th', null, 'Time'), ce('th', null, 'BP'), ce('th', null, 'HR'),
                ce('th', null, 'RR'), ce('th', null, 'SpO2'), ce('th', null, 'Temp'))),
              ce('tbody', null, rows.map(function (r, i) {
                var v = obj(r);
                return ce('tr', { key: i },
                  ce('td', null, ce('b', null, str(v.time))),
                  ce('td', null, str(v.bp)), ce('td', null, str(v.hr)),
                  ce('td', null, str(v.rr)), ce('td', null, str(v.spo2)),
                  ce('td', null, str(v.temp)));
              })))) : ce(EmptyNote, null, 'No vital-sign sets are recorded on this sheet.')),
        ce(TrendSpotterDrill, {
          topic: topic, drill: c.drills.trend, gate: gate, onGraded: c.onGraded
        }));
    }

    /* ------------------------------------------------------------- labs */
    if (id === 'labs') {
      var labs = arr(topic.labs);
      return ce('div', null,
        ce('div', { className: 'sp-card' },
          ce('div', { className: 'sp-row' },
            ce('h3', { style: { margin: 0 } }, 'Labs as charted'),
            ce('div', { className: 'sp-spacer' }),
            ce(ProvBadge, { value: prov, short: true })),
          labs.length ? ce('div', { className: 'sp-scroll', style: { marginTop: 8 } },
            ce('table', { className: 'sp-tbl' },
              ce('thead', null, ce('tr', null,
                ce('th', null, 'Test'), ce('th', null, 'Result'),
                ce('th', null, 'Sheet interpretation'), ce('th', null, ''))),
              ce('tbody', null, labs.map(function (l, i) {
                var lab = obj(l);
                var g = isFn(gate)
                  ? gate(str(lab.test) + ' ' + str(lab.result) + ' ' + str(lab.interpretation))
                  : { scored: true, disputes: [] };
                var u = labUrgency(lab);
                return ce('tr', { key: i, className: arr(g.disputes).length ? 'flag' : (u >= 3 ? 'up' : (u >= 2 ? 'down' : '')) },
                  ce('td', null, ce('b', null, str(lab.test))),
                  ce('td', null, str(lab.result)),
                  ce('td', null, str(lab.interpretation)),
                  ce('td', null, arr(g.disputes).length ? ce(DisputeMark, { gate: g }) : null));
              })))) : ce(EmptyNote, null, 'No laboratory values are recorded on this sheet.'),
          arr(topic.diagnostics).length ? ce('div', null,
            ce('h4', null, 'Diagnostics'),
            arr(topic.diagnostics).map(function (dx, i) {
              return ce(ChartLine, { key: i, text: str(dx), provenance: prov, gate: gate });
            })) : null),
        ce(LabTriageDrill, {
          topic: topic, drill: c.drills.labtriage, gate: gate, onGraded: c.onGraded
        }),
        ce(AbgDrill, {
          topic: topic, drill: c.drills.abg, gate: gate, onGraded: c.onGraded
        }));
    }

    /* ----------------------------------------------------------- orders */
    if (id === 'orders') {
      var orders = arr(topic.orders);
      var mar = arr(topic.mar);
      return ce('div', null,
        ce('div', { className: 'sp-card' },
          ce('div', { className: 'sp-row' },
            ce('h3', { style: { margin: 0 } }, 'Provider orders'),
            ce('div', { className: 'sp-spacer' }),
            ce(ProvBadge, { value: prov, short: true }),
            ce(Badge, null, orders.length + ' ' + plural(orders.length, 'line'))),
          ce('p', { className: 'sp-sub' },
            'Verbatim. These, and only these, are what you are allowed to carry out. ' +
            'Anything else is a call to the provider.'),
          orders.length
            ? orders.map(function (o, i) {
                return ce(ChartLine, { key: i, text: str(o), provenance: prov, gate: gate });
              })
            : ce(EmptyNote, null, 'This sheet carries no provider orders at all.')),
        ce('div', { className: 'sp-card' },
          ce('div', { className: 'sp-row' },
            ce('h3', { style: { margin: 0 } }, 'MAR - what has already gone in'),
            ce('div', { className: 'sp-spacer' }),
            ce(ProvBadge, { value: prov, short: true })),
          mar.length
            ? mar.map(function (m, i) {
                return ce(ChartLine, { key: i, text: str(m), provenance: prov, gate: gate });
              })
            : ce(EmptyNote, null, 'Nothing is recorded as administered.')),
        ce(OrderCheckDrill, {
          topic: topic, drill: c.drills.ordercheck, gate: gate, onGraded: c.onGraded
        }),
        ce(AlreadyDoneDrill, {
          topic: topic, drill: c.drills.alreadydone, gate: gate, onGraded: c.onGraded
        }));
    }

    /* --------------------------------------------------------- sequence */
    if (id === 'sequence') {
      var seq = arr(lesson.inRoomSequence);
      var universal = arr(playbook().universalSequence);
      var intentsById = {};
      arr(topic.allowed_action_intents).forEach(function (x) {
        intentsById[str(obj(x).id)] = str(obj(x).label);
      });
      return ce('div', null,
        seq.length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'In the room, in this order'),
          ce('ul', { className: 'sp-list step' }, seq.map(function (s, i) {
            return ce('li', { key: i }, str(obj(s).text || s));
          }))) : null,
        universal.length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'The sequence that works in every one of the twelve'),
          ce('ul', { className: 'sp-list step' }, universal.map(function (s, i) {
            return ce('li', { key: i },
              ce('b', null, str(obj(s).label) || ('Step ' + (i + 1))),
              str(obj(s).text) ? ce('div', { className: 'sp-dim' }, str(obj(s).text)) : null);
          }))) : null,
        arr(topic.critical_actions).length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'Critical actions for this topic'),
          ce('ul', { className: 'sp-list flag' }, arr(topic.critical_actions).map(function (a, i) {
            return ce('li', { key: i }, intentsById[str(a)] || str(a).replace(/_/g, ' '));
          })),
          ce('div', { className: 'sp-dim', style: { marginTop: 8 } },
            'Missing one of these is what moves the patient, not the clock.')) : null,
        (!seq.length && !universal.length && !arr(topic.critical_actions).length)
          ? ce('div', { className: 'sp-card' }, ce(EmptyNote, null,
              'No in-room sequence is published for this topic yet.')) : null);
    }

    /* ---------------------------------------------------- deterioration */
    if (id === 'deterioration') {
      var cues = arr(topic.deterioration_cues);
      var lessonCues = arr(lesson.deteriorationCues);
      var trig = arr(topic.deterioration_triggers);
      return ce('div', null,
        ce('div', { className: 'sp-card' },
          ce('div', { className: 'sp-row' },
            ce('h3', { style: { margin: 0 } }, 'Cues this chart says to watch'),
            ce('div', { className: 'sp-spacer' }),
            ce(ProvBadge, { value: prov, short: true })),
          cues.length || lessonCues.length
            ? ce('ul', { className: 'sp-list flag' },
                uniq(cues.concat(lessonCues)).map(function (q, i) {
                  return ce('li', { key: i }, str(q));
                }))
            : ce(EmptyNote, null, 'No deterioration cues are listed for this topic.')),
        trig.length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'What actually makes this patient worse'),
          ce('ul', { className: 'sp-list' }, trig.map(function (t, i) {
            var tr = obj(t);
            return ce('li', { key: i },
              str(tr.trigger || t).replace(/_/g, ' '),
              str(tr.effect) ? ce('div', { className: 'sp-dim' },
                '→ ' + str(tr.effect).replace(/_/g, ' ')) : null);
          })),
          ce('div', { className: 'sp-dim', style: { marginTop: 8 } },
            'Deterioration follows missed critical actions, unsafe actions and time. ' +
            'It is not random, and nothing improvises it.')) : null,
        ce(ShockDrill, {
          topic: topic, drill: c.drills.shock, gate: gate, onGraded: c.onGraded
        }));
    }

    /* ------------------------------------------------------------- sbar */
    if (id === 'sbar') {
      var formula = arr(playbook().sbarFormula);
      return ce('div', null,
        formula.length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'The formula'),
          ce('ul', { className: 'sp-list' }, formula.map(function (f, i) {
            return ce('li', { key: i },
              ce('b', null, str(obj(f).letter) || ''), ' ', str(obj(f).text || f));
          }))) : null,
        arr(topic.sbar_expected).length ? ce('div', { className: 'sp-card' },
          ce('div', { className: 'sp-row' },
            ce('h3', { style: { margin: 0 } }, 'What this sheet expects'),
            ce('div', { className: 'sp-spacer' }),
            ce(ProvBadge, { value: prov, short: true })),
          arr(topic.sbar_expected).map(function (x, i) {
            return ce(ChartLine, { key: i, text: str(x), provenance: prov, gate: gate, showProv: false });
          })) : null,
        ce(SbarDrill, {
          topic: topic, drill: c.drills.sbar, gate: gate, onGraded: c.onGraded
        }));
    }

    /* --------------------------------------------------------- mistakes */
    if (id === 'mistakes') {
      var mistakes = arr(lesson.commonMistakes);
      var patterns = arr(playbook().crossTopicPatterns);
      var earns = arr(playbook().earnsPoints);
      return ce('div', null,
        mistakes.length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'What goes wrong here'),
          ce('ul', { className: 'sp-list flag' }, mistakes.map(function (m, i) {
            return ce('li', { key: i }, str(obj(m).text || m));
          }))) : ce('div', { className: 'sp-card' },
            ce('h3', null, 'What goes wrong here'),
            ce(EmptyNote, null, 'No common-mistake list is published for this topic yet. ' +
              'The cross-topic patterns below still apply.')),
        earns.length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'What actually earns points'),
          ce('ul', { className: 'sp-list' }, earns.map(function (e, i) {
            return ce('li', { key: i }, str(obj(e).text || e));
          }))) : null,
        patterns.length ? ce('div', { className: 'sp-card' },
          ce('h3', null, 'Patterns that repeat across all twelve'),
          ce('ul', { className: 'sp-list' }, patterns.map(function (p, i) {
            return ce('li', { key: i }, str(obj(p).text || p));
          }))) : null,
        ce(LookAlikeDrill, {
          topic: topic, drill: c.drills.lookalike, gate: gate, onGraded: c.onGraded
        }));
    }

    /* ------------------------------------------------------------ cards */
    if (id === 'cards') {
      return ce('div', { className: 'sp-card' },
        ce('h3', null, 'Flashcards'),
        ce(FlashcardDeck, {
          cards: flashcardsFor(topic.topic_id), gate: gate,
          onGraded: c.onGraded, onOpened: c.onOpened
        }));
    }

    /* ------------------------------------------------------------- quiz */
    if (id === 'quiz') {
      return ce('div', { className: 'sp-card' },
        ce('h3', null, 'Quiz'),
        ce(QuizRunner, {
          quizzes: quizzesFor(topic.topic_id), gate: gate, onGraded: c.onGraded
        }));
    }

    /* ------------------------------------------------------------ teach */
    if (id === 'teach') {
      return ce(TeachBack, {
        topic: topic, onGraded: c.onGraded, onOpened: c.onOpened
      });
    }

    return ce('div', { className: 'sp-empty' }, 'Unknown tab.');
  }

  /* ==========================================================================
   * 17. STUDY MODE
   * ======================================================================== */

  function identityOf(props) {
    var p = obj(props);
    var MM = MMx();
    var au = p.authUser || MM.authUser || null;
    var uid = str(au && au.uid ? au.uid : (MM.myId || ''));
    var email = str(au && au.email ? au.email : '');
    var name = cut(str(
      (au && au.displayName) ? au.displayName : (email ? email.split('@')[0] : 'Student')
    ) || 'Student', 40);
    var admin = !!(p.isAdmin || MM.isAdmin);
    var sadmin = !!(p.isSuperAdmin || MM.isSuperAdmin);
    return {
      uid: uid, email: email, name: name,
      isAdmin: admin, isSuperAdmin: sadmin,
      role: sadmin ? 'superadmin' : (admin ? 'instructor' : 'student'),
      canVerify: admin || sadmin
    };
  }

  /** Best-effort cross-device mirror. Denied today - see OVERRIDE_RULES. */
  function mirrorOverride(uid, rec) {
    var db = MMx().db;
    if (!db || !uid || !isFn(db.ref)) { return; }
    try {
      var p = db.ref(OVERRIDE_PATH + '/' + uid + '/' + str(obj(rec).discrepancyId)).set(rec);
      if (p && isFn(p['catch'])) { p['catch'](function () {}); }
    } catch (e) { /* no rule for this path yet: a non-event */ }
  }

  function SimPrepStudy(props) {
    var p = obj(props);
    injectStyles();

    var who = identityOf(p);
    var topics = allTopics();

    var tidH = useState(function () {
      var want = str(p.topicId);
      if (want && topicById(want)) { return want; }
      return topics.length ? str(topics[0].topic_id) : '';
    });
    var topicId = tidH[0], setTopicId = tidH[1];
    var tabH = useState('review');
    var tab = tabH[0], setTab = tabH[1];
    var pickerH = useState(false);
    var picker = pickerH[0], setPicker = pickerH[1];

    /* A topicId handed down by the router wins over local state. */
    useEffect(function () {
      var want = str(p.topicId);
      if (want && topicById(want) && want !== topicId) { setTopicId(want); }
    }, [p.topicId]);

    var topic = topicById(topicId);
    var partner = usePartner({ kind: 'study', topicId: topicId, mode: 'study' });
    var prefs = stateOf(p.progress).prefs;

    var setPref = useCallback(function (k, v) {
      mutate(p.setProgress, function (w) { w.prefs[str(k)] = v; });
    }, [p.setProgress]);

    var gate = useCallback(function (subject) {
      return scoreGate(topic, p.progress, subject);
    }, [topicId, p.progress]);

    var onGraded = useCallback(function (spec) {
      var s = obj(spec);
      var target = str(s.topicIdOverride) || topicId;
      recordAttempt(p.setProgress, p.progress, {
        topicId: target, tag: s.tag, correct: s.correct, hinted: s.hinted,
        sure: s.sure, drill: str(s.drill) || str(s.label), label: s.label,
        scored: s.scored, reason: s.reason
      });
      if (s.scored === false) {
        toast('Shown, not scored: a source issue touches this item.', 'warn');
        announce('Not scored. A source discrepancy touches this item.', false);
      }
      partner.publish('study_answer', {
        topicId: target, tag: s.tag, correct: s.correct, label: s.label
      });
    }, [topicId, p.progress, p.setProgress, partner]);

    var onOpened = useCallback(function (what) {
      recordOpened(p.setProgress, topicId, what);
      partner.publish('card_opened', { topicId: topicId, label: str(what) });
    }, [topicId, p.setProgress, partner]);

    var saveOverride = useCallback(function (payload) {
      var d = obj(payload);
      var prevRec = overrideRecord(p.progress, d.discrepancyId);
      var discs = discrepanciesFor(topic).filter(function (x) { return x.id === str(d.discrepancyId); });
      var fallback = discs.length ? discs[0].text : '';
      var discIdx = discs.length ? numOr(discs[0].index, -1)
        : numOr(prevRec && prevRec.discIndex, -1);
      var hist = prevRec ? arr(prevRec.history).concat([{
        at: str(prevRec.at), replacementText: str(prevRec.replacementText),
        originalText: str(prevRec.originalText),
        recordedByName: str(prevRec.recordedByName),
        recordedByUid: str(prevRec.recordedByUid),
        instructorName: str(prevRec.instructorName),
        active: prevRec.active !== false, supersededAt: new Date().toISOString()
      }]) : [];
      var rec = makeOverride({
        discrepancyId: d.discrepancyId, topicId: str(d.topicId) || topicId,
        discIndex: discIdx,
        /* The school file's words survive every edit. If the form was cleared,
           we fall back to the discrepancy note rather than storing nothing. */
        originalText: str(d.originalText) || str(prevRec && prevRec.originalText) || fallback,
        replacementText: str(d.replacementText),
        note: str(d.note), instructorName: str(d.instructorName),
        recordedByUid: who.uid, recordedByName: who.name, recordedByEmail: who.email,
        recordedByRole: who.role,
        at: new Date().toISOString(), active: true, history: hist
      });
      mutate(p.setProgress, function (w, root) {
        w.overrides[rec.discrepancyId] = rec;
        /* Simulation Mode reads its own projection; keep the two in step. */
        applyInterop(root, rec);
      });
      mirrorOverride(who.uid, rec);
      toast('Override recorded. The original stays on screen.', 'success');
      announce('Instructor override recorded. The disputed item can now be scored.', false);
    }, [topicId, p.progress, p.setProgress, who.uid]);

    var revokeOverride = useCallback(function (discId) {
      var prevRec = overrideRecord(p.progress, discId);
      if (!prevRec) { return; }
      var rec = makeOverride(prevRec);
      rec.active = false;
      rec.history = arr(prevRec.history).concat([{
        at: str(prevRec.at), replacementText: str(prevRec.replacementText),
        originalText: str(prevRec.originalText),
        recordedByName: str(prevRec.recordedByName),
        instructorName: str(prevRec.instructorName),
        active: true, revokedAt: new Date().toISOString(),
        revokedByName: who.name, revokedByUid: who.uid
      }]);
      mutate(p.setProgress, function (w, root) {
        w.overrides[str(discId)] = rec;
        applyInterop(root, rec);   /* clears the sim-mode projection, keeps the record */
      });
      mirrorOverride(who.uid, rec);
      toast('Override revoked. The school file applies again; the record is kept.', 'info');
    }, [p.progress, p.setProgress, who.uid, who.name]);

    var drills = useMemo(function () {
      if (!topic) { return {}; }
      return {
        trend: buildTrendSpotter(topic),
        labtriage: buildLabTriage(topic),
        ordercheck: buildOrderCheck(topic),
        alreadydone: buildAlreadyDone(topic),
        abg: buildAbgSprint(topic),
        shock: buildShockMatch(topic),
        sbar: buildSbar(topic),
        lookalike: buildLookAlike(topic)
      };
    }, [topicId]);

    if (!contentOk()) {
      return ce(ContentMissing, {
        missing: (scenariosOk() ? [] : ['data/nur2212-scenarios.js'])
          .concat(studyOk() ? [] : ['data/nur2212-study.js'])
      });
    }
    if (!topic) {
      return ce('div', { className: rootClass(prefs) },
        ce('div', { className: 'sp-empty' },
          'That topic is not in the loaded scenario set.',
          ce('div', { style: { marginTop: 12 } },
            ce('button', {
              type: 'button', className: 'sp-btn go',
              onClick: function () { setTopicId(topics.length ? str(topics[0].topic_id) : ''); }
            }, 'Open the first topic'))));
    }

    var mastery = topicMastery(p.progress, topic);
    var supp = isSupplemental(topic);
    var discs = discrepanciesFor(topic);
    var unresolved = discs.filter(function (d) {
      return d.scope === 'chart' && !isResolved(p.progress, d.id);
    });
    var tabIdx = TABS.map(function (t) { return t.id; }).indexOf(tab);
    if (tabIdx < 0) { tabIdx = 0; }

    function goTab(id) {
      setTab(id);
      recordOpened(p.setProgress, topicId, 'tab:' + id);
      partner.publish('tab_change', { topicId: topicId, label: tabMeta(id).label });
      announce(tabMeta(id).label, false);
    }
    function goTopic(id) {
      setTopicId(id);
      setTab('review');
      setPicker(false);
      partner.publish('topic_change', { topicId: id, label: str(obj(topicById(id)).title) });
    }

    return ce('div', { className: rootClass(prefs) },
      ce('div', { className: 'sp-head' },
        ce('div', { style: { minWidth: 0, flex: '1 1 240px' } },
          ce('h2', null, str(topic.title)),
          ce('div', { className: 'sp-row', style: { marginTop: 6 } },
            ce(ProvBadge, { value: topic.provenance }),
            numOr(topic.duration_minutes, 0)
              ? ce(Badge, { tone: 'acc' }, numOr(topic.duration_minutes, 0) + ' min') : null,
            ce(Badge, { tone: mastery.ready ? 'ok' : 'warn' },
              'Mastery ' + mastery.pct + '%'),
            mastery.dueCount
              ? ce(Badge, { tone: 'bad' }, mastery.dueCount + ' due') : null,
            unresolved.length
              ? ce(NotScored, null, unresolved.length + ' unresolved ' + plural(unresolved.length, 'source issue'))
              : null)),
        ce('div', { className: 'sp-spacer' }),
        ce('div', { className: 'sp-row' },
          ce('button', {
            type: 'button', className: 'sp-btn sm',
            'aria-expanded': picker ? 'true' : 'false',
            onClick: function () { setPicker(!picker); }
          }, 'Switch topic'),
          isFn(p.onNav) ? ce('button', {
            type: 'button', className: 'sp-btn sm ghost',
            onClick: function () { p.onNav('simprep'); }
          }, 'Section hub') : null)),

      ce(SupplementalBar, { on: supp }),
      ce(PartnerStrip, { partner: partner }),

      picker ? ce('div', { className: 'sp-card', style: { marginTop: 10 } },
        ce('h3', null, 'Topics'),
        ce('div', { className: 'sp-grid', style: { marginTop: 8 } }, topics.map(function (t) {
          var m = topicMastery(p.progress, t);
          return ce('button', {
            key: str(t.topic_id), type: 'button',
            className: 'sp-topic' + (isSupplemental(t) ? ' supp' : ''),
            onClick: function () { goTopic(str(t.topic_id)); }
          },
            ce('div', { className: 'sp-row' },
              ce(ProvBadge, { value: t.provenance, short: true }),
              ce(Badge, null, m.pct + '%')),
            ce('div', { className: 'sp-topic-t' }, str(t.title)));
        }))) : null,

      ce('div', { style: { marginTop: 12 } },
        ce(A11yBar, { prefs: prefs, onSet: setPref })),

      ce('div', { className: 'sp-card', style: { marginTop: 12 } },
        ce('div', { className: 'sp-row' },
          ce('h3', { style: { margin: 0 } }, 'Where you actually are'),
          ce('div', { className: 'sp-spacer' }),
          ce(Badge, { tone: mastery.ready ? 'ok' : 'warn' },
            mastery.readyCount + ' / ' + mastery.conceptCount + ' concepts ready')),
        ce(Meter, { value: mastery.pct, ready: mastery.ready, label: 'topic mastery' }),
        ce('div', { className: 'sp-col', style: { marginTop: 10 } },
          arr(mastery.concepts).map(function (r) {
            return ce('div', { key: r.tag, className: 'sp-row' },
              ce(ConfPips, { value: r.conf }),
              ce('span', { className: 'sp-body', style: { flex: '1 1 120px' } }, tagLabel(r.tag)),
              ce('span', { className: 'sp-dim' },
                numOr(r.hits, 0) + ' clean, ' + numOr(r.hintedHits, 0) + ' hinted, ' +
                numOr(r.misses, 0) + ' missed  ·  ' + fmtDue(r.due)));
          })),
        ce('div', { className: 'sp-dim', style: { marginTop: 10 } },
          'Confidence only goes up when you retrieve something without a hint. Opening cards is ' +
          'counted separately and never counts as mastery.')),

      discs.length ? ce('div', { style: { marginTop: 12 } },
        ce(SourceIssuePanel, {
          topic: topic, progress: p.progress, canVerify: who.canVerify,
          onSave: saveOverride, onRevoke: revokeOverride
        })) : null,

      ce('div', { className: 'sp-study', style: { marginTop: 12 } },
        ce('div', { className: 'sp-tabwrap' },
          ce('div', { className: 'sp-tabs', role: 'tablist', 'aria-label': 'Lesson sections' },
            TABS.map(function (t) {
              var rec = conceptOf(p.progress, topicId, t.tag);
              var needs = isDueNow(rec);
              return ce('button', {
                key: t.id, type: 'button', role: 'tab', className: 'sp-tab',
                id: 'sp-tab-' + t.id,
                'aria-selected': tab === t.id ? 'true' : 'false',
                'aria-controls': 'sp-pane-' + t.id,
                onClick: function () { goTab(t.id); }
              }, t.label, needs ? ce('span', {
                className: 'dot', 'aria-label': 'due for review'
              }) : null);
            }))),

        ce('div', {
          className: 'sp-pane', role: 'tabpanel', id: 'sp-pane-' + tab,
          'aria-labelledby': 'sp-tab-' + tab, tabIndex: -1
        },
          ce(SupplementalBar, { on: supp }),
          renderTab(tab, {
            topic: topic, progress: p.progress, setProgress: p.setProgress,
            gate: gate, onGraded: onGraded, onOpened: onOpened, drills: drills
          })),

        ce('div', { className: 'sp-pager' },
          ce('button', {
            type: 'button', className: 'sp-btn', disabled: tabIdx <= 0,
            onClick: function () { goTab(TABS[Math.max(0, tabIdx - 1)].id); }
          }, '‹  ' + (tabIdx > 0 ? TABS[tabIdx - 1].short : 'Start')),
          ce('button', {
            type: 'button', className: 'sp-btn go', disabled: tabIdx >= TABS.length - 1,
            onClick: function () { goTab(TABS[Math.min(TABS.length - 1, tabIdx + 1)].id); }
          }, (tabIdx < TABS.length - 1 ? TABS[tabIdx + 1].short : 'End') + '  ›'))));
  }

  /* ==========================================================================
   * 18. SECTION HUB
   * --------------------------------------------------------------------------
   * The landing page for the whole section: the twelve topics with provenance
   * and per-topic mastery, the cross-topic playbook, the source-rule list, and
   * the doors into the other two modes. Those two modules are built separately;
   * this hub feature-detects them and says so plainly when one is not there,
   * rather than rendering a button that throws.
   * ======================================================================== */

  function modeAvailable(globalName) {
    return typeof window[str(globalName)] === 'function';
  }

  function NotLoadedPanel(props) {
    return ce('div', { className: 'sp-card' },
      ce('h3', null, str(props.title) + ' is not loaded'),
      ce('p', { className: 'sp-sub' },
        'The file that provides it (' + str(props.file) + ') did not download, so this mode is ' +
        'unavailable right now. Study Mode and everything else in this section still work.'),
      ce('div', { className: 'sp-row', style: { marginTop: 10 } },
        ce('button', {
          type: 'button', className: 'sp-btn',
          onClick: function () { try { window.location.reload(); } catch (e) {} }
        }, 'Reload'),
        ce('button', {
          type: 'button', className: 'sp-btn ghost',
          onClick: function () { if (isFn(props.onBack)) { props.onBack(); } }
        }, 'Back to the hub')));
  }

  function PlaybookPanel(props) {
    var pb = playbook();
    var seq = arr(pb.universalSequence);
    var earns = arr(pb.earnsPoints);
    var formula = arr(pb.sbarFormula);
    var talk = arr(pb.selfTalk);
    var patterns = arr(pb.crossTopicPatterns);
    var rules = sourceRules();
    if (!seq.length && !earns.length && !formula.length && !talk.length && !rules.length) {
      return ce('div', { className: 'sp-card' },
        ce('h3', null, 'Cross-topic playbook'),
        ce(EmptyNote, null,
          'The playbook lives in data/nur2212-study.js and has not loaded. Every topic still ' +
          'opens; only this shared section is missing.'));
    }
    return ce('div', null,
      seq.length ? ce('div', { className: 'sp-card' },
        ce('h3', null, 'The sequence that works in all twelve'),
        ce('p', { className: 'sp-sub' },
          'Learn this once and you have the skeleton of every checkoff in the section.'),
        ce('ul', { className: 'sp-list step' }, seq.map(function (s, i) {
          return ce('li', { key: i },
            ce('b', null, str(obj(s).label) || ('Step ' + (numOr(obj(s).n, i + 1)))),
            str(obj(s).text) ? ce('div', { className: 'sp-dim' }, str(obj(s).text)) : null);
        }))) : null,
      formula.length ? ce('div', { className: 'sp-card' },
        ce('h3', null, 'SBAR, as a formula'),
        ce('ul', { className: 'sp-list' }, formula.map(function (f, i) {
          return ce('li', { key: i }, ce('b', null, str(obj(f).letter) || ''), ' ',
            str(obj(f).text || f));
        }))) : null,
      earns.length ? ce('div', { className: 'sp-card' },
        ce('h3', null, 'What earns points'),
        ce('ul', { className: 'sp-list' }, earns.map(function (e, i) {
          return ce('li', { key: i }, str(obj(e).text || e));
        }))) : null,
      talk.length ? ce('div', { className: 'sp-card' },
        ce('h3', null, 'What to say to yourself in the room'),
        ce('ul', { className: 'sp-list' }, talk.map(function (t, i) {
          return ce('li', { key: i }, str(obj(t).text || t));
        }))) : null,
      patterns.length ? ce('div', { className: 'sp-card' },
        ce('h3', null, 'Patterns that repeat'),
        ce('ul', { className: 'sp-list' }, patterns.map(function (t, i) {
          return ce('li', { key: i }, str(obj(t).text || t));
        }))) : null,
      rules.length ? ce('div', { className: 'sp-card' },
        ce('h3', null, 'How this section treats its sources'),
        ce('ul', { className: 'sp-list' }, rules.map(function (r, i) {
          return ce('li', { key: i }, str(r));
        })),
        ce('div', { className: 'sp-row', style: { marginTop: 10 } },
          ce(ProvBadge, { value: 'school_file' }),
          ce(ProvBadge, { value: 'generated_supplemental_practice' }),
          ce(ProvBadge, { value: 'instructor_override' }))) : null);
  }

  function SimPrepHub(props) {
    var p = obj(props);
    injectStyles();

    var who = identityOf(p);
    var screenH = useState('hub');
    var screen = screenH[0], setScreen = screenH[1];
    var tidH = useState(str(p.topicId));
    var topicId = tidH[0], setTopicId = tidH[1];

    var partner = usePartner({ kind: 'hub', topicId: topicId, mode: 'hub' });
    var prefs = stateOf(p.progress).prefs;
    var setPref = useCallback(function (k, v) {
      mutate(p.setProgress, function (w) { w.prefs[str(k)] = v; });
    }, [p.setProgress]);

    if (!contentOk()) {
      return ce(ContentMissing, {
        missing: (scenariosOk() ? [] : ['data/nur2212-scenarios.js'])
          .concat(studyOk() ? [] : ['data/nur2212-study.js'])
      });
    }

    var topics = allTopics();
    var back = function () { setScreen('hub'); };

    if (screen === 'study') {
      return ce(SimPrepStudy, {
        progress: p.progress, setProgress: p.setProgress, authUser: p.authUser,
        isAdmin: p.isAdmin, isSuperAdmin: p.isSuperAdmin, topicId: topicId,
        onNav: function (where) {
          if (str(where) === 'simprep') { back(); }
          else if (isFn(p.onNav)) { p.onNav(where); }
        }
      });
    }
    if (screen === 'sim') {
      if (!modeAvailable('SimPrepSimMode')) {
        return ce('div', { className: rootClass(prefs) },
          ce(NotLoadedPanel, { title: 'Simulation Mode', file: 'js/simprep-sim.js', onBack: back }));
      }
      return ce(window.SimPrepSimMode, {
        progress: p.progress, setProgress: p.setProgress, authUser: p.authUser,
        isAdmin: p.isAdmin, isSuperAdmin: p.isSuperAdmin, topicId: topicId,
        onNav: function (where) { if (str(where) === 'simprep') { back(); } else if (isFn(p.onNav)) { p.onNav(where); } }
      });
    }
    if (screen === 'coach') {
      if (!modeAvailable('SimPrepCoachMode')) {
        return ce('div', { className: rootClass(prefs) },
          ce(NotLoadedPanel, { title: 'Checkoff Coach', file: 'js/simprep-sim.js', onBack: back }));
      }
      return ce(window.SimPrepCoachMode, {
        progress: p.progress, setProgress: p.setProgress, authUser: p.authUser,
        isAdmin: p.isAdmin, isSuperAdmin: p.isSuperAdmin, topicId: topicId,
        onNav: function (where) { if (str(where) === 'simprep') { back(); } else if (isFn(p.onNav)) { p.onNav(where); } }
      });
    }

    var due = dueQueue(p.progress, 6);
    var rollup = tagRollup(p.progress);
    var suppCount = topics.filter(isSupplemental).length;
    var openIssues = 0;
    topics.forEach(function (t) {
      openIssues += discrepanciesFor(t).filter(function (d) {
        return d.scope === 'chart' && !isResolved(p.progress, d.id);
      }).length;
    });

    function open(where, tid) {
      if (tid) { setTopicId(str(tid)); }
      setScreen(where);
    }

    return ce('div', { className: rootClass(prefs) },
      ce('div', { className: 'sp-head' },
        ce('div', { style: { minWidth: 0, flex: '1 1 260px' } },
          ce('h2', null, 'Clinical Simulation Prep'),
          ce('p', { className: 'sp-sub' },
            'NUR2212. Twelve topics, the school\'s own charts, and a twenty-minute checkoff at ' +
            'the end of it. Learn it here, rehearse it next door, and walk in knowing what the ' +
            'proctor is going to ask for.')),
        ce('div', { className: 'sp-spacer' }),
        ce('div', { className: 'sp-row' },
          ce(Badge, { tone: 'acc' }, topics.length + ' topics'),
          suppCount ? ce(Badge, { tone: 'warn' }, suppCount + ' supplemental') : null,
          openIssues ? ce(Badge, { tone: 'bad' }, openIssues + ' source ' + plural(openIssues, 'issue')) : null)),

      ce(PartnerStrip, { partner: partner }),
      ce('div', { style: { marginTop: 10 } }, ce(A11yBar, { prefs: prefs, onSet: setPref })),

      ce('div', { className: 'sp-banner', style: { marginTop: 12 } },
        'Simulation practice only - not for real patient care. Everything in this section is a ' +
        'mannequin, a paper chart and a rehearsal.'),

      ce('div', { className: 'sp-card', style: { marginTop: 12 } },
        ce('h3', null, 'Three ways to work'),
        ce('div', { className: 'sp-modes', style: { marginTop: 8 } },
          ce('button', {
            type: 'button', className: 'sp-mode',
            onClick: function () { open('study', topicId || (topics.length ? topics[0].topic_id : '')); }
          },
            ce('b', null, 'Study Mode'),
            ce('span', null, 'Fourteen tabs a topic, eight retrieval drills built out of the chart, ' +
              'and a schedule that only moves when you actually recall something.')),
          ce('button', {
            type: 'button', className: 'sp-mode',
            disabled: !modeAvailable('SimPrepSimMode'),
            onClick: function () { open('sim', topicId || (topics.length ? topics[0].topic_id : '')); }
          },
            ce('b', null, 'Simulation Mode'),
            ce('span', null, modeAvailable('SimPrepSimMode')
              ? 'The stateful patient. Assess, act, reassess, escalate - uncoached unless you turn hints on.'
              : 'Not loaded (js/simprep-sim.js). Everything else in this section still works.')),
          ce('button', {
            type: 'button', className: 'sp-mode',
            disabled: !modeAvailable('SimPrepCoachMode'),
            onClick: function () { open('coach', topicId || (topics.length ? topics[0].topic_id : '')); }
          },
            ce('b', null, 'Checkoff Coach'),
            ce('span', null, modeAvailable('SimPrepCoachMode')
              ? 'Glanceable in the room: checklist, timer, chart, emergency cues, and one hint at a time.'
              : 'Not loaded (js/simprep-sim.js). Everything else in this section still works.')))),

      due.length ? ce('div', { className: 'sp-card' },
        ce('h3', null, 'Due now'),
        ce('p', { className: 'sp-sub' },
          'Weakest concept first, not whichever topic you opened last.'),
        ce('div', { className: 'sp-col', style: { marginTop: 8 } }, due.map(function (r) {
          var t = topicById(r.topicId);
          return ce('button', {
            key: r.key, type: 'button', className: 'sp-opt',
            onClick: function () { open('study', r.topicId); }
          },
            ce('span', { className: 'mk', 'aria-hidden': 'true' }, String(r.conf)),
            ce('span', { className: 'tx' },
              ce('b', null, r.label),
              ce('span', { className: 'sub' },
                (t ? cut(str(t.title), 60) : r.topicId) + '  ·  ' + fmtDue(r.due))));
        }))) : null,

      ce('div', { className: 'sp-card' },
        ce('div', { className: 'sp-row' },
          ce('h3', { style: { margin: 0 } }, 'The twelve topics'),
          ce('div', { className: 'sp-spacer' }),
          ce('span', { className: 'sp-row' },
            ce(ProvBadge, { value: 'school_file', short: true }),
            ce(ProvBadge, { value: 'generated_supplemental_practice', short: true }))),
        ce('div', { className: 'sp-grid', style: { marginTop: 10 } }, topics.map(function (t) {
          var m = topicMastery(p.progress, t);
          var supp = isSupplemental(t);
          var issues = discrepanciesFor(t).filter(function (d) {
            return d.scope === 'chart' && !isResolved(p.progress, d.id);
          }).length;
          return ce('button', {
            key: str(t.topic_id), type: 'button',
            className: 'sp-topic' + (supp ? ' supp' : ''),
            onClick: function () { open('study', str(t.topic_id)); },
            'aria-label': str(t.title) + '. ' + provMeta(t.provenance).label + '. Mastery ' +
              m.pct + ' percent. ' + (issues ? issues + ' unresolved source issues.' : '')
          },
            ce('div', { className: 'sp-row' },
              ce(ProvBadge, { value: t.provenance, short: true }),
              numOr(t.duration_minutes, 0)
                ? ce(Badge, null, numOr(t.duration_minutes, 0) + ' min') : null,
              issues ? ce(Badge, { tone: 'bad' }, issues + ' source ' + plural(issues, 'issue')) : null,
              m.dueCount ? ce(Badge, { tone: 'warn' }, m.dueCount + ' due') : null),
            ce('div', { className: 'sp-topic-t' }, str(t.title)),
            supp ? ce('div', { className: 'sp-suppbar', style: { fontSize: '0.72em' } },
              ce('span', { 'aria-hidden': 'true' }, '◇'), supplementalLabel()) : null,
            ce('div', { className: 'sp-topic-s' }, firstSentence(t.case_intro, 150)),
            ce(Meter, { value: m.pct, ready: m.ready, label: str(t.title) + ' mastery' }),
            ce('div', { className: 'sp-dim' },
              m.readyCount + ' / ' + m.conceptCount + ' concepts ready' +
              (m.ready ? '  ·  ready for the checkoff' : '')));
        }))),

      rollup.length ? ce('div', { className: 'sp-card' },
        ce('h3', null, 'Weakest concepts across every topic'),
        ce('div', { className: 'sp-col', style: { marginTop: 8 } }, rollup.slice(0, 8).map(function (r) {
          return ce('div', { key: r.tag, className: 'sp-row' },
            ce(ConfPips, { value: Math.round(r.avg) }),
            ce('span', { className: 'sp-body', style: { flex: '1 1 130px' } }, r.label),
            ce('span', { className: 'sp-dim' },
              'avg ' + (Math.round(r.avg * 10) / 10) + ' / 5 across ' + r.n + ' ' +
              plural(r.n, 'topic') + (r.due ? '  ·  ' + r.due + ' due' : '')));
        }))) : null,

      ce(PlaybookPanel, null),

      openIssues ? ce('div', { className: 'sp-card' },
        ce('h3', null, '⚠  Unresolved source issues'),
        ce('p', { className: 'sp-sub' },
          'Every item these touch is shown and NOT scored until an instructor override is ' +
          'recorded against it. Open the topic to read the issue and record one.'),
        topics.map(function (t) {
          var open2 = discrepanciesFor(t).filter(function (d) {
            return d.scope === 'chart' && !isResolved(p.progress, d.id);
          });
          if (!open2.length) { return null; }
          return ce('div', { key: str(t.topic_id), className: 'sp-li' },
            ce('span', { className: 'tx' },
              ce('b', null, str(t.title)),
              open2.map(function (d) {
                return ce('div', { key: d.id, className: 'sp-dim' }, '• ' + cut(d.text, 160));
              })),
            ce('button', {
              type: 'button', className: 'sp-btn sm',
              onClick: function () { open('study', str(t.topic_id)); }
            }, 'Open'));
        })) : null);
  }

  /* ==========================================================================
   * 19. EXPORTS
   * The logic hangs off the components so it can be unit tested without React,
   * and so the sibling modules (simprep-sim, simprep-partner) can reuse the
   * provenance, discrepancy and mastery rules instead of reimplementing them.
   * ======================================================================== */

  /* content */
  SimPrepStudy.allTopics = allTopics;
  SimPrepStudy.topicById = topicById;
  SimPrepStudy.contentOk = contentOk;
  SimPrepStudy.scenariosOk = scenariosOk;
  SimPrepStudy.studyOk = studyOk;
  SimPrepStudy.flashcardsFor = flashcardsFor;
  SimPrepStudy.quizzesFor = quizzesFor;
  SimPrepStudy.playbook = playbook;

  /* provenance + source integrity */
  SimPrepStudy.PROV = PROV;
  SimPrepStudy.provMeta = provMeta;
  SimPrepStudy.isSupplemental = isSupplemental;
  SimPrepStudy.SUPPLEMENTAL_LABEL = supplementalLabel();
  SimPrepStudy.discrepanciesFor = discrepanciesFor;
  SimPrepStudy.disputesOn = disputesOn;
  SimPrepStudy.disputeWeight = disputeWeight;
  SimPrepStudy.DISPUTE_THRESHOLD = DISPUTE_THRESHOLD;
  SimPrepStudy.scoreGate = scoreGate;

  /* overrides */
  SimPrepStudy.makeOverride = makeOverride;
  SimPrepStudy.activeOverride = activeOverride;
  SimPrepStudy.overrideRecord = overrideRecord;
  SimPrepStudy.isResolved = isResolved;
  SimPrepStudy.interopOverride = interopOverride;
  SimPrepStudy.applyInterop = applyInterop;
  SimPrepStudy.INTEROP_KEY = INTEROP_KEY;
  SimPrepStudy.OVERRIDE_PATH = OVERRIDE_PATH;
  SimPrepStudy.OVERRIDE_RULES = OVERRIDE_RULES;

  /* mastery */
  SimPrepStudy.TAGS = TAGS;
  SimPrepStudy.tagKey = tagKey;
  SimPrepStudy.tagLabel = tagLabel;
  SimPrepStudy.conceptKey = conceptKey;
  SimPrepStudy.conceptOf = conceptOf;
  SimPrepStudy.conceptsForTopic = conceptsForTopic;
  SimPrepStudy.gradeConcept = gradeConcept;
  SimPrepStudy.recordAttempt = recordAttempt;
  SimPrepStudy.recordOpened = recordOpened;
  SimPrepStudy.topicMastery = topicMastery;
  SimPrepStudy.tagRollup = tagRollup;
  SimPrepStudy.dueQueue = dueQueue;
  SimPrepStudy.isDueNow = isDueNow;
  SimPrepStudy.stateOf = stateOf;
  SimPrepStudy.mutate = mutate;
  SimPrepStudy.DEFAULT_INTERVALS = DEFAULT_INTERVALS;
  SimPrepStudy.intervalsOf = intervalsOf;
  SimPrepStudy.dueAt = dueAt;
  SimPrepStudy.MAX_CONF = MAX_CONF;
  SimPrepStudy.HIGH_CONF = HIGH_CONF;
  SimPrepStudy.READY_CONF = READY_CONF;
  SimPrepStudy.READY_REPS = READY_REPS;
  SimPrepStudy.SAME_SESSION_MS = SAME_SESSION_MS;

  /* drills */
  SimPrepStudy.TABS = TABS;
  SimPrepStudy.DRILLS = DRILLS;
  SimPrepStudy.drillMeta = drillMeta;
  SimPrepStudy.buildDrill = buildDrill;
  SimPrepStudy.buildTrendSpotter = buildTrendSpotter;
  SimPrepStudy.buildLabTriage = buildLabTriage;
  SimPrepStudy.buildOrderCheck = buildOrderCheck;
  SimPrepStudy.buildAlreadyDone = buildAlreadyDone;
  SimPrepStudy.buildAbgSprint = buildAbgSprint;
  SimPrepStudy.buildShockMatch = buildShockMatch;
  SimPrepStudy.buildSbar = buildSbar;
  SimPrepStudy.buildLookAlike = buildLookAlike;
  SimPrepStudy.gradeSbar = gradeSbar;
  SimPrepStudy.interpretAbg = interpretAbg;
  SimPrepStudy.abgFrom = abgFrom;
  SimPrepStudy.shockTypeOf = shockTypeOf;
  SimPrepStudy.labUrgency = labUrgency;
  SimPrepStudy.labScore = labScore;
  SimPrepStudy.LOOKALIKE_GROUPS = LOOKALIKE_GROUPS;

  /* components */
  SimPrepStudy.modeAvailable = modeAvailable;
  SimPrepStudy.renderTab = renderTab;
  SimPrepStudy.SourceIssuePanel = SourceIssuePanel;
  SimPrepStudy.FlashcardDeck = FlashcardDeck;
  SimPrepStudy.QuizRunner = QuizRunner;
  SimPrepStudy.TeachBack = TeachBack;
  SimPrepStudy.ProvBadge = ProvBadge;

  SimPrepHub.PlaybookPanel = PlaybookPanel;
  SimPrepHub.modeAvailable = modeAvailable;
  SimPrepHub.Study = SimPrepStudy;
  /* Same helpers, reachable from either entry point. */
  keysOf(SimPrepStudy).forEach(function (k) {
    if (SimPrepHub[k] === undefined) { SimPrepHub[k] = SimPrepStudy[k]; }
  });

  window.SimPrepStudy = SimPrepStudy;
  window.SimPrepHub = SimPrepHub;
})();
