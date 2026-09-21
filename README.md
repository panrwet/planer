# Planer

Habits verfolgen und To-dos verwalten – eine kleine App für genau ein iPhone.
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

Die Startseite wird selbst zusammengestellt. Oben ein Raster aus Widgets, unten
drei Zeilen, die nie verschwinden: **Suchen**, **Einstellungen** und
**Startseite bearbeiten**. Die drei liegen außerhalb des Rasters – beim
Umsortieren können sie deshalb nicht mitwandern und nicht verloren gehen.

*Drei Größen*, angelehnt an das, was auf ein Telefon passt:

| Größe | Raster | wofür |
|---|---|---|
| Klein | eine Spalte, quadratisch | eine Zahl, ein Ring |
| Breit | zwei Spalten, flach | eine Zahl mit Zusatz, wenige Zeilen |
| Groß | zwei Spalten, hoch | mehrere Zeilen mit Abhak-Knopf |

*16 Widgets* über alle Bereiche:

- **Habits** – Habits heute (Ring, Punkte oder die fälligen Habits zum
  Abhaken), Habits nach Rhythmus, Laufende Serien, Ein Habit (ein bestimmtes,
  mit Fortschritt und Serie), Habit-Verlauf (die letzten Wochen als Raster)
- **To-dos** – Überfällig, Heute fällig, To-do-Bestand, Eine Liste,
  Als Nächstes fällig
- **Planung** – Plan heute, Als Nächstes im Plan, Verplante Zeit
- **Kalender** – Monat im Kleinen (mit rotem Kreis um heute), Die nächsten
  sieben Tage
- **Allgemein** – Schnell anlegen (Habit, To-do, Plan-Eintrag), Heute geschafft

*Bedienung* – Antippen springt in den Bereich, zu dem das Widget gehört; wo es
einzelne Zeilen zeigt, steht rechts der gewohnte Abhak-Knopf mit demselben
Aufleuchten wie in den Listen. Abgehakt wird dabei nur die Zeile aufgefrischt,
nicht das ganze Widget – sonst wäre das Aufleuchten mitten im Lauf
abgeschnitten.

*Bearbeiten* – **Startseite bearbeiten** lässt die Widgets leicht wackeln. Ein
Widget **gedrückt halten und ziehen** verschiebt es, wie beim Sortieren von
Habits und To-dos. ✕ entfernt es, der Knopf rechts unten wechselt durch die
Größen, die der Typ kann. Gearbeitet wird auf einer Kopie: Erst **Speichern**
übernimmt die Anordnung, **Abbrechen** wirft sie weg. Wer in einen anderen
Reiter wechselt, wird vorher gefragt – ohne die drei festen Zeilen käme man
sonst nicht mehr in die Einstellungen.

*Profile* – Über **Profil** in der Bearbeiten-Leiste: wechseln, neu anlegen,
kopieren, umbenennen, löschen (bis zu acht; das letzte bleibt). Umgeschaltet
wird nur im Bearbeiten-Modus, damit die Startseite selbst ruhig bleibt.

Alle Zahlen kommen aus `store.overview()`. „Fällig" heißt dort, dass ein Habit
heute grundsätzlich ansteht – nicht, dass es noch in der Liste steht. Sonst
schrumpfte der Nenner, sobald ein Wochenziel erfüllt ist, und aus „1 von 3"
würde „0 von 2".

**Suche**
- Ein Feld über alles: Habits, To-dos samt Notizen, Listen und Einstellungen
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
  Kalenders: Wochentage oben, ein Punkt unter jedem Tag, an dem etwas geplant
  ist. Tage aus Vor- und Folgemonat füllen das Raster auf, damit es lückenlos
  von Montag zu Sonntag läuft
- Drei Zustände, die sich nicht in die Quere kommen: **heute** trägt einen
  roten Ring, der **ausgewählte** Tag den gefüllten Kreis im Akzent, und ist
  beides derselbe Tag, gewinnt der gefüllte Kreis in Rot – sonst wäre nicht zu
  sehen, wo man steht
- Unter dem Raster steht der **ausgewählte Tag** mit Namen und allem Geplanten
  untereinander: Uhrzeit, Farbbalken, Name. Erledigtes ist durchgestrichen,
  Dauerhaftes mit ↻ markiert. Der erste Tipp auf einen Tag wählt ihn hier aus,
  ohne den Kalender zu verlassen; der zweite – oder ein Tipp auf die Ansicht –
  öffnet den Tagesplan. Geändert wird hier nichts, es ist eine Vorschau
- Monat und ausgewählter Tag sind **ein** Zustand: Beim Monatswechsel wandert
  der Tag mit (gleicher Tag im neuen Monat, bei kürzeren Monaten der letzte),
  und der Tagesplan zeigt immer den Tag, der im Raster hervorgehoben ist. Zwei
  getrennte Zustände würden ein September-Raster mit einem Oktober-Tag darunter
  zeigen
- Der **Tagesplan**: Stundenraster von 0 bis 24
  Uhr, Einträge als Blöcke in ihrer Farbe, Höhe nach Dauer, Überlappungen
  nebeneinander, am heutigen Tag eine Linie für die aktuelle Uhrzeit. Der Plan
  springt beim Öffnen zur ersten Uhrzeit, sonst zur laufenden Stunde
- Darüber ein **Wochenstreifen** wie in der Tagesansicht des Apple Kalenders:
  sieben Tage mit Kürzel und Datum, der offene im gefüllten Kreis, heute in der
  Akzentfarbe, ein Punkt an Tagen mit Planung. Antippen wechselt den Tag,
  Wischen blättert eine Woche – der Wochentag bleibt dabei stehen
- **Gesten** wie beim Sortieren in den Listen: einen Block gedrückt halten und
  ziehen verschiebt ihn auf eine andere Uhrzeit, mit einer großen Zeitanzeige
  über dem Plan und Mitscrollen am Rand. Gedrückt halten auf freier Fläche
  legt direkt zu dieser Uhrzeit etwas an; ein gestrichelter Platzhalter zeigt
  vorher, welche Uhrzeit es wird. Gerastert wird in Viertelstunden – bei 80 px
  je Stunde sind fünf Minuten knapp 7 px und mit dem Finger nicht zu treffen
- Im Plan wird direkt abgehakt – mit demselben Knopf und derselben Wirkung wie
  in den Listen: Tippen zählt hoch, Gedrückthalten zählt zurück
- **Einplanen** über das + oben rechts: dieselben zwei Bereiche wie die App,
  Habits und To-dos, mit derselben tippfehlertoleranten Suche. Im Bereich
  To-dos steht dieselbe Listenleiste wie im To-dos-Modul, inklusive All –
  gesucht wird hier also nicht anders als dort. Vorhandenes auswählen oder
  gleich neu anlegen – dafür öffnet derselbe Editor wie im jeweiligen Reiter,
  und danach geht es direkt ins Einplanen
- Ein Eintrag hat Uhrzeit, Dauer und die Möglichkeit, **dauerhaft** zu gelten:
  ein Habit steht dann an jedem Tag im Plan, an dem es ohnehin dran ist (sein
  Rhythmus), ein To-do täglich, bis es abgehakt ist. Einzelne Tage lassen
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

**To-dos**
- Ganz links in der Listenleiste steht **All** – alle To-dos über alle Listen
  hinweg, jede Zeile in der Farbe ihrer Liste und mit deren Namen in der
  Meta-Zeile. Sortieren und Einrücken sind dort abgeschaltet: `order` gilt je
  Liste, und eine Über-To-do muss in derselben Liste liegen; über Listengrenzen
  gezogen wäre nicht bloß unklar, sondern falsch. Ein neues To-do aus All
  landet in der ersten Liste, und der Hinweis sagt, in welcher
- Der To-dos-Reiter führt direkt in die zuletzt geöffnete Liste
- Über der Tab-Leiste steht je Liste ein Reiter mit Emoji, Name und der Zahl
  offener To-dos; bei vielen Listen ist die Leiste seitlich scrollbar
- Der Pfeil rechts in der Leiste öffnet ein Drop-up: alle Listen mit ihrem
  Stand, neue Liste anlegen, aktuelle Liste bearbeiten oder löschen, Listen
  sortieren
- To-dos mit Name, Farbe, Notiz und optionalem Fälligkeitsdatum. Abhaken
  sitzt rechts
- **Einplanen ändert die Fälligkeit nicht.** „Fällig Freitag, eingeplant
  Dienstag 14 Uhr" ist der Normalfall: Wann du etwas tust, ist nicht, wann es
  fertig sein muss. Steht ein eingeplantes To-do im Plan, dessen Fälligkeit
  schon vorbei ist, sagt der Block es in Warnfarbe
- Überfälliges ist an drei Stellen sichtbar: „3 Tage überfällig" in der Zeile,
  ein Zähler in der Kopfzeile und ein roter Zähler am Listen-Reiter. Die
  Sortierung bleibt davon unberührt
- Unter-To-dos auf drei Wegen, vom schnellsten zum ausdrücklichsten:
  1. **Wischen** – Zeile nach rechts wischen. Kurz wischen legt einen Knopf
     frei (*Einrücken* bzw. *Ausrücken*), weit wischen löst sofort aus. Steht
     ein Knopf offen, schließt der nächste Tipp irgendwo anders nur ihn und
     löst sonst nichts aus
  2. **Ziehen** – gedrückt halten, verschieben; nach rechts einrücken
  3. **Im Editor** – „Unter-To-do hinzufügen": anlegen, abhaken, entfernen.
     Beim Neuanlegen werden sie gesammelt und nach dem Sichern mit angelegt
- Ein To-do abhaken hakt ihre Unter-To-dos mit ab; sind alle Unter-To-dos
  erledigt, gilt auch die ÜberTo-do als erledigt
- Beim Abhaken leuchtet die Zeile kurz in ihrer Farbe auf – in der Liste, auf
  der Startseite und in der Habit-Detailansicht gleichermaßen. Ein Habit
  leuchtet erst, wenn das Ziel erreicht ist, nicht bei jedem Zwischenschritt

**Editoren**
- Überall dieselbe Feldreihenfolge: Name, Emoji, Farbe, Fälligkeit, Notiz, wie
  oft, was gezählt wird, wie viele – jeder Editor zeigt nur, was es bei ihm
  gibt. Die Reihenfolge steht als `FIELD_ORDER` an einer Stelle in `js/ui.js`.
  Habits haben alles außer Fälligkeit und Notiz, To-dos kein Emoji und keinen
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
- Löschen ist umkehrbar: Habits, Listen und To-dos wandern in einen
  Papierkorb und bleiben dort 30 Tage, dann räumt die App von selbst auf
- Ein Eintrag hält alles beisammen, was zum Wiederherstellen nötig ist – bei
  einer Liste ihre To-dos samt Verschachtelung, bei einem Habit sein
  gesamter Verlauf
- Zwischenzeitlich kann sich die Welt verändert haben. Fehlt die ursprüngliche
  Liste, landet das To-do in der ersten vorhandenen; gibt es gar keine mehr,
  wird „Wiederhergestellt" angelegt; ist eine Kennung inzwischen vergeben,
  bekommt der Eintrag eine neue. Die Meldung sagt jedes Mal, was angepasst
  wurde, statt still etwas anderes zu tun
- Erreichbar über **Einstellungen → Zuletzt gelöscht**, mit Zähler

**Einstellungen**
- Standarddauer beim Einplanen, getrennt für Habits und To-dos (Vorgabe
  30 Minuten, je Eintrag änderbar)
- Abgehakte Habits ausblenden oder ausgrauen
- Erledigte To-dos ausblenden oder anzeigen
- Zeilenhöhe klein / mittel / groß
- **Farbstärke** aus / dezent / normal / kräftig – wie kräftig die eigene Farbe
  ihr Objekt tönt und rahmt. Bei „Aus" bleiben die Zeilen neutral und Emoji,
  Name und Fortschrittsring tragen die Farbe; das beruhigt eine lange, bunte
  Liste. Die Stufen stehen als `--tint-bg`, `--tint-edge`, `--tint-chip` und
  `--tint-bar` an einer Stelle im Stylesheet
- Design hell / dunkel / System
- Tageswechsel wahlweise erst um 3 Uhr nachts
- Zuletzt gelöscht, Sichern, Wiederherstellen, alles löschen

## Benennung

Das Ding heißt **To-do**, überall und in jeder Form: „To-do", „To-dos",
„Unter-To-do", „Neues To-do". Nicht „Aufgabe", nicht „Todo", nicht „Task".
Im Deutschen ist es Neutrum – *das* To-do, *ein* To-do, *dieses* To-do.

Das gilt für alles Sichtbare. Bezeichner im Code bleiben, wie sie sind
(`renderTodos`, `#todo-list`, `kind: 'todo'`) – sie werden nicht gelesen,
und sie umzubenennen hätte nur Risiko ohne Nutzen gebracht.

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
js/todos.js             Listen, Reiterleiste, Drop-up, To-dos
js/drag.js              Umsortieren per Finger, mit und ohne Einrücken
js/swipe.js             Wischen nach rechts zum Ein- und Ausrücken
js/home.js              Startseite: Raster, Bearbeiten-Modus, Profile
js/widgets.js           Katalog aller Widget-Typen
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
man bei Habits und To-dos wirklich eintippt. Dieselbe Liste bestimmt auch,
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

- `toSchema3` – Listen ohne To-dos werden To-dos der Liste „Free", weil
  Listen als Ordner gedacht sind. Listen mit Inhalt bleiben unangetastet.
- `toSchema4` – ein Ziel pro Intervall statt Tagesziel *und* Tage-pro-Woche.
  „20 Seiten an 3 Tagen pro Woche" wird „60 Seiten pro Woche"; die erfassten
  Tageswerte bleiben unverändert und werden ab dann über das Intervall summiert.
- Schema 5, 6 und 7 bauen nichts um – sie bringen nur neue Felder: den
  Papierkorb (`trash`), die Planung (`plans`) und die Startseiten-Profile
  (`homeProfiles`). Eine eigene Umbaufunktion brauchen sie nicht; die
  Bereinigung beim Laden ergänzt und prüft die Felder ohnehin. Die Nummern
  existieren trotzdem, damit ein älterer Stand einmal durch die Bereinigung
  läuft und danach die neue trägt. Bestehende Habits und To-dos bleiben
  unangetastet; ein Stand ohne Profil bekommt das vorgegebene, denn ein Profil
  gibt es immer.

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
fertig sein muss. Er verweist auf ein Habit oder ein To-do und hat Datum,
Uhrzeit, Dauer und ein `repeat`-Kennzeichen:

```
{ id, kind: 'habit'|'todo', refId, date, time, minutes, repeat, skip: [] }
```

Ohne `repeat` gilt er an genau einem Tag. Mit `repeat` beginnt er am Tag des
Eintrags und wiederholt sich – ein Habit an jedem Tag, an dem es nach seinem
eigenen Rhythmus dran ist, ein To-do täglich, bis es abgehakt ist. Die
Regeln stehen an einer Stelle in `planAppliesOn()`; `planOn(tag)` löst sie auf
und gibt die Einträge samt Ziel, Farbe, Zustand und Fälligkeitshinweis zurück,
damit die Ansicht nichts nachschlagen muss.

Verschoben wird ein Eintrag per Geste: gedrückt halten und ziehen setzt eine
neue Uhrzeit. Das teilt sich mit dem Sortieren in den Listen die beiden Dinge,
die dort teuer erkauft waren – die Auskunft `isDragging()`, damit der Tipp
danach kein Klick ist, und `holdScroll()`, ohne das iOS die senkrechte
Bewegung für sich beansprucht und den Zeiger abbricht.

`skip` nimmt einzelne Tage aus einer Reihe. Trifft es den ersten Tag, wird
stattdessen der Anfang nach vorn geschoben – sonst würde die Ausnahmeliste bei
täglicher Nutzung immer weiter wachsen.

Löschen greift durch: Ein gelöschtes Habit, ein gelöschtes To-do oder eine Liste
nimmt ihre Plan-Einträge mit in den Papierkorb und bringt sie beim
Wiederherstellen zurück. Muss dabei eine Kennung neu vergeben werden, ziehen
die Einträge mit um (`putPlansBack`) – ohne das zeigten sie ins Leere.

## Das Widget-System

Drei Dateien, mit einer klaren Grenze dazwischen:

- **`js/store.js`** hält die Profile. Ein Profil ist `{ id, name, widgets }`,
  ein Widget `{ id, type, size, opts }`. Nichts davon weiß, wie ein Widget
  aussieht.
- **`js/widgets.js`** ist der Katalog. Jeder Typ beschreibt sich selbst: Name,
  Bereich, welche Größen er kann, ob er ein Ziel braucht (`needs: 'habit'` oder
  `'list'`) – und wie er gezeichnet wird. Ein neuer Typ braucht genau einen
  Eintrag hier, sonst nichts.
- **`js/home.js`** ordnet an, verschiebt und speichert. Sie kennt **keinen
  einzigen Widget-Typ**.

Drei Entscheidungen, die sich im Betrieb bewährt haben:

**Ein unbekannter Typ bleibt stehen.** Eine Sicherung aus einer neueren Fassung
kann Typen enthalten, die diese Fassung nicht kennt. Statt sie beim Bereinigen
still zu verwerfen – und damit die Anordnung unwiederbringlich zu beschneiden –
erscheinen sie als „Unbekanntes Widget". Wer die App aktualisiert, hat sie
wieder.

**Ein Widget darf die Startseite nicht mitnehmen.** `typ.build(ctx)` läuft in
`try/catch`. Ein Fehler in einem Typ kostet diese eine Karte, nicht den ganzen
Bildschirm.

**Ein Widget ohne Ziel verschwindet.** Wird das Habit gelöscht, auf das ein
`singleHabit` zeigt, räumt `pruneWidgetTargets` beim Laden auf. Sonst stünde
dort dauerhaft eine Karte, die nichts anzeigen kann.

Im Bearbeiten-Modus trägt die Karte `pointer-events: none`. Ohne diesen Riegel
würde das Gedrückthalten auf einem Abhak-Knopf dort ankommen statt beim
Verschieben; die Ereignisse fallen so auf die Zelle zurück, wo die Geste hängt.
✕ und der Größen-Knopf liegen daneben, nicht darin, und bleiben deshalb
bedienbar. Gewackelt wird die Karte, nicht die Zelle – ein mitwanderndes
Tippziel trifft sich schlecht.

## Die Zeile

Habits und To-dos teilen sich denselben Zeilenaufbau, und für beide gilt
dieselbe Regel: **Eine Zeile wird einmal gebaut und danach nur noch
nachgefüllt.** Gebaut wird in `todoRow()` bzw. `habitRow()`, gefüllt in
`fillRow()` bzw. `fillHabitRow()`. Abhaken ruft nur das Füllen auf.

Das hat drei Gründe, und alle drei waren vorher sichtbar kaputt:

1. **Geschwindigkeit.** Früher baute jeder Haken die ganze Liste neu. Bei 300
   To-dos dauerte ein Haken bis zum fertigen Bild 195 ms, bei 800 über
   400 ms. Jetzt sind es 34 bzw. 40 ms – praktisch unabhängig davon, wie lang
   die Liste ist. Welche Zeilen überhaupt betroffen sind, sagt `toggleTodo()`
   zurück: das To-do selbst, seine Unter-To-dos und jede ÜberTo-do, die
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
iPhone-14-Format durch: Startseite, Widgets und ihr Bearbeiten-Modus, Suche,
Editoren, Unter-To-dos, Aufleuchten, Gesten, Kalender und Planung, Datenerhalt
und Layout. Zwei Arten von Eingaben – mit dem Zeiger
(schnell, deckt die Logik ab) und mit **echten Berührungen** über das
Debug-Protokoll. Das zweite ist unverzichtbar: `touch-action` wirkt nur bei
echten Berührungen, und genau dort ist das Sortieren per Ziehen schon einmal
stillschweigend ausgefallen, während alle Zeiger-Prüfungen grün blieben.

Ist ein Chromium schon da, zeigt `CHROME_PATH` darauf; `SHOTS=verzeichnis` legt
unterwegs Bildschirmfotos ab.

Nach Änderungen an den Dateien die Version in `sw.js` (`VERSION`) hochzählen,
damit der Service Worker den alten Stand nicht weiter ausliefert.
