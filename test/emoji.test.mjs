/* Prüft die Emoji-Suche über die vollständige Bibliothek.
   node test/emoji.test.mjs */

import assert from 'node:assert/strict';
import { searchEmoji, allEmoji, starterEmoji, emojiName } from '../js/emoji.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (err) { failed++; console.log(`  FAIL ${name}\n       ${err.message}`); }
}

/** Variationsselektor ignorieren – ☕ und ☕️ sind dasselbe Emoji. */
const same = (a, b) => a.replace(/️/g, '') === b.replace(/️/g, '');
const rank = (query, want, limit = 6) =>
  searchEmoji(query, limit).findIndex(e => same(e, want));

/* Was ein Nutzer bei Habits und Aufgaben eintippt, und was dabei
   herauskommen soll. Diese Liste ist das eigentliche Qualitätsmaß. */
const EXPECTED = [
  ['Wasser trinken', '💧'], ['Zähne putzen', '🪥'], ['Laufen', '🏃'], ['Lesen', '📖'],
  ['Meditieren', '🧘'], ['Vitamine', '💊'], ['Einkaufen', '🛒'], ['Müll rausbringen', '🗑️'],
  ['Steuererklärung', '🧾'], ['Hund Gassi gehen', '🐕'], ['Klavier üben', '🎹'],
  ['Blumen gießen', '🪴'], ['Fenster putzen', '🪟'], ['Geschenk kaufen', '🎁'],
  ['Wäsche waschen', '🧺'], ['Krafttraining', '🏋️'], ['Yoga', '🧘'], ['Schlafen', '😴'],
  ['Kaffee', '☕️'], ['Urlaub buchen', '✈️'], ['Arzttermin', '🩺'], ['Laufband', '🏃'],
  ['Bildschirmzeit', '📱'], ['Tagebuch schreiben', '✍️'], ['Spazieren gehen', '🚶'],
  ['Aufstehen', '⏰'], ['Dankbarkeit', '🙏'], ['Sparen', '💰'], ['Rauchen aufhören', '🚭'],
  ['Abwasch', '🍽️'], ['Bett machen', '🛏️'], ['Duschen', '🚿'], ['Podcast hören', '🎧'],
  ['Radfahren', '🚴'], ['Schwimmen', '🏊'], ['Dehnen', '🤸'], ['Programmieren', '💻'],
  ['Mail schreiben', '📧'], ['Anrufen', '📞'], ['Paket abholen', '📦'],
  ['Gitarre üben', '🎸'], ['Malen', '🎨'], ['Fotos sortieren', '📷'], ['Geburtstag', '🎂'],
  ['Zug buchen', '🚂'], ['Auto tanken', '⛽️'], ['Katze füttern', '🐈'], ['Salat essen', '🥗'],
];

console.log('\nTrefferqualität');
test('mindestens 80 % stehen an erster Stelle', () => {
  const first = EXPECTED.filter(([q, w]) => rank(q, w) === 0);
  const quote = first.length / EXPECTED.length;
  const misses = EXPECTED.filter(([q, w]) => rank(q, w) !== 0)
    .map(([q, w]) => `${q}→${searchEmoji(q, 3).join('')} (statt ${w})`);
  assert.ok(quote >= 0.8,
    `nur ${first.length}/${EXPECTED.length} (${Math.round(quote * 100)} %)\n       ${misses.join('\n       ')}`);
  console.log(`       ${first.length}/${EXPECTED.length} an erster Stelle (${Math.round(quote * 100)} %)`);
});

test('alle erwarteten Emojis stehen in den ersten sechs', () => {
  const misses = EXPECTED.filter(([q, w]) => rank(q, w) < 0)
    .map(([q, w]) => `${q} findet ${w} nicht: ${searchEmoji(q, 6).join(' ') || '(nichts)'}`);
  assert.equal(misses.length, 0, misses.join('\n       '));
});

console.log('\nSprache');
test('Umlaute und Groß-/Kleinschreibung sind gleichgültig', () => {
  assert.deepEqual(searchEmoji('ZÄHNE', 3), searchEmoji('zahne', 3));
  assert.deepEqual(searchEmoji('Gießen', 3), searchEmoji('giessen', 3));
});

test('Beugungen und Wortformen werden gefunden', () => {
  // Geprüft werden die Formen, die man tatsächlich eintippt: Infinitiv,
  // Plural, Substantivierung. Starke Partizipien mit Vokalwechsel
  // (gießen → gegossen) fängt kein Suffix-Stemming ab; als Name eines
  // Habits oder einer Aufgabe kommen sie auch nicht vor.
  assert.ok(rank('meditieren', '🧘', 3) >= 0, 'meditieren → 🧘 (Stichwort: Meditation)');
  assert.ok(rank('Blumen', '🪴', 5) >= 0, 'Plural: Blumen → 🪴');
  assert.ok(rank('Einkäufe', '🛒', 5) >= 0, 'Plural mit Umlaut: Einkäufe → 🛒');
  assert.ok(rank('Lauftraining', '🏃', 5) >= 0, 'Zusammensetzung: Lauftraining → 🏃');
  assert.ok(rank('gelesen', '📖', 6) >= 0, 'schwaches Partizip: gelesen → 📖');
});

test('zusammengesetzte Wörter greifen auf ihren Anfang zurück', () => {
  assert.ok(rank('Laufband', '🏃', 4) >= 0, 'Laufband → 🏃');
  assert.ok(rank('Zahnpflege', '🦷', 5) >= 0, 'Zahnpflege → 🦷');
});

console.log('\nRobustheit');
test('Unsinn liefert nichts statt zufälliger Treffer', () => {
  for (const q of ['xyzqwertz', 'zzzzz', 'qqqq']) {
    assert.deepEqual(searchEmoji(q), [], `"${q}" liefert Treffer`);
  }
});

test('leere und zu kurze Eingaben liefern nichts', () => {
  for (const q of ['', '   ', 'a', '!!!']) assert.deepEqual(searchEmoji(q), [], `"${q}"`);
});

test('Länderflaggen verdrängen keine echten Treffer', () => {
  // „Lesen“ darf nicht 🇱🇸 (Lesotho) vor 📖 zeigen
  const r = searchEmoji('Lesen', 3);
  assert.ok(same(r[0], '📖'), `Lesen → ${r.join(' ')}`);
  const s = searchEmoji('Malen', 3);
  assert.ok(!s.slice(0, 2).some(e => /\u{1F1E6}-\u{1F1FF}/u.test(e)), `Malen → ${s.join(' ')}`);
});

test('Grenze wird eingehalten, keine Dubletten', () => {
  for (const q of ['wasser', 'sport', 'putzen', 'essen', 'arbeit']) {
    const r = searchEmoji(q, 12);
    assert.ok(r.length <= 12, `${q}: ${r.length} Treffer`);
    assert.equal(new Set(r).size, r.length, `Dublette bei "${q}"`);
  }
});

console.log('\nBibliothek');
test('vollständige Bibliothek ist geladen', () => {
  const all = allEmoji();
  assert.ok(all.length > 1500, `nur ${all.length} Emojis`);
  assert.equal(new Set(all).size, all.length, 'Dubletten in der Bibliothek');
});

test('keine Hautfarben-Varianten', () => {
  const skin = allEmoji().filter(e => /[\u{1F3FB}-\u{1F3FF}]/u.test(e));
  assert.equal(skin.length, 0, `${skin.length} Varianten, z. B. ${skin.slice(0, 3).join(' ')}`);
});

test('jedes Emoji hat einen deutschen Namen', () => {
  const sample = allEmoji().filter((_, i) => i % 97 === 0);
  for (const e of sample) {
    const n = emojiName(e);
    assert.ok(n && n.length > 1, `${e} ohne Namen`);
  }
  assert.equal(emojiName('💧'), 'Tropfen');
  assert.equal(emojiName('🦷'), 'Zahn');
});

test('Startauswahl ist alltagsnah und ohne Dubletten', () => {
  const s = starterEmoji(20);
  assert.equal(s.length, 20);
  assert.equal(new Set(s).size, 20);
  for (const e of ['💧', '🏃', '📖']) {
    assert.ok(s.some(x => same(x, e)), `${e} fehlt in der Startauswahl`);
  }
});

test('Suche bleibt schnell genug für Eingabe im Takt', () => {
  searchEmoji('aufwärmen');            // Index bauen
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) searchEmoji('zahne putzen');
  const each = (Date.now() - t0) / 20;
  assert.ok(each < 40, `${each.toFixed(1)} ms pro Suche`);
  console.log(`       ${each.toFixed(1)} ms pro Suche`);
});

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen\n`);
process.exit(failed ? 1 : 0);
