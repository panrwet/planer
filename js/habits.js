/* Habits-Tab: nach Häufigkeit gruppierte Liste, Abhaken, Anlegen und Bearbeiten. */

import { $, el, num, plural, haptic, WEEKDAYS_SHORT, formatLongDate } from './util.js';
import * as S from './store.js';
import { attachSortable, isDragging } from './drag.js';
import {
  toast, openSheet, confirmSheet, field, editorFields, textInput, emojiPicker,
  nameWithEmoji, colorPicker, stepper, chipGroup, checkButton, sectionToggle,
  flashRow, collapseAway, paintCheck,
} from './ui.js';

/* Reihenfolge der Gruppen von oben nach unten. */
const GROUPS = S.INTERVALS.map((i) => ({ id: i.id, label: i.label, match: (h) => h.sched === i.id }));

let onOpenDetail = () => {};
export function bindDetailOpener(fn) { onOpenDetail = fn; }

/* ---------- Liste ---------- */

export function renderHabits() {
  const host = $('#habit-groups');
  const key = S.today();
  const set = S.settings();
  const all = S.habits();
  const dim = set.doneHabits === 'dim';

  $('#habits-date').textContent = formatLongDate(key);
  $('#habits-empty').hidden = all.length > 0;

  // Heute fällig, und davon getrennt das, was schon erledigt ist.
  const shown = all.filter((h) => S.showsOn(h, key));
  const parked = dim ? [] : shown.filter((h) => S.isDoneOn(h, key));
  const weekDone = all.filter((h) => !S.showsOn(h, key) && S.isActiveOn(h, key));
  const inGroups = dim ? shown : shown.filter((h) => !S.isDoneOn(h, key));

  const sections = [];
  for (const g of GROUPS) {
    const items = inGroups.filter(g.match);
    if (items.length) sections.push(groupSection(g.id, g.label, items, key, dim, true));
  }

  const done = [...parked, ...weekDone];
  if (done.length) sections.push(groupSection('done', 'Erledigt', done, key, true, false));

  if (all.length && !sections.length) {
    sections.push(el('div', { class: 'empty' }, [
      el('div', { class: 'empty-icon', text: '🌙' }),
      el('h2', { text: 'Heute nichts geplant' }),
      el('p', { text: 'Für diesen Wochentag ist kein Habit eingeplant.' }),
    ]));
  }
  host.replaceChildren(...sections);
}

/** Eine aufklappbare Gruppe. `sortable` erlaubt das Umsortieren darin. */
function groupSection(id, label, items, key, dimDone, sortable) {
  const open = S.groupOpen(id);
  const list = el('div', { class: 'list', dataset: { group: id } });
  list.hidden = !open;

  const toggle = sectionToggle({
    label, count: items.length, open,
    onToggle: (next) => { list.hidden = !next; S.setGroupOpen(id, next); },
  });

  for (const h of items) {
    const row = habitRow(h, key, dimDone);
    list.append(row);
    if (sortable) {
      attachSortable(row, row.firstElementChild, {
        host: list,
        scroll: $('#habits-scroll'),
        ignore: '.check',
        onDrop: (order) => {
          S.reorderHabits(order.map((o) => o.id));
          renderHabits();
        },
      });
    }
  }

  return el('div', { class: 'group-section' }, [toggle, list]);
}

/* Eine Habit-Zeile wird genauso behandelt wie eine To-doszeile: einmal
   gebaut, danach nur noch nachgefüllt. Beim Zählen ist das besonders sichtbar –
   der Fortschrittsring wandert von 1/3 auf 2/3, statt zu springen, weil der
   Knopf derselbe bleibt. */
function habitRow(h, key, dimIfDone) {
  const row = el('div', { class: 'row tinted tappable' });
  const wrap = el('div', { class: 'sort-wrap', dataset: { id: h.id } }, [row]);
  fillHabitRow(row, h, key, dimIfDone);

  // Ein Tipp auf die Zeile öffnet die Details – außer der Tipp beendet ein Ziehen.
  row.addEventListener('click', (e) => {
    if (isDragging() || e.target.closest('.check')) return;
    onOpenDetail(h.id);
  });
  return wrap;
}

/** Füllt eine Habit-Zeile mit dem aktuellen Stand – neu gebaut oder aufgefrischt. */
function fillHabitRow(row, h, key, dimIfDone) {
  const value = S.progressIn(h, key);
  const done = value >= h.target;
  const outOfPlan = !S.showsOn(h, key);
  const isDark = document.documentElement.dataset.resolved === 'dark';
  const c = S.colorOf(h.color);
  const tint = isDark ? c.dark : c.light;

  row.className = `row tinted tappable${done || outOfPlan ? ' is-done' : ''}${dimIfDone ? ' dimmed' : ''}`;
  row.setAttribute('style', S.tintStyle(h.color, isDark));

  const head = el('div', { class: 'row-emoji', text: h.emoji || '•' });
  const body = el('div', { class: 'row-body' }, [
    el('div', { class: 'row-title', text: h.name }),
    el('div', { class: 'row-meta' }, metaParts(h, key, value, outOfPlan)),
  ]);

  const altHead = row.querySelector('.row-emoji');
  const altBody = row.querySelector('.row-body');
  if (altHead) altHead.replaceWith(head); else row.append(head);
  if (altBody) altBody.replaceWith(body); else row.append(body);

  // Abhaken sitzt rechts – dort liegt der Daumen. Der Knopf bleibt derselbe.
  const label = done ? `${h.name} zurücksetzen` : `${h.name} abhaken`;
  const check = row.querySelector('.check');
  if (check) paintCheck(check, { value, target: h.target, color: tint, label });
  else row.append(checkButton({
    value, target: h.target, color: tint, label,
    onTap: () => countFrom(row, h.id, key, dimIfDone, false),
    onHold: () => countFrom(row, h.id, key, dimIfDone, true),
  }));
}

/**
 * Zählen, ohne die Liste neu zu bauen.
 *
 * Der häufige Fall ist ein Zwischenschritt (1 von 3) – da bleibt alles, wo es
 * ist, und nur die eine Zeile zieht nach. Erst wenn das Ziel erreicht oder
 * wieder unterschritten wird, wechselt das Habit die Gruppe; dann wird nach dem
 * Leuchten neu geordnet.
 */
function countFrom(row, id, key, dimIfDone, zurueck) {
  const vorher = S.isDoneOn(S.habit(id), key);
  if (zurueck) S.unbump(id, key); else S.bump(id, key);

  const h = S.habit(id);
  if (!h) { renderHabits(); return; }
  fillHabitRow(row, h, key, dimIfDone);

  const nachher = S.isDoneOn(h, key);
  if (nachher === vorher) { updateGroupCounts(); return; }

  // Ausgegraute Habits bleiben stehen – dann genügt das Leuchten.
  if (dimIfDone) {
    if (nachher) flashRow(row);
    updateGroupCounts();
    return;
  }

  if (!nachher) { renderHabits(); return; }     // zurück in seine Gruppe einsortieren
  flashRow(row, () => collapseAway([row.parentElement], () => renderHabits()));
}

/** Zieht nur die Zähler an den Gruppen-Überschriften nach. */
function updateGroupCounts() {
  for (const toggle of $('#habit-groups').querySelectorAll('.section-toggle')) {
    const list = toggle.nextElementSibling;
    const n = list ? list.querySelectorAll('.sort-wrap').length : 0;
    const badge = toggle.querySelector('.section-count');
    if (badge) badge.textContent = String(n);
  }
}

/** Wochentage kurz: alle sieben heißen schlicht "Jeden Tag". */
function dayList(days = []) {
  if (days.length >= 7) return 'Jeden Tag';
  return days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAYS_SHORT[d]).join(' ');
}

function metaParts(h, key, value, outOfPlan) {
  const parts = [];
  const w = S.unitWords(h);
  const iv = S.intervalOf(h);

  if (outOfPlan) {
    parts.push(el('span', { text: `Diese${h.sched === 'month' ? 'n Monat' : ' Woche'} geschafft` }));
  } else if (h.target > 1 || h.unit !== 'count') {
    parts.push(el('span', { text: `${num(value)} / ${num(h.target)} ${h.target === 1 ? w.one : w.many}` }));
    if (h.sched !== 'day' && h.sched !== 'days') {
      parts.push(el('span', { text: ` ${iv.per}` }));
    }
  }

  if (h.sched === 'days') {
    if (parts.length) parts.push(el('span', { class: 'dot' }));
    parts.push(el('span', { text: dayList(h.days) }));
  }

  const streak = S.currentStreak(h, key);
  if (streak > 1) {
    if (parts.length) parts.push(el('span', { class: 'dot' }));
    parts.push(el('span', { text: `🔥 ${streak}` }));
  }
  return parts;
}

/* ---------- Anlegen & Bearbeiten ---------- */

export function openHabitEditor(id, afterSave) {
  const existing = id ? S.habit(id) : null;
  const h = existing || {
    name: '', emoji: '', color: 'indigo',
    unit: 'count', unitLabel: '', target: 1, sched: 'day', days: [1, 2, 3, 4, 5],
  };
  let collect = () => null;

  openSheet({
    title: existing ? 'Habit bearbeiten' : 'Neues Habit',
    confirm: 'Sichern',
    build: (body, { close }) => {
      /* --- Name mit Emoji davor, Farbe --- */
      const name = textInput({ value: h.name, placeholder: 'z. B. Wasser trinken' });
      const emoji = emojiPicker(h.emoji);
      const color = colorPicker(h.color);
      if (h.name) emoji.suggest(h.name);

      /* --- Intervall: erst wie oft, dann was, dann wie viel --- */
      const sched = chipGroup(
        S.INTERVALS.map((i) => ({ id: i.id, label: i.label })),
        h.sched, { onChange: syncSched },
      );
      const days = chipGroup(
        [1, 2, 3, 4, 5, 6, 0].map((d) => ({ id: d, label: WEEKDAYS_SHORT[d] })),
        h.days || [], { multi: true, chipClass: 'day' },
      );
      const daysWrap = el('div', { style: 'margin-top:11px' }, [days.node]);

      /* --- Einheit --- */
      const unitSel = el('select', { class: 'input' },
        [...S.UNITS.map((u) => el('option', { value: u.id, text: u.label, selected: u.id === h.unit })),
         el('option', { value: 'custom', text: 'Eigene …', selected: h.unit === 'custom' })]);
      const customUnit = textInput({ value: h.unitLabel || '', placeholder: 'z. B. Kapitel', maxlength: 18 });
      const customWrap = el('div', { style: 'margin-top:9px' }, [customUnit]);
      customWrap.hidden = h.unit !== 'custom';
      unitSel.addEventListener('change', () => {
        customWrap.hidden = unitSel.value !== 'custom';
        syncAmountHint();
      });
      customUnit.addEventListener('input', () => syncAmountHint());

      /* --- Anzahl (Hinweis steht vor dem Stepper, der beim Anlegen feuert) --- */
      const amountHint = el('p', { class: 'field-hint' });
      const target = stepper(h.target, { min: 1, max: 10000, onInput: syncAmountHint });

      function syncAmountHint(t = h.target) {
        const words = S.unitWords({ unit: unitSel.value, unitLabel: customUnit.value });
        const iv = S.INTERVALS.find((i) => i.id === sched.value) || S.INTERVALS[0];
        const menge = `${num(t)} ${t === 1 ? words.one : words.many} ${iv.per}`;
        amountHint.textContent = t === 1 && unitSel.value === 'count'
          ? `Ein Tipp hakt das Habit ab. Ziel: einmal ${iv.per}.`
          : `Ein Tipp zählt hoch, gedrückt halten zählt zurück. Ziel: ${menge}.`;
      }
      function syncSched(v) {
        daysWrap.hidden = v !== 'days';
        syncAmountHint(target.value);
      }
      syncSched(h.sched);

      body.append(...editorFields({
        name: field('Name', nameWithEmoji(name, emoji)),
        emoji: emoji.node,
        color: field('Farbe', color.node),
        interval: field('Wie oft', [sched.node, daysWrap]),
        unit: field('Was wird gezählt?', [unitSel, customWrap]),
        amount: field('Wie viele', [target.node, amountHint]),
      }));

      if (existing) {
        body.append(el('button', {
          type: 'button', class: 'btn danger', text: 'Habit löschen',
          onclick: () => {
            close();
            confirmSheet({
              title: 'Habit löschen?',
              message: `„${existing.name}" und alle erfassten Tage werden entfernt. Das lässt sich nicht rückgängig machen.`,
              onConfirm: () => { S.deleteHabit(existing.id); toast('Habit gelöscht'); afterSave?.(null); },
            });
          },
        }));
      }

      setTimeout(() => { if (!existing) name.focus(); }, 320);

      collect = () => {
        const n = name.value.trim();
        if (!n) { name.focus(); toast('Bitte einen Namen eingeben'); return null; }
        if (sched.value === 'days' && !days.value.length) { toast('Bitte mindestens einen Wochentag wählen'); return null; }
        return {
          name: n,
          emoji: emoji.value || '⭐️',
          color: color.value,
          unit: unitSel.value,
          unitLabel: unitSel.value === 'custom' ? customUnit.value.trim() : '',
          target: target.value,
          sched: sched.value,
          days: days.value.length ? days.value : [1, 2, 3, 4, 5],
        };
      };
    },
    onConfirm() {
      const fields = collect();
      if (!fields) return false;
      const saved = existing ? S.updateHabit(existing.id, fields) : S.addHabit(fields);
      S.rememberEmoji(fields.emoji);
      haptic(12);
      toast(existing ? 'Gesichert' : `„${saved.name}" angelegt`);
      afterSave?.(saved);
    },
  });
}
