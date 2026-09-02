import { z } from "zod";

import {
  characterSchema,
  episodeEffectsSchema,
  factSchema,
  storyConstraintSchema,
} from "@/lib/contracts/domain";

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
  actorType: mutationActorSchema.default("human"),
});

export const deleteEpisodeInputSchema = z.object({
  expectedBranchVersion: z.number().int().positive(),
  episodeId: z.string().min(1).max(128),
  actorType: mutationActorSchema.default("human"),
});

export const undoAgentActionInputSchema = z.object({
  activityId: z.string().min(1).max(128),
  expectedBranchVersion: z.number().int().positive(),
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
