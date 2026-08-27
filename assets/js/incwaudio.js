"use strict";

/*
 * ============================================================
 * INCW AUDIO
 * ============================================================
 *
 * Reine Audio-Engine für den CW-Trainer.
 *
 * cwtrainer.js benutzt ausschließlich:
 *
 *   await INCWAudio.start()
 *   INCWAudio.tone(frequency, duration, volume)
 *   INCWAudio.stop()
 *
 * Es wird hier KEIN dauerhaft laufender Oszillator verwendet.
 * Jeder Ton wird sauber erzeugt und nach seinem Fade-Out
 * wieder beendet.
 * ============================================================
 */

const INCWAudio = (() => {
  let ctx = null;

  const ATTACK = 0.008;
  const RELEASE = 0.006;

  /*
   * ------------------------------------------------------------
   * AudioContext
   * ------------------------------------------------------------
   */

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

  /*
   * ------------------------------------------------------------
   * Start
   * ------------------------------------------------------------
   *
   * Wichtig:
   * start() erzeugt selbst KEINEN Ton.
   * Dadurch darf beim Drücken von Start kein Knacks entstehen.
   */

  async function start() {
    const audio = getContext();

    if (audio.state === "suspended") {
      await audio.resume();
    }

    return audio;
  }

  /*
   * ------------------------------------------------------------
   * Tone
   * ------------------------------------------------------------
   */

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

    /*
     * Für JEDEN Morse-Ton werden frische Nodes erzeugt.
     *
     * Wichtig:
     * Der Oszillator wird nicht bei Start erzeugt.
     * Dadurch entsteht beim Start der Anwendung kein Signal.
     */

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    const now = audio.currentTime;

    const attack = Math.min(ATTACK, safeDuration / 3);

    const release = Math.min(RELEASE, safeDuration / 3);

    const soundEnd = now + safeDuration;

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(safeFrequency, now);

    /*
     * Der Gain startet garantiert bei 0.
     */

    gain.gain.setValueAtTime(0, now);

    /*
     * Kurzer Fade-In gegen Klicks.
     */

    gain.gain.linearRampToValueAtTime(safeVolume, now + attack);

    /*
     * Pegel konstant halten.
     */

    const releaseStart = Math.max(now + attack, soundEnd - release);

    gain.gain.setValueAtTime(safeVolume, releaseStart);

    /*
     * Kurzer Fade-Out gegen Klicks.
     */

    gain.gain.linearRampToValueAtTime(0, soundEnd);

    oscillator.connect(gain);
    gain.connect(audio.destination);

    /*
     * Start und Stop exakt auf dem Audio-Zeitplan.
     */

    oscillator.start(now);

    oscillator.stop(soundEnd);

    /*
     * Nach dem Stop werden die Nodes wieder getrennt.
     * Sie bleiben dadurch nicht unnötig im Audio-Graphen.
     */

    oscillator.addEventListener(
      "ended",
      () => {
        try {
          oscillator.disconnect();
        } catch (_) {}

        try {
          gain.disconnect();
        } catch (_) {}
      },
      { once: true },
    );
  }

  /*
   * ------------------------------------------------------------
   * Stop
   * ------------------------------------------------------------
   *
   * Es wird kein AudioContext geschlossen.
   *
   * Dadurch kann der Trainer nach Stop unmittelbar wieder
   * gestartet werden.
   *
   * Da tone() jeden Ton selbst sauber ausblendet, gibt es hier
   * keinen laufenden globalen Oszillator, den wir hart abbrechen
   * müssten.
   */

  function stop() {
    /*
     * Absichtlich leer.
     */
  }

  /*
   * ------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------
   */

  return {
    start,
    tone,
    stop,
  };
})();
