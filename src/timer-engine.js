export const TimerState = Object.freeze({
  IDLE: "IDLE", PREPARING: "PREPARING", WORK: "WORK", REST: "REST",
  PAUSED: "PAUSED", FINISHED: "FINISHED",
});

export function buildPhases(config) {
  const phases = [];
  if (config.startDelay > 0) phases.push({ type: TimerState.PREPARING, duration: config.startDelay, round: 1 });
  for (let round = 1; round <= config.rounds; round += 1) {
    phases.push({ type: TimerState.WORK, duration: config.work, round });
    if (round < config.rounds && config.rest > 0) phases.push({ type: TimerState.REST, duration: config.rest, round });
  }
  return phases;
}

export class TimerEngine extends EventTarget {
  constructor(now = () => Date.now()) {
    super(); this.now = now; this.suppressEvents = false; this.reset();
  }
  reset() {
    this.config = null; this.phases = []; this.index = -1; this.state = TimerState.IDLE;
    this.endTime = 0; this.pausedRemaining = 0; this.previousState = null; this.announced = new Set();
  }
  emit(type, detail = {}) { if (!this.suppressEvents) this.dispatchEvent(new CustomEvent(type, { detail })); }
  start(config) {
    this.reset(); this.config = { ...config }; this.phases = buildPhases(config); this.index = 0;
    if (!this.phases.length) return this.finish();
    this.startPhase(this.now()); this.emit("TIMER_STARTED", this.snapshot()); return this.snapshot();
  }
  startPhase(startAt) {
    const phase = this.phases[this.index]; this.state = phase.type;
    this.endTime = startAt + phase.duration * 1000; this.announced.clear();
    this.emit("PHASE_STARTED", { ...phase, index: this.index });
    if (phase.type === TimerState.WORK) this.emit("ROUND_STARTED", { round: phase.round });
    if (phase.type === TimerState.REST) this.emit("REST_STARTED", { round: phase.round });
  }
  update(at = this.now()) {
    if ([TimerState.IDLE, TimerState.PAUSED, TimerState.FINISHED].includes(this.state)) return this.snapshot(at);
    while (at >= this.endTime && this.state !== TimerState.FINISHED) {
      this.index += 1;
      if (this.index >= this.phases.length) { this.finish(); break; }
      this.startPhase(this.endTime);
    }
    if (this.state !== TimerState.FINISHED) this.checkEnding(at);
    return this.snapshot(at);
  }
  /** Absolute wall-clock time of the next event which can affect workout logic. */
  nextEventTime(at = this.now()) {
    if (![TimerState.PREPARING, TimerState.WORK, TimerState.REST].includes(this.state)) return null;
    const next = this.phases[this.index + 1];
    const times = [this.endTime];
    if (next?.type === TimerState.WORK) {
      const addThreshold = (key, seconds) => {
        const time = this.endTime - seconds * 1000;
        if (!this.announced.has(key) && time > at && time < this.endTime) times.push(time);
      };
      if (this.config.warning > 0) addThreshold("warning", this.config.warning);
      for (const seconds of [3, 2, 1]) addThreshold(`count-${seconds}`, seconds);
    }
    return Math.min(...times);
  }
  checkEnding(at) {
    const remaining = Math.max(0, Math.ceil((this.endTime - at) / 1000));
    const phase = this.phases[this.index];
    const next = this.phases[this.index + 1];
    if (next?.type === TimerState.WORK && remaining === this.config.warning && !this.announced.has("warning")) {
      this.announced.add("warning");
      const last = next.round === this.config.rounds;
      this.emit(last ? "LAST_ROUND_UPCOMING" : "PHASE_ENDING", { seconds: remaining, round: next.round, from: phase.type });
    }
    if (next?.type === TimerState.WORK && remaining <= 3 && remaining > 0 && !this.announced.has(`count-${remaining}`)) {
      this.announced.add(`count-${remaining}`); this.emit("COUNTDOWN", { seconds: remaining });
    }
  }
  pause() {
    if (![TimerState.PREPARING, TimerState.WORK, TimerState.REST].includes(this.state)) return;
    this.pausedRemaining = Math.max(0, this.endTime - this.now()); this.previousState = this.state;
    this.state = TimerState.PAUSED; this.emit("PAUSED", this.snapshot());
  }
  resume() {
    if (this.state !== TimerState.PAUSED) return;
    this.state = this.previousState; this.endTime = this.now() + this.pausedRemaining;
    this.emit("RESUMED", this.snapshot());
  }
  restartPhase() {
    if (this.state === TimerState.PAUSED) { this.pausedRemaining = this.phases[this.index].duration * 1000; return; }
    if (this.index >= 0 && this.state !== TimerState.FINISHED) this.startPhase(this.now());
  }
  nextPhase() {
    if (this.state === TimerState.FINISHED) return;
    this.index += 1;
    if (this.index >= this.phases.length) this.finish(); else this.startPhase(this.now());
  }
  stop() { this.reset(); this.emit("STOPPED"); }
  finish() { this.state = TimerState.FINISHED; this.endTime = 0; this.emit("WORKOUT_FINISHED"); return this.snapshot(); }
  exportState() {
    return {
      config: this.config ? { ...this.config } : null,
      index: this.index,
      state: this.state,
      endTime: this.endTime,
      pausedRemaining: this.pausedRemaining,
      previousState: this.previousState,
      announced: [...this.announced],
    };
  }
  /** Restore wall-clock state and silently reconcile all time elapsed while unloaded. */
  restoreState(savedState, now = Date.now()) {
    const validStates = Object.values(TimerState);
    if (!savedState?.config || !validStates.includes(savedState.state)) throw new TypeError("Invalid timer state");
    const phases = buildPhases(savedState.config);
    if (!Number.isInteger(savedState.index) || savedState.index < 0 || savedState.index >= phases.length) {
      throw new RangeError("Invalid phase index");
    }
    this.config = { ...savedState.config }; this.phases = phases; this.index = savedState.index;
    this.state = savedState.state; this.endTime = Number(savedState.endTime) || 0;
    this.pausedRemaining = Math.max(0, Number(savedState.pausedRemaining) || 0);
    this.previousState = savedState.previousState || null; this.announced = new Set(savedState.announced || []);
    this.suppressEvents = true;
    try { return this.update(now); } finally { this.suppressEvents = false; }
  }
  snapshot(at = this.now()) {
    const phase = this.phases[this.index];
    let ms = 0;
    if (this.state === TimerState.PAUSED) ms = this.pausedRemaining;
    else if (phase && this.state !== TimerState.FINISHED) ms = Math.max(0, this.endTime - at);
    const durationMs = (phase?.duration || 0) * 1000;
    return { state: this.state, phase, index: this.index, remainingMs: ms,
      remainingSeconds: Math.ceil(ms / 1000), progress: durationMs ? Math.min(1, Math.max(0, 1 - ms / durationMs)) : 1,
      next: this.phases[this.index + 1] || null, config: this.config };
  }
}
