import { describe, expect, it } from "vitest";
import { iconChoices, resolveLucideIcon } from "../src/iconCatalog";
import {
  cadenceLabel,
  buildDashboardTiles,
  normalizeSeriesBehavior,
  normalizeSeriesCadence,
  normalizeTaskLook,
  seriesInputFromDraft,
} from "../src/sheetFacts";
import { emptyTaskDraft } from "../src/sheetFacts";

describe("sheet facts", () => {
  it("defaults an absent presentation to check", () => {
    expect(normalizeTaskLook(undefined)).toBe("check");
    expect(normalizeTaskLook(null)).toBe("check");
    expect(normalizeTaskLook("card")).toBe("card");
  });

  it("keeps series separate from cadence and labels 14 days in UI words", () => {
    expect(normalizeSeriesBehavior(undefined)).toBe("none");
    expect(normalizeSeriesBehavior("stack")).toBe("stack");
    expect(normalizeSeriesCadence("fourteen")).toBe("biweekly");
    expect(normalizeSeriesCadence("every 14 days")).toBe("biweekly");
    expect(cadenceLabel("biweekly")).toBe("Every 14 days");
  });

  it("maps a series draft to the deployed recurrence shape", () => {
    const draft = {
      ...emptyTaskDraft(),
      title: "Take the bins out",
      series: "stack" as const,
      cadence: "biweekly" as const,
      plannedDay: "2026-11-24",
      plannedTime: "07:30",
      resourceId: "resource-bins",
      resourceDelta: "-1",
    };

    const input = seriesInputFromDraft(draft, "Europe/Kyiv");

    expect(input.behavior).toBe("stack");
    expect(input.cadence).toBe("Every 14 days");
    expect(input.timezone).toBe("Europe/Kyiv");
    expect(input.presentation).toBe("check");
    expect(input.plannedTime).toBe(450);
    expect(input.resourceEffect).toEqual({ resourceId: "resource-bins", delta: -1 });
  });

  it("builds add tiles for every entity kind", () => {
    const tiles = buildDashboardTiles({ views: [], categories: [], events: [] });
    const addIds = tiles.filter((tile) => tile.isAddTile).map((tile) => tile.id);

    expect(addIds).toEqual([
      "add-view",
      "add-category",
      "add-event",
      "add-progression",
      "add-resource",
    ]);
  });

  it("searches the Lucide grid by name and falls back to circle", () => {
    const choices = iconChoices("heart-pulse");
    expect(choices.some((choice) => choice.name === "heart-pulse")).toBe(true);
    expect(resolveLucideIcon("not-a-real-icon")).toBe(
      resolveLucideIcon(undefined)
    );
  });
});
