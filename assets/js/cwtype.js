"use strict";

(() => {
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

  const CW_DIT = 1;
  const CW_DAH = 3;
  const CW_ELEMENT_GAP = 1;
  const CW_CHARACTER_GAP = 3;
  const CW_WORD_GAP = 7;

  const CHARACTER_VISUAL_WIDTH = 24;
  const CHARACTER_VISUAL_GAP = 0;
  const GROUP_VISUAL_GAP = 24;

  let methods = [];
  let customFiles = [];
  let currentMethod = null;
  let currentLesson = 1;
  let abbreviationData = [];
  let currentGroups = [];
  let expectedCharacters = [];
  let typedSequence = [];

  let characterTimeline = [];
  let totalUnits = 0;
  let currentTimelineIndex = -1;
  let visibleCharacterCount = 0;

  let visualTimeline = [];
  let totalVisualWidth = 0;

  let running = false;
  let paused = false;
  let animationFrame = null;
  let startTime = 0;
  let elapsed = 0;
  let duration = 1;
  let markerX = 0;

  let morseInput = "";
  let keyDown = false;
  let keyDownStarted = 0;
  let characterTimer = null;
  let ignoreSpaceKeyUp = false;

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
      return 0.3;
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
      throw new Error("CSV enthält keine Daten.");
    }

    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const abbreviation = values[0]?.trim() || "";
      const meaning = values[1]?.trim() || "";

      if (abbreviation) {
        result.push({
          abbreviation,
          meaning,
        });
      }
    }

    return result;
  }

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
    if (typeof currentMethod?.alphabet !== "string") {
      return [];
    }

    return Array.from(currentMethod.alphabet);
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
        throw new Error("CSV-Datei nicht gefunden.");
      }

      abbreviationData = file.data.slice();
      return;
    }

    const response = await fetch("text/" + currentMethod.source, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("CSV konnte nicht geladen werden.");
    }

    abbreviationData = parseCSV(await response.text());
  }

  function getLessonCount() {
    if (isAbbreviationMethod()) {
      return abbreviationData.length;
    }

    return getAlphabet().length;
  }

  function getCurrentLessonValues() {
    if (isAbbreviationMethod()) {
      return abbreviationData
        .slice(0, currentLesson)
        .map((entry) => entry.abbreviation);
    }

    return getAlphabet().slice(0, currentLesson);
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

    if (lessonSelect.options.length) {
      lessonSelect.value = String(
        Math.min(currentLesson, lessonSelect.options.length),
      );
    }
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

  function buildExpectedCharacters() {
    const result = [];

    result.push("V");
    result.push("V");
    result.push("V");

    result.push("K");
    result.push("A");

    currentGroups.forEach((group) => {
      group.forEach((item) => {
        for (const character of Array.from(String(item))) {
          result.push(character);
        }
      });
    });

    result.push("+");

    expectedCharacters = result;
    typedSequence = expectedCharacters.map(() => null);
    currentTimelineIndex = -1;
    visibleCharacterCount = 0;
  }

  function getGroupCharacterInfo(globalIndex) {
    let index = 5;

    for (let groupIndex = 0; groupIndex < currentGroups.length; groupIndex++) {
      const group = currentGroups[groupIndex];

      for (let itemIndex = 0; itemIndex < group.length; itemIndex++) {
        const item = String(group[itemIndex]);
        const characters = Array.from(item);

        for (
          let characterIndex = 0;
          characterIndex < characters.length;
          characterIndex++
        ) {
          if (index === globalIndex) {
            return {
              groupIndex,
              itemIndex,
              characterIndex,
              itemLength: characters.length,
              isLastCharacterOfItem: characterIndex === characters.length - 1,
            };
          }

          index++;
        }
      }
    }

    return {
      groupIndex: -1,
      itemIndex: -1,
      characterIndex: -1,
      itemLength: 0,
      isLastCharacterOfItem: false,
    };
  }

  function buildCharacterTimeline() {
    const timeline = [];
    let units = 0;

    expectedCharacters.forEach((character, index) => {
      const startUnits = units;
      const characterLength = morseUnits(character);
      const endUnits = startUnits + characterLength;

      timeline.push({
        index,
        character,
        startUnits,
        endUnits,
      });

      units = endUnits;

      if (index === 2) {
        units += CW_WORD_GAP;
        return;
      }

      if (index === 4) {
        units += CW_WORD_GAP;
        return;
      }

      if (index >= 5 && index < expectedCharacters.length - 1) {
        const info = getGroupCharacterInfo(index);

        if (info.isLastCharacterOfItem) {
          units += CW_WORD_GAP;
        } else {
          units += CW_CHARACTER_GAP;
        }

        return;
      }

      if (index < expectedCharacters.length - 1) {
        units += CW_CHARACTER_GAP;
      }
    });

    characterTimeline = timeline;
    totalUnits = timeline.length ? timeline[timeline.length - 1].endUnits : 0;

    return timeline;
  }

  function buildVisualTimeline() {
    const timeline = [];
    let x = 0;

    expectedCharacters.forEach((character, index) => {
      let gapBefore = 0;

      if (index > 0) {
        if (index === 3) {
          gapBefore = GROUP_VISUAL_GAP;
        } else if (index === 5) {
          gapBefore = GROUP_VISUAL_GAP;
        } else if (index > 5 && isStartOfTrainingGroup(index)) {
          gapBefore = GROUP_VISUAL_GAP;
        } else {
          gapBefore = CHARACTER_VISUAL_GAP;
        }
      }

      x += gapBefore;

      timeline.push({
        index,
        character,
        x,
        width: CHARACTER_VISUAL_WIDTH,
      });

      x += CHARACTER_VISUAL_WIDTH;
    });

    visualTimeline = timeline;
    totalVisualWidth = Math.max(0, x);

    return timeline;
  }

  function isStartOfTrainingGroup(index) {
    if (index < 5 || index >= expectedCharacters.length - 1) {
      return false;
    }

    const info = getGroupCharacterInfo(index);

    return info.itemIndex === 0 && info.characterIndex === 0;
  }

  function getDuration() {
    if (!totalUnits) {
      return 1;
    }

    return Math.max(1, totalUnits * getDitMilliseconds());
  }

  function getElapsedUnits() {
    const dit = getDitMilliseconds();

    if (!Number.isFinite(dit) || dit <= 0) {
      return 0;
    }

    return Math.max(0, elapsed / dit);
  }

  function getTimelinePosition() {
    return Math.max(0, Math.min(totalUnits, getElapsedUnits()));
  }

  function getSynchronizedCharacterIndex(units) {
    if (!characterTimeline.length) {
      return -1;
    }

    let index = -1;

    for (let i = 0; i < characterTimeline.length; i++) {
      if (units >= characterTimeline[i].startUnits) {
        index = i;
      } else {
        break;
      }
    }

    return index;
  }

  function updateSynchronizedState() {
    const units = getTimelinePosition();
    const index = getSynchronizedCharacterIndex(units);

    currentTimelineIndex = index;

    if (index < 0) {
      visibleCharacterCount = 0;
      return;
    }

    visibleCharacterCount = Math.min(index + 1, expectedCharacters.length);
  }

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

      .cwtype-solution-character.correct {
        color: inherit;
        text-decoration: none;
      }

      .cwtype-solution-character.wrong,
      .cwtype-solution-character.missing {
        color: red;
        text-decoration-line: underline;
        text-decoration-color: red;
        text-decoration-thickness: 2px;
        text-underline-offset: 3px;
      }

      .cwtype-solution-character-gap {
        display: inline-block;
        width: 0;
      }

      .cwtype-solution-group-gap {
        display: inline-block;
        width: 1.35em;
      }
    `;

    document.head.appendChild(style);
  }

  function createSolutionCharacter(expected, typed, visible) {
    const element = document.createElement("span");

    element.className = "cwtype-solution-character";

    if (!visible) {
      element.textContent = "";
      return element;
    }

    if (typed === null || typed === "") {
      element.textContent = "_";
      element.classList.add("missing");
      element.title = "Erwartet: " + expected;
      return element;
    }

    element.textContent = String(typed);

    if (String(typed).toUpperCase() === String(expected).toUpperCase()) {
      element.classList.add("correct");
      return element;
    }

    element.classList.add("wrong");
    element.title = "Erwartet: " + expected;

    return element;
  }

  function createSolutionRange(startIndex, endIndex) {
    const container = document.createElement("span");

    for (let index = startIndex; index < endIndex; index++) {
      const expected = expectedCharacters[index];
      const typed = typedSequence[index];
      const visible = index < visibleCharacterCount;

      container.appendChild(createSolutionCharacter(expected, typed, visible));

      if (index < endIndex - 1) {
        const gap = document.createElement("span");

        gap.className = "cwtype-solution-character-gap";
        gap.textContent = "";

        container.appendChild(gap);
      }
    }

    return container;
  }

  function updateSolution() {
    if (!solutionElement) {
      return;
    }

    if (showSolutionButton?.dataset.active !== "true") {
      solutionElement.hidden = true;
      return;
    }

    solutionElement.hidden = false;
    solutionElement.replaceChildren();

    if (!expectedCharacters.length) {
      return;
    }

    const visibleCount = Math.min(
      visibleCharacterCount,
      expectedCharacters.length,
    );

    if (visibleCount <= 0) {
      return;
    }

    const vvvEnd = Math.min(visibleCount, 3);

    if (vvvEnd > 0) {
      solutionElement.appendChild(createSolutionRange(0, vvvEnd));
    }

    if (visibleCount > 3) {
      appendSolutionGroupGap();
    }

    if (visibleCount > 3) {
      const kaEnd = Math.min(visibleCount, 5);

      solutionElement.appendChild(createSolutionRange(3, kaEnd));
    }

    let globalIndex = 5;

    currentGroups.forEach((group) => {
      let characterCount = 0;

      group.forEach((item) => {
        characterCount += Array.from(String(item)).length;
      });

      const groupStart = globalIndex;
      const groupEnd = globalIndex + characterCount;

      globalIndex = groupEnd;

      if (visibleCount <= groupStart) {
        return;
      }

      appendSolutionGroupGap();

      const end = Math.min(visibleCount, groupEnd);

      solutionElement.appendChild(createSolutionRange(groupStart, end));
    });

    const plusIndex = expectedCharacters.length - 1;

    if (visibleCount > plusIndex) {
      appendSolutionGroupGap();

      solutionElement.appendChild(
        createSolutionRange(plusIndex, plusIndex + 1),
      );
    }
  }

  function appendSolutionGroupGap() {
    const gap = document.createElement("span");

    gap.className = "cwtype-solution-group-gap";
    gap.textContent = " ";

    solutionElement.appendChild(gap);
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

    currentTimelineIndex = -1;
    visibleCharacterCount = 0;
    typedSequence = expectedCharacters.map(() => null);

    if (showSolutionButton) {
      showSolutionButton.dataset.active = "false";
    }

    if (solutionElement) {
      solutionElement.hidden = true;
      solutionElement.replaceChildren();
    }
  }

  function createCharacterElement(character, index) {
    const element = document.createElement("span");

    element.className = "cwtype-character";
    element.dataset.index = String(index);
    element.textContent = String(character);

    element.style.position = "absolute";
    element.style.top = "50%";
    element.style.width = `${CHARACTER_VISUAL_WIDTH}px`;
    element.style.height = "1em";
    element.style.textAlign = "center";
    element.style.transform = "translateY(-50%)";
    element.style.lineHeight = "1";
    element.style.whiteSpace = "nowrap";

    return element;
  }

  function createTrack() {
    if (!track) {
      throw new Error("cwtype-track nicht gefunden.");
    }

    track.replaceChildren();

    currentGroups = createTrainingGroups();

    buildExpectedCharacters();
    buildCharacterTimeline();
    buildVisualTimeline();
    resetSolution();

    const line = document.createElement("div");

    line.className = "cwtype-line";
    line.style.position = "absolute";
    line.style.top = "0";
    line.style.left = "0";
    line.style.height = "100%";
    line.style.width = `${totalVisualWidth}px`;
    line.style.whiteSpace = "nowrap";

    visualTimeline.forEach((visualItem) => {
      const element = createCharacterElement(
        visualItem.character,
        visualItem.index,
      );

      element.style.left = `${visualItem.x}px`;
      line.appendChild(element);
    });

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

  function layout() {
    if (!laufband || !marker) {
      return;
    }

    const band = laufband.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();

    markerX = markerRect.left - band.left + markerRect.width / 2;
  }

  function getVisualXForUnits(units) {
    if (!characterTimeline.length || !visualTimeline.length) {
      return 0;
    }

    if (units <= characterTimeline[0].startUnits) {
      return visualTimeline[0].x;
    }

    const lastTimeline = characterTimeline[characterTimeline.length - 1];

    const lastVisual = visualTimeline[visualTimeline.length - 1];

    if (units >= lastTimeline.endUnits) {
      return lastVisual.x;
    }

    const index = getSynchronizedCharacterIndex(units);

    if (index < 0) {
      return visualTimeline[0].x;
    }

    const current = characterTimeline[index];
    const visualCurrent = visualTimeline[index];

    if (index >= characterTimeline.length - 1) {
      return visualCurrent.x;
    }

    const next = characterTimeline[index + 1];
    const visualNext = visualTimeline[index + 1];

    const interval = Math.max(0.0001, next.startUnits - current.startUnits);

    const progress = Math.max(
      0,
      Math.min(1, (units - current.startUnits) / interval),
    );

    return visualCurrent.x + (visualNext.x - visualCurrent.x) * progress;
  }

  function setTrackPositionForUnits(units) {
    const line = track?.querySelector(".cwtype-line");

    if (!line) {
      return;
    }

    const visualX = getVisualXForUnits(units);
    const x = markerX - visualX - CHARACTER_VISUAL_WIDTH / 2;

    line.style.left = `${x}px`;
  }

  function setTrackAtStart() {
    setTrackPositionForUnits(0);
  }

  function setTrackAtEnd() {
    setTrackPositionForUnits(totalUnits);
  }

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

    if (elapsed < 0) {
      elapsed = 0;
    }

    if (elapsed >= duration) {
      elapsed = duration;

      setTrackAtEnd();

      currentTimelineIndex = expectedCharacters.length - 1;

      visibleCharacterCount = expectedCharacters.length;

      updateSolution();
      finish();

      return;
    }

    const units = getTimelinePosition();

    setTrackPositionForUnits(units);
    updateSynchronizedState();
    updateSolution();

    animationFrame = requestAnimationFrame(animate);
  }

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
      console.error("Audio:", error);
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

    const index = currentTimelineIndex;

    if (index < 0 || index >= expectedCharacters.length) {
      return;
    }

    if (typedSequence[index] !== null) {
      return;
    }

    typedSequence[index] = String(character);

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
      ignoreSpaceKeyUp = true;

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

    if (ignoreSpaceKeyUp) {
      ignoreSpaceKeyUp = false;
      return;
    }

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
    updateSynchronizedState();

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

  function updateButtons(active) {
    if (startButton) {
      startButton.disabled = active;
    }

    if (pauseButton) {
      pauseButton.disabled = !active;
      pauseButton.textContent = paused ? "▶ Resume" : "⏸ Pause";
    }

    if (stopButton) {
      stopButton.disabled = !active;
    }
  }

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
      createTrack();

      requestAnimationFrame(() => {
        layout();
        setTrackAtStart();

        duration = getDuration();

        track.style.visibility = "visible";
        updateButtons(false);
      });
    } catch (error) {
      console.error("CW rebuild:", error);
      track.style.visibility = "visible";
    }
  }

  async function start() {
    if (running) {
      return;
    }

    await ensureAudio();

    stopAnimation();

    track.style.visibility = "hidden";

    try {
      createTrack();

      requestAnimationFrame(() => {
        layout();

        duration = getDuration();
        elapsed = 0;

        currentTimelineIndex = -1;
        visibleCharacterCount = 0;

        typedSequence = expectedCharacters.map(() => null);

        running = true;
        paused = false;

        setTrackAtStart();

        startTime = performance.now();

        track.style.visibility = "visible";

        updateButtons(true);
        updateSynchronizedState();
        updateSolution();

        animationFrame = requestAnimationFrame(animate);
      });
    } catch (error) {
      console.error("CW start:", error);
      track.style.visibility = "visible";
    }
  }

  function togglePause() {
    if (!running) {
      return;
    }

    if (!paused) {
      elapsed = Math.max(0, Math.min(duration, performance.now() - startTime));

      updateSynchronizedState();
      setTrackPositionForUnits(getTimelinePosition());

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

  function stop() {
    if (running) {
      elapsed = Math.max(0, Math.min(duration, performance.now() - startTime));

      updateSynchronizedState();
      setTrackPositionForUnits(getTimelinePosition());
    }

    stopAnimation();

    running = false;
    paused = false;

    toneStop();

    if (keyDown) {
      finishKeyStroke();
    }

    finishMorseCharacter();

    updateSynchronizedState();
    updateSolution();
    updateButtons(false);
  }

  function finish() {
    elapsed = duration;

    currentTimelineIndex = expectedCharacters.length - 1;

    visibleCharacterCount = expectedCharacters.length;

    stopAnimation();

    running = false;
    paused = false;

    toneStop();
    setTrackAtEnd();

    if (keyDown) {
      finishKeyStroke();
    }

    finishMorseCharacter();

    updateButtons(false);
    updateSolution();
  }

  function rebuildMethods(selectId = null) {
    if (!methodSelect) {
      return;
    }

    const allMethods = getAllMethods();
    const previousId = selectId || currentMethod?.id || null;

    methodSelect.replaceChildren();

    allMethods.forEach((method) => {
      const option = document.createElement("option");

      option.value = method.id;
      option.textContent = method.name || method.id;

      methodSelect.appendChild(option);
    });

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
    }

    populateLessons();

    if (lessonSelect?.options.length) {
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

  function renderCustomFiles() {
    if (!customFilesElement) {
      return;
    }

    customFilesElement.replaceChildren();

    customFiles.forEach((file) => {
      const row = document.createElement("div");
      const name = document.createElement("span");
      const button = document.createElement("button");

      name.textContent = file.name;

      button.type = "button";
      button.textContent = "Remove";

      button.addEventListener("click", () => {
        customFiles = customFiles.filter((item) => item.id !== file.id);

        renderCustomFiles();
        rebuildMethods();
      });

      row.append(name, button);
      customFilesElement.appendChild(row);
    });
  }

  async function addCustomFile(file) {
    const data = parseCSV(await file.text());

    const id =
      "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2);

    customFiles.push({
      id,
      name: file.name.replace(/\.csv$/i, ""),
      data,
    });

    renderCustomFiles();
    rebuildMethods(id);
  }

  window.addEventListener("keydown", handleSpaceDown);

  window.addEventListener("keyup", handleSpaceUp);

  window.addEventListener("keydown", handleControlX);

  window.addEventListener("blur", handleWindowBlur);

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

  customFileInput?.addEventListener("change", async () => {
    const file = customFileInput.files?.[0];

    if (!file) {
      return;
    }

    try {
      await addCustomFile(file);
    } catch (error) {
      console.error("CSV:", error);
    }

    customFileInput.value = "";
  });

  window.addEventListener("resize", () => {
    if (!running) {
      rebuild();
    }
  });

  async function init() {
    ensureSolutionStyles();

    try {
      const response = await fetch("text/index.json", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("text/index.json konnte nicht geladen werden.");
      }

      const data = await response.json();

      methods = Array.isArray(data.methods) ? data.methods.slice() : [];

      rebuildMethods();
    } catch (error) {
      console.error("CW Type Init:", error);

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
