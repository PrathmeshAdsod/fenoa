import { describe, expect, it } from "vitest";

import {
  branchCharacterInputSchema,
  episodeEffectsInputSchema,
  factInputSchema,
  setConstraintOperationInputSchema,
  storyConstraintInputSchema,
  updateBranchRuleOperationInputSchema,
} from "@/lib/webmcp/register-studio-tools";

describe("native WebMCP schemas", () => {
  it("advertises the complete episode-effects contract", () => {
    expect(episodeEffectsInputSchema.required).toEqual([
      "participantIds",
      "revealedFactIds",
      "resolvedFactIds",
      "relationshipChanges",
      "ruleChanges",
    ]);
    expect(episodeEffectsInputSchema.additionalProperties).toBe(false);
  });

  it("advertises constraint operations as the same discriminated unions", () => {
    expect(setConstraintOperationInputSchema.oneOf).toHaveLength(3);
    expect(setConstraintOperationInputSchema.oneOf[0]?.required).toContain(
      "constraint",
    );
    expect(setConstraintOperationInputSchema.oneOf[2]?.required).toContain(
      "constraintId",
    );
    expect(storyConstraintInputSchema.oneOf).toHaveLength(5);
  });

  it("keeps the remaining mutation schemas focused and typed", () => {
    expect(branchCharacterInputSchema.required).toEqual(["id", "name", "role"]);
    expect(factInputSchema.required).toEqual([
      "id",
      "category",
      "statement",
      "state",
    ]);
    expect(updateBranchRuleOperationInputSchema.oneOf).toHaveLength(2);
  });
});
