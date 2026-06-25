# Feature proposals — Trietment Kanban

_Design proposals (no implementation yet). Each section states the current behaviour in the code, how comparable tools solve it, options with trade-offs, a recommendation, the exact data/markdown format and settings, an implementation sketch against `main.js`/`styles.css`, back-compat, and risks._

## Executive summary

| Feature | Effort | Recommendation in one line |
|---|---|---|
| **Card title editing** | S | Add a title text field to EditTaskModal and a surgical `setText(task, newText)` plugin method that splices only the human-text span of the markdown line (text up to the first metadata/wikilink token), preserving indentation, checkbox, and every token verbatim. |
| **Multiple tags per card (client + project)** | L | Keep #project/x as a repeatable multi-value field (allow several on one line), make the first one the "primary" project that drives swimlanes/tint, and introduce an optional second labelled dimension #client/x that shares the exact same color/label/filter machinery as project. |
| **Swimlanes (group-by lanes)** | L | Add a single-select "Group by" header control that renders the board as one column-row per lane (lanes = rows, status columns = columns), with an explicit "Uncategorised" lane, collapsible lanes, and — when grouping by tag — a card with multiple tags appears in EVERY matching lane (with a per-view "primary lane only" toggle defaulting to off), keeping swimlanes as a pure view-layer concern with zero changes to the markdown task format. |
| **Multiple boards** | L | Introduce a `settings.boards[]` array (each board = id + name + columns/labels/role config + scope filter + group-by), migrate the current top-level board config into a single default board, and make the one KanbanView leaf board-aware via view state plus a header board-picker, command-palette entries, and a ribbon. |
| **Card covers + CSS-targetable metadata** | M | Add a single `[cover:: value]` Dataview-style inline field that auto-detects image vs. text and renders an image banner or a plain-text banner at the top of the card, and make every metadata element carry `data-field`/`data-value` attributes plus a sanitized class so users can style values (e.g. priority pills) entirely in their own CSS snippet. |

_Effort: S = small (hours), M = medium (1–2 days), L = large (multi-day)._

## How multiple tags and swimlanes work together (the key design question)

These two features are designed to compose, not compete:

- **Multiple tags** make a card carry more than one value — e.g. a **client** (`#client/acme`) *and* one or more **projects** (`#project/website`). One project stays the "primary" (drives the card tint).
- **Swimlanes** are a pure view choice: a "Group by" selector in the board header turns the board into rows (lanes) × the existing status columns. You group by **one** dimension at a time (project, client, priority, due-date, or — once multi-tag lands — any tag).
- **The interplay:** when you group by a dimension a card has several values in (e.g. group by tag, card has two tags), the card **appears in every matching lane** by default (like Notion). A per-view **"Primary lane only"** toggle collapses it to its first value for people who dislike duplicates. Grouping by a single-valued dimension (client, priority, due) is always one-card-one-lane.
- So you can run, for example, **client swimlanes** with **project badges** on each card — exactly the "a client and a project on one card" request — and switch the grouping (or turn it off) whenever you like. Nothing is written to your notes; swimlanes are display-only.

## Recommended sequencing

Independent quick wins can ship any time; the grouping/board features build on the tag model, so order matters:

1. **Card title editing** (S) — independent, safe quick win. Ship first.
2. **Card covers + CSS-targetable metadata** (M) — independent; gives value-based pills (priority: emergency → red pill) and image/text covers. Can land in parallel with title editing.
3. **Multiple tags (client + project)** (L) — foundational. Introduces a small "tag dimension" registry that the next two features reuse.
4. **Swimlanes** (L) — view-layer group-by. Works immediately on project/priority/due; gains the "tag" lane dimension once step 3 lands.
5. **Multiple boards** (L) — a board becomes a named lens (scope + columns + per-board group-by). Its per-board scope reuses the tag dimensions (step 3) and its per-board grouping reuses swimlanes (step 4).

Steps 1–2 are committable without any of the others. Steps 3 → 4 → 5 share plumbing and are best built in that order, but each is independently shippable.

## Decisions needed before building

A few choices change the data written into your notes (hard to reverse), so worth settling first:

1. **Second tag dimension:** a dedicated `#client/...` namespace alongside `#project/...` (recommended — reads naturally, clean swimlane axis), vs. simply allowing several `#project/...` tokens, vs. a fully generic tag set. And: should extra tags be real Obsidian `#hashtags` (they then appear in the global tag pane/graph) or quiet inline fields (`client:: acme`)?
2. **Swimlane default for multi-value cards:** "appears in every matching lane" (recommended) vs. "primary lane only".
3. **Priority pill values:** the plugin's priorities are `highest…lowest`. To get "active = green / emergency = red" either map those words onto the five built-ins now, or add a small custom **priority labels** setting (follow-up). Either way the CSS hook is the same.
4. **Filtering model:** keep the cheap substring filter (extended to include all tags) now, or add proper facet (tag-chip) filtering later.
5. **Multiple boards:** one "Open board (picker)" command + ribbon (simple), vs. re-registering one command per board on every settings change (more convenient, slight churn).

---

## Title editing (rename the task text from the edit modal)

### Current state in this plugin

In `/home/unknown/projecten/obsidian-kanban/main.js`:

- `parseTaskLine()` (line 607) matches `^(\s*)- \[([ xX\-])\] (.+)$`, captures `indent`, `checkChar`, and `rest`, then derives `task.text` by **regex-stripping** every metadata token out of `rest` (lines 652-661): it removes `📅 date`, `⏰ time`, `🔁 recurrence`, `#kanban/...`, `#project/...`, the first `[[wikilink]]`, priority emojis, then collapses whitespace and trims. So `task.text` is a *cleaned* string, not a slice of the original line — its character positions do not map back to the raw line.
- `EditTaskModal` (line 2582) shows the task text **read-only** as `tk-modal-info` (line 2602) and lets the user change column, due date, time, project, recurrence, and subtasks. There is **no** field to edit the title.
- The existing metadata mutators (`setProject` 989, `setRecurrence` 964, `setDueDate` 1340, `setTime` 1362, `addNoteLinkToTask` 1191) all follow the same safe pattern: read the file, split into `lines`, operate on `lines[task.line]` with a token-specific regex, then `vault.modify`. The mutators that *insert* a new token find the first metadata token via `line.search(/\s+(📅|🔁|#kanban|#project|🔺|⏫|🔼|🔽|⏬)/)` and splice before it.
- Several mutators (`deleteTask` 1082, `toggleSubtask` 1098, `addSubtask` 1113, `addNoteLinkToTask` 1196, `deleteSubtask` 1129) use a **raw-line guard**: `lines[task.line] !== task.raw` → bail. The save handler in `EditTaskModal` (lines 2737-2767) calls `setDueDate`/`setTime`/`setProject`/`setRecurrence` in sequence; notably those four do **not** re-check `task.raw`, they only check `task.line >= lines.length`.

### How comparable tools do it

Inline title editing is table stakes everywhere: Trello (click title → inline textarea), Jira (click summary → inline edit), Notion (title is the page name, edited inline), and the popular mgmeyers Obsidian Kanban plugin (double-click a card to edit its markdown text in place). In every case the title is plain text and metadata lives separately, so renaming never disturbs dates/tags. Our model is the same *conceptually* — the difference is our metadata is inline tokens on the **same** markdown line, so the rename must be surgical rather than a whole-line rewrite.

### Why not just reuse `formatTaskLine`

The tempting shortcut — set `task.text = newText` and re-emit via `formatTaskLine()` (line 928) — is the wrong choice and a back-compat hazard:

- `formatTaskLine` **reorders and normalizes** tokens into its own canonical order (recurrence, date, time, priority, project, column) and **drops** anything it does not model: the `[[wikilink]]`, any `#other/tags`, block refs `^id`, HTML comments, or trailing text the user hand-wrote after the tokens. Re-emitting would silently delete the linked-note wikilink and any unmodeled content.
- It also forces the done/`[x]` state purely from `column === doneColumn`, which could flip a manually-set checkbox.

So a whole-line rebuild is out. We need a span-replace that touches only the human-text portion.

### Options

**Option A — Surgical span splice (recommended).** Add `setText(task, newText)`. Read the line, locate the **end of the human-text span** = the index of the first metadata-or-wikilink token, and replace `[afterCheckbox .. firstToken)` with the new text, leaving the checkbox prefix and everything from the first token onward byte-for-byte intact.

- Pros: preserves token order/spacing, wikilink, unmodeled tags, block refs, trailing content. Mirrors the existing mutator pattern exactly. No reliance on `formatTaskLine`. Smallest blast radius.
- Cons: needs a correct "first token" boundary regex (must include `[[`, all five priority emojis, `📅 ⏰ 🔁 #kanban #project`). A task with **no** metadata at all means the text span runs to end-of-line — easy to handle.

**Option B — Rebuild from parsed parts.** Re-derive all tokens from `task`, substitute text, re-emit. Rejected: this is `formatTaskLine` with its data-loss problems (above), plus it can't reproduce arbitrary token order/wikilink.

**Option C — Editor-based inline edit on the card** (double-click card title → contenteditable). Nicer UX long-term and matches mgmeyers, but it is a much bigger change (focus/blur handling, drag-vs-edit disambiguation, re-render coordination) and out of scope for a "quick win." Worth a follow-up; the `setText` method from Option A is the shared primitive it would call.

### Recommendation

Implement **Option A**: a `setText(task, newText)` plugin method plus a title `<input type="text">` at the top of `EditTaskModal`. This is the minimal, safe, on-pattern change.

### Exact data/markdown format and behaviour

No format change. The line shape is unchanged: `<indent>- [<state>] <human text> <tokens...>`. Only the `<human text>` span is rewritten. Empty new text should be rejected (a task line needs *some* text; `parseTaskLine`'s regex requires `(.+)` after the checkbox, so an all-whitespace body would stop the line being parsed as a task). Trim the input and, if empty, keep the old text (or disable Save) — show no token changes.

The boundary regex (reuse the existing token set, adding `\[\[`):

```
const FIRST_META = /\s*(📅|⏰|🔁|🔺|⏫|🔼|🔽|⏬|#kanban\/|#project\/|\[\[)/;
```

`setText` logic, mirroring `setProject` (989):

1. Resolve `file`; `vault.read`; `split('\n')`.
2. **Raw guard**: `if (task.line >= lines.length || lines[task.line] !== task.raw) return false;` — stronger than the date/time mutators, matching `addSubtask`/`addNoteLinkToTask`, because a title rewrite is destructive to the text span and must not fire on a shifted line.
3. Match the checkbox prefix on `lines[task.line]`: `const m = line.match(/^(\s*- \[[ xX\-]\] )([\s\S]*)$/);` capture group 1 = `prefix` (indent + checkbox), group 2 = `body`.
4. Find token boundary in `body`: `const idx = body.search(FIRST_META);`. If `idx < 0`, the whole `body` is text → `rest = ''`; else `rest = body.slice(idx)` (the leading `\s*` is part of the match, so it is preserved in `rest`).
5. New line = `prefix + newText.trim() + rest`. Write back to `lines[task.line]`, `vault.modify`, return `true`.

This keeps a leading space before the first token (because `rest` begins with the matched `\s*`), so output stays `text 📅 ...` not `text📅...`. Indentation and checkbox come from `prefix`, untouched. Subtask lines are never read — `setText` only ever touches `lines[task.line]`.

### Modal wiring (back to `EditTaskModal`)

- Add `this.newText = task.text || '';` in the constructor (line ~2588 block).
- Replace the read-only `tk-modal-info` div (line 2602) — or add directly below it — with a `new Setting(contentEl).setName(t('title')).setDesc(t('title_edit_desc')).addText(text => text.setValue(this.newText).onChange(v => this.newText = v))`. Keep the `tk-modal-sub` source line (2603) as-is.
- In the Save handler (line 2737), as the **first** action before the date/project mutators, add: `if (this.newText.trim() && this.newText.trim() !== (this.task.text || '')) { await this.plugin.setText(this.task, this.newText.trim()); this.task = (re-read) }`. Because subsequent mutators key off `task.raw`/`task.line` and `setText` changes the raw line, either (a) run `setText` **last** (after date/time/project/recurrence, before `moveTask`), or (b) after `setText` refresh `this.task.raw` so later guards still pass. Simplest: order the mutators so `setText` runs **after** `setProject`/`setDueDate`/`setTime`/`setRecurrence` (which only guard on `task.line`, not `raw`) and **before** `moveTask` (which re-parses by id, not raw). That avoids any stale-`raw` interaction. Then `this.onDone()` triggers the existing refresh.

Note the wikilink: because `[[` is in `FIRST_META`, the wikilink stays in `rest` and is preserved untouched, so the linked-note filename and the card's linked-note button are unaffected. The user edits only the visible title, exactly as intended.

### Settings changes

None. No new persisted settings.

### New UI strings (NL/EN) — add to both `TRANSLATIONS.nl` (~line 201) and `TRANSLATIONS.en` (~line 401)

- `title`: `'Titel'` / `'Title'`
- `title_edit_desc`: `'De taaktekst. Datum, tijd, project en koppelingen blijven behouden.'` / `'The task text. Date, time, project and links are preserved.'`

### Back-compat

- No markdown format change; existing tasks parse and render identically. Existing files are only modified when the user explicitly saves a new title.
- Lines with no metadata, with a wikilink, with unmodeled `#tags`, block refs, or hand-written trailing text all survive because everything from the first token onward is preserved verbatim.
- The raw-line guard means a title rename silently no-ops if the underlying line moved since the board last scanned (same safety contract as `addSubtask`/`deleteTask`).

### Risks and open questions

- **Boundary false-positives.** A literal `#project/` or a `📅`/`[[` appearing *inside* the human title (rare, but possible) would be treated as the start of metadata, truncating the editable span. Mitigation: `FIRST_META` already requires `#kanban/` and `#project/` to be followed by a slash, and priority/date/time emojis inside prose are vanishingly rare; accept this edge as out of scope, matching how `parseTaskLine` itself already assumes the first such token begins metadata.
- **Whitespace-only new title.** Guard against it (reject or keep old) so the line never becomes unparseable.
- **`task.raw` freshness in the modal.** Confirm the modal is opened with a freshly-scanned `task` (it is — cards carry `raw` from the last scan); if the user keeps a stale modal open while editing the file elsewhere, the guard correctly no-ops. Low risk.
- **Follow-up (not this change):** Option C inline card-title editing can later reuse `setText` as its write primitive.

---

## Multiple tags/projects per card

### Current state in this plugin (verified in `main.js`)

The whole model is single-valued for projects, hard-coded around one `#project/<name>` token:

- **Parse** (`parseTaskLine`, lines 632-634): `rest.match(/#project\/([\w-]+(?:\/[\w-]+)*)/)` takes the *first* match only and stores `task.project` as a single string. The text-stripping regex at line 657 (`.replace(/#project\/.../g, '')`) is already global, so a line with two `#project/` tokens today would parse the first as the project and silently drop the second from the title — meaning extra tokens are tolerated but invisible.
- **Format** (`formatTaskLine`, line 935): `if (task.project) line += ` #project/${task.project}``  — one token.
- **Mutate** (`setProject`, lines 989-1006): regex-replaces a single `#project/...` token, or strips all of them if cleared.
- **Color** (`getProjectColor` 951-953, `assignProjectColor` 956-962): `settings.projectColors` and `settings.projectLabels` are flat `{ "client/acme": "#hex" }` maps keyed by the project string.
- **Render** (`renderCard`, lines 1558-1614): one `--tk-project-color` CSS var + `tk-has-project` class drive the whole-card tint; one `.tk-project-badge` is drawn in `headLeft`, with a `.tk-project-parent` breadcrumb for subprojects. Clicking the badge sets `this.filterText = task.project.toLowerCase()`.
- **Filter** (`filterTask`, 1474-1482): substring match over `text + file + dueDate + project + subtasks`. So filtering is already "by string", not "by tag".
- **Edit/Add modals** (`EditTaskModal.newProject` line 2590; `AddTaskModal`): a single text field + suggestion dropdown that lowercases and strips to `[\w\-\/]`.

So "project" is one dimension, one value, one badge, one tint.

### How comparable tools do it

- **Trello**: a card has many *labels* (a flat colored set) plus optional *board* membership. Labels are multi; there is no first-class "primary label". Color comes per-label; the card shows a row of colored chips.
- **Jira**: distinct typed dimensions — *Project* (exactly one, structural), *Components* (many), *Labels* (many, free-form). Swimlanes group by exactly one chosen field. This is the closest analogue to "a CLIENT and a PROJECT on one card".
- **Notion**: a *Multi-select* property = an arbitrary set of colored chips; *Select* = single. Board grouping is by one property.
- **mgmeyers Obsidian Kanban**: tasks are markdown lines; it surfaces *all* `#tags` on a line as inline tags and lets you toggle showing them. It does not have a privileged "project" concept — every `#tag` is equal — and it can color tags via CSS / a tag-color setting.

The cross-tool consensus: **one structural single-valued dimension for grouping/swimlanes, plus one or more free multi-valued dimensions for the rest.** That maps cleanly onto this plugin's "primary project (drives the board) + extra tags".

### Options

**Option A — Allow multiple `#project/x` tokens (a project *set*).**
Parse all matches into `task.projects[]`; the first stays the "primary" for tint/swimlane. Format writes them all back. Colors/labels keep the same flat maps keyed by each project string.
- Pros: zero new vocabulary; perfectly back-compat (single token = array of one); reuses `projectColors`/`projectLabels`/scan/settings unchanged; naturally composes with swimlanes (group by primary). Smallest blast radius.
- Cons: no semantic distinction between "client" and "project" — they're all just projects. The user explicitly wants a CLIENT *and* a PROJECT, which reads awkwardly if both are `#project/`. Two badges of similar style can look redundant.

**Option B — A distinct second dimension `#client/x` alongside `#project/x`.**
Add a parallel field. Both are single-valued (or B could itself be multi). Client gets its own color/label maps and its own badge slot.
- Pros: matches the user's mental model exactly (client vs project); each dimension can have its own swimlane option and its own filter facet; visually you can place client on the left, project on the right with distinct styling.
- Cons: more code duplication; only one extra named dimension unless you generalize; you must pick which dimension tints the card.

**Option C — A general multi-tag set (`#tag/x` or arbitrary `#x`).**
Treat any configured tag namespace as a colored chip set, Notion/Trello style.
- Pros: most flexible; future-proof.
- Cons: biggest rewrite; loses the structural "one project drives the board" semantics that swimlanes need; clashes with Obsidian's global tag pane (every chip becomes a real vault tag); harder to keep the card uncluttered. Over-engineered for "client + project".

### Recommendation

**Adopt a hybrid of A + B, leaning on B's named dimensions but generalizing the plumbing once so you don't duplicate code.** Concretely:

1. Make `#project/x` **repeatable** (Option A): a card may carry several `#project/` tokens. The **first** token in document order is the *primary project* — it alone drives the card tint (`--tk-project-color`/`tk-has-project`) and is the value used for swimlane grouping. Additional projects render as extra (outlined, not filled) badges.
2. Add **one** sibling dimension `#client/x` (Option B) that reuses the *same* color/label/scan/filter code via a small "dimension registry", so client behaves exactly like project (own colors, own labels, own settings sub-section, clickable badge → facet filter) without copy-paste. Client is single-valued (a card belongs to one client) which matches reality and keeps a clean second swimlane axis.

This is the most natural fit for a markdown-tasks model: tags are inherently repeatable in markdown, the "first = primary" rule needs no schema, and a second named hashtag namespace reads naturally in raw markdown (`#client/acme #project/website`). It is fully back-compat: every existing line has exactly one `#project/` and no `#client/`, which decodes to `projects:[one], client:null` and re-encodes byte-identically.

### Data / markdown format

A card line becomes, e.g.:

`- [ ] Draft quote 📅 2026-05-25 ⏰ 09:30 #client/acme #project/website #project/q3-campaign #kanban/doing ⏫ [[Linked note]]`

- `#project/<name>` — **repeatable**; `task.projects` is `string[]`; `task.projects[0]` is primary. Subproject slashes (`#project/client/acme`) still allowed within each token.
- `#client/<name>` — **single**; `task.client` is `string | null`. Same `[\w-]+(?:\/[\w-]+)*` grammar.
- Order on write: keep current ordering (recurrence, date, time, priority, then tags, then `#kanban`); emit `#client` before the `#project` list for stable, diff-friendly output. Document order in the *source* determines which project is primary, so writers must preserve it.

### Settings changes

- `projectColors` / `projectLabels` stay as-is (keyed by project string). Add parallel `clientColors` / `clientLabels` (same shape). Defaulted in `DEFAULT_SETTINGS` to `{}`.
- Generalize via a tiny config array, e.g. `TAG_DIMENSIONS = [{ key:'project', tag:'project', multi:true, colors:'projectColors', labels:'projectLabels' }, { key:'client', tag:'client', multi:false, colors:'clientColors', labels:'clientLabels' }]`. `getProjectColor`/`assignProjectColor`/the settings projects-section loop all become `getTagColor(dim, name)` etc. taking a dimension.
- Optional new setting `swimlaneBy: 'none' | 'project' | 'client'` (ties into the swimlanes proposal — see below).
- `clientScanFolders` can reuse the existing `projectScanFolders` scan logic parameterized by tag namespace, or simply share the same scan and detect both `#project/` and `#client/` in one pass.

### Colors and display labels with several tags

- **Tint**: only the **primary project** colors the card (one `--tk-project-color`), preserving the current calm single-tint look. Do *not* try to blend multiple colors into the card background — that's the main clutter risk.
- **Badges**: primary project = filled badge (current style). Secondary projects = same shape but *outlined* (colored 1px border + colored text, transparent fill) so the eye reads one dominant tag and N supporting ones. Client = filled badge but visually differentiated (e.g. a small leading dot/icon or a slightly different radius) and placed first in `headLeft`.
- **Labels**: `clientLabels`/`projectLabels` resolve per token exactly as `getProjectLabel(task.project)` does today (custom label else last path segment).

### Rendering multiple badges without clutter

In `renderCard`, replace the single project block (1589-1614) with a `headLeft` row that renders, in order: client badge (if any) → primary project badge → secondary project badges. To avoid overflow:

- Cap visible secondary badges at **2**; collapse the rest into a `+N` chip whose tooltip lists them (click opens the edit modal). The `.tk-project-wrap` flex container already clips with `overflow:hidden`; add `flex-wrap: nowrap` + the `+N` overflow chip rather than wrapping to many rows.
- Reuse `.tk-project-badge`; add `.tk-project-badge--secondary` (outline) and `.tk-client-badge` (dot/icon) modifiers in `styles.css` near line 186.
- Keep the subproject breadcrumb (`.tk-project-parent`) only for the **primary** project to limit noise; secondaries show just the leaf label.

### Filtering by tag

Today filtering is a plain substring (`filterTask`). Two-step improvement:

1. **Cheap, ships now**: extend the `hay` string in `filterTask` (line 1478) to include `task.projects.join(' ') + ' ' + (task.client||'')`. Badge clicks already set `filterText`; make every badge (client + each project) clickable to set the filter to that token. This alone gives multi-tag filtering with no UI work.
2. **Better (optional)**: introduce true *facet* filtering — an active-tag chip set in the header. Clicking a badge adds it as a facet; `filterTask` becomes `activeFacets.every(f => task.projects.includes(f.value) || task.client===f.value)`. Keep the free-text box for title search. This is the Trello/Jira behavior and avoids the false positives a substring filter has (e.g. filtering `acme` also matching a title containing "acme").

I'd ship #1 in the same PR and leave #2 as a follow-up.

### Composition with swimlanes (group-by-one-dimension)

This design is built for it. Swimlanes group rows by **exactly one single-valued key per task**:

- Grouping by **client** is unambiguous — `task.client` is single-valued, so each card lands in exactly one lane (plus a "No client" lane). This is the cleanest swimlane axis and a strong reason to make client single-valued.
- Grouping by **project** uses `task.projects[0]` (the primary) — also single-valued by the "first = primary" rule, so no card is duplicated across lanes. Secondary projects are still shown as badges but don't split the card. This neatly sidesteps the classic multi-value-swimlane problem (a card with two projects appearing twice).
- `swimlaneBy` selects which dimension's single value keys the lanes; the other dimension keeps showing as badges. So you can have **client swimlanes** with **project badges**, or vice-versa — exactly the "a client and a project on one card" use case the user described.

### Implementation sketch (functions/files to touch)

`main.js`:
- `parseTaskLine` (607): use `matchAll(/#project\/(...)/g)` → `projects[]`; add `#client/(...)` single match → `client`. Keep `project` as an alias getter (`projects[0]`) so untouched call-sites keep working during migration. Global-strip both namespaces from `text` (the project strip is already global; add client).
- `formatTaskLine` (928): emit `#client/${client}` then `projects.map(p=>`#project/${p}`).join(' ')`.
- `setProject` (989): generalize to `setTagDimension(task, dim, values)` that rewrites all tokens of one namespace (replace-all then re-append in canonical order) — more robust than the current single-token replace, and needed now that there are several.
- `getProjectColor`/`assignProjectColor`/`getProjects` (940-962): parameterize by dimension → `getTagColor(dim,name)`, `assignTagColor(dim,name)`, `getTagValues(dim)`. Have `projectScanFiles` detect both namespaces.
- `renderCard` (1544-1614): primary-only tint block stays; new multi-badge `headLeft` row with overflow `+N`; make all badges clickable filters.
- `filterTask` (1474): include projects array + client in `hay` (and, if doing facets, the facet check).
- `EditTaskModal` (2582): replace single `newProject` text field with a chip editor for projects (add/remove, with the existing suggestion source) plus a single `client` field; on save, diff against `task.projects`/`task.client` and call the generalized setter. (This dovetails with the separate "edit card title" gap.) `AddTaskModal` (2433): same controls.
- Settings (around 3240): the projects loop becomes a per-dimension loop rendering a "Projects and colors" and a "Clients and colors" section from `TAG_DIMENSIONS`. Add a `swimlaneBy` dropdown if swimlanes land together.
- i18n: every new string needs nl + en (the `nl`/`en` blocks ~140-490). New keys: `sec_clients`, `clients_help`, `client`, `client_of`, `client_edit_desc`, `client_placeholder`, `client_label_placeholder`, `add_project`/`remove_project` (for the chip editor), `more_tags` (the `+N` tooltip), and `swimlane_*` if applicable.

`styles.css`:
- Near `.tk-project-badge` (186): add `.tk-project-badge--secondary` (transparent bg, `border:1px solid var(--tk-badge-color)`, colored text), `.tk-client-badge` (filled + leading dot via `::before`), and `.tk-badge-overflow` (`+N`). Set `.tk-project-wrap { flex-wrap: nowrap }` and let the overflow chip absorb extras.

### Back-compat

- Existing lines: one `#project/`, no `#client/` → `projects:[x]`, `client:null` → re-serializes identically (verify the canonical order matches what `formatTaskLine` already emits for the single-project case so untouched cards don't churn on first edit).
- `data.json`: `projectColors`/`projectLabels` untouched; new `clientColors`/`clientLabels`/`swimlaneBy` default empty/`'none'` so old configs load unchanged.
- Keep a `task.project` getter returning `projects[0]` so any missed call-site (templates `{{project}}` line 1182, calendar view) keeps functioning until fully migrated.

### Risks and open questions

- **Obsidian tag pane pollution**: every `#client/x` becomes a real vault tag in the global tag pane and graph. That's arguably desirable (consistency with `#project/`) but worth a conscious decision; the alternative (an inline field like `client:: acme`) avoids the tag pane but breaks the "it's just hashtags" simplicity and the existing scan logic.
- **"First = primary" fragility**: primary is positional, so reordering tokens in raw markdown silently changes the tint/swimlane. Mitigate by always re-emitting primary-first in `formatTaskLine`, and document it.
- **Calendar view & Outlook sync**: confirm they only read `task.project` for display (the getter covers them) and don't need multi-project awareness.
- **Subproject + multi-project interaction**: `#project/client/acme #project/internal` — make sure the per-token subproject breadcrumb logic isn't applied to the whole set.
- **How many named dimensions?** Recommendation stops at project + client. If the user later wants `#area/`, `#context/`, etc., the `TAG_DIMENSIONS` registry already generalizes — but each still needs a settings section and i18n, so don't open the floodgates without a UI for managing dimensions.
- **Filter semantics**: substring (cheap) vs facet AND/OR (correct). Decide whether multi-facet filtering is AND or OR before building step 2.

---

## Swimlanes (group-by horizontal lanes) and their interplay with multi-tag cards

### Current state in this plugin (verified in `main.js`)

The board today has exactly one grouping dimension: the status column. `renderBoard()` (around line 1460) builds a single flex row `.tk-board`, prepends a synthetic `'inbox'` column when `settings.showInbox`, then loops `this.plugin.settings.columns` calling `renderColumn(board, col)`. `renderColumn()` (line 1498) calls `tasksForColumn(columnId)` (line 1484), which filters `this.tasks` by `t.column === columnId` (or `!t.column` for `'inbox'`), applies the text filter + hide-done via `filterTask()`, and sorts by due date. Cards are drawn by `renderCard()` (line 1544). The CSS (`styles.css`) makes `.tk-board` a horizontally-scrolling flex row of fixed-width `.tk-column`s, each with a scrollable `.tk-cards` body and a per-column drop target wired to `moveTask(taskId, columnId)`.

Crucially for this proposal, a task today carries a **single** project (`parseTaskLine` line 632-634 matches the first `#project/...` only) and no general tag list. Column membership lives in the markdown line as `#kanban/<id>`; `moveTask` rewrites that tag. Project is `#project/<name>`. There is no second axis to group by yet. The multi-tag work is a sibling proposal; this design must assume a card may expose an array (e.g. `task.tags` / `task.projects`) once that lands, while still working when a card has only the legacy single `task.project`.

### How comparable tools do it

- **Trello** has no true swimlanes natively; power-ups fake them. Its mental model is one-dimensional lists, so it is a weak reference here.
- **Jira (company-managed boards)** is the gold standard: a single "Swimlanes" board setting with options *None, Stories, Assignees, Epics, Projects, Queries (JQL)*. Lanes are rows, columns stay vertical, you get a grid. There is always an implicit catch-all lane ("Issues without epics" / "Everything else"). Lanes are collapsible and remember collapsed state. A card lives in exactly one lane because the grouping fields (epic, assignee) are single-valued — Jira sidesteps the multi-value problem entirely.
- **Notion board view** groups by one property ("Group") and optionally sub-groups by a second ("Sub-group"), which is literally columns x lanes. For a multi-select property, Notion's documented behaviour is that a card with multiple values **appears once per matching group** (it is duplicated into each lane). It also has a visible "No <property>" group. Toggling sub-group on/off is one click in the view header.
- **mgmeyers Obsidian Kanban** (the popular plugin) does not have swimlanes; it is single-board, columns-only. So there is no direct Obsidian precedent — this would be a differentiator.

The convergent pattern: a single header selector for the lane dimension, lanes as collapsible rows, an explicit catch-all lane, and for multi-valued grouping fields the card shows up in every matching lane.

### Options

**Option A — Swimlanes as a pure view-layer transform (recommended).** Keep the markdown format and `tasksForColumn` semantics untouched. Add a per-view `groupBy` state plus a `renderLanes()` layer between `renderBoard` and `renderColumn`. Each lane is a labelled horizontal band that itself contains the existing column row, filtered to that lane's task subset. Nothing about how tasks are stored changes; swimlanes are 100% a rendering/filtering concern.
- Pros: zero format/back-compat risk; reuses `renderColumn`/`renderCard`/drag-drop almost verbatim; trivially supports "appears in every lane" because it is just a second filter predicate; easy to turn off (groupBy = none falls back to today's exact code path).
- Cons: with N lanes x M columns you render N*M column shells; needs care with many cards (see performance).

**Option B — Restructure the data model so lane membership is a stored field.** Add a `#lane/<x>` tag or reuse projects as physical lanes that drag-drop rewrites.
- Pros: drag a card vertically to change its lane value.
- Cons: heavy; conflates "which dimension am I viewing by" with "what is written in the file"; breaks the clean single-dimension model; large back-compat surface. Not worth it for v1.

**Option C — Sub-group dropdown like Notion (group + sub-group both configurable).** Generalise so *either* axis can be column-or-anything.
- Pros: maximum power.
- Cons: the status column is special here (it is the `#kanban` tag and the drag-drop target); making it "just another axis" complicates `moveTask`. Over-engineered for now.

### Recommendation

Go with **Option A**, scoped as a per-view (not persisted-to-file) feature, with these decisions:

**Lane dimensions offered** in the header selector "Group by / Lanes":
1. `none` (default) — today's behaviour exactly.
2. `project` — one lane per project value. With subprojects (`client/acme`), group by the **top segment** by default (`client`) with a setting to group by full path; this matches the existing badge logic that already special-cases `segments[0]`.
3. `priority` — fixed lanes in fixed order: Highest, High, Medium, Low, Lowest, then "No priority". Order is semantic, not alphabetic.
4. `due` (date bucket) — Overdue, Today, Tomorrow, This week, Later, No date. Buckets reuse the existing `todayISO()` / overdue logic already in `renderCard`.
5. `tag` — once multi-tag lands, one lane per tag value. **This is the dimension where the multi-tag interplay matters.**
6. `custom` — future-proof hook: a user-defined ordered list of lane definitions, each with a label + a predicate (a tag/project match or a saved filter string). Ship the plumbing, expose later.

**The multi-tag x swimlanes interplay (the crucial part).** Swimlanes group by exactly **one** dimension at a time; multi-tag means a card may match several lanes within that one dimension. Define a per-lane membership predicate `laneMatch(task, lane)` and resolve a card against a lane list:

- Default behaviour: **a card appears in every lane it matches** (Notion semantics). A task tagged `#client/acme #internal` shows in both the `acme` lane and the `internal` lane when grouping by tag. This is the least-surprising default for "where is all my acme work" and avoids hiding work.
- Provide a per-view toggle **"Primary lane only"** (default **off**). When on, a multi-match card is placed only in its **primary** value — defined as the **first** tag/project in document order (the array order from the parsed line; for legacy single-project tasks there is exactly one). This gives users who dislike duplication a clean one-card-one-lane board without changing files.
- For single-valued dimensions (`priority`, `due`, single `project`) the "appears in every lane" question is moot — each card matches exactly one lane, so the toggle has no effect and can be hidden.
- A card matching **no** value in the active dimension always falls into the catch-all **"Uncategorised"** lane (localised: NL "Zonder <dimensie>" / EN "No <dimension>"), rendered last. When "primary lane only" is on, a card with zero values still goes here; a card with >=1 value never appears here.
- Duplicate cards (same task in two lanes) must keep working with drag-drop: the drop still calls `moveTask` with the column id, which only rewrites `#kanban`, so moving any copy horizontally moves the underlying task and all its copies refresh together on the next `scheduleRefresh()`. Vertical drag between lanes is **disabled in v1** (it would mean rewriting tags, which reopens Option B); document this.

**Sensible defaults:** `groupBy: 'none'`, `primaryLaneOnly: false`, `laneProjectDepth: 'top'`, collapsed-lane state empty, lanes sorted: project/tag alphabetically with Uncategorised last; priority/due in their semantic order with the empty bucket last.

### Exact data / format / settings changes

**No change to the markdown task format and no change to `parseTaskLine`/`formatTaskLine`.** This is the headline back-compat win: existing tasks render identically, and a vault opened by an old plugin version is unaffected because nothing new is written to files.

View-local state on `KanbanView` (mirrors how `filterText`/`hideDone` already live on the instance, lines 1395-1396):
```
this.groupBy = 'none';          // 'none' | 'project' | 'priority' | 'due' | 'tag' | 'custom'
this.primaryLaneOnly = false;
this.collapsedLanes = new Set();
```

Persist the user's last choice (nice-to-have, not required) in `DEFAULT_SETTINGS` so it survives reloads:
```
swimlaneGroupBy: 'none',
swimlanePrimaryOnly: false,
swimlaneProjectDepth: 'top',   // 'top' | 'full'
swimlaneCollapsed: [],          // remembered collapsed lane ids per groupBy, optional
swimlaneCustomLanes: [],        // [{ id, labelNl, labelEn, match }] for the 'custom' dimension
```
Because these are additive keys merged through the existing `Object.assign({}, DEFAULT_SETTINGS, saved)` in `loadSettings()` (line 899), older `data.json` files load with defaults — fully back-compatible.

New i18n strings (both NL and EN, added to both blocks in the `T`/translations object): `group_by` ("Groeperen / Banen" / "Group by / Lanes"), the dimension option labels, `lane_uncategorised` with a `{dim}` placeholder ("Zonder {dim}" / "No {dim}"), `primary_lane_only` ("Alleen primaire baan" / "Primary lane only"), `lane_collapse`/`lane_expand`, and the priority/due bucket lane names.

### Implementation sketch (functions/files to touch)

**`main.js`:**

1. **Header control** in `render()` (near line 1443, beside the filter and hide-done): add a `<select class="tk-groupby">` populated from the dimension list; on `change` set `this.groupBy`, persist to settings, and call `this.renderBoard(container)`. When `groupBy === 'tag' || 'project'` also render the "Primary lane only" checkbox; wire it to `this.primaryLaneOnly` + re-render.

2. **`renderBoard(container)`** (line 1460): branch on `this.groupBy`. If `'none'`, keep the current code path verbatim (build `.tk-board`, loop columns). Otherwise call a new `renderLanes(container)`.

3. **New `buildLanes()`** — pure helper returning an ordered array `[{ id, label, match(task) }]` for the active dimension:
   - `project`: derive distinct values from `this.tasks` (respecting `swimlaneProjectDepth`), sort, append Uncategorised. `match = t => projectValuesOf(t).includes(id)`.
   - `priority`: fixed list mapping to `t.priority`.
   - `due`: fixed buckets, `match` uses date math against `todayISO()`.
   - `tag`: distinct over `tagValuesOf(t)` (the multi-tag array; until that lands, fall back to `[t.project]`).
   - `custom`: from `settings.swimlaneCustomLanes`.
   Centralise `projectValuesOf(task)` / `tagValuesOf(task)` as small helpers so the legacy single-`project` path and the future array path share one code site.

4. **New `renderLanes(container)`** — replaces the single `.tk-board` with one `.tk-lane` band per lane. Each band has a `.tk-lane-head` (caret toggle bound to `this.collapsedLanes`, label, count) and, when expanded, a `.tk-board` row built exactly like today. For each lane it computes that lane's task subset **once**: `const laneTasks = this.tasks.filter(t => laneMatch && ...)`, honouring `primaryLaneOnly` (keep card only if `id === primaryValueOf(t)`), then renders columns from that subset.

5. **`tasksForColumn(columnId, sourceTasks = this.tasks)`** (line 1484): add an optional `sourceTasks` parameter defaulting to `this.tasks`, so `renderLanes` can pass the pre-filtered lane subset while `renderColumn` stays otherwise unchanged. `renderColumn(parent, columnId, sourceTasks)` forwards it. This is a minimal, surgical signature change — the only edit to the existing column code.

6. **Counts/empty lanes:** skip rendering a lane with zero matching cards when grouping by tag/project (avoids dozens of empty rows), but always keep Uncategorised and the fixed priority/due buckets you choose to show-empty (make "hide empty lanes" a small setting, default on).

**`styles.css`:**

- `.tk-lane` { display: flex; flex-direction: column; } stacked vertically inside the container (the container's outer scroll becomes vertical for lanes, horizontal stays inside each lane's `.tk-board`).
- `.tk-lane-head` sticky label bar (`position: sticky; left: 0`) with a caret; `.tk-lane.is-collapsed .tk-board { display: none; }`.
- Reuse `.tk-board`/`.tk-column`/`.tk-cards` unchanged inside each lane. Optionally tint the lane head with the project colour via the existing `--tk-project-color` mechanism when grouping by project.

### Back-compat

- Files are never rewritten for swimlanes; `parseTaskLine`/`formatTaskLine`/`moveTask` are untouched. An existing vault and an older plugin build both keep working.
- New settings keys are additive and merged with defaults, so old `data.json` loads cleanly; a user who never opens the Group-by selector sees today's exact board.
- The single signature change (`tasksForColumn`/`renderColumn` gaining an optional `sourceTasks` arg) is backward-default to `this.tasks`, so the `groupBy: 'none'` path is byte-for-byte equivalent in behaviour.

### Performance with many cards

- The naive cost is N_lanes x M_columns column shells plus the cards. Cards are the real cost. Mitigations, in order:
  1. **Render collapsed lanes as head-only** (no `.tk-board`, no cards) — this is the single biggest lever; a user with 40 projects collapses all but the few they care about.
  2. **Hide empty lanes** by default (setting above).
  3. **Compute lane subsets once** per lane (one `filter` pass), and within a lane reuse the already-filtered+sorted `tasksForColumn` on the small subset rather than re-scanning `this.tasks` per column.
  4. If profiling shows jank at thousands of cards, lazily build a lane's `.tk-board` only when it scrolls into view (IntersectionObserver) or on expand — but defer this until measured; v1 should ship the simpler eager render plus collapse.
- Note that "appears in every matching lane" multiplies card DOM nodes for heavily-multi-tagged cards; the "Primary lane only" toggle is also the performance escape hatch for power users with many tags.

### Risks and open questions

- **Vertical drag-drop between lanes** is intentionally out of scope for v1 (it would mean writing the lane dimension back into the file, i.e. Option B). Decide whether to *visually* forbid the vertical drop or silently no-op it. Recommendation: allow horizontal drops only; ignore cross-lane drops.
- **Duplicate-card identity:** the same `taskId` (`file::line`) appears in multiple lanes. Confirm nothing keys on uniqueness of `data-task-id` in the DOM (current `moveTask`/drag code reads it from the dragged element, so duplicates are fine, but verify the calendar/refresh paths).
- **"Primary" definition:** first value in document order is simple and predictable, but a user might expect "highest-priority project". Ship document-order; revisit if requested.
- **Multi-tag dependency:** the `tag` dimension and `tagValuesOf` are only fully meaningful once the multi-tag proposal lands. Ship the swimlane framework now with `project`/`priority`/`due` working off existing fields, and have `tag` degrade to the single project until then — so the two features can land independently.
- **Interaction with the Inbox synthetic column and `autoMoveToday`:** lanes cross all columns including inbox; confirm the auto-move-to-doing behaviour still reads cleanly when a card is duplicated across lanes (it operates on the underlying task list, not the rendered copies, so it should be unaffected — but add a test note).

---

## Multiple boards

### Current state in this plugin

There is exactly one board, and "the board" is really just the global settings object read live by the view. Concretely:

- `DEFAULT_SETTINGS` (main.js line 22) keeps the board configuration at the top level: `columns`, `columnLabels`, `defaultColumn`, `doneColumn`, `inProgressColumn`, `showInbox`, plus behaviour flags `autoMoveToday`/`autoMoveOverdue`. There is no concept of a "board" object.
- `KanbanView` (line 1390) holds only transient state (`filterText`, `hideDone`) and reads structure straight from `this.plugin.settings`: `renderBoard()` (1460) builds columns from `settings.columns` and prepends `'inbox'` when `settings.showInbox`; `renderColumn()` (1498) labels via `settings.columnLabels` and marks `settings.doneColumn`; `tasksForColumn()` (1484) buckets tasks purely by `t.column` (no project/folder scoping).
- `scanTasks()` (787) reads **every** markdown file in the vault and returns the full task list; there is no per-board filter. `projectScanFolders` / `projectScanFiles()` (820) is used **only** for project-tag detection in settings, not for restricting what the board shows.
- The view is a singleton: `activateView()` (877) does `getLeavesOfType(VIEW_TYPE_KANBAN)[0]` and creates one tab if none exists. `refreshViews()` (778) re-renders **all** Kanban leaves. There is one ribbon icon (683) and one `open-kanban` command (686).
- The task object (parseTaskLine, 663) carries `column`, `project`, `dueDate`, `priority`, `file`, etc. A single `#project/<name>` (supports `client/acme` subprojects via the regex at 633) and one `#kanban/<column>` tag.

So today a "board" is the global column config applied to a vault-wide task scan, displayed in one leaf.

### How comparable tools do it

- **Trello**: boards are first-class top-level objects; each has its own lists (columns), and cards live inside a board. A board picker / boards home is the primary navigation. Per-board filters and a per-board group-by (swimlanes) are board-scoped settings.
- **Jira**: a board is a *saved query plus a column mapping*. The board does not own the issues; it filters them (a JQL filter) and maps statuses to columns. Multiple boards can show overlapping issues. Swimlanes are a per-board group-by (by assignee, epic, query). This is the closest analogue to your "tasks scattered across the vault, tagged" model.
- **Notion**: a board is one *view* of a database; the same items appear across many views, each with its own filter, group-by (the board's grouping column = swimlanes), and visible properties.
- **mgmeyers Obsidian Kanban**: the opposite model — each board **is** a single markdown file, columns are headings, cards are list items inside that file. Multiple boards = multiple files, opened as a custom view on that file's leaf. There is no cross-board scope/filter because the file *is* the scope.

Your model is the Jira/Notion one, not the mgmeyers one: tasks are global and tagged, a board is a *lens* (filter + column mapping + grouping). The design below leans into that, which is also the least disruptive to your existing data format (no per-board files, existing tasks keep working untouched).

### Options

**Option A — `settings.boards[]`, board-as-a-lens, one shared leaf (recommended).**
A board is a config object: `{ id, name, columns, columnLabels, defaultColumn, doneColumn, inProgressColumn, showInbox, scope, groupBy, autoMove... }`. The KanbanView becomes board-aware via view state (`state.boardId`). The existing top-level fields are migrated into `boards[0]` (the default board). One leaf normally, but multiple leaves with different `boardId` are allowed.
- Pros: matches your tagged/global-task model; minimal data-format change (zero changes to task lines); back-compat is a clean wrap-the-old-config migration; supports per-board scope + swimlanes without new markdown syntax; cheap to render (filter the same `scanTasks()` result).
- Cons: requires threading "active board" through ~6 read sites in KanbanView and the auto-move logic; settings UI grows a board list.

**Option B — board-as-a-file (mgmeyers style).**
Each board is a dedicated markdown file; cards live in that file.
- Cons: a totally different data model from what you have; would orphan every existing `#kanban/` task; throws away the "one task can appear on several boards" property that falls out naturally from tags. Reject.

**Option C — multiple leaves only, no named config (each leaf just remembers a filter string).**
Reuse the existing `filterText` + a per-leaf project filter, persisted in view state, with no `boards[]` array.
- Pros: tiny change.
- Cons: no per-board columns/roles/group-by, no named boards, no ribbon/command per board, no shareable definition. It is "saved filters", not "boards". Falls short of the ask.

### Recommendation

Go with **Option A**. It is the powerful-but-not-over-engineered fit for a tag-based, vault-wide task model: a board is a named lens (scope + columns + group-by) over the existing global scan, the data format on disk is unchanged, and back-compat is a single deterministic migration.

Keep it from over-engineering by: (1) one `boards[]` array in `data.json`, no separate files; (2) the KanbanView stays a single class, just parameterised by the active board; (3) cross-board task identity stays exactly as today (tasks are global, a board only filters/maps them).

### Data and settings format

New shape in `DEFAULT_SETTINGS` (line 22). Move the board-structural fields under a board object and add a `boards` array + `activeBoardId`:

```js
// new
boards: [{
  id: 'default',
  name: 'Kanban',                 // shown in picker/tab; bilingual default
  columns: ['todo','doing','waiting','done'],
  columnLabels: { todo:'Te doen', doing:'Bezig', waiting:'Wacht op reactie', done:'Klaar' },
  defaultColumn: 'todo',
  doneColumn: 'done',
  inProgressColumn: 'doing',
  showInbox: true,
  autoMoveToday: true,
  autoMoveOverdue: false,
  scope: { projects: [], folders: [], tags: [], match: 'any' }, // empty = whole vault (today's behaviour)
  groupBy: 'none',               // 'none' | 'project' | 'priority'  (swimlanes)
}],
activeBoardId: 'default',
```

Fields that stay global (do NOT move per-board): `inboxNote`, `projectColors`, `projectLabels`, note-linking (`noteFolder`/`noteTemplate`/`archiveNotesOnDone`/`archiveFolder`), `language`, all Outlook settings, and `projectScanFolders` (see relationship note below).

**Scope semantics:** `scope.projects` matches `t.project` by prefix so a board scoped to `client` includes `client/acme` (reuse the subproject convention from the regex at line 633). `scope.folders` matches `t.file` by folder prefix (same logic as `projectScanFiles()` at 820, which you can extract into a shared `fileInFolders(path, folders)` helper). `scope.tags` is a forward-looking hook for the separate multi-tag proposal; ship it as an empty-capable field now, wire it when tag parsing lands. Empty scope = whole vault = today's exact behaviour.

### Implementation sketch (functions/files to touch)

`main.js`:

1. **Settings shape + migration** in `loadSettings()` (897). After the `Object.assign` with `DEFAULT_SETTINGS`, add `migrateToBoards(this.settings)`:
   - If `saved && !saved.boards`: build `boards = [{ id:'default', name: t('board_title'), ...pick the old top-level fields... , scope:{...empty}, groupBy:'none' }]`, set `activeBoardId='default'`, and leave the old top-level keys in place for one release (read-through fallback) or delete them after copying. Keep the existing "waiting column" migration (914-921) but run it against `boards[0]` instead of `settings.columns`.
   - Fresh install (`!saved`): seed `boards[0]` from defaults, applying `DEFAULT_COLUMN_LABELS_EN` to `boards[0].columnLabels` when `lang==='en'` (move the block at 903-908 to operate on the board).
2. **Accessor**: add `activeBoard()` / `getBoard(id)` on the plugin returning the board object (fallback to `boards[0]`). Add a `boardScopeFilter(board)` returning a predicate over a task.
3. **KanbanView board-awareness** (1390):
   - Add `getState()/setState()` so `boardId` persists in workspace layout; store `this.boardId` and resolve `this.board = plugin.getBoard(this.boardId)` at the top of `render()`.
   - Replace every `settings.columns / columnLabels / doneColumn / showInbox / inProgressColumn` read inside `renderBoard` (1466-1467), `renderColumn` (1501,1505), and `tasksForColumn`/`filterTask` with `this.board.*`.
   - In `tasksForColumn()` (1484), pre-filter by `plugin.boardScopeFilter(this.board)` before the column bucket.
   - `getDisplayText()` (1400) returns the board name so each tab shows its board.
   - Header (1424): add a board-picker dropdown (a `<select>` of `settings.boards`) next to the title; on change, `this.leaf.setViewState({ type: VIEW_TYPE_KANBAN, state:{ boardId } })` then `render()`.
   - **Group-by/swimlanes**: when `this.board.groupBy !== 'none'`, wrap `renderBoard` to emit one row of columns per group value (distinct `t.project` or priority among in-scope tasks), each row a `.tk-swimlane` with a label; reuse `renderColumn` per (group, column) cell by passing an extra `swimValue` to further filter `tasksForColumn`. This is additive — `groupBy:'none'` renders exactly as today.
4. **Auto-move** `autoMoveDueTasks()` (831) currently reads global `inProgressColumn`/`defaultColumn`. Make it take a board (or iterate boards): run per board over its in-scope tasks using that board's columns. `KanbanView.render()` (1414) calls it with `this.board`.
5. **Open/switch plumbing**:
   - `activateView(boardId)` (877): find a leaf whose `view.boardId === boardId`; if none, open a tab and `setViewState({ type, state:{ boardId } })`. Default `boardId = settings.activeBoardId`.
   - In `onload()` (672): register a static ribbon + `open-kanban` command that opens the active/default board, **plus** dynamically register one command per board (`open-board-<id>`, name `t('open_board') + ': ' + board.name`) and a generic "Open board (picker)" command using a `SuggestModal`. Re-register board commands after settings change (simplest: register all current boards on load; for added boards, instruct via a small "reload to add command" note, or rebuild on settings save).
   - `refreshViews()` (778) already loops all Kanban leaves and calls `render()`; since each leaf re-resolves `this.board`, multi-board multi-leaf refresh works with no change.
6. **Modals**: `AddTaskModal`/`EditTaskModal` read `settings.columns`/`columnLabels` (2470, 2609). Pass the **active board** in (the view already constructs these) so the column dropdown lists that board's columns; new tasks default to that board's `defaultColumn` and, if the board is project-scoped to a single project, pre-fill `#project/<that>`.

`styles.css`: add `.tk-board-picker` (header select styling, sits in `.tk-header`), and `.tk-swimlane` / `.tk-swimlane-label` / a `.tk-board.tk-grouped` grid for the swimlane rows. The existing `.tk-board`/`.tk-column`/`.tk-cards` styles are reused per cell.

`TRANSLATIONS` (84): add NL/EN keys: `boards` ("Borden"/"Boards"), `add_board` ("Bord toevoegen"/"Add board"), `board_scope` ("Bereik"/"Scope"), `board_groupby` ("Groeperen op"/"Group by"), `group_none`/`group_project`/`group_priority`, `switch_board` ("Wissel van bord"/"Switch board"), `rename_board`, `delete_board`, `default_board_name` ("Kanban"). Move the per-board column settings UI (currently 2836+) under a board selector in the settings tab so columns/roles are edited *for the selected board*.

### Relationship to `projectScanFolders`

`projectScanFolders` stays a **global** setting: it governs project *detection* (which folders are searched for `#project/` tags to auto-assign colors — `detectProjects` / `projectScanFiles()` 820). It must not be conflated with a board's `scope.folders`, which governs which tasks a board *displays*. Keep them separate but make the board-scope UI offer a "use project-scan folders" convenience and reuse the same `fileInFolders()` helper. If you ever want a board literally equal to "the project-scan area", the user just leaves board scope empty and sets folders there — but the two concerns should remain independent settings.

### Back-compat

- Existing task lines are untouched — there is no new markdown syntax. A task with `#kanban/doing #project/aim` simply appears on any board whose scope includes it (the default board: all of them).
- The migration wraps today's exact config as `boards[0]` with empty scope and `groupBy:'none'`, so an upgraded vault shows the identical board it had before, in the same single leaf, with the same ribbon/command. `activeBoardId='default'`.
- Keep reading the old top-level `columns`/`doneColumn`/etc. as a fallback for one release in case any code path is missed, then remove.
- The Calendar view is unaffected (it is not board-scoped); leave it global, or, as a later enhancement, let it honour the active board's scope behind a toggle.

### Risks and open questions

- **Dynamic per-board commands**: Obsidian's command registry is normally populated in `onload`; adding/removing a board mid-session won't register/unregister its command until reload. Decide between (a) re-register all board commands on every settings save (works, slight churn), or (b) ship only one "Open board (picker)" command plus the ribbon, and accept that per-board commands appear after the next reload. Recommend (b) for simplicity, (a) if power users ask.
- **Swimlane scope**: `groupBy:'project'` on a board already scoped to one project yields a single lane — fine, but the UI should hide the group-by control or fall back to `none` in that case.
- **Auto-move across boards**: a task in scope of two boards with different `inProgressColumn` roles could be auto-moved by either. Document that auto-move keys off each board's role mapping; in practice scopes rarely overlap. Consider gating auto-move to the *active/visible* board to avoid surprise mutations from boards no one is looking at.
- **Counts/performance**: `scanTasks()` still scans the whole vault once per render; board scope is an in-memory filter, so multiple open boards are cheap. No new IO. Keep the single shared scan (don't scan per board).
- **Open question**: should a board be able to *write* its scope (e.g. new tasks added on a project-scoped board auto-get that `#project` and a board-default folder)? Recommended yes for single-project/single-folder scopes, skipped for multi-value scopes (ambiguous).

---

## Card covers + CSS-targetable metadata

### Direct answer to the user's question

No, not today — neither feature exists in the current plugin, and the reasons are baked into the data model.

1. **Cover images / cover text:** There is no cover of any kind. `renderCard()` (`main.js:1544`) builds a fixed layout: a header (project badge + subtask badge + note button + delete), a checkbox + title row (`tk-card-text`), an optional subtask list, a meta row, and a source link. There is no image element anywhere and no field that could hold one. `parseTaskLine()` (`main.js:607`) only recognises six tokens (`📅` date, `⏰` time, `🔁` recurrence, `#kanban/…`, `#project/…`, priority emoji) plus the first `[[wikilink]]`; everything else is stripped into the plain `text`. So a client logo or a client name "in a property" has nowhere to live. This is unlike the **mgmeyers Obsidian Kanban** plugin, which stores each card's metadata as YAML/inline frontmatter inside a dedicated board file and has a built-in cover-image option — here a card is just a checkbox line scattered in any vault note, so there is **no per-card frontmatter** to hang a cover on. A cover therefore has to be expressed as a new inline token on the task line.

2. **CSS-targetable metadata values:** Partially, but not the way the user wants. Priority is exposed as a *card-level* class — `card.addClass(\`tk-prio-${task.priority}\`)` (`main.js:1556`) — so you can already style `.tk-card.tk-prio-highest`, and `styles.css:164` does exactly that (red top border). But the priority *element itself* (`meta.createSpan({ cls: 'tk-prio' })`, `main.js:1709`) only carries the generic class `tk-prio` and an emoji as text — there is **no per-value hook on the element**, so you cannot make "emergency = red pill, active = green pill" via the pill element. Date/time (`tk-due`), recurrence (`tk-recur`) and the project badge are likewise value-agnostic at the element level (project gets an inline `background` color from settings, not a CSS-addressable value). So the answer to "can I target their values with CSS and make pills" is: not yet for the value, only for the whole card via the priority class.

Below is a concrete design to add both, staying inside the markdown-checkbox model and keeping every existing task working untouched.

### How comparable tools do it

- **Dataview inline fields** establish the de-facto Obsidian convention: `key:: value` (or `[key:: value]` bracketed, inline anywhere on a line). Dataview renders the value and exposes it for styling; this is the natural, familiar syntax for an Obsidian audience and the one I recommend adopting. The bracketed form `[cover:: …]` is visually quiet in source mode and won't collide with this plugin's emoji tokens.
- **mgmeyers Obsidian Kanban** has a first-class "cover image" (drag an image onto a card, stored as an embedded `![[image.png]]` in the card's metadata), and renders metadata as styled tags you can target with CSS. It also famously ships an empty `.kanban-plugin` body so user snippets can restyle everything. The lesson: pick one obvious field, auto-detect image vs. not, and expose generous CSS hooks.
- **Trello** = one image/color cover per card, optionally full-bleed, with text auto-contrasting. **Jira** = colored labels/priority chips. **Notion** = one cover image + colored "select"/"status" pills whose color is data-driven. The common denominator worth copying: **one cover slot per card**, and **every metadata value rendered as a pill whose appearance is data-driven**.

### Recommended design

**One inline field for the cover, data attributes for everything.** Concretely:

#### (1) Card cover — field, detection, rendering

Adopt a Dataview-style inline field `[cover:: <value>]` on the task line. One field, three value shapes, auto-detected:

- **Vault image / attachment:** `[cover:: [[acme-logo.png]]]` or `[cover:: ![[acme-logo.png]]]` → resolve via `app.metadataCache.getFirstLinkpathDest()` (already used for `noteLink` at `main.js:1634`), get a resource URL via `app.vault.getResourcePath(file)`, render an `<img>`.
- **URL image:** `[cover:: https://…/logo.png]` → if it matches `^https?://` (and ends in an image extension *or* you just try it and fall back on `img.onerror`), render an `<img src>` directly.
- **Plain text otherwise:** `[cover:: Acme B.V.]` → render the text as a banner (the client-name case). This is exactly the "if I just type their name it shows the plain text nicely" behaviour the user asked for.

Detection helper (sketch, add near `hexToRgba` at `main.js:542`):

```
function resolveCover(plugin, value, sourcePath) {
  // returns { kind: 'image', src } or { kind: 'text', text }
  const wl = value.match(/^!?\[\[([^\]|#]+)/);
  if (wl) {
    const dest = plugin.app.metadataCache.getFirstLinkpathDest(wl[1].trim(), sourcePath);
    if (dest) return { kind: 'image', src: plugin.app.vault.getResourcePath(dest) };
  }
  if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(value))
    return { kind: 'image', src: value };
  return { kind: 'text', text: value };
}
```

Parsing — extend `parseTaskLine()` (`main.js:607`): add `let cover = null;` then before the `text` strip block:

```
const coverMatch = rest.match(/\[cover::\s*([^\]]+?)\s*\]/i);
if (coverMatch) cover = coverMatch[1].trim();
```

and add `.replace(/\[cover::\s*[^\]]+?\]/gi, '')` to the chain that builds `text` (`main.js:652`), and add `cover` to the returned object (`main.js:663`). Note the wikilink-cover case: the existing `linkMatch` (`main.js:649`) grabs the *first* `[[…]]`; if the cover is a wikilink it could be mistaken for the linked note. Fix by stripping the cover token from `rest` (or running `coverMatch` first and excluding its span) **before** `linkMatch` runs, so the linked-note logic is unchanged for real linked notes.

Writing — extend `formatTaskLine()` (`main.js:928`): append `if (task.cover) line += \` [cover:: ${task.cover}]\`;`. Put it after the title and before the emoji tokens so round-tripping is stable. Because the field is only written when `task.cover` is set, **existing tasks are byte-for-byte unchanged** (back-compat requirement met).

Rendering — at the very top of the card body in `renderCard()`, inserted right after the `tk-card` div is created (before `tk-card-header`, ~`main.js:1585`):

```
if (task.cover) {
  const cov = resolveCover(this.plugin, task.cover, task.file);
  const coverEl = card.createDiv({ cls: `tk-card-cover tk-card-cover-${cov.kind}` });
  card.addClass('tk-has-cover');
  if (cov.kind === 'image') {
    const img = coverEl.createEl('img', { cls: 'tk-cover-img' });
    img.src = cov.src;
    img.alt = task.text || '';
    img.onerror = () => {           // graceful fallback: bad URL/missing file → show text
      coverEl.empty();
      coverEl.removeClass('tk-card-cover-image');
      coverEl.addClass('tk-card-cover-text');
      coverEl.createSpan({ cls: 'tk-cover-text', text: task.cover });
    };
  } else {
    coverEl.createSpan({ cls: 'tk-cover-text', text: cov.text });
  }
}
```

CSS to add to `styles.css` (cover spans the card's full width by negating the card's padding; the card already left-borders with `--tk-project-color`, `styles.css:130`, so the cover sits nicely above the header):

```
.tk-card-cover {
  margin: calc(var(--tk-card-pad, 10px) * -1) calc(var(--tk-card-pad, 10px) * -1) 8px;
  border-radius: 6px 6px 0 0;
  overflow: hidden;
}
.tk-card-cover-image .tk-cover-img {
  display: block; width: 100%; max-height: 120px; object-fit: cover;
}
.tk-card-cover-text {
  display: flex; align-items: center; justify-content: center;
  min-height: 44px; padding: 8px 12px;
  font-weight: 600; letter-spacing: .02em; text-align: center;
  /* tint with the project color the card already exposes */
  background: var(--tk-project-tint, var(--background-secondary));
  color: var(--text-normal);
}
```

(If `tk-card` uses a hard-coded padding rather than a `--tk-card-pad` var, either read it from `styles.css:126` and match the literal, or introduce the var in that rule — a one-line change.)

UI — add a "Cover" text field to **AddTaskModal** (`main.js:2433`) and **EditTaskModal** (`main.js:2582`) bound to `task.cover`, with a hint placeholder like `[[logo.png]], https://…/logo.png, or plain text`. Two new translation keys in both `nl` and `en` under `TRANSLATIONS` (`main.js:84`), e.g. `cover_label` (nl `"Omslag"` / en `"Cover"`) and `cover_hint` (nl `"Afbeelding ([[bestand]] of URL) of platte tekst"` / en `"Image ([[file]] or URL) or plain text"`).

#### (2) CSS-targetable metadata via data attributes + sanitized classes

The core idea (mirroring how Dataview lets you target inline fields and how mgmeyers exposes tag classes): render **each metadata value as an element that carries `data-field` and `data-value`**, plus a sanitized helper class, so users style values purely in a CSS snippet — no settings, no recompile.

Introduce one helper and use it for every meta pill:

```
function metaPill(parent, field, value, label) {
  const el = parent.createSpan({ cls: `tk-meta tk-meta-${field}`, text: label });
  el.dataset.field = field;
  el.dataset.value = String(value);
  // sanitized class so older CSS that can't use attr selectors still works
  el.addClass('tk-v-' + String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  return el;
}
```

Then rewrite the meta block in `renderCard()` (`main.js:1700-1714`) to use it. Priority is the headline case — instead of the current value-agnostic `meta.createSpan({ cls: 'tk-prio', text: PRIORITY_ICONS[task.priority] })` (`main.js:1709`):

```
if (task.priority) {
  const p = metaPill(meta, 'priority', task.priority, PRIORITY_ICONS[task.priority]);
  // keep the emoji as text; users can hide it and inject their own label via CSS
}
if (task.dueDate) metaPill(meta, 'due', task.dueDate, `📅 ${task.dueDate}`);
if (task.time)    metaPill(meta, 'time', task.time, `⏰ ${task.time}`);
if (task.recurrence) metaPill(meta, 'recurrence', task.recurrence, '🔁');
```

And give the project badge the same hooks (it already exists at `main.js:1600`): add `badge.dataset.field = 'project'; badge.dataset.value = task.project;`. The column is implicit (the card lives in a column element) but you can also set `card.dataset.column = task.column;` for swimlane-style snippets later.

Base CSS so pills have a shape to override (add to `styles.css`):

```
.tk-meta { display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 8px; border-radius: 999px; font-size: 11px; line-height: 1.6; }
```

**Example snippet the user pastes into a CSS snippet file (Settings → Appearance → CSS snippets) — exactly the green/red pill case asked for:**

```
/* priority pills, addressed by value */
.tk-meta[data-field="priority"][data-value="active"] {
  background: var(--color-green); color: #fff;
}
.tk-meta[data-field="priority"][data-value="emergency"] {
  background: var(--color-red); color: #fff; font-weight: 700;
}
/* replace the emoji with a word label, value-driven */
.tk-meta[data-field="priority"] { font-size: 0; }          /* hide emoji */
.tk-meta[data-field="priority"]::after { font-size: 11px; }
.tk-meta[data-field="priority"][data-value="active"]::after    { content: "ACTIVE"; }
.tk-meta[data-field="priority"][data-value="emergency"]::after { content: "EMERGENCY"; }

/* project color pill by value */
.tk-project-badge[data-value="client/acme"] { background: #6c4cf1 !important; }
```

Note: the plugin's five priority *values* are currently `highest|high|medium|low|lowest` (`PRIORITY_ICONS`, `main.js:74`). "active"/"emergency" aren't existing values, so to literally honour the user's words you'd either (a) tell them to map their concepts onto the five built-ins (`emergency` → `highest`, `active` → `medium`) and target those data-values, or (b) — better long-term — let users rename/extend priority labels in settings (a `settings.priorityLabels` map, parallel to `projectLabels` at `main.js:30`) and emit the label as `data-value`. (a) ships immediately with zero data-model change; (b) is a small follow-up. The data-attribute mechanism is identical either way.

### Why one field + data attributes (the recommendation) over alternatives

- **Alt A — generic inline fields `key:: value` (full Dataview parity):** parse *any* `key:: value` and render each as a pill. Most powerful and most "Dataview-native," but it's a bigger parser change, risks colliding with the emoji tokens and the existing free-text title, and complicates `formatTaskLine` round-tripping. Overkill for the stated need. Keep it as a future direction.
- **Alt B — dedicated emoji token for cover (e.g. `🖼️ value`):** consistent with the plugin's emoji style, but emojis can't cleanly wrap a multi-word client name or a URL with spaces/brackets, and it's a novel convention users must learn. The bracketed `[cover:: …]` is self-documenting and bounded by `]`.
- **Recommended — one explicit `[cover:: …]` field + universal `data-field`/`data-value` on meta elements:** smallest, safest change; touches only `parseTaskLine`, `formatTaskLine`, `renderCard`, the two modals, a few translation keys, and `styles.css`; gives the user *both* asks (image-or-text cover, and CSS-targetable value pills) and a clean extension path to Alt A later.

### Back-compat

- New tokens are only written when set, so all existing task lines are unchanged and keep parsing identically. The `cover` field and `data-*` attributes are additive — no migration, no settings version bump needed.
- The one real risk is the **wikilink ambiguity**: a `[cover:: [[X]]]` could be picked up by the existing first-`[[…]]` linked-note regex (`main.js:649`). Mitigation: strip the cover token from `rest` before `linkMatch` runs. Add a test line covering "cover wikilink + separate linked note" to be sure both resolve correctly.

### Risks and open questions

- **Image security/performance:** remote `https://` covers fetch external resources (privacy leak, broken if offline). Consider a setting `allowRemoteCovers` (default on) and lazy-loading (`img.loading = 'lazy'`); the `onerror` fallback already degrades gracefully to text.
- **`getResourcePath` lifecycle:** resource URLs are app-session scoped; since cards re-render on `scheduleRefresh()` this is fine, but don't cache the URL across reloads.
- **Cover height vs. compact boards:** 120px max may be a lot on dense boards — make it a CSS var (`--tk-cover-max-h`) so users tune it; consider a board-level "compact covers" toggle later.
- **SVG/`![[ ]]` embeds:** decide whether to honour the embed `!` prefix (treat identically) and whether to allow non-image attachments (PDF thumbnail?) — recommend image-only for v1, everything else falls through to text.
- **Value sanitization:** `data-value` carries raw user text (e.g. project `client/acme`); attribute selectors handle slashes fine, but the generated `tk-v-…` class slugifies them — document that the *attribute* is the reliable hook.
- **Open question for the maintainer:** do you want covers in the **CalendarView** chips too (`main.js:2069` area) or board-only? Recommend board-only for v1 to keep calendar chips compact.

