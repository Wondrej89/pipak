const KEY = "pipak-data-v1";
const ACTIVE_KEY = "activeWorkout";
export const defaults = [
  { id: "ten-ten", name: "10 × 10 min", work: 600, rest: 0, rounds: 10, startDelay: 10, warning: 10, audioMode: "both" },
  { id: "hiit", name: "HIIT 40/20", work: 40, rest: 20, rounds: 10, startDelay: 10, warning: 10, audioMode: "both" },
  { id: "tabata", name: "Tabata", work: 20, rest: 10, rounds: 8, startDelay: 10, warning: 5, audioMode: "beep" },
];
export class Storage {
  load() {
    try { const data = JSON.parse(localStorage.getItem(KEY)); if (data?.presets) return data; } catch { /* invalid local data */ }
    const data = { presets: defaults, preferences: { volume: 0.8, tts: true }, lastPresetId: defaults[0].id };
    this.save(data); return structuredClone(data);
  }
  save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }
  loadActiveWorkout() {
    try { return JSON.parse(localStorage.getItem(ACTIVE_KEY)); } catch { return null; }
  }
  saveActiveWorkout(session) { localStorage.setItem(ACTIVE_KEY, JSON.stringify(session)); }
  clearActiveWorkout() { localStorage.removeItem(ACTIVE_KEY); }
}
