import { defineCatalog } from "@json-render/core"
import { schema } from "@json-render/react/schema"
import { z } from "zod"

const runtimeStatus = z.enum(["ready", "running", "waiting", "error"])
const validationVerdict = z.enum(["ready", "running", "passed", "blocked", "failed"])
const toolState = z.enum(["running", "waiting", "complete", "error", "denied"])

export const operationsCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({ gap: z.enum(["sm", "md"]).default("md") }).strict(),
      description: "Vertical stack for control-plane sections.",
    },
    Section: {
      props: z
        .object({
          description: z.string().nullable(),
          title: z.string(),
        })
        .strict(),
      description: "Framed section with a title, description, and child rows.",
    },
    RuntimeRow: {
      props: z
        .object({
          detail: z.string(),
          model: z.string(),
          name: z.string(),
          status: runtimeStatus,
        })
        .strict(),
      description: "One configured EVE runtime and its current state.",
    },
    ValidationRow: {
      props: z
        .object({
          detail: z.string(),
          name: z.string(),
          verdict: validationVerdict,
        })
        .strict(),
      description: "One workflow or validation gate and its latest verdict.",
    },
    ToolContractRow: {
      props: z
        .object({
          contract: z.enum(["strict", "object"]),
          detail: z.string(),
          name: z.string(),
          state: toolState,
        })
        .strict(),
      description: "One EVE tool call rendered from its schema-validated result.",
    },
    BarChart: {
      props: z
        .object({
          currency: z.string().length(3).optional(),
          format: z.enum(["number", "currency", "percent"]).default("number"),
          series: z
            .array(
              z
                .object({
                  label: z.string(),
                  value: z.number().nonnegative(),
                })
                .strict(),
            )
            .max(8),
          title: z.string(),
        })
        .strict(),
      description: "Compact horizontal bar chart for verified operational or decision metrics.",
    },
  },
  actions: {},
})

export const operationsCatalogPrompt = operationsCatalog.prompt({
  system: "Compose a compact EVE operations panel from verified runtime and workflow facts.",
  customRules: [
    "Never invent a runtime, validation result, or metric.",
    "Prefer one runtime section, one validation section, and one activity chart.",
  ],
})
