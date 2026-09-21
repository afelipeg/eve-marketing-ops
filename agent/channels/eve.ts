import { eveChannel } from "eve/channels/eve";
import {
  extractBearerToken,
  localDev,
  placeholderAuth,
  verifyJwtHmac,
  vercelOidc,
  withAuthChallenges,
  type AuthFn,
} from "eve/channels/auth";

const channelSecret = process.env.EVE_CHANNEL_AUTH_SECRET?.trim();
const ownerEmail = process.env.PROTOTYPE_OWNER_EMAIL?.trim().toLowerCase();
const browserAuth =
  channelSecret && channelSecret !== "your_channel_auth_secret" && ownerEmail
    ? browserJwtUser(channelSecret, ownerEmail)
    : placeholderAuth();

function browserJwtUser(secret: string, email: string): AuthFn<Request> {
  return withAuthChallenges(
    async (request) => {
      const token =
        extractBearerToken(request.headers.get("authorization")) ??
        readCookie(request.headers.get("cookie"), "marketing_ops_owner");
      const result = await verifyJwtHmac(token, {
        algorithm: "HS256",
        audiences: ["marketing-ops-agent"],
        claims: { email: [email] },
        issuer: "marketing-ops-web",
        secret,
        subjects: ["prototype-owner"],
      });

      if (!result.ok) return null;

      return {
        ...result.sessionAuth,
        attributes: { ...result.sessionAuth.attributes, email, role: "owner" },
        authenticator: "marketing-ops-web",
        principalId: "prototype-owner",
        principalType: "user",
      };
    },
    [{ scheme: "Bearer" }],
  );
}

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const segment of header.split(";")) {
    const [key, ...value] = segment.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export default eveChannel({
  auth: [
    // Same-project Vercel runtimes and deployments.
    vercelOidc(),
    // Local development only; this path never opens a production deployment.
    localDev(),
    // Browser callers use a short-lived HS256 bearer JWT issued only after the
    // app verifies a real user session. Until then, production remains closed.
    browserAuth,
  ],
});
