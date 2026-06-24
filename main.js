'use strict';

const obsidian = require('obsidian');
const { Plugin, ItemView, Modal, Setting, PluginSettingTab, TFile, Notice, MarkdownView } = obsidian;

const VIEW_TYPE_KANBAN = 'trietment-kanban-view';
const VIEW_TYPE_CALENDAR = 'trietment-calendar-view';

// -- Microsoft / Outlook (OAuth2 + Microsoft Graph) -------------------------
// "common" = elke organisatie + persoonlijke Microsoft-accounts (multi-tenant).
const MS_AUTHORITY = 'https://login.microsoftonline.com/common';
const MS_SCOPES = 'openid profile offline_access User.Read Calendars.Read Calendars.Read.Shared';
const MS_AUTH_PROTOCOL = 'trietment-kanban-auth';
const MS_REDIRECT = `obsidian://${MS_AUTH_PROTOCOL}`;
// Application (client) ID van de geregistreerde Azure-app, zodat de koppeling
// voor álle gebruikers werkt zonder eigen registratie. Het Client ID is publiek
// (geen geheim). Gebruikers kunnen dit desgewenst overschrijven in de instellingen.
const DEFAULT_MS_CLIENT_ID = '9a17bc84-20cf-46e7-b761-d52aadcd92ac';
// Eigen kleurenpalet voor gekoppelde agenda's (los van de projectkleuren).
const OUTLOOK_PALETTE = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ca8a04', '#16a34a'];

const DEFAULT_SETTINGS = {
  columns: ['todo', 'doing', 'waiting', 'done'],
  columnLabels: { todo: 'Te doen', doing: 'Bezig', waiting: 'Wacht op reactie', done: 'Klaar' },
  defaultColumn: 'todo',
  doneColumn: 'done',
  inboxNote: 'Kanban Inbox.md',
  showInbox: true,
  projectColors: {},
  projectLabels: {},
  projectScanFolders: [], // map(pen) die op #project/-tags doorzocht worden (leeg = hele vault)
  autoMoveToday: true,
  inProgressColumn: 'doing',
  autoMoveOverdue: false,
  noteFolder: 'Kanban Notes', // map voor álle gekoppelde notities (leeg = bij de bron-note)
  noteTemplate: '',   // leeg = ingebouwde template hieronder
  archiveNotesOnDone: true,   // gekoppelde notitie naar archief-submap verplaatsen bij afronden (terug bij heropenen)
  archiveFolder: '0. archive',// naam van de archief-submap binnen de notitie-map
  language: 'auto',   // 'auto' (volg Obsidian) | 'nl' | 'en'

  // Outlook / Microsoft Graph
  outlookEnabled: false,        // events tonen in de kalender
  microsoftClientId: '',        // eigen Azure app (leeg = ingebouwde standaard, indien meegeleverd)
  outlookAccounts: [],          // [{ id, label, email, customName, color, calendars, selected, needsReauth }] — tokens staan device-lokaal (localStorage), niet hier
  outlookShowEvents: true,      // snelle aan/uit in de kalenderkop
};

// Engelse standaard-kolomlabels (alleen bij een verse installatie in het Engels).
const DEFAULT_COLUMN_LABELS_EN = { todo: 'To do', doing: 'In progress', waiting: 'Waiting for response', done: 'Done' };

// Ingebouwde template voor een gekoppelde notitie. Placeholders tussen {{ }}
// worden vervangen (zie renderNoteTemplate).
const DEFAULT_NOTE_TEMPLATE = [
  '---',
  'project: {{project}}',
  'due: {{due}}',
  'status: {{status}}',
  'created: {{date}}',
  '---',
  '',
  '# {{title}}',
  '',
  '## Links',
  '- Bron-note: [[{{source}}]]',
  '',
].join('\n');

const DEFAULT_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#a855f7',
  '#ec4899', '#ef4444', '#06b6d4', '#84cc16',
  '#f97316', '#8b5cf6', '#14b8a6', '#eab308',
];

const PRIORITY_ICONS = {
  highest: '🔺',
  high: '⏫',
  medium: '🔼',
  low: '🔽',
  lowest: '⏬',
};

// -- i18n -------------------------------------------------------------------

const TRANSLATIONS = {
  nl: {
    // Commands / ribbon / view
    open_board: 'Open Kanban-bord',
    board_title: 'Kanban-bord',
    open_calendar: 'Open kalender',
    calendar_title: 'Kalender',
    cal_today: 'Vandaag',
    cal_prev: 'Vorige',
    cal_next: 'Volgende',
    cal_month: 'Maand',
    cal_week: 'Week',
    cal_day: 'Dag',
    cal_open_board: 'Open bord',
    open_calendar_tip: 'Open kalender',
    cal_more: '+{n} meer',
    cal_more_tip: 'Toon alle items van deze dag',
    cal_no_items: 'Geen afspraken of taken op deze dag.',
    // Outlook
    ol_section: 'Outlook-agenda',
    ol_help: 'Koppel je Microsoft/Outlook-agenda en toon de afspraken naast je taken in de kalenderweergave (alleen-lezen).',
    ol_client_id: 'Microsoft Client ID',
    ol_client_id_desc: 'Application (client) ID van een Azure app-registratie. Registreer een app in het Microsoft Entra-portaal, voeg onder "Mobiele en desktop-applicaties" de redirect-URI obsidian://trietment-kanban-auth toe, sta publieke client-flows toe en geef de gedelegeerde rechten Calendars.Read + offline_access.',
    ol_client_id_ph: 'Application (client) ID',
    ol_client_id_ph_builtin: 'Leeg = ingebouwde Client ID gebruiken',
    ol_client_id_builtin: '✓ Ingebouwde Client ID is actief — je hoeft hier niets in te vullen. Vul alleen een eigen ID in om die te overschrijven.',
    ol_client_id_custom: '✓ Eigen Client ID actief (overschrijft de ingebouwde).',
    ol_client_id_none: '⚠ Nog geen Client ID — vul er een in om te kunnen koppelen.',
    ol_show_events: 'Outlook-events tonen',
    ol_show_events_desc: 'Toon de afspraken uit je gekoppelde agenda(s) in de kalenderweergave.',
    ol_accounts: 'Gekoppelde accounts',
    ol_no_accounts: 'Nog geen accounts gekoppeld.',
    ol_add_account: 'Account koppelen',
    ol_add_account_desc: 'Meld je aan bij Microsoft. Je kunt meerdere accounts koppelen.',
    ol_connect: 'Koppelen',
    ol_remove: 'Ontkoppelen',
    ol_reauth_needed: 'opnieuw aanmelden nodig',
    ol_need_client_id: 'Vul eerst een Microsoft Client ID in via de instellingen.',
    ol_opening_browser: 'Browser openen om aan te melden…',
    ol_connected: '{name} gekoppeld.',
    ol_disconnected: 'Account ontkoppeld.',
    ol_auth_failed: 'Aanmelden mislukt: {msg}',
    ol_token_failed: 'Token ophalen mislukt: {msg}',
    ol_state_mismatch: 'Aanmelding kwam niet overeen (state mismatch). Probeer opnieuw.',
    ol_account: 'Account',
    ol_account_name: 'Naam',
    ol_account_name_hint: 'Geef dit account een herkenbare naam',
    ol_event_untitled: '(geen titel)',
    ol_calendars: 'Agenda’s',
    ol_refresh_calendars: 'Agenda’s vernieuwen',
    ol_loading_calendars: 'Agenda’s laden…',
    ol_no_calendars: 'Geen agenda’s gevonden. Klik op vernieuwen of koppel opnieuw.',
    ol_shared_note: 'Gedeelde agenda’s vereisen het recht Calendars.Read.Shared in je Azure-app. Voeg het toe en koppel het account opnieuw als gedeelde agenda’s ontbreken. Een gedeelde agenda verschijnt pas nadat je hem in Outlook hebt toegevoegd.',
    cmd_add_inbox: 'Voeg Kanban-taak toe (inbox)',
    cmd_add_current: 'Voeg Kanban-taak toe aan huidige note',
    open_note_first: 'Open eerst een note.',
    cmd_auto_move: 'Verplaats taken die vandaag due zijn naar Bezig',
    moved_n: '{n} ta(a)k(en) naar Bezig verplaatst.',
    nothing_to_move: 'Geen taken om te verplaatsen.',
    refresh: 'Vernieuwen',
    filter_placeholder: 'Filter taken…',
    hide_done: ' Verberg klaar',
    new_task: '+ Nieuwe taak',
    add_task_col: '+ Taak toevoegen',
    inbox: 'Inbox',
    empty_task: '(lege taak)',
    empty: '(leeg)',
    subtasks_done_tip: '{d}/{t} subtaken klaar — open om te bewerken',
    open_linked_note: 'Open gekoppelde notitie',
    create_linked_note: 'Maak gekoppelde notitie',
    delete: 'Verwijder',
    delete_extra: ' (incl. {n} subtaak/taken)',
    confirm_delete: 'Verwijder taak: "{text}"?{extra}',
    complete_subs_first_tip: 'Eerst alle subtaken afvinken ({o} van {t} nog open)',
    complete_subs_first: 'Eerst alle subtaken afvinken — nog {o} open.',
    parent_of: 'Bovenliggend: {p}',
    project_of: 'Project: {p}',
    repeats: 'Herhaalt: {r}',
    // Plugin notices
    no_file_path: 'Geen bestandspad opgegeven.',
    no_target_file: 'Geen doelbestand. Stel een inbox-note in via Instellingen.',
    task_added_to: 'Taak toegevoegd aan {path}',
    // Recurrence presets
    rec_none: 'Geen',
    rec_daily: 'Dagelijks',
    rec_weekly: 'Wekelijks',
    rec_2weeks: 'Elke 2 weken',
    rec_monthly: 'Maandelijks',
    rec_quarterly: 'Per kwartaal',
    rec_yearly: 'Jaarlijks',
    rec_custom_suffix: ' (aangepast)',
    // Priorities
    prio_none: 'Geen',
    prio_highest: '🔺 Hoogst',
    prio_high: '⏫ Hoog',
    prio_medium: '🔼 Middel',
    prio_low: '🔽 Laag',
    prio_lowest: '⏬ Laagst',
    // Add task modal
    add_modal_title: 'Nieuwe Kanban-taak',
    task: 'Taak',
    task_placeholder: 'Wat moet er gebeuren?',
    column: 'Kolom',
    project: 'Project',
    project_add_desc: 'Optioneel. Kies een bestaand project of typ een nieuwe naam.',
    project_placeholder1: 'bv. aim of klant/acme',
    due_date: 'Due date',
    time: 'Tijd',
    priority: 'Prioriteit',
    repeat: 'Herhalen',
    repeat_add_desc: 'Bij afvinken maakt de plugin automatisch een volgende instance met de nieuwe due date.',
    target_file: 'Doel-bestand',
    target_file_desc: 'Waar de taak wordt opgeslagen. Leeg = inbox-note uit instellingen.',
    cancel: 'Annuleer',
    add: 'Voeg toe',
    task_required: 'Taaktekst is verplicht.',
    // Edit task modal
    edit_modal_title: 'Taak bewerken',
    source_line: 'Bron: {file}:{line}',
    column_status: 'Kolom / status',
    due_clear_desc: 'Leeg laten om de datum te verwijderen.',
    time_clear_desc: 'Leeg laten om de tijd te verwijderen.',
    repeat_edit_desc: 'Bij afvinken wordt er automatisch een volgende instance gemaakt.',
    project_edit_desc: 'Leeg laten om het project te verwijderen. Gebruik / voor subproject (bv. klant/acme).',
    project_placeholder2: 'bv. klant/acme',
    subtasks: 'Subtaken',
    no_subtasks: 'Nog geen subtaken.',
    delete_subtask: 'Verwijder subtaak',
    new_subtask: 'Nieuwe subtaak…',
    add_subtask: 'Subtaak toevoegen',
    open_in_note: 'Open in note',
    note_btn: '📄 Notitie',
    save: 'Opslaan',
    // Settings
    settings_title: 'Trietment Kanban — instellingen',
    sec_general: 'Algemeen',
    language: 'Taal',
    language_desc: 'Taal van de plugin. "Automatisch" volgt de taal van Obsidian. Herstart Obsidian na het wijzigen om alle teksten (zoals commando\'s) bij te werken.',
    lang_auto: 'Automatisch (volg Obsidian)',
    lang_nl: 'Nederlands',
    lang_en: 'English',
    sec_columns: 'Kolommen',
    columns_help: 'Voeg kolommen toe, hernoem of verwijder ze en wijzig de volgorde. De ID wordt gebruikt in de #kanban/<id>-tag in je taken.',
    flag_default: 'standaard',
    flag_inprogress: 'bezig',
    flag_done: 'klaar',
    display_name: 'Weergavenaam',
    move_up: 'Omhoog',
    move_down: 'Omlaag',
    delete_column: 'Kolom verwijderen',
    need_one_column: 'Je hebt minstens één kolom nodig.',
    add_column: 'Kolom toevoegen',
    add_column_desc: 'Typ een naam en klik op Toevoegen. De ID wordt automatisch afgeleid.',
    add_column_placeholder: 'bv. Wacht op reactie',
    name_the_column: 'Geef de kolom een naam.',
    default_column: 'Standaardkolom',
    default_column_desc: 'Kolom waarin nieuwe taken landen.',
    done_column: 'Klaar-kolom',
    done_column_desc: 'Taken die hierheen verplaatst worden krijgen [x].',
    inbox_note: 'Inbox-note',
    inbox_note_desc: 'Standaardbestand voor nieuwe taken. Wordt aangemaakt als het niet bestaat.',
    show_inbox: 'Inbox-kolom tonen',
    show_inbox_desc: 'Toon taken zonder #kanban/ tag in een aparte Inbox-kolom.',
    sec_linked_notes: 'Gekoppelde notities',
    linked_notes_help: 'Elke kaart kan een eigen notitie krijgen via de 📄-knop. De notitie wordt aangemaakt uit een template.',
    note_folder: 'Notitie-map',
    note_folder_desc: 'Map waarin álle gekoppelde notities komen (wordt automatisch aangemaakt). Leeg = dezelfde map als de note waar de taak in staat.',
    note_folder_placeholder: 'bv. Kanban Notes — leeg = bij de bron-note',
    archive_notes: 'Notities archiveren bij afronden',
    archive_notes_desc: 'Verplaatst de gekoppelde notitie naar een archief-submap zodra de kaart in de afgerond-kolom komt. Zet je de kaart weer op niet-afgerond, dan komt de notitie er weer uit. Wikilinks blijven automatisch kloppen.',
    archive_folder: 'Naam archief-submap',
    archive_folder_desc: 'Submap (binnen de map van de notitie) waar afgeronde notities heen gaan.',
    archive_name_clash: 'Kon "{name}" niet (de)archiveren: er bestaat al een bestand met die naam op de doellocatie.',
    template_file: 'Template-bestand',
    template_file_desc: 'Pad naar een template-note. Leeg = ingebouwde template. Placeholders: {{title}} {{project}} {{due}} {{status}} {{date}} {{time}} {{source}} {{sourcePath}}',
    template_file_placeholder: 'leeg = ingebouwde template',
    sec_automove: 'Automatisch verplaatsen',
    automove_today: 'Vandaag → Bezig',
    automove_today_desc: 'Taken met due date = vandaag worden automatisch vanuit Inbox/Te-doen naar de Bezig-kolom verplaatst.',
    inprogress_column: 'Bezig-kolom',
    inprogress_column_desc: 'Naar welke kolom due-taken verplaatst worden.',
    none_paren: '(geen)',
    automove_overdue: 'Ook achterstallige taken',
    automove_overdue_desc: 'Verplaats ook taken waarvan de due date al verstreken is (niet alleen exact vandaag).',
    sec_projects: 'Projecten en kleuren',
    projects_help: 'Geef per project een kleur. Gebruik #project/<naam> in je taken om ze hieraan te koppelen.',
    scan_folders: 'Scan-map(pen) voor projecten',
    scan_folders_desc: 'Beperk de projectdetectie tot deze map(pen). Eén pad per regel (bv. Klanten of Werk/Projecten). Leeg = de hele vault.',
    scan_folders_placeholder: 'leeg = hele vault',
    detect_projects: 'Detecteer projecten uit vault',
    detect_projects_desc: 'Doorzoek de ingestelde map(pen) (of de hele vault) naar #project/ tags en wijs automatisch een kleur toe aan ontbrekende projecten.',
    scan_vault: 'Scannen',
    scan_result: '{found} projecten gevonden, {added} nieuwe kleuren toegekend.',
    no_projects_yet: 'Nog geen projecten. Voeg een taak toe met #project/<naam> en hij verschijnt hier.',
    project_label_placeholder: 'weergave-label (optioneel)',
    remove_color: 'Verwijder kleur (taken blijven bestaan)',
    sec_help: 'Hoe werkt het?',
    help_p1: 'Taken zijn gewone markdown checkboxes. Voeg ze in om het even welke note toe — het bord verzamelt ze automatisch.',
    help_example: '- [ ] Offerte uitwerken 📅 2026-05-25 #project/aim #kanban/doing ⏫\n    - [ ] Cijfers opvragen\n    - [x] Template kiezen\n- [ ] Onboarding-call met klant [[Acme onboarding]] #project/klant/acme #kanban/todo\n- [x] Mail verstuurd #project/klant/beta #kanban/done',
    help_p2: 'Klik op een kaart om hem te bewerken. In de modal beheer je status, due date, project, subtaken en de gekoppelde notitie.',
    help_p3: 'Subtaken zijn ingesprongen checkboxes onder een taak. Het bord toont een ☑ 2/5 badge; toevoegen/afvinken doe je in de edit-modal.',
    help_p4: 'Met de 📄-knop maak je een gekoppelde notitie (een [[wikilink]] in de taakregel) uit je template. Bestaat hij al, dan opent de knop hem.',
    help_p5: 'Sleep een kaart naar een andere kolom (desktop) of wijzig de kolom in de modal. Klik op een gekleurde project-badge om op dat project te filteren.',
  },
  en: {
    open_board: 'Open Kanban board',
    board_title: 'Kanban board',
    open_calendar: 'Open calendar',
    calendar_title: 'Calendar',
    cal_today: 'Today',
    cal_prev: 'Previous',
    cal_next: 'Next',
    cal_month: 'Month',
    cal_week: 'Week',
    cal_day: 'Day',
    cal_open_board: 'Open board',
    open_calendar_tip: 'Open calendar',
    cal_more: '+{n} more',
    cal_more_tip: 'Show all items for this day',
    cal_no_items: 'No appointments or tasks on this day.',
    // Outlook
    ol_section: 'Outlook calendar',
    ol_help: 'Connect your Microsoft/Outlook calendar and show its appointments alongside your tasks in the calendar view (read-only).',
    ol_client_id: 'Microsoft Client ID',
    ol_client_id_desc: 'Application (client) ID of an Azure app registration. Register an app in the Microsoft Entra portal, add the redirect URI obsidian://trietment-kanban-auth under "Mobile and desktop applications", allow public client flows, and grant the delegated permissions Calendars.Read + offline_access.',
    ol_client_id_ph: 'Application (client) ID',
    ol_client_id_ph_builtin: 'Empty = use built-in Client ID',
    ol_client_id_builtin: '✓ Built-in Client ID is active — you do not need to fill this in. Only enter your own ID to override it.',
    ol_client_id_custom: '✓ Custom Client ID active (overrides the built-in one).',
    ol_client_id_none: '⚠ No Client ID yet — enter one to be able to connect.',
    ol_show_events: 'Show Outlook events',
    ol_show_events_desc: 'Show the appointments from your connected calendar(s) in the calendar view.',
    ol_accounts: 'Connected accounts',
    ol_no_accounts: 'No accounts connected yet.',
    ol_add_account: 'Connect account',
    ol_add_account_desc: 'Sign in with Microsoft. You can connect multiple accounts.',
    ol_connect: 'Connect',
    ol_remove: 'Disconnect',
    ol_reauth_needed: 're-authentication needed',
    ol_need_client_id: 'Enter a Microsoft Client ID in settings first.',
    ol_opening_browser: 'Opening browser to sign in…',
    ol_connected: '{name} connected.',
    ol_disconnected: 'Account disconnected.',
    ol_auth_failed: 'Sign-in failed: {msg}',
    ol_token_failed: 'Token exchange failed: {msg}',
    ol_state_mismatch: 'Sign-in did not match (state mismatch). Please try again.',
    ol_account: 'Account',
    ol_account_name: 'Name',
    ol_account_name_hint: 'Give this account a recognizable name',
    ol_event_untitled: '(no title)',
    ol_calendars: 'Calendars',
    ol_refresh_calendars: 'Refresh calendars',
    ol_loading_calendars: 'Loading calendars…',
    ol_no_calendars: 'No calendars found. Click refresh or reconnect.',
    ol_shared_note: 'Shared calendars require the Calendars.Read.Shared permission in your Azure app. Add it and reconnect the account if shared calendars are missing. A shared calendar only appears after you add it in Outlook.',
    cmd_add_inbox: 'Add Kanban task (inbox)',
    cmd_add_current: 'Add Kanban task to current note',
    open_note_first: 'Open a note first.',
    cmd_auto_move: 'Move tasks due today to In progress',
    moved_n: '{n} task(s) moved to In progress.',
    nothing_to_move: 'No tasks to move.',
    refresh: 'Refresh',
    filter_placeholder: 'Filter tasks…',
    hide_done: ' Hide done',
    new_task: '+ New task',
    add_task_col: '+ Add task',
    inbox: 'Inbox',
    empty_task: '(empty task)',
    empty: '(empty)',
    subtasks_done_tip: '{d}/{t} subtasks done — open to edit',
    open_linked_note: 'Open linked note',
    create_linked_note: 'Create linked note',
    delete: 'Delete',
    delete_extra: ' (incl. {n} subtask(s))',
    confirm_delete: 'Delete task: "{text}"?{extra}',
    complete_subs_first_tip: 'Complete all subtasks first ({o} of {t} still open)',
    complete_subs_first: 'Complete all subtasks first — {o} still open.',
    parent_of: 'Parent: {p}',
    project_of: 'Project: {p}',
    repeats: 'Repeats: {r}',
    no_file_path: 'No file path given.',
    no_target_file: 'No target file. Set an inbox note in Settings.',
    task_added_to: 'Task added to {path}',
    rec_none: 'None',
    rec_daily: 'Daily',
    rec_weekly: 'Weekly',
    rec_2weeks: 'Every 2 weeks',
    rec_monthly: 'Monthly',
    rec_quarterly: 'Quarterly',
    rec_yearly: 'Yearly',
    rec_custom_suffix: ' (custom)',
    prio_none: 'None',
    prio_highest: '🔺 Highest',
    prio_high: '⏫ High',
    prio_medium: '🔼 Medium',
    prio_low: '🔽 Low',
    prio_lowest: '⏬ Lowest',
    add_modal_title: 'New Kanban task',
    task: 'Task',
    task_placeholder: 'What needs to be done?',
    column: 'Column',
    project: 'Project',
    project_add_desc: 'Optional. Pick an existing project or type a new name.',
    project_placeholder1: 'e.g. aim or client/acme',
    due_date: 'Due date',
    time: 'Time',
    priority: 'Priority',
    repeat: 'Repeat',
    repeat_add_desc: 'When completed, the plugin automatically creates the next instance with the new due date.',
    target_file: 'Target file',
    target_file_desc: 'Where the task is saved. Empty = inbox note from settings.',
    cancel: 'Cancel',
    add: 'Add',
    task_required: 'Task text is required.',
    edit_modal_title: 'Edit task',
    source_line: 'Source: {file}:{line}',
    column_status: 'Column / status',
    due_clear_desc: 'Leave empty to remove the date.',
    time_clear_desc: 'Leave empty to remove the time.',
    repeat_edit_desc: 'When completed, the next instance is created automatically.',
    project_edit_desc: 'Leave empty to remove the project. Use / for a subproject (e.g. client/acme).',
    project_placeholder2: 'e.g. client/acme',
    subtasks: 'Subtasks',
    no_subtasks: 'No subtasks yet.',
    delete_subtask: 'Delete subtask',
    new_subtask: 'New subtask…',
    add_subtask: 'Add subtask',
    open_in_note: 'Open in note',
    note_btn: '📄 Note',
    save: 'Save',
    settings_title: 'Trietment Kanban — settings',
    sec_general: 'General',
    language: 'Language',
    language_desc: 'Plugin language. "Automatic" follows the Obsidian language. Restart Obsidian after changing to refresh all text (such as commands).',
    lang_auto: 'Automatic (follow Obsidian)',
    lang_nl: 'Nederlands',
    lang_en: 'English',
    sec_columns: 'Columns',
    columns_help: 'Add columns, rename or remove them and change the order. The ID is used in the #kanban/<id> tag in your tasks.',
    flag_default: 'default',
    flag_inprogress: 'in progress',
    flag_done: 'done',
    display_name: 'Display name',
    move_up: 'Up',
    move_down: 'Down',
    delete_column: 'Delete column',
    need_one_column: 'You need at least one column.',
    add_column: 'Add column',
    add_column_desc: 'Type a name and click Add. The ID is derived automatically.',
    add_column_placeholder: 'e.g. Waiting for response',
    name_the_column: 'Give the column a name.',
    default_column: 'Default column',
    default_column_desc: 'Column where new tasks land.',
    done_column: 'Done column',
    done_column_desc: 'Tasks moved here get [x].',
    inbox_note: 'Inbox note',
    inbox_note_desc: 'Default file for new tasks. Created if it does not exist.',
    show_inbox: 'Show inbox column',
    show_inbox_desc: 'Show tasks without a #kanban/ tag in a separate Inbox column.',
    sec_linked_notes: 'Linked notes',
    linked_notes_help: 'Every card can get its own note via the 📄 button. The note is created from a template.',
    note_folder: 'Note folder',
    note_folder_desc: 'Folder for all linked notes (created automatically). Empty = the same folder as the note the task lives in.',
    note_folder_placeholder: 'e.g. Kanban Notes — empty = next to the source note',
    archive_notes: 'Archive notes when done',
    archive_notes_desc: 'Moves the linked note into an archive subfolder once the card reaches the done column. Reopening the card moves it back. Wikilinks are kept in sync automatically.',
    archive_folder: 'Archive subfolder name',
    archive_folder_desc: 'Subfolder (within the note’s folder) where completed notes go.',
    archive_name_clash: 'Could not (un)archive "{name}": a file with that name already exists at the destination.',
    template_file: 'Template file',
    template_file_desc: 'Path to a template note. Empty = built-in template. Placeholders: {{title}} {{project}} {{due}} {{status}} {{date}} {{time}} {{source}} {{sourcePath}}',
    template_file_placeholder: 'empty = built-in template',
    sec_automove: 'Automatic moving',
    automove_today: 'Today → In progress',
    automove_today_desc: 'Tasks with due date = today are moved automatically from Inbox/To-do to the In-progress column.',
    inprogress_column: 'In-progress column',
    inprogress_column_desc: 'Which column due tasks are moved to.',
    none_paren: '(none)',
    automove_overdue: 'Also overdue tasks',
    automove_overdue_desc: 'Also move tasks whose due date has already passed (not only exactly today).',
    sec_projects: 'Projects and colors',
    projects_help: 'Give each project a color. Use #project/<name> in your tasks to link them.',
    scan_folders: 'Scan folder(s) for projects',
    scan_folders_desc: 'Limit project detection to these folder(s). One path per line (e.g. Clients or Work/Projects). Empty = the whole vault.',
    scan_folders_placeholder: 'empty = whole vault',
    detect_projects: 'Detect projects from vault',
    detect_projects_desc: 'Search the configured folder(s) (or the whole vault) for #project/ tags and assign a color to missing projects automatically.',
    scan_vault: 'Scan',
    scan_result: '{found} projects found, {added} new colors assigned.',
    no_projects_yet: 'No projects yet. Add a task with #project/<name> and it appears here.',
    project_label_placeholder: 'display label (optional)',
    remove_color: 'Remove color (tasks remain)',
    sec_help: 'How does it work?',
    help_p1: 'Tasks are plain markdown checkboxes. Add them to any note — the board collects them automatically.',
    help_example: '- [ ] Draft quote 📅 2026-05-25 #project/aim #kanban/doing ⏫\n    - [ ] Request figures\n    - [x] Pick template\n- [ ] Onboarding call with client [[Acme onboarding]] #project/client/acme #kanban/todo\n- [x] Mail sent #project/client/beta #kanban/done',
    help_p2: 'Click a card to edit it. In the modal you manage status, due date, project, subtasks and the linked note.',
    help_p3: 'Subtasks are indented checkboxes under a task. The board shows a ☑ 2/5 badge; add/check them in the edit modal.',
    help_p4: 'Use the 📄 button to create a linked note (a [[wikilink]] in the task line) from your template. If it exists already, the button opens it.',
    help_p5: 'Drag a card to another column (desktop) or change the column in the modal. Click a colored project badge to filter on that project.',
  },
};

function resolveLang(setting) {
  if (setting === 'nl' || setting === 'en') return setting;
  let loc = '';
  try { loc = (window.localStorage.getItem('language') || '').toLowerCase(); } catch (_) {}
  if (!loc) {
    try { loc = ((obsidian.moment && obsidian.moment.locale && obsidian.moment.locale()) || '').toLowerCase(); } catch (_) {}
  }
  return loc.startsWith('nl') ? 'nl' : 'en';
}

// -- Helpers ----------------------------------------------------------------

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function isoFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// -- PKCE / OAuth-helpers ---------------------------------------------------

// Willekeurige hex-string (voor de PKCE-verifier en de state-parameter).
function randomString(len) {
  const arr = new Uint8Array(Math.ceil(len / 2));
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, len);
}

// base64url zonder padding (voor de PKCE code_challenge).
function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkceChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

// Zet een hex-kleur om naar rgba() — voor de kaart-tint zonder color-mix().
function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return null;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Breedte van de inspringing (een tab telt als 4) — om subtaken te koppelen.
function indentWidth(indent) {
  let w = 0;
  for (const ch of indent || '') w += (ch === '\t') ? 4 : 1;
  return w;
}

// Maak een geldige bestandsnaam van vrije taaktekst.
function sanitizeFileName(s) {
  return (s || '')
    .replace(/[\\/:*?"<>|#^[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function parseRecurrence(rule) {
  if (!rule) return null;
  const r = rule.toLowerCase().trim();
  const m = r.match(/^every\s+(\d+)?\s*(days?|weeks?|months?|years?|daily|weekly|monthly|yearly)$/);
  if (!m) return null;
  const count = m[1] ? parseInt(m[1]) : 1;
  let unit = m[2];
  if (unit.startsWith('day') || unit === 'daily') unit = 'day';
  else if (unit.startsWith('week') || unit === 'weekly') unit = 'week';
  else if (unit.startsWith('month') || unit === 'monthly') unit = 'month';
  else if (unit.startsWith('year') || unit === 'yearly') unit = 'year';
  return { count, unit };
}

function nextDate(fromISO, recurrence) {
  const base = fromISO ? new Date(fromISO + 'T00:00:00') : new Date();
  const { count, unit } = recurrence;
  if (unit === 'day') base.setDate(base.getDate() + count);
  else if (unit === 'week') base.setDate(base.getDate() + count * 7);
  else if (unit === 'month') base.setMonth(base.getMonth() + count);
  else if (unit === 'year') base.setFullYear(base.getFullYear() + count);
  return isoFromDate(base);
}

// Herhaal-presets met vertaalde labels.
function recurrencePresets(plugin) {
  return [
    { value: '', label: plugin.t('rec_none') },
    { value: 'every day', label: plugin.t('rec_daily') },
    { value: 'every week', label: plugin.t('rec_weekly') },
    { value: 'every 2 weeks', label: plugin.t('rec_2weeks') },
    { value: 'every month', label: plugin.t('rec_monthly') },
    { value: 'every 3 months', label: plugin.t('rec_quarterly') },
    { value: 'every year', label: plugin.t('rec_yearly') },
  ];
}

function parseTaskLine(line, filePath, lineNum) {
  const match = line.match(/^(\s*)- \[([ xX\-])\] (.+)$/);
  if (!match) return null;

  const indent = match[1];
  const checkChar = match[2];
  const rest = match[3];
  const done = checkChar !== ' ';

  let dueDate = null;
  const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) dueDate = dateMatch[1];

  // Tijdstip: ⏰ HH:mm (24-uurs). Genormaliseerd naar twee cijfers.
  let time = null;
  const timeMatch = rest.match(/⏰\s*(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    time = String(Math.min(23, parseInt(timeMatch[1], 10))).padStart(2, '0') + ':'
         + String(Math.min(59, parseInt(timeMatch[2], 10))).padStart(2, '0');
  }

  let column = null;
  const colMatch = rest.match(/#kanban\/([\w-]+)/);
  if (colMatch) column = colMatch[1];

  let project = null;
  const projMatch = rest.match(/#project\/([\w-]+(?:\/[\w-]+)*)/);
  if (projMatch) project = projMatch[1];

  let priority = null;
  if (rest.includes('🔺')) priority = 'highest';
  else if (rest.includes('⏫')) priority = 'high';
  else if (rest.includes('🔼')) priority = 'medium';
  else if (rest.includes('🔽')) priority = 'low';
  else if (rest.includes('⏬')) priority = 'lowest';

  let recurrence = null;
  const recMatch = rest.match(/🔁\s+(every\s+(?:\d+\s+)?(?:days?|weeks?|months?|years?|daily|weekly|monthly|yearly))/i);
  if (recMatch) recurrence = recMatch[1].toLowerCase().replace(/\s+/g, ' ').trim();

  // Gekoppelde notitie: eerste [[wikilink]] in de regel.
  let noteLink = null;
  const linkMatch = rest.match(/\[\[([^\]]+)\]\]/);
  if (linkMatch) noteLink = linkMatch[1].split('|')[0].split('#')[0].trim();

  const text = rest
    .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
    .replace(/⏰\s*\d{1,2}:\d{2}/g, '')
    .replace(/🔁\s+every\s+(?:\d+\s+)?(?:days?|weeks?|months?|years?|daily|weekly|monthly|yearly)/gi, '')
    .replace(/#kanban\/[\w-]+/g, '')
    .replace(/#project\/[\w-]+(?:\/[\w-]+)*/g, '')
    .replace(/\[\[[^\]]+\]\]/g, '')
    .replace(/[🔺⏫🔼🔽⏬]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    text, dueDate, time, column, project, priority, recurrence, done, noteLink,
    file: filePath, line: lineNum, indent,
    raw: line, subtasks: [],
  };
}

// -- The plugin -------------------------------------------------------------

module.exports = class KanbanPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.outlook = new OutlookManager(this);
    this.outlook.migrateTokens(); // tokens uit data.json naar device-lokale opslag
    this.registerObsidianProtocolHandler(MS_AUTH_PROTOCOL, (params) => this.outlook.handleRedirect(params));

    this.registerView(VIEW_TYPE_KANBAN, (leaf) => new KanbanView(leaf, this));
    this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));

    this.addRibbonIcon('square-kanban', this.t('open_board'), () => this.activateView());
    this.addRibbonIcon('calendar-days', this.t('open_calendar'), () => this.activateCalendarView());

    this.addCommand({
      id: 'open-kanban',
      name: this.t('open_board'),
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'open-calendar',
      name: this.t('open_calendar'),
      callback: () => this.activateCalendarView(),
    });

    this.addCommand({
      id: 'add-kanban-task',
      name: this.t('cmd_add_inbox'),
      callback: () => {
        new AddTaskModal(this.app, this, async (task) => {
          await this.createTaskInFile(task, task.targetFile || this.settings.inboxNote);
          this.scheduleRefresh();
        }).open();
      },
    });

    this.addCommand({
      id: 'add-kanban-task-current',
      name: this.t('cmd_add_current'),
      editorCallback: (editor, view) => {
        if (!view || !view.file) {
          new Notice(this.t('open_note_first'));
          return;
        }
        new AddTaskModal(this.app, this, async (task) => {
          const line = this.formatTaskLine(task);
          const cursor = editor.getCursor();
          editor.replaceRange(line + '\n', { line: cursor.line, ch: 0 });
          this.scheduleRefresh();
        }, view.file.path).open();
      },
    });

    this.refreshTimer = null;
    this.registerEvent(this.app.vault.on('modify', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('delete', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('rename', () => this.scheduleRefresh()));

    this.addCommand({
      id: 'auto-move-due-today',
      name: this.t('cmd_auto_move'),
      callback: async () => {
        const moved = await this.autoMoveDueTasks();
        new Notice(moved > 0 ? this.t('moved_n', { n: moved }) : this.t('nothing_to_move'));
        this.refreshViews();
      },
    });

    this.settingTab = new KanbanSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);

    // Eén keer draaien zodra de vault klaar is, daarna periodiek (om middernacht-rollover op te vangen).
    this.app.workspace.onLayoutReady(() => {
      this.autoMoveDueTasks().then((moved) => { if (moved > 0) this.refreshViews(); });
    });
    this.registerInterval(window.setInterval(async () => {
      const moved = await this.autoMoveDueTasks();
      if (moved > 0) this.refreshViews();
    }, 10 * 60 * 1000));
  }

  onunload() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  }

  // Vertaal een sleutel; ondersteunt {var}-interpolatie.
  t(key, vars) {
    const lang = this.lang || 'en';
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    let s = (key in dict) ? dict[key] : (key in TRANSLATIONS.en ? TRANSLATIONS.en[key] : key);
    if (vars) {
      for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
    }
    return s;
  }

  applyLanguage() {
    this.lang = resolveLang(this.settings.language);
  }

  scheduleRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refreshViews(), 200);
  }

  refreshViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_KANBAN).forEach((leaf) => {
      if (leaf.view instanceof KanbanView) leaf.view.render();
    });
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach((leaf) => {
      if (leaf.view instanceof CalendarView) leaf.view.render();
    });
  }

  async scanTasks() {
    const tasks = [];
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      let content;
      try { content = await this.app.vault.cachedRead(file); }
      catch (_) { continue; }
      const lines = content.split('\n');
      let current = null;       // huidige top-level taak (= kaart)
      let currentWidth = 0;
      for (let i = 0; i < lines.length; i++) {
        const parsed = parseTaskLine(lines[i], file.path, i);
        if (!parsed) {
          if (lines[i].trim() !== '') { current = null; currentWidth = 0; }
          continue;
        }
        const w = indentWidth(parsed.indent);
        if (current && w > currentWidth) {
          current.subtasks.push({
            text: parsed.text, done: parsed.done,
            file: file.path, line: i, raw: lines[i],
          });
        } else {
          tasks.push(parsed);
          current = parsed;
          currentWidth = w;
        }
      }
    }
    return tasks;
  }

  // Markdown-bestanden binnen de ingestelde scan-map(pen) (leeg = hele vault).
  projectScanFiles() {
    const files = this.app.vault.getMarkdownFiles();
    const folders = (this.settings.projectScanFolders || [])
      .map((f) => f.replace(/^\/+|\/+$/g, '').trim())
      .filter(Boolean);
    if (!folders.length) return files;
    return files.filter((f) => folders.some((d) => f.path === d || f.path.startsWith(d + '/')));
  }

  // Verplaats taken die vandaag (of overdue) due zijn vanuit Inbox/Te-doen naar de Bezig-kolom.
  async autoMoveDueTasks(tasks) {
    if (!this.settings.autoMoveToday) return 0;
    const target = this.settings.inProgressColumn;
    if (!target || !this.settings.columns.includes(target)) return 0;

    if (!tasks) tasks = await this.scanTasks();
    const today = todayISO();
    const startCols = new Set([this.settings.defaultColumn]); // inbox = geen kolom, valt hieronder ook

    // Groepeer per bestand om reads/writes te beperken.
    const byFile = {};
    for (const t of tasks) {
      if (t.done || !t.dueDate) continue;
      const isDue = this.settings.autoMoveOverdue ? t.dueDate <= today : t.dueDate === today;
      if (!isDue) continue;
      const notStarted = !t.column || startCols.has(t.column);
      if (!notStarted) continue;
      (byFile[t.file] = byFile[t.file] || []).push(t);
    }

    let moved = 0;
    for (const filePath of Object.keys(byFile)) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) continue;
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');
      let changed = false;
      for (const t of byFile[filePath]) {
        if (t.line >= lines.length) continue;
        if (!parseTaskLine(lines[t.line], filePath, t.line)) continue; // regel is verschoven/geen taak meer
        let line = lines[t.line];
        if (/#kanban\/[\w-]+/.test(line)) {
          line = line.replace(/#kanban\/[\w-]+/, `#kanban/${target}`);
        } else {
          line = line.trimEnd() + ` #kanban/${target}`;
        }
        if (line !== lines[t.line]) {
          lines[t.line] = line;
          changed = true;
          moved++;
        }
      }
      if (changed) await this.app.vault.modify(file, lines.join('\n'));
    }
    return moved;
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_KANBAN)[0];
    if (!leaf) {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE_KANBAN, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async activateCalendarView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)[0];
    if (!leaf) {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    this.applyLanguage();

    // Verse installatie in het Engels → Engelse standaard-kolomlabels.
    if (!saved) {
      if (this.lang === 'en') {
        this.settings.columnLabels = Object.assign({}, DEFAULT_COLUMN_LABELS_EN);
      }
      await this.saveSettings();
      return;
    }

    // Eenmalige migratie: een onaangepast bord (de oude standaardkolommen)
    // krijgt de nieuwe "Wacht op reactie"-kolom tussen Bezig en Klaar. Boarden
    // die de gebruiker zelf heeft aangepast blijven onaangeroerd.
    const cols = this.settings.columns;
    if (cols.length === 3 && cols[0] === 'todo' && cols[1] === 'doing' && cols[2] === 'done'
        && !this.settings.columnLabels.waiting) {
      this.settings.columns = ['todo', 'doing', 'waiting', 'done'];
      const waitingLabel = this.lang === 'en' ? 'Waiting for response' : 'Wacht op reactie';
      this.settings.columnLabels = Object.assign({ waiting: waitingLabel }, this.settings.columnLabels);
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  formatTaskLine(task) {
    const done = task.column === this.settings.doneColumn;
    let line = `- [${done ? 'x' : ' '}] ${task.text.trim()}`;
    if (task.recurrence) line += ` 🔁 ${task.recurrence}`;
    if (task.dueDate) line += ` 📅 ${task.dueDate}`;
    if (task.time) line += ` ⏰ ${task.time}`;
    if (task.priority && PRIORITY_ICONS[task.priority]) line += ` ${PRIORITY_ICONS[task.priority]}`;
    if (task.project) line += ` #project/${task.project}`;
    if (task.column) line += ` #kanban/${task.column}`;
    return line;
  }

  getProjects() {
    const set = new Set();
    Object.keys(this.settings.projectColors || {}).forEach((p) => set.add(p));
    this.app.workspace.getLeavesOfType(VIEW_TYPE_KANBAN).forEach((leaf) => {
      if (leaf.view instanceof KanbanView) {
        leaf.view.tasks.forEach((t) => t.project && set.add(t.project));
      }
    });
    return [...set].sort();
  }

  getProjectColor(name) {
    if (!name) return null;
    return (this.settings.projectColors || {})[name] || null;
  }

  async assignProjectColor(name) {
    if (!name || this.settings.projectColors[name]) return;
    const used = new Set(Object.values(this.settings.projectColors));
    const free = DEFAULT_PALETTE.find((c) => !used.has(c)) || DEFAULT_PALETTE[Object.keys(this.settings.projectColors).length % DEFAULT_PALETTE.length];
    this.settings.projectColors[name] = free;
    await this.saveSettings();
  }

  async setRecurrence(task, newRule) {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (task.line >= lines.length) return;
    let line = lines[task.line];
    const recRe = /🔁\s+every\s+(?:\d+\s+)?(?:days?|weeks?|months?|years?|daily|weekly|monthly|yearly)/i;
    const recReG = /\s*🔁\s+every\s+(?:\d+\s+)?(?:days?|weeks?|months?|years?|daily|weekly|monthly|yearly)/gi;
    if (recRe.test(line)) {
      if (newRule) line = line.replace(recRe, `🔁 ${newRule}`);
      else line = line.replace(recReG, '');
    } else if (newRule) {
      // Insert na de tekst, voor andere metadata
      const firstMeta = line.search(/\s+(📅|#kanban|#project|🔺|⏫|🔼|🔽|⏬)/);
      if (firstMeta > 0) {
        line = line.slice(0, firstMeta) + ` 🔁 ${newRule}` + line.slice(firstMeta);
      } else {
        line = line.trimEnd() + ` 🔁 ${newRule}`;
      }
    }
    lines[task.line] = line;
    await this.app.vault.modify(file, lines.join('\n'));
  }

  async setProject(task, newProject) {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (task.line >= lines.length) return;
    let line = lines[task.line];
    const projRe = /#project\/[\w-]+(?:\/[\w-]+)*/;
    const projReG = /\s*#project\/[\w-]+(?:\/[\w-]+)*/g;
    if (projRe.test(line)) {
      if (newProject) line = line.replace(projRe, `#project/${newProject}`);
      else line = line.replace(projReG, '');
    } else if (newProject) {
      line = line.trimEnd() + ` #project/${newProject}`;
    }
    lines[task.line] = line;
    await this.app.vault.modify(file, lines.join('\n'));
    if (newProject) await this.assignProjectColor(newProject);
  }

  async ensureFile(path, initialContent = '') {
    if (!path) throw new Error(this.t('no_file_path'));
    const folder = path.substring(0, path.lastIndexOf('/'));
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try { await this.app.vault.createFolder(folder); } catch (_) {}
    }
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      file = await this.app.vault.create(path, initialContent);
    }
    return file;
  }

  async createTaskInFile(task, targetPath) {
    const path = targetPath && targetPath.trim() ? targetPath.trim() : this.settings.inboxNote;
    if (!path) {
      new Notice(this.t('no_target_file'));
      return;
    }
    if (task.project) await this.assignProjectColor(task.project);
    const formatted = this.formatTaskLine(task);
    const file = await this.ensureFile(path, `# Kanban Inbox\n\n`);
    if (file instanceof TFile) {
      const content = await this.app.vault.read(file);
      const sep = content.length === 0 || content.endsWith('\n') ? '' : '\n';
      await this.app.vault.modify(file, content + sep + formatted + '\n');
      new Notice(this.t('task_added_to', { path }));
    }
  }

  async moveTask(taskId, newColumn) {
    const sepIdx = taskId.lastIndexOf('::');
    if (sepIdx < 0) return;
    const filePath = taskId.substring(0, sepIdx);
    const lineNum = parseInt(taskId.substring(sepIdx + 2), 10);

    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;

    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (lineNum < 0 || lineNum >= lines.length) return;

    let line = lines[lineNum];
    const parsed = parseTaskLine(line, filePath, lineNum);
    if (!parsed) return;

    if (newColumn === 'inbox') {
      line = line.replace(/\s*#kanban\/[\w-]+/g, '');
    } else if (/#kanban\/[\w-]+/.test(line)) {
      line = line.replace(/#kanban\/[\w-]+/, `#kanban/${newColumn}`);
    } else {
      line = line.trimEnd() + ` #kanban/${newColumn}`;
    }

    if (newColumn === this.settings.doneColumn) {
      line = line.replace(/^(\s*)- \[ \]/, '$1- [x]');
    } else {
      line = line.replace(/^(\s*)- \[[xX\-]\]/, '$1- [ ]');
    }

    lines[lineNum] = line;
    await this.app.vault.modify(file, lines.join('\n'));

    // Notitie mee-archiveren bij afronden (en terughalen bij heropenen).
    await this.syncNoteArchive(parsed, newColumn === this.settings.doneColumn);
  }

  async deleteTask(task) {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (task.line >= lines.length || lines[task.line] !== task.raw) return;
    let end = task.line;
    if (task.subtasks && task.subtasks.length) {
      end = Math.max(task.line, ...task.subtasks.map((s) => s.line));
    }
    lines.splice(task.line, end - task.line + 1);
    await this.app.vault.modify(file, lines.join('\n'));
  }

  // -- Subtaken -------------------------------------------------------------

  async toggleSubtask(sub) {
    const file = this.app.vault.getAbstractFileByPath(sub.file);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (sub.line >= lines.length || lines[sub.line] !== sub.raw) return;
    let line = lines[sub.line];
    if (sub.done) line = line.replace(/^(\s*)- \[[xX\-]\]/, '$1- [ ]');
    else line = line.replace(/^(\s*)- \[ \]/, '$1- [x]');
    lines[sub.line] = line;
    await this.app.vault.modify(file, lines.join('\n'));
  }

  async addSubtask(task, text) {
    text = (text || '').trim();
    if (!text) return;
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (task.line >= lines.length || lines[task.line] !== task.raw) return;
    let insertAt = task.line + 1;
    if (task.subtasks && task.subtasks.length) {
      insertAt = Math.max(...task.subtasks.map((s) => s.line)) + 1;
    }
    const indent = task.indent || '';
    const childIndent = indent.includes('\t') ? indent + '\t' : indent + '    ';
    lines.splice(insertAt, 0, `${childIndent}- [ ] ${text}`);
    await this.app.vault.modify(file, lines.join('\n'));
  }

  async deleteSubtask(sub) {
    const file = this.app.vault.getAbstractFileByPath(sub.file);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (sub.line >= lines.length || lines[sub.line] !== sub.raw) return;
    lines.splice(sub.line, 1);
    await this.app.vault.modify(file, lines.join('\n'));
  }

  // Lees de actuele subtaken van een taak opnieuw in (na een wijziging in de modal).
  async getSubtasks(task) {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return task.subtasks || [];
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    const parent = task.line < lines.length ? parseTaskLine(lines[task.line], task.file, task.line) : null;
    if (!parent) return task.subtasks || [];
    const parentWidth = indentWidth(parent.indent);
    const subs = [];
    for (let i = task.line + 1; i < lines.length; i++) {
      const p = parseTaskLine(lines[i], task.file, i);
      if (!p) { if (lines[i].trim() !== '') break; else continue; }
      if (indentWidth(p.indent) > parentWidth) {
        subs.push({ text: p.text, done: p.done, file: task.file, line: i, raw: lines[i] });
      } else break;
    }
    return subs;
  }

  // -- Gekoppelde notitie ---------------------------------------------------

  uniqueNoteName(folder, base) {
    const prefix = folder ? folder + '/' : '';
    const exists = (nm) => this.app.vault.getAbstractFileByPath(prefix + nm + '.md');
    if (!exists(base)) return base;
    let n = 2;
    while (exists(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }

  async renderNoteTemplate(task, noteName) {
    let tpl = DEFAULT_NOTE_TEMPLATE;
    const tplPath = (this.settings.noteTemplate || '').trim();
    if (tplPath) {
      const p = tplPath.endsWith('.md') ? tplPath : tplPath + '.md';
      const f = this.app.vault.getAbstractFileByPath(p);
      if (f instanceof TFile) {
        try { tpl = await this.app.vault.read(f); } catch (_) {}
      }
    }
    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const colLabel = task.column ? (this.settings.columnLabels[task.column] || task.column) : '';
    const map = {
      title: task.text || noteName,
      date: isoFromDate(now),
      time,
      project: task.project || '',
      due: task.dueDate || '',
      status: colLabel,
      source: task.file.split('/').pop().replace(/\.md$/, ''),
      sourcePath: task.file,
    };
    return tpl.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in map ? map[key] : m));
  }

  async addNoteLinkToTask(task, linkTarget) {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (task.line >= lines.length || lines[task.line] !== task.raw) return;
    let line = lines[task.line];
    if (/\[\[[^\]]+\]\]/.test(line)) return;
    const link = `[[${linkTarget}]]`;
    const firstMeta = line.search(/\s+(📅|🔁|#kanban|#project|🔺|⏫|🔼|🔽|⏬)/);
    if (firstMeta > 0) line = line.slice(0, firstMeta) + ` ${link}` + line.slice(firstMeta);
    else line = line.trimEnd() + ` ${link}`;
    lines[task.line] = line;
    await this.app.vault.modify(file, lines.join('\n'));
  }

  async openOrCreateLinkedNote(task) {
    if (task.noteLink) {
      const dest = this.app.metadataCache.getFirstLinkpathDest(task.noteLink, task.file);
      if (dest instanceof TFile) {
        await this.app.workspace.getLeaf(false).openFile(dest);
        return;
      }
    }
    const srcFolder = task.file.includes('/') ? task.file.slice(0, task.file.lastIndexOf('/')) : '';
    const folder = (this.settings.noteFolder || '').trim() || srcFolder;
    let fullPath, linkTarget;
    if (task.noteLink) {
      fullPath = task.noteLink.endsWith('.md') ? task.noteLink : task.noteLink + '.md';
      linkTarget = task.noteLink;
    } else {
      const name = this.uniqueNoteName(folder, sanitizeFileName(task.text) || 'Taak');
      fullPath = (folder ? folder + '/' : '') + name + '.md';
      linkTarget = folder ? `${folder}/${name}` : name;
    }
    let file = this.app.vault.getAbstractFileByPath(fullPath);
    if (!file) {
      const dir = fullPath.includes('/') ? fullPath.slice(0, fullPath.lastIndexOf('/')) : '';
      if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
        try { await this.app.vault.createFolder(dir); } catch (_) {}
      }
      const baseName = fullPath.split('/').pop().replace(/\.md$/, '');
      file = await this.app.vault.create(fullPath, await this.renderNoteTemplate(task, baseName));
    }
    if (!task.noteLink) await this.addNoteLinkToTask(task, linkTarget);
    if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
  }

  // Verplaats de gekoppelde notitie naar — of terug uit — de archief-submap.
  // Of een notitie "door ons gearchiveerd" is, leiden we NIET af uit de mapnaam
  // (die kan toevallig samenvallen met een eigen map van de gebruiker), maar uit
  // een herkomstmarkering in de frontmatter (kanban-archived-from). Zo verplaatsen
  // we nooit notities die we zelf niet archiveerden, en zetten we ze exact terug op
  // hun oorspronkelijke plek. Wikilinks worden door Obsidian bijgewerkt.
  async syncNoteArchive(task, shouldBeArchived) {
    if (!this.settings.archiveNotesOnDone) return;
    if (!task || !task.noteLink) return;
    // Terugkerende taken delen één notitie over alle herhalingen → niet archiveren.
    if (shouldBeArchived && task.recurrence) return;

    const dest = this.app.metadataCache.getFirstLinkpathDest(task.noteLink, task.file || '');
    if (!(dest instanceof TFile)) return;

    const archiveName = (this.settings.archiveFolder || '0. archive').replace(/^\/+|\/+$/g, '');
    if (!archiveName) return;

    const parent = dest.parent;
    const parentPath = parent && parent.path && parent.path !== '/' ? parent.path : '';
    const cache = this.app.metadataCache.getFileCache(dest);
    const archivedFrom = cache && cache.frontmatter ? cache.frontmatter['kanban-archived-from'] : undefined;

    let newDir;
    if (shouldBeArchived) {
      if (archivedFrom != null) return;                        // al door ons gearchiveerd
      newDir = parentPath ? `${parentPath}/${archiveName}` : archiveName;
    } else {
      if (archivedFrom == null) return;                        // niet door ons gearchiveerd → met rust laten
      newDir = archivedFrom === '/' ? '' : String(archivedFrom);
    }

    const newPath = newDir ? `${newDir}/${dest.name}` : dest.name;
    if (newPath === dest.path) return;
    if (this.app.vault.getAbstractFileByPath(newPath)) {       // niet overschrijven
      new Notice(this.t('archive_name_clash', { name: dest.name }));
      return;
    }

    if (newDir && !this.app.vault.getAbstractFileByPath(newDir)) {
      try { await this.app.vault.createFolder(newDir); } catch (_) {}
    }
    try {
      await this.app.fileManager.renameFile(dest, newPath);
      // Herkomst vastleggen bij archiveren, en weer wissen bij terugzetten.
      await this.app.fileManager.processFrontMatter(dest, (fm) => {
        if (shouldBeArchived) fm['kanban-archived-from'] = parentPath || '/';
        else delete fm['kanban-archived-from'];
      });
    } catch (_) { /* verplaatsen mislukt → laat de notitie staan */ }
  }

  async toggleDone(task) {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (task.line >= lines.length) return;
    let line = lines[task.line];
    const wasDone = task.done;

    if (task.done) {
      line = line.replace(/^(\s*)- \[[xX\-]\]/, '$1- [ ]');
      lines[task.line] = line;
    } else {
      line = line.replace(/^(\s*)- \[ \]/, '$1- [x]');
      if (/#kanban\/[\w-]+/.test(line)) {
        line = line.replace(/#kanban\/[\w-]+/, `#kanban/${this.settings.doneColumn}`);
      } else {
        line = line.trimEnd() + ` #kanban/${this.settings.doneColumn}`;
      }
      lines[task.line] = line;

      // Recurring? Voeg de volgende instance erboven in.
      const rec = parseRecurrence(task.recurrence);
      if (rec) {
        const nextDue = nextDate(task.dueDate, rec);
        // Een volgende herhaling start altijd opnieuw in de standaardkolom (Te doen).
        // Staat de nieuwe due date toch op vandaag (bv. dagelijkse taak), dan schuift
        // de auto-move 'm later vanzelf weer naar Bezig.
        const targetCol = this.settings.defaultColumn;
        const nextTask = {
          text: task.text,
          dueDate: nextDue,
          time: task.time,
          priority: task.priority,
          project: task.project,
          recurrence: task.recurrence,
          column: targetCol,
        };
        const nextLine = (task.indent || '') + this.formatTaskLine(nextTask);
        lines.splice(task.line, 0, nextLine);
      }
    }

    await this.app.vault.modify(file, lines.join('\n'));

    // Notitie mee-archiveren bij afronden (en terughalen bij heropenen).
    await this.syncNoteArchive(task, !wasDone);
  }

  async setDueDate(task, newDate) {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (task.line >= lines.length) return;
    let line = lines[task.line];
    if (/📅\s*\d{4}-\d{2}-\d{2}/.test(line)) {
      if (newDate) {
        line = line.replace(/📅\s*\d{4}-\d{2}-\d{2}/, `📅 ${newDate}`);
      } else {
        line = line.replace(/\s*📅\s*\d{4}-\d{2}-\d{2}/, '');
        // Een tijd hoort bij een datum: laat 'm niet als wees achter.
        line = line.replace(/\s*⏰\s*\d{1,2}:\d{2}/, '');
      }
    } else if (newDate) {
      line = line.trimEnd() + ` 📅 ${newDate}`;
    }
    lines[task.line] = line;
    await this.app.vault.modify(file, lines.join('\n'));
  }

  async setTime(task, newTime) {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (task.line >= lines.length) return;
    let line = lines[task.line];
    if (/⏰\s*\d{1,2}:\d{2}/.test(line)) {
      if (newTime) {
        line = line.replace(/⏰\s*\d{1,2}:\d{2}/, `⏰ ${newTime}`);
      } else {
        line = line.replace(/\s*⏰\s*\d{1,2}:\d{2}/, '');
      }
    } else if (newTime) {
      // Tijd direct na de datum plaatsen als die er is, anders achteraan.
      if (/📅\s*\d{4}-\d{2}-\d{2}/.test(line)) {
        line = line.replace(/(📅\s*\d{4}-\d{2}-\d{2})/, `$1 ⏰ ${newTime}`);
      } else {
        line = line.trimEnd() + ` ⏰ ${newTime}`;
      }
    }
    lines[task.line] = line;
    await this.app.vault.modify(file, lines.join('\n'));
  }
};

// -- View -------------------------------------------------------------------

class KanbanView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tasks = [];
    this.filterText = '';
    this.hideDone = false;
  }

  getViewType() { return VIEW_TYPE_KANBAN; }
  getDisplayText() { return this.plugin.t('board_title'); }
  getIcon() { return 'square-kanban'; }

  async onOpen() { await this.render(); }
  async onClose() {}

  async loadTasks() {
    this.tasks = await this.plugin.scanTasks();
  }

  async render() {
    await this.loadTasks();

    // Taken die vandaag due zijn automatisch naar Bezig schuiven, daarna opnieuw inlezen.
    if (this.plugin.settings.autoMoveToday) {
      const moved = await this.plugin.autoMoveDueTasks(this.tasks);
      if (moved > 0) await this.loadTasks();
    }

    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('trietment-kanban-container');

    // Header
    const header = container.createDiv({ cls: 'tk-header' });
    header.createEl('h2', { text: this.plugin.t('board_title'), cls: 'tk-title' });

    const filter = header.createEl('input', { cls: 'tk-filter', type: 'text', placeholder: this.plugin.t('filter_placeholder') });
    filter.value = this.filterText;
    filter.addEventListener('input', (e) => {
      this.filterText = e.target.value.toLowerCase();
      this.renderBoard(container);
    });

    const hideDoneLabel = header.createEl('label', { cls: 'tk-hide-done' });
    const hideDoneInput = hideDoneLabel.createEl('input', { type: 'checkbox' });
    hideDoneInput.checked = this.hideDone;
    hideDoneInput.addEventListener('change', (e) => {
      this.hideDone = e.target.checked;
      this.renderBoard(container);
    });
    hideDoneLabel.createSpan({ text: this.plugin.t('hide_done') });

    const addBtn = header.createEl('button', { text: this.plugin.t('new_task'), cls: 'tk-btn tk-btn-cta' });
    addBtn.onclick = () => {
      new AddTaskModal(this.app, this.plugin, async (task) => {
        await this.plugin.createTaskInFile(task, task.targetFile || this.plugin.settings.inboxNote);
        this.plugin.scheduleRefresh();
      }).open();
    };

    const calBtn = header.createEl('button', { text: '📅', cls: 'tk-btn', title: this.plugin.t('open_calendar_tip') });
    calBtn.onclick = () => this.plugin.activateCalendarView();

    const refreshBtn = header.createEl('button', { text: '↻', cls: 'tk-btn', title: this.plugin.t('refresh') });
    refreshBtn.onclick = () => this.render();

    this.renderBoard(container);
  }

  renderBoard(container) {
    const existing = container.querySelector('.tk-board');
    if (existing) existing.remove();

    const board = container.createDiv({ cls: 'tk-board' });

    const columns = [...this.plugin.settings.columns];
    if (this.plugin.settings.showInbox) columns.unshift('inbox');

    for (const col of columns) {
      this.renderColumn(board, col);
    }
  }

  filterTask(t) {
    if (this.hideDone && t.done) return false;
    if (this.filterText) {
      const subText = (t.subtasks || []).map((s) => s.text).join(' ');
      const hay = (t.text + ' ' + t.file + ' ' + (t.dueDate || '') + ' ' + (t.project || '') + ' ' + subText).toLowerCase();
      if (!hay.includes(this.filterText)) return false;
    }
    return true;
  }

  tasksForColumn(columnId) {
    return this.tasks.filter((t) => {
      if (!this.filterTask(t)) return false;
      if (columnId === 'inbox') return !t.column;
      return t.column === columnId;
    }).sort((a, b) => {
      // overdue first, then by due date
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  }

  renderColumn(parent, columnId) {
    const colEl = parent.createDiv({ cls: 'tk-column' });
    colEl.dataset.column = columnId;
    if (columnId === this.plugin.settings.doneColumn) colEl.addClass('tk-column-done');

    const label = columnId === 'inbox'
      ? this.plugin.t('inbox')
      : (this.plugin.settings.columnLabels[columnId] || columnId);
    const tasksInCol = this.tasksForColumn(columnId);

    const head = colEl.createDiv({ cls: 'tk-col-head' });
    head.createSpan({ text: label, cls: 'tk-col-title' });
    head.createSpan({ text: String(tasksInCol.length), cls: 'tk-col-count' });

    const cardsEl = colEl.createDiv({ cls: 'tk-cards' });
    cardsEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      cardsEl.addClass('tk-drag-over');
    });
    cardsEl.addEventListener('dragleave', (e) => {
      if (!cardsEl.contains(e.relatedTarget)) cardsEl.removeClass('tk-drag-over');
    });
    cardsEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      cardsEl.removeClass('tk-drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId) return;
      await this.plugin.moveTask(taskId, columnId);
      this.plugin.scheduleRefresh();
    });

    for (const task of tasksInCol) {
      this.renderCard(cardsEl, task);
    }

    const addBtn = colEl.createEl('button', { text: this.plugin.t('add_task_col'), cls: 'tk-col-add' });
    addBtn.onclick = () => {
      const initial = columnId === 'inbox' ? null : columnId;
      new AddTaskModal(this.app, this.plugin, async (task) => {
        task.column = initial;
        await this.plugin.createTaskInFile(task, task.targetFile || this.plugin.settings.inboxNote);
        this.plugin.scheduleRefresh();
      }, null, initial).open();
    };
  }

  renderCard(parent, task) {
    const card = parent.createDiv({ cls: 'tk-card' });
    card.draggable = true;
    const taskId = `${task.file}::${task.line}`;
    card.dataset.taskId = taskId;

    if (task.done) card.addClass('tk-done');
    if (task.dueDate) {
      const t = todayISO();
      if (task.dueDate < t && !task.done) card.addClass('tk-overdue');
      else if (task.dueDate === t) card.addClass('tk-due-today');
    }
    if (task.priority) card.addClass(`tk-prio-${task.priority}`);

    // Project color
    if (task.project) {
      const color = this.plugin.getProjectColor(task.project);
      if (color) {
        card.style.setProperty('--tk-project-color', color);
        // Aparte alpha voor light vs dark — op een donkere achtergrond is 6% nauwelijks zichtbaar.
        const tintLight = hexToRgba(color, 0.06);
        const tintDark = hexToRgba(color, 0.20);
        if (tintLight) card.style.setProperty('--tk-project-tint', tintLight);
        if (tintDark) card.style.setProperty('--tk-project-tint-dark', tintDark);
        card.addClass('tk-has-project');
      }
    }

    card.addEventListener('dragstart', (e) => {
      // Niet slepen wanneer je op een knop of badge tikt.
      if (e.target.closest('button, input, .tk-subtask-badge, .tk-project-badge, .tk-card-subs')) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('text/plain', taskId);
      e.dataTransfer.effectAllowed = 'move';
      card.addClass('tk-dragging');
    });
    card.addEventListener('dragend', () => card.removeClass('tk-dragging'));

    // ---- Header: project-badge links, subtaak-badge + notitie + acties rechts
    const header = card.createDiv({ cls: 'tk-card-header' });
    const headLeft = header.createDiv({ cls: 'tk-card-header-left' });
    const headRight = header.createDiv({ cls: 'tk-card-header-right' });

    // Project badge
    if (task.project) {
      const wrap = headLeft.createDiv({ cls: 'tk-project-wrap' });
      const segments = task.project.split('/');

      if (segments.length > 1) {
        const parentPath = segments.slice(0, -1).join('/');
        const parent = wrap.createSpan({ cls: 'tk-project-parent', text: parentPath + ' › ' });
        parent.setAttr('title', this.plugin.t('parent_of', { p: parentPath }));
      }

      const badge = wrap.createDiv({ cls: 'tk-project-badge' });
      const color = this.plugin.getProjectColor(task.project);
      if (color) badge.style.background = color;
      const customLabel = (this.plugin.settings.projectLabels || {})[task.project];
      const displayLabel = customLabel || segments[segments.length - 1];
      badge.setText(displayLabel);
      badge.setAttr('title', this.plugin.t('project_of', { p: task.project }));
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        this.filterText = task.project.toLowerCase();
        const filterInput = this.containerEl.querySelector('.tk-filter');
        if (filterInput) filterInput.value = task.project;
        this.renderBoard(this.containerEl.children[1]);
      });
    }

    // Bewerken: klik op de kaart of de subtaak-badge opent de edit-modal.
    const openEdit = () => new EditTaskModal(this.app, this.plugin, task, () => this.plugin.scheduleRefresh()).open();

    // Subtaak-badge (☑ 2/5) — alleen tonen als er subtaken zijn. Klikken opent de edit-modal.
    const subtasks = task.subtasks || [];
    if (subtasks.length) {
      const doneCount = subtasks.filter((s) => s.done).length;
      const subBadge = headRight.createDiv({ cls: 'tk-subtask-badge' });
      if (doneCount === subtasks.length) subBadge.addClass('tk-subtask-complete');
      subBadge.createSpan({ cls: 'tk-subtask-icon', text: '☑' });
      subBadge.createSpan({ cls: 'tk-subtask-count', text: `${doneCount}/${subtasks.length}` });
      subBadge.setAttr('title', this.plugin.t('subtasks_done_tip', { d: doneCount, t: subtasks.length }));
      subBadge.onclick = (e) => { e.stopPropagation(); openEdit(); };
    }

    // Notitie-knop
    let noteExists = false;
    if (task.noteLink) {
      const dest = this.app.metadataCache.getFirstLinkpathDest(task.noteLink, task.file);
      noteExists = dest instanceof TFile;
    }
    const noteBtn = headRight.createEl('button', { cls: 'tk-note-btn', text: '📄' });
    if (noteExists) noteBtn.addClass('tk-has-note');
    noteBtn.setAttr('title', noteExists ? this.plugin.t('open_linked_note') : this.plugin.t('create_linked_note'));
    noteBtn.onclick = async (e) => {
      e.stopPropagation();
      await this.plugin.openOrCreateLinkedNote(task);
      this.plugin.scheduleRefresh();
    };

    // Acties (verwijderen) — in de header zodat ze ook op mobiel bereikbaar zijn
    const actions = headRight.createDiv({ cls: 'tk-card-actions' });
    const delBtn = actions.createEl('button', { text: '×', title: this.plugin.t('delete') });
    delBtn.onclick = (e) => {
      e.stopPropagation();
      const extra = subtasks.length ? this.plugin.t('delete_extra', { n: subtasks.length }) : '';
      const msg = this.plugin.t('confirm_delete', { text: task.text, extra });
      new ConfirmModal(this.app, this.plugin, msg, async () => {
        await this.plugin.deleteTask(task);
        this.plugin.scheduleRefresh();
      }).open();
    };

    // Checkbox + text
    const top = card.createDiv({ cls: 'tk-card-top' });
    const checkbox = top.createEl('input', { type: 'checkbox', cls: 'tk-card-check' });
    checkbox.checked = task.done;
    checkbox.addEventListener('click', (e) => e.stopPropagation());
    // Blokkeer afvinken zolang er nog open subtaken zijn. Uitvinken mag altijd
    // (voor het geval je per ongeluk had aangevinkt).
    const openSubs = subtasks.filter((s) => !s.done).length;
    const blockCheck = !task.done && openSubs > 0;
    if (blockCheck) {
      checkbox.addClass('tk-card-check-blocked');
      checkbox.setAttr('title', this.plugin.t('complete_subs_first_tip', { o: openSubs, t: subtasks.length }));
    }
    checkbox.addEventListener('change', async () => {
      if (blockCheck) {
        checkbox.checked = task.done; // reset naar werkelijke status
        new Notice(this.plugin.t('complete_subs_first', { o: openSubs }));
        return;
      }
      await this.plugin.toggleDone(task);
      this.plugin.scheduleRefresh();
    });
    top.createDiv({ cls: 'tk-card-text', text: task.text || this.plugin.t('empty_task') });

    // Compacte subtaken-lijst op de kaart zelf (afvinken kan hier; toevoegen/verwijderen via de modal).
    if (subtasks.length) {
      const subList = card.createDiv({ cls: 'tk-card-subs' });
      for (const sub of subtasks) {
        const row = subList.createEl('label', { cls: 'tk-card-sub' + (sub.done ? ' tk-card-sub-done' : '') });
        const cb = row.createEl('input', { type: 'checkbox', cls: 'tk-card-sub-check' });
        cb.checked = sub.done;
        cb.onclick = (e) => e.stopPropagation();
        cb.onchange = async (e) => {
          e.stopPropagation();
          await this.plugin.toggleSubtask(sub);
          this.plugin.scheduleRefresh();
        };
        row.createSpan({ cls: 'tk-card-sub-text', text: sub.text || this.plugin.t('empty') });
      }
    }

    // Meta
    const meta = card.createDiv({ cls: 'tk-card-meta' });
    if (task.dueDate || task.time) {
      let dueText = '';
      if (task.dueDate) dueText = `📅 ${task.dueDate}`;
      if (task.time) dueText += `${dueText ? ' ' : ''}⏰ ${task.time}`;
      meta.createSpan({ cls: 'tk-due', text: dueText });
    }
    if (task.priority) {
      meta.createSpan({ cls: 'tk-prio', text: PRIORITY_ICONS[task.priority] });
    }
    if (task.recurrence) {
      const rec = meta.createSpan({ cls: 'tk-recur', text: '🔁' });
      rec.setAttr('title', this.plugin.t('repeats', { r: task.recurrence }));
    }

    // Source link
    const src = card.createDiv({ cls: 'tk-card-source' });
    src.setAttr('title', task.file);
    const baseName = task.file.split('/').pop().replace(/\.md$/, '');
    src.setText(`↳ ${baseName}`);

    // Klik op de kaart opent de edit-modal (header-knoppen en checkbox hebben hun eigen actie).
    card.addEventListener('click', (e) => {
      if (e.target.closest('.tk-card-header') || e.target.closest('.tk-card-check') || e.target.closest('.tk-card-subs')) return;
      openEdit();
    });
  }
}

// -- Calendar View ----------------------------------------------------------

class CalendarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tasks = [];
    this.hideDone = false;
    this.viewMode = 'month';                 // 'month' | 'week' | 'day'
    const now = new Date();
    this.anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // referentiedatum in de zichtbare periode
  }

  getViewType() { return VIEW_TYPE_CALENDAR; }
  getDisplayText() { return this.plugin.t('calendar_title'); }
  getIcon() { return 'calendar-days'; }

  async onOpen() { await this.render(); }
  async onClose() {}

  async loadTasks() {
    this.tasks = await this.plugin.scanTasks();
  }

  // Locale voor maand-/weekdagnamen, afgeleid van de plugintaal.
  locale() { return this.plugin.lang === 'nl' ? 'nl-NL' : 'en-US'; }

  async render() {
    await this.loadTasks();

    // Outlook-events ophalen voor het zichtbare bereik (faalt stil → alleen taken).
    const days = this.buildDays();
    const startISO = isoFromDate(days[0]);
    const lastDay = days[days.length - 1];
    const endISO = isoFromDate(new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1));
    this.eventsByDay = {};
    try {
      const events = await this.plugin.outlook.fetchEvents(startISO, endISO);
      for (const ev of events) (this.eventsByDay[ev.dayISO] = this.eventsByDay[ev.dayISO] || []).push(ev);
    } catch (_) { /* agenda offline → toon alleen taken */ }

    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('trietment-calendar-container');

    this.renderHeader(container);
    this.renderGrid(container, days);
  }

  renderHeader(container) {
    const header = container.createDiv({ cls: 'tcal-header' });

    const nav = header.createDiv({ cls: 'tcal-nav' });
    const prev = nav.createEl('button', { text: '‹', cls: 'tk-btn', title: this.plugin.t('cal_prev') });
    prev.onclick = () => this.shift(-1);
    const todayBtn = nav.createEl('button', { text: this.plugin.t('cal_today'), cls: 'tk-btn' });
    todayBtn.onclick = () => this.goToday();
    const next = nav.createEl('button', { text: '›', cls: 'tk-btn', title: this.plugin.t('cal_next') });
    next.onclick = () => this.shift(1);

    header.createEl('h2', { text: this.titleText(), cls: 'tcal-title' });

    // Weergave-schakelaar: maand / week / dag.
    const modes = header.createDiv({ cls: 'tcal-modes' });
    for (const m of ['month', 'week', 'day']) {
      const btn = modes.createEl('button', { text: this.plugin.t('cal_' + m), cls: 'tk-btn' });
      if (m === this.viewMode) btn.addClass('tcal-mode-active');
      btn.onclick = () => { if (this.viewMode !== m) { this.viewMode = m; this.render(); } };
    }

    header.createDiv({ cls: 'tcal-spacer' });

    const hideDoneLabel = header.createEl('label', { cls: 'tk-hide-done' });
    const hideDoneInput = hideDoneLabel.createEl('input', { type: 'checkbox' });
    hideDoneInput.checked = this.hideDone;
    hideDoneInput.addEventListener('change', (e) => {
      this.hideDone = e.target.checked;
      this.render();
    });
    hideDoneLabel.createSpan({ text: this.plugin.t('hide_done') });

    // Snelle Outlook aan/uit (alleen als er accounts gekoppeld zijn).
    if (this.plugin.outlook && this.plugin.outlook.isConfigured() && this.plugin.outlook.accounts().length) {
      const olLabel = header.createEl('label', { cls: 'tk-hide-done' });
      const olInput = olLabel.createEl('input', { type: 'checkbox' });
      olInput.checked = !!this.plugin.settings.outlookShowEvents;
      olInput.addEventListener('change', async (e) => {
        this.plugin.settings.outlookShowEvents = e.target.checked;
        await this.plugin.saveSettings();
        this.render();
      });
      olLabel.createSpan({ text: ' Outlook' });
    }

    const refreshBtn = header.createEl('button', { text: '↻', cls: 'tk-btn', title: this.plugin.t('refresh') });
    refreshBtn.onclick = () => { if (this.plugin.outlook) this.plugin.outlook.clearCache(); this.render(); };

    const boardBtn = header.createEl('button', { text: this.plugin.t('cal_open_board'), cls: 'tk-btn' });
    boardBtn.onclick = () => this.plugin.activateView();
  }

  // Weekdagnamen, maandag-start (2024-01-01 is een maandag).
  weekdayNames() {
    const fmt = new Intl.DateTimeFormat(this.locale(), { weekday: 'short' });
    const names = [];
    for (let i = 0; i < 7; i++) names.push(fmt.format(new Date(2024, 0, 1 + i)));
    return names;
  }

  // Dagcellen voor de zichtbare periode: maand → hele weken, week → 7 dagen, dag → 1.
  buildDays() {
    const weekStart = 1; // maandag
    if (this.viewMode === 'day') {
      const a = this.anchor;
      return [new Date(a.getFullYear(), a.getMonth(), a.getDate())];
    }
    if (this.viewMode === 'week') {
      const a = this.anchor;
      const lead = (a.getDay() - weekStart + 7) % 7;
      const start = new Date(a.getFullYear(), a.getMonth(), a.getDate() - lead);
      const days = [];
      for (let i = 0; i < 7; i++) days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
      return days;
    }
    const year = this.anchor.getFullYear();
    const month = this.anchor.getMonth();
    const first = new Date(year, month, 1);
    const lead = (first.getDay() - weekStart + 7) % 7;
    const lastDate = new Date(year, month + 1, 0).getDate();
    const end = new Date(year, month, lastDate);
    const trail = (weekStart + 6 - end.getDay() + 7) % 7;
    const days = [];
    const d = new Date(year, month, 1 - lead);
    const endCell = new Date(year, month, lastDate + trail);
    while (d <= endCell) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }

  // Titel in de kop, afhankelijk van de weergave.
  titleText() {
    const loc = this.locale();
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    if (this.viewMode === 'day') {
      return cap(new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(this.anchor));
    }
    if (this.viewMode === 'week') {
      const days = this.buildDays();
      const a = days[0], b = days[days.length - 1];
      if (a.getMonth() === b.getMonth()) {
        const dFmt = new Intl.DateTimeFormat(loc, { day: 'numeric' });
        const mFmt = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' });
        return cap(`${dFmt.format(a)}–${dFmt.format(b)} ${mFmt.format(b)}`);
      }
      const dmFmt = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long' });
      if (a.getFullYear() !== b.getFullYear()) {
        return cap(`${dmFmt.format(a)} ${a.getFullYear()} – ${dmFmt.format(b)} ${b.getFullYear()}`);
      }
      return cap(`${dmFmt.format(a)} – ${dmFmt.format(b)} ${b.getFullYear()}`);
    }
    return cap(new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(this.anchor));
  }

  tasksForDay(iso) {
    return this.tasks
      .filter((t) => t.dueDate === iso && !(this.hideDone && t.done))
      .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  }

  // Outlook-events van een dag, gesorteerd: hele dag eerst, daarna op tijd.
  eventsForDay(iso) {
    return ((this.eventsByDay && this.eventsByDay[iso]) || []).slice().sort(
      (a, b) => (a.allDay === b.allDay ? (a.time || '').localeCompare(b.time || '') : (a.allDay ? -1 : 1))
    );
  }

  renderGrid(container, days) {
    if (this.viewMode === 'day') return this.renderAgenda(container, days[0]);
    if (this.viewMode === 'week') return this.renderWeek(container, days);
    return this.renderMonth(container, days);
  }

  // Maandweergave: 7-koloms raster, max. items per cel met klikbare "+n meer".
  renderMonth(container, days) {
    const grid = container.createDiv({ cls: 'tcal-grid' });

    const weekdays = grid.createDiv({ cls: 'tcal-weekdays' });
    for (const name of this.weekdayNames()) {
      weekdays.createDiv({ cls: 'tcal-weekday', text: name });
    }

    const body = grid.createDiv({ cls: 'tcal-body' });
    const today = todayISO();
    const MAX = 4; // items per cel voordat we naar "+n meer" inklappen

    for (const day of days) {
      const iso = isoFromDate(day);
      const cell = body.createDiv({ cls: 'tcal-day' });
      if (day.getMonth() !== this.anchor.getMonth()) cell.addClass('tcal-other-month');
      if (iso === today) cell.addClass('tcal-today');

      const head = cell.createDiv({ cls: 'tcal-day-head' });
      head.createSpan({ cls: 'tcal-day-num', text: String(day.getDate()) });

      this.attachAddTask(cell, iso);

      const list = cell.createDiv({ cls: 'tcal-day-tasks' });
      this.fillDay(list, iso, today, MAX);
    }
  }

  // Weekweergave: 7 dagkolommen naast elkaar, elk een scrollbare lijst met álle items.
  renderWeek(container, days) {
    const grid = container.createDiv({ cls: 'tcal-grid' });
    const body = grid.createDiv({ cls: 'tcal-body tcal-body-week' });
    const today = todayISO();
    const wdFmt = new Intl.DateTimeFormat(this.locale(), { weekday: 'short' });

    for (const day of days) {
      const iso = isoFromDate(day);
      const cell = body.createDiv({ cls: 'tcal-day tcal-day-week' });
      if (iso === today) cell.addClass('tcal-today');

      const head = cell.createDiv({ cls: 'tcal-day-head tcal-day-head-week' });
      head.createSpan({ cls: 'tcal-weekday-name', text: wdFmt.format(day) });
      head.createSpan({ cls: 'tcal-day-num', text: String(day.getDate()) });

      this.attachAddTask(cell, iso);

      const list = cell.createDiv({ cls: 'tcal-day-tasks tcal-day-tasks-scroll' });
      this.fillDay(list, iso, today, Infinity);
    }
  }

  // Dagweergave: één dag over de volle breedte, volledige scrollbare lijst.
  renderAgenda(container, day) {
    const iso = isoFromDate(day);
    const today = todayISO();
    const wrap = container.createDiv({ cls: 'tcal-grid tcal-agenda' });
    const cell = wrap.createDiv({ cls: 'tcal-day tcal-day-agenda' });
    if (iso === today) cell.addClass('tcal-today');

    this.attachAddTask(cell, iso);

    const list = cell.createDiv({ cls: 'tcal-day-tasks tcal-agenda-list' });
    const total = this.fillDay(list, iso, today, Infinity);
    if (total === 0) list.createDiv({ cls: 'tcal-empty', text: this.plugin.t('cal_no_items') });
  }

  // Vult een lijst met de events + taken van een dag. Met een eindige max wordt
  // ingeklapt tot een klikbare "+n meer" die naar de dagweergave springt.
  fillDay(list, iso, today, max) {
    const items = this.dayItems(iso);
    const total = items.length;
    const finite = max !== Infinity;
    let budget = finite ? max : total;
    for (const it of items) {
      if (budget <= 0) break;
      if (it.kind === 'event') this.renderEvent(list, it.ev);
      else this.renderTask(list, it.task, iso, today);
      budget--;
    }
    if (finite && total > max) {
      const more = list.createDiv({ cls: 'tcal-more', text: this.plugin.t('cal_more', { n: total - max }) });
      more.setAttr('title', this.plugin.t('cal_more_tip'));
      more.addEventListener('click', (e) => { e.stopPropagation(); this.openDay(iso); });
    }
    return total;
  }

  // Afspraken én taken van een dag samengevoegd tot één chronologische tijdlijn:
  // hele-dag afspraken bovenaan, dan alles met een tijd op tijd gesorteerd, dan
  // taken zonder tijd, en afgeronde taken altijd onderaan.
  dayItems(iso) {
    const items = [];
    for (const ev of this.eventsForDay(iso)) {
      items.push({ kind: 'event', ev, allDay: !!ev.allDay, time: ev.allDay ? null : (ev.time || null), done: false });
    }
    for (const task of this.tasksForDay(iso)) {
      items.push({ kind: 'task', task, allDay: false, time: task.time || null, done: !!task.done });
    }
    const rank = (it) => {
      if (it.done) return 3;                            // afgerond onderaan
      if (it.kind === 'event' && it.allDay) return 0;   // hele-dag afspraken bovenaan
      if (it.time) return 1;                            // getimede afspraken + taken
      return 2;                                         // taken zonder tijd
    };
    items.sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 1) return a.time.localeCompare(b.time); // chronologisch op tijd
      return 0;                                          // stabiel binnen de groep
    });
    return items;
  }

  // Klik op een lege plek in een dagcel → nieuwe taak met deze datum voorgevuld.
  attachAddTask(cell, iso) {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.tcal-task') || e.target.closest('.tcal-event') || e.target.closest('.tcal-more')) return;
      const modal = new AddTaskModal(this.app, this.plugin, async (task) => {
        await this.plugin.createTaskInFile(task, task.targetFile || this.plugin.settings.inboxNote);
        this.plugin.scheduleRefresh();
      });
      modal.task.dueDate = iso;
      modal.open();
    });
  }

  // Spring naar de dagweergave voor een specifieke datum (vanaf "+n meer").
  openDay(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    this.anchor = new Date(y, m - 1, d);
    this.viewMode = 'day';
    this.render();
  }

  renderEvent(parent, ev) {
    const chip = parent.createDiv({ cls: 'tcal-event' });
    chip.style.setProperty('--tcal-color', ev.color || 'var(--text-muted)');
    if (!ev.allDay && ev.time) chip.createSpan({ cls: 'tcal-event-time', text: ev.time });
    chip.createSpan({ cls: 'tcal-event-text', text: ev.subject });
    chip.setAttr('title', (ev.time ? ev.time + ' · ' : '') + ev.subject);
    chip.addEventListener('click', (e) => e.stopPropagation()); // alleen-lezen
  }

  renderTask(parent, task, iso, today) {
    const chip = parent.createDiv({ cls: 'tcal-task' });
    if (task.done) chip.addClass('tcal-task-done');
    else if (iso < today) chip.addClass('tcal-overdue');
    else if (iso === today) chip.addClass('tcal-due-today');

    const color = this.plugin.getProjectColor(task.project);
    if (color) chip.style.setProperty('--tcal-color', color);
    else chip.addClass('tcal-no-color');

    if (task.time) chip.createSpan({ cls: 'tcal-task-time', text: task.time });
    if (task.priority && PRIORITY_ICONS[task.priority]) {
      chip.createSpan({ cls: 'tcal-task-prio', text: PRIORITY_ICONS[task.priority] });
    }
    const label = task.text || this.plugin.t('empty_task');
    chip.createSpan({ cls: 'tcal-task-text', text: label });
    chip.setAttr('title', (task.time ? task.time + ' · ' : '') + label);

    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      new EditTaskModal(this.app, this.plugin, task, () => this.plugin.scheduleRefresh()).open();
    });
  }

  // Vorige/volgende periode, afhankelijk van de weergave.
  shift(delta) {
    const a = this.anchor;
    if (this.viewMode === 'day') this.anchor = new Date(a.getFullYear(), a.getMonth(), a.getDate() + delta);
    else if (this.viewMode === 'week') this.anchor = new Date(a.getFullYear(), a.getMonth(), a.getDate() + delta * 7);
    else this.anchor = new Date(a.getFullYear(), a.getMonth() + delta, 1);
    this.render();
  }

  goToday() {
    const now = new Date();
    this.anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.render();
  }
}

// -- Outlook / Microsoft Graph ----------------------------------------------

class OutlookManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.pending = null;                 // { verifier, state } tijdens een login
    this.eventCache = new Map();         // key -> { at, events } (korte cache)
  }

  t(key, vars) { return this.plugin.t(key, vars); }

  clientId() {
    return (this.plugin.settings.microsoftClientId || '').trim() || DEFAULT_MS_CLIENT_ID;
  }
  isConfigured() { return !!this.clientId(); }
  accounts() { return this.plugin.settings.outlookAccounts || []; }
  enabled() { return this.plugin.settings.outlookEnabled && this.isConfigured() && this.accounts().length > 0; }

  tokenUrl() { return `${MS_AUTHORITY}/oauth2/v2.0/token`; }

  // ---- Device-lokale tokenopslag (localStorage, per vault gescoped) --------
  // Tokens staan bewust NIET in data.json, zodat Obsidian Sync ze niet meeneemt
  // en er geen refresh-token-botsingen tussen apparaten ontstaan.
  tokenStoreKey() {
    const vault = (this.plugin.app && this.plugin.app.appId) || 'vault';
    return `trietment-kanban:outlook-tokens:${vault}`;
  }
  loadTokens() {
    try { return JSON.parse(window.localStorage.getItem(this.tokenStoreKey()) || '{}') || {}; }
    catch (_) { return {}; }
  }
  saveTokens(map) {
    try { window.localStorage.setItem(this.tokenStoreKey(), JSON.stringify(map)); } catch (_) {}
  }
  getToken(id) { return this.loadTokens()[id] || null; }
  setToken(id, tok) {
    const map = this.loadTokens();
    if (tok) map[id] = tok; else delete map[id];
    this.saveTokens(map);
  }

  // Eenmalige migratie: tokens die nog in data.json staan (van vóór deze versie)
  // verhuizen naar de device-lokale opslag en worden uit data.json verwijderd.
  migrateTokens() {
    let changed = false;
    for (const acc of this.accounts()) {
      if ('refreshToken' in acc || 'accessToken' in acc || 'expiresAt' in acc) {
        if (acc.refreshToken || acc.accessToken) {
          this.setToken(acc.id, {
            refreshToken: acc.refreshToken,
            accessToken: acc.accessToken,
            expiresAt: acc.expiresAt,
          });
        }
        delete acc.refreshToken; delete acc.accessToken; delete acc.expiresAt;
        changed = true;
      }
    }
    if (changed) this.plugin.saveSettings();
  }

  // ---- Aanmelden (Authorization Code + PKCE) ----
  async startAuth() {
    if (!this.isConfigured()) { new Notice(this.t('ol_need_client_id')); return; }
    const verifier = randomString(64);
    const challenge = await pkceChallenge(verifier);
    const state = randomString(24);
    this.pending = { verifier, state };

    const params = new URLSearchParams({
      client_id: this.clientId(),
      response_type: 'code',
      redirect_uri: MS_REDIRECT,
      response_mode: 'query',
      scope: MS_SCOPES,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      prompt: 'select_account',
    });
    new Notice(this.t('ol_opening_browser'));
    window.open(`${MS_AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`, '_blank');
  }

  // ---- Redirect terug van Microsoft (obsidian://trietment-kanban-auth) ----
  async handleRedirect(params) {
    try {
      if (params.error) {
        new Notice(this.t('ol_auth_failed', { msg: params.error_description || params.error }));
        return;
      }
      if (!this.pending || !params.state || params.state !== this.pending.state) {
        new Notice(this.t('ol_state_mismatch'));
        return;
      }
      const verifier = this.pending.verifier;
      this.pending = null;

      const token = await this.exchangeCode(params.code, verifier);
      if (!token) return;

      const profile = await this.fetchProfile(token.access_token);
      const email = (profile && (profile.mail || profile.userPrincipalName)) || '';
      const label = (profile && profile.displayName) || email || this.t('ol_account');

      const accounts = this.accounts();
      let acc = accounts.find((a) => a.email && email && a.email.toLowerCase() === email.toLowerCase());
      if (!acc) {
        acc = { id: randomString(8), color: this.nextColor(accounts) };
        accounts.push(acc);
      }
      acc.label = label;
      acc.email = email;
      acc.needsReauth = false;
      // Tokens worden device-lokaal bewaard (niet in data.json → syncen niet mee).
      const existing = this.getToken(acc.id) || {};
      this.setToken(acc.id, {
        refreshToken: token.refresh_token || existing.refreshToken,
        accessToken: token.access_token,
        expiresAt: Date.now() + (token.expires_in || 3600) * 1000,
      });

      this.plugin.settings.outlookAccounts = accounts;
      if (!this.plugin.settings.outlookEnabled) this.plugin.settings.outlookEnabled = true;
      await this.plugin.saveSettings();
      this.eventCache.clear();

      // Beschikbare agenda's ophalen (default-agenda wordt automatisch geselecteerd).
      await this.fetchCalendars(acc);

      new Notice(this.t('ol_connected', { name: label }));
      this.plugin.refreshViews();
      try { if (this.plugin.settingTab) this.plugin.settingTab.display(); } catch (_) {}
    } catch (e) {
      new Notice(this.t('ol_auth_failed', { msg: String((e && e.message) || e) }));
    }
  }

  nextColor(accounts) {
    const used = new Set((accounts || []).map((a) => a.color));
    return OUTLOOK_PALETTE.find((c) => !used.has(c)) || OUTLOOK_PALETTE[(accounts || []).length % OUTLOOK_PALETTE.length];
  }

  async exchangeCode(code, verifier) {
    const body = new URLSearchParams({
      client_id: this.clientId(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: MS_REDIRECT,
      code_verifier: verifier,
      scope: MS_SCOPES,
    });
    const res = await obsidian.requestUrl({
      url: this.tokenUrl(),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      throw: false,
    });
    if (res.status >= 400) {
      new Notice(this.t('ol_token_failed', { msg: this.errMsg(res) }));
      return null;
    }
    return res.json;
  }

  // Geldig access token (ververst automatisch via de refresh token).
  async validToken(acc) {
    const tok = this.getToken(acc.id);
    if (tok && tok.accessToken && tok.expiresAt && tok.expiresAt > Date.now() + 60000) return tok.accessToken;
    return await this.refreshAccount(acc);
  }

  async refreshAccount(acc) {
    const tok = this.getToken(acc.id);
    if (!tok || !tok.refreshToken) { await this.markReauth(acc); return null; }
    // Bewust géén scope meesturen: een refresh hergebruikt de oorspronkelijk
    // toegestemde scopes. Zo blijven bestaande koppelingen werken ook nadat we
    // later een scope (zoals User.Read) toevoegen — die geldt pas na herkoppelen.
    const body = new URLSearchParams({
      client_id: this.clientId(),
      grant_type: 'refresh_token',
      refresh_token: tok.refreshToken,
      redirect_uri: MS_REDIRECT,
    });
    const res = await obsidian.requestUrl({
      url: this.tokenUrl(),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      throw: false,
    });
    if (res.status >= 400) { await this.markReauth(acc); return null; }
    const token = res.json;
    this.setToken(acc.id, {
      refreshToken: token.refresh_token || tok.refreshToken,
      accessToken: token.access_token,
      expiresAt: Date.now() + (token.expires_in || 3600) * 1000,
    });
    if (acc.needsReauth) { acc.needsReauth = false; await this.plugin.saveSettings(); }
    return token.access_token;
  }

  async markReauth(acc) {
    if (!acc.needsReauth) { acc.needsReauth = true; await this.plugin.saveSettings(); }
  }

  async fetchProfile(accessToken) {
    const res = await obsidian.requestUrl({
      url: 'https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName',
      headers: { Authorization: `Bearer ${accessToken}` },
      throw: false,
    });
    return res.status < 400 ? res.json : null;
  }

  // Normaliseer een hex-kleur uit Graph ("#rrggbb" of "rrggbb") of geef null.
  normHex(c) {
    if (!c || typeof c !== 'string') return null;
    let h = c.trim();
    if (!h) return null;
    if (h[0] !== '#') h = '#' + h;
    return /^#[0-9a-fA-F]{6}$/.test(h) ? h : null;
  }

  // Beschikbare agenda's van een account ophalen (incl. toegevoegde gedeelde
  // agenda's). Zet bij de eerste keer de default-agenda als selectie.
  async fetchCalendars(acc) {
    try {
      const token = await this.validToken(acc);
      if (!token) { acc.calendars = acc.calendars || []; return acc.calendars; }
      const res = await obsidian.requestUrl({
        url: 'https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,hexColor,isDefaultCalendar&$top=100',
        headers: { Authorization: `Bearer ${token}` },
        throw: false,
      });
      if (res.status >= 400) { acc.calendars = acc.calendars || []; await this.plugin.saveSettings(); return acc.calendars; }
      const items = (res.json && res.json.value) || [];
      acc.calendars = items.map((c, i) => ({
        id: c.id,
        name: c.name || this.t('ol_account'),
        color: this.normHex(c.hexColor) || OUTLOOK_PALETTE[i % OUTLOOK_PALETTE.length],
        isDefault: !!c.isDefaultCalendar,
      }));
      const ids = new Set(acc.calendars.map((c) => c.id));
      if (!Array.isArray(acc.selected)) {
        const def = acc.calendars.find((c) => c.isDefault);
        acc.selected = def ? [def.id] : acc.calendars.map((c) => c.id);
      } else {
        acc.selected = acc.selected.filter((id) => ids.has(id));
      }
      this.eventCache.clear();
      await this.plugin.saveSettings();
      return acc.calendars;
    } catch (_) {
      acc.calendars = acc.calendars || [];
      return acc.calendars;
    }
  }

  // Events voor [startISO, endISO) over alle geselecteerde agenda's, met korte cache (2 min).
  async fetchEvents(startISO, endISO) {
    if (!this.enabled() || !this.plugin.settings.outlookShowEvents) return [];
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
    const all = [];
    await Promise.all(this.accounts().map(async (acc) => {
      const token = await this.validToken(acc);
      if (!token) return;

      // Geselecteerde agenda's; val terug op de default-agenda voor accounts
      // die nog van vóór de agenda-kiezer komen.
      const selected = (acc.calendars || []).filter((c) => (acc.selected || []).includes(c.id));
      const targets = selected.length
        ? selected.map((c) => ({ path: `/me/calendars/${c.id}/calendarView`, color: c.color }))
        : [{ path: '/me/calendarView', color: acc.color }];

      await Promise.all(targets.map(async (tgt) => {
        const key = `${acc.id}:${tgt.path}:${startISO}:${endISO}`;
        const cached = this.eventCache.get(key);
        if (cached && Date.now() - cached.at < 120000) { all.push(...cached.events); return; }
        try {
          const url = `https://graph.microsoft.com/v1.0${tgt.path}`
            + `?startDateTime=${startISO}T00:00:00&endDateTime=${endISO}T00:00:00`
            + '&$select=subject,start,end,isAllDay,showAs&$orderby=start/dateTime&$top=250';
          const res = await obsidian.requestUrl({
            url,
            headers: { Authorization: `Bearer ${token}`, Prefer: `outlook.timezone="${tz}"` },
            throw: false,
          });
          if (res.status >= 400) return;
          const items = (res.json && res.json.value) || [];
          const events = items.map((ev) => this.normalizeEvent(ev, tgt.color)).filter(Boolean);
          this.eventCache.set(key, { at: Date.now(), events });
          all.push(...events);
        } catch (_) { /* stil: agenda offline → toon alleen taken */ }
      }));
    }));
    return all;
  }

  normalizeEvent(ev, color) {
    const dt = ev.start && ev.start.dateTime;
    if (!dt) return null;
    return {
      subject: ev.subject || this.t('ol_event_untitled'),
      dayISO: dt.slice(0, 10),
      time: ev.isAllDay ? null : dt.slice(11, 16),
      allDay: !!ev.isAllDay,
      color,
    };
  }

  async removeAccount(id) {
    this.setToken(id, null); // device-lokale token ook wissen
    this.plugin.settings.outlookAccounts = this.accounts().filter((a) => a.id !== id);
    this.eventCache.clear();
    await this.plugin.saveSettings();
    this.plugin.refreshViews();
    new Notice(this.t('ol_disconnected'));
  }

  clearCache() { this.eventCache.clear(); }

  errMsg(res) {
    try {
      const j = res.json;
      return (j && (j.error_description || j.error)) || `HTTP ${res.status}`;
    } catch (_) {
      return `HTTP ${res.status}`;
    }
  }
}

// -- Add Task Modal ---------------------------------------------------------

class AddTaskModal extends Modal {
  constructor(app, plugin, onSubmit, defaultFile, defaultColumn) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
    this.task = {
      text: '',
      column: defaultColumn || plugin.settings.defaultColumn,
      dueDate: '',
      time: '',
      priority: '',
      project: '',
      recurrence: '',
      targetFile: defaultFile || plugin.settings.inboxNote,
    };
  }

  onOpen() {
    const { contentEl } = this;
    const t = (k, v) => this.plugin.t(k, v);
    contentEl.empty();
    contentEl.addClass('tk-modal');
    contentEl.createEl('h2', { text: t('add_modal_title') });

    let textInput;
    new Setting(contentEl)
      .setName(t('task'))
      .addText((text) => {
        textInput = text;
        text.setPlaceholder(t('task_placeholder'))
          .onChange((v) => (this.task.text = v));
        text.inputEl.addClass('tk-input-full');
      });

    new Setting(contentEl)
      .setName(t('column'))
      .addDropdown((dd) => {
        for (const col of this.plugin.settings.columns) {
          dd.addOption(col, this.plugin.settings.columnLabels[col] || col);
        }
        dd.setValue(this.task.column);
        dd.onChange((v) => (this.task.column = v));
      });

    // Project — text input met chips voor bestaande projecten
    const projectSetting = new Setting(contentEl)
      .setName(t('project'))
      .setDesc(t('project_add_desc'));
    let projInput;
    projectSetting.addText((text) => {
      projInput = text;
      text.setPlaceholder(t('project_placeholder1'))
        .setValue(this.task.project)
        .onChange((v) => (this.task.project = v.trim().toLowerCase().replace(/[^\w\-\/]/g, '')));
    });
    const known = this.plugin.getProjects();
    if (known.length) {
      const chipRow = contentEl.createDiv({ cls: 'tk-chip-row' });
      for (const p of known) {
        const chip = chipRow.createEl('button', { cls: 'tk-chip', text: p });
        const color = this.plugin.getProjectColor(p);
        if (color) chip.style.background = color;
        chip.onclick = (e) => {
          e.preventDefault();
          this.task.project = p;
          if (projInput) projInput.setValue(p);
        };
      }
    }

    new Setting(contentEl)
      .setName(t('due_date'))
      .addText((text) => {
        text.inputEl.type = 'date';
        text.setValue(this.task.dueDate);
        text.onChange((v) => (this.task.dueDate = v));
      });

    new Setting(contentEl)
      .setName(t('time'))
      .addText((text) => {
        text.inputEl.type = 'time';
        text.setValue(this.task.time || '');
        text.onChange((v) => (this.task.time = v));
      });

    new Setting(contentEl)
      .setName(t('priority'))
      .addDropdown((dd) => {
        dd.addOption('', t('prio_none'));
        dd.addOption('highest', t('prio_highest'));
        dd.addOption('high', t('prio_high'));
        dd.addOption('medium', t('prio_medium'));
        dd.addOption('low', t('prio_low'));
        dd.addOption('lowest', t('prio_lowest'));
        dd.setValue(this.task.priority);
        dd.onChange((v) => (this.task.priority = v));
      });

    new Setting(contentEl)
      .setName(t('repeat'))
      .setDesc(t('repeat_add_desc'))
      .addDropdown((dd) => {
        for (const p of recurrencePresets(this.plugin)) dd.addOption(p.value, p.label);
        dd.setValue(this.task.recurrence || '');
        dd.onChange((v) => (this.task.recurrence = v));
      });

    new Setting(contentEl)
      .setName(t('target_file'))
      .setDesc(t('target_file_desc'))
      .addText((text) => {
        text.setPlaceholder(this.plugin.settings.inboxNote || 'Kanban Inbox.md')
          .setValue(this.task.targetFile || '')
          .onChange((v) => (this.task.targetFile = v));
      });

    const btnRow = new Setting(contentEl);
    btnRow.addButton((b) => b.setButtonText(t('cancel')).onClick(() => this.close()));
    btnRow.addButton((b) =>
      b.setButtonText(t('add')).setCta().onClick(async () => {
        if (!this.task.text.trim()) {
          new Notice(t('task_required'));
          return;
        }
        await this.onSubmit(this.task);
        this.close();
      })
    );

    setTimeout(() => textInput && textInput.inputEl.focus(), 30);

    // Submit on Enter from text input
    if (textInput) {
      textInput.inputEl.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && this.task.text.trim()) {
          e.preventDefault();
          await this.onSubmit(this.task);
          this.close();
        }
      });
    }
  }

  onClose() { this.contentEl.empty(); }
}

// -- Edit Task Modal --------------------------------------------------------

class EditTaskModal extends Modal {
  constructor(app, plugin, task, onDone) {
    super(app);
    this.plugin = plugin;
    this.task = task;
    this.onDone = onDone;
    this.newDate = task.dueDate || '';
    this.newTime = task.time || '';
    this.newProject = task.project || '';
    this.newRecurrence = task.recurrence || '';
    this.newColumn = task.column || 'inbox';
  }

  onOpen() {
    const { contentEl } = this;
    const t = (k, v) => this.plugin.t(k, v);
    contentEl.empty();
    contentEl.addClass('tk-modal');
    contentEl.createEl('h2', { text: t('edit_modal_title') });

    contentEl.createDiv({ cls: 'tk-modal-info', text: this.task.text });
    contentEl.createDiv({ cls: 'tk-modal-sub', text: t('source_line', { file: this.task.file, line: this.task.line + 1 }) });

    new Setting(contentEl)
      .setName(t('column_status'))
      .addDropdown((dd) => {
        if (this.plugin.settings.showInbox || this.newColumn === 'inbox') dd.addOption('inbox', this.plugin.t('inbox'));
        for (const col of this.plugin.settings.columns) {
          dd.addOption(col, this.plugin.settings.columnLabels[col] || col);
        }
        dd.setValue(this.newColumn);
        dd.onChange((v) => (this.newColumn = v));
      });

    new Setting(contentEl)
      .setName(t('due_date'))
      .setDesc(t('due_clear_desc'))
      .addText((text) => {
        text.inputEl.type = 'date';
        text.setValue(this.newDate);
        text.onChange((v) => (this.newDate = v));
      });

    new Setting(contentEl)
      .setName(t('time'))
      .setDesc(t('time_clear_desc'))
      .addText((text) => {
        text.inputEl.type = 'time';
        text.setValue(this.newTime);
        text.onChange((v) => (this.newTime = v));
      });

    new Setting(contentEl)
      .setName(t('repeat'))
      .setDesc(t('repeat_edit_desc'))
      .addDropdown((dd) => {
        for (const p of recurrencePresets(this.plugin)) dd.addOption(p.value, p.label);
        // Als de huidige rule niet matcht met een preset, voeg hem als custom optie toe
        const presetValues = recurrencePresets(this.plugin).map((p) => p.value);
        if (this.newRecurrence && !presetValues.includes(this.newRecurrence)) {
          dd.addOption(this.newRecurrence, this.newRecurrence + t('rec_custom_suffix'));
        }
        dd.setValue(this.newRecurrence || '');
        dd.onChange((v) => (this.newRecurrence = v));
      });

    let projInput;
    new Setting(contentEl)
      .setName(t('project'))
      .setDesc(t('project_edit_desc'))
      .addText((text) => {
        projInput = text;
        text.setPlaceholder(t('project_placeholder2'))
          .setValue(this.newProject)
          .onChange((v) => (this.newProject = v.trim().toLowerCase().replace(/[^\w\-\/]/g, '')));
      });
    const known = this.plugin.getProjects();
    if (known.length) {
      const chipRow = contentEl.createDiv({ cls: 'tk-chip-row' });
      for (const p of known) {
        const chip = chipRow.createEl('button', { cls: 'tk-chip', text: p });
        const color = this.plugin.getProjectColor(p);
        if (color) chip.style.background = color;
        chip.onclick = (e) => {
          e.preventDefault();
          this.newProject = p;
          if (projInput) projInput.setValue(p);
        };
      }
    }

    // -- Subtaken --------------------------------------------------------
    contentEl.createEl('h3', { text: t('subtasks') });
    const subWrap = contentEl.createDiv({ cls: 'tk-modal-subtasks' });
    const renderSubs = () => {
      subWrap.empty();
      const subs = this.task.subtasks || [];
      if (!subs.length) {
        subWrap.createDiv({ cls: 'tk-help-line', text: t('no_subtasks') });
      }
      for (const sub of subs) {
        const row = subWrap.createDiv({ cls: 'tk-subtask-row' + (sub.done ? ' tk-subtask-done' : '') });
        const cb = row.createEl('input', { type: 'checkbox', cls: 'tk-subtask-check' });
        cb.checked = sub.done;
        cb.onchange = async () => {
          await this.plugin.toggleSubtask(sub);
          this.task.subtasks = await this.plugin.getSubtasks(this.task);
          this.onDone && this.onDone();
          renderSubs();
        };
        row.createSpan({ cls: 'tk-subtask-text', text: sub.text || this.plugin.t('empty') });
        const del = row.createEl('button', { cls: 'tk-subtask-del', text: '×', title: t('delete_subtask') });
        del.onclick = async () => {
          await this.plugin.deleteSubtask(sub);
          this.task.subtasks = await this.plugin.getSubtasks(this.task);
          this.onDone && this.onDone();
          renderSubs();
        };
      }
      const addRow = subWrap.createDiv({ cls: 'tk-subtask-add' });
      const input = addRow.createEl('input', { type: 'text', cls: 'tk-subtask-input', placeholder: t('new_subtask') });
      const commit = async () => {
        const v = input.value.trim();
        if (!v) return;
        await this.plugin.addSubtask(this.task, v);
        this.task.subtasks = await this.plugin.getSubtasks(this.task);
        this.onDone && this.onDone();
        renderSubs();
        const next = subWrap.querySelector('.tk-subtask-add .tk-subtask-input');
        if (next) next.focus();
      };
      input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } };
      const addBtn = addRow.createEl('button', { cls: 'tk-subtask-addbtn', text: '+', title: t('add_subtask') });
      addBtn.onclick = commit;
    };
    renderSubs();

    new Setting(contentEl)
      .addButton((b) => b.setButtonText(t('open_in_note')).onClick(async () => {
        const file = this.app.vault.getAbstractFileByPath(this.task.file);
        if (file instanceof TFile) {
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(file);
          const view = leaf.view;
          if (view instanceof MarkdownView) {
            view.editor.setCursor({ line: this.task.line, ch: 0 });
          }
        }
        this.close();
      }))
      .addButton((b) => b.setButtonText(t('note_btn')).onClick(async () => {
        await this.plugin.openOrCreateLinkedNote(this.task);
        this.onDone && this.onDone();
        this.close();
      }))
      .addButton((b) => b.setButtonText(t('save')).setCta().onClick(async () => {
        if (this.newDate !== (this.task.dueDate || '')) {
          await this.plugin.setDueDate(this.task, this.newDate);
        }
        // Een tijd zonder datum heeft geen betekenis → tijd wissen als de datum weg is.
        if (!this.newDate) this.newTime = '';
        if (this.newTime !== (this.task.time || '')) {
          await this.plugin.setTime(this.task, this.newTime);
        }
        if (this.newProject !== (this.task.project || '')) {
          await this.plugin.setProject(this.task, this.newProject || null);
        }
        if (this.newRecurrence !== (this.task.recurrence || '')) {
          await this.plugin.setRecurrence(this.task, this.newRecurrence || null);
        }
        // Auto-verplaats: stond de kaart in de Bezig-kolom en is de due date naar
        // de toekomst geschoven (en heeft de gebruiker de kolom niet zelf gewijzigd),
        // dan terug naar de standaardkolom — anders blijft een uitgestelde taak ten
        // onrechte 'Bezig' staan.
        const inProg = this.plugin.settings.inProgressColumn;
        const userKeptColumn = this.newColumn === (this.task.column || 'inbox');
        if (
          inProg && userKeptColumn &&
          this.task.column === inProg &&
          this.newDate && this.newDate > todayISO()
        ) {
          this.newColumn = this.plugin.settings.defaultColumn;
        }
        if (this.newColumn !== (this.task.column || 'inbox')) {
          await this.plugin.moveTask(`${this.task.file}::${this.task.line}`, this.newColumn);
        }
        this.onDone && this.onDone();
        this.close();
      }));
  }

  onClose() { this.contentEl.empty(); }
}

// -- Confirm Modal ----------------------------------------------------------

class ConfirmModal extends Modal {
  constructor(app, plugin, message, onConfirm) {
    super(app);
    this.plugin = plugin;
    this.message = message;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('tk-modal');
    contentEl.createEl('p', { text: this.message });
    const row = new Setting(contentEl);
    row.addButton((b) => b.setButtonText(this.plugin.t('cancel')).onClick(() => this.close()));
    row.addButton((b) => b.setButtonText(this.plugin.t('delete')).setWarning().onClick(async () => {
      this.close();
      await this.onConfirm();
    }));
  }

  onClose() { this.contentEl.empty(); }
}

// -- Settings Tab -----------------------------------------------------------

class KanbanSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const t = (k, v) => this.plugin.t(k, v);
    containerEl.empty();

    // -- Algemeen ------------------------------------------------------
    new Setting(containerEl).setName(t('sec_general')).setHeading();

    new Setting(containerEl)
      .setName(t('language'))
      .setDesc(t('language_desc'))
      .addDropdown((dd) => {
        dd.addOption('auto', t('lang_auto'));
        dd.addOption('nl', t('lang_nl'));
        dd.addOption('en', t('lang_en'));
        dd.setValue(this.plugin.settings.language || 'auto');
        dd.onChange(async (v) => {
          this.plugin.settings.language = v;
          this.plugin.applyLanguage();
          await this.plugin.saveSettings();
          this.display();
          this.plugin.refreshViews();
        });
      });

    // -- Kolommen ------------------------------------------------------
    new Setting(containerEl).setName(t('sec_columns')).setHeading();
    containerEl.createEl('p', { cls: 'tk-help-line', text: t('columns_help') });

    this.plugin.settings.columns.forEach((colId, index) => {
      const setting = new Setting(containerEl).setName(`#kanban/${colId}`);

      // Toon welke speciale rol deze kolom heeft.
      const flags = [];
      if (colId === this.plugin.settings.defaultColumn) flags.push(t('flag_default'));
      if (colId === this.plugin.settings.inProgressColumn) flags.push(t('flag_inprogress'));
      if (colId === this.plugin.settings.doneColumn) flags.push(t('flag_done'));
      if (flags.length) setting.setDesc(flags.join(' · '));

      // Weergave-label aanpassen.
      setting.addText((text) => text
        .setPlaceholder(t('display_name'))
        .setValue(this.plugin.settings.columnLabels[colId] || colId)
        .onChange(async (v) => {
          const name = v.trim();
          if (name) this.plugin.settings.columnLabels[colId] = name;
          else delete this.plugin.settings.columnLabels[colId];
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

      // Volgorde aanpassen.
      setting.addExtraButton((b) => b
        .setIcon('arrow-up')
        .setTooltip(t('move_up'))
        .setDisabled(index === 0)
        .onClick(async () => {
          const cols = this.plugin.settings.columns;
          [cols[index - 1], cols[index]] = [cols[index], cols[index - 1]];
          await this.plugin.saveSettings();
          this.display();
          this.plugin.refreshViews();
        }));

      setting.addExtraButton((b) => b
        .setIcon('arrow-down')
        .setTooltip(t('move_down'))
        .setDisabled(index === this.plugin.settings.columns.length - 1)
        .onClick(async () => {
          const cols = this.plugin.settings.columns;
          [cols[index + 1], cols[index]] = [cols[index], cols[index + 1]];
          await this.plugin.saveSettings();
          this.display();
          this.plugin.refreshViews();
        }));

      // Kolom verwijderen (taken met deze tag blijven gewoon bestaan).
      setting.addExtraButton((b) => b
        .setIcon('trash')
        .setTooltip(t('delete_column'))
        .onClick(async () => {
          if (this.plugin.settings.columns.length <= 1) {
            new Notice(t('need_one_column'));
            return;
          }
          this.plugin.settings.columns = this.plugin.settings.columns.filter((c) => c !== colId);
          delete this.plugin.settings.columnLabels[colId];
          // Speciale rollen die naar deze kolom wezen opnieuw toewijzen.
          const cols = this.plugin.settings.columns;
          if (this.plugin.settings.defaultColumn === colId) this.plugin.settings.defaultColumn = cols[0];
          if (this.plugin.settings.doneColumn === colId) this.plugin.settings.doneColumn = cols[cols.length - 1];
          if (this.plugin.settings.inProgressColumn === colId) this.plugin.settings.inProgressColumn = '';
          await this.plugin.saveSettings();
          this.display();
          this.plugin.refreshViews();
        }));
    });

    // Nieuwe kolom toevoegen.
    let newColName = '';
    new Setting(containerEl)
      .setName(t('add_column'))
      .setDesc(t('add_column_desc'))
      .addText((text) => text
        .setPlaceholder(t('add_column_placeholder'))
        .onChange((v) => { newColName = v; }))
      .addButton((b) => b
        .setButtonText(t('add'))
        .setCta()
        .onClick(async () => {
          const name = newColName.trim();
          if (!name) { new Notice(t('name_the_column')); return; }
          let id = name.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
          if (!id) id = 'kolom';
          const base = id;
          let n = 2;
          while (this.plugin.settings.columns.includes(id)) { id = `${base}-${n++}`; }
          this.plugin.settings.columns.push(id);
          this.plugin.settings.columnLabels[id] = name;
          await this.plugin.saveSettings();
          this.display();
          this.plugin.refreshViews();
        }));

    new Setting(containerEl)
      .setName(t('default_column'))
      .setDesc(t('default_column_desc'))
      .addDropdown((dd) => {
        for (const c of this.plugin.settings.columns) dd.addOption(c, this.plugin.settings.columnLabels[c] || c);
        dd.setValue(this.plugin.settings.defaultColumn);
        dd.onChange(async (v) => {
          this.plugin.settings.defaultColumn = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t('done_column'))
      .setDesc(t('done_column_desc'))
      .addDropdown((dd) => {
        for (const c of this.plugin.settings.columns) dd.addOption(c, this.plugin.settings.columnLabels[c] || c);
        dd.setValue(this.plugin.settings.doneColumn);
        dd.onChange(async (v) => {
          this.plugin.settings.doneColumn = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        });
      });

    new Setting(containerEl)
      .setName(t('inbox_note'))
      .setDesc(t('inbox_note_desc'))
      .addText((text) => text
        .setPlaceholder('Kanban Inbox.md')
        .setValue(this.plugin.settings.inboxNote)
        .onChange(async (v) => {
          this.plugin.settings.inboxNote = v.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('show_inbox'))
      .setDesc(t('show_inbox_desc'))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showInbox)
        .onChange(async (v) => {
          this.plugin.settings.showInbox = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    // -- Gekoppelde notities -------------------------------------------
    new Setting(containerEl).setName(t('sec_linked_notes')).setHeading();
    containerEl.createEl('p', { cls: 'tk-help-line', text: t('linked_notes_help') });

    new Setting(containerEl)
      .setName(t('note_folder'))
      .setDesc(t('note_folder_desc'))
      .addText((text) => text
        .setPlaceholder(t('note_folder_placeholder'))
        .setValue(this.plugin.settings.noteFolder)
        .onChange(async (v) => {
          this.plugin.settings.noteFolder = v.trim().replace(/^\/+|\/+$/g, '');
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('archive_notes'))
      .setDesc(t('archive_notes_desc'))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.archiveNotesOnDone)
        .onChange(async (v) => {
          this.plugin.settings.archiveNotesOnDone = v;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.archiveNotesOnDone) {
      new Setting(containerEl)
        .setName(t('archive_folder'))
        .setDesc(t('archive_folder_desc'))
        .addText((text) => text
          .setPlaceholder('0. archive')
          .setValue(this.plugin.settings.archiveFolder)
          .onChange(async (v) => {
            this.plugin.settings.archiveFolder = v.trim().replace(/^\/+|\/+$/g, '');
            await this.plugin.saveSettings();
          }));
    }

    new Setting(containerEl)
      .setName(t('template_file'))
      .setDesc(t('template_file_desc'))
      .addText((text) => text
        .setPlaceholder(t('template_file_placeholder'))
        .setValue(this.plugin.settings.noteTemplate)
        .onChange(async (v) => {
          this.plugin.settings.noteTemplate = v.trim();
          await this.plugin.saveSettings();
        }));

    // -- Automatisch verplaatsen ---------------------------------------
    new Setting(containerEl).setName(t('sec_automove')).setHeading();

    new Setting(containerEl)
      .setName(t('automove_today'))
      .setDesc(t('automove_today_desc'))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoMoveToday)
        .onChange(async (v) => {
          this.plugin.settings.autoMoveToday = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    new Setting(containerEl)
      .setName(t('inprogress_column'))
      .setDesc(t('inprogress_column_desc'))
      .addDropdown((dd) => {
        dd.addOption('', t('none_paren'));
        for (const c of this.plugin.settings.columns) dd.addOption(c, this.plugin.settings.columnLabels[c] || c);
        dd.setValue(this.plugin.settings.inProgressColumn);
        dd.onChange(async (v) => {
          this.plugin.settings.inProgressColumn = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t('automove_overdue'))
      .setDesc(t('automove_overdue_desc'))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoMoveOverdue)
        .onChange(async (v) => {
          this.plugin.settings.autoMoveOverdue = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    // -- Outlook -------------------------------------------------------
    new Setting(containerEl).setName(t('ol_section')).setHeading();
    containerEl.createEl('p', { cls: 'tk-help-line', text: t('ol_help') });

    new Setting(containerEl)
      .setName(t('ol_client_id'))
      .setDesc(t('ol_client_id_desc'))
      .addText((text) => {
        text.inputEl.addClass('tk-input-full');
        text
          .setPlaceholder(DEFAULT_MS_CLIENT_ID ? t('ol_client_id_ph_builtin') : t('ol_client_id_ph'))
          .setValue(this.plugin.settings.microsoftClientId || '')
          .onChange(async (v) => {
            this.plugin.settings.microsoftClientId = v.trim();
            await this.plugin.saveSettings();
            if (statusEl) {
              statusEl.setText(clientStatus());
              statusEl.toggleClass('tk-client-status-warn', !this.plugin.outlook.isConfigured());
            }
          });
      });
    const clientStatus = () => {
      if ((this.plugin.settings.microsoftClientId || '').trim()) return t('ol_client_id_custom');
      if (DEFAULT_MS_CLIENT_ID) return t('ol_client_id_builtin');
      return t('ol_client_id_none');
    };
    const statusEl = containerEl.createEl('p', { cls: 'tk-client-status', text: clientStatus() });
    if (!this.plugin.outlook.isConfigured()) statusEl.addClass('tk-client-status-warn');

    new Setting(containerEl)
      .setName(t('ol_show_events'))
      .setDesc(t('ol_show_events_desc'))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.outlookShowEvents)
        .onChange(async (v) => {
          this.plugin.settings.outlookShowEvents = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    // Gekoppelde accounts
    new Setting(containerEl).setName(t('ol_accounts')).setHeading();
    const accounts = this.plugin.outlook.accounts();
    if (!accounts.length) {
      containerEl.createEl('p', { cls: 'tk-help-line', text: t('ol_no_accounts') });
    } else {
      containerEl.createEl('p', { cls: 'tk-help-line', text: t('ol_shared_note') });
      for (const acc of accounts) {
        // Automatische naam uit Graph (displayName/e-mail); 'Account' telt als leeg.
        const autoName = (acc.label && acc.label !== t('ol_account')) ? acc.label : (acc.email || '');
        const row = new Setting(containerEl)
          .setName(t('ol_account_name'))
          .setDesc(acc.needsReauth ? `${acc.email || ''} — ${t('ol_reauth_needed')}` : (acc.email || ''));
        if (acc.color) {
          const dot = row.nameEl.createSpan({ cls: 'tk-account-dot' });
          dot.style.background = acc.color;
          row.nameEl.prepend(dot);
        }
        // Bewerkbare, herkenbare naam (overschrijft de automatische naam).
        row.addText((text) => {
          text.inputEl.addClass('tk-account-name-input');
          text
            .setPlaceholder(autoName || t('ol_account_name_hint'))
            .setValue(acc.customName || '')
            .onChange(async (v) => {
              acc.customName = v.trim();
              await this.plugin.saveSettings();
            });
        });
        row.addExtraButton((b) => b
          .setIcon('refresh-cw')
          .setTooltip(t('ol_refresh_calendars'))
          .onClick(async () => {
            await this.plugin.outlook.fetchCalendars(acc);
            this.plugin.refreshViews();
            this.display();
          }));
        row.addExtraButton((b) => b
          .setIcon('trash')
          .setTooltip(t('ol_remove'))
          .onClick(async () => {
            await this.plugin.outlook.removeAccount(acc.id);
            this.display();
          }));

        // Agenda-kiezer: per agenda een toggle (aan = tonen in de kalender).
        if (!Array.isArray(acc.calendars)) {
          containerEl.createEl('p', { cls: 'tk-help-line', text: t('ol_loading_calendars') });
          // Eenmalig laden; daarna opnieuw tekenen (zet altijd een array, geen loop).
          this.plugin.outlook.fetchCalendars(acc).then(() => this.display());
        } else if (!acc.calendars.length) {
          containerEl.createEl('p', { cls: 'tk-help-line', text: t('ol_no_calendars') });
        } else {
          for (const cal of acc.calendars) {
            const cs = new Setting(containerEl).setName(cal.name).setClass('tk-setting-child');
            const cdot = cs.nameEl.createSpan({ cls: 'tk-account-dot' });
            cdot.style.background = cal.color;
            cs.nameEl.prepend(cdot);
            cs.addToggle((tg) => tg
              .setValue((acc.selected || []).includes(cal.id))
              .onChange(async (v) => {
                const sel = new Set(acc.selected || []);
                if (v) sel.add(cal.id); else sel.delete(cal.id);
                acc.selected = [...sel];
                await this.plugin.saveSettings();
                this.plugin.outlook.clearCache();
                this.plugin.refreshViews();
              }));
          }
        }
      }
    }

    new Setting(containerEl)
      .setName(t('ol_add_account'))
      .setDesc(t('ol_add_account_desc'))
      .addButton((b) => b
        .setButtonText(t('ol_connect'))
        .setCta()
        .onClick(() => this.plugin.outlook.startAuth()));

    // -- Projects ------------------------------------------------------
    new Setting(containerEl).setName(t('sec_projects')).setHeading();
    containerEl.createEl('p', { cls: 'tk-help-line', text: t('projects_help') });

    new Setting(containerEl)
      .setName(t('scan_folders'))
      .setDesc(t('scan_folders_desc'))
      .addTextArea((text) => {
        text.inputEl.rows = 3;
        text.inputEl.addClass('tk-input-full');
        text
          .setPlaceholder(t('scan_folders_placeholder'))
          .setValue((this.plugin.settings.projectScanFolders || []).join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.projectScanFolders = value
              .split('\n')
              .map((s) => s.trim().replace(/^\/+|\/+$/g, ''))
              .filter(Boolean);
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(t('detect_projects'))
      .setDesc(t('detect_projects_desc'))
      .addButton((b) => b
        .setButtonText(t('scan_vault'))
        .onClick(async () => {
          const found = new Set();
          const files = this.plugin.projectScanFiles();
          for (const file of files) {
            const content = await this.app.vault.cachedRead(file);
            const matches = content.match(/#project\/[\w-]+(?:\/[\w-]+)*/g);
            if (matches) matches.forEach((m) => found.add(m.replace('#project/', '')));
          }
          let added = 0;
          for (const p of found) {
            if (!this.plugin.settings.projectColors[p]) {
              await this.plugin.assignProjectColor(p);
              added++;
            }
          }
          new Notice(t('scan_result', { found: found.size, added }));
          this.display();
          this.plugin.refreshViews();
        }));

    const projects = this.plugin.getProjects();
    if (projects.length === 0) {
      const empty = containerEl.createDiv({ cls: 'tk-help-line' });
      empty.setText(t('no_projects_yet'));
    } else {
      for (const proj of projects) {
        const segments = proj.split('/');
        const depth = segments.length - 1;
        const displayName = depth > 0 ? '↳ ' + segments[segments.length - 1] : proj;

        const setting = new Setting(containerEl)
          .setName(displayName)
          .setDesc(`#project/${proj}`);

        if (depth > 0) {
          setting.settingEl.addClass('tk-setting-child');
          setting.settingEl.style.paddingLeft = (24 * depth + 8) + 'px';
        }

        // Color input
        setting.addColorPicker((picker) => {
          const current = this.plugin.settings.projectColors[proj] || DEFAULT_PALETTE[0];
          picker.setValue(current);
          picker.onChange(async (val) => {
            this.plugin.settings.projectColors[proj] = val;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          });
        });

        // Label input
        setting.addText((text) => {
          text.setPlaceholder(t('project_label_placeholder'))
            .setValue((this.plugin.settings.projectLabels || {})[proj] || '')
            .onChange(async (v) => {
              if (!this.plugin.settings.projectLabels) this.plugin.settings.projectLabels = {};
              if (v.trim()) this.plugin.settings.projectLabels[proj] = v.trim();
              else delete this.plugin.settings.projectLabels[proj];
              await this.plugin.saveSettings();
              this.plugin.refreshViews();
            });
        });

        // Remove button
        setting.addExtraButton((b) => b
          .setIcon('trash')
          .setTooltip(t('remove_color'))
          .onClick(async () => {
            delete this.plugin.settings.projectColors[proj];
            if (this.plugin.settings.projectLabels) delete this.plugin.settings.projectLabels[proj];
            await this.plugin.saveSettings();
            this.display();
            this.plugin.refreshViews();
          }));
      }
    }

    // -- Help ----------------------------------------------------------
    new Setting(containerEl).setName(t('sec_help')).setHeading();
    const help = containerEl.createDiv({ cls: 'tk-help' });
    help.createEl('p', { text: t('help_p1') });
    const example = help.createEl('pre');
    example.setText(t('help_example'));
    help.createEl('p', { text: t('help_p2') });
    help.createEl('p', { text: t('help_p3') });
    help.createEl('p', { text: t('help_p4') });
    help.createEl('p', { text: t('help_p5') });
  }
}
