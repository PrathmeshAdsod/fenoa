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
      inputSchema: objectSchema(
        { episodeId: { type: "string", minLength: 1, maxLength: 128 } },
        ["episodeId"],
      ),
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
          episodeId: { type: "string", minLength: 1, maxLength: 128 },
          expectedEpisodeVersion: { type: "integer", minimum: 1 },
          patch: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string", minLength: 1, maxLength: 80 },
              hook: { type: "string", minLength: 1, maxLength: 300 },
              keyBeats: {
                type: "array",
                maxItems: 8,
                items: { type: "string", minLength: 1, maxLength: 300 },
              },
              narrative: { type: "string", maxLength: 7000 },
              effects: { type: "object" },
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
      inputSchema: objectSchema(
        {
          action: { type: "string", enum: ["add", "update", "remove"] },
          expectedBranchVersion: { type: "integer", minimum: 1 },
          constraint: { type: "object" },
          constraintId: { type: "string", minLength: 1, maxLength: 128 },
        },
        ["action", "expectedBranchVersion"],
      ),
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
    modelContext.registerTool(tool, { signal: controller.signal });
  }
  return controller;
}
