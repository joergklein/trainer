"use strict";

(() => {
  const modeSelect = document.getElementById("mode");
  const modeDescription = document.getElementById("mode-description");
  const inputSourceSelect = document.getElementById("input-source");
  const audioDeviceSelect = document.getElementById("audio-device");
  const paddleReverseInput = document.getElementById("paddle-reverse");

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

  const MODE_DESCRIPTIONS = {
    straight:
      "Straight Key: The tone remains active as long as the key is pressed or the input is active.",

    iambicA:
      "Iambic Mode A: DIT and DAH are generated automatically using a dual paddle.",

    iambicB:
      "Iambic Mode B: Like Mode A, with an additional opposite element when requested.",

    bug: "Vibroplex Bug: DAH is manually keyed. DIT generates an automatic stream of dots.",

    sideswiper:
      "Sideswiper / Cootie: A single lever alternates between DIT and DAH.",
  };

  let audioContext = null;
  let oscillator = null;
  let gainNode = null;

  let microphoneStream = null;
  let microphoneSource = null;
  let analyser = null;
  let meterFrame = null;

  let keyboardDitPressed = false;
  let keyboardDahPressed = false;
  let microphoneKeyPressed = false;

  let ditPressed = false;
  let dahPressed = false;

  let keyerRunning = false;
  let keyerTimer = null;
  let keyerGeneration = 0;

  let currentElement = null;
  let nextElement = "dit";
  let oppositeWasPressed = false;

  let bugRunning = false;
  let bugTimer = null;
  let bugGeneration = 0;

  let sideswiperRunning = false;
  let sideswiperTimer = null;
  let sideswiperLastElement = "dah";

  let signalOn = false;
  let pendingSignalState = null;
  let pendingSignalSince = 0;

  function log(message) {
    if (!eventLog) {
      return;
    }

    const time = new Date().toLocaleTimeString();

    eventLog.textContent += `[${time}] ${message}\n`;
    eventLog.scrollTop = eventLog.scrollHeight;
  }

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

  function getDitTime() {
    return 1200 / getWpm();
  }

  function createAudio() {
    if (audioContext) {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("Web Audio API is not supported.");
    }

    audioContext = new AudioContextClass();

    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = getTone();

    gainNode.gain.value = 0;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();

    log(`Audio context created: ${audioContext.state}`);
  }

  async function enableAudio() {
    try {
      createAudio();

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      if (audioContext.state !== "running") {
        throw new Error(
          `Audio context could not be started: ${audioContext.state}`,
        );
      }

      if (audioStartButton) {
        audioStartButton.disabled = true;
      }

      if (audioStopButton) {
        audioStopButton.disabled = false;
      }

      if (status) {
        status.textContent = "Audio active";
      }

      log(`Audio active: ${getTone()} Hz`);

      try {
        await enableMicrophone();

        if (status) {
          status.textContent = "Audio and microphone active";
        }
      } catch (error) {
        console.warn("Microphone:", error);

        if (microphoneStatus) {
          microphoneStatus.textContent = `${error.name}: ${error.message}`;
        }

        log(`MIC ERROR ${error.name}: ${error.message}`);
      }
    } catch (error) {
      console.error("Audio:", error);

      if (status) {
        status.textContent = "Audio unavailable";
      }

      log(`AUDIO ERROR ${error.name}: ${error.message}`);
    }
  }

  function stopAudio() {
    stopAllKeyers();
    stopTone();
    stopMicrophone();

    if (meterFrame !== null) {
      cancelAnimationFrame(meterFrame);
      meterFrame = null;
    }

    if (audioContext) {
      try {
        audioContext.close();
      } catch (error) {
        console.warn(error);
      }
    }

    audioContext = null;
    oscillator = null;
    gainNode = null;

    signalOn = false;
    microphoneKeyPressed = false;
    pendingSignalState = null;

    ditPressed = false;
    dahPressed = false;

    updateIndicators();

    if (signalState) {
      signalState.textContent = "SIGNAL OFF";
      signalState.classList.remove("active");
    }

    if (audioStartButton) {
      audioStartButton.disabled = false;
    }

    if (audioStopButton) {
      audioStopButton.disabled = true;
    }

    if (status) {
      status.textContent = "Press Enable Audio";
    }

    if (microphoneStatus) {
      microphoneStatus.textContent = "Not connected";
    }

    if (keyOutput) {
      keyOutput.textContent = "Ready";
    }

    log("Audio stopped.");
  }

  function startTone() {
    if (!audioContext || !oscillator || !gainNode) {
      return;
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    oscillator.frequency.setValueAtTime(getTone(), audioContext.currentTime);

    gainNode.gain.cancelScheduledValues(audioContext.currentTime);

    gainNode.gain.setValueAtTime(getVolume(), audioContext.currentTime);
  }

  function stopTone() {
    if (!audioContext || !gainNode) {
      return;
    }

    gainNode.gain.cancelScheduledValues(audioContext.currentTime);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  }

  async function enableMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Microphone access is not supported.");
    }

    const constraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };

    if (audioDeviceSelect?.value) {
      constraints.audio.deviceId = {
        exact: audioDeviceSelect.value,
      };
    }

    microphoneStream = await navigator.mediaDevices.getUserMedia(constraints);

    analyser = audioContext.createAnalyser();

    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.05;

    microphoneSource = audioContext.createMediaStreamSource(microphoneStream);

    microphoneSource.connect(analyser);

    if (microphoneStatus) {
      microphoneStatus.textContent = "Connected";
    }

    log("Microphone connected.");

    await enumerateAudioDevices();

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
    microphoneKeyPressed = false;

    if (microphoneStatus) {
      microphoneStatus.textContent = "Not connected";
    }
  }

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

  function updateMeter(level) {
    const threshold = getThreshold();
    const offThreshold = getOffThreshold();

    if (meterLevel) {
      meterLevel.style.width = `${level}%`;
    }

    if (meterThreshold) {
      meterThreshold.style.left = `${threshold}%`;
    }

    if (meterOffThreshold) {
      meterOffThreshold.style.left = `${offThreshold}%`;
    }

    if (levelValue) {
      levelValue.textContent = level.toFixed(1);
    }

    if (thresholdValue) {
      thresholdValue.textContent = threshold.toFixed(1);
    }

    if (offThresholdValue) {
      offThresholdValue.textContent = offThreshold.toFixed(1);
    }
  }

  function processMicrophoneSignal(level) {
    let requestedState = signalOn;

    const threshold = getThreshold();
    const offThreshold = getOffThreshold();

    if (!signalOn) {
      if (level >= threshold) {
        requestedState = true;
      }
    } else if (level <= offThreshold) {
      requestedState = false;
    }

    if (requestedState === signalOn) {
      pendingSignalState = null;
      return;
    }

    const now = performance.now();

    if (pendingSignalState !== requestedState) {
      pendingSignalState = requestedState;
      pendingSignalSince = now;
      return;
    }

    if (now - pendingSignalSince >= getDebounce()) {
      applySignalState(requestedState);
      pendingSignalState = null;
    }
  }

  function applySignalState(on) {
    if (signalOn === on) {
      return;
    }

    signalOn = on;
    microphoneKeyPressed = on;

    if (signalState) {
      signalState.textContent = on ? "SIGNAL ON" : "SIGNAL OFF";
      signalState.classList.toggle("active", on);
    }

    log(on ? "MIC KEY DOWN" : "MIC KEY UP");

    updateInternalPaddleState();
  }

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

  function isPaddleReverse() {
    return paddleReverseInput?.checked === true;
  }

  function mapPaddleState(rawDit, rawDah) {
    if (isPaddleReverse()) {
      return {
        dit: rawDah,
        dah: rawDit,
      };
    }

    return {
      dit: rawDit,
      dah: rawDah,
    };
  }

  function getInputSource() {
    return inputSourceSelect?.value || "both";
  }

  function updateInternalPaddleState() {
    const source = getInputSource();

    let rawDit = false;
    let rawDah = false;

    if (source === "keyboard" || source === "both") {
      rawDit = keyboardDitPressed;
      rawDah = keyboardDahPressed;
    }

    const mapped = mapPaddleState(rawDit, rawDah);

    let externalDit = false;
    let externalDah = false;

    if (source === "audio" || source === "both") {
      externalDit = microphoneKeyPressed;
    }

    ditPressed = mapped.dit || externalDit;
    dahPressed = mapped.dah || externalDah;

    updateIndicators();
    processKeyerInput();
  }

  function updateIndicators() {
    if (ditIndicator) {
      ditIndicator.classList.toggle("active", ditPressed);
    }

    if (dahIndicator) {
      dahIndicator.classList.toggle("active", dahPressed);
    }
  }

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
      keyboardDitPressed = true;
      log("KEYBOARD DIT DOWN");
    }

    if (key === "j") {
      keyboardDahPressed = true;
      log("KEYBOARD DAH DOWN");
    }

    updateInternalPaddleState();
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();

    if (key !== "f" && key !== "j") {
      return;
    }

    event.preventDefault();

    if (key === "f") {
      keyboardDitPressed = false;
      log("KEYBOARD DIT UP");
    }

    if (key === "j") {
      keyboardDahPressed = false;
      log("KEYBOARD DAH UP");
    }

    updateInternalPaddleState();
  });

  function processKeyerInput() {
    const mode = modeSelect?.value || "straight";

    switch (mode) {
      case "straight":
        handleStraightKey();
        break;

      case "iambicA":
      case "iambicB":
        handleIambicKeyer();
        break;

      case "bug":
        handleBug();
        break;

      case "sideswiper":
        handleSideswiper();
        break;

      default:
        stopAllKeyers();
    }
  }

  function handleStraightKey() {
    const pressed = ditPressed || dahPressed;

    if (pressed) {
      startTone();

      if (keyOutput) {
        keyOutput.textContent = "KEY DOWN";
      }
    } else {
      stopTone();

      if (keyOutput) {
        keyOutput.textContent = "KEY UP";
      }
    }
  }

  function handleIambicKeyer() {
    if (!keyerRunning && (ditPressed || dahPressed)) {
      startKeyer();
      return;
    }

    if (keyerRunning && ditPressed && dahPressed) {
      oppositeWasPressed = true;
    }
  }

  function startKeyer() {
    if (keyerRunning) {
      return;
    }

    keyerRunning = true;
    keyerGeneration++;
    oppositeWasPressed = false;

    if (ditPressed && !dahPressed) {
      nextElement = "dit";
    } else if (dahPressed && !ditPressed) {
      nextElement = "dah";
    } else {
      nextElement = "dit";
    }

    runKeyerElement(keyerGeneration);
  }

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
  }

  function selectNextElement() {
    if (ditPressed && dahPressed) {
      const result = nextElement;

      nextElement = result === "dit" ? "dah" : "dit";

      return result;
    }

    if (ditPressed) {
      nextElement = "dah";
      return "dit";
    }

    if (dahPressed) {
      nextElement = "dit";
      return "dah";
    }

    return null;
  }

  function runKeyerElement(generation) {
    if (!keyerRunning || generation !== keyerGeneration) {
      return;
    }

    const element = selectNextElement();

    if (!element) {
      stopKeyer();
      return;
    }

    currentElement = element;
    oppositeWasPressed = false;

    const ditTime = getDitTime();
    const duration = element === "dit" ? ditTime : ditTime * 3;

    startTone();

    if (keyOutput) {
      keyOutput.textContent = element === "dit" ? "DIT" : "DAH";
    }

    log(`TX ${element.toUpperCase()}`);

    keyerTimer = setTimeout(() => {
      finishKeyerElement(generation, element);
    }, duration);
  }

  function finishKeyerElement(generation, element) {
    if (generation !== keyerGeneration) {
      return;
    }

    stopTone();
    keyerTimer = null;

    const mode = modeSelect?.value;

    if (mode === "iambicA") {
      if (ditPressed || dahPressed) {
        runKeyerElement(generation);
      } else {
        stopKeyer();
      }

      return;
    }

    if (mode === "iambicB") {
      if (oppositeWasPressed) {
        nextElement = element === "dit" ? "dah" : "dit";
        oppositeWasPressed = false;
        runKeyerElement(generation);
        return;
      }

      if (ditPressed || dahPressed) {
        runKeyerElement(generation);
      } else {
        stopKeyer();
      }

      return;
    }

    stopKeyer();
  }

  function handleBug() {
    if (dahPressed) {
      stopBug();
      startTone();

      if (keyOutput) {
        keyOutput.textContent = "DAH";
      }

      return;
    }

    if (ditPressed) {
      if (!bugRunning) {
        startBug();
      }

      return;
    }

    if (!bugRunning) {
      stopTone();

      if (keyOutput) {
        keyOutput.textContent = "KEY UP";
      }
    }
  }

  function startBug() {
    if (bugRunning) {
      return;
    }

    bugRunning = true;
    bugGeneration++;

    runBugDit(bugGeneration);
  }

  function stopBug() {
    bugRunning = false;
    bugGeneration++;

    if (bugTimer !== null) {
      clearTimeout(bugTimer);
      bugTimer = null;
    }

    stopTone();
  }

  function runBugDit(generation) {
    if (!bugRunning || generation !== bugGeneration) {
      return;
    }

    if (!ditPressed) {
      stopBug();

      if (keyOutput) {
        keyOutput.textContent = "KEY UP";
      }

      return;
    }

    const ditTime = getDitTime();

    startTone();

    if (keyOutput) {
      keyOutput.textContent = "DIT";
    }

    log("BUG DIT");

    bugTimer = setTimeout(() => {
      if (generation !== bugGeneration) {
        return;
      }

      stopTone();

      bugTimer = setTimeout(() => {
        runBugDit(generation);
      }, ditTime);
    }, ditTime);
  }

  function handleSideswiper() {
    const pressed = ditPressed || dahPressed;

    if (!pressed) {
      sideswiperRunning = false;

      if (sideswiperTimer !== null) {
        clearTimeout(sideswiperTimer);
        sideswiperTimer = null;
      }

      stopTone();

      if (keyOutput) {
        keyOutput.textContent = "KEY UP";
      }

      return;
    }

    if (sideswiperRunning) {
      return;
    }

    sideswiperRunning = true;

    const element = sideswiperLastElement === "dit" ? "dah" : "dit";

    sideswiperLastElement = element;

    const ditTime = getDitTime();
    const duration = element === "dit" ? ditTime : ditTime * 3;

    startTone();

    if (keyOutput) {
      keyOutput.textContent = element === "dit" ? "DIT" : "DAH";
    }

    log(`COOTIE ${element.toUpperCase()}`);

    sideswiperTimer = setTimeout(() => {
      stopTone();

      sideswiperRunning = false;
      sideswiperTimer = null;

      if (keyOutput && !ditPressed && !dahPressed) {
        keyOutput.textContent = "KEY UP";
      }
    }, duration);
  }

  function stopAllKeyers() {
    stopKeyer();
    stopBug();

    sideswiperRunning = false;

    if (sideswiperTimer !== null) {
      clearTimeout(sideswiperTimer);
      sideswiperTimer = null;
    }

    stopTone();
  }

  modeSelect?.addEventListener("change", () => {
    stopAllKeyers();

    if (modeDescription) {
      modeDescription.textContent = MODE_DESCRIPTIONS[modeSelect.value] || "";
    }

    if (keyOutput) {
      keyOutput.textContent = "Ready";
    }

    log(`MODE ${modeSelect.value}`);

    updateInternalPaddleState();
  });

  paddleReverseInput?.addEventListener("change", () => {
    stopAllKeyers();

    log(isPaddleReverse() ? "PADDLE REVERSE ON" : "PADDLE REVERSE OFF");

    updateInternalPaddleState();
  });

  inputSourceSelect?.addEventListener("change", () => {
    stopAllKeyers();

    log(`INPUT SOURCE ${getInputSource()}`);

    updateInternalPaddleState();
  });

  toneInput?.addEventListener("input", () => {
    if (oscillator && audioContext) {
      oscillator.frequency.setValueAtTime(getTone(), audioContext.currentTime);
    }
  });

  volumeInput?.addEventListener("input", () => {
    if (
      audioContext &&
      gainNode &&
      (signalOn || keyerRunning || bugRunning || sideswiperRunning)
    ) {
      startTone();
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

  async function enumerateAudioDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return;
    }

    if (!audioDeviceSelect) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const inputs = devices.filter((device) => device.kind === "audioinput");

      const previous = audioDeviceSelect.value;

      audioDeviceSelect.innerHTML = "";

      const defaultOption = document.createElement("option");

      defaultOption.value = "";
      defaultOption.textContent = "Default Microphone";

      audioDeviceSelect.appendChild(defaultOption);

      inputs.forEach((device, index) => {
        const option = document.createElement("option");

        option.value = device.deviceId;
        option.textContent = device.label || `Audio Input ${index + 1}`;

        audioDeviceSelect.appendChild(option);
      });

      if (
        previous &&
        [...audioDeviceSelect.options].some(
          (option) => option.value === previous,
        )
      ) {
        audioDeviceSelect.value = previous;
      }
    } catch (error) {
      console.error("enumerateAudioDevices:", error);
    }
  }

  audioDeviceSelect?.addEventListener("change", async () => {
    log("AUDIO DEVICE CHANGED");

    if (!audioContext) {
      return;
    }

    stopMicrophone();

    try {
      await enableMicrophone();
    } catch (error) {
      console.error(error);

      if (microphoneStatus) {
        microphoneStatus.textContent = `${error.name}: ${error.message}`;
      }

      log(`MIC ERROR ${error.name}: ${error.message}`);
    }
  });

  audioStartButton?.addEventListener("click", enableAudio);

  audioStopButton?.addEventListener("click", stopAudio);

  updateMeter(0);

  if (modeDescription) {
    modeDescription.textContent =
      MODE_DESCRIPTIONS[modeSelect?.value || "straight"] || "";
  }

  if (signalState) {
    signalState.textContent = "SIGNAL OFF";
  }

  if (keyOutput) {
    keyOutput.textContent = "Ready";
  }

  if (audioStopButton) {
    audioStopButton.disabled = true;
  }

  log("CW Key Test ready.");
  log("F = DIT, J = DAH.");
  log("Paddle Reverse available.");
  log("Modes: Straight, Iambic A, Iambic B, Bug, Sideswiper.");
  log("Audio input ready.");

  enumerateAudioDevices();
})();
