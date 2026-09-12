// Decorative line-art SVG components for the substation risk simulator.
// Pure components, no hooks. Colours flow in only through CSS variables.

function ArtLerp(a, b, t) {
  return a + (b - a) * t;
}

// Reusable stacked-disc / insulator-shed helper: used for suspension
// strings, HV/LV bushing sheds and post insulators. Pass a negative `gap`
// to stack upward and a negative `dRx` to taper the discs as they go.
function ArtDiscStack({
  x,
  y,
  n = 3,
  gap = 7,
  rx = 5,
  ry = 2.4,
  dRx = 0,
  stroke = "var(--art-line)",
  strokeWidth = 1.5,
  rod = true,
}) {
  const s = {
    stroke,
    strokeWidth,
    fill: "var(--surface)",
    vectorEffect: "non-scaling-stroke",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const yEnd = y + gap * (n - 1);
  return (
    <g>
      {rod && (
        <line
          x1={x}
          y1={y}
          x2={x}
          y2={yEnd}
          style={{ ...s, fill: "none", strokeWidth: strokeWidth * 0.7 }}
        />
      )}
      {Array.from({ length: n }, (_, i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y + gap * i}
          rx={Math.max(1.5, rx + dRx * i)}
          ry={ry}
          style={s}
        />
      ))}
    </g>
  );
}

function ArtMark({ size = 28, className }) {
  const rx = size * 0.22;
  const s = {
    stroke: "var(--surface)",
    strokeWidth: 2.3,
    fill: "none",
    vectorEffect: "non-scaling-stroke",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const apexX = size * 0.5;
  const apexY = size * 0.16;
  const baseLX = size * 0.2;
  const baseRX = size * 0.8;
  const baseY = size * 0.84;
  const arm1Y = size * 0.42;
  const arm2Y = size * 0.62;
  const legLX = (y) => ArtLerp(apexX, baseLX, (y - apexY) / (baseY - apexY));
  const legRX = (y) => ArtLerp(apexX, baseRX, (y - apexY) / (baseY - apexY));

  return (
    <svg
      className={className}
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width={size} height={size} rx={rx} fill="var(--accent)" />
      <path d={`M ${apexX} ${apexY} L ${baseLX} ${baseY}`} style={s} />
      <path d={`M ${apexX} ${apexY} L ${baseRX} ${baseY}`} style={s} />
      <path d={`M ${legLX(arm1Y)} ${arm1Y} L ${legRX(arm1Y)} ${arm1Y}`} style={s} />
      <path d={`M ${legLX(arm2Y)} ${arm2Y} L ${legRX(arm2Y)} ${arm2Y}`} style={s} />
    </svg>
  );
}

function ArtPylon({ className }) {
  const line = {
    stroke: "var(--art-line)",
    strokeWidth: 1.5,
    fill: "none",
    vectorEffect: "non-scaling-stroke",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const fine = { ...line, strokeWidth: 1 };
  const soft = { ...fine, stroke: "var(--art-soft)" };
  const accentLine = { ...line, stroke: "var(--accent)", strokeWidth: 2 };

  const apexY = 14;
  const waistY = 115;
  const baseY = 206;
  const leftX = (y) =>
    y <= waistY
      ? ArtLerp(80, 66, (y - apexY) / (waistY - apexY))
      : ArtLerp(66, 20, (y - waistY) / (baseY - waistY));
  const rightX = (y) => 160 - leftX(y);

  const levels = [30, 50, 70, 90, 110, 130, 150, 170, 190, 206];
  const arms = [
    { y: 45, hw: 42, accent: false },
    { y: 72, hw: 32, accent: false },
    { y: 99, hw: 22, accent: true },
  ];

  return (
    <svg
      className={className}
      viewBox="0 0 160 220"
      style={{ width: "100%", height: "auto", display: "block" }}
      aria-hidden="true"
      focusable="false"
    >
      <path d={`M 80 4 L 80 ${apexY}`} style={fine} />
      <path d={`M 80 ${apexY} L ${leftX(waistY)} ${waistY} L ${leftX(baseY)} ${baseY}`} style={line} />
      <path d={`M 80 ${apexY} L ${rightX(waistY)} ${waistY} L ${rightX(baseY)} ${baseY}`} style={line} />

      {levels.map((y) => (
        <line key={`r${y}`} x1={leftX(y)} y1={y} x2={rightX(y)} y2={y} style={fine} />
      ))}
      {levels.slice(0, -1).map((y, i) => {
        const yB = levels[i + 1];
        return (
          <g key={`x${y}`}>
            <line x1={leftX(y)} y1={y} x2={rightX(yB)} y2={yB} style={fine} />
            <line x1={rightX(y)} y1={y} x2={leftX(yB)} y2={yB} style={fine} />
          </g>
        );
      })}

      {arms.map((a, i) => {
        const tipL = 80 - a.hw;
        const tipR = 80 + a.hw;
        const armStyle = a.accent ? accentLine : line;
        return (
          <g key={i}>
            <line x1={tipL} y1={a.y} x2={tipR} y2={a.y} style={armStyle} />
            <line x1={tipL} y1={a.y} x2={leftX(a.y + 12)} y2={a.y + 12} style={fine} />
            <line x1={tipR} y1={a.y} x2={rightX(a.y + 12)} y2={a.y + 12} style={fine} />
            <ArtDiscStack x={tipL} y={a.y + 4} n={3} gap={6} rx={4} ry={2} stroke="var(--art-soft)" strokeWidth={1} />
            <ArtDiscStack x={tipR} y={a.y + 4} n={3} gap={6} rx={4} ry={2} stroke="var(--art-soft)" strokeWidth={1} />
            <path
              d={`M ${tipL} ${a.y + 16} Q ${tipL * 0.5} ${a.y + 30} -10 ${a.y + 20}`}
              style={a.accent ? accentLine : soft}
            />
            <path
              d={`M ${tipR} ${a.y + 16} Q ${tipR + (160 - tipR) * 0.5} ${a.y + 30} 170 ${a.y + 20}`}
              style={a.accent ? accentLine : soft}
            />
          </g>
        );
      })}

      <line x1="10" y1="212" x2="150" y2="212" style={soft} />
    </svg>
  );
}

function ArtTransformer({ className }) {
  const line = {
    stroke: "var(--art-line)",
    strokeWidth: 1.5,
    fill: "none",
    vectorEffect: "non-scaling-stroke",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const fine = { ...line, strokeWidth: 1 };
  const soft = { ...fine, stroke: "var(--art-soft)" };
  const tankFill = { ...line, fill: "var(--art-fill)" };

  const tankX = 25;
  const tankY = 85;
  const tankW = 155;
  const tankH = 50;
  const hv = [55, 80, 105];
  const lv = [140, 152, 164];
  const fins = Array.from({ length: 6 }, (_, i) => 6 + i * 3.4);
  const hvTopY = tankY - 12.6 * 5;

  return (
    <svg
      className={className}
      viewBox="0 0 220 180"
      style={{ width: "100%", height: "auto", display: "block" }}
      aria-hidden="true"
      focusable="false"
    >
      <rect x={tankX} y={tankY} width={tankW} height={tankH} rx="6" style={tankFill} />

      <line x1="6" y1="95" x2={tankX} y2="95" style={fine} />
      <line x1="6" y1="130" x2={tankX} y2="130" style={fine} />
      {fins.map((x, i) => (
        <line key={i} x1={x} y1="95" x2={x} y2="130" style={fine} />
      ))}

      {hv.map((x, i) => (
        <g key={`hv${i}`}>
          <ArtDiscStack x={x} y={tankY} n={6} gap={-12.6} rx={7} dRx={-0.8} ry={3.4} stroke="var(--art-line)" strokeWidth={1} />
          <rect x={x - 2} y={hvTopY - 8} width="4" height="6" style={{ ...fine, fill: "var(--surface)" }} />
        </g>
      ))}
      <circle cx={hv[1]} cy={hvTopY - 11} r="1.6" fill="var(--accent)" />

      <rect x="120" y="28" width="55" height="12" rx="6" style={tankFill} />
      <line x1="130" y1="40" x2="130" y2={tankY} style={fine} />
      <line x1="160" y1="40" x2="160" y2={tankY} style={fine} />

      {lv.map((x, i) => (
        <ArtDiscStack key={`lv${i}`} x={x} y={tankY} n={3} gap={-15} rx={5} dRx={-0.75} ry={2.6} stroke="var(--art-line)" strokeWidth={1} />
      ))}

      <rect x="35" y="100" width="16" height="10" style={fine} />
      <line x1="37" y1="104" x2="49" y2="104" style={{ ...fine, strokeWidth: 0.75 }} />
      <line x1="37" y1="108" x2="47" y2="108" style={{ ...fine, strokeWidth: 0.75 }} />

      <line x1="20" y1="137" x2="190" y2="137" style={line} />
      <line x1="20" y1="140" x2="190" y2="140" style={line} />
      {[35, 80, 130, 170].map((x, i) => (
        <line key={i} x1={x} y1="140" x2={x} y2="148" style={fine} />
      ))}

      <line x1="10" y1="150" x2="210" y2="150" style={soft} />
      {[0, 1, 2].map((i) => (
        <line key={i} x1={104 + i * 6} y1="150" x2={104 + i * 6} y2={153 - i} style={soft} />
      ))}

      <circle cx="172" cy="93" r="3" fill="var(--accent)" />
    </svg>
  );
}

function ArtSwitchgear({ className }) {
  const line = {
    stroke: "var(--art-line)",
    strokeWidth: 1.5,
    fill: "none",
    vectorEffect: "non-scaling-stroke",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const fine = { ...line, strokeWidth: 1 };
  const soft = { ...fine, stroke: "var(--art-soft)" };
  const accent = { ...line, stroke: "var(--accent)", strokeWidth: 2 };
  const fillStyle = { ...line, fill: "var(--art-fill)" };

  const cols = [25, 195];
  const levels = [25, 55, 85, 115, 140];
  const poles = [80, 110, 140];

  return (
    <svg
      className={className}
      viewBox="0 0 220 180"
      style={{ width: "100%", height: "auto", display: "block" }}
      aria-hidden="true"
      focusable="false"
    >
      <line x1={cols[0]} y1="25" x2={cols[1]} y2="25" style={line} />
      {cols.map((cx) => (
        <g key={cx}>
          <line x1={cx - 8} y1="25" x2={cx - 8} y2="140" style={fine} />
          <line x1={cx + 8} y1="25" x2={cx + 8} y2="140" style={fine} />
          {levels.slice(0, -1).map((y, i) => {
            const yB = levels[i + 1];
            return (
              <g key={y}>
                <line x1={cx - 8} y1={y} x2={cx + 8} y2={y} style={fine} />
                <line x1={cx - 8} y1={y} x2={cx + 8} y2={yB} style={fine} />
                <line x1={cx + 8} y1={y} x2={cx - 8} y2={yB} style={fine} />
              </g>
            );
          })}
        </g>
      ))}

      <line x1="40" y1="35" x2="180" y2="35" style={accent} />
      {poles.map((x) => (
        <line key={x} x1={x} y1="35" x2={x} y2="65" style={accent} />
      ))}
      <line x1="55" y1="35" x2="55" y2="65" style={line} />

      <ArtDiscStack x="55" y="65" n={5} gap={11} rx={5.5} ry={2.8} stroke="var(--art-line)" strokeWidth={1} />

      {poles.map((x, i) => (
        <g key={x}>
          <ArtDiscStack x={x} y={65} n={5} gap={11} rx={6} ry={3} stroke="var(--art-line)" strokeWidth={1} />
          {i === 2 && (
            <>
              <circle cx={x} cy="65" r="1.6" style={fine} />
              <line x1={x} y1="65" x2={x + 16} y2="50" style={fine} />
            </>
          )}
        </g>
      ))}

      <rect x="65" y="115" width="90" height="10" style={fillStyle} />
      <line x1="75" y1="125" x2="75" y2="140" style={line} />
      <line x1="145" y1="125" x2="145" y2="140" style={line} />

      <line x1="10" y1="145" x2="210" y2="145" style={soft} />
    </svg>
  );
}

function ArtSkyline({ className }) {
  const soft = {
    stroke: "var(--art-soft)",
    strokeWidth: 1,
    fill: "none",
    vectorEffect: "non-scaling-stroke",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const line = { ...soft, stroke: "var(--art-line)", strokeWidth: 1.5 };
  const accentLine = { ...soft, stroke: "var(--accent)", strokeWidth: 1.5 };
  const fillSoft = { ...soft, fill: "var(--art-fill)" };

  const groundY = 196;

  const pylon = (cx, style) => (
    <g>
      <path d={`M ${cx} 34 L ${cx - 22} 188 M ${cx} 34 L ${cx + 22} 188`} style={style} />
      {[60, 90, 120].map((y, i) => {
        const hw = 26 - i * 6;
        return <line key={y} x1={cx - hw} y1={y} x2={cx + hw} y2={y} style={style} />;
      })}
    </g>
  );

  const gantry = (cx, style) => (
    <g>
      <line x1={cx - 40} y1="60" x2={cx - 40} y2="180" style={style} />
      <line x1={cx + 40} y1="60" x2={cx + 40} y2="180" style={style} />
      <line x1={cx - 40} y1="60" x2={cx + 40} y2="60" style={style} />
    </g>
  );

  const fenceX = Array.from({ length: 40 }, (_, i) => 10 + i * 30);

  return (
    <svg
      className={className}
      viewBox="0 0 1200 220"
      style={{ width: "100%", height: "auto", display: "block" }}
      aria-hidden="true"
      focusable="false"
    >
      <line x1="0" y1={groundY} x2="1200" y2={groundY} style={soft} />
      <line x1="0" y1={groundY + 8} x2="1200" y2={groundY + 8} style={soft} />
      {fenceX.map((x) => (
        <line key={x} x1={x} y1={groundY - 14} x2={x} y2={groundY + 8} style={soft} />
      ))}

      {pylon(80, line)}
      <path d="M -10 96 Q 150 130 300 108" style={line} />
      <path d="M -10 106 Q 150 140 300 118" style={soft} />

      {gantry(340, soft)}
      <line x1="300" y1="70" x2="380" y2="70" style={accentLine} />
      {gantry(460, soft)}
      <line x1="420" y1="70" x2="500" y2="70" style={soft} />

      <rect x="540" y="120" width="90" height="76" rx="4" style={fillSoft} />
      <line x1="530" y1="130" x2="540" y2="130" style={soft} />
      <line x1="530" y1="150" x2="540" y2="150" style={soft} />
      {[560, 585, 610].map((x) => (
        <line key={x} x1={x} y1="120" x2={x} y2="90" style={soft} />
      ))}

      <rect x="700" y="140" width="90" height="56" style={line} />
      <path d="M 695 140 L 745 118 L 795 140" style={line} />
      <rect x="732" y="164" width="18" height="32" style={line} />
      {[712, 778].map((x) => (
        <line key={x} x1={x} y1="150" x2={x} y2="160" style={soft} />
      ))}

      {[850, 880, 910].map((x) => (
        <g key={x}>
          <ArtDiscStack x={x} y="150" n={4} gap={10} rx={5} ry={2.4} stroke="var(--art-soft)" strokeWidth={1} />
          <line x1={x} y1="180" x2={x} y2={groundY} style={soft} />
        </g>
      ))}
      <line x1="840" y1="150" x2="920" y2="150" style={soft} />

      {pylon(1120, line)}
      <path d="M 900 108 Q 1050 128 1210 96" style={line} />
      <path d="M 900 118 Q 1050 138 1210 106" style={soft} />
    </svg>
  );
}

function ArtIcon({ name, size = 18, className }) {
  const s = {
    stroke: "currentColor",
    strokeWidth: 1.6,
    fill: "none",
    vectorEffect: "non-scaling-stroke",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const wrap = (children) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ width: "100%", height: "auto", display: "block" }}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );

  if (name === "grid") {
    return wrap(
      <>
        <rect x="3" y="3" width="8" height="8" rx="1.5" style={s} />
        <rect x="13" y="3" width="8" height="8" rx="1.5" style={s} />
        <rect x="3" y="13" width="8" height="8" rx="1.5" style={s} />
        <rect x="13" y="13" width="8" height="8" rx="1.5" style={s} />
      </>
    );
  }
  if (name === "coin") {
    return wrap(
      <>
        <circle cx="12" cy="12" r="9" style={s} />
        <path
          d="M15 8.2c-.9-1-2-1.4-3.2-1.4-1.7 0-3 .9-3 2.2 0 3 6.4 1.4 6.4 4.4 0 1.3-1.4 2.3-3.2 2.3-1.3 0-2.5-.5-3.3-1.4"
          style={s}
        />
      </>
    );
  }
  if (name === "calendar") {
    return wrap(
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2" style={s} />
        <line x1="8" y1="2.5" x2="8" y2="6.5" style={s} />
        <line x1="16" y1="2.5" x2="16" y2="6.5" style={s} />
        <line x1="3" y1="9.5" x2="21" y2="9.5" style={s} />
      </>
    );
  }
  if (name === "bolt") {
    return wrap(<path d="M13 2 4 14h6l-1 8 9-13h-6z" style={s} />);
  }
  if (name === "network") {
    const nodes = [
      [6, 18],
      [18, 18],
      [12, 6],
    ];
    return wrap(
      <>
        <line x1={nodes[0][0]} y1={nodes[0][1]} x2={nodes[1][0]} y2={nodes[1][1]} style={s} />
        <line x1={nodes[1][0]} y1={nodes[1][1]} x2={nodes[2][0]} y2={nodes[2][1]} style={s} />
        <line x1={nodes[2][0]} y1={nodes[2][1]} x2={nodes[0][0]} y2={nodes[0][1]} style={s} />
        {nodes.map((n, i) => (
          <circle key={i} cx={n[0]} cy={n[1]} r="2.2" style={s} />
        ))}
      </>
    );
  }
  return null;
}
