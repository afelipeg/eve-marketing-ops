import type { AgentLimitsDefinition, AgentModelOptionsDefinition } from "eve";

/**
 * Prototype inference policy.
 *
 * Eve charges completed child usage back to the parent session. The root
 * therefore owns the aggregate budget, while child limits stop one specialist
 * from consuming the whole remaining grant. Cost sorting keeps Gateway
 * failover while preferring the lowest-priced provider for the selected model.
 */
export const costSortedGateway = {
  providerOptions: {
    gateway: {
      sort: "cost",
    },
  },
} satisfies AgentModelOptionsDefinition;

export const rootPrototypeLimits = {
  maxInputTokensPerSession: 400_000,
  maxOutputTokensPerSession: 80_000,
  maxTokenCostUsdPerSession: 5,
  sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000,
} satisfies AgentLimitsDefinition;

export const domainPrototypeLimits = {
  maxInputTokensPerSession: 120_000,
  maxOutputTokensPerSession: 20_000,
  maxTokenCostUsdPerSession: 0.75,
  sessionTimeoutMs: 60 * 60 * 1_000,
} satisfies AgentLimitsDefinition;

export const measurementPrototypeLimits = {
  maxInputTokensPerSession: 160_000,
  maxOutputTokensPerSession: 24_000,
  maxTokenCostUsdPerSession: 1.25,
  sessionTimeoutMs: 60 * 60 * 1_000,
} satisfies AgentLimitsDefinition;

export const validationPrototypeLimits = {
  maxInputTokensPerSession: 50_000,
  maxOutputTokensPerSession: 8_000,
  maxTokenCostUsdPerSession: 0.25,
  sessionTimeoutMs: 15 * 60 * 1_000,
} satisfies AgentLimitsDefinition;
