import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// A closed app still moves forward: mint due occurrences and run overdue policies.
crons.interval(
  "reconcile recurrences and overdue",
  { minutes: 5 },
  internal.recurrences.reconcileAll,
);

export default crons;
