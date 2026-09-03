import { createHash, randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { getDownloadURL } from "firebase-admin/storage";

import type { ImageAsset } from "@/lib/contracts/world";
import { DomainError } from "@/lib/domain/errors";
import { adminDb, adminStorage } from "@/lib/server/firebase-admin";
import {
  getWorldDraft,
  saveGeneratedCover,
} from "@/lib/server/world-repository";

const IMAGE_USER_DAILY_LIMIT = 8;
const IMAGE_PROJECT_DAILY_LIMIT = 80;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function reserveImageUsage(uid: string, now: Date): Promise<void> {
  const db = adminDb();
  const userKey = createHash("sha256").update(uid).digest("hex").slice(0, 24);
  const day = dayKey(now);
  const buckets = [
    {
      ref: db.collection("usageBuckets").doc(`image-user-${userKey}-${day}`),
      limit: IMAGE_USER_DAILY_LIMIT,
    },
    {
      ref: db.collection("usageBuckets").doc(`image-project-${day}`),
      limit: IMAGE_PROJECT_DAILY_LIMIT,
    },
  ];
  await db.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(
      ...buckets.map((item) => item.ref),
    );
    for (const [index, bucket] of buckets.entries()) {
      const count = snapshots[index]?.exists
        ? Number(snapshots[index]?.data()?.count ?? 0)
        : 0;
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new DomainError("INTERNAL", "Image usage state is invalid.");
      }
      if (count >= bucket.limit) {
        throw new DomainError(
          "RATE_LIMITED",
          "World artwork has reached a temporary generation limit. Try again tomorrow.",
          true,
        );
      }
    }
    for (const [index, bucket] of buckets.entries()) {
      const count = snapshots[index]?.exists
        ? Number(snapshots[index]?.data()?.count ?? 0)
        : 0;
      transaction.set(bucket.ref, {
        count: count + 1,
        limit: bucket.limit,
        period: day,
        updatedAt: now.toISOString(),
      });
    }
  });
}

export async function generateWorldCover(
  worldId: string,
  uid: string,
  input: { expectedVersion: number; direction: string },
  signal?: AbortSignal,
): Promise<{
  draft: Awaited<ReturnType<typeof getWorldDraft>>;
  image: ImageAsset;
}> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!apiKey || !bucketName) {
    throw new DomainError(
      "PROVIDER_UNAVAILABLE",
      "World artwork is not connected yet. Add the Gemini and Storage secrets to continue.",
      true,
    );
  }
  const draft = await getWorldDraft(worldId, uid);
  if (draft.version !== input.expectedVersion) {
    throw new DomainError(
      "STALE_VERSION",
      "The world changed before artwork generation began.",
      true,
    );
  }
  await reserveImageUsage(uid, new Date());
  try {
    const client = new GoogleGenAI({ apiKey });
    const interaction = await client.interactions.create(
      {
        model:
          process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image",
        input: `Create original cinematic key art for a fictional world. No logos, UI, captions, or readable text. Landscape 16:9 composition with a strong focal point and room for editorial typography. World: ${draft.name}. Premise: ${draft.premise}. Genre: ${draft.genre}. Tone: ${draft.tone}. Visual direction: ${draft.aesthetic || "derive an original visual language from the world"}. Additional creator direction: ${input.direction || "none"}.`,
        response_format: {
          type: "image",
          aspect_ratio: "16:9",
          image_size: "1K",
          mime_type: "image/png",
        },
      },
      { signal, timeout: 60_000 },
    );
    const generated = interaction.output_image;
    if (!generated?.data) {
      throw new Error("The provider returned no image data.");
    }
    const bytes = Buffer.from(generated.data, "base64");
    if (bytes.length === 0 || bytes.length > 12 * 1024 * 1024) {
      throw new Error("The provider returned an invalid image size.");
    }
    const contentType = generated.mime_type || "image/png";
    const extension = contentType === "image/jpeg" ? "jpg" : "png";
    const storagePath = `worlds/${worldId}/covers/${randomUUID()}.${extension}`;
    const file = adminStorage().bucket(bucketName).file(storagePath);
    await file.save(bytes, {
      resumable: false,
      validation: "crc32c",
      metadata: {
        contentType,
        cacheControl: "public,max-age=31536000,immutable",
      },
    });
    const image: ImageAsset = {
      storagePath,
      url: await getDownloadURL(file),
      alt: `${draft.name} world artwork`,
      generatedAt: new Date().toISOString(),
    };
    try {
      const updated = await saveGeneratedCover(
        worldId,
        uid,
        input.expectedVersion,
        image,
      );
      return { draft: updated, image };
    } catch (error) {
      await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error(
      JSON.stringify({
        severity: "ERROR",
        event: "world_image_generation_failed",
        worldId,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    throw new DomainError(
      "PROVIDER_UNAVAILABLE",
      "World artwork could not be generated right now. Your canvas is unchanged.",
      true,
    );
  }
}
