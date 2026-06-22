## Calendar view + Outlook calendar sync

This release adds a calendar to Trietment Kanban.

- **Calendar view** — a month grid showing every task on its due date, with the board's color coding (red = overdue, orange = today). Open it from the ribbon, the command palette, or the 📅 button on the board. Click a day to add a task; click a task to edit it.
- **Outlook calendar (optional)** — connect one or more Microsoft/Outlook accounts via OAuth and see your appointments next to your tasks (read-only). Works on desktop and mobile; signing in needs no setup thanks to a built-in Client ID.
- **Calendar picker** — choose per account which calendars to show, including shared calendars, each with its own color.

One-time Azure app registration is only needed if you host your own Client ID — see the README ("Outlook calendar setup"). Existing Kanban features are unchanged.
