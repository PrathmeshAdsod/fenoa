import { startRemixInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";
import { startRemix } from "@/lib/server/world-repository";

export async function POST(request: Request) {
  const id = requestId();
  try {
    const [{ uid }, body] = await Promise.all([
      requireUser(),
      readJson(request),
    ]);
    return ok(await startRemix(uid, startRemixInputSchema.parse(body)), id);
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
