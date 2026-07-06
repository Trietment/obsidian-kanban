## Sync-safe auto-move (bugfix)

Fixes disappearing cards in multi-device vaults. When two devices rewrote the same task line around a sync moment — for example opening the app on your phone while Obsidian Sync was still pulling changes from your desktop — Obsidian Sync could merge the two versions character by character and mangle the column tag (e.g. `#kanban/ingdoing`). A card with such a tag belonged to no column and not to the Inbox either, so it silently vanished from the board on every device.

- **Auto-move now waits for sync.** The automatic "move due tasks to In progress" only runs once Obsidian Sync reports *Fully synced* and the vault has been quiet for a few seconds. Offline it writes nothing and simply retries until you are back online and synced, so two devices can no longer rewrite the same lines around a sync moment. Vaults without Obsidian Sync use the quiet window. The manual command keeps working at all times and shows a heads-up while sync is busy.
- **Unknown column tags are visible again.** Cards whose `#kanban/` tag does not match any column now appear in the Inbox instead of nowhere. Auto-move repairs due cards with a mangled tag automatically, and editing such a card normalizes the tag.

### Nederlands

Lost verdwijnende kaarten op in vaults met meerdere apparaten. Als twee apparaten rond een sync-moment dezelfde taakregel herschreven — bijvoorbeeld de app op je telefoon openen terwijl Obsidian Sync nog wijzigingen van je desktop aan het binnenhalen was — kon Obsidian Sync de twee versies teken voor teken samenvoegen en de kolom-tag verhaspelen (bv. `#kanban/ingdoing`). Zo'n kaart hoorde bij geen enkele kolom en ook niet bij de Inbox, en verdween dus stilletjes van het bord, op elk apparaat.

- **Auto-move wacht nu op de sync.** Het automatische "due taken naar Bezig" draait pas zodra Obsidian Sync *Fully synced* meldt en de vault een paar seconden in rust is. Offline schrijft hij niets en probeert hij het gewoon opnieuw zodra je weer online en gesynchroniseerd bent — twee apparaten kunnen dus niet langer rond een sync-moment dezelfde regels herschrijven. Vaults zonder Obsidian Sync gebruiken het rustvenster. Het handmatige commando blijft altijd werken en toont een melding zolang de sync bezig is.
- **Onbekende kolom-tags zijn weer zichtbaar.** Kaarten waarvan de `#kanban/`-tag bij geen enkele kolom hoort, staan voortaan in de Inbox in plaats van nergens. Auto-move herstelt due kaarten met een verhaspelde tag automatisch, en zo'n kaart bewerken normaliseert de tag.
