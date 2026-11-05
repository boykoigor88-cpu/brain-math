/* Брейн Эволюция — локальный движок анализа математических навыков.
   Работает без сети и ИИ; не меняет генерацию заданий соревновательных режимов. */
(function (root, factory) {
  const BrainAdaptive = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = BrainAdaptive;
  if (root) root.BrainAdaptive = BrainAdaptive;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const VERSION = 1;
  const STORAGE_KEY = 'brainmath_skill_history_v1';
  const SKILLS = Object.freeze({
    add_carry: { name: 'Сложение через десяток', symbol: '+', tip: 'Разбей второе слагаемое: сначала дополни первое число до ближайшего десятка, затем прибавь остаток.' },
    round_pair: { name: 'Дополнение до круглого числа', symbol: '+', tip: 'Ищи пару единиц, дающую 10: например, 53 + 47 = (50 + 40) + (3 + 7) = 100.' },
    near_round_add: { name: 'Сложение через округление', symbol: '+', tip: 'Если число оканчивается на 8 или 9, округли его до десятка, а затем вычти добавленную единицу или двойку.' },
    near_double: { name: 'Удвоение и соседние числа', symbol: '+', tip: 'Для 19 + 19 удобно вычислить 20 + 20 − 2 = 38. Для соседних чисел опирайся на удвоение.' },
    sub_borrow: { name: 'Вычитание через десяток', symbol: '−', tip: 'Для 41 − 37 посчитай расстояние: от 37 до 40 — 3, от 40 до 41 — 1; всего 4.' },
    sub_tens: { name: 'Вычитание круглых десятков', symbol: '−', tip: 'В 91 − 40 меняются только десятки: 9 десятков − 4 десятка = 5 десятков, единица остаётся. Ответ 51.' },
    sub_near_round: { name: 'Вычитание через округление', symbol: '−', tip: 'Вычитая 29, сначала вычти 30, потом верни 1. Например, 76 − 29 = 76 − 30 + 1.' },
    multiplication: { name: 'Связи таблицы умножения', symbol: '×', tip: 'Используй знакомое произведение и прибавь или убери одну группу: 7 × 8 = 7 × (10 − 2).' },
    mul_eleven: { name: 'Умножение на 11', symbol: '×', tip: 'Умножение на 11 — это ×10 плюс ещё одно число: 12 × 11 = 120 + 12 = 132.' },
    mul_nine: { name: 'Умножение на 9', symbol: '×', tip: 'Умножь на 10 и вычти исходное число: 8 × 9 = 80 − 8 = 72.' },
    division: { name: 'Деление через умножение', symbol: '÷', tip: 'Проверяй деление обратным умножением: 24 ÷ 4 = 6, потому что 4 × 6 = 24.' }
  });
  const DIFFS = ['easy', 'medium', 'hard'];
  const SYMBOLS = { add: '+', sub: '−', mul: '×', div: '÷' };
  const median = values => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const opOf = symbol => ({ '+': 'add', '−': 'sub', '×': 'mul', '÷': 'div' })[symbol] || null;
  const keyOf = p => {
    let a = p.n1, b = p.n2;
    if (p.symbol === '+' || p.symbol === '×') [a, b] = [Math.min(a, b), Math.max(a, b)];
    return `${a}_${p.symbol}_${b}`;
  };
  function classify(p) {
    const { n1: a, n2: b, symbol: s } = p;
    if (!Number.isInteger(a) || !Number.isInteger(b)) return [];
    const tags = [];
    if (s === '+') {
      if (a % 10 + b % 10 >= 10) tags.push('add_carry');
      if ((a + b) % 10 === 0 && a % 10 !== 0 && b % 10 !== 0) tags.push('round_pair');
      if (a % 10 >= 8 || b % 10 >= 8) tags.push('near_round_add');
      if (Math.abs(a - b) <= 1) tags.push('near_double');
    } else if (s === '−') {
      if (a % 10 < b % 10) tags.push('sub_borrow');
      if (b >= 10 && b % 10 === 0) tags.push('sub_tens');
      if (b % 10 >= 8 && b % 10 !== 0) tags.push('sub_near_round');
    } else if (s === '×') {
      tags.push('multiplication');
      if (a === 11 || b === 11) tags.push('mul_eleven');
      if (a === 9 || b === 9) tags.push('mul_nine');
    } else if (s === '÷') {
      tags.push('division');
    }
    return tags;
  }

  class BrainAdaptive {
    constructor(storage) {
      this.storage = storage || null;
      this.rows = this.load();
    }
    load() {
      try {
        const data = JSON.parse(this.storage && this.storage.getItem(STORAGE_KEY));
        if (data && data.version === VERSION && Array.isArray(data.rows)) {
          return data.rows.filter(r => r && DIFFS.includes(r.diff) && SKILLS).slice(-900);
        }
      } catch (_) {}
      return [];
    }
    save() {
      try { if (this.storage) this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, rows: this.rows })); } catch (_) {}
    }
    observe(problem, correct, timeMs, diff, sessionId) {
      if (!DIFFS.includes(diff) || !opOf(problem.symbol) || !Number.isFinite(timeMs)) return;
      // Retain failures regardless of time; do not treat a pause as cognitive slowness.
      this.rows.push({
        diff, op: opOf(problem.symbol), tags: classify(problem),
        key: keyOf(problem), correct: !!correct,
        timeMs: Math.max(0, Math.round(timeMs)),
        session: String(sessionId || 'unknown'), at: Date.now()
      });
      if (this.rows.length > 900) this.rows.splice(0, this.rows.length - 900);
      this.save();
    }
    summaries(diff, allowedOps = ['add', 'sub', 'mul', 'div']) {
      const opSet = new Set(allowedOps);
      const rows = this.rows.filter(r => r.diff === diff && opSet.has(r.op));
      const opBaselines = {};
      for (const op of opSet) {
        // Median is resistant to isolated distractions; use only plausible correct first attempts.
        const good = rows.filter(r => r.op === op && r.correct && r.timeMs >= 250 && r.timeMs <= 30000);
        opBaselines[op] = good.length >= 5 ? median(good.slice(-70).map(r => r.timeMs)) : null;
      }
      return Object.keys(SKILLS).filter(skill => opSet.has(opOf(SKILLS[skill].symbol))).map(skill => {
        const samples = rows.filter(r => r.tags.includes(skill)).slice(-45);
        const wrong = samples.filter(r => !r.correct).length;
        const baseline = opBaselines[opOf(SKILLS[skill].symbol)];
        const good = samples.filter(r => r.correct && r.timeMs >= 250 && r.timeMs <= 30000);
        const slow = baseline === null ? 0 : good.filter(r => r.timeMs > Math.max(baseline * 1.55, baseline + 900)).length;
        const sessionCount = new Set(samples.map(r => r.session)).size;
        const uniqueCount = new Set(samples.map(r => r.key)).size;
        // Need repeated evidence across DIFFERENT problems and sessions before identifying weakness.
        const reliable = samples.length >= 6 && uniqueCount >= 4 && sessionCount >= 2;
        const needsWork = reliable && (wrong >= 2 && wrong / samples.length >= 0.2 || slow >= 3 && slow / Math.max(good.length, 1) >= 0.35);
        return {
          id: skill, ...SKILLS[skill], count: samples.length, wrong,
          accuracy: samples.length ? Math.round((samples.length - wrong) / samples.length * 100) : null,
          medianSec: good.length ? median(good.map(r => r.timeMs)) / 1000 : null,
          slow, sessionCount, uniqueCount, reliable, needsWork,
          priority: needsWork ? (wrong / samples.length * 3 + slow / Math.max(1, good.length) + Math.min(samples.length, 20) / 100) : 0
        };
      });
    }
    focus(diff, allowedOps) {
      return this.summaries(diff, allowedOps).filter(x => x.needsWork).sort((a, b) => b.priority - a.priority).slice(0, 2);
    }
    // Existing records are untouched. Low-confidence cold start deliberately stays diverse.
    chooseLearningProblem(makeRandom, diff, allowedOps, previousKeys, slot) {
      const focus = this.focus(diff, allowedOps);
      // At most 4 focus tasks per 15-problem round, with other skills interleaved.
      const isFocusSlot = [2, 6, 10, 13].includes(slot % 15);
      const target = focus.length && isFocusSlot ? focus[Math.floor(slot / 4) % focus.length].id : null;
      const seen = new Set(previousKeys || []);
      let fallback = null;
      let uniqueFallback = null;
      for (let i = 0; i < (target ? 750 : 28); i++) {
        const p = makeRandom(target ? opOf(SKILLS[target].symbol) : null);
        if (!fallback) fallback = p;
        if (seen.has(keyOf(p))) continue;
        if (!uniqueFallback) uniqueFallback = p;
        if (!target || classify(p).includes(target)) return p;
      }
      return uniqueFallback || fallback || makeRandom();
    }
    getReport(diff, allowedOps) {
      const all = this.summaries(diff, allowedOps);
      return {
        studied: all.filter(x => x.count > 0).sort((a, b) => b.count - a.count),
        focus: all.filter(x => x.needsWork).sort((a, b) => b.priority - a.priority),
        total: this.rows.filter(r => r.diff === diff && allowedOps.includes(r.op)).length
      };
    }
  }
  BrainAdaptive.SKILLS = SKILLS;
  BrainAdaptive.classify = classify;
  BrainAdaptive.keyOf = keyOf;
  BrainAdaptive.STORAGE_KEY = STORAGE_KEY;
  return BrainAdaptive;
});
