function PanelClampTriple(value, field, rawValue, bounds) {
  const clamped = Math.min(bounds.max, Math.max(bounds.min, rawValue));
  let { o, l, p } = value;
  if (field === "o") {
    o = clamped;
    if (o > l) l = o;
    if (l > p) p = l;
  } else if (field === "l") {
    l = clamped;
    if (l < o) o = l;
    if (l > p) p = l;
  } else if (field === "p") {
    p = clamped;
    if (p < l) l = p;
    if (l < o) o = l;
  }
  return { o, l, p };
}

function PanelThreePoint({ label, ariaName, value, rangeFor, unit, format, onChange }) {
  const { o, l, p } = value;
  const [range, setRange] = React.useState(() => rangeFor(o, p));
  const [drafts, setDrafts] = React.useState({});

  const rebase = () => setRange(rangeFor(value.o, value.p));

  const effRange = {
    min: Math.min(range.min, o),
    max: Math.max(range.max, p),
    step: range.step,
  };

  const onSlide = (field) => (e) => {
    const raw = Number(e.target.value);
    onChange(PanelClampTriple(value, field, raw, effRange));
  };

  const onFocusNum = (field) => () => {
    setDrafts((d) => ({ ...d, [field]: unit.toInput(value[field]) }));
  };

  const onChangeNum = (field) => (e) => {
    const v = e.target.value;
    setDrafts((d) => ({ ...d, [field]: v }));
  };

  const clearDraft = (field) => {
    setDrafts((d) => {
      const next = { ...d };
      delete next[field];
      return next;
    });
  };

  const commit = (field) => {
    const draftStr = drafts[field];
    if (draftStr === undefined) return;
    const trimmed = draftStr.trim();
    let parsed;
    let revert = trimmed === "";
    if (!revert) {
      parsed = unit.fromInput(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) revert = true;
    }
    if (revert) {
      clearDraft(field);
      return;
    }
    const next = PanelClampTriple(value, field, parsed, { min: 0, max: Infinity });
    onChange(next);
    clearDraft(field);
    setRange(rangeFor(next.o, next.p));
  };

  const onKeyDownNum = (field) => (e) => {
    if (e.key === "Enter") {
      commit(field);
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      clearDraft(field);
      e.currentTarget.blur();
    }
  };

  const onBlurNum = (field) => () => {
    commit(field);
  };

  const lines = [
    { field: "o", letter: "O", title: "Optimistic", v: o, aria: `${ariaName} — optimistic` },
    { field: "l", letter: "L", title: "Most likely", v: l, aria: `${ariaName} — most likely` },
    { field: "p", letter: "P", title: "Pessimistic", v: p, aria: `${ariaName} — pessimistic` },
  ];

  return (
    <div className="tp">
      <div className="tp-caption">{label}</div>
      {lines.map((row) => {
        const draftVal = drafts[row.field] !== undefined ? drafts[row.field] : unit.toInput(value[row.field]);
        return (
          <div className="tp-line" key={row.field}>
            <span className="tp-label" title={row.title}>{row.letter}</span>
            <input
              type="range"
              className="panel-range"
              min={effRange.min}
              max={effRange.max}
              step={effRange.step}
              value={row.v}
              aria-label={row.aria}
              aria-valuetext={format(row.v)}
              onChange={onSlide(row.field)}
              onPointerUp={rebase}
              onKeyUp={rebase}
            />
            <span className="tp-entry">
              <input
                type="text"
                inputMode="decimal"
                className="tp-num"
                aria-label={`${row.aria} value`}
                value={draftVal}
                onFocus={onFocusNum(row.field)}
                onChange={onChangeNum(row.field)}
                onKeyDown={onKeyDownNum(row.field)}
                onBlur={onBlurNum(row.field)}
              />
              <span className="tp-unit">{unit.suffix}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PanelTaskRow({ task, allTasks, allowedPreds, criticality, canRemove, onChange, onRemove, rangeFor, unit, formatDays, formatPct }) {
  const chipClass = criticality >= 0.5 ? "chip chip-crit-high" : "chip chip-crit-low";

  const togglePred = (id) => {
    const has = task.preds.includes(id);
    const nextIds = has ? task.preds.filter((x) => x !== id) : [...task.preds, id];
    const ordered = allTasks.map((t) => t.id).filter((tid) => nextIds.includes(tid));
    onChange({ preds: ordered });
  };

  return (
    <div className="prow">
      <div className="prow-head">
        <input
          type="text"
          className="prow-name"
          value={task.short}
          aria-label={`Name of ${task.id}`}
          onChange={(e) => onChange({ short: e.target.value, name: e.target.value })}
        />
        <span className="prow-id">{task.id}</span>
        {criticality !== undefined && (
          <span className={chipClass}>{formatPct(criticality)} critical</span>
        )}
        {canRemove && (
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove ${task.id}`}
            title="Remove activity"
            onClick={onRemove}
          >
            ×
          </button>
        )}
      </div>
      <PanelThreePoint
        label="Duration, days"
        ariaName={`${task.short} duration`}
        value={{ o: task.o, l: task.l, p: task.p }}
        rangeFor={rangeFor}
        unit={unit}
        format={formatDays}
        onChange={(next) => onChange(next)}
      />
      <div className="prow-meta pred-chips">
        After
        {allTasks
          .filter((t) => t.id !== task.id)
          .map((t) => {
            const selected = task.preds.includes(t.id);
            const disabled = !selected && !allowedPreds.includes(t.id);
            const cls = "pred-chip" + (selected ? " is-on" : "");
            return (
              <button
                key={t.id}
                type="button"
                className={cls}
                title={t.short}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => togglePred(t.id)}
              >
                {t.id}
              </button>
            );
          })}
        {task.preds.length === 0 && <span>starts immediately</span>}
      </div>
    </div>
  );
}

function PanelCostRow({ cost, canRemove, onChange, onRemove, rangeFixed, rangePerDay, unitMoney, unitRate, formatMoney, formatRate }) {
  const [open, setOpen] = React.useState(cost.perDay.l > 0);
  const allZero = cost.perDay.o === 0 && cost.perDay.l === 0 && cost.perDay.p === 0;
  const disclosureText = allZero
    ? "Add a per-day cost"
    : "Per-day cost · " + formatRate(cost.perDay.l);

  return (
    <div className="prow">
      <div className="prow-head">
        <input
          type="text"
          className="prow-name"
          value={cost.short}
          aria-label={`Name of ${cost.id}`}
          onChange={(e) => onChange({ short: e.target.value, name: e.target.value })}
        />
        <span className="prow-id">{cost.id}</span>
        {canRemove && (
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove ${cost.id}`}
            title="Remove cost line"
            onClick={onRemove}
          >
            ×
          </button>
        )}
      </div>
      <PanelThreePoint
        label="Fixed cost, US$"
        ariaName={`${cost.short} fixed cost`}
        value={cost.fixed}
        rangeFor={rangeFixed}
        unit={unitMoney}
        format={formatMoney}
        onChange={(next) => onChange({ fixed: next })}
      />
      <button
        type="button"
        className="disclosure"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {disclosureText}
      </button>
      {open && (
        <PanelThreePoint
          label="Per-day cost, US$/day"
          ariaName={`${cost.short} per-day cost`}
          value={cost.perDay}
          rangeFor={rangePerDay}
          unit={unitRate}
          format={formatRate}
          onChange={(next) => onChange({ perDay: next })}
        />
      )}
    </div>
  );
}

function PanelCorrelations({ correlations, options, achieved, enabled, onToggle, onChange, onRemove, onAdd, formatRho }) {
  return (
    <div className="corr-list">
      <label className="switch">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        Apply correlations
      </label>
      {correlations.map((c) => {
        const rowClass = "corr-row" + (enabled ? "" : " is-off");
        const sameInput = c.a === c.b;
        const achievedVal = achieved ? achieved[c.id] : undefined;
        return (
          <div className={rowClass} key={c.id}>
            <div className="prow-head">
              <span className="prow-id">{c.id}</span>
              <span className="corr-meta">{c.note ? c.note : "Custom pair"}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${c.id}`}
                title="Remove correlation"
                onClick={() => onRemove(c.id)}
              >
                ×
              </button>
            </div>
            <select
              className="corr-select"
              aria-label={`First input of ${c.id}`}
              value={c.a}
              onChange={(e) => onChange(c.id, { a: e.target.value })}
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <select
              className="corr-select"
              aria-label={`Second input of ${c.id}`}
              value={c.b}
              onChange={(e) => onChange(c.id, { b: e.target.value })}
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <div className="tp-line">
              <span className="tp-label" title="Rank correlation">ρ</span>
              <input
                type="range"
                className="panel-range"
                min={-0.9}
                max={0.9}
                step={0.05}
                value={c.rho}
                aria-label={`Correlation ${c.id}`}
                onChange={(e) => onChange(c.id, { rho: Number(e.target.value) })}
              />
              <span className="tp-value">{formatRho(c.rho)}</span>
            </div>
            {sameInput ? (
              <div className="corr-meta">Pick two different inputs</div>
            ) : (
              enabled && Number.isFinite(achievedVal) && (
                <div className="corr-meta">{"achieved " + formatRho(achievedVal)}</div>
              )
            )}
          </div>
        );
      })}
      <button type="button" className="btn btn-add" onClick={onAdd}>
        + Add correlation
      </button>
    </div>
  );
}

function PanelProject({ name, startDate, onChange }) {
  return (
    <div className="ctrl">
      <label className="field">
        <span className="field-label">Project name</span>
        <input
          type="text"
          className="field-input"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field-label">Start date</span>
        <input
          type="date"
          className="field-input"
          value={startDate}
          onChange={(e) => {
            const v = e.target.value;
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) onChange({ startDate: v });
          }}
        />
      </label>
    </div>
  );
}

function PanelControls({ settings, onChange, onReset, onResample, elapsedMs }) {
  const runsLabel = settings.iterations.toLocaleString("en-US") + " runs";

  return (
    <div className="ctrl">
      <div className="ctrl-row">
        <div className="control-label">
          <span>Iterations</span>
          <span>{runsLabel}</span>
        </div>
        <input
          type="range"
          className="panel-range"
          min={1000}
          max={50000}
          step={1000}
          value={settings.iterations}
          aria-label="Iterations"
          onChange={(e) => onChange({ iterations: Number(e.target.value) })}
        />
      </div>
      <div className="ctrl-row">
        <div className="control-label">
          <span>Distribution</span>
        </div>
        <div className="seg">
          <button
            type="button"
            className={"seg-btn" + (settings.distribution === "pert" ? " is-on" : "")}
            aria-pressed={settings.distribution === "pert"}
            onClick={() => onChange({ distribution: "pert" })}
          >
            PERT
          </button>
          <button
            type="button"
            className={"seg-btn" + (settings.distribution === "triangular" ? " is-on" : "")}
            aria-pressed={settings.distribution === "triangular"}
            onClick={() => onChange({ distribution: "triangular" })}
          >
            Triangular
          </button>
        </div>
      </div>
      <div className="ctrl-actions">
        <button type="button" className="btn btn-secondary" onClick={onReset}>
          Reset to baseline
        </button>
        <button type="button" className="btn btn-secondary" onClick={onResample}>
          Resample
        </button>
      </div>
      <div className="muted">
        {runsLabel + " · " + Math.round(elapsedMs) + " ms"}
      </div>
    </div>
  );
}
