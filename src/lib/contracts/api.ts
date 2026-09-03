import { z } from "zod";

import {
  characterSchema,
  episodeEffectsSchema,
  factSchema,
  idSchema,
  storyConstraintSchema,
} from "@/lib/contracts/domain";
import { imageAssetSchema, worldArtifactSchema } from "@/lib/contracts/world";

export const mutationActorSchema = z.enum([
  "human",
  "webmcp_agent",
  "creative_engine",
]);

export const updateEpisodeInputSchema = z.object({
  expectedEpisodeVersion: z.number().int().positive(),
  actorType: mutationActorSchema.default("human"),
  patch: z
    .object({
      title: z.string().trim().min(1).max(80).optional(),
      hook: z.string().trim().min(1).max(300).optional(),
      keyBeats: z.array(z.string().trim().min(1).max(300)).max(8).optional(),
      narrative: z.string().trim().max(7000).optional(),
      effects: episodeEffectsSchema.optional(),
    })
    .refine((patch) => Object.keys(patch).length > 0, "No changes supplied")
    .refine(
      (patch) => !patch.narrative || patch.effects !== undefined,
      "Narrative rewrites must include complete structured effects",
    ),
});

export const setConstraintInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    expectedBranchVersion: z.number().int().positive(),
    actorType: mutationActorSchema.default("human"),
    constraint: storyConstraintSchema,
  }),
  z.object({
    action: z.literal("update"),
    expectedBranchVersion: z.number().int().positive(),
    actorType: mutationActorSchema.default("human"),
    constraint: storyConstraintSchema,
  }),
  z.object({
    action: z.literal("remove"),
    expectedBranchVersion: z.number().int().positive(),
    actorType: mutationActorSchema.default("human"),
    constraintId: z.string().min(1).max(128),
  }),
]);

export const moveEpisodeInputSchema = z.object({
  episodeId: z.string().min(1).max(128),
  toPosition: z.number().int().min(1).max(8),
  expectedBranchVersion: z.number().int().positive(),
  actorType: mutationActorSchema.default("human"),
});

export const addBranchCharacterInputSchema = z.object({
  expectedBranchVersion: z.number().int().positive(),
  character: characterSchema,
  actorType: mutationActorSchema.default("human"),
});

export const updateBranchRuleInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upsert"),
    expectedBranchVersion: z.number().int().positive(),
    fact: factSchema,
    actorType: mutationActorSchema.default("human"),
  }),
  z.object({
    action: z.literal("remove"),
    expectedBranchVersion: z.number().int().positive(),
    factId: z.string().min(1).max(128),
    actorType: mutationActorSchema.default("human"),
  }),
]);

export const addEpisodeInputSchema = z.object({
  expectedBranchVersion: z.number().int().positive(),
  position: z.number().int().min(1).max(8),
  title: z.string().trim().min(1).max(80),
  hook: z.string().trim().min(1).max(300),
  actorType: z.literal("human").default("human"),
});

export const deleteEpisodeInputSchema = z.object({
  expectedBranchVersion: z.number().int().positive(),
  episodeId: z.string().min(1).max(128),
  actorType: z.literal("human").default("human"),
});

export const undoAgentActionInputSchema = z.object({
  activityId: z.string().min(1).max(128),
  expectedBranchVersion: z.number().int().positive(),
});

export const createWorldInputSchema = z.object({
  name: worldArtifactSchema.shape.name,
  premise: worldArtifactSchema.shape.premise,
  genre: worldArtifactSchema.shape.genre,
  tone: worldArtifactSchema.shape.tone,
});

export const worldDraftPatchSchema = z
  .object({
    name: worldArtifactSchema.shape.name.optional(),
    premise: worldArtifactSchema.shape.premise.optional(),
    genre: worldArtifactSchema.shape.genre.optional(),
    tone: worldArtifactSchema.shape.tone.optional(),
    aesthetic: worldArtifactSchema.shape.aesthetic.optional(),
    locations: worldArtifactSchema.shape.locations.optional(),
    characters: worldArtifactSchema.shape.characters.optional(),
    relationships: worldArtifactSchema.shape.relationships.optional(),
    facts: worldArtifactSchema.shape.facts.optional(),
    storySpark: worldArtifactSchema.shape.storySpark.optional(),
    remixEnabled: z.boolean().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, "No changes supplied");

export const updateWorldInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  patch: worldDraftPatchSchema,
});

export const publishWorldInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const generateWorldImageInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  direction: z.string().trim().max(500).default(""),
});

export const startRemixInputSchema = z.object({
  sourceType: z.enum(["world", "branch"]),
  sourceId: idSchema,
  title: z.string().trim().min(2).max(120),
  creativeIntent: z.string().trim().min(10).max(600),
});

export const publishBranchInputSchema = z.object({
  expectedBranchVersion: z.number().int().positive(),
});

export const likeBranchInputSchema = z.object({
  liked: z.boolean(),
});

export const creatorPickInputSchema = z.object({
  branchId: idSchema.nullable(),
});

export const updateProfileInputSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(240),
});

export const reportContentInputSchema = z.object({
  targetType: z.enum(["world", "branch"]),
  targetId: idSchema,
  reason: z.enum(["harassment", "hate", "sexual", "violence", "spam", "other"]),
  detail: z.string().trim().max(500).default(""),
});

export const persistImagePatchSchema = z.object({
  expectedVersion: z.number().int().positive(),
  coverImage: imageAssetSchema,
});

export type UpdateEpisodeInput = z.infer<typeof updateEpisodeInputSchema>;
export type SetConstraintInput = z.infer<typeof setConstraintInputSchema>;
export type MoveEpisodeInput = z.infer<typeof moveEpisodeInputSchema>;
export type AddBranchCharacterInput = z.infer<
  typeof addBranchCharacterInputSchema
>;
export type UpdateBranchRuleInput = z.infer<typeof updateBranchRuleInputSchema>;
export type AddEpisodeInput = z.infer<typeof addEpisodeInputSchema>;
export type DeleteEpisodeInput = z.infer<typeof deleteEpisodeInputSchema>;
export type CreateWorldInput = z.infer<typeof createWorldInputSchema>;
export type UpdateWorldInput = z.infer<typeof updateWorldInputSchema>;
export type StartRemixInput = z.infer<typeof startRemixInputSchema>;
export type ReportContentInput = z.infer<typeof reportContentInputSchema>;

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "STALE_VERSION"
  | "CONSTRAINT_VIOLATION"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "INTERNAL";

export type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | {
      ok: false;
      error: {
        code: ApiErrorCode;
        message: string;
        requestId: string;
        retryable: boolean;
        fieldErrors?: Record<string, string>;
      };
    };
