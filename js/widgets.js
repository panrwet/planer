/* Der Widget-Katalog der Startseite.
 *
 * Jeder Typ beschreibt sich selbst: Name, Bereich, welche Größen er kann, ob
 * er ein Ziel braucht (ein bestimmtes Habit, eine bestimmte Liste) – und wie
 * er gezeichnet wird. Die Startseite liest nur diesen Katalog; sie weiß von
 * keinem Typ etwas. Ein neuer Typ braucht genau einen Eintrag hier.
 *
 * Drei Größen, angelehnt an das, was auf ein Telefon passt:
 *   small   eine Spalte, quadratisch    – eine Zahl, ein Ring
 *   wide    zwei Spalten, flach         – eine Zahl mit Zusatz, wenige Zeilen
 *   large   zwei Spalten, hoch          – mehrere Zeilen mit Abhak-Knopf
 *
 * Angetippt springt jedes Widget in seinen Bereich. Widgets, die einzelne
 * Zeilen zeigen, tragen zusätzlich den gewohnten Abhak-Knopf rechts – mit
 * demselben Aufleuchten wie in den Listen.
 */

import { el, svg, num, formatDue, parseKey, addDays, weekStart, weekdayOf,
         monthStart, monthDays, haptic, ICON, WEEKDAYS_SHORT } from './util.js';
import * as S from './store.js';
import { checkButton, paintCheck, flashRow } from './ui.js';

const WEEK_LETTERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/* ==========================================================================
   Gemeinsame Bausteine
   Alle Widgets sind daraus zusammengesetzt. Das hält sie untereinander
   stimmig – und eine Änderung am Aussehen greift überall.
   ========================================================================== */

/** Kopfzeile: Titel links, optional eine Kennzahl rechts. */
function head(title, right) {
  return el('div', { class: 'w-head' }, [
    el('span', { class: 'w-title', text: title }),
    right ? el('span', { class: 'w-right', text: String(right) }) : null,
  ].filter(Boolean));
}

/** Große Zahl mit Beschriftung darunter. */
function bigNum(value, label, cls = '') {
  return el('div', { class: `w-big ${cls}`.trim() }, [
    el('div', { class: 'w-big-num', text: String(value) }),
    el('div', { class: 'w-big-label', text: label }),
  ]);
}

/** Ring mit Prozentwert in der Mitte. */
function ring(pct, mitte, tint) {
  const R = 26;
  const L = 2 * Math.PI * R;
  const wrap = el('div', { class: 'w-ring', style: tint ? `--tint:${tint}` : null });
  wrap.innerHTML = `<svg viewBox="0 0 64 64">
    <circle class="w-ring-track" cx="32" cy="32" r="${R}"></circle>
    <circle class="w-ring-prog" cx="32" cy="32" r="${R}"
      stroke-dasharray="${L.toFixed(1)}" stroke-dashoffset="${(L * (1 - pct)).toFixed(1)}"></circle>
  </svg>`;
  wrap.append(el('span', { class: 'w-ring-mid', text: mitte }));
  return wrap;
}

/** Ein Punkt je Sache, gefüllt wenn erledigt. */
function dots(total, filled, tint) {
  const wrap = el('div', { class: 'w-dots', style: tint ? `--tint:${tint}` : null });
  for (let i = 0; i < Math.min(total, 24); i++) {
    wrap.append(el('span', { class: `w-dot${i < filled ? ' filled' : ''}` }));
  }
  return wrap;
}

/** Waagerechter Balken. */
function bar(pct, tint) {
  return el('div', { class: 'w-bar', style: tint ? `--tint:${tint}` : null }, [
    el('div', { class: 'w-bar-fill', style: `width:${Math.round(pct * 100)}%` }),
  ]);
}

function empty(text) {
  return el('p', { class: 'w-empty', text });
}

/** Zeile mit Zahl links und Beschriftung rechts – für Aufschlüsselungen. */
function splitRow(label, value, cls = '') {
  return el('div', { class: `w-split ${cls}`.trim() }, [
    el('span', { class: 'w-split-label', text: label }),
    el('span', { class: 'w-split-value', text: String(value) }),
  ]);
}

/**
 * Eine kompakte Zeile im Widget: Farbbalken, Emoji oder Vorspann (Uhrzeit,
 * Fälligkeit), Name, optional der gewohnte Abhak-Knopf. `onCheck` bekommt die Zeile, damit sie aufleuchten
 * kann; danach frischt `repaint` nur die Zeile auf, nicht das ganze Widget –
 * sonst würde das Aufleuchten mitten im Lauf abgeschnitten.
 */
function itemRow({ title, emoji, lead, tint, done, value, target, label, trail, onCheck }) {
  const row = el('div', { class: `w-row${done ? ' is-done' : ''}`, style: tint ? `--tint:${tint}` : null }, [
    el('span', { class: 'w-row-bar' }),
    emoji ? el('span', { class: 'w-row-emoji', text: emoji }) : null,
    lead ? el('span', { class: 'w-row-lead', text: lead }) : null,
    el('span', { class: 'w-row-title', text: title }),
    trail ? el('span', { class: 'w-row-trail', text: trail }) : null,
  ].filter(Boolean));

  if (onCheck) {
    const btn = checkButton({
      value: value ?? (done ? 1 : 0), target: target ?? 1, color: tint, label,
      onTap: () => {
        const nun = onCheck();
        row.classList.toggle('is-done', !!nun.done);
        paintCheck(btn, { value: nun.value, target: nun.target, color: tint, label: nun.label ?? label });
        if (nun.done) flashRow(row);
      },
    });
    row.append(btn);
  }
  return row;
}

/* ==========================================================================
   Hilfen für die Daten
   ========================================================================== */

const tintOf = (colorId, isDark) => {
  if (!colorId) return null;
  const c = S.colorOf(colorId);
  return isDark ? c.dark : c.light;
};

/** Die nächsten offenen To-dos mit Fälligkeit, über alle Listen. */
function nextTodos(limit) {
  return S.todosOf(S.ALL_LISTS)
    .filter(t => !t.done && t.due)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, limit);
}

/** Verplante Minuten an einem Tag, Überlappungen nur einmal gezählt. */
function plannedMinutes(key) {
  const spans = S.planOn(key).map(e => [e.start, e.end]).sort((a, b) => a[0] - b[0]);
  let summe = 0, bis = -1;
  for (const [von, ende] of spans) {
    summe += Math.max(0, ende - Math.max(von, bis));
    bis = Math.max(bis, ende);
  }
  return summe;
}

const stunden = (minuten) => {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};

/* ==========================================================================
   Der Katalog
   ========================================================================== */

/**
 * @typedef {object} WidgetTyp
 * @property {string} id
 * @property {string} label      Name in der Auswahl
 * @property {string} area       Bereich, nach dem die Auswahl gruppiert
 * @property {string} hint       ein Satz, was es zeigt
 * @property {string[]} sizes    welche Größen es kann
 * @property {'habit'|'list'} [needs]  braucht ein Ziel
 * @property {(ctx) => Node} build
 */
export const WIDGETS = [
  /* ---------- Habits ---------- */
  {
    id: 'habitsToday', label: 'Habits heute', area: 'Habits',
    hint: 'Wie viele der heute fälligen Habits schon erledigt sind.',
    sizes: ['small', 'wide', 'large'],
    build: ({ size, go, isDark, today }) => {
      const o = S.overview(today).habits;
      if (!o.total) return [head('Habits heute'), empty('Noch keine Habits angelegt.')];
      if (!o.due) return [head('Habits heute'), empty('Heute ist keines fällig.')];

      const pct = o.due ? o.done / o.due : 0;
      if (size === 'small') {
        return [head('Habits'), ring(pct, `${o.done}/${o.due}`, null)];
      }
      if (size === 'wide') {
        return [
          head('Habits heute', `${o.done}/${o.due}`),
          dots(o.due, o.done),
          bar(pct),
        ];
      }
      // groß: die fälligen Habits selbst, direkt abhakbar
      const fällig = S.habits().filter(h => S.showsOn(h, today)).slice(0, 5);
      return [
        head('Habits heute', `${o.done}/${o.due}`),
        bar(pct),
        el('div', { class: 'w-rows' }, fällig.map(h => itemRow({
          title: h.name,
          emoji: h.emoji,
          tint: tintOf(h.color, isDark),
          done: S.isDoneOn(h, today),
          value: S.progressIn(h, today),
          target: h.target,
          label: `${h.name} abhaken`,
          onCheck: () => {
            S.bump(h.id, today);
            return { done: S.isDoneOn(h, today), value: S.progressIn(h, today), target: h.target };
          },
        }))),
        fällig.length ? null : empty('Alles erledigt.'),
      ].filter(Boolean);
    },
    tap: ({ go }) => go('habits'),
  },
  {
    id: 'habitRhythm', label: 'Habits nach Rhythmus', area: 'Habits',
    hint: 'Wie viele Habits täglich, wöchentlich oder monatlich laufen.',
    sizes: ['wide', 'large'],
    build: ({ size, today }) => {
      const o = S.overview(today).habits;
      if (!o.byInterval.length) return [head('Rhythmus'), empty('Noch keine Habits angelegt.')];
      const zeilen = size === 'wide' ? o.byInterval.slice(0, 3) : o.byInterval;
      return [
        head('Habits nach Rhythmus', o.total),
        el('div', { class: 'w-splits' }, zeilen.map(g =>
          splitRow(g.label, g.due ? `${g.done}/${g.due}` : 'frei', g.due ? '' : 'quiet'))),
      ];
    },
    tap: ({ go }) => go('habits'),
  },
  {
    id: 'habitStreaks', label: 'Laufende Serien', area: 'Habits',
    hint: 'Die Habits mit der längsten laufenden Serie.',
    sizes: ['small', 'wide', 'large'],
    build: ({ size, isDark, today }) => {
      const st = S.overview(today).streaks;
      if (!st.length) return [head('Serien'), empty('Noch keine laufende Serie.')];
      if (size === 'small') {
        return [head('Längste Serie'), bigNum(st[0].streak, st[0].habit.name)];
      }
      const zeilen = st.slice(0, size === 'wide' ? 3 : 6);
      return [
        head('Laufende Serien', st.length),
        el('div', { class: 'w-rows' }, zeilen.map(s => itemRow({
          title: s.habit.name,
          emoji: s.habit.emoji,
          tint: tintOf(s.habit.color, isDark),
          trail: `${s.streak} ${s.streak === 1 ? 'Tag' : 'Tage'}`,
        }))),
      ];
    },
    tap: ({ go }) => go('habits'),
  },
  {
    id: 'singleHabit', label: 'Ein Habit', area: 'Habits',
    hint: 'Ein bestimmtes Habit mit Fortschritt, Serie und Abhaken.',
    sizes: ['small', 'wide'], needs: 'habit',
    build: ({ size, opts, isDark, today }) => {
      const h = S.habit(opts.habitId);
      if (!h) return [head('Habit'), empty('Dieses Habit gibt es nicht mehr.')];
      const wert = S.progressIn(h, today);
      const pct = h.target ? Math.min(1, wert / h.target) : 0;
      const tint = tintOf(h.color, isDark);
      const serie = S.currentStreak(h, today);

      if (size === 'small') {
        return [
          head(`${h.emoji || ''} ${h.name}`.trim()),
          ring(pct, `${num(wert)}`, tint),
          el('div', { class: 'w-note', text: serie ? `${serie} Tage Serie` : `von ${num(h.target)} ${S.unitWords(h).many}` }),
        ];
      }
      return [
        head(`${h.emoji || ''} ${h.name}`.trim(), serie ? `${serie} Tage` : ''),
        bar(pct, tint),
        el('div', { class: 'w-rows' }, [itemRow({
          title: `${num(wert)} von ${num(h.target)} ${S.unitWords(h).many}`,
          tint,
          done: S.isDoneOn(h, today),
          value: wert, target: h.target,
          label: `${h.name} abhaken`,
          onCheck: () => {
            S.bump(h.id, today);
            return { done: S.isDoneOn(h, today), value: S.progressIn(h, today), target: h.target };
          },
        })]),
      ];
    },
    tap: ({ go, opts }) => go('habit', opts.habitId),
  },
  {
    id: 'habitHeat', label: 'Habit-Verlauf', area: 'Habits',
    hint: 'Die letzten Wochen eines Habits als Raster.',
    sizes: ['wide', 'large'], needs: 'habit',
    build: ({ size, opts, isDark, today }) => {
      const h = S.habit(opts.habitId);
      if (!h) return [head('Verlauf'), empty('Dieses Habit gibt es nicht mehr.')];
      const tint = tintOf(h.color, isDark);
      const wochen = size === 'wide' ? 13 : 22;
      const start = addDays(weekStart(today), -(wochen - 1) * 7);

      const raster = el('div', { class: 'w-heat', style: `--cols:${wochen}` });
      for (let tag = 0; tag < 7; tag++) {
        for (let w = 0; w < wochen; w++) {
          const key = addDays(start, w * 7 + tag);
          const zukunft = key > today;
          const wert = S.valueOn(h.id, key);
          const voll = S.isDoneOn(h, key);
          raster.append(el('span', {
            class: `w-heat-cell${zukunft ? ' future' : voll ? ' full' : wert ? ' part' : ''}`,
            style: `grid-area:${tag + 1} / ${w + 1}`,
            title: key,
          }));
        }
      }
      return [
        head(`${h.emoji || ''} ${h.name}`.trim(), `${S.currentStreak(h, today)} Tage`),
        el('div', { class: 'w-heat-wrap', style: tint ? `--tint:${tint}` : null }, [raster]),
      ];
    },
    tap: ({ go, opts }) => go('habit', opts.habitId),
  },

  /* ---------- To-dos ---------- */
  {
    id: 'todoOverdue', label: 'Überfällig', area: 'To-dos',
    hint: 'To-dos, deren Fälligkeit vorbei ist.',
    sizes: ['small', 'wide', 'large'],
    build: ({ size, go, isDark, today }) => {
      const liste = S.overview(today).todos.overdue;
      if (!liste.length) return [head('Überfällig'), empty('Nichts überfällig.')];
      if (size === 'small') return [head('Überfällig'), bigNum(liste.length, liste.length === 1 ? 'To-do' : 'To-dos', 'danger')];
      return [
        head('Überfällig', liste.length),
        el('div', { class: 'w-rows' }, liste.slice(0, size === 'wide' ? 2 : 5).map(t => todoRow(t, isDark, today))),
      ];
    },
    tap: ({ go }) => go('todos', S.ALL_LISTS),
  },
  {
    id: 'todoToday', label: 'Heute fällig', area: 'To-dos',
    hint: 'To-dos mit Fälligkeit heute.',
    sizes: ['small', 'wide', 'large'],
    build: ({ size, isDark, today }) => {
      const liste = S.overview(today).todos.today;
      if (!liste.length) return [head('Heute fällig'), empty('Heute ist nichts fällig.')];
      if (size === 'small') return [head('Heute'), bigNum(liste.length, liste.length === 1 ? 'To-do' : 'To-dos')];
      return [
        head('Heute fällig', liste.length),
        el('div', { class: 'w-rows' }, liste.slice(0, size === 'wide' ? 2 : 5).map(t => todoRow(t, isDark, today))),
      ];
    },
    tap: ({ go }) => go('todos', S.ALL_LISTS),
  },
  {
    id: 'todoStock', label: 'To-do-Bestand', area: 'To-dos',
    hint: 'Insgesamt, offen, erledigt und überfällig als Kennzahlen.',
    sizes: ['wide'],
    build: ({ today }) => {
      const t = S.overview(today).todos;
      return [
        head('To-dos', t.total),
        el('div', { class: 'w-stats' }, [
          bigNum(t.open, 'offen'),
          bigNum(t.done, 'erledigt'),
          bigNum(t.overdue.length, 'überfällig', t.overdue.length ? 'danger' : ''),
        ]),
      ];
    },
    tap: ({ go }) => go('todos', S.ALL_LISTS),
  },
  {
    id: 'singleList', label: 'Eine Liste', area: 'To-dos',
    hint: 'Eine bestimmte Liste mit ihren offenen To-dos.',
    sizes: ['small', 'wide', 'large'], needs: 'list',
    build: ({ size, opts, isDark, today }) => {
      const l = S.list(opts.listId);
      if (!l) return [head('Liste'), empty('Diese Liste gibt es nicht mehr.')];
      const offen = S.todosOf(l.id).filter(t => !t.done);
      const titel = `${l.emoji || '📋'} ${l.name}`;
      if (size === 'small') {
        return [head(titel), bigNum(offen.length, 'offen')];
      }
      if (!offen.length) return [head(titel, 0), empty('Alles erledigt.')];
      return [
        head(titel, offen.length),
        el('div', { class: 'w-rows' }, offen.slice(0, size === 'wide' ? 2 : 5).map(t => todoRow(t, isDark, today))),
      ];
    },
    tap: ({ go, opts }) => go('todos', opts.listId),
  },
  {
    id: 'todoNext', label: 'Als Nächstes fällig', area: 'To-dos',
    hint: 'Die nächsten To-dos nach Fälligkeit, über alle Listen.',
    sizes: ['wide', 'large'],
    build: ({ size, isDark, today }) => {
      const liste = nextTodos(size === 'wide' ? 3 : 6);
      if (!liste.length) return [head('Als Nächstes'), empty('Nichts mit Fälligkeit.')];
      return [
        head('Als Nächstes fällig'),
        el('div', { class: 'w-rows' }, liste.map(t => todoRow(t, isDark, today))),
      ];
    },
    tap: ({ go }) => go('todos', S.ALL_LISTS),
  },

  /* ---------- Planung ---------- */
  {
    id: 'planToday', label: 'Plan heute', area: 'Planung',
    hint: 'Was für heute eingeplant ist, mit Uhrzeit.',
    sizes: ['wide', 'large'],
    build: ({ size, isDark, today }) => {
      const liste = S.planOn(today);
      if (!liste.length) return [head('Plan heute'), empty('Für heute ist nichts geplant.')];
      return [
        head('Plan heute', liste.length),
        el('div', { class: 'w-rows' }, liste.slice(0, size === 'wide' ? 2 : 6).map(e => planRow(e, isDark, today))),
      ];
    },
    tap: ({ go, today }) => go('day', today),
  },
  {
    id: 'planNext', label: 'Als Nächstes im Plan', area: 'Planung',
    hint: 'Der nächste eingeplante Eintrag von heute.',
    sizes: ['small', 'wide'],
    build: ({ size, isDark, today }) => {
      const jetzt = new Date().getHours() * 60 + new Date().getMinutes();
      const liste = S.planOn(today).filter(e => e.end > jetzt && !e.done);
      if (!liste.length) return [head('Als Nächstes'), empty('Heute steht nichts mehr an.')];
      const e = liste[0];
      if (size === 'small') {
        return [head('Als Nächstes'), bigNum(e.plan.time, e.title)];
      }
      return [
        head('Als Nächstes im Plan', e.plan.time),
        el('div', { class: 'w-rows' }, [planRow(e, isDark, today)]),
      ];
    },
    tap: ({ go, today }) => go('day', today),
  },
  {
    id: 'planLoad', label: 'Verplante Zeit', area: 'Planung',
    hint: 'Wie viel des heutigen Tages verplant ist.',
    sizes: ['small', 'wide'],
    build: ({ size, today }) => {
      const minuten = plannedMinutes(today);
      if (!minuten) return [head('Verplant'), empty('Heute ist nichts verplant.')];
      // Bezug sind die wachen Stunden, nicht 24 – sonst sieht jeder Tag leer aus.
      const pct = Math.min(1, minuten / (16 * 60));
      if (size === 'small') {
        return [
          head('Verplant'),
          ring(pct, `${Math.round(pct * 100)} %`, null),
          el('div', { class: 'w-note', text: stunden(minuten) }),
        ];
      }
      return [
        head('Verplante Zeit heute', stunden(minuten)),
        bar(pct),
        el('div', { class: 'w-note', text: `von 16 wachen Stunden` }),
      ];
    },
    tap: ({ go, today }) => go('day', today),
  },

  /* ---------- Kalender ---------- */
  {
    id: 'miniMonth', label: 'Monat im Kleinen', area: 'Kalender',
    hint: 'Das Monatsraster mit Punkten an verplanten Tagen.',
    sizes: ['wide', 'large'],
    build: ({ today }) => {
      const first = monthStart(today);
      const own = monthDays(today);
      const vor = (weekdayOf(first) + 6) % 7;
      const belegt = S.plannedDaysOfMonth(today);

      const raster = el('div', { class: 'w-month' });
      for (const w of WEEK_LETTERS) raster.append(el('span', { class: 'w-month-wd', text: w }));
      for (let i = 0; i < vor; i++) raster.append(el('span', {}));
      for (const key of own) {
        raster.append(el('span', {
          class: `w-month-day${key === today ? ' today' : ''}${belegt.has(key) ? ' on' : ''}`,
          text: String(parseKey(key).getDate()),
        }));
      }
      return [
        head(parseKey(first).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }), belegt.size),
        raster,
      ];
    },
    tap: ({ go }) => go('calendar'),
  },
  {
    id: 'weekAhead', label: 'Die nächsten sieben Tage', area: 'Kalender',
    hint: 'Wie viel an jedem der nächsten Tage geplant ist.',
    sizes: ['wide', 'large'],
    build: ({ today }) => {
      const tage = Array.from({ length: 7 }, (_, i) => addDays(today, i));
      const zahlen = tage.map(k => S.planOn(k).length);
      const max = Math.max(1, ...zahlen);
      return [
        head('Nächste sieben Tage', zahlen.reduce((a, b) => a + b, 0)),
        el('div', { class: 'w-week' }, tage.map((k, i) => el('div', {
          class: `w-week-day${k === today ? ' today' : ''}`,
        }, [
          el('div', { class: 'w-week-bar' }, [
            el('div', { class: 'w-week-fill', style: `height:${Math.round((zahlen[i] / max) * 100)}%` }),
          ]),
          el('span', { class: 'w-week-name', text: WEEKDAYS_SHORT[weekdayOf(k)] }),
          el('span', { class: 'w-week-num', text: zahlen[i] ? String(zahlen[i]) : '·' }),
        ]))),
      ];
    },
    tap: ({ go }) => go('calendar'),
  },

  /* ---------- Allgemein ---------- */
  {
    id: 'quickAdd', label: 'Schnell anlegen', area: 'Allgemein',
    hint: 'Knöpfe für ein neues Habit, ein neues To-do oder einen Plan-Eintrag.',
    sizes: ['wide'],
    build: ({ actions }) => [
      head('Schnell anlegen'),
      el('div', { class: 'w-quick' }, [
        quickBtn(ICON.check, 'Habit', () => actions.newHabit()),
        quickBtn(SYMBOL.todo, 'To-do', () => actions.newTodo()),
        quickBtn(SYMBOL.plan, 'Planen', () => actions.newPlan()),
      ]),
    ],
    // Kein tap: die Knöpfe sind die Handlung.
    inert: true,
  },
  {
    id: 'dayScore', label: 'Heute geschafft', area: 'Allgemein',
    hint: 'Habits und eingeplante Einträge von heute in einem Fortschritt.',
    sizes: ['small', 'wide'],
    build: ({ size, today }) => {
      const h = S.overview(today).habits;
      const p = S.planOn(today);
      const gesamt = h.due + p.length;
      const fertig = h.done + p.filter(e => e.done).length;
      if (!gesamt) return [head('Heute'), empty('Für heute steht nichts an.')];
      const pct = fertig / gesamt;
      if (size === 'small') return [head('Heute'), ring(pct, `${Math.round(pct * 100)} %`, null)];
      return [
        head('Heute geschafft', `${fertig}/${gesamt}`),
        bar(pct),
        el('div', { class: 'w-splits' }, [
          splitRow('Habits', h.due ? `${h.done}/${h.due}` : 'frei', h.due ? '' : 'quiet'),
          splitRow('Eingeplant', p.length ? `${p.filter(e => e.done).length}/${p.length}` : 'frei', p.length ? '' : 'quiet'),
        ]),
      ];
    },
    tap: ({ go, today }) => go('day', today),
  },
];

/* Dieselben Umrisse wie in der Tab-Leiste, nur als Pfade – svg() zeichnet
   keine Rechtecke. */
const SYMBOL = {
  todo: ['M8 6h13M8 12h13M8 18h13', 'M3.5 6h.01M3.5 12h.01M3.5 18h.01'],
  plan: ['M4 7.5a2.5 2.5 0 012.5-2.5h11A2.5 2.5 0 0120 7.5v10a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5z',
         'M4 10h16', 'M8.5 3.5v3M15.5 3.5v3'],
};

function quickBtn(pfad, label, onClick) {
  const zeichen = el('span', { class: 'w-quick-icon' });
  zeichen.append(svg(pfad));
  const b = el('button', { class: 'w-quick-btn', type: 'button' }, [
    zeichen,
    el('span', { text: label }),
  ]);
  b.addEventListener('click', (e) => { e.stopPropagation(); haptic(); onClick(); });
  return b;
}

/** Eine To-do-Zeile im Widget, mit Fälligkeit als Vorspann und Abhak-Knopf. */
function todoRow(t, isDark, today) {
  const l = S.list(t.listId);
  const tint = tintOf(t.color || l?.color, isDark);
  const spät = t.due && !t.done && t.due < today;
  return itemRow({
    title: t.title,
    lead: t.due ? (spät ? '⚠' : formatDue(t.due, today)) : '',
    tint,
    done: t.done,
    label: t.done ? `${t.title} wieder öffnen` : `${t.title} abhaken`,
    onCheck: () => {
      S.toggleTodo(t.id);
      const nun = !!S.todo(t.id)?.done;
      return { done: nun, value: nun ? 1 : 0, target: 1 };
    },
  });
}

/** Ein Plan-Eintrag im Widget, mit Uhrzeit als Vorspann. */
function planRow(e, isDark, key) {
  const tint = tintOf(e.color, isDark);
  if (e.kind === 'todo') {
    return itemRow({
      title: e.title, lead: e.plan.time, tint, done: e.done,
      label: e.done ? `${e.title} wieder öffnen` : `${e.title} abhaken`,
      onCheck: () => {
        S.toggleTodo(e.ref.id);
        const nun = !!S.todo(e.ref.id)?.done;
        return { done: nun, value: nun ? 1 : 0, target: 1 };
      },
    });
  }
  const h = e.ref;
  return itemRow({
    title: e.title, lead: e.plan.time, tint,
    done: S.isDoneOn(h, key), value: S.progressIn(h, key), target: h.target,
    label: `${e.title} abhaken`,
    onCheck: () => {
      S.bump(h.id, key);
      return { done: S.isDoneOn(h, key), value: S.progressIn(h, key), target: h.target };
    },
  });
}

/** Ein Typ nach seiner Kennung. */
export function widgetType(id) {
  return WIDGETS.find(w => w.id === id) || null;
}

/** Die Typen nach Bereich gruppiert – so wird die Auswahl gebaut. */
export function widgetsByArea() {
  const out = new Map();
  for (const w of WIDGETS) {
    if (!out.has(w.area)) out.set(w.area, []);
    out.get(w.area).push(w);
  }
  return out;
}

export const SIZE_LABEL = { small: 'Klein', wide: 'Breit', large: 'Groß' };
