import { Auth } from "@/components/blocks/auth-5/components/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  PROTOTYPE_SESSION_COOKIE,
  verifyOwnerSessionToken,
} from "@/lib/auth/prototype-auth"

export default async function LandingPage() {
  const cookieStore = await cookies()
  if (verifyOwnerSessionToken(cookieStore.get(PROTOTYPE_SESSION_COOKIE)?.value)) {
    redirect("/chat")
  }
  return <Auth />
}
