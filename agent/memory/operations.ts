import { fileMemory } from "eve/memory/file";
import { defineMemory } from "eve/memory";

/**
 * Cross-session operational context for this single-tenant marketing-ops app.
 *
 * Session state remains the source of truth while an operator is actively
 * planning. This bounded memory carries only compact, non-secret snapshots to
 * later schedule sessions. On Vercel it requires the official private Blob
 * binding created by `eve add memory/file`.
 */
export default defineMemory({
  description:
    "Store only compact approved plan snapshots, validation outcomes, decision owners, and durable guardrails for this marketing-ops workspace. Never store credentials, customer-level identifiers, raw audiences, coupon codes, or payment data.",
  namespace: "marketing-ops-operations-v1",
  provider: fileMemory({ maxCharacters: 8_000 }),
  scope: "workspace",
});
