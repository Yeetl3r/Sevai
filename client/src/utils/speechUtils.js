// speechUtils.js
// TTS is now handled by ElevenLabs via the useTTS hook (hooks/useTTS.js).
// This file keeps:
//   • createRecorder  — MediaRecorder for voice input during onboarding
//   • playSuccessChime — Web Audio API chime on application success
//   • speak / stopSpeaking — kept as thin stubs so any remaining
//     import sites don't blow up; they fall through to speechSynthesis.

// ─── Success chime (Web Audio API) ──────────────────────────────────────────
export const playSuccessChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [
      { f: 660, t: 0.0, d: 0.18 },
      { f: 990, t: 0.18, d: 0.28 },
    ].forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.25, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + d + 0.02);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch { /* audio unavailable */ }
};

// ─── MediaRecorder helper for onboarding voice input ────────────────────────
export const createRecorder = () => {
  let mediaRecorder = null;
  let chunks = [];
  let stream = null;
  let recording = false;

  const start = async () => {
    if (recording) return;
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.start();
    recording = true;
  };

  const stop = () =>
    new Promise((resolve) => {
      if (!mediaRecorder || !recording) return resolve(null);
      mediaRecorder.onstop = () => {
        recording = false;
        stream?.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: 'audio/webm' }));
      };
      mediaRecorder.stop();
    });

  const abort = () => {
    if (!recording) return;
    try { mediaRecorder?.stop(); } catch (_) {}
    stream?.getTracks().forEach((t) => t.stop());
    recording = false;
  };

  return { start, stop, abort, isRecording: () => recording };
};

// ─── Legacy stubs (use useTTS hook instead) ──────────────────────────────────
export const speak = async (text, lang = 'ta', { onEnd } = {}) => {
  if (!('speechSynthesis' in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
  u.rate = 0.92;
  u.onend = () => { onEnd?.(); };
  window.speechSynthesis.speak(u);
};

export const stopSpeaking = () => {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
};

export const hasTamilVoice = async () => {
  // With ElevenLabs we always support Tamil; return true so the banner never shows.
  return true;
};
