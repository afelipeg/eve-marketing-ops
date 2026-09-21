# Eve/backend readiness

Audit date: 2026-09-20. Scope: Eve agent runtime, AI SDK/Gateway usage, Next.js integration,
channels, sandboxes, memory, schedules, evaluation coverage, and deployment readiness. The wider
ReUI remediation remains intentionally outside this pass.

## Ready for the prototype

- Eve discovery reports the authored agent without diagnostics.
- Root and specialist inference use Vercel AI Gateway with cost-sorted providers and bounded input,
  output, cost, and session duration. The aggregate root window is USD 5; see
  `docs/eve-runtime.md`.
- JEV is integrated as the Gateway evaluation model after a hidden, typed validation specialist.
  Zod and JSON Schema bound both sides of the workflow.
- The authored sandbox has deny-all networking and exposes only a typed synthetic-script bridge.
- Vercel Blob file memory is connected for development, preview, and production environments.
- The same-origin Next.js route graph is mounted with `withEve`, and `/chat` uses `useEveAgent`
  for sends, steering, cancellation, reset, streaming, typed human-in-the-loop responses, and
  URL-addressed durable-session resume at `/chat/[sessionId]`.
- Four schedules compile, and the strict Eve suite passes 9/9 evals and 72/72 gates.
- MCP and OpenAPI connections are intentionally absent during the prototype.

## P0 — required before production use

1. **Implement authenticated browser access.** Local browser traffic works through `localDev()`,
   but `EVE_CHANNEL_AUTH_SECRET` remains a placeholder and the application has no signed-in user
   session. Add a real identity provider/session verifier and map it to an Eve user principal (or
   add a server-side, short-lived JWT issuer tied to that verified session). Never expose the HMAC
   secret or an anonymous minting endpoint to the browser.
2. **Enforce session ownership.** Route authentication identifies a caller but Eve does not add a
   per-session ACL. Before multi-user access, persist ownership and authorize create, continue, and
   stream operations against the verified principal.
3. **Finish the web compile boundary.** The shared JSX conflict is resolved and the `/chat` surface
   type-checks, but existing ReUI/UI errors outside this integration still block the full web
   typecheck. The default Turbopack production build also needs a CI/Vercel smoke test because this
   restricted local host forbids the PostCSS worker from binding its loopback port.
4. **Deploy and smoke-test.** The linked Vercel project has no deployment yet. Validate channel
   auth, one browser session, one scheduled dispatch, Blob recall, and the Vercel Sandbox after the
   combined build passes.

## P1 — required before real data or broader access

1. Replace the file/sample boundary with a durable warehouse, database, or Blob-backed adapter.
   `MARKETING_DATA_DIR` is useful locally but is not a production data plane on serverless hosts.
2. Move budget, delegation, validation receipt, and idempotency records to a transactional durable
   ledger. Current plan state is session-local and operations memory is model-managed text.
3. Bind `allocate_budget` and `record_delegation` to server-issued receipts. They currently trust
   identifiers and checks copied into tool arguments by the model.
4. Add authenticated per-principal rate/concurrency limits and an external lifetime cost ledger if
   USD 50 must be an absolute cap across operator-approved Eve budget renewals.
5. Add metadata-only instrumentation for cost, duration, errors, retries, schedule outcomes, and
   sandbox failures. Keep prompts, outputs, and customer data disabled or redacted.
6. Decide workflow/session retention and deletion policy before ingesting real customer data.

## P2 — confidence and operations

1. Add synthetic golden evals for representative tools and failure modes in promotions,
   advertisements, recommendations, pricing, and measurement. Current coverage is strong around
   orchestration, validation contracts, schedules, and budgets, but not every domain algorithm.
2. Add a safe `.env.example` containing variable names and placeholders only.
3. Exercise schedule delivery and replay/idempotency with real Vercel development dispatches; prompt
   evals alone do not prove Cron identity, outbound delivery, or hosted persistence.

## Vercel skill applicability

- **Eve:** authoritative for the agent service graph and runtime contracts.
- **AI SDK:** installed version 7.0.107; current output-token and provider-option contracts match the
  runtime policy used by Eve.
- **React/Next best practices:** the existing config already optimizes heavy package imports. The
  future token route must authenticate and authorize inside the handler and keep request state local.
- **React Native:** not applicable because this project has no Expo or React Native runtime.
