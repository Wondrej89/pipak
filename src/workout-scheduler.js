import { TimerState } from "./timer-engine.js";

const running = state => ![TimerState.IDLE, TimerState.PAUSED, TimerState.FINISHED].includes(state);

/** Drives wall-clock reconciliation with RAF while visible and timers while hidden. */
export class WorkoutScheduler {
  constructor(engine, onUpdate, documentRef = document) {
    this.engine = engine; this.onUpdate = onUpdate; this.document = documentRef;
    this.frame = null; this.timeout = null; this.active = false;
    this.visibilityHandler = () => this.visibilityChanged();
    this.document.addEventListener("visibilitychange", this.visibilityHandler);
  }
  start() { this.active = true; this.wake(); }
  stop() {
    this.active = false; cancelAnimationFrame(this.frame); clearTimeout(this.timeout);
    this.frame = null; this.timeout = null;
  }
  sync() { if (this.active) this.wake(); }
  wake() {
    cancelAnimationFrame(this.frame); clearTimeout(this.timeout); this.frame = null; this.timeout = null;
    const now = Date.now(), snapshot = this.engine.update(now);
    this.onUpdate(snapshot);
    if (!this.active || !running(snapshot.state)) return;
    if (this.document.visibilityState === "hidden") {
      const next = this.engine.nextEventTime(now) ?? this.engine.endTime;
      this.timeout = setTimeout(() => this.wake(), Math.max(0, next - Date.now()));
    } else {
      this.frame = requestAnimationFrame(() => this.wake());
    }
  }
  visibilityChanged() { if (this.active) this.wake(); }
  destroy() { this.stop(); this.document.removeEventListener("visibilitychange", this.visibilityHandler); }
}
