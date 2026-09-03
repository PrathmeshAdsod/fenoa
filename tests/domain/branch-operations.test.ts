import { describe, expect, it } from "vitest";

import type { BranchDraft, Episode } from "@/lib/contracts/domain";
import {
  addBranchCharacter,
  addEpisode,
  deleteEpisode,
  moveEpisode,
  setConstraint,
  updateBranchRule,
  updateEpisode,
} from "@/lib/domain/branch-operations";
import { compactBranchState } from "@/lib/domain/branch-state";

const now = "2026-09-02T00:00:00.000Z";

const branch: BranchDraft = {
  id: "branch-one",
  creatorId: "creator-one",
  rootWorldId: "nightfall",
  baseWorldRevisionId: "nightfall-v1",
  title: "The Fragments We Keep",
  creativeIntent: "Delay the reveal without losing momentum.",
  inheritedSummary: "Nightfall forgets 2:00–2:17 AM.",
  inheritedCharacters: [],
  inheritedRelationships: [],
  inheritedFacts: [],
  inheritedConstraints: [],
  addedCharacters: [],
  ruleOverrides: [],
  constraints: [
    {
      id: "lena-after-seven",
      type: "character_availability",
      label: "Lena cannot appear before Episode 7",
      description: "Preserve Lena as the late destabilizing arrival.",
      characterId: "lena",
      availableFromEpisode: 7,
    },
  ],
  recentActivity: [],
  lastAgentAction: null,
  version: 1,
  updatedAt: now,
};

const episode: Episode = {
  id: "episode-five",
  branchId: branch.id,
  position: 5,
  title: "The Empty Frame",
  hook: "Emma finds a gap in the evidence.",
  keyBeats: ["Emma inspects the failed camera archive."],
  narrative: "",
  effects: {
    participantIds: ["emma"],
    revealedFactIds: [],
    resolvedFactIds: [],
    relationshipChanges: [],
    ruleChanges: [],
  },
  version: 1,
  updatedAt: now,
};

describe("branch operations", () => {
  it("updates an episode with an optimistic version", () => {
    const result = updateEpisode(
      branch,
      episode,
      {
        expectedEpisodeVersion: 1,
        actorType: "human",
        patch: { hook: "Emma discovers the archive was deliberately cut." },
      },
      new Date("2026-09-02T01:00:00.000Z"),
    );
    expect(result.version).toBe(2);
    expect(result.hook).toContain("deliberately");
  });

  it("rejects a stale episode update", () => {
    expect(() =>
      updateEpisode(branch, episode, {
        expectedEpisodeVersion: 2,
        actorType: "human",
        patch: { hook: "Stale edit" },
      }),
    ).toThrow(/changed after it was read/i);
  });

  it("rejects a locked character appearing too early", () => {
    expect(() =>
      updateEpisode(branch, episode, {
        expectedEpisodeVersion: 1,
        actorType: "webmcp_agent",
        patch: {
          effects: { ...episode.effects, participantIds: ["emma", "lena"] },
        },
      }),
    ).toThrow(/Lena cannot appear/i);
  });

  it("requires narrative rewrites to declare effects", async () => {
    const { updateEpisodeInputSchema } = await import("@/lib/contracts/api");
    expect(() =>
      updateEpisodeInputSchema.parse({
        expectedEpisodeVersion: 1,
        patch: { narrative: "Lena enters the station." },
      }),
    ).toThrow(/structured effects/i);
  });

  it("rejects partial effects instead of erasing omitted effect lists", async () => {
    const { updateEpisodeInputSchema } = await import("@/lib/contracts/api");
    expect(() =>
      updateEpisodeInputSchema.parse({
        expectedEpisodeVersion: 1,
        patch: { effects: {} },
      }),
    ).toThrow();
  });

  it("adds and versions a story constraint", () => {
    const result = setConstraint(
      branch,
      {
        action: "add",
        actorType: "human",
        expectedBranchVersion: 1,
        constraint: {
          id: "mystery-unresolved",
          type: "fact_state_lock",
          label: "Keep 2:17 unresolved",
          description: "The branch must not solve the central mystery yet.",
          factId: "missing-time",
          requiredState: "unresolved",
        },
      },
      new Date("2026-09-02T01:00:00.000Z"),
    );
    expect(result.version).toBe(2);
    expect(result.constraints).toHaveLength(2);
  });

  it("reorders episodes as one versioned branch operation", () => {
    const first = { ...episode, id: "episode-one", position: 1 };
    const second = { ...episode, id: "episode-two", position: 2 };
    const result = moveEpisode(branch, [first, second], {
      episodeId: first.id,
      toPosition: 2,
      expectedBranchVersion: 1,
      actorType: "human",
    });
    expect(result.branch.version).toBe(2);
    expect(result.episodes.map((item) => item.id)).toEqual([
      "episode-two",
      "episode-one",
    ]);
    expect(result.episodes.every((item) => item.version === 2)).toBe(true);
  });

  it("rejects a reorder that moves a character before availability", () => {
    const episodes = Array.from({ length: 7 }, (_, index) => ({
      ...episode,
      id: `episode-${index + 1}`,
      position: index + 1,
      effects: {
        ...episode.effects,
        participantIds: index === 6 ? ["lena"] : ["emma"],
      },
    }));
    expect(() =>
      moveEpisode(branch, episodes, {
        episodeId: "episode-7",
        toPosition: 6,
        expectedBranchVersion: 1,
        actorType: "human",
      }),
    ).toThrow(/Lena cannot appear/i);
  });

  it("keeps branch characters and rule overrides separate from inheritance", () => {
    const withCharacter = addBranchCharacter(branch, {
      expectedBranchVersion: 1,
      actorType: "webmcp_agent",
      character: {
        id: "lena",
        name: "Lena Ward",
        role: "The woman who remembers",
        appearance: "",
        personality: "Watchful",
        desire: "Tell the truth",
        fear: "",
        background: "",
        currentSituation: "Outside Nightfall",
        secret: "",
      },
    });
    const withRule = updateBranchRule(withCharacter, {
      action: "upsert",
      expectedBranchVersion: 2,
      actorType: "webmcp_agent",
      fact: {
        id: "lena-remembers",
        category: "secret",
        statement: "Lena remembers every missing minute.",
        state: "true",
      },
    });
    expect(withRule.addedCharacters[0]?.name).toBe("Lena Ward");
    expect(withRule.ruleOverrides[0]?.id).toBe("lena-remembers");
    expect(withRule.inheritedSummary).toBe(branch.inheritedSummary);
  });

  it("does not remove a branch fact protected by a wording lock", () => {
    const fact = {
      id: "lena-remembers",
      category: "secret" as const,
      statement: "Lena remembers every missing minute.",
      state: "true" as const,
    };
    const locked = {
      ...branch,
      ruleOverrides: [fact],
      constraints: [
        ...branch.constraints,
        {
          id: "lena-remembers-lock",
          type: "branch_fact_lock" as const,
          label: "Keep Lena's memory intact",
          description: "This truth anchors the branch.",
          factId: fact.id,
          statement: fact.statement,
        },
      ],
    };
    expect(() =>
      updateBranchRule(locked, {
        action: "remove",
        expectedBranchVersion: 1,
        actorType: "human",
        factId: fact.id,
      }),
    ).toThrow(/Keep Lena's memory intact/i);
  });

  it("adds and removes episodes while preserving a contiguous sequence", () => {
    const first = { ...episode, id: "episode-one", position: 1 };
    const added = addEpisode(branch, [first], "episode-two", {
      expectedBranchVersion: 1,
      actorType: "human",
      position: 1,
      title: "Before the Clock",
      hook: "John hears the city inhale.",
    });
    expect(added.episodes.map((item) => item.position)).toEqual([1, 2]);
    const removed = deleteEpisode(added.branch, added.episodes, {
      expectedBranchVersion: 2,
      actorType: "human",
      episodeId: "episode-two",
    });
    expect(removed.episodes).toHaveLength(1);
    expect(removed.episodes[0]?.position).toBe(1);
  });

  it("rejects a deletion that shifts a character before availability", () => {
    const episodes = Array.from({ length: 7 }, (_, index) => ({
      ...episode,
      id: `episode-${index + 1}`,
      position: index + 1,
      effects: {
        ...episode.effects,
        participantIds: index === 6 ? ["lena"] : ["emma"],
      },
    }));
    expect(() =>
      deleteEpisode(branch, episodes, {
        expectedBranchVersion: 1,
        actorType: "human",
        episodeId: "episode-1",
      }),
    ).toThrow(/Lena cannot appear/i);
  });

  it("reserves episode structure changes for the human studio", async () => {
    const { addEpisodeInputSchema, deleteEpisodeInputSchema } =
      await import("@/lib/contracts/api");
    expect(() =>
      addEpisodeInputSchema.parse({
        expectedBranchVersion: 1,
        position: 2,
        title: "A new episode",
        hook: "A new clue appears.",
        actorType: "webmcp_agent",
      }),
    ).toThrow();
    expect(() =>
      deleteEpisodeInputSchema.parse({
        expectedBranchVersion: 1,
        episodeId: "episode-1",
        actorType: "webmcp_agent",
      }),
    ).toThrow();
  });

  it("keeps compact branch reads free of narrative", () => {
    const result = compactBranchState({ branch, episodes: [episode] });
    expect(result.episodes[0]).not.toHaveProperty("narrative");
    expect(JSON.stringify(result)).not.toContain("keyBeats");
  });
});
