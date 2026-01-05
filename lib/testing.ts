export function getTestUserId(req: Request): string | undefined {
  if (process.env.NODE_ENV !== "test") return undefined;
  const id = req.headers.get("x-test-user-id");
  if (!id) return undefined;
  const trimmed = id.trim();
  return trimmed.length ? trimmed : undefined;
}
