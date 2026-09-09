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

console.log('\nWochenziel');
test('Tageswerte summieren sich über die Woche', () => {
  const h = setup({ sched: 'week', target: 3 }, { [MON]: 1, [d(1)]: 1 });
  assert.equal(S.progressIn(h, d(4)), 2, 'Freitag sieht die ganze Woche');
  assert.equal(S.isDoneOn(h, MON), false);
  S.setValue(h.id, d(3), 1);
  assert.equal(S.isDoneOn(h, MON), true);
});

test('60 Seiten pro Woche gehen auch an einem Tag', () => {
  const h = setup({ sched: 'week', unit: 'page', target: 60 }, { [MON]: 60 });
  assert.equal(S.isDoneOn(h, MON), true);
  assert.equal(S.progressIn(h, d(5)), 60);
});

test('zwei volle Wochen in Folge', () => {
  const h = setup({ sched: 'week', target: 2 }, {
    [d(-7)]: 1, [d(-6)]: 1,      // Vorwoche
    [MON]: 1, [d(1)]: 1,          // diese Woche
  });
  assert.equal(S.currentStreak(h, d(1)), 2);
});

test('unvollständige laufende Woche bricht die Streak nicht', () => {
  const h = setup({ sched: 'week', target: 2 }, { [d(-7)]: 1, [d(-6)]: 1, [MON]: 1 });
  assert.equal(S.currentStreak(h, MON), 1);   // nur die Vorwoche zählt
});

test('erfülltes Wochenziel blendet das Habit aus, am Beitragstag aber nicht', () => {
  const h = setup({ sched: 'week', target: 2 }, { [MON]: 1, [d(1)]: 1 });
  assert.equal(S.showsOn(h, d(2)), false);   // Mittwoch: Soll erfüllt
  assert.equal(S.showsOn(h, d(1)), true);    // Dienstag selbst: an dem Tag getan
});

console.log('\nMonatsziel');
test('Tageswerte summieren sich über den Monat', () => {
  const h = setup({ sched: 'month', target: 4 }, { '2026-09-03': 2, '2026-09-20': 1 });
  assert.equal(S.progressIn(h, '2026-09-28'), 3);
  assert.equal(S.isDoneOn(h, '2026-09-28'), false);
  S.setValue(h.id, '2026-09-29', 1);
  assert.equal(S.isDoneOn(h, '2026-09-01'), true);
});

test('der Vormonat zählt nicht mit', () => {
  const h = setup({ sched: 'month', target: 2 }, { '2026-08-30': 2 });
  assert.equal(S.progressIn(h, '2026-09-05'), 0);
  assert.equal(S.currentStreak(h, '2026-09-05'), 1, 'August war erfüllt');
});

test('zwei Monate in Folge', () => {
  const h = setup({ sched: 'month', target: 1, created: '2026-07-01' },
    { '2026-08-05': 1, '2026-09-05': 1 });
  assert.equal(S.currentStreak(h, '2026-09-10'), 2);
});

console.log('\nÜbererfüllung');
test('über das Ziel hinaus zählen', () => {
  const h = setup({ target: 3 }, { [MON]: 3 });
  assert.equal(S.bumpBeyond(h.id, MON), 4);
  assert.equal(S.bumpBeyond(h.id, MON), 5);
  assert.equal(S.isDoneOn(h, MON), true, 'bleibt erledigt');
});

test('Tippen setzt bei erreichtem Ziel zurück, Übererfüllung bleibt erhalten', () => {
  const h = setup({ target: 2 }, { [MON]: 2 });
  assert.equal(S.bump(h.id, MON), 0, 'erst zurücksetzen');
  assert.equal(S.bump(h.id, MON), 1);
});

test('Übererfüllung verfälscht die Erfolgsquote nicht', () => {
  const h = setup({ target: 1, created: MON }, { [MON]: 5 });
  const r = S.completionRate(h, MON);
  assert.equal(r.due, 1);
  assert.equal(r.done, 1);
  assert.equal(r.pct, 100);
});

test('Wochenziel lässt sich übererfüllen', () => {
  const h = setup({ sched: 'week', target: 3 }, { [MON]: 3 });
  assert.equal(S.bumpBeyond(h.id, MON), 4);
  assert.equal(S.progressIn(h, MON), 4);
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

test('der letzte Tipp füllt genau auf das Ziel auf', () => {
  const h = setup({ target: 10, unit: 'min' }, { [MON]: 9 });
  assert.equal(S.bump(h.id, MON), 10, 'nicht 9 + 1 Schritt daneben');
  assert.equal(S.isDoneOn(h, MON), true);
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

console.log('\nMigration auf Schema 4');
test('Wochenziel wird zusammengerechnet statt doppelt geführt', () => {
  S._setData({
    v: 3,
    habits: [{ id: 'x', name: 'Lesen', sched: 'week', target: 20, weekTarget: 3,
               unit: 'page', days: [1, 2, 3], created: '2026-01-01', order: 0 }],
    lists: [], todos: [], log: {},
  });
  const h = S.habits()[0];
  assert.equal(h.sched, 'week');
  assert.equal(h.target, 60, '20 Seiten an 3 Tagen sind 60 pro Woche');
  assert.equal(h.weekTarget, undefined);
});

test('"daily" wird zu "day"', () => {
  S._setData({ v: 3, habits: [{ id: 'x', name: 'A', sched: 'daily', target: 1, order: 0 }], lists: [], todos: [], log: {} });
  assert.equal(S.habits()[0].sched, 'day');
});

test('erfasste Tage überleben die Migration', () => {
  S._setData({
    v: 3,
    habits: [{ id: 'x', name: 'A', sched: 'week', target: 10, weekTarget: 2, order: 0, created: '2026-01-01' }],
    lists: [], todos: [], log: { x: { '2026-09-07': 10, '2026-09-08': 10 } },
  });
  const h = S.habits()[0];
  assert.equal(S.valueOn(h.id, '2026-09-07'), 10, 'Werte unverändert');
  assert.equal(h.target, 20);
  assert.equal(S.progressIn(h, '2026-09-07'), 20);
  assert.equal(S.isDoneOn(h, '2026-09-07'), true, 'die alte Absicht ist erfüllt');
});

test('alte Farbkennungen fallen auf einen vorhandenen Ton zurück', () => {
  assert.equal(S.colorOf('purple').id, 'violet');
  assert.equal(S.colorOf('gibtsnicht').id, 'indigo');
  assert.equal(S.colorOf('red').id, 'red');
});

test('Migration v1 bis v4 in einem Zug', () => {
  // Ein Stand ohne Versionsnummer, wie er ganz am Anfang entstand
  S._setData({
    habits: [{ id: 'h', name: 'Lesen', sched: 'week', target: 20, weekTarget: 3, order: 0, created: '2026-01-01' }],
    lists: [{ id: 'a', name: 'Leer', order: 0 }, { id: 'b', name: 'Voll', order: 1 }],
    todos: [{ id: 't', listId: 'b', title: 'X', emoji: '🍞', order: 0 }],
    log: { h: { '2026-09-07': 60 } },
  });
  const names = S.lists().map(l => l.name).sort();
  assert.deepEqual(names, ['Free', 'Voll'], 'v3 lief');
  assert.equal(S.habits()[0].target, 60, 'v4 lief');
  assert.equal(S.todosOf('b')[0].emoji, '', 'v3 lief auch für Emojis');
  assert.equal(S.valueOn('h', '2026-09-07'), 60, 'keine Daten verloren');
});

test('Emoji-Verlauf: neuestes zuerst, ohne Dubletten', () => {
  S._setData({});
  S.rememberEmoji('💧');
  S.rememberEmoji('🏃');
  S.rememberEmoji('💧');
  assert.deepEqual(S.recentEmoji().slice(0, 2), ['💧', '🏃']);
  for (let i = 0; i < 40; i++) S.rememberEmoji(String.fromCodePoint(0x1f600 + i));
  assert.ok(S.recentEmoji().length <= 24, 'Verlauf wächst nicht unbegrenzt');
});

console.log('\nSortieren');
test('Habits umsortieren schreibt den Rang', () => {
  S._setData({});
  const a = S.addHabit({ name: 'A' });
  const b = S.addHabit({ name: 'B' });
  const c = S.addHabit({ name: 'C' });
  S.reorderHabits([c.id, a.id, b.id]);
  assert.deepEqual(S.habits().map(h => h.name), ['C', 'A', 'B']);
});

test('Habits aus anderen Gruppen rutschen dahinter, gehen aber nicht verloren', () => {
  S._setData({});
  const a = S.addHabit({ name: 'Täglich A', sched: 'day' });
  const b = S.addHabit({ name: 'Wöchentlich', sched: 'week' });
  const c = S.addHabit({ name: 'Täglich B', sched: 'day' });
  S.reorderHabits([c.id, a.id]);          // nur die Tages-Gruppe wurde gezogen
  const names = S.habits().map(h => h.name);
  assert.deepEqual(names, ['Täglich B', 'Täglich A', 'Wöchentlich']);
});

test('Listen umsortieren', () => {
  S._setData({});
  const a = S.addList({ name: 'A' });
  const b = S.addList({ name: 'B' });
  S.reorderLists([b.id, a.id]);
  assert.deepEqual(S.lists().map(l => l.name), ['B', 'A']);
});

test('Gruppen sind offen, nur Erledigt beginnt zu', () => {
  S._setData({});
  assert.equal(S.groupOpen('daily'), true);
  assert.equal(S.groupOpen('done'), false);
  S.setGroupOpen('daily', false);
  assert.equal(S.groupOpen('daily'), false);
});

console.log('\nMigration auf Schema 3');
test('leere Listen werden Aufgaben in "Free"', () => {
  S._setData({
    v: 2,
    lists: [{ id: 'a', name: 'Milch kaufen', order: 0 }, { id: 'b', name: 'Zahnarzt', order: 1 }],
    todos: [],
  });
  assert.deepEqual(S.lists().map(l => l.name), ['Free']);
  const free = S.lists()[0];
  assert.deepEqual(S.todosOf(free.id).map(t => t.title), ['Milch kaufen', 'Zahnarzt']);
});

test('Listen mit Aufgaben bleiben unangetastet', () => {
  S._setData({
    v: 2,
    lists: [{ id: 'a', name: 'Leer', order: 0 }, { id: 'b', name: 'Einkaufen', order: 1 }],
    todos: [{ id: 't', listId: 'b', title: 'Brot', order: 0 }],
  });
  const names = S.lists().map(l => l.name);
  assert.ok(names.includes('Einkaufen'), 'Einkaufen bleibt Liste');
  assert.ok(!names.includes('Leer'), 'Leer wurde umgewandelt');
  assert.deepEqual(S.todosOf('b').map(t => t.title), ['Brot']);
});

test('vorhandene "Free"-Liste wird weiterverwendet, nicht doppelt angelegt', () => {
  S._setData({
    v: 2,
    lists: [{ id: 'f', name: 'Free', order: 0 }, { id: 'a', name: 'Anrufen', order: 1 }],
    todos: [{ id: 't', listId: 'f', title: 'Bestehendes', order: 0 }],
  });
  assert.deepEqual(S.lists().map(l => l.name), ['Free']);
  assert.deepEqual(S.todosOf('f').map(t => t.title), ['Bestehendes', 'Anrufen']);
});

test('Migration läuft nicht erneut über schon migrierte Daten', () => {
  S._setData({ v: 2, lists: [{ id: 'a', name: 'X', order: 0 }], todos: [] });
  const after = JSON.parse(JSON.stringify(S.getData()));
  S._setData(after);                    // trägt jetzt v: 3
  assert.deepEqual(S.lists().map(l => l.name), ['Free']);
  assert.equal(S.todosOf(S.lists()[0].id).length, 1, 'kein zweites Todo entstanden');
});

test('Aufgaben verlieren ihr Emoji', () => {
  S._setData({
    v: 2,
    lists: [{ id: 'b', name: 'Liste', order: 0 }],
    todos: [{ id: 't', listId: 'b', title: 'Brot', emoji: '🍞', order: 0 }],
  });
  assert.equal(S.todosOf('b')[0].emoji, '');
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
