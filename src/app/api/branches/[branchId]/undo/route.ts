import { undoAgentActionInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { undoLastAgentAction } from "@/lib/server/branch-repository";
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
    const input = undoAgentActionInputSchema.parse(body);
    return ok(
      await undoLastAgentAction(
        branchId,
        uid,
        input.activityId,
        input.expectedBranchVersion,
      ),
      id,
    );
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
