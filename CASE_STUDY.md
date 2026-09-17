# Case study: Substation Risk Simulator

**Live model:** https://aymankhayat.github.io/substation-risk-simulator/
**Code:** https://github.com/aymankhayat/substation-risk-simulator
**Designed and built by** Ayman Khayat, with AI-assisted development.

---

## Problem

Capital projects are usually approved on a single-number estimate. For the example project in this simulator, a 40 MVA 132/33 kV transformer addition at an existing substation, adding up the most-likely values gives **$19.55M** and energisation on **30 Oct 2028**.

That number hides the three things a sponsor actually needs:

1. **How likely it is.** Ranges skew late and expensive, so the most-likely total is optimistic.
2. **How much contingency to hold** to be, say, 80% confident on cost and schedule.
3. **Which risks drive the result**, so management attention goes where it changes the outcome.

The example data (5 activities, 5 cost lines, 3 correlated pairs) is realistic but illustrative, not taken from a real project.

## Approach

A Monte Carlo cost and schedule risk model that runs entirely in the browser.

| Area | What it does |
|---|---|
| Estimates | Every activity duration and cost is a three-point range, sampled as Beta-PERT (default) or triangular |
| Schedule | The activity network is solved on every run with a forward and backward pass, giving a completion date and a criticality index per activity |
| Cost | Total cost = fixed costs + project duration × per-day rates (site overhead, price escalation), so schedule slip becomes cost risk |
| Correlation | Iman–Conover rank reordering with van der Waerden scores links estimates that move together while keeping each input's own distribution |
| Outputs | P10 / P50 / P80 / P90, contingency over the point estimate, the joint probability of meeting both P80s, and tornado charts (P10–P90 swing and Spearman rank correlation) |
| Reproducibility | Seeded mulberry32 random numbers: the same inputs and seed always give the same result |

**Validation.** The engine was checked against closed-form results before any chart was trusted:

- Triangular(10, 20, 40): mean 23.333, median 40 − √300 = 22.6795
- Beta-PERT(10, 20, 40): mean 21.667, shape parameters α = 2.333 and β = 3.667; sampled means over 50,000 draws land within 0.2% of the exact values
- The default activity network at fixed durations (120 / 490 / 150 / 95 / 55 days) solves to 760 days, with 340 days of float on civil works and zero on every other activity

## Engineering challenges

### 1. Re-running 10,000 futures while you drag

- **Problem:** the first engine took about 554 ms for 10,000 runs and 4.5 s for 50,000, so slider drags stuttered. Profiling showed most of the time in JavaScript-comparator sorts and in re-ranking the same output series for every input.
- **Fix:** native typed-array sorts with binary-search ranks shared by both tornado charts; sensitivity measured on the first 10,000 runs; Beta-PERT sampled from a cached 2,048-point inverse-CDF table instead of two gamma draws per sample.
- **Result:** 10,000 runs in about 173 ms (3.2× faster) and 50,000 runs in about 0.33 s, measured in Chromium during development.

### 2. Correlated risks without bending the inputs

- **Problem:** sampling every estimate independently understates the tail. A tight transformer market makes the unit both more expensive and later.
- **Fix:** Iman–Conover reordering. Only the pairing between inputs changes; every input keeps its own distribution.
- **Result:** achieved rank correlations of 0.501, 0.603 and 0.403 against targets of 0.5, 0.6 and 0.4. With correlation switched off the engine reproduces the independent P80 of $21,393,208 exactly. With it on, P90 rises by $0.24M while the mean stays at $20.56M.

### 3. Charts that stay legible in any card

- **Problem:** every chart drew into a fixed 820-unit canvas and was scaled down into cards 270–500 px wide, so 11 px labels rendered 4–7 px tall.
- **Fix:** each chart measures its container and draws at 1:1, with tick counts and label columns that adapt to the width.
- **Result:** labels render at their true 11 px from phone to desktop.

### 4. An activity network that fits its card

- **Problem:** on a 1440 px desktop the network needed about 506 px, but its half-width card offered about 482 px, so the final activity hid behind a horizontal scroll.
- **Fix:** the network spans the full row, with the criticality index below it (commit `ef1e6f0`).
- **Result:** all five activities fit with their full names.

## Result

Default scenario: seed 20261001, 10,000 runs, Beta-PERT, correlations on.

| | Point estimate | P50 | P80 | P90 |
|---|---|---|---|---|
| Total cost | $19.55M | $20.50M | $21.54M | $22.12M |
| Energisation | 30 Oct 2028 | 7 Dec 2028 | 7 Feb 2029 | 11 Mar 2029 |

- **Contingency to reach P80:** +$2.00M and +100 days over the point estimate.
- **Both P80 targets at once:** met in 70% of runs. Each P80 holds on its own; together they are less likely.
- **Largest cost driver:** the transformer and switchgear supply price, with a $1.77M P10–P90 swing.
- **Schedule shows up in cost:** transformer procurement time is the fifth-largest cost driver ($0.79M), purely through per-day overhead and escalation.
- **Critical path:** transformer procurement is critical in 100% of runs; civil works in 0%.

## Limits

- Discrete risk events (for example a failed factory acceptance test on the transformer) are not modelled.
- Durations are calendar days, with no working calendar.
- Swing tornado bars move one input at a time and so ignore correlation; the rank-correlation view includes it.

## Stack

React 18 (UMD) with in-browser JSX via Babel Standalone, no build step; hand-written SVG charts and line illustrations; a plain JavaScript simulation engine; hosted on GitHub Pages.
