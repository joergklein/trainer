"use strict";

(() => {
  /* =========================================================
     DOM
     ========================================================= */

  const methodSelect = document.getElementById("method");
  const lessonSelect = document.getElementById("lesson");

  const groupsInput = document.getElementById("groups");
  const groupSizeInput = document.getElementById("groupSize");
  const wpmInput = document.getElementById("wpm");
  const toneInput = document.getElementById("tone");
  const volumeInput = document.getElementById("volume");

  const customFileInput = document.getElementById("custom-file");
  const customFilesElement = document.getElementById("custom-files");

  const track = document.getElementById("cwtype-track");
  const marker = document.getElementById("cwtype-marker");
  const laufband = document.getElementById("cwtype-laufband");

  const startButton = document.getElementById("cwtype-start");
  const pauseButton = document.getElementById("cwtype-pause");
  const stopButton = document.getElementById("cwtype-stop");

  const showSolutionButton = document.getElementById("show-solution");
  const solutionElement = document.getElementById("solution");

  /* =========================================================
     DATA
     ========================================================= */

  let methods = [];
  let customFiles = [];

  let currentMethod = null;
  let currentLesson = 1;

  let abbreviationData = [];

  /* =========================================================
     TRAINING
     ========================================================= */

  let currentGroups = [];
  let currentTiming = [];

  let expectedCharacters = [];
  let typedSequence = [];

  let processedCount = 0;
  let currentExpectedIndex = 0;

  let morseInput = "";

  /* =========================================================
     STATE
     ========================================================= */

  let running = false;
  let paused = false;

  let animationFrame = null;

  let startTime = 0;
  let elapsed = 0;
  let duration = 1;

  let startX = 0;
  let endX = 0;

  let characterTiming = [];

  let keyDown = false;
  let keyDownStarted = 0;
  let characterTimer = null;

  /* =========================================================
     MORSE
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

  const MORSE_REVERSE = Object.fromEntries(
    Object.entries(MORSE).map(([character, code]) => [code, character]),
  );

  /* =========================================================
     CW TIMING
     ========================================================= */

  const CW_DIT = 1;
  const CW_DAH = 3;

  const CW_ELEMENT_GAP = 1;
  const CW_CHARACTER_GAP = 3;
  const CW_WORD_GAP = 7;
  const CW_WORD_GAP_EXTRA = CW_WORD_GAP - CW_CHARACTER_GAP;

  const CW_BEGIN_PROSIGN = "-.-.-";

  /* =========================================================
     HELPERS
     ========================================================= */

  function isAbbreviationMethod() {
    return (
      typeof currentMethod?.source === "string" ||
      currentMethod?.type === "custom"
    );
  }

  function isCustomMethod() {
    return currentMethod?.type === "custom";
  }

  function getAlphabet() {
    return typeof currentMethod?.alphabet === "string"
      ? Array.from(currentMethod.alphabet)
      : [];
  }

  function getAvailableAbbreviations() {
    return abbreviationData.slice(0, currentLesson);
  }

  /* =========================================================
     SETTINGS
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

  function getToneFrequency() {
    const value = Number(toneInput?.value);

    if (!Number.isFinite(value)) {
      return 600;
    }

    return Math.max(100, Math.min(2000, value));
  }

  function getVolume() {
    const value = Number(volumeInput?.value);

    if (!Number.isFinite(value)) {
      return 30;
    }

    return Math.max(0, Math.min(100, value)) / 100;
  }

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
     AUDIO
     ========================================================= */

  async function ensureAudio() {
    if (typeof INCWAudio === "undefined") {
      return false;
    }

    if (typeof INCWAudio.start !== "function") {
      return false;
    }

    try {
      const audio = await INCWAudio.start();

      return !!audio && audio.state === "running";
    } catch (error) {
      console.error("CW audio could not be initialized:", error);
      return false;
    }
  }

  async function toneStart() {
    const ready = await ensureAudio();

    if (!ready) {
      return;
    }

    try {
      INCWAudio.tone(
        getToneFrequency(),
        getDitMilliseconds() / 1000,
        getVolume(),
      );
    } catch (error) {
      console.error(error);
    }
  }

  function toneStop() {
    if (
      typeof INCWAudio !== "undefined" &&
      typeof INCWAudio.stop === "function"
    ) {
      try {
        INCWAudio.stop();
      } catch (error) {
        console.error(error);
      }
    }
  }

  /* =========================================================
     MORSE CALCULATION
     ========================================================= */

  function morseUnits(character) {
    const code = MORSE[String(character).toUpperCase()];

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

  function textUnits(text) {
    const characters = Array.from(String(text));

    if (!characters.length) {
      return 0;
    }

    let units = 0;

    characters.forEach((character, index) => {
      units += morseUnits(character);

      if (index < characters.length - 1) {
        units += CW_CHARACTER_GAP;
      }
    });

    return units + CW_WORD_GAP;
  }

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

  function kaUnits() {
    let units = 0;

    for (const symbol of CW_BEGIN_PROSIGN) {
      units += symbol === "-" ? CW_DAH : CW_DIT;
    }

    units += (CW_BEGIN_PROSIGN.length - 1) * CW_ELEMENT_GAP;

    return units + CW_WORD_GAP;
  }

  /* =========================================================
     CSV
     IDENTISCHES VERHALTEN WIE CWTRAINER
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

    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      if (values.length < 1) {
        continue;
      }

      const abbreviation = values[0]?.trim() || "";
      const meaning = values[1]?.trim() || "";

      if (abbreviation) {
        result.push({
          abbreviation,
          meaning,
        });
      }
    }

    if (!result.length) {
      throw new Error("The CSV file contains no valid entries.");
    }

    return result;
  }

  /* =========================================================
     CUSTOM FILES
     ========================================================= */

  function createCustomMethod(file) {
    return {
      id: file.id,
      name: file.name,
      type: "custom",
      customFileId: file.id,
    };
  }

  function getAllMethods() {
    return [...methods, ...customFiles.map(createCustomMethod)];
  }

  function renderCustomFiles() {
    if (!customFilesElement) {
      return;
    }

    customFilesElement.replaceChildren();

    for (const file of customFiles) {
      const row = document.createElement("div");

      row.className = "custom-file";

      const name = document.createElement("span");
      name.textContent = file.name;

      const removeButton = document.createElement("button");

      removeButton.type = "button";
      removeButton.textContent = "Remove";

      removeButton.addEventListener("click", () => {
        removeCustomFile(file.id);
      });

      row.append(name, removeButton);

      customFilesElement.appendChild(row);
    }
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
    if (running) {
      stop();
    }

    const selected = currentMethod?.customFileId === id;

    customFiles = customFiles.filter((file) => file.id !== id);

    renderCustomFiles();

    if (selected) {
      currentMethod = null;
    }

    rebuildMethods();
  }

  /* =========================================================
     METHODS
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

      abbreviationData = file.data.slice();

      return;
    }

    if (typeof currentMethod.source !== "string") {
      throw new Error("No CSV file specified.");
    }

    const response = await fetch("text/" + currentMethod.source, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("CSV could not be loaded: HTTP " + response.status);
    }

    abbreviationData = parseCSV(await response.text());
  }

  function rebuildMethods(selectId = null) {
    if (!methodSelect) {
      return;
    }

    const previousId = selectId || currentMethod?.id || null;

    const allMethods = getAllMethods();

    methodSelect.replaceChildren();

    for (const method of allMethods) {
      if (!method?.id) {
        continue;
      }

      const option = document.createElement("option");

      option.value = method.id;
      option.textContent = method.name || method.id;

      methodSelect.appendChild(option);
    }

    if (!allMethods.length) {
      currentMethod = null;
      abbreviationData = [];

      populateLessons();
      rebuild();

      return;
    }

    const exists = allMethods.some((method) => method.id === previousId);

    methodSelect.value = exists ? previousId : allMethods[0].id;

    selectMethod();
  }

  /* =========================================================
     LESSONS
     ========================================================= */

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

    for (let i = 1; i <= getLessonCount(); i++) {
      const option = document.createElement("option");

      option.value = String(i);
      option.textContent = "Lesson " + i;

      lessonSelect.appendChild(option);
    }

    if (lessonSelect.options.length) {
      lessonSelect.value = String(
        Math.min(currentLesson, lessonSelect.options.length),
      );
    }
  }

  function getCurrentLessonValues() {
    if (isAbbreviationMethod()) {
      return getAvailableAbbreviations().map((entry) => entry.abbreviation);
    }

    return getAlphabet().slice(0, currentLesson);
  }

  /* =========================================================
     TRAINING GROUPS
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
     TIMING
     ========================================================= */

  function buildTimingSequence(groups) {
    const sequence = [];

    sequence.push({
      text: "VVV",
      type: "vvv",
      units: vvvUnits(),
    });

    sequence.push({
      text: "KA",
      type: "ka",
      units: kaUnits(),
    });

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

    sequence.push({
      text: "+",
      type: "plus",
      units: morseUnits("+"),
    });

    return sequence;
  }

  function getTotalUnits() {
    return currentTiming.reduce((total, item) => total + item.units, 0);
  }

  function getDuration() {
    return Math.max(1, getTotalUnits() * getDitMilliseconds());
  }

  /* =========================================================
     EXPECTED SEQUENCE
     ========================================================= */

  function buildExpectedSequence() {
    expectedCharacters = [];

    expectedCharacters.push("V");
    expectedCharacters.push("V");
    expectedCharacters.push("V");

    expectedCharacters.push("K");
    expectedCharacters.push("A");

    currentGroups.forEach((group) => {
      group.forEach((item) => {
        for (const character of Array.from(String(item))) {
          expectedCharacters.push(character);
        }
      });
    });

    typedSequence = expectedCharacters.map(() => null);

    processedCount = 0;
    currentExpectedIndex = 0;
  }

  /* =========================================================
     CHARACTER TIMING
     ========================================================= */

  function buildCharacterTiming() {
    const result = [];

    let currentUnits = 0;

    const vvv = ["V", "V", "V"];

    vvv.forEach((character, index) => {
      const units = morseUnits(character);

      result.push({
        index,
        character,
        startUnits: currentUnits,
        endUnits: currentUnits + units,
      });

      currentUnits += units;

      currentUnits += index < vvv.length - 1 ? CW_CHARACTER_GAP : CW_WORD_GAP;
    });

    const kaStart = currentUnits;

    const kUnits = morseUnits("K");
    const aUnits = morseUnits("A");

    result.push({
      index: 3,
      character: "K",
      startUnits: kaStart,
      endUnits: kaStart + kUnits,
    });

    result.push({
      index: 4,
      character: "A",
      startUnits: kaStart + kUnits,
      endUnits: kaStart + kUnits + aUnits,
    });

    currentUnits += kUnits + aUnits + CW_WORD_GAP;

    let globalIndex = 5;

    currentGroups.forEach((group) => {
      group.forEach((item) => {
        const characters = Array.from(String(item));

        characters.forEach((character, index) => {
          const units = morseUnits(character);

          result.push({
            index: globalIndex,
            character,
            startUnits: currentUnits,
            endUnits: currentUnits + units,
          });

          globalIndex++;

          currentUnits += units;

          currentUnits +=
            index < characters.length - 1 ? CW_CHARACTER_GAP : CW_WORD_GAP;
        });
      });
    });

    return result;
  }

  /* =========================================================
     TIME / PROGRESS
     ========================================================= */

  function getElapsedUnits() {
    const dit = getDitMilliseconds();

    if (!Number.isFinite(dit) || dit <= 0) {
      return 0;
    }

    return Math.max(0, elapsed / dit);
  }

  function getProcessedCountFromTime() {
    if (!characterTiming.length) {
      return 0;
    }

    const units = getElapsedUnits();

    let count = 0;

    for (const item of characterTiming) {
      if (units >= item.endUnits) {
        count = Math.max(count, item.index + 1);
      }
    }

    return Math.min(count, expectedCharacters.length);
  }

  function updateProcessedCount() {
    const calculated = getProcessedCountFromTime();

    if (calculated > processedCount) {
      processedCount = calculated;
    }

    if (currentExpectedIndex < processedCount) {
      currentExpectedIndex = processedCount;
    }

    updateSolution();
  }

  function getCurrentTypingIndex() {
    if (!characterTiming.length) {
      return -1;
    }

    const units = getElapsedUnits();

    for (const item of characterTiming) {
      if (
        units >= item.startUnits &&
        units < item.endUnits &&
        item.index < expectedCharacters.length
      ) {
        return item.index;
      }
    }

    return -1;
  }

  /* =========================================================
     KEYBOARD INPUT
     ========================================================= */

  function addMorseElement(element) {
    if (element !== "." && element !== "-") {
      return;
    }

    morseInput += element;
  }

  function finishMorseCharacter() {
    if (!morseInput) {
      return;
    }

    const character = MORSE_REVERSE[morseInput] || "?";

    addTypedCharacter(character);

    morseInput = "";
  }

  function finishKeyStroke() {
    if (!keyDownStarted) {
      return;
    }

    const durationMs = performance.now() - keyDownStarted;

    keyDownStarted = 0;
    keyDown = false;

    toneStop();

    const element = durationMs >= getDitMilliseconds() * 2 ? "-" : ".";

    addMorseElement(element);
  }

  function scheduleCharacterFinish() {
    if (characterTimer !== null) {
      clearTimeout(characterTimer);
    }

    characterTimer = window.setTimeout(() => {
      characterTimer = null;
      finishMorseCharacter();
    }, getDitMilliseconds() * 3);
  }

  function addTypedCharacter(character) {
    if (!running || paused) {
      return;
    }

    const index = getCurrentTypingIndex();

    if (index < 0 || index >= expectedCharacters.length) {
      return;
    }

    typedSequence[index] = String(character);

    currentExpectedIndex = Math.max(currentExpectedIndex, index + 1);

    updateSolution();
  }

  async function handleSpaceDown(event) {
    if (event.code !== "Space") {
      return;
    }

    event.preventDefault();

    if (event.repeat) {
      return;
    }

    if (event.ctrlKey) {
      if (keyDown) {
        finishKeyStroke();
      }

      togglePause();

      return;
    }

    if (!running) {
      await start();
    }

    if (!running || paused || keyDown) {
      return;
    }

    if (characterTimer !== null) {
      clearTimeout(characterTimer);

      characterTimer = null;
    }

    keyDown = true;
    keyDownStarted = performance.now();

    await toneStart();
  }

  function handleSpaceUp(event) {
    if (event.code !== "Space") {
      return;
    }

    event.preventDefault();

    if (event.ctrlKey || !keyDown) {
      return;
    }

    finishKeyStroke();
    scheduleCharacterFinish();
  }

  function handleControlX(event) {
    if (!event.ctrlKey || event.key.toLowerCase() !== "x") {
      return;
    }

    event.preventDefault();

    if (keyDown) {
      finishKeyStroke();
    }

    finishMorseCharacter();
    updateProcessedCount();

    stop();
    showSolution();
  }

  function handleWindowBlur() {
    if (keyDown) {
      finishKeyStroke();
    } else {
      toneStop();
    }
  }

  window.addEventListener("keydown", handleSpaceDown);

  window.addEventListener("keyup", handleSpaceUp);

  window.addEventListener("keydown", handleControlX);

  window.addEventListener("blur", handleWindowBlur);

  /* =========================================================
     SOLUTION
     ========================================================= */

  function ensureSolutionStyles() {
    if (document.getElementById("cwtype-solution-runtime-style")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "cwtype-solution-runtime-style";

    style.textContent = `
      .cwtype-solution {
        white-space: nowrap;
      }

      .cwtype-solution-character {
        display: inline-block;
        min-width: 0.72em;
        text-align: center;
        line-height: 1.1;
      }

      .cwtype-solution-character.wrong,
      .cwtype-solution-character.missing {
        color: #c00;
        text-decoration-line: underline;
        text-decoration-color: #c00;
        text-decoration-thickness: 2px;
        text-underline-offset: 3px;
      }

      .cwtype-solution-character-gap {
        display: inline-block;
        width: 0.32em;
      }

      .cwtype-solution-group-gap {
        display: inline-block;
        width: 0.9em;
      }
    `;

    document.head.appendChild(style);
  }

  function createSolutionCharacter(expected, typed) {
    const element = document.createElement("span");

    element.className = "cwtype-solution-character";

    if (typed === null || typed === undefined || typed === "") {
      element.textContent = "_";
      element.classList.add("missing");

      element.title = "Nicht getastet – erwartet: " + expected;

      return element;
    }

    element.textContent = String(typed);

    if (String(typed).toUpperCase() === String(expected).toUpperCase()) {
      return element;
    }

    element.classList.add("wrong");

    element.title = "Erwartet: " + expected;

    return element;
  }

  function createSolutionRange(startIndex, endIndex) {
    const container = document.createElement("span");

    for (let index = startIndex; index < endIndex; index++) {
      container.appendChild(
        createSolutionCharacter(
          expectedCharacters[index],
          typedSequence[index],
        ),
      );

      if (index < endIndex - 1) {
        const gap = document.createElement("span");

        gap.className = "cwtype-solution-character-gap";

        gap.textContent = " ";

        container.appendChild(gap);
      }
    }

    return container;
  }

  function getProcessedTrainingGroups() {
    const result = [];

    let globalIndex = 5;

    currentGroups.forEach((group, groupIndex) => {
      const groupStart = globalIndex;

      let count = 0;

      group.forEach((item) => {
        count += Array.from(String(item)).length;
      });

      const groupEnd = groupStart + count;

      if (processedCount > groupStart) {
        result.push({
          groupIndex,
          startIndex: groupStart,
          endIndex: Math.min(groupEnd, processedCount),
        });
      }

      globalIndex = groupEnd;
    });

    return result;
  }

  function updateSolution() {
    if (!solutionElement) {
      return;
    }

    solutionElement.replaceChildren();

    if (showSolutionButton?.dataset.active !== "true") {
      solutionElement.hidden = true;
      return;
    }

    solutionElement.hidden = false;

    if (processedCount <= 0) {
      return;
    }

    const fixedCount = Math.min(processedCount, 5);

    if (fixedCount > 0) {
      solutionElement.appendChild(createSolutionRange(0, fixedCount));
    }

    const groups = getProcessedTrainingGroups();

    if (fixedCount > 0 && groups.length > 0) {
      const gap = document.createElement("span");

      gap.className = "cwtype-solution-group-gap";

      gap.textContent = "   ";

      solutionElement.appendChild(gap);
    }

    groups.forEach((group, index) => {
      solutionElement.appendChild(
        createSolutionRange(group.startIndex, group.endIndex),
      );

      if (index < groups.length - 1) {
        const gap = document.createElement("span");

        gap.className = "cwtype-solution-group-gap";

        gap.textContent = "   ";

        solutionElement.appendChild(gap);
      }
    });
  }

  function showSolution() {
    if (!solutionElement) {
      return;
    }

    if (showSolutionButton) {
      showSolutionButton.dataset.active = "true";
    }

    updateSolution();
  }

  function toggleSolution() {
    if (!solutionElement) {
      return;
    }

    const active = showSolutionButton?.dataset.active === "true";

    if (active) {
      if (showSolutionButton) {
        showSolutionButton.dataset.active = "false";
      }

      solutionElement.hidden = true;

      return;
    }

    showSolution();
  }

  function resetSolution() {
    morseInput = "";

    if (characterTimer !== null) {
      clearTimeout(characterTimer);

      characterTimer = null;
    }

    processedCount = 0;
    currentExpectedIndex = 0;

    if (showSolutionButton) {
      showSolutionButton.dataset.active = "false";
    }

    if (solutionElement) {
      solutionElement.hidden = true;
      solutionElement.replaceChildren();
    }
  }

  /* =========================================================
     VISUAL TRACK
     ========================================================= */

  function createGroupElement(group) {
    const groupElement = document.createElement("span");

    groupElement.className = "cwtype-group";

    groupElement.style.display = "inline-flex";

    groupElement.style.alignItems = "center";

    groupElement.style.verticalAlign = "middle";

    groupElement.style.whiteSpace = "nowrap";

    groupElement.style.gap = "0.32em";

    group.forEach((item) => {
      const character = document.createElement("span");

      character.className = "cwtype-character";

      character.textContent = String(item);

      character.style.display = "inline-block";

      character.style.lineHeight = "1";

      character.title = isAbbreviationMethod() ? String(item) : "";

      groupElement.appendChild(character);
    });

    return groupElement;
  }

  function appendFixedGap(parent, className, width = "0.8em") {
    const gap = document.createElement("span");

    gap.className = className;

    gap.style.width = width;

    gap.style.flex = `0 0 ${width}`;

    parent.appendChild(gap);
  }

  function createTrack() {
    if (!track) {
      throw new Error("cwtype-track not found.");
    }

    track.replaceChildren();

    currentGroups = createTrainingGroups();

    currentTiming = buildTimingSequence(currentGroups);

    buildExpectedSequence();

    characterTiming = buildCharacterTiming();

    resetSolution();

    const line = document.createElement("div");

    line.className = "cwtype-line";

    line.style.position = "absolute";

    line.style.top = "50%";

    line.style.transform = "translateY(-50%)";

    line.style.display = "flex";

    line.style.alignItems = "center";

    line.style.whiteSpace = "nowrap";

    const vvv = document.createElement("span");

    vvv.className = "cwtype-vvv";

    vvv.textContent = "VVV";

    line.appendChild(vvv);

    appendFixedGap(line, "cwtype-gap cwtype-gap-vvv");

    const ka = document.createElement("span");

    ka.className = "cwtype-ka";

    ka.textContent = "KA";

    line.appendChild(ka);

    appendFixedGap(line, "cwtype-gap cwtype-gap-ka");

    currentGroups.forEach((group, index) => {
      line.appendChild(createGroupElement(group));

      if (index < currentGroups.length - 1) {
        appendFixedGap(line, "cwtype-group-gap", "0.9em");
      }
    });

    appendFixedGap(line, "cwtype-gap cwtype-gap-plus");

    const plus = document.createElement("span");

    plus.className = "cwtype-plus";

    plus.textContent = "+";

    line.appendChild(plus);

    track.appendChild(line);

    if (showSolutionButton) {
      showSolutionButton.disabled = expectedCharacters.length === 0;

      showSolutionButton.dataset.active = "false";
    }

    if (solutionElement) {
      solutionElement.hidden = true;
    }

    return line;
  }

  /* =========================================================
     POSITION
     ========================================================= */

  function layout(line) {
    if (!laufband || !marker) {
      return;
    }

    const band = laufband.getBoundingClientRect();

    const markerRect = marker.getBoundingClientRect();

    const markerX = markerRect.left - band.left + markerRect.width / 2;

    const width = line.getBoundingClientRect().width;

    startX = markerX;
    endX = markerX - width;
  }

  function setX(x) {
    const line = track?.querySelector(".cwtype-line");

    if (line) {
      line.style.left = `${x}px`;
    }
  }

  /* =========================================================
     ANIMATION
     ========================================================= */

  function stopAnimation() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);

      animationFrame = null;
    }
  }

  function animate(timestamp) {
    if (!running || paused) {
      return;
    }

    elapsed = timestamp - startTime;

    const progress = Math.min(1, elapsed / duration);

    const x = startX + (endX - startX) * progress;

    setX(x);

    updateProcessedCount();

    if (progress >= 1) {
      setX(endX);
      finish();
      return;
    }

    animationFrame = requestAnimationFrame(animate);
  }

  /* =========================================================
     BUTTONS
     ========================================================= */

  function updateButtons(active) {
    if (startButton) {
      startButton.disabled = active;
    }

    if (pauseButton) {
      pauseButton.disabled = !active;

      pauseButton.textContent = "⏸ Pause";
    }

    if (stopButton) {
      stopButton.disabled = !active;
    }
  }

  /* =========================================================
     REBUILD
     ========================================================= */

  function rebuild() {
    stopAnimation();

    running = false;
    paused = false;
    elapsed = 0;

    toneStop();

    if (keyDown) {
      finishKeyStroke();
    }

    finishMorseCharacter();

    if (!track) {
      return;
    }

    track.style.visibility = "hidden";

    try {
      const line = createTrack();

      requestAnimationFrame(() => {
        layout(line);

        setX(startX);

        duration = getDuration();

        track.style.visibility = "visible";

        updateButtons(false);
      });
    } catch (error) {
      console.error("CW Type rebuild error:", error);

      track.style.visibility = "visible";
    }
  }

  /* =========================================================
     START
     ========================================================= */

  async function start() {
    if (running) {
      return;
    }

    const audioReady = await ensureAudio();

    if (!audioReady) {
      console.warn("CW audio could not be started.");
    }

    stopAnimation();

    track.style.visibility = "hidden";

    try {
      const line = createTrack();

      requestAnimationFrame(() => {
        layout(line);

        duration = getDuration();

        elapsed = 0;

        processedCount = 0;
        currentExpectedIndex = 0;

        running = true;
        paused = false;

        setX(startX);

        startTime = performance.now();

        track.style.visibility = "visible";

        updateButtons(true);

        animationFrame = requestAnimationFrame(animate);
      });
    } catch (error) {
      console.error("CW Type start error:", error);

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
      updateProcessedCount();

      paused = true;

      toneStop();

      stopAnimation();

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

    animationFrame = requestAnimationFrame(animate);
  }

  /* =========================================================
     STOP
     ========================================================= */

  function stop() {
    if (running) {
      updateProcessedCount();
    }

    stopAnimation();

    running = false;
    paused = false;

    toneStop();

    if (keyDown) {
      finishKeyStroke();
    }

    finishMorseCharacter();

    elapsed = 0;

    setX(startX);

    updateButtons(false);

    updateSolution();
  }

  /* =========================================================
     FINISH
     ========================================================= */

  function finish() {
    processedCount = expectedCharacters.length;

    currentExpectedIndex = expectedCharacters.length;

    stopAnimation();

    running = false;
    paused = false;

    toneStop();

    setX(endX);

    if (keyDown) {
      finishKeyStroke();
    }

    finishMorseCharacter();

    updateButtons(false);

    updateSolution();
  }

  /* =========================================================
     METHOD / LESSON
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

    stop();

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

  showSolutionButton?.addEventListener("click", toggleSolution);

  window.addEventListener("resize", () => {
    if (!running) {
      rebuild();
    }
  });

  /* =========================================================
     INIT
     ========================================================= */

  async function init() {
    ensureSolutionStyles();

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

      if (showSolutionButton) {
        showSolutionButton.disabled = true;
      }
    }
  }

  init();
})();
