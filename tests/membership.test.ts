import assert from "node:assert/strict";

import {
  getProExpiration,
  hasActiveProSession,
  hasUnlimitedAccess,
} from "@/lib/server/membership";

function session(user: Record<string, unknown>): any {
  return { user };
}

const FUTURE_ISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const PAST_ISO = new Date(Date.now() - 60 * 60 * 1000).toISOString();

// hasActiveProSession
assert.equal(hasActiveProSession(null), false, "null session should be free");
assert.equal(
  hasActiveProSession(session({ proExpiresAt: FUTURE_ISO })),
  true,
  "future expiration should grant pro"
);
assert.equal(
  hasActiveProSession(session({ proExpiresAt: PAST_ISO })),
  false,
  "past expiration should not grant pro"
);
assert.equal(
  hasActiveProSession(session({ isPro: true })),
  true,
  "explicit isPro flag should grant pro"
);
assert.equal(
  hasActiveProSession(session({ isPro: false, proExpiresAt: FUTURE_ISO })),
  true,
  "isPro=false should not block a valid future expiration"
);

// hasUnlimitedAccess
assert.equal(
  hasUnlimitedAccess(session({ proExpiresAt: FUTURE_ISO })),
  true,
  "pro users should have unlimited access"
);
assert.equal(
  hasUnlimitedAccess(session({ email: "user@example.com" })),
  false,
  "non-pro users without dev bypass should be limited"
);

// getProExpiration
const expires = getProExpiration(session({ proExpiresAt: FUTURE_ISO }));
assert.ok(expires instanceof Date, "should parse ISO to Date");
assert.equal(
  expires?.toISOString(),
  new Date(FUTURE_ISO).toISOString(),
  "parsed date should match source"
);
assert.equal(
  getProExpiration(session({ proExpiresAt: null })),
  null,
  "missing expiration should return null"
);
