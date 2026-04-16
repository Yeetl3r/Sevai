import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from '../data/strings.js';
import { useTTS } from '../hooks/useTTS.js';

// "Kelungal" button — fetch Claude summary → ElevenLabs TTS with waveform.
const localCache = new Map();

export default function SamjhaoButton({ scheme, lang }) {
  const { speak, stop, isPlaying, isLoading } = useTTS();
  const [bullets, setBullets] = useState([]);
  const [audioText, setAudioText] = useState('');
  const [error, setError] = useState(null);
  // Track whether THIS button is the one currently active
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);

  // When isPlaying goes false externally (another button started), deactivate
  useEffect(() => {
    if (!isPlaying && activeRef.current) {
      setActive(false);
      activeRef.current = false;
    }
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRef.current) stop();
    };
  }, [stop]);

  const fetchSummary = async () => {
    const key = `${scheme.id}:${lang}`;
    if (localCache.has(key)) return localCache.get(key);
    const res = await fetch('/api/summarize-scheme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheme, language: lang }),
    });
    if (!res.ok) throw new Error('summary-failed');
    const data = await res.json();
    localCache.set(key, data);
    return data;
  };

  const handleClick = async (e) => {
    e.stopPropagation();

    // If THIS button is playing → stop
    if (active && isPlaying) {
      stop();
      setActive(false);
      activeRef.current = false;
      return;
    }

    setError(null);
    let textToSpeak = audioText;
    let bulletsToShow = bullets;

    // Need to fetch summary first?
    if (!textToSpeak) {
      try {
        const data = await fetchSummary();
        bulletsToShow = data.bullets || [];
        textToSpeak = data.audio_text || bulletsToShow.join('. ');
        setBullets(bulletsToShow);
        setAudioText(textToSpeak);
      } catch {
        const fallback = scheme.description_simple || [];
        bulletsToShow = fallback;
        textToSpeak = fallback.join('. ');
        setBullets(fallback);
        setAudioText(textToSpeak);
        setError(lang === 'ta' ? 'சுருக்கம் உள்ளூர் தகவலில் இருந்து' : 'Summary from local data');
      }
    }

    setActive(true);
    activeRef.current = true;
    speak(textToSpeak, lang, {
      onEnd: () => {
        setActive(false);
        activeRef.current = false;
      },
    });
  };

  // Determine display state: loading = fetching summary OR waiting for audio
  const showLoading = isLoading && active;
  const showPlaying = isPlaying && active;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleClick}
        disabled={isLoading && !active} // disabled only if another button is loading
        className="w-full bg-brand-green text-white rounded-2xl px-5 py-4 text-lg font-bold shadow-card active:scale-95 transition-transform flex items-center justify-center gap-3 disabled:opacity-60"
      >
        {showLoading ? (
          <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : showPlaying ? (
          <WaveformBars />
        ) : (
          <span className="text-xl">🔊</span>
        )}
        <span>
          {showLoading
            ? lang === 'ta' ? 'தயாராகிறது...' : 'Preparing...'
            : showPlaying
            ? lang === 'ta' ? 'பேசிக்கொண்டிருக்கிறது... (தடுக்க தட்டு)' : 'Playing… (tap to stop)'
            : t('listen_kelungal', lang)}
        </span>
      </button>

      <AnimatePresence>
        {bullets.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-1.5 text-[15px] text-brand-ink overflow-hidden"
          >
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand-green font-bold flex-shrink-0">✓</span>
                <span>{b.replace(/^[✓\-•]\s*/, '')}</span>
              </li>
            ))}
            {error && <li className="text-xs text-brand-muted italic">{error}</li>}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function WaveformBars() {
  return (
    <span className="flex items-end h-6 gap-[3px]">
      {[4, 6, 3, 5, 4].map((h, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-white wave-bar"
          style={{ height: `${h * 4}px`, animationDelay: `${i * 80}ms` }}
        />
      ))}
    </span>
  );
}
