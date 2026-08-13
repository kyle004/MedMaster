/* ============================================================================
   voice-normalizer.test.js
   ----------------------------------------------------------------------------
   Adversarial tests for MM.voice.normalizeClinicalForTTS (js/voice.js §8b).

   This is the function that stands between the app's clinical text and
   ElevenLabs Flash v2.5, whose own number normalization is OFF. Anything it
   gets wrong is heard by a student as a wrong dose, a wrong vital or a
   screen-reader noise. The tests below are written to FIND those, not to
   confirm the happy path: several groups at the end are expected to fail
   today and each failing assertion names the defect it found.

   Run:  node tests/run.js voice-normalizer
   ========================================================================== */
'use strict';

/* Node >= 21 defines `navigator` on globalThis as an accessor, and
   _harness.js does a plain `global.navigator = w.navigator`, which throws
   "Cannot set property navigator of #<Object> which has only a getter".
   Make it a plain writable data property before the harness loads so the
   suite runs on modern Node without touching the harness. */
(function () {
  try {
    var d = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    if (d && d.writable !== true) {
      Object.defineProperty(globalThis, 'navigator',
        { value: undefined, writable: true, configurable: true });
    }
  } catch (e) { /* older Node: nothing to do */ }
})();

var H = require('./_harness.js');

/* Number words that must never be welded onto a letter. "D5W" -> "DfiveW"
   is not a pronunciation, it is a made-up word. Preceded by an uppercase
   letter and not followed by a lowercase one, so "Honestly" is not a hit. */
var GLUED = new RegExp('[A-Z](?:zero|one|two|three|four|five|six|seven|eight|nine|ten|' +
  'eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|' +
  'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?![a-z])');

module.exports = {
  name: 'voice-normalizer - clinical text to speech',

  run: function (t) {
    var world = H.makeWorld({ tier: 'pro' });
    world.loadAiThenPatch();
    world.load('js/voice.js');

    var V = world.window.MM.voice;
    var N = V.normalizeClinicalForTTS;

    /* -- local helpers ---------------------------------------------------- */
    function noDigits(input, label) {
      var out = N(input);
      return t.ok(!/[0-9]/.test(out), label + ' [' + JSON.stringify(out) + ']');
    }
    function unchanged(input, label) {
      return t.eq(N(input), input, label);
    }
    function idem(input) {
      var a = N(input), b = N(a);
      return t.eq(b, a, 'N(N(x)) === N(x) for ' + JSON.stringify(input));
    }

    /* ==================================================================== *
     * 1. VITALS
     * ==================================================================== */
    t.group('vitals');

    t.contains(N('92/58'), 'ninety two over fifty eight', 'BP 92/58 reads as "over"');
    t.contains(N('138/74'), 'one hundred thirty eight over seventy four', 'BP 138/74');
    t.contains(N('BP 138/74'), 'blood pressure', 'BP label expands');
    t.notContains(N('92/58'), 'slash', 'a BP is never read as "slash"');
    t.notContains(N('92/58'), 'ninety two five', 'the two halves of a BP stay separate');
    t.contains(N('MAP 62'), 'mean arterial pressure sixty two', 'MAP');
    t.contains(N('HR 118'), 'heart rate one hundred eighteen', 'HR');
    t.contains(N('RR 28'), 'respiratory rate twenty eight', 'RR');
    t.contains(N('Temp 101.6 F'), 'temperature', 'Temp label expands');
    t.contains(N('Temp 101.6 F'), 'one oh one point six degrees fahrenheit',
      'a nurse says "one oh one point six", not "one hundred one"');
    t.contains(N('98.6 F'), 'ninety eight point six degrees fahrenheit', 'sub-100 F is ordinary');
    t.contains(N('100 F'), 'one hundred degrees fahrenheit', '100 F is "one hundred"');
    t.contains(N('38.9 C'), 'thirty eight point nine degrees celsius', 'Celsius');
    t.notContains(N('12 F'), 'fahrenheit', 'a value outside body range is not a temperature');
    t.notContains(N('5 C'), 'celsius', 'a stray 5 C is not a temperature');
    t.contains(N('SpO2 88%'), 's p o two,', 'SpO2 is spoken as letters with a pause');
    t.contains(N('SpO2 88%'), 'eighty eight percent', 'SpO2 value + percent');
    t.contains(N('SaO2 92%'), 'arterial oxygen saturation', 'SaO2');
    t.contains(N('O2 sat 94%'), 'oxygen sat ninety four percent', 'O2 sat');
    t.contains(N('EtCO2 35'), 'end tidal', 'EtCO2');
    t.contains(N('FiO2 40%'), 'fraction of inspired oxygen forty percent', 'FiO2');
    t.contains(N('pain 7/10'), 'seven out of ten', 'pain score is "out of", not "over"');
    t.notContains(N('pain 7/10'), 'over', 'a pain score is never "over"');
    t.contains(N('10/10 pain'), 'ten out of ten', '10/10 is a pain score');
    t.contains(N('0/10 pain'), 'zero out of ten', '0/10 is a pain score');
    t.contains(N('GCS 8'), 'gcs eight', 'GCS keeps its label and speaks the value');
    t.contains(N('MAP 62 mmHg'), 'millimeters of mercury', 'mmHg');
    noDigits('BP 92/58, HR 118, RR 28, SpO2 88% on 2 L, Temp 101.6 F, pain 7/10',
      'a whole vitals line leaves no digit behind');

    /* ==================================================================== *
     * 2. DOSES
     * ==================================================================== */
    t.group('doses');

    t.contains(N('0.25 mg'), 'zero point two five milligrams', '0.25 mg');
    t.notContains(N('0.25 mg'), 'point twenty five', 'decimals are read digit by digit');
    t.contains(N('0.025 mg'), 'zero point zero two five milligrams', '0.025 mg keeps its leading zero');
    t.notContains(N('0.025 mg'), 'point two five milligram',
      '0.025 and 0.25 must not collapse to the same words');
    t.contains(N('1 mg'), 'one milligram', '1 mg is singular');
    t.notContains(N('1 mg'), 'one milligrams', 'no "one milligrams"');
    t.contains(N('1mg'), 'one milligram', '1mg with no space (real MARs write it this way)');
    t.contains(N('2mg/mL'), 'two milligrams per milliliter', '2mg/mL');
    t.contains(N('0.5mL'), 'zero point five milliliters', '0.5mL');
    t.contains(N('250mcg'), 'two hundred fifty micrograms', '250mcg');
    t.contains(N('1 g'), 'one gram', '1 g');
    t.contains(N('4.4 g'), 'four point four grams', '4.4 g');
    t.contains(N('10 units'), 'ten units', '10 units');
    t.contains(N('1 unit'), 'one unit', '1 unit is singular');
    t.contains(N('20 mEq'), 'twenty milliequivalents', 'mEq');
    t.contains(N('4-7 mEq/L'), 'milliequivalents per liter', 'mEq/L');
    t.contains(N('5 mcg/kg/min'), 'five micrograms per kilogram per minute', 'weight-based rate');
    t.contains(N('0.1 mg/kg'), 'zero point one milligrams per kilogram', 'mg/kg');
    t.contains(N('82.5 kg'), 'eighty two point five kilograms', 'kg');
    t.contains(N('1 g IVPB q8h'), 'one gram i v piggyback every eight hours', 'a whole order line');
    noDigits('Dilaudid 1mg (2mg/mL) IV push q2h PRN', 'a real MAR line leaves no digits');

    /* ==================================================================== *
     * 3. RATES AND OXYGEN DELIVERY
     * ==================================================================== */
    t.group('rates and oxygen delivery');

    t.contains(N('125 mL/hr'), 'one hundred twenty five milliliters per hour', 'mL/hr');
    t.contains(N('125 mL/h'), 'milliliters per hour', 'mL/h');
    t.contains(N('20 gtt/min'), 'twenty drops per minute', 'gtt/min');
    t.contains(N('15 L/min'), 'fifteen liters per minute', 'L/min');
    t.contains(N('2L NC'), 'two liters nasal cannula', '2L NC');
    t.contains(N('15L NRB'), 'fifteen liters non-rebreather', '15L NRB');
    t.contains(N('6 L HFNC'), 'high flow nasal cannula', 'HFNC');
    t.contains(N('on RA'), 'room air', 'RA');
    t.contains(N('BVM'), 'bag valve mask', 'BVM');
    t.contains(N('60 mL/min/1.73m2'), 'milliliters per minute per one point seven three square meters',
      'eGFR units written without a space');
    noDigits('Oxygen 2 L nasal cannula, titrate to keep SpO2 above 94%', 'an oxygen order');

    /* ==================================================================== *
     * 4. FREQUENCIES AND ROUTES
     * ==================================================================== */
    t.group('frequencies and routes');

    t.contains(N('q4h'), 'every four hours', 'q4h');
    t.contains(N('q2hrs'), 'every two hours', 'q2hrs');
    t.contains(N('Q6H'), 'every six hours', 'Q6H (uppercase)');
    t.contains(N('q30min'), 'every thirty minutes', 'q30min');
    t.contains(N('q4-6h'), 'every four to six hours', 'q4-6h range');
    t.contains(N('q day'), 'daily', 'q day');
    t.contains(N('BID'), 'twice a day', 'BID');
    t.contains(N('TID'), 'three times a day', 'TID');
    t.contains(N('QID'), 'four times a day', 'QID');
    t.contains(N('QHS'), 'at bedtime', 'QHS');
    t.contains(N('PRN'), 'as needed', 'PRN');
    t.contains(N('PO'), 'by mouth', 'PO');
    t.contains(N('IM'), 'intramuscular', 'IM');
    t.contains(N('SubQ'), 'subcutaneous', 'SubQ');
    t.contains(N('SQ'), 'subcutaneous', 'SQ');
    t.contains(N('IV push'), 'i v push', 'IV push');
    t.contains(N('IVP'), 'i v push', 'IVP');
    t.contains(N('IVPB'), 'i v piggyback', 'IVPB');
    t.contains(N('NPO'), 'nothing by mouth', 'NPO');
    t.contains(N('NG tube'), 'n g tube', 'NG is spelled, not read as a word');
    t.contains(N('STAT'), 'immediately', 'STAT');
    t.contains(N('SL nitro'), 'sublingual', 'SL');
    t.ok(/\bPEG\b/.test(N('PEG tube')), 'PEG is left as a pronounceable word');

    /* ==================================================================== *
     * 5. LABS
     * ==================================================================== */
    t.group('labs');

    t.contains(N('K+ 4.0'), 'potassium', 'K+ expands');
    t.contains(N('K+ 4.0'), 'four point zero', 'K+ value');
    t.match(N('K+ 4.0'), /potassium,/, 'a comma separates the label from the value');
    t.contains(N('Na+ 136'), 'sodium, one hundred thirty six', 'Na+');
    t.contains(N('BUN 62'), 'b u n, sixty two', 'BUN is spelled out');
    t.contains(N('WBC 12.6'), 'white blood cell count, twelve point six', 'WBC');
    t.contains(N('Hgb 7.2'), 'hemoglobin, seven point two', 'Hgb');
    t.contains(N('Hct 22'), 'hematocrit', 'Hct');
    t.contains(N('INR 1.4'), 'i n r, one point four', 'INR');
    t.contains(N('PTT 45'), 'p t t,', 'PTT before PT in the alternation');
    t.contains(N('pH 7.28'), 'seven point two eight', 'pH value');
    t.contains(N('PaO2 58'), 'partial pressure of oxygen fifty eight', 'PaO2');
    t.contains(N('PaCO2 52'), 'partial pressure of carbon dioxide fifty two', 'PaCO2');
    t.contains(N('BG 160'), 'one hundred sixty', 'BG value');
    t.contains(N('ABG'), 'arterial blood gas', 'ABG');
    t.contains(N('CBC and BMP'), 'basic metabolic panel', 'BMP');
    noDigits('Na+ 136, K+ 5.9, BUN 62, WBC 12.6, Hgb 7.2, INR 1.4', 'a whole lab line');

    /* ==================================================================== *
     * 6. OTHER NUMERICS
     * ==================================================================== */
    t.group('other numerics');

    t.contains(N('1:1000'), 'one to one thousand', 'epinephrine ratio');
    t.contains(N('1:4 dilution'), 'one to four', 'dilution ratio');
    t.contains(N('4-7 mEq/L'), 'four to seven', 'numeric range');
    t.contains(N('97.7-99.5 F'), 'ninety seven point seven to ninety nine point five degrees fahrenheit',
      'a temperature range keeps both ends and the unit');
    t.contains(N('HR 110-160'), 'one hundred ten to one hundred sixty', 'HR range');
    t.contains(N('06/26/1954'), 'june twenty sixth, nineteen fifty four', 'date of birth');
    t.contains(N('01/01/2000'), 'january first, two thousand', 'a year 2000 date');
    t.contains(N('12/31/2019'), 'december thirty first, twenty nineteen', 'late-2000s year');
    t.notContains(N('06/26/1954'), 'over', 'a date is never read as a BP');
    t.contains(N('09:45'), 'nine forty five', 'clock time');
    t.contains(N('12:00'), 'twelve o clock', 'top of the hour');
    t.contains(N('09:05'), 'nine oh five', 'single-digit minutes');
    t.contains(N('given 0800'), 'oh eight hundred', 'military time after a time word');
    t.contains(N('bolus given 0930'), 'oh nine thirty', 'military time with minutes');
    t.contains(N('x4'), 'times four', 'x4');
    t.contains(N('A&O x4'), 'alert and oriented times four', 'A&O x4');
    t.contains(N('x 3 days'), 'for three days', 'x3 days');
    t.contains(N('45%'), 'forty five percent', 'percentage');
    t.contains(N('0.9% NS'), 'zero point nine percent', 'decimal percentage');
    t.contains(N('10,000 units'), 'ten thousand units', 'thousands separator');
    t.contains(N('1,250,000'), 'one million two hundred fifty thousand', 'millions');
    t.contains(N('< 90'), 'less than ninety', 'less-than');
    t.contains(N('Hold for HR > 100'), 'greater than one hundred', 'greater-than mid-sentence');
    t.contains(N('2nd dose'), 'second dose', 'ordinal');
    t.contains(N('21st day'), 'twenty first day', 'ordinal 21st');
    t.contains(N('72-year-old'), 'seventy two', 'a hyphenated age is not a range');
    t.contains(N('C-section'), 'cesarean section', 'C-section is not a range either');

    /* ==================================================================== *
     * 7. ABBREVIATIONS THAT MUST NOT BE LETTER-SPELLED
     * ==================================================================== */
    t.group('abbreviations that must not be letter-spelled');

    t.notContains(N('SOB at rest'), 's o b', 'SOB is not spelled out');
    t.contains(N('SOB at rest'), 'sob', 'SOB survives as a token');
    t.notContains(N('HTN and DM'), 'h t n', 'HTN is not spelled out');
    t.notContains(N('HTN and DM'), 'd m ', 'DM is not spelled out');
    t.contains(N('CHF exacerbation'), 'congestive heart failure', 'CHF expands to words');
    t.notContains(N('ESRD on HD'), 'e s r d', 'ESRD is not spelled out');
    t.contains(N('COPD'), 'c o p d', 'COPD IS spelled - that is how it is said');
    t.contains(N('MI'), 'myocardial infarction', 'MI expands');
    t.contains(N('DVT'), 'd v t', 'DVT is said as letters');
    t.contains(N('PE'), 'pulmonary embolism', 'PE expands');
    t.contains(N('ICP'), 'intracranial pressure', 'ICP expands');
    t.notContains(N('DKA protocol'), 'd k a', 'DKA is not spelled out');
    t.contains(N('SBAR'), 's b a r', 'SBAR is said as letters');
    t.contains(N('ICU'), 'i c u', 'ICU');
    t.contains(N('NKDA'), 'no known drug allergies', 'NKDA');
    t.contains(N('DNR'), 'do not resuscitate', 'DNR');

    /* ==================================================================== *
     * 8. ORDINARY ENGLISH MUST BE LEFT ALONE
     * ==================================================================== */
    t.group('ordinary english is left alone');

    unchanged('programming', '"programming" is not "programgramming"');
    unchanged('smug', '"smug" does not contain milligrams');
    unchanged('incline', '"incline" is not a nasal cannula');
    unchanged('administer', '"administer" is untouched');
    unchanged('milligrams', 'already spelled out, left alone');
    unchanged('The patient is calm and cooperative.', 'a plain sentence');
    unchanged('She is resting comfortably in bed.', 'no numbers, no changes');
    unchanged('I am going to listen to your lungs now.', 'first-person speech');
    unchanged('Glucose monitoring is important', '"Glucose" is not a lab shorthand');
    unchanged('a magnesium level', 'the spelled-out word is not re-expanded');
    unchanged('half of the tablet', 'no fraction to convert');
    unchanged('flag the chart', 'no unit hiding in "flag"');
    unchanged('the management plan changed', '"management" contains no unit');
    unchanged('grams of protein', 'a bare "grams" is untouched');
    t.eq(N('No numbers appear anywhere in this sentence.'),
      'No numbers appear anywhere in this sentence.', 'digit-free text is byte-identical');

    /* ==================================================================== *
     * 9. AMBIGUITY
     * ==================================================================== */
    t.group('ambiguity');

    t.contains(N('Mg 2.0'), 'mg,', 'Mg (magnesium) keeps its capital and is NOT milligrams');
    t.notContains(N('Mg 2.0'), 'milligram', 'capital Mg never becomes milligrams');
    t.contains(N('2.0 mg'), 'milligram', 'lowercase mg IS milligrams');
    t.contains(N('1:1000'), 'one to one thousand', '1:1000 is a ratio');
    t.contains(N('1:10'), 'one ten', '1:10 is read as a clock time (documented ambiguity)');
    t.notContains(N('1:10'), 'one to ten', 'the clock rule wins over the ratio rule');
    t.contains(N('120/80'), 'one hundred twenty over eighty', '120/80 is a BP');
    t.contains(N('06/26'), 'six over twenty six',
      '06/26 with no year is read as a BP (documented ambiguity)');
    t.contains(N('06/26/1954'), 'june', 'the same date WITH a year is a date');
    t.contains(N('10/10 pain'), 'out of ten', '10/10 is a pain score');
    t.contains(N('give 1/2 tab'), 'slash', 'a bare fraction falls through to "slash" (documented)');
    t.contains(N('Take 2 tabs PO BID'), 'by mouth twice a day', 'route + frequency together');

    /* ==================================================================== *
     * 10. IDEMPOTENCY  -  N(N(x)) === N(x)
     * ==================================================================== */
    t.group('idempotency');

    [
      'BP 92/58', '0.25 mg IV push', '125 mL/hr', 'Temp 101.6 F', 'K+ 4.0',
      '1:1000', '06/26/1954', '09:45', 'given 0800', '7/10',
      '15 L/min NRB', 'q4-6h PRN', 'SpO2 88% on 2L NC', '4-7 mEq/L', 'A&O x4',
      'WBC 12.6, Hgb 7.2', '5 mcg/kg/min', '60 mL/min/1.73 m2',
      'pH 7.28, PaCO2 52, HCO3 18', 'x2 days', 'MAP 62 mmHg', '10 units subq',
      '1 g IVPB q8h', 'Na+ 136, K+ 5.9, BUN 62', 'Dilaudid 1mg (2mg/mL) IV q2hrs PRN'
    ].forEach(idem);

    /* ==================================================================== *
     * 11. DEGENERATE INPUT
     * ==================================================================== */
    t.group('degenerate input');

    t.eq(N(''), '', 'empty string');
    t.eq(N(null), '', 'null');
    t.eq(N(undefined), '', 'undefined');
    t.eq(typeof N(null), 'string', 'null still yields a string');
    t.eq(N(42), 'forty two', 'a number argument');
    t.eq(N(0.25), 'zero point two five', 'a float argument');
    t.noThrow(function () { N({ a: 1 }); }, 'an object does not throw');
    t.noThrow(function () { N([1, 2]); }, 'an array does not throw');
    t.noThrow(function () { N(true); }, 'a boolean does not throw');
    t.noThrow(function () { N(NaN); }, 'NaN does not throw');
    t.noThrow(function () { N(Infinity); }, 'Infinity does not throw');
    t.noThrow(function () { N(function () {}); }, 'a function does not throw');
    t.eq(typeof N({ a: 1 }), 'string', 'an object still yields a string');
    t.eq(N('!!!???...'), '!!!???...', 'punctuation only');
    t.eq(N('        '), '', 'whitespace only collapses to empty');
    t.noThrow(function () { N('\u{1F691}\u{1F489}'); }, 'emoji do not throw');
    t.noThrow(function () { N('µg ± 2 ° ½'); }, 'unicode symbols do not throw');
    t.contains(N('line1\nline2\ttab'), 'tab', 'embedded newlines and tabs survive');
    t.contains(N('<b>BP 92/58</b>'), 'blood pressure ninety two over fifty eight', 'HTML tags');
    t.contains(N('**BP** 92/58 `code` # Heading'), 'blood pressure ninety two over fifty eight',
      'markdown is stripped before anything else');
    t.notContains(N('**BP** 92/58'), '*', 'no markdown characters survive');

    var big = new Array(1300).join('BP 92/58, HR 118, 0.25 mg IV push q4h PRN. ');
    t.ok(big.length > 50000, 'built a ' + big.length + '-char input');
    var bigT0 = Date.now();
    var bigOut = N(big);
    var bigMs = Date.now() - bigT0;
    t.ok(typeof bigOut === 'string' && bigOut.length > 0, '50KB of text returns a string');
    t.ok(bigMs < 2000, '50KB normalizes in ' + bigMs + 'ms (no catastrophic backtracking)');
    t.ok(!/[0-9]/.test(bigOut), '50KB of text leaves no digit behind');

    /* ==================================================================== *
     * 12. OUTPUT INVARIANTS
     * ==================================================================== */
    t.group('output invariants');

    var INV = [
      'BP 92/58', '0.25 mg', '1mg', '125 mL/hr', 'q4h PRN', 'K+ 4.0', '1:1000',
      '06/26/1954', '09:45', 'SpO2 88%', '7/10', '10 units', '15 L/min', 'A&O x4',
      'Temp 101.6 F', 'x4', '4-7 mEq/L', '60 mL/min/1.73 m2', 'MAP 62', 'GCS 8'
    ];
    var invBad = { nullish: [], nonString: [], empty: [], doubleSpace: [], spacePunct: [] };
    INV.forEach(function (s) {
      var r = N(s);
      if (r === null || r === undefined) invBad.nullish.push(s);
      if (typeof r !== 'string') invBad.nonString.push(s);
      if (!r) invBad.empty.push(s);
      if (/ {2,}/.test(r)) invBad.doubleSpace.push(s + ' -> ' + r);
      if (/\s[,.;:!?]/.test(r)) invBad.spacePunct.push(s + ' -> ' + r);
    });
    t.deepEq(invBad.nullish, [], 'never returns null or undefined');
    t.deepEq(invBad.nonString, [], 'always returns a string');
    t.deepEq(invBad.empty, [], 'never returns empty for non-empty input');
    t.deepEq(invBad.doubleSpace, [], 'never produces a doubled space');
    t.deepEq(invBad.spacePunct, [], 'never produces a space before punctuation');

    /* ==================================================================== *
     * 13. CORPUS SWEEP  -  every clinical string the app actually ships
     * ==================================================================== */
    t.group('corpus sweep');

    var corpus = H.loadScenarioCorpus();
    var fields = [];
    function take(v, what) {
      if (typeof v === 'string' && v.trim()) fields.push({ what: what, s: v });
    }
    corpus.scenarios.forEach(function (s) {
      (s.dialogue || []).forEach(function (d) { take(d && d.line, 'dialogue.line'); });
      (s.medications || []).forEach(function (m) {
        if (!m) return;
        take(m.dose, 'medications.dose');
        take(m.action, 'medications.action');
        take(m.name, 'medications.name');
      });
      (s.orders || []).forEach(function (o) { take(o && o.text, 'orders.text'); });
      (s.vitalsTimeline || []).forEach(function (v) {
        if (!v) return;
        take(v.bp, 'vitals.bp');
        take(v.note, 'vitals.note');
        take(v.other, 'vitals.other');
      });
      (s.labs || []).forEach(function (l) { take(l && l.value, 'labs.value'); });
    });
    corpus.marCases.forEach(function (c) {
      (c.medications || []).forEach(function (m) {
        if (!m) return;
        ['name', 'dose', 'concentration', 'route', 'frequency', 'indication', 'holdParameters']
          .forEach(function (k) { take(m[k], 'mar.' + k); });
      });
    });

    var threw = [], digitsLeft = [], emptyOut = [], dbl = [], sp = [], glued = [];
    var chars = 0;
    var t0 = Date.now();
    fields.forEach(function (f) {
      chars += f.s.length;
      var r;
      try { r = N(f.s); } catch (e) { threw.push(f.what + ': ' + e.message); return; }
      if (typeof r !== 'string') { threw.push(f.what + ': non-string output'); return; }
      if (/[0-9]/.test(r)) digitsLeft.push(f.s + ' -> ' + r);
      if (!r) emptyOut.push(f.s);
      if (/ {2,}/.test(r)) dbl.push(r);
      if (/\s[,.;:!?]/.test(r)) sp.push(r);
      if (GLUED.test(r)) glued.push(f.s.slice(0, 70) + '  ->  ' + (r.match(new RegExp(GLUED.source, 'g')) || []).join(', '));
    });
    var sweepMs = Date.now() - t0;

    t.ok(fields.length > 1000, 'corpus: ' + fields.length + ' strings / ' + chars + ' chars from ' +
      corpus.scenarios.length + ' scenarios + ' + corpus.marCases.length + ' MAR cases');
    t.deepEq(threw, [], 'corpus: zero throws');
    t.eq(digitsLeft.length, 0, 'corpus: zero surviving digits' +
      (digitsLeft.length ? ' (' + digitsLeft.slice(0, 3).join(' | ') + ')' : ''));
    t.eq(emptyOut.length, 0, 'corpus: zero empty outputs');
    t.eq(dbl.length, 0, 'corpus: zero doubled spaces');
    t.eq(sp.length, 0, 'corpus: zero spaces before punctuation');

    console.log('        corpus: ' + fields.length + ' strings, ' + chars + ' chars, ' +
      sweepMs + 'ms total, ' + (sweepMs / fields.length).toFixed(4) + ' ms/string avg');

    /* ==================================================================== *
     * 14. PERFORMANCE
     * ==================================================================== */
    t.group('performance');

    var reps = 5, p0 = Date.now();
    for (var r0 = 0; r0 < reps; r0++) {
      for (var i0 = 0; i0 < fields.length; i0++) N(fields[i0].s);
    }
    var perMs = (Date.now() - p0) / (reps * fields.length);
    t.ok(perMs < 1, 'average ' + perMs.toFixed(4) + ' ms/string over ' +
      (reps * fields.length) + ' normalizations (budget 1ms)');
    console.log('        perf: ' + perMs.toFixed(4) + ' ms/string average');

    /* ==================================================================== *
     * 15. DEFECT: digits welded into alphanumeric clinical tokens
     * ----------------------------------------------------------------------
     * numeralsToWords() (js/voice.js:1421) replaces every digit run anywhere
     * in the string, including inside a token that is half letters. There is
     * no word boundary requirement and no separator inserted, so D5W becomes
     * "DfiveW" and S1/S2 becomes "Sone slash Stwo". These are not words; the
     * model reads them as garbage. All of the tokens below are in the shipped
     * corpus.
     * ==================================================================== */
    t.group('DEFECT: digits welded into alphanumeric tokens');

    t.notContains(N('HCO3 18'), 'hcothree', 'HCO3 must not become "HCOthree"');
    t.contains(N('HCO3 18'), 'eighteen', 'HCO3 value still speaks');
    t.notContains(N('D5W'), 'dfivew', 'D5W must not become "DfiveW"');
    t.notContains(N('250 mL D5W'), 'dfivew', 'D5W inside a real order line');
    t.notContains(N('S1/S2 present'), 'sone', 'heart sound S1 must not become "Sone"');
    t.notContains(N('S3 gallop'), 'sthree', 'heart sound S3 must not become "Sthree"');
    t.notContains(N('A1C 9.2'), 'aonec', 'A1C must not become "AoneC"');
    t.notContains(N('HbA1c 9.2'), 'hbaonec', 'HbA1c must not become "HbAonec"');
    t.notContains(N('G2P1'), 'gtwopone', 'OB gravida/para G2P1 must not become "GtwoPone"');
    t.notContains(N('B12 deficiency'), 'btwelve', 'B12 must not become "Btwelve"');
    t.notContains(N('T2DM'), 'ttwodm', 'T2DM must not become "TtwoDM"');
    t.notContains(N('D10W'), 'dten', 'D10W must not become "DtenW"');
    t.eq(glued.length, 0, 'corpus: ' + glued.length + ' shipped strings speak a welded token' +
      (glued.length ? '\n          ' + glued.slice(0, 6).join('\n          ') : ''));

    /* ==================================================================== *
     * 16. DEFECT: units and lab labels the table does not cover
     * ==================================================================== */
    t.group('DEFECT: uncovered units and labels');

    t.contains(N('2 mmol'), 'millimole', 'mmol must be spoken as millimoles');
    t.contains(N('2 mmol/L'), 'millimoles per liter', 'mmol/L must be spoken');
    t.notContains(N('2 mmol/L'), 'slash', 'mmol/L must not be read as "mmol slash L"');
    t.contains(N('250 µg'), 'microgram', 'the micro sign µg must be spoken as micrograms');
    t.contains(N('Cr 6.4'), 'creatinine', 'Cr must be spoken as creatinine, not the token "Cr"');
    t.contains(N('1.73m2'), 'square meters', 'body surface area with no space before m2');
    t.notContains(N('1.73m2'), 'threemtwo', '1.73m2 must not become "one point seven threemtwo"');
    t.ok(!/[0-9]/.test(N('1234567890')),
      'a ten-digit number (MRN, phone) must not survive as digits [' + N('1234567890') + ']');
    t.contains(N('q1h'), 'every hour', 'q1h should be "every hour", not "every one hours"');

    /* ==================================================================== *
     * 17. DEFECT: a leading ">" is eaten as a markdown blockquote
     * ----------------------------------------------------------------------
     * stripMarkdown (js/voice.js:626) removes /^\s{0,3}>\s?/gm BEFORE the
     * comparison rule in CLINICAL_PRE can see it. Any hold parameter or goal
     * that starts a line with ">" silently loses its direction: "> 92%" is
     * spoken as "ninety two percent", which is the opposite instruction to
     * the one the order gives.
     * ==================================================================== */
    t.group('DEFECT: leading ">" is stripped as markdown');

    t.contains(N('> 95%'), 'greater than', 'a line starting with "> 95%" keeps "greater than"');
    t.contains(N('>95%'), 'greater than', 'no space after the ">" either');
    t.contains(N('   > 100'), 'greater than', 'up to 3 leading spaces still counts as a line start');
    t.contains(N('Hold parameters:\n> 100 mL/hr'), 'greater than',
      'a ">" after a newline is a comparison, not a blockquote');
    t.contains(N('>= 95'), 'greater than or equal to', '">= 95" at line start');
    t.notContains(N('>= 95'), '=', 'a bare "=" must never reach the model');

    /* ==================================================================== *
     * 18. DEFECT: the eGFR compound unit is unreachable when written with a
     *     space. CLINICAL_PRE's m2 rule (js/voice.js:1405) rewrites
     *     "1.73 m2" to "1.73 square meters" before expandUnits() runs, so the
     *     FIRST entry of TTS_UNITS (js/voice.js:1267) - the one whose comment
     *     says compounds must come first - can never match, and the "/" is
     *     read out as "slash".
     * ==================================================================== */
    t.group('DEFECT: eGFR compound unit written with a space');

    t.contains(N('60 mL/min/1.73 m2'), 'per one point seven three square meters',
      'eGFR with a space before m2');
    t.notContains(N('GFR 18 mL/min/1.73 m2'), 'slash', 'eGFR must not contain "slash"');

    return H.tick(10).then(function () { world.cleanup(); });
  }
};
