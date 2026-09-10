/* Einstieg: Zustand anwenden, Bildschirme verwalten, Bedienelemente verdrahten. */

import { $, $$ } from './util.js';
import * as S from './store.js';
import { toast } from './ui.js';
import { renderHabits, openHabitEditor, bindDetailOpener } from './habits.js';
import { renderDetail } from './habitDetail.js';
import {
  renderTodos, renderListBar, openListMenu, openListEditor, openTodoEditor, bindListSelect,
} from './todos.js';
import { renderSettings, bindApply, flashSetting } from './settings.js';
import { renderHome, bindNavigate as bindHomeNav } from './home.js';
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
  habits: '#screen-habits',
  detail: '#screen-detail',
  todos: '#screen-todos',
  settings: '#screen-settings',
};

function show(screen, arg) {
  if (screen === 'detail') view.habitId = arg;
  if (screen === 'settings') view.settingId = arg || null;
  if (screen === 'todos') {
    // Ohne Angabe die zuletzt offene Liste, sonst die erste vorhandene.
    const wanted = arg || view.listId;
    view.listId = S.list(wanted) ? wanted : (S.lists()[0]?.id || '');
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
  // Die Listen-Leiste gehört nur zum Todos-Bereich.
  $('#listbar').hidden = screen !== 'todos';

  renderCurrent();
  $(SCREENS[screen]).querySelector('.scroll')?.scrollTo({ top: 0 });
}

function renderCurrent() {
  switch (view.screen) {
    case 'home': renderHome(); break;
    case 'search': renderSearch(); break;
    case 'habits': renderHabits(); break;
    case 'detail':
      if (!S.habit(view.habitId)) { show('habits'); return; }
      renderDetail(view.habitId, () => { renderDetail(view.habitId, renderCurrent); });
      break;
    case 'todos':
      renderListBar(view.listId);
      renderTodos(view.listId);
      break;
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
bindSearchNav(navigate);

/* ---------- Bedienelemente ---------- */

for (const b of $$('#tabbar .tab')) {
  b.addEventListener('click', () => show(b.dataset.goto));
}

$('#search-back').addEventListener('click', () => show('home'));
$('#search-clear').addEventListener('click', clearSearch);
$('#settings-back').addEventListener('click', () => show('home'));

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

$('#todo-add').addEventListener('click', () => {
  if (!S.list(view.listId)) {
    openListEditor(null, (saved) => show('todos', saved?.id || ''));
    return;
  }
  openTodoEditor(view.listId, null, () => renderCurrent());
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
