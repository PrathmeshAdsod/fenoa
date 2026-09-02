import {
  addEpisodeInputSchema,
  deleteEpisodeInputSchema,
} from "@/lib/contracts/api";
import { requireUser } from "@/lib/server/auth";
import {
  saveEpisodeAddition,
  saveEpisodeDeletion,
} from "@/lib/server/branch-repository";
import { ok, readJson, requestId, toErrorResponse } from "@/lib/server/http";

type Params = { params: Promise<{ branchId: string }> };

export async function POST(request: Request, context: Params) {
  const id = requestId();
  try {
    const [{ uid }, { branchId }, body] = await Promise.all([
      requireUser(),
      context.params,
      readJson(request),
    ]);
    return ok(
      await saveEpisodeAddition(
        branchId,
        uid,
        addEpisodeInputSchema.parse(body),
      ),
      id,
    );
  } catch (error) {
    return toErrorResponse(error, id);
  }
}

export async function DELETE(request: Request, context: Params) {
  const id = requestId();
  try {
    const [{ uid }, { branchId }, body] = await Promise.all([
      requireUser(),
      context.params,
      readJson(request),
    ]);
    return ok(
      await saveEpisodeDeletion(
        branchId,
        uid,
        deleteEpisodeInputSchema.parse(body),
      ),
      id,
    );
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
