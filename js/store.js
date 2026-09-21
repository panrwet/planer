/* Datenhaltung. Alles liegt in localStorage auf diesem Gerät – nichts verlässt
   das Telefon. Jede Mutation geht durch save(), damit nichts verloren geht. */

import { uid, todayKey, addDays, addMonths, weekdayOf, weekStart, monthStart, monthDays, clamp } from './util.js';

const KEY = 'planer.v1';
const SCHEMA = 7;

/* Papierkorb: Löschen ist umkehrbar, aber nicht ewig. Nach dieser Frist räumt
   die App von selbst auf, damit der Speicher nicht still zuwächst. */
const TRASH_DAYS = 30;
const TRASH_MAX = 200;

/* Auswahlfarben. Helligkeit, Sättigung und Kontrast gegen beide Untergründe
   sind geprüft; die Farbe ist nie das einzige Erkennungsmerkmal – Emoji und
   Name stehen immer daneben. */
/* Auswahlpalette: 14 gleichmäßig über den Farbkreis verteilte Töne plus zwei
   neutrale, angeordnet als zwei Reihen à acht. In OKLCH bei fester Helligkeit
   erzeugt, damit alle gleich kräftig wirken und gegen beide Untergründe
   mindestens 3:1 Kontrast haben. Nachbartöne liegen zwangsläufig nah
   beieinander (im Cyan-Bereich ΔE ~5) – für einen Farbwähler unkritisch, weil
   pro Objekt nur eine Farbe gilt und Emoji plus Name die Erkennung tragen. */
export const COLORS = [
  { id: 'red',     name: 'Rot',        light: '#cd4845', dark: '#fc867f' },
  { id: 'orange',  name: 'Orange',     light: '#c15a00', dark: '#f59052' },
  { id: 'amber',   name: 'Bernstein',  light: '#a47003', dark: '#e1a02b' },
  { id: 'gold',    name: 'Gold',       light: '#8b7e02', dark: '#c0b02b' },
  { id: 'lime',    name: 'Limette',    light: '#618b02', dark: '#93bf53' },
  { id: 'green',   name: 'Grün',       light: '#039450', dark: '#58c882' },
  { id: 'emerald', name: 'Smaragd',    light: '#04907d', dark: '#00cab0' },
  { id: 'teal',    name: 'Türkis',     light: '#008c98', dark: '#0bc4d4' },
  { id: 'cyan',    name: 'Cyan',       light: '#0087b4', dark: '#20bdf8' },
  { id: 'blue',    name: 'Blau',       light: '#2b7ade', dark: '#76b0fe' },
  { id: 'indigo',  name: 'Indigo',     light: '#6f69dc', dark: '#a1a3fe' },
  { id: 'violet',  name: 'Violett',    light: '#985ac8', dark: '#c793f4' },
  { id: 'magenta', name: 'Magenta',    light: '#b44da5', dark: '#e489d4' },
  { id: 'pink',    name: 'Pink',       light: '#c74679', dark: '#f684ab' },
  { id: 'brown',   name: 'Braun',      light: '#8b6953', dark: '#bc9780' },
  { id: 'slate',   name: 'Grau',       light: '#727d89', dark: '#a4afbc' },
];

/* Alte Farb-Kennungen, die es nicht mehr gibt, auf den nächsten Ton abbilden. */
const COLOR_ALIASES = { purple: 'violet' };


/* Intervalle. Ein Habit hat genau ein Ziel, und zwar pro Intervall – kein
   zweites Ziel daneben. */
export const INTERVALS = [
  { id: 'day',   label: 'Täglich',            per: 'pro Tag',   noun: 'Tag',   nounPl: 'Tage'   },
  { id: 'days',  label: 'An bestimmten Tagen', per: 'pro Tag',   noun: 'Tag',   nounPl: 'Tage'   },
  { id: 'week',  label: 'Pro Woche',          per: 'pro Woche', noun: 'Woche', nounPl: 'Wochen' },
  { id: 'month', label: 'Pro Monat',          per: 'pro Monat', noun: 'Monat', nounPl: 'Monate' },
];

export function intervalOf(h) {
  return INTERVALS.find(i => i.id === h.sched) || INTERVALS[0];
}

export const UNITS = [
  { id: 'count',   one: 'Mal',     many: 'Mal',      label: 'Anzahl' },
  { id: 'min',     one: 'Minute',  many: 'Minuten',  label: 'Minuten' },
  { id: 'hour',    one: 'Stunde',  many: 'Stunden',  label: 'Stunden' },
  { id: 'page',    one: 'Seite',   many: 'Seiten',   label: 'Seiten' },
  { id: 'km',      one: 'km',      many: 'km',       label: 'Kilometer' },
  { id: 'glass',   one: 'Glas',    many: 'Gläser',   label: 'Gläser' },
  { id: 'portion', one: 'Portion', many: 'Portionen',label: 'Portionen' },
  { id: 'rep',     one: 'Wdh.',    many: 'Wdh.',     label: 'Wiederholungen' },
];

export const DEFAULTS = {
  doneHabits: 'hide',   // 'hide' | 'dim'
  rowSize: 'medium',    // 'small' | 'medium' | 'large'
  theme: 'system',      // 'system' | 'light' | 'dark'
  dayStart: 0,          // 0 | 3  (Stunde, ab der ein neuer Tag zählt)
  doneTodos: 'hide',    // 'hide' | 'show'
  lastListId: '',       // Liste, die der To-dos-Reiter direkt öffnet ('__all' = alle)
  groups: {},           // Häufigkeits-Gruppen: id -> aufgeklappt (true/false)
  recentEmoji: [],      // zuletzt gewählte Emojis, neuestes zuerst
  saturation: 'normal', // 'off' | 'soft' | 'normal' | 'strong' – wie kräftig getönt wird
  planMinutesHabit: 30, // Standarddauer eines eingeplanten Habits
  planMinutesTodo: 30,  // Standarddauer einer eingeplanten To-do
};

/* Ein Profil ist Teil des leeren Stands, nicht erst der Migration: Beim
   allerersten Start wird nicht migriert, und ohne Profil hätte die Startseite
   nichts anzuzeigen. */
function emptyData() {
  const profil = defaultProfile();
  return { v: SCHEMA, settings: { ...DEFAULTS, homeProfileId: profil.id },
           habits: [], log: {}, lists: [], todos: [],
           plans: [], homeProfiles: [profil], trash: [] };
}

/* ---------- Persistenz ---------- */

let data = emptyData();
let writeTimer = null;
let dirty = false;      // gibt es ungeschriebene Änderungen?
const listeners = new Set();

function storage() {
  try {
    const s = globalThis.localStorage;
    s.getItem(KEY);           // wirft im blockierten Zustand
    return s;
  } catch {
    return null;              // Privater Modus o. Ä. – App läuft, speichert nur nicht
  }
}

export function load() {
  const s = storage();
  if (!s) return data;
  try {
    const raw = s.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const fromVersion = Number(parsed?.v) || 1;
      data = migrate(parsed);
      // Eine gelaufene Migration muss festgeschrieben werden. Sonst bleibt der
      // alte Stand liegen, die Migration läuft bei jedem Start erneut und
      // vergibt dabei jedes Mal neue Kennungen.
      // Abgelaufene Papierkorb-Einträge beim Start wegräumen.
      const dropped = pruneTrash();
      if (fromVersion < SCHEMA || dropped) {
        dirty = true;
        flush();
      }
    }
  } catch (err) {
    console.warn('Gespeicherte Daten unlesbar, starte leer.', err);
  }
  return data;
}

/** Gebündeltes Schreiben: viele schnelle Taps erzeugen nur einen Write. */
function save() {
  dirty = true;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, 120);
  for (const fn of listeners) fn(data);
}

/**
 * Schreibt den Stand – aber nur, wenn hier wirklich etwas geändert wurde.
 * Ohne diese Bedingung würde eine zweite offene Instanz (Safari-Tab neben der
 * App vom Home-Bildschirm) beim Verlassen ihren alten Stand über die neueren
 * Daten schreiben.
 */
export function flush() {
  clearTimeout(writeTimer);
  if (!dirty) return true;
  const s = storage();
  if (!s) { reportWrite(false, 'kein Speicher'); return false; }
  try {
    s.setItem(KEY, JSON.stringify(data));
    dirty = false;
    reportWrite(true);
    return true;
  } catch (err) {
    console.error('Speichern fehlgeschlagen', err);
    reportWrite(false, err?.name === 'QuotaExceededError' ? 'Speicher voll' : 'Schreibfehler');
    return false;
  }
}

/* Ein fehlgeschlagener Schreibvorgang darf nicht still bleiben: Die App liefe
   scheinbar normal weiter, und beim nächsten Start wäre alles seit dem letzten
   gelungenen Schreiben verloren. Gemeldet wird nur der Übergang – sonst käme
   bei jedem Tippen eine neue Warnung. */
const writeWatchers = new Set();
let writeOk = true;

export function onWriteProblem(fn) {
  writeWatchers.add(fn);
  return () => writeWatchers.delete(fn);
}

function reportWrite(ok, reason) {
  if (ok === writeOk) return;
  writeOk = ok;
  for (const fn of writeWatchers) fn(ok, reason);
}

export function isDirty() { return dirty; }

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getData() { return data; }

function migrate(d) {
  if (!d || typeof d !== 'object') return emptyData();
  const out = { ...emptyData(), ...d };
  out.settings = { ...DEFAULTS, ...(d.settings || {}) };
  out.settings.groups = { ...(d.settings?.groups || {}) };
  out.habits = sanitizeHabits(d.habits);
  out.lists = sanitizeLists(d.lists);
  out.todos = sanitizeTodos(d.todos, out.lists);
  out.log = sanitizeLog(d.log, out.habits);
  out.plans = sanitizePlans(d.plans, out.habits, out.todos);
  out.homeProfiles = sanitizeProfiles(d.homeProfiles);
  // Ohne Profil gäbe es keine Startseite – eines muss es immer geben.
  if (!out.homeProfiles.length) out.homeProfiles = [defaultProfile()];
  if (!out.homeProfiles.some(p => p.id === out.settings.homeProfileId)) {
    out.settings.homeProfileId = out.homeProfiles[0].id;
  }
  pruneWidgetTargets(out);
  out.trash = sanitizeTrash(d.trash);

  out.settings.recentEmoji = Array.isArray(d.settings?.recentEmoji) ? [...d.settings.recentEmoji] : [];

  const from = Number(d.v) || 1;
  if (from < 3) toSchema3(out);
  if (from < 4) toSchema4(out);

  out.v = SCHEMA;
  return out;
}

/**
 * Schema 4: ein Ziel pro Intervall statt Tagesziel *und* Tage-pro-Woche.
 * „20 Seiten an 3 Tagen pro Woche" wird zu „60 Seiten pro Woche" – die
 * Absicht bleibt, die Bedienung wird einfacher. Erfasste Tageswerte bleiben
 * unverändert, sie werden ab jetzt über das Intervall summiert.
 */
function toSchema4(d) {
  for (const h of d.habits) {
    if (h.sched === 'daily' || !h.sched) h.sched = 'day';
    else if (h.sched === 'week') {
      const days = Math.max(1, Number(h.weekTarget) || 1);
      h.target = Math.max(1, Math.round((Number(h.target) || 1) * days));
    }
    delete h.weekTarget;
    if (typeof h.note !== 'string') h.note = '';
    if (!Array.isArray(h.days) || !h.days.length) h.days = [1, 2, 3, 4, 5];
  }
}

/* ---------- Einlesen absichern ----------
   Eine Sicherungsdatei kann beschädigt sein oder von Hand bearbeitet worden.
   Alles, was hereinkommt, wird deshalb geprüft und ergänzt; was sich nicht
   retten lässt, fliegt raus, statt die App beim Start scheitern zu lassen. */

const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
const posNum = (v, fallback) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

function sanitizeHabits(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input.flatMap((h, i) => {
    if (!h || typeof h !== 'object') return [];
    const id = str(h.id) || uid();
    if (seen.has(id)) return [];
    seen.add(id);
    const sched = ['day', 'days', 'week', 'month', 'daily'].includes(h.sched) ? h.sched : 'day';
    const days = Array.isArray(h.days)
      ? h.days.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
      : [];
    return [{
      ...h,
      id,
      name: str(h.name).trim() || 'Ohne Namen',
      emoji: str(h.emoji, '⭐️'),
      color: str(h.color, 'indigo'),
      note: str(h.note),
      unit: str(h.unit, 'count'),
      unitLabel: str(h.unitLabel),
      target: posNum(h.target, 1),
      sched,
      days: days.length ? days : [1, 2, 3, 4, 5],
      created: /^\d{4}-\d{2}-\d{2}$/.test(h.created) ? h.created : today(),
      order: Number.isFinite(h.order) ? h.order : i,
    }];
  });
}

function sanitizeLists(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input.flatMap((l, i) => {
    if (!l || typeof l !== 'object') return [];
    const id = str(l.id) || uid();
    if (seen.has(id)) return [];
    seen.add(id);
    return [{
      ...l,
      id,
      name: str(l.name).trim() || 'Ohne Namen',
      emoji: str(l.emoji, '📋'),
      color: str(l.color, 'blue'),
      order: Number.isFinite(l.order) ? l.order : i,
    }];
  });
}

function sanitizeTodos(input, lists) {
  if (!Array.isArray(input)) return [];
  const listIds = new Set(lists.map(l => l.id));
  const seen = new Set();
  const cleaned = input.flatMap((t, i) => {
    if (!t || typeof t !== 'object') return [];
    const id = str(t.id) || uid();
    if (seen.has(id) || !listIds.has(t.listId)) return [];   // To-do ohne Liste ist verloren
    seen.add(id);
    return [{
      ...t,
      id,
      listId: t.listId,
      title: str(t.title).trim() || 'Ohne Namen',
      color: str(t.color),
      note: str(t.note),
      due: /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : '',
      done: !!t.done,
      doneAt: str(t.doneAt),
      parent: str(t.parent) || null,
      order: Number.isFinite(t.order) ? t.order : i,
    }];
  });

  // Elternverweise begradigen: auf sich selbst, ins Leere oder im Kreis
  const byId = new Map(cleaned.map(t => [t.id, t]));
  for (const t of cleaned) {
    if (!t.parent) continue;
    if (t.parent === t.id || !byId.has(t.parent)) { t.parent = null; continue; }
    if (byId.get(t.parent).listId !== t.listId) { t.parent = null; continue; }
    // Ring? Dann die Kette hier auftrennen.
    const seenChain = new Set([t.id]);
    let cur = byId.get(t.parent);
    while (cur) {
      if (seenChain.has(cur.id)) { t.parent = null; break; }
      seenChain.add(cur.id);
      cur = cur.parent ? byId.get(cur.parent) : null;
    }
  }
  return cleaned;
}

/* Ein Papierkorb-Eintrag hält alles beisammen, was zum Wiederherstellen nötig
   ist – bei einer Liste also auch ihre To-dos, bei einem Habit sein Verlauf.
   Kaputte Einträge fliegen raus statt die App zu beschädigen. */
function sanitizeTrash(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input.flatMap((e) => {
    if (!e || typeof e !== 'object') return [];
    if (!['habit', 'list', 'todo'].includes(e.kind)) return [];
    const id = str(e.id) || uid();
    if (seen.has(id)) return [];
    seen.add(id);
    const p = e.payload && typeof e.payload === 'object' ? e.payload : {};
    const plans = Array.isArray(p.plans) ? p.plans.filter(x => x && typeof x === 'object') : [];
    const payload =
      e.kind === 'habit' ? { habit: p.habit && typeof p.habit === 'object' ? p.habit : null,
                             log: p.log && typeof p.log === 'object' ? p.log : {}, plans }
      : e.kind === 'list' ? { list: p.list && typeof p.list === 'object' ? p.list : null,
                              todos: Array.isArray(p.todos) ? p.todos.filter(t => t && typeof t === 'object') : [],
                              plans }
      : { todos: Array.isArray(p.todos) ? p.todos.filter(t => t && typeof t === 'object') : [], plans };

    if (e.kind === 'habit' && !payload.habit) return [];
    if (e.kind === 'list' && !payload.list) return [];
    if (e.kind === 'todo' && !payload.todos.length) return [];

    return [{
      id,
      kind: e.kind,
      at: str(e.at) || new Date().toISOString(),
      title: str(e.title).trim() || 'Ohne Namen',
      emoji: str(e.emoji),
      color: str(e.color),
      detail: str(e.detail),
      payload,
    }];
  });
}

function sanitizeLog(input, habits) {
  if (!input || typeof input !== 'object') return {};
  const ids = new Set(habits.map(h => h.id));
  const out = {};
  for (const [habitId, entries] of Object.entries(input)) {
    if (!ids.has(habitId) || !entries || typeof entries !== 'object') continue;
    const clean = {};
    for (const [day, value] of Object.entries(entries)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const n = typeof value === 'number' ? value : parseFloat(value);
      if (Number.isFinite(n) && n > 0) clean[day] = Math.round(n * 100) / 100;
    }
    if (Object.keys(clean).length) out[habitId] = clean;
  }
  return out;
}

/**
 * Schema 3: Listen sind Ordner, keine Einträge.
 * Wer versehentlich To-dos als Listen angelegt hat, findet sie danach als
 * To-dos in „Free" wieder. Angefasst werden nur *leere* Listen – wo schon
 * To-dos drinstehen, war die Liste offensichtlich als Liste gemeint.
 * Läuft genau einmal, weil danach v === 3 gespeichert wird.
 */
function toSchema3(d) {
  const hasTodos = (listId) => d.todos.some(t => t.listId === listId);
  const empty = d.lists.filter(l => !hasTodos(l.id));

  if (empty.length) {
    let free = d.lists.find(l => l.name.trim().toLowerCase() === 'free');
    if (!free) {
      free = { id: uid(), name: 'Free', emoji: '🗂', color: 'indigo', order: -1 };
      d.lists.unshift(free);
    }
    // „Free" selbst wird nie zu einem To-do, auch wenn es leer ist.
    const toConvert = empty.filter(l => l.id !== free.id);
    let order = d.todos.filter(t => t.listId === free.id).length;
    for (const l of toConvert) {
      d.todos.push({
        id: uid(), listId: free.id,
        title: l.name, emoji: '', color: l.color || '', note: '', due: '',
        done: false, doneAt: '', parent: null, order: order++,
      });
    }
    const gone = new Set(toConvert.map(l => l.id));
    d.lists = d.lists.filter(l => !gone.has(l.id));
  }

  // To-dos tragen kein Emoji mehr.
  for (const t of d.todos) t.emoji = '';

  d.lists.forEach((l, i) => { l.order = i; });
  if (!d.lists.some(l => l.id === d.settings.lastListId)) {
    d.settings.lastListId = d.lists[0]?.id || '';
  }
}

/* ---------- Einstellungen ---------- */

export function settings() { return data.settings; }

export function setSetting(key, value) {
  data.settings[key] = value;
  save();
}

export function today() { return todayKey(data.settings.dayStart); }

/** Ist eine Häufigkeits-Gruppe aufgeklappt? Alles außer „Erledigt" beginnt offen. */
export function groupOpen(id) {
  const v = data.settings.groups?.[id];
  return v === undefined ? id !== 'done' : !!v;
}

export function setGroupOpen(id, open) {
  (data.settings.groups || (data.settings.groups = {}))[id] = open;
  save();
}

/** Zuletzt gewähltes Emoji nach vorne stellen (für die Verlaufszeile). */
export function rememberEmoji(emoji) {
  if (!emoji) return;
  const list = data.settings.recentEmoji || (data.settings.recentEmoji = []);
  const next = [emoji, ...list.filter(e => e !== emoji)].slice(0, 24);
  data.settings.recentEmoji = next;
  save();
}

export function recentEmoji() {
  return [...(data.settings.recentEmoji || [])];
}

/* ---------- Farben ---------- */

export function colorOf(id) {
  const key = COLOR_ALIASES[id] || id;
  return COLORS.find(c => c.id === key) || COLORS.find(c => c.id === 'indigo');
}

/**
 * Setzt `--tint` – die Objektfarbe selbst. Wie stark daraus getönt wird,
 * entscheidet allein das Stylesheet über `--tint-bg`, `--tint-edge` und
 * `--tint-chip`; die hängen an der Einstellung zur Sättigung. Früher rechnete
 * diese Funktion die blasse Variante selbst aus und hatte die Hintergrundfarbe
 * fest verdrahtet – damit ließ sich die Stärke nirgends mehr ändern.
 * Im dunklen Modus greift eine eigene Stufe, keine automatische Umkehr.
 */
export function tintStyle(colorId, isDark) {
  const c = colorOf(colorId);
  return `--tint:${isDark ? c.dark : c.light}`;
}

/* ---------- Habits ---------- */

export function habits() {
  return [...data.habits].sort((a, b) => a.order - b.order);
}

export function habit(id) {
  return data.habits.find(h => h.id === id) || null;
}

export function addHabit(fields) {
  const h = {
    id: uid(),
    name: 'Neues Habit',
    emoji: '⭐️',
    color: 'indigo',
    note: '',
    unit: 'count',
    unitLabel: '',
    target: 1,             // Anzahl pro Intervall
    sched: 'day',          // 'day' | 'days' | 'week' | 'month'
    days: [1, 2, 3, 4, 5], // nur bei sched === 'days'  (0 = Sonntag)
    created: today(),
    order: data.habits.length,
    ...fields,
  };
  data.habits.push(h);
  save();
  return h;
}

export function updateHabit(id, fields) {
  const h = habit(id);
  if (!h) return null;
  Object.assign(h, fields);
  save();
  return h;
}

/** Neue Reihenfolge nach dem Ziehen. `ids` ist die sichtbare Reihenfolge;
    Habits, die nicht darin vorkommen (andere Gruppe), behalten ihren Rang
    hinter den einsortierten. */
export function reorderHabits(ids) {
  ids.forEach((id, i) => {
    const h = habit(id);
    if (h) h.order = i;
  });
  const rest = data.habits.filter(h => !ids.includes(h.id)).sort((a, b) => a.order - b.order);
  rest.forEach((h, i) => { h.order = ids.length + i; });
  save();
}

export function deleteHabit(id) {
  const h = habit(id);
  if (!h) return;
  const log = data.log[id] || {};
  const days = Object.keys(log).length;
  const plans = plansFor('habit', id).map(p => ({ ...p }));
  toTrash({
    kind: 'habit', title: h.name, emoji: h.emoji, color: h.color,
    detail: days ? `${days} ${days === 1 ? 'erfasster Tag' : 'erfasste Tage'}` : 'ohne Verlauf',
    payload: { habit: { ...h }, log: { ...log }, plans },
  });
  data.habits = data.habits.filter(x => x.id !== id);
  delete data.log[id];
  data.plans = data.plans.filter(p => !(p.kind === 'habit' && p.refId === id));
  save();
}

/** Einheitenbezeichnung im Singular/Plural. */
export function unitWords(h) {
  if (h.unit === 'custom') {
    const w = (h.unitLabel || '').trim() || 'Einheiten';
    return { one: w, many: w };
  }
  const u = UNITS.find(x => x.id === h.unit) || UNITS[0];
  return { one: u.one, many: u.many };
}

/* ---------- Habit-Einträge ---------- */

export function valueOn(habitId, key) {
  return data.log[habitId]?.[key] || 0;
}

export function setValue(habitId, key, value) {
  const h = habit(habitId);
  if (!h) return 0;
  // Großzügig nach oben offen, damit Übererfüllung möglich bleibt.
  const v = clamp(Math.round(value * 100) / 100, 0, Math.max(1, h.target) * 1000);
  const entries = data.log[habitId] || (data.log[habitId] = {});
  if (v <= 0) delete entries[key];
  else entries[key] = v;
  // Leere Verläufe gleich abräumen: sonst bliebe ein {} im Speicher stehen,
  // das beim nächsten Laden verschwindet – Speichern und Laden wären ungleich.
  if (!Object.keys(entries).length) delete data.log[habitId];
  save();
  return v;
}

/** Ein Tipp: um einen Schritt hoch, am Ziel wieder auf null.
    Schrittweite ist 1, bei großen Zielen ein Zehntel (z. B. 60 Minuten -> 6). */
export function step(h) {
  return h.target > 20 ? Math.max(1, Math.round(h.target / 10)) : 1;
}

/**
 * Ein Tipp. Gezählt wird immer auf dem heutigen Tag; erfüllt wird gegen das
 * Intervall gerechnet. Ist das Intervallziel erreicht, nimmt der nächste Tipp
 * den heutigen Beitrag wieder zurück – das ist die Korrektur, die man in
 * diesem Moment will.
 */
export function bump(habitId, key) {
  const h = habit(habitId);
  if (!h) return 0;
  if (isDoneOn(h, key)) return setValue(habitId, key, 0);
  const cur = valueOn(habitId, key);
  const missing = h.target - progressIn(h, key);
  return setValue(habitId, key, cur + Math.min(step(h), Math.max(step(h), missing)));
}

/** Zählt einen Schritt zurück, ohne unter null zu gehen. */
export function unbump(habitId, key) {
  const h = habit(habitId);
  if (!h) return 0;
  return setValue(habitId, key, Math.max(0, valueOn(habitId, key) - step(h)));
}

/** Zählt über das Ziel hinaus weiter – „einmal mehr als geplant". */
export function bumpBeyond(habitId, key) {
  const h = habit(habitId);
  if (!h) return 0;
  return setValue(habitId, key, valueOn(habitId, key) + step(h));
}

/* ---------- Zeitplan und Intervalle ---------- */

/** Ist das Habit an diesem Tag überhaupt fällig? Nur „bestimmte Tage"
    schränkt ein; Wochen- und Monatsziele darf man an jedem Tag angehen. */
export function isActiveOn(h, key) {
  if (h.sched === 'days') return (h.days || []).includes(weekdayOf(key));
  return true;
}

/** Erster Tag des Intervalls, in dem `key` liegt. */
export function periodStart(h, key) {
  if (h.sched === 'week') return weekStart(key);
  if (h.sched === 'month') return monthStart(key);
  return key;
}

/** Alle Tage des Intervalls, in dem `key` liegt. */
export function periodDays(h, key) {
  if (h.sched === 'week') {
    const start = weekStart(key);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  if (h.sched === 'month') return monthDays(key);
  return [key];
}

/** Voriges Intervall (für die Streak-Berechnung). */
function prevPeriod(h, key) {
  if (h.sched === 'week') return addDays(weekStart(key), -7);
  if (h.sched === 'month') return addMonths(monthStart(key), -1);
  return addDays(key, -1);
}

/** Erreichter Wert im Intervall: bei Tageszielen der Tag selbst, sonst die
    Summe aller Tage der Woche bzw. des Monats. */
export function progressIn(h, key) {
  const entries = data.log[h.id];
  if (!entries) return 0;
  if (h.sched === 'week' || h.sched === 'month') {
    let sum = 0;
    for (const d of periodDays(h, key)) sum += entries[d] || 0;
    return Math.round(sum * 100) / 100;
  }
  return entries[key] || 0;
}

/** Ist das Ziel des Intervalls erreicht, in dem `key` liegt? */
export function isDoneOn(h, key) {
  return progressIn(h, key) >= h.target;
}

/** Zeigt die Liste das Habit an diesem Tag?
    Ein erfülltes Wochen- oder Monatsziel fällt für den Rest des Intervalls
    heraus – außer der Tag selbst hat dazu beigetragen, dann bleibt es
    sichtbar, damit man es korrigieren kann. */
export function showsOn(h, key) {
  if (!isActiveOn(h, key)) return false;
  if (h.sched === 'week' || h.sched === 'month') {
    if (isDoneOn(h, key) && !valueOn(h.id, key)) return false;
  }
  return true;
}

/* ---------- Statistik ---------- */

/** Aufeinanderfolgende erfüllte Intervalle bis heute.
    Tage-Habits überspringen nicht fällige Tage, ohne die Serie zu brechen.
    Das laufende Intervall zählt erst mit, wenn erfüllt, bricht sie aber
    auch nicht ab. */
export function currentStreak(h, ref = today()) {
  let n = 0;
  let key = ref;
  let guard = 0;

  if (!isDoneOn(h, key)) key = prevPeriod(h, key);

  while (guard++ < 4000) {
    if (h.sched === 'days' && !isActiveOn(h, key)) { key = prevPeriod(h, key); continue; }
    if (!isDoneOn(h, key)) break;
    n++;
    key = prevPeriod(h, key);
  }
  return n;
}

export function longestStreak(h, ref = today()) {
  const entries = data.log[h.id] || {};
  const keys = Object.keys(entries).sort();
  if (!keys.length) return 0;

  const start = keys[0];
  let best = 0, run = 0;
  let guard = 0;
  let key = periodStart(h, start);

  while (key <= ref && guard++ < 4000) {
    if (h.sched === 'days' && !isActiveOn(h, key)) {
      key = nextPeriod(h, key);
      continue;                    // freier Tag unterbricht die Serie nicht
    }
    if (isDoneOn(h, key)) { run++; best = Math.max(best, run); }
    else run = 0;
    key = nextPeriod(h, key);
  }
  return best;
}

function nextPeriod(h, key) {
  if (h.sched === 'week') return addDays(key, 7);
  if (h.sched === 'month') return addMonths(key, 1);
  return addDays(key, 1);
}

/** Erfüllte von fälligen Intervallen seit Anlage. */
export function completionRate(h, ref = today()) {
  const from = h.created && h.created <= ref ? h.created : ref;
  let due = 0, done = 0;
  let key = periodStart(h, from);
  let guard = 0;
  while (key <= ref && guard++ < 4000) {
    if (h.sched !== 'days' || isActiveOn(h, key)) {
      due++;
      if (isDoneOn(h, key)) done++;
    }
    key = nextPeriod(h, key);
  }
  return { due, done, pct: due ? Math.round((done / due) * 100) : 0 };
}

/** Wie viele Tage insgesamt erfasst wurden (für die Übersicht). */
export function totalDone(h) {
  return Object.keys(data.log[h.id] || {}).length;
}

/* ---------- Listen ---------- */

export function lists() {
  return [...data.lists].sort((a, b) => a.order - b.order);
}

export function list(id) {
  return data.lists.find(l => l.id === id) || null;
}

export function addList(fields) {
  const l = { id: uid(), name: 'Neue Liste', emoji: '📋', color: 'blue', order: data.lists.length, ...fields };
  data.lists.push(l);
  save();
  return l;
}

export function updateList(id, fields) {
  const l = list(id);
  if (!l) return null;
  Object.assign(l, fields);
  save();
  return l;
}

export function reorderLists(ids) {
  ids.forEach((id, i) => {
    const l = list(id);
    if (l) l.order = i;
  });
  save();
}

export function deleteList(id) {
  const l = list(id);
  if (!l) return;
  const mine = data.todos.filter(t => t.listId === id);
  const mineIds = new Set(mine.map(t => t.id));
  const plans = data.plans.filter(p => p.kind === 'todo' && mineIds.has(p.refId)).map(p => ({ ...p }));
  toTrash({
    kind: 'list', title: l.name, emoji: l.emoji, color: l.color,
    detail: mine.length ? `${mine.length} ${mine.length === 1 ? 'To-do' : 'To-dos'}` : 'leer',
    payload: { list: { ...l }, todos: mine.map(t => ({ ...t })), plans },
  });
  data.lists = data.lists.filter(x => x.id !== id);
  data.todos = data.todos.filter(t => t.listId !== id);
  data.plans = data.plans.filter(p => !(p.kind === 'todo' && mineIds.has(p.refId)));
  if (data.settings.lastListId === id) data.settings.lastListId = data.lists[0]?.id || '';
  save();
}

/* ---------- Todos ---------- */

/* Der Reiter „All" ist keine echte Liste, sondern eine Sicht auf alle. Die
   Kennung ist bewusst keine, die uid() je vergeben würde. list('__all') gibt
   deshalb null zurück – damit lässt sich diese Sicht nicht bearbeiten, nicht
   löschen und nichts direkt in sie hineinlegen, ohne dass jede Funktion es
   einzeln abfangen muss. */
export const ALL_LISTS = '__all';

export function todosOf(listId) {
  if (listId === ALL_LISTS) {
    // Liste für Liste, in der Reihenfolge der Listen – sonst stünde alles
    // durcheinander, weil `order` nur innerhalb einer Liste etwas bedeutet.
    const rang = new Map(lists().map((l, i) => [l.id, i]));
    return [...data.todos].sort((a, b) =>
      (rang.get(a.listId) ?? 1e9) - (rang.get(b.listId) ?? 1e9) || a.order - b.order);
  }
  return data.todos.filter(t => t.listId === listId).sort((a, b) => a.order - b.order);
}

export function todo(id) {
  return data.todos.find(t => t.id === id) || null;
}

export function childrenOf(id) {
  return data.todos.filter(t => t.parent === id).sort((a, b) => a.order - b.order);
}

/** Alle Nachfahren, beliebig tief.
    `seen` bricht Ringe ab: zeigt ein To-do (nach einem beschädigten Import)
    auf sich selbst oder im Kreis, liefe die Rekursion sonst bis zum Absturz. */
export function descendantsOf(id, acc = [], seen = new Set([id])) {
  for (const c of childrenOf(id)) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    acc.push(c);
    descendantsOf(c.id, acc, seen);
  }
  return acc;
}

/**
 * Alle ÜberTo-dos von unten nach oben.
 * Die einzige Stelle, die nach oben läuft – so ist der Schutz gegen
 * Ringverweise (nach einem beschädigten Import) nur einmal nötig statt an
 * jeder Aufrufstelle.
 */
export function ancestorsOf(id, limit = 8) {
  const out = [];
  const seen = new Set([id]);
  let cur = todo(id);
  while (cur?.parent && out.length < limit) {
    if (seen.has(cur.parent)) break;        // Ring – hier ist Schluss
    seen.add(cur.parent);
    cur = todo(cur.parent);
    if (!cur) break;
    out.push(cur);
  }
  return out;
}

export function depthOf(t) {
  return t ? ancestorsOf(t.id).length : 0;
}

export function addTodo(listId, fields) {
  const siblings = data.todos.filter(t => t.listId === listId);
  const t = {
    id: uid(),
    listId,
    title: '',
    color: '',
    note: '',
    due: '',
    done: false,
    doneAt: '',
    parent: null,
    order: siblings.length ? Math.max(...siblings.map(s => s.order)) + 1 : 0,
    ...fields,
  };
  data.todos.push(t);
  save();
  return t;
}

export function updateTodo(id, fields) {
  const t = todo(id);
  if (!t) return null;
  Object.assign(t, fields);
  save();
  return t;
}

export function deleteTodo(id) {
  const t = todo(id);
  if (!t) return;
  const kids = descendantsOf(id);
  const ids = new Set([id, ...kids.map(d => d.id)]);
  // Die Unter-To-dos kommen mit – sonst hinge die Hälfte beim Wiederherstellen
  // im Leeren. Die Reihenfolge bleibt erhalten, Eltern vor Kindern.
  const gone = data.todos.filter(x => ids.has(x.id)).map(x => ({ ...x }));
  const plans = data.plans.filter(p => p.kind === 'todo' && ids.has(p.refId)).map(p => ({ ...p }));
  toTrash({
    kind: 'todo', title: t.title, color: t.color,
    detail: kids.length ? `mit ${kids.length} ${kids.length === 1 ? 'Unter-To-do' : 'Unter-To-dos'}` : '',
    payload: { todos: gone, plans },
  });
  data.todos = data.todos.filter(x => !ids.has(x.id));
  data.plans = data.plans.filter(p => !(p.kind === 'todo' && ids.has(p.refId)));
  save();
}

/** Abhaken zieht die Unter-To-dos mit – wie in Apple Erinnerungen.
    Ein abgehaktes Unterelement hakt die ÜberTo-do ab, wenn es das letzte war. */
export function toggleTodo(id, force) {
  const t = todo(id);
  if (!t) return [];
  const done = force === undefined ? !t.done : force;
  const stamp = done ? new Date().toISOString() : '';

  /* Wer sich wirklich geändert hat, wird mitgeschrieben. Die Ansicht braucht
     das, um beim Abhaken nur die betroffenen Zeilen anzufassen statt die ganze
     Liste neu zu bauen. */
  const changed = [];
  const set = (x, value, when) => {
    if (x.done === value) return;
    x.done = value;
    x.doneAt = when;
    changed.push(x.id);
  };

  set(t, done, stamp);
  for (const d of descendantsOf(id)) set(d, done, stamp);

  // ÜberTo-dos nachziehen – von innen nach außen, ringsicher
  for (const parent of ancestorsOf(id)) {
    const kids = descendantsOf(parent.id);
    const allDone = kids.length > 0 && kids.every(k => k.done);
    if (allDone) set(parent, true, stamp);
    else if (!done) set(parent, false, '');
  }
  save();
  return changed;
}

/** Kann dieses To-do eine Ebene tiefer? Nur wenn ein Vorgänger auf gleicher
    Ebene existiert, der ihr Elternteil werden kann, und die Grenze hält. */
export function canIndent(id, maxDepth = 2) {
  const t = todo(id);
  if (!t) return false;
  const siblings = todosOf(t.listId).filter(x => (x.parent || null) === (t.parent || null));
  const at = siblings.findIndex(x => x.id === id);
  if (at <= 0) return false;                       // das erste Element hat keinen Vorgänger
  const deepest = Math.max(0, ...descendantsOf(id).map(d => depthOf(d) - depthOf(t)));
  return depthOf(t) + 1 + deepest <= maxDepth;
}

export function canOutdent(id) {
  const t = todo(id);
  return !!(t && t.parent);
}

/** Macht das To-do zum Unter-To-do seines Vorgängers. */
export function indentTodo(id, maxDepth = 2) {
  if (!canIndent(id, maxDepth)) return false;
  const t = todo(id);
  const siblings = todosOf(t.listId).filter(x => (x.parent || null) === (t.parent || null));
  const prev = siblings[siblings.findIndex(x => x.id === id) - 1];
  t.parent = prev.id;
  // Direkt hinter den bisherigen Kindern des neuen Elternteils einsortieren
  const last = childrenOf(prev.id).filter(c => c.id !== id).at(-1);
  t.order = (last ? last.order : prev.order) + 0.5;
  normalizeOrder(t.listId);
  save();
  return true;
}

/** Hebt das To-do eine Ebene an; nachfolgende Geschwister wandern zu ihr. */
export function outdentTodo(id) {
  if (!canOutdent(id)) return false;
  const t = todo(id);
  const parent = todo(t.parent);
  const after = childrenOf(parent.id).filter(c => c.order > t.order);
  t.parent = parent.parent || null;
  t.order = parent.order + 0.5;
  // Was unter dem alten Elternteil nach ihr kam, bleibt logisch bei ihr
  for (const sib of after) sib.parent = t.id;
  normalizeOrder(t.listId);
  save();
  return true;
}

/** Ränge wieder auf ganze Zahlen bringen, in sichtbarer Reihenfolge. */
function normalizeOrder(listId) {
  const all = todosOf(listId);
  const byParent = new Map();
  for (const t of all) {
    const key = t.parent || '__root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(t);
  }
  let n = 0;
  const walk = (key) => {
    for (const t of (byParent.get(key) || []).sort((a, b) => a.order - b.order)) {
      t.order = n++;
      walk(t.id);
    }
  };
  walk('__root');
}

/** Setzt Reihenfolge und Verschachtelung nach einem Zieh-Vorgang neu.
    `flat` ist die sichtbare Reihenfolge als [{id, parent}]. */
export function reorderTodos(listId, flat) {
  flat.forEach((entry, i) => {
    const t = todo(entry.id);
    if (t && t.listId === listId) { t.order = i; t.parent = entry.parent; }
  });
  save();
}

/* ---------- Überblick ---------- */

/**
 * Kennzahlen für die Startseite. Bewusst hier und nicht in der Ansicht, damit
 * Startseite, Listen-Reiter und Suche dieselben Zahlen zeigen.
 */
export function overview(ref = today()) {
  const habitsAll = habits();

  /* Fällig heißt hier „steht heute grundsätzlich an" (isActiveOn), nicht
     „wird noch angezeigt" (showsOn). Sonst schrumpft der Nenner, sobald ein
     Wochenziel erfüllt ist, und aus „1 von 3" würde „0 von 2". */
  const due = habitsAll.filter(h => isActiveOn(h, ref));
  const doneToday = due.filter(h => isDoneOn(h, ref));

  // Aufschlüsselung nach Intervall – auch Intervalle ohne heutige Fälligkeit,
  // damit sichtbar bleibt, wie viele Habits es überhaupt je Rhythmus gibt.
  const byInterval = INTERVALS.map(iv => {
    const mine = habitsAll.filter(h => h.sched === iv.id);
    const dueNow = mine.filter(h => isActiveOn(h, ref));
    return {
      id: iv.id,
      label: iv.label,
      per: iv.per,
      total: mine.length,
      due: dueNow.length,
      done: dueNow.filter(h => isDoneOn(h, ref)).length,
    };
  }).filter(g => g.total > 0);

  const all = data.todos;
  const openTodos = all.filter(t => !t.done);
  const withDue = openTodos.filter(t => t.due);
  const weekEnd = addDays(ref, 7);

  /* Die Körbe werden nach Datum sortiert, nicht nach Listenreihenfolge:
     bei „Überfällig" steht damit das Älteste oben, bei „Diese Woche" das
     Nächste. Gleiches Datum behält die Reihenfolge der Liste. */
  const byDue = (a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.order - b.order);
  const bucket = (fn) => withDue.filter(fn).sort(byDue);

  const overdue = bucket(t => t.due < ref);
  const todayDue = bucket(t => t.due === ref);
  const tomorrow = bucket(t => t.due === addDays(ref, 1));
  // „Diese Woche" meint die nächsten sieben Tage ohne heute und morgen.
  const thisWeek = bucket(t => t.due > addDays(ref, 1) && t.due <= weekEnd);

  const streaks = habitsAll
    .map(h => ({ habit: h, streak: currentStreak(h, ref) }))
    .filter(s => s.streak > 0)
    .sort((a, b) => b.streak - a.streak);

  return {
    habits: {
      due: due.length,
      done: doneToday.length,
      open: due.length - doneToday.length,
      total: habitsAll.length,
      pct: due.length ? Math.round((doneToday.length / due.length) * 100) : 0,
      byInterval,
      // Habits, die heute nicht dran sind (nur an bestimmten Wochentagen)
      resting: habitsAll.length - due.length,
    },
    todos: {
      total: all.length,
      open: openTodos.length,
      done: all.length - openTodos.length,
      overdue, today: todayDue, tomorrow, thisWeek,
      noDue: openTodos.filter(t => !t.due).length,
      later: withDue.filter(t => t.due > weekEnd).length,
      lists: lists().length,
    },
    streaks,
  };
}

/* ==========================================================================
   Planung
   Ein Plan-Eintrag legt fest, wann etwas getan werden soll – nicht, wann es
   fertig sein muss. Die Fälligkeit eines To-dos bleibt davon unberührt:
   „fällig Freitag, eingeplant Dienstag 14 Uhr" ist der Normalfall.

   Von allein erscheint nichts. Ein Eintrag entsteht nur durch Auswahl, und er
   gilt für einen Tag – es sei denn, er ist als `repeat` dauerhaft angelegt:

     Habit     an jedem Tag, an dem das Habit ohnehin dran ist (sein Rhythmus)
     To-do   an jedem Tag, bis sie abgehakt ist

   Beide beginnen am Tag des Eintrags; frühere Tage bleiben leer. Einzelne Tage
   lassen sich über `skip` aus einer Serie nehmen, ohne sie ganz zu löschen.
   ========================================================================== */

const MINUTES_MIN = 5;
const MINUTES_MAX = 24 * 60;

function sanitizePlans(input, habits, todos) {
  if (!Array.isArray(input)) return [];
  const habitIds = new Set(habits.map(h => h.id));
  const todoIds = new Set(todos.map(t => t.id));
  const seen = new Set();

  return input.flatMap((p) => {
    if (!p || typeof p !== 'object') return [];
    if (p.kind !== 'habit' && p.kind !== 'todo') return [];
    // Ein Eintrag ohne sein Ziel ist wertlos – Habit oder To-do ist weg.
    const known = p.kind === 'habit' ? habitIds : todoIds;
    if (!known.has(p.refId)) return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return [];

    const id = str(p.id) || uid();
    if (seen.has(id)) return [];
    seen.add(id);

    return [{
      id,
      kind: p.kind,
      refId: p.refId,
      date: p.date,
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(p.time) ? p.time : '09:00',
      minutes: clamp(Number.isFinite(p.minutes) ? Math.round(p.minutes) : 30, MINUTES_MIN, MINUTES_MAX),
      repeat: !!p.repeat,
      skip: Array.isArray(p.skip) ? p.skip.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [],
    }];
  });
}

/** Minuten seit Mitternacht – zum Sortieren und Platzieren. */
export function minutesOf(time) {
  const [h, m] = String(time).split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Minuten seit Mitternacht als "HH:MM". */
export function timeOf(minutes) {
  const m = clamp(Math.round(minutes), 0, 24 * 60 - 1);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Standarddauer für diese Art Eintrag, wie in den Einstellungen gewählt. */
export function defaultMinutes(kind) {
  const v = kind === 'habit' ? data.settings.planMinutesHabit : data.settings.planMinutesTodo;
  return clamp(Number.isFinite(v) ? v : 30, MINUTES_MIN, MINUTES_MAX);
}

export function plan(id) {
  return data.plans.find(p => p.id === id) || null;
}

export function addPlan({ kind, refId, date, time = '09:00', minutes, repeat = false }) {
  const p = {
    id: uid(),
    kind,
    refId,
    date,
    time,
    minutes: clamp(minutes ?? defaultMinutes(kind), MINUTES_MIN, MINUTES_MAX),
    repeat: !!repeat,
    skip: [],
  };
  data.plans.push(p);
  save();
  return p;
}

export function updatePlan(id, fields) {
  const p = plan(id);
  if (!p) return null;
  Object.assign(p, fields);
  if (fields.minutes !== undefined) p.minutes = clamp(Math.round(p.minutes), MINUTES_MIN, MINUTES_MAX);
  save();
  return p;
}

export function deletePlan(id) {
  const before = data.plans.length;
  data.plans = data.plans.filter(p => p.id !== id);
  if (data.plans.length !== before) save();
}

/** Nimmt einen einzelnen Tag aus einer Serie, ohne sie zu löschen. */
export function skipPlanOn(id, date) {
  const p = plan(id);
  if (!p) return;
  if (!p.repeat) { deletePlan(id); return; }
  if (p.date === date) {
    // Der erste Tag der Serie: Anfang nach vorn schieben, statt ihn zu merken.
    p.date = addDays(date, 1);
  } else if (!p.skip.includes(date)) {
    p.skip.push(date);
  }
  save();
}

/** Gilt dieser Eintrag an diesem Tag? */
function planAppliesOn(p, key) {
  if (p.date === key) return true;
  if (!p.repeat || key < p.date) return false;
  if (p.skip.includes(key)) return false;

  if (p.kind === 'habit') {
    const h = habit(p.refId);
    // Dem Rhythmus folgen: an einem freien Tag steht das Habit auch nicht im Plan.
    return !!h && isActiveOn(h, key);
  }
  const t = todo(p.refId);
  // Eine dauerhaft eingeplante To-do kommt täglich wieder, bis sie erledigt ist.
  return !!t && !t.done;
}

/**
 * Was an diesem Tag geplant ist, nach Uhrzeit sortiert.
 * Jeder Eintrag bringt sein Ziel gleich mit, damit die Ansicht nicht noch
 * einmal nachschlagen muss.
 * @returns {Array<{plan, kind, ref, title, emoji, color, start, end, done, dueNote}>}
 */
export function planOn(key) {
  const out = [];
  for (const p of data.plans) {
    if (!planAppliesOn(p, key)) continue;
    const ref = p.kind === 'habit' ? habit(p.refId) : todo(p.refId);
    if (!ref) continue;

    const start = minutesOf(p.time);
    out.push({
      plan: p,
      kind: p.kind,
      ref,
      title: p.kind === 'habit' ? ref.name : ref.title,
      emoji: p.kind === 'habit' ? ref.emoji : '',
      color: p.kind === 'habit' ? ref.color : (ref.color || list(ref.listId)?.color || ''),
      start,
      end: Math.min(24 * 60, start + p.minutes),
      done: p.kind === 'habit' ? isDoneOn(ref, key) : ref.done,
      // Hinweis, wenn ein To-do vor dem geplanten Tag fällig ist.
      dueNote: p.kind === 'todo' && ref.due && ref.due < key ? ref.due : '',
    });
  }
  return out.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title, 'de'));
}

/** Ist an diesem Tag etwas geplant? Für die Punkte im Kalender. */
export function hasPlanOn(key) {
  return data.plans.some(p => planAppliesOn(p, key));
}

/**
 * Tage des Monats mit Planung, als Menge von Tagesschlüsseln.
 * Ein Durchlauf über die Einträge je Tag wäre bei einer Serie über Jahre
 * unnötig teuer – der Kalender fragt einmal für den ganzen Monat.
 */
export function plannedDaysOfMonth(key) {
  const out = new Set();
  for (const d of monthDays(key)) if (hasPlanOn(d)) out.add(d);
  return out;
}

/** Alle Einträge zu einem Habit bzw. einem To-do – auch für den Papierkorb. */
export function plansFor(kind, refId) {
  return data.plans.filter(p => p.kind === kind && p.refId === refId);
}

/* Abgehakt wird im Plan mit demselben Knopf und derselben Wirkung wie in der
   Liste: bump/unbump beim Habit, toggleTodo beim To-do. Eine eigene
   Abhak-Logik für den Plan wäre genau die Art Abweichung, die sich später
   auseinanderentwickelt. Der Plan braucht dafür keine eigene Funktion. */

/* ==========================================================================
   Startseiten-Profile
   Die Startseite ist frei zusammengesetzt: eine Reihe Widgets in einem Profil.
   Mehrere Profile halten verschiedene Zusammenstellungen bereit („Alltag",
   „Wochenende"); umgeschaltet wird im Bearbeiten-Modus.

   Ein Widget ist absichtlich dünn beschrieben – Typ, Größe und, wo es eines
   braucht, ein Ziel. Was ein Typ bedeutet und wie er aussieht, weiß nur die
   Ansicht (js/widgets.js). Deshalb wird ein unbekannter Typ hier auch nicht
   verworfen: Eine Sicherung aus einer neueren Fassung würde sonst beim Laden
   stillschweigend Widgets verlieren.
   ========================================================================== */

const WIDGET_SIZES = ['small', 'wide', 'large'];
const PROFILE_MAX = 8;

function sanitizeWidgets(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input.flatMap((w) => {
    if (!w || typeof w !== 'object') return [];
    const type = str(w.type);
    if (!type) return [];
    const id = str(w.id) || uid();
    if (seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      type,
      size: WIDGET_SIZES.includes(w.size) ? w.size : 'wide',
      opts: w.opts && typeof w.opts === 'object' ? { ...w.opts } : {},
    }];
  });
}

function sanitizeProfiles(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = input.flatMap((p) => {
    if (!p || typeof p !== 'object') return [];
    const id = str(p.id) || uid();
    if (seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      name: str(p.name).trim() || 'Startseite',
      widgets: sanitizeWidgets(p.widgets),
    }];
  });
  return out.slice(0, PROFILE_MAX);
}

/** Die Zusammenstellung, mit der eine leere App anfängt. */
function defaultProfile() {
  return {
    id: uid(),
    name: 'Startseite',
    widgets: [
      { id: uid(), type: 'habitsToday', size: 'large', opts: {} },
      { id: uid(), type: 'planToday', size: 'large', opts: {} },
      { id: uid(), type: 'todoOverdue', size: 'wide', opts: {} },
      { id: uid(), type: 'todoStock', size: 'wide', opts: {} },
      { id: uid(), type: 'habitStreaks', size: 'wide', opts: {} },
    ],
  };
}

export function homeProfiles() {
  return data.homeProfiles;
}

/** Das aktive Profil – es gibt immer eines. Fehlt jedes, entsteht hier wieder
    das vorgegebene: Eine leere Startseite ohne Ausweg wäre schlimmer als eine
    Anordnung, die der Benutzer nicht selbst gewählt hat. */
export function homeProfile() {
  if (!data.homeProfiles.length) data.homeProfiles = [defaultProfile()];
  return data.homeProfiles.find(p => p.id === data.settings.homeProfileId) || data.homeProfiles[0];
}

export function setHomeProfile(id) {
  if (!data.homeProfiles.some(p => p.id === id)) return false;
  data.settings.homeProfileId = id;
  save();
  return true;
}

export function addProfile(name) {
  if (data.homeProfiles.length >= PROFILE_MAX) return null;
  const p = { id: uid(), name: str(name).trim() || 'Neues Profil', widgets: [] };
  data.homeProfiles.push(p);
  data.settings.homeProfileId = p.id;
  save();
  return p;
}

export function duplicateProfile(id) {
  const quelle = data.homeProfiles.find(p => p.id === id);
  if (!quelle || data.homeProfiles.length >= PROFILE_MAX) return null;
  const p = {
    id: uid(),
    name: `${quelle.name} (Kopie)`,
    widgets: quelle.widgets.map(w => ({ ...w, id: uid(), opts: { ...w.opts } })),
  };
  data.homeProfiles.push(p);
  data.settings.homeProfileId = p.id;
  save();
  return p;
}

export function renameProfile(id, name) {
  const p = data.homeProfiles.find(x => x.id === id);
  if (!p) return false;
  p.name = str(name).trim() || p.name;
  save();
  return true;
}

/** Löscht ein Profil. Das letzte bleibt stehen – ohne Profil keine Startseite. */
export function deleteProfile(id) {
  if (data.homeProfiles.length <= 1) return false;
  data.homeProfiles = data.homeProfiles.filter(p => p.id !== id);
  if (data.settings.homeProfileId === id) data.settings.homeProfileId = data.homeProfiles[0].id;
  save();
  return true;
}

/** Übernimmt eine im Bearbeiten-Modus zusammengestellte Anordnung. */
export function setWidgets(profileId, widgets) {
  const p = data.homeProfiles.find(x => x.id === profileId);
  if (!p) return false;
  p.widgets = sanitizeWidgets(widgets);
  save();
  return true;
}

/** Entfernt Widgets, deren Ziel es nicht mehr gibt – ein gelöschtes Habit
    hinterlässt sonst ein Widget, das nichts anzeigen kann. */
function pruneWidgetTargets(d) {
  const habitIds = new Set(d.habits.map(h => h.id));
  const listIds = new Set(d.lists.map(l => l.id));
  for (const p of d.homeProfiles) {
    p.widgets = p.widgets.filter((w) => {
      if (w.opts.habitId) return habitIds.has(w.opts.habitId);
      if (w.opts.listId) return listIds.has(w.opts.listId);
      return true;
    });
  }
}

/* ==========================================================================
   Papierkorb
   Löschen ist nicht mehr endgültig: Was gelöscht wird, landet hier mit allem,
   was zum Wiederherstellen nötig ist, und verschwindet erst nach TRASH_DAYS.
   Beim Wiederherstellen kann sich die Welt verändert haben – die Liste einer
   To-do kann fehlen, eine Kennung schon wieder vergeben sein. Das wird
   aufgelöst statt abgelehnt, und die Meldung sagt, was angepasst wurde.
   ========================================================================== */

function daysSince(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / 86400000;
}

/** Abgelaufene Einträge entfernen und die Menge begrenzen. */
export function pruneTrash() {
  const before = data.trash.length;
  data.trash = data.trash
    .filter(e => daysSince(e.at) <= TRASH_DAYS)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, TRASH_MAX);
  return before - data.trash.length;
}

function toTrash(entry) {
  data.trash.unshift({ id: uid(), at: new Date().toISOString(), emoji: '', color: '', detail: '', ...entry });
  pruneTrash();
}

/** Alle Einträge, neueste zuerst. */
export function trash() {
  return [...data.trash].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function trashCount() { return data.trash.length; }

/** Wie viele Tage der Eintrag noch bleibt. */
export function trashDaysLeft(entry) {
  return Math.max(0, Math.ceil(TRASH_DAYS - daysSince(entry.at)));
}

export function purgeTrash(entryId) {
  const before = data.trash.length;
  data.trash = data.trash.filter(e => e.id !== entryId);
  if (data.trash.length !== before) save();
  return before !== data.trash.length;
}

export function emptyTrash() {
  if (!data.trash.length) return 0;
  const n = data.trash.length;
  data.trash = [];
  save();
  return n;
}

/**
 * Stellt einen Eintrag wieder her und entfernt ihn aus dem Papierkorb.
 * @returns {{ok: boolean, kind?: string, title?: string, note: string}}
 *   `note` nennt, was beim Wiederherstellen angepasst werden musste.
 */
export function restoreTrash(entryId) {
  const at = data.trash.findIndex(e => e.id === entryId);
  if (at < 0) return { ok: false, note: 'Der Eintrag ist nicht mehr da.' };
  const e = data.trash[at];

  const note = e.kind === 'habit' ? restoreHabit(e.payload)
    : e.kind === 'list' ? restoreList(e.payload)
    : restoreTodos(e.payload);

  data.trash.splice(at, 1);
  save();
  return { ok: true, kind: e.kind, title: e.title, note };
}

function restoreHabit({ habit: h, log, plans = [] }) {
  const taken = new Set(data.habits.map(x => x.id));
  const id = taken.has(h.id) ? uid() : h.id;
  const nextOrder = data.habits.length ? Math.max(...data.habits.map(x => x.order ?? 0)) + 1 : 0;
  data.habits.push({ ...h, id, order: nextOrder });
  const entries = sanitizeLog({ [id]: log }, [{ id }]);
  if (entries[id]) data.log[id] = { ...(data.log[id] || {}), ...entries[id] };
  data.habits = sanitizeHabits(data.habits);
  putPlansBack(plans, new Map([[h.id, id]]));
  return id === h.id ? '' : 'Die Kennung war vergeben, das Habit hat eine neue bekommen.';
}

function restoreList({ list: l, todos, plans = [] }) {
  const taken = new Set(data.lists.map(x => x.id));
  const listId = taken.has(l.id) ? uid() : l.id;
  const nextOrder = data.lists.length ? Math.max(...data.lists.map(x => x.order ?? 0)) + 1 : 0;
  data.lists.push({ ...l, id: listId, order: nextOrder });
  data.lists = sanitizeLists(data.lists);
  const { renamed, remap } = putTodosBack(todos, listId);
  putPlansBack(plans, remap);
  return listId === l.id
    ? (renamed ? 'Einzelne Kennungen waren vergeben und wurden neu gesetzt.' : '')
    : 'Die Kennung war vergeben, die Liste hat eine neue bekommen.';
}

function restoreTodos({ todos, plans = [] }) {
  const wanted = todos[0]?.listId;
  const notes = [];
  let listId = wanted;

  if (!data.lists.some(l => l.id === wanted)) {
    const fallback = data.lists[0];
    if (fallback) {
      listId = fallback.id;
      notes.push(`Die ursprüngliche Liste gibt es nicht mehr – eingefügt in „${fallback.name}".`);
    } else {
      const fresh = addList({ name: 'Wiederhergestellt', emoji: '♻️', color: 'slate' });
      listId = fresh.id;
      notes.push('Es gab keine Liste mehr – „Wiederhergestellt" wurde angelegt.');
    }
  }

  const { renamed, remap } = putTodosBack(todos, listId);
  putPlansBack(plans, remap);
  if (renamed) notes.push('Einzelne Kennungen waren vergeben und wurden neu gesetzt.');
  return notes.join(' ');
}

/**
 * Legt die Planung wieder an, die mit dem gelöschten Objekt weggefallen ist.
 * `remap` bildet alte auf neue Kennungen ab – ohne das zeigten die Einträge
 * ins Leere, sobald beim Wiederherstellen eine Kennung neu vergeben wurde.
 */
function putPlansBack(plans, remap) {
  if (!plans?.length) return;
  const taken = new Set(data.plans.map(p => p.id));
  for (const p of plans) {
    const refId = remap.get(p.refId) ?? p.refId;
    data.plans.push({ ...p, id: taken.has(p.id) ? uid() : p.id, refId });
    taken.add(p.id);
  }
  data.plans = sanitizePlans(data.plans, data.habits, data.todos);
}

/**
 * Legt To-dos zurück in eine Liste. Kennungen, die es schon gibt, werden neu
 * vergeben – und die Eltern-Verweise innerhalb der Gruppe ziehen mit um.
 * Zeigt ein Verweis nach außen, wird das To-do ausgerückt statt ins Leere zu
 * hängen.
 * @returns {{renamed: boolean, remap: Map<string,string>}} ob Kennungen neu
 *   vergeben werden mussten, und die Zuordnung alt → neu (die Planung hängt
 *   daran und würde sonst ins Leere zeigen)
 */
function putTodosBack(todos, listId) {
  const taken = new Set(data.todos.map(t => t.id));
  const remap = new Map();
  let renamed = false;

  for (const t of todos) {
    const id = taken.has(t.id) ? uid() : t.id;
    if (id !== t.id) renamed = true;
    taken.add(id);
    remap.set(t.id, id);
  }

  const group = new Set(todos.map(t => t.id));
  let order = data.todos.filter(t => t.listId === listId).length
    ? Math.max(...data.todos.filter(t => t.listId === listId).map(t => t.order ?? 0)) + 1
    : 0;

  for (const t of todos) {
    const parent = t.parent && group.has(t.parent)
      ? remap.get(t.parent)                                   // Verweis innerhalb der Gruppe
      : (t.parent && data.todos.some(x => x.id === t.parent && x.listId === listId) ? t.parent : null);
    data.todos.push({ ...t, id: remap.get(t.id), listId, parent, order: order++ });
  }

  data.todos = sanitizeTodos(data.todos, data.lists);
  normalizeOrder(listId);
  return { renamed, remap };
}

/* ---------- Suche ---------- */

function foldText(text) {
  return String(text).toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
}

/**
 * Editierabstand zwischen `word` und dem *Anfang* von `hay` – gerechnet wird
 * bis zum besten Vorsilbe-Treffer, nicht bis zum Wortende. Nur so findet
 * „Vitmin" noch „Vitamine": zwei fehlende Buchstaben am Ende zählen sonst mit
 * und sprengen jede vernünftige Toleranz.
 *
 * Bricht ab, sobald die Grenze in einer ganzen Reihe überschritten ist.
 * @returns {number} Abstand, oder `max + 1`, wenn er darüber liegt
 */
function prefixDistance(word, hay, max) {
  if (hay.startsWith(word)) return 0;
  if (word.length - hay.length > max) return max + 1;

  let prev = Array.from({ length: hay.length + 1 }, (_, j) => j);
  let cur = new Array(hay.length + 1);

  for (let i = 1; i <= word.length; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= hay.length; j++) {
      const cost = word[i - 1] === hay[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;      // wird nicht mehr besser
    [prev, cur] = [cur, prev];
  }
  return Math.min(...prev);                 // bester Vorsilbe-Treffer
}

/** Wie viele Tippfehler ein Wort dieser Länge haben darf. */
function tolerance(len) {
  if (len < 4) return 0;                    // zu kurz – sonst passt alles auf alles
  return len >= 7 ? 2 : 1;
}

/**
 * Bewertet, wie gut ein Suchwort in einem Text steckt.
 * @returns {number} 0 bei wörtlichem Treffer, sonst die Zahl der Tippfehler,
 *   oder -1, wenn es gar nicht passt.
 */
function wordScore(word, hay, hayWords) {
  if (hay.includes(word)) return 0;
  const max = tolerance(word.length);
  if (!max) return -1;

  let best = max + 1;
  for (const w of hayWords) {
    const d = prefixDistance(word, w, max);
    if (d < best) best = d;
    if (best <= 1) break;                   // besser wird es praktisch nicht
  }
  return best <= max ? best : -1;
}

/**
 * Findet die Stelle im Text, die den Suchbegriff getroffen hat – wörtlich oder
 * als ähnlich geschriebenes Wort. Die Ansicht hebt genau diese Stelle hervor.
 * @returns {{at: number, len: number}|null}
 */
export function matchSpan(text, query) {
  const raw = String(text);
  const hay = foldText(raw);
  const word = foldText(query).trim().split(/\s+/)[0] || '';
  if (word.length < 2) return null;

  const at = hay.indexOf(word);
  if (at >= 0) return { at, len: word.length };

  const max = tolerance(word.length);
  if (!max) return null;

  // Das ähnlichste Wort im Text ganz markieren – eine Teilmarkierung mitten im
  // Tippfehler wäre nur verwirrend.
  let best = null;
  for (const m of hay.matchAll(/[\p{L}\p{N}]+/gu)) {
    const d = prefixDistance(word, m[0], max);
    if (d <= max && (!best || d < best.d)) best = { d, at: m.index, len: m[0].length };
    if (best?.d === 0) break;
  }
  return best ? { at: best.at, len: best.len } : null;
}

/**
 * Freie Suche über alles. Jeder Bereich liefert Treffer in derselben Form
 * `{ kind, id, title, subtitle, emoji, color }` – ein neuer Bereich braucht
 * hier nur einen weiteren Block, die Ansicht bleibt unverändert.
 */
export function search(query, { settingsEntries = [] } = {}) {
  const q = foldText(query).trim();
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter(Boolean);

  /* Jedes Suchwort muss vorkommen – wörtlich oder mit ein paar Tippfehlern.
     Zurück kommt die Summe der Tippfehler: 0 heißt wörtlich getroffen. Danach
     wird sortiert, damit ein exakter Treffer nie hinter einem geratenen steht.
     Nicht getroffen ist -1 und beendet die Prüfung sofort. */
  const matches = (...fields) => {
    const text = fields.filter(Boolean).join(' ');
    const hay = foldText(text);
    let hayWords = null;          // erst zerlegen, wenn wörtlich nichts passt
    let score = 0;
    for (const w of words) {
      if (hay.includes(w)) continue;
      if (!hayWords) hayWords = hay.match(/[\p{L}\p{N}]+/gu)?.slice(0, 40) || [];
      const s = wordScore(w, hay, hayWords);
      if (s < 0) return -1;
      score += s;
    }
    return score;
  };

  const out = [];

  for (const h of habits()) {
    const score = matches(h.name, unitWords(h).many);
    if (score < 0) continue;
    const iv = intervalOf(h);
    out.push({
      kind: 'habit', id: h.id, score, title: h.name, emoji: h.emoji, color: h.color,
      subtitle: `Habit · ${num(h.target)} ${unitWords(h).many} ${iv.per}`,
    });
  }

  for (const l of lists()) {
    const score = matches(l.name);
    if (score < 0) continue;
    const open = todosOf(l.id).filter(t => !t.done).length;
    out.push({
      kind: 'list', id: l.id, score, title: l.name, emoji: l.emoji, color: l.color,
      subtitle: `Liste · ${open} offen`,
    });
  }

  for (const t of data.todos) {
    const score = matches(t.title, t.note);
    if (score < 0) continue;
    const l = list(t.listId);
    out.push({
      kind: 'todo', id: t.id, listId: t.listId, score, title: t.title, color: t.color || l?.color,
      subtitle: `To-do in ${l?.name || '?'}${t.done ? ' · erledigt' : ''}`,
      done: t.done,
    });
  }

  for (const e of settingsEntries) {
    const score = matches(e.title, e.keywords);
    if (score < 0) continue;
    out.push({ kind: 'setting', id: e.id, score, title: e.title, subtitle: `Einstellung · ${e.group}` });
  }

  // Wörtliche Treffer zuerst, danach die mit den wenigsten Tippfehlern. Bei
  // gleicher Bewertung bleibt die Reihenfolge der Bereiche erhalten.
  return out.map((hit, i) => ({ hit, i }))
    .sort((a, b) => a.hit.score - b.hit.score || a.i - b.i)
    .map(x => x.hit);
}

function num(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/* ---------- Backup ---------- */

export function exportJSON() {
  return JSON.stringify({ app: 'planer', exported: new Date().toISOString(), ...data }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('Datei enthält keine Planer-Daten.');
  if (!('habits' in parsed) && !('todos' in parsed)) throw new Error('Datei enthält keine Planer-Daten.');
  data = migrate(parsed);
  save();
  flush();
  return data;
}

export function resetAll() {
  data = emptyData();
  save();
  flush();
}

/* Für die Tests: erlaubt das Einsetzen eines Zustands ohne localStorage. */
export function _setData(d) { data = migrate(d); }
