/* Datenhaltung. Alles liegt in localStorage auf diesem Gerät – nichts verlässt
   das Telefon. Jede Mutation geht durch save(), damit nichts verloren geht. */

import { uid, todayKey, addDays, addMonths, weekdayOf, weekStart, monthStart, monthDays, clamp } from './util.js';

const KEY = 'planer.v1';
const SCHEMA = 4;

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
  lastListId: '',       // Liste, die der Todos-Reiter direkt öffnet
  groups: {},           // Häufigkeits-Gruppen: id -> aufgeklappt (true/false)
  recentEmoji: [],      // zuletzt gewählte Emojis, neuestes zuerst
};

function emptyData() {
  return { v: SCHEMA, settings: { ...DEFAULTS }, habits: [], log: {}, lists: [], todos: [] };
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
      if (fromVersion < SCHEMA) {
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
  if (!s) return false;
  try {
    s.setItem(KEY, JSON.stringify(data));
    dirty = false;
    return true;
  } catch (err) {
    console.error('Speichern fehlgeschlagen', err);
    return false;
  }
}

export function isDirty() { return dirty; }

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getData() { return data; }

function migrate(d) {
  if (!d || typeof d !== 'object') return emptyData();
  const out = { ...emptyData(), ...d };
  out.settings = { ...DEFAULTS, ...(d.settings || {}) };
  out.settings.groups = { ...(d.settings?.groups || {}) };
  out.habits = Array.isArray(d.habits) ? d.habits : [];
  out.lists = Array.isArray(d.lists) ? d.lists : [];
  out.todos = Array.isArray(d.todos) ? d.todos : [];
  out.log = d.log && typeof d.log === 'object' ? d.log : {};

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

/**
 * Schema 3: Listen sind Ordner, keine Einträge.
 * Wer versehentlich Aufgaben als Listen angelegt hat, findet sie danach als
 * Aufgaben in „Free" wieder. Angefasst werden nur *leere* Listen – wo schon
 * Aufgaben drinstehen, war die Liste offensichtlich als Liste gemeint.
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
    // „Free" selbst wird nie zu einer Aufgabe, auch wenn sie leer ist.
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

  // Aufgaben tragen kein Emoji mehr.
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

/** CSS-Variablen für eine Zeile/Karte in der Objektfarbe.
    --tint      = die Farbe selbst (für Ringe, Balken, Zellen)
    --tint-soft = sehr blasse Variante als Emoji-Hintergrund
    Im dunklen Modus greift eine eigene Stufe, keine automatische Umkehr. */
export function tintStyle(colorId, isDark) {
  const c = colorOf(colorId);
  const base = isDark ? c.dark : c.light;
  const soft = isDark
    ? `color-mix(in oklab, ${base} 20%, #1a1a1e)`
    : `color-mix(in oklab, ${base} 12%, #ffffff)`;
  return `--tint:${base};--tint-soft:${soft}`;
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
  data.habits = data.habits.filter(h => h.id !== id);
  delete data.log[id];
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
  data.lists = data.lists.filter(l => l.id !== id);
  data.todos = data.todos.filter(t => t.listId !== id);
  if (data.settings.lastListId === id) data.settings.lastListId = data.lists[0]?.id || '';
  save();
}

/* ---------- Todos ---------- */

export function todosOf(listId) {
  return data.todos.filter(t => t.listId === listId).sort((a, b) => a.order - b.order);
}

export function todo(id) {
  return data.todos.find(t => t.id === id) || null;
}

export function childrenOf(id) {
  return data.todos.filter(t => t.parent === id).sort((a, b) => a.order - b.order);
}

/** Alle Nachfahren, beliebig tief. */
export function descendantsOf(id, acc = []) {
  for (const c of childrenOf(id)) { acc.push(c); descendantsOf(c.id, acc); }
  return acc;
}

export function depthOf(t) {
  let d = 0, cur = t;
  while (cur?.parent && d < 8) { cur = todo(cur.parent); d++; }
  return d;
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
  const ids = new Set([id, ...descendantsOf(id).map(d => d.id)]);
  data.todos = data.todos.filter(t => !ids.has(t.id));
  save();
}

/** Abhaken zieht die Unteraufgaben mit – wie in Apple Erinnerungen.
    Ein abgehaktes Unterelement hakt die Überaufgabe ab, wenn es das letzte war. */
export function toggleTodo(id, force) {
  const t = todo(id);
  if (!t) return;
  const done = force === undefined ? !t.done : force;
  const stamp = done ? new Date().toISOString() : '';
  t.done = done;
  t.doneAt = stamp;
  for (const d of descendantsOf(id)) { d.done = done; d.doneAt = stamp; }

  // Überaufgaben nachziehen
  let parent = t.parent ? todo(t.parent) : null;
  while (parent) {
    const kids = descendantsOf(parent.id);
    const allDone = kids.length > 0 && kids.every(k => k.done);
    if (allDone && !parent.done) { parent.done = true; parent.doneAt = stamp; }
    else if (!done && parent.done) { parent.done = false; parent.doneAt = ''; }
    parent = parent.parent ? todo(parent.parent) : null;
  }
  save();
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
