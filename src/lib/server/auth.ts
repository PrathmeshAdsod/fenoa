import { cookies } from "next/headers";
import { FirebaseAuthError } from "firebase-admin/auth";

import { adminAuth } from "@/lib/server/firebase-admin";
import { DomainError } from "@/lib/domain/errors";

const invalidSessionCodes = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/invalid-session-cookie-duration",
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
]);

export function isInvalidSessionCookieError(error: unknown): boolean {
  return (
    error instanceof FirebaseAuthError && invalidSessionCodes.has(error.code)
  );
}

export async function requireUser(): Promise<{ uid: string }> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) {
    throw new DomainError("UNAUTHENTICATED", "Sign in to continue.");
  }

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    return { uid: decoded.uid };
  } catch (error) {
    if (isInvalidSessionCookieError(error)) {
      throw new DomainError(
        "UNAUTHENTICATED",
        "Your session expired. Sign in again.",
      );
    }
    throw error;
  }
}

export async function optionalUser(): Promise<{ uid: string } | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    return { uid: decoded.uid };
  } catch (error) {
    if (isInvalidSessionCookieError(error)) return null;
    throw error;
  }
}
