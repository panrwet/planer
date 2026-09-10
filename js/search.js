/* Freie Suche über alles: Habits, Aufgaben samt Notizen, Listen und
   Einstellungen. Die Treffer liefert store.search(); ein neuer Bereich wird
   dort ergänzt und erscheint hier automatisch. */

import { $, el, haptic } from './util.js';
import * as S from './store.js';
import { SETTINGS_INDEX } from './settings.js';

const GROUPS = [
  { kind: 'habit', label: 'Habits' },
  { kind: 'todo', label: 'Aufgaben' },
  { kind: 'list', label: 'Listen' },
  { kind: 'setting', label: 'Einstellungen' },
];

let go = () => {};
export function bindNavigate(fn) { go = fn; }

let input = null;

export function renderSearch() {
  const scroll = $('#search-scroll');
  if (!input) {
    input = $('#search-input');
    input.addEventListener('input', () => paint());
    // Ein Tipp auf die Lupentaste soll nicht die Seite neu laden
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  }
  paint();
  // Tastatur öffnen, sobald der Bildschirm sichtbar ist
  setTimeout(() => input.focus(), 120);

  function paint() {
    const q = input.value.trim();
    $('#search-clear').hidden = !q;

    if (q.length < 2) {
      scroll.replaceChildren(el('div', { class: 'empty' }, [
        el('div', { class: 'empty-icon', text: '🔍' }),
        el('h2', { text: 'Alles durchsuchen' }),
        el('p', { text: 'Habits, Aufgaben und ihre Notizen, Listen und Einstellungen – ab zwei Buchstaben.' }),
      ]));
      return;
    }

    const hits = S.search(q, { settingsEntries: SETTINGS_INDEX });
    if (!hits.length) {
      scroll.replaceChildren(el('div', { class: 'empty' }, [
        el('div', { class: 'empty-icon', text: '🤷' }),
        el('h2', { text: 'Nichts gefunden' }),
        el('p', { text: `Kein Treffer für „${q}".` }),
      ]));
      return;
    }

    const isDark = document.documentElement.dataset.resolved === 'dark';
    const parts = [];
    for (const g of GROUPS) {
      const rows = hits.filter(h => h.kind === g.kind);
      if (!rows.length) continue;
      parts.push(el('div', { class: 'search-group' }, [
        el('div', { class: 'search-group-label' }, [
          el('span', { text: g.label }),
          el('span', { class: 'section-count', text: String(rows.length) }),
        ]),
        el('div', { class: 'list' }, rows.map(r => hitRow(r, isDark, q))),
      ]));
    }
    scroll.replaceChildren(...parts);
  }
}

function hitRow(hit, isDark, query) {
  const row = el('div', {
    class: `row tappable${hit.color ? ' tinted' : ''}${hit.done ? ' is-done dimmed' : ''}`,
    style: hit.color ? S.tintStyle(hit.color, isDark) : null,
  }, [
    hit.emoji ? el('div', { class: 'row-emoji', text: hit.emoji }) : null,
    el('div', { class: 'row-body' }, [
      highlight(hit.title, query),
      el('div', { class: 'row-meta' }, [el('span', { text: hit.subtitle })]),
    ]),
  ].filter(Boolean));

  row.addEventListener('click', () => {
    haptic();
    if (hit.kind === 'habit') go('habit', hit.id);
    else if (hit.kind === 'todo') go('todos', hit.listId);
    else if (hit.kind === 'list') go('todos', hit.id);
    else go('settings', hit.id);
  });
  return row;
}

/** Hebt den Suchbegriff im Titel hervor, damit der Treffer erkennbar ist. */
function highlight(text, query) {
  const node = el('div', { class: 'row-title' });
  const fold = (s) => s.toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
  const hay = fold(text);
  const needle = fold(query.trim().split(/\s+/)[0]);
  const at = needle.length >= 2 ? hay.indexOf(needle) : -1;

  if (at < 0) { node.textContent = text; return node; }
  node.append(
    text.slice(0, at),
    el('mark', { text: text.slice(at, at + needle.length) }),
    text.slice(at + needle.length),
  );
  return node;
}

/** Feld leeren und Fokus behalten. */
export function clearSearch() {
  if (!input) return;
  input.value = '';
  input.dispatchEvent(new Event('input'));
  input.focus();
}
