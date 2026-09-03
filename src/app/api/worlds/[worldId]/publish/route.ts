import { publishWorldInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";
import { publishWorld } from "@/lib/server/world-repository";

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
    const input = publishWorldInputSchema.parse(body);
    return ok(await publishWorld(worldId, uid, input.expectedVersion), id);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
