# Trietment Kanban

**English** | [Nederlands](#nederlands)

A Kanban board for [Obsidian](https://obsidian.md) that collects tasks from **every note in your vault**. Tasks are plain markdown checkboxes with optional metadata; the plugin shows them as draggable cards in columns. Works on desktop and mobile.

![Trietment Kanban — board, calendar and Outlook demo](assets/demo.gif)

<a href="https://buymeacoffee.com/trietment" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a coffee" height="40"></a>

If you find this plugin useful, you can [buy me a coffee](https://buymeacoffee.com/trietment) — thank you!

![Trietment Kanban board — dark theme](assets/board-preview.png)

![Trietment Kanban board — light theme](assets/board-preview-light.png)

### New in 1.12 — Clients, swimlanes, multiple boards, customizable priorities & card covers

Cards now carry a **client** alongside the project, **priorities are customizable** (your own names + colors), and you can give a card a **cover** (an image or plain text). Organize with **swimlanes** (group cards by project, client, priority or due date) and **multiple boards** (each scoped to its own projects/clients); edit the title and priority straight from a card; or tag a whole note `#kanban` to pull in all its tasks.

## Features

- **Tasks from your whole vault** — every `- [ ]` checkbox with a `#kanban/` tag appears on the board.
- **Dynamic columns** — defaults: To do / In progress / Waiting for response / Done. Add, rename, reorder or remove columns in the settings. Drag cards between columns (desktop) or change the column in the edit modal (mobile).
- **Bilingual (EN/NL)** — the whole interface is available in English and Dutch. By default the plugin follows the Obsidian language; you can also choose manually.
- **Projects with colors** — group with `#project/name`, each with its own color and optional label. Subprojects (`#project/client/acme`) are supported.
- **Clients** — a second colored tag dimension with `#client/name` alongside the project, so a card can carry both a client and a project.
- **Swimlanes** — group cards into horizontal lanes by project, client, priority or due date via the board header's "Group by" control.
- **Multiple boards** — create named boards, each scoped to certain projects/clients with its own lane grouping; switch boards from the header.
- **Card covers** — show an image (`[cover:: [[logo.png]]]` or a URL) or a plain-text banner on a card; upload an image with one click.
- **Due dates, times & recurrence** — `📅 2026-05-28`, an optional time `⏰ 14:30`, and `🔁 every week`. Completed recurring tasks automatically create the next instance (keeping their time).
- **Calendar view (Month / Week / Day)** — see every task on its due date, with the same color coding as the board (red = overdue, orange = today). Switch between a month grid and agenda-style Week and Day views from the header; tasks with a time and your appointments share one timeline sorted by time. In the month view, **"+N more" is clickable** and opens that day so nothing stays hidden. The views stay readable in a narrow split pane. Open the calendar from the ribbon (calendar icon), the command palette, or the 📅 button on the board. Click a day to add a task with that date prefilled; click a task to edit it.
- **Outlook calendar (optional)** — connect one or more Microsoft/Outlook accounts via OAuth and see your appointments next to your tasks in the calendar view (read-only). Pick exactly which calendars to show per account, including shared calendars. See [Outlook setup](#outlook-calendar-setup).
- **Customizable priorities** — define your own priority list (name + color) in the settings, or use the built-in `🔺 ⏫ 🔼 🔽 ⏬`. Cards show a colored priority pill.
- **Subtasks** — indented checkboxes under a task. The board shows a `☑ 2/5` progress badge; add and check them in the edit modal.
- **Linked note per card** — use the 📄 button to create a dedicated note for a task from a template (a `[[wikilink]]` in the task line). If it already exists, the button opens it. Optionally, completing a card moves its note into a `0. archive` subfolder (and reopening moves it back).
- **Click = edit** — click a card for the edit modal: status/column, due date, project, recurrence, subtasks and note in one place.
- **Automatic moving** — tasks due today (or overdue) move automatically to the In-progress column.
- **Inbox** — quick entry of new tasks into a configurable inbox note.
- **Collect from #kanban notes (optional)** — tag a note with `#kanban` and all its checkboxes appear on the board without per-task tags, scoping the board to your #kanban notes (new tasks land in the Inbox to sort, done ones in the done column).

## Installation

### From Obsidian's community plugins (recommended)

1. Open **Settings → Community plugins** and make sure community plugins are enabled.
2. Click **Browse** and search for **Trietment Kanban**.
3. Click **Install**, then **Enable**.

Works the same on desktop and mobile. Obsidian offers updates automatically.

### Manually

1. Create the folder `<vault>/.obsidian/plugins/trietment-kanban/`.
2. Copy `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/Trietment/obsidian-kanban/releases) into it.
3. Restart Obsidian and enable the plugin under Settings → Community plugins.

## Task syntax

A task is a plain markdown checkbox with optional metadata:

```text
- [ ] Draft quote 📅 2026-05-25 ⏰ 09:30 #project/aim #kanban/doing ⏫
    - [ ] Request figures
    - [x] Pick template
- [ ] Onboarding call [[Acme onboarding]] #project/client/acme #kanban/todo
- [x] Mail sent #project/client/beta #kanban/done
```

| Part | Meaning |
|---|---|
| `#kanban/<column>` | Which column the task is in (e.g. `#kanban/doing`) |
| `#project/<name>` | Project; use `/` for subprojects (`#project/client/acme`) |
| `#client/<name>` | Client — a second colored tag dimension shown alongside the project |
| `📅 YYYY-MM-DD` | Due date |
| `⏰ HH:mm` | Time of day (24h), shown on the calendar timeline |
| `🔁 every week` | Recurrence (`every day/week/month/year`, also `every 2 weeks`) |
| `🔺 ⏫ 🔼 🔽 ⏬` | Priority (highest → lowest) |
| `[[Note]]` | Linked note |
| `[cover:: …]` | Card cover — an image (`[[file]]` or URL) or plain text |
| indented `- [ ]` | Subtask of the task above it |

You can put tasks in **any** note in your vault — they are picked up automatically.

### Styling cards with CSS

Card metadata is rendered with `data-field` / `data-value` attributes, so you can style values from a [CSS snippet](https://help.obsidian.md/snippets) (Settings → Appearance → CSS snippets) — for example, turn priorities into colored pills:

```css
.tk-prio { padding: 1px 8px; border-radius: 999px; }
.tk-prio[data-value="highest"] { background: var(--color-red); color: #fff; }
.tk-prio[data-value="low"]     { background: var(--color-green); color: #fff; }
```

Each meta element (`.tk-prio`, `.tk-due`, `.tk-recur`, the project badge) carries `data-field` + `data-value`, and the card carries `data-column`, `data-priority` and `data-project`.

## Usage

- **+ New task** (or the `+` under a column) adds a task, by default in the inbox note.
- **Click a card** → edit modal with column/status, due date, project, recurrence, subtasks and the linked note.
- **📄** creates/opens the linked note; **☑ 2/5** shows subtask progress.
- **Drag** a card to another column (desktop) to update the `#kanban/` tag.
- Click a **project badge** to filter on that project.

## Settings

- Add/rename/remove/reorder columns, default column, done column, inbox note, show inbox column.
- Automatic moving (today → In progress, optionally also overdue).
- Language (automatic / Dutch / English).
- Projects & colors, with a button to scan the vault (or only specific scan folders) for `#project/` tags.
- Linked notes: note folder and template file (empty = built-in template).
- Outlook calendar: Microsoft Client ID, show events toggle, connected accounts.

## Outlook calendar setup

The Outlook integration uses OAuth 2.0 (Authorization Code + PKCE) and Microsoft Graph. It is read-only — appointments are shown next to your tasks, nothing is written back.

1. Go to the [Microsoft Entra admin center](https://entra.microsoft.com) → **App registrations** → **New registration**.
2. Choose a supported account type. For personal and work/school accounts across organizations, pick *Accounts in any organizational directory and personal Microsoft accounts*.
3. Under **Authentication → Add a platform → Mobile and desktop applications**, add the redirect URI `obsidian://trietment-kanban-auth`, and enable **Allow public client flows**.
4. Under **API permissions**, add the delegated Microsoft Graph permissions `User.Read`, `Calendars.Read`, `Calendars.Read.Shared` and `offline_access`.
5. Copy the **Application (client) ID** and paste it into the plugin settings (Outlook calendar → Microsoft Client ID).
6. Click **Connect** and sign in. Repeat to connect multiple accounts.
7. Under each connected account, use the calendar picker to choose which calendars to show. Shared calendars appear once you have added them in Outlook; use the refresh button to reload the list. Each calendar gets its own color.

Sign-in tokens are stored per device (in local storage, not in `data.json`), so they are never copied by Obsidian Sync — you sign in once per device. Work/school accounts may require admin consent depending on your organization.

## Files

- `main.js` — the plugin
- `manifest.json` — plugin metadata
- `styles.css` — styling
- `versions.json` — version ↔ minimum Obsidian version

> `data.json` (your personal settings and project colors) belongs to your vault and is deliberately **not** in this repo.

## License

[MIT](LICENSE).

---

# Nederlands

[English](#trietment-kanban) | **Nederlands**

Een Kanban-bord voor [Obsidian](https://obsidian.md) dat taken verzamelt uit **alle notes in je vault**. Taken zijn gewone markdown-checkboxes met optionele metadata; de plugin toont ze als sleepbare kaarten in kolommen. Werkt op desktop én mobiel.

![Trietment Kanban — bord, kalender en Outlook-demo](assets/demo.gif)

<a href="https://buymeacoffee.com/trietment" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a coffee" height="40"></a>

Vind je deze plugin handig? Je kunt me [een koffie trakteren](https://buymeacoffee.com/trietment) — dankjewel!

![Trietment Kanban-bord — donker thema](assets/board-preview.png)

![Trietment Kanban-bord — licht thema](assets/board-preview-light.png)

### Nieuw in 1.12 — Klanten, swimlanes, meerdere borden, aanpasbare prioriteiten & kaart-covers

Kaarten dragen nu een **klant** naast het project, **prioriteiten zijn aanpasbaar** (eigen namen + kleuren) en je kunt een kaart een **cover** geven (een afbeelding of platte tekst). Orden met **swimlanes** (groepeer op project, klant, prioriteit of datum) en **meerdere borden** (elk met een eigen bereik); bewerk titel en prioriteit direct vanuit een kaart; of tag een hele notitie met `#kanban` om al haar taken op te halen.

## Functies

- **Taken uit je hele vault** — elke `- [ ]` checkbox met een `#kanban/`-tag verschijnt op het bord.
- **Dynamische kolommen** — standaard: Te doen / Bezig / Wacht op reactie / Klaar. Voeg in de instellingen zelf kolommen toe, hernoem ze, wijzig de volgorde of verwijder ze. Sleep kaarten tussen kolommen (desktop) of wijzig de kolom in de edit-modal (mobiel).
- **Tweetalig (NL/EN)** — de hele interface is beschikbaar in het Nederlands en het Engels. Standaard volgt de plugin de taal van Obsidian; je kunt ook handmatig kiezen.
- **Projecten met kleuren** — groepeer met `#project/naam`, elk met eigen kleur en optioneel label. Subprojecten (`#project/klant/acme`) worden ondersteund.
- **Klanten** — een tweede gekleurde tag-dimensie met `#client/naam` naast het project, zodat een kaart zowel een klant als een project kan dragen.
- **Swimlanes** — groepeer kaarten in horizontale banen op project, klant, prioriteit of datum via de "Groeperen in banen"-keuze in de bordkop.
- **Meerdere borden** — maak benoemde borden, elk afgebakend op bepaalde projecten/klanten met een eigen banen-groepering; wissel bovenaan het bord.
- **Kaart-covers** — toon een afbeelding (`[cover:: [[logo.png]]]` of een URL) of platte tekst op een kaart; upload een afbeelding met één klik.
- **Due dates, tijd & herhaling** — `📅 2026-05-28`, een optionele tijd `⏰ 14:30`, en `🔁 every week`. Afgevinkte herhalende taken maken automatisch de volgende instance aan (met behoud van hun tijd).
- **Kalenderweergave (Maand / Week / Dag)** — zie elke taak op zijn due date, met dezelfde kleurcodering als het bord (rood = te laat, oranje = vandaag). Schakel in de kop tussen het maandraster en agenda-achtige Week- en Dagweergave; taken met een tijd en je afspraken delen één tijdlijn op tijd gesorteerd. In de maandweergave is **"+N meer" klikbaar** en opent die dag, zodat niets verborgen blijft. De weergaven blijven leesbaar in een smal split-paneel. Open de kalender via het lint (kalender-icoon), het commandopalet of de 📅-knop op het bord. Klik op een dag om een taak met die datum toe te voegen; klik op een taak om hem te bewerken.
- **Outlook-agenda (optioneel)** — koppel een of meer Microsoft/Outlook-accounts via OAuth en zie je afspraken naast je taken in de kalenderweergave (alleen-lezen). Kies per account precies welke agenda's je toont, inclusief gedeelde agenda's. Zie [Outlook instellen](#outlook-agenda-instellen).
- **Aanpasbare prioriteiten** — stel je eigen prioriteitenlijst in (naam + kleur) in de instellingen, of gebruik de ingebouwde `🔺 ⏫ 🔼 🔽 ⏬`. Kaarten tonen een gekleurde prioriteit-pil.
- **Subtaken** — ingesprongen checkboxes onder een taak. Het bord toont een `☑ 2/5`-voortgangsbadge; toevoegen en afvinken doe je in de edit-modal.
- **Gekoppelde notitie per kaart** — met de 📄-knop maak je uit een template een eigen notitie voor een taak (een `[[wikilink]]` in de taakregel). Bestaat hij al, dan opent de knop hem. Optioneel verhuist het afronden van een kaart zijn notitie naar een submap `0. archive` (en bij heropenen weer terug).
- **Klik = bewerken** — klik op een kaart voor de edit-modal: status/kolom, due date, project, herhaling, subtaken en notitie op één plek.
- **Automatisch verplaatsen** — taken die vandaag (of overdue) due zijn schuiven automatisch naar de Bezig-kolom.
- **Inbox** — snelle invoer van nieuwe taken in een instelbare inbox-note.
- **Verzamelen uit #kanban-notities (optioneel)** — tag een notitie met `#kanban` en al haar checkboxes verschijnen op het bord zonder per-taak-tag, waarmee je het bord beperkt tot je #kanban-notities (nieuwe taken komen in de Inbox om te sorteren, afgevinkte in de afgerond-kolom).

## Installatie

### Via de community-plugins (aanbevolen)

1. Open **Instellingen → Community-plugins** en zorg dat community-plugins aan staan.
2. Klik op **Bladeren** en zoek **Trietment Kanban**.
3. Klik op **Installeren** en daarna **Inschakelen**.

Werkt hetzelfde op desktop en mobiel. Obsidian biedt updates automatisch aan.

### Handmatig

1. Maak de map `<vault>/.obsidian/plugins/trietment-kanban/`.
2. Kopieer daarin `main.js`, `manifest.json` en `styles.css` uit de [laatste release](https://github.com/Trietment/obsidian-kanban/releases).
3. Herstart Obsidian en zet de plugin aan bij Instellingen → Community-plugins.

## Taaksyntaxis

Een taak is een gewone markdown-checkbox met optionele metadata:

```text
- [ ] Offerte uitwerken 📅 2026-05-25 ⏰ 09:30 #project/aim #kanban/doing ⏫
    - [ ] Cijfers opvragen
    - [x] Template kiezen
- [ ] Onboarding-call [[Acme onboarding]] #project/klant/acme #kanban/todo
- [x] Mail verstuurd #project/klant/beta #kanban/done
```

| Onderdeel | Betekenis |
|---|---|
| `#kanban/<kolom>` | In welke kolom de taak staat (bv. `#kanban/doing`) |
| `#project/<naam>` | Project; gebruik `/` voor subprojecten (`#project/klant/acme`) |
| `#client/<naam>` | Klant — een tweede gekleurde tag-dimensie naast het project |
| `📅 JJJJ-MM-DD` | Due date |
| `⏰ UU:mm` | Tijdstip (24-uurs), getoond op de kalender-tijdlijn |
| `🔁 every week` | Herhaling (`every day/week/month/year`, ook `every 2 weeks`) |
| `🔺 ⏫ 🔼 🔽 ⏬` | Prioriteit (hoogst → laagst) |
| `[[Notitie]]` | Gekoppelde notitie |
| `[cover:: …]` | Kaart-cover — een afbeelding (`[[bestand]]` of URL) of platte tekst |
| ingesprongen `- [ ]` | Subtaak van de taak erboven |

Je kunt taken in **elke** note van je vault zetten — ze worden vanzelf opgepikt.

### Kaarten stylen met CSS

Metadata op een kaart krijgt `data-field` / `data-value`-attributen, zodat je waarden vanuit een [CSS-snippet](https://help.obsidian.md/snippets) (Instellingen → Weergave → CSS-snippets) kunt stylen — bijvoorbeeld prioriteiten als gekleurde pillen:

```css
.tk-prio { padding: 1px 8px; border-radius: 999px; }
.tk-prio[data-value="highest"] { background: var(--color-red); color: #fff; }
.tk-prio[data-value="low"]     { background: var(--color-green); color: #fff; }
```

Elk meta-element (`.tk-prio`, `.tk-due`, `.tk-recur`, de project-badge) draagt `data-field` + `data-value`, en de kaart draagt `data-column`, `data-priority` en `data-project`.

## Gebruik

- **+ Nieuwe taak** (of het `+` onder een kolom) voegt een taak toe, standaard in de inbox-note.
- **Klik op een kaart** → edit-modal met kolom/status, due date, project, herhaling, subtaken en de gekoppelde notitie.
- **📄** maakt/opent de gekoppelde notitie; **☑ 2/5** toont de subtaak-voortgang.
- **Sleep** een kaart naar een andere kolom (desktop) om de `#kanban/`-tag bij te werken.
- Klik op een **project-badge** om op dat project te filteren.

## Instellingen

- Kolommen toevoegen/hernoemen/verwijderen/herordenen, standaardkolom, klaar-kolom, inbox-note, inbox-kolom tonen.
- Automatisch verplaatsen (vandaag → Bezig, optioneel ook overdue).
- Taal (automatisch / Nederlands / Engels).
- Projecten & kleuren, met een knop om de vault (of alleen bepaalde scan-mappen) te scannen op `#project/`-tags.
- Gekoppelde notities: notitie-map en template-bestand (leeg = ingebouwde template).
- Outlook-agenda: Microsoft Client ID, events-toggle, gekoppelde accounts.

## Outlook-agenda instellen

De Outlook-koppeling gebruikt OAuth 2.0 (Authorization Code + PKCE) en Microsoft Graph. Het is alleen-lezen — afspraken worden naast je taken getoond, er wordt niets teruggeschreven.

1. Ga naar het [Microsoft Entra-beheercentrum](https://entra.microsoft.com) → **App-registraties** → **Nieuwe registratie**.
2. Kies een ondersteund accounttype. Voor persoonlijke én werk-/schoolaccounts over meerdere organisaties: *Accounts in elke organisatiemap en persoonlijke Microsoft-accounts*.
3. Onder **Verificatie → Een platform toevoegen → Mobiele en desktop-applicaties** voeg je de redirect-URI `obsidian://trietment-kanban-auth` toe en zet je **Openbare clientstromen toestaan** aan.
4. Onder **API-machtigingen** voeg je de gedelegeerde Microsoft Graph-rechten `User.Read`, `Calendars.Read`, `Calendars.Read.Shared` en `offline_access` toe.
5. Kopieer de **Application (client) ID** en plak die in de plugin-instellingen (Outlook-agenda → Microsoft Client ID).
6. Klik op **Koppelen** en meld je aan. Herhaal dit om meerdere accounts te koppelen.
7. Onder elk gekoppeld account kies je met de agenda-kiezer welke agenda's je toont. Gedeelde agenda's verschijnen zodra je ze in Outlook hebt toegevoegd; gebruik de vernieuwen-knop om de lijst opnieuw te laden. Elke agenda krijgt een eigen kleur.

Aanmeld-tokens worden per apparaat bewaard (in lokale opslag, niet in `data.json`), zodat Obsidian Sync ze niet meeneemt — je meldt je één keer per apparaat aan. Werk-/schoolaccounts vereisen soms goedkeuring van de beheerder, afhankelijk van je organisatie.

## Bestanden

- `main.js` — de plugin
- `manifest.json` — plugin-metadata
- `styles.css` — styling
- `versions.json` — versie ↔ minimale Obsidian-versie

> `data.json` (je persoonlijke instellingen en projectkleuren) hoort bij je vault en zit bewust **niet** in deze repo.

## Licentie

[MIT](LICENSE).

---

# Changelog / Wijzigingen

All changes per version, in English and Dutch — this is what you see on the plugin page in Obsidian. / Alle wijzigingen per versie, in het Engels en Nederlands — dit is wat je op de pluginpagina in Obsidian ziet.

<!-- CHANGELOG:BEGIN — automatisch gevuld door scripts/sync-readme-changelog.sh; niet met de hand bewerken -->

## 1.15.2

**Fixed: dialog alignment on iPhone — and the full changelog on the plugin page**

- **Dialogs line up again on iPhone.** The bottom-sheet fix in 1.15.1 took the add/edit dialogs out of Obsidian's own centering, pushing them against the left edge with a gap on the right. They now use Obsidian's normal centering again (only anchored to the bottom), so they line up exactly like every other dialog.
- **All changes visible when installing.** Obsidian's community-plugins page shows a plugin's README — release notes and CHANGELOG.md never appear there. The README now ends with the full changelog, so you can read every version's changes right on the plugin page.

---

### Nederlands

**Opgelost: uitlijning van vensters op de iPhone — en de volledige changelog op de pluginpagina**

- **Vensters lijnen weer netjes uit op de iPhone.** De bottom-sheet-fix uit 1.15.1 haalde de toevoeg-/bewerkvensters uit Obsidians eigen centrering, waardoor ze tegen de linkerrand vielen met rechts een kier. Ze gebruiken nu weer de normale centrering (alleen onderaan verankerd), zodat ze precies uitlijnen zoals elk ander venster.
- **Alle wijzigingen zichtbaar bij installeren.** De community-plugins-pagina van Obsidian toont de README van een plugin — release notes en CHANGELOG.md verschijnen daar nooit. De README eindigt nu met de volledige changelog, zodat je op de pluginpagina per versie alle wijzigingen kunt lezen.

## 1.15.1

**Fixed: iPhone keyboard and bottom-bar problems**

- **Add button reachable again.** The floating navigation bar / home indicator overlapped the bottom of the board on iPhone, covering "+ Add task" at the end of a column. The board now measures the actual overlap and keeps its bottom edge clear (the bulk-move bar too). Android and desktop are untouched.
- **No more jumping screen while typing.** iOS pans the whole app towards a focused input field, which shoved the fixed layout out of view when editing a card title. The add/edit dialogs now undo that panning immediately, so what you type stays visible.
- **Nothing behind the keyboard.** On iPhone the add/edit dialogs become a bottom sheet that stays above the keyboard; subtasks and buttons low on the card scroll into view and the active field is brought into view automatically. With the keyboard closed, the Save/Add buttons stay clear of the home indicator.

---

### Nederlands

**Opgelost: toetsenbord- en balkje-problemen op de iPhone**

- **Toevoegen-knop weer bereikbaar.** De zwevende navigatiebalk/home-indicator viel op de iPhone over de onderkant van het bord, waardoor "+ Taak toevoegen" onder in een kolom onbereikbaar was. Het bord meet nu de werkelijke overlap en houdt de onderrand vrij (ook voor de bulk-verplaatsbalk). Android en desktop blijven ongewijzigd.
- **Geen verspringend scherm meer tijdens het typen.** iOS schuift de hele app richting een gefocust invoerveld, waardoor de vaste layout uit beeld schoof bij het aanpassen van een kaarttitel. De vensters draaien dat schuiven nu direct terug, zodat je ziet wat je typt.
- **Niets meer achter het toetsenbord.** Op de iPhone worden de toevoeg-/bewerkvensters een bottom-sheet die boven het toetsenbord blijft; subtaken en knoppen laag op de kaart scrollen gewoon in beeld en het actieve veld springt automatisch in beeld. Met het toetsenbord dicht blijven de knoppen Opslaan/Voeg toe boven de home-indicator.

## 1.15.0

**New: bulk move, and the board keeps your scroll position**

- **Bulk move.** "☑ Select" in the board header (or long-press a card on mobile) switches to selection mode: tap cards to select, then move them all at once via the action bar below the board (count, target column, Move, Cancel). One write per note; dragging and opening cards are disabled while selecting.
- **No more scroll jumps.** The board remembers the horizontal position and each column's scroll position (and the swimlane stack) across every re-render — dragging, filtering, sync refreshes and auto-move no longer throw you back to the top.

---

### Nederlands

**Nieuw: bulk verplaatsen, en het bord onthoudt je scrollpositie**

- **Bulk verplaatsen.** "☑ Selecteer" in de bordkop (of een kaart lang indrukken op mobiel) zet de selectiemodus aan: tik kaarten aan en verplaats ze in één keer via de balk onder het bord (aantal, doelkolom, Verplaats, Annuleer). Eén schrijfactie per notitie; slepen en kaarten openen staan tijdens het selecteren uit.
- **Geen scroll-sprongen meer.** Het bord onthoudt de horizontale positie en de scrollpositie van elke kolom (en de banen-stapel) over elke re-render heen — slepen, filteren, sync-refreshes en auto-move gooien je niet meer terug naar boven.

## 1.14.0

**New: client card colors, and a tidier settings page**

- **The client colors the card, the project colors the ring.** The left rail and background wash follow the card's client; a card with a project gets a thin colored ring all around (the project pill stays). Priority keeps the top edge. Previously the project colored the whole card and the client was only a pill.
- **Tidier settings.** Sections are ordered thematically (Projects and Clients now sit with the board content) and every section renders as one visual block: heading and intro on top, its rows together in a rounded card.
- **Clearer linked accounts.** Each Outlook account is a card with its calendars indented behind a rail. The redundant "Name" label, the unused rename field and the account color dot are gone — the email address is the account's title; the dots next to calendars still show each calendar's color in the calendar view.

---

### Nederlands

**Nieuw: klantkleuren op kaarten, en een overzichtelijkere instellingenpagina**

- **De klant kleurt de kaart, het project de ring.** De linkerrail en de achtergrondwaas volgen de klant van de kaart; een kaart met een project krijgt een dun gekleurd randje rondom (de projectpill blijft). Prioriteit houdt de bovenrand. Voorheen kleurde het project de hele kaart en was de klant alleen een pill.
- **Overzichtelijkere instellingen.** Secties staan thematisch geordend (Projecten en Klanten bij de bord-inhoud) en elke sectie is één visueel blok: kopje en intro erboven, de rijen samen in een afgeronde kaart.
- **Duidelijkere gekoppelde accounts.** Elk Outlook-account is een kaartje met zijn agenda's ingesprongen achter een rail. Het overbodige "Naam"-label, het ongebruikte naamveld en het accountkleur-bolletje zijn weg — het e-mailadres is de titel van het account; de bolletjes naast de agenda's tonen nog steeds de kleur van die agenda in de kalenderweergave.

## 1.13.0

**New: hide an empty Inbox, and ignored folders for archived clients**

- **Hide empty inbox** — optional (under "Show inbox column"): the Inbox column hides itself while it has no cards and reappears as soon as something lands in it — a new untagged task, or a card with an unknown/broken column tag, so the 1.12.2 safety net stays visible. Works on the plain board and in swimlanes.
- **Ignored folders (archive)** — notes in these folders are skipped entirely: their tasks never appear on the board or the calendar, and project detection ignores them too. Archive a client by moving its folder here; the notes themselves stay untouched.

---

### Nederlands

**Nieuw: lege Inbox verbergen, en genegeerde mappen voor gearchiveerde klanten**

- **Lege Inbox verbergen** — optioneel (onder "Inbox-kolom tonen"): de Inbox-kolom verbergt zichzelf zolang er geen kaarten in staan en verschijnt vanzelf weer zodra er iets in belandt — een nieuwe taak zonder kolomtag, of een kaart met een onbekende/kapotte kolomtag, zodat het vangnet uit 1.12.2 zichtbaar blijft. Werkt op het gewone bord en bij swimlanes.
- **Genegeerde mappen (archief)** — notities in deze mappen worden volledig overgeslagen: hun taken verschijnen niet op het bord en niet in de kalender, en ook de projectdetectie negeert ze. Archiveer een klant door zijn map hierheen te verplaatsen; de notities zelf blijven onaangetast.

## 1.12.2

**Bugfix: sync-safe auto-move — no more disappearing cards on multi-device vaults**

- **Auto-move waits for sync.** When two devices rewrote the same task line around a sync moment (e.g. opening the app while Obsidian Sync was still pulling), Obsidian Sync could merge the versions character by character and mangle the column tag (e.g. `#kanban/ingdoing`), making the card invisible on every device. The automatic "move due tasks to In progress" now only runs once Obsidian Sync reports *Fully synced* and the vault has been quiet for a few seconds; offline it writes nothing and retries until you are back online and synced. Vaults without Obsidian Sync use the quiet window. The manual command keeps working and warns while sync is busy.
- **Unknown column tags show in the Inbox.** Cards whose `#kanban/` tag matches no column appear in the Inbox instead of nowhere, auto-move repairs due cards with a mangled tag, and editing such a card normalizes the tag.

---

### Nederlands

**Bugfix: sync-veilige auto-move — geen verdwijnende kaarten meer bij meerdere apparaten**

- **Auto-move wacht op de sync.** Als twee apparaten rond een sync-moment dezelfde taakregel herschreven (bv. de app openen terwijl Obsidian Sync nog aan het binnenhalen was), kon Obsidian Sync de versies teken voor teken samenvoegen en de kolom-tag verhaspelen (bv. `#kanban/ingdoing`), waardoor de kaart op elk apparaat onzichtbaar werd. Het automatische "due taken naar Bezig" draait nu pas zodra Obsidian Sync *Fully synced* meldt en de vault een paar seconden in rust is; offline schrijft hij niets en probeert hij het opnieuw zodra je weer online en gesynchroniseerd bent. Vaults zonder Obsidian Sync gebruiken het rustvenster. Het handmatige commando blijft werken en waarschuwt zolang de sync bezig is.
- **Onbekende kolom-tags in de Inbox.** Kaarten waarvan de `#kanban/`-tag bij geen kolom hoort staan voortaan in de Inbox in plaats van nergens, auto-move herstelt due kaarten met een verhaspelde tag, en bewerken normaliseert de tag.

## 1.12.1

- **Shorten the plugin description** to stay within Obsidian's 250-character manifest limit (it was 272). No functional changes.

> NL: Plugin-beschrijving ingekort zodat hij binnen Obsidians limiet van 250 tekens past (was 272). Geen functionele wijzigingen.

## 1.12.0

**New: custom priorities, clients, swimlanes, multiple boards, #kanban-note collection, and richer cards**

- **Edit the card title** in the edit dialog (full-width field); date/time/tags/priority/links preserved.
- **Edit priority** while editing an existing card (not only on creation).
- **Customizable priorities** — define your own priority list (name + color) in Settings → Priorities. Custom priorities are stored as `#priority/<name>`; the five built-ins keep their emoji (Tasks-plugin compatible); cards show a colored priority pill.
- **Card covers** — `[cover:: …]` shows an image (vault `[[image]]` or URL) or a plain-text banner; add or upload a cover (uploads go to a configurable **Cover folder**, default `Kanban Notes/assets`).
- **CSS-targetable cards** — metadata renders with `data-field`/`data-value`, and the card with `data-priority`/`data-project`/`data-client`/`data-column`, so values can be styled via a CSS snippet.
- **Clients** — a second colored tag dimension `#client/name` alongside the project.
- **Swimlanes** — group cards into horizontal lanes by project, client, priority or due date.
- **Multiple boards** — named boards, each scoped to projects/clients with its own grouping; switch from a header picker.
- **Collect tasks from #kanban notes** — tag a note `#kanban` and all its tasks appear without per-task tags; the board is then scoped to your #kanban notes (open → Inbox, checked → done, explicit `#kanban/<column>` → that column).
- **Calendar remembers the last view** (Month/Week/Day).

---

### Nederlands

**Nieuw: eigen prioriteiten, klanten, swimlanes, meerdere borden, #kanban-notitie-verzameling en rijkere kaarten**

- **Kaarttitel bewerken** in het bewerk-venster (veld over de volle breedte); datum/tijd/tags/prioriteit/koppelingen blijven behouden.
- **Prioriteit bewerken** bij een bestaande kaart (niet alleen bij toevoegen).
- **Aanpasbare prioriteiten** — eigen prioriteitenlijst (naam + kleur) bij Instellingen → Prioriteiten. Eigen prioriteiten als `#priority/<naam>`; de vijf standaard houden hun emoji (Tasks-compatibel); kaarten tonen een gekleurde prioriteit-pil.
- **Kaart-covers** — `[cover:: …]` toont een afbeelding (vault-`[[afbeelding]]` of URL) of een platte-tekst-banner; toevoegen of uploaden (uploads in een instelbare **Cover-map**, standaard `Kanban Notes/assets`).
- **CSS-targetbare kaarten** — metadata krijgt `data-field`/`data-value`, en de kaart `data-priority`/`data-project`/`data-client`/`data-column`, zodat je waarden met een CSS-snippet kunt stylen.
- **Klanten** — een tweede gekleurde tag-dimensie `#client/naam` naast het project.
- **Swimlanes** — kaarten in horizontale banen op project, klant, prioriteit of datum.
- **Meerdere borden** — benoemde borden, elk afgebakend op projecten/klanten met eigen groepering; wissel via een kiezer in de kop.
- **Taken uit #kanban-notities** — tag een notitie `#kanban` en al haar taken verschijnen zonder per-taak-tag; het bord is dan beperkt tot je #kanban-notities (open → Inbox, afgevinkt → afgerond, eigen `#kanban/<kolom>` → die kolom).
- **Kalender onthoudt de laatste weergave** (Maand/Week/Dag).

## 1.11.1

- **Support link** — you can now support development via Buy Me a Coffee. The link appears on the plugin page (`fundingUrl`), in the README, and at the bottom of the plugin settings. The plugin stays free.

> NL: Je kunt de ontwikkeling nu steunen via Buy Me a Coffee. De link staat op de plugin-pagina (`fundingUrl`), in de README en onderaan de plugin-instellingen. De plugin blijft gratis.

## 1.11.0

**New: week & day calendar views, times on cards, and note archiving**

- **Week and Day calendar views** — switch between Month, Week and Day in the calendar header. Week and Day are agenda lists that show every appointment and task for a day without cutting anything off, and they stay readable in a narrow split pane (the week stacks into a vertical agenda and the toolbar wraps).
- **Clickable "+N more"** — in the month view the overflow indicator now opens that day so you can see all of its items.
- **Times on cards** — add a time (24h) to a task in the add/edit dialog. It is stored as a separate `⏰` token next to the `📅` date (compatible with the Obsidian Tasks plugin). In the calendar, appointments and timed tasks share one timeline sorted by time, each with a bold time badge; the time also shows on the board card and is carried forward for recurring tasks.
- **Archive notes when done** — when a card reaches the done column its linked note moves into a `0. archive` subfolder, and reopening the card moves it back (wikilinks stay correct). Toggle it and set the folder name under Settings → Linked notes; on by default.

---

### Nederlands

**Nieuw: week- en dagweergave, tijd op kaarten, en notities archiveren**

- **Week- en dagweergave** — schakel in de kalenderkop tussen Maand, Week en Dag. Week en Dag zijn agenda-lijsten die elke afspraak en taak van een dag tonen zonder iets af te kappen, en ze blijven leesbaar in een smal split-paneel (de week stapelt tot een verticale agenda en de knoppenbalk vloeit door).
- **Klikbare "+N meer"** — in de maandweergave opent de "meer"-aanduiding nu die dag, zodat je alle items kunt zien.
- **Tijd op kaarten** — voeg een tijd (24-uurs) toe aan een taak in het toevoeg-/bewerk-venster. De tijd wordt als apart `⏰`-token naast de `📅`-datum opgeslagen (compatibel met de Obsidian Tasks-plugin). In de kalender delen afspraken en getimede taken één tijdlijn op tijd gesorteerd, elk met een vetgedrukte tijd-badge; de tijd staat ook op de bordkaart en gaat mee bij terugkerende taken.
- **Notities archiveren bij afronden** — zodra een kaart in de afgerond-kolom komt, verhuist de gekoppelde notitie naar een submap `0. archive`, en bij heropenen komt hij weer terug (wikilinks blijven kloppen). Aan/uit en de mapnaam instelbaar bij Instellingen → Gekoppelde notities; standaard aan.

## 1.10.2

- **Outlook tokens are now stored per device** — sign-in tokens are kept in device-local storage instead of `data.json`, so they are never copied by Obsidian Sync and cannot cause refresh-token conflicts between devices. Your account list and calendar choices still sync; you just sign in once per device. Existing tokens migrate automatically on first load.

> NL: Outlook-tokens worden nu per apparaat bewaard (device-lokaal i.p.v. in `data.json`), zodat ze niet meesyncen met Obsidian Sync en er geen token-botsingen tussen apparaten ontstaan. Je accountlijst en agenda-keuzes syncen wél; je meldt je alleen één keer per apparaat aan. Bestaande tokens verhuizen automatisch.

## 1.10.1

- **Rename connected accounts** — give each Outlook account a recognizable name in settings, so it is clear which account is which.
- **Better automatic names** — added the `User.Read` permission so the account name and email are filled in automatically on connect. Existing connections show "Account" until you reconnect (or just type your own name).

> NL: Outlook-accounts hernoemen — geef elk account een herkenbare naam in de instellingen. Daarnaast worden naam en e-mail voortaan automatisch ingevuld (`User.Read`); bestaande koppelingen tonen "Account" tot je opnieuw koppelt of zelf een naam typt.

## 1.10.0

**New: Calendar view + Outlook calendar sync**

- **Calendar view** — a month grid that shows every task on its due date, with the same color coding as the board (red = overdue, orange = today). Open it from the ribbon (calendar icon), the command palette, or the 📅 button on the board. Click a day to add a task with that date prefilled; click a task to edit it. Bilingual, Monday-start, localized month/weekday names.
- **Outlook calendar (optional)** — connect one or more Microsoft/Outlook accounts via OAuth 2.0 (PKCE, no client secret) and see your appointments next to your tasks in the calendar view (read-only). Works on desktop and mobile.
- **Calendar picker** — per account, choose exactly which calendars to show, including shared calendars. Each calendar gets its own color.
- **Zero setup for sign-in** — a built-in Client ID ships with the plugin, so connecting only takes a sign-in. Advanced users can supply their own Client ID.

See the README ("Outlook calendar setup") for the one-time Azure app registration.

---

### Nederlands

**Nieuw: kalenderweergave + Outlook-agenda**

- **Kalenderweergave** — een maandraster met elke taak op zijn due date, met dezelfde kleurcodering als het bord (rood = te laat, oranje = vandaag). Open hem via het lint (kalender-icoon), het commandopalet of de 📅-knop op het bord. Klik op een dag om een taak met die datum toe te voegen; klik op een taak om hem te bewerken.
- **Outlook-agenda (optioneel)** — koppel een of meer Microsoft/Outlook-accounts via OAuth 2.0 (PKCE, geen client secret) en zie je afspraken naast je taken (alleen-lezen). Werkt op desktop en mobiel.
- **Agenda-kiezer** — kies per account precies welke agenda's je toont, inclusief gedeelde agenda's. Elke agenda krijgt een eigen kleur.
- **Geen setup om aan te melden** — een ingebouwd Client ID wordt meegeleverd, dus koppelen is alleen aanmelden. Eigen Client ID invullen kan ook.

Zie de README ("Outlook-agenda instellen") voor de eenmalige Azure-app-registratie.
<!-- CHANGELOG:END -->
