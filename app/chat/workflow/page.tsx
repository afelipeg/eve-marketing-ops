import { EveChatPanel } from "@/components/chat/EveChatPanel"

export default async function WorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>
}) {
  const { session } = await searchParams
  return <EveChatPanel initialView="workflow" sessionId={session} />
}
