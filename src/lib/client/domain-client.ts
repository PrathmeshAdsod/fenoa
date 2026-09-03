import type {
  AddBranchCharacterInput,
  AddEpisodeInput,
  ApiResult,
  DeleteEpisodeInput,
  MoveEpisodeInput,
  ReportContentInput,
  SetConstraintInput,
  UpdateBranchRuleInput,
  UpdateEpisodeInput,
  CreateWorldInput,
  StartRemixInput,
  UpdateWorldInput,
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
import type { WorldCreativeSession } from "@/lib/contracts/world-creative";
import type {
  BranchRevision,
  PublishedBranch,
  PublishedWorld,
  PublicProfile,
  WorldDraft,
} from "@/lib/contracts/world";

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
  createWorld(input: CreateWorldInput, signal?: AbortSignal) {
    return request<WorldDraft>("/api/worlds", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
  updateWorld(worldId: string, input: UpdateWorldInput, signal?: AbortSignal) {
    return request<WorldDraft>(`/api/worlds/${worldId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      signal,
    });
  },
  publishWorld(worldId: string, expectedVersion: number, signal?: AbortSignal) {
    return request<{ world: PublishedWorld; draft: WorldDraft }>(
      `/api/worlds/${worldId}/publish`,
      {
        method: "POST",
        body: JSON.stringify({ expectedVersion }),
        signal,
      },
    );
  },
  getWorldCreativeSession(worldId: string, signal?: AbortSignal) {
    return request<WorldCreativeSession | null>(
      `/api/worlds/${worldId}/creative`,
      { signal },
    );
  },
  runWorldCreativeTurn(
    worldId: string,
    input: CreativeTurnRequest,
    signal?: AbortSignal,
  ) {
    return request<{
      session: WorldCreativeSession;
      draft: WorldDraft;
      response: WorldCreativeSession["turns"][number]["response"];
    }>(`/api/worlds/${worldId}/creative`, {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
  generateWorldCover(
    worldId: string,
    input: { expectedVersion: number; direction: string },
    signal?: AbortSignal,
  ) {
    return request<{
      draft: WorldDraft;
      image: NonNullable<WorldDraft["coverImage"]>;
    }>(`/api/worlds/${worldId}/image`, {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
  startRemix(input: StartRemixInput, signal?: AbortSignal) {
    return request<BranchState>("/api/remixes", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
  publishBranch(
    branchId: string,
    expectedBranchVersion: number,
    signal?: AbortSignal,
  ) {
    return request<{ branch: PublishedBranch; revision: BranchRevision }>(
      `/api/branches/${branchId}/publish`,
      {
        method: "POST",
        body: JSON.stringify({ expectedBranchVersion }),
        signal,
      },
    );
  },
  getBranchLike(branchId: string, signal?: AbortSignal) {
    return request<{ liked: boolean }>(`/api/branches/${branchId}/like`, {
      signal,
    });
  },
  setBranchLike(branchId: string, liked: boolean, signal?: AbortSignal) {
    return request<{ liked: boolean; likeCount: number }>(
      `/api/branches/${branchId}/like`,
      { method: "POST", body: JSON.stringify({ liked }), signal },
    );
  },
  setCreatorPick(
    worldId: string,
    branchId: string | null,
    signal?: AbortSignal,
  ) {
    return request<PublishedWorld>(`/api/worlds/${worldId}/creator-pick`, {
      method: "POST",
      body: JSON.stringify({ branchId }),
      signal,
    });
  },
  updateProfile(
    input: { displayName: string; bio: string },
    signal?: AbortSignal,
  ) {
    return request<PublicProfile>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
      signal,
    });
  },
  reportContent(input: ReportContentInput, signal?: AbortSignal) {
    return request<{ id: string }>("/api/reports", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
};
