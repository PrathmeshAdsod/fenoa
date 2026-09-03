"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { domainClient } from "@/lib/client/domain-client";

export function CreateWorldStart() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const world = await domainClient.createWorld({
        name: String(data.get("name") ?? ""),
        premise: String(data.get("premise") ?? ""),
        genre: String(data.get("genre") ?? ""),
        tone: String(data.get("tone") ?? ""),
      });
      router.push(`/create/${world.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The world could not begin.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="creator-start-shell">
      <section className="creator-start-copy">
        <p className="eyebrow">Original world studio</p>
        <h1>Begin with a possibility, not an encyclopedia.</h1>
        <p>
          Give Fenoa the essential tension. The live World Canvas and Creative
          Partner will help you shape the cast, connections, truths, and spark.
        </p>
      </section>
      <form className="creator-start-form" onSubmit={create}>
        <label>
          World name
          <input name="name" minLength={2} maxLength={80} required />
        </label>
        <label className="wide">
          What makes this world impossible to ignore?
          <textarea name="premise" minLength={20} maxLength={600} required />
        </label>
        <label>
          Genre
          <input
            name="genre"
            minLength={2}
            maxLength={80}
            placeholder="Supernatural noir"
            required
          />
        </label>
        <label>
          Tone
          <input
            name="tone"
            minLength={2}
            maxLength={160}
            placeholder="Rain-soaked dread"
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button button-primary wide" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={16} /> : null}
          Open the World Canvas <ArrowRight size={16} />
        </button>
      </form>
    </main>
  );
}
