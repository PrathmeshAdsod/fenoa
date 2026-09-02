import {
  branchDraftSchema,
  episodeSchema,
  type BranchDraft,
  type Episode,
  type Fact,
  type StoryConstraint,
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
  assertBranchConstraints,
  assertEpisodeConstraints,
} from "@/lib/domain/constraints";
import { DomainError } from "@/lib/domain/errors";

function assertBranchVersion(
  branch: BranchDraft,
  expectedBranchVersion: number,
): void {
  if (branch.version !== expectedBranchVersion) {
    throw new DomainError(
      "STALE_VERSION",
      "This branch changed after it was read. Refresh it before editing.",
      true,
    );
  }
}

function nextBranch(branch: BranchDraft, now: Date): BranchDraft {
  return branchDraftSchema.parse({
    ...branch,
    version: branch.version + 1,
    updatedAt: now.toISOString(),
  });
}

export function updateEpisode(
  branch: BranchDraft,
  episode: Episode,
  input: UpdateEpisodeInput,
  now = new Date(),
): Episode {
  if (episode.version !== input.expectedEpisodeVersion) {
    throw new DomainError(
      "STALE_VERSION",
      "This episode changed after it was read. Refresh it before editing.",
      true,
    );
  }

  const updated = episodeSchema.parse({
    ...episode,
    ...input.patch,
    version: episode.version + 1,
    updatedAt: now.toISOString(),
  });

  assertEpisodeConstraints(branch, updated);
  return updated;
}

export function setConstraint(
  branch: BranchDraft,
  input: SetConstraintInput,
  now = new Date(),
): BranchDraft {
  assertBranchVersion(branch, input.expectedBranchVersion);

  let constraints: StoryConstraint[];
  if (input.action === "remove") {
    if (!branch.constraints.some((item) => item.id === input.constraintId)) {
      throw new DomainError("NOT_FOUND", "The requested lock does not exist.");
    }
    constraints = branch.constraints.filter(
      (item) => item.id !== input.constraintId,
    );
  } else if (input.action === "update") {
    if (!branch.constraints.some((item) => item.id === input.constraint.id)) {
      throw new DomainError("NOT_FOUND", "The requested lock does not exist.");
    }
    constraints = branch.constraints.map((item) =>
      item.id === input.constraint.id ? input.constraint : item,
    );
  } else {
    if (branch.constraints.some((item) => item.id === input.constraint.id)) {
      throw new DomainError(
        "INVALID_ARGUMENT",
        "A lock with this identifier already exists.",
      );
    }
    constraints = [...branch.constraints, input.constraint];
  }

  const updated = branchDraftSchema.parse({
    ...branch,
    constraints,
    version: branch.version + 1,
    updatedAt: now.toISOString(),
  });
  assertBranchConstraints(updated);
  return updated;
}

export function moveEpisode(
  branch: BranchDraft,
  episodes: Episode[],
  input: MoveEpisodeInput,
  now = new Date(),
): { branch: BranchDraft; episodes: Episode[] } {
  assertBranchVersion(branch, input.expectedBranchVersion);
  if (input.toPosition > episodes.length) {
    throw new DomainError(
      "INVALID_ARGUMENT",
      "The requested episode position is outside this branch.",
    );
  }
  const ordered = [...episodes].sort((a, b) => a.position - b.position);
  const fromIndex = ordered.findIndex(
    (episode) => episode.id === input.episodeId,
  );
  if (fromIndex < 0) {
    throw new DomainError("NOT_FOUND", "This episode does not exist.");
  }
  const [moved] = ordered.splice(fromIndex, 1);
  if (!moved) {
    throw new DomainError("NOT_FOUND", "This episode does not exist.");
  }
  ordered.splice(input.toPosition - 1, 0, moved);
  const timestamp = now.toISOString();
  const updatedEpisodes = ordered.map((episode, index) =>
    episodeSchema.parse({
      ...episode,
      position: index + 1,
      version:
        episode.position === index + 1 ? episode.version : episode.version + 1,
      updatedAt: episode.position === index + 1 ? episode.updatedAt : timestamp,
    }),
  );
  return { branch: nextBranch(branch, now), episodes: updatedEpisodes };
}

export function addBranchCharacter(
  branch: BranchDraft,
  input: AddBranchCharacterInput,
  now = new Date(),
): BranchDraft {
  assertBranchVersion(branch, input.expectedBranchVersion);
  if (branch.addedCharacters.some((item) => item.id === input.character.id)) {
    throw new DomainError(
      "INVALID_ARGUMENT",
      "A branch character with this identifier already exists.",
    );
  }
  return nextBranch(
    branchDraftSchema.parse({
      ...branch,
      addedCharacters: [...branch.addedCharacters, input.character],
    }),
    now,
  );
}

export function updateBranchRule(
  branch: BranchDraft,
  input: UpdateBranchRuleInput,
  now = new Date(),
): BranchDraft {
  assertBranchVersion(branch, input.expectedBranchVersion);
  let ruleOverrides: Fact[];
  if (input.action === "remove") {
    if (!branch.ruleOverrides.some((item) => item.id === input.factId)) {
      throw new DomainError("NOT_FOUND", "This branch rule does not exist.");
    }
    ruleOverrides = branch.ruleOverrides.filter(
      (item) => item.id !== input.factId,
    );
  } else {
    ruleOverrides = branch.ruleOverrides.some(
      (item) => item.id === input.fact.id,
    )
      ? branch.ruleOverrides.map((item) =>
          item.id === input.fact.id ? input.fact : item,
        )
      : [...branch.ruleOverrides, input.fact];
  }
  const updated = nextBranch(
    branchDraftSchema.parse({ ...branch, ruleOverrides }),
    now,
  );
  assertBranchConstraints(updated);
  return updated;
}

export function addEpisode(
  branch: BranchDraft,
  episodes: Episode[],
  episodeId: string,
  input: AddEpisodeInput,
  now = new Date(),
): { branch: BranchDraft; episodes: Episode[]; episode: Episode } {
  assertBranchVersion(branch, input.expectedBranchVersion);
  if (episodes.length >= 8) {
    throw new DomainError(
      "CONSTRAINT_VIOLATION",
      "A remix branch can contain at most eight episodes.",
    );
  }
  if (input.position > episodes.length + 1) {
    throw new DomainError(
      "INVALID_ARGUMENT",
      "The new episode position is outside this branch.",
    );
  }
  const timestamp = now.toISOString();
  const shifted = episodes.map((episode) =>
    episode.position >= input.position
      ? episodeSchema.parse({
          ...episode,
          position: episode.position + 1,
          version: episode.version + 1,
          updatedAt: timestamp,
        })
      : episode,
  );
  const episode = episodeSchema.parse({
    id: episodeId,
    branchId: branch.id,
    position: input.position,
    title: input.title,
    hook: input.hook,
    keyBeats: [input.hook],
    narrative: "",
    effects: {
      participantIds: [],
      revealedFactIds: [],
      resolvedFactIds: [],
      relationshipChanges: [],
      ruleChanges: [],
    },
    version: 1,
    updatedAt: timestamp,
  });
  return {
    branch: nextBranch(branch, now),
    episodes: [...shifted, episode].sort((a, b) => a.position - b.position),
    episode,
  };
}

export function deleteEpisode(
  branch: BranchDraft,
  episodes: Episode[],
  input: DeleteEpisodeInput,
  now = new Date(),
): { branch: BranchDraft; episodes: Episode[]; deleted: Episode } {
  assertBranchVersion(branch, input.expectedBranchVersion);
  if (episodes.length <= 1) {
    throw new DomainError(
      "CONSTRAINT_VIOLATION",
      "A remix branch must keep at least one episode.",
    );
  }
  const deleted = episodes.find((episode) => episode.id === input.episodeId);
  if (!deleted) {
    throw new DomainError("NOT_FOUND", "This episode does not exist.");
  }
  const timestamp = now.toISOString();
  const remaining = episodes
    .filter((episode) => episode.id !== input.episodeId)
    .sort((a, b) => a.position - b.position)
    .map((episode, index) =>
      episode.position === index + 1
        ? episode
        : episodeSchema.parse({
            ...episode,
            position: index + 1,
            version: episode.version + 1,
            updatedAt: timestamp,
          }),
    );
  return { branch: nextBranch(branch, now), episodes: remaining, deleted };
}
