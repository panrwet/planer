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

**Habits**
- Nach Häufigkeit gruppiert: *Täglich*, *An bestimmten Tagen*, *Pro Woche* und
  *Erledigt* – jede Gruppe auf- und zuklappbar, der Zustand bleibt gemerkt
- Jede Zeile ist in ihrer Farbe gerahmt und getönt, mit Emoji links und dem
  Abhak-Button rechts; ein Tipp auf die Zeile öffnet die Details
- Tippen zählt hoch, gedrückt halten zählt zurück; bei Zielwert 1 ein einfacher Haken
- Zielwert und Einheit frei wählbar (Anzahl, Minuten, Seiten, km, Gläser, eigene …)
- Zeitplan: jeden Tag, bestimmte Wochentage, oder x-mal pro Woche
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
- Aufgaben mit Name, Farbe, Notiz und optionalem Fälligkeitsdatum; überfällige
  sind rot markiert. Abhaken sitzt rechts
- Unteraufgaben wie in Apple Erinnerungen: Aufgabe gedrückt halten, verschieben,
  nach rechts ziehen rückt sie unter die darüberliegende Aufgabe ein
- Eine Aufgabe abhaken hakt ihre Unteraufgaben mit ab

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
js/settings.js          Einstellungen, Sicherung
js/app.js               Router und Verdrahtung
test/store.test.mjs     Tests der Rechenlogik
```

## Datenformat

Der gespeicherte Stand trägt eine Schema-Nummer (`v`). Beim Laden wird ein
älterer Stand einmalig hochmigriert – `toSchema3` in `js/store.js` hat zum
Beispiel Listen ohne Aufgaben in Aufgaben der Liste „Free" umgewandelt, weil
Listen als Ordner gedacht sind. Wer eine neue Migration ergänzt, zählt `SCHEMA`
hoch und hängt einen Schritt an; die Tests in `test/store.test.mjs` prüfen
insbesondere, dass eine Migration nicht zweimal läuft.

Geschrieben wird nur, wenn in dieser Instanz wirklich etwas geändert wurde.
Sonst würde ein zweites offenes Fenster (Safari-Tab neben der App vom
Home-Bildschirm) beim Verlassen seinen alten Stand über die neueren Daten
schreiben. Ändert eine andere Instanz etwas, übernimmt die App den neuen Stand
über das `storage`-Ereignis.

## Entwickeln

```bash
python3 -m http.server 8000     # danach http://localhost:8000 öffnen
node test/store.test.mjs        # Tests der Streak- und Todo-Logik
```

Nach Änderungen an den Dateien die Version in `sw.js` (`VERSION`) hochzählen,
damit der Service Worker den alten Stand nicht weiter ausliefert.
