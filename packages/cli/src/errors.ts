export const EXIT_CODES = {
  success: 0,
  usage: 2,
  notFound: 3,
  conflict: 4,
  validation: 5,
  stale: 6,
  authorization: 7,
  internal: 10,
} as const;

export type ApexErrorCode =
  | "APEX_USAGE"
  | "APEX_NOT_FOUND"
  | "APEX_CONFLICT"
  | "APEX_VALIDATION"
  | "APEX_STALE"
  | "APEX_AUTHORIZATION"
  | "APEX_INTERNAL";

export class ApexError extends Error {
  constructor(
    readonly code: ApexErrorCode,
    message: string,
    readonly exitCode: number,
    readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApexError";
  }
}

export function normalizeError(error: unknown): ApexError {
  if (error instanceof ApexError) return error;
  if (error instanceof Error && /expired|stale/i.test(error.message)) {
    return new ApexError("APEX_STALE", error.message, EXIT_CODES.stale, undefined, { cause: error });
  }
  if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
    return new ApexError("APEX_NOT_FOUND", error.message, EXIT_CODES.notFound, undefined, { cause: error });
  }
  return new ApexError(
    "APEX_INTERNAL",
    error instanceof Error ? error.message : String(error),
    EXIT_CODES.internal,
    undefined,
    { cause: error },
  );
}
