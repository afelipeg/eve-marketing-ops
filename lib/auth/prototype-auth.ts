import {
  createHmac,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"

export const PROTOTYPE_SESSION_COOKIE = "marketing_ops_owner"
export const PROTOTYPE_SESSION_ISSUER = "marketing-ops-web"
export const PROTOTYPE_SESSION_AUDIENCE = "marketing-ops-agent"
export const PROTOTYPE_OWNER_SUBJECT = "prototype-owner"
export const PROTOTYPE_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

type OwnerClaims = {
  aud: string
  email: string
  exp: number
  iat: number
  iss: string
  jti: string
  sub: string
}

export function verifyOwnerCredentials(email: string, password: string) {
  const configuredEmail = process.env.PROTOTYPE_OWNER_EMAIL?.trim().toLowerCase()
  const salt = process.env.PROTOTYPE_OWNER_PASSWORD_SALT?.trim()
  const expectedHash = process.env.PROTOTYPE_OWNER_PASSWORD_HASH?.trim()
  if (!configuredEmail || !salt || !expectedHash) return false

  const emailMatches = safeEqualText(email.trim().toLowerCase(), configuredEmail)
  const candidateHash = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHash, "base64url")
  const passwordMatches =
    candidateHash.length === expected.length && timingSafeEqual(candidateHash, expected)

  return emailMatches && passwordMatches
}

export function createOwnerSessionToken() {
  const secret = requireSessionSecret()
  const email = process.env.PROTOTYPE_OWNER_EMAIL?.trim().toLowerCase()
  if (!email) throw new Error("PROTOTYPE_OWNER_EMAIL is not configured.")

  const now = Math.floor(Date.now() / 1_000)
  const claims: OwnerClaims = {
    aud: PROTOTYPE_SESSION_AUDIENCE,
    email,
    exp: now + PROTOTYPE_SESSION_MAX_AGE_SECONDS,
    iat: now,
    iss: PROTOTYPE_SESSION_ISSUER,
    jti: randomUUID(),
    sub: PROTOTYPE_OWNER_SUBJECT,
  }
  const header = encodeJson({ alg: "HS256", typ: "JWT" })
  const payload = encodeJson(claims)
  const unsigned = `${header}.${payload}`
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url")
  return `${unsigned}.${signature}`
}

export function verifyOwnerSessionToken(token: string | undefined): OwnerClaims | null {
  if (!token) return null
  const [header, payload, signature, extra] = token.split(".")
  if (!header || !payload || !signature || extra) return null

  const expectedSignature = createHmac("sha256", requireSessionSecret())
    .update(`${header}.${payload}`)
    .digest("base64url")
  if (!safeEqualText(signature, expectedSignature)) return null

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<OwnerClaims>
    const configuredEmail = process.env.PROTOTYPE_OWNER_EMAIL?.trim().toLowerCase()
    const now = Math.floor(Date.now() / 1_000)
    if (
      claims.aud !== PROTOTYPE_SESSION_AUDIENCE ||
      claims.iss !== PROTOTYPE_SESSION_ISSUER ||
      claims.sub !== PROTOTYPE_OWNER_SUBJECT ||
      claims.email !== configuredEmail ||
      typeof claims.exp !== "number" ||
      claims.exp <= now ||
      typeof claims.iat !== "number" ||
      claims.iat > now + 30 ||
      typeof claims.jti !== "string"
    ) {
      return null
    }
    return claims as OwnerClaims
  } catch {
    return null
  }
}

function requireSessionSecret() {
  const secret = process.env.EVE_CHANNEL_AUTH_SECRET?.trim()
  if (!secret || secret === "your_channel_auth_secret") {
    throw new Error("EVE_CHANNEL_AUTH_SECRET is not configured.")
  }
  return secret
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
}

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
