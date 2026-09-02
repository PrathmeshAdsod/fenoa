import type {
  AddBranchCharacterInput,
  AddEpisodeInput,
  ApiResult,
  DeleteEpisodeInput,
  MoveEpisodeInput,
  SetConstraintInput,
  UpdateBranchRuleInput,
  UpdateEpisodeInput,
} from "@/lib/contracts/api";
import type {
  BranchState,
  BranchDraft,
  Episode,
  EpisodeContext,
} from "@/lib/contracts/domain";
import type {
  CreativeSession,
  CreativeTurnRequest,
  CreativeTurnResult,
} from "@/lib/contracts/creative";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const result = (await response.json()) as ApiResult<T>;
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data;
}

export const domainClient = {
  getBranchState(branchId: string, signal?: AbortSignal) {
    return request<BranchState>(`/api/branches/${branchId}`, { signal });
  },
  getEpisode(branchId: string, episodeId: string, signal?: AbortSignal) {
    return request<EpisodeContext>(
      `/api/branches/${branchId}/episodes/${episodeId}`,
      { signal },
    );
  },
  updateEpisode(
    branchId: string,
    episodeId: string,
    input: UpdateEpisodeInput,
    signal?: AbortSignal,
  ) {
    return request<Episode>(`/api/branches/${branchId}/episodes/${episodeId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      signal,
    });
  },
  setConstraint(
    branchId: string,
    input: SetConstraintInput,
    signal?: AbortSignal,
  ) {
    return request<BranchDraft>(`/api/branches/${branchId}/constraints`, {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
  moveEpisode(branchId: string, input: MoveEpisodeInput, signal?: AbortSignal) {
    return request<BranchState>(`/api/branches/${branchId}/episodes/move`, {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
  addBranchCharacter(
    branchId: string,
    input: AddBranchCharacterInput,
    signal?: AbortSignal,
  ) {
    return request<BranchDraft>(`/api/branches/${branchId}/characters`, {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
  updateBranchRule(
    branchId: string,
    input: UpdateBranchRuleInput,
    signal?: AbortSignal,
  ) {
    return request<BranchDraft>(`/api/branches/${branchId}/rules`, {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
  addEpisode(branchId: string, input: AddEpisodeInput, signal?: AbortSignal) {
    return request<BranchState>(`/api/branches/${branchId}/episodes`, {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
  deleteEpisode(
    branchId: string,
    input: DeleteEpisodeInput,
    signal?: AbortSignal,
  ) {
    return request<BranchState>(`/api/branches/${branchId}/episodes`, {
      method: "DELETE",
      body: JSON.stringify(input),
      signal,
    });
  },
  undoAgentAction(
    branchId: string,
    input: { activityId: string; expectedBranchVersion: number },
    signal?: AbortSignal,
  ) {
    return request<BranchDraft>(`/api/branches/${branchId}/undo`, {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
  getCreativeSession(branchId: string, signal?: AbortSignal) {
    return request<CreativeSession | null>(
      `/api/branches/${branchId}/creative`,
      { signal },
    );
  },
  runCreativeTurn(
    branchId: string,
    input: CreativeTurnRequest,
    signal?: AbortSignal,
  ) {
    return request<CreativeTurnResult>(`/api/branches/${branchId}/creative`, {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
};
