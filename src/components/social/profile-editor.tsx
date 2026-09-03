"use client";

import { Save } from "lucide-react";
import { useState } from "react";

import { domainClient } from "@/lib/client/domain-client";
import type { PublicProfile } from "@/lib/contracts/world";

export function ProfileEditor({ profile }: { profile: PublicProfile }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await domainClient.updateProfile({ displayName, bio });
      setStatus("Profile saved.");
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Profile could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="profile-editor" onSubmit={save}>
      <label>
        Display name
        <input
          value={displayName}
          maxLength={80}
          required
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>
      <label>
        Short bio
        <textarea
          value={bio}
          maxLength={240}
          onChange={(event) => setBio(event.target.value)}
        />
      </label>
      <button className="button button-quiet" disabled={busy}>
        <Save size={14} /> Save profile
      </button>
      {status ? <small>{status}</small> : null}
    </form>
  );
}
