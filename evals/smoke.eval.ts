import { defineEval } from "eve/evals";

/**
 * Smoke eval: verifies the eval infrastructure works.
 * The actual build correctness is verified by `npm run typecheck` and `npm run build`.
 */
export default defineEval({
  description: "Smoke test: eval runner works",
  async test(t) {
    // This passes if the eval infrastructure is functional
    t.succeeded();
  },
});