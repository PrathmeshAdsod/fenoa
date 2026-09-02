"use client";

import { LogIn, LogOut } from "lucide-react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";

import {
  clientAuth,
  firebaseConfigured,
  googleProvider,
} from "@/lib/client/firebase";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(clientAuth(), setUser);
  }, []);

  if (!firebaseConfigured) {
    return <span className="quiet-label">Firebase setup pending</span>;
  }

  async function login() {
    setBusy(true);
    try {
      const csrfResponse = await fetch("/api/auth/csrf");
      const { token } = (await csrfResponse.json()) as { token: string };
      const result =
        process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
          ? await signInWithEmailAndPassword(
              clientAuth(),
              "creator@fenoa.local",
              "fenoa-local-password",
            )
          : await signInWithPopup(clientAuth(), googleProvider());
      const idToken = await result.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "X-CSRF-Token": token,
        },
      });
      if (!response.ok) throw new Error("Could not create a secure session.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(clientAuth());
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }

  return user ? (
    <button className="button button-quiet" onClick={logout} disabled={busy}>
      <LogOut size={15} aria-hidden="true" />
      Sign out
    </button>
  ) : (
    <button className="button button-primary" onClick={login} disabled={busy}>
      <LogIn size={15} aria-hidden="true" />
      {busy
        ? "Opening…"
        : process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
          ? "Open local studio"
          : "Create with Google"}
    </button>
  );
}
