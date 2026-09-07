/* Einstieg: Zustand anwenden, Bildschirme verwalten, Bedienelemente verdrahten. */

import { $, $$ } from './util.js';
import * as S from './store.js';
import { toast } from './ui.js';
import { renderHabits, openHabitEditor, bindDetailOpener } from './habits.js';
import { renderDetail } from './habitDetail.js';
import { renderLists, renderTodos, openListEditor, openTodoEditor, bindListOpener } from './todos.js';
import { renderSettings, bindApply } from './settings.js';

S.load();

const view = { screen: 'habits', habitId: null, listId: null };
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
  habits: '#screen-habits',
  detail: '#screen-detail',
  lists: '#screen-lists',
  todos: '#screen-todos',
  settings: '#screen-settings',
};

function show(screen, arg) {
  if (screen === 'detail') view.habitId = arg;
  if (screen === 'todos') view.listId = arg;
  view.screen = screen;

  for (const [name, sel] of Object.entries(SCREENS)) {
    $(sel).classList.toggle('active', name === screen);
  }
  const tab = $(SCREENS[screen]).dataset.tab;
  for (const b of $$('#tabbar .tab')) {
    b.toggleAttribute('aria-current', b.dataset.goto === tab);
    if (b.dataset.goto === tab) b.setAttribute('aria-current', 'page');
  }
  renderCurrent();
  $(SCREENS[screen]).querySelector('.scroll')?.scrollTo({ top: 0 });
}

function renderCurrent() {
  switch (view.screen) {
    case 'habits': renderHabits(); break;
    case 'detail':
      if (!S.habit(view.habitId)) { show('habits'); return; }
      renderDetail(view.habitId, () => { renderDetail(view.habitId, renderCurrent); });
      break;
    case 'lists': renderLists(); break;
    case 'todos':
      if (!S.list(view.listId)) { show('lists'); return; }
      renderTodos(view.listId);
      break;
    case 'settings': renderSettings(); break;
  }
}

function refreshAll() {
  applyAppearance();
  renderCurrent();
}

bindApply(refreshAll);
bindDetailOpener(id => show('detail', id));
bindListOpener(id => show('todos', id));

/* ---------- Bedienelemente ---------- */

for (const b of $$('#tabbar .tab')) {
  b.addEventListener('click', () => {
    const goto = b.dataset.goto;
    if (goto === 'habits') show('habits');
    else if (goto === 'todos') show(view.listId && S.list(view.listId) && view.screen === 'todos' ? 'todos' : 'lists', view.listId);
    else show('settings');
  });
}

$('#habit-add').addEventListener('click', () => openHabitEditor(null, () => renderHabits()));
$('#list-add').addEventListener('click', () => openListEditor(null, () => renderLists()));

$('#detail-back').addEventListener('click', () => show('habits'));
$('#detail-edit').addEventListener('click', () => {
  openHabitEditor(view.habitId, saved => { if (saved) renderCurrent(); else show('habits'); });
});

$('#todos-back').addEventListener('click', () => show('lists'));
$('#todos-edit-list').addEventListener('click', () => {
  openListEditor(view.listId, saved => { if (saved) renderCurrent(); else show('lists'); });
});
$('#todo-add').addEventListener('click', () => openTodoEditor(view.listId, null, () => renderTodos(view.listId)));

for (const [toggleSel, listSel] of [['#habits-done-toggle', '#habit-list-done'], ['#todos-done-toggle', '#todo-list-done']]) {
  $(toggleSel).addEventListener('click', () => {
    const btn = $(toggleSel);
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    $(listSel).hidden = !open;
  });
}

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

/* ---------- Start ---------- */

applyAppearance();
show('habits');

if (!S.getData().habits.length && !S.getData().lists.length) {
  // Erster Start: kurz erklären, was die App mit den Daten macht.
  setTimeout(() => toast('Alles wird nur auf diesem Gerät gespeichert.', 3200), 700);
}

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service Worker nicht registriert', err));
  });
}
