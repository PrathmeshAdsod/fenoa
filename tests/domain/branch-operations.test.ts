import { describe, expect, it } from "vitest";

import type { BranchDraft, Episode } from "@/lib/contracts/domain";
import { setConstraint, updateEpisode } from "@/lib/domain/branch-operations";
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

  it("keeps compact branch reads free of narrative", () => {
    const result = compactBranchState({ branch, episodes: [episode] });
    expect(result.episodes[0]).not.toHaveProperty("narrative");
    expect(JSON.stringify(result)).not.toContain("keyBeats");
  });
});
