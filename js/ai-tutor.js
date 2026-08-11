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
      '.tutor-wrap{display:flex;flex-direction:column;height:calc(100vh - 40px);max-height:900px}',
      '.tutor-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}',
      '.tutor-persona-strip{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 10px;scrollbar-width:thin}',
      '.tutor-persona{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;',
      'border:2px solid var(--surface2);background:var(--surface);cursor:pointer;color:var(--text2);',
      'font-size:0.85rem;font-weight:600;transition:border-color .15s,color .15s;white-space:nowrap}',
      '.tutor-persona:hover{border-color:var(--accent)}',
      '.tutor-persona:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.tutor-persona.active{border-color:var(--accent);color:var(--text);background:rgba(59,130,246,0.12)}',
      '.tutor-persona-av{font-size:1.15rem;line-height:1}',
      '.tutor-body{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--surface);',
      'border:1px solid var(--surface2);border-radius:14px;overflow:hidden}',
      '.tutor-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}',
      '.tutor-msg{display:flex;gap:10px;max-width:88%}',
      '.tutor-msg.user{align-self:flex-end;flex-direction:row-reverse}',
      '.tutor-bubble{padding:10px 14px;border-radius:14px;font-size:0.92rem;line-height:1.55;white-space:pre-wrap;word-break:break-word}',
      '.tutor-msg.ai .tutor-bubble{background:var(--surface2);color:var(--text);border-bottom-left-radius:4px}',
      '.tutor-msg.user .tutor-bubble{background:var(--accent);color:#fff;border-bottom-right-radius:4px}',
      '.tutor-av{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
      'background:var(--surface2);font-size:1.05rem;flex:0 0 auto}',
      '.tutor-msg.user .tutor-av{background:var(--accent2)}',
      '.tutor-meta{font-size:0.7rem;color:var(--text3);margin-top:4px}',
      '.tutor-input-row{display:flex;gap:8px;padding:12px;border-top:1px solid var(--surface2);align-items:flex-end;background:var(--bg)}',
      '.tutor-input{flex:1;min-height:44px;max-height:140px;resize:none;padding:11px 13px;border-radius:11px;',
      'border:2px solid var(--surface2);background:var(--surface);color:var(--text);font-size:0.92rem;font-family:inherit;line-height:1.45}',
      '.tutor-input:focus{outline:none;border-color:var(--accent)}',
      '.tutor-send{min-width:44px;min-height:44px;border-radius:11px;border:none;background:var(--accent);',
      'color:#fff;font-size:1.05rem;cursor:pointer;font-weight:700}',
      '.tutor-send:disabled{opacity:.45;cursor:not-allowed}',
      '.tutor-send:focus-visible{outline:2px solid var(--text);outline-offset:2px}',
      '.tutor-quick{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px 0}',
      '.tutor-chip{padding:6px 11px;border-radius:999px;border:1px solid var(--surface2);background:var(--surface);',
      'color:var(--text2);font-size:0.78rem;cursor:pointer;font-weight:600}',
      '.tutor-chip:hover{border-color:var(--accent);color:var(--text)}',
      '.tutor-chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
      '.tutor-typing{display:inline-flex;gap:3px;align-items:center}',
      '.tutor-dot{width:6px;height:6px;border-radius:50%;background:var(--text3);animation:tutorBounce 1.2s infinite}',
      '.tutor-dot:nth-child(2){animation-delay:.15s}.tutor-dot:nth-child(3){animation-delay:.3s}',
      '@keyframes tutorBounce{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}',
      '.tutor-empty{text-align:center;color:var(--text3);padding:32px 18px;margin:auto}',
      '.tutor-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:0.78rem;color:var(--text3);',
      'padding:8px 12px;border-top:1px solid var(--surface2)}',
      '.tutor-sel{padding:5px 9px;border-radius:8px;border:1px solid var(--surface2);background:var(--surface);',
      'color:var(--text2);font-size:0.78rem}',
      '.tutor-err{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--red);',
      'padding:10px 13px;border-radius:10px;font-size:0.86rem;margin:8px 12px}',
      '@media(max-width:640px){',
      '.tutor-wrap{height:calc(100vh - 20px)}',
      '.tutor-msg{max-width:95%}',
      '.tutor-persona-strip{gap:6px}',
      '.tutor-persona{padding:7px 10px;font-size:0.8rem}',
      '}',
      '@media(prefers-reduced-motion:reduce){.tutor-dot{animation:none}}'
    ].join('');
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------- utilities
  function ai() { return (window.MM && window.MM.ai) ? window.MM.ai : null; }
  function voice() { return (window.MM && window.MM.voice) ? window.MM.voice : null; }

  function esc(s) { return String(s == null ? '' : s); }

  /* Build a compact snapshot of how the student is doing so the tutor can
     personalise. Kept short on purpose — this is prepended to every request. */
  function buildStudentContext(progress) {
    if (!progress) return '';
    var out = [];
    var stats = progress.questionStats || {};
    var ids = Object.keys(stats);
    if (ids.length) {
      var weak = [];
      var byCat = {};
      ids.forEach(function (id) {
        var s = stats[id];
        if (!s || !s.attempts) return;
        var q = null;
        try {
          q = (window.QUESTIONS || []).filter(function (x) { return x.id === id; })[0];
        } catch (e) {}
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
    var _e = useState(''); var err = _e[0], setErr = _e[1];
    var _s = useState(''); var streaming = _s[0], setStreaming = _s[1];
    var _a = useState(false); var autoSpeak = _a[0], setAutoSpeak = _a[1];
    var _sc = useState(''); var scenarioId = _sc[0], setScenarioId = _sc[1];
    var _u = useState(null); var usage = _u[0], setUsage = _u[1];
    var _mo = useState(''); var model = _mo[0], setModel = _mo[1];

    var scrollRef = useRef(null);
    var inputRef = useRef(null);
    var abortRef = useRef(false);

    var persona = useMemo(function () {
      for (var i = 0; i < personas.length; i++) if (personas[i].id === personaId) return personas[i];
      return personas[0] || null;
    }, [personaId, personas.length]);

    var available = !!(A && A.isAvailable && A.isAvailable());

    // Load usage + selected model
    useEffect(function () {
      if (!A) return;
      try { if (A.getUsage) Promise.resolve(A.getUsage()).then(setUsage).catch(function () {}); } catch (e) {}
      try { if (A.getSelectedModel) setModel(A.getSelectedModel() || ''); } catch (e) {}
    }, [busy]);

    // Auto-scroll to newest
    useEffect(function () {
      var el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, [msgs.length, streaming]);

    // Greeting when persona changes and chat is empty
    useEffect(function () {
      if (!persona || msgs.length) return;
      setMsgs([{ role: 'assistant', content: persona.greeting || ('Hi, I am ' + persona.name + '. What are we working on today?'), persona: persona.id }]);
    }, [personaId]);

    // Stop any speech when leaving
    useEffect(function () {
      return function () { try { if (V && V.stopSpeaking) V.stopSpeaking(); } catch (e) {} };
    }, []);

    function switchPersona(id) {
      if (busy) return;
      try { if (V && V.stopSpeaking) V.stopSpeaking(); } catch (e) {}
      setPersonaId(id);
      setMsgs([]);
      setErr('');
    }

    function speakIfWanted(text) {
      if (!autoSpeak || !V || !V.speak) return;
      try {
        V.speak(text, { voice: (persona && persona.voiceHint) ? persona.voiceHint : 'instructor' })
          .catch(function () {});
      } catch (e) {}
    }

    function send(overrideText) {
      var text = (overrideText != null ? overrideText : input).trim();
      if (!text || busy) return;
      if (!available) { setErr('AI is not available on your account right now.'); return; }

      setErr('');
      setInput('');
      abortRef.current = false;

      var nextMsgs = msgs.concat([{ role: 'user', content: text }]);
      setMsgs(nextMsgs);
      setBusy(true);
      setStreaming('');

      // Assemble the system prompt: persona + student context + optional case
      var sys = (persona && persona.systemPrompt) ? persona.systemPrompt : 'You are an experienced nursing instructor helping a nursing student study.';
      var ctx = buildStudentContext(progress);
      if (ctx) sys += '\n\n' + ctx;
      if (scenarioId) {
        var sc = null;
        var all = window.ALL_SCENARIOS || [];
        for (var i = 0; i < all.length; i++) if (all[i].id === scenarioId) { sc = all[i]; break; }
        if (sc && A.buildScenarioContext) {
          try { sys += '\n\nCURRENT CASE THE STUDENT IS STUDYING:\n' + A.buildScenarioContext(sc); } catch (e) {}
        }
      }

      var apiMsgs = nextMsgs.map(function (m) {
        return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
      });

      var acc = '';
      A.chat({
        system: sys,
        messages: apiMsgs,
        maxTokens: 1500,
        onToken: function (chunk) {
          if (abortRef.current) return;
          acc += chunk;
          setStreaming(acc);
        }
      }).then(function (full) {
        if (abortRef.current) return;
        var finalText = full || acc;
        setMsgs(function (prev) {
          return prev.concat([{ role: 'assistant', content: finalText, persona: persona ? persona.id : '' }]);
        });
        setStreaming('');
        setBusy(false);
        speakIfWanted(finalText);
      }).catch(function (e) {
        if (abortRef.current) return;
        setStreaming('');
        setBusy(false);
        var code = e && e.code ? e.code : 'server';
        var msg;
        if (code === 'no-auth') msg = 'You need to be signed in to use the AI tutor.';
        else if (code === 'tier-denied') msg = 'Your account tier does not include this model. Try a different model or ask your instructor for access.';
        else if (code === 'quota-exceeded') msg = 'You have used all your AI messages for today. They reset at midnight.';
        else if (code === 'ai-disabled') msg = 'The AI tutor is turned off right now.';
        else if (code === 'network') msg = 'Network problem reaching the tutor. Check your connection and try again.';
        else msg = 'Something went wrong reaching the tutor. Please try again.';
        setErr(msg);
      });
    }

    function onKeyDown(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    }

    // ------------------------------------------------------ unavailable UI
    if (!A) {
      return ce('div', null,
        ce('h2', { style: { marginBottom: 6 } }, '🎓 AI Tutor'),
        ce('div', { className: 'card', style: { textAlign: 'center', padding: 34 } },
          ce('div', { style: { fontSize: '2.2rem', marginBottom: 10 } }, '📦'),
          ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, 'AI module not loaded'),
          ce('p', { style: { color: 'var(--text3)', fontSize: '0.9rem' } },
            'The AI tutor module failed to download. Reload the page to try again.'),
          ce('button', { className: 'btn btn-primary', style: { marginTop: 14 }, onClick: function () { window.location.reload(); } }, 'Reload')
        )
      );
    }

    if (!available) {
      return ce('div', null,
        ce('h2', { style: { marginBottom: 6 } }, '🎓 AI Tutor'),
        ce('div', { className: 'card', style: { textAlign: 'center', padding: 34 } },
          ce('div', { style: { fontSize: '2.2rem', marginBottom: 10 } }, '🔒'),
          ce('div', { style: { fontWeight: 700, marginBottom: 6 } }, 'AI tutoring is not enabled on your account'),
          ce('p', { style: { color: 'var(--text3)', fontSize: '0.9rem', maxWidth: 420, margin: '0 auto 14px' } },
            'Your current plan does not include the AI tutor, or it is temporarily switched off. Everything else in MedMaster still works.'),
          ce('div', { style: { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' } },
            ce('button', { className: 'btn btn-outline', onClick: function () { if (window.MM.navigate) window.MM.navigate('simulations'); } }, 'Go to Simulations'),
            ce('button', { className: 'btn btn-outline', onClick: function () { if (window.MM.navigate) window.MM.navigate('smart'); } }, 'Smart Study')
          )
        )
      );
    }

    // ------------------------------------------------------------- main UI
    var models = [];
    try { models = (A.getModels && A.getModels()) || []; } catch (e) {}
    var allowChoice = models.length > 1;

    var scenarios = window.ALL_SCENARIOS || [];

    return ce('div', { className: 'tutor-wrap' },
      ce('div', { className: 'tutor-head' },
        ce('h2', { style: { margin: 0, fontSize: '1.3rem' } }, '🎓 AI Tutor'),
        usage && usage.limit > 0 ? ce('span', { className: 'tag tag-blue', style: { fontSize: '0.72rem' } },
          usage.used + ' / ' + usage.limit + ' today') : null,
        A.getTier ? ce('span', { className: 'tag', style: { fontSize: '0.72rem', background: 'var(--surface2)', color: 'var(--text2)' } },
          String(A.getTier()).toUpperCase()) : null
      ),

      // Persona picker
      ce('div', { className: 'tutor-persona-strip', role: 'tablist', 'aria-label': 'Choose an instructor' },
        personas.map(function (p) {
          var on = persona && p.id === persona.id;
          return ce('button', {
            key: p.id, className: 'tutor-persona' + (on ? ' active' : ''),
            role: 'tab', 'aria-selected': on ? 'true' : 'false',
            onClick: function () { switchPersona(p.id); }, disabled: busy
          },
            ce('span', { className: 'tutor-persona-av' }, p.avatar || '👤'),
            ce('span', null, p.name),
            on ? ce('span', { style: { fontSize: '0.68rem', opacity: 0.75 } }, p.credential || '') : null
          );
        })
      ),

      ce('div', { className: 'tutor-body' },
        // Messages
        ce('div', { className: 'tutor-msgs', ref: scrollRef, 'aria-live': 'polite' },
          msgs.length === 0 && !streaming
            ? ce('div', { className: 'tutor-empty' },
                ce('div', { style: { fontSize: '2rem', marginBottom: 8 } }, persona ? (persona.avatar || '🎓') : '🎓'),
                ce('div', { style: { fontWeight: 700, color: 'var(--text)', marginBottom: 4 } }, persona ? persona.name : 'Your tutor'),
                ce('div', { style: { fontSize: '0.86rem' } }, persona ? persona.specialty : ''))
            : null,
          msgs.map(function (m, i) {
            var isUser = m.role === 'user';
            var p = null;
            if (!isUser && m.persona) {
              for (var k = 0; k < personas.length; k++) if (personas[k].id === m.persona) { p = personas[k]; break; }
            }
            return ce('div', { key: i, className: 'tutor-msg ' + (isUser ? 'user' : 'ai') },
              ce('div', { className: 'tutor-av' }, isUser ? '🧑‍⚕️' : (p ? (p.avatar || '🎓') : '🎓')),
              ce('div', null,
                ce('div', { className: 'tutor-bubble' }, esc(m.content)),
                !isUser && V && V.speak
                  ? ce('div', { className: 'tutor-meta' },
                      window.SpeakButton
                        ? ce(window.SpeakButton, { text: m.content, voice: (p && p.voiceHint) || 'instructor', label: 'Listen' })
                        : null)
                  : null
              )
            );
          }),
          streaming
            ? ce('div', { className: 'tutor-msg ai' },
                ce('div', { className: 'tutor-av' }, persona ? (persona.avatar || '🎓') : '🎓'),
                ce('div', null, ce('div', { className: 'tutor-bubble' }, streaming)))
            : null,
          busy && !streaming
            ? ce('div', { className: 'tutor-msg ai' },
                ce('div', { className: 'tutor-av' }, persona ? (persona.avatar || '🎓') : '🎓'),
                ce('div', { className: 'tutor-bubble' },
                  ce('span', { className: 'tutor-typing' },
                    ce('span', { className: 'tutor-dot' }), ce('span', { className: 'tutor-dot' }), ce('span', { className: 'tutor-dot' }))))
            : null
        ),

        err ? ce('div', { className: 'tutor-err', role: 'alert' }, err) : null,

        // Quick actions
        msgs.length <= 1 ? ce('div', { className: 'tutor-quick' },
          QUICK_ACTIONS.map(function (q) {
            return ce('button', { key: q.id, className: 'tutor-chip', onClick: function () { send(q.prompt); }, disabled: busy }, q.label);
          })
        ) : null,

        // Input
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
            onKeyDown: onKeyDown, disabled: busy
          }),
          ce('button', {
            className: 'tutor-send', onClick: function () { send(); },
            disabled: busy || !input.trim(), title: 'Send', 'aria-label': 'Send message'
          }, '➤')
        ),

        // Bottom bar: model, case context, auto-speak
        ce('div', { className: 'tutor-bar' },
          allowChoice ? ce('label', null, 'Model ',
            ce('select', {
              className: 'tutor-sel', value: model,
              onChange: function (e) { setModel(e.target.value); try { A.setSelectedModel(e.target.value); } catch (x) {} }
            }, models.map(function (m) { return ce('option', { key: m.id, value: m.id }, m.name); }))
          ) : null,
          scenarios.length ? ce('label', null, 'Case ',
            ce('select', {
              className: 'tutor-sel', value: scenarioId,
              onChange: function (e) { setScenarioId(e.target.value); }
            },
              ce('option', { value: '' }, 'None'),
              scenarios.map(function (s) { return ce('option', { key: s.id, value: s.id }, s.title); })
            )
          ) : null,
          (V && V.speak) ? ce('label', { style: { display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' } },
            ce('input', {
              type: 'checkbox', checked: autoSpeak,
              onChange: function (e) {
                var on = e.target.checked;
                setAutoSpeak(on);
                // iOS needs the first speak() inside a user gesture
                if (on) { try { if (V.prime) V.prime(); } catch (x) {} }
                else { try { V.stopSpeaking(); } catch (x) {} }
              }
            }),
            'Read replies aloud'
          ) : null,
          msgs.length > 1 ? ce('button', {
            className: 'tutor-chip', style: { marginLeft: 'auto' },
            onClick: function () { if (window.confirm('Clear this conversation?')) { setMsgs([]); setErr(''); } }
          }, 'Clear chat') : null
        )
      )
    );
  }

  window.AITutorPage = AITutorPage;
})();
