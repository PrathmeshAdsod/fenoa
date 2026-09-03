"use client";

import { ArrowRight, Hammer, LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";

import type {
  CreativeMode,
  CreativeTurnRequest,
} from "@/lib/contracts/creative";
import type { WorldCreativeSession } from "@/lib/contracts/world-creative";

type Props = {
  session: WorldCreativeSession | null;
  loading: boolean;
  busy: boolean;
  onTurn(request: CreativeTurnRequest): Promise<void>;
};

const lenses: Array<{ mode: CreativeMode; label: string }> = [
  { mode: "SUGGEST", label: "Suggest" },
  { mode: "CHALLENGE", label: "Challenge" },
  { mode: "CONNECT", label: "Connect" },
  { mode: "RESOLVE", label: "Resolve" },
];

export function WorldPartner({ session, loading, busy, onTurn }: Props) {
  const [prompt, setPrompt] = useState("");
  const latest = session?.turns.at(-1)?.response;
  const capped = (session?.turnCount ?? 0) >= 12;

  async function run(mode: CreativeMode, direction = prompt) {
    await onTurn({ mode, prompt: direction.trim() });
    if (direction === prompt) setPrompt("");
  }

  return (
    <section className="world-partner" aria-labelledby="world-partner-title">
      <div className="world-partner-heading">
        <div>
          <p className="eyebrow">Creative Partner</p>
          <h2 id="world-partner-title">Find the sharper choice</h2>
        </div>
        <Sparkles size={18} aria-hidden="true" />
      </div>

      {loading ? (
        <p className="partner-status">
          <LoaderCircle className="spin" size={15} /> Restoring collaboration…
        </p>
      ) : latest ? (
        <div className="world-partner-response" aria-live="polite">
          <span>{latest.mode.toLowerCase()}</span>
          <p>{latest.message}</p>
          <small>
            {latest.readiness.readyToBuild
              ? "Ready to build · "
              : "Taking shape · "}
            {latest.readiness.rationale}
          </small>
          {latest.ideas.length ? (
            <div className="world-idea-list">
              {latest.ideas.map((idea) => (
                <button
                  type="button"
                  key={`${idea.title}-${idea.detail}`}
                  disabled={busy || capped}
                  onClick={() =>
                    void run(
                      "BUILD",
                      `Apply this direction to the World Canvas: ${idea.title}. ${idea.detail}`,
                    )
                  }
                >
                  <strong>{idea.title}</strong>
                  <span>{idea.detail}</span>
                  <em>
                    Build this <ArrowRight size={13} />
                  </em>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="world-partner-intro">
          Ask for a focused lens. Suggestions and challenges will use the live
          cast, relationships, truths, and story spark already on your canvas.
        </p>
      )}

      <label className="partner-prompt">
        Direction or uncertainty
        <textarea
          value={prompt}
          maxLength={1_200}
          disabled={busy || capped}
          placeholder="John and Teddy both feel dangerous. Help me separate them."
          onChange={(event) => setPrompt(event.target.value)}
        />
      </label>
      <div className="world-lenses">
        {lenses.map((lens) => (
          <button
            type="button"
            key={lens.mode}
            disabled={busy || capped}
            onClick={() => void run(lens.mode)}
          >
            {lens.label}
          </button>
        ))}
      </div>
      <div className="world-build-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={busy || capped}
          onClick={() => void run("BUILD")}
        >
          {busy ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <Hammer size={15} />
          )}
          Build now
        </button>
        <button
          type="button"
          className="button button-quiet"
          disabled={busy || capped}
          onClick={() => void run("ASK")}
        >
          Keep exploring
        </button>
      </div>
      <small className="turn-safety">
        {capped
          ? "The 12-turn safety cap is complete. Manual canvas editing remains available."
          : `${session?.turnCount ?? 0} of 12 safety turns used · no minimum or target`}
      </small>
    </section>
  );
}
