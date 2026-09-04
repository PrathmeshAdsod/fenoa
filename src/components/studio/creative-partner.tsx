"use client";

import {
  ArrowRight,
  ChevronDown,
  Hammer,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import type {
  CreativeMode,
  CreativeSession,
  CreativeTurnRequest,
} from "@/lib/contracts/creative";
import type { BranchDraft } from "@/lib/contracts/domain";

const lenses: Array<{
  mode: Exclude<CreativeMode, "BUILD">;
  label: string;
}> = [
  { mode: "ASK", label: "Ask" },
  { mode: "SUGGEST", label: "Suggest" },
  { mode: "CHALLENGE", label: "Challenge" },
  { mode: "CONNECT", label: "Connect" },
  { mode: "RESOLVE", label: "Resolve" },
];

export function CreativePartner({
  branch,
  session,
  busy,
  loading,
  onTurn,
  onUndo,
}: {
  branch: BranchDraft;
  session: CreativeSession | null;
  busy: boolean;
  loading: boolean;
  onTurn(request: CreativeTurnRequest): Promise<boolean>;
  onUndo(): Promise<void>;
}) {
  const [mode, setMode] = useState<Exclude<CreativeMode, "BUILD">>("SUGGEST");
  const [prompt, setPrompt] = useState("");
  const latest = session?.turns.at(-1) ?? null;
  const primaryIdea = latest?.response.ideas[0] ?? null;
  const atCap = (session?.turnCount ?? 0) >= 12;

  async function send(requestedMode: CreativeMode, direction = prompt) {
    const completed = await onTurn({
      mode: requestedMode,
      prompt: direction.trim(),
    });
    if (completed && direction === prompt && requestedMode !== "BUILD") {
      setPrompt("");
    }
  }

  function ideaDirection(title: string, detail: string): string {
    return `${title}. ${detail}`;
  }

  return (
    <section className="partner-panel" aria-labelledby="creative-partner-title">
      <div className="partner-heading">
        <div>
          <p className="eyebrow">Creative Partner</p>
          <h2 id="creative-partner-title">What are you thinking about?</h2>
        </div>
        <Sparkles size={16} aria-hidden="true" />
      </div>
      <p className="partner-intent">{branch.creativeIntent}</p>

      <label className="partner-prompt">
        Share a direction or uncertainty
        <textarea
          value={prompt}
          maxLength={1_200}
          disabled={atCap}
          placeholder="What feels unresolved?"
          onChange={(event) => setPrompt(event.target.value)}
        />
      </label>

      <div className="partner-actions primary-actions">
        <button
          className="button button-quiet"
          type="button"
          disabled={busy || loading || atCap}
          onClick={() => void send(mode)}
        >
          {busy ? "Thinking…" : "Develop this"}
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={busy || loading || atCap}
          onClick={() => void send("BUILD")}
        >
          <Hammer size={14} aria-hidden="true" /> Apply to episode
        </button>
      </div>

      {loading ? (
        <div className="partner-response loading-note" aria-live="polite">
          Restoring the current collaboration…
        </div>
      ) : latest ? (
        <article className="partner-response" aria-live="polite">
          <span>{latest.response.mode.toLowerCase()}</span>
          <p>{latest.response.message}</p>
          {primaryIdea ? (
            <div className="partner-primary-idea">
              <strong>{primaryIdea.title}</strong>
              <p>{primaryIdea.detail}</p>
              <div>
                <button
                  type="button"
                  className="text-action"
                  disabled={busy || atCap}
                  onClick={() =>
                    void send(
                      "SUGGEST",
                      `Develop this direction further: ${ideaDirection(primaryIdea.title, primaryIdea.detail)}`,
                    )
                  }
                >
                  Develop this <ArrowRight size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="text-action"
                  disabled={busy || atCap}
                  onClick={() =>
                    void send(
                      "BUILD",
                      `Apply this direction to the current remix: ${ideaDirection(primaryIdea.title, primaryIdea.detail)}`,
                    )
                  }
                >
                  Apply <ArrowRight size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
          {latest.response.ideas.length > 1 ? (
            <details className="idea-notes">
              <summary>More suggestions</summary>
              {latest.response.ideas.slice(1).map((idea) => (
                <button
                  type="button"
                  key={`${latest.id}-${idea.title}`}
                  disabled={busy || atCap}
                  onClick={() =>
                    void send(
                      "BUILD",
                      `Apply this direction to the current remix: ${ideaDirection(idea.title, idea.detail)}`,
                    )
                  }
                >
                  <strong>{idea.title}</strong>
                  <span>{idea.detail}</span>
                </button>
              ))}
            </details>
          ) : null}
          <small>{latest.response.readiness.rationale}</small>
        </article>
      ) : (
        <div className="partner-response empty-note">
          The partner reads the live episode and story context. Build is always
          available; there is no required conversation.
        </div>
      )}

      {branch.lastAgentAction ? (
        <div className="undo-strip">
          <span>Agent edit</span>
          <strong>{branch.lastAgentAction.summary}</strong>
          <button
            className="text-action"
            type="button"
            disabled={busy}
            onClick={() => void onUndo()}
          >
            <RotateCcw size={13} aria-hidden="true" /> Undo
          </button>
        </div>
      ) : null}

      <details className="partner-more">
        <summary>
          More ways to work <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="lens-picker" aria-label="Creative approach">
          {lenses.map((lens) => (
            <button
              key={lens.mode}
              className={mode === lens.mode ? "active" : ""}
              type="button"
              aria-pressed={mode === lens.mode}
              onClick={() => setMode(lens.mode)}
            >
              {lens.label}
            </button>
          ))}
        </div>
      </details>

      <div className="turn-meter">
        <span>
          {atCap ? "Safety cap reached" : "Readiness checked every turn"}
        </span>
        <span>{session?.turnCount ?? 0} / 12 safety turns</span>
      </div>
    </section>
  );
}
