# TaskNotes integration — research & proposal (no code yet)

_Goal (user request): "TaskNotes' own board looks like crap, yours is much better, but TaskNotes has lots of useful functionality I want to keep." So: make **Trietment Kanban a nicer board front‑end for TaskNotes tasks**, while TaskNotes keeps owning the data and the advanced features (time tracking, recurrence, reminders, pomodoro, calendar sync)._

This is research only. Sources are listed at the bottom; everything below is from TaskNotes' own docs (tasknotes.dev) and matches the plugin id `tasknotes`.

---

## 1. What TaskNotes is (the relevant facts)

TaskNotes is a **one‑note‑per‑task** plugin: every task is its own Markdown file with **YAML frontmatter** holding the metadata. This is the opposite of Trietment Kanban today, where a task is a single inline `- [ ]` checkbox line scanned from any note.

- **Identification:** a note is a task when its frontmatter `tags` contains the task tag (default `task`, e.g. `tags: [task]`).
- **All property keys are configurable** ("field mapping"): if a vault uses `deadline` instead of `due`, TaskNotes remaps. So an integration must read TaskNotes' field‑mapping, not hard‑code key names.
- **Default frontmatter keys:** `title`, `status`, `priority`, `due`, `scheduled`, `contexts`, `projects`, `tags`, `timeEstimate`, `recurrence`, `reminders`; system‑managed: `dateCreated`, `dateModified`, `completedDate`, `timeEntries`, `complete_instances`, `skipped_instances`, recurrence anchor, `blockedBy` (dependencies), `pomodoros`, `icsEventId`, `icsEventTag`, archive tag. Plus user‑defined custom fields.
- **Statuses are user‑configured** objects: `value` (frontmatter), `label`, `color`, `icon`, `isCompleted` flag, "skip when cycling", "next status", auto‑archive. Boolean `true/false` statuses are also supported.
- **Priorities are user‑configured** objects: `value`, `label`, `color` (weight via alphabetical value, e.g. `1-urgent`, `2-high`).
- **`projects` are wikilinks** (e.g. `projects: ["[[Project A]]"]`); `contexts` are `@context` strings.
- **Recurrence** is RFC‑5545 (RRULE). **Time tracking** stores work sessions in `timeEntries`. Recurring completions go in `complete_instances`. Dependencies are structured objects under `blockedBy`.
- **Views it ships:** Task list, Agenda, **Kanban**, Calendar (month/week/day/year/list), Pomodoro, Statistics. (The user finds this Kanban weaker than ours.)
- **Features to "keep":** customizable statuses & priorities, due **and** scheduled dates, contexts, projects, RRULE recurrence, time tracking + pomodoro, reminders (relative/absolute), dependencies, ICS subscriptions + bidirectional Google/Outlook sync, natural‑language input.

### The decisive finding: a documented in‑process API

TaskNotes exposes a **JavaScript runtime API** intended for in‑Obsidian use (Templater/QuickAdd/companion plugins) — exactly our situation. Accessed via:

```js
const api = app.plugins.plugins.tasknotes?.api;
```

Relevant surface:

- `api.tasks.get(path)`, `api.tasks.list(query?)` — read/query tasks.
- `api.tasks.create(data, ctx?)`, `api.tasks.update(path, patch, ctx?)`, `api.tasks.delete(path, ctx?)`.
- `api.tasks.complete(path, options?, ctx?)`, `api.tasks.setStatus(path, status, ctx?)`; plus dedicated setters for priority, due, scheduled, tags, projects, contexts, reminders, dependencies.
- `api.time.start(path)`, `api.time.stop(path)`, `api.time.active()`, `api.time.summary()`.
- `api.events.on("task.status.changed" | "task.completed" | "task.created" | …, cb)` — live change events with before/after payloads.
- `api.apiVersion` + `api.hasCapability("tasks.write")` for safe feature‑detection.

There is **also** an optional local HTTP API (`localhost:8080`, desktop‑only, off by default) and webhooks, but those target *external* tools. For a sibling Obsidian plugin the **in‑process JS API is the right surface**, with **direct frontmatter read/write as a fallback** when TaskNotes (or the API) isn't present.

---

## 2. The core mismatch to bridge

| | Trietment Kanban (today) | TaskNotes |
|---|---|---|
| Task = | one inline `- [ ]` line | one note + frontmatter |
| Metadata via | emoji/hashtags on the line | YAML frontmatter (configurable keys) |
| Column / state | `#kanban/<col>` | `status` (user‑defined set) |
| Done | `[x]` | a status with `isCompleted` |
| Priority | 5 fixed emoji levels | user‑defined set |
| Project | `#project/x` (+ new `#client/x`) | `projects` wikilinks + `contexts` |
| Dates | due (`📅`) + time (`⏰`) | `due` **and** `scheduled` |
| Extras | subtasks, linked note, archive | time tracking, RRULE recurrence, reminders, pomodoro, dependencies, ICS |

The board already abstracts a "task" into a `{ text, column, project, client, dueDate, time, priority, recurrence, done, … }` object produced by `scanTasks()`/`parseTaskLine()`. The integration's job is to **produce that same object shape from TaskNotes tasks**, and to **route mutations to the TaskNotes API** instead of rewriting a checkbox line.

---

## 3. Proposed approach: TaskNotes as a board "source"

Add a **task source** concept to Trietment Kanban: besides scanning inline checkboxes, it can read TaskNotes tasks. A setting (global, or — nicely — **per board**, reusing the brand‑new Multiple‑boards feature) chooses: `Inline checkboxes` / `TaskNotes` / `Both`.

```
scanTasks()  ──► inline checkbox scan (today)  ─┐
                                                 ├─►  unified task list  ─►  board / calendar (unchanged)
scanTaskNotes() ─► read TaskNotes via api.tasks ─┘
```

`scanTaskNotes()` maps each TaskNotes task to the board's task shape and tags it with `source: 'tasknotes'` and the note `path`. The board, calendar, swimlanes and filters then render it with **zero changes** because the shape is identical.

Mutations branch on `task.source`:

```
moveTask(card → column)   →  inline: rewrite #kanban/…   |  tasknotes: api.tasks.setStatus(path, statusValue)
toggleDone(card)          →  inline: [x] + #kanban/done  |  tasknotes: api.tasks.complete(path) / setStatus
setDueDate / setProject…  →  inline: edit the line       |  tasknotes: api.tasks.update(path, { due: … }) / setters
```

Subscribe to `api.events.on("task.*", …)` to refresh the board live when TaskNotes (or another tool) changes a task.

**Columns = statuses.** In TaskNotes mode the board's columns should mirror TaskNotes' configured **status** list (read via the API / its settings): each status = a column (value↔id, label, color), the `isCompleted` status is the "done" column. This is the single most important mapping — moving a card between columns is just `setStatus`.

**API‑optional, graceful fallback.** Prefer `app.plugins.plugins.tasknotes.api` guarded by `apiVersion`/`hasCapability`. If absent, fall back to reading frontmatter via `metadataCache` and writing via `app.fileManager.processFrontMatter` using TaskNotes' field‑mapping. This keeps read‑only display working even without the API, and survives API changes.

---

## 4. Feature‑by‑feature: what gets mapped, kept, or delegated

| TaskNotes feature | On the Trietment board | How |
|---|---|---|
| **status** | the **columns** | drag → `setStatus`; mirror TaskNotes' status set as columns |
| **priority** | card priority badge | map TaskNotes priority values → colored badge; edit via API |
| **due** | card due date + calendar | read/write `due`; show in Month/Week/Day |
| **scheduled** | second date (badge / calendar) | show scheduled distinctly from due (e.g. calendar = scheduled, badge = due) |
| **projects** (wikilinks) | project badge(s) | resolve wikilink → label; reuse the project‑color system |
| **contexts** (@x) | client badge / chips / a swimlane axis | map to the new `#client` dimension or show as chips |
| **tags** | chips | display; filter |
| **timeEstimate + timeEntries** | "▷ 25m / 1h" chip + start/stop button | read totals; button → `api.time.start/stop` |
| **recurrence (RRULE)** | 🔁 indicator | display only; **TaskNotes keeps the recurrence logic**; "complete" → `api.tasks.complete` handles the next instance |
| **reminders** | 🔔 indicator | display; editing delegated to TaskNotes' modal |
| **pomodoro** | optional start button | `api` pomodoro methods (later tier) |
| **dependencies (blockedBy)** | "blocked" badge, dim card | display; respect by showing it's blocked |
| **completedDate / complete_instances** | done styling | read‑only |
| **ICS / Google/Outlook sync** | — | stays entirely in TaskNotes (our board doesn't touch it) |
| **natural‑language input** | "+ New task" | call `api.tasks.create` (TaskNotes parses), or open TaskNotes' NL modal |

The point: **advanced features stay TaskNotes‑owned**; the board *surfaces* them (badges/indicators) and *triggers* them (via the API), so nothing breaks and the user "keeps" them.

---

## 5. Suggested phasing (so each step is shippable)

1. **Read‑only display (S–M).** Detect TaskNotes tasks, render them as cards grouped by status into columns. Click a card → open the note (or TaskNotes' edit modal). No write‑back. Immediately gives the user the nicer board over their TaskNotes data. Works via the API or pure frontmatter read.
2. **Core read + write (M–L).** Drag→`setStatus`, checkbox→`complete`, edit priority/due/scheduled/projects/contexts from the board modal via the API. Live refresh via `api.events`. This is the sweet spot — a real TaskNotes front‑end. Columns synced from TaskNotes' status config.
3. **Rich extras (L).** Time‑tracking start/stop + totals on cards, scheduled‑vs‑due in calendar, contexts/projects as swimlane axes (reuses the new swimlanes feature), blocked/reminder indicators, NL task creation. Pomodoro optional.

Each tier is independently useful; tier 1 alone already answers the user's wish.

---

## 6. How it rides on what we just built

The recent work makes this much cheaper:

- **Multiple boards** → a board can carry `source: 'tasknotes'` (vs inline), so a user can keep their inline board *and* have a TaskNotes board side by side. Board scope could even map to TaskNotes projects/contexts.
- **`#client` dimension + projects** → natural homes for TaskNotes `projects` and `contexts`.
- **Swimlanes** → group TaskNotes tasks by project/context/priority with zero extra work.
- **Calendar (due/scheduled)** → show `scheduled` and `due`.
- **The task abstraction** (`scanTasks` → uniform task objects) is already the seam to plug a second source into.

---

## 7. Caveats & open decisions (for you to weigh before building)

- **Statuses/priorities are user‑defined in TaskNotes.** The board must read TaskNotes' config to build columns and map values — not assume our fixed set. Decide: mirror *all* statuses as columns, or let the user pick which statuses appear / how they map.
- **Single source of truth.** When in TaskNotes mode, TaskNotes owns the data; our board must *not* also rewrite the line/frontmatter behind its back. All writes go through the API (or a careful frontmatter writer using TaskNotes' field‑mapping).
- **API dependency & stability.** Guard with `apiVersion`/`hasCapability`; degrade to read‑only frontmatter if the API is missing. Decide how hard to depend on the API vs the frontmatter fallback.
- **Field mapping.** Read TaskNotes' configured key names (don't hard‑code `due`/`status`/…). Easiest via the API objects (already normalized); harder via raw frontmatter (must replicate the mapping).
- **`projects` are wikilinks, `contexts` are @strings** — different from our `#project/x` tags; the project‑color/badge system needs to key on the resolved link/label.
- **Two date fields** (`due` + `scheduled`) — our model has one due + time. Decide which drives the calendar and what the card shows.
- **Mobile / HTTP API.** The in‑process JS API works on mobile; the HTTP API is desktop‑only — so we should rely on the **JS API**, not HTTP.
- **Scope creep.** TaskNotes has a *lot* (pomodoro, ICS, dependencies). Recommend: surface/trigger them, never reimplement them.

**Recommendation:** build **tier 1 (read‑only display)** first as a small, low‑risk proof that delivers the user's core ask, then **tier 2** for a genuine front‑end. Implement against the **in‑process JS API** with a **frontmatter read fallback**, and make the source a **per‑board** setting so it coexists with the existing inline‑checkbox board.

---

## Sources

- [TaskNotes documentation](https://tasknotes.dev/)
- [Core Concepts (data model)](https://tasknotes.dev/core-concepts/)
- [Task Properties / field mapping](https://tasknotes.dev/settings/task-properties/)
- [JavaScript API](https://tasknotes.dev/javascript-api/)
- [HTTP API](https://tasknotes.dev/HTTP_API/)
- [Webhooks](https://tasknotes.dev/webhooks/)
- [Features](https://tasknotes.dev/features/)
- [GitHub: callumalpass/tasknotes](https://github.com/callumalpass/tasknotes)
