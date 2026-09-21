/* Prüft die Rechenlogik des Stores – vor allem Streaks, weil dort Fehler
   still bleiben. Läuft ohne Browser: node test/store.test.mjs */

import assert from 'node:assert/strict';
import * as S from '../js/store.js';
import { addDays, weekdayOf } from '../js/util.js';

/** Wochentag von heute – für Tests, die einen fälligen bzw. freien Tag brauchen. */
function weekdayOfToday() {
  return weekdayOf(S.today());
}

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
test('Abhaken zieht Unter-To-dos mit', () => {
  S._setData({});
  const l = S.addList({ name: 'Test' });
  const a = S.addTodo(l.id, { title: 'Eltern' });
  const b = S.addTodo(l.id, { title: 'Kind 1', parent: a.id });
  const c = S.addTodo(l.id, { title: 'Kind 2', parent: a.id });
  S.toggleTodo(a.id);
  assert.equal(S.todo(b.id).done, true);
  assert.equal(S.todo(c.id).done, true);
});

test('letztes erledigtes Kind hakt die ÜberTo-do ab', () => {
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

test('ein Kind wieder öffnen öffnet die ÜberTo-do', () => {
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
test('leere Listen werden To-dos in "Free"', () => {
  S._setData({
    v: 2,
    lists: [{ id: 'a', name: 'Milch kaufen', order: 0 }, { id: 'b', name: 'Zahnarzt', order: 1 }],
    todos: [],
  });
  assert.deepEqual(S.lists().map(l => l.name), ['Free']);
  const free = S.lists()[0];
  assert.deepEqual(S.todosOf(free.id).map(t => t.title), ['Milch kaufen', 'Zahnarzt']);
});

test('Listen mit To-dos bleiben unangetastet', () => {
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

test('To-dos verlieren ihr Emoji', () => {
  S._setData({
    v: 2,
    lists: [{ id: 'b', name: 'Liste', order: 0 }],
    todos: [{ id: 't', listId: 'b', title: 'Brot', emoji: '🍞', order: 0 }],
  });
  assert.equal(S.todosOf('b')[0].emoji, '');
});

console.log('\nEin- und Ausrücken');

/** Liste mit den Titeln A, B, C … und ihrer Tiefe. */
function tree(listId) {
  const byId = new Map(S.todosOf(listId).map(t => [t.id, t]));
  const depth = (t) => { let d = 0, c = t; while (c.parent && byId.has(c.parent)) { c = byId.get(c.parent); d++; } return d; };
  return S.todosOf(listId).map(t => `${'  '.repeat(depth(t))}${t.title}`);
}

test('die erste Zeile lässt sich nicht einrücken', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const a = S.addTodo(l.id, { title: 'A' });
  S.addTodo(l.id, { title: 'B' });
  assert.equal(S.canIndent(a.id), false);
  assert.equal(S.indentTodo(a.id), false);
});

test('Einrücken macht zur Unter-To-do des Vorgängers', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const a = S.addTodo(l.id, { title: 'A' });
  const b = S.addTodo(l.id, { title: 'B' });
  assert.equal(S.indentTodo(b.id), true);
  assert.equal(S.todo(b.id).parent, a.id);
  assert.deepEqual(tree(l.id), ['A', '  B']);
});

test('zweimal Einrücken geht eine Ebene tiefer', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  S.addTodo(l.id, { title: 'A' });
  const b = S.addTodo(l.id, { title: 'B' });
  const c = S.addTodo(l.id, { title: 'C' });
  S.indentTodo(b.id);
  S.indentTodo(c.id);          // wird Kind von A
  S.indentTodo(c.id);          // wird Kind von B
  assert.deepEqual(tree(l.id), ['A', '  B', '    C']);
});

test('die Tiefengrenze wird eingehalten', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  S.addTodo(l.id, { title: 'A' });
  const b = S.addTodo(l.id, { title: 'B' });
  const c = S.addTodo(l.id, { title: 'C' });
  const d = S.addTodo(l.id, { title: 'D' });
  S.indentTodo(b.id);
  S.indentTodo(c.id); S.indentTodo(c.id);
  S.indentTodo(d.id); S.indentTodo(d.id);
  assert.equal(S.canIndent(d.id, 2), false, 'Ebene 3 ist nicht erlaubt');
  assert.equal(S.indentTodo(d.id, 2), false);
});

test('ein To-do mit Kindern darf nur so tief, dass die Kinder passen', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  S.addTodo(l.id, { title: 'A' });
  const b = S.addTodo(l.id, { title: 'B' });
  const c = S.addTodo(l.id, { title: 'C' });
  S.indentTodo(c.id);          // C wird Kind von B
  assert.deepEqual(tree(l.id), ['A', 'B', '  C']);
  assert.equal(S.canIndent(b.id, 2), true, 'B plus Kind passt noch in zwei Ebenen');
  S.indentTodo(b.id);
  assert.deepEqual(tree(l.id), ['A', '  B', '    C']);
  assert.equal(S.canIndent(b.id, 2), false, 'tiefer ginge das Kind verloren');
});

test('Ausrücken hebt an und nimmt die folgenden Geschwister mit', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const a = S.addTodo(l.id, { title: 'A' });
  const b = S.addTodo(l.id, { title: 'B' });
  const c = S.addTodo(l.id, { title: 'C' });
  S.indentTodo(b.id);
  S.indentTodo(c.id);
  assert.deepEqual(tree(l.id), ['A', '  B', '  C']);
  S.outdentTodo(b.id);
  // C stand unter A nach B – es bleibt logisch bei B
  assert.deepEqual(tree(l.id), ['A', 'B', '  C']);
});

test('auf oberster Ebene gibt es nichts auszurücken', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const a = S.addTodo(l.id, { title: 'A' });
  assert.equal(S.canOutdent(a.id), false);
  assert.equal(S.outdentTodo(a.id), false);
});

test('Ränge bleiben nach dem Umhängen ganzzahlig und lückenlos', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  S.addTodo(l.id, { title: 'A' });
  const b = S.addTodo(l.id, { title: 'B' });
  S.addTodo(l.id, { title: 'C' });
  S.indentTodo(b.id);
  const orders = S.todosOf(l.id).map(t => t.order);
  assert.deepEqual(orders, [0, 1, 2], `Ränge: ${orders}`);
});

console.log('\nÜberblick für die Startseite');
test('Habits nach Intervall aufgeschlüsselt, Summe passt zur Gesamtzahl', () => {
  S._setData({});
  S.addHabit({ name: 'A', sched: 'day' });
  S.addHabit({ name: 'B', sched: 'day' });
  S.addHabit({ name: 'C', sched: 'days', days: [weekdayOfToday()] });
  S.addHabit({ name: 'D', sched: 'week', target: 3 });
  S.addHabit({ name: 'E', sched: 'month', target: 2 });
  const o = S.overview();

  const byId = Object.fromEntries(o.habits.byInterval.map(g => [g.id, g]));
  assert.equal(byId.day.total, 2);
  assert.equal(byId.days.total, 1);
  assert.equal(byId.week.total, 1);
  assert.equal(byId.month.total, 1);
  assert.equal(o.habits.total, 5);
  assert.equal(o.habits.byInterval.reduce((n, g) => n + g.due, 0), o.habits.due,
    'die fälligen je Intervall müssen die Gesamtzahl ergeben');
});

test('Intervalle ohne Habits erscheinen nicht', () => {
  S._setData({});
  S.addHabit({ name: 'A', sched: 'day' });
  const o = S.overview();
  assert.deepEqual(o.habits.byInterval.map(g => g.id), ['day']);
});

test('an einem freien Tag ist die Gruppe gelistet, aber nicht fällig', () => {
  S._setData({});
  // Wochentag wählen, der heute *nicht* ist
  const other = (weekdayOfToday() + 3) % 7;
  S.addHabit({ name: 'Selten', sched: 'days', days: [other] });
  const o = S.overview();
  assert.equal(o.habits.byInterval[0].total, 1);
  assert.equal(o.habits.byInterval[0].due, 0);
  assert.equal(o.habits.resting, 1, 'zählt als heute nicht dran');
});

test('erfülltes Wochenziel schrumpft den Nenner nicht', () => {
  S._setData({});
  const h = S.addHabit({ name: 'Lesen', sched: 'week', target: 10 });
  S.addHabit({ name: 'Wasser', sched: 'day', target: 1 });
  S.setValue(h.id, S.today(), 10);
  const o = S.overview();
  assert.equal(o.habits.due, 2, 'beide bleiben im Nenner');
  assert.equal(o.habits.done, 1);
});

test('To-dos: gesamt, offen, erledigt, überfällig', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  S.addTodo(l.id, { title: 'offen ohne Datum' });
  S.addTodo(l.id, { title: 'heute', due: S.today() });
  S.addTodo(l.id, { title: 'alt', due: '2020-01-01' });
  const d = S.addTodo(l.id, { title: 'fertig' });
  S.toggleTodo(d.id);

  const t = S.overview().todos;
  assert.equal(t.total, 4);
  assert.equal(t.open, 3);
  assert.equal(t.done, 1);
  assert.equal(t.overdue.length, 1);
  assert.equal(t.today.length, 1);
  assert.equal(t.noDue, 1);
  assert.equal(t.lists, 1);
  assert.equal(t.open + t.done, t.total, 'offen und erledigt ergeben die Gesamtzahl');
});

test('erledigte To-dos zählen nicht als überfällig', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const t = S.addTodo(l.id, { title: 'alt', due: '2020-01-01' });
  assert.equal(S.overview().todos.overdue.length, 1);
  S.toggleTodo(t.id);
  assert.equal(S.overview().todos.overdue.length, 0);
});

test('fehlgeschlagenes Speichern wird gemeldet, nicht verschluckt', () => {
  S._setData({});
  const seen = [];
  const off = S.onWriteProblem((ok, reason) => seen.push([ok, reason]));

  const real = globalThis.localStorage;
  let blocked = true;
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => { if (blocked) { const e = new Error('voll'); e.name = 'QuotaExceededError'; throw e; } },
    removeItem: () => {},
  };

  const l = S.addList({ name: 'L' });
  S.addTodo(l.id, { title: 'A' });
  assert.equal(S.flush(), false, 'Schreiben schlägt fehl');
  assert.deepEqual(seen, [[false, 'Speicher voll']], 'einmal gemeldet');

  // Weitere Fehlversuche melden nicht erneut – sonst käme bei jedem Tippen eine
  // Warnung.
  S.addTodo(l.id, { title: 'B' });
  S.flush();
  assert.equal(seen.length, 1, 'keine Wiederholung');

  // Geht es wieder, wird auch das gesagt.
  blocked = false;
  assert.equal(S.flush(), true);
  assert.deepEqual(seen[1], [true, undefined]);

  off();
  globalThis.localStorage = real;
});

test('Fälligkeits-Körbe nach Datum sortiert, nicht nach Listenreihenfolge', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  // Absichtlich verkehrt herum angelegt: jüngstes Datum zuerst.
  S.addTodo(l.id, { title: 'seit gestern', due: addDays(S.today(), -1) });
  S.addTodo(l.id, { title: 'seit einem Monat', due: addDays(S.today(), -30) });
  S.addTodo(l.id, { title: 'seit einer Woche', due: addDays(S.today(), -7) });
  S.addTodo(l.id, { title: 'in sechs Tagen', due: addDays(S.today(), 6) });
  S.addTodo(l.id, { title: 'in drei Tagen', due: addDays(S.today(), 3) });

  const t = S.overview().todos;
  assert.deepEqual(t.overdue.map(x => x.title),
    ['seit einem Monat', 'seit einer Woche', 'seit gestern'],
    'das Älteste steht oben');
  assert.deepEqual(t.thisWeek.map(x => x.title), ['in drei Tagen', 'in sechs Tagen'],
    'das Nächste steht oben');
});

test('gleiches Fälligkeitsdatum behält die Listenreihenfolge', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const due = addDays(S.today(), -2);
  for (const title of ['A', 'B', 'C']) S.addTodo(l.id, { title, due });
  assert.deepEqual(S.overview().todos.overdue.map(x => x.title), ['A', 'B', 'C']);
});

test('Sortieren der Körbe verändert die gespeicherte Reihenfolge nicht', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  S.addTodo(l.id, { title: 'spät', due: addDays(S.today(), -1) });
  S.addTodo(l.id, { title: 'früh', due: addDays(S.today(), -9) });
  S.overview();
  assert.deepEqual(S.todosOf(l.id).map(x => x.title), ['spät', 'früh']);
});

test('Serien nach Länge sortiert', () => {
  S._setData({});
  const a = S.addHabit({ name: 'Kurz', sched: 'day', created: '2026-01-01' });
  const b = S.addHabit({ name: 'Lang', sched: 'day', created: '2026-01-01' });
  const today = S.today();
  S.setValue(a.id, today, 1);
  for (let i = 0; i < 4; i++) S.setValue(b.id, addDays(today, -i), 1);
  const st = S.overview().streaks;
  assert.equal(st[0].habit.name, 'Lang');
  assert.ok(st[0].streak > st[1].streak);
});

console.log('\nBeschädigte Daten');
test('Ringschluss stürzt nicht ab', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const a = S.addTodo(l.id, { title: 'A' });
  const b = S.addTodo(l.id, { title: 'B' });
  S.updateTodo(a.id, { parent: b.id });
  S.updateTodo(b.id, { parent: a.id });
  assert.ok(Number.isFinite(S.depthOf(S.todo(a.id))), 'Tiefe bleibt endlich');
  assert.ok(S.descendantsOf(a.id).length <= 2, 'Nachfahren laufen nicht im Kreis');
  assert.doesNotThrow(() => S.overview());
});

test('To-do als ihr eigener Elternteil', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const a = S.addTodo(l.id, { title: 'A' });
  S.updateTodo(a.id, { parent: a.id });
  assert.doesNotThrow(() => S.descendantsOf(a.id));
  assert.doesNotThrow(() => S.toggleTodo(a.id));
});

test('Import räumt kaputte Einträge weg statt zu scheitern', () => {
  S._setData({});
  const json = JSON.stringify({
    v: 4,
    habits: [null, { id: 'h1', name: 'Gut', target: 2 }, { id: 'h1', name: 'Dublette' }, { name: 'Ohne Kennung' }],
    lists: [{ id: 'l1', name: 'Liste' }, null],
    todos: [
      { id: 't1', listId: 'l1', title: 'Gut' },
      { id: 't2', listId: 'gibtsnicht', title: 'Ohne Liste' },
      { id: 't3', listId: 'l1', title: 'Ring', parent: 't3' },
      null,
    ],
    log: { h1: { '2026-09-10': 2, 'kaputt': 5, '2026-09-11': -3 }, unbekannt: { '2026-09-10': 1 } },
  });
  assert.doesNotThrow(() => S.importJSON(json));

  const habits = S.habits();
  assert.equal(habits.filter(h => h.id === 'h1').length, 1, 'Dublette entfernt');
  assert.ok(habits.every(h => h.id && h.name), 'jedes Habit hat Kennung und Namen');
  assert.equal(S.todosOf('l1').length, 2, 'To-do ohne Liste verworfen');
  assert.equal(S.todo('t3').parent, null, 'Selbstverweis aufgelöst');
  assert.equal(S.valueOn('h1', '2026-09-10'), 2, 'gültiger Wert erhalten');
  assert.equal(S.valueOn('h1', '2026-09-11'), 0, 'negativer Wert verworfen');
  assert.equal(S.getData().log.unbekannt, undefined, 'Verlauf ohne Habit verworfen');
});

test('unsinnige Zielwerte werden auf etwas Brauchbares gesetzt', () => {
  S._setData({});
  S.importJSON(JSON.stringify({
    v: 4, lists: [], todos: [], log: {},
    habits: [{ id: 'a', name: 'A', target: 'viel' }, { id: 'b', name: 'B', target: -5 },
             { id: 'c', name: 'C', target: 0 }, { id: 'd', name: 'D', target: '2,5' }],
  }));
  const t = Object.fromEntries(S.habits().map(h => [h.name, h.target]));
  assert.equal(t.A, 1);
  assert.equal(t.B, 1);
  assert.equal(t.C, 1);
  assert.equal(t.D, 2.5, 'Komma als Dezimaltrenner');
});

test('ungültiger Zeitplan fällt auf täglich zurück', () => {
  S._setData({});
  S.importJSON(JSON.stringify({
    v: 4, lists: [], todos: [], log: {},
    habits: [{ id: 'a', name: 'A', sched: 'quartalsweise' }, { id: 'b', name: 'B', sched: 'days', days: [9, -1, 'x'] }],
  }));
  const h = Object.fromEntries(S.habits().map(x => [x.name, x]));
  assert.equal(h.A.sched, 'day');
  assert.deepEqual(h.B.days, [1, 2, 3, 4, 5], 'unbrauchbare Wochentage ersetzt');
});

test('Berechnungen über sehr lange Zeiträume bleiben begrenzt', () => {
  S._setData({});
  const h = S.addHabit({ name: 'Alt', created: '2015-01-01' });
  const t0 = Date.now();
  const r = S.completionRate(h, S.today());
  const st = S.currentStreak(h, S.today());
  assert.ok(Date.now() - t0 < 500, 'rechnet in vertretbarer Zeit');
  assert.ok(Number.isFinite(r.pct) && Number.isFinite(st));
});

console.log('\nSuche mit Tippfehlern');

/** Bestand, an dem die Suche geprüft wird. */
function searchSetup() {
  S._setData({});
  S.addHabit({ name: 'Vitamine nehmen', sched: 'day', target: 1, created: '2026-01-01' });
  S.addHabit({ name: 'Krafttraining', sched: 'week', target: 3, created: '2026-01-01' });
  S.addHabit({ name: 'Wasser trinken', sched: 'day', unit: 'glass', target: 8, created: '2026-01-01' });
  const l = S.addList({ name: 'Einkaufen' });
  S.addTodo(l.id, { title: 'Spülmaschine ausräumen', note: 'vor dem Frühstück' });
  S.addTodo(l.id, { title: 'Geburtstagsgeschenk' });
  return l;
}
const titles = (q) => S.search(q, { settingsEntries: [] }).map(h => h.title);

test('wörtliche Treffer funktionieren weiter', () => {
  searchSetup();
  assert.deepEqual(titles('vitamine'), ['Vitamine nehmen']);
  assert.deepEqual(titles('spül'), ['Spülmaschine ausräumen']);
});

test('vertippt, verdreht, vergessen – wird trotzdem gefunden', () => {
  searchSetup();
  const cases = [
    ['Vitmine', 'Vitamine nehmen'],          // Buchstabe fehlt
    ['Vitaminr', 'Vitamine nehmen'],         // Buchstabe daneben
    ['Vitmain', 'Vitamine nehmen'],          // vertauscht
    ['Krafttraning', 'Krafttraining'],       // fehlender Buchstabe im Kompositum
    ['Kraftraining', 'Krafttraining'],       // doppelter Buchstabe vergessen
    ['Spülmschine', 'Spülmaschine ausräumen'],
    ['Geburtstaggeschenk', 'Geburtstagsgeschenk'],
    ['Einkafen', 'Einkaufen'],
    ['wasse', 'Wasser trinken'],             // abgeschnitten
  ];
  const fehlt = cases.filter(([q, want]) => !titles(q).includes(want)).map(([q]) => q);
  assert.deepEqual(fehlt, [], 'diese Eingaben finden nichts');
});

test('unscharfe Treffer nur bei langen Wörtern', () => {
  searchSetup();
  // Drei Buchstaben dürfen nicht auf alles passen
  assert.deepEqual(titles('vit'), ['Vitamine nehmen'], 'kurz, aber wörtlich enthalten');
  assert.deepEqual(titles('xyz'), [], 'kurz und falsch findet nichts');
  assert.deepEqual(titles('Zitronenpresse'), [], 'völlig anderes Wort findet nichts');
});

test('wörtlicher Treffer steht vor dem geratenen', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  S.addTodo(l.id, { title: 'Kalender' });      // unscharf zu "Kalander"
  S.addTodo(l.id, { title: 'Kalander' });      // wörtlich
  assert.deepEqual(titles('Kalander'), ['Kalander', 'Kalender']);
});

test('Umlaute und ß werden gefaltet, auch mit Tippfehler', () => {
  searchSetup();
  assert.deepEqual(titles('spulmaschine'), ['Spülmaschine ausräumen']);
  assert.deepEqual(titles('ausraumen'), ['Spülmaschine ausräumen']);
  assert.deepEqual(titles('spulmschine'), ['Spülmaschine ausräumen']);
});

test('mehrere Wörter: jedes muss passen, Tippfehler zählen zusammen', () => {
  searchSetup();
  assert.deepEqual(titles('spülmaschine ausräumen'), ['Spülmaschine ausräumen']);
  assert.deepEqual(titles('spülmschine ausraumen'), ['Spülmaschine ausräumen']);
  assert.deepEqual(titles('spülmaschine zitrone'), [], 'ein Wort passt nicht');
});

test('Notizen werden mitdurchsucht, auch unscharf', () => {
  searchSetup();
  assert.deepEqual(titles('Frühstück'), ['Spülmaschine ausräumen']);
  assert.deepEqual(titles('Fruhstuck'), ['Spülmaschine ausräumen']);
  assert.deepEqual(titles('Frühstuk'), ['Spülmaschine ausräumen']);
});

test('die markierte Stelle passt zum Treffer', () => {
  const span = (text, q) => {
    const m = S.matchSpan(text, q);
    return m ? text.slice(m.at, m.at + m.len) : null;
  };
  assert.equal(span('Vitamine nehmen', 'vitamine'), 'Vitamine');
  assert.equal(span('Vitamine nehmen', 'Vitmine'), 'Vitamine', 'markiert das ganze ähnliche Wort');
  assert.equal(span('Spülmaschine ausräumen', 'ausraumen'), 'ausräumen');
  assert.equal(span('Spülmaschine ausräumen', 'maschine'), 'maschine', 'auch mitten im Wort');
  assert.equal(span('Vitamine nehmen', 'Zitrone'), null, 'kein Treffer, keine Markierung');
});

test('Suche bleibt schnell genug für Eingabe im Takt', () => {
  S._setData({});
  const l = S.addList({ name: 'Gross' });
  for (let i = 0; i < 2000; i++) {
    S.addTodo(l.id, { title: `Besorgung Nummer ${i}`, note: 'eine Notiz mit etwas Text darin' });
  }
  const t0 = Date.now();
  for (const q of ['besrgung', 'nummer 1', 'notz', 'xyzabc', 'besorgung']) {
    S.search(q, { settingsEntries: [] });
  }
  const ms = Date.now() - t0;
  assert.ok(ms < 900, `fünf Suchen über 2000 To-dos dauerten ${ms} ms`);
});

console.log('\nPlanung');

/** Ein Habit, ein To-do, ein Montag als Bezugstag. */
function planSetup() {
  S._setData({});
  const h = S.addHabit({ name: 'Laufen', emoji: '🏃', color: 'green', sched: 'days',
                         days: [1, 3, 5], unit: 'km', target: 5, created: '2026-01-01' });
  const l = S.addList({ name: 'Büro', emoji: '💼', color: 'blue' });
  const t = S.addTodo(l.id, { title: 'Steuer sortieren' });
  return { h, l, t };
}
const titelAm = (key) => S.planOn(key).map(e => `${e.plan.time} ${e.title}`);

test('nichts erscheint von allein', () => {
  planSetup();
  assert.deepEqual(S.planOn(MON), [], 'kein Eintrag ohne Auswahl');
  assert.equal(S.hasPlanOn(MON), false);
});

test('einzelner Eintrag gilt nur an seinem Tag', () => {
  const { h } = planSetup();
  S.addPlan({ kind: 'habit', refId: h.id, date: MON, time: '07:00' });
  assert.deepEqual(titelAm(MON), ['07:00 Laufen']);
  assert.deepEqual(titelAm(d(1)), [], 'am Folgetag nichts');
  assert.deepEqual(titelAm(d(-1)), [], 'am Vortag nichts');
});

test('Standarddauer kommt aus den Einstellungen, getrennt je Art', () => {
  const { h, t } = planSetup();
  S.setSetting('planMinutesHabit', 45);
  S.setSetting('planMinutesTodo', 90);
  const a = S.addPlan({ kind: 'habit', refId: h.id, date: MON, time: '07:00' });
  const b = S.addPlan({ kind: 'todo', refId: t.id, date: MON, time: '14:00' });
  assert.equal(a.minutes, 45);
  assert.equal(b.minutes, 90);
  // Ausdrücklich angegebene Dauer schlägt die Vorgabe
  assert.equal(S.addPlan({ kind: 'habit', refId: h.id, date: MON, time: '20:00', minutes: 15 }).minutes, 15);
});

test('dauerhaftes Habit folgt seinem Rhythmus, nicht jedem Tag', () => {
  const { h } = planSetup();          // Laufen an Mo, Mi, Fr
  S.addPlan({ kind: 'habit', refId: h.id, date: MON, time: '07:00', repeat: true });
  const woche = [0, 1, 2, 3, 4, 5, 6].map(n => (S.hasPlanOn(d(n)) ? 'x' : '·')).join('');
  assert.equal(woche, 'x·x·x··', 'Mo Mi Fr geplant, Di Do Sa So frei');
});

test('dauerhafte To-do kommt täglich, bis sie erledigt ist', () => {
  const { t } = planSetup();
  S.addPlan({ kind: 'todo', refId: t.id, date: MON, time: '14:00', repeat: true });
  assert.equal(S.hasPlanOn(d(3)), true);
  S.toggleTodo(t.id);
  assert.equal(S.hasPlanOn(d(3)), false, 'nach dem Abhaken ist Ruhe');
  assert.deepEqual(titelAm(MON), ['14:00 Steuer sortieren'], 'am Starttag bleibt der Eintrag sichtbar');
  S.toggleTodo(t.id);
  assert.equal(S.hasPlanOn(d(3)), true, 'wieder geöffnet, wieder eingeplant');
});

test('eine Serie beginnt an ihrem Tag, nicht früher', () => {
  const { t } = planSetup();
  S.addPlan({ kind: 'todo', refId: t.id, date: d(2), time: '14:00', repeat: true });
  assert.equal(S.hasPlanOn(d(1)), false, 'davor nichts');
  assert.equal(S.hasPlanOn(d(2)), true);
  assert.equal(S.hasPlanOn(d(9)), true);
});

test('einzelnen Tag aus der Serie nehmen', () => {
  const { t } = planSetup();
  const p = S.addPlan({ kind: 'todo', refId: t.id, date: MON, time: '14:00', repeat: true });
  S.skipPlanOn(p.id, d(2));
  assert.equal(S.hasPlanOn(d(1)), true);
  assert.equal(S.hasPlanOn(d(2)), false, 'der übersprungene Tag ist frei');
  assert.equal(S.hasPlanOn(d(3)), true, 'die Serie läuft weiter');
});

test('den ersten Tag einer Serie nehmen schiebt den Anfang', () => {
  const { t } = planSetup();
  const p = S.addPlan({ kind: 'todo', refId: t.id, date: MON, time: '14:00', repeat: true });
  S.skipPlanOn(p.id, MON);
  assert.equal(S.hasPlanOn(MON), false);
  assert.equal(S.hasPlanOn(d(1)), true, 'ab dem Folgetag läuft sie weiter');
  assert.deepEqual(S.plan(p.id).skip, [], 'ohne wachsende Ausnahmeliste');
});

test('einen einzelnen Eintrag nehmen löscht ihn', () => {
  const { h } = planSetup();
  const p = S.addPlan({ kind: 'habit', refId: h.id, date: MON, time: '07:00' });
  S.skipPlanOn(p.id, MON);
  assert.equal(S.plan(p.id), null);
  assert.equal(S.hasPlanOn(MON), false);
});

test('Einträge kommen nach Uhrzeit sortiert', () => {
  const { h, t } = planSetup();
  S.addPlan({ kind: 'todo', refId: t.id, date: MON, time: '14:00' });
  S.addPlan({ kind: 'habit', refId: h.id, date: MON, time: '07:00' });
  S.addPlan({ kind: 'habit', refId: h.id, date: MON, time: '19:30' });
  assert.deepEqual(titelAm(MON), ['07:00 Laufen', '14:00 Steuer sortieren', '19:30 Laufen']);
});

test('Eintrag bringt Farbe, Emoji und Zustand mit', () => {
  const { h, t } = planSetup();
  S.setValue(h.id, MON, 5);
  S.addPlan({ kind: 'habit', refId: h.id, date: MON, time: '07:00', minutes: 60 });
  S.addPlan({ kind: 'todo', refId: t.id, date: MON, time: '14:00' });
  const [a, b] = S.planOn(MON);
  assert.equal(a.emoji, '🏃');
  assert.equal(a.color, 'green');
  assert.equal(a.done, true, 'Habit am Ziel gilt als erledigt');
  assert.equal(a.start, 7 * 60);
  assert.equal(a.end, 8 * 60);
  assert.equal(b.emoji, '', 'To-dos haben kein Emoji');
  assert.equal(b.color, 'blue', 'ohne eigene Farbe die der Liste');
  assert.equal(b.done, false);
});

test('Plan weist auf eine vorher fällige To-do hin', () => {
  const { t } = planSetup();
  S.updateTodo(t.id, { due: d(-3) });
  S.addPlan({ kind: 'todo', refId: t.id, date: MON, time: '14:00' });
  assert.equal(S.planOn(MON)[0].dueNote, d(-3));
  // Fälligkeit nach dem geplanten Tag ist kein Hinweis wert
  S.updateTodo(t.id, { due: d(5) });
  assert.equal(S.planOn(MON)[0].dueNote, '');
});

test('Einplanen lässt die Fälligkeit unberührt', () => {
  const { t } = planSetup();
  S.updateTodo(t.id, { due: d(4) });
  S.addPlan({ kind: 'todo', refId: t.id, date: MON, time: '14:00' });
  assert.equal(S.todo(t.id).due, d(4), 'die Fälligkeit bleibt, wo sie war');
});

test('Dauer bleibt in vernünftigen Grenzen', () => {
  const { h } = planSetup();
  assert.equal(S.addPlan({ kind: 'habit', refId: h.id, date: MON, minutes: 0 }).minutes, 5);
  assert.equal(S.addPlan({ kind: 'habit', refId: h.id, date: MON, minutes: 9999 }).minutes, 1440);
  const p = S.addPlan({ kind: 'habit', refId: h.id, date: MON, minutes: 30 });
  assert.equal(S.updatePlan(p.id, { minutes: -5 }).minutes, 5);
});

test('ein Eintrag endet spätestens um Mitternacht', () => {
  const { h } = planSetup();
  S.addPlan({ kind: 'habit', refId: h.id, date: MON, time: '23:30', minutes: 120 });
  assert.equal(S.planOn(MON)[0].end, 24 * 60);
});

test('Uhrzeit und Minuten rechnen in beide Richtungen', () => {
  assert.equal(S.minutesOf('07:30'), 450);
  assert.equal(S.minutesOf('00:00'), 0);
  assert.equal(S.timeOf(450), '07:30');
  assert.equal(S.timeOf(0), '00:00');
  assert.equal(S.timeOf(1439), '23:59');
  assert.equal(S.timeOf(99999), '23:59', 'wird begrenzt');
});

test('Tage des Monats mit Planung', () => {
  const { h } = planSetup();
  S.addPlan({ kind: 'habit', refId: h.id, date: '2026-09-03', time: '07:00' });
  S.addPlan({ kind: 'habit', refId: h.id, date: '2026-09-17', time: '07:00' });
  S.addPlan({ kind: 'habit', refId: h.id, date: '2026-10-02', time: '07:00' });
  const tage = S.plannedDaysOfMonth('2026-09-15');
  assert.deepEqual([...tage].sort(), ['2026-09-03', '2026-09-17'], 'nur der eigene Monat');
});

test('gelöschtes Habit nimmt seine Planung mit und bringt sie zurück', () => {
  const { h } = planSetup();
  S.addPlan({ kind: 'habit', refId: h.id, date: MON, time: '07:00', repeat: true });
  S.deleteHabit(h.id);
  assert.equal(S.hasPlanOn(MON), false, 'Planung ist mit weg');

  S.restoreTrash(S.trash()[0].id);
  assert.equal(S.hasPlanOn(MON), true, 'und mit zurück');
  assert.deepEqual(titelAm(MON), ['07:00 Laufen']);
});

test('gelöschte To-do nimmt ihre Planung mit und bringt sie zurück', () => {
  const { t } = planSetup();
  S.addPlan({ kind: 'todo', refId: t.id, date: MON, time: '14:00' });
  S.deleteTodo(t.id);
  assert.equal(S.hasPlanOn(MON), false);
  S.restoreTrash(S.trash()[0].id);
  assert.deepEqual(titelAm(MON), ['14:00 Steuer sortieren']);
});

test('gelöschte Liste nimmt die Planung ihrer To-dos mit', () => {
  const { l, t } = planSetup();
  S.addPlan({ kind: 'todo', refId: t.id, date: MON, time: '14:00' });
  S.deleteList(l.id);
  assert.equal(S.hasPlanOn(MON), false);
  S.restoreTrash(S.trash()[0].id);
  assert.deepEqual(titelAm(MON), ['14:00 Steuer sortieren']);
});

test('neu vergebene Kennung reißt die Planung nicht ab', () => {
  const { t } = planSetup();
  S.addPlan({ kind: 'todo', refId: t.id, date: MON, time: '14:00' });
  S.deleteTodo(t.id);
  const eintrag = S.trash()[0];
  // Die Kennung wieder besetzen – wie nach einem zurückgespielten Stand
  S.getData().todos.push({ ...t, listId: S.lists()[0].id, title: 'Besetzer' });

  const r = S.restoreTrash(eintrag.id);
  assert.match(r.note, /Kennung/);
  assert.deepEqual(titelAm(MON), ['14:00 Steuer sortieren'],
    'der Eintrag zeigt auf das wiederhergestellte To-do, nicht auf den Besetzer');
});

test('Planung ohne ihr Ziel wird beim Laden verworfen', () => {
  S._setData({
    v: 6,
    habits: [{ id: 'h1', name: 'Da', sched: 'day', target: 1, created: '2026-01-01' }],
    lists: [{ id: 'l1', name: 'L' }],
    todos: [{ id: 't1', listId: 'l1', title: 'Da' }],
    plans: [
      { id: 'p1', kind: 'habit', refId: 'h1', date: MON, time: '07:00' },
      { id: 'p2', kind: 'habit', refId: 'weg', date: MON, time: '08:00' },
      { id: 'p3', kind: 'todo', refId: 'weg', date: MON, time: '09:00' },
      { id: 'p4', kind: 'unsinn', refId: 't1', date: MON },
      { id: 'p5', kind: 'todo', refId: 't1', date: 'kaputt' },
      { id: 'p6', kind: 'todo', refId: 't1', date: MON, time: '99:99' },
      null,
    ],
  });
  assert.deepEqual(titelAm(MON), ['07:00 Da', '09:00 Da'],
    'Verweise ins Leere weg, kaputte Uhrzeit auf 09:00 gesetzt');
});

test('Planung übersteht Sichern und Laden', () => {
  const { h } = planSetup();
  S.addPlan({ kind: 'habit', refId: h.id, date: MON, time: '07:00', minutes: 45, repeat: true });
  const json = S.exportJSON();
  S._setData({});
  assert.equal(S.hasPlanOn(MON), false);
  S.importJSON(json);
  const [e] = S.planOn(MON);
  assert.equal(e.plan.time, '07:00');
  assert.equal(e.plan.minutes, 45);
  assert.equal(e.plan.repeat, true);
});

console.log('\nPapierkorb');

test('gelöschtes Habit landet im Papierkorb und kommt mit Verlauf zurück', () => {
  S._setData({});
  const h = S.addHabit({ name: 'Laufen', emoji: '🏃', color: 'green', sched: 'day', target: 5, created: '2026-01-01' });
  S.setValue(h.id, '2026-09-01', 5);
  S.setValue(h.id, '2026-09-02', 3);

  S.deleteHabit(h.id);
  assert.equal(S.habits().length, 0);
  assert.equal(S.trashCount(), 1);
  assert.equal(S.trash()[0].title, 'Laufen');
  assert.equal(S.trash()[0].detail, '2 erfasste Tage');

  const r = S.restoreTrash(S.trash()[0].id);
  assert.equal(r.ok, true);
  assert.equal(r.note, '', 'nichts musste angepasst werden');
  assert.equal(S.trashCount(), 0);
  const back = S.habits()[0];
  assert.equal(back.name, 'Laufen');
  assert.equal(S.valueOn(back.id, '2026-09-01'), 5);
  assert.equal(S.valueOn(back.id, '2026-09-02'), 3);
});

test('gelöschte Liste kommt mit allen To-dos und ihrer Verschachtelung zurück', () => {
  S._setData({});
  const l = S.addList({ name: 'Einkaufen', emoji: '🛒', color: 'green' });
  const a = S.addTodo(l.id, { title: 'Milch' });
  const b = S.addTodo(l.id, { title: 'Vollmilch' });
  S.indentTodo(b.id);
  assert.equal(S.todo(b.id).parent, a.id);

  S.deleteList(l.id);
  assert.equal(S.lists().length, 0);
  assert.equal(S.todosOf(l.id).length, 0);
  assert.equal(S.trash()[0].detail, '2 To-dos');

  S.restoreTrash(S.trash()[0].id);
  assert.equal(S.lists().length, 1);
  const titles = S.todosOf(l.id).map(t => t.title);
  assert.deepEqual(titles.sort(), ['Milch', 'Vollmilch']);
  const back = S.todosOf(l.id).find(t => t.title === 'Vollmilch');
  assert.equal(S.todo(back.id).parent, a.id, 'bleibt Unter-To-do');
});

test('gelöschte To-do nimmt ihre Unter-To-dos mit und zurück', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const a = S.addTodo(l.id, { title: 'Umzug' });
  const b = S.addTodo(l.id, { title: 'Kartons' });
  S.indentTodo(b.id);

  S.deleteTodo(a.id);
  assert.equal(S.todosOf(l.id).length, 0);
  assert.equal(S.trash()[0].detail, 'mit 1 Unter-To-do');

  S.restoreTrash(S.trash()[0].id);
  assert.equal(S.todosOf(l.id).length, 2);
  const kid = S.todosOf(l.id).find(t => t.title === 'Kartons');
  assert.equal(S.todo(kid.id).parent, a.id);
});

test('To-do ohne ihre alte Liste kommt in die erste vorhandene', () => {
  S._setData({});
  const l = S.addList({ name: 'Alt' });
  const t = S.addTodo(l.id, { title: 'Reste' });
  S.deleteTodo(t.id);
  const entry = S.trash()[0];
  S.purgeTrash(S.trash().find(e => e.kind === 'list')?.id || '');   // nichts entfernen
  S.deleteList(l.id);
  const neu = S.addList({ name: 'Neu' });

  const r = S.restoreTrash(entry.id);
  assert.equal(r.ok, true);
  assert.match(r.note, /Neu/, 'die Meldung nennt die Ersatzliste');
  assert.deepEqual(S.todosOf(neu.id).map(x => x.title), ['Reste']);
});

test('To-do ohne jede Liste bekommt eine neue', () => {
  S._setData({});
  const l = S.addList({ name: 'Einzige' });
  const t = S.addTodo(l.id, { title: 'Allein' });
  S.deleteTodo(t.id);
  const entry = S.trash()[0];
  S.deleteList(l.id);
  assert.equal(S.lists().length, 0);

  const r = S.restoreTrash(entry.id);
  assert.equal(r.ok, true);
  assert.equal(S.lists().length, 1);
  assert.equal(S.lists()[0].name, 'Wiederhergestellt');
  assert.deepEqual(S.todosOf(S.lists()[0].id).map(x => x.title), ['Allein']);
});

test('vergebene Kennung führt zu einer neuen, nicht zum Verlust', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const t = S.addTodo(l.id, { title: 'Doppelt' });
  S.deleteTodo(t.id);
  const entry = S.trash()[0];

  // Genau diese Kennung wieder belegen – so sieht es nach einem Import aus,
  // der einen alten Stand zurückgespielt hat.
  S.getData().todos.push({ ...t, listId: l.id, title: 'Besetzer' });

  const r = S.restoreTrash(entry.id);
  assert.equal(r.ok, true);
  assert.match(r.note, /Kennung/, 'die Meldung sagt, dass angepasst wurde');
  assert.deepEqual(S.todosOf(l.id).map(x => x.title).sort(), ['Besetzer', 'Doppelt'],
    'beide sind da, keine überschreibt die andere');
});

test('Papierkorb räumt nach 30 Tagen auf, behält Jüngeres', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const a = S.addTodo(l.id, { title: 'Alt' });
  const b = S.addTodo(l.id, { title: 'Neu' });
  S.deleteTodo(a.id);
  S.deleteTodo(b.id);
  const alt = S.trash().find(e => e.title === 'Alt');
  alt.at = new Date(Date.now() - 31 * 86400000).toISOString();

  assert.equal(S.pruneTrash(), 1);
  assert.deepEqual(S.trash().map(e => e.title), ['Neu']);
});

test('endgültig löschen und leeren', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  for (const title of ['A', 'B', 'C']) S.deleteTodo(S.addTodo(l.id, { title }).id);
  assert.equal(S.trashCount(), 3);

  assert.equal(S.purgeTrash(S.trash()[0].id), true);
  assert.equal(S.trashCount(), 2);
  assert.equal(S.purgeTrash('gibtsnicht'), false);

  assert.equal(S.emptyTrash(), 2);
  assert.equal(S.trashCount(), 0);
  assert.equal(S.emptyTrash(), 0, 'leerer Papierkorb ist kein Fehler');
});

test('Papierkorb übersteht Sichern und Laden', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const t = S.addTodo(l.id, { title: 'Weg' });
  S.deleteTodo(t.id);

  const json = S.exportJSON();
  S._setData({});
  assert.equal(S.trashCount(), 0);
  S.importJSON(json);
  assert.equal(S.trashCount(), 1);
  S.restoreTrash(S.trash()[0].id);
  assert.deepEqual(S.todosOf(l.id).map(x => x.title), ['Weg']);
});

test('kaputte Papierkorb-Einträge werden verworfen, gute bleiben', () => {
  S._setData({
    v: 5,
    lists: [{ id: 'l1', name: 'L' }],
    todos: [],
    trash: [
      null,
      { kind: 'unsinn', payload: {} },
      { id: 'x', kind: 'todo', payload: { todos: [] } },              // leer
      { id: 'y', kind: 'habit', payload: {} },                         // ohne Habit
      { id: 'z', kind: 'todo', at: '2026-09-01T10:00:00.000Z', title: 'Gut',
        payload: { todos: [{ id: 't9', listId: 'l1', title: 'Gut' }] } },
    ],
  });
  assert.equal(S.trashCount(), 1);
  assert.equal(S.trash()[0].title, 'Gut');
  S.restoreTrash(S.trash()[0].id);
  assert.deepEqual(S.todosOf('l1').map(t => t.title), ['Gut']);
});

test('abgehakte To-do meldet, was sich wirklich geändert hat', () => {
  S._setData({});
  const l = S.addList({ name: 'L' });
  const a = S.addTodo(l.id, { title: 'Eltern' });
  const b = S.addTodo(l.id, { title: 'Kind 1' });
  const c = S.addTodo(l.id, { title: 'Kind 2' });
  S.indentTodo(b.id);
  S.indentTodo(c.id);

  // Eltern abhaken zieht beide Kinder mit: drei Änderungen
  assert.equal(S.toggleTodo(a.id).length, 3);
  // Nochmal in dieselbe Richtung ändert nichts
  assert.deepEqual(S.toggleTodo(a.id, true), []);
  // Ein Kind öffnen öffnet auch die ÜberTo-do: zwei Änderungen
  assert.deepEqual(S.toggleTodo(b.id).sort(), [a.id, b.id].sort());
  // Das letzte offene Kind abhaken schließt die ÜberTo-do wieder
  assert.deepEqual(S.toggleTodo(b.id).sort(), [a.id, b.id].sort());
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
