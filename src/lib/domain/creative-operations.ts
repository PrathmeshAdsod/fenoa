import type {
  CreativeBuildOperation,
  CreativeResponse,
} from "@/lib/contracts/creative";
import {
  branchStateSchema,
  storyConstraintSchema,
  type BranchState,
  type Episode,
} from "@/lib/contracts/domain";
import {
  addBranchCharacter,
  moveEpisode,
  setConstraint,
  updateBranchRule,
  updateEpisode,
} from "@/lib/domain/branch-operations";
import { assertEpisodeConstraints } from "@/lib/domain/constraints";
import { DomainError } from "@/lib/domain/errors";

function episodePatch(
  operation: Extract<CreativeBuildOperation, { operation: "update_episode" }>,
) {
  const entries = Object.entries(operation.patch).filter(
    ([, value]) => value !== null,
  );
  if (entries.length === 0) {
    throw new DomainError(
      "INVALID_ARGUMENT",
      "A creative build episode update must contain at least one change.",
    );
  }
  return Object.fromEntries(entries);
}

function operationPriority(operation: CreativeBuildOperation): number {
  if (operation.operation === "update_episode") return 0;
  if (operation.operation === "move_episode") return 2;
  return 1;
}

export function applyCreativeBuild(
  initial: BranchState,
  response: Extract<CreativeResponse, { mode: "BUILD" }>,
  now = new Date(),
): { state: BranchState; targetIds: string[]; changedBefore: Episode[] } {
  let branch = initial.branch;
  let episodes = initial.episodes;
  const changedBefore = new Map<string, Episode>();
  const targetIds = new Set<string>();
  const operations = [...response.operations].sort(
    (left, right) => operationPriority(left) - operationPriority(right),
  );

  for (const operation of operations) {
    switch (operation.operation) {
      case "update_episode": {
        const episode = episodes.find(
          (item) => item.id === operation.episodeId,
        );
        if (!episode) {
          throw new DomainError(
            "NOT_FOUND",
            "The creative build referenced an episode that does not exist.",
          );
        }
        if (!changedBefore.has(episode.id)) {
          changedBefore.set(episode.id, episode);
        }
        const updated = updateEpisode(
          branch,
          episode,
          {
            expectedEpisodeVersion: operation.expectedEpisodeVersion,
            actorType: "creative_engine",
            patch: episodePatch(operation),
          },
          now,
        );
        episodes = episodes.map((item) =>
          item.id === updated.id ? updated : item,
        );
        targetIds.add(updated.id);
        break;
      }
      case "move_episode": {
        for (const episode of episodes) {
          if (!changedBefore.has(episode.id)) {
            changedBefore.set(episode.id, episode);
          }
        }
        const moved = moveEpisode(
          branch,
          episodes,
          {
            episodeId: operation.episodeId,
            toPosition: operation.toPosition,
            expectedBranchVersion: branch.version,
            actorType: "creative_engine",
          },
          now,
        );
        branch = moved.branch;
        episodes = moved.episodes;
        targetIds.add(operation.episodeId);
        break;
      }
      case "add_branch_character":
        branch = addBranchCharacter(
          branch,
          {
            expectedBranchVersion: branch.version,
            character: operation.character,
            actorType: "creative_engine",
          },
          now,
        );
        targetIds.add(operation.character.id);
        break;
      case "update_branch_rule":
        if (operation.action === "upsert") {
          if (!operation.fact || operation.factId) {
            throw new DomainError(
              "INVALID_ARGUMENT",
              "A rule upsert requires fact and no factId.",
            );
          }
          branch = updateBranchRule(
            branch,
            {
              action: "upsert",
              expectedBranchVersion: branch.version,
              fact: operation.fact,
              actorType: "creative_engine",
            },
            now,
          );
          targetIds.add(operation.fact.id);
        } else {
          if (!operation.factId || operation.fact) {
            throw new DomainError(
              "INVALID_ARGUMENT",
              "A rule removal requires factId and no fact.",
            );
          }
          branch = updateBranchRule(
            branch,
            {
              action: "remove",
              expectedBranchVersion: branch.version,
              factId: operation.factId,
              actorType: "creative_engine",
            },
            now,
          );
          targetIds.add(operation.factId);
        }
        break;
      case "set_story_constraint":
        if (operation.action === "remove") {
          if (!operation.constraintId || operation.constraint) {
            throw new DomainError(
              "INVALID_ARGUMENT",
              "A lock removal requires constraintId and no constraint.",
            );
          }
          branch = setConstraint(
            branch,
            {
              action: "remove",
              expectedBranchVersion: branch.version,
              constraintId: operation.constraintId,
              actorType: "creative_engine",
            },
            now,
          );
          targetIds.add(operation.constraintId);
        } else {
          if (!operation.constraint || operation.constraintId) {
            throw new DomainError(
              "INVALID_ARGUMENT",
              "A lock change requires constraint and no constraintId.",
            );
          }
          const rawConstraint = { ...operation.constraint } as Record<
            string,
            unknown
          >;
          if (rawConstraint.throughEpisode === null) {
            delete rawConstraint.throughEpisode;
          }
          const constraint = storyConstraintSchema.parse(rawConstraint);
          branch = setConstraint(
            branch,
            {
              action: operation.action,
              expectedBranchVersion: branch.version,
              constraint,
              actorType: "creative_engine",
            },
            now,
          );
          targetIds.add(constraint.id);
        }
        break;
    }
  }

  for (const episode of episodes) {
    assertEpisodeConstraints(branch, episode);
  }

  return {
    state: branchStateSchema.parse({ branch, episodes }),
    targetIds: [...targetIds],
    changedBefore: [...changedBefore.values()],
  };
}
