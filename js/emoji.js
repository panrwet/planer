/* Emoji-Datenbank mit deutschen Stichwörtern.
   Bewusst als handgepflegte Liste statt als vollständiger Unicode-Datensatz:
   die App soll ohne Build und ohne Nachladen laufen, und für Habits und
   Aufgaben zählt Treffsicherheit mehr als Vollständigkeit.

   Erster Begriff je Eintrag ist der Hauptname, danach Synonyme. Kleingeschrieben
   und ohne Umlautvarianten – gesucht wird über eine normalisierte Form. */

const DB = [
  // --- Trinken & Essen ---
  ['💧', 'wasser trinken tropfen flüssigkeit hydration'],
  ['🚰', 'wasser trinkwasser hahn leitung'],
  ['🥛', 'milch glas trinken kalzium'],
  ['☕️', 'kaffee koffein espresso tasse heiß'],
  ['🍵', 'tee grüntee tasse matcha'],
  ['🧉', 'mate tee'],
  ['🥤', 'becher limonade trinken softdrink'],
  ['🍺', 'bier alkohol feierabend'],
  ['🍷', 'wein alkohol rotwein'],
  ['🥗', 'salat gesund gemüse essen ernährung'],
  ['🥦', 'brokkoli gemüse gesund'],
  ['🥕', 'karotte möhre gemüse'],
  ['🍎', 'apfel obst frucht gesund'],
  ['🍌', 'banane obst frucht kalium'],
  ['🍓', 'erdbeere obst frucht'],
  ['🫐', 'blaubeere beere obst'],
  ['🥑', 'avocado fett gesund'],
  ['🍳', 'kochen ei frühstück pfanne'],
  ['🥘', 'kochen essen pfanne mahlzeit'],
  ['🍲', 'suppe eintopf kochen essen'],
  ['🥣', 'müsli schüssel frühstück haferflocken porridge'],
  ['🍞', 'brot backen brötchen'],
  ['🧀', 'käse'],
  ['🍕', 'pizza essen'],
  ['🍫', 'schokolade süßigkeit naschen zucker'],
  ['🍬', 'süßigkeit bonbon zucker naschen'],
  ['🚭', 'rauchen nichtrauchen aufhören zigarette nikotin'],
  ['🧂', 'salz gewürz'],
  ['💊', 'tablette vitamine medikament pille nahrungsergänzung supplement'],
  ['🩹', 'pflaster wunde'],
  ['🧴', 'creme lotion sonnencreme pflege hautpflege'],

  // --- Sport & Bewegung ---
  ['🏃', 'laufen joggen rennen sport cardio lauf'],
  ['🚶', 'gehen spazieren schritte spaziergang'],
  ['🥾', 'wandern wanderung berg'],
  ['🚴', 'radfahren fahrrad rad velo bike'],
  ['🏊', 'schwimmen schwimmbad bahnen'],
  ['🏋️', 'krafttraining gewichte hantel fitness gym stemmen'],
  ['💪', 'muskeln kraft training stark fitness'],
  ['🤸', 'turnen gymnastik dehnen beweglichkeit'],
  ['🧘', 'yoga meditation meditieren entspannen achtsamkeit atmen ruhe'],
  ['🤾', 'handball ballsport'],
  ['⚽️', 'fußball ball sport kicken'],
  ['🏀', 'basketball ball korb'],
  ['🎾', 'tennis ball schläger'],
  ['🏓', 'tischtennis pingpong'],
  ['🏸', 'badminton federball'],
  ['🥊', 'boxen kampfsport handschuh'],
  ['🥋', 'judo karate kampfsport'],
  ['⛰️', 'berg klettern wandern gipfel'],
  ['🧗', 'klettern bouldern kletterhalle'],
  ['⛷️', 'ski skifahren winter'],
  ['🏂', 'snowboard winter'],
  ['⛸️', 'eislaufen schlittschuh'],
  ['🛹', 'skateboard'],
  ['🤺', 'fechten'],
  ['🚣', 'rudern boot'],
  ['🧎', 'knien dehnen stretching'],
  ['👟', 'schuhe sport laufschuhe turnschuh'],
  ['⚖️', 'wiegen gewicht waage abnehmen'],
  ['🩺', 'gesundheit arzt untersuchung blutdruck'],

  // --- Lernen & Arbeit ---
  ['📖', 'lesen buch lektüre seiten schmökern'],
  ['📚', 'bücher lernen studieren bibliothek studium'],
  ['✍️', 'schreiben notieren tagebuch journal aufschreiben'],
  ['📝', 'notiz schreiben aufgabe zettel eintragen'],
  ['🗒️', 'notizen block liste'],
  ['📓', 'notizbuch tagebuch heft'],
  ['🧠', 'gehirn denken lernen konzentration gedächtnis kopf'],
  ['🎓', 'studium abschluss lernen uni schule prüfung'],
  ['🔬', 'forschung labor wissenschaft'],
  ['🧮', 'rechnen mathe zahlen'],
  ['🗣️', 'sprechen sprache reden vokabeln aussprache'],
  ['🌍', 'sprache welt reisen erde global'],
  ['💻', 'computer arbeiten programmieren laptop coden büro'],
  ['⌨️', 'tippen tastatur schreiben'],
  ['🖥️', 'bildschirm computer arbeitsplatz'],
  ['📱', 'handy smartphone bildschirmzeit telefon'],
  ['📵', 'handy handyfrei offline bildschirmzeit digital detox'],
  ['💼', 'arbeit büro job beruf aktentasche'],
  ['📅', 'kalender termin planen woche datum'],
  ['⏰', 'wecker aufstehen früh uhrzeit alarm'],
  ['⏱️', 'stoppuhr zeit messen timer'],
  ['📈', 'wachstum fortschritt statistik steigen erfolg'],
  ['📊', 'statistik auswertung diagramm zahlen'],
  ['💰', 'geld sparen finanzen budget'],
  ['💳', 'karte bezahlen rechnung zahlung'],
  ['🧾', 'rechnung belege buchhaltung steuer quittung'],
  ['📧', 'email mail posteingang schreiben nachricht'],
  ['✉️', 'brief post schreiben mail'],
  ['📞', 'telefon anrufen anruf hörer'],
  ['📦', 'paket versand päckchen liefern'],
  ['🖊️', 'stift schreiben unterschreiben'],
  ['📌', 'pinnen wichtig merken notiz'],
  ['🔑', 'schlüssel zugang wichtig'],
  ['🗂️', 'ordner ablage sortieren dokumente'],
  ['📁', 'ordner datei ablage'],

  // --- Haushalt & Alltag ---
  ['🧹', 'putzen aufräumen kehren saubermachen haushalt'],
  ['🧽', 'putzen schwamm spülen reinigen'],
  ['🧼', 'seife waschen händewaschen hygiene'],
  ['🪣', 'eimer putzen wischen'],
  ['🧺', 'wäsche waschen wäschekorb'],
  ['👕', 'wäsche kleidung shirt anziehen'],
  ['🛏️', 'bett schlafen bettmachen'],
  ['🚿', 'duschen dusche waschen'],
  ['🛁', 'baden badewanne entspannen'],
  ['🦷', 'zähne zähneputzen zahnarzt zahnseide'],
  ['🪥', 'zahnbürste zähneputzen zähne'],
  ['🚽', 'toilette bad wc'],
  ['🍽️', 'geschirr abwasch spülen essen teller'],
  ['🛒', 'einkaufen einkauf supermarkt besorgen wagen'],
  ['🧻', 'papier haushalt toilettenpapier'],
  ['🗑️', 'müll wegwerfen abfall entsorgen'],
  ['♻️', 'recycling müll trennen umwelt'],
  ['🔧', 'reparieren werkzeug schrauben basteln'],
  ['🔨', 'hammer reparieren handwerk bauen'],
  ['🪛', 'schraubendreher reparieren montieren'],
  ['🧰', 'werkzeug reparieren kasten'],
  ['🪴', 'pflanze gießen blume topfpflanze'],
  ['🌱', 'pflanze wachsen setzling garten neu'],
  ['🌿', 'kraut pflanze grün natur'],
  ['🌻', 'blume sonnenblume garten'],
  ['🚗', 'auto fahren tanken werkstatt wagen'],
  ['⛽️', 'tanken benzin auto'],
  ['🏠', 'haus zuhause wohnung heim'],
  ['🐕', 'hund gassi tier haustier spaziergang'],
  ['🐈', 'katze tier haustier'],
  ['🐾', 'tier haustier pfote füttern'],

  // --- Schlaf, Stimmung, Gesundheit ---
  ['😴', 'schlafen schlaf müde bett früh ins bett'],
  ['🌙', 'nacht abend schlafen mond'],
  ['☀️', 'sonne morgen tag aufstehen licht'],
  ['🌅', 'sonnenaufgang morgen früh aufstehen'],
  ['🌄', 'morgen sonnenaufgang berge'],
  ['🛌', 'schlafen bett ausruhen'],
  ['😊', 'freude lächeln stimmung gut dankbar'],
  ['🙏', 'dankbarkeit danke beten hoffen'],
  ['❤️', 'liebe herz gesundheit wichtig'],
  ['🫀', 'herz puls gesundheit kreislauf'],
  ['🧊', 'kalt eis kaltduschen eisbad'],
  ['🌬️', 'atmen atemübung luft frisch lüften'],
  ['🪟', 'lüften fenster frische luft'],
  ['🎯', 'ziel fokus treffen vorsatz'],
  ['✅', 'erledigt haken fertig abhaken'],
  ['⭐️', 'stern wichtig favorit standard'],
  ['🔥', 'streak feuer serie motivation'],
  ['🏆', 'pokal erfolg gewinnen ziel erreicht'],
  ['🎉', 'feiern party erfolg glückwunsch'],
  ['🧿', 'schutz glück'],

  // --- Hobby & Freizeit ---
  ['🎸', 'gitarre musik üben instrument'],
  ['🎹', 'klavier piano musik üben instrument'],
  ['🎻', 'geige violine musik instrument'],
  ['🥁', 'schlagzeug trommel musik'],
  ['🎤', 'singen gesang mikrofon musik'],
  ['🎧', 'musik hören kopfhörer podcast hörbuch'],
  ['🎵', 'musik lied ton'],
  ['🎨', 'malen kunst zeichnen kreativ'],
  ['🖌️', 'malen pinsel kunst'],
  ['✂️', 'basteln schneiden schere'],
  ['🧶', 'stricken wolle häkeln handarbeit'],
  ['🧵', 'nähen faden handarbeit'],
  ['📷', 'fotografieren foto kamera bilder'],
  ['🎬', 'film kino video drehen'],
  ['📺', 'fernsehen serie tv bildschirmzeit'],
  ['🎮', 'spielen gaming videospiel konsole'],
  ['🎲', 'spiel würfel brettspiel'],
  ['♟️', 'schach spiel strategie'],
  ['🧩', 'puzzle rätsel knobeln'],
  ['🃏', 'karten spiel'],
  ['✈️', 'reisen flug urlaub fliegen'],
  ['🧳', 'koffer reise packen urlaub'],
  ['🏖️', 'strand urlaub meer entspannen'],
  ['🗺️', 'karte reisen planen route'],
  ['🎁', 'geschenk besorgen geburtstag präsent'],
  ['🎂', 'geburtstag kuchen torte feiern'],
  ['🕯️', 'kerze ruhe entspannen'],
  ['🛠️', 'projekt basteln werkeln'],
  ['🌊', 'meer wellen wasser surfen'],
  ['🏕️', 'camping zelt natur'],
  ['🚂', 'zug bahn fahren reisen'],
  ['🚌', 'bus fahren öffentlich'],
  ['🛵', 'roller fahren motor'],

  // --- Menschen & Soziales ---
  ['👨‍👩‍👧', 'familie kinder eltern'],
  ['👶', 'baby kind'],
  ['🧑‍🤝‍🧑', 'freunde treffen soziales menschen'],
  ['💬', 'gespräch reden chat nachricht kontakt'],
  ['🤝', 'treffen verabreden handschlag zusammen'],
  ['🎙️', 'podcast aufnehmen sprechen'],
  ['👥', 'gruppe team menschen'],
  ['🫂', 'umarmung nähe zusammen'],
];

/** Sucht ohne Rücksicht auf Umlaute, Groß-/Kleinschreibung und Endungen. */
function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Vorberechnet, damit die Suche bei jedem Tastendruck billig bleibt. */
const ENTRIES = DB.map(([emoji, words]) => {
  const norm = normalize(words);
  return { emoji, words: norm, tokens: norm.split(' ') };
});

export const ALL_EMOJI = ENTRIES.map(e => e.emoji);

/**
 * Emojis, die zum eingegebenen Text passen.
 * Bewertet wird pro Wort des Textes: genauer Treffer > Wortanfang >
 * irgendwo enthalten. Der Rang im ersten Stichwort zählt zusätzlich, damit
 * „wasser" eher 💧 als 🚰 liefert.
 */
export function searchEmoji(text, limit = 24) {
  const query = normalize(text);
  if (!query) return [];
  const parts = query.split(' ').filter(w => w.length >= 2);
  if (!parts.length) return [];

  const scored = [];
  for (const entry of ENTRIES) {
    let score = 0;
    for (const part of parts) {
      let best = 0;
      for (let i = 0; i < entry.tokens.length; i++) {
        const token = entry.tokens[i];
        if (token === part) best = Math.max(best, 100 - i);
        else if (token.startsWith(part)) best = Math.max(best, 70 - i);
        else if (part.length >= 5 && token.includes(part)) best = Math.max(best, 45 - i);
        // Auch der umgekehrte Fall: getippt „laufband", Stichwort „laufen"
        else if (part.length >= 5 && part.startsWith(token) && token.length >= 4) best = Math.max(best, 40 - i);
      }
      score += best;
    }
    if (score > 0) scored.push({ emoji: entry.emoji, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.emoji);
}

/** Startvorschläge, wenn noch nichts eingetippt wurde. */
export const STARTER_EMOJI = [
  '⭐️', '💧', '🏃', '📖', '🧘', '💪', '😴', '🥗', '💊', '🎯',
  '🧹', '✍️', '📚', '🎸', '☀️', '🚴', '🧠', '🦷', '💻', '🪴',
];
