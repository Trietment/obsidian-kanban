# Changelog

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
