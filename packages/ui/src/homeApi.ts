import { makeFunctionReference } from "convex/server";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import type {
  CategoryItem,
  EventItem,
  ResourceEffectInput,
  ResourceItem,
} from "./sheetTypes";
import type { BoardSlice, BoardSliceArgs, CustomViewInput } from "./homeTypes";
import type { TaskCreatePayload, TaskUpdatePayload } from "./taskTypes";


/**
 * The Home functions are newer than the checked-in generated API. `board.slice`
 * is a mutation because loading the board also mints recurrences and ensures
 * the Home view. Arguments match the Convex handlers: flat pin ids, and
 * `enableComputed` takes `key` (`high`, not `high-priority`).
 */
export const boardSliceRef = makeFunctionReference<
  "mutation",
  BoardSliceArgs & Record<string, unknown>,
  BoardSlice
>("board:slice");

export const installTemplateRef = makeFunctionReference<
  "mutation",
  { slug: string },
  unknown
>("views:installTemplate");

export const createCustomViewRef = makeFunctionReference<
  "mutation",
  CustomViewInput & Record<string, unknown>,
  unknown
>("views:createCustom");

export const enableComputedViewRef = makeFunctionReference<
  "mutation",
  { key: "new" | "high" | "today" },
  unknown
>("views:enableComputed");

export const removeViewRef = makeFunctionReference<
  "mutation",
  { viewId: string },
  unknown
>("views:remove");

export interface PinArgs {
  viewId: string;
  subjectType: "task";
  subjectId: Id<"tasks">;
}

export const pinRef = makeFunctionReference<
  "mutation",
  PinArgs & Record<string, unknown>,
  unknown
>("pins:pin");

export const unpinRef = makeFunctionReference<
  "mutation",
  PinArgs & Record<string, unknown>,
  unknown
>("pins:unpin");

/**
 * Sheet functions. The generated API is checked in before these handlers exist,
 * so every call goes through makeFunctionReference. A deployment without the
 * handler rejects the call and the sheet shows the error; there is no inline
 * form to fall back to.
 */
export const createTaskRef = makeFunctionReference<
  "mutation",
  TaskCreatePayload & Record<string, unknown>,
  { id: Id<"tasks"> }
>("tasks:create");

export const updateTaskRef = makeFunctionReference<
  "mutation",
  TaskUpdatePayload & Record<string, unknown>,
  unknown
>("tasks:update");

export const setResourceEffectRef = makeFunctionReference<
  "mutation",
  ResourceEffectInput & Record<string, unknown>,
  unknown
>("tasks:setResourceEffect");

export const createCategoryRef = makeFunctionReference<
  "mutation",
  { name: string; icon?: string; color?: string } & Record<string, unknown>,
  unknown
>("categories:create");

export const listCategoriesRef = makeFunctionReference<
  "query",
  Record<string, never>,
  CategoryItem[]
>("categories:list");

export const createEventRef = makeFunctionReference<
  "mutation",
  {
    title: string;
    kind: string;
    startsAt: number;
    endsAt: number;
    icon?: string;
    color?: string;
  } & Record<string, unknown>,
  unknown
>("events:create");

export const listEventsRef = makeFunctionReference<
  "query",
  { kind?: string },
  EventItem[]
>("events:list");

export const createResourceRef = makeFunctionReference<
  "mutation",
  {
    title: string;
    quantity: number;
    unit?: string;
    lowAt?: number;
    icon?: string;
    color?: string;
  } & Record<string, unknown>,
  unknown
>("resources:create");

export const listResourcesRef = makeFunctionReference<
  "query",
  Record<string, never>,
  ResourceItem[]
>("resources:list");

export const createProgressionRef = makeFunctionReference<
  "mutation",
  {
    title: string;
    mode?: "steps" | "meter";
    target: number;
    unit?: string;
  } & Record<string, unknown>,
  unknown
>("progressions:create");

/**
 * `resourceEffect` is the deployed wire shape for a series' stock effect.
 * `resourceId` / `resourceDelta` are accepted in the type for older drafts;
 * the sheet always sends the nested object.
 */
export interface CreateRecurrenceArgs {
  behavior: "replace" | "stack";
  cadence: string;
  timezone: string;
  title: string;
  notes?: string;
  plannedTime?: number;
  location?: string;
  priority?: string;
  priorityRank?: number;
  overduePolicy?: string;
  presentation?: string;
  anchorOn?: number;
  resourceEffect?: { resourceId: string; delta: number };
  resourceId?: string;
  resourceDelta?: number;
}

export const createRecurrenceRef = makeFunctionReference<
  "mutation",
  CreateRecurrenceArgs & Record<string, unknown>,
  unknown
>("recurrences:create");

/**
 * Edit mutations may not exist on an older deployment. Calling one through a
 * sheet surfaces the rejection in that sheet; no inline editor is used.
 */
export const updateCategoryRef = makeFunctionReference<
  "mutation",
  { id: string; name?: string; icon?: string; color?: string } & Record<
    string,
    unknown
  >,
  unknown
>("categories:update");

export const updateEventRef = makeFunctionReference<
  "mutation",
  {
    id: string;
    title?: string;
    kind?: string;
    startsAt?: number;
    endsAt?: number;
    icon?: string;
    color?: string;
  } & Record<string, unknown>,
  unknown
>("events:update");

export const updateViewRef = makeFunctionReference<
  "mutation",
  { viewId: string; title?: string; icon?: string; color?: string } & Record<
    string,
    unknown
  >,
  unknown
>("views:update");

export const updateProgressionRef = makeFunctionReference<
  "mutation",
  {
    id: string;
    title?: string;
    mode?: string;
    target?: number;
    unit?: string;
  } & Record<string, unknown>,
  unknown
>("progressions:update");

export const updateResourceRef = makeFunctionReference<
  "mutation",
  {
    id: string;
    title?: string;
    unit?: string;
    quantity?: number;
    lowAt?: number;
    icon?: string;
    color?: string;
  } & Record<string, unknown>,
  unknown
>("resources:update");
