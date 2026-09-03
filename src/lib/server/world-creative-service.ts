import { randomUUID } from "node:crypto";

import {
  creativeTurnRequestSchema,
  type CreativeTurnRequest,
} from "@/lib/contracts/creative";
import {
  worldCreativeSessionSchema,
  worldCreativeTurnSchema,
  type WorldCreativeSession,
} from "@/lib/contracts/world-creative";
import { worldDraftSchema, type WorldDraft } from "@/lib/contracts/world";
import { updateWorldInputSchema } from "@/lib/contracts/api";
import { DomainError } from "@/lib/domain/errors";
import { updateWorldDraft } from "@/lib/domain/world-operations";
import { reserveCreativeUsage } from "@/lib/server/creative-usage";
import { adminDb } from "@/lib/server/firebase-admin";
import { omitDocumentId } from "@/lib/server/firestore-document";
import {
  openAiWorldCreativeProvider,
  type WorldCreativeProvider,
} from "@/lib/server/world-creative-provider";

const SESSION_TURN_CAP = 12;
const IN_FLIGHT_TTL_MS = 2 * 60 * 1_000;

type WorldTurnLease = {
  draft: WorldDraft;
  session: WorldCreativeSession;
  startedAt: string;
};

function emptySession(
  worldId: string,
  creatorId: string,
  now: string,
): WorldCreativeSession {
  return worldCreativeSessionSchema.parse({
    id: worldId,
    worldId,
    creatorId,
    turnCount: 0,
    turns: [],
    inFlight: false,
    inFlightStartedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function beginWorldTurn(
  worldId: string,
  uid: string,
): Promise<WorldTurnLease> {
  const db = adminDb();
  const draftRef = db.collection("worldDrafts").doc(worldId);
  const sessionRef = db.collection("worldCreativeSessions").doc(worldId);
  const nowDate = new Date();
  const now = nowDate.toISOString();
  return db.runTransaction(async (transaction) => {
    const [draftSnapshot, sessionSnapshot] = await transaction.getAll(
      draftRef,
      sessionRef,
    );
    if (!draftSnapshot?.exists) {
      throw new DomainError("NOT_FOUND", "This world does not exist.");
    }
    const draft = worldDraftSchema.parse({
      id: draftSnapshot.id,
      ...draftSnapshot.data(),
    });
    if (draft.creatorId !== uid) {
      throw new DomainError("FORBIDDEN", "You do not own this world.");
    }
    const session = sessionSnapshot?.exists
      ? worldCreativeSessionSchema.parse({
          id: sessionSnapshot.id,
          ...sessionSnapshot.data(),
        })
      : emptySession(worldId, uid, now);
    if (session.creatorId !== uid) {
      throw new DomainError(
        "FORBIDDEN",
        "You do not own this creative session.",
      );
    }
    if (session.turnCount >= SESSION_TURN_CAP) {
      throw new DomainError(
        "RATE_LIMITED",
        "This collaboration reached its 12-turn safety cap. Continue shaping the canvas directly.",
      );
    }
    const inFlightAge = session.inFlightStartedAt
      ? nowDate.getTime() - new Date(session.inFlightStartedAt).getTime()
      : Number.POSITIVE_INFINITY;
    if (session.inFlight && inFlightAge < IN_FLIGHT_TTL_MS) {
      throw new DomainError(
        "RATE_LIMITED",
        "Creative Partner is already shaping a response for this world.",
        true,
      );
    }
    await reserveCreativeUsage(transaction, db, uid, nowDate);
    transaction.set(sessionRef, {
      ...session,
      inFlight: true,
      inFlightStartedAt: now,
      updatedAt: now,
    });
    return { draft, session, startedAt: now };
  });
}

async function releaseWorldTurn(
  worldId: string,
  uid: string,
  startedAt: string,
): Promise<void> {
  const db = adminDb();
  const ref = db.collection("worldCreativeSessions").doc(worldId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const session = worldCreativeSessionSchema.parse({
      id: snapshot.id,
      ...snapshot.data(),
    });
    if (
      session.creatorId === uid &&
      session.inFlight &&
      session.inFlightStartedAt === startedAt
    ) {
      transaction.update(ref, {
        inFlight: false,
        inFlightStartedAt: null,
        updatedAt: new Date().toISOString(),
      });
    }
  });
}

function buildPatch(
  response: Extract<
    Awaited<ReturnType<WorldCreativeProvider["generate"]>>,
    { mode: "BUILD" }
  >,
) {
  const patch = Object.fromEntries(
    Object.entries(response.patch).filter((entry) => entry[1] !== null),
  );
  if (Object.keys(patch).length === 0) {
    throw new DomainError(
      "PROVIDER_UNAVAILABLE",
      "Creative Partner returned no valid canvas changes. Try a more specific direction.",
      true,
    );
  }
  return patch;
}

async function completeWorldTurn(
  worldId: string,
  uid: string,
  request: CreativeTurnRequest,
  lease: WorldTurnLease,
  response: Awaited<ReturnType<WorldCreativeProvider["generate"]>>,
) {
  const db = adminDb();
  const draftRef = db.collection("worldDrafts").doc(worldId);
  const sessionRef = db.collection("worldCreativeSessions").doc(worldId);
  const now = new Date();
  const timestamp = now.toISOString();
  return db.runTransaction(async (transaction) => {
    const [draftSnapshot, sessionSnapshot] = await transaction.getAll(
      draftRef,
      sessionRef,
    );
    if (!draftSnapshot?.exists || !sessionSnapshot?.exists) {
      throw new DomainError("INTERNAL", "Creative session state is missing.");
    }
    const draft = worldDraftSchema.parse({
      id: draftSnapshot.id,
      ...draftSnapshot.data(),
    });
    const session = worldCreativeSessionSchema.parse({
      id: sessionSnapshot.id,
      ...sessionSnapshot.data(),
    });
    if (
      draft.creatorId !== uid ||
      draft.version !== lease.draft.version ||
      !session.inFlight ||
      session.inFlightStartedAt !== lease.startedAt ||
      session.turnCount !== lease.session.turnCount
    ) {
      throw new DomainError(
        "STALE_VERSION",
        "The World Canvas changed while Creative Partner was responding. Try again with the current state.",
        true,
      );
    }
    let finalDraft = draft;
    if (response.mode === "BUILD") {
      const input = updateWorldInputSchema.parse({
        expectedVersion: draft.version,
        patch: buildPatch(response),
      });
      finalDraft = updateWorldDraft(draft, uid, input, now);
      transaction.set(draftRef, omitDocumentId(finalDraft));
    }
    const turn = worldCreativeTurnSchema.parse({
      id: randomUUID(),
      mode: request.mode,
      prompt: request.prompt,
      response,
      createdAt: timestamp,
    });
    const updatedSession = worldCreativeSessionSchema.parse({
      ...session,
      turnCount: session.turnCount + 1,
      turns: [...session.turns, turn],
      inFlight: false,
      inFlightStartedAt: null,
      updatedAt: timestamp,
    });
    transaction.set(sessionRef, omitDocumentId(updatedSession));
    return { session: updatedSession, draft: finalDraft, response };
  });
}

export async function getWorldCreativeSession(
  worldId: string,
  uid: string,
): Promise<WorldCreativeSession | null> {
  const db = adminDb();
  const [draftSnapshot, sessionSnapshot] = await db.getAll(
    db.collection("worldDrafts").doc(worldId),
    db.collection("worldCreativeSessions").doc(worldId),
  );
  if (!draftSnapshot?.exists) {
    throw new DomainError("NOT_FOUND", "This world does not exist.");
  }
  const draft = worldDraftSchema.parse({
    id: draftSnapshot.id,
    ...draftSnapshot.data(),
  });
  if (draft.creatorId !== uid) {
    throw new DomainError("FORBIDDEN", "You do not own this world.");
  }
  if (!sessionSnapshot?.exists) return null;
  const session = worldCreativeSessionSchema.parse({
    id: sessionSnapshot.id,
    ...sessionSnapshot.data(),
  });
  if (session.creatorId !== uid) {
    throw new DomainError("FORBIDDEN", "You do not own this creative session.");
  }
  return session;
}

export async function runWorldCreativeTurn(
  worldId: string,
  uid: string,
  rawRequest: CreativeTurnRequest,
  signal?: AbortSignal,
  provider: WorldCreativeProvider = openAiWorldCreativeProvider,
) {
  const request = creativeTurnRequestSchema.parse(rawRequest);
  const lease = await beginWorldTurn(worldId, uid);
  try {
    const response = await provider.generate({
      ...request,
      draft: lease.draft,
      session: lease.session,
      signal,
    });
    return await completeWorldTurn(worldId, uid, request, lease, response);
  } catch (error) {
    await releaseWorldTurn(worldId, uid, lease.startedAt).catch(
      () => undefined,
    );
    if (error instanceof DomainError) throw error;
    console.error(
      JSON.stringify({
        severity: "ERROR",
        event: "world_creative_provider_failed",
        worldId,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    throw new DomainError(
      "PROVIDER_UNAVAILABLE",
      "Creative Partner is temporarily unavailable. Try again.",
      true,
    );
  }
}
