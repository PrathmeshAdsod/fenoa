import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/server/firebase-admin";
import { DomainError } from "@/lib/domain/errors";
import { requireUser } from "@/lib/server/auth";
import { ok, requestId, toErrorResponse } from "@/lib/server/http";
import { assertSameOrigin } from "@/lib/server/request-origin";
import {
  getProfile,
  saveProfileFromIdentity,
} from "@/lib/server/world-repository";

const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

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

export async function GET() {
  const id = requestId();
  try {
    const user = await requireUser();
    const profile = await getProfile(user.uid);
    return ok(
      { authenticated: true, uid: user.uid, displayName: profile.displayName },
      id,
    );
  } catch (error) {
    return toErrorResponse(error, id);
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
    const identity = await adminAuth().verifyIdToken(idToken, true);
    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
    const profile = await saveProfileFromIdentity({
      uid: identity.uid,
      displayName: identity.name,
      avatarUrl: identity.picture,
    });
    const response = ok(
      { uid: identity.uid, displayName: profile.displayName },
      id,
    );
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
