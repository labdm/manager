import { CircleHelp, ListChecks, Mail, MessageCircle, Users, ChartNoAxesColumn } from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { resolveLucideIcon } from "./iconCatalog";
import { cn } from "./lib/utils";
import { colorClass } from "./shellFacts";
import type { FeedRow, RowType } from "./shellTypes";

const TYPE_ICONS: Record<RowType, typeof ListChecks> = {
  task: ListChecks,
  message: MessageCircle,
  question: CircleHelp,
  invite: Mail,
  progression: ChartNoAxesColumn,
};

export interface ProductRowProps {
  row: FeedRow;
  selected: boolean;
  onOpen: () => void;
  onAction: () => void;
  onSecondary?: () => void;
}

/** The only board row. A stored `card` hint is ignored. */
export function ProductRow({ row, selected, onOpen, onAction, onSecondary }: ProductRowProps) {
  const TypeIcon = TYPE_ICONS[row.type];
  const CategoryIcon = row.categoryIcon ? resolveLucideIcon(row.categoryIcon) : null;

  return (
    <li className="list-none">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open ${row.title}`}
        aria-current={selected ? "true" : undefined}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          "flex w-full items-start gap-2 rounded-md border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected && "border-primary bg-accent/50"
        )}
      >
        {row.isNew ? <Badge aria-label="New">NEW</Badge> : null}
        {CategoryIcon ? (
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded",
              colorClass(row.categoryColor)
            )}
          >
            <CategoryIcon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
        <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
          <TypeIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">{row.type}</span>
        </span>
        {row.progress ? (
          <span className="shrink-0 self-center text-xs font-medium tabular-nums text-muted-foreground">
            {row.progress}
          </span>
        ) : null}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {row.title}
            {row.questMark ? <span className="ml-1 text-destructive">!</span> : null}
          </span>
          {row.body ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{row.body}</span>
          ) : null}
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          {row.action ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation();
                onAction();
              }}
            >
              {row.action}
            </Button>
          ) : null}
          {onSecondary ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                onSecondary();
              }}
            >
              Decline
            </Button>
          ) : null}
          {row.groupMark ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Group</span>
            </span>
          ) : null}
          {row.dueText ? (
            <span className="text-xs text-muted-foreground">{row.dueText}</span>
          ) : null}
          {row.resourceDelta ? (
            <Badge variant="outline" className="tabular-nums">
              {row.resourceDelta}
            </Badge>
          ) : null}
        </span>
      </div>
    </li>
  );
}
