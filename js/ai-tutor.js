/* ============================================================================
   MedMaster — AI Tutor page
   ----------------------------------------------------------------------------
   window.AITutorPage — persona-driven tutoring chat.

   Ties together:
     - MM.ai        (chat, personas, model tiers, question generation)
     - MM.voice     (speech in, speech out)
     - app progress (weak areas, missed questions, sim results)
     - ALL_SCENARIOS (case-based tutoring context)

   Degrades cleanly: with no AI it shows why and offers the offline study
   tools instead; with no voice it is a normal text chat.
   See _staging/MODULE_CONTRACT.md
   ========================================================================== */
(function () {
  'use strict';

  var ce = React.createElement;
  var useState = React.useState, useEffect = React.useEffect,
      useRef = React.useRef, useMemo = React.useMemo;

  // ---------------------------------------------------------------- styles
  if (!document.getElementById('ai-tutor-styles')) {
    var st = document.createElement('style');
    st.id = 'ai-tutor-styles';
    st.textContent = [
      /* height: `vh` first as the fallback, then `dvh` so iOS Safari measures the
         SMALL viewport (URL bar + keyboard visible) and the composer stays on
         screen. DR06 CRITICAL #1. */
      '.tutor-wrap{display:flex;flex-direction:column;height:calc(100vh - var(--sp-10, 40px));',
      'height:calc(100dvh - var(--sp-10, 40px));max-height:900px}',
      '.tutor-head{display:flex;align-items:center;gap:var(--sp-2,8px);flex-wrap:wrap;margin-bottom:var(--sp-3,12px)}',
      '.tutor-persona-strip{display:flex;gap:var(--sp-2,8px);overflow-x:auto;padding:var(--sp-1,4px) 2px var(--sp-3,12px);',
      'scrollbar-width:thin;scroll-snap-type:x proximity;',
      '-webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 24px),transparent 100%);',
      'mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 24px),transparent 100%)}',
      /* Fixed min-width + a permanently rendered second line: selecting a pill
         never changes its size, so the strip cannot reflow under a finger. */
      '.tutor-persona{flex:0 0 auto;scroll-snap-align:start;display:flex;align-items:center;gap:var(--sp-2,8px);',
      'padding:var(--sp-2,8px) var(--sp-3,12px);min-height:44px;min-width:150px;border-radius:var(--r-full,999px);',
      'border:2px solid var(--border,#334155);background:var(--surface);cursor:pointer;color:var(--text2);',
      'font-size:var(--fs-sm,13px);font-weight:var(--fw-semi,600);white-space:nowrap;text-align:left;',
      'transition:border-color var(--dur-fast,.12s),color var(--dur-fast,.12s),background var(--dur-fast,.12s)}',
      '.tutor-persona:hover{border-color:var(--accent)}',
      '.tutor-persona:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.tutor-persona:active{transform:scale(.975)}',
      '.tutor-persona.active{border-color:var(--accent);color:var(--text);background:var(--tint-accent,rgba(59,130,246,0.12))}',
      '.tutor-persona[aria-checked="true"]{border-color:var(--accent);color:var(--text);background:var(--tint-accent,rgba(59,130,246,0.12))}',
      '.tutor-persona-av{font-size:1.15rem;line-height:1}',
      '.tutor-persona-txt{display:flex;flex-direction:column;align-items:flex-start;line-height:var(--lh-tight,1.2);min-width:0}',
      '.tutor-persona-name{font-weight:var(--fw-bold,700)}',
      '.tutor-persona-tag{font-size:var(--fs-2xs,11px);font-weight:var(--fw-semi,600);color:var(--text3)}',
      '.tutor-persona.active .tutor-persona-tag,.tutor-persona[aria-checked="true"] .tutor-persona-tag{color:var(--text2)}',
      '.tutor-body{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--surface);',
      'border:1px solid var(--border,#334155);border-radius:var(--r-lg,14px);overflow:hidden}',
      '.tutor-msgs{flex:1;overflow-y:auto;padding:var(--sp-4,16px);display:flex;flex-direction:column;gap:var(--sp-3,12px)}',
      '.tutor-msgs:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}',
      '.tutor-msg{display:flex;gap:var(--sp-3,12px);max-width:88%}',
      '.tutor-msg.user{align-self:flex-end;flex-direction:row-reverse}',
      '.tutor-bubble{padding:var(--sp-3,12px) var(--sp-4,16px);border-radius:var(--r-lg,14px);font-size:var(--fs-md,16px);',
      'line-height:var(--lh-body,1.65);word-break:break-word}',
      '.tutor-msg.ai .tutor-bubble{background:var(--surface3,#334155);color:var(--text);border-bottom-left-radius:var(--r-sm,6px)}',
      '.tutor-msg.user .tutor-bubble{background:var(--accent);color:#fff;border-bottom-right-radius:var(--r-sm,6px)}',
      /* rich text inside a bubble — same grammar community.js renders */
      '.tutor-bubble p{margin:0 0 var(--sp-2,8px);line-height:var(--lh-body,1.65)}',
      '.tutor-bubble p:last-child{margin-bottom:0}',
      '.tutor-bubble ul{margin:var(--sp-1,4px) 0 var(--sp-2,8px);padding-left:var(--sp-5,20px)}',
      '.tutor-bubble li{margin-bottom:var(--sp-1,4px);line-height:var(--lh-body,1.65)}',
      '.tutor-bubble code{background:var(--bg);border:1px solid var(--border,#334155);border-radius:var(--r-sm,6px);',
      'padding:1px 6px;font-family:"Courier New",monospace;font-size:0.88em;color:var(--orange-fg,#fbbf24)}',
      '.tutor-bubble strong{font-weight:var(--fw-black,800)}',
      '.tutor-caret{display:inline-block;width:8px;color:var(--accent-fg,#60a5fa);animation:tutorCaret 1s steps(2) infinite}',
      '@keyframes tutorCaret{0%,49%{opacity:1}50%,100%{opacity:.15}}',
      '.tutor-av{width:32px;height:32px;border-radius:var(--r-full,999px);display:flex;align-items:center;justify-content:center;',
      'background:var(--surface3,#334155);font-size:1.05rem;flex:0 0 auto}',
      '.tutor-msg.user .tutor-av{background:var(--accent2)}',
      '.tutor-meta{font-size:var(--fs-2xs,11px);color:var(--text3);margin-top:var(--sp-1,4px)}',
      '.tutor-input-row{display:flex;gap:var(--sp-2,8px);padding:var(--sp-3,12px);border-top:1px solid var(--border,#334155);',
      'align-items:flex-end;background:var(--bg);padding-bottom:calc(var(--sp-3,12px) + env(safe-area-inset-bottom,0px))}',
      /* 16px minimum: anything smaller makes iOS Safari zoom the whole page on focus. */
      '.tutor-input{flex:1;min-height:44px;max-height:140px;resize:none;padding:11px 13px;border-radius:var(--r-md,10px);',
      'border:2px solid var(--border,#334155);background:var(--surface);color:var(--text);font-size:var(--fs-md,16px);',
      'font-family:inherit;line-height:var(--lh-normal,1.5)}',
      '.tutor-input:focus{border-color:var(--accent)}',
      '.tutor-input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.tutor-input::placeholder{color:var(--text3)}',
      '.tutor-send{min-width:44px;min-height:44px;border-radius:var(--r-md,10px);border:none;background:var(--accent);',
      'color:#fff;font-size:1.05rem;cursor:pointer;font-weight:var(--fw-bold,700)}',
      '.tutor-send:disabled{opacity:.45;cursor:not-allowed}',
      '.tutor-send:active{transform:scale(.975)}',
      '.tutor-send:focus-visible{outline:2px solid var(--text);outline-offset:2px}',
      '.tutor-stop{min-width:44px;min-height:44px;padding:0 var(--sp-3,12px);border-radius:var(--r-md,10px);',
      'border:2px solid var(--red,#ef4444);background:transparent;color:var(--red-fg,#f87171);cursor:pointer;',
      'font-size:var(--fs-sm,13px);font-weight:var(--fw-bold,700)}',
      '.tutor-stop:hover{background:var(--tint-red,rgba(239,68,68,0.12))}',
      '.tutor-stop:active{transform:scale(.975)}',
      '.tutor-stop:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.tutor-quick{display:flex;gap:var(--sp-2,8px);flex-wrap:wrap;padding:var(--sp-3,12px) var(--sp-3,12px) 0;align-items:center}',
      '.tutor-quick-lab{font-size:var(--fs-2xs,11px);color:var(--text3);font-weight:var(--fw-semi,600);',
      'text-transform:uppercase;letter-spacing:.5px}',
      '.tutor-chip{padding:var(--sp-2,8px) var(--sp-3,12px);min-height:44px;border-radius:var(--r-full,999px);',
      'border:1px solid var(--border,#334155);background:var(--surface);color:var(--text2);font-size:var(--fs-sm,13px);',
      'cursor:pointer;font-weight:var(--fw-semi,600);display:inline-flex;align-items:center}',
      '.tutor-chip:hover{border-color:var(--accent);color:var(--text)}',
      '.tutor-chip:active{transform:scale(.975)}',
      '.tutor-chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.tutor-typing{display:inline-flex;gap:3px;align-items:center}',
      '.tutor-dot{width:6px;height:6px;border-radius:var(--r-full,999px);background:var(--text3);animation:tutorBounce 1.2s infinite}',
      '.tutor-dot:nth-child(2){animation-delay:.15s}.tutor-dot:nth-child(3){animation-delay:.3s}',
      '@keyframes tutorBounce{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}',
      /* wall-clock wait status — see the AI WAIT STATE block below */
      '.tutor-wait{display:inline-flex;align-items:center;gap:var(--sp-2,8px);flex-wrap:wrap;',
      'font-size:var(--fs-sm,13px);color:var(--text2);line-height:var(--lh-normal,1.5)}',
      '.tutor-wait.slow{color:var(--orange-fg,#fbbf24)}',
      '.tutor-wait-secs{font-variant-numeric:tabular-nums;color:var(--text3);font-size:var(--fs-xs,12px)}',
      '.tutor-wait-act{min-height:32px;padding:3px var(--sp-2,8px);font-size:var(--fs-xs,12px);',
      'border-radius:var(--r-sm,6px);border:1px solid var(--border,#334155);background:var(--surface);',
      'color:var(--text2);cursor:pointer;font-weight:var(--fw-semi,600)}',
      '.tutor-wait-act:hover{border-color:var(--accent);color:var(--text)}',
      '.tutor-wait-act:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.tutor-slowline{display:inline-flex;align-items:center;gap:var(--sp-2,8px);flex-wrap:wrap;',
      'font-size:var(--fs-xs,12px);color:var(--text3);margin-top:var(--sp-1,4px)}',
      '.tutor-err-t{font-weight:var(--fw-bold,700);margin-bottom:var(--sp-1,4px)}',
      '.tutor-bar{display:flex;align-items:center;gap:var(--sp-2,8px);flex-wrap:wrap;font-size:var(--fs-xs,12px);',
      'color:var(--text3);padding:var(--sp-2,8px) var(--sp-3,12px);border-top:1px solid var(--border,#334155)}',
      '.tutor-bar label{display:inline-flex;align-items:center;gap:var(--sp-1,4px)}',
      '.tutor-sel{padding:var(--sp-1,4px) var(--sp-2,8px);min-height:32px;border-radius:var(--r-sm,6px);',
      'border:1px solid var(--border,#334155);background:var(--surface);color:var(--text2);font-size:var(--fs-md,16px);max-width:190px}',
      '.tutor-err{background:var(--tint-red,rgba(239,68,68,0.1));border:1px solid var(--red,#ef4444);color:var(--text);',
      'padding:var(--sp-3,12px);border-radius:var(--r-md,10px);font-size:var(--fs-base,14px);margin:var(--sp-2,8px) var(--sp-3,12px);',
      'line-height:var(--lh-normal,1.5)}',
      '.tutor-err-act{display:flex;gap:var(--sp-2,8px);flex-wrap:wrap;margin-top:var(--sp-2,8px)}',
      '.tutor-lock-note{color:var(--text3);font-size:var(--fs-base,14px);line-height:var(--lh-body,1.65);',
      'max-width:44ch;margin:0 auto var(--sp-4,16px)}',
      '.tutor-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;',
      'clip:rect(0 0 0 0);white-space:nowrap;border:0}',
      '@media(max-width:640px){',
      '.tutor-wrap{height:calc(100vh - 56px);height:calc(100dvh - 56px)}',
      '.tutor-msg{max-width:95%}',
      '.tutor-persona-strip{gap:var(--sp-2,8px)}',
      '.tutor-persona{min-width:138px;padding:7px 10px;font-size:var(--fs-xs,12px)}',
      '.tutor-input,.tutor-sel{font-size:16px}',
      '}',
      '@media(prefers-reduced-motion:reduce){',
      '.tutor-dot{animation:none;opacity:.7}',
      '.tutor-caret{animation:none}',
      '.tutor-persona,.tutor-chip,.tutor-send,.tutor-stop{transition:none}',
      '.tutor-persona:active,.tutor-chip:active,.tutor-send:active,.tutor-stop:active{transform:none}',
      '}'
    ].join('');
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------- utilities
  function MMx() { return window.MM || {}; }
  function ai() { return (window.MM && window.MM.ai) ? window.MM.ai : null; }
  function voice() { return (window.MM && window.MM.voice) ? window.MM.voice : null; }

  /* ======================================================================
   * "CHECKING YOUR PLAN" STATE
   * ----------------------------------------------------------------------
   * MM.ai.isResolving() is true from page load until Firebase has actually
   * answered with this student's tier. Until then we know nothing, so we may
   * not render a verdict of any kind - not a paywall, not a setup notice, not
   * an error. We render a quiet placeholder shaped like the thing that is
   * about to appear instead.
   *
   * Feature-detected: an older cached ai.js has no isResolving, and with it
   * absent this returns false and every gate behaves exactly as it did before.
   * ==================================================================== */
  function aiResolving() {
    var A = ai();
    try { return !!(A && typeof A.isResolving === 'function' && A.isResolving()); }
    catch (e) { return false; }
  }

  function useAiResolving() {
    var st = useState(aiResolving);
    var resolving = st[0], setResolving = st[1];
    useEffect(function () {
      if (!resolving) return undefined;
      var A = ai();
      // No resolution API to wait on - do not hold the UI hostage to it.
      if (!A || typeof A.onResolved !== 'function') { setResolving(false); return undefined; }
      var off = A.onResolved(function () { setResolving(false); });
      return function () { if (typeof off === 'function') off(); };
    }, [resolving]);
    return resolving;
  }

  var CHK_STYLE_ID = 'mm-checking-styles';
  function ensureCheckingStyles() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.getElementById(CHK_STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = CHK_STYLE_ID;
    s.textContent = [
      '.mm-chk{opacity:.9}',
      '.mm-chk-line{height:12px;border-radius:var(--r-full,999px);background:var(--surface3,#334155);',
      'animation:mmChkPulse 1.7s ease-in-out infinite;margin-bottom:10px}',
      '.mm-chk-line:last-child{margin-bottom:0}',
      '.mm-chk-note{color:var(--text3);font-size:var(--fs-sm,13px);line-height:var(--lh-normal,1.5);margin:0}',
      '.mm-chk-box{border:1px solid var(--border,#334155);border-radius:var(--r-lg,14px);',
      'background:var(--surface);padding:var(--sp-4,16px)}',
      '@keyframes mmChkPulse{0%,100%{opacity:.30}50%{opacity:.62}}',
      '@media(prefers-reduced-motion:reduce){.mm-chk-line{animation:none;opacity:.4}}'
    ].join('');
    document.head.appendChild(s);
  }

  /** Grey lines that occupy roughly the shape of whatever is loading. */
  function CheckingLines(props) {
    ensureCheckingStyles();
    var widths = (props && props.widths) || ['92%', '78%', '60%'];
    return ce('div', { className: 'mm-chk', 'aria-hidden': 'true' },
      widths.map(function (w, i) {
        return ce('div', { key: i, className: 'mm-chk-line', style: { width: w } });
      }));
  }

  function esc(s) { return String(s == null ? '' : s); }

  function navTo(page) {
    try { if (MMx().navigate) MMx().navigate(page); } catch (e) { /* ignore */ }
  }

  /* The shell renders its sign-in screen whenever nobody is signed in, so a
     reload is a real (if blunt) sign-in path. Prefer a hook if the shell
     provides one. */
  function requestSignIn() {
    var m = MMx();
    try { if (typeof m.signIn === 'function') { m.signIn(); return; } } catch (e) { /* ignore */ }
    try { if (typeof m.requestSignIn === 'function') { m.requestSignIn(); return; } } catch (e) { /* ignore */ }
    try { window.location.reload(); } catch (e) { /* ignore */ }
  }

  /* `QUESTIONS` is a top-level `const` in the shell, so it is a lexical global
     rather than a property of `window`. Read it both ways. */
  function allQuestions() {
    try { if (window.QUESTIONS && window.QUESTIONS.length) return window.QUESTIONS; } catch (e) { /* ignore */ }
    try { if (typeof QUESTIONS !== 'undefined' && QUESTIONS) return QUESTIONS; } catch (e) { /* ignore */ }
    return [];
  }

  /* -------------------------------------------------- markdown-ish output
     Every persona prompt tells the model to use bullets and bold. Rendering
     the raw characters made students read literal `**` and `-`. This is the
     same inline grammar community.js uses, plus list handling. Everything is
     emitted as React elements with TEXT children — never innerHTML. */

  var INLINE_RE = /(\*\*[^*\n]{1,300}\*\*|`[^`\n]{1,300}`)/g;

  function renderInline(line, keyBase) {
    var out = [];
    var last = 0, m, i = 0;
    INLINE_RE.lastIndex = 0;
    while ((m = INLINE_RE.exec(line)) !== null) {
      if (m.index > last) out.push(line.slice(last, m.index));
      var tok = m[0];
      if (tok.charAt(0) === '*') {
        out.push(ce('strong', { key: keyBase + '-b' + (i++) }, tok.slice(2, -2)));
      } else {
        out.push(ce('code', { key: keyBase + '-c' + (i++) }, tok.slice(1, -1)));
      }
      last = m.index + tok.length;
    }
    if (last < line.length) out.push(line.slice(last));
    return out;
  }

  var BULLET_RE = /^\s*([-*•]|\d{1,2}[.)])\s+(.*)$/;

  function richBlocks(text, keyPrefix) {
    var lines = String(text == null ? '' : text).split('\n');
    var out = [];
    var bullets = null;
    var n = 0;

    function flush() {
      if (bullets && bullets.length) {
        out.push(ce('ul', { key: keyPrefix + '-u' + (n++) }, bullets));
      }
      bullets = null;
    }

    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var mb = BULLET_RE.exec(ln);
      if (mb) {
        if (!bullets) bullets = [];
        bullets.push(ce('li', { key: keyPrefix + '-li' + i }, renderInline(mb[2], keyPrefix + 'i' + i)));
        continue;
      }
      flush();
      if (!ln.replace(/\s/g, '')) continue;
      out.push(ce('p', { key: keyPrefix + '-p' + i }, renderInline(ln, keyPrefix + 'p' + i)));
    }
    flush();
    return out;
  }

  /** Markdown characters read as noise in a screen reader. Strip for announcing. */
  function plain(text) {
    return String(text == null ? '' : text)
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/^\s*[-*•]\s+/gm, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  function Rich(props) {
    var body = richBlocks(props.text, props.k || 'r');
    if (props.caret) body = body.concat([ce('span', { key: 'caret', className: 'tutor-caret', 'aria-hidden': 'true' }, '▍')]);
    return ce('div', { className: 'tutor-bubble' }, body.length ? body : esc(props.text));
  }

  /* Build a compact snapshot of how the student is doing so the tutor can
     personalise. Kept short on purpose — this is prepended to every request. */
  function buildStudentContext(progress) {
    if (!progress) return '';
    var out = [];
    var stats = progress.questionStats || {};
    var ids = Object.keys(stats);
    var bank = allQuestions();
    if (ids.length) {
      var weak = [];
      var byCat = {};
      ids.forEach(function (id) {
        var s = stats[id];
        if (!s || !s.attempts) return;
        var q = null;
        try {
          q = bank.filter(function (x) { return x.id === id; })[0];
        } catch (e) { /* ignore */ }
        var cat = q && q.category ? q.category : 'General';
        if (!byCat[cat]) byCat[cat] = { c: 0, a: 0 };
        byCat[cat].c += (s.correct || 0);
        byCat[cat].a += s.attempts;
      });
      Object.keys(byCat).forEach(function (c) {
        var b = byCat[c];
        if (b.a >= 2 && (b.c / b.a) < 0.7) {
          weak.push(c + ' (' + Math.round(b.c / b.a * 100) + '%)');
        }
      });
      if (weak.length) out.push('Weak areas: ' + weak.slice(0, 5).join(', ') + '.');
      out.push('Questions attempted: ' + ids.length + '.');
    }
    var missed = progress.missedQuestions || [];
    if (missed.length) out.push('Currently has ' + missed.length + ' questions in their missed bank.');
    var sims = progress.simResults || [];
    if (sims.length) {
      var last = sims[sims.length - 1];
      out.push('Most recent simulation: ' + (last.simId || '?') + ' scored ' + (last.pct != null ? last.pct + '%' : '?') + '.');
    }
    var ma = progress.medAdminResults || [];
    if (ma.length) {
      var lastMa = ma[ma.length - 1];
      out.push('Most recent med admin attempt: ' + (lastMa.passed ? 'PASS' : 'FAIL') + ' at ' + (lastMa.pct != null ? lastMa.pct + '%' : '?') + '.');
    }
    if (progress.studyStreak) out.push('Study streak: ' + progress.studyStreak + ' days.');
    if (!out.length) return '';
    return 'STUDENT CONTEXT (use to personalise; do not recite back verbatim):\n' + out.join('\n');
  }

  var QUICK_ACTIONS = [
    { id: 'quiz', label: 'Quiz me', prompt: 'Quiz me on my weakest area. Ask one question at a time, wait for my answer, then tell me if I am right and explain why.' },
    { id: 'weak', label: 'Review weak areas', prompt: 'Look at my weak areas and build me a focused study plan for the next week. Be specific about what to drill.' },
    { id: 'explain', label: 'Explain a concept', prompt: 'I want to understand a concept. Ask me which one, then teach it to me step by step with a clinical example.' },
    { id: 'dosage', label: 'Dosage practice', prompt: 'Give me a dosage calculation problem at my level. Walk me through it only after I attempt it.' },
    { id: 'sbar', label: 'SBAR coaching', prompt: 'Coach me on giving a SBAR report. Give me a patient situation and have me report it back to you, then critique it.' },
    { id: 'priority', label: 'Priority questions', prompt: 'Drill me on NCLEX priority-setting questions. Which patient do I see first, and why? One at a time.' }
  ];

  /* One noun per persona. Without this the strip is seven proper nouns the
     student has never heard, and the credential only rendered on the pill they
     had already picked. */
  var SHORT_TAG = {
    'ed-attending': 'Priorities & emergencies',
    'np-preceptor': 'Why the body does that',
    'nursing-professor': 'NCLEX strategy',
    'ati-coach': 'ATI exam prep',
    'ob-instructor': 'OB & newborn',
    'picu-educator': 'Peds',
    'pharm-calc-coach': 'Dosage & pharm'
  };

  /* ai.js already hands back a friendly-but-generic sentence for every code.
     When the *backend* diagnosed something specific ("the account funding this
     is out of credits") it arrives on e.message instead, and that is far more
     useful than anything we could write here — so only fall back to our own
     copy when the message is one of ai.js's generics. */
  var AI_GENERIC = {
    'Sign in to use the AI tutor.': 1,
    'That model is not included in your plan.': 1,
    'You have used all of your AI messages for today.': 1,
    'AI features are turned off right now.': 1,
    'Could not reach the AI service. Check your connection.': 1,
    'Something went wrong on our end. Try again in a moment.': 1,
    'AI is not available right now.': 1
  };

  var OUR_COPY = {
    'no-auth': 'You need to be signed in for this. Your work here is saved — signing in will not lose it.',
    'tier-denied': 'That model is not included in your plan. Pick another model below, or ask your instructor for access.',
    'quota-exceeded': 'You have used all of your tutor messages for today. They reset at midnight Eastern.',
    'ai-disabled': 'AI is switched off site-wide right now. The scripted simulations and everything else still work.',
    'network': 'Could not reach the tutor. Your message is still in the box — hit Retry when you are back on wifi.',
    'server': 'The tutor did not answer that one. Try again in a moment.'
  };

  /* One headline per code MM.ai.chat rejects with, so the six conditions do not
     all read as the same grey box. 'no-auth' and 'quota-exceeded' are not
     failures the student can retry; 'network' and 'server' are. */
  var ERR_TITLE = {
    'no-auth': 'You are signed out',
    'tier-denied': 'Not included in your plan',
    'quota-exceeded': 'That is all your messages for today',
    'ai-disabled': 'AI is switched off right now',
    'network': 'Could not reach the tutor',
    'server': 'The tutor did not answer'
  };

  function aiErrText(e) {
    var code = (e && e.code) ? String(e.code) : 'server';
    var msg = (e && e.message) ? String(e.message) : '';
    if (msg && !AI_GENERIC[msg]) return msg;          // real backend diagnosis
    if (OUR_COPY[code]) return OUR_COPY[code];
    return OUR_COPY.server;
  }

  function aiErrTitle(e) {
    if (e && e.timedOut) return 'The tutor ran out of time';
    var code = (e && e.code) ? String(e.code) : 'server';
    return ERR_TITLE[code] || ERR_TITLE.server;
  }

  /* ======================================================================
   * AI WAIT STATE  (file-local; the only pending-UI mechanism in this file)
   * ----------------------------------------------------------------------
   * The Netlify function buffers SSE, so onToken can stay completely silent
   * for the whole generation and then fire everything at the end. Anything
   * keyed on token arrival therefore sits frozen while the model is actually
   * working, which reads as a crash.
   *
   * This clock is keyed on wall time and nothing else:
   *   1. it is set synchronously in the same commit as `busy`, so there is an
   *      acknowledgment on the very next paint, before any network work;
   *   2. it ticks on its own interval, so it advances with zero tokens;
   *   3. it escalates - quiet, then an elapsed counter, then "this model is
   *      being slow", then an offer to give up and try again.
   * ==================================================================== */
  var WAIT_TICK_MS = 1000;
  var WAIT_SOON_MS = 5000;    // start showing the elapsed counter
  var WAIT_SLOW_MS = 20000;   // say out loud that this is slow
  var WAIT_LONG_MS = 45000;   // offer a retry

  function waitTier(ms) {
    if (ms >= WAIT_LONG_MS) return 3;
    if (ms >= WAIT_SLOW_MS) return 2;
    if (ms >= WAIT_SOON_MS) return 1;
    return 0;
  }

  var WAIT_TEXT = [
    'Your tutor is reading your message.',
    'Your tutor is writing a reply.',
    'Still working — this model is being slow. Nothing is stuck.',
    'This is taking much longer than usual. Keep waiting, or try again.'
  ];

  function useAiWait() {
    var s = useState(null);
    var wait = s[0], setWait = s[1];
    var timerRef = useRef(null);
    var startRef = useRef(0);

    function clearTick() {
      if (timerRef.current) {
        try { clearInterval(timerRef.current); } catch (e) { /* ignore */ }
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
   * The one status node in this file. `data-elapsed` is the honest seconds
   * count and advances whether or not a token has ever arrived. The animated
   * dots are decoration only: under prefers-reduced-motion the CSS stops them
   * and the text status is unchanged.
   */
  function WaitNote(props) {
    var w = props.wait;
    if (!w) return null;
    var secs = Math.floor(w.ms / 1000);
    return ce('span', {
      className: 'tutor-wait' + (w.tier >= 2 ? ' slow' : ''),
      'data-elapsed': String(secs), 'data-tier': String(w.tier)
    },
      ce('span', { className: 'tutor-typing', 'aria-hidden': 'true' },
        ce('span', { className: 'tutor-dot' }),
        ce('span', { className: 'tutor-dot' }),
        ce('span', { className: 'tutor-dot' })),
      // Only the phrase is announced, and it changes at most three times.
      // The seconds are aria-hidden so a screen reader is not read a clock.
      ce('span', { className: 'tutor-wait-txt', role: 'status', 'aria-live': 'polite' },
        props.text || WAIT_TEXT[w.tier]),
      w.tier >= 1
        ? ce('span', { className: 'tutor-wait-secs', 'aria-hidden': 'true' }, secs + 's')
        : null,
      (w.tier >= 3 && props.onRetry)
        ? ce('button', {
            type: 'button', className: 'tutor-wait-act', onClick: props.onRetry
          }, 'Try again')
        : null
    );
  }

  var TAIL = 'Everything else in MedMaster still works.';

  function withTail(s) {
    if (!s) return TAIL;
    return s.indexOf(TAIL) >= 0 ? s : (s + ' ' + TAIL);
  }

  // ============================================================ main page
  function AITutorPage(props) {
    var progress = (props && props.progress) || (window.MM && window.MM.getProgress ? window.MM.getProgress() : {});

    var A = ai();
    var V = voice();
    var personas = (A && A.PERSONAS) ? A.PERSONAS : [];

    var _p = useState(personas.length ? personas[0].id : ''); var personaId = _p[0], setPersonaId = _p[1];
    var _m = useState([]); var msgs = _m[0], setMsgs = _m[1];
    var _i = useState(''); var input = _i[0], setInput = _i[1];
    var _b = useState(false); var busy = _b[0], setBusy = _b[1];
    var _e = useState(null); var err = _e[0], setErr = _e[1];
    var _s = useState(''); var streaming = _s[0], setStreaming = _s[1];
    var _a = useState(false); var autoSpeak = _a[0], setAutoSpeak = _a[1];
    var _sc = useState(''); var scenarioId = _sc[0], setScenarioId = _sc[1];
    var _u = useState(null); var usage = _u[0], setUsage = _u[1];
    var _mo = useState(''); var model = _mo[0], setModel = _mo[1];
    var _an = useState(''); var announce = _an[0], setAnnounce = _an[1];

    var resolving = useAiResolving();
    var waiter = useAiWait();

    var scrollRef = useRef(null);
    var inputRef = useRef(null);
    var abortRef = useRef(false);
    var lastSentRef = useRef('');
    /* The transcript the in-flight call was made with, so a mid-flight retry
       can re-run the same turn without appending the student's line twice. */
    var convoRef = useRef(null);
    /* Ref twins of `busy`. State does not update synchronously, so a second
       click (or Enter, or a quick-action chip) in the same tick used to be
       able to start a second call. These cannot. */
    var busyRef = useRef(false);
    var runRef = useRef(0);
    var mountedRef = useRef(true);

    useEffect(function () { return function () { mountedRef.current = false; }; }, []);

    var persona = useMemo(function () {
      for (var i = 0; i < personas.length; i++) if (personas[i].id === personaId) return personas[i];
      return personas[0] || null;
    }, [personaId, personas.length]);

    var available = !!(A && A.isAvailable && A.isAvailable());

    // Load usage + selected model
    useEffect(function () {
      if (!A) return;
      try { if (A.getUsage) Promise.resolve(A.getUsage()).then(setUsage)['catch'](function () {}); } catch (e) { /* ignore */ }
      try { if (A.getSelectedModel) setModel(A.getSelectedModel() || ''); } catch (e) { /* ignore */ }
    }, [busy]);

    // Auto-scroll to newest
    useEffect(function () {
      var el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, [msgs.length, streaming]);

    function greetMsg() {
      if (!persona) return null;
      return {
        role: 'assistant', greeting: true,
        content: persona.greeting || ('Hi, I am ' + persona.name + '. What are we working on today?'),
        persona: persona.id
      };
    }

    // Greeting when persona changes and chat is empty
    useEffect(function () {
      if (!persona || msgs.length) return;
      var g = greetMsg();
      if (g) setMsgs([g]);
    }, [personaId]);

    // Stop any speech when leaving
    useEffect(function () {
      return function () { try { if (V && V.stopSpeaking) V.stopSpeaking(); } catch (e) { /* ignore */ } };
    }, []);

    function switchPersona(id) {
      if (busy || id === personaId) return;
      // "Clear chat" confirms; switching instructors used to wipe the
      // conversation silently. Same destruction, same confirm.
      if (msgs.length > 1) {
        var ok = true;
        try { ok = window.confirm('Switching instructors starts a new conversation. Clear this one?'); }
        catch (e) { ok = true; }
        if (!ok) return;
      }
      try { if (V && V.stopSpeaking) V.stopSpeaking(); } catch (e) { /* ignore */ }
      setPersonaId(id);
      setMsgs([]);
      setErr(null);
    }

    function speakIfWanted(text) {
      if (!autoSpeak || !V || !V.speak) return;
      try {
        V.speak(text, { voice: (persona && persona.voiceHint) ? persona.voiceHint : 'instructor' })
          ['catch'](function () {});
      } catch (e) { /* ignore */ }
    }

    function stopGeneration() {
      if (!busyRef.current) return;
      abortRef.current = true;
      // Orphan the in-flight call: anything it resolves or rejects with from
      // here on is ignored, so a late answer cannot resurrect the pending UI.
      runRef.current++;
      busyRef.current = false;
      waiter.end();
      var partial = streaming;
      setStreaming('');
      setBusy(false);
      if (partial) {
        setMsgs(function (prev) {
          return prev.concat([{
            role: 'assistant', content: partial, stopped: true,
            persona: persona ? persona.id : ''
          }]);
        });
      }
      setAnnounce('Stopped.');
    }

    function send(overrideText) {
      var text = (overrideText != null ? overrideText : input).trim();
      if (!text || busyRef.current) return;
      if (!available) {
        setErr({ title: 'The tutor is off for your account', retry: false,
                 text: 'The tutor is not available on your account right now.' });
        return;
      }

      setErr(null);
      setInput('');
      lastSentRef.current = text;

      var nextMsgs = msgs.concat([{ role: 'user', content: text }]);
      setMsgs(nextMsgs);
      dispatch(nextMsgs);
    }

    /**
     * The single place a turn is actually sent. Split out of send() so a
     * mid-flight "Try again" can re-run the SAME transcript instead of
     * appending the student's line a second time.
     */
    function dispatch(convo) {
      convoRef.current = convo;
      abortRef.current = false;
      busyRef.current = true;
      var runId = ++runRef.current;

      setBusy(true);
      setStreaming('');
      // Acknowledgment first, network second. This state is committed in the
      // same render as `busy`, so it is on screen before anything is awaited.
      waiter.begin();

      // Assemble the system prompt: persona + student context + optional case
      var sys = (persona && persona.systemPrompt) ? persona.systemPrompt : 'You are an experienced nursing instructor helping a nursing student study.';
      var ctx = buildStudentContext(progress);
      if (ctx) sys += '\n\n' + ctx;
      if (scenarioId) {
        var sc = null;
        var all = window.ALL_SCENARIOS || [];
        for (var i = 0; i < all.length; i++) if (all[i].id === scenarioId) { sc = all[i]; break; }
        if (sc && A.buildScenarioContext) {
          try { sys += '\n\nCURRENT CASE THE STUDENT IS STUDYING:\n' + A.buildScenarioContext(sc); } catch (e) { /* ignore */ }
        }
      }

      var apiMsgs = convo.map(function (m) {
        return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
      });

      /** true only for the call that is still the current one. */
      function live() {
        return mountedRef.current && runId === runRef.current && !abortRef.current;
      }
      /** Every exit from a turn goes through here — no path leaves it pending. */
      function settle() {
        if (runId !== runRef.current) return false;
        busyRef.current = false;
        if (!mountedRef.current) return false;
        setBusy(false);
        setStreaming('');
        waiter.end();
        return true;
      }

      var acc = '';
      var p;
      try {
        p = A.chat({
          system: sys,
          messages: apiMsgs,
          maxTokens: 1500,
          feature: 'tutor',
          onToken: function (chunk) {
            if (!live()) return;
            acc += chunk;
            setStreaming(acc);
          }
        });
      } catch (e) {
        // A synchronous throw used to leave `busy` true forever, which left the
        // composer stuck on Stop with nothing to stop.
        p = Promise.reject(e);
      }

      Promise.resolve(p).then(function (full) {
        if (!live()) { settle(); return; }
        var finalText = full || acc;
        if (!settle()) return;
        setMsgs(function (prev) {
          return prev.concat([{ role: 'assistant', content: finalText, persona: persona ? persona.id : '' }]);
        });
        setAnnounce(plain(finalText));
        speakIfWanted(plain(finalText));
      }, function (e) {
        if (!live()) { settle(); return; }
        if (!settle()) return;
        var code = (e && e.code) ? String(e.code) : 'server';
        // The turn never happened: take the unanswered message back out of the
        // transcript and put the text back in the box so nobody retypes it.
        setMsgs(function (prev) {
          if (prev.length && prev[prev.length - 1].role === 'user') return prev.slice(0, prev.length - 1);
          return prev;
        });
        setInput(lastSentRef.current);
        setErr({
          title: aiErrTitle(e),
          text: aiErrText(e),
          code: code,
          retry: code === 'network' || code === 'server' || !!(e && e.timedOut),
          reason: (e && e.reason) ? String(e.reason) : ''
        });
      });
    }

    /**
     * "Try again" from inside the wait status, i.e. the model is still
     * theoretically working and the student has run out of patience. Orphans
     * the in-flight call and re-runs the identical transcript. It cannot
     * double-submit: runRef is bumped before the new call and busyRef is set
     * synchronously inside dispatch().
     */
    function retryInFlight() {
      var convo = convoRef.current;
      if (!convo || !convo.length) return;
      abortRef.current = true;
      runRef.current++;
      busyRef.current = false;
      waiter.end();
      setStreaming('');
      dispatch(convo);
    }

    function onKeyDown(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    }

    // ------------------------------------------------------ unavailable UI
    if (!A) {
      return ce('div', null,
        ce('h2', { style: { marginBottom: 6 } }, '🎓 AI Tutor'),
        ce('div', { className: 'card', style: { textAlign: 'center', padding: 34 } },
          ce('div', { style: { fontSize: '2.2rem', marginBottom: 10 }, 'aria-hidden': 'true' }, '📦'),
          ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, 'AI module not loaded'),
          ce('p', { className: 'tutor-lock-note' },
            'The AI tutor module failed to download. Reload the page to try again. ' +
            'If this keeps happening, your network may be blocking our scripts.'),
          ce('button', { className: 'btn btn-primary', onClick: function () { window.location.reload(); } }, 'Reload')
        )
      );
    }

    /* --------------------------------------------------- still checking
       Shaped like the chat that is about to replace it: same header, same
       card, same message-sized lines. No lock, no upgrade copy, no error
       styling, and it disappears the instant the tier lands.

       Gate: while resolving, only the optimistic tier cache may unlock the
       UI early (it is this uid's own last-known tier, so the chip it shows
       is right). Without a cached tier there is NO verdict of any kind
       before the tier record lands - the old `!available && resolving`
       condition let a Pro user's first paint render a FREE-tier chat
       (wrong chip, wrong quota) for ~800ms once Free gained real models. */
    var cachedTier = '';
    try {
      if (A && typeof A.getCachedTier === 'function') cachedTier = String(A.getCachedTier() || '');
    } catch (e) { cachedTier = ''; }
    if (resolving && !cachedTier) {
      return ce('div', null,
        ce('h2', { style: { marginBottom: 6 } }, '🎓 AI Tutor'),
        ce('div', { className: 'mm-chk-box', style: { padding: 20 } },
          ce('div', { role: 'status', 'aria-live': 'polite', className: 'tutor-sr' }, 'Checking your plan'),
          ce(CheckingLines, { widths: ['46%', '88%', '72%'] }),
          ce('div', { style: { height: 14 } }),
          ce(CheckingLines, { widths: ['64%', '80%'] }),
          ce('p', { className: 'mm-chk-note', style: { marginTop: 18 } }, 'Checking your plan...')
        )
      );
    }

    if (!available) {
      // Say WHY. "You are not signed in", "the owner turned it off" and "come
      // back tomorrow" are three different states and must not read the same.
      var why = null;
      try { why = (A.unavailableReason && A.unavailableReason()) || null; } catch (e) { why = null; }
      var code = (why && why.code) ? String(why.code) : '';
      var rawMsg = (why && why.message) ? String(why.message) : '';

      // ai.js reuses 'not-configured' for two different situations: no model
      // assigned yet (a setup step) and a plan that deliberately has no AI.
      if (code === 'not-configured' && /no AI messages allocated|not included in your plan/i.test(rawMsg)) {
        code = 'plan-excluded';
      }

      var tier = '';
      try { tier = A.getTier ? String(A.getTier()) : ''; } catch (e) { tier = ''; }

      var lockIcon = '🔒';
      var lockTitle = (why && why.title) ? why.title : 'The AI tutor is not available on your account';
      // The one-line guard for the sentence that shipped twice: ai.js's
      // ai-disabled message already ends with it.
      var lockMsg = withTail(rawMsg || 'Your current plan does not include the AI tutor, or it is temporarily switched off.');
      var lockNote = '';
      var actions = [];

      if (code === 'signed-out') {
        lockIcon = '👋';
        lockTitle = 'Sign in and your tutor is ready';
        lockMsg = 'Your tutor uses what you have already studied — your missed questions, your sim scores, ' +
                  'your weak areas — so it can skip what you already know. That needs an account.';
        lockNote = 'Nothing is locked away. Everything you have done on this device is saved and will still be here.';
        actions.push(ce('button', { key: 'in', className: 'btn btn-primary', onClick: requestSignIn }, 'Sign in'));
      } else if (code === 'ai-disabled') {
        lockIcon = '🛠';
        lockTitle = 'The tutor is off right now';
        lockMsg = withTail(rawMsg || 'Whoever runs your MedMaster has AI turned off.');
        lockNote = 'This is not something on your account and there is nothing for you to fix. Check back later.';
      } else if (code === 'not-configured') {
        lockIcon = '🛠';
        lockTitle = 'The tutor is not switched on for your plan yet';
        lockMsg = withTail(rawMsg);
        lockNote = 'This one is on us, not you. If your school gave you MedMaster, your instructor can turn it on.';
      } else if (code === 'plan-excluded') {
        lockIcon = '🔒';
        lockTitle = 'The AI tutor is not part of the ' + (tier || 'free') + ' plan';
        lockMsg = rawMsg || 'This plan has no AI tutor messages.';
        lockNote = 'Everything else — 40+ simulations, med admin, smart study and the whole question bank — stays included.';
      } else if (code === 'quota-exceeded') {
        lockIcon = '⏳';
        lockTitle = 'That is all your tutor messages for today';
        var hrs = 0;
        if (usage && usage.resetsAt) hrs = Math.max(1, Math.round((usage.resetsAt - Date.now()) / 3600000));
        lockMsg = (rawMsg || 'You have used all of today\'s tutor messages.') +
                  (hrs ? (' That is about ' + hrs + ' ' + (hrs === 1 ? 'hour' : 'hours') + ' from now.') : '');
        lockNote = 'Honestly — the best thing right after a tutor session is drilling what you just covered.';
        actions.push(ce('button', {
          key: 'drill', className: 'btn btn-primary', onClick: function () { navTo('smart'); }
        }, 'Drill my missed questions'));
      }

      var support = '';
      try {
        var cfg = MMx().siteConfig;
        support = (cfg && cfg.supportEmail) ? String(cfg.supportEmail) : '';
      } catch (e) { support = ''; }
      if (support && (code === 'not-configured' || code === 'plan-excluded')) {
        actions.push(ce('a', {
          key: 'tell', className: 'btn btn-outline',
          href: 'mailto:' + support + '?subject=' + encodeURIComponent('MedMaster: AI tutor is not switched on')
        }, 'Tell my instructor'));
      }

      actions.push(ce('button', {
        key: 'sim', className: 'btn btn-outline', onClick: function () { navTo('simulations'); }
      }, 'Go to Simulations'));
      if (code !== 'quota-exceeded') {
        actions.push(ce('button', {
          key: 'smart', className: 'btn btn-outline', onClick: function () { navTo('smart'); }
        }, 'Smart Study'));
      }

      return ce('div', null,
        ce('h2', { style: { marginBottom: 6 } }, '🎓 AI Tutor'),
        ce('div', { className: 'card', style: { textAlign: 'center', padding: 34 } },
          ce('div', { style: { fontSize: '2.2rem', marginBottom: 10 }, 'aria-hidden': 'true' }, lockIcon),
          ce('div', { style: { fontWeight: 700, marginBottom: 6, fontSize: 'var(--fs-lg, 19px)' } }, lockTitle),
          ce('p', { className: 'tutor-lock-note' }, lockMsg),
          lockNote ? ce('p', { className: 'tutor-lock-note', style: { marginTop: -8 } }, lockNote) : null,
          ce('div', { style: { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' } }, actions),
          tier ? ce('p', { className: 'tutor-meta', style: { marginTop: 14 } }, 'Your plan: ' + tier.toUpperCase()) : null
        )
      );
    }

    // ------------------------------------------------------------- main UI
    var models = [];
    try { models = (A.getModels && A.getModels()) || []; } catch (e) { /* ignore */ }
    var allowChoice = models.length > 1;

    var scenarios = window.ALL_SCENARIOS || [];
    var scenariosByCat = {};
    var catOrder = [];
    scenarios.forEach(function (s) {
      var c = s.category || 'Other';
      if (!scenariosByCat[c]) { scenariosByCat[c] = []; catOrder.push(c); }
      scenariosByCat[c].push(s);
    });

    var lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
    /* The chips used to be gated on `msgs.length <= 1` and the greeting *is*
       message 1 — so the tutor's best affordance appeared for exactly one turn.
       Show them whenever the ball is in the student's court and they have not
       started typing: they are suggestions, not an onboarding step. */
    var showQuick = !busy && !streaming && !input.replace(/\s/g, '') &&
                    (!lastMsg || lastMsg.role === 'assistant');

    return ce('div', { className: 'tutor-wrap' },
      ce('div', { className: 'tutor-head' },
        ce('h2', { style: { margin: 0, fontSize: 'var(--fs-xl, 22px)' } }, '🎓 AI Tutor'),
        usage && usage.limit > 0 ? ce('span', { className: 'tag tag-blue', style: { fontSize: 'var(--fs-xs, 12px)' } },
          usage.used + ' / ' + usage.limit + ' today') : null,
        A.getTier ? ce('span', { className: 'tag', style: { fontSize: 'var(--fs-xs, 12px)', background: 'var(--surface3, #334155)', color: 'var(--text2)' } },
          String(A.getTier()).toUpperCase()) : null
      ),

      // Persona picker. A radiogroup, not a tablist: there are no tabpanels,
      // and this is a single choice out of seven. (DR07 MAJOR-6)
      ce('div', {
        className: 'tutor-persona-strip', role: 'radiogroup',
        'aria-label': 'Choose an instructor'
      },
        personas.map(function (p) {
          var on = !!(persona && p.id === persona.id);
          return ce('button', {
            key: p.id, className: 'tutor-persona' + (on ? ' active' : ''),
            type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false',
            title: p.credential || p.name,
            onClick: function () { switchPersona(p.id); }, disabled: busy
          },
            ce('span', { className: 'tutor-persona-av', 'aria-hidden': 'true' }, p.avatar || '👤'),
            ce('span', { className: 'tutor-persona-txt' },
              ce('span', { className: 'tutor-persona-name' }, p.name),
              ce('span', { className: 'tutor-persona-tag' }, SHORT_TAG[p.id] || p.specialty || ''))
          );
        })
      ),

      ce('div', { className: 'tutor-body' },
        // Messages. aria-live lives on a dedicated off-screen node instead of
        // the whole scroller, which used to re-announce on every token.
        ce('div', {
          className: 'tutor-msgs', ref: scrollRef, tabIndex: 0,
          role: 'region', 'aria-label': 'Conversation with your tutor'
        },
          msgs.map(function (m, i) {
            var isUser = m.role === 'user';
            var p = null;
            if (!isUser && m.persona) {
              for (var k = 0; k < personas.length; k++) if (personas[k].id === m.persona) { p = personas[k]; break; }
            }
            var meta = [];
            // The specialty line used to live in an unreachable `.tutor-empty`
            // block. It belongs on the greeting, which always renders.
            if (m.greeting && p) {
              var bits = [];
              if (p.credential) bits.push(p.credential);
              if (p.specialty) bits.push(p.specialty);
              if (bits.length) meta.push(ce('div', { key: 'sp', className: 'tutor-meta' }, bits.join(' · ')));
            }
            if (m.stopped) meta.push(ce('div', { key: 'st', className: 'tutor-meta' }, 'You stopped this reply.'));
            if (!isUser && V && V.speak && window.SpeakButton) {
              meta.push(ce('div', { key: 'sb', className: 'tutor-meta' },
                ce(window.SpeakButton, { text: m.content, voice: (p && p.voiceHint) || 'instructor', label: 'Listen' })));
            }
            return ce('div', { key: i, className: 'tutor-msg ' + (isUser ? 'user' : 'ai') },
              ce('div', { className: 'tutor-av', 'aria-hidden': 'true' }, isUser ? '🧑‍⚕️' : (p ? (p.avatar || '🎓') : '🎓')),
              ce('div', null,
                isUser
                  ? ce('div', { className: 'tutor-bubble' }, esc(m.content))
                  : ce(Rich, { text: m.content, k: 'm' + i }),
                meta.length ? meta : null
              )
            );
          }),
          streaming
            ? ce('div', { className: 'tutor-msg ai' },
                ce('div', { className: 'tutor-av', 'aria-hidden': 'true' }, persona ? (persona.avatar || '🎓') : '🎓'),
                ce('div', null,
                  ce(Rich, { text: streaming, k: 'stream', caret: true }),
                  /* Text is arriving, so the dots would be noise — but if the
                     stream itself stalls, say so rather than letting a half
                     answer sit there looking finished. */
                  (waiter.wait && waiter.wait.tier >= 2)
                    ? ce('div', { className: 'tutor-slowline' },
                        ce('span', { role: 'status', 'aria-live': 'polite' },
                          'Still writing — this model is being slow.'),
                        ce('span', { 'aria-hidden': 'true' }, Math.floor(waiter.wait.ms / 1000) + 's'))
                    : null))
            : null,
          /* No tokens yet. This is the state the buffered SSE proxy produces
             for the entire generation, so it is the one that must never look
             frozen: the counter inside WaitNote runs off wall time. */
          busy && !streaming
            ? ce('div', { className: 'tutor-msg ai' },
                ce('div', { className: 'tutor-av', 'aria-hidden': 'true' }, persona ? (persona.avatar || '🎓') : '🎓'),
                ce('div', { className: 'tutor-bubble' },
                  ce(WaitNote, { wait: waiter.wait, onRetry: retryInFlight })))
            : null
        ),

        ce('div', { className: 'tutor-sr', 'aria-live': 'polite', 'aria-atomic': 'true' }, announce),

        /* One box, six different things it can say. The headline names the
           condition so 'you are signed out' and 'the network dropped' do not
           read as the same shrug, and Retry only appears where retrying is
           actually the right move. */
        err ? ce('div', {
          className: 'tutor-err', role: 'alert',
          'data-code': err.code || ''
        },
          err.title ? ce('div', { className: 'tutor-err-t' }, err.title) : null,
          ce('div', null, err.text),
          ce('div', { className: 'tutor-err-act' },
            err.retry ? ce('button', {
              className: 'btn btn-primary btn-sm',
              disabled: busy,
              onClick: function () { send(lastSentRef.current); }
            }, 'Retry') : null,
            err.code === 'no-auth' ? ce('button', {
              className: 'btn btn-primary btn-sm', onClick: requestSignIn
            }, 'Sign in') : null,
            err.code === 'quota-exceeded' ? ce('button', {
              className: 'btn btn-primary btn-sm', onClick: function () { navTo('smart'); }
            }, 'Drill my missed questions') : null,
            ce('button', {
              className: 'btn btn-outline btn-sm', onClick: function () { setErr(null); }
            }, 'Dismiss')
          )
        ) : null,

        // Quick actions
        showQuick ? ce('div', { className: 'tutor-quick' },
          ce('span', { className: 'tutor-quick-lab' }, msgs.length > 1 ? 'Or ask for' : 'Try'),
          QUICK_ACTIONS.map(function (q) {
            return ce('button', { key: q.id, className: 'tutor-chip', type: 'button', onClick: function () { send(q.prompt); } }, q.label);
          })
        ) : null,

        // Input. The textarea stays enabled while a reply streams so a student
        // can line up their next question — and Stop actually stops.
        ce('div', { className: 'tutor-input-row' },
          window.VoiceButton
            ? ce(window.VoiceButton, {
                size: 'md', label: 'Speak',
                onTranscript: function (t) { if (t) setInput(function (p) { return (p ? p + ' ' : '') + t; }); }
              })
            : null,
          ce('textarea', {
            ref: inputRef, className: 'tutor-input', value: input, rows: 1,
            placeholder: persona ? ('Ask ' + persona.name + ' anything...') : 'Ask your tutor...',
            'aria-label': 'Message to your tutor',
            onChange: function (e) { setInput(e.target.value); },
            onKeyDown: onKeyDown
          }),
          busy
            ? ce('button', {
                className: 'tutor-stop', type: 'button', onClick: stopGeneration,
                title: 'Stop this reply', 'aria-label': 'Stop this reply'
              }, '■ Stop')
            : ce('button', {
                className: 'tutor-send', type: 'button', onClick: function () { send(); },
                disabled: !input.replace(/\s/g, ''), title: 'Send', 'aria-label': 'Send message'
              }, '➤')
        ),

        // Bottom bar: model, case context, auto-speak
        ce('div', { className: 'tutor-bar' },
          allowChoice ? ce('label', { htmlFor: 'tutor-model' }, 'Model ',
            ce('select', {
              id: 'tutor-model', className: 'tutor-sel', value: model,
              onChange: function (e) { setModel(e.target.value); try { A.setSelectedModel(e.target.value); } catch (x) { /* ignore */ } }
            }, models.map(function (m) { return ce('option', { key: m.id, value: m.id }, m.name); }))
          ) : null,
          scenarios.length ? ce('label', { htmlFor: 'tutor-case' }, 'Study with a case ',
            ce('select', {
              id: 'tutor-case', className: 'tutor-sel', value: scenarioId,
              title: 'The tutor will use this patient in its examples',
              onChange: function (e) { setScenarioId(e.target.value); }
            },
              ce('option', { value: '' }, 'No case'),
              catOrder.map(function (c) {
                return ce('optgroup', { key: c, label: c },
                  scenariosByCat[c].map(function (s) { return ce('option', { key: s.id, value: s.id }, s.title); }));
              })
            )
          ) : null,
          scenarioId ? ce('span', { className: 'tutor-meta' }, 'The tutor will use this patient in its examples.') : null,
          (V && V.speak) ? ce('label', { style: { cursor: 'pointer' } },
            ce('input', {
              type: 'checkbox', checked: autoSpeak,
              onChange: function (e) {
                var on = e.target.checked;
                setAutoSpeak(on);
                // iOS needs the first speak() inside a user gesture
                if (on) { try { if (V.prime) V.prime(); } catch (x) { /* ignore */ } }
                else { try { V.stopSpeaking(); } catch (x) { /* ignore */ } }
              }
            }),
            'Read replies aloud'
          ) : null,
          msgs.length > 1 ? ce('button', {
            className: 'tutor-chip', type: 'button', style: { marginLeft: 'auto', minHeight: 32 },
            onClick: function () {
              var ok = true;
              try { ok = window.confirm('Clear this conversation?'); } catch (e) { ok = true; }
              if (!ok) return;
              var g = greetMsg();
              setMsgs(g ? [g] : []);
              setErr(null);
            }
          }, 'Clear chat') : null
        )
      )
    );
  }

  window.AITutorPage = AITutorPage;
})();
