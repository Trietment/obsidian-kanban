## Custom priorities, clients, swimlanes, multiple boards & richer cards

**Cards & editing**

- **Edit the card title** — a full-width title field at the top of the edit dialog; rename a task without opening the note. Date, time, tags, priority and links are preserved.
- **Edit priority while editing** — the priority picker is now in the edit dialog of an existing card, not only when creating one.
- **Customizable priorities** — define your own priority list (name + color) in Settings → Priorities: add, rename, recolor, reorder, delete. Custom priorities are stored as `#priority/<name>`; the five built-ins keep their emoji (Tasks-plugin compatible). Cards show a colored priority pill.
- **Card covers** — give a card a cover with `[cover:: …]`: an image (a `[[vault image]]` or an image URL) shows as a banner; any other text shows as a plain-text banner (e.g. a client name). Add or **upload** a cover from the dialog — uploads go to a configurable **Cover folder** (default `Kanban Notes/assets`).
- **Style cards with your own CSS** — every metadata value renders with `data-field`/`data-value` attributes (and the card carries `data-priority`/`data-project`/`data-client`/`data-column`), so a CSS snippet can turn values into colored pills.

**Organizing**

- **Clients** — a second colored tag dimension `#client/name` alongside the project, so a card can carry both a client and a project.
- **Swimlanes** — a "Group by" control arranges cards into horizontal lanes by project, client, priority or due date.
- **Multiple boards** — create named boards, each scoped to certain projects/clients with its own lane grouping; switch boards from a picker in the header.
- **Collect tasks from #kanban notes** — optional: tag a note with `#kanban` and all its checkboxes appear on the board without per-task tagging. The board is then scoped to your #kanban notes — new (open) tasks land in the Inbox to sort, checked ones in the done column, and explicitly `#kanban/<column>`-tagged tasks go to their column.

**Calendar**

- **Remembers your view** — the calendar reopens in the Month/Week/Day view you last used (handy in a split screen).

---

### Nederlands

## Eigen prioriteiten, klanten, swimlanes, meerdere borden & rijkere kaarten

**Bewerken & kaarten**

- **Kaarttitel bewerken** — een titelveld over de volle breedte bovenaan het bewerk-venster; hernoem een taak zonder de notitie te openen. Datum, tijd, tags, prioriteit en koppelingen blijven behouden.
- **Prioriteit bewerken** — de prioriteit-keuze zit nu ook in het bewerk-venster van een bestaande kaart, niet alleen bij toevoegen.
- **Aanpasbare prioriteiten** — stel je eigen prioriteitenlijst in (naam + kleur) bij Instellingen → Prioriteiten: toevoegen, hernoemen, herkleuren, volgorde, verwijderen. Eigen prioriteiten komen als `#priority/<naam>`; de vijf standaard houden hun emoji (compatibel met de Tasks-plugin). Kaarten tonen een gekleurde prioriteit-pil.
- **Kaart-covers** — geef een kaart een cover met `[cover:: …]`: een afbeelding (een `[[vault-afbeelding]]` of afbeeldings-URL) wordt een banner; andere tekst wordt een platte-tekst-banner (bv. een klantnaam). Toevoegen of **uploaden** kan vanuit het venster — uploads komen in een instelbare **Cover-map** (standaard `Kanban Notes/assets`).
- **Kaarten stylen met eigen CSS** — elke metadata-waarde krijgt `data-field`/`data-value`-attributen (en de kaart `data-priority`/`data-project`/`data-client`/`data-column`), zodat je met een CSS-snippet waarden als gekleurde pillen toont.

**Ordenen**

- **Klanten** — een tweede gekleurde tag-dimensie `#client/naam` naast het project, zodat een kaart zowel een klant als een project draagt.
- **Swimlanes** — een "Groeperen in banen"-keuze zet kaarten in horizontale banen op project, klant, prioriteit of datum.
- **Meerdere borden** — maak benoemde borden, elk afgebakend op projecten/klanten met een eigen banen-groepering; wissel bovenaan via een kiezer.
- **Taken uit #kanban-notities** — optioneel: tag een notitie met `#kanban` en al haar checkboxes verschijnen op het bord, zonder per-taak-tag. Het bord is dan beperkt tot je #kanban-notities — nieuwe (open) taken komen in de Inbox om te sorteren, afgevinkte in de afgerond-kolom, en taken met een eigen `#kanban/<kolom>` gaan naar die kolom.

**Kalender**

- **Onthoudt je weergave** — de kalender opent weer in de laatst gekozen Maand/Week/Dag-weergave (handig in split-screen).
