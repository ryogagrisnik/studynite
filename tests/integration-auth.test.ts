import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import prisma from "@/lib/prisma";
import { verifyCredentials } from "@/lib/auth";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";

process.env.NODE_ENV = "test";

if (!process.env.DATABASE_URL) {
  console.warn("[tests] DATABASE_URL missing; skipping auth integration test.");
} else {
  const run = async () => {
    const email = `test-${randomUUID()}@example.com`;
    const password = "Password123!";

    await prisma.user.deleteMany({ where: { email } });

    const signupReq = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test User", email, password }),
    });
    const signupRes = await signup(signupReq);
    assert.equal(signupRes.status, 200, "signup should succeed");

    const token = await prisma.emailVerificationToken.findFirst({
      where: { user: { email } },
      select: { token: true },
    });
    assert.ok(token?.token, "verification token should be created");

    const verifyReq = new Request("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token?.token }),
    });
    const verifyRes = await verifyEmail(verifyReq);
    assert.equal(verifyRes.status, 200, "verify email should succeed");

    const user = await verifyCredentials(email, password, { skipRateLimit: true });
    assert.equal(user.email, email, "login should return the created user");

    await prisma.user.deleteMany({ where: { email } });
  };

  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
