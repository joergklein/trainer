"use strict";

const INCWAudio = (() => {
  let ctx = null;
  let sequence = [];
  let activeSource = null;

  const ATTACK = 0.008;
  const RELEASE = 0.012;

  const DEFAULT_FREQUENCY = 600;
  const DEFAULT_VOLUME = 0.3;
  const MAX_VOLUME = 0.8;

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

    sequence = [];
    return audio;
  }

  function safeFrequency(value) {
    value = Number(value);

    if (!Number.isFinite(value)) {
      return DEFAULT_FREQUENCY;
    }

    return Math.max(100, Math.min(2000, value));
  }

  function safeDuration(value) {
    value = Number(value);

    if (!Number.isFinite(value)) {
      return 0.001;
    }

    return Math.max(0.001, value);
  }

  function safeVolume(value) {
    value = Number(value);

    if (!Number.isFinite(value)) {
      return DEFAULT_VOLUME;
    }

    return Math.max(0, Math.min(MAX_VOLUME, value));
  }

  function tone(frequency, duration, volume) {
    const audio = getContext();

    if (audio.state === "suspended") {
      return;
    }

    const safeFreq = safeFrequency(frequency);
    const safeDurationSeconds = safeDuration(duration);
    const safeVol = safeVolume(volume);

    if (safeVol <= 0) {
      return;
    }

    sequence.push({
      frequency: safeFreq,
      duration: safeDurationSeconds,
      volume: safeVol,
    });

    scheduleSequence();
  }

  function scheduleSequence() {
    const audio = getContext();

    if (audio.state === "suspended" || sequence.length === 0 || activeSource) {
      return;
    }

    const items = sequence;
    sequence = [];

    let totalDuration = 0;

    for (const item of items) {
      totalDuration += item.duration;
    }

    if (totalDuration <= 0) {
      return;
    }

    const sampleRate = audio.sampleRate;
    const frameCount = Math.max(1, Math.ceil(totalDuration * sampleRate));

    const buffer = audio.createBuffer(1, frameCount, sampleRate);

    const data = buffer.getChannelData(0);

    let offset = 0;

    for (const item of items) {
      const frames = Math.max(1, Math.floor(item.duration * sampleRate));

      const attackFrames = Math.max(
        1,
        Math.floor(Math.min(ATTACK, item.duration / 3) * sampleRate),
      );

      const releaseFrames = Math.max(
        1,
        Math.floor(Math.min(RELEASE, item.duration / 3) * sampleRate),
      );

      const releaseStart = Math.max(0, frames - releaseFrames);

      for (let i = 0; i < frames && offset + i < data.length; i++) {
        const sine = Math.sin(2 * Math.PI * item.frequency * (i / sampleRate));

        let envelope = 1;

        if (i < attackFrames) {
          envelope = i / attackFrames;
        }

        if (i >= releaseStart) {
          envelope = Math.min(envelope, (frames - i) / releaseFrames);
        }

        data[offset + i] =
          sine * Math.max(0, Math.min(1, envelope)) * item.volume;
      }

      offset += frames;
    }

    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);

    activeSource = source;

    source.addEventListener(
      "ended",
      () => {
        if (activeSource === source) {
          activeSource = null;
          scheduleSequence();
        }

        try {
          source.disconnect();
        } catch {
          // Bereits getrennt.
        }
      },
      { once: true },
    );

    source.start(audio.currentTime + 0.01);
  }

  function stop() {
    /*
     * Keine laufende Quelle abrupt beenden.
     * Dadurch bleibt das Signal knackfrei.
     */

    sequence = [];
  }

  return {
    start,
    tone,
    stop,
  };
})();
