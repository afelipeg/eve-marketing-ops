import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import {
  domainPrototypeLimits,
  measurementPrototypeLimits,
  rootPrototypeLimits,
  validationPrototypeLimits,
} from "../../agent/lib/runtime-budgets";

export default defineEval({
  description: "Prototype inference budgets stay bounded below the USD 50 session ceiling",
  async test(t) {
    const rootCost = Number(rootPrototypeLimits.maxTokenCostUsdPerSession);
    const childCosts = [
      domainPrototypeLimits,
      measurementPrototypeLimits,
      validationPrototypeLimits,
    ].map((limits) => Number(limits.maxTokenCostUsdPerSession));

    t.check(rootCost < 50, equals(true));
    t.check(rootCost, equals(5));
    t.check(rootPrototypeLimits.maxOutputTokensPerSession, equals(80_000));
    t.check(domainPrototypeLimits.maxOutputTokensPerSession, equals(20_000));
    t.check(measurementPrototypeLimits.maxOutputTokensPerSession, equals(24_000));
    t.check(validationPrototypeLimits.maxOutputTokensPerSession, equals(8_000));
    t.check(childCosts.every((cost) => cost > 0 && cost < rootCost), equals(true));
    t.check(
      Number(validationPrototypeLimits.maxOutputTokensPerSession) <
        Number(domainPrototypeLimits.maxOutputTokensPerSession),
      equals(true),
    );
    t.check(
      Number(rootPrototypeLimits.sessionTimeoutMs) < 30 * 24 * 60 * 60 * 1_000,
      equals(true),
    );
  },
});
