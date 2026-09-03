import { reportContentInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";
import { createReport } from "@/lib/server/world-repository";

export async function POST(request: Request) {
  const id = requestId();
  try {
    const [{ uid }, body] = await Promise.all([
      requireUser(),
      readJson(request),
    ]);
    return ok(
      await createReport(uid, reportContentInputSchema.parse(body)),
      id,
    );
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
