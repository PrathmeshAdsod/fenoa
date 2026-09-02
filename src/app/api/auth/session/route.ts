import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/server/firebase-admin";
import { DomainError } from "@/lib/domain/errors";
import { requestId, toErrorResponse } from "@/lib/server/http";

const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    throw new DomainError("FORBIDDEN", "The request origin is invalid.");
  }
}

function assertCsrf(request: Request): void {
  const header = request.headers.get("x-csrf-token") ?? "";
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("fenoa_csrf="))
    ?.slice("fenoa_csrf=".length);
  if (!cookie || header.length !== cookie.length) {
    throw new DomainError("FORBIDDEN", "The CSRF token is invalid.");
  }
  if (!timingSafeEqual(Buffer.from(header), Buffer.from(cookie))) {
    throw new DomainError("FORBIDDEN", "The CSRF token is invalid.");
  }
}

export async function POST(request: Request) {
  const id = requestId();
  try {
    assertSameOrigin(request);
    assertCsrf(request);
    const authorization = request.headers.get("authorization") ?? "";
    const idToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    if (!idToken) {
      throw new DomainError(
        "UNAUTHENTICATED",
        "A Firebase ID token is required.",
      );
    }
    await adminAuth().verifyIdToken(idToken, true);
    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
    const response = NextResponse.json({ ok: true, requestId: id });
    response.cookies.set("__session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    response.cookies.delete("fenoa_csrf");
    return response;
  } catch (error) {
    return toErrorResponse(error, id);
  }
}

export async function DELETE(request: Request) {
  const id = requestId();
  try {
    assertSameOrigin(request);
    const response = NextResponse.json({ ok: true, requestId: id });
    response.cookies.delete("__session");
    return response;
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
