import { DomainError } from "@/lib/domain/errors";

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  let parsedOrigin: string | null = null;
  try {
    parsedOrigin = origin ? new URL(origin).origin : null;
  } catch {
    parsedOrigin = null;
  }

  const configuredOrigin = process.env.FENOA_PUBLIC_ORIGIN;
  const expectedOrigins = new Set<string>();
  try {
    expectedOrigins.add(
      configuredOrigin
        ? new URL(configuredOrigin).origin
        : new URL(request.url).origin,
    );
  } catch {
    throw new DomainError(
      "INTERNAL",
      "The public application origin is invalid.",
    );
  }

  if (!configuredOrigin && process.env.NODE_ENV !== "production") {
    const host = request.headers.get("host");
    if (host) {
      expectedOrigins.add(`${new URL(request.url).protocol}//${host}`);
    }
  }

  if (!parsedOrigin || !expectedOrigins.has(parsedOrigin)) {
    throw new DomainError("FORBIDDEN", "The request origin is invalid.");
  }
}
