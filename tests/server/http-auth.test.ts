import { FirebaseAuthError } from "firebase-admin/auth";
import { describe, expect, it } from "vitest";

import { isInvalidSessionCookieError } from "@/lib/server/auth";
import { readJson, toErrorResponse } from "@/lib/server/http";

function authError(code: string): FirebaseAuthError {
  return Object.assign(Object.create(FirebaseAuthError.prototype), { code });
}

describe("server input and auth error classification", () => {
  it("returns a client error for malformed JSON", async () => {
    const request = new Request("https://fenoa.example/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"broken":',
    });
    let caught: unknown;
    try {
      await readJson(request);
    } catch (error) {
      caught = error;
    }
    const response = toErrorResponse(caught, "request-one");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT" },
    });
  });

  it("distinguishes expired sessions from Firebase service failures", () => {
    expect(
      isInvalidSessionCookieError(authError("auth/session-cookie-expired")),
    ).toBe(true);
    expect(isInvalidSessionCookieError(authError("auth/internal-error"))).toBe(
      false,
    );
    expect(isInvalidSessionCookieError(new Error("network unavailable"))).toBe(
      false,
    );
  });
});
