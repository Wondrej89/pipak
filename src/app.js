import { TimerEngine, TimerState } from "./timer-engine.js";
import { Storage } from "./storage.js";
import { AudioEngine, TTSEngine } from "./audio.js";
import { WakeLock } from "./wake-lock.js";
import { movePreset } from "./presets.js";

const $ = id => document.getElementById(id), storage = new Storage(), data = storage.load();
const engine = new TimerEngine(), audio = new AudioEngine(), tts = new TTSEngine(), wakeLock = new WakeLock();
const setup = $("setup"), timer = $("timer"), dialog = $("editor"), form = $("preset-form");
let frame, activePreset, holdTimer;
const stateNames = { PREPARING: "START", WORK: "CVIČENÍ", REST: "PAUZA", PAUSED: "POZASTAVENO", FINISHED: "HOTOVO" };
const format = seconds => `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
const durationText = seconds => seconds < 60 ? `${seconds} s` : format(seconds);
const parseDuration = value => { const bits = value.trim().split(":").map(Number); return bits.length === 2 ? bits[0] * 60 + bits[1] : Number(value); };

function renderPresets() {
  $("preset-list").innerHTML = data.presets.map((p, index) => `<article class="preset-card">
    <button class="preset-start" data-action="start" data-id="${p.id}"><span class="play">▶</span><span><strong>${escapeHtml(p.name)}</strong><small>${durationText(p.work)} cvičení${p.rest ? ` • ${durationText(p.rest)} pauza` : " • bez pauzy"} • ${p.rounds} kol</small></span></button>
    <div class="preset-actions">
      <div class="move-actions" aria-label="Změnit pořadí">
        <button data-action="up" data-id="${p.id}" aria-label="Posunout ${escapeHtml(p.name)} nahoru" title="Posunout nahoru" ${index === 0 ? "disabled" : ""}>↑</button>
        <button data-action="down" data-id="${p.id}" aria-label="Posunout ${escapeHtml(p.name)} dolů" title="Posunout dolů" ${index === data.presets.length - 1 ? "disabled" : ""}>↓</button>
      </div>
      <button data-action="edit" data-id="${p.id}">Upravit</button><button data-action="duplicate" data-id="${p.id}">Duplikovat</button><button data-action="delete" data-id="${p.id}" class="delete">Smazat</button>
    </div>
  </article>`).join("");
}
function escapeHtml(value) { const el = document.createElement("span"); el.textContent = value; return el.innerHTML; }
function persist() { storage.save(data); renderPresets(); }
function openEditor(preset) {
  const p = preset || { id:"", name:"", work:40, rest:20, rounds:10, startDelay:10, warning:10, audioMode:data.preferences.audioMode || "both" };
  $("editor-title").textContent = preset ? "Upravit trénink" : "Nový trénink";
  $("preset-id").value=p.id; $("name").value=p.name; $("work").value=format(p.work); $("rest").value=format(p.rest);
  $("rounds").value=p.rounds; $("start-delay").value=p.startDelay; $("warning").value=p.warning; $("audio-mode").value=p.audioMode;
  $("volume").value=data.preferences.volume ?? .8; dialog.showModal();
}
function startWorkout(preset) {
  activePreset=preset; data.lastPresetId=preset.id; data.preferences.audioMode=preset.audioMode; storage.save(data);
  audio.unlock(data.preferences.volume); tts.unlock(); setup.classList.add("hidden"); timer.classList.remove("hidden");
  timer.dataset.phase="PREPARING"; engine.start(preset); wakeLock.acquire(); cancelAnimationFrame(frame); tick();
}
function tick() { renderTimer(engine.update()); if (![TimerState.IDLE,TimerState.FINISHED].includes(engine.state)) frame=requestAnimationFrame(tick); }
function renderTimer(s) {
  $("phase-label").textContent=stateNames[s.state]; $("time").textContent=format(s.remainingSeconds);
  $("round-label").textContent=s.state === TimerState.FINISHED ? `${activePreset.name}` : `KOLO ${s.phase?.round || 1} / ${activePreset.rounds}`;
  $("next-label").textContent=s.next ? (s.next.type===TimerState.WORK ? `DALŠÍ: KOLO ${s.next.round}` : "DALŠÍ: PAUZA") : "";
  const isLast=s.state===TimerState.REST && s.next?.round===activePreset.rounds;
  $("last-round").classList.toggle("hidden", !isLast); $("progress-bar").style.width=`${s.progress*100}%`;
  $("pause").innerHTML=s.state===TimerState.PAUSED ? "▶ <span>Pokračovat</span>" : "Ⅱ <span>Pauza</span>";
  timer.dataset.phase=s.state===TimerState.PAUSED ? s.phase?.type : s.state;
}
function uses(kind) { return activePreset?.audioMode === kind || activePreset?.audioMode === "both"; }
engine.addEventListener("COUNTDOWN", () => { if (uses("beep")) audio.warning(); });
engine.addEventListener("ROUND_STARTED", () => { if (uses("beep")) audio.start(); });
engine.addEventListener("REST_STARTED", () => { if (uses("voice")) tts.speak("Pauza."); });
engine.addEventListener("PHASE_ENDING", e => { if (uses("voice") && e.detail.seconds) tts.speak(e.detail.from === TimerState.PREPARING ? `Začínáme za ${e.detail.seconds}` : `Další kolo za ${e.detail.seconds}`); });
engine.addEventListener("LAST_ROUND_UPCOMING", e => { if (uses("voice") && e.detail.seconds) tts.speak(`Poslední kolo za ${e.detail.seconds}`); });
engine.addEventListener("WORKOUT_FINISHED", () => { if (uses("beep")) audio.finish(); if (uses("voice")) tts.speak("Hotovo."); wakeLock.release(); });

$("preset-list").addEventListener("click", e => { const b=e.target.closest("button[data-action]"); if(!b)return; const p=data.presets.find(x=>x.id===b.dataset.id); if(!p)return;
  if(b.dataset.action==="start") startWorkout(p); if(b.dataset.action==="edit") openEditor(p);
  if(b.dataset.action==="up" && movePreset(data.presets,p.id,-1)) persist();
  if(b.dataset.action==="down" && movePreset(data.presets,p.id,1)) persist();
  if(b.dataset.action==="duplicate") { data.presets.push({...p,id:crypto.randomUUID(),name:`${p.name} – kopie`}); persist(); }
  if(b.dataset.action==="delete" && confirm(`Smazat „${p.name}“?`)) { data.presets=data.presets.filter(x=>x.id!==p.id); persist(); }
});
$("new-preset").addEventListener("click",()=>openEditor()); document.querySelectorAll(".close").forEach(b=>b.addEventListener("click",()=>dialog.close()));
form.addEventListener("submit", e => { e.preventDefault(); const preset={id:$("preset-id").value||crypto.randomUUID(),name:$("name").value.trim(),work:parseDuration($("work").value),rest:parseDuration($("rest").value),rounds:Number($("rounds").value),startDelay:Number($("start-delay").value),warning:Number($("warning").value),audioMode:$("audio-mode").value};
  if(!preset.name || !Number.isFinite(preset.work) || preset.work<=0 || !Number.isFinite(preset.rest) || preset.rest<0) return;
  const i=data.presets.findIndex(p=>p.id===preset.id); if(i<0)data.presets.push(preset);else data.presets[i]=preset;
  data.preferences.volume=Number($("volume").value); persist(); dialog.close();
});
$("pause").addEventListener("click",()=>engine.state===TimerState.PAUSED?engine.resume():engine.pause()); $("restart").addEventListener("click",()=>engine.restartPhase()); $("skip").addEventListener("click",()=>engine.nextPhase());
const stopStart=()=>{ holdTimer=setTimeout(()=>{ engine.stop(); wakeLock.release(); tts.cancel(); timer.classList.add("hidden"); setup.classList.remove("hidden"); cancelAnimationFrame(frame); navigator.vibrate?.(50); },900); };
const stopCancel=()=>clearTimeout(holdTimer); $("stop").addEventListener("pointerdown",stopStart); ["pointerup","pointerleave","pointercancel"].forEach(n=>$("stop").addEventListener(n,stopCancel));
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible" && ![TimerState.IDLE,TimerState.FINISHED].includes(engine.state)){engine.update();wakeLock.acquire();} });
window.addEventListener("pagehide",()=>wakeLock.release());
renderPresets(); if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
