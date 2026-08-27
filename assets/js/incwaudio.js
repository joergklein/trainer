"use strict";

const INCWAudio = (() => {
  let ctx = null;
  let oscillator = null;
  let gain = null;

  const ATTACK = 0.008;
  const RELEASE = 0.012;

  function getContext() {
    if (ctx) {
      return ctx;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("Web Audio API nicht verfügbar.");
    }

    ctx = new AudioContextClass();

    oscillator = ctx.createOscillator();
    gain = ctx.createGain();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(600, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();

    return ctx;
  }

  async function start() {
    const audio = getContext();

    const now = audio.currentTime;

    /*
     * Vor dem Start garantiert stumm.
     */
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);

    if (audio.state === "suspended") {
      await audio.resume();
    }

    return audio;
  }

  function tone(frequency, duration, volume) {
    const audio = getContext();

    if (audio.state === "suspended") {
      return;
    }

    const safeFrequency = Math.max(
      100,
      Math.min(2000, Number(frequency) || 600),
    );

    const safeDuration = Math.max(0.001, Number(duration) || 0.001);

    const safeVolume = Math.max(0, Math.min(1, Number(volume) || 0));

    const now = audio.currentTime;

    const attack = Math.min(ATTACK, safeDuration / 3);

    const release = Math.min(RELEASE, safeDuration / 3);

    const end = now + safeDuration;

    const releaseStart = Math.max(now + attack, end - release);

    /*
     * Frequenz ändern, aber Oszillator NICHT neu starten.
     */
    oscillator.frequency.cancelScheduledValues(now);

    oscillator.frequency.setValueAtTime(safeFrequency, now);

    /*
     * Alten Gain-Zeitplan entfernen.
     */
    gain.gain.cancelScheduledValues(now);

    /*
     * Immer von STILLE starten.
     */
    gain.gain.setValueAtTime(0, now);

    /*
     * TON EIN
     */
    gain.gain.linearRampToValueAtTime(safeVolume, now + attack);

    /*
     * TON HALTEN
     */
    gain.gain.setValueAtTime(safeVolume, releaseStart);

    /*
     * TON AUS
     */
    gain.gain.linearRampToValueAtTime(0, end);
  }

  function stop() {
    if (!ctx || !gain) {
      return;
    }

    const now = ctx.currentTime;

    gain.gain.cancelScheduledValues(now);

    gain.gain.setValueAtTime(gain.gain.value, now);

    gain.gain.linearRampToValueAtTime(0, now + RELEASE);
  }

  return {
    start,
    tone,
    stop,
  };
})();
