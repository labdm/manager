import { makeFunctionReference } from "convex/server";
import type { Id } from "@manager/backend/convex/_generated/dataModel";
import type { BoardSlice, BoardSliceArgs, CustomViewInput } from "./homeTypes";
import type { ComputedViewSlug } from "./homeCatalog";

/**
 * The M3 board functions are newer than the checked-in generated API. Function
 * references let the UI call them by path until `convex dev` regenerates
 * `api.d.ts`; the argument and return contracts stay local and typed here.
 */
export const boardSliceRef = makeFunctionReference<
  "query",
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
  { slug: ComputedViewSlug },
  unknown
>("views:enableComputed");

export const removeViewRef = makeFunctionReference<
  "mutation",
  { viewId: string },
  unknown
>("views:remove");

export interface PinSubject {
  type: "task";
  id: Id<"tasks">;
}

export interface PinArgs {
  viewId: string;
  subject: PinSubject;
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
