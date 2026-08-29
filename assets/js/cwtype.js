"use strict";

(() => {
  /* =========================================================
     CW TYPE
     Visuelle Variante von cwtrainer.js

     Reihenfolge:
       VVV → KA → 5er-Gruppe → 5er-Gruppe → ... → +

     Regeln:
       - vollständige MORSE-Tabelle
       - Morse-Timing 1:1
       - Zeichenbreite bestimmt niemals das Timing
       - 5er-Gruppen bleiben erhalten
       - Gruppenabstände sind rein visuell
       - Schrift wird vertikal exakt im Laufband zentriert
     ========================================================= */

  /* =========================================================
     DOM
     ========================================================= */

  const methodSelect = document.getElementById("method");
  const lessonSelect = document.getElementById("lesson");

  const groupsInput = document.getElementById("groups");
  const groupSizeInput = document.getElementById("groupSize");
  const wpmInput = document.getElementById("wpm");

  const customFileInput = document.getElementById("custom-file");
  const customFilesElement = document.getElementById("custom-files");

  const track = document.getElementById("cwtype-track");
  const marker = document.getElementById("cwtype-marker");
  const laufband = document.getElementById("cwtype-laufband");

  const startButton = document.getElementById("cwtype-start");
  const pauseButton = document.getElementById("cwtype-pause");
  const stopButton = document.getElementById("cwtype-stop");

  /* =========================================================
     DATA
     ========================================================= */

  let methods = [];
  let customFiles = [];

  let currentMethod = null;
  let currentLesson = 1;

  let abbreviationData = [];

  let currentGroups = [];
  let currentTiming = [];

  /* =========================================================
     MORSE
     Referenz: cwtrainer.js
     ========================================================= */

  const MORSE = {
    A: ".-",
    B: "-...",
    C: "-.-.",
    D: "-..",
    E: ".",
    F: "..-.",
    G: "--.",
    H: "....",
    I: "..",
    J: ".---",
    K: "-.-",
    L: ".-..",
    M: "--",
    N: "-.",
    O: "---",
    P: ".--.",
    Q: "--.-",
    R: ".-.",
    S: "...",
    T: "-",
    U: "..-",
    V: "...-",
    W: ".--",
    X: "-..-",
    Y: "-.--",
    Z: "--..",

    0: "-----",
    1: ".----",
    2: "..---",
    3: "...--",
    4: "....-",
    5: ".....",
    6: "-....",
    7: "--...",
    8: "---..",
    9: "----.",

    ".": ".-.-.-",
    ",": "--..--",
    "?": "..--..",
    "/": "-..-.",
    "=": "-...-",
    "-": "-....-",
    "@": ".--.-.",
    ":": "---...",
    ";": "-.-.-.",
    "!": "-.-.--",
    "'": ".----.",
    '"': ".-..-.",
    "+": ".-.-.",
    "(": "-.--.",
    ")": "-.--.-",
    _: "..--.-",
  };

  /* =========================================================
     CW TIMING
     ========================================================= */

  const CW_DIT = 1;
  const CW_DAH = 3;

  const CW_ELEMENT_GAP = 1;
  const CW_CHARACTER_GAP = 3;
  const CW_WORD_GAP = 7;

  /* =========================================================
     WPM
     ========================================================= */

  function getWpm() {
    const value = Number(wpmInput?.value);

    if (!Number.isFinite(value) || value < 1) {
      return 12;
    }

    return value;
  }

  function getDitMilliseconds() {
    return 1200 / getWpm();
  }

  /* =========================================================
     MORSE UNITS
     ========================================================= */

  function morseUnits(character) {
    const key = String(character).toUpperCase();
    const code = MORSE[key];

    if (!code) {
      return 0;
    }

    let units = 0;

    for (let i = 0; i < code.length; i++) {
      units += code[i] === "-" ? CW_DAH : CW_DIT;

      if (i < code.length - 1) {
        units += CW_ELEMENT_GAP;
      }
    }

    return units;
  }

  /*
   * Morse-Dauer eines sichtbaren Trainingswertes.
   *
   * Zwischen mehreren Zeichen innerhalb einer
   * Abkürzung liegt der normale Zeichenabstand.
   *
   * Danach folgt der Wortabstand.
   */

  function textUnits(text) {
    const characters = Array.from(String(text));

    if (characters.length === 0) {
      return 0;
    }

    let units = 0;

    for (let i = 0; i < characters.length; i++) {
      units += morseUnits(characters[i]);

      if (i < characters.length - 1) {
        units += CW_CHARACTER_GAP;
      }
    }

    units += CW_WORD_GAP;

    return units;
  }

  /* =========================================================
     VVV
     ========================================================= */

  function vvvUnits() {
    return (
      morseUnits("V") +
      CW_CHARACTER_GAP +
      morseUnits("V") +
      CW_CHARACTER_GAP +
      morseUnits("V") +
      CW_WORD_GAP
    );
  }

  /* =========================================================
     KA
     ========================================================= */

  function kaUnits() {
    const code = "-.-.-";

    let units = 0;

    for (let i = 0; i < code.length; i++) {
      units += code[i] === "-" ? CW_DAH : CW_DIT;

      if (i < code.length - 1) {
        units += CW_ELEMENT_GAP;
      }
    }

    units += CW_WORD_GAP;

    return units;
  }

  /* =========================================================
     TIMING-SEQUENCE
     ========================================================= */

  function buildTimingSequence(groups) {
    const sequence = [];

    /*
     * VVV
     */

    sequence.push({
      text: "VVV",
      type: "vvv",
      units: vvvUnits(),
    });

    /*
     * KA
     */

    sequence.push({
      text: "KA",
      type: "ka",
      units: kaUnits(),
    });

    /*
     * Jede Trainingsabkürzung separat.
     *
     * Die 5er-Gruppierung beeinflusst
     * NICHT die Morsezeit.
     */

    groups.forEach((group, groupIndex) => {
      group.forEach((item, itemIndex) => {
        sequence.push({
          text: String(item),
          type: "training",
          groupIndex,
          itemIndex,
          units: textUnits(item),
        });
      });
    });

    /*
     * Abschluss +
     */

    sequence.push({
      text: "+",
      type: "plus",
      units: morseUnits("+"),
    });

    return sequence;
  }

  /* =========================================================
     GESAMTZEIT
     ========================================================= */

  function getTotalUnits() {
    return currentTiming.reduce((total, item) => total + item.units, 0);
  }

  function getDuration() {
    return Math.max(1, getTotalUnits() * getDitMilliseconds());
  }

  /* =========================================================
     CSV
     ========================================================= */

  function parseCSVLine(line) {
    const values = [];

    let value = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const character = line[i];

      if (character === '"') {
        if (quoted && line[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = !quoted;
        }

        continue;
      }

      if (character === "," && !quoted) {
        values.push(value.trim());
        value = "";
        continue;
      }

      value += character;
    }

    values.push(value.trim());

    return values;
  }

  function parseCSV(text) {
    const lines = String(text)
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");

    if (lines.length < 2) {
      throw new Error("The CSV file contains no data.");
    }

    const header = parseCSVLine(lines[0]).map((value) => value.toLowerCase());

    const abbreviationIndex = header.indexOf("abbreviation");

    const meaningIndex = header.indexOf("meaning");

    if (abbreviationIndex === -1 || meaningIndex === -1) {
      throw new Error('CSV header must contain "abbreviation,meaning".');
    }

    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      const abbreviation = values[abbreviationIndex]?.trim() || "";

      const meaning = values[meaningIndex]?.trim() || "";

      if (!abbreviation) {
        continue;
      }

      result.push({
        abbreviation,
        meaning,
      });
    }

    if (!result.length) {
      throw new Error("The CSV file contains no valid entries.");
    }

    return result;
  }

  /* =========================================================
     METHODS
     ========================================================= */

  function isAbbreviationMethod() {
    return (
      currentMethod &&
      (currentMethod.type === "abbreviations" ||
        currentMethod.type === "custom")
    );
  }

  function isCustomMethod() {
    return currentMethod?.type === "custom";
  }

  function getAllMethods() {
    return [
      ...methods,
      ...customFiles.map((file) => ({
        id: file.id,
        name: file.name,
        type: "custom",
        customFileId: file.id,
      })),
    ];
  }

  function rebuildMethods(selectId = null) {
    if (!methodSelect) {
      return;
    }

    const previousId = selectId || currentMethod?.id || null;

    const allMethods = getAllMethods();

    methodSelect.replaceChildren();

    allMethods.forEach((method) => {
      if (!method?.id) {
        return;
      }

      const option = document.createElement("option");

      option.value = method.id;
      option.textContent = method.name || method.id;

      methodSelect.appendChild(option);
    });

    if (!allMethods.length) {
      currentMethod = null;
      abbreviationData = [];
      populateLessons();
      return;
    }

    const exists = allMethods.some((method) => method.id === previousId);

    methodSelect.value = exists ? previousId : allMethods[0].id;

    selectMethod();
  }

  /* =========================================================
     CUSTOM FILES
     ========================================================= */

  function renderCustomFiles() {
    if (!customFilesElement) {
      return;
    }

    customFilesElement.replaceChildren();

    customFiles.forEach((file) => {
      const row = document.createElement("div");

      row.className = "custom-file";

      const name = document.createElement("span");

      name.textContent = file.name;

      const removeButton = document.createElement("button");

      removeButton.type = "button";
      removeButton.textContent = "Remove";

      removeButton.addEventListener("click", () => removeCustomFile(file.id));

      row.append(name, removeButton);

      customFilesElement.appendChild(row);
    });
  }

  async function addCustomFile(file) {
    const data = parseCSV(await file.text());

    const name = file.name.replace(/\.csv$/i, "");

    const id =
      "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2);

    customFiles.push({
      id,
      name,
      data,
    });

    renderCustomFiles();

    rebuildMethods(id);
  }

  function removeCustomFile(id) {
    customFiles = customFiles.filter((file) => file.id !== id);

    renderCustomFiles();

    if (currentMethod?.customFileId === id) {
      currentMethod = null;
    }

    rebuildMethods();
  }

  /* =========================================================
     ABBREVIATIONS
     ========================================================= */

  async function loadAbbreviations() {
    abbreviationData = [];

    if (!isAbbreviationMethod()) {
      return;
    }

    if (isCustomMethod()) {
      const file = customFiles.find(
        (item) => item.id === currentMethod.customFileId,
      );

      if (!file) {
        throw new Error("Custom CSV file is no longer available.");
      }

      /*
       * Vollständige CSV-Daten übernehmen.
       */

      abbreviationData = file.data.slice();

      return;
    }

    if (typeof currentMethod.source !== "string") {
      throw new Error("No abbreviation CSV file specified.");
    }

    const response = await fetch("text/" + currentMethod.source, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("CSV could not be loaded: HTTP " + response.status);
    }

    abbreviationData = parseCSV(await response.text());
  }

  /* =========================================================
     LESSONS
     ========================================================= */

  function getAlphabet() {
    if (typeof currentMethod?.alphabet !== "string") {
      return [];
    }

    return Array.from(currentMethod.alphabet);
  }

  function getLessonCount() {
    return isAbbreviationMethod()
      ? abbreviationData.length
      : getAlphabet().length;
  }

  function populateLessons() {
    if (!lessonSelect) {
      return;
    }

    lessonSelect.replaceChildren();

    const count = getLessonCount();

    for (let i = 1; i <= count; i++) {
      const option = document.createElement("option");

      option.value = String(i);
      option.textContent = "Lesson " + i;

      lessonSelect.appendChild(option);
    }

    if (count > 0) {
      lessonSelect.value = String(Math.min(currentLesson, count));
    }
  }

  function getCurrentLessonValues() {
    if (isAbbreviationMethod()) {
      return abbreviationData
        .slice(0, currentLesson)
        .map((entry) => entry.abbreviation);
    }

    return getAlphabet().slice(0, currentLesson);
  }

  /* =========================================================
     GROUP SETTINGS
     ========================================================= */

  function getGroupSettings() {
    let groups = parseInt(groupsInput?.value, 10);

    let groupSize = parseInt(groupSizeInput?.value, 10);

    if (!Number.isFinite(groups) || groups < 1) {
      groups = 1;
    }

    if (!Number.isFinite(groupSize) || groupSize < 1) {
      groupSize = 5;
    }

    return {
      groups,
      groupSize,
    };
  }

  /* =========================================================
     TRAININGSGRUPPEN
     ========================================================= */

  function createTrainingGroups() {
    const available = getCurrentLessonValues();

    if (!available.length) {
      return [];
    }

    const { groups, groupSize } = getGroupSettings();

    const result = [];

    for (let groupIndex = 0; groupIndex < groups; groupIndex++) {
      const group = [];

      for (let itemIndex = 0; itemIndex < groupSize; itemIndex++) {
        const index = Math.floor(Math.random() * available.length);

        group.push(String(available[index]));
      }

      result.push(group);
    }

    return result;
  }

  /* =========================================================
     VISUELLE GRUPPE
     ========================================================= */

  function createGroupElement(group) {
    const groupElement = document.createElement("span");

    groupElement.className = "cwtype-group";

    /*
     * Die Gruppe bleibt ein eigenes
     * geschlossenes Element.
     */

    groupElement.style.display = "inline-flex";

    groupElement.style.alignItems = "center";

    groupElement.style.verticalAlign = "middle";

    groupElement.style.whiteSpace = "nowrap";

    /*
     * Abstand innerhalb der 5er-Gruppe.
     */

    groupElement.style.gap = "0.32em";

    group.forEach((item) => {
      const character = document.createElement("span");

      character.className = "cwtype-character";

      character.textContent = String(item);

      character.style.display = "inline-block";

      /*
       * Keine eigene vertikale Verschiebung.
       */

      character.style.lineHeight = "1";

      groupElement.appendChild(character);
    });

    return groupElement;
  }

  /* =========================================================
     TRACK AUFBAUEN
     ========================================================= */

  function createTrack() {
    track.replaceChildren();

    currentGroups = createTrainingGroups();

    currentTiming = buildTimingSequence(currentGroups);

    const line = document.createElement("div");

    line.className = "cwtype-line";

    /*
     * HORIZONTALE POSITION
     *
     * left wird später durch die Animation
     * gesetzt.
     */

    line.style.position = "absolute";

    /*
     * VERTIKALE ZENTRIERUNG
     *
     * Exakt Mitte des Laufbands.
     *
     * Wichtig:
     * Nicht mit margin-top,
     * padding oder festen Pixelwerten
     * korrigieren.
     */

    line.style.top = "50%";

    line.style.transform = "translateY(-50%)";

    /*
     * Flex sorgt dafür, dass VVV,
     * KA, Gruppen und + auf derselben
     * vertikalen Achse liegen.
     */

    line.style.display = "flex";

    line.style.alignItems = "center";

    line.style.whiteSpace = "nowrap";

    line.style.height = "auto";

    line.style.margin = "0";

    line.style.padding = "0";

    /* ---------------------------------------------------------
       VVV
       --------------------------------------------------------- */

    const vvv = document.createElement("span");

    vvv.className = "cwtype-vvv";

    vvv.textContent = "VVV";

    vvv.style.display = "inline-block";

    line.appendChild(vvv);

    /* ---------------------------------------------------------
       VVV → KA
       --------------------------------------------------------- */

    const vvvGap = document.createElement("span");

    vvvGap.className = "cwtype-gap cwtype-gap-vvv";

    vvvGap.style.display = "inline-block";

    vvvGap.style.width = "0.8em";

    vvvGap.style.flex = "0 0 0.8em";

    line.appendChild(vvvGap);

    /* ---------------------------------------------------------
       KA
       --------------------------------------------------------- */

    const ka = document.createElement("span");

    ka.className = "cwtype-ka";

    ka.textContent = "KA";

    ka.style.display = "inline-block";

    line.appendChild(ka);

    /* ---------------------------------------------------------
       KA → erste Gruppe
       --------------------------------------------------------- */

    const kaGap = document.createElement("span");

    kaGap.className = "cwtype-gap cwtype-gap-ka";

    kaGap.style.display = "inline-block";

    kaGap.style.width = "0.8em";

    kaGap.style.flex = "0 0 0.8em";

    line.appendChild(kaGap);

    /* ---------------------------------------------------------
       5ER-GRUPPEN
       --------------------------------------------------------- */

    currentGroups.forEach((group, groupIndex) => {
      /*
       * Jede Gruppe ist ein eigenes
       * Element.
       *
       * Dadurch können die Gruppen
       * niemals zu einer langen
       * Zeichenkette verschmelzen.
       */

      const groupElement = createGroupElement(group);

      line.appendChild(groupElement);

      /*
       * Abstand zwischen den Gruppen.
       *
       * ABSICHTLICH KURZ.
       *
       * Dieser Wert ist ausschließlich
       * optisch und hat keinerlei
       * Einfluss auf Morse-Timing.
       */

      if (groupIndex < currentGroups.length - 1) {
        const groupGap = document.createElement("span");

        groupGap.className = "cwtype-group-gap";

        groupGap.style.display = "inline-block";

        groupGap.style.width = "0.9em";

        groupGap.style.flex = "0 0 0.9em";

        line.appendChild(groupGap);
      }
    });

    /* ---------------------------------------------------------
       letzte Gruppe → +
       --------------------------------------------------------- */

    const plusGap = document.createElement("span");

    plusGap.className = "cwtype-gap cwtype-gap-plus";

    plusGap.style.display = "inline-block";

    plusGap.style.width = "0.8em";

    plusGap.style.flex = "0 0 0.8em";

    line.appendChild(plusGap);

    /* ---------------------------------------------------------
       +
       --------------------------------------------------------- */

    const plus = document.createElement("span");

    plus.className = "cwtype-plus";

    plus.textContent = "+";

    plus.style.display = "inline-block";

    line.appendChild(plus);

    track.appendChild(line);

    return line;
  }

  /* =========================================================
     POSITIONIERUNG
     ========================================================= */

  let startX = 0;
  let endX = 0;

  function layout(line) {
    const band = laufband.getBoundingClientRect();

    const markerRect = marker.getBoundingClientRect();

    const markerX = markerRect.left - band.left + markerRect.width / 2;

    /*
     * Nur die tatsächliche Breite
     * des fertigen visuellen Inhalts.
     *
     * Niemals für Timing verwenden.
     */

    const width = line.getBoundingClientRect().width;

    startX = markerX;

    endX = markerX - width;
  }

  function setX(x) {
    const line = track.querySelector(".cwtype-line");

    if (!line) {
      return;
    }

    line.style.left = `${x}px`;
  }

  /* =========================================================
     ANIMATION
     ========================================================= */

  let animationFrame = null;

  let running = false;
  let paused = false;

  let startTime = 0;
  let elapsed = 0;
  let duration = 1;

  function stopAnimation() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);

      animationFrame = null;
    }
  }

  function animate(timestamp) {
    if (!running) {
      return;
    }

    if (paused) {
      animationFrame = requestAnimationFrame(animate);

      return;
    }

    elapsed = timestamp - startTime;

    const progress = Math.min(1, elapsed / duration);

    /*
     * Die komplette Bewegung ist linear.
     *
     * WPM bestimmt die Zeit.
     * Die Breite bestimmt ausschließlich
     * den räumlichen Weg.
     */

    const x = startX + (endX - startX) * progress;

    setX(x);

    if (progress >= 1) {
      setX(endX);
      finish();
      return;
    }

    animationFrame = requestAnimationFrame(animate);
  }

  /* =========================================================
     REBUILD
     ========================================================= */

  function rebuild() {
    stopAnimation();

    running = false;
    paused = false;
    elapsed = 0;

    track.style.visibility = "hidden";

    try {
      const line = createTrack();

      requestAnimationFrame(() => {
        /*
         * Erst nach dem Layout messen.
         */

        layout(line);

        setX(startX);

        duration = getDuration();

        track.style.visibility = "visible";

        if (startButton) {
          startButton.disabled = false;
        }

        if (pauseButton) {
          pauseButton.disabled = true;

          pauseButton.textContent = "⏸ Pause";
        }

        if (stopButton) {
          stopButton.disabled = true;
        }
      });
    } catch (error) {
      console.error(error);

      track.style.visibility = "visible";
    }
  }

  /* =========================================================
     START
     ========================================================= */

  function start() {
    stopAnimation();

    track.style.visibility = "hidden";

    try {
      const line = createTrack();

      requestAnimationFrame(() => {
        layout(line);

        duration = getDuration();

        elapsed = 0;

        running = true;
        paused = false;

        setX(startX);

        startTime = performance.now();

        track.style.visibility = "visible";

        if (startButton) {
          startButton.disabled = true;
        }

        if (pauseButton) {
          pauseButton.disabled = false;

          pauseButton.textContent = "⏸ Pause";
        }

        if (stopButton) {
          stopButton.disabled = false;
        }

        animationFrame = requestAnimationFrame(animate);
      });
    } catch (error) {
      console.error(error);

      track.style.visibility = "visible";
    }
  }

  /* =========================================================
     PAUSE / RESUME
     ========================================================= */

  function togglePause() {
    if (!running) {
      return;
    }

    if (!paused) {
      paused = true;

      if (pauseButton) {
        pauseButton.textContent = "▶ Resume";
      }

      return;
    }

    startTime = performance.now() - elapsed;

    paused = false;

    if (pauseButton) {
      pauseButton.textContent = "⏸ Pause";
    }
  }

  /* =========================================================
     STOP
     ========================================================= */

  function stop() {
    stopAnimation();

    running = false;
    paused = false;
    elapsed = 0;

    setX(startX);

    if (startButton) {
      startButton.disabled = false;
    }

    if (pauseButton) {
      pauseButton.disabled = true;

      pauseButton.textContent = "⏸ Pause";
    }

    if (stopButton) {
      stopButton.disabled = true;
    }
  }

  /* =========================================================
     FINISH
     ========================================================= */

  function finish() {
    stopAnimation();

    running = false;
    paused = false;

    setX(endX);

    if (startButton) {
      startButton.disabled = false;
    }

    if (pauseButton) {
      pauseButton.disabled = true;

      pauseButton.textContent = "⏸ Pause";
    }

    if (stopButton) {
      stopButton.disabled = true;
    }
  }

  /* =========================================================
     METHOD SELECTION
     ========================================================= */

  async function selectMethod() {
    const method = getAllMethods().find(
      (item) => item.id === methodSelect.value,
    );

    if (!method) {
      return;
    }

    currentMethod = method;
    currentLesson = 1;

    try {
      await loadAbbreviations();
    } catch (error) {
      console.error(error);

      abbreviationData = [];

      populateLessons();

      rebuild();

      return;
    }

    populateLessons();

    if (lessonSelect.options.length) {
      lessonSelect.value = "1";
    }

    rebuild();
  }

  /* =========================================================
     LESSON SELECTION
     ========================================================= */

  function selectLesson() {
    const value = Number(lessonSelect.value);

    const count = getLessonCount();

    currentLesson =
      Number.isFinite(value) && value >= 1
        ? Math.min(Math.floor(value), count)
        : 1;

    rebuild();
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  customFileInput?.addEventListener("change", async () => {
    const file = customFileInput.files?.[0];

    if (!file) {
      return;
    }

    try {
      await addCustomFile(file);
    } catch (error) {
      console.error("CSV error:", error);
    }

    customFileInput.value = "";
  });

  methodSelect?.addEventListener("change", selectMethod);

  lessonSelect?.addEventListener("change", selectLesson);

  groupsInput?.addEventListener("input", () => {
    if (!running) {
      rebuild();
    }
  });

  groupSizeInput?.addEventListener("input", () => {
    if (!running) {
      rebuild();
    }
  });

  wpmInput?.addEventListener("input", () => {
    if (!running) {
      rebuild();
    }
  });

  startButton?.addEventListener("click", start);

  pauseButton?.addEventListener("click", togglePause);

  stopButton?.addEventListener("click", stop);

  window.addEventListener("resize", () => {
    if (!running) {
      rebuild();
    }
  });

  /* =========================================================
     INIT
     ========================================================= */

  async function init() {
    try {
      const response = await fetch("text/index.json", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          "text/index.json konnte nicht geladen werden: HTTP " +
            response.status,
        );
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.methods)) {
        throw new Error("Ungültiges text/index.json.");
      }

      methods = data.methods.slice();

      rebuildMethods();
    } catch (error) {
      console.error("CW Type konnte nicht gestartet werden:", error);

      if (track) {
        track.style.visibility = "visible";
      }

      if (startButton) {
        startButton.disabled = true;
      }

      if (pauseButton) {
        pauseButton.disabled = true;
      }

      if (stopButton) {
        stopButton.disabled = true;
      }
    }
  }

  init();
})();
