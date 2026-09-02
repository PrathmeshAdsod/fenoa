import { beforeAll, describe, expect, it } from "vitest";

import type { CreativeProvider } from "@/lib/server/creative-provider";
import { adminDb } from "@/lib/server/firebase-admin";
import { runCreativeTurn } from "@/lib/server/creative-service";
import {
  saveEpisodeUpdate,
  undoLastAgentAction,
} from "@/lib/server/branch-repository";

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeWithEmulator = emulatorAvailable ? describe : describe.skip;
const branchId = "nightfall-fragments";
const uid = process.env.FENOA_SEED_CREATOR_UID || "playwright-user";

const provider: CreativeProvider = {
  async generate(input) {
    if (input.mode === "BUILD") {
      const episode = input.state.episodes[0]!;
      return {
        mode: "BUILD",
        message: "Make the first clue feel deliberately placed.",
        readiness: {
          readyToBuild: true,
          rationale: "The direction is specific enough to alter the artifact.",
        },
        ideas: [],
        operations: [
          {
            operation: "update_episode",
            episodeId: episode.id,
            expectedEpisodeVersion: episode.version,
            patch: {
              title: null,
              hook: "Emma finds the stopped clock waiting in her own apartment.",
              keyBeats: null,
              narrative: null,
              effects: null,
            },
          },
        ],
      };
    }
    return {
      mode: input.mode,
      message: "The stronger choice is to make the evidence feel personal.",
      readiness: {
        readyToBuild: input.session.turnCount === 0,
        rationale: "Readiness depends on the idea, not a minimum turn count.",
      },
      ideas: [
        {
          title: "A planted clue",
          detail: "Move the clock from public evidence into Emma's home.",
        },
      ],
      operations: [],
    };
  },
};

describeWithEmulator("creative service with Firestore emulator", () => {
  beforeAll(async () => {
    await adminDb().collection("creativeSessions").doc(branchId).delete();
  });

  it("reserves creative-engine attribution for validated creative builds", async () => {
    await expect(
      saveEpisodeUpdate(branchId, "episode-1", uid, {
        expectedEpisodeVersion: 1,
        actorType: "creative_engine",
        patch: { hook: "This untrusted request must not be attributed to AI." },
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("persists finite turns, applies BUILD, and supports safe undo", async () => {
    const first = await runCreativeTurn(
      branchId,
      uid,
      { mode: "SUGGEST", prompt: "Make Emma's evidence more personal." },
      undefined,
      provider,
    );
    expect(first.session.turnCount).toBe(1);
    expect(first.response.readiness.readyToBuild).toBe(true);

    const built = await runCreativeTurn(
      branchId,
      uid,
      { mode: "BUILD", prompt: "Build that direction now." },
      undefined,
      provider,
    );
    expect(built.session.turnCount).toBe(2);
    expect(built.state.episodes[0]?.hook).toContain("own apartment");
    expect(built.state.branch.lastAgentAction).not.toBeNull();

    const action = built.state.branch.lastAgentAction!;
    await undoLastAgentAction(
      branchId,
      uid,
      action.id,
      built.state.branch.version,
    );
    const restored = await adminDb()
      .collection("branchDrafts")
      .doc(branchId)
      .collection("episodes")
      .doc("episode-1")
      .get();
    expect(restored.data()?.hook).toContain("rain inside her coat");

    for (let turn = 2; turn < 12; turn += 1) {
      await runCreativeTurn(
        branchId,
        uid,
        { mode: "ASK", prompt: `Focused turn ${turn + 1}` },
        undefined,
        provider,
      );
    }
    await expect(
      runCreativeTurn(
        branchId,
        uid,
        { mode: "ASK", prompt: "One turn too many" },
        undefined,
        provider,
      ),
    ).rejects.toThrow(/12-turn safety cap/i);
  });
});
