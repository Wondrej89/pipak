export class AudioEngine {
  constructor() { this.context = null; this.volume = 0.8; }
  unlock(volume = 0.8) {
    this.volume = volume; const Context = window.AudioContext || window.webkitAudioContext;
    if (Context && !this.context) this.context = new Context();
    this.context?.resume();
  }
  tone(frequency, duration, delay = 0) {
    if (!this.context) return;
    const t = this.context.currentTime + delay, oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.frequency.value = frequency; oscillator.type = "sine"; gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, this.volume * 0.25), t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain).connect(this.context.destination); oscillator.start(t); oscillator.stop(t + duration + 0.02);
  }
  warning() { this.tone(880, 0.12); }
  start() { this.tone(660, 0.12); this.tone(990, 0.3, 0.15); }
  finish() { this.tone(523, 0.18); this.tone(659, 0.18, 0.2); this.tone(784, 0.45, 0.4); }
}

export class TTSEngine {
  constructor() { this.enabled = "speechSynthesis" in window; }
  unlock() { if (this.enabled) window.speechSynthesis.getVoices(); }
  speak(text) {
    if (!this.enabled) return;
    window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "cs-CZ"; const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.toLowerCase().startsWith("cs")) || null;
    window.speechSynthesis.speak(utterance);
  }
  cancel() { if (this.enabled) window.speechSynthesis.cancel(); }
}

/** Single workout-audio boundary, ready for prerecorded cues in a future backend. */
export class WorkoutAudio {
  constructor(beeps = new AudioEngine(), voice = new TTSEngine()) { this.beeps = beeps; this.voice = voice; this.mode = "both"; }
  unlock(mode, volume) { this.mode = mode; this.beeps.unlock(volume); this.voice.unlock(); }
  uses(kind) { return this.mode === kind || this.mode === "both"; }
  warning() { if (this.uses("beep")) this.beeps.warning(); }
  roundStarted() { if (this.uses("beep")) this.beeps.start(); }
  restStarted() { if (this.uses("voice")) this.voice.speak("Pauza."); }
  phaseEnding({ seconds, from }) { if (this.uses("voice") && seconds) this.voice.speak(from === "PREPARING" ? `Začínáme za ${seconds}` : `Další kolo za ${seconds}`); }
  lastRound({ seconds }) { if (this.uses("voice") && seconds) this.voice.speak(`Poslední kolo za ${seconds}`); }
  finished() { if (this.uses("beep")) this.beeps.finish(); if (this.uses("voice")) this.voice.speak("Hotovo."); }
  cancel() { this.voice.cancel(); }
}
