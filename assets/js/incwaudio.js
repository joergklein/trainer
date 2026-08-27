"use strict";

/*
 * INCW AUDIO
 *
 * Jeder Ton wird als eigene Audioquelle erzeugt.
 *
 * Wichtig:
 * - kein dauerhaft laufender Oszillator
 * - kein harter Gain-Sprung
 * - kein wiederverwendeter Oszillator
 * - Tonanfang und Tonende werden im AudioContext geplant
 */

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

    return audio;
  }

  function safeFrequency(frequency) {
    const value = Number(frequency);

    if (!Number.isFinite(value)) {
      return DEFAULT_FREQUENCY;
    }

    return Math.max(100, Math.min(2000, value));
  }

  function safeDuration(duration) {
    const value = Number(duration);

    if (!Number.isFinite(value)) {
      return 0.001;
    }

    return Math.max(0.001, value);
  }

  function safeVolume(volume) {
    const value = Number(volume);

    if (!Number.isFinite(value)) {
      return DEFAULT_VOLUME;
    }

    return Math.max(0, Math.min(0.8, value));
  }

  function tone(frequency, duration, volume) {
    const audio = getContext();

    /*
     * Der AudioContext muss vorher durch start()
     * aktiviert worden sein.
     */
    if (audio.state === "suspended") {
      return;
    }

    const safeFreq = safeFrequency(frequency);

    /*
     * WICHTIG:
     *
     * Nicht "safeDuration" als Variablenname
     * verwenden, weil gleichnamige Funktion existiert.
     */
    const durationSeconds = safeDuration(duration);

    const safeVol = safeVolume(volume);

    /*
     * Eigener Oszillator für genau diesen Ton.
     */
    const oscillator = audio.createOscillator();

    /*
     * Eigene Hüllkurve für genau diesen Ton.
     */
    const envelope = audio.createGain();

    oscillator.type = "sine";

    const now = audio.currentTime;

    /*
     * Kleiner zeitlicher Vorlauf.
     *
     * Der Ton wird von Web Audio geplant,
     * nicht von JavaScript verzögert gestartet.
     */
    const startTime = now + 0.005;

    const endTime = startTime + durationSeconds;

    const attack = Math.min(ATTACK, durationSeconds / 3);

    const release = Math.min(RELEASE, durationSeconds / 3);

    const attackEnd = startTime + attack;

    const releaseStart = endTime - release;

    oscillator.frequency.setValueAtTime(safeFreq, startTime);

    /*
     * Beginn garantiert bei 0.
     */
    envelope.gain.setValueAtTime(0, startTime);

    /*
     * Weiches Einschwingen.
     */
    envelope.gain.linearRampToValueAtTime(safeVol, attackEnd);

    /*
     * Lautstärke halten.
     */
    envelope.gain.setValueAtTime(safeVol, releaseStart);

    /*
     * Weiches Ausschwingen.
     */
    envelope.gain.linearRampToValueAtTime(0, endTime);

    oscillator.connect(envelope);
    envelope.connect(audio.destination);

    /*
     * Quelle registrieren.
     */
    activeSources.add(oscillator);

    oscillator.addEventListener(
      "ended",
      () => {
        activeSources.delete(oscillator);

        try {
          oscillator.disconnect();
        } catch (error) {
          console.error(error);
        }

        try {
          envelope.disconnect();
        } catch (error) {
          console.error(error);
        }
      },
      { once: true },
    );

    /*
     * Start und Ende ausschließlich
     * über die Audio-Zeitachse.
     */
    oscillator.start(startTime);
    oscillator.stop(endTime);
  }

  function stop() {
    /*
     * Bereits geplante Quellen beenden.
     *
     * Keine neue Audioquelle.
     * Kein Gain-Sprung.
     * Kein zusätzlicher Ton.
     */

    for (const oscillator of activeSources) {
      try {
        oscillator.stop();
      } catch (error) {
        /*
         * Bereits beendete Quellen ignorieren.
         */
      }
    }

    activeSources.clear();
  }

  return {
    start,
    tone,
    stop,
  };
})();
