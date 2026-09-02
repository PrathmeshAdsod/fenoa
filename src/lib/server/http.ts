import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { ApiResult } from "@/lib/contracts/api";
import { DomainError } from "@/lib/domain/errors";

export function requestId(): string {
  return crypto.randomUUID();
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new DomainError(
        "INVALID_ARGUMENT",
        "The request body is not valid JSON.",
      );
    }
    throw error;
  }
}

export function ok<T>(data: T, id: string) {
  return NextResponse.json<ApiResult<T>>({ ok: true, data, requestId: id });
}

export function toErrorResponse(error: unknown, id: string) {
  if (error instanceof DomainError) {
    const status =
      error.code === "UNAUTHENTICATED"
        ? 401
        : error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "STALE_VERSION" ||
                error.code === "CONSTRAINT_VIOLATION"
              ? 409
              : error.code === "RATE_LIMITED"
                ? 429
                : 400;
    return NextResponse.json<ApiResult<never>>(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          requestId: id,
          retryable: error.retryable,
        },
      },
      { status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json<ApiResult<never>>(
      {
        ok: false,
        error: {
          code: "INVALID_ARGUMENT",
          message: "The submitted data is invalid.",
          requestId: id,
          retryable: false,
          fieldErrors: Object.fromEntries(
            error.issues.map((issue) => [issue.path.join("."), issue.message]),
          ),
        },
      },
      { status: 400 },
    );
  }

  console.error(JSON.stringify({ severity: "ERROR", requestId: id, error }));
  return NextResponse.json<ApiResult<never>>(
    {
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Something went wrong. Try again.",
        requestId: id,
        retryable: true,
      },
    },
    { status: 500 },
  );
}
