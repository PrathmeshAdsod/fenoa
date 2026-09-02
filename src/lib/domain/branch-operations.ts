import {
  branchDraftSchema,
  episodeSchema,
  type BranchDraft,
  type Episode,
  type StoryConstraint,
} from "@/lib/contracts/domain";
import type {
  SetConstraintInput,
  UpdateEpisodeInput,
} from "@/lib/contracts/api";
import { assertEpisodeConstraints } from "@/lib/domain/constraints";
import { DomainError } from "@/lib/domain/errors";

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
  if (branch.version !== input.expectedBranchVersion) {
    throw new DomainError(
      "STALE_VERSION",
      "The branch changed after it was read. Refresh it before editing locks.",
      true,
    );
  }

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

  return branchDraftSchema.parse({
    ...branch,
    constraints,
    version: branch.version + 1,
    updatedAt: now.toISOString(),
  });
}
