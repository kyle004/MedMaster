/* =============================================================================
 * MedMaster :: js/simprep-partner.js
 * CLINICAL SIMULATION PREP - PARTNER LAYER
 *   -> window.MM.simprepPartner   (the API two other modules code against)
 *   -> window.SimPrepPartner      (the lobby page + every pure helper, for tests)
 * -----------------------------------------------------------------------------
 * The way students in this program actually rehearse a 20-minute checkoff: two
 * of them in a room, one running the scenario and one marking the rubric, and
 * then they swap. This file is the second-person half of the Clinical
 * Simulation Prep section. js/simprep.js (study) and js/simprep-sim.js
 * (simulation) feature-detect it and run solo when it is absent.
 *
 * DESIGN RULE #1 - THERE IS EXACTLY ONE ROOM SYSTEM IN THIS APP AND IT IS
 * ALREADY WRITTEN. It lives at /codeblue/rooms/<CODE> (js/codeblue.js) and
 * js/ms2lab.js already reuses it. It has: a four-letter I/O/0/1-free code
 * claimed with a write-if-absent transaction, a /players roster with presence
 * heartbeats and an `alive` flag, a write-once /events list, and a published
 * rule block. Building a third one would mean a third set of rules, a third
 * collision window and a third set of bugs. So this reuses it, with ms2lab's
 * namespacing discipline: status is 'simprep-open', NEVER 'open'. Code Blue's
 * lobby lists rooms filtered on status === 'open', so a sim-prep room can
 * never appear in it and no student can walk into the wrong exercise.
 *
 * DESIGN RULE #2 - THE ROOM IS A FOLD OVER AN APPEND-ONLY EVENT LIST. There is
 * no host engine and no authoritative writer. `applyEvent(shared, evt)` is
 * pure and total; every client folds the same /events list in push-key order
 * and lands on byte-identical state. This is what makes four of the six
 * failure cases disappear rather than need handling:
 *   - a late joiner replays the whole list, so a paused run reads as paused;
 *   - the host dropping freezes nothing, because the host was never computing
 *     anything - promotion is only about who owns the room's lifecycle;
 *   - a network drop and rejoin is just a replay;
 *   - two people acting at once produce two events, not one clobbered write.
 *
 * DESIGN RULE #3 - THE RUBRIC IS NEVER LAST-WRITE-WINS. Two students marking
 * the same rubric item in the same second is the normal case, not the edge
 * case. `applyEvent` resolves it by ROLE WEIGHT carried inside the event
 * (proctor > recorder > runner > observer), falling back to push-key order,
 * and the losing verdict is KEPT in `contested` with `conflict: true` so the
 * UI can say "you and Sam disagree" instead of silently discarding a mark.
 * Because the role rides in the event rather than being read from the mutable
 * players map, a client that folds the log after a role swap still computes
 * the same winner as the client that watched it live.
 *
 * DESIGN RULE #4 - NEVER READ A LOCAL CLOCK INSIDE THE FOLD. `applyEvent`,
 * `foldEvents` and `elapsedMs` never call Date.now(). Every timestamp is
 * carried in the event or in the folded state (`startedAt`, `pausedAt`,
 * `pausedMs`), and wall time enters through exactly one function, `sharedNow()`
 * = Date.now() + the RTDB `.info/serverTimeOffset`. A phone four minutes fast
 * therefore cannot shift the shared clock, and a backgrounded tab cannot drift.
 *
 * DESIGN RULE #5 - IT CAN NEVER THROW INTO SOMEBODY ELSE'S RENDER. Every
 * method on the published API is safe to call with no room, no auth, no
 * network and no Firebase rule: it resolves or returns a falsy value and files
 * the reason in `lastError()`. The API object is published at MODULE LOAD, so
 * feature detection works whatever order the shell loads the scripts in.
 *
 * FIREBASE: no new path. Everything lives under /codeblue/rooms/<CODE>, which
 * already has a rule block. See ROOM_RULES below for the note.
 *
 * Contract: IIFE, no JSX, no ES modules, ES5 only (var/function - no arrow
 * functions, template literals, const/let, spread, destructuring or optional
 * chaining), window export, CSS injected once under the `spp-` prefix, CSS
 * variables with fallbacks, legible at 360px, honours prefers-reduced-motion.
 * ========================================================================== */
(function () {
  'use strict';

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
    return t.slice(0, Math.max(1, n - 1)) + '…';
  }
  function fmtClock(sec) {
    var s = Math.max(0, Math.round(numOr(sec, 0)));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function localNow() { return Date.now(); }
  function MMroot() {
    var m = window.MM;
    if (!m || typeof m !== 'object') { m = window.MM = {}; }
    return m;
  }
  function toast(msg, kind) {
    var MM = MMroot();
    if (isFn(MM.toast)) { try { MM.toast(str(msg), kind || 'info'); } catch (e) {} }
  }
  /** RTDB deletes undefined keys and rejects NaN outright, killing the whole
      write. Scrub before sending rather than after being surprised. */
  function scrub(o) {
    var out = {}, k, s = obj(o), v;
    for (k in s) {
      if (!Object.prototype.hasOwnProperty.call(s, k)) { continue; }
      v = s[k];
      if (v === undefined || v === null) { continue; }
      if (typeof v === 'number') { out[k] = isFinite(v) ? v : 0; continue; }
      if (typeof v === 'object') {
        out[k] = (Object.prototype.toString.call(v) === '[object Array]')
          ? v.slice(0) : scrub(v);
        continue;
      }
      out[k] = v;
    }
    return out;
  }

  /* ==========================================================================
   * 2. ROOM CONSTANTS - Code Blue's namespace, ms2lab's discipline
   * ======================================================================== */

  var ROOM_BASE = 'codeblue/rooms';
  /* NOT 'open'. Code Blue's lobby query is orderByChild('status').equalTo('open')
     and its list filter re-checks status === 'open', so these two strings are
     the entire reason a sim-prep room cannot surface in a code lobby. ms2lab
     took 'ms2lab-open' for the same reason; these must differ from both. */
  var ROOM_STATUS_OPEN = 'simprep-open';
  var ROOM_STATUS_LIVE = 'simprep-live';
  var ROOM_STATUS_DONE = 'simprep-done';
  var FOREIGN_STATUSES = ['open', 'running', 'done', 'ms2lab-open', 'ms2lab-done'];
  var ROOM_STALE_MS = 4 * 60 * 60 * 1000;

  var PRESENCE_MS = 15000;      // heartbeat interval
  var STALE_PLAYER_MS = 55000;  // no heartbeat for this long -> not "alive"
  var HOST_GRACE_MS = 45000;    // host silent this long -> somebody may take it
  var PROMOTE_TICK_MS = 2500;

  /* I, O, 0 and 1 are gone, for the reason codeblue.js dropped them: a code is
     read aloud across a study table far more often than it is typed. */
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

  /* The rule block this file needs. It ALREADY EXISTS in firebase-rules.json
     under codeblue/rooms - reproduced here so a future reader can see that
     nothing new was claimed, and so a test can assert we did not wander off
     the ruled path. */
  var ROOM_RULES = {
    path: 'codeblue/rooms/$roomId',
    note: 'Reused as-is. No new Firebase rule is required by this module.'
  };

  /* ==========================================================================
   * 3. ROLES
   * --------------------------------------------------------------------------
   * The four seats a two-to-four student rehearsal actually uses. Not code-team
   * roles and not the lab packet's roles - this is the checkoff rehearsal.
   * ======================================================================== */

  var ROLES = [
    { id: 'runner', label: 'Runner', icon: 'RUN',
      blurb: 'Performs the scenario out loud, start to finish. This is the seat being checked off.',
      weight: 1 },
    { id: 'proctor', label: 'Proctor', icon: 'RUB',
      blurb: 'Marks the rubric live and holds the "what am I missing?" prompts. Does not touch the patient.',
      weight: 3 },
    { id: 'recorder', label: 'Recorder', icon: 'LOG',
      blurb: 'Logs what was done and when, so the debrief has a timeline instead of a memory.',
      weight: 2 },
    { id: 'observer', label: 'Observer', icon: 'OBS',
      blurb: 'Watching this round. Takes a seat on the swap.',
      weight: 0 }
  ];
  function roleMeta(id) {
    var want = lower(id), i;
    for (i = 0; i < ROLES.length; i++) {
      if (ROLES[i].id === want) { return ROLES[i]; }
    }
    return { id: 'observer', label: 'Observer', icon: 'OBS',
      blurb: 'Watching this round.', weight: 0 };
  }
  function roleWeight(id) { return numOr(roleMeta(id).weight, 0); }
  /** Only the proctor marks the rubric - unless nobody has taken the seat, in
   *  which case everyone is on the hook, which is also true in the lab. */
  function canMarkRubric(role, roles) {
    if (lower(role) === 'proctor') { return true; }
    var m = obj(roles), k;
    for (k in m) {
      if (Object.prototype.hasOwnProperty.call(m, k) && lower(m[k]) === 'proctor') {
        return false;
      }
    }
    return true;
  }

  /**
   * swapMap(roles, uids) -> {uid: role}
   *
   * One click, not a teardown. Runner and proctor trade seats; recorder and
   * observer rotate into whatever is left. Everybody who had a seat still has
   * one afterwards, and a solo-plus-observer room still produces a runner.
   */
  function swapMap(roles, uids) {
    var cur = obj(roles);
    var list = arr(uids).filter(function (u) { return !!str(u); });
    if (!list.length) { list = keysOf(cur); }
    if (!list.length) { return {}; }
    /* Deterministic seating order so every client computes the same swap even
       if two of them press the button in the same second: the second swap is
       then just another rotation, never a scramble. */
    var order = ['runner', 'proctor', 'recorder', 'observer'];
    var seated = list.slice(0).sort(function (a, b) {
      var d = order.indexOf(lower(cur[a] || 'observer')) - order.indexOf(lower(cur[b] || 'observer'));
      if (d !== 0) { return d; }
      return a < b ? -1 : (a > b ? 1 : 0);
    });
    var out = {}, i;
    for (i = 0; i < seated.length; i++) {
      /* rotate by one: whoever ran now proctors, whoever proctored now runs */
      out[seated[i]] = order[(i + 1) % Math.min(order.length, Math.max(2, seated.length))];
    }
    /* A pair must always end up runner + proctor, never runner + recorder. */
    if (seated.length === 2) {
      out[seated[0]] = 'proctor';
      out[seated[1]] = 'runner';
    }
    return out;
  }

  /* ==========================================================================
   * 4. SHARED TIME
   * --------------------------------------------------------------------------
   * One function reads the wall clock. Everything else takes a timestamp.
   *
   * `.info/serverTimeOffset` is a synthetic RTDB path that needs no rule and
   * costs no bandwidth; it is how the SDK itself implements ServerValue
   * comparisons. Adding it to Date.now() gives every client in the room the
   * same millisecond, which is the whole point: the run clock, the pause and
   * the action-log timestamps all have to agree across two phones whose system
   * clocks differ by minutes.
   * ======================================================================== */

  var serverOffsetMs = 0;
  var offsetBound = false;
  function bindServerOffset(db) {
    if (offsetBound || !db) { return; }
    offsetBound = true;
    try {
      db.ref('.info/serverTimeOffset').on('value', function (snap) {
        var v = numOr(snap && isFn(snap.val) ? snap.val() : 0, 0);
        /* A wild offset is a broken read, not a broken clock. Six hours is far
           beyond any plausible skew and well inside any plausible bug. */
        if (Math.abs(v) < 6 * 60 * 60 * 1000) { serverOffsetMs = v; }
      });
    } catch (e) { /* degrade to a local clock; the fold still agrees on order */ }
  }
  function serverOffset() { return serverOffsetMs; }
  function sharedNow() { return localNow() + serverOffsetMs; }

  /* ==========================================================================
   * 5. THE SHARED STATE - a pure fold over the event list
   * --------------------------------------------------------------------------
   * NOTHING IN THIS SECTION READS A CLOCK. Pass `now` in, or get 0 out.
   * ======================================================================== */

  var EV = {
    ACTIVITY: 'activity',   // {kind, topicId, mode}
    ROLE: 'role',           // {uid, role}
    SWAP: 'swap',           // {map:{uid:role}, round}
    START: 'start',         // {durationSec}
    PAUSE: 'pause',         // {reason}
    RESUME: 'resume',
    END: 'end',             // {reason}
    MARK: 'mark',           // {itemId, verdict, label, role}
    UNMARK: 'unmark',       // {itemId}
    ACTION: 'action',       // {text, kind}
    DECK: 'deck',           // {index, total}
    TAB: 'tab',             // {tab}
    ANSWER: 'answer',       // {qid, choice, correct}
    REVEAL: 'reveal',       // {qid}
    PROMPT: 'prompt',       // {index, text}
    NOTE: 'note'            // {text, kind}
  };

  var VERDICTS = { good: 1, partial: 1, missed: 1 };
  function normVerdict(v) {
    var s = lower(v);
    return VERDICTS[s] ? s : 'good';
  }

  function initialShared(cfg) {
    var c = obj(cfg);
    return {
      cfg: {
        kind: lower(c.kind) || 'study',
        topicId: str(c.topicId),
        mode: str(c.mode),
        durationSec: Math.max(0, Math.round(numOr(c.durationSec, 0)))
      },
      activity: {
        kind: lower(c.kind) || 'study',
        topicId: str(c.topicId),
        mode: str(c.mode),
        at: 0, by: ''
      },
      roles: {},
      round: 1,
      run: {
        started: false, startedAt: 0,
        paused: false, pausedAt: 0, pausedMs: 0, pauseCount: 0,
        pausedBy: '', pausedByName: '', pauseReason: '',
        ended: false, endedAt: 0, endedReason: '',
        durationSec: Math.max(0, Math.round(numOr(c.durationSec, 0)))
      },
      marks: {},
      actions: [],
      study: { deckIndex: 0, tab: '', answers: {}, revealed: {}, tally: {} },
      coach: { promptIndex: 0, prompts: [] },
      log: [],
      count: 0,
      lastEventKey: ''
    };
  }

  /** Elapsed shared-run time in ms. Derived from stored timestamps, never
   *  accumulated, and never from a local clock: pass `now` (a sharedNow()). */
  function elapsedMs(shared, now) {
    var r = obj(obj(shared).run);
    if (!r.startedAt) { return 0; }
    var n = numOr(now, 0);
    if (!n) { return 0; }
    var held = numOr(r.pausedMs, 0) +
      (r.paused && r.pausedAt ? Math.max(0, n - r.pausedAt) : 0);
    return Math.max(0, n - r.startedAt - held);
  }
  function elapsedSec(shared, now) { return Math.floor(elapsedMs(shared, now) / 1000); }
  function remainingSec(shared, now) {
    var d = numOr(obj(obj(shared).run).durationSec, 0);
    if (!d) { return null; }
    return Math.max(0, d - elapsedSec(shared, now));
  }
  function expired(shared, now) {
    var left = remainingSec(shared, now);
    return left !== null && left <= 0;
  }
  /** Seconds since the run started, for an event stamped at `at`. */
  function atSecOf(shared, at) {
    var r = obj(obj(shared).run);
    if (!r.startedAt || !numOr(at, 0)) { return 0; }
    return Math.max(0, Math.floor((numOr(at, 0) - r.startedAt - numOr(r.pausedMs, 0)) / 1000));
  }

  function pushLog(s, kind, text, detail, atSec, by) {
    s.log = arr(s.log).concat([{
      key: 'l' + (numOr(s.count, 0) + 1) + '-' + Math.round(numOr(atSec, 0)),
      kind: str(kind) || 'info',
      text: str(text),
      detail: str(detail || ''),
      by: str(by || ''),
      atSec: Math.max(0, Math.round(numOr(atSec, 0)))
    }]);
    if (s.log.length > 400) { s.log = s.log.slice(-400); }
  }

  /**
   * mergeMark(cur, incoming) -> mark
   *
   * THE ANTI-CLOBBER RULE. Two students marking the same rubric item is the
   * normal case in a rehearsal - the proctor marks it and the recorder marks
   * it a half-second later. Last-write-wins would silently throw one away, and
   * on a rubric that is a wrong grade with no trace.
   *
   *   same person again        -> a correction: replace, no conflict
   *   same verdict, two people -> a co-sign: recorded, no conflict
   *   different verdicts       -> the heavier ROLE wins (proctor > recorder >
   *                               runner > observer); a tie falls to the mark
   *                               already standing, i.e. push-key order. The
   *                               loser is KEPT in `contested` and `conflict`
   *                               goes true so the UI can show the
   *                               disagreement rather than hide it.
   *
   * The role comes from the EVENT, not from the live players map, so a client
   * folding the log after a role swap computes the same winner as the client
   * that watched it happen.
   */
  function mergeMark(cur, incoming) {
    var n;
    if (!cur) {
      n = shallow(incoming);
      n.coSigned = [];
      n.contested = [];
      n.conflict = false;
      return n;
    }
    if (str(cur.by) && str(cur.by) === str(incoming.by)) {
      n = shallow(incoming);
      n.coSigned = arr(cur.coSigned);
      /* A proctor who corrects their own mark has settled the argument only if
         they now agree with whoever contested them. */
      n.contested = arr(cur.contested).filter(function (c) {
        return normVerdict(c.verdict) !== normVerdict(incoming.verdict);
      });
      n.conflict = n.contested.length > 0;
      return n;
    }
    if (normVerdict(cur.verdict) === normVerdict(incoming.verdict)) {
      n = shallow(cur);
      n.coSigned = arr(cur.coSigned).concat([{
        by: str(incoming.by), byName: str(incoming.byName),
        role: str(incoming.role), atSec: numOr(incoming.atSec, 0)
      }]);
      n.contested = arr(cur.contested);
      return n;
    }
    var winner = (roleWeight(incoming.role) > roleWeight(cur.role)) ? incoming : cur;
    var loser = (winner === incoming) ? cur : incoming;
    n = shallow(winner);
    n.coSigned = arr(cur.coSigned);
    n.contested = arr(cur.contested).concat([{
      by: str(loser.by), byName: str(loser.byName), role: str(loser.role),
      verdict: normVerdict(loser.verdict), atSec: numOr(loser.atSec, 0)
    }]);
    n.conflict = true;
    return n;
  }

  /**
   * applyEvent(shared, evt) -> shared'
   *
   * Pure, total, and tolerant of anything RTDB hands back. An event it does not
   * recognise is ignored rather than thrown on: a client on an older build must
   * degrade to "did not see that", never to a white screen.
   */
  function applyEvent(shared, evt) {
    var s = shallow(obj(shared));
    var e = obj(evt);
    var t = lower(e.t || e.type);
    var at = numOr(e.at, 0);
    var who = str(e.byName) || 'A partner';
    var key = str(e._k || e.key);

    s.count = numOr(s.count, 0) + 1;
    if (key) { s.lastEventKey = key; }
    s.run = shallow(s.run);
    s.study = shallow(s.study);
    s.coach = shallow(s.coach);

    var secs = atSecOf(s, at);

    if (t === EV.ACTIVITY) {
      s.activity = {
        kind: lower(e.kind) || str(obj(s.activity).kind) || 'study',
        topicId: str(e.topicId) || str(obj(s.activity).topicId),
        mode: str(e.mode),
        at: at, by: str(e.by)
      };
      pushLog(s, 'info', who + ' set the room to ' +
        activityLabel(s.activity.kind) + '.', str(e.topicId), secs, str(e.by));
      return s;
    }

    if (t === EV.ROLE) {
      var ru = str(e.uid) || str(e.by);
      if (!ru) { return s; }
      var rn = shallow(s.roles);
      rn[ru] = roleMeta(e.role).id;
      s.roles = rn;
      pushLog(s, 'info', (str(e.byName) || 'A partner') + ' took ' +
        roleMeta(e.role).label + '.', '', secs, ru);
      return s;
    }

    if (t === EV.SWAP) {
      /* A swap touches ROLES AND NOTHING ELSE. The clock keeps running, the
         marks stay marked, the action log keeps its entries - swapping seats
         between rounds is the study pattern, not a reset. */
      var m = obj(e.map), rs = shallow(s.roles), k;
      for (k in m) {
        if (Object.prototype.hasOwnProperty.call(m, k)) { rs[k] = roleMeta(m[k]).id; }
      }
      s.roles = rs;
      s.round = Math.max(numOr(s.round, 1), Math.round(numOr(e.round, numOr(s.round, 1) + 1)));
      pushLog(s, 'info', who + ' swapped the seats (round ' + s.round + ').',
        'The clock, the rubric marks and the action log all carried over.', secs, str(e.by));
      return s;
    }

    if (t === EV.START) {
      if (s.run.started) { return s; }
      if (!at) { return s; }   /* no clock fallback: an unstamped start is dropped */
      s.run = {
        started: true, startedAt: at,
        paused: false, pausedAt: 0, pausedMs: 0, pauseCount: 0,
        pausedBy: '', pausedByName: '', pauseReason: '',
        ended: false, endedAt: 0, endedReason: '',
        durationSec: Math.max(0, Math.round(numOr(e.durationSec, numOr(s.run.durationSec, 0))))
      };
      s.log = [];
      pushLog(s, 'good', who + ' started the run.',
        s.run.durationSec
          ? 'Twenty-minute format: ' + Math.round(s.run.durationSec / 60) + ' minutes on the shared clock.'
          : 'No time limit set - the clock counts up.', 0, str(e.by));
      return s;
    }

    /* Everything below needs a started run. Marking a rubric before anybody
       pressed start is not an error worth surfacing, it is a stale click. */
    if (!s.run.started) { return s; }

    if (t === EV.PAUSE) {
      if (s.run.paused || s.run.ended || !at) { return s; }
      s.run.paused = true;
      s.run.pausedAt = at;
      s.run.pauseCount = numOr(s.run.pauseCount, 0) + 1;
      s.run.pausedBy = str(e.by);
      s.run.pausedByName = who;
      s.run.pauseReason = str(e.reason);
      pushLog(s, 'warn', 'Paused by ' + who + '.',
        'Everybody is frozen. The clock does not move and nothing advances until ' +
        'somebody resumes.' + (str(e.reason) ? ' Reason: ' + cut(str(e.reason), 90) : ''),
        secs, str(e.by));
      return s;
    }

    if (t === EV.RESUME) {
      if (!s.run.paused || !at) { return s; }
      var held = s.run.pausedAt ? Math.max(0, at - s.run.pausedAt) : 0;
      s.run.paused = false;
      s.run.pausedAt = 0;
      s.run.pausedMs = numOr(s.run.pausedMs, 0) + held;
      s.run.pausedBy = '';
      s.run.pausedByName = '';
      s.run.pauseReason = '';
      pushLog(s, 'info', who + ' resumed.',
        'Held for ' + fmtClock(held / 1000) + '. The clock picks up exactly where it ' +
        'stopped - no time was skipped forward.', atSecOf(s, at), str(e.by));
      return s;
    }

    if (t === EV.END) {
      if (s.run.ended || !at) { return s; }
      if (s.run.paused) {
        var h2 = s.run.pausedAt ? Math.max(0, at - s.run.pausedAt) : 0;
        s.run.paused = false;
        s.run.pausedAt = 0;
        s.run.pausedMs = numOr(s.run.pausedMs, 0) + h2;
      }
      s.run.ended = true;
      s.run.endedAt = at;
      s.run.endedReason = str(e.reason) || 'ended';
      pushLog(s, 'info', who + ' ended the run (' + s.run.endedReason + ').', '', secs, str(e.by));
      return s;
    }

    if (t === EV.MARK) {
      var id = str(e.itemId);
      if (!id) { return s; }
      var incoming = {
        itemId: id,
        verdict: normVerdict(e.verdict),
        label: str(e.label),
        by: str(e.by), byName: who,
        role: roleMeta(e.role).id,
        atMs: at, atSec: secs, key: key
      };
      var next = shallow(s.marks);
      var merged = mergeMark(obj(s.marks)[id] || null, incoming);
      next[id] = merged;
      s.marks = next;
      if (merged.conflict) {
        pushLog(s, 'bad', 'Disagreement on "' + cut(str(e.label) || id, 60) + '".',
          merged.byName + ' (' + roleMeta(merged.role).label + ') marked it ' +
          merged.verdict + '; ' + arr(merged.contested).map(function (c) {
            return str(c.byName) + ' marked it ' + str(c.verdict);
          }).join(', ') + '. The proctor\'s mark stands - talk it through in the debrief.',
          secs, str(e.by));
      } else {
        pushLog(s, merged.verdict === 'missed' ? 'warn' : 'good',
          who + ' marked "' + cut(str(e.label) || id, 60) + '" ' + merged.verdict + '.',
          '', secs, str(e.by));
      }
      return s;
    }

    if (t === EV.UNMARK) {
      var uid2 = str(e.itemId);
      if (!uid2 || !obj(s.marks)[uid2]) { return s; }
      var cleared = shallow(s.marks);
      var was = obj(cleared[uid2]);
      delete cleared[uid2];
      s.marks = cleared;
      pushLog(s, 'info', who + ' withdrew the mark on "' +
        cut(str(was.label) || uid2, 60) + '".', '', secs, str(e.by));
      return s;
    }

    if (t === EV.ACTION) {
      s.actions = arr(s.actions).concat([{
        key: key || ('a' + numOr(s.count, 0)),
        text: cut(str(e.text), 240),
        kind: str(e.kind) || 'action',
        by: str(e.by), byName: who,
        atMs: at, atSec: secs
      }]);
      if (s.actions.length > 300) { s.actions = s.actions.slice(-300); }
      return s;
    }

    if (t === EV.DECK) {
      /* A shared deck position IS last-write-wins, on purpose: two people
         flipping a card is not a grading decision and push-key order gives
         every client the same answer. The rubric is the thing that may not. */
      s.study.deckIndex = Math.max(0, Math.round(numOr(e.index, 0)));
      s.study.deckTotal = Math.max(0, Math.round(numOr(e.total, numOr(s.study.deckTotal, 0))));
      s.study.deckBy = str(e.by);
      return s;
    }

    if (t === EV.TAB) {
      s.study.tab = str(e.tab);
      return s;
    }

    if (t === EV.ANSWER) {
      var qid = str(e.qid);
      if (!qid) { return s; }
      if (obj(s.study.revealed)[qid]) { return s; }   /* too late to change it */
      var answers = shallow(s.study.answers);
      var forQ = shallow(answers[qid]);
      forQ[str(e.by)] = {
        choice: str(e.choice), correct: !!e.correct,
        byName: who, atMs: at, atSec: secs
      };
      answers[qid] = forQ;
      s.study.answers = answers;
      return s;
    }

    if (t === EV.REVEAL) {
      var rq = str(e.qid);
      if (!rq || obj(s.study.revealed)[rq]) { return s; }
      var rev = shallow(s.study.revealed);
      rev[rq] = { at: at, by: str(e.by) };
      s.study.revealed = rev;
      /* The tally is only ever computed from revealed questions, so nobody can
         run up a score on answers the room has not seen yet. */
      var tally = shallow(s.study.tally), au;
      var given = obj(obj(s.study.answers)[rq]);
      for (au in given) {
        if (!Object.prototype.hasOwnProperty.call(given, au)) { continue; }
        var row = shallow(tally[au]);
        row.right = numOr(row.right, 0) + (obj(given[au]).correct ? 1 : 0);
        row.wrong = numOr(row.wrong, 0) + (obj(given[au]).correct ? 0 : 1);
        row.name = str(obj(given[au]).byName) || str(row.name);
        tally[au] = row;
      }
      s.study.tally = tally;
      return s;
    }

    if (t === EV.PROMPT) {
      s.coach.promptIndex = Math.max(0, Math.round(numOr(e.index, 0)));
      s.coach.prompts = arr(s.coach.prompts).concat([{
        key: key || ('p' + numOr(s.count, 0)),
        index: s.coach.promptIndex, text: cut(str(e.text), 240),
        by: str(e.by), byName: who, atSec: secs
      }]);
      if (s.coach.prompts.length > 200) { s.coach.prompts = s.coach.prompts.slice(-200); }
      pushLog(s, 'coach', who + ' called: "' + cut(str(e.text), 120) + '"', '', secs, str(e.by));
      return s;
    }

    if (t === EV.NOTE) {
      pushLog(s, str(e.kind) || 'info', str(e.text), str(e.detail || ''), secs, str(e.by));
      return s;
    }

    return s;
  }

  function foldEvents(base, events) {
    var s = base;
    var list = arr(events).slice(0).sort(function (a, b) {
      var ka = str(obj(a)._k), kb = str(obj(b)._k);
      if (ka && kb && ka !== kb) { return ka < kb ? -1 : 1; }
      return numOr(obj(a).at, 0) - numOr(obj(b).at, 0);
    });
    var i;
    for (i = 0; i < list.length; i++) { s = applyEvent(s, list[i]); }
    return s;
  }

  function activityLabel(kind) {
    var k = lower(kind);
    if (k === 'sim') { return 'Simulation together'; }
    if (k === 'coach') { return 'Coach together'; }
    return 'Study together';
  }

  /** What the room's quiz is allowed to show me right now. Own answer always;
   *  everybody else's only once the question is revealed. RTDB is readable by
   *  every member of the room, so this is a fairness convention enforced in the
   *  fold, not a secret - which is the honest thing to say about it. */
  function visibleAnswers(shared, qid, myUid) {
    var given = obj(obj(obj(shared).study).answers)[str(qid)];
    var revealed = !!obj(obj(obj(shared).study).revealed)[str(qid)];
    var out = {}, k;
    for (k in obj(given)) {
      if (!Object.prototype.hasOwnProperty.call(obj(given), k)) { continue; }
      if (revealed || k === str(myUid)) { out[k] = obj(given)[k]; }
      else { out[k] = { hidden: true, byName: str(obj(obj(given)[k]).byName) }; }
    }
    return { revealed: revealed, answers: out };
  }
  /** True when everybody who is present has answered - the cue to reveal. */
  function readyToReveal(shared, qid, uids) {
    var given = obj(obj(obj(shared).study).answers)[str(qid)];
    var list = arr(uids);
    if (!list.length) { return false; }
    var i;
    for (i = 0; i < list.length; i++) {
      if (!obj(given)[str(list[i])]) { return false; }
    }
    return true;
  }

  /* ==========================================================================
   * 6. HOST PROMOTION
   * --------------------------------------------------------------------------
   * The host owns the room's LIFECYCLE (its status, and the right to close it)
   * and nothing else. Because there is no host engine, a host who walks out
   * freezes nothing: the clock keeps deriving, the events keep landing and the
   * fold keeps agreeing. Promotion exists so the room can still be closed and
   * so the roster has somebody named at the top - not to unstick anything.
   * ======================================================================== */

  function isAlive(player, now) {
    var p = obj(player);
    if (p.connected === false) { return false; }
    if (p.alive === false) { return false; }
    var ls = numOr(p.lastSeen, 0);
    if (!ls) { return p.connected === true || p.alive === true; }
    return (numOr(now, 0) - ls) < STALE_PLAYER_MS;
  }

  /**
   * electHost(players, staleId, now) -> uid | ''
   * Longest-tenured connected player, uid as the tie-break, so two clients can
   * never both believe they are next. Pure: pass `now` in.
   */
  function electHost(players, staleId, now) {
    var p = obj(players);
    var eligible = keysOf(p).filter(function (u) {
      if (u === str(staleId)) { return false; }
      return isAlive(p[u], now);
    }).sort(function (a, b) {
      var d = numOr(obj(p[a]).joinedAt, 8.64e15) - numOr(obj(p[b]).joinedAt, 8.64e15);
      if (d !== 0) { return d; }
      return a < b ? -1 : 1;
    });
    return eligible.length ? eligible[0] : '';
  }
  /** Has the host gone quiet long enough that somebody may take the room? */
  function hostIsStale(players, hostId, now) {
    if (!str(hostId)) { return true; }
    var p = obj(obj(players)[str(hostId)]);
    if (!keysOf(p).length) { return true; }
    if (p.connected === false || p.alive === false) { return true; }
    var ls = numOr(p.lastSeen, 0);
    if (!ls) { return false; }
    return (numOr(now, 0) - ls) > HOST_GRACE_MS;
  }

  /* ==========================================================================
   * 7. PAUSE HUB - the shared contract from js/sim-engine.js
   * --------------------------------------------------------------------------
   * Verb for verb what sim-engine, ai-scenario, codeblue and ms2lab expose, so
   * the shell can pause whatever is running without knowing which module it is.
   * Registered in window.MMPause under 'simprep-partner'.
   *
   * The difference here: pause is NOT local. pause() publishes an event to the
   * shared log, so every client in the room freezes and the UI can name who did
   * it. Any participant may pause - a rehearsal where only the host can stop
   * the clock is a rehearsal where the runner cannot ask a question.
   * ======================================================================== */

  function createPauseHub(id) {
    var host = null;
    var subs = [];
    function stats() {
      if (!host) {
        return { active: false, paused: false, pauseCount: 0, pausedMs: 0,
          pausedSec: 0, mode: '', simSec: 0, pausedBy: '', pausedByName: '' };
      }
      try { return host.stats(); }
      catch (e) {
        return { active: false, paused: false, pauseCount: 0, pausedMs: 0,
          pausedSec: 0, mode: '', simSec: 0, pausedBy: '', pausedByName: '' };
      }
    }
    function emit() {
      var snap = stats();
      subs.slice(0).forEach(function (fn) { try { fn(!!snap.paused, snap); } catch (e) {} });
    }
    var hub = {
      id: str(id) || 'simprep-partner',
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

  var partnerPause = createPauseHub('simprep-partner');
  registerPauseControl(partnerPause.pauseControl);

  /* ==========================================================================
   * 8. THE SESSION - one room at a time, module scope
   * --------------------------------------------------------------------------
   * A singleton rather than a hook, because three separate pages (the lobby
   * here, js/simprep.js and js/simprep-sim.js) all have to be looking at the
   * SAME room. A hook would give each of them its own subscription, its own
   * presence heartbeat and its own idea of the roster.
   * ======================================================================== */

  var session = null;
  var stateSubs = [];
  var eventSubs = [];
  var lastError = '';
  var detachPause = null;

  function getDb() {
    var m = MMroot();
    if (m.db) { return m.db; }
    try {
      if (window.firebase && isFn(window.firebase.database) &&
          arr(window.firebase.apps).length) {
        return window.firebase.database();
      }
    } catch (e) {}
    try {
      if (window.firebase && isFn(window.firebase.database)) {
        return window.firebase.database();
      }
    } catch (e2) {}
    return null;
  }
  function meUid() {
    var m = MMroot();
    var u = obj(m.authUser);
    return str(u.uid || m.myId || '');
  }
  function meName() {
    var m = MMroot();
    var u = obj(m.authUser);
    var n = str(u.displayName) ||
      (str(u.email) ? str(u.email).split('@')[0] : '') ||
      str(m.myName) || 'Student';
    return cut(n, 32);
  }
  function roomRef(db, id) { return db.ref(ROOM_BASE + '/' + normalizeCode(id)); }

  function fail(msg) { lastError = str(msg); return null; }

  /**
   * swallow(p, onDeny) - a refused set()/update() REJECTS, it does not throw.
   * An uncaught one is an unhandled rejection, which on Node kills the process
   * and in a browser prints a stack the student cannot act on. Every write in
   * this file goes through here: a denial is a flag on the room state, never
   * an exception and never a crash.
   */
  function swallow(p, onDeny) {
    try {
      if (p && isFn(p['catch'])) {
        p['catch'](function () { if (isFn(onDeny)) { try { onDeny(); } catch (e) {} } });
      } else if (p && isFn(p.then)) {
        p.then(function () {}, function () { if (isFn(onDeny)) { try { onDeny(); } catch (e) {} } });
      }
    } catch (e) {}
    return p;
  }
  function markDenied() {
    if (!session) { return; }
    session.denied = true;
    session.error = 'Some of this room could not be written from your account.';
    emitState();
  }

  /** Every roomState handed out is a fresh plain object. Consumers keep it in
   *  React state, so it has to be safe to hold and cheap to compare by `rev`. */
  function buildRoomState() {
    if (!session) { return null; }
    var now = sharedNow();
    var players = obj(session.players);
    var shared = obj(session.shared);
    var roles = obj(shared.roles);
    var uid = str(session.uid);
    var roster = keysOf(players).map(function (u) {
      var p = obj(players[u]);
      return {
        uid: u,
        name: str(p.name) || 'Student',
        role: roleMeta(roles[u] || p.role).id,
        connected: p.connected !== false,
        alive: isAlive(p, now),
        lastSeen: numOr(p.lastSeen, 0),
        joinedAt: numOr(p.joinedAt, 0),
        isHost: u === str(obj(session.meta).hostId),
        isMe: u === uid
      };
    }).sort(function (a, b) {
      if (a.isHost !== b.isHost) { return a.isHost ? -1 : 1; }
      var d = a.joinedAt - b.joinedAt;
      return d !== 0 ? d : (a.uid < b.uid ? -1 : 1);
    });
    var present = roster.filter(function (r) { return r.alive; })
      .map(function (r) { return r.uid; });
    var meRow = roster.filter(function (r) { return r.isMe; })[0] || null;

    return {
      code: str(session.code),
      roomId: str(session.code),
      name: str(obj(session.meta).name),
      status: str(obj(session.meta).status),
      hostId: str(obj(session.meta).hostId),
      hostName: str(obj(session.meta).hostName),
      createdAt: numOr(obj(session.meta).createdAt, 0),
      cfg: obj(obj(session.meta).cfg),
      ready: !!session.ready,
      connected: !!session.connected,
      denied: !!session.denied,
      error: str(session.error),
      myUid: uid,
      myName: str(session.name),
      myRole: meRow ? meRow.role : roleMeta(roles[uid]).id,
      me: meRow,
      isHost: !!uid && uid === str(obj(session.meta).hostId),
      hostStale: hostIsStale(players, str(obj(session.meta).hostId), now),
      players: players,
      roster: roster,
      /* js/simprep.js reads `peers || members || players` and expects an
         ARRAY; `players` is the raw uid-keyed map RTDB gave us. Both are
         published so neither module has to guess. */
      peers: roster,
      members: roster,
      presentUids: present,
      roles: roles,
      round: numOr(shared.round, 1),
      activity: obj(shared.activity),
      run: obj(shared.run),
      marks: obj(shared.marks),
      actions: arr(shared.actions),
      study: obj(shared.study),
      coach: obj(shared.coach),
      log: arr(shared.log),
      shared: shared,
      events: arr(session.events),
      now: now,
      serverOffsetMs: serverOffsetMs,
      elapsedMs: elapsedMs(shared, now),
      elapsedSec: elapsedSec(shared, now),
      remainingSec: remainingSec(shared, now),
      canMarkRubric: canMarkRubric(meRow ? meRow.role : roles[uid], roles),
      rev: numOr(session.rev, 0)
    };
  }

  function emitState() {
    if (session) { session.rev = numOr(session.rev, 0) + 1; }
    var st = buildRoomState();
    stateSubs.slice(0).forEach(function (fn) { try { fn(st); } catch (e) {} });
    try { partnerPause._changed(); } catch (e) {}
  }
  function emitEvent(ev) {
    eventSubs.slice(0).forEach(function (fn) { try { fn(ev); } catch (e) {} });
  }

  /* --------------------------------------------------------------- wiring */

  /**
   * attachRoom(db, code, cfgSeed, seedMeta)
   *
   * seedMeta is the record the creator just wrote. Handing it in means the
   * host knows it is the host before the /hostId listener has come back - a
   * "you are not the host of the room you just made" flicker is a real bug
   * that shows up as a disabled Close button for one round trip.
   */
  function attachRoom(db, code, cfgSeed, seedMeta) {
    var base;
    try { base = roomRef(db, code); }
    catch (e) { return fail('Could not reach that room.'); }

    var sess = {
      db: db, code: normalizeCode(code),
      uid: meUid(), name: meName(),
      meta: shallow(seedMeta), players: {}, events: [], seen: {},
      shared: initialShared(cfgSeed),
      ready: false, connected: false, denied: false, error: '',
      rev: 0, offs: [], timers: []
    };
    session = sess;

    function patchMeta(patch) {
      var n = shallow(sess.meta), k;
      for (k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) { n[k] = patch[k]; }
      }
      sess.meta = n;
    }

    /* The room's fields are read one at a time on purpose. Subscribing to the
       whole $roomId node would stream /events back to every client on every
       append, which is the single most expensive mistake this file could
       make - and in a twenty-minute run with four students it is quadratic. */
    try {
      var hRef = base.child('hostId'), sRef = base.child('status');
      var pRef = base.child('players'), eRef = base.child('events');

      var onH = hRef.on('value', function (snap) {
        patchMeta({ hostId: str(snap && isFn(snap.val) ? snap.val() : '') });
        emitState();
      }, function () {
        sess.error = 'Lost the connection to this room.';
        sess.connected = false;
        emitState();
      });
      sess.offs.push(function () { try { hRef.off('value', onH); } catch (e) {} });

      var onS = sRef.on('value', function (snap) {
        patchMeta({ status: str(snap && isFn(snap.val) ? snap.val() : '') });
        emitState();
      });
      sess.offs.push(function () { try { sRef.off('value', onS); } catch (e) {} });

      var onP = pRef.on('value', function (snap) {
        sess.players = obj(snap && isFn(snap.val) ? snap.val() : null);
        sess.connected = true;
        emitState();
      });
      sess.offs.push(function () { try { pRef.off('value', onP); } catch (e) {} });

      /* child_added, not value: /events is append-only and write-once, and
         child_added replays everything already in the node the moment we
         subscribe. That replay IS the late-joiner story - a run that was
         paused ten minutes ago folds back to paused, with the right name on
         it, before the first frame is drawn. */
      var onE = eRef.on('child_added', function (snap) {
        var k = str(snap && snap.key);
        if (!k || sess.seen[k]) { return; }
        sess.seen[k] = true;
        var v = decorate(shallow(obj(snap && isFn(snap.val) ? snap.val() : null)), k);
        sess.events = sess.events.concat([v]);
        sess.shared = applyEvent(sess.shared, v);
        sess.ready = true;
        emitEvent(v);
        emitState();
      }, function () {
        /* A denied or failed /events read is the one failure that would leave
           the room silently wrong. Say so; the caller falls back to solo. */
        sess.denied = true;
        sess.error = 'This room\'s activity could not be read.';
        sess.ready = true;
        emitState();
      });
      sess.offs.push(function () { try { eRef.off('child_added', onE); } catch (e) {} });

      each1(base, 'cfg', function (v) { patchMeta({ cfg: obj(v) }); mergeCfg(sess, v); });
      each1(base, 'name', function (v) { patchMeta({ name: str(v) }); });
      each1(base, 'hostName', function (v) { patchMeta({ hostName: str(v) }); });
      each1(base, 'createdAt', function (v) { patchMeta({ createdAt: numOr(v, 0) }); });
    } catch (e) {
      sess.error = 'Could not reach that room.';
      sess.ready = true;
    }

    startPresence(sess, base);
    startPromotionWatch(sess, base);
    attachPauseHost(sess);
    /* Nothing has landed yet, but the room exists: publish a state now so a
       consumer that subscribed before joining is not left holding null. */
    sess.ready = true;
    emitState();
    return sess;
  }

  /**
   * decorate(v, key) - the wire shape plus the aliases the two sibling modules
   * read. They were written against {kind|type, uid, who|name, text|label};
   * this file stores {t, by, byName}. Aliasing on the way OUT costs nothing on
   * the wire and means neither module has to learn the other's field names.
   */
  function decorate(v, key) {
    v._k = str(key);
    v.key = str(key);
    v.type = str(v.t);
    v.kind = str(v.kind || v.t);
    v.uid = str(v.by);
    v.who = str(v.byName);
    v.name = str(v.byName);
    return v;
  }

  function each1(base, child, apply) {
    try {
      var p = base.child(child).once('value', function (snap) {
        apply(snap && isFn(snap.val) ? snap.val() : null);
        emitState();
      }, function () {});
      if (p && isFn(p.then)) {
        p.then(function (snap) {
          apply(snap && isFn(snap.val) ? snap.val() : null);
          emitState();
        }, function () {});
      }
    } catch (e) {}
  }

  /** The room's cfg names the topic and the activity. It is written once at
   *  creation, so it seeds the fold rather than competing with it. */
  function mergeCfg(sess, cfgVal) {
    var c = obj(cfgVal);
    var s = shallow(sess.shared);
    s.cfg = {
      kind: lower(c.kind) || str(obj(s.cfg).kind) || 'study',
      topicId: str(c.topicId) || str(obj(s.cfg).topicId),
      mode: str(c.mode) || str(obj(s.cfg).mode),
      durationSec: Math.max(0, Math.round(numOr(c.durationSec, numOr(obj(s.cfg).durationSec, 0))))
    };
    /* Only seed the activity if no activity event has landed yet - an event
       always beats the room's opening settings. */
    if (!numOr(obj(s.activity).at, 0)) {
      s.activity = { kind: s.cfg.kind, topicId: s.cfg.topicId, mode: s.cfg.mode, at: 0, by: '' };
    }
    if (!obj(s.run).started) {
      s.run = shallow(s.run);
      s.run.durationSec = s.cfg.durationSec;
    }
    sess.shared = s;
  }

  function startPresence(sess, base) {
    if (!sess.uid) { return; }
    var me;
    try { me = base.child('players').child(sess.uid); } catch (e) { return; }
    /* clearInterval does not un-queue a callback already scheduled. Without
       this flag a heartbeat in flight when the student leaves lands AFTER the
       cleanup and re-marks them connected, leaving a ghost in the roster that
       never times out - and if they were the host, one nobody may replace. */
    var alive = true;
    function beat() {
      if (!alive) { return; }
      try {
        var p = me.update({
          name: sess.name, lastSeen: sharedNow(), connected: true, alive: true
        });
        if (p && isFn(p['catch'])) {
          p['catch'](function () { sess.denied = true; emitState(); });
        }
      } catch (e) { sess.denied = true; }
    }
    /* Announce first, ask questions afterwards. Until /players/<uid> exists
       this student is in nobody's roster, and a partner who deals roles in
       that window deals them out of the round entirely. */
    beat();
    try {
      var q = me.once('value', function (snap) {
        if (!alive) { return; }
        var cur = obj(snap && isFn(snap.val) ? snap.val() : null);
        /* joinedAt is written once and never again: it is the tie-break that
           decides who inherits the room, and a refresh must not send somebody
           to the back of that queue. */
        if (!numOr(cur.joinedAt, 0)) {
          try { swallow(me.update({ joinedAt: sharedNow() })); } catch (e) {}
        }
      }, function () {});
      if (q && isFn(q.then)) {
        q.then(function (snap) {
          if (!alive) { return; }
          var cur = obj(snap && isFn(snap.val) ? snap.val() : null);
          if (!numOr(cur.joinedAt, 0)) {
            try { swallow(me.update({ joinedAt: sharedNow() })); } catch (e) {}
          }
        }, function () {});
      }
    } catch (e) {}
    try {
      if (isFn(me.onDisconnect)) {
        swallow(me.onDisconnect().update({ connected: false, alive: false }));
      }
    } catch (e) {}
    var iv = window.setInterval(beat, PRESENCE_MS);
    sess.timers.push(iv);
    sess.offs.push(function () {
      alive = false;
      try { swallow(me.update({ connected: false, alive: false, lastSeen: sharedNow() })); } catch (e) {}
    });
  }

  function startPromotionWatch(sess, base) {
    var iv = window.setInterval(function () {
      if (!session || session !== sess || !sess.uid) { return; }
      var now = sharedNow();
      var hostId = str(obj(sess.meta).hostId);
      if (hostId === sess.uid) { return; }
      if (!hostIsStale(sess.players, hostId, now)) { return; }
      if (electHost(sess.players, hostId, now) !== sess.uid) { return; }
      /* Write-if-unchanged, exactly as codeblue.js does it: if somebody else
         promoted first, cur is no longer the stale id and we abort. Nothing
         about the RUN depends on this succeeding - the fold does not care who
         the host is - so a lost race is not an error path. */
      try {
        var ref = base.child('hostId');
        var tx = ref.transaction(function (cur) {
          if (str(cur) !== hostId) { return undefined; }
          return sess.uid;
        }, function (err, committed) {
          if (!err && committed) {
            try {
              swallow(base.child('hostName').set(sess.name));
            } catch (e) {}
            toast('Your partner dropped out. You are hosting this room now.', 'info');
          }
        });
        if (tx && isFn(tx.then)) {
          tx.then(function (res) {
            if (obj(res).committed) {
              try { swallow(base.child('hostName').set(sess.name)); } catch (e) {}
            }
          }, function () {});
        }
      } catch (e) {}
    }, PROMOTE_TICK_MS);
    sess.timers.push(iv);
  }

  function attachPauseHost(sess) {
    if (isFn(detachPause)) { try { detachPause(); } catch (e) {} }
    detachPause = partnerPause._attach({
      pause: function (reason) {
        if (!canPauseNow()) { return false; }
        publish({ t: EV.PAUSE, reason: str(reason) });
        return true;
      },
      resume: function () {
        if (!session) { return false; }
        if (!obj(obj(session.shared).run).paused) { return false; }
        publish({ t: EV.RESUME });
        return true;
      },
      toggle: function () {
        if (!session) { return false; }
        if (obj(obj(session.shared).run).paused) {
          publish({ t: EV.RESUME });
          return false;
        }
        if (!canPauseNow()) { return false; }
        publish({ t: EV.PAUSE });
        return true;
      },
      isPaused: function () {
        return !!(session && obj(obj(session.shared).run).paused);
      },
      canPause: canPauseNow,
      stats: function () {
        var s = obj(session && session.shared);
        var r = obj(s.run);
        var now = sharedNow();
        var held = numOr(r.pausedMs, 0) +
          (r.paused && r.pausedAt ? Math.max(0, now - r.pausedAt) : 0);
        return {
          active: !!session && !!r.started && !r.ended,
          paused: !!r.paused,
          pauseCount: numOr(r.pauseCount, 0),
          pausedMs: held,
          pausedSec: Math.floor(held / 1000),
          pausedBy: str(r.pausedBy),
          pausedByName: str(r.pausedByName),
          mode: 'partner-' + lower(obj(s.activity).kind || 'study'),
          simSec: elapsedSec(s, now)
        };
      }
    });
    sess.offs.push(function () {
      if (isFn(detachPause)) { try { detachPause(); } catch (e) {} }
      detachPause = null;
    });
  }
  function canPauseNow() {
    if (!session) { return false; }
    var r = obj(obj(session.shared).run);
    return !!r.started && !r.ended && !r.paused;
  }

  function teardown() {
    if (!session) { return; }
    var s = session;
    session = null;
    arr(s.timers).forEach(function (t) { try { window.clearInterval(t); } catch (e) {} });
    arr(s.offs).forEach(function (f) { try { f(); } catch (e) {} });
  }

  /* ==========================================================================
   * 9. THE PUBLISHED API
   * --------------------------------------------------------------------------
   * Published at module load. js/simprep.js and js/simprep-sim.js feature-
   * detect this object, so it has to exist before they render whether or not
   * Firebase, React, auth or the network do. Every method is safe with no room:
   * it resolves or returns falsy and files the reason in lastError().
   * ======================================================================== */

  /**
   * createRoom({kind, topicId, mode, durationSec, name}) -> Promise<{code, roomId} | null>
   *
   * Claims a code with codeblue.js's write-if-absent transaction, retrying on
   * collision. That transaction is what makes sharing the /codeblue/rooms
   * namespace safe: two students pressing Create in the same second cannot
   * land in the same node, and neither can a code student and a sim-prep one.
   */
  function createRoom(opts) {
    return new Promise(function (resolve) {
      var o = obj(opts);
      var db = getDb();
      var uid = meUid();
      if (!db) { resolve(fail('This needs a connection to work.')); return; }
      if (!uid) { resolve(fail('You need to be signed in to open a room.')); return; }
      bindServerOffset(db);
      var name = meName();
      var cfg = {
        kind: lower(o.kind) || 'study',
        topicId: str(o.topicId),
        mode: str(o.mode),
        durationSec: Math.max(0, Math.round(numOr(o.durationSec, 0)))
      };
      var tries = 0;
      function attempt() {
        tries++;
        if (tries > 8) {
          resolve(fail('Could not find a free room code. Try again in a moment.'));
          return;
        }
        var code = randCode();
        var record = {
          code: code,
          name: cut(str(o.name) || (name + ' - ' + activityLabel(cfg.kind)), 64),
          hostId: uid,
          hostName: cut(name, 32),
          createdAt: sharedNow(),
          status: ROOM_STATUS_OPEN,
          cfg: cfg
        };
        var settled = false;
        function finish(err, committed) {
          if (settled) { return; }
          settled = true;
          if (err) { resolve(fail('Could not create the room.')); return; }
          if (!committed) { attempt(); return; }
          lastError = '';
          teardown();
          attachRoom(db, code, cfg, {
            hostId: record.hostId, hostName: record.hostName, name: record.name,
            status: record.status, createdAt: record.createdAt, cfg: cfg
          });
          resolve({ code: code, roomId: code });
        }
        try {
          var ref = roomRef(db, code);
          /* A node counts as taken if it has ANY child, including an orphaned
             /events left by a room that was cleaned up badly. */
          var tx = ref.transaction(function (cur) {
            if (cur !== null && cur !== undefined) { return undefined; }
            return record;
          }, finish);
          /* transaction() answers through a callback on the real SDK and
             through a promise on some doubles. Take whichever arrives -
             settling is guarded, so hearing twice is harmless. */
          if (tx && isFn(tx.then)) {
            tx.then(function (res) { finish(null, !!obj(res).committed); },
              function () { finish(new Error('transaction failed')); });
          }
        } catch (e) { resolve(fail('Could not create the room.')); }
      }
      attempt();
    });
  }

  /**
   * joinRoom(code) -> Promise<roomState | null>
   *
   * Resolves once the room's status has been read and the event replay has had
   * a chance to land, so the caller's first roomState already reflects a run
   * that is halfway through and paused.
   */
  function joinRoom(code) {
    return new Promise(function (resolve) {
      var c = normalizeCode(code);
      var db = getDb();
      if (c.length !== 4) { resolve(fail('A room code is four letters.')); return; }
      if (!db) { resolve(fail('This needs a connection to work.')); return; }
      if (!meUid()) { resolve(fail('You need to be signed in to join a room.')); return; }
      bindServerOffset(db);
      var settled = false;
      function done(v) {
        if (settled) { return; }
        settled = true;
        resolve(v);
      }
      function proceed(status) {
        var s = str(status);
        if (!s) {
          done(fail('No room with the code ' + c + '. Check it with whoever is hosting.'));
          return;
        }
        /* Namespacing, enforced on the way IN as well as on the way out. A
           four-letter code that happens to belong to a Code Blue arrest or an
           MS2 lab checkoff is not this room, and joining it would put a
           sim-prep UI on top of somebody else's event log. */
        if (s === ROOM_STATUS_DONE) {
          done(fail('That room has already been closed.'));
          return;
        }
        if (s !== ROOM_STATUS_OPEN && s !== ROOM_STATUS_LIVE) {
          done(fail('The code ' + c + ' belongs to a different kind of room.'));
          return;
        }
        lastError = '';
        teardown();
        attachRoom(db, c, null);
        /* One turn of the event loop so the child_added replay and the roster
           read can land before the caller sees a state. */
        window.setTimeout(function () { done(buildRoomState()); }, 0);
      }
      try {
        var p = roomRef(db, c).child('status').once('value', function (snap) {
          proceed(snap && isFn(snap.val) ? snap.val() : '');
        }, function () { done(fail('Could not reach that room.')); });
        if (p && isFn(p.then)) {
          p.then(function (snap) {
            proceed(snap && isFn(snap.val) ? snap.val() : '');
          }, function () { done(fail('Could not reach that room.')); });
        }
      } catch (e) { done(fail('Could not reach that room.')); }
    });
  }

  function leaveRoom() {
    return new Promise(function (resolve) {
      try { teardown(); } catch (e) {}
      lastError = '';
      stateSubs.slice(0).forEach(function (fn) { try { fn(null); } catch (e) {} });
      try { partnerPause._changed(); } catch (e) {}
      resolve(true);
    });
  }

  /** Closing the room is the host's business; leaving it is everybody's. */
  function closeRoom() {
    return new Promise(function (resolve) {
      if (!session) { resolve(false); return; }
      try {
        swallow(roomRef(session.db, session.code).child('status').set(ROOM_STATUS_DONE));
      } catch (e) {}
      resolve(true);
    });
  }

  function subscribe(cb) {
    if (!isFn(cb)) { return function () {}; }
    stateSubs.push(cb);
    /* Answer immediately. A consumer that subscribes after the room is already
       live must not have to wait for the next event to find out. */
    try { cb(buildRoomState()); } catch (e) {}
    return function () {
      stateSubs = stateSubs.filter(function (f) { return f !== cb; });
    };
  }

  /**
   * onEvent(cb) -> off()
   * cb runs for every event in the shared log, including the ones that landed
   * before the subscriber existed. A consumer that folds the log needs the
   * whole log, and re-delivering is cheap; missing the first ten events of a
   * run is not recoverable.
   */
  function onEvent(cb) {
    if (!isFn(cb)) { return function () {}; }
    eventSubs.push(cb);
    if (session) {
      arr(session.events).forEach(function (e) { try { cb(e); } catch (x) {} });
    }
    return function () {
      eventSubs = eventSubs.filter(function (f) { return f !== cb; });
    };
  }

  /**
   * publish(event) -> Promise<key | null>
   *
   * Append-only. The event is stamped with SHARED time (Date.now() plus the
   * server offset) and with the publisher's uid, name and CURRENT ROLE, which
   * is what lets the rubric merge stay deterministic after a role swap.
   *
   * A denied write resolves null and flips roomState.denied - it never throws
   * and never rejects, because the caller is a render path.
   */
  function publish(event) {
    return new Promise(function (resolve) {
      if (!session) { resolve(fail('Not in a room.')); return; }
      var e = shallow(obj(event));
      /* `kind` is accepted as a type because js/simprep.js publishes its own
         vocabulary ('study_answer', 'card_opened', 'tab_change') under that
         name. The fold ignores a type it does not know, so those land in the
         shared log and reach the partner's feed without this file needing to
         learn Study Mode's event list. */
      var t = lower(e.t || e.type || e.kind);
      if (!t) { resolve(fail('An event needs a type.')); return; }
      delete e.type;
      e.t = t;
      e.by = str(e.by) || str(session.uid);
      e.byName = str(e.byName) || str(session.name);
      e.role = roleMeta(e.role || obj(obj(session.shared).roles)[session.uid]).id;
      /* ALWAYS shared time, even if the caller stamped one. A caller's
         Date.now() is exactly the skew this module exists to remove; theirs is
         kept as clientAt so a debug session can still see the difference. */
      if (numOr(e.at, 0)) { e.clientAt = numOr(e.at, 0); }
      e.at = sharedNow();
      var body = scrub(e);
      try {
        var ref = roomRef(session.db, session.code).child('events').push(body);
        var key = str(obj(ref).key);
        /* push() returns a ThenableReference on the modern SDK. Catch the
           rejection so a rule denial degrades to a flag instead of an
           unhandled rejection in somebody else's console. */
        if (ref && isFn(ref['catch'])) {
          ref['catch'](function () {
            if (session) { session.denied = true; session.error = 'That did not reach the room.'; }
            emitState();
          });
        }
        if (ref && isFn(ref.then)) {
          ref.then(function () {}, function () {});
        }
        resolve(key || true);
      } catch (x) {
        if (session) { session.denied = true; session.error = 'That did not reach the room.'; }
        emitState();
        resolve(fail('That did not reach the room.'));
      }
    });
  }

  /** setActivity({kind, topicId, mode}) - move the whole room to a new tab. */
  function setActivity(activity) {
    var a = obj(activity);
    if (!session) { fail('Not in a room.'); return null; }
    var kind = lower(a.kind) || lower(obj(obj(session.shared).activity).kind) || 'study';
    return publish({
      t: EV.ACTIVITY, kind: kind,
      topicId: str(a.topicId), mode: str(a.mode)
    });
  }

  function setRole(role, uid) {
    if (!session) { fail('Not in a room.'); return null; }
    var target = str(uid) || str(session.uid);
    /* Mirror onto /players for the roster badge, but the EVENT is what the
       fold reads: /players is a presence record, not a ledger. */
    try {
      swallow(roomRef(session.db, session.code).child('players').child(target)
        .update({ role: roleMeta(role).id }), markDenied);
    } catch (e) {}
    return publish({ t: EV.ROLE, uid: target, role: roleMeta(role).id });
  }

  /** One click. Not a teardown - the run keeps running through it. */
  function swapRoles() {
    if (!session) { fail('Not in a room.'); return null; }
    var st = buildRoomState();
    var uids = arr(obj(st).roster).filter(function (r) { return r.alive; })
      .map(function (r) { return r.uid; });
    if (uids.length < 2) {
      uids = arr(obj(st).roster).map(function (r) { return r.uid; });
    }
    var map = swapMap(obj(session.shared).roles, uids);
    var k;
    for (k in map) {
      if (!Object.prototype.hasOwnProperty.call(map, k)) { continue; }
      try {
        swallow(roomRef(session.db, session.code).child('players').child(k)
          .update({ role: map[k] }), markDenied);
      } catch (e) {}
    }
    return publish({
      t: EV.SWAP, map: map,
      round: numOr(obj(session.shared).round, 1) + 1
    });
  }

  function getRoom() { return session ? buildRoomState() : null; }
  function isHost() {
    if (!session) { return false; }
    var h = str(obj(session.meta).hostId);
    return !!h && h === str(session.uid);
  }
  function inRoom() { return !!session; }
  function getLastError() { return lastError; }

  /* --- convenience verbs the other two modules will reach for --------------
     Each is publish() with the right shape. They exist so simprep.js does not
     have to know the event vocabulary, and so a typo there is a no-op here
     rather than a silently ignored event. */
  function startRun(durationSec) {
    if (!session) { fail('Not in a room.'); return null; }
    try {
      /* status moves off 'simprep-open' so a stale lobby stops advertising a
         room that is mid-run. Still never 'running' - that is Code Blue's. */
      swallow(roomRef(session.db, session.code).child('status').set(ROOM_STATUS_LIVE));
    } catch (e) {}
    return publish({
      t: EV.START,
      durationSec: Math.max(0, Math.round(numOr(durationSec,
        numOr(obj(obj(session.shared).cfg).durationSec, 0))))
    });
  }
  function endRun(reason) { return publish({ t: EV.END, reason: str(reason) || 'ended' }); }
  function pauseRun(reason) { return publish({ t: EV.PAUSE, reason: str(reason) }); }
  function resumeRun() { return publish({ t: EV.RESUME }); }
  function mark(itemId, verdict, label) {
    return publish({ t: EV.MARK, itemId: str(itemId), verdict: normVerdict(verdict), label: str(label) });
  }
  function unmark(itemId) { return publish({ t: EV.UNMARK, itemId: str(itemId) }); }
  function logAction(text, kind) {
    return publish({ t: EV.ACTION, text: str(text), kind: str(kind) || 'action' });
  }
  function setDeck(index, total) {
    return publish({ t: EV.DECK, index: Math.max(0, Math.round(numOr(index, 0))), total: numOr(total, 0) });
  }
  function setTab(tab) { return publish({ t: EV.TAB, tab: str(tab) }); }
  function answer(qid, choice, correct) {
    return publish({ t: EV.ANSWER, qid: str(qid), choice: str(choice), correct: !!correct });
  }
  function reveal(qid) { return publish({ t: EV.REVEAL, qid: str(qid) }); }
  function prompt(index, text) {
    return publish({ t: EV.PROMPT, index: Math.round(numOr(index, 0)), text: str(text) });
  }
  function note(text, kind) { return publish({ t: EV.NOTE, text: str(text), kind: str(kind) }); }

  var API = {
    /* the contract, exactly as js/simprep.js and js/simprep-sim.js expect it */
    createRoom: createRoom,
    joinRoom: joinRoom,
    leaveRoom: leaveRoom,
    subscribe: subscribe,
    setActivity: setActivity,
    publish: publish,
    onEvent: onEvent,
    getRoom: getRoom,
    isHost: isHost,

    /* everything else is additive and safe to ignore */
    version: 1,
    inRoom: inRoom,
    lastError: getLastError,
    closeRoom: closeRoom,
    setRole: setRole,
    swapRoles: swapRoles,
    startRun: startRun,
    endRun: endRun,
    pauseRun: pauseRun,
    resumeRun: resumeRun,
    mark: mark,
    unmark: unmark,
    logAction: logAction,
    setDeck: setDeck,
    setTab: setTab,
    answer: answer,
    reveal: reveal,
    prompt: prompt,
    note: note,
    sharedNow: sharedNow,
    serverOffset: serverOffset,
    elapsedMs: elapsedMs,
    elapsedSec: elapsedSec,
    remainingSec: remainingSec,
    visibleAnswers: visibleAnswers,
    readyToReveal: readyToReveal,
    canMarkRubric: canMarkRubric,
    roleMeta: roleMeta,
    ROLES: ROLES,
    EVENTS: EV,
    ROOM_BASE: ROOM_BASE,
    ROOM_STATUS_OPEN: ROOM_STATUS_OPEN,
    ROOM_STATUS_LIVE: ROOM_STATUS_LIVE,
    ROOM_STATUS_DONE: ROOM_STATUS_DONE,

    /* pause, the shared contract */
    pause: partnerPause.pauseRun,
    resume: partnerPause.resumeRun,
    togglePause: partnerPause.togglePauseRun,
    isPaused: partnerPause.isRunPaused,
    canPause: partnerPause.canPauseRun,
    onPauseChange: partnerPause.onPauseChange,
    pauseStats: partnerPause.pauseStats,
    pauseControl: partnerPause.pauseControl
  };

  /* PUBLISHED AT MODULE LOAD, before a single component is defined and before
     React is even checked for. Feature detection in the two sibling modules
     must succeed regardless of script order or of anything below failing. */
  MMroot().simprepPartner = API;

  /* ==========================================================================
   * 10. STYLESHEET (injected once, `spp-` prefix)
   * ======================================================================== */

  var STYLE_ID = 'simprep-partner-styles';
  function injectStyles() {
    try {
      if (!document || !document.getElementById) { return; }
      if (document.getElementById(STYLE_ID)) { return; }
    } catch (e) { return; }
    var css = [
      '.spp-root{max-width:1040px;margin:0 auto;padding:14px 12px 40px;',
      'color:var(--text,#e5e7eb);font-size:0.95rem;line-height:1.5}',
      '.spp-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px}',
      '.spp-h h2{font-size:1.15rem;margin:0;color:var(--text,#e5e7eb)}',
      '.spp-sub{color:var(--muted,#9ca3af);font-size:0.88rem;margin:2px 0 0}',
      '.spp-card{background:var(--card,#111827);border:1px solid var(--border,#1f2937);',
      'border-radius:14px;padding:14px;margin-top:12px}',
      '.spp-card h3{margin:0 0 6px;font-size:1rem;color:var(--text,#e5e7eb)}',
      '.spp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}',
      '.spp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.spp-btn{appearance:none;-webkit-appearance:none;cursor:pointer;',
      'background:var(--chip,#1f2937);color:var(--text,#e5e7eb);',
      'border:1px solid var(--border,#374151);border-radius:10px;',
      'padding:9px 13px;font-size:0.9rem;font-family:inherit;font-weight:600;',
      'min-height:40px;transition:background .15s ease,border-color .15s ease}',
      '.spp-btn:hover:not(:disabled){background:var(--chip-hover,#374151)}',
      '.spp-btn:disabled{opacity:0.5;cursor:not-allowed}',
      '.spp-btn.go{background:var(--accent,#3b82f6);color:var(--text-on-fill,#ffffff);',
      'border-color:var(--accent,#3b82f6)}',
      '.spp-btn.warn{background:var(--warn-bg,#78350f);color:var(--text,#fde68a);',
      'border-color:var(--warn,#f59e0b)}',
      '.spp-btn.ghost{background:transparent;color:var(--muted,#9ca3af)}',
      '.spp-btn[aria-pressed="true"]{border-color:var(--accent,#3b82f6);',
      'background:var(--tint-accent,rgba(59,130,246,0.16));color:var(--text,#e5e7eb)}',
      '.spp-in{background:var(--input,#0b1220);color:var(--text,#e5e7eb);',
      'border:1px solid var(--border,#374151);border-radius:10px;padding:9px 11px;',
      'font-size:1rem;font-family:inherit;min-height:40px;width:100%;max-width:220px}',
      '.spp-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
      'letter-spacing:0.32em;text-transform:uppercase;font-size:1.15rem;text-align:center}',
      '.spp-big{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:2rem;',
      'letter-spacing:0.3em;color:var(--accent,#3b82f6);font-weight:700}',
      '.spp-banner{background:var(--tint-accent,rgba(59,130,246,0.12));',
      'border:1px solid var(--accent,#3b82f6);border-radius:10px;padding:10px 12px;',
      'color:var(--text,#e5e7eb);font-size:0.88rem}',
      '.spp-banner.bad{background:var(--tint-bad,rgba(239,68,68,0.12));border-color:var(--bad,#ef4444)}',
      '.spp-banner.warn{background:var(--tint-warn,rgba(245,158,11,0.12));border-color:var(--warn,#f59e0b)}',
      '.spp-roster{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:8px}',
      '.spp-seat{display:flex;align-items:center;gap:10px;flex-wrap:wrap;',
      'background:var(--card-2,#0b1220);border:1px solid var(--border,#1f2937);',
      'border-radius:10px;padding:9px 11px;color:var(--text,#e5e7eb)}',
      '.spp-seat .who{font-weight:600}',
      '.spp-seat .meta{color:var(--muted,#9ca3af);font-size:0.82rem}',
      '.spp-dot{width:9px;height:9px;border-radius:50%;background:var(--muted,#6b7280);flex:0 0 auto}',
      '.spp-dot.on{background:var(--good,#22c55e)}',
      '.spp-dot.off{background:var(--bad,#ef4444)}',
      '.spp-tag{display:inline-block;border-radius:999px;padding:2px 9px;font-size:0.74rem;',
      'font-weight:700;letter-spacing:0.04em;border:1px solid var(--border,#374151);',
      'background:var(--chip,#1f2937);color:var(--text,#e5e7eb)}',
      '.spp-tag.host{border-color:var(--accent,#3b82f6);color:var(--accent,#93c5fd)}',
      '.spp-tag.runner{border-color:var(--good,#22c55e);color:var(--good,#86efac)}',
      '.spp-tag.proctor{border-color:var(--warn,#f59e0b);color:var(--warn,#fcd34d)}',
      '.spp-clock{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.5rem;',
      'font-weight:700;color:var(--text,#e5e7eb)}',
      '.spp-clock.paused{color:var(--warn,#fbbf24)}',
      '.spp-log{list-style:none;margin:8px 0 0;padding:0;max-height:260px;overflow-y:auto;display:grid;gap:6px}',
      '.spp-log li{border-left:3px solid var(--border,#374151);padding:4px 0 4px 9px;',
      'font-size:0.85rem;color:var(--text,#e5e7eb)}',
      '.spp-log li.good{border-left-color:var(--good,#22c55e)}',
      '.spp-log li.warn{border-left-color:var(--warn,#f59e0b)}',
      '.spp-log li.bad{border-left-color:var(--bad,#ef4444)}',
      '.spp-log li.coach{border-left-color:var(--accent,#3b82f6)}',
      '.spp-log .t{color:var(--muted,#9ca3af);font-size:0.76rem;margin-right:6px;',
      'font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
      '.spp-log .d{display:block;color:var(--muted,#9ca3af);font-size:0.8rem;margin-top:2px}',
      '.spp-empty{text-align:center;color:var(--muted,#9ca3af);padding:22px 12px;font-size:0.9rem}',
      '.spp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);',
      'white-space:nowrap;border:0;margin:-1px;padding:0}',
      '@media (max-width:620px){.spp-root{padding:10px 10px 34px}',
      '.spp-big{font-size:1.6rem;letter-spacing:0.22em}',
      '.spp-in{max-width:100%}}',
      '@media (prefers-reduced-motion:reduce){.spp-btn{transition:none}}'
    ].join('');
    try {
      var el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = css;
      (document.head || document.documentElement).appendChild(el);
    } catch (e) {}
  }
  injectStyles();

  /* ==========================================================================
   * 11. TOPIC DISCOVERY
   * --------------------------------------------------------------------------
   * data/nur2212-scenarios.js and data/nur2212-study.js are separate <script>
   * tags owned by other modules. This layer must be useful before either has
   * landed, so the topic list is DISCOVERED, never required: if nothing is
   * there the lobby still opens a room and takes a typed topic id, and the
   * partner sees whatever the study module eventually loads.
   * ======================================================================== */

  function discoverTopics() {
    var out = [];
    function push(list) {
      arr(list).forEach(function (raw) {
        var t = obj(raw);
        /* data/nur2212-scenarios.js keys its topics on `topic_id`, which is
           also what js/simprep.js and js/simprep-sim.js resolve against, so
           that spelling is the one that has to survive into the room's cfg. */
        var id = str(t.topic_id || t.topicId || t.id || t.slug);
        if (!id) { return; }
        if (out.filter(function (x) { return x.id === id; }).length) { return; }
        out.push({
          id: id,
          title: str(t.title || t.name || t.label) || id,
          blurb: cut(str(t.blurb || t.summary || t.subtitle || ''), 140),
          supplemental: !!(t.supplemental || t.extra)
        });
      });
    }
    try {
      /* Study Mode's own list first when it has loaded - it is the one that
         already merged the 8 school-derived and 4 supplemental topics. The
         raw data globals are the fallback for the window in which
         js/simprep.js has not evaluated yet. */
      var study = window.SimPrepStudy || window.SimPrepHub || window.SimPrepMode;
      if (study && isFn(study.allTopics)) { push(study.allTopics()); }
      push(window.NUR2212_SCENARIOS);
      push(window.NUR2212_TOPICS);
      push(obj(window.NUR2212_STUDY).topics);
      var sim = window.SimPrepSimMode || window.SimPrepSim;
      if (sim && isFn(sim.allScenarios)) { push(sim.allScenarios()); }
    } catch (e) {}
    return out;
  }

  /* ==========================================================================
   * 12. THE LOBBY PAGE  ->  window.SimPrepPartner
   * ======================================================================== */

  var React = window.React || null;
  var ce = React ? React.createElement : function () { return null; };
  var useState = React ? React.useState : null;
  var useEffect = React ? React.useEffect : null;
  var useCallback = React ? React.useCallback : null;

  function SignedOut() {
    return ce('div', { className: 'spp-root' },
      ce('div', { className: 'spp-card' }, [
        ce('h3', { key: 'h' }, 'Partner mode'),
        ce('p', { className: 'spp-sub', key: 'p' },
          'Rehearse a checkoff the way your program actually runs it: one of you performs ' +
          'the scenario, the other marks the rubric and holds the prompts, and then you swap. ' +
          'The clock, the pause and the rubric are shared, so neither of you is guessing what ' +
          'the other saw.'),
        ce('div', { className: 'spp-banner', key: 'b', style: { marginTop: 12 } },
          'You need to be signed in to open or join a room. Rooms live on your account so ' +
          'your partner can find you by code, your seat survives a refresh, and a dropped ' +
          'connection rejoins where it left off.'),
        ce('div', { className: 'spp-row', key: 'r', style: { marginTop: 12 } },
          ce('button', {
            type: 'button', className: 'spp-btn go',
            onClick: function () {
              var MM = MMroot();
              if (isFn(MM.navigate)) { try { MM.navigate('home'); } catch (e) {} }
            }
          }, 'Sign in from the account menu')),
        ce('div', { key: 'w', style: { marginTop: 14 } }, [
          ce('h3', { key: 'h2' }, 'What a partner room gives you'),
          ce('ul', { key: 'u', style: { paddingLeft: 18, margin: '6px 0 0' } },
            [
              'Study together: the same topic, the same tab, the same card - and quiz answers ' +
                'that stay hidden until you have both answered, so neither of you can peek.',
              'Simulation together: one shared 20-minute clock, one shared pause, one shared ' +
                'action log, and the proctor marking the rubric live while the runner works.',
              'Coach together: your partner reads the checklist and calls the prompts while ' +
                'you rehearse out loud.',
              'A one-click seat swap between rounds that keeps the clock, the marks and the log.'
            ].map(function (t, i) {
              return ce('li', { key: i, className: 'spp-sub' }, t);
            }))
        ])
      ]));
  }

  function Seat(props) {
    var p = obj(props);
    var r = obj(p.row);
    var rm = roleMeta(r.role);
    return ce('li', { className: 'spp-seat' }, [
      ce('span', {
        key: 'd',
        className: 'spp-dot ' + (r.alive ? 'on' : 'off'),
        title: r.alive ? 'Connected' : 'Not connected right now'
      }),
      ce('span', { key: 'w', className: 'who' }, str(r.name) + (r.isMe ? ' (you)' : '')),
      r.isHost ? ce('span', { key: 'h', className: 'spp-tag host' }, 'HOST') : null,
      ce('span', { key: 'r', className: 'spp-tag ' + rm.id }, rm.label),
      !r.alive
        ? ce('span', { key: 'm', className: 'meta' }, 'reconnecting - the room keeps running')
        : null
    ]);
  }

  function Roster(props) {
    var p = obj(props);
    var rows = arr(obj(p.room).roster);
    if (!rows.length) {
      return ce('div', { className: 'spp-empty' }, 'Nobody is here yet. Read the code out.');
    }
    return ce('ul', { className: 'spp-roster' }, rows.map(function (r) {
      return ce(Seat, { key: r.uid, row: r });
    }));
  }

  /**
   * SimPrepPartner - the lobby.
   *
   * Deliberately does NOT try to render the study or simulation surfaces: those
   * belong to js/simprep.js and js/simprep-sim.js, which read the same session
   * through window.MM.simprepPartner. This page opens the room, seats people,
   * and hands off with onNav.
   */
  function SimPrepPartner(props) {
    if (!React) { return null; }
    var p = obj(props);
    injectStyles();

    var MM = MMroot();
    var authUser = p.authUser || MM.authUser || null;

    var roomH = useState(getRoom());
    var room = roomH[0], setRoom = roomH[1];
    var errH = useState('');
    var err = errH[0], setErr = errH[1];
    var busyH = useState('');
    var busy = busyH[0], setBusy = busyH[1];
    var codeH = useState('');
    var typed = codeH[0], setTyped = codeH[1];
    var kindH = useState('sim');
    var kind = kindH[0], setKind = kindH[1];
    var topicH = useState('');
    var topicId = topicH[0], setTopicId = topicH[1];
    var tickH = useState(0);
    var setTick = tickH[1];

    useEffect(function () { return subscribe(function (st) { setRoom(st); }); }, []);
    /* One second of wall time so the shared clock and the presence dots move.
       The clock VALUE is still derived from stored timestamps - this only asks
       React to look at it again. */
    useEffect(function () {
      var iv = window.setInterval(function () {
        setTick(function (n) { return n + 1; });
      }, 1000);
      return function () { window.clearInterval(iv); };
    }, []);

    var topics = discoverTopics();
    useEffect(function () {
      if (!topicId && topics.length) { setTopicId(topics[0].id); }
    }, [topics.length, topicId]);

    var doCreate = useCallback(function () {
      setErr('');
      setBusy('create');
      createRoom({ kind: kind, topicId: topicId, durationSec: 20 * 60 }).then(function (res) {
        setBusy('');
        if (!res) { setErr(getLastError() || 'Could not create the room.'); return; }
        toast('Room ' + res.code + ' is open. Read the code to your partner.', 'success');
      });
    }, [kind, topicId]);

    var doJoin = useCallback(function () {
      var c = normalizeCode(typed);
      setErr('');
      if (c.length !== 4) { setErr('A room code is four letters.'); return; }
      setBusy('join');
      joinRoom(c).then(function (st) {
        setBusy('');
        if (!st) { setErr(getLastError() || 'Could not join that room.'); return; }
        setTyped('');
      });
    }, [typed]);

    if (!authUser || !meUid()) { return ce(SignedOut, null); }

    var head = ce('div', { className: 'spp-h', key: 'head' }, [
      ce('h2', { key: 'h' }, 'Partner mode'),
      room ? ce('span', { key: 't', className: 'spp-tag' }, 'Room ' + room.code) : null
    ]);

    if (!room) {
      return ce('div', { className: 'spp-root' }, [
        head,
        ce('p', { className: 'spp-sub', key: 'sub' },
          'Two of you, one 20-minute checkoff. One runs it, one marks it, and you swap ' +
          'between rounds without losing the clock.'),
        err ? ce('div', { className: 'spp-banner bad', key: 'e', role: 'alert' }, err) : null,
        ce('div', { className: 'spp-grid', key: 'g' }, [
          ce('div', { className: 'spp-card', key: 'c' }, [
            ce('h3', { key: 'h' }, 'Open a room'),
            ce('p', { className: 'spp-sub', key: 'p' },
              'You get a four-letter code. Read it out; your partner types it in.'),
            ce('div', { className: 'spp-row', key: 'k', style: { marginTop: 10 } },
              [
                { id: 'study', l: 'Study together' },
                { id: 'sim', l: 'Simulation together' },
                { id: 'coach', l: 'Coach together' }
              ].map(function (o) {
                return ce('button', {
                  key: o.id, type: 'button', className: 'spp-btn',
                  'aria-pressed': kind === o.id ? 'true' : 'false',
                  onClick: function () { setKind(o.id); }
                }, o.l);
              })),
            topics.length
              ? ce('div', { className: 'spp-row', key: 't', style: { marginTop: 10 } },
                  ce('select', {
                    className: 'spp-in', value: topicId,
                    'aria-label': 'Topic',
                    onChange: function (e) { setTopicId(str(e.target.value)); }
                  }, topics.map(function (t) {
                    return ce('option', { key: t.id, value: t.id }, t.title);
                  })))
              : ce('div', { key: 't2' }, [
                  ce('div', { className: 'spp-banner warn', key: 'b', style: { marginTop: 10 } },
                    'The topic list has not loaded yet. You can still open a room now - ' +
                    'whoever picks a topic inside it moves the whole room.'),
                  ce('input', {
                    key: 'i', className: 'spp-in', style: { marginTop: 8 },
                    placeholder: 'Topic id (optional)', value: topicId,
                    'aria-label': 'Topic id',
                    onChange: function (e) { setTopicId(str(e.target.value)); }
                  })
                ]),
            ce('div', { className: 'spp-row', key: 'b', style: { marginTop: 12 } },
              ce('button', {
                type: 'button', className: 'spp-btn go',
                disabled: busy === 'create',
                onClick: doCreate
              }, busy === 'create' ? 'Opening...' : 'Open the room'))
          ]),
          ce('div', { className: 'spp-card', key: 'j' }, [
            ce('h3', { key: 'h' }, 'Join with a code'),
            ce('p', { className: 'spp-sub', key: 'p' },
              'Four letters. I, O, 0 and 1 are never used, so there is nothing to mishear.'),
            ce('div', { className: 'spp-row', key: 'r', style: { marginTop: 10 } }, [
              ce('input', {
                key: 'i', className: 'spp-in spp-code', maxLength: 4,
                placeholder: 'ABCD', value: typed, 'aria-label': 'Room code',
                onChange: function (e) { setTyped(normalizeCode(e.target.value)); },
                onKeyDown: function (e) { if (e.key === 'Enter') { doJoin(); } }
              }),
              ce('button', {
                key: 'b', type: 'button', className: 'spp-btn go',
                disabled: busy === 'join', onClick: doJoin
              }, busy === 'join' ? 'Joining...' : 'Join')
            ])
          ])
        ]),
        ce('div', { className: 'spp-card', key: 'x' }, [
          ce('h3', { key: 'h' }, 'How the seats work'),
          ce('ul', { key: 'u', style: { paddingLeft: 18, margin: '6px 0 0' } },
            ROLES.map(function (r) {
              return ce('li', { key: r.id, className: 'spp-sub' },
                ce('b', { style: { color: 'var(--text,#e5e7eb)' } }, r.label + ': '), r.blurb);
            }))
        ])
      ]);
    }

    /* ---------------------------------------------------------- in a room */
    var run = obj(room.run);
    var paused = !!run.paused;
    var clock = run.started
      ? (run.durationSec
          ? fmtClock(numOr(room.remainingSec, 0))
          : fmtClock(numOr(room.elapsedSec, 0)))
      : fmtClock(numOr(obj(room.cfg).durationSec, 0));

    return ce('div', { className: 'spp-root' }, [
      head,
      room.denied
        ? ce('div', { className: 'spp-banner bad', key: 'd', role: 'alert' },
            'Some of this room could not be written from your account. Everything you can ' +
            'see is still correct and you can keep working solo - nothing was lost.')
        : null,
      room.error
        ? ce('div', { className: 'spp-banner warn', key: 'e', role: 'status' }, room.error)
        : null,
      room.hostStale && !room.isHost
        ? ce('div', { className: 'spp-banner warn', key: 'hs', role: 'status' },
            'Your partner has gone quiet. The room keeps running - nothing here depends on ' +
            'them being online - and one of you will pick up hosting automatically.')
        : null,
      ce('div', { className: 'spp-card', key: 'code' }, [
        ce('h3', { key: 'h' }, 'Room code'),
        ce('div', { className: 'spp-big', key: 'c' }, room.code),
        ce('p', { className: 'spp-sub', key: 'p' },
          activityLabel(obj(room.activity).kind) +
          (str(obj(room.activity).topicId) ? ' - ' + str(obj(room.activity).topicId) : '') +
          '  -  round ' + numOr(room.round, 1)),
        ce('div', { className: 'spp-row', key: 'r', style: { marginTop: 10 } }, [
          ce('button', {
            key: 'copy', type: 'button', className: 'spp-btn',
            onClick: function () {
              try {
                if (window.navigator && window.navigator.clipboard &&
                    isFn(window.navigator.clipboard.writeText)) {
                  window.navigator.clipboard.writeText(room.code);
                  toast('Copied.', 'success');
                }
              } catch (e) {}
            }
          }, 'Copy the code'),
          ce('button', {
            key: 'swap', type: 'button', className: 'spp-btn',
            onClick: function () { swapRoles(); }
          }, 'Swap seats'),
          ce('button', {
            key: 'leave', type: 'button', className: 'spp-btn ghost',
            onClick: function () { leaveRoom(); }
          }, 'Leave'),
          room.isHost
            ? ce('button', {
                key: 'close', type: 'button', className: 'spp-btn ghost',
                onClick: function () { closeRoom().then(function () { leaveRoom(); }); }
              }, 'Close the room')
            : null
        ])
      ]),
      ce('div', { className: 'spp-card', key: 'seats' }, [
        ce('h3', { key: 'h' }, 'Who is here'),
        ce(Roster, { key: 'r', room: room }),
        ce('div', { className: 'spp-row', key: 'pick', style: { marginTop: 10 } },
          ROLES.map(function (r) {
            return ce('button', {
              key: r.id, type: 'button', className: 'spp-btn',
              'aria-pressed': room.myRole === r.id ? 'true' : 'false',
              title: r.blurb,
              onClick: function () { setRole(r.id); }
            }, 'Take ' + r.label);
          }))
      ]),
      ce('div', { className: 'spp-card', key: 'run' }, [
        ce('h3', { key: 'h' }, 'The run'),
        ce('div', { className: 'spp-row', key: 'c' }, [
          ce('span', {
            key: 'clk', className: 'spp-clock' + (paused ? ' paused' : ''),
            'aria-live': 'off'
          }, clock),
          paused
            ? ce('span', { key: 'pb', className: 'spp-tag proctor' },
                'PAUSED by ' + (str(run.pausedByName) || 'a partner'))
            : null
        ]),
        ce('div', { className: 'spp-row', key: 'b', style: { marginTop: 10 } }, [
          !run.started
            ? ce('button', {
                key: 's', type: 'button', className: 'spp-btn go',
                onClick: function () { startRun(numOr(obj(room.cfg).durationSec, 20 * 60)); }
              }, 'Start the shared clock')
            : null,
          run.started && !run.ended
            ? ce('button', {
                key: 'p', type: 'button', className: 'spp-btn warn',
                onClick: function () { paused ? resumeRun() : pauseRun('asked for a moment'); }
              }, paused ? 'Resume for everybody' : 'Pause for everybody')
            : null,
          run.started && !run.ended
            ? ce('button', {
                key: 'e', type: 'button', className: 'spp-btn ghost',
                onClick: function () { endRun('called'); }
              }, 'End the run')
            : null,
          isFn(p.onNav)
            ? ce('button', {
                key: 'go', type: 'button', className: 'spp-btn',
                onClick: function () {
                  try { p.onNav(lower(obj(room.activity).kind) === 'sim' ? 'simprep-sim' : 'simprep'); }
                  catch (e) {}
                }
              }, 'Open ' + activityLabel(obj(room.activity).kind))
            : null
        ]),
        ce('p', { className: 'spp-sub', key: 'n', style: { marginTop: 8 } },
          'Anybody in the room can pause. The clock is derived from the room\'s own ' +
          'timestamps, not from your phone, so it reads the same on both screens even if ' +
          'your clocks disagree.')
      ]),
      ce('div', { className: 'spp-card', key: 'log' }, [
        ce('h3', { key: 'h' }, 'Shared log'),
        arr(room.log).length
          ? ce('ul', { className: 'spp-log', key: 'u' },
              arr(room.log).slice(-40).reverse().map(function (l) {
                return ce('li', { key: l.key, className: str(l.kind) }, [
                  ce('span', { key: 't', className: 't' }, fmtClock(numOr(l.atSec, 0))),
                  ce('span', { key: 'x' }, str(l.text)),
                  str(l.detail) ? ce('span', { key: 'd', className: 'd' }, str(l.detail)) : null
                ]);
              }))
          : ce('div', { className: 'spp-empty', key: 'e' },
              'Nothing has happened yet. Everything either of you does lands here, in order, ' +
              'with the time it happened.')
      ])
    ]);
  }

  /* ==========================================================================
   * 13. EXPORTS
   * The pure half hangs off the component so it can be unit tested without
   * React and so a future debrief screen can replay a room from its event log.
   * ======================================================================== */

  SimPrepPartner.api = API;
  SimPrepPartner.SignedOut = SignedOut;
  SimPrepPartner.Roster = Roster;
  SimPrepPartner.Seat = Seat;

  /* room model */
  SimPrepPartner.initialShared = initialShared;
  SimPrepPartner.applyEvent = applyEvent;
  SimPrepPartner.foldEvents = foldEvents;
  SimPrepPartner.mergeMark = mergeMark;
  SimPrepPartner.elapsedMs = elapsedMs;
  SimPrepPartner.elapsedSec = elapsedSec;
  SimPrepPartner.remainingSec = remainingSec;
  SimPrepPartner.expired = expired;
  SimPrepPartner.atSecOf = atSecOf;
  SimPrepPartner.visibleAnswers = visibleAnswers;
  SimPrepPartner.readyToReveal = readyToReveal;
  SimPrepPartner.activityLabel = activityLabel;
  SimPrepPartner.EVENTS = EV;
  SimPrepPartner.normVerdict = normVerdict;

  /* roles */
  SimPrepPartner.ROLES = ROLES;
  SimPrepPartner.roleMeta = roleMeta;
  SimPrepPartner.roleWeight = roleWeight;
  SimPrepPartner.canMarkRubric = canMarkRubric;
  SimPrepPartner.swapMap = swapMap;

  /* rooms */
  SimPrepPartner.ROOM_BASE = ROOM_BASE;
  SimPrepPartner.ROOM_RULES = ROOM_RULES;
  SimPrepPartner.ROOM_STATUS_OPEN = ROOM_STATUS_OPEN;
  SimPrepPartner.ROOM_STATUS_LIVE = ROOM_STATUS_LIVE;
  SimPrepPartner.ROOM_STATUS_DONE = ROOM_STATUS_DONE;
  SimPrepPartner.FOREIGN_STATUSES = FOREIGN_STATUSES;
  SimPrepPartner.ROOM_STALE_MS = ROOM_STALE_MS;
  SimPrepPartner.CODE_ALPHABET = CODE_ALPHABET;
  SimPrepPartner.randCode = randCode;
  SimPrepPartner.normalizeCode = normalizeCode;
  SimPrepPartner.electHost = electHost;
  SimPrepPartner.hostIsStale = hostIsStale;
  SimPrepPartner.isAlive = isAlive;
  SimPrepPartner.discoverTopics = discoverTopics;
  SimPrepPartner.HOST_GRACE_MS = HOST_GRACE_MS;
  SimPrepPartner.PRESENCE_MS = PRESENCE_MS;
  SimPrepPartner.STALE_PLAYER_MS = STALE_PLAYER_MS;

  /* shared time */
  SimPrepPartner.sharedNow = sharedNow;
  SimPrepPartner.serverOffset = serverOffset;
  SimPrepPartner.bindServerOffset = bindServerOffset;

  /* pause - the same names sim-engine, ai-scenario, codeblue and ms2lab use */
  SimPrepPartner.pause = partnerPause.pauseRun;
  SimPrepPartner.resume = partnerPause.resumeRun;
  SimPrepPartner.togglePause = partnerPause.togglePauseRun;
  SimPrepPartner.isPaused = partnerPause.isRunPaused;
  SimPrepPartner.canPause = partnerPause.canPauseRun;
  SimPrepPartner.onPauseChange = partnerPause.onPauseChange;
  SimPrepPartner.pauseStats = partnerPause.pauseStats;
  SimPrepPartner.pauseControl = partnerPause.pauseControl;
  SimPrepPartner.pauseRun = partnerPause.pauseRun;
  SimPrepPartner.resumeRun = partnerPause.resumeRun;
  SimPrepPartner.togglePauseRun = partnerPause.togglePauseRun;
  SimPrepPartner.isRunPaused = partnerPause.isRunPaused;
  SimPrepPartner.canPauseRun = partnerPause.canPauseRun;

  window.SimPrepPartner = SimPrepPartner;
  window.SimPrepPartnerLobby = SimPrepPartner;
})();
