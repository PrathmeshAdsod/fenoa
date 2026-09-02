import { z } from "zod";

import {
  episodeEffectsSchema,
  factSchema,
  idSchema,
} from "@/lib/contracts/domain";
import type { BranchState } from "@/lib/contracts/domain";

export const creativeModeSchema = z.enum([
  "ASK",
  "SUGGEST",
  "CHALLENGE",
  "CONNECT",
  "RESOLVE",
  "BUILD",
]);

export const creativeTurnRequestSchema = z.object({
  mode: creativeModeSchema,
  prompt: z.string().trim().max(1200),
});

export const creativeReadinessSchema = z.object({
  readyToBuild: z.boolean(),
  rationale: z.string().trim().min(1).max(280),
});

const ideaCardSchema = z.object({
  title: z.string().trim().min(1).max(100),
  detail: z.string().trim().min(1).max(420),
});

const responseBase = {
  message: z.string().trim().min(1).max(900),
  readiness: creativeReadinessSchema,
  ideas: z.array(ideaCardSchema).max(3),
};

const nullableEpisodePatchSchema = z.object({
  title: z.string().trim().min(1).max(80).nullable(),
  hook: z.string().trim().min(1).max(300).nullable(),
  keyBeats: z.array(z.string().trim().min(1).max(300)).max(8).nullable(),
  narrative: z.string().trim().max(7000).nullable(),
  effects: episodeEffectsSchema.nullable(),
});

const creativeCharacterSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(120),
  appearance: z.string().trim().max(400),
  personality: z.string().trim().max(400),
  desire: z.string().trim().max(300),
  fear: z.string().trim().max(300),
  background: z.string().trim().max(600),
  currentSituation: z.string().trim().max(400),
  secret: z.string().trim().max(400),
});

const creativeConstraintBase = {
  id: idSchema,
  label: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(400),
};

const creativeStoryConstraintSchema = z.discriminatedUnion("type", [
  z.object({
    ...creativeConstraintBase,
    type: z.literal("knowledge_lock"),
    characterId: idSchema,
    factId: idSchema,
    throughEpisode: z.number().int().min(1).max(8).nullable(),
  }),
  z.object({
    ...creativeConstraintBase,
    type: z.literal("character_availability"),
    characterId: idSchema,
    availableFromEpisode: z.number().int().min(1).max(8),
  }),
  z.object({
    ...creativeConstraintBase,
    type: z.literal("fact_state_lock"),
    factId: idSchema,
    requiredState: factSchema.shape.state,
    throughEpisode: z.number().int().min(1).max(8).nullable(),
  }),
  z.object({
    ...creativeConstraintBase,
    type: z.literal("relationship_lock"),
    relationshipId: idSchema,
    requiredKind: z.enum([
      "trust",
      "loyalty",
      "rivalry",
      "protection",
      "fear",
      "romance",
      "family",
      "deception",
      "asymmetric_knowledge",
    ]),
    throughEpisode: z.number().int().min(1).max(8).nullable(),
  }),
  z.object({
    ...creativeConstraintBase,
    type: z.literal("branch_fact_lock"),
    factId: idSchema,
    statement: z.string().trim().min(1).max(400),
  }),
]);

export const creativeBuildOperationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("update_episode"),
    episodeId: idSchema,
    expectedEpisodeVersion: z.number().int().positive(),
    patch: nullableEpisodePatchSchema,
  }),
  z.object({
    operation: z.literal("move_episode"),
    episodeId: idSchema,
    toPosition: z.number().int().min(1).max(8),
  }),
  z.object({
    operation: z.literal("add_branch_character"),
    character: creativeCharacterSchema,
  }),
  z.object({
    operation: z.literal("update_branch_rule"),
    action: z.enum(["upsert", "remove"]),
    fact: factSchema.nullable(),
    factId: idSchema.nullable(),
  }),
  z.object({
    operation: z.literal("set_story_constraint"),
    action: z.enum(["add", "update", "remove"]),
    constraint: creativeStoryConstraintSchema.nullable(),
    constraintId: idSchema.nullable(),
  }),
]);

const explorationResponse = (
  mode: Exclude<z.infer<typeof creativeModeSchema>, "BUILD">,
) =>
  z.object({
    mode: z.literal(mode),
    ...responseBase,
    operations: z.array(creativeBuildOperationSchema).max(0),
  });

export const creativeResponseSchema = z.discriminatedUnion("mode", [
  explorationResponse("ASK"),
  explorationResponse("SUGGEST"),
  explorationResponse("CHALLENGE"),
  explorationResponse("CONNECT"),
  explorationResponse("RESOLVE"),
  z.object({
    mode: z.literal("BUILD"),
    ...responseBase,
    operations: z.array(creativeBuildOperationSchema).min(1).max(4),
  }),
]);

export const creativeResponseEnvelopeSchema = z.object({
  response: creativeResponseSchema,
});

export const creativeTurnSchema = z.object({
  id: idSchema,
  mode: creativeModeSchema,
  prompt: z.string().trim().max(1200),
  response: creativeResponseSchema,
  createdAt: z.string().datetime(),
});

export const creativeSessionSchema = z.object({
  id: idSchema,
  branchId: idSchema,
  creatorId: idSchema,
  turnCount: z.number().int().min(0).max(12),
  turns: z.array(creativeTurnSchema).max(12),
  inFlight: z.boolean(),
  inFlightStartedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreativeMode = z.infer<typeof creativeModeSchema>;
export type CreativeTurnRequest = z.infer<typeof creativeTurnRequestSchema>;
export type CreativeResponse = z.infer<typeof creativeResponseSchema>;
export type CreativeBuildOperation = z.infer<
  typeof creativeBuildOperationSchema
>;
export type CreativeSession = z.infer<typeof creativeSessionSchema>;
export type CreativeTurnResult = {
  session: CreativeSession;
  state: BranchState;
  response: CreativeResponse;
};
