/* Habits-Tab: nach Häufigkeit gruppierte Liste, Abhaken, Anlegen und Bearbeiten. */

import { $, el, num, plural, haptic, WEEKDAYS_SHORT, formatLongDate } from './util.js';
import * as S from './store.js';
import { attachSortable, isDragging } from './drag.js';
import {
  toast, openSheet, confirmSheet, field, textInput, emojiPicker, colorPicker,
  stepper, chipGroup, checkButton, sectionToggle,
} from './ui.js';

const EMOJI_SUGGESTIONS = ['💧', '🏃', '📖', '🧘', '💪', '🥗', '😴', '✍️', '🎯', '🧹', '💊', '🌱', '🎸', '🧠', '☀️', '⭐️'];

/* Reihenfolge der Gruppen von oben nach unten. */
const GROUPS = [
  { id: 'daily', label: 'Täglich',              match: (h) => h.sched === 'daily' },
  { id: 'days',  label: 'An bestimmten Tagen',  match: (h) => h.sched === 'days' },
  { id: 'week',  label: 'Pro Woche',            match: (h) => h.sched === 'week' },
];

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

function habitRow(h, key, dimIfDone) {
  const value = S.valueOn(h.id, key);
  const done = value >= h.target;
  const outOfPlan = !S.showsOn(h, key);
  const isDark = document.documentElement.dataset.resolved === 'dark';
  const c = S.colorOf(h.color);
  const tint = isDark ? c.dark : c.light;

  const row = el('div', {
    class: `row tinted tappable${done || outOfPlan ? ' is-done' : ''}${dimIfDone ? ' dimmed' : ''}`,
    style: S.tintStyle(h.color, isDark),
  }, [
    el('div', { class: 'row-emoji', text: h.emoji || '•' }),
    el('div', { class: 'row-body' }, [
      el('div', { class: 'row-title', text: h.name }),
      el('div', { class: 'row-meta' }, metaParts(h, key, value, outOfPlan)),
    ]),
    // Abhaken sitzt rechts – dort liegt der Daumen.
    checkButton({
      value, target: h.target, color: tint,
      label: done ? `${h.name} zurücksetzen` : `${h.name} abhaken`,
      onTap: () => { S.bump(h.id, key); renderHabits(); },
      onHold: () => { S.unbump(h.id, key); renderHabits(); },
    }),
  ]);

  // Ein Tipp auf die Zeile öffnet die Details – außer der Tipp beendet ein Ziehen.
  row.addEventListener('click', (e) => {
    if (isDragging() || e.target.closest('.check')) return;
    onOpenDetail(h.id);
  });

  return el('div', { class: 'sort-wrap', dataset: { id: h.id } }, [row]);
}

/** Wochentage kurz: alle sieben heißen schlicht "Jeden Tag". */
function dayList(days = []) {
  if (days.length >= 7) return 'Jeden Tag';
  return days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAYS_SHORT[d]).join(' ');
}

function metaParts(h, key, value, outOfPlan) {

  const parts = [];
  const w = S.unitWords(h);

  if (outOfPlan) {
    parts.push(el('span', { text: 'Diese Woche geschafft' }));
  } else if (h.target > 1) {
    parts.push(el('span', { text: `${num(value)} / ${num(h.target)} ${value === 1 ? w.one : w.many}` }));
  } else if (h.unit !== 'count') {
    parts.push(el('span', { text: plural(h.target, w.one, w.many) }));
  }

  if (h.sched === 'week') {
    const n = S.weekCount(h, key);
    if (!outOfPlan) {
      if (parts.length) parts.push(el('span', { class: 'dot' }));
      parts.push(el('span', { text: `${n}/${h.weekTarget} pro Woche` }));
    }
  } else if (h.sched === 'days') {
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
    name: '', emoji: '⭐️', color: 'indigo', unit: 'count', unitLabel: '',
    target: 1, sched: 'daily', days: [1, 2, 3, 4, 5], weekTarget: 3,
  };

  let collect = () => null;

  openSheet({
    title: existing ? 'Habit bearbeiten' : 'Neues Habit',
    confirm: 'Sichern',
    build: (body, { close }) => {
      const name = textInput({ value: h.name, placeholder: 'z. B. Wasser trinken' });
      const emoji = emojiPicker(h.emoji, EMOJI_SUGGESTIONS);
      const color = colorPicker(h.color);

      /* --- Einheit --- */
      const unitSel = el('select', { class: 'input' },
        [...S.UNITS.map(u => el('option', { value: u.id, text: u.label, selected: u.id === h.unit })),
         el('option', { value: 'custom', text: 'Eigene …', selected: h.unit === 'custom' })]);
      const customUnit = textInput({ value: h.unitLabel || '', placeholder: 'z. B. Kapitel', maxlength: 18 });
      const customWrap = el('div', { style: 'margin-top:9px' }, [customUnit]);
      customWrap.hidden = h.unit !== 'custom';
      unitSel.addEventListener('change', () => {
        customWrap.hidden = unitSel.value !== 'custom';
        syncTargetHint();
      });

      /* --- Zielwert ---
         Der Hinweistext steht vor dem Stepper, weil dieser sein onInput schon
         beim Anlegen einmal auslöst. */
      const targetHint = el('p', { class: 'field-hint' });
      const target = stepper(h.target, { min: 1, max: 1000, onInput: syncTargetHint });
      customUnit.addEventListener('input', () => syncTargetHint());

      function syncTargetHint(t = h.target) {
        const words = S.unitWords({ unit: unitSel.value, unitLabel: customUnit.value });
        targetHint.textContent = t === 1
          ? 'Ein Tipp hakt das Habit ab.'
          : `Ein Tipp zählt hoch, gedrückt halten zählt zurück. Ziel: ${num(t)} ${words.many} pro Tag.`;
      }

      /* --- Zeitplan --- */
      const sched = chipGroup(
        [{ id: 'daily', label: 'Jeden Tag' }, { id: 'days', label: 'Bestimmte Tage' }, { id: 'week', label: 'X pro Woche' }],
        h.sched, { onChange: syncSched },
      );
      const days = chipGroup(
        [1, 2, 3, 4, 5, 6, 0].map(d => ({ id: d, label: WEEKDAYS_SHORT[d] })),
        h.days || [], { multi: true, chipClass: 'day' },
      );
      const weekHint = el('p', { class: 'field-hint' });
      const weekTarget = stepper(h.weekTarget || 3, { min: 1, max: 7, onInput: syncWeekHint });
      const daysWrap = el('div', { style: 'margin-top:11px' }, [days.node]);
      const weekWrap = el('div', { style: 'margin-top:11px' }, [weekTarget.node, weekHint]);

      function syncWeekHint(n = h.weekTarget || 3) {
        weekHint.textContent = `An ${n} Tagen pro Woche das Tagesziel erreichen. Welche Tage, ist dir überlassen.`;
      }
      function syncSched(v) {
        daysWrap.hidden = v !== 'days';
        weekWrap.hidden = v !== 'week';
      }
      syncSched(h.sched);

      body.append(
        field('Name', name),
        field('Emoji', emoji.node),
        field('Farbe', color.node),
        field('Was wird gezählt?', [unitSel, customWrap]),
        field('Tagesziel', [target.node, targetHint]),
        field('Wann', [sched.node, daysWrap, weekWrap]),
        existing ? el('button', {
          type: 'button', class: 'btn danger', text: 'Habit löschen',
          onclick: () => {
            close();
            confirmSheet({
              title: 'Habit löschen?',
              message: `„${existing.name}“ und alle erfassten Tage werden entfernt. Das lässt sich nicht rückgängig machen.`,
              onConfirm: () => { S.deleteHabit(existing.id); toast('Habit gelöscht'); afterSave?.(null); },
            });
          },
        }) : null,
      );

      setTimeout(() => { if (!existing) name.focus(); }, 320);

      // Werte beim Sichern einsammeln; null bedeutet "Eingabe unvollständig".
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
          weekTarget: weekTarget.value,
        };
      };
    },
    onConfirm() {
      const fields = collect();
      if (!fields) return false;
      const saved = existing ? S.updateHabit(existing.id, fields) : S.addHabit(fields);
      haptic(12);
      toast(existing ? 'Gesichert' : `„${saved.name}“ angelegt`);
      afterSave?.(saved);
    },
  });
}
