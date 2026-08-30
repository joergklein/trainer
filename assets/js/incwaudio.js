"use strict";

const INCWAudio = (() => {
  let ctx = null;

  const ATTACK = 0.01;
  const RELEASE = 0.02;
  const FADE_TIME = 0.015;

  const DEFAULT_FREQUENCY = 600;
  const DEFAULT_VOLUME = 0.3;

  const MIN_FREQUENCY = 100;
  const MAX_FREQUENCY = 2000;
  const MAX_VOLUME = 0.8;

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

  function clamp(value, min, max, fallback) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, number));
  }

  function safeFrequency(value) {
    return clamp(value, MIN_FREQUENCY, MAX_FREQUENCY, DEFAULT_FREQUENCY);
  }

  function safeDuration(value) {
    const duration = Number(value);

    return Number.isFinite(duration) ? Math.max(0.001, duration) : 0.001;
  }

  function safeVolume(value) {
    return clamp(value, 0, MAX_VOLUME, DEFAULT_VOLUME);
  }

  function cleanup(oscillator, envelope) {
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
  }

  function tone(frequency, duration, volume) {
    const audio = getContext();

    if (audio.state !== "running") {
      return;
    }

    const durationSeconds = safeDuration(duration);
    const startTime = audio.currentTime;
    const endTime = startTime + durationSeconds;

    const attack = Math.min(ATTACK, durationSeconds / 3);
    const release = Math.min(RELEASE, durationSeconds / 3);

    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(safeFrequency(frequency), startTime);

    envelope.gain.setValueAtTime(0, startTime);
    envelope.gain.linearRampToValueAtTime(
      safeVolume(volume),
      startTime + attack,
    );
    envelope.gain.setValueAtTime(safeVolume(volume), endTime - release);
    envelope.gain.linearRampToValueAtTime(0, endTime);

    oscillator.connect(envelope);
    envelope.connect(audio.destination);

    activeSources.add(oscillator);

    oscillator.addEventListener("ended", () => cleanup(oscillator, envelope), {
      once: true,
    });

    oscillator.start(startTime);
    oscillator.stop(endTime);
  }

  function stop() {
    if (!ctx || ctx.state === "closed") {
      return;
    }

    const stopTime = ctx.currentTime + FADE_TIME;

    for (const oscillator of activeSources) {
      try {
        oscillator.stop(stopTime);
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
