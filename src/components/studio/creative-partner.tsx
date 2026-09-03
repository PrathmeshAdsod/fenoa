"use client";

import {
  Bot,
  Hammer,
  Link2,
  MessageCircleQuestion,
  RotateCcw,
  Scale,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  CreativeMode,
  CreativeSession,
  CreativeTurnRequest,
} from "@/lib/contracts/creative";
import type { BranchDraft } from "@/lib/contracts/domain";

const lenses: Array<{
  mode: Exclude<CreativeMode, "BUILD">;
  label: string;
  icon: typeof Sparkles;
}> = [
  { mode: "ASK", label: "Ask", icon: MessageCircleQuestion },
  { mode: "SUGGEST", label: "Suggest", icon: WandSparkles },
  { mode: "CHALLENGE", label: "Challenge", icon: Scale },
  { mode: "CONNECT", label: "Connect", icon: Link2 },
  { mode: "RESOLVE", label: "Resolve", icon: Sparkles },
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
  const atCap = (session?.turnCount ?? 0) >= 12;
  const remaining = 12 - (session?.turnCount ?? 0);
  const activityTime = useMemo(() => {
    if (!branch.lastAgentAction) return null;
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(branch.lastAgentAction.createdAt));
  }, [branch.lastAgentAction]);

  async function send(requestedMode: CreativeMode) {
    const completed = await onTurn({ mode: requestedMode, prompt });
    if (completed && requestedMode !== "BUILD") setPrompt("");
  }

  return (
    <section className="partner-panel" aria-labelledby="creative-partner-title">
      <div className="partner-heading">
        <div className="panel-icon">
          <Bot size={18} aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">Creative Partner</p>
          <h2 id="creative-partner-title">Find the stronger choice.</h2>
        </div>
      </div>
      <p className="partner-intent">{branch.creativeIntent}</p>

      <div className="lens-picker" aria-label="Creative lens">
        {lenses.map((lens) => {
          const Icon = lens.icon;
          return (
            <button
              key={lens.mode}
              className={mode === lens.mode ? "active" : ""}
              type="button"
              aria-pressed={mode === lens.mode}
              onClick={() => setMode(lens.mode)}
            >
              <Icon size={14} aria-hidden="true" /> {lens.label}
            </button>
          );
        })}
      </div>

      <label className="partner-prompt">
        Direction for this turn
        <textarea
          value={prompt}
          maxLength={1_200}
          placeholder="What feels unresolved, fragile, or ready to become real?"
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
          {busy ? "Thinking…" : `Keep exploring · ${mode.toLowerCase()}`}
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={busy || loading || atCap}
          onClick={() => void send("BUILD")}
        >
          <Hammer size={14} aria-hidden="true" /> Build now
        </button>
      </div>

      <div className="turn-meter">
        <span>
          {atCap ? "Safety cap reached" : `${remaining} turns available`}
        </span>
        <span>Readiness is evaluated every turn</span>
      </div>

      {loading ? (
        <div className="partner-response loading-note" aria-live="polite">
          Restoring the current collaboration…
        </div>
      ) : latest ? (
        <article className="partner-response" aria-live="polite">
          <header>
            <span>{latest.response.mode}</span>
            <span
              className={
                latest.response.readiness.readyToBuild ? "ready" : "exploring"
              }
            >
              {latest.response.readiness.readyToBuild
                ? "Ready to build"
                : "Still opening possibilities"}
            </span>
          </header>
          <p>{latest.response.message}</p>
          {latest.response.ideas.length ? (
            <div className="idea-notes">
              {latest.response.ideas.map((idea) => (
                <div key={`${latest.id}-${idea.title}`}>
                  <strong>{idea.title}</strong>
                  <span>{idea.detail}</span>
                </div>
              ))}
            </div>
          ) : null}
          <small>{latest.response.readiness.rationale}</small>
        </article>
      ) : (
        <div className="partner-response empty-note">
          Choose a lens whenever the artifact needs pressure or possibility.
          Build is available immediately; there is no required conversation.
        </div>
      )}

      {branch.lastAgentAction ? (
        <div className="undo-strip">
          <div>
            <strong>{branch.lastAgentAction.summary}</strong>
            <span>
              {activityTime ? `Applied at ${activityTime}` : "Applied live"}
            </span>
          </div>
          <button
            className="button button-quiet"
            type="button"
            disabled={busy}
            onClick={() => void onUndo()}
          >
            <RotateCcw size={14} aria-hidden="true" /> Undo agent action
          </button>
        </div>
      ) : null}
    </section>
  );
}
