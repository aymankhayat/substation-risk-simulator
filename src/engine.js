function engMulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function engTriangularInv(u, a, b, c) {
  if (c === a) return a;
  const Fc = (b - a) / (c - a);
  if (u < Fc) return a + Math.sqrt(u * (c - a) * (b - a));
  return c - Math.sqrt((1 - u) * (c - a) * (c - b));
}

function engRandNormal(rng) {
  let u1 = rng();
  while (u1 <= 1e-12) u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function engSampleGamma(rng, k) {
  if (k < 1) {
    const u = rng();
    return engSampleGamma(rng, k + 1) * Math.pow(u, 1 / k);
  }
  const d = k - 1 / 3;
  const c_ = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do {
      x = engRandNormal(rng);
      v = 1 + c_ * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    const x2 = x * x;
    if (u < 1 - 0.0331 * x2 * x2) return d * v;
    if (Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))) return d * v;
  }
}

function engSamplePert(rng, a, b, c) {
  if (c === a) return a;
  const mu = (a + 4 * b + c) / 6;
  let alpha = 6 * ((mu - a) / (c - a));
  let beta = 6 * ((c - mu) / (c - a));
  if (alpha < 0.1) alpha = 0.1;
  if (beta < 0.1) beta = 0.1;
  const g1 = engSampleGamma(rng, alpha);
  const g2 = engSampleGamma(rng, beta);
  const betaSample = g1 / (g1 + g2);
  return a + betaSample * (c - a);
}

// PERT shapes are 1 + 4(b-a)/(c-a) and 1 + 4(c-b)/(c-a), so both are >= 1 for any valid
// estimate: the density is bounded and a tabulated inverse CDF is accurate. Returns null
// for a degenerate estimate so the caller falls back to Marsaglia-Tsang.
function engPertTable(a, b, c, size) {
  const tab = new Float64Array(size);
  if (c === a) {
    tab.fill(a);
    return tab;
  }
  const mu = (a + 4 * b + c) / 6;
  const alpha = 6 * ((mu - a) / (c - a));
  const beta = 6 * ((c - mu) / (c - a));
  if (alpha < 1 || beta < 1) return null;
  const grid = 4097;
  const h = 1 / (grid - 1);
  const cdf = new Float64Array(grid);
  let prevPdf = Math.pow(0, alpha - 1);
  for (let i = 1; i < grid; i++) {
    const x = i * h;
    const pdf = Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1);
    cdf[i] = cdf[i - 1] + 0.5 * (prevPdf + pdf) * h;
    prevPdf = pdf;
  }
  const total = cdf[grid - 1];
  let j = 0;
  for (let k = 0; k < size; k++) {
    const target = (k / (size - 1)) * total;
    while (j < grid - 2 && cdf[j + 1] < target) j++;
    const span = cdf[j + 1] - cdf[j];
    const f = span > 0 ? (target - cdf[j]) / span : 0;
    tab[k] = a + (j + f) * h * (c - a);
  }
  return tab;
}

const engPertCache = new Map();

function engPertTableCached(a, b, c) {
  const key = a + "|" + b + "|" + c;
  let tab = engPertCache.get(key);
  if (tab === undefined) {
    if (engPertCache.size > 400) engPertCache.clear();
    tab = engPertTable(a, b, c, 2048);
    engPertCache.set(key, tab);
  }
  return tab;
}

function engTableSample(tab, u) {
  const last = tab.length - 1;
  const pos = u * last;
  const i = pos | 0;
  if (i >= last) return tab[last];
  return tab[i] + (pos - i) * (tab[i + 1] - tab[i]);
}

function engDraw(rng, dist, tab, a, b, c) {
  if (dist === "triangular") return engTriangularInv(rng(), a, b, c);
  if (tab) return engTableSample(tab, rng());
  return engSamplePert(rng, a, b, c);
}

function engSample(rng, dist, a, b, c) {
  if (dist === "triangular") return engTriangularInv(rng(), a, b, c);
  return engSamplePert(rng, a, b, c);
}

function engDistMean(dist, a, b, c) {
  if (dist === "triangular") return (a + b + c) / 3;
  return (a + 4 * b + c) / 6;
}

function engPercentile(sortedAsc, p) {
  const n = sortedAsc.length;
  if (n === 1) return sortedAsc[0];
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  if (lo >= n - 1) return sortedAsc[n - 1];
  const frac = idx - lo;
  return sortedAsc[lo] + frac * (sortedAsc[lo + 1] - sortedAsc[lo]);
}

function engStats(sortedAsc) {
  const n = sortedAsc.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += sortedAsc[i];
  return {
    min: sortedAsc[0],
    max: sortedAsc[n - 1],
    mean: sum / n,
    p10: engPercentile(sortedAsc, 0.1),
    p50: engPercentile(sortedAsc, 0.5),
    p80: engPercentile(sortedAsc, 0.8),
    p90: engPercentile(sortedAsc, 0.9)
  };
}

function engHistogram(values, binCount) {
  const n = values.length;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  const binWidth = range > 0 ? range / binCount : 1;
  const counts = new Array(binCount).fill(0);
  for (let i = 0; i < n; i++) {
    let idx = range > 0 ? Math.floor((values[i] - min) / binWidth) : 0;
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  const bins = new Array(binCount);
  for (let i = 0; i < binCount; i++) {
    const x0 = min + i * binWidth;
    const x1 = min + (i + 1) * binWidth;
    const count = counts[i];
    const density = n > 0 && binWidth > 0 ? count / (n * binWidth) : 0;
    bins[i] = { x0, x1, count, density };
  }
  return { bins, binWidth, min, max };
}

function engCdfPoints(sortedAsc, maxPoints) {
  const mp = maxPoints === undefined ? 240 : maxPoints;
  const n = sortedAsc.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: sortedAsc[0], p: 1 }];
  const count = n <= mp ? n : mp;
  const points = [];
  let lastIdx = -1;
  for (let k = 0; k < count; k++) {
    let idx = Math.round((k * (n - 1)) / (count - 1));
    if (idx === lastIdx) continue;
    lastIdx = idx;
    points.push({ x: sortedAsc[idx], p: idx / (n - 1) });
  }
  return points;
}

function engTopoOrder(tasks) {
  const indeg = {};
  const adj = {};
  for (let i = 0; i < tasks.length; i++) {
    indeg[tasks[i].id] = 0;
    adj[tasks[i].id] = [];
  }
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    for (let j = 0; j < t.preds.length; j++) {
      adj[t.preds[j]].push(t.id);
      indeg[t.id]++;
    }
  }
  const queue = [];
  for (let i = 0; i < tasks.length; i++) {
    if (indeg[tasks[i].id] === 0) queue.push(tasks[i].id);
  }
  const order = [];
  let qi = 0;
  while (qi < queue.length) {
    const id = queue[qi++];
    order.push(id);
    const succ = adj[id];
    for (let j = 0; j < succ.length; j++) {
      const s = succ[j];
      indeg[s]--;
      if (indeg[s] === 0) queue.push(s);
    }
  }
  if (order.length !== tasks.length) throw new Error("Cycle detected in task network");
  return order;
}

function engForwardPass(tasks, order, durations) {
  const taskMap = {};
  for (let i = 0; i < tasks.length; i++) taskMap[tasks[i].id] = tasks[i];
  const es = {};
  const ef = {};
  let projectDuration = 0;
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const t = taskMap[id];
    let maxEf = 0;
    for (let j = 0; j < t.preds.length; j++) {
      const pef = ef[t.preds[j]];
      if (pef > maxEf) maxEf = pef;
    }
    es[id] = maxEf;
    const d = durations[id];
    ef[id] = maxEf + d;
    if (ef[id] > projectDuration) projectDuration = ef[id];
  }
  return { es, ef, projectDuration };
}

function engBackwardPass(tasks, order, durations, ef, projectDuration) {
  const successors = {};
  for (let i = 0; i < tasks.length; i++) successors[tasks[i].id] = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    for (let j = 0; j < t.preds.length; j++) successors[t.preds[j]].push(t.id);
  }
  const lf = {};
  const ls = {};
  const float = {};
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const succ = successors[id];
    let minLs;
    if (succ.length === 0) {
      minLs = projectDuration;
    } else {
      minLs = Infinity;
      for (let j = 0; j < succ.length; j++) {
        const sls = ls[succ[j]];
        if (sls < minLs) minLs = sls;
      }
    }
    lf[id] = minLs;
    const d = durations[id];
    ls[id] = minLs - d;
    const es = ef[id] - d;
    float[id] = ls[id] - es;
  }
  return { lf, ls, float };
}

function engEvaluateBase(model, overrides) {
  const ov = overrides || {};
  const dist = model.distribution;
  const tasks = model.tasks;
  const costs = model.costs;

  const durations = {};
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const key = "dur:" + t.id;
    durations[t.id] = Object.prototype.hasOwnProperty.call(ov, key) ? ov[key] : engDistMean(dist, t.o, t.l, t.p);
  }

  const order = engTopoOrder(tasks);
  const fwd = engForwardPass(tasks, order, durations);
  const bwd = engBackwardPass(tasks, order, durations, fwd.ef, fwd.projectDuration);
  const duration = fwd.projectDuration;

  let sumFixed = 0;
  let sumPerDay = 0;
  for (let i = 0; i < costs.length; i++) {
    const c = costs[i];
    const fixKey = "fix:" + c.id;
    const fixedVal = Object.prototype.hasOwnProperty.call(ov, fixKey)
      ? ov[fixKey]
      : engDistMean(dist, c.fixed.o, c.fixed.l, c.fixed.p);
    sumFixed += fixedVal;

    const dayKey = "day:" + c.id;
    let perDayVal;
    if (Object.prototype.hasOwnProperty.call(ov, dayKey)) {
      perDayVal = ov[dayKey];
    } else if (c.perDay.o === 0 && c.perDay.l === 0 && c.perDay.p === 0) {
      perDayVal = 0;
    } else {
      perDayVal = engDistMean(dist, c.perDay.o, c.perDay.l, c.perDay.p);
    }
    sumPerDay += perDayVal;
  }

  const cost = sumFixed + duration * sumPerDay;

  const criticalIds = [];
  for (let i = 0; i < tasks.length; i++) {
    const id = tasks[i].id;
    if (bwd.float[id] < 1e-6) criticalIds.push(id);
  }

  return { duration, cost, es: fwd.es, ef: fwd.ef, float: bwd.float, criticalIds };
}

function engRankWithSorted(values) {
  const n = values.length;
  const sorted = Float64Array.from(values).sort();
  const ranks = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = values[i];
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const m = (lo + hi) >>> 1;
      if (sorted[m] < v) lo = m + 1;
      else hi = m;
    }
    let lo2 = lo;
    let hi2 = n;
    while (lo2 < hi2) {
      const m = (lo2 + hi2) >>> 1;
      if (sorted[m] <= v) lo2 = m + 1;
      else hi2 = m;
    }
    // ties occupy sorted[lo .. lo2-1], i.e. 1-based ranks lo+1 .. lo2
    ranks[i] = (lo + 1 + lo2) / 2;
  }
  return { ranks, sorted };
}

function engRank(values) {
  return engRankWithSorted(values).ranks;
}

function engPearson(rx, ry) {
  const n = rx.length;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += rx[i];
    sumY += ry[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanX;
    const dy = ry[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (varX === 0 || varY === 0) return 0;
  return cov / Math.sqrt(varX * varY);
}

function engSpearman(xs, ys) {
  return engPearson(engRank(xs), engRank(ys));
}

function engNormInv(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a1 = -3.969683028665376e+01, a2 = 2.209460984245205e+02, a3 = -2.759285104469687e+02,
    a4 = 1.383577518672690e+02, a5 = -3.066479806614716e+01, a6 = 2.506628277459239e+00;
  const b1 = -5.447609879822406e+01, b2 = 1.615858368580409e+02, b3 = -1.556989798598866e+02,
    b4 = 6.680131188771972e+01, b5 = -1.328068155288572e+01;
  const c1 = -7.784894002430293e-03, c2 = -3.223964580411365e-01, c3 = -2.400758277161838e+00,
    c4 = -2.549732539343734e+00, c5 = 4.374664141464968e+00, c6 = 2.938163982698783e+00;
  const d1 = 7.784695709041462e-03, d2 = 3.224671290700398e-01, d3 = 2.445134137142996e+00,
    d4 = 3.754408661907416e+00;
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
    ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
}

function engCholesky(A) {
  const k = A.length;
  const L = new Array(k);
  for (let i = 0; i < k; i++) L[i] = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i][j];
      for (let m = 0; m < j; m++) sum -= L[i][m] * L[j][m];
      if (i === j) {
        if (sum <= 1e-12) return null;
        L[i][j] = Math.sqrt(sum);
      } else {
        L[i][j] = sum / L[j][j];
      }
    }
  }
  return L;
}

function engApplyCorrelation(series, pairs, rng) {
  function choleskyRobust(C, k) {
    let L = engCholesky(C);
    if (L) return L;
    for (let step = 1; step <= 20; step++) {
      const lambda = step * 0.05;
      const rep = new Array(k);
      for (let i = 0; i < k; i++) {
        rep[i] = new Array(k);
        for (let j = 0; j < k; j++) rep[i][j] = (1 - lambda) * C[i][j] + (i === j ? lambda : 0);
      }
      L = engCholesky(rep);
      if (L) return L;
    }
    return L;
  }

  function invertLowerTriangular(Q, k) {
    const inv = new Array(k);
    for (let i = 0; i < k; i++) inv[i] = new Array(k).fill(0);
    for (let col = 0; col < k; col++) {
      const x = new Array(k).fill(0);
      for (let i = 0; i < k; i++) {
        let sum = i === col ? 1 : 0;
        for (let m = 0; m < i; m++) sum -= Q[i][m] * x[m];
        x[i] = sum / Q[i][i];
      }
      for (let i = 0; i < k; i++) inv[i][col] = x[i];
    }
    return inv;
  }

  function matMul(A, B, k) {
    const R = new Array(k);
    for (let i = 0; i < k; i++) {
      R[i] = new Array(k).fill(0);
      for (let j = 0; j < k; j++) {
        let sum = 0;
        for (let m = 0; m < k; m++) sum += A[i][m] * B[m][j];
        R[i][j] = sum;
      }
    }
    return R;
  }

  const keySet = [];
  const keyIndex = {};
  for (let pi = 0; pi < pairs.length; pi++) {
    const pr = pairs[pi];
    if (!(pr.a in keyIndex)) {
      keyIndex[pr.a] = keySet.length;
      keySet.push(pr.a);
    }
    if (!(pr.b in keyIndex)) {
      keyIndex[pr.b] = keySet.length;
      keySet.push(pr.b);
    }
  }
  const k = keySet.length;
  const n = series[keySet[0]].length;

  const C = new Array(k);
  for (let i = 0; i < k; i++) {
    C[i] = new Array(k).fill(0);
    C[i][i] = 1;
  }
  for (let pi = 0; pi < pairs.length; pi++) {
    const pr = pairs[pi];
    const i = keyIndex[pr.a];
    const j = keyIndex[pr.b];
    const val = 2 * Math.sin((Math.PI * pr.rho) / 6);
    C[i][j] = val;
    C[j][i] = val;
  }
  const P = choleskyRobust(C, k);

  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) s[i] = engNormInv((i + 1) / (n + 1));

  const R = new Array(k);
  for (let j = 0; j < k; j++) {
    const col = Float64Array.from(s);
    for (let m = col.length - 1; m > 0; m--) {
      const idx = Math.floor(rng() * (m + 1));
      const tmp = col[m];
      col[m] = col[idx];
      col[idx] = tmp;
    }
    R[j] = col;
  }

  const E = new Array(k);
  for (let i = 0; i < k; i++) E[i] = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      const c = engPearson(R[i], R[j]);
      E[i][j] = c;
      E[j][i] = c;
    }
  }
  const Q = choleskyRobust(E, k);
  const Qinv = invertLowerTriangular(Q, k);
  const S = matMul(P, Qinv, k);

  const Tcol = new Array(k);
  for (let j = 0; j < k; j++) Tcol[j] = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < k; j++) {
      let sum = 0;
      for (let m = 0; m < k; m++) sum += S[j][m] * R[m][i];
      Tcol[j][i] = sum;
    }
  }

  const taken = new Uint32Array(n);
  for (let j = 0; j < k; j++) {
    const arr = series[keySet[j]];
    const tcol = Tcol[j];
    const sortedT = Float64Array.from(tcol).sort();
    const sortedV = Float64Array.from(arr).sort();
    taken.fill(0);
    // rank of each row in T via binary search; `taken` hands tied values consecutive ranks
    for (let i = 0; i < n; i++) {
      const v = tcol[i];
      let lo = 0;
      let hi = n;
      while (lo < hi) {
        const m = (lo + hi) >>> 1;
        if (sortedT[m] < v) lo = m + 1;
        else hi = m;
      }
      arr[i] = sortedV[lo + taken[lo]++];
    }
  }
}

function engSimulate(model) {
  const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  const tasks = model.tasks;
  const costs = model.costs;
  const dist = model.distribution;
  const n = model.iterations;
  const rng = engMulberry32(model.seed);

  const taskCount = tasks.length;
  const costCount = costs.length;

  const idToIdx = {};
  for (let i = 0; i < taskCount; i++) idToIdx[tasks[i].id] = i;

  const topoIds = engTopoOrder(tasks);
  const topoIdx = new Int32Array(taskCount);
  for (let i = 0; i < taskCount; i++) topoIdx[i] = idToIdx[topoIds[i]];

  const predLists = new Array(taskCount);
  const succLists = new Array(taskCount);
  for (let i = 0; i < taskCount; i++) {
    predLists[i] = [];
    succLists[i] = [];
  }
  for (let i = 0; i < taskCount; i++) {
    const t = tasks[i];
    for (let j = 0; j < t.preds.length; j++) {
      const pi = idToIdx[t.preds[j]];
      predLists[i].push(pi);
      succLists[pi].push(i);
    }
  }
  const predIdx = new Array(taskCount);
  const succIdx = new Array(taskCount);
  for (let i = 0; i < taskCount; i++) {
    predIdx[i] = Int32Array.from(predLists[i]);
    succIdx[i] = Int32Array.from(succLists[i]);
  }

  const oArr = new Float64Array(taskCount);
  const lArr = new Float64Array(taskCount);
  const pArr = new Float64Array(taskCount);
  for (let i = 0; i < taskCount; i++) {
    oArr[i] = tasks[i].o;
    lArr[i] = tasks[i].l;
    pArr[i] = tasks[i].p;
  }

  const fixO = new Float64Array(costCount);
  const fixL = new Float64Array(costCount);
  const fixP = new Float64Array(costCount);
  const dayO = new Float64Array(costCount);
  const dayL = new Float64Array(costCount);
  const dayP = new Float64Array(costCount);
  const dayActive = new Uint8Array(costCount);
  for (let i = 0; i < costCount; i++) {
    const c = costs[i];
    fixO[i] = c.fixed.o;
    fixL[i] = c.fixed.l;
    fixP[i] = c.fixed.p;
    dayO[i] = c.perDay.o;
    dayL[i] = c.perDay.l;
    dayP[i] = c.perDay.p;
    dayActive[i] = c.perDay.o === 0 && c.perDay.l === 0 && c.perDay.p === 0 ? 0 : 1;
  }

  const pert = dist !== "triangular";
  const durTab = new Array(taskCount);
  for (let i = 0; i < taskCount; i++) durTab[i] = pert ? engPertTableCached(oArr[i], lArr[i], pArr[i]) : null;
  const fixTab = new Array(costCount);
  const dayTab = new Array(costCount);
  for (let i = 0; i < costCount; i++) {
    fixTab[i] = pert ? engPertTableCached(fixO[i], fixL[i], fixP[i]) : null;
    dayTab[i] = pert && dayActive[i] ? engPertTableCached(dayO[i], dayL[i], dayP[i]) : null;
  }

  const durKeys = new Array(taskCount);
  for (let i = 0; i < taskCount; i++) durKeys[i] = "dur:" + tasks[i].id;
  const fixKeys = new Array(costCount);
  const dayKeys = new Array(costCount);
  for (let i = 0; i < costCount; i++) {
    fixKeys[i] = "fix:" + costs[i].id;
    dayKeys[i] = dayActive[i] ? "day:" + costs[i].id : null;
  }

  const costArr = new Float64Array(n);
  const durationArr = new Float64Array(n);

  const sampleSeries = {};
  const durSample = new Array(taskCount);
  for (let i = 0; i < taskCount; i++) {
    durSample[i] = new Float64Array(n);
    sampleSeries[durKeys[i]] = durSample[i];
  }
  const fixSample = new Array(costCount);
  const daySample = new Array(costCount);
  for (let i = 0; i < costCount; i++) {
    fixSample[i] = new Float64Array(n);
    sampleSeries[fixKeys[i]] = fixSample[i];
    if (dayActive[i]) {
      daySample[i] = new Float64Array(n);
      sampleSeries[dayKeys[i]] = daySample[i];
    } else {
      daySample[i] = null;
    }
  }

  const esBuf = new Float64Array(taskCount);
  const efBuf = new Float64Array(taskCount);
  const lsBuf = new Float64Array(taskCount);
  const durBuf = new Float64Array(taskCount);
  const criticalCount = new Float64Array(taskCount);

  for (let iter = 0; iter < n; iter++) {
    for (let i = 0; i < taskCount; i++) {
      durSample[i][iter] = engDraw(rng, dist, durTab[i], oArr[i], lArr[i], pArr[i]);
    }
    for (let i = 0; i < costCount; i++) {
      fixSample[i][iter] = engDraw(rng, dist, fixTab[i], fixO[i], fixL[i], fixP[i]);
      if (dayActive[i]) {
        daySample[i][iter] = engDraw(rng, dist, dayTab[i], dayO[i], dayL[i], dayP[i]);
      }
    }
  }

  const rawCorr = model.correlations || [];
  const pairMap = {};
  for (let i = 0; i < rawCorr.length; i++) {
    const pr = rawCorr[i];
    const a = pr.a;
    const b = pr.b;
    if (a === b) continue;
    if (!Object.prototype.hasOwnProperty.call(sampleSeries, a)) continue;
    if (!Object.prototype.hasOwnProperty.call(sampleSeries, b)) continue;
    let rho = pr.rho;
    if (!Number.isFinite(rho)) continue;
    if (rho > 0.95) rho = 0.95;
    if (rho < -0.95) rho = -0.95;
    const pairKey = a < b ? a + "|" + b : b + "|" + a;
    pairMap[pairKey] = { id: pr.id, a: a, b: b, rho: rho };
  }
  const validPairs = Object.keys(pairMap).map((k) => pairMap[k]);
  const correlationActive = !!model.correlate && validPairs.length > 0;
  if (correlationActive) engApplyCorrelation(sampleSeries, validPairs, rng);

  for (let iter = 0; iter < n; iter++) {
    for (let i = 0; i < taskCount; i++) durBuf[i] = durSample[i][iter];

    let projectDuration = 0;
    for (let k = 0; k < taskCount; k++) {
      const i = topoIdx[k];
      const preds = predIdx[i];
      let maxEf = 0;
      for (let j = 0; j < preds.length; j++) {
        const v = efBuf[preds[j]];
        if (v > maxEf) maxEf = v;
      }
      esBuf[i] = maxEf;
      const ef = maxEf + durBuf[i];
      efBuf[i] = ef;
      if (ef > projectDuration) projectDuration = ef;
    }

    for (let k = taskCount - 1; k >= 0; k--) {
      const i = topoIdx[k];
      const succ = succIdx[i];
      let minLs;
      if (succ.length === 0) {
        minLs = projectDuration;
      } else {
        minLs = Infinity;
        for (let j = 0; j < succ.length; j++) {
          const v = lsBuf[succ[j]];
          if (v < minLs) minLs = v;
        }
      }
      const ls = minLs - durBuf[i];
      lsBuf[i] = ls;
      const float = ls - esBuf[i];
      if (float < 1e-6) criticalCount[i] += 1;
    }

    let sumFixed = 0;
    let sumPerDay = 0;
    for (let i = 0; i < costCount; i++) {
      sumFixed += fixSample[i][iter];
      if (dayActive[i]) sumPerDay += daySample[i][iter];
    }

    costArr[iter] = sumFixed + projectDuration * sumPerDay;
    durationArr[iter] = projectDuration;
  }

  const costSorted = Float64Array.from(costArr).sort();
  const durationSorted = Float64Array.from(durationArr).sort();
  const costStats = engStats(costSorted);
  const durationStats = engStats(durationSorted);
  const bins = model.bins;
  const costHist = engHistogram(costArr, bins);
  const durationHist = engHistogram(durationArr, bins);
  const costCdf = engCdfPoints(costSorted, 240);
  const durationCdf = engCdfPoints(durationSorted, 240);

  const criticality = new Array(taskCount);
  for (let i = 0; i < taskCount; i++) {
    criticality[i] = { id: tasks[i].id, short: tasks[i].short, index: criticalCount[i] / n };
  }

  const base = engEvaluateBase(model, {});

  const allKeys = durKeys.concat(fixKeys, dayKeys.filter((k) => k !== null));

  // Sensitivity statistics are capped at 10k runs so their cost stays flat as iterations grow.
  const sensN = Math.min(n, 10000);
  const costRanks = engRank(costArr.subarray(0, sensN));
  const durationRanks = engRank(durationArr.subarray(0, sensN));
  const inputInfo = {};
  for (let ki = 0; ki < allKeys.length; ki++) {
    const key = allKeys[ki];
    const rs = engRankWithSorted(sampleSeries[key].subarray(0, sensN));
    inputInfo[key] = { p10: engPercentile(rs.sorted, 0.1), p90: engPercentile(rs.sorted, 0.9), ranks: rs.ranks };
  }

  const appliedCorrelations = correlationActive
    ? validPairs.map((pr) => ({
        id: pr.id,
        a: pr.a,
        b: pr.b,
        target: pr.rho,
        achieved: engPearson(inputInfo[pr.a].ranks, inputInfo[pr.b].ranks)
      }))
    : [];

  function computeTornado(outputField) {
    const rows = [];
    for (let ki = 0; ki < allKeys.length; ki++) {
      const key = allKeys[ki];
      let kind, label, id;
      if (key.indexOf("dur:") === 0) {
        id = key.slice(4);
        kind = "duration";
        label = tasks[idToIdx[id]].short;
      } else if (key.indexOf("fix:") === 0) {
        id = key.slice(4);
        kind = "fixed";
        const ci = costs.findIndex((c) => c.id === id);
        label = costs[ci].short;
      } else {
        id = key.slice(4);
        kind = "perDay";
        const ci = costs.findIndex((c) => c.id === id);
        label = costs[ci].short;
      }
      if (outputField === "duration" && kind !== "duration") continue;

      const info = inputInfo[key];
      const p10 = info.p10;
      const p90 = info.p90;

      const ovLow = {};
      ovLow[key] = p10;
      const ovHigh = {};
      ovHigh[key] = p90;
      const lowVal = engEvaluateBase(model, ovLow)[outputField];
      const highVal = engEvaluateBase(model, ovHigh)[outputField];
      const baseVal = base[outputField];
      const corr = engPearson(info.ranks, outputField === "cost" ? costRanks : durationRanks);

      rows.push({
        key,
        id,
        label,
        kind,
        base: baseVal,
        low: lowVal,
        high: highVal,
        swing: Math.abs(highVal - lowVal),
        corr
      });
    }
    rows.sort((a, b) => b.swing - a.swing);
    return rows;
  }

  const tornadoCost = computeTornado("cost");
  const tornadoDuration = computeTornado("duration");

  const t1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

  return {
    n,
    cost: costArr,
    duration: durationArr,
    costStats,
    durationStats,
    costHist,
    durationHist,
    costCdf,
    durationCdf,
    criticality,
    base,
    tornadoCost,
    tornadoDuration,
    appliedCorrelations,
    elapsedMs: t1 - t0
  };
}

window.__eng = {
  engMulberry32,
  engTriangularInv,
  engSamplePert,
  engSample,
  engDistMean,
  engPercentile,
  engStats,
  engHistogram,
  engCdfPoints,
  engTopoOrder,
  engForwardPass,
  engBackwardPass,
  engEvaluateBase,
  engSimulate,
  engSpearman,
  engPertTable,
  engTableSample,
  engRank,
  engNormInv,
  engCholesky,
  engApplyCorrelation
};
