"use strict";

(() => {
  /* =========================================================
     CW KEY TEST

     Quellen:
       1. Tastatur
          F = DIT
          J = DAH

       2. Mikrofon / 3.5 mm Eingang
          Pegel
          Threshold
          Hysteresis
          Debounce

     Keyer:
       Straight Key
       Iambic Mode A
       Iambic Mode B
     ========================================================= */

  /* =========================================================
     DOM
     ========================================================= */

  const modeSelect = document.getElementById("mode");

  const wpmInput = document.getElementById("wpm");

  const toneInput = document.getElementById("tone");

  const volumeInput = document.getElementById("volume");

  const debounceInput = document.getElementById("debounce");

  const thresholdInput = document.getElementById("threshold");

  const hysteresisInput = document.getElementById("hysteresis");

  const audioStartButton = document.getElementById("audio-start");

  const audioStopButton = document.getElementById("audio-stop");

  const ditIndicator = document.getElementById("dit-indicator");

  const dahIndicator = document.getElementById("dah-indicator");

  const status = document.getElementById("status");

  const keyOutput = document.getElementById("key-output");

  const eventLog = document.getElementById("event-log");

  const microphoneStatus = document.getElementById("microphone-status");

  const meterLevel = document.getElementById("meter-level");

  const meterThreshold = document.getElementById("meter-threshold");

  const meterOffThreshold = document.getElementById("meter-off-threshold");

  const levelValue = document.getElementById("level-value");

  const thresholdValue = document.getElementById("threshold-value");

  const offThresholdValue = document.getElementById("off-threshold-value");

  const signalState = document.getElementById("signal-state");

  /* =========================================================
     AUDIO
     ========================================================= */

  let audioContext = null;
  let oscillator = null;
  let gainNode = null;

  /* =========================================================
     MICROPHONE
     ========================================================= */

  let microphoneStream = null;
  let microphoneSource = null;
  let analyser = null;
  let meterFrame = null;

  /* =========================================================
     KEYBOARD STATE
     ========================================================= */

  let ditPressed = false;
  let dahPressed = false;

  /* =========================================================
     KEYER STATE
     ========================================================= */

  let keyerRunning = false;

  let keyerTimer = null;

  let currentElement = null;

  /*
   * true = nächstes Element soll DIT sein
   * false = nächstes Element soll DAH sein
   */
  let nextElement = "dit";

  /*
   * Bei Iambic B wird gespeichert,
   * ob während des aktuellen Elements
   * das Gegenelement gedrückt war.
   */
  let oppositeWasPressed = false;

  /*
   * Verhindert mehrfaches Starten.
   */
  let keyerGeneration = 0;

  /* =========================================================
     MICROPHONE SIGNAL
     ========================================================= */

  let signalOn = false;

  let pendingSignalState = null;

  let pendingSignalSince = 0;

  /* =========================================================
     LOG
     ========================================================= */

  function log(message) {
    if (!eventLog) {
      return;
    }

    const time = new Date().toLocaleTimeString();

    eventLog.textContent += `[${time}] ${message}\n`;

    eventLog.scrollTop = eventLog.scrollHeight;
  }

  /* =========================================================
     SETTINGS
     ========================================================= */

  function numberValue(element, fallback) {
    const value = Number(element?.value);

    return Number.isFinite(value) ? value : fallback;
  }

  function getWpm() {
    return Math.max(1, numberValue(wpmInput, 12));
  }

  function getTone() {
    return Math.max(100, numberValue(toneInput, 600));
  }

  function getVolume() {
    return Math.max(0, Math.min(1, numberValue(volumeInput, 30) / 100));
  }

  function getDebounce() {
    return Math.max(0, numberValue(debounceInput, 10));
  }

  function getThreshold() {
    return Math.max(0, Math.min(100, numberValue(thresholdInput, 30)));
  }

  function getHysteresis() {
    return Math.max(0, Math.min(50, numberValue(hysteresisInput, 5)));
  }

  function getOffThreshold() {
    return Math.max(0, getThreshold() - getHysteresis());
  }

  /*
   * Morse Standard:
   *
   * DIT = 1 Einheit
   * DAH = 3 Einheiten
   */
  function getDitTime() {
    return 1200 / getWpm();
  }

  /* =========================================================
     AUDIO
     ========================================================= */

  function createAudio() {
    if (audioContext) {
      return;
    }

    audioContext = new AudioContext();

    oscillator = audioContext.createOscillator();

    gainNode = audioContext.createGain();

    oscillator.type = "sine";

    oscillator.frequency.value = getTone();

    gainNode.gain.value = 0;

    oscillator.connect(gainNode);

    gainNode.connect(audioContext.destination);

    oscillator.start();
  }

  async function enableAudio() {
    try {
      createAudio();

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      await enableMicrophone();

      audioStartButton.disabled = true;

      audioStopButton.disabled = false;

      status.textContent = "Audio and microphone active";

      log("Audio enabled.");
    } catch (error) {
      console.error(error);

      status.textContent = "Audio / microphone unavailable";

      microphoneStatus.textContent = `${error.name}: ${error.message}`;

      log(`ERROR ${error.name}: ${error.message}`);
    }
  }

  function stopAudio() {
    stopKeyer();

    stopTone();

    stopMicrophone();

    if (meterFrame !== null) {
      cancelAnimationFrame(meterFrame);

      meterFrame = null;
    }

    if (audioContext) {
      audioContext.close();
    }

    audioContext = null;
    oscillator = null;
    gainNode = null;

    audioStartButton.disabled = false;

    audioStopButton.disabled = true;

    status.textContent = "Press Enable Audio";

    microphoneStatus.textContent = "Not connected";

    applySignalState(false, false);

    keyOutput.textContent = "Ready";

    log("Audio stopped.");
  }

  function startTone() {
    if (!audioContext || !gainNode) {
      return;
    }

    oscillator.frequency.setValueAtTime(getTone(), audioContext.currentTime);

    gainNode.gain.setTargetAtTime(getVolume(), audioContext.currentTime, 0.003);
  }

  function stopTone() {
    if (!audioContext || !gainNode) {
      return;
    }

    gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.003);
  }

  /* =========================================================
     MICROPHONE
     ========================================================= */

  async function enableMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Microphone access is not supported.");
    }

    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    analyser = audioContext.createAnalyser();

    analyser.fftSize = 1024;

    analyser.smoothingTimeConstant = 0.05;

    microphoneSource = audioContext.createMediaStreamSource(microphoneStream);

    microphoneSource.connect(analyser);

    microphoneStatus.textContent = "Connected";

    log("Microphone input connected.");

    startMeter();
  }

  function stopMicrophone() {
    if (microphoneStream) {
      microphoneStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    microphoneStream = null;
    microphoneSource = null;
    analyser = null;

    microphoneStatus.textContent = "Not connected";
  }

  /* =========================================================
     MICROPHONE LEVEL
     ========================================================= */

  function getMicrophoneLevel() {
    if (!analyser) {
      return 0;
    }

    const data = new Float32Array(analyser.fftSize);

    analyser.getFloatTimeDomainData(data);

    let sum = 0;

    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }

    const rms = Math.sqrt(sum / data.length);

    if (rms <= 0.000001) {
      return 0;
    }

    const db = 20 * Math.log10(rms);

    const level = ((db + 60) / 60) * 100;

    return Math.max(0, Math.min(100, level));
  }

  /* =========================================================
     METER
     ========================================================= */

  function updateMeter(level) {
    const threshold = getThreshold();

    const offThreshold = getOffThreshold();

    meterLevel.style.width = `${level}%`;

    meterThreshold.style.left = `${threshold}%`;

    meterOffThreshold.style.left = `${offThreshold}%`;

    levelValue.textContent = level.toFixed(1);

    thresholdValue.textContent = threshold.toFixed(1);

    offThresholdValue.textContent = offThreshold.toFixed(1);
  }

  /* =========================================================
     MICROPHONE DEBOUNCE + HYSTERESIS
     ========================================================= */

  function processMicrophoneSignal(level) {
    let requestedState = signalOn;

    const threshold = getThreshold();

    const offThreshold = getOffThreshold();

    /*
     * OFF -> ON
     */
    if (!signalOn) {
      if (level >= threshold) {
        requestedState = true;
      }
    } else {

    /*
     * ON -> OFF
     */
      if (level <= offThreshold) {
        requestedState = false;
      }
    }

    /*
     * Kein Zustandswechsel.
     */
    if (requestedState === signalOn) {
      pendingSignalState = null;

      return;
    }

    const now = performance.now();

    /*
     * Neuer Kandidat.
     */
    if (pendingSignalState !== requestedState) {
      pendingSignalState = requestedState;

      pendingSignalSince = now;

      return;
    }

    /*
     * Debounce-Zeit erreicht.
     */
    if (now - pendingSignalSince >= getDebounce()) {
      applySignalState(requestedState, true);

      pendingSignalState = null;
    }
  }

  /* =========================================================
     MICROPHONE KEY STATE
     ========================================================= */

  function applySignalState(on, fromMicrophone) {
    if (signalOn === on) {
      return;
    }

    signalOn = on;

    if (on) {
      startTone();

      signalState.textContent = "SIGNAL ON";

      signalState.classList.add("active");

      if (fromMicrophone) {
        log("MIC KEY DOWN");
      }
    } else {
      stopTone();

      signalState.textContent = "SIGNAL OFF";

      signalState.classList.remove("active");

      if (fromMicrophone) {
        log("MIC KEY UP");
      }
    }
  }

  /* =========================================================
     METER LOOP
     ========================================================= */

  function startMeter() {
    if (meterFrame !== null) {
      cancelAnimationFrame(meterFrame);
    }

    function loop() {
      const level = getMicrophoneLevel();

      updateMeter(level);

      processMicrophoneSignal(level);

      meterFrame = requestAnimationFrame(loop);
    }

    loop();
  }

  /* =========================================================
     KEYBOARD INDICATORS
     ========================================================= */

  function updateDitIndicator() {
    ditIndicator.classList.toggle("active", ditPressed);
  }

  function updateDahIndicator() {
    dahIndicator.classList.toggle("active", dahPressed);
  }

  /* =========================================================
     KEYBOARD EVENTS
     ========================================================= */

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (key !== "f" && key !== "j") {
      return;
    }

    event.preventDefault();

    if (event.repeat) {
      return;
    }

    if (key === "f") {
      ditPressed = true;

      updateDitIndicator();

      log("DIT paddle DOWN");
    }

    if (key === "j") {
      dahPressed = true;

      updateDahIndicator();

      log("DAH paddle DOWN");
    }

    handleKeyboardState();
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();

    if (key !== "f" && key !== "j") {
      return;
    }

    event.preventDefault();

    if (key === "f") {
      ditPressed = false;

      updateDitIndicator();

      log("DIT paddle UP");
    }

    if (key === "j") {
      dahPressed = false;

      updateDahIndicator();

      log("DAH paddle UP");
    }

    handleKeyboardState();
  });

  /* =========================================================
     KEYBOARD STATE
     ========================================================= */

  function handleKeyboardState() {
    const mode = modeSelect.value;

    if (mode === "straight") {
      handleStraightKey();

      return;
    }

    handleIambicKeyer();
  }

  /* =========================================================
     STRAIGHT KEY
     ========================================================= */

  function handleStraightKey() {
    if (ditPressed || dahPressed) {
      startTone();

      keyOutput.textContent = "KEY DOWN";
    } else {
      stopTone();

      keyOutput.textContent = "KEY UP";
    }
  }

  /* =========================================================
     IAMBIC INPUT
     ========================================================= */

  function handleIambicKeyer() {
    if (!keyerRunning && (ditPressed || dahPressed)) {
      startKeyer();

      return;
    }

    /*
     * Wenn beide Paddle während
     * eines laufenden Elements
     * gedrückt werden, merken wir
     * uns das Gegenelement.
     */

    if (keyerRunning && ditPressed && dahPressed) {
      if (currentElement === "dit") {
        oppositeWasPressed = true;
      }

      if (currentElement === "dah") {
        oppositeWasPressed = true;
      }
    }
  }

  /* =========================================================
     START IAMBIC KEYER
     ========================================================= */

  function startKeyer() {
    if (keyerRunning) {
      return;
    }

    keyerRunning = true;

    keyerGeneration++;

    oppositeWasPressed = false;

    /*
     * Wenn nur ein Paddle
     * gedrückt wurde, wird damit
     * gestartet.
     */

    if (ditPressed && !dahPressed) {
      nextElement = "dit";
    } else if (dahPressed && !ditPressed) {
      nextElement = "dah";
    } else {

    /*
     * Bei beiden Paddle beginnt
     * die normale Alternation mit DIT.
     */
      nextElement = "dit";
    }

    runKeyerElement(keyerGeneration);
  }

  /* =========================================================
     STOP IAMBIC KEYER
     ========================================================= */

  function stopKeyer() {
    keyerRunning = false;

    keyerGeneration++;

    if (keyerTimer !== null) {
      clearTimeout(keyerTimer);

      keyerTimer = null;
    }

    currentElement = null;

    oppositeWasPressed = false;

    stopTone();

    keyOutput.textContent = "KEY UP";
  }

  /* =========================================================
     SELECT NEXT ELEMENT
     ========================================================= */

  function selectNextElement() {
    /*
     * Beide Paddle:
     *
     * Immer alternieren.
     */

    if (ditPressed && dahPressed) {
      const result = nextElement;

      nextElement = result === "dit" ? "dah" : "dit";

      return result;
    }

    /*
     * Nur DIT.
     */

    if (ditPressed) {
      nextElement = "dah";

      return "dit";
    }

    /*
     * Nur DAH.
     */

    if (dahPressed) {
      nextElement = "dit";

      return "dah";
    }

    /*
     * Nichts gedrückt.
     */

    return null;
  }

  /* =========================================================
     RUN ELEMENT
     ========================================================= */

  function runKeyerElement(generation) {
    if (!keyerRunning || generation !== keyerGeneration) {
      return;
    }

    const element = selectNextElement();

    /*
     * Nichts gedrückt.
     */

    if (!element) {
      stopKeyer();

      return;
    }

    currentElement = element;

    oppositeWasPressed = false;

    /*
     * Prüfen, ob während dieses
     * Elements beide Paddle aktiv
     * sind.
     */

    if (ditPressed && dahPressed) {
      oppositeWasPressed = true;
    }

    const ditTime = getDitTime();

    const elementTime = element === "dit" ? ditTime : ditTime * 3;

    startTone();

    keyOutput.textContent = element === "dit" ? "DIT" : "DAH";

    log(`TX ${element.toUpperCase()}`);

    keyerTimer = setTimeout(() => {
      finishKeyerElement(generation, element);
    }, elementTime);
  }

  /* =========================================================
     FINISH ELEMENT
     ========================================================= */

  function finishKeyerElement(generation, element) {
    if (generation !== keyerGeneration) {
      return;
    }

    stopTone();

    keyerTimer = null;

    const mode = modeSelect.value;

    /*
     * -------------------------------------------------------
     * IAMBIC A
     * -------------------------------------------------------
     *
     * Wenn beide Paddle während
     * des Elements aktiv waren,
     * wurde das aktuelle Element
     * fertig gesendet.
     *
     * Danach wird nur weitergemacht,
     * wenn noch ein Paddle aktiv ist.
     *
     * Wird alles losgelassen,
     * endet der Keyer hier.
     */

    if (mode === "iambicA") {
      if (ditPressed || dahPressed) {
        runKeyerElement(generation);

        return;
      }

      stopKeyer();

      return;
    }

    /*
     * -------------------------------------------------------
     * IAMBIC B
     * -------------------------------------------------------
     *
     * Wenn während des Elements
     * das andere Paddle gedrückt war,
     * wird nach dem aktuellen Element
     * noch genau dieses Gegenelement
     * gesendet.
     */

    if (mode === "iambicB") {
      /*
       * Gegenelement vorhanden?
       */

      if (oppositeWasPressed) {
        /*
         * Das Paddle darf inzwischen
         * bereits losgelassen worden sein.
         *
         * Genau hier liegt der
         * wesentliche Unterschied
         * zu Mode A.
         */

        if (element === "dit") {
          nextElement = "dah";
        } else {
          nextElement = "dit";
        }

        /*
         * Das nächste Element wird
         * auch dann erzeugt, wenn
         * inzwischen beide Paddle
         * losgelassen wurden.
         */

        oppositeWasPressed = false;

        runKeyerElement(generation);

        return;
      }

      /*
       * Kein gespeichertes
       * Gegenelement.
       */

      if (ditPressed || dahPressed) {
        runKeyerElement(generation);

        return;
      }

      stopKeyer();

      return;
    }

    /*
     * Sicherheit.
     */

    stopKeyer();
  }

  /* =========================================================
     MODE CHANGE
     ========================================================= */

  modeSelect?.addEventListener("change", () => {
    stopKeyer();

    stopTone();

    keyOutput.textContent = "Ready";

    log(`MODE ${modeSelect.value}`);
  });

  /* =========================================================
     AUDIO SETTINGS
     ========================================================= */

  toneInput?.addEventListener("input", () => {
    if (oscillator && audioContext) {
      oscillator.frequency.setValueAtTime(getTone(), audioContext.currentTime);
    }
  });

  volumeInput?.addEventListener("input", () => {
    if (audioContext && gainNode) {
      if (signalOn) {
        startTone();
      }
    }
  });

  thresholdInput?.addEventListener("input", () => {
    updateMeter(getMicrophoneLevel());
  });

  hysteresisInput?.addEventListener("input", () => {
    updateMeter(getMicrophoneLevel());
  });

  debounceInput?.addEventListener("input", () => {
    log(`DEBOUNCE ${getDebounce()} ms`);
  });

  wpmInput?.addEventListener("input", () => {
    log(`WPM ${getWpm()}`);
  });

  /* =========================================================
     BUTTONS
     ========================================================= */

  audioStartButton?.addEventListener("click", enableAudio);

  audioStopButton?.addEventListener("click", stopAudio);

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  updateMeter(0);

  signalState.textContent = "SIGNAL OFF";

  keyOutput.textContent = "Ready";

  log("CW Key Test ready.");

  log("F = DIT, J = DAH.");

  log("Microphone input is monitored separately.");

  log("Straight Key, Iambic A and Iambic B available.");
})();
