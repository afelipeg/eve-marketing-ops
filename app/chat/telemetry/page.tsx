import { EveChatPanel } from "@/components/chat/EveChatPanel"

export default async function TelemetryPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>
}) {
  const { session } = await searchParams
  return <EveChatPanel initialView="telemetry" sessionId={session} />
}
