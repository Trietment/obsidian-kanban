# Changelog

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
