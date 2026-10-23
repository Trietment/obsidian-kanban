## Dates you change on your phone stick

- **A date you change on your phone now reaches Microsoft.** Phones never talk to Microsoft themselves — the desktop runs the To Do sync, and until now it could not tell which side had changed a date, so a due date you moved on your phone's board quietly jumped back at the next sync. The desktop now remembers, per linked card, the last date both sides agreed on. Only the board changed — on your phone, by editing the note by hand, or because a push from an offline desktop failed? Then the date goes to Microsoft. Only Microsoft changed it, in Reminders or To Do? Then the board follows, as before. Both? Microsoft wins, as before.
- **A recurring card moved to an earlier day stays put.** It used to be ticked, unlinked and imported again with the old date; the new date now simply goes to Microsoft. Ticking such a card on your phone now completes it in Microsoft too, instead of the task coming back as a fresh card.
- **A date Microsoft refuses is put back** — clearing the date of a recurring task, for example — so both sides never stay different, and the card stays in its column.
- **Only the desktop needs this update.** The first sync after updating starts without remembered dates, so for a card that differs at that moment Microsoft wins one last time.

**Housekeeping**

- **Network use is described in the README**: which services the plugin talks to, when and why — and that there is no telemetry.
- **README cleanup**: the syntax table shows a real cover example, and the release script's markers are plain markers.
- **No more partially supported CSS**: the phone's column chips hide their scrollbar with `::-webkit-scrollbar` only, the way Obsidian hides its own.
- **The export setting tells the truth again**: the due date stays the same on both sides (since 1.19.0), not only at creation.

### Nederlands

**Datums die je op je telefoon verzet blijven staan**

- **Een datum die je op je telefoon wijzigt, komt nu aan bij Microsoft.** Telefoons praten zelf nooit met Microsoft — de desktop doet de To Do-sync, en die kon tot nu toe niet zien welke kant een datum had gewijzigd, dus sprong een due date die je op het bord van je telefoon verzette bij de volgende sync stilletjes terug. De desktop onthoudt nu per gekoppelde kaart de laatste datum waarover beide kanten het eens waren. Alleen het bord gewijzigd — op je telefoon, met de hand in de note, of doordat een push vanaf een offline desktop mislukte? Dan gaat de datum naar Microsoft. Alleen Microsoft, in Reminders of To Do? Dan volgt het bord, zoals voorheen. Allebei? Dan wint Microsoft, zoals voorheen.
- **Een herhalende kaart die je naar eerder verzet, blijft staan.** Die werd afgevinkt, losgekoppeld en opnieuw geïmporteerd met de oude datum; de nieuwe datum gaat nu gewoon naar Microsoft. Zo'n kaart op je telefoon afvinken rondt hem nu ook in Microsoft af, in plaats van dat de taak terugkomt als verse kaart.
- **Een datum die Microsoft weigert, wordt teruggezet** — de datum van een herhalende taak wissen bijvoorbeeld — zodat beide kanten nooit blijven verschillen, en de kaart blijft in zijn kolom staan.
- **Alleen de desktop heeft deze update nodig.** De eerste sync na het updaten begint zonder onthouden datums, dus bij een kaart die op dat moment verschilt, wint Microsoft nog één keer.

**Onderhoud**

- **Netwerkgebruik staat in de README**: met welke diensten de plugin praat, wanneer en waarom — en dat er geen telemetrie is.
- **README opgeschoond**: de syntaxtabel toont een echt cover-voorbeeld, en de markers van het release-script zijn kale markers.
- **Geen gedeeltelijk ondersteunde CSS meer**: de kolomchips op de telefoon verbergen hun scrollbalk alleen nog met `::-webkit-scrollbar`, zoals Obsidian dat zelf doet.
- **De exportinstelling vertelt weer de waarheid**: de due date blijft aan beide kanten gelijk (sinds 1.19.0), niet alleen bij het aanmaken.
