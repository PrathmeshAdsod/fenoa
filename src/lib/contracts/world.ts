import { z } from "zod";

import {
  branchStateSchema,
  characterSchema,
  factSchema,
  idSchema,
  relationshipSchema,
} from "@/lib/contracts/domain";

const uniqueIds = <T extends { id: string }>(items: T[]) =>
  new Set(items.map((item) => item.id)).size === items.length;

export const imageAssetSchema = z.object({
  storagePath: z.string().trim().min(1).max(500),
  url: z.string().url().max(2_000),
  alt: z.string().trim().min(1).max(180),
  generatedAt: z.string().datetime(),
});

export const worldArtifactSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    premise: z.string().trim().min(20).max(600),
    genre: z.string().trim().min(2).max(80),
    tone: z.string().trim().min(2).max(160),
    aesthetic: z.string().trim().max(300),
    locations: z.array(z.string().trim().min(1).max(100)).max(6),
    characters: z.array(characterSchema).max(8),
    relationships: z.array(relationshipSchema).max(16),
    facts: z.array(factSchema).max(16),
    storySpark: z
      .string()
      .trim()
      .max(1_200)
      .refine(
        (value) => !value || value.split(/\s+/u).filter(Boolean).length <= 150,
        "Story spark must be 150 words or fewer",
      ),
  })
  .superRefine((artifact, context) => {
    if (!uniqueIds(artifact.characters)) {
      context.addIssue({
        code: "custom",
        path: ["characters"],
        message: "Character IDs must be unique",
      });
    }
    if (!uniqueIds(artifact.relationships)) {
      context.addIssue({
        code: "custom",
        path: ["relationships"],
        message: "Relationship IDs must be unique",
      });
    }
    if (!uniqueIds(artifact.facts)) {
      context.addIssue({
        code: "custom",
        path: ["facts"],
        message: "Fact IDs must be unique",
      });
    }
    const characterIds = new Set(
      artifact.characters.map((character) => character.id),
    );
    for (const [index, relationship] of artifact.relationships.entries()) {
      if (
        relationship.fromCharacterId === relationship.toCharacterId ||
        !characterIds.has(relationship.fromCharacterId) ||
        !characterIds.has(relationship.toCharacterId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["relationships", index],
          message: "Relationships must connect two existing characters",
        });
      }
    }
  });

export const worldDraftSchema = worldArtifactSchema.and(
  z.object({
    id: idSchema,
    creatorId: idSchema,
    coverImage: imageAssetSchema.nullable(),
    latestRevisionId: idSchema.nullable(),
    remixEnabled: z.boolean(),
    version: z.number().int().positive(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
);

export const worldRevisionSchema = worldArtifactSchema.and(
  z.object({
    id: idSchema,
    worldId: idSchema,
    creatorId: idSchema,
    revisionNumber: z.number().int().positive(),
    coverImage: imageAssetSchema.nullable(),
    remixEnabled: z.boolean(),
    createdAt: z.string().datetime(),
  }),
);

export const publishedWorldSchema = z.object({
  id: idSchema,
  creatorId: idSchema,
  currentRevisionId: idSchema,
  visibility: z.literal("published"),
  name: worldArtifactSchema.shape.name,
  premise: worldArtifactSchema.shape.premise,
  genre: worldArtifactSchema.shape.genre,
  tone: worldArtifactSchema.shape.tone,
  coverImage: imageAssetSchema.nullable(),
  remixEnabled: z.boolean(),
  remixCount: z.number().int().nonnegative(),
  creatorPickBranchId: idSchema.nullable(),
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const publicProfileSchema = z.object({
  id: idSchema,
  displayName: z.string().trim().min(1).max(80),
  avatarUrl: z.string().url().max(2_000).nullable(),
  bio: z.string().trim().max(240),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const publishedBranchSchema = z.object({
  id: idSchema,
  creatorId: idSchema,
  rootWorldId: idSchema,
  baseWorldRevisionId: idSchema,
  parentBranchId: idSchema.nullable(),
  parentBranchRevisionId: idSchema.nullable(),
  currentRevisionId: idSchema,
  visibility: z.literal("published"),
  title: z.string().trim().min(1).max(120),
  creativeIntent: z.string().trim().min(1).max(600),
  inheritedSummary: z.string().trim().max(1_600),
  episodeCount: z.number().int().min(1).max(8),
  likeCount: z.number().int().nonnegative(),
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const branchRevisionSchema = z.object({
  id: idSchema,
  branchId: idSchema,
  creatorId: idSchema,
  revisionNumber: z.number().int().positive(),
  state: branchStateSchema,
  createdAt: z.string().datetime(),
});

export const likeSchema = z.object({
  id: idSchema,
  branchId: idSchema,
  userId: idSchema,
  createdAt: z.string().datetime(),
});

export type ImageAsset = z.infer<typeof imageAssetSchema>;
export type WorldArtifact = z.infer<typeof worldArtifactSchema>;
export type WorldDraft = z.infer<typeof worldDraftSchema>;
export type WorldRevision = z.infer<typeof worldRevisionSchema>;
export type PublishedWorld = z.infer<typeof publishedWorldSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type PublishedBranch = z.infer<typeof publishedBranchSchema>;
export type BranchRevision = z.infer<typeof branchRevisionSchema>;
