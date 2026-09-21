import { EveChatPanel } from "@/components/chat/EveChatPanel"

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  return <EveChatPanel key={sessionId} sessionId={sessionId} />
}
