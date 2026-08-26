"use strict";

const INCWAudio = (() => {
  let ctx = null;

  function getContext() {
    if (!ctx) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error("Web Audio API nicht verfügbar.");
      }

      ctx = new AudioContextClass();
    }

    return ctx;
  }

  async function start() {
    const audio = getContext();

    if (audio.state === "suspended") {
      await audio.resume();
    }

    return audio;
  }

  function tone(frequency, duration, volume) {
    const audio = getContext();

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    const now = audio.currentTime;

    const attack = Math.min(0.005, duration / 4);
    const release = Math.min(0.008, duration / 4);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);

    gain.gain.setValueAtTime(volume, now + duration - release);

    gain.gain.linearRampToValueAtTime(0, now + duration);

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function stop() {
    /*
     * Absichtlich leer.
     *
     * Pause und Stop unterbrechen keinen laufenden
     * Audioknoten abrupt.
     */
  }

  return {
    start,
    tone,
    stop,
  };
})();
