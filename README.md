# CW Trainer

A simple Morse/CW trainer running directly in the browser.

## Quickstart

Launch **CW Trainer** directly in your browser:

[→ Open CW Trainer](https://dc8aj.github.io/cwtrainer/)

## Features

- Selection of a CW method
- One lesson per character
- Adjustable number of training groups
- Adjustable group size
- Random selection of training characters
- Adjustable CW speed
- Adjustable tone frequency
- Adjustable volume
- Start, Pause, Resume, and Stop
- Progress display
- Solution available only after training
- Load your own CSV files
- Train your own CW abbreviations and problem cases
- The CSV filename is used as the name of the training set

## Custom CSV Files

The trainer allows you to load your own CSV files for individual CW abbreviations and problem cases.

The CSV file must contain the following two columns:

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

Example:

`my-file.csv` is displayed as: `my-file`

The file is processed locally in the browser and is not uploaded to the server.

## Morse Timing Ratios

The trainer uses the classic Morse timing ratios:

- Dot = 1 unit
- Dash = 3 units
- Gap within a character = 1 unit
- Gap between characters = 3 units
- Gap between groups/words = 7 units

### Group Gap

A normal Morse character already includes a 3-unit gap. Therefore, an additional 4 units are required to achieve a complete 7-unit gap:

`7 - 3 = 4`

The total gap between groups is therefore 7 units.

## Start Sequence

Before training, the following is sent:

`VVV`

This is followed by a 7-unit gap.

Next, `KA` is sent as a single prosign:

```text
    K = -.-
    A = .-

    KA = -.-.-
```

There is no normal 3-unit character gap between K and A.

Another 7-unit gap follows.

The complete start sequence is:

`VVV → 7 units → KA → 7 units → TRAINING`

## Lessons

For normal CW methods, exactly one lesson is created for each character in the alphabet.

Example alphabet:

`ETIAN`

This produces:

```text
    Lesson 1 = E
    Lesson 2 = T
    Lesson 3 = I
    Lesson 4 = A
    Lesson 5 = N
```

In Lesson 3, E, T, and I are therefore available for training. For CW abbreviations, each lesson corresponds to one entry in the CSV file.

## Training Display

The characters or abbreviations being transmitted are not displayed during training.

## End Sequence

After the last training character, a 7-unit gap follows.

The end character `+` is then sent.

The complete sequence is:

`VVV → 7 → KA → 7 → TRAINING → 7 → +`

The plus sign does not receive an additional gap because the training ends afterward.

## Morse Code

The internal Morse table contains:

- A–Z
- 0–9
- Period
- Comma
- Question mark
- Slash
- Equals sign
- Hyphen
- @
- Colon
- Semicolon
- Exclamation mark
- Apostrophe
- Quotation mark
- Plus
- Parentheses
- Underscore

## Speed

The dot duration is calculated from the configured speed:

`Dot duration = 1200 / WPM ms`

Example at 12 WPM:

`1200 / 12 = 100 ms`

Therefore:

```text
    Dot            = 100 ms
    Dash           = 300 ms
    Element gap    = 100 ms
    Character gap  = 300 ms
    Word gap       = 700 ms
```

## Audio

The CW output uses the Web Audio API. The trainer generates a sine-wave tone. The tone frequency is controlled by the tone setting. The volume is controlled by the volume setting.

## Controls

### Start

Starts a new training session.

### Pause

Pauses the current training session.

### Resume

Resumes a paused training session.

### Stop

Stops the current training session.

### Show Solution

Displays the actual training sequence that was transmitted.

## Keyboard

```text
    Space = Pause / Resume
    ESC   = Stop
```

The Space key is not used as the Pause/Resume key when an `INPUT`, `SELECT`, or `BUTTON` element has focus.
