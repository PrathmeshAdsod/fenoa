import { zodTextFormat } from "openai/helpers/zod";

import {
  creativeResponseEnvelopeSchema,
  creativeResponseSchema,
  type CreativeMode,
  type CreativeResponse,
  type CreativeSession,
} from "@/lib/contracts/creative";
import type { BranchState } from "@/lib/contracts/domain";
import { DomainError } from "@/lib/domain/errors";
import {
  creativeModel,
  creativeOpenAiClient,
  creativeReasoning,
} from "@/lib/server/ai-config";

export type CreativeProviderInput = {
  mode: CreativeMode;
  prompt: string;
  state: BranchState;
  session: CreativeSession;
  signal?: AbortSignal;
};

export interface CreativeProvider {
  generate(input: CreativeProviderInput): Promise<CreativeResponse>;
}

function boundedContext(state: BranchState, session: CreativeSession) {
  return {
    branch: {
      id: state.branch.id,
      version: state.branch.version,
      title: state.branch.title,
      creativeIntent: state.branch.creativeIntent,
      inheritedSummary: state.branch.inheritedSummary,
      inheritedCharacters: state.branch.inheritedCharacters,
      inheritedRelationships: state.branch.inheritedRelationships,
      inheritedFacts: state.branch.inheritedFacts,
      inheritedConstraints: state.branch.inheritedConstraints,
      addedCharacters: state.branch.addedCharacters,
      ruleOverrides: state.branch.ruleOverrides,
      constraints: state.branch.constraints,
    },
    episodes: state.episodes.map((episode) => ({
      id: episode.id,
      position: episode.position,
      version: episode.version,
      title: episode.title,
      hook: episode.hook,
      keyBeats: episode.keyBeats,
      narrative: episode.narrative.slice(0, 2_000),
      effects: episode.effects,
    })),
    recentCollaboration: session.turns.slice(-6).map((turn) => ({
      mode: turn.mode,
      human: turn.prompt,
      collaborator: turn.response.message,
      ideas: turn.response.ideas,
      readiness: turn.response.readiness,
    })),
  };
}

const instructions = `You are Fenoa's Creative Partner, an incisive collaborator inside a remix studio. Strengthen the human's authorship; do not replace it with generic prose or turn the interaction into a chatbot.

Return exactly the requested mode: ASK, SUGGEST, CHALLENGE, CONNECT, RESOLVE, or BUILD. Evaluate readiness on every turn. There is no minimum and no target number of turns. Rich ideas can be ready after one or two useful turns. ASK must ask one focused question, never a questionnaire. SUGGEST offers specific possibilities. CHALLENGE exposes a productive tension or weak choice. CONNECT finds a meaningful relationship between existing state. RESOLVE reconciles a concrete contradiction. Every exploration response has zero operations.

BUILD converts the strongest current direction into one to four bounded structured operations. Use only IDs and versions present in current state unless adding a new branch character, branch fact, or story constraint. Preserve inherited state and locked constraints. Never publish, delete content, invent engagement, or solve a mystery that is explicitly locked unresolved. For episode patches, use null for unchanged fields; a narrative rewrite must include the complete effects object. For rule and constraint changes, exactly one of the object or ID fields must be non-null as required by the action. Put episode content updates before reorder operations. Keep messages editorial, concrete, and concise.`;

export const openAiCreativeProvider: CreativeProvider = {
  async generate(input) {
    const client = creativeOpenAiClient();
    const response = await client.responses.parse(
      {
        model: creativeModel(),
        reasoning: { effort: creativeReasoning() },
        max_output_tokens: 4_000,
        instructions,
        input: JSON.stringify({
          requestedMode: input.mode,
          humanDirection:
            input.prompt ||
            (input.mode === "BUILD"
              ? "Build the strongest ready direction from our current collaboration."
              : "Advance the branch using the requested creative lens."),
          currentState: boundedContext(input.state, input.session),
        }),
        text: {
          format: zodTextFormat(
            creativeResponseEnvelopeSchema,
            "fenoa_creative_response",
          ),
        },
      },
      { signal: input.signal },
    );
    const parsed = response.output_parsed?.response;
    if (!parsed || parsed.mode !== input.mode) {
      throw new DomainError(
        "PROVIDER_UNAVAILABLE",
        "Creative Partner returned an invalid structured response. Try again.",
        true,
      );
    }
    return creativeResponseSchema.parse(parsed);
  },
};
