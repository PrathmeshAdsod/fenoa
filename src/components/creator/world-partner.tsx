"use client";

import {
  ArrowRight,
  ChevronDown,
  Hammer,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
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
  onTurn(request: CreativeTurnRequest): Promise<boolean>;
};

const lenses: Array<{ mode: Exclude<CreativeMode, "BUILD">; label: string }> = [
  { mode: "ASK", label: "Ask" },
  { mode: "SUGGEST", label: "Suggest" },
  { mode: "CHALLENGE", label: "Challenge" },
  { mode: "CONNECT", label: "Connect" },
  { mode: "RESOLVE", label: "Resolve" },
];

export function WorldPartner({ session, loading, busy, onTurn }: Props) {
  const [mode, setMode] = useState<Exclude<CreativeMode, "BUILD">>("SUGGEST");
  const [prompt, setPrompt] = useState("");
  const latest = session?.turns.at(-1)?.response;
  const capped = (session?.turnCount ?? 0) >= 12;
  const primaryIdea = latest?.ideas[0] ?? null;

  async function run(requestedMode: CreativeMode, direction = prompt) {
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
    <section className="world-partner" aria-labelledby="world-partner-title">
      <div className="world-partner-heading">
        <div>
          <p className="eyebrow">Creative Partner</p>
          <h2 id="world-partner-title">What are you thinking about?</h2>
        </div>
        <Sparkles size={17} aria-hidden="true" />
      </div>

      {loading ? (
        <p className="partner-status">
          <LoaderCircle className="spin" size={15} /> Restoring collaboration…
        </p>
      ) : latest ? (
        <div className="world-partner-response" aria-live="polite">
          <span>{latest.mode.toLowerCase()}</span>
          <p>{latest.message}</p>
          {primaryIdea ? (
            <article className="world-primary-idea">
              <strong>{primaryIdea.title}</strong>
              <p>{primaryIdea.detail}</p>
              <div>
                <button
                  type="button"
                  className="text-action"
                  disabled={busy || capped}
                  onClick={() =>
                    void run(
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
                  disabled={busy || capped}
                  onClick={() =>
                    void run(
                      "BUILD",
                      `Apply this direction to the World Canvas: ${ideaDirection(primaryIdea.title, primaryIdea.detail)}`,
                    )
                  }
                >
                  Apply to world <ArrowRight size={13} aria-hidden="true" />
                </button>
              </div>
            </article>
          ) : null}
          {latest.ideas.length > 1 ? (
            <details className="world-more-ideas">
              <summary>More suggestions</summary>
              <div className="world-idea-list">
                {latest.ideas.slice(1).map((idea) => (
                  <button
                    type="button"
                    key={`${idea.title}-${idea.detail}`}
                    disabled={busy || capped}
                    onClick={() =>
                      void run(
                        "BUILD",
                        `Apply this direction to the World Canvas: ${ideaDirection(idea.title, idea.detail)}`,
                      )
                    }
                  >
                    <strong>{idea.title}</strong>
                    <span>{idea.detail}</span>
                    <em>Apply to world</em>
                  </button>
                ))}
              </div>
            </details>
          ) : null}
          <small>{latest.readiness.rationale}</small>
        </div>
      ) : (
        <p className="world-partner-intro">
          Work independently, or invite a focused suggestion using the live
          characters, connections, truths, and story spark on this canvas.
        </p>
      )}

      <label className="partner-prompt">
        Share a direction or uncertainty
        <textarea
          value={prompt}
          maxLength={1_200}
          disabled={busy || capped}
          placeholder="What feels unresolved?"
          onChange={(event) => setPrompt(event.target.value)}
        />
      </label>

      <div className="world-build-actions">
        <button
          type="button"
          className="button button-quiet"
          disabled={busy || capped}
          onClick={() => void run(mode)}
        >
          {busy ? <LoaderCircle className="spin" size={15} /> : null}
          Think with me
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={busy || capped}
          onClick={() => void run("BUILD")}
        >
          <Hammer size={15} aria-hidden="true" /> Apply to world
        </button>
      </div>

      <details className="partner-more">
        <summary>
          More ways to work <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="world-lenses" aria-label="Creative approach">
          {lenses.map((lens) => (
            <button
              type="button"
              key={lens.mode}
              className={mode === lens.mode ? "active" : ""}
              aria-pressed={mode === lens.mode}
              onClick={() => setMode(lens.mode)}
            >
              {lens.label}
            </button>
          ))}
        </div>
      </details>

      <small className="turn-safety">
        {capped
          ? "The 12-turn safety cap is complete. Manual editing remains available."
          : `${session?.turnCount ?? 0} of 12 safety turns used · readiness is checked every turn`}
      </small>
    </section>
  );
}
