import OpenAI from "openai";

import { DomainError } from "@/lib/domain/errors";

export function creativeModel(): string {
  return process.env.OPENAI_CREATIVE_MODEL?.trim() || "gpt-5.6-terra";
}

export function creativeReasoning(): "low" | "medium" | "high" {
  const configured = process.env.OPENAI_CREATIVE_REASONING?.trim();
  return configured === "low" || configured === "high" ? configured : "medium";
}

export function creativeOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new DomainError(
      "PROVIDER_UNAVAILABLE",
      "Creative Partner is not connected yet. Add the OpenAI API secret to continue.",
      true,
    );
  }
  return new OpenAI({ apiKey, maxRetries: 1, timeout: 45_000 });
}
