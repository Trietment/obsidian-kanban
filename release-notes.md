## Your phone board opens on the column you left it on

- **No more jumping back to the first column.** The board has remembered which column you had open since 1.16.0, but it drew itself before that memory arrived — so every time you opened it you landed on the first column anyway. The remembered column is now in place before the board appears, per board and per device.
- **The chips respond to the first tap.** Because the board thought it was already on your remembered column while showing the first one, the chip for that column did nothing: it saw itself as active. Only after tapping a different column did it start working. Chips now compare against what is actually on screen, so the first tap always lands.
- **Still nothing written to your vault.** The remembered column sits in Obsidian's own per-device storage: your phone does not follow your laptop's column, and no note or settings file changes — so there is nothing for a sync to merge.

### Nederlands

**Je telefoonbord opent op de kolom waar je gebleven was**

- **Niet meer terug naar de eerste kolom.** Het bord onthoudt sinds 1.16.0 welke kolom je open had staan, maar tekende zichzelf vóórdat die herinnering binnenkwam — dus kwam je bij elke keer openen alsnog op de eerste kolom uit. De onthouden kolom staat nu klaar voordat het bord in beeld komt, per bord en per apparaat.
- **De chips reageren op de eerste tik.** Doordat het bord dácht dat het al op je onthouden kolom stond terwijl het de eerste toonde, deed de chip van die kolom niets: hij zag zichzelf als actief. Pas na een tik op een andere kolom begon hij te werken. Chips vergelijken nu met wat er echt op het scherm staat, dus de eerste tik komt altijd aan.
- **Nog steeds niets in je vault.** De onthouden kolom staat in de opslag van Obsidian zelf, per apparaat: je telefoon volgt de kolom van je laptop niet, en er verandert geen notitie of instellingenbestand — er valt tijdens een sync dus niets te mergen.
