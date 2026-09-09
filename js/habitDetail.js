/* Detailansicht eines Habits: Streaks, Heatmap-Kalender, Balken der letzten
   30 Tage. Alle Diagramme zeigen eine Größe in der Farbe des Habits – die
   Heatmap als sequentielle Rampe (hell -> kräftig), nie als Farbmischung. */

import { $, el, num, addDays, parseKey, weekStart, formatLongDate,
         MONTHS_SHORT, WEEKDAYS_SHORT, haptic } from './util.js';
import * as S from './store.js';
import { openSheet, closeSheet, stepper, toast } from './ui.js';

const HEATMAP_WEEKS = 26;
const BAR_DAYS = 30;

export function renderDetail(habitId, rerender) {
  const h = S.habit(habitId);
  const scroll = $('#detail-scroll');
  if (!h) { scroll.replaceChildren(); return; }

  const isDark = document.documentElement.dataset.resolved === 'dark';
  const c = S.colorOf(h.color);
  const tint = isDark ? c.dark : c.light;
  const surface = isDark ? '#1a1a1e' : '#ffffff';
  const key = S.today();
  const words = S.unitWords(h);

  scroll.setAttribute('style', S.tintStyle(h.color, isDark));
  scroll.replaceChildren(
    hero(h, words),
    todayCard(h, key, tint, rerender),
    statsCard(h, key),
    heatmapCard(h, key, tint, surface, rerender),
    barsCard(h, key, tint),
  );
}

/* ---------- Kopf ---------- */

function hero(h, words) {
  const iv = S.intervalOf(h);
  const bits = [`${num(h.target)} ${h.target === 1 ? words.one : words.many} ${iv.per}`];
  if (h.sched === 'days') {
    const days = h.days || [];
    bits.push(days.length >= 7
      ? 'jeden Tag'
      : days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => WEEKDAYS_SHORT[d]).join(' '));
  }
  return el('div', { class: 'detail-hero' }, [
    el('div', { class: 'big-emoji', text: h.emoji || '•' }),
    el('div', {}, [
      el('h2', { text: h.name }),
      el('div', { class: 'goal', text: bits.join(' · ') }),
      h.note ? el('div', { class: 'goal', style: 'margin-top:5px', text: h.note }) : null,
    ]),
  ]);
}

/* ---------- Heute ---------- */

function todayCard(h, key, tint, rerender) {
  const iv = S.intervalOf(h);
  const reached = S.progressIn(h, key);
  const todayValue = S.valueOn(h.id, key);
  const done = reached >= h.target;
  const over = Math.max(0, reached - h.target);
  const pct = Math.min(100, Math.round((reached / h.target) * 100));
  const words = S.unitWords(h);
  const periodic = h.sched === 'week' || h.sched === 'month';

  const bar = el('div', {
    style: 'height:8px;border-radius:99px;background:var(--surface-2);overflow:hidden;margin-top:12px',
  }, [el('div', { style: `height:100%;width:${pct}%;background:${tint};border-radius:99px;transition:width .3s cubic-bezier(.2,.8,.3,1)` })]);

  const minus = el('button', {
    type: 'button', class: 'btn secondary', text: '−', style: 'flex:none;width:54px',
    'aria-label': 'Weniger',
    onclick: () => { S.unbump(h.id, key); haptic(); rerender(); },
  });

  // Ist das Ziel erreicht, zählt der Hauptknopf bewusst weiter hoch statt
  // zurückzusetzen – dafür gibt es darunter einen eigenen Knopf.
  const plus = el('button', {
    type: 'button', class: 'btn', style: 'flex:1',
    text: done ? `Noch ${num(S.step(h))} ${S.step(h) === 1 ? words.one : words.many} zählen`
               : (h.target > 1 ? `+${num(S.step(h))}` : 'Abhaken'),
    onclick: () => {
      if (done) S.bumpBeyond(h.id, key);
      else S.bump(h.id, key);
      haptic(12);
      rerender();
    },
  });

  const rows = [
    el('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;gap:8px' }, [
      el('div', { style: 'font-size:26px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums' },
        [`${num(reached)}`, el('span', { style: 'font-size:15px;color:var(--text-3);font-weight:600', text: ` / ${num(h.target)}` })]),
      el('div', {
        style: `font-size:13px;font-weight:650;color:${done ? tint : 'var(--text-3)'}`,
        text: done ? (over > 0 ? `${num(over)} mehr als geplant` : 'Geschafft ✓') : `${pct} %`,
      }),
    ]),
    bar,
    el('div', { style: 'display:flex;gap:9px;margin-top:14px' }, [minus, plus]),
  ];

  if (todayValue > 0) {
    rows.push(el('button', {
      type: 'button', class: 'btn secondary', style: 'margin-top:9px',
      text: periodic ? 'Heutigen Beitrag zurücksetzen' : 'Zurücksetzen',
      onclick: () => { S.setValue(h.id, key, 0); haptic(); rerender(); },
    }));
  }

  if (periodic) {
    rows.push(el('p', {
      class: 'card-note',
      text: `${iv.per.replace('pro', 'Diese')} zusammen ${num(reached)} von ${num(h.target)}${todayValue ? ` · heute ${num(todayValue)}` : ''}.`
        .replace('Diese Monat', 'Diesen Monat'),
    }));
  }

  return el('div', { class: 'card' }, [
    el('h3', { text: periodic ? iv.label : 'Heute' }),
    ...rows,
  ]);
}

/* ---------- Kennzahlen ---------- */

function statsCard(h, key) {
  const cur = S.currentStreak(h, key);
  const best = S.longestStreak(h);
  const rate = S.completionRate(h, key);
  const iv = S.intervalOf(h);
  const unit = { one: iv.noun, many: iv.nounPl };

  const stat = (val, unitTxt, lbl) => el('div', { class: 'stat' }, [
    el('div', { class: 'val' }, [String(val), unitTxt ? el('span', { class: 'unit', text: unitTxt }) : null]),
    el('div', { class: 'lbl', text: lbl }),
  ]);

  return el('div', { class: 'card' }, [
    el('h3', { text: 'Statistik' }),
    el('div', { class: 'stat-grid' }, [
      stat(cur, cur === 1 ? unit.one : unit.many, 'Aktuelle Serie'),
      stat(best, best === 1 ? unit.one : unit.many, 'Längste Serie'),
      stat(rate.pct, '%', 'Erfolgsquote'),
    ]),
    el('p', { class: 'card-note', text: `${rate.done} von ${rate.due} ${rate.due === 1 ? iv.noun : iv.nounPl} seit dem ${parseKey(h.created || key).toLocaleDateString('de-DE')}.` }),
  ]);
}

/* ---------- Heatmap ---------- */

/** Sequentielle Rampe: eine Farbe, hell nach kräftig. Stufe 0 ist der
    neutrale Untergrund, damit „nichts“ nie wie „wenig“ aussieht. */
function rampStep(value, target, tint, surface) {
  if (value <= 0) return null;
  const pct = Math.min(1, value / target);
  const mix = pct >= 1 ? 100 : pct >= 0.66 ? 72 : pct >= 0.33 ? 48 : 26;
  return `color-mix(in oklab, ${tint} ${mix}%, ${surface})`;
}

/** Tagesbezogener Maßstab für Kalender und Balken. Bei Wochen- und
    Monatszielen wäre das Intervallziel als Tagesmaßstab zu grob – dann
    erschienen fast alle Tage blass. */
function dayTarget(h) {
  if (h.sched === 'week') return Math.max(1, h.target / 7);
  if (h.sched === 'month') return Math.max(1, h.target / 30);
  return h.target;
}

function heatmapCard(h, key, tint, surface, rerender) {
  const grid = el('div', { class: 'heatmap' });
  const months = el('div', { class: 'hm-months' });

  // Spalten sind Wochen (Montag oben), letzte Spalte ist die laufende Woche.
  const lastMonday = weekStart(key);
  const firstMonday = addDays(lastMonday, -7 * (HEATMAP_WEEKS - 1));
  let lastLabel = '';

  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const monday = addDays(firstMonday, 7 * w);
    const col = el('div', { class: 'hm-col' });

    for (let d = 0; d < 7; d++) {
      const day = addDays(monday, d);
      if (day > key) { col.append(el('div', { class: 'hm-cell off' })); continue; }

      const value = S.valueOn(h.id, day);
      const active = S.isActiveOn(h, day);
      const fill = rampStep(value, dayTarget(h), tint, surface);
      const cell = el('button', {
        type: 'button',
        class: `hm-cell${!active && !value ? ' inactive' : ''}${day === key ? ' today' : ''}`,
        style: fill ? `background:${fill}` : null,
        'aria-label': `${formatLongDate(day)}: ${num(value)}`,
        dataset: { day },
      });
      cell.addEventListener('click', () => openDayEditor(h, day, rerender));
      col.append(cell);
    }
    grid.append(col);

    const label = MONTHS_SHORT[parseKey(monday).getMonth()];
    const showLabel = label !== lastLabel && parseKey(monday).getDate() <= 7;
    months.append(el('span', { text: showLabel ? label : '' }));
    if (showLabel) lastLabel = label;
  }

  const legendCell = (v) => el('div', {
    class: 'hm-cell',
    style: v ? `background:${rampStep(v, 4, tint, surface)}` : null,
  });

  const card = el('div', { class: 'card' }, [
    el('h3', { text: `Kalender · ${HEATMAP_WEEKS} Wochen` }),
    el('div', { class: 'heatmap-scroll' }, [el('div', {}, [months, grid])]),
    el('div', { class: 'hm-legend' }, [
      el('span', { text: 'weniger' }), legendCell(0), legendCell(1), legendCell(2), legendCell(3), legendCell(4),
      el('span', { text: 'mehr' }),
    ]),
    el('p', { class: 'card-note', text: 'Tippe auf einen Tag, um ihn nachzutragen oder zu korrigieren. Schraffierte Tage waren nicht eingeplant.' }),
  ]);

  // Ans rechte Ende scrollen – dort steht die aktuelle Woche.
  requestAnimationFrame(() => {
    const sc = card.querySelector('.heatmap-scroll');
    sc.scrollLeft = sc.scrollWidth;
  });
  return card;
}

/* ---------- Balken ---------- */

function barsCard(h, key, tint) {
  const start = addDays(key, -(BAR_DAYS - 1));
  const values = [];
  for (let i = 0; i < BAR_DAYS; i++) {
    const day = addDays(start, i);
    values.push({ day, value: S.valueOn(h.id, day), active: S.isActiveOn(h, day) });
  }
  const max = Math.max(dayTarget(h), ...values.map(v => v.value));

  const cols = values.map(({ day, value }) => {
    const pct = max > 0 ? (value / max) * 100 : 0;
    const cls = value >= h.target ? '' : value > 0 ? ' partial' : ' empty';
    return el('div', { class: 'bar-col', title: `${formatLongDate(day)}: ${num(value)}` }, [
      el('div', {
        class: `bar${cls}`,
        style: `height:${value > 0 ? Math.max(pct, 4) : 3}%`,
      }),
    ]);
  });

  const goalLine = el('div', {
    class: 'bar-goal',
    style: `bottom:${max > 0 ? (dayTarget(h) / max) * 100 : 100}%`,
  });

  return el('div', { class: 'card' }, [
    el('h3', { text: `Letzte ${BAR_DAYS} Tage` }),
    el('div', { class: 'bars-wrap' }, [
      el('div', { class: 'bars' }, cols),
      goalLine,
    ]),
    el('div', { class: 'bars-axis' }, [
      el('span', { text: parseKey(start).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }) }),
      el('span', { text: 'heute' }),
    ]),
    el('p', {
      class: 'card-note',
      text: h.sched === 'week' || h.sched === 'month'
        ? `Die Linie markiert den Tagesdurchschnitt, der für ${num(h.target)} ${S.intervalOf(h).per} nötig ist.`
        : `Die Linie markiert das Tagesziel von ${num(h.target)}.`,
    }),
  ]);
}

/* ---------- Einen Tag nachtragen ---------- */

export function openDayEditor(h, day, rerender) {
  const current = S.valueOn(h.id, day);
  let picked = current;

  openSheet({
    title: formatLongDate(day),
    confirm: 'Sichern',
    build: (body) => {
      const words = S.unitWords(h);
      const st = stepper(current, { min: 0, max: h.target * 10, onInput: v => { picked = v; } });
      picked = st.value;

      body.append(
        el('p', {
          class: 'field-hint',
          style: 'margin:-4px 0 14px',
          text: `Ziel: ${num(h.target)} ${h.target === 1 ? words.one : words.many} ${S.intervalOf(h).per}${S.isActiveOn(h, day) ? '' : ' · an diesem Wochentag nicht eingeplant'}`,
        }),
        st.node,
        el('div', { style: 'display:flex;gap:9px;margin-top:16px' }, [
          el('button', {
            type: 'button', class: 'btn secondary', style: 'flex:1', text: 'Nicht gemacht',
            onclick: () => { S.setValue(h.id, day, 0); rerender(); closeAndToast('Zurückgesetzt'); },
          }),
          el('button', {
            type: 'button', class: 'btn', style: 'flex:1', text: 'Geschafft',
            onclick: () => { S.setValue(h.id, day, dayTarget(h)); rerender(); closeAndToast('Eingetragen'); },
          }),
        ]),
      );
    },
    onConfirm() {
      S.setValue(h.id, day, picked);
      rerender();
      toast('Eingetragen');
    },
  });

  function closeAndToast(msg) {
    haptic(12);
    closeSheet();
    toast(msg);
  }
}
