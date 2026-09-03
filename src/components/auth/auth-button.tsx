"use client";

import { LogIn, LogOut } from "lucide-react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  clientAuth,
  firebaseConfigured,
  googleProvider,
} from "@/lib/client/firebase";
import type { ApiResult } from "@/lib/contracts/api";

type SessionIdentity = { uid: string; displayName: string };

async function createServerSession(user: User): Promise<SessionIdentity> {
  const csrfResponse = await fetch("/api/auth/csrf");
  if (!csrfResponse.ok) throw new Error("Could not begin sign-in.");
  const { token } = (await csrfResponse.json()) as { token: string };
  const idToken = await user.getIdToken();
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "X-CSRF-Token": token,
    },
  });
  const result = (await response.json()) as ApiResult<SessionIdentity>;
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginInFlight = useRef(false);

  useEffect(() => {
    if (!firebaseConfigured) return;
    const onProfileUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ displayName?: string }>;
      if (custom.detail?.displayName) setProfileName(custom.detail.displayName);
    };
    window.addEventListener("fenoa:profile-updated", onProfileUpdated);
    const unsubscribe = onAuthStateChanged(clientAuth(), (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfileName(null);
        setSessionReady(false);
        setAuthResolved(true);
        return;
      }
      if (loginInFlight.current) {
        setAuthResolved(true);
        return;
      }

      void (async () => {
        try {
          const response = await fetch("/api/auth/session", {
            cache: "no-store",
          });
          let identity: SessionIdentity;
          if (response.ok) {
            const result = (await response.json()) as ApiResult<
              SessionIdentity & { authenticated: true }
            >;
            if (!result.ok) throw new Error(result.error.message);
            identity = result.data;
          } else if (response.status === 401) {
            identity = await createServerSession(nextUser);
          } else {
            throw new Error("Could not restore the secure studio session.");
          }
          setProfileName(identity.displayName);
          setSessionReady(true);
        } catch (caught) {
          setSessionReady(false);
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not restore the secure studio session.",
          );
        } finally {
          setAuthResolved(true);
        }
      })();
    });
    return () => {
      unsubscribe();
      window.removeEventListener("fenoa:profile-updated", onProfileUpdated);
    };
  }, []);

  if (!firebaseConfigured) {
    return <span className="quiet-label">Firebase setup pending</span>;
  }

  async function login() {
    setBusy(true);
    setSessionReady(false);
    setError(null);
    loginInFlight.current = true;
    let firebaseUser: User | null = null;
    try {
      const result =
        process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
          ? await signInWithEmailAndPassword(
              clientAuth(),
              "creator@fenoa.local",
              "fenoa-local-password",
            )
          : await signInWithPopup(clientAuth(), googleProvider());
      firebaseUser = result.user;
      const identity = await createServerSession(result.user);
      setUser(result.user);
      setProfileName(identity.displayName);
      setSessionReady(true);
    } catch (caught) {
      if (firebaseUser) {
        await fetch("/api/auth/session", { method: "DELETE" }).catch(
          () => undefined,
        );
        await signOut(clientAuth()).catch(() => undefined);
      }
      setError(
        caught instanceof Error ? caught.message : "Sign-in could not finish.",
      );
    } finally {
      loginInFlight.current = false;
      setAuthResolved(true);
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not end the secure session.");
      await signOut(clientAuth());
      window.location.href = "/";
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Sign-out could not finish.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-action">
      {!authResolved ? (
        <span className="quiet-label">Checking studio…</span>
      ) : user && sessionReady ? (
        <div className="signed-in-actions">
          <Link href={`/u/${user.uid}`} className="profile-link">
            {profileName ?? "My profile"}
          </Link>
          <button
            className="button button-quiet"
            onClick={logout}
            disabled={busy}
            aria-label="Sign out"
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          className="button button-primary"
          onClick={login}
          disabled={busy}
        >
          <LogIn size={15} aria-hidden="true" />
          {busy
            ? "Opening…"
            : process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
              ? "Open local studio"
              : "Create with Google"}
        </button>
      )}
      {error ? (
        <span className="auth-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
