/* Kalender und Tagesplan.
 *
 * Zwei Bildschirme: das Monatsraster gibt den Überblick, der Tagesplan die
 * Stunden. Beide sind am Apple Kalender orientiert – Monatsraster mit Punkten
 * an belegten Tagen, Tagesplan von oben nach unten mit Stundenlinien und
 * Blöcken dazwischen.
 *
 * Geplant wird nur, was ausgewählt wurde. Von allein erscheint nichts; die
 * Regeln dazu stehen im Store bei planOn().
 */

import { $, el, haptic, num, clamp, formatDue, parseKey, monthStart, monthDays, addMonths,
         addDays, weekdayOf, weekStart } from './util.js';
import * as S from './store.js';
import { openSheet, field, segmented, stepper, switchBtn,
         checkButton, paintCheck, flashRow, toast } from './ui.js';
import { holdScroll } from './drag.js';
import { openHabitEditor } from './habits.js';
import { openTodoEditor } from './todos.js';

/* Ein Stundenblock ist 80 px hoch: Damit ist eine halbe Stunde 40 px und der
   Abhak-Knopf passt in seiner normalen Größe hinein. Kleiner, und man müsste
   ihn für den Plan verkleinern – dann wäre er unter dem Richtwert für
   Tippziele, den die App überall sonst einhält. */
const HOUR_H = 80;
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WEEK_LETTERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

let month = null;      // Tagesschlüssel im angezeigten Monat
let day = null;        // Tagesschlüssel des offenen Tages
let clockTimer = null;

/* Monat und ausgewählter Tag hängen zusammen: Das Monatsraster hebt den
   ausgewählten Tag hervor und zeigt ihn darunter im Einzelnen, der Tagesplan
   und der Wochenstreifen zeigen denselben Tag. Ein Zustand für alles – zwei
   getrennte würden früher oder später auseinanderlaufen und ein September-
   Raster mit einem Oktober-Tag darunter zeigen. */
export function setDay(key) {
  day = key || S.today();
  month = monthStart(day);
}
export function currentDay() { return day; }

/** Montag zuerst: weekdayOf liefert 0 für Sonntag. */
const weekIndex = (key) => (weekdayOf(key) + 6) % 7;

/* ==========================================================================
   Monatsraster
   ========================================================================== */

export function renderCalendar() {
  if (!day) setDay(S.today());
  const scroll = $('#calendar-scroll');
  const first = monthStart(month);
  const today = S.today();
  const belegt = S.plannedDaysOfMonth(month);

  $('#calendar-title').textContent = `${MONTHS[parseKey(first).getMonth()]} ${parseKey(first).getFullYear()}`;
  $('#calendar-today').hidden = first === monthStart(today);

  /* Das Raster läuft durchgehend von einem Montag zu einem Sonntag: führende
     Tage aus dem Vormonat, nachlaufende aus dem Folgemonat. Gerechnet wird aus
     einem Startdatum und einer Anzahl, nicht Zelle für Zelle – ein Auffüllen
     über den Rest einer wachsenden Länge zählt falsch, weil sich der Rest mit
     jeder Zelle ändert. */
  const own = monthDays(month);
  const last = own[own.length - 1];
  const start = addDays(first, -weekIndex(first));
  const anzahl = Math.ceil((weekIndex(first) + own.length) / 7) * 7;
  const cells = Array.from({ length: anzahl }, (_, i) => {
    const key = addDays(start, i);
    return { key, fremd: key < first || key > last };
  });

  const grid = el('div', { class: 'cal-grid' });
  for (const c of cells) {
    const n = parseKey(c.key).getDate();
    const gewaehlt = c.key === day;
    const cell = el('button', {
      class: `cal-day${c.fremd ? ' foreign' : ''}${c.key === today ? ' today' : ''}${gewaehlt ? ' selected' : ''}`,
      type: 'button',
      dataset: { key: c.key },
      'aria-label': `${n}. ${MONTHS[parseKey(c.key).getMonth()]}${belegt.has(c.key) ? ', etwas geplant' : ''}`,
      'aria-current': gewaehlt ? 'date' : null,
    }, [
      el('span', { class: 'cal-num', text: String(n) }),
      el('span', { class: `cal-dot${belegt.has(c.key) || (c.fremd && S.hasPlanOn(c.key)) ? ' on' : ''}` }),
    ]);
    /* Der erste Tipp wählt den Tag aus und zeigt ihn darunter, der zweite
       öffnet den Plan. So sieht man erst, was ansteht, ohne den Kalender zu
       verlassen – und kommt mit einem weiteren Tipp doch hinein. */
    cell.addEventListener('click', () => {
      haptic();
      if (gewaehlt) { openDay(c.key); return; }
      setDay(c.key);
      renderCalendar();
    });
    grid.append(cell);
  }

  scroll.replaceChildren(
    el('div', { class: 'cal-weekdays' }, WEEK_LETTERS.map(w => el('span', { text: w }))),
    grid,
    dayPreview(),
  );
}

/**
 * Der ausgewählte Tag im Einzelnen, direkt unter dem Raster: alles Geplante
 * untereinander mit seiner Uhrzeit. Die ganze Fläche ist ein Knopf in den
 * Tagesplan – hier wird nur gezeigt, nicht geändert.
 */
function dayPreview() {
  const entries = S.planOn(day);
  const heute = day === S.today();
  const isDark = document.documentElement.dataset.resolved === 'dark';

  const kopf = el('div', { class: 'cal-day-head' }, [
    el('div', {}, [
      el('div', { class: `cal-day-name${heute ? ' is-today' : ''}`,
        text: parseKey(day).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }) }),
      el('div', { class: 'cal-day-count', text: entries.length
        ? `${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}${
            entries.every(x => x.done) ? ' · alles erledigt' : ''}`
        : 'Nichts geplant · tippen zum Planen' }),
    ]),
    el('span', { class: 'cal-day-chev', html: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>' }),
  ]);

  const liste = el('div', { class: 'cal-day-list' }, entries.map((e) => {
    const c = e.color ? S.colorOf(e.color) : null;
    return el('div', {
      class: `cal-entry${e.done ? ' is-done' : ''}`,
      style: c ? `--tint:${isDark ? c.dark : c.light}` : null,
    }, [
      el('span', { class: 'cal-entry-time', text: e.plan.time }),
      el('span', { class: 'cal-entry-bar' }),
      el('span', { class: 'cal-entry-title' }, [
        e.emoji ? el('span', { class: 'cal-entry-emoji', text: e.emoji }) : null,
        el('span', { text: e.title }),
      ].filter(Boolean)),
      e.plan.repeat ? el('span', { class: 'cal-entry-mark', text: '↻', title: 'dauerhaft' }) : null,
    ].filter(Boolean));
  }));

  const knopf = el('button', { class: 'cal-day-card', type: 'button',
    'aria-label': `Tagesplan für ${parseKey(day).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} öffnen` },
    entries.length ? [kopf, liste] : [kopf]);
  knopf.addEventListener('click', () => { haptic(); openDay(day); });
  return knopf;
}

export function stepMonth(n) {
  /* Der ausgewählte Tag wandert mit, damit die Ansicht darunter zum Raster
     passt: gleicher Tag im neuen Monat, bei kürzeren Monaten der letzte. */
  const ziel = monthStart(addMonths(month || S.today(), n));
  const tage = monthDays(ziel);
  const wunsch = parseKey(day || S.today()).getDate();
  setDay(tage[Math.min(wunsch, tage.length) - 1]);
  renderCalendar();
}

export function jumpToToday() {
  setDay(S.today());
  renderCalendar();
}

let openDayHook = () => {};
export function bindOpenDay(fn) { openDayHook = fn; }
function openDay(key) { openDayHook(key); }

/* ==========================================================================
   Wochenstreifen über dem Tagesplan
   Sieben Tage, der offene hervorgehoben – wie die Leiste über der Tagesansicht
   im Apple Kalender. Wischen wechselt die Woche.
   ========================================================================== */

function renderWeekStrip() {
  const strip = $('#week-strip');
  const heute = S.today();
  const start = weekStart(day);

  strip.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
    const key = addDays(start, i);
    const d = parseKey(key);
    const knopf = el('button', {
      class: `week-day${key === day ? ' selected' : ''}${key === heute ? ' today' : ''}`,
      type: 'button',
      dataset: { key },
      'aria-label': d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
      'aria-current': key === day ? 'date' : null,
    }, [
      el('span', { class: 'week-day-name', text: WEEK_LETTERS[i] }),
      el('span', { class: 'week-day-num', text: String(d.getDate()) }),
      el('span', { class: `week-day-dot${S.hasPlanOn(key) ? ' on' : ''}` }),
    ]);
    knopf.addEventListener('click', () => { haptic(); day = key; renderDayPlan(); });
    return knopf;
  }));

  armWeekSwipe(strip);
}

/* Wischen über dem Streifen blättert Wochen. Die Behandlung hängt nur einmal
   am Element – der Streifen wird bei jedem Tageswechsel neu gefüllt, und ein
   zweiter Satz Zuhörer würde jede Geste doppelt zählen. */
let weekSwipeArmed = null;
function armWeekSwipe(strip) {
  if (weekSwipeArmed === strip) return;
  weekSwipeArmed = strip;
  let x0 = 0, y0 = 0, aktiv = false;

  strip.addEventListener('pointerdown', (e) => { aktiv = true; x0 = e.clientX; y0 = e.clientY; });
  strip.addEventListener('pointermove', (e) => {
    if (!aktiv) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(e.clientY - y0)) return;
    aktiv = false;
    // Die Woche wechselt, der Wochentag bleibt – wie im Apple Kalender.
    day = addDays(day, dx > 0 ? -7 : 7);
    haptic(12);
    renderDayPlan();
  });
  const aus = () => { aktiv = false; };
  strip.addEventListener('pointerup', aus);
  strip.addEventListener('pointercancel', aus);
}

/* ==========================================================================
   Tagesplan
   ========================================================================== */

export function renderDayPlan() {
  if (!day) setDay(S.today());
  const scroll = $('#day-scroll');
  const today = S.today();
  const entries = S.planOn(day);

  $('#day-title').textContent = parseKey(day).toLocaleDateString('de-DE',
    { weekday: 'long', day: 'numeric', month: 'long' });
  updateDayHeader();
  renderWeekStrip();

  const rail = el('div', { class: 'day-rail', style: `height:${24 * HOUR_H}px` });
  for (let h = 0; h < 24; h++) {
    rail.append(el('div', { class: 'day-hour', style: `top:${h * HOUR_H}px` }, [
      el('span', { class: 'day-hour-label', text: `${String(h).padStart(2, '0')}:00` }),
      el('span', { class: 'day-hour-line' }),
    ]));
  }

  const layer = el('div', { class: 'day-blocks' });
  for (const e of place(entries)) layer.append(block(e));

  const board = el('div', { class: 'day-board' }, [rail, layer]);
  if (day === today) board.append(nowLine());
  attachEmptyHold(board);

  scroll.replaceChildren(board);
  clearInterval(clockTimer);
  if (day === today) clockTimer = setInterval(moveNowLine, 60000);

  // Auf etwas Sinnvolles springen: zum ersten Eintrag, sonst zur aktuellen
  // Stunde, sonst in den Morgen. Ein Plan, der bei 00:00 aufschlägt, wäre
  // jeden Tag erst einmal ein Scrollen.
  const ziel = entries.length ? entries[0].start
    : (day === today ? new Date().getHours() * 60 : 7 * 60);
  scroll.scrollTop = Math.max(0, (ziel / 60) * HOUR_H - 90);
}

function nowLine() {
  const now = new Date();
  const line = el('div', {
    class: 'day-now', id: 'day-now',
    style: `top:${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_H}px`,
  }, [el('span', { class: 'day-now-dot' }), el('span', { class: 'day-now-bar' })]);
  return line;
}

function moveNowLine() {
  const line = $('#day-now');
  if (!line) { clearInterval(clockTimer); return; }
  const now = new Date();
  line.style.top = `${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_H}px`;
}

/**
 * Verteilt überlappende Einträge auf Spalten, damit keiner den anderen
 * verdeckt – wie im Apple Kalender. Einträge, die sich nicht berühren, nehmen
 * die volle Breite.
 */
function place(entries) {
  const out = [];
  let i = 0;
  while (i < entries.length) {
    // Eine Traube ist eine Kette sich überlappender Einträge.
    const traube = [entries[i]];
    let ende = entries[i].end;
    let j = i + 1;
    while (j < entries.length && entries[j].start < ende) {
      traube.push(entries[j]);
      ende = Math.max(ende, entries[j].end);
      j++;
    }
    // Innerhalb der Traube die erste freie Spalte nehmen.
    const spalten = [];
    for (const e of traube) {
      let s = spalten.findIndex(bis => bis <= e.start);
      if (s < 0) { s = spalten.length; spalten.push(0); }
      spalten[s] = e.end;
      out.push({ ...e, col: s });
    }
    for (const e of out.slice(out.length - traube.length)) e.cols = spalten.length;
    i = j;
  }
  return out;
}

function block(e) {
  const c = e.color ? S.colorOf(e.color) : null;
  const isDark = document.documentElement.dataset.resolved === 'dark';
  const tint = c ? (isDark ? c.dark : c.light) : null;

  /* Mindesthöhe 44 px: Der Abhak-Knopf ist 34 px plus Polsterung. Ein kürzerer
     Block würde ihn abschneiden – und ein Viertelstunden-Eintrag wäre bei
     80 px je Stunde nur 20 px hoch. Dafür ragt er etwas in die nächste
     Viertelstunde; das nimmt der Apple Kalender genauso in Kauf. */
  const hoehe = Math.max(44, ((e.end - e.start) / 60) * HOUR_H - 3);
  const breite = 100 / e.cols;
  const node = el('div', {
    class: `day-block${e.done ? ' is-done' : ''}${e.plan.repeat ? ' repeating' : ''}`,
    dataset: { id: e.plan.id },
    style: [
      `top:${(e.start / 60) * HOUR_H}px`,
      `height:${hoehe}px`,
      `left:${e.col * breite}%`,
      `width:calc(${breite}% - 4px)`,
      tint ? S.tintStyle(e.color, isDark) : '',
    ].filter(Boolean).join(';'),
  });

  /* Steht der Block allein, ist Platz für die ganze Zeitangabe. Teilt er die
     Breite mit einem anderen, bleibt nur die Anfangszeit – alles weitere würde
     ohnehin abgeschnitten und der Balken sagt schon, wie lange es dauert. */
  const eng = e.cols > 1;
  const meta = eng ? [e.plan.time] : [`${e.plan.time}–${S.timeOf(e.end)}`];
  if (e.plan.repeat) meta.push(eng ? '↻' : 'dauerhaft');
  if (e.dueNote) meta.push(eng ? 'fällig!' : `fällig ${formatDue(e.dueNote, S.today())}`);

  // Ein flacher Block trägt nur eine Zeile. Dann gewinnt der Name – wann es
  // losgeht, sagt die Lage im Raster ohnehin.
  const platzFuerMeta = hoehe >= 54;
  node.append(
    el('div', { class: 'day-block-body' }, [
      el('div', { class: 'day-block-title' }, [
        e.emoji ? el('span', { class: 'day-block-emoji', text: e.emoji }) : null,
        el('span', { class: 'day-block-name', text: e.title }),
      ].filter(Boolean)),
      platzFuerMeta
        ? el('div', { class: `day-block-meta${e.dueNote ? ' late' : ''}`, text: meta.join(' · ') })
        : null,
    ].filter(Boolean)),
    planCheck(e, node),
  );

  node.addEventListener('click', (ev) => {
    if (ev.target.closest('.check') || wasDragged()) return;
    openPlanEditor({ planId: e.plan.id });
  });
  attachBlockDrag(node, e);
  return node;
}

/**
 * Derselbe Abhak-Knopf wie in den Listen, mit derselben Wirkung – und nach
 * derselben Regel aufgefrischt statt neu gebaut. Ein `renderDayPlan()` direkt
 * nach dem Tippen würde den Block mitten im Aufleuchten austauschen und den
 * laufenden Fortschrittsring abschneiden. Am Plan selbst ändert ein Haken
 * ohnehin nichts: Lage und Größe des Blocks bleiben, wie sie sind.
 */
function planCheck(e, node) {
  const gemeinsam = { color: colorValue(e) };

  if (e.kind === 'todo') {
    const btn = checkButton({
      ...gemeinsam,
      value: e.ref.done ? 1 : 0, target: 1,
      label: label(e.ref.done),
      onTap: () => {
        S.toggleTodo(e.ref.id);
        const erledigt = !!S.todo(e.ref.id)?.done;
        node.classList.toggle('is-done', erledigt);
        paintCheck(btn, { ...gemeinsam, value: erledigt ? 1 : 0, target: 1, label: label(erledigt) });
        updateDayHeader();
        if (erledigt) flashRow(node);
      },
    });
    return btn;

    function label(done) { return done ? `${e.title} wieder öffnen` : `${e.title} abhaken`; }
  }

  const h = e.ref;
  const zeige = (vorher) => {
    const erledigt = S.isDoneOn(h, day);
    node.classList.toggle('is-done', erledigt);
    paintCheck(btn, {
      ...gemeinsam, value: S.progressIn(h, day), target: h.target,
      label: erledigt ? `${e.title} zurücksetzen` : `${e.title} abhaken`,
    });
    updateDayHeader();
    if (erledigt && !vorher) flashRow(node);
  };

  const btn = checkButton({
    ...gemeinsam,
    value: S.progressIn(h, day), target: h.target,
    label: e.done ? `${e.title} zurücksetzen` : `${e.title} abhaken`,
    onTap: () => { const v = S.isDoneOn(h, day); S.bump(h.id, day); zeige(v); },
    onHold: () => { S.unbump(h.id, day); zeige(true); },
  });
  return btn;
}

/** Zieht Titel und Untertitel des Tages nach, ohne den Plan neu zu bauen. */
function updateDayHeader() {
  const entries = S.planOn(day);
  $('#day-subtitle').textContent = entries.length
    ? `${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}${
        entries.some(e => !e.done) ? '' : ' · alles erledigt'}`
    : 'Nichts geplant';
}

function colorValue(e) {
  if (!e.color) return null;
  const c = S.colorOf(e.color);
  return document.documentElement.dataset.resolved === 'dark' ? c.dark : c.light;
}

export function stepDay(n) {
  day = addDays(day || S.today(), n);
  renderDayPlan();
}

/* ==========================================================================
   Gesten im Tagesplan
   Gedrückt halten und ziehen verschiebt einen Block auf eine andere Uhrzeit –
   dieselbe Geste wie das Sortieren bei Habits und To-dos, nur wandert hier
   nicht die Reihenfolge, sondern die Zeit. Gedrückt halten auf freier Fläche
   legt direkt zu dieser Uhrzeit etwas an.

   Gerastert wird in Viertelstunden. Bei 80 px je Stunde sind fünf Minuten
   knapp 7 px – das ließe sich mit dem Finger nicht treffen, und der Kalender
   von Apple rastert aus demselben Grund ebenso.
   ========================================================================== */

const RASTER = 15;          // Minuten
const HALTEN = 380;         // ms bis zum Anheben, wie beim Sortieren
const WACKELN = 8;          // px, ab denen das Halten abbricht

let gezogenBis = 0;         // Zeitpunkt des letzten Ziehens

/** Kam gerade ein Ziehen? Dann ist der folgende Klick sein Nachklapp. */
function wasDragged() { return Date.now() - gezogenBis < 350; }

/** Minute im Tagesraster unter einem Bildschirmpunkt, auf RASTER gerundet. */
function minuteAt(clientY) {
  const layer = $('.day-blocks');
  if (!layer) return 0;
  const y = clientY - layer.getBoundingClientRect().top;
  return clamp(Math.round((y / HOUR_H) * 60 / RASTER) * RASTER, 0, 24 * 60 - RASTER);
}

/** Verschieben eines Blocks auf eine andere Uhrzeit. */
function attachBlockDrag(node, e) {
  let halten = null, bereit = false, x0 = 0, y0 = 0;
  const abbrechen = () => { clearTimeout(halten); halten = null; bereit = false; };

  node.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('.check')) return;
    if (ev.button !== undefined && ev.button !== 0) return;
    bereit = true; x0 = ev.clientX; y0 = ev.clientY;
    halten = setTimeout(() => { if (bereit) beginne(ev.clientY); }, HALTEN);
  });
  node.addEventListener('pointermove', (ev) => {
    if (!bereit) return;
    if (Math.abs(ev.clientX - x0) > WACKELN || Math.abs(ev.clientY - y0) > WACKELN) abbrechen();
  });
  node.addEventListener('pointerup', abbrechen);
  node.addEventListener('pointercancel', abbrechen);
  node.addEventListener('contextmenu', (ev) => ev.preventDefault());

  function beginne(startY) {
    abbrechen();
    haptic(20);
    const sc = $('#day-scroll');
    const freigeben = holdScroll();
    const dauer = e.plan.minutes;
    const anfang = e.start;
    let minute = anfang;
    let rand = 0;                        // Mitscrollen am Rand

    node.classList.add('moving');
    document.body.classList.add('is-dragging');
    const marke = el('div', { class: 'day-drag-time' });
    document.body.append(marke);

    const zeichne = () => {
      node.style.top = `${(minute / 60) * HOUR_H}px`;
      const bis = S.timeOf(minute + dauer);
      marke.textContent = `${S.timeOf(minute)} – ${bis}`;
      const meta = node.querySelector('.day-block-meta');
      if (meta) meta.textContent = e.cols > 1 ? S.timeOf(minute) : `${S.timeOf(minute)}–${bis}`;
    };

    const bewege = (ev) => {
      ev.preventDefault();
      const verschoben = ((ev.clientY - startY) / HOUR_H) * 60;
      minute = clamp(Math.round((anfang + verschoben) / RASTER) * RASTER, 0, 24 * 60 - dauer);
      zeichne();

      const r = sc.getBoundingClientRect();
      const saum = 70;
      if (ev.clientY < r.top + saum) rand = -Math.ceil((r.top + saum - ev.clientY) / 6);
      else if (ev.clientY > r.bottom - saum) rand = Math.ceil((ev.clientY - (r.bottom - saum)) / 6);
      else rand = 0;
    };

    // Am Rand mitscrollen, damit sich ein Block über den ganzen Tag schieben
    // lässt und nicht nur über den sichtbaren Ausschnitt.
    let laeuft = true;
    const takt = () => {
      if (!laeuft) return;
      if (rand) { sc.scrollTop += rand; startY -= rand; zeichne(); }
      requestAnimationFrame(takt);
    };
    requestAnimationFrame(takt);

    const beenden = () => {
      laeuft = false;
      window.removeEventListener('pointermove', bewege);
      window.removeEventListener('pointerup', beenden);
      window.removeEventListener('pointercancel', beenden);
      freigeben();
      marke.remove();
      node.classList.remove('moving');
      document.body.classList.remove('is-dragging');
      gezogenBis = Date.now();
      haptic(14);
      if (minute !== anfang) S.updatePlan(e.plan.id, { time: S.timeOf(minute) });
      renderDayPlan();
    };

    window.addEventListener('pointermove', bewege, { passive: false });
    window.addEventListener('pointerup', beenden);
    window.addEventListener('pointercancel', beenden);
    zeichne();
  }
}

/** Gedrückt halten auf freier Fläche legt zu dieser Uhrzeit etwas an. */
function attachEmptyHold(board) {
  let halten = null, bereit = false, x0 = 0, y0 = 0, minute = 0;
  let schatten = null;

  const abbrechen = () => {
    clearTimeout(halten); halten = null; bereit = false;
    schatten?.remove(); schatten = null;
  };

  board.addEventListener('pointerdown', (ev) => {
    // Auf einem Block gilt die andere Geste.
    if (ev.target.closest('.day-block')) return;
    if (ev.button !== undefined && ev.button !== 0) return;
    bereit = true; x0 = ev.clientX; y0 = ev.clientY;
    minute = minuteAt(ev.clientY);
    halten = setTimeout(() => {
      if (!bereit) return;
      abbrechen();
      haptic(20);
      openPlanPicker(S.timeOf(minute));
    }, HALTEN);

    // Sichtbarer Platzhalter, solange gehalten wird – so ist vor dem Öffnen
    // des Menüs zu sehen, auf welche Uhrzeit es geht.
    schatten = el('div', {
      class: 'day-slot-hint',
      style: `top:${(minute / 60) * HOUR_H}px;height:${(S.defaultMinutes('habit') / 60) * HOUR_H}px`,
      text: S.timeOf(minute),
    });
    $('.day-blocks')?.append(schatten);
  });
  board.addEventListener('pointermove', (ev) => {
    if (!bereit) return;
    if (Math.abs(ev.clientX - x0) > WACKELN || Math.abs(ev.clientY - y0) > WACKELN) abbrechen();
  });
  board.addEventListener('pointerup', abbrechen);
  board.addEventListener('pointercancel', abbrechen);
}

/* ==========================================================================
   Einplanen
   ========================================================================== */

/** Auswahl, was eingeplant werden soll – dieselben zwei Bereiche wie die App. */
export function openPlanPicker(zeit) {
  let bereich = 'habit';
  let filter = '';
  let listId = S.ALL_LISTS;      // im Bereich To-dos: welche Liste gezeigt wird

  openSheet({
    title: 'Einplanen',
    build: (body, { close }) => {
      const liste = el('div', { class: 'list pick-list' });
      // Dieselbe Listenleiste wie im To-do-Modul, damit man hier nicht anders
      // sucht als dort. Sie gilt nur für den Bereich To-dos.
      const listen = el('div', { class: 'pick-lists' });
      const suche = el('input', {
        class: 'input', type: 'search', placeholder: 'Suchen …',
        autocapitalize: 'off', autocorrect: 'off', enterkeyhint: 'search',
      });
      suche.addEventListener('input', () => { filter = suche.value.trim(); paint(); });

      const neu = el('button', { type: 'button', class: 'btn secondary' });
      neu.addEventListener('click', () => {
        close();
        // Neu anlegen über denselben Editor wie im jeweiligen Reiter – und
        // direkt danach einplanen, sonst wäre der Weg hier zu Ende.
        if (bereich === 'habit') {
          openHabitEditor(null, (h) => { if (h) openPlanEditor({ kind: 'habit', refId: h.id, zeit }); });
        } else {
          const listId = S.settings().lastListId || S.lists()[0]?.id;
          if (!listId) { toast('Lege zuerst eine Liste an'); return; }
          openTodoEditor(listId, null, (t) => { if (t) openPlanEditor({ kind: 'todo', refId: t.id, zeit }); });
        }
      });

      const tabs = segmented(
        [{ id: 'habit', label: 'Habits' }, { id: 'todo', label: 'To-dos' }],
        bereich, (v) => { bereich = v; paint(); },
      );

      body.append(tabs, listen, suche, liste, neu);
      paint();

      function paint() {
        neu.textContent = bereich === 'habit' ? '+ Neues Habit' : '+ Neues To-do';
        listen.hidden = bereich !== 'todo';
        if (bereich === 'todo') paintListen();

        const treffer = kandidaten(bereich, filter, listId);
        liste.replaceChildren(...(treffer.length
          ? treffer.map(k => pickRow(k, () => { close(); openPlanEditor({ kind: bereich, refId: k.id, zeit }); }))
          : [el('p', { class: 'field-hint', style: 'padding:14px 2px', text: filter
              ? 'Kein Treffer.'
              : (bereich === 'habit' ? 'Noch keine Habits.' : 'Hier steht nichts Offenes.') })]));
      }

      function paintListen() {
        const isDark = document.documentElement.dataset.resolved === 'dark';
        const mach = (id, label, emoji, color) => {
          const offen = S.todosOf(id).filter(t => !t.done).length;
          const c = color ? S.colorOf(color) : null;
          const knopf = el('button', {
            class: `list-tab${id === S.ALL_LISTS ? ' all-tab' : ''}${id === listId ? ' active' : ''}`,
            type: 'button',
            dataset: { id },
            style: c ? `--tint:${isDark ? c.dark : c.light}` : null,
          }, [
            emoji ? el('span', { class: 'list-tab-emoji', text: emoji }) : null,
            el('span', { class: 'list-tab-name', text: label }),
            offen ? el('span', { class: 'list-tab-badge', text: String(offen) }) : null,
          ].filter(Boolean));
          knopf.addEventListener('click', () => { listId = id; haptic(); paint(); });
          return knopf;
        };
        listen.replaceChildren(
          mach(S.ALL_LISTS, 'All', '', ''),
          ...S.lists().map(l => mach(l.id, l.name, l.emoji || '📋', l.color)),
        );
      }
    },
  });
}

/**
 * Was sich einplanen lässt. Die Suche ist dieselbe wie im Such-Bildschirm,
 * also auch hier tolerant gegenüber Tippfehlern.
 * @param {string} [listId] nur im Bereich To-dos: auf diese Liste einschränken
 */
function kandidaten(bereich, filter, listId = S.ALL_LISTS) {
  const inListe = (id) => listId === S.ALL_LISTS || id === listId;

  if (filter.length >= 2) {
    return S.search(filter, { settingsEntries: [] })
      .filter(h => h.kind === bereich && !(bereich === 'todo' && h.done))
      .filter(h => bereich !== 'todo' || inListe(S.todo(h.id)?.listId))
      .map(h => ({ id: h.id, title: h.title, emoji: h.emoji || '', color: h.color, sub: h.subtitle }));
  }
  if (bereich === 'habit') {
    return S.habits().map(h => ({
      id: h.id, title: h.name, emoji: h.emoji, color: h.color,
      sub: `${S.intervalOf(h).label} · ${num(h.target)} ${S.unitWords(h).many}`,
    }));
  }
  return S.todosOf(listId).filter(t => !t.done).map(t => ({
    id: t.id, title: t.title, emoji: '', color: t.color || S.list(t.listId)?.color || '',
    sub: S.list(t.listId)?.name || '',
  }));
}

function pickRow(k, onPick) {
  const isDark = document.documentElement.dataset.resolved === 'dark';
  const row = el('div', {
    class: `row tappable${k.color ? ' tinted' : ''}`,
    style: k.color ? S.tintStyle(k.color, isDark) : null,
  }, [
    k.emoji ? el('div', { class: 'row-emoji', text: k.emoji }) : null,
    el('div', { class: 'row-body' }, [
      el('div', { class: 'row-title', text: k.title }),
      k.sub ? el('div', { class: 'row-meta' }, [el('span', { text: k.sub })]) : null,
    ].filter(Boolean)),
  ].filter(Boolean));
  row.addEventListener('click', () => { haptic(); onPick(); });
  return row;
}

/**
 * Uhrzeit, Dauer und „dauerhaft" festlegen – beim Anlegen und beim Bearbeiten
 * derselbe Bildschirm, damit beides gleich aussieht.
 */
export function openPlanEditor({ planId, kind, refId, zeit }) {
  const bestehend = planId ? S.plan(planId) : null;
  const art = bestehend ? bestehend.kind : kind;
  const ziel = art === 'habit' ? S.habit(bestehend?.refId ?? refId) : S.todo(bestehend?.refId ?? refId);
  if (!ziel) { toast('Das gibt es nicht mehr'); return; }

  const name = art === 'habit' ? ziel.name : ziel.title;
  const state = {
    time: bestehend?.time ?? zeit ?? vorschlagszeit(),
    minutes: bestehend?.minutes ?? S.defaultMinutes(art),
    repeat: bestehend?.repeat ?? false,
  };

  openSheet({
    title: bestehend ? 'Eintrag bearbeiten' : 'Einplanen',
    confirm: 'Sichern',
    build: (body, { close }) => {
      const zeit = el('input', { class: 'input', type: 'time', value: state.time, step: '300' });
      zeit.addEventListener('input', () => { if (zeit.value) state.time = zeit.value; });

      const schnellzeit = el('div', { class: 'chips', style: 'margin-top:9px' });
      for (const t of ['06:00', '08:00', '12:00', '17:00', '20:00']) {
        schnellzeit.append(el('button', {
          type: 'button', class: 'chip', text: t,
          onclick: () => { state.time = t; zeit.value = t; haptic(); },
        }));
      }

      const dauerHinweis = el('p', { class: 'field-hint' });
      const dauer = stepper(state.minutes, {
        min: 5, max: 1440, step: 5,
        onInput: (v) => { state.minutes = v; zeigeDauer(); },
      });
      const schnelldauer = el('div', { class: 'chips', style: 'margin-top:9px' });
      for (const m of [15, 30, 45, 60, 90]) {
        schnelldauer.append(el('button', {
          type: 'button', class: 'chip', text: `${m} min`,
          onclick: () => { state.minutes = m; dauer.set(m); zeigeDauer(); haptic(); },
        }));
      }
      function zeigeDauer() {
        const bis = S.timeOf(S.minutesOf(state.time) + state.minutes);
        dauerHinweis.textContent = `Bis ${bis}${state.minutes >= 60
          ? ` (${num(state.minutes / 60)} ${state.minutes === 60 ? 'Stunde' : 'Stunden'})` : ''}`;
      }
      zeit.addEventListener('input', zeigeDauer);
      zeigeDauer();

      const dauerhaft = switchBtn(state.repeat, (on) => {
        state.repeat = on;
        dauerhaftHinweis.textContent = dauerhaftText(art, on);
      });
      const dauerhaftHinweis = el('p', { class: 'field-hint', text: dauerhaftText(art, state.repeat) });

      body.append(
        el('div', { class: 'plan-target' }, [
          art === 'habit' ? el('div', { class: 'row-emoji', text: ziel.emoji || '•' }) : null,
          el('div', {}, [
            el('div', { class: 'plan-target-name', text: name }),
            el('div', { class: 'plan-target-kind', text: art === 'habit' ? 'Habit' : 'To-do' }),
          ]),
        ].filter(Boolean)),
        field('Uhrzeit', [zeit, schnellzeit]),
        field('Dauer in Minuten', [dauer.node, schnelldauer], ''),
        dauerHinweis,
        field('Dauerhaft einplanen', [dauerhaft]),
        dauerhaftHinweis,
        bestehend ? loeschKnopf(bestehend, close) : null,
      );
    },
    onConfirm() {
      if (bestehend) S.updatePlan(bestehend.id, state);
      else S.addPlan({ kind: art, refId: ziel.id, date: day, ...state });
      renderDayPlan();
      toast(bestehend ? 'Eintrag geändert' : `„${name}" eingeplant`);
    },
  });
}

function dauerhaftText(art, on) {
  if (!on) return 'Gilt nur an diesem Tag.';
  return art === 'habit'
    ? 'Steht ab diesem Tag an jedem Tag im Plan, an dem das Habit ohnehin dran ist.'
    : 'Steht ab diesem Tag jeden Tag im Plan, bis das To-do abgehakt ist.';
}

/** Vorschlag: die nächste halbe Stunde, damit man selten tippen muss. */
function vorschlagszeit() {
  const now = new Date();
  const m = now.getHours() * 60 + now.getMinutes();
  return S.timeOf(Math.min(23 * 60 + 30, Math.ceil(m / 30) * 30));
}

function loeschKnopf(p, close) {
  const knopf = el('button', {
    type: 'button', class: 'btn danger', style: 'margin-top:18px',
    text: p.repeat ? 'Aus dem Plan nehmen' : 'Eintrag entfernen',
  });
  knopf.addEventListener('click', () => {
    close();
    if (!p.repeat) {
      S.deletePlan(p.id);
      renderDayPlan();
      toast('Aus dem Plan genommen');
      return;
    }
    // Bei einer Serie muss klar sein, was verschwindet.
    openSheet({
      title: 'Dauerhafter Eintrag',
      build: (body, { close: zu }) => {
        body.append(
          el('p', { style: 'font-size:15px;line-height:1.5;color:var(--text-2);margin-bottom:18px',
                    text: 'Dieser Eintrag gilt an mehreren Tagen.' }),
          el('button', {
            type: 'button', class: 'btn secondary', text: 'Nur an diesem Tag entfernen',
            onclick: () => { zu(); S.skipPlanOn(p.id, day); renderDayPlan(); toast('Nur heute entfernt'); },
          }),
          el('button', {
            type: 'button', class: 'btn danger', style: 'margin-top:10px', text: 'Ganze Reihe entfernen',
            onclick: () => { zu(); S.deletePlan(p.id); renderDayPlan(); toast('Reihe entfernt'); },
          }),
        );
      },
    });
  });
  return knopf;
}
