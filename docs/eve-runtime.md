# Eve runtime configuration

## Channel authentication

`agent/channels/eve.ts` accepts, in order:

1. same-project Vercel OIDC;
2. `eve dev` / `vercel dev` local authentication;
3. a browser bearer JWT signed with `EVE_CHANNEL_AUTH_SECRET`.

Browser JWTs must use HS256, issuer `marketing-ops-web`, audience
`marketing-ops-agent`, a stable `sub`, and short-lived `iat`/`exp` claims. The placeholder value
`your_channel_auth_secret` is rejected by falling back to `placeholderAuth()`. The local
`.env.local` value is still a placeholder, and there is no authenticated UI token issuer yet, so
production browser traffic remains closed. Prefer verifying the application's real user session
with a custom Eve `AuthFn`; if the application instead issues JWTs, mint them only server-side and
only after verifying that session.

## Cross-session operations memory

`agent/memory/operations.ts` uses eve file memory with workspace scope. It is intentionally shared
by authorized users of this single-tenant operations workspace so schedule sessions can recall the
latest approved snapshot. Do not use this scope in a multi-tenant deployment without adding a
trusted tenant resolver to both user and scheduled principals.

Local `eve dev` uses process memory. Vercel production requires the official private Blob binding:

```sh
eve link --non-interactive --project <project-name-or-id>
eve add memory/file --non-interactive
```

The linked `marketing-ops` project has a private Blob store connected to production, preview, and
development through Vercel OIDC. The `operations` workspace slot and the generated `file`
per-principal slot use separate namespace/scope keys even though they share the same store.

## Connections and data

No external MCP or OpenAPI connection is enabled. Until the warehouse/CDP/ad-platform boundary is
chosen, business data comes only from validated files under `MARKETING_DATA_DIR` or disclosed
sample data. The complete file contract is in `docs/data-contract.md`.

## Validation and JEV

`validate_result` is a durable typed workflow rather than a direct, model-authored result. The
hidden `validation` specialist uses `openai/gpt-5.6-luna` through Vercel AI Gateway to draft the
structured decision. The workflow validates that decision with Zod and then calls
`evaluate({ model: "typesafe-ai/jev" })` through the Gateway evaluation API.

JEV is not configured as the specialist's language model: Gateway exposes it as an evaluation
model. It independently scores whether the supplied evidence supports the candidate decision and
selects the justified directive. A probability below `0.8` or a directive disagreement fails
closed to `REBRIEF`; the workflow owns the audit ID, timestamp, schema version, and JEV review
envelope. The end-to-end workflow eval covers the root agent, tool call, hidden specialist, and
JEV gate.

## Prototype inference budgets

Every selected language model routes through AI Gateway with `gateway.sort: "cost"`. Eve charges
completed child usage back to the parent, so the root session's USD 5 window is the aggregate
operating guardrail. It is intentionally one tenth of the operator's absolute USD 50 prototype
ceiling. Usage is checked between model calls; an interactive operator may explicitly grant a new
window, while schedules and delegated tasks fail rather than self-approving more budget.

| Runtime | Model / reasoning | Input | Output | Model cost | Lifetime |
| --- | --- | ---: | ---: | ---: | ---: |
| Root orchestrator and schedules | `anthropic/claude-sonnet-5` / medium | 400k | 80k | $5.00 | 7 days |
| Measurement | `anthropic/claude-sonnet-5` / medium | 160k | 24k | $1.25 | 60 min |
| Promotions, ads, recommendations, pricing | `deepseek/deepseek-v4-pro-0813` / medium | 120k | 20k | $0.75 | 60 min |
| Validation draft | `openai/gpt-5.6-luna` / low | 50k | 8k | $0.25 | 15 min |

Child limits are ceilings and are further reduced by the parent's remaining quota when Eve
dispatches them. The validation contract also caps long strings and collection sizes; routine
agent and schedule prompts specify compact word/table budgets. Workflow model-call batching stays
at Eve's durable default of one call per checkpoint so a replay cannot duplicate a wider batch of
inference costs.

Calibration on the `workflows/validation` eval (uncached root steps):

| Metric | Before | Calibrated | Change |
| --- | ---: | ---: | ---: |
| Root model cost reported by Gateway | $0.2339 | $0.0892 | -61.9% |
| Root input tokens | 31,766 | 32,150 | +1.2% |
| Root output tokens | 1,414 | 884 | -37.5% |
| End-to-end duration | 43.8 s | 22.7 s | -48.2% |

The trace exposes root model-step cost separately; child/JEV inference remains additionally bounded
by the child and aggregate parent limits above. The slightly larger input is expected because the
bounded Zod/JSON contracts remain in context instead of being weakened for savings.

## Sandbox

Root and declared subagents set `defaultTools: false`, so model-facing shell, arbitrary file
read/write, and open-web tools remain absent. The authored sandbox under `agent/sandbox/` uses
`defaultBackend()` (Vercel Sandbox when hosted, Docker/microsandbox locally) and applies a
deny-all network policy to every session. It seeds only committed scripts under
`agent/sandbox/workspace/scripts/`.

`run_prototype_script` is the only model-facing execution bridge. It accepts a typed task enum and
bounded numeric parameters, writes one JSON input inside the session workspace, invokes the fixed
seeded script, checks the exit code, parses JSON, and validates the result with Zod. It cannot run
an arbitrary command, path, package, or network request. Its outputs are always marked
`provenance: "synthetic"`.
