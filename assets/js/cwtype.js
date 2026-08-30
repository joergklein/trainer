"use strict";

(() => {
  /* =========================================================
     CW TYPE
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

  let currentGroups = [];
  let currentTiming = [];
  let expectedGroups = [];

  let typedGroups = [];
  let currentTypedGroup = 0;
  let currentTypedIndex = 0;

  let morseInput = "";

  /* =========================================================
     AUDIO
     ========================================================= */

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

    return Math.max(0, Math.min(100, value));
  }

  async function ensureAudio() {
    try {
      await INCWAudio.start();
      return true;
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

    INCWAudio.tone(
      getToneFrequency(),
      getDitMilliseconds() / 1000,
      getVolume() / 100,
    );
  }

  function toneStop() {
    INCWAudio.stop();
  }

  function updateTone() {
    // INCWAudio erzeugt jeden Ton mit der aktuell gewählten Frequenz.
  }

  function updateVolume() {
    // Lautstärke wird beim nächsten Ton aus dem Eingabefeld gelesen.
  }

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
    const code = "-.-.-";

    let units = 0;

    for (let i = 0; i < code.length; i++) {
      units += code[i] === "-" ? CW_DAH : CW_DIT;

      if (i < code.length - 1) {
        units += CW_ELEMENT_GAP;
      }
    }

    return units + CW_WORD_GAP;
  }

  function buildTimingSequence(groups) {
    const sequence = [
      {
        text: "VVV",
        type: "vvv",
        units: vvvUnits(),
      },
      {
        text: "KA",
        type: "ka",
        units: kaUnits(),
      },
    ];

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
     KEY INPUT
     ========================================================= */

  let keyDown = false;
  let keyDownStarted = 0;
  let characterTimer = null;

  function addMorseElement(element) {
    if (element === "." || element === "-") {
      morseInput += element;
    }
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

  function resetSolutionData() {
    typedGroups = [];
    currentTypedGroup = 0;
    currentTypedIndex = 0;
    morseInput = "";

    if (characterTimer !== null) {
      clearTimeout(characterTimer);
      characterTimer = null;
    }

    if (showSolutionButton) {
      showSolutionButton.dataset.active = "false";
    }

    if (solutionElement) {
      solutionElement.hidden = true;
    }

    updateSolution();
  }

  function addTypedCharacter(character) {
    if (currentTypedGroup >= expectedGroups.length) {
      return;
    }

    const expectedGroup = expectedGroups[currentTypedGroup];

    if (currentTypedIndex >= expectedGroup.length) {
      return;
    }

    if (!typedGroups[currentTypedGroup]) {
      typedGroups[currentTypedGroup] = [];
    }

    typedGroups[currentTypedGroup].push(character);

    currentTypedIndex++;

    if (currentTypedIndex >= expectedGroup.length) {
      currentTypedGroup++;
      currentTypedIndex = 0;
    }

    updateSolution();
  }

  function createSolutionGroup(typedGroup, expectedGroup) {
    const groupElement = document.createElement("span");

    groupElement.className = "cwtype-solution-group";

    typedGroup.forEach((typedCharacter, index) => {
      const expectedCharacter = expectedGroup[index];

      const characterElement = document.createElement("span");

      characterElement.className = "cwtype-solution-character";
      characterElement.textContent = typedCharacter;

      if (
        String(typedCharacter).toUpperCase() ===
        String(expectedCharacter).toUpperCase()
      ) {
        characterElement.classList.add("correct");
      } else {
        characterElement.classList.add("wrong");
        characterElement.title = "Expected: " + expectedCharacter;
      }

      groupElement.appendChild(characterElement);

      if (index < typedGroup.length - 1) {
        const gap = document.createElement("span");

        gap.className = "cwtype-solution-character-gap";
        gap.textContent = " ";

        groupElement.appendChild(gap);
      }
    });

    return groupElement;
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

    typedGroups.forEach((typedGroup, groupIndex) => {
      const expectedGroup = expectedGroups[groupIndex];

      if (!expectedGroup || !typedGroup?.length) {
        return;
      }

      solutionElement.appendChild(
        createSolutionGroup(typedGroup, expectedGroup),
      );

      if (groupIndex < typedGroups.length - 1) {
        const groupGap = document.createElement("span");

        groupGap.className = "cwtype-solution-group-gap";
        groupGap.textContent = "   ";

        solutionElement.appendChild(groupGap);
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

    solutionElement.hidden = false;
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
     TRAINING GROUPS
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
     VISUAL GROUP
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

      groupElement.appendChild(character);
    });

    return groupElement;
  }

  /* =========================================================
     TRACK
     ========================================================= */

  function createTrack() {
    track.replaceChildren();

    currentGroups = createTrainingGroups();

    expectedGroups = currentGroups.map((group) =>
      group.map((item) => String(item)),
    );

    resetSolutionData();

    currentTiming = buildTimingSequence(currentGroups);

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

    currentGroups.forEach((group, groupIndex) => {
      line.appendChild(createGroupElement(group));

      if (groupIndex < currentGroups.length - 1) {
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
      showSolutionButton.disabled = expectedGroups.length === 0;
      showSolutionButton.dataset.active = "false";
    }

    if (solutionElement) {
      solutionElement.hidden = true;
    }

    return line;
  }

  function appendFixedGap(parent, className, width = "0.8em") {
    const gap = document.createElement("span");

    gap.className = className;
    gap.style.width = width;
    gap.style.flex = `0 0 ${width}`;

    parent.appendChild(gap);
  }

  /* =========================================================
     POSITION
     ========================================================= */

  function layout(line) {
    const band = laufband.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();

    const markerX = markerRect.left - band.left + markerRect.width / 2;

    const width = line.getBoundingClientRect().width;

    startX = markerX;
    endX = markerX - width;
  }

  function setX(x) {
    const line = track.querySelector(".cwtype-line");

    if (line) {
      line.style.left = `${x}px`;
    }
  }

  /* =========================================================
     ANIMATION
     ========================================================= */

  let running = false;
  let paused = false;

  let animationFrame = null;
  let startTime = 0;
  let elapsed = 0;
  let duration = 1;

  let startX = 0;
  let endX = 0;

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

    toneStop();

    if (keyDown) {
      finishKeyStroke();
    }

    finishMorseCharacter();

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
      console.error(error);
      track.style.visibility = "visible";
    }
  }

  /* =========================================================
     BUTTON STATE
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
     START
     ========================================================= */

  async function start() {
    if (running) {
      return;
    }

    stopAnimation();

    if (!(await ensureAudio())) {
      console.warn("CW audio could not be initialized.");
    }

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

        updateButtons(true);

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
     STOP / FINISH
     ========================================================= */

  function stop() {
    stopAnimation();

    running = false;
    paused = false;
    elapsed = 0;

    toneStop();

    if (keyDown) {
      finishKeyStroke();
    }

    finishMorseCharacter();

    setX(startX);
    updateButtons(false);
  }

  function finish() {
    stopAnimation();

    running = false;
    paused = false;

    toneStop();
    setX(endX);

    finishMorseCharacter();
    updateButtons(false);
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

  toneInput?.addEventListener("input", updateTone);
  volumeInput?.addEventListener("input", updateVolume);

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
