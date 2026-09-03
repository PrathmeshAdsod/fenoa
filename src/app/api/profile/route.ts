import { updateProfileInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";
import { updateProfile } from "@/lib/server/world-repository";

export async function PATCH(request: Request) {
  const id = requestId();
  try {
    const [{ uid }, body] = await Promise.all([
      requireUser(),
      readJson(request),
    ]);
    return ok(
      await updateProfile(uid, updateProfileInputSchema.parse(body)),
      id,
    );
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
