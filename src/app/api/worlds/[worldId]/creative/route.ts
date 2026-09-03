import { creativeTurnRequestSchema } from "@/lib/contracts/creative";
import { requireUser } from "@/lib/server/auth";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";
import {
  getWorldCreativeSession,
  runWorldCreativeTurn,
} from "@/lib/server/world-creative-service";

export const maxDuration = 60;
type Params = { params: Promise<{ worldId: string }> };

export async function GET(_request: Request, context: Params) {
  const id = requestId();
  try {
    const [{ uid }, { worldId }] = await Promise.all([
      requireUser(),
      context.params,
    ]);
    return ok(await getWorldCreativeSession(worldId, uid), id);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}

export async function POST(request: Request, context: Params) {
  const id = requestId();
  try {
    const [{ uid }, { worldId }, body] = await Promise.all([
      requireUser(),
      context.params,
      readJson(request),
    ]);
    return ok(
      await runWorldCreativeTurn(
        worldId,
        uid,
        creativeTurnRequestSchema.parse(body),
        request.signal,
      ),
      id,
    );
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
