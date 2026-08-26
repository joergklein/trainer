"use strict";

/* ============================================================
   CW TRAINER
   ============================================================ */

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
let currentMethod = null;
let currentLesson = 1;

let abbreviationData = [];

let customFiles = [];

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
   AUDIO STATE
   ============================================================ */

let audioContext = null;
let oscillator = null;
let gainNode = null;

const AUDIO_RAMP = 0.008;

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

function isCustomMethod() {
  return Boolean(currentMethod && currentMethod.type === "custom");
}

function isAbbreviationMethod() {
  return Boolean(
    currentMethod &&
    (currentMethod.type === "abbreviations" || currentMethod.type === "custom"),
  );
}

function getAlphabet() {
  if (!currentMethod) {
    return [];
  }

  if (typeof currentMethod.alphabet !== "string") {
    return [];
  }

  return Array.from(currentMethod.alphabet);
}

function getAvailableAbbreviations() {
  return abbreviationData.slice(0, currentLesson);
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

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    const requiredIndex = Math.max(abbreviationIndex, meaningIndex);

    if (values.length <= requiredIndex) {
      continue;
    }

    const abbreviation = values[abbreviationIndex].trim();

    const meaning = values[meaningIndex].trim();

    if (!abbreviation) {
      continue;
    }

    result.push({
      abbreviation,
      meaning,
    });
  }

  if (result.length === 0) {
    throw new Error("The CSV file contains no valid entries.");
  }

  return result;
}

/* ============================================================
   CUSTOM CSV FILES
   ============================================================ */

function getFileNameWithoutExtension(fileName) {
  return fileName.replace(/\.csv$/i, "");
}

function createCustomMethod(customFile) {
  return {
    id: customFile.id,
    name: customFile.name,
    type: "custom",
    customFileId: customFile.id,
  };
}

async function addCustomFile(file) {
  const text = await file.text();

  const data = parseCSV(text);

  const name = getFileNameWithoutExtension(file.name);

  const id = "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2);

  const customFile = {
    id,
    name,
    data,
  };

  customFiles.push(customFile);

  renderCustomFiles();

  rebuildMethods(id);

  setStatus(`"${name}" loaded successfully.`);
}

function removeCustomFile(id) {
  const selected = currentMethod && currentMethod.customFileId === id;

  if (running) {
    stopTraining();
  }

  customFiles = customFiles.filter((file) => file.id !== id);

  renderCustomFiles();

  if (selected) {
    currentMethod = null;
  }

  rebuildMethods();
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

    row.appendChild(name);
    row.appendChild(removeButton);

    customFilesElement.appendChild(row);
  }
}

/* ============================================================
   METHODS
   ============================================================ */

function rebuildMethods(selectId = null) {
  if (!methodSelect) {
    return;
  }

  const previousId = selectId || (currentMethod ? currentMethod.id : null);

  const allMethods = [...methods, ...customFiles.map(createCustomMethod)];

  methodSelect.innerHTML = "";

  for (const method of allMethods) {
    if (!method || !method.id) {
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

/* ============================================================
   LOAD ABBREVIATIONS
   ============================================================ */

async function loadAbbreviations() {
  abbreviationData = [];

  if (!isAbbreviationMethod()) {
    return;
  }

  if (isCustomMethod()) {
    const customFile = customFiles.find(
      (file) => file.id === currentMethod.customFileId,
    );

    if (!customFile) {
      throw new Error("Custom CSV file is no longer available.");
    }

    abbreviationData = customFile.data.slice();

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

  const text = await response.text();

  abbreviationData = parseCSV(text);
}

/* ============================================================
   LOAD INDEX
   ============================================================ */

async function loadIndex() {
  try {
    setStatus("Loading methods ...");

    const response = await fetch("text/index.json", {
      cache: "no-store",
    });

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
   SELECT METHOD
   ============================================================ */

async function selectMethod() {
  const allMethods = [...methods, ...customFiles.map(createCustomMethod)];

  currentMethod = allMethods.find((method) => method.id === methodSelect.value);

  if (!currentMethod) {
    return;
  }

  currentLesson = 1;

  resetTraining();

  try {
    await loadAbbreviations();
  } catch (error) {
    console.error(error);

    abbreviationData = [];

    setStatus("Error loading training set: " + error.message);

    populateLessons();
    updateCharacters();

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
  if (isAbbreviationMethod()) {
    return abbreviationData.length;
  }

  return getAlphabet().length;
}

function populateLessons() {
  lessonSelect.innerHTML = "";

  const count = getLessonCount();

  for (let i = 0; i < count; i++) {
    const option = document.createElement("option");

    option.value = String(i + 1);

    option.textContent = "Lesson " + (i + 1);

    lessonSelect.appendChild(option);
  }
}

function selectLesson() {
  const value = Number(lessonSelect.value);

  if (!Number.isFinite(value) || value < 1) {
    currentLesson = 1;
  } else {
    currentLesson = Math.min(Math.floor(value), getLessonCount());
  }

  resetTraining();
  updateCharacters();

  setStatus("Ready");
}

/* ============================================================
   DISPLAY
   ============================================================ */

function updateCharacters() {
  if (isAbbreviationMethod()) {
    const entries = getAvailableAbbreviations();

    charactersElement.textContent = entries
      .map((entry) => entry.abbreviation)
      .join(" ");

    return;
  }

  const alphabet = getAlphabet();

  charactersElement.textContent = alphabet.slice(0, currentLesson).join(" ");
}

/* ============================================================
   GROUP SETTINGS
   ============================================================ */

function getGroupSettings() {
  let groups = parseInt(groupsInput.value, 10);

  if (!Number.isFinite(groups) || groups < 1) {
    groups = 1;
  }

  let groupSize = parseInt(groupSizeInput.value, 10);

  if (!Number.isFinite(groupSize) || groupSize < 1) {
    groupSize = 5;
  }

  return {
    groups,
    groupSize,
  };
}

/* ============================================================
   CHARACTER SEQUENCE
   ============================================================ */

function createCharacterSequence() {
  const alphabet = getAlphabet();

  const available = alphabet.slice(0, currentLesson);

  if (available.length === 0) {
    return [];
  }

  const { groups, groupSize } = getGroupSettings();

  const sequence = [];

  for (let group = 0; group < groups; group++) {
    for (let i = 0; i < groupSize; i++) {
      const randomIndex = Math.floor(Math.random() * available.length);

      sequence.push(available[randomIndex]);
    }

    if (group < groups - 1) {
      sequence.push(" ");
    }
  }

  return sequence;
}

/* ============================================================
   ABBREVIATION SEQUENCE
   ============================================================ */

function createAbbreviationSequence() {
  const available = getAvailableAbbreviations();

  if (available.length === 0) {
    return [];
  }

  const { groups, groupSize } = getGroupSettings();

  const sequence = [];

  for (let group = 0; group < groups; group++) {
    for (let i = 0; i < groupSize; i++) {
      const randomIndex = Math.floor(Math.random() * available.length);

      sequence.push(available[randomIndex]);
    }

    if (group < groups - 1) {
      sequence.push(null);
    }
  }

  return sequence;
}

/* ============================================================
   TRAINING SEQUENCE
   ============================================================ */

function createTrainingSequence() {
  if (isAbbreviationMethod()) {
    return createAbbreviationSequence();
  }

  return createCharacterSequence();
}

/* ============================================================
   COUNT
   ============================================================ */

function countTrainingItems() {
  let count = 0;

  for (const item of trainingSequence) {
    if (isAbbreviationMethod()) {
      if (item !== null) {
        count++;
      }
    } else {
      if (item !== " ") {
        count++;
      }
    }
  }

  return count;
}

/* ============================================================
   SPEED
   ============================================================ */

function dotMilliseconds() {
  let wpm = Number(wpmInput.value);

  if (!Number.isFinite(wpm) || wpm < 1) {
    wpm = 12;
  }

  return 1200 / wpm;
}

/* ============================================================
   AUDIO
   ============================================================ */

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

  volume = Math.max(0, Math.min(100, volume));

  return volume / 100;
}

function initAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("Web Audio API is not supported by this browser.");
    }

    audioContext = new AudioContextClass();

    gainNode = audioContext.createGain();

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);

    gainNode.connect(audioContext.destination);

    oscillator = audioContext.createOscillator();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
      getToneFrequency(),
      audioContext.currentTime,
    );

    oscillator.connect(gainNode);

    /*
     * The oscillator is started ONCE.
     *
     * It is deliberately never stopped
     * during normal operation.
     */
    oscillator.start();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function silenceAudio() {
  if (!audioContext || !gainNode) {
    return;
  }

  const now = audioContext.currentTime;

  gainNode.gain.cancelScheduledValues(now);

  const current = gainNode.gain.value;

  gainNode.gain.setValueAtTime(current, now);

  gainNode.gain.linearRampToValueAtTime(0, now + AUDIO_RAMP);
}

function stopAudio() {
  /*
   * IMPORTANT:
   *
   * Never call:
   *
   * oscillator.stop()
   * oscillator.disconnect()
   *
   * here.
   *
   * The oscillator remains alive.
   */
  silenceAudio();
}

/* ============================================================
   MORSE AUDIO
   ============================================================ */

function sendCode(code, finished, trailingGap = CW_CHARACTER_GAP) {
  if (!running) {
    return;
  }

  if (paused) {
    timer = setTimeout(() => {
      sendCode(code, finished, trailingGap);
    }, 50);

    return;
  }

  if (!code) {
    finished();
    return;
  }

  initAudio();

  const unit = dotMilliseconds() / 1000;

  const volume = getVolume();

  const now = audioContext.currentTime;

  const ramp = Math.min(AUDIO_RAMP, unit / 8);

  gainNode.gain.cancelScheduledValues(now);

  gainNode.gain.setValueAtTime(0, now);

  let time = now;

  for (let i = 0; i < code.length; i++) {
    const symbol = code[i];

    const duration = symbol === "." ? unit * CW_DIT : unit * CW_DAH;

    gainNode.gain.setValueAtTime(0, time);

    gainNode.gain.linearRampToValueAtTime(volume, time + ramp);

    gainNode.gain.setValueAtTime(volume, time + duration - ramp);

    gainNode.gain.linearRampToValueAtTime(0, time + duration);

    time += duration;

    if (i < code.length - 1) {
      time += unit * CW_ELEMENT_GAP;
    }
  }

  time += unit * trailingGap;

  gainNode.gain.setValueAtTime(0, time);

  const milliseconds = (time - now) * 1000;

  timer = setTimeout(() => {
    timer = null;

    if (!running) {
      return;
    }

    finished();
  }, milliseconds);
}

function sendMorse(character, finished, trailingGap = CW_CHARACTER_GAP) {
  const key = String(character).toUpperCase();

  const code = MORSE[key];

  if (!code) {
    console.warn("No Morse code for:", character);

    finished();

    return;
  }

  sendCode(code, finished, trailingGap);
}

/* ============================================================
   ABBREVIATION AUDIO
   ============================================================ */

function sendAbbreviation(abbreviation, finished) {
  const characters = Array.from(String(abbreviation));

  if (characters.length === 0) {
    finished();
    return;
  }

  let index = 0;

  function sendNextCharacter() {
    if (!running) {
      return;
    }

    if (index >= characters.length) {
      finished();
      return;
    }

    const character = characters[index];

    index++;

    const isLast = index >= characters.length;

    const gap = isLast ? CW_WORD_GAP : CW_CHARACTER_GAP;

    sendMorse(character, sendNextCharacter, gap);
  }

  sendNextCharacter();
}

/* ============================================================
   VVV
   ============================================================ */

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

/* ============================================================
   KA
   ============================================================ */

function sendKA(finished) {
  sendCode(CW_BEGIN_PROSIGN, finished, CW_WORD_GAP);
}

/* ============================================================
   WAIT
   ============================================================ */

function waitUnits(units, finished) {
  if (!running) {
    return;
  }

  if (paused) {
    timer = setTimeout(() => {
      waitUnits(units, finished);
    }, 50);

    return;
  }

  timer = setTimeout(() => {
    timer = null;

    if (!running) {
      return;
    }

    finished();
  }, dotMilliseconds() * units);
}

/* ============================================================
   NORMAL TRAINING
   ============================================================ */

function sendNextCharacter() {
  if (!running) {
    return;
  }

  if (currentCharacter >= trainingSequence.length) {
    finishTraining();
    return;
  }

  const character = trainingSequence[currentCharacter];

  if (character === " ") {
    currentCharacter++;

    waitUnits(CW_WORD_GAP_EXTRA, sendNextCharacter);

    return;
  }

  currentCharacter++;

  playedSequence.push(character);

  updateProgress();

  sendMorse(character, sendNextCharacter, CW_CHARACTER_GAP);
}

/* ============================================================
   ABBREVIATION TRAINING
   ============================================================ */

function sendNextAbbreviation() {
  if (!running) {
    return;
  }

  if (currentCharacter >= trainingSequence.length) {
    finishTraining();
    return;
  }

  const entry = trainingSequence[currentCharacter];

  if (entry === null) {
    currentCharacter++;

    sendNextAbbreviation();

    return;
  }

  currentCharacter++;

  playedSequence.push(entry);

  updateProgress();

  sendAbbreviation(entry.abbreviation, sendNextAbbreviation);
}

/* ============================================================
   SEND NEXT
   ============================================================ */

function sendNext() {
  if (isAbbreviationMethod()) {
    sendNextAbbreviation();
  } else {
    sendNextCharacter();
  }
}

/* ============================================================
   SOLUTION
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

/* ============================================================
   START
   ============================================================ */

function startTraining() {
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
    initAudio();
  } catch (error) {
    console.error(error);

    setStatus(error.message);

    return;
  }

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

/* ============================================================
   PAUSE / RESUME
   ============================================================ */

function togglePause() {
  if (!running) {
    return;
  }

  paused = !paused;

  if (paused) {
    silenceAudio();

    pauseButton.textContent = "▶ Resume";

    setStatus("Paused");

    return;
  }

  pauseButton.textContent = "⏸ Pause";

  setStatus("Training");
}

/* ============================================================
   STOP
   ============================================================ */

function stopTraining() {
  running = false;
  paused = false;

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

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

/* ============================================================
   FINISH
   ============================================================ */

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

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

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

/* ============================================================
   SOLUTION
   ============================================================ */

function showSolution() {
  if (playedSequence.length === 0) {
    return;
  }

  solutionElement.hidden = !solutionElement.hidden;
}

/* ============================================================
   PROGRESS
   ============================================================ */

function updateProgress() {
  const total = countTrainingItems();

  const current = playedSequence.length;

  counterElement.textContent = current + " / " + total;

  const percentage = total > 0 ? (current / total) * 100 : 0;

  progressBar.style.width = percentage + "%";
}

/* ============================================================
   RESET
   ============================================================ */

function resetTraining() {
  running = false;
  paused = false;

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

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
   AUDIO CONTROLS
   ============================================================ */

volumeInput.addEventListener("input", () => {
  if (!audioContext || !gainNode) {
    return;
  }

  /*
   * Do not abruptly change the
   * current audio signal.
   *
   * Only update the volume for
   * the next Morse element.
   */
});

toneInput.addEventListener("input", () => {
  if (!audioContext || !oscillator) {
    return;
  }

  const now = audioContext.currentTime;

  const frequency = getToneFrequency();

  oscillator.frequency.cancelScheduledValues(now);

  oscillator.frequency.setValueAtTime(oscillator.frequency.value, now);

  oscillator.frequency.linearRampToValueAtTime(frequency, now + AUDIO_RAMP);
});

/* ============================================================
   CUSTOM CSV EVENT
   ============================================================ */

if (customFileInput) {
  customFileInput.addEventListener("change", async () => {
    const file = customFileInput.files && customFileInput.files[0];

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

/* ============================================================
   EVENTS
   ============================================================ */

methodSelect.addEventListener("change", () => {
  selectMethod();
});

lessonSelect.addEventListener("change", selectLesson);

startButton.addEventListener("click", startTraining);

pauseButton.addEventListener("click", togglePause);

stopButton.addEventListener("click", stopTraining);

solutionButton.addEventListener("click", showSolution);

/* ============================================================
   KEYBOARD
   ============================================================ */

document.addEventListener("keydown", (event) => {
  const active = document.activeElement;

  const tag = active ? active.tagName : "";

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
   START APPLICATION
   ============================================================ */

loadIndex();
