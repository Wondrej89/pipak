const makeQuietWav = () => {
  const rate = 8000, samples = rate, buffer = new ArrayBuffer(44 + samples * 2), view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); text(8, "WAVEfmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
};

/** A real media element keeps an active workout represented as media playback. */
export class BackgroundMedia {
  constructor({ onPlay, onPause }, navigatorRef = navigator) {
    this.navigator = navigatorRef; this.mediaSession = navigatorRef.mediaSession;
    this.audio = new Audio(); this.audio.loop = true; this.audio.preload = "auto"; this.audio.src = makeQuietWav();
    if ("audioSession" in navigatorRef) {
      try { navigatorRef.audioSession.type = "playback"; } catch { /* Experimental API; ignore unsupported modes. */ }
    }
    if (this.mediaSession) {
      this.mediaSession.setActionHandler("play", onPlay);
      this.mediaSession.setActionHandler("pause", onPause);
    }
  }
  start() { this.audio.play().catch(() => {}); this.setPlaybackState("playing"); }
  pause() { this.audio.pause(); this.setPlaybackState("paused"); }
  stop() { this.audio.pause(); this.audio.currentTime = 0; this.setPlaybackState("none"); }
  setPlaybackState(state) { if (this.mediaSession) this.mediaSession.playbackState = state; }
  update(preset, snapshot, phaseName) {
    if (!this.mediaSession || typeof MediaMetadata === "undefined") return;
    const round = snapshot.phase?.round || 1;
    this.mediaSession.metadata = new MediaMetadata({
      title: `Pípák – ${preset.name}`,
      artist: snapshot.state === "FINISHED" ? "Hotovo" : `${phaseName} • kolo ${round} / ${preset.rounds}`,
      album: "Intervalový trénink",
    });
  }
}
