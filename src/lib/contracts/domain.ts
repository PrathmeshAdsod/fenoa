import { z } from "zod";

export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const characterSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(120),
  appearance: z.string().trim().max(400).default(""),
  personality: z.string().trim().max(400).default(""),
  desire: z.string().trim().max(300).default(""),
  fear: z.string().trim().max(300).default(""),
  background: z.string().trim().max(600).default(""),
  currentSituation: z.string().trim().max(400).default(""),
  secret: z.string().trim().max(400).default(""),
});

export const relationshipSchema = z.object({
  id: idSchema,
  fromCharacterId: idSchema,
  toCharacterId: idSchema,
  kind: z.enum([
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
  description: z.string().trim().min(1).max(300),
});

export const factSchema = z.object({
  id: idSchema,
  category: z.enum([
    "world_rule",
    "secret",
    "character_knowledge",
    "history",
    "tension",
  ]),
  statement: z.string().trim().min(1).max(400),
  state: z.enum(["true", "false", "unresolved"]),
});

const baseConstraintSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(400),
});

export const storyConstraintSchema = z.discriminatedUnion("type", [
  baseConstraintSchema.extend({
    type: z.literal("knowledge_lock"),
    characterId: idSchema,
    factId: idSchema,
    throughEpisode: z.number().int().min(1).max(8).optional(),
  }),
  baseConstraintSchema.extend({
    type: z.literal("character_availability"),
    characterId: idSchema,
    availableFromEpisode: z.number().int().min(1).max(8),
  }),
  baseConstraintSchema.extend({
    type: z.literal("fact_state_lock"),
    factId: idSchema,
    requiredState: z.enum(["true", "false", "unresolved"]),
    throughEpisode: z.number().int().min(1).max(8).optional(),
  }),
  baseConstraintSchema.extend({
    type: z.literal("relationship_lock"),
    relationshipId: idSchema,
    requiredKind: relationshipSchema.shape.kind,
    throughEpisode: z.number().int().min(1).max(8).optional(),
  }),
  baseConstraintSchema.extend({
    type: z.literal("branch_fact_lock"),
    factId: idSchema,
    statement: z.string().trim().min(1).max(400),
  }),
]);

export const episodeEffectsSchema = z.object({
  participantIds: z.array(idSchema).max(20).default([]),
  revealedFactIds: z.array(idSchema).max(20).default([]),
  resolvedFactIds: z.array(idSchema).max(20).default([]),
  relationshipChanges: z
    .array(
      z.object({
        relationshipId: idSchema,
        kind: relationshipSchema.shape.kind,
      }),
    )
    .max(20)
    .default([]),
  ruleChanges: z
    .array(z.object({ factId: idSchema, state: factSchema.shape.state }))
    .max(20)
    .default([]),
});

export const episodeSchema = z.object({
  id: idSchema,
  branchId: idSchema,
  position: z.number().int().min(1).max(8),
  title: z.string().trim().min(1).max(80),
  hook: z.string().trim().min(1).max(300),
  keyBeats: z.array(z.string().trim().min(1).max(300)).max(8),
  narrative: z.string().trim().max(7000),
  effects: episodeEffectsSchema,
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});

export const branchDraftSchema = z.object({
  id: idSchema,
  creatorId: idSchema,
  rootWorldId: idSchema,
  baseWorldRevisionId: idSchema,
  parentBranchId: idSchema.optional(),
  parentBranchRevisionId: idSchema.optional(),
  title: z.string().trim().min(1).max(120),
  creativeIntent: z.string().trim().min(1).max(600),
  inheritedSummary: z.string().trim().max(1600),
  addedCharacters: z.array(characterSchema).max(12).default([]),
  ruleOverrides: z.array(factSchema).max(20).default([]),
  constraints: z.array(storyConstraintSchema).max(24).default([]),
  recentActivity: z
    .array(
      z.object({
        id: idSchema,
        actorType: z.enum(["human", "webmcp_agent", "creative_engine"]),
        summary: z.string().trim().min(1).max(200),
        createdAt: z.string().datetime(),
      }),
    )
    .max(5)
    .default([]),
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});

export const branchStateSchema = z.object({
  branch: branchDraftSchema,
  episodes: z.array(episodeSchema).max(8),
});

export type Character = z.infer<typeof characterSchema>;
export type Fact = z.infer<typeof factSchema>;
export type StoryConstraint = z.infer<typeof storyConstraintSchema>;
export type Episode = z.infer<typeof episodeSchema>;
export type BranchDraft = z.infer<typeof branchDraftSchema>;
export type BranchState = z.infer<typeof branchStateSchema>;
