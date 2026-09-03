import { publishBranchInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";
import { publishBranch } from "@/lib/server/world-repository";

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
    const input = publishBranchInputSchema.parse(body);
    return ok(
      await publishBranch(branchId, uid, input.expectedBranchVersion),
      id,
    );
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
