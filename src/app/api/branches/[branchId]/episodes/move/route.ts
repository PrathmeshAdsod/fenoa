import { moveEpisodeInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { saveEpisodeMove } from "@/lib/server/branch-repository";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ branchId: string }> },
) {
  const id = requestId();
  try {
    const [{ uid }, { branchId }, body] = await Promise.all([
      requireUser(),
      context.params,
      readJson(request),
    ]);
    return ok(
      await saveEpisodeMove(branchId, uid, moveEpisodeInputSchema.parse(body)),
      id,
    );
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
