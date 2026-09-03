import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createInteraction: vi.fn(),
  deleteFile: vi.fn(),
  getDownloadUrl: vi.fn(),
  getWorldDraft: vi.fn(),
  saveFile: vi.fn(),
  saveGeneratedCover: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create: mocks.createInteraction };
  },
}));

vi.mock("firebase-admin/storage", () => ({
  getDownloadURL: mocks.getDownloadUrl,
}));

vi.mock("@/lib/server/firebase-admin", () => ({
  adminDb: () => ({
    collection: (collection: string) => ({
      doc: (id: string) => ({ collection, id }),
    }),
    runTransaction: async (
      callback: (transaction: {
        getAll: (...references: unknown[]) => Promise<unknown[]>;
        set: (reference: unknown, value: unknown) => void;
      }) => Promise<void>,
    ) =>
      callback({
        getAll: async (...references: unknown[]) =>
          references.map(() => ({ exists: false })),
        set: vi.fn(),
      }),
  }),
  adminStorage: () => ({
    bucket: () => ({
      file: () => ({ save: mocks.saveFile, delete: mocks.deleteFile }),
    }),
  }),
}));

vi.mock("@/lib/server/world-repository", () => ({
  getWorldDraft: mocks.getWorldDraft,
  saveGeneratedCover: mocks.saveGeneratedCover,
}));

import { generateWorldCover } from "@/lib/server/image-service";

const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalStorageBucket = process.env.FIREBASE_STORAGE_BUCKET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.FIREBASE_STORAGE_BUCKET = "test-bucket";
  mocks.getWorldDraft.mockResolvedValue({
    id: "world-1",
    name: "Small Suns",
    premise: "Promises become stars.",
    genre: "Speculative fantasy",
    tone: "Luminous",
    aesthetic: "Dawn over a terraced city",
    version: 1,
  });
  mocks.createInteraction.mockResolvedValue({
    output_image: {
      data: Buffer.from("generated image").toString("base64"),
      mime_type: "image/jpeg",
    },
  });
  mocks.getDownloadUrl.mockResolvedValue("https://storage.example/cover.jpg");
  mocks.saveGeneratedCover.mockImplementation(
    async (
      _worldId: string,
      _uid: string,
      _version: number,
      image: unknown,
    ) => ({ version: 2, image }),
  );
});

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

  it("requests and stores the image format supported by Gemini", async () => {
    const result = await generateWorldCover("world-1", "creator-1", {
      expectedVersion: 1,
      direction: "Keep it cinematic.",
    });

    expect(mocks.createInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: expect.objectContaining({ mime_type: "image/jpeg" }),
      }),
      expect.objectContaining({ timeout: 60_000 }),
    );
    expect(mocks.saveFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        metadata: expect.objectContaining({ contentType: "image/jpeg" }),
      }),
    );
    expect(result.image.storagePath).toMatch(/\.jpg$/);
  });
});
