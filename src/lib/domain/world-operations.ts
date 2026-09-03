import type { CreateWorldInput, UpdateWorldInput } from "@/lib/contracts/api";
import type { BranchState } from "@/lib/contracts/domain";
import {
  branchRevisionSchema,
  publishedBranchSchema,
  publishedWorldSchema,
  worldDraftSchema,
  worldRevisionSchema,
  type BranchRevision,
  type PublishedBranch,
  type PublishedWorld,
  type WorldDraft,
  type WorldRevision,
} from "@/lib/contracts/world";
import { DomainError } from "@/lib/domain/errors";

export function assertWorldOwner(draft: WorldDraft, uid: string): void {
  if (draft.creatorId !== uid) {
    throw new DomainError("FORBIDDEN", "You do not own this world.");
  }
}

export function createWorldDraft(
  id: string,
  creatorId: string,
  input: CreateWorldInput,
  now = new Date(),
): WorldDraft {
  const timestamp = now.toISOString();
  return worldDraftSchema.parse({
    id,
    creatorId,
    ...input,
    aesthetic: "",
    locations: [],
    characters: [],
    relationships: [],
    facts: [],
    storySpark: "",
    coverImage: null,
    latestRevisionId: null,
    remixEnabled: true,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function updateWorldDraft(
  draft: WorldDraft,
  uid: string,
  input: UpdateWorldInput,
  now = new Date(),
): WorldDraft {
  assertWorldOwner(draft, uid);
  if (draft.version !== input.expectedVersion) {
    throw new DomainError(
      "STALE_VERSION",
      "This world changed after it was opened. Review the latest canvas and try again.",
      true,
    );
  }
  return worldDraftSchema.parse({
    ...draft,
    ...input.patch,
    version: draft.version + 1,
    updatedAt: now.toISOString(),
  });
}

export function publishWorldSnapshot(
  draft: WorldDraft,
  revisionId: string,
  revisionNumber: number,
  existing: PublishedWorld | null,
  now = new Date(),
): { world: PublishedWorld; revision: WorldRevision; draft: WorldDraft } {
  if (draft.characters.length < 2) {
    throw new DomainError(
      "INVALID_ARGUMENT",
      "Add at least two meaningful characters before publishing.",
    );
  }
  if (draft.relationships.length < 1) {
    throw new DomainError(
      "INVALID_ARGUMENT",
      "Add at least one relationship before publishing.",
    );
  }
  if (draft.facts.length < 1) {
    throw new DomainError(
      "INVALID_ARGUMENT",
      "Add at least one rule, fact, secret, or tension before publishing.",
    );
  }
  const timestamp = now.toISOString();
  const revision = worldRevisionSchema.parse({
    ...draft,
    id: revisionId,
    worldId: draft.id,
    revisionNumber,
    createdAt: timestamp,
  });
  const world = publishedWorldSchema.parse({
    id: draft.id,
    creatorId: draft.creatorId,
    currentRevisionId: revisionId,
    visibility: "published",
    name: draft.name,
    premise: draft.premise,
    genre: draft.genre,
    tone: draft.tone,
    coverImage: draft.coverImage,
    remixEnabled: draft.remixEnabled,
    remixCount: existing?.remixCount ?? 0,
    creatorPickBranchId: existing?.creatorPickBranchId ?? null,
    publishedAt: existing?.publishedAt ?? timestamp,
    updatedAt: timestamp,
  });
  const updatedDraft = worldDraftSchema.parse({
    ...draft,
    latestRevisionId: revisionId,
    version: draft.version + 1,
    updatedAt: timestamp,
  });
  return { world, revision, draft: updatedDraft };
}

export function publishBranchSnapshot(
  state: BranchState,
  revisionId: string,
  revisionNumber: number,
  existing: PublishedBranch | null,
  now = new Date(),
): { branch: PublishedBranch; revision: BranchRevision } {
  if (state.episodes.length === 0) {
    throw new DomainError(
      "INVALID_ARGUMENT",
      "Add at least one episode before publishing this remix.",
    );
  }
  const timestamp = now.toISOString();
  const publicState = {
    branch: {
      ...state.branch,
      recentActivity: [],
      lastAgentAction: null,
    },
    episodes: state.episodes,
  };
  return {
    branch: publishedBranchSchema.parse({
      id: state.branch.id,
      creatorId: state.branch.creatorId,
      rootWorldId: state.branch.rootWorldId,
      baseWorldRevisionId: state.branch.baseWorldRevisionId,
      parentBranchId: state.branch.parentBranchId ?? null,
      parentBranchRevisionId: state.branch.parentBranchRevisionId ?? null,
      currentRevisionId: revisionId,
      visibility: "published",
      title: state.branch.title,
      creativeIntent: state.branch.creativeIntent,
      inheritedSummary: state.branch.inheritedSummary,
      episodeCount: state.episodes.length,
      likeCount: existing?.likeCount ?? 0,
      publishedAt: existing?.publishedAt ?? timestamp,
      updatedAt: timestamp,
    }),
    revision: branchRevisionSchema.parse({
      id: revisionId,
      branchId: state.branch.id,
      creatorId: state.branch.creatorId,
      revisionNumber,
      state: publicState,
      createdAt: timestamp,
    }),
  };
}
