import { randomUUID } from "node:crypto";

import {
  creativeSessionSchema,
  creativeTurnRequestSchema,
  creativeTurnSchema,
  type CreativeSession,
  type CreativeTurnRequest,
} from "@/lib/contracts/creative";
import { branchDraftSchema, branchStateSchema } from "@/lib/contracts/domain";
import { applyCreativeBuild } from "@/lib/domain/creative-operations";
import { DomainError } from "@/lib/domain/errors";
import {
  lastAgentAction,
  makeActivityDocument,
  makeBranchActivity,
  readBranchAndEpisodes,
} from "@/lib/server/branch-repository";
import {
  openAiCreativeProvider,
  type CreativeProvider,
} from "@/lib/server/creative-provider";
import { adminDb } from "@/lib/server/firebase-admin";
import { reserveCreativeUsage } from "@/lib/server/creative-usage";

const SESSION_TURN_CAP = 12;
const IN_FLIGHT_TTL_MS = 2 * 60 * 1_000;

type TurnLease = {
  session: CreativeSession;
  state: Awaited<ReturnType<typeof readBranchAndEpisodes>>;
  startedAt: string;
};

function emptySession(
  branchId: string,
  creatorId: string,
  now: string,
): CreativeSession {
  return creativeSessionSchema.parse({
    id: branchId,
    branchId,
    creatorId,
    turnCount: 0,
    turns: [],
    inFlight: false,
    inFlightStartedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function beginCreativeTurn(
  branchId: string,
  uid: string,
): Promise<TurnLease> {
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const sessionRef = db.collection("creativeSessions").doc(branchId);
  const nowDate = new Date();
  const now = nowDate.toISOString();

  return db.runTransaction(async (transaction) => {
    const state = await readBranchAndEpisodes(transaction, branchRef, uid);
    const sessionSnapshot = await transaction.get(sessionRef);
    const session = sessionSnapshot.exists
      ? creativeSessionSchema.parse({
          id: sessionSnapshot.id,
          ...sessionSnapshot.data(),
        })
      : emptySession(branchId, uid, now);
    if (session.creatorId !== uid || session.branchId !== branchId) {
      throw new DomainError(
        "FORBIDDEN",
        "You do not own this creative session.",
      );
    }
    if (session.turnCount >= SESSION_TURN_CAP) {
      throw new DomainError(
        "RATE_LIMITED",
        "This collaboration reached its 12-turn safety cap. Continue shaping the branch directly.",
      );
    }
    const inFlightAge = session.inFlightStartedAt
      ? nowDate.getTime() - new Date(session.inFlightStartedAt).getTime()
      : Number.POSITIVE_INFINITY;
    if (session.inFlight && inFlightAge < IN_FLIGHT_TTL_MS) {
      throw new DomainError(
        "RATE_LIMITED",
        "Creative Partner is already shaping a response for this branch.",
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
    return { session, state, startedAt: now };
  });
}

async function releaseCreativeTurn(
  branchId: string,
  uid: string,
  startedAt: string,
): Promise<void> {
  const db = adminDb();
  const sessionRef = db.collection("creativeSessions").doc(branchId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef);
    if (!snapshot.exists) return;
    const session = creativeSessionSchema.parse({
      id: snapshot.id,
      ...snapshot.data(),
    });
    if (
      session.creatorId === uid &&
      session.inFlight &&
      session.inFlightStartedAt === startedAt
    ) {
      transaction.update(sessionRef, {
        inFlight: false,
        inFlightStartedAt: null,
        updatedAt: new Date().toISOString(),
      });
    }
  });
}

async function completeCreativeTurn(
  branchId: string,
  uid: string,
  request: CreativeTurnRequest,
  lease: TurnLease,
  response: Awaited<ReturnType<CreativeProvider["generate"]>>,
) {
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const sessionRef = db.collection("creativeSessions").doc(branchId);
  const activityRef = branchRef.collection("activities").doc();
  const now = new Date();
  const timestamp = now.toISOString();

  return db.runTransaction(async (transaction) => {
    const state = await readBranchAndEpisodes(transaction, branchRef, uid);
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists) {
      throw new DomainError("INTERNAL", "Creative session state is missing.");
    }
    const session = creativeSessionSchema.parse({
      id: sessionSnapshot.id,
      ...sessionSnapshot.data(),
    });
    if (
      session.creatorId !== uid ||
      !session.inFlight ||
      session.inFlightStartedAt !== lease.startedAt ||
      session.turnCount !== lease.session.turnCount
    ) {
      throw new DomainError(
        "STALE_VERSION",
        "The creative session changed before this response could be saved.",
        true,
      );
    }
    const leaseVersions = new Map(
      lease.state.episodes.map((episode) => [episode.id, episode.version]),
    );
    if (
      state.branch.version !== lease.state.branch.version ||
      state.episodes.length !== lease.state.episodes.length ||
      state.episodes.some(
        (episode) => leaseVersions.get(episode.id) !== episode.version,
      )
    ) {
      throw new DomainError(
        "STALE_VERSION",
        "The branch changed while Creative Partner was responding. Try again with the current state.",
        true,
      );
    }

    let finalState = state;
    if (response.mode === "BUILD") {
      const built = applyCreativeBuild(state, response, now);
      const changedAfter = built.state.episodes.filter((episode) =>
        built.changedBefore.some((before) => before.id === episode.id),
      );
      const activity = makeBranchActivity(
        activityRef.id,
        "creative_engine",
        `Built: ${response.message.slice(0, 185)}`,
        built.targetIds,
        timestamp,
      );
      const branch = branchDraftSchema.parse({
        ...built.state.branch,
        recentActivity: [activity, ...state.branch.recentActivity].slice(0, 5),
        lastAgentAction: lastAgentAction(activity),
      });
      for (const episode of changedAfter) {
        transaction.set(
          branchRef.collection("episodes").doc(episode.id),
          episode,
        );
      }
      transaction.update(branchRef, {
        addedCharacters: branch.addedCharacters,
        ruleOverrides: branch.ruleOverrides,
        constraints: branch.constraints,
        version: branch.version,
        updatedAt: branch.updatedAt,
        recentActivity: branch.recentActivity,
        lastAgentAction: branch.lastAgentAction,
      });
      transaction.set(
        activityRef,
        makeActivityDocument(
          activity,
          "creative_build",
          state.branch,
          branch,
          built.changedBefore,
          changedAfter,
        ),
      );
      finalState = branchStateSchema.parse({
        branch,
        episodes: built.state.episodes,
      });
    }

    const turn = creativeTurnSchema.parse({
      id: randomUUID(),
      mode: request.mode,
      prompt: request.prompt,
      response,
      createdAt: timestamp,
    });
    const updatedSession = creativeSessionSchema.parse({
      ...session,
      turnCount: session.turnCount + 1,
      turns: [...session.turns, turn],
      inFlight: false,
      inFlightStartedAt: null,
      updatedAt: timestamp,
    });
    transaction.set(sessionRef, updatedSession);
    return { session: updatedSession, state: finalState, response };
  });
}

export async function getCreativeSession(
  branchId: string,
  uid: string,
): Promise<CreativeSession | null> {
  const db = adminDb();
  const branchRef = db.collection("branchDrafts").doc(branchId);
  const sessionRef = db.collection("creativeSessions").doc(branchId);
  return db.runTransaction(async (transaction) => {
    const [branch, session] = await transaction.getAll(branchRef, sessionRef);
    if (!branch?.exists) {
      throw new DomainError("NOT_FOUND", "This branch does not exist.");
    }
    const parsedBranch = branchDraftSchema.parse({
      id: branch.id,
      ...branch.data(),
    });
    if (parsedBranch.creatorId !== uid) {
      throw new DomainError("FORBIDDEN", "You do not own this branch.");
    }
    if (!session?.exists) return null;
    const parsed = creativeSessionSchema.parse({
      id: session.id,
      ...session.data(),
    });
    if (parsed.creatorId !== uid) {
      throw new DomainError(
        "FORBIDDEN",
        "You do not own this creative session.",
      );
    }
    return parsed;
  });
}

export async function runCreativeTurn(
  branchId: string,
  uid: string,
  rawRequest: CreativeTurnRequest,
  signal?: AbortSignal,
  provider: CreativeProvider = openAiCreativeProvider,
) {
  const request = creativeTurnRequestSchema.parse(rawRequest);
  const lease = await beginCreativeTurn(branchId, uid);
  try {
    const response = await provider.generate({
      ...request,
      state: lease.state,
      session: lease.session,
      signal,
    });
    return await completeCreativeTurn(branchId, uid, request, lease, response);
  } catch (error) {
    await releaseCreativeTurn(branchId, uid, lease.startedAt).catch(
      () => undefined,
    );
    if (error instanceof DomainError) throw error;
    console.error(
      JSON.stringify({
        severity: "ERROR",
        event: "creative_provider_failed",
        branchId,
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
