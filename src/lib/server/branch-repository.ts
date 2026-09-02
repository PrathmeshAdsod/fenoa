import { FieldValue } from "firebase-admin/firestore";

import {
  branchDraftSchema,
  branchStateSchema,
  episodeSchema,
  type BranchState,
  type Episode,
} from "@/lib/contracts/domain";
import type {
  SetConstraintInput,
  UpdateEpisodeInput,
} from "@/lib/contracts/api";
import { setConstraint, updateEpisode } from "@/lib/domain/branch-operations";
import { DomainError } from "@/lib/domain/errors";
import { adminDb } from "@/lib/server/firebase-admin";

function assertOwner(creatorId: string, uid: string): void {
  if (creatorId !== uid) {
    throw new DomainError("FORBIDDEN", "You do not own this branch.");
  }
}

export async function getBranchState(
  branchId: string,
  uid: string,
): Promise<BranchState> {
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const [branchSnapshot, episodeSnapshot] = await Promise.all([
    branchRef.get(),
    branchRef.collection("episodes").orderBy("position", "asc").limit(8).get(),
  ]);

  if (!branchSnapshot.exists) {
    throw new DomainError("NOT_FOUND", "This branch does not exist.");
  }

  const branch = branchDraftSchema.parse({
    id: branchSnapshot.id,
    ...branchSnapshot.data(),
  });
  assertOwner(branch.creatorId, uid);

  return branchStateSchema.parse({
    branch,
    episodes: episodeSnapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
  });
}

export async function getEpisode(
  branchId: string,
  episodeId: string,
  uid: string,
): Promise<Episode> {
  const state = await getBranchState(branchId, uid);
  const episode = state.episodes.find((item) => item.id === episodeId);
  if (!episode) {
    throw new DomainError("NOT_FOUND", "This episode does not exist.");
  }
  return episode;
}

export async function saveEpisodeUpdate(
  branchId: string,
  episodeId: string,
  uid: string,
  input: UpdateEpisodeInput,
): Promise<Episode> {
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const episodeRef = branchRef.collection("episodes").doc(episodeId);
  const activityRef = branchRef.collection("activities").doc();

  return db.runTransaction(async (transaction) => {
    const [branchSnapshot, episodeSnapshot] = await Promise.all([
      transaction.get(branchRef),
      transaction.get(episodeRef),
    ]);
    if (!branchSnapshot.exists || !episodeSnapshot.exists) {
      throw new DomainError(
        "NOT_FOUND",
        "The branch or episode does not exist.",
      );
    }

    const branch = branchDraftSchema.parse({
      id: branchSnapshot.id,
      ...branchSnapshot.data(),
    });
    assertOwner(branch.creatorId, uid);
    const episode = episodeSchema.parse({
      id: episodeSnapshot.id,
      ...episodeSnapshot.data(),
    });
    const updated = updateEpisode(branch, episode, input);
    const activity = {
      id: activityRef.id,
      actorType: input.actorType,
      summary: `Updated ${updated.title}`,
      createdAt: updated.updatedAt,
    } as const;

    transaction.set(episodeRef, updated);
    transaction.set(activityRef, {
      ...activity,
      before: episode,
      after: updated,
      operation: "update_episode",
      createdAtServer: FieldValue.serverTimestamp(),
    });
    transaction.update(branchRef, {
      recentActivity: [activity, ...branch.recentActivity].slice(0, 5),
      updatedAt: updated.updatedAt,
    });
    return updated;
  });
}

export async function saveConstraintChange(
  branchId: string,
  uid: string,
  input: SetConstraintInput,
) {
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const activityRef = branchRef.collection("activities").doc();

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(branchRef);
    if (!snapshot.exists) {
      throw new DomainError("NOT_FOUND", "This branch does not exist.");
    }
    const branch = branchDraftSchema.parse({
      id: snapshot.id,
      ...snapshot.data(),
    });
    assertOwner(branch.creatorId, uid);
    const updated = setConstraint(branch, input);
    const label =
      input.action === "remove"
        ? "Removed a story lock"
        : input.constraint.label;
    const activity = {
      id: activityRef.id,
      actorType: input.actorType,
      summary: label,
      createdAt: updated.updatedAt,
    } as const;

    transaction.update(branchRef, {
      constraints: updated.constraints,
      version: updated.version,
      updatedAt: updated.updatedAt,
      recentActivity: [activity, ...branch.recentActivity].slice(0, 5),
    });
    transaction.set(activityRef, {
      ...activity,
      before: branch.constraints,
      after: updated.constraints,
      operation: "set_story_constraint",
      createdAtServer: FieldValue.serverTimestamp(),
    });
    return updated;
  });
}
