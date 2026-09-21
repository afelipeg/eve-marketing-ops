import { readFileSync } from "node:fs";

const SERVICE_PROFILES = {
  advertisements: { spendShare: 0.34, roas: 3.6, uplift: 5.4, volatility: 0.22 },
  promotions: { spendShare: 0.25, roas: 4.1, uplift: 1.4, volatility: 0.31 },
  recommendations: { spendShare: 0.17, roas: 5.2, uplift: 8.3, volatility: 0.18 },
  pricing: { spendShare: 0.12, roas: 7.1, uplift: 4.2, volatility: 0.25 },
  measurement: { spendShare: 0.12, roas: 0, uplift: 0, volatility: 0.08 },
};

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng) {
  const u = Math.max(Number.EPSILON, rng());
  const v = Math.max(Number.EPSILON, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function parseInput(path) {
  if (!path) fail("An input JSON path is required.");
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Could not parse input JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateInput(input) {
  assert(Number.isInteger(input.seed) && input.seed >= 1 && input.seed <= 0xffffffff, "seed must be a uint32 integer");
  assert(Number.isFinite(input.budget) && input.budget > 0, "budget must be positive");
  assert(Number.isInteger(input.iterations) && input.iterations >= 100 && input.iterations <= 10_000, "iterations must be 100..10000");
}

function allocateBudget(total) {
  const entries = Object.entries(SERVICE_PROFILES);
  let assigned = 0;
  return entries.map(([service, profile], index) => {
    const amount = index === entries.length - 1
      ? round(total - assigned)
      : round(total * profile.spendShare);
    assigned = round(assigned + amount);
    return { service, amount };
  });
}

function generateScenario(input) {
  validateInput(input);
  const rng = mulberry32(input.seed);
  const allocation = allocateBudget(input.budget);
  const services = allocation.map(({ service, amount }) => {
    const profile = SERVICE_PROFILES[service];
    const shock = normal(rng) * profile.volatility;
    const revenue = service === "measurement" ? 0 : Math.max(0, amount * profile.roas * (1 + shock));
    const uplift = service === "measurement" ? 0 : profile.uplift * (1 + shock);
    const ciHalfWidth = service === "measurement" ? 0 : 1.96 * profile.volatility * Math.max(1, Math.abs(uplift));
    return {
      service,
      spend: amount,
      revenue: round(revenue),
      incrementalMargin: round(revenue * 0.31 - amount),
      measuredUpliftPct: round(uplift),
      upliftCiLow: round(uplift - ciHalfWidth),
      upliftCiHigh: round(uplift + ciHalfWidth),
      significance: uplift - ciHalfWidth > 0 ? "significant" : "not-significant",
    };
  });

  return {
    task: "generate-scenario",
    provenance: "synthetic",
    seed: input.seed,
    iterations: input.iterations,
    budget: round(input.budget),
    currency: "USD",
    services,
    disclosure: "Synthetic rehearsal data generated in an isolated sandbox; not client observations.",
  };
}

function stressTest(input) {
  validateInput(input);
  const rng = mulberry32(input.seed);
  const allocation = allocateBudget(input.budget);
  const margins = [];
  let lossCount = 0;

  for (let iteration = 0; iteration < input.iterations; iteration += 1) {
    let margin = 0;
    for (const { service, amount } of allocation) {
      const profile = SERVICE_PROFILES[service];
      if (service === "measurement") {
        margin -= amount;
        continue;
      }
      const revenue = Math.max(0, amount * profile.roas * (1 + normal(rng) * profile.volatility));
      margin += revenue * 0.31 - amount;
    }
    margins.push(margin);
    if (margin < 0) lossCount += 1;
  }

  margins.sort((a, b) => a - b);
  const percentile = (p) => margins[Math.min(margins.length - 1, Math.floor(p * margins.length))];
  const mean = margins.reduce((sum, value) => sum + value, 0) / margins.length;

  return {
    task: "stress-test",
    provenance: "synthetic",
    seed: input.seed,
    iterations: input.iterations,
    budget: round(input.budget),
    currency: "USD",
    portfolio: {
      expectedIncrementalMargin: round(mean),
      p05IncrementalMargin: round(percentile(0.05)),
      p50IncrementalMargin: round(percentile(0.5)),
      p95IncrementalMargin: round(percentile(0.95)),
      probabilityOfLoss: round(lossCount / input.iterations, 4),
    },
    disclosure: "Synthetic Monte Carlo rehearsal generated in an isolated sandbox; not a forecast from client data.",
  };
}

const [task, inputPath] = process.argv.slice(2);
if (task === "self-test") {
  const result = generateScenario({ seed: 7, budget: 100_000, iterations: 100 });
  assert(result.services.reduce((sum, row) => sum + row.spend, 0) === 100_000, "allocation must reconcile exactly");
  process.stdout.write(JSON.stringify({ ok: true }));
} else {
  const input = parseInput(inputPath);
  const result = task === "generate-scenario"
    ? generateScenario(input)
    : task === "stress-test"
      ? stressTest(input)
      : fail(`Unsupported task: ${task}`);
  process.stdout.write(JSON.stringify(result));
}
