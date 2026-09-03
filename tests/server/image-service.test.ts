import { afterEach, describe, expect, it } from "vitest";

import { generateWorldCover } from "@/lib/server/image-service";

const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalStorageBucket = process.env.FIREBASE_STORAGE_BUCKET;

afterEach(() => {
  if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;

  if (originalStorageBucket === undefined)
    delete process.env.FIREBASE_STORAGE_BUCKET;
  else process.env.FIREBASE_STORAGE_BUCKET = originalStorageBucket;
});

describe("world image generation", () => {
  it("fails visibly before persistence when provider configuration is absent", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.FIREBASE_STORAGE_BUCKET;

    await expect(
      generateWorldCover("world-1", "creator-1", {
        expectedVersion: 1,
        direction: "",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      message: expect.stringContaining("not connected yet"),
    });
  });
});
