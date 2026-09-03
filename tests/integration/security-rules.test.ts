import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { doc, getDoc, setDoc } from "firebase/firestore";

const emulatorAddress = process.env.FIRESTORE_EMULATOR_HOST;
const describeWithEmulator = emulatorAddress ? describe : describe.skip;

function parseEmulatorAddress(address: string): { host: string; port: number } {
  const separator = address.lastIndexOf(":");
  return {
    host: address.slice(0, separator),
    port: Number(address.slice(separator + 1)),
  };
}

describeWithEmulator("Firestore security rules", () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    const { host, port } = parseEmulatorAddress(emulatorAddress!);
    environment = await initializeTestEnvironment({
      projectId: `${process.env.FIREBASE_PROJECT_ID || "demo-fenoa"}-rules`,
      firestore: {
        host,
        port,
        rules: await readFile(
          new URL("../../firebase/firestore.rules", import.meta.url),
          "utf8",
        ),
      },
    });
  });

  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, "users", "owner"), { displayName: "Owner" }),
        setDoc(doc(db, "worldDrafts", "private-world"), {
          creatorId: "owner",
        }),
        setDoc(doc(db, "worlds", "published-world"), {
          creatorId: "owner",
          visibility: "published",
        }),
        setDoc(doc(db, "worlds", "private-world"), {
          creatorId: "owner",
          visibility: "private",
        }),
        setDoc(doc(db, "worlds", "published-world", "revisions", "v1"), {
          name: "Published",
        }),
        setDoc(doc(db, "worlds", "private-world", "revisions", "v1"), {
          name: "Private",
        }),
        setDoc(doc(db, "branchDrafts", "private-branch"), {
          creatorId: "owner",
        }),
        setDoc(
          doc(db, "branchDrafts", "private-branch", "episodes", "episode-1"),
          { title: "Private episode" },
        ),
        setDoc(doc(db, "creativeSessions", "private-branch"), {
          creatorId: "owner",
        }),
      ]);
    });
  });

  afterAll(async () => {
    await environment.cleanup();
  });

  it("keeps draft artifacts and creative sessions owner-only", async () => {
    const owner = environment.authenticatedContext("owner").firestore();
    const stranger = environment.authenticatedContext("stranger").firestore();
    const anonymous = environment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(owner, "worldDrafts", "private-world")));
    await assertSucceeds(getDoc(doc(owner, "branchDrafts", "private-branch")));
    await assertSucceeds(
      getDoc(
        doc(owner, "branchDrafts", "private-branch", "episodes", "episode-1"),
      ),
    );
    await assertSucceeds(
      getDoc(doc(owner, "creativeSessions", "private-branch")),
    );

    await assertFails(getDoc(doc(stranger, "worldDrafts", "private-world")));
    await assertFails(getDoc(doc(stranger, "branchDrafts", "private-branch")));
    await assertFails(
      getDoc(
        doc(
          stranger,
          "branchDrafts",
          "private-branch",
          "episodes",
          "episode-1",
        ),
      ),
    );
    await assertFails(
      getDoc(doc(anonymous, "creativeSessions", "private-branch")),
    );
  });

  it("exposes only published projections and their immutable revisions", async () => {
    const anonymous = environment.unauthenticatedContext().firestore();

    const profile = await assertSucceeds(
      getDoc(doc(anonymous, "users", "owner")),
    );
    const published = await assertSucceeds(
      getDoc(doc(anonymous, "worlds", "published-world")),
    );
    await assertSucceeds(
      getDoc(doc(anonymous, "worlds", "published-world", "revisions", "v1")),
    );
    await assertFails(getDoc(doc(anonymous, "worlds", "private-world")));
    await assertFails(
      getDoc(doc(anonymous, "worlds", "private-world", "revisions", "v1")),
    );

    expect(profile.data()?.displayName).toBe("Owner");
    expect(published.data()?.visibility).toBe("published");
  });

  it("denies every direct client mutation", async () => {
    const owner = environment.authenticatedContext("owner").firestore();

    await assertFails(
      setDoc(doc(owner, "worldDrafts", "private-world"), {
        creatorId: "owner",
        name: "Bypassed server",
      }),
    );
    await assertFails(
      setDoc(doc(owner, "users", "owner"), { displayName: "Bypassed" }),
    );
    await assertFails(
      setDoc(doc(owner, "likes", "owner_branch"), {
        userId: "owner",
        branchId: "private-branch",
      }),
    );
  });
});
