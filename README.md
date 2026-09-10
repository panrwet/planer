# Planer

Habits verfolgen und Todos verwalten – eine kleine App für genau ein iPhone.
Alle Daten bleiben auf dem Gerät.

## Auf dem iPhone installieren

1. In **Safari** die Adresse der App öffnen: `https://panrwet.github.io/planer/`
2. Unten auf **Teilen** tippen (das Quadrat mit dem Pfeil).
3. **Zum Home-Bildschirm** wählen und bestätigen.

Danach liegt „Planer" wie eine normale App auf dem Home-Bildschirm: eigenes
Icon, Vollbild ohne Safari-Leisten, und sie funktioniert auch offline.

> Wichtig: Der Weg über Safari ist Pflicht. Chrome oder Firefox auf dem iPhone
> können nichts zum Home-Bildschirm hinzufügen.

## Wo die Daten liegen

Im `localStorage` von Safari – also ausschließlich auf diesem iPhone. Nichts
wird hochgeladen, es gibt kein Konto und keinen Server. Zwei Folgen daraus:

- Die App funktioniert offline und ohne Anmeldung.
- Löschst du den Website-Speicher von Safari oder die App vom Home-Bildschirm,
  sind die Daten weg.

Deshalb: **Einstellungen → Daten sichern** hin und wieder benutzen. Die
Sicherung ist eine JSON-Datei, die sich über das Teilen-Menü in iCloud Drive
oder Dateien ablegen lässt und über **Daten wiederherstellen** zurückkommt.

## Funktionen

**Startseite**
- Habits heute: erledigt von fällig, Fortschrittsbalken und ein Punkt je Habit.
  Darunter nach Rhythmus aufgeschlüsselt – wie viele Habits es täglich, an
  bestimmten Tagen, pro Woche und pro Monat gibt und wie viele davon in der
  laufenden Periode schon erfüllt sind. Ein Rhythmus, der heute nicht dran ist,
  steht als „frei"; Antippen öffnet die Gruppe im Habits-Reiter
- Aufgaben: zuerst der Bestand (insgesamt, offen, erledigt, überfällig – letztes
  in Warnfarbe), darunter nach Fälligkeit aufgeteilt in überfällig, heute,
  morgen und diese Woche. Jede Zeile öffnet die betroffenen Aufgaben, direkt
  abhakbar. Die Fußzeile nennt Aufgaben ohne Datum, spätere und die Listenzahl
- Laufende Serien der längsten drei Habits
- Kacheln für Suche und Einstellungen

Alle Zahlen kommen aus `store.overview()`. „Fällig" heißt dort, dass ein Habit
heute grundsätzlich ansteht – nicht, dass es noch in der Liste steht. Sonst
schrumpfte der Nenner, sobald ein Wochenziel erfüllt ist, und aus „1 von 3"
würde „0 von 2".

**Suche**
- Ein Feld über alles: Habits, Aufgaben samt Notizen, Listen und Einstellungen
- Treffer nach Bereich gruppiert, Suchbegriff hervorgehoben, Antippen führt zum
  Ziel – bei einer Einstellung wird sie kurz hervorgehoben
- Ein neuer Bereich braucht nur einen Block in `store.search()`

**Habits**
- Nach Häufigkeit gruppiert: *Täglich*, *An bestimmten Tagen*, *Pro Woche*,
  *Pro Monat* und *Erledigt* – jede Gruppe auf- und zuklappbar, der Zustand
  bleibt gemerkt
- Jede Zeile ist in ihrer Farbe gerahmt und getönt, mit Emoji links und dem
  Abhak-Button rechts; ein Tipp auf die Zeile öffnet die Details
- Tippen zählt hoch, gedrückt halten zählt zurück; bei Zielwert 1 ein einfacher Haken
- Ein Ziel, in drei Schritten: **wie oft** (täglich, bestimmte Wochentage, pro
  Woche, pro Monat), **was gezählt wird** (Anzahl, Minuten, Seiten, km, Gläser,
  eigene …) und **wie viele** davon pro Intervall
- Wochen- und Monatsziele summieren die Tageswerte: „60 Seiten pro Woche" geht
  an sieben Tagen verteilt oder an einem Abend
- Über das Ziel hinaus zählen ist möglich – in den Details zählt der Knopf
  weiter, Zurücksetzen ist ein eigener
- Sortieren: Zeile gedrückt halten und verschieben (innerhalb ihrer Gruppe)
- Abgehakte Habits verschwinden (Standard) oder werden ausgegraut
- Details: aktuelle Serie, längste Serie, Erfolgsquote, Kalender über 26 Wochen,
  Balken der letzten 30 Tage; vergangene Tage lassen sich nachtragen

**Todos**
- Der Todos-Reiter führt direkt in die zuletzt geöffnete Liste
- Über der Tab-Leiste steht je Liste ein Reiter mit Emoji, Name und der Zahl
  offener Aufgaben; bei vielen Listen ist die Leiste seitlich scrollbar
- Der Pfeil rechts in der Leiste öffnet ein Drop-up: alle Listen mit ihrem
  Stand, neue Liste anlegen, aktuelle Liste bearbeiten oder löschen, Listen
  sortieren
- Aufgaben mit Name, Farbe, Notiz und optionalem Fälligkeitsdatum. Abhaken
  sitzt rechts
- Überfälliges ist an drei Stellen sichtbar: „3 Tage überfällig" in der Zeile,
  ein Zähler in der Kopfzeile und ein roter Zähler am Listen-Reiter. Die
  Sortierung bleibt davon unberührt
- Unteraufgaben wie in Apple Erinnerungen: Aufgabe gedrückt halten, verschieben,
  nach rechts ziehen rückt sie unter die darüberliegende Aufgabe ein
- Eine Aufgabe abhaken hakt ihre Unteraufgaben mit ab

**Editoren**
- Überall dieselbe Feldreihenfolge: Name, Emoji, Farbe, Fälligkeit, Notiz, wie
  oft, was gezählt wird, wie viele – jeder Editor zeigt nur, was es bei ihm
  gibt. Die Reihenfolge steht als `FIELD_ORDER` an einer Stelle in `js/ui.js`.
  Habits haben alles außer Fälligkeit und Notiz, Aufgaben kein Emoji und keinen
  Zeitplan, Listen nur Name, Emoji und Farbe
- Das Emoji-Kästchen sitzt links neben dem Namensfeld – eine Zeile statt zwei.
  Darunter zwei wischbare Zeilen: Vorschläge zum eingegebenen Namen und die
  zuletzt benutzten
- Farbwähler mit 16 Tönen in zwei Reihen

**Einstellungen**
- Abgehakte Habits ausblenden oder ausgrauen
- Erledigte Aufgaben ausblenden oder anzeigen
- Zeilenhöhe klein / mittel / groß
- Design hell / dunkel / System
- Tageswechsel wahlweise erst um 3 Uhr nachts
- Sichern, Wiederherstellen, alles löschen

## Aufbau

Kein Build-Schritt, keine Abhängigkeiten – reines HTML, CSS und ES-Module.
Die Dateien lassen sich unverändert von GitHub Pages ausliefern.

```
index.html              Gerüst aller Bildschirme
manifest.webmanifest    Name, Icon, Vollbild-Modus
sw.js                   Service Worker für den Offline-Betrieb
css/app.css             Design-Tokens und Layout
js/util.js              Datum, DOM-Helfer
js/store.js             Datenmodell, Speicherung, Streak-Berechnung
js/ui.js                Sheets, Formularfelder, Abhak-Button
js/habits.js            Habits-Liste und Editor
js/habitDetail.js       Statistiken, Kalender, Balken
js/todos.js             Listen, Reiterleiste, Drop-up, Aufgaben
js/drag.js              Umsortieren per Finger, mit und ohne Einrücken
js/home.js              Startseite mit dem Überblick
js/search.js            Freie Suche über alle Bereiche
js/emoji.js             Emoji-Suche mit deutschem Wortstamm-Abgleich
js/emoji-data.js        erzeugt – 1949 Emojis mit deutschen Namen
tools/build-emoji.mjs   erzeugt emoji-data.js aus den CLDR-Daten
js/settings.js          Einstellungen, Sicherung
js/app.js               Router und Verdrahtung
test/store.test.mjs     Tests der Rechenlogik
test/emoji.test.mjs     Tests der Emoji-Suche
```

## Emoji-Bibliothek

`js/emoji-data.js` ist erzeugt und enthält alle 1949 Emojis mit ihren
**offiziellen deutschen Namen und Suchbegriffen** aus den CLDR-Daten von
Unicode. Hautfarben- und Geschlechtsvarianten sind ausgelassen, Länderflaggen
bei der Suche nachrangig.

CLDR beschreibt, was ein Emoji darstellt – nicht, wofür man es verwendet.
„Vitamine" steht bei keinem Emoji, „Krafttraining" auch nicht. Deshalb liegt in
`tools/build-emoji.mjs` eine Alltagsschicht: rund 80 Emojis mit den Wörtern, die
man bei Habits und Aufgaben wirklich eintippt. Dieselbe Liste bestimmt auch,
welche Emojis bei mehreren Treffern vorn stehen und was ohne Eingabe
vorgeschlagen wird.

Neu erzeugen (die beiden Dateien stammen aus dem CLDR-Repo,
`common/annotations/de.xml` und `common/annotationsDerived/de.xml`):

```bash
node tools/build-emoji.mjs de.xml annotationsDerived-de.xml
```

Die Suche gleicht deutsche Wortformen ab: Beugungen über abgeschnittene
Endungen, Partizipien über das Präfix „ge-", Zusammensetzungen über den
Wortanfang. `test/emoji.test.mjs` misst die Trefferquote an 48 typischen
Eingaben und lässt weniger als 80 % an erster Stelle nicht durchgehen.

## Datenformat

Der gespeicherte Stand trägt eine Schema-Nummer (`v`). Beim Laden wird ein
älterer Stand einmalig hochmigriert und das Ergebnis **sofort festgeschrieben** –
sonst läuft die Migration bei jedem Start erneut und vergibt jedes Mal neue
Kennungen. Bisher:

- `toSchema3` – Listen ohne Aufgaben werden Aufgaben der Liste „Free", weil
  Listen als Ordner gedacht sind. Listen mit Inhalt bleiben unangetastet.
- `toSchema4` – ein Ziel pro Intervall statt Tagesziel *und* Tage-pro-Woche.
  „20 Seiten an 3 Tagen pro Woche" wird „60 Seiten pro Woche"; die erfassten
  Tageswerte bleiben unverändert und werden ab dann über das Intervall summiert.

Wer eine Migration ergänzt, zählt `SCHEMA` hoch und hängt einen Schritt an. Die
Tests prüfen die ganze Kette von einem Stand ohne Versionsnummer bis heute,
dass keine Werte verloren gehen und dass ein zweiter Start nichts mehr ändert.

Geschrieben wird nur, wenn in dieser Instanz wirklich etwas geändert wurde.
Sonst würde ein zweites offenes Fenster (Safari-Tab neben der App vom
Home-Bildschirm) beim Verlassen seinen alten Stand über die neueren Daten
schreiben. Ändert eine andere Instanz etwas, übernimmt die App den neuen Stand
über das `storage`-Ereignis.

## Entwickeln

```bash
python3 -m http.server 8000     # danach http://localhost:8000 öffnen
node test/store.test.mjs        # Rechenlogik: Intervalle, Streaks, Migrationen
node test/emoji.test.mjs        # Emoji-Suche
```

Nach Änderungen an den Dateien die Version in `sw.js` (`VERSION`) hochzählen,
damit der Service Worker den alten Stand nicht weiter ausliefert.
