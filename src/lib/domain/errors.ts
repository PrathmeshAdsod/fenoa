import type { ApiErrorCode } from "@/lib/contracts/api";

export class DomainError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
