import { createHash } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

import { DomainError } from "@/lib/domain/errors";

type UsageLimit = {
  id: string;
  period: string;
  limit: number;
  expiresAt: Date;
};

function utcPeriod(date: Date, hourly: boolean): string {
  const iso = date.toISOString();
  return hourly
    ? iso.slice(0, 13).replaceAll("-", "")
    : iso.slice(0, 10).replaceAll("-", "");
}

function usageLimits(uid: string, now: Date): UsageLimit[] {
  const userKey = createHash("sha256").update(uid).digest("hex").slice(0, 24);
  const hour = utcPeriod(now, true);
  const day = utcPeriod(now, false);
  return [
    {
      id: `user-hour-${userKey}-${hour}`,
      period: hour,
      limit: 30,
      expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000),
    },
    {
      id: `user-day-${userKey}-${day}`,
      period: day,
      limit: 100,
      expiresAt: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1_000),
    },
    {
      id: `project-day-${day}`,
      period: day,
      limit: 500,
      expiresAt: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1_000),
    },
  ];
}

export async function reserveCreativeUsage(
  transaction: FirebaseFirestore.Transaction,
  db: Firestore,
  uid: string,
  now: Date,
): Promise<void> {
  const limits = usageLimits(uid, now);
  const refs = limits.map((limit) =>
    db.collection("usageBuckets").doc(limit.id),
  );
  const snapshots = await transaction.getAll(...refs);
  for (const [index, limit] of limits.entries()) {
    const snapshot = snapshots[index];
    const count = snapshot?.exists ? Number(snapshot.data()?.count ?? 0) : 0;
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new DomainError("INTERNAL", "Creative usage state is invalid.");
    }
    if (count >= limit.limit) {
      throw new DomainError(
        "RATE_LIMITED",
        "Creative Partner has reached a temporary usage limit. Try again later.",
        true,
      );
    }
  }
  for (const [index, limit] of limits.entries()) {
    const snapshot = snapshots[index];
    const count = snapshot?.exists ? Number(snapshot.data()?.count ?? 0) : 0;
    transaction.set(refs[index]!, {
      count: count + 1,
      period: limit.period,
      limit: limit.limit,
      updatedAt: now.toISOString(),
      expiresAt: Timestamp.fromDate(limit.expiresAt),
    });
  }
}
