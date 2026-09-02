"use client";

import { Check, FileText, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Episode } from "@/lib/contracts/domain";

type EpisodeDraft = {
  title: string;
  hook: string;
  keyBeats: string;
  narrative: string;
};

function fromEpisode(episode: Episode): EpisodeDraft {
  return {
    title: episode.title,
    hook: episode.hook,
    keyBeats: episode.keyBeats.join("\n"),
    narrative: episode.narrative,
  };
}

export function EpisodeEditor({
  episode,
  onSave,
}: {
  episode: Episode;
  onSave(episode: Episode, draft: EpisodeDraft): Promise<void>;
}) {
  const [draft, setDraft] = useState(() => fromEpisode(episode));
  const [baseVersion, setBaseVersion] = useState(episode.version);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const conflicted = dirty && episode.version !== baseVersion;

  useEffect(() => {
    if (!dirty) {
      setDraft(fromEpisode(episode));
      setBaseVersion(episode.version);
    }
  }, [episode, dirty]);

  const save = useCallback(async () => {
    if (!dirty || saving || conflicted) return;
    const submitted = draftRef.current;
    setSaving(true);
    setSaved(false);
    try {
      await onSave({ ...episode, version: baseVersion }, submitted);
      if (draftRef.current === submitted) {
        setDirty(false);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1_800);
      }
    } catch {
      // The parent presents the actionable server error; keep this draft dirty.
    } finally {
      setSaving(false);
    }
  }, [baseVersion, conflicted, dirty, episode, onSave, saving]);

  useEffect(() => {
    if (!dirty || saving || conflicted) return;
    const timer = window.setTimeout(() => void save(), 1_200);
    return () => window.clearTimeout(timer);
  }, [conflicted, dirty, draft, save, saving]);

  function update<K extends keyof EpisodeDraft>(
    key: K,
    value: EpisodeDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  function loadLatest() {
    setDraft(fromEpisode(episode));
    setBaseVersion(episode.version);
    setDirty(false);
  }

  return (
    <section className="episode-editor" aria-labelledby="episode-editor-title">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">Episode {episode.position}</p>
          <h3 id="episode-editor-title">Shape the scene</h3>
        </div>
        <span className={`save-state ${dirty ? "dirty" : ""}`}>
          {saving ? (
            "Saving…"
          ) : saved ? (
            <>
              <Check size={13} aria-hidden="true" /> Saved live
            </>
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            "Up to date"
          )}
        </span>
      </div>

      {conflicted ? (
        <div className="conflict-note" role="alert">
          <div>
            <strong>This episode changed elsewhere.</strong>
            <p>
              Load the live version before continuing so no work is overwritten.
            </p>
          </div>
          <button className="button button-quiet" onClick={loadLatest}>
            <RefreshCw size={14} aria-hidden="true" /> Load latest
          </button>
        </div>
      ) : null}

      <div className="editor-fields">
        <label className="field-title">
          Title
          <input
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            maxLength={80}
          />
        </label>
        <label className="field-hook">
          Hook
          <textarea
            value={draft.hook}
            onChange={(event) => update("hook", event.target.value)}
            maxLength={300}
          />
        </label>
        <label>
          Key beats <span>one per line</span>
          <textarea
            value={draft.keyBeats}
            onChange={(event) => update("keyBeats", event.target.value)}
            maxLength={2_400}
          />
        </label>
        <label className="field-narrative">
          <span className="label-with-icon">
            <FileText size={14} aria-hidden="true" /> Short narrative
          </span>
          <textarea
            value={draft.narrative}
            onChange={(event) => update("narrative", event.target.value)}
            maxLength={7_000}
            placeholder="Develop the scene only when the branch needs prose. The sequence and story effects remain the source of truth."
          />
        </label>
      </div>
      <div className="editor-footer">
        <span>{draft.narrative.length.toLocaleString()} / 7,000</span>
        <button
          className="button button-primary"
          type="button"
          disabled={!dirty || saving || conflicted}
          onClick={() => void save()}
        >
          <Save size={14} aria-hidden="true" /> Save now
        </button>
      </div>
    </section>
  );
}

export type { EpisodeDraft };
