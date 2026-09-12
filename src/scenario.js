const scnDefaultScenario = {
  id: "substation-132kv",
  name: "132 kV Substation Upgrade & Grid Interconnection",
  subtitle: "40 MVA 132/33 kV transformer addition — design through energisation",
  startDate: "2026-10-01",
  tasks: [
    { id: "T1", name: "Detailed design, protection studies & permitting", short: "Design & permitting", preds: [], o: 90, l: 120, p: 210 },
    { id: "T2", name: "Power transformer & 132 kV switchgear procurement", short: "Transformer procurement", preds: ["T1"], o: 385, l: 490, p: 700 },
    { id: "T3", name: "Civil works, foundations & control building", short: "Civil works", preds: ["T1"], o: 110, l: 150, p: 240 },
    { id: "T4", name: "Transformer erection, switchgear install & P&C cabling", short: "Erection & installation", preds: ["T2", "T3"], o: 70, l: 95, p: 160 },
    { id: "T5", name: "Commissioning, 87T/50-51 protection testing & energisation", short: "Commissioning & energisation", preds: ["T4"], o: 35, l: 55, p: 120 }
  ],
  costs: [
    { id: "C1", name: "Power transformer & 132 kV switchgear supply", short: "Transformer & switchgear", fixed: { o: 7800000, l: 8900000, p: 11500000 }, perDay: { o: 800, l: 1200, p: 2400 } },
    { id: "C2", name: "Civil works, foundations & control building", short: "Civil works", fixed: { o: 1900000, l: 2400000, p: 3600000 }, perDay: { o: 0, l: 0, p: 0 } },
    { id: "C3", name: "Electrical installation, P&C and cabling labour", short: "Installation labour", fixed: { o: 2600000, l: 3200000, p: 4700000 }, perDay: { o: 0, l: 0, p: 0 } },
    { id: "C4", name: "Commissioning, testing & utility witness fees", short: "Commissioning & testing", fixed: { o: 550000, l: 800000, p: 1400000 }, perDay: { o: 0, l: 0, p: 0 } },
    { id: "C5", name: "Project management, site overhead, insurance & financing", short: "PM & site overhead", fixed: { o: 400000, l: 600000, p: 900000 }, perDay: { o: 2800, l: 3600, p: 5200 } }
  ],
  correlations: [
    { id: "R1", a: "fix:C1", b: "dur:T2", rho: 0.5, note: "Tight transformer market: pricier and later" },
    { id: "R2", a: "dur:T4", b: "fix:C3", rho: 0.6, note: "Longer installation, more labour" },
    { id: "R3", a: "fix:C2", b: "fix:C3", rho: 0.4, note: "Shared site labour market" }
  ]
};

function scnRangeFor(kind, o, p) {
  if (kind === "days") {
    const min = Math.max(0, Math.round(0.5 * o));
    const max = Math.max(min + 10, Math.round(1.8 * p));
    return { min, max, step: 1 };
  } else if (kind === "money") {
    const min = Math.floor(0.5 * o / 10000) * 10000;
    const max = Math.max(min + 100000, Math.ceil(1.8 * p / 10000) * 10000);
    return { min, max, step: 10000 };
  } else if (kind === "rate") {
    if (o === 0 && p === 0) {
      return { min: 0, max: 2000, step: 25 };
    }
    const min = Math.floor(0.5 * o / 50) * 50;
    const max = Math.max(min + 500, Math.ceil(1.8 * p / 50) * 50);
    return { min, max, step: 50 };
  }
}

function scnNextId(items, prefix) {
  if (!items || items.length === 0) {
    return prefix + "1";
  }
  let maxNum = 0;
  for (const item of items) {
    if (item.id.startsWith(prefix)) {
      const numStr = item.id.slice(prefix.length);
      const num = parseInt(numStr, 10);
      if (!isNaN(num)) {
        maxNum = Math.max(maxNum, num);
      }
    }
  }
  return prefix + (maxNum + 1);
}

function scnNewTask(scenario) {
  const lastTask = scenario.tasks.length > 0 ? scenario.tasks[scenario.tasks.length - 1] : null;
  return {
    id: scnNextId(scenario.tasks, "T"),
    name: "New activity",
    short: "New activity",
    preds: lastTask ? [lastTask.id] : [],
    o: 20,
    l: 30,
    p: 50
  };
}

function scnNewCost(scenario) {
  return {
    id: scnNextId(scenario.costs, "C"),
    name: "New cost line",
    short: "New cost line",
    fixed: { o: 100000, l: 150000, p: 250000 },
    perDay: { o: 0, l: 0, p: 0 }
  };
}

function scnNewCorrelation(scenario) {
  let a, b;
  if (scenario.costs.length > 0) {
    a = "fix:" + scenario.costs[0].id;
    b = "dur:" + scenario.tasks[0].id;
  } else {
    a = "dur:" + scenario.tasks[0].id;
    b = "dur:" + (scenario.tasks[1] ? scenario.tasks[1].id : scenario.tasks[0].id);
  }
  return {
    id: scnNextId(scenario.correlations, "R"),
    a,
    b,
    rho: 0.3,
    note: ""
  };
}

function scnInputOptions(scenario) {
  const options = [];
  for (const task of scenario.tasks) {
    options.push({
      key: "dur:" + task.id,
      label: task.id + " · " + task.short + " — duration"
    });
  }
  for (const cost of scenario.costs) {
    options.push({
      key: "fix:" + cost.id,
      label: cost.id + " · " + cost.short + " — fixed cost"
    });
    const hasPerDay = cost.perDay.o !== 0 || cost.perDay.l !== 0 || cost.perDay.p !== 0;
    if (hasPerDay) {
      options.push({
        key: "day:" + cost.id,
        label: cost.id + " · " + cost.short + " — per-day cost"
      });
    }
  }
  return options;
}

function scnDescendants(tasks, id) {
  const descendants = new Set();
  const worklist = [id];

  while (worklist.length > 0) {
    const current = worklist.shift();
    for (const task of tasks) {
      if (task.preds && task.preds.includes(current) && !descendants.has(task.id)) {
        descendants.add(task.id);
        worklist.push(task.id);
      }
    }
  }

  return descendants;
}

function scnFmtRho(v) {
  const abs = Math.abs(v).toFixed(2);
  if (v > 0) {
    return "+" + abs;
  } else if (v < 0) {
    return "−" + abs;
  } else {
    return abs;
  }
}

function scnFmtMoney(v) {
  return "$" + (v / 1e6).toFixed(2) + "M";
}

function scnFmtMoneyTick(v) {
  const m = v / 1e6;
  const rounded = Math.round(m);
  const formatted = Math.abs(m - rounded) < 1e-9 ? rounded.toFixed(0) : m.toFixed(1);
  return "$" + formatted + "M";
}

function scnFmtRate(v) {
  return v === 0 ? "—" : "$" + (v / 1000).toFixed(1) + "k/d";
}

function scnFmtDays(v) {
  return Math.round(v).toLocaleString("en-US") + " d";
}

function scnFmtMonths(v) {
  return (v / 30.4375).toFixed(1) + " mo";
}

function scnFmtPct(v) {
  return Math.round(v * 100) + "%";
}

function scnAddDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Math.round(days));
  return date;
}

function scnFmtDate(isoDate, days) {
  const date = scnAddDays(isoDate, days);
  const monthAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return date.getUTCDate() + " " + monthAbbr[date.getUTCMonth()] + " " + date.getUTCFullYear();
}

function scnFmtDateTick(isoDate, days) {
  const date = scnAddDays(isoDate, days);
  const monthAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const twoDigitYear = String(date.getUTCFullYear()).slice(-2);
  return monthAbbr[date.getUTCMonth()] + " " + twoDigitYear;
}

window.__scn = { scnDefaultScenario, scnRangeFor, scnNextId, scnNewTask, scnNewCost, scnNewCorrelation, scnInputOptions, scnDescendants, scnFmtRho, scnFmtMoney, scnFmtMoneyTick, scnFmtRate, scnFmtDays, scnFmtMonths, scnFmtPct, scnAddDays, scnFmtDate, scnFmtDateTick };
