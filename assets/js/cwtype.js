"use strict";

/* ============================================================
     DOM
     ============================================================ */

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

/* ============================================================
     MORSE
     ============================================================ */

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

/* ============================================================
     CW TIMING
     ============================================================ */

const CW_DIT = 1;
const CW_DAH = 3;

const CW_ELEMENT_GAP = 1;
const CW_CHARACTER_GAP = 3;
const CW_WORD_GAP = 7;

const CHARACTER_VISUAL_WIDTH = 20;
const CHARACTER_VISUAL_GAP = 0;
const GROUP_VISUAL_GAP = 14;

/* ============================================================
     DATA / STATE
     ============================================================ */

let methods = [];
let customFiles = [];

let currentMethod = null;
let currentLesson = 1;
let abbreviationData = [];

let currentGroups = [];
let expectedCharacters = [];
let typedSequence = [];
let solutionWords = [];

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
let keyDownCharacterIndex = -1;

let characterTimer = null;
let ignoreSpaceKeyUp = false;

/* ============================================================
     SETTINGS
     ============================================================ */

function getWpm() {
  const value = Number(wpmInput?.value);

  return Number.isFinite(value) && value >= 1 ? value : 12;
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

/* ============================================================
     METHOD HELPERS
     ============================================================ */

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

/* ============================================================
     CSV
     ============================================================ */

function parseCSVLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index++;
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

  return lines.slice(1).reduce((result, line) => {
    const values = parseCSVLine(line);

    const abbreviation = values[0]?.trim() || "";
    const meaning = values[1]?.trim() || "";

    if (abbreviation) {
      result.push({
        abbreviation,
        meaning,
      });
    }

    return result;
  }, []);
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

/* ============================================================
     LESSONS
     ============================================================ */

function getLessonCount() {
  return isAbbreviationMethod()
    ? abbreviationData.length
    : getAlphabet().length;
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

  for (let index = 1; index <= count; index++) {
    const option = document.createElement("option");

    option.value = String(index);
    option.textContent = "Lesson " + index;

    lessonSelect.appendChild(option);
  }

  if (lessonSelect.options.length) {
    lessonSelect.value = String(
      Math.min(currentLesson, lessonSelect.options.length),
    );
  }
}

/* ============================================================
     TRAINING GROUPS
     ============================================================ */

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

/* ============================================================
     SOLUTION
     ============================================================ */

function buildSolutionWords() {
  const words = ["VVV", "KA"];

  if (isAbbreviationMethod()) {
    for (const group of currentGroups) {
      for (const item of group) {
        words.push(String(item));
      }
    }
  } else {
    for (const group of currentGroups) {
      words.push(group.map((item) => String(item)).join(""));
    }
  }

  words.push("+");

  return words;
}

function buildExpectedCharacters() {
  expectedCharacters = [];
  solutionWords = [];

  for (const word of buildSolutionWords()) {
    const text = String(word);
    const start = expectedCharacters.length;

    for (const character of Array.from(text)) {
      expectedCharacters.push(character);
    }

    solutionWords.push({
      start,
      end: expectedCharacters.length,
      text,
    });
  }

  typedSequence = expectedCharacters.map(() => null);

  currentTimelineIndex = -1;
  visibleCharacterCount = 0;
}

function getSolutionWordInfo(index) {
  for (let wordIndex = 0; wordIndex < solutionWords.length; wordIndex++) {
    const word = solutionWords[wordIndex];

    if (index >= word.start && index < word.end) {
      return {
        wordIndex,
        start: word.start,
        end: word.end,
        text: word.text,
        characterIndex: index - word.start,
        characterCount: word.end - word.start,
        isFirstCharacter: index === word.start,
        isLastCharacter: index === word.end - 1,
      };
    }
  }

  return {
    wordIndex: -1,
    start: -1,
    end: -1,
    text: "",
    characterIndex: -1,
    characterCount: 0,
    isFirstCharacter: false,
    isLastCharacter: false,
  };
}

/* ============================================================
     MORSE TIMELINE
     ============================================================ */

function morseUnits(character) {
  const code = MORSE[String(character).toUpperCase()];

  if (!code) {
    return 0;
  }

  let units = 0;

  for (let index = 0; index < code.length; index++) {
    units += code[index] === "-" ? CW_DAH : CW_DIT;

    if (index < code.length - 1) {
      units += CW_ELEMENT_GAP;
    }
  }

  return units;
}

function buildCharacterTimeline() {
  const timeline = [];
  let units = 0;

  expectedCharacters.forEach((character, index) => {
    const startUnits = units;
    const endUnits = startUnits + morseUnits(character);

    timeline.push({
      index,
      character,
      startUnits,
      endUnits,
    });

    units = endUnits;

    if (index === expectedCharacters.length - 1) {
      return;
    }

    const wordInfo = getSolutionWordInfo(index);

    units += wordInfo.isLastCharacter ? 7 : CW_CHARACTER_GAP;
  });

  characterTimeline = timeline;

  totalUnits = timeline.length ? timeline[timeline.length - 1].endUnits : 0;

  return timeline;
}

function buildVisualTimeline() {
  const timeline = [];
  let x = 0;

  expectedCharacters.forEach((character, index) => {
    if (index > 0) {
      const previousInfo = getSolutionWordInfo(index - 1);

      x += previousInfo.isLastCharacter
        ? GROUP_VISUAL_GAP
        : CHARACTER_VISUAL_GAP;
    }

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

/* ============================================================
     TIMELINE POSITION
     ============================================================ */

function getDuration() {
  return totalUnits ? Math.max(1, totalUnits * getDitMilliseconds()) : 1;
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

  for (let current = 0; current < characterTimeline.length; current++) {
    if (units >= characterTimeline[current].startUnits) {
      index = current;
    } else {
      break;
    }
  }

  return index;
}

function updateSynchronizedState() {
  const index = getSynchronizedCharacterIndex(getTimelinePosition());

  currentTimelineIndex = index;

  visibleCharacterCount =
    index < 0 ? 0 : Math.min(index + 1, expectedCharacters.length);
}

/* ============================================================
     SOLUTION DISPLAY
     ============================================================ */

function createSolutionCharacter(expected, typed, visible) {
  const element = document.createElement("span");

  element.className = "cwtype-solution-character";

  if (!visible) {
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
    container.appendChild(
      createSolutionCharacter(
        expectedCharacters[index],
        typedSequence[index],
        index < visibleCharacterCount,
      ),
    );

    if (index < endIndex - 1) {
      const gap = document.createElement("span");

      gap.className = "cwtype-solution-character-gap";

      container.appendChild(gap);
    }
  }

  return container;
}

function appendSolutionGroupGap() {
  const gap = document.createElement("span");

  gap.className = "cwtype-solution-group-gap";
  gap.textContent = " ";

  solutionElement.appendChild(gap);
}

function updateSolution() {
  if (!solutionElement) {
    return;
  }

  const active = showSolutionButton?.dataset.active === "true";

  if (!active) {
    solutionElement.hidden = true;
    return;
  }

  solutionElement.hidden = false;
  solutionElement.replaceChildren();

  if (!expectedCharacters.length || visibleCharacterCount <= 0) {
    return;
  }

  const visibleCount = Math.min(
    visibleCharacterCount,
    expectedCharacters.length,
  );

  solutionWords.forEach((word, wordIndex) => {
    if (visibleCount <= word.start) {
      return;
    }

    if (wordIndex > 0) {
      appendSolutionGroupGap();
    }

    const end = Math.min(visibleCount, word.end);

    if (end > word.start) {
      solutionElement.appendChild(createSolutionRange(word.start, end));
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
    showSolutionButton.dataset.active = "false";
    solutionElement.hidden = true;
    return;
  }

  showSolution();
}

function resetSolution() {
  morseInput = "";
  keyDownCharacterIndex = -1;

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

/* ============================================================
     TRACK
     ============================================================ */

function createCharacterElement(character, index) {
  const element = document.createElement("span");

  element.className = "cwtype-character";
  element.dataset.index = String(index);
  element.textContent = String(character);

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
  line.style.width = `${totalVisualWidth}px`;

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
    return visualTimeline[0].x + CHARACTER_VISUAL_WIDTH / 2;
  }

  const lastTimeline = characterTimeline[characterTimeline.length - 1];

  const lastVisual = visualTimeline[visualTimeline.length - 1];

  if (units >= lastTimeline.endUnits) {
    return lastVisual.x + CHARACTER_VISUAL_WIDTH / 2;
  }

  const index = getSynchronizedCharacterIndex(units);

  if (index < 0) {
    return visualTimeline[0].x + CHARACTER_VISUAL_WIDTH / 2;
  }

  const current = characterTimeline[index];
  const visualCurrent = visualTimeline[index];

  if (index >= characterTimeline.length - 1) {
    return visualCurrent.x + CHARACTER_VISUAL_WIDTH / 2;
  }

  const next = characterTimeline[index + 1];
  const visualNext = visualTimeline[index + 1];

  const interval = Math.max(0.0001, next.startUnits - current.startUnits);

  const progress = Math.max(
    0,
    Math.min(1, (units - current.startUnits) / interval),
  );

  const currentCenter = visualCurrent.x + CHARACTER_VISUAL_WIDTH / 2;

  const nextCenter = visualNext.x + CHARACTER_VISUAL_WIDTH / 2;

  return currentCenter + (nextCenter - currentCenter) * progress;
}

function setTrackPositionForUnits(units) {
  const line = track?.querySelector(".cwtype-line");

  if (!line) {
    return;
  }

  const visualX = getVisualXForUnits(units);

  line.style.left = markerX - visualX + "px";
}

function setTrackAtStart() {
  setTrackPositionForUnits(0);
}

function setTrackAtEnd() {
  setTrackPositionForUnits(totalUnits);
}

/* ============================================================
     ANIMATION
     ============================================================ */

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

  elapsed = Math.max(0, timestamp - startTime);

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

/* ============================================================
     AUDIO
     ============================================================ */

async function ensureAudio() {
  if (
    typeof INCWAudio === "undefined" ||
    typeof INCWAudio.start !== "function"
  ) {
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
  if (!(await ensureAudio())) {
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

/* ============================================================
     MORSE INPUT
     ============================================================ */

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

  const targetIndex =
    keyDownCharacterIndex >= 0 ? keyDownCharacterIndex : currentTimelineIndex;

  if (targetIndex >= 0 && targetIndex < expectedCharacters.length) {
    typedSequence[targetIndex] = character;

    visibleCharacterCount = Math.max(visibleCharacterCount, targetIndex + 1);

    currentTimelineIndex = Math.min(
      targetIndex + 1,
      expectedCharacters.length - 1,
    );
  }

  morseInput = "";
  keyDownCharacterIndex = -1;

  updateSolution();
}

function finishKeyStroke() {
  if (!keyDownStarted) {
    return;
  }

  const durationMs = performance.now() - keyDownStarted;

  keyDownStarted = 0;
  keyDown = false;

  toneStop();

  const element = durationMs >= getDitMilliseconds() * 3.5 ? "-" : ".";

  addMorseElement(element);
}

function scheduleCharacterFinish() {
  if (characterTimer !== null) {
    clearTimeout(characterTimer);
  }

  characterTimer = window.setTimeout(() => {
    characterTimer = null;
    finishMorseCharacter();
  }, getDitMilliseconds() * 1.5);
}

/* ============================================================
     KEYBOARD INPUT
     ============================================================ */

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

  updateSynchronizedState();

  keyDownCharacterIndex = currentTimelineIndex;

  if (
    keyDownCharacterIndex < 0 ||
    keyDownCharacterIndex >= expectedCharacters.length
  ) {
    keyDownCharacterIndex = -1;
    return;
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

/* ============================================================
     BUTTONS
     ============================================================ */

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

/* ============================================================
     TRAINING CONTROL
     ============================================================ */

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

      keyDownCharacterIndex = -1;
      morseInput = "";

      if (characterTimer !== null) {
        clearTimeout(characterTimer);
        characterTimer = null;
      }

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

/* ============================================================
     METHOD SELECTION
     ============================================================ */

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
  const method = getAllMethods().find((item) => item.id === methodSelect.value);

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

/* ============================================================
     CUSTOM FILES
     ============================================================ */

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

    const button = document.createElement("button");

    button.type = "button";
    button.className = "custom-file-remove";
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

  const id = "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2);

  customFiles.push({
    id,
    name: file.name.replace(/\.csv$/i, ""),
    data,
  });

  renderCustomFiles();
  rebuildMethods(id);
}

/* ============================================================
     EVENTS
     ============================================================ */

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

/* ============================================================
     INIT
     ============================================================ */

async function init() {
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
