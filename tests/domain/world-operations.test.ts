import { describe, expect, it } from "vitest";

import {
  createWorldDraft,
  publishWorldSnapshot,
  updateWorldDraft,
} from "@/lib/domain/world-operations";

const now = new Date("2026-09-02T08:00:00.000Z");

describe("world operations", () => {
  it("creates and versions a bounded world canvas", () => {
    const draft = createWorldDraft(
      "nightfall",
      "creator-one",
      {
        name: "Nightfall",
        premise:
          "Every night, the city loses every memory formed between 2:00 and 2:17 AM.",
        genre: "Supernatural noir",
        tone: "Rain-soaked dread",
      },
      now,
    );
    const updated = updateWorldDraft(
      draft,
      "creator-one",
      {
        expectedVersion: 1,
        patch: {
          characters: [
            {
              id: "emma",
              name: "Emma Cross",
              role: "Journalist",
              appearance: "",
              personality: "Restless and precise",
              desire: "Expose the missing time",
              fear: "",
              background: "",
              currentSituation: "Tracing disappearances",
              secret: "",
            },
          ],
        },
      },
      now,
    );
    expect(updated.version).toBe(2);
    expect(updated.characters[0]?.name).toBe("Emma Cross");
  });

  it("rejects stale and foreign edits", () => {
    const draft = createWorldDraft(
      "nightfall",
      "creator-one",
      {
        name: "Nightfall",
        premise:
          "Every night, the city loses every memory formed between 2:00 and 2:17 AM.",
        genre: "Supernatural noir",
        tone: "Rain-soaked dread",
      },
      now,
    );
    expect(() =>
      updateWorldDraft(draft, "creator-two", {
        expectedVersion: 1,
        patch: { tone: "Warm" },
      }),
    ).toThrow(/do not own/i);
    expect(() =>
      updateWorldDraft(draft, "creator-one", {
        expectedVersion: 2,
        patch: { tone: "Warm" },
      }),
    ).toThrow(/changed after/i);
  });

  it("validates relationship references and story-spark length", () => {
    const draft = createWorldDraft(
      "nightfall",
      "creator-one",
      {
        name: "Nightfall",
        premise:
          "Every night, the city loses every memory formed between 2:00 and 2:17 AM.",
        genre: "Supernatural noir",
        tone: "Rain-soaked dread",
      },
      now,
    );
    expect(() =>
      updateWorldDraft(draft, "creator-one", {
        expectedVersion: 1,
        patch: {
          relationships: [
            {
              id: "missing-cast",
              fromCharacterId: "emma",
              toCharacterId: "teddy",
              kind: "deception",
              description: "Teddy lies to Emma.",
            },
          ],
        },
      }),
    ).toThrow(/existing characters/i);
    expect(() =>
      updateWorldDraft(draft, "creator-one", {
        expectedVersion: 1,
        patch: {
          storySpark: Array.from({ length: 151 }, () => "word").join(" "),
        },
      }),
    ).toThrow(/150 words/i);
  });

  it("creates immutable revision data while preserving social counters", () => {
    const initial = createWorldDraft(
      "nightfall",
      "creator-one",
      {
        name: "Nightfall",
        premise:
          "Every night, the city loses every memory formed between 2:00 and 2:17 AM.",
        genre: "Supernatural noir",
        tone: "Rain-soaked dread",
      },
      now,
    );
    const first = {
      id: "one",
      name: "One",
      role: "First witness",
      appearance: "",
      personality: "Watchful",
      desire: "Know the truth",
      fear: "",
      background: "",
      currentSituation: "Waiting",
      secret: "",
    };
    const second = { ...first, id: "two", name: "Two", role: "Second witness" };
    const draft = updateWorldDraft(initial, "creator-one", {
      expectedVersion: 1,
      patch: {
        characters: [first, second],
        relationships: [
          {
            id: "one-two",
            fromCharacterId: "one",
            toCharacterId: "two",
            kind: "trust",
            description: "One trusts Two with the missing hour.",
          },
        ],
        facts: [
          {
            id: "missing-hour",
            category: "world_rule",
            statement: "The hour cannot be recorded.",
            state: "true",
          },
        ],
      },
    });
    const published = publishWorldSnapshot(
      draft,
      "nightfall-rev-one",
      1,
      null,
      now,
    );
    expect(published.revision.worldId).toBe("nightfall");
    expect(published.world.currentRevisionId).toBe("nightfall-rev-one");
    expect(published.world.remixCount).toBe(0);
    expect(published.draft.version).toBe(3);
  });
});
