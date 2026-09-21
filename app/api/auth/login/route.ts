import { NextResponse } from "next/server"
import { z } from "zod"

import {
  createOwnerSessionToken,
  PROTOTYPE_SESSION_COOKIE,
  PROTOTYPE_SESSION_MAX_AGE_SECONDS,
  verifyOwnerCredentials,
} from "@/lib/auth/prototype-auth"

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(256),
})

export async function POST(request: Request) {
  const startedAt = Date.now()
  try {
    const input = loginSchema.safeParse(await request.json())
    const authenticated =
      input.success && verifyOwnerCredentials(input.data.email, input.data.password)

    if (!authenticated) {
      await minimumResponseTime(startedAt, 650)
      return NextResponse.json(
        { error: "Invalid owner credentials.", ok: false },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      )
    }

    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    )
    response.cookies.set(PROTOTYPE_SESSION_COOKIE, createOwnerSessionToken(), {
      httpOnly: true,
      maxAge: PROTOTYPE_SESSION_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    return response
  } catch {
    await minimumResponseTime(startedAt, 650)
    return NextResponse.json(
      { error: "Owner access is not configured.", ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}

async function minimumResponseTime(startedAt: number, milliseconds: number) {
  const remaining = milliseconds - (Date.now() - startedAt)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
}
