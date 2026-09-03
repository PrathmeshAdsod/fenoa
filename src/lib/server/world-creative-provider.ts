import { zodTextFormat } from "openai/helpers/zod";

import type { CreativeMode } from "@/lib/contracts/creative";
import {
  worldCreativeResponseEnvelopeSchema,
  worldCreativeResponseSchema,
  type WorldCreativeResponse,
  type WorldCreativeSession,
} from "@/lib/contracts/world-creative";
import type { WorldDraft } from "@/lib/contracts/world";
import { DomainError } from "@/lib/domain/errors";
import {
  creativeModel,
  creativeOpenAiClient,
  creativeReasoning,
} from "@/lib/server/ai-config";

export type WorldCreativeProviderInput = {
  mode: CreativeMode;
  prompt: string;
  draft: WorldDraft;
  session: WorldCreativeSession;
  signal?: AbortSignal;
};

export interface WorldCreativeProvider {
  generate(input: WorldCreativeProviderInput): Promise<WorldCreativeResponse>;
}

const instructions = `You are Fenoa's Creative Partner inside an original-world studio. The human's World Canvas is the artifact; you are an incisive editorial collaborator, not a story generator or chat companion.

Return exactly the requested mode. Evaluate readiness every turn; there is no minimum or target. Rich worlds can be ready after one or two useful turns. ASK asks one high-value contextual question. SUGGEST offers meaningfully different directions. CHALLENGE identifies repetition, weak motivation, predictability, or a collapsing mystery. CONNECT finds a specific connection between existing characters, relationships, rules, and tensions. RESOLVE repairs a concrete contradiction. Exploration modes return patch null.

BUILD applies the strongest ready direction as a bounded patch to the current World Canvas. Use null for every unchanged field. Preserve IDs of existing entities unless a replacement is necessary, keep no more than eight characters, sixteen relationships, sixteen facts, six locations, and a story spark of at most 150 words. Relationships must connect two character IDs in the resulting cast. Do not invent engagement, publish, generate images, or write episodes. Keep the world concise, remixable, and rich with possibility rather than encyclopedic.`;

export const openAiWorldCreativeProvider: WorldCreativeProvider = {
  async generate(input) {
    const response = await creativeOpenAiClient().responses.parse(
      {
        model: creativeModel(),
        reasoning: { effort: creativeReasoning() },
        max_output_tokens: 3_500,
        instructions,
        input: JSON.stringify({
          requestedMode: input.mode,
          humanDirection:
            input.prompt ||
            (input.mode === "BUILD"
              ? "Build the strongest ready direction into the World Canvas."
              : "Advance the world using the requested creative lens."),
          currentCanvas: {
            name: input.draft.name,
            premise: input.draft.premise,
            genre: input.draft.genre,
            tone: input.draft.tone,
            aesthetic: input.draft.aesthetic,
            locations: input.draft.locations,
            characters: input.draft.characters,
            relationships: input.draft.relationships,
            facts: input.draft.facts,
            storySpark: input.draft.storySpark,
          },
          recentCollaboration: input.session.turns.slice(-6).map((turn) => ({
            mode: turn.mode,
            human: turn.prompt,
            collaborator: turn.response.message,
            ideas: turn.response.ideas,
            readiness: turn.response.readiness,
          })),
        }),
        text: {
          format: zodTextFormat(
            worldCreativeResponseEnvelopeSchema,
            "fenoa_world_creative_response",
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
    return worldCreativeResponseSchema.parse(parsed);
  },
};
