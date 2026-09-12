# CONTRACTS — Monte Carlo Cost & Schedule Risk Simulator

This is the binding spec. Every module is written by a different agent, in parallel, and
they are concatenated into one HTML page. If you deviate from a signature here, the
integration breaks. When something is unspecified, choose the simplest thing that satisfies
the signature — do not invent extra features, extra exports, or extra files.

---

## 0. Global rules (apply to every module)

**Runtime:** browser, no build step. React 18 and ReactDOM 18 are already loaded as UMD
globals `React` and `ReactDOM`. JSX in `.jsx` modules is transpiled by Babel Standalone.

**No imports, no exports, no modules.** Do not write `import`, `export`, `require`, or
`module.exports`. Every module is concatenated as an inline `<script>` in one document.
Declare things at top level; other modules can see them.

**Identifier prefixes are mandatory.** All inline scripts share ONE global lexical scope.
A duplicate top-level `const`/`let`/`class`/`function` name across two modules is a hard
`SyntaxError` that blanks the whole page. Therefore every top-level name you declare must
start with your module's prefix:

| Module | File | Prefix | Example |
|---|---|---|---|
| Engine | `src/engine.js` | `eng` | `engSimulate`, `engPercentile` |
| Scenario | `src/scenario.js` | `scn` | `scnDefaultScenario`, `scnFmtMoney` |
| Charts | `src/charts.jsx` | `Chart` | `ChartDistribution`, `ChartAxisTicks` |
| Panel | `src/panel.jsx` | `Panel` | `PanelTaskRow`, `PanelSlider` |

Helper functions count. A bare `const clamp = ...` at top level will collide — name it
`engClamp` / `ChartClamp` / etc. Names *inside* a function body are yours, unrestricted.

**No React hooks in `engine.js` or `scenario.js`** — those are plain JS, no React at all.

**Write only your own file.** Do not create, read-modify, or write any other file.

**Units, fixed everywhere:**
- money: **US dollars, absolute** (8_900_000 means $8.90M). Never store millions.
- rates: **US dollars per day** (3600 means $3.6k/day).
- durations: **calendar days**, floating point.

**No comments except where genuinely non-obvious.** No file-header comment blocks, no
JSDoc. The code should read cleanly on its own.

---

## 1. Shared data shapes

```js
Task = {
  id: "T1",                 // unique
  name: "Detailed design, protection studies & permitting",
  short: "Design & permits",
  preds: [],                // array of Task ids that must finish first
  o: 90, l: 120, p: 210     // optimistic / likely / pessimistic, calendar days
}

CostLine = {
  id: "C1",
  name: "Power transformer & 132 kV switchgear supply",
  short: "Transformer & switchgear",
  fixed:  { o: 7800000, l: 8900000, p: 11500000 },  // USD
  perDay: { o: 800, l: 1200, p: 2400 }             // USD per project day (may be all 0)
}

Scenario = {
  id, name, subtitle, startDate: "2026-10-01",
  tasks:  [Task,  ...],
  costs:  [CostLine, ...]
}

Settings = {
  iterations: 10000,        // 1000..50000
  seed: 20261001,
  distribution: "pert",     // "pert" | "triangular"
  bins: 40
}

Model = { tasks, costs, startDate, ...Settings }   // what engSimulate receives
```

**Input keys.** Every uncertain input has a stable string key, used by the tornado and the
stored sample matrix:

- task duration -> `"dur:T1"`
- cost fixed component -> `"fix:C1"`
- cost per-day component -> `"day:C1"`

A `perDay` whose `o`, `l` and `p` are all 0 is **skipped entirely** — no key, no samples, no
tornado row.

---

## 2. `src/engine.js` — simulation core (prefix `eng`, plain JS)

### 2.1 RNG

```js
engMulberry32(seed) -> () => number        // uniform [0,1)
```
Standard mulberry32. Deterministic: the same seed must reproduce the same stream exactly.

### 2.2 Distributions

```js
engTriangularInv(u, a, b, c) -> number
```
`a`=min, `b`=mode, `c`=max, `u` in [0,1). Exact inverse CDF:
`Fc = (b-a)/(c-a)`; if `u < Fc` return `a + Math.sqrt(u*(c-a)*(b-a))`, else
return `c - Math.sqrt((1-u)*(c-a)*(c-b))`. If `c === a`, return `a`.

```js
engSamplePert(rng, a, b, c) -> number
```
Beta-PERT with the standard shape parameter 4. `mu = (a + 4*b + c)/6`;
`alpha = 6*((mu-a)/(c-a))`; `beta = 6*((c-mu)/(c-a))`. Clamp `alpha` and `beta` to a
minimum of 0.1. Sample `Beta(alpha, beta)` as `g1/(g1+g2)` where `g1 ~ Gamma(alpha,1)` and
`g2 ~ Gamma(beta,1)`, then return `a + betaSample*(c-a)`. If `c === a`, return `a`.

Gamma via **Marsaglia–Tsang**: for shape `k >= 1`, `d = k - 1/3`, `c_ = 1/Math.sqrt(9*d)`;
loop — draw standard normal `z` (Box–Muller from `rng`), `v = (1 + c_*z)^3`, reject if
`v <= 0`; draw `u`; accept if `u < 1 - 0.0331*z^4` or
`Math.log(u) < 0.5*z*z + d*(1 - v + Math.log(v))`; return `d*v`. For `k < 1`, use the boost:
`gamma(k) = gamma(k+1) * Math.pow(rng(), 1/k)`.

```js
engSample(rng, dist, a, b, c) -> number    // dist "pert" -> engSamplePert, "triangular" -> engTriangularInv(rng(), ...)
engDistMean(dist, a, b, c) -> number       // pert: (a+4b+c)/6   triangular: (a+b+c)/3
```

### 2.3 Percentiles and binning

```js
engPercentile(sortedAsc, p) -> number
```
Type 7 / Excel `PERCENTILE.INC`: `idx = p*(n-1)`, `lo = Math.floor(idx)`, `frac = idx - lo`;
return `a[lo] + frac*(a[lo+1] - a[lo])`, guarding `lo === n-1`.

```js
engStats(sortedAsc) -> { min, max, mean, p10, p50, p80, p90 }
engHistogram(values, binCount) -> { bins: [{ x0, x1, count, density }], binWidth, min, max }
engCdfPoints(sortedAsc, maxPoints = 240) -> [{ x, p }]   // p in [0,1], ascending, thinned by rank
```
`density` = `count / (total * binWidth)`. `engHistogram` must handle a degenerate range
(`max === min`) without dividing by zero.

### 2.4 Schedule network

```js
engTopoOrder(tasks) -> [taskId, ...]       // Kahn's algorithm; throw Error on a cycle
engForwardPass(tasks, order, durations) -> { es: {id:num}, ef: {id:num}, projectDuration }
engBackwardPass(tasks, order, durations, ef, projectDuration) -> { lf: {}, ls: {}, float: {} }
```
`durations` is `{ taskId: days }`. Forward: `es = max(ef of preds)` (0 if none),
`ef = es + d`, `projectDuration = max(ef)`. Backward: `lf = min(ls of successors)`, or
`projectDuration` if the task has no successors; `ls = lf - d`; `float = ls - es`.
A task is **critical** when `float < 1e-6`.

### 2.5 Deterministic base-case evaluation

```js
engEvaluateBase(model, overrides) -> { duration, cost, es, ef, float, criticalIds }
```
Every input takes its **distribution mean** (`engDistMean`), except keys present in
`overrides` (`{ "dur:T2": 612.3 }`), which take the given value. Then run the forward and
backward pass, and compute
`cost = sum(fixed_i) + duration * sum(perDay_i)`. `overrides` defaults to `{}`.

### 2.6 The simulation

```js
engSimulate(model) -> Result
```
One pass of `model.iterations` iterations using a single `engMulberry32(model.seed)` stream.
Per iteration: sample every task duration, run the forward pass for `projectDuration`, run
the backward pass and tally which tasks are critical, sample every `fixed` and `perDay`
component, and compute `cost = sumFixed + duration*sumPerDay`. Store each input's sampled
value into a per-key `Float64Array` for the sensitivity analysis.

Use typed arrays (`Float64Array`) for `cost`, `duration` and every input series.

```js
Result = {
  n,
  cost:      Float64Array,     // per-iteration total cost, unsorted (iteration order)
  duration:  Float64Array,     // per-iteration project duration, unsorted
  costStats:     { min, max, mean, p10, p50, p80, p90 },
  durationStats: { min, max, mean, p10, p50, p80, p90 },
  costHist:     { bins, binWidth, min, max },
  durationHist: { bins, binWidth, min, max },
  costCdf:     [{x, p}],
  durationCdf: [{x, p}],
  criticality: [{ id, short, index }],        // index = share of iterations critical, 0..1
  base: { duration, cost, es, ef, float, criticalIds },   // engEvaluateBase(model, {})
  tornadoCost:     [TornadoRow, ...],         // sorted by |swing| descending
  tornadoDuration: [TornadoRow, ...],
  elapsedMs
}

TornadoRow = {
  key,            // "dur:T2"
  label,          // task/cost `short`
  kind,           // "duration" | "fixed" | "perDay"
  base,           // output value at the all-means base case
  low, high,      // output value with this input at its empirical P10 / P90
  swing,          // Math.abs(high - low)
  corr            // Spearman rank correlation of this input's samples vs the output, -1..1
}
```

**Tornado, swing method.** For each input key: take that input's **empirical** P10 and P90
from its stored sample array (sort a copy, use `engPercentile`) — do not attempt an
analytic PERT quantile. Then `low = engEvaluateBase(model, {key: p10}).X` and
`high = engEvaluateBase(model, {key: p90}).X`, where `X` is `cost` for `tornadoCost` and
`duration` for `tornadoDuration`.

`tornadoCost` includes **all** input keys (durations included — they move cost through the
per-day terms). `tornadoDuration` includes **only** `dur:` keys. Rows whose `swing` is
exactly 0 are still returned; the UI decides what to show.

**Tornado, correlation method.** `corr` = Spearman: rank both series ascending (average
ranks for ties), then Pearson correlation on the ranks. Compute it on the simulated samples.

```js
engSpearman(xs, ys) -> number    // exported, used by the QA pass
```

### 2.7 Performance

10,000 iterations with 5 tasks and 5 cost lines must complete in well under 200 ms. Do not
allocate objects inside the iteration loop; hoist arrays and reuse scratch buffers.

### 2.8 Test vectors — your implementation must reproduce these

At the very end of the file, attach the API for testing:
```js
window.__eng = { engMulberry32, engTriangularInv, engSamplePert, engSample, engDistMean,
                 engPercentile, engStats, engHistogram, engCdfPoints, engTopoOrder,
                 engForwardPass, engBackwardPass, engEvaluateBase, engSimulate, engSpearman };
```

- `engDistMean("triangular", 10, 20, 40)` === `23.3333...`
- `engDistMean("pert", 10, 20, 40)` === `21.6666...`
- `engTriangularInv(0.5, 10, 20, 40)` === `40 - Math.sqrt(300)` = `22.6795...`
- PERT(10,20,40) shapes: `alpha = 2.3333...`, `beta = 3.6666...`
- `engPercentile([1,2,3,4], 0.5)` === `2.5`
- Mean of 50,000 `engSample(rng,"triangular",10,20,40)` draws is within 1% of `23.333`
- Mean of 50,000 `engSample(rng,"pert",10,20,40)` draws is within 1% of `21.667`
- Schedule with the default network at fixed durations
  `T1=120, T2=490, T3=150, T4=95, T5=55` gives `projectDuration = 760`,
  `float.T3 = 340`, `float.T1 = float.T2 = float.T4 = float.T5 = 0`
- `engSimulate` called twice with the same model returns identical `costStats.p50`

---

## 3. `src/scenario.js` — data and formatters (prefix `scn`, plain JS)

### 3.1 The scenario

```js
scnDefaultScenario = { ... }     // exactly the Scenario shape in §1
```

**132 kV Substation Upgrade & Grid Interconnection** — a 40 MVA 132/33 kV transformer
addition at an existing distribution substation. `id: "substation-132kv"`,
`startDate: "2026-10-01"`.

`subtitle`: `"40 MVA 132/33 kV transformer addition — design through energisation"`

Tasks (durations in calendar days):

| id | name | short | preds | o | l | p |
|---|---|---|---|---|---|---|
| T1 | Detailed design, protection studies & permitting | Design & permitting | — | 90 | 120 | 210 |
| T2 | Power transformer & 132 kV switchgear procurement | Transformer procurement | T1 | 385 | 490 | 700 |
| T3 | Civil works, foundations & control building | Civil works | T1 | 110 | 150 | 240 |
| T4 | Transformer erection, switchgear install & P&C cabling | Erection & installation | T2, T3 | 70 | 95 | 160 |
| T5 | Commissioning, 87T/50-51 protection testing & energisation | Commissioning & energisation | T4 | 35 | 55 | 120 |

Cost lines (fixed in USD; perDay in USD/day):

| id | name | short | fixed o/l/p | perDay o/l/p |
|---|---|---|---|---|
| C1 | Power transformer & 132 kV switchgear supply | Transformer & switchgear | 7800000 / 8900000 / 11500000 | 800 / 1200 / 2400 |
| C2 | Civil works, foundations & control building | Civil works | 1900000 / 2400000 / 3600000 | 0 / 0 / 0 |
| C3 | Electrical installation, P&C and cabling labour | Installation labour | 2600000 / 3200000 / 4700000 | 0 / 0 / 0 |
| C4 | Commissioning, testing & utility witness fees | Commissioning & testing | 550000 / 800000 / 1400000 | 0 / 0 / 0 |
| C5 | Project management, site overhead, insurance & financing | PM & site overhead | 400000 / 600000 / 900000 | 2800 / 3600 / 5200 |

C1's per-day component is contract price escalation; C5's is time-related site overhead.

### 3.2 Slider bounds

```js
scnSliderBounds(scenario) -> { "dur:T1": {min, max, step}, "fix:C1": {...}, "day:C1": {...}, ... }
```
Derived **once from the baseline scenario** so sliders never rescale while dragging.
`min = 0` is wrong — use `min = round(0.5 * o)` and `max = round(1.8 * p)` for each input,
with `step` chosen so there are roughly 200 steps across the range, rounded to a sensible
increment (1 for days, 10000 for fixed costs, 50 for per-day rates). For an all-zero
`perDay`, still emit bounds `{min: 0, max: 2000, step: 25}` so the user can introduce a rate.

### 3.3 Formatters

```js
scnFmtMoney(v)      // 19632000 -> "$19.63M" ; 800000 -> "$0.80M"
scnFmtMoneyTick(v)  // axis ticks: 20000000 -> "$20M" ; 19500000 -> "$19.5M"
scnFmtRate(v)       // 3600 -> "$3.6k/d" ; 0 -> "—"
scnFmtDays(v)       // 762.4 -> "762 d"
scnFmtMonths(v)     // 762 -> "25.0 mo"
scnFmtPct(v)        // 0.873 -> "87%"
scnAddDays(isoDate, days) -> Date
scnFmtDate(isoDate, days)     // "2026-10-01", 760 -> "30 Oct 2028" (2028 is a leap year)
scnFmtDateTick(isoDate, days) // "2026-10-01", 760 -> "Oct 28"
```
All date maths in UTC to avoid timezone drift. Use fixed English month abbreviations, not
`toLocaleDateString`, so output is stable regardless of the viewer's locale.

At the end of the file: `window.__scn = { scnDefaultScenario, scnSliderBounds, scnFmtMoney, scnFmtMoneyTick, scnFmtRate, scnFmtDays, scnFmtMonths, scnFmtPct, scnAddDays, scnFmtDate, scnFmtDateTick };`

---

## 4. `src/charts.jsx` — SVG charts (prefix `Chart`, JSX)

No chart library. Hand-authored SVG only. Every chart is a pure function of its props — no
data fetching, no simulation, no global reads.

### 4.1 Shared conventions

- Root element is always `<svg viewBox={"0 0 " + W + " " + H} style={{width:'100%', height:'auto', display:'block'}} role="img">` with `W = 820` unless a prop overrides it.
- **Leave room in the viewBox for outermost labels.** Standard margins: left 64, right 24, top 18, bottom 40. Tornado charts need left 150 for category labels.
- Every drawn shape gets an explicit `fill` (or `fill="none"` plus `stroke`).
- Colors come **only** from these CSS variables, never literal hex:
  `--chart-surface`, `--chart-grid`, `--chart-axis`, `--ink-1`, `--ink-2`, `--ink-muted`,
  `--series-1` (primary blue), `--series-1-soft` (translucent blue fill),
  `--tor-low` (blue), `--tor-high` (red), `--accent` (copper), `--marker` (P-value rules).
- Chart text: `fill="var(--ink-muted)"`, `fontSize={11}`, and
  `style={{fontFamily:'var(--font-mono)', fontVariantNumeric:'tabular-nums'}}` on anything
  numeric. Axis tick labels 11px, axis titles 11px uppercase with `letterSpacing: '0.08em'`.
- Gridlines are hairlines: `stroke="var(--chart-grid)" strokeWidth={1}`.
- Bars get 4px rounded ends on the data end only; use a `<path>` with arc corners, or a
  `<rect rx={3}>` when simpler — but never round the baseline end of a tornado arm.
- Adjacent filled marks are separated by a 2px gap of surface.
- **Hover is required** on every chart. Render the tooltip as an SVG `<g>` inside the same
  svg (never an HTML overlay), so it scales with the viewBox. Tooltip: a
  `rect` with `fill="var(--chart-surface)"`, `stroke="var(--chart-axis)"`, `rx={4}`, plus
  1–3 `text` lines. Flip the tooltip to the other side of the cursor when it would overflow
  the right edge. Capture pointer events with one transparent `rect` over the plot area
  (`fill="transparent"`), and compute the hovered item from the x coordinate.
- Respect `prefers-reduced-motion`: no transitions if you add any.

### 4.2 `ChartDistribution`

```jsx
<ChartDistribution
  hist={{ bins, binWidth, min, max }}   // from result.costHist / result.durationHist
  markers={[{ label: "P50", x: 19630000 }, { label: "P80", x: ... }, { label: "P90", x: ... }]}
  formatX={fn}          // number -> string, for ticks and tooltip
  formatCount={fn}      // optional; default: (c) => c.toLocaleString() + " runs"
  xTitle="TOTAL COST"
  height={230}
/>
```
Histogram of `bins` as vertical bars from the baseline, y = `count`. ~6 x-ticks, ~4 y-ticks,
horizontal gridlines only. Each marker is a **vertical rule** in `var(--marker)` (dashed,
`strokeDasharray="4 3"`) with its label in a small filled chip at the top of the plot, laid
out so the three chips never overlap (nudge horizontally when they would collide). Hovering
a bar highlights it and shows a tooltip with the bin range and its count.

### 4.3 `ChartSCurve`

```jsx
<ChartSCurve
  points={[{x, p}, ...]}     // ascending, p in 0..1
  markers={[{ label: "P50", x, p: 0.5 }, ...]}
  formatX={fn}
  xTitle="COMPLETION DATE"
  height={230}
/>
```
Cumulative probability curve: a 2px `var(--series-1)` polyline with a soft
`var(--series-1-soft)` area beneath it. Y axis is 0–100% with ticks at 0/25/50/75/100 and
horizontal gridlines. Each marker draws an L-shaped leader (horizontal from the y axis to
the curve, then vertical down to the x axis) in `var(--marker)`, with an 8px dot at the
curve and the label beside it. A crosshair on hover reads out `(x, p)`.

### 4.4 `ChartTornado`

```jsx
<ChartTornado
  rows={[TornadoRow, ...]}   // pre-sorted desc by swing; render at most `maxRows`
  base={number}              // the base-case output value; the centre line
  mode="swing"               // "swing" | "corr"
  formatX={fn}
  xTitle="TOTAL COST"
  maxRows={8}
  height={null}              // when null, derive: 44 + rows.length*30
/>
```
Classic tornado. One row per input, widest at the top. In `swing` mode each row draws two
horizontal arms from the vertical base line: `base -> low` in `var(--tor-low)` and
`base -> high` in `var(--tor-high)`; the row's category label sits in the left margin
(`var(--ink-2)`, 11px, truncated with a trailing ellipsis past ~22 chars), and the swing
magnitude is direct-labelled at the end of the longer arm in `var(--ink-muted)`. Draw the
base line in `var(--chart-axis)` with the base value labelled beneath the axis.

In `corr` mode the x scale is fixed to −1..1, each row is a single bar from 0 to `corr`
(blue when positive, red when negative — use `--tor-low`/`--tor-high`), and the x axis is
labelled "RANK CORRELATION". Ticks at −1, −0.5, 0, 0.5, 1.

Hovering a row shows a tooltip with the label, low, base, high and correlation.

### 4.5 `ChartCriticality`

```jsx
<ChartCriticality items={[{ id, short, index }]} formatPct={fn} height={null} />
```
A compact horizontal bar per task, 0–100%, bar fill `var(--series-1)` at an opacity that
tracks `index` (floor 0.25 so a near-zero bar is still visible), with the task `short` on
the left and the percentage direct-labelled on the right in mono figures. This is an
ordinal readout, not a distribution — keep it visually quieter than the main charts.

---

## 5. `src/panel.jsx` — input controls (prefix `Panel`, JSX)

### 5.1 `PanelThreePoint` — the core control

```jsx
<PanelThreePoint
  label="Duration (days)"
  value={{ o, l, p }}
  bounds={{ min, max, step }}
  format={fn}                 // number -> string, for the three readouts
  onChange={(next) => {}}     // next = { o, l, p }, always already clamped
  accentClass=""              // optional extra className for the track
/>
```
Three `<input type="range">` sliders stacked — optimistic, likely, pessimistic — each with
its label on the left and its formatted value on the right in mono figures.

**Clamping is the whole job of this component.** The invariant `o <= l <= p` must always
hold, and it is maintained by **pushing neighbours, never by refusing the user's input**:
- moving `o` above `l` pushes `l` up, and pushes `p` up if `l` passes it
- moving `p` below `l` pushes `l` down, and pushes `o` down if `l` passes it
- moving `l` below `o` pushes `o` down; moving `l` above `p` pushes `p` up

Emit one `onChange` with the complete, already-clamped `{o, l, p}`.

Style the sliders with a class (`panel-range`) — the page stylesheet already styles
`input[type=range].panel-range`; do not write inline slider styling or your own thumb CSS.

### 5.2 `PanelTaskRow`

```jsx
<PanelTaskRow
  task={Task}
  bounds={{min, max, step}}       // the "dur:<id>" bounds
  criticality={0.97}              // 0..1, may be undefined on first render
  onChange={(patch) => {}}        // patch = { o, l, p }
  formatDays={fn}
  formatPct={fn}
/>
```
Header line: the task `short` in the label face, its `id` as a small monospace chip, and a
criticality chip on the right reading e.g. `97% critical`. Give the chip a state style: use
class `chip-crit-high` when `criticality >= 0.5`, `chip-crit-low` otherwise (both already
exist in the stylesheet). Below the header, one `PanelThreePoint` for the duration.
Show the predecessors as small muted text (`after T2, T3`, or `starts immediately`).

### 5.3 `PanelCostRow`

```jsx
<PanelCostRow
  cost={CostLine}
  boundsFixed={{min,max,step}}
  boundsPerDay={{min,max,step}}
  onChange={(patch) => {}}        // patch = { fixed?: {o,l,p}, perDay?: {o,l,p} }
  formatMoney={fn}
  formatRate={fn}
/>
```
Header line: cost `short` plus its `id` chip. Then a `PanelThreePoint` for the fixed
component. The per-day component sits behind a small disclosure toggle ("time-related cost"
/ the current rate when non-zero) so the rail is not overwhelming — expanded by default
only when the line's `perDay.l > 0`.

### 5.4 `PanelControls`

```jsx
<PanelControls
  settings={Settings}
  onChange={(patch) => {}}        // partial Settings
  onReset={() => {}}
  onResample={() => {}}
  elapsedMs={number}
/>
```
- iterations: a range slider 1000..50000 step 1000, with the value shown as `10,000 runs`
- distribution: a two-option segmented control, `PERT` / `Triangular`
- buttons: `Reset to baseline` (secondary) and `Resample` (secondary)
- a muted line reading e.g. `10,000 runs · 41 ms`

Use the existing stylesheet classes: `.seg`, `.seg-btn`, `.seg-btn.is-on`, `.btn`,
`.btn-secondary`, `.control-label`, `.muted`. Do not invent a new visual language.

### 5.5 Rules

- All components are controlled — never hold a copy of the value in local state, except
  transient UI state such as whether the per-day disclosure is open.
- Every `<input type="range">` needs an accessible label (`aria-label`).
- No `useEffect` anywhere in this file.

---

## 6. What the page (written separately) will do

For reference only — do not write this.

```jsx
const [scenario, setScenario] = React.useState(scnDefaultScenario);
const [settings, setSettings] = React.useState({iterations:10000, seed:20261001, distribution:"pert", bins:40});
const deferred = React.useDeferredValue(scenario);
const result = React.useMemo(() => engSimulate({...deferred, ...settings}), [deferred, settings]);
```
Charts receive `result.costHist`, `result.costCdf`, `result.tornadoCost`, etc.
