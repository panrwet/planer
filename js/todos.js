/* Todos: eine Liste pro Reiter in der Leiste unten, darin die To-dos.
   Der Pfeil rechts in der Leiste öffnet ein Drop-up mit allen Listen und der
   Listenverwaltung. */

import { $, el, haptic, formatDue, daysBetween } from './util.js';
import * as S from './store.js';
import { attachSortable, isDragging } from './drag.js';
import { attachSwipe, closeSwipe, wasSwipe } from './swipe.js';
import {
  toast, openSheet, confirmSheet, openDropup, dropupItem, field, editorFields,
  textInput, emojiPicker, nameWithEmoji, colorPicker, checkButton, sectionToggle,
  flashRow, collapseAway, paintCheck,
} from './ui.js';

const MAX_DEPTH = 2;   // drei Ebenen: 0, 1, 2

/** Offene und davon überfällige To-dos einer Liste. */
function listStats(listId) {
  const items = S.todosOf(listId);
  const open = items.filter((t) => !t.done);
  const today = S.today();
  return {
    total: items.length,
    open: open.length,
    overdue: open.filter((t) => t.due && daysBetween(today, t.due) < 0).length,
  };
}

let onSelectList = () => {};
export function bindListSelect(fn) { onSelectList = fn; }

/* ==========================================================================
   Leiste mit den Listen-Reitern
   ========================================================================== */

export function renderListBar(activeId) {
  const bar = $('#list-tabs');
  const all = S.lists();
  const isDark = document.documentElement.dataset.resolved === 'dark';

  /* „All" steht ganz links, vor allen echten Listen – es ist der Eingang in
     den Bereich, nicht eine Liste unter vielen. */
  const gesamt = listStats(S.ALL_LISTS);
  const allTab = el('button', {
    class: `list-tab all-tab${activeId === S.ALL_LISTS ? ' active' : ''}`,
    type: 'button',
    dataset: { id: S.ALL_LISTS },
    'aria-label': gesamt.overdue ? `Alle To-dos, ${gesamt.overdue} überfällig` : 'Alle To-dos',
  }, [
    el('span', { class: 'list-tab-name', text: 'All' }),
    gesamt.open ? el('span', { class: `list-tab-badge${gesamt.overdue ? ' overdue' : ''}`, text: String(gesamt.open) }) : null,
  ].filter(Boolean));
  allTab.addEventListener('click', () => { haptic(); onSelectList(S.ALL_LISTS); });

  bar.replaceChildren(allTab, ...all.map((l) => {
    const st = listStats(l.id);
    const c = S.colorOf(l.color);
    const tab = el('button', {
      class: `list-tab${l.id === activeId ? ' active' : ''}`,
      type: 'button',
      style: `--tint:${isDark ? c.dark : c.light}`,
      dataset: { id: l.id },
      // Überfälliges soll man sehen, ohne die Liste zu öffnen.
      'aria-label': st.overdue ? `${l.name}, ${st.overdue} überfällig` : l.name,
    }, [
      el('span', { class: 'list-tab-emoji', text: l.emoji || '📋' }),
      el('span', { class: 'list-tab-name', text: l.name }),
      st.open ? el('span', { class: `list-tab-badge${st.overdue ? ' overdue' : ''}`, text: String(st.open) }) : null,
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
      const gesamt = listStats(S.ALL_LISTS);

      body.append(dropupItem({
        emoji: '🗂',
        label: 'All',
        hint: gesamt.open
          ? `${gesamt.open} offen${gesamt.overdue ? ` · ${gesamt.overdue} überfällig` : ''}`
          : (gesamt.total ? 'alles erledigt' : 'leer'),
        overdue: gesamt.overdue > 0,
        active: activeId === S.ALL_LISTS,
        onClick: () => { close(); onSelectList(S.ALL_LISTS); },
      }));
      if (all.length) body.append(el('div', { class: 'dropup-sep' }));

      for (const l of all) {
        const st = listStats(l.id);
        const hint = st.open
          ? `${st.open} offen${st.overdue ? ` · ${st.overdue} überfällig` : ''}`
          : (st.total ? 'alles erledigt' : 'leer');
        body.append(dropupItem({
          emoji: l.emoji || '📋',
          label: l.name,
          hint,
          overdue: st.overdue > 0,
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
      const emoji = emojiPicker(l.emoji);
      const color = colorPicker(l.color);
      if (l.name) emoji.suggest(l.name);

      body.append(...editorFields({
        name: field('Name', nameWithEmoji(name, emoji)),
        emoji: emoji.node,
        color: field('Farbe', color.node),
      }));
      body.append(
        existing ? el('button', {
          type: 'button', class: 'btn danger', text: 'Liste löschen',
          onclick: () => {
            close();
            const n = S.todosOf(existing.id).length;
            confirmSheet({
              title: 'Liste löschen?',
              message: `„${existing.name}" wird entfernt${n ? ` – zusammen mit ${n} ${n === 1 ? 'To-do' : 'To-dos'}` : ''}. Das lässt sich nicht rückgängig machen.`,
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
      S.rememberEmoji(fields.emoji);
      haptic(12);
      toast(existing ? 'Gesichert' : `„${saved.name}" angelegt`);
      afterSave?.(saved);
    },
  });
}

/* ==========================================================================
   To-dos einer Liste
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
  closeSwipe();
  const alle = listId === S.ALL_LISTS;
  const l = alle ? null : S.list(listId);
  const host = $('#todo-list');
  const doneHost = $('#todos-done');

  if (!alle && !l) {
    host.replaceChildren();
    doneHost.replaceChildren();
    $('#todos-title').textContent = 'To-dos';
    $('#todos-subtitle').textContent = '';
    $('#todos-empty').hidden = false;
    $('#todos-empty-text').textContent = 'Lege über den Pfeil unten rechts deine erste Liste an.';
    renderListBar('');
    return;
  }

  const showDone = S.settings().doneTodos === 'show';
  const isDark = document.documentElement.dataset.resolved === 'dark';

  $('#todos-title').textContent = alle ? 'Alle To-dos' : `${l.emoji || ''} ${l.name}`.trim();

  const items = flatten(listId, { includeDone: showDone });
  host.replaceChildren(...items.map((it) => todoRow(it, listId, isDark, { draggable: !alle })));

  /* In „All" wird nicht sortiert und nicht eingerückt. Beides bedeutet etwas
     innerhalb einer Liste: `order` gilt je Liste, und eine Über-To-do muss in
     derselben Liste liegen. Über Listengrenzen hinweg gezogen wäre nicht
     bloß unklar, sondern falsch. */
  if (!alle) {
    // Ziehen erst anhängen, wenn alle Zeilen im Container hängen.
    for (const wrap of host.children) {
      attachSortable(wrap, wrap.firstElementChild, {
        host,
        scroll: $('#todos-scroll'),
        nesting: true,
        maxDepth: MAX_DEPTH,
        hint: 'Nach rechts ziehen = Unter-To-do',
        ignore: '.check',
        onDrop: (order) => { S.reorderTodos(listId, order); renderTodos(listId); },
      });
    }
  }

  renderDoneSection(listId, isDark);
  updateTodoCounters(listId);
  $('#todos-empty').hidden = items.length > 0 || doneHost.children.length > 0;
  $('#todos-empty-text').textContent = alle
    ? (S.lists().length ? 'In keiner Liste steht etwas Offenes.' : 'Lege über den Pfeil unten rechts deine erste Liste an.')
    : 'Tippe oben rechts auf + für ein neues To-do.';
}

/* ==========================================================================
   Eine To-doszeile
   Sie wird an genau einer Stelle gebaut (todoRow) und an genau einer Stelle
   mit Inhalt gefüllt (fillRow). Beim Abhaken wird nur nachgefüllt, nicht neu
   gebaut: Die Behandlung für Tippen, Wischen und Ziehen hängt an der Hülle und
   bleibt dadurch bestehen – und die Liste wird nicht angefasst. Vorher baute
   jeder Haken alle Zeilen neu, was bei 800 To-dos knapp eine halbe Sekunde
   kostete und die Zeile mitten im Aufleuchten austauschte.
   ========================================================================== */

function todoRow({ todo: t, depth }, listId, isDark, { draggable }) {
  const row = el('div', { class: 'row tappable' });
  const wrap = el('div', { class: 'sort-wrap todo-wrap', dataset: { id: t.id, depth: String(depth) } }, [row]);
  fillRow(row, t, listId, isDark);

  row.addEventListener('click', (e) => {
    // wasSwipe() deckt beides ab: den Nachklapp einer Wischgeste und den
    // Tipp, der nur einen offenen Wisch-Knopf geschlossen hat.
    if (isDragging() || wasSwipe() || e.target.closest('.check, .swipe-action')) return;
    openTodoEditor(listId, t.id);
  });

  /* Wischen nach rechts rückt ein bzw. aus – der Weg, den iOS-Nutzer von
     Apple Erinnerungen kennen. Das Ziehen bleibt als zweiter Weg. */
  if (draggable) {
    attachSwipe(wrap, row, {
      blocked: isDragging,
      canIndent: () => S.canIndent(t.id, MAX_DEPTH),
      canOutdent: () => S.canOutdent(t.id),
      onIndent: () => { S.indentTodo(t.id, MAX_DEPTH); renderTodos(listId); },
      onOutdent: () => { S.outdentTodo(t.id); renderTodos(listId); },
    });
  }
  return wrap;
}

/** Füllt eine Zeile mit dem aktuellen Stand – neu gebaut oder aufgefrischt. */
function fillRow(row, t, listId, isDark) {
  /* In „All" stehen To-dos aus mehreren Listen untereinander. Dann trägt die
     Zeile die Farbe ihrer Liste und nennt sie in der Meta-Zeile – sonst wäre
     nicht zu sehen, wo etwas hingehört. */
  const alle = listId === S.ALL_LISTS;
  const quelle = alle ? S.list(t.listId) : null;
  const farbe = t.color || (alle ? quelle?.color : '') || '';
  const c = farbe ? S.colorOf(farbe) : null;
  const tint = c ? (isDark ? c.dark : c.light) : null;
  const kids = S.childrenOf(t.id);
  const kidsDone = kids.filter((k) => k.done).length;

  const meta = [];
  if (alle && quelle) {
    meta.push(el('span', { text: `${quelle.emoji || '📋'} ${quelle.name}` }));
  }
  if (t.due) {
    if (meta.length) meta.push(el('span', { class: 'dot' }));
    const late = t.done ? 0 : -daysBetween(S.today(), t.due);
    meta.push(late > 0
      ? el('span', { class: 'overdue', text: `⚠ ${late === 1 ? '1 Tag' : `${late} Tage`} überfällig` })
      : el('span', { text: formatDue(t.due, S.today()) }));
  }
  if (kids.length) {
    if (meta.length) meta.push(el('span', { class: 'dot' }));
    meta.push(el('span', { text: `${kidsDone}/${kids.length} Unter-To-dos` }));
  }
  if (t.note && !meta.length) meta.push(el('span', { text: t.note.split('\n')[0] }));

  row.className = `row tappable${farbe ? ' tinted' : ''}${t.done ? ' is-done dimmed' : ''}`;
  if (farbe) row.setAttribute('style', S.tintStyle(farbe, isDark));
  else row.removeAttribute('style');

  const body = el('div', { class: 'row-body' }, [
    el('div', { class: 'row-title', text: t.title }),
    meta.length ? el('div', { class: 'row-meta' }, meta) : null,
    t.note && meta.length ? el('div', { class: 'row-note', text: t.note.split('\n')[0] }) : null,
  ].filter(Boolean));

  const alt = row.querySelector('.row-body');
  if (alt) alt.replaceWith(body); else row.append(body);

  /* Der Abhak-Knopf wird nie ausgetauscht, nur nachgezogen. Ein ersetzter Knopf
     ist ein neues Element, und auf einem neuen Element läuft kein `transition`
     – der Fortschrittsring spränge von Schritt zu Schritt, statt zu wandern. */
  const label = t.done ? `${t.title} wieder öffnen` : `${t.title} abhaken`;
  const check = row.querySelector('.check');
  if (check) paintCheck(check, { value: t.done ? 1 : 0, target: 1, color: tint, label });
  else row.append(checkButton({
    value: t.done ? 1 : 0, target: 1, color: tint, label,
    onTap: () => toggleFrom(row, t.id, listId, isDark),
  }));
}

/**
 * Abhaken, ohne die Liste neu zu bauen.
 *
 * 1. Der Store sagt, wer sich wirklich geändert hat – das sind die Zeile
 *    selbst, ihre Unter-To-dos und alle ÜberTo-dos, die dadurch voll
 *    bzw. wieder offen werden.
 * 2. Genau diese Zeilen werden aufgefrischt.
 * 3. Die angetippte leuchtet auf – und zwar diese, nicht ein Nachbau.
 * 4. Erst wenn das Leuchten durch ist, verschwinden die Zeilen, die nach der
 *    Einstellung nicht mehr in die Liste gehören. Sonst wäre die Rückmeldung
 *    weg, bevor man sie gesehen hat.
 */
function toggleFrom(row, id, listId, isDark) {
  const changed = S.toggleTodo(id);
  if (!changed.length) return;

  const host = $('#todo-list');
  for (const cid of changed) {
    const other = host.querySelector(`.todo-wrap[data-id="${cid}"] > .row`);
    if (other) fillRow(other, S.todo(cid), listId, isDark);
  }

  const nowDone = !!S.todo(id)?.done;
  updateTodoCounters(listId);

  if (S.settings().doneTodos === 'show') {
    if (nowDone) flashRow(row);
    renderDoneSection(listId, isDark);
    return;
  }

  // Abgehakte verlassen die Liste, wieder geöffnete kommen zurück. Das Zurück
  // braucht eine Einsortierung an der richtigen Stelle – dafür ist ein
  // vollständiger Aufbau ehrlicher als ein halbherziges Einfügen.
  if (!nowDone) { renderTodos(listId); return; }

  const leaving = changed
    .map(cid => host.querySelector(`.todo-wrap[data-id="${cid}"]`))
    .filter(Boolean);

  // Erst leuchten lassen, dann zusammenfallen – nicht beides gleichzeitig.
  flashRow(row, () => collapseAway(leaving, () => {
    renderDoneSection(listId, isDark);
    updateTodoCounters(listId);
    $('#todos-empty').hidden = host.children.length > 0 || !!$('#todos-done').children.length;
  }));
}

/** Zählt die Kopfzeile und den Listen-Reiter neu – ohne die Liste anzufassen. */
function updateTodoCounters(listId) {
  const st = listStats(listId);
  const sub = $('#todos-subtitle');
  sub.textContent = st.open
    ? `${st.open} offen${st.overdue ? ` · ${st.overdue} überfällig` : ''}`
    : (st.total ? 'Alles erledigt' : '');
  sub.classList.toggle('has-overdue', st.overdue > 0);
  renderListBar(listId);
}

/** Der Abschnitt „Erledigt" unter der Liste. */
function renderDoneSection(listId, isDark) {
  const doneHost = $('#todos-done');
  const showDone = S.settings().doneTodos === 'show';
  const doneItems = showDone ? [] : S.todosOf(listId).filter((t) => t.done)
    .sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));

  if (!doneItems.length) { doneHost.replaceChildren(); return; }

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
}

/* ---------- To-do anlegen und bearbeiten ---------- */

export function openTodoEditor(listId, id, afterSave) {
  const existing = id ? S.todo(id) : null;
  const t = existing || { title: '', color: '', note: '', due: '' };
  let collect = () => null;

  openSheet({
    title: existing ? 'To-do bearbeiten' : 'Neues To-do',
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

      /* Unter-To-dos: der ausdrückliche Weg neben den Gesten. Beim Bearbeiten
         wirken Änderungen sofort, beim Neuanlegen werden sie gesammelt und
         nach dem Sichern angelegt. */
      const pending = [];
      const subHost = el('div', { class: 'sub-list' });
      const subInput = el('input', {
        class: 'input', type: 'text', placeholder: 'Unter-To-do hinzufügen',
        enterkeyhint: 'done', maxlength: 120,
      });

      const paintSubs = () => {
        const kids = existing ? S.childrenOf(existing.id) : pending;
        subHost.replaceChildren(...kids.map((k, i) => {
          const done = !!k.done;
          const line = el('div', { class: `sub-row${done ? ' is-done' : ''}` }, [
            el('button', {
              class: `sub-check${done ? ' on' : ''}`, type: 'button',
              'aria-label': done ? `${k.title} wieder öffnen` : `${k.title} abhaken`,
              onclick: () => {
                if (existing) { S.toggleTodo(k.id); renderTodos(listId); }
                else k.done = !k.done;
                paintSubs();
                haptic();
              },
            }),
            el('span', { class: 'sub-title', text: k.title }),
            el('button', {
              class: 'sub-remove', type: 'button', 'aria-label': `${k.title} entfernen`,
              html: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
              onclick: () => {
                if (existing) { S.deleteTodo(k.id); renderTodos(listId); }
                else pending.splice(i, 1);
                paintSubs();
                haptic();
              },
            }),
          ]);
          return line;
        }));
        subHost.hidden = kids.length === 0;
      };

      const addSub = () => {
        const v = subInput.value.trim();
        if (!v) return;
        if (existing) {
          const kid = S.addTodo(listId, { title: v, parent: existing.id });
          // ans Ende der bisherigen Kinder
          const sibs = S.childrenOf(existing.id).filter(c => c.id !== kid.id);
          kid.order = (sibs.at(-1)?.order ?? existing.order) + 0.5;
          S.reorderTodos(listId, flatten(listId, { includeDone: true }).map(x => ({
            id: x.todo.id, parent: x.todo.parent,
          })));
          renderTodos(listId);
        } else {
          pending.push({ title: v, done: false });
        }
        subInput.value = '';
        paintSubs();
        haptic();
      };
      subInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addSub(); }
      });
      subInput.addEventListener('blur', addSub);
      paintSubs();
      body._pendingSubs = pending;

      body.append(...editorFields({
        name: field('Name', title),
        color: field('Farbe', color.node),
        due: field('Fällig am', [due, quickDue]),
        note: field('Notiz', note),
        subtasks: field('Unter-To-dos', [subHost, subInput],
          existing ? null : 'Werden nach dem Sichern angelegt.'),
      }));
      body.append(
        existing ? el('button', {
          type: 'button', class: 'btn danger', text: 'To-do löschen',
          onclick: () => {
            close();
            const kids = S.descendantsOf(existing.id).length;
            confirmSheet({
              title: 'To-do löschen?',
              message: kids
                ? `„${existing.title}" und ${kids} ${kids === 1 ? 'Unter-To-do' : 'Unter-To-dos'} werden entfernt.`
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
    onConfirm(body) {
      const fields = collect();
      if (!fields) return false;
      let saved;
      if (existing) {
        S.updateTodo(existing.id, fields);
        saved = S.todo(existing.id);
      } else {
        saved = S.addTodo(listId, fields);
        // Beim Anlegen gesammelte Unter-To-dos jetzt anhängen
        for (const p of body._pendingSubs || []) {
          S.addTodo(listId, { title: p.title, done: p.done, parent: saved.id });
        }
      }
      haptic(12);
      renderTodos(listId);
      // Das gesicherte To-do mitgeben – genau wie openHabitEditor. Ohne das
      // weiß der Aufrufer nicht, was er gerade angelegt hat.
      afterSave?.(saved);
    },
  });
}
