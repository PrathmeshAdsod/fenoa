import { z } from "zod";

import {
  episodeEffectsSchema,
  storyConstraintSchema,
} from "@/lib/contracts/domain";

export const updateEpisodeInputSchema = z.object({
  expectedEpisodeVersion: z.number().int().positive(),
  actorType: z.enum(["human", "webmcp_agent"]).default("human"),
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
    actorType: z.enum(["human", "webmcp_agent"]).default("human"),
    constraint: storyConstraintSchema,
  }),
  z.object({
    action: z.literal("update"),
    expectedBranchVersion: z.number().int().positive(),
    actorType: z.enum(["human", "webmcp_agent"]).default("human"),
    constraint: storyConstraintSchema,
  }),
  z.object({
    action: z.literal("remove"),
    expectedBranchVersion: z.number().int().positive(),
    actorType: z.enum(["human", "webmcp_agent"]).default("human"),
    constraintId: z.string().min(1).max(128),
  }),
]);

export type UpdateEpisodeInput = z.infer<typeof updateEpisodeInputSchema>;
export type SetConstraintInput = z.infer<typeof setConstraintInputSchema>;

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
