import { creativeTurnRequestSchema } from "@/lib/contracts/creative";
import { requireUser } from "@/lib/server/auth";
import {
  getCreativeSession,
  runCreativeTurn,
} from "@/lib/server/creative-service";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";

export const maxDuration = 60;

type Params = { params: Promise<{ branchId: string }> };

export async function GET(_request: Request, context: Params) {
  const id = requestId();
  try {
    const [{ uid }, { branchId }] = await Promise.all([
      requireUser(),
      context.params,
    ]);
    return ok(await getCreativeSession(branchId, uid), id);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}

export async function POST(request: Request, context: Params) {
  const id = requestId();
  try {
    const [{ uid }, { branchId }, body] = await Promise.all([
      requireUser(),
      context.params,
      readJson(request),
    ]);
    return ok(
      await runCreativeTurn(
        branchId,
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
