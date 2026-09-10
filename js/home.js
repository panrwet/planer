/* Startseite: was heute ansteht und was liegen geblieben ist.
   Die Zahlen kommen aus store.overview(), damit Startseite, Listen-Reiter und
   Suche nie auseinanderlaufen. */

import { $, el, num, formatLongDate, formatDue, daysBetween, haptic } from './util.js';
import * as S from './store.js';
import { openSheet, closeSheet, checkButton, toast } from './ui.js';

let go = () => {};
/** Navigation von außen: go('habits') | go('todos', listId) | go('settings') | go('search') */
export function bindNavigate(fn) { go = fn; }

export function renderHome() {
  const scroll = $('#home-scroll');
  const key = S.today();
  const o = S.overview(key);
  const isDark = document.documentElement.dataset.resolved === 'dark';

  $('#home-greeting').textContent = greeting();
  $('#home-date').textContent = formatLongDate(key);

  scroll.replaceChildren(
    habitCard(o, key, isDark),
    todoCard(o, key),
    o.streaks.length ? streakCard(o, isDark) : null,
    tiles(),
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

/* ---------- Habits heute ---------- */

function habitCard(o, key, isDark) {
  const { due, done, pct, total, byInterval, resting } = o.habits;

  if (!total) {
    return card('Habits', [
      el('p', { class: 'home-empty', text: 'Noch keine Habits angelegt.' }),
      linkRow('Habits öffnen', () => go('habits')),
    ]);
  }

  const parts = [];

  if (due) {
    const allDone = done === due;
    parts.push(
      el('div', { class: 'home-hero' }, [
        el('div', { class: 'home-hero-num' }, [
          String(done),
          el('span', { class: 'home-hero-of', text: ` von ${due}` }),
        ]),
        el('div', {
          class: `home-hero-txt${allDone ? ' good' : ''}`,
          text: allDone ? 'Alles erledigt ✓' : `${pct} % geschafft`,
        }),
      ]),
      el('div', { class: 'home-bar' }, [el('div', { class: 'home-bar-fill', style: `width:${pct}%` })]),
    );

    // Ein Punkt je fälliges Habit – zeigt auf einen Blick, was noch offen ist.
    const dots = el('div', { class: 'home-dots' });
    for (const h of S.habits().filter(x => S.isActiveOn(x, key))) {
      const c = S.colorOf(h.color);
      dots.append(el('span', {
        class: `home-dot${S.isDoneOn(h, key) ? ' filled' : ''}`,
        style: `--tint:${isDark ? c.dark : c.light}`,
        title: `${h.emoji || ''} ${h.name}`.trim(),
      }));
    }
    parts.push(dots);
  } else {
    parts.push(el('div', { class: 'home-hero' }, [
      el('div', { class: 'home-hero-num', text: '🌙' }),
      el('div', { class: 'home-hero-txt', text: 'Heute ist nichts eingeplant.' }),
    ]));
  }

  /* Aufschlüsselung nach Rhythmus: wie viele Habits es je Intervall gibt und
     wie viele davon in der laufenden Periode schon erfüllt sind. */
  if (byInterval.length) {
    parts.push(el('div', { class: 'home-split' }, byInterval.map(g => {
      const row = el('button', { class: 'home-split-row', type: 'button' }, [
        el('span', { class: 'home-split-label', text: g.label }),
        el('span', {
          class: 'home-split-total',
          text: g.total === 1 ? '1 Habit' : `${g.total} Habits`,
        }),
        g.due
          ? el('span', {
              class: `home-split-done${g.done === g.due ? ' good' : ''}`,
              text: `${g.done}/${g.due}`,
            })
          : el('span', { class: 'home-split-done muted', text: 'frei' }),
      ]);
      row.addEventListener('click', () => { haptic(); go('habits', g.id); });
      return row;
    })));
  }

  parts.push(el('div', { class: 'home-foot' }, [
    el('span', { text: `${total} ${total === 1 ? 'Habit' : 'Habits'} insgesamt` }),
    resting ? el('span', { class: 'dot' }) : null,
    resting ? el('span', { text: `${resting} heute nicht dran` }) : null,
  ].filter(Boolean)));

  parts.push(linkRow(
    o.habits.open ? `${o.habits.open} offen — jetzt abhaken` : 'Habits ansehen',
    () => go('habits'),
  ));

  return card('Habits heute', parts);
}

/* ---------- Aufgaben ---------- */

function todoCard(o, key) {
  const t = o.todos;
  if (!t.total) {
    return card('Aufgaben', [
      el('p', { class: 'home-empty', text: 'Noch keine Aufgaben angelegt.' }),
      linkRow('Aufgaben öffnen', () => go('todos')),
    ]);
  }

  /* Zuerst der Bestand auf einen Blick – wie bei den Habits die Hauptzahl
     oben steht. Überfällig trägt die Warnfarbe, alles andere normale
     Textfarbe. Darunter die Fälligkeiten im Einzelnen. */
  const parts = [el('div', { class: 'home-stats top' }, [
    stat(t.total, 'insgesamt'),
    stat(t.open, 'offen'),
    stat(t.done, 'erledigt'),
    stat(t.overdue.length, 'überfällig', t.overdue.length ? 'danger' : ''),
  ])];

  const buckets = [];
  const add = (label, items, cls) => {
    if (items.length) buckets.push(bucketRow(label, items, cls, key));
  };
  add('Überfällig', t.overdue, 'danger');
  add('Heute', t.today, 'accent');
  add('Morgen', t.tomorrow, '');
  add('Diese Woche', t.thisWeek, '');

  if (buckets.length) parts.push(el('div', { class: 'home-buckets' }, buckets));
  else if (t.open) {
    parts.push(el('p', { class: 'home-empty', style: 'margin-top:12px', text: 'Nichts terminiert.' }));
  }

  const extras = [];
  if (t.noDue) extras.push(`${t.noDue} ohne Datum`);
  if (t.later) extras.push(`${t.later} später`);
  if (t.lists) extras.push(`${t.lists} ${t.lists === 1 ? 'Liste' : 'Listen'}`);
  if (extras.length) {
    parts.push(el('div', { class: 'home-foot', text: extras.join(' · ') }));
  }

  parts.push(linkRow(
    t.open ? `Alle ${t.open} offenen Aufgaben` : 'Aufgaben ansehen',
    () => go('todos'),
  ));

  return card('Aufgaben', parts);
}

/** Eine Kennzahl mit Beschriftung darunter. */
function stat(value, label, cls = '') {
  return el('div', { class: `home-stat ${cls}`.trim() }, [
    el('div', { class: 'home-stat-num', text: String(value) }),
    el('div', { class: 'home-stat-label', text: label }),
  ]);
}

/** Eine Zeile wie „Überfällig 2" – öffnet die Aufgaben dieser Gruppe. */
function bucketRow(label, items, cls, key) {
  const row = el('button', { class: `home-bucket ${cls}`.trim(), type: 'button' }, [
    el('span', { class: 'home-bucket-label', text: label }),
    el('span', { class: 'home-bucket-names', text: items.map(t => t.title).join(', ') }),
    el('span', { class: 'home-bucket-count', text: String(items.length) }),
  ]);
  row.addEventListener('click', () => { haptic(); openBucket(label, items, key); });
  return row;
}

/** Sheet mit den Aufgaben einer Gruppe – direkt abhakbar. */
function openBucket(label, items, key) {
  openSheet({
    title: label,
    cancel: 'Fertig',
    build: (body) => {
      const host = el('div', { class: 'list' });
      const paint = () => {
        const live = items.map(t => S.todo(t.id)).filter(Boolean);
        if (!live.length) {
          host.replaceChildren(el('p', { class: 'home-empty', text: 'Nichts mehr offen hier.' }));
          return;
        }
        const isDark = document.documentElement.dataset.resolved === 'dark';
        host.replaceChildren(...live.map(t => {
          const l = S.list(t.listId);
          const c = t.color || l?.color;
          const tint = c ? (document.documentElement.dataset.resolved === 'dark'
            ? S.colorOf(c).dark : S.colorOf(c).light) : null;
          const late = t.due && !t.done ? -daysBetween(key, t.due) : 0;
          const row = el('div', {
            class: `row tappable${c ? ' tinted' : ''}${t.done ? ' is-done dimmed' : ''}`,
            style: c ? S.tintStyle(c, isDark) : null,
          }, [
            el('div', { class: 'row-body' }, [
              el('div', { class: 'row-title', text: t.title }),
              el('div', { class: 'row-meta' }, [
                el('span', { text: l?.name || '' }),
                t.due ? el('span', { class: 'dot' }) : null,
                t.due ? el('span', {
                  class: late > 0 ? 'overdue' : '',
                  text: late > 0 ? `${late === 1 ? '1 Tag' : `${late} Tage`} überfällig` : formatDue(t.due, key),
                }) : null,
              ].filter(Boolean)),
            ]),
            checkButton({
              value: t.done ? 1 : 0, target: 1, color: tint,
              label: t.done ? `${t.title} wieder öffnen` : `${t.title} abhaken`,
              onTap: () => { S.toggleTodo(t.id); paint(); renderHome(); },
            }),
          ]);
          row.addEventListener('click', (e) => {
            if (e.target.closest('.check')) return;
            closeSheet();
            go('todos', t.listId);
          });
          return row;
        }));
      };
      paint();
      body.append(host);
    },
    onClose: renderHome,
  });
}

/* ---------- Serien ---------- */

function streakCard(o, isDark) {
  const top = o.streaks.slice(0, 3);
  return card('Serien', top.map(({ habit: h, streak }) => {
    const c = S.colorOf(h.color);
    const row = el('button', {
      class: 'home-streak', type: 'button',
      style: `--tint:${isDark ? c.dark : c.light}`,
    }, [
      el('span', { class: 'home-streak-emoji', text: h.emoji || '•' }),
      el('span', { class: 'home-streak-name', text: h.name }),
      el('span', { class: 'home-streak-num', text: `🔥 ${streak}` }),
    ]);
    row.addEventListener('click', () => { haptic(); go('habit', h.id); });
    return row;
  }));
}

/* ---------- Kacheln ---------- */

function tiles() {
  const tile = (emoji, label, hint, onClick) => {
    const b = el('button', { class: 'home-tile', type: 'button' }, [
      el('span', { class: 'home-tile-icon', text: emoji }),
      el('span', { class: 'home-tile-label', text: label }),
      el('span', { class: 'home-tile-hint', text: hint }),
    ]);
    b.addEventListener('click', () => { haptic(); onClick(); });
    return b;
  };
  return el('div', { class: 'home-tiles' }, [
    tile('🔍', 'Suchen', 'Habits, Aufgaben, Listen', () => go('search')),
    tile('⚙️', 'Einstellungen', 'Darstellung, Backup', () => go('settings')),
  ]);
}

/* ---------- Bausteine ---------- */

function card(title, children) {
  return el('div', { class: 'card home-card' }, [
    el('h3', { text: title }),
    ...[].concat(children).filter(Boolean),
  ]);
}

function linkRow(label, onClick) {
  const b = el('button', { class: 'home-link', type: 'button' }, [
    el('span', { text: label }),
    el('span', { class: 'home-link-chev', html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>' }),
  ]);
  b.addEventListener('click', () => { haptic(); onClick(); });
  return b;
}
