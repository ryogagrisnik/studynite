// lib/server/missedTableGuard.ts
/**
 * Detects Prisma errors that occur when the MissedQuestion table (or its columns)
 * are missing. This happens if the corresponding migration has not been applied yet.
 */
export function isMissedQuestionTableMissing(error: unknown): boolean {
  if (!error) return false;
  const err: any = error;

  const code: string | undefined = typeof err?.code === "string" ? err.code : undefined;
  const metaTarget =
    typeof err?.meta?.target === "string"
      ? err.meta.target
      : typeof err?.meta?.modelName === "string"
      ? err.meta.modelName
      : undefined;

  if (code && (code === "P2021" || code === "P2022")) {
    if (!metaTarget) return true;
    return /MissedQuestion/i.test(metaTarget);
  }

  const message: string =
    typeof err?.message === "string"
      ? err.message
      : Array.isArray(err?.errors) && typeof err.errors[0]?.message === "string"
      ? err.errors[0].message
      : "";

  if (!message) return false;
  return /MissedQuestion/i.test(message) && /does not exist|unknown|invalid/i.test(message);
}
