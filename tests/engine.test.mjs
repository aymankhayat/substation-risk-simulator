// Analytic test vectors for the simulation engine.
//
// Every expectation below is a closed-form result computed by hand, not a value
// recorded from a previous run of this code. A regression that changes the maths
// fails here even if the app still renders.
//
// Run with:  node tests/engine.test.mjs

import { readFileSync } from 'node:fs';

globalThis.window = {};
(0, eval)(readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8'));
const E = globalThis.window.__eng;

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (err) {
    failures.push({ name, message: err.message });
    console.log('  FAIL ' + name + '\n       ' + err.message);
  }
}

function near(actual, expected, tol, what) {
  if (!Number.isFinite(actual)) throw new Error(what + ': got ' + actual);
  if (Math.abs(actual - expected) > tol) {
    throw new Error(what + ': expected ' + expected + ' +/- ' + tol + ', got ' + actual);
  }
}

function equal(actual, expected, what) {
  if (actual !== expected) throw new Error(what + ': expected ' + expected + ', got ' + actual);
}

function moments(values) {
  const n = values.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i];
  const mean = sum / n;
  let sq = 0;
  for (let i = 0; i < n; i++) sq += (values[i] - mean) * (values[i] - mean);
  return { mean, variance: sq / (n - 1) };
}

// A deterministic project: every three-point estimate collapses to a single value,
// so the whole model has an exact answer that Monte Carlo must reproduce.
//
//   A(3) --> B(4) --\
//        \           +--> D(5)
//         -> C(2) --/
//
// Critical path A-B-D = 12 days. C carries 2 days of float.
const det = (v) => ({ o: v, l: v, p: v });
const DETERMINISTIC = {
  startDate: '2026-01-01',
  distribution: 'pert',
  iterations: 2000,
  seed: 42,
  correlate: false,
  correlations: [],
  tasks: [
    { id: 'A', name: 'A', preds: [], o: 3, l: 3, p: 3 },
    { id: 'B', name: 'B', preds: ['A'], o: 4, l: 4, p: 4 },
    { id: 'C', name: 'C', preds: ['A'], o: 2, l: 2, p: 2 },
    { id: 'D', name: 'D', preds: ['B', 'C'], o: 5, l: 5, p: 5 }
  ],
  costs: [
    { id: 'K1', name: 'Fixed only', fixed: det(1000), perDay: { o: 0, l: 0, p: 0 } },
    { id: 'K2', name: 'Rate only', fixed: det(0), perDay: det(10) }
  ]
};

console.log('\nRandom number generation');

check('mulberry32 is reproducible for a given seed', () => {
  const a = E.engMulberry32(12345);
  const b = E.engMulberry32(12345);
  for (let i = 0; i < 100; i++) equal(a(), b(), 'draw ' + i);
});

check('mulberry32 stays inside [0, 1)', () => {
  const rng = E.engMulberry32(99);
  for (let i = 0; i < 50000; i++) {
    const u = rng();
    if (!(u >= 0 && u < 1)) throw new Error('draw ' + i + ' was ' + u);
  }
});

check('mulberry32 mean approaches 0.5 over 200k draws', () => {
  const rng = E.engMulberry32(7);
  let sum = 0;
  const n = 200000;
  for (let i = 0; i < n; i++) sum += rng();
  // Standard error for U(0,1) is 1/sqrt(12n) ~ 0.00065, so 0.005 is about 7 sigma.
  near(sum / n, 0.5, 0.005, 'sample mean');
});

console.log('\nNormal quantile function');

check('engNormInv matches published standard normal quantiles', () => {
  near(E.engNormInv(0.5), 0, 1e-9, 'median');
  near(E.engNormInv(0.975), 1.959963984540054, 1e-6, '97.5th percentile');
  near(E.engNormInv(0.025), -1.959963984540054, 1e-6, '2.5th percentile');
  near(E.engNormInv(0.9), 1.2815515655446004, 1e-6, '90th percentile');
  near(E.engNormInv(0.99), 2.3263478740408408, 1e-6, '99th percentile');
});

check('engNormInv is antisymmetric about the median', () => {
  for (const p of [0.01, 0.1, 0.3, 0.45]) {
    near(E.engNormInv(p), -E.engNormInv(1 - p), 1e-9, 'symmetry at p=' + p);
  }
});

console.log('\nTriangular distribution');

check('triangular inverse CDF hits the analytic endpoints and mode', () => {
  const a = 10, b = 20, c = 60;
  near(E.engTriangularInv(0, a, b, c), a, 1e-12, 'F(0)');
  near(E.engTriangularInv(1, a, b, c), c, 1e-12, 'F(1)');
  // The CDF at the mode is exactly (b - a) / (c - a) = 0.2.
  near(E.engTriangularInv((b - a) / (c - a), a, b, c), b, 1e-9, 'F at the mode');
});

check('triangular moments match (a+b+c)/3 and the closed-form variance', () => {
  const a = 10, b = 20, c = 60;
  const rng = E.engMulberry32(2024);
  const n = 300000;
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) s[i] = E.engSample(rng, 'triangular', a, b, c);
  const m = moments(s);
  near(m.mean, (a + b + c) / 3, 0.1, 'mean');
  // Var = (a^2 + b^2 + c^2 - ab - ac - bc) / 18 = 2100 / 18
  near(m.variance, 2100 / 18, 2, 'variance');
});

console.log('\nBeta-PERT distribution');

check('PERT mean matches (a + 4b + c) / 6', () => {
  equal(E.engDistMean('pert', 10, 20, 60), 25, 'analytic mean');
  equal(E.engDistMean('triangular', 10, 20, 60), 30, 'triangular analytic mean');
});

check('PERT samples reproduce the analytic mean and variance', () => {
  const a = 10, b = 20, c = 60;
  const mu = (a + 4 * b + c) / 6;             // 25
  const variance = ((mu - a) * (c - mu)) / 7; // 15 * 35 / 7 = 75
  const rng = E.engMulberry32(31337);
  const n = 300000;
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) s[i] = E.engSamplePert(rng, a, b, c);
  const m = moments(s);
  near(m.mean, mu, 0.08, 'sample mean');
  near(m.variance, variance, 1.5, 'sample variance');
});

check('PERT samples stay within the three-point bounds', () => {
  const rng = E.engMulberry32(5);
  for (let i = 0; i < 100000; i++) {
    const v = E.engSamplePert(rng, 10, 20, 60);
    if (v < 10 || v > 60) throw new Error('sample ' + v + ' escaped [10, 60]');
  }
});

check('a degenerate estimate collapses to a point mass', () => {
  const rng = E.engMulberry32(1);
  for (let i = 0; i < 100; i++) equal(E.engSamplePert(rng, 7, 7, 7), 7, 'degenerate draw');
});

check('the tabulated inverse CDF is symmetric when the estimate is', () => {
  // With the mode at the midpoint the distribution is symmetric, so the median
  // is the midpoint and the table is antisymmetric about it.
  const tab = E.engPertTable(0, 50, 100, 2049);
  near(E.engTableSample(tab, 0.5), 50, 0.2, 'median');
  near(E.engTableSample(tab, 0.1) + E.engTableSample(tab, 0.9), 100, 0.5, 'P10 + P90');
});

console.log('\nPercentiles');

check('engPercentile reproduces Excel PERCENTILE.INC on 1..10', () => {
  const v = Float64Array.from({ length: 10 }, (_, i) => i + 1);
  near(E.engPercentile(v, 0.25), 3.25, 1e-12, 'P25');
  near(E.engPercentile(v, 0.5), 5.5, 1e-12, 'P50');
  near(E.engPercentile(v, 0.75), 7.75, 1e-12, 'P75');
  near(E.engPercentile(v, 0), 1, 1e-12, 'P0');
  near(E.engPercentile(v, 1), 10, 1e-12, 'P100');
});

check('engStats percentiles are ordered', () => {
  const rng = E.engMulberry32(808);
  const v = Float64Array.from({ length: 10000 }, () => rng() * 100).sort();
  const s = E.engStats(v);
  if (!(s.min <= s.p10 && s.p10 <= s.p50 && s.p50 <= s.p80 && s.p80 <= s.p90 && s.p90 <= s.max)) {
    throw new Error('percentiles out of order: ' + JSON.stringify(s));
  }
});

console.log('\nCritical path method');

check('topological order places every predecessor first', () => {
  const order = E.engTopoOrder(DETERMINISTIC.tasks);
  const seen = new Set();
  for (const id of order) {
    const task = DETERMINISTIC.tasks.find((t) => t.id === id);
    for (const p of task.preds) {
      if (!seen.has(p)) throw new Error(id + ' was ordered before its predecessor ' + p);
    }
    seen.add(id);
  }
  equal(order.length, 4, 'ordered task count');
});

check('forward pass matches the hand-computed early dates', () => {
  const durations = { A: 3, B: 4, C: 2, D: 5 };
  const order = E.engTopoOrder(DETERMINISTIC.tasks);
  const f = E.engForwardPass(DETERMINISTIC.tasks, order, durations);
  equal(f.es.A, 0, 'ES(A)'); equal(f.ef.A, 3, 'EF(A)');
  equal(f.es.B, 3, 'ES(B)'); equal(f.ef.B, 7, 'EF(B)');
  equal(f.es.C, 3, 'ES(C)'); equal(f.ef.C, 5, 'EF(C)');
  equal(f.es.D, 7, 'ES(D)'); equal(f.ef.D, 12, 'EF(D)');
  equal(f.projectDuration, 12, 'project duration');
});

check('backward pass matches the hand-computed late dates and float', () => {
  const durations = { A: 3, B: 4, C: 2, D: 5 };
  const order = E.engTopoOrder(DETERMINISTIC.tasks);
  const f = E.engForwardPass(DETERMINISTIC.tasks, order, durations);
  const b = E.engBackwardPass(DETERMINISTIC.tasks, order, durations, f.ef, f.projectDuration);
  equal(b.ls.A, 0, 'LS(A)'); equal(b.lf.A, 3, 'LF(A)');
  equal(b.ls.B, 3, 'LS(B)'); equal(b.lf.B, 7, 'LF(B)');
  equal(b.ls.C, 5, 'LS(C)'); equal(b.lf.C, 7, 'LF(C)');
  equal(b.ls.D, 7, 'LS(D)'); equal(b.lf.D, 12, 'LF(D)');
  // Only C is off the critical path, and it carries exactly 2 days of float.
  equal(b.float.A, 0, 'float(A)');
  equal(b.float.B, 0, 'float(B)');
  equal(b.float.C, 2, 'float(C)');
  equal(b.float.D, 0, 'float(D)');
});

check('base evaluation finds the critical path A-B-D', () => {
  const base = E.engEvaluateBase(DETERMINISTIC, {});
  equal(base.duration, 12, 'duration');
  equal(base.criticalIds.join(','), 'A,B,D', 'critical path');
});

check('cost identity holds: fixed + duration * per-day', () => {
  const base = E.engEvaluateBase(DETERMINISTIC, {});
  // 1000 fixed + 12 days * 10 per day = 1120
  equal(base.cost, 1120, 'total cost');
});

check('a schedule override propagates into time-driven cost', () => {
  // Push B from 4 to 9 days: the critical path grows to 3 + 9 + 5 = 17 days,
  // so cost becomes 1000 + 17 * 10 = 1170.
  const base = E.engEvaluateBase(DETERMINISTIC, { 'dur:B': 9 });
  equal(base.duration, 17, 'duration after override');
  equal(base.cost, 1170, 'cost after override');
});

console.log('\nRank statistics and correlation');

check('Spearman is +1 for a monotonic increasing pair', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8];
  const ys = xs.map((v) => Math.exp(v)); // any increasing transform
  near(E.engSpearman(xs, ys), 1, 1e-12, 'rho');
});

check('Spearman is -1 for a reversed pair', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8];
  near(E.engSpearman(xs, xs.slice().reverse()), -1, 1e-12, 'rho');
});

check('tied values receive averaged ranks', () => {
  // [5, 5, 9]: the two 5s share ranks 1 and 2, so both take 1.5; 9 takes 3.
  const r = E.engRank([5, 5, 9]);
  near(r[0], 1.5, 1e-12, 'rank of first tie');
  near(r[1], 1.5, 1e-12, 'rank of second tie');
  near(r[2], 3, 1e-12, 'rank of largest');
});

check('Cholesky factor reconstructs the original matrix', () => {
  // A = [[4, 2], [2, 5]] has the exact factor L = [[2, 0], [1, 2]].
  const A = [[4, 2], [2, 5]];
  const L = E.engCholesky(A);
  near(L[0][0], 2, 1e-12, 'L[0][0]');
  near(L[1][0], 1, 1e-12, 'L[1][0]');
  near(L[1][1], 2, 1e-12, 'L[1][1]');
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      let s = 0;
      for (let k = 0; k < 2; k++) s += L[i][k] * L[j][k];
      near(s, A[i][j], 1e-12, 'reconstructed [' + i + '][' + j + ']');
    }
  }
});

check('Iman-Conover induces the requested rank correlation', () => {
  const n = 20000;
  const rng = E.engMulberry32(4242);
  const series = { X: new Float64Array(n), Y: new Float64Array(n) };
  for (let i = 0; i < n; i++) {
    series.X[i] = E.engSamplePert(rng, 10, 20, 60);
    series.Y[i] = E.engSamplePert(rng, 100, 150, 400);
  }
  near(E.engSpearman(series.X, series.Y), 0, 0.05, 'correlation before reordering');
  E.engApplyCorrelation(series, [{ a: 'X', b: 'Y', rho: 0.6 }], rng);
  near(E.engSpearman(series.X, series.Y), 0.6, 0.05, 'achieved correlation');
});

check('Iman-Conover preserves each marginal distribution', () => {
  // Reordering must not invent or destroy values: the sorted marginals are unchanged.
  const n = 5000;
  const rng = E.engMulberry32(11);
  const series = { X: new Float64Array(n), Y: new Float64Array(n) };
  for (let i = 0; i < n; i++) {
    series.X[i] = E.engSamplePert(rng, 10, 20, 60);
    series.Y[i] = E.engSamplePert(rng, 100, 150, 400);
  }
  const beforeX = Float64Array.from(series.X).sort();
  E.engApplyCorrelation(series, [{ a: 'X', b: 'Y', rho: 0.5 }], rng);
  const afterX = Float64Array.from(series.X).sort();
  for (let i = 0; i < n; i++) {
    if (beforeX[i] !== afterX[i]) throw new Error('marginal changed at sorted index ' + i);
  }
});

console.log('\nEnd-to-end simulation');

check('a deterministic project simulates to its exact analytic answer', () => {
  const r = E.engSimulate(DETERMINISTIC);
  equal(r.n, 2000, 'iteration count');
  for (const p of ['min', 'p10', 'p50', 'p80', 'p90', 'max', 'mean']) {
    near(r.durationStats[p], 12, 1e-9, 'duration ' + p);
    near(r.costStats[p], 1120, 1e-9, 'cost ' + p);
  }
});

check('criticality is 100% on the critical path and 0% off it', () => {
  const r = E.engSimulate(DETERMINISTIC);
  const index = Object.fromEntries(r.criticality.map((c) => [c.id, c.index]));
  // A, B and D are on the only critical path, so they are critical in every
  // iteration. C has float in every iteration, so it is never critical.
  near(index.A, 1, 1e-9, 'criticality of A');
  near(index.B, 1, 1e-9, 'criticality of B');
  near(index.C, 0, 1e-9, 'criticality of C');
  near(index.D, 1, 1e-9, 'criticality of D');
});

check('the same seed reproduces the same simulation', () => {
  const spread = DETERMINISTIC.tasks.map((t) => ({ ...t, p: t.p + 6 }));
  const model = { ...DETERMINISTIC, tasks: spread, iterations: 3000 };
  const a = E.engSimulate(model);
  const b = E.engSimulate(model);
  near(a.costStats.p80, b.costStats.p80, 0, 'cost P80 across runs');
  near(a.durationStats.p80, b.durationStats.p80, 0, 'duration P80 across runs');
});

check('a different seed changes the answer but not by much', () => {
  const spread = DETERMINISTIC.tasks.map((t) => ({ ...t, p: t.p + 6 }));
  const model = { ...DETERMINISTIC, tasks: spread, iterations: 20000 };
  const a = E.engSimulate(model);
  const b = E.engSimulate({ ...model, seed: model.seed + 1 });
  if (a.durationStats.p50 === b.durationStats.p50) throw new Error('two seeds gave an identical P50');
  near(b.durationStats.p50, a.durationStats.p50, 0.5, 'P50 across seeds');
});

check('uncertainty pushes P80 above the deterministic estimate', () => {
  // Right-skewed estimates: the mean of a Beta-PERT sits above the mode, so the
  // P80 finish must be later than the single-point plan.
  const model = {
    ...DETERMINISTIC,
    iterations: 20000,
    tasks: DETERMINISTIC.tasks.map((t) => ({ ...t, p: t.p * 3 }))
  };
  const r = E.engSimulate(model);
  if (!(r.durationStats.p80 > 12)) {
    throw new Error('P80 was ' + r.durationStats.p80 + ', expected later than the 12-day point estimate');
  }
  if (!(r.durationStats.p80 > r.durationStats.p50)) throw new Error('P80 was not above P50');
});

check('tornado rows are sorted by descending swing', () => {
  const model = {
    ...DETERMINISTIC,
    iterations: 20000,
    tasks: DETERMINISTIC.tasks.map((t) => ({ ...t, p: t.p * 3 }))
  };
  const r = E.engSimulate(model);
  for (const rows of [r.tornadoCost, r.tornadoDuration]) {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].swing > rows[i - 1].swing) throw new Error('tornado rows are out of order');
    }
  }
});

console.log('\n' + passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) {
  for (const f of failures) console.error('FAILED: ' + f.name + ': ' + f.message);
  process.exit(1);
}
