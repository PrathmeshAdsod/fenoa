import { likeBranchInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";
import { getBranchLike, setBranchLike } from "@/lib/server/world-repository";

type Params = { params: Promise<{ branchId: string }> };

export async function GET(_request: Request, context: Params) {
  const id = requestId();
  try {
    const [{ uid }, { branchId }] = await Promise.all([
      requireUser(),
      context.params,
    ]);
    return ok(await getBranchLike(branchId, uid), id);
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
    const input = likeBranchInputSchema.parse(body);
    return ok(await setBranchLike(branchId, uid, input.liked), id);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
