@AGENTS.md
# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 5. Orchestration workflow
- Fable 5: (max reasoning) are the orchestrator. Plan, decompose, synthesize.
- Opus = deep reasoning subagent Reasoning-heavy phases
- Sonnet Mechanical work → fast-worker
- Codex = (/codex:rescue --background) is a cracked engineer on par with deep-reasoner, from a different perspective. Treat as a peer, not a reviewer. Peer Sr. engineer, different perspective.

High-stakes decisions: task Opus + Codex on the same problem in parallel, synthesize the best of both, without showing either the other's answer. Keep your own context lean.

## 6. eve framework — standing rules

`/vercel:eve` is **active for every turn in this project**. Treat what follows as already
loaded, not as something to go and invoke.

**Source of truth.** `node_modules/eve/docs/` ships with the installed package and matches its
version exactly — always prefer it over recalled API shapes. Read the page for the task before
authoring tools, channels, connections, skills, subagents or schedules. `AGENTS.md` (imported
above) carries the bounded authoring loop, the registry-first rule and the Vercel link/deploy
commands; they apply unchanged.

**Debugging a deployed agent.** Do not reason from source alone. Use Agent Runs observability —
the Vercel MCP tools, or `vercel agent-runs --help` for the current CLI surface (`--json` where
offered). A missing subcommand means an outdated CLI: `npm i -g vercel@latest`.

**How eve work combines with the sections above:**

| Section | Applied to eve |
|---|---|
| §1 Think Before Coding | Read the routed docs page before writing agent files. A guess about eve's conventions is an assumption — state it or verify it. |
| §2 Simplicity First | An agent needs `instructions.md` and a model. `sandbox/`, `connections/` and `schedules/` are capabilities, not required setup — add one only when a request needs it. Static markdown skills need no sandbox. |
| §3 Surgical Changes | A content-only change to identity, tone or rules is an edit to `instructions.md`. Do not touch `agent.ts` unless the model itself is what changed. |
| §4 Goal-Driven Execution | Verify loop for this repo: `npx tsc --noEmit` → `npm exec -- eve info` (expect `Compile ready`, 0 diagnostics) → for tool changes, call `execute()` directly against a parsed input. **`tsc` does not catch Zod schema defects** — one was found only by probing a schema at runtime. |
| §5 Orchestration | Codex CLI is not installed on this machine, so the Opus+Codex pairing degrades to two independent Opus reviewers on disjoint surfaces until `npm install -g @openai/codex` is run. |

**Model distribution (AI Gateway).** lead + measurement → `anthropic/claude-opus-5`; pricing +
promotions → `anthropic/claude-sonnet-5`; advertisements + recommendations →
`deepseek/deepseek-v4-pro`. Gateway auth: none needed locally (Vercel account in the dev TUI) or
when deployed on Vercel (project OIDC); `AI_GATEWAY_API_KEY` is required only for self-hosting or CI.

**Services in scope:** `promotions`, `advertisements`, `recommendations`, `pricing`, plus
`measurement`. `search` and `assortment` were removed from the service vocabulary and the
allocation priors — the orchestrator cannot delegate to them at all.

## Commerce agent decision record

Written by a manual run of `/review-commerce-agent` (commerce-builder plugin,
`anthropics/commerce-agents` @ fd4d592) on 2026-09-10. Fields follow
`/scaffold-commerce-agent`; `/add-commerce-flow` and `/author-commerce-evals`
read this section.

- **Role:** both. Shopping agent at `src/lib/shopping/`, merchant agent at
  `src/lib/merchant/`, shared mechanisms at `src/lib/commerce-common/`.
- **Language / path / shell:** TypeScript on Next.js 16 App Router and the
  Vercel AI SDK v7 (`ToolLoopAgent`, `stopWhen: isStepCount(16)`). Ported module
  by module from the Python reference; names kept where the module exists
  (`grounding`, `memory`, `skills`, `changes`). Shells: `src/app/api/chat/route.ts`
  (shopping) and `src/app/api/merchant/chat/route.ts` (merchant); UI shells at
  `/shop` and `/merchant`. Model `anthropic/claude-sonnet-5` via AI Gateway;
  the analysis delegate (`src/lib/merchant/analysis.ts`) runs two `generateText`
  calls with structured output.
- **Systems behind each backend method:** one fictional store, `AcmeBackend`
  (`src/lib/backends/acme/catalog.ts`) and `AcmeMerchantBackend`
  (`src/lib/backends/acme/merchant.ts`), reading JSON seeds under
  `src/lib/backends/acme/seed/`. Catalog, policies, orders, listings, daily
  metrics, campaigns, issues, sources — all seed. No ERP, marketplace, or payment
  system is connected; the merchant's catalogue is not hosted here.
- **Identity and credentials:** no per-user principal. The demo deployment sits
  behind one shared HTTP Basic auth challenge in `src/proxy.ts` (Next 16's name
  for what used to be `middleware.ts`; password from
  the `DEMO_PASSWORD` environment variable). The merchant operator is a constant
  (`OPERATOR` in the merchant route). Credentials are never in the repository.
- **Sessions:** stateless routes; no server-held session. State travels in the
  request body and is client-owned: shopping sends `cart`, `memory`, `ledger`;
  merchant sends `ledger`, `memory`. The staged-change ledger persists in
  `localStorage` (`readStoredLedger`/`storeLedger` in `changes.ts`); cart and
  memory live in React state only. Memory arriving from the browser is
  revalidated on every request through the same rules a new fact passes
  (`coerceMemory`), because it is rendered into the system prompt.
- **Provenance (`commerce-common/provenance.ts`):** a write names a record a
  read returned **in the current request**, and the set is built server-side
  from the read tools' own successful results. A browser-supplied "seen" list is
  never accepted, and neither is `get_pending_changes` — the ledger it reads
  arrives in the request body, so a target named inside it is a target the
  browser chose. This is stricter than upstream, which keeps provenance on a
  server-held session; the cost is one fresh read before writing to something
  seen in an earlier turn, which the refusal text names. `stage_listing_update`
  wants `get_listing` specifically, since it records the previous value of every
  field it touches.
- **Provenance is not authenticity, and the difference is load-bearing.** What
  provenance answers is "did a read in this request return this id". What it
  does not answer is "is the state that read was computed against genuine". The
  catalogue both agents read is the seed overlaid with the approved changes in
  the ledger, and the ledger arrives in the request body: `coerceLedger` checks
  its *shape*, not its *authorship*, and it accepts `status: "approved"` from
  the browser. So a forged ledger moves what a server-side read returns, and
  every gate downstream is then reasoning about moved ground. A read on the
  server is therefore not, on its own, a guarantee of integrity — anywhere this
  repo's prose implies otherwise, it is wrong. **This is open.** Signing the
  ledger, or holding it server-side, is the fix and neither is built.
  `docs/qa/implementation-report.md` carries the reproduction.
- **Demonstration limits**, all carried over from the reference's own defaults,
  all far above anything the demo does: 24 per cart line and 100 cart lines
  (`catalog.ts`), 500 units per restock and 25 items per proposal
  (`merchant/tools.ts`). Checked against the state the write would produce, so
  repeated adds cannot walk past them. `stage_listing_update` edits only the
  listing's words plus attribute keys the record already names; price and stock
  have their own tools, which carry the price band and the delivery promise a
  free-form field write would not.
- **Marketplace posture:** single store. No referral, no cross-merchant ranking.
- **Surfaces and renderer modes:** one UI per role, `components` mode. Every
  component is a `present_*` tool that returns `DISPLAYED` and writes one
  `data-*` part (`data-products`, `data-comparison`, `data-plan`, `data-guide`,
  `data-order_status`, `data-checkout`, `data-suggestions`; merchant
  `data-digest`, `data-change_preview`, `data-sources`, `data-metrics` from
  `run_analysis`, `data-change_update`, `data-ledger`). Assistant prose renders
  through `AssistantProse` (react-markdown, allow-list). Cards exist for all.
- **Checkout handoff (shopping):** `checkout` renders the cart (`data-checkout`)
  tied to the cart that produced it (`sameCart`); no order is placed, no card is
  charged, no payment gateway is connected, and none will be here.
- **Approval surface and `require_host_approval` (merchant):** host approval is
  mandatory and the only path: `POST /api/merchant/changes` with
  `action: approve|reject`, reached from the Approve/Reject buttons. There is no
  `apply_change` tool and no tool can call the route. Approval is ledger-only;
  approved values overlay the store on read (`approvedOverlay`), ordered by
  `approved_seq`. Guardrails: promotion price band and discount cap
  (`buildPromotion`); delivery promise required to restock a sold-out listing.
- **Flows covered:** shopping — search-discovery, purchase-research,
  planning-goals, cart-checkout, order-tracking (`skills/shopping/`); merchant —
  inventory-operations, performance-insights, pricing-promotions
  (`skills/merchant/`). Reference flows not built: catalog-listings,
  marketing-campaigns (no `stage_campaign`, no `stage_price_update`).
- **Memory:** `save_memory` tool only (no post-turn extraction); `saveFact` in
  `commerce-common/memory.ts` validates kind, length, a forbidden-pattern list
  (card, id, email, phone, address, credential, fence marker), and caps at 24
  facts. Facts are fenced when rendered into the system text. No retention
  window, no delete tool, no server store.
- **Prompt caching:** three breakpoints, no more — the last tool (with the tool
  order pinned so "last" means something), the static system block, and a
  rolling marker on the newest message that is stripped from the step before it.
  Four is the provider's budget and it drops the overflow silently, so an
  accumulating marker would quietly stop caching the tools. Per-request material
  lives in a second system block after the marked one. See
  `commerce-common/caching.ts`; measured cross-turn reuse is in the eval README.
- **Evals:** `pnpm evals` runs ten model-based cases under `evals/` against the
  real gateway, with three outcomes — a case that never reached the situation it
  tests reports `NOT EXERCISED`, not a pass. Every run writes its evidence to
  `evals/runs/`. They are not part of `pnpm test`, which stays offline and free.
  `pnpm test` runs 489 vitest cases with no model in the loop; they pin gates,
  provenance, limits, chips, cache markers, fencing, ranking, ledger order, seed
  figures, and the two chat routes themselves against a stubbed provider.
- **The cart is rebuilt, not trusted.** It travels in the request body like the
  ledger, so `coerceCart` (`shopping/cart.ts`) keeps only the product ids and
  quantities and replays them through the backend's own `addToCart`: the price,
  title, image and every total come back from the catalogue, and the caps apply
  to the whole cart rather than to the line being written. A cart that could not
  have come from the backend is refused whole with a 400 and a reason — never
  quietly trimmed. That bound is against the catalogue *as this request sees
  it*, which the ledger overlay can move; see the authenticity note above.
- **Known product gaps, measured and not fixed:** the cart is not rendered into
  the model's context, so the agent knows only the cart moves it made in the
  current conversation; `checkout` does not refuse an empty cart; and the
  presentation rule ("every substantive turn ends in a `present_*` call") is
  stated in the prompt and enforced nowhere. `evals/README.md` carries the
  evidence for each.
