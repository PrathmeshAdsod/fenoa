"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { Bot, LockKeyhole, Sparkles, Waypoints } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  branchDraftSchema,
  episodeSchema,
  type BranchDraft,
  type Episode,
} from "@/lib/contracts/domain";
import { clientDb, firebaseConfigured } from "@/lib/client/firebase";
import { domainClient } from "@/lib/client/domain-client";
import { registerStudioTools } from "@/lib/webmcp/register-studio-tools";

export function RemixStudio({ branchId }: { branchId: string }) {
  const [branch, setBranch] = useState<BranchDraft | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const branchReady = branch !== null;

  useEffect(() => {
    if (!firebaseConfigured) return;
    const db = clientDb();
    const stopBranch = onSnapshot(
      doc(db, "branchDrafts", branchId),
      (snapshot) => {
        if (!snapshot.exists())
          return setError("This branch could not be found.");
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
        setSelectedId((current) => current ?? parsed[0]?.id ?? null);
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
    const controller = registerStudioTools(branchId);
    return () => controller.abort();
  }, [branchId, branchReady]);

  const selected = useMemo(
    () => episodes.find((episode) => episode.id === selectedId) ?? null,
    [episodes, selectedId],
  );

  async function saveHook(formData: FormData) {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await domainClient.updateEpisode(branchId, selected.id, {
        expectedEpisodeVersion: selected.version,
        actorType: "human",
        patch: { hook: String(formData.get("hook") ?? "") },
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The edit could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!firebaseConfigured) {
    return (
      <main className="studio-empty">
        <p className="eyebrow">Studio setup</p>
        <h1>Connect Firebase to open the living branch.</h1>
        <p>
          The production UI is ready for its scoped branch and episode
          listeners. No fixture state is substituted while configuration is
          absent.
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

  return (
    <main className="studio-shell">
      <header className="studio-heading">
        <div>
          <p className="eyebrow">Remix Studio · live branch</p>
          <h1>{branch?.title ?? "Opening branch…"}</h1>
        </div>
        <span className="live-indicator">
          <span /> Firestore live
        </span>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="studio-grid">
        <section className="branch-board" aria-labelledby="branch-board-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">The artifact</p>
              <h2 id="branch-board-title">Branch Board</h2>
            </div>
            <span>{episodes.length} episodes</span>
          </div>
          <div className="episode-sequence">
            {episodes.map((episode) => (
              <button
                key={episode.id}
                className={`episode-card ${selectedId === episode.id ? "selected" : ""}`}
                onClick={() => setSelectedId(episode.id)}
              >
                <span className="episode-number">
                  {String(episode.position).padStart(2, "0")}
                </span>
                <span className="episode-copy">
                  <strong>{episode.title}</strong>
                  <small>{episode.hook}</small>
                </span>
                {branch?.recentActivity[0]?.summary.includes(episode.title) ? (
                  <span className="agent-mark">
                    <Sparkles size={12} /> Agent changed
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {selected ? (
            <form
              key={`${selected.id}:${selected.version}`}
              action={saveHook}
              className="episode-editor"
            >
              <label htmlFor="hook">Episode hook</label>
              <textarea
                id="hook"
                name="hook"
                defaultValue={selected.hook}
                maxLength={300}
              />
              <button className="button button-primary" disabled={saving}>
                {saving ? "Saving…" : "Save to branch"}
              </button>
            </form>
          ) : null}
        </section>

        <aside className="studio-rail">
          <section className="partner-panel">
            <div className="panel-icon">
              <Bot size={18} />
            </div>
            <p className="eyebrow">Creative Partner</p>
            <h2>Shape the next meaningful choice.</h2>
            <p>
              {branch?.creativeIntent ??
                "Reading the branch’s creative intent…"}
            </p>
            <button className="suggestion-card" type="button">
              <strong>Challenge the reveal</strong>
              <span>What gets more interesting if Emma stays in the dark?</span>
            </button>
            <div className="partner-actions">
              <button className="button button-primary" type="button">
                Build now
              </button>
              <button className="button button-quiet" type="button">
                Keep exploring
              </button>
            </div>
          </section>

          <section className="context-panel">
            <p className="eyebrow">Branch Context</p>
            <div className="context-group inherited">
              <Waypoints size={16} />
              <div>
                <strong>Inherited</strong>
                <p>{branch?.inheritedSummary ?? "Loading…"}</p>
              </div>
            </div>
            <div className="context-group changed">
              <Sparkles size={16} />
              <div>
                <strong>Changed here</strong>
                <p>{branch?.ruleOverrides.length ?? 0} rule overrides</p>
              </div>
            </div>
            <div className="context-group locked">
              <LockKeyhole size={16} />
              <div>
                <strong>Locked decisions</strong>
                <ul>
                  {branch?.constraints.map((item) => (
                    <li key={item.id}>{item.label}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
