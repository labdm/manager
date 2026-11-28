/** Canonical page from dmytro-afonin/labdm-donate (`site.url` and the donate.labdm.dev domain). */
export const DONATE_URL = "https://donate.labdm.dev";

export const CHANGELOG: ReadonlyArray<{ version: string; date: string; items: readonly string[] }> = [
  {
    version: "Unreleased",
    date: "2026-11-28",
    items: [
      "Quests, Daily, Weekly and Monthly each have a segmented progress meter.",
      "A routine resets from a completion record for that period. Waiting tasks stay visible until unblocked.",
      "Checking a task plays a short animation, a synthesized chime and a vibration where the device allows it.",
      "The web app can be installed, and reminders can arrive as Web Push.",
    ],
  },
  {
    version: "0.1.5",
    date: "2026-11-25",
    items: ["Row-first shell on the web app."],
  },
  {
    version: "0.1.4",
    date: "2026-11-25",
    items: ["Groups, routings and the activity split."],
  },
  {
    version: "0.1.3",
    date: "2026-11-20",
    items: ["Public release: tasks, downloads and the MCP server."],
  },
  {
    version: "0.1.0",
    date: "2026-11-20",
    items: ["First tagged release."],
  },
];
