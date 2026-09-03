import { updateWorldInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";
import { getWorldDraft, saveWorldDraft } from "@/lib/server/world-repository";

type Params = { params: Promise<{ worldId: string }> };

export async function GET(_request: Request, context: Params) {
  const id = requestId();
  try {
    const [{ uid }, { worldId }] = await Promise.all([
      requireUser(),
      context.params,
    ]);
    return ok(await getWorldDraft(worldId, uid), id);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}

export async function PATCH(request: Request, context: Params) {
  const id = requestId();
  try {
    const [{ uid }, { worldId }, body] = await Promise.all([
      requireUser(),
      context.params,
      readJson(request),
    ]);
    return ok(
      await saveWorldDraft(worldId, uid, updateWorldInputSchema.parse(body)),
      id,
    );
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
