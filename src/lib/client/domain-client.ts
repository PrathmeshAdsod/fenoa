import type {
  ApiResult,
  SetConstraintInput,
  UpdateEpisodeInput,
} from "@/lib/contracts/api";
import type { BranchState, BranchDraft, Episode } from "@/lib/contracts/domain";

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
    return request<Episode>(`/api/branches/${branchId}/episodes/${episodeId}`, {
      signal,
    });
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
};
