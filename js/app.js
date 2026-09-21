/* Einstieg: Zustand anwenden, Bildschirme verwalten, Bedienelemente verdrahten. */

import { $, $$ } from './util.js';
import * as S from './store.js';
import { toast } from './ui.js';
import { renderHabits, openHabitEditor, bindDetailOpener } from './habits.js';
import { renderDetail } from './habitDetail.js';
import {
  renderTodos, renderListBar, openListMenu, openListEditor, openTodoEditor, bindListSelect,
} from './todos.js';
import { renderSettings, renderTrash, bindApply, bindSettingsNavigate, flashSetting } from './settings.js';
import { renderHome, bindNavigate as bindHomeNav, bindActions as bindHomeActions,
         isEditing as isHomeEditing, leaveEdit as leaveHomeEdit } from './home.js';
import { renderCalendar, renderDayPlan, setDay, currentDay,
         stepMonth, stepDay, jumpToToday, bindOpenDay, openPlanPicker } from './calendar.js';
import { renderSearch, clearSearch, bindNavigate as bindSearchNav } from './search.js';
import { warmUp as warmEmoji } from './emoji.js';

S.load();

const view = { screen: 'habits', habitId: null, listId: S.settings().lastListId || '' };
let lastDay = S.today();

/* ---------- Aussehen anwenden ---------- */

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function applyAppearance() {
  const set = S.settings();
  const root = document.documentElement;

  if (set.theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = set.theme;

  // In JS brauchen wir das aufgelöste Ergebnis, um die richtige Farbstufe zu wählen.
  root.dataset.resolved = set.theme === 'dark' || (set.theme === 'system' && darkQuery.matches) ? 'dark' : 'light';
  root.dataset.size = set.rowSize;
  root.dataset.tint = set.saturation;

  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  for (const m of $$('meta[name="theme-color"]')) m.setAttribute('content', bg);
}

darkQuery.addEventListener('change', () => {
  if (S.settings().theme === 'system') { applyAppearance(); renderCurrent(); }
});

/* ---------- Bildschirme ---------- */

const SCREENS = {
  home: '#screen-home',
  search: '#screen-search',
  calendar: '#screen-calendar',
  day: '#screen-day',
  habits: '#screen-habits',
  detail: '#screen-detail',
  todos: '#screen-todos',
  settings: '#screen-settings',
  trash: '#screen-trash',
};

function show(screen, arg) {
  /* Im Bearbeiten-Modus der Startseite fehlen die drei festen Zeilen; bliebe
     er über den Bereichswechsel hinweg stehen, wären Suche und Einstellungen
     nicht mehr erreichbar. Also erst beenden, dann wechseln – gibt es
     Ungespeichertes, fragt leaveEdit vorher nach und ruft den Wechsel erst
     nach der Antwort auf. */
  if (view.screen === 'home' && screen !== 'home' && isHomeEditing()) {
    leaveHomeEdit(() => show(screen, arg));
    return;
  }
  if (screen === 'detail') view.habitId = arg;
  if (screen === 'settings') view.settingId = arg || null;
  if (screen === 'calendar') setDay(arg || currentDay() || S.today());
  if (screen === 'day') setDay(arg || currentDay() || S.today());
  // Von der Startseite aus kann eine Häufigkeits-Gruppe gezielt geöffnet werden
  if (screen === 'habits' && arg) S.setGroupOpen(arg, true);
  if (screen === 'todos') {
    // Ohne Angabe die zuletzt offene Liste, sonst die erste vorhandene.
    // „All" ist keine echte Liste, aber eine gültige Auswahl.
    const wanted = arg || view.listId;
    view.listId = (wanted === S.ALL_LISTS || S.list(wanted)) ? wanted : (S.lists()[0]?.id || '');
    if (view.listId) S.setSetting('lastListId', view.listId);
  }
  view.screen = screen;

  for (const [name, sel] of Object.entries(SCREENS)) {
    $(sel).classList.toggle('active', name === screen);
  }
  const tab = $(SCREENS[screen]).dataset.tab;
  for (const b of $$('#tabbar .tab')) {
    if (b.dataset.goto === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  // Die Listen-Leiste gehört nur zum To-dos-Bereich.
  $('#listbar').hidden = screen !== 'todos';

  /* Zurücksetzen vor dem Zeichnen, nicht danach: Ein Bildschirm, der beim
     Aufbau selbst eine sinnvolle Stelle anspringt – der Tagesplan geht zur
     ersten Uhrzeit –, wurde sonst gleich wieder nach oben geworfen. */
  $(SCREENS[screen]).querySelector('.scroll')?.scrollTo({ top: 0 });
  renderCurrent();
}

function renderCurrent() {
  switch (view.screen) {
    case 'home': renderHome(); break;
    case 'search': renderSearch(); break;
    case 'calendar': renderCalendar(); break;
    case 'day': renderDayPlan(); break;
    case 'habits': renderHabits(); break;
    case 'detail':
      if (!S.habit(view.habitId)) { show('habits'); return; }
      renderDetail(view.habitId, () => { renderDetail(view.habitId, renderCurrent); });
      break;
    case 'todos':
      // renderTodos zeichnet die Listen-Leiste mit – die Zähler dort und in
      // der Kopfzeile sollen nie auseinanderlaufen.
      renderTodos(view.listId);
      break;
    case 'trash': renderTrash(); break;
    case 'settings':
      renderSettings();
      if (view.settingId) {
        const id = view.settingId;
        view.settingId = null;
        setTimeout(() => flashSetting(id), 260);
      }
      break;
  }
}

function refreshAll() {
  applyAppearance();
  renderCurrent();
}

bindApply(refreshAll);
bindDetailOpener(id => show('detail', id));
bindListSelect(id => show('todos', id));

/** Ein Ziel, egal von wo aus angetippt. */
function navigate(where, arg) {
  if (where === 'habit') show('detail', arg);
  else show(where, arg);
}
bindHomeNav(navigate);
/* Was das Widget „Schnell anlegen" anbietet. Der Plan-Eintrag führt dabei in
   den Tagesplan von heute – sonst wäre nach dem Einplanen nicht zu sehen,
   was daraus geworden ist. */
bindHomeActions({
  newHabit: () => openHabitEditor(null, () => renderCurrent()),
  newTodo: () => newTodoIn(S.settings().lastListId, () => renderCurrent()),
  newPlan: () => { show('day', S.today()); openPlanPicker(); },
});
bindSearchNav(navigate);
bindSettingsNavigate(navigate);

/* ---------- Bedienelemente ---------- */

for (const b of $$('#tabbar .tab')) {
  b.addEventListener('click', () => show(b.dataset.goto));
}

$('#search-back').addEventListener('click', () => show('home'));
$('#search-clear').addEventListener('click', clearSearch);
$('#settings-back').addEventListener('click', () => show('home'));
$('#trash-back').addEventListener('click', () => show('settings'));

/* ---------- Kalender ---------- */
$('#calendar-prev').addEventListener('click', () => stepMonth(-1));
$('#calendar-next').addEventListener('click', () => stepMonth(1));
// Heute wählt den Tag im Raster aus; der Plan ist dann einen Tipp entfernt.
$('#calendar-today').addEventListener('click', () => jumpToToday());
bindOpenDay((key) => show('day', key));

$('#day-back').addEventListener('click', () => show('calendar', currentDay()));
$('#day-prev').addEventListener('click', () => stepDay(-1));
$('#day-next').addEventListener('click', () => stepDay(1));
$('#day-add').addEventListener('click', () => openPlanPicker());

$('#habit-add').addEventListener('click', () => openHabitEditor(null, () => renderHabits()));

$('#detail-back').addEventListener('click', () => show('habits'));
$('#detail-edit').addEventListener('click', () => {
  openHabitEditor(view.habitId, saved => { if (saved) renderCurrent(); else show('habits'); });
});

$('#list-menu').addEventListener('click', () => {
  openListMenu(view.listId, (saved) => {
    // Eine neu angelegte Liste wird gleich geöffnet; nach dem Löschen
    // rückt die nächste vorhandene nach.
    show('todos', saved?.id || '');
  });
});

/**
 * Ein neues To-do anlegen – aus dem To-dos-Bereich wie von der Startseite.
 *
 * Ohne Liste gibt es nichts, wo es hingehörte; dann wird zuerst eine angelegt.
 * Ist die gewünschte Liste keine echte – „All" oder von der Startseite aus gar
 * keine –, landet es in der ersten vorhandenen. Der Hinweis sagt dann, in
 * welcher, damit es nicht still irgendwo auftaucht.
 */
function newTodoIn(listId, done) {
  const ziel = S.list(listId) || S.lists()[0];
  if (!ziel) { openListEditor(null, (saved) => show('todos', saved?.id || '')); return; }
  openTodoEditor(ziel.id, null, (saved) => {
    done?.(saved);
    if (saved && ziel.id !== listId) toast(`In „${ziel.name}" angelegt`);
  });
}

$('#todo-add').addEventListener('click', () => {
  newTodoIn(view.listId === S.ALL_LISTS ? '' : view.listId, () => renderCurrent());
});

/* Schatten unter der Kopfzeile, sobald der Inhalt darunter wegläuft. */
for (const sc of $$('.scroll')) {
  sc.addEventListener('scroll', () => {
    sc.parentElement.querySelector('.topbar')?.classList.toggle('scrolled', sc.scrollTop > 4);
  }, { passive: true });
}

/* ---------- Tageswechsel ---------- */

function checkDayRollover() {
  const now = S.today();
  if (now !== lastDay) { lastDay = now; renderCurrent(); }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { checkDayRollover(); renderCurrent(); }
});
setInterval(checkDayRollover, 60000);

/* Schlägt das Schreiben fehl – Speicher voll, Safari verweigert –, läuft die
   App sonst scheinbar normal weiter und beim nächsten Start wäre alles seit
   dem letzten gelungenen Schreiben weg. Also deutlich sagen und zur Sicherung
   raten. Gemeldet wird nur der Wechsel, nicht jeder einzelne Versuch. */
S.onWriteProblem((ok, reason) => {
  if (ok) toast('Speichern klappt wieder.');
  else toast(`${reason}: Änderungen werden gerade NICHT gespeichert. Bitte in den Einstellungen sichern.`, 9000);
});

/* Beim Verlassen der Seite sicher schreiben – der gebündelte Write könnte
   sonst im Hintergrund verloren gehen. */
addEventListener('pagehide', () => S.flush());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') S.flush(); });

/* Hat eine zweite offene Instanz etwas geändert, den neuen Stand übernehmen
   statt mit dem eigenen weiterzuarbeiten. Eigene Schreibvorgänge lösen dieses
   Ereignis nicht aus. */
addEventListener('storage', (e) => {
  if (e.key && e.key !== 'planer.v1') return;
  if (S.isDirty()) return;          // eigene Änderung ist noch unterwegs
  S.load();
  refreshAll();
});

/* ---------- Start ---------- */

applyAppearance();
show('home');
warmEmoji();     // Emoji-Index im Leerlauf vorbereiten

if (!S.getData().habits.length && !S.getData().lists.length) {
  // Erster Start: kurz erklären, was die App mit den Daten macht.
  setTimeout(() => toast('Alles wird nur auf diesem Gerät gespeichert.', 3200), 700);
}

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service Worker nicht registriert', err));
  });
}
