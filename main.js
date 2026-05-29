'use strict';

const obsidian = require('obsidian');
const { Plugin, ItemView, Modal, Setting, PluginSettingTab, TFile, Notice, MarkdownView } = obsidian;

const VIEW_TYPE_KANBAN = 'trietment-kanban-view';

const DEFAULT_SETTINGS = {
  columns: ['todo', 'doing', 'done'],
  columnLabels: { todo: 'Te doen', doing: 'Bezig', done: 'Klaar' },
  defaultColumn: 'todo',
  doneColumn: 'done',
  inboxNote: 'Kanban Inbox.md',
  showInbox: true,
  projectColors: {},
  projectLabels: {},
  autoMoveToday: true,
  inProgressColumn: 'doing',
  autoMoveOverdue: false,
  noteFolder: 'Kanban Notes', // map voor álle gekoppelde notities (leeg = bij de bron-note)
  noteTemplate: '',   // leeg = ingebouwde template hieronder
};

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

const RECURRENCE_PRESETS = [
  { value: '', label: 'Geen' },
  { value: 'every day', label: 'Dagelijks' },
  { value: 'every week', label: 'Wekelijks' },
  { value: 'every 2 weeks', label: 'Elke 2 weken' },
  { value: 'every month', label: 'Maandelijks' },
  { value: 'every 3 months', label: 'Per kwartaal' },
  { value: 'every year', label: 'Jaarlijks' },
];

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
    .replace(/🔁\s+every\s+(?:\d+\s+)?(?:days?|weeks?|months?|years?|daily|weekly|monthly|yearly)/gi, '')
    .replace(/#kanban\/[\w-]+/g, '')
    .replace(/#project\/[\w-]+(?:\/[\w-]+)*/g, '')
    .replace(/\[\[[^\]]+\]\]/g, '')
    .replace(/[🔺⏫🔼🔽⏬]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    text, dueDate, column, project, priority, recurrence, done, noteLink,
    file: filePath, line: lineNum, indent,
    raw: line, subtasks: [],
  };
}

// -- The plugin -------------------------------------------------------------

module.exports = class KanbanPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_KANBAN, (leaf) => new KanbanView(leaf, this));

    this.addRibbonIcon('square-kanban', 'Open Kanban-bord', () => this.activateView());

    this.addCommand({
      id: 'open-kanban',
      name: 'Open Kanban-bord',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'add-kanban-task',
      name: 'Voeg Kanban-taak toe (inbox)',
      callback: () => {
        new AddTaskModal(this.app, this, async (task) => {
          await this.createTaskInFile(task, task.targetFile || this.settings.inboxNote);
          this.scheduleRefresh();
        }).open();
      },
    });

    this.addCommand({
      id: 'add-kanban-task-current',
      name: 'Voeg Kanban-taak toe aan huidige note',
      editorCallback: (editor, view) => {
        if (!view || !view.file) {
          new Notice('Open eerst een note.');
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
      name: 'Verplaats taken die vandaag due zijn naar Bezig',
      callback: async () => {
        const moved = await this.autoMoveDueTasks();
        new Notice(moved > 0 ? `${moved} ta(a)k(en) naar Bezig verplaatst.` : 'Geen taken om te verplaatsen.');
        this.refreshViews();
      },
    });

    this.addSettingTab(new KanbanSettingTab(this.app, this));

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

  scheduleRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refreshViews(), 200);
  }

  refreshViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_KANBAN).forEach((leaf) => {
      if (leaf.view instanceof KanbanView) leaf.view.render();
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

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  formatTaskLine(task) {
    const done = task.column === this.settings.doneColumn;
    let line = `- [${done ? 'x' : ' '}] ${task.text.trim()}`;
    if (task.recurrence) line += ` 🔁 ${task.recurrence}`;
    if (task.dueDate) line += ` 📅 ${task.dueDate}`;
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
    if (!path) throw new Error('Geen bestandspad opgegeven.');
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
      new Notice('Geen doelbestand. Stel een inbox-note in via Instellingen.');
      return;
    }
    if (task.project) await this.assignProjectColor(task.project);
    const formatted = this.formatTaskLine(task);
    const file = await this.ensureFile(path, `# Kanban Inbox\n\n`);
    if (file instanceof TFile) {
      const content = await this.app.vault.read(file);
      const sep = content.length === 0 || content.endsWith('\n') ? '' : '\n';
      await this.app.vault.modify(file, content + sep + formatted + '\n');
      new Notice(`Taak toegevoegd aan ${path}`);
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
    if (!parseTaskLine(line, filePath, lineNum)) return;

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

  async toggleDone(task) {
    const file = this.app.vault.getAbstractFileByPath(task.file);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');
    if (task.line >= lines.length) return;
    let line = lines[task.line];

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
      }
    } else if (newDate) {
      line = line.trimEnd() + ` 📅 ${newDate}`;
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
  getDisplayText() { return 'Kanban-bord'; }
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
    header.createEl('h2', { text: 'Kanban-bord', cls: 'tk-title' });

    const filter = header.createEl('input', { cls: 'tk-filter', type: 'text', placeholder: 'Filter taken…' });
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
    hideDoneLabel.createSpan({ text: ' Verberg klaar' });

    const addBtn = header.createEl('button', { text: '+ Nieuwe taak', cls: 'tk-btn tk-btn-cta' });
    addBtn.onclick = () => {
      new AddTaskModal(this.app, this.plugin, async (task) => {
        await this.plugin.createTaskInFile(task, task.targetFile || this.plugin.settings.inboxNote);
        this.plugin.scheduleRefresh();
      }).open();
    };

    const refreshBtn = header.createEl('button', { text: '↻', cls: 'tk-btn', title: 'Vernieuwen' });
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
      ? 'Inbox'
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

    const addBtn = colEl.createEl('button', { text: '+ Taak toevoegen', cls: 'tk-col-add' });
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
        parent.setAttr('title', `Bovenliggend: ${parentPath}`);
      }

      const badge = wrap.createDiv({ cls: 'tk-project-badge' });
      const color = this.plugin.getProjectColor(task.project);
      if (color) badge.style.background = color;
      const customLabel = (this.plugin.settings.projectLabels || {})[task.project];
      const displayLabel = customLabel || segments[segments.length - 1];
      badge.setText(displayLabel);
      badge.setAttr('title', `Project: ${task.project}`);
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
      subBadge.setAttr('title', `${doneCount}/${subtasks.length} subtaken klaar — open om te bewerken`);
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
    noteBtn.setAttr('title', noteExists ? 'Open gekoppelde notitie' : 'Maak gekoppelde notitie');
    noteBtn.onclick = async (e) => {
      e.stopPropagation();
      await this.plugin.openOrCreateLinkedNote(task);
      this.plugin.scheduleRefresh();
    };

    // Acties (verwijderen) — in de header zodat ze ook op mobiel bereikbaar zijn
    const actions = headRight.createDiv({ cls: 'tk-card-actions' });
    const delBtn = actions.createEl('button', { text: '×', title: 'Verwijder' });
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      const extra = subtasks.length ? ` (incl. ${subtasks.length} subtaak/taken)` : '';
      if (confirm(`Verwijder taak: "${task.text}"?${extra}`)) {
        await this.plugin.deleteTask(task);
        this.plugin.scheduleRefresh();
      }
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
      checkbox.setAttr('title', `Eerst alle subtaken afvinken (${openSubs} van ${subtasks.length} nog open)`);
    }
    checkbox.addEventListener('change', async () => {
      if (blockCheck) {
        checkbox.checked = task.done; // reset naar werkelijke status
        new Notice(`Eerst alle subtaken afvinken — nog ${openSubs} open.`);
        return;
      }
      await this.plugin.toggleDone(task);
      this.plugin.scheduleRefresh();
    });
    top.createDiv({ cls: 'tk-card-text', text: task.text || '(lege taak)' });

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
        row.createSpan({ cls: 'tk-card-sub-text', text: sub.text || '(leeg)' });
      }
    }

    // Meta
    const meta = card.createDiv({ cls: 'tk-card-meta' });
    if (task.dueDate) {
      meta.createSpan({ cls: 'tk-due', text: `📅 ${task.dueDate}` });
    }
    if (task.priority) {
      meta.createSpan({ cls: 'tk-prio', text: PRIORITY_ICONS[task.priority] });
    }
    if (task.recurrence) {
      const rec = meta.createSpan({ cls: 'tk-recur', text: '🔁' });
      rec.setAttr('title', `Herhaalt: ${task.recurrence}`);
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
      priority: '',
      project: '',
      recurrence: '',
      targetFile: defaultFile || plugin.settings.inboxNote,
    };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('tk-modal');
    contentEl.createEl('h2', { text: 'Nieuwe Kanban-taak' });

    let textInput;
    new Setting(contentEl)
      .setName('Taak')
      .addText((text) => {
        textInput = text;
        text.setPlaceholder('Wat moet er gebeuren?')
          .onChange((v) => (this.task.text = v));
        text.inputEl.style.width = '100%';
      });

    new Setting(contentEl)
      .setName('Kolom')
      .addDropdown((dd) => {
        for (const col of this.plugin.settings.columns) {
          dd.addOption(col, this.plugin.settings.columnLabels[col] || col);
        }
        dd.setValue(this.task.column);
        dd.onChange((v) => (this.task.column = v));
      });

    // Project — text input met chips voor bestaande projecten
    const projectSetting = new Setting(contentEl)
      .setName('Project')
      .setDesc('Optioneel. Kies een bestaand project of typ een nieuwe naam.');
    let projInput;
    projectSetting.addText((text) => {
      projInput = text;
      text.setPlaceholder('bv. aim of klant/acme')
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
      .setName('Due date')
      .addText((text) => {
        text.inputEl.type = 'date';
        text.setValue(this.task.dueDate);
        text.onChange((v) => (this.task.dueDate = v));
      });

    new Setting(contentEl)
      .setName('Prioriteit')
      .addDropdown((dd) => {
        dd.addOption('', 'Geen');
        dd.addOption('highest', '🔺 Hoogst');
        dd.addOption('high', '⏫ Hoog');
        dd.addOption('medium', '🔼 Middel');
        dd.addOption('low', '🔽 Laag');
        dd.addOption('lowest', '⏬ Laagst');
        dd.setValue(this.task.priority);
        dd.onChange((v) => (this.task.priority = v));
      });

    new Setting(contentEl)
      .setName('Herhalen')
      .setDesc('Bij afvinken maakt de plugin automatisch een volgende instance met de nieuwe due date.')
      .addDropdown((dd) => {
        for (const p of RECURRENCE_PRESETS) dd.addOption(p.value, p.label);
        dd.setValue(this.task.recurrence || '');
        dd.onChange((v) => (this.task.recurrence = v));
      });

    new Setting(contentEl)
      .setName('Doel-bestand')
      .setDesc('Waar de taak wordt opgeslagen. Leeg = inbox-note uit instellingen.')
      .addText((text) => {
        text.setPlaceholder(this.plugin.settings.inboxNote || 'Kanban Inbox.md')
          .setValue(this.task.targetFile || '')
          .onChange((v) => (this.task.targetFile = v));
      });

    const btnRow = new Setting(contentEl);
    btnRow.addButton((b) => b.setButtonText('Annuleer').onClick(() => this.close()));
    btnRow.addButton((b) =>
      b.setButtonText('Voeg toe').setCta().onClick(async () => {
        if (!this.task.text.trim()) {
          new Notice('Taaktekst is verplicht.');
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
    this.newProject = task.project || '';
    this.newRecurrence = task.recurrence || '';
    this.newColumn = task.column || 'inbox';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('tk-modal');
    contentEl.createEl('h2', { text: 'Taak bewerken' });

    contentEl.createDiv({ cls: 'tk-modal-info', text: this.task.text });
    contentEl.createDiv({ cls: 'tk-modal-sub', text: `Bron: ${this.task.file}:${this.task.line + 1}` });

    new Setting(contentEl)
      .setName('Kolom / status')
      .addDropdown((dd) => {
        if (this.plugin.settings.showInbox || this.newColumn === 'inbox') dd.addOption('inbox', 'Inbox');
        for (const col of this.plugin.settings.columns) {
          dd.addOption(col, this.plugin.settings.columnLabels[col] || col);
        }
        dd.setValue(this.newColumn);
        dd.onChange((v) => (this.newColumn = v));
      });

    new Setting(contentEl)
      .setName('Due date')
      .setDesc('Leeg laten om de datum te verwijderen.')
      .addText((text) => {
        text.inputEl.type = 'date';
        text.setValue(this.newDate);
        text.onChange((v) => (this.newDate = v));
      });

    new Setting(contentEl)
      .setName('Herhalen')
      .setDesc('Bij afvinken wordt er automatisch een volgende instance gemaakt.')
      .addDropdown((dd) => {
        for (const p of RECURRENCE_PRESETS) dd.addOption(p.value, p.label);
        // Als de huidige rule niet matcht met een preset, voeg hem als custom optie toe
        const presetValues = RECURRENCE_PRESETS.map((p) => p.value);
        if (this.newRecurrence && !presetValues.includes(this.newRecurrence)) {
          dd.addOption(this.newRecurrence, this.newRecurrence + ' (aangepast)');
        }
        dd.setValue(this.newRecurrence || '');
        dd.onChange((v) => (this.newRecurrence = v));
      });

    let projInput;
    new Setting(contentEl)
      .setName('Project')
      .setDesc('Leeg laten om het project te verwijderen. Gebruik / voor subproject (bv. klant/acme).')
      .addText((text) => {
        projInput = text;
        text.setPlaceholder('bv. klant/acme')
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
    contentEl.createEl('h3', { text: 'Subtaken' });
    const subWrap = contentEl.createDiv({ cls: 'tk-modal-subtasks' });
    const renderSubs = () => {
      subWrap.empty();
      const subs = this.task.subtasks || [];
      if (!subs.length) {
        subWrap.createDiv({ cls: 'tk-help-line', text: 'Nog geen subtaken.' });
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
        row.createSpan({ cls: 'tk-subtask-text', text: sub.text || '(leeg)' });
        const del = row.createEl('button', { cls: 'tk-subtask-del', text: '×', title: 'Verwijder subtaak' });
        del.onclick = async () => {
          await this.plugin.deleteSubtask(sub);
          this.task.subtasks = await this.plugin.getSubtasks(this.task);
          this.onDone && this.onDone();
          renderSubs();
        };
      }
      const addRow = subWrap.createDiv({ cls: 'tk-subtask-add' });
      const input = addRow.createEl('input', { type: 'text', cls: 'tk-subtask-input', placeholder: 'Nieuwe subtaak…' });
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
      const addBtn = addRow.createEl('button', { cls: 'tk-subtask-addbtn', text: '+', title: 'Subtaak toevoegen' });
      addBtn.onclick = commit;
    };
    renderSubs();

    new Setting(contentEl)
      .addButton((b) => b.setButtonText('Open in note').onClick(async () => {
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
      .addButton((b) => b.setButtonText('📄 Notitie').onClick(async () => {
        await this.plugin.openOrCreateLinkedNote(this.task);
        this.onDone && this.onDone();
        this.close();
      }))
      .addButton((b) => b.setButtonText('Opslaan').setCta().onClick(async () => {
        if (this.newDate !== (this.task.dueDate || '')) {
          await this.plugin.setDueDate(this.task, this.newDate);
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

// -- Settings Tab -----------------------------------------------------------

class KanbanSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Trietment Kanban — instellingen' });

    new Setting(containerEl)
      .setName('Kolommen')
      .setDesc('Kolom-IDs gescheiden door komma\'s. Gebruik lowercase, geen spaties. Bijv: todo,doing,review,done')
      .addText((text) => text
        .setValue(this.plugin.settings.columns.join(','))
        .onChange(async (value) => {
          this.plugin.settings.columns = value.split(',').map((s) => s.trim()).filter(Boolean);
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    new Setting(containerEl)
      .setName('Kolom-labels')
      .setDesc('Weergave-labels per kolom. Eén per regel, formaat: id=Label')
      .addTextArea((text) => {
        text.inputEl.rows = 6;
        text.inputEl.style.width = '100%';
        text
          .setValue(Object.entries(this.plugin.settings.columnLabels).map(([k, v]) => `${k}=${v}`).join('\n'))
          .onChange(async (value) => {
            const labels = {};
            value.split('\n').forEach((line) => {
              const eq = line.indexOf('=');
              if (eq > 0) labels[line.substring(0, eq).trim()] = line.substring(eq + 1).trim();
            });
            this.plugin.settings.columnLabels = labels;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          });
      });

    new Setting(containerEl)
      .setName('Standaardkolom')
      .setDesc('Kolom waarin nieuwe taken landen.')
      .addText((text) => text
        .setValue(this.plugin.settings.defaultColumn)
        .onChange(async (v) => {
          this.plugin.settings.defaultColumn = v.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Klaar-kolom (ID)')
      .setDesc('Taken die hierheen verplaatst worden krijgen [x].')
      .addText((text) => text
        .setValue(this.plugin.settings.doneColumn)
        .onChange(async (v) => {
          this.plugin.settings.doneColumn = v.trim();
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    new Setting(containerEl)
      .setName('Inbox-note')
      .setDesc('Standaardbestand voor nieuwe taken. Wordt aangemaakt als het niet bestaat.')
      .addText((text) => text
        .setPlaceholder('Kanban Inbox.md')
        .setValue(this.plugin.settings.inboxNote)
        .onChange(async (v) => {
          this.plugin.settings.inboxNote = v.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Inbox-kolom tonen')
      .setDesc('Toon taken zonder #kanban/ tag in een aparte Inbox-kolom.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showInbox)
        .onChange(async (v) => {
          this.plugin.settings.showInbox = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    // -- Gekoppelde notities -------------------------------------------
    containerEl.createEl('h3', { text: 'Gekoppelde notities' });
    containerEl.createEl('p', {
      cls: 'tk-help-line',
      text: 'Elke kaart kan een eigen notitie krijgen via de 📄-knop. De notitie wordt aangemaakt uit een template.',
    });

    new Setting(containerEl)
      .setName('Notitie-map')
      .setDesc('Map waarin álle gekoppelde notities komen (wordt automatisch aangemaakt). Leeg = dezelfde map als de note waar de taak in staat.')
      .addText((text) => text
        .setPlaceholder('bv. Kanban Notes — leeg = bij de bron-note')
        .setValue(this.plugin.settings.noteFolder)
        .onChange(async (v) => {
          this.plugin.settings.noteFolder = v.trim().replace(/^\/+|\/+$/g, '');
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Template-bestand')
      .setDesc('Pad naar een template-note. Leeg = ingebouwde template. Placeholders: {{title}} {{project}} {{due}} {{status}} {{date}} {{time}} {{source}} {{sourcePath}}')
      .addText((text) => text
        .setPlaceholder('leeg = ingebouwde template')
        .setValue(this.plugin.settings.noteTemplate)
        .onChange(async (v) => {
          this.plugin.settings.noteTemplate = v.trim();
          await this.plugin.saveSettings();
        }));

    // -- Automatisch verplaatsen ---------------------------------------
    containerEl.createEl('h3', { text: 'Automatisch verplaatsen' });

    new Setting(containerEl)
      .setName('Vandaag → Bezig')
      .setDesc('Taken met due date = vandaag worden automatisch vanuit Inbox/Te-doen naar de Bezig-kolom verplaatst.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoMoveToday)
        .onChange(async (v) => {
          this.plugin.settings.autoMoveToday = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    new Setting(containerEl)
      .setName('Bezig-kolom (ID)')
      .setDesc('Naar welke kolom due-taken verplaatst worden.')
      .addText((text) => text
        .setValue(this.plugin.settings.inProgressColumn)
        .onChange(async (v) => {
          this.plugin.settings.inProgressColumn = v.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Ook achterstallige taken')
      .setDesc('Verplaats ook taken waarvan de due date al verstreken is (niet alleen exact vandaag).')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoMoveOverdue)
        .onChange(async (v) => {
          this.plugin.settings.autoMoveOverdue = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    // -- Projects ------------------------------------------------------
    containerEl.createEl('h3', { text: 'Projecten en kleuren' });
    containerEl.createEl('p', {
      cls: 'tk-help-line',
      text: 'Geef per project een kleur. Gebruik #project/<naam> in je taken om ze hieraan te koppelen.',
    });

    new Setting(containerEl)
      .setName('Detecteer projecten uit vault')
      .setDesc('Doorzoek alle notes naar #project/ tags en wijs automatisch een kleur toe aan ontbrekende projecten.')
      .addButton((b) => b
        .setButtonText('Scan vault')
        .onClick(async () => {
          const found = new Set();
          const files = this.app.vault.getMarkdownFiles();
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
          new Notice(`${found.size} projecten gevonden, ${added} nieuwe kleuren toegekend.`);
          this.display();
          this.plugin.refreshViews();
        }));

    const projects = this.plugin.getProjects();
    if (projects.length === 0) {
      const empty = containerEl.createDiv({ cls: 'tk-help-line' });
      empty.setText('Nog geen projecten. Voeg een taak toe met #project/<naam> en hij verschijnt hier.');
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
          text.setPlaceholder('weergave-label (optioneel)')
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
          .setTooltip('Verwijder kleur (taken blijven bestaan)')
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
    containerEl.createEl('h3', { text: 'Hoe werkt het?' });
    const help = containerEl.createDiv({ cls: 'tk-help' });
    help.createEl('p', { text: 'Taken zijn gewone markdown checkboxes. Voeg ze in om het even welke note toe — het bord verzamelt ze automatisch.' });
    const example = help.createEl('pre');
    example.setText(
      '- [ ] Offerte uitwerken 📅 2026-05-25 #project/aim #kanban/doing ⏫\n' +
      '    - [ ] Cijfers opvragen\n' +
      '    - [x] Template kiezen\n' +
      '- [ ] Onboarding-call met klant [[Acme onboarding]] #project/klant/acme #kanban/todo\n' +
      '- [x] Mail verstuurd #project/klant/beta #kanban/done'
    );
    help.createEl('p', { text: 'Klik op een kaart om hem te bewerken. In de modal beheer je status, due date, project, subtaken en de gekoppelde notitie.' });
    help.createEl('p', { text: 'Subtaken zijn ingesprongen checkboxes onder een taak. Het bord toont een ☑ 2/5 badge; toevoegen/afvinken doe je in de edit-modal.' });
    help.createEl('p', { text: 'Met de 📄-knop maak je een gekoppelde notitie (een [[wikilink]] in de taakregel) uit je template. Bestaat hij al, dan opent de knop hem.' });
    help.createEl('p', { text: 'Sleep een kaart naar een andere kolom (desktop) of wijzig de kolom in de modal. Klik op een gekleurde project-badge om op dat project te filteren.' });
  }
}
