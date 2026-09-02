import { cookies } from "next/headers";

import { adminAuth } from "@/lib/server/firebase-admin";
import { DomainError } from "@/lib/domain/errors";

export async function requireUser(): Promise<{ uid: string }> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) {
    throw new DomainError("UNAUTHENTICATED", "Sign in to continue.");
  }

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    return { uid: decoded.uid };
  } catch {
    throw new DomainError(
      "UNAUTHENTICATED",
      "Your session expired. Sign in again.",
    );
  }
}
