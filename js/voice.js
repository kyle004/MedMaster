/* ==========================================================================
 * MedMaster :: js/voice.js
 * Voice layer  -  window.MM.voice  +  VoiceButton / SpeakButton /
 *                 VoiceSettings / SBARRecorder / HandsFreeBar
 *
 * Browser-native only: Web Speech API (SpeechRecognition + speechSynthesis).
 * No external services, no API keys, no build step, no JSX, no ES modules.
 *
 * MOBILE SAFARI / iOS NOTE (important):
 *   iOS will silently refuse speechSynthesis.speak() unless the very first
 *   utterance of the page session originates inside a real user gesture
 *   (touchend / click handler), synchronously-ish. Every entry point in this
 *   file that can start audio (SpeakButton, VoiceButton, VoiceSettings
 *   preview, SBARRecorder, HandsFreeBar) calls MM.voice.prime() from inside
 *   its onClick handler. prime() pushes a silent 1-space utterance which
 *   "unlocks" the synth for the rest of the session. If you add a new caller,
 *   call MM.voice.prime() in the gesture handler too, otherwise the first
 *   speak() on iOS will no-op.
 * ========================================================================== */
(function () {
  'use strict';

  var ce = React.createElement;
  var useState = React.useState, useEffect = React.useEffect,
      useRef = React.useRef, useMemo = React.useMemo,
      useCallback = React.useCallback;

  window.MM = window.MM || {};

  /* ======================================================================
   * 0. Tiny helpers
   * ==================================================================== */

  function isFn(f) { return typeof f === 'function'; }
  function callSafe(f) {
    if (!isFn(f)) return undefined;
    var args = Array.prototype.slice.call(arguments, 1);
    try { return f.apply(null, args); } catch (e) { return undefined; }
  }
  function clamp(n, lo, hi) {
    n = Number(n);
    if (isNaN(n)) return lo;
    return n < lo ? lo : (n > hi ? hi : n);
  }
  function str(v) { return v === null || v === undefined ? '' : String(v); }

  /* ======================================================================
   * 1. STYLES  (injected once)
   * ==================================================================== */

  function injectStyles() {
    if (document.getElementById('mmvoice-styles')) return;
    var css = [
      /* ---- shared ---- */
      '.mmv-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.mmv-col{display:flex;flex-direction:column;gap:8px}',
      '.mmv-muted{color:var(--text2);font-size:12px}',
      '.mmv-dim{color:var(--text3);font-size:11px}',
      '.mmv-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',

      /* ---- mic button ---- */
      '.mmv-mic{position:relative;display:inline-flex;align-items:center;justify-content:center;',
      'gap:8px;min-width:44px;min-height:44px;padding:0 14px;border-radius:999px;',
      'border:1px solid var(--surface2);background:var(--surface);color:var(--text);',
      'font-size:14px;font-weight:600;cursor:pointer;user-select:none;',
      '-webkit-tap-highlight-color:transparent;transition:background .15s,border-color .15s,transform .1s}',
      '.mmv-mic:active{transform:scale(.96)}',
      '.mmv-mic:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.mmv-mic.sm{min-width:44px;min-height:44px;padding:0 10px;font-size:13px}',
      '.mmv-mic.lg{min-height:60px;padding:0 22px;font-size:16px}',
      '.mmv-mic.is-listening{background:var(--red);border-color:var(--red);color:var(--text)}',
      '.mmv-mic.is-processing{background:var(--surface2);border-color:var(--accent);color:var(--text)}',
      '.mmv-mic[disabled]{opacity:.5;cursor:not-allowed}',
      '.mmv-mic-ico{width:20px;height:20px;flex:0 0 auto;display:block}',

      /* ---- pulse ring ---- */
      '.mmv-pulse{position:absolute;inset:-4px;border-radius:999px;border:2px solid var(--red);',
      'opacity:.75;pointer-events:none;animation:mmv-pulse 1.5s ease-out infinite}',
      '.mmv-pulse.d2{animation-delay:.5s}',
      '.mmv-pulse.d3{animation-delay:1s}',
      '@keyframes mmv-pulse{0%{transform:scale(.9);opacity:.7}100%{transform:scale(1.45);opacity:0}}',
      '@media (prefers-reduced-motion:reduce){.mmv-pulse{animation:none;opacity:.35}}',

      /* ---- interim bubble ---- */
      '.mmv-bubble{margin-top:8px;background:var(--surface);border:1px solid var(--surface2);',
      'border-radius:12px;padding:8px 12px;font-size:13px;line-height:1.5;color:var(--text);',
      'max-width:100%;word-break:break-word}',
      '.mmv-bubble .mmv-interim{color:var(--text2);font-style:italic}',

      /* ---- speak button ---- */
      '.mmv-speak{display:inline-flex;align-items:center;justify-content:center;gap:6px;',
      'min-width:44px;min-height:44px;padding:0 10px;border-radius:10px;cursor:pointer;',
      'border:1px solid var(--surface2);background:transparent;color:var(--text2);font-size:13px;',
      '-webkit-tap-highlight-color:transparent;transition:color .15s,border-color .15s}',
      '.mmv-speak:hover{color:var(--text);border-color:var(--accent)}',
      '.mmv-speak.is-speaking{color:var(--accent);border-color:var(--accent)}',
      '.mmv-speak:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.mmv-speak[disabled]{opacity:.4;cursor:not-allowed}',

      /* ---- settings ---- */
      '.mmv-panel{display:flex;flex-direction:column;gap:16px}',
      '.mmv-sec{border:1px solid var(--surface2);border-radius:12px;padding:12px;background:var(--surface)}',
      '.mmv-sec h4{margin:0 0 10px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--text2)}',
      '.mmv-field{display:flex;align-items:center;justify-content:space-between;gap:12px;',
      'padding:8px 0;flex-wrap:wrap;min-height:44px}',
      '.mmv-field label{font-size:14px;color:var(--text)}',
      '.mmv-select{background:var(--bg);color:var(--text);border:1px solid var(--surface2);',
      'border-radius:8px;padding:10px;font-size:14px;min-height:44px;max-width:100%;flex:1 1 180px}',
      '.mmv-range{flex:1 1 160px;min-width:120px;accent-color:var(--accent);height:32px}',
      '.mmv-switch{position:relative;width:52px;height:30px;border-radius:999px;border:1px solid var(--surface2);',
      'background:var(--surface2);cursor:pointer;flex:0 0 auto;padding:0;transition:background .15s}',
      '.mmv-switch[data-on="1"]{background:var(--green);border-color:var(--green)}',
      '.mmv-switch:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.mmv-knob{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;',
      'background:var(--text);transition:transform .15s}',
      '.mmv-switch[data-on="1"] .mmv-knob{transform:translateX(22px)}',

      /* ---- support matrix ---- */
      '.mmv-matrix{display:grid;grid-template-columns:1fr auto;gap:6px 10px;font-size:13px}',
      '.mmv-matrix .k{color:var(--text2)}',
      '.mmv-yes{color:var(--green);font-weight:700}',
      '.mmv-no{color:var(--red);font-weight:700}',
      '.mmv-maybe{color:var(--orange);font-weight:700}',

      /* ---- SBAR ---- */
      '.mmv-sbar{display:flex;flex-direction:column;gap:14px}',
      '.mmv-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}',
      '.mmv-step{border:1px solid var(--surface2);border-radius:10px;padding:8px 6px;text-align:center;',
      'background:var(--surface);transition:border-color .2s,background .2s}',
      '.mmv-step .l{font-size:18px;font-weight:800;color:var(--text3);line-height:1}',
      '.mmv-step .n{font-size:10px;color:var(--text3);margin-top:4px;letter-spacing:.04em}',
      '.mmv-step.done{border-color:var(--green)}',
      '.mmv-step.done .l{color:var(--green)}',
      '.mmv-step.done .n{color:var(--text2)}',
      '.mmv-step.active{border-color:var(--accent);background:var(--surface2);box-shadow:0 0 0 1px var(--accent) inset}',
      '.mmv-step.active .l,.mmv-step.active .n{color:var(--accent)}',
      '.mmv-timer{font-variant-numeric:tabular-nums;font-size:22px;font-weight:700;color:var(--text)}',
      '.mmv-live{min-height:96px;max-height:34vh;overflow:auto;background:var(--bg);',
      'border:1px solid var(--surface2);border-radius:12px;padding:12px;font-size:14px;line-height:1.6;',
      'color:var(--text);white-space:pre-wrap;word-break:break-word}',
      '.mmv-live .mmv-interim{color:var(--text3);font-style:italic}',
      '.mmv-score{display:flex;align-items:baseline;gap:8px}',
      '.mmv-score .v{font-size:34px;font-weight:800;line-height:1}',
      '.mmv-bar{height:8px;border-radius:999px;background:var(--surface2);overflow:hidden}',
      '.mmv-bar>i{display:block;height:100%;border-radius:999px;background:var(--accent)}',
      '.mmv-brk{display:flex;flex-direction:column;gap:10px}',
      '.mmv-brk-row{display:flex;flex-direction:column;gap:4px}',
      '.mmv-brk-head{display:flex;justify-content:space-between;gap:8px;font-size:13px;color:var(--text)}',
      '.mmv-cmp{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.mmv-cmp .h{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:4px}',
      '.mmv-cmp .b{background:var(--bg);border:1px solid var(--surface2);border-radius:10px;padding:10px;',
      'font-size:13px;line-height:1.55;color:var(--text);white-space:pre-wrap;word-break:break-word}',
      '.mmv-miss{display:flex;flex-wrap:wrap;gap:6px}',

      /* ---- hands free bar ---- */
      '.mmv-hf{position:sticky;bottom:0;z-index:40;background:var(--surface);border:1px solid var(--surface2);',
      'border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}',
      '.mmv-hf-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.mmv-dot{width:10px;height:10px;border-radius:50%;background:var(--text3);flex:0 0 auto}',
      '.mmv-dot.on{background:var(--red);animation:mmv-blink 1.2s ease-in-out infinite}',
      '@keyframes mmv-blink{0%,100%{opacity:1}50%{opacity:.25}}',
      '@media (prefers-reduced-motion:reduce){.mmv-dot.on{animation:none}}',
      '.mmv-hf-heard{color:var(--text2);font-size:13px;flex:1 1 120px;min-width:0;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '.mmv-hf-ok{color:var(--green);font-weight:700;font-size:13px}',
      '.mmv-cmdlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}',
      '.mmv-cmd{background:var(--bg);border:1px solid var(--surface2);border-radius:8px;padding:8px 10px;',
      'font-size:12px;color:var(--text2)}',
      '.mmv-cmd b{color:var(--text);display:block;font-size:13px}',

      /* ---- AI wait status (see the AI WAIT STATE block below) ---- */
      '.mmv-wait{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--text2);',
      'font-size:13px;line-height:1.5}',
      '.mmv-wait.slow{color:var(--orange)}',
      '.mmv-wait .secs{font-variant-numeric:tabular-nums;color:var(--text3);font-size:12px}',
      '.mmv-wait .dots{display:inline-flex;gap:3px;align-items:center;flex:0 0 auto}',
      '.mmv-wait .dots i{width:6px;height:6px;border-radius:50%;background:var(--text3);',
      'animation:mmv-waitbounce 1.2s infinite}',
      '.mmv-wait .dots i:nth-child(2){animation-delay:.15s}',
      '.mmv-wait .dots i:nth-child(3){animation-delay:.3s}',
      '@keyframes mmv-waitbounce{0%,60%,100%{opacity:.3;transform:translateY(0)}',
      '30%{opacity:1;transform:translateY(-3px)}}',
      /* the motion goes; the words and the counter stay */
      '@media (prefers-reduced-motion:reduce){.mmv-wait .dots i{animation:none;opacity:.55}}',

      /* ---- notice ---- */
      '.mmv-note{border:1px solid var(--surface2);border-left:3px solid var(--orange);border-radius:8px;',
      'padding:10px 12px;font-size:13px;color:var(--text2);background:var(--surface);line-height:1.5}',
      '.mmv-note.err{border-left-color:var(--red)}',
      '.mmv-note.ok{border-left-color:var(--green)}',

      /* ---- phones ---- */
      '@media (max-width:640px){',
      '.mmv-cmp{grid-template-columns:1fr}',
      '.mmv-step .n{font-size:9px}',
      '.mmv-field{align-items:flex-start;flex-direction:column;gap:6px}',
      '.mmv-field .mmv-select,.mmv-field .mmv-range{width:100%}',
      '.mmv-hf{border-radius:12px;padding:8px 10px}',
      '}',
      '@media (max-width:360px){.mmv-mic{padding:0 10px;font-size:13px}}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'mmvoice-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }
  injectStyles();

  /* ======================================================================
   * 2. SPEECH EXPANSIONS  -  one table, easy to extend.
   *    Applied top-to-bottom, so compound/longer forms come FIRST.
   *    Each entry: { re: RegExp(global), to: String|Function }
   * ==================================================================== */

  var SPEECH_EXPANSIONS = [
    /* -- compound units (must precede the single-unit rules) -------------- */
    { re: /\bmcg\s*\/\s*kg\s*\/\s*min\b/gi, to: 'micrograms per kilogram per minute' },
    { re: /\bmg\s*\/\s*kg\s*\/\s*day\b/gi, to: 'milligrams per kilogram per day' },
    { re: /\bmg\s*\/\s*kg\b/gi,            to: 'milligrams per kilogram' },
    { re: /\bmcg\s*\/\s*min\b/gi,          to: 'micrograms per minute' },
    { re: /\bmg\s*\/\s*mL\b/gi,            to: 'milligrams per milliliter' },
    { re: /\bmL\s*\/\s*kg\b/gi,            to: 'milliliters per kilogram' },
    { re: /\bmL\s*\/\s*(?:hr|h)\b/gi,      to: 'milliliters per hour' },
    { re: /\bmL\s*\/\s*min\b/gi,           to: 'milliliters per minute' },
    { re: /\bL\s*\/\s*min\b/g,             to: 'liters per minute' },
    { re: /\bgtts?\s*\/\s*min\b/gi,        to: 'drops per minute' },
    { re: /\bunits?\s*\/\s*(?:hr|h)\b/gi,  to: 'units per hour' },
    { re: /\bmEq\b/gi,                     to: 'milliequivalents' },
    { re: /\bgtts?\b/gi,                   to: 'drops' },

    /* -- vital-sign fractions: 138/74 -> "138 over 74" -------------------- */
    { re: /(\d{2,3})\s*\/\s*(\d{2,3})(?!\d)/g, to: '$1 over $2' },

    /* -- frequency / schedule --------------------------------------------- */
    /* q1h is "every hour", never "every one hours". Must precede the generic
       rule below, which cannot know that 1 is the singular. */
    { re: /\bq\s*1\s*(?:h|hr|hrs|hours?)\b/gi,     to: 'every hour' },
    { re: /\bq\s*(\d+)\s*(?:h|hr|hrs|hours?)\b/gi, to: 'every $1 hours' },
    { re: /\bq\s*(\d+)\s*min\b/gi,                 to: 'every $1 minutes' },
    { re: /\bq\s*(?:d|day|daily)\b/gi,             to: 'daily' },
    { re: /\bBID\b/g,  to: 'twice a day' },
    { re: /\bTID\b/g,  to: 'three times a day' },
    { re: /\bQID\b/g,  to: 'four times a day' },
    { re: /\bQHS\b/gi, to: 'at bedtime' },
    { re: /\bAC\s*&\s*HS\b/gi, to: 'before meals and at bedtime' },
    { re: /\bSTAT\b/g, to: 'immediately' },
    { re: /\bx\s?(\d+)\s*days?\b/gi, to: 'for $1 days' },
    { re: /\bx\s?4\b/gi, to: 'times four' },
    { re: /\bx\s?3\b/gi, to: 'times three' },
    { re: /\bx\s?2\b/gi, to: 'times two' },
    { re: /\bA\s*&\s*O\b/gi, to: 'alert and oriented' },

    /* -- vitals / monitoring ----------------------------------------------- */
    { re: /\bSpO(?:2|₂)\b/gi,  to: 'oxygen saturation' },
    { re: /\bSaO(?:2|₂)\b/gi,  to: 'arterial oxygen saturation' },
    { re: /\bEtCO(?:2|₂)\b/gi, to: 'end tidal C O 2' },
    { re: /\bPaCO(?:2|₂)\b/gi, to: 'partial pressure of carbon dioxide' },
    { re: /\bPaO(?:2|₂)\b/gi,  to: 'partial pressure of oxygen' },
    { re: /\bFiO(?:2|₂)\b/gi,  to: 'fraction of inspired oxygen' },
    { re: /\bO(?:2|₂)\b/g,     to: 'oxygen' },
    { re: /\bCO(?:2|₂)\b/g,    to: 'carbon dioxide' },
    { re: /\bBP\b/g,   to: 'blood pressure' },
    { re: /\bMAP\b/g,  to: 'mean arterial pressure' },
    { re: /\bHR\b/g,   to: 'heart rate' },
    { re: /\bRR\b/g,   to: 'respiratory rate' },
    { re: /\bLOC\b/g,  to: 'level of consciousness' },
    { re: /\bTemp\b/g, to: 'temperature' },
    { re: /\bWNL\b/g,  to: 'within normal limits' },
    { re: /\bI\s*&\s*O\b/g, to: 'intake and output' },

    /* -- doses / units ------------------------------------------------------ */
    { re: /\bmcg\b/g, to: 'micrograms' },
    { re: /\bmg\b/g,  to: 'milligrams' },
    { re: /\bmL\b/g,  to: 'milliliters' },
    { re: /\bml\b/g,  to: 'milliliters' },
    { re: /\bkg\b/g,  to: 'kilograms' },
    { re: /\blbs?\b/g, to: 'pounds' },
    { re: /\bcm\b/g,  to: 'centimeters' },
    { re: /\bmmHg\b/gi, to: 'millimeters of mercury' },
    { re: /\bdL\b/g,  to: 'deciliter' },

    /* -- oxygen delivery ----------------------------------------------------
       Spoken constantly in these scenarios ("2 L via NC", "15 L NRB"). Without
       these the device reads the letters, which is exactly the screen-reader
       effect the normalizer exists to avoid. Case-sensitive so a lowercase
       "nc" inside an ordinary word is never touched. */
    { re: /\bNRB\b/g,  to: 'non-rebreather' },
    { re: /\bNC\b/g,   to: 'nasal cannula' },
    { re: /\bHFNC\b/g, to: 'high flow nasal cannula' },
    { re: /\bBVM\b/g,  to: 'bag valve mask' },
    { re: /\bRA\b/g,   to: 'room air' },

    /* -- routes / orders ---------------------------------------------------- */
    { re: /\bIVPB\b/g, to: 'I V piggyback' },
    { re: /\bIVP\b/g,  to: 'I V push' },
    { re: /\bIV\b/g,   to: 'I V' },
    { re: /\bIM\b/g,   to: 'intramuscular' },
    { re: /\bsub\s?-?\s?(?:q|cut)\b/gi, to: 'subcutaneous' },
    { re: /\bSQ\b/g,   to: 'subcutaneous' },
    { re: /\bNPO\b/g,  to: 'nothing by mouth' },
    { re: /\bPRN\b/g,  to: 'as needed' },
    { re: /\bPO\b/g,   to: 'by mouth' },
    { re: /\bSL\b/g,   to: 'sublingual' },
    { re: /\bNG\b/g,   to: 'N G' },
    { re: /\bNKDA\b/g, to: 'no known drug allergies' },
    { re: /\bDNR\b/g,  to: 'do not resuscitate' },

    /* -- assessments / diagnostics ------------------------------------------ */
    { re: /\bSBAR\b/gi, to: 'S B A R' },
    { re: /\bABG(s)?\b/g, to: function (m, s) { return s ? 'arterial blood gases' : 'arterial blood gas'; } },
    { re: /\bCBC\b/g,  to: 'C B C' },
    { re: /\bBMP\b/g,  to: 'basic metabolic panel' },
    { re: /\bCMP\b/g,  to: 'comprehensive metabolic panel' },
    { re: /\bEKG\b/g,  to: 'E K G' },
    { re: /\bECG\b/g,  to: 'E C G' },
    { re: /\bCXR\b/g,  to: 'chest x ray' },
    { re: /\bCT\b/g,   to: 'C T' },
    { re: /\bH\s*&\s*P\b/g, to: 'history and physical' },
    { re: /\bHgb\b/gi, to: 'hemoglobin' },
    { re: /\bHct\b/gi, to: 'hematocrit' },
    { re: /\bWBC\b/g,  to: 'white blood cell count' },
    { re: /\bRBC\b/g,  to: 'red blood cell count' },
    { re: /\bPRBC(?:s)?\b/g, to: 'packed red blood cells' },
    { re: /\bBUN\b/g,  to: 'B U N' },
    { re: /\bINR\b/g,  to: 'I N R' },
    { re: /\bPTT\b/g,  to: 'P T T' },
    { re: /\bK\+/g,    to: 'potassium' },
    { re: /\bNa\+/g,   to: 'sodium' },
    { re: /\bICP\b/g,  to: 'intracranial pressure' },
    { re: /\bARDS\b/g, to: 'A R D S' },
    { re: /\bDIC\b/g,  to: 'D I C' },
    { re: /\bDVT\b/g,  to: 'D V T' },
    { re: /\bPE\b/g,   to: 'pulmonary embolism' },
    { re: /\bCHF\b/g,  to: 'congestive heart failure' },
    { re: /\bCOPD\b/g, to: 'C O P D' },
    { re: /\bMI\b/g,   to: 'myocardial infarction' },
    { re: /\bGI\b/g,   to: 'G I' },
    { re: /\bUTI\b/g,  to: 'urinary tract infection' },
    { re: /\bPPH\b/g,  to: 'postpartum hemorrhage' },
    { re: /\bFHR\b/g,  to: 'fetal heart rate' },
    { re: /\bROM\b/g,  to: 'rupture of membranes' },
    { re: /\bC-?section\b/gi, to: 'cesarean section' },
    { re: /\bICU\b/g,  to: 'I C U' },
    { re: /\bED\b/g,   to: 'emergency department' },
    { re: /\bRN\b/g,   to: 'R N' },
    { re: /\bMD\b/g,   to: 'M D' },
    { re: /\bATI\b/g,  to: 'A T I' },
    { re: /\bNCLEX\b/g, to: 'N CLEX' },

    /* -- symbols ------------------------------------------------------------ */
    { re: /→|->/g, to: ' leads to ' },
    { re: /[•●▪]/g, to: ', ' },
    { re: /≤|<=/g, to: ' less than or equal to ' },
    { re: /≥|>=/g, to: ' greater than or equal to ' },
    { re: /(\d)\s*%/g, to: '$1 percent' },
    { re: /\s{2,}/g, to: ' ' }
  ];

  /* ======================================================================
   * 3. MEDICAL MISRECOGNITION CORRECTIONS  -  one table, easy to extend.
   *    Case-insensitive, word-boundary safe. Longest/most specific first.
   * ==================================================================== */

  var MEDICAL_CORRECTIONS = [
    /* ---------- high-alert drugs ---------- */
    { re: /\b(?:lay\s?six|la\s?six|lay\s?sicks|lasik|lassie\s?x|lay\s?zicks)\b/gi, to: 'Lasix' },
    { re: /\b(?:fur\s?oh\s?se\s?mide|furo\s?semide|fur\s?semide|for\s?semide)\b/gi, to: 'furosemide' },
    { re: /\b(?:dig\s?ox\s?in|dig\s?oxen|dij\s?ox\s?in|dixon|dig\s?oh\s?sin|digoxen)\b/gi, to: 'digoxin' },
    { re: /\b(?:dig|dij)\s?(?:level|toxicity)\b/gi, to: 'digoxin level' },
    { re: /\b(?:hep\s?rin|hep\s?run|hepper\s?in|hep\s?a\s?rin|heppa\s?rin)\b/gi, to: 'heparin' },
    { re: /\b(?:e\s?nox\s?a\s?parin|a\s?nox\s?aparin|inox\s?aparin)\b/gi, to: 'enoxaparin' },
    { re: /\b(?:low\s?ven\s?ox|lovin\s?ox|love\s?knox|love\s?nox)\b/gi, to: 'Lovenox' },
    { re: /\b(?:war\s?fern|war\s?for\s?in|war\s?far\s?in|wolf\s?rin)\b/gi, to: 'warfarin' },
    { re: /\b(?:coo\s?ma\s?din|kumadin|comma\s?din)\b/gi, to: 'Coumadin' },
    { re: /\b(?:ox\s?in|oxy\s?tosin|oxy\s?toe\s?sin|ock\s?sitocin)\b/gi, to: 'oxytocin' },
    { re: /\b(?:pit\s?oh\s?sin|pit\s?o\s?sin|pit\s?ocean|pitocin|pit)\b(?!\s?stop)/gi, to: 'oxytocin (Pitocin)' },
    { re: /\b(?:mag\s?nesium|mag\s?knee\s?sium|magnifi?cent\s?sulfate|mag\s?sulfate|mag\s?sul)\b/gi, to: 'magnesium sulfate' },
    { re: /\b(?:al\s?beauty\s?roll|al\s?bute\s?rol|albuter\s?all|al\s?butor\s?all|albuter\s?oil|al\s?butyl)\b/gi, to: 'albuterol' },
    { re: /\b(?:in\s?sue\s?lin|insu\s?lynn|in\s?slin)\b/gi, to: 'insulin' },
    { re: /\b(?:hue\s?ma\s?log|human\s?log|hu\s?malog)\b/gi, to: 'Humalog' },
    { re: /\b(?:lan\s?tus|lantis|lan\s?tis)\b/gi, to: 'Lantus' },
    { re: /\b(?:pot\s?ass\s?ium|po\s?tass\s?ium|potassium\s?c\s?l)\b/gi, to: 'potassium' },
    { re: /\b(?:mor\s?feen|more\s?fine|morphene)\b/gi, to: 'morphine' },
    { re: /\b(?:hydro\s?more\s?fone|hydro\s?morph\s?one|die\s?lauded|dilauded|di\s?lodid)\b/gi, to: 'hydromorphone (Dilaudid)' },
    { re: /\b(?:nar\s?can|narc\s?an|nark\s?an)\b/gi, to: 'Narcan' },
    { re: /\b(?:nal\s?ox\s?own|na\s?loxone|nail\s?oxone)\b/gi, to: 'naloxone' },
    { re: /\b(?:epi\s?neff\s?rin|eppy\s?nephrine|epi\s?nephron)\b/gi, to: 'epinephrine' },
    { re: /\b(?:eppy|eppie)\b/gi, to: 'epi' },
    { re: /\b(?:levo\s?fed|leave\s?o\s?fed|levophed)\b/gi, to: 'Levophed' },
    { re: /\b(?:nor\s?epi\s?nephrine|nora\s?pinephrine)\b/gi, to: 'norepinephrine' },
    { re: /\b(?:doe\s?pa\s?mean|dopa\s?mean|dopa\s?mine)\b/gi, to: 'dopamine' },
    { re: /\b(?:dough\s?butamine|do\s?butamine)\b/gi, to: 'dobutamine' },
    { re: /\b(?:ammo\s?darone|amio\s?darone|am\s?e\s?odarone|amiodo\s?rone)\b/gi, to: 'amiodarone' },
    { re: /\b(?:aden\s?a\s?seen|a\s?den\s?o\s?sean|adeno\s?scene)\b/gi, to: 'adenosine' },
    { re: /\b(?:atro\s?peen|at\s?ro\s?pine|a\s?tropine)\b/gi, to: 'atropine' },
    { re: /\b(?:nitro\s?glycerine|nitro\s?glisserin|night\s?row\s?glycerin|nitro)\b/gi, to: 'nitroglycerin' },
    { re: /\b(?:met\s?oh\s?pro\s?lol|metropolol|meta\s?prolol|met\s?o\s?prolol)\b/gi, to: 'metoprolol' },
    { re: /\b(?:la\s?bet\s?a\s?lol|lab\s?etalol|label\s?olol)\b/gi, to: 'labetalol' },
    { re: /\b(?:hydra\s?la\s?zine|hydral\s?a\s?zine|hi\s?dralazine)\b/gi, to: 'hydralazine' },
    { re: /\b(?:lisin\s?april|lie\s?sin\s?oh\s?pril|listen\s?o\s?pril)\b/gi, to: 'lisinopril' },
    { re: /\b(?:spiro\s?nolactone|spira\s?no\s?lactone)\b/gi, to: 'spironolactone' },
    { re: /\b(?:pan\s?toe\s?prazole|protonics|pro\s?tonix)\b/gi, to: 'pantoprazole (Protonix)' },
    { re: /\b(?:on\s?dan\s?setron|zoe\s?fran|so\s?fran|zo\s?fran)\b/gi, to: 'ondansetron (Zofran)' },
    { re: /\b(?:seft\s?ry\s?axone|cef\s?tri\s?axone|row\s?seffin|ro\s?cephin)\b/gi, to: 'ceftriaxone (Rocephin)' },
    { re: /\b(?:vanko\s?mycin|vanco\s?my\s?sin|van\s?comycin|vanco)\b/gi, to: 'vancomycin' },
    { re: /\b(?:zoe\s?sin|zo\s?syn|pip\s?tazo)\b/gi, to: 'Zosyn' },
    { re: /\b(?:tie\s?len\s?ol|tylan\s?ol|tile\s?nol)\b/gi, to: 'Tylenol' },
    { re: /\b(?:a\s?seat\s?a\s?minophen|acetaminophen)\b/gi, to: 'acetaminophen' },
    { re: /\b(?:sole\s?u\s?medrol|solu\s?med\s?roll|solo\s?medrol)\b/gi, to: 'Solu-Medrol' },
    { re: /\b(?:methyl\s?pred\s?nis\s?olone)\b/gi, to: 'methylprednisolone' },
    { re: /\b(?:pred\s?ni\s?soan|prednisone)\b/gi, to: 'prednisone' },
    { re: /\b(?:at\s?ro\s?vent|a\s?trovent|ipra\s?tropium)\b/gi, to: 'ipratropium (Atrovent)' },
    { re: /\b(?:ter\s?byou\s?ta\s?leen|terbu\s?taline)\b/gi, to: 'terbutaline' },
    { re: /\b(?:bay\s?ta\s?methasone|beta\s?meth\s?a\s?sone)\b/gi, to: 'betamethasone' },
    { re: /\b(?:sight\s?o\s?tech|cyto\s?tec|site\s?o\s?tek)\b/gi, to: 'Cytotec' },
    { re: /\b(?:meth\s?er\s?gene|meth\s?or\s?gene|meth\s?ergine)\b/gi, to: 'Methergine' },
    { re: /\b(?:hema\s?bait|hemma\s?bate|hema\s?bate)\b/gi, to: 'Hemabate' },
    { re: /\b(?:row\s?gam|rho\s?gam|ro\s?gam)\b/gi, to: 'RhoGAM' },
    { re: /\b(?:man\s?a\s?tol|mannitol|man\s?nih\s?tall)\b/gi, to: 'mannitol' },
    { re: /\b(?:lack\s?tulose|lactu\s?lose)\b/gi, to: 'lactulose' },
    { re: /\b(?:ock\s?tree\s?otide|octreo\s?tide)\b/gi, to: 'octreotide' },
    { re: /\b(?:met\s?form\s?in|met\s?foreman)\b/gi, to: 'metformin' },
    { re: /\b(?:levo\s?thigh\s?roxine|levothy\s?roxine)\b/gi, to: 'levothyroxine' },

    /* ---------- rhythms / vital-sign findings ---------- */
    { re: /\b(?:tacky\s?cardia|tacky\s?cardio|tack\s?a\s?cardia|taco\s?cardia)\b/gi, to: 'tachycardia' },
    { re: /\b(?:brady\s?cardia|braid\s?he\s?cardia|brady\s?cardio|brad\s?e\s?cardia)\b/gi, to: 'bradycardia' },
    { re: /\b(?:tacky\s?nea|tack\s?ip\s?nea|tachy\s?p\s?nea|tacky\s?p\s?nia)\b/gi, to: 'tachypnea' },
    { re: /\b(?:brady\s?nea|brady\s?p\s?nea)\b/gi, to: 'bradypnea' },
    { re: /\b(?:hypo\s?tension|high\s?po\s?tension|hi\s?po\s?tension)\b/gi, to: 'hypotension' },
    { re: /\b(?:hyper\s?tension|hi\s?per\s?tension)\b/gi, to: 'hypertension' },
    { re: /\b(?:hypo\s?glycemia|hypo\s?gly\s?see\s?mia)\b/gi, to: 'hypoglycemia' },
    { re: /\b(?:hyper\s?glycemia|hyper\s?gly\s?see\s?mia)\b/gi, to: 'hyperglycemia' },
    { re: /\b(?:hypo\s?xia|hi\s?pox\s?ia)\b/gi, to: 'hypoxia' },
    { re: /\b(?:hypo\s?ox\s?emia|hypox\s?emia)\b/gi, to: 'hypoxemia' },
    { re: /\b(?:hypo\s?volemic|hi\s?po\s?volemic)\b/gi, to: 'hypovolemic' },
    { re: /\b(?:hyper\s?kalemia|hi\s?per\s?kaylemia)\b/gi, to: 'hyperkalemia' },
    { re: /\b(?:hypo\s?kalemia|hi\s?po\s?kaylemia)\b/gi, to: 'hypokalemia' },
    { re: /\b(?:a\s?fib|ay\s?fib|afib)\b/gi, to: 'atrial fibrillation' },
    { re: /\b(?:v\s?tach|vee\s?tack|v\s?tack)\b/gi, to: 'ventricular tachycardia' },
    { re: /\b(?:v\s?fib|vee\s?fib)\b/gi, to: 'ventricular fibrillation' },
    { re: /\b(?:p\s?v\s?c(?:s)?|pee\s?vee\s?see(?:s)?)\b/gi, to: 'PVCs' },
    { re: /\b(?:die\s?a\s?for\s?etic|dia\s?four\s?etic|diapho\s?retic)\b/gi, to: 'diaphoretic' },
    { re: /\b(?:die\s?uresis|dye\s?uresis)\b/gi, to: 'diuresis' },
    { re: /\b(?:cap\s?a\s?fill|cap\s?refill|capillary\s?re\s?fill)\b/gi, to: 'capillary refill' },
    { re: /\b(?:oss?\s?cultate|os\s?cultate|auscul\s?tate)\b/gi, to: 'auscultate' },
    { re: /\b(?:rails|rayls)\b/gi, to: 'rales' },
    { re: /\b(?:ronk\s?eye|ron\s?kai|rhonci)\b/gi, to: 'rhonchi' },
    { re: /\b(?:strider|stry\s?door)\b/gi, to: 'stridor' },
    { re: /\b(?:trend\s?elen\s?burg|trendel\s?enberg)\b/gi, to: 'Trendelenburg' },
    { re: /\b(?:semi\s?fowlers?|semi\s?foulers?)\b/gi, to: "semi-Fowler's" },

    /* ---------- OB / peds vocabulary ---------- */
    { re: /\b(?:pre\s?e?\s?clamp\s?sia|pre\s?clampsia|pre\s?eclampsia)\b/gi, to: 'preeclampsia' },
    { re: /\b(?:e\s?clamp\s?sia)\b/gi, to: 'eclampsia' },
    { re: /\b(?:post\s?partum|post\s?par\s?tum)\b/gi, to: 'postpartum' },
    { re: /\b(?:hem\s?ridge|hem\s?rage|hemor\s?age|hemmorage)\b/gi, to: 'hemorrhage' },
    { re: /\b(?:fun\s?dis|fun\s?dus|fund\s?us)\b/gi, to: 'fundus' },
    { re: /\b(?:bogy|boggie|bog\s?ee)\b/gi, to: 'boggy' },
    { re: /\b(?:low\s?key\s?a|low\s?kia|loki\s?a)\b/gi, to: 'lochia' },
    { re: /\b(?:mick\s?onium|me\s?cone\s?ium|meco\s?neum)\b/gi, to: 'meconium' },
    { re: /\b(?:d\s?cells|dee\s?cells|decels?)\b/gi, to: 'decelerations' },
    { re: /\b(?:a\s?cells|accels?)\b/gi, to: 'accelerations' },
    { re: /\b(?:if\s?ace\s?ment|e\s?face\s?ment)\b/gi, to: 'effacement' },
    { re: /\b(?:die\s?lation|dial\s?ation)\b/gi, to: 'dilation' },
    { re: /\b(?:oh\s?tony|you\s?tarine\s?a\s?tony|uterine\s?atony)\b/gi, to: 'uterine atony' },
    { re: /\b(?:kernick\s?terus|kern\s?icterus)\b/gi, to: 'kernicterus' },
    { re: /\b(?:in\s?tuss\s?us\s?ception|intussus\s?ception)\b/gi, to: 'intussusception' },
    { re: /\b(?:croup|kroop)\b/gi, to: 'croup' },
    { re: /\b(?:brawn\s?key\s?olitis|bronchi\s?olitis)\b/gi, to: 'bronchiolitis' },
    { re: /\b(?:r\s?s\s?v|are\s?ess\s?vee)\b/gi, to: 'RSV' },

    /* ---------- acronyms spoken letter-by-letter ---------- */
    { re: /\b(?:s\s?bar|as\s?bar|is\s?bar|ess\s?bar|es\s?bar|sea\s?bar|s\s?bahr)\b/gi, to: 'SBAR' },
    { re: /\b(?:a\s?b\s?g(?:s)?|ay\s?bee\s?gee(?:s)?)\b/gi, to: 'ABG' },
    { re: /\b(?:c\s?b\s?c|see\s?bee\s?see)\b/gi, to: 'CBC' },
    { re: /\b(?:b\s?m\s?p|bee\s?em\s?pee)\b/gi, to: 'BMP' },
    { re: /\b(?:e\s?k\s?g|ee\s?kay\s?gee|easy\s?kg)\b/gi, to: 'EKG' },
    { re: /\b(?:eye\s?see\s?pee|i\s?c\s?p)\b/gi, to: 'ICP' },
    { re: /\b(?:are\s?dz|a\s?r\s?d\s?s|ards)\b/gi, to: 'ARDS' },
    { re: /\b(?:dee\s?eye\s?see|d\s?i\s?c)\b/gi, to: 'DIC' },
    { re: /\b(?:gee\s?eye\s?bleed|g\s?i\s?bleed|gi\s?bleed)\b/gi, to: 'GI bleed' },
    { re: /\b(?:en\s?gee\s?tube|n\s?g\s?tube|ng\s?tube)\b/gi, to: 'NG tube' },
    { re: /\b(?:foal\s?ee|folly|fol\s?ey)\b/gi, to: 'Foley' },
    { re: /\b(?:s\s?p\s?o\s?two|spo\s?two|ess\s?pee\s?oh\s?two)\b/gi, to: 'SpO2' },
    { re: /\b(?:oh\s?two|o\s?two|owe\s?two)\b/gi, to: 'O2' },
    { re: /\b(?:eye\s?vee|i\s?v\s?(?=fluid|push|piggyback|access|site)|eye\s?v)\b/gi, to: 'IV' },
    { re: /\b(?:eye\s?em|i\s?m\s?(?=injection|shot))\b/gi, to: 'IM' },
    { re: /\b(?:sub\s?q|sub\s?cue|sub\s?queue|subq|sub\s?cutaneous)\b/gi, to: 'subcutaneous' },
    { re: /\b(?:pee\s?are\s?en|p\s?r\s?n|per\s?in)\b/gi, to: 'PRN' },
    { re: /\b(?:pee\s?oh|p\s?o\s?(?=meds|medication|dose))\b/gi, to: 'PO' },
    { re: /\b(?:en\s?pee\s?oh|n\s?p\s?o)\b/gi, to: 'NPO' },
    { re: /\b(?:dee\s?en\s?are|d\s?n\s?r)\b/gi, to: 'DNR' },
    { re: /\b(?:milly\s?grams?|milli\s?grams?|millie\s?grams?|mill\s?a\s?grams?)\b/gi, to: 'milligrams' },
    { re: /\b(?:mike\s?ro\s?grams?|micro\s?grams?|my\s?crow\s?grams?)\b/gi, to: 'micrograms' },
    { re: /\b(?:milly\s?liters?|milli\s?liters?|mill\s?a\s?liters?)\b/gi, to: 'milliliters' },
    { re: /\b(?:kilo\s?grams?|killa\s?grams?)\b/gi, to: 'kilograms' },
    { re: /\b(?:c\s?c(?:s)?)\b/g, to: 'mL' },

    /* ---------- "sat" -> "saturation"
       Only when the surrounding words make it a vitals reading; a bare
       /\bsat\b/ would wreck ordinary speech ("he sat up in bed").         */
    { re: /\bsats\b/gi, to: 'saturation' },
    { re: /\b(o2|oxygen)\s+sat\b/gi, to: '$1 saturation' },
    { re: /\bsat\s+(is|was|of|at|dropped|drop|reading|came)\b/gi, to: 'saturation $1' },

    /* ---------- misc clinical phrasing ---------- */
    { re: /\b(?:code\s?blue|code\s?blew)\b/gi, to: 'code blue' },
    { re: /\b(?:rapid\s?response|rapid\s?respond)\b/gi, to: 'rapid response' },
    { re: /\b(?:pry\s?ority|pri\s?ority)\b/gi, to: 'priority' },
    { re: /\b(?:pal\s?pate|pal\s?pait)\b/gi, to: 'palpate' },
    { re: /\b(?:tie\s?trate|ty\s?trate)\b/gi, to: 'titrate' },
    { re: /\b(?:bowl\s?us|bo\s?lus)\b/gi, to: 'bolus' },
    { re: /\b(?:piggy\s?back)\b/gi, to: 'piggyback' },
    { re: /\b(?:in\s?cent\s?ive\s?spirometer|incentive\s?spy\s?rometer)\b/gi, to: 'incentive spirometer' },
    { re: /\b(?:lay\s?tex)\b/gi, to: 'latex' },
    { re: /\b(?:sep\s?sis|sepp\s?sis)\b/gi, to: 'sepsis' },
    { re: /\b(?:sep\s?tic\s?shock)\b/gi, to: 'septic shock' },
    { re: /\b(?:per\s?fusion|pur\s?fusion)\b/gi, to: 'perfusion' },
    { re: /\b(?:lack\s?tate|lactic\s?acid)\b/gi, to: 'lactate' }
  ];

  /* -- spoken numbers -> numerals, when a numeral is clearly expected ----- */
  var NUMBER_WORDS = {
    zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
    fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };
  var NUMBER_SCALES = { hundred: 100, thousand: 1000 };

  var NUM_WORD_LIST = Object.keys(NUMBER_WORDS)
    .concat(Object.keys(NUMBER_SCALES))
    .concat(['and'])
    .sort(function (a, b) { return b.length - a.length; });
  var NUM_SEQ_RE = new RegExp(
    '\\b((?:' + NUM_WORD_LIST.join('|') + ')(?:[\\s-]+(?:' + NUM_WORD_LIST.join('|') + '))*)\\b',
    'gi'
  );
  /* a numeral is "expected" when the phrase is followed by a unit, or led in
     by a vitals/dose cue word */
  var NUM_AFTER_RE  = /^[\s,]*(over|percent|%|degrees?|milligrams?|mg|milliliters?|ml|micrograms?|mcg|kilograms?|kg|pounds?|lbs?|units?|liters?|beats?|breaths?|per|out\s+of|point|milliequivalents?|drops?)\b/i;
  var NUM_BEFORE_RE = /(blood\s+pressure|bp|heart\s+rate|hr|pulse|respiratory\s+rate|rr|respirations?|temperature|temp|saturation|sat|spo2|o2|pain|scale|weighs?|weight|dose|give|gave|administer|administered|infuse|rate\s+of|level\s+of|is|was|of|at|over|about|around)\s*$/i;

  function wordsToNumber(phrase) {
    var toks = String(phrase).toLowerCase().split(/[\s-]+/);
    var total = 0, cur = 0, saw = false, i;

    /* Clinicians say vitals the short way: "one twenty two" = 122,
       "one oh five" = 105, "two fifty" = 250, "one ten" = 110. Detect a
       leading 1-9 followed by a 10+ word / "oh" / "zero" with no explicit
       scale word, and treat that first digit as hundreds. */
    var hasScale = false;
    for (i = 0; i < toks.length; i++) {
      if (toks[i] === 'hundred' || toks[i] === 'thousand') { hasScale = true; break; }
    }
    if (!hasScale && toks.length >= 2) {
      var lead = NUMBER_WORDS[toks[0]];
      var second = toks[1];
      var secondVal = NUMBER_WORDS[second];
      var secondIsTens = (secondVal !== undefined && secondVal >= 10) || second === 'oh' || second === 'zero';
      if (lead !== undefined && lead >= 1 && lead <= 9 && secondIsTens) {
        var restVal = wordsToNumber(toks.slice(1).join(' '));
        if (restVal !== null && restVal < 100) return lead * 100 + restVal;
      }
    }

    for (i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (!t || t === 'and') continue;
      if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, t)) {
        cur += NUMBER_WORDS[t]; saw = true;
      } else if (t === 'hundred') {
        cur = (cur || 1) * 100; saw = true;
      } else if (t === 'thousand') {
        total += (cur || 1) * 1000; cur = 0; saw = true;
      } else {
        return null;
      }
    }
    if (!saw) return null;
    return total + cur;
  }

  function numeralizeSpokenNumbers(text) {
    var src = String(text);
    NUM_SEQ_RE.lastIndex = 0;
    return src.replace(NUM_SEQ_RE, function (match, seq, offset) {
      var before = src.slice(Math.max(0, offset - 40), offset);
      var after = src.slice(offset + match.length, offset + match.length + 20);
      if (!NUM_AFTER_RE.test(after) && !NUM_BEFORE_RE.test(before)) return match;
      var n = wordsToNumber(seq);
      if (n === null) return match;
      /* a lone "one"/"a" reads better left alone unless a unit follows */
      if (n <= 1 && !NUM_AFTER_RE.test(after)) return match;
      return String(n);
    });
  }

  /* "101 point four" -> "101.4"  (temps, O2 flow rates, lab values) */
  var DECIMAL_RE = /(\d+)\s+point\s+((?:zero|oh|one|two|three|four|five|six|seven|eight|nine|\d)(?:\s+(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|\d))*)/gi;
  function joinDecimals(text) {
    DECIMAL_RE.lastIndex = 0;
    return String(text).replace(DECIMAL_RE, function (m, whole, digits) {
      var parts = String(digits).toLowerCase().split(/\s+/);
      var out = '';
      for (var i = 0; i < parts.length; i++) {
        if (/^\d$/.test(parts[i])) { out += parts[i]; continue; }
        var v = NUMBER_WORDS[parts[i]];
        if (v === undefined || v > 9) return m;
        out += String(v);
      }
      return whole + '.' + out;
    });
  }

  /* ======================================================================
   * 4. TEXT PREP
   * ==================================================================== */

  function stripMarkdown(s) {
    return String(s)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s*/gm, '')
      /* A blockquote marker, but NEVER a comparison. "> 100 mL/hr" and ">= 95%"
         start a line constantly in hold parameters and goals, and stripping the
         ">" there makes the app speak the OPPOSITE of the order. The lookahead
         keeps any ">" that introduces a number (with or without "=" and spaces)
         so CLINICAL_PRE / SPEECH_EXPANSIONS can turn it into "greater than". */
      .replace(/^\s{0,3}>\s?(?![=\s]*\d)/gm, '')
      .replace(/^\s{0,3}[-*+]\s+/gm, '')
      .replace(/^\s{0,3}\d+\.\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1$2')
      .replace(/^\s*[-=_]{3,}\s*$/gm, ' ')
      .replace(/\|/g, ' ')
      .replace(/[*#`~]/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function applyRules(text, rules) {
    var out = String(text === null || text === undefined ? '' : text);
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (!r || !r.re) continue;
      try {
        r.re.lastIndex = 0;
        out = out.replace(r.re, r.to);
      } catch (e) { /* one bad rule must never break speech */ }
    }
    return out;
  }

  /** Markdown-stripped, abbreviation-expanded text ready for the synth. */
  function normalizeForSpeech(text) {
    var t = stripMarkdown(str(text));
    if (!t) return '';
    t = applyRules(t, SPEECH_EXPANSIONS);
    return t.replace(/\s{2,}/g, ' ').trim();
  }

  /** Public: fix common speech-engine manglings of clinical vocabulary. */
  function correctMedicalTerms(text) {
    var t = str(text);
    if (!t) return '';
    t = applyRules(t, MEDICAL_CORRECTIONS);
    t = numeralizeSpokenNumbers(t);
    t = joinDecimals(t);
    return t.replace(/\s{2,}/g, ' ').trim();
  }

  /** Split into <=maxLen chunks on sentence boundaries (Chrome cuts long ones). */
  function chunkText(text, maxLen) {
    maxLen = maxLen || 200;
    var t = str(text).trim();
    if (!t) return [];
    if (t.length <= maxLen) return [t];

    var sentences = t.match(/[^.!?…]+[.!?…]+[\s]*|[^.!?…]+$/g) || [t];
    var pieces = [];
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i].trim();
      if (!s) continue;
      if (s.length <= maxLen) { pieces.push(s); continue; }
      /* over-long sentence: break at commas, then at spaces.
         (No lookbehind - older Safari does not support it.) */
      var sub = s.match(/[^,;:]+[,;:]*\s*/g) || [s];
      for (var j = 0; j < sub.length; j++) {
        var p = sub[j].trim();
        while (p.length > maxLen) {
          var cut = p.lastIndexOf(' ', maxLen);
          if (cut < 40) cut = maxLen;
          pieces.push(p.slice(0, cut).trim());
          p = p.slice(cut).trim();
        }
        if (p) pieces.push(p);
      }
    }
    /* re-pack small pieces so we do not over-fragment */
    var out = [], cur = '';
    for (var k = 0; k < pieces.length; k++) {
      if (!cur) { cur = pieces[k]; }
      else if ((cur + ' ' + pieces[k]).length <= maxLen) { cur = cur + ' ' + pieces[k]; }
      else { out.push(cur); cur = pieces[k]; }
    }
    if (cur) out.push(cur);
    return out;
  }

  /* ======================================================================
   * 5. VOICE PROFILES
   * ==================================================================== */

  var VOICE_PROFILES = {
    patient:    { rate: 0.95, pitch: 1.00, label: 'Patient',    hints: ['samantha', 'jenny', 'aria', 'zira', 'karen', 'moira', 'female'] },
    nurse:      { rate: 1.00, pitch: 1.05, label: 'Nurse',      hints: ['samantha', 'aria', 'jenny', 'zira', 'female'] },
    instructor: { rate: 0.88, pitch: 0.98, label: 'Instructor', hints: ['daniel', 'alex', 'guy', 'david', 'fred', 'male'] },
    child:      { rate: 1.05, pitch: 1.60, label: 'Child',      hints: ['junior', 'kids', 'child', 'shelley', 'samantha', 'female'] },
    family:     { rate: 0.97, pitch: 0.92, label: 'Family',     hints: ['tom', 'daniel', 'alex', 'david', 'male'] }
  };
  var DEFAULT_PROFILE = 'nurse';

  /* ======================================================================
   * 6. FEATURE DETECTION
   * ==================================================================== */

  var SR_CTOR = (typeof window !== 'undefined')
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null;

  function getSynth() {
    try { return window.speechSynthesis || null; } catch (e) { return null; }
  }

  function getUtteranceCtor() {
    try { return window.SpeechSynthesisUtterance || null; } catch (e) { return null; }
  }

  /* Always go through window.navigator - a bare `navigator` can resolve to a
     different object inside embedded/test runtimes. */
  function nav() {
    try { return window.navigator || null; } catch (e) { return null; }
  }

  function hasMicApi() {
    var n = nav();
    return !!(n && n.mediaDevices && isFn(n.mediaDevices.getUserMedia));
  }

  function isSecure() {
    try {
      if (window.isSecureContext === true) return true;
      var h = location.hostname;
      return location.protocol === 'https:' || h === 'localhost' || h === '127.0.0.1' || location.protocol === 'file:';
    } catch (e) { return false; }
  }

  /**
   * isSupported() -> {stt, tts}
   *
   * `tts` must answer "can this device speak?", not "does this device have the
   * Web Speech API?". Those stopped being the same question when the studio
   * engine landed: a browser with no speechSynthesis but a working ElevenLabs
   * voice DOES produce audio. Every UI gate reads this flag - SpeakButton,
   * VoiceSettings, the sim's speakTurn and hint speech, the voice toggle - so
   * reporting false there told a paying student "voice unavailable" while the
   * voice they pay for worked fine.
   *
   * premiumReasonFor('') returns '' only when a studio clip could actually be
   * produced right now, and it is synchronous and re-evaluated per call, so
   * this flips on by itself the moment the tier resolves.
   */
  function isSupported() {
    var browserTts = !!(getSynth() && getUtteranceCtor());
    var studioTts = false;
    try { studioTts = (premiumReasonFor('') === ''); } catch (e) { studioTts = false; }
    return { stt: !!SR_CTOR, tts: browserTts || studioTts };
  }

  function browserName() {
    var ua = '';
    try { var n = nav(); ua = (n && n.userAgent) || ''; } catch (e) { }
    if (/Edg\//.test(ua)) return 'Edge';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/CriOS/.test(ua)) return 'Chrome on iOS';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'this browser';
  }

  function isIOS() {
    var ua = '';
    try { var n = nav(); ua = (n && n.userAgent) || ''; } catch (e) { }
    return /iPad|iPhone|iPod/.test(ua) ||
      (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
  }

  /** Honest, human-readable explanation of what will not work here. */
  function unsupportedReason() {
    if (SR_CTOR) return '';
    var b = browserName();
    if (b === 'Firefox') {
      return 'Firefox does not ship the Web Speech recognition API, so the microphone cannot be used here. Type your answer instead, or use Chrome, Edge, or Safari.';
    }
    if (b === 'Safari' || b === 'Chrome on iOS') {
      return 'Speech recognition on this browser is limited and may be disabled. If the mic does not respond, type your answer instead or try desktop Chrome.';
    }
    if (!isSecure()) {
      return 'Speech recognition needs a secure (https) page. Open the site over https and try again.';
    }
    return 'Speech recognition is not available in ' + b + '. Type your answer instead.';
  }

  /* ======================================================================
   * 7. PREFERENCES  (localStorage: mm_voice_prefs)
   * ==================================================================== */

  var PREFS_KEY = 'mm_voice_prefs';
  var DEFAULT_PREFS = {
    enabled: true,      /* master mute for TTS                        */
    rate: 1,            /* global rate multiplier applied to profiles  */
    voiceName: '',      /* preferred SpeechSynthesisVoice.name         */
    autoSpeak: false,   /* auto-read new content aloud                 */
    /* Opt OUT of the ElevenLabs studio voices, for a student on a paid plan who
       prefers the device voice (or is on a metered connection - an mp3 is a few
       tens of KB where the browser synth is zero bytes). Default on; only
       consulted for tiers that have premium voices at all, so flipping it does
       nothing at all on Free/Plus. */
    premiumVoice: true
  };
  var _prefs = null;
  var _prefsListeners = [];

  function readPrefs() {
    var p = {
      enabled: DEFAULT_PREFS.enabled, rate: DEFAULT_PREFS.rate,
      voiceName: DEFAULT_PREFS.voiceName, autoSpeak: DEFAULT_PREFS.autoSpeak,
      premiumVoice: DEFAULT_PREFS.premiumVoice
    };
    try {
      var raw = window.localStorage.getItem(PREFS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          if (typeof o.enabled === 'boolean') p.enabled = o.enabled;
          if (typeof o.autoSpeak === 'boolean') p.autoSpeak = o.autoSpeak;
          if (typeof o.voiceName === 'string') p.voiceName = o.voiceName;
          if (typeof o.premiumVoice === 'boolean') p.premiumVoice = o.premiumVoice;
          if (o.rate !== undefined) p.rate = clamp(o.rate, 0.5, 2);
        }
      }
    } catch (e) { /* private mode / disabled storage: use defaults */ }
    return p;
  }

  function getPrefs() {
    if (!_prefs) _prefs = readPrefs();
    return {
      enabled: _prefs.enabled, rate: _prefs.rate,
      voiceName: _prefs.voiceName, autoSpeak: _prefs.autoSpeak,
      premiumVoice: _prefs.premiumVoice
    };
  }

  function setPrefs(patch) {
    var cur = getPrefs();
    patch = patch || {};
    if (typeof patch.enabled === 'boolean') cur.enabled = patch.enabled;
    if (typeof patch.autoSpeak === 'boolean') cur.autoSpeak = patch.autoSpeak;
    if (typeof patch.voiceName === 'string') cur.voiceName = patch.voiceName;
    if (typeof patch.premiumVoice === 'boolean') cur.premiumVoice = patch.premiumVoice;
    if (patch.rate !== undefined) cur.rate = clamp(patch.rate, 0.5, 2);
    _prefs = cur;
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(cur)); } catch (e) { }
    for (var i = 0; i < _prefsListeners.length; i++) callSafe(_prefsListeners[i], getPrefs());
    return getPrefs();
  }

  function onPrefsChange(fn) {
    if (!isFn(fn)) return function () { };
    _prefsListeners.push(fn);
    return function () {
      var i = _prefsListeners.indexOf(fn);
      if (i >= 0) _prefsListeners.splice(i, 1);
    };
  }

  /* ======================================================================
   * 8. TTS ENGINE
   * ==================================================================== */

  var _voices = [];
  var _voicesResolved = false;
  var _voiceWaiters = [];
  var _voicesTimer = null;
  var _voicesPoll = null;

  function harvestVoices() {
    var synth = getSynth();
    if (!synth) return [];
    var v = [];
    try { v = synth.getVoices() || []; } catch (e) { v = []; }
    if (v && v.length) _voices = v;
    return _voices;
  }

  function resolveVoices() {
    _voicesResolved = true;
    if (_voicesTimer) { clearTimeout(_voicesTimer); _voicesTimer = null; }
    if (_voicesPoll) { clearInterval(_voicesPoll); _voicesPoll = null; }
    var list = _voiceWaiters.slice();
    _voiceWaiters.length = 0;
    for (var i = 0; i < list.length; i++) callSafe(list[i], _voices);
  }

  (function initVoices() {
    var synth = getSynth();
    if (!synth) { _voicesResolved = true; return; }
    harvestVoices();
    if (_voices.length) { _voicesResolved = true; }
    /* `voiceschanged` fires late (or never) depending on the browser */
    try {
      if (isFn(synth.addEventListener)) {
        synth.addEventListener('voiceschanged', function () {
          harvestVoices();
          if (_voices.length && !_voicesResolved) resolveVoices();
        });
      } else {
        synth.onvoiceschanged = function () {
          harvestVoices();
          if (_voices.length && !_voicesResolved) resolveVoices();
        };
      }
    } catch (e) { }
  })();

  /** Resolves with the voice list (possibly empty) - never rejects, never hangs. */
  function whenVoicesReady() {
    return new Promise(function (resolve) {
      if (_voicesResolved) { resolve(harvestVoices()); return; }
      _voiceWaiters.push(resolve);
      if (!_voicesPoll) {
        _voicesPoll = setInterval(function () {
          harvestVoices();
          if (_voices.length) resolveVoices();
        }, 200);
      }
      if (!_voicesTimer) {
        /* hard cap: never block speech on a voice list that never arrives */
        _voicesTimer = setTimeout(function () { harvestVoices(); resolveVoices(); }, 2000);
      }
    });
  }

  function getVoices() { return harvestVoices().slice(); }

  function englishFirst(list) {
    var en = [], other = [];
    for (var i = 0; i < list.length; i++) {
      var lang = str(list[i].lang).toLowerCase();
      if (lang.indexOf('en') === 0) en.push(list[i]); else other.push(list[i]);
    }
    return en.length ? en : other;
  }

  function findVoiceByName(name) {
    if (!name) return null;
    var list = harvestVoices();
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === name) return list[i];
    }
    return null;
  }

  /**
   * Voice choice order:
   *   explicit opts.voiceName  >  profile name hints  >  user pref  >  best English
   */
  function pickVoice(profile, explicitName, prefName) {
    var all = harvestVoices();
    if (!all.length) return null;

    var exact = findVoiceByName(explicitName);
    if (exact) return exact;

    var pool = englishFirst(all);

    if (profile && profile.hints) {
      for (var h = 0; h < profile.hints.length; h++) {
        var hint = profile.hints[h];
        for (var i = 0; i < pool.length; i++) {
          if (str(pool[i].name).toLowerCase().indexOf(hint) >= 0) return pool[i];
        }
      }
    }

    var pref = findVoiceByName(prefName);
    if (pref) return pref;

    for (var j = 0; j < pool.length; j++) {
      if (str(pool[j].lang).toLowerCase().indexOf('en-us') === 0 && pool[j].localService) return pool[j];
    }
    for (var k = 0; k < pool.length; k++) {
      if (str(pool[k].lang).toLowerCase().indexOf('en-us') === 0) return pool[k];
    }
    return pool[0] || null;
  }

  /* --- speaking state --- */
  var _speakToken = 0;
  var _keepalive = null;
  var _speaking = false;
  var _speakListeners = [];

  function emitSpeakState() {
    for (var i = 0; i < _speakListeners.length; i++) callSafe(_speakListeners[i], _speaking);
  }
  function onSpeakingChange(fn) {
    if (!isFn(fn)) return function () { };
    _speakListeners.push(fn);
    return function () {
      var i = _speakListeners.indexOf(fn);
      if (i >= 0) _speakListeners.splice(i, 1);
    };
  }

  /* Chrome stops synthesising after ~15s. The documented workaround is to
     nudge resume() on a timer for the whole time we are speaking. */
  function startKeepalive() {
    stopKeepalive();
    var synth = getSynth();
    if (!synth) return;
    _keepalive = setInterval(function () {
      var s = getSynth();
      if (!s) { stopKeepalive(); return; }
      if (!s.speaking && !s.pending) { stopKeepalive(); return; }
      try { s.pause(); s.resume(); } catch (e) {
        try { s.resume(); } catch (e2) { }
      }
    }, 9000);
  }
  function stopKeepalive() {
    if (_keepalive) { clearInterval(_keepalive); _keepalive = null; }
  }

  function isSpeaking() {
    /* An ElevenLabs clip plays through an <audio> element, which the synth knows
       nothing about, so the synth can be idle while the app is very much
       speaking. Ask the audio element first. */
    if (premiumAudioBusy()) return true;
    var synth = getSynth();
    if (!synth) return _speaking;
    try { return !!(synth.speaking || synth.pending) && _speaking; } catch (e) { return _speaking; }
  }

  function stopSpeaking() {
    _speakToken++;
    stopKeepalive();
    /* Both engines, always, in this order. Bumping the token first means any
       in-flight ElevenLabs fetch that lands after this point sees a stale token
       and drops its audio on the floor instead of talking over the next line. */
    stopPremiumAudio();
    var synth = getSynth();
    if (synth) { try { synth.cancel(); } catch (e) { } }
    if (_speaking) { _speaking = false; emitSpeakState(); }
  }

  /**
   * Unlock audio on iOS. MUST be called from inside a user gesture handler.
   * Cheap and idempotent; safe to call on every button press.
   */
  var _primed = false;
  function prime() {
    if (_primed) return;
    /* TWO engines to unlock, and iOS locks them separately.
       1. speechSynthesis, via a silent utterance (the original behaviour).
       2. the ONE <audio> element the ElevenLabs path reuses - see getAudioEl().
          Touching it inside the gesture is what stops every studio clip on
          iPhone from being blocked and silently falling back to the browser
          voice. Best-effort: if it does not take, the fallback still speaks. */
    try {
      var el = getAudioEl();
      if (el) {
        el.muted = true;
        if (typeof el.load === 'function') el.load();
        var pr = el.play ? el.play() : null;
        if (pr && typeof pr['catch'] === 'function') pr['catch'](function () { /* expected with no src */ });
        try { el.pause(); } catch (e2) { /* noop */ }
        el.muted = false;
      }
    } catch (e3) { /* noop */ }

    var synth = getSynth();
    var Utt = getUtteranceCtor();
    if (!synth || !Utt) { _primed = true; return; }
    try {
      var u = new Utt(' ');
      u.volume = 0;
      u.rate = 2;
      synth.speak(u);
      _primed = true;
    } catch (e) { _primed = true; }
  }

  /* ======================================================================
   * 8b. CLINICAL TEXT NORMALIZER FOR STUDIO TTS
   * ----------------------------------------------------------------------
   * WHY THIS EXISTS, in one paragraph:
   *
   * ElevenLabs Flash v2.5 turns its own number normalization OFF to hit ~75ms,
   * and ElevenLabs' documented advice is to normalize the text yourself before
   * sending. This app is nothing BUT numbers - "BP 92/58", "0.25 mg", "125
   * mL/hr", "101.6 F", "1:1000". A raw model reads "92/58" as a date, "0.25" as
   * "point twenty five" and "1:1000" as a clock time. That is the difference
   * between a nurse and a screen reader, and it is exactly the content a
   * student is trying to memorise, so it has to be right.
   *
   * normalizeForSpeech() (section 4) is NOT enough on its own: it expands
   * abbreviations but leaves every numeral as a numeral, because the browser
   * synth reads numerals correctly by itself. This pipeline adds the number
   * work on top of it, and is used ONLY on the ElevenLabs path.
   *
   * THE PIPELINE, in order (each step assumes the one before it ran):
   *   1. stripMarkdown            shared with normalizeForSpeech
   *   2. thousands separators     10,000 -> 10000, so later rules see one number
   *   3. CLINICAL_PRE             everything where the DIGITS carry meaning that
   *                               is lost once they are words: dates, clock
   *                               times, temperatures, BP fractions, pain
   *                               scores, ratios, lab shorthand, ranges
   *   4. expandUnits()            number + unit together, so "1 mg/mL" can be
   *                               singular and "2 mg/mL" plural
   *   5. SPEECH_EXPANSIONS        the existing shared abbreviation table
   *   6. CLINICAL_POST            ordinals and leftovers
   *   7. numeralsToWords()        every digit that survived becomes words
   *   8. tidy                     punctuation spacing, double spaces
   *
   * Order is load-bearing. Units run BEFORE the generic table so the generic
   * "mg -> milligrams" rule only ever sees a bare unit with no quantity, and
   * numbers run LAST so no earlier rule has to cope with words where it
   * expected digits.
   * ==================================================================== */

  var ONES_W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS_W = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  var MONTHS_W = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var ORDINALS_W = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
    'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth',
    'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty first', 'twenty second',
    'twenty third', 'twenty fourth', 'twenty fifth', 'twenty sixth', 'twenty seventh',
    'twenty eighth', 'twenty ninth', 'thirtieth', 'thirty first'];

  /* No "and" ("one hundred twenty five", not "one hundred and twenty five") -
     US clinical speech, and it is what every vitals string in this app reads
     like when a nurse says it out loud. */
  function intWords(n) {
    var v = Math.floor(Math.abs(Number(n)));
    if (!isFinite(v)) return '';
    if (v < 20) return ONES_W[v];
    if (v < 100) {
      var t = TENS_W[Math.floor(v / 10)], r = v % 10;
      return r ? t + ' ' + ONES_W[r] : t;
    }
    if (v < 1000) {
      var h = ONES_W[Math.floor(v / 100)] + ' hundred', r2 = v % 100;
      return r2 ? h + ' ' + intWords(r2) : h;
    }
    if (v < 1000000) {
      var k = intWords(Math.floor(v / 1000)) + ' thousand', r3 = v % 1000;
      return r3 ? k + ' ' + intWords(r3) : k;
    }
    if (v < 1000000000) {
      var m = intWords(Math.floor(v / 1000000)) + ' million', r4 = v % 1000000;
      return r4 ? m + ' ' + intWords(r4) : m;
    }
    /* Past a billion this is not a quantity: it is an MRN, an accession number
       or a phone number, and a human reads those digit by digit. Returning
       String(v) here let raw digits reach the model, which reads them as a
       screen reader would (or not at all). */
    var raw = String(n).replace(/[^0-9]/g, '');
    return digitWords(raw || String(v));
  }

  /* Decimals are spoken digit by digit after the point - "zero point two five",
     never "zero point twenty five", because 0.25 mg and 0.025 mg differ by a
     factor of ten and a misheard dose is the worst thing this file could do. */
  function digitWords(s) {
    var out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      if (c >= '0' && c <= '9') out.push(ONES_W[Number(c)]);
    }
    return out.join(' ');
  }

  function numberWords(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    var neg = false;
    if (s.charAt(0) === '-') { neg = true; s = s.slice(1); }
    var dot = s.indexOf('.');
    var out;
    if (dot === -1) {
      out = intWords(s);
    } else {
      var ip = s.slice(0, dot), fp = s.slice(dot + 1);
      out = (ip === '' ? 'zero' : intWords(ip)) + ' point ' + digitWords(fp);
    }
    return neg ? 'negative ' + out : out;
  }

  /* Temperatures are the one place nurses do NOT say the number the way the
     number is written: 101.6 is "one oh one point six", not "one hundred one
     point six". Only 101-109 get this treatment; 100 is "one hundred" and
     everything under 100 is ordinary. */
  function tempIntWords(n) {
    if (n > 100 && n < 110) return 'one oh ' + ONES_W[n - 100];
    return intWords(n);
  }

  function tempWords(m, num, unit) {
    var v = parseFloat(num);
    if (!isFinite(v)) return m;
    /* Plausibility gate. Without it "12 F" in some unrelated sentence, or a
       stray "5 C", becomes "twelve degrees Fahrenheit" in the middle of a
       handoff report. Body temperature only. */
    if (unit === 'F' && !(v >= 89 && v <= 112)) return m;
    if (unit === 'C' && !(v >= 30 && v <= 45)) return m;
    var s = String(num), dot = s.indexOf('.'), words;
    if (dot === -1) words = tempIntWords(parseInt(s, 10));
    else words = tempIntWords(parseInt(s.slice(0, dot), 10)) + ' point ' + digitWords(s.slice(dot + 1));
    return words + ' degrees ' + (unit === 'F' ? 'Fahrenheit' : 'Celsius');
  }

  function yearWords(y) {
    var n = parseInt(y, 10);
    if (!isFinite(n)) return String(y);
    if (n >= 2000 && n <= 2009) return 'two thousand' + (n % 10 ? ' ' + ONES_W[n % 10] : '');
    var hi = Math.floor(n / 100), lo = n % 100;
    if (lo === 0) return intWords(hi) + ' hundred';
    if (lo < 10) return intWords(hi) + ' oh ' + ONES_W[lo];
    return intWords(hi) + ' ' + intWords(lo);
  }

  function dateWords(m, mo, da, yr) {
    var mi = parseInt(mo, 10), di = parseInt(da, 10);
    if (!(mi >= 1 && mi <= 12) || !(di >= 1 && di <= 31)) return m;
    return MONTHS_W[mi] + ' ' + (ORDINALS_W[di] || intWords(di)) + ', ' + yearWords(yr);
  }

  function clockWords(m, h, mi) {
    var H = parseInt(h, 10), M = parseInt(mi, 10);
    if (!isFinite(H) || !isFinite(M)) return m;
    var hw = intWords(H);
    if (M === 0) return hw + ' o clock';
    if (M < 10) return hw + ' oh ' + ONES_W[M];
    return hw + ' ' + intWords(M);
  }

  /* "given today 0900" -> "given today oh nine hundred". Only fires after a
     time word, because a bare 4-digit number is far more often a lab value or a
     volume than a military time. */
  function militaryWords(m, lead, hh, mm) {
    var H = parseInt(hh, 10), M = parseInt(mm, 10);
    if (!isFinite(H) || !isFinite(M)) return m;
    var hw = (H < 10) ? 'oh ' + ONES_W[H] : intWords(H);
    var mw = (M === 0) ? 'hundred' : (M < 10 ? 'oh ' + ONES_W[M] : intWords(M));
    return lead + ' ' + hw + ' ' + mw;
  }

  function overWords(m, a, b) { return intWords(a) + ' over ' + intWords(b); }
  function painWords(m, a) { return intWords(a) + ' out of ten'; }

  /* ---------------------------------------------------------------- units ---
   * [pattern source, singular, plural, needsNumber]
   *
   * COMPOUNDS FIRST - regex alternation takes the first match, so "mg/mL" has to
   * be listed before "mg" or "1 mg/mL" reads as "one milligram slash mL".
   *
   * needsNumber = true means the token is too short or too ambiguous to expand
   * on its own: a bare "g" or "L" or "cm" is left exactly as written unless a
   * quantity is sitting in front of it.
   *
   * MATCHING IS CASE SENSITIVE, on purpose. "Mg" is magnesium and "mg" is
   * milligrams, and a case-insensitive table turns "Mg 2.0" into "milligrams
   * two point zero" in the middle of an eclampsia scenario.
   * ------------------------------------------------------------------------ */
  var TTS_UNITS = [
    ['mL\\s*\\/\\s*min\\s*\\/\\s*1\\.73\\s*m2', 'milliliter per minute per one point seven three square meters', 'milliliters per minute per one point seven three square meters', false],
    ['mcg\\s*\\/\\s*kg\\s*\\/\\s*min', 'microgram per kilogram per minute', 'micrograms per kilogram per minute', false],
    ['mcg\\s*\\/\\s*kg\\s*\\/\\s*h(?:rs?|ours?)?', 'microgram per kilogram per hour', 'micrograms per kilogram per hour', false],
    ['mg\\s*\\/\\s*kg\\s*\\/\\s*day', 'milligram per kilogram per day', 'milligrams per kilogram per day', false],
    ['mg\\s*\\/\\s*kg\\s*\\/\\s*dose', 'milligram per kilogram per dose', 'milligrams per kilogram per dose', false],
    ['mg\\s*\\/\\s*kg', 'milligram per kilogram', 'milligrams per kilogram', false],
    ['mL\\s*\\/\\s*kg\\s*\\/\\s*h(?:rs?|ours?)?', 'milliliter per kilogram per hour', 'milliliters per kilogram per hour', false],
    ['mL\\s*\\/\\s*kg', 'milliliter per kilogram', 'milliliters per kilogram', false],
    ['mg\\s*\\/\\s*mL', 'milligram per milliliter', 'milligrams per milliliter', false],
    ['mg\\s*\\/\\s*dL', 'milligram per deciliter', 'milligrams per deciliter', false],
    ['g\\s*\\/\\s*dL', 'gram per deciliter', 'grams per deciliter', false],
    ['mEq\\s*\\/\\s*L', 'milliequivalent per liter', 'milliequivalents per liter', false],
    /* mmol BEFORE mm, or the shorter entry wins the alternation and "2 mmol/L"
       reads as "two millimeter ol slash L". */
    ['mmol\\s*\\/\\s*L', 'millimole per liter', 'millimoles per liter', false],
    ['mL\\s*\\/\\s*h(?:rs?|ours?)?', 'milliliter per hour', 'milliliters per hour', false],
    ['mL\\s*\\/\\s*min', 'milliliter per minute', 'milliliters per minute', false],
    ['L\\s*\\/\\s*min', 'liter per minute', 'liters per minute', false],
    ['gtts?\\s*\\/\\s*min', 'drop per minute', 'drops per minute', false],
    ['[Uu]nits?\\s*\\/\\s*h(?:rs?|ours?)?', 'unit per hour', 'units per hour', false],
    ['[Uu]nits?\\s*\\/\\s*kg', 'unit per kilogram', 'units per kilogram', false],
    ['mcg\\s*\\/\\s*min', 'microgram per minute', 'micrograms per minute', false],
    ['mcg\\s*\\/\\s*h(?:rs?|ours?)?', 'microgram per hour', 'micrograms per hour', false],
    ['mmHg', 'millimeter of mercury', 'millimeters of mercury', false],
    ['mmol', 'millimole', 'millimoles', false],
    ['mcg', 'microgram', 'micrograms', false],
    ['mg', 'milligram', 'milligrams', false],
    ['mL', 'milliliter', 'milliliters', false],
    ['ml', 'milliliter', 'milliliters', false],
    ['mEq', 'milliequivalent', 'milliequivalents', false],
    ['kg', 'kilogram', 'kilograms', false],
    ['dL', 'deciliter', 'deciliters', false],
    ['gtts?', 'drop', 'drops', false],
    ['lbs?', 'pound', 'pounds', true],
    ['cm', 'centimeter', 'centimeters', true],
    ['mm', 'millimeter', 'millimeters', true],
    ['[Uu]nits?', 'unit', 'units', true],
    ['g', 'gram', 'grams', true],
    ['L', 'liter', 'liters', true]
  ];

  var UNIT_ENTRIES = (function () {
    var out = [], i;
    for (i = 0; i < TTS_UNITS.length; i++) {
      out.push({
        re: new RegExp('^(?:' + TTS_UNITS[i][0] + ')$'),
        one: TTS_UNITS[i][1],
        many: TTS_UNITS[i][2],
        needsNum: TTS_UNITS[i][3] === true
      });
    }
    return out;
  })();

  /* Two alternations, deliberately:
       A)  <number><optional space><unit>     1mg, 1 mg, 0.5mL, 110mmHg
       B)  <word boundary><unit>              a bare "mg" with no number
     A single `\b` between the number and the unit CANNOT work: there is no
     word boundary between "1" and "mg" (both are word characters), so "1mg"
     matched neither branch and came out as "onemg". Real MARs are written
     without the space constantly - the Eric Doe case says "Dilaudid 1mg
     (2mg/mL)" - so this is the common form, not the edge case.
     Branch B keeps its `\b` so "gmg" or "xmL" are never mistaken for units. */
  var UNIT_RE = (function () {
    var src = [], i;
    for (i = 0; i < TTS_UNITS.length; i++) src.push(TTS_UNITS[i][0]);
    var u = src.join('|');
    return new RegExp(
      '(\\d+(?:\\.\\d+)?)\\s*(' + u + ')\\b' +   // 1: number   2: unit
      '|\\b(' + u + ')\\b',                       // 3: bare unit
      'g'
    );
  })();

  function unitEntryFor(tok) {
    for (var i = 0; i < UNIT_ENTRIES.length; i++) {
      UNIT_ENTRIES[i].re.lastIndex = 0;
      if (UNIT_ENTRIES[i].re.test(tok)) return UNIT_ENTRIES[i];
    }
    return null;
  }

  /** Quantity-aware unit expansion: "1 mg/mL" is singular, "2 mg/mL" is not. */
  function expandUnits(text) {
    return String(text == null ? '' : text).replace(UNIT_RE,
      function (m, num, tokWithNum, bareTok) {
        var tok = (tokWithNum !== undefined && tokWithNum !== null && tokWithNum !== '')
          ? tokWithNum : bareTok;
        var e = unitEntryFor(tok);
        if (!e) return m;
        var hasNum = (num !== undefined && num !== null && num !== '');
        if (!hasNum) return e.needsNum ? m : e.many;
        /* "1" is the only singular; "1.0" and "0.5" both take the plural, which
           is what a nurse says out loud ("zero point five milliliters"). */
        return numberWords(num) + ' ' + (num === '1' ? e.one : e.many);
      });
  }

  /* ---- step 3: rules that must see the digits ---------------------------- */
  var CLINICAL_PRE = [
    /* The micro sign, in both of its Unicode spellings (U+00B5 MICRO SIGN and
       U+03BC GREEK SMALL LETTER MU). Folded to "mcg" first so the whole unit
       table below - including mcg/kg/min - covers it for free. */
    { re: /[µμ]\s?g\b/g, to: 'mcg' },
    /* dates BEFORE the blood-pressure fraction, or 06/26/1954 becomes
       "six over twenty six over 1954" */
    { re: /\b(0?[1-9]|1[0-2])\s*\/\s*(0?[1-9]|[12]\d|3[01])\s*\/\s*((?:19|20)\d{2})\b/g, to: dateWords },
    /* clock times BEFORE ratios, or 09:45 becomes "nine to forty five" */
    { re: /\b([01]?\d|2[0-3]):([0-5]\d)\b/g, to: clockWords },
    /* military time, only after a time word */
    { re: /\b(at|by|today|tonight|yesterday|since|given|started|charted|around|until|from|about)\s+([01]\d|2[0-3])([0-5]\d)\b/gi, to: militaryWords },
    /* frequency ranges the shared table does not cover: q4-6h. MUST come before
       the generic range rule below, or "q4-6h" becomes "q4 to 6h" and the
       shared q-rule can no longer see it. */
    { re: /\bq\s*(\d+)\s*-\s*(\d+)\s*(?:h|hr|hrs|hours?)\b/gi, to: 'every $1 to $2 hours' },
    { re: /\bq\s*(\d+)\s*-\s*(\d+)\s*min\b/gi, to: 'every $1 to $2 minutes' },
    /* numeric ranges: 4-7 mEq/L, HR 110-160, temp 97.7-99.5 F. Digit on both
       sides only, so "72-year-old" and "C-section" are untouched. MUST come
       before the temperature rule: that rule consumes "99.5 F" and would leave
       the hyphen in "97.7-99.5" stranded between two spelled-out numbers. */
    { re: /(\d)\s*-\s*(?=\d)/g, to: '$1 to ' },
    /* temperatures BEFORE the generic number pass, for the "one oh one" form */
    { re: /\b(\d{2,3}(?:\.\d+)?)\s*(?:°)?\s*([FC])\b/g, to: tempWords },
    /* pain and rating scales BEFORE blood pressure - 4/10 is "out of", not "over" */
    { re: /\b([0-9]|10)\s*\/\s*10\b/g, to: painWords },
    /* blood pressure and any other two-number vital fraction */
    { re: /\b(\d{2,3})\s*\/\s*(\d{2,3})(?!\s*\/|\d)/g, to: overWords },
    /* SpO2 is SPOKEN as letters here rather than expanded to "oxygen
       saturation" like the browser path does: it is the single most repeated
       token in the app, and "S P O two, eighty eight percent" is how a nurse
       actually says it at the bedside. The comma is what stops the model
       running the label into the value. */
    { re: /\bSpO(?:2|₂)\s*(?=[<>]?\s*\d)/gi, to: 'S P O two, ' },
    { re: /\bSpO(?:2|₂)\b/gi, to: 'S P O two' },
    /* Lab shorthand: a comma between the label and the value. Without it the
       model runs "BUN 62" together and "K+ 4.0" comes out as one word.
       ABBREVIATIONS ONLY, deliberately. The spelled-out names read perfectly
       well without a comma, and putting them in this list turns the fluid order
       "Sodium Chloride 125 mL/hr" into "Sodium Chloride, one hundred twenty
       five..." - a pause in the middle of a drug name.
       PTT is listed before PT so the alternation cannot eat the first two
       letters and leave a stray T behind. */
    /* Cr is the one label in that list that is not readable as letters ("see
       arr, six point four"), so it gets its own expansion. Gated on a number
       following, exactly like the comma rule, so "Cr" in any other position -
       and every ordinary word starting with those letters - is untouched. */
    { re: /\bCr\b\s*(?=\d)/g, to: 'creatinine, ' },
    { re: /\b(PTT|BUN|WBC|RBC|INR|PT|HCO3|Hgb|Hct|Cr|Na|Cl|Mg|Ca|K)([+-]?)\s+(?=\d)/g, to: '$1$2, ' },
    /* ratios: 1:1000 epinephrine, 1:4 dilutions */
    { re: /\b(\d{1,4})\s*:\s*(\d{1,7})\b/g, to: '$1 to $2' },
    /* body surface area lives in CLINICAL_POST, NOT here: rewriting "1.73 m2"
       this early makes the eGFR compound in TTS_UNITS unmatchable, and
       "60 mL/min/1.73 m2" then reads as "... per minute slash one point seven
       three square meters" while the same value written without the space
       reads correctly. */
    /* comparison symbols in front of a number */
    { re: /<\s*(?=\d)/g, to: 'less than ' },
    { re: />\s*(?=\d)/g, to: 'greater than ' }
  ];

  /* ---- step 6: after the shared abbreviation table ----------------------- */
  var CLINICAL_POST = [
    /* Body surface area, AFTER expandUnits() so the mL/min/1.73 m2 compound got
       its chance first. Two forms: glued to the number ("1.73m2", where there
       is no word boundary between the digit and the m) and standing alone. */
    { re: /(\d)\s*m2\b/g, to: '$1 square meters' },
    { re: /\s*\bm2\b/g, to: ' square meters' },
    { re: /\b(\d{1,2})(?:st|nd|rd|th)\b/gi, to: function (m, d) {
      var n = parseInt(d, 10);
      return (n >= 1 && n <= 31 && ORDINALS_W[n]) ? ORDINALS_W[n] : m;
    } },
    /* a slash that survived every rule above is read, not swallowed */
    { re: /(\S)\s*\/\s*(\S)/g, to: '$1 slash $2' }
  ];

  /**
   * Every digit run that survived the pipeline becomes words.
   *
   * A digit run welded to letters is a TOKEN, not a number: D5W, S1/S2, HCO3,
   * A1C, G2P1, B12, T2DM. Replacing the digits in place with no separator
   * invents words - "DfiveW", "Sone", "HCOthree" - that the model reads as
   * garbage. Padding with a space on whichever side touches a letter gives the
   * spoken form nurses actually use ("D five W", "B twelve", "H C O three"),
   * and the tidy step in normalizeClinicalForTTS collapses the doubles.
   */
  function numeralsToWords(text) {
    var src = String(text == null ? '' : text);
    return src.replace(/\d+(?:\.\d+)?/g, function (m, off) {
      var out = numberWords(m);
      var before = off > 0 ? src.charAt(off - 1) : '';
      var after = src.charAt(off + m.length);
      if (before && /[A-Za-z]/.test(before)) out = ' ' + out;
      if (after && /[A-Za-z]/.test(after)) out = out + ' ';
      return out;
    });
  }

  /**
   * MM.voice.normalizeClinicalForTTS(text) -> string
   *
   * Everything normalizeForSpeech() does, plus every number spoken the way a
   * nurse says it. Used ONLY on the ElevenLabs path - the browser synth reads
   * numerals correctly on its own and does not need (or want) this.
   *
   * Also the cache key: two callers whose raw text differs only in markdown or
   * whitespace normalize to the same string and therefore share one clip.
   */
  function normalizeClinicalForTTS(text) {
    var t = stripMarkdown(str(text));
    if (!t) return '';
    t = t.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');   /* 10,000 -> 10000 */
    t = applyRules(t, CLINICAL_PRE);
    t = expandUnits(t);
    t = applyRules(t, SPEECH_EXPANSIONS);
    t = applyRules(t, CLINICAL_POST);
    t = numeralsToWords(t);
    return t
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/,\s*,/g, ',')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /* ======================================================================
   * 8c. ELEVENLABS STUDIO VOICES  (behind speak(); never in front of it)
   * ----------------------------------------------------------------------
   * THE ONE RULE THIS SECTION EXISTS FOR:
   *   A FAILED ELEVENLABS CALL MUST BE INVISIBLE TO THE STUDENT.
   *
   * Every path in here - no config, wrong tier, expired token, 401, 429, a
   * malformed body, a blocked autoplay, an offline phone - ends in the browser
   * voice saying the line. Nothing here throws, and nothing here is allowed to
   * leave the app silent. speak()'s contract does not change at all.
   *
   * LOOKUP ORDER for one clip, each step cheaper than the one below it (the
   * same architecture as js/images.js, because it is the same problem):
   *   1. in-memory map          this page session, free, instant
   *   2. window.MM_STATIC_VOICE clips bundled into the repo, zero network ever
   *   3. /voiceCache/<hash>     the SHARED index. One student anywhere in the
   *                             world paid for this line once; everybody else
   *                             streams an mp3 off Storage. This is the whole
   *                             economic argument for the feature.
   *   4. POST /api/tts, then upload to Storage and publish the index so this is
   *                             the last time anyone pays for that sentence.
   *
   * The app has 172 scripted dialogue lines. Pre-generated and exported once
   * (Admin -> AI -> Voices), the recurring cost of studio voices for scripted
   * content is zero forever.
   * ==================================================================== */

  var TTS_ENDPOINT_DEFAULT = '/api/tts';
  var VOICE_CACHE_PATH  = 'voiceCache';       /* /voiceCache/<hash>            */
  var VOICE_STORAGE_ROOT = 'voice';           /* voice/<profile>/<hash>.mp3    */
  var PREMIUM_TIERS = ['pro', 'instructor'];
  var DEFAULT_TTS_MODEL = 'eleven_flash_v2_5';
  var TIER_WAIT_MS = 8000;
  /* How long a line will wait for the studio-voice profile map before giving
     up and using the device voice. Short: a student must never notice it. */
  var PROFILE_WAIT_MS = 2500;                    /* ceiling on "tier still resolving" */
  var MAX_PREMIUM_CHARS = 5000;               /* mirrors MAX_TEXT_CHARS server-side */
  var MAX_MEM_CLIPS = 300;                    /* bounded: an mp3 data URL is real memory */

  /* Mirror of TTS_MODELS in netlify/functions/tts.js. Exported for the admin
     picker so the owner is choosing from what the server will actually send. */
  var TTS_MODELS = [
    { id: 'eleven_flash_v2_5', label: 'Flash v2.5', latency: '~75 ms', maxChars: 40000,
      note: 'Cheapest and fastest. Its own number normalization is off, which is exactly why every line goes through normalizeClinicalForTTS first.' },
    { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5', latency: '~250-300 ms', maxChars: 40000,
      note: 'Balanced. Noticeably warmer than Flash on long patient speech.' },
    { id: 'eleven_multilingual_v2', label: 'Multilingual v2', latency: 'slowest', maxChars: 10000,
      note: 'Highest quality and the most expensive. Worth it only for the handful of lines students hear most.' }
  ];

  var PROFILE_ORDER = ['patient', 'nurse', 'instructor', 'child', 'family'];

  /* The line the admin "Test this voice" button speaks. Deliberately stuffed
     with every hard case at once - a BP fraction, a saturation, a decimal dose,
     a rate, a temperature, a frequency and a route - so one press tells the
     owner whether the normalizer and the voice are both right. */
  var TEST_LINE = 'BP 92/58, HR 118, SpO2 88% on 2 L. Temp 101.6 F. ' +
    'I gave the 0.25 mg IV push and hung the drip at 125 mL/hr, 1 mg/mL. ' +
    'K+ 3.2, BUN 62. Next dose is q4h PRN.';

  /* --- session state ---------------------------------------------------- */

  var _clipMem = {};        /* hash -> {url, mime, chars, ...}   */
  var _clipInflight = {};   /* hash -> Promise (de-duplication)  */
  var _clipMemOrder = [];   /* hashes, least recently used first (LRU bound)   */
  var _clipData = {};       /* hash -> 'data:audio/mpeg;base64,' (for the export) */
  var _clipDataOrder = [];
  var _currentAudio = null;

  var _premium = {
    /* Set by anything that cannot un-fail before a reload: no key on the
       server, wrong tier, the site-wide switch, the ElevenLabs monthly quota.
       Once set, speak() stops even trying, so a student never pays 40 failed
       round trips for one permanent condition. */
    disabled: false,
    reason: '',
    lastError: null
  };

  var _voiceStats = {
    hits: 0, misses: 0, generated: 0, chars: 0, charsSaved: 0,
    indexReads: 0, uploads: 0, uploadFailures: 0, plays: 0, fallbacks: 0
  };

  /* --- tiny, all feature-detected, none may throw ----------------------- */

  function mmObj() {
    if (!window.MM) window.MM = {};
    return window.MM;
  }

  function aiMod() {
    var m = mmObj();
    if (m.ai) return m.ai;
    if (window.MM_AI) return window.MM_AI;
    return null;
  }

  function voiceDb() {
    var m = mmObj();
    if (m.db) return m.db;
    try {
      if (window.firebase && window.firebase.apps && window.firebase.apps.length &&
          typeof window.firebase.database === 'function') {
        return window.firebase.database();
      }
    } catch (e) { /* noop */ }
    return null;
  }

  function voiceStorage() {
    var m = mmObj();
    if (m.storage) return m.storage;
    try {
      if (window.firebase && window.firebase.apps && window.firebase.apps.length &&
          typeof window.firebase.storage === 'function') {
        return window.firebase.storage();
      }
    } catch (e) { /* noop */ }
    return null;
  }

  function ttsEndpoint() {
    if (window.MM_TTS_ENDPOINT) return window.MM_TTS_ENDPOINT;
    return TTS_ENDPOINT_DEFAULT;
  }

  function currentUid() {
    var m = mmObj();
    if (m.authUser && m.authUser.uid) return m.authUser.uid;
    return '';
  }

  function setPremiumError(e) {
    _premium.lastError = e || null;
    return e;
  }

  function blockPremium(reason) {
    _premium.disabled = true;
    _premium.reason = reason || 'unavailable';
  }

  /* --- sha256, only used when js/ai.js is missing ------------------------
   * MM.ai.promptHash is the one true algorithm and the server computes the same
   * one. This local copy exists so voice.js still caches correctly on a page
   * that loaded it without js/ai.js (a test harness, a stripped build). Byte
   * for byte the same function as sha256Hex() in js/ai.js.
   * ---------------------------------------------------------------------- */
  var SHA256_K_V = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8BytesV(s) {
    var out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var c2 = s.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
          out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
          i++;
        } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function rotr32V(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

  function hex8V(n) {
    var s = (n >>> 0).toString(16);
    while (s.length < 8) s = '0' + s;
    return s;
  }

  function sha256HexV(input) {
    var bytes = utf8BytesV(String(input == null ? '' : input));
    var len = bytes.length;
    var hi = Math.floor(len / 536870912);
    var lo = (len << 3) >>> 0;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
               (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);
    var i, j, a, b, c, d, e, f, g, h, s0, s1, ch, maj, t1, t2, p;

    for (i = 0; i < bytes.length; i += 64) {
      for (j = 0; j < 16; j++) {
        p = i + j * 4;
        w[j] = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
      }
      for (j = 16; j < 64; j++) {
        s0 = (rotr32V(w[j - 15], 7) ^ rotr32V(w[j - 15], 18) ^ (w[j - 15] >>> 3)) >>> 0;
        s1 = (rotr32V(w[j - 2], 17) ^ rotr32V(w[j - 2], 19) ^ (w[j - 2] >>> 10)) >>> 0;
        w[j] = (((w[j - 16] + s0) >>> 0) + ((w[j - 7] + s1) >>> 0)) >>> 0;
      }
      a = H[0]; b = H[1]; c = H[2]; d = H[3]; e = H[4]; f = H[5]; g = H[6]; h = H[7];
      for (j = 0; j < 64; j++) {
        s1 = (rotr32V(e, 6) ^ rotr32V(e, 11) ^ rotr32V(e, 25)) >>> 0;
        ch = ((e & f) ^ (~e & g)) >>> 0;
        t1 = (h + s1) >>> 0;
        t1 = (t1 + ch) >>> 0;
        t1 = (t1 + SHA256_K_V[j]) >>> 0;
        t1 = (t1 + w[j]) >>> 0;
        s0 = (rotr32V(a, 2) ^ rotr32V(a, 13) ^ rotr32V(a, 22)) >>> 0;
        maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        t2 = (s0 + maj) >>> 0;
        h = g; g = f; f = e;
        e = (d + t1) >>> 0;
        d = c; c = b; b = a;
        a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map(hex8V).join('');
  }

  /**
   * The clip cache key: sha256(normalizedText + voiceId + modelId), first 32 hex
   * chars. Uses MM.ai.promptHash when present so there is exactly ONE hashing
   * implementation in the app; promptHash(a,b,c) is sha256(a.trim().toLowerCase()
   * + '\n' + b + '\n' + c).slice(0,32), which is precisely what we want here.
   */
  function clipHash(normText, voiceId, modelId) {
    var a = aiMod();
    if (a && typeof a.promptHash === 'function') {
      try {
        var h = a.promptHash(normText, voiceId, modelId);
        if (typeof h === 'string' && h) return h;
      } catch (e) { /* fall through to the local copy */ }
    }
    return sha256HexV(
      String(normText == null ? '' : normText).trim().toLowerCase() + '\n' +
      String(voiceId == null ? '' : voiceId) + '\n' +
      String(modelId == null ? '' : modelId)
    ).slice(0, 32);
  }

  /* --- the voice map: aiConfig.voiceProfiles ----------------------------
   * MM.ai.getConfig() normalizes aiConfig down to the fields the TEXT layer
   * enforces and drops everything else, so voiceProfiles is not on it and never
   * will be. Read it straight from Firebase instead, with a live listener so an
   * assignment made in the admin panel takes effect without a reload.
   * ---------------------------------------------------------------------- */

  var _voiceCfg = { profiles: {}, loaded: false, loading: null, bound: false };

  function normalizeVoiceProfileMap(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    var k, id, v, voiceId;
    for (k in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      id = String(k == null ? '' : k).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
      if (!id || PROFILE_ORDER.indexOf(id) === -1) continue;
      v = raw[k];
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      voiceId = String(v.voiceId || v.voice_id || '').trim();
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(voiceId)) continue;   /* same gate as the server */
      out[id] = {
        voiceId: voiceId,
        modelId: (typeof v.modelId === 'string' && v.modelId) ? v.modelId : DEFAULT_TTS_MODEL,
        name: (typeof v.name === 'string') ? v.name.slice(0, 80) : ''
      };
    }
    return out;
  }

  /** Resolves with the profile map. Never rejects; an unreadable node is {}. */
  /**
   * scheduleProfileRetry() - poll for Firebase, then bind the profile listener.
   *
   * Backs off (0.4s, 0.8s, 1.6s ... capped) and gives up after ~30s, which is
   * far longer than any real boot and short enough that a signed-out visitor
   * is not polling forever. Idempotent: a second call while a retry is pending
   * is a no-op, and it stops the moment the profiles actually load.
   */
  var _profileRetry = { timer: null, tries: 0, MAX: 8 };

  function scheduleProfileRetry() {
    if (_profileRetry.timer || _voiceCfg.loaded) return;
    if (_profileRetry.tries >= _profileRetry.MAX) return;
    var delay = Math.min(400 * Math.pow(2, _profileRetry.tries), 8000);
    _profileRetry.tries++;
    try {
      _profileRetry.timer = setTimeout(function () {
        _profileRetry.timer = null;
        if (_voiceCfg.loaded) return;
        if (!voiceDb()) { scheduleProfileRetry(); return; }
        loadVoiceProfiles();
      }, delay);
    } catch (e) { _profileRetry.timer = null; }
  }

  function loadVoiceProfiles() {
    /* A test harness or the admin panel can inject the map directly. */
    if (window.MM_VOICE_PROFILES) {
      _voiceCfg.profiles = normalizeVoiceProfileMap(window.MM_VOICE_PROFILES);
      _voiceCfg.loaded = true;
      return Promise.resolve(_voiceCfg.profiles);
    }
    if (_voiceCfg.loaded) return Promise.resolve(_voiceCfg.profiles);
    if (_voiceCfg.loading) return _voiceCfg.loading;

    var d = voiceDb();
    if (!d) {
      /* NO DATABASE YET - and this is the normal case at module load, not an
         error. The modules are `defer`, so they finish executing BEFORE
         bootMedMaster() runs initFirebase() on DOMContentLoaded.
         Latching `loaded = true` here (which this used to do) permanently
         froze an EMPTY profile map: loadVoiceProfiles() early-returned
         forever, the listener was never bound, profileVoice() always returned
         null, and every studio voice silently degraded to the device robot
         voice - with the admin panel showing a perfectly good configuration,
         because the panel reads Firebase through its own listener.
         So: stay unloaded and retry until Firebase shows up. */
      scheduleProfileRetry();
      return Promise.resolve(_voiceCfg.profiles);
    }

    _voiceCfg.loading = new Promise(function (resolve) {
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        _voiceCfg.loaded = true;
        _voiceCfg.loading = null;
        resolve(_voiceCfg.profiles);
      }
      try {
        var ref = d.ref('appConfig/aiConfig/voiceProfiles');
        if (!_voiceCfg.bound && typeof ref.on === 'function') {
          _voiceCfg.bound = true;
          ref.on('value', function (snap) {
            var v = null;
            try { v = (snap && typeof snap.val === 'function') ? snap.val() : null; } catch (e) { v = null; }
            _voiceCfg.profiles = normalizeVoiceProfileMap(v);
            done();
          }, function (e) {
            /* Almost always a missing read rule. Not fatal: no map means every
               profile uses the browser voice, which is the safe default. */
            setPremiumError(e);
            done();
          });
        } else {
          ref.once('value').then(function (snap) {
            var v = null;
            try { v = (snap && typeof snap.val === 'function') ? snap.val() : null; } catch (e) { v = null; }
            _voiceCfg.profiles = normalizeVoiceProfileMap(v);
            done();
          }, function (e) { setPremiumError(e); done(); });
        }
      } catch (e) { setPremiumError(e); done(); }
      /* Never let a silent Firebase leave speak() hanging. */
      setTimeout(done, TIER_WAIT_MS);
    });
    return _voiceCfg.loading;
  }

  /** Synchronous peek. '' / null when the profile has no studio voice yet. */
  function profileVoice(profileId) {
    if (window.MM_VOICE_PROFILES && !_voiceCfg.loaded) {
      _voiceCfg.profiles = normalizeVoiceProfileMap(window.MM_VOICE_PROFILES);
      _voiceCfg.loaded = true;
    }
    /* Self-heal: if the map has never loaded and a database exists NOW, bind
       it. This is synchronous-safe (loadVoiceProfiles returns a promise we
       ignore) and means the very first speak() after Firebase comes up kicks
       the load instead of waiting on the retry timer. */
    if (!_voiceCfg.loaded && !_voiceCfg.loading && voiceDb()) {
      try { loadVoiceProfiles(); } catch (e) { /* never let this break speech */ }
    }
    var id = String(profileId || DEFAULT_PROFILE);
    var v = _voiceCfg.profiles[id];
    return v ? v : null;
  }

  /* --- eligibility ------------------------------------------------------- */

  function currentTier() {
    var a = aiMod();
    if (!a || typeof a.getTier !== 'function') return '';
    try { return String(a.getTier() || ''); } catch (e) { return ''; }
  }

  function tierIsResolving() {
    var a = aiMod();
    if (!a || typeof a.isResolving !== 'function') return false;
    try { return a.isResolving() === true; } catch (e) { return false; }
  }

  /**
   * MM.voice.isPremium() -> bool
   * Would the NEXT speak() go through ElevenLabs? Cheap, synchronous, and safe
   * to call in a render path.
   */
  function isPremium(profileId) {
    return premiumReasonFor(profileId) === '';
  }

  /* '' means yes. Anything else is the human-readable reason it will not, which
     is what premiumReason() returns and what the settings UI shows. */
  function premiumReasonFor(profileId) {
    if (_premium.disabled) {
      return _premium.reason || 'Studio voices are unavailable for the rest of this session.';
    }
    var prefs = getPrefs();
    if (prefs.premiumVoice === false) return 'You have studio voices switched off in Voice settings.';
    var a = aiMod();
    if (!a || typeof a.getTier !== 'function') return 'The AI layer is not loaded, so only device voices are available.';
    if (tierIsResolving()) return 'Still checking your plan.';
    var tier = currentTier();
    if (PREMIUM_TIERS.indexOf(tier) === -1) {
      return 'The ' + (tier || 'free') + ' plan uses your device\'s own voices. Every line is still read aloud.';
    }
    if (!hasFetch()) return 'This browser cannot fetch audio, so device voices are used.';
    if (!hasAudioEl()) return 'This browser cannot play audio clips, so device voices are used.';
    var v = profileVoice(profileId || DEFAULT_PROFILE);
    if (!v) {
      /* Two very different situations, and conflating them cost a debugging
         session: the map may simply not have arrived yet (Firebase still
         coming up), or it arrived and this role genuinely has no voice. */
      if (!_voiceCfg.loaded) return 'Still loading the studio voice settings.';
      return 'No studio voice has been assigned to the "' + (profileId || DEFAULT_PROFILE) + '" role yet.';
    }
    return '';
  }

  function premiumReason() { return premiumReasonFor(DEFAULT_PROFILE); }

  function hasFetch() { try { return typeof window.fetch === 'function'; } catch (e) { return false; } }
  function hasAudioEl() { try { return typeof window.Audio === 'function'; } catch (e) { return false; } }

  /* --- playback ---------------------------------------------------------- */

  /**
   * ONE <audio> element for the whole session, on purpose.
   *
   * iOS unlocks a SPECIFIC element - the one that had play() called on it inside
   * a user gesture - not the page. A fresh `new Audio()` per clip is therefore
   * locked every single time on iPhone, which would silently mean "premium
   * voices never work on the platform most students use". prime() (already
   * called from every gesture handler in this file) touches this element, and
   * every clip afterwards reuses it.
   */
  var _audioEl = null;

  function getAudioEl() {
    if (_audioEl) return _audioEl;
    if (!hasAudioEl()) return null;
    try { _audioEl = new window.Audio(); } catch (e) { _audioEl = null; }
    return _audioEl;
  }

  function premiumAudioBusy() {
    var el = _currentAudio;
    if (!el) return false;
    try { return !el.paused && !el.ended; } catch (e) { return false; }
  }

  /**
   * Cancels the in-flight playClipUrl() promise, if there is one.
   *
   * Without this, stopSpeaking() detaches the onended handler and the promise
   * speak() returned never settles - so a caller doing
   * `speak(a).then(next)` while the student taps something else would hang
   * forever. A cancelled clip resolves {spoken:false, reason:'cancelled'},
   * exactly like the browser path does.
   */
  var _currentPlayCancel = null;

  function stopPremiumAudio() {
    var el = _currentAudio;
    var cancel = _currentPlayCancel;
    _currentAudio = null;
    _currentPlayCancel = null;
    if (el) {
      try { el.pause(); } catch (e) { /* noop */ }
      try { el.onended = null; el.onerror = null; el.onplay = null; } catch (e) { /* noop */ }
      /* Clearing src releases the decoder; Safari otherwise keeps it alive and a
         long session slowly accumulates them. The element itself is kept so the
         iOS unlock survives. */
      try { el.src = ''; } catch (e) { /* noop */ }
      try { if (typeof el.load === 'function') el.load(); } catch (e) { /* noop */ }
    }
    if (cancel) { try { cancel(); } catch (e) { /* noop */ } }
  }

  /**
   * Play one clip. Resolves {spoken:true} / {spoken:false, reason}, rejects only
   * on a real playback failure so the caller can fall back to the browser voice.
   */
  function playClipUrl(url, opts, token) {
    return new Promise(function (resolve, reject) {
      if (!hasAudioEl()) { reject(new Error('no Audio element')); return; }
      if (token !== _speakToken) { resolve({ spoken: false, reason: 'cancelled' }); return; }

      var prefs = getPrefs();
      var profile = VOICE_PROFILES[opts.voice] || VOICE_PROFILES[DEFAULT_PROFILE];
      /* The rate PREF is a user setting and must apply to both engines. The
         profile's own rate is a browser-synth nicety and is deliberately NOT
         applied here: an ElevenLabs voice already has the character the profile
         was faking, and re-pitching it just makes it sound resampled. */
      var rate = clamp((opts.rate !== undefined && opts.rate !== null ? Number(opts.rate) / profile.rate : 1) * (prefs.rate || 1), 0.5, 2);
      var volume = clamp(opts.volume === undefined ? 1 : opts.volume, 0, 1);

      var el = getAudioEl();
      if (!el) { reject(new Error('no Audio element')); return; }

      var settled = false;
      function finish(v) {
        if (settled) return;
        settled = true;
        if (_currentAudio === el) _currentAudio = null;
        if (_currentPlayCancel === cancelThis) _currentPlayCancel = null;
        resolve(v);
      }
      function bail(e) {
        if (settled) return;
        settled = true;
        if (_currentAudio === el) _currentAudio = null;
        if (_currentPlayCancel === cancelThis) _currentPlayCancel = null;
        reject(e || new Error('audio playback failed'));
      }
      function cancelThis() { finish({ spoken: false, reason: 'cancelled' }); }

      try {
        el.preload = 'auto';
        el.src = url;
        el.volume = volume;
        try { el.playbackRate = rate; } catch (e) { /* some browsers clamp/refuse */ }
      } catch (e) { bail(e); return; }

      el.onended = function () { finish({ spoken: true, premium: true }); };
      el.onerror = function () { bail(new Error('clip could not be decoded or fetched')); };

      _currentAudio = el;
      _currentPlayCancel = cancelThis;
      _voiceStats.plays++;

      var p;
      try { p = el.play(); } catch (e) { bail(e); return; }
      if (p && typeof p.then === 'function') {
        p.then(function () {
          callSafe(opts.onChunk, '', 0, 1);
        }, function (e) {
          /* Autoplay policy, almost always. The browser synth has the same
             gesture requirement but degrades more gracefully, so hand it over. */
          bail(e);
        });
      } else {
        callSafe(opts.onChunk, '', 0, 1);
      }
    });
  }

  /* --- the shared Firebase index ---------------------------------------- */

  function readClipIndex(hash) {
    var d = voiceDb();
    if (!d || !hash) return Promise.resolve(null);
    _voiceStats.indexReads++;
    return new Promise(function (resolve) {
      var settled = false;
      function done(v) { if (!settled) { settled = true; resolve(v); } }
      try {
        d.ref(VOICE_CACHE_PATH + '/' + hash).once('value').then(function (snap) {
          var val = null;
          try { val = (snap && typeof snap.val === 'function') ? snap.val() : null; } catch (e) { val = null; }
          if (!val || typeof val !== 'object' || typeof val.url !== 'string' || !val.url) { done(null); return; }
          done(val);
        }, function (e) {
          /* Missing rule. Not fatal - it only means this student pays for a
             line somebody already bought. */
          setPremiumError(e);
          done(null);
        });
      } catch (e) { setPremiumError(e); done(null); }
      setTimeout(function () { done(null); }, 6000);
    });
  }

  function writeClipIndex(hash, rec) {
    var d = voiceDb();
    if (!d || !hash) return Promise.resolve(false);
    return new Promise(function (resolve) {
      try {
        var p = d.ref(VOICE_CACHE_PATH + '/' + hash).set(rec);
        if (p && typeof p.then === 'function') {
          p.then(function () { resolve(true); }, function (e) { setPremiumError(e); resolve(false); });
        } else { resolve(true); }
      } catch (e) { setPremiumError(e); resolve(false); }
    });
  }

  /* The only honest answer to "how much has the cache saved us": it counts hits
     across every student and every device, not just this tab. */
  function bumpClipHit(hash) {
    var d = voiceDb();
    if (!d || !hash) return;
    try {
      var inc = null;
      if (window.firebase && window.firebase.database && window.firebase.database.ServerValue &&
          typeof window.firebase.database.ServerValue.increment === 'function') {
        inc = window.firebase.database.ServerValue.increment(1);
      }
      if (inc === null) return;   /* old SDK: skip rather than race a read-modify-write */
      var p = d.ref(VOICE_CACHE_PATH + '/' + hash + '/hits').set(inc);
      if (p && typeof p['catch'] === 'function') p['catch'](function () { /* non-fatal */ });
    } catch (e) { /* non-fatal */ }
  }

  function uploadClip(hash, profile, b64) {
    var s = voiceStorage();
    if (!s || !hash) return Promise.resolve(null);
    var path = VOICE_STORAGE_ROOT + '/' + profile + '/' + hash + '.mp3';
    return new Promise(function (resolve) {
      var settled = false;
      function done(v) { if (!settled) { settled = true; resolve(v); } }
      try {
        var ref = s.ref(path);
        Promise.resolve(ref.putString(b64, 'base64', { contentType: 'audio/mpeg' }))
          .then(function () { return ref.getDownloadURL(); })
          .then(function (url) {
            if (typeof url !== 'string' || !url) { _voiceStats.uploadFailures++; done(null); return; }
            _voiceStats.uploads++;
            done({ url: url, path: path });
          }, function (e) {
            /* A Storage rule that is not deployed, a bucket that does not exist,
               an offline phone. None of them may reach the student: they still
               hear the clip from the data URL, only the sharing is lost. */
            _voiceStats.uploadFailures++;
            setPremiumError(e);
            done(null);
          });
      } catch (e) {
        _voiceStats.uploadFailures++;
        setPremiumError(e);
        done(null);
      }
    });
  }

  /* --- the static bundle ------------------------------------------------- */

  function staticClip(hash) {
    var map = window.MM_STATIC_VOICE;
    if (!map || typeof map !== 'object' || !hash) return '';
    var v = map[hash];
    return (typeof v === 'string' && v) ? v : '';
  }

  function rememberClipData(hash, dataUrl) {
    if (!hash || !dataUrl || String(dataUrl).indexOf('data:') !== 0) return;
    if (!_clipData[hash]) _clipDataOrder.push(hash);
    _clipData[hash] = dataUrl;
    while (_clipDataOrder.length > MAX_MEM_CLIPS) {
      var drop = _clipDataOrder.shift();
      if (drop !== hash) delete _clipData[drop];
    }
  }

  /**
   * The in-memory clip map, bounded the same way _clipData is.
   *
   * An entry holds a whole base64 mp3 (roughly 25 KB for one short line), so an
   * unbounded map is tens of megabytes of phone memory over a long session -
   * and bounding _clipData alone frees nothing, because the same string is
   * still reachable through _clipMem[hash].url. Least recently used goes first:
   * an evicted clip is not lost, it is one index read away.
   */
  function rememberClip(hash, entry) {
    if (!hash || !entry) return;
    if (!_clipMem[hash]) _clipMemOrder.push(hash);
    else touchClip(hash);
    _clipMem[hash] = entry;
    while (_clipMemOrder.length > MAX_MEM_CLIPS) {
      var drop = _clipMemOrder.shift();
      if (drop !== hash) delete _clipMem[drop];
    }
  }

  /**
   * Hand one entry's base64 back to the garbage collector once the clip has
   * been heard AND has a Storage url to be re-fetched from. Roughly 25 KB per
   * short line; keeping it after the first play is what turned this map into
   * tens of megabytes on a phone. If Storage is unreachable later, the clip
   * simply misses and the student hears the browser voice, like any other
   * premium failure.
   */
  function releaseClipData(entry) {
    if (!entry || typeof entry.storageUrl !== 'string' || !entry.storageUrl) return;
    if (String(entry.url).indexOf('data:') === 0) entry.url = entry.storageUrl;
    if (entry.dataUrl) delete entry.dataUrl;
  }

  /** Mark a hash as the most recently used one. */
  function touchClip(hash) {
    var i = indexOfIn(_clipMemOrder, hash);
    if (i >= 0) _clipMemOrder.splice(i, 1);
    _clipMemOrder.push(hash);
  }

  /** Drop one clip from memory (a dead url, an admin reset). */
  function forgetClip(hash) {
    if (!hash) return;
    delete _clipMem[hash];
    var i = indexOfIn(_clipMemOrder, hash);
    if (i >= 0) _clipMemOrder.splice(i, 1);
  }

  function indexOfIn(list, v) {
    for (var i = 0; i < list.length; i++) { if (list[i] === v) return i; }
    return -1;
  }

  /* --- calling the server ------------------------------------------------ */

  function whenTierReady() {
    if (!tierIsResolving()) return Promise.resolve();
    var a = aiMod();
    if (!a || typeof a.onResolved !== 'function') return Promise.resolve();
    return new Promise(function (resolve) {
      var done = false, off = null;
      function finish() {
        if (done) return;
        done = true;
        try { if (off) off(); } catch (e) { /* noop */ }
        resolve();
      }
      try { off = a.onResolved(finish); } catch (e) { finish(); return; }
      setTimeout(finish, TIER_WAIT_MS);
    });
  }

  function getIdToken() {
    var m = mmObj();
    if (!m.authUser || !isFn(m.authUser.getIdToken)) {
      var e = new Error('You need to be signed in for studio voices.');
      e.code = 'no-auth';
      return Promise.reject(e);
    }
    return Promise.resolve().then(function () { return m.authUser.getIdToken(); })
      .then(function (tok) {
        if (!tok) { var e2 = new Error('no token'); e2.code = 'no-auth'; throw e2; }
        return tok;
      });
  }

  function ttsErrFromBody(status, text) {
    var data = null;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    var code = (data && typeof data.error === 'string') ? data.error
      : status === 401 ? 'no-auth'
      : status === 403 ? 'tier-denied'
      : status === 429 ? 'quota-exceeded'
      : status === 503 ? 'ai-disabled'
      : 'server';
    var e = new Error((data && data.message) ? data.message : 'That line could not be voiced.');
    e.code = code;
    e.status = status;
    if (data) {
      if (typeof data.reason === 'string') e.reason = data.reason;
      if (typeof data.kind === 'string') e.kind = data.kind;
      if (typeof data.limit === 'number') e.limit = data.limit;
      if (typeof data.used === 'number') e.used = data.used;
      if (typeof data.resetsAt === 'number') e.resetsAt = data.resetsAt;
    }
    return e;
  }

  /**
   * Which failures are PERMANENT for this session?
   *
   * Re-asking after one of these buys nothing but latency on every future line:
   * a tier does not change mid-session, a missing key does not appear, the
   * monthly ElevenLabs bundle does not refill before midnight UTC, and the
   * student's own daily character cap does not reset before midnight Eastern.
   * A 429 from ElevenLabs itself, a network blip or a one-off 500 are NOT
   * permanent and are retried on the next line.
   */
  function isPermanentFailure(e) {
    if (!e || !e.code) return false;
    if (e.code === 'tier-denied' || e.code === 'ai-disabled' || e.code === 'no-auth') return true;
    if (e.code === 'quota-exceeded') return true;
    if (e.code === 'server' && (e.reason === 'bad-key' || e.reason === 'not-configured' ||
        e.reason === 'no-voice-configured' || e.reason === 'bad-voice-or-model' || e.reason === 'bad-voice')) return true;
    return false;
  }

  function reasonPhrase(e) {
    if (!e) return 'Studio voices are unavailable right now.';
    if (e.code === 'tier-denied') return e.message || 'Your plan uses your device\'s own voices.';
    if (e.code === 'quota-exceeded') return e.message || 'Today\'s studio-voice characters are used up.';
    if (e.code === 'ai-disabled') return e.message || 'Studio voices are switched off right now.';
    if (e.code === 'no-auth') return 'Sign in to use studio voices. Everything is still read aloud without one.';
    return e.message || 'Studio voices are unavailable right now.';
  }

  /** POST /api/tts speak. Resolves with the parsed body, or rejects with a coded Error. */
  function callTts(text, profile, voiceId, modelId) {
    return whenTierReady().then(getIdToken).then(function (tok) {
      return window.fetch(ttsEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'speak', idToken: tok, text: text,
          profile: profile, voiceId: voiceId, modelId: modelId
        })
      });
    }).then(function (res) {
      return Promise.resolve(res.text()).then(function (body) {
        if (!res.ok) throw ttsErrFromBody(res.status, body);
        var data = null;
        try { data = JSON.parse(body); } catch (e) { data = null; }
        if (!data || data.ok !== true || typeof data.b64 !== 'string' || !data.b64) {
          /* A 200 with a body we cannot read is a malformed response, not a
             success. Treated as a transient server fault: fall back now, try
             again on the next line. */
          var e2 = new Error('The voice service returned nothing playable.');
          e2.code = 'server';
          throw e2;
        }
        return data;
      });
    }, function (e) {
      if (e && e.code) throw e;
      var ne = new Error('Could not reach the voice service.');
      ne.code = 'network';
      throw ne;
    });
  }

  function b64BytesLen(b64) {
    var s = String(b64 || '');
    if (!s) return 0;
    var pad = 0;
    if (s.charAt(s.length - 1) === '=') pad++;
    if (s.charAt(s.length - 2) === '=') pad++;
    return Math.max(0, Math.floor(s.length * 3 / 4) - pad);
  }

  /**
   * Resolve ONE clip to something playable, going through the cache ladder.
   * Resolves an entry, or null when the clip cannot be had. Never rejects.
   *
   * Concurrent callers asking for the identical hash share one promise, which is
   * what stops a scenario that renders six lines at once paying six times for
   * the one that happens to be duplicated.
   */
  function resolveClip(o) {
    var normText = o.text;
    var profile = o.profile;
    var voiceId = o.voiceId;
    var modelId = o.modelId;
    var hash = o.hash;
    var allowGenerate = o.allowGenerate !== false;

    /* 1. this page session */
    if (_clipMem[hash]) {
      _voiceStats.hits++;
      _voiceStats.charsSaved += normText.length;
      var hit = _clipMem[hash], copy = {}, k;
      touchClip(hash);
      releaseClipData(hit);
      for (k in hit) { if (Object.prototype.hasOwnProperty.call(hit, k)) copy[k] = hit[k]; }
      copy.source = 'memory';
      copy.cached = true;
      return Promise.resolve(copy);
    }

    /* 2. the bundled static set - zero network of any kind */
    var stat = staticClip(hash);
    if (stat) {
      var sEntry = {
        url: stat, source: 'static', mime: 'audio/mpeg', cached: true, shared: true,
        hash: hash, voiceId: voiceId, modelId: modelId, profile: profile,
        chars: normText.length, cost: 0
      };
      _voiceStats.hits++;
      _voiceStats.charsSaved += normText.length;
      rememberClip(hash, sEntry);
      rememberClipData(hash, stat);
      return Promise.resolve(sEntry);
    }

    /* de-duplicate concurrent callers */
    if (_clipInflight[hash]) return _clipInflight[hash];

    var p = readClipIndex(hash).then(function (rec) {
      /* 3. the shared index across every student who ever ran this app */
      if (rec) {
        var entry = {
          url: rec.url, source: 'index', mime: 'audio/mpeg', cached: true, shared: true,
          hash: hash,
          voiceId: (typeof rec.voiceId === 'string') ? rec.voiceId : voiceId,
          modelId: (typeof rec.modelId === 'string') ? rec.modelId : modelId,
          profile: (typeof rec.profile === 'string') ? rec.profile : profile,
          chars: (typeof rec.chars === 'number') ? rec.chars : normText.length,
          bytes: (typeof rec.bytes === 'number') ? rec.bytes : 0,
          cost: 0
        };
        _voiceStats.hits++;
        _voiceStats.charsSaved += entry.chars;
        rememberClip(hash, entry);
        bumpClipHit(hash);
        return entry;
      }

      _voiceStats.misses++;
      if (!allowGenerate) return null;
      if (_premium.disabled) return null;

      /* 4. pay for it once, for everybody */
      return callTts(normText, profile, voiceId, modelId).then(function (data) {
        var mime = (typeof data.mime === 'string' && data.mime) ? data.mime : 'audio/mpeg';
        var dUrl = 'data:' + mime + ';base64,' + data.b64;
        var chars = (typeof data.chars === 'number') ? data.chars : normText.length;
        var bytes = b64BytesLen(data.b64);

        _voiceStats.generated++;
        _voiceStats.chars += chars;
        rememberClipData(hash, dUrl);

        /* The clip is playable RIGHT NOW from the data URL. Uploading and
           publishing is for the NEXT student and must never be on the critical
           path of this one - a slow Storage write would be heard as a pause. */
        var entry = {
          url: dUrl, source: 'generated', mime: mime, cached: false, shared: false,
          hash: hash,
          voiceId: (typeof data.voiceId === 'string') ? data.voiceId : voiceId,
          modelId: (typeof data.modelId === 'string') ? data.modelId : modelId,
          profile: profile, chars: chars, bytes: bytes,
          cost: (typeof data.cost === 'number' && isFinite(data.cost)) ? data.cost : 0,
          dataUrl: dUrl
        };
        rememberClip(hash, entry);

        uploadClip(hash, profile, data.b64).then(function (up) {
          if (!up) return null;
          entry.shared = true;
          entry.storageUrl = up.url;
          /* The mp3 is in Storage now, so the second reference to the base64 is
             pure memory cost. entry.url keeps the data URL until this playback
             is over and releaseClipData() swaps it for the Storage url - a live
             <audio> element and the "no round trip through Storage" guarantee
             for the student who paid both depend on it. */
          delete entry.dataUrl;
          /* THE ROW MUST DESCRIBE ITS OWN KEY.
             The hash is clipHash(text, voiceId, modelId) using the voice this
             client ASKED for, but netlify/functions/tts.js ignores that voice
             for everybody except the owner and answers with the one it assigned
             (data.voiceId). Publishing the server's voice in a row filed under
             the requested voice's hash makes the shared index self-contradicting
             for every student, with no invalidation path. So the row carries the
             voice and model the hash was computed from, and the substitution is
             recorded separately for the admin panel.
             (Re-keying to clipHash(normText, data.voiceId, data.modelId) instead
             would strand the row: nothing ever looks that hash up, because the
             client only ever computes the key from the voice it requested.) */
          var rec = {
            url: up.url,
            voiceId: voiceId,
            modelId: modelId,
            profile: profile,
            chars: chars,
            bytes: bytes,
            path: up.path,
            hits: 0,
            createdAt: Date.now(),
            createdBy: currentUid() || 'anon'
          };
          if (entry.voiceId !== voiceId) rec.servedVoiceId = entry.voiceId;
          if (entry.modelId !== modelId) rec.servedModelId = entry.modelId;
          return writeClipIndex(hash, rec);
        })['catch'](function (e) { setPremiumError(e); return null; });

        return entry;
      })['catch'](function (e) {
        setPremiumError(e);
        if (isPermanentFailure(e)) blockPremium(reasonPhrase(e));
        return null;
      });
    })['catch'](function (e) {
      setPremiumError(e);
      return null;
    });

    /* Clear the de-dup slot on BOTH paths, and only once the value is settled,
       so a second caller arriving one tick later still joins this call. */
    _clipInflight[hash] = p.then(function (v) {
      delete _clipInflight[hash];
      return v;
    }, function (e) {
      delete _clipInflight[hash];
      setPremiumError(e);
      return null;
    });
    return _clipInflight[hash];
  }

  /**
   * Everything needed to name one clip: the normalized text, the voice, the
   * model and the hash. Returns null when this profile has no studio voice.
   */
  function clipRequest(text, opts) {
    var o = opts || {};
    var profileId = (o.voice && VOICE_PROFILES[o.voice]) ? o.voice : DEFAULT_PROFILE;
    var v = profileVoice(profileId);
    if (!v) return null;
    var voiceId = o.voiceId ? String(o.voiceId) : v.voiceId;
    var modelId = o.modelId ? String(o.modelId) : (v.modelId || DEFAULT_TTS_MODEL);
    var normText = normalizeClinicalForTTS(text);
    if (!normText) return null;
    return {
      text: normText, profile: profileId, voiceId: voiceId, modelId: modelId,
      hash: clipHash(normText, voiceId, modelId)
    };
  }

  /**
   * speakEleven(text, opts, token) -> Promise<{spoken, reason}>
   *
   * NEVER rejects and never throws. {spoken:false} means "the browser voice
   * should take this line", and that is a completely normal outcome.
   */
  function speakEleven(text, opts, token) {
    return Promise.resolve().then(function () {
      if (token !== _speakToken) return { spoken: false, reason: 'cancelled' };
      if (premiumReasonFor(opts.voice) !== '') return { spoken: false, reason: 'ineligible' };

      var req = clipRequest(text, opts);
      if (!req) return { spoken: false, reason: 'no-voice' };
      if (req.text.length > MAX_PREMIUM_CHARS) return { spoken: false, reason: 'too-long' };

      return resolveClip(req).then(function (entry) {
        if (!entry || !entry.url) return { spoken: false, reason: 'unavailable' };
        if (token !== _speakToken) return { spoken: false, reason: 'cancelled' };
        return playClipUrl(entry.url, opts, token).then(function (r) {
          if (r && r.spoken) {
            /* Heard it. The base64 can go now that Storage has a copy. */
            releaseClipData(_clipMem[entry.hash]);
            return { spoken: true, premium: true, source: entry.source, chars: entry.chars, hash: entry.hash };
          }
          return r;
        }, function (e) {
          /* Decode failure or a blocked autoplay. If the entry came out of the
             shared index the URL may be dead (a cleared bucket), so drop it from
             memory - the next attempt re-reads the index or regenerates. */
          setPremiumError(e);
          if (entry.source === 'index' || entry.source === 'static') forgetClip(entry.hash);
          return { spoken: false, reason: 'playback-failed' };
        });
      });
    })['catch'](function (e) {
      /* The last line of defence. Whatever went wrong in here, the student is
         about to hear the line from the browser synth and will never know. */
      setPremiumError(e);
      return { spoken: false, reason: 'error' };
    });
  }

  /* --- stats, admin surface --------------------------------------------- */

  function voiceStatsSnapshot() {
    return {
      hits: _voiceStats.hits,
      misses: _voiceStats.misses,
      generated: _voiceStats.generated,
      chars: _voiceStats.chars,
      charsSaved: _voiceStats.charsSaved,
      indexReads: _voiceStats.indexReads,
      uploads: _voiceStats.uploads,
      uploadFailures: _voiceStats.uploadFailures,
      plays: _voiceStats.plays,
      fallbacks: _voiceStats.fallbacks,
      memory: Object.keys(_clipMem).length,
      inflight: Object.keys(_clipInflight).length,
      premium: isPremium(),
      premiumReason: premiumReason(),
      disabled: _premium.disabled,
      disabledReason: _premium.reason,
      tier: currentTier(),
      profiles: _voiceCfg.profiles,
      storageAvailable: !!voiceStorage(),
      lastError: _premium.lastError ? String(_premium.lastError.message || _premium.lastError) : ''
    };
  }

  /** Owner-only proxy: the ElevenLabs voice catalog. Resolves {ok, voices, ...}. */
  function listElevenVoices() {
    return getIdToken().then(function (tok) {
      return window.fetch(ttsEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listVoices', idToken: tok })
      });
    }).then(function (res) {
      return Promise.resolve(res.text()).then(function (t) {
        if (!res.ok) throw ttsErrFromBody(res.status, t);
        var d = null;
        try { d = JSON.parse(t); } catch (e) { d = null; }
        if (!d) { var e2 = new Error('Malformed voice list.'); e2.code = 'server'; throw e2; }
        return d;
      });
    });
  }

  /** Owner-only proxy: the ElevenLabs monthly character quota. */
  function elevenQuota() {
    return getIdToken().then(function (tok) {
      return window.fetch(ttsEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'quota', idToken: tok })
      });
    }).then(function (res) {
      return Promise.resolve(res.text()).then(function (t) {
        if (!res.ok) throw ttsErrFromBody(res.status, t);
        var d = null;
        try { d = JSON.parse(t); } catch (e) { d = null; }
        if (!d) { var e2 = new Error('Malformed quota response.'); e2.code = 'server'; throw e2; }
        return d;
      });
    });
  }

  /** Read the whole shared clip index. Resolves {ok, entries, error}. */
  function listClipCache() {
    var d = voiceDb();
    if (!d) return Promise.resolve({ ok: false, entries: {}, error: 'Firebase is not connected.' });
    return new Promise(function (resolve) {
      try {
        d.ref(VOICE_CACHE_PATH).once('value').then(function (snap) {
          var v = null;
          try { v = (snap && typeof snap.val === 'function') ? snap.val() : null; } catch (e) { v = null; }
          resolve({ ok: true, entries: (v && typeof v === 'object') ? v : {}, error: '' });
        }, function (e) {
          resolve({ ok: false, entries: {}, error: (e && e.message) ? e.message : 'permission denied' });
        });
      } catch (e) {
        resolve({ ok: false, entries: {}, error: (e && e.message) ? e.message : 'permission denied' });
      }
    });
  }

  /**
   * MM.voice.dialogueList() -> [{id, scenarioId, scenarioTitle, profile, trigger,
   *                              raw, text, voiceId, modelId, hash, label}]
   *
   * Every scripted dialogue line in window.ALL_SCENARIOS, already normalized and
   * hashed. This IS the pre-generate work list, and it is built here rather than
   * in the admin panel for the same reason js/images.js owns its prompt
   * templates: the normalized text is the cache key, so one character of drift
   * between the pre-generate tool and the runtime caller means the whole set is
   * paid for twice.
   *
   * A dialogue speaker that has no studio voice assigned is included with an
   * empty voiceId so the panel can SAY that rather than silently skipping it.
   */
  function dialogueList() {
    var scen = [];
    if (Array.isArray(window.ALL_SCENARIOS)) scen = window.ALL_SCENARIOS;
    else {
      scen = [].concat(
        Array.isArray(window.SCENARIOS_MS2A) ? window.SCENARIOS_MS2A : [],
        Array.isArray(window.SCENARIOS_MS2B) ? window.SCENARIOS_MS2B : [],
        Array.isArray(window.SCENARIOS_OB) ? window.SCENARIOS_OB : [],
        Array.isArray(window.SCENARIOS_PEDS) ? window.SCENARIOS_PEDS : []
      );
    }
    var out = [], i, j, s, d, line, profileId, v, normText;
    for (i = 0; i < scen.length; i++) {
      s = scen[i];
      if (!s || !Array.isArray(s.dialogue)) continue;
      for (j = 0; j < s.dialogue.length; j++) {
        d = s.dialogue[j];
        if (!d || typeof d !== 'object') continue;
        line = (typeof d.line === 'string') ? d.line : '';
        if (!line.trim()) continue;
        profileId = (typeof d.speaker === 'string' && VOICE_PROFILES[d.speaker]) ? d.speaker : DEFAULT_PROFILE;
        v = profileVoice(profileId);
        normText = normalizeClinicalForTTS(line);
        out.push({
          id: String(s.id || ('sim-' + i)) + ':' + j,
          scenarioId: String(s.id || ('sim-' + i)),
          scenarioTitle: String(s.title || s.id || ('Scenario ' + (i + 1))),
          profile: profileId,
          trigger: (typeof d.trigger === 'string') ? d.trigger : '',
          raw: line,
          text: normText,
          chars: normText.length,
          voiceId: v ? v.voiceId : '',
          modelId: v ? (v.modelId || DEFAULT_TTS_MODEL) : DEFAULT_TTS_MODEL,
          hash: v ? clipHash(normText, v.voiceId, v.modelId || DEFAULT_TTS_MODEL) : '',
          label: String(s.title || s.id || 'Scenario') + ' - ' + profileId +
                 (d.trigger ? ' / ' + d.trigger : '')
        });
      }
    }
    return out;
  }

  /** Cache-only lookup (index included, generation never). Resolves entry|null. */
  function lookupClip(item) {
    if (!item || !item.hash || !item.voiceId) return Promise.resolve(null);
    return resolveClip({
      text: item.text, profile: item.profile, voiceId: item.voiceId,
      modelId: item.modelId, hash: item.hash, allowGenerate: false
    });
  }

  /** Full lookup, generating if needed. Resolves entry|null. Never rejects. */
  function getClip(item) {
    if (!item || !item.hash || !item.voiceId) return Promise.resolve(null);
    return resolveClip({
      text: item.text, profile: item.profile, voiceId: item.voiceId,
      modelId: item.modelId, hash: item.hash, allowGenerate: true
    });
  }

  /** A data: URL for one hash, for the static bundle. Resolves null, never rejects. */
  function clipDataUrl(hash, url) {
    if (_clipData[hash]) return Promise.resolve(_clipData[hash]);
    var src = url || (_clipMem[hash] && _clipMem[hash].url) || '';
    if (!src) return Promise.resolve(null);
    if (String(src).indexOf('data:') === 0) { rememberClipData(hash, src); return Promise.resolve(src); }
    if (!hasFetch()) return Promise.resolve(null);
    return window.fetch(src).then(function (r) {
      if (!r.ok) return null;
      return r.blob();
    }).then(function (blob) {
      if (!blob || typeof window.FileReader !== 'function') return null;
      return new Promise(function (resolve) {
        var fr = new window.FileReader();
        fr.onload = function () {
          var v = String(fr.result || '');
          if (v.indexOf('data:') === 0) { rememberClipData(hash, v); resolve(v); } else resolve(null);
        };
        fr.onerror = function () { resolve(null); };
        try { fr.readAsDataURL(blob); } catch (e) { resolve(null); }
      });
    })['catch'](function (e) { setPremiumError(e); return null; });
  }

  /**
   * Build the text of a drop-in JS file:
   *     window.MM_STATIC_VOICE = { "<hash>": "<data:audio/mpeg;base64,...>", ... };
   *
   * Loaded before js/voice.js this turns step 2 of the lookup into a permanent
   * hit: those lines are then free for every student forever, with no Firebase
   * read, no Storage download and no ElevenLabs call, ever again.
   *
   * mp3 base64 is BIG - budget roughly 20-30 KB per short line - so the panel
   * warns about the file size rather than this function refusing to build it.
   */
  function exportStaticVoice(items, onProgress) {
    var list = Array.isArray(items) ? items : [];
    var map = {}, skipped = [], i = 0, bytes = 0;

    function step() {
      if (i >= list.length) return Promise.resolve();
      var it = list[i++] || {};
      if (isFn(onProgress)) {
        try { onProgress(i, list.length, it.label || it.hash || ''); } catch (e) { /* noop */ }
      }
      if (!it.hash) return step();
      return clipDataUrl(it.hash, it.url).then(function (d) {
        if (d) { map[it.hash] = d; bytes += d.length; }
        else skipped.push(it.label || it.hash);
        return step();
      });
    }

    return step().then(function () {
      var keys = Object.keys(map);
      var lines = [
        '/* MedMaster static voice bundle - generated ' + new Date().toISOString(),
        ' *',
        ' * ' + keys.length + ' clip' + (keys.length === 1 ? '' : 's') +
          ', keyed by sha256(normalizeClinicalForTTS(line) + voiceId + modelId).',
        ' *',
        ' * Drop this file in the repo and load it BEFORE js/voice.js:',
        ' *   <script src="data/static-voice.js"></script>',
        ' *',
        ' * Every hash in here is step 2 of the clip lookup order, which means it',
        ' * costs nothing: no ElevenLabs call, no Firebase read, no Storage download,',
        ' * for anybody, ever. If the line text, the assigned voice or the model',
        ' * changes, the hash changes and these entries simply stop matching - they',
        ' * are never wrong, only unused. Re-export from Admin -> AI -> Voices.',
        ' */',
        'window.MM_STATIC_VOICE = {'
      ];
      for (var j = 0; j < keys.length; j++) {
        lines.push('  ' + JSON.stringify(keys[j]) + ': ' + JSON.stringify(map[keys[j]]) +
          (j < keys.length - 1 ? ',' : ''));
      }
      lines.push('};');
      lines.push('');
      return { text: lines.join('\n'), count: keys.length, skipped: skipped, bytes: bytes };
    });
  }

  /** Session reset, for the admin panel after a config change. Never clears Firebase. */
  function resetPremium() {
    _clipMem = {};
    _clipMemOrder = [];
    _clipInflight = {};
    _clipData = {};
    _clipDataOrder = [];
    _premium.disabled = false;
    _premium.reason = '';
    _premium.lastError = null;
    _voiceCfg.loaded = false;
    _voiceCfg.loading = null;
    _voiceStats.hits = 0; _voiceStats.misses = 0; _voiceStats.generated = 0;
    _voiceStats.chars = 0; _voiceStats.charsSaved = 0; _voiceStats.indexReads = 0;
    _voiceStats.uploads = 0; _voiceStats.uploadFailures = 0;
    _voiceStats.plays = 0; _voiceStats.fallbacks = 0;
  }

  /* Kick the profile map off early so the first speak() of a session does not
     wait on a Firebase read. Entirely best-effort; nothing depends on it. */
  try { setTimeout(function () { loadVoiceProfiles(); }, 0); } catch (e) { /* noop */ }

  /**
   * speak(text, opts) -> Promise
   *   opts: {voice, rate, pitch, volume, lang, voiceName, force, onChunk,
   *          premium:false to force the browser path}
   *   - resolves after the final chunk's onend (or immediately if muted/empty)
   *   - rejects on a real synthesis error
   *   - a new speak() cancels whatever was speaking before it
   * iOS: the FIRST call in a page session must come from a user gesture.
   *
   * Two engines behind one function. ElevenLabs is tried first when - and only
   * when - every one of these is true:
   *   - prefs allow it (master mute off, premiumVoice on)
   *   - MM.ai.getTier() is 'pro' or 'instructor'
   *   - the tier has finished resolving (MM.ai.isResolving() is false)
   *   - studio voices have not been disabled for this session by an earlier
   *     permanent failure
   *   - this profile has a voice assigned in aiConfig.voiceProfiles
   * ANY failure at all falls through to the browser path below. That is the
   * entire contract: a student never hears silence and never sees an error
   * because of a voice service they did not know existed.
   */
  function speak(text, opts) {
    opts = opts || {};
    var prefs = getPrefs();
    if (prefs.enabled === false && !opts.force) return Promise.resolve({ spoken: false, reason: 'muted' });

    var clean = normalizeForSpeech(text);
    if (!clean) return Promise.resolve({ spoken: false, reason: 'empty' });

    /* cancel anything in flight, on BOTH engines (also clears Chrome's stuck queue) */
    stopSpeaking();
    var token = _speakToken;

    /* A "not yet" answer is not a "no". If the only thing standing between
       this line and a studio voice is that the tier or the profile map is
       still in flight, wait for it (briefly) rather than burning the line on
       the device voice. Without this the FIRST line of every session - the
       patient's opening complaint, the most important one - is always the
       robot, because Firebase has not answered yet. */
    if (opts.premium !== false && premiumIsPending(opts.voice)) {
      return waitForPremiumReadiness().then(function () {
        return speakResolved(text, clean, opts, token);
      }, function () {
        return speakBrowser(clean, opts, token);
      });
    }

    return speakResolved(text, clean, opts, token);
  }

  /** True when premium is neither clearly allowed nor clearly refused yet. */
  function premiumIsPending(profileId) {
    if (_premium.disabled) return false;
    var prefs = getPrefs();
    if (prefs.premiumVoice === false) return false;
    var a = aiMod();
    if (!a || typeof a.getTier !== 'function') return false;
    if (tierIsResolving()) return true;
    if (PREMIUM_TIERS.indexOf(currentTier()) === -1) return false;
    /* Tier is fine; is the profile map simply not here yet? */
    if (!_voiceCfg.loaded && (voiceDb() || _voiceCfg.loading)) return true;
    return false;
  }

  /** Resolve the tier and the profile map, bounded so speech is never hostage. */
  function waitForPremiumReadiness() {
    var jobs = [];
    var a = aiMod();
    if (a && typeof a.onResolved === 'function' && tierIsResolving()) {
      jobs.push(new Promise(function (res) {
        var done = false;
        function fin() { if (!done) { done = true; res(); } }
        try { a.onResolved(fin); } catch (e) { fin(); }
        setTimeout(fin, TIER_WAIT_MS);
      }));
    }
    if (!_voiceCfg.loaded) {
      jobs.push(new Promise(function (res) {
        var done = false;
        function fin() { if (!done) { done = true; res(); } }
        try { Promise.resolve(loadVoiceProfiles()).then(fin, fin); } catch (e) { fin(); }
        setTimeout(fin, PROFILE_WAIT_MS);
      }));
    }
    if (!jobs.length) return Promise.resolve();
    return Promise.all(jobs).then(function () { return null; });
  }

  /** The original decision point, once nothing is pending any more. */
  function speakResolved(text, clean, opts, token) {
    if (opts.premium !== false && premiumReasonFor(opts.voice) === '') {
      _speaking = true;
      emitSpeakState();
      return speakEleven(text, opts, token).then(function (res) {
        if (res && res.spoken) {
          if (token === _speakToken && _speaking) { _speaking = false; emitSpeakState(); }
          return res;
        }
        if (res && res.reason === 'cancelled') {
          if (token === _speakToken && _speaking) { _speaking = false; emitSpeakState(); }
          return res;
        }
        _voiceStats.fallbacks++;
        return speakBrowser(clean, opts, token);
      }, function () {
        /* speakEleven never rejects, but if it ever learns how, the student
           still hears the line. */
        _voiceStats.fallbacks++;
        return speakBrowser(clean, opts, token);
      });
    }

    return speakBrowser(clean, opts, token);
  }

  /**
   * The original browser-synth path, unchanged in behaviour. Split out of
   * speak() so the ElevenLabs attempt can fall through into it without a second
   * stopSpeaking() (which would bump the token and cancel itself).
   */
  function speakBrowser(clean, opts, token) {
    var synth = getSynth();
    var Utt = getUtteranceCtor();
    if (!synth || !Utt) {
      if (token === _speakToken && _speaking) { _speaking = false; emitSpeakState(); }
      /* RESOLVE, never reject. This is the last stop in the chain: if the
         studio path already missed and this browser has no Web Speech API
         (Firefox on Linux with no speech-dispatcher, several Android WebViews
         and in-app browsers), there is simply no audio to be had. That is a
         normal outcome, not an exception - the contract at the top of the
         premium section says a student never sees an error because of it.
         Rejecting here produced unhandled rejections on every patient line;
         sim-engine.js carries a local .catch() workaround for exactly this,
         and ai-scenario.js's applyHint uses a bare try/catch that CANNOT
         catch a rejected promise. Callers already treat {spoken:false} as
         routine, so resolving fixes every one of them at once. */
      return Promise.resolve({ spoken: false, reason: 'unsupported' });
    }
    var prefs = getPrefs();

    var profile = VOICE_PROFILES[opts.voice] || VOICE_PROFILES[DEFAULT_PROFILE];
    var baseRate = (opts.rate !== undefined && opts.rate !== null) ? Number(opts.rate) : profile.rate;
    var rate = clamp(baseRate * (prefs.rate || 1), 0.5, 2);
    var pitch = clamp((opts.pitch !== undefined && opts.pitch !== null) ? opts.pitch : profile.pitch, 0, 2);
    var volume = clamp(opts.volume === undefined ? 1 : opts.volume, 0, 1);

    return whenVoicesReady().then(function () {
      if (token !== _speakToken) return { spoken: false, reason: 'cancelled' };

      var chosen = pickVoice(profile, opts.voiceName, prefs.voiceName);
      var chunks = chunkText(clean, 200);
      if (!chunks.length) return { spoken: false, reason: 'empty' };

      _speaking = true;
      emitSpeakState();
      startKeepalive();

      return new Promise(function (resolve, reject) {
        var i = 0;
        var settled = false;

        function finish(result) {
          if (settled) return;
          settled = true;
          stopKeepalive();
          if (token === _speakToken && _speaking) { _speaking = false; emitSpeakState(); }
          resolve(result);
        }
        function fail(err) {
          if (settled) return;
          settled = true;
          stopKeepalive();
          if (token === _speakToken && _speaking) { _speaking = false; emitSpeakState(); }
          reject(err);
        }

        function next() {
          if (token !== _speakToken) { finish({ spoken: false, reason: 'cancelled' }); return; }
          if (i >= chunks.length) { finish({ spoken: true, chunks: chunks.length }); return; }

          var part = chunks[i++];
          var u;
          try { u = new Utt(part); }
          catch (e) { fail(new Error('Could not create utterance: ' + e.message)); return; }

          if (chosen) { u.voice = chosen; }
          u.lang = opts.lang || (chosen && chosen.lang) || 'en-US';
          u.rate = rate;
          u.pitch = pitch;
          u.volume = volume;

          u.onstart = function () { callSafe(opts.onChunk, part, i - 1, chunks.length); };
          u.onend = function () {
            if (token !== _speakToken) { finish({ spoken: false, reason: 'cancelled' }); return; }
            /* small gap keeps Chrome from swallowing the next utterance */
            setTimeout(next, 10);
          };
          u.onerror = function (ev) {
            var code = (ev && ev.error) ? String(ev.error) : 'unknown';
            if (code === 'interrupted' || code === 'canceled' || code === 'cancelled' || token !== _speakToken) {
              finish({ spoken: false, reason: 'cancelled' });
              return;
            }
            if (code === 'not-allowed') {
              fail(new Error('Speech was blocked by the browser. On iPhone/iPad, tap a button to start audio.'));
              return;
            }
            fail(new Error('Speech synthesis failed (' + code + ').'));
          };

          try { synth.speak(u); }
          catch (e) { fail(new Error('Speech synthesis failed: ' + e.message)); }
        }

        next();
      });
    });
  }

  /* ======================================================================
   * 9. MICROPHONE PERMISSION
   * ==================================================================== */

  var _permState = 'unknown';   /* unknown | prompt | granted | denied | unsupported */
  var _permListeners = [];

  function setPermState(s) {
    if (_permState === s) return;
    _permState = s;
    for (var i = 0; i < _permListeners.length; i++) callSafe(_permListeners[i], s);
  }
  function getPermissionState() { return _permState; }
  function onPermissionChange(fn) {
    if (!isFn(fn)) return function () { };
    _permListeners.push(fn);
    return function () {
      var i = _permListeners.indexOf(fn);
      if (i >= 0) _permListeners.splice(i, 1);
    };
  }

  (function initPermission() {
    if (!hasMicApi()) { _permState = 'unsupported'; return; }
    try {
      var n = nav();
      if (n && n.permissions && isFn(n.permissions.query)) {
        n.permissions.query({ name: 'microphone' }).then(function (st) {
          setPermState(st.state);
          st.onchange = function () { setPermState(st.state); };
        })['catch'](function () { /* Firefox/Safari: name unsupported */ });
      }
    } catch (e) { }
  })();

  function requestMicPermission() {
    if (!hasMicApi()) {
      setPermState('unsupported');
      return Promise.resolve(false);
    }
    if (!isSecure()) {
      setPermState('denied');
      return Promise.resolve(false);
    }
    return nav().mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      try {
        var tracks = stream.getTracks ? stream.getTracks() : [];
        for (var i = 0; i < tracks.length; i++) tracks[i].stop();
      } catch (e) { }
      setPermState('granted');
      return true;
    })['catch'](function (err) {
      var name = err && err.name ? err.name : '';
      setPermState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'prompt');
      return false;
    });
  }

  /* ======================================================================
   * 10. STT ENGINE
   * ==================================================================== */

  var _rec = null;
  var _session = null;

  /* `stopping` makes isListening() flip to false the instant the caller asks
     to stop, rather than waiting for the engine's async onend. */
  function isListening() { return !!(_session && _session.active && !_session.stopping); }

  function stopListening() {
    if (!_session) return;
    _session.manualStop = true;
    _session.stopping = true;
    var rec = _rec;
    _rec = null;
    if (rec) {
      try { rec.onresult = null; rec.onerror = null; } catch (e) { }
      try { rec.stop(); } catch (e) {
        try { rec.abort(); } catch (e2) { }
      }
      /* if onend never fires (some Safari builds), finalize ourselves */
      var s = _session;
      setTimeout(function () {
        if (s && s.active) finalizeSession(s);
      }, 700);
    } else if (_session) {
      finalizeSession(_session);
    }
  }

  function finalizeSession(s) {
    if (!s || !s.active) return;
    s.active = false;
    if (_session === s) _session = null;
    var text = correctMedicalTerms(s.transcript);
    callSafe(s.opts.onEnd, text);
  }

  function errorMessage(code) {
    switch (code) {
      case 'not-allowed':
        return 'Microphone access was blocked. Allow the microphone for this site in your browser settings, then try again.';
      case 'service-not-allowed':
        return 'Your browser blocked the speech service. Check the site permissions (microphone) and that you are on https.';
      case 'audio-capture':
        return 'No microphone was found. Plug one in or check your device settings.';
      case 'network':
        return 'The speech service could not be reached. Check your connection and try again.';
      case 'no-speech':
        return 'I did not hear anything. Try speaking a little closer to the microphone.';
      case 'aborted':
        return 'Listening stopped.';
      case 'language-not-supported':
        return 'This language is not supported by the speech service.';
      default:
        return 'Speech recognition error (' + code + ').';
    }
  }

  /**
   * listen(opts) -> stop()
   *   opts: {onResult(fullText,isFinal,info), onEnd(finalText), onError(err),
   *          onStart(), continuous, lang, interimResults, resetOnFinal}
   *   - transcript accumulates across auto-restarts in continuous mode
   *   - transient no-speech / aborted restart automatically when continuous
   */
  function listen(opts) {
    opts = opts || {};
    var noop = function () { };

    if (!SR_CTOR) {
      var e1 = new Error(unsupportedReason());
      e1.code = 'unsupported';
      callSafe(opts.onError, e1);
      callSafe(opts.onEnd, '');
      return noop;
    }
    if (!isSecure()) {
      var e2 = new Error('The microphone needs a secure (https) connection. Open this page over https and try again.');
      e2.code = 'insecure-context';
      callSafe(opts.onError, e2);
      callSafe(opts.onEnd, '');
      return noop;
    }

    /* only one recogniser at a time */
    if (_session) stopListening();

    var session = {
      active: true,
      opts: opts,
      transcript: '',
      manualStop: false,
      fatal: false,
      restarts: 0,
      lastStart: 0
    };
    _session = session;

    function buildRecognition() {
      var rec = new SR_CTOR();
      rec.continuous = !!opts.continuous;
      rec.interimResults = opts.interimResults === false ? false : true;
      rec.lang = opts.lang || 'en-US';
      try { rec.maxAlternatives = 1; } catch (e) { }

      rec.onstart = function () {
        setPermState('granted');
        callSafe(opts.onStart);
      };

      rec.onresult = function (ev) {
        if (!session.active) return;
        var interim = '';
        var latestFinal = '';
        try {
          for (var i = ev.resultIndex; i < ev.results.length; i++) {
            var r = ev.results[i];
            var txt = (r[0] && r[0].transcript) ? r[0].transcript : '';
            if (r.isFinal) {
              latestFinal += txt;
            } else {
              interim += txt;
            }
          }
        } catch (e) { return; }

        if (latestFinal) {
          session.transcript = (session.transcript + ' ' + latestFinal).replace(/\s{2,}/g, ' ').trim();
        }
        var full = correctMedicalTerms((session.transcript + ' ' + interim).trim());
        var info = {
          latest: correctMedicalTerms(latestFinal || interim),
          interim: correctMedicalTerms(interim),
          raw: (session.transcript + ' ' + interim).trim()
        };
        callSafe(opts.onResult, full, !!latestFinal && !interim, info);

        if (latestFinal && opts.resetOnFinal) session.transcript = '';
      };

      rec.onerror = function (ev) {
        var code = (ev && ev.error) ? String(ev.error) : 'unknown';
        if (code === 'no-speech' || code === 'aborted') {
          /* transient: onend will restart when continuous */
          if (!opts.continuous) {
            var te = new Error(errorMessage(code));
            te.code = code;
            te.transient = true;
            callSafe(opts.onError, te);
          }
          return;
        }
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setPermState('denied');
          session.fatal = true;
        }
        if (code === 'audio-capture' || code === 'language-not-supported') session.fatal = true;
        if (code === 'network') session.networkFails = (session.networkFails || 0) + 1;
        if ((session.networkFails || 0) >= 3) session.fatal = true;

        var err = new Error(errorMessage(code));
        err.code = code;
        callSafe(opts.onError, err);
      };

      rec.onend = function () {
        if (!session.active) return;
        var wantRestart = !!opts.continuous && !session.manualStop && !session.fatal;
        if (wantRestart) {
          var now = Date.now();
          var quick = (now - session.lastStart) < 400;
          session.quickFails = quick ? (session.quickFails || 0) + 1 : 0;
          session.restarts++;
          /* bail out of a hot restart loop rather than pin the CPU */
          if (session.quickFails > 6 || session.restarts > 400) {
            var le = new Error('Listening stopped: the browser kept dropping the microphone. Try again, or type your answer.');
            le.code = 'restart-loop';
            callSafe(opts.onError, le);
            finalizeSession(session);
            return;
          }
          setTimeout(function () {
            if (!session.active || session.manualStop) { return; }
            try {
              session.lastStart = Date.now();
              rec.start();
            } catch (e) {
              /* InvalidStateError -> rebuild a fresh recogniser */
              try {
                var fresh = buildRecognition();
                _rec = fresh;
                session.lastStart = Date.now();
                fresh.start();
              } catch (e2) {
                finalizeSession(session);
              }
            }
          }, quick ? 400 : 120);
          return;
        }
        finalizeSession(session);
      };

      return rec;
    }

    try {
      _rec = buildRecognition();
      session.lastStart = Date.now();
      _rec.start();
    } catch (e) {
      var err = new Error('Could not start the microphone: ' + (e && e.message ? e.message : 'unknown error'));
      err.code = 'start-failed';
      callSafe(opts.onError, err);
      finalizeSession(session);
      return noop;
    }

    return function stop() {
      if (_session === session) stopListening();
      else if (session.active) { session.manualStop = true; finalizeSession(session); }
    };
  }

  /* ======================================================================
   * 11. SBAR SUPPORT
   * ==================================================================== */

  var SBAR_SECTIONS = [
    { key: 'situation',      letter: 'S', name: 'Situation' },
    { key: 'background',     letter: 'B', name: 'Background' },
    { key: 'assessment',     letter: 'A', name: 'Assessment' },
    { key: 'recommendation', letter: 'R', name: 'Recommendation' }
  ];

  var SBAR_CUES = {
    situation: [
      'this is', 'my name is', 'i am the nurse', 'this is the nurse', 'nurse on',
      'calling about', 'i am calling', 'calling regarding', 'i have a patient',
      'the reason i am calling', 'in room', 'room number', 'the situation is',
      'patient is a', 'year old'
    ],
    background: [
      'history', 'past medical', 'admitted', 'admitted for', 'came in',
      'background', 'he was admitted', 'she was admitted', 'diagnosis of',
      'allergies', 'code status', 'post op', 'post operative', 'day two',
      'has a history of', 'takes', 'home medications', 'g p', 'gravida'
    ],
    assessment: [
      'vital signs', 'vitals are', 'currently', 'right now', 'assessment',
      'on exam', 'lung sounds', 'blood pressure is', 'heart rate is',
      'respiratory rate', 'temperature is', 'o2 saturation', 'oxygen saturation',
      'labs show', 'i think', 'my assessment', 'appears', 'i am concerned',
      'skin is', 'level of consciousness', 'pain is'
    ],
    recommendation: [
      'i recommend', 'i need', 'i would like', 'i am requesting', 'request',
      'can you come', 'could you come', 'please order', 'would you like',
      'recommendation', 'asking for', 'do you want', 'i suggest',
      'should i', 'orders for', 'transfer to'
    ]
  };

  /**
   * Which SBAR section does this speech belong to?
   * Pass the MOST RECENT utterance, not the whole transcript - scoring the
   * whole thing keeps the opening "this is the nurse calling about..." cues
   * winning forever and the strip never advances past Situation.
   * `floorIdx` makes the answer sticky and forward-only.
   */
  function detectSbarSection(text, floorIdx) {
    var t = str(text).toLowerCase();
    if (!t) return typeof floorIdx === 'number' ? floorIdx : 0;
    var tail = t.slice(-260);
    var best = -1, bestScore = 0;
    for (var i = 0; i < SBAR_SECTIONS.length; i++) {
      var cues = SBAR_CUES[SBAR_SECTIONS[i].key];
      var score = 0;
      for (var c = 0; c < cues.length; c++) {
        if (tail.indexOf(cues[c]) >= 0) score += 1 + (cues[c].length > 12 ? 1 : 0);
      }
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) return typeof floorIdx === 'number' ? floorIdx : 0;
    /* nurses report in order: only ever move forward, never backwards */
    if (typeof floorIdx === 'number' && best < floorIdx) return floorIdx;
    return best;
  }

  var STOPWORDS = {
    the: 1, and: 1, for: 1, with: 1, that: 1, this: 1, from: 1, has: 1, have: 1,
    his: 1, her: 1, she: 1, they: 1, are: 1, was: 1, were: 1, been: 1, being: 1,
    you: 1, your: 1, our: 1, its: 1, but: 1, not: 1, all: 1, any: 1, can: 1,
    will: 1, would: 1, should: 1, could: 1, about: 1, into: 1, over: 1, per: 1,
    also: 1, more: 1, most: 1, some: 1, than: 1, then: 1, them: 1, there: 1,
    here: 1, when: 1, what: 1, which: 1, who: 1, how: 1, now: 1, out: 1, off: 1,
    patient: 1, nurse: 1, calling: 1, doctor: 1, provider: 1
  };

  function keywordsOf(text) {
    var t = str(text).toLowerCase().replace(/[^a-z0-9\s/.]/g, ' ');
    var toks = t.split(/\s+/);
    var seen = {}, out = [];
    for (var i = 0; i < toks.length; i++) {
      var w = toks[i].replace(/^[.\/]+|[.\/]+$/g, '');
      if (!w) continue;
      if (/^\d/.test(w)) {
        if (w.length < 2) continue;
      } else {
        if (w.length < 5) continue;
        if (STOPWORDS[w]) continue;
      }
      if (seen[w]) continue;
      seen[w] = 1;
      out.push(w);
    }
    return out;
  }

  function transcriptHas(hayLower, word) {
    if (hayLower.indexOf(word) >= 0) return true;
    /* forgive plural / tense endings */
    if (word.length > 6) {
      var stem = word.replace(/(ing|ed|es|s)$/, '');
      if (stem.length > 4 && hayLower.indexOf(stem) >= 0) return true;
    }
    return false;
  }

  /** Offline fallback grader: keyword coverage of the scenario's own sbar. */
  function gradeSbarLocally(scenario, transcript) {
    var sbar = (scenario && scenario.sbar) ? scenario.sbar : {};
    var hay = str(transcript).toLowerCase();
    var perSection = 25;
    var breakdown = [];
    var missing = [];
    var total = 0;

    for (var i = 0; i < SBAR_SECTIONS.length; i++) {
      var sec = SBAR_SECTIONS[i];
      var model = str(sbar[sec.key]);
      var kws = keywordsOf(model);
      var hit = [], miss = [];
      for (var k = 0; k < kws.length; k++) {
        if (transcriptHas(hay, kws[k])) hit.push(kws[k]); else miss.push(kws[k]);
      }
      var frac = kws.length ? (hit.length / kws.length) : (hay ? 0.6 : 0);
      /* credit the structural cue words too, so a well-formed report scores */
      var cues = SBAR_CUES[sec.key];
      var cueHit = 0;
      for (var c = 0; c < cues.length; c++) { if (hay.indexOf(cues[c]) >= 0) cueHit++; }
      var cueBonus = Math.min(0.2, cueHit * 0.05);
      var pct = Math.min(1, frac * 0.85 + cueBonus);
      var score = Math.round(pct * perSection);
      total += score;

      breakdown.push({
        section: sec.name,
        key: sec.key,
        score: score,
        max: perSection,
        note: kws.length
          ? (hit.length + ' of ' + kws.length + ' key details covered')
          : 'No model text for this section in the scenario'
      });
      if (miss.length) {
        missing.push({
          section: sec.name,
          items: miss.slice(0, 8)
        });
      }
    }

    var pct = Math.round((total / 100) * 100);
    var feedback;
    if (!hay) {
      feedback = 'No speech was captured. Check your microphone and try recording again.';
    } else if (pct >= 85) {
      feedback = 'Strong report. You hit nearly all of the key details in each SBAR section and used clear handoff structure.';
    } else if (pct >= 70) {
      feedback = 'Solid report. Tighten up the sections flagged below - name the specific numbers (vitals, labs, doses) rather than saying "abnormal" or "off".';
    } else if (pct >= 50) {
      feedback = 'You have the shape of an SBAR but several key details are missing. Practice stating: who you are and who the patient is, the one-line reason for the call, the current vitals with numbers, and a specific ask.';
    } else {
      feedback = 'Rebuild this report section by section. Say your name and unit, the patient and the problem, the relevant history, the current vitals with actual numbers, and then exactly what you need from the provider.';
    }

    return {
      score: total, maxScore: 100, pct: pct,
      breakdown: breakdown, missing: missing, strengths: [],
      feedback: feedback,
      source: 'local'
    };
  }

  /**
   * Normalise whatever MM.ai.gradeSBAR gives back into our render shape.
   * js/ai.js currently returns {score, maxScore:20, pct, breakdown:{situation:0-5,
   * background, assessment, recommendation}, missing:[string], strengths:[string],
   * feedback} - and {parseError:true} when the model's JSON was unreadable.
   * Returns `fallback` (the local keyword score) if the payload is unusable, so
   * the student always sees something.
   */
  function normalizeGrade(raw, fallback) {
    if (!raw || typeof raw !== 'object') return fallback;
    if (raw.parseError) return fallback;
    var maxScore = Number(raw.maxScore || raw.max || 100) || 100;
    var score = Number(raw.score);
    if (isNaN(score)) {
      if (!isNaN(Number(raw.pct))) score = Math.round(Number(raw.pct) / 100 * maxScore);
      else return fallback;
    }
    var sectionMax = Math.max(1, Math.round(maxScore / 4));
    var breakdown = [];
    var b = raw.breakdown || raw.sections;
    if (b && b.length !== undefined) {
      for (var i = 0; i < b.length; i++) {
        var r = b[i] || {};
        breakdown.push({
          section: str(r.section || r.name || r.key || ('Section ' + (i + 1))),
          key: str(r.key || r.section || '').toLowerCase(),
          score: Number(r.score) || 0,
          max: Number(r.max || r.maxScore || sectionMax) || sectionMax,
          note: str(r.note || r.comment || r.feedback || '')
        });
      }
    } else if (b && typeof b === 'object') {
      for (var j = 0; j < SBAR_SECTIONS.length; j++) {
        var key = SBAR_SECTIONS[j].key;
        if (b[key] === undefined) continue;
        var v = b[key];
        breakdown.push({
          section: SBAR_SECTIONS[j].name,
          key: key,
          score: typeof v === 'object' ? (Number(v.score) || 0) : (Number(v) || 0),
          max: typeof v === 'object' ? (Number(v.max) || sectionMax) : sectionMax,
          note: typeof v === 'object' ? str(v.note || v.feedback || '') : ''
        });
      }
    }
    if (!breakdown.length) breakdown = fallback.breakdown;

    var missing = [];
    var loose = [];
    var m = raw.missing || raw.missed || raw.missingItems;
    if (m && m.length !== undefined) {
      for (var k = 0; k < m.length; k++) {
        var item = m[k];
        if (typeof item === 'string') { if (item) loose.push(item); }
        else if (item && item.items) missing.push({ section: str(item.section), items: item.items });
        else if (item) {
          var one = str(item.text || item.item || '');
          if (one) loose.push(one);
        }
      }
    }
    if (loose.length) missing.push({ section: '', items: loose });
    if (!missing.length) missing = fallback.missing;

    var strengths = [];
    if (raw.strengths && raw.strengths.length !== undefined) {
      for (var q = 0; q < raw.strengths.length; q++) {
        var sg = str(raw.strengths[q]);
        if (sg) strengths.push(sg);
      }
    }

    return {
      score: score,
      maxScore: maxScore,
      pct: Math.round(score / maxScore * 100),
      breakdown: breakdown,
      missing: missing,
      strengths: strengths,
      feedback: str(raw.feedback || raw.comments || raw.summary || fallback.feedback),
      source: 'ai'
    };
  }

  function aiAvailable() {
    var ai = window.MM ? window.MM.ai : null;
    if (!ai || !isFn(ai.gradeSBAR)) return false;
    if (isFn(ai.isAvailable)) { try { return !!ai.isAvailable(); } catch (e) { return false; } }
    return true;
  }

  /* ----------------------------------------------------------------------
   * "CHECKING YOUR PLAN"
   * MM.ai.isResolving() is true until Firebase has answered with this
   * student's tier. Grading against the keyword fallback during that window
   * would stamp "AI grading was unavailable" onto a paying student's report
   * for no reason other than timing, so we wait for the answer first.
   * Feature-detected, and time-boxed so a broken resolution can never hang a
   * grade: ai.js already self-resolves at 6s, this is only a belt-and-braces
   * ceiling on top of it.
   * -------------------------------------------------------------------- */
  var AI_RESOLVE_WAIT_MS = 7000;

  function aiResolving() {
    var ai = window.MM ? window.MM.ai : null;
    try { return !!(ai && isFn(ai.isResolving) && ai.isResolving()); }
    catch (e) { return false; }
  }

  function whenAiResolved() {
    var ai = window.MM ? window.MM.ai : null;
    if (!aiResolving() || !ai || !isFn(ai.onResolved)) return Promise.resolve();
    return new Promise(function (done) {
      var settled = false;
      var off = null;
      function finish() {
        if (settled) return;
        settled = true;
        if (isFn(off)) { try { off(); } catch (e) { /* noop */ } }
        done();
      }
      try { off = ai.onResolved(finish); } catch (e) { finish(); return; }
      setTimeout(finish, AI_RESOLVE_WAIT_MS);
    });
  }

  /** Grade an SBAR report: AI when we can, keyword coverage when we cannot. */
  function gradeSbar(scenario, transcript) {
    // Never decide "no AI for you" off a tier we have not read yet.
    if (aiResolving()) {
      return whenAiResolved().then(function () { return gradeSbarNow(scenario, transcript); });
    }
    return gradeSbarNow(scenario, transcript);
  }

  /**
   * MM.ai.gradeSBAR never rejects. On any failure it RESOLVES with
   * {score:0, breakdown:{all zeros}, error:'<code>', feedback:'<why>'} - a
   * shape normalizeGrade() happily accepts, because 0 is a valid number.
   * So a quota wall, a dropped connection or a signed-out session used to
   * render as a 0 / 20 report tagged "AI graded", with the error sentence
   * sitting where the coaching should be. A student cannot tell that apart
   * from "you scored nothing".
   *
   * Any resolved-but-failed payload therefore falls back to the local keyword
   * score, and carries the code out on `aiError` so the caller can say what
   * actually happened.
   */
  function withAiError(res, fallback) {
    var out = {};
    for (var k in fallback) {
      if (Object.prototype.hasOwnProperty.call(fallback, k)) out[k] = fallback[k];
    }
    out.aiError = (res && res.error) ? String(res.error) : 'server';
    return out;
  }

  function gradeSbarNow(scenario, transcript) {
    var local = gradeSbarLocally(scenario, transcript);
    /* Nothing was captured. There is nothing for a grader to read, and asking
       anyway spent an AI message to be told a score for silence - the model
       happily returns "85%, strong report" for an empty string, which is the
       one grade a student must never be shown. The local score already says
       the honest thing ("No speech was captured"). */
    if (!str(transcript).trim()) return Promise.resolve(local);
    if (!aiAvailable()) return Promise.resolve(local);
    var p;
    try { p = window.MM.ai.gradeSBAR(scenario, transcript); }
    catch (e) { return Promise.resolve(withAiError({ error: (e && e.code) || 'server' }, local)); }
    return Promise.resolve(p)
      .then(function (res) {
        if (typeof res === 'string') {
          try { res = JSON.parse(res); } catch (e) { return withAiError({ error: 'server' }, local); }
        }
        /* An AI failure disguised as a zero. Never score it. */
        if (res && res.error) return withAiError(res, local);
        /* Unreadable JSON from the model. normalizeGrade already falls back on
           parseError; tag it so the report can say why it is keyword scored. */
        if (res && res.parseError) return withAiError({ error: 'unreadable' }, local);
        return normalizeGrade(res, local);
      })['catch'](function (e) {
        return withAiError({ error: (e && e.code) || 'server' }, local);
      });
  }

  /* ======================================================================
   * 12. HANDS-FREE COMMANDS
   * ==================================================================== */

  var DEFAULT_COMMANDS = [
    { id: 'assess-airway',   label: 'Assess airway',      aliases: ['assess airway', 'check the airway', 'airway assessment', 'look at the airway', 'is the airway patent'] },
    { id: 'assess-breathing', label: 'Assess breathing',  aliases: ['assess breathing', 'check breathing', 'listen to lungs', 'listen to the lungs', 'lung sounds', 'auscultate lungs', 'breath sounds'] },
    { id: 'check-vitals',    label: 'Check vitals',       aliases: ['check vitals', 'take vitals', 'get vitals', 'get a set of vitals', 'recheck vitals', 'vital signs'] },
    { id: 'give-oxygen',     label: 'Give oxygen',        aliases: ['give oxygen', 'apply oxygen', 'start oxygen', 'put on oxygen', 'oxygen by nasal cannula', 'apply o2'] },
    { id: 'call-provider',   label: 'Call provider',      aliases: ['call provider', 'call the provider', 'call the doctor', 'notify the provider', 'page the physician', 'call rapid response', 'notify the physician'] },
    { id: 'next-step',       label: 'Next step',          aliases: ['next step', 'next', 'move on', 'continue', 'go on'] },
    { id: 'repeat-that',     label: 'Repeat that',        aliases: ['repeat that', 'say that again', 'say again', 'repeat', 'one more time'] },
    { id: 'what-vitals',     label: 'What are the vitals', aliases: ['what are the vitals', 'read the vitals', 'tell me the vitals', 'what are her vitals', 'what are his vitals', 'current vitals'] },
    { id: 'pause',           label: 'Pause',              aliases: ['pause', 'pause the sim', 'hold on', 'time out'] },
    { id: 'resume',          label: 'Resume',             aliases: ['resume', 'resume the sim', 'continue the sim', 'start again', 'unpause'] },
    { id: 'help',            label: 'Help',               aliases: ['help', 'what can i say', 'show commands', 'list commands'] }
  ];

  function normalizePhrase(s) {
    return str(s).toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function commandAliases(cmd) {
    if (typeof cmd === 'string') return [normalizePhrase(cmd)];
    var out = [];
    if (cmd.phrase) out.push(normalizePhrase(cmd.phrase));
    if (cmd.label) out.push(normalizePhrase(cmd.label));
    if (cmd.id) out.push(normalizePhrase(String(cmd.id).replace(/[-_]/g, ' ')));
    var a = cmd.aliases || [];
    for (var i = 0; i < a.length; i++) out.push(normalizePhrase(a[i]));
    var seen = {}, uniq = [];
    for (var j = 0; j < out.length; j++) {
      if (!out[j] || seen[out[j]]) continue;
      seen[out[j]] = 1; uniq.push(out[j]);
    }
    return uniq;
  }

  function commandLabel(cmd) {
    if (typeof cmd === 'string') return cmd;
    return str(cmd.label || cmd.phrase || cmd.id);
  }

  /**
   * Fuzzy match a spoken phrase against a command list.
   * Whole-alias inclusion wins; otherwise the alias with the highest share of
   * its words present in the utterance wins (>= 0.6 required).
   */
  function matchCommand(spoken, commands) {
    var said = normalizePhrase(spoken);
    if (!said) return null;
    var best = null, bestScore = 0;

    for (var i = 0; i < commands.length; i++) {
      var cmd = commands[i];
      var aliases = commandAliases(cmd);
      for (var a = 0; a < aliases.length; a++) {
        var alias = aliases[a];
        if (!alias) continue;
        var score = 0;

        if (said === alias) score = 1000 + alias.length;
        else if (said.indexOf(alias) >= 0) score = 500 + alias.length;
        else {
          var words = alias.split(' ');
          var hit = 0;
          for (var w = 0; w < words.length; w++) {
            if (words[w].length < 2) { hit += 0.5; continue; }
            var re = new RegExp('\\b' + words[w].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
            if (re.test(said)) hit++;
          }
          var frac = words.length ? hit / words.length : 0;
          if (frac >= 0.6) score = Math.round(frac * 100) + words.length;
        }

        if (score > bestScore) { bestScore = score; best = cmd; }
      }
    }
    return bestScore > 0 ? best : null;
  }

  /* ======================================================================
   * 13. PUBLIC API
   * ==================================================================== */

  var voiceApi = {
    /* capability */
    isSupported: isSupported,
    unsupportedReason: unsupportedReason,
    browserName: browserName,
    isSecureContext: isSecure,
    hasMicApi: hasMicApi,

    /* tts */
    speak: speak,
    stopSpeaking: stopSpeaking,
    isSpeaking: isSpeaking,
    prime: prime,
    getVoices: getVoices,
    whenVoicesReady: whenVoicesReady,
    onSpeakingChange: onSpeakingChange,
    PROFILES: VOICE_PROFILES,

    /* stt */
    listen: listen,
    stopListening: stopListening,
    isListening: isListening,
    correctMedicalTerms: correctMedicalTerms,

    /* text prep (exported so other modules can reuse) */
    normalizeForSpeech: normalizeForSpeech,
    stripMarkdown: stripMarkdown,
    chunkText: chunkText,
    ABBREVIATIONS: SPEECH_EXPANSIONS,
    CORRECTIONS: MEDICAL_CORRECTIONS,

    /* ---- studio voices (ElevenLabs). ALL ADDITIVE - every existing member
       above behaves exactly as it did before this layer existed, and with no
       voice configured this whole block is inert. ---- */
    isPremium: isPremium,
    premiumReason: premiumReason,
    premiumReasonFor: premiumReasonFor,
    stats: voiceStatsSnapshot,
    normalizeClinicalForTTS: normalizeClinicalForTTS,
    /* admin + pre-generate surface */
    listElevenVoices: listElevenVoices,
    elevenQuota: elevenQuota,
    listClipCache: listClipCache,
    dialogueList: dialogueList,
    lookupClip: lookupClip,
    getClip: getClip,
    clipRequest: clipRequest,
    clipHash: clipHash,
    clipDataUrl: clipDataUrl,
    exportStaticVoice: exportStaticVoice,
    resetPremium: resetPremium,
    loadVoiceProfiles: loadVoiceProfiles,
    profileVoice: profileVoice,
    TTS_MODELS: TTS_MODELS,
    PROFILE_ORDER: PROFILE_ORDER,
    PREMIUM_TIERS: PREMIUM_TIERS,
    DEFAULT_TTS_MODEL: DEFAULT_TTS_MODEL,
    TEST_LINE: TEST_LINE,
    VOICE_CACHE_PATH: VOICE_CACHE_PATH,
    VOICE_STORAGE_ROOT: VOICE_STORAGE_ROOT,
    TTS_ENDPOINT: TTS_ENDPOINT_DEFAULT,

    /* permissions */
    requestMicPermission: requestMicPermission,
    getPermissionState: getPermissionState,
    onPermissionChange: onPermissionChange,

    /* prefs */
    getPrefs: getPrefs,
    setPrefs: setPrefs,
    onPrefsChange: onPrefsChange,

    /* sbar helpers */
    SBAR_SECTIONS: SBAR_SECTIONS,
    detectSbarSection: detectSbarSection,
    gradeSbar: gradeSbar,
    gradeSbarLocally: gradeSbarLocally,

    /* hands free */
    DEFAULT_COMMANDS: DEFAULT_COMMANDS,
    matchCommand: matchCommand
  };

  window.MM.voice = voiceApi;

  /* ======================================================================
   * 14. SHARED ICONS
   * ==================================================================== */

  function svg(props, children) {
    var p = {
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': 'true', focusable: 'false'
    };
    for (var k in props) { if (Object.prototype.hasOwnProperty.call(props, k)) p[k] = props[k]; }
    return ce('svg', p, children);
  }
  function IconMic(cls) {
    return svg({ className: cls || 'mmv-mic-ico', key: 'mic' }, [
      ce('rect', { key: 'a', x: 9, y: 2, width: 6, height: 12, rx: 3 }),
      ce('path', { key: 'b', d: 'M5 10a7 7 0 0 0 14 0' }),
      ce('path', { key: 'c', d: 'M12 17v4' })
    ]);
  }
  function IconStopSquare(cls) {
    return svg({ className: cls || 'mmv-mic-ico', key: 'stop' }, [
      ce('rect', { key: 'a', x: 6, y: 6, width: 12, height: 12, rx: 2, fill: 'currentColor' })
    ]);
  }
  function IconSpeaker(cls) {
    return svg({ className: cls || 'mmv-mic-ico', key: 'spk' }, [
      ce('path', { key: 'a', d: 'M4 9v6h4l5 4V5L8 9H4z' }),
      ce('path', { key: 'b', d: 'M16.5 8.5a5 5 0 0 1 0 7' }),
      ce('path', { key: 'c', d: 'M19 6a9 9 0 0 1 0 12' })
    ]);
  }
  function IconSpinner(cls) {
    return svg({ className: cls || 'mmv-mic-ico', key: 'sp' }, [
      ce('path', {
        key: 'a', d: 'M12 3a9 9 0 1 0 9 9',
        style: { transformOrigin: '12px 12px', animation: 'mmv-spin 1s linear infinite' }
      })
    ]);
  }
  if (!document.getElementById('mmvoice-spin')) {
    var sp = document.createElement('style');
    sp.id = 'mmvoice-spin';
    sp.textContent = '@keyframes mmv-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(sp);
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ======================================================================
   * 15. <VoiceButton>
   *     props: {onTranscript, continuous, label, size, lang, onInterim,
   *             className, disabled}
   * ==================================================================== */

  function VoiceButton(props) {
    var p = props || {};
    var sup = isSupported();
    var stt = sup.stt;

    var stateHook = useState('idle');           /* idle | listening | processing */
    var state = stateHook[0], setState = stateHook[1];
    var interimHook = useState('');
    var interim = interimHook[0], setInterim = interimHook[1];
    var errHook = useState('');
    var err = errHook[0], setErr = errHook[1];

    var stopRef = useRef(null);
    var aliveRef = useRef(true);

    useEffect(function () {
      aliveRef.current = true;
      return function () {
        aliveRef.current = false;
        if (stopRef.current) { callSafe(stopRef.current); stopRef.current = null; }
      };
    }, []);

    var start = useCallback(function () {
      if (!stt) return;
      setErr('');
      setInterim('');
      setState('listening');
      prime(); /* iOS: unlock TTS while we are inside a real gesture */

      stopRef.current = listen({
        continuous: !!p.continuous,
        lang: p.lang,
        onResult: function (text, isFinal, info) {
          if (!aliveRef.current) return;
          setInterim(text);
          callSafe(p.onInterim, text, isFinal, info);
        },
        onEnd: function (finalText) {
          if (!aliveRef.current) return;
          stopRef.current = null;
          setState('processing');
          setInterim('');
          setTimeout(function () {
            if (!aliveRef.current) return;
            setState('idle');
            if (finalText) callSafe(p.onTranscript, finalText);
          }, 120);
        },
        onError: function (e) {
          if (!aliveRef.current) return;
          if (e && e.transient) return;
          setErr(e && e.message ? e.message : 'Microphone error.');
          setState('idle');
        }
      });
    }, [stt, p.continuous, p.lang, p.onTranscript, p.onInterim]);

    var stop = useCallback(function () {
      if (stopRef.current) { callSafe(stopRef.current); stopRef.current = null; }
      setState('processing');
    }, []);

    function onClick() {
      if (state === 'listening') stop(); else start();
    }

    var listening = state === 'listening';
    var processing = state === 'processing';
    var size = p.size === 'lg' ? 'lg' : (p.size === 'sm' ? 'sm' : '');
    var label = p.label !== undefined ? p.label
      : (listening ? 'Stop' : (processing ? 'Working...' : 'Speak'));

    var cls = 'mmv-mic' + (size ? ' ' + size : '') +
      (listening ? ' is-listening' : '') +
      (processing ? ' is-processing' : '') +
      (p.className ? ' ' + p.className : '');

    var kids = [];
    if (listening) {
      kids.push(ce('span', { className: 'mmv-pulse', key: 'p1' }));
      kids.push(ce('span', { className: 'mmv-pulse d2', key: 'p2' }));
      kids.push(ce('span', { className: 'mmv-pulse d3', key: 'p3' }));
      kids.push(IconStopSquare());
    } else if (processing) {
      kids.push(IconSpinner());
    } else {
      kids.push(IconMic());
    }
    if (label) kids.push(ce('span', { key: 'lbl' }, label));

    var disabled = !stt || !!p.disabled;
    var tip = !stt ? unsupportedReason() : (p.title || '');

    var out = [
      ce('button', {
        key: 'btn',
        type: 'button',
        className: cls,
        onClick: onClick,
        disabled: disabled,
        title: tip,
        'aria-label': disabled ? 'Voice input unavailable' : (listening ? 'Stop recording' : 'Start voice input'),
        'aria-pressed': listening ? 'true' : 'false'
      }, kids)
    ];

    if (!stt) {
      out.push(ce('div', { className: 'mmv-note', key: 'unsup', role: 'note' }, unsupportedReason()));
    }
    if (err) {
      out.push(ce('div', { className: 'mmv-note err', key: 'err', role: 'alert' }, err));
    }
    if (listening || interim) {
      out.push(ce('div', { className: 'mmv-bubble', key: 'bub', 'aria-live': 'polite' },
        interim
          ? ce('span', { className: 'mmv-interim' }, interim)
          : ce('span', { className: 'mmv-muted' }, 'Listening...')
      ));
    }

    return ce('div', { className: 'mmv-col' }, out);
  }

  /* ======================================================================
   * 16. <SpeakButton>
   *     props: {text, voice, label, rate, className, title}
   * ==================================================================== */

  function SpeakButton(props) {
    var p = props || {};
    var sup = isSupported();
    var speakingHook = useState(false);
    var speaking = speakingHook[0], setSpeaking = speakingHook[1];
    var aliveRef = useRef(true);
    var mineRef = useRef(false);

    useEffect(function () {
      aliveRef.current = true;
      return function () {
        aliveRef.current = false;
        if (mineRef.current) stopSpeaking();
      };
    }, []);

    /* if something else starts speaking, drop our "speaking" state */
    useEffect(function () {
      return onSpeakingChange(function (on) {
        if (!aliveRef.current) return;
        if (!on) { mineRef.current = false; setSpeaking(false); }
      });
    }, []);

    function onClick() {
      if (!sup.tts) return;
      prime(); /* iOS: must happen inside the gesture */
      if (speaking || mineRef.current) {
        stopSpeaking();
        mineRef.current = false;
        setSpeaking(false);
        return;
      }
      mineRef.current = true;
      setSpeaking(true);
      speak(p.text, { voice: p.voice, rate: p.rate, force: true })
        .then(function () {
          if (!aliveRef.current) return;
          mineRef.current = false;
          setSpeaking(false);
        })['catch'](function (e) {
          if (!aliveRef.current) return;
          mineRef.current = false;
          setSpeaking(false);
          if (window.MM && isFn(window.MM.toast)) {
            window.MM.toast(e && e.message ? e.message : 'Could not play audio.', 'error');
          }
        });
    }

    var kids = [speaking ? IconStopSquare() : IconSpeaker()];
    if (p.label) kids.push(ce('span', { key: 'l' }, p.label));

    return ce('button', {
      type: 'button',
      className: 'mmv-speak' + (speaking ? ' is-speaking' : '') + (p.className ? ' ' + p.className : ''),
      onClick: onClick,
      disabled: !sup.tts || !str(p.text),
      title: !sup.tts
        ? ('Text-to-speech is not available in ' + browserName() + '.')
        : (p.title || (speaking ? 'Stop' : 'Read aloud')),
      'aria-label': speaking ? 'Stop reading' : 'Read aloud'
    }, kids);
  }

  /* ======================================================================
   * 17. <VoiceSettings>
   * ==================================================================== */

  function Switch(props) {
    var p = props || {};
    return ce('button', {
      type: 'button',
      className: 'mmv-switch',
      'data-on': p.on ? '1' : '0',
      role: 'switch',
      'aria-checked': p.on ? 'true' : 'false',
      'aria-label': p.label || 'toggle',
      onClick: function () { callSafe(p.onChange, !p.on); }
    }, ce('span', { className: 'mmv-knob' }));
  }

  function yesNo(v, unknownText) {
    if (v === true) return ce('span', { className: 'mmv-yes' }, 'Yes');
    if (v === false) return ce('span', { className: 'mmv-no' }, 'No');
    return ce('span', { className: 'mmv-maybe' }, unknownText || 'Unknown');
  }

  function VoiceSettings() {
    var prefsHook = useState(getPrefs());
    var prefs = prefsHook[0], setLocalPrefs = prefsHook[1];
    var voicesHook = useState(getVoices());
    var voices = voicesHook[0], setVoices = voicesHook[1];
    var permHook = useState(getPermissionState());
    var perm = permHook[0], setPerm = permHook[1];
    var busyHook = useState(false);
    var busy = busyHook[0], setBusy = busyHook[1];

    var aliveRef = useRef(true);

    useEffect(function () {
      aliveRef.current = true;
      whenVoicesReady().then(function () {
        if (aliveRef.current) setVoices(getVoices());
      });
      var offPerm = onPermissionChange(function (s) { if (aliveRef.current) setPerm(s); });
      var offPrefs = onPrefsChange(function (p) { if (aliveRef.current) setLocalPrefs(p); });
      return function () {
        aliveRef.current = false;
        offPerm();
        offPrefs();
        stopSpeaking();
      };
    }, []);

    function update(patch) {
      setLocalPrefs(setPrefs(patch));
    }

    var sup = isSupported();
    var englishVoices = useMemo(function () {
      var en = [], other = [];
      for (var i = 0; i < voices.length; i++) {
        if (str(voices[i].lang).toLowerCase().indexOf('en') === 0) en.push(voices[i]);
        else other.push(voices[i]);
      }
      return en.concat(other);
    }, [voices]);

    function preview() {
      prime();
      speak(
        'Blood pressure 138/74, HR 96, RR 20, SpO2 94 percent. Give furosemide 40 mg IV now.',
        { voice: 'nurse', voiceName: prefs.voiceName, force: true }
      )['catch'](function (e) {
        if (window.MM && isFn(window.MM.toast)) window.MM.toast(e.message, 'error');
      });
    }

    function askMic() {
      setBusy(true);
      requestMicPermission().then(function (ok) {
        if (!aliveRef.current) return;
        setBusy(false);
        setPerm(getPermissionState());
        if (window.MM && isFn(window.MM.toast)) {
          window.MM.toast(ok ? 'Microphone enabled.' : 'Microphone was not granted.', ok ? 'success' : 'error');
        }
      });
    }

    var permText = {
      granted: 'Granted', denied: 'Blocked', prompt: 'Not asked yet',
      unknown: 'Unknown', unsupported: 'Not available in this browser'
    }[perm] || 'Unknown';

    /* --- section: master toggles --- */
    var secGeneral = ce('div', { className: 'mmv-sec', key: 'gen' }, [
      ce('h4', { key: 'h' }, 'Voice'),
      ce('div', { className: 'mmv-field', key: 'f1' }, [
        ce('label', { key: 'l', htmlFor: 'mmv-enabled' }, 'Enable spoken audio'),
        ce(Switch, { key: 's', on: prefs.enabled, label: 'Enable spoken audio', onChange: function (v) { if (!v) stopSpeaking(); update({ enabled: v }); } })
      ]),
      ce('div', { className: 'mmv-field', key: 'f2' }, [
        ce('label', { key: 'l' }, 'Auto-speak new content'),
        ce(Switch, { key: 's', on: prefs.autoSpeak, label: 'Auto-speak new content', onChange: function (v) { update({ autoSpeak: v }); } })
      ]),
      ce('div', { className: 'mmv-dim', key: 'd' },
        'Auto-speak reads patient dialogue and feedback aloud as soon as it appears.')
    ]);

    /* --- section: voice + rate --- */
    var voiceOptions = [ce('option', { key: '_auto', value: '' }, 'Automatic (best match)')];
    for (var i = 0; i < englishVoices.length; i++) {
      var v = englishVoices[i];
      voiceOptions.push(ce('option', { key: v.name + i, value: v.name }, v.name + ' (' + v.lang + ')'));
    }

    var secTts = ce('div', { className: 'mmv-sec', key: 'tts' }, [
      ce('h4', { key: 'h' }, 'Text to speech'),
      !sup.tts
        ? ce('div', { className: 'mmv-note err', key: 'no' },
          'Text-to-speech is not available in ' + browserName() + '. All spoken content will stay on screen as text.')
        : null,
      ce('div', { className: 'mmv-field', key: 'f1' }, [
        ce('label', { key: 'l', htmlFor: 'mmv-voice' }, 'Voice'),
        ce('select', {
          key: 's', id: 'mmv-voice', className: 'mmv-select', value: prefs.voiceName,
          disabled: !sup.tts,
          onChange: function (e) { update({ voiceName: e.target.value }); }
        }, voiceOptions)
      ]),
      voices.length === 0 && sup.tts
        ? ce('div', { className: 'mmv-dim', key: 'lv' }, 'Loading system voices...')
        : null,
      ce('div', { className: 'mmv-field', key: 'f2' }, [
        ce('label', { key: 'l', htmlFor: 'mmv-rate' }, 'Speech rate'),
        ce('input', {
          key: 'r', id: 'mmv-rate', type: 'range', className: 'mmv-range',
          min: 0.6, max: 1.6, step: 0.05, value: prefs.rate, disabled: !sup.tts,
          onChange: function (e) { update({ rate: Number(e.target.value) }); }
        }),
        ce('span', { key: 'v', className: 'mmv-muted mmv-mono' }, Number(prefs.rate).toFixed(2) + 'x')
      ]),
      ce('div', { className: 'mmv-row', key: 'f3' }, [
        ce('button', {
          key: 'p', type: 'button', className: 'btn btn-outline btn-sm',
          style: { minHeight: '44px' }, disabled: !sup.tts, onClick: preview
        }, 'Preview'),
        ce('button', {
          key: 'st', type: 'button', className: 'btn btn-outline btn-sm',
          style: { minHeight: '44px' }, disabled: !sup.tts, onClick: function () { stopSpeaking(); }
        }, 'Stop')
      ])
    ]);

    /* --- section: microphone --- */
    var secMic = ce('div', { className: 'mmv-sec', key: 'mic' }, [
      ce('h4', { key: 'h' }, 'Microphone'),
      ce('div', { className: 'mmv-field', key: 'f1' }, [
        ce('label', { key: 'l' }, 'Permission'),
        ce('span', {
          key: 'v',
          className: perm === 'granted' ? 'mmv-yes' : (perm === 'denied' || perm === 'unsupported' ? 'mmv-no' : 'mmv-maybe')
        }, permText)
      ]),
      ce('div', { className: 'mmv-row', key: 'f2' }, [
        ce('button', {
          key: 'b', type: 'button', className: 'btn btn-primary btn-sm',
          style: { minHeight: '44px' },
          disabled: busy || !hasMicApi(), onClick: askMic
        }, busy ? 'Requesting...' : 'Request microphone access')
      ]),
      perm === 'denied'
        ? ce('div', { className: 'mmv-note err', key: 'dn' },
          'Your browser is blocking the microphone for this site. Open the padlock / site settings in the address bar, set Microphone to Allow, then reload.')
        : null
    ]);

    /* --- section: support matrix --- */
    var contSupported = sup.stt ? (browserName() === 'Safari' ? null : true) : false;
    var matrix = ce('div', { className: 'mmv-sec', key: 'mx' }, [
      ce('h4', { key: 'h' }, 'What this browser can do'),
      ce('div', { className: 'mmv-matrix', key: 'm' }, [
        ce('span', { className: 'k', key: 'k0' }, 'Browser'),
        ce('span', { key: 'v0' }, browserName()),
        ce('span', { className: 'k', key: 'k1' }, 'Speak text aloud'),
        ce('span', { key: 'v1' }, yesNo(sup.tts)),
        ce('span', { className: 'k', key: 'k2' }, 'Voice input (dictation)'),
        ce('span', { key: 'v2' }, yesNo(sup.stt)),
        ce('span', { className: 'k', key: 'k3' }, 'Continuous listening'),
        ce('span', { key: 'v3' }, yesNo(contSupported, 'Partial')),
        ce('span', { className: 'k', key: 'k4' }, 'Microphone API'),
        ce('span', { key: 'v4' }, yesNo(hasMicApi())),
        ce('span', { className: 'k', key: 'k5' }, 'Secure (https) page'),
        ce('span', { key: 'v5' }, yesNo(isSecure())),
        ce('span', { className: 'k', key: 'k6' }, 'System voices found'),
        ce('span', { key: 'v6' }, String(voices.length))
      ]),
      !sup.stt
        ? ce('div', { className: 'mmv-note', key: 'n1' }, unsupportedReason())
        : null,
      isIOS()
        ? ce('div', { className: 'mmv-note', key: 'n2' },
          'On iPhone and iPad, audio only starts after you tap a button - that is an Apple restriction, not a bug. Tap Preview above once per session to unlock it.')
        : null,
      browserName() === 'Chrome' || browserName() === 'Edge'
        ? ce('div', { className: 'mmv-dim', key: 'n3' },
          'Voice recognition in Chrome and Edge sends audio to Google/Microsoft speech servers. Nothing is stored by MedMaster.')
        : null
    ]);

    return ce('div', { className: 'mmv-panel' }, [secGeneral, secTts, secMic, matrix]);
  }

  /* ======================================================================
   * AI WAIT STATE  (file-local; the SBAR grading wait is the AI call here)
   * ----------------------------------------------------------------------
   * Grading is a single non-streaming chat() behind a Netlify function that
   * buffers, so there is nothing at all to key a progress signal on until the
   * whole answer lands. "Grading your report with AI..." therefore said the
   * same thing at second 1 and at second 100, and MM.ai.chat only gives up at
   * 130 seconds.
   *
   * This clock is keyed on wall time only: set synchronously when grading
   * starts, ticking on its own interval, escalating, and at 45 seconds it
   * offers the way out that actually exists here - the local keyword score,
   * which is already computed and needs no network at all.
   * ==================================================================== */
  var WAIT_TICK_MS = 1000;
  var WAIT_SOON_MS = 5000;
  var WAIT_SLOW_MS = 20000;
  var WAIT_LONG_MS = 45000;

  function waitTier(ms) {
    if (ms >= WAIT_LONG_MS) return 3;
    if (ms >= WAIT_SLOW_MS) return 2;
    if (ms >= WAIT_SOON_MS) return 1;
    return 0;
  }

  function useAiWait() {
    var st = useState(null);
    var wait = st[0], setWait = st[1];
    var timerRef = useRef(null);
    var startRef = useRef(0);

    function clearTick() {
      if (timerRef.current) {
        try { clearInterval(timerRef.current); } catch (e) { }
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
   * The one status node. `data-elapsed` is real seconds and advances whether
   * or not anything has come back. The dots are decoration: reduced motion
   * stops them and leaves the words and the counter alone.
   */
  function WaitNote(props) {
    var w = props.wait;
    if (!w) return null;
    var secs = Math.floor(w.ms / 1000);
    var texts = props.texts || [];
    return ce('div', {
      className: 'mmv-wait' + (w.tier >= 2 ? ' slow' : ''),
      'data-elapsed': String(secs), 'data-tier': String(w.tier)
    }, [
      ce('span', { className: 'dots', key: 'd', 'aria-hidden': 'true' },
        [ce('i', { key: 'i1' }), ce('i', { key: 'i2' }), ce('i', { key: 'i3' })]),
      /* Only the phrase is announced, and only at tier boundaries. */
      ce('span', { key: 't', role: 'status', 'aria-live': 'polite' },
        texts[w.tier] || texts[0] || 'Working...'),
      w.tier >= 1 ? ce('span', { className: 'secs', key: 's', 'aria-hidden': 'true' }, secs + 's') : null,
      (w.tier >= 3 && props.onEscape)
        ? ce('button', {
            key: 'e', type: 'button', className: 'btn btn-outline btn-sm',
            style: { minHeight: '44px' }, onClick: props.onEscape
          }, props.escapeLabel || 'Score it without AI')
        : null
    ]);
  }

  var GRADE_WAIT_TEXT = [
    'Report captured. Sending it to be graded.',
    'Grading your report with AI...',
    'Still grading - this model is being slow. Your report is safe.',
    'Grading is taking much longer than usual. You can keep waiting, or score it here.'
  ];

  /* One line per code MM.ai.chat rejects with, said for a graded report. In
     every case the keyword score is already on screen, so none of these is a
     dead end - they only explain why the badge says "Keyword scored". */
  var GRADE_ERR_TEXT = {
    'no-auth': 'You are signed out, so this was scored against the scenario key instead of by AI.',
    'tier-denied': 'AI grading is not included in your plan, so this was scored against the scenario key.',
    'quota-exceeded': 'That is all your AI messages for today, so this was scored against the scenario key. They reset at midnight Eastern.',
    'ai-disabled': 'AI grading is switched off site-wide right now, so this was scored against the scenario key.',
    'network': 'The AI grader could not be reached, so this was scored against the scenario key. Nothing you said was lost.',
    'unreadable': 'The AI grader sent something unreadable, so this was scored against the scenario key.',
    'cancelled': 'You stopped waiting for the AI grader, so this was scored against the scenario key.',
    'server': 'The AI grader had a problem, so this was scored against the scenario key.'
  };

  /* ======================================================================
   * 18. <SBARRecorder>
   *     props: {scenario, onComplete}
   * ==================================================================== */

  function SBARRecorder(props) {
    var p = props || {};
    var scenario = p.scenario || {};
    var modelSbar = scenario.sbar || {};
    var sup = isSupported();

    var phaseHook = useState('idle');    /* idle | recording | grading | done */
    var phase = phaseHook[0], setPhase = phaseHook[1];
    var textHook = useState('');
    var text = textHook[0], setText = textHook[1];
    var finalHook = useState('');
    var finalText = finalHook[0], setFinalText = finalHook[1];
    var secHook = useState(0);
    var activeSec = secHook[0], setActiveSec = secHook[1];
    var reachedHook = useState(-1);
    var reached = reachedHook[0], setReached = reachedHook[1];
    var elapsedHook = useState(0);
    var elapsed = elapsedHook[0], setElapsed = elapsedHook[1];
    var resultHook = useState(null);
    var result = resultHook[0], setResult = resultHook[1];
    var errHook = useState('');
    var err = errHook[0], setErr = errHook[1];
    var cmpHook = useState(false);
    var showCompare = cmpHook[0], setShowCompare = cmpHook[1];
    var manualHook = useState('');
    var manual = manualHook[0], setManual = manualHook[1];

    var waiter = useAiWait();

    var stopRef = useRef(null);
    var timerRef = useRef(null);
    var aliveRef = useRef(true);
    var marksRef = useRef([]);
    var secRef = useRef(0);
    var liveRef = useRef(null);
    /* Grading can be entered from three places (onEnd, the typed fallback and
       the stop-safety net below) and each of them costs an AI message. A ref,
       set synchronously, is the only thing that can stop two of them landing
       in the same tick; `gradeRunRef` also orphans a grade the student has
       given up on so a late one cannot overwrite the local score. */
    var gradingRef = useRef(false);
    var gradeRunRef = useRef(0);
    var endGuardRef = useRef(null);
    var bodyRef = useRef('');

    useEffect(function () {
      aliveRef.current = true;
      return function () {
        aliveRef.current = false;
        if (stopRef.current) { callSafe(stopRef.current); stopRef.current = null; }
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (endGuardRef.current) { clearTimeout(endGuardRef.current); endGuardRef.current = null; }
        stopSpeaking();
      };
    }, []);

    /* keep the live transcript scrolled to the bottom */
    useEffect(function () {
      if (liveRef.current) {
        try { liveRef.current.scrollTop = liveRef.current.scrollHeight; } catch (e) { }
      }
    }, [text]);

    function resetState() {
      setText(''); setFinalText(''); setResult(null); setErr('');
      setActiveSec(0); setReached(-1); setElapsed(0); setShowCompare(false);
      marksRef.current = [{ section: 0, at: 0 }];
      secRef.current = 0;
      gradingRef.current = false;
      gradeRunRef.current++;
      waiter.end();
      if (endGuardRef.current) { clearTimeout(endGuardRef.current); endGuardRef.current = null; }
    }

    function start() {
      if (!sup.stt) return;
      prime();
      resetState();
      setPhase('recording');

      if (timerRef.current) clearInterval(timerRef.current);
      var t0 = Date.now();
      timerRef.current = setInterval(function () {
        if (!aliveRef.current) return;
        setElapsed(Math.floor((Date.now() - t0) / 1000));
      }, 1000);

      stopRef.current = listen({
        continuous: true,
        onResult: function (full, isFinal, info) {
          if (!aliveRef.current) return;
          setText(full);
          /* classify the newest utterance, not the whole report so far */
          var probe = (info && info.latest) ? info.latest : full;
          var idx = detectSbarSection(probe, secRef.current);
          if (idx !== secRef.current) {
            secRef.current = idx;
            marksRef.current.push({ section: idx, at: full.length });
            setActiveSec(idx);
            setReached(function (r) { return idx > r ? idx : r; });
          } else if (reached < idx) {
            setReached(idx);
          }
        },
        onEnd: function (t) {
          if (!aliveRef.current) return;
          stopRef.current = null;
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setFinalText(t);
          grade(t);
        },
        onError: function (e) {
          if (!aliveRef.current) return;
          if (e && e.transient) return;
          setErr(e && e.message ? e.message : 'Microphone error.');
        }
      });
    }

    /* Stopping the recogniser is a request, not a guarantee: if the engine has
       already ended (or the tab lost the mic) onEnd never fires, and before
       this the panel sat on "Grading your report with AI..." forever with no
       control left on screen. The net grades what we have. */
    var END_GUARD_MS = 3500;

    function stop() {
      /* Stopping the recogniser can deliver onEnd SYNCHRONOUSLY (several
         engines dispatch `end` from inside stop()), in which case the grade
         has already started - and with a fast grader, already finished - by
         the time we get back here. Arming the net regardless fired a SECOND
         grade three and a half seconds later: a second AI message spent, and
         the student's finished report replaced by a spinner. */
      var gradesBefore = gradeRunRef.current;
      if (stopRef.current) { callSafe(stopRef.current); stopRef.current = null; }
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (gradeRunRef.current !== gradesBefore) return;   /* already graded */
      setPhase('grading');
      if (endGuardRef.current) clearTimeout(endGuardRef.current);
      endGuardRef.current = setTimeout(function () {
        endGuardRef.current = null;
        if (!aliveRef.current || gradingRef.current) return;
        if (gradeRunRef.current !== gradesBefore) return; /* onEnd got there first */
        grade(finalText || text);
      }, END_GUARD_MS);
    }

    /** Show a result and finish. The one place `done` is reached. */
    function finishWith(res, body) {
      gradingRef.current = false;
      if (!aliveRef.current) return;
      waiter.end();
      setResult(res);
      setPhase('done');
      setReached(3);
      callSafe(p.onComplete, {
        scenarioId: scenario.id, transcript: body,
        score: res.score, maxScore: res.maxScore, pct: res.pct,
        breakdown: res.breakdown, missing: res.missing,
        feedback: res.feedback, source: res.source, aiError: res.aiError || '',
        timeSec: elapsed
      });
    }

    function grade(t) {
      if (gradingRef.current) return;
      var body = str(t).trim();
      bodyRef.current = body;
      gradingRef.current = true;
      var runId = ++gradeRunRef.current;
      if (endGuardRef.current) { clearTimeout(endGuardRef.current); endGuardRef.current = null; }
      setPhase('grading');
      // Acknowledgment first, network second: committed in the same render as
      // the grading phase, so it is on screen before anything is awaited.
      waiter.begin();

      var pr;
      try { pr = gradeSbar(scenario, body); }
      catch (e) { pr = Promise.reject(e); }

      Promise.resolve(pr).then(function (res) {
        if (runId !== gradeRunRef.current) return;
        finishWith(res, body);
      }, function (e) {
        if (runId !== gradeRunRef.current) return;
        /* Nothing reaches here in practice - gradeSbarNow resolves on every
           failure path - but a grade that throws must still end in a score,
           never in a spinner. */
        var local = gradeSbarLocally(scenario, body);
        local.aiError = (e && e.code) ? String(e.code) : 'server';
        finishWith(local, body);
      });
    }

    /* The 45-second escape. There is no network involved: the keyword score
       was computed before the AI was ever asked, so this is instant. */
    function scoreLocally() {
      if (!gradingRef.current) return;
      // Orphan the AI grade first: if it lands later it must not overwrite
      // the score the student just chose to accept.
      gradeRunRef.current++;
      var body = bodyRef.current;
      var local = gradeSbarLocally(scenario, body);
      local.aiError = 'cancelled';
      finishWith(local, body);
    }

    function gradeTyped() {
      var body = str(manual).trim();
      if (!body || gradingRef.current) return;
      setFinalText(body);
      grade(body);
    }

    /* split the transcript into the sections we detected while recording */
    var segments = useMemo(function () {
      var src = finalText || text;
      var marks = marksRef.current || [];
      var out = { situation: '', background: '', assessment: '', recommendation: '' };
      if (!src) return out;
      if (marks.length <= 1) { out.situation = src; return out; }
      for (var i = 0; i < marks.length; i++) {
        var from = marks[i].at;
        var to = (i + 1 < marks.length) ? marks[i + 1].at : src.length;
        var key = SBAR_SECTIONS[marks[i].section].key;
        var slice = src.slice(Math.min(from, src.length), Math.min(to, src.length)).trim();
        if (slice) out[key] = (out[key] ? out[key] + ' ' : '') + slice;
      }
      return out;
    }, [finalText, text, phase]);

    /* ---- progress strip ---- */
    var strip = ce('div', { className: 'mmv-strip', key: 'strip', role: 'list' },
      SBAR_SECTIONS.map(function (s, i) {
        var cls = 'mmv-step';
        if (i <= reached) cls += ' done';
        if (phase === 'recording' && i === activeSec) cls += ' active';
        return ce('div', { className: cls, key: s.key, role: 'listitem', 'aria-current': (phase === 'recording' && i === activeSec) ? 'step' : null }, [
          ce('div', { className: 'l', key: 'l' }, s.letter),
          ce('div', { className: 'n', key: 'n' }, s.name)
        ]);
      })
    );

    /* ---- controls ---- */
    var controls;
    if (phase === 'idle') {
      controls = ce('div', { className: 'mmv-row', key: 'ctl' }, [
        ce('button', {
          key: 'go', type: 'button', className: 'btn btn-primary',
          style: { minHeight: '48px' }, disabled: !sup.stt, onClick: start
        }, 'Start SBAR report'),
        modelSbar.situation
          ? ce('button', {
            key: 'cmp', type: 'button', className: 'btn btn-outline btn-sm',
            style: { minHeight: '44px' }, onClick: function () { setShowCompare(!showCompare); }
          }, showCompare ? 'Hide model SBAR' : 'Show model SBAR')
          : null
      ]);
    } else if (phase === 'recording') {
      controls = ce('div', { className: 'mmv-row', key: 'ctl' }, [
        ce('span', { className: 'mmv-timer', key: 't' }, fmtTime(elapsed)),
        ce('span', { className: 'mmv-dot on', key: 'd' }),
        ce('button', {
          key: 'stop', type: 'button', className: 'btn btn-primary',
          style: { minHeight: '48px', marginLeft: 'auto' }, onClick: stop
        }, 'Stop and grade')
      ]);
    } else if (phase === 'grading') {
      controls = ce('div', { className: 'mmv-row', key: 'ctl' }, [
        aiAvailable()
          /* The honest wait: a clock that runs whether or not the grader has
             sent a byte, and a way out at 45 seconds that costs nothing. */
          ? ce(WaitNote, {
              key: 'w', wait: waiter.wait, texts: GRADE_WAIT_TEXT,
              onEscape: scoreLocally, escapeLabel: 'Score it without AI'
            })
          : ce('span', { className: 'mmv-muted', key: 'g' }, 'Scoring your report...')
      ]);
    } else {
      controls = ce('div', { className: 'mmv-row', key: 'ctl' }, [
        ce('span', { className: 'mmv-timer', key: 't' }, fmtTime(elapsed)),
        ce('button', {
          key: 're', type: 'button', className: 'btn btn-primary',
          style: { minHeight: '48px' }, onClick: start, disabled: !sup.stt
        }, 'Re-record'),
        ce('button', {
          key: 'cmp', type: 'button', className: 'btn btn-outline btn-sm',
          style: { minHeight: '44px' }, onClick: function () { setShowCompare(!showCompare); }
        }, showCompare ? 'Hide comparison' : 'Compare to model SBAR')
      ]);
    }

    /* ---- live transcript ---- */
    var liveBox = (phase === 'recording' || text || finalText)
      ? ce('div', { className: 'mmv-live', key: 'live', ref: liveRef, 'aria-live': 'polite' },
        (finalText || text)
          ? (finalText || text)
          : ce('span', { className: 'mmv-interim' }, 'Start talking - your words will appear here.'))
      : null;

    /* ---- no-STT fallback: type the report ---- */
    var fallback = !sup.stt
      ? ce('div', { className: 'mmv-col', key: 'fb' }, [
        ce('div', { className: 'mmv-note', key: 'n' }, unsupportedReason()),
        ce('textarea', {
          key: 'ta',
          className: 'mmv-live',
          style: { width: '100%', minHeight: '140px', fontFamily: 'inherit' },
          placeholder: 'Type your SBAR report here instead...',
          value: manual,
          onChange: function (e) { setManual(e.target.value); }
        }),
        ce('button', {
          key: 'b', type: 'button', className: 'btn btn-primary',
          style: { minHeight: '48px' }, disabled: !str(manual).trim(), onClick: gradeTyped
        }, 'Grade my written SBAR')
      ])
      : null;

    /* ---- result ---- */
    var resultBlock = null;
    if (phase === 'done' && result) {
      var pct = result.pct;
      var color = pct >= 80 ? 'var(--green)' : (pct >= 60 ? 'var(--orange)' : 'var(--red)');

      var brkRows = (result.breakdown || []).map(function (b, i) {
        var w = b.max ? Math.round((b.score / b.max) * 100) : 0;
        return ce('div', { className: 'mmv-brk-row', key: 'b' + i }, [
          ce('div', { className: 'mmv-brk-head', key: 'h' }, [
            ce('span', { key: 'a' }, b.section),
            ce('span', { key: 'b', className: 'mmv-mono' }, b.score + '/' + b.max)
          ]),
          ce('div', { className: 'mmv-bar', key: 'bar' },
            ce('i', { style: { width: Math.max(2, Math.min(100, w)) + '%', background: w >= 80 ? 'var(--green)' : (w >= 60 ? 'var(--orange)' : 'var(--red)') } })),
          b.note ? ce('div', { className: 'mmv-dim', key: 'n' }, b.note) : null
        ]);
      });

      var missBlocks = (result.missing || []).map(function (m, i) {
        if (!m || !m.items || !m.items.length) return null;
        return ce('div', { key: 'm' + i, className: 'mmv-col', style: { gap: '4px' } }, [
          m.section ? ce('div', { className: 'mmv-muted', key: 's' }, m.section) : null,
          ce('div', { className: 'mmv-miss', key: 'i' }, m.items.map(function (it, j) {
            return ce('span', { className: 'tag tag-orange', key: j }, str(it));
          }))
        ]);
      });

      resultBlock = ce('div', { className: 'mmv-col', key: 'res' }, [
        ce('div', { className: 'mmv-sec', key: 'sc' }, [
          ce('div', { className: 'mmv-score', key: 'v' }, [
            ce('span', { className: 'v', key: 'a', style: { color: color } }, String(pct) + '%'),
            ce('span', { className: 'mmv-muted', key: 'b' }, result.score + ' / ' + result.maxScore + ' points'),
            ce('span', {
              className: 'tag ' + (result.source === 'ai' ? 'tag-blue' : 'tag-green'),
              key: 'c', style: { marginLeft: 'auto' }
            }, result.source === 'ai' ? 'AI graded' : 'Keyword scored')
          ]),
          result.feedback
            ? ce('p', { className: 'mmv-muted', key: 'f', style: { marginTop: '10px', lineHeight: 1.6 } }, result.feedback)
            : null,
          /* Why it is keyword scored, named. "AI grading was unavailable" was
             the same sentence for a signed-out student, a spent allowance, a
             plan that never included it and a dropped connection. */
          result.source === 'local'
            ? ce('div', {
                className: 'mmv-dim', key: 'd', style: { marginTop: '6px' },
                'data-code': result.aiError || ''
              },
              result.aiError
                ? (GRADE_ERR_TEXT[result.aiError] || GRADE_ERR_TEXT.server)
                : 'AI grading is not switched on here, so this score comes from matching your report against the scenario key.')
            : null,
          (result.source === 'local' && result.aiError &&
           (result.aiError === 'network' || result.aiError === 'server' ||
            result.aiError === 'unreadable' || result.aiError === 'cancelled'))
            ? ce('div', { className: 'mmv-row', key: 'rg', style: { marginTop: '8px' } },
                ce('button', {
                  type: 'button', className: 'btn btn-outline btn-sm', style: { minHeight: '44px' },
                  onClick: function () { grade(bodyRef.current || finalText || text); }
                }, 'Try AI grading again'))
            : null
        ]),
        ce('div', { className: 'mmv-sec', key: 'bd' }, [
          ce('h4', { key: 'h' }, 'Section breakdown'),
          ce('div', { className: 'mmv-brk', key: 'b' }, brkRows)
        ]),
        (result.strengths && result.strengths.length)
          ? ce('div', { className: 'mmv-sec', key: 'st' }, [
            ce('h4', { key: 'h' }, 'What you did well'),
            ce('div', { className: 'mmv-miss', key: 'b' }, result.strengths.map(function (sg, i) {
              return ce('span', { className: 'tag tag-green', key: i }, str(sg));
            }))
          ])
          : null,
        (missBlocks.filter(Boolean).length)
          ? ce('div', { className: 'mmv-sec', key: 'ms' }, [
            ce('h4', { key: 'h' }, 'What you did not mention'),
            ce('div', { className: 'mmv-col', key: 'b' }, missBlocks)
          ])
          : null
      ]);
    }

    /* ---- comparison view ---- */
    var compareBlock = null;
    if (showCompare) {
      compareBlock = ce('div', { className: 'mmv-sec', key: 'cmp' }, [
        ce('h4', { key: 'h' }, 'Model SBAR vs your report'),
        ce('div', { className: 'mmv-col', key: 'rows', style: { gap: '14px' } },
          SBAR_SECTIONS.map(function (s) {
            var mine = segments[s.key];
            return ce('div', { key: s.key }, [
              ce('div', { className: 'mmv-muted', key: 'ttl', style: { marginBottom: '6px', fontWeight: 700 } },
                s.letter + ' - ' + s.name),
              ce('div', { className: 'mmv-cmp', key: 'c' }, [
                ce('div', { key: 'a' }, [
                  ce('div', { className: 'h', key: 'h' }, 'Model'),
                  ce('div', { className: 'b', key: 'b' }, str(modelSbar[s.key]) || 'Not provided in this scenario.')
                ]),
                ce('div', { key: 'b' }, [
                  ce('div', { className: 'h', key: 'h' }, 'You said'),
                  ce('div', {
                    className: 'b', key: 'b',
                    style: mine ? null : { color: 'var(--text3)', fontStyle: 'italic' }
                  }, mine || 'Nothing detected for this section.')
                ])
              ])
            ]);
          })
        )
      ]);
    }

    var header = ce('div', { className: 'mmv-row', key: 'hdr', style: { justifyContent: 'space-between' } }, [
      ce('div', { key: 'l' }, [
        ce('div', { key: 't', style: { fontWeight: 700, fontSize: '15px' } }, 'Verbal SBAR practice'),
        ce('div', { className: 'mmv-dim', key: 's' },
          scenario.title ? scenario.title : 'Give your handoff report out loud')
      ]),
      (modelSbar.situation && isSupported().tts)
        ? ce(SpeakButton, {
          key: 'sp', voice: 'instructor', title: 'Hear the model report',
          text: [modelSbar.situation, modelSbar.background, modelSbar.assessment, modelSbar.recommendation]
            .filter(Boolean).join(' ')
        })
        : null
    ]);

    return ce('div', { className: 'mmv-sbar card' }, [
      header,
      strip,
      err ? ce('div', { className: 'mmv-note err', key: 'e', role: 'alert' }, err) : null,
      fallback,
      controls,
      liveBox,
      resultBlock,
      compareBlock
    ]);
  }

  /* ======================================================================
   * 19. <HandsFreeBar>
   *     props: {commands, active, onCommand, onError}
   * ==================================================================== */

  function HandsFreeBar(props) {
    var p = props || {};
    var sup = isSupported();

    var commands = useMemo(function () {
      var extra = p.commands && p.commands.length ? p.commands : [];
      /* supplied commands take priority; built-ins fill the gaps */
      var byId = {};
      var out = [];
      var i;
      for (i = 0; i < extra.length; i++) {
        var c = typeof extra[i] === 'string' ? { id: extra[i], label: extra[i] } : extra[i];
        if (!c) continue;
        var id = str(c.id || c.label || c.phrase);
        if (!id || byId[id]) continue;
        byId[id] = 1; out.push(c);
      }
      for (i = 0; i < DEFAULT_COMMANDS.length; i++) {
        if (byId[DEFAULT_COMMANDS[i].id]) continue;
        byId[DEFAULT_COMMANDS[i].id] = 1;
        out.push(DEFAULT_COMMANDS[i]);
      }
      return out;
    }, [p.commands]);

    var onHook = useState(false);
    var on = onHook[0], setOn = onHook[1];
    var heardHook = useState('');
    var heard = heardHook[0], setHeard = heardHook[1];
    var ackHook = useState('');
    var ack = ackHook[0], setAck = ackHook[1];
    var helpHook = useState(false);
    var help = helpHook[0], setHelp = helpHook[1];
    var errHook = useState('');
    var err = errHook[0], setErr = errHook[1];

    var stopRef = useRef(null);
    var ackTimer = useRef(null);
    var lastFire = useRef(0);
    var aliveRef = useRef(true);
    var cmdRef = useRef(commands);
    var cbRef = useRef(p.onCommand);

    cmdRef.current = commands;
    cbRef.current = p.onCommand;

    function clearAckTimer() {
      if (ackTimer.current) { clearTimeout(ackTimer.current); ackTimer.current = null; }
    }

    var stopAll = useCallback(function () {
      if (stopRef.current) { callSafe(stopRef.current); stopRef.current = null; }
      setOn(false);
    }, []);

    var startAll = useCallback(function () {
      if (!sup.stt || stopRef.current) return;
      setErr('');
      setOn(true);
      stopRef.current = listen({
        continuous: true,
        resetOnFinal: true,
        onResult: function (full, isFinal, info) {
          if (!aliveRef.current) return;
          var phrase = (info && info.latest) ? info.latest : full;
          setHeard(phrase);
          if (!isFinal && !(info && info.latest && !info.interim)) return;

          var now = Date.now();
          if (now - lastFire.current < 700) return;

          var cmd = matchCommand(phrase, cmdRef.current);
          if (!cmd) return;
          lastFire.current = now;

          if (str(cmd.id) === 'help') { setHelp(true); }
          setAck(commandLabel(cmd));
          clearAckTimer();
          ackTimer.current = setTimeout(function () {
            if (aliveRef.current) setAck('');
          }, 2200);
          callSafe(cbRef.current, cmd, phrase);
        },
        onEnd: function () {
          if (!aliveRef.current) return;
          stopRef.current = null;
          setOn(false);
        },
        onError: function (e) {
          if (!aliveRef.current) return;
          if (e && e.transient) return;
          setErr(e && e.message ? e.message : 'Microphone error.');
          callSafe(p.onError, e);
        }
      });
    }, [sup.stt]);

    /* follow the `active` prop */
    useEffect(function () {
      aliveRef.current = true;
      if (p.active && sup.stt) startAll();
      else stopAll();
      return function () { /* handled by the unmount effect below */ };
    }, [p.active, sup.stt, startAll, stopAll]);

    useEffect(function () {
      return function () {
        aliveRef.current = false;
        clearAckTimer();
        if (stopRef.current) { callSafe(stopRef.current); stopRef.current = null; }
      };
    }, []);

    if (!p.active) return null;

    var helpPanel = help
      ? ce('div', { className: 'mmv-cmdlist', key: 'hp' }, commands.map(function (c, i) {
        var aliases = commandAliases(c);
        return ce('div', { className: 'mmv-cmd', key: (c.id || i) }, [
          ce('b', { key: 'b' }, commandLabel(c)),
          ce('span', { key: 's' }, 'say: "' + (aliases[0] || commandLabel(c)) + '"')
        ]);
      }))
      : null;

    var status;
    if (!sup.stt) status = ce('span', { className: 'mmv-hf-heard', key: 's' }, 'Voice commands unavailable - use the buttons.');
    else if (ack) status = ce('span', { className: 'mmv-hf-ok', key: 's' }, 'OK: ' + ack);
    else if (on) status = ce('span', { className: 'mmv-hf-heard', key: 's' }, heard || 'Listening for commands...');
    else status = ce('span', { className: 'mmv-hf-heard', key: 's' }, 'Hands-free paused');

    return ce('div', { className: 'mmv-hf', role: 'region', 'aria-label': 'Hands-free voice commands' }, [
      ce('div', { className: 'mmv-hf-top', key: 'top' }, [
        ce('span', { className: 'mmv-dot' + (on ? ' on' : ''), key: 'd' }),
        status,
        ce('button', {
          key: 'tg', type: 'button', className: 'btn btn-outline btn-sm',
          style: { minHeight: '44px' }, disabled: !sup.stt,
          onClick: function () { prime(); if (on) stopAll(); else startAll(); }
        }, on ? 'Pause' : 'Listen'),
        ce('button', {
          key: 'h', type: 'button', className: 'btn btn-outline btn-sm',
          style: { minHeight: '44px' },
          'aria-expanded': help ? 'true' : 'false',
          onClick: function () { setHelp(!help); }
        }, help ? 'Hide commands' : 'Commands')
      ]),
      err ? ce('div', { className: 'mmv-note err', key: 'e', role: 'alert' }, err) : null,
      !sup.stt ? ce('div', { className: 'mmv-note', key: 'u' }, unsupportedReason()) : null,
      helpPanel
    ]);
  }

  /* ======================================================================
   * 20. EXPORTS
   * ==================================================================== */

  window.VoiceButton = VoiceButton;
  window.SpeakButton = SpeakButton;
  window.VoiceSettings = VoiceSettings;
  window.SBARRecorder = SBARRecorder;
  window.HandsFreeBar = HandsFreeBar;

})();
