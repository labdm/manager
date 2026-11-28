import { meterSegments, sectionComplete } from "./meter";
import { cn } from "./lib/utils";

export function SectionMeter({
  rows,
  celebrate,
}: {
  rows: ReadonlyArray<{ id: string; type: string; done?: boolean; waiting?: boolean }>;
  celebrate?: boolean;
}) {
  const segments = meterSegments(rows);
  const done = segments.filter((segment) => segment.state === "done").length;
  const complete = celebrate || sectionComplete(segments);

  return (
    <div className="flex flex-col gap-2" aria-label="Section progress">
      {segments.length ? (
        <div className="flex h-2.5 gap-1" role="img" aria-label={`${done} of ${segments.length} done`}>
          {segments.map((segment) => (
            <span
              key={segment.id}
              className={cn(
                "h-full min-w-1 flex-1 rounded-full",
                segment.state === "done" && "bg-primary",
                segment.state === "waiting" && "bg-amber-300",
                segment.state === "open" && "bg-muted",
              )}
            />
          ))}
        </div>
      ) : (
        <div className="h-2.5 rounded-full bg-muted" />
      )}
      <p className="text-xs text-muted-foreground">
        {segments.length ? `${done} of ${segments.length}` : "No tasks in this section yet."}
        {segments.some((segment) => segment.state === "waiting") ? " · waiting still counts" : ""}
      </p>
      {complete ? (
        <p role="status" className="text-sm font-medium text-primary">
          Section complete
        </p>
      ) : null}
    </div>
  );
}
