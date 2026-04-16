import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// In-memory audio cache: md5(text+lang) → Buffer
const cache = new Map();
const MAX_CACHE = 60;

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

router.post('/tts', async (req, res) => {
  const { text, language = 'ta' } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  // Matilda (premade, free tier, excellent Tamil pronunciation)
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'XrExE9yKIg1WjnnlVkGX';

  if (!apiKey) {
    return res.status(503).json({ error: 'audio_unavailable', reason: 'no_api_key' });
  }

  const cacheKey = md5(text + language);
  if (cache.has(cacheKey)) {
    const buf = cache.get(cacheKey);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('X-Cache', 'HIT');
    return res.send(buf);
  }

  try {
    // Use eleven_multilingual_v2 — handles Tamil + English in same voice
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=3`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!elRes.ok) {
      const errText = await elRes.text().catch(() => '');
      console.error(`[TTS] ElevenLabs ${elRes.status}:`, errText.slice(0, 200));
      return res.status(503).json({ error: 'audio_unavailable', status: elRes.status });
    }

    const arrayBuf = await elRes.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    // Evict oldest entry if cache is full
    if (cache.size >= MAX_CACHE) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(cacheKey, buf);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('X-Cache', 'MISS');
    return res.send(buf);
  } catch (err) {
    console.error('[TTS] Error:', err.message);
    return res.status(503).json({ error: 'audio_unavailable' });
  }
});

export default router;
