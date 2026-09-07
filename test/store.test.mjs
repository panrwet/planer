/* Prüft die Rechenlogik des Stores – vor allem Streaks, weil dort Fehler
   still bleiben. Läuft ohne Browser: node test/store.test.mjs */

import assert from 'node:assert/strict';
import * as S from '../js/store.js';
import { addDays } from '../js/util.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (err) { failed++; console.log(`  FAIL ${name}\n       ${err.message}`); }
}

/** Frischer Zustand mit einem Habit; `ref` ist "heute" für den Test. */
function setup(habitFields = {}, log = {}) {
  S._setData({});
  const h = S.addHabit({ created: '2020-01-01', ...habitFields });
  for (const [day, value] of Object.entries(log)) S.setValue(h.id, day, value);
  return S.habit(h.id);
}

const MON = '2026-09-07';   // ein Montag
const d = (n) => addDays(MON, n);

console.log('\nTäglich');
test('leerer Verlauf hat Streak 0', () => {
  const h = setup();
  assert.equal(S.currentStreak(h, MON), 0);
});

test('drei Tage in Folge bis heute', () => {
  const h = setup({}, { [d(-2)]: 1, [d(-1)]: 1, [MON]: 1 });
  assert.equal(S.currentStreak(h, MON), 3);
});

test('heute noch offen beendet die Streak nicht', () => {
  const h = setup({}, { [d(-2)]: 1, [d(-1)]: 1 });
  assert.equal(S.currentStreak(h, MON), 2);
});

test('eine Lücke bricht die Streak', () => {
  const h = setup({}, { [d(-4)]: 1, [d(-3)]: 1, [d(-1)]: 1, [MON]: 1 });
  assert.equal(S.currentStreak(h, MON), 2);
});

test('Teilerfüllung zählt nicht als erledigt', () => {
  const h = setup({ target: 3 }, { [d(-1)]: 3, [MON]: 2 });
  assert.equal(S.isDoneOn(h, MON), false);
  assert.equal(S.currentStreak(h, MON), 1);
});

test('längste Streak findet den besten Lauf, nicht den letzten', () => {
  const h = setup({}, {
    [d(-10)]: 1, [d(-9)]: 1, [d(-8)]: 1, [d(-7)]: 1,   // 4 Tage
    [d(-2)]: 1, [d(-1)]: 1,                             // 2 Tage
  });
  assert.equal(S.longestStreak(h), 4);
  assert.equal(S.currentStreak(h, MON), 2);
});

console.log('\nBestimmte Wochentage (Mo/Mi/Fr)');
test('freier Dienstag unterbricht nicht', () => {
  // Fr, Mi, Mo davor erfüllt -> Streak 3, obwohl Sa/So/Di/Do dazwischen liegen
  const h = setup({ sched: 'days', days: [1, 3, 5] }, {
    [d(-7)]: 1,  // Montag der Vorwoche
    [d(-5)]: 1,  // Mittwoch
    [d(-3)]: 1,  // Freitag
    [MON]: 1,    // heute, Montag
  });
  assert.equal(S.currentStreak(h, MON), 4);
});

test('ausgelassener Mittwoch bricht die Streak', () => {
  const h = setup({ sched: 'days', days: [1, 3, 5] }, {
    [d(-7)]: 1, [d(-3)]: 1, [MON]: 1,   // Mittwoch fehlt
  });
  assert.equal(S.currentStreak(h, MON), 2);
});

test('an nicht geplanten Tagen nicht fällig', () => {
  const h = setup({ sched: 'days', days: [1, 3, 5] });
  assert.equal(S.isActiveOn(h, MON), true);        // Montag
  assert.equal(S.isActiveOn(h, d(1)), false);      // Dienstag
  assert.equal(S.showsOn(h, d(1)), false);
});

test('längste Streak respektiert den Wochenplan', () => {
  const h = setup({ sched: 'days', days: [1, 3, 5] }, {
    [d(-7)]: 1, [d(-5)]: 1, [d(-3)]: 1, [MON]: 1,
  });
  assert.equal(S.longestStreak(h), 4);
});

console.log('\nWochenziel (3x pro Woche)');
test('erfüllte Woche zählt', () => {
  const h = setup({ sched: 'week', weekTarget: 3 }, { [MON]: 1, [d(1)]: 1, [d(3)]: 1 });
  assert.equal(S.weekCount(h, MON), 3);
  assert.equal(S.currentStreak(h, d(3)), 1);
});

test('zwei volle Wochen in Folge', () => {
  const h = setup({ sched: 'week', weekTarget: 2 }, {
    [d(-7)]: 1, [d(-6)]: 1,      // Vorwoche
    [MON]: 1, [d(1)]: 1,          // diese Woche
  });
  assert.equal(S.currentStreak(h, d(1)), 2);
});

test('unvollständige laufende Woche bricht die Streak nicht', () => {
  const h = setup({ sched: 'week', weekTarget: 2 }, { [d(-7)]: 1, [d(-6)]: 1, [MON]: 1 });
  assert.equal(S.currentStreak(h, MON), 1);   // nur die Vorwoche zählt
});

test('erreichtes Wochenziel blendet das Habit aus', () => {
  const h = setup({ sched: 'week', weekTarget: 2 }, { [MON]: 1, [d(1)]: 1 });
  assert.equal(S.showsOn(h, d(2)), false);   // Mittwoch: Soll erfüllt
  assert.equal(S.showsOn(h, d(1)), true);    // Dienstag selbst: an dem Tag getan
});

console.log('\nZählen und Abhaken');
test('Tippen zählt hoch, am Ziel zurück auf null', () => {
  const h = setup({ target: 3 });
  assert.equal(S.bump(h.id, MON), 1);
  assert.equal(S.bump(h.id, MON), 2);
  assert.equal(S.bump(h.id, MON), 3);
  assert.equal(S.bump(h.id, MON), 0);
});

test('Halten zählt einen Schritt zurück', () => {
  const h = setup({ target: 3 }, { [MON]: 2 });
  assert.equal(S.unbump(h.id, MON), 1);
  assert.equal(S.unbump(h.id, MON), 0);
  assert.equal(S.unbump(h.id, MON), 0);   // nie negativ
});

test('grobe Ziele bekommen größere Schritte', () => {
  const h = setup({ target: 60, unit: 'min' });
  assert.equal(S.step(h), 6);
  assert.equal(S.bump(h.id, MON), 6);
});

test('Erfolgsquote zählt nur fällige Tage', () => {
  const h = setup({ sched: 'days', days: [1], created: d(-14) }, { [d(-14)]: 1, [d(-7)]: 1 });
  const r = S.completionRate(h, MON);
  assert.equal(r.due, 3);     // drei Montage
  assert.equal(r.done, 2);
  assert.equal(r.pct, 67);
});

console.log('\nTodos');
test('Abhaken zieht Unteraufgaben mit', () => {
  S._setData({});
  const l = S.addList({ name: 'Test' });
  const a = S.addTodo(l.id, { title: 'Eltern' });
  const b = S.addTodo(l.id, { title: 'Kind 1', parent: a.id });
  const c = S.addTodo(l.id, { title: 'Kind 2', parent: a.id });
  S.toggleTodo(a.id);
  assert.equal(S.todo(b.id).done, true);
  assert.equal(S.todo(c.id).done, true);
});

test('letztes erledigtes Kind hakt die Überaufgabe ab', () => {
  S._setData({});
  const l = S.addList({ name: 'Test' });
  const a = S.addTodo(l.id, { title: 'Eltern' });
  const b = S.addTodo(l.id, { title: 'Kind 1', parent: a.id });
  const c = S.addTodo(l.id, { title: 'Kind 2', parent: a.id });
  S.toggleTodo(b.id);
  assert.equal(S.todo(a.id).done, false, 'noch offen, solange Kind 2 offen ist');
  S.toggleTodo(c.id);
  assert.equal(S.todo(a.id).done, true);
});

test('ein Kind wieder öffnen öffnet die Überaufgabe', () => {
  S._setData({});
  const l = S.addList({ name: 'Test' });
  const a = S.addTodo(l.id, { title: 'Eltern' });
  const b = S.addTodo(l.id, { title: 'Kind', parent: a.id });
  S.toggleTodo(a.id);
  S.toggleTodo(b.id);
  assert.equal(S.todo(a.id).done, false);
});

test('Löschen entfernt den ganzen Teilbaum', () => {
  S._setData({});
  const l = S.addList({ name: 'Test' });
  const a = S.addTodo(l.id, { title: 'A' });
  const b = S.addTodo(l.id, { title: 'B', parent: a.id });
  S.addTodo(l.id, { title: 'C', parent: b.id });
  S.deleteTodo(a.id);
  assert.equal(S.todosOf(l.id).length, 0);
});

test('Tiefe wird korrekt bestimmt', () => {
  S._setData({});
  const l = S.addList({ name: 'Test' });
  const a = S.addTodo(l.id, { title: 'A' });
  const b = S.addTodo(l.id, { title: 'B', parent: a.id });
  const c = S.addTodo(l.id, { title: 'C', parent: b.id });
  assert.equal(S.depthOf(a), 0);
  assert.equal(S.depthOf(b), 1);
  assert.equal(S.depthOf(c), 2);
});

test('Umsortieren schreibt Reihenfolge und Verschachtelung', () => {
  S._setData({});
  const l = S.addList({ name: 'Test' });
  const a = S.addTodo(l.id, { title: 'A' });
  const b = S.addTodo(l.id, { title: 'B' });
  S.reorderTodos(l.id, [{ id: b.id, parent: null }, { id: a.id, parent: b.id }]);
  assert.equal(S.todo(a.id).parent, b.id);
  assert.deepEqual(S.todosOf(l.id).map(t => t.title), ['B', 'A']);
});

console.log('\nBackup');
test('Export und Import erhalten die Daten', () => {
  S._setData({});
  const h = S.addHabit({ name: 'Lesen', target: 20 });
  S.setValue(h.id, MON, 20);
  const l = S.addList({ name: 'Einkauf' });
  S.addTodo(l.id, { title: 'Milch' });
  const json = S.exportJSON();

  S._setData({});
  assert.equal(S.habits().length, 0);
  S.importJSON(json);
  assert.equal(S.habits().length, 1);
  assert.equal(S.habits()[0].name, 'Lesen');
  assert.equal(S.valueOn(S.habits()[0].id, MON), 20);
  assert.equal(S.todosOf(S.lists()[0].id)[0].title, 'Milch');
});

test('fremde Datei wird abgelehnt', () => {
  assert.throws(() => S.importJSON('{"foo":1}'), /Planer-Daten/);
});

test('unvollständige Daten werden ergänzt statt zu brechen', () => {
  S._setData({ habits: [{ id: 'x', name: 'Alt', target: 1, order: 0 }] });
  assert.equal(S.settings().rowSize, 'medium');
  assert.deepEqual(S.getData().todos, []);
});

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen\n`);
process.exit(failed ? 1 : 0);
