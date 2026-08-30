# CW Trainer

A simple Morse/CW trainer that runs directly in the browser.

## Quickstart

Launch **CW Trainer** directly in your browser:

[→ Open CW Trainer](https://dc8aj.github.io/cwtrainer/?utm_source=chatgpt.com)

## Features

* Select a CW training method
* One lesson per character for standard CW methods
* One lesson per entry for CW abbreviation files
* Adjustable number of training groups
* Adjustable group size
* Random selection of training characters or abbreviations
* Adjustable CW speed
* Adjustable tone frequency
* Adjustable volume
* Start, Pause, Resume, and Stop
* Training progress display
* Solution available after training
* Load custom CSV files
* Train CW abbreviations and individual problem cases
* CSV filename is automatically used as the training-set name
* Custom CSV files are processed locally in the browser
* CWType mode for Morse key training
* Keyboard shortcuts for CWType

## Custom CSV Files

You can load your own CSV files to create individual training sets for CW abbreviations or problem cases.

The CSV file must contain these two columns:

```text
abbreviation,meaning
```

Example:

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

The filename is automatically used as the name of the training set.

For example:

```text
my-file.csv
```

is displayed as:

```text
my-file
```

The CSV file is processed locally in the browser. It is **not uploaded to the server**.

## Morse Timing

The trainer uses the classic Morse timing ratios:

| Element                  | Duration |
| ------------------------ | -------: |
| Dot                      |   1 unit |
| Dash                     |  3 units |
| Gap within a character   |   1 unit |
| Gap between characters   |  3 units |
| Gap between groups/words |  7 units |

### Group Gap

A normal Morse character already ends with a 3-unit character gap.

To create the full 7-unit gap between groups, the trainer therefore adds 4 additional units:

```text
7 - 3 = 4
```

The resulting total gap is 7 units.

## Start Sequence

Before the actual training begins, the trainer sends:

```text
VVV
```

This is followed by a 7-unit gap.

Next, `KA` is sent as a single prosign:

```text
K = -.-
A = .-

KA = -.-.-
```

There is **no normal 3-unit character gap** between `K` and `A`.

Another 7-unit gap follows.

The complete start sequence is:

```text
VVV → 7 units → KA → 7 units → TRAINING
```

## Lessons

For standard CW methods, one lesson is created for each character in the configured alphabet.

For example:

```text
ETIAN
```

produces:

```text
Lesson 1 = E
Lesson 2 = T
Lesson 3 = I
Lesson 4 = A
Lesson 5 = N
```

In Lesson 3, the available training characters are therefore:

```text
E T I
```

For CW abbreviation methods, each lesson corresponds to one entry in the CSV file.

## Training Display

The characters or abbreviations being transmitted are **not displayed during training**.

This allows the trainer to be used as an actual listening exercise.

## End Sequence

After the final training item, the trainer sends a 7-unit gap.

The end character `+` is then transmitted.

The complete session therefore follows this sequence:

```text
VVV → 7 → KA → 7 → TRAINING → 7 → +
```

The `+` character does not receive an additional gap because the training session ends immediately afterward.

## Morse Code

The internal Morse table supports:

* A–Z
* 0–9
* Period `.`
* Comma `,`
* Question mark `?`
* Slash `/`
* Equals sign `=`
* Hyphen `-`
* At sign `@`
* Colon `:`
* Semicolon `;`
* Exclamation mark `!`
* Apostrophe `'`
* Quotation mark `"`
* Plus sign `+`
* Parentheses `(` `)`
* Underscore `_`

## Speed

The dot duration is calculated from the configured WPM value:

```text
Dot duration = 1200 / WPM ms
```

For example, at 12 WPM:

```text
1200 / 12 = 100 ms
```

The resulting timings are:

```text
Dot                 = 100 ms
Dash                = 300 ms
Element gap         = 100 ms
Character gap       = 300 ms
Word/group gap      = 700 ms
```

## Audio

The CW output uses the browser's **Web Audio API**.

The trainer generates a sine-wave tone.

The following parameters can be adjusted:

* Tone frequency
* Volume

Audio is initialized when a training session is started.

## CWType

CWType is the training mode for Morse key input.

The mode is selected using the mode switch and is separate from the normal listening trainer.

CWType displays a continuously moving character sequence with a fixed red marker in the center of the display. Morse characters are entered using the keyboard as a Morse key.

CWType provides the following controls:

* Start training / Morse key
* Pause / Resume
* Stop
* Show solution

## Keyboard Shortcuts

```text
Space      = Start training / Morse key
Ctrl+Space = Pause / Resume
Ctrl+X     = Stop
```

The `Space` key starts training and functions as the Morse key during active CWType training.

`Ctrl+Space` pauses or resumes the current training session.

`Ctrl+X` stops the current training session.

The `Space` key is only handled by CWType when no interactive form element has focus.

When an `INPUT`, `SELECT`, or `BUTTON` element has focus, the `Space` key retains its normal browser/control behavior.

## Controls

### Start

Starts a new training session with a newly generated random sequence.

### Pause

Pauses the current training session.

### Resume

Resumes a paused training session.

### Stop

Stops the current training session.

### Show Solution

Displays the actual sequence that was transmitted during the training session.

The solution is not shown automatically while the training is running.
