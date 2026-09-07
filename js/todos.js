/* Todos: Listenübersicht, Aufgaben einer Liste und das Verschieben per Finger.
   iOS Safari kennt kein HTML5-Drag-and-Drop, deshalb ist das Ziehen mit
   Pointer-Events selbst gebaut – so wie in Apple Erinnerungen: gedrückt halten,
   verschieben, nach rechts ziehen macht die Aufgabe zur Unteraufgabe. */

import { $, el, haptic, clamp, formatDue, daysBetween } from './util.js';
import * as S from './store.js';
import {
  toast, openSheet, confirmSheet, field, textInput, emojiPicker, colorPicker,
  checkButton, chevronButton,
} from './ui.js';

const LIST_EMOJI = ['📋', '🛒', '💼', '🏠', '🎓', '✈️', '🎁', '🔧', '💡', '❤️', '🐾', '🌿'];
const TODO_EMOJI = ['', '📌', '📞', '✉️', '💳', '🚗', '🩺', '🎂', '🧾', '🔑', '📦', '⚡️'];
const INDENT = 26;    // px pro Verschachtelungsebene
const MAX_DEPTH = 2;  // 0, 1, 2 – drei Ebenen

let openList = () => {};
export function bindListOpener(fn) { openList = fn; }

/* ==========================================================================
   Listenübersicht
   ========================================================================== */

export function renderLists() {
  const host = $('#list-list');
  const all = S.lists();
  const isDark = document.documentElement.dataset.resolved === 'dark';

  host.replaceChildren(...all.map(l => {
    const items = S.todosOf(l.id);
    const open = items.filter(t => !t.done).length;

    const row = el('div', {
      class: 'row tappable', style: S.tintStyle(l.color, isDark), dataset: { id: l.id },
    }, [
      el('div', { class: 'row-emoji', text: l.emoji || '📋' }),
      el('div', { class: 'row-body' }, [
        el('div', { class: 'row-title', text: l.name }),
        el('div', { class: 'row-meta' }, [
          el('span', { text: open === 0 ? (items.length ? 'Alles erledigt' : 'Leer') : `${open} offen` }),
          items.length > open ? el('span', { class: 'dot' }) : null,
          items.length > open ? el('span', { text: `${items.length - open} erledigt` }) : null,
        ]),
      ]),
      el('div', { class: 'row-actions' }, [chevronButton(() => openList(l.id), `Liste ${l.name} öffnen`)]),
    ]);
    row.addEventListener('click', () => openList(l.id));
    return row;
  }));

  $('#lists-empty').hidden = all.length > 0;
  const totalOpen = S.getData().todos.filter(t => !t.done).length;
  $('#lists-subtitle').textContent = all.length
    ? (totalOpen ? `${totalOpen} offene ${totalOpen === 1 ? 'Aufgabe' : 'Aufgaben'}` : 'Nichts offen')
    : '';
}

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
              message: `„${existing.name}“ wird entfernt${n ? ` – zusammen mit ${n} ${n === 1 ? 'Aufgabe' : 'Aufgaben'}` : ''}. Das lässt sich nicht rückgängig machen.`,
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
      toast(existing ? 'Gesichert' : `„${saved.name}“ angelegt`);
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
  const byId = new Map(all.map(t => [t.id, t]));
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
  if (!l) return;

  const host = $('#todo-list');
  const doneHost = $('#todo-list-done');
  const section = $('#todos-done-section');
  const set = S.settings();
  const showDone = set.doneTodos === 'show';
  const isDark = document.documentElement.dataset.resolved === 'dark';

  $('#todos-title').textContent = `${l.emoji || ''} ${l.name}`.trim();

  const items = flatten(listId, { includeDone: showDone });
  host.replaceChildren(...items.map(it => todoRow(it, listId, isDark, { dim: true, draggable: true })));

  const doneItems = showDone ? [] : S.todosOf(listId).filter(t => t.done)
    .sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  doneHost.replaceChildren(...doneItems.map(t => todoRow({ todo: t, depth: 0 }, listId, isDark, { dim: true, draggable: false })));
  section.hidden = doneItems.length === 0;
  $('#todos-done-label').textContent = `Erledigt · ${doneItems.length}`;

  const open = S.todosOf(listId).filter(t => !t.done).length;
  $('#todos-subtitle').textContent = open ? `${open} offen` : '';
  $('#todos-empty').hidden = items.length > 0 || doneItems.length > 0;
}

function todoRow({ todo: t, depth }, listId, isDark, { dim, draggable }) {
  const c = t.color ? S.colorOf(t.color) : null;
  const tint = c ? (isDark ? c.dark : c.light) : null;
  const kids = S.childrenOf(t.id);
  const kidsDone = kids.filter(k => k.done).length;

  const row = el('div', {
    class: `row tappable${t.done ? ' is-done' : ''}${t.done && dim ? ' dimmed' : ''}`,
    style: t.color ? S.tintStyle(t.color, isDark) : null,
    dataset: { id: t.id },
  });

  const meta = [];
  if (t.due) {
    const overdue = !t.done && daysBetween(S.today(), t.due) < 0;
    meta.push(el('span', { class: overdue ? 'overdue' : '', text: (overdue ? '⚠ ' : '') + formatDue(t.due, S.today()) }));
  }
  if (kids.length) {
    if (meta.length) meta.push(el('span', { class: 'dot' }));
    meta.push(el('span', { class: 'subcount', text: `${kidsDone}/${kids.length} Unteraufgaben` }));
  }
  if (t.note && !meta.length) meta.push(el('span', { text: t.note.split('\n')[0] }));

  // append() würde ein null als Text "null" einfügen – deshalb vorher filtern.
  row.append(...[
    checkButton({
      value: t.done ? 1 : 0, target: 1, color: tint,
      label: t.done ? `${t.title} wieder öffnen` : `${t.title} abhaken`,
      onTap: () => { S.toggleTodo(t.id); renderTodos(listId); },
    }),
    t.emoji ? el('div', { class: 'row-emoji', text: t.emoji }) : null,
    el('div', { class: 'row-body' }, [
      el('div', { class: 'row-title', text: t.title }),
      meta.length ? el('div', { class: 'row-meta' }, meta) : null,
      t.note && meta.length ? el('div', { class: 'row-note', text: t.note.split('\n')[0] }) : null,
    ]),
    el('div', { class: 'row-actions' }, [chevronButton(() => openTodoEditor(listId, t.id), `${t.title} bearbeiten`)]),
  ].filter(Boolean));

  row.addEventListener('click', () => openTodoEditor(listId, t.id));

  const wrap = el('div', { class: 'todo-wrap', dataset: { id: t.id, depth: String(depth) } }, [row]);
  if (draggable) attachDrag(wrap, row, listId);
  return wrap;
}

/* ---------- Anlegen & Bearbeiten ---------- */

export function openTodoEditor(listId, id, afterSave) {
  const existing = id ? S.todo(id) : null;
  const t = existing || { title: '', emoji: '', color: '', note: '', due: '' };
  let collect = () => null;

  openSheet({
    title: existing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe',
    confirm: 'Sichern',
    build: (body, { close }) => {
      const title = textInput({ value: t.title, placeholder: 'Was ist zu tun?', maxlength: 120 });
      const emoji = emojiPicker(t.emoji, TODO_EMOJI);
      const color = colorPicker(t.color || '');
      const note = el('textarea', { class: 'input', placeholder: 'Optional', maxlength: 400 });
      note.value = t.note || '';
      const due = el('input', { class: 'input', type: 'date', value: t.due || '' });

      const quickDue = el('div', { class: 'chips', style: 'margin-top:9px' });
      for (const [label, offset] of [['Heute', 0], ['Morgen', 1], ['In einer Woche', 7], ['Kein Datum', null]]) {
        quickDue.append(el('button', {
          type: 'button', class: 'chip', text: label,
          onclick: () => {
            if (offset === null) { due.value = ''; }
            else {
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
        field('Emoji', emoji.node),
        field('Farbe', color.node),
        existing ? el('button', {
          type: 'button', class: 'btn danger', text: 'Aufgabe löschen',
          onclick: () => {
            close();
            const kids = S.descendantsOf(existing.id).length;
            confirmSheet({
              title: 'Aufgabe löschen?',
              message: kids
                ? `„${existing.title}“ und ${kids} ${kids === 1 ? 'Unteraufgabe' : 'Unteraufgaben'} werden entfernt.`
                : `„${existing.title}“ wird entfernt.`,
              onConfirm: () => { S.deleteTodo(existing.id); toast('Gelöscht'); afterSave?.(null); renderTodos(listId); },
            });
          },
        }) : null,
      );

      title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#sheet-host .sheet-head .strong')?.click(); } });
      setTimeout(() => { if (!existing) title.focus(); }, 320);

      collect = () => {
        const v = title.value.trim();
        if (!v) { title.focus(); toast('Bitte etwas eintragen'); return null; }
        return { title: v, emoji: emoji.value, color: color.value, note: note.value.trim(), due: due.value };
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

/* ==========================================================================
   Ziehen: umsortieren und einrücken
   ========================================================================== */

let dragState = null;

function attachDrag(wrap, row, listId) {
  let holdTimer = null;
  let startX = 0, startY = 0;
  let armed = false;

  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; armed = false; };

  row.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.check, .chev-btn')) return;   // Abhaken und Details gehen vor
    if (e.button !== undefined && e.button !== 0) return;
    armed = true;
    startX = e.clientX;
    startY = e.clientY;
    holdTimer = setTimeout(() => {
      if (!armed) return;
      haptic(20);
      beginDrag(wrap, row, listId, startX, startY, e.pointerId);
    }, 380);
  });

  row.addEventListener('pointermove', (e) => {
    if (!armed || dragState) return;
    // Scrollen oder Wischen bricht das Anheben ab.
    if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) cancelHold();
  });
  row.addEventListener('pointerup', cancelHold);
  row.addEventListener('pointercancel', cancelHold);
  row.addEventListener('contextmenu', (e) => { if (dragState) e.preventDefault(); });
}

function beginDrag(wrap, row, listId, startX, startY, pointerId) {
  const scroll = $('#todos-scroll');
  const host = $('#todo-list');
  const wraps = [...host.children];
  const index = wraps.indexOf(wrap);
  if (index < 0) return;

  const draggedId = wrap.dataset.id;
  const draggedDepth = Number(wrap.dataset.depth);
  // Nachfahren wandern mit – sie stehen direkt darunter und sind tiefer.
  const block = [wrap];
  for (let i = index + 1; i < wraps.length; i++) {
    if (Number(wraps[i].dataset.depth) <= draggedDepth) break;
    block.push(wraps[i]);
  }

  const rect = wrap.getBoundingClientRect();
  const blockH = block.reduce((sum, n) => sum + n.getBoundingClientRect().height, 0)
    + (block.length - 1) * 8;

  // Der angehobene Block schwebt über der Liste …
  const ghost = el('div', { class: 'drag-ghost', style: `width:${rect.width}px` });
  for (const n of block) {
    // Im schwebenden Block zählt nur die Einrückung *relativ* zum obersten
    // Element – sonst würde der ganze Block seitlich verrutschen.
    n.style.marginLeft = `${(Number(n.dataset.depth) - draggedDepth) * INDENT}px`;
    ghost.append(n);
  }
  ghost.firstElementChild.querySelector('.row')?.classList.add('dragging');
  document.body.append(ghost);

  // … und hinterlässt einen Platzhalter.
  const placeholder = el('div', { class: 'drag-placeholder', style: `height:${blockH}px` });
  host.insertBefore(placeholder, wraps[index + block.length] || null);

  const hint = el('div', { class: 'drag-hint', text: 'Nach rechts ziehen = Unteraufgabe' });
  document.body.append(hint);
  document.body.classList.add('is-dragging');

  const offsetX = startX - rect.left;
  const offsetY = startY - rect.top;

  dragState = {
    listId, host, scroll, ghost, placeholder, block, draggedId,
    depth: draggedDepth, offsetX, offsetY, startX,
    lastX: startX, lastY: startY, pointerId, autoScroll: 0,
  };
  moveGhost(startX, startY);
  updateTarget();

  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  tickAutoScroll();
}

function moveGhost(x, y) {
  const { ghost, offsetX, offsetY } = dragState;
  ghost.style.transform = `translate(${x - offsetX}px, ${y - offsetY}px)`;
}

function onMove(e) {
  if (!dragState) return;
  e.preventDefault();
  dragState.lastX = e.clientX;
  dragState.lastY = e.clientY;
  moveGhost(e.clientX, e.clientY);
  updateTarget();

  // Nahe am Rand mitscrollen
  const r = dragState.scroll.getBoundingClientRect();
  const edge = 70;
  if (e.clientY < r.top + edge) dragState.autoScroll = -Math.ceil((r.top + edge - e.clientY) / 6);
  else if (e.clientY > r.bottom - edge) dragState.autoScroll = Math.ceil((e.clientY - (r.bottom - edge)) / 6);
  else dragState.autoScroll = 0;
}

function tickAutoScroll() {
  if (!dragState) return;
  if (dragState.autoScroll) {
    dragState.scroll.scrollTop += dragState.autoScroll;
    moveGhost(dragState.lastX, dragState.lastY);
    updateTarget();
  }
  requestAnimationFrame(tickAutoScroll);
}

/** Setzt den Platzhalter an die Stelle unter dem Finger und bestimmt die
    Verschachtelungstiefe aus dem horizontalen Versatz. */
function updateTarget() {
  const { host, placeholder, lastY, lastX, startX } = dragState;
  const siblings = [...host.children].filter(n => n !== placeholder);

  // Einfügestelle: erste Zeile, deren Mitte unter dem Finger liegt.
  let before = null;
  for (const n of siblings) {
    const r = n.getBoundingClientRect();
    if (lastY < r.top + r.height / 2) { before = n; break; }
  }
  if (before !== placeholder.nextElementSibling) host.insertBefore(placeholder, before);

  // Erlaubter Tiefenbereich: höchstens eine Stufe unter dem Vorgänger,
  // und mindestens so tief wie der Nachfolger, damit keine Lücke entsteht.
  const prev = placeholder.previousElementSibling;
  const next = placeholder.nextElementSibling;
  const prevDepth = prev ? Number(prev.dataset.depth) : -1;
  const nextDepth = next ? Number(next.dataset.depth) : 0;
  const maxDepth = Math.min(MAX_DEPTH, prevDepth + 1);
  const minDepth = Math.max(0, Math.min(nextDepth, maxDepth));

  const wanted = Math.round((lastX - startX) / INDENT) + Number(dragState.block[0].dataset.depth);
  const depth = clamp(wanted, minDepth, maxDepth);

  dragState.depth = depth;
  placeholder.style.marginLeft = `${depth * INDENT}px`;
  placeholder.classList.toggle('will-nest', depth > 0);
}

function onUp() {
  if (!dragState) return;
  const { host, placeholder, ghost, block, listId, depth } = dragState;

  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  document.body.classList.remove('is-dragging');
  document.querySelector('.drag-hint')?.remove();

  // Block wieder einhängen, wo der Platzhalter steht
  for (const n of block) { n.style.marginLeft = ''; host.insertBefore(n, placeholder); }
  placeholder.remove();
  ghost.remove();
  block[0].querySelector('.row')?.classList.remove('dragging');

  const shift = depth - Number(block[0].dataset.depth);
  const moved = new Map(block.map(n => [n.dataset.id, Math.max(0, Math.min(MAX_DEPTH, Number(n.dataset.depth) + shift))]));

  // Sichtbare Reihenfolge einsammeln und daraus parent/order neu ableiten.
  const order = [];
  const stack = [];   // stack[d] = id der zuletzt gesehenen Zeile auf Tiefe d
  for (const n of host.children) {
    const id = n.dataset.id;
    if (!id) continue;
    const d = moved.has(id) ? moved.get(id) : Number(n.dataset.depth);
    order.push({ id, parent: d === 0 ? null : (stack[d - 1] ?? null) });
    stack[d] = id;
    stack.length = d + 1;
    n.dataset.depth = String(d);
  }

  S.reorderTodos(listId, order);
  haptic(14);
  dragState = null;
  renderTodos(listId);
}
