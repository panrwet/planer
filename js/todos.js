/* Todos: eine Liste pro Reiter in der Leiste unten, darin die Aufgaben.
   Der Pfeil rechts in der Leiste öffnet ein Drop-up mit allen Listen und der
   Listenverwaltung. */

import { $, el, haptic, formatDue, daysBetween } from './util.js';
import * as S from './store.js';
import { attachSortable, isDragging } from './drag.js';
import {
  toast, openSheet, confirmSheet, openDropup, dropupItem, field, textInput,
  emojiPicker, colorPicker, checkButton, sectionToggle,
} from './ui.js';

const LIST_EMOJI = ['📋', '🗂', '🛒', '💼', '🏠', '🎓', '✈️', '🎁', '🔧', '💡', '❤️', '🌿'];
const MAX_DEPTH = 2;   // drei Ebenen: 0, 1, 2

let onSelectList = () => {};
export function bindListSelect(fn) { onSelectList = fn; }

/* ==========================================================================
   Leiste mit den Listen-Reitern
   ========================================================================== */

export function renderListBar(activeId) {
  const bar = $('#list-tabs');
  const all = S.lists();
  const isDark = document.documentElement.dataset.resolved === 'dark';

  bar.replaceChildren(...all.map((l) => {
    const open = S.todosOf(l.id).filter((t) => !t.done).length;
    const c = S.colorOf(l.color);
    const tab = el('button', {
      class: `list-tab${l.id === activeId ? ' active' : ''}`,
      type: 'button',
      style: `--tint:${isDark ? c.dark : c.light}`,
      dataset: { id: l.id },
    }, [
      el('span', { class: 'list-tab-emoji', text: l.emoji || '📋' }),
      el('span', { class: 'list-tab-name', text: l.name }),
      open ? el('span', { class: 'list-tab-badge', text: String(open) }) : null,
    ]);
    tab.addEventListener('click', () => { haptic(); onSelectList(l.id); });
    return tab;
  }));

  // Der aktive Reiter soll sichtbar sein, auch wenn die Leiste scrollt.
  requestAnimationFrame(() => {
    bar.querySelector('.list-tab.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
}

/* ---------- Drop-up: alle Listen und deren Verwaltung ---------- */

export function openListMenu(activeId, afterChange) {
  openDropup({
    title: 'Listen',
    build: (body, { close }) => {
      const all = S.lists();
      const active = S.list(activeId);

      for (const l of all) {
        const items = S.todosOf(l.id);
        const open = items.filter((t) => !t.done).length;
        body.append(dropupItem({
          emoji: l.emoji || '📋',
          label: l.name,
          hint: open ? `${open} offen` : (items.length ? 'alles erledigt' : 'leer'),
          active: l.id === activeId,
          onClick: () => { close(); onSelectList(l.id); },
        }));
      }

      body.append(el('div', { class: 'dropup-sep' }));

      body.append(dropupItem({
        emoji: '＋',
        label: 'Neue Liste',
        onClick: () => { close(); openListEditor(null, afterChange); },
      }));

      if (active) {
        body.append(dropupItem({
          emoji: '✏️',
          label: `„${active.name}" bearbeiten`,
          onClick: () => { close(); openListEditor(active.id, afterChange); },
        }));
      }

      if (all.length > 1) {
        body.append(dropupItem({
          emoji: '↕',
          label: 'Listen sortieren',
          onClick: () => { close(); openListSorter(afterChange); },
        }));
      }
    },
  });
}

/** Listen umsortieren – in der Leiste selbst wäre das Ziehen zu fummelig. */
function openListSorter(afterChange) {
  openSheet({
    title: 'Listen sortieren',
    cancel: 'Fertig',
    build: (body) => {
      const host = el('div', { class: 'list' });
      const isDark = document.documentElement.dataset.resolved === 'dark';

      const paint = () => {
        host.replaceChildren(...S.lists().map((l) => {
          const row = el('div', { class: 'row tinted', style: S.tintStyle(l.color, isDark) }, [
            el('div', { class: 'row-emoji', text: l.emoji || '📋' }),
            el('div', { class: 'row-body' }, [el('div', { class: 'row-title', text: l.name })]),
            el('div', { class: 'grip', 'aria-hidden': 'true' }),
          ]);
          const wrap = el('div', { class: 'sort-wrap', dataset: { id: l.id } }, [row]);
          attachSortable(wrap, row, {
            host,
            scroll: body,
            onDrop: (order) => { S.reorderLists(order.map((o) => o.id)); paint(); afterChange?.(); },
          });
          return wrap;
        }));
      };
      paint();

      body.append(
        el('p', { class: 'field-hint', style: 'margin:-4px 0 14px', text: 'Zeile gedrückt halten und verschieben.' }),
        host,
      );
    },
  });
}

/* ---------- Liste anlegen und bearbeiten ---------- */

export function openListEditor(id, afterSave) {
  const existing = id ? S.list(id) : null;
  const l = existing || { name: '', emoji: '📋', color: 'blue' };
  let collect = () => null;

  openSheet({
    title: existing ? 'Liste bearbeiten' : 'Neue Liste',
    confirm: 'Sichern',
    build: (body, { close }) => {
      const name = textInput({ value: l.name, placeholder: 'z. B. Einkaufen' });
      const emoji = emojiPicker(l.emoji, LIST_EMOJI);
      const color = colorPicker(l.color);

      body.append(field('Name', name), field('Emoji', emoji.node), field('Farbe', color.node),
        existing ? el('button', {
          type: 'button', class: 'btn danger', text: 'Liste löschen',
          onclick: () => {
            close();
            const n = S.todosOf(existing.id).length;
            confirmSheet({
              title: 'Liste löschen?',
              message: `„${existing.name}" wird entfernt${n ? ` – zusammen mit ${n} ${n === 1 ? 'Aufgabe' : 'Aufgaben'}` : ''}. Das lässt sich nicht rückgängig machen.`,
              onConfirm: () => { S.deleteList(existing.id); toast('Liste gelöscht'); afterSave?.(null); },
            });
          },
        }) : null);

      setTimeout(() => { if (!existing) name.focus(); }, 320);
      collect = () => {
        const n = name.value.trim();
        if (!n) { name.focus(); toast('Bitte einen Namen eingeben'); return null; }
        return { name: n, emoji: emoji.value || '📋', color: color.value };
      };
    },
    onConfirm() {
      const fields = collect();
      if (!fields) return false;
      const saved = existing ? S.updateList(existing.id, fields) : S.addList(fields);
      haptic(12);
      toast(existing ? 'Gesichert' : `„${saved.name}" angelegt`);
      afterSave?.(saved);
    },
  });
}

/* ==========================================================================
   Aufgaben einer Liste
   ========================================================================== */

/** Sichtbare Reihenfolge als flache Liste mit Tiefe. Waisen (Elternteil fehlt)
    landen sicherheitshalber auf oberster Ebene, statt unsichtbar zu werden. */
export function flatten(listId, { includeDone }) {
  const all = S.todosOf(listId);
  const byId = new Map(all.map((t) => [t.id, t]));
  const kids = new Map();
  for (const t of all) {
    const key = t.parent && byId.has(t.parent) ? t.parent : '__root';
    if (!kids.has(key)) kids.set(key, []);
    kids.get(key).push(t);
  }
  const out = [];
  const walk = (key, depth) => {
    for (const t of kids.get(key) || []) {
      if (includeDone || !t.done) out.push({ todo: t, depth });
      walk(t.id, depth + 1);
    }
  };
  walk('__root', 0);
  return out;
}

export function renderTodos(listId) {
  const l = S.list(listId);
  const host = $('#todo-list');
  const doneHost = $('#todos-done');

  if (!l) {
    host.replaceChildren();
    doneHost.replaceChildren();
    $('#todos-title').textContent = 'Todos';
    $('#todos-subtitle').textContent = '';
    $('#todos-empty').hidden = false;
    $('#todos-empty-text').textContent = 'Lege über den Pfeil unten rechts deine erste Liste an.';
    return;
  }

  const showDone = S.settings().doneTodos === 'show';
  const isDark = document.documentElement.dataset.resolved === 'dark';

  $('#todos-title').textContent = `${l.emoji || ''} ${l.name}`.trim();

  const items = flatten(listId, { includeDone: showDone });
  host.replaceChildren(...items.map((it) => todoRow(it, listId, isDark, { draggable: true })));

  // Ziehen erst anhängen, wenn alle Zeilen im Container hängen.
  for (const wrap of host.children) {
    attachSortable(wrap, wrap.firstElementChild, {
      host,
      scroll: $('#todos-scroll'),
      nesting: true,
      maxDepth: MAX_DEPTH,
      hint: 'Nach rechts ziehen = Unteraufgabe',
      ignore: '.check',
      onDrop: (order) => { S.reorderTodos(listId, order); renderTodos(listId); },
    });
  }

  const doneItems = showDone ? [] : S.todosOf(listId).filter((t) => t.done)
    .sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));

  if (doneItems.length) {
    const list = el('div', { class: 'list' });
    list.hidden = !S.groupOpen('todosDone');
    list.append(...doneItems.map((t) => todoRow({ todo: t, depth: 0 }, listId, isDark, { draggable: false })));
    doneHost.replaceChildren(el('div', { class: 'group-section' }, [
      sectionToggle({
        label: 'Erledigt', count: doneItems.length, open: S.groupOpen('todosDone'),
        onToggle: (next) => { list.hidden = !next; S.setGroupOpen('todosDone', next); },
      }),
      list,
    ]));
  } else {
    doneHost.replaceChildren();
  }

  const open = S.todosOf(listId).filter((t) => !t.done).length;
  $('#todos-subtitle').textContent = open ? `${open} offen` : (S.todosOf(listId).length ? 'Alles erledigt' : '');
  $('#todos-empty').hidden = items.length > 0 || doneItems.length > 0;
  $('#todos-empty-text').textContent = 'Tippe oben rechts auf + für eine neue Aufgabe.';
}

function todoRow({ todo: t, depth }, listId, isDark, { draggable }) {
  const c = t.color ? S.colorOf(t.color) : null;
  const tint = c ? (isDark ? c.dark : c.light) : null;
  const kids = S.childrenOf(t.id);
  const kidsDone = kids.filter((k) => k.done).length;

  const meta = [];
  if (t.due) {
    const overdue = !t.done && daysBetween(S.today(), t.due) < 0;
    meta.push(el('span', { class: overdue ? 'overdue' : '', text: (overdue ? '⚠ ' : '') + formatDue(t.due, S.today()) }));
  }
  if (kids.length) {
    if (meta.length) meta.push(el('span', { class: 'dot' }));
    meta.push(el('span', { text: `${kidsDone}/${kids.length} Unteraufgaben` }));
  }
  if (t.note && !meta.length) meta.push(el('span', { text: t.note.split('\n')[0] }));

  const row = el('div', {
    class: `row tappable${t.color ? ' tinted' : ''}${t.done ? ' is-done dimmed' : ''}`,
    style: t.color ? S.tintStyle(t.color, isDark) : null,
  }, [
    el('div', { class: 'row-body' }, [
      el('div', { class: 'row-title', text: t.title }),
      meta.length ? el('div', { class: 'row-meta' }, meta) : null,
      t.note && meta.length ? el('div', { class: 'row-note', text: t.note.split('\n')[0] }) : null,
    ]),
    checkButton({
      value: t.done ? 1 : 0, target: 1, color: tint,
      label: t.done ? `${t.title} wieder öffnen` : `${t.title} abhaken`,
      onTap: () => { S.toggleTodo(t.id); renderTodos(listId); },
    }),
  ]);

  row.addEventListener('click', (e) => {
    if (isDragging() || e.target.closest('.check')) return;
    openTodoEditor(listId, t.id);
  });

  return el('div', { class: 'sort-wrap todo-wrap', dataset: { id: t.id, depth: String(depth) } }, [row]);
}

/* ---------- Aufgabe anlegen und bearbeiten ---------- */

export function openTodoEditor(listId, id, afterSave) {
  const existing = id ? S.todo(id) : null;
  const t = existing || { title: '', color: '', note: '', due: '' };
  let collect = () => null;

  openSheet({
    title: existing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe',
    confirm: 'Sichern',
    build: (body, { close }) => {
      const title = textInput({ value: t.title, placeholder: 'Was ist zu tun?', maxlength: 120 });
      const color = colorPicker(t.color || '');
      const note = el('textarea', { class: 'input', placeholder: 'Optional', maxlength: 400 });
      note.value = t.note || '';
      const due = el('input', { class: 'input', type: 'date', value: t.due || '' });

      const quickDue = el('div', { class: 'chips', style: 'margin-top:9px' });
      for (const [label, offset] of [['Heute', 0], ['Morgen', 1], ['In einer Woche', 7], ['Kein Datum', null]]) {
        quickDue.append(el('button', {
          type: 'button', class: 'chip', text: label,
          onclick: () => {
            if (offset === null) { due.value = ''; } else {
              const d = new Date();
              d.setDate(d.getDate() + offset);
              due.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
            haptic();
          },
        }));
      }

      body.append(
        field('Aufgabe', title),
        field('Fällig am', [due, quickDue]),
        field('Notiz', note),
        field('Farbe', color.node),
        existing ? el('button', {
          type: 'button', class: 'btn danger', text: 'Aufgabe löschen',
          onclick: () => {
            close();
            const kids = S.descendantsOf(existing.id).length;
            confirmSheet({
              title: 'Aufgabe löschen?',
              message: kids
                ? `„${existing.title}" und ${kids} ${kids === 1 ? 'Unteraufgabe' : 'Unteraufgaben'} werden entfernt.`
                : `„${existing.title}" wird entfernt.`,
              onConfirm: () => { S.deleteTodo(existing.id); toast('Gelöscht'); renderTodos(listId); afterSave?.(null); },
            });
          },
        }) : null,
      );

      title.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); $('#sheet-host .sheet-head .strong')?.click(); }
      });
      setTimeout(() => { if (!existing) title.focus(); }, 320);

      collect = () => {
        const v = title.value.trim();
        if (!v) { title.focus(); toast('Bitte etwas eintragen'); return null; }
        return { title: v, color: color.value, note: note.value.trim(), due: due.value };
      };
    },
    onConfirm() {
      const fields = collect();
      if (!fields) return false;
      if (existing) S.updateTodo(existing.id, fields);
      else S.addTodo(listId, fields);
      haptic(12);
      renderTodos(listId);
      afterSave?.();
    },
  });
}
