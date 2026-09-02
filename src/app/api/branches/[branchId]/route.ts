import { requireUser } from "@/lib/server/auth";
import { getBranchState } from "@/lib/server/branch-repository";
import { ok, requestId, toErrorResponse } from "@/lib/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ branchId: string }> },
) {
  const id = requestId();
  try {
    const [{ uid }, { branchId }] = await Promise.all([
      requireUser(),
      context.params,
    ]);
    const state = await getBranchState(branchId, uid);
    return ok(state, id);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
