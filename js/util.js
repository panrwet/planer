/* Kleine Helfer: DOM, Datum, Farbe. Bewusst ohne Framework – die App soll
   ohne Build-Schritt direkt von GitHub Pages laufen. */

/* ---------- DOM ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

export function svg(pathD, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  if (cls) s.setAttribute('class', cls);
  for (const d of [].concat(pathD)) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    s.append(p);
  }
  return s;
}

export const ICON = {
  check: 'M20 6L9 17l-5-5',
  chevron: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
};

/* Leichte Haptik, wo iOS sie zulässt. Ohne Unterstützung passiert nichts. */
export function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* egal */ }
}

/* ---------- Datum ---------- */
export const DAY_MS = 86400000;
export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** 'YYYY-MM-DD' in lokaler Zeit (nicht UTC – toISOString würde je nach
    Zeitzone auf den Vortag rutschen). */
export function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Heutiger Tagesschlüssel unter Berücksichtigung des Tagesbeginns:
    bei dayStart=3 zählt 1:30 Uhr noch zum Vortag. */
export function todayKey(dayStart = 0) {
  const now = new Date();
  if (dayStart > 0 && now.getHours() < dayStart) now.setDate(now.getDate() - 1);
  return dateKey(now);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function weekdayOf(key) {
  return parseKey(key).getDay(); // 0 = Sonntag
}

/** Montag der Woche, in der `key` liegt. */
export function weekStart(key) {
  const d = parseKey(key);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return dateKey(d);
}

export function daysBetween(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / DAY_MS);
}

export function formatLongDate(key) {
  return parseKey(key).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatShortDate(key) {
  return parseKey(key).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

/** Fälligkeit menschenlesbar: Heute / Morgen / Gestern / 4. Okt. */
export function formatDue(key, today) {
  const diff = daysBetween(today, key);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff === -1) return 'Gestern';
  if (diff > 1 && diff < 7) return WEEKDAYS_SHORT[weekdayOf(key)] + '.';
  return formatShortDate(key);
}

/* ---------- Zahlen & Text ---------- */
/** 2.5 -> "2,5", 3 -> "3" */
export function num(n) {
  const r = Math.round(n * 100) / 100;
  return String(r).replace('.', ',');
}

export function plural(n, one, many) {
  return `${num(n)} ${n === 1 ? one : many}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
