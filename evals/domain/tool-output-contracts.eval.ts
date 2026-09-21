import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

export default defineEval({
  description: "Every authored EVE tool declares a structured output contract",
  async test(t) {
    const agentDirectory = join(process.cwd(), "agent");
    const files = [
      ...collectTypeScriptFiles(join(agentDirectory, "tools")),
      ...collectTypeScriptFiles(join(agentDirectory, "subagents")),
    ];
    const tools = files.filter((file) =>
      readFileSync(file, "utf8").includes("defineTool("),
    );
    const missingOutputSchema = tools.filter(
      (file) => !readFileSync(file, "utf8").includes("outputSchema:"),
    );

    t.check(tools.length >= 57, equals(true));
    t.check(missingOutputSchema.length, equals(0));
  },
});
