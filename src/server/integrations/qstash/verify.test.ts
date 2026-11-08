import { base64url, SignJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { authorizeJobRequest } from "./verify";

const CURRENT = "current-signing-key";
const NEXT = "next-signing-key";
const BODY = '{"eventId":"evt"}';

afterEach(() => {
  delete process.env.QSTASH_CURRENT_SIGNING_KEY;
  delete process.env.QSTASH_NEXT_SIGNING_KEY;
  delete process.env.CRON_SECRET;
});

describe("authorizeJobRequest", () => {
  it("rejects a request without a signature or cron secret", async () => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = CURRENT;
    process.env.QSTASH_NEXT_SIGNING_KEY = NEXT;

    const auth = await authorizeJobRequest(request(BODY), BODY);
    expect(auth).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("accepts the Vercel cron bearer", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const auth = await authorizeJobRequest(
      request(BODY, { authorization: "Bearer cron-secret" }),
      BODY,
    );
    expect(auth).toEqual({ ok: true, source: "cron" });
  });

  it("rejects a cron bearer of a different length", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const auth = await authorizeJobRequest(request(BODY, { authorization: "Bearer no" }), BODY);
    expect(auth).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("accepts a body signed with the current or next key", async () => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = CURRENT;
    process.env.QSTASH_NEXT_SIGNING_KEY = NEXT;

    const current = await authorizeJobRequest(
      request(BODY, { "upstash-signature": await sign(BODY, CURRENT) }),
      BODY,
    );
    const next = await authorizeJobRequest(
      request(BODY, { "upstash-signature": await sign(BODY, NEXT) }),
      BODY,
    );

    expect(current).toEqual({ ok: true, source: "qstash" });
    expect(next).toEqual({ ok: true, source: "qstash" });
  });

  it("rejects a signature when the body was changed", async () => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = CURRENT;
    process.env.QSTASH_NEXT_SIGNING_KEY = NEXT;

    const auth = await authorizeJobRequest(
      request("{}", { "upstash-signature": await sign(BODY, CURRENT) }),
      "{}",
    );
    expect(auth).toEqual({ ok: false, reason: "unauthorized" });
  });
});

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://app.example/api/jobs/sync-sports", {
    method: "POST",
    headers,
    body,
  });
}

async function sign(body: string, key: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return new SignJWT({ body: base64url.encode(new Uint8Array(digest)) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("Upstash")
    .setSubject("https://app.example/api/jobs/sync-sports")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(key));
}
