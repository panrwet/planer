/**
 * Erzeugt js/emoji-data.js aus den offiziellen CLDR-Annotationen.
 *
 *   node tools/build-emoji.mjs <annotations/de.xml> <annotationsDerived/de.xml>
 *
 * Quelle: https://github.com/unicode-org/cldr → common/annotations/de.xml
 * (Namen und Suchbegriffe auf Deutsch, gepflegt von Unicode selbst).
 *
 * Ausgelassen werden Hautfarben- und Geschlechtsvarianten sowie Zeichen, die
 * keine Emojis sind – sie blähen die Datei auf, ohne bei der Suche zu helfen.
 * Die Datei ist erzeugt und wird nicht von Hand bearbeitet.
 */

import fs from 'node:fs';

const [, , dePath, derivedPath] = process.argv;
if (!dePath) {
  console.error('Aufruf: node tools/build-emoji.mjs <de.xml> [<derived-de.xml>]');
  process.exit(1);
}

/* ---------- CLDR einlesen ---------- */

function parseAnnotations(xml) {
  const names = new Map();     // cp -> Name (type="tts")
  const words = new Map();     // cp -> [Suchbegriffe]
  // Die Zeilen tragen wechselnde Zusatzattribute (draft="contributed" u. a.),
  // deshalb alle Attribute einsammeln und darin nach type="tts" sehen.
  const re = /<annotation\s+cp="([^"]*)"([^>]*)>([^<]*)<\/annotation>/g;
  let m;
  while ((m = re.exec(xml))) {
    const cp = decodeEntities(m[1]);
    const attrs = m[2];
    const text = decodeEntities(m[3]);
    if (attrs.includes('type="tts"')) names.set(cp, text.trim());
    else words.set(cp, text.split('|').map(s => s.trim()).filter(Boolean));
  }
  return { names, words };
}

function decodeEntities(s) {
  return s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
          .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

const base = parseAnnotations(fs.readFileSync(dePath, 'utf8'));
const derived = derivedPath && fs.existsSync(derivedPath)
  ? parseAnnotations(fs.readFileSync(derivedPath, 'utf8'))
  : { names: new Map(), words: new Map() };

/* ---------- Filtern ---------- */

const SKIN_TONES = /[\u{1F3FB}-\u{1F3FF}]/u;
const VARIATION = /\uFE0F/g;
const ZWJ = '\u200D';

/** Länderflaggen: für Habits und Aufgaben fast nie gemeint, deshalb bei der
    Suche nachrangig. */
function isFlag(cp) {
  const first = cp.codePointAt(0);
  return (first >= 0x1F1E6 && first <= 0x1F1FF) || cp.startsWith('\u{1F3F4}');
}

/** Ist das ein Emoji (und kein Satzzeichen, Buchstabe, Ziffer)? */
function isEmoji(cp) {
  if (!cp) return false;
  if (SKIN_TONES.test(cp)) return false;               // Hautfarben-Varianten
  const points = [...cp].map(c => c.codePointAt(0));
  const first = points[0];
  // Regionalindikatoren = Flaggen
  if (first >= 0x1F1E6 && first <= 0x1F1FF) return true;
  // Tastenkappen (#️⃣, 1️⃣ …)
  if (cp.includes('\u20E3')) return true;
  const ranges = [
    [0x1F300, 0x1FAFF],   // Symbole, Piktogramme, erweitert
    [0x1F000, 0x1F02F],   // Mahjong, Domino
    [0x1F0A0, 0x1F0FF],   // Spielkarten
    [0x2600, 0x27BF],     // Wettersymbole, Dingbats
    [0x2B00, 0x2BFF],     // Pfeile, Sterne
    [0x2190, 0x21FF],     // Pfeile
    [0x2700, 0x27BF],     // Dingbats
    [0x1F900, 0x1F9FF],   // Gesichter, Körperteile
    [0x2000, 0x20FF],     // Interpunktion (nur mit Variation Selector relevant)
    [0x2100, 0x214F],     // Buchstabenartige Symbole (™, ℹ)
    [0x2300, 0x23FF],     // Technische Zeichen (⌚, ⏰)
    [0x25A0, 0x25FF],     // Geometrische Formen
    [0x1FA70, 0x1FAFF],   // Symbole erweitert
  ];
  return ranges.some(([lo, hi]) => first >= lo && first <= hi);
}

/** Menschen-Emojis mit explizitem Geschlecht oder Beruf sind Varianten des
    neutralen Grundzeichens – ein Eintrag genügt für die Suche. */
function isRedundantPerson(cp) {
  if (!cp.includes(ZWJ)) return false;
  // Familien- und Paar-Kombinationen sowie Geschlechtszeichen aussortieren
  return /[\u2640\u2642]/.test(cp) || (cp.match(new RegExp(ZWJ, 'g')) || []).length >= 2;
}

/* ---------- Alltagsschicht ---------- */

/* CLDR beschreibt, was ein Emoji *darstellt* – nicht, wofür man es im Alltag
   verwendet. „Vitamine" steht bei keinem Emoji, „Krafttraining" auch nicht.
   Diese Ergänzungen schließen genau solche Lücken und werden bei der Suche
   wie CLDR-Stichwörter behandelt. */
const EXTRA = {
  '💧': 'wasser trinken hydration flüssigkeit durst',
  '🚰': 'wasser trinkwasser leitungswasser',
  '🥛': 'milch trinken kalzium',
  '☕️': 'kaffee koffein espresso wachwerden',
  '🍵': 'tee grüntee kräutertee',
  '💊': 'vitamine vitamin supplement nahrungsergänzung medikament tablette pille magnesium omega',
  '🩺': 'arzt arzttermin vorsorge check untersuchung blutdruck gesundheit',
  '🏋️': 'krafttraining gym fitnessstudio gewichte hanteln muskelaufbau workout training',
  '💪': 'muskeln kraft training fitness stark liegestütze',
  '🏃': 'laufen joggen jogging rennen lauftraining laufband cardio ausdauer 5km 10km',
  '🚶': 'spazieren spaziergang schritte gehen bewegung',
  '🚴': 'radfahren fahrrad rad velo bike radtour',
  '🏊': 'schwimmen bahnen schwimmbad kraulen',
  '🧘': 'meditieren meditation achtsamkeit entspannung atemübung ruhe yoga',
  '🤸': 'dehnen stretching beweglichkeit mobility gymnastik',
  '🧗': 'klettern bouldern kletterhalle',
  '📖': 'lesen buch lektüre seiten kapitel schmökern',
  '📚': 'lernen studieren studium bücher hausaufgaben',
  '✍️': 'schreiben tagebuch journal notieren aufschreiben',
  '📝': 'notiz aufgabe eintragen protokoll',
  '🧠': 'konzentration gedächtnis lernen denken fokus',
  '🎓': 'prüfung klausur uni studium abschluss',
  '🗣️': 'sprache vokabeln aussprache sprechen üben',
  '💻': 'arbeiten programmieren coden büro homeoffice projekt',
  '📱': 'handy bildschirmzeit smartphone',
  '📵': 'handyfrei offline digital detox bildschirmzeit',
  '💼': 'arbeit job beruf büro',
  '📅': 'termin planen kalender woche wochenplanung',
  '⏰': 'aufstehen früh wecker morgenroutine',
  '💰': 'sparen geld finanzen budget haushaltsbuch',
  '💳': 'bezahlen zahlung karte',
  '🧾': 'rechnung steuer steuererklärung beleg quittung buchhaltung abrechnung',
  '📧': 'email mail postfach schreiben nachricht',
  '📞': 'anrufen telefonieren anruf rückruf',
  '📦': 'paket versenden abholen retoure bestellung',
  '🧹': 'putzen aufräumen saubermachen hausarbeit haushalt kehren',
  '🧽': 'putzen wischen schrubben reinigen',
  '🧼': 'waschen hygiene seife händewaschen',
  '🧺': 'wäsche waschen wäschekorb bügeln',
  '🛏️': 'bett bettwäsche bettmachen aufstehen',
  '🚿': 'duschen kaltdusche morgenroutine',
  '🦷': 'zähne zahnpflege zahnseide zahnarzt',
  '🪥': 'zähneputzen zahnbürste zähne putzen',
  '🍽️': 'abwasch spülen geschirr küche aufräumen',
  '🛒': 'einkaufen einkauf supermarkt besorgungen lebensmittel',
  '🗑️': 'müll rausbringen abfall entsorgen mülltonne',
  '♻️': 'recycling mülltrennung altpapier glas pfand',
  '🔧': 'reparieren werkstatt schrauben warten instandsetzen',
  '🔨': 'handwerk bauen renovieren',
  '🪴': 'pflanzen gießen blumen zimmerpflanze',
  '🌱': 'garten säen setzling anpflanzen',
  '🚗': 'auto fahren werkstatt tüv inspektion tanken',
  '🐕': 'hund gassi hundespaziergang füttern',
  '🐈': 'katze füttern katzenklo',
  '😴': 'schlafen schlaf früh ins bett schlafenszeit ausschlafen',
  '🌙': 'abendroutine abends nachts',
  '☀️': 'morgen morgenroutine tageslicht sonne',
  '🥗': 'gesund essen ernährung salat gemüse',
  '🍎': 'obst frucht gesund snack',
  '🚭': 'rauchen aufhören rauchfrei nichtraucher zigaretten',
  '🍺': 'alkohol bier trinken feierabend',
  '⚖️': 'wiegen gewicht abnehmen waage',
  '🎸': 'gitarre üben instrument musik',
  '🎹': 'klavier piano üben keyboard instrument',
  '🎨': 'malen zeichnen kreativ kunst',
  '📷': 'fotografieren fotos bilder kamera',
  '🎧': 'podcast hörbuch musik hören',
  '🎮': 'zocken gaming videospiel spielen',
  '✈️': 'urlaub reise flug fliegen buchen',
  '🧳': 'koffer packen reise urlaub',
  '🎁': 'geschenk besorgen kaufen präsent',
  '🎂': 'geburtstag feiern kuchen',
  '🙏': 'dankbarkeit dankbar danke',
  '🎯': 'ziel vorsatz fokus',
  '🔥': 'serie streak motivation dranbleiben',
  '🏆': 'erfolg ziel erreicht gewonnen',
  '🏠': 'zuhause wohnung haus miete',
  '🩹': 'wunde pflaster verletzung',
  '🌬️': 'lüften atmen frische luft atemübung',
  '🪟': 'fenster putzen lüften',
};

/* ---------- Zusammenbauen ---------- */

/* Alltagsnahe Emojis, die bei mehreren Treffern vorn stehen sollen. Ohne diese
   Gewichtung liefert eine Suche nach „laufen" zuerst Eislaufen oder Nordic
   Walking, weil CLDR alle gleich behandelt. */
const PREFERRED = [
  // Die ersten 20 bilden die Startauswahl im Editor, wenn noch nichts
  // eingetippt ist – bewusst quer über alle Lebensbereiche gemischt.
  '⭐️','💧','🏃','📖','🧘','💪','😴','🥗','💊','🎯','🧹','✍️','🛒','🦷','☕️','🚴','🧠','📱','🪴','✅',
  // Trinken und Essen
  '🚰','🥛','🍵','🍺','🍷','🥦','🍎','🍌','🥑','🍳','🥣','🍞','🧀','🍕','🍫',
  // Sport und Bewegung
  '🚶','🏊','🏋️','🤸','⚽️','🏀','🎾','🥊','⛰️','🧗','👟','⚖️','🩺',
  // Lernen und Arbeit
  '📚','📝','🎓','🗣️','🌍','💻','📵','💼','📅','⏰','⏱️','📈','📊','💰','💳','🧾','📧','📞','📦',
  // Haushalt und Alltag
  '🧽','🧼','🧺','👕','🛏️','🚿','🪥','🍽️','🗑️','♻️','🔧','🔨','🪛','🧰','🌱','🚗','⛽️','🏠','🐕','🐈',
  // Stimmung und Ruhe
  '🌙','☀️','🌅','🙏','❤️','🔥','🏆','🎉','🚭',
  // Hobby und Freizeit
  '🎸','🎹','🎤','🎧','🎨','📷','🎬','📺','🎮','🧩','✈️','🧳','🗺️','🎁','🎂',
];
/* Rang in dieser Liste bestimmt auch die Startauswahl im Editor – deshalb ist
   die Reihenfolge oben bewusst gewählt und wird hier festgehalten. */
const preferredRank = new Map(PREFERRED.map((e, i) => [e.replace(VARIATION, ''), i]));

/* CLDR führt die Zeichen ohne Variationsselektor (☕ statt ☕️). Die Schlüssel
   der Alltagsschicht deshalb auf dieselbe Form bringen, sonst greift sie nicht. */
const extraByClean = new Map(
  Object.entries(EXTRA).map(([k, v]) => [k.replace(VARIATION, ''), v]),
);

const entries = [];
const seen = new Set();

for (const [cp, name] of [...base.names, ...derived.names]) {
  const clean = cp.replace(VARIATION, '');
  if (seen.has(clean)) continue;
  if (!isEmoji(clean) || isRedundantPerson(clean)) continue;
  if (!name) continue;
  seen.add(clean);

  const extra = (extraByClean.get(clean) || '').split(/\s+/).filter(Boolean);
  const kw = [...(base.words.get(cp) || []), ...(derived.words.get(cp) || []), ...extra];
  entries.push({
    cp, name, kw,
    pref: preferredRank.has(clean),
    rank: preferredRank.get(clean) ?? Infinity,
    flag: isFlag(clean),
  });
}

// Bevorzugte zuerst, danach in CLDR-Reihenfolge – das bestimmt die Startauswahl
// und entscheidet Gleichstände in der Suche.
entries.sort((a, b) =>
  (b.pref ? 1 : 0) - (a.pref ? 1 : 0)     // alltagsnahe zuerst …
  || a.rank - b.rank                       // … in der Reihenfolge der Liste oben
  || (a.flag ? 1 : 0) - (b.flag ? 1 : 0)); // Länderflaggen ganz hinten

/* ---------- Schreiben ---------- */

/** Ein Emoji je Zeile: emoji \t Name \t Stichwörter (durch | getrennt).
    Als ein großer String ist die Datei deutlich kleiner als als JSON-Array. */
const lines = entries.map(e => {
  const kw = e.kw.filter(w => w.toLowerCase() !== e.name.toLowerCase()).join('|');
  return `${e.cp}\t${e.name}\t${kw}`;
});

const out = `/* Erzeugt von tools/build-emoji.mjs – nicht von Hand bearbeiten.
   Quelle: CLDR ${new Date().toISOString().slice(0, 10)} (common/annotations/de.xml),
   deutsche Namen und Suchbegriffe von Unicode.
   ${entries.length} Emojis, davon ${entries.filter(e => e.pref).length} als alltagsnah bevorzugt. */

/** Zeilenformat: Emoji, Name, Stichwörter – getrennt durch Tabulator bzw. "|".
    Die ersten ${entries.filter(e => e.pref).length} Einträge sind die bevorzugten. */
export const PREFERRED_COUNT = ${entries.filter(e => e.pref).length};

/** Ab diesem Index stehen Länderflaggen – bei der Suche nachrangig. */
export const FLAG_START = ${entries.findIndex(e => e.flag)};

export const RAW = \`${lines.join('\n').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
`;

fs.writeFileSync('js/emoji-data.js', out);
console.log(`js/emoji-data.js: ${entries.length} Emojis, ${(out.length / 1024).toFixed(0)} KB`);
console.log('Stichprobe:', entries.slice(0, 6).map(e => `${e.cp}=${e.name}`).join(', '));
const probe = ['💧', '🦷', '🛒', '🏃', '🪥'];
for (const p of probe) {
  const e = entries.find(x => x.cp.replace(VARIATION, '') === p.replace(VARIATION, ''));
  console.log(`  ${p} -> ${e ? `${e.name} [${e.kw.slice(0, 5).join(', ')}]` : 'FEHLT'}`);
}
