import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";

import {
  creativeResponseEnvelopeSchema,
  creativeResponseSchema,
  type CreativeResponse,
} from "@/lib/contracts/creative";
import type { BranchState } from "@/lib/contracts/domain";
import { applyCreativeBuild } from "@/lib/domain/creative-operations";

const state: BranchState = {
  branch: {
    id: "branch-one",
    creatorId: "creator-one",
    rootWorldId: "nightfall",
    baseWorldRevisionId: "nightfall-v1",
    title: "The Fragments We Keep",
    creativeIntent: "Delay the reveal.",
    inheritedSummary: "Nightfall forgets seventeen minutes.",
    inheritedCharacters: [],
    inheritedRelationships: [],
    inheritedFacts: [],
    inheritedConstraints: [],
    addedCharacters: [],
    ruleOverrides: [],
    constraints: [],
    recentActivity: [],
    lastAgentAction: null,
    version: 1,
    updatedAt: "2026-09-02T00:00:00.000Z",
  },
  episodes: [
    {
      id: "episode-one",
      branchId: "branch-one",
      position: 1,
      title: "The Minute Hand",
      hook: "Emma wakes beside a stopped clock.",
      keyBeats: ["Emma checks the clock."],
      narrative: "",
      effects: {
        participantIds: ["emma"],
        revealedFactIds: [],
        resolvedFactIds: [],
        relationshipChanges: [],
        ruleChanges: [],
      },
      version: 1,
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
  ],
};

function buildResponse(): Extract<CreativeResponse, { mode: "BUILD" }> {
  return creativeResponseSchema.parse({
    mode: "BUILD",
    message: "Make Emma's evidence feel deliberately planted.",
    readiness: {
      readyToBuild: true,
      rationale: "The branch has a concrete pressure point.",
    },
    ideas: [],
    operations: [
      {
        operation: "update_episode",
        episodeId: "episode-one",
        expectedEpisodeVersion: 1,
        patch: {
          title: null,
          hook: "Emma finds a stopped clock arranged for her to notice.",
          keyBeats: null,
          narrative: null,
          effects: null,
        },
      },
    ],
  }) as Extract<CreativeResponse, { mode: "BUILD" }>;
}

describe("creative engine contract", () => {
  it("converts the six-mode Zod union into a strict Responses format", () => {
    expect(() =>
      zodTextFormat(creativeResponseEnvelopeSchema, "fenoa_creative_response"),
    ).not.toThrow();
  });

  it("applies BUILD through the same episode domain operation", () => {
    const result = applyCreativeBuild(state, buildResponse());
    expect(result.state.episodes[0]?.version).toBe(2);
    expect(result.state.episodes[0]?.hook).toContain("arranged");
    expect(result.targetIds).toEqual(["episode-one"]);
  });

  it("rejects an exploration response that attempts a mutation", () => {
    const build = buildResponse();
    expect(() =>
      creativeResponseSchema.parse({
        ...build,
        mode: "SUGGEST",
      }),
    ).toThrow();
  });

  it("evaluates readiness without imposing a turn target", () => {
    const response = creativeResponseSchema.parse({
      mode: "ASK",
      message: "Which cost should Emma pay for keeping the evidence?",
      readiness: {
        readyToBuild: true,
        rationale: "A rich premise can already support a useful build.",
      },
      ideas: [],
      operations: [],
    });
    expect(response.readiness.readyToBuild).toBe(true);
  });
});
