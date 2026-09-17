function HeroClamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function HeroKindWord(kind) {
  if (kind === "duration") return "duration";
  if (kind === "fixed") return "fixed cost";
  return "per-day cost";
}

function HeroShortLabel(scenario, key) {
  const opt = scnInputOptions(scenario).find((o) => o.key === key);
  if (!opt) return key;
  const parts = opt.label.split(" · ");
  return parts.length > 1 ? parts.slice(1).join(" · ") : opt.label;
}

function HeroNav({ githubUrl, author }) {
  return (
    <nav className="nav">
      <a className="nav-brand" href="#top">
        <ArtMark size={28} />
        <span>Substation Risk Simulator</span>
      </a>
      <div className="nav-links">
        <a className="nav-link" href="#model">Live model</a>
        <a className="nav-link" href="#method">Method</a>
        <span className="nav-link">by {author}</span>
        <a className="nav-cta" href={githubUrl} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
      </div>
    </nav>
  );
}

function HeroCurve({ points, marker, tooltip, formatX }) {
  const margin = { left: 40, right: 18, top: 14, bottom: 30 };
  const W = 560;
  const H = 210;
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;
  const baseline = margin.top + plotH;

  if (!points || points.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Chart with no data" />
    );
  }

  const x0 = points[0].x;
  const x1 = points[points.length - 1].x;
  const rawSpan = x1 - x0;
  const span = rawSpan === 0 ? 1 : rawSpan;

  const scaleX = (x) => margin.left + ((x - x0) / span) * plotW;
  const scaleY = (p) => margin.top + (1 - p) * plotH;

  const linePts = points.map((pt) => `${scaleX(pt.x)},${scaleY(pt.p)}`).join(" ");
  const areaPts = `${scaleX(x0)},${baseline} ${linePts} ${scaleX(x1)},${baseline}`;

  const gridRows = [
    { p: 0, label: "0%" },
    { p: 0.5, label: "50%" },
    { p: 1, label: "100%" },
  ];

  const tickCount = 4;
  const xTicks = [];
  for (let i = 0; i < tickCount; i++) {
    const v = x0 + (i / (tickCount - 1)) * rawSpan;
    xTicks.push({ v, x: scaleX(v) });
  }

  let markerNode = null;
  if (marker && Number.isFinite(marker.x) && Number.isFinite(marker.p)) {
    const px = scaleX(marker.x);
    const py = scaleY(marker.p);
    const gap = 10;
    const tipLines = tooltip || [];
    const len = (i) => String(tipLines[i] || "").length;
    const tw = Math.min(plotW, Math.max(150, Math.ceil(24 + Math.max(len(0) * 6.4, len(2) * 6.4, len(1) * 9.2))));
    const th = 58;
    let boxX = px - gap - tw;
    if (boxX < margin.left) boxX = px + gap;
    boxX = HeroClamp(boxX, margin.left, margin.left + plotW - tw);
    let boxY = py - gap - th;
    boxY = HeroClamp(boxY, margin.top, baseline - th);
    const pointerX = HeroClamp(px, boxX + 10, boxX + tw - 10);
    const lines = tooltip || [];

    markerNode = (
      <g>
        <line x1={px} y1={py} x2={px} y2={baseline} stroke="var(--chart-axis)" strokeWidth={1} strokeDasharray="3 3" />
        <g>
          <rect x={boxX} y={boxY} width={tw} height={th} rx={8} style={{ fill: "var(--tip-bg)" }} />
          <polygon
            points={`${pointerX - 6},${boxY + th} ${pointerX + 6},${boxY + th} ${pointerX},${boxY + th + 8}`}
            style={{ fill: "var(--tip-bg)" }}
          />
          <text x={boxX + 12} y={boxY + 18} fontSize={10.5} style={{ fill: "var(--tip-muted)", fontFamily: "var(--font-mono)" }}>
            {lines[0]}
          </text>
          <text x={boxX + 12} y={boxY + 36} fontSize={15} fontWeight={700} style={{ fill: "var(--tip-ink)" }}>
            {lines[1]}
          </text>
          <text x={boxX + 12} y={boxY + 50} fontSize={10.5} style={{ fill: "var(--tip-muted)", fontFamily: "var(--font-mono)" }}>
            {lines[2]}
          </text>
        </g>
        <circle cx={px} cy={py} r={5} style={{ fill: "var(--surface)", stroke: "var(--series-1)", strokeWidth: 2.5 }} />
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Cumulative probability curve">
      {gridRows.map((g) => {
        const y = scaleY(g.p);
        return (
          <g key={g.label}>
            <line x1={margin.left} y1={y} x2={margin.left + plotW} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={margin.left - 6} y={y + 3.5} textAnchor="end" fontSize={11} style={{ fill: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
              {g.label}
            </text>
          </g>
        );
      })}
      <polygon points={areaPts} style={{ fill: "var(--series-1-soft)" }} />
      <polyline points={linePts} fill="none" style={{ stroke: "var(--series-1)", strokeWidth: 2.5 }} />
      {xTicks.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={baseline + 20}
          textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
          fontSize={10.5}
          style={{ fill: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}
        >
          {formatX(t.v)}
        </text>
      ))}
      {markerNode}
    </svg>
  );
}

function HeroBars({ rows }) {
  const labelW = 190;
  const rightW = 60;
  const W = 560;
  const rowH = 30;
  const H = 30 + (rows ? rows.length : 0) * rowH;
  const plotX0 = labelW;
  const plotW = W - labelW - rightW;

  if (!rows || rows.length === 0) {
    return <svg viewBox={`0 0 ${W} 30`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="No driver data" />;
  }

  const base = rows[0].base;
  let domainMin = base;
  let domainMax = base;
  for (const row of rows) {
    domainMin = Math.min(domainMin, row.low, row.high);
    domainMax = Math.max(domainMax, row.low, row.high);
  }
  if (domainMax === domainMin) domainMax = domainMin + 1;

  const scaleX = (v) => plotX0 + ((v - domainMin) / (domainMax - domainMin)) * plotW;
  const baseX = scaleX(base);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Top cost drivers">
      <line x1={baseX} y1={0} x2={baseX} y2={H} stroke="var(--chart-axis)" strokeWidth={1} />
      {rows.map((row, i) => {
        const cy = 30 + i * rowH + 15;
        const label = row.label.length > 26 ? row.label.slice(0, 26) + "…" : row.label;
        const lowX = scaleX(row.low);
        const highX = scaleX(row.high);
        const lowRectX = Math.min(baseX, lowX);
        const lowRectW = Math.abs(lowX - baseX);
        const highRectX = Math.min(baseX, highX);
        const highRectW = Math.abs(highX - baseX);
        const swingX = Math.max(lowX, highX) + 6;
        return (
          <g key={row.key}>
            <text x={8} y={cy + 4} fontSize={12} style={{ fill: "var(--ink-2)" }}>
              {label}
            </text>
            <rect x={lowRectX} y={cy - 6} width={lowRectW} height={12} rx={3} style={{ fill: "var(--tor-low)" }} />
            <rect x={highRectX} y={cy - 6} width={highRectW} height={12} rx={3} style={{ fill: "var(--tor-high)" }} />
            <text x={swingX} y={cy + 4} fontSize={11} style={{ fill: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
              {scnFmtMoney(row.swing)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function HeroRing({ value }) {
  const v = HeroClamp(Number.isFinite(value) ? value : 0, 0, 1);
  const size = 64;
  const cx = size / 2;
  const cy = size / 2;
  const strokeW = 7;
  const r = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * r;
  const arcLen = v * circumference;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Joint probability ring">
      <circle cx={cx} cy={cy} r={r} style={{ fill: "none", stroke: "var(--line)", strokeWidth: strokeW }} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        style={{
          fill: "none",
          stroke: "var(--accent)",
          strokeWidth: strokeW,
          strokeLinecap: "round",
          strokeDasharray: `${arcLen} ${Math.max(circumference - arcLen, 0)}`,
        }}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy} textAnchor="middle" dy=".35em" fontSize={14} fontWeight={700} style={{ fill: "var(--ink-1)" }}>
        {scnFmtPct(v)}
      </text>
    </svg>
  );
}

function HeroSection({ r, point, joint, scenario, settings, githubUrl, author }) {
  const [view, setView] = React.useState("cost");
  const panelRef = React.useRef(null);
  const start = scenario.startDate;
  const distLabel = settings.distribution === "pert" ? "Beta-PERT" : "Triangular";
  const corrCount = r.appliedCorrelations ? r.appliedCorrelations.length : 0;

  function onMove(e) {
    if (e.pointerType !== "mouse") return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    panel.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    panel.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  function onLeave() {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.removeProperty("--mx");
    panel.style.removeProperty("--my");
  }

  React.useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      panel.classList.toggle("is-offscreen", !entry.isIntersecting);
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  const tabs = [
    { key: "cost", label: "Cost risk" },
    { key: "schedule", label: "Schedule risk" },
    { key: "drivers", label: "Risk drivers" },
  ];
  const frameTabs = [
    { key: "cost", label: "Cost" },
    { key: "schedule", label: "Schedule" },
    { key: "drivers", label: "Drivers" },
  ];

  function renderCostCards() {
    const p80 = r.costStats.p80;
    const top = r.tornadoCost.slice(0, 4);
    return (
      <React.Fragment>
        <div className="sc-card">
          <div className="sc-card-head">
            <h3 className="sc-card-title">Chance of finishing under budget</h3>
            <span className="sc-card-meta">Total cost, US$</span>
          </div>
          <HeroCurve
            points={r.costCdf}
            marker={{ x: p80, p: 0.8 }}
            tooltip={["P80 budget", scnFmtMoney(p80), "Point estimate " + scnFmtMoney(point.cost)]}
            formatX={scnFmtMoneyTick}
          />
        </div>
        <div className="sc-card">
          <div className="sc-card-head">
            <h3 className="sc-card-title">Top cost drivers</h3>
            <span className="sc-card-meta">P10–P90 swing</span>
          </div>
          <ul className="sc-list">
            {top.map((row) => (
              <li className="sc-item" key={row.key}>
                <span className="sc-item-title">{row.label}</span>
                <span className="sc-item-meta">{row.id} · {HeroKindWord(row.kind)}</span>
                <span className="sc-badge">{scnFmtMoney(row.swing)}</span>
              </li>
            ))}
          </ul>
        </div>
      </React.Fragment>
    );
  }

  function renderCostFloat() {
    const p80 = r.costStats.p80;
    const pct = HeroClamp(p80 > 0 ? (point.cost / p80) * 100 : 0, 0, 100);
    return (
      <div className="float-card float-left">
        <p className="float-label">P80 budget</p>
        <p className="float-value">{scnFmtMoney(p80)}</p>
        <div className="float-bar">
          <div className="float-bar-fill" style={{ width: pct + "%" }} />
        </div>
        <p className="float-meta">{scnFmtMoney(p80 - point.cost)} contingency over the {scnFmtMoney(point.cost)} point estimate</p>
      </div>
    );
  }

  function renderScheduleCards() {
    const p80 = r.durationStats.p80;
    const critById = {};
    for (const c of r.criticality) critById[c.id] = c.index;
    const criticalTasks = scenario.tasks.filter((t) => (critById[t.id] || 0) >= 0.5);
    const floatTasks = scenario.tasks.filter((t) => (critById[t.id] || 0) < 0.5);

    function taskItem(t) {
      const idx = critById[t.id] || 0;
      const hot = idx >= 0.5;
      return (
        <li className="sc-item" key={t.id}>
          <span className="sc-item-title">{t.short}</span>
          <span className="sc-item-meta">{t.id} · likely {t.l} d</span>
          <span className={"sc-badge " + (hot ? "sc-badge-crit" : "sc-badge-ok")}>{scnFmtPct(idx)}</span>
        </li>
      );
    }

    return (
      <React.Fragment>
        <div className="sc-card">
          <div className="sc-card-head">
            <h3 className="sc-card-title">Chance of energising by a date</h3>
            <span className="sc-card-meta">Completion date</span>
          </div>
          <HeroCurve
            points={r.durationCdf}
            marker={{ x: p80, p: 0.8 }}
            tooltip={["P80 energisation", scnFmtDate(start, p80), "Point estimate " + scnFmtDate(start, point.duration)]}
            formatX={(x) => scnFmtDateTick(start, x)}
          />
        </div>
        <div className="sc-card">
          <div className="sc-card-head">
            <h3 className="sc-card-title">Activities</h3>
            <span className="sc-card-meta">share of runs on the critical path</span>
          </div>
          {criticalTasks.length > 0 ? (
            <React.Fragment>
              <p className="sc-col-head"><span className="sc-dot sc-dot-crit"></span>On the critical path</p>
              <ul className="sc-list">{criticalTasks.map(taskItem)}</ul>
            </React.Fragment>
          ) : null}
          {floatTasks.length > 0 ? (
            <React.Fragment>
              <p className="sc-col-head"><span className="sc-dot sc-dot-ok"></span>Has float</p>
              <ul className="sc-list">{floatTasks.map(taskItem)}</ul>
            </React.Fragment>
          ) : null}
        </div>
      </React.Fragment>
    );
  }

  function renderScheduleFloat() {
    const p80 = r.durationStats.p80;
    const pct = HeroClamp(p80 > 0 ? (point.duration / p80) * 100 : 0, 0, 100);
    return (
      <div className="float-card float-left">
        <p className="float-label">P80 energisation</p>
        <p className="float-value">{scnFmtDate(start, p80)}</p>
        <div className="float-bar">
          <div className="float-bar-fill" style={{ width: pct + "%" }} />
        </div>
        <p className="float-meta">{scnFmtDays(p80 - point.duration)} of schedule contingency</p>
      </div>
    );
  }

  function renderDriversCards() {
    const applied = r.appliedCorrelations || [];
    return (
      <React.Fragment>
        <div className="sc-card">
          <div className="sc-card-head">
            <h3 className="sc-card-title">What moves total cost</h3>
            <span className="sc-card-meta">one input at a time, P10 → P90</span>
          </div>
          <HeroBars rows={r.tornadoCost.slice(0, 5)} />
        </div>
        <div className="sc-card">
          <div className="sc-card-head">
            <h3 className="sc-card-title">Linked estimates</h3>
            <span className="sc-card-meta">Iman–Conover rank correlation</span>
          </div>
          {applied.length > 0 ? (
            <ul className="sc-list">
              {applied.map((c) => (
                <li className="sc-item" key={c.id}>
                  <span className="sc-item-title">{HeroShortLabel(scenario, c.a)} ↔ {HeroShortLabel(scenario, c.b)}</span>
                  <span className="sc-item-meta">target {scnFmtRho(c.target)}</span>
                  <span className="sc-badge">achieved {scnFmtRho(c.achieved)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sc-empty">Correlations are switched off — every input is sampled independently.</p>
          )}
        </div>
      </React.Fragment>
    );
  }

  function renderDriversFloat() {
    return (
      <div className="float-card float-left">
        <p className="float-label">Both P80 targets met</p>
        <p className="float-value">{scnFmtPct(joint)}</p>
        <HeroRing value={joint} />
        <p className="float-meta">of runs finish under the P80 budget and by the P80 date together</p>
      </div>
    );
  }

  let cards = null;
  let floatCard = null;
  if (view === "cost") {
    cards = renderCostCards();
    floatCard = renderCostFloat();
  } else if (view === "schedule") {
    cards = renderScheduleCards();
    floatCard = renderScheduleFloat();
  } else {
    cards = renderDriversCards();
    floatCard = renderDriversFloat();
  }

  return (
    <header className="hero" id="top">
      <div className="hero-panel" ref={panelRef} onPointerMove={onMove} onPointerLeave={onLeave}>
        <div className="hero-light" aria-hidden="true"></div>
        <div className="hero-rings" aria-hidden="true">
          <span className="ring ring-1"></span>
          <span className="ring ring-2"></span>
          <span className="ring ring-3"></span>
        </div>
        <div className="grain" aria-hidden="true"></div>
        <HeroNav githubUrl={githubUrl} author={author} />
        <p className="hero-badge">
          <span className="hero-badge-dot"></span>
          Live Monte Carlo model · 132 kV substation
        </p>
        <h1 className="hero-title">Know the <span className="grad">real</span> finish date<br /> and budget before you commit.</h1>
        <p className="hero-sub">
          10,000 simulated futures of a substation upgrade. Move any estimate and watch the risk move with it.
        </p>
        <div className="hero-actions">
          <a className="btn-glow" href="#model"><span className="btn-glow-inner">Try the live model</span></a>
          <a className="btn-ghost" href={githubUrl} target="_blank" rel="noopener noreferrer">View the code</a>
        </div>

        <div className="pill-switch" role="tablist" aria-label="Showcase view">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={view === t.key}
              className={"pill-tab" + (view === t.key ? " is-on" : "")}
              onClick={() => setView(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="showcase">
          <ArtSkyline className="showcase-art" />
          <div className="frame">
            <div className="frame-rail" aria-hidden="true">
              <span className="frame-rail-btn is-on"><ArtIcon name="grid" size={18} /></span>
              <span className="frame-rail-btn"><ArtIcon name="coin" size={18} /></span>
              <span className="frame-rail-btn"><ArtIcon name="calendar" size={18} /></span>
              <span className="frame-rail-btn"><ArtIcon name="bolt" size={18} /></span>
            </div>
            <div className="frame-main">
              <div className="frame-head">
                <h2 className="frame-title">{scenario.name}</h2>
                <div className="frame-chips">
                  <span className="frame-chip">{distLabel}</span>
                  <span className="frame-chip">{r.n.toLocaleString("en-US")} runs</span>
                  <span className="frame-chip">{corrCount > 0 ? `${corrCount} correlations` : "Independent inputs"}</span>
                </div>
              </div>
              <div className="frame-tabs" role="tablist">
                {frameTabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={view === t.key}
                    className={"frame-tab" + (view === t.key ? " is-on" : "")}
                    onClick={() => setView(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="frame-grid">{cards}</div>
            </div>
          </div>
          {floatCard}
        </div>
      </div>
    </header>
  );
}
