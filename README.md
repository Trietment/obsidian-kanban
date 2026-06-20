# Trietment Kanban

Een Kanban-bord voor [Obsidian](https://obsidian.md) dat taken verzamelt uit **alle notes in je vault**. Taken zijn gewone markdown-checkboxes met optionele metadata; de plugin toont ze als sleepbare kaarten in kolommen. Werkt op desktop én mobiel.

## Functies

- **Taken uit je hele vault** — elke `- [ ]` checkbox met een `#kanban/`-tag verschijnt op het bord.
- **Dynamische kolommen** — standaard: Te doen / Bezig / Wacht op reactie / Klaar. Voeg in de instellingen zelf kolommen toe, hernoem ze, wijzig de volgorde of verwijder ze. Sleep kaarten tussen kolommen (desktop) of wijzig de kolom in de edit-modal (mobiel).
- **Projecten met kleuren** — groepeer met `#project/naam`, elk met eigen kleur en optioneel label. Subprojecten (`#project/klant/acme`) worden ondersteund.
- **Due dates & herhaling** — `📅 2026-05-28` en `🔁 every week`. Afgevinkte herhalende taken maken automatisch de volgende instance aan.
- **Prioriteiten** — `🔺 ⏫ 🔼 🔽 ⏬`.
- **Subtaken** — ingesprongen checkboxes onder een taak. Het bord toont een `☑ 2/5`-voortgangsbadge; toevoegen en afvinken doe je in de edit-modal.
- **Gekoppelde notitie per kaart** — met de 📄-knop maak je uit een template een eigen notitie voor een taak (een `[[wikilink]]` in de taakregel). Bestaat hij al, dan opent de knop hem.
- **Klik = bewerken** — klik op een kaart voor de edit-modal: status/kolom, due date, project, herhaling, subtaken en notitie op één plek.
- **Automatisch verplaatsen** — taken die vandaag (of overdue) due zijn schuiven automatisch naar de Bezig-kolom.
- **Inbox** — snelle invoer van nieuwe taken in een instelbare inbox-note.

## Installatie

### Via BRAT (aanbevolen, ook voor mobiel)

Met [BRAT](https://github.com/TfTHacker/obsidian42-brat) installeer en update je de plugin op elk apparaat rechtstreeks vanuit deze repo — los van Obsidian Sync.

1. Installeer de community-plugin **BRAT** en zet 'm aan.
2. Commandopalet → **BRAT: Add a beta plugin for testing**.
3. Vul in: `Trietment/obsidian-kanban`.
4. Kies de laatste versie en bevestig — BRAT installeert de plugin.
5. Zet **Trietment Kanban** aan bij Instellingen → Community-plugins.

Herhaal dit op je telefoon. Updaten gaat via **BRAT: Check for updates**.

### Handmatig

1. Maak de map `<vault>/.obsidian/plugins/trietment-kanban/`.
2. Kopieer daarin `main.js`, `manifest.json` en `styles.css` uit de [laatste release](https://github.com/Trietment/obsidian-kanban/releases).
3. Herstart Obsidian en zet de plugin aan bij Instellingen → Community-plugins.

## Taaksyntaxis

Een taak is een gewone markdown-checkbox met optionele metadata:

```text
- [ ] Offerte uitwerken 📅 2026-05-25 #project/aim #kanban/doing ⏫
    - [ ] Cijfers opvragen
    - [x] Template kiezen
- [ ] Onboarding-call [[Acme onboarding]] #project/klant/acme #kanban/todo
- [x] Mail verstuurd #project/klant/beta #kanban/done
```

| Onderdeel | Betekenis |
|---|---|
| `#kanban/<kolom>` | In welke kolom de taak staat (bv. `#kanban/doing`) |
| `#project/<naam>` | Project; gebruik `/` voor subprojecten (`#project/klant/acme`) |
| `📅 JJJJ-MM-DD` | Due date |
| `🔁 every week` | Herhaling (`every day/week/month/year`, ook `every 2 weeks`) |
| `🔺 ⏫ 🔼 🔽 ⏬` | Prioriteit (hoogst → laagst) |
| `[[Notitie]]` | Gekoppelde notitie |
| ingesprongen `- [ ]` | Subtaak van de taak erboven |

Je kunt taken in **elke** note van je vault zetten — ze worden vanzelf opgepikt.

## Gebruik

- **+ Nieuwe taak** (of het `+` onder een kolom) voegt een taak toe, standaard in de inbox-note.
- **Klik op een kaart** → edit-modal met kolom/status, due date, project, herhaling, subtaken en de gekoppelde notitie.
- **📄** maakt/opent de gekoppelde notitie; **☑ 2/5** toont de subtaak-voortgang.
- **Sleep** een kaart naar een andere kolom (desktop) om de `#kanban/`-tag bij te werken.
- Klik op een **project-badge** om op dat project te filteren.

## Instellingen

- Kolommen toevoegen/hernoemen/verwijderen/herordenen, standaardkolom, klaar-kolom, inbox-note, inbox-kolom tonen.
- Automatisch verplaatsen (vandaag → Bezig, optioneel ook overdue).
- Projecten & kleuren, met een knop om de vault te scannen op `#project/`-tags.
- Gekoppelde notities: notitie-map en template-bestand (leeg = ingebouwde template).

## Bestanden

- `main.js` — de plugin
- `manifest.json` — plugin-metadata
- `styles.css` — styling
- `versions.json` — versie ↔ minimale Obsidian-versie (voor BRAT)

> `data.json` (je persoonlijke instellingen en projectkleuren) hoort bij je vault en zit bewust **niet** in deze repo.
