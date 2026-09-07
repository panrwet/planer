/* Datenhaltung. Alles liegt in localStorage auf diesem Gerät – nichts verlässt
   das Telefon. Jede Mutation geht durch save(), damit nichts verloren geht. */

import { uid, todayKey, addDays, weekdayOf, weekStart, daysBetween, clamp } from './util.js';

const KEY = 'planer.v1';
const SCHEMA = 2;

/* Auswahlfarben. Helligkeit, Sättigung und Kontrast gegen beide Untergründe
   sind geprüft; die Farbe ist nie das einzige Erkennungsmerkmal – Emoji und
   Name stehen immer daneben. */
export const COLORS = [
  { id: 'red',    name: 'Rot',     light: '#e5484d', dark: '#ff6369' },
  { id: 'orange', name: 'Orange',  light: '#e86a10', dark: '#ff8b3e' },
  { id: 'gold',   name: 'Gold',    light: '#b58100', dark: '#e0a516' },
  { id: 'green',  name: 'Grün',    light: '#3e9b4f', dark: '#4cc38a' },
  { id: 'teal',   name: 'Türkis',  light: '#0e9ba8', dark: '#0ec0d0' },
  { id: 'blue',   name: 'Blau',    light: '#2c7be5', dark: '#5aa2ff' },
  { id: 'indigo', name: 'Indigo',  light: '#5751d4', dark: '#9b96f5' },
  { id: 'purple', name: 'Violett', light: '#8e4ec6', dark: '#b57ce5' },
  { id: 'pink',   name: 'Pink',    light: '#db3a81', dark: '#ff7cb3' },
  { id: 'slate',  name: 'Grau',    light: '#6b7280', dark: '#9ba1ad' },
];

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
};

function emptyData() {
  return { v: SCHEMA, settings: { ...DEFAULTS }, habits: [], log: {}, lists: [], todos: [] };
}

/* ---------- Persistenz ---------- */

let data = emptyData();
let writeTimer = null;
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
    if (raw) data = migrate(JSON.parse(raw));
  } catch (err) {
    console.warn('Gespeicherte Daten unlesbar, starte leer.', err);
  }
  return data;
}

/** Gebündeltes Schreiben: viele schnelle Taps erzeugen nur einen Write. */
function save() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, 120);
  for (const fn of listeners) fn(data);
}

export function flush() {
  clearTimeout(writeTimer);
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('Speichern fehlgeschlagen', err);
    return false;
  }
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getData() { return data; }

function migrate(d) {
  if (!d || typeof d !== 'object') return emptyData();
  const out = { ...emptyData(), ...d };
  out.settings = { ...DEFAULTS, ...(d.settings || {}) };
  out.habits = Array.isArray(d.habits) ? d.habits : [];
  out.lists = Array.isArray(d.lists) ? d.lists : [];
  out.todos = Array.isArray(d.todos) ? d.todos : [];
  out.log = d.log && typeof d.log === 'object' ? d.log : {};
  out.v = SCHEMA;
  return out;
}

/* ---------- Einstellungen ---------- */

export function settings() { return data.settings; }

export function setSetting(key, value) {
  data.settings[key] = value;
  save();
}

export function today() { return todayKey(data.settings.dayStart); }

/* ---------- Farben ---------- */

export function colorOf(id) {
  return COLORS.find(c => c.id === id) || COLORS[6];
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
    unit: 'count',
    unitLabel: '',
    target: 1,
    sched: 'daily',        // 'daily' | 'days' | 'week'
    days: [1, 2, 3, 4, 5], // nur bei sched === 'days'  (0 = Sonntag)
    weekTarget: 3,         // nur bei sched === 'week'
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
  const v = clamp(Math.round(value * 100) / 100, 0, h.target * 100);
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

export function bump(habitId, key) {
  const h = habit(habitId);
  if (!h) return 0;
  const cur = valueOn(habitId, key);
  if (cur >= h.target) return setValue(habitId, key, 0);
  return setValue(habitId, key, Math.min(h.target, cur + step(h)));
}

export function unbump(habitId, key) {
  const h = habit(habitId);
  if (!h) return 0;
  const cur = valueOn(habitId, key);
  if (cur >= h.target) return setValue(habitId, key, Math.max(0, h.target - step(h)));
  return setValue(habitId, key, Math.max(0, cur - step(h)));
}

export function isDoneOn(h, key) {
  return valueOn(h.id, key) >= h.target;
}

/* ---------- Zeitplan ---------- */

/** Ist das Habit an diesem Tag überhaupt fällig? */
export function isActiveOn(h, key) {
  if (h.sched === 'days') return (h.days || []).includes(weekdayOf(key));
  return true; // 'daily' und 'week' gelten an jedem Tag
}

/** Erfüllte Tage in der Woche, in der `key` liegt (nur für sched 'week'). */
export function weekCount(h, key) {
  const start = weekStart(key);
  let n = 0;
  for (let i = 0; i < 7; i++) if (isDoneOn(h, addDays(start, i))) n++;
  return n;
}

/** Zeigt die Liste das Habit heute? Ein Wochenziel-Habit fällt für den Rest
    der Woche heraus, sobald es erreicht ist. */
export function showsOn(h, key) {
  if (!isActiveOn(h, key)) return false;
  if (h.sched === 'week' && !isDoneOn(h, key) && weekCount(h, key) >= h.weekTarget) return false;
  return true;
}

/* ---------- Statistik ---------- */

/** Aktuelle Streak.
    Tage-Habits: aufeinanderfolgende *fällige* Tage – ein freier Dienstag
    unterbricht ein Mo/Mi/Fr-Habit nicht.
    Wochen-Habits: aufeinanderfolgende Wochen mit erreichtem Wochenziel.
    Der laufende Tag bzw. die laufende Woche zählt erst mit, wenn erfüllt,
    bricht die Streak aber auch nicht. */
export function currentStreak(h, ref = today()) {
  if (h.sched === 'week') {
    let n = 0;
    let w = weekStart(ref);
    if (weekCount(h, w) >= h.weekTarget) { n++; }
    w = addDays(w, -7);
    while (weekCount(h, w) >= h.weekTarget) { n++; w = addDays(w, -7); }
    return n;
  }
  let n = 0;
  let key = ref;
  let guard = 0;
  // Heute darf noch offen sein, ohne die Streak zu beenden.
  if (isActiveOn(h, key) && !isDoneOn(h, key)) key = addDays(key, -1);
  while (guard++ < 3660) {
    if (!isActiveOn(h, key)) { key = addDays(key, -1); continue; }
    if (!isDoneOn(h, key)) break;
    n++;
    key = addDays(key, -1);
  }
  return n;
}

export function longestStreak(h) {
  const keys = Object.keys(data.log[h.id] || {}).filter(k => isDoneOn(h, k)).sort();
  if (!keys.length) return 0;

  if (h.sched === 'week') {
    const weeks = [...new Set(keys.map(weekStart))].filter(w => weekCount(h, w) >= h.weekTarget).sort();
    let best = 0, run = 0, prev = null;
    for (const w of weeks) {
      run = prev && daysBetween(prev, w) === 7 ? run + 1 : 1;
      prev = w;
      best = Math.max(best, run);
    }
    return best;
  }

  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    if (prev) {
      // Nur fällige Tage zwischen prev und k müssen erfüllt sein.
      let gapOk = true;
      for (let d = addDays(prev, 1); d < k; d = addDays(d, 1)) {
        if (isActiveOn(h, d)) { gapOk = false; break; }
      }
      run = gapOk ? run + 1 : 1;
    } else {
      run = 1;
    }
    prev = k;
    best = Math.max(best, run);
  }
  return best;
}

/** Erfüllte von fälligen Tagen seit Anlage bis heute. */
export function completionRate(h, ref = today()) {
  const start = h.created && h.created <= ref ? h.created : ref;
  let due = 0, done = 0;
  if (h.sched === 'week') {
    for (let w = weekStart(start); w <= ref; w = addDays(w, 7)) {
      due += h.weekTarget;
      done += Math.min(h.weekTarget, weekCount(h, w));
    }
  } else {
    for (let k = start; k <= ref; k = addDays(k, 1)) {
      if (!isActiveOn(h, k)) continue;
      due++;
      if (isDoneOn(h, k)) done++;
    }
  }
  return { due, done, pct: due ? Math.round((done / due) * 100) : 0 };
}

export function totalDone(h) {
  return Object.keys(data.log[h.id] || {}).filter(k => isDoneOn(h, k)).length;
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

export function deleteList(id) {
  data.lists = data.lists.filter(l => l.id !== id);
  data.todos = data.todos.filter(t => t.listId !== id);
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
    emoji: '',
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
