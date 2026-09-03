import { z } from "zod";

import {
  creativeIdeaSchema,
  creativeModeSchema,
  creativeReadinessSchema,
  creativeTurnRequestSchema,
} from "@/lib/contracts/creative";
import {
  characterSchema,
  factSchema,
  idSchema,
  relationshipSchema,
} from "@/lib/contracts/domain";

const nullableWorldPatchSchema = z.object({
  name: z.string().trim().min(2).max(80).nullable(),
  premise: z.string().trim().min(20).max(600).nullable(),
  genre: z.string().trim().min(2).max(80).nullable(),
  tone: z.string().trim().min(2).max(160).nullable(),
  aesthetic: z.string().trim().max(300).nullable(),
  locations: z.array(z.string().trim().min(1).max(100)).max(6).nullable(),
  characters: z.array(characterSchema).max(8).nullable(),
  relationships: z.array(relationshipSchema).max(16).nullable(),
  facts: z.array(factSchema).max(16).nullable(),
  storySpark: z.string().trim().max(1_200).nullable(),
});

const worldResponseBase = {
  message: z.string().trim().min(1).max(900),
  readiness: creativeReadinessSchema,
  ideas: z.array(creativeIdeaSchema).max(3),
};

const exploration = (
  mode: Exclude<z.infer<typeof creativeModeSchema>, "BUILD">,
) =>
  z.object({
    mode: z.literal(mode),
    ...worldResponseBase,
    patch: z.null(),
  });

export const worldCreativeResponseSchema = z.discriminatedUnion("mode", [
  exploration("ASK"),
  exploration("SUGGEST"),
  exploration("CHALLENGE"),
  exploration("CONNECT"),
  exploration("RESOLVE"),
  z.object({
    mode: z.literal("BUILD"),
    ...worldResponseBase,
    patch: nullableWorldPatchSchema,
  }),
]);

export const worldCreativeResponseEnvelopeSchema = z.object({
  response: worldCreativeResponseSchema,
});

export const worldCreativeTurnSchema = z.object({
  id: idSchema,
  mode: creativeModeSchema,
  prompt: creativeTurnRequestSchema.shape.prompt,
  response: worldCreativeResponseSchema,
  createdAt: z.string().datetime(),
});

export const worldCreativeSessionSchema = z.object({
  id: idSchema,
  worldId: idSchema,
  creatorId: idSchema,
  turnCount: z.number().int().min(0).max(12),
  turns: z.array(worldCreativeTurnSchema).max(12),
  inFlight: z.boolean(),
  inFlightStartedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WorldCreativeResponse = z.infer<typeof worldCreativeResponseSchema>;
export type WorldCreativeSession = z.infer<typeof worldCreativeSessionSchema>;
