import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { z } from "zod";

import {
  branchActivitySchema,
  branchDraftSchema,
  branchStateSchema,
  characterSchema,
  episodeSchema,
  episodeContextSchema,
  factSchema,
  storyConstraintSchema,
  type BranchActivity,
  type BranchDraft,
  type BranchState,
  type Episode,
  type EpisodeContext,
} from "@/lib/contracts/domain";
import type {
  AddBranchCharacterInput,
  AddEpisodeInput,
  DeleteEpisodeInput,
  MoveEpisodeInput,
  SetConstraintInput,
  UpdateBranchRuleInput,
  UpdateEpisodeInput,
} from "@/lib/contracts/api";
import {
  addBranchCharacter,
  addEpisode,
  deleteEpisode,
  moveEpisode,
  setConstraint,
  updateBranchRule,
  updateEpisode,
} from "@/lib/domain/branch-operations";
import { assertEpisodeConstraints } from "@/lib/domain/constraints";
import { DomainError } from "@/lib/domain/errors";
import { adminDb } from "@/lib/server/firebase-admin";

const branchUndoFieldsSchema = z.object({
  addedCharacters: z.array(characterSchema),
  ruleOverrides: z.array(factSchema),
  constraints: z.array(storyConstraintSchema),
});

export const undoSnapshotSchema = z.object({
  branchBefore: branchUndoFieldsSchema,
  branchAfterVersion: z.number().int().positive(),
  episodesBefore: z.array(episodeSchema).max(8),
  episodeAfterVersions: z
    .array(z.object({ id: z.string(), version: z.number().int().positive() }))
    .max(8),
});

type MutationActor = UpdateEpisodeInput["actorType"];

function assertExternalMutationActor(actorType: MutationActor): void {
  if (actorType === "creative_engine") {
    throw new DomainError(
      "INVALID_ARGUMENT",
      "Creative-engine attribution is reserved for validated creative builds.",
    );
  }
}

export function assertBranchOwner(creatorId: string, uid: string): void {
  if (creatorId !== uid) {
    throw new DomainError("FORBIDDEN", "You do not own this branch.");
  }
}

function undoBranchFields(branch: BranchDraft) {
  return {
    addedCharacters: branch.addedCharacters,
    ruleOverrides: branch.ruleOverrides,
    constraints: branch.constraints,
  };
}

export function makeBranchActivity(
  id: string,
  actorType: MutationActor,
  summary: string,
  targetIds: string[],
  createdAt: string,
): BranchActivity {
  return branchActivitySchema.parse({
    id,
    actorType,
    summary,
    targetIds,
    createdAt,
  });
}

export function lastAgentAction(activity: BranchActivity) {
  return activity.actorType === "human"
    ? null
    : {
        id: activity.id,
        summary: activity.summary,
        createdAt: activity.createdAt,
      };
}

export function makeActivityDocument(
  activity: BranchActivity,
  operation: string,
  branchBefore: BranchDraft,
  branchAfter: BranchDraft,
  episodesBefore: Episode[],
  episodesAfter: Episode[],
) {
  return {
    ...activity,
    operation,
    createdAtServer: FieldValue.serverTimestamp(),
    ...(activity.actorType === "human"
      ? {}
      : {
          undo: {
            branchBefore: undoBranchFields(branchBefore),
            branchAfterVersion: branchAfter.version,
            episodesBefore,
            episodeAfterVersions: episodesAfter.map((episode) => ({
              id: episode.id,
              version: episode.version,
            })),
          },
        }),
  };
}

export async function readBranchAndEpisodes(
  transaction: FirebaseFirestore.Transaction,
  branchRef: DocumentReference,
  uid: string,
): Promise<BranchState> {
  const branchSnapshot = await transaction.get(branchRef);
  if (!branchSnapshot.exists) {
    throw new DomainError("NOT_FOUND", "This branch does not exist.");
  }
  const branch = branchDraftSchema.parse({
    id: branchSnapshot.id,
    ...branchSnapshot.data(),
  });
  assertBranchOwner(branch.creatorId, uid);
  const episodeSnapshot = await transaction.get(
    branchRef.collection("episodes").orderBy("position", "asc").limit(8),
  );
  return branchStateSchema.parse({
    branch,
    episodes: episodeSnapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
  });
}

function writeActivityToBranch(
  transaction: FirebaseFirestore.Transaction,
  branchRef: DocumentReference,
  branch: BranchDraft,
  activity: BranchActivity,
): void {
  transaction.update(branchRef, {
    recentActivity: [activity, ...branch.recentActivity].slice(0, 5),
    lastAgentAction: lastAgentAction(activity),
  });
}

export async function getBranchState(
  branchId: string,
  uid: string,
): Promise<BranchState> {
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  return db.runTransaction((transaction) =>
    readBranchAndEpisodes(transaction, branchRef, uid),
  );
}

export async function getEpisode(
  branchId: string,
  episodeId: string,
  uid: string,
): Promise<EpisodeContext> {
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const episodeRef = branchRef.collection("episodes").doc(episodeId);
  return db.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(branchRef, episodeRef);
    const branchSnapshot = snapshots[0];
    const episodeSnapshot = snapshots[1];
    if (!branchSnapshot?.exists || !episodeSnapshot?.exists) {
      throw new DomainError(
        "NOT_FOUND",
        "The branch or episode does not exist.",
      );
    }
    const branch = branchDraftSchema.parse({
      id: branchSnapshot.id,
      ...branchSnapshot.data(),
    });
    assertBranchOwner(branch.creatorId, uid);
    const episode = episodeSchema.parse({
      id: episodeSnapshot.id,
      ...episodeSnapshot.data(),
    });
    return episodeContextSchema.parse({
      episode,
      branchVersion: branch.version,
      relevantConstraints: branch.constraints,
    });
  });
}

export async function saveEpisodeUpdate(
  branchId: string,
  episodeId: string,
  uid: string,
  input: UpdateEpisodeInput,
): Promise<Episode> {
  assertExternalMutationActor(input.actorType);
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const episodeRef = branchRef.collection("episodes").doc(episodeId);
  const activityRef = branchRef.collection("activities").doc();

  return db.runTransaction(async (transaction) => {
    const [branchSnapshot, episodeSnapshot] = await transaction.getAll(
      branchRef,
      episodeRef,
    );
    if (!branchSnapshot?.exists || !episodeSnapshot?.exists) {
      throw new DomainError(
        "NOT_FOUND",
        "The branch or episode does not exist.",
      );
    }
    const branch = branchDraftSchema.parse({
      id: branchSnapshot.id,
      ...branchSnapshot.data(),
    });
    assertBranchOwner(branch.creatorId, uid);
    const episode = episodeSchema.parse({
      id: episodeSnapshot.id,
      ...episodeSnapshot.data(),
    });
    const updated = updateEpisode(branch, episode, input);
    const activity = makeBranchActivity(
      activityRef.id,
      input.actorType,
      `Updated ${updated.title}`,
      [updated.id],
      updated.updatedAt,
    );

    transaction.set(episodeRef, updated);
    transaction.set(
      activityRef,
      makeActivityDocument(
        activity,
        "update_episode",
        branch,
        branch,
        [episode],
        [updated],
      ),
    );
    transaction.update(branchRef, { updatedAt: updated.updatedAt });
    writeActivityToBranch(transaction, branchRef, branch, activity);
    return updated;
  });
}

export async function saveConstraintChange(
  branchId: string,
  uid: string,
  input: SetConstraintInput,
): Promise<BranchDraft> {
  assertExternalMutationActor(input.actorType);
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const activityRef = branchRef.collection("activities").doc();

  return db.runTransaction(async (transaction) => {
    const state = await readBranchAndEpisodes(transaction, branchRef, uid);
    const branch = state.branch;
    const updated = setConstraint(branch, input);
    for (const episode of state.episodes) {
      assertEpisodeConstraints(updated, episode);
    }
    const summary =
      input.action === "remove"
        ? "Removed a story lock"
        : input.constraint.label;
    const targetId =
      input.action === "remove" ? input.constraintId : input.constraint.id;
    const activity = makeBranchActivity(
      activityRef.id,
      input.actorType,
      summary,
      [targetId],
      updated.updatedAt,
    );

    transaction.update(branchRef, {
      constraints: updated.constraints,
      version: updated.version,
      updatedAt: updated.updatedAt,
    });
    writeActivityToBranch(transaction, branchRef, branch, activity);
    transaction.set(
      activityRef,
      makeActivityDocument(
        activity,
        "set_story_constraint",
        branch,
        updated,
        [],
        [],
      ),
    );
    return branchDraftSchema.parse({
      ...updated,
      recentActivity: [activity, ...branch.recentActivity].slice(0, 5),
      lastAgentAction: lastAgentAction(activity),
    });
  });
}

export async function saveEpisodeMove(
  branchId: string,
  uid: string,
  input: MoveEpisodeInput,
): Promise<BranchState> {
  assertExternalMutationActor(input.actorType);
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const activityRef = branchRef.collection("activities").doc();
  return db.runTransaction(async (transaction) => {
    const state = await readBranchAndEpisodes(transaction, branchRef, uid);
    const updated = moveEpisode(state.branch, state.episodes, input);
    const moved = updated.episodes.find((item) => item.id === input.episodeId);
    const activity = makeBranchActivity(
      activityRef.id,
      input.actorType,
      `Moved ${moved?.title ?? "an episode"} to position ${input.toPosition}`,
      [input.episodeId],
      updated.branch.updatedAt,
    );

    for (const episode of updated.episodes) {
      const previous = state.episodes.find((item) => item.id === episode.id);
      if (previous?.version !== episode.version) {
        transaction.set(
          branchRef.collection("episodes").doc(episode.id),
          episode,
        );
      }
    }
    transaction.update(branchRef, {
      version: updated.branch.version,
      updatedAt: updated.branch.updatedAt,
    });
    writeActivityToBranch(transaction, branchRef, state.branch, activity);
    transaction.set(
      activityRef,
      makeActivityDocument(
        activity,
        "move_episode",
        state.branch,
        updated.branch,
        state.episodes,
        updated.episodes,
      ),
    );
    return branchStateSchema.parse({
      branch: {
        ...updated.branch,
        recentActivity: [activity, ...state.branch.recentActivity].slice(0, 5),
        lastAgentAction: lastAgentAction(activity),
      },
      episodes: updated.episodes,
    });
  });
}

export async function saveBranchCharacter(
  branchId: string,
  uid: string,
  input: AddBranchCharacterInput,
): Promise<BranchDraft> {
  return saveBranchOnlyMutation(
    branchId,
    uid,
    input.actorType,
    `Added ${input.character.name} to this branch`,
    [input.character.id],
    "add_branch_character",
    (branch) => addBranchCharacter(branch, input),
  );
}

export async function saveBranchRule(
  branchId: string,
  uid: string,
  input: UpdateBranchRuleInput,
): Promise<BranchDraft> {
  const targetId = input.action === "remove" ? input.factId : input.fact.id;
  const summary =
    input.action === "remove"
      ? "Removed a branch rule"
      : `Changed branch truth: ${input.fact.statement}`;
  return saveBranchOnlyMutation(
    branchId,
    uid,
    input.actorType,
    summary,
    [targetId],
    "update_branch_rule",
    (branch) => updateBranchRule(branch, input),
  );
}

async function saveBranchOnlyMutation(
  branchId: string,
  uid: string,
  actorType: MutationActor,
  summary: string,
  targetIds: string[],
  operation: string,
  mutate: (branch: BranchDraft) => BranchDraft,
): Promise<BranchDraft> {
  assertExternalMutationActor(actorType);
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
    assertBranchOwner(branch.creatorId, uid);
    const updated = mutate(branch);
    const activity = makeBranchActivity(
      activityRef.id,
      actorType,
      summary,
      targetIds,
      updated.updatedAt,
    );
    transaction.update(branchRef, {
      addedCharacters: updated.addedCharacters,
      ruleOverrides: updated.ruleOverrides,
      constraints: updated.constraints,
      version: updated.version,
      updatedAt: updated.updatedAt,
    });
    writeActivityToBranch(transaction, branchRef, branch, activity);
    transaction.set(
      activityRef,
      makeActivityDocument(activity, operation, branch, updated, [], []),
    );
    return branchDraftSchema.parse({
      ...updated,
      recentActivity: [activity, ...branch.recentActivity].slice(0, 5),
      lastAgentAction: lastAgentAction(activity),
    });
  });
}

export async function saveEpisodeAddition(
  branchId: string,
  uid: string,
  input: AddEpisodeInput,
): Promise<BranchState> {
  assertExternalMutationActor(input.actorType);
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const episodeRef = branchRef.collection("episodes").doc();
  const activityRef = branchRef.collection("activities").doc();
  return db.runTransaction(async (transaction) => {
    const state = await readBranchAndEpisodes(transaction, branchRef, uid);
    const updated = addEpisode(
      state.branch,
      state.episodes,
      episodeRef.id,
      input,
    );
    const activity = makeBranchActivity(
      activityRef.id,
      input.actorType,
      `Added ${updated.episode.title}`,
      [updated.episode.id],
      updated.branch.updatedAt,
    );
    for (const episode of updated.episodes) {
      transaction.set(
        branchRef.collection("episodes").doc(episode.id),
        episode,
      );
    }
    transaction.update(branchRef, {
      version: updated.branch.version,
      updatedAt: updated.branch.updatedAt,
    });
    writeActivityToBranch(transaction, branchRef, state.branch, activity);
    transaction.set(activityRef, {
      ...activity,
      operation: "add_episode",
      createdAtServer: FieldValue.serverTimestamp(),
    });
    return branchStateSchema.parse({
      branch: {
        ...updated.branch,
        recentActivity: [activity, ...state.branch.recentActivity].slice(0, 5),
        lastAgentAction: null,
      },
      episodes: updated.episodes,
    });
  });
}

export async function saveEpisodeDeletion(
  branchId: string,
  uid: string,
  input: DeleteEpisodeInput,
): Promise<BranchState> {
  assertExternalMutationActor(input.actorType);
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const activityRef = branchRef.collection("activities").doc();
  return db.runTransaction(async (transaction) => {
    const state = await readBranchAndEpisodes(transaction, branchRef, uid);
    const updated = deleteEpisode(state.branch, state.episodes, input);
    const activity = makeBranchActivity(
      activityRef.id,
      input.actorType,
      `Deleted ${updated.deleted.title}`,
      [updated.deleted.id],
      updated.branch.updatedAt,
    );
    transaction.delete(
      branchRef.collection("episodes").doc(updated.deleted.id),
    );
    for (const episode of updated.episodes) {
      transaction.set(
        branchRef.collection("episodes").doc(episode.id),
        episode,
      );
    }
    transaction.update(branchRef, {
      version: updated.branch.version,
      updatedAt: updated.branch.updatedAt,
    });
    writeActivityToBranch(transaction, branchRef, state.branch, activity);
    transaction.set(activityRef, {
      ...activity,
      operation: "delete_episode",
      createdAtServer: FieldValue.serverTimestamp(),
    });
    return branchStateSchema.parse({
      branch: {
        ...updated.branch,
        recentActivity: [activity, ...state.branch.recentActivity].slice(0, 5),
        lastAgentAction: null,
      },
      episodes: updated.episodes,
    });
  });
}

export async function undoLastAgentAction(
  branchId: string,
  uid: string,
  activityId: string,
  expectedBranchVersion: number,
): Promise<BranchDraft> {
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const activityRef = branchRef.collection("activities").doc(activityId);
  const undoActivityRef = branchRef.collection("activities").doc();
  return db.runTransaction(async (transaction) => {
    const [branchSnapshot, activitySnapshot] = await transaction.getAll(
      branchRef,
      activityRef,
    );
    if (!branchSnapshot?.exists || !activitySnapshot?.exists) {
      throw new DomainError("NOT_FOUND", "The agent action no longer exists.");
    }
    const branch = branchDraftSchema.parse({
      id: branchSnapshot.id,
      ...branchSnapshot.data(),
    });
    assertBranchOwner(branch.creatorId, uid);
    if (
      branch.lastAgentAction?.id !== activityId ||
      branch.version !== expectedBranchVersion
    ) {
      throw new DomainError(
        "STALE_VERSION",
        "The branch changed after that agent action and can no longer be safely undone.",
      );
    }
    const undo = undoSnapshotSchema.parse(activitySnapshot.data()?.undo);
    if (branch.version !== undo.branchAfterVersion) {
      throw new DomainError(
        "STALE_VERSION",
        "The branch changed after that agent action and can no longer be safely undone.",
      );
    }
    const episodeRefs = undo.episodeAfterVersions.map((item) =>
      branchRef.collection("episodes").doc(item.id),
    );
    const episodeSnapshots = episodeRefs.length
      ? await transaction.getAll(...episodeRefs)
      : [];
    for (const expected of undo.episodeAfterVersions) {
      const snapshot = episodeSnapshots.find((item) => item.id === expected.id);
      const current = snapshot?.exists
        ? episodeSchema.parse({ id: snapshot.id, ...snapshot.data() })
        : null;
      if (!current || current.version !== expected.version) {
        throw new DomainError(
          "STALE_VERSION",
          "An affected episode changed after the agent action and cannot be safely undone.",
        );
      }
    }
    const now = new Date().toISOString();
    for (const previous of undo.episodesBefore) {
      const currentSnapshot = episodeSnapshots.find(
        (item) => item.id === previous.id,
      );
      const current = episodeSchema.parse({
        id: currentSnapshot?.id,
        ...currentSnapshot?.data(),
      });
      transaction.set(branchRef.collection("episodes").doc(previous.id), {
        ...previous,
        version: current.version + 1,
        updatedAt: now,
      });
    }
    const activity = makeBranchActivity(
      undoActivityRef.id,
      "human",
      `Undid: ${branch.lastAgentAction.summary}`,
      undo.episodeAfterVersions.map((item) => item.id),
      now,
    );
    const updated = branchDraftSchema.parse({
      ...branch,
      ...undo.branchBefore,
      version: branch.version + 1,
      updatedAt: now,
      recentActivity: [activity, ...branch.recentActivity].slice(0, 5),
      lastAgentAction: null,
    });
    transaction.update(branchRef, {
      ...undo.branchBefore,
      version: updated.version,
      updatedAt: now,
      recentActivity: updated.recentActivity,
      lastAgentAction: null,
    });
    transaction.set(undoActivityRef, {
      ...activity,
      operation: "undo_agent_action",
      undoOfActivityId: activityId,
      createdAtServer: FieldValue.serverTimestamp(),
    });
    return updated;
  });
}
