/* =============================================================================
 * MedMaster - Community Layer
 * js/community.js
 *
 * Exports (window):
 *   CommunityHub            top-level page (tabbed)
 *   CommunityQuestionBank   browse / search / submit / practice community Qs
 *   CommunityScenarioWorkshop  guided scenario builder + publish + fork
 *   CommunityDiscussion     threaded comments for ANY target id (embeddable)
 *   CommunityDiscussionBoard standalone topic threads + Help Wanted board
 *   CommunityStudyGroups    groups, goals, shared deck, sessions, progress board
 *   CommunityDecks          shared decks, importable into FlashcardHub
 *   CommunityLeaderboards   5 boards, weekly + all-time, encouraging framing
 *   CommunityModeration     admin report queue / feature / remove / ban
 *   CommunityActivityFeed   community activity stream
 *   CommunityNotifications  bell + dropdown (replies, mentions, badges)
 *   CommunityBadge          badge chip, reusable anywhere in the app
 *   CommunityAPI            non-React helpers (scenario handoff to SimulationHub,
 *                           recordActivity, notify, badge computation)
 *
 * Firebase nodes used (all under /community except /bannedUsers):
 *   /community/questions/{id}                 .indexOn ["createdAt","score","commentCount","authorId","category"]
 *   /community/scenarios/{id}                 .indexOn ["createdAt","score","commentCount","authorId","category"]
 *   /community/comments/{targetId}/{cid}      .indexOn ["createdAt","score","parentId"]
 *   /community/threads/{id}                   .indexOn ["createdAt","score","commentCount","helpWanted","authorId"]
 *   /community/votes/{targetId}/{uid}         value -1 | 1
 *   /community/studyGroups/{id}               .indexOn ["createdAt","visibility","inviteCode"]
 *   /community/studyGroups/{id}/members/{uid}
 *   /community/studyGroups/{id}/sessions/{sid}  .indexOn ["at"]
 *   /community/studyGroups/{id}/deck/{itemId}   .indexOn ["addedAt"]
 *   /community/decks/{id}                     .indexOn ["createdAt","score","importCount"]
 *   /community/reports/{id}                   .indexOn ["createdAt","status"]
 *   /community/notifications/{uid}/{nid}      .indexOn ["createdAt","read"]
 *   /community/activity/{id}                  .indexOn ["createdAt"]
 *   /community/profiles/{uid}                 .indexOn ["nameLower","joinedAt"]
 *   /community/stats/{uid}                    .indexOn ["updatedAt"]
 *   /community/moderationLog/{id}             .indexOn ["createdAt","targetId"]
 *   /bannedUsers/{uid}                        (pre-existing node, read-only here)
 *
 * See _staging/community-firebase-rules.json for the matching rules + indexes.
 *
 * HARD RULES followed here:
 *   - No JSX, no ES modules, no optional chaining / nullish coalescing.
 *   - No innerHTML / dangerouslySetInnerHTML with user content. Every piece of
 *     user text is rendered as a React text child (React escapes it).
 *   - Every list is bounded: limitToLast + explicit "Load more".
 * ========================================================================== */
(function () {
  'use strict';

  var ce = React.createElement;
  var useState = React.useState, useEffect = React.useEffect,
      useRef = React.useRef, useMemo = React.useMemo,
      useCallback = React.useCallback;

  /* ======================================================= CONSTANTS ===== */

  var P = {
    questions: 'community/questions',
    scenarios: 'community/scenarios',
    comments:  'community/comments',
    votes:     'community/votes',
    groups:    'community/studyGroups',
    decks:     'community/decks',
    reports:   'community/reports',
    notifs:    'community/notifications',
    activity:  'community/activity',
    profiles:  'community/profiles',
    stats:     'community/stats',
    modLog:    'community/moderationLog',
    banned:    'bannedUsers'
  };

  var PAGE = 12;

  var LIMIT = {
    title: 120, qtext: 600, option: 240, rationale: 1600, summary: 300,
    comment: 4000, name: 60, desc: 400, topic: 40, source: 200, goal: 120,
    reason: 300, note: 500
  };

  var CATEGORIES = ['Med-Surg 2', 'OB', 'PEDS', 'Pharmacology', 'Med Math',
                    'Fundamentals', 'Mental Health', 'Leadership', 'Other'];
  var DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

  // Client-side rate limits. Server rules cap payload size; these stop
  // accidental spam and give a human error message instead of a silent fail.
  var RATE = {
    normal:   { minGapMs: 20 * 1000, perHour: 12 },
    newUser:  { minGapMs: 90 * 1000, perHour: 4 },   // account younger than NEW_ACCOUNT_MS
    comment:  { minGapMs: 6 * 1000,  perHour: 40 },
    newComment:{ minGapMs: 25 * 1000, perHour: 12 }
  };
  var NEW_ACCOUNT_MS = 3 * 24 * 60 * 60 * 1000;

  /* ======================================================= BADGES ======== */
  /* Earned for real contribution, not for showing up. Each badge renders as
     icon + TEXT LABEL so meaning is never carried by color/emoji alone. */

  var BADGES = [
    { id:'first-question',  icon:'✦', label:'First Question',   tone:'blue',
      desc:'Submitted your first practice question.',
      test:function(s){ return s.questions >= 1; } },
    { id:'ten-questions',   icon:'✎', label:'Question Builder', tone:'blue',
      desc:'Contributed 10 practice questions.',
      test:function(s){ return s.questions >= 10; } },
    { id:'fifty-questions', icon:'☗', label:'Question Machine', tone:'purple',
      desc:'Contributed 50 practice questions.',
      test:function(s){ return s.questions >= 50; } },
    { id:'crowd-favorite',  icon:'★', label:'Crowd Favorite',   tone:'orange',
      desc:'One of your questions reached 25 upvotes.',
      test:function(s){ return s.bestQuestionScore >= 25; } },
    { id:'first-scenario',  icon:'⚕', label:'Scenario Author',  tone:'green',
      desc:'Published your first clinical scenario.',
      test:function(s){ return s.scenarios >= 1; } },
    { id:'five-scenarios',  icon:'⚙', label:'Scenario Architect', tone:'purple',
      desc:'Published 5 clinical scenarios.',
      test:function(s){ return s.scenarios >= 5; } },
    { id:'first-answer',    icon:'↩', label:'First Responder',  tone:'blue',
      desc:'Answered a classmate for the first time.',
      test:function(s){ return s.answers >= 1; } },
    { id:'helpful-10',      icon:'☺', label:'Helping Hand',     tone:'green',
      desc:'Earned 10 upvotes on your answers.',
      test:function(s){ return s.helpfulVotes >= 10; } },
    { id:'helpful-50',      icon:'❤', label:'Peer Mentor',      tone:'orange',
      desc:'Earned 50 upvotes on your answers.',
      test:function(s){ return s.helpfulVotes >= 50; } },
    { id:'best-answer-5',   icon:'✓', label:'Problem Solver',   tone:'green',
      desc:'5 of your answers were marked best answer.',
      test:function(s){ return s.bestAnswers >= 5; } },
    { id:'help-wanted-10',  icon:'⛑', label:'Rescue Squad',     tone:'orange',
      desc:'Answered 10 Help Wanted threads.',
      test:function(s){ return s.helpWantedAnswers >= 10; } },
    { id:'streak-7',        icon:'◔', label:'Week Strong',      tone:'blue',
      desc:'7 day study streak.',
      test:function(s){ return s.streak >= 7; } },
    { id:'streak-30',       icon:'●', label:'Iron Streak',      tone:'purple',
      desc:'30 day study streak.',
      test:function(s){ return s.streak >= 30; } },
    { id:'sim-10',          icon:'⚑', label:'Sim Veteran',      tone:'blue',
      desc:'Completed 10 simulations.',
      test:function(s){ return s.sims >= 10; } },
    { id:'med-admin-master',icon:'✠', label:'Med Admin Master', tone:'green',
      desc:'90% or better med administration mastery.',
      test:function(s){ return s.medAdminPct >= 90; } },
    { id:'deck-published',  icon:'⌸', label:'Deck Dealer',      tone:'blue',
      desc:'Published a shared deck.',
      test:function(s){ return s.decks >= 1; } },
    { id:'deck-popular',    icon:'⇩', label:'Widely Studied',   tone:'orange',
      desc:'A deck of yours was imported 25 times.',
      test:function(s){ return s.bestDeckImports >= 25; } },
    { id:'group-founder',   icon:'◈', label:'Group Founder',    tone:'purple',
      desc:'Started a study group.',
      test:function(s){ return s.groupsFounded >= 1; } },
    { id:'instructor-pick', icon:'☆', label:'Instructor Pick',  tone:'orange',
      desc:'Had content featured by an instructor.',
      test:function(s){ return s.featured >= 1; } }
  ];

  var BADGE_BY_ID = {};
  BADGES.forEach(function (b) { BADGE_BY_ID[b.id] = b; });

  function emptyStats() {
    return { questions:0, scenarios:0, answers:0, helpfulVotes:0, bestAnswers:0,
             helpWantedAnswers:0, streak:0, sims:0, medAdminPct:0, decks:0,
             bestDeckImports:0, groupsFounded:0, featured:0, bestQuestionScore:0 };
  }

  function computeBadges(stats) {
    var s = merge(emptyStats(), stats || {});
    var out = [];
    BADGES.forEach(function (b) { if (b.test(s)) out.push(b.id); });
    return out;
  }

  /* ======================================================= UTILS ========= */

  function merge(a, b) {
    var o = {}, k;
    if (a) { for (k in a) { if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k]; } }
    if (b) { for (k in b) { if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k]; } }
    return o;
  }

  function now() { return Date.now(); }

  /** Normalize + hard-cap any user supplied string before it is stored.
   *  Strips control characters, normalizes newlines, collapses runaway blank
   *  lines and truncates. Rendering is still done as React text children. */
  function clean(v, max) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    s = s.replace(/\r\n?/g, '\n');
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    s = s.replace(/\n{4,}/g, '\n\n\n');
    s = s.replace(/[ \t]{6,}/g, '     ');
    s = s.trim();
    if (max && s.length > max) s = s.slice(0, max);
    return s;
  }

  function num(v, d) {
    var n = parseFloat(v);
    return isFinite(n) ? n : (d || 0);
  }

  function timeAgo(ts) {
    if (!ts) return '';
    var d = Math.max(0, now() - ts);
    var m = Math.floor(d / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    var dy = Math.floor(h / 24);
    if (dy < 7) return dy + 'd ago';
    var w = Math.floor(dy / 7);
    if (w < 5) return w + 'w ago';
    return new Date(ts).toLocaleDateString();
  }

  function whenStr(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); }
    catch (e) { return String(ts); }
  }

  function weekKey(ts) {
    var d = new Date(ts || now());
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dayNum = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - dayNum + 3);
    var firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    var fDay = (firstThu.getUTCDay() + 6) % 7;
    firstThu.setUTCDate(firstThu.getUTCDate() - fDay + 3);
    var wk = 1 + Math.round((t - firstThu) / (7 * 24 * 3600 * 1000));
    return t.getUTCFullYear() + '-W' + (wk < 10 ? '0' + wk : wk);
  }

  function initials(name) {
    var s = clean(name, 40);
    if (!s) return '?';
    var parts = s.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function pluralize(n, one, many) {
    return n + ' ' + (n === 1 ? one : (many || (one + 's')));
  }

  function shuffleCopy(arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function newId(prefix) {
    return (prefix || 'c') + '_' + now().toString(36) + '_' +
           Math.random().toString(36).slice(2, 8);
  }

  function slug(s) {
    return clean(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-')
           .replace(/^-+|-+$/g, '') || 'scenario';
  }

  /* ======================================================= MM BRIDGE ===== */

  function MMx() { return window.MM || {}; }
  function getDb() { var m = MMx(); return m.db ? m.db : null; }
  function ref(path) { var d = getDb(); return d ? d.ref(path) : null; }
  function myId() { var m = MMx(); return m.myId || (m.authUser && m.authUser.uid) || ''; }
  function isAdmin() { var m = MMx(); return !!(m.isAdmin || m.isSuperAdmin); }
  function isSuperAdmin() { return !!MMx().isSuperAdmin; }

  function myName() {
    var m = MMx();
    var u = m.authUser;
    if (u) {
      if (u.displayName) return clean(u.displayName, LIMIT.name);
      if (u.email) return clean(String(u.email).split('@')[0], LIMIT.name);
    }
    return 'Student';
  }

  function accountCreatedAt() {
    var u = MMx().authUser;
    if (u && u.metadata && u.metadata.creationTime) {
      var t = Date.parse(u.metadata.creationTime);
      if (isFinite(t)) return t;
    }
    return 0;
  }

  function isNewAccount() {
    var c = accountCreatedAt();
    if (!c) return true; // unknown age -> treat conservatively
    return (now() - c) < NEW_ACCOUNT_MS;
  }

  function toast(msg, type) {
    var m = MMx();
    if (typeof m.toast === 'function') { m.toast(msg, type || 'info'); return; }
    if (type === 'error' && window.console) window.console.warn('[community] ' + msg);
  }

  /* The shell renders its sign-in screen whenever nobody is signed in, so a
     reload is a real (if blunt) route to it. Prefer a hook if one exists. */
  function requestSignIn() {
    var m = MMx();
    try { if (typeof m.signIn === 'function') { m.signIn(); return; } } catch (e) { /* ignore */ }
    try { if (typeof m.requestSignIn === 'function') { m.requestSignIn(); return; } } catch (e) { /* ignore */ }
    try { window.location.reload(); } catch (e) { /* ignore */ }
  }

  function reloadPage() {
    try { window.location.reload(); } catch (e) { /* ignore */ }
  }

  function svTime() {
    try {
      if (window.firebase && firebase.database && firebase.database.ServerValue) {
        return firebase.database.ServerValue.TIMESTAMP;
      }
    } catch (e) { /* ignore */ }
    return now();
  }

  /* ======================================================= FIREBASE ====== */

  function noDbError() {
    var e = new Error('Community needs a connection.');
    e.code = 'no-db';
    return e;
  }

  function snapToArray(snap) {
    var out = [];
    snap.forEach(function (ch) {
      var v = ch.val();
      if (v && typeof v === 'object') { v = merge(v, { _id: ch.key }); out.push(v); }
      else if (v !== null && v !== undefined) { out.push({ _id: ch.key, value: v }); }
    });
    return out;
  }

  /** Bounded page fetch. Never reads a whole node.
   *  cursor = the orderBy value of the last (lowest) row already seen. */
  function fetchPage(path, orderBy, pageSize, cursor) {
    var r = ref(path);
    if (!r) return Promise.reject(noDbError());
    var q = r.orderByChild(orderBy);
    if (cursor !== null && cursor !== undefined) q = q.endAt(cursor);
    q = q.limitToLast(pageSize);
    return q.once('value').then(function (snap) {
      var arr = snapToArray(snap);
      arr.reverse(); // highest orderBy value first
      return arr;
    });
  }

  function fetchOnce(path) {
    var r = ref(path);
    if (!r) return Promise.reject(noDbError());
    return r.once('value').then(function (s) { return s.val(); });
  }

  function writeAt(path, value) {
    var r = ref(path);
    if (!r) return Promise.reject(noDbError());
    return r.set(value);
  }

  function updateAt(path, value) {
    var r = ref(path);
    if (!r) return Promise.reject(noDbError());
    return r.update(value);
  }

  function pushAt(path, value) {
    var r = ref(path);
    if (!r) return Promise.reject(noDbError());
    var child = r.push();
    return child.set(value).then(function () { return child.key; });
  }

  function bumpCounter(path, delta) {
    var r = ref(path);
    if (!r) return Promise.reject(noDbError());
    return r.transaction(function (cur) { return num(cur, 0) + delta; });
  }

  /* --------------------------------------------------- paged list hook -- */

  function usePaged(cfg) {
    // cfg: { path, orderBy, pageSize, key, enabled, filter }
    var pageSize = cfg.pageSize || PAGE;
    var enabled = cfg.enabled !== false;
    var key = [cfg.path, cfg.orderBy, cfg.key || ''].join('|');

    var st = useState({ items: [], loading: enabled, error: null, done: false, more: false });
    var state = st[0], setState = st[1];
    var cursor = useRef(null);
    var seen = useRef({});
    var live = useRef(true);

    useEffect(function () { live.current = true; return function () { live.current = false; }; }, []);

    var run = useCallback(function (reset) {
      if (!enabled) { setState({ items: [], loading: false, error: null, done: true, more: false }); return; }
      if (reset) { cursor.current = null; seen.current = {}; }
      setState(function (s) { return merge(s, { loading: true, error: null }); });
      fetchPage(cfg.path, cfg.orderBy, pageSize, cursor.current).then(function (rows) {
        if (!live.current) return;
        var fresh = [];
        rows.forEach(function (r) {
          if (seen.current[r._id]) return;
          seen.current[r._id] = true;
          fresh.push(r);
        });
        if (rows.length) {
          var last = rows[rows.length - 1];
          cursor.current = last[cfg.orderBy];
          if (cursor.current === undefined) cursor.current = null;
        }
        var exhausted = rows.length < pageSize || fresh.length === 0;
        setState(function (s) {
          var items = reset ? fresh : s.items.concat(fresh);
          return { items: items, loading: false, error: null, done: exhausted, more: !exhausted };
        });
      })['catch'](function (err) {
        if (!live.current) return;
        setState(function (s) { return merge(s, { loading: false, error: err }); });
      });
    }, [key, pageSize, enabled]);

    useEffect(function () { run(true); }, [key, enabled]);

    var patch = useCallback(function (id, changes) {
      setState(function (s) {
        return merge(s, {
          items: s.items.map(function (it) {
            return it._id === id ? merge(it, typeof changes === 'function' ? changes(it) : changes) : it;
          })
        });
      });
    }, []);

    var prepend = useCallback(function (item) {
      seen.current[item._id] = true;
      setState(function (s) { return merge(s, { items: [item].concat(s.items) }); });
    }, []);

    var drop = useCallback(function (id) {
      setState(function (s) {
        return merge(s, { items: s.items.filter(function (it) { return it._id !== id; }) });
      });
    }, []);

    return {
      items: state.items, loading: state.loading, error: state.error,
      more: state.more, loadMore: function () { run(false); },
      reload: function () { run(true); }, patch: patch, prepend: prepend, drop: drop
    };
  }

  /* ---------------------------------------------------------- one shot -- */

  function useAsync(fn, deps, enabled) {
    var st = useState({ data: null, loading: enabled !== false, error: null });
    var state = st[0], setState = st[1];
    var live = useRef(true);
    useEffect(function () { live.current = true; return function () { live.current = false; }; }, []);
    useEffect(function () {
      if (enabled === false) { setState({ data: null, loading: false, error: null }); return; }
      setState({ data: null, loading: true, error: null });
      Promise.resolve().then(fn).then(function (d) {
        if (live.current) setState({ data: d, loading: false, error: null });
      })['catch'](function (e) {
        if (live.current) setState({ data: null, loading: false, error: e });
      });
    }, deps || []);
    return [state, setState];
  }

  /* ======================================================= RATE LIMIT ==== */

  /* Per-content-type gap (so a 15-minute scenario build is not blocked by the
     question you posted a minute ago) plus one shared hourly cap for all posts. */
  var postLog = { comment: [], all: [] };

  function prune(list) {
    var t = now();
    while (list.length && t - list[0] > 3600000) list.shift();
    return list;
  }

  function rateCheck(kind) {
    var isComment = kind === 'comment';
    var cfg = isComment ? (isNewAccount() ? RATE.newComment : RATE.comment)
                        : (isNewAccount() ? RATE.newUser : RATE.normal);
    if (!postLog[kind]) postLog[kind] = [];
    var bucket = prune(postLog[kind]);
    var pool = prune(isComment ? postLog.comment : postLog.all);
    var t = now();
    if (bucket.length && t - bucket[bucket.length - 1] < cfg.minGapMs) {
      var wait = Math.ceil((cfg.minGapMs - (t - bucket[bucket.length - 1])) / 1000);
      return 'Slow down a moment - you can post again in ' + wait + 's.';
    }
    if (pool.length >= cfg.perHour) {
      return isNewAccount()
        ? 'New accounts can post ' + cfg.perHour + ' times per hour. Thanks for understanding - it keeps the boards clean.'
        : 'You have hit the hourly posting limit (' + cfg.perHour + '). Try again shortly.';
    }
    return '';
  }

  function rateNote(kind) {
    if (!postLog[kind]) postLog[kind] = [];
    postLog[kind].push(now());
    if (kind !== 'comment') postLog.all.push(now());
  }

  /** Server-side sanity check: look at the author's most recent row's createdAt.
   *  Requires .indexOn ["authorId"] on the node. Resolves to '' if OK. */
  function serverRateCheck(path, minGapMs) {
    var r = ref(path);
    var uid = myId();
    if (!r || !uid) return Promise.resolve('');
    return r.orderByChild('authorId').equalTo(uid).limitToLast(1).once('value')
      .then(function (snap) {
        var last = 0;
        snap.forEach(function (ch) {
          var v = ch.val();
          if (v && v.createdAt && v.createdAt > last) last = v.createdAt;
        });
        if (last && (now() - last) < minGapMs) {
          var wait = Math.ceil((minGapMs - (now() - last)) / 1000);
          return 'You just posted. Please wait ' + wait + 's before posting again.';
        }
        return '';
      })['catch'](function () { return ''; }); // never block on a failed guard
  }

  /* ======================================================= GATE ========== */
  /** One hook that answers: can this person post right now, and if not, why? */

  function useCommunityGate() {
    var st = useState({ ready: false, banned: false, reason: '' });
    var gate = st[0], setGate = st[1];
    var uid = myId();
    var hasDb = !!getDb();

    useEffect(function () {
      var live = true;
      if (!hasDb || !uid) { setGate({ ready: true, banned: false, reason: '' }); return; }
      fetchOnce(P.banned + '/' + uid).then(function (v) {
        if (!live) return;
        if (v) {
          setGate({ ready: true, banned: true,
            reason: (v && v.reason) ? clean(v.reason, LIMIT.reason)
                                    : 'Your account is restricted from posting in the community.' });
        } else {
          setGate({ ready: true, banned: false, reason: '' });
        }
      })['catch'](function () { if (live) setGate({ ready: true, banned: false, reason: '' }); });
      return function () { live = false; };
    }, [uid, hasDb]);

    var signedIn = !!uid;
    return {
      ready: gate.ready,
      signedIn: signedIn,
      hasDb: hasDb,
      banned: gate.banned,
      banReason: gate.reason,
      canPost: signedIn && hasDb && !gate.banned,
      blockReason: !hasDb ? 'We cannot reach the server right now, so nothing can be saved. Everything else in MedMaster still works.'
                 : !signedIn ? 'Sign in first - everything here is posted under its author\'s name.'
                 : gate.banned ? gate.reason : ''
    };
  }

  /* ======================================================= ACTIVITY ====== */

  function recordActivity(type, detail) {
    if (!getDb() || !myId()) return Promise.resolve(null);
    var row = {
      type: clean(type, 40),
      text: clean(detail && detail.text ? detail.text : '', 200),
      targetType: clean(detail && detail.targetType ? detail.targetType : '', 24),
      targetId: clean(detail && detail.targetId ? detail.targetId : '', 80),
      actorId: myId(),
      actorName: myName(),
      createdAt: now()
    };
    return pushAt(P.activity, row)['catch'](function () { return null; });
  }

  function notify(uid, payload) {
    if (!getDb() || !uid || uid === myId()) return Promise.resolve(null);
    var row = {
      type: clean(payload.type, 32),
      text: clean(payload.text, 220),
      targetType: clean(payload.targetType || '', 24),
      targetId: clean(payload.targetId || '', 80),
      fromId: myId(),
      fromName: myName(),
      read: false,
      createdAt: now()
    };
    return pushAt(P.notifs + '/' + uid, row)['catch'](function () { return null; });
  }

  /* ======================================================= PROFILES ====== */

  var profileCache = { list: null, at: 0, byId: {} };

  function loadCohort() {
    if (profileCache.list && (now() - profileCache.at) < 120000) {
      return Promise.resolve(profileCache.list);
    }
    var r = ref(P.profiles);
    if (!r) return Promise.resolve([]);
    // Bounded: most recently active 150 profiles is plenty for a cohort app.
    return r.orderByChild('joinedAt').limitToLast(150).once('value').then(function (snap) {
      var arr = snapToArray(snap);
      profileCache.list = arr;
      profileCache.at = now();
      arr.forEach(function (p) { profileCache.byId[p._id] = p; });
      return arr;
    })['catch'](function () { return []; });
  }

  function ensureProfile() {
    var uid = myId();
    if (!getDb() || !uid) return Promise.resolve(null);
    var name = myName();
    return updateAt(P.profiles + '/' + uid, {
      name: name,
      nameLower: name.toLowerCase(),
      lastSeen: now()
    }).then(function () {
      return fetchOnce(P.profiles + '/' + uid + '/joinedAt').then(function (j) {
        if (!j) return updateAt(P.profiles + '/' + uid, { joinedAt: accountCreatedAt() || now() });
        return null;
      });
    })['catch'](function () { return null; });
  }

  /* ======================================================= STATS ========= */

  /** Roll the local progress object into the shared stats node so the
   *  leaderboards have something to sort. Bounded, once per session. */
  function syncMyStats() {
    var uid = myId();
    if (!getDb() || !uid) return Promise.resolve(null);
    var m = MMx();
    var prog = (typeof m.getProgress === 'function') ? (m.getProgress() || {}) : {};
    var sims = (prog.simResults || []).length;
    var med = prog.medAdminResults || [];
    var medPct = 0;
    if (med.length) {
      var best = 0;
      med.forEach(function (r) { if (num(r.pct) > best) best = num(r.pct); });
      medPct = Math.round(best);
    }
    var streak = num(prog.streak || prog.currentStreak || (prog.stats && prog.stats.streak), 0);
    var wk = weekKey();

    return fetchOnce(P.stats + '/' + uid).then(function (cur) {
      cur = cur || {};
      var patch = {
        name: myName(),
        streak: streak,
        sims: sims,
        medAdminPct: medPct,
        updatedAt: now()
      };
      if (cur.wk !== wk) {
        patch.wk = wk;
        patch.wkBase = { sims: sims, questions: num(cur.questions, 0),
                         answers: num(cur.answers, 0), helpfulVotes: num(cur.helpfulVotes, 0) };
      }
      return updateAt(P.stats + '/' + uid, patch);
    })['catch'](function () { return null; });
  }

  function bumpStat(field, delta) {
    var uid = myId();
    if (!getDb() || !uid) return Promise.resolve(null);
    return bumpCounter(P.stats + '/' + uid + '/' + field, delta).then(function () {
      return updateAt(P.stats + '/' + uid, { updatedAt: now(), name: myName() });
    })['catch'](function () { return null; });
  }

  function useMyBadges() {
    var uid = myId();
    var a = useAsync(function () {
      if (!getDb() || !uid) return null;
      return fetchOnce(P.stats + '/' + uid);
    }, [uid], !!(getDb() && uid));
    var stats = a[0].data || {};
    return computeBadges(stats);
  }

  /* Badge lookup for arbitrary authors, cached, bounded. */
  var badgeCache = {};
  function useAuthorBadges(uid) {
    var st = useState(badgeCache[uid] || null);
    var val = st[0], setVal = st[1];
    useEffect(function () {
      if (!uid || !getDb()) return;
      if (badgeCache[uid]) { setVal(badgeCache[uid]); return; }
      var live = true;
      fetchOnce(P.stats + '/' + uid).then(function (s) {
        var ids = computeBadges(s || {});
        badgeCache[uid] = ids;
        if (live) setVal(ids);
      })['catch'](function () { badgeCache[uid] = []; });
      return function () { live = false; };
    }, [uid]);
    return val || [];
  }

  /* ======================================================= VOTING ======== */

  /** Optimistic vote with rollback. Writes:
   *    /community/votes/{targetId}/{uid}  = 1 | -1  (per-uid, one cast)
   *    {contentPath}/score  transaction  (score child is world-writable by
   *                                       authed users in the rules)         */
  function castVote(opts) {
    // opts: { targetId, contentPath, dir, prev, authorId }
    var uid = myId();
    if (!uid || !getDb()) return Promise.reject(noDbError());
    var dir = opts.dir;
    var prev = num(opts.prev, 0);
    if (prev === dir) dir = 0; // toggling off = retract
    var delta = dir - prev;
    if (delta === 0) return Promise.resolve(0);

    var votePath = P.votes + '/' + opts.targetId + '/' + uid;
    var write = dir === 0 ? writeAt(votePath, null) : writeAt(votePath, dir);

    return write.then(function () {
      return bumpCounter(opts.contentPath + '/score', delta);
    }).then(function () {
      if (opts.authorId && opts.authorId !== uid && opts.helpful) {
        bumpStat('helpfulVotes', delta);
      }
      return dir;
    });
  }

  function useMyVotes(targetIds) {
    var key = targetIds.join(',');
    var st = useState({});
    var votes = st[0], setVotes = st[1];
    var uid = myId();
    useEffect(function () {
      if (!uid || !getDb() || !targetIds.length) return;
      var live = true;
      var pending = targetIds.slice(0, 40); // bounded
      Promise.all(pending.map(function (id) {
        return fetchOnce(P.votes + '/' + id + '/' + uid)
          .then(function (v) { return [id, num(v, 0)]; })['catch'](function () { return [id, 0]; });
      })).then(function (pairs) {
        if (!live) return;
        setVotes(function (cur) {
          var next = merge(cur, {});
          pairs.forEach(function (p) { next[p[0]] = p[1]; });
          return next;
        });
      });
      return function () { live = false; };
    }, [key, uid]);
    var setOne = useCallback(function (id, v) {
      setVotes(function (cur) { var n = merge(cur, {}); n[id] = v; return n; });
    }, []);
    return [votes, setOne];
  }

  /* ======================================================= RICH TEXT ===== */
  /* Supports: line breaks, **bold**, `code`, @mentions.
     Everything is emitted as React elements with TEXT children - user input is
     never handed to innerHTML or dangerouslySetInnerHTML anywhere in this file. */

  var INLINE_RE = /(\*\*[^*\n]{1,200}\*\*|`[^`\n]{1,200}`|@[A-Za-z0-9_.\-]{2,30})/g;

  function renderInline(line, keyBase) {
    var out = [];
    var last = 0, m, i = 0;
    INLINE_RE.lastIndex = 0;
    while ((m = INLINE_RE.exec(line)) !== null) {
      if (m.index > last) out.push(line.slice(last, m.index));
      var tok = m[0];
      if (tok.charAt(0) === '*') {
        out.push(ce('strong', { key: keyBase + '-b' + (i++), className: 'cm-b' }, tok.slice(2, -2)));
      } else if (tok.charAt(0) === '`') {
        out.push(ce('code', { key: keyBase + '-c' + (i++), className: 'cm-code' }, tok.slice(1, -1)));
      } else {
        out.push(ce('span', { key: keyBase + '-m' + (i++), className: 'cm-mention' }, tok));
      }
      last = m.index + tok.length;
    }
    if (last < line.length) out.push(line.slice(last));
    return out;
  }

  function RichText(props) {
    var text = clean(props.text, props.max || LIMIT.comment);
    if (!text) return null;
    var lines = text.split('\n');
    return ce('div', { className: 'cm-rich ' + (props.className || '') },
      lines.map(function (ln, i) {
        if (!ln) return ce('div', { key: 'e' + i, className: 'cm-rich-gap' });
        return ce('p', { key: 'l' + i }, renderInline(ln, 'l' + i));
      })
    );
  }

  /* ======================================================= AI ============ */

  function aiAvailable() {
    var m = MMx();
    try { return !!(m.ai && typeof m.ai.isAvailable === 'function' && m.ai.isAvailable()); }
    catch (e) { return false; }
  }

  /* ----------------------------------------------------------------------
   * "CHECKING YOUR PLAN"
   * MM.ai.isResolving() is true until Firebase has answered with this
   * member's tier. Until then aiAvailable() is a guess, and the builder must
   * not tell anyone AI assist is off for their account off the back of it.
   * Feature-detected: without isResolving nothing changes.
   * -------------------------------------------------------------------- */
  function aiResolving() {
    var m = MMx();
    try { return !!(m.ai && typeof m.ai.isResolving === 'function' && m.ai.isResolving()); }
    catch (e) { return false; }
  }

  function useAiResolving() {
    var st = useState(aiResolving);
    var resolving = st[0], setResolving = st[1];
    useEffect(function () {
      if (!resolving) return undefined;
      var m = MMx();
      if (!m.ai || typeof m.ai.onResolved !== 'function') { setResolving(false); return undefined; }
      var off = m.ai.onResolved(function () { setResolving(false); });
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

  /** A disabled twin of the button that is about to appear. Same footprint. */
  function CheckingButton(props) {
    ensureCheckingStyles();
    var p = props || {};
    return ce('button', {
      type: 'button', className: p.className || 'btn btn-outline',
      disabled: true, 'aria-busy': 'true',
      style: { opacity: 0.5, cursor: 'default' }
    }, p.label || 'Checking your plan...');
  }

  function aiChat(cfg) {
    var m = MMx();
    if (!m.ai || typeof m.ai.chat !== 'function') {
      var e = new Error('AI is not available right now.');
      e.code = 'ai-disabled';
      return Promise.reject(e);
    }
    return m.ai.chat(cfg);
  }

  /* ai.js fills e.message with a generic sentence when it has nothing better,
     but when the BACKEND diagnosed the problem ("the account funding this is
     out of credits", "that model does not exist") the real explanation arrives
     on e.message too. Show that whenever it is not one of the generics - it is
     the difference between a student blaming themselves and knowing to wait.
     (DR09 MAJOR #5) */
  var AI_GENERIC_MSG = {
    'Sign in to use the AI tutor.': 1,
    'That model is not included in your plan.': 1,
    'You have used all of your AI messages for today.': 1,
    'AI features are turned off right now.': 1,
    'Could not reach the AI service. Check your connection.': 1,
    'Something went wrong on our end. Try again in a moment.': 1,
    'AI is not available right now.': 1
  };

  function aiErrorMessage(err) {
    var code = err && err.code ? String(err.code) : '';
    var raw = (err && err.message) ? String(err.message) : '';
    if (raw && !AI_GENERIC_MSG[raw]) return raw;
    if (code === 'no-auth') return 'Sign in to use AI assist.';
    if (code === 'tier-denied') return 'AI assist is not included in your plan yet.';
    if (code === 'quota-exceeded') return 'You have used today’s AI allowance. It resets at midnight Eastern.';
    if (code === 'ai-disabled') return 'AI assist is turned off right now. Everything else in the builder works.';
    if (code === 'network') return 'Network hiccup - check your connection and try again. Nothing you typed is lost.';
    return 'The AI service had a problem. Try again in a minute - this one is not on you.';
  }

  /** Pull the first JSON object/array out of a model response. */
  function extractJson(text) {
    if (!text) return null;
    var s = String(text);
    var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1];
    var start = s.search(/[[{]/);
    if (start < 0) return null;
    var open = s.charAt(start), close = open === '{' ? '}' : ']';
    var depth = 0, inStr = false, escNext = false, i, end = -1;
    for (i = start; i < s.length; i++) {
      var c = s.charAt(i);
      if (escNext) { escNext = false; continue; }
      if (c === '\\') { escNext = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === open) depth++;
      else if (c === close) { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) return null;
    try { return JSON.parse(s.slice(start, end + 1)); }
    catch (e) { return null; }
  }

  /* ======================================================= STYLES ======== */

  if (!document.getElementById('community-styles')) {
    var st = document.createElement('style');
    st.id = 'community-styles';
    st.textContent = [
      '.cm-wrap{max-width:100%;}',
      '.cm-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}',
      '.cm-head{display:flex;align-items:flex-start;gap:var(--sp-3,12px);flex-wrap:wrap;margin-bottom:var(--sp-4,16px);}',
      '.cm-head h2{font-size:var(--fs-xl,22px);margin:0 0 2px;}',
      '.cm-sub{color:var(--text2);font-size:var(--fs-base,14px);line-height:var(--lh-normal,1.5);margin:0;}',
      '.cm-spacer{flex:1 1 auto;}',

      /* SECTION NAVIGATION — round pills. Only ever used for "which page am I
         on". Sorting and filtering use .cm-seg below so the two cannot be
         confused for each other. (DR05 MAJOR-6) */
      '.cm-tabs{display:flex;gap:var(--sp-2,8px);overflow-x:auto;padding:var(--sp-1,4px) 2px var(--sp-3,12px);margin-bottom:var(--sp-2,8px);scrollbar-width:thin;scroll-snap-type:x proximity;',
      '-webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 24px),transparent 100%);',
      'mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 24px),transparent 100%);}',
      '.cm-tab{flex:0 0 auto;scroll-snap-align:start;display:inline-flex;align-items:center;gap:var(--sp-1,4px);min-height:44px;padding:var(--sp-2,8px) var(--sp-4,16px);border-radius:var(--r-full,999px);border:1px solid var(--border,#334155);background:transparent;color:var(--text2);font-size:var(--fs-sm,13px);font-weight:var(--fw-semi,600);cursor:pointer;transition:background var(--dur-base,.2s),color var(--dur-base,.2s),border-color var(--dur-base,.2s),transform var(--dur-fast,.12s);white-space:nowrap;}',
      '.cm-tab:hover{color:var(--text);border-color:var(--accent);}',
      '.cm-tab:active{transform:scale(.975);}',
      '.cm-tab[aria-selected="true"],.cm-tab[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff;}',
      '.cm-tab .cm-tab-count{opacity:.85;font-weight:var(--fw-bold,700);margin-left:var(--sp-1,4px);}',
      /* a tab that leads nowhere says so before you tap it */
      '.cm-tab-empty{opacity:.6;}',
      '.cm-tab-empty .cm-tab-count{background:transparent;color:var(--text3);font-weight:var(--fw-semi,600);}',
      '.cm-tab-empty[aria-selected="true"]{opacity:1;}',
      '.cm-tab-empty[aria-selected="true"] .cm-tab-count{color:#fff;}',

      /* SORT / FILTER — a segmented control. Square, grouped, quieter than a
         pill, and always introduced by a label so its job is unambiguous. */
      '.cm-segwrap{display:flex;align-items:center;gap:var(--sp-2,8px);flex-wrap:wrap;margin-bottom:var(--sp-3,12px);}',
      '.cm-seglab{font-size:var(--fs-2xs,11px);font-weight:var(--fw-bold,700);color:var(--text3);text-transform:uppercase;letter-spacing:.6px;}',
      '.cm-seg{display:inline-flex;border:1px solid var(--border,#334155);background:var(--surface);border-radius:var(--r-md,10px);padding:2px;overflow:hidden;max-width:100%;overflow-x:auto;scrollbar-width:thin;}',
      '.cm-segbtn{flex:0 0 auto;min-height:40px;padding:var(--sp-2,8px) var(--sp-3,12px);border:none;background:transparent;color:var(--text2);font-size:var(--fs-sm,13px);font-weight:var(--fw-semi,600);cursor:pointer;border-radius:var(--r-sm,6px);white-space:nowrap;transition:background var(--dur-fast,.12s),color var(--dur-fast,.12s);}',
      '.cm-segbtn:hover{color:var(--text);background:var(--surface3,#334155);}',
      '.cm-segbtn:active{transform:scale(.975);}',
      '.cm-segbtn[aria-pressed="true"]{background:var(--surface3,#334155);color:var(--text);box-shadow:var(--el-1,0 1px 3px rgba(0,0,0,0.30));}',

      /* focus */
      '.cm-wrap button:focus-visible,.cm-wrap a:focus-visible,.cm-wrap input:focus-visible,.cm-wrap textarea:focus-visible,.cm-wrap select:focus-visible,.cm-wrap [tabindex]:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:var(--r-sm,6px);}',
      '.cm-wrap input:focus,.cm-wrap textarea:focus,.cm-wrap select:focus{border-color:var(--accent);}',

      /* toolbar */
      '.cm-toolbar{display:flex;gap:var(--sp-2,8px);flex-wrap:wrap;align-items:center;margin-bottom:var(--sp-4,16px);}',
      '.cm-toolbar>*{min-width:0;}',
      '.cm-search{flex:1 1 200px;}',
      /* 16px floor: anything smaller and iOS Safari zooms the page on focus and
         never zooms back out. (DR06 CRITICAL #2) */
      '.cm-input,.cm-textarea,.cm-select{background:var(--bg);border:2px solid var(--border,#334155);border-radius:var(--r-sm,6px);padding:var(--sp-3,12px);color:var(--text);font-size:var(--fs-md,16px);width:100%;font-family:inherit;outline:none;transition:border-color var(--dur-base,.2s);min-height:44px;}',
      '.cm-textarea{resize:vertical;min-height:88px;line-height:var(--lh-normal,1.5);}',
      '.cm-select{cursor:pointer;}',
      '.cm-input::placeholder,.cm-textarea::placeholder{color:var(--text3);}',

      /* fields */
      '.cm-field{margin-bottom:var(--sp-4,16px);}',
      '.cm-label{display:block;font-size:var(--fs-xs,12px);font-weight:var(--fw-bold,700);color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:var(--sp-2,8px);}',
      '.cm-label .cm-req{color:var(--orange-fg,#fbbf24);margin-left:var(--sp-1,4px);}',
      '.cm-hint{font-size:var(--fs-sm,13px);color:var(--text3);margin-top:var(--sp-1,4px);line-height:var(--lh-normal,1.5);}',
      '.cm-err{font-size:var(--fs-sm,13px);color:var(--red-fg,#f87171);margin-top:var(--sp-1,4px);display:flex;gap:var(--sp-2,8px);align-items:flex-start;font-weight:var(--fw-semi,600);}',
      '.cm-count{font-size:var(--fs-2xs,11px);color:var(--text3);float:right;font-weight:var(--fw-semi,600);letter-spacing:0;text-transform:none;}',
      '.cm-count.over{color:var(--red-fg,#f87171);}',

      /* items */
      '.cm-list{display:flex;flex-direction:column;gap:var(--sp-3,12px);}',
      '.cm-item{background:var(--surface);border:1px solid var(--border,#334155);border-radius:var(--r-lg,14px);padding:var(--sp-4,16px);display:flex;gap:var(--sp-3,12px);align-items:flex-start;}',
      '.cm-item>.cm-item-main{min-width:0;}',
      '.cm-item.cm-clickable{cursor:pointer;transition:border-color var(--dur-base,.2s),transform var(--dur-fast,.12s);}',
      '.cm-item.cm-clickable:hover{border-color:var(--accent);}',
      '.cm-item.cm-clickable:active{transform:scale(.99);}',
      '.cm-item-main{flex:1 1 auto;min-width:0;}',
      '.cm-item-title{font-size:var(--fs-md,16px);font-weight:var(--fw-bold,700);line-height:var(--lh-snug,1.35);margin:0 0 var(--sp-2,8px);word-break:break-word;}',
      '.cm-item-text{color:var(--text);font-size:var(--fs-md,16px);line-height:var(--lh-body,1.65);word-break:break-word;}',
      '.cm-item-foot{display:flex;gap:var(--sp-3,12px);flex-wrap:wrap;align-items:center;margin-top:var(--sp-3,12px);font-size:var(--fs-sm,13px);color:var(--text3);}',
      '.cm-featured{border-color:var(--orange);box-shadow:inset 3px 0 0 var(--orange);}',
      '.cm-flag{display:inline-flex;align-items:center;gap:var(--sp-1,4px);font-size:var(--fs-2xs,11px);font-weight:var(--fw-black,800);text-transform:uppercase;letter-spacing:.6px;padding:3px var(--sp-2,8px);border-radius:var(--r-full,999px);border:1px solid currentColor;}',
      '.cm-flag.pick{color:var(--orange-fg,#fbbf24);}',
      '.cm-flag.help{color:var(--red-fg,#f87171);}',
      '.cm-flag.ai{color:var(--accent2-fg,#a78bfa);}',
      '.cm-flag.mine{color:var(--accent-fg,#60a5fa);}',
      '.cm-removed{opacity:.75;border-style:dashed;}',
      '.cm-removed-note{background:var(--bg);border-left:3px solid var(--red);padding:var(--sp-3,12px);border-radius:var(--r-sm,6px);font-size:var(--fs-base,14px);color:var(--text2);margin-top:var(--sp-3,12px);}',

      /* votes — 44x40 each, because they used to be 34x28 stacked 2px apart */
      '.cm-vote{display:flex;flex-direction:column;align-items:center;gap:2px;flex:0 0 auto;width:46px;}',
      '.cm-vote-btn{background:transparent;border:1px solid transparent;border-radius:var(--r-sm,6px);color:var(--text3);cursor:pointer;width:44px;height:40px;font-size:var(--fs-md,16px);line-height:1;display:flex;align-items:center;justify-content:center;transition:background var(--dur-fast,.12s),color var(--dur-fast,.12s),transform var(--dur-fast,.12s);}',
      '.cm-vote-btn:hover{background:var(--surface3,#334155);color:var(--text);}',
      '.cm-vote-btn:active{transform:scale(.9);}',
      '.cm-vote-btn[aria-pressed="true"].up{color:var(--green-fg,#4ade80);border-color:var(--green);}',
      '.cm-vote-btn[aria-pressed="true"].down{color:var(--red-fg,#f87171);border-color:var(--red);}',
      '.cm-vote-btn:disabled{opacity:.45;cursor:not-allowed;}',
      '.cm-score{font-size:var(--fs-base,14px);font-weight:var(--fw-black,800);color:var(--text);}',
      '.cm-score.pos{color:var(--green-fg,#4ade80);}',
      '.cm-score.neg{color:var(--red-fg,#f87171);}',

      /* author + badges */
      '.cm-author{display:inline-flex;align-items:center;gap:var(--sp-2,8px);min-width:0;}',
      '.cm-avatar{width:24px;height:24px;border-radius:var(--r-full,999px);background:var(--surface3,#334155);color:var(--text);font-size:var(--fs-2xs,11px);font-weight:var(--fw-black,800);display:flex;align-items:center;justify-content:center;flex:0 0 auto;letter-spacing:.3px;}',
      '.cm-name{font-weight:var(--fw-bold,700);color:var(--text2);font-size:var(--fs-sm,13px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;}',
      '.cm-badge{display:inline-flex;align-items:center;gap:var(--sp-1,4px);font-size:var(--fs-2xs,11px);font-weight:var(--fw-black,800);padding:2px var(--sp-2,8px);border-radius:var(--r-full,999px);border:1px solid var(--border,#334155);color:var(--text2);background:var(--bg);white-space:nowrap;}',
      '.cm-badge.blue{color:var(--accent-fg,#60a5fa);border-color:var(--accent);}',
      '.cm-badge.green{color:var(--green-fg,#4ade80);border-color:var(--green);}',
      '.cm-badge.orange{color:var(--orange-fg,#fbbf24);border-color:var(--orange);}',
      '.cm-badge.purple{color:var(--accent2-fg,#a78bfa);border-color:var(--accent2);}',
      '.cm-badge-ico{font-size:var(--fs-sm,13px);line-height:1;}',
      '.cm-badge-row{display:flex;gap:var(--sp-2,8px);flex-wrap:wrap;}',

      /* chips */
      '.cm-chip{display:inline-block;padding:3px var(--sp-3,12px);border-radius:var(--r-full,999px);font-size:var(--fs-2xs,11px);font-weight:var(--fw-bold,700);background:var(--bg);color:var(--text2);border:1px solid var(--border,#334155);}',
      '.cm-chip.easy{color:var(--green-fg,#4ade80);border-color:var(--green);}',
      '.cm-chip.medium{color:var(--orange-fg,#fbbf24);border-color:var(--orange);}',
      '.cm-chip.hard{color:var(--red-fg,#f87171);border-color:var(--red);}',
      '.cm-chip-row{display:flex;gap:var(--sp-2,8px);flex-wrap:wrap;align-items:center;}',

      /* empty / status */
      '.cm-empty{background:var(--surface);border:1px dashed var(--border-str,#475569);border-radius:var(--r-lg,14px);padding:var(--sp-8,32px) var(--sp-5,20px);text-align:center;}',
      '.cm-empty-ico{font-size:2rem;line-height:1;margin-bottom:var(--sp-3,12px);color:var(--accent-fg,#60a5fa);}',
      '.cm-empty-title{font-size:var(--fs-lg,19px);font-weight:var(--fw-black,800);margin-bottom:var(--sp-2,8px);}',
      '.cm-empty-text{color:var(--text2);font-size:var(--fs-md,16px);line-height:var(--lh-body,1.65);max-width:46ch;margin:0 auto var(--sp-4,16px);}',
      '.cm-empty-actions{display:flex;gap:var(--sp-2,8px);justify-content:center;flex-wrap:wrap;}',
      '.cm-empty-tips{text-align:left;max-width:46ch;margin:var(--sp-4,16px) auto 0;color:var(--text3);font-size:var(--fs-base,14px);line-height:var(--lh-body,1.65);}',
      '.cm-empty-tips li{margin-bottom:var(--sp-1,4px);}',
      '.cm-status{display:flex;align-items:center;gap:var(--sp-3,12px);justify-content:center;padding:var(--sp-5,20px);color:var(--text2);font-size:var(--fs-base,14px);}',
      '.cm-spin{width:18px;height:18px;border-radius:var(--r-full,999px);border:2px solid var(--surface3,#334155);border-top-color:var(--accent);animation:cmspin .8s linear infinite;flex:0 0 auto;}',
      '@keyframes cmspin{to{transform:rotate(360deg);}}',
      '.cm-banner{border-radius:var(--r-md,10px);padding:var(--sp-3,12px) var(--sp-4,16px);font-size:var(--fs-base,14px);line-height:var(--lh-body,1.65);display:flex;gap:var(--sp-3,12px);align-items:flex-start;margin-bottom:var(--sp-4,16px);border:1px solid var(--border,#334155);background:var(--surface);color:var(--text2);}',
      '.cm-banner .cm-banner-ico{flex:0 0 auto;font-size:var(--fs-md,16px);line-height:1.4;}',
      '.cm-banner.warn{border-color:var(--orange);color:var(--text);}',
      '.cm-banner.bad{border-color:var(--red);color:var(--text);}',
      '.cm-banner.good{border-color:var(--green);color:var(--text);}',
      '.cm-banner.ai{border-color:var(--accent2);color:var(--text);}',
      '.cm-banner b{color:var(--text);}',

      /* buttons row */
      '.cm-actions{display:flex;gap:var(--sp-2,8px);flex-wrap:wrap;align-items:center;}',
      '.cm-actions.end{justify-content:flex-end;}',
      '.cm-linkbtn{display:inline-flex;align-items:center;min-height:44px;background:transparent;border:none;color:var(--text3);font-size:var(--fs-sm,13px);font-weight:var(--fw-bold,700);cursor:pointer;padding:var(--sp-2,8px);border-radius:var(--r-sm,6px);}',
      '.cm-linkbtn:hover{color:var(--accent-fg,#60a5fa);background:var(--bg);}',
      '.cm-linkbtn:active{transform:scale(.975);}',
      '.cm-linkbtn.danger:hover{color:var(--red-fg,#f87171);}',
      '.cm-more{width:100%;margin-top:var(--sp-3,12px);}',

      /* rich text */
      '.cm-rich p{margin:0 0 var(--sp-2,8px);line-height:var(--lh-body,1.65);word-break:break-word;}',
      '.cm-rich p:last-child{margin-bottom:0;}',
      '.cm-rich-gap{height:var(--sp-2,8px);}',
      '.cm-code{background:var(--bg);border:1px solid var(--border,#334155);border-radius:var(--r-sm,6px);padding:1px 6px;font-family:"Courier New",monospace;font-size:0.88em;color:var(--orange-fg,#fbbf24);}',
      '.cm-mention{color:var(--accent-fg,#60a5fa);font-weight:var(--fw-bold,700);}',
      '.cm-b{color:var(--text);font-weight:var(--fw-black,800);}',

      /* comments */
      '.cm-thread{display:flex;flex-direction:column;gap:var(--sp-3,12px);}',
      '.cm-comment{background:var(--surface);border:1px solid var(--border,#334155);border-radius:var(--r-md,10px);padding:var(--sp-3,12px) var(--sp-4,16px);}',
      '.cm-comment.best{border-color:var(--green);box-shadow:inset 3px 0 0 var(--green);}',
      '.cm-comment-head{display:flex;gap:var(--sp-2,8px);align-items:center;flex-wrap:wrap;margin-bottom:var(--sp-2,8px);}',
      '.cm-comment-foot{display:flex;gap:var(--sp-2,8px);align-items:center;flex-wrap:wrap;margin-top:var(--sp-2,8px);}',
      '.cm-kids{margin-left:var(--sp-4,16px);padding-left:var(--sp-3,12px);border-left:2px solid var(--border,#334155);margin-top:var(--sp-3,12px);display:flex;flex-direction:column;gap:var(--sp-3,12px);}',
      '.cm-mention-pop{position:absolute;z-index:60;background:var(--surface);border:1px solid var(--accent);border-radius:var(--r-md,10px);padding:var(--sp-1,4px);max-height:180px;overflow:auto;min-width:180px;max-width:calc(100vw - 32px);box-shadow:var(--el-3,0 8px 24px rgba(0,0,0,.45));}',
      '.cm-mention-opt{display:flex;gap:var(--sp-2,8px);align-items:center;width:100%;min-height:44px;text-align:left;background:transparent;border:none;color:var(--text);padding:var(--sp-2,8px);border-radius:var(--r-sm,6px);cursor:pointer;font-size:var(--fs-base,14px);}',
      '.cm-mention-opt:hover,.cm-mention-opt.on{background:var(--surface3,#334155);}',
      '.cm-composer{position:relative;}',

      /* modal */
      '.cm-modal-back{position:fixed;top:0;right:0;bottom:0;left:0;background:var(--scrim,rgba(15,23,42,0.72));display:flex;align-items:flex-start;justify-content:center;padding:var(--sp-4,16px);z-index:1200;overflow:auto;}',
      '.cm-modal{background:var(--surface);border:1px solid var(--border,#334155);border-radius:var(--r-lg,14px);padding:var(--sp-5,20px);width:100%;max-width:640px;margin:auto;box-shadow:var(--el-4,0 16px 48px rgba(0,0,0,0.60));}',
      '.cm-modal-head{display:flex;align-items:center;gap:var(--sp-3,12px);margin-bottom:var(--sp-4,16px);}',
      '.cm-modal-head h3{font-size:var(--fs-lg,19px);margin:0;flex:1 1 auto;}',
      '.cm-x{background:transparent;border:1px solid var(--border,#334155);color:var(--text2);width:44px;height:44px;border-radius:var(--r-sm,6px);cursor:pointer;font-size:var(--fs-md,16px);line-height:1;flex:0 0 auto;}',
      '.cm-x:hover{border-color:var(--red);color:var(--red-fg,#f87171);}',
      '.cm-x:active{transform:scale(.94);}',

      /* steps */
      '.cm-steps{display:flex;gap:var(--sp-2,8px);flex-wrap:wrap;margin-bottom:var(--sp-4,16px);}',
      '.cm-stepbtn{flex:1 1 88px;min-height:44px;background:var(--bg);border:1px solid var(--border,#334155);border-radius:var(--r-sm,6px);padding:var(--sp-2,8px) var(--sp-1,4px);color:var(--text3);font-size:var(--fs-2xs,11px);font-weight:var(--fw-bold,700);cursor:pointer;text-align:center;}',
      '.cm-stepbtn[aria-current="step"]{border-color:var(--accent);color:var(--text);background:var(--surface3,#334155);}',
      '.cm-stepbtn:active{transform:scale(.975);}',
      '.cm-stepbtn .cm-stepnum{display:block;font-size:var(--fs-base,14px);font-weight:var(--fw-black,800);color:var(--accent-fg,#60a5fa);}',
      '.cm-stepbtn.done .cm-stepnum{color:var(--green-fg,#4ade80);}',

      /* rows builder */
      '.cm-rows{display:flex;flex-direction:column;gap:var(--sp-2,8px);}',
      '.cm-rowitem{background:var(--bg);border:1px solid var(--border,#334155);border-radius:var(--r-md,10px);padding:var(--sp-3,12px);display:flex;gap:var(--sp-2,8px);align-items:flex-start;flex-wrap:wrap;}',
      '.cm-rowitem>.cm-grow{flex:1 1 140px;min-width:0;}',
      '.cm-del{background:transparent;border:1px solid var(--border,#334155);color:var(--text3);border-radius:var(--r-sm,6px);width:44px;height:44px;cursor:pointer;flex:0 0 auto;font-size:var(--fs-base,14px);}',
      '.cm-del:hover{border-color:var(--red);color:var(--red-fg,#f87171);}',
      '.cm-del:active{transform:scale(.94);}',

      /* grids / boards */
      '.cm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:var(--sp-3,12px);}',
      '.cm-board{display:flex;flex-direction:column;gap:var(--sp-2,8px);}',
      '.cm-brow{display:flex;align-items:center;gap:var(--sp-3,12px);background:var(--surface);border:1px solid var(--border,#334155);border-radius:var(--r-md,10px);padding:var(--sp-3,12px);}',
      '.cm-brow.me{border-color:var(--accent);}',
      '.cm-rank{width:30px;flex:0 0 auto;font-weight:var(--fw-black,800);color:var(--text3);font-size:var(--fs-base,14px);text-align:center;}',
      '.cm-rank.top{color:var(--orange-fg,#fbbf24);}',
      '.cm-bval{margin-left:auto;font-weight:var(--fw-black,800);color:var(--text);font-size:var(--fs-base,14px);flex:0 0 auto;}',
      '.cm-bmain{flex:1 1 auto;min-width:0;}',
      '.cm-bar{height:6px;border-radius:var(--r-sm,6px);background:var(--surface3,#334155);overflow:hidden;margin-top:var(--sp-2,8px);}',
      '.cm-bar>i{display:block;height:100%;background:var(--accent);border-radius:var(--r-sm,6px);}',
      '.cm-bar.green>i{background:var(--green);}',

      /* option rows in practice */
      '.cm-opt{display:flex;gap:var(--sp-3,12px);align-items:flex-start;width:100%;min-height:44px;text-align:left;background:var(--bg);border:2px solid var(--border,#334155);border-radius:var(--r-md,10px);padding:var(--sp-3,12px);color:var(--text);cursor:pointer;font-size:var(--fs-md,16px);line-height:var(--lh-body,1.65);transition:border-color var(--dur-fast,.12s),transform var(--dur-fast,.12s);}',
      '.cm-opt:hover{border-color:var(--accent);}',
      '.cm-opt:active{transform:scale(.99);}',
      '.cm-opt.sel{border-color:var(--accent);}',
      '.cm-opt.right{border-color:var(--green);}',
      '.cm-opt.wrong{border-color:var(--red);}',
      '.cm-opt-key{flex:0 0 auto;font-weight:var(--fw-black,800);color:var(--text3);width:18px;}',
      '.cm-opt.right .cm-opt-key,.cm-opt.sel .cm-opt-key{color:var(--text);}',

      /* notifications */
      '.cm-bellwrap{position:relative;display:inline-block;}',
      '.cm-bell{background:transparent;border:1px solid var(--border,#334155);color:var(--text2);border-radius:var(--r-md,10px);min-height:44px;padding:var(--sp-2,8px) var(--sp-3,12px);cursor:pointer;font-size:var(--fs-base,14px);font-weight:var(--fw-bold,700);display:inline-flex;gap:var(--sp-2,8px);align-items:center;}',
      '.cm-bell:hover{border-color:var(--accent);color:var(--text);}',
      '.cm-bell:active{transform:scale(.975);}',
      '.cm-bell .cm-dot{background:var(--red);color:#fff;border-radius:var(--r-full,999px);font-size:var(--fs-2xs,11px);font-weight:var(--fw-black,800);padding:1px 6px;min-width:18px;text-align:center;}',
      '.cm-bell .cm-zero{color:var(--text3);font-weight:var(--fw-semi,600);font-size:var(--fs-2xs,11px);}',
      '.cm-pop{position:absolute;right:0;top:calc(100% + 6px);width:min(340px,90vw);background:var(--surface);border:1px solid var(--border,#334155);border-radius:var(--r-lg,14px);padding:var(--sp-2,8px);z-index:120;box-shadow:var(--el-4,0 16px 48px rgba(0,0,0,0.60));max-height:60vh;overflow:auto;}',
      '.cm-notif{display:flex;gap:var(--sp-2,8px);padding:var(--sp-3,12px);min-height:44px;border-radius:var(--r-sm,6px);font-size:var(--fs-base,14px);line-height:var(--lh-normal,1.5);color:var(--text2);width:100%;text-align:left;background:transparent;border:none;cursor:pointer;}',
      '.cm-notif:hover{background:var(--bg);}',
      '.cm-notif.unread{background:var(--bg);color:var(--text);}',
      '.cm-notif.unread .cm-notif-ico{color:var(--accent-fg,#60a5fa);}',
      '.cm-notif-ico{flex:0 0 auto;color:var(--text3);}',

      /* misc */
      '.cm-kv{display:flex;gap:var(--sp-2,8px);font-size:var(--fs-base,14px);color:var(--text2);line-height:var(--lh-body,1.65);}',
      '.cm-kv b{color:var(--text);font-weight:var(--fw-bold,700);min-width:82px;flex:0 0 auto;}',
      '.cm-divider{height:1px;background:var(--border,#334155);margin:var(--sp-4,16px) 0;border:0;}',
      '.cm-mini{font-size:var(--fs-sm,13px);color:var(--text3);line-height:var(--lh-normal,1.5);}',
      '.cm-ai-out{background:var(--bg);border:1px solid var(--accent2);border-radius:var(--r-md,10px);padding:var(--sp-4,16px);margin-top:var(--sp-3,12px);}',
      '.cm-ai-out h4{color:var(--accent2-fg,#a78bfa);font-size:var(--fs-xs,12px);text-transform:uppercase;letter-spacing:.6px;margin:0 0 var(--sp-2,8px);}',
      /* "what happens after you post" — the thing neither form used to say */
      '.cm-nextup{border-left:3px solid var(--accent);background:var(--bg);border-radius:var(--r-sm,6px);padding:var(--sp-3,12px);color:var(--text2);font-size:var(--fs-base,14px);line-height:var(--lh-body,1.65);margin:var(--sp-4,16px) 0;}',
      '.cm-nextup b{color:var(--text);}',

      /* mobile */
      '@media (max-width:640px){',
      '  .cm-item{padding:var(--sp-3,12px);gap:var(--sp-2,8px);}',
      '  .cm-modal{padding:var(--sp-4,16px);border-radius:var(--r-lg,14px);}',
      '  .cm-name{max-width:96px;}',
      '  .cm-head h2{font-size:var(--fs-lg,19px);}',
      '  .cm-toolbar{gap:var(--sp-2,8px);}',
      '  .cm-stepbtn{flex:1 1 70px;font-size:var(--fs-2xs,11px);}',
      '  .cm-kids{margin-left:var(--sp-2,8px);padding-left:var(--sp-2,8px);}',
      '  .cm-input,.cm-textarea,.cm-select{font-size:16px;}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '  .cm-spin{animation:none;border-top-color:var(--accent);}',
      '  .cm-tab,.cm-segbtn,.cm-opt,.cm-item.cm-clickable,.cm-vote-btn,.cm-input,.cm-textarea,.cm-select{transition:none;}',
      '  .cm-tab:active,.cm-segbtn:active,.cm-opt:active,.cm-item.cm-clickable:active,.cm-vote-btn:active,',
      '  .cm-linkbtn:active,.cm-stepbtn:active,.cm-del:active,.cm-x:active,.cm-bell:active{transform:none;}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ======================================================= PRIMITIVES ==== */

  function Spinner(props) {
    return ce('div', { className: 'cm-status', role: 'status' },
      ce('span', { className: 'cm-spin', 'aria-hidden': 'true' }),
      ce('span', null, props && props.label ? props.label : 'Loading...')
    );
  }

  function Banner(props) {
    return ce('div', { className: 'cm-banner ' + (props.tone || ''), role: props.tone === 'bad' ? 'alert' : undefined },
      ce('span', { className: 'cm-banner-ico', 'aria-hidden': 'true' }, props.icon || 'i'),
      ce('div', null, props.children)
    );
  }

  /* Firebase's own error strings are diagnostics, not copy. They read like
     `permission_denied at /community/questions: Client doesn't have permission
     to access the desired data.` and used to render verbatim in nine student
     facing surfaces. We classify off code/message and then never show either.
     (DR09 CRITICAL #2) */
  function classifyError(err) {
    var code = (err && err.code) ? String(err.code) : '';
    var raw = '';
    try { raw = (err && err.message) ? String(err.message) : ''; } catch (e) { raw = ''; }
    var sig = (code + ' ' + raw).toUpperCase();

    if (code === 'no-db' || sig.indexOf('NO-DB') >= 0) {
      return {
        kind: 'offline',
        text: 'We cannot reach the server right now. This is usually the wifi - hospital and campus ' +
              'networks often block it. Everything else in MedMaster still works offline.',
        retryLabel: 'Try reconnecting'
      };
    }
    if (sig.indexOf('PERMISSION_DENIED') >= 0 || sig.indexOf('PERMISSION DENIED') >= 0 || sig.indexOf('UNAUTHORIZED') >= 0) {
      return {
        kind: 'permission',
        text: 'Your account does not have access to this yet. That is a permissions setting on our ' +
              'side, not something you did - tell your instructor and we will fix it.',
        retryLabel: ''   // retrying a permissions error cannot succeed
      };
    }
    if (sig.indexOf('NETWORK') >= 0 || sig.indexOf('UNAVAILABLE') >= 0 || sig.indexOf('DISCONNECT') >= 0 ||
        sig.indexOf('FAILED TO FETCH') >= 0 || sig.indexOf('TIMEOUT') >= 0 || sig.indexOf('OFFLINE') >= 0) {
      return {
        kind: 'network',
        text: 'Cannot reach the server. Check your connection and try again - nothing you have written is lost.',
        retryLabel: 'Try again'
      };
    }
    return {
      kind: 'unknown',
      text: 'Something went wrong loading this. It is not something you did.',
      retryLabel: 'Try again'
    };
  }

  /* Same rule for writes. Our own validation and rate-limit errors are written
     for humans and carry no code, so they pass through; anything that smells
     like a Firebase diagnostic gets translated. */
  function writeErrText(e, fallback) {
    var code = (e && e.code) ? String(e.code) : '';
    var raw = '';
    try { raw = (e && e.message) ? String(e.message) : ''; } catch (x) { raw = ''; }
    if (!code && raw && raw.indexOf(' at /') < 0 && !/permission[_ ]denied|firebase|Client doesn/i.test(raw)) {
      return raw;
    }
    var info = classifyError(e);
    if (info.kind === 'permission') {
      return 'Your account is not allowed to post here yet. That is a permissions setting on our side, ' +
             'not something you did - tell your instructor and we will fix it.';
    }
    if (info.kind === 'offline' || info.kind === 'network') {
      return 'That did not save - we could not reach the server. Check your connection and try again; ' +
             'nothing you typed is lost.';
    }
    return fallback || info.text;
  }

  function ErrorBox(props) {
    var info = classifyError(props.error);
    return ce(Banner, { tone: 'bad', icon: '!' },
      ce('div', null,
        ce('div', null, info.text),
        ce('div', { className: 'cm-actions', style: { marginTop: 8 } },
          (props.onRetry && info.retryLabel) ? ce('button', {
            className: 'btn btn-outline btn-sm', onClick: props.onRetry
          }, info.retryLabel) : null,
          info.kind === 'permission' ? ce('span', { className: 'cm-mini' },
            'Nothing here is lost - it is just not readable from this account.') : null
        )
      )
    );
  }

  function Empty(props) {
    return ce('div', { className: 'cm-empty' },
      ce('div', { className: 'cm-empty-ico', 'aria-hidden': 'true' }, props.icon || '+'),
      ce('div', { className: 'cm-empty-title' }, props.title),
      ce('p', { className: 'cm-empty-text' }, props.text),
      props.actions ? ce('div', { className: 'cm-empty-actions' }, props.actions) : null,
      props.tips && props.tips.length
        ? ce('ul', { className: 'cm-empty-tips' }, props.tips.map(function (t, i) {
            return ce('li', { key: i }, t);
          }))
        : null
    );
  }

  function LoadMore(props) {
    if (!props.more) return null;
    return ce('button', {
      className: 'btn btn-outline cm-more', onClick: props.onClick, disabled: !!props.loading
    }, props.loading ? 'Loading...' : (props.label || 'Load more'));
  }

  function Field(props) {
    var over = props.max && props.value && String(props.value).length > props.max;
    return ce('div', { className: 'cm-field' },
      ce('label', { className: 'cm-label', htmlFor: props.id },
        props.label,
        props.required ? ce('span', { className: 'cm-req', title: 'required' }, '*') : null,
        props.max ? ce('span', { className: 'cm-count' + (over ? ' over' : '') },
          String((props.value || '').length) + '/' + props.max) : null
      ),
      props.children,
      props.hint ? ce('div', { className: 'cm-hint' }, props.hint) : null,
      props.error ? ce('div', { className: 'cm-err', role: 'alert' },
        ce('span', { 'aria-hidden': 'true' }, '!'), ce('span', null, props.error)) : null
    );
  }

  function Chip(props) {
    var extra = props.tone ? (' ' + props.tone) : '';
    return ce('span', { className: 'cm-chip' + extra }, props.children);
  }

  function CommunityBadge(props) {
    var b = BADGE_BY_ID[props.id];
    if (!b) return null;
    return ce('span', {
      className: 'cm-badge ' + b.tone,
      title: b.label + ' - ' + b.desc
    },
      ce('span', { className: 'cm-badge-ico', 'aria-hidden': 'true' }, b.icon),
      ce('span', null, b.label)
    );
  }

  function BadgeStrip(props) {
    var ids = props.ids || [];
    var max = props.max || 2;
    if (!ids.length) return null;
    var shown = ids.slice(0, max);
    return ce('span', { className: 'cm-badge-row' },
      shown.map(function (id) { return ce(CommunityBadge, { key: id, id: id }); }),
      ids.length > max ? ce('span', { className: 'cm-badge' }, '+' + (ids.length - max)) : null
    );
  }

  function AuthorChip(props) {
    var badges = useAuthorBadges(props.uid);
    var name = clean(props.name, LIMIT.name) || 'Student';
    return ce('span', { className: 'cm-author' },
      ce('span', { className: 'cm-avatar', 'aria-hidden': 'true' }, initials(name)),
      ce('span', { className: 'cm-name' }, name),
      props.uid && props.uid === myId() ? ce('span', { className: 'cm-flag mine' }, 'You') : null,
      ce(BadgeStrip, { ids: badges, max: props.maxBadges || 1 })
    );
  }

  function Modal(props) {
    var boxRef = useRef(null);
    useEffect(function () {
      function onKey(e) { if (e.key === 'Escape') props.onClose(); }
      document.addEventListener('keydown', onKey);
      if (boxRef.current) {
        var f = boxRef.current.querySelector('input,textarea,select,button');
        if (f && f.focus) { try { f.focus(); } catch (e) { /* ignore */ } }
      }
      return function () { document.removeEventListener('keydown', onKey); };
    }, []);
    return ce('div', {
      className: 'cm-modal-back',
      onMouseDown: function (e) { if (e.target === e.currentTarget) props.onClose(); }
    },
      ce('div', {
        className: 'cm-modal', ref: boxRef, role: 'dialog', 'aria-modal': 'true',
        'aria-label': props.title
      },
        ce('div', { className: 'cm-modal-head' },
          ce('h3', null, props.title),
          ce('button', { className: 'cm-x', onClick: props.onClose, 'aria-label': 'Close dialog' }, '✕')
        ),
        props.children
      )
    );
  }

  function VoteBar(props) {
    // props: { score, my, onVote, disabled, compact, reason }
    var score = num(props.score, 0);
    var my = num(props.my, 0);
    var tone = score > 0 ? ' pos' : (score < 0 ? ' neg' : '');
    function btn(dir, glyph, label, cls) {
      return ce('button', {
        className: 'cm-vote-btn ' + cls,
        'aria-pressed': my === dir ? 'true' : 'false',
        'aria-label': label,
        title: props.disabled ? (props.reason || 'Sign in to vote') : label,
        disabled: !!props.disabled,
        onClick: function (e) { e.stopPropagation(); props.onVote(dir); }
      }, ce('span', { 'aria-hidden': 'true' }, glyph));
    }
    return ce('div', { className: 'cm-vote' },
      btn(1, '▲', 'Upvote', 'up'),
      ce('div', { className: 'cm-score' + tone },
        ce('span', { 'aria-hidden': 'true' }, String(score)),
        ce('span', { className: 'cm-sr' }, pluralize(score, 'point'))
      ),
      btn(-1, '▼', 'Downvote', 'down')
    );
  }

  /* Two different failures used to share one screen, and neither offered the
     action it demanded. "You are signed out" and "the database is unreachable"
     are now separate components with a real control each. (DR05 CRITICAL #1,
     DR09 MAJOR #6) */

  function SignInWall(props) {
    var p = props || {};
    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-empty' },
        ce('div', { className: 'cm-empty-ico', 'aria-hidden': 'true' }, '👋'),
        ce('div', { className: 'cm-empty-title' }, p.title || 'Sign in and the community opens up'),
        ce('p', { className: 'cm-empty-text' },
          p.message || 'This is where your cohort trades practice questions, builds scenarios, and answers ' +
            'each other at 11pm before a signoff. Posts are attributed, so you need an account to join in.'),
        ce('div', { className: 'cm-empty-actions' },
          ce('button', { className: 'btn btn-primary', onClick: requestSignIn }, 'Sign in'),
          p.onBack ? ce('button', { className: 'btn btn-outline', onClick: p.onBack }, 'Back') : null),
        ce('ul', { className: 'cm-empty-tips' },
          ce('li', null, 'Browse and practice questions your classmates wrote'),
          ce('li', null, 'Build and publish clinical scenarios'),
          ce('li', null, 'Ask for help on the stuff that will not stick')
        )
      )
    );
  }

  function OfflineWall(props) {
    var p = props || {};
    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-empty' },
        ce('div', { className: 'cm-empty-ico', 'aria-hidden': 'true' }, '⚡'),
        ce('div', { className: 'cm-empty-title' }, 'Community is offline'),
        ce('p', { className: 'cm-empty-text' },
          p.message || 'We cannot reach the server right now. This is usually the wifi - hospital and campus ' +
            'networks often block it. Your practice, simulations, flashcards and pharm all still work, and ' +
            'your progress is saved on this device.'),
        ce('div', { className: 'cm-empty-actions' },
          ce('button', { className: 'btn btn-primary', onClick: reloadPage }, 'Try reconnecting'),
          ce('button', { className: 'btn btn-outline', onClick: function () { if (MMx().navigate) MMx().navigate('smart'); } }, 'Study offline instead'))
      )
    );
  }

  /* Sorting and filtering. Deliberately NOT .cm-tab: pills move you between
     pages, this changes the order of the page you are on. */
  function Segmented(props) {
    var opts = props.options || [];
    return ce('div', { className: 'cm-segwrap' },
      props.label ? ce('span', { className: 'cm-seglab', id: props.id ? (props.id + '-lab') : undefined }, props.label) : null,
      ce('div', {
        className: 'cm-seg', role: 'group',
        'aria-label': props.ariaLabel || props.label || 'Options'
      },
        opts.map(function (o) {
          return ce('button', {
            key: o.id, type: 'button', className: 'cm-segbtn',
            'aria-pressed': props.value === o.id ? 'true' : 'false',
            onClick: function () { props.onChange(o.id); }
          }, o.label);
        })),
      props.note ? ce('span', { className: 'cm-mini' }, props.note) : null
    );
  }

  function BannedNotice(props) {
    return ce(Banner, { tone: 'bad', icon: '⊘' },
      ce('div', null,
        ce('b', null, 'Posting is disabled for your account. '),
        ce('span', null, props.reason || 'Contact your instructor if you think this is a mistake.'),
        ce('div', { className: 'cm-mini', style: { marginTop: 6 } },
          'You can still read everything in the community.')
      )
    );
  }

  /* ---- report dialog (shared by questions / scenarios / comments) ------- */

  var REPORT_REASONS = [
    'Clinically inaccurate',
    'Keyed answer looks wrong',
    'Missing or wrong rationale',
    'Duplicate of existing content',
    'Off topic or spam',
    'Rude or unsafe'
  ];

  function ReportDialog(props) {
    var s0 = useState(REPORT_REASONS[0]); var reason = s0[0], setReason = s0[1];
    var s1 = useState('');                var note = s1[0], setNote = s1[1];
    var s2 = useState(false);             var busy = s2[0], setBusy = s2[1];
    var s3 = useState('');                var err = s3[0], setErr = s3[1];

    function submit() {
      if (busy) return;
      setBusy(true); setErr('');
      pushAt(P.reports, {
        targetType: props.targetType,
        targetId: props.targetId,
        targetPath: props.targetPath,
        preview: clean(props.preview, 180),
        authorId: props.authorId || '',
        authorName: clean(props.authorName, LIMIT.name),
        reason: clean(reason, LIMIT.reason),
        note: clean(note, LIMIT.note),
        reporterId: myId(),
        reporterName: myName(),
        status: 'open',
        createdAt: now()
      }).then(function () {
        toast('Report sent. A human reviews every report - nothing is removed automatically.', 'success');
        props.onDone();
      })['catch'](function (e) {
        setBusy(false);
        setErr(writeErrText(e, 'Could not send that report. Try again in a moment.'));
      });
    }

    return ce(Modal, { title: 'Report this content', onClose: props.onClose },
      ce('p', { className: 'cm-sub', style: { marginBottom: 14 } },
        'Reports go to a private moderation queue. Nothing is removed automatically - a human reviews it.'),
      ce(Field, { label: 'What is wrong?', id: 'cm-rep-reason', required: true },
        ce('select', {
          id: 'cm-rep-reason', className: 'cm-select', value: reason,
          onChange: function (e) { setReason(e.target.value); }
        }, REPORT_REASONS.map(function (r) { return ce('option', { key: r, value: r }, r); }))
      ),
      ce(Field, {
        label: 'Details (optional)', id: 'cm-rep-note', max: LIMIT.note, value: note,
        hint: 'If you know the correct answer or have a source, say so here - it makes review much faster.'
      },
        ce('textarea', {
          id: 'cm-rep-note', className: 'cm-textarea', value: note, maxLength: LIMIT.note,
          onChange: function (e) { setNote(e.target.value); },
          placeholder: 'e.g. The keyed answer is B, but Lewis ch. 42 says fundal massage comes first.'
        })
      ),
      err ? ce('div', { className: 'cm-err', role: 'alert' }, err) : null,
      ce('div', { className: 'cm-actions end' },
        ce('button', { className: 'btn btn-outline', onClick: props.onClose }, 'Cancel'),
        ce('button', { className: 'btn btn-primary', onClick: submit, disabled: busy },
          busy ? 'Sending...' : 'Send report')
      )
    );
  }

  /* =========================================================================
   * 1. QUESTION BANK
   * ====================================================================== */

  var Q_SORTS = [
    { id: 'top',       label: 'Top',           field: 'score' },
    { id: 'newest',    label: 'Newest',        field: 'createdAt' },
    { id: 'discussed', label: 'Most discussed', field: 'commentCount' }
  ];

  function letter(i) { return String.fromCharCode(65 + i); }

  function blankQuestion() {
    return {
      text: '', type: 'multiple-choice',
      options: ['', '', '', ''], correct: [],
      rationale: '', category: CATEGORIES[0], topic: '', difficulty: 'Medium',
      source: ''
    };
  }

  function validateQuestion(q) {
    var errs = {};
    var text = clean(q.text, LIMIT.qtext);
    if (text.length < 15) errs.text = 'Write the full question stem - at least 15 characters.';
    var opts = q.options.map(function (o) { return clean(o, LIMIT.option); });
    var filled = opts.filter(function (o) { return o.length > 0; });
    if (filled.length < 2) errs.options = 'You need at least 2 answer options.';
    var blankBetween = false, seenBlank = false, i;
    for (i = 0; i < opts.length; i++) {
      if (!opts[i]) seenBlank = true;
      else if (seenBlank) blankBetween = true;
    }
    if (blankBetween) errs.options = 'Remove the empty option in the middle of the list.';
    var dupe = {};
    for (i = 0; i < opts.length; i++) {
      if (!opts[i]) continue;
      var k = opts[i].toLowerCase();
      if (dupe[k]) { errs.options = 'Two options are identical - make each distractor distinct.'; break; }
      dupe[k] = true;
    }
    var correct = (q.correct || []).filter(function (idx) { return opts[idx] && opts[idx].length > 0; });
    if (!correct.length) errs.correct = 'Mark which option(s) are correct.';
    if (q.type === 'multiple-choice' && correct.length > 1) {
      errs.correct = 'Multiple choice takes exactly one correct answer. Switch the type to Select all that apply.';
    }
    if (q.type === 'select-all' && correct.length < 2) {
      errs.correct = 'Select all that apply needs at least 2 correct answers.';
    }
    if (q.type === 'select-all' && correct.length === filled.length) {
      errs.correct = 'If every option is correct there is nothing to select - remove one or add a distractor.';
    }
    var rat = clean(q.rationale, LIMIT.rationale);
    if (!rat) errs.rationale = 'A rationale is required. Explain WHY the answer is right - that is the part people learn from.';
    else if (rat.length < 20) errs.rationale = 'Give a little more - at least 20 characters explaining the reasoning.';
    if (!q.category) errs.category = 'Pick a category so people can find this.';
    return errs;
  }

  function firstError(errs) {
    var k;
    for (k in errs) { if (Object.prototype.hasOwnProperty.call(errs, k)) return errs[k]; }
    return '';
  }

  /* ------------------------------------------------------- AI reviewer -- */

  var AI_REVIEW_SYSTEM =
    'You are a nursing faculty member reviewing a student-written NCLEX-style practice question. ' +
    'Be direct, kind, and concrete. Judge clinical accuracy against standard US nursing education ' +
    '(ATI/NCLEX, Lewis, Potter & Perry). Never invent citations. ' +
    'Respond ONLY with a JSON object of this exact shape: ' +
    '{"verdict":"looks-solid|needs-work|likely-wrong",' +
    '"summary":"one or two sentences",' +
    '"keyedAnswerConcern":"empty string if the keyed answer is right, otherwise explain which option should be keyed and why",' +
    '"accuracyNotes":["short note", "..."],' +
    '"distractorNotes":["short note", "..."],' +
    '"suggestedRationale":"a stronger rationale in 2-4 sentences, student voice, explains why the right answer is right AND why the main distractor is wrong"}';

  function buildReviewPrompt(q) {
    var opts = q.options.map(function (o, i) {
      var mark = (q.correct || []).indexOf(i) >= 0 ? '  <-- KEYED CORRECT' : '';
      return letter(i) + '. ' + clean(o, LIMIT.option) + mark;
    }).filter(function (line) { return line.length > 3; }).join('\n');
    return 'Category: ' + q.category + (q.topic ? ' / ' + clean(q.topic, LIMIT.topic) : '') +
      '\nDifficulty: ' + q.difficulty +
      '\nType: ' + q.type +
      '\n\nQUESTION:\n' + clean(q.text, LIMIT.qtext) +
      '\n\nOPTIONS:\n' + opts +
      '\n\nSTUDENT RATIONALE:\n' + (clean(q.rationale, LIMIT.rationale) || '(none written yet)') +
      (q.source ? '\n\nSTUDENT SOURCE: ' + clean(q.source, LIMIT.source) : '');
  }

  function AiReview(props) {
    var r = props.review;
    if (!r) return null;
    var verdict = r.verdict || 'needs-work';
    var tone = verdict === 'looks-solid' ? 'good' : (verdict === 'likely-wrong' ? 'bad' : 'warn');
    var vlabel = verdict === 'looks-solid' ? 'Looks solid'
               : (verdict === 'likely-wrong' ? 'Probably wrong - please recheck' : 'Needs work');
    function list(title, arr) {
      if (!arr || !arr.length) return null;
      return ce('div', { style: { marginTop: 10 } },
        ce('h4', null, title),
        ce('ul', { className: 'cm-empty-tips', style: { margin: 0, maxWidth: 'none' } },
          arr.slice(0, 6).map(function (t, i) { return ce('li', { key: i }, clean(t, 300)); }))
      );
    }
    return ce('div', { className: 'cm-ai-out' },
      ce('div', { className: 'cm-chip-row', style: { marginBottom: 8 } },
        ce('span', { className: 'cm-flag ai' }, 'AI review - advisory only'),
        ce(Chip, { tone: verdict === 'looks-solid' ? 'easy' : (verdict === 'likely-wrong' ? 'hard' : 'medium') }, vlabel)
      ),
      ce('p', { className: 'cm-item-text' }, clean(r.summary, 400)),
      r.keyedAnswerConcern ? ce('div', { className: 'cm-banner ' + tone, style: { marginTop: 10, marginBottom: 0 } },
        ce('span', { className: 'cm-banner-ico', 'aria-hidden': 'true' }, '⚑'),
        ce('div', null, ce('b', null, 'Keyed answer: '), clean(r.keyedAnswerConcern, 500))
      ) : null,
      list('Accuracy notes', r.accuracyNotes),
      list('Distractor notes', r.distractorNotes),
      r.suggestedRationale ? ce('div', { style: { marginTop: 12 } },
        ce('h4', null, 'Suggested rationale'),
        ce('p', { className: 'cm-item-text' }, clean(r.suggestedRationale, LIMIT.rationale)),
        ce('div', { className: 'cm-actions', style: { marginTop: 8 } },
          ce('button', {
            className: 'btn btn-outline btn-sm',
            onClick: function () { props.onUseRationale(clean(r.suggestedRationale, LIMIT.rationale)); }
          }, 'Replace my rationale with this'),
          ce('span', { className: 'cm-mini' }, 'Your text is never changed unless you press this.')
        )
      ) : null
    );
  }

  /* ------------------------------------------------------ submit form --- */

  function QuestionSubmit(props) {
    var s0 = useState(props.initial ? merge(blankQuestion(), props.initial) : blankQuestion());
    var q = s0[0], setQ = s0[1];
    var s1 = useState({});      var errs = s1[0], setErrs = s1[1];
    var s2 = useState(false);   var busy = s2[0], setBusy = s2[1];
    var s3 = useState(null);    var review = s3[0], setReview = s3[1];
    var s4 = useState(false);   var aiBusy = s4[0], setAiBusy = s4[1];
    var s5 = useState('');      var aiErr = s5[0], setAiErr = s5[1];
    var s6 = useState('');      var formErr = s6[0], setFormErr = s6[1];
    var aiResolvingNow = useAiResolving();

    function set(field, value) {
      setQ(function (cur) { var n = merge(cur, {}); n[field] = value; return n; });
    }
    function setOption(i, value) {
      setQ(function (cur) {
        var opts = cur.options.slice();
        opts[i] = value;
        return merge(cur, { options: opts });
      });
    }
    function addOption() {
      setQ(function (cur) {
        if (cur.options.length >= 8) return cur;
        return merge(cur, { options: cur.options.concat(['']) });
      });
    }
    function removeOption(i) {
      setQ(function (cur) {
        if (cur.options.length <= 2) return cur;
        var opts = cur.options.filter(function (_, idx) { return idx !== i; });
        var correct = cur.correct
          .filter(function (c) { return c !== i; })
          .map(function (c) { return c > i ? c - 1 : c; });
        return merge(cur, { options: opts, correct: correct });
      });
    }
    function toggleCorrect(i) {
      setQ(function (cur) {
        if (cur.type === 'multiple-choice') {
          return merge(cur, { correct: cur.correct.length === 1 && cur.correct[0] === i ? [] : [i] });
        }
        var has = cur.correct.indexOf(i) >= 0;
        var next = has ? cur.correct.filter(function (c) { return c !== i; }) : cur.correct.concat([i]);
        next.sort(function (a, b) { return a - b; });
        return merge(cur, { correct: next });
      });
    }
    function changeType(t) {
      setQ(function (cur) {
        var correct = cur.correct;
        if (t === 'multiple-choice' && correct.length > 1) correct = [correct[0]];
        return merge(cur, { type: t, correct: correct });
      });
    }

    function runAi() {
      if (aiBusy) return;
      setAiBusy(true); setAiErr(''); setReview(null);
      aiChat({
        system: AI_REVIEW_SYSTEM,
        messages: [{ role: 'user', content: buildReviewPrompt(q) }],
        maxTokens: 900,
        temperature: 0.3
      }).then(function (text) {
        var parsed = extractJson(text);
        if (!parsed) {
          setReview({ verdict: 'needs-work', summary: clean(text, 900), accuracyNotes: [], distractorNotes: [] });
        } else {
          setReview(parsed);
        }
        setAiBusy(false);
      })['catch'](function (e) {
        setAiErr(aiErrorMessage(e));
        setAiBusy(false);
      });
    }

    function submit() {
      if (busy) return;
      var v = validateQuestion(q);
      setErrs(v);
      if (firstError(v)) { setFormErr('Fix the highlighted fields before posting.'); return; }
      var gateMsg = rateCheck('question');
      if (gateMsg) { setFormErr(gateMsg); return; }
      setBusy(true); setFormErr('');

      serverRateCheck(P.questions, isNewAccount() ? RATE.newUser.minGapMs : RATE.normal.minGapMs)
        .then(function (msg) {
          if (msg) { throw new Error(msg); }
          var opts = q.options.map(function (o) { return clean(o, LIMIT.option); })
                              .filter(function (o) { return o.length > 0; });
          var row = {
            text: clean(q.text, LIMIT.qtext),
            type: q.type,
            options: opts,
            correct: q.correct.filter(function (i) { return i < opts.length; }),
            rationale: clean(q.rationale, LIMIT.rationale),
            category: q.category,
            topic: clean(q.topic, LIMIT.topic),
            difficulty: q.difficulty,
            source: clean(q.source, LIMIT.source),
            authorId: myId(),
            authorName: myName(),
            createdAt: now(),
            score: 0,
            commentCount: 0,
            aiReviewed: !!review,
            featured: false,
            removed: false
          };
          return pushAt(P.questions, row).then(function (id) {
            rateNote('question');
            bumpStat('questions', 1);
            recordActivity('question', {
              text: myName() + ' posted a question in ' + row.category,
              targetType: 'question', targetId: id
            });
            toast('Question posted. It is live in the bank now, under your name.', 'success');
            props.onDone(merge(row, { _id: id }));
          });
        })['catch'](function (e) {
          setBusy(false);
          setFormErr(writeErrText(e, 'Could not post that question. Try again in a moment - what you wrote is still here.'));
        });
    }

    var filledOptions = q.options.filter(function (o) { return clean(o).length; }).length;

    return ce('div', null,
      ce(Banner, { icon: '✎' },
        ce('div', null,
          ce('b', null, 'Write the question you wish had been on the test. '),
          'A rationale is required - the explanation is the whole point. Keep patient data fictional.')
      ),

      ce(Field, {
        label: 'Question stem', id: 'cm-q-text', required: true, max: LIMIT.qtext,
        value: q.text, error: errs.text,
        hint: 'Include the client situation and what the nurse should do. e.g. "A nurse is caring for a client 2 hours post-op..."'
      },
        ce('textarea', {
          id: 'cm-q-text', className: 'cm-textarea', value: q.text, maxLength: LIMIT.qtext,
          onChange: function (e) { set('text', e.target.value); },
          placeholder: 'A nurse is caring for a client who...'
        })
      ),

      ce('div', { className: 'cm-toolbar' },
        ce('div', { style: { flex: '1 1 160px' } },
          ce('label', { className: 'cm-label', htmlFor: 'cm-q-type' }, 'Type'),
          ce('select', {
            id: 'cm-q-type', className: 'cm-select', value: q.type,
            onChange: function (e) { changeType(e.target.value); }
          },
            ce('option', { value: 'multiple-choice' }, 'Multiple choice (one answer)'),
            ce('option', { value: 'select-all' }, 'Select all that apply')
          )
        ),
        ce('div', { style: { flex: '1 1 140px' } },
          ce('label', { className: 'cm-label', htmlFor: 'cm-q-cat' }, 'Category'),
          ce('select', {
            id: 'cm-q-cat', className: 'cm-select', value: q.category,
            onChange: function (e) { set('category', e.target.value); }
          }, CATEGORIES.map(function (c) { return ce('option', { key: c, value: c }, c); }))
        ),
        ce('div', { style: { flex: '1 1 120px' } },
          ce('label', { className: 'cm-label', htmlFor: 'cm-q-diff' }, 'Difficulty'),
          ce('select', {
            id: 'cm-q-diff', className: 'cm-select', value: q.difficulty,
            onChange: function (e) { set('difficulty', e.target.value); }
          }, DIFFICULTIES.map(function (d) { return ce('option', { key: d, value: d }, d); }))
        )
      ),

      ce(Field, {
        label: 'Topic tag', id: 'cm-q-topic', max: LIMIT.topic, value: q.topic,
        hint: 'Optional, one or two words: "sepsis", "insulin", "postpartum hemorrhage".'
      },
        ce('input', {
          id: 'cm-q-topic', type: 'text', className: 'cm-input', value: q.topic, maxLength: LIMIT.topic,
          onChange: function (e) { set('topic', e.target.value); }, placeholder: 'sepsis'
        })
      ),

      ce('div', { className: 'cm-field' },
        ce('label', { className: 'cm-label' },
          'Answer options', ce('span', { className: 'cm-req' }, '*'),
          ce('span', { className: 'cm-count' }, filledOptions + ' filled')),
        ce('div', { className: 'cm-hint', style: { marginTop: 0, marginBottom: 8 } },
          q.type === 'select-all'
            ? 'Check every correct option. Select-all needs at least 2 correct.'
            : 'Check the one correct option.'),
        ce('div', { className: 'cm-rows' },
          q.options.map(function (o, i) {
            var checked = q.correct.indexOf(i) >= 0;
            return ce('div', { key: 'opt' + i, className: 'cm-rowitem' },
              ce('label', {
                className: 'cm-actions',
                style: { flex: '0 0 auto', gap: 6, cursor: 'pointer', paddingTop: 8 }
              },
                ce('input', {
                  type: q.type === 'select-all' ? 'checkbox' : 'radio',
                  name: 'cm-correct',
                  checked: checked,
                  onChange: function () { toggleCorrect(i); },
                  'aria-label': 'Mark option ' + letter(i) + ' correct'
                }),
                ce('span', { style: { fontWeight: 800, color: checked ? 'var(--green-fg, #4ade80)' : 'var(--text3)' } },
                  letter(i) + (checked ? ' ✓' : ''))
              ),
              ce('input', {
                type: 'text', className: 'cm-input cm-grow', value: o, maxLength: LIMIT.option,
                placeholder: 'Option ' + letter(i),
                'aria-label': 'Option ' + letter(i) + ' text',
                onChange: function (e) { setOption(i, e.target.value); }
              }),
              q.options.length > 2 ? ce('button', {
                className: 'cm-del', onClick: function () { removeOption(i); },
                'aria-label': 'Remove option ' + letter(i)
              }, '✕') : null
            );
          })
        ),
        q.options.length < 8 ? ce('button', {
          className: 'btn btn-outline btn-sm', style: { marginTop: 8 }, onClick: addOption
        }, '+ Add option') : null,
        errs.options ? ce('div', { className: 'cm-err', role: 'alert' }, errs.options) : null,
        errs.correct ? ce('div', { className: 'cm-err', role: 'alert' }, errs.correct) : null
      ),

      ce(Field, {
        label: 'Rationale', id: 'cm-q-rat', required: true, max: LIMIT.rationale,
        value: q.rationale, error: errs.rationale,
        hint: 'Why is the right answer right, and why is the tempting wrong one wrong? This is what your classmates actually study.'
      },
        ce('textarea', {
          id: 'cm-q-rat', className: 'cm-textarea', value: q.rationale, maxLength: LIMIT.rationale,
          style: { minHeight: 120 },
          onChange: function (e) { set('rationale', e.target.value); },
          placeholder: 'Falling BP with rising HR signals decompensating shock, which outranks a lab value...'
        })
      ),

      ce(Field, {
        label: 'Source (optional)', id: 'cm-q-src', max: LIMIT.source, value: q.source,
        hint: 'Textbook chapter, ATI module, lecture. Cited questions get trusted faster.'
      },
        ce('input', {
          id: 'cm-q-src', type: 'text', className: 'cm-input', value: q.source, maxLength: LIMIT.source,
          onChange: function (e) { set('source', e.target.value); },
          placeholder: 'Lewis 11th ed., ch. 42'
        })
      ),

      aiAvailable() ? ce('div', { className: 'cm-field' },
        ce('div', { className: 'cm-actions' },
          ce('button', {
            className: 'btn btn-outline', onClick: runAi, disabled: aiBusy || clean(q.text).length < 15
          }, aiBusy ? 'Checking...' : 'Check my question with AI'),
          ce('span', { className: 'cm-mini' },
            'Advisory second opinion. It never edits your question for you.')
        ),
        aiErr ? ce('div', { className: 'cm-err', role: 'alert' }, aiErr) : null,
        aiBusy ? ce(Spinner, { label: 'Reading your question...' }) : null,
        ce(AiReview, {
          review: review,
          onUseRationale: function (t) { set('rationale', t); toast('Rationale replaced. Edit it into your own words.', 'info'); }
        })
      ) : (aiResolvingNow ? ce('div', { className: 'cm-field' },
        ce('div', { className: 'cm-actions' },
          /* Plan not known yet - hold the button's footprint, disabled and
             quiet, rather than deciding this member does not get AI assist. */
          ce(CheckingButton, { label: 'Check my question with AI' }),
          ce('span', { className: 'cm-mini' }, 'Checking your plan...')
        )
      ) : null),

      formErr ? ce('div', { className: 'cm-banner bad', role: 'alert' },
        ce('span', { className: 'cm-banner-ico', 'aria-hidden': 'true' }, '!'),
        ce('div', null, formErr)) : null,

      // Neither form used to say what happens after you hand it over. (DR05 #20)
      ce('div', { className: 'cm-nextup' },
        ce('b', null, 'What happens next: '),
        'this posts immediately under your name - no approval queue. Classmates vote and comment on ' +
        'it, and if somebody thinks the keyed answer is wrong they flag it and you get a notification. ' +
        'You can edit or delete it any time.'),

      ce('div', { className: 'cm-actions end', style: { marginTop: 8 } },
        ce('button', { className: 'btn btn-outline', onClick: props.onCancel }, 'Cancel'),
        ce('button', { className: 'btn btn-primary', onClick: submit, disabled: busy },
          busy ? 'Posting...' : 'Post question')
      )
    );
  }

  /* ------------------------------------------------------ question card - */

  function QuestionCard(props) {
    var q = props.q;
    var s0 = useState(false); var open = s0[0], setOpen = s0[1];
    var mine = q.authorId === myId();

    var body = ce('div', { className: 'cm-item-main' },
      ce('div', { className: 'cm-chip-row', style: { marginBottom: 8 } },
        q.featured ? ce('span', { className: 'cm-flag pick' }, '★ Instructor pick') : null,
        q.helpWanted ? ce('span', { className: 'cm-flag help' }, '⛑ Help wanted') : null,
        ce(Chip, null, q.category || 'Other'),
        q.difficulty ? ce(Chip, { tone: String(q.difficulty).toLowerCase() }, q.difficulty) : null,
        q.type === 'select-all' ? ce(Chip, null, 'Select all') : null,
        q.topic ? ce(Chip, null, '#' + clean(q.topic, LIMIT.topic)) : null
      ),
      ce('p', { className: 'cm-item-text' }, clean(q.text, LIMIT.qtext)),

      open ? ce('div', { style: { marginTop: 12 } },
        ce('div', { className: 'cm-rows' },
          (q.options || []).map(function (o, i) {
            var right = (q.correct || []).indexOf(i) >= 0;
            return ce('div', { key: i, className: 'cm-opt ' + (right ? 'right' : '') },
              ce('span', { className: 'cm-opt-key', 'aria-hidden': 'true' }, letter(i)),
              ce('span', null, clean(o, LIMIT.option)),
              right ? ce('span', { style: { marginLeft: 'auto', color: 'var(--green-fg, #4ade80)', fontWeight: 800 } }, '✓ Correct') : null
            );
          })
        ),
        ce('div', { className: 'cm-banner good', style: { marginTop: 12, marginBottom: 0 } },
          ce('span', { className: 'cm-banner-ico', 'aria-hidden': 'true' }, '✎'),
          ce('div', null,
            ce('b', null, 'Rationale: '),
            ce(RichText, { text: q.rationale, max: LIMIT.rationale })
          )
        ),
        q.source ? ce('div', { className: 'cm-mini', style: { marginTop: 8 } }, 'Source: ' + clean(q.source, LIMIT.source)) : null,
        q.aiReviewed ? ce('div', { className: 'cm-mini', style: { marginTop: 6 } }, 'Author ran an AI accuracy check before posting.') : null,
        q.removed ? ce('div', { className: 'cm-removed-note' },
          ce('b', null, 'Removed by a moderator. '), 'Reason: ' + clean(q.removalReason, LIMIT.reason)) : null,
        ce('hr', { className: 'cm-divider' }),
        ce(CommunityDiscussion, {
          targetId: 'question:' + q._id,
          targetType: 'question',
          targetTitle: clean(q.text, 90),
          targetAuthorId: q.authorId,
          compact: true
        })
      ) : null,

      ce('div', { className: 'cm-item-foot' },
        ce(AuthorChip, { uid: q.authorId, name: q.authorName }),
        ce('span', null, timeAgo(q.createdAt)),
        ce('span', null, pluralize(num(q.commentCount, 0), 'comment')),
        ce('span', { className: 'cm-spacer' }),
        ce('button', {
          className: 'cm-linkbtn', 'aria-expanded': open ? 'true' : 'false',
          onClick: function () { setOpen(!open); }
        }, open ? 'Hide answer' : 'Show answer + discuss'),
        !mine ? ce('button', {
          className: 'cm-linkbtn danger', onClick: function () { props.onReport(q); }
        }, 'Report') : null,
        (mine || isAdmin()) ? ce('button', {
          className: 'cm-linkbtn danger', onClick: function () { props.onDelete(q); }
        }, 'Delete') : null,
        isAdmin() ? ce('button', {
          className: 'cm-linkbtn', onClick: function () { props.onFeature(q); }
        }, q.featured ? 'Unfeature' : 'Feature') : null
      )
    );

    return ce('div', { className: 'cm-item' + (q.featured ? ' cm-featured' : '') + (q.removed ? ' cm-removed' : '') },
      ce(VoteBar, {
        score: q.score, my: props.myVote, disabled: !props.canVote,
        reason: props.voteReason, onVote: function (d) { props.onVote(q, d); }
      }),
      body
    );
  }

  /* ------------------------------------------------- practice runner ---- */

  function CommunityPractice(props) {
    var questions = props.questions || [];
    var s0 = useState(0);      var idx = s0[0], setIdx = s0[1];
    var s1 = useState([]);     var picked = s1[0], setPicked = s1[1];
    var s2 = useState(false);  var checked = s2[0], setChecked = s2[1];
    var s3 = useState([]);     var results = s3[0], setResults = s3[1];
    var s4 = useState(false);  var done = s4[0], setDone = s4[1];

    var q = questions[idx];

    function toggle(i) {
      if (checked) return;
      setPicked(function (cur) {
        if (q.type === 'select-all') {
          return cur.indexOf(i) >= 0 ? cur.filter(function (c) { return c !== i; }) : cur.concat([i]);
        }
        return [i];
      });
    }

    function check() {
      if (!picked.length) return;
      var correct = (q.correct || []).slice().sort().join(',');
      var mine = picked.slice().sort().join(',');
      var ok = correct === mine;
      setResults(results.concat([{ id: q._id, ok: ok }]));
      setChecked(true);
    }

    function next() {
      if (idx + 1 >= questions.length) {
        finish();
        return;
      }
      setIdx(idx + 1); setPicked([]); setChecked(false);
    }

    function finish() {
      setDone(true);
      var right = results.filter(function (r) { return r.ok; }).length;
      var m = MMx();
      if (typeof m.setProgress === 'function') {
        m.setProgress(function (p) {
          var list = (p && p.communityPracticeResults) ? p.communityPracticeResults.slice(-49) : [];
          list.push({ date: now(), total: results.length, correct: right,
                      pct: results.length ? Math.round(right / results.length * 100) : 0 });
          return merge(p, { communityPracticeResults: list });
        });
      }
      recordActivity('practice', {
        text: myName() + ' practiced ' + pluralize(results.length, 'community question'),
        targetType: 'practice', targetId: ''
      });
    }

    if (!questions.length) {
      return ce('div', { className: 'cm-wrap' },
        ce('button', { className: 'btn btn-outline btn-sm', style: { marginBottom: 12 }, onClick: props.onExit }, '← Back'),
        ce(Empty, {
          icon: '◇', title: 'No community questions to practice yet',
          text: 'Once your cohort posts a few questions, the top-voted ones show up here as a practice set.',
          actions: ce('button', { className: 'btn btn-primary', onClick: props.onWrite }, 'Write the first question')
        })
      );
    }

    if (done) {
      var right2 = results.filter(function (r) { return r.ok; }).length;
      var pct = results.length ? Math.round(right2 / results.length * 100) : 0;
      return ce('div', { className: 'cm-wrap' },
        ce('div', { className: 'cm-empty' },
          ce('div', { className: 'cm-empty-ico', 'aria-hidden': 'true' }, pct >= 80 ? '✓' : '◔'),
          ce('div', { className: 'cm-empty-title' }, right2 + ' of ' + results.length + ' correct (' + pct + '%)'),
          ce('p', { className: 'cm-empty-text' },
            pct >= 80 ? 'Strong run. Try upvoting the questions that actually taught you something - it moves them up for everyone.'
                      : 'Every miss is a rationale you now know to reread. Open the ones you missed and read the discussion under them.'),
          ce('div', { className: 'cm-empty-actions' },
            ce('button', { className: 'btn btn-primary', onClick: props.onExit }, 'Back to the bank')
          )
        )
      );
    }

    var correctSet = {};
    (q.correct || []).forEach(function (i) { correctSet[i] = true; });

    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-head' },
        ce('button', { className: 'btn btn-outline btn-sm', onClick: props.onExit }, '← Exit'),
        ce('div', null,
          ce('h2', null, 'Community practice'),
          ce('p', { className: 'cm-sub' }, 'Question ' + (idx + 1) + ' of ' + questions.length + ' - top voted first')
        )
      ),
      ce('div', { className: 'cm-bar', style: { marginBottom: 16 } },
        ce('i', { style: { width: Math.round((idx / questions.length) * 100) + '%' } })),
      ce('div', { className: 'card' },
        ce('div', { className: 'cm-chip-row', style: { marginBottom: 10 } },
          ce(Chip, null, q.category || 'Other'),
          q.difficulty ? ce(Chip, { tone: String(q.difficulty).toLowerCase() }, q.difficulty) : null,
          q.type === 'select-all' ? ce(Chip, null, 'Select all that apply') : null
        ),
        ce('p', { className: 'question-text', style: { marginBottom: 14 } }, clean(q.text, LIMIT.qtext)),
        ce('div', { className: 'cm-rows' },
          (q.options || []).map(function (o, i) {
            var sel = picked.indexOf(i) >= 0;
            var cls = 'cm-opt';
            if (checked) {
              if (correctSet[i]) cls += ' right';
              else if (sel) cls += ' wrong';
            } else if (sel) cls += ' sel';
            return ce('button', {
              key: i, className: cls, onClick: function () { toggle(i); },
              'aria-pressed': sel ? 'true' : 'false', disabled: checked
            },
              ce('span', { className: 'cm-opt-key', 'aria-hidden': 'true' }, letter(i)),
              ce('span', null, clean(o, LIMIT.option)),
              checked && correctSet[i] ? ce('span', { style: { marginLeft: 'auto', fontWeight: 800, color: 'var(--green-fg, #4ade80)' } }, '✓') : null,
              checked && sel && !correctSet[i] ? ce('span', { style: { marginLeft: 'auto', fontWeight: 800, color: 'var(--red-fg, #f87171)' } }, '✕') : null
            );
          })
        ),
        checked ? ce('div', { className: 'cm-banner good', style: { marginTop: 14 } },
          ce('span', { className: 'cm-banner-ico', 'aria-hidden': 'true' }, '✎'),
          ce('div', null,
            ce('b', null, 'Rationale: '),
            ce(RichText, { text: q.rationale, max: LIMIT.rationale }),
            ce('div', { className: 'cm-mini', style: { marginTop: 8 } },
              'Written by ' + clean(q.authorName, LIMIT.name))
          )
        ) : null,
        ce('div', { className: 'cm-actions end', style: { marginTop: 14 } },
          !checked
            ? ce('button', { className: 'btn btn-primary', onClick: check, disabled: !picked.length }, 'Check answer')
            : ce('button', { className: 'btn btn-primary', onClick: next },
                idx + 1 >= questions.length ? 'See results' : 'Next question')
        )
      )
    );
  }

  /* ------------------------------------------------------- the bank ----- */

  function CommunityQuestionBank(props) {
    var p = props || {};
    var gate = useCommunityGate();
    var s0 = useState('top');       var sort = s0[0], setSort = s0[1];
    var s1 = useState('');          var search = s1[0], setSearch = s1[1];
    var s2 = useState('');          var cat = s2[0], setCat = s2[1];
    var s3 = useState('');          var diff = s3[0], setDiff = s3[1];
    var s4 = useState(p.seed ? 'submit' : 'list'); var view = s4[0], setView = s4[1];
    var s5 = useState(null);        var reporting = s5[0], setReporting = s5[1];
    var s6 = useState([]);          var practiceSet = s6[0], setPracticeSet = s6[1];
    var s7 = useState(false);       var loadingPractice = s7[0], setLoadingPractice = s7[1];

    // Arriving with a draft (from the cold-start panel) opens the form on it.
    useEffect(function () { if (p.seed) setView('submit'); }, [p.seed]);

    var sortDef = Q_SORTS.filter(function (s) { return s.id === sort; })[0] || Q_SORTS[0];
    var list = usePaged({ path: P.questions, orderBy: sortDef.field, pageSize: PAGE, key: sort, enabled: gate.hasDb });
    var voteState = useMyVotes(list.items.map(function (i) { return 'question:' + i._id; }));
    var votes = voteState[0], setVote = voteState[1];

    var filtered = useMemo(function () {
      var term = clean(search, 60).toLowerCase();
      return list.items.filter(function (q) {
        if (q.removed && q.authorId !== myId() && !isAdmin()) return false;
        if (cat && q.category !== cat) return false;
        if (diff && q.difficulty !== diff) return false;
        if (term) {
          var hay = ((q.text || '') + ' ' + (q.topic || '') + ' ' + (q.category || '') + ' ' +
                     (q.rationale || '') + ' ' + (q.authorName || '')).toLowerCase();
          if (hay.indexOf(term) < 0) return false;
        }
        return true;
      }).sort(function (a, b) {
        if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1; // instructor picks pin to top
        return 0;
      });
    }, [list.items, search, cat, diff]);

    function onVote(q, dir) {
      if (!gate.canPost) { toast(gate.blockReason || 'Sign in to vote on your cohort\'s questions.', 'info'); return; }
      var tid = 'question:' + q._id;
      var prev = num(votes[tid], 0);
      var next = prev === dir ? 0 : dir;
      var delta = next - prev;
      setVote(tid, next);                                     // optimistic
      list.patch(q._id, { score: num(q.score, 0) + delta });
      castVote({
        targetId: tid, contentPath: P.questions + '/' + q._id, dir: dir, prev: prev,
        authorId: q.authorId
      })['catch'](function () {
        setVote(tid, prev);                                   // rollback
        list.patch(q._id, { score: num(q.score, 0) });
        toast('Your vote did not save - we could not reach the server. It has been put back.', 'error');
      });
    }

    function onFeature(q) {
      if (!isAdmin()) return;
      var nextVal = !q.featured;
      list.patch(q._id, { featured: nextVal });
      updateAt(P.questions + '/' + q._id, { featured: nextVal, featuredBy: nextVal ? myName() : null })
        .then(function () {
          if (nextVal && q.authorId) {
            bumpCounter(P.stats + '/' + q.authorId + '/featured', 1);
            notify(q.authorId, { type: 'featured', text: 'An instructor featured your question.',
                                 targetType: 'question', targetId: q._id });
          }
        })['catch'](function () {
          list.patch(q._id, { featured: !nextVal });
          toast('Could not change the instructor pick. Nothing was saved.', 'error');
        });
    }

    function onDelete(q) {
      var mine = q.authorId === myId();
      if (!mine && !isAdmin()) return;
      var reason = '';
      if (!mine) {
        reason = window.prompt('Reason for removal (the author will see this):', 'Clinically inaccurate');
        if (reason === null) return;
      } else if (!window.confirm('Delete your question? This cannot be undone.')) {
        return;
      }
      if (mine) {
        list.drop(q._id);
        writeAt(P.questions + '/' + q._id, null)['catch'](function () {
          toast('Could not delete that question - it is still there. Try again.', 'error'); list.reload();
        });
      } else {
        list.patch(q._id, { removed: true, removalReason: clean(reason, LIMIT.reason) });
        removeContent('question', q._id, P.questions + '/' + q._id, clean(reason, LIMIT.reason), q.authorId);
      }
    }

    function startPractice() {
      setLoadingPractice(true);
      fetchPage(P.questions, 'score', 20, null).then(function (rows) {
        var usable = rows.filter(function (r) { return !r.removed && r.options && r.options.length >= 2; });
        setPracticeSet(usable);
        setLoadingPractice(false);
        setView('practice');
      })['catch'](function () {
        setLoadingPractice(false);
        toast('Could not load the practice set. Check your connection and try again.', 'error');
      });
    }

    if (!gate.hasDb) return ce(OfflineWall, null);

    if (view === 'practice') {
      return ce(CommunityPractice, {
        questions: practiceSet,
        onExit: function () { setView('list'); },
        onWrite: function () { setView('submit'); }
      });
    }

    if (view === 'submit') {
      if (!gate.canPost) {
        return ce('div', { className: 'cm-wrap' },
          ce('button', { className: 'btn btn-outline btn-sm', style: { marginBottom: 12 }, onClick: function () { setView('list'); } }, '← Back'),
          gate.banned ? ce(BannedNotice, { reason: gate.banReason }) : ce(SignInWall, null)
        );
      }
      return ce('div', { className: 'cm-wrap' },
        ce('div', { className: 'cm-head' },
          ce('button', {
            className: 'btn btn-outline btn-sm',
            onClick: function () { setView('list'); if (p.onSeedUsed) p.onSeedUsed(); }
          }, '← Back'),
          ce('div', null, ce('h2', null, 'Write a question'),
            ce('p', { className: 'cm-sub' },
              p.seed ? 'Started from one you missed. The stem and options are filled in - the rationale is yours.'
                     : 'It goes straight into the shared bank.'))
        ),
        ce(QuestionSubmit, {
          initial: p.seed || null,
          onCancel: function () { setView('list'); if (p.onSeedUsed) p.onSeedUsed(); },
          onDone: function (row) { list.prepend(row); setView('list'); if (p.onSeedUsed) p.onSeedUsed(); }
        })
      );
    }

    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-head' },
        ce('div', { style: { flex: '1 1 200px' } },
          ce('h2', null, 'Question bank'),
          ce('p', { className: 'cm-sub' }, 'Practice questions written by your cohort. The useful ones rise.')
        ),
        ce('div', { className: 'cm-actions' },
          ce('button', { className: 'btn btn-outline', onClick: startPractice, disabled: loadingPractice },
            loadingPractice ? 'Loading...' : 'Practice top questions'),
          ce('button', { className: 'btn btn-primary', onClick: function () { setView('submit'); } }, '+ Write a question')
        )
      ),

      gate.banned ? ce(BannedNotice, { reason: gate.banReason }) : null,

      ce('div', { className: 'cm-toolbar' },
        ce('input', {
          type: 'text', className: 'cm-input cm-search', value: search, maxLength: 60,
          placeholder: 'Search loaded questions...', 'aria-label': 'Search questions',
          onChange: function (e) { setSearch(e.target.value); }
        }),
        ce('select', {
          className: 'cm-select', style: { flex: '0 1 150px' }, value: cat, 'aria-label': 'Filter by category',
          onChange: function (e) { setCat(e.target.value); }
        },
          ce('option', { value: '' }, 'All categories'),
          CATEGORIES.map(function (c) { return ce('option', { key: c, value: c }, c); })
        ),
        ce('select', {
          className: 'cm-select', style: { flex: '0 1 130px' }, value: diff, 'aria-label': 'Filter by difficulty',
          onChange: function (e) { setDiff(e.target.value); }
        },
          ce('option', { value: '' }, 'Any difficulty'),
          DIFFICULTIES.map(function (d) { return ce('option', { key: d, value: d }, d); })
        )
      ),

      ce(Segmented, {
        label: 'Sort', ariaLabel: 'Sort questions', value: sort,
        options: Q_SORTS.map(function (s) { return { id: s.id, label: s.label }; }),
        onChange: setSort
      }),

      list.error ? ce(ErrorBox, { error: list.error, onRetry: list.reload }) : null,
      list.loading && !list.items.length ? ce(Spinner, { label: 'Loading questions...' }) : null,

      !list.loading && !list.items.length && !list.error
        ? ce(Empty, {
            icon: '◇',
            title: 'The question bank is empty - be the one who starts it',
            text: 'Post the question from lecture that half the class got wrong. One good question with a real rationale is worth an hour of rereading.',
            actions: ce('button', { className: 'btn btn-primary', onClick: function () { setView('submit'); } }, 'Write the first question'),
            tips: [
              'Pull one straight from your last ATI practice and rewrite it in your own words',
              'Priority questions ("which client do you see first") get the most discussion',
              'Always include the rationale - it is required, and it is the part people study'
            ]
          })
        : null,

      list.items.length && !filtered.length
        ? ce(Empty, {
            icon: '⌕', title: 'Nothing matches those filters',
            text: 'Try clearing the search or widening the category. Search only looks at the questions already loaded - hit Load more to pull in older ones.',
            actions: ce('button', {
              className: 'btn btn-outline',
              onClick: function () { setSearch(''); setCat(''); setDiff(''); }
            }, 'Clear filters')
          })
        : null,

      ce('div', { className: 'cm-list' },
        filtered.map(function (q) {
          return ce(QuestionCard, {
            key: q._id, q: q, myVote: votes['question:' + q._id],
            canVote: gate.canPost, voteReason: gate.blockReason,
            onVote: onVote, onReport: setReporting, onFeature: onFeature, onDelete: onDelete
          });
        })
      ),

      ce(LoadMore, { more: list.more, loading: list.loading, onClick: list.loadMore, label: 'Load more questions' }),

      reporting ? ce(ReportDialog, {
        targetType: 'question', targetId: reporting._id,
        targetPath: P.questions + '/' + reporting._id,
        preview: reporting.text, authorId: reporting.authorId, authorName: reporting.authorName,
        onClose: function () { setReporting(null); },
        onDone: function () { setReporting(null); }
      }) : null
    );
  }

  /* =========================================================================
   * 3. DISCUSSION - threaded comments on ANY target + standalone topic threads
   * ====================================================================== */

  var PATH_THREADS = 'community/threads';   // .indexOn ["createdAt","score","commentCount","helpWanted","authorId"]

  /* ------------------------------------------------ mention autocomplete */

  function mentionToken(name) {
    return '@' + clean(name, LIMIT.name).replace(/\s+/g, '');
  }

  function MentionTextarea(props) {
    var s0 = useState([]);    var people = s0[0], setPeople = s0[1];
    var s1 = useState(null);  var query = s1[0], setQuery = s1[1];
    var s2 = useState(0);     var hi = s2[0], setHi = s2[1];
    var taRef = useRef(null);

    useEffect(function () {
      var live = true;
      loadCohort().then(function (list) { if (live) setPeople(list); });
      return function () { live = false; };
    }, []);

    var matches = useMemo(function () {
      if (query === null) return [];
      var q = String(query).toLowerCase();
      var pool = people.filter(function (p) { return p._id !== myId() && p.name; });
      var res = pool.filter(function (p) {
        return !q || String(p.name).toLowerCase().replace(/\s+/g, '').indexOf(q) >= 0;
      });
      return res.slice(0, 6);
    }, [query, people]);

    function scanCaret(el) {
      var pos = el.selectionStart || 0;
      var before = el.value.slice(0, pos);
      var m = before.match(/@([A-Za-z0-9_.\-]{0,30})$/);
      if (m) { setQuery(m[1]); setHi(0); } else { setQuery(null); }
    }

    function pick(person) {
      var el = taRef.current;
      if (!el) return;
      var pos = el.selectionStart || 0;
      var before = el.value.slice(0, pos).replace(/@([A-Za-z0-9_.\-]{0,30})$/, '');
      var after = el.value.slice(pos);
      var token = mentionToken(person.name) + ' ';
      props.onChange(before + token + after);
      if (props.onMention) props.onMention(person);
      setQuery(null);
      window.setTimeout(function () {
        if (taRef.current) {
          taRef.current.focus();
          var p = (before + token).length;
          try { taRef.current.setSelectionRange(p, p); } catch (e) { /* ignore */ }
        }
      }, 0);
    }

    function onKeyDown(e) {
      if (query === null || !matches.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi((hi + 1) % matches.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((hi - 1 + matches.length) % matches.length); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pick(matches[hi]); }
      else if (e.key === 'Escape') { setQuery(null); }
    }

    return ce('div', { className: 'cm-composer' },
      ce('textarea', {
        ref: taRef, className: 'cm-textarea', value: props.value, maxLength: props.max || LIMIT.comment,
        placeholder: props.placeholder || 'Add to the discussion. **bold**, `values`, and @names work.',
        'aria-label': props.label || 'Your comment',
        style: props.style,
        onKeyDown: onKeyDown,
        onBlur: function () { window.setTimeout(function () { setQuery(null); }, 150); },
        onChange: function (e) { props.onChange(e.target.value); scanCaret(e.target); },
        onClick: function (e) { scanCaret(e.target); }
      }),
      (query !== null && matches.length) ? ce('div', {
        className: 'cm-mention-pop', style: { left: 8, bottom: 8 }, role: 'listbox', 'aria-label': 'Mention a classmate'
      },
        matches.map(function (p, i) {
          return ce('button', {
            key: p._id, className: 'cm-mention-opt' + (i === hi ? ' on' : ''), role: 'option',
            'aria-selected': i === hi ? 'true' : 'false',
            onMouseDown: function (e) { e.preventDefault(); pick(p); }
          },
            ce('span', { className: 'cm-avatar', 'aria-hidden': 'true' }, initials(p.name)),
            ce('span', null, clean(p.name, LIMIT.name))
          );
        })
      ) : null
    );
  }

  /* ------------------------------------------------------ one comment --- */

  function CommentNode(props) {
    var c = props.c;
    var s0 = useState(false); var replying = s0[0], setReplying = s0[1];
    var s1 = useState('');    var draft = s1[0], setDraft = s1[1];
    var mentioned = useRef({});
    var mine = c.authorId === myId();
    var canMarkBest = props.canMarkBest && !mine && !c.parentId;

    function send() {
      var body = clean(draft, LIMIT.comment);
      if (body.length < 2) return;
      props.onReply(c, body, mentioned.current);
      setDraft(''); setReplying(false);
      mentioned.current = {};
    }

    return ce('div', { className: 'cm-comment' + (c.best ? ' best' : '') + (c._pending ? ' cm-removed' : '') },
      ce('div', { className: 'cm-comment-head' },
        ce(AuthorChip, { uid: c.authorId, name: c.authorName }),
        ce('span', { className: 'cm-mini' }, c._pending ? 'sending...' : timeAgo(c.createdAt)),
        c.best ? ce('span', { className: 'cm-flag' , style: { color: 'var(--green-fg, #4ade80)' } }, '✓ Best answer') : null,
        c.helpWanted ? ce('span', { className: 'cm-flag help' }, '⛑ Still stuck') : null
      ),
      c.removed
        ? ce('div', { className: 'cm-removed-note' },
            ce('b', null, 'Removed by a moderator. '), 'Reason: ' + clean(c.removalReason, LIMIT.reason))
        : ce(RichText, { text: c.text, max: LIMIT.comment }),
      ce('div', { className: 'cm-comment-foot' },
        ce('button', {
          className: 'cm-linkbtn', disabled: !props.canPost,
          'aria-pressed': num(props.myVote, 0) === 1 ? 'true' : 'false',
          title: props.canPost ? 'Upvote this answer' : props.blockReason,
          onClick: function () { props.onVote(c, 1); }
        }, '▲ Helpful (' + num(c.score, 0) + ')'),
        props.canPost ? ce('button', {
          className: 'cm-linkbtn', onClick: function () { setReplying(!replying); }
        }, replying ? 'Cancel' : 'Reply') : null,
        canMarkBest ? ce('button', {
          className: 'cm-linkbtn', onClick: function () { props.onBest(c); }
        }, c.best ? 'Unmark best answer' : 'Mark best answer') : null,
        !mine ? ce('button', {
          className: 'cm-linkbtn danger', onClick: function () { props.onReport(c); }
        }, 'Report') : null,
        (mine || isAdmin()) ? ce('button', {
          className: 'cm-linkbtn danger', onClick: function () { props.onDelete(c); }
        }, 'Delete') : null
      ),
      replying ? ce('div', { style: { marginTop: 10 } },
        ce(MentionTextarea, {
          value: draft, max: LIMIT.comment, style: { minHeight: 70 },
          placeholder: 'Reply to ' + clean(c.authorName, LIMIT.name) + '...',
          onChange: setDraft,
          onMention: function (p) { mentioned.current[p._id] = clean(p.name, LIMIT.name); }
        }),
        ce('div', { className: 'cm-actions end', style: { marginTop: 8 } },
          ce('button', { className: 'btn btn-outline btn-sm', onClick: function () { setReplying(false); } }, 'Cancel'),
          ce('button', { className: 'btn btn-primary btn-sm', onClick: send, disabled: clean(draft).length < 2 }, 'Post reply')
        )
      ) : null,
      props.children && props.children.length
        ? ce('div', { className: 'cm-kids' }, props.children)
        : null
    );
  }

  /* -------------------------------------------------- discussion thread - */

  function CommunityDiscussion(props) {
    // props: { targetId, targetType, targetTitle, targetAuthorId, compact }
    var gate = useCommunityGate();
    var path = P.comments + '/' + props.targetId;
    var s0 = useState('top');   var sort = s0[0], setSort = s0[1];
    var s1 = useState('');      var draft = s1[0], setDraft = s1[1];
    var s2 = useState(false);   var posting = s2[0], setPosting = s2[1];
    var s3 = useState(null);    var reporting = s3[0], setReporting = s3[1];
    var s4 = useState('');      var err = s4[0], setErr = s4[1];
    var s5 = useState(false);   var stuck = s5[0], setStuck = s5[1];
    var mentioned = useRef({});

    var list = usePaged({ path: path, orderBy: 'createdAt', pageSize: 25, enabled: gate.hasDb });
    var voteState = useMyVotes(list.items.map(function (c) { return 'comment:' + c._id; }));
    var votes = voteState[0], setVote = voteState[1];

    function bumpCommentCount(delta) {
      var t = String(props.targetId);
      var idx = t.indexOf(':');
      if (idx < 0) return;
      var kind = t.slice(0, idx), id = t.slice(idx + 1);
      var base = kind === 'question' ? P.questions
               : kind === 'scenario' ? P.scenarios
               : kind === 'thread'   ? PATH_THREADS
               : kind === 'deck'     ? P.decks
               : '';
      if (!base) return;
      bumpCounter(base + '/' + id + '/commentCount', delta)['catch'](function () { /* non-critical */ });
    }

    function post(parent, body, mentions) {
      if (!gate.canPost) { setErr(gate.blockReason); return; }
      var msg = rateCheck('comment');
      if (msg) { setErr(msg); return; }
      setErr(''); setPosting(true);

      var tempId = newId('tmp');
      var row = {
        text: clean(body, LIMIT.comment),
        parentId: parent ? (parent.parentId ? parent.parentId : parent._id) : '',
        replyToId: parent ? parent._id : '',
        replyToName: parent ? clean(parent.authorName, LIMIT.name) : '',
        authorId: myId(),
        authorName: myName(),
        createdAt: now(),
        score: 0,
        best: false,
        helpWanted: !parent && stuck,
        removed: false
      };
      list.prepend(merge(row, { _id: tempId, _pending: true }));   // optimistic

      pushAt(path, row).then(function (id) {
        rateNote('comment');
        list.drop(tempId);
        list.prepend(merge(row, { _id: id }));
        bumpCommentCount(1);
        bumpStat('answers', 1);
        if (parent && parent.helpWanted) bumpStat('helpWantedAnswers', 1);
        if (!parent && props.helpWantedTarget) bumpStat('helpWantedAnswers', 1);

        // notify the person being replied to and anyone @mentioned
        if (parent && parent.authorId) {
          notify(parent.authorId, {
            type: 'reply', text: myName() + ' replied to you: ' + clean(body, 90),
            targetType: props.targetType, targetId: props.targetId
          });
        } else if (props.targetAuthorId) {
          notify(props.targetAuthorId, {
            type: 'reply', text: myName() + ' commented on your ' + (props.targetType || 'post'),
            targetType: props.targetType, targetId: props.targetId
          });
        }
        var k;
        for (k in mentions) {
          if (Object.prototype.hasOwnProperty.call(mentions, k)) {
            notify(k, { type: 'mention', text: myName() + ' mentioned you: ' + clean(body, 90),
                        targetType: props.targetType, targetId: props.targetId });
          }
        }
        recordActivity('comment', {
          text: myName() + ' answered in ' + (props.targetTitle ? clean(props.targetTitle, 80) : 'a discussion'),
          targetType: props.targetType, targetId: props.targetId
        });
        setPosting(false);
        setStuck(false);
      })['catch'](function (e) {
        list.drop(tempId);                                        // rollback
        setPosting(false);
        setErr(writeErrText(e, 'Your comment did not save. Try again - the text is still in the box.'));
      });
    }

    function sendRoot() {
      var body = clean(draft, LIMIT.comment);
      if (body.length < 2) { setErr('Write at least a couple of words.'); return; }
      post(null, body, mentioned.current);
      setDraft('');
      mentioned.current = {};
    }

    function onVote(c, dir) {
      if (!gate.canPost) { toast(gate.blockReason || 'Sign in to vote on your cohort\'s questions.', 'info'); return; }
      var tid = 'comment:' + c._id;
      var prev = num(votes[tid], 0);
      var next = prev === dir ? 0 : dir;
      var delta = next - prev;
      setVote(tid, next);
      list.patch(c._id, { score: num(c.score, 0) + delta });
      castVote({ targetId: tid, contentPath: path + '/' + c._id, dir: dir, prev: prev,
                 authorId: c.authorId, helpful: true })['catch'](function () {
        setVote(tid, prev);
        list.patch(c._id, { score: num(c.score, 0) });
        toast('Your vote did not save. It has been put back - try again.', 'error');
      });
    }

    function onBest(c) {
      var nextVal = !c.best;
      list.patch(c._id, { best: nextVal });
      updateAt(path + '/' + c._id, { best: nextVal }).then(function () {
        if (nextVal && c.authorId) {
          bumpCounter(P.stats + '/' + c.authorId + '/bestAnswers', 1);
          notify(c.authorId, { type: 'best', text: 'Your answer was marked best answer.',
                               targetType: props.targetType, targetId: props.targetId });
        }
      })['catch'](function () {
        list.patch(c._id, { best: !nextVal });
        toast('Could not mark that as the best answer. Nothing was saved.', 'error');
      });
    }

    function onDelete(c) {
      var mine = c.authorId === myId();
      if (!mine && !isAdmin()) return;
      if (mine) {
        if (!window.confirm('Delete your comment?')) return;
        list.drop(c._id);
        writeAt(path + '/' + c._id, null).then(function () { bumpCommentCount(-1); })
          ['catch'](function () { toast('Could not delete that comment - it is still there. Try again.', 'error'); list.reload(); });
      } else {
        var reason = window.prompt('Reason for removal (the author will see this):', 'Against community guidelines');
        if (reason === null) return;
        list.patch(c._id, { removed: true, removalReason: clean(reason, LIMIT.reason) });
        removeContent('comment', c._id, path + '/' + c._id, clean(reason, LIMIT.reason), c.authorId);
      }
    }

    // Build the tree client-side from the bounded page we already fetched.
    var tree = useMemo(function () {
      var roots = [], byParent = {};
      list.items.forEach(function (c) {
        if (c.parentId) {
          if (!byParent[c.parentId]) byParent[c.parentId] = [];
          byParent[c.parentId].push(c);
        } else {
          roots.push(c);
        }
      });
      function cmp(a, b) {
        if (sort === 'top') {
          if (!!b.best !== !!a.best) return b.best ? 1 : -1;
          if (num(b.score, 0) !== num(a.score, 0)) return num(b.score, 0) - num(a.score, 0);
        }
        return num(b.createdAt, 0) - num(a.createdAt, 0);
      }
      roots.sort(cmp);
      var k;
      for (k in byParent) {
        if (Object.prototype.hasOwnProperty.call(byParent, k)) {
          byParent[k].sort(function (a, b) { return num(a.createdAt, 0) - num(b.createdAt, 0); });
        }
      }
      return { roots: roots, byParent: byParent };
    }, [list.items, sort]);

    function nodeProps(c) {
      return {
        key: c._id, c: c, myVote: votes['comment:' + c._id],
        canPost: gate.canPost, blockReason: gate.blockReason,
        canMarkBest: props.targetAuthorId === myId(),
        onVote: onVote, onReply: post, onBest: onBest,
        onReport: setReporting, onDelete: onDelete
      };
    }

    var count = list.items.length;

    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-head', style: { marginBottom: 10 } },
        ce('div', { style: { flex: '1 1 auto' } },
          ce('h2', { style: { fontSize: props.compact ? '1rem' : '1.25rem' } },
            'Discussion' + (count ? ' (' + count + ')' : '')),
          props.compact ? null : ce('p', { className: 'cm-sub' }, 'Be the classmate you wish you had at 11pm.')
        ),
        count > 1 ? ce(Segmented, {
          label: 'Sort', ariaLabel: 'Sort comments', value: sort,
          options: [{ id: 'top', label: 'Top' }, { id: 'newest', label: 'Newest' }],
          onChange: setSort
        }) : null
      ),

      gate.canPost ? ce('div', { style: { marginBottom: 14 } },
        ce(MentionTextarea, {
          value: draft, max: LIMIT.comment, style: { minHeight: props.compact ? 70 : 90 },
          placeholder: 'Answer, add a mnemonic, or ask what you are stuck on. Type @ to tag someone.',
          onChange: setDraft,
          onMention: function (p) { mentioned.current[p._id] = clean(p.name, LIMIT.name); }
        }),
        ce('div', { className: 'cm-actions', style: { marginTop: 8 } },
          ce('label', { className: 'cm-actions', style: { gap: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text2)' } },
            ce('input', { type: 'checkbox', checked: stuck, onChange: function (e) { setStuck(e.target.checked); } }),
            ce('span', null, '⛑ I am stuck - flag this Help Wanted')
          ),
          ce('span', { className: 'cm-spacer' }),
          ce('button', {
            className: 'btn btn-primary btn-sm', onClick: sendRoot,
            disabled: posting || clean(draft).length < 2
          }, posting ? 'Posting...' : 'Post')
        ),
        err ? ce('div', { className: 'cm-err', role: 'alert' }, err) : null
      ) : ce('div', { className: 'cm-banner' },
        ce('span', { className: 'cm-banner-ico', 'aria-hidden': 'true' }, 'i'),
        ce('div', null, gate.blockReason || 'Sign in to join the discussion.')),

      list.error ? ce(ErrorBox, { error: list.error, onRetry: list.reload }) : null,
      list.loading && !count ? ce(Spinner, { label: 'Loading discussion...' }) : null,

      !list.loading && !count && !list.error
        ? ce(Empty, {
            icon: '💬',
            title: 'No comments yet',
            text: props.emptyText || 'Nobody has said anything here. If this helped you, say why - if it confused you, say that too. Both are useful.'
          })
        : null,

      ce('div', { className: 'cm-thread' },
        tree.roots.map(function (c) {
          var kids = (tree.byParent[c._id] || []).map(function (k) {
            return ce(CommentNode, nodeProps(k));
          });
          return ce(CommentNode, merge(nodeProps(c), { children: kids }));
        })
      ),

      ce(LoadMore, { more: list.more, loading: list.loading, onClick: list.loadMore, label: 'Load older comments' }),

      reporting ? ce(ReportDialog, {
        targetType: 'comment', targetId: reporting._id, targetPath: path + '/' + reporting._id,
        preview: reporting.text, authorId: reporting.authorId, authorName: reporting.authorName,
        onClose: function () { setReporting(null); }, onDone: function () { setReporting(null); }
      }) : null
    );
  }

  /* --------------------------------------------- standalone topic board - */

  function NewThreadForm(props) {
    var s0 = useState('');   var title = s0[0], setTitle = s0[1];
    var s1 = useState('');   var body = s1[0], setBody = s1[1];
    var s2 = useState(CATEGORIES[0]); var cat = s2[0], setCat = s2[1];
    var s3 = useState(false); var help = s3[0], setHelp = s3[1];
    var s4 = useState('');   var err = s4[0], setErr = s4[1];
    var s5 = useState(false); var busy = s5[0], setBusy = s5[1];

    function submit() {
      var t = clean(title, LIMIT.title), b = clean(body, LIMIT.comment);
      if (t.length < 6) { setErr('Give the thread a real title - at least 6 characters.'); return; }
      if (b.length < 10) { setErr('Add some detail so people can actually help.'); return; }
      var msg = rateCheck('thread');
      if (msg) { setErr(msg); return; }
      setBusy(true); setErr('');
      var row = {
        title: t, body: b, category: cat, helpWanted: help,
        authorId: myId(), authorName: myName(), createdAt: now(),
        score: 0, commentCount: 0, resolved: false, removed: false
      };
      pushAt(PATH_THREADS, row).then(function (id) {
        rateNote('thread');
        recordActivity('thread', {
          text: myName() + ' started a thread: ' + clean(t, 80),
          targetType: 'thread', targetId: id
        });
        props.onDone(merge(row, { _id: id }));
      })['catch'](function (e) {
        setBusy(false);
        setErr(writeErrText(e, 'Could not post that thread. Try again - nothing you wrote is lost.'));
      });
    }

    return ce('div', null,
      ce(Field, { label: 'Title', id: 'cm-t-title', required: true, max: LIMIT.title, value: title,
        hint: 'Ask the actual question. "Why is the answer fundal massage and not oxytocin?" beats "help".' },
        ce('input', { id: 'cm-t-title', type: 'text', className: 'cm-input', value: title, maxLength: LIMIT.title,
          onChange: function (e) { setTitle(e.target.value); }, placeholder: 'Why is dig held for HR under 60 but not for...' })
      ),
      ce(Field, { label: 'Details', id: 'cm-t-body', required: true, max: LIMIT.comment, value: body,
        hint: 'Show your reasoning - what you thought the answer was and why. **bold** and `values` work.' },
        ce(MentionTextarea, { value: body, max: LIMIT.comment, onChange: setBody,
          placeholder: 'I keep missing these. Here is what I thought...' })
      ),
      ce('div', { className: 'cm-toolbar' },
        ce('div', { style: { flex: '1 1 160px' } },
          ce('label', { className: 'cm-label', htmlFor: 'cm-t-cat' }, 'Category'),
          ce('select', { id: 'cm-t-cat', className: 'cm-select', value: cat,
            onChange: function (e) { setCat(e.target.value); } },
            CATEGORIES.map(function (c) { return ce('option', { key: c, value: c }, c); }))
        ),
        ce('label', { className: 'cm-actions', style: { gap: 6, cursor: 'pointer', flex: '1 1 200px', color: 'var(--text2)', fontSize: '0.85rem' } },
          ce('input', { type: 'checkbox', checked: help, onChange: function (e) { setHelp(e.target.checked); } }),
          ce('span', null, '⛑ Flag Help Wanted - pins it to the top for peers')
        )
      ),
      err ? ce('div', { className: 'cm-err', role: 'alert' }, err) : null,
      ce('div', { className: 'cm-actions end' },
        ce('button', { className: 'btn btn-outline', onClick: props.onCancel }, 'Cancel'),
        ce('button', { className: 'btn btn-primary', onClick: submit, disabled: busy },
          busy ? 'Posting...' : 'Start thread')
      )
    );
  }

  function CommunityDiscussionBoard(props) {
    var gate = useCommunityGate();
    var s0 = useState('list');  var view = s0[0], setView = s0[1];
    var s1 = useState(null);    var active = s1[0], setActive = s1[1];
    var s2 = useState('newest'); var sort = s2[0], setSort = s2[1];
    var s3 = useState(null);    var reporting = s3[0], setReporting = s3[1];

    var list = usePaged({
      path: PATH_THREADS, orderBy: sort === 'top' ? 'score' : 'createdAt',
      pageSize: PAGE, key: sort, enabled: gate.hasDb
    });
    var voteState = useMyVotes(list.items.map(function (t) { return 'thread:' + t._id; }));
    var votes = voteState[0], setVote = voteState[1];

    function onVote(t, dir) {
      if (!gate.canPost) { toast(gate.blockReason || 'Sign in to vote on your cohort\'s questions.', 'info'); return; }
      var tid = 'thread:' + t._id;
      var prev = num(votes[tid], 0);
      var next = prev === dir ? 0 : dir;
      setVote(tid, next);
      list.patch(t._id, { score: num(t.score, 0) + (next - prev) });
      castVote({ targetId: tid, contentPath: PATH_THREADS + '/' + t._id, dir: dir, prev: prev, authorId: t.authorId })
        ['catch'](function () {
          setVote(tid, prev);
          list.patch(t._id, { score: num(t.score, 0) });
          toast('Your vote did not save. It has been put back - try again.', 'error');
        });
    }

    function toggleResolved(t) {
      if (t.authorId !== myId() && !isAdmin()) return;
      var nextVal = !t.resolved;
      list.patch(t._id, { resolved: nextVal, helpWanted: nextVal ? false : t.helpWanted });
      updateAt(PATH_THREADS + '/' + t._id, { resolved: nextVal, helpWanted: nextVal ? false : !!t.helpWanted })
        ['catch'](function () { list.patch(t._id, { resolved: !nextVal }); toast('Could not change whether this is resolved. It has been put back.', 'error'); });
    }

    if (!gate.hasDb) return ce(OfflineWall, null);

    if (view === 'new') {
      return ce('div', { className: 'cm-wrap' },
        ce('div', { className: 'cm-head' },
          ce('button', { className: 'btn btn-outline btn-sm', onClick: function () { setView('list'); } }, '← Back'),
          ce('div', null, ce('h2', null, 'Start a thread'))
        ),
        gate.canPost
          ? ce(NewThreadForm, {
              onCancel: function () { setView('list'); },
              onDone: function (row) { list.prepend(row); setActive(row); setView('detail'); }
            })
          : (gate.banned ? ce(BannedNotice, { reason: gate.banReason }) : ce(SignInWall, null))
      );
    }

    if (view === 'detail' && active) {
      return ce('div', { className: 'cm-wrap' },
        ce('div', { className: 'cm-head' },
          ce('button', { className: 'btn btn-outline btn-sm', onClick: function () { setView('list'); } }, '← All threads')
        ),
        ce('div', { className: 'cm-item' + (active.helpWanted ? ' cm-featured' : '') },
          ce(VoteBar, {
            score: active.score, my: votes['thread:' + active._id], disabled: !gate.canPost,
            reason: gate.blockReason, onVote: function (d) { onVote(active, d); }
          }),
          ce('div', { className: 'cm-item-main' },
            ce('div', { className: 'cm-chip-row', style: { marginBottom: 8 } },
              active.helpWanted ? ce('span', { className: 'cm-flag help' }, '⛑ Help wanted') : null,
              active.resolved ? ce('span', { className: 'cm-flag', style: { color: 'var(--green-fg, #4ade80)' } }, '✓ Resolved') : null,
              ce(Chip, null, active.category || 'Other')
            ),
            ce('h3', { className: 'cm-item-title' }, clean(active.title, LIMIT.title)),
            ce(RichText, { text: active.body, max: LIMIT.comment }),
            ce('div', { className: 'cm-item-foot' },
              ce(AuthorChip, { uid: active.authorId, name: active.authorName }),
              ce('span', null, timeAgo(active.createdAt)),
              ce('span', { className: 'cm-spacer' }),
              (active.authorId === myId() || isAdmin()) ? ce('button', {
                className: 'cm-linkbtn', onClick: function () { toggleResolved(active); }
              }, active.resolved ? 'Reopen' : 'Mark resolved') : null,
              active.authorId !== myId() ? ce('button', {
                className: 'cm-linkbtn danger', onClick: function () { setReporting(active); }
              }, 'Report') : null
            )
          )
        ),
        ce(CommunityDiscussion, {
          targetId: 'thread:' + active._id, targetType: 'thread',
          targetTitle: active.title, targetAuthorId: active.authorId,
          helpWantedTarget: !!active.helpWanted && !active.resolved,
          emptyText: 'No answers yet. If you know even part of this, say the part you know.'
        }),
        reporting ? ce(ReportDialog, {
          targetType: 'thread', targetId: reporting._id, targetPath: PATH_THREADS + '/' + reporting._id,
          preview: reporting.title, authorId: reporting.authorId, authorName: reporting.authorName,
          onClose: function () { setReporting(null); }, onDone: function () { setReporting(null); }
        }) : null
      );
    }

    var visible = list.items.filter(function (t) { return !t.removed || t.authorId === myId() || isAdmin(); });
    var helpWanted = visible.filter(function (t) { return t.helpWanted && !t.resolved; });
    var rest = visible.filter(function (t) { return !(t.helpWanted && !t.resolved); });

    function threadRow(t) {
      return ce('div', {
        key: t._id, className: 'cm-item cm-clickable' + (t.helpWanted && !t.resolved ? ' cm-featured' : ''),
        role: 'button', tabIndex: 0,
        onClick: function () { setActive(t); setView('detail'); },
        onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(t); setView('detail'); } }
      },
        ce(VoteBar, {
          score: t.score, my: votes['thread:' + t._id], disabled: !gate.canPost,
          reason: gate.blockReason, onVote: function (d) { onVote(t, d); }
        }),
        ce('div', { className: 'cm-item-main' },
          ce('div', { className: 'cm-chip-row', style: { marginBottom: 6 } },
            t.helpWanted && !t.resolved ? ce('span', { className: 'cm-flag help' }, '⛑ Help wanted') : null,
            t.resolved ? ce('span', { className: 'cm-flag', style: { color: 'var(--green-fg, #4ade80)' } }, '✓ Resolved') : null,
            ce(Chip, null, t.category || 'Other')
          ),
          ce('h3', { className: 'cm-item-title' }, clean(t.title, LIMIT.title)),
          ce('div', { className: 'cm-item-foot' },
            ce(AuthorChip, { uid: t.authorId, name: t.authorName }),
            ce('span', null, timeAgo(t.createdAt)),
            ce('span', null, pluralize(num(t.commentCount, 0), 'reply', 'replies'))
          )
        )
      );
    }

    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-head' },
        ce('div', { style: { flex: '1 1 200px' } },
          ce('h2', null, 'Discussion'),
          ce('p', { className: 'cm-sub' }, 'Ask what you are stuck on. Answer one thing you know.')
        ),
        ce('button', { className: 'btn btn-primary', onClick: function () { setView('new'); } }, '+ Start a thread')
      ),

      gate.banned ? ce(BannedNotice, { reason: gate.banReason }) : null,

      helpWanted.length ? ce('div', { style: { marginBottom: 18 } },
        ce('div', { className: 'cm-banner warn' },
          ce('span', { className: 'cm-banner-ico', 'aria-hidden': 'true' }, '⛑'),
          ce('div', null,
            ce('b', null, pluralize(helpWanted.length, 'classmate') + ' stuck right now. '),
            'Answering one of these is the fastest way to earn a Peer Mentor badge - and it is the whole point of this thing.')
        ),
        ce('div', { className: 'cm-list' }, helpWanted.map(threadRow))
      ) : null,

      ce(Segmented, {
        label: 'Sort', ariaLabel: 'Sort threads', value: sort,
        options: [{ id: 'newest', label: 'Newest' }, { id: 'top', label: 'Top' }],
        onChange: setSort
      }),

      list.error ? ce(ErrorBox, { error: list.error, onRetry: list.reload }) : null,
      list.loading && !visible.length ? ce(Spinner, { label: 'Loading threads...' }) : null,

      !list.loading && !visible.length && !list.error
        ? ce(Empty, {
            icon: '💬', title: 'No threads yet',
            text: 'This is the place for the question you are embarrassed to ask in clinical. Somebody else in your cohort has exactly the same one.',
            actions: ce('button', { className: 'btn btn-primary', onClick: function () { setView('new'); } }, 'Start the first thread'),
            tips: [
              'Post the concept that will not stick and flag it Help Wanted',
              'Share a mnemonic that actually worked for you',
              'Compare two look-alike meds you keep mixing up'
            ]
          })
        : ce('div', { className: 'cm-list' }, rest.map(threadRow)),

      ce(LoadMore, { more: list.more, loading: list.loading, onClick: list.loadMore, label: 'Load more threads' })
    );
  }

  /* =========================================================================
   * 2. SCENARIO WORKSHOP
   * ====================================================================== */

  var LAB_STATUS = ['normal', 'high', 'low', 'critical-high', 'critical-low'];
  var ORDER_CATS = ['medication', 'lab', 'imaging', 'respiratory', 'access', 'diet',
                    'monitoring', 'consult', 'procedure'];
  var IV_CATS = ['assessment', 'intervention', 'medication', 'communication', 'education', 'escalation'];

  var CAPS = { objectives: 8, history: 8, vitals: 6, labs: 16, orders: 14, interventions: 12, questions: 10 };

  function blankScenario() {
    return {
      title: '', category: 'Med-Surg 2', difficulty: 'Medium', durationMin: 20,
      summary: '',
      objectives: [''],
      patient: { name: '', age: '', sex: 'Female', weightKg: '', allergies: 'NKDA',
                 codeStatus: 'Full Code', diagnosis: '', history: [''] },
      vitalsTimeline: [{ atMin: 0, label: 'Baseline', bp: '', hr: '', rr: '', temp: '', spo2: '', pain: '', loc: '', note: '' }],
      labs: [],
      orders: [],
      interventions: [{ action: '', rationale: '', category: 'assessment', critical: true }],
      questions: [],
      pearls: [''],
      criticalErrors: ['']
    };
  }

  function validateScenario(d) {
    var e = {};
    if (clean(d.title).length < 4) e.title = 'Give the scenario a title.';
    if (clean(d.summary).length < 20) e.summary = 'Write a sentence or two on what this sim covers.';
    if (!clean(d.patient.name)) e.patientName = 'Use a fictional patient name.';
    if (!clean(d.patient.diagnosis)) e.diagnosis = 'What is the working diagnosis?';
    var base = d.vitalsTimeline[0];
    if (!base || (!clean(base.bp) && !clean(base.hr))) e.vitals = 'Fill in at least the baseline blood pressure or heart rate.';
    var ivs = d.interventions.filter(function (i) { return clean(i.action); });
    if (!ivs.length) e.interventions = 'Add at least one priority intervention - this is what gets graded.';
    var missingRationale = ivs.filter(function (i) { return !clean(i.rationale); }).length;
    if (missingRationale) e.interventions = missingRationale + ' intervention(s) still need a rationale.';
    var qs = d.questions.filter(function (q) { return clean(q.text); });
    var badQ = qs.filter(function (q) {
      return !clean(q.rationale) || !(q.correct || []).length ||
             q.options.filter(function (o) { return clean(o); }).length < 2;
    }).length;
    if (badQ) e.questions = badQ + ' question(s) are missing options, a keyed answer, or a rationale.';
    return e;
  }

  /** Convert the builder draft into the app's real scenario schema so
   *  SimulationHub can consume it unchanged. */
  function toSimScenario(doc) {
    var d = (doc && doc.data) ? doc.data : doc;
    if (!d) return null;
    var id = 'community-' + (doc && doc._id ? doc._id : slug(d.title));
    var qs = (d.questions || []).filter(function (q) { return clean(q.text); }).map(function (q, i) {
      return {
        id: id + '-q' + (i + 1),
        text: clean(q.text, LIMIT.qtext),
        type: q.type === 'select-all' ? 'select-all' : 'multiple-choice',
        options: (q.options || []).map(function (o) { return clean(o, LIMIT.option); })
                                  .filter(function (o) { return o.length; }),
        correct: (q.correct || []).slice(),
        rationale: clean(q.rationale, LIMIT.rationale),
        difficulty: d.difficulty || 'Medium'
      };
    });
    return {
      id: id,
      title: clean(d.title, LIMIT.title),
      fullTitle: clean(d.title, LIMIT.title),
      category: d.category || 'Med-Surg 2',
      course: 'Community',
      difficulty: d.difficulty || 'Medium',
      durationMin: num(d.durationMin, 20),
      icon: 'COMMUNITY',
      summary: clean(d.summary, LIMIT.summary),
      highYield: false,
      community: true,
      communityId: doc && doc._id ? doc._id : '',
      authorName: doc ? clean(doc.authorName, LIMIT.name) : '',
      objectives: (d.objectives || []).map(function (o) { return clean(o, 160); }).filter(Boolean),
      patient: {
        name: clean(d.patient.name, 60),
        age: clean(d.patient.age, 30),
        sex: d.patient.sex || '',
        weightKg: d.patient.weightKg === '' ? null : num(d.patient.weightKg, 0),
        allergies: String(d.patient.allergies || 'NKDA').split(',').map(function (a) { return clean(a, 40); }).filter(Boolean),
        codeStatus: clean(d.patient.codeStatus, 40),
        diagnosis: clean(d.patient.diagnosis, 120),
        history: (d.patient.history || []).map(function (h) { return clean(h, 160); }).filter(Boolean)
      },
      vitalsTimeline: (d.vitalsTimeline || []).map(function (v, i) {
        return {
          atMin: num(v.atMin, i * 5),
          label: clean(v.label, 40) || (i === 0 ? 'Baseline' : 'Change ' + i),
          bp: clean(v.bp, 20), hr: num(v.hr, 0), rr: num(v.rr, 0),
          temp: clean(v.temp, 20), spo2: num(v.spo2, 0),
          pain: clean(v.pain, 20), loc: clean(v.loc, 80),
          flags: [], note: clean(v.note, 200)
        };
      }),
      labs: (d.labs || []).filter(function (l) { return clean(l.name); }).map(function (l) {
        return { panel: clean(l.panel, 40), name: clean(l.name, 60), value: clean(l.value, 30),
                 unit: clean(l.unit, 20), status: l.status || 'normal',
                 normalRange: clean(l.normalRange, 40), interpretation: clean(l.interpretation, 200) };
      }),
      diagnostics: [],
      orders: (d.orders || []).filter(function (o) { return clean(o.text); }).map(function (o) {
        return { text: clean(o.text, 160), category: o.category || 'monitoring' };
      }),
      interventions: (d.interventions || []).filter(function (i) { return clean(i.action); }).map(function (iv, i) {
        return { id: id + '-iv' + (i + 1), order: i + 1, action: clean(iv.action, 200),
                 rationale: clean(iv.rationale, 400), category: iv.category || 'intervention',
                 critical: !!iv.critical, preventsDeterioration: false };
      }),
      medications: [],
      sbar: { situation: '', background: '', assessment: '', recommendation: '' },
      questions: qs,
      keyPoints: [],
      pearls: (d.pearls || []).map(function (p) { return clean(p, 200); }).filter(Boolean),
      successChecklist: [],
      criticalErrors: (d.criticalErrors || []).map(function (c) { return clean(c, 200); }).filter(Boolean),
      comparisons: [],
      dialogue: [],
      patientEducation: []
    };
  }

  /** Hand a published community scenario to the simulation engine. */
  function runInSim(doc) {
    var sim = toSimScenario(doc);
    if (!sim) { toast('That scenario could not be loaded. Its author may have removed it.', 'error'); return; }
    window.COMMUNITY_SIM_SCENARIOS = window.COMMUNITY_SIM_SCENARIOS || {};
    window.COMMUNITY_SIM_SCENARIOS[sim.id] = sim;
    if (window.MM) { window.MM.pendingSimScenario = sim; }
    if (window.ALL_SCENARIOS && window.ALL_SCENARIOS.push) {
      var exists = false;
      window.ALL_SCENARIOS.forEach(function (s) { if (s && s.id === sim.id) exists = true; });
      if (!exists) window.ALL_SCENARIOS.push(sim);
    }
    var hub = window.SimulationHub;
    if (hub && typeof hub.loadScenario === 'function') { hub.loadScenario(sim); return; }
    if (window.MM && typeof window.MM.navigate === 'function') {
      window.MM.navigate('simulations');
      toast('Loaded "' + sim.title + '" into the simulation engine.', 'success');
      return;
    }
    toast('Scenario is ready - open the Simulations page to run it.', 'info');
  }

  /* ------------------------------------------------------ row helpers --- */

  function RowShell(props) {
    return ce('div', { className: 'cm-rowitem' },
      ce('div', { style: { flex: '1 1 100%', display: 'flex', gap: 8, flexWrap: 'wrap' } }, props.children),
      props.onRemove ? ce('button', {
        className: 'cm-del', onClick: props.onRemove, 'aria-label': props.removeLabel || 'Remove row'
      }, '✕') : null
    );
  }

  function AddRowBtn(props) {
    if (props.count >= props.cap) {
      return ce('div', { className: 'cm-mini', style: { marginTop: 6 } },
        'Maximum ' + props.cap + ' - that is plenty for one scenario.');
    }
    return ce('button', { className: 'btn btn-outline btn-sm', style: { marginTop: 8 }, onClick: props.onAdd },
      props.label);
  }

  function txt(value, onChange, placeholder, aria, flex, max) {
    return ce('input', {
      type: 'text', className: 'cm-input', value: value === undefined || value === null ? '' : value,
      placeholder: placeholder, 'aria-label': aria, maxLength: max || 160,
      style: { flex: flex || '1 1 140px', minWidth: 0 },
      onChange: function (e) { onChange(e.target.value); }
    });
  }

  function sel(value, onChange, options, aria, flex) {
    return ce('select', {
      className: 'cm-select', value: value, 'aria-label': aria,
      style: { flex: flex || '0 1 150px', minWidth: 0 },
      onChange: function (e) { onChange(e.target.value); }
    }, options.map(function (o) { return ce('option', { key: o, value: o }, o); }));
  }

  /* ------------------------------------------------------- AI drafting -- */

  var AI_SCENARIO_SYSTEM =
    'You draft realistic nursing simulation scenarios for US pre-licensure students. ' +
    'Use standard, defensible clinical content. Use a clearly fictional patient name. ' +
    'Never include real patient data. Keep values internally consistent (vitals should match the pathology). ' +
    'Respond ONLY with JSON matching exactly this shape, no commentary:\n' +
    '{"title":"","category":"Med-Surg 2|OB|PEDS|Pharmacology|Fundamentals|Mental Health","difficulty":"Easy|Medium|Hard",' +
    '"durationMin":20,"summary":"","objectives":["",""],' +
    '"patient":{"name":"","age":"","sex":"","weightKg":70,"allergies":"NKDA","codeStatus":"Full Code","diagnosis":"","history":["",""]},' +
    '"vitalsTimeline":[{"atMin":0,"label":"Baseline","bp":"","hr":0,"rr":0,"temp":"","spo2":0,"pain":"","loc":"","note":""}],' +
    '"labs":[{"panel":"","name":"","value":"","unit":"","status":"normal|high|low|critical-high|critical-low","normalRange":"","interpretation":""}],' +
    '"orders":[{"text":"","category":"medication|lab|imaging|respiratory|access|diet|monitoring|consult|procedure"}],' +
    '"interventions":[{"action":"","rationale":"","category":"assessment|intervention|medication|communication|education|escalation","critical":true}],' +
    '"pearls":[""],"criticalErrors":[""]}\n' +
    'Give 2-3 vitals timepoints, 4-8 labs, 4-8 orders, and 5-8 interventions IN PRIORITY ORDER.';

  function coerceDraft(json) {
    var d = blankScenario();
    if (!json || typeof json !== 'object') return d;
    function arr(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }
    d.title = clean(json.title, LIMIT.title);
    d.category = CATEGORIES.indexOf(json.category) >= 0 ? json.category : 'Med-Surg 2';
    d.difficulty = DIFFICULTIES.indexOf(json.difficulty) >= 0 ? json.difficulty : 'Medium';
    d.durationMin = num(json.durationMin, 20);
    d.summary = clean(json.summary, LIMIT.summary);
    d.objectives = arr(json.objectives).slice(0, CAPS.objectives).map(function (o) { return clean(o, 160); });
    if (!d.objectives.length) d.objectives = [''];
    var p = json.patient || {};
    d.patient = {
      name: clean(p.name, 60), age: clean(p.age, 30), sex: clean(p.sex, 20) || 'Female',
      weightKg: p.weightKg === undefined || p.weightKg === null ? '' : num(p.weightKg, 0),
      allergies: clean(typeof p.allergies === 'string' ? p.allergies : arr(p.allergies).join(', '), 120) || 'NKDA',
      codeStatus: clean(p.codeStatus, 40) || 'Full Code',
      diagnosis: clean(p.diagnosis, 120),
      history: arr(p.history).slice(0, CAPS.history).map(function (h) { return clean(h, 160); })
    };
    if (!d.patient.history.length) d.patient.history = [''];
    d.vitalsTimeline = arr(json.vitalsTimeline).slice(0, CAPS.vitals).map(function (v, i) {
      return { atMin: num(v.atMin, i * 5), label: clean(v.label, 40) || 'Baseline',
               bp: clean(v.bp, 20), hr: v.hr === undefined ? '' : num(v.hr, 0),
               rr: v.rr === undefined ? '' : num(v.rr, 0), temp: clean(v.temp, 20),
               spo2: v.spo2 === undefined ? '' : num(v.spo2, 0), pain: clean(v.pain, 20),
               loc: clean(v.loc, 80), note: clean(v.note, 200) };
    });
    if (!d.vitalsTimeline.length) d.vitalsTimeline = blankScenario().vitalsTimeline;
    d.labs = arr(json.labs).slice(0, CAPS.labs).map(function (l) {
      return { panel: clean(l.panel, 40), name: clean(l.name, 60), value: clean(l.value, 30),
               unit: clean(l.unit, 20), status: LAB_STATUS.indexOf(l.status) >= 0 ? l.status : 'normal',
               normalRange: clean(l.normalRange, 40), interpretation: clean(l.interpretation, 200) };
    });
    d.orders = arr(json.orders).slice(0, CAPS.orders).map(function (o) {
      return { text: clean(o.text, 160), category: ORDER_CATS.indexOf(o.category) >= 0 ? o.category : 'monitoring' };
    });
    d.interventions = arr(json.interventions).slice(0, CAPS.interventions).map(function (iv) {
      return { action: clean(iv.action, 200), rationale: clean(iv.rationale, 400),
               category: IV_CATS.indexOf(iv.category) >= 0 ? iv.category : 'intervention',
               critical: !!iv.critical };
    });
    if (!d.interventions.length) d.interventions = blankScenario().interventions;
    d.pearls = arr(json.pearls).slice(0, 6).map(function (x) { return clean(x, 200); });
    if (!d.pearls.length) d.pearls = [''];
    d.criticalErrors = arr(json.criticalErrors).slice(0, 6).map(function (x) { return clean(x, 200); });
    if (!d.criticalErrors.length) d.criticalErrors = [''];
    d.questions = [];
    return d;
  }

  function coerceAiQuestions(raw) {
    var list = [];
    if (!raw) return list;
    var arr = Object.prototype.toString.call(raw) === '[object Array]' ? raw
            : (raw.questions && Object.prototype.toString.call(raw.questions) === '[object Array]' ? raw.questions : []);
    arr.slice(0, CAPS.questions).forEach(function (q) {
      if (!q || !q.text) return;
      var options = Object.prototype.toString.call(q.options) === '[object Array]' ? q.options : [];
      var correct = Object.prototype.toString.call(q.correct) === '[object Array]' ? q.correct
                  : (typeof q.correct === 'number' ? [q.correct] : []);
      list.push({
        text: clean(q.text, LIMIT.qtext),
        type: q.type === 'select-all' ? 'select-all' : 'multiple-choice',
        options: options.slice(0, 6).map(function (o) { return clean(o, LIMIT.option); }),
        correct: correct.filter(function (c) { return typeof c === 'number' && c >= 0 && c < 6; }),
        rationale: clean(q.rationale, LIMIT.rationale)
      });
    });
    return list;
  }

  function AiDraftPanel(props) {
    var s0 = useState('');     var topic = s0[0], setTopic = s0[1];
    var s1 = useState(false);  var busy = s1[0], setBusy = s1[1];
    var s2 = useState('');     var err = s2[0], setErr = s2[1];
    var s3 = useState('');     var stage = s3[0], setStage = s3[1];

    function go() {
      var t = clean(topic, 120);
      if (t.length < 5) { setErr('Tell it the clinical picture - a few words at least.'); return; }
      setBusy(true); setErr(''); setStage('Drafting the patient and timeline...');
      aiChat({
        system: AI_SCENARIO_SYSTEM,
        messages: [{ role: 'user', content: 'Draft a nursing simulation scenario about: ' + t }],
        maxTokens: 2200,
        temperature: 0.6
      }).then(function (text) {
        var json = extractJson(text);
        if (!json) throw new Error('The draft came back in an unexpected format. Try rephrasing the topic.');
        var draft = coerceDraft(json);
        setStage('Drafting practice questions...');
        var m = MMx();
        var qPromise;
        if (m.ai && typeof m.ai.generateQuestions === 'function') {
          qPromise = Promise.resolve(m.ai.generateQuestions({
            topic: t, count: 4, difficulty: draft.difficulty, category: draft.category
          }));
        } else {
          qPromise = aiChat({
            system: 'You write NCLEX-style questions. Respond ONLY with JSON: ' +
                    '[{"text":"","type":"multiple-choice|select-all","options":["","","",""],"correct":[0],"rationale":""}]. ' +
                    'Every question MUST have a rationale explaining why the right answer is right.',
            messages: [{ role: 'user', content: 'Write 4 priority-setting questions for this scenario: ' + t +
                         '\nScenario summary: ' + draft.summary }],
            maxTokens: 1400, temperature: 0.5
          }).then(function (qt) { return extractJson(qt); });
        }
        return qPromise.then(function (qraw) {
          draft.questions = coerceAiQuestions(qraw);
          return draft;
        })['catch'](function () { return draft; });
      }).then(function (draft) {
        setBusy(false); setStage('');
        props.onDraft(draft);
      })['catch'](function (e) {
        setBusy(false); setStage('');
        setErr(aiErrorMessage(e));
      });
    }

    return ce('div', { className: 'cm-item', style: { display: 'block' } },
      ce('div', { className: 'cm-chip-row', style: { marginBottom: 8 } },
        ce('span', { className: 'cm-flag ai' }, '✦ AI assist')),
      ce('h3', { className: 'cm-item-title' }, 'Help me build this'),
      ce('p', { className: 'cm-sub', style: { marginBottom: 10 } },
        'Type the clinical picture and AI drafts a starting point - patient, vitals timeline, labs, orders, priority interventions, and questions. ' +
        'It is a draft. You edit every field, and you cannot publish until you confirm you reviewed it.'),
      ce('div', { className: 'cm-toolbar' },
        ce('input', {
          type: 'text', className: 'cm-input cm-search', value: topic, maxLength: 120,
          placeholder: 'e.g. post-op hip replacement with DVT', 'aria-label': 'Scenario topic',
          onChange: function (e) { setTopic(e.target.value); },
          onKeyDown: function (e) { if (e.key === 'Enter') go(); }
        }),
        ce('button', { className: 'btn btn-primary', onClick: go, disabled: busy },
          busy ? 'Drafting...' : 'Draft it')
      ),
      busy ? ce(Spinner, { label: stage || 'Working...' }) : null,
      err ? ce('div', { className: 'cm-err', role: 'alert' }, err) : null
    );
  }

  /* --------------------------------------------------- the builder ------ */

  var STEPS = [
    { id: 0, label: 'Basics' }, { id: 1, label: 'Patient' }, { id: 2, label: 'Vitals' },
    { id: 3, label: 'Labs & orders' }, { id: 4, label: 'Priorities' },
    { id: 5, label: 'Questions' }, { id: 6, label: 'Review' }
  ];

  function ScenarioBuilder(props) {
    var s0 = useState(props.initial || blankScenario());
    var d = s0[0], setD = s0[1];
    var s1 = useState(0);      var step = s1[0], setStep = s1[1];
    var s2 = useState({});     var errs = s2[0], setErrs = s2[1];
    var s3 = useState(false);  var busy = s3[0], setBusy = s3[1];
    var s4 = useState('');     var formErr = s4[0], setFormErr = s4[1];
    var s5 = useState(!!props.aiDrafted); var aiDrafted = s5[0], setAiDrafted = s5[1];
    var s6 = useState(false);  var reviewed = s6[0], setReviewed = s6[1];
    var s7 = useState(false);  var showAi = s7[0], setShowAi = s7[1];
    var aiResolvingNow = useAiResolving();

    function set(field, value) { setD(function (c) { var n = merge(c, {}); n[field] = value; return n; }); }
    function setPatient(field, value) {
      setD(function (c) { return merge(c, { patient: merge(c.patient, (function () { var o = {}; o[field] = value; return o; })()) }); });
    }
    function setRow(listName, i, field, value) {
      setD(function (c) {
        var rows = c[listName].slice();
        rows[i] = merge(rows[i], (function () { var o = {}; o[field] = value; return o; })());
        var patch = {}; patch[listName] = rows;
        return merge(c, patch);
      });
    }
    function addRow(listName, row, cap) {
      setD(function (c) {
        if (c[listName].length >= cap) return c;
        var patch = {}; patch[listName] = c[listName].concat([row]);
        return merge(c, patch);
      });
    }
    function delRow(listName, i) {
      setD(function (c) {
        var patch = {};
        patch[listName] = c[listName].filter(function (_, idx) { return idx !== i; });
        return merge(c, patch);
      });
    }
    function setStrRow(listName, i, value) {
      setD(function (c) { var rows = c[listName].slice(); rows[i] = value; var p = {}; p[listName] = rows; return merge(c, p); });
    }
    function setHistory(i, value) {
      setD(function (c) {
        var h = c.patient.history.slice(); h[i] = value;
        return merge(c, { patient: merge(c.patient, { history: h }) });
      });
    }

    function publish() {
      var v = validateScenario(d);
      setErrs(v);
      if (firstError(v)) { setFormErr('Some sections still need attention - check the red notes.'); setStep(6); return; }
      if (aiDrafted && !reviewed) { setFormErr('Confirm you reviewed the AI-drafted content before publishing.'); return; }
      var msg = rateCheck('scenario');
      if (msg) { setFormErr(msg); return; }
      setBusy(true); setFormErr('');

      serverRateCheck(P.scenarios, isNewAccount() ? RATE.newUser.minGapMs : RATE.normal.minGapMs)
        .then(function (blocked) {
          if (blocked) throw new Error(blocked);
          var row = {
            title: clean(d.title, LIMIT.title),
            category: d.category,
            difficulty: d.difficulty,
            summary: clean(d.summary, LIMIT.summary),
            authorId: myId(),
            authorName: myName(),
            createdAt: now(),
            score: 0, commentCount: 0, runCount: 0,
            aiDrafted: !!aiDrafted,
            featured: false, removed: false,
            forkOf: props.forkOf || '',
            forkOfTitle: clean(props.forkOfTitle, LIMIT.title),
            forkOfAuthor: clean(props.forkOfAuthor, LIMIT.name),
            data: sanitizeScenarioData(d)
          };
          return pushAt(P.scenarios, row).then(function (id) {
            rateNote('scenario');
            bumpStat('scenarios', 1);
            recordActivity('scenario', {
              text: myName() + ' published a scenario: ' + row.title,
              targetType: 'scenario', targetId: id
            });
            if (props.forkOf && props.forkOfAuthorId) {
              notify(props.forkOfAuthorId, {
                type: 'fork', text: myName() + ' forked your scenario "' + clean(props.forkOfTitle, 60) + '"',
                targetType: 'scenario', targetId: id
              });
            }
            toast('Scenario published. Your cohort can run it in the sim engine now.', 'success');
            props.onDone(merge(row, { _id: id }));
          });
        })['catch'](function (e) {
          setBusy(false);
          setFormErr(writeErrText(e, 'Could not publish that scenario. Your draft is still here - try again in a moment.'));
        });
    }

    function stepBtn(s) {
      return ce('button', {
        key: s.id, className: 'cm-stepbtn' + (step > s.id ? ' done' : ''),
        'aria-current': step === s.id ? 'step' : undefined,
        onClick: function () { setStep(s.id); }
      },
        ce('span', { className: 'cm-stepnum' }, String(s.id + 1)),
        ce('span', null, s.label)
      );
    }

    var content = null;

    if (step === 0) {
      content = ce('div', null,
        showAi || aiDrafted ? null : (aiAvailable()
          ? ce('div', { style: { marginBottom: 14 } },
              ce('button', { className: 'btn btn-outline', onClick: function () { setShowAi(true); } },
                '✦ Help me build this with AI'))
          /* Plan not known yet: the same button, disabled and quiet. Saying
             "not available on your account" here before we have read the
             account is exactly the false verdict this change removes. */
          : (aiResolvingNow
              ? ce('div', { style: { marginBottom: 14 } },
                  ce(CheckingButton, { label: '✦ Help me build this with AI' }))
              : ce('div', { className: 'cm-banner' },
                  ce('span', { className: 'cm-banner-ico', 'aria-hidden': 'true' }, 'i'),
                  ce('div', null, 'AI assist is not available on your account right now - the builder works fine without it.')))),
        showAi && !aiDrafted ? ce('div', { style: { marginBottom: 14 } },
          ce(AiDraftPanel, {
            onDraft: function (draft) {
              setD(draft); setAiDrafted(true); setShowAi(false); setReviewed(false);
              toast('Draft created. Read every field before you publish.', 'info');
            }
          })) : null,
        aiDrafted ? ce(Banner, { tone: 'ai', icon: '✦' },
          ce('div', null,
            ce('b', null, 'AI-drafted content. '),
            'Treat every value as unverified until you have checked it. You will be asked to confirm you reviewed it before publishing.')) : null,

        ce(Field, { label: 'Title', id: 'cm-s-title', required: true, max: LIMIT.title, value: d.title, error: errs.title },
          ce('input', { id: 'cm-s-title', type: 'text', className: 'cm-input', value: d.title, maxLength: LIMIT.title,
            onChange: function (e) { set('title', e.target.value); }, placeholder: 'Post-op hip replacement with DVT' })),
        ce('div', { className: 'cm-toolbar' },
          ce('div', { style: { flex: '1 1 150px' } },
            ce('label', { className: 'cm-label' }, 'Category'),
            sel(d.category, function (v) { set('category', v); }, CATEGORIES, 'Category', '1 1 100%')),
          ce('div', { style: { flex: '1 1 120px' } },
            ce('label', { className: 'cm-label' }, 'Difficulty'),
            sel(d.difficulty, function (v) { set('difficulty', v); }, DIFFICULTIES, 'Difficulty', '1 1 100%')),
          ce('div', { style: { flex: '0 1 130px' } },
            ce('label', { className: 'cm-label', htmlFor: 'cm-s-dur' }, 'Minutes'),
            ce('input', { id: 'cm-s-dur', type: 'number', className: 'cm-input', value: d.durationMin, min: 5, max: 90,
              'aria-label': 'Duration in minutes',
              onChange: function (e) { set('durationMin', e.target.value); } }))
        ),
        ce(Field, { label: 'Summary', id: 'cm-s-sum', required: true, max: LIMIT.summary, value: d.summary, error: errs.summary,
          hint: 'One or two sentences: what will the student have to recognize and do?' },
          ce('textarea', { id: 'cm-s-sum', className: 'cm-textarea', value: d.summary, maxLength: LIMIT.summary,
            onChange: function (e) { set('summary', e.target.value); },
            placeholder: 'Day 2 post-op total hip. Calf pain and low-grade fever...' })),
        ce('div', { className: 'cm-field' },
          ce('label', { className: 'cm-label' }, 'Objectives'),
          ce('div', { className: 'cm-hint', style: { marginTop: 0, marginBottom: 8 } },
            'During this simulation the student is expected to...'),
          ce('div', { className: 'cm-rows' },
            d.objectives.map(function (o, i) {
              return ce(RowShell, { key: 'obj' + i, onRemove: d.objectives.length > 1 ? function () { delRow('objectives', i); } : null,
                removeLabel: 'Remove objective ' + (i + 1) },
                txt(o, function (v) { setStrRow('objectives', i, v); }, 'Recognize signs of DVT', 'Objective ' + (i + 1), '1 1 100%'));
            })),
          ce(AddRowBtn, { count: d.objectives.length, cap: CAPS.objectives, label: '+ Add objective',
            onAdd: function () { addRow('objectives', '', CAPS.objectives); } })
        )
      );
    }

    if (step === 1) {
      content = ce('div', null,
        ce(Banner, { icon: '⚕' }, ce('div', null,
          ce('b', null, 'Fictional patients only. '), 'Never use a real patient, MRN, or anything from a real chart.')),
        ce('div', { className: 'cm-toolbar' },
          ce('div', { style: { flex: '1 1 160px' } },
            ce('label', { className: 'cm-label' }, 'Name'),
            txt(d.patient.name, function (v) { setPatient('name', v); }, 'Ruth Alvarez', 'Patient name', '1 1 100%', 60)),
          ce('div', { style: { flex: '0 1 110px' } },
            ce('label', { className: 'cm-label' }, 'Age'),
            txt(d.patient.age, function (v) { setPatient('age', v); }, '68 years', 'Patient age', '1 1 100%', 30)),
          ce('div', { style: { flex: '0 1 120px' } },
            ce('label', { className: 'cm-label' }, 'Sex'),
            sel(d.patient.sex, function (v) { setPatient('sex', v); }, ['Female', 'Male', 'Other'], 'Sex', '1 1 100%'))
        ),
        errs.patientName ? ce('div', { className: 'cm-err', role: 'alert' }, errs.patientName) : null,
        ce('div', { className: 'cm-toolbar' },
          ce('div', { style: { flex: '0 1 120px' } },
            ce('label', { className: 'cm-label' }, 'Weight (kg)'),
            txt(d.patient.weightKg, function (v) { setPatient('weightKg', v); }, '70', 'Weight in kilograms', '1 1 100%', 8)),
          ce('div', { style: { flex: '1 1 150px' } },
            ce('label', { className: 'cm-label' }, 'Allergies'),
            txt(d.patient.allergies, function (v) { setPatient('allergies', v); }, 'NKDA', 'Allergies, comma separated', '1 1 100%', 120)),
          ce('div', { style: { flex: '0 1 150px' } },
            ce('label', { className: 'cm-label' }, 'Code status'),
            sel(d.patient.codeStatus, function (v) { setPatient('codeStatus', v); },
              ['Full Code', 'DNR', 'DNR/DNI', 'Comfort care'], 'Code status', '1 1 100%'))
        ),
        ce(Field, { label: 'Working diagnosis', required: true, error: errs.diagnosis, max: 120, value: d.patient.diagnosis },
          txt(d.patient.diagnosis, function (v) { setPatient('diagnosis', v); }, 'Deep vein thrombosis, right calf', 'Diagnosis', '1 1 100%', 120)),
        ce('div', { className: 'cm-field' },
          ce('label', { className: 'cm-label' }, 'Relevant history'),
          ce('div', { className: 'cm-rows' },
            d.patient.history.map(function (h, i) {
              return ce(RowShell, {
                key: 'hx' + i,
                onRemove: d.patient.history.length > 1 ? function () {
                  setD(function (c) {
                    return merge(c, { patient: merge(c.patient, {
                      history: c.patient.history.filter(function (_, idx) { return idx !== i; }) }) });
                  });
                } : null,
                removeLabel: 'Remove history item ' + (i + 1)
              }, txt(h, function (v) { setHistory(i, v); }, 'Total hip arthroplasty 2 days ago', 'History ' + (i + 1), '1 1 100%'));
            })),
          ce(AddRowBtn, { count: d.patient.history.length, cap: CAPS.history, label: '+ Add history item',
            onAdd: function () {
              setD(function (c) { return merge(c, { patient: merge(c.patient, { history: c.patient.history.concat(['']) }) }); });
            } })
        )
      );
    }

    if (step === 2) {
      content = ce('div', null,
        ce(Banner, { icon: '◔' }, ce('div', null,
          ce('b', null, 'Row 1 is baseline at minute 0. '),
          'Add a later row for how the patient changes if nobody intervenes - that drives the deterioration engine.')),
        errs.vitals ? ce('div', { className: 'cm-err', role: 'alert' }, errs.vitals) : null,
        ce('div', { className: 'cm-rows' },
          d.vitalsTimeline.map(function (v, i) {
            return ce('div', { key: 'vt' + i, className: 'cm-rowitem', style: { display: 'block' } },
              ce('div', { className: 'cm-chip-row', style: { marginBottom: 8 } },
                ce(Chip, null, i === 0 ? 'Baseline' : 'Change ' + i),
                ce('span', { className: 'cm-spacer' }),
                i > 0 ? ce('button', { className: 'cm-del', onClick: function () { delRow('vitalsTimeline', i); },
                  'aria-label': 'Remove vitals row ' + (i + 1) }, '✕') : null),
              ce('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                ce('input', { type: 'number', className: 'cm-input', value: v.atMin, 'aria-label': 'At minute',
                  style: { flex: '0 1 90px' }, placeholder: 'min',
                  onChange: function (e) { setRow('vitalsTimeline', i, 'atMin', e.target.value); } }),
                txt(v.label, function (x) { setRow('vitalsTimeline', i, 'label', x); }, 'Label', 'Vitals label', '1 1 120px', 40),
                txt(v.bp, function (x) { setRow('vitalsTimeline', i, 'bp', x); }, 'BP 118/72', 'Blood pressure', '0 1 110px', 20),
                txt(v.hr, function (x) { setRow('vitalsTimeline', i, 'hr', x); }, 'HR 96', 'Heart rate', '0 1 80px', 8),
                txt(v.rr, function (x) { setRow('vitalsTimeline', i, 'rr', x); }, 'RR 20', 'Respiratory rate', '0 1 80px', 8),
                txt(v.temp, function (x) { setRow('vitalsTimeline', i, 'temp', x); }, 'Temp 100.8 F', 'Temperature', '0 1 110px', 20),
                txt(v.spo2, function (x) { setRow('vitalsTimeline', i, 'spo2', x); }, 'SpO2 94', 'Oxygen saturation', '0 1 90px', 8),
                txt(v.pain, function (x) { setRow('vitalsTimeline', i, 'pain', x); }, 'Pain 6/10', 'Pain', '0 1 90px', 20),
                txt(v.loc, function (x) { setRow('vitalsTimeline', i, 'loc', x); }, 'Alert and oriented x4', 'Level of consciousness', '1 1 160px', 80),
                txt(v.note, function (x) { setRow('vitalsTimeline', i, 'note', x); }, 'What this means', 'Note', '1 1 100%', 200)
              )
            );
          })),
        ce(AddRowBtn, { count: d.vitalsTimeline.length, cap: CAPS.vitals, label: '+ Add a later timepoint',
          onAdd: function () {
            var lastMin = num(d.vitalsTimeline[d.vitalsTimeline.length - 1].atMin, 0);
            addRow('vitalsTimeline', { atMin: lastMin + 5, label: 'Deterioration', bp: '', hr: '', rr: '',
              temp: '', spo2: '', pain: '', loc: '', note: '' }, CAPS.vitals);
          } })
      );
    }

    if (step === 3) {
      content = ce('div', null,
        ce('h3', { className: 'cm-item-title' }, 'Labs'),
        ce('p', { className: 'cm-sub', style: { marginBottom: 10 } }, 'Only the labs that matter for this case.'),
        ce('div', { className: 'cm-rows' },
          d.labs.map(function (l, i) {
            return ce(RowShell, { key: 'lab' + i, onRemove: function () { delRow('labs', i); },
              removeLabel: 'Remove lab ' + (i + 1) },
              txt(l.panel, function (v) { setRow('labs', i, 'panel', v); }, 'Panel (CBC)', 'Lab panel', '0 1 110px', 40),
              txt(l.name, function (v) { setRow('labs', i, 'name', v); }, 'D-dimer', 'Lab name', '1 1 140px', 60),
              txt(l.value, function (v) { setRow('labs', i, 'value', v); }, '2.4', 'Value', '0 1 80px', 30),
              txt(l.unit, function (v) { setRow('labs', i, 'unit', v); }, 'mcg/mL', 'Unit', '0 1 90px', 20),
              sel(l.status, function (v) { setRow('labs', i, 'status', v); }, LAB_STATUS, 'Lab status', '0 1 140px'),
              txt(l.normalRange, function (v) { setRow('labs', i, 'normalRange', v); }, 'Normal range', 'Normal range', '0 1 120px', 40),
              txt(l.interpretation, function (v) { setRow('labs', i, 'interpretation', v); }, 'What it means', 'Interpretation', '1 1 100%', 200)
            );
          })),
        d.labs.length === 0 ? ce('p', { className: 'cm-mini' }, 'No labs yet - fine if this case is assessment-driven.') : null,
        ce(AddRowBtn, { count: d.labs.length, cap: CAPS.labs, label: '+ Add lab',
          onAdd: function () { addRow('labs', { panel: '', name: '', value: '', unit: '', status: 'normal', normalRange: '', interpretation: '' }, CAPS.labs); } }),

        ce('hr', { className: 'cm-divider' }),
        ce('h3', { className: 'cm-item-title' }, 'Provider orders'),
        ce('div', { className: 'cm-rows' },
          d.orders.map(function (o, i) {
            return ce(RowShell, { key: 'ord' + i, onRemove: function () { delRow('orders', i); },
              removeLabel: 'Remove order ' + (i + 1) },
              txt(o.text, function (v) { setRow('orders', i, 'text', v); }, 'Enoxaparin 1 mg/kg subcut q12h', 'Order text', '1 1 200px'),
              sel(o.category, function (v) { setRow('orders', i, 'category', v); }, ORDER_CATS, 'Order category', '0 1 150px')
            );
          })),
        d.orders.length === 0 ? ce('p', { className: 'cm-mini' }, 'No orders yet.') : null,
        ce(AddRowBtn, { count: d.orders.length, cap: CAPS.orders, label: '+ Add order',
          onAdd: function () { addRow('orders', { text: '', category: 'medication' }, CAPS.orders); } })
      );
    }

    if (step === 4) {
      content = ce('div', null,
        ce(Banner, { icon: '⚑' }, ce('div', null,
          ce('b', null, 'Order matters. '),
          'List the interventions in the priority sequence a student should perform them. This is what the engine grades.')),
        errs.interventions ? ce('div', { className: 'cm-err', role: 'alert' }, errs.interventions) : null,
        ce('div', { className: 'cm-rows' },
          d.interventions.map(function (iv, i) {
            return ce('div', { key: 'iv' + i, className: 'cm-rowitem', style: { display: 'block' } },
              ce('div', { className: 'cm-chip-row', style: { marginBottom: 8 } },
                ce(Chip, null, 'Priority ' + (i + 1)),
                ce('span', { className: 'cm-spacer' }),
                i > 0 ? ce('button', { className: 'cm-linkbtn', 'aria-label': 'Move up',
                  onClick: function () {
                    setD(function (c) {
                      var rows = c.interventions.slice();
                      var t = rows[i - 1]; rows[i - 1] = rows[i]; rows[i] = t;
                      return merge(c, { interventions: rows });
                    });
                  } }, '↑ Up') : null,
                d.interventions.length > 1 ? ce('button', { className: 'cm-del',
                  onClick: function () { delRow('interventions', i); },
                  'aria-label': 'Remove intervention ' + (i + 1) }, '✕') : null),
              ce('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                txt(iv.action, function (v) { setRow('interventions', i, 'action', v); },
                  'Assess neurovascular status of the affected leg', 'Intervention action', '1 1 100%', 200),
                txt(iv.rationale, function (v) { setRow('interventions', i, 'rationale', v); },
                  'Why this comes now', 'Intervention rationale', '1 1 100%', 400),
                sel(iv.category, function (v) { setRow('interventions', i, 'category', v); }, IV_CATS, 'Intervention category', '0 1 160px'),
                ce('label', { className: 'cm-actions', style: { gap: 6, cursor: 'pointer', color: 'var(--text2)', fontSize: '0.82rem' } },
                  ce('input', { type: 'checkbox', checked: !!iv.critical,
                    onChange: function (e) { setRow('interventions', i, 'critical', e.target.checked); } }),
                  ce('span', null, 'Critical - missing it is a major error'))
              )
            );
          })),
        ce(AddRowBtn, { count: d.interventions.length, cap: CAPS.interventions, label: '+ Add intervention',
          onAdd: function () { addRow('interventions', { action: '', rationale: '', category: 'intervention', critical: false }, CAPS.interventions); } }),

        ce('hr', { className: 'cm-divider' }),
        ce('h3', { className: 'cm-item-title' }, 'Critical errors'),
        ce('p', { className: 'cm-sub', style: { marginBottom: 10 } }, 'Things that must NOT be done.'),
        ce('div', { className: 'cm-rows' },
          d.criticalErrors.map(function (x, i) {
            return ce(RowShell, { key: 'ce' + i, onRemove: d.criticalErrors.length > 1 ? function () { delRow('criticalErrors', i); } : null,
              removeLabel: 'Remove critical error ' + (i + 1) },
              txt(x, function (v) { setStrRow('criticalErrors', i, v); }, 'Massaging the affected calf', 'Critical error ' + (i + 1), '1 1 100%', 200));
          })),
        ce(AddRowBtn, { count: d.criticalErrors.length, cap: 6, label: '+ Add critical error',
          onAdd: function () { addRow('criticalErrors', '', 6); } }),

        ce('hr', { className: 'cm-divider' }),
        ce('h3', { className: 'cm-item-title' }, 'ATI / NCLEX pearls'),
        ce('div', { className: 'cm-rows' },
          d.pearls.map(function (x, i) {
            return ce(RowShell, { key: 'pl' + i, onRemove: d.pearls.length > 1 ? function () { delRow('pearls', i); } : null,
              removeLabel: 'Remove pearl ' + (i + 1) },
              txt(x, function (v) { setStrRow('pearls', i, v); }, 'Sudden dyspnea after DVT = suspect PE', 'Pearl ' + (i + 1), '1 1 100%', 200));
          })),
        ce(AddRowBtn, { count: d.pearls.length, cap: 6, label: '+ Add pearl',
          onAdd: function () { addRow('pearls', '', 6); } })
      );
    }

    if (step === 5) {
      content = ce('div', null,
        ce(Banner, { icon: '✎' }, ce('div', null,
          ce('b', null, 'Every question needs a rationale. '),
          'Mark the correct option with the checkbox next to it.')),
        errs.questions ? ce('div', { className: 'cm-err', role: 'alert' }, errs.questions) : null,
        ce('div', { className: 'cm-rows' },
          d.questions.map(function (q, i) {
            return ce('div', { key: 'q' + i, className: 'cm-rowitem', style: { display: 'block' } },
              ce('div', { className: 'cm-chip-row', style: { marginBottom: 8 } },
                ce(Chip, null, 'Question ' + (i + 1)),
                q._ai ? ce('span', { className: 'cm-flag ai' }, '✦ AI draft') : null,
                ce('span', { className: 'cm-spacer' }),
                ce('button', { className: 'cm-del', onClick: function () { delRow('questions', i); },
                  'aria-label': 'Remove question ' + (i + 1) }, '✕')),
              ce('textarea', { className: 'cm-textarea', value: q.text, maxLength: LIMIT.qtext,
                style: { minHeight: 64, marginBottom: 8 }, 'aria-label': 'Question ' + (i + 1) + ' text',
                placeholder: 'Which action should the nurse take first?',
                onChange: function (e) { setRow('questions', i, 'text', e.target.value); } }),
              ce('div', { className: 'cm-rows' },
                q.options.map(function (o, oi) {
                  var checked = (q.correct || []).indexOf(oi) >= 0;
                  return ce('div', { key: 'o' + oi, style: { display: 'flex', gap: 8, alignItems: 'center' } },
                    ce('input', {
                      type: 'checkbox', checked: checked,
                      'aria-label': 'Option ' + letter(oi) + ' is correct',
                      onChange: function () {
                        setD(function (c) {
                          var rows = c.questions.slice();
                          var cur = (rows[i].correct || []).slice();
                          var pos = cur.indexOf(oi);
                          if (pos >= 0) cur.splice(pos, 1); else cur.push(oi);
                          cur.sort(function (a, b) { return a - b; });
                          rows[i] = merge(rows[i], { correct: cur, type: cur.length > 1 ? 'select-all' : 'multiple-choice' });
                          return merge(c, { questions: rows });
                        });
                      }
                    }),
                    ce('span', { style: { fontWeight: 800, color: checked ? 'var(--green-fg, #4ade80)' : 'var(--text3)', width: 16 } }, letter(oi)),
                    ce('input', { type: 'text', className: 'cm-input', value: o, maxLength: LIMIT.option,
                      'aria-label': 'Question ' + (i + 1) + ' option ' + letter(oi),
                      placeholder: 'Option ' + letter(oi),
                      onChange: function (e) {
                        setD(function (c) {
                          var rows = c.questions.slice();
                          var opts = rows[i].options.slice(); opts[oi] = e.target.value;
                          rows[i] = merge(rows[i], { options: opts });
                          return merge(c, { questions: rows });
                        });
                      } })
                  );
                })),
              ce('textarea', { className: 'cm-textarea', value: q.rationale, maxLength: LIMIT.rationale,
                style: { minHeight: 64, marginTop: 8 }, 'aria-label': 'Question ' + (i + 1) + ' rationale',
                placeholder: 'Rationale (required) - why is this the right answer?',
                onChange: function (e) { setRow('questions', i, 'rationale', e.target.value); } })
            );
          })),
        d.questions.length === 0
          ? ce(Empty, { icon: '◇', title: 'No questions yet',
              text: 'Two or three priority questions turn a scenario into something people actually learn from.' })
          : null,
        ce(AddRowBtn, { count: d.questions.length, cap: CAPS.questions, label: '+ Add question',
          onAdd: function () {
            addRow('questions', { text: '', type: 'multiple-choice', options: ['', '', '', ''], correct: [], rationale: '' }, CAPS.questions);
          } })
      );
    }

    if (step === 6) {
      var v2 = validateScenario(d);
      var problems = [];
      var k;
      for (k in v2) { if (Object.prototype.hasOwnProperty.call(v2, k)) problems.push(v2[k]); }
      content = ce('div', null,
        problems.length
          ? ce(Banner, { tone: 'warn', icon: '!' }, ce('div', null,
              ce('b', null, 'Still to fix:'),
              ce('ul', { className: 'cm-empty-tips', style: { margin: '6px 0 0', maxWidth: 'none' } },
                problems.map(function (p, i) { return ce('li', { key: i }, p); }))))
          : ce(Banner, { tone: 'good', icon: '✓' }, ce('div', null, 'Everything required is filled in. Ready to publish.')),

        ce('div', { className: 'card' },
          ce('h3', null, clean(d.title, LIMIT.title) || 'Untitled scenario'),
          ce('div', { className: 'cm-chip-row', style: { marginBottom: 10 } },
            ce(Chip, null, d.category),
            ce(Chip, { tone: String(d.difficulty).toLowerCase() }, d.difficulty),
            ce(Chip, null, num(d.durationMin, 20) + ' min'),
            aiDrafted ? ce('span', { className: 'cm-flag ai' }, '✦ AI-drafted') : null),
          ce('p', { className: 'cm-item-text' }, clean(d.summary, LIMIT.summary)),
          ce('hr', { className: 'cm-divider' }),
          ce('div', { className: 'cm-kv' }, ce('b', null, 'Patient'),
            ce('span', null, clean(d.patient.name, 60) + ', ' + clean(d.patient.age, 30) + ' - ' + clean(d.patient.diagnosis, 120))),
          ce('div', { className: 'cm-kv' }, ce('b', null, 'Vitals'), ce('span', null, pluralize(d.vitalsTimeline.length, 'timepoint'))),
          ce('div', { className: 'cm-kv' }, ce('b', null, 'Labs'), ce('span', null, pluralize(d.labs.length, 'lab'))),
          ce('div', { className: 'cm-kv' }, ce('b', null, 'Orders'), ce('span', null, pluralize(d.orders.length, 'order'))),
          ce('div', { className: 'cm-kv' }, ce('b', null, 'Priorities'), ce('span', null, pluralize(d.interventions.filter(function (i) { return clean(i.action); }).length, 'intervention'))),
          ce('div', { className: 'cm-kv' }, ce('b', null, 'Questions'), ce('span', null, pluralize(d.questions.filter(function (q) { return clean(q.text); }).length, 'question')))
        ),

        aiDrafted ? ce('label', {
          className: 'cm-banner ai', style: { cursor: 'pointer', alignItems: 'center' }
        },
          ce('input', { type: 'checkbox', checked: reviewed, onChange: function (e) { setReviewed(e.target.checked); } }),
          ce('div', null, ce('b', null, 'I read every field and I stand behind the clinical content. '),
            'Required for AI-drafted scenarios - your name goes on this.')
        ) : null,

        props.forkOf ? ce('div', { className: 'cm-mini' },
          'This will publish as a fork of "' + clean(props.forkOfTitle, LIMIT.title) + '" by ' + clean(props.forkOfAuthor, LIMIT.name) + '.') : null,

        formErr ? ce('div', { className: 'cm-banner bad', role: 'alert' },
          ce('span', { className: 'cm-banner-ico', 'aria-hidden': 'true' }, '!'), ce('div', null, formErr)) : null,

        // (DR05 #20) Say what publishing actually does before they do it.
        ce('div', { className: 'cm-nextup' },
          ce('b', null, 'What happens next: '),
          'this goes live immediately under your name - no approval queue. Classmates can run it in ' +
          'the simulation engine, vote on it, fork it into their own version, and flag anything that ' +
          'is clinically wrong. You will be notified either way, and you can delete it any time.'),

        ce('div', { className: 'cm-actions end', style: { marginTop: 12 } },
          ce('button', { className: 'btn btn-outline', onClick: props.onCancel }, 'Cancel'),
          ce('button', { className: 'btn btn-primary', onClick: publish, disabled: busy },
            busy ? 'Publishing...' : 'Publish to the community'))
      );
    }

    return ce('div', null,
      ce('div', { className: 'cm-steps' }, STEPS.map(stepBtn)),
      content,
      ce('div', { className: 'cm-actions', style: { marginTop: 18 } },
        step > 0 ? ce('button', { className: 'btn btn-outline', onClick: function () { setStep(step - 1); } }, '← Back') : null,
        ce('span', { className: 'cm-spacer' }),
        step < 6 ? ce('button', { className: 'btn btn-primary', onClick: function () { setStep(step + 1); } },
          'Next: ' + STEPS[step + 1].label + ' →') : null)
    );
  }

  /** Strip the draft down to storable, length-capped primitives. */
  function sanitizeScenarioData(d) {
    var out = toSimScenario({ data: d, _id: '', authorName: '' });
    // toSimScenario already cleans and caps every field; keep the shape it made.
    return out;
  }

  /* ------------------------------------------------ scenario browser ---- */

  function ScenarioCard(props) {
    var s = props.s;
    var mine = s.authorId === myId();
    var s0 = useState(false); var open = s0[0], setOpen = s0[1];
    var data = s.data || {};
    return ce('div', { className: 'cm-item' + (s.featured ? ' cm-featured' : '') + (s.removed ? ' cm-removed' : '') },
      ce(VoteBar, {
        score: s.score, my: props.myVote, disabled: !props.canVote, reason: props.voteReason,
        onVote: function (d) { props.onVote(s, d); }
      }),
      ce('div', { className: 'cm-item-main' },
        ce('div', { className: 'cm-chip-row', style: { marginBottom: 8 } },
          s.featured ? ce('span', { className: 'cm-flag pick' }, '★ Instructor pick') : null,
          s.aiDrafted ? ce('span', { className: 'cm-flag ai' }, '✦ AI-drafted, author reviewed') : null,
          ce(Chip, null, s.category || 'Other'),
          ce(Chip, { tone: String(s.difficulty || '').toLowerCase() }, s.difficulty || 'Medium'),
          data.durationMin ? ce(Chip, null, data.durationMin + ' min') : null
        ),
        ce('h3', { className: 'cm-item-title' }, clean(s.title, LIMIT.title)),
        ce('p', { className: 'cm-item-text' }, clean(s.summary, LIMIT.summary)),
        s.forkOf ? ce('div', { className: 'cm-mini', style: { marginTop: 6 } },
          'Forked from "' + clean(s.forkOfTitle, LIMIT.title) + '" by ' + clean(s.forkOfAuthor, LIMIT.name)) : null,
        s.removed ? ce('div', { className: 'cm-removed-note' },
          ce('b', null, 'Removed by a moderator. '), 'Reason: ' + clean(s.removalReason, LIMIT.reason)) : null,

        open ? ce('div', { style: { marginTop: 12 } },
          ce('div', { className: 'cm-kv' }, ce('b', null, 'Patient'),
            ce('span', null, clean(data.patient ? data.patient.name : '', 60) + ' - ' +
                             clean(data.patient ? data.patient.diagnosis : '', 120))),
          (data.objectives || []).length ? ce('div', { style: { marginTop: 8 } },
            ce('b', { style: { fontSize: '0.85rem' } }, 'Objectives'),
            ce('ul', { className: 'cm-empty-tips', style: { margin: '4px 0 0', maxWidth: 'none' } },
              data.objectives.slice(0, 6).map(function (o, i) { return ce('li', { key: i }, clean(o, 160)); }))) : null,
          ce('div', { className: 'cm-chip-row', style: { marginTop: 10 } },
            ce(Chip, null, pluralize((data.vitalsTimeline || []).length, 'vitals timepoint')),
            ce(Chip, null, pluralize((data.labs || []).length, 'lab')),
            ce(Chip, null, pluralize((data.interventions || []).length, 'priority intervention')),
            ce(Chip, null, pluralize((data.questions || []).length, 'question'))),
          ce('hr', { className: 'cm-divider' }),
          ce(CommunityDiscussion, {
            targetId: 'scenario:' + s._id, targetType: 'scenario',
            targetTitle: s.title, targetAuthorId: s.authorId, compact: true
          })
        ) : null,

        ce('div', { className: 'cm-item-foot' },
          ce(AuthorChip, { uid: s.authorId, name: s.authorName }),
          ce('span', null, timeAgo(s.createdAt)),
          ce('span', null, pluralize(num(s.runCount, 0), 'run')),
          ce('span', null, pluralize(num(s.commentCount, 0), 'comment'))
        ),
        ce('div', { className: 'cm-actions', style: { marginTop: 10 } },
          ce('button', { className: 'btn btn-primary btn-sm', onClick: function () { props.onRun(s); } }, '▶ Run this sim'),
          ce('button', { className: 'btn btn-outline btn-sm', onClick: function () { props.onFork(s); } }, 'Fork it'),
          ce('button', { className: 'cm-linkbtn', 'aria-expanded': open ? 'true' : 'false',
            onClick: function () { setOpen(!open); } }, open ? 'Hide details' : 'Details + discuss'),
          !mine ? ce('button', { className: 'cm-linkbtn danger', onClick: function () { props.onReport(s); } }, 'Report') : null,
          (mine || isAdmin()) ? ce('button', { className: 'cm-linkbtn danger', onClick: function () { props.onDelete(s); } }, 'Delete') : null,
          isAdmin() ? ce('button', { className: 'cm-linkbtn', onClick: function () { props.onFeature(s); } },
            s.featured ? 'Unfeature' : 'Feature') : null
        )
      )
    );
  }

  function CommunityScenarioWorkshop(props) {
    var gate = useCommunityGate();
    var s0 = useState('list');   var view = s0[0], setView = s0[1];
    var s1 = useState('top');    var sort = s1[0], setSort = s1[1];
    var s2 = useState('');       var cat = s2[0], setCat = s2[1];
    var s3 = useState(null);     var reporting = s3[0], setReporting = s3[1];
    var s4 = useState(null);     var forkFrom = s4[0], setForkFrom = s4[1];

    var list = usePaged({
      path: P.scenarios, orderBy: sort === 'top' ? 'score' : 'createdAt',
      pageSize: PAGE, key: sort, enabled: gate.hasDb
    });
    var voteState = useMyVotes(list.items.map(function (s) { return 'scenario:' + s._id; }));
    var votes = voteState[0], setVote = voteState[1];

    function onVote(s, dir) {
      if (!gate.canPost) { toast(gate.blockReason || 'Sign in to vote on your cohort\'s questions.', 'info'); return; }
      var tid = 'scenario:' + s._id;
      var prev = num(votes[tid], 0);
      var next = prev === dir ? 0 : dir;
      setVote(tid, next);
      list.patch(s._id, { score: num(s.score, 0) + (next - prev) });
      castVote({ targetId: tid, contentPath: P.scenarios + '/' + s._id, dir: dir, prev: prev, authorId: s.authorId })
        ['catch'](function () {
          setVote(tid, prev); list.patch(s._id, { score: num(s.score, 0) });
          toast('Your vote did not save. It has been put back - try again.', 'error');
        });
    }

    function onRun(s) {
      bumpCounter(P.scenarios + '/' + s._id + '/runCount', 1)['catch'](function () { /* non-critical */ });
      runInSim(s);
    }

    function onFork(s) {
      var data = s.data || {};
      var draft = merge(blankScenario(), {
        title: clean(s.title, LIMIT.title) + ' (variant)',
        category: s.category, difficulty: s.difficulty,
        durationMin: num(data.durationMin, 20),
        summary: clean(s.summary, LIMIT.summary),
        objectives: (data.objectives || ['']).slice(),
        patient: merge(blankScenario().patient, {
          name: data.patient ? data.patient.name : '',
          age: data.patient ? data.patient.age : '',
          sex: data.patient ? data.patient.sex : 'Female',
          weightKg: data.patient && data.patient.weightKg ? data.patient.weightKg : '',
          allergies: data.patient && data.patient.allergies ? data.patient.allergies.join(', ') : 'NKDA',
          codeStatus: data.patient ? data.patient.codeStatus : 'Full Code',
          diagnosis: data.patient ? data.patient.diagnosis : '',
          history: (data.patient && data.patient.history && data.patient.history.length) ? data.patient.history.slice() : ['']
        }),
        vitalsTimeline: (data.vitalsTimeline && data.vitalsTimeline.length) ? data.vitalsTimeline.slice() : blankScenario().vitalsTimeline,
        labs: (data.labs || []).slice(),
        orders: (data.orders || []).slice(),
        interventions: (data.interventions && data.interventions.length) ? data.interventions.slice() : blankScenario().interventions,
        questions: (data.questions || []).map(function (q) {
          return { text: q.text, type: q.type, options: (q.options || []).slice(), correct: (q.correct || []).slice(), rationale: q.rationale };
        }),
        pearls: (data.pearls && data.pearls.length) ? data.pearls.slice() : [''],
        criticalErrors: (data.criticalErrors && data.criticalErrors.length) ? data.criticalErrors.slice() : ['']
      });
      setForkFrom({ draft: draft, of: s._id, ofTitle: s.title, ofAuthor: s.authorName, ofAuthorId: s.authorId, aiDrafted: !!s.aiDrafted });
      setView('build');
    }

    function onFeature(s) {
      if (!isAdmin()) return;
      var nextVal = !s.featured;
      list.patch(s._id, { featured: nextVal });
      updateAt(P.scenarios + '/' + s._id, { featured: nextVal })
        .then(function () {
          if (nextVal && s.authorId) {
            bumpCounter(P.stats + '/' + s.authorId + '/featured', 1);
            notify(s.authorId, { type: 'featured', text: 'An instructor featured your scenario.',
                                 targetType: 'scenario', targetId: s._id });
          }
        })['catch'](function () { list.patch(s._id, { featured: !nextVal }); toast('Could not change the instructor pick. Nothing was saved.', 'error'); });
    }

    function onDelete(s) {
      var mine = s.authorId === myId();
      if (!mine && !isAdmin()) return;
      if (mine) {
        if (!window.confirm('Delete your scenario? People who forked it keep their copies.')) return;
        list.drop(s._id);
        writeAt(P.scenarios + '/' + s._id, null)['catch'](function () { toast('Could not delete that scenario - it is still there. Try again.', 'error'); list.reload(); });
      } else {
        var reason = window.prompt('Reason for removal (the author will see this):', 'Clinically inaccurate');
        if (reason === null) return;
        list.patch(s._id, { removed: true, removalReason: clean(reason, LIMIT.reason) });
        removeContent('scenario', s._id, P.scenarios + '/' + s._id, clean(reason, LIMIT.reason), s.authorId);
      }
    }

    if (!gate.hasDb) return ce(OfflineWall, null);

    if (view === 'build') {
      if (!gate.canPost) {
        return ce('div', { className: 'cm-wrap' },
          ce('button', { className: 'btn btn-outline btn-sm', style: { marginBottom: 12 },
            onClick: function () { setView('list'); setForkFrom(null); } }, '← Back'),
          gate.banned ? ce(BannedNotice, { reason: gate.banReason }) : ce(SignInWall, null));
      }
      return ce('div', { className: 'cm-wrap' },
        ce('div', { className: 'cm-head' },
          ce('button', { className: 'btn btn-outline btn-sm',
            onClick: function () { setView('list'); setForkFrom(null); } }, '← Back'),
          ce('div', null,
            ce('h2', null, forkFrom ? 'Fork a scenario' : 'Build a scenario'),
            ce('p', { className: 'cm-sub' },
              forkFrom ? 'Your variant credits the original author automatically.'
                       : 'Seven short steps. Nothing is published until the last one.'))
        ),
        ce(ScenarioBuilder, {
          initial: forkFrom ? forkFrom.draft : null,
          forkOf: forkFrom ? forkFrom.of : '',
          forkOfTitle: forkFrom ? forkFrom.ofTitle : '',
          forkOfAuthor: forkFrom ? forkFrom.ofAuthor : '',
          forkOfAuthorId: forkFrom ? forkFrom.ofAuthorId : '',
          onCancel: function () { setView('list'); setForkFrom(null); },
          onDone: function (row) { list.prepend(row); setForkFrom(null); setView('list'); }
        })
      );
    }

    var visible = list.items.filter(function (s) { return !s.removed || s.authorId === myId() || isAdmin(); })
      .filter(function (s) { return !cat || s.category === cat; })
      .sort(function (a, b) { if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1; return 0; });

    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-head' },
        ce('div', { style: { flex: '1 1 200px' } },
          ce('h2', null, 'Scenario workshop'),
          ce('p', { className: 'cm-sub' }, 'Scenarios built by students, runnable in the simulation engine.')),
        ce('button', { className: 'btn btn-primary', onClick: function () { setForkFrom(null); setView('build'); } },
          '+ Build a scenario')
      ),

      gate.banned ? ce(BannedNotice, { reason: gate.banReason }) : null,

      ce('div', { className: 'cm-toolbar' },
        ce('select', { className: 'cm-select', style: { flex: '0 1 170px' }, value: cat,
          'aria-label': 'Filter scenarios by category',
          onChange: function (e) { setCat(e.target.value); } },
          ce('option', { value: '' }, 'All categories'),
          CATEGORIES.map(function (c) { return ce('option', { key: c, value: c }, c); })),
        ce(Segmented, {
          label: 'Sort', ariaLabel: 'Sort scenarios', value: sort,
          options: [{ id: 'top', label: 'Top' }, { id: 'newest', label: 'Newest' }],
          onChange: setSort
        })
      ),

      list.error ? ce(ErrorBox, { error: list.error, onRetry: list.reload }) : null,
      list.loading && !visible.length ? ce(Spinner, { label: 'Loading scenarios...' }) : null,

      !list.loading && !visible.length && !list.error
        ? ce(Empty, {
            icon: '⚕', title: 'No community scenarios yet',
            text: 'Turn the sim you just did in lab into a scenario your cohort can run. The builder walks you through it - patient, vitals, labs, orders, priorities, questions.',
            actions: ce('button', { className: 'btn btn-primary', onClick: function () { setView('build'); } }, 'Build the first scenario'),
            tips: [
              'Start from a case you already know cold - you will finish in 15 minutes',
              'AI can draft the skeleton from a topic; you correct the clinical details',
              'Fork a classmate\'s scenario to make a harder variant'
            ]
          })
        : null,

      ce('div', { className: 'cm-list' },
        visible.map(function (s) {
          return ce(ScenarioCard, {
            key: s._id, s: s, myVote: votes['scenario:' + s._id],
            canVote: gate.canPost, voteReason: gate.blockReason,
            onVote: onVote, onRun: onRun, onFork: onFork, onFeature: onFeature,
            onDelete: onDelete, onReport: setReporting
          });
        })),

      ce(LoadMore, { more: list.more, loading: list.loading, onClick: list.loadMore, label: 'Load more scenarios' }),

      reporting ? ce(ReportDialog, {
        targetType: 'scenario', targetId: reporting._id, targetPath: P.scenarios + '/' + reporting._id,
        preview: reporting.title, authorId: reporting.authorId, authorName: reporting.authorName,
        onClose: function () { setReporting(null); }, onDone: function () { setReporting(null); }
      }) : null
    );
  }

  /* =========================================================================
   * 4. STUDY GROUPS
   * ====================================================================== */

  var PROGRESS_STATES = [
    { id: 'none',    label: 'Not started', pct: 0,   tone: '' },
    { id: 'started', label: 'Working on it', pct: 50, tone: 'medium' },
    { id: 'done',    label: 'Done',        pct: 100, tone: 'easy' }
  ];

  function makeInviteCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '', i;
    for (i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  }

  function CreateGroupForm(props) {
    var s0 = useState('');   var name = s0[0], setName = s0[1];
    var s1 = useState('');   var desc = s1[0], setDesc = s1[1];
    var s2 = useState('');   var goal = s2[0], setGoal = s2[1];
    var s3 = useState('');   var due = s3[0], setDue = s3[1];
    var s4 = useState('public'); var vis = s4[0], setVis = s4[1];
    var s5 = useState('');   var err = s5[0], setErr = s5[1];
    var s6 = useState(false); var busy = s6[0], setBusy = s6[1];

    function submit() {
      var n = clean(name, LIMIT.name);
      if (n.length < 3) { setErr('Give the group a name.'); return; }
      var msg = rateCheck('group');
      if (msg) { setErr(msg); return; }
      setBusy(true); setErr('');
      var code = makeInviteCode();
      var uid = myId();
      var members = {};
      members[uid] = { name: myName(), joinedAt: now(), role: 'owner', progress: 'none' };
      var row = {
        name: n,
        description: clean(desc, LIMIT.desc),
        goal: clean(goal, LIMIT.goal),
        goalDue: clean(due, 30),
        visibility: vis,
        inviteCode: code,
        authorId: uid,
        ownerName: myName(),
        createdAt: now(),
        memberCount: 1,
        members: members
      };
      pushAt(P.groups, row).then(function (id) {
        rateNote('group');
        bumpStat('groupsFounded', 1);
        recordActivity('group', { text: myName() + ' started the study group "' + n + '"',
                                  targetType: 'group', targetId: id });
        props.onDone(merge(row, { _id: id }));
      })['catch'](function (e) {
        setBusy(false);
        setErr(writeErrText(e, 'Could not create that group. Try again in a moment.'));
      });
    }

    return ce('div', null,
      ce(Field, { label: 'Group name', id: 'cm-g-name', required: true, max: LIMIT.name, value: name },
        ce('input', { id: 'cm-g-name', type: 'text', className: 'cm-input', value: name, maxLength: LIMIT.name,
          onChange: function (e) { setName(e.target.value); }, placeholder: 'Thursday Med Admin crew' })),
      ce(Field, { label: 'What is this group for?', id: 'cm-g-desc', max: LIMIT.desc, value: desc },
        ce('textarea', { id: 'cm-g-desc', className: 'cm-textarea', value: desc, maxLength: LIMIT.desc,
          style: { minHeight: 70 }, onChange: function (e) { setDesc(e.target.value); },
          placeholder: 'Small group grinding through med calc and the six rights before signoffs.' })),
      ce('div', { className: 'cm-toolbar' },
        ce('div', { style: { flex: '1 1 220px' } },
          ce('label', { className: 'cm-label', htmlFor: 'cm-g-goal' }, 'Shared goal'),
          ce('input', { id: 'cm-g-goal', type: 'text', className: 'cm-input', value: goal, maxLength: LIMIT.goal,
            onChange: function (e) { setGoal(e.target.value); }, placeholder: 'Med Admin signoff Friday' })),
        ce('div', { style: { flex: '0 1 170px' } },
          ce('label', { className: 'cm-label', htmlFor: 'cm-g-due' }, 'Target date'),
          ce('input', { id: 'cm-g-due', type: 'date', className: 'cm-input', value: due,
            onChange: function (e) { setDue(e.target.value); } }))
      ),
      ce('div', { className: 'cm-field' },
        ce('label', { className: 'cm-label' }, 'Who can join'),
        ce('div', { className: 'cm-actions' },
          ce('label', { className: 'cm-actions', style: { gap: 6, cursor: 'pointer', color: 'var(--text2)' } },
            ce('input', { type: 'radio', name: 'cm-vis', checked: vis === 'public',
              onChange: function () { setVis('public'); } }),
            ce('span', null, 'Anyone in the cohort')),
          ce('label', { className: 'cm-actions', style: { gap: 6, cursor: 'pointer', color: 'var(--text2)' } },
            ce('input', { type: 'radio', name: 'cm-vis', checked: vis === 'code',
              onChange: function () { setVis('code'); } }),
            ce('span', null, 'Invite code only'))),
        ce('div', { className: 'cm-hint' }, 'You get a 6-character code either way - handy for sharing in a group chat.')),
      err ? ce('div', { className: 'cm-err', role: 'alert' }, err) : null,
      ce('div', { className: 'cm-actions end' },
        ce('button', { className: 'btn btn-outline', onClick: props.onCancel }, 'Cancel'),
        ce('button', { className: 'btn btn-primary', onClick: submit, disabled: busy },
          busy ? 'Creating...' : 'Create group'))
    );
  }

  function DeckPicker(props) {
    var s0 = useState('questions'); var tab = s0[0], setTab = s0[1];
    var a = useAsync(function () {
      return fetchPage(tab === 'questions' ? P.questions : P.scenarios, 'score', 15, null);
    }, [tab], true);
    var state = a[0];
    var rows = state.data || [];
    return ce(Modal, { title: 'Add to the shared deck', onClose: props.onClose },
      ce('div', { className: 'cm-tabs', role: 'tablist', 'aria-label': 'Content type' },
        ce('button', { className: 'cm-tab', role: 'tab', 'aria-selected': tab === 'questions' ? 'true' : 'false',
          onClick: function () { setTab('questions'); } }, 'Top questions'),
        ce('button', { className: 'cm-tab', role: 'tab', 'aria-selected': tab === 'scenarios' ? 'true' : 'false',
          onClick: function () { setTab('scenarios'); } }, 'Top scenarios')),
      state.loading ? ce(Spinner, null) : null,
      state.error ? ce(ErrorBox, { error: state.error }) : null,
      !state.loading && !rows.length
        ? ce(Empty, { icon: '◇', title: 'Nothing to add yet',
            text: 'Once the community has questions or scenarios, you can pull them into your group deck from here.' })
        : null,
      ce('div', { className: 'cm-list' },
        rows.filter(function (r) { return !r.removed; }).map(function (r) {
          return ce('div', { key: r._id, className: 'cm-item', style: { padding: 12 } },
            ce('div', { className: 'cm-item-main' },
              ce('p', { className: 'cm-item-text' }, clean(tab === 'questions' ? r.text : r.title, 200)),
              ce('div', { className: 'cm-item-foot' },
                ce(Chip, null, r.category || 'Other'),
                ce('span', null, num(r.score, 0) + ' points'))),
            ce('button', { className: 'btn btn-outline btn-sm',
              onClick: function () { props.onAdd(tab === 'questions' ? 'question' : 'scenario', r); } }, 'Add'));
        }))
    );
  }

  function GroupPage(props) {
    var g = props.group;
    var gate = useCommunityGate();
    var s0 = useState(g);        var group = s0[0], setGroup = s0[1];
    var s1 = useState(false);    var picking = s1[0], setPicking = s1[1];
    var s2 = useState('');       var sTitle = s2[0], setSTitle = s2[1];
    var s3 = useState('');       var sWhen = s3[0], setSWhen = s3[1];
    var s4 = useState('');       var err = s4[0], setErr = s4[1];

    var uid = myId();
    var members = group.members || {};
    var isMember = !!members[uid];
    var isOwner = group.authorId === uid;

    var deck = usePaged({ path: P.groups + '/' + group._id + '/deck', orderBy: 'addedAt', pageSize: 20, enabled: gate.hasDb });
    var sessions = usePaged({ path: P.groups + '/' + group._id + '/sessions', orderBy: 'at', pageSize: 10, enabled: gate.hasDb });

    function join() {
      if (!gate.canPost) { toast(gate.blockReason, 'info'); return; }
      var entry = { name: myName(), joinedAt: now(), role: 'member', progress: 'none' };
      var next = merge(members, {});
      next[uid] = entry;
      setGroup(merge(group, { members: next, memberCount: Object.keys(next).length }));
      updateAt(P.groups + '/' + group._id + '/members/' + uid, entry).then(function () {
        return bumpCounter(P.groups + '/' + group._id + '/memberCount', 1);
      }).then(function () {
        recordActivity('group-join', { text: myName() + ' joined "' + clean(group.name, 60) + '"',
                                       targetType: 'group', targetId: group._id });
      })['catch'](function () {
        setGroup(group);
        toast('Could not join that group. Check your connection and try again.', 'error');
      });
    }

    function leave() {
      if (!window.confirm('Leave this group?')) return;
      var next = merge(members, {});
      delete next[uid];
      setGroup(merge(group, { members: next, memberCount: Object.keys(next).length }));
      writeAt(P.groups + '/' + group._id + '/members/' + uid, null).then(function () {
        return bumpCounter(P.groups + '/' + group._id + '/memberCount', -1);
      })['catch'](function () { toast('Could not leave that group - you are still a member.', 'error'); });
    }

    function setProgressState(stateId) {
      if (!isMember) return;
      var next = merge(members, {});
      next[uid] = merge(next[uid], { progress: stateId, progressAt: now() });
      setGroup(merge(group, { members: next }));
      updateAt(P.groups + '/' + group._id + '/members/' + uid, { progress: stateId, progressAt: now() })
        ['catch'](function () { setGroup(group); toast('Could not save your progress marker. It has been put back.', 'error'); });
    }

    function addDeckItem(kind, row) {
      var item = {
        type: kind, refId: row._id,
        title: clean(kind === 'question' ? row.text : row.title, 200),
        category: row.category || '',
        addedBy: myName(), addedById: uid, addedAt: now()
      };
      pushAt(P.groups + '/' + group._id + '/deck', item).then(function (id) {
        deck.prepend(merge(item, { _id: id }));
        setPicking(false);
        toast('Added. Everyone in the group can see it now.', 'success');
      })['catch'](function () { toast('Could not add that to the group deck. Nothing was saved.', 'error'); });
    }

    function addSession() {
      var t = clean(sTitle, LIMIT.title);
      if (t.length < 3) { setErr('Name the session.'); return; }
      if (!sWhen) { setErr('Pick a date and time.'); return; }
      var at = Date.parse(sWhen);
      if (!isFinite(at)) { setErr('That date did not parse.'); return; }
      var attendees = {};
      attendees[uid] = myName();
      var row = { title: t, at: at, createdBy: myName(), createdById: uid, createdAt: now(), attendees: attendees };
      pushAt(P.groups + '/' + group._id + '/sessions', row).then(function (id) {
        sessions.prepend(merge(row, { _id: id }));
        setSTitle(''); setSWhen(''); setErr('');
      })['catch'](function () { setErr('Could not save that session.'); });
    }

    function toggleAttend(s) {
      var going = s.attendees && s.attendees[uid];
      var next = merge(s.attendees || {}, {});
      if (going) delete next[uid]; else next[uid] = myName();
      sessions.patch(s._id, { attendees: next });
      writeAt(P.groups + '/' + group._id + '/sessions/' + s._id + '/attendees/' + uid, going ? null : myName())
        ['catch'](function () { sessions.patch(s._id, { attendees: s.attendees }); toast('Could not save your RSVP. It has been put back.', 'error'); });
    }

    var memberIds = Object.keys(members);
    var doneCount = memberIds.filter(function (k) { return members[k].progress === 'done'; }).length;
    var groupPct = memberIds.length ? Math.round(doneCount / memberIds.length * 100) : 0;

    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-head' },
        ce('button', { className: 'btn btn-outline btn-sm', onClick: props.onBack }, '← Groups'),
        ce('div', { style: { flex: '1 1 200px' } },
          ce('h2', null, clean(group.name, LIMIT.name)),
          ce('p', { className: 'cm-sub' }, clean(group.description, LIMIT.desc))),
        isMember
          ? ce('button', { className: 'btn btn-outline btn-sm', onClick: leave }, 'Leave')
          : ce('button', { className: 'btn btn-primary', onClick: join }, 'Join group')
      ),

      group.goal ? ce('div', { className: 'card' },
        ce('div', { className: 'cm-chip-row', style: { marginBottom: 8 } },
          ce(Chip, null, '◎ Shared goal'),
          group.goalDue ? ce(Chip, { tone: 'medium' }, 'by ' + clean(group.goalDue, 30)) : null),
        ce('h3', { style: { marginBottom: 10 } }, clean(group.goal, LIMIT.goal)),
        ce('div', { className: 'cm-bar green' }, ce('i', { style: { width: groupPct + '%' } })),
        ce('p', { className: 'cm-mini', style: { marginTop: 6 } },
          doneCount + ' of ' + memberIds.length + ' finished (' + groupPct + '%)'),
        isMember ? ce('div', { className: 'cm-actions', style: { marginTop: 12 } },
          ce('span', { className: 'cm-mini' }, 'Your status:'),
          PROGRESS_STATES.map(function (s) {
            var on = (members[uid] && members[uid].progress === s.id) || (!members[uid].progress && s.id === 'none');
            return ce('button', {
              key: s.id, className: 'cm-tab', 'aria-pressed': on ? 'true' : 'false',
              onClick: function () { setProgressState(s.id); }
            }, s.label);
          })) : null
      ) : null,

      ce('div', { className: 'card' },
        ce('h3', null, 'Progress board'),
        ce('div', { className: 'cm-board' },
          memberIds.map(function (k) {
            var m = members[k];
            var stateDef = PROGRESS_STATES.filter(function (s) { return s.id === (m.progress || 'none'); })[0] || PROGRESS_STATES[0];
            return ce('div', { key: k, className: 'cm-brow' + (k === uid ? ' me' : '') },
              ce('span', { className: 'cm-avatar', 'aria-hidden': 'true' }, initials(m.name)),
              ce('div', { className: 'cm-bmain' },
                ce('div', { className: 'cm-actions', style: { gap: 6 } },
                  ce('span', { style: { fontWeight: 700, fontSize: '0.88rem' } }, clean(m.name, LIMIT.name)),
                  m.role === 'owner' ? ce(Chip, null, 'organizer') : null),
                ce('div', { className: 'cm-bar' + (stateDef.pct === 100 ? ' green' : '') },
                  ce('i', { style: { width: stateDef.pct + '%' } }))),
              ce('span', { className: 'cm-bval', style: { fontSize: '0.78rem' } }, stateDef.label));
          })),
        !memberIds.length ? ce('p', { className: 'cm-mini' }, 'No members yet.') : null
      ),

      ce('div', { className: 'card' },
        ce('div', { className: 'cm-head', style: { marginBottom: 8 } },
          ce('h3', { style: { flex: '1 1 auto', margin: 0 } }, 'Shared deck'),
          isMember ? ce('button', { className: 'btn btn-outline btn-sm', onClick: function () { setPicking(true); } },
            '+ Add item') : null),
        deck.loading && !deck.items.length ? ce(Spinner, null) : null,
        !deck.loading && !deck.items.length
          ? ce(Empty, { icon: '⌸', title: 'Empty deck',
              text: 'Pull in the community questions and scenarios this group is working through, so everyone studies the same set.' })
          : ce('div', { className: 'cm-list' },
              deck.items.map(function (it) {
                return ce('div', { key: it._id, className: 'cm-item', style: { padding: 12 } },
                  ce('div', { className: 'cm-item-main' },
                    ce('div', { className: 'cm-chip-row', style: { marginBottom: 6 } },
                      ce(Chip, null, it.type === 'question' ? 'Question' : 'Scenario'),
                      it.category ? ce(Chip, null, it.category) : null),
                    ce('p', { className: 'cm-item-text' }, clean(it.title, 200)),
                    ce('div', { className: 'cm-item-foot' },
                      ce('span', null, 'added by ' + clean(it.addedBy, LIMIT.name)),
                      ce('span', null, timeAgo(it.addedAt)))),
                  (it.addedById === uid || isOwner) ? ce('button', {
                    className: 'cm-del', 'aria-label': 'Remove from deck',
                    onClick: function () {
                      deck.drop(it._id);
                      writeAt(P.groups + '/' + group._id + '/deck/' + it._id, null)['catch'](function () { deck.reload(); });
                    }
                  }, '✕') : null);
              })),
        ce(LoadMore, { more: deck.more, loading: deck.loading, onClick: deck.loadMore })
      ),

      ce('div', { className: 'card' },
        ce('h3', null, 'Study sessions'),
        isMember ? ce('div', { className: 'cm-toolbar' },
          ce('input', { type: 'text', className: 'cm-input', style: { flex: '1 1 160px' }, value: sTitle,
            maxLength: LIMIT.title, placeholder: 'Sim lab run-through', 'aria-label': 'Session title',
            onChange: function (e) { setSTitle(e.target.value); } }),
          ce('input', { type: 'datetime-local', className: 'cm-input', style: { flex: '0 1 210px' }, value: sWhen,
            'aria-label': 'Session date and time',
            onChange: function (e) { setSWhen(e.target.value); } }),
          ce('button', { className: 'btn btn-outline', onClick: addSession }, 'Add session')
        ) : null,
        err ? ce('div', { className: 'cm-err', role: 'alert' }, err) : null,
        sessions.loading && !sessions.items.length ? ce(Spinner, null) : null,
        !sessions.loading && !sessions.items.length
          ? ce('p', { className: 'cm-mini' }, 'No sessions scheduled. Put one on the board and see who shows up.')
          : ce('div', { className: 'cm-list' },
              sessions.items.map(function (s) {
                var att = s.attendees || {};
                var names = Object.keys(att).map(function (k) { return clean(att[k], LIMIT.name); });
                var going = !!att[uid];
                var past = num(s.at, 0) < now();
                return ce('div', { key: s._id, className: 'cm-item', style: { padding: 12, opacity: past ? 0.65 : 1 } },
                  ce('div', { className: 'cm-item-main' },
                    ce('div', { className: 'cm-chip-row', style: { marginBottom: 6 } },
                      ce(Chip, { tone: past ? '' : 'easy' }, past ? 'Past' : 'Upcoming'),
                      ce(Chip, null, whenStr(s.at))),
                    ce('h4', { className: 'cm-item-title', style: { fontSize: '0.95rem' } }, clean(s.title, LIMIT.title)),
                    ce('div', { className: 'cm-item-foot' },
                      ce('span', null, names.length ? 'Going: ' + names.join(', ') : 'Nobody has said yes yet'))),
                  isMember && !past ? ce('button', {
                    className: 'btn btn-outline btn-sm', 'aria-pressed': going ? 'true' : 'false',
                    onClick: function () { toggleAttend(s); }
                  }, going ? '✓ Going' : 'I am in') : null);
              })),
        ce(LoadMore, { more: sessions.more, loading: sessions.loading, onClick: sessions.loadMore })
      ),

      ce('div', { className: 'card' },
        ce(CommunityDiscussion, {
          targetId: 'group:' + group._id, targetType: 'group',
          targetTitle: group.name, targetAuthorId: group.authorId,
          emptyText: 'Group chat lives here. Post what you are stuck on before the next session.'
        })),

      isMember || isOwner ? ce('div', { className: 'cm-mini', style: { marginTop: 10 } },
        'Invite code: ' + clean(group.inviteCode, 12)) : null,

      picking ? ce(DeckPicker, { onClose: function () { setPicking(false); }, onAdd: addDeckItem }) : null
    );
  }

  function CommunityStudyGroups(props) {
    var gate = useCommunityGate();
    var s0 = useState('list');  var view = s0[0], setView = s0[1];
    var s1 = useState(null);    var active = s1[0], setActive = s1[1];
    var s2 = useState('');      var code = s2[0], setCode = s2[1];
    var s3 = useState('');      var codeErr = s3[0], setCodeErr = s3[1];

    var list = usePaged({ path: P.groups, orderBy: 'createdAt', pageSize: PAGE, enabled: gate.hasDb });
    var uid = myId();

    function joinByCode() {
      var c = clean(code, 12).toUpperCase();
      if (c.length < 4) { setCodeErr('Enter the 6-character code.'); return; }
      setCodeErr('');
      var r = ref(P.groups);
      if (!r) return;
      r.orderByChild('inviteCode').equalTo(c).limitToLast(1).once('value').then(function (snap) {
        var rows = snapToArray(snap);
        if (!rows.length) { setCodeErr('No group with that code.'); return; }
        setActive(rows[0]); setView('detail');
      })['catch'](function () { setCodeErr('Could not look that up.'); });
    }

    if (!gate.hasDb) return ce(OfflineWall, null);

    if (view === 'detail' && active) {
      return ce(GroupPage, { group: active, onBack: function () { setView('list'); list.reload(); } });
    }

    if (view === 'create') {
      return ce('div', { className: 'cm-wrap' },
        ce('div', { className: 'cm-head' },
          ce('button', { className: 'btn btn-outline btn-sm', onClick: function () { setView('list'); } }, '← Back'),
          ce('div', null, ce('h2', null, 'Start a study group'))),
        gate.canPost
          ? ce(CreateGroupForm, {
              onCancel: function () { setView('list'); },
              onDone: function (row) { list.prepend(row); setActive(row); setView('detail'); } })
          : (gate.banned ? ce(BannedNotice, { reason: gate.banReason }) : ce(SignInWall, null)));
    }

    var mine = list.items.filter(function (g) { return g.members && g.members[uid]; });
    var open = list.items.filter(function (g) { return g.visibility === 'public' && !(g.members && g.members[uid]); });

    function groupCard(g) {
      var count = g.members ? Object.keys(g.members).length : num(g.memberCount, 0);
      return ce('div', {
        key: g._id, className: 'cm-item cm-clickable', role: 'button', tabIndex: 0,
        onClick: function () { setActive(g); setView('detail'); },
        onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(g); setView('detail'); } }
      },
        ce('div', { className: 'cm-item-main' },
          ce('div', { className: 'cm-chip-row', style: { marginBottom: 6 } },
            ce(Chip, null, g.visibility === 'public' ? 'Open to cohort' : 'Invite code'),
            ce(Chip, null, pluralize(count, 'member'))),
          ce('h3', { className: 'cm-item-title' }, clean(g.name, LIMIT.name)),
          g.goal ? ce('p', { className: 'cm-item-text' }, '◎ ' + clean(g.goal, LIMIT.goal) +
            (g.goalDue ? ' - by ' + clean(g.goalDue, 30) : '')) : null,
          ce('div', { className: 'cm-item-foot' },
            ce(AuthorChip, { uid: g.authorId, name: g.ownerName }),
            ce('span', null, timeAgo(g.createdAt)))));
    }

    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-head' },
        ce('div', { style: { flex: '1 1 200px' } },
          ce('h2', null, 'Study groups'),
          ce('p', { className: 'cm-sub' }, 'Small groups, one shared goal, visible progress.')),
        ce('button', { className: 'btn btn-primary', onClick: function () { setView('create'); } }, '+ Start a group')),

      ce('div', { className: 'cm-toolbar' },
        ce('input', { type: 'text', className: 'cm-input', style: { flex: '0 1 170px' }, value: code,
          maxLength: 8, placeholder: 'Invite code', 'aria-label': 'Join by invite code',
          onChange: function (e) { setCode(e.target.value.toUpperCase()); },
          onKeyDown: function (e) { if (e.key === 'Enter') joinByCode(); } }),
        ce('button', { className: 'btn btn-outline', onClick: joinByCode }, 'Join by code'),
        codeErr ? ce('span', { className: 'cm-err', role: 'alert', style: { marginTop: 0 } }, codeErr) : null),

      list.error ? ce(ErrorBox, { error: list.error, onRetry: list.reload }) : null,
      list.loading && !list.items.length ? ce(Spinner, { label: 'Loading groups...' }) : null,

      mine.length ? ce('div', { style: { marginBottom: 18 } },
        ce('h3', { className: 'cm-item-title' }, 'Your groups'),
        ce('div', { className: 'cm-list' }, mine.map(groupCard))) : null,

      !list.loading && !list.items.length && !list.error
        ? ce(Empty, {
            icon: '◈', title: 'No study groups yet',
            text: 'Groups work best small - three or four people with one deadline. Name the thing you are all dreading and put a date on it.',
            actions: ce('button', { className: 'btn btn-primary', onClick: function () { setView('create'); } }, 'Start the first group'),
            tips: ['Set one shared goal, like "Med Admin signoff Friday"',
                   'Add the community questions you are all missing to the group deck',
                   'Schedule one session - the progress board does the rest']
          })
        : ce('div', null,
            open.length ? ce('h3', { className: 'cm-item-title' }, 'Open groups') : null,
            ce('div', { className: 'cm-list' }, open.map(groupCard)),
            !open.length && mine.length ? ce('p', { className: 'cm-mini' }, 'No other open groups right now.') : null),

      ce(LoadMore, { more: list.more, loading: list.loading, onClick: list.loadMore, label: 'Load more groups' })
    );
  }

  /* =========================================================================
   * 5. SHARED DECKS  (import into FlashcardHub's local deck structure)
   * ====================================================================== */

  function localDecks() {
    var m = MMx();
    var prog = (typeof m.getProgress === 'function') ? (m.getProgress() || {}) : {};
    return prog.flashcardDecks || [];
  }

  /** FlashcardHub deck shape: {id, name, description, cards:[{term,definition}], createdAt, studied} */
  function importDeckLocally(deck) {
    var m = MMx();
    if (typeof m.setProgress !== 'function') {
      toast('Could not read the flashcard decks saved on this device.', 'error');
      return false;
    }
    var cards = (deck.cards || []).map(function (c) {
      return { term: clean(c.term, 300), definition: clean(c.definition, 1200) };
    }).filter(function (c) { return c.term && c.definition; });
    if (!cards.length) { toast('That deck has no usable cards, so nothing was imported.', 'error'); return false; }
    var local = {
      id: 'deck_' + now(),
      name: clean(deck.name, 50),
      description: clean(deck.description, 100) || ('Imported from ' + clean(deck.authorName, LIMIT.name)),
      cards: cards,
      createdAt: now(),
      studied: 0,
      communityDeckId: deck._id || '',
      importedFrom: clean(deck.authorName, LIMIT.name)
    };
    m.setProgress(function (p) {
      var decks = (p && p.flashcardDecks) ? p.flashcardDecks.slice() : [];
      decks.push(local);
      return merge(p, { flashcardDecks: decks });
    });
    return true;
  }

  /** Turn community questions into flashcards so any deck type lands in the
   *  same local structure FlashcardHub already understands. */
  function questionsToCards(questions) {
    return questions.map(function (q) {
      var answer = (q.correct || []).map(function (i) {
        return letter(i) + '. ' + clean((q.options || [])[i], LIMIT.option);
      }).join('\n');
      return {
        term: clean(q.text, 300),
        definition: clean(answer + (q.rationale ? '\n\nWhy: ' + q.rationale : ''), 1200)
      };
    });
  }

  function PublishDeckForm(props) {
    var s0 = useState('');   var name = s0[0], setName = s0[1];
    var s1 = useState('');   var desc = s1[0], setDesc = s1[1];
    var s2 = useState('');   var pick = s2[0], setPick = s2[1];
    var s3 = useState('');   var err = s3[0], setErr = s3[1];
    var s4 = useState(false); var busy = s4[0], setBusy = s4[1];
    var s5 = useState('flashcards'); var mode = s5[0], setMode = s5[1];
    var decks = localDecks();

    function submit() {
      var n = clean(name, LIMIT.name);
      if (n.length < 3) { setErr('Name the deck.'); return; }
      var msg = rateCheck('deck');
      if (msg) { setErr(msg); return; }
      setBusy(true); setErr('');

      var build;
      if (mode === 'flashcards') {
        var chosen = decks.filter(function (d) { return d.id === pick; })[0];
        if (!chosen) { setBusy(false); setErr('Pick one of your local decks.'); return; }
        var cards = (chosen.cards || []).slice(0, 200).map(function (c) {
          return { term: clean(c.term, 300), definition: clean(c.definition, 1200) };
        });
        if (!cards.length) { setBusy(false); setErr('That deck has no cards.'); return; }
        build = Promise.resolve({ cards: cards, source: 'flashcards' });
      } else {
        build = fetchPage(P.questions, 'score', 20, null).then(function (rows) {
          var usable = rows.filter(function (r) { return !r.removed && r.rationale; });
          return { cards: questionsToCards(usable), source: 'questions' };
        });
      }

      build.then(function (res) {
        if (!res.cards.length) throw new Error('Nothing to publish yet.');
        var row = {
          name: n,
          description: clean(desc, LIMIT.desc),
          source: res.source,
          cardCount: res.cards.length,
          cards: res.cards,
          authorId: myId(), authorName: myName(),
          createdAt: now(), score: 0, importCount: 0, commentCount: 0, removed: false
        };
        return pushAt(P.decks, row).then(function (id) {
          rateNote('deck');
          bumpStat('decks', 1);
          recordActivity('deck', { text: myName() + ' published the deck "' + n + '"',
                                   targetType: 'deck', targetId: id });
          props.onDone(merge(row, { _id: id }));
        });
      })['catch'](function (e) {
        setBusy(false);
        setErr(writeErrText(e, 'Could not publish that deck. Try again - your cards are safe in your own flashcards.'));
      });
    }

    return ce('div', null,
      ce('div', { className: 'cm-field' },
        ce('label', { className: 'cm-label' }, 'What are you publishing?'),
        ce('div', { className: 'cm-actions' },
          ce('label', { className: 'cm-actions', style: { gap: 6, cursor: 'pointer', color: 'var(--text2)' } },
            ce('input', { type: 'radio', name: 'cm-deckmode', checked: mode === 'flashcards',
              onChange: function () { setMode('flashcards'); } }),
            ce('span', null, 'One of my flashcard decks')),
          ce('label', { className: 'cm-actions', style: { gap: 6, cursor: 'pointer', color: 'var(--text2)' } },
            ce('input', { type: 'radio', name: 'cm-deckmode', checked: mode === 'questions',
              onChange: function () { setMode('questions'); } }),
            ce('span', null, 'Top community questions as cards')))),

      mode === 'flashcards' ? ce(Field, { label: 'Which deck?', id: 'cm-d-pick',
        hint: decks.length ? 'From your local flashcard decks.' : 'You do not have any local decks yet - build one in Flashcards first.' },
        ce('select', { id: 'cm-d-pick', className: 'cm-select', value: pick,
          onChange: function (e) { setPick(e.target.value); } },
          ce('option', { value: '' }, decks.length ? 'Choose a deck...' : 'No local decks'),
          decks.map(function (d) {
            return ce('option', { key: d.id, value: d.id },
              clean(d.name, 50) + ' (' + pluralize((d.cards || []).length, 'card') + ')');
          }))) : null,

      ce(Field, { label: 'Published name', id: 'cm-d-name', required: true, max: LIMIT.name, value: name },
        ce('input', { id: 'cm-d-name', type: 'text', className: 'cm-input', value: name, maxLength: LIMIT.name,
          onChange: function (e) { setName(e.target.value); }, placeholder: 'Cardiac meds - the ones I keep missing' })),
      ce(Field, { label: 'Description', id: 'cm-d-desc', max: LIMIT.desc, value: desc },
        ce('textarea', { id: 'cm-d-desc', className: 'cm-textarea', value: desc, maxLength: LIMIT.desc,
          style: { minHeight: 64 }, onChange: function (e) { setDesc(e.target.value); },
          placeholder: 'What is in it and who it helps.' })),
      err ? ce('div', { className: 'cm-err', role: 'alert' }, err) : null,
      ce('div', { className: 'cm-actions end' },
        ce('button', { className: 'btn btn-outline', onClick: props.onCancel }, 'Cancel'),
        ce('button', { className: 'btn btn-primary', onClick: submit, disabled: busy },
          busy ? 'Publishing...' : 'Publish deck')));
  }

  function CommunityDecks(props) {
    var gate = useCommunityGate();
    var s0 = useState('list');  var view = s0[0], setView = s0[1];
    var s1 = useState('top');   var sort = s1[0], setSort = s1[1];
    var s2 = useState({});      var imported = s2[0], setImported = s2[1];
    var s3 = useState(null);    var reporting = s3[0], setReporting = s3[1];

    var list = usePaged({
      path: P.decks, orderBy: sort === 'top' ? 'importCount' : 'createdAt',
      pageSize: PAGE, key: sort, enabled: gate.hasDb
    });

    function doImport(d) {
      var ok = importDeckLocally(d);
      if (!ok) return;
      setImported(function (cur) { var n = merge(cur, {}); n[d._id] = true; return n; });
      list.patch(d._id, { importCount: num(d.importCount, 0) + 1 });
      bumpCounter(P.decks + '/' + d._id + '/importCount', 1).then(function () {
        if (d.authorId && d.authorId !== myId()) {
          fetchOnce(P.decks + '/' + d._id + '/importCount').then(function (c) {
            bumpCounter(P.stats + '/' + d.authorId + '/bestDeckImports', 0);
            updateAt(P.stats + '/' + d.authorId, { bestDeckImports: num(c, 0) })['catch'](function () { });
          })['catch'](function () { });
        }
      })['catch'](function () { list.patch(d._id, { importCount: num(d.importCount, 0) }); });
      toast('Imported. The cards are in your own flashcards now.', 'success');
    }

    if (!gate.hasDb) return ce(OfflineWall, null);

    if (view === 'publish') {
      return ce('div', { className: 'cm-wrap' },
        ce('div', { className: 'cm-head' },
          ce('button', { className: 'btn btn-outline btn-sm', onClick: function () { setView('list'); } }, '← Back'),
          ce('div', null, ce('h2', null, 'Publish a deck'),
            ce('p', { className: 'cm-sub' }, 'Anyone in the cohort can import it into their own flashcards.'))),
        gate.canPost
          ? ce(PublishDeckForm, { onCancel: function () { setView('list'); },
              onDone: function (row) { list.prepend(row); setView('list'); toast('Deck published. Your cohort can import it now.', 'success'); } })
          : (gate.banned ? ce(BannedNotice, { reason: gate.banReason }) : ce(SignInWall, null)));
    }

    var visible = list.items.filter(function (d) { return !d.removed || d.authorId === myId() || isAdmin(); });

    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-head' },
        ce('div', { style: { flex: '1 1 200px' } },
          ce('h2', null, 'Shared decks'),
          ce('p', { className: 'cm-sub' }, 'Import a classmate\'s deck straight into your own flashcards.')),
        ce('button', { className: 'btn btn-primary', onClick: function () { setView('publish'); } }, '+ Publish a deck')),

      gate.banned ? ce(BannedNotice, { reason: gate.banReason }) : null,

      ce(Segmented, {
        label: 'Sort', ariaLabel: 'Sort decks', value: sort,
        options: [{ id: 'top', label: 'Most imported' }, { id: 'newest', label: 'Newest' }],
        onChange: setSort
      }),

      list.error ? ce(ErrorBox, { error: list.error, onRetry: list.reload }) : null,
      list.loading && !visible.length ? ce(Spinner, { label: 'Loading decks...' }) : null,

      !list.loading && !visible.length && !list.error
        ? ce(Empty, {
            icon: '⌸', title: 'No shared decks yet',
            text: 'You already made flashcards for yourself. Publishing one takes ten seconds and saves somebody else an hour.',
            actions: ce('button', { className: 'btn btn-primary', onClick: function () { setView('publish'); } }, 'Publish your first deck'),
            tips: ['Lab values and normal ranges are always the most imported',
                   'High-alert meds with their antidotes',
                   'The ten questions you personally keep getting wrong']
          })
        : ce('div', { className: 'cm-grid' },
            visible.map(function (d) {
              return ce('div', { key: d._id, className: 'cm-item', style: { display: 'block' } },
                ce('div', { className: 'cm-chip-row', style: { marginBottom: 8 } },
                  ce(Chip, null, d.source === 'questions' ? 'From questions' : 'Flashcards'),
                  ce(Chip, null, pluralize(num(d.cardCount, 0), 'card'))),
                ce('h3', { className: 'cm-item-title' }, clean(d.name, LIMIT.name)),
                ce('p', { className: 'cm-item-text', style: { fontSize: '0.88rem' } }, clean(d.description, LIMIT.desc)),
                ce('div', { className: 'cm-item-foot' },
                  ce(AuthorChip, { uid: d.authorId, name: d.authorName }),
                  ce('span', null, pluralize(num(d.importCount, 0), 'import'))),
                ce('div', { className: 'cm-actions', style: { marginTop: 10 } },
                  ce('button', { className: 'btn btn-primary btn-sm', onClick: function () { doImport(d); },
                    disabled: !!imported[d._id] },
                    imported[d._id] ? '✓ Imported' : 'Import to my flashcards'),
                  d.authorId !== myId() ? ce('button', { className: 'cm-linkbtn danger',
                    onClick: function () { setReporting(d); } }, 'Report') : null,
                  (d.authorId === myId() || isAdmin()) ? ce('button', { className: 'cm-linkbtn danger',
                    onClick: function () {
                      if (!window.confirm('Delete this deck? Existing imports stay with the people who took them.')) return;
                      list.drop(d._id);
                      writeAt(P.decks + '/' + d._id, null)['catch'](function () { list.reload(); });
                    } }, 'Delete') : null));
            })),

      ce(LoadMore, { more: list.more, loading: list.loading, onClick: list.loadMore, label: 'Load more decks' }),

      reporting ? ce(ReportDialog, {
        targetType: 'deck', targetId: reporting._id, targetPath: P.decks + '/' + reporting._id,
        preview: reporting.name, authorId: reporting.authorId, authorName: reporting.authorName,
        onClose: function () { setReporting(null); }, onDone: function () { setReporting(null); }
      }) : null
    );
  }

  /* =========================================================================
   * 6. LEADERBOARDS & RECOGNITION
   * ====================================================================== */

  var BOARDS = [
    { id: 'streak',       label: 'Study streak',        field: 'streak',       unit: 'day',
      blurb: 'Showing up beats cramming.', weekly: false },
    { id: 'sims',         label: 'Simulations done',    field: 'sims',         unit: 'sim',
      blurb: 'Reps in the sim engine.', weekly: true },
    { id: 'questions',    label: 'Questions contributed', field: 'questions',  unit: 'question',
      blurb: 'People who feed the bank.', weekly: true },
    { id: 'helpfulVotes', label: 'Helpful answers',     field: 'helpfulVotes', unit: 'upvote',
      blurb: 'Upvotes earned answering classmates. The one that matters.', weekly: true },
    { id: 'medAdminPct',  label: 'Med admin mastery',   field: 'medAdminPct',  unit: '%',
      blurb: 'Best med administration score.', weekly: false }
  ];

  function CommunityLeaderboards(props) {
    var gate = useCommunityGate();
    var s0 = useState('helpfulVotes'); var board = s0[0], setBoard = s0[1];
    var s1 = useState('all');          var range = s1[0], setRange = s1[1];

    // Bounded pull: the 120 most recently active students, ranked client-side.
    // Needs .indexOn ["updatedAt"] on /community/stats.
    var a = useAsync(function () {
      var r = ref(P.stats);
      if (!r) return [];
      return r.orderByChild('updatedAt').limitToLast(120).once('value').then(snapToArray);
    }, [gate.hasDb], gate.hasDb);
    var state = a[0];
    var rows = state.data || [];

    var def = BOARDS.filter(function (b) { return b.id === board; })[0] || BOARDS[0];
    var wk = weekKey();

    function valueFor(r) {
      var all = num(r[def.field], 0);
      if (range === 'week' && def.weekly) {
        if (r.wk !== wk) return 0;
        var base = (r.wkBase && r.wkBase[def.field] !== undefined) ? num(r.wkBase[def.field], 0) : 0;
        return Math.max(0, all - base);
      }
      return all;
    }

    var ranked = rows.map(function (r) { return merge(r, { _v: valueFor(r) }); })
      .filter(function (r) { return r._v > 0; })
      .sort(function (x, y) { return y._v - x._v; });

    var top = ranked.slice(0, 15);
    var maxV = top.length ? top[0]._v : 1;
    var myRow = null, myRank = 0, i;
    for (i = 0; i < ranked.length; i++) {
      if (ranked[i]._id === myId()) { myRow = ranked[i]; myRank = i + 1; break; }
    }
    var inTop = top.filter(function (r) { return r._id === myId(); }).length > 0;

    // Encouraging highlight: biggest weekly mover on the helpful-answers board.
    var mover = null;
    if (rows.length) {
      var best = 0;
      rows.forEach(function (r) {
        if (r.wk !== wk || !r.wkBase) return;
        var gained = num(r.helpfulVotes, 0) - num(r.wkBase.helpfulVotes, 0);
        if (gained > best) { best = gained; mover = merge(r, { _gain: gained }); }
      });
    }

    function boardRow(r, idx) {
      var pct = maxV ? Math.round(r._v / maxV * 100) : 0;
      var badges = computeBadges(r);
      return ce('div', { key: r._id, className: 'cm-brow' + (r._id === myId() ? ' me' : '') },
        ce('span', { className: 'cm-rank' + (idx < 3 ? ' top' : '') },
          ce('span', { 'aria-hidden': 'true' }, '#' + (idx + 1)),
          ce('span', { className: 'cm-sr' }, 'rank ' + (idx + 1))),
        ce('span', { className: 'cm-avatar', 'aria-hidden': 'true' }, initials(r.name)),
        ce('div', { className: 'cm-bmain' },
          ce('div', { className: 'cm-actions', style: { gap: 6 } },
            ce('span', { style: { fontWeight: 700, fontSize: '0.88rem' } }, clean(r.name, LIMIT.name) || 'Student'),
            r._id === myId() ? ce('span', { className: 'cm-flag mine' }, 'You') : null,
            ce(BadgeStrip, { ids: badges, max: 2 })),
          ce('div', { className: 'cm-bar' + (def.id === 'helpfulVotes' ? ' green' : '') },
            ce('i', { style: { width: pct + '%' } }))),
        ce('span', { className: 'cm-bval' },
          def.unit === '%' ? (r._v + '%') : String(r._v),
          ce('span', { className: 'cm-sr' }, ' ' + def.unit)));
    }

    if (!gate.hasDb) return ce(OfflineWall, null);

    /* This page used to render three stacked rows of visually identical pills -
       the hub's section nav, the board picker and the time range - with nothing
       saying which one changed the page. The board is now a labelled select
       (it is a choice of five, not navigation) and the range is a segmented
       control that reads as a filter. (DR05 MAJOR-6) */
    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-head' },
        ce('div', { style: { flex: '1 1 200px' } },
          ce('h2', null, 'Boards'),
          ce('p', { className: 'cm-sub' },
            'Five different boards, because nursing school is not one skill. Nobody is ranked on anything they did not choose to share.'))),

      ce('div', { className: 'cm-toolbar' },
        ce('div', { style: { flex: '1 1 240px' } },
          ce('label', { className: 'cm-label', htmlFor: 'cm-board-pick' }, 'Board'),
          ce('select', {
            id: 'cm-board-pick', className: 'cm-select', value: board,
            onChange: function (e) { setBoard(e.target.value); }
          }, BOARDS.map(function (b) { return ce('option', { key: b.id, value: b.id }, b.label); }))),
        def.weekly
          ? ce(Segmented, {
              label: 'Showing', ariaLabel: 'Time range', value: range,
              options: [{ id: 'week', label: 'This week' }, { id: 'all', label: 'All time' }],
              onChange: setRange
            })
          : ce('div', null,
              ce('span', { className: 'cm-seglab' }, 'Showing'),
              ce('div', { className: 'cm-mini' }, 'All time'))),

      ce('p', { className: 'cm-sub', style: { marginBottom: 12 } }, def.blurb),

      mover && mover._gain > 0 ? ce(Banner, { tone: 'good', icon: '↗' },
        ce('div', null,
          ce('b', null, 'Most helpful this week: ' + clean(mover.name, LIMIT.name) + '. '),
          '+' + pluralize(mover._gain, 'upvote') + ' on answers. Go say thanks on one of their replies.')) : null,

      state.loading ? ce(Spinner, { label: 'Counting...' }) : null,
      state.error ? ce(ErrorBox, { error: state.error }) : null,

      !state.loading && !top.length
        ? ce(Empty, {
            icon: '◔', title: 'No numbers on this board yet',
            text: 'Boards fill in as people study and contribute. Nothing here is a judgement - it is just a way to notice who has been helping.',
            tips: ['Answer one Help Wanted thread to appear on Helpful answers',
                   'Post one question to appear on Questions contributed',
                   'Run one simulation to appear on Simulations done']
          })
        : ce('div', { className: 'cm-board' }, top.map(boardRow)),

      (!inTop && myRow) ? ce('div', { style: { marginTop: 12 } },
        ce('p', { className: 'cm-mini', style: { marginBottom: 6 } }, 'Your position'),
        boardRow(myRow, myRank - 1)) : null,

      (!myRow && !state.loading) ? ce('p', { className: 'cm-mini', style: { marginTop: 12 } },
        'You are not on this board yet. One contribution puts you on it.') : null,

      ce('hr', { className: 'cm-divider' }),
      ce(BadgeGallery, null)
    );
  }

  function BadgeGallery(props) {
    var mine = useMyBadges();
    var have = {};
    mine.forEach(function (id) { have[id] = true; });
    var earned = BADGES.filter(function (b) { return have[b.id]; });
    var locked = BADGES.filter(function (b) { return !have[b.id]; });
    return ce('div', null,
      ce('h3', { className: 'cm-item-title' }, 'Contribution badges'),
      ce('p', { className: 'cm-sub', style: { marginBottom: 12 } },
        'Earned for things that help other people, not for logging in. ' +
        (earned.length ? 'You have ' + pluralize(earned.length, 'badge') + '.' : 'None yet - the first one is one question away.')),
      ce('div', { className: 'cm-grid' },
        BADGES.map(function (b) {
          var got = !!have[b.id];
          return ce('div', {
            key: b.id, className: 'cm-item', style: { display: 'block', opacity: got ? 1 : 0.6 }
          },
            ce('div', { className: 'cm-chip-row', style: { marginBottom: 6 } },
              ce(CommunityBadge, { id: b.id }),
              got ? ce('span', { className: 'cm-flag', style: { color: 'var(--green-fg, #4ade80)' } }, '✓ Earned')
                  : ce('span', { className: 'cm-mini' }, 'Not yet')),
            ce('p', { className: 'cm-mini' }, b.desc));
        })),
      locked.length ? null : ce('p', { className: 'cm-mini', style: { marginTop: 10 } }, 'Every badge earned. Genuinely impressive.')
    );
  }

  /* =========================================================================
   * 7. MODERATION (admin)
   * ====================================================================== */

  function removeContent(kind, id, path, reason, authorId) {
    var payload = {
      removed: true,
      removalReason: clean(reason, LIMIT.reason) || 'No reason given',
      removedBy: myName(),
      removedAt: now()
    };
    return updateAt(path, payload).then(function () {
      pushAt(P.modLog, {
        action: 'remove', targetType: kind, targetId: id, targetPath: path,
        reason: payload.removalReason, moderator: myName(), moderatorId: myId(),
        authorId: authorId || '', createdAt: now()
      })['catch'](function () { /* log failure is non-fatal */ });
      if (authorId) {
        notify(authorId, {
          type: 'removed',
          text: 'A moderator removed your ' + kind + '. Reason: ' + payload.removalReason,
          targetType: kind, targetId: id
        });
      }
      toast('Content removed and the author was told why.', 'success');
    })['catch'](function () {
      toast('Could not remove that. It is still visible to everyone.', 'error');
    });
  }

  function CommunityModeration(props) {
    var s0 = useState('open');   var filter = s0[0], setFilter = s0[1];
    var s1 = useState(null);     var editing = s1[0], setEditing = s1[1];
    var s2 = useState('');       var editText = s2[0], setEditText = s2[1];

    var list = usePaged({ path: P.reports, orderBy: 'createdAt', pageSize: 15, enabled: isAdmin() && !!getDb() });

    if (!isAdmin()) {
      return ce('div', { className: 'cm-wrap' },
        ce(Banner, { tone: 'warn', icon: '⊘' },
          ce('div', null, 'The moderation queue is for instructors and admins.')));
    }

    function resolve(rep, action, extra) {
      updateAt(P.reports + '/' + rep._id, {
        status: 'resolved', resolution: action, resolvedBy: myName(), resolvedAt: now(),
        resolutionNote: clean(extra || '', LIMIT.reason)
      }).then(function () {
        list.patch(rep._id, { status: 'resolved', resolution: action });
      })['catch'](function () { toast('Could not update that report. It is still in the open queue.', 'error'); });
    }

    function doRemove(rep) {
      var reason = window.prompt('Reason the author will see:', rep.reason || 'Clinically inaccurate');
      if (reason === null) return;
      removeContent(rep.targetType, rep.targetId, rep.targetPath, reason, rep.authorId)
        .then(function () { resolve(rep, 'removed', reason); });
    }

    function doApprove(rep) {
      resolve(rep, 'kept');
      toast('Report dismissed - content stays up.', 'success');
    }

    function doFeature(rep) {
      updateAt(rep.targetPath, { featured: true, featuredBy: myName() }).then(function () {
        if (rep.authorId) {
          bumpCounter(P.stats + '/' + rep.authorId + '/featured', 1);
          notify(rep.authorId, { type: 'featured', text: 'An instructor featured your ' + rep.targetType + '.',
                                 targetType: rep.targetType, targetId: rep.targetId });
        }
        resolve(rep, 'featured');
        toast('Marked as an instructor pick.', 'success');
      })['catch'](function () { toast('Could not mark that as an instructor pick. Nothing changed.', 'error'); });
    }

    function doBan(rep) {
      if (!rep.authorId) return;
      if (!isSuperAdmin() && !isAdmin()) return;
      var reason = window.prompt('Ban ' + clean(rep.authorName, LIMIT.name) + ' from posting. Reason:', 'Repeated unsafe content');
      if (reason === null) return;
      writeAt(P.banned + '/' + rep.authorId, {
        username: clean(rep.authorName, LIMIT.name),
        reason: clean(reason, LIMIT.reason),
        bannedBy: myName(),
        bannedAt: now()
      }).then(function () {
        pushAt(P.modLog, { action: 'ban', targetType: 'user', targetId: rep.authorId,
          reason: clean(reason, LIMIT.reason), moderator: myName(), moderatorId: myId(), createdAt: now() });
        notify(rep.authorId, { type: 'banned', text: 'Your posting access was suspended. Reason: ' + clean(reason, LIMIT.reason),
                               targetType: 'account', targetId: '' });
        resolve(rep, 'banned', reason);
        toast('Author banned from posting. They can still read the community.', 'success');
      })['catch'](function () { toast('Ban failed - check your admin permissions.', 'error'); });
    }

    function openEdit(rep) {
      setEditing(rep);
      fetchOnce(rep.targetPath).then(function (v) {
        if (!v) { setEditText(''); return; }
        setEditText(clean(v.text || v.title || v.name || '', LIMIT.qtext));
      })['catch'](function () { setEditText(''); });
    }

    function saveEdit() {
      if (!editing) return;
      var field = (editing.targetType === 'scenario' || editing.targetType === 'thread') ? 'title'
                : (editing.targetType === 'deck' ? 'name' : 'text');
      var patch = {};
      patch[field] = clean(editText, LIMIT.qtext);
      patch.editedBy = myName();
      patch.editedAt = now();
      updateAt(editing.targetPath, patch).then(function () {
        pushAt(P.modLog, { action: 'edit', targetType: editing.targetType, targetId: editing.targetId,
          targetPath: editing.targetPath, moderator: myName(), moderatorId: myId(), createdAt: now() });
        if (editing.authorId) {
          notify(editing.authorId, { type: 'edited', text: 'A moderator edited your ' + editing.targetType + ' for accuracy.',
                                     targetType: editing.targetType, targetId: editing.targetId });
        }
        resolve(editing, 'edited');
        setEditing(null);
        toast('Edited and the author was notified.', 'success');
      })['catch'](function () { toast('Could not save that edit. The original is unchanged.', 'error'); });
    }

    var rows = list.items.filter(function (r) {
      if (filter === 'open') return r.status !== 'resolved';
      if (filter === 'resolved') return r.status === 'resolved';
      return true;
    });
    var openCount = list.items.filter(function (r) { return r.status !== 'resolved'; }).length;

    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-head' },
        ce('div', { style: { flex: '1 1 200px' } },
          ce('h2', null, 'Moderation queue'),
          ce('p', { className: 'cm-sub' }, 'Every removal records a reason the author can see.'))),

      ce(Segmented, {
        label: 'Show', ariaLabel: 'Filter reports', value: filter,
        options: [
          { id: 'open', label: openCount ? ('Open (' + openCount + ')') : 'Open' },
          { id: 'resolved', label: 'Resolved' },
          { id: 'all', label: 'All' }
        ],
        onChange: setFilter
      }),

      list.error ? ce(ErrorBox, { error: list.error, onRetry: list.reload }) : null,
      list.loading && !rows.length ? ce(Spinner, { label: 'Loading reports...' }) : null,

      !list.loading && !rows.length && !list.error
        ? ce(Empty, {
            icon: '✓', title: filter === 'open' ? 'Nothing in the queue' : 'Nothing here',
            text: filter === 'open'
              ? 'No open reports. When a student flags something as inaccurate it lands here with their note attached.'
              : 'No reports match this filter.'
          })
        : ce('div', { className: 'cm-list' },
            rows.map(function (r) {
              return ce('div', { key: r._id, className: 'cm-item', style: { display: 'block' } },
                ce('div', { className: 'cm-chip-row', style: { marginBottom: 8 } },
                  ce(Chip, { tone: r.status === 'resolved' ? 'easy' : 'hard' },
                    r.status === 'resolved' ? ('Resolved: ' + clean(r.resolution, 40)) : 'Open'),
                  ce(Chip, null, r.targetType),
                  ce(Chip, { tone: 'medium' }, clean(r.reason, LIMIT.reason))),
                ce('p', { className: 'cm-item-text' }, clean(r.preview, 240)),
                r.note ? ce('div', { className: 'cm-banner', style: { marginTop: 10, marginBottom: 0 } },
                  ce('span', { className: 'cm-banner-ico', 'aria-hidden': 'true' }, '“'),
                  ce('div', null, ce(RichText, { text: r.note, max: LIMIT.note }))) : null,
                ce('div', { className: 'cm-item-foot' },
                  ce('span', null, 'author: ' + clean(r.authorName, LIMIT.name)),
                  ce('span', null, 'reported by ' + clean(r.reporterName, LIMIT.name)),
                  ce('span', null, timeAgo(r.createdAt))),
                r.status !== 'resolved' ? ce('div', { className: 'cm-actions', style: { marginTop: 10 } },
                  ce('button', { className: 'btn btn-outline btn-sm', onClick: function () { doApprove(r); } }, 'Keep - dismiss'),
                  ce('button', { className: 'btn btn-outline btn-sm', onClick: function () { openEdit(r); } }, 'Edit'),
                  ce('button', { className: 'btn btn-outline btn-sm', onClick: function () { doFeature(r); } }, '★ Instructor pick'),
                  ce('button', { className: 'btn btn-danger btn-sm', onClick: function () { doRemove(r); } }, 'Remove'),
                  isSuperAdmin() ? ce('button', { className: 'btn btn-danger btn-sm', onClick: function () { doBan(r); } }, 'Ban author') : null
                ) : null);
            })),

      ce(LoadMore, { more: list.more, loading: list.loading, onClick: list.loadMore, label: 'Load older reports' }),

      editing ? ce(Modal, { title: 'Edit content', onClose: function () { setEditing(null); } },
        ce('p', { className: 'cm-sub', style: { marginBottom: 12 } },
          'Fix the wording or the clinical error. The author is notified that a moderator edited it.'),
        ce('textarea', { className: 'cm-textarea', value: editText, maxLength: LIMIT.qtext,
          style: { minHeight: 140 }, 'aria-label': 'Edited content',
          onChange: function (e) { setEditText(e.target.value); } }),
        ce('div', { className: 'cm-actions end', style: { marginTop: 12 } },
          ce('button', { className: 'btn btn-outline', onClick: function () { setEditing(null); } }, 'Cancel'),
          ce('button', { className: 'btn btn-primary', onClick: saveEdit }, 'Save edit'))) : null
    );
  }

  /* =========================================================================
   * 8. ACTIVITY & NOTIFICATIONS
   * ====================================================================== */

  var ACTIVITY_ICON = {
    question: '◇', scenario: '⚕', comment: '💬', thread: '💬', deck: '⌸',
    group: '◈', 'group-join': '◈', badge: '★', practice: '✎', fork: '⑂'
  };

  function CommunityActivityFeed(props) {
    var gate = useCommunityGate();
    var list = usePaged({ path: P.activity, orderBy: 'createdAt',
      pageSize: props.pageSize || 15, enabled: gate.hasDb });

    if (!gate.hasDb) return ce(OfflineWall, null);

    var isEmpty = !list.loading && !list.items.length && !list.error;

    return ce('div', { className: 'cm-wrap' },
      /* The header used to promise "everything your cohort has added lately"
         directly above "Nothing has happened here yet". It is also nested under
         the page <h2>, so it is an <h3>. (DR05 Fix 3) */
      (props.hideHeader || isEmpty) ? null : ce('div', { className: 'cm-head' },
        ce('div', null,
          ce('h3', { className: 'cm-item-title', style: { fontSize: 'var(--fs-lg, 19px)' } }, 'What is happening'),
          ce('p', { className: 'cm-sub' }, 'Everything your cohort has added lately.'))),

      list.error ? ce(ErrorBox, { error: list.error, onRetry: list.reload }) : null,
      list.loading && !list.items.length ? ce(Spinner, { label: 'Loading activity...' }) : null,

      !list.loading && !list.items.length && !list.error
        ? ce(Empty, {
            icon: '◎', title: 'Nothing has happened here yet',
            text: 'This feed fills up the moment somebody posts. Right now that somebody could be you.',
            actions: props.onStart ? ce('button', { className: 'btn btn-primary', onClick: props.onStart }, 'Post the first question') : null
          })
        : ce('div', { className: 'cm-list' },
            list.items.map(function (a) {
              return ce('div', { key: a._id, className: 'cm-item', style: { padding: 12, gap: 10 } },
                ce('span', { className: 'cm-avatar', 'aria-hidden': 'true' }, ACTIVITY_ICON[a.type] || '•'),
                ce('div', { className: 'cm-item-main' },
                  ce('p', { className: 'cm-item-text', style: { fontSize: '0.9rem' } }, clean(a.text, 200)),
                  ce('div', { className: 'cm-item-foot' }, ce('span', null, timeAgo(a.createdAt)))));
            })),

      ce(LoadMore, { more: list.more, loading: list.loading, onClick: list.loadMore, label: 'Load older activity' })
    );
  }

  var NOTIF_ICON = { reply: '↩', mention: '@', best: '✓', featured: '★', removed: '⊘',
                     edited: '✎', badge: '★', fork: '⑂', banned: '⊘' };

  function CommunityNotifications(props) {
    var uid = myId();
    var s0 = useState(false); var open = s0[0], setOpen = s0[1];
    var s1 = useState([]);    var items = s1[0], setItems = s1[1];
    var s2 = useState(false); var loading = s2[0], setLoading = s2[1];
    var wrapRef = useRef(null);

    useEffect(function () {
      if (!uid || !getDb()) return;
      var r = ref(P.notifs + '/' + uid);
      if (!r) return;
      var q = r.orderByChild('createdAt').limitToLast(20);
      function handler(snap) {
        var arr = snapToArray(snap);
        arr.reverse();
        setItems(arr);
        setLoading(false);
      }
      setLoading(true);
      q.on('value', handler, function () { setLoading(false); });
      return function () { q.off('value', handler); };
    }, [uid]);

    useEffect(function () {
      function onDoc(e) {
        if (!open) return;
        if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
      }
      document.addEventListener('mousedown', onDoc);
      return function () { document.removeEventListener('mousedown', onDoc); };
    }, [open]);

    var unread = items.filter(function (n) { return !n.read; }).length;

    function markRead(n) {
      if (n.read) return;
      setItems(function (cur) {
        return cur.map(function (x) { return x._id === n._id ? merge(x, { read: true }) : x; });
      });
      updateAt(P.notifs + '/' + uid + '/' + n._id, { read: true })['catch'](function () { /* refreshes from live listener */ });
    }

    function markAll() {
      var updates = {};
      items.forEach(function (n) { if (!n.read) updates[n._id + '/read'] = true; });
      if (!Object.keys(updates).length) return;
      setItems(function (cur) { return cur.map(function (x) { return merge(x, { read: true }); }); });
      updateAt(P.notifs + '/' + uid, updates)['catch'](function () { toast('Could not mark those as read. Try again in a moment.', 'error'); });
    }

    if (!uid || !getDb()) return null;

    return ce('div', { className: 'cm-bellwrap', ref: wrapRef },
      ce('button', {
        className: 'cm-bell', onClick: function () { setOpen(!open); },
        'aria-expanded': open ? 'true' : 'false',
        'aria-label': unread ? (unread + ' unread notifications') : 'Notifications, none unread'
      },
        ce('span', { 'aria-hidden': 'true' }, '🔔'),
        ce('span', null, 'Alerts'),
        // A muted 0 so "nothing new" is legible without opening the popover.
        unread ? ce('span', { className: 'cm-dot' }, String(unread))
               : ce('span', { className: 'cm-zero', 'aria-hidden': 'true' }, '0')),

      open ? ce('div', { className: 'cm-pop' },
        ce('div', { className: 'cm-actions', style: { padding: '4px 6px 8px' } },
          ce('strong', { style: { fontSize: '0.85rem' } }, 'Notifications'),
          ce('span', { className: 'cm-spacer' }),
          unread ? ce('button', { className: 'cm-linkbtn', onClick: markAll }, 'Mark all read') : null),
        loading ? ce(Spinner, null) : null,
        !loading && !items.length
          ? ce('p', { className: 'cm-mini', style: { padding: '10px 8px' } },
              'Nothing yet. Replies to your posts and @mentions land here.')
          : items.map(function (n) {
              return ce('button', {
                key: n._id, className: 'cm-notif' + (n.read ? '' : ' unread'),
                onClick: function () { markRead(n); if (props.onOpen) props.onOpen(n); }
              },
                ce('span', { className: 'cm-notif-ico', 'aria-hidden': 'true' }, NOTIF_ICON[n.type] || '•'),
                ce('span', null,
                  ce('span', null, clean(n.text, 220)),
                  ce('span', { className: 'cm-mini', style: { display: 'block', marginTop: 2 } }, timeAgo(n.createdAt)),
                  n.read ? null : ce('span', { className: 'cm-sr' }, ' (unread)')));
            })
      ) : null
    );
  }

  /* =========================================================================
   * COMMUNITY HUB
   * ====================================================================== */

  var TABS = [
    { id: 'home',      label: 'Home' },
    { id: 'questions', label: 'Questions' },
    { id: 'scenarios', label: 'Scenarios' },
    { id: 'discuss',   label: 'Discuss' },
    { id: 'groups',    label: 'Groups' },
    { id: 'decks',     label: 'Decks' },
    { id: 'boards',    label: 'Boards' }
  ];

  /* ------------------------------------------------------------- cold start
     An empty community is five consecutive dead-end tabs. This is the one
     screen a founding cohort sees, so it leads with the payoff instead of the
     ask, names the review loop, and offers a single primary action seeded from
     a question this student personally got wrong. (DR05 Fix 2) */

  /* `QUESTIONS` is a top-level `const` in the shell, i.e. a lexical global
     rather than a property of window. Read it both ways. */
  function appQuestions() {
    try { if (window.QUESTIONS && window.QUESTIONS.length) return window.QUESTIONS; } catch (e) { /* ignore */ }
    try { if (typeof QUESTIONS !== 'undefined' && QUESTIONS) return QUESTIONS; } catch (e) { /* ignore */ }
    return [];
  }

  /** Turn one of the app's own questions into a QuestionSubmit draft.
   *  `rationale` is deliberately left empty - writing it is the point. */
  function seedFromMissed() {
    var prog = MMx().getProgress ? MMx().getProgress() : null;
    var missed = (prog && prog.missedQuestions) ? prog.missedQuestions : [];
    if (!missed.length) return null;
    var bank = appQuestions();
    if (!bank.length) return null;
    var id = missed[missed.length - 1], q = null, i;
    for (i = 0; i < bank.length; i++) if (bank[i].id === id) { q = bank[i]; break; }
    if (!q || !q.options || q.options.length < 2) return null;

    var correct = [];
    if (Object.prototype.toString.call(q.correct) === '[object Array]') {
      correct = q.correct.slice();
    } else if (typeof q.correct === 'number') {
      correct = [q.correct];
    }
    var cat = 'Med Math';
    for (i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i] === q.category) { cat = q.category; break; }
    var diff = 'Medium';
    for (i = 0; i < DIFFICULTIES.length; i++) if (DIFFICULTIES[i] === q.difficulty) { diff = q.difficulty; break; }

    return {
      text: clean(q.text, LIMIT.qtext),
      type: 'multiple-choice',
      options: q.options.slice(0, 8).map(function (o) { return clean(o, LIMIT.option); }),
      correct: correct,
      category: cat,
      difficulty: diff,
      topic: clean(q.formula || '', LIMIT.topic)
    };
  }

  function FirstRun(props) {
    var seed = props.seed;

    function step(n, title, body) {
      return ce('div', { className: 'cm-item' },
        ce('div', { className: 'cm-item-main' },
          ce('h3', { className: 'cm-item-title' }, n + ' ' + title),
          ce('p', { className: 'cm-mini' }, body)));
    }

    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-empty', style: { maxWidth: 620, margin: '0 auto 16px' } },
        ce('div', { className: 'cm-empty-ico', 'aria-hidden': 'true' }, '◎'),
        ce('div', { className: 'cm-empty-title' }, 'Your cohort has not started yet. You go first.'),
        ce('p', { className: 'cm-empty-text' },
          'This is where your cohort keeps the questions that actually showed up, the scenarios from ' +
          'lab, and the answer to the thing nobody wants to ask out loud in clinical. It is empty ' +
          'because it is new, not because it died.'),
        ce('div', { className: 'cm-empty-actions' },
          seed
            ? ce('button', { className: 'btn btn-primary', onClick: function () { props.onSeedQuestion(seed); } },
                'Post a question you got wrong')
            : ce('button', { className: 'btn btn-primary', onClick: function () { props.onGo('questions'); } },
                'Write the first question'),
          ce('button', { className: 'btn btn-outline', onClick: function () { props.onGo('decks'); } },
            'Publish a deck you already made')),
        seed ? ce('p', { className: 'cm-mini', style: { marginTop: 8 } },
          'We will start you from one you missed - you only have to write the rationale.') : null),

      ce('div', { className: 'cm-grid' },
        step('①', 'You post', 'A question, a scenario, or a deck. Live immediately, with your name on it.'),
        step('②', 'Your cohort checks it',
          'Classmates upvote what is right, comment on what is not, and flag a wrong keyed answer. ' +
          'Nothing sits in a queue waiting for approval.'),
        step('③', 'The good stuff rises',
          'Top-voted questions become the practice set. Instructors can pin the best ones.'),
        step('④', 'You get it back',
          'Somebody else writes the OB deck so you do not have to. That is the whole trade.')),

      ce('p', { className: 'cm-mini', style: { textAlign: 'center', marginTop: 14 } },
        'Writing the rationale is the part that makes it stick. That is not a slogan - it is why this ' +
        'is a question bank and not a link dump.'));
  }

  function HomePanel(props) {
    var badges = useMyBadges();
    var pres = props.presence;
    var counts = useAsync(function () {
      if (!getDb()) return null;
      var r = ref(PATH_THREADS);
      if (!r) return { help: [] };
      return r.orderByChild('helpWanted').equalTo(true).limitToLast(5).once('value').then(snapToArray)
        .then(function (rows) {
          return { help: (rows || []).filter(function (t) { return !t.resolved && !t.removed; }) };
        });
    }, [], !!getDb());
    var c = counts[0].data;
    var help = (c && c.help) ? c.help : [];

    // Nothing anywhere and nobody asking for help: this is a founding cohort.
    var bare = pres && !pres.questions && !pres.scenarios && !pres.discuss &&
               !pres.decks && !pres.groups && !help.length;

    if (bare) {
      return ce(FirstRun, {
        seed: seedFromMissed(),
        onGo: props.onGo,
        onSeedQuestion: props.onSeedQuestion
      });
    }

    return ce('div', { className: 'cm-wrap' },
      ce(Banner, { icon: '◎' },
        ce('div', null,
          ce('b', null, 'Write the rationale once and you stop forgetting it. '),
          'Post the question you got wrong, publish the scenario from lab, answer one classmate - ' +
          'and somebody else writes the OB deck so you do not have to. Everything you contribute ' +
          'has your name on it.')),

      badges.length ? ce('div', { className: 'card' },
        ce('h3', null, 'Your badges'),
        ce('div', { className: 'cm-badge-row' },
          badges.map(function (id) { return ce(CommunityBadge, { key: id, id: id }); }))) : null,

      help.length ? ce('div', { className: 'card' },
        ce('h3', null, '⛑ Classmates stuck right now'),
        ce('div', { className: 'cm-list' },
          help.slice(0, 3).map(function (t) {
            return ce('div', { key: t._id, className: 'cm-item', style: { padding: 12 } },
              ce('div', { className: 'cm-item-main' },
                ce('h4', { className: 'cm-item-title', style: { fontSize: '0.95rem' } }, clean(t.title, LIMIT.title)),
                ce('div', { className: 'cm-item-foot' },
                  ce(AuthorChip, { uid: t.authorId, name: t.authorName }),
                  ce('span', null, timeAgo(t.createdAt)))),
              ce('button', { className: 'btn btn-outline btn-sm', onClick: function () { props.onGo('discuss'); } }, 'Answer'));
          }))) : null,

      ce('div', { className: 'cm-grid', style: { marginBottom: 16 } },
        ce('button', { className: 'cm-item cm-clickable', style: { display: 'block', textAlign: 'left' },
          onClick: function () { props.onGo('questions'); } },
          ce('h3', { className: 'cm-item-title' }, '◇ Question bank'),
          ce('p', { className: 'cm-mini' }, (!pres || pres.questions) ? 'Browse, practice, or add one.' : 'Empty - write the first question.')),
        ce('button', { className: 'cm-item cm-clickable', style: { display: 'block', textAlign: 'left' },
          onClick: function () { props.onGo('scenarios'); } },
          ce('h3', { className: 'cm-item-title' }, '⚕ Scenario workshop'),
          ce('p', { className: 'cm-mini' }, (!pres || pres.scenarios) ? 'Run a classmate\'s scenario or build one.' : 'Empty - build the first scenario.')),
        ce('button', { className: 'cm-item cm-clickable', style: { display: 'block', textAlign: 'left' },
          onClick: function () { props.onGo('discuss'); } },
          ce('h3', { className: 'cm-item-title' }, '💬 Discussion'),
          ce('p', { className: 'cm-mini' }, (!pres || pres.discuss) ? 'Ask what you are stuck on.' : 'Empty - ask the thing you cannot ask in clinical.')),
        ce('button', { className: 'cm-item cm-clickable', style: { display: 'block', textAlign: 'left' },
          onClick: function () { props.onGo('groups'); } },
          ce('h3', { className: 'cm-item-title' }, '◈ Study groups'),
          ce('p', { className: 'cm-mini' }, (!pres || pres.groups) ? 'One shared goal, visible progress.' : 'Empty - three or four people, one deadline.'))),

      ce(CommunityActivityFeed, { pageSize: 10, onStart: function () { props.onGo('questions'); } })
    );
  }

  function CommunityHub(props) {
    var s0 = useState((props && props.tab) || 'home');
    var tab = s0[0], setTab = s0[1];
    var s1 = useState(null); var seed = s1[0], setSeed = s1[1];
    var gate = useCommunityGate();
    var hasDb = !!getDb();

    useEffect(function () {
      if (!getDb() || !myId()) return;
      ensureProfile();
      syncMyStats();
      // Make the shared activity recorder available to the rest of the app.
      if (window.MM && typeof window.MM.recordActivity !== 'function') {
        window.MM.recordActivity = recordActivity;
      }
    }, [myId(), !!getDb()]);

    /* Five bounded one-row reads, once, on mount. Without this a student taps
       through five consecutive empty tabs before learning the place is new.
       (DR05 Fix 1) */
    var presState = useAsync(function () {
      if (!getDb()) return null;
      return Promise.all([
        fetchPage(P.questions, 'createdAt', 1, null),
        fetchPage(P.scenarios, 'createdAt', 1, null),
        fetchPage(PATH_THREADS, 'createdAt', 1, null),
        fetchPage(P.decks, 'createdAt', 1, null),
        fetchPage(P.groups, 'createdAt', 1, null)
      ]).then(function (r) {
        return {
          questions: !!r[0].length, scenarios: !!r[1].length, discuss: !!r[2].length,
          decks: !!r[3].length, groups: !!r[4].length
        };
      });
    }, [hasDb, myId()], hasDb)[0];
    var pres = presState.data;

    var tabs = TABS.slice();
    if (isAdmin()) tabs.push({ id: 'moderation', label: 'Moderation' });

    /* Three different situations that used to share one headline: the database
       is unreachable, nobody is signed in, and everything is fine but empty.
       (DR09 MAJOR #6) */
    if (!hasDb) {
      return ce('div', { className: 'cm-wrap' },
        ce('div', { className: 'cm-head' }, ce('div', null, ce('h2', null, 'Community'))),
        ce(OfflineWall, null));
    }
    if (!gate.signedIn) {
      return ce('div', { className: 'cm-wrap' },
        ce('div', { className: 'cm-head' }, ce('div', null, ce('h2', null, 'Community'))),
        ce(SignInWall, null));
    }

    function goSeed(s) {
      setSeed(s);
      setTab('questions');
    }

    var panel = null;
    if (tab === 'home') {
      panel = ce(HomePanel, { onGo: setTab, presence: pres, onSeedQuestion: goSeed });
    } else if (tab === 'questions') {
      panel = ce(CommunityQuestionBank, { seed: seed, onSeedUsed: function () { setSeed(null); } });
    } else if (tab === 'scenarios')  panel = ce(CommunityScenarioWorkshop, null);
    else if (tab === 'discuss')    panel = ce(CommunityDiscussionBoard, null);
    else if (tab === 'groups')     panel = ce(CommunityStudyGroups, null);
    else if (tab === 'decks')      panel = ce(CommunityDecks, null);
    else if (tab === 'boards')     panel = ce(CommunityLeaderboards, null);
    else if (tab === 'moderation') panel = ce(CommunityModeration, null);

    return ce('div', { className: 'cm-wrap' },
      ce('div', { className: 'cm-head' },
        ce('div', { style: { flex: '1 1 200px' } },
          ce('h2', null, 'Community'),
          ce('p', { className: 'cm-sub' }, 'Built by your cohort, for your cohort.')),
        ce(CommunityNotifications, {
          onOpen: function (n) {
            if (n.targetType === 'question') setTab('questions');
            else if (n.targetType === 'scenario') setTab('scenarios');
            else if (n.targetType === 'thread') setTab('discuss');
            else if (n.targetType === 'group') setTab('groups');
            else if (n.targetType === 'deck') setTab('decks');
          }
        })),

      gate.banned ? ce(BannedNotice, { reason: gate.banReason }) : null,

      ce('div', { className: 'cm-tabs', role: 'tablist', 'aria-label': 'Community sections' },
        tabs.map(function (t) {
          var empty = !!(pres && pres[t.id] === false);
          return ce('button', {
            key: t.id, className: 'cm-tab' + (empty ? ' cm-tab-empty' : ''), role: 'tab',
            'aria-selected': tab === t.id ? 'true' : 'false',
            onClick: function () { setTab(t.id); }
          },
            t.label,
            empty ? ce('span', { className: 'cm-tab-count' }, '0') : null,
            empty ? ce('span', { className: 'cm-sr' }, ' (nothing here yet)') : null);
        })),

      panel
    );
  }

  /* =========================================================================
   * NON-REACT API
   * ====================================================================== */

  var CommunityAPI = {
    paths: P,
    badges: BADGES,
    computeBadges: computeBadges,
    recordActivity: recordActivity,
    notify: notify,
    toSimScenario: toSimScenario,
    runInSim: runInSim,
    /** Bounded fetch of published scenarios, already in the app's schema, so
     *  SimulationHub can list community sims next to the built-in ones. */
    getPublishedScenarios: function (limit) {
      return fetchPage(P.scenarios, 'score', limit || 20, null).then(function (rows) {
        return rows.filter(function (r) { return !r.removed; }).map(function (r) { return toSimScenario(r); });
      });
    },
    getScenario: function (id) {
      return fetchOnce(P.scenarios + '/' + id).then(function (v) {
        return v ? toSimScenario(merge(v, { _id: id })) : null;
      });
    },
    importDeck: importDeckLocally,
    syncMyStats: syncMyStats,
    bumpStat: bumpStat
  };

  /* ======================================================= EXPORTS ======= */

  window.CommunityHub = CommunityHub;
  window.CommunityQuestionBank = CommunityQuestionBank;
  window.CommunityPractice = CommunityPractice;
  window.CommunityScenarioWorkshop = CommunityScenarioWorkshop;
  window.CommunityDiscussion = CommunityDiscussion;
  window.CommunityDiscussionBoard = CommunityDiscussionBoard;
  window.CommunityStudyGroups = CommunityStudyGroups;
  window.CommunityDecks = CommunityDecks;
  window.CommunityLeaderboards = CommunityLeaderboards;
  window.CommunityModeration = CommunityModeration;
  window.CommunityActivityFeed = CommunityActivityFeed;
  window.CommunityNotifications = CommunityNotifications;
  window.CommunityBadge = CommunityBadge;
  window.CommunityAPI = CommunityAPI;

})();

