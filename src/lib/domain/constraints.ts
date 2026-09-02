import type {
  BranchDraft,
  Episode,
  StoryConstraint,
} from "@/lib/contracts/domain";
import { DomainError } from "@/lib/domain/errors";

function appliesThrough(
  throughEpisode: number | undefined,
  position: number,
): boolean {
  return throughEpisode === undefined || position <= throughEpisode;
}

function violatesBranchFactLock(
  branch: BranchDraft,
  constraint: Extract<StoryConstraint, { type: "branch_fact_lock" }>,
): boolean {
  const fact = branch.ruleOverrides.find(
    (candidate) => candidate.id === constraint.factId,
  );
  return !fact || fact.statement !== constraint.statement;
}

export function findConstraintViolation(
  branch: BranchDraft,
  episode: Episode,
): StoryConstraint | undefined {
  return branch.constraints.find((constraint) => {
    switch (constraint.type) {
      case "character_availability":
        return (
          episode.position < constraint.availableFromEpisode &&
          episode.effects.participantIds.includes(constraint.characterId)
        );
      case "knowledge_lock":
        return (
          appliesThrough(constraint.throughEpisode, episode.position) &&
          episode.effects.participantIds.includes(constraint.characterId) &&
          episode.effects.revealedFactIds.includes(constraint.factId)
        );
      case "fact_state_lock":
        return (
          appliesThrough(constraint.throughEpisode, episode.position) &&
          episode.effects.ruleChanges.some(
            (change) =>
              change.factId === constraint.factId &&
              change.state !== constraint.requiredState,
          )
        );
      case "relationship_lock":
        return (
          appliesThrough(constraint.throughEpisode, episode.position) &&
          episode.effects.relationshipChanges.some(
            (change) =>
              change.relationshipId === constraint.relationshipId &&
              change.kind !== constraint.requiredKind,
          )
        );
      case "branch_fact_lock":
        return violatesBranchFactLock(branch, constraint);
    }
  });
}

export function findBranchConstraintViolation(
  branch: BranchDraft,
): StoryConstraint | undefined {
  return branch.constraints.find(
    (constraint) =>
      constraint.type === "branch_fact_lock" &&
      violatesBranchFactLock(branch, constraint),
  );
}

export function assertBranchConstraints(branch: BranchDraft): void {
  const violation = findBranchConstraintViolation(branch);
  if (violation) {
    throw new DomainError(
      "CONSTRAINT_VIOLATION",
      `This change conflicts with the locked decision: ${violation.label}`,
    );
  }
}

export function assertEpisodeConstraints(
  branch: BranchDraft,
  episode: Episode,
): void {
  const violation = findConstraintViolation(branch, episode);
  if (violation) {
    throw new DomainError(
      "CONSTRAINT_VIOLATION",
      `This change conflicts with the locked decision: ${violation.label}`,
    );
  }
}
