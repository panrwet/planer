/* Emoji-Suche über die vollständige Bibliothek.
   Die Daten stecken in emoji-data.js und stammen aus den offiziellen
   CLDR-Annotationen von Unicode – deutsche Namen und Suchbegriffe.

   Der Index wird erst beim ersten Suchen gebaut, damit der App-Start nicht
   auf ~1950 Einträge warten muss. */

import { RAW, PREFERRED_COUNT, FLAG_START } from './emoji-data.js';

/** Vergleichsform: ohne Umlaute, Kleinbuchstaben, nur Buchstaben und Ziffern. */
function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deutsche Wörter treten in Beugungen und Zusammensetzungen auf: gesucht wird
 * „Zähne putzen", im Datensatz steht „Zahnbürste" und „putzen". Deshalb wird zu
 * jedem Suchwort eine kurze Liste von Stämmen gebildet, die als Wortanfang
 * gelten dürfen.
 */
function stems(word) {
  const out = [word];
  // Partizip-Präfix: „gelesen" soll „lesen" finden
  if (word.length >= 6 && word.startsWith('ge')) out.push(word.slice(2));
  for (const base of [...out]) {
    for (const suffix of ['en', 'er', 'es', 'e', 'n', 's']) {
      if (base.length - suffix.length >= 3 && base.endsWith(suffix)) {
        out.push(base.slice(0, -suffix.length));
      }
    }
  }
  return [...new Set(out)];
}

let index = null;

function build() {
  if (index) return index;
  index = RAW.split('\n').map((line, i) => {
    const [emoji, name, keywords] = line.split('\t');
    const normName = normalize(name);
    const words = (keywords || '').split('|').filter(Boolean);
    return {
      emoji,
      name,
      normName,
      nameTokens: normName.split(' '),
      // Alle Stichwörter als Tokens, doppelte entfernt
      tokens: [...new Set(words.flatMap(w => normalize(w).split(' ')).filter(w => w.length > 1))],
      preferred: i < PREFERRED_COUNT,
      flag: FLAG_START >= 0 && i >= FLAG_START,
    };
  });
  return index;
}

/** Index im Leerlauf vorbereiten, damit der erste Editor sofort Vorschläge hat. */
export function warmUp() {
  const run = () => build();
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 400);
}

export function allEmoji() {
  return build().map(e => e.emoji);
}

/** Name eines Emojis, für Vorlesehilfen und Beschriftungen. */
export function emojiName(emoji) {
  return build().find(e => e.emoji === emoji)?.name || '';
}

/**
 * Bewertet einen Eintrag gegen ein einzelnes Suchwort.
 * Der Name wiegt schwerer als ein Stichwort, ein ganzes Wort schwerer als ein
 * Wortanfang, und ein Stamm-Treffer zählt am wenigsten – so landen exakte
 * Treffer zuverlässig vorn.
 */
function scoreWord(entry, word) {
  if (entry.normName === word) return 100;
  if (entry.normName.startsWith(word + ' ')) return 88;

  let best = 0;
  for (const t of entry.nameTokens) {
    if (t === word) { best = Math.max(best, 82); continue; }
    if (t.startsWith(word)) best = Math.max(best, 66);
  }
  for (const t of entry.tokens) {
    if (t === word) { best = Math.max(best, 72); continue; }
    if (t.startsWith(word)) best = Math.max(best, 54);
  }
  if (best) return best;

  // Erst wenn nichts direkt passt: Stämme und Zusammensetzungen probieren
  const all = [...entry.nameTokens, ...entry.tokens];
  for (const stem of stems(word).slice(1)) {
    if (stem.length < 3) continue;
    for (const t of all) {
      if (t === stem) best = Math.max(best, 50);
      else if (t.startsWith(stem)) best = Math.max(best, 42);
      else if (stem.length >= 4 && t.includes(stem)) best = Math.max(best, 30);
    }
  }
  if (best) return best;

  // Zusammengesetztes Suchwort, das mit einem Stichwort beginnt:
  // „Laufband" → „laufen", „Wochenplanung" → „woche"
  if (word.length >= 6) {
    for (const t of all) {
      if (t.length >= 4 && word.startsWith(t.slice(0, Math.min(t.length, 5)))) {
        best = Math.max(best, 34);
      }
    }
  }
  if (best) return best;

  // Letzte Stufe: gemeinsamer Wortanfang. Fängt Beugungen, die kein Stamm
  // trifft („meditieren" ↔ „meditation").
  if (word.length >= 5) {
    for (const t of all) {
      if (t.length < 5) continue;
      let n = 0;
      while (n < word.length && n < t.length && word[n] === t[n]) n++;
      if (n >= 5) best = Math.max(best, 24 + n);
    }
  }
  return best;
}

/**
 * Passende Emojis zum eingegebenen Text.
 * Jedes Wort muss irgendwo treffen – sonst käme bei „Zähne putzen" alles
 * heraus, was nur „putzen" kennt.
 */
export function searchEmoji(text, limit = 30) {
  const query = normalize(text);
  if (!query) return [];
  const words = query.split(' ').filter(w => w.length >= 2);
  if (!words.length) return [];

  const list = build();
  const hits = [];

  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    let total = 0;
    let matchedAll = true;
    for (const w of words) {
      const s = scoreWord(entry, w);
      if (!s) { matchedAll = false; break; }
      total += s;
    }
    // Bei mehreren Wörtern reicht auch ein sehr guter Einzeltreffer
    if (!matchedAll) {
      if (words.length < 2) continue;
      let best = 0;
      for (const w of words) best = Math.max(best, scoreWord(entry, w));
      if (best < 72) continue;
      total = best - 20;          // schwächer als ein vollständiger Treffer
    }
    // Alltagsnahe Emojis klar bevorzugen: bei „Wasser trinken" ist 💧 gemeint,
    // auch wenn ein Trinkbecher formal beide Wörter trifft.
    if (entry.preferred) total = total * 1.35 + 25;
    if (entry.flag) total -= 55;           // Länderflaggen sind selten gemeint
    total -= i / list.length;              // Gleichstand: CLDR-Reihenfolge
    hits.push({ emoji: entry.emoji, score: total });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map(h => h.emoji);
}

/** Startauswahl, solange nichts eingetippt ist: die alltagsnahen Emojis. */
export function starterEmoji(limit = 30) {
  return build().filter(e => e.preferred).slice(0, limit).map(e => e.emoji);
}
