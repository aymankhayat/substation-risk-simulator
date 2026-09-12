const AppSettingsBaseline = { iterations: 10000, seed: 20261001, distribution: "pert", bins: 40, correlate: true };
const AppAuthor = { name: "Ayman Khayat", linkedin: "https://www.linkedin.com/in/ayman-khayat-350b4b335" };
const AppRepo = "https://github.com/aymankhayat/substation-risk-simulator";
const AppMono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" };
const AppDisplay = { fontFamily: "var(--font-display)", fontWeight: 600 };

const AppUnitDays = { suffix: "d", toInput: (v) => String(Math.round(v)), fromInput: (s) => Math.round(Number(s)) };
const AppUnitMoney = { suffix: "M", toInput: (v) => (v / 1e6).toFixed(2), fromInput: (s) => Math.round(Number(s) * 1e6) };
const AppUnitRate = { suffix: "k/d", toInput: (v) => (v / 1000).toFixed(1), fromInput: (s) => Math.round(Number(s) * 1000) };
const AppRangeDays = (o, p) => scnRangeFor("days", o, p);
const AppRangeMoney = (o, p) => scnRangeFor("money", o, p);
const AppRangeRate = (o, p) => scnRangeFor("rate", o, p);

function AppLikelyOverrides(model) {
  const o = {};
  for (const t of model.tasks) o["dur:" + t.id] = t.l;
  for (const c of model.costs) {
    o["fix:" + c.id] = c.fixed.l;
    o["day:" + c.id] = c.perDay.l;
  }
  return o;
}

function AppJointP80(r) {
  const cp = r.costStats.p80;
  const dp = r.durationStats.p80;
  let hit = 0;
  for (let i = 0; i < r.n; i++) {
    if (r.cost[i] <= cp && r.duration[i] <= dp) hit++;
  }
  return hit / r.n;
}

function AppMarkers(stats) {
  return [
    { label: "P50", x: stats.p50, p: 0.5 },
    { label: "P80", x: stats.p80, p: 0.8 },
    { label: "P90", x: stats.p90, p: 0.9 },
  ];
}

function AppSigned(v, fmt) {
  return (v < 0 ? "−" : "+") + fmt(Math.abs(v));
}

function AppWrapLabel(text, max) {
  if (text.length <= max) return [text];
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

function AppMeasure({ children }) {
  const ref = React.useRef(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    const update = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className="measure">{width > 0 ? children(width) : null}</div>;
}

function AppFigure({ num, title, note, children }) {
  return (
    <figure className="fig">
      <figcaption className="fig-head">
        <span className="fig-num">Fig. {num}</span>
        <span className="fig-title">{title}</span>
      </figcaption>
      {children}
      {note ? <p className="fig-note">{note}</p> : null}
    </figure>
  );
}

function AppVerdict({ r, point, start }) {
  const cs = r.costStats;
  const ds = r.durationStats;
  const joint = AppJointP80(r);
  const rows = [
    { label: "Total cost", fmt: scnFmtMoney, point: point.cost, s: cs },
    { label: "Completion date", fmt: (d) => scnFmtDate(start, d), point: point.duration, s: ds },
    { label: "Duration", fmt: (d) => scnFmtDays(d) + " · " + scnFmtMonths(d), point: point.duration, s: ds },
  ];
  return (
    <section className="verdict" aria-label="Confidence levels">
      <div className="verdict-figures">
        <div className="vf">
          <span className="vf-label">P80 completion</span>
          <span className="vf-value">{scnFmtDate(start, ds.p80)}</span>
          <span className="vf-delta">
            {AppSigned(ds.p80 - point.duration, scnFmtDays)} of schedule contingency over the point estimate
          </span>
        </div>
        <div className="vf">
          <span className="vf-label">P80 total cost</span>
          <span className="vf-value">{scnFmtMoney(cs.p80)}</span>
          <span className="vf-delta">
            {AppSigned(cs.p80 - point.cost, scnFmtMoney)} of cost contingency over the point estimate
          </span>
        </div>
        <div className="vf vf-joint">
          <span className="vf-label">Both P80 targets met</span>
          <span className="vf-value">{scnFmtPct(joint)}</span>
          <span className="vf-delta">
            of runs land inside both at once. Each P80 is an 80% level on its own, not together.
          </span>
        </div>
      </div>
      <div className="table-wrap">
        <table className="ptable">
          <thead>
            <tr>
              <th scope="col"><span className="sr">Measure</span></th>
              <th scope="col">Point estimate</th>
              <th scope="col">P10</th>
              <th scope="col">P50</th>
              <th scope="col" className="is-p80">P80</th>
              <th scope="col">P90</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.fmt(row.point)}</td>
                <td>{row.fmt(row.s.p10)}</td>
                <td>{row.fmt(row.s.p50)}</td>
                <td className="is-p80">{row.fmt(row.s.p80)}</td>
                <td>{row.fmt(row.s.p90)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="verdict-note">
        The point estimate uses every most-likely value. It lands below P50 because the ranges skew late and
        expensive, and wherever two paths merge the later one always governs. P80 is the usual funding level
        for a sanctioned capital project.
      </p>
    </section>
  );
}

function AppNetwork({ tasks, crit, width }) {
  const nodeH = 60;
  const pad = 12;
  const gapX = 22;
  const gapY = 20;
  const order = engTopoOrder(tasks);
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const level = {};
  for (const id of order) {
    const preds = byId[id].preds;
    level[id] = preds.length ? Math.max(...preds.map((p) => level[p])) + 1 : 0;
  }
  const depth = Math.max(...order.map((id) => level[id])) + 1;
  const cols = Array.from({ length: depth }, () => []);
  for (const id of order) cols[level[id]].push(id);
  const W = Math.max(width, 320, depth * 104 + (depth - 1) * gapX + 2 * pad);
  const maxStack = Math.max(...cols.map((c) => c.length));
  const H = Math.max(196, maxStack * (nodeH + gapY) - gapY + 48);
  const nodeW = Math.min(176, (W - 2 * pad - (depth - 1) * gapX) / depth);
  const maxChars = Math.max(8, Math.floor((nodeW - 18) / 6.4));
  const stepX = depth > 1 ? (W - 2 * pad - nodeW) / (depth - 1) : 0;
  const pos = {};
  cols.forEach((ids, li) =>
    ids.forEach((id, i) => {
      pos[id] = { x: pad + li * stepX, y: (H - nodeH) / 2 + (i - (ids.length - 1) / 2) * (nodeH + gapY) };
    })
  );
  const edges = [];
  for (const t of tasks) {
    for (const p of t.preds) edges.push({ key: p + "-" + t.id, from: p, to: t.id, w: Math.min(crit[p] ?? 0, crit[t.id] ?? 0) });
  }
  edges.sort((a, b) => a.w - b.w);
  const scrolls = W > width;

  return (
    <div className="net-scroll">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: scrolls ? W + "px" : "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Activity network with the critical path highlighted"
      >
        {edges.map((e) => {
          const a = pos[e.from];
          const b = pos[e.to];
          const sx = a.x + nodeW;
          const sy = a.y + nodeH / 2;
          const tx = b.x;
          const ty = b.y + nodeH / 2;
          const mx = (sx + tx) / 2;
          const hot = e.w >= 0.5;
          return (
            <path
              key={e.key}
              d={`M${sx},${sy} H${mx} V${ty} H${tx}`}
              fill="none"
              strokeLinejoin="round"
              strokeDasharray={hot ? undefined : "4 3"}
              style={{ stroke: hot ? "var(--crit)" : "var(--chart-axis)", strokeWidth: hot ? 1.5 + 2.5 * e.w : 1.25 }}
            />
          );
        })}
        {order.map((id) => {
          const t = byId[id];
          const p = pos[id];
          const c = crit[id] ?? 0;
          const hot = c >= 0.5;
          const lines = AppWrapLabel(t.short, maxChars);
          return (
            <g key={id}>
              <rect
                x={p.x}
                y={p.y}
                width={nodeW}
                height={nodeH}
                rx={3}
                style={{ fill: "var(--surface)", stroke: hot ? "var(--crit)" : "var(--line-strong)", strokeWidth: hot ? 2 : 1 }}
              />
              <text x={p.x + 10} y={p.y + 16} fontSize={10.5} style={{ ...AppMono, fill: "var(--ink-muted)" }}>{id}</text>
              <text x={p.x + nodeW - 10} y={p.y + 16} fontSize={10.5} textAnchor="end" style={{ ...AppMono, fill: hot ? "var(--crit-ink)" : "var(--ink-muted)" }}>
                {scnFmtPct(c)}
              </text>
              {lines.map((ln, i) => (
                <text key={i} x={p.x + 10} y={p.y + (lines.length === 1 ? 41 : 34 + i * 15)} fontSize={12.5} style={{ ...AppDisplay, fill: "var(--ink-1)" }}>
                  {ln}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function App() {
  const [scenario, setScenario] = React.useState(scnDefaultScenario);
  const [settings, setSettings] = React.useState(AppSettingsBaseline);
  const [tornadoMode, setTornadoMode] = React.useState("swing");
  const [resetCount, setResetCount] = React.useState(0);
  const dScenario = React.useDeferredValue(scenario);
  const dSettings = React.useDeferredValue(settings);
  const stale = dScenario !== scenario || dSettings !== settings;
  const model = React.useMemo(() => ({ ...dScenario, ...dSettings }), [dScenario, dSettings]);
  const r = React.useMemo(() => engSimulate(model), [model]);
  const point = React.useMemo(() => engEvaluateBase(model, AppLikelyOverrides(model)), [model]);
  const crit = React.useMemo(() => Object.fromEntries(r.criticality.map((c) => [c.id, c.index])), [r]);
  const joint = React.useMemo(() => AppJointP80(r), [r]);
  const achieved = React.useMemo(
    () => Object.fromEntries((r.appliedCorrelations || []).map((c) => [c.id, c.achieved])),
    [r]
  );
  const inputOptions = React.useMemo(() => scnInputOptions(scenario), [scenario]);
  const taskRefs = React.useMemo(() => scenario.tasks.map((t) => ({ id: t.id, short: t.short })), [scenario.tasks]);
  const allowedPreds = React.useMemo(() => {
    const out = {};
    for (const t of scenario.tasks) {
      const desc = scnDescendants(scenario.tasks, t.id);
      out[t.id] = scenario.tasks.filter((x) => x.id !== t.id && !desc.has(x.id)).map((x) => x.id);
    }
    return out;
  }, [scenario.tasks]);

  const start = scenario.startDate;
  const fmtDateTick = (d) => scnFmtDateTick(start, d);
  const costMarkers = AppMarkers(r.costStats);
  const durMarkers = AppMarkers(r.durationStats);
  const pairCount = scenario.correlations.length;

  const updateTask = (id, patch) =>
    setScenario((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const updateCost = (id, patch) =>
    setScenario((s) => ({ ...s, costs: s.costs.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const addTask = () => setScenario((s) => ({ ...s, tasks: [...s.tasks, scnNewTask(s)] }));
  const removeTask = (id) =>
    setScenario((s) => ({
      ...s,
      tasks: s.tasks.filter((t) => t.id !== id).map((t) => ({ ...t, preds: t.preds.filter((p) => p !== id) })),
      correlations: s.correlations.filter((c) => c.a !== "dur:" + id && c.b !== "dur:" + id),
    }));
  const addCost = () => setScenario((s) => ({ ...s, costs: [...s.costs, scnNewCost(s)] }));
  const removeCost = (id) =>
    setScenario((s) => ({
      ...s,
      costs: s.costs.filter((c) => c.id !== id),
      correlations: s.correlations.filter((c) => ![c.a, c.b].some((k) => k === "fix:" + id || k === "day:" + id)),
    }));
  const addCorrelation = () => setScenario((s) => ({ ...s, correlations: [...s.correlations, scnNewCorrelation(s)] }));
  const updateCorrelation = (id, patch) =>
    setScenario((s) => ({ ...s, correlations: s.correlations.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const removeCorrelation = (id) =>
    setScenario((s) => ({ ...s, correlations: s.correlations.filter((c) => c.id !== id) }));
  const updateProject = (patch) =>
    setScenario((s) => ({ ...s, ...patch, subtitle: "name" in patch ? "" : s.subtitle }));
  const reset = () => {
    setScenario(scnDefaultScenario);
    setSettings(AppSettingsBaseline);
    setTornadoMode("swing");
    setResetCount((n) => n + 1);
  };
  const resample = () => setSettings((s) => ({ ...s, seed: (s.seed * 48271) % 2147483647 }));

  return (
    <div className="site">
      <HeroNav githubUrl={AppRepo} author={AppAuthor.name} />
      <HeroSection r={r} point={point} joint={joint} scenario={scenario} settings={settings} githubUrl={AppRepo} />
      <HeroFeatures />
      <section className="model" id="model" aria-labelledby="model-title">
        <div className="model-intro">
          <p className="eyebrow">Live model</p>
          <h2 className="model-title" id="model-title">Every number below is live</h2>
          <p className="model-sub">Drag any estimate, switch the distribution or link inputs, and the simulation reruns as you go.</p>
        </div>
    <div className="app">
      <header className="masthead">
        <div>
          <p className="eyebrow">Monte Carlo cost &amp; schedule risk</p>
          <h2 className="mast-title">{scenario.name || "Untitled project"}</h2>
          {scenario.subtitle ? <p className="mast-sub">{scenario.subtitle}</p> : null}
        </div>
        <dl className="titleblock">
          <div><dt>Start</dt><dd>{scnFmtDate(start, 0)}</dd></div>
          <div><dt>Scope</dt><dd>{scenario.tasks.length} activities · {scenario.costs.length} costs</dd></div>
          <div><dt>Distribution</dt><dd>{settings.distribution === "pert" ? "Beta-PERT" : "Triangular"}</dd></div>
          <div><dt>Correlation</dt><dd>{settings.correlate && pairCount ? (pairCount === 1 ? "1 pair" : pairCount + " pairs") : "Off"}</dd></div>
          <div><dt>Runs</dt><dd>{r.n.toLocaleString("en-US")}</dd></div>
          <div><dt>Seed</dt><dd>{settings.seed}</dd></div>
          <div><dt>Compute</dt><dd>{r.elapsedMs >= 1 ? Math.round(r.elapsedMs) + " ms" : "—"}</dd></div>
          <div><dt>Status</dt><dd className={stale ? "is-stale" : ""}>{stale ? "Recalculating" : "Current"}</dd></div>
          <div className="tb-sign">
            <dt>Designed by</dt>
            <dd className="tb-sign-name">{AppAuthor.name}</dd>
            <dd className="tb-sign-link">
              <a href={AppAuthor.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
            </dd>
          </div>
        </dl>
      </header>

      <div className="layout">
        <aside className="rail" aria-label="Estimates">
          <section className="rail-sec">
            <h2 className="rail-h">Project</h2>
            <PanelProject name={scenario.name} startDate={scenario.startDate} onChange={updateProject} />
          </section>
          <section className="rail-sec">
            <h2 className="rail-h">Simulation</h2>
            <PanelControls
              settings={settings}
              onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
              onReset={reset}
              onResample={resample}
              elapsedMs={r.elapsedMs}
            />
          </section>
          <section className="rail-sec">
            <h2 className="rail-h">Activities <span className="rail-unit">calendar days</span></h2>
            {scenario.tasks.map((t) => (
              <PanelTaskRow
                key={t.id + ":" + resetCount}
                task={t}
                allTasks={taskRefs}
                allowedPreds={allowedPreds[t.id]}
                criticality={crit[t.id]}
                canRemove={scenario.tasks.length > 1}
                onChange={(patch) => updateTask(t.id, patch)}
                onRemove={() => removeTask(t.id)}
                rangeFor={AppRangeDays}
                unit={AppUnitDays}
                formatDays={scnFmtDays}
                formatPct={scnFmtPct}
              />
            ))}
            <button type="button" className="btn btn-add" onClick={addTask}>+ Add activity</button>
          </section>
          <section className="rail-sec">
            <h2 className="rail-h">Cost lines <span className="rail-unit">US$</span></h2>
            {scenario.costs.map((c) => (
              <PanelCostRow
                key={c.id + ":" + resetCount}
                cost={c}
                canRemove={scenario.costs.length > 1}
                onChange={(patch) => updateCost(c.id, patch)}
                onRemove={() => removeCost(c.id)}
                rangeFixed={AppRangeMoney}
                rangePerDay={AppRangeRate}
                unitMoney={AppUnitMoney}
                unitRate={AppUnitRate}
                formatMoney={scnFmtMoney}
                formatRate={scnFmtRate}
              />
            ))}
            <button type="button" className="btn btn-add" onClick={addCost}>+ Add cost line</button>
          </section>
          <section className="rail-sec">
            <h2 className="rail-h">Correlations <span className="rail-unit">rank ρ</span></h2>
            <PanelCorrelations
              correlations={scenario.correlations}
              options={inputOptions}
              achieved={achieved}
              enabled={settings.correlate}
              onToggle={(v) => setSettings((s) => ({ ...s, correlate: v }))}
              onChange={updateCorrelation}
              onRemove={removeCorrelation}
              onAdd={addCorrelation}
              formatRho={scnFmtRho}
            />
          </section>
        </aside>

        <main className={"canvas" + (stale ? " is-stale" : "")}>
          <AppVerdict r={r} point={point} start={start} />

          <section className="block">
            <header className="block-head">
              <h2>Total cost</h2>
              <p>Includes per-day costs, so a late project is also an expensive one.</p>
            </header>
            <div className="pair">
              <AppFigure num={1} title="Distribution of total cost">
                <AppMeasure>{(w) => <ChartDistribution width={w} hist={r.costHist} markers={costMarkers} formatX={scnFmtMoneyTick} xTitle="TOTAL COST (US$)" height={230} />}</AppMeasure>
              </AppFigure>
              <AppFigure num={2} title="Chance of finishing at or under a budget">
                <AppMeasure>{(w) => <ChartSCurve width={w} points={r.costCdf} markers={costMarkers} formatX={scnFmtMoneyTick} xTitle="TOTAL COST (US$)" height={230} />}</AppMeasure>
              </AppFigure>
            </div>
          </section>

          <section className="block">
            <header className="block-head">
              <h2>Completion</h2>
              <p>For the default scenario, completion is the day the new transformer is energised and handed over.</p>
            </header>
            <div className="pair">
              <AppFigure num={3} title="Distribution of completion date">
                <AppMeasure>{(w) => <ChartDistribution width={w} hist={r.durationHist} markers={durMarkers} formatX={fmtDateTick} xTitle="COMPLETION DATE" height={230} />}</AppMeasure>
              </AppFigure>
              <AppFigure num={4} title="Chance of completing by a date">
                <AppMeasure>{(w) => <ChartSCurve width={w} points={r.durationCdf} markers={durMarkers} formatX={fmtDateTick} xTitle="COMPLETION DATE" height={230} />}</AppMeasure>
              </AppFigure>
            </div>
          </section>

          <section className="block">
            <header className="block-head">
              <h2>Risk drivers</h2>
              <div className="seg" role="group" aria-label="Sensitivity method">
                <button type="button" className={"seg-btn" + (tornadoMode === "swing" ? " is-on" : "")} aria-pressed={tornadoMode === "swing"} onClick={() => setTornadoMode("swing")}>
                  Swing P10–P90
                </button>
                <button type="button" className={"seg-btn" + (tornadoMode === "corr" ? " is-on" : "")} aria-pressed={tornadoMode === "corr"} onClick={() => setTornadoMode("corr")}>
                  Rank correlation
                </button>
              </div>
            </header>
            {tornadoMode === "swing" ? (
              <div className="legend">
                <span><i className="swatch swatch-low"></i>Input at its own P10</span>
                <span><i className="swatch swatch-high"></i>Input at its own P90</span>
                <span className="muted">one input at a time, every other input at its mean</span>
              </div>
            ) : (
              <div className="legend">
                <span><i className="swatch swatch-high"></i>Higher input, higher result</span>
                <span><i className="swatch swatch-low"></i>Higher input, lower result</span>
                <span className="muted">all inputs varying at once, correlations included</span>
              </div>
            )}
            <div className="pair">
              <AppFigure num={5} title="What moves total cost" note="Activity durations appear here because site overhead and price escalation are charged per day.">
                <AppMeasure>{(w) => <ChartTornado width={w} rows={r.tornadoCost} base={r.base.cost} mode={tornadoMode} formatX={scnFmtMoney} xTitle="TOTAL COST (US$)" maxRows={8} />}</AppMeasure>
              </AppFigure>
              <AppFigure num={6} title="What moves completion" note="An activity with plenty of float barely moves the finish, however uncertain it is.">
                <AppMeasure>{(w) => <ChartTornado width={w} rows={r.tornadoDuration} base={r.base.duration} mode={tornadoMode} formatX={scnFmtDays} xTitle="PROJECT DURATION (DAYS)" maxRows={Math.min(8, scenario.tasks.length)} />}</AppMeasure>
              </AppFigure>
            </div>
          </section>

          <section className="block">
            <header className="block-head">
              <h2>Critical path</h2>
              <p>Copper marks the path that governs completion in most runs.</p>
            </header>
            <div className="pair pair-wide">
              <AppFigure num={7} title="Activity network" note="Each figure is the share of runs in which that activity is critical. Solid copper links sit on the critical path in at least half of all runs; dashed links carry float.">
                <AppMeasure>{(w) => <AppNetwork width={w} tasks={scenario.tasks} crit={crit} />}</AppMeasure>
              </AppFigure>
              <AppFigure num={8} title="Criticality index" note="Share of runs in which each activity had zero float.">
                <AppMeasure>{(w) => <ChartCriticality width={w} items={r.criticality} formatPct={scnFmtPct} />}</AppMeasure>
              </AppFigure>
            </div>
          </section>

          <section className="block">
            <header className="block-head">
              <h2 id="method">How the numbers are made</h2>
            </header>
            <dl className="method">
              <div>
                <dt>Estimates</dt>
                <dd>Every activity and cost is a three-point range. Beta-PERT weights the most-likely value four times as heavily as the extremes; Triangular gives the tails more weight and is the more cautious choice.</dd>
              </div>
              <div>
                <dt>Schedule</dt>
                <dd>Each run samples every duration and re-solves the network: an activity starts when its last predecessor finishes. The critical path can change from run to run, which Fig. 8 counts.</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>Total cost is the fixed costs plus each per-day rate multiplied by that run's project duration. This is how schedule risk becomes cost risk.</dd>
              </div>
              <div>
                <dt>Correlation</dt>
                <dd>Linked inputs are paired with the Iman–Conover method: sampled values are reordered so each pair's rank correlation matches its target, while every input keeps its own distribution. The achieved value is shown beside each pair.</dd>
              </div>
              <div>
                <dt>Drivers</dt>
                <dd>Swing moves one input from its own P10 to its P90 with everything else at its mean, so it ignores correlation. Rank correlation shows how closely each input tracks the result with everything varying together, correlations included. Both use the first 10,000 runs.</dd>
              </div>
              <div>
                <dt>Confidence levels</dt>
                <dd>P80 means 80% of runs finished at or under that value. The cost and date P80s are separate statements; the joint figure above is the chance of meeting both.</dd>
              </div>
              <div>
                <dt>Limits</dt>
                <dd>Discrete risk events, such as a failed factory acceptance test on the transformer, are not modelled. Durations are calendar days with no working calendar.</dd>
              </div>
            </dl>
            <p className="foot">
              <span>
                Designed and built by{" "}
                <a href={AppAuthor.linkedin} target="_blank" rel="noopener noreferrer">{AppAuthor.name}</a>
              </span>
              <span>Everything runs in your browser. Changes to the estimates stay on this page and are not saved.</span>
            </p>
          </section>
        </main>
      </div>
    </div>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
