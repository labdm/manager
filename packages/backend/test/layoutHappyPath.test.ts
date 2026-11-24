import { describe, expect, it } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import { boardSlice } from "../convex/lib/boardService";
import { createCategory } from "../convex/lib/categoryService";
import { civilDayStart } from "../convex/lib/civilDates";
import { flatCronRouting, groupWire, routingWire } from "../convex/lib/clientWire";
import {
  addMembership,
  defaultGroupForUser,
  membershipFor,
  removeGroup,
} from "../convex/lib/groupService";
import { createInvite } from "../convex/lib/inviteService";
import { setOverride } from "../convex/lib/linkService";
import { createAlert, listAlertHistory } from "../convex/lib/phase2Service";
import {
  createResource,
  setTaskResourceEffect,
} from "../convex/lib/resourceService";
import { createRouting, runDueRoutings } from "../convex/lib/routingService";
import { createTask, setTaskDone } from "../convex/lib/taskService";
import { upsertUserByTokenIdentifier } from "../convex/users";
import { fakeDb } from "./fakeDb";

const TZ = "UTC";
const NOW = Date.UTC(2026, 0, 10, 12, 0);

async function provision(
  db: ReturnType<typeof fakeDb>,
  tokenIdentifier: string,
  email: string,
) {
  const ctx = { db: db.asWriter() } as unknown as Parameters<
    typeof upsertUserByTokenIdentifier
  >[0];
  return await upsertUserByTokenIdentifier(ctx, tokenIdentifier, { email });
}

describe("layout happy path", () => {
  it("covers groups, invites, routings, and the activity split in one flow", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const reader = db.asReader();

    // A user is provisioned through the same upsert the clients call.
    const owner = await provision(db, "clerk|owner", "owner@example.com");
    const group = await defaultGroupForUser(reader, owner._id);
    expect(group.name).toBe("Personal");
    expect(group.isDefault).toBe(true);
    expect((await membershipFor(reader, owner._id, group._id))?.role).toBe("owner");
    expect((await membershipFor(reader, owner._id, group._id))?.canInvite).toBe(true);

    // Every item lands in the selected group, and an omitted group uses it too.
    const task = await createTask(writer, owner._id, {
      title: "Water the plants",
      groupId: group._id,
    });
    const implicit = await createTask(writer, owner._id, {
      title: "Implicit group",
    });
    expect(db.all("tasks").every((row) => row.groupId === group._id)).toBe(true);
    expect(implicit.groupId).toBe(group._id);

    const category = await createCategory(writer, owner._id, {
      name: "Household",
      groupId: group._id,
    });
    expect(category.groupId).toBe(group._id);

    const resource = await createResource(writer, owner._id, {
      title: "Plant food",
      quantity: 5,
      lowAt: 1,
      groupId: group._id,
    });
    await setTaskResourceEffect(writer, owner._id, task.id, resource.id, -1);
    expect(db.all("tasks").find((row) => row._id === task.id)?.resourceEffect).toEqual({
      resourceId: resource.id,
      delta: -1,
    });

    await setTaskDone(writer, owner._id, task.id, true);
    expect(db.all("resources").find((row) => row._id === resource.id)?.quantity).toBe(4);

    // A cron routing runs on the period key once, then the same tick is a no-op.
    const routing = await createRouting(writer, owner._id, {
      name: "Daily check",
      trigger: {
        type: "cron",
        cadence: "daily",
        timezone: TZ,
        anchorOn: civilDayStart(NOW, TZ),
      },
      execution: { type: "createTask", title: "Daily check" },
      groupId: group._id,
    });
    const tasksBeforeRoutings = db.all("tasks").length;
    expect(await runDueRoutings(writer, NOW)).toEqual({ considered: 1, ran: 1 });
    expect(db.all("tasks")).toHaveLength(tasksBeforeRoutings + 1);
    expect(await runDueRoutings(writer, NOW)).toEqual({ considered: 1, ran: 0 });
    expect(db.all("tasks")).toHaveLength(tasksBeforeRoutings + 1);
    expect(db.all("routingRuns")).toHaveLength(1);

    // Owner can invite; a viewer on the same group cannot.
    const invite = await createInvite(writer, owner._id, {
      groupId: group._id,
      email: "friend@example.com",
    });
    expect(invite.status).toBe("pending");
    expect(invite.origin).toBe("self");
    expect(invite.seenAt).toBeDefined();

    const viewer = await provision(db, "clerk|viewer", "viewer@example.com");
    await addMembership(writer, viewer._id, group._id, {
      role: "viewer",
      canInvite: false,
    });
    await expect(
      createInvite(writer, viewer._id, {
        groupId: group._id,
        email: "another@example.com",
      }),
    ).rejects.toThrow("Invite permission required");

    // An include cannot pull another group's row (or its resource data) onto the board.
    const outsider = await provision(db, "clerk|outsider", "outsider@example.com");
    const outsiderGroup = await defaultGroupForUser(reader, outsider._id);
    const foreignResource = await createResource(writer, outsider._id, {
      title: "Secret stock",
      quantity: 99,
      groupId: outsiderGroup._id,
    });
    const foreign = await createTask(writer, outsider._id, {
      title: "Foreign money",
      groupId: outsiderGroup._id,
      resourceEffect: { resourceId: foreignResource.id, delta: 100 },
    });
    const viewId = (
      await boardSlice(writer, owner._id, { tab: "tasks", timezone: TZ })
    ).activeViewId as Id<"views">;
    await expect(
      setOverride(writer, owner._id, {
        viewId,
        subjectType: "task",
        subjectId: String(foreign.id),
        mode: "include",
      }),
    ).rejects.toThrow("Invalid subject group");

    // History keeps every record. Tasks hides self activity by default.
    const activity = await createAlert(writer, owner._id, {
      title: "Completed Water the plants",
      kind: "activity",
      authorOrigin: "self",
      groupId: group._id,
    });
    const history = await listAlertHistory(reader, owner._id);
    expect(history.some((row) => row._id === activity._id)).toBe(true);

    const board = await boardSlice(writer, owner._id, {
      tab: "tasks",
      timezone: TZ,
    });
    expect(board.alerts.some((row) => row.id === String(activity._id))).toBe(false);

    await writer.patch(owner._id, { activityOnTasks: "all" });
    const boardWithAll = await boardSlice(writer, owner._id, {
      tab: "tasks",
      timezone: TZ,
    });
    expect(
      boardWithAll.alerts.some((row) => row.id === String(activity._id)),
    ).toBe(true);
    expect(routing.deletedAt).toBeUndefined();
  });

  it("fires a state routing once per write revision", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const owner = await provision(db, "clerk|state", "state@example.com");
    const group = await defaultGroupForUser(db.asReader(), owner._id);

    await createRouting(writer, owner._id, {
      name: "Log completions",
      trigger: { type: "state", subjectType: "task", event: "completed" },
      execution: { type: "createMessage", title: "Task completed" },
      groupId: group._id,
    });

    const task = await createTask(writer, owner._id, { title: "Finish" });
    await setTaskDone(writer, owner._id, task.id, true);
    expect(db.all("alerts").filter((row) => row.title === "Task completed")).toHaveLength(1);

    // A retried completion is not a new write.
    await setTaskDone(writer, owner._id, task.id, true);
    expect(db.all("alerts").filter((row) => row.title === "Task completed")).toHaveLength(1);

    // Reopening, then completing again, is a new revision.
    await setTaskDone(writer, owner._id, task.id, false);
    await setTaskDone(writer, owner._id, task.id, true);
    expect(db.all("alerts").filter((row) => row.title === "Task completed")).toHaveLength(2);
    expect(db.all("routingRuns")).toHaveLength(2);
  });

  it("stores the flat client cron payload and lists the shell wire", async () => {
    const db = fakeDb();
    const writer = db.asWriter();
    const owner = await provision(db, "clerk|wire", "wire@example.com");
    const reader = db.asReader();
    const group = await defaultGroupForUser(reader, owner._id);
    const member = await membershipFor(reader, owner._id, group._id);

    expect(groupWire(group, member)).toMatchObject({
      id: group._id,
      name: "Personal",
      isDefault: true,
      role: "owner",
      canInvite: true,
    });

    const routing = await createRouting(
      writer,
      owner._id,
      flatCronRouting({
        name: "Morning",
        cadence: "daily",
        title: "Stretch",
        groupId: group._id,
        now: NOW,
      }),
    );
    expect(routing.trigger).toEqual({
      type: "cron",
      cadence: "daily",
      timezone: "UTC",
      anchorOn: civilDayStart(NOW, "UTC"),
    });
    expect(routing.execution).toEqual({ type: "createTask", title: "Stretch" });
    expect(routingWire(routing)).toMatchObject({
      id: routing._id,
      name: "Morning",
      title: "Morning",
      trigger: "cron",
      cadence: "daily",
      executionKind: "createTask",
      execution: "createTask",
    });

    await expect(removeGroup(writer, owner._id, group._id)).rejects.toThrow(
      "Default group cannot be deleted",
    );
  });
});
