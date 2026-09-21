import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { SAMPLE_EXPERIMENTS, SAMPLE_JOURNEYS } from "./data/sample";

/**
 * Test/control logs and conversion journeys.
 *
 * MARKETING_DATA_DIR/experiments.json and MARKETING_DATA_DIR/journeys.json are
 * served as provenance "external"; otherwise bundled sample rows are served as
 * provenance "sample" with a disclosure warning attached.
 */

const armSchema = z.object({
  n: z.number().int().min(0),
  conversions: z.number().min(0),
  revenue: z.number().optional(),
});

const cellSchema = z.object({
  label: z.string(),
  control: armSchema,
  treatment: armSchema,
});

export const experimentLogSchema = z.object({
  id: z.string(),
  service: z.string(),
  hypothesis: z.string(),
  design: z.enum(["randomized", "geo-holdout", "switchback", "observational", "synthetic"]),
  unit: z.string(),
  period: z.string(),
  brand: z.string(),
  territory: z.string(),
  metric: z.string(),
  cells: z.array(cellSchema).min(1),
  notes: z.string().optional(),
});
export type ExperimentLog = z.infer<typeof experimentLogSchema>;

export const journeyLogSchema = z.object({
  path: z.array(z.string()),
  converted: z.boolean(),
  count: z.number().int().min(1).default(1),
  value: z.number().optional(),
});
export type JourneyLog = z.infer<typeof journeyLogSchema>;

export type DataSet<T> = {
  rows: T[];
  provenance: "external" | "sample";
  source: string;
  warning?: string;
};

async function load<T>(
  fileName: string,
  schema: z.ZodType<T>,
  fallback: T[],
): Promise<DataSet<T>> {
  const dir = process.env.MARKETING_DATA_DIR?.trim();
  if (!dir) {
    return {
      rows: fallback,
      provenance: "sample",
      source: "bundled sample logs",
      warning:
        "SAMPLE DATA — not the client's real logs. Every interval derived from these rows is illustrative. Disclose this before reporting.",
    };
  }

  const path = join(dir, fileName);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(
      `MARKETING_DATA_DIR is set but ${path} could not be read: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const parsed = z.array(schema).safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`${path} does not match the expected schema: ${parsed.error.message}`);
  }
  return { rows: parsed.data, provenance: "external", source: path };
}

export const loadExperiments = () =>
  load<ExperimentLog>("experiments.json", experimentLogSchema, SAMPLE_EXPERIMENTS);

export const loadJourneys = () =>
  load<JourneyLog>("journeys.json", journeyLogSchema, SAMPLE_JOURNEYS);

/** Design validity checks run before any experiment is analyzed. */
export function auditDesign(experiment: ExperimentLog): {
  valid: boolean;
  blocking: string[];
  cautions: string[];
} {
  const blocking: string[] = [];
  const cautions: string[] = [];

  const totalControl = experiment.cells.reduce((s, c) => s + c.control.n, 0);
  const totalTreatment = experiment.cells.reduce((s, c) => s + c.treatment.n, 0);

  if (totalControl === 0) {
    blocking.push("No control exposures: causal uplift is not identified. Propose an observational design or a new test.");
  }
  if (totalTreatment === 0) {
    blocking.push("No treatment exposures: nothing to measure.");
  }
  if (experiment.design === "observational") {
    cautions.push(
      "Observational design: assignment was not randomized, so the estimate carries selection bias. Report it as an association with the identifying assumption stated, never as a causal uplift.",
    );
  }
  if (totalControl > 0 && totalTreatment > 0) {
    const ratio = totalTreatment / totalControl;
    if (ratio > 3 || ratio < 1 / 3) {
      cautions.push(`Arm imbalance ${ratio.toFixed(2)}:1 — verify the randomization and the exposure log.`);
    }
  }
  const thin = experiment.cells.filter((c) => c.control.n < 1_000 || c.treatment.n < 1_000);
  if (thin.length > 0) {
    cautions.push(
      `Thin cells (${thin.map((c) => c.label).join(", ")}): pool them hierarchically with gibbs_hierarchical_uplift rather than reading each separately.`,
    );
  }

  return { valid: blocking.length === 0, blocking, cautions };
}
