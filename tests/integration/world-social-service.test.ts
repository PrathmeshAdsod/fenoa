import { describe, expect, it } from "vitest";

import type { WorldCreativeProvider } from "@/lib/server/world-creative-provider";
import { runWorldCreativeTurn } from "@/lib/server/world-creative-service";
import {
  createWorld,
  getPublishedBranch,
  getPublishedWorld,
  publishBranch,
  publishWorld,
  saveWorldDraft,
  setBranchLike,
  setCreatorPick,
  startRemix,
} from "@/lib/server/world-repository";

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeWithEmulator = emulatorAvailable ? describe : describe.skip;
const uid = process.env.FENOA_SEED_CREATOR_UID || "playwright-user";

const creatorProvider: WorldCreativeProvider = {
  async generate(input) {
    if (input.mode === "BUILD") {
      return {
        mode: "BUILD",
        message: "Turn the archive into a place that edits its visitors.",
        readiness: {
          readyToBuild: true,
          rationale: "The central cost is concrete enough to build.",
        },
        ideas: [],
        patch: {
          name: null,
          premise: null,
          genre: null,
          tone: null,
          aesthetic: null,
          locations: ["The living archive"],
          characters: null,
          relationships: null,
          facts: null,
          storySpark:
            "Mara enters the archive to erase one grief and discovers it has already written her answer.",
        },
      };
    }
    return {
      mode: input.mode,
      message: "What must a visitor surrender before the archive answers?",
      readiness: {
        readyToBuild: true,
        rationale:
          "One strong cost would complete the world's dramatic engine.",
      },
      ideas: [
        {
          title: "A memory as payment",
          detail: "Every answer permanently removes one personal memory.",
        },
      ],
      patch: null,
    };
  },
};

describeWithEmulator("world and social domain with Firestore emulator", () => {
  it("creates, collaborates, publishes, remixes, likes, and preserves lineage", async () => {
    let draft = await createWorld(uid, {
      name: "The Living Archive",
      premise:
        "A hidden archive answers any question by rewriting one memory of the person who asks.",
      genre: "Speculative mystery",
      tone: "Intimate wonder with an accumulating cost",
    });

    const explored = await runWorldCreativeTurn(
      draft.id,
      uid,
      { mode: "CHALLENGE", prompt: "Challenge the archive's cost." },
      undefined,
      creatorProvider,
    );
    expect(explored.session.turnCount).toBe(1);
    expect(explored.response.readiness.readyToBuild).toBe(true);
    const built = await runWorldCreativeTurn(
      draft.id,
      uid,
      { mode: "BUILD", prompt: "Build that cost into the canvas." },
      undefined,
      creatorProvider,
    );
    expect(built.draft.locations).toEqual(["The living archive"]);
    draft = built.draft;

    const mara = {
      id: "mara",
      name: "Mara Venn",
      role: "An archivist trying to recover her brother",
      appearance: "",
      personality: "Precise and quietly reckless",
      desire: "Ask the archive where her brother went",
      fear: "Forgetting why she came",
      background: "",
      currentSituation: "At the sealed entrance",
      secret: "",
    };
    const eli = {
      id: "eli",
      name: "Eli Venn",
      role: "The brother recorded in a book that should not exist",
      appearance: "",
      personality: "Patient and evasive",
      desire: "Keep Mara from asking the final question",
      fear: "",
      background: "",
      currentSituation: "Present only in the archive's marginalia",
      secret: "",
    };
    draft = await saveWorldDraft(draft.id, uid, {
      expectedVersion: draft.version,
      patch: {
        characters: [mara, eli],
        relationships: [
          {
            id: "mara-eli-family",
            fromCharacterId: mara.id,
            toCharacterId: eli.id,
            kind: "family",
            description:
              "Mara remembers a brother the archive insists never existed.",
          },
        ],
        facts: [
          {
            id: "memory-price",
            category: "world_rule",
            statement: "Every answer permanently removes one personal memory.",
            state: "true",
          },
        ],
      },
    });
    const published = await publishWorld(draft.id, uid, draft.version);
    draft = published.draft;
    const publicWorld = await getPublishedWorld(draft.id);
    expect(publicWorld.revision.characters).toHaveLength(2);
    expect(publicWorld.world.currentRevisionId).toBe(
      published.world.currentRevisionId,
    );

    const remix = await startRemix(uid, {
      sourceType: "world",
      sourceId: draft.id,
      title: "The Question Mara Keeps",
      creativeIntent: "Follow the one memory Mara refuses to trade.",
    });
    expect(remix.branch.inheritedCharacters).toHaveLength(2);
    const branchPublished = await publishBranch(
      remix.branch.id,
      uid,
      remix.branch.version,
    );
    const firstLike = await setBranchLike(remix.branch.id, uid, true);
    const duplicateLike = await setBranchLike(remix.branch.id, uid, true);
    expect(firstLike.likeCount).toBe(1);
    expect(duplicateLike.likeCount).toBe(1);

    const child = await startRemix(uid, {
      sourceType: "branch",
      sourceId: remix.branch.id,
      title: "The Answer Eli Burns",
      creativeIntent: "Remix the published branch from Eli's point of view.",
    });
    expect(child.branch.parentBranchId).toBe(remix.branch.id);
    expect(child.branch.parentBranchRevisionId).toBe(
      branchPublished.revision.id,
    );
    const publicBranch = await getPublishedBranch(remix.branch.id);
    expect(publicBranch.revision.state.branch.recentActivity).toEqual([]);

    const picked = await setCreatorPick(draft.id, uid, remix.branch.id);
    expect(picked.creatorPickBranchId).toBe(remix.branch.id);

    draft = await saveWorldDraft(draft.id, uid, {
      expectedVersion: draft.version,
      patch: { remixEnabled: false },
    });
    await publishWorld(draft.id, uid, draft.version);
    await expect(
      publishBranch(remix.branch.id, uid, remix.branch.version),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      startRemix(uid, {
        sourceType: "branch",
        sourceId: remix.branch.id,
        title: "A Closed Descendant",
        creativeIntent: "This request must respect the root creator's choice.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
