import { useState, useCallback, useEffect } from 'react';

// ─── Module-level singleton ─────────────────────────────────────────────────
// One Audio element shared across all useTTS callers so only one thing plays.
let _audio = null;
const _playingSetters = new Set();  // every mounted hook registers its setIsPlaying
const _loadingSetters = new Set();

function getAudio() {
  if (typeof window === 'undefined') return null;
  if (!_audio) {
    _audio = new Audio();
    _audio.addEventListener('ended', () => {
      _playingSetters.forEach((fn) => fn(false));
    });
    _audio.addEventListener('error', () => {
      _playingSetters.forEach((fn) => fn(false));
      _loadingSetters.forEach((fn) => fn(false));
    });
  }
  return _audio;
}

function stopGlobal() {
  const a = getAudio();
  if (a) {
    a.pause();
    a.src = '';
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  _playingSetters.forEach((fn) => fn(false));
  _loadingSetters.forEach((fn) => fn(false));
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Register with singletons so stopGlobal() updates every consumer
  useEffect(() => {
    _playingSetters.add(setIsPlaying);
    _loadingSetters.add(setIsLoading);
    return () => {
      _playingSetters.delete(setIsPlaying);
      _loadingSetters.delete(setIsLoading);
    };
  }, []);

  const speak = useCallback(async (text, language = 'ta', { onEnd } = {}) => {
    if (!text) return;
    const audio = getAudio();
    if (!audio) return;

    // Kill whatever is playing
    stopGlobal();
    setIsLoading(true);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });

      if (!res.ok) throw new Error(`tts_http_${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      audio.src = url;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        _playingSetters.forEach((fn) => fn(false));
        onEnd?.();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        _playingSetters.forEach((fn) => fn(false));
        _loadingSetters.forEach((fn) => fn(false));
        onEnd?.();
      };

      await audio.play();
      _loadingSetters.forEach((fn) => fn(false));
      _playingSetters.forEach((fn) => fn(true));
    } catch (err) {
      // Graceful fallback: browser speechSynthesis
      _loadingSetters.forEach((fn) => fn(false));
      _playingSetters.forEach((fn) => fn(false));
      if ('speechSynthesis' in window && text) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
        utter.rate = 0.92;
        utter.onend = () => onEnd?.();
        window.speechSynthesis.speak(utter);
      } else {
        onEnd?.();
      }
    }
  }, []);

  const stop = useCallback(() => stopGlobal(), []);

  return { speak, stop, isPlaying, isLoading };
}

// ─── Convenience imperative version (for non-hook contexts) ─────────────────
export async function speakImperative(text, language = 'ta', { onEnd } = {}) {
  if (!text) return;
  const audio = getAudio();
  if (!audio) return;
  stopGlobal();
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) throw new Error('tts_unavailable');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    audio.src = url;
    audio.onended = () => { URL.revokeObjectURL(url); onEnd?.(); };
    audio.onerror = () => { URL.revokeObjectURL(url); onEnd?.(); };
    await audio.play();
  } catch {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
      u.onend = () => onEnd?.();
      window.speechSynthesis.speak(u);
    } else { onEnd?.(); }
  }
}

export { stopGlobal as stopTTS };
