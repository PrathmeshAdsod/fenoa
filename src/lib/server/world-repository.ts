import { createHash, randomUUID } from "node:crypto";

import type {
  CreateWorldInput,
  ReportContentInput,
  StartRemixInput,
  UpdateWorldInput,
} from "@/lib/contracts/api";
import {
  branchStateSchema,
  episodeSchema,
  type BranchState,
  type Episode,
} from "@/lib/contracts/domain";
import {
  branchRevisionSchema,
  likeSchema,
  publicProfileSchema,
  publishedBranchSchema,
  publishedWorldSchema,
  worldDraftSchema,
  worldRevisionSchema,
  type ImageAsset,
  type PublicProfile,
  type PublishedWorld,
  type WorldDraft,
} from "@/lib/contracts/world";
import { DomainError } from "@/lib/domain/errors";
import {
  createWorldDraft,
  publishBranchSnapshot,
  publishWorldSnapshot,
  updateWorldDraft,
} from "@/lib/domain/world-operations";
import { readBranchAndEpisodes } from "@/lib/server/branch-repository";
import { adminDb } from "@/lib/server/firebase-admin";
import { omitDocumentId } from "@/lib/server/firestore-document";

function documentData<T>(
  snapshot: FirebaseFirestore.DocumentSnapshot,
  parse: (value: unknown) => T,
): T {
  if (!snapshot.exists) {
    throw new DomainError("NOT_FOUND", "This content does not exist.");
  }
  return parse({ id: snapshot.id, ...snapshot.data() });
}

export async function saveProfileFromIdentity(identity: {
  uid: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<PublicProfile> {
  const db = adminDb();
  const ref = db.collection("users").doc(identity.uid);
  const now = new Date().toISOString();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.exists
      ? publicProfileSchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
    const profile = publicProfileSchema.parse({
      id: identity.uid,
      displayName:
        identity.displayName?.trim() ||
        previous?.displayName ||
        "Fenoa creator",
      avatarUrl: identity.avatarUrl || previous?.avatarUrl || null,
      bio: previous?.bio ?? "",
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    });
    transaction.set(ref, {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
    return profile;
  });
}

export async function updateProfile(
  uid: string,
  input: { displayName: string; bio: string },
): Promise<PublicProfile> {
  const ref = adminDb().collection("users").doc(uid);
  return adminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      throw new DomainError("NOT_FOUND", "Your profile is not ready yet.");
    }
    const profile = publicProfileSchema.parse({
      id: snapshot.id,
      ...snapshot.data(),
      ...input,
      updatedAt: new Date().toISOString(),
    });
    transaction.update(ref, {
      displayName: profile.displayName,
      bio: profile.bio,
      updatedAt: profile.updatedAt,
    });
    return profile;
  });
}

export async function createWorld(
  uid: string,
  input: CreateWorldInput,
): Promise<WorldDraft> {
  const ref = adminDb().collection("worldDrafts").doc();
  const draft = createWorldDraft(ref.id, uid, input);
  await ref.create(omitDocumentId(draft));
  return draft;
}

export async function getWorldDraft(
  worldId: string,
  uid: string,
): Promise<WorldDraft> {
  const snapshot = await adminDb().collection("worldDrafts").doc(worldId).get();
  const draft = documentData(snapshot, (value) =>
    worldDraftSchema.parse(value),
  );
  if (draft.creatorId !== uid) {
    throw new DomainError("FORBIDDEN", "You do not own this world.");
  }
  return draft;
}

export async function saveWorldDraft(
  worldId: string,
  uid: string,
  input: UpdateWorldInput,
): Promise<WorldDraft> {
  const db = adminDb();
  const ref = db.collection("worldDrafts").doc(worldId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const draft = documentData(snapshot, (value) =>
      worldDraftSchema.parse(value),
    );
    const updated = updateWorldDraft(draft, uid, input);
    transaction.set(ref, omitDocumentId(updated));
    return updated;
  });
}

export async function saveGeneratedCover(
  worldId: string,
  uid: string,
  expectedVersion: number,
  coverImage: ImageAsset,
): Promise<WorldDraft> {
  const db = adminDb();
  const ref = db.collection("worldDrafts").doc(worldId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const draft = documentData(snapshot, (value) =>
      worldDraftSchema.parse(value),
    );
    if (draft.creatorId !== uid) {
      throw new DomainError("FORBIDDEN", "You do not own this world.");
    }
    if (draft.version !== expectedVersion) {
      throw new DomainError(
        "STALE_VERSION",
        "The world changed while its artwork was being generated. Try again from the current canvas.",
        true,
      );
    }
    const updated = worldDraftSchema.parse({
      ...draft,
      coverImage,
      version: draft.version + 1,
      updatedAt: new Date().toISOString(),
    });
    transaction.set(ref, omitDocumentId(updated));
    return updated;
  });
}

export async function publishWorld(
  worldId: string,
  uid: string,
  expectedVersion: number,
): Promise<{ world: PublishedWorld; draft: WorldDraft }> {
  const db = adminDb();
  const draftRef = db.collection("worldDrafts").doc(worldId);
  const worldRef = db.collection("worlds").doc(worldId);
  const revisionRef = worldRef.collection("revisions").doc(randomUUID());
  return db.runTransaction(async (transaction) => {
    const [draftSnapshot, worldSnapshot] = await transaction.getAll(
      draftRef,
      worldRef,
    );
    const draft = documentData(draftSnapshot!, (value) =>
      worldDraftSchema.parse(value),
    );
    if (draft.creatorId !== uid) {
      throw new DomainError("FORBIDDEN", "You do not own this world.");
    }
    if (draft.version !== expectedVersion) {
      throw new DomainError(
        "STALE_VERSION",
        "This world changed before it could be published.",
        true,
      );
    }
    const existing = worldSnapshot!.exists
      ? publishedWorldSchema.parse({
          id: worldSnapshot!.id,
          ...worldSnapshot!.data(),
        })
      : null;
    const published = publishWorldSnapshot(
      draft,
      revisionRef.id,
      draft.version,
      existing,
    );
    transaction.set(revisionRef, omitDocumentId(published.revision));
    transaction.set(worldRef, omitDocumentId(published.world));
    transaction.set(draftRef, omitDocumentId(published.draft));
    return { world: published.world, draft: published.draft };
  });
}

async function profilesById(
  ids: string[],
): Promise<Map<string, PublicProfile>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const db = adminDb();
  const snapshots = await db.getAll(
    ...unique.map((id) => db.collection("users").doc(id)),
  );
  return new Map(
    snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => {
        const profile = publicProfileSchema.parse({
          id: snapshot.id,
          ...snapshot.data(),
        });
        return [profile.id, profile] as const;
      }),
  );
}

export async function listDiscovery() {
  const db = adminDb();
  const [worldsSnapshot, branchesSnapshot] = await Promise.all([
    db.collection("worlds").orderBy("publishedAt", "desc").limit(8).get(),
    db.collection("branches").orderBy("likeCount", "desc").limit(8).get(),
  ]);
  const worlds = worldsSnapshot.docs.map((snapshot) =>
    publishedWorldSchema.parse({ id: snapshot.id, ...snapshot.data() }),
  );
  const branches = branchesSnapshot.docs.map((snapshot) =>
    publishedBranchSchema.parse({ id: snapshot.id, ...snapshot.data() }),
  );
  const profiles = await profilesById([
    ...worlds.map((world) => world.creatorId),
    ...branches.map((branch) => branch.creatorId),
  ]);
  return { worlds, branches, profiles };
}

export async function getPublishedWorld(worldId: string) {
  const db = adminDb();
  const worldRef = db.collection("worlds").doc(worldId);
  const worldSnapshot = await worldRef.get();
  const world = documentData(worldSnapshot, (value) =>
    publishedWorldSchema.parse(value),
  );
  const [revisionSnapshot, branchesSnapshot, creatorSnapshot] =
    await Promise.all([
      worldRef.collection("revisions").doc(world.currentRevisionId).get(),
      db
        .collection("branches")
        .where("rootWorldId", "==", worldId)
        .orderBy("publishedAt", "desc")
        .limit(16)
        .get(),
      db.collection("users").doc(world.creatorId).get(),
    ]);
  const revision = documentData(revisionSnapshot, (value) =>
    worldRevisionSchema.parse(value),
  );
  const branches = branchesSnapshot.docs.map((snapshot) =>
    publishedBranchSchema.parse({ id: snapshot.id, ...snapshot.data() }),
  );
  const creator = creatorSnapshot.exists
    ? publicProfileSchema.parse({
        id: creatorSnapshot.id,
        ...creatorSnapshot.data(),
      })
    : null;
  return { world, revision, branches, creator };
}

function inheritedSummaryFromWorld(
  revision: ReturnType<typeof worldRevisionSchema.parse>,
) {
  const facts = revision.facts
    .slice(0, 4)
    .map((fact) => fact.statement)
    .join(" ");
  return `${revision.premise}${facts ? ` ${facts}` : ""}`.slice(0, 1_600);
}

function openingEpisode(
  branchId: string,
  intent: string,
  now: string,
): Episode {
  return episodeSchema.parse({
    id: `${branchId.slice(0, 105)}-opening`,
    branchId,
    position: 1,
    title: "Opening movement",
    hook: intent.slice(0, 300),
    keyBeats: [],
    narrative: "",
    effects: {
      participantIds: [],
      revealedFactIds: [],
      resolvedFactIds: [],
      relationshipChanges: [],
      ruleChanges: [],
    },
    version: 1,
    updatedAt: now,
  });
}

export async function startRemix(
  uid: string,
  input: StartRemixInput,
): Promise<BranchState> {
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc();
  const now = new Date().toISOString();
  return db.runTransaction(async (transaction) => {
    let state: BranchState;
    if (input.sourceType === "world") {
      const sourceRef = db.collection("worlds").doc(input.sourceId);
      const sourceSnapshot = await transaction.get(sourceRef);
      const source = documentData(sourceSnapshot, (value) =>
        publishedWorldSchema.parse(value),
      );
      if (!source.remixEnabled) {
        throw new DomainError("FORBIDDEN", "This creator has closed remixes.");
      }
      const revisionSnapshot = await transaction.get(
        sourceRef.collection("revisions").doc(source.currentRevisionId),
      );
      const revision = documentData(revisionSnapshot, (value) =>
        worldRevisionSchema.parse(value),
      );
      state = branchStateSchema.parse({
        branch: {
          id: branchRef.id,
          creatorId: uid,
          rootWorldId: source.id,
          baseWorldRevisionId: revision.id,
          title: input.title,
          creativeIntent: input.creativeIntent,
          inheritedSummary: inheritedSummaryFromWorld(revision),
          inheritedCharacters: revision.characters,
          inheritedRelationships: revision.relationships,
          inheritedFacts: revision.facts,
          inheritedConstraints: [],
          addedCharacters: [],
          ruleOverrides: [],
          constraints: [],
          recentActivity: [],
          lastAgentAction: null,
          version: 1,
          updatedAt: now,
        },
        episodes: [openingEpisode(branchRef.id, input.creativeIntent, now)],
      });
    } else {
      const sourceRef = db.collection("branches").doc(input.sourceId);
      const sourceSnapshot = await transaction.get(sourceRef);
      const source = documentData(sourceSnapshot, (value) =>
        publishedBranchSchema.parse(value),
      );
      const revisionSnapshot = await transaction.get(
        sourceRef.collection("revisions").doc(source.currentRevisionId),
      );
      const revision = documentData(revisionSnapshot, (value) =>
        branchRevisionSchema.parse(value),
      );
      const rootWorldSnapshot = await transaction.get(
        db.collection("worlds").doc(source.rootWorldId),
      );
      const rootWorld = documentData(rootWorldSnapshot, (value) =>
        publishedWorldSchema.parse(value),
      );
      if (!rootWorld.remixEnabled) {
        throw new DomainError("FORBIDDEN", "This creator has closed remixes.");
      }
      const sourceState = revision.state;
      state = branchStateSchema.parse({
        branch: {
          id: branchRef.id,
          creatorId: uid,
          rootWorldId: source.rootWorldId,
          baseWorldRevisionId: source.baseWorldRevisionId,
          parentBranchId: source.id,
          parentBranchRevisionId: revision.id,
          title: input.title,
          creativeIntent: input.creativeIntent,
          inheritedSummary:
            `${source.inheritedSummary} Parent direction: ${source.creativeIntent}`.slice(
              0,
              1_600,
            ),
          inheritedCharacters: [
            ...sourceState.branch.inheritedCharacters,
            ...sourceState.branch.addedCharacters,
          ],
          inheritedRelationships: sourceState.branch.inheritedRelationships,
          inheritedFacts: [
            ...sourceState.branch.inheritedFacts,
            ...sourceState.branch.ruleOverrides,
          ],
          inheritedConstraints: [
            ...sourceState.branch.inheritedConstraints,
            ...sourceState.branch.constraints,
          ],
          addedCharacters: [],
          ruleOverrides: [],
          constraints: [],
          recentActivity: [],
          lastAgentAction: null,
          version: 1,
          updatedAt: now,
        },
        episodes: sourceState.episodes.map((episode) => ({
          ...episode,
          id: `${branchRef.id.slice(0, 104)}-e${episode.position}`,
          branchId: branchRef.id,
          version: 1,
          updatedAt: now,
        })),
      });
    }
    transaction.create(branchRef, omitDocumentId(state.branch));
    for (const episode of state.episodes) {
      transaction.create(
        branchRef.collection("episodes").doc(episode.id),
        omitDocumentId(episode),
      );
    }
    return state;
  });
}

export async function publishBranch(
  branchId: string,
  uid: string,
  expectedBranchVersion: number,
) {
  const db = adminDb();
  const draftRef = db.collection("branchDrafts").doc(branchId);
  const publishedRef = db.collection("branches").doc(branchId);
  const revisionRef = publishedRef.collection("revisions").doc(randomUUID());
  return db.runTransaction(async (transaction) => {
    const state = await readBranchAndEpisodes(transaction, draftRef, uid);
    const publishedSnapshot = await transaction.get(publishedRef);
    const existing = publishedSnapshot.exists
      ? publishedBranchSchema.parse({
          id: publishedSnapshot.id,
          ...publishedSnapshot.data(),
        })
      : null;
    const worldRef = db.collection("worlds").doc(state.branch.rootWorldId);
    const worldSnapshot = await transaction.get(worldRef);
    const world = documentData(worldSnapshot, (value) =>
      publishedWorldSchema.parse(value),
    );
    if (state.branch.version !== expectedBranchVersion) {
      throw new DomainError(
        "STALE_VERSION",
        "This branch changed before it could be published.",
        true,
      );
    }
    const published = publishBranchSnapshot(
      state,
      revisionRef.id,
      state.branch.version,
      existing,
    );
    transaction.set(publishedRef, omitDocumentId(published.branch));
    transaction.set(revisionRef, omitDocumentId(published.revision));
    if (!existing) {
      transaction.update(worldRef, {
        remixCount: world.remixCount + 1,
        updatedAt: new Date().toISOString(),
      });
    }
    return published;
  });
}

export async function getPublishedBranch(branchId: string) {
  const db = adminDb();
  const branchRef = db.collection("branches").doc(branchId);
  const branchSnapshot = await branchRef.get();
  const branch = documentData(branchSnapshot, (value) =>
    publishedBranchSchema.parse(value),
  );
  const [revisionSnapshot, worldSnapshot, creatorSnapshot, parentSnapshot] =
    await Promise.all([
      branchRef.collection("revisions").doc(branch.currentRevisionId).get(),
      db.collection("worlds").doc(branch.rootWorldId).get(),
      db.collection("users").doc(branch.creatorId).get(),
      branch.parentBranchId
        ? db.collection("branches").doc(branch.parentBranchId).get()
        : Promise.resolve(null),
    ]);
  return {
    branch,
    revision: documentData(revisionSnapshot, (value) =>
      branchRevisionSchema.parse(value),
    ),
    world: documentData(worldSnapshot, (value) =>
      publishedWorldSchema.parse(value),
    ),
    creator: creatorSnapshot.exists
      ? publicProfileSchema.parse({
          id: creatorSnapshot.id,
          ...creatorSnapshot.data(),
        })
      : null,
    parent: parentSnapshot?.exists
      ? publishedBranchSchema.parse({
          id: parentSnapshot.id,
          ...parentSnapshot.data(),
        })
      : null,
  };
}

function likeId(branchId: string, uid: string): string {
  return createHash("sha256")
    .update(`${branchId}:${uid}`)
    .digest("hex")
    .slice(0, 48);
}

export async function setBranchLike(
  branchId: string,
  uid: string,
  liked: boolean,
): Promise<{ liked: boolean; likeCount: number }> {
  const db = adminDb();
  const branchRef = db.collection("branches").doc(branchId);
  const likeRef = db.collection("likes").doc(likeId(branchId, uid));
  return db.runTransaction(async (transaction) => {
    const [branchSnapshot, likeSnapshot] = await transaction.getAll(
      branchRef,
      likeRef,
    );
    const branch = documentData(branchSnapshot!, (value) =>
      publishedBranchSchema.parse(value),
    );
    if (liked && !likeSnapshot!.exists) {
      const like = likeSchema.parse({
        id: likeRef.id,
        branchId,
        userId: uid,
        createdAt: new Date().toISOString(),
      });
      transaction.create(likeRef, omitDocumentId(like));
      transaction.update(branchRef, { likeCount: branch.likeCount + 1 });
      return { liked: true, likeCount: branch.likeCount + 1 };
    }
    if (!liked && likeSnapshot!.exists) {
      transaction.delete(likeRef);
      const likeCount = Math.max(0, branch.likeCount - 1);
      transaction.update(branchRef, { likeCount });
      return { liked: false, likeCount };
    }
    return { liked: likeSnapshot!.exists, likeCount: branch.likeCount };
  });
}

export async function getBranchLike(branchId: string, uid: string) {
  const snapshot = await adminDb()
    .collection("likes")
    .doc(likeId(branchId, uid))
    .get();
  return { liked: snapshot.exists };
}

export async function setCreatorPick(
  worldId: string,
  uid: string,
  branchId: string | null,
): Promise<PublishedWorld> {
  const db = adminDb();
  const worldRef = db.collection("worlds").doc(worldId);
  return db.runTransaction(async (transaction) => {
    const worldSnapshot = await transaction.get(worldRef);
    const world = documentData(worldSnapshot, (value) =>
      publishedWorldSchema.parse(value),
    );
    if (world.creatorId !== uid) {
      throw new DomainError(
        "FORBIDDEN",
        "Only the original world creator can choose a Creator Pick.",
      );
    }
    if (branchId) {
      const branchSnapshot = await transaction.get(
        db.collection("branches").doc(branchId),
      );
      const branch = documentData(branchSnapshot, (value) =>
        publishedBranchSchema.parse(value),
      );
      if (branch.rootWorldId !== worldId) {
        throw new DomainError(
          "INVALID_ARGUMENT",
          "Creator Pick must belong to this world.",
        );
      }
    }
    const updated = publishedWorldSchema.parse({
      ...world,
      creatorPickBranchId: branchId,
      updatedAt: new Date().toISOString(),
    });
    transaction.update(worldRef, {
      creatorPickBranchId: branchId,
      updatedAt: updated.updatedAt,
    });
    return updated;
  });
}

export async function getPublicProfile(uid: string) {
  const db = adminDb();
  const profileSnapshot = await db.collection("users").doc(uid).get();
  const profile = documentData(profileSnapshot, (value) =>
    publicProfileSchema.parse(value),
  );
  const [worldsSnapshot, branchesSnapshot] = await Promise.all([
    db
      .collection("worlds")
      .where("creatorId", "==", uid)
      .orderBy("publishedAt", "desc")
      .limit(20)
      .get(),
    db
      .collection("branches")
      .where("creatorId", "==", uid)
      .orderBy("publishedAt", "desc")
      .limit(20)
      .get(),
  ]);
  return {
    profile,
    worlds: worldsSnapshot.docs.map((snapshot) =>
      publishedWorldSchema.parse({ id: snapshot.id, ...snapshot.data() }),
    ),
    branches: branchesSnapshot.docs.map((snapshot) =>
      publishedBranchSchema.parse({ id: snapshot.id, ...snapshot.data() }),
    ),
  };
}

export async function createReport(
  uid: string,
  input: ReportContentInput,
): Promise<{ id: string }> {
  const db = adminDb();
  const targetRef = db
    .collection(input.targetType === "world" ? "worlds" : "branches")
    .doc(input.targetId);
  const target = await targetRef.get();
  if (!target.exists) {
    throw new DomainError("NOT_FOUND", "The reported content does not exist.");
  }
  const ref = db.collection("reports").doc();
  await ref.create({
    reporterId: uid,
    ...input,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  return { id: ref.id };
}
