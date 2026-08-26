# CW Trainer

Ein einfacher Morse-/CW-Trainer, der direkt im Browser läuft.

## Schnellstart

**CW Trainer** direkt in deinem Browser starten:

[→ CW Trainer öffnen](https://dc8aj.github.io/cwtrainer/)

## Funktionen

- Auswahl einer CW-Methode
- Eine Lektion pro Zeichen
- Einstellbare Anzahl von Trainingsgruppen
- Einstellbare Gruppengröße
- Zufällige Auswahl der Trainingszeichen
- Einstellbare CW-Geschwindigkeit
- Einstellbare Tonfrequenz
- Einstellbare Lautstärke
- Start, Pause, Fortsetzen und Stoppen
- Fortschrittsanzeige
- Lösung erst nach dem Training
- Eigene CSV-Dateien laden
- Eigene CW-Abkürzungen und Problemfälle trainieren
- Der Dateiname der CSV-Datei wird als Name des Trainingssatzes verwendet

## Eigene CSV-Dateien

Eigene Trainingsdaten können über **Load your own CSV file** geladen werden.

Die CSV-Datei benötigt folgende Struktur:

```text
abbreviation,meaning
```

Beispiel:

```text
abbreviation,meaning
"2day","today"
"2nite","tonight"
"73","best regards"
"88","love and kisses"
"99","get lost"
"aa","all after"
"ab","all before"
```

Der Dateiname wird automatisch als Name des Trainingssatzes verwendet.

Beispiel:

`my-file.csv` wird als `my-file` angezeigt.

Die Datei wird ausschließlich im Browser verarbeitet und nicht auf den Server hochgeladen.

## Morse-Zeitverhältnisse

Der Trainer verwendet die klassischen Morse-Zeitverhältnisse:

- Punkt = 1 Einheit
- Strich = 3 Einheiten
- Abstand innerhalb eines Zeichens = 1 Einheit
- Abstand zwischen Zeichen = 3 Einheiten
- Abstand zwischen Gruppen = 7 Einheiten

### Gruppenabstand

Da ein Morsezeichen bereits einen Abstand von 3 Einheiten enthält, werden zwischen zwei Gruppen zusätzlich 4 Einheiten gewartet:

`7 - 3 = 4`

Damit beträgt der gesamte Gruppenabstand 7 Einheiten.

## Startsequenz

Vor dem Training wird gesendet:

`VVV`

Danach folgt ein Abstand von 7 Einheiten.

Anschließend wird `KA` als Prosign gesendet:

```text
    K = -.-
    A = .-

    KA = -.-.-
```

Zwischen K und A gibt es keinen normalen Zeichenabstand.

Danach folgt erneut ein Abstand von 7 Einheiten.

Die Startsequenz lautet:

`VVV → 7 Einheiten → KA → 7 Einheiten → TRAINING`

## Lektionen

Bei normalen CW-Methoden wird für jedes Zeichen des Alphabets eine Lektion erzeugt.

Beispiel:

`ETIAN`

ergibt:

```text
    Lektion 1 = E
    Lektion 2 = T
    Lektion 3 = I
    Lektion 4 = A
    Lektion 5 = N
```

In Lektion 3 stehen somit E, T und I zur Verfügung. Bei Abkürzungen entspricht jede Lektion einem Eintrag der CSV-Datei.

## Trainingsanzeige

Während des Trainings werden die gesendeten Zeichen nicht angezeigt.

## Endsequenz

Nach dem letzten Trainingszeichen folgt ein Abstand von 7 Einheiten.

Danach wird `+` gesendet.

Die vollständige Sequenz lautet:

`VVV → 7 → KA → 7 → TRAINING → 7 → +`

Das Pluszeichen erhält keinen zusätzlichen Abstand, da das Training danach beendet ist.

## Morse-Code

Die interne Morse-Tabelle enthält:

- A–Z
- 0–9
- Punkt
- Komma
- Fragezeichen
- Schrägstrich
- Gleichheitszeichen
- Bindestrich
- @
- Doppelpunkt
- Semikolon
- Ausrufezeichen
- Apostroph
- Anführungszeichen
- Plus
- Klammern
- Unterstrich

## Geschwindigkeit

Die Punktdauer wird aus der eingestellten Geschwindigkeit berechnet:

`Punktdauer = 1200 / WPM ms`

Beispiel bei 12 WPM:

`1200 / 12 = 100 ms`

Daher

```text
    Punkt = 100 ms
    Strich = 300 ms
    Elementabstand = 100 ms
    Zeichenabstand = 300 ms
    Wortabstand = 700 ms
```

## Audio

Die CW-Ausgabe verwendet die Web Audio API. Der Trainer erzeugt einen Sinuston. Tonhöhe und Lautstärke können über die Einstellungen angepasst werden.

## Bedienung

### Start

Startet ein neues Training.

### Pause

Pausiert das Training.

### Fortsetzen

Setzt ein pausiertes Training fort.

### Stop

Beendet das Training.

### Lösung anzeigen

Zeigt die tatsächlich gesendete Trainingssequenz.

## Tastatur

```text
Leertaste = Pause / Fortsetzen
ESC       = Stop
```

Die Leertaste wird nicht verwendet, wenn ein Eingabefeld, eine Auswahl oder ein Button den Fokus besitzt.
