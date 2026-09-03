"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { ArrowUpRight, CircleAlert, LoaderCircle, Send, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { WorldCanvas } from "@/components/creator/world-canvas";
import { WorldPartner } from "@/components/creator/world-partner";
import { domainClient } from "@/lib/client/domain-client";
import { clientDb, firebaseConfigured } from "@/lib/client/firebase";
import type { CreativeTurnRequest } from "@/lib/contracts/creative";
import type { WorldCreativeSession } from "@/lib/contracts/world-creative";
import { worldDraftSchema, type WorldDraft } from "@/lib/contracts/world";

export function CreatorStudio({ worldId }: { worldId: string }) {
  const [draft, setDraft] = useState<WorldDraft | null>(null);
  const [session, setSession] = useState<WorldCreativeSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const draftReady = draft !== null;

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onSnapshot(
      doc(clientDb(), "worldDrafts", worldId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setError("This world could not be found.");
          return;
        }
        const parsed = worldDraftSchema.safeParse({
          id: snapshot.id,
          ...snapshot.data(),
        });
        if (parsed.success) setDraft(parsed.data);
        else setError("The World Canvas contains invalid data.");
      },
      () => setError("Sign in as this world's creator to open the studio."),
    );
  }, [worldId]);

  useEffect(() => {
    if (!draftReady) return;
    const controller = new AbortController();
    setSessionLoading(true);
    domainClient
      .getWorldCreativeSession(worldId, controller.signal)
      .then(setSession)
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Collaboration could not load.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSessionLoading(false);
      });
    return () => controller.abort();
  }, [worldId, draftReady]);

  async function run<T>(operation: () => Promise<T>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      return await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : fallback);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function save(input: Parameters<typeof domainClient.updateWorld>[1]) {
    return Boolean(
      await run(
        () => domainClient.updateWorld(worldId, input),
        "The World Canvas could not be saved.",
      ),
    );
  }

  async function creativeTurn(input: CreativeTurnRequest) {
    const result = await run(
      () => domainClient.runWorldCreativeTurn(worldId, input),
      "Creative Partner could not complete this turn.",
    );
    if (result) setSession(result.session);
  }

  async function generateImage(direction: string) {
    if (!draft) return;
    await run(
      () =>
        domainClient.generateWorldCover(worldId, {
          expectedVersion: draft.version,
          direction,
        }),
      "World artwork could not be generated.",
    );
  }

  async function publish() {
    if (!draft) return;
    const result = await run(
      () => domainClient.publishWorld(worldId, draft.version),
      "The world could not be published.",
    );
    if (result) setPublishedUrl(`/world/${result.world.id}`);
  }

  if (!firebaseConfigured) {
    return (
      <main className="studio-empty">
        <h1>Connect Firebase to open the World Canvas.</h1>
        <p>Fenoa never substitutes fixture persistence for a creator draft.</p>
      </main>
    );
  }
  if (!draft) {
    return (
      <main className="studio-loading" aria-live="polite">
        <LoaderCircle className="spin" size={22} /> Opening the World Canvas…
      </main>
    );
  }

  return (
    <main className="creator-studio-shell">
      <header className="creator-studio-heading">
        <div>
          <p className="eyebrow">Original creator studio</p>
          <h1>{draft.name}</h1>
          <p>
            Shape a possibility space the community can meaningfully explore.
          </p>
        </div>
        <div className="creator-publish-actions">
          {publishedUrl ? (
            <Link className="button button-quiet" href={publishedUrl}>
              View published world <ArrowUpRight size={15} />
            </Link>
          ) : null}
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => void publish()}
          >
            <Send size={15} /> Publish revision
          </button>
        </div>
      </header>
      {error ? (
        <div className="error-banner" role="alert">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError(null)}>
            <X size={15} />
          </button>
        </div>
      ) : null}
      <div className="creator-studio-grid">
        <WorldCanvas
          key={draft.version}
          draft={draft}
          busy={busy}
          onSave={save}
          onGenerateImage={generateImage}
        />
        <aside>
          <WorldPartner
            session={session}
            loading={sessionLoading}
            busy={busy}
            onTurn={creativeTurn}
          />
        </aside>
      </div>
    </main>
  );
}
