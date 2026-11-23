# Manager

Manager is the board an agent writes into, and the board has to feel like something you want to open. It is not another pile of checkboxes. A task is the only thing you can finish. Everything else is a way of grouping tasks, counting them, or deciding who can see them.

The loop is the one already running. An agent reads context, talks with you, and writes Manager over MCP. Manager is the system of record. Later it fans the same records out to push, calendar, reminders, and alarms. The apps are how you look at the board and how you mark something done when no agent is in the room. Typing a task yourself stays available.

## What is wrong with the lists we already have

A missed day in Apple Reminders becomes yesterday’s copy, still open, next to today’s copy. That is fine for a journal. It is absurd for the dishes: you cannot wash yesterday’s dishes. The old note in this repo said a daily must never stack. That fix is too blunt. The journal is a real daily, and Monday’s page still needs a place to be written on Wednesday.

So a repeating series says which machine it is.

- **Replace.** One open card. Skip Monday’s dishes and Tuesday still shows a single “wash dishes”. Monday is not sitting underneath it.
- **Stack.** One card per period. Skip two journal days and you have three entries, each still writable.

Replace is about the open board. It is not forgetting. A thirty-day training track can replace today’s card and still remember how many days you have done, because that memory is a progression, not a second copy of the chore.

## Three different times

The day you mean to do something, the clock time if it has one, and the instant it is too late are different facts.

Taxes have a deadline. After it, the task stays and gets louder. A one-day menu item has an end. After it, the task leaves the board. It was not thrown away. You missed a window that closed. Trash is a separate gesture, and it is always a soft delete: the row stays, the board hides it.

## The rest of the shape

An **event** is a stretch of time with a start and an end. Today, this week, this month, a quarter, a year, a trip, and a season are the same kind of record. A season is an event with a theme. It is usually long. It does not have to be. “Limited” is not a type. It is an end plus the rule “this goes away when the end passes”. The screen can call that a limited task. The game words stay in a skin, not in the database.

A **progression** is a size you know up front: twelve sessions, or 320 pages.

A **quest** is a chain of tasks. You may already know every step, as in moving house. Or you may know only the first one. Call the landlord about the broken window. The next task appears when that call is over, because that is when you learn whether you are buying glass, sending money, or booking a repair.

A **category** is a part of life: household, health, work. A **space** is a set of people. You attach a category, an event, or a task to a space, and you can detach it without deleting it. A task is allowed to sit in more than one place. The screen will usually suggest one home. The core will not refuse a second.

The main screen is Home. The left rail is a set of views: Home, then whatever you install from a catalog (Household and the rest), plus computed views such as New, High priority, and Today. Across the top: Tasks, Daily, Weekly, and Monthly. The column mixes task rows, progression bars, and quest steppers. An unread alert from an agent sits above the checkboxes and is not a task. A question sits there too, when the board needs you to pick the next step. Anything an agent or another person created wears NEW until you open it. You can pin a row to the top of a view, or force it into a computed view, without changing its date or priority.

A view, an event, and a shared space each have a Lucide icon and a color. Templates may bring a richer skin. You can change the icon and the color, and you can rebuild the skin. A Winter frame can still replace the card without a migration.

Achievements, a paid inference path, and a mailbox connected straight to Manager come after these records exist. Until then, harness skills teach Grok Bot, Codex, Claude, Antigravity, and the rest the two machines and the two clocks.

The schema today is still a task with a title, a done flag, and an optional day. This document is the target, not a description of what is shipped. The build order is in [plan.md](plan.md).
