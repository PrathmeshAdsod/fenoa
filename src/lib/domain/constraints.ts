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
        return branch.ruleOverrides.some(
          (fact) =>
            fact.id === constraint.factId &&
            fact.statement !== constraint.statement,
        );
    }
  });
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
