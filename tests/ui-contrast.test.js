/* ============================================================================
   ui-contrast.test.js
   ----------------------------------------------------------------------------
   Guards the class of CSS bug that produced unreadable dark-on-dark cards in
   the simulation action list.

   The trap: a <button> does NOT inherit `color` or `font` from its parent.
   The UA paints it with `buttontext`, which is near-black. So any control that
   sets a dark background and forgets `color` renders black text on a navy card
   - valid CSS, no error anywhere, and completely unreadable. A sweep found the
   same latent trap on ~40 control classes across every module.

   The fix is a global normalize in the shell (`button,input,select,textarea
   { color: inherit }`). These tests assert that net exists and stays, plus the
   specific layout fixes that shipped alongside it.

   Run:  node tests/run.js ui-contrast
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./_harness.js');

function read(rel) { return fs.readFileSync(path.join(H.APP_ROOT, rel), 'utf8'); }

/* Only real shipped modules. The working folder can accumulate orphaned
   `.fuse_hidden*` files - stale copies the mount would not let us delete -
   and readdir returns them FIRST (dotfiles sort early). Reading one means
   linting a ghost copy of a module instead of the real one, which is exactly
   what happened the first time this suite ran. `cp js/*.js` never deploys
   them, so they are a test hazard only. */
function moduleFiles() {
  return ['MedMathTutor.html'].concat(
    fs.readdirSync(path.join(H.APP_ROOT, 'js'))
      .filter(function (f) { return /\.js$/.test(f) && f.charAt(0) !== '.'; })
      .map(function (f) { return 'js/' + f; })
  );
}

/** All CSS rule bodies whose selector mentions `.cls`, across every source. */
function rulesFor(cls) {
  var files = moduleFiles();
  var out = [];
  files.forEach(function (rel) {
    var src = read(rel);
    var re = /(\.[-a-zA-Z0-9_]+(?:[^{'"]*)?)\{([^}]*)\}/g, m;
    while ((m = re.exec(src))) {
      var sel = m[1], body = m[2];
      if (new RegExp('\\.' + cls.replace(/[-]/g, '\\-') + '(?![-a-zA-Z0-9_])').test(sel)) {
        out.push({ file: rel, sel: sel.trim(), body: body });
      }
    }
  });
  return out;
}

/** The base rule (selector is exactly `.cls`), if there is one. */
function baseRule(cls) {
  return rulesFor(cls).filter(function (r) {
    return new RegExp('^\\.' + cls.replace(/[-]/g, '\\-') + '$').test(r.sel);
  })[0] || null;
}

/* The modules build their CSS as concatenated JS strings, so a rule body
   arrives with `',\n      '` sequences wedged between declarations. Strip
   those (and any stray quotes/newlines) before looking for a property, or a
   declaration that happens to sit right after a join is invisible to the
   matcher - which is exactly how the dock's `background` went undetected. */
function normalizeBody(body) {
  return String(body || '')
    .replace(/['"]\s*[,+]?\s*\n\s*['"]?/g, ' ')
    .replace(/['"]/g, ' ')
    .replace(/\s+/g, ' ');
}

function has(body, prop) {
  return new RegExp('(^|[;{\\s])' + prop + '\\s*:', 'i').test(normalizeBody(body));
}

/** Every class that is rendered as a <button> anywhere in the app. */
function buttonClasses() {
  var files = moduleFiles();
  var found = {};
  files.forEach(function (rel) {
    var src = read(rel);
    var pats = [
      /ce\(\s*['"]button['"][\s\S]{0,400}?className:\s*['"]([^'"]+)['"]/g,
      /createElement\(\s*['"]button['"][\s\S]{0,400}?className:\s*['"]([^'"]+)['"]/g,
      /className:\s*['"]([a-z][a-z0-9-]{2,})['"]\s*\+/g
    ];
    pats.forEach(function (re) {
      var m;
      while ((m = re.exec(src))) {
        m[1].split(/\s+/).forEach(function (c) { if (c) (found[c] = found[c] || {})[rel] = true; });
      }
    });
  });
  return Object.keys(found);
}

module.exports = {
  name: 'ui-contrast — no unreadable dark-on-dark controls',

  run: function (t) {
    var shell = read('MedMathTutor.html');

    /* ------------------------------------------------------------------ */
    t.group('the global safety net exists');

    t.match(shell, /button\s*,\s*input\s*,\s*select\s*,\s*textarea\s*\{[^}]*color\s*:\s*inherit/i,
      'the shell normalizes button/input/select/textarea to color:inherit — this is what ' +
      'stops a control that forgets `color` from rendering UA near-black on a dark card');

    t.match(shell, /button\s*,\s*input\s*,\s*select\s*,\s*textarea\s*\{[^}]*font-family\s*:\s*inherit/i,
      'the same rule normalizes font-family (controls do not inherit it either)');

    /* ------------------------------------------------------------------ */
    t.group('the simulation action list — the card that shipped unreadable');

    var act = baseRule('sim-action');
    t.ok(!!act, '.sim-action has a base rule');
    if (act) {
      t.ok(has(act.body, 'background'), '.sim-action sets a background');
      t.ok(has(act.body, 'color'),
        '.sim-action sets its own color explicitly, not just relying on the global net');
    }

    /* Title and dose ran together as "Administer Pantoprazole80 mg IV bolus"
       because both were inline spans. */
    var txt = rulesFor('txt').filter(function (r) { return /sim-action/.test(r.sel); })[0];
    var sub = rulesFor('sub').filter(function (r) { return /sim-action/.test(r.sel); })[0];
    t.ok(txt && /display\s*:\s*block/.test(normalizeBody(txt.body)),
      '.sim-action .txt is display:block so the label owns its own line');
    t.ok(sub && /display\s*:\s*block/.test(normalizeBody(sub.body)),
      '.sim-action .sub is display:block so the dose does not weld onto the label');
    t.ok(sub && has(sub.body, 'color'), '.sim-action .sub has its own muted color');

    /* ------------------------------------------------------------------ */
    t.group('patient vitals stay on screen');

    var dock = baseRule('sim-vitalsdock');
    t.ok(!!dock, 'there is a vitals dock');
    if (dock) {
      t.match(normalizeBody(dock.body), /position\s*:\s*sticky/, 'the vitals dock is sticky');
      t.match(normalizeBody(dock.body), /top\s*:/, 'the dock declares a top offset so it parks under the header');
      t.ok(has(dock.body, 'background'),
        'the dock has a background, or content would show through as it scrolls under');
    }

    var list = baseRule('sim-actions');
    t.ok(!!list, '.sim-actions has a base rule');
    if (list) {
      t.match(normalizeBody(list.body), /max-height/,
        'the action list is height-capped — 50 actions in a flat grid is what pushed ' +
        'the vitals off screen in the first place');
      t.match(normalizeBody(list.body), /overflow-y\s*:\s*auto/, 'the capped list scrolls internally');
    }

    /* A nested scroll region inside a page scroll is miserable on a phone. */
    var jsSim = read('js/sim-engine.js');
    t.match(jsSim, /max-width:900px\)\{\.sim-vitalsdock\{position:static/,
      'below 900px the dock un-sticks (it would eat a phone screen)');
    t.match(jsSim, /\.sim-actions\{max-height:none;overflow:visible/,
      'below 900px the action list is not an inner scroll region');

    /* ------------------------------------------------------------------ */
    t.group('app-wide sweep for the same trap');

    /* With the global net in place these are no longer broken, but a control
       that sets a background and no color is still a smell worth surfacing -
       and if someone ever deletes the net, this is the list that breaks. */
    var classes = buttonClasses();
    t.ok(classes.length > 20, 'found ' + classes.length + ' button classes to check');

    var risky = [];
    classes.forEach(function (c) {
      var r = baseRule(c);
      if (!r) return;
      if (has(r.body, 'background') && !has(r.body, 'color')) risky.push(c);
    });

    /* This is deliberately a REPORT, not a hard failure: many of these are
       dots, bars and progress fills that contain no text at all. The hard
       guarantee is the global net asserted above. */
    t.ok(true, risky.length
      ? risky.length + ' control classes set a background with no color and rely on the ' +
        'global net: ' + risky.slice(0, 12).join(', ') + (risky.length > 12 ? ' …' : '')
      : 'no control class relies on the global net');

    /* ------------------------------------------------------------------ */
    t.group('no control paints text on a background it cannot be read on');

    /* The one combination that is always wrong in a dark theme, whatever the
       cascade does: an explicit near-black text colour. */
    var files = moduleFiles();
    var blackText = [];
    files.forEach(function (rel) {
      var src = read(rel);
      var re = /color\s*:\s*(#0{3,6}\b|#1[0-9a-f]{2}\b|black|buttontext)/gi, m;
      while ((m = re.exec(src))) {
        /* --text-on-fill is the legitimate dark-on-light-fill token */
        var around = src.slice(Math.max(0, m.index - 60), m.index);
        if (/--text-on-fill|text-on-fill/.test(around)) continue;
        blackText.push(rel + ': ' + m[0]);
      }
    });
    t.eq(blackText.length, 0,
      'no rule hardcodes near-black text (dark theme)' +
      (blackText.length ? ' — ' + blackText.slice(0, 6).join(' | ') : ''));

    /* ------------------------------------------------------------------ */
    t.group('it still renders');

    /* Deliberately does NOT load js/voice.js. voice.js schedules a profile
       retry timer at module load; if that timer is still pending when this
       world is torn down it fires against a stale `global.window` during a
       LATER suite and corrupts it. sim-engine feature-detects the voice layer,
       so it loads fine without it, and this suite only needs its stylesheet. */
    var world = H.makeWorld({ tier: 'pro' });
    world.loadAiThenPatch();
    world.load('js/sim-engine.js');
    var w = world.window;

    t.eq(typeof w.SimulationHub, 'function', 'SimulationHub still loads after the CSS change');
    t.eq(typeof w.SimActionPanel, 'function', 'SimActionPanel still loads');

    var styleTags = w.document.querySelectorAll('style');
    t.ok(styleTags.length >= 1, 'sim-engine injected its stylesheet');
    var allCss = Array.prototype.map.call(styleTags, function (s) { return s.textContent; }).join('\n');
    t.match(allCss, /\.sim-action\{[^}]*color:/, 'the injected CSS carries the color fix');
    t.match(allCss, /\.sim-vitalsdock\{[^}]*position:sticky/, 'the injected CSS carries the dock');

    world.cleanup();
  }
};
