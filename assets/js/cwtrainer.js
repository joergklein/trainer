"use strict";

/*
 * CW TRAINER
 * Audio: incwaudio.js
 * API: INCWAudio.start(), INCWAudio.tone(), INCWAudio.stop()
 */

/* ============================================================
   DOM
   ============================================================ */

const methodSelect = document.getElementById("method");
const lessonSelect = document.getElementById("lesson");
const charactersElement = document.getElementById("characters");

const groupsInput = document.getElementById("groups");
const groupSizeInput = document.getElementById("groupSize");
const wpmInput = document.getElementById("wpm");
const toneInput = document.getElementById("tone");
const volumeInput = document.getElementById("volume");

const startButton = document.getElementById("start");
const pauseButton = document.getElementById("pause");
const stopButton = document.getElementById("stop");

const statusElement = document.getElementById("status");
const progressBar = document.getElementById("progress-bar");
const counterElement = document.getElementById("counter");

const solutionButton = document.getElementById("show-solution");
const solutionElement = document.getElementById("solution");

const customFileInput = document.getElementById("custom-file");
const customFilesElement = document.getElementById("custom-files");

/* ============================================================
   DATA
   ============================================================ */

let methods = [];
let customFiles = [];

let currentMethod = null;
let currentLesson = 1;
let abbreviationData = [];

/* ============================================================
   TRAINING STATE
   ============================================================ */

let trainingSequence = [];
let playedSequence = [];

let currentCharacter = 0;
let running = false;
let paused = false;
let timer = null;

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

/* ============================================================
   CW TIMING
   ============================================================ */

const CW_DIT = 1;
const CW_DAH = 3;

const CW_ELEMENT_GAP = 1;
const CW_CHARACTER_GAP = 3;
const CW_WORD_GAP = 7;
const CW_WORD_GAP_EXTRA = CW_WORD_GAP - CW_CHARACTER_GAP;

const CW_BEGIN_PROSIGN = "-.-.-";
const CW_FINISH = "+";

/* ============================================================
   HELPERS
   ============================================================ */

function setStatus(text) {
  if (statusElement) {
    statusElement.textContent = text;
  }
}

function isAbbreviationMethod() {
  return (
    currentMethod &&
    (currentMethod.type === "abbreviations" || currentMethod.type === "custom")
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

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/* ============================================================
   CSV
   ============================================================ */

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
  const lines = text
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
  const requiredIndex = Math.max(abbreviationIndex, meaningIndex);

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    if (values.length <= requiredIndex) {
      continue;
    }

    const abbreviation = values[abbreviationIndex].trim();
    const meaning = values[meaningIndex].trim();

    if (!abbreviation) {
      continue;
    }

    result.push({ abbreviation, meaning });
  }

  if (result.length === 0) {
    throw new Error("The CSV file contains no valid entries.");
  }

  return result;
}

/* ============================================================
   CUSTOM FILES
   ============================================================ */

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

  customFilesElement.innerHTML = "";

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

  const id = "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2);

  customFiles.push({ id, name, data });

  renderCustomFiles();
  rebuildMethods(id);

  setStatus(`"${name}" loaded successfully.`);
}

function removeCustomFile(id) {
  if (running) {
    stopTraining();
  }

  const selected = currentMethod?.customFileId === id;

  customFiles = customFiles.filter((file) => file.id !== id);

  renderCustomFiles();

  if (selected) {
    currentMethod = null;
  }

  rebuildMethods();
}

/* ============================================================
   METHODS
   ============================================================ */

function rebuildMethods(selectId = null) {
  if (!methodSelect) {
    return;
  }

  const previousId = selectId || currentMethod?.id || null;

  const allMethods = getAllMethods();

  methodSelect.innerHTML = "";

  for (const method of allMethods) {
    if (!method?.id) {
      continue;
    }

    const option = document.createElement("option");
    option.value = method.id;
    option.textContent = method.name || method.id;

    methodSelect.appendChild(option);
  }

  if (allMethods.length === 0) {
    currentMethod = null;
    populateLessons();
    updateCharacters();
    return;
  }

  const exists = allMethods.some((method) => method.id === previousId);

  methodSelect.value = exists ? previousId : allMethods[0].id;

  selectMethod();
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

async function selectMethod() {
  const method = getAllMethods().find((item) => item.id === methodSelect.value);

  if (!method) {
    return;
  }

  currentMethod = method;
  currentLesson = 1;

  resetTraining();

  try {
    await loadAbbreviations();
  } catch (error) {
    console.error(error);
    abbreviationData = [];

    populateLessons();
    updateCharacters();

    setStatus("Error loading training set: " + error.message);

    return;
  }

  populateLessons();

  if (lessonSelect.options.length > 0) {
    lessonSelect.value = "1";
  }

  updateCharacters();
  setStatus("Ready");
}

/* ============================================================
   LESSONS
   ============================================================ */

function getLessonCount() {
  return isAbbreviationMethod()
    ? abbreviationData.length
    : getAlphabet().length;
}

function populateLessons() {
  if (!lessonSelect) {
    return;
  }

  lessonSelect.innerHTML = "";

  for (let i = 1; i <= getLessonCount(); i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = "Lesson " + i;

    lessonSelect.appendChild(option);
  }
}

function selectLesson() {
  const value = Number(lessonSelect.value);
  const count = getLessonCount();

  currentLesson =
    Number.isFinite(value) && value >= 1
      ? Math.min(Math.floor(value), count)
      : 1;

  resetTraining();
  updateCharacters();
  setStatus("Ready");
}

/* ============================================================
   DISPLAY
   ============================================================ */

function updateCharacters() {
  if (!charactersElement) {
    return;
  }

  if (isAbbreviationMethod()) {
    charactersElement.textContent = getAvailableAbbreviations()
      .map((entry) => entry.abbreviation)
      .join(" ");

    return;
  }

  charactersElement.textContent = getAlphabet()
    .slice(0, currentLesson)
    .join(" ");
}

/* ============================================================
   SETTINGS
   ============================================================ */

function getGroupSettings() {
  let groups = parseInt(groupsInput.value, 10);
  let groupSize = parseInt(groupSizeInput.value, 10);

  if (!Number.isFinite(groups) || groups < 1) {
    groups = 1;
  }

  if (!Number.isFinite(groupSize) || groupSize < 1) {
    groupSize = 5;
  }

  return { groups, groupSize };
}

function dotMilliseconds() {
  let wpm = Number(wpmInput.value);

  if (!Number.isFinite(wpm) || wpm < 1) {
    wpm = 12;
  }

  return 1200 / wpm;
}

function getToneFrequency() {
  let frequency = Number(toneInput.value);

  if (!Number.isFinite(frequency)) {
    frequency = 600;
  }

  return Math.max(100, Math.min(2000, frequency));
}

function getVolume() {
  let volume = Number(volumeInput.value);

  if (!Number.isFinite(volume)) {
    volume = 30;
  }

  return Math.max(0, Math.min(100, volume)) / 100;
}

/* ============================================================
   SEQUENCES
   ============================================================ */

function createCharacterSequence() {
  const available = getAlphabet().slice(0, currentLesson);

  if (available.length === 0) {
    return [];
  }

  const { groups, groupSize } = getGroupSettings();
  const sequence = [];

  for (let group = 0; group < groups; group++) {
    for (let i = 0; i < groupSize; i++) {
      const index = Math.floor(Math.random() * available.length);

      sequence.push(available[index]);
    }

    if (group < groups - 1) {
      sequence.push(" ");
    }
  }

  return sequence;
}

function createAbbreviationSequence() {
  const available = getAvailableAbbreviations();

  if (available.length === 0) {
    return [];
  }

  const { groups, groupSize } = getGroupSettings();
  const sequence = [];

  for (let group = 0; group < groups; group++) {
    for (let i = 0; i < groupSize; i++) {
      const index = Math.floor(Math.random() * available.length);

      sequence.push(available[index]);
    }

    if (group < groups - 1) {
      sequence.push(null);
    }
  }

  return sequence;
}

function createTrainingSequence() {
  return isAbbreviationMethod()
    ? createAbbreviationSequence()
    : createCharacterSequence();
}

function countTrainingItems() {
  return trainingSequence.filter((item) =>
    isAbbreviationMethod() ? item !== null : item !== " ",
  ).length;
}

/* ============================================================
   AUDIO
   ============================================================ */

async function startAudio() {
  if (typeof INCWAudio === "undefined") {
    throw new Error("incwaudio.js is not loaded.");
  }

  if (typeof INCWAudio.start !== "function") {
    throw new Error("INCWAudio.start() is not available.");
  }

  await INCWAudio.start();
}

function stopAudio() {
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

function playTone(duration, finished) {
  if (!running) {
    return;
  }

  if (paused) {
    timer = setTimeout(() => {
      timer = null;
      playTone(duration, finished);
    }, 50);

    return;
  }

  try {
    INCWAudio.tone(getToneFrequency(), duration / 1000, getVolume());
  } catch (error) {
    console.error(error);
    stopTraining();
    setStatus("Audio error: " + error.message);
    return;
  }

  timer = setTimeout(() => {
    timer = null;

    if (running) {
      finished();
    }
  }, duration);
}

/* ============================================================
   MORSE PLAYBACK
   ============================================================ */

function waitUnits(units, finished) {
  if (!running) {
    return;
  }

  if (paused) {
    timer = setTimeout(() => {
      timer = null;
      waitUnits(units, finished);
    }, 50);

    return;
  }

  timer = setTimeout(() => {
    timer = null;

    if (running) {
      finished();
    }
  }, dotMilliseconds() * units);
}

function sendCode(code, finished, trailingGap = CW_CHARACTER_GAP) {
  if (!running) {
    return;
  }

  if (paused) {
    timer = setTimeout(() => {
      timer = null;
      sendCode(code, finished, trailingGap);
    }, 50);

    return;
  }

  if (!code) {
    finished();
    return;
  }

  let index = 0;

  function nextElement() {
    if (!running) {
      return;
    }

    if (paused) {
      timer = setTimeout(() => {
        timer = null;
        nextElement();
      }, 50);

      return;
    }

    if (index >= code.length) {
      waitUnits(trailingGap, finished);
      return;
    }

    const symbol = code[index++];
    const duration = dotMilliseconds() * (symbol === "-" ? CW_DAH : CW_DIT);

    playTone(duration, () => {
      if (!running) {
        return;
      }

      if (index < code.length) {
        waitUnits(CW_ELEMENT_GAP, nextElement);
      } else {
        waitUnits(trailingGap, finished);
      }
    });
  }

  nextElement();
}

function sendMorse(character, finished, trailingGap = CW_CHARACTER_GAP) {
  const code = MORSE[String(character).toUpperCase()];

  if (!code) {
    console.warn("No Morse code for:", character);
    finished();
    return;
  }

  sendCode(code, finished, trailingGap);
}

function sendAbbreviation(abbreviation, finished) {
  const characters = Array.from(String(abbreviation));

  if (characters.length === 0) {
    finished();
    return;
  }

  let index = 0;

  function nextCharacter() {
    if (!running) {
      return;
    }

    if (paused) {
      timer = setTimeout(() => {
        timer = null;
        nextCharacter();
      }, 50);

      return;
    }

    if (index >= characters.length) {
      finished();
      return;
    }

    const character = characters[index++];
    const gap = index >= characters.length ? CW_WORD_GAP : CW_CHARACTER_GAP;

    sendMorse(character, nextCharacter, gap);
  }

  nextCharacter();
}

function sendVVV(finished) {
  sendMorse(
    "V",
    () => {
      sendMorse(
        "V",
        () => {
          sendMorse("V", finished, CW_WORD_GAP);
        },
        CW_CHARACTER_GAP,
      );
    },
    CW_CHARACTER_GAP,
  );
}

function sendKA(finished) {
  sendCode(CW_BEGIN_PROSIGN, finished, CW_WORD_GAP);
}

/* ============================================================
   TRAINING PLAYBACK
   ============================================================ */

function sendNextCharacter() {
  if (!running) {
    return;
  }

  if (currentCharacter >= trainingSequence.length) {
    finishTraining();
    return;
  }

  const character = trainingSequence[currentCharacter++];

  if (character === " ") {
    waitUnits(CW_WORD_GAP_EXTRA, sendNextCharacter);
    return;
  }

  playedSequence.push(character);
  updateProgress();

  sendMorse(character, sendNextCharacter, CW_CHARACTER_GAP);
}

function sendNextAbbreviation() {
  if (!running) {
    return;
  }

  if (currentCharacter >= trainingSequence.length) {
    finishTraining();
    return;
  }

  const entry = trainingSequence[currentCharacter++];

  if (entry === null) {
    sendNextAbbreviation();
    return;
  }

  playedSequence.push(entry);
  updateProgress();

  sendAbbreviation(entry.abbreviation, sendNextAbbreviation);
}

function sendNext() {
  if (isAbbreviationMethod()) {
    sendNextAbbreviation();
  } else {
    sendNextCharacter();
  }
}

/* ============================================================
   SOLUTION / PROGRESS
   ============================================================ */

function buildSolutionText() {
  if (playedSequence.length === 0) {
    return "";
  }

  if (isAbbreviationMethod()) {
    return playedSequence.map((item) => item.abbreviation).join(" ");
  }

  const { groupSize } = getGroupSettings();
  const groups = [];

  for (let i = 0; i < playedSequence.length; i += groupSize) {
    groups.push(playedSequence.slice(i, i + groupSize).join(""));
  }

  return groups.join(" ");
}

function updateProgress() {
  const total = countTrainingItems();
  const current = playedSequence.length;

  counterElement.textContent = current + " / " + total;

  progressBar.style.width = (total > 0 ? (current / total) * 100 : 0) + "%";
}

function showSolution() {
  if (playedSequence.length === 0) {
    return;
  }

  solutionElement.textContent = buildSolutionText();

  solutionElement.hidden = !solutionElement.hidden;
}

/* ============================================================
   TRAINING CONTROL
   ============================================================ */

async function startTraining() {
  if (!currentMethod) {
    setStatus("No training set selected.");
    return;
  }

  trainingSequence = createTrainingSequence();

  if (trainingSequence.length === 0) {
    setStatus("No training data available.");
    return;
  }

  try {
    await startAudio();
  } catch (error) {
    console.error(error);
    setStatus(error.message);
    return;
  }

  clearTimer();

  currentCharacter = 0;
  playedSequence = [];

  running = true;
  paused = false;

  solutionElement.textContent = "";
  solutionElement.hidden = true;
  solutionButton.disabled = true;

  progressBar.style.width = "0%";
  counterElement.textContent = "0 / " + countTrainingItems();

  startButton.disabled = true;
  pauseButton.disabled = false;
  stopButton.disabled = false;
  pauseButton.textContent = "⏸ Pause";

  setStatus("VVV");

  sendVVV(() => {
    if (!running) {
      return;
    }

    setStatus("KA");

    sendKA(() => {
      if (!running) {
        return;
      }

      setStatus("Training");
      sendNext();
    });
  });
}

function togglePause() {
  if (!running) {
    return;
  }

  if (!paused) {
    paused = true;
    clearTimer();
    stopAudio();

    pauseButton.textContent = "▶ Resume";
    setStatus("Paused");
    return;
  }

  paused = false;

  pauseButton.textContent = "⏸ Pause";
  setStatus("Training");

  sendNext();
}

function stopTraining() {
  running = false;
  paused = false;

  clearTimer();
  stopAudio();

  solutionElement.textContent = buildSolutionText();

  solutionElement.hidden = true;

  startButton.disabled = false;
  pauseButton.disabled = true;
  stopButton.disabled = true;

  pauseButton.textContent = "⏸ Pause";

  setStatus("Stopped");

  solutionButton.disabled = playedSequence.length === 0;
}

function finishTraining() {
  if (!running) {
    return;
  }

  setStatus("+");

  sendMorse(
    CW_FINISH,
    () => {
      if (!running) {
        return;
      }

      running = false;
      paused = false;

      clearTimer();
      stopAudio();

      startButton.disabled = false;
      pauseButton.disabled = true;
      stopButton.disabled = true;

      pauseButton.textContent = "⏸ Pause";

      progressBar.style.width = "100%";

      const total = countTrainingItems();

      counterElement.textContent = total + " / " + total;

      solutionElement.textContent = buildSolutionText();

      solutionElement.hidden = true;

      setStatus("Training finished");

      solutionButton.disabled = playedSequence.length === 0;
    },
    0,
  );
}

function resetTraining() {
  running = false;
  paused = false;

  clearTimer();
  stopAudio();

  trainingSequence = [];
  playedSequence = [];
  currentCharacter = 0;

  startButton.disabled = false;
  pauseButton.disabled = true;
  stopButton.disabled = true;

  pauseButton.textContent = "⏸ Pause";

  solutionButton.disabled = true;
  solutionElement.hidden = true;
  solutionElement.textContent = "";

  progressBar.style.width = "0%";
  counterElement.textContent = "0 / 0";
}

/* ============================================================
   LOAD APPLICATION
   ============================================================ */

async function loadIndex() {
  try {
    setStatus("Loading methods ...");

    const response = await fetch("text/index.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.methods)) {
      throw new Error("Invalid index.json.");
    }

    methods = data.methods;

    rebuildMethods();
    setStatus("Ready");
  } catch (error) {
    console.error(error);
    setStatus("Error loading: " + error.message);
  }
}

/* ============================================================
   EVENTS
   ============================================================ */

if (customFileInput) {
  customFileInput.addEventListener("change", async () => {
    const file = customFileInput.files?.[0];

    if (!file) {
      return;
    }

    try {
      setStatus("Loading " + file.name + " ...");

      await addCustomFile(file);
    } catch (error) {
      console.error(error);
      setStatus("Error loading CSV: " + error.message);
    }

    customFileInput.value = "";
  });
}

methodSelect?.addEventListener("change", selectMethod);

lessonSelect?.addEventListener("change", selectLesson);

startButton?.addEventListener("click", startTraining);

pauseButton?.addEventListener("click", togglePause);

stopButton?.addEventListener("click", stopTraining);

solutionButton?.addEventListener("click", showSolution);

/* ============================================================
   KEYBOARD
   ============================================================ */

document.addEventListener("keydown", (event) => {
  const tag = document.activeElement?.tagName || "";

  if (
    event.code === "Space" &&
    tag !== "INPUT" &&
    tag !== "SELECT" &&
    tag !== "BUTTON"
  ) {
    event.preventDefault();
    togglePause();
  }

  if (event.code === "Escape") {
    event.preventDefault();

    if (running) {
      stopTraining();
    }
  }
});

/* ============================================================
   START
   ============================================================ */

loadIndex();
