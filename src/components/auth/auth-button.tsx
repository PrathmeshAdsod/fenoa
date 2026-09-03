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

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginInFlight = useRef(false);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(clientAuth(), (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
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
          if (!response.ok) {
            await signOut(clientAuth());
            return;
          }
          setSessionReady(true);
        } catch {
          await signOut(clientAuth()).catch(() => undefined);
        } finally {
          setAuthResolved(true);
        }
      })();
    });
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
      const csrfResponse = await fetch("/api/auth/csrf");
      if (!csrfResponse.ok) throw new Error("Could not begin sign-in.");
      const { token } = (await csrfResponse.json()) as { token: string };
      const result =
        process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
          ? await signInWithEmailAndPassword(
              clientAuth(),
              "creator@fenoa.local",
              "fenoa-local-password",
            )
          : await signInWithPopup(clientAuth(), googleProvider());
      firebaseUser = result.user;
      const idToken = await result.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "X-CSRF-Token": token,
        },
      });
      if (!response.ok) throw new Error("Could not create a secure session.");
      setUser(result.user);
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
            {user.displayName ?? "My profile"}
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
