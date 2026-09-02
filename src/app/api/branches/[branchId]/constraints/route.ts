import { setConstraintInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { saveConstraintChange } from "@/lib/server/branch-repository";
import { ok, requestId, toErrorResponse } from "@/lib/server/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ branchId: string }> },
) {
  const id = requestId();
  try {
    const [{ uid }, { branchId }, body] = await Promise.all([
      requireUser(),
      context.params,
      request.json(),
    ]);
    const input = setConstraintInputSchema.parse(body);
    return ok(await saveConstraintChange(branchId, uid, input), id);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
