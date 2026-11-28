export type MeterState = "done" | "waiting" | "open";

export type MeterSegment = {
  id: string;
  state: MeterState;
};

/** One segment per task. Messages and other rows are not progress. Waiting still counts. */
export function meterSegments(
  rows: ReadonlyArray<{ id: string; type: string; done?: boolean; waiting?: boolean }>,
): MeterSegment[] {
  return rows
    .filter((row) => row.type === "task")
    .map((row) => ({
      id: row.id,
      state: row.done ? "done" : row.waiting ? "waiting" : "open",
    }));
}

export function sectionComplete(segments: readonly MeterSegment[]): boolean {
  return segments.length > 0 && segments.every((segment) => segment.state === "done");
}
