export const ASSISTANT_NAME = "Marketing Ops Orchestrator"

export type ModelRecord = {
  id: string
  name: string
  provider: string
  /** Context window label; contextTokens is the same number for the math. */
  context: string
  contextTokens: number
  capability: string
  /** Called out in the picker as the default for most work. */
  recommended?: boolean
}

export const MODELS: ModelRecord[] = [
  {
    id: "claude-sonnet-5",
    name: "Claude Sonnet 5",
    provider: "Anthropic",
    context: "200K",
    contextTokens: 200_000,
    capability: "Code",
    recommended: true,
  },
  {
    id: "gpt-5-1",
    name: "GPT-5.1",
    provider: "OpenAI",
    context: "256K",
    contextTokens: 256_000,
    capability: "Balanced",
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    provider: "Google",
    context: "1M",
    contextTokens: 1_000_000,
    capability: "Long input",
  },
  {
    id: "mistral-large",
    name: "Mistral Large",
    provider: "Mistral",
    context: "128K",
    contextTokens: 128_000,
    capability: "Fastest",
  },
]

export type PersonRecord = {
  name: string
  initials: string
  avatar: string
}

/** The signed in viewer: their turns render on the end side of the thread. */
export const JONAS: PersonRecord = {
  name: "Jonas Weber",
  initials: "JW",
  avatar: "https://github.com/shadcn.png",
}

export const MAYA: PersonRecord = {
  name: "Maya Chen",
  initials: "MC",
  avatar:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
}

export const PRIYA: PersonRecord = {
  name: "Priya Nair",
  initials: "PN",
  avatar:
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
}

/** Context accounting for the open thread; the limit is the picked model's. */
export const TOKEN_USAGE = {
  used: 42_000,
  costLabel: "<$50 session cap",
}

export const NEW_THREAD_ID = "th_new"

export type StarterCategory = {
  id: string
  label: string
  prompts: string[]
}

/** Welcome screen: a category rail plus the questions it suggests. */
export const STARTER_CATEGORIES: StarterCategory[] = [
  {
    id: "create",
    label: "Create",
    prompts: [
      "Create a cost-efficient acquisition plan for this quarter",
      "Draft a promotion experiment with approval gates",
      "Build a campaign brief from a business objective",
    ],
  },
  {
    id: "explore",
    label: "Explore",
    prompts: [
      "Which channel should receive the next budget increment",
      "Summarize the latest agent run and its evidence",
      "Show which workflow step is blocking execution",
    ],
  },
  {
    id: "code",
    label: "Validate",
    prompts: [
      "Run JEV validation on the current recommendation",
      "Check the Zod contract for the measurement handoff",
      "Find tool failures in the latest workflow",
    ],
  },
  {
    id: "learn",
    label: "Learn",
    prompts: [
      "Explain how budget reallocation decisions are approved",
      "How do specialist agents share typed outputs",
      "What telemetry is available in this prototype",
    ],
  },
]

export type ThreadRecord = {
  id: string
  title: string
  updatedLabel: string
  /** Recency section the switcher files this thread under. */
  recency: "today" | "earlier"
  pinned: boolean
  /** File the thread produced or reads, shown as meta on its switcher row. */
  artifact?: string
}

export const THREADS: ThreadRecord[] = [
  {
    id: "th_9f2k4m",
    title: "Stripe webhook 500s on charge.refunded",
    updatedLabel: "2m",
    recency: "today",
    pinned: true,
    artifact: "stripe-webhook.ts",
  },
  {
    id: "th_f2a611",
    title: "Admin guide refresh",
    updatedLabel: "1h",
    recency: "today",
    pinned: true,
    artifact: "admin-notes-3.4.pdf",
  },
  {
    id: "th_c31f88",
    title: "Stream chat responses",
    updatedLabel: "2h",
    recency: "today",
    pinned: false,
  },
  {
    id: "th_b820ee",
    title: "Churn by plan tier",
    updatedLabel: "3h",
    recency: "today",
    pinned: false,
    artifact: "churn-q3.csv",
  },
  {
    id: "th_6ea2c7",
    title: "Audit log export limits",
    updatedLabel: "5h",
    recency: "today",
    pinned: true,
    artifact: "audit-export.csv",
  },
  {
    id: "th_5c19a0",
    title: "Mobile onboarding revamp scope",
    updatedLabel: "Yesterday",
    recency: "earlier",
    pinned: false,
  },
  {
    id: "th_77de31",
    title: "Why is p95 latency up on eu-west",
    updatedLabel: "Yesterday",
    recency: "earlier",
    pinned: false,
  },
  {
    id: "th_4b13d9",
    title: "SCIM group sync cadence",
    updatedLabel: "Yesterday",
    recency: "earlier",
    pinned: false,
  },
  {
    id: "th_e3806b",
    title: "Rewrite the trial expiry email",
    updatedLabel: "Tue",
    recency: "earlier",
    pinned: false,
    artifact: "trial-expiry.txt",
  },
  {
    id: "th_1ad4e8",
    title: "Session timeout per workspace",
    updatedLabel: "Tue",
    recency: "earlier",
    pinned: false,
  },
  {
    id: "th_a90f52",
    title: "Postgres index for events table",
    updatedLabel: "Mon",
    recency: "earlier",
    pinned: false,
    artifact: "migration.sql",
  },
  {
    id: "th_bb90c4",
    title: "Dead letter replay script",
    updatedLabel: "Mon",
    recency: "earlier",
    pinned: false,
    artifact: "replay-events.ts",
  },
  {
    id: "th_30f7a1",
    title: "Duplicate invite emails",
    updatedLabel: "Fri",
    recency: "earlier",
    pinned: false,
  },
]

/**
 * Marker step shown while a live send in the thread waits for its reply, so
 * the beat names real work instead of a generic "Thinking".
 */
export const THREAD_ACTIVITY: Record<string, string> = {
  th_9f2k4m: "Reading stripe-webhook.ts",
  th_f2a611: "Reading admin-notes-3.4.pdf",
  th_c31f88: "Reading app/api/chat/route.ts",
  th_b820ee: "Scanning churn-q3.csv",
  th_6ea2c7: "Counting rows in audit-export.csv",
  th_5c19a0: "Rereading the onboarding funnel",
  th_77de31: "Checking eu-west query plans",
  th_4b13d9: "Reading the SCIM sync settings",
  th_e3806b: "Rereading trial-expiry.txt",
  th_1ad4e8: "Reading the workspace policy",
  th_a90f52: "Checking the index build",
  th_bb90c4: "Reading replay-events.ts",
  th_30f7a1: "Reading the invite send log",
  [NEW_THREAD_ID]: "Searching the workspace",
}

export type MessagePart =
  | { kind: "text"; text: string }
  | { kind: "code"; language: string; code: string; filename?: string }
  | { kind: "image"; src: string; alt: string; caption: string }
  | { kind: "file"; name: string; meta: string }

export type ChatMessageRecord = {
  id: string
  role: "user" | "assistant"
  /** Null on assistant turns: the assistant is not a human author record. */
  author: PersonRecord | null
  parts: MessagePart[]
  at: string
  /** Emoji already left on this turn by teammates in the thread. */
  reactions?: string[]
}

export type TranscriptRecord = {
  /** Turns already committed to the thread. */
  messages: ChatMessageRecord[]
  /** Set only on a thread whose reply is still arriving. */
  pending?: {
    activityLabel: string
    parts: MessagePart[]
    at: string
    /** Appended when the run finishes on its own; withheld when stopped. */
    rest?: string
  }
  /** Shown above the first turn when earlier context was compacted away. */
  compacted?: string
  /** Date separator above the scrollback when it spans a day boundary. */
  dateLabel?: string
}

/**
 * One transcript per thread. The webhook thread is the one still working, so
 * the demo opens on a reply mid arrival.
 */
/** Keyed on the terms the starter prompts use, so a demo send gets a real answer. */
const REPLY_LIBRARY: { match: string[]; parts: MessagePart[] }[] = [
  {
    match: ["release notes", "shipped in 3.4", "what changed in 3.4"],
    parts: [
      {
        kind: "text",
        text: "Three admin facing changes in 3.4. SCIM group sync now runs every 15 minutes instead of hourly, audit log export accepts a date range, and the session timeout is per workspace rather than per org.",
      },
      {
        kind: "text",
        text: "The one that generates tickets is the timeout: admins who pinned SCIM sync to hourly in 3.2 keep the old cadence until they clear the override.",
      },
    ],
  },
  {
    match: ["rollback", "revert"],
    parts: [
      {
        kind: "text",
        text: "Rollback is two steps, and the order matters. Pause the webhook consumer first, otherwise the replay queue drains against the old handler:",
      },
      {
        kind: "code",
        language: "bash",
        filename: "Terminal",
        code: "flyctl scale count webhook-consumer=0 --app halcyon-prod\nflyctl deploy --image registry.fly.io/halcyon:3.3.8 --app halcyon-prod\nflyctl scale count webhook-consumer=2 --app halcyon-prod",
      },
      {
        kind: "text",
        text: "Events queued during the pause survive: Stripe retries for 3 days, so anything inside that window replays once the consumer is back.",
      },
      {
        kind: "text",
        text: "3.3.8 predates the `payment_intent` refactor, so the null guard comes back with it and the 500s stop at the same time. What it also reverts is the 15 minute SCIM cadence, which drops back to hourly until you redeploy.",
      },
      {
        kind: "code",
        language: "bash",
        filename: "Terminal",
        code: 'flyctl logs --app halcyon-prod | grep "charge.refunded" | tail -20\ncurl -s https://halcyon-prod.fly.dev/healthz | jq ".version, .queue_depth"',
      },
      {
        kind: "text",
        text: "Queue depth should fall below 5 within about two minutes. If it holds flat the consumer came back on the wrong image, and the version field tells you which one.",
      },
    ],
  },
  {
    match: ["trial expiry", "expiry email", "rewrite the trial"],
    parts: [
      {
        kind: "text",
        text: "Reframed around what they already built, with the deadline last. Merge fields in braces:",
      },
      {
        kind: "code",
        language: "text",
        filename: "trial-expiry.txt",
        code: "Subject: Your {workspace_name} trial ends {expiry_date}\n\n{first_name}, you have built {view_count} saved views and\nbrought in {teammate_count} teammates.\n\nAll of it stays exactly where it is. Keep going any time.",
      },
    ],
  },
  {
    match: ["churn", "plan tier"],
    parts: [
      {
        kind: "text",
        text: "Starter, by a wide margin. 418 of 521 cancellations last quarter came from the 6,240 Starter accounts, a 6.7 percent rate against 1.9 percent on Growth and 0.8 percent on Scale.",
      },
      {
        kind: "text",
        text: "The median Starter cancellation lands 41 days in, which is just past the second invoice.",
      },
    ],
  },
  {
    match: ["latency", "eu-west", "p95", "slowest query"],
    parts: [
      {
        kind: "text",
        text: "p95 on eu-west went from 190 ms to 405 ms between 13:50 and 14:10, all of it in GET /v1/audit-events. `events_workspace_created_idx` was built on primary but never on the eu-west replica, so the planner there is sequential scanning 94 GB per request.",
      },
      {
        kind: "text",
        text: "Building it with `concurrently` takes no write lock, but replication lag will climb for the 30 or so minutes it runs. Pause the export job first.",
      },
    ],
  },
  {
    match: ["stripe-webhook", "500", "refund webhook", "webhook flow"],
    parts: [
      {
        kind: "text",
        text: "Every failing payload is a refund on a charge created outside a PaymentIntent, so `payment_intent` arrives null and the 3.4 refactor stopped guarding it:",
      },
      {
        kind: "code",
        language: "typescript",
        filename: "stripe-webhook.ts",
        code: "const intent = event.data.object.payment_intent\nconst order = intent\n  ? await orders.byIntent(intent)\n  : await orders.byCharge(event.data.object.id)",
      },
      {
        kind: "text",
        text: "The charge id is always present on a refund event, so the fallback covers every case the handler sees. Worth adding while you are in there: the handler throws before it reaches the retry wrapper, which is why Stripe saw a 500 rather than a 200 with a logged failure.",
      },
      {
        kind: "code",
        language: "typescript",
        filename: "stripe-webhook.ts",
        code: 'export async function POST(request: Request) {\n  const event = await verifySignature(request)\n\n  try {\n    await handlers[event.type]?.(event)\n  } catch (error) {\n    // Stripe retries a 500 for 3 days. Anything we can replay ourselves\n    // should ack and land in the dead letter table instead.\n    await deadLetters.record(event, error)\n    logger.error("webhook.failed", { type: event.type, id: event.id })\n  }\n\n  return Response.json({ received: true })\n}',
      },
      {
        kind: "text",
        text: "With that in place a bad payload costs one row instead of 3 days of retries. The 41 queued events still need the guard above to replay cleanly, so ship both together.",
      },
      {
        kind: "code",
        language: "bash",
        filename: "Terminal",
        code: "pnpm test webhooks/refund --run\npnpm tsx scripts/replay-events.ts --type charge.refunded --since 24h",
      },
      {
        kind: "text",
        text: "The replay script is idempotent, it skips anything already marked settled, so running it twice is safe.",
      },
    ],
  },
  {
    match: ["index", "events table"],
    parts: [
      {
        kind: "text",
        text: "The audit export filters on workspace then orders by created_at, so a composite in that order lets the planner use it for both:",
      },
      {
        kind: "code",
        language: "sql",
        filename: "migration.sql",
        code: "create index concurrently events_workspace_created_idx\n  on events (workspace_id, created_at desc);",
      },
      {
        kind: "text",
        text: "It ran 34 minutes on primary. Build it on each replica separately, `concurrently` so nothing takes a write lock.",
      },
      {
        kind: "text",
        text: "Check the planner picked it up before you call it done. On 94 GB the difference is a sequential scan against an index scan, and the row estimate should land within an order of magnitude of the actual:",
      },
      {
        kind: "code",
        language: "sql",
        filename: "verify.sql",
        code: "explain (analyze, buffers)\nselect * from events\nwhere workspace_id = 'ws_halcyon'\norder by created_at desc\nlimit 100;",
      },
      {
        kind: "text",
        text: "One caveat on `concurrently`: it can fail and leave an invalid index behind, which the planner ignores while it still costs writes. If the build errors, drop it before retrying.",
      },
    ],
  },

  {
    match: ["stream", "buffers", "chat route", "token by token"],
    parts: [
      {
        kind: "text",
        text: "The route awaits the model call, so nothing reaches the client until the last token. Return the stream instead and the parts protocol handles the rest:",
      },
      {
        kind: "code",
        language: "typescript",
        filename: "app/api/chat/route.ts",
        code: 'export async function POST(request: Request) {\n  const { messages } = await request.json()\n\n  const result = streamText({\n    model: openai("gpt-5"),\n    system: "You are a concise assistant.",\n    messages,\n    temperature: 0.2,\n    maxOutputTokens: 1024,\n  })\n\n  return result.toUIMessageStreamResponse()\n}',
      },
      {
        kind: "text",
        text: "On the client, render the parts as they arrive rather than waiting for a finished message. Text parts append, and a tool part swaps to its result in place:",
      },
      {
        kind: "code",
        language: "tsx",
        filename: "components/thread.tsx",
        code: 'const { messages, status } = useChat()\n\nreturn messages.map((message) => (\n  <Bubble key={message.id}>\n    {message.parts.map((part, index) =>\n      part.type === "text" ? (\n        <p key={index}>{part.text}</p>\n      ) : (\n        <ToolCall key={index} part={part} />\n      )\n    )}\n    {status === "streaming" ? <Caret /> : null}\n  </Bubble>\n))',
      },
      {
        kind: "text",
        text: "Two things bite here. Buffering proxies hold the response until it closes, so set `X-Accel-Buffering: no` if you sit behind nginx. And keep the scroll pinned to the bottom while the last message grows, otherwise long replies type below the fold.",
      },
    ],
  },
  {
    match: ["scim", "group sync", "sso"],
    parts: [
      {
        kind: "text",
        text: "SCIM group sync maps your identity provider groups to workspace roles. It polls every 15 minutes as of 3.4, and a role change in the provider takes effect on the next poll rather than at next login.",
      },
      {
        kind: "text",
        text: "Deprovisioning is immediate though: a SCIM delete revokes sessions right away instead of waiting for the poll.",
      },
    ],
  },
  {
    match: ["audit log", "audit export"],
    parts: [
      {
        kind: "text",
        text: "The export covers authentication events, permission changes, data exports and admin actions, with actor, target, IP and timestamp on each row. It does not include reads of ordinary records, which is why it stays small enough to ship as CSV.",
      },
    ],
  },
]

/**
 * Rotated for anything the library does not match. The long one leads so a
 * first send still shows a full reply arriving rather than a one line ask.
 */
const FALLBACK_REPLIES: MessagePart[][] = [
  [
    {
      kind: "text",
      text: "Nothing in the workspace matches that yet, so I will show you the shape we use and you can point me at the right file after. Every task in Halcyon resolves the workspace first, does the work behind a guard, then records it:",
    },
    {
      kind: "code",
      language: "typescript",
      filename: "lib/run-task.ts",
      code: "export async function runTask(request: Request, task: Task) {\n  const workspace = await withWorkspace(request)\n\n  const result = await task.run({\n    workspace,\n    logger: logger.child({ task: task.name }),\n  })\n\n  await audit.record({\n    action: task.name,\n    workspace: workspace.id,\n    actor: workspace.actor,\n  })\n\n  return result\n}",
    },
    {
      kind: "text",
      text: "The guard is the part worth copying. `withWorkspace` resolves the tenant once and rejects anything the caller does not own, so no handler repeats that check and none of them can forget it:",
    },
    {
      kind: "code",
      language: "typescript",
      filename: "lib/with-workspace.ts",
      code: 'export async function withWorkspace(request: Request) {\n  const session = await auth(request)\n  if (!session) throw new HttpError(401, "Not signed in")\n\n  const id = request.headers.get("x-workspace-id")\n  const workspace = id ? await workspaces.byId(id) : session.defaultWorkspace\n\n  if (!workspace || !session.canAccess(workspace)) {\n    throw new HttpError(403, "No access to this workspace")\n  }\n\n  return { ...workspace, actor: session.user.id }\n}',
    },
    {
      kind: "text",
      text: "Point me at the handler you want and I will fit it to this. If it needs a migration it waits for the 3.4 freeze to lift on Thursday.",
    },
  ],
  [
    {
      kind: "text",
      text: "I can work on that against the Halcyon Labs workspace. Do you mean production or the 3.4 staging environment? The two have been diverging since Monday.",
    },
  ],
  [
    {
      kind: "text",
      text: "Happy to. One constraint worth knowing first: the 3.4 freeze is on until Thursday, so anything that touches a migration ships after it lifts. Staging is open though, and it carries a copy of Monday's data:",
    },
    {
      kind: "code",
      language: "bash",
      filename: "Terminal",
      code: "pnpm halcyon shell --env staging\npnpm halcyon run --task audit-export --workspace ws_halcyon --dry-run",
    },
    {
      kind: "text",
      text: "`--dry-run` prints the plan and writes nothing, so it is safe to run while the freeze is on.",
    },
  ],
  [
    {
      kind: "text",
      text: "I checked the workspace and nothing matches that yet. If you point me at the repo or the dashboard it lives in, I can pull the details.",
    },
  ],
]

/** Repeat sends rotate the fallback, so the demo never answers twice alike. */
export function draftReply(prompt: string, turn = 0): MessagePart[] {
  const needle = prompt.toLowerCase()
  const hit = REPLY_LIBRARY.find((entry) =>
    entry.match.some((term) => needle.includes(term))
  )
  if (hit) return hit.parts

  return FALLBACK_REPLIES[turn % FALLBACK_REPLIES.length]
}

export const TRANSCRIPTS: Record<string, TranscriptRecord> = {
  th_c31f88: {
    messages: [
      {
        id: "s_01",
        role: "user",
        author: JONAS,
        at: "10:04",
        parts: [
          {
            kind: "text",
            text: "the chat route buffers the whole reply before it renders. how do i stream it",
          },
        ],
      },
      {
        id: "s_02",
        role: "assistant",
        author: null,
        at: "10:05",
        parts: [
          {
            kind: "text",
            text: "Return the stream instead of awaiting it. `toUIMessageStreamResponse` keeps the parts protocol the client already reads, so nothing on the UI side changes:",
          },
          {
            kind: "code",
            language: "typescript",
            filename: "app/api/chat/route.ts",
            code: 'export async function POST(request: Request) {\n  const { messages } = await request.json()\n\n  const result = streamText({\n    model: openai("gpt-5"),\n    system: "You are a concise assistant.",\n    messages,\n    temperature: 0.2,\n    maxOutputTokens: 1024,\n  })\n\n  result.usage.then((usage) => {\n    metrics.record("chat.tokens", usage.totalTokens)\n  })\n\n  return result.toUIMessageStreamResponse()\n}',
          },
          {
            kind: "text",
            text: "`result.usage` settles after the stream closes, so recording it does not hold the response open.",
          },
        ],
      },
      {
        id: "s_03",
        role: "user",
        author: JONAS,
        at: "10:12",
        parts: [
          {
            kind: "text",
            text: "and the snippets in the transcript, what renders those",
          },
        ],
      },
      {
        id: "s_04",
        role: "assistant",
        author: null,
        at: "10:13",
        parts: [
          {
            kind: "text",
            text: "The code block primitive. Add it once:",
          },
          {
            kind: "code",
            language: "bash",
            filename: "Terminal",
            code: "pnpm dlx shadcn@latest add @reui/c-code-block-5",
          },
          {
            kind: "text",
            text: "Then pass the source and let it own the chrome. It highlights with Shiki, folds by indentation, and animates rows only while `streaming` is set:",
          },
          {
            kind: "code",
            language: "tsx",
            filename: "snippet.tsx",
            code: 'export function Snippet({ code }: { code: string }) {\n  return (\n    <CodeBlock code={code} language="typescript" showLineNumbers foldable>\n      <CodeBlockHeader>\n        <CodeBlockTitle>route.ts</CodeBlockTitle>\n        <CodeBlockCopyButton className="ms-auto" />\n      </CodeBlockHeader>\n      <CodeBlockContent />\n    </CodeBlock>\n  )\n}',
          },
        ],
      },
    ],
  },

  [NEW_THREAD_ID]: { messages: [] },
  th_9f2k4m: {
    dateLabel: "Yesterday",
    compacted: "Earlier turns compacted to save context",
    messages: [
      {
        id: "m_01",
        role: "user",
        author: JONAS,
        at: "9:12",
        parts: [
          {
            kind: "text",
            text: "stripe-webhook.ts is returning 500 on charge.refunded since the 3.4 deploy. 41 events queued. any idea?",
          },
        ],
      },
      {
        id: "m_02",
        role: "assistant",
        author: null,
        at: "9:12",
        parts: [
          {
            kind: "text",
            text: "I read the handler and the last 20 failures in the events table. Every failing payload is a refund on a charge that was created outside a PaymentIntent, so `payment_intent` is null. The 3.4 refactor stopped guarding it:",
          },
          {
            kind: "code",
            language: "typescript",
            filename: "stripe-webhook.ts",
            code: "const intent = event.data.object.payment_intent\nconst order = await orders.byIntent(intent)",
          },
          {
            kind: "text",
            text: "Line 2 calls `orders.byIntent(null)`, which throws before the handler ever reaches its retry wrapper. The 21 refunds that succeeded in the same window were all on PaymentIntent charges.",
          },
        ],
      },
      {
        id: "m_03",
        role: "user",
        author: JONAS,
        at: "9:14",
        parts: [{ kind: "text", text: "makes sense. what's the smallest fix" }],
      },
      {
        id: "m_04",
        role: "assistant",
        author: null,
        at: "9:15",
        parts: [
          {
            kind: "text",
            text: "Guard the lookup and fall back to the charge id, which is always present on a refund event:",
          },
          {
            kind: "code",
            language: "typescript",
            filename: "stripe-webhook.ts",
            code: "const intent = event.data.object.payment_intent\nconst order = intent\n  ? await orders.byIntent(intent)\n  : await orders.byCharge(event.data.object.id)",
          },
          {
            kind: "text",
            text: "That clears 39 of the 41 on replay. The other two are past Stripe's 3 day retry window, so they need a manual resend from the Dashboard.",
          },
        ],
      },
      {
        id: "m_05",
        role: "user",
        author: JONAS,
        at: "9:16",
        parts: [{ kind: "text", text: "ok patch it" }],
      },
      {
        id: "m_06",
        role: "user",
        author: JONAS,
        at: "9:16",
        parts: [
          {
            kind: "text",
            text: "and tell me what the retry backlog looks like after",
          },
        ],
      },
    ],
    pending: {
      activityLabel: "Replaying 41 queued events",
      at: "9:17",
      parts: [
        {
          kind: "text",
          text: "Patched `stripe-webhook.ts` and started the replay. 39 of 41 have cleared so far, and the last two",
        },
      ],
      rest: " are outside the retry window and need a manual resend.",
    },
  },

  th_f2a611: {
    messages: [
      {
        id: "r_01",
        role: "user",
        author: MAYA,
        at: "8:40",
        parts: [
          {
            kind: "text",
            text: "refresh the admin guide for 3.4. audience is admins, not developers",
          },
        ],
      },
      {
        id: "r_02",
        role: "assistant",
        author: null,
        at: "8:41",
        parts: [
          {
            kind: "text",
            text: "Here is a first pass built from the 14 merged PRs tagged 3.4. I led with the SSO change because it is the only one that needs an admin to act:",
          },
          {
            kind: "text",
            text: "SCIM group sync now runs every 15 minutes instead of hourly. Bulk seat assignment moved into Settings. Audit log export supports CSV. Nine fixes, including the duplicate invite email.",
          },
        ],
      },
      {
        id: "r_02b",
        role: "user",
        author: MAYA,
        at: "8:44",
        parts: [
          {
            kind: "image",
            src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&auto=format&fit=crop&q=80",
            alt: "Adoption chart from the 3.4 beta",
            caption: "Adoption chart",
          },
          {
            kind: "text",
            text: "here's the beta adoption chart. work the number into the sso paragraph",
          },
        ],
      },
      {
        id: "r_02c",
        role: "assistant",
        author: null,
        at: "8:45",
        reactions: ["\u{1F44D}"],
        parts: [
          {
            kind: "text",
            text: "Added it: 62 percent of beta workspaces turned on 15 minute sync within a week. Full draft attached.",
          },
          {
            kind: "file",
            name: "admin-notes-3.4.pdf",
            meta: "PDF, 240 KB",
          },
        ],
      },
      {
        id: "r_03",
        role: "user",
        author: MAYA,
        at: "8:52",
        parts: [
          {
            kind: "text",
            text: "good but drop the PR count, admins don't care. and say what breaks if they ignore the sso change",
          },
        ],
      },
      {
        id: "r_04",
        role: "assistant",
        author: null,
        at: "8:53",
        parts: [
          {
            kind: "text",
            text: "Removed the count and added the consequence: admins who pinned SCIM sync to hourly in 3.2 keep the old cadence until they clear the override, so new hires can wait up to an hour for access.",
          },
        ],
      },
    ],
  },

  th_b820ee: {
    messages: [
      {
        id: "c_01",
        role: "user",
        author: PRIYA,
        at: "6:20",
        parts: [
          {
            kind: "text",
            text: "churn-q3.csv is in the workspace. which plan tier is bleeding",
          },
        ],
      },
      {
        id: "c_02",
        role: "assistant",
        author: null,
        at: "6:21",
        reactions: ["\u{1F525}", "\u{1F44D}"],
        parts: [
          {
            kind: "text",
            text: "12,480 rows, 9 columns. Cancellations concentrate in Starter: 418 of 521 came from the 6,240 Starter accounts, a 6.7 percent quarterly rate against 1.9 percent on Growth (91 of 4,800) and 0.8 percent on Scale (12 of 1,440).",
          },
          {
            kind: "code",
            language: "sql",
            code: "select plan, count(*) filter (where canceled_at is not null) as churned\nfrom churn_q3 group by plan order by churned desc",
          },
          {
            kind: "text",
            text: "The Starter median account age at cancellation is 41 days, which puts most of the loss just past the trial to paid handoff rather than at renewal.",
          },
        ],
      },
    ],
  },

  th_5c19a0: {
    messages: [
      {
        id: "o_01",
        role: "user",
        author: MAYA,
        at: "16:32",
        parts: [
          {
            kind: "text",
            text: "scoping the mobile onboarding rework for 3.6. three weeks of runway. what's in and what's cut",
          },
        ],
      },
      {
        id: "o_02",
        role: "assistant",
        author: null,
        at: "16:34",
        parts: [
          {
            kind: "text",
            text: "In: account creation, first workspace, first invite. Those three screens hold 71 percent of the mobile drop off, and over half of that sits on the invite step, where 4 in 10 users background the app and never come back.",
          },
          {
            kind: "text",
            text: "Cut: the plan picker, the notification opt in, and the workspace theme step. Together they account for 9 percent of the drop off and all three work fine on the web flow.",
          },
        ],
      },
      {
        id: "o_03",
        role: "user",
        author: MAYA,
        at: "16:41",
        parts: [
          {
            kind: "text",
            text: "sales will push back on cutting the plan picker. what do i tell them",
          },
        ],
      },
      {
        id: "o_04",
        role: "assistant",
        author: null,
        at: "16:42",
        parts: [
          {
            kind: "text",
            text: "That 82 percent of mobile signups pick the default plan anyway, and the ones who upgrade do it from the billing page a median of 9 days later. Deferring the choice does not lose the upgrade, it just moves it off the slowest screen.",
          },
        ],
      },
    ],
  },

  th_77de31: {
    messages: [
      {
        id: "p_01",
        role: "user",
        author: JONAS,
        at: "14:20",
        parts: [
          {
            kind: "text",
            text: "p95 on eu-west doubled around 14:00. what moved",
          },
        ],
      },
      {
        id: "p_02",
        role: "assistant",
        author: null,
        at: "14:22",
        parts: [
          {
            kind: "text",
            text: "p95 went from 190 ms to 405 ms between 13:50 and 14:10, all of it in GET /v1/audit-events. The 3.4 audit log export tripled read volume on `events`, and `events_workspace_created_idx` from Monday was built on primary but never on the eu-west replica. The planner there is sequential scanning 94 GB per request.",
          },
        ],
      },
      {
        id: "p_03",
        role: "user",
        author: JONAS,
        at: "14:26",
        parts: [
          {
            kind: "text",
            text: "can we build it on the replica during business hours",
          },
        ],
      },
      {
        id: "p_04",
        role: "assistant",
        author: null,
        at: "14:27",
        parts: [
          {
            kind: "text",
            text: "Yes with `concurrently`, which takes no write lock. It ran 34 minutes on primary, so expect similar on the replica, and replication lag will climb while it builds. The safer order is to pause the export job first, then build.",
          },
        ],
      },
    ],
  },

  th_e3806b: {
    messages: [
      {
        id: "t_01",
        role: "user",
        author: MAYA,
        at: "11:02",
        parts: [
          {
            kind: "text",
            text: "the trial expiry email reads like a threat. rewrite it, we're losing people who were going to convert",
          },
        ],
      },
      {
        id: "t_02",
        role: "assistant",
        author: null,
        at: "11:03",
        parts: [
          {
            kind: "text",
            text: "Reframed around what they already built, and moved the deadline to the last line. Merge fields in braces:",
          },
          {
            kind: "code",
            language: "text",
            code: "Subject: Your {workspace_name} workspace stays put\n\n{first_name}, you have built {view_count} saved views and\nbrought in {teammate_count} teammates.\n\nAll of it stays exactly where it is. Keep going any time.\n\nYour trial ends {expiry_date}.",
          },
        ],
      },
      {
        id: "t_03",
        role: "user",
        author: MAYA,
        at: "11:09",
        parts: [
          {
            kind: "text",
            text: "better. but the subject is vague, people won't know it's about the trial",
          },
        ],
      },
      {
        id: "t_04",
        role: "assistant",
        author: null,
        at: "11:10",
        parts: [
          {
            kind: "text",
            text: "Named the trial without leading with the loss: `Your {workspace_name} trial ends {expiry_date}`. The body still opens on what they built, so the deadline sets context instead of being the pitch.",
          },
        ],
      },
    ],
  },

  th_a90f52: {
    messages: [
      {
        id: "i_01",
        role: "user",
        author: JONAS,
        at: "Mon",
        parts: [
          {
            kind: "text",
            text: "index for the events table, concurrently right",
          },
        ],
      },
      {
        id: "i_02",
        role: "assistant",
        author: null,
        at: "Mon",
        parts: [
          {
            kind: "text",
            text: "Yes, the table is 94 GB so a plain create would hold a write lock for minutes:",
          },
          {
            kind: "code",
            language: "sql",
            code: "create index concurrently events_workspace_created_idx\n  on events (workspace_id, created_at desc)",
          },
        ],
      },
    ],
  },

  th_6ea2c7: {
    messages: [
      {
        id: "a_01",
        role: "user",
        author: PRIYA,
        at: "5:48",
        parts: [
          {
            kind: "text",
            text: "a customer wants 90 days of audit events in one export. does that work",
          },
        ],
      },
      {
        id: "a_02",
        role: "assistant",
        author: null,
        at: "5:49",
        parts: [
          {
            kind: "text",
            text: "Not in one call. The export caps at 31 days per request so the CSV stays under the 50 MB attachment limit, and a 90 day range returns a 422 rather than truncating silently.",
          },
          {
            kind: "code",
            language: "bash",
            filename: "Terminal",
            code: "for month in 07 08 09; do\n  halcyon audit export --workspace ws_halcyon \\\n    --from 2025-$month-01 --to 2025-$month-28 \\\n    --out audit-$month.csv\ndone",
          },
          {
            kind: "text",
            text: "Three files concatenate cleanly, the header only appears on the first. Row order is stable within a range, so a re-run of the same window produces the same file.",
          },
        ],
      },
    ],
  },

  th_4b13d9: {
    messages: [
      {
        id: "g_01",
        role: "user",
        author: MAYA,
        at: "15:10",
        parts: [
          {
            kind: "text",
            text: "a new hire waited 40 minutes for access yesterday. i thought sync was every 15 minutes now",
          },
        ],
      },
      {
        id: "g_02",
        role: "assistant",
        author: null,
        at: "15:11",
        parts: [
          {
            kind: "text",
            text: "It is, for workspaces on the default. This one pinned the cadence to hourly back in 3.2, and 3.4 leaves an explicit override alone rather than overwriting a deliberate choice.",
          },
          {
            kind: "text",
            text: "Clearing the override in Settings puts it back on the 15 minute default from the next poll. Deprovisioning was never on that clock, so a SCIM delete still revokes sessions immediately.",
          },
        ],
      },
    ],
  },

  th_1ad4e8: {
    messages: [
      {
        id: "w_01",
        role: "user",
        author: PRIYA,
        at: "Tue",
        parts: [
          {
            kind: "text",
            text: "can support set a shorter session timeout on one workspace without touching the org",
          },
        ],
      },
      {
        id: "w_02",
        role: "assistant",
        author: null,
        at: "Tue",
        parts: [
          {
            kind: "text",
            text: "Yes, as of 3.4 the timeout is per workspace. The org value is a ceiling rather than a default, so a workspace can go shorter but never longer, and lowering it signs out sessions already past the new limit on their next request.",
          },
        ],
      },
    ],
  },

  th_bb90c4: {
    messages: [
      {
        id: "d_01",
        role: "user",
        author: JONAS,
        at: "Mon",
        parts: [
          {
            kind: "text",
            text: "is replay-events.ts safe to run twice",
          },
        ],
      },
      {
        id: "d_02",
        role: "assistant",
        author: null,
        at: "Mon",
        parts: [
          {
            kind: "text",
            text: "Yes. It claims each row before it replays and skips anything already settled, so a second run over the same window is a no op:",
          },
          {
            kind: "code",
            language: "typescript",
            filename: "replay-events.ts",
            code: 'const claimed = await deadLetters.claim({ type, since })\n\nfor (const record of claimed) {\n  await handlers[record.type]?.(record.event)\n  await deadLetters.settle(record.id)\n}\n\nlogger.info("replay.done", { claimed: claimed.length })',
          },
          {
            kind: "text",
            text: "The one thing it cannot recover is an event past Stripe's 3 day retry window, since the payload is no longer fetchable. Those need a manual resend from the Dashboard.",
          },
        ],
      },
    ],
  },

  th_30f7a1: {
    messages: [
      {
        id: "v_01",
        role: "user",
        author: MAYA,
        at: "Fri",
        parts: [
          {
            kind: "text",
            text: "invites went out twice to 12 people on friday. what happened",
          },
        ],
      },
      {
        id: "v_02",
        role: "assistant",
        author: null,
        at: "Fri",
        parts: [
          {
            kind: "text",
            text: "The mail provider returned a 502 after it had already accepted the batch, so the retry wrapper sent it again. All 12 sit in the same 90 second window, which is the retry delay.",
          },
          {
            kind: "text",
            text: "3.4 puts an idempotency key on the send, so a retry after a partial success is dropped by the provider instead of delivered. Nothing to do for the 12, the second invite resolves to the same pending seat.",
          },
        ],
      },
    ],
  },
}
