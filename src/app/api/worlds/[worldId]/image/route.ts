import { generateWorldImageInputSchema } from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import { generateWorldCover } from "@/lib/server/image-service";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";

export const maxDuration = 90;

export async function POST(
  request: Request,
  context: { params: Promise<{ worldId: string }> },
) {
  const id = requestId();
  try {
    const [{ uid }, { worldId }, body] = await Promise.all([
      requireUser(),
      context.params,
      readJson(request),
    ]);
    return ok(
      await generateWorldCover(
        worldId,
        uid,
        generateWorldImageInputSchema.parse(body),
        request.signal,
      ),
      id,
    );
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
