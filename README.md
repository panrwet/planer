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
  morgen und diese Woche – innerhalb eines Korbs nach Datum sortiert, bei
  „Überfällig" also das Älteste zuerst. Jede Zeile öffnet die betroffenen
  Aufgaben, direkt abhakbar. Die Fußzeile nennt Aufgaben ohne Datum, spätere und die Listenzahl
- Laufende Serien der längsten drei Habits
- Kacheln für Suche und Einstellungen

Alle Zahlen kommen aus `store.overview()`. „Fällig" heißt dort, dass ein Habit
heute grundsätzlich ansteht – nicht, dass es noch in der Liste steht. Sonst
schrumpfte der Nenner, sobald ein Wochenziel erfüllt ist, und aus „1 von 3"
würde „0 von 2".

**Suche**
- Ein Feld über alles: Habits, Aufgaben samt Notizen, Listen und Einstellungen
- **Verträgt Tippfehler**: „Vitmine" findet „Vitamine", „Krafttraning" findet
  „Krafttraining". Gerechnet wird der Editierabstand bis zum besten
  Wortanfang – ohne das fände „Vitmin" nichts, weil die fehlenden Buchstaben
  am Ende sonst mitzählen. Ab vier Buchstaben ist ein Fehler erlaubt, ab
  sieben zwei; kürzere Wörter müssen wörtlich passen, sonst passt alles auf
  alles
- Wörtliche Treffer stehen immer vor geratenen
- Treffer nach Bereich gruppiert, die getroffene Stelle hervorgehoben – auch
  wenn sie nur ähnlich geschrieben war. Wo die Stelle liegt, sagt
  `store.matchSpan()`, damit die Regeln zum Falten der Umlaute nur einmal
  existieren
- Ein neuer Bereich braucht nur einen Block in `store.search()`

**Kalender**
- Vierter Reiter rechts neben der Startseite, Monatsraster im Stil des Apple
  Kalenders: Wochentage oben, heute im gefüllten Kreis, ein Punkt unter jedem
  Tag, an dem etwas geplant ist. Tage aus Vor- und Folgemonat füllen das Raster
  auf, damit es lückenlos von Montag zu Sonntag läuft
- Ein Tipp auf einen Tag öffnet den **Tagesplan**: Stundenraster von 0 bis 24
  Uhr, Einträge als Blöcke in ihrer Farbe, Höhe nach Dauer, Überlappungen
  nebeneinander, am heutigen Tag eine Linie für die aktuelle Uhrzeit. Der Plan
  springt beim Öffnen zur ersten Uhrzeit, sonst zur laufenden Stunde
- Im Plan wird direkt abgehakt – mit demselben Knopf und derselben Wirkung wie
  in den Listen: Tippen zählt hoch, Gedrückthalten zählt zurück
- **Einplanen** über das + oben rechts: dieselben zwei Bereiche wie die App,
  Habits und Aufgaben, mit derselben tippfehlertoleranten Suche. Vorhandenes
  auswählen oder gleich neu anlegen – dafür öffnet derselbe Editor wie im
  jeweiligen Reiter, und danach geht es direkt ins Einplanen
- Ein Eintrag hat Uhrzeit, Dauer und die Möglichkeit, **dauerhaft** zu gelten:
  ein Habit steht dann an jedem Tag im Plan, an dem es ohnehin dran ist (sein
  Rhythmus), eine Aufgabe täglich, bis sie abgehakt ist. Einzelne Tage lassen
  sich aus einer Reihe nehmen, ohne sie ganz zu löschen
- Von allein erscheint nichts. Ein Eintrag entsteht nur durch Auswahl

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
- **Einplanen ändert die Fälligkeit nicht.** „Fällig Freitag, eingeplant
  Dienstag 14 Uhr" ist der Normalfall: Wann du etwas tust, ist nicht, wann es
  fertig sein muss. Steht eine eingeplante Aufgabe im Plan, deren Fälligkeit
  schon vorbei ist, sagt der Block es in Warnfarbe
- Überfälliges ist an drei Stellen sichtbar: „3 Tage überfällig" in der Zeile,
  ein Zähler in der Kopfzeile und ein roter Zähler am Listen-Reiter. Die
  Sortierung bleibt davon unberührt
- Unteraufgaben auf drei Wegen, vom schnellsten zum ausdrücklichsten:
  1. **Wischen** – Zeile nach rechts wischen. Kurz wischen legt einen Knopf
     frei (*Einrücken* bzw. *Ausrücken*), weit wischen löst sofort aus. Steht
     ein Knopf offen, schließt der nächste Tipp irgendwo anders nur ihn und
     löst sonst nichts aus
  2. **Ziehen** – gedrückt halten, verschieben; nach rechts einrücken
  3. **Im Editor** – „Unteraufgabe hinzufügen": anlegen, abhaken, entfernen.
     Beim Neuanlegen werden sie gesammelt und nach dem Sichern mit angelegt
- Eine Aufgabe abhaken hakt ihre Unteraufgaben mit ab; sind alle Unteraufgaben
  erledigt, gilt auch die Überaufgabe als erledigt
- Beim Abhaken leuchtet die Zeile kurz in ihrer Farbe auf – in der Liste, auf
  der Startseite und in der Habit-Detailansicht gleichermaßen. Ein Habit
  leuchtet erst, wenn das Ziel erreicht ist, nicht bei jedem Zwischenschritt

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

**Bedienbarkeit**
- Der Abhak-Knopf ist je nach Zeilenhöhe 28–40 px groß; eine unsichtbare
  Trefferfläche bringt ihn auf Apples Richtwert von 44 pt, ohne den Kreis
  aufzublasen. `test/browser.mjs` prüft das über `elementFromPoint`, also an
  dem, was wirklich getroffen wird – nicht an der gemessenen Knopfgröße
- Farben erfüllen in beiden Designs mindestens 4,5:1 auch für den ruhigen
  Tertiärtext; die Farbe ist nie das einzige Merkmal, Emoji und Name stehen
  immer daneben
- „Bewegung reduzieren" schaltet Animationen ab, das Aufleuchten bleibt: Es ist
  ein reiner Farbwechsel und die einzige sichtbare Rückmeldung beim Abhaken

**Zuletzt gelöscht**
- Löschen ist umkehrbar: Habits, Listen und Aufgaben wandern in einen
  Papierkorb und bleiben dort 30 Tage, dann räumt die App von selbst auf
- Ein Eintrag hält alles beisammen, was zum Wiederherstellen nötig ist – bei
  einer Liste ihre Aufgaben samt Verschachtelung, bei einem Habit sein
  gesamter Verlauf
- Zwischenzeitlich kann sich die Welt verändert haben. Fehlt die ursprüngliche
  Liste, landet die Aufgabe in der ersten vorhandenen; gibt es gar keine mehr,
  wird „Wiederhergestellt" angelegt; ist eine Kennung inzwischen vergeben,
  bekommt der Eintrag eine neue. Die Meldung sagt jedes Mal, was angepasst
  wurde, statt still etwas anderes zu tun
- Erreichbar über **Einstellungen → Zuletzt gelöscht**, mit Zähler

**Einstellungen**
- Standarddauer beim Einplanen, getrennt für Habits und Aufgaben (Vorgabe
  30 Minuten, je Eintrag änderbar)
- Abgehakte Habits ausblenden oder ausgrauen
- Erledigte Aufgaben ausblenden oder anzeigen
- Zeilenhöhe klein / mittel / groß
- **Farbstärke** aus / dezent / normal / kräftig – wie kräftig die eigene Farbe
  ihr Objekt tönt und rahmt. Bei „Aus" bleiben die Zeilen neutral und Emoji,
  Name und Fortschrittsring tragen die Farbe; das beruhigt eine lange, bunte
  Liste. Die Stufen stehen als `--tint-bg`, `--tint-edge`, `--tint-chip` und
  `--tint-bar` an einer Stelle im Stylesheet
- Design hell / dunkel / System
- Tageswechsel wahlweise erst um 3 Uhr nachts
- Zuletzt gelöscht, Sichern, Wiederherstellen, alles löschen

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
js/swipe.js             Wischen nach rechts zum Ein- und Ausrücken
js/home.js              Startseite mit dem Überblick
js/calendar.js          Monatsraster, Tagesplan, Einplanen
js/search.js            Freie Suche über alle Bereiche
js/emoji.js             Emoji-Suche mit deutschem Wortstamm-Abgleich
js/emoji-data.js        erzeugt – 1949 Emojis mit deutschen Namen
tools/build-emoji.mjs   erzeugt emoji-data.js aus den CLDR-Daten
js/settings.js          Einstellungen, Papierkorb, Sicherung
js/app.js               Router und Verdrahtung
test/store.test.mjs     Tests der Rechenlogik
test/emoji.test.mjs     Tests der Emoji-Suche
test/browser.mjs        Bedienung im iPhone-Format, auch mit echten Berührungen
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
- `toSchema5` – nichts umzubauen: Der Papierkorb kommt als leeres Feld dazu.
  Die Stufe existiert trotzdem, damit ein älterer Stand einmal durch die
  Bereinigung läuft und danach die neue Nummer trägt.
- `toSchema6` – ebenso für die Planung (`plans`). Bestehende Habits und
  Aufgaben bleiben unangetastet; geplant ist zunächst nichts.

Wer eine Migration ergänzt, zählt `SCHEMA` hoch und hängt einen Schritt an. Die
Tests prüfen die ganze Kette von einem Stand ohne Versionsnummer bis heute,
dass keine Werte verloren gehen und dass ein zweiter Start nichts mehr ändert.

Schlägt das Schreiben fehl – Speicher voll, Safari verweigert ihn –, sagt die
App das deutlich und rät zur Sicherung. Vorher lief sie scheinbar normal weiter,
und beim nächsten Start wäre alles seit dem letzten gelungenen Schreiben weg
gewesen. Gemeldet wird nur der Wechsel, nicht jeder Versuch.

Geschrieben wird nur, wenn in dieser Instanz wirklich etwas geändert wurde.
Sonst würde ein zweites offenes Fenster (Safari-Tab neben der App vom
Home-Bildschirm) beim Verlassen seinen alten Stand über die neueren Daten
schreiben. Ändert eine andere Instanz etwas, übernimmt die App den neuen Stand
über das `storage`-Ereignis.

## Planung

Ein Plan-Eintrag legt fest, **wann etwas getan werden soll** – nicht, wann es
fertig sein muss. Er verweist auf ein Habit oder eine Aufgabe und hat Datum,
Uhrzeit, Dauer und ein `repeat`-Kennzeichen:

```
{ id, kind: 'habit'|'todo', refId, date, time, minutes, repeat, skip: [] }
```

Ohne `repeat` gilt er an genau einem Tag. Mit `repeat` beginnt er am Tag des
Eintrags und wiederholt sich – ein Habit an jedem Tag, an dem es nach seinem
eigenen Rhythmus dran ist, eine Aufgabe täglich, bis sie abgehakt ist. Die
Regeln stehen an einer Stelle in `planAppliesOn()`; `planOn(tag)` löst sie auf
und gibt die Einträge samt Ziel, Farbe, Zustand und Fälligkeitshinweis zurück,
damit die Ansicht nichts nachschlagen muss.

`skip` nimmt einzelne Tage aus einer Reihe. Trifft es den ersten Tag, wird
stattdessen der Anfang nach vorn geschoben – sonst würde die Ausnahmeliste bei
täglicher Nutzung immer weiter wachsen.

Löschen greift durch: Ein gelöschtes Habit, eine gelöschte Aufgabe oder Liste
nimmt ihre Plan-Einträge mit in den Papierkorb und bringt sie beim
Wiederherstellen zurück. Muss dabei eine Kennung neu vergeben werden, ziehen
die Einträge mit um (`putPlansBack`) – ohne das zeigten sie ins Leere.

## Die Zeile

Habits und Aufgaben teilen sich denselben Zeilenaufbau, und für beide gilt
dieselbe Regel: **Eine Zeile wird einmal gebaut und danach nur noch
nachgefüllt.** Gebaut wird in `todoRow()` bzw. `habitRow()`, gefüllt in
`fillRow()` bzw. `fillHabitRow()`. Abhaken ruft nur das Füllen auf.

Das hat drei Gründe, und alle drei waren vorher sichtbar kaputt:

1. **Geschwindigkeit.** Früher baute jeder Haken die ganze Liste neu. Bei 300
   Aufgaben dauerte ein Haken bis zum fertigen Bild 195 ms, bei 800 über
   400 ms. Jetzt sind es 34 bzw. 40 ms – praktisch unabhängig davon, wie lang
   die Liste ist. Welche Zeilen überhaupt betroffen sind, sagt `toggleTodo()`
   zurück: die Aufgabe selbst, ihre Unteraufgaben und jede Überaufgabe, die
   dadurch voll oder wieder offen wird.
2. **Der Fortschrittsring.** Ein `transition` läuft nur auf einem Element, das
   schon da war. Solange der Abhak-Knopf ausgetauscht wurde, sprang der Ring
   von 1/3 auf 2/3, obwohl das Stylesheet einen Übergang versprach. `paintCheck()`
   zieht denselben Knopf nach, statt ihn zu ersetzen – jetzt wandert er.
3. **Das Aufleuchten.** Eine ausgetauschte Zeile bricht ihre eigene Animation
   ab. Jetzt leuchtet die angetippte Zeile selbst, und erst wenn das Leuchten
   durch ist, fällt sie zusammen und wandert nach „Erledigt" – vorher lief
   beides gleichzeitig und die Rückmeldung war weg, bevor man sie sah.

Vollständig neu gebaut wird nur, wo es sein muss: beim Listenwechsel, nach dem
Sortieren, und wenn eine abgehakte Zeile wieder geöffnet wird – die muss an der
richtigen Stelle einsortiert werden, und dafür ist ein sauberer Neuaufbau
ehrlicher als ein halbherziges Einfügen.

`test/browser.mjs` prüft genau das: eine markierte Zeile und ihr markierter
Knopf müssen ein Abhaken nebenan unangetastet überstehen, der Ring muss sich
messbar bewegt haben, und die Zeile darf nicht zusammenfallen, solange sie noch
leuchtet. Ohne diese Prüfungen wäre der nächste bequeme `renderTodos()`-Aufruf
im Abhak-Pfad nicht aufgefallen.

## Entwickeln

```bash
python3 -m http.server 8000     # danach http://localhost:8000 öffnen
node test/store.test.mjs        # Rechenlogik: Intervalle, Streaks, Migrationen
node test/emoji.test.mjs        # Emoji-Suche

npm i playwright                # einmalig, nur für die Browser-Prüfungen
node test/browser.mjs           # Bedienung im iPhone-Format
```

`test/browser.mjs` startet einen eigenen Dateiserver und fährt die App im
iPhone-14-Format durch: Startseite, Suche, Editoren, Unteraufgaben, Aufleuchten,
Gesten, Datenerhalt und Layout. Zwei Arten von Eingaben – mit dem Zeiger
(schnell, deckt die Logik ab) und mit **echten Berührungen** über das
Debug-Protokoll. Das zweite ist unverzichtbar: `touch-action` wirkt nur bei
echten Berührungen, und genau dort ist das Sortieren per Ziehen schon einmal
stillschweigend ausgefallen, während alle Zeiger-Prüfungen grün blieben.

Ist ein Chromium schon da, zeigt `CHROME_PATH` darauf; `SHOTS=verzeichnis` legt
unterwegs Bildschirmfotos ab.

Nach Änderungen an den Dateien die Version in `sw.js` (`VERSION`) hochzählen,
damit der Service Worker den alten Stand nicht weiter ausliefert.
