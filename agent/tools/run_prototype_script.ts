import { defineTool } from "eve/tools";
import { z } from "zod";

const serviceResultSchema = z.object({
  service: z.enum(["advertisements", "promotions", "recommendations", "pricing", "measurement"]),
  spend: z.number().nonnegative(),
  revenue: z.number().nonnegative(),
  incrementalMargin: z.number(),
  measuredUpliftPct: z.number(),
  upliftCiLow: z.number(),
  upliftCiHigh: z.number(),
  significance: z.enum(["significant", "not-significant"]),
});

const resultSchema = z.discriminatedUnion("task", [
  z.object({
    task: z.literal("generate-scenario"),
    provenance: z.literal("synthetic"),
    seed: z.number().int(),
    iterations: z.number().int(),
    budget: z.number().positive(),
    currency: z.literal("USD"),
    services: z.array(serviceResultSchema).length(5),
    disclosure: z.string().min(1),
  }),
  z.object({
    task: z.literal("stress-test"),
    provenance: z.literal("synthetic"),
    seed: z.number().int(),
    iterations: z.number().int(),
    budget: z.number().positive(),
    currency: z.literal("USD"),
    portfolio: z.object({
      expectedIncrementalMargin: z.number(),
      p05IncrementalMargin: z.number(),
      p50IncrementalMargin: z.number(),
      p95IncrementalMargin: z.number(),
      probabilityOfLoss: z.number().min(0).max(1),
    }),
    disclosure: z.string().min(1),
  }),
]);

export default defineTool({
  availableInSubagents: true,
  description:
    "Run an allowlisted deterministic prototype script in the isolated sandbox. Generates a five-service synthetic scenario or stress-tests it. Results always have provenance 'synthetic' and are rehearsal data, never client observations.",
  inputSchema: z.object({
    task: z.enum(["generate-scenario", "stress-test"]),
    seed: z.number().int().min(1).max(0xffff_ffff).default(7),
    budget: z.number().positive().max(1_000_000_000),
    iterations: z.number().int().min(100).max(10_000).default(1_000),
  }),
  outputSchema: resultSchema,
  label: {
    start: ({ task }) => `Run prototype script · ${task}`,
  },
  async execute(input, ctx) {
    const sandbox = await ctx.getSandbox();
    const runId = ctx.callId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const inputPath = `runs/${runId}/input.json`;
    await sandbox.writeTextFile({
      path: inputPath,
      content: JSON.stringify(input),
    });

    const result = await sandbox.run({
      command: `node scripts/prototype-runner.mjs ${input.task} ${inputPath}`,
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `Prototype script failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (error) {
      throw new Error(
        `Prototype script returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return resultSchema.parse(parsed);
  },
});
