import { updateEpisodeInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { getEpisode, saveEpisodeUpdate } from "@/lib/server/branch-repository";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";

type Params = { params: Promise<{ branchId: string; episodeId: string }> };

export async function GET(_request: Request, context: Params) {
  const id = requestId();
  try {
    const [{ uid }, { branchId, episodeId }] = await Promise.all([
      requireUser(),
      context.params,
    ]);
    return ok(await getEpisode(branchId, episodeId, uid), id);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}

export async function PATCH(request: Request, context: Params) {
  const id = requestId();
  try {
    const [{ uid }, { branchId, episodeId }, body] = await Promise.all([
      requireUser(),
      context.params,
      readJson(request),
    ]);
    const input = updateEpisodeInputSchema.parse(body);
    return ok(await saveEpisodeUpdate(branchId, episodeId, uid, input), id);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
