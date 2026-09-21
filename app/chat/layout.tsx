import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  PROTOTYPE_SESSION_COOKIE,
  verifyOwnerSessionToken,
} from "@/lib/auth/prototype-auth"

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(PROTOTYPE_SESSION_COOKIE)?.value
  if (!verifyOwnerSessionToken(token)) redirect("/")
  return children
}
