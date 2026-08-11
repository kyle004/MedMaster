/* =============================================================================
 * js/medadmin-trainer.js — Medication Administration Signoff Trainer
 * -----------------------------------------------------------------------------
 * Exports: window.MedAdminTrainer  (top-level page component)
 *
 * Modes:
 *   1. MAR Simulation        — work a real MAR through the full 17-step procedure
 *   2. Rubric Practice       — the official 40-point rubric, item by item
 *   3. Six Rights & 3 Checks — timed rapid-fire drill
 *   4. Injection Skills      — route reference + clickable site selector
 *   5. Drug Reference & Quiz — 37 drugs, searchable, plus a quiz
 *   6. Signoff Readiness     — full mock checkoff, timed, strictly graded
 *
 * Data:   window.MEDADMIN_RUBRIC / _SKILLS / _MAR_CASES / _DRUGS
 * Runtime: window.MM (all members feature-detected)
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof React === 'undefined' || !React.createElement) { return; }

  var ce = React.createElement;
  var useState = React.useState, useEffect = React.useEffect,
      useRef = React.useRef, useMemo = React.useMemo,
      useCallback = React.useCallback;

  /* ==========================================================================
   * 0. DATA ACCESSORS + SMALL UTILITIES
   * ======================================================================== */

  function RUBRIC() {
    return window.MEDADMIN_RUBRIC || { totalPoints: 40, scoreMultiplier: 2.5, maxAttempts: 2, sections: [], criticalErrors: [], outcomes: [] };
  }
  function SKILLS() {
    return window.MEDADMIN_SKILLS || { routes: [], sixRights: [], additionalRights: [], threeChecks: [], generalPrinciples: [], highAlertPractices: [] };
  }
  function CASES() { return window.MEDADMIN_MAR_CASES || []; }
  function DRUGS() { return window.MEDADMIN_DRUGS || []; }

  function mm() { return window.MM || {}; }
  function toast(msg, type) {
    var M = mm();
    if (M && typeof M.toast === 'function') { try { M.toast(msg, type || 'info'); } catch (e) {} }
  }

  var RUBRIC_ITEMS_CACHE = null;
  function allRubricItems() {
    if (RUBRIC_ITEMS_CACHE) return RUBRIC_ITEMS_CACHE;
    var out = [];
    (RUBRIC().sections || []).forEach(function (sec) {
      (sec.items || []).forEach(function (it) {
        var copy = {};
        for (var k in it) { if (Object.prototype.hasOwnProperty.call(it, k)) copy[k] = it[k]; }
        copy.sectionId = sec.id;
        copy.sectionTitle = sec.title;
        out.push(copy);
      });
    });
    RUBRIC_ITEMS_CACHE = out;
    return out;
  }
  function rubricItem(id) {
    var all = allRubricItems();
    for (var i = 0; i < all.length; i++) { if (all[i].id === id) return all[i]; }
    return { id: id, title: id, critical: false, levels: {}, description: '', teachingPoint: '' };
  }
  function criticalErrorDef(code) {
    var list = RUBRIC().criticalErrors || [];
    for (var i = 0; i < list.length; i++) { if (list[i].id === code) return list[i]; }
    return { id: code, text: code, explanation: '' };
  }

  function hashStr(s) {
    var h = 2166136261, i;
    s = String(s || '');
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function seededShuffle(arr, seed) {
    var a = arr.slice(), s = (seed >>> 0) || 1, i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      j = s % (i + 1); t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function fmtSec(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  /* ---- progress -------------------------------------------------------- */
  function getProgress() {
    var M = mm();
    if (M && typeof M.getProgress === 'function') {
      try { return M.getProgress() || {}; } catch (e) { return {}; }
    }
    return {};
  }
  function updateProgress(fn) {
    var M = mm();
    if (M && typeof M.setProgress === 'function') {
      try { M.setProgress(fn); return true; } catch (e) { return false; }
    }
    return false;
  }
  function shallow(o) {
    var out = {}, k;
    o = o || {};
    for (k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k]; }
    return out;
  }

  /**
   * Persist one graded run.
   * result = { caseId, medIds, mode, date, score, maxScore, pct, criticalErrors[], passed,
   *            timeSec, rubricScores{}, drugs[] }
   */
  function saveResult(result) {
    updateProgress(function (p) {
      var np = shallow(p);
      var list = (np.medAdminResults || []).slice();
      list.push(result);
      if (list.length > 250) list = list.slice(-250);
      np.medAdminResults = list;

      var stats = shallow(np.medAdminStats);
      /* per-rubric-item mastery */
      var rm = shallow(stats.rubric);
      var rs = result.rubricScores || {}, k;
      for (k in rs) {
        if (!Object.prototype.hasOwnProperty.call(rs, k)) continue;
        var cur = rm[k] ? shallow(rm[k]) : { n: 0, sum: 0, zeros: 0 };
        cur.n += 1; cur.sum += rs[k];
        if (rs[k] === 0) cur.zeros += 1;
        rm[k] = cur;
      }
      stats.rubric = rm;

      /* per-drug mastery */
      var dm = shallow(stats.drugs);
      (result.drugs || []).forEach(function (d) {
        var c = dm[d] ? shallow(dm[d]) : { n: 0, clean: 0 };
        c.n += 1;
        if (result.passed) c.clean += 1;
        dm[d] = c;
      });
      stats.drugs = dm;
      stats.lastRun = result.date;
      np.medAdminStats = stats;
      return np;
    });

    var M = mm();
    if (M && typeof M.recordActivity === 'function') {
      try {
        M.recordActivity('medadmin', {
          caseId: result.caseId, pct: result.pct, passed: result.passed, mode: result.mode
        });
      } catch (e) {}
    }
  }

  function savedResults() {
    var p = getProgress();
    return (p && p.medAdminResults) ? p.medAdminResults : [];
  }
  function savedStats() {
    var p = getProgress();
    return (p && p.medAdminStats) ? p.medAdminStats : { rubric: {}, drugs: {} };
  }

  /* ==========================================================================
   * 1. STYLES
   * ======================================================================== */
  function injectStyles() {
    if (document.getElementById('medadmin-trainer-styles')) return;
    var st = document.createElement('style');
    st.id = 'medadmin-trainer-styles';
    st.textContent = [
      /* ---- shell ---- */
      '.ma-wrap{max-width:1040px;margin:0 auto;padding:0 0 64px;color:var(--text);}',
      '.ma-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;}',
      '.ma-h1{font-size:1.45rem;font-weight:800;margin:0 0 4px;letter-spacing:-0.01em;}',
      '.ma-sub{color:var(--text2);font-size:0.86rem;margin:0;line-height:1.5;max-width:62ch;}',
      '.ma-btn{font:inherit;font-size:0.85rem;font-weight:600;color:var(--text);background:var(--surface2);border:1px solid var(--surface2);border-radius:9px;padding:8px 13px;cursor:pointer;transition:background .12s,border-color .12s;line-height:1.3;}',
      '.ma-btn:hover{background:var(--bg);}',
      '.ma-btn:focus-visible,.ma-opt:focus-visible,.ma-modecard:focus-visible,.ma-tab:focus-visible,.ma-hot:focus-visible,.ma-input:focus-visible,.ma-drugrow:focus-visible{outline:3px solid var(--accent);outline-offset:2px;}',
      '.ma-btn[disabled]{opacity:.45;cursor:not-allowed;}',
      '.ma-btn-primary{background:var(--accent);border-color:var(--accent);color:var(--text);}',
      '.ma-btn-primary:hover{background:var(--accent2);border-color:var(--accent2);}',
      '.ma-btn-danger{background:var(--red);border-color:var(--red);color:var(--text);}',
      '.ma-btn-ghost{background:transparent;border-color:var(--surface2);color:var(--text2);}',
      '.ma-btn-ghost:hover{color:var(--text);background:var(--surface);}',
      '.ma-btn-sm{padding:5px 10px;font-size:0.78rem;}',
      '.ma-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}',
      '.ma-card{background:var(--surface);border:1px solid var(--surface2);border-radius:13px;padding:16px;margin-bottom:14px;}',
      '.ma-card-t{font-size:0.95rem;font-weight:700;margin:0 0 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.ma-muted{color:var(--text2);font-size:0.83rem;line-height:1.6;}',
      '.ma-tiny{color:var(--text3);font-size:0.74rem;letter-spacing:.05em;text-transform:uppercase;font-weight:700;}',
      /* ---- mode grid ---- */
      '.ma-modegrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:12px;}',
      '.ma-modecard{text-align:left;background:var(--surface);border:1px solid var(--surface2);border-radius:13px;padding:15px;cursor:pointer;font:inherit;color:var(--text);display:flex;flex-direction:column;gap:6px;transition:border-color .14s,transform .14s;}',
      '.ma-modecard:hover{border-color:var(--accent);transform:translateY(-2px);}',
      '.ma-modeicon{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:26px;padding:0 8px;border-radius:6px;background:var(--surface2);color:var(--text2);font-size:0.72rem;font-weight:800;letter-spacing:.06em;align-self:flex-start;}',
      '.ma-modecard:hover .ma-modeicon{background:var(--accent);color:var(--text);}',
      '.ma-modename{font-weight:700;font-size:0.95rem;}',
      '.ma-modedesc{color:var(--text2);font-size:0.79rem;line-height:1.5;}',
      /* ---- tabs / filters ---- */
      '.ma-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}',
      '.ma-tab{font:inherit;font-size:0.8rem;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid var(--surface2);background:var(--surface);color:var(--text2);cursor:pointer;}',
      '.ma-tab.on{background:var(--accent);border-color:var(--accent);color:var(--text);}',
      /* ---- tags ---- */
      '.ma-tag{display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;font-weight:700;letter-spacing:.03em;padding:2px 8px;border-radius:999px;border:1px solid var(--surface2);color:var(--text2);background:var(--bg);text-transform:uppercase;white-space:nowrap;}',
      '.ma-tag.red{color:var(--red);border-color:var(--red);}',
      '.ma-tag.green{color:var(--green);border-color:var(--green);}',
      '.ma-tag.orange{color:var(--orange);border-color:var(--orange);}',
      '.ma-tag.blue{color:var(--accent);border-color:var(--accent);}',
      /* ---- MAR chart ---- */
      '.ma-chart{background:var(--surface);border:1px solid var(--surface2);border-radius:13px;overflow:hidden;margin-bottom:14px;}',
      '.ma-chart-bar{background:var(--surface2);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;}',
      '.ma-chart-bar b{font-size:0.8rem;letter-spacing:.08em;text-transform:uppercase;}',
      '.ma-pt{padding:14px;border-bottom:1px solid var(--surface2);}',
      '.ma-pt-name{font-size:1.1rem;font-weight:800;margin:0 0 6px;}',
      '.ma-pt-meta{display:flex;gap:6px 16px;flex-wrap:wrap;font-size:0.8rem;color:var(--text2);}',
      '.ma-pt-meta span b{color:var(--text);font-weight:600;}',
      '.ma-allergy{margin:12px 0 0;border:2px solid var(--red);background:rgba(239,68,68,0.12);border-radius:10px;padding:10px 12px;display:flex;gap:10px;align-items:flex-start;}',
      '.ma-allergy-ic{font-size:1.1rem;line-height:1.2;}',
      '.ma-allergy-lbl{font-size:0.68rem;font-weight:800;letter-spacing:.12em;color:var(--red);text-transform:uppercase;display:block;margin-bottom:2px;}',
      '.ma-allergy-val{font-size:0.98rem;font-weight:800;color:var(--red);line-height:1.4;}',
      '.ma-allergy.nkda{border-color:var(--surface2);background:var(--bg);}',
      '.ma-allergy.nkda .ma-allergy-lbl,.ma-allergy.nkda .ma-allergy-val{color:var(--text2);}',
      '.ma-panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:1px;background:var(--surface2);border-bottom:1px solid var(--surface2);}',
      '.ma-panel{background:var(--surface);padding:12px 14px;}',
      '.ma-panel h4{margin:0 0 8px;font-size:0.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);font-weight:800;}',
      '.ma-kv{display:flex;justify-content:space-between;gap:10px;font-size:0.8rem;padding:2px 0;border-bottom:1px dotted var(--surface2);}',
      '.ma-kv:last-child{border-bottom:none;}',
      '.ma-kv span{color:var(--text2);}',
      '.ma-kv b{font-weight:700;text-align:right;}',
      '.ma-kv.flag b{color:var(--orange);}',
      '.ma-note{padding:12px 14px;font-size:0.82rem;line-height:1.65;color:var(--text2);border-bottom:1px solid var(--surface2);}',
      '.ma-note b{color:var(--text);}',
      /* ---- MAR grid ---- */
      '.ma-marhead,.ma-marrow{display:grid;grid-template-columns:minmax(150px,2.1fr) 1fr 0.8fr 1fr minmax(120px,1.1fr) auto;gap:10px;align-items:center;padding:10px 14px;}',
      '.ma-marhead{background:var(--bg);font-size:0.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);font-weight:800;}',
      '.ma-marrow{border-top:1px solid var(--surface2);text-align:left;width:100%;background:var(--surface);border-left:none;border-right:none;border-bottom:none;font:inherit;color:var(--text);cursor:pointer;}',
      '.ma-marrow:hover{background:var(--surface2);}',
      '.ma-marrow.done{opacity:.62;}',
      '.ma-marrow .ma-lbl{display:none;font-size:0.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);font-weight:800;margin-right:6px;}',
      '.ma-mname{font-weight:700;font-size:0.88rem;line-height:1.35;}',
      '.ma-mcell{font-size:0.8rem;color:var(--text2);}',
      '.ma-times{display:flex;gap:4px;flex-wrap:wrap;}',
      '.ma-time{font-size:0.68rem;font-weight:700;border:1px solid var(--surface2);border-radius:5px;padding:2px 5px;color:var(--text3);}',
      '.ma-time.due{border-color:var(--accent);color:var(--accent);background:rgba(59,130,246,0.12);}',
      '.ma-time.prn{border-style:dashed;}',
      '.ma-go{font-size:0.74rem;font-weight:800;color:var(--accent);white-space:nowrap;}',
      '@media (max-width:720px){',
      '.ma-marhead{display:none;}',
      '.ma-marrow{display:block;padding:12px 14px;}',
      '.ma-marrow > *{display:block;margin-bottom:5px;}',
      '.ma-marrow .ma-lbl{display:inline-block;}',
      '.ma-panels{grid-template-columns:1fr;}',
      '}',
      /* ---- steps ---- */
      '.ma-stepbar{display:flex;gap:3px;margin-bottom:12px;flex-wrap:wrap;}',
      '.ma-stepdot{height:5px;flex:1 1 8px;min-width:8px;border-radius:3px;background:var(--surface2);}',
      '.ma-stepdot.ok{background:var(--green);}',
      '.ma-stepdot.part{background:var(--orange);}',
      '.ma-stepdot.bad{background:var(--red);}',
      '.ma-stepdot.now{background:var(--accent);}',
      '.ma-phase{font-size:0.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:800;margin-bottom:4px;}',
      '.ma-steptitle{font-size:1.05rem;font-weight:800;margin:0 0 8px;}',
      '.ma-prompt{font-size:0.9rem;line-height:1.65;color:var(--text);margin:0 0 12px;}',
      '.ma-opts{display:flex;flex-direction:column;gap:8px;}',
      '.ma-opt{text-align:left;font:inherit;font-size:0.86rem;line-height:1.55;color:var(--text);background:var(--bg);border:1px solid var(--surface2);border-radius:10px;padding:11px 13px;cursor:pointer;display:flex;gap:10px;align-items:flex-start;transition:border-color .12s,background .12s;}',
      '.ma-opt:hover:not([disabled]){border-color:var(--accent);}',
      '.ma-opt[disabled]{cursor:default;}',
      '.ma-opt-mark{flex:0 0 20px;height:20px;border-radius:5px;border:2px solid var(--surface2);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:900;margin-top:1px;}',
      '.ma-opt.sel .ma-opt-mark{border-color:var(--accent);background:var(--accent);color:var(--text);}',
      '.ma-opt.good{border-color:var(--green);background:rgba(34,197,94,0.09);}',
      '.ma-opt.good .ma-opt-mark{border-color:var(--green);background:var(--green);color:var(--bg);}',
      '.ma-opt.part{border-color:var(--orange);background:rgba(245,158,11,0.09);}',
      '.ma-opt.part .ma-opt-mark{border-color:var(--orange);background:var(--orange);color:var(--bg);}',
      '.ma-opt.bad{border-color:var(--red);background:rgba(239,68,68,0.09);}',
      '.ma-opt.bad .ma-opt-mark{border-color:var(--red);background:var(--red);color:var(--text);}',
      '.ma-opt.dim{opacity:.5;}',
      '.ma-fb{margin-top:12px;border-radius:10px;padding:12px 14px;font-size:0.85rem;line-height:1.65;border-left:4px solid var(--surface2);background:var(--bg);}',
      '.ma-fb.good{border-left-color:var(--green);}',
      '.ma-fb.part{border-left-color:var(--orange);}',
      '.ma-fb.bad{border-left-color:var(--red);}',
      '.ma-fb-t{font-weight:800;font-size:0.78rem;letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:6px;}',
      '.ma-fb.good .ma-fb-t{color:var(--green);}',
      '.ma-fb.part .ma-fb-t{color:var(--orange);}',
      '.ma-fb.bad .ma-fb-t{color:var(--red);}',
      '.ma-teach{margin-top:10px;padding-top:10px;border-top:1px dashed var(--surface2);color:var(--text2);font-size:0.82rem;line-height:1.65;}',
      /* ---- score bar ---- */
      '.ma-scorebar{position:sticky;top:0;z-index:20;display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:var(--surface);border:1px solid var(--surface2);border-radius:11px;padding:9px 12px;margin-bottom:12px;}',
      '.ma-sc{font-size:0.76rem;font-weight:700;color:var(--text2);}',
      '.ma-sc b{color:var(--text);font-size:0.95rem;}',
      '.ma-critind{margin-left:auto;font-size:0.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:999px;border:1px solid var(--green);color:var(--green);}',
      '.ma-critind.hit{border-color:var(--red);color:var(--text);background:var(--red);}',
      /* ---- critical error state ---- */
      '.ma-crit{border:2px solid var(--red);background:rgba(239,68,68,0.10);border-radius:13px;overflow:hidden;margin-bottom:14px;}',
      '.ma-crit-h{background:var(--red);color:var(--text);padding:14px 16px;}',
      '.ma-crit-h .k{font-size:0.7rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;opacity:.92;}',
      '.ma-crit-h .t{font-size:1.2rem;font-weight:900;margin-top:3px;line-height:1.3;}',
      '.ma-crit-b{padding:16px;}',
      '.ma-crit-sec{margin-bottom:14px;}',
      '.ma-crit-sec:last-child{margin-bottom:0;}',
      '.ma-crit-sec h5{margin:0 0 5px;font-size:0.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--red);font-weight:800;}',
      '.ma-crit-sec p{margin:0;font-size:0.87rem;line-height:1.7;color:var(--text);}',
      /* ---- lists ---- */
      '.ma-ul{margin:6px 0 0;padding-left:18px;font-size:0.83rem;line-height:1.7;color:var(--text2);}',
      '.ma-ul li{margin-bottom:3px;}',
      '.ma-ul li b{color:var(--text);}',
      /* ---- drill ---- */
      '.ma-drill{background:var(--surface);border:1px solid var(--surface2);border-radius:13px;padding:18px;}',
      '.ma-drill-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;}',
      '.ma-drill-clock{font-size:1.6rem;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;}',
      '.ma-drill-clock.low{color:var(--red);}',
      '.ma-timerbar{height:6px;border-radius:3px;background:var(--surface2);overflow:hidden;margin-bottom:14px;}',
      '.ma-timerfill{height:100%;background:var(--accent);transition:width .3s linear;}',
      '.ma-timerfill.low{background:var(--red);}',
      '.ma-streak{font-size:0.8rem;font-weight:800;color:var(--orange);}',
      '.ma-drill-q{font-size:1rem;line-height:1.6;font-weight:600;background:var(--bg);border-radius:11px;padding:15px;margin-bottom:12px;border-left:4px solid var(--accent2);}',
      '.ma-drill-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;}',
      '.ma-big{display:flex;gap:14px;flex-wrap:wrap;}',
      '.ma-stat{flex:1 1 92px;background:var(--bg);border:1px solid var(--surface2);border-radius:10px;padding:10px;text-align:center;}',
      '.ma-stat b{display:block;font-size:1.3rem;font-weight:900;}',
      '.ma-stat span{font-size:0.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);font-weight:700;}',
      /* ---- body svg ---- */
      '.ma-bodywrap{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;}',
      '.ma-bodysvg{flex:0 0 auto;width:220px;max-width:100%;background:var(--bg);border:1px solid var(--surface2);border-radius:12px;padding:8px;}',
      '.ma-hot{cursor:pointer;fill:var(--surface2);stroke:var(--text3);stroke-width:1.5;opacity:.85;transition:fill .12s;}',
      '.ma-hot:hover{fill:var(--accent);}',
      '.ma-hot.ok{fill:var(--green);stroke:var(--green);}',
      '.ma-hot.no{fill:var(--red);stroke:var(--red);}',
      '.ma-bodyside{flex:1 1 240px;min-width:0;}',
      /* ---- drugs ---- */
      '.ma-input{font:inherit;font-size:0.86rem;color:var(--text);background:var(--bg);border:1px solid var(--surface2);border-radius:9px;padding:9px 12px;width:100%;}',
      '.ma-input::placeholder{color:var(--text3);}',
      '.ma-drugrow{width:100%;text-align:left;font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--surface2);border-radius:11px;padding:12px 14px;cursor:pointer;margin-bottom:8px;}',
      '.ma-drugrow:hover{border-color:var(--accent);}',
      '.ma-drugrow-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;}',
      '.ma-drugname{font-weight:700;font-size:0.93rem;}',
      '.ma-drugbrand{color:var(--text3);font-weight:500;font-size:0.8rem;}',
      '.ma-drugclass{color:var(--text2);font-size:0.78rem;margin-top:3px;line-height:1.45;}',
      '.ma-detail{margin-top:12px;padding-top:12px;border-top:1px solid var(--surface2);}',
      '.ma-dsec{margin-bottom:11px;}',
      '.ma-dsec h5{margin:0 0 4px;font-size:0.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);font-weight:800;}',
      '.ma-dsec p{margin:0;font-size:0.83rem;line-height:1.65;color:var(--text2);}',
      '.ma-pearl{background:rgba(139,92,246,0.10);border-left:4px solid var(--accent2);border-radius:8px;padding:10px 12px;font-size:0.83rem;line-height:1.65;}',
      /* ---- rubric ---- */
      '.ma-lvls{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin:10px 0;}',
      '.ma-lvl{font:inherit;text-align:left;background:var(--bg);border:1px solid var(--surface2);border-radius:9px;padding:9px 11px;cursor:pointer;color:var(--text2);font-size:0.8rem;line-height:1.5;}',
      '.ma-lvl:hover{border-color:var(--accent);}',
      '.ma-lvl b{display:block;color:var(--text);font-size:0.72rem;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px;}',
      '.ma-lvl.on0{border-color:var(--red);background:rgba(239,68,68,0.10);color:var(--text);}',
      '.ma-lvl.on1{border-color:var(--orange);background:rgba(245,158,11,0.10);color:var(--text);}',
      '.ma-lvl.on2{border-color:var(--green);background:rgba(34,197,94,0.10);color:var(--text);}',
      '.ma-item{border:1px solid var(--surface2);border-radius:11px;padding:13px;margin-bottom:10px;background:var(--surface);}',
      '.ma-item.crit{border-left:4px solid var(--red);}',
      /* ---- verdict ---- */
      '.ma-verdict{border-radius:13px;padding:20px;text-align:center;margin-bottom:14px;border:2px solid var(--surface2);}',
      '.ma-verdict.pass{border-color:var(--green);background:rgba(34,197,94,0.10);}',
      '.ma-verdict.fail{border-color:var(--red);background:rgba(239,68,68,0.10);}',
      '.ma-verdict .v{font-size:2rem;font-weight:900;letter-spacing:.02em;line-height:1;}',
      '.ma-verdict.pass .v{color:var(--green);}',
      '.ma-verdict.fail .v{color:var(--red);}',
      '.ma-verdict .p{font-size:1.05rem;font-weight:700;margin-top:6px;}',
      '.ma-verdict .r{font-size:0.82rem;color:var(--text2);margin-top:8px;line-height:1.6;}',
      /* ---- AI ---- */
      '.ma-ai{border:1px dashed var(--accent2);border-radius:11px;padding:12px;margin-top:12px;background:rgba(139,92,246,0.06);}',
      '.ma-ai-out{margin-top:10px;font-size:0.85rem;line-height:1.7;white-space:pre-wrap;color:var(--text);background:var(--bg);border-radius:9px;padding:11px 13px;max-height:340px;overflow:auto;}',
      /* ---- misc ---- */
      '.ma-bars{display:flex;flex-direction:column;gap:6px;}',
      '.ma-bar{display:grid;grid-template-columns:minmax(110px,1.4fr) 1fr auto;gap:9px;align-items:center;font-size:0.78rem;}',
      '.ma-bar-t{height:7px;border-radius:4px;background:var(--surface2);overflow:hidden;}',
      '.ma-bar-f{height:100%;background:var(--green);}',
      '.ma-bar-f.mid{background:var(--orange);}',
      '.ma-bar-f.low{background:var(--red);}',
      '.ma-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}',
      '@media (prefers-reduced-motion: reduce){.ma-modecard,.ma-opt,.ma-timerfill,.ma-btn{transition:none !important;}.ma-modecard:hover{transform:none;}}',
      '@media (max-width:640px){',
      '.ma-h1{font-size:1.22rem;}',
      '.ma-card{padding:13px;}',
      '.ma-modegrid{grid-template-columns:1fr;}',
      '.ma-drill-opts{grid-template-columns:1fr;}',
      '.ma-bodywrap{flex-direction:column;}',
      '.ma-bodysvg{width:100%;max-width:260px;margin:0 auto;}',
      '.ma-lvls{grid-template-columns:1fr;}',
      '.ma-bar{grid-template-columns:1fr;gap:3px;}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ==========================================================================
   * 2. SHARED SMALL COMPONENTS
   * ======================================================================== */

  function Tag(props) {
    return ce('span', { className: 'ma-tag ' + (props.color || '') }, props.children);
  }

  function Bar(props) {
    var pct = clamp(props.pct || 0, 0, 100);
    var cls = pct >= 80 ? '' : (pct >= 50 ? 'mid' : 'low');
    return ce('div', { className: 'ma-bar' },
      ce('span', { style: { color: 'var(--text2)' } }, props.label),
      ce('div', { className: 'ma-bar-t' },
        ce('div', { className: 'ma-bar-f ' + cls, style: { width: pct + '%' } })),
      ce('b', { style: { fontVariantNumeric: 'tabular-nums' } }, props.value)
    );
  }

  /** "Ask the instructor" — silently absent when MM.ai is unavailable. */
  function AskInstructor(props) {
    var available = false;
    var M = mm();
    try { available = !!(M.ai && typeof M.ai.chat === 'function' && (typeof M.ai.isAvailable !== 'function' || M.ai.isAvailable())); }
    catch (e) { available = false; }

    var st = useState(false), open = st[0], setOpen = st[1];
    var q = useState(''), question = q[0], setQuestion = q[1];
    var a = useState(''), answer = a[0], setAnswer = a[1];
    var b = useState(false), busy = b[0], setBusy = b[1];
    var er = useState(''), err = er[0], setErr = er[1];

    if (!available) return null;

    function ask(text) {
      var body = String(text || question || '').trim();
      if (!body) return;
      setBusy(true); setErr(''); setAnswer('');
      var sys = 'You are a nursing clinical instructor supervising a medication administration skill checkoff. ' +
        'Answer briefly (under 180 words), in plain clinical language, always prioritising PATIENT SAFETY. ' +
        'Name the rubric item or the "right" involved when relevant. Never invent drug doses; if the student needs a ' +
        'number, tell them to verify it in a drug guide. If the situation calls for holding the drug or clarifying the ' +
        'order, say so plainly. Do not use emojis.';
      var ctx = props.context ? ('CONTEXT THE STUDENT IS LOOKING AT:\n' + props.context + '\n\n') : '';
      M.ai.chat({
        system: sys,
        messages: [{ role: 'user', content: ctx + 'STUDENT QUESTION: ' + body }],
        maxTokens: 600,
        temperature: 1
      }).then(function (txt) {
        setAnswer(String(txt || '').trim() || 'No response.');
        setBusy(false);
      })['catch'](function (e) {
        var code = e && e.code;
        var msg = code === 'quota-exceeded' ? 'You have used your AI questions for today.'
          : code === 'no-auth' ? 'Sign in to ask the instructor.'
          : code === 'tier-denied' ? 'Ask the instructor is not available on your plan.'
          : code === 'ai-disabled' ? 'The instructor is switched off right now.'
          : 'Could not reach the instructor. Try again.';
        setErr(msg); setBusy(false);
      });
    }

    if (!open) {
      return ce('div', { style: { marginTop: 12 } },
        ce('button', { className: 'ma-btn ma-btn-ghost ma-btn-sm', onClick: function () { setOpen(true); } },
          'Ask the instructor'));
    }

    return ce('div', { className: 'ma-ai' },
      ce('div', { className: 'ma-row', style: { justifyContent: 'space-between', marginBottom: 8 } },
        ce('span', { className: 'ma-tiny', style: { color: 'var(--accent2)' } }, 'Ask the instructor'),
        ce('button', { className: 'ma-btn ma-btn-ghost ma-btn-sm', onClick: function () { setOpen(false); } }, 'Close')),
      ce('textarea', {
        className: 'ma-input', rows: 2, value: question,
        'aria-label': 'Your question for the instructor',
        placeholder: props.placeholder || 'e.g. Why do I have to hold this dose?',
        onChange: function (e) { setQuestion(e.target.value); }
      }),
      ce('div', { className: 'ma-row', style: { marginTop: 8 } },
        ce('button', { className: 'ma-btn ma-btn-primary ma-btn-sm', disabled: busy || !question.trim(), onClick: function () { ask(); } },
          busy ? 'Asking...' : 'Ask'),
        (props.suggestions || []).map(function (s, i) {
          return ce('button', {
            key: i, className: 'ma-btn ma-btn-ghost ma-btn-sm', disabled: busy,
            onClick: function () { setQuestion(s); ask(s); }
          }, s);
        })
      ),
      err ? ce('div', { className: 'ma-fb bad', role: 'alert' }, err) : null,
      answer ? ce('div', { className: 'ma-ai-out' }, answer) : null
    );
  }

  /**
   * Verbalization of the three checks. Uses window.VoiceButton when present
   * (real checkoffs require the student to say it out loud), otherwise a textarea.
   */
  function VerbalizeBox(props) {
    var t = useState(''), text = t[0], setText = t[1];
    var r = useState(null), res = r[0], setRes = r[1];
    var VB = window.VoiceButton;
    var M = mm();
    var voiceOk = false;
    try { voiceOk = !!(VB && M.voice && (typeof M.voice.isSupported !== 'function' || (M.voice.isSupported() || {}).stt)); }
    catch (e) { voiceOk = false; }

    function grade(saidRaw) {
      var said = String(saidRaw || '').toLowerCase();
      var need = props.required || [];
      var hits = need.map(function (n) {
        var any = (n.match || []).some(function (m) { return said.indexOf(String(m).toLowerCase()) !== -1; });
        return { label: n.label, ok: any };
      });
      var got = hits.filter(function (h) { return h.ok; }).length;
      var out = { hits: hits, got: got, total: need.length, said: saidRaw };
      setRes(out);
      if (props.onResult) props.onResult(out);
    }

    return ce('div', null,
      ce('div', { className: 'ma-muted', style: { marginBottom: 8 } },
        'Say it out loud exactly as you would for your evaluator. Required elements: ' +
        (props.required || []).map(function (n) { return n.label; }).join(', ') + '.'),
      voiceOk ? ce('div', { style: { marginBottom: 8 } },
        ce(VB, {
          label: 'Say it out loud',
          onInterim: function (txt) { setText(txt); },
          onTranscript: function (txt) { setText(txt); grade(txt); }
        })) : null,
      ce('textarea', {
        className: 'ma-input', rows: 3, value: text,
        'aria-label': 'Type or dictate your verbalization',
        placeholder: voiceOk ? 'Your words appear here — you can also type them.' : 'Type exactly what you would say out loud.',
        onChange: function (e) { setText(e.target.value); }
      }),
      ce('div', { className: 'ma-row', style: { marginTop: 8 } },
        ce('button', { className: 'ma-btn ma-btn-primary ma-btn-sm', disabled: !text.trim(), onClick: function () { grade(text); } },
          'Score my verbalization')),
      res ? ce('div', { className: 'ma-fb ' + (res.got === res.total ? 'good' : (res.got >= res.total - 1 ? 'part' : 'bad')) },
        ce('div', { className: 'ma-fb-t' }, res.got + ' of ' + res.total + ' required elements said'),
        ce('ul', { className: 'ma-ul' }, res.hits.map(function (h, i) {
          return ce('li', { key: i },
            ce('b', { style: { color: h.ok ? 'var(--green)' : 'var(--red)' } }, h.ok ? '[said] ' : '[missing] '),
            h.label);
        }))
      ) : null
    );
  }

  /* ==========================================================================
   * 3. MAR ENGINE — allergy detection, hazard matching, step construction
   * ======================================================================== */

  var STOP_WORDS = { 'before': 1, 'after': 1, 'against': 1, 'patient': 1, 'every': 1, 'their': 1, 'about': 1, 'which': 1, 'there': 1, 'other': 1, 'those': 1, 'these': 1, 'while': 1, 'given': 1, 'giving': 1, 'dose': 1, 'doses': 1, 'medication': 1, 'medications': 1 };

  function bigWords(s) {
    return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) {
      return w.length > 4 && !STOP_WORDS[w];
    });
  }
  function medTokens(name) {
    return String(name || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 4; });
  }
  function trapText(t) {
    return String((t.trigger || '') + ' ' + (t.whatHappens || '') + ' ' + (t.correctAction || '') + ' ' + (t.teachingPoint || '')).toLowerCase();
  }

  /** Traps that belong to this medication (name token appears in the trap text). */
  function hazardsFor(caseObj, med) {
    var toks = medTokens(med.name);
    return (caseObj.traps || []).filter(function (t) {
      var txt = trapText(t);
      for (var i = 0; i < toks.length; i++) { if (txt.indexOf(toks[i]) !== -1) return true; }
      return false;
    });
  }
  /** Traps that belong to nobody in particular — shown in the case debrief. */
  function caseLevelHazards(caseObj) {
    var claimed = {};
    (caseObj.medications || []).forEach(function (m) {
      hazardsFor(caseObj, m).forEach(function (t) { claimed[t.id] = 1; });
    });
    return (caseObj.traps || []).filter(function (t) { return !claimed[t.id]; });
  }
  function worstSeverity(hazards) {
    if (hazards.some(function (h) { return h.severity === 'critical'; })) return 'critical';
    if (hazards.some(function (h) { return h.severity === 'major'; })) return 'major';
    return hazards.length ? 'minor' : null;
  }
  /** Find the hazard that a specific omitted assessment corresponds to. */
  function hazardForCheck(hazards, checkText) {
    var words = bigWords(checkText);
    var best = null, bestN = 0;
    hazards.forEach(function (h) {
      var txt = trapText(h), n = 0;
      words.forEach(function (w) { if (txt.indexOf(w) !== -1) n++; });
      if (n > bestN) { bestN = n; best = h; }
    });
    return bestN >= 2 ? best : null;
  }

  /* ---- drug table lookup ------------------------------------------------ */
  function normalize(s) { return String(s || '').toLowerCase(); }

  function findDrugEntry(name) {
    var n = normalize(name), list = DRUGS(), i, j, d;
    for (i = 0; i < list.length; i++) {
      d = list[i];
      if (n.indexOf(normalize(d.generic)) !== -1 && normalize(d.generic).length > 3) return d;
      var br = d.brand || [];
      for (j = 0; j < br.length; j++) {
        if (normalize(br[j]).length > 3 && n.indexOf(normalize(br[j])) !== -1) return d;
      }
    }
    /* looser: first significant token */
    var toks = medTokens(name);
    for (i = 0; i < list.length; i++) {
      d = list[i];
      var hay = normalize(d.generic + ' ' + (d.brand || []).join(' '));
      for (j = 0; j < toks.length; j++) { if (hay.indexOf(toks[j]) !== -1) return d; }
    }
    return null;
  }

  function isHighAlert(med) {
    var d = findDrugEntry(med.name);
    if (d && d.highAlert) return true;
    return /insulin|heparin|warfarin|opioid|morphine|hydromorphone|dilaudid|fentanyl|oxycodone|percocet|potassium|digoxin|chemotherap/i.test(med.name || '');
  }

  /* ---- allergy conflict detection --------------------------------------- */
  var CLASS_GROUPS = [
    { group: 'penicillin', test: /penicillin|amoxicillin|ampicillin|piperacillin|zosyn|augmentin|nafcillin|clavulanate/i },
    { group: 'cephalosporin', test: /cephalosporin|cefazolin|ceftriaxone|cefepime|cephalexin|ancef|rocephin|keflex/i },
    { group: 'sulfonamide', test: /\bsulfa\b|sulfamethoxazole|sulfonamide|bactrim|septra|trimethoprim/i },
    { group: 'nsaid', test: /nsaid|ibuprofen|naproxen|ketorolac|toradol|aspirin|salicylate/i },
    { group: 'opioid', test: /opioid|codeine|morphine|hydromorphone|dilaudid|oxycodone|hydrocodone|fentanyl|percocet/i }
  ];
  /* Beta-lactam cross-sensitivity is a real, teachable, lower-probability risk. */
  var CROSS = { penicillin: ['cephalosporin'], cephalosporin: ['penicillin'] };

  function groupOf(text) {
    for (var i = 0; i < CLASS_GROUPS.length; i++) {
      if (CLASS_GROUPS[i].test.test(text)) return CLASS_GROUPS[i].group;
    }
    return null;
  }
  function allergyCore(raw) {
    return String(raw || '').split('(')[0].trim().toLowerCase();
  }
  /** All known names (generic + brands) for an allergy string. */
  function aliasesFor(core) {
    var out = [], list = DRUGS(), i;
    for (i = 0; i < list.length; i++) {
      var d = list[i];
      var names = [d.generic].concat(d.brand || []);
      var match = names.some(function (n) {
        n = normalize(n);
        return n.length > 3 && (n === core || n.indexOf(core) !== -1 || core.indexOf(n) !== -1);
      });
      if (match) { names.forEach(function (n) { if (out.indexOf(n) === -1) out.push(n); }); }
    }
    return out;
  }

  /**
   * @returns null, or
   *   { allergy, kind:'same-drug'|'brand-generic'|'class', why, matchedName }
   */
  function detectAllergyConflict(caseObj, med) {
    var allergies = ((caseObj.patient || {}).allergies) || [];
    var medText = normalize(med.name + ' ' + (med.route || ''));
    var i, j;
    for (i = 0; i < allergies.length; i++) {
      var raw = allergies[i];
      var core = allergyCore(raw);
      if (!core || /no known/.test(core)) continue;
      if (core === 'latex') continue; /* handled as a precaution note, not a drug conflict */

      /* brand <-> generic */
      var alias = aliasesFor(core);
      for (j = 0; j < alias.length; j++) {
        var nm = normalize(alias[j]);
        if (nm.length > 3 && nm !== core && medText.indexOf(nm) !== -1) {
          return {
            allergy: raw, kind: 'brand-generic', matchedName: alias[j],
            why: cap(alias[j]) + ' IS ' + core + ' — the same drug written under a different name. The MAR uses one name and the allergy list uses the other.'
          };
        }
      }
      /* exact / substring on the ordered drug itself */
      if (core.length > 3 && medText.indexOf(core) !== -1) {
        return {
          allergy: raw, kind: 'same-drug', matchedName: core,
          why: 'The ordered medication IS ' + core + ', which is on this patient’s allergy list.'
        };
      }
      /* class cross-sensitivity */
      var ag = groupOf(core), mg = groupOf(medText);
      if (ag && mg) {
        if (ag === mg) {
          return {
            allergy: raw, kind: 'class', matchedName: mg,
            why: 'The ordered medication is in the ' + mg + ' class, the same class as the documented ' + core + ' allergy.'
          };
        }
        if ((CROSS[ag] || []).indexOf(mg) !== -1) {
          return {
            allergy: raw, kind: 'class', matchedName: mg,
            why: 'A documented ' + core + ' allergy carries cross-sensitivity with the ' + mg + ' class. Verify the reaction type with the provider before giving.'
          };
        }
      }
    }
    return null;
  }

  function latexNote(caseObj) {
    var allergies = ((caseObj.patient || {}).allergies) || [];
    return allergies.some(function (a) { return /latex/i.test(a); });
  }

  /* ---- route helpers ---------------------------------------------------- */
  function routeIdFor(med) {
    var r = normalize(med.route);
    if (/subq|subcut/.test(r)) return 'subq';
    if (/\bid\b|intraderm/.test(r)) return 'id';
    if (/\bim\b|intramus/.test(r)) return 'im';
    if (/\biv\b|intraven|piggyback/.test(r)) return 'iv';
    return 'po';
  }
  function routeObj(id) {
    var rs = SKILLS().routes || [];
    for (var i = 0; i < rs.length; i++) { if (rs[i].id === id) return rs[i]; }
    return { id: id, name: id, needleGauge: '', needleLength: '', angle: '', guidelines: [], pitfalls: [] };
  }
  function isParenteral(id) { return id === 'subq' || id === 'im' || id === 'id' || id === 'iv'; }

  /* ---- order-safety issue ---------------------------------------------- */
  /**
   * Is the order, as written, unsafe? Derived from the case's own trap data.
   * @returns null | {kind:'route'|'dose'|'duplication', trap}
   */
  function orderIssue(med, hazards) {
    var route = normalize(med.route);
    var i, h, txt;
    /* explicit unsafe rate written into the route field */
    if (/rapid iv push|iv push over less|fast push/.test(route)) {
      for (i = 0; i < hazards.length; i++) {
        if (/rapid iv push|push/.test(trapText(hazards[i]))) return { kind: 'route', trap: hazards[i] };
      }
      return { kind: 'route', trap: null };
    }
    for (i = 0; i < hazards.length; i++) {
      h = hazards[i]; txt = trapText(h);
      if (h.severity !== 'critical' && h.severity !== 'major') continue;
      if (/exceeds the maximum|above the maximum|outside the safe range|exceeds the safe|safe range is|maximum safe single dose|is high for/.test(txt)) {
        return { kind: 'dose', trap: h };
      }
    }
    for (i = 0; i < hazards.length; i++) {
      h = hazards[i]; txt = trapText(h);
      if (/duplicat|overlapping|both this and|two orders|same meal/.test(txt) && /clarif|which is intended|question the/.test(txt)) {
        return { kind: 'duplication', trap: h };
      }
    }
    for (i = 0; i < hazards.length; i++) {
      h = hazards[i]; txt = trapText(h);
      if (h.severity === 'critical' && /never .*iv push|must be given .*over|no faster than|infuse a minimum|incompatib|precipitat/.test(txt)) {
        return { kind: 'route', trap: h };
      }
    }
    return null;
  }

  function prnWithoutIndication(med, hazards) {
    if (!med.isPRN) return false;
    for (var i = 0; i < hazards.length; i++) {
      var txt = trapText(hazards[i]);
      if (/prn/.test(txt) && /no (genuine )?(prn )?indication|is not hypertension|no indication|not indicated/.test(txt)) return true;
    }
    return false;
  }
  function isTimeCritical(med) {
    return /insulin|levothyroxine|warfarin|heparin|enoxaparin|phenytoin|levodopa|carbidopa|antibiotic|vancomycin|cefazolin|ceftriaxone|amoxicillin|piperacillin/i.test(med.name || '');
  }
  function isNoCrush(med) {
    return /extended[- ]release|\bER\b|\bXR\b|\bSR\b|enteric|delayed[- ]release|sublingual|potassium chloride extended/i.test(med.name + ' ' + (med.concentration || ''));
  }

  /* ==========================================================================
   * 4. STEP BUILDER
   * ======================================================================== */

  function opt(id, text, score, tone, feedback, extra) {
    var o = { id: id, text: text, score: score, tone: tone || (score === 2 ? 'good' : score === 1 ? 'part' : 'bad'), feedback: feedback || '' };
    if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k]; } }
    return o;
  }

  var GENERIC_DISTRACTORS = [
    'Ask the patient’s roommate whether the patient usually takes this medication.',
    'Confirm the room number on the door matches the MAR header.',
    'Confirm the tablet is the same colour and shape as the one given yesterday.',
    'Count a radial pulse for 15 seconds and multiply by four.',
    'Skip the assessment because the vital signs were charted earlier this shift.',
    'Check whether the previous nurse signed the MAR, and assume the assessment was done.'
  ];

  /**
   * Build the full guided procedure for one medication.
   * Every step maps 1:1 or 1:2 onto the 20 rubric items so a completed run
   * produces a real score out of 40.
   */
  function buildSteps(caseObj, med) {
    var hz = hazardsFor(caseObj, med);
    var conflict = detectAllergyConflict(caseObj, med);
    var rid = routeIdFor(med);
    var rObj = routeObj(rid);
    var parenteral = isParenteral(rid);
    var highAlert = isHighAlert(med);
    var issue = orderIssue(med, hz);
    var noIndication = prnWithoutIndication(med, hz);
    var timeCritical = isTimeCritical(med);
    var noCrush = isNoCrush(med);
    var drug = findDrugEntry(med.name);
    var allergyList = ((caseObj.patient || {}).allergies || []).join(', ') || 'None documented';
    var steps = [];

    /* ---------------- S1 hand hygiene + distractions -------------------- */
    steps.push({
      id: 'hygiene', phase: 'Preparation', title: 'Before you touch anything',
      rubric: ['hand-hygiene-asepsis', 'limiting-distractions'],
      prompt: 'You are at the dispensing system with the MAR open, about to pull ' + med.name + '. What is your first action?',
      options: [
        opt('a', 'Perform hand hygiene, silence your phone, and step into the no-interruption zone before pulling anything.', 2, 'good',
          'Correct. Hand hygiene before preparation is a critical rubric item, and interruption is one of the strongest single predictors of a medication error.'),
        opt('b', 'Perform hand hygiene, then pull the medication while finishing your conversation with the charge nurse.', 1, 'part',
          'Hand hygiene is right, but you kept the distraction. Stop side conversations before you prepare — that is a separate scored item.',
          { scores: { 'hand-hygiene-asepsis': 2, 'limiting-distractions': 1 } }),
        opt('c', 'Put on gloves — gloves are a barrier, so hand hygiene can wait until afterwards.', 0, 'bad',
          'Gloves are not a substitute for hand hygiene, and hands contaminate the outside of the gloves as you don them.',
          { critical: 'no-hand-hygiene' }),
        opt('d', 'Pull and prepare the medication first, then perform hand hygiene before you walk into the room.', 0, 'bad',
          'Hand hygiene has to happen BEFORE preparation. By the time you wash, you have already touched the vial, the tablet wrapper and the syringe.',
          { critical: 'no-hand-hygiene' })
      ]
    });

    /* ---------------- S2 supplies / right route ------------------------- */
    var supplyOpts;
    if (rid === 'po') {
      supplyOpts = [
        opt('a', 'A calibrated oral syringe or medicine cup, water, and the unit-dose package left intact until you are at the bedside; patient positioned upright.', 2, 'good',
          'Correct. Keep the wrapper intact, do not touch tablets with your hands, and confirm the patient can swallow and can sit upright.'),
        opt('b', 'Pop the tablet out of the wrapper now so it is ready, and carry it in a cup.', 1, 'part',
          'Keep the unit-dose wrapper intact until you are at the bedside. If the dose is refused you can return an intact package to the drawer; a loose tablet has to be wasted.'),
        opt('c', 'Crush the tablet and mix it into applesauce so it goes down more easily.', 0, 'bad',
          noCrush
            ? 'This product must NOT be crushed. ' + (rObj.pitfalls || [])[0]
            : 'Never crush without checking the formulation first. Crushing an extended-release or enteric-coated tablet delivers the whole 12 or 24 hour dose at once.'),
        opt('d', 'A 3 mL parenteral syringe — it measures small oral volumes more accurately than an oral syringe.', 0, 'bad',
          'A parenteral syringe can be connected to an IV line. Oral syringes are deliberately incompatible with IV connectors; that incompatibility is the safety feature.')
      ];
    } else if (rid === 'iv') {
      supplyOpts = [
        opt('a', 'Correct diluent per the drug guide, alcohol pads to scrub the hub for 15 to 20 seconds, saline flushes, a pump or a watch for the push rate, and gloves.', 2, 'good',
          'Correct. The IV push RATE is part of the right route — you cannot judge it by feel, so bring a timer or a pump.'),
        opt('b', 'Gloves, alcohol pads and flushes — you can judge a slow push by feel without a timer.', 1, 'part',
          'Rate limits are numeric, not intuitive: digoxin over at least 5 minutes, furosemide no faster than 20 mg/min, phenytoin no faster than 50 mg/min, vancomycin at least 60 minutes per gram.'),
        opt('c', 'Nothing extra — the IV is already running, so you can push it into the running line.', 0, 'bad',
          'Verify compatibility with the running fluid first, and scrub the hub. Ceftriaxone plus lactated Ringer precipitates; phenytoin precipitates in any dextrose solution.'),
        opt('d', 'Draw it up, then recap the needle so it stays sterile until you get to the room.', 0, 'bad',
          'Recapping a needle is a sharps safety violation and a listed critical error.', { critical: 'sharps-safety-violation' })
      ];
    } else {
      supplyOpts = [
        opt('a', 'A ' + (rObj.needleGauge || 'correct gauge') + ' needle, ' + (rObj.needleLength || 'correct length') +
          ', alcohol pads, gloves, and a sharps container within arm’s reach' + (/insulin/i.test(med.name) ? ', using a U-100 insulin syringe only' : '') + '.', 2, 'good',
          'Correct for ' + rObj.name + ': ' + (rObj.needleGauge || '') + ', ' + (rObj.needleLength || '') + ', angle ' + (rObj.angle || '') + '.'),
        opt('b', 'A 21 gauge 1.5 inch needle — a longer needle is easier to control and less likely to bend.', 1, 'part',
          rid === 'subq'
            ? 'Too long. A needle that long turns a subcutaneous injection into an intramuscular one and speeds absorption unpredictably — dangerous with insulin and heparin.'
            : 'Match gauge and length to the route and the patient’s body habitus, not to what feels easiest to hold.'),
        opt('c', /insulin/i.test(med.name)
          ? 'A tuberculin syringe, because it is marked in tenths of a mL and looks more precise.'
          : 'Whatever syringe is already open on the counter, to save a trip.', 0, 'bad',
          /insulin/i.test(med.name)
            ? 'Insulin is measured in UNITS and must be drawn in a U-100 insulin syringe. Using a tuberculin syringe is a classic fatal insulin error.'
            : 'Never use an unlabelled or previously opened syringe. Any unlabelled medication or syringe must be discarded.'),
        opt('d', 'Draw it up, then recap the needle so it stays sterile until you reach the bedside.', 0, 'bad',
          'Recapping a needle, laying it on a surface, or delaying disposal is a listed critical error.', { critical: 'sharps-safety-violation' })
      ];
    }
    steps.push({
      id: 'supplies', phase: 'Preparation', title: 'Right route — supplies and drug form',
      rubric: ['right-route'],
      prompt: 'The order route is ' + med.route + ' (' + rObj.name + '). What do you gather, and is the drug form right for the route?',
      reference: rid === 'po' ? null : ('Gauge ' + rObj.needleGauge + ' | Length ' + rObj.needleLength + ' | Angle ' + rObj.angle + ' | Volume ' + rObj.volumeLimit),
      options: supplyOpts
    });

    /* ---------------- S3 first check + expiration ----------------------- */
    steps.push({
      id: 'check1', phase: 'First Check', title: 'First Check — at the dispensing system',
      rubric: ['first-check', 'expiration-dates'],
      prompt: 'The package is in your hand at the Pyxis. Perform the FIRST check against the MAR.',
      options: [
        opt('a', 'Compare the label with the MAR and verbalize name, dose, route and time out loud; check the expiration date and confirm the drug form matches the ordered route.', 2, 'good',
          'Correct. The first check happens the moment the drug leaves storage, and expiration plus drug form are part of it.'),
        opt('b', 'Verbalize name, dose, route and time, but skip the expiration date — unit-dose packages from pharmacy are always current.', 1, 'part',
          'Expiration is its own scored item. Check the manufacturer date AND the beyond-use date on anything opened or reconstituted, and inspect for discolouration or particulate.',
          { scores: { 'first-check': 2, 'expiration-dates': 0 } }),
        opt('c', 'Compare the label with the MAR silently and confirm it is the right drug.', 1, 'part',
          'Verbalizing is required at your checkoff. Say name, dose, route and time out loud — your evaluator is scoring what they hear.',
          { scores: { 'first-check': 1, 'expiration-dates': 1 } }),
        opt('d', 'Trust the dispensing cabinet — pharmacy filled that bin, so the drug in the pocket is correct.', 0, 'bad',
          'Cabinets are stocked by people and mis-stocks happen. The first check exists specifically to catch look-alike / sound-alike errors before you ever leave the med room.')
      ]
    });

    /* ---------------- S4 order verification / right drug ---------------- */
    var orderLine = med.name + ' ' + med.dose + ' ' + med.route + ' ' + med.frequency + (med.indication ? ' — for ' + med.indication : '');
    steps.push({
      id: 'order', phase: 'First Check', title: 'Verify the order against the MAR',
      rubric: ['right-drug'],
      prompt: 'You pull up the original provider order and compare it to the MAR. They match each other exactly:\n\n“' + orderLine + '”\n\nIs the order, as written, safe to carry out?',
      options: [
        opt('match', 'Yes — the drug, dose, route and frequency are all appropriate, and the label matches the MAR letter for letter.',
          issue ? 0 : 2, issue ? 'bad' : 'good',
          issue ? 'No. This order is not safe as written — read it again.' :
            'Correct. The label, the MAR and the provider order all agree, and nothing about the order is outside safe practice.',
          issue ? { missedHazard: issue.trap } : null),
        opt('route', 'No — the ROUTE or the push/infusion rate as written is unsafe for this drug. Clarify with the provider before proceeding.',
          issue && issue.kind === 'route' ? 2 : 1, issue && issue.kind === 'route' ? 'good' : 'part',
          issue && issue.kind === 'route'
            ? 'Correct. A nurse who carries out an unsafe order shares responsibility for the harm. The rate of an IV push is part of the right route.'
            : 'The route as written is acceptable here, but questioning a route is never punished — verify and move on.'),
        opt('dose', 'No — the DOSE is outside the safe range for this patient. Clarify with the provider.',
          issue && issue.kind === 'dose' ? 2 : 1, issue && issue.kind === 'dose' ? 'good' : 'part',
          issue && issue.kind === 'dose'
            ? 'Correct. The nurse is the last check on a prescribing error; a dose outside the safe range is never given "because it was ordered".'
            : 'The dose is within range for this patient, but verifying against a safe-range reference is always the right instinct.'),
        opt('dup', 'No — this order duplicates other coverage already on this MAR. Clarify which one is intended.',
          issue && issue.kind === 'duplication' ? 2 : 1, issue && issue.kind === 'duplication' ? 'good' : 'part',
          issue && issue.kind === 'duplication'
            ? 'Correct. Duplicate therapeutic coverage has to be reconciled with the provider or pharmacy before either drug is given.'
            : 'No duplication on this MAR, but scanning the whole MAR for additive and duplicate effects is exactly right.'),
        opt('unsure', 'Unsure — read the label three times against the MAR and look the drug up before deciding.', 1, 'part',
          'Never a wrong instinct, but at the checkoff you have to reach a determination and state it.')
      ]
    });

    /* ---------------- S5 drug guide ------------------------------------- */
    steps.push({
      id: 'guide', phase: 'First Check', title: 'Right use of the drug guide',
      rubric: ['right-use-of-drug-guide'],
      prompt: 'Your evaluator asks: "Tell me what this drug is and why this patient is getting it." What do you do?',
      options: [
        opt('a', 'Open the drug guide and state the classification, indication, safe dose range, contraindications and the specific monitoring parameters for ' + med.name + '.', 2, 'good',
          'Correct. Looking it up in front of the evaluator is a strength, not a weakness. Never give a drug you cannot describe.'),
        opt('b', 'Read the indication off the MAR: "' + (med.indication || 'as ordered') + '".', 1, 'part',
          'That is the indication, but not the classification, the safe range, the contraindications or the monitoring. Those are all part of this scored item.'),
        opt('c', 'Explain that you have given this drug many times and know exactly what it does.', 0, 'bad',
          'Familiarity is not verification. This item scores whether you demonstrate USE of the drug guide.'),
        opt('d', 'Ask the pharmacist to look it up and tell you while you keep preparing.', 1, 'part',
          'Pharmacy is a great resource, but the rubric scores you demonstrating the reference yourself — and you should not be preparing while your attention is elsewhere.')
      ],
      drugCard: drug
    });

    /* ---------------- S6 second check ----------------------------------- */
    steps.push({
      id: 'check2', phase: 'Second Check', title: 'Second Check — during preparation',
      rubric: ['second-check'],
      prompt: 'You are at the counter, about to ' + (rid === 'po' ? 'pour or open the dose' : 'draw up the dose') + '. Perform the SECOND check.' +
        (highAlert ? '\n\nThis is a HIGH-ALERT medication.' : ''),
      options: [
        opt('a', 'Hand hygiene, compare the label with the MAR a second time, verify the dose calculation, check the beyond-use date' +
          (highAlert ? ', and obtain a second-nurse INDEPENDENT double check of the drug, concentration and amount.' : '.'),
          2, 'good',
          highAlert
            ? 'Correct. "Independent" means the second nurse verifies from the original order and reads the syringe themselves — you do not tell them what you drew.'
            : 'Correct. The second check is where the calculation gets verified, before anything is drawn up or poured.'),
        opt('b', 'Compare the label with the MAR and verify the calculation' + (highAlert ? ' — you have drawn this up dozens of times, so no second nurse is needed.' : ', then prepare the dose.'),
          highAlert ? 1 : 2, highAlert ? 'part' : 'good',
          highAlert
            ? 'Insulin, heparin, opioids, potassium and chemotherapy require an independent double check. It is a requirement, not a courtesy.'
            : 'Correct.'),
        opt('c', 'You already checked at the Pyxis — prepare the dose and check again at the bedside.', 0, 'bad',
          'Two checks is not three. The second check is the one that catches a calculation error before the drug is in the syringe.'),
        opt('d', 'Prepare the dose first so it is ready, then compare the label with the MAR.', 1, 'part',
          'Check before you prepare. Once the tablet is out of the wrapper or the vial is drawn, the label evidence is gone.')
      ]
    });

    /* ---------------- S7 calculation ------------------------------------ */
    var calc = med.calculation || {};
    steps.push({
      id: 'calc', phase: 'Second Check', title: 'Right dose — calculate and show your work',
      rubric: ['right-dose'],
      type: 'calc',
      prompt: calc.question || ('Calculate the volume or number of units needed for ' + med.dose + ' of ' + med.name + '.'),
      calc: {
        answer: typeof calc.answer === 'number' ? calc.answer : null,
        unit: calc.unit || '',
        work: calc.work || '',
        hint: 'Desired ÷ Have × Quantity',
        supply: 'Supplied: ' + (med.concentration || 'see label') + '  |  Ordered: ' + med.dose
      }
    });

    /* ---------------- S8 verbalize (bonus, unscored) -------------------- */
    steps.push({
      id: 'verbalize', phase: 'Second Check', title: 'Verbalize the check out loud',
      rubric: [], type: 'verbalize', optional: true,
      prompt: 'Your evaluator requires you to verbalize. State the medication, the dose, the route and the time.',
      verbalize: {
        required: [
          { label: 'drug name', match: medTokens(med.name).concat([normalize(med.name)]) },
          { label: 'dose', match: [String(med.dose || '').split(' ')[0], normalize(med.dose)] },
          { label: 'route', match: [normalize(med.route), rid, rObj.name.toLowerCase().split(' ')[0]] },
          { label: 'time / frequency', match: [normalize(med.frequency), String(caseObj.currentTime || ''), 'now', 'due'] }
        ]
      }
    });

    /* ---------------- S9 two identifiers -------------------------------- */
    var ptName = ((caseObj.patient || {}).name) || 'the patient';
    steps.push({
      id: 'identify', phase: 'At the bedside', title: 'Two patient identifiers',
      rubric: ['two-patient-identifiers'],
      prompt: 'You are in the room. How do you identify the patient?',
      options: [
        opt('a', 'Ask the patient to state their full name and date of birth, then compare both against the armband and the MAR.', 2, 'good',
          'Correct. Full name and date of birth (or medical record number) are the acceptable identifiers, and the patient states them — you do not.'),
        opt('b', 'Ask "Are you ' + ptName.split(',').reverse().join(' ').trim() + '?" and confirm the age on the chart matches.', 0, 'bad',
          'Two failures: a leading question (confused, sedated and hard-of-hearing patients agree to anything) and AGE, which is never an acceptable identifier.'),
        opt('c', 'Match the room and bed number on the door to the MAR header.', 0, 'bad',
          'Room and bed numbers are NEVER acceptable identifiers. Patients get moved, and the wrong-patient error is a sentinel event.'),
        opt('d', 'Scan the barcode on the armband — the scanner performs the identity check.', 1, 'part',
          'Barcode scanning is a good second layer, but it does not replace asking the patient to state name and date of birth. Scanners get worked around; bands get put on the wrong wrist.')
      ]
    });

    /* ---------------- S10 ALLERGY CHECK — critical gate ----------------- */
    var conflictFeedbackTrap = null;
    if (conflict) {
      for (var ci = 0; ci < hz.length; ci++) {
        if (/allerg/.test(trapText(hz[ci]))) { conflictFeedbackTrap = hz[ci]; break; }
      }
    }
    steps.push({
      id: 'allergy', phase: 'At the bedside', title: 'Allergy check',
      rubric: ['allergy-check'],
      isAllergyGate: true,
      conflict: conflict,
      conflictTrap: conflictFeedbackTrap,
      latex: latexNote(caseObj),
      allergyList: allergyList,
      prompt: 'You ask the patient about allergies, look at the allergy band and check the MAR.\n\nALLERGY BAND / MAR: ' + allergyList +
        '\nYOU ARE HOLDING: ' + med.name + ' ' + med.dose + ' ' + med.route +
        '\n\nWhat is your determination?',
      options: [
        opt('clear', 'No conflict. I checked all three sources and ' + med.name + ' is safe to give. Proceed.',
          conflict ? 0 : 2, conflict ? 'bad' : 'good',
          conflict ? '' : 'Correct. You checked all three sources — patient, band and MAR — and cross-referenced brand against generic before clearing it.',
          conflict ? { critical: 'allergy-not-checked', allergyMiss: true } : null),
        opt('stop', 'STOP — this medication conflicts with a documented allergy. Hold the dose and notify the provider.',
          conflict ? 2 : 1, conflict ? 'good' : 'part',
          conflict
            ? 'Correct, and this is the single most important catch in this case. ' + (conflict.why || '')
            : 'Nothing on this MAR conflicts with the documented allergies, so holding here would delay needed therapy. Caution is good; verify, then proceed.'),
        opt('different-name', 'The allergy is written under a different name from the MAR entry, so it is a different drug and does not apply.',
          0, 'bad',
          conflict ? '' : 'Never reason this way. Brand and generic names describe the same molecule, and this reasoning is exactly how allergic patients get dosed.',
          conflict ? { critical: 'allergy-not-checked', allergyMiss: true } : null),
        opt('lookup', 'Before deciding: ask the patient what the reaction was, and cross-reference brand names, generic names and drug class in the drug guide.',
          null, 'part', '', { reveal: true })
      ]
    });

    /* ---------------- S11 third check ----------------------------------- */
    steps.push({
      id: 'check3', phase: 'At the bedside', title: 'Third Check — bedside, patient present',
      rubric: ['third-check'],
      prompt: 'The patient is in front of you and the medication is in your hand. Perform the THIRD check.',
      options: [
        opt('a', 'Compare the medication with the MAR one final time at the bedside and state the patient name, medication, dose, route and time out loud.', 2, 'good',
          'Correct. This is the last barrier before the dose becomes irreversible, and saying it out loud gives the patient a chance to say "that is not my usual pill".'),
        opt('b', 'Compare the medication with the MAR at the bedside but do not say it out loud — the patient does not need the detail.', 1, 'part',
          'Verbalization is required at your checkoff and it invites the patient to catch the error. Say it out loud.'),
        opt('c', 'You checked twice already in the med room. Hand it to the patient.', 0, 'bad',
          'Skipping the bedside verification is a listed critical error — it removes the only check performed with the patient present.',
          { critical: 'bedside-verification-skipped' }),
        opt('d', 'Scan the barcode; the scan is the third check.', 1, 'part',
          'Scanning supports the third check but does not replace comparing the medication with the MAR and stating the five elements.')
      ]
    });

    /* ---------------- S12 pre-administration assessment ----------------- */
    var required = (med.requiredChecks || []).slice();
    var distract = seededShuffle(GENERIC_DISTRACTORS, hashStr(med.id + 'd')).slice(0, 3);
    var assessItems = seededShuffle(
      required.map(function (t) { return { text: t, req: true }; })
        .concat(distract.map(function (t) { return { text: t, req: false }; })),
      hashStr(med.id + 'a')
    );
    steps.push({
      id: 'assess', phase: 'At the bedside', title: 'Pre-administration assessment',
      rubric: ['pre-administration-assessment'],
      type: 'multi',
      prompt: 'Select EVERY assessment you must complete before giving ' + med.name + '. Selecting an item that is not required also costs you.',
      items: assessItems,
      hazards: hz,
      showVitals: true
    });

    /* ---------------- S13 right time ------------------------------------ */
    steps.push({
      id: 'timing', phase: 'At the bedside', title: 'Right time',
      rubric: ['right-time'],
      prompt: 'Current time on the unit is ' + (caseObj.currentTime || 'now') + '. The order reads ' + med.frequency +
        (med.isPRN ? ' (PRN).' : ' (scheduled).'),
      options: [
        opt('window', 'Give within 30 minutes before or after the scheduled time, and honour the food or meal requirement for this drug.',
          med.isPRN ? 1 : (timeCritical ? 1 : 2), med.isPRN || timeCritical ? 'part' : 'good',
          med.isPRN
            ? 'This is a PRN order — there is no scheduled time. What matters is the interval since the last dose and whether an indication exists right now.'
            : (timeCritical ? 'True for a standard scheduled drug, but this one is TIME-CRITICAL and the window is much narrower than 30 minutes.'
              : 'Correct. Standard scheduled medications are given within 30 minutes either side of the ordered time.')),
        opt('prn', 'Confirm the exact time and amount of the LAST dose and the ordered interval before giving anything.',
          med.isPRN ? 2 : 1, med.isPRN ? 'good' : 'part',
          med.isPRN
            ? 'Correct. For a PRN order you verify the interval since the last dose — including doses given at home or by the previous shift, which are frequently charted late.'
            : 'Always worth checking, but this is a scheduled order, so the 30-minute window is the governing rule.'),
        opt('critical', 'This is a time-critical medication — the window is much narrower than 30 minutes and the timing is tied to food, a meal tray or another drug.',
          timeCritical ? 2 : 1, timeCritical ? 'good' : 'part',
          timeCritical
            ? 'Correct. Insulin, antibiotics, anticoagulants, antiseizure and Parkinson drugs are time-critical. For rapid-acting insulin the rule is simple: no tray, no insulin.'
            : 'This drug is not on the time-critical list, but respecting food and sequencing requirements is still right.'),
        opt('shift', 'Timing does not matter much as long as it is given some time during your shift.', 0, 'bad',
          'Right time is a critical rubric item. A late antibiotic, a late antiseizure drug or an early insulin dose all cause real harm.')
      ]
    });

    /* ---------------- S14 education + professionalism ------------------- */
    steps.push({
      id: 'educate', phase: 'At the bedside', title: 'Patient education',
      rubric: ['right-patient-education', 'professionalism-respect'],
      prompt: 'What do you tell the patient about ' + med.name + '?',
      options: [
        opt('a', 'Introduce yourself, provide privacy, explain in plain language what it is for, what to expect and what to report — then use teach-back to verify understanding.', 2, 'good',
          'Correct. Teach-back: "Tell me in your own words what this is for and what you should report to me." Nodding is not understanding.'),
        opt('b', 'Tell the patient the name of the drug and ask whether they have any questions.', 1, 'part',
          'Partial. "Any questions?" is not teach-back, and you have not covered indication, expected effect or what to report.',
          { scores: { 'right-patient-education': 1, 'professionalism-respect': 2 } }),
        opt('c', 'Give a full pharmacologic explanation of the receptor mechanism so the patient understands it completely.', 1, 'part',
          'Jargon is not education. Plain language, then teach-back.',
          { scores: { 'right-patient-education': 1, 'professionalism-respect': 1 } }),
        opt('d', 'Hand it over — the patient has been on these for years and knows them better than you do.', 0, 'bad',
          'Right patient education is a scored item and every dose is a teaching opportunity. It is also how you learn that the pill "looks different today".',
          { scores: { 'right-patient-education': 0, 'professionalism-respect': 1 } })
      ]
    });

    /* ---------------- S15 THE DECISION — critical gate ------------------ */
    var correctAction = med.correctAction || 'give';
    var worst = worstSeverity(hz);
    steps.push({
      id: 'decision', phase: 'Decision', title: 'Give, hold, or clarify?',
      rubric: ['right-reason', 'special-precautions'],
      isDecisionGate: true,
      correctAction: correctAction,
      conflict: conflict,
      hazards: hz,
      worstSeverity: worst,
      prompt: 'Everything you have gathered is in front of you. State your clinical decision for ' + med.name + ' ' + med.dose + ' ' + med.route + '.',
      options: [
        opt('give', 'Administer the medication as ordered.', correctAction === 'give' ? 2 : 0,
          correctAction === 'give' ? 'good' : 'bad',
          correctAction === 'give'
            ? 'Correct. The indication applies, the hold parameters are not met, and the assessment supports giving it.'
            : '',
          correctAction === 'give' ? null : { wrongGive: true }),
        opt('hold', 'HOLD the dose and notify the provider, then document the hold and the notification.',
          correctAction === 'hold' ? 2 : (correctAction === 'clarify-order' ? 1 : 1),
          correctAction === 'hold' ? 'good' : 'part',
          correctAction === 'hold'
            ? 'Correct, and holding is an ACTIVE nursing decision, not an omission. It scores exactly as strongly as a correct administration.'
            : (correctAction === 'clarify-order'
              ? 'Close. Holding is safe, but the problem here is the ORDER itself, so the action is to clarify it with the provider and get it corrected.'
              : 'Withholding an indicated medication without a hold parameter or a clinical reason delays needed therapy. Say why you are holding.')),
        opt('clarify', 'CLARIFY the order with the provider before doing anything, then document the clarification.',
          correctAction === 'clarify-order' ? 2 : (correctAction === 'hold' ? 1 : 1),
          correctAction === 'clarify-order' ? 'good' : 'part',
          correctAction === 'clarify-order'
            ? 'Correct. The order as written cannot be safely carried out. A nurse who administers an unsafe order shares legal responsibility for the harm.'
            : (correctAction === 'hold'
              ? 'Close. The order itself is fine; it is this patient’s current condition that means the dose must be HELD and the provider notified.'
              : 'Clarifying is never harmful, but there is nothing wrong with this order and the patient needs the dose.')),
        opt('partial', 'Give a reduced dose and monitor the patient closely.', 0, 'bad',
          'A nurse may never alter a dose. That is prescribing. Hold or clarify — never improvise.', { wrongGive: true })
      ]
    });

    /* ---------------- S16 technique / escalation ------------------------ */
    var giveOpts;
    if (rid === 'subq') {
      giveOpts = [
        opt('a', 'Clean with friction for 20 seconds and let it AIR DRY, pinch the skin fold, insert at ' + rObj.angle.split('(')[0].trim() +
          ', inject slowly, do NOT aspirate, withdraw, apply gentle pressure and do NOT massage. Activate the safety device and drop the sharp straight into the container.', 2, 'good',
          'Correct. ' + ((rObj.pitfalls || [])[0] || '')),
        opt('b', 'Aspirate for 5 seconds before injecting to make sure you are not in a vessel.', 0, 'bad',
          'Do NOT aspirate a subcutaneous injection. It is unnecessary and increases tissue trauma.'),
        opt('c', 'Inject, then massage the site for 30 seconds to help the medication absorb.', 0, 'bad',
          'Never massage a heparin or enoxaparin site — it causes hematoma and bruising. Do not massage intradermal sites either.'),
        opt('d', 'Inject through the alcohol while it is still wet so the site stays sterile.', 1, 'part',
          'Let the antiseptic air dry. Injecting through wet alcohol drives it into the tissue and causes stinging and irritation.')
      ];
    } else if (rid === 'im') {
      giveOpts = [
        opt('a', 'Landmark the site anatomically (ventrogluteal is the safest adult site), clean with friction and air dry, stabilise the tissue, insert at 90 degrees, aspirate per facility policy, inject about 1 mL per 10 seconds, withdraw at the same angle, and dispose of the sharp immediately.', 2, 'good',
          'Correct. Landmark every time — the dorsogluteal site is no longer used because of sciatic nerve injury.'),
        opt('b', 'Use the deltoid because it is quick and easy to reach.', 0, 'bad',
          'The deltoid takes 1 mL or less and sits close to the radial and axillary nerves. Large or irritating volumes go ventrogluteal.'),
        opt('c', 'Inject rapidly so the patient feels it for less time.', 0, 'bad',
          'Injecting too fast causes pain and leakage from the site. About 1 mL per 10 seconds.'),
        opt('d', 'Use Z-track for an irritating or staining medication, pulling the skin laterally before insertion and releasing after withdrawal.', 2, 'good',
          'Also correct. Z-track prevents tracking and staining and is indicated for irritating drugs such as iron dextran.')
      ];
    } else if (rid === 'iv') {
      giveOpts = [
        opt('a', 'Confirm patency and assess for infiltration and phlebitis, scrub the hub for 15 to 20 seconds and let it dry, flush with saline, push at the rate specified in the drug guide while watching a clock, flush again, and stay with the patient.', 2, 'good',
          'Correct. Saline — administer — saline, at the documented rate, with the patient in front of you.'),
        opt('b', 'Push it steadily over about 30 seconds — that is slow enough for most drugs.', 0, 'bad',
          (rObj.pitfalls || [])[0] || 'Rate limits are drug-specific numbers, not a feel.'),
        opt('c', 'Push it into the running line without checking what is infusing.', 0, 'bad',
          'Verify compatibility with the running fluid and any co-infusing drug. Ceftriaxone plus a calcium-containing solution precipitates; phenytoin precipitates in dextrose.'),
        opt('d', 'Give it into the site even though it is cool, pale and slightly swollen — the line still flushes.', 0, 'bad',
          'That is infiltration. Stop, do not flush, remove the catheter, and follow the extravasation protocol if the drug is a vesicant.')
      ];
    } else {
      giveOpts = [
        opt('a', 'Confirm the patient can swallow, position them upright, give with water, stay until the medication is swallowed, and keep them upright afterwards.', 2, 'good',
          'Correct. Never leave medication at the bedside without a provider order — you cannot verify it was taken.'),
        opt('b', 'Leave the cup on the bedside table and come back later to check.', 0, 'bad',
          'Leaving medication at the bedside is prohibited without an order, and you cannot document what you did not see swallowed.'),
        opt('c', 'Give it with the patient lying flat because it is easier for them.', 0, 'bad',
          'Aspiration risk. Position the patient upright (high Fowler) and keep them upright for at least 30 minutes.'),
        opt('d', 'Hand over the tablet, watch it go down, and leave immediately for your next patient.', 1, 'part',
          'You watched it swallowed, which is the key point, but assess swallowing first and keep the patient upright afterwards.')
      ];
    }
    var holdOpts = [
      opt('a', 'Return the intact unit-dose package to the drawer (or waste a controlled substance with a second-nurse witness), notify the provider with a clear SBAR, and document the hold, the reason and the notification.', 2, 'good',
        'Correct. A hold is only complete when the provider is notified and both the hold and the notification are documented.'),
      opt('b', 'Leave it at the bedside in case the provider says to give it after all.', 0, 'bad',
        'Never leave medication at the bedside, and never leave a controlled substance unsecured.'),
      opt('c', 'Skip it and tell the oncoming nurse in report.', 0, 'bad',
        'An undocumented, unreported hold looks identical to a missed dose. Notify now and document now.'),
      opt('d', 'Chart it as "not given" with no further action and move on to the next patient.', 1, 'part',
        'Charting "not given" is not enough. Document the REASON, the provider notification and the response.')
    ];
    steps.push({
      id: 'act', phase: 'Action', title: 'Carry out your decision',
      rubric: ['injection-technique'],
      dynamic: 'act',
      giveOptions: giveOpts,
      holdOptions: holdOpts,
      routeName: rObj.name,
      pitfalls: rObj.pitfalls || []
    });

    /* ---------------- S17 documentation --------------------------------- */
    steps.push({
      id: 'document', phase: 'After', title: 'Right documentation',
      rubric: ['right-documentation'],
      dynamic: 'document',
      giveOptions: [
        opt('a', 'Document immediately AFTER administration: drug, dose, route, time, injection site if applicable, and the patient response — then sign it. Reassess and document the effect (pain score, blood pressure, glucose) at the expected interval.', 2, 'good',
          'Correct. Documentation after, never before, and the reassessment is part of it.'),
        opt('b', 'Chart it now, before you go in, so you do not forget in the rush.', 0, 'bad',
          'Never chart before administering. If the patient refuses or vomits the dose, the record is false and the next nurse may believe it was given.'),
        opt('c', 'Document drug, dose, route and time, but not the site or the patient response.', 1, 'part',
          'Incomplete. Site matters for rotation and for tracking a reaction; response is how anyone knows whether the drug worked.'),
        opt('d', 'The electronic record timestamps the scan, so no separate charting is needed.', 0, 'bad',
          'A scan is not an assessment. Response, site and your signature are yours to record.')
      ],
      holdOptions: [
        opt('a', 'Document the hold, the specific reason, the assessment data that supported it, the provider you notified, the time, and their response — plus the patient’s current status.', 2, 'good',
          'Correct. A documented hold with provider notification is a defensible nursing action.'),
        opt('b', 'Chart "held" with no reason.', 0, 'bad',
          'A bare "held" is indistinguishable from a missed dose and offers you no protection.'),
        opt('c', 'Document the hold and the reason, but wait until the end of the shift to notify the provider.', 1, 'part',
          'Notify now. A held antihypertensive, anticoagulant or antibiotic changes the plan of care immediately.'),
        opt('d', 'Do not chart anything — you did not give it, so there is nothing to record.', 0, 'bad',
          'Holding IS an action and it must be recorded, along with the notification and the patient’s status.')
      ]
    });

    return {
      steps: steps,
      hazards: hz,
      conflict: conflict,
      routeId: rid,
      routeObj: rObj,
      parenteral: parenteral,
      highAlert: highAlert,
      drug: drug,
      orderIssue: issue
    };
  }

  /* ==========================================================================
   * 5. GRADING
   * ======================================================================== */

  function gradeRun(scores, criticals) {
    var items = allRubricItems();
    var mult = RUBRIC().scoreMultiplier || 2.5;
    var total = 0, zeros = [], critFail = [];
    items.forEach(function (it) {
      var s = (typeof scores[it.id] === 'number') ? scores[it.id] : 0;
      total += s;
      if (s === 0) zeros.push(it);
      else if (it.critical && s < 2) critFail.push(it);
    });
    var pct = Math.round(total * mult * 10) / 10;
    var passed = (criticals.length === 0) && zeros.length === 0 && critFail.length === 0;
    return {
      total: total, max: items.length * 2, pct: pct, passed: passed,
      zeros: zeros, critFail: critFail, criticals: criticals
    };
  }

  function PassRules() {
    return ce('ul', { className: 'ma-ul' },
      ce('li', null, 'Any ', ce('b', { style: { color: 'var(--red)' } }, 'critical error'), ' is an automatic FAIL, whatever the total.'),
      ce('li', null, 'Every item marked ', ce('b', null, 'critical'), ' must score 2 of 2.'),
      ce('li', null, 'No item may score 0 — a 0 means the competency was not demonstrated.'),
      ce('li', null, 'Score out of 40 × 2.5 = percent out of 100. Maximum attempts: ' + (RUBRIC().maxAttempts || 2) + '.')
    );
  }

  /* ==========================================================================
   * 6. MAR CHART
   * ======================================================================== */

  function MARChart(props) {
    var c = props.caseObj;
    var p = c.patient || {};
    var allergies = p.allergies || [];
    var nkda = allergies.length === 0 || allergies.every(function (a) { return /no known/i.test(a); });
    var labs = c.labs || {}, vitals = c.vitals || {};
    var done = props.completed || {};

    function flagVital(k, v) {
      var n = parseFloat(String(v));
      if (/temp/i.test(k) && n >= 100.4) return true;
      if (/^rr$/i.test(k) && (n > 24 || n < 12)) return true;
      if (/^hr$/i.test(k) && (n > 100 || n < 60)) return true;
      if (/o2/i.test(k) && n < 95) return true;
      return false;
    }

    return ce('div', { className: 'ma-chart' },
      ce('div', { className: 'ma-chart-bar' },
        ce('b', null, 'Medication Administration Record'),
        ce('span', { className: 'ma-muted' }, 'Current time ',
          ce('b', { style: { color: 'var(--text)' } }, c.currentTime || '—'))
      ),
      /* patient header */
      ce('div', { className: 'ma-pt' },
        ce('h3', { className: 'ma-pt-name' }, p.name || 'Unknown patient'),
        ce('div', { className: 'ma-pt-meta' },
          ce('span', null, 'MRN ', ce('b', null, p.mrn || '—')),
          ce('span', null, 'Age ', ce('b', null, String(p.age))),
          ce('span', null, ce('b', null, p.sex || '—')),
          ce('span', null, 'Code status ', ce('b', null, p.codeStatus || '—'))
        ),
        ce('div', { className: 'ma-allergy' + (nkda ? ' nkda' : ''), role: nkda ? null : 'alert' },
          ce('span', { className: 'ma-allergy-ic', 'aria-hidden': 'true' }, nkda ? '○' : '▲'),
          ce('span', null,
            ce('span', { className: 'ma-allergy-lbl' }, nkda ? 'Allergies' : 'Allergies — verify before every dose'),
            ce('span', { className: 'ma-allergy-val' }, allergies.join('  •  ') || 'No known drug allergies'))
        ),
        ce('div', { style: { marginTop: 12 } },
          ce('div', { className: 'ma-kv' }, ce('span', null, 'Admitting diagnosis'), ce('b', null, p.admittingDx || '—')),
          ce('div', { className: 'ma-kv' }, ce('span', null, 'Past medical history'), ce('b', null, (p.pmh || []).join(', ') || '—')),
          ce('div', { className: 'ma-kv' }, ce('span', null, 'IV access'), ce('b', null, c.ivAccess || 'None'))
        )
      ),
      /* labs + vitals */
      ce('div', { className: 'ma-panels' },
        ce('div', { className: 'ma-panel' },
          ce('h4', null, 'Laboratory'),
          Object.keys(labs).map(function (k) {
            return ce('div', { className: 'ma-kv', key: k }, ce('span', null, k), ce('b', null, labs[k]));
          })
        ),
        ce('div', { className: 'ma-panel' },
          ce('h4', null, 'Vital signs'),
          Object.keys(vitals).map(function (k) {
            var ab = flagVital(k, vitals[k]);
            return ce('div', { className: 'ma-kv' + (ab ? ' flag' : ''), key: k },
              ce('span', null, k),
              ce('b', null,
                ab ? ce('span', { 'aria-hidden': 'true', style: { marginRight: 4 } }, '▲') : null,
                ab ? ce('span', { className: 'ma-sr' }, 'abnormal: ') : null,
                vitals[k]));
          })
        )
      ),
      c.clinicalNote ? ce('div', { className: 'ma-note' },
        ce('b', null, 'Nursing note: '), c.clinicalNote) : null,
      /* med grid */
      ce('div', { className: 'ma-marhead' },
        ce('div', null, 'Medication'), ce('div', null, 'Dose / supply'), ce('div', null, 'Route'),
        ce('div', null, 'Frequency'), ce('div', null, 'Times'), ce('div', null, '')
      ),
      (c.medications || []).map(function (m) {
        var isDone = !!done[m.id];
        return ce('button', {
          key: m.id, type: 'button',
          className: 'ma-marrow' + (isDone ? ' done' : ''),
          onClick: function () { if (props.onSelect) props.onSelect(m); },
          'aria-label': 'Work medication ' + m.name + (isDone ? ' (already completed)' : '')
        },
          ce('div', { className: 'ma-mname' },
            ce('span', { className: 'ma-lbl' }, 'Medication'), m.name,
            m.isPRN ? ce('span', { className: 'ma-tag', style: { marginLeft: 6 } }, 'PRN') : null,
            isHighAlert(m) ? ce('span', { className: 'ma-tag red', style: { marginLeft: 6 } }, 'High alert') : null),
          ce('div', { className: 'ma-mcell' },
            ce('span', { className: 'ma-lbl' }, 'Dose'), m.dose,
            m.concentration ? ce('span', { style: { color: 'var(--text3)' } }, ' (' + m.concentration + ')') : null),
          ce('div', { className: 'ma-mcell' }, ce('span', { className: 'ma-lbl' }, 'Route'), m.route),
          ce('div', { className: 'ma-mcell' }, ce('span', { className: 'ma-lbl' }, 'Frequency'), m.frequency),
          ce('div', { className: 'ma-times' },
            ce('span', { className: 'ma-lbl' }, 'Times'),
            (c.medTimes || []).map(function (t) {
              var due = t === c.currentTime;
              return ce('span', { key: t, className: 'ma-time' + (due ? ' due' : '') + (m.isPRN ? ' prn' : '') }, t);
            })),
          ce('div', { className: 'ma-go' }, isDone ? 'Completed ✓' : 'Work this →')
        );
      }),
      ce('div', { className: 'ma-note', style: { borderBottom: 'none', borderTop: '1px solid var(--surface2)' } },
        'Dashed time chips are PRN. A highlighted chip is due at the current time. Select a medication to begin the administration sequence.')
    );
  }

  /* ==========================================================================
   * 7. TRAP CARD + CRITICAL SCREEN
   * ======================================================================== */

  function TrapCard(props) {
    var t = props.trap;
    if (!t) return null;
    var sev = t.severity || 'minor';
    var tone = sev === 'critical' ? 'bad' : (sev === 'major' ? 'part' : '');
    return ce('div', { className: 'ma-fb ' + tone, style: { marginTop: 10 } },
      ce('div', { className: 'ma-fb-t' },
        ce('span', { className: 'ma-tag ' + (sev === 'critical' ? 'red' : sev === 'major' ? 'orange' : '') }, sev),
        ' Trap detected'),
      ce('div', { style: { marginBottom: 6 } }, ce('b', null, 'Trigger: '), t.trigger),
      ce('div', { style: { marginBottom: 6 } }, ce('b', null, 'What happens: '), t.whatHappens),
      ce('div', { style: { marginBottom: 6 } }, ce('b', null, 'Correct action: '), t.correctAction),
      ce('div', { className: 'ma-teach' }, ce('b', null, 'Teaching point: '), t.teachingPoint)
    );
  }

  function CriticalScreen(props) {
    var stop = props.stop;
    var def = criticalErrorDef(stop.code);
    return ce('div', { className: 'ma-crit', role: 'alert', 'aria-live': 'assertive' },
      ce('div', { className: 'ma-crit-h' },
        ce('div', { className: 'k' }, 'Critical error — attempt failed'),
        ce('div', { className: 't' }, def.text || stop.code)
      ),
      ce('div', { className: 'ma-crit-b' },
        ce('div', { className: 'ma-crit-sec' },
          ce('h5', null, 'What you did'),
          ce('p', null, stop.action)),
        stop.conflict ? ce('div', { className: 'ma-crit-sec' },
          ce('h5', null, 'The conflict you cleared'),
          ce('p', null, stop.conflict.why)) : null,
        ce('div', { className: 'ma-crit-sec' },
          ce('h5', null, 'What would have happened to the patient'),
          ce('p', null, (stop.trap && stop.trap.whatHappens) || def.explanation)),
        stop.trap ? ce('div', { className: 'ma-crit-sec' },
          ce('h5', null, 'What you should have done'),
          ce('p', null, stop.trap.correctAction)) : null,
        ce('div', { className: 'ma-crit-sec' },
          ce('h5', null, 'Teaching point'),
          ce('p', null, (stop.trap && stop.trap.teachingPoint) || def.explanation)),
        ce('div', { className: 'ma-crit-sec' },
          ce('h5', null, 'Why this ends the attempt'),
          ce('p', null, 'On the official rubric this is listed as a critical error. A critical error is an automatic FAIL regardless of every other item. ' +
            'You get ' + (RUBRIC().maxAttempts || 2) + ' attempts at the real checkoff, so this is the place to make the mistake.')),
        ce('div', { className: 'ma-row', style: { marginTop: 6 } },
          ce('button', { className: 'ma-btn ma-btn-primary', onClick: props.onRestart }, 'Restart this medication'),
          ce('button', { className: 'ma-btn', onClick: props.onExit }, 'Back to the MAR')),
        ce(AskInstructor, {
          context: props.aiContext,
          suggestions: ['Why is this a critical error?', 'How do I catch this next time?']
        })
      )
    );
  }

  /* ==========================================================================
   * 8. DOSE CALCULATOR (reuses window.StepCalc when present)
   * ======================================================================== */

  function DoseCalc(props) {
    var v = useState(''), val = v[0], setVal = v[1];
    var SC = window.StepCalc;
    function submit(raw) { if (props.onAnswer) props.onAnswer(raw); }

    if (typeof SC === 'function') {
      return ce('div', { style: { marginTop: 10 } },
        ce(SC, {
          hint: props.hint, answer: props.answer, unit: props.unit,
          isActive: !props.status, status: props.status, onResult: submit
        }));
    }
    return ce('div', { style: { marginTop: 10 } },
      ce('div', { className: 'ma-row', style: { flexWrap: 'nowrap' } },
        ce('input', {
          className: 'ma-input', type: 'text', inputMode: 'decimal', value: val,
          disabled: !!props.status,
          'aria-label': 'Your answer' + (props.unit ? ' in ' + props.unit : ''),
          placeholder: 'Answer' + (props.unit ? ' in ' + props.unit : ''),
          onChange: function (e) { setVal(e.target.value); },
          onKeyDown: function (e) { if (e.key === 'Enter' && val && !props.status) submit(val); }
        }),
        ce('button', {
          className: 'ma-btn ma-btn-primary', disabled: !!props.status || !val,
          onClick: function () { submit(val); }
        }, props.status ? 'Submitted' : 'Check')
      ),
      props.hint ? ce('div', { className: 'ma-muted', style: { marginTop: 6 } }, 'Hint: ' + props.hint) : null
    );
  }

  /* ==========================================================================
   * 9. MED RUN — the guided administration sequence
   * ======================================================================== */

  function MedRun(props) {
    var caseObj = props.caseObj, med = props.med;
    var built = useMemo(function () { return buildSteps(caseObj, med); }, [caseObj.id, med.id]);
    var steps = built.steps;

    var i0 = useState(0), idx = i0[0], setIdx = i0[1];
    var s0 = useState(function () {
      return { scores: {}, answered: {}, criticals: [], majors: [], missed: [], decision: null, verbal: null };
    });
    var run = s0[0], setRun = s0[1];
    var h0 = useState(null), hardStop = h0[0], setHardStop = h0[1];
    var r0 = useState(false), revealed = r0[0], setRevealed = r0[1];
    var m0 = useState([]), multiSel = m0[0], setMultiSel = m0[1];
    var c0 = useState({ tries: 0, status: 'idle', last: '' }), calcSt = c0[0], setCalcSt = c0[1];
    var d0 = useState(false), finished = d0[0], setFinished = d0[1];
    var t0 = useRef(Date.now());

    var step = steps[idx];
    var answered = step ? run.answered[step.id] : null;

    var aiContext = useMemo(function () {
      var p = caseObj.patient || {};
      return 'MAR CASE: ' + caseObj.title +
        '\nPatient: ' + p.name + ', ' + p.age + ' ' + p.sex + ', ' + p.admittingDx +
        '\nAllergies: ' + (p.allergies || []).join(', ') +
        '\nVitals: ' + JSON.stringify(caseObj.vitals) +
        '\nLabs: ' + JSON.stringify(caseObj.labs) +
        '\nMedication under consideration: ' + med.name + ' ' + med.dose + ' ' + med.route + ' ' + med.frequency +
        '\nHold parameters: ' + (med.holdParameters || 'none listed');
    }, [caseObj.id, med.id]);

    function commit(stepObj, patch) {
      setRun(function (prev) {
        var next = shallow(prev);
        next.scores = shallow(prev.scores);
        next.answered = shallow(prev.answered);
        next.criticals = prev.criticals.slice();
        next.majors = prev.majors.slice();
        next.missed = prev.missed.slice();
        if (patch.scores) { for (var k in patch.scores) { if (Object.prototype.hasOwnProperty.call(patch.scores, k)) next.scores[k] = patch.scores[k]; } }
        if (patch.answered) next.answered[stepObj.id] = patch.answered;
        if (patch.critical) next.criticals.push(patch.critical);
        if (patch.major) next.majors.push(patch.major);
        if (patch.missed) next.missed = next.missed.concat(patch.missed);
        if (typeof patch.decision !== 'undefined') next.decision = patch.decision;
        if (typeof patch.verbal !== 'undefined') next.verbal = patch.verbal;
        return next;
      });
    }

    function scoresFor(stepObj, o) {
      var out = {};
      (stepObj.rubric || []).forEach(function (id) {
        out[id] = (o.scores && typeof o.scores[id] === 'number') ? o.scores[id] : o.score;
      });
      return out;
    }

    function stop(code, action, trap, conflict) {
      var s = { code: code, action: action, trap: trap || null, conflict: conflict || null };
      setHardStop(s);
      commit(step, { critical: { code: code, stepId: step.id, action: action, trapId: trap ? trap.id : null } });
    }

    /* ---- answering a plain choice step ---- */
    function chooseOption(stepObj, o, optionList) {
      if (run.answered[stepObj.id]) return;

      if (o.reveal) { setRevealed(true); return; }

      /* allergy gate */
      if (stepObj.isAllergyGate && o.allergyMiss && stepObj.conflict) {
        commit(stepObj, { answered: { optId: o.id, score: 0, tone: 'bad', feedback: '', trap: stepObj.conflictTrap }, scores: scoresFor(stepObj, o) });
        stop('allergy-not-checked',
          'You cleared the allergy check and prepared to give ' + med.name + ' to a patient with a documented ' +
          stepObj.conflict.allergy + ' allergy.',
          stepObj.conflictTrap, stepObj.conflict);
        return;
      }
      /* other hard-stop criticals */
      if (o.critical) {
        commit(stepObj, { answered: { optId: o.id, score: 0, tone: 'bad', feedback: o.feedback }, scores: scoresFor(stepObj, o) });
        stop(o.critical, o.text, null, null);
        return;
      }

      /* decision gate */
      if (stepObj.isDecisionGate) {
        var ca = stepObj.correctAction;
        var chosen = o.id === 'give' ? 'give' : o.id === 'hold' ? 'hold' : o.id === 'clarify' ? 'clarify-order' : 'partial';

        if (o.id === 'partial') {
          commit(stepObj, { answered: { optId: o.id, score: 0, tone: 'bad', feedback: o.feedback }, scores: scoresFor(stepObj, o), decision: 'give' });
          stop('wrong-dose', 'You altered the ordered dose. Adjusting a dose without an order is prescribing, and it is a wrong-dose critical error.', null, null);
          return;
        }
        if (o.id === 'give' && ca !== 'give') {
          var critTrap = null, k;
          for (k = 0; k < stepObj.hazards.length; k++) {
            if (stepObj.hazards[k].severity === 'critical') { critTrap = stepObj.hazards[k]; break; }
          }
          if (stepObj.conflict) {
            commit(stepObj, { answered: { optId: o.id, score: 0, tone: 'bad', feedback: '' }, scores: scoresFor(stepObj, o), decision: 'give' });
            stop('wrong-drug',
              'You administered ' + med.name + ' to a patient with a documented ' + stepObj.conflict.allergy + ' allergy.',
              stepObj.conflictTrap || critTrap, stepObj.conflict);
            return;
          }
          if (critTrap) {
            commit(stepObj, { answered: { optId: o.id, score: 0, tone: 'bad', feedback: '' }, scores: scoresFor(stepObj, o), decision: 'give' });
            stop(/route|push|infus|rate/i.test(trapText(critTrap)) ? 'wrong-route' : 'wrong-dose',
              'You administered ' + med.name + ' as ordered. The correct action was to ' +
              (ca === 'hold' ? 'HOLD the dose and notify the provider' : 'CLARIFY the order with the provider') + '.',
              critTrap, null);
            return;
          }
          /* major, not critical: the run continues but this competency is lost */
          commit(stepObj, {
            answered: {
              optId: o.id, score: 0, tone: 'bad',
              feedback: 'You gave a medication that should have been ' + (ca === 'hold' ? 'held' : 'clarified') + '. ' +
                (med.holdParameters ? 'Hold parameters on this order: ' + med.holdParameters : ''),
              trap: stepObj.hazards[0] || null
            },
            scores: scoresFor(stepObj, o),
            major: { stepId: stepObj.id, text: 'Administered a medication whose correct action was to ' + ca + '.' },
            decision: 'give'
          });
          return;
        }
        commit(stepObj, {
          answered: { optId: o.id, score: o.score, tone: o.tone, feedback: o.feedback, trap: (o.score === 2 && stepObj.hazards.length) ? stepObj.hazards[0] : null },
          scores: scoresFor(stepObj, o),
          decision: chosen === 'clarify-order' ? 'clarify' : chosen
        });
        return;
      }

      /* order-verification miss: show the trap but do not end the run */
      var payload = { optId: o.id, score: o.score, tone: o.tone, feedback: o.feedback, trap: o.missedHazard || null };
      var patch = { answered: payload, scores: scoresFor(stepObj, o) };
      if (o.missedHazard) {
        patch.missed = [{ trapId: o.missedHazard.id, stepId: stepObj.id }];
        patch.major = { stepId: stepObj.id, text: 'Accepted an unsafe order as written.' };
      }
      /* correct allergy catch: attach the trap card as reinforcement */
      if (stepObj.isAllergyGate && stepObj.conflict && o.id === 'stop') payload.trap = stepObj.conflictTrap;
      commit(stepObj, patch);
    }

    /* ---- multi-select assessment step ---- */
    function submitMulti(stepObj) {
      if (run.answered[stepObj.id]) return;
      var req = stepObj.items.filter(function (it) { return it.req; });
      var chosenReq = req.filter(function (it) { return multiSel.indexOf(it.text) !== -1; });
      var chosenBad = stepObj.items.filter(function (it) { return !it.req && multiSel.indexOf(it.text) !== -1; });
      var omitted = req.filter(function (it) { return multiSel.indexOf(it.text) === -1; });

      var score;
      if (chosenReq.length === req.length && chosenBad.length === 0) score = 2;
      else if (chosenReq.length >= Math.ceil(req.length * 0.6) && chosenBad.length <= 1) score = 1;
      else score = 0;

      /* did an omission correspond to an encoded trap? */
      var firedTrap = null, missedList = [];
      omitted.forEach(function (it) {
        var h = hazardForCheck(stepObj.hazards || [], it.text);
        if (h) { if (!firedTrap) firedTrap = h; missedList.push({ trapId: h.id, stepId: stepObj.id, check: it.text }); }
      });
      if (firedTrap && score === 2) score = 1;

      var fb = 'You caught ' + chosenReq.length + ' of ' + req.length + ' required assessments' +
        (chosenBad.length ? ' and selected ' + chosenBad.length + ' that are not appropriate nursing assessments.' : '.');

      commit(stepObj, {
        answered: {
          optId: 'multi', score: score, tone: score === 2 ? 'good' : score === 1 ? 'part' : 'bad',
          feedback: fb, trap: firedTrap, omitted: omitted.map(function (o) { return o.text; }),
          badPicks: chosenBad.map(function (o) { return o.text; })
        },
        scores: scoresFor(stepObj, { score: score }),
        missed: missedList,
        major: firedTrap ? { stepId: stepObj.id, text: 'Omitted a required assessment: ' + missedList[0].check } : null
      });
    }

    /* ---- calculation step ---- */
    function submitCalc(stepObj, raw) {
      if (run.answered[stepObj.id]) return;
      var target = stepObj.calc.answer;
      var num = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
      var ok = (typeof target === 'number') && isFinite(num) &&
        (Math.abs(num - target) <= Math.max(0.05, Math.abs(target) * 0.02));
      var tries = calcSt.tries + 1;
      if (ok) {
        setCalcSt({ tries: tries, status: 'correct', last: raw });
        commit(stepObj, {
          answered: {
            optId: 'calc', score: tries === 1 ? 2 : 1, tone: tries === 1 ? 'good' : 'part',
            feedback: (tries === 1 ? 'Correct on the first attempt.' : 'Correct on attempt ' + tries + '. At the checkoff you get one shot at the math.'),
            work: stepObj.calc.work
          },
          scores: scoresFor(stepObj, { score: tries === 1 ? 2 : 1 })
        });
      } else if (tries >= 2) {
        setCalcSt({ tries: tries, status: 'wrong', last: raw });
        commit(stepObj, {
          answered: {
            optId: 'calc', score: 0, tone: 'bad',
            feedback: 'Not correct. The answer is ' + target + ' ' + stepObj.calc.unit + '. A decimal-point error here is a tenfold error at the bedside.',
            work: stepObj.calc.work
          },
          scores: scoresFor(stepObj, { score: 0 })
        });
      } else {
        setCalcSt({ tries: tries, status: 'retry', last: raw });
      }
    }

    /* ---- navigation ---- */
    function next() {
      if (idx + 1 >= steps.length) { finish(); return; }
      setIdx(idx + 1); setRevealed(false); setMultiSel([]);
      setCalcSt({ tries: 0, status: 'idle', last: '' });
      var el = document.getElementById('ma-steptop');
      if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'start' }); } catch (e) {} }
    }

    function finish() { setFinished(true); }

    useEffect(function () {
      if (hardStop && props.onCritical) props.onCritical(hardStop);
    }, [hardStop]);

    /* ---- running tally ---- */
    var liveTotal = 0, liveDone = 0;
    allRubricItems().forEach(function (it) {
      if (typeof run.scores[it.id] === 'number') { liveTotal += run.scores[it.id]; liveDone++; }
    });

    /* ---- hard stop screen ---- */
    if (hardStop) {
      return ce('div', null,
        ce(CriticalScreen, {
          stop: hardStop, aiContext: aiContext,
          onRestart: function () {
            setHardStop(null); setIdx(0); setFinished(false); setRevealed(false); setMultiSel([]);
            setCalcSt({ tries: 0, status: 'idle', last: '' });
            setRun({ scores: {}, answered: {}, criticals: [], majors: [], missed: [], decision: null, verbal: null });
            t0.current = Date.now();
          },
          onExit: props.onExit
        }),
        ce(RunDebrief, {
          caseObj: caseObj, med: med, run: run, built: built, failedHard: hardStop,
          onExit: props.onExit, onReport: props.onDone,
          timeSec: Math.round((Date.now() - t0.current) / 1000)
        })
      );
    }

    if (finished) {
      return ce(RunDebrief, {
        caseObj: caseObj, med: med, run: run, built: built, failedHard: null,
        onExit: props.onExit, onReport: props.onDone,
        timeSec: Math.round((Date.now() - t0.current) / 1000),
        onRestart: function () {
          setIdx(0); setFinished(false); setRevealed(false); setMultiSel([]);
          setCalcSt({ tries: 0, status: 'idle', last: '' });
          setRun({ scores: {}, answered: {}, criticals: [], majors: [], missed: [], decision: null, verbal: null });
          t0.current = Date.now();
        }
      });
    }

    /* ---- resolve dynamic step options ---- */
    var optionList = step.options;
    if (step.dynamic === 'act' || step.dynamic === 'document') {
      var gave = run.decision === 'give';
      optionList = gave ? step.giveOptions : step.holdOptions;
    }

    return ce('div', null,
      /* score bar */
      ce('div', { className: 'ma-scorebar' },
        ce('span', { className: 'ma-sc' }, 'Rubric ', ce('b', null, liveTotal + ' / 40')),
        ce('span', { className: 'ma-sc' }, 'Items scored ', ce('b', null, liveDone + ' / 20')),
        ce('span', { className: 'ma-sc' }, 'Step ', ce('b', null, (idx + 1) + ' / ' + steps.length)),
        ce('span', { className: 'ma-critind' + (run.criticals.length ? ' hit' : '') },
          run.criticals.length ? run.criticals.length + ' critical error' + (run.criticals.length > 1 ? 's' : '') : 'No critical errors')
      ),
      /* step dots */
      ce('div', { className: 'ma-stepbar', role: 'img', 'aria-label': 'Progress: step ' + (idx + 1) + ' of ' + steps.length },
        steps.map(function (s, n) {
          var a = run.answered[s.id];
          var cls = n === idx ? 'now' : (!a ? '' : a.score === 2 ? 'ok' : a.score === 1 ? 'part' : 'bad');
          return ce('div', { key: s.id, className: 'ma-stepdot ' + cls });
        })),

      ce('div', { className: 'ma-card', id: 'ma-steptop' },
        ce('div', { className: 'ma-phase' }, step.phase),
        ce('h3', { className: 'ma-steptitle' }, step.title,
          (step.rubric || []).length ? ce('span', { style: { marginLeft: 8 } },
            step.rubric.map(function (rid) {
              var it = rubricItem(rid);
              return ce('span', { key: rid, className: 'ma-tag ' + (it.critical ? 'red' : ''), style: { marginRight: 4 } }, it.title);
            })) : ce('span', { className: 'ma-tag', style: { marginLeft: 8 } }, 'not scored')),
        ce('p', { className: 'ma-prompt', style: { whiteSpace: 'pre-wrap' } }, step.prompt),
        step.reference ? ce('div', { className: 'ma-muted', style: { marginBottom: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 } }, step.reference) : null,

        /* --- allergy cross-reference reveal --- */
        (step.isAllergyGate && revealed) ? ce('div', { className: 'ma-fb part' },
          ce('div', { className: 'ma-fb-t' }, 'Drug guide — cross reference'),
          ce('div', null, 'Documented allergies: ', ce('b', null, step.allergyList)),
          built.drug ? ce('div', { style: { marginTop: 6 } },
            ce('b', null, 'Ordered drug: '), built.drug.generic,
            (built.drug.brand || []).length ? ' — sold as ' + built.drug.brand.join(', ') : '',
            ce('div', { className: 'ma-muted', style: { marginTop: 4 } }, 'Class: ' + built.drug.classification)
          ) : ce('div', { style: { marginTop: 6 } }, 'Ordered drug: ' + med.name),
          ce('div', { className: 'ma-teach' },
            'You asked the patient what the reaction was — good practice, it separates a rash from angioedema. Now make the call.')
        ) : null,

        /* --- vitals / labs reference for the assessment step --- */
        (step.showVitals) ? ce('div', { className: 'ma-panels', style: { borderRadius: 9, overflow: 'hidden', marginBottom: 12 } },
          ce('div', { className: 'ma-panel' }, ce('h4', null, 'Vitals'),
            Object.keys(caseObj.vitals || {}).map(function (k) {
              return ce('div', { className: 'ma-kv', key: k }, ce('span', null, k), ce('b', null, caseObj.vitals[k]));
            })),
          ce('div', { className: 'ma-panel' }, ce('h4', null, 'Labs'),
            Object.keys(caseObj.labs || {}).map(function (k) {
              return ce('div', { className: 'ma-kv', key: k }, ce('span', null, k), ce('b', null, caseObj.labs[k]));
            })),
          ce('div', { className: 'ma-panel' }, ce('h4', null, 'Hold parameters'),
            ce('div', { className: 'ma-muted' }, med.holdParameters || 'None listed.'))
        ) : null,

        /* --- drug card for the drug-guide step --- */
        (step.drugCard && answered) ? ce('div', { className: 'ma-fb', style: { marginBottom: 10 } },
          ce('div', { className: 'ma-fb-t' }, 'Drug guide — ' + step.drugCard.generic),
          ce('div', null, ce('b', null, 'Class: '), step.drugCard.classification),
          ce('div', { style: { marginTop: 4 } }, ce('b', null, 'Use: '), step.drugCard.use),
          ce('div', { style: { marginTop: 4 } }, ce('b', null, 'Hold: '), step.drugCard.holdParameters),
          ce('div', { style: { marginTop: 4 } }, ce('b', null, 'Antidote: '), step.drugCard.antidote),
          ce('div', { className: 'ma-teach' }, step.drugCard.atiPearl)
        ) : null,

        /* --- body by type --- */
        step.type === 'calc' ? ce('div', null,
          ce('div', { className: 'ma-muted', style: { marginBottom: 8 } }, step.calc.supply),
          ce(DoseCalc, {
            hint: step.calc.hint, answer: step.calc.answer, unit: step.calc.unit,
            status: calcSt.status === 'correct' ? 'correct' : (answered ? 'wrong' : null),
            onAnswer: function (raw) { submitCalc(step, raw); }
          }),
          (calcSt.status === 'retry') ? ce('div', { className: 'ma-fb part' },
            ce('div', { className: 'ma-fb-t' }, 'Not yet — one more attempt'),
            'Check your units and your conversion. Convert pounds to kilograms (÷ 2.2) BEFORE any weight-based math, and use Desired ÷ Have × Quantity.') : null
        ) : null,

        step.type === 'verbalize' ? ce('div', null,
          ce(VerbalizeBox, {
            required: step.verbalize.required,
            onResult: function (r) {
              commit(step, {
                answered: {
                  optId: 'verbal', score: 2, tone: r.got === r.total ? 'good' : 'part',
                  feedback: r.got === r.total
                    ? 'All four elements said out loud. That is what the evaluator is listening for.'
                    : 'You said ' + r.got + ' of ' + r.total + '. Missing elements cost you on the three-check items at a real checkoff.'
                },
                verbal: r
              });
            }
          }),
          !answered ? ce('button', {
            className: 'ma-btn ma-btn-ghost ma-btn-sm', style: { marginTop: 10 },
            onClick: function () { commit(step, { answered: { optId: 'skip', score: 2, tone: 'part', feedback: 'Skipped. At the real checkoff you must verbalize — practise it out loud at least once.' } }); }
          }, 'Skip (not scored)') : null
        ) : null,

        step.type === 'multi' ? ce('div', null,
          ce('div', { className: 'ma-opts' },
            step.items.map(function (it, n) {
              var sel = multiSel.indexOf(it.text) !== -1;
              var cls = 'ma-opt' + (sel ? ' sel' : '');
              if (answered) {
                cls = 'ma-opt' + (it.req ? ' good' : (sel ? ' bad' : ' dim'));
              }
              return ce('button', {
                key: n, type: 'button', className: cls, disabled: !!answered,
                'aria-pressed': sel ? 'true' : 'false',
                onClick: function () {
                  setMultiSel(sel ? multiSel.filter(function (x) { return x !== it.text; }) : multiSel.concat([it.text]));
                }
              },
                ce('span', { className: 'ma-opt-mark', 'aria-hidden': 'true' },
                  answered ? (it.req ? '✓' : (sel ? '✕' : '')) : (sel ? '✓' : '')),
                ce('span', null, it.text));
            })),
          !answered ? ce('button', {
            className: 'ma-btn ma-btn-primary', style: { marginTop: 12 },
            disabled: multiSel.length === 0, onClick: function () { submitMulti(step); }
          }, 'Submit assessment (' + multiSel.length + ' selected)') : null
        ) : null,

        (!step.type || step.type === 'choice') ? ce('div', { className: 'ma-opts' },
          (optionList || []).map(function (o) {
            var chosen = answered && answered.optId === o.id;
            var cls = 'ma-opt';
            if (answered) {
              if (chosen) cls += ' ' + (answered.score === 2 ? 'good' : answered.score === 1 ? 'part' : 'bad');
              else if (o.score === 2) cls += ' good dim';
              else cls += ' dim';
            }
            return ce('button', {
              key: o.id, type: 'button', className: cls, disabled: !!answered,
              onClick: function () { chooseOption(step, o, optionList); }
            },
              ce('span', { className: 'ma-opt-mark', 'aria-hidden': 'true' },
                answered ? (chosen ? (answered.score === 2 ? '✓' : answered.score === 1 ? '~' : '✕') : (o.score === 2 ? '✓' : '')) : ''),
              ce('span', null, o.text));
          })
        ) : null,

        /* --- feedback --- */
        answered ? ce('div', { className: 'ma-fb ' + (answered.tone || '') },
          ce('div', { className: 'ma-fb-t' },
            answered.score === 2 ? 'Correct — 2 of 2' : answered.score === 1 ? 'Partial — 1 of 2' : 'Incorrect — 0 of 2'),
          answered.feedback ? ce('div', null, answered.feedback) : null,
          answered.omitted && answered.omitted.length ? ce('div', { style: { marginTop: 8 } },
            ce('b', null, 'You omitted: '),
            ce('ul', { className: 'ma-ul' }, answered.omitted.map(function (t, n) { return ce('li', { key: n }, t); }))) : null,
          answered.badPicks && answered.badPicks.length ? ce('div', { style: { marginTop: 8 } },
            ce('b', null, 'Not a nursing assessment: '),
            ce('ul', { className: 'ma-ul' }, answered.badPicks.map(function (t, n) { return ce('li', { key: n }, t); }))) : null,
          answered.work ? ce('div', { className: 'ma-teach' }, ce('b', null, 'Worked solution: '), answered.work) : null,
          (step.rubric || []).length ? ce('div', { className: 'ma-teach' },
            step.rubric.map(function (rid) {
              var it = rubricItem(rid);
              return ce('div', { key: rid, style: { marginBottom: 6 } },
                ce('b', null, it.title + ': '), it.teachingPoint);
            })) : null
        ) : null,

        answered && answered.trap ? ce(TrapCard, { trap: answered.trap }) : null,

        answered ? ce('div', { className: 'ma-row', style: { marginTop: 14 } },
          ce('button', { className: 'ma-btn ma-btn-primary', onClick: next },
            idx + 1 >= steps.length ? 'Finish and grade' : 'Next step →')
        ) : null,

        ce(AskInstructor, {
          context: aiContext + '\nCurrent step: ' + step.title,
          suggestions: ['What am I supposed to check here?', 'Why would this dose be held?']
        })
      ),

      ce('div', { className: 'ma-row' },
        ce('button', { className: 'ma-btn ma-btn-ghost ma-btn-sm', onClick: props.onExit }, '← Abandon and return to the MAR'))
    );
  }

  /* ==========================================================================
   * 10. RUN DEBRIEF
   * ======================================================================== */

  function RunDebrief(props) {
    var caseObj = props.caseObj, med = props.med, run = props.run, built = props.built;
    var grade = gradeRun(run.scores, run.criticals);
    var reported = useRef(false);

    useEffect(function () {
      if (reported.current) return;
      reported.current = true;
      if (props.onReport) {
        props.onReport({
          medId: med.id, medName: med.name,
          rubricScores: run.scores,
          score: grade.total, maxScore: grade.max, pct: grade.pct,
          criticalErrors: run.criticals.map(function (c) { return c.code; }),
          criticalDetail: run.criticals,
          majors: run.majors, missed: run.missed,
          passed: grade.passed, decision: run.decision,
          timeSec: props.timeSec || 0
        });
      }
    }, []);

    var caught = [], missedIds = {};
    (run.missed || []).forEach(function (m) { missedIds[m.trapId] = 1; });
    (run.criticals || []).forEach(function (c) { if (c.trapId) missedIds[c.trapId] = 1; });
    (built.hazards || []).forEach(function (h) { if (!missedIds[h.id]) caught.push(h); });

    var review = [];
    grade.criticals.forEach(function (c) { review.push('CRITICAL — ' + criticalErrorDef(c.code).text + ': ' + criticalErrorDef(c.code).explanation); });
    grade.critFail.forEach(function (it) { review.push('Critical competency below full marks — ' + it.title + ': ' + it.teachingPoint); });
    grade.zeros.forEach(function (it) {
      if (grade.critFail.indexOf(it) === -1) review.push('Not demonstrated — ' + it.title + ': ' + it.teachingPoint);
    });
    (built.hazards || []).forEach(function (h) { if (missedIds[h.id]) review.push('Missed trap (' + h.severity + ') — ' + h.teachingPoint); });

    return ce('div', null,
      ce('div', { className: 'ma-verdict ' + (grade.passed ? 'pass' : 'fail'), role: 'status' },
        ce('div', { className: 'v' }, grade.passed ? 'PASS' : 'FAIL'),
        ce('div', { className: 'p' }, grade.total + ' / ' + grade.max + '  ·  ' + grade.pct + '%'),
        ce('div', { className: 'r' },
          grade.passed
            ? 'All 20 competencies demonstrated, every critical item at full marks, no critical errors. This is what the real checkoff looks like when it goes right.'
            : (grade.criticals.length
              ? 'A critical error was committed. On the real rubric that is an automatic fail regardless of the total score.'
              : (grade.critFail.length
                ? 'One or more CRITICAL competencies scored below 2 of 2. Every critical item must be fully demonstrated.'
                : 'One or more competencies scored 0. A 0 means the competency was not demonstrated.')))
      ),

      ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Pass rules applied'),
        ce(PassRules, null)),

      run.criticals.length ? ce('div', { className: 'ma-card', style: { borderColor: 'var(--red)' } },
        ce('div', { className: 'ma-card-t' }, ce('span', { className: 'ma-tag red' }, 'Critical'), 'Critical errors this attempt'),
        run.criticals.map(function (c, i) {
          var def = criticalErrorDef(c.code);
          return ce('div', { key: i, style: { marginBottom: 10 } },
            ce('div', { style: { fontWeight: 800, color: 'var(--red)' } }, def.text),
            ce('div', { className: 'ma-muted' }, c.action),
            ce('div', { className: 'ma-muted', style: { marginTop: 4 } }, def.explanation));
        })
      ) : null,

      /* full rubric breakdown */
      ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Every rubric item — ' + med.name),
        (RUBRIC().sections || []).map(function (sec) {
          return ce('div', { key: sec.id, style: { marginBottom: 14 } },
            ce('div', { className: 'ma-tiny', style: { marginBottom: 6 } }, sec.title),
            (sec.items || []).map(function (it) {
              var s = typeof run.scores[it.id] === 'number' ? run.scores[it.id] : 0;
              var col = s === 2 ? 'var(--green)' : s === 1 ? 'var(--orange)' : 'var(--red)';
              var mark = s === 2 ? '✓' : s === 1 ? '~' : '✕';
              return ce('div', {
                key: it.id, className: 'ma-bar',
                style: { gridTemplateColumns: 'auto 1fr auto', padding: '4px 0' }
              },
                ce('span', { style: { color: col, fontWeight: 900, width: 16 } }, mark),
                ce('span', null, it.title,
                  it.critical ? ce('span', { className: 'ma-tag red', style: { marginLeft: 6 } }, 'critical') : null),
                ce('b', { style: { color: col } }, s + '/2'));
            }));
        })
      ),

      /* traps */
      (built.hazards || []).length ? ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Traps encoded in this medication (' + built.hazards.length + ')'),
        ce('div', { className: 'ma-muted', style: { marginBottom: 10 } },
          'Every one of these is a hazard your instructor could put in front of you. ' +
          caught.length + ' handled, ' + (built.hazards.length - caught.length) + ' missed.'),
        (built.hazards || []).map(function (h) {
          return ce('div', { key: h.id, style: { marginBottom: 4 } },
            ce('div', { className: 'ma-row', style: { marginBottom: 2 } },
              ce('span', { className: 'ma-tag ' + (missedIds[h.id] ? 'red' : 'green') }, missedIds[h.id] ? 'missed' : 'handled'),
              ce('span', { className: 'ma-tag ' + (h.severity === 'critical' ? 'red' : h.severity === 'major' ? 'orange' : '') }, h.severity)),
            ce(TrapCard, { trap: h }));
        })
      ) : null,

      /* rest of the case */
      caseLevelHazards(caseObj).length ? ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Other hazards in this case'),
        ce('div', { className: 'ma-muted', style: { marginBottom: 8 } },
          'These are not tied to ' + med.name + ', but they are live on this chart and you are expected to catch them.'),
        caseLevelHazards(caseObj).map(function (h) { return ce(TrapCard, { key: h.id, trap: h }); })
      ) : null,

      review.length ? ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Review before the real thing'),
        ce('ul', { className: 'ma-ul' }, review.map(function (r, i) { return ce('li', { key: i }, r); }))
      ) : null,

      ce('div', { className: 'ma-row' },
        props.onRestart ? ce('button', { className: 'ma-btn ma-btn-primary', onClick: props.onRestart }, 'Run this medication again') : null,
        ce('button', { className: 'ma-btn', onClick: props.onExit }, 'Back to the MAR')),

      ce(AskInstructor, {
        context: 'Case: ' + caseObj.title + '\nMedication: ' + med.name + ' ' + med.dose + ' ' + med.route +
          '\nResult: ' + (grade.passed ? 'PASS' : 'FAIL') + ' ' + grade.total + '/40' +
          '\nCritical errors: ' + (run.criticals.map(function (c) { return c.code; }).join(', ') || 'none'),
        suggestions: ['Explain my mistakes simply', 'What should I drill before my checkoff?']
      })
    );
  }

  /* ==========================================================================
   * 11. MODE 1 — MAR SIMULATION
   * ======================================================================== */

  function MARSimulation(props) {
    var cs = CASES();
    var c0 = useState(props.forceCaseId || null), caseId = c0[0], setCaseId = c0[1];
    var m0 = useState(null), medId = m0[0], setMedId = m0[1];
    var d0 = useState({}), completed = d0[0], setCompleted = d0[1];

    var caseObj = null, i;
    for (i = 0; i < cs.length; i++) { if (cs[i].id === caseId) caseObj = cs[i]; }
    var med = null;
    if (caseObj) { (caseObj.medications || []).forEach(function (m) { if (m.id === medId) med = m; }); }

    function report(r) {
      var payload = {
        caseId: caseObj.id, date: new Date().toISOString(), mode: props.mode || 'mar-practice',
        score: r.score, maxScore: r.maxScore, pct: r.pct,
        criticalErrors: r.criticalErrors, passed: r.passed,
        timeSec: r.timeSec || 0, rubricScores: r.rubricScores,
        drugs: [r.medName], medIds: [r.medId], decision: r.decision
      };
      saveResult(payload);
      setCompleted(function (prev) { var n = shallow(prev); n[r.medId] = { passed: r.passed, pct: r.pct }; return n; });
      if (props.onReport) props.onReport(payload);
      toast(r.passed ? 'Medication passed — ' + r.pct + '%' : 'Attempt failed — review the debrief', r.passed ? 'success' : 'error');
    }

    if (!caseObj) {
      return ce('div', null,
        ce('div', { className: 'ma-card' },
          ce('div', { className: 'ma-card-t' }, 'Choose a chart'),
          ce('div', { className: 'ma-muted' },
            'Each chart is a full Medication Administration Record with encoded hazards. You will work one medication at a time ' +
            'through the same sequence your evaluator observes: three checks, two identifiers, allergy check, calculation, ' +
            'assessment, decision, administration and documentation.')),
        ce('div', { className: 'ma-modegrid' },
          cs.map(function (c) {
            var crit = (c.traps || []).filter(function (t) { return t.severity === 'critical'; }).length;
            var p = c.patient || {};
            var nkda = (p.allergies || []).every(function (a) { return /no known/i.test(a); });
            return ce('button', {
              key: c.id, className: 'ma-modecard', onClick: function () { setCaseId(c.id); }
            },
              ce('div', { className: 'ma-row' },
                ce('span', { className: 'ma-tag blue' }, c.difficulty || 'Practice'),
                ce('span', { className: 'ma-tag red' }, crit + ' critical trap' + (crit === 1 ? '' : 's')),
                nkda ? null : ce('span', { className: 'ma-tag red' }, 'Allergy')),
              ce('div', { className: 'ma-modename', style: { marginTop: 4 } }, p.name),
              ce('div', { className: 'ma-modedesc' }, c.title),
              ce('div', { className: 'ma-modedesc', style: { color: 'var(--text3)' } },
                p.age + ' ' + p.sex + '  ·  ' + (c.medications || []).length + ' medications  ·  ' + (c.traps || []).length + ' traps'));
          }))
      );
    }

    if (med) {
      return ce('div', null,
        ce('div', { className: 'ma-row', style: { marginBottom: 10 } },
          ce('button', { className: 'ma-btn ma-btn-ghost ma-btn-sm', onClick: function () { setMedId(null); } }, '← MAR'),
          ce('span', { className: 'ma-tiny' }, (caseObj.patient || {}).name + ' · ' + med.name)),
        ce(MedRun, {
          caseObj: caseObj, med: med,
          onDone: report,
          onExit: function () { setMedId(null); }
        })
      );
    }

    var doneCount = Object.keys(completed).length;
    return ce('div', null,
      ce('div', { className: 'ma-row', style: { marginBottom: 10, justifyContent: 'space-between' } },
        props.forceCaseId ? null : ce('button', { className: 'ma-btn ma-btn-ghost ma-btn-sm', onClick: function () { setCaseId(null); setCompleted({}); } }, '← Choose a different chart'),
        ce('span', { className: 'ma-tiny' }, doneCount + ' of ' + (caseObj.medications || []).length + ' medications worked')),
      ce(MARChart, {
        caseObj: caseObj, completed: completed,
        onSelect: function (m) { setMedId(m.id); }
      }),
      ce(AskInstructor, {
        context: 'MAR case: ' + caseObj.title + '\nPatient: ' + JSON.stringify(caseObj.patient) +
          '\nVitals: ' + JSON.stringify(caseObj.vitals) + '\nLabs: ' + JSON.stringify(caseObj.labs) +
          '\nNote: ' + caseObj.clinicalNote,
        suggestions: ['What should worry me about this chart?', 'Which medication is the most dangerous here?']
      })
    );
  }

  /* ==========================================================================
   * 12. MODE 2 — RUBRIC PRACTICE
   * ======================================================================== */

  function RubricPractice() {
    var s0 = useState(0), secIdx = s0[0], setSecIdx = s0[1];
    var v0 = useState({}), vals = v0[0], setVals = v0[1];
    var t0 = useState({}), openT = t0[0], setOpenT = t0[1];
    var c0 = useState(false), critErr = c0[0], setCritErr = c0[1];
    var e0 = useState([]), critList = e0[0], setCritList = e0[1];

    var sections = RUBRIC().sections || [];
    var items = allRubricItems();
    var mult = RUBRIC().scoreMultiplier || 2.5;

    var total = 0, scored = 0, zeros = 0, critShort = 0;
    items.forEach(function (it) {
      if (typeof vals[it.id] === 'number') {
        total += vals[it.id]; scored++;
        if (vals[it.id] === 0) zeros++;
        else if (it.critical && vals[it.id] < 2) critShort++;
      }
    });
    var pct = Math.round(total * mult * 10) / 10;
    var complete = scored === items.length;
    var passed = complete && zeros === 0 && critShort === 0 && critList.length === 0;

    var sec = sections[secIdx];
    var stats = savedStats().rubric || {};

    function setVal(id, v) {
      setVals(function (p) { var n = shallow(p); n[id] = v; return n; });
    }

    return ce('div', null,
      ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'The official 40-point rubric'),
        ce('div', { className: 'ma-muted' }, RUBRIC().instructions),
        ce('div', { className: 'ma-big', style: { marginTop: 12 } },
          ce('div', { className: 'ma-stat' }, ce('b', null, total + '/40'), ce('span', null, 'Points')),
          ce('div', { className: 'ma-stat' }, ce('b', null, pct + '%'), ce('span', null, 'Percent')),
          ce('div', { className: 'ma-stat' }, ce('b', null, scored + '/' + items.length), ce('span', null, 'Rated')),
          ce('div', { className: 'ma-stat' },
            ce('b', { style: { color: critList.length ? 'var(--red)' : 'var(--green)' } }, String(critList.length)),
            ce('span', null, 'Critical errors'))),
        complete || critList.length
          ? ce('div', { className: 'ma-verdict ' + (passed ? 'pass' : 'fail'), style: { marginTop: 12, padding: 14 } },
            ce('div', { className: 'v', style: { fontSize: '1.5rem' } }, passed ? 'PASS' : 'FAIL'),
            ce('div', { className: 'r' },
              critList.length ? 'Critical error recorded — automatic fail.'
                : (critShort ? critShort + ' critical competency item(s) below 2 of 2.'
                  : (zeros ? zeros + ' item(s) scored 0 — competency not demonstrated.'
                    : 'All competencies demonstrated with no critical errors.'))))
          : null,
        ce('details', { style: { marginTop: 10 } },
          ce('summary', { style: { cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text2)' } }, 'How pass/fail is determined'),
          ce(PassRules, null))
      ),

      /* critical error checklist */
      ce('div', { className: 'ma-card', style: { borderColor: critList.length ? 'var(--red)' : 'var(--surface2)' } },
        ce('div', { className: 'ma-card-t' },
          ce('span', { className: 'ma-tag red' }, 'Automatic fail'),
          'The ' + (RUBRIC().criticalErrors || []).length + ' critical errors'),
        ce('div', { className: 'ma-muted', style: { marginBottom: 10 } },
          'Tick any that happened. One tick is a fail, whatever your point total is.'),
        (RUBRIC().criticalErrors || []).map(function (cerr) {
          var on = critList.indexOf(cerr.id) !== -1;
          return ce('div', { key: cerr.id, style: { marginBottom: 8 } },
            ce('button', {
              type: 'button', className: 'ma-opt' + (on ? ' bad' : ''), 'aria-pressed': on ? 'true' : 'false',
              onClick: function () {
                setCritList(on ? critList.filter(function (x) { return x !== cerr.id; }) : critList.concat([cerr.id]));
              }
            },
              ce('span', { className: 'ma-opt-mark', 'aria-hidden': 'true' }, on ? '✕' : ''),
              ce('span', null, ce('b', null, cerr.text),
                ce('div', { className: 'ma-muted', style: { marginTop: 4 } }, cerr.explanation))));
        })
      ),

      /* section nav */
      ce('div', { className: 'ma-tabs' },
        sections.map(function (s, i) {
          var done = (s.items || []).filter(function (it) { return typeof vals[it.id] === 'number'; }).length;
          return ce('button', {
            key: s.id, className: 'ma-tab' + (i === secIdx ? ' on' : ''),
            onClick: function () { setSecIdx(i); }
          }, s.title + ' (' + done + '/' + (s.items || []).length + ')');
        })),

      sec ? ce('div', null,
        (sec.items || []).map(function (it) {
          var v = vals[it.id];
          var mast = stats[it.id];
          return ce('div', { key: it.id, className: 'ma-item' + (it.critical ? ' crit' : '') },
            ce('div', { className: 'ma-row', style: { justifyContent: 'space-between', marginBottom: 4 } },
              ce('div', { style: { fontWeight: 800, fontSize: '0.95rem' } }, it.title),
              ce('div', { className: 'ma-row' },
                it.critical ? ce('span', { className: 'ma-tag red' }, 'Critical item') : null,
                mast ? ce('span', { className: 'ma-tag' }, 'Avg ' + (Math.round(mast.sum / mast.n * 10) / 10) + '/2 over ' + mast.n) : null)),
            ce('div', { className: 'ma-muted' }, it.description),
            ce('div', { className: 'ma-lvls' },
              [0, 1, 2].map(function (n) {
                return ce('button', {
                  key: n, type: 'button',
                  className: 'ma-lvl' + (v === n ? ' on' + n : ''),
                  'aria-pressed': v === n ? 'true' : 'false',
                  onClick: function () { setVal(it.id, n); }
                },
                  ce('b', null, n + ' point' + (n === 1 ? '' : 's') + (n === 2 ? ' — pass' : n === 1 ? ' — partial' : ' — fail')),
                  (it.levels || {})[n]);
              })),
            ce('button', {
              className: 'ma-btn ma-btn-ghost ma-btn-sm',
              'aria-expanded': openT[it.id] ? 'true' : 'false',
              onClick: function () { setOpenT(function (p) { var n = shallow(p); n[it.id] = !n[it.id]; return n; }); }
            }, openT[it.id] ? 'Hide teaching point' : 'Teaching point'),
            openT[it.id] ? ce('div', { className: 'ma-fb', style: { marginTop: 8 } }, it.teachingPoint) : null
          );
        }),
        ce('div', { className: 'ma-row' },
          secIdx > 0 ? ce('button', { className: 'ma-btn', onClick: function () { setSecIdx(secIdx - 1); } }, '← Previous section') : null,
          secIdx < sections.length - 1
            ? ce('button', { className: 'ma-btn ma-btn-primary', onClick: function () { setSecIdx(secIdx + 1); } }, 'Next section →')
            : ce('button', { className: 'ma-btn ma-btn-ghost', onClick: function () { setVals({}); setCritList([]); setSecIdx(0); } }, 'Reset self-assessment'))
      ) : null,

      ce(AskInstructor, {
        context: 'The student is self-assessing against the medication administration rubric. Current total ' + total + '/40 (' + pct + '%).',
        suggestions: ['What separates a 1 from a 2 on these items?', 'Which items do students fail most?']
      })
    );
  }

  /* ==========================================================================
   * 13. MODE 3 — SIX RIGHTS & THREE CHECKS DRILL
   * ======================================================================== */

  var RIGHTS = ['Right Patient', 'Right Medication', 'Right Route', 'Right Time', 'Right Dose', 'Right Documentation'];

  var RIGHTS_SNIPPETS = [
    ['You ask "Are you Mr. Doe?" and he nods, so you hand him the cup.', 'Right Patient', 'Never ask a leading question. Have the patient STATE their full name and date of birth.'],
    ['You confirm the room number on the door matches the MAR header and go in.', 'Right Patient', 'Room and bed numbers are never acceptable identifiers — patients get moved.'],
    ['You verify the name on the armband but skip the date of birth.', 'Right Patient', 'Two identifiers means two. Name AND date of birth (or MRN).'],
    ['You carry medications for two patients at once and mix up the cups.', 'Right Patient', 'Prepare and carry medications for ONE patient at a time.'],
    ['The MAR reads morphine; you pull hydromorphone because the boxes sit side by side.', 'Right Medication', 'Look-alike/sound-alike. Hydromorphone is 5 to 7 times more potent than morphine.'],
    ['The MAR reads Humalog; you draw up Humulin R because the vials look identical.', 'Right Medication', 'Humalog and Humulin R are a classic LASA pair. Read the label three times.'],
    ['The order says hydrALAZINE; you reach for hydrOXYzine.', 'Right Medication', 'Tall-man lettering exists precisely because of this pair. So does hydrochlorothiazide.'],
    ['Coumadin is on the MAR and warfarin is also on the MAR, and you give both.', 'Right Medication', 'Same drug, two names. Reconcile brand and generic entries before giving anything.'],
    ['You crush an extended-release tablet and send it down the feeding tube.', 'Right Route', 'Crushing an ER tablet delivers the whole 12 or 24 hour dose at once.'],
    ['You push potassium chloride IV because the potassium is low.', 'Right Route', 'Potassium chloride is NEVER given IV push. Always diluted, on a pump.'],
    ['You give oral vancomycin for a bloodstream infection.', 'Right Route', 'Oral vancomycin is not absorbed systemically — it only treats C. difficile in the gut.'],
    ['You hand a tablet to a patient whose swallow has never been assessed.', 'Right Route', 'Assess the ability to swallow and sit the patient upright before anything by mouth.'],
    ['The order does not specify a route, so you give it IV because that is fastest.', 'Right Route', 'The route must be written in the order. Never assume — clarify.'],
    ['You give rapid-acting insulin at 0730; the breakfast tray arrives at 0800.', 'Right Time', 'No tray, no rapid-acting insulin. Lispro works in 15 minutes.'],
    ['A PRN opioid ordered every 4 hours is given 2 hours after the last dose.', 'Right Time', 'Verify the last dose and the interval, including doses charted late by the previous shift.'],
    ['You give levothyroxine with breakfast and the morning calcium supplement.', 'Right Time', 'Levothyroxine goes on an empty stomach, 30 to 60 minutes before food, 4 hours away from calcium and iron.'],
    ['The 0900 antibiotic is given at 1130 because the unit was busy.', 'Right Time', 'Antibiotics are time-critical. The 30-minute window does not stretch.'],
    ['You calculate a weight-based pediatric dose using 33 lb instead of converting to kilograms.', 'Right Dose', 'kg = lb ÷ 2.2. Using pounds gives a dose 2.2 times too large.'],
    ['The order is written 5.0 mg and you draw up 50 mg.', 'Right Dose', 'A trailing zero causes tenfold errors. Never write 5.0 mg; write 5 mg.'],
    ['You prepare 6 tablets for one dose without questioning it.', 'Right Dose', 'Anything over 2 tablets or over 3 mL in one IM site should stop you and make you verify.'],
    ['You read 25 mg/mL as 2.5 mg/mL on the vial and give ten times the dose.', 'Right Dose', 'Read the concentration on the vial itself, not the box, and double check high-alert drugs with a second nurse.'],
    ['You chart the medication before you go into the room so you do not forget.', 'Right Documentation', 'Never chart before administering. If the dose is refused, the record is now false.'],
    ['The patient refuses the dose and you chart nothing.', 'Right Documentation', 'Document the refusal, the reason, and the provider notification.'],
    ['You omit the injection site from the MAR after an IM injection.', 'Right Documentation', 'Site matters for rotation and for tracing a reaction. It is part of the required entry.'],
    ['You sign the MAR for a dose your colleague administered.', 'Right Documentation', 'Only administer and only sign for medications YOU prepared and gave.'],
    ['You give a PRN analgesic and never reassess the pain score.', 'Right Documentation', 'Reassess and document the response — 15 to 30 minutes after IV, 30 to 60 after oral.']
  ];

  var CHECK_SNIPPETS = [
    ['You are standing at the Pyxis with the package in your hand, comparing it to the MAR.', 'First Check'],
    ['You confirm the drug form matches the ordered route as the medication leaves storage.', 'First Check'],
    ['You check the expiration date the moment the medication comes out of the drawer.', 'First Check'],
    ['You are at the counter, about to draw up the dose, verifying your calculation.', 'Second Check'],
    ['A second nurse independently verifies your insulin units before you cap the syringe.', 'Second Check'],
    ['You check the beyond-use date on the vial you just reconstituted.', 'Second Check'],
    ['The patient is in front of you and you state name, drug, dose, route and time out loud.', 'Third Check'],
    ['This is the last barrier before the dose becomes irreversible.', 'Third Check'],
    ['You verify the two identifiers and give the patient a chance to say "that is not my usual pill".', 'Third Check']
  ];

  var ID_SNIPPETS = [
    ['Full name stated by the patient', 'Acceptable'],
    ['Date of birth stated by the patient', 'Acceptable'],
    ['Medical record number on the armband', 'Acceptable'],
    ['Room number on the door', 'Never acceptable'],
    ['Bed number', 'Never acceptable'],
    ['The patient’s age', 'Never acceptable'],
    ['The admitting diagnosis', 'Never acceptable'],
    ['"Are you Mrs. Smith?" answered with a nod', 'Never acceptable']
  ];

  function buildDrillBank() {
    var bank = [];
    RIGHTS_SNIPPETS.forEach(function (r, i) {
      bank.push({ id: 'rs' + i, kind: 'Which right is violated?', q: r[0], options: RIGHTS, answer: r[1], why: r[2] });
    });
    (SKILLS().sixRights || []).forEach(function (r, i) {
      if (!r.commonError) return;
      bank.push({ id: 'sr' + i, kind: 'Which right is violated?', q: r.commonError, options: RIGHTS, answer: r.right, why: r.detail });
    });
    var checkNames = ['First Check', 'Second Check', 'Third Check'];
    CHECK_SNIPPETS.forEach(function (c, i) {
      bank.push({ id: 'cs' + i, kind: 'Which of the three checks is this?', q: c[0], options: checkNames, answer: c[1], why: '' });
    });
    (SKILLS().threeChecks || []).forEach(function (c, i) {
      /* data uses "Third Check (Bedside)" — normalise to the option labels */
      var ans = null;
      checkNames.forEach(function (n) { if (String(c.check || '').indexOf(n) === 0) ans = n; });
      if (!ans) return;
      bank.push({ id: 'tw' + i, kind: 'Which check happens here?', q: c.when, options: checkNames, answer: ans, why: c.what });
      if (c.what) bank.push({ id: 'tx' + i, kind: 'Which check is described?', q: c.what, options: checkNames, answer: ans, why: c.when });
    });
    ID_SNIPPETS.forEach(function (s, i) {
      bank.push({
        id: 'id' + i, kind: 'Acceptable patient identifier?', q: s[0],
        options: ['Acceptable', 'Never acceptable'], answer: s[1],
        why: s[1] === 'Acceptable' ? 'Name, date of birth and medical record number are the accepted identifiers.'
          : 'Room, bed, age, diagnosis and leading questions are never acceptable identifiers.'
      });
    });
    return bank;
  }

  function RightsDrill() {
    var bankRef = useRef(null);
    if (!bankRef.current) bankRef.current = buildDrillBank();

    var p0 = useState('idle'), phase = p0[0], setPhase = p0[1];   /* idle | play | over */
    var l0 = useState(60), limit = l0[0], setLimit = l0[1];
    var t0 = useState(60), left = t0[0], setLeft = t0[1];
    var q0 = useState([]), queue = q0[0], setQueue = q0[1];
    var i0 = useState(0), qi = i0[0], setQi = i0[1];
    var s0 = useState({ right: 0, wrong: 0, streak: 0, best: 0 }), sc = s0[0], setSc = s0[1];
    var a0 = useState(null), picked = a0[0], setPicked = a0[1];
    var m0 = useState([]), misses = m0[0], setMisses = m0[1];
    var timerRef = useRef(null);

    useEffect(function () {
      if (phase !== 'play') return;
      timerRef.current = setInterval(function () {
        setLeft(function (v) {
          if (v <= 1) { clearInterval(timerRef.current); setPhase('over'); return 0; }
          return v - 1;
        });
      }, 1000);
      return function () { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase]);

    useEffect(function () {
      if (phase !== 'over') return;
      var best = sc.best;
      updateProgress(function (p) {
        var np = shallow(p);
        var st = shallow(np.medAdminStats);
        st.drillBest = Math.max(st.drillBest || 0, sc.right);
        st.drillBestStreak = Math.max(st.drillBestStreak || 0, best);
        np.medAdminStats = st;
        return np;
      });
    }, [phase]);

    function start(sec) {
      setQueue(seededShuffle(bankRef.current, Math.floor(Math.random() * 1e9)));
      setQi(0); setSc({ right: 0, wrong: 0, streak: 0, best: 0 });
      setPicked(null); setMisses([]); setLimit(sec); setLeft(sec); setPhase('play');
    }

    function answer(q, choice) {
      if (picked) return;
      var ok = choice === q.answer;
      setPicked({ choice: choice, ok: ok });
      setSc(function (v) {
        var streak = ok ? v.streak + 1 : 0;
        return { right: v.right + (ok ? 1 : 0), wrong: v.wrong + (ok ? 0 : 1), streak: streak, best: Math.max(v.best, streak) };
      });
      if (!ok) setMisses(function (m) { return m.concat([{ q: q, choice: choice }]); });
      setTimeout(function () {
        setPicked(null);
        setQi(function (n) { return (n + 1) % queue.length; });
      }, ok ? 550 : 2200);
    }

    var stats = savedStats();

    if (phase === 'idle') {
      return ce('div', null,
        ce('div', { className: 'ma-card' },
          ce('div', { className: 'ma-card-t' }, 'Six Rights & Three Checks — rapid fire'),
          ce('div', { className: 'ma-muted' },
            'A scenario snippet appears. Name the right being violated, place the check, or judge the identifier. ' +
            'Fast, scored, streak-tracked. ' + bankRef.current.length + ' items in the bank.'),
          ce('div', { className: 'ma-big', style: { marginTop: 12 } },
            ce('div', { className: 'ma-stat' }, ce('b', null, String(stats.drillBest || 0)), ce('span', null, 'Best score')),
            ce('div', { className: 'ma-stat' }, ce('b', null, String(stats.drillBestStreak || 0)), ce('span', null, 'Best streak'))),
          ce('div', { className: 'ma-row', style: { marginTop: 14 } },
            ce('button', { className: 'ma-btn ma-btn-primary', onClick: function () { start(60); } }, '60 second sprint'),
            ce('button', { className: 'ma-btn', onClick: function () { start(120); } }, '2 minute run'),
            ce('button', { className: 'ma-btn ma-btn-ghost', onClick: function () { start(300); } }, '5 minute grind'))),
        ce('div', { className: 'ma-card' },
          ce('div', { className: 'ma-card-t' }, 'Reference — the three checks'),
          (SKILLS().threeChecks || []).map(function (c, i) {
            return ce('div', { key: i, style: { marginBottom: 10 } },
              ce('div', { style: { fontWeight: 700 } }, c.check),
              ce('div', { className: 'ma-muted' }, ce('b', null, 'When: '), c.when),
              ce('div', { className: 'ma-muted' }, ce('b', null, 'What: '), c.what));
          })),
        ce('div', { className: 'ma-card' },
          ce('div', { className: 'ma-card-t' }, 'Reference — the six rights'),
          (SKILLS().sixRights || []).map(function (r, i) {
            return ce('div', { key: i, style: { marginBottom: 10 } },
              ce('div', { style: { fontWeight: 700 } }, r.right),
              ce('div', { className: 'ma-muted' }, r.detail),
              ce('div', { className: 'ma-muted', style: { color: 'var(--orange)' } }, 'Common error: ' + r.commonError));
          }),
          ce('div', { className: 'ma-tiny', style: { marginTop: 12, marginBottom: 6 } }, 'Plus'),
          (SKILLS().additionalRights || []).map(function (r, i) {
            return ce('div', { key: i, className: 'ma-muted', style: { marginBottom: 5 } },
              ce('b', { style: { color: 'var(--text)' } }, r.right + ': '), r.detail);
          }))
      );
    }

    if (phase === 'over') {
      var acc = sc.right + sc.wrong ? Math.round(sc.right / (sc.right + sc.wrong) * 100) : 0;
      return ce('div', null,
        ce('div', { className: 'ma-card' },
          ce('div', { className: 'ma-card-t' }, 'Time'),
          ce('div', { className: 'ma-big' },
            ce('div', { className: 'ma-stat' }, ce('b', { style: { color: 'var(--green)' } }, String(sc.right)), ce('span', null, 'Correct')),
            ce('div', { className: 'ma-stat' }, ce('b', { style: { color: 'var(--red)' } }, String(sc.wrong)), ce('span', null, 'Wrong')),
            ce('div', { className: 'ma-stat' }, ce('b', null, acc + '%'), ce('span', null, 'Accuracy')),
            ce('div', { className: 'ma-stat' }, ce('b', { style: { color: 'var(--orange)' } }, String(sc.best)), ce('span', null, 'Best streak'))),
          ce('div', { className: 'ma-row', style: { marginTop: 14 } },
            ce('button', { className: 'ma-btn ma-btn-primary', onClick: function () { start(limit); } }, 'Go again'),
            ce('button', { className: 'ma-btn', onClick: function () { setPhase('idle'); } }, 'Back'))),
        misses.length ? ce('div', { className: 'ma-card' },
          ce('div', { className: 'ma-card-t' }, 'What you missed (' + misses.length + ')'),
          misses.map(function (m, i) {
            return ce('div', { key: i, className: 'ma-fb bad', style: { marginBottom: 8 } },
              ce('div', { className: 'ma-fb-t' }, m.q.kind),
              ce('div', null, m.q.q),
              ce('div', { style: { marginTop: 6 } },
                ce('b', { style: { color: 'var(--red)' } }, 'You said: '), m.choice, '  ',
                ce('b', { style: { color: 'var(--green)' } }, 'Answer: '), m.q.answer),
              m.q.why ? ce('div', { className: 'ma-teach' }, m.q.why) : null);
          })
        ) : ce('div', { className: 'ma-card' }, ce('div', { className: 'ma-muted' }, 'Clean run — nothing missed.'))
      );
    }

    var q = queue[qi];
    if (!q) return ce('div', { className: 'ma-card' }, 'Loading...');
    var low = left <= 10;

    return ce('div', { className: 'ma-drill' },
      ce('div', { className: 'ma-drill-top' },
        ce('div', { className: 'ma-drill-clock' + (low ? ' low' : '') }, fmtSec(left)),
        ce('div', { className: 'ma-row' },
          ce('span', { className: 'ma-sc' }, 'Score ', ce('b', null, String(sc.right))),
          sc.streak >= 3 ? ce('span', { className: 'ma-streak' }, sc.streak + ' in a row') : null,
          ce('button', { className: 'ma-btn ma-btn-ghost ma-btn-sm', onClick: function () { setPhase('over'); } }, 'End'))),
      ce('div', { className: 'ma-timerbar' },
        ce('div', { className: 'ma-timerfill' + (low ? ' low' : ''), style: { width: (left / limit * 100) + '%' } })),
      ce('div', { className: 'ma-tiny', style: { marginBottom: 6 } }, q.kind),
      ce('div', { className: 'ma-drill-q' }, q.q),
      ce('div', { className: 'ma-drill-opts' },
        q.options.map(function (o) {
          var cls = 'ma-btn';
          if (picked) {
            if (o === q.answer) cls += ' ma-btn-primary';
            else if (o === picked.choice) cls += ' ma-btn-danger';
          }
          return ce('button', {
            key: o, className: cls, disabled: !!picked,
            style: { padding: '13px 12px', fontSize: '0.88rem' },
            onClick: function () { answer(q, o); }
          }, o);
        })),
      picked ? ce('div', { className: 'ma-fb ' + (picked.ok ? 'good' : 'bad'), role: 'status' },
        ce('div', { className: 'ma-fb-t' }, picked.ok ? 'Correct' : 'Answer: ' + q.answer),
        q.why || '') : null
    );
  }

  /* ==========================================================================
   * 14. MODE 4 — INJECTION SKILLS + SITE SELECTOR
   * ======================================================================== */

  var SITE_INFO = {
    'deltoid': { name: 'Deltoid', route: 'IM' },
    'ventrogluteal': { name: 'Ventrogluteal', route: 'IM' },
    'vastus-lateralis': { name: 'Vastus lateralis', route: 'IM' },
    'dorsogluteal': { name: 'Dorsogluteal (upper outer buttock)', route: 'IM', banned: true, note: 'No longer recommended at any age — risk of sciatic nerve injury.' },
    'abdomen': { name: 'Abdomen', route: 'SubQ', note: 'Stay at least 1 inch (2 inches for enoxaparin) from the umbilicus. Fastest and most predictable insulin absorption.' },
    'upper-arm': { name: 'Posterior upper arm', route: 'SubQ', note: 'Acceptable subcutaneous site. Absorption is slower than the abdomen.' },
    'thigh': { name: 'Anterior thigh', route: 'SubQ', note: 'Acceptable subcutaneous site. Slower absorption than the abdomen or arm.' },
    'inner-forearm': { name: 'Inner forearm', route: 'ID', note: 'Intradermal site for TB and allergy testing. Bevel up, 5 to 15 degrees, form a wheal.' },
    'upper-back': { name: 'Upper back', route: 'ID', note: 'Alternative intradermal site.' }
  };

  var SITE_CHALLENGES = [
    {
      id: 'ch-enox', prompt: 'Enoxaparin 40 mg SubQ for a 70 kg adult. Where do you inject?',
      correct: ['abdomen'],
      why: 'Enoxaparin goes into the abdomen at least 2 inches from the umbilicus, into a pinched skin fold, at 45 to 90 degrees. Do NOT expel the air bubble from the prefilled syringe and do NOT massage afterwards — massaging causes hematoma.'
    },
    {
      id: 'ch-heparin', prompt: 'Heparin 5000 units SubQ every 8 hours for DVT prophylaxis in an adult. Preferred site?',
      correct: ['abdomen'],
      why: 'Abdomen, at least 1 inch from the umbilicus, rotating sites. Pinch, insert 45 to 90 degrees, do not aspirate, do not massage.'
    },
    {
      id: 'ch-ceftriaxone', prompt: 'Ceftriaxone 1 g IM — a 3 mL volume in an adult. Where do you inject?',
      correct: ['ventrogluteal'],
      why: 'Ventrogluteal is the safest adult IM site and the only common site that takes up to 3 mL. Large muscle mass, few major nerves or vessels, and it is preferred for viscous, irritating and larger-volume medications.'
    },
    {
      id: 'ch-infant', prompt: 'Hepatitis B vaccine 0.5 mL IM for a 6-month-old infant. Where do you inject?',
      correct: ['vastus-lateralis'],
      why: 'Vastus lateralis is the preferred IM site for infants and young children — the middle third of the anterior lateral thigh. Infants do not have enough deltoid muscle mass.'
    },
    {
      id: 'ch-flu', prompt: 'Influenza vaccine 0.5 mL IM for a healthy 30-year-old. Where do you inject?',
      correct: ['deltoid'],
      why: 'Deltoid, 1 to 2 inches (2 to 3 finger widths) below the acromion process, in line with the axilla. Small volumes of 1 mL or less only. Landmark it — failing to do so causes SIRVA or radial nerve injury.'
    },
    {
      id: 'ch-ppd', prompt: 'Tuberculin (PPD) 0.1 mL intradermal skin test. Where do you inject?',
      correct: ['inner-forearm', 'upper-back'],
      why: 'Inner forearm (or upper back), bevel up, 5 to 15 degrees, forming a 6 to 10 mm wheal. Do not massage. Read at 48 to 72 hours by measuring INDURATION, not redness.'
    },
    {
      id: 'ch-ztrack', prompt: 'Iron dextran IM using Z-track technique in an adult. Where do you inject?',
      correct: ['ventrogluteal'],
      why: 'Ventrogluteal with Z-track: pull the skin laterally before insertion, inject, wait 10 seconds, withdraw and release. Z-track prevents the irritating, staining drug from tracking back into subcutaneous tissue.'
    },
    {
      id: 'ch-lispro', prompt: 'Insulin lispro SubQ 15 minutes before a meal — you want the fastest, most predictable absorption. Where?',
      correct: ['abdomen'],
      why: 'Insulin absorbs fastest from the abdomen, then the arm, then the thigh, then the buttock. Rotate within the abdomen rather than between regions so absorption stays consistent.'
    },
    {
      id: 'ch-cachexia', prompt: 'A 2 mL IM analgesic for a cachectic adult with very little muscle mass. Where do you inject?',
      correct: ['ventrogluteal'],
      why: 'Ventrogluteal still holds the most muscle and stays away from major nerves and vessels. The deltoid takes 1 mL or less and this patient has almost no deltoid mass.'
    }
  ];

  function BodyDiagram(props) {
    var picked = props.picked, correct = props.correct || [];
    function hot(id, el) {
      var cls = 'ma-hot';
      if (picked) {
        if (correct.indexOf(id) !== -1) cls += ' ok';
        else if (picked === id) cls += ' no';
      }
      var common = {
        className: cls, tabIndex: 0, role: 'button',
        'aria-label': (SITE_INFO[id] || {}).name || id,
        onClick: function () { if (!picked && props.onPick) props.onPick(id); },
        onKeyDown: function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && !picked && props.onPick) { e.preventDefault(); props.onPick(id); }
        }
      };
      var attrs = shallow(el);
      var tag = attrs._tag; delete attrs._tag;
      for (var k in common) { if (Object.prototype.hasOwnProperty.call(common, k)) attrs[k] = common[k]; }
      return ce(tag, attrs);
    }
    function ell(id, cx, cy, rx, ry) {
      var o = { _tag: 'ellipse', cx: cx, cy: cy, rx: rx, ry: ry, key: id };
      return hot(id, o);
    }

    return ce('svg', {
      className: 'ma-bodysvg', viewBox: '0 0 200 420', xmlns: 'http://www.w3.org/2000/svg',
      role: 'group', 'aria-label': 'Anterior body diagram with selectable injection sites'
    },
      /* body */
      ce('g', { fill: 'var(--surface2)', stroke: 'var(--text3)', strokeWidth: 1 },
        ce('circle', { cx: 100, cy: 30, r: 20 }),
        ce('rect', { x: 92, y: 47, width: 16, height: 14 }),
        ce('rect', { x: 68, y: 58, width: 64, height: 112, rx: 14 }),
        ce('rect', { x: 70, y: 162, width: 60, height: 42, rx: 12 }),
        ce('rect', { x: 44, y: 64, width: 21, height: 112, rx: 10 }),
        ce('rect', { x: 135, y: 64, width: 21, height: 112, rx: 10 }),
        ce('rect', { x: 73, y: 198, width: 25, height: 152, rx: 12 }),
        ce('rect', { x: 102, y: 198, width: 25, height: 152, rx: 12 })
      ),
      /* umbilicus + exclusion zone */
      ce('circle', { cx: 100, cy: 140, r: 13, fill: 'none', stroke: 'var(--red)', strokeWidth: 1, strokeDasharray: '3 3' }),
      ce('circle', { cx: 100, cy: 140, r: 2.5, fill: 'var(--red)' }),
      /* hotspots */
      ell('deltoid', 54, 80, 11, 13),
      ell('deltoid-r', 146, 80, 11, 13),
      ell('upper-arm', 52, 118, 9, 15),
      ell('abdomen', 82, 140, 12, 16),
      ell('abdomen-r', 118, 140, 12, 16),
      ell('inner-forearm', 148, 152, 8, 17),
      ell('ventrogluteal', 76, 180, 12, 11),
      ell('ventrogluteal-r', 124, 180, 12, 11),
      ell('vastus-lateralis', 81, 255, 10, 24),
      ell('vastus-lateralis-r', 119, 255, 10, 24),
      ell('thigh', 96, 300, 9, 20),
      /* labels */
      ce('g', { fill: 'var(--text3)', fontSize: 7, textAnchor: 'middle' },
        ce('text', { x: 30, y: 82 }, 'deltoid'),
        ce('text', { x: 168, y: 156 }, 'forearm'),
        ce('text', { x: 100, y: 128, fill: 'var(--red)' }, 'umbilicus'),
        ce('text', { x: 36, y: 184 }, 'ventrogluteal'),
        ce('text', { x: 33, y: 258 }, 'vastus lat.'),
        ce('text', { x: 100, y: 372 }, 'anterior view')
      )
    );
  }

  function normSite(id) { return String(id).replace(/-r$/, ''); }

  function SiteSelector() {
    var i0 = useState(0), idx = i0[0], setIdx = i0[1];
    var p0 = useState(null), picked = p0[0], setPicked = p0[1];
    var s0 = useState({ right: 0, total: 0 }), sc = s0[0], setSc = s0[1];
    var ch = SITE_CHALLENGES[idx % SITE_CHALLENGES.length];
    var ok = picked ? ch.correct.indexOf(normSite(picked)) !== -1 : false;

    function choose(id) {
      if (picked) return;
      setPicked(id);
      setSc({ right: sc.right + (ch.correct.indexOf(normSite(id)) !== -1 ? 1 : 0), total: sc.total + 1 });
    }

    return ce('div', { className: 'ma-card' },
      ce('div', { className: 'ma-card-t' }, 'Injection site selector',
        ce('span', { className: 'ma-tag' }, sc.right + ' / ' + sc.total + ' correct')),
      ce('div', { className: 'ma-drill-q', style: { borderLeftColor: 'var(--accent)' } }, ch.prompt),
      ce('div', { className: 'ma-bodywrap' },
        ce(BodyDiagram, {
          picked: picked,
          correct: ch.correct.concat(ch.correct.map(function (c) { return c + '-r'; })),
          onPick: choose
        }),
        ce('div', { className: 'ma-bodyside' },
          ce('div', { className: 'ma-muted', style: { marginBottom: 8 } },
            'Tap the correct site on the diagram. Sites shown from the front — the posterior options are below.'),
          ce('div', { className: 'ma-row', style: { marginBottom: 10 } },
            ce('button', {
              className: 'ma-btn ma-btn-sm', disabled: !!picked,
              onClick: function () { choose('dorsogluteal'); }
            }, 'Dorsogluteal (posterior)'),
            ce('button', {
              className: 'ma-btn ma-btn-sm', disabled: !!picked,
              onClick: function () { choose('upper-back'); }
            }, 'Upper back (posterior)')),
          picked ? ce('div', { className: 'ma-fb ' + (ok ? 'good' : 'bad'), role: 'status' },
            ce('div', { className: 'ma-fb-t' },
              ok ? 'Correct — ' + (SITE_INFO[normSite(picked)] || {}).name
                : 'Not this site — you chose ' + ((SITE_INFO[normSite(picked)] || {}).name || picked)),
            !ok && (SITE_INFO[normSite(picked)] || {}).note ? ce('div', { style: { marginBottom: 6 } }, SITE_INFO[normSite(picked)].note) : null,
            !ok && (SITE_INFO[normSite(picked)] || {}).banned
              ? ce('div', { style: { marginBottom: 6, color: 'var(--red)', fontWeight: 700 } }, 'The dorsogluteal site is no longer recommended at any age.') : null,
            ce('div', null, ce('b', null, 'Correct: '),
              ch.correct.map(function (c) { return (SITE_INFO[c] || {}).name || c; }).join(' or ')),
            ce('div', { className: 'ma-teach' }, ch.why)
          ) : null,
          picked ? ce('button', {
            className: 'ma-btn ma-btn-primary', style: { marginTop: 10 },
            onClick: function () { setPicked(null); setIdx(idx + 1); }
          }, 'Next site →') : null
        ))
    );
  }

  function InjectionSkills() {
    var routes = SKILLS().routes || [];
    var r0 = useState(routes.length ? routes[0].id : ''), rid = r0[0], setRid = r0[1];
    var r = null;
    routes.forEach(function (x) { if (x.id === rid) r = x; });

    return ce('div', null,
      ce(SiteSelector, null),
      ce('div', { className: 'ma-tabs' },
        routes.map(function (x) {
          return ce('button', {
            key: x.id, className: 'ma-tab' + (x.id === rid ? ' on' : ''),
            onClick: function () { setRid(x.id); }
          }, x.name);
        })),
      r ? ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, r.name,
          ce('span', { className: 'ma-tag blue' }, (r.commonMeds || []).slice(0, 3).join(', '))),
        ce('div', { className: 'ma-panels', style: { borderRadius: 9, overflow: 'hidden', marginBottom: 12 } },
          ce('div', { className: 'ma-panel' },
            ce('h4', null, 'Equipment'),
            ce('div', { className: 'ma-kv' }, ce('span', null, 'Gauge'), ce('b', null, r.needleGauge)),
            ce('div', { className: 'ma-kv' }, ce('span', null, 'Length'), ce('b', null, r.needleLength))),
          ce('div', { className: 'ma-panel' },
            ce('h4', null, 'Technique'),
            ce('div', { className: 'ma-kv' }, ce('span', null, 'Angle'), ce('b', null, r.angle)),
            ce('div', { className: 'ma-kv' }, ce('span', null, 'Volume'), ce('b', null, r.volumeLimit))),
          ce('div', { className: 'ma-panel' },
            ce('h4', null, 'Sites'),
            ce('ul', { className: 'ma-ul', style: { paddingLeft: 16 } },
              (r.sites || []).map(function (s, i) { return ce('li', { key: i }, s); })))),
        (r.siteDetails || []).length ? ce('div', { style: { marginBottom: 12 } },
          ce('div', { className: 'ma-tiny', style: { marginBottom: 6 } }, 'Landmarks'),
          r.siteDetails.map(function (s) {
            return ce('div', { key: s.id, className: 'ma-fb', style: { marginBottom: 8 } },
              ce('div', { className: 'ma-fb-t' }, s.name),
              ce('div', null, s.landmark),
              ce('ul', { className: 'ma-ul' }, (s.notes || []).map(function (n, i) { return ce('li', { key: i }, n); })));
          })) : null,
        ce('div', { className: 'ma-dsec' },
          ce('h5', null, 'Guidelines'),
          ce('ul', { className: 'ma-ul' }, (r.guidelines || []).map(function (g, i) { return ce('li', { key: i }, g); }))),
        ce('div', { className: 'ma-fb bad' },
          ce('div', { className: 'ma-fb-t' }, 'Classic pitfalls — these are what fail students'),
          ce('ul', { className: 'ma-ul' }, (r.pitfalls || []).map(function (g, i) { return ce('li', { key: i }, g); }))),
        ce(AskInstructor, {
          context: 'Route reference: ' + r.name + ' — gauge ' + r.needleGauge + ', length ' + r.needleLength + ', angle ' + r.angle,
          suggestions: ['Do I aspirate for this route?', 'How do I landmark this site?']
        })
      ) : null,
      ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'High-alert practice'),
        ce('ul', { className: 'ma-ul' }, (SKILLS().highAlertPractices || []).map(function (g, i) { return ce('li', { key: i }, g); }))),
      ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'General principles of medication administration'),
        ce('ul', { className: 'ma-ul' }, (SKILLS().generalPrinciples || []).map(function (g, i) { return ce('li', { key: i }, g); })))
    );
  }

  /* ==========================================================================
   * 15. MODE 5 — DRUG REFERENCE & QUIZ
   * ======================================================================== */

  function classBucket(d) {
    var c = normalize(d.classification);
    if (/insulin/.test(c)) return 'Insulin';
    if (/antibiotic|cephalosporin|macrolide|glycopeptide|antifungal|beta-lactam/.test(c)) return 'Anti-infective';
    if (/anticoagulant|antiplatelet|vitamin k antagonist|thrombin/.test(c)) return 'Anticoagulant / antiplatelet';
    if (/opioid|analgesic/.test(c)) return 'Analgesic / opioid';
    if (/diuretic/.test(c)) return 'Diuretic';
    if (/glycoside|antiarrhythmic|calcium channel|vasodilator|adrenergic|antihypertensive/.test(c)) return 'Cardiovascular';
    if (/laxative|stool softener|antidiarrheal|cation exchange|ammonia/.test(c)) return 'GI';
    if (/electrolyte|potassium/.test(c)) return 'Electrolyte';
    if (/benzodiazepine|sedative|antipsychotic|anticonvulsant|hydantoin|hypnotic/.test(c)) return 'Neuro / psych';
    if (/corticosteroid|thyroid|biguanide|hormone|uterotonic|antidiabetic|antihypoglycemic/.test(c)) return 'Endocrine / hormone';
    return 'Other';
  }

  function DrugDetail(props) {
    var d = props.drug;
    return ce('div', { className: 'ma-detail' },
      ce('div', { className: 'ma-dsec' }, ce('h5', null, 'Use'), ce('p', null, d.use)),
      ce('div', { className: 'ma-dsec' }, ce('h5', null, 'Nursing considerations'),
        ce('ul', { className: 'ma-ul' }, (d.nursingConsiderations || []).map(function (x, i) { return ce('li', { key: i }, x); }))),
      ce('div', { className: 'ma-dsec' }, ce('h5', null, 'Monitoring'),
        ce('ul', { className: 'ma-ul' }, (d.monitoring || []).map(function (x, i) { return ce('li', { key: i }, x); }))),
      ce('div', { className: 'ma-dsec' }, ce('h5', null, 'Side effects'),
        ce('ul', { className: 'ma-ul' }, (d.sideEffects || []).map(function (x, i) { return ce('li', { key: i }, x); }))),
      ce('div', { className: 'ma-fb bad', style: { marginBottom: 10 } },
        ce('div', { className: 'ma-fb-t' }, 'Hold parameters'), d.holdParameters),
      ce('div', { className: 'ma-dsec' }, ce('h5', null, 'Antidote / reversal'), ce('p', null, d.antidote)),
      d.atiPearl ? ce('div', { className: 'ma-pearl' }, ce('b', null, 'Pearl: '), d.atiPearl) : null,
      ce(AskInstructor, {
        context: 'Drug: ' + d.generic + ' (' + (d.brand || []).join(', ') + ')\nClass: ' + d.classification +
          '\nHold: ' + d.holdParameters + '\nAntidote: ' + d.antidote,
        suggestions: ['When would I hold this?', 'What do I teach the patient about this drug?']
      })
    );
  }

  var GIVE_HOLD = [
    ['Digoxin 0.25 mg PO is due. You auscultate an apical pulse of 52, regular.', 'Hold', 'Hold for an apical pulse under 60. Notify the provider, check the potassium and the digoxin level, and document the hold.'],
    ['Warfarin 5 mg PO is due. INR is 6.8 and the patient reports black tarry stools.', 'Hold', 'Supratherapeutic INR with active bleeding. Hold, notify immediately, anticipate vitamin K, type and screen, serial hemoglobin, and bleeding precautions.'],
    ['Heparin 5000 units SubQ is due. Platelets have fallen from 210 to 82 K/uL over four days.', 'Hold', 'Suspected heparin-induced thrombocytopenia. Hold ALL heparin including flushes, notify, anticipate HIT antibody testing and a non-heparin anticoagulant such as argatroban.'],
    ['Insulin lispro 12 units SubQ is due at 0730. The breakfast tray has not arrived and is due around 0800.', 'Hold', 'No tray, no rapid-acting insulin. Lispro works in 15 minutes; giving it now drives hypoglycemia before the first bite.'],
    ['Metformin 1000 mg PO is due. The patient has a contrast-enhanced CT scheduled at 1100.', 'Hold', 'Hold metformin before and for 48 hours after iodinated contrast, and only resume after renal function is rechecked.'],
    ['Potassium chloride 40 mEq PO is due. K+ is 3.4 mEq/L and urine output has been 60 mL/hr.', 'Give', 'Urine output is adequate and the potassium is low. Give whole, with food and a full glass of water. Never crush an extended-release potassium tablet.'],
    ['Vancomycin 1.25 g IV is due. The trough came back at 24 mcg/mL, creatinine is rising and urine output is 25 mL/hr.', 'Hold', 'Supratherapeutic trough plus falling renal function plus oliguria. Hold, notify with the numbers, anticipate a dose or interval change.'],
    ['Amoxicillin-clavulanate suspension is due for a child with pneumonia. No known drug allergies, WBC 18.2 K/uL.', 'Give', 'Indicated and no allergy. Shake well, check the beyond-use date, give with food, measure with a calibrated oral syringe.'],
    ['Hydralazine 10 mg IV PRN for hypertension is due. Blood pressure is 138/74.', 'Hold', 'The hold parameter (SBP under 110) is not met, but there is no PRN indication — 138/74 is not hypertension. A hold parameter and an indication are two separate gates.'],
    ['Zolpidem 10 mg PO at bedtime for an 84-year-old who nearly fell going to the bathroom last night.', 'Hold', 'Beers criteria: the recommended maximum in an older adult is 5 mg, and any Z-drug raises fall and delirium risk. Clarify or discontinue and use nonpharmacologic sleep measures.'],
    ['Furosemide 40 mg IV is due. K+ is 3.1 mEq/L and the patient is also on digoxin.', 'Hold', 'Report first. Hypokalemia potentiates digoxin toxicity, and a loop diuretic will drop the potassium further. Anticipate replacement before the diuretic.'],
    ['Ondansetron 2 mg IV for a 15 kg child with nausea. Pediatric range is 0.1 to 0.15 mg/kg per dose.', 'Give', '15 kg x 0.1 = 1.5 mg and x 0.15 = 2.25 mg, so 2 mg is inside the safe range. Push slowly over 2 to 5 minutes.'],
    ['Morphine 2 mg IV Q4h PRN ordered for a 15 kg four-year-old with severe pain.', 'Hold', 'Pediatric safe range is 0.05 to 0.1 mg/kg, which is 0.75 to 1.5 mg. The ordered 2 mg exceeds the maximum. Hold and clarify with the provider, stating the calculated range.'],
    ['Ceftriaxone 1 g IV piggyback ordered into the only lumen, which is running lactated Ringer.', 'Hold', 'Ceftriaxone and calcium-containing solutions (including lactated Ringer) precipitate. Use a separate lumen, or stop the LR and flush thoroughly with normal saline first.'],
    ['Enoxaparin 40 mg SubQ prophylaxis is due. Platelets normal, no bleeding, creatinine 0.9 mg/dL.', 'Give', 'Indicated and no contraindication. Abdomen 2 inches from the umbilicus, do not expel the air bubble, do not massage.'],
    ['Prednisone 5 mg PO is due for a diabetic patient. Blood glucose 160 mg/dL, temperature 101.6 F.', 'Give', 'Give with food, but report the fever — steroids blunt the febrile response and mask infection — and monitor the glucose closely because steroids cause hyperglycemia.'],
    ['Metoprolol 25 mg PO is due. Heart rate 48, blood pressure 92/54.', 'Hold', 'Bradycardia plus hypotension. Hold, notify the provider, and document the vital signs that supported the hold.'],
    ['Dilaudid 1 mg IV PRN is due for pain 7/10. The allergy band reads "hydromorphone".', 'Hold', 'Dilaudid IS hydromorphone. Absolute contraindication. Hold, notify the provider, request a non-hydromorphone alternative, and document.']
  ];

  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function buildDrugQuestions(n) {
    var drugs = DRUGS();
    if (!drugs.length) return [];
    var high = drugs.filter(function (d) { return d.highAlert; });
    var rest = drugs.filter(function (d) { return !d.highAlert; });
    var out = [];
    var fields = [
      { key: 'classification', label: 'What is the classification of', trunc: 90 },
      { key: 'holdParameters', label: 'What is the hold parameter for', trunc: 150 },
      { key: 'antidote', label: 'What is the antidote or reversal for', trunc: 130 }
    ];

    var i, guard = 0;
    while (out.length < n && guard++ < n * 12) {
      var useGiveHold = out.length % 3 === 2;
      if (useGiveHold) {
        var g = pick(GIVE_HOLD);
        if (out.some(function (q) { return q.id === 'gh-' + g[0].slice(0, 18); })) continue;
        out.push({
          id: 'gh-' + g[0].slice(0, 18), kind: 'Give or hold?', q: g[0],
          options: ['Give the dose', 'Hold and notify the provider'],
          answer: g[1] === 'Give' ? 'Give the dose' : 'Hold and notify the provider',
          why: g[2], highAlert: true
        });
        continue;
      }
      var d = (Math.random() < 0.62 && high.length) ? pick(high) : pick(rest.length ? rest : high);
      var f = pick(fields);
      var correct = truncate(d[f.key], f.trunc);
      if (!correct) continue;
      var pool = [], seen = {};
      seen[normalize(correct)] = 1;
      for (i = 0; i < drugs.length && pool.length < 3; i++) {
        var alt = truncate(drugs[(i * 7 + Math.floor(Math.random() * drugs.length)) % drugs.length][f.key], f.trunc);
        if (!alt || seen[normalize(alt)]) continue;
        seen[normalize(alt)] = 1; pool.push(alt);
      }
      if (pool.length < 3) continue;
      var qid = 'dq-' + d.id + '-' + f.key;
      if (out.some(function (q) { return q.id === qid; })) continue;
      out.push({
        id: qid, kind: (d.highAlert ? 'HIGH ALERT · ' : '') + 'Drug facts',
        q: f.label + ' ' + d.generic + (d.brand && d.brand.length ? ' (' + d.brand[0] + ')' : '') + '?',
        options: seededShuffle(pool.concat([correct]), hashStr(qid)),
        answer: correct, why: d.atiPearl || '', drugId: d.id, highAlert: !!d.highAlert
      });
    }
    return out;
  }

  function DrugQuiz(props) {
    var q0 = useState(function () { return buildDrugQuestions(12); }), qs = q0[0], setQs = q0[1];
    var i0 = useState(0), idx = i0[0], setIdx = i0[1];
    var p0 = useState(null), picked = p0[0], setPicked = p0[1];
    var s0 = useState({ right: 0, wrong: 0 }), sc = s0[0], setSc = s0[1];
    var m0 = useState([]), misses = m0[0], setMisses = m0[1];

    var q = qs[idx];
    if (!q) {
      var acc = sc.right + sc.wrong ? Math.round(sc.right / (sc.right + sc.wrong) * 100) : 0;
      return ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Quiz complete'),
        ce('div', { className: 'ma-big' },
          ce('div', { className: 'ma-stat' }, ce('b', { style: { color: 'var(--green)' } }, String(sc.right)), ce('span', null, 'Correct')),
          ce('div', { className: 'ma-stat' }, ce('b', { style: { color: 'var(--red)' } }, String(sc.wrong)), ce('span', null, 'Wrong')),
          ce('div', { className: 'ma-stat' }, ce('b', null, acc + '%'), ce('span', null, 'Accuracy'))),
        misses.length ? ce('div', { style: { marginTop: 14 } },
          ce('div', { className: 'ma-tiny', style: { marginBottom: 6 } }, 'Review'),
          misses.map(function (m, i) {
            return ce('div', { key: i, className: 'ma-fb bad', style: { marginBottom: 8 } },
              ce('div', { className: 'ma-fb-t' }, m.q.kind),
              ce('div', null, m.q.q),
              ce('div', { style: { marginTop: 6 } }, ce('b', { style: { color: 'var(--green)' } }, 'Answer: '), m.q.answer),
              m.q.why ? ce('div', { className: 'ma-teach' }, m.q.why) : null);
          })) : null,
        ce('div', { className: 'ma-row', style: { marginTop: 14 } },
          ce('button', {
            className: 'ma-btn ma-btn-primary',
            onClick: function () { setQs(buildDrugQuestions(12)); setIdx(0); setPicked(null); setSc({ right: 0, wrong: 0 }); setMisses([]); }
          }, 'New quiz'),
          ce('button', { className: 'ma-btn', onClick: props.onExit }, 'Back to the drug list')));
    }

    function answer(o) {
      if (picked) return;
      var ok = o === q.answer;
      setPicked(o);
      setSc({ right: sc.right + (ok ? 1 : 0), wrong: sc.wrong + (ok ? 0 : 1) });
      if (!ok) setMisses(misses.concat([{ q: q }]));
    }

    return ce('div', { className: 'ma-drill' },
      ce('div', { className: 'ma-drill-top' },
        ce('span', { className: 'ma-tiny' }, 'Question ' + (idx + 1) + ' of ' + qs.length),
        ce('div', { className: 'ma-row' },
          ce('span', { className: 'ma-sc' }, 'Correct ', ce('b', null, String(sc.right))),
          ce('button', { className: 'ma-btn ma-btn-ghost ma-btn-sm', onClick: props.onExit }, 'Exit'))),
      ce('div', { className: 'ma-tiny', style: { marginBottom: 6, color: q.highAlert ? 'var(--red)' : 'var(--text3)' } }, q.kind),
      ce('div', { className: 'ma-drill-q' }, q.q),
      ce('div', { className: 'ma-opts' },
        q.options.map(function (o, i) {
          var cls = 'ma-opt';
          if (picked) {
            if (o === q.answer) cls += ' good';
            else if (o === picked) cls += ' bad';
            else cls += ' dim';
          }
          return ce('button', { key: i, type: 'button', className: cls, disabled: !!picked, onClick: function () { answer(o); } },
            ce('span', { className: 'ma-opt-mark', 'aria-hidden': 'true' },
              picked ? (o === q.answer ? '✓' : (o === picked ? '✕' : '')) : ''),
            ce('span', null, o));
        })),
      picked ? ce('div', null,
        ce('div', { className: 'ma-fb ' + (picked === q.answer ? 'good' : 'bad'), role: 'status' },
          ce('div', { className: 'ma-fb-t' }, picked === q.answer ? 'Correct' : 'Incorrect'),
          picked === q.answer ? null : ce('div', null, ce('b', null, 'Answer: '), q.answer),
          q.why ? ce('div', { className: 'ma-teach' }, q.why) : null),
        ce('button', {
          className: 'ma-btn ma-btn-primary', style: { marginTop: 12 },
          onClick: function () { setPicked(null); setIdx(idx + 1); }
        }, idx + 1 >= qs.length ? 'See results' : 'Next question →')) : null
    );
  }

  function DrugReference() {
    var q0 = useState(''), query = q0[0], setQuery = q0[1];
    var b0 = useState('All'), bucket = b0[0], setBucket = b0[1];
    var h0 = useState(false), onlyHigh = h0[0], setOnlyHigh = h0[1];
    var o0 = useState(null), openId = o0[0], setOpenId = o0[1];
    var m0 = useState('list'), sub = m0[0], setSub = m0[1];

    var drugs = DRUGS();
    var buckets = useMemo(function () {
      var seen = {}, out = ['All'];
      drugs.forEach(function (d) { var b = classBucket(d); if (!seen[b]) { seen[b] = 1; out.push(b); } });
      return out;
    }, [drugs.length]);

    var qn = normalize(query).trim();
    var filtered = drugs.filter(function (d) {
      if (onlyHigh && !d.highAlert) return false;
      if (bucket !== 'All' && classBucket(d) !== bucket) return false;
      if (!qn) return true;
      var hay = normalize(d.generic + ' ' + (d.brand || []).join(' ') + ' ' + d.classification + ' ' + d.use);
      return hay.indexOf(qn) !== -1;
    });

    if (sub === 'quiz') {
      return ce(DrugQuiz, { onExit: function () { setSub('list'); } });
    }

    var stats = savedStats().drugs || {};

    return ce('div', null,
      ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Drug reference',
          ce('span', { className: 'ma-tag' }, drugs.length + ' drugs'),
          ce('span', { className: 'ma-tag red' }, drugs.filter(function (d) { return d.highAlert; }).length + ' high alert')),
        ce('input', {
          className: 'ma-input', type: 'search', value: query, 'aria-label': 'Search drugs',
          placeholder: 'Search generic, brand, class or use…',
          onChange: function (e) { setQuery(e.target.value); }
        }),
        ce('div', { className: 'ma-tabs', style: { marginTop: 10, marginBottom: 0 } },
          buckets.map(function (b) {
            return ce('button', {
              key: b, className: 'ma-tab' + (b === bucket ? ' on' : ''),
              onClick: function () { setBucket(b); }
            }, b);
          }),
          ce('button', {
            className: 'ma-tab' + (onlyHigh ? ' on' : ''), 'aria-pressed': onlyHigh ? 'true' : 'false',
            style: onlyHigh ? { background: 'var(--red)', borderColor: 'var(--red)' } : null,
            onClick: function () { setOnlyHigh(!onlyHigh); }
          }, 'High alert only')),
        ce('div', { className: 'ma-row', style: { marginTop: 12 } },
          ce('button', { className: 'ma-btn ma-btn-primary', onClick: function () { setSub('quiz'); } }, 'Start drug quiz'),
          ce('span', { className: 'ma-muted' }, filtered.length + ' shown'))),

      filtered.length === 0 ? ce('div', { className: 'ma-card' }, ce('div', { className: 'ma-muted' }, 'No drugs match that filter.')) : null,

      filtered.map(function (d) {
        var open = openId === d.id;
        var mast = stats[d.generic] || stats[d.id];
        return ce('div', { key: d.id },
          ce('button', {
            type: 'button', className: 'ma-drugrow', 'aria-expanded': open ? 'true' : 'false',
            onClick: function () { setOpenId(open ? null : d.id); }
          },
            ce('div', { className: 'ma-drugrow-h' },
              ce('div', null,
                ce('div', { className: 'ma-drugname' }, d.generic,
                  (d.brand || []).length ? ce('span', { className: 'ma-drugbrand' }, '  ' + d.brand.join(', ')) : null),
                ce('div', { className: 'ma-drugclass' }, d.classification)),
              ce('div', { className: 'ma-row' },
                d.highAlert ? ce('span', { className: 'ma-tag red' }, 'High alert') : null,
                ce('span', { className: 'ma-tag' }, classBucket(d)),
                mast ? ce('span', { className: 'ma-tag green' }, 'Practised ' + mast.n + '×') : null,
                ce('span', { className: 'ma-go' }, open ? '▲' : '▼'))),
            open ? ce(DrugDetail, { drug: d }) : null));
      })
    );
  }

  /* ==========================================================================
   * 16. MODE 6 — SIGNOFF READINESS CHECK (mock checkoff)
   * ======================================================================== */

  function chooseMockMeds(caseObj, count) {
    var meds = (caseObj.medications || []).slice();
    var risky = meds.filter(function (m) { return m.correctAction !== 'give'; });
    var safe = meds.filter(function (m) { return m.correctAction === 'give'; });
    var out = [];
    if (risky.length) out.push(pick(risky));
    while (out.length < count) {
      var poolAll = safe.concat(risky).filter(function (m) { return out.indexOf(m) === -1; });
      if (!poolAll.length) break;
      out.push(pick(poolAll));
    }
    return out;
  }

  function ReadinessCheck() {
    var LIMIT = 900; /* 15 minutes */
    var p0 = useState('idle'), phase = p0[0], setPhase = p0[1];
    var c0 = useState(null), caseObj = c0[0], setCaseObj = c0[1];
    var q0 = useState([]), queue = q0[0], setQueue = q0[1];
    var i0 = useState(0), qi = i0[0], setQi = i0[1];
    var r0 = useState([]), results = r0[0], setResults = r0[1];
    var t0 = useState(LIMIT), left = t0[0], setLeft = t0[1];
    var pd0 = useState(null), pending = pd0[0], setPending = pd0[1];
    var timerRef = useRef(null);
    var startedRef = useRef(0);

    useEffect(function () {
      if (phase !== 'run') return;
      timerRef.current = setInterval(function () {
        setLeft(function (v) { return v - 1; });
      }, 1000);
      return function () { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase]);

    function start(forcedCaseId) {
      var cs = CASES();
      if (!cs.length) return;
      var c = forcedCaseId ? cs.filter(function (x) { return x.id === forcedCaseId; })[0] : pick(cs);
      var meds = chooseMockMeds(c, 2);
      setCaseObj(c); setQueue(meds); setQi(0); setResults([]); setPending(null);
      setLeft(LIMIT); startedRef.current = Date.now(); setPhase('run');
    }

    /* A medication is finished (passed, failed, or stopped by a critical error).
       Hold here so the student actually READS the debrief before moving on. */
    function onMedDone(r) { setPending(r); }

    function continueMock() {
      var all = results.concat([pending]);
      setResults(all); setPending(null);
      if (qi + 1 >= queue.length) { finishMock(all); }
      else { setQi(qi + 1); }
    }

    function finishMock(all) {
      if (timerRef.current) clearInterval(timerRef.current);
      var items = allRubricItems();
      var minScores = {}, crit = [];
      items.forEach(function (it) {
        var m = null;
        all.forEach(function (r) {
          var s = (r.rubricScores && typeof r.rubricScores[it.id] === 'number') ? r.rubricScores[it.id] : 0;
          m = (m === null) ? s : Math.min(m, s);
        });
        minScores[it.id] = (m === null) ? 0 : m;
      });
      all.forEach(function (r) { crit = crit.concat(r.criticalDetail || []); });
      var grade = gradeRun(minScores, crit);
      var elapsed = Math.round((Date.now() - startedRef.current) / 1000);
      var payload = {
        caseId: caseObj.id, date: new Date().toISOString(), mode: 'mock',
        score: grade.total, maxScore: grade.max, pct: grade.pct,
        criticalErrors: crit.map(function (c) { return c.code; }),
        criticalDetail: crit, passed: grade.passed && elapsed <= LIMIT,
        overtime: elapsed > LIMIT, timeSec: elapsed,
        rubricScores: minScores,
        drugs: all.map(function (r) { return r.medName; }),
        medIds: all.map(function (r) { return r.medId; }),
        perMed: all.map(function (r) { return { name: r.medName, score: r.score, pct: r.pct, passed: r.passed }; })
      };
      saveResult(payload);
      setResults(all.concat([{ __summary: payload }]));
      setPhase('done');
      toast(payload.passed ? 'Mock checkoff PASSED' : 'Mock checkoff FAILED — read the breakdown', payload.passed ? 'success' : 'error');
    }

    var history = savedResults().filter(function (r) { return r.mode === 'mock'; });

    if (phase === 'idle') {
      var lastFive = history.slice(-8);
      return ce('div', null,
        ce('div', { className: 'ma-card' },
          ce('div', { className: 'ma-card-t' }, 'Signoff readiness check'),
          ce('div', { className: 'ma-muted' },
            'A random chart, two medications, ' + (LIMIT / 60) + ' minutes, graded strictly on the real rubric. ' +
            'You must demonstrate every competency on EVERY medication — the score for each item is the lowest you achieved on ' +
            'either drug, which is exactly how an evaluator watching two passes would score you. ' +
            'One critical error ends it as a fail, the same as the real thing.'),
          ce('div', { className: 'ma-row', style: { marginTop: 14 } },
            ce('button', { className: 'ma-btn ma-btn-primary', onClick: function () { start(null); } }, 'Begin mock checkoff'),
            ce('span', { className: 'ma-muted' }, 'Attempts logged: ' + history.length))),

        history.length ? ce('div', { className: 'ma-card' },
          ce('div', { className: 'ma-card-t' }, 'Readiness over time'),
          ce('div', { className: 'ma-bars' },
            lastFive.map(function (h, i) {
              return ce(Bar, {
                key: i,
                label: new Date(h.date).toLocaleDateString() + (h.passed ? '  PASS' : '  FAIL'),
                pct: h.pct, value: h.score + '/40 · ' + h.pct + '%'
              });
            })),
          ce('div', { className: 'ma-muted', style: { marginTop: 10 } },
            'Passed ' + history.filter(function (h) { return h.passed; }).length + ' of ' + history.length + ' mock attempts. ' +
            'The real checkoff allows ' + (RUBRIC().maxAttempts || 2) + ' attempts with ' + (RUBRIC().remediationAttempts || 1) + ' remediation.')
        ) : null,

        ce('div', { className: 'ma-card' },
          ce('div', { className: 'ma-card-t' }, 'How you will be graded'),
          ce(PassRules, null),
          ce('div', { className: 'ma-tiny', style: { marginTop: 12, marginBottom: 6 } }, 'The nine critical errors'),
          ce('ul', { className: 'ma-ul' },
            (RUBRIC().criticalErrors || []).map(function (c) { return ce('li', { key: c.id }, ce('b', null, c.text)); })))
      );
    }

    if (phase === 'run') {
      var med = queue[qi];
      var over = left <= 0;
      return ce('div', null,
        ce('div', { className: 'ma-scorebar' },
          ce('span', { className: 'ma-drill-clock' + (over || left < 120 ? ' low' : ''), style: { fontSize: '1.15rem' } },
            over ? '+' + fmtSec(-left) : fmtSec(left)),
          ce('span', { className: 'ma-sc' }, 'Medication ', ce('b', null, (qi + 1) + ' of ' + queue.length)),
          ce('span', { className: 'ma-sc' }, (caseObj.patient || {}).name),
          ce('span', { className: 'ma-critind' + (over ? ' hit' : '') }, over ? 'Over time' : 'Mock checkoff')),
        over ? ce('div', { className: 'ma-fb bad', style: { marginBottom: 12 } },
          ce('div', { className: 'ma-fb-t' }, 'Time limit exceeded'),
          'Keep going so you get the full breakdown, but this attempt is recorded as over time. Speed comes from knowing the sequence cold.') : null,
        ce(MARChart, { caseObj: caseObj, completed: {}, onSelect: function () {} }),
        ce('div', { className: 'ma-card', style: { borderColor: 'var(--accent)' } },
          ce('div', { className: 'ma-card-t' }, 'Assigned medication: ' + med.name),
          ce('div', { className: 'ma-muted' }, med.dose + ' ' + med.route + ' ' + med.frequency +
            (med.indication ? ' — ' + med.indication : ''))),
        pending ? ce('div', {
          className: 'ma-card',
          style: { borderColor: pending.passed ? 'var(--green)' : 'var(--red)' }, role: 'status'
        },
          ce('div', { className: 'ma-card-t' },
            ce('span', { className: 'ma-tag ' + (pending.passed ? 'green' : 'red') }, pending.passed ? 'Passed' : 'Failed'),
            med.name + ' — ' + pending.score + '/40'),
          ce('div', { className: 'ma-muted', style: { marginBottom: 10 } },
            (pending.criticalErrors || []).length
              ? 'A critical error was committed. Read the breakdown below in full — this is exactly the mistake that ends a real checkoff.'
              : 'Read the breakdown below, then continue.'),
          ce('button', { className: 'ma-btn ma-btn-primary', onClick: continueMock },
            qi + 1 >= queue.length ? 'Finish the mock checkoff →' : 'Continue to medication ' + (qi + 2) + ' →')) : null,
        ce(MedRun, {
          key: med.id, caseObj: caseObj, med: med,
          onDone: onMedDone,
          onExit: function () { if (timerRef.current) clearInterval(timerRef.current); setPhase('idle'); }
        })
      );
    }

    /* done */
    var summary = null;
    results.forEach(function (r) { if (r.__summary) summary = r.__summary; });
    if (!summary) return ce('div', { className: 'ma-card' }, 'No result.');
    var g = { passed: summary.passed, pct: summary.pct, total: summary.score };

    return ce('div', null,
      ce('div', { className: 'ma-verdict ' + (g.passed ? 'pass' : 'fail'), role: 'status' },
        ce('div', { className: 'v' }, g.passed ? 'PASS' : 'FAIL'),
        ce('div', { className: 'p' }, g.total + ' / 40  ·  ' + g.pct + '%  ·  ' + fmtSec(summary.timeSec)),
        ce('div', { className: 'r' },
          summary.criticalErrors.length
            ? summary.criticalErrors.length + ' critical error(s) — automatic fail.'
            : (summary.overtime ? 'Over the time limit.' :
              (g.passed ? 'Every competency demonstrated on every medication, no critical errors, inside the time limit.'
                : 'One or more competencies were not fully demonstrated on at least one medication.')))),

      ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Per medication'),
        (summary.perMed || []).map(function (m, i) {
          return ce(Bar, { key: i, label: m.name, pct: m.pct, value: m.score + '/40 ' + (m.passed ? 'PASS' : 'FAIL') });
        })),

      summary.criticalDetail && summary.criticalDetail.length ? ce('div', { className: 'ma-card', style: { borderColor: 'var(--red)' } },
        ce('div', { className: 'ma-card-t' }, ce('span', { className: 'ma-tag red' }, 'Critical'), 'Every critical error'),
        summary.criticalDetail.map(function (c, i) {
          var def = criticalErrorDef(c.code);
          return ce('div', { key: i, className: 'ma-fb bad', style: { marginBottom: 8 } },
            ce('div', { className: 'ma-fb-t' }, def.text),
            ce('div', null, c.action),
            ce('div', { className: 'ma-teach' }, def.explanation));
        })) : null,

      ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Every rubric item (lowest score across both medications)'),
        (RUBRIC().sections || []).map(function (sec) {
          return ce('div', { key: sec.id, style: { marginBottom: 14 } },
            ce('div', { className: 'ma-tiny', style: { marginBottom: 6 } }, sec.title),
            (sec.items || []).map(function (it) {
              var s = summary.rubricScores[it.id];
              if (typeof s !== 'number') s = 0;
              var col = s === 2 ? 'var(--green)' : s === 1 ? 'var(--orange)' : 'var(--red)';
              return ce('div', { key: it.id, className: 'ma-bar', style: { gridTemplateColumns: 'auto 1fr auto', padding: '4px 0' } },
                ce('span', { style: { color: col, fontWeight: 900, width: 16 } }, s === 2 ? '✓' : s === 1 ? '~' : '✕'),
                ce('span', null, it.title, it.critical ? ce('span', { className: 'ma-tag red', style: { marginLeft: 6 } }, 'critical') : null),
                ce('b', { style: { color: col } }, s + '/2'));
            }));
        })),

      ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Exactly what to review before the real thing'),
        ce('ul', { className: 'ma-ul' },
          (function () {
            var out = [];
            (summary.criticalDetail || []).forEach(function (c) {
              out.push('CRITICAL — ' + criticalErrorDef(c.code).text + '. ' + criticalErrorDef(c.code).explanation);
            });
            allRubricItems().forEach(function (it) {
              var s = summary.rubricScores[it.id];
              if (typeof s !== 'number') s = 0;
              if (s === 2) return;
              if (it.critical || s === 0) out.push(it.title + ' (' + s + '/2) — ' + it.teachingPoint);
            });
            if (summary.overtime) out.push('Speed — you exceeded the time limit. Rehearse the sequence out loud until it is automatic.');
            if (!out.length) out.push('Nothing outstanding. Run a different chart to keep the traps unfamiliar.');
            return out.map(function (t, i) { return ce('li', { key: i }, t); });
          })())),

      ce('div', { className: 'ma-row' },
        ce('button', { className: 'ma-btn ma-btn-primary', onClick: function () { setPhase('idle'); } }, 'Back to readiness'),
        ce('button', { className: 'ma-btn', onClick: function () { start(null); } }, 'Another mock checkoff')),

      ce(AskInstructor, {
        context: 'Mock checkoff result: ' + (g.passed ? 'PASS' : 'FAIL') + ' ' + g.total + '/40. ' +
          'Critical errors: ' + (summary.criticalErrors.join(', ') || 'none') + '. Case: ' + summary.caseId,
        suggestions: ['Build me a study plan for my checkoff', 'What is my biggest weakness?']
      })
    );
  }

  /* ==========================================================================
   * 17. HOME — mastery + mode picker
   * ======================================================================== */

  var MODES = [
    { id: 'mar', icon: 'MAR', name: 'MAR Simulation', desc: 'Work a real Medication Administration Record through the full procedure. Traps fire when you trigger them.' },
    { id: 'rubric', icon: '/40', name: 'Rubric Practice', desc: 'The official 40-point rubric, item by item, with the three scoring levels and pass/fail determination.' },
    { id: 'drill', icon: '6R', name: 'Six Rights & Three Checks', desc: 'Timed rapid-fire drill. Name the right being violated, place the check, judge the identifier.' },
    { id: 'skills', icon: 'INJ', name: 'Injection Skills', desc: 'Route reference plus a clickable site selector — pick the right site for the drug and the patient.' },
    { id: 'drugs', icon: 'Rx', name: 'Drug Reference & Quiz', desc: 'All 37 drugs, searchable and filterable, plus a give-or-hold quiz weighted to the high-alert drugs.' },
    { id: 'readiness', icon: 'CHK', name: 'Signoff Readiness', desc: 'Full mock checkoff under a timer, graded strictly, with a complete breakdown and a study list.' }
  ];

  function Home(props) {
    var results = savedResults();
    var stats = savedStats();
    var mocks = results.filter(function (r) { return r.mode === 'mock'; });
    var passRate = results.length ? Math.round(results.filter(function (r) { return r.passed; }).length / results.length * 100) : 0;
    var totalCrit = results.reduce(function (n, r) { return n + ((r.criticalErrors || []).length); }, 0);

    var rubricStats = stats.rubric || {};
    var weakest = allRubricItems().map(function (it) {
      var s = rubricStats[it.id];
      return { item: it, avg: s ? s.sum / s.n : null, n: s ? s.n : 0 };
    }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return a.avg - b.avg; }).slice(0, 6);

    var drugStats = stats.drugs || {};
    var drugKeys = Object.keys(drugStats);

    return ce('div', null,
      ce('div', { className: 'ma-modegrid', style: { marginBottom: 16 } },
        MODES.map(function (m) {
          return ce('button', {
            key: m.id, className: 'ma-modecard', onClick: function () { props.onPick(m.id); }
          },
            ce('span', { className: 'ma-modeicon', 'aria-hidden': 'true' }, m.icon),
            ce('span', { className: 'ma-modename' }, m.name),
            ce('span', { className: 'ma-modedesc' }, m.desc));
        })),

      ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Where you stand'),
        ce('div', { className: 'ma-big' },
          ce('div', { className: 'ma-stat' }, ce('b', null, String(results.length)), ce('span', null, 'Runs graded')),
          ce('div', { className: 'ma-stat' },
            ce('b', { style: { color: passRate >= 80 ? 'var(--green)' : passRate >= 50 ? 'var(--orange)' : 'var(--red)' } }, passRate + '%'),
            ce('span', null, 'Pass rate')),
          ce('div', { className: 'ma-stat' },
            ce('b', { style: { color: totalCrit ? 'var(--red)' : 'var(--green)' } }, String(totalCrit)),
            ce('span', null, 'Critical errors')),
          ce('div', { className: 'ma-stat' }, ce('b', null, String(mocks.length)), ce('span', null, 'Mock checkoffs'))),
        results.length === 0
          ? ce('div', { className: 'ma-muted', style: { marginTop: 12 } },
            'Nothing recorded yet. Start with MAR Simulation — the Eric Doe chart has the allergy trap that fails more students than anything else.')
          : null),

      weakest.length ? ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Weakest rubric items'),
        ce('div', { className: 'ma-bars' },
          weakest.map(function (w) {
            return ce(Bar, {
              key: w.item.id,
              label: w.item.title + (w.item.critical ? ' (critical)' : ''),
              pct: (w.avg / 2) * 100,
              value: (Math.round(w.avg * 10) / 10) + '/2'
            });
          }))) : null,

      drugKeys.length ? ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, 'Drugs you have administered in practice'),
        ce('div', { className: 'ma-bars' },
          drugKeys.slice(0, 12).map(function (k) {
            var d = drugStats[k];
            return ce(Bar, { key: k, label: k, pct: d.n ? (d.clean / d.n) * 100 : 0, value: d.clean + '/' + d.n + ' clean' });
          }))) : null,

      ce('div', { className: 'ma-card' },
        ce('div', { className: 'ma-card-t' }, ce('span', { className: 'ma-tag red' }, 'Automatic fail'), 'Know these cold'),
        ce('ul', { className: 'ma-ul' },
          (RUBRIC().criticalErrors || []).map(function (c) {
            return ce('li', { key: c.id }, ce('b', null, c.text));
          })),
        ce('div', { className: 'ma-muted', style: { marginTop: 10 } },
          'Any one of these is an automatic fail regardless of your score. You get ' + (RUBRIC().maxAttempts || 2) +
          ' attempts with ' + (RUBRIC().remediationAttempts || 1) + ' remediation.'))
    );
  }

  /* ==========================================================================
   * 18. TOP-LEVEL PAGE
   * ======================================================================== */

  function MedAdminTrainer(props) {
    useEffect(function () { injectStyles(); }, []);
    injectStyles();

    var m0 = useState('home'), mode = m0[0], setMode = m0[1];

    var hasData = (CASES().length > 0) && (allRubricItems().length > 0);

    var current = null;
    MODES.forEach(function (m) { if (m.id === mode) current = m; });

    return ce('div', { className: 'ma-wrap' },
      ce('div', { className: 'ma-hdr' },
        ce('div', null,
          ce('h2', { className: 'ma-h1' }, 'Medication Administration Signoff Trainer'),
          ce('p', { className: 'ma-sub' },
            mode === 'home'
              ? 'Everything scored against the real 40-point rubric. Any one of the nine critical errors is an automatic fail, so this trainer stops you the moment you commit one and shows you what would have happened to the patient.'
              : current ? current.desc : '')),
        mode !== 'home'
          ? ce('button', { className: 'ma-btn', onClick: function () { setMode('home'); } }, '← All modes')
          : null),

      !hasData
        ? ce('div', { className: 'ma-card' },
          ce('div', { className: 'ma-card-t' }, 'Data not loaded'),
          ce('div', { className: 'ma-muted' },
            'This module needs data/medadmin.js to be loaded before js/medadmin-trainer.js. Check the script order in index.html.'))
        : mode === 'home' ? ce(Home, { onPick: setMode })
          : mode === 'mar' ? ce(MARSimulation, { mode: 'mar-practice' })
            : mode === 'rubric' ? ce(RubricPractice, null)
              : mode === 'drill' ? ce(RightsDrill, null)
                : mode === 'skills' ? ce(InjectionSkills, null)
                  : mode === 'drugs' ? ce(DrugReference, null)
                    : mode === 'readiness' ? ce(ReadinessCheck, null)
                      : ce(Home, { onPick: setMode })
    );
  }

  window.MedAdminTrainer = MedAdminTrainer;
  window.MedAdminTrainerModes = MODES;

  /* Exposed for diagnostics / tests only — no UI depends on this. */
  MedAdminTrainer.internals = {
    buildSteps: buildSteps, detectAllergyConflict: detectAllergyConflict,
    hazardsFor: hazardsFor, caseLevelHazards: caseLevelHazards, orderIssue: orderIssue,
    gradeRun: gradeRun, allRubricItems: allRubricItems, buildDrillBank: buildDrillBank,
    buildDrugQuestions: buildDrugQuestions, classBucket: classBucket,
    findDrugEntry: findDrugEntry, hazardForCheck: hazardForCheck, routeIdFor: routeIdFor,
    components: {
      Home: Home, MARSimulation: MARSimulation, RubricPractice: RubricPractice,
      RightsDrill: RightsDrill, InjectionSkills: InjectionSkills, DrugReference: DrugReference,
      DrugQuiz: DrugQuiz, ReadinessCheck: ReadinessCheck, MedRun: MedRun, MARChart: MARChart,
      RunDebrief: RunDebrief, SiteSelector: SiteSelector, BodyDiagram: BodyDiagram,
      TrapCard: TrapCard, CriticalScreen: CriticalScreen, DoseCalc: DoseCalc,
      VerbalizeBox: VerbalizeBox, AskInstructor: AskInstructor, DrugDetail: DrugDetail
    }
  };

})();
