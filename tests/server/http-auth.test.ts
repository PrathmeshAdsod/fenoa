import { FirebaseAuthError } from "firebase-admin/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isInvalidSessionCookieError } from "@/lib/server/auth";
import { readJson, toErrorResponse } from "@/lib/server/http";
import { assertSameOrigin } from "@/lib/server/request-origin";

function authError(code: string): FirebaseAuthError {
  return Object.assign(Object.create(FirebaseAuthError.prototype), { code });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

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
    expect(isInvalidSessionCookieError(authError("auth/user-disabled"))).toBe(
      true,
    );
    expect(isInvalidSessionCookieError(authError("auth/user-not-found"))).toBe(
      true,
    );
    expect(isInvalidSessionCookieError(authError("auth/internal-error"))).toBe(
      false,
    );
    expect(isInvalidSessionCookieError(new Error("network unavailable"))).toBe(
      false,
    );
  });

  it("accepts the public request origin behind a trusted hosting proxy", () => {
    vi.stubEnv(
      "FENOA_PUBLIC_ORIGIN",
      "https://fenoa--fenoa-creative.asia-southeast1.hosted.app",
    );
    const request = new Request(
      "https://internal-app-hosting-service.run.app/api/auth/session",
      {
        headers: {
          host: "internal-app-hosting-service.run.app",
          origin: "https://fenoa--fenoa-creative.asia-southeast1.hosted.app",
        },
      },
    );

    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("accepts the direct host during local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = new Request("http://localhost:3000/api/auth/session", {
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
      },
    });

    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects malformed and cross-origin session requests", () => {
    const url =
      "https://fenoa--fenoa-creative.asia-southeast1.hosted.app/api/auth/session";

    expect(() =>
      assertSameOrigin(
        new Request(url, { headers: { origin: "not a valid origin" } }),
      ),
    ).toThrow("The request origin is invalid.");
    expect(() =>
      assertSameOrigin(
        new Request(url, { headers: { origin: "https://attacker.example" } }),
      ),
    ).toThrow("The request origin is invalid.");
  });
});
