"use strict";

const INCWAudio = (() => {
  let ctx = null;

  const ATTACK = 0.01;
  const RELEASE = 0.02;

  const DEFAULT_FREQUENCY = 600;
  const DEFAULT_VOLUME = 0.3;

  const activeSources = new Set();

  function getContext() {
    if (ctx) {
      return ctx;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("Web Audio API nicht verfügbar.");
    }

    ctx = new AudioContextClass();

    return ctx;
  }

  async function start() {
    const audio = getContext();

    if (audio.state === "suspended") {
      await audio.resume();
    }

    if (audio.state !== "running") {
      throw new Error("AudioContext konnte nicht gestartet werden.");
    }

    return audio;
  }

  function safeFrequency(value) {
    const frequency = Number(value);

    if (!Number.isFinite(frequency)) {
      return DEFAULT_FREQUENCY;
    }

    return Math.max(100, Math.min(2000, frequency));
  }

  function safeDuration(value) {
    const duration = Number(value);

    if (!Number.isFinite(duration)) {
      return 0.001;
    }

    return Math.max(0.001, duration);
  }

  function safeVolume(value) {
    const volume = Number(value);

    if (!Number.isFinite(volume)) {
      return DEFAULT_VOLUME;
    }

    return Math.max(0, Math.min(0.8, volume));
  }

  function tone(frequency, duration, volume) {
    const audio = getContext();

    if (audio.state !== "running") {
      return;
    }

    const safeFreq = safeFrequency(frequency);
    const durationSeconds = safeDuration(duration);
    const safeVol = safeVolume(volume);

    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();

    oscillator.type = "sine";

    const startTime = audio.currentTime + 0.005;
    const endTime = startTime + durationSeconds;

    const attack = Math.min(ATTACK, durationSeconds / 3);

    const release = Math.min(RELEASE, durationSeconds / 3);

    const attackEnd = startTime + attack;
    const releaseStart = endTime - release;

    oscillator.frequency.setValueAtTime(safeFreq, startTime);

    envelope.gain.setValueAtTime(0, startTime);

    envelope.gain.linearRampToValueAtTime(safeVol, attackEnd);

    envelope.gain.setValueAtTime(safeVol, releaseStart);

    envelope.gain.linearRampToValueAtTime(0, endTime);

    oscillator.connect(envelope);
    envelope.connect(audio.destination);

    activeSources.add(oscillator);

    oscillator.addEventListener(
      "ended",
      () => {
        activeSources.delete(oscillator);

        try {
          oscillator.disconnect();
        } catch {
          // Bereits getrennt.
        }

        try {
          envelope.disconnect();
        } catch {
          // Bereits getrennt.
        }
      },
      { once: true },
    );

    oscillator.start(startTime);
    oscillator.stop(endTime);
  }

  function stop() {
    const audio = ctx;

    if (!audio || audio.state === "closed") {
      return;
    }

    const stopTime = audio.currentTime;
    const fadeTime = 0.015;

    for (const oscillator of activeSources) {
      try {
        oscillator.stop(stopTime + fadeTime);
      } catch {
        // Quelle wurde bereits beendet.
      }
    }
  }

  return {
    start,
    tone,
    stop,
  };
})();
