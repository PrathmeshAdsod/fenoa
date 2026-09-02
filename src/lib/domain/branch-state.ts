import type { BranchState } from "@/lib/contracts/domain";

export function compactBranchState(state: BranchState) {
  return {
    branchId: state.branch.id,
    branchVersion: state.branch.version,
    title: state.branch.title,
    creativeIntent: state.branch.creativeIntent,
    lineage: {
      rootWorldId: state.branch.rootWorldId,
      baseWorldRevisionId: state.branch.baseWorldRevisionId,
      parentBranchId: state.branch.parentBranchId,
      parentBranchRevisionId: state.branch.parentBranchRevisionId,
    },
    inheritedSummary: state.branch.inheritedSummary,
    episodes: state.episodes.map((episode) => ({
      id: episode.id,
      position: episode.position,
      title: episode.title,
      hook: episode.hook,
      version: episode.version,
    })),
    addedCharacters: state.branch.addedCharacters.map((character) => ({
      id: character.id,
      name: character.name,
      role: character.role,
    })),
    ruleOverrides: state.branch.ruleOverrides,
    constraints: state.branch.constraints,
  };
}
