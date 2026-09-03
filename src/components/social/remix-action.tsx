"use client";

import { GitBranch, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { domainClient } from "@/lib/client/domain-client";

export function RemixAction({
  sourceType,
  sourceId,
  sourceName,
}: {
  sourceType: "world" | "branch";
  sourceId: string;
  sourceName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const state = await domainClient.startRemix({
        sourceType,
        sourceId,
        title: String(data.get("title") ?? ""),
        creativeIntent: String(data.get("creativeIntent") ?? ""),
      });
      router.push(`/studio/${state.branch.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "This remix could not be started.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="remix-action">
      <button className="button button-primary" onClick={() => setOpen(true)}>
        <GitBranch size={15} /> Remix this {sourceType}
      </button>
      {open ? (
        <div
          className="remix-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={`Remix ${sourceName}`}
        >
          <button
            className="sheet-close"
            aria-label="Close remix form"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
          <p className="eyebrow">A new branch from {sourceName}</p>
          <h2>What do you want to explore?</h2>
          <form onSubmit={submit}>
            <label>
              Branch title
              <input name="title" minLength={2} maxLength={120} required />
            </label>
            <label>
              Creative direction
              <textarea
                name="creativeIntent"
                minLength={10}
                maxLength={600}
                placeholder="Delay the reveal and follow the person who remembers."
                required
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="button button-primary" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={15} /> : null}
              Open Remix Studio
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
