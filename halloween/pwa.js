'use strict';
const settingsDialog = document.getElementById('settingsDialog');
document.getElementById('settingsButton').addEventListener('click', () => settingsDialog.showModal());
document.getElementById('closeSettings').addEventListener('click', () => settingsDialog.close());
settingsDialog.addEventListener('click', e => { if (e.target === settingsDialog) {
  const r = settingsDialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) settingsDialog.close();
} });
let effectsEnabled = false;
let voiceEnabled = false;
let voiceSource = null;
let voiceRequest = 0;
const voiceBuffers = new Map();
let importedAnswers = new Set();
let importingVoice = false;
const audioStatus = document.getElementById('audioStatus');
function reportAudio(message) { audioStatus.textContent = message; }
async function unlockAudio() {
  const ctx = getAudio();
  if (ctx.state !== 'running') await ctx.resume();
  if (ctx.state !== 'running') throw new Error('Audio blocked');
  return ctx;
}
function playEffect(effect) {
  if (!effectsEnabled) return;
  unlockAudio().then(() => { if (effectsEnabled) effect(); }).catch(() => reportAudio('Sound blocked. Tap Test sound to retry; check media volume or open this preview in Safari.'));
}
const soundButton = document.getElementById('soundButton');
soundButton.addEventListener('click', () => {
  effectsEnabled = !effectsEnabled;
  soundButton.setAttribute('aria-pressed', String(effectsEnabled));
  soundButton.textContent = effectsEnabled ? 'Sound on' : 'Sound off';
  if (effectsEnabled) playEffect(() => { revealSound(); reportAudio('Sound enabled. A two-note chime should play.'); });
  if (effectsBus) effectsBus.gain.setTargetAtTime(effectsEnabled ? (voiceSource ? .6 : 4) : 0, audioCtx.currentTime, .03);
});
async function loadRecording(text, ctx) {
  if (!importedAnswers.has(text)) throw new Error('Import your recordings first.');
  if (!voiceBuffers.has(text)) {
    const pending = VoiceStore.get(text).then(clip => {
      if (!clip || !clip.bytes) throw new Error('Recording missing from this device.');
      return ctx.decodeAudioData(clip.bytes.slice(0));
    });
    voiceBuffers.set(text, pending);
    pending.catch(() => voiceBuffers.delete(text));
  }
  return voiceBuffers.get(text);
}
function updateVoiceControls() {
  const available = importedAnswers.size > 0 && !importingVoice;
  const button = document.getElementById('voiceButton');
  button.disabled = !available;
  document.getElementById('testVoice').disabled = !available;
  document.getElementById('importVoice').disabled = importingVoice;
  if (!available) voiceEnabled = false;
  button.textContent = voiceEnabled ? 'Your voice on' : 'Your voice off';
  button.setAttribute('aria-pressed', String(voiceEnabled));
}
async function restorePrivateVoice() {
  try {
    const saved = await VoiceStore.listAnswers();
    importedAnswers = new Set(saved.filter(text => answers.includes(text)));
    document.getElementById('voiceStatus').textContent = importedAnswers.size ? importedAnswers.size + ' recordings saved on this device. No upload.' : 'Your recordings stay on this device. Import the voice pack once.';
  } catch (_) {
    document.getElementById('voiceStatus').textContent = 'This browser could not save recordings. Open the app in Safari and try again.';
  }
  updateVoiceControls();
}
document.getElementById('importVoice').addEventListener('click', () => document.getElementById('voiceFile').click());
document.getElementById('voiceFile').addEventListener('change', async event => {
  const input = event.currentTarget;
  const file = input.files[0];
  if (!file) return;
  await voiceStoreReady;
  stopVoice();
  voiceEnabled = false;
  importingVoice = true;
  updateVoiceControls();
  const message = document.getElementById('voiceStatus');
  message.textContent = 'Checking your voice pack…';
  try {
    const clips = await VoiceStore.parsePack(file,new Set(answers),(done,total) => { message.textContent = 'Preparing recordings ' + done + ' of ' + total + '…'; });
    await VoiceStore.replace(clips);
    voiceBuffers.clear();
    importedAnswers = new Set(clips.map(clip => clip.answer));
    message.textContent = clips.length + ' recordings saved on this device. Nothing uploaded. Turn Your voice on to play.';
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (error) {
    message.textContent = (error.message || 'The voice pack could not be saved.') + ' Your previous recordings are unchanged.';
  } finally {
    importingVoice = false;
    input.value = '';
    updateVoiceControls();
    checkOffline();
  }
});
function stopVoice() {
  voiceRequest++;
  if (voiceSource) { voiceSource.onended = null; try { voiceSource.stop(); } catch (_) {} voiceSource.disconnect(); voiceSource = null; }
  if (effectsBus) effectsBus.gain.setTargetAtTime(effectsEnabled ? 4 : 0, audioCtx.currentTime, .05);
}
document.getElementById('voiceButton').addEventListener('click', () => {
  if (!importedAnswers.size || importingVoice) { reportAudio('Import your voice pack first.'); return; }
  voiceEnabled = !voiceEnabled;
  const button = document.getElementById('voiceButton');
  button.textContent = voiceEnabled ? 'Your voice on' : 'Your voice off';
  button.setAttribute('aria-pressed', String(voiceEnabled));
  if (voiceEnabled) speakFortune(answers[0]);
  else { stopVoice(); reportAudio('Recorded voice off.'); }
});
async function speakFortune(text, preview = false) {
  if (!voiceEnabled && !preview) return;
  stopVoice();
  const request = voiceRequest;
  try {
    const ctx = await unlockAudio();
    const buffer = await loadRecording(text, ctx);
    if (request !== voiceRequest || (!voiceEnabled && !preview) || document.hidden) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    voiceSource = source;
    if (effectsBus) effectsBus.gain.setTargetAtTime(effectsEnabled ? .6 : 0,ctx.currentTime,.03);
    source.onended = () => {
      source.disconnect();
      if (voiceSource === source) {
        voiceSource = null;
        if (effectsBus) effectsBus.gain.setTargetAtTime(effectsEnabled ? 4 : 0,ctx.currentTime,.08);
      }
    };
    source.start();
    reportAudio('Playing your recording. Adjust the phone’s media volume for the room.');
  } catch (_) {
    if (request === voiceRequest) reportAudio('Recording could not play. Try Test your voice, or import your voice pack again.');
  }
}
document.getElementById('testSound').addEventListener('click', () => {
  unlockAudio().then(() => {
    if (effectsBus) effectsBus.gain.setTargetAtTime(4,audioCtx.currentTime,.01);
    revealSound();
    if (!effectsEnabled) setTimeout(() => { if (!effectsEnabled && effectsBus) effectsBus.gain.setTargetAtTime(0,audioCtx.currentTime,.03); }, 800);
    reportAudio('Test chime requested. If silent, check media volume and audio output.');
  }).catch(() => reportAudio('This browser blocked audio playback. Try Safari.'));
});
document.getElementById('testVoice').addEventListener('click', () => speakFortune(answers[0], true));
document.getElementById('smokeButton').addEventListener('click', e => {
  const disabled = document.body.classList.toggle('smoke-off');
  e.currentTarget.textContent = disabled ? 'Smoke off' : 'Smoke on';
  e.currentTarget.setAttribute('aria-pressed', String(!disabled));
});
let motionEnabled = false;
let lastMotion = null;
let lastPeak = 0;
let lastShake = 0;
function handleMotion(event) {
  if (document.hidden || settingsDialog.open || shaking || voiceSource) { lastMotion = null; return; }
  const a = event.accelerationIncludingGravity;
  if (!a || ![a.x,a.y,a.z].every(Number.isFinite)) return;
  const now = performance.now();
  if (lastMotion && now - lastMotion.time < 250) {
    const delta = Math.hypot(a.x-lastMotion.x,a.y-lastMotion.y,a.z-lastMotion.z);
    if (delta > 15 && now-lastShake > 2200) {
      if (now-lastPeak > 80 && now-lastPeak < 650) {
        lastShake = now;
        lastPeak = 0;
        shake();
      } else if (now-lastPeak > 650) lastPeak = now;
    }
  }
  lastMotion = {x:a.x,y:a.y,z:a.z,time:now};
}
document.getElementById('motionButton').addEventListener('click', async e => {
  const button = e.currentTarget;
  const message = document.getElementById('motionStatus');
  if (motionEnabled) {
    window.removeEventListener('devicemotion',handleMotion);
    motionEnabled = false;
    button.textContent = 'Enable shake';
    button.setAttribute('aria-pressed','false');
    message.textContent = 'Shake off. Tap the ball anytime.';
    return;
  }
  try {
    if (!window.isSecureContext || !window.DeviceMotionEvent) throw new Error('Unavailable');
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') throw new Error('Denied');
    }
    lastMotion = null; lastPeak = 0;
    window.addEventListener('devicemotion',handleMotion);
    motionEnabled = true;
    button.textContent = 'Shake on';
    button.setAttribute('aria-pressed','true');
    message.textContent = 'Give your phone a short shake. Tap the ball anytime.';
  } catch (_) { message.textContent = 'Motion unavailable or permission denied. Tap the ball instead.'; }
});
document.addEventListener('visibilitychange', () => {
  lastMotion = null; lastPeak = 0;
  if (document.hidden) stopVoice();
});
const offlineStatus = document.getElementById('offlineStatus');
const voiceStoreReady = restorePrivateVoice();
async function checkOffline() {
  await voiceStoreReady;
  const controller = navigator.serviceWorker.controller;
  if (!controller) return;
  const channel = new MessageChannel();
  const timer = setTimeout(() => { offlineStatus.textContent = 'Offline check timed out. Reopen online to try again.'; channel.port1.close(); }, 5000);
  channel.port1.onmessage = e => {
    clearTimeout(timer);
    channel.port1.close();
    offlineStatus.textContent = e.data.ready ? (importedAnswers.size ? 'Offline ready · app + ' + importedAnswers.size + ' private recordings' : 'Offline copy ready · import your voice pack for spoken answers') : 'Offline copy incomplete. Reopen online before the party.';
  };
  controller.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);
}
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.addEventListener('controllerchange',checkOffline);
  navigator.serviceWorker.register('./sw.js').then(async () => {
    await navigator.serviceWorker.ready;
    await checkOffline();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }).catch(() => { offlineStatus.textContent = 'Offline setup failed. Reopen online to try again.'; });
  window.addEventListener('online',checkOffline);
  window.addEventListener('offline',checkOffline);
} else offlineStatus.textContent = 'Offline setup needs Safari on an HTTPS website.';
