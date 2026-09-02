import {
  setConstraintInputSchema,
  updateEpisodeInputSchema,
} from "@/lib/contracts/api";
import { compactBranchState } from "@/lib/domain/branch-state";
import { domainClient } from "@/lib/client/domain-client";
import type { WebMcpResult, WebMcpTool } from "@/lib/webmcp/types";

const textResult = (value: unknown): WebMcpResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({ type: "object", additionalProperties: false, properties, required });

const idInputSchema = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[a-zA-Z0-9_-]+$",
};
const relationshipKindInputSchema = {
  type: "string",
  enum: [
    "trust",
    "loyalty",
    "rivalry",
    "protection",
    "fear",
    "romance",
    "family",
    "deception",
    "asymmetric_knowledge",
  ],
};
const idArrayInputSchema = {
  type: "array",
  maxItems: 20,
  items: idInputSchema,
};

export const episodeEffectsInputSchema = objectSchema(
  {
    participantIds: idArrayInputSchema,
    revealedFactIds: idArrayInputSchema,
    resolvedFactIds: idArrayInputSchema,
    relationshipChanges: {
      type: "array",
      maxItems: 20,
      items: objectSchema(
        {
          relationshipId: idInputSchema,
          kind: relationshipKindInputSchema,
        },
        ["relationshipId", "kind"],
      ),
    },
    ruleChanges: {
      type: "array",
      maxItems: 20,
      items: objectSchema(
        {
          factId: idInputSchema,
          state: { type: "string", enum: ["true", "false", "unresolved"] },
        },
        ["factId", "state"],
      ),
    },
  },
  [
    "participantIds",
    "revealedFactIds",
    "resolvedFactIds",
    "relationshipChanges",
    "ruleChanges",
  ],
);

const constraintBaseProperties = {
  id: idInputSchema,
  label: { type: "string", minLength: 1, maxLength: 160 },
  description: { type: "string", minLength: 1, maxLength: 400 },
};
const constraintBaseRequired = ["id", "type", "label", "description"];

export const storyConstraintInputSchema = {
  oneOf: [
    objectSchema(
      {
        ...constraintBaseProperties,
        type: { const: "knowledge_lock" },
        characterId: idInputSchema,
        factId: idInputSchema,
        throughEpisode: { type: "integer", minimum: 1, maximum: 8 },
      },
      [...constraintBaseRequired, "characterId", "factId"],
    ),
    objectSchema(
      {
        ...constraintBaseProperties,
        type: { const: "character_availability" },
        characterId: idInputSchema,
        availableFromEpisode: { type: "integer", minimum: 1, maximum: 8 },
      },
      [...constraintBaseRequired, "characterId", "availableFromEpisode"],
    ),
    objectSchema(
      {
        ...constraintBaseProperties,
        type: { const: "fact_state_lock" },
        factId: idInputSchema,
        requiredState: {
          type: "string",
          enum: ["true", "false", "unresolved"],
        },
        throughEpisode: { type: "integer", minimum: 1, maximum: 8 },
      },
      [...constraintBaseRequired, "factId", "requiredState"],
    ),
    objectSchema(
      {
        ...constraintBaseProperties,
        type: { const: "relationship_lock" },
        relationshipId: idInputSchema,
        requiredKind: relationshipKindInputSchema,
        throughEpisode: { type: "integer", minimum: 1, maximum: 8 },
      },
      [...constraintBaseRequired, "relationshipId", "requiredKind"],
    ),
    objectSchema(
      {
        ...constraintBaseProperties,
        type: { const: "branch_fact_lock" },
        factId: idInputSchema,
        statement: { type: "string", minLength: 1, maxLength: 400 },
      },
      [...constraintBaseRequired, "factId", "statement"],
    ),
  ],
};

export const setConstraintOperationInputSchema = {
  oneOf: [
    objectSchema(
      {
        action: { const: "add" },
        expectedBranchVersion: { type: "integer", minimum: 1 },
        constraint: storyConstraintInputSchema,
      },
      ["action", "expectedBranchVersion", "constraint"],
    ),
    objectSchema(
      {
        action: { const: "update" },
        expectedBranchVersion: { type: "integer", minimum: 1 },
        constraint: storyConstraintInputSchema,
      },
      ["action", "expectedBranchVersion", "constraint"],
    ),
    objectSchema(
      {
        action: { const: "remove" },
        expectedBranchVersion: { type: "integer", minimum: 1 },
        constraintId: idInputSchema,
      },
      ["action", "expectedBranchVersion", "constraintId"],
    ),
  ],
};

export function registerStudioTools(branchId: string): AbortController {
  const controller = new AbortController();
  const modelContext = document.modelContext;
  if (!modelContext) return controller;

  const tools: WebMcpTool[] = [
    {
      name: "get_branch_state",
      description:
        "Read the compact current semantic state of the active Fenoa remix branch. Episode narrative is intentionally omitted; call get_episode for focused content.",
      inputSchema: objectSchema({}),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(_input, context) {
        const state = await domainClient.getBranchState(
          branchId,
          context?.signal ?? controller.signal,
        );
        return textResult(compactBranchState(state));
      },
    },
    {
      name: "get_episode",
      description:
        "Read one bounded episode, its declared story effects, relevant branch locks, and its current version before semantically rewriting it.",
      inputSchema: objectSchema({ episodeId: idInputSchema }, ["episodeId"]),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input, context) {
        const episodeId = String(input.episodeId ?? "");
        const [episode, state] = await Promise.all([
          domainClient.getEpisode(
            branchId,
            episodeId,
            context?.signal ?? controller.signal,
          ),
          domainClient.getBranchState(
            branchId,
            context?.signal ?? controller.signal,
          ),
        ]);
        return textResult({
          episode,
          relevantConstraints: state.branch.constraints,
        });
      },
    },
    {
      name: "update_episode",
      description:
        "Update selected content fields and the complete structured effects of one episode. This does not reorder episodes and requires the version returned by get_episode.",
      inputSchema: objectSchema(
        {
          episodeId: idInputSchema,
          expectedEpisodeVersion: { type: "integer", minimum: 1 },
          patch: {
            type: "object",
            additionalProperties: false,
            minProperties: 1,
            properties: {
              title: { type: "string", minLength: 1, maxLength: 80 },
              hook: { type: "string", minLength: 1, maxLength: 300 },
              keyBeats: {
                type: "array",
                maxItems: 8,
                items: { type: "string", minLength: 1, maxLength: 300 },
              },
              narrative: { type: "string", maxLength: 7000 },
              effects: episodeEffectsInputSchema,
            },
          },
        },
        ["episodeId", "expectedEpisodeVersion", "patch"],
      ),
      async execute(input, context) {
        const episodeId = String(input.episodeId ?? "");
        const parsed = updateEpisodeInputSchema.parse({
          expectedEpisodeVersion: input.expectedEpisodeVersion,
          patch: input.patch,
          actorType: "webmcp_agent",
        });
        return textResult(
          await domainClient.updateEpisode(
            branchId,
            episodeId,
            parsed,
            context?.signal ?? controller.signal,
          ),
        );
      },
    },
    {
      name: "set_story_constraint",
      description:
        "Add, update, or remove one typed story lock in the active remix branch. The authoritative domain layer rejects conflicting or stale changes.",
      inputSchema: setConstraintOperationInputSchema,
      async execute(input, context) {
        const parsed = setConstraintInputSchema.parse({
          ...input,
          actorType: "webmcp_agent",
        });
        return textResult(
          await domainClient.setConstraint(
            branchId,
            parsed,
            context?.signal ?? controller.signal,
          ),
        );
      },
    },
  ];

  for (const tool of tools) {
    void modelContext
      .registerTool(tool, { signal: controller.signal })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(
          JSON.stringify({
            severity: "ERROR",
            event: "webmcp_tool_registration_failed",
            tool: tool.name,
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        );
      });
  }
  return controller;
}
