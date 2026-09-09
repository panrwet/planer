/* Prüft die Emoji-Suche: node test/emoji.test.mjs */

import assert from 'node:assert/strict';
import { searchEmoji, ALL_EMOJI, STARTER_EMOJI } from '../js/emoji.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (err) { failed++; console.log(`  FAIL ${name}\n       ${err.message}`); }
}

/** Erwartet, dass `want` unter den ersten `top` Treffern ist. */
function hits(query, want, top = 3) {
  const res = searchEmoji(query, top);
  assert.ok(res.includes(want), `"${query}" → ${res.join(' ') || '(nichts)'}, erwartet ${want} in den ersten ${top}`);
}

console.log('\nTreffsicherheit');
test('typische Habits werden erkannt', () => {
  hits('Wasser trinken', '💧', 1);
  hits('Laufen', '🏃', 1);
  hits('Lesen', '📖', 1);
  hits('Meditieren', '🧘', 1);
  hits('Vitamine', '💊', 1);
  hits('Zähne putzen', '🦷', 2);
  hits('Krafttraining', '🏋️', 2);
  hits('Schlafen', '😴', 1);
});

test('typische Aufgaben werden erkannt', () => {
  hits('Einkaufen', '🛒', 1);
  hits('Müll rausbringen', '🗑️', 1);
  hits('Steuer', '🧾', 1);
  hits('Rechnung bezahlen', '🧾', 3);
  hits('Fahrrad reparieren', '🔧', 3);
  hits('Blumen gießen', '🪴', 3);
  hits('Hund Gassi', '🐕', 1);
  hits('Zug buchen', '🚂', 2);
});

test('Umlaute und Groß-/Kleinschreibung sind gleichgültig', () => {
  assert.deepEqual(searchEmoji('ZÄHNE', 1), searchEmoji('zahne', 1));
  assert.deepEqual(searchEmoji('Gießen', 1), searchEmoji('giessen', 1));
});

test('mehrere Wörter zählen zusammen', () => {
  // "Wasser" allein trifft mehrere; mit "trinken" muss 💧 vorn stehen
  assert.equal(searchEmoji('Wasser trinken', 1)[0], '💧');
});

test('Wortanfang genügt, ganze Wörter wiegen mehr', () => {
  hits('Medi', '💊', 3);          // Medikament
  assert.equal(searchEmoji('kaffee', 1)[0], '☕️');
});

console.log('\nRobustheit');
test('Unsinn liefert nichts statt zufälliger Treffer', () => {
  assert.deepEqual(searchEmoji('xyzqwertz'), []);
  assert.deepEqual(searchEmoji('zzz'), []);
});

test('leere und zu kurze Eingaben liefern nichts', () => {
  for (const q of ['', '   ', 'a', 'x', '!!!', '123']) {
    assert.deepEqual(searchEmoji(q), [], `"${q}" sollte leer sein`);
  }
});

test('kurze Wortfragmente erzeugen keine Fehltreffer', () => {
  // "üben" darf nicht über "schrauben" Werkzeug-Emojis hochziehen
  const res = searchEmoji('Gitarre üben', 6);
  assert.ok(!res.includes('🪛'), `Fehltreffer: ${res.join(' ')}`);
  assert.equal(res[0], '🎸');
});

test('Grenze wird eingehalten', () => {
  assert.ok(searchEmoji('wasser', 3).length <= 3);
  assert.ok(searchEmoji('a e i o u wasser laufen lesen', 5).length <= 5);
});

test('keine Dubletten in den Ergebnissen', () => {
  for (const q of ['wasser', 'sport', 'putzen', 'arbeit', 'essen']) {
    const res = searchEmoji(q, 20);
    assert.equal(new Set(res).size, res.length, `Dublette bei "${q}"`);
  }
});

console.log('\nDatenbank');
test('keine doppelten Emojis in der Datenbank', () => {
  assert.equal(new Set(ALL_EMOJI).size, ALL_EMOJI.length);
});

test('Datenbank hat eine brauchbare Größe', () => {
  assert.ok(ALL_EMOJI.length >= 150, `nur ${ALL_EMOJI.length} Einträge`);
});

test('Startvorschläge sind alle in der Datenbank', () => {
  for (const e of STARTER_EMOJI) assert.ok(ALL_EMOJI.includes(e), `${e} fehlt in der Datenbank`);
});

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen\n`);
process.exit(failed ? 1 : 0);
