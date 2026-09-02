import { describe, expect, it } from "vitest";

import {
  episodeEffectsInputSchema,
  setConstraintOperationInputSchema,
  storyConstraintInputSchema,
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
});
