// Nice-tick step selection: 1 / 2 / 2.5 / 5 x 10^k, reused by every axis in this file.
function ChartNiceTicks(min, max, count) {
  if (!isFinite(min) || !isFinite(max)) return [0];
  if (min > max) { const t = min; min = max; max = t; }
  if (max - min < 1e-9) return [min];
  const targetCount = Math.max(1, count || 5);
  const rough = (max - min) / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  let norm = rough / mag;
  let step;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 2.5) step = 2.5;
  else if (norm <= 5) step = 5;
  else step = 10;
  step *= mag;
  if (!isFinite(step) || step <= 0) step = (max - min) / targetCount || 1;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(Math.round(v / step) * step);
  }
  return ticks;
}

function ChartClampNum(v, lo, hi) {
  if (lo > hi) return lo;
  if (!isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

// Roughly one tick per 90px of plot width, never fewer than 3.
function ChartXTickCount(plotWidth) {
  if (!isFinite(plotWidth) || plotWidth <= 0) return 3;
  return Math.max(3, Math.round(plotWidth / 90));
}

// Truncate `text` with a trailing ellipsis so it fits `maxWidth` px, estimating
// `pxPerChar` px per character (6.2 for 11-11.5px text, 6.0 for 10px mono).
function ChartTruncateToWidth(text, maxWidth, pxPerChar) {
  const s = String(text == null ? '' : text);
  const w = pxPerChar || 6.2;
  if (!isFinite(maxWidth) || maxWidth <= 0) return '';
  if (s.length * w <= maxWidth) return s;
  const maxChars = Math.max(0, Math.floor(maxWidth / w) - 1);
  return s.slice(0, maxChars) + '…';
}

function ChartLocalPoint(evt, svgEl) {
  if (!svgEl || typeof svgEl.createSVGPoint !== 'function') return null;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return null;
  const pt = svgEl.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const loc = pt.matrixTransform(ctm.inverse());
  return { x: loc.x, y: loc.y };
}

// r = {tl, tr, br, bl} corner radii; any shape with a non-finite/non-positive size renders nothing.
function ChartRoundRectPath(x, y, w, h, r) {
  if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) return '';
  if (!(w > 0) || !(h > 0)) return '';
  const rr = r || {};
  const tl = Math.max(0, Math.min(rr.tl || 0, w / 2, h / 2));
  const tr = Math.max(0, Math.min(rr.tr || 0, w / 2, h / 2));
  const br = Math.max(0, Math.min(rr.br || 0, w / 2, h / 2));
  const bl = Math.max(0, Math.min(rr.bl || 0, w / 2, h / 2));
  return [
    `M${x + tl},${y}`,
    `H${x + w - tr}`,
    tr > 0 ? `A${tr},${tr} 0 0 1 ${x + w},${y + tr}` : '',
    `V${y + h - br}`,
    br > 0 ? `A${br},${br} 0 0 1 ${x + w - br},${y + h}` : '',
    `H${x + bl}`,
    bl > 0 ? `A${bl},${bl} 0 0 1 ${x},${y + h - bl}` : '',
    `V${y + tl}`,
    tl > 0 ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : '',
    'Z'
  ].filter(Boolean).join(' ');
}

// P-marker chip layout: sort left to right, push each chip clear of its neighbour by 4 units,
// then clamp the last chip inside the plot.
function ChartLayoutChips(markers, xScale, plotLeft, plotRight) {
  const chips = (markers || []).map((m) => {
    const w = Math.max(28, 10 + String(m.label).length * 6.5);
    return { label: m.label, cx: ChartClampNum(xScale(m.x), plotLeft, plotRight), w };
  }).sort((a, b) => a.cx - b.cx);
  for (let i = 1; i < chips.length; i++) {
    const minCx = chips[i - 1].cx + chips[i - 1].w / 2 + chips[i].w / 2 + 4;
    if (chips[i].cx < minCx) chips[i].cx = minCx;
  }
  if (chips.length) {
    const last = chips[chips.length - 1];
    const maxCx = plotRight - last.w / 2;
    if (last.cx > maxCx) last.cx = maxCx;
  }
  return chips;
}

function ChartTooltip({ x, y, lines, plotLeft, plotRight }) {
  const safeLines = lines && lines.length ? lines : [''];
  const rawW = Math.max.apply(null, safeLines.map((l) => 6.2 * String(l).length));
  const boxW = rawW + 16;
  const boxH = safeLines.length * 15 + 12;
  let boxX = x + 10;
  if (boxX + boxW > plotRight) boxX = x - boxW - 10;
  boxX = ChartClampNum(boxX, plotLeft, Math.max(plotLeft, plotRight - boxW));
  let boxY = y - boxH - 10;
  if (boxY < 0) boxY = y + 10;
  return (
    <g pointerEvents="none">
      <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={4}
        style={{ fill: 'var(--chart-surface)', stroke: 'var(--chart-axis)' }} strokeWidth={1} />
      {safeLines.map((l, i) => (
        <text key={i} x={boxX + 8} y={boxY + 16 + i * 15} fontSize={11}
          style={{ fill: 'var(--ink-1)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
          {l}
        </text>
      ))}
    </g>
  );
}

function ChartDistribution({ hist, markers, formatX, formatCount, xTitle, height, width }) {
  const W = (typeof width === 'number' && isFinite(width) && width > 0) ? width : 820;
  const H = height || 230;
  const fmtCount = formatCount || ((c) => c.toLocaleString() + ' runs');
  const mk = markers || [];
  const margin = { left: 64, right: 24, top: 18, bottom: 40 };
  const plotLeft = margin.left, plotRight = W - margin.right;
  const plotTop = margin.top, plotBottom = H - margin.bottom;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const plotHeight = Math.max(1, plotBottom - plotTop);

  const bins = (hist && hist.bins) || [];
  const domainMin = hist && isFinite(hist.min) ? hist.min : 0;
  const domainMaxRaw = hist && isFinite(hist.max) ? hist.max : domainMin + 1;
  const domainMax = domainMaxRaw - domainMin > 1e-9 ? domainMaxRaw : domainMin + 1;
  const domainRange = domainMax - domainMin;
  const xScale = (v) => plotLeft + ((v - domainMin) / domainRange) * plotWidth;
  const binWidth = (hist && hist.binWidth) > 0 ? hist.binWidth : domainRange / Math.max(1, bins.length);

  const maxCount = bins.reduce((m, b) => Math.max(m, b.count || 0), 0) || 1;

  const svgRef = React.useRef(null);
  const [hoverIdx, setHoverIdx] = React.useState(null);

  function handleMove(evt) {
    if (!bins.length) return;
    const pt = ChartLocalPoint(evt, svgRef.current);
    if (!pt) return;
    const dataX = domainMin + ((pt.x - plotLeft) / plotWidth) * domainRange;
    let idx = binWidth > 0 ? Math.floor((dataX - domainMin) / binWidth) : 0;
    idx = ChartClampNum(idx, 0, bins.length - 1);
    setHoverIdx(idx);
  }

  const yTicks = ChartNiceTicks(0, maxCount, 4).filter((t) => t >= -1e-6 && t <= maxCount + 1e-6);
  const xTicks = ChartNiceTicks(domainMin, domainMax, ChartXTickCount(plotWidth)).filter((t) => t >= domainMin - 1e-6 && t <= domainMax + 1e-6);
  const chips = ChartLayoutChips(mk, xScale, plotLeft, plotRight);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" ref={svgRef}>
      {yTicks.map((t, i) => {
        const y = plotBottom - (t / maxCount) * plotHeight;
        return (
          <g key={'y' + i}>
            <line x1={plotLeft} x2={plotRight} y1={y} y2={y} fill="none" style={{ stroke: 'var(--chart-grid)' }} strokeWidth={1} />
            <text x={plotLeft - 8} y={y + 3} textAnchor="end" fontSize={11}
              style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(t).toLocaleString()}
            </text>
          </g>
        );
      })}
      {bins.map((b, i) => {
        const x0 = xScale(b.x0), x1 = xScale(b.x1);
        const x = Math.min(x0, x1) + 1;
        const w = Math.max(0, Math.abs(x1 - x0) - 2);
        const h = ((b.count || 0) / maxCount) * plotHeight;
        const y = plotBottom - h;
        const r = Math.min(4, h / 2, w / 2);
        const d = ChartRoundRectPath(x, y, w, h, { tl: r, tr: r, br: 0, bl: 0 });
        if (!d) return null;
        const isHover = hoverIdx === i;
        return <path key={i} d={d} style={{ fill: isHover ? 'var(--accent)' : 'var(--series-1)' }} />;
      })}
      <line x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} fill="none" style={{ stroke: 'var(--chart-axis)' }} strokeWidth={1} />
      {xTicks.map((t, i) => (
        <text key={'x' + i} x={xScale(t)} y={plotBottom + 14} textAnchor="middle" fontSize={11}
          style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
          {formatX(t)}
        </text>
      ))}
      {mk.map((m, i) => {
        const lineX = ChartClampNum(xScale(m.x), plotLeft, plotRight);
        return <line key={'l' + i} x1={lineX} x2={lineX} y1={plotTop} y2={plotBottom} fill="none"
          strokeDasharray="4 3" style={{ stroke: 'var(--marker)' }} strokeWidth={1.5} />;
      })}
      {chips.map((c, i) => (
        <g key={'c' + i}>
          <rect x={c.cx - c.w / 2} y={plotTop + 2} width={c.w} height={16} rx={3} style={{ fill: 'var(--marker)' }} />
          <text x={c.cx} y={plotTop + 14} textAnchor="middle" fontSize={10}
            style={{ fill: 'var(--chart-surface)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {c.label}
          </text>
        </g>
      ))}
      <text x={plotLeft + plotWidth / 2} y={H - 6} textAnchor="middle" fontSize={11}
        style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-body)', letterSpacing: '0.08em' }}>
        {(xTitle || '').toUpperCase()}
      </text>
      {hoverIdx != null && bins[hoverIdx] && (
        <ChartTooltip
          x={xScale((bins[hoverIdx].x0 + bins[hoverIdx].x1) / 2)}
          y={plotBottom - ((bins[hoverIdx].count || 0) / maxCount) * plotHeight}
          plotLeft={plotLeft} plotRight={plotRight}
          lines={[formatX(bins[hoverIdx].x0) + ' – ' + formatX(bins[hoverIdx].x1), fmtCount(bins[hoverIdx].count || 0)]}
        />
      )}
      <rect x={plotLeft} y={plotTop} width={plotWidth} height={plotHeight} fill="transparent"
        onPointerMove={handleMove} onPointerLeave={() => setHoverIdx(null)} />
    </svg>
  );
}

function ChartSCurve({ points, markers, formatX, xTitle, height, width }) {
  const W = (typeof width === 'number' && isFinite(width) && width > 0) ? width : 820;
  const H = height || 230;
  const margin = { left: 64, right: 24, top: 18, bottom: 40 };
  const plotLeft = margin.left, plotRight = W - margin.right;
  const plotTop = margin.top, plotBottom = H - margin.bottom;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const plotHeight = Math.max(1, plotBottom - plotTop);

  const pts = (points || []).filter((p) => isFinite(p.x) && isFinite(p.p));
  const mk = markers || [];
  const xMinRaw = pts.length ? pts[0].x : 0;
  const xMaxRaw = pts.length ? pts[pts.length - 1].x : 1;
  const domainMin = xMinRaw;
  const domainMax = xMaxRaw - xMinRaw > 1e-9 ? xMaxRaw : xMinRaw + 1;
  const domainRange = domainMax - domainMin;
  const xScale = (v) => plotLeft + ((v - domainMin) / domainRange) * plotWidth;
  const yScale = (p) => plotTop + plotHeight - ChartClampNum(p, 0, 1) * plotHeight;

  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);

  function handleMove(evt) {
    if (pts.length < 2) return;
    const pt = ChartLocalPoint(evt, svgRef.current);
    if (!pt) return;
    const dataX = domainMin + ((pt.x - plotLeft) / plotWidth) * domainRange;
    if (dataX <= pts[0].x) { setHover({ x: pts[0].x, p: pts[0].p }); return; }
    const lastPt = pts[pts.length - 1];
    if (dataX >= lastPt.x) { setHover({ x: lastPt.x, p: lastPt.p }); return; }
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x <= dataX) lo = mid; else hi = mid;
    }
    const a = pts[lo], b = pts[hi];
    const t = b.x - a.x > 1e-9 ? (dataX - a.x) / (b.x - a.x) : 0;
    setHover({ x: dataX, p: a.p + t * (b.p - a.p) });
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const xTicks = ChartNiceTicks(domainMin, domainMax, ChartXTickCount(plotWidth)).filter((t) => t >= domainMin - 1e-6 && t <= domainMax + 1e-6);

  const linePts = pts.map((p) => `${xScale(p.x)},${yScale(p.p)}`).join(' ');
  const areaPath = pts.length >= 2
    ? `M${xScale(pts[0].x)},${plotBottom} L${linePts.split(' ').join(' L')} L${xScale(pts[pts.length - 1].x)},${plotBottom} Z`
    : '';

  // Lay out each marker's label to the right of its dot (or left, if that would
  // overflow the plot), then resolve vertical crowding bottom-up so no two
  // labels (or a label and a leader line) come within 13px of each other.
  const markerItems = mk.map((m) => {
    const mx = xScale(m.x), my = yScale(m.p);
    const labelW = 6.2 * String(m.label).length;
    const overflow = mx + 8 + labelW > plotRight;
    return { m, mx, my, overflow, ly: my - 6 };
  }).sort((a, b) => b.ly - a.ly);
  for (let i = 1; i < markerItems.length; i++) {
    const below = markerItems[i - 1], above = markerItems[i];
    if (below.ly - above.ly < 13) above.ly = below.ly - 13;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" ref={svgRef}>
      {yTicks.map((t, i) => {
        const y = yScale(t);
        return (
          <g key={'y' + i}>
            <line x1={plotLeft} x2={plotRight} y1={y} y2={y} fill="none" style={{ stroke: 'var(--chart-grid)' }} strokeWidth={1} />
            <text x={plotLeft - 8} y={y + 3} textAnchor="end" fontSize={11}
              style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(t * 100) + '%'}
            </text>
          </g>
        );
      })}
      {areaPath && <path d={areaPath} style={{ fill: 'var(--series-1-soft)' }} />}
      {pts.length >= 2 && <polyline points={linePts} fill="none" style={{ stroke: 'var(--series-1)' }} strokeWidth={2} />}
      {pts.length === 1 && <circle cx={xScale(pts[0].x)} cy={yScale(pts[0].p)} r={3} style={{ fill: 'var(--series-1)' }} />}
      <line x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} fill="none" style={{ stroke: 'var(--chart-axis)' }} strokeWidth={1} />
      {xTicks.map((t, i) => (
        <text key={'x' + i} x={xScale(t)} y={plotBottom + 14} textAnchor="middle" fontSize={11}
          style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
          {formatX(t)}
        </text>
      ))}
      {markerItems.map((it, i) => (
        <g key={'m' + i}>
          <line x1={plotLeft} x2={it.mx} y1={it.my} y2={it.my} fill="none" style={{ stroke: 'var(--marker)' }} strokeWidth={1.5} strokeDasharray="4 3" />
          <line x1={it.mx} x2={it.mx} y1={it.my} y2={plotBottom} fill="none" style={{ stroke: 'var(--marker)' }} strokeWidth={1.5} strokeDasharray="4 3" />
          <circle cx={it.mx} cy={it.my} r={4} style={{ fill: 'var(--marker)' }} />
          <text x={it.overflow ? it.mx - 8 : it.mx + 8} y={it.ly} textAnchor={it.overflow ? 'end' : 'start'} fontSize={11}
            style={{ fill: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {it.m.label}
          </text>
        </g>
      ))}
      <text x={plotLeft + plotWidth / 2} y={H - 6} textAnchor="middle" fontSize={11}
        style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-body)', letterSpacing: '0.08em' }}>
        {(xTitle || '').toUpperCase()}
      </text>
      {hover && (
        <g>
          <line x1={plotLeft} x2={xScale(hover.x)} y1={yScale(hover.p)} y2={yScale(hover.p)} fill="none"
            style={{ stroke: 'var(--ink-muted)' }} strokeWidth={1} strokeDasharray="2 2" />
          <line x1={xScale(hover.x)} x2={xScale(hover.x)} y1={yScale(hover.p)} y2={plotBottom} fill="none"
            style={{ stroke: 'var(--ink-muted)' }} strokeWidth={1} strokeDasharray="2 2" />
          <circle cx={xScale(hover.x)} cy={yScale(hover.p)} r={3.5} style={{ fill: 'var(--accent)' }} />
          <ChartTooltip x={xScale(hover.x)} y={yScale(hover.p)} plotLeft={plotLeft} plotRight={plotRight}
            lines={[formatX(hover.x), Math.round(hover.p * 100) + '%']} />
        </g>
      )}
      <rect x={plotLeft} y={plotTop} width={plotWidth} height={plotHeight} fill="transparent"
        onPointerMove={handleMove} onPointerLeave={() => setHover(null)} />
    </svg>
  );
}

const ChartTornadoKindWord = { duration: 'duration', fixed: 'fixed cost', perDay: 'per-day cost' };

function ChartTornado({ rows, base, mode, formatX, xTitle, maxRows, height, width }) {
  const W = (typeof width === 'number' && isFinite(width) && width > 0) ? width : 820;
  const mode_ = mode || 'swing';
  const shown = (rows || []).slice(0, maxRows || 8);
  const rowH = 34;
  const margin = { left: Math.min(170, Math.round(0.36 * W)), right: 24, top: 18, bottom: 40 };
  const H = height || (margin.top + shown.length * rowH + margin.bottom);
  const plotLeft = margin.left, plotRight = W - margin.right;
  const plotTop = margin.top, plotBottom = H - margin.bottom;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const plotHeight = Math.max(1, plotBottom - plotTop);
  const baseVal = isFinite(base) ? base : 0;

  let domainMin, domainMax;
  if (mode_ === 'corr') {
    domainMin = -1; domainMax = 1;
  } else {
    const vals = [baseVal];
    shown.forEach((r) => { vals.push(r.low, r.high); });
    domainMin = Math.min.apply(null, vals);
    domainMax = Math.max.apply(null, vals);
    if (domainMax - domainMin < 1e-9) {
      const pad = Math.max(Math.abs(baseVal) * 0.05, 1);
      domainMin -= pad; domainMax += pad;
    }
  }
  const domainRange = domainMax - domainMin || 1;

  // Reserve side margins for the direct end-labels (swing) / edge tick labels (corr)
  // so they never clip against the viewBox, per the spec's ~58px each side.
  const armMargin = Math.max(0, Math.min(58, plotWidth / 2 - 1));
  const barLeft = plotLeft + armMargin;
  const barRight = plotRight - armMargin;
  const barWidth = Math.max(1, barRight - barLeft);
  const xScale = (v) => barLeft + ((v - domainMin) / domainRange) * barWidth;

  const svgRef = React.useRef(null);
  const [hoverI, setHoverI] = React.useState(null);

  function handleMove(evt) {
    const pt = ChartLocalPoint(evt, svgRef.current);
    if (!pt) return;
    if (pt.y < plotTop || pt.y > plotBottom) { setHoverI(null); return; }
    const idx = ChartClampNum(Math.floor((pt.y - plotTop) / rowH), 0, shown.length - 1);
    if (!shown.length) { setHoverI(null); return; }
    setHoverI(idx);
  }

  const armH = 16;
  const labelMaxW = Math.max(10, margin.left - 14);

  const baseX = xScale(baseVal);
  const baseLabelText = formatX(baseVal);
  const baseHalfW = 6.2 * String(baseLabelText).length / 2;
  const swingTicks = mode_ === 'swing'
    ? ChartNiceTicks(domainMin, domainMax, ChartXTickCount(barWidth)).filter((t) => t >= domainMin - 1e-6 && t <= domainMax + 1e-6)
    : [];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" ref={svgRef}>
      {mode_ === 'corr' && [-1, -0.5, 0, 0.5, 1].map((t, i) => {
        const x = xScale(t);
        return (
          <g key={'g' + i}>
            <line x1={x} x2={x} y1={plotTop} y2={plotBottom} fill="none" style={{ stroke: 'var(--chart-grid)' }} strokeWidth={1} />
            <text x={x} y={plotBottom + 14} textAnchor="middle" fontSize={11}
              style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {String(t)}
            </text>
          </g>
        );
      })}
      {shown.map((row, i) => {
        const rowY = plotTop + i * rowH;
        const cy = rowY + rowH / 2;
        const isHover = hoverI === i;
        let bars = null, swingLabel = null;
        const zeroSwing = mode_ === 'swing' && !(Math.abs(row.swing) > 1e-9);
        if (mode_ === 'swing' && zeroSwing) {
          swingLabel = (
            <text x={baseX + 6} y={cy + 3.5} textAnchor="start" fontSize={10.5}
              style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {formatX(0)}
            </text>
          );
        } else if (mode_ === 'swing') {
          const xB = xScale(baseVal);
          const xLow = xScale(row.low);
          const xHigh = xScale(row.high);
          const lowW = Math.abs(xLow - xB);
          const highW = Math.abs(xHigh - xB);
          const lowRound = xLow > xB ? { tr: 4, br: 4 } : { tl: 4, bl: 4 };
          const highRound = xHigh > xB ? { tr: 4, br: 4 } : { tl: 4, bl: 4 };
          const dLow = ChartRoundRectPath(Math.min(xB, xLow), cy - armH / 2, lowW, armH, lowRound);
          const dHigh = ChartRoundRectPath(Math.min(xB, xHigh), cy - armH / 2, highW, armH, highRound);
          const longerIsHigh = Math.abs(row.high - baseVal) >= Math.abs(row.low - baseVal);
          const endX = longerIsHigh ? xHigh : xLow;
          const goingRight = longerIsHigh ? xHigh > xB : xLow > xB;
          bars = (
            <g>
              {dLow && <path d={dLow} style={{ fill: 'var(--tor-low)' }} />}
              {dHigh && <path d={dHigh} style={{ fill: 'var(--tor-high)' }} />}
            </g>
          );
          swingLabel = (
            <text x={endX + (goingRight ? 6 : -6)} y={cy + 3.5} textAnchor={goingRight ? 'start' : 'end'} fontSize={10.5}
              style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {formatX(row.swing)}
            </text>
          );
        } else {
          const corr = isFinite(row.corr) ? row.corr : 0;
          const x0 = xScale(0), x1 = xScale(corr);
          const w = Math.abs(x1 - x0);
          const round = x1 > x0 ? { tr: 4, br: 4 } : { tl: 4, bl: 4 };
          const d = ChartRoundRectPath(Math.min(x0, x1), cy - armH / 2, w, armH, round);
          bars = d ? <path d={d} style={{ fill: corr >= 0 ? 'var(--tor-high)' : 'var(--tor-low)' }} /> : null;
        }
        const labelText = ChartTruncateToWidth(row.label, labelMaxW, 6.2);
        const subText = ChartTruncateToWidth((row.id || '') + ' · ' + (ChartTornadoKindWord[row.kind] || row.kind || ''), labelMaxW, 6.0);
        return (
          <g key={row.key || i}>
            {isHover && <rect x={0} y={rowY} width={W} height={rowH} style={{ fill: 'var(--chart-grid)' }} opacity={0.4} />}
            <text x={plotLeft - 10} y={cy - 4} textAnchor="end" fontSize={11.5}
              style={{ fill: 'var(--ink-2)', fontFamily: 'var(--font-body)' }}>
              {labelText}
            </text>
            <text x={plotLeft - 10} y={cy + 9} textAnchor="end" fontSize={10}
              style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
              {subText}
            </text>
            {bars}
            {swingLabel}
          </g>
        );
      })}
      {mode_ === 'swing' && (
        <g>
          <line x1={baseX} x2={baseX} y1={plotTop} y2={plotBottom} fill="none"
            style={{ stroke: 'var(--chart-axis)' }} strokeWidth={1.5} />
          {swingTicks.map((t, i) => {
            const tx = xScale(t);
            const label = formatX(t);
            const halfW = 6.2 * String(label).length / 2;
            const gap = Math.abs(tx - baseX) - halfW - baseHalfW;
            if (gap < 8) return null;
            return (
              <text key={'t' + i} x={tx} y={plotBottom + 14} textAnchor="middle" fontSize={11}
                style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {label}
              </text>
            );
          })}
          <text x={baseX} y={plotBottom + 14} textAnchor="middle" fontSize={11}
            style={{ fill: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {baseLabelText}
          </text>
        </g>
      )}
      <text x={plotLeft + plotWidth / 2} y={H - 6} textAnchor="middle" fontSize={11}
        style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-body)', letterSpacing: '0.08em' }}>
        {(mode_ === 'corr' ? 'RANK CORRELATION' : (xTitle || '')).toUpperCase()}
      </text>
      {hoverI != null && shown[hoverI] && (
        <ChartTooltip
          x={xScale(mode_ === 'corr' ? shown[hoverI].corr : baseVal)}
          y={plotTop + hoverI * rowH + rowH / 2}
          plotLeft={plotLeft} plotRight={plotRight}
          lines={[
            shown[hoverI].label,
            'low ' + formatX(shown[hoverI].low),
            'base ' + formatX(baseVal),
            'high ' + formatX(shown[hoverI].high),
            'corr ' + (isFinite(shown[hoverI].corr) ? shown[hoverI].corr.toFixed(2) : '—')
          ]}
        />
      )}
      {shown.length > 0 && (
        <rect x={0} y={plotTop} width={W} height={plotHeight} fill="transparent"
          onPointerMove={handleMove} onPointerLeave={() => setHoverI(null)} />
      )}
    </svg>
  );
}

function ChartCriticality({ items, formatPct, height, width }) {
  const W = (typeof width === 'number' && isFinite(width) && width > 0) ? width : 820;
  const rows = items || [];
  const rowH = 28;
  const H = height || (32 + rows.length * rowH);
  const labelW = Math.min(190, Math.round(0.4 * W));
  const margin = { left: labelW, right: 56, top: 8 };
  const plotLeft = margin.left, plotRight = W - margin.right;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const fmtPct = formatPct || ((v) => Math.round(ChartClampNum(v, 0, 1) * 100) + '%');
  const labelMaxW = Math.max(10, margin.left - 14);

  const [hoverI, setHoverI] = React.useState(null);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img">
      {rows.map((it, i) => {
        const y = margin.top + i * rowH;
        const cy = y + rowH / 2;
        const idx = ChartClampNum(it.index, 0, 1);
        const barW = idx * plotWidth;
        const opacity = Math.max(0.25, idx);
        const barH = 12;
        const d = ChartRoundRectPath(plotLeft, cy - barH / 2, Math.max(barW, 0.01), barH, { tl: 3, tr: 3, br: 3, bl: 3 });
        const shortText = ChartTruncateToWidth(it.short, labelMaxW, 6.2);
        return (
          <g key={it.id || i} onPointerEnter={() => setHoverI(i)} onPointerLeave={() => setHoverI(null)}>
            <text x={margin.left - 10} y={cy + 4} textAnchor="end" fontSize={11}
              style={{ fill: 'var(--ink-2)', fontFamily: 'var(--font-body)' }}>
              {shortText}
            </text>
            <rect x={plotLeft} y={cy - barH / 2} width={plotWidth} height={barH} rx={3} style={{ fill: 'var(--chart-grid)' }} />
            {barW > 0 && <path d={d} style={{ fill: 'var(--series-1)', fillOpacity: opacity }} />}
            <text x={plotRight + 8} y={cy + 4} fontSize={11}
              style={{ fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtPct(idx)}
            </text>
            {hoverI === i && (
              <ChartTooltip x={plotLeft + barW} y={cy} plotLeft={plotLeft} plotRight={W}
                lines={[it.short || '', it.id || '', fmtPct(idx)]} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
