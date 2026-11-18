export function formatDueAt(dueAt: number | null): string | null {
  if (dueAt === null || !Number.isFinite(dueAt)) return null;
  return new Date(dueAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
