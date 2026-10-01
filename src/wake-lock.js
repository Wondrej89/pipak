export class WakeLock {
  constructor() { this.sentinel = null; }
  async acquire() {
    if (!navigator.wakeLock || document.visibilityState !== "visible" || this.sentinel) return;
    try { this.sentinel = await navigator.wakeLock.request("screen"); this.sentinel.addEventListener("release", () => { this.sentinel = null; }); } catch { this.sentinel = null; }
  }
  async release() { try { await this.sentinel?.release(); } finally { this.sentinel = null; } }
}
