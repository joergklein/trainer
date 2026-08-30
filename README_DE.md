# CW Trainer

Ein einfacher Morse-/CW-Trainer, der direkt im Browser ausgeführt wird.

## Schnellstart

Starte **CW Trainer** direkt in deinem Browser:

[→ CW Trainer öffnen](https://dc8aj.github.io/cwtrainer/?utm_source=chatgpt.com)

## Funktionen

* Auswahl einer CW-Trainingsmethode
* Eine Lektion pro Zeichen bei Standard-CW-Methoden
* Eine Lektion pro Eintrag bei CW-Abkürzungsdateien
* Einstellbare Anzahl von Trainingsgruppen
* Einstellbare Zeichenzahl pro Gruppe
* Zufällige Auswahl von Trainingszeichen oder Abkürzungen
* Einstellbare CW-Geschwindigkeit
* Einstellbare Tonfrequenz
* Einstellbare Lautstärke
* Start, Pause, Fortsetzen und Stoppen
* Anzeige des Trainingsfortschritts
* Lösung erst nach dem Training verfügbar
* Eigene CSV-Dateien laden
* CW-Abkürzungen und individuelle Problemfälle trainieren
* Der Dateiname der CSV-Datei wird automatisch als Name des Trainingssatzes verwendet
* Eigene CSV-Dateien werden lokal im Browser verarbeitet

## Eigene CSV-Dateien

Du kannst eigene CSV-Dateien laden, um individuelle Trainingssätze für CW-Abkürzungen oder Problemfälle zu erstellen.

Die CSV-Datei muss diese beiden Spalten enthalten:

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

Beispielsweise:

```text
my-file.csv
```

wird angezeigt als:

```text
my-file
```

Die CSV-Datei wird lokal im Browser verarbeitet. Sie wird **nicht auf den Server hochgeladen**.

## Morse-Timing

Der Trainer verwendet die klassischen Morse-Timing-Verhältnisse:

| Element                          |       Dauer |
| -------------------------------- | ----------: |
| Punkt                            |   1 Einheit |
| Strich                           | 3 Einheiten |
| Abstand innerhalb eines Zeichens |   1 Einheit |
| Abstand zwischen Zeichen         | 3 Einheiten |
| Abstand zwischen Gruppen/Wörtern | 7 Einheiten |

### Gruppenabstand

Ein normales Morsezeichen endet bereits mit einem Abstand von 3 Einheiten.

Um den vollständigen Abstand von 7 Einheiten zwischen Gruppen zu erreichen, fügt der Trainer deshalb weitere 4 Einheiten hinzu:

```text
7 - 3 = 4
```

Der resultierende Gesamt­abstand beträgt 7 Einheiten.

## Startsequenz

Vor Beginn des eigentlichen Trainings sendet der Trainer:

```text
VVV
```

Darauf folgt ein Abstand von 7 Einheiten.

Anschließend wird `KA` als ein einziges Prosign gesendet:

```text
K = -.-
A = .-

KA = -.-.-
```

Zwischen `K` und `A` gibt es **keinen normalen Abstand von 3 Einheiten**.

Danach folgt erneut ein Abstand von 7 Einheiten.

Die vollständige Startsequenz lautet:

```text
VVV → 7 Einheiten → KA → 7 Einheiten → TRAINING
```

## Lektionen

Bei Standard-CW-Methoden wird für jedes Zeichen des konfigurierten Alphabets genau eine Lektion erstellt.

Beispiel:

```text
ETIAN
```

ergibt:

```text
Lektion 1 = E
Lektion 2 = T
Lektion 3 = I
Lektion 4 = A
Lektion 5 = N
```

In Lektion 3 stehen somit folgende Trainingszeichen zur Verfügung:

```text
E T I
```

Bei CW-Abkürzungsmethoden entspricht jede Lektion einem Eintrag aus der CSV-Datei.

## Trainingsanzeige

Die übertragenen Zeichen oder Abkürzungen werden **während des Trainings nicht angezeigt**.

Dadurch kann der Trainer als tatsächliche Hörübung verwendet werden.

## Endsequenz

Nach dem letzten Trainingselement sendet der Trainer einen Abstand von 7 Einheiten.

Anschließend wird das Endzeichen `+` übertragen.

Die vollständige Trainingssequenz lautet daher:

```text
VVV → 7 → KA → 7 → TRAINING → 7 → +
```

Das Zeichen `+` erhält keinen zusätzlichen Abstand, da das Training unmittelbar danach endet.

## Morsecode

Die interne Morsetabelle unterstützt:

* A–Z
* 0–9
* Punkt `.`
* Komma `,`
* Fragezeichen `?`
* Schrägstrich `/`
* Gleichheitszeichen `=`
* Bindestrich `-`
* At-Zeichen `@`
* Doppelpunkt `:`
* Semikolon `;`
* Ausrufezeichen `!`
* Apostroph `'`
* Anführungszeichen `"`
* Pluszeichen `+`
* Klammern `(` `)`
* Unterstrich `_`

## Geschwindigkeit

Die Dauer eines Punktes wird anhand der eingestellten WPM-Geschwindigkeit berechnet:

```text
Punktdauer = 1200 / WPM ms
```

Beispiel bei 12 WPM:

```text
1200 / 12 = 100 ms
```

Daraus ergeben sich folgende Zeiten:

```text
Punkt                 = 100 ms
Strich                = 300 ms
Elementabstand        = 100 ms
Zeichenabstand        = 300 ms
Wort-/Gruppenabstand  = 700 ms
```

## Audio

Die CW-Ausgabe verwendet die **Web Audio API** des Browsers.

Der Trainer erzeugt einen Sinuston.

Folgende Parameter können eingestellt werden:

* Tonfrequenz
* Lautstärke

Das Audio wird beim Start einer Trainingseinheit initialisiert.

## CWType

CWType ist der Trainingsmodus für Morse-Tasteneingabe.

Der Modus wird über den Modusschalter ausgewählt und ist vom normalen Hörtraining getrennt.

CWType zeigt eine sich kontinuierlich bewegende Zeichenfolge mit einem festen roten Marker in der Mitte der Anzeige. Die Morsezeichen werden über die Tastatur als Morse-Taste eingegeben.

Die CWType-Steuerung umfasst:

* Training starten / Morse-Taste
* Pause / Fortsetzen
* Stoppen
* Lösung anzeigen

## Tastaturkürzel

```text
Space      = Training starten / Morse-Taste
Ctrl+Space = Pause / Fortsetzen
Ctrl+X     = Stoppen
```

Die `Space`-Taste startet das Training und dient während eines aktiven CWType-Trainings als Morse-Taste.

`Ctrl+Space` pausiert das aktuelle Training oder setzt es fort.

`Ctrl+X` beendet das aktuelle Training.

Die `Space`-Taste wird von CWType nur verarbeitet, wenn kein interaktives Formularelement den Fokus besitzt.

Wenn ein `INPUT`, `SELECT` oder `BUTTON`-Element den Fokus besitzt, behält die `Space`-Taste ihr normales Browser- bzw. Steuerelementverhalten.

## Steuerung

### Start

Startet eine neue Trainingseinheit mit einer neu erzeugten zufälligen Sequenz.

### Pause

Pausiert die aktuelle Trainingseinheit.

### Fortsetzen

Setzt eine pausierte Trainingseinheit fort.

### Stop

Beendet die aktuelle Trainingseinheit.

### Lösung anzeigen

Zeigt die tatsächliche Sequenz an, die während der Trainingseinheit übertragen wurde.

Die Lösung wird während des laufenden Trainings nicht automatisch angezeigt.
