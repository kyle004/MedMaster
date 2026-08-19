/* ============================================================================
 * js/headtotoe.js  ->  window.HeadToToeTrainer
 *
 * The ICHS Head-to-Toe Assessment Rubric, two ways to run it:
 *
 *   checkoff — an instructor (or a classmate) ticks items off live.
 *   voice    — the student talks through the assessment; a keyword pass rough-
 *              marks the sheet immediately, then AI marks it against the rubric.
 *
 * Rubric comes from window.H2T_RUBRIC (data/headtotoe.js), which is GENERATED
 * from the iOS source so the two platforms cannot drift.
 *
 * Mirrors the iOS feature (Features/HeadToToe/) including the parts that were
 * learned the hard way there:
 *   - partial credit rounds DOWN (better to under-predict a checkoff than over)
 *   - time is FLAGGED, never deducted — the sheet lists it as an instruction,
 *     not a penalty, so the app must not invent a deduction
 *   - AI is asked for two short id lists, not an object keyed by all 71 items:
 *     the object form reliably timed out at the gateway
 *   - a failed AI call keeps the keyword marks and says so
 * ==========================================================================*/
(function () {
  'use strict';

  var e = React.createElement;

  function rubric() { return window.H2T_RUBRIC || { categories: [], cohorts: {}, totalPoints: 100 }; }

  function allItems() {
    var out = [];
    rubric().categories.forEach(function (c) { c.items.forEach(function (i) { out.push(i); }); });
    return out;
  }

  function itemById(id) {
    var found = null;
    allItems().forEach(function (i) { if (i.id === id) found = i; });
    return found;
  }

  /* Award -> points. `partial` halves and floors, and a 1-point item cannot be
   * halved at all, so it scores zero rather than rounding up to full credit. */
  function pointsFor(award, item) {
    if (award === 'full') return item.points;
    if (award === 'partial') return item.points > 1 ? Math.floor(item.points / 2) : 0;
    return 0;
  }

  function clock(total) {
    var m = Math.floor(total / 60), s = total % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function HeadToToeTrainer() {
    var st = React.useState('setup');       var stage = st[0], setStage = st[1];
    var md = React.useState('checkoff');    var mode = md[0], setMode = md[1];
    var ch = React.useState('medSurg1');    var cohortKey = ch[0], setCohortKey = ch[1];
    var aw = React.useState({});            var awards = aw[0], setAwards = aw[1];
    var cn = React.useState({});            var nerves = cn[0], setNerves = cn[1];
    var el = React.useState(0);             var elapsed = el[0], setElapsed = el[1];
    var rn = React.useState(false);         var running = rn[0], setRunning = rn[1];
    var tx = React.useState('');            var transcript = tx[0], setTranscript = tx[1];
    var lv = React.useState('');            var live = lv[0], setLive = lv[1];
    var rc = React.useState(false);         var recording = rc[0], setRecording = rc[1];
    var sc = React.useState(false);         var scoring = sc[0], setScoring = sc[1];
    var fb = React.useState('');            var feedback = fb[0], setFeedback = fb[1];
    var er = React.useState('');            var aiError = er[0], setAiError = er[1];

    var recogRef = React.useRef(null);

    var cohort = (rubric().cohorts || {})[cohortKey] || { label: '', passMark: 75, timeLimitSeconds: 720 };

    React.useEffect(function () {
      if (!running) return;
      var t = setInterval(function () { setElapsed(function (x) { return x + 1; }); }, 1000);
      return function () { clearInterval(t); };
    }, [running]);

    // Stop dictation if the component goes away mid-run.
    React.useEffect(function () {
      return function () { try { if (recogRef.current) recogRef.current.stop(); } catch (err) {} };
    }, []);

    function awardOf(id) { return awards[id] || 'none'; }

    function cycle(item) {
      var cur = awardOf(item.id);
      var next = cur === 'none' ? 'full' : (cur === 'full' ? (item.points > 1 ? 'partial' : 'none') : 'none');
      var n = {}; for (var k in awards) n[k] = awards[k];
      n[item.id] = next;
      setAwards(n);
    }

    function categoryScore(cat) {
      var s = 0;
      cat.items.forEach(function (i) { s += pointsFor(awardOf(i.id), i); });
      return s;
    }

    function totalScore() {
      var s = 0;
      rubric().categories.forEach(function (c) { s += categoryScore(c); });
      return s;
    }

    var overTime = elapsed > cohort.timeLimitSeconds;
    var passed = totalScore() >= cohort.passMark && !overTime;

    /* ---- voice ---------------------------------------------------------- */

    function prefill(text) {
      var hay = String(text || '').toLowerCase();
      var n = {}; for (var k in awards) n[k] = awards[k];
      allItems().forEach(function (item) {
        if (!item.cues || !item.cues.length) return;
        var hit = item.cues.some(function (c) { return hay.indexOf(String(c).toLowerCase()) !== -1; });
        if (hit && (n[item.id] || 'none') === 'none') n[item.id] = 'full';
      });
      setAwards(n);
    }

    function toggleRecording() {
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        setAiError('This browser has no speech recognition. Type what you said instead.');
        return;
      }
      if (recording) {
        try { recogRef.current && recogRef.current.stop(); } catch (err) {}
        return;
      }
      var r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = 'en-US';
      var finalText = '';
      r.onresult = function (ev) {
        var interim = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var chunk = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalText += chunk + ' '; else interim += chunk;
        }
        setLive(finalText + interim);
      };
      r.onerror = function (ev) { setAiError('Microphone error: ' + (ev.error || 'unknown')); };
      r.onend = function () {
        setRecording(false);
        var t = finalText.trim();
        if (t) { setTranscript(t); prefill(t); }
      };
      recogRef.current = r;
      setAiError('');
      setRecording(true);
      try { r.start(); } catch (err) { setRecording(false); setAiError('Could not start the microphone.'); }
    }

    function scoreWithAI() {
      if (!transcript.trim()) return;
      setScoring(true); setAiError(''); setFeedback('');

      var lines = rubric().categories.map(function (c) {
        return c.name + '\n' + c.items.map(function (i) { return i.id + ': ' + i.text; }).join('\n');
      }).join('\n\n');

      var system =
        "You are marking a nursing student's head-to-toe assessment against a fixed rubric.\n" +
        "Rules:\n" +
        "- Mark ONLY from the rubric given. Never invent criteria.\n" +
        "- List an id under \"full\" only when the transcript shows the step was performed or\n" +
        "  verbalised. Use \"partial\" when a multi-point step was only partly done. Anything\n" +
        "  unlisted counts as not done — absence of evidence is not evidence.\n" +
        "- A transcript cannot show physical technique. Leave purely manual items unlisted\n" +
        "  unless narrated, and say so in feedback rather than guessing.\n" +
        '- Reply ONLY with compact JSON: {"full":["id"],"partial":["id"],"feedback":"<= 80 words"}';

      var ai = (window.MM && window.MM.ai) || window.MM_AI;
      if (!ai || typeof ai.chat !== 'function') {
        setScoring(false);
        setAiError('AI is unavailable here. Your marks from the recording are still on the sheet — adjust them by hand.');
        return;
      }

      ai.chat({
        feature: 'sim',
        system: system,
        messages: [{ role: 'user', content: 'RUBRIC:\n' + lines + '\n\nTRANSCRIPT:\n' + transcript }],
        wantJSON: true
      }).then(function (raw) {
        var text = (raw && (raw.content || raw.text || raw)) || '';
        var parsed = null;
        try { parsed = JSON.parse(text); } catch (err) {
          var a = String(text).indexOf('{'), b = String(text).lastIndexOf('}');
          if (a !== -1 && b > a) { try { parsed = JSON.parse(String(text).slice(a, b + 1)); } catch (e2) { parsed = null; } }
        }
        if (!parsed) { setAiError('Could not read the AI response. Mark it by hand.'); setScoring(false); return; }

        // Unlisted means not done, so start clean rather than inheriting the
        // keyword pass's optimistic guesses and inflating the score.
        var n = {};
        (parsed.full || []).forEach(function (id) { if (itemById(id)) n[id] = 'full'; });
        (parsed.partial || []).forEach(function (id) { if (itemById(id)) n[id] = 'partial'; });
        setAwards(n);
        setFeedback(parsed.feedback || '');
        setScoring(false);
      }).catch(function (err) {
        setScoring(false);
        setAiError('AI scoring failed: ' + ((err && err.message) || 'server error') +
                   ' Your marks from the recording are still on the sheet — adjust them by hand.');
      });
    }

    /* ---- render --------------------------------------------------------- */

    if (stage === 'setup') {
      return e('div', { className: 'page-wrap' },
        e('h2', { className: 'page-title' }, 'Head-to-Toe Assessment'),
        e('p', { className: 'page-sub' }, 'The ICHS rubric, all 100 points. Practise it out loud or have someone mark you.'),

        e('div', { className: 'h2t-modes' },
          [['checkoff', '📋', 'Score someone', 'Tick items off live while you watch them. You are the instructor.'],
           ['voice', '🎤', 'Record yourself', 'Talk through the assessment. AI marks it against the rubric.']
          ].map(function (m) {
            return e('button', {
              key: m[0], type: 'button',
              className: 'h2t-mode' + (mode === m[0] ? ' active' : ''),
              onClick: function () { setMode(m[0]); }
            },
              e('span', { className: 'h2t-mode-icon' }, m[1]),
              e('span', null,
                e('span', { className: 'h2t-mode-title' }, m[2]),
                e('span', { className: 'h2t-mode-blurb' }, m[3])
              )
            );
          })
        ),

        e('div', { className: 'h2t-cohort' },
          e('label', null, 'Cohort'),
          e('select', {
            value: cohortKey,
            onChange: function (ev) { setCohortKey(ev.target.value); }
          }, Object.keys(rubric().cohorts || {}).map(function (k) {
            return e('option', { key: k, value: k }, rubric().cohorts[k].label);
          }))
        ),
        e('p', { className: 'h2t-hint' },
          'Pass mark ' + cohort.passMark + '/100 · time limit ' + clock(cohort.timeLimitSeconds)),

        e('button', {
          type: 'button', className: 'btn btn-primary h2t-start',
          onClick: function () { setAwards({}); setElapsed(0); setTranscript(''); setLive(''); setFeedback(''); setAiError(''); setStage('run'); setRunning(true); }
        }, 'Start assessment')
      );
    }

    if (stage === 'result') {
      var missed = [];
      rubric().categories.forEach(function (c) {
        c.items.forEach(function (i) { if (awardOf(i.id) !== 'full') missed.push(i); });
      });
      return e('div', { className: 'page-wrap' },
        e('div', { className: 'h2t-result ' + (passed ? 'pass' : 'fail') },
          e('div', { className: 'h2t-result-verdict' }, passed ? 'PASS' : 'NOT YET PASSING'),
          e('div', { className: 'h2t-result-score' }, totalScore() + ' / 100'),
          e('div', { className: 'h2t-result-sub' }, cohort.label + ' needs ' + cohort.passMark + '/100'),
          e('div', { className: 'h2t-result-sub' + (overTime ? ' over' : '') },
            'Time ' + clock(elapsed) + (overTime ? ' · over the ' + clock(cohort.timeLimitSeconds) + ' limit' : ''))
        ),
        feedback ? e('div', { className: 'h2t-card' },
          e('h4', null, 'AI feedback'), e('p', null, feedback)) : null,
        missed.length ? e('div', { className: 'h2t-card' },
          e('h4', null, 'Points dropped (' + missed.length + ')'),
          e('ul', { className: 'h2t-missed' }, missed.map(function (i) {
            return e('li', { key: i.id }, i.text + ' (' + pointsFor(awardOf(i.id), i) + '/' + i.points + ')');
          }))
        ) : null,
        e('button', { type: 'button', className: 'btn btn-primary', onClick: function () { setStage('setup'); } },
          'Back to setup')
      );
    }

    // running
    return e('div', { className: 'page-wrap' },
      e('div', { className: 'h2t-bar' },
        e('div', null,
          e('div', { className: 'h2t-clock' + (overTime ? ' over' : '') }, clock(elapsed)),
          e('div', { className: 'h2t-bar-sub' }, 'limit ' + clock(cohort.timeLimitSeconds) + ' · ' + cohort.label)
        ),
        e('div', { style: { textAlign: 'right' } },
          e('div', { className: 'h2t-total' }, totalScore() + '/100'),
          e('div', { className: 'h2t-bar-sub' }, 'pass at ' + cohort.passMark)
        ),
        e('button', { type: 'button', className: 'btn btn-sm', onClick: function () { setRunning(!running); } },
          running ? 'Pause' : 'Resume')
      ),
      overTime ? e('p', { className: 'h2t-over' },
        'Over the time limit — flagged separately, not deducted from points.') : null,

      mode === 'voice' ? e('div', { className: 'h2t-card' },
        e('h4', null, 'Say it out loud'),
        e('p', { className: 'h2t-hint' }, 'Talk through the assessment as you would in the lab. Stop when you are done.'),
        e('button', {
          type: 'button',
          className: 'btn ' + (recording ? 'btn-danger' : 'btn-primary'),
          onClick: toggleRecording
        }, recording ? 'Stop recording' : 'Start recording'),
        recording && live ? e('p', { className: 'h2t-live' }, live) : null,
        e('details', { className: 'h2t-typed' },
          e('summary', null, 'Or type what you said'),
          e('textarea', {
            rows: 6, value: transcript,
            onChange: function (ev) { setTranscript(ev.target.value); },
            placeholder: 'Type or paste what you said…'
          }),
          e('button', {
            type: 'button', className: 'btn btn-sm',
            onClick: function () { prefill(transcript); }
          }, 'Use this text')
        ),
        transcript && !recording ? e('button', {
          type: 'button', className: 'btn btn-primary', disabled: scoring, onClick: scoreWithAI
        }, scoring ? 'Scoring…' : 'Score my recording with AI') : null,
        aiError ? e('p', { className: 'h2t-error' }, aiError) : null
      ) : null,

      rubric().categories.map(function (cat) {
        return e('div', { key: cat.id, className: 'h2t-card' },
          e('div', { className: 'h2t-cat-head' },
            e('h4', null, cat.name),
            e('span', { className: 'h2t-cat-score' }, categoryScore(cat) + '/' + cat.points)
          ),
          cat.items.map(function (item) {
            var a = awardOf(item.id);
            return e('button', {
              key: item.id, type: 'button',
              className: 'h2t-item ' + a,
              onClick: function () { cycle(item); },
              'aria-label': item.text + ', ' + a
            },
              e('span', { className: 'h2t-mark' }, a === 'full' ? '✓' : (a === 'partial' ? '◐' : '○')),
              e('span', { className: 'h2t-item-text' }, item.text),
              e('span', { className: 'h2t-item-pts' }, pointsFor(a, item) + '/' + item.points)
            );
          }),
          cat.id === 'neuro' ? e('div', { className: 'h2t-nerves' },
            e('span', { className: 'h2t-hint' }, 'Cranial nerves assessed'),
            e('div', { className: 'h2t-nerve-grid' }, (rubric().cranialNerves || []).map(function (cnName) {
              var on = !!nerves[cnName];
              return e('button', {
                key: cnName, type: 'button',
                className: 'h2t-nerve' + (on ? ' on' : ''),
                onClick: function () {
                  var n = {}; for (var k in nerves) n[k] = nerves[k];
                  n[cnName] = !on; setNerves(n);
                }
              }, cnName);
            }))
          ) : null
        );
      }),

      e('button', {
        type: 'button', className: 'btn btn-success h2t-finish',
        onClick: function () { setRunning(false); setStage('result'); }
      }, 'Finish & score')
    );
  }

  window.HeadToToeTrainer = HeadToToeTrainer;
})();
