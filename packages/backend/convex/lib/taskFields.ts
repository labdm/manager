export const TITLE_MAX = 200;

export function normalizeTitle(input: string): string {
  const title = input.trim();
  if (!title || title.length > TITLE_MAX) throw new Error("Title is required");
  return title;
}

export function assertDueAt(dueAt: number | undefined): void {
  if (dueAt !== undefined && !Number.isSafeInteger(dueAt)) {
    throw new Error("Invalid dueAt");
  }
}
