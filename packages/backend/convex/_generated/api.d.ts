/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alerts from "../alerts.js";
import type * as attachments from "../attachments.js";
import type * as board from "../board.js";
import type * as categories from "../categories.js";
import type * as downloads from "../downloads.js";
import type * as events from "../events.js";
import type * as groups from "../groups.js";
import type * as invites from "../invites.js";
import type * as lib_boardService from "../lib/boardService.js";
import type * as lib_categoryService from "../lib/categoryService.js";
import type * as lib_civilDates from "../lib/civilDates.js";
import type * as lib_downloadAssets from "../lib/downloadAssets.js";
import type * as lib_groupService from "../lib/groupService.js";
import type * as lib_inviteService from "../lib/inviteService.js";
import type * as lib_linkService from "../lib/linkService.js";
import type * as lib_mcpRoleSignature from "../lib/mcpRoleSignature.js";
import type * as lib_overdueService from "../lib/overdueService.js";
import type * as lib_phase2Service from "../lib/phase2Service.js";
import type * as lib_questService from "../lib/questService.js";
import type * as lib_recurrenceService from "../lib/recurrenceService.js";
import type * as lib_resourceService from "../lib/resourceService.js";
import type * as lib_routingService from "../lib/routingService.js";
import type * as lib_taskFields from "../lib/taskFields.js";
import type * as lib_taskService from "../lib/taskService.js";
import type * as lib_viewService from "../lib/viewService.js";
import type * as mcpAuth from "../mcpAuth.js";
import type * as mcpBoard from "../mcpBoard.js";
import type * as mcpTasks from "../mcpTasks.js";
import type * as overrides from "../overrides.js";
import type * as pins from "../pins.js";
import type * as progressions from "../progressions.js";
import type * as questions from "../questions.js";
import type * as quests from "../quests.js";
import type * as recurrences from "../recurrences.js";
import type * as resources from "../resources.js";
import type * as routings from "../routings.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";
import type * as views from "../views.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alerts: typeof alerts;
  attachments: typeof attachments;
  board: typeof board;
  categories: typeof categories;
  downloads: typeof downloads;
  events: typeof events;
  groups: typeof groups;
  invites: typeof invites;
  "lib/boardService": typeof lib_boardService;
  "lib/categoryService": typeof lib_categoryService;
  "lib/civilDates": typeof lib_civilDates;
  "lib/downloadAssets": typeof lib_downloadAssets;
  "lib/groupService": typeof lib_groupService;
  "lib/inviteService": typeof lib_inviteService;
  "lib/linkService": typeof lib_linkService;
  "lib/mcpRoleSignature": typeof lib_mcpRoleSignature;
  "lib/overdueService": typeof lib_overdueService;
  "lib/phase2Service": typeof lib_phase2Service;
  "lib/questService": typeof lib_questService;
  "lib/recurrenceService": typeof lib_recurrenceService;
  "lib/resourceService": typeof lib_resourceService;
  "lib/routingService": typeof lib_routingService;
  "lib/taskFields": typeof lib_taskFields;
  "lib/taskService": typeof lib_taskService;
  "lib/viewService": typeof lib_viewService;
  mcpAuth: typeof mcpAuth;
  mcpBoard: typeof mcpBoard;
  mcpTasks: typeof mcpTasks;
  overrides: typeof overrides;
  pins: typeof pins;
  progressions: typeof progressions;
  questions: typeof questions;
  quests: typeof quests;
  recurrences: typeof recurrences;
  resources: typeof resources;
  routings: typeof routings;
  tasks: typeof tasks;
  users: typeof users;
  views: typeof views;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
