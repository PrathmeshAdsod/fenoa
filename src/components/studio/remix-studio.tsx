"use client";

import { arrayMove } from "@dnd-kit/sortable";
import {
  doc,
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { ArrowUpRight, CircleAlert, LoaderCircle, Send, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BranchContext } from "@/components/studio/branch-context";
import { CreativePartner } from "@/components/studio/creative-partner";
import { EpisodeBoard } from "@/components/studio/episode-board";
import {
  EpisodeEditor,
  type EpisodeDraft,
} from "@/components/studio/episode-editor";
import { domainClient } from "@/lib/client/domain-client";
import { clientDb, firebaseConfigured } from "@/lib/client/firebase";
import type {
  CreativeTurnRequest,
  CreativeSession,
} from "@/lib/contracts/creative";
import {
  branchDraftSchema,
  episodeSchema,
  type BranchDraft,
  type Character,
  type Episode,
  type Fact,
  type StoryConstraint,
} from "@/lib/contracts/domain";
import { registerStudioTools } from "@/lib/webmcp/register-studio-tools";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function RemixStudio({ branchId }: { branchId: string }) {
  const [branch, setBranch] = useState<BranchDraft | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [session, setSession] = useState<CreativeSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const branchReady = branch !== null;

  useEffect(() => {
    if (!firebaseConfigured) return;
    const db = clientDb();
    const stopBranch = onSnapshot(
      doc(db, "branchDrafts", branchId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setError("This branch could not be found.");
          return;
        }
        const parsed = branchDraftSchema.safeParse({
          id: snapshot.id,
          ...snapshot.data(),
        });
        if (parsed.success) setBranch(parsed.data);
        else setError("The branch data is invalid.");
      },
      () => setError("Sign in as the branch creator to open this studio."),
    );
    const stopEpisodes = onSnapshot(
      query(
        collection(db, "branchDrafts", branchId, "episodes"),
        orderBy("position", "asc"),
      ),
      (snapshot) => {
        const parsed = snapshot.docs
          .map((item) =>
            episodeSchema.safeParse({ id: item.id, ...item.data() }),
          )
          .filter((result) => result.success)
          .map((result) => result.data);
        setEpisodes(parsed);
        setSelectedId((current) =>
          current && parsed.some((episode) => episode.id === current)
            ? current
            : (parsed[0]?.id ?? null),
        );
      },
      () => setError("Episode access is unavailable for this account."),
    );
    return () => {
      stopBranch();
      stopEpisodes();
    };
  }, [branchId]);

  useEffect(() => {
    if (!branchReady) return;
    const controller = new AbortController();
    setSessionLoading(true);
    domainClient
      .getCreativeSession(branchId, controller.signal)
      .then(setSession)
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(
            errorMessage(caught, "The creative session could not be restored."),
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSessionLoading(false);
      });
    return () => controller.abort();
  }, [branchId, branchReady]);

  useEffect(() => {
    if (!branchReady) return;
    const controller = registerStudioTools(branchId);
    return () => controller.abort();
  }, [branchId, branchReady]);

  const selected = useMemo(
    () => episodes.find((episode) => episode.id === selectedId) ?? null,
    [episodes, selectedId],
  );
  const agentTargetIds = useMemo(() => {
    const latestActivity = branch?.recentActivity[0];
    return new Set(
      latestActivity && latestActivity.actorType !== "human"
        ? latestActivity.targetIds
        : [],
    );
  }, [branch?.recentActivity]);

  async function runMutation<T>(
    operation: () => Promise<T>,
    fallback: string,
    rethrow = false,
  ): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await operation();
    } catch (caught) {
      setError(errorMessage(caught, fallback));
      if (rethrow) throw caught;
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function saveEpisode(episode: Episode, draft: EpisodeDraft) {
    const keyBeats = draft.keyBeats
      .split("\n")
      .map((beat) => beat.trim())
      .filter(Boolean)
      .slice(0, 8);
    await runMutation(
      () =>
        domainClient.updateEpisode(branchId, episode.id, {
          expectedEpisodeVersion: episode.version,
          actorType: "human",
          patch: {
            title: draft.title,
            hook: draft.hook,
            keyBeats,
            narrative: draft.narrative,
            effects: episode.effects,
          },
        }),
      "The episode could not be saved.",
      true,
    );
  }

  async function moveEpisode(episodeId: string, toPosition: number) {
    if (!branch) return;
    const previous = episodes;
    const fromIndex = episodes.findIndex((episode) => episode.id === episodeId);
    if (fromIndex < 0 || fromIndex === toPosition - 1) return;
    const optimistic = arrayMove(episodes, fromIndex, toPosition - 1).map(
      (episode, index) => ({
        ...episode,
        position: index + 1,
      }),
    );
    setEpisodes(optimistic);
    const result = await runMutation(
      () =>
        domainClient.moveEpisode(branchId, {
          episodeId,
          toPosition,
          expectedBranchVersion: branch.version,
          actorType: "human",
        }),
      "The episode order could not be saved.",
    );
    if (!result) {
      setEpisodes((current) =>
        current.length === optimistic.length &&
        current.every(
          (episode, index) =>
            episode.id === optimistic[index]?.id &&
            episode.version === optimistic[index]?.version,
        )
          ? previous
          : current,
      );
    }
  }

  async function addEpisode(input: { title: string; hook: string }) {
    if (!branch) return false;
    return Boolean(
      await runMutation(
        () =>
          domainClient.addEpisode(branchId, {
            expectedBranchVersion: branch.version,
            position: episodes.length + 1,
            title: input.title,
            hook: input.hook,
            actorType: "human",
          }),
        "The episode could not be added.",
      ),
    );
  }

  async function deleteEpisode(episodeId: string) {
    if (!branch) return false;
    return Boolean(
      await runMutation(
        () =>
          domainClient.deleteEpisode(branchId, {
            expectedBranchVersion: branch.version,
            episodeId,
            actorType: "human",
          }),
        "The episode could not be removed.",
      ),
    );
  }

  async function addCharacter(character: Character) {
    if (!branch) return false;
    return Boolean(
      await runMutation(
        () =>
          domainClient.addBranchCharacter(branchId, {
            expectedBranchVersion: branch.version,
            character,
            actorType: "human",
          }),
        "The branch character could not be added.",
      ),
    );
  }

  async function upsertRule(fact: Fact) {
    if (!branch) return false;
    return Boolean(
      await runMutation(
        () =>
          domainClient.updateBranchRule(branchId, {
            action: "upsert",
            expectedBranchVersion: branch.version,
            fact,
            actorType: "human",
          }),
        "The branch rule could not be saved.",
      ),
    );
  }

  async function removeRule(factId: string) {
    if (!branch) return;
    await runMutation(
      () =>
        domainClient.updateBranchRule(branchId, {
          action: "remove",
          expectedBranchVersion: branch.version,
          factId,
          actorType: "human",
        }),
      "The branch rule could not be removed.",
    );
  }

  async function setConstraint(input: {
    action: "add" | "update";
    constraint: StoryConstraint;
  }) {
    if (!branch) return false;
    return Boolean(
      await runMutation(
        () =>
          domainClient.setConstraint(branchId, {
            ...input,
            expectedBranchVersion: branch.version,
            actorType: "human",
          }),
        "The story lock could not be saved.",
      ),
    );
  }

  async function removeConstraint(constraintId: string) {
    if (!branch) return;
    await runMutation(
      () =>
        domainClient.setConstraint(branchId, {
          action: "remove",
          expectedBranchVersion: branch.version,
          constraintId,
          actorType: "human",
        }),
      "The story lock could not be removed.",
    );
  }

  async function creativeTurn(request: CreativeTurnRequest) {
    const result = await runMutation(
      () => domainClient.runCreativeTurn(branchId, request),
      "Creative Partner could not complete this turn.",
    );
    if (result) setSession(result.session);
  }

  async function undoAgentAction() {
    if (!branch?.lastAgentAction) return;
    await runMutation(
      () =>
        domainClient.undoAgentAction(branchId, {
          activityId: branch.lastAgentAction!.id,
          expectedBranchVersion: branch.version,
        }),
      "The agent action can no longer be safely undone.",
    );
  }

  async function publishBranch() {
    if (!branch) return;
    const result = await runMutation(
      () => domainClient.publishBranch(branchId, branch.version),
      "The branch could not be published.",
    );
    if (result) setPublishedUrl(`/branch/${result.branch.id}`);
  }

  if (!firebaseConfigured) {
    return (
      <main className="studio-empty">
        <p className="eyebrow">Studio setup</p>
        <h1>Connect Firebase to open the living branch.</h1>
        <p>
          Fenoa does not substitute fixture state when its real persistence is
          unavailable.
        </p>
      </main>
    );
  }

  if (error && !branch) {
    return (
      <main className="studio-empty">
        <h1>Studio unavailable</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!branch) {
    return (
      <main className="studio-loading" aria-live="polite">
        <LoaderCircle size={24} aria-hidden="true" /> Opening the live branch…
      </main>
    );
  }

  return (
    <main className="studio-shell">
      <header className="studio-heading">
        <div>
          <p className="eyebrow">Remix Studio · {branch.rootWorldId}</p>
          <h1>{branch.title}</h1>
          <p>{branch.creativeIntent}</p>
        </div>
        <div className="studio-publish-actions">
          <span className="live-indicator">
            <span /> Firestore live
          </span>
          {publishedUrl ? (
            <Link className="button button-quiet" href={publishedUrl}>
              View branch <ArrowUpRight size={14} />
            </Link>
          ) : null}
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => void publishBranch()}
          >
            <Send size={14} /> Publish remix
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError(null)}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="studio-grid">
        <div className="artifact-column">
          <EpisodeBoard
            episodes={episodes}
            selectedId={selectedId}
            agentTargetIds={agentTargetIds}
            busy={busy}
            onSelect={setSelectedId}
            onMove={moveEpisode}
            onAdd={addEpisode}
            onDelete={deleteEpisode}
          />
          {selected ? (
            <EpisodeEditor
              key={selected.id}
              episode={selected}
              onSave={saveEpisode}
            />
          ) : null}
        </div>

        <aside className="studio-rail">
          <CreativePartner
            branch={branch}
            session={session}
            busy={busy}
            loading={sessionLoading}
            onTurn={creativeTurn}
            onUndo={undoAgentAction}
          />
          <BranchContext
            branch={branch}
            agentTargetIds={agentTargetIds}
            busy={busy}
            onAddCharacter={addCharacter}
            onUpsertRule={upsertRule}
            onRemoveRule={removeRule}
            onSetConstraint={setConstraint}
            onRemoveConstraint={removeConstraint}
          />
        </aside>
      </div>
    </main>
  );
}
