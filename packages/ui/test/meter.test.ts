import { describe, expect, it } from "vitest";
import { chipAfterSwipe } from "../src/chipSwipe";
import { meterSegments, sectionComplete } from "../src/meter";

describe("section meter", () => {
  it("counts tasks only and keeps waiting as its own segment", () => {
    const segments = meterSegments([
      { id: "a", type: "task", done: true },
      { id: "b", type: "task", waiting: true },
      { id: "c", type: "task" },
      { id: "m", type: "message" },
    ]);
    expect(segments).toEqual([
      { id: "a", state: "done" },
      { id: "b", state: "waiting" },
      { id: "c", state: "open" },
    ]);
    expect(sectionComplete(segments)).toBe(false);
    expect(sectionComplete([{ id: "a", state: "done" }])).toBe(true);
    expect(sectionComplete([])).toBe(false);
  });
});

describe("chip swipe", () => {
  it("moves to the neighbor tab and ignores a vertical drag", () => {
    expect(chipAfterSwipe("all", -80, 10)).toBe("daily");
    expect(chipAfterSwipe("daily", 80, 4)).toBe("all");
    expect(chipAfterSwipe("all", 80, 0)).toBeNull();
    expect(chipAfterSwipe("events", -90, 0)).toBeNull();
    expect(chipAfterSwipe("weekly", 10, 80)).toBeNull();
  });
});
