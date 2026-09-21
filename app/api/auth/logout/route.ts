import { NextResponse } from "next/server"

import { PROTOTYPE_SESSION_COOKIE } from "@/lib/auth/prototype-auth"

export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  )
  response.cookies.set(PROTOTYPE_SESSION_COOKIE, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  return response
}
