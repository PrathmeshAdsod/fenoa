import { creatorPickInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";
import { setCreatorPick } from "@/lib/server/world-repository";

export async function POST(
  request: Request,
  context: { params: Promise<{ worldId: string }> },
) {
  const id = requestId();
  try {
    const [{ uid }, { worldId }, body] = await Promise.all([
      requireUser(),
      context.params,
      readJson(request),
    ]);
    const input = creatorPickInputSchema.parse(body);
    return ok(await setCreatorPick(worldId, uid, input.branchId), id);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
