## Housekeeping: no functional changes

Everything new is in [1.16.0](https://github.com/Trietment/obsidian-kanban/releases/tag/1.16.0) — the phone board with one column at a time, the ⋮ move menu, and atomic writes. This release only cleans up after it.

- **Dead phone styling removed.** The single-column board from 1.16.0 made a handful of stylesheet rules unreachable (the sticky column header it now hides, and the swimlane rules for a layout that no longer renders on phones). Removed — behaviour on every device is unchanged.
- **Releases no longer leave a failed build.** The release workflow starts on the version tag, but the release is created by hand, so the workflow always tripped over "a release with the same tag name already exists". It now updates the assets instead of failing.

### Nederlands

Al het nieuwe zit in [1.16.0](https://github.com/Trietment/obsidian-kanban/releases/tag/1.16.0) — het telefoonbord met één kolom tegelijk, het ⋮-verplaatsmenu en de atomaire schrijfacties. Deze release ruimt daar alleen achter op.

- **Dode telefoon-styling verwijderd.** Het single-column-bord uit 1.16.0 maakte een handvol stijlregels onbereikbaar (de sticky kolomkop die nu verborgen wordt, en de banen-regels voor een layout die op telefoons niet meer rendert). Weggehaald — het gedrag op elk apparaat blijft gelijk.
- **Een release laat geen mislukte build meer achter.** De release-workflow start op de versietag, maar de release wordt met de hand aangemaakt, dus struikelde de workflow altijd over "a release with the same tag name already exists". Hij werkt nu de assets bij in plaats van te falen.
