import {
  addBranchCharacterInputSchema,
  moveEpisodeInputSchema,
  setConstraintInputSchema,
  updateBranchRuleInputSchema,
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

export const branchCharacterInputSchema = objectSchema(
  {
    id: idInputSchema,
    name: { type: "string", minLength: 1, maxLength: 80 },
    role: { type: "string", minLength: 1, maxLength: 120 },
    appearance: { type: "string", maxLength: 400 },
    personality: { type: "string", maxLength: 400 },
    desire: { type: "string", maxLength: 300 },
    fear: { type: "string", maxLength: 300 },
    background: { type: "string", maxLength: 600 },
    currentSituation: { type: "string", maxLength: 400 },
    secret: { type: "string", maxLength: 400 },
  },
  ["id", "name", "role"],
);

export const factInputSchema = objectSchema(
  {
    id: idInputSchema,
    category: {
      type: "string",
      enum: [
        "world_rule",
        "secret",
        "character_knowledge",
        "history",
        "tension",
      ],
    },
    statement: { type: "string", minLength: 1, maxLength: 400 },
    state: { type: "string", enum: ["true", "false", "unresolved"] },
  },
  ["id", "category", "statement", "state"],
);

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

export const updateBranchRuleOperationInputSchema = {
  oneOf: [
    objectSchema(
      {
        action: { const: "upsert" },
        expectedBranchVersion: { type: "integer", minimum: 1 },
        fact: factInputSchema,
      },
      ["action", "expectedBranchVersion", "fact"],
    ),
    objectSchema(
      {
        action: { const: "remove" },
        expectedBranchVersion: { type: "integer", minimum: 1 },
        factId: idInputSchema,
      },
      ["action", "expectedBranchVersion", "factId"],
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
        return textResult(
          await domainClient.getEpisode(
            branchId,
            episodeId,
            context?.signal ?? controller.signal,
          ),
        );
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
    {
      name: "move_episode",
      description:
        "Move one existing episode to a new position in the active branch. This changes sequence only and requires the current branch version from get_branch_state.",
      inputSchema: objectSchema(
        {
          episodeId: idInputSchema,
          toPosition: { type: "integer", minimum: 1, maximum: 8 },
          expectedBranchVersion: { type: "integer", minimum: 1 },
        },
        ["episodeId", "toPosition", "expectedBranchVersion"],
      ),
      async execute(input, context) {
        const parsed = moveEpisodeInputSchema.parse({
          ...input,
          actorType: "webmcp_agent",
        });
        return textResult(
          await domainClient.moveEpisode(
            branchId,
            parsed,
            context?.signal ?? controller.signal,
          ),
        );
      },
    },
    {
      name: "add_branch_character",
      description:
        "Add one branch-only character without changing the inherited world cast. Requires the current branch version from get_branch_state.",
      inputSchema: objectSchema(
        {
          expectedBranchVersion: { type: "integer", minimum: 1 },
          character: branchCharacterInputSchema,
        },
        ["expectedBranchVersion", "character"],
      ),
      async execute(input, context) {
        const parsed = addBranchCharacterInputSchema.parse({
          ...input,
          actorType: "webmcp_agent",
        });
        return textResult(
          await domainClient.addBranchCharacter(
            branchId,
            parsed,
            context?.signal ?? controller.signal,
          ),
        );
      },
    },
    {
      name: "update_branch_rule",
      description:
        "Upsert or remove one branch-only fact or rule override. This never changes the inherited world and the domain layer enforces locked constraints.",
      inputSchema: updateBranchRuleOperationInputSchema,
      async execute(input, context) {
        const parsed = updateBranchRuleInputSchema.parse({
          ...input,
          actorType: "webmcp_agent",
        });
        return textResult(
          await domainClient.updateBranchRule(
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
