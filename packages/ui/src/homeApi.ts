import { makeFunctionReference } from "convex/server";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import type { BoardSlice, BoardSliceArgs, CustomViewInput } from "./homeTypes";


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
