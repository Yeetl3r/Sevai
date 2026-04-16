import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import intentExtraction from './routes/intentExtraction.js';
import schemeSummarizer from './routes/schemeSummarizer.js';
import whatsapp from './routes/whatsapp.js';
import sms from './routes/sms.js';
import qrSecure from './routes/qrSecure.js';
import { initDB } from './db/schema.js';
import { getClaude, MODEL } from './middleware/claudeClient.js';
import { getGemini } from './middleware/geminiClient.js';
import { initTelegramBot } from './telegram.js';
import visionExtractor from './routes/visionExtractor.js';
import tts from './routes/tts.js';
import scraper from './routes/scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// Mount both under /api
app.use('/api', intentExtraction);
app.use('/api', schemeSummarizer);
app.use('/api', visionExtractor);
app.use('/api', tts);
app.use('/api/scraper', scraper);
app.use('/api/whatsapp', whatsapp);
app.use('/api/sms', sms);
app.use('/api/secure/qr', qrSecure);

// Serve Static Frontend
app.use(express.static(path.join(__dirname, 'public')));

// SPA Catch-all (for React routing)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Health check — useful for demo day ("is Claude/Gemini wired up?")
app.get('/api/health', (_, res) => {
  const hasClaude = !!getClaude();
  const hasGemini = !!getGemini();
  res.json({
    ok: true,
    claude_configured: hasClaude,
    gemini_configured: hasGemini,
    message: hasGemini
      ? 'Gemini Multimodal API wired up and ready'
      : 'No GEMINI_API_KEY — falling back to local defaults',
  });
});

// Initialize DB
initDB();

// Initialize Telegram
initTelegramBot();

app.listen(PORT, () => {
  console.log(`\n🌾  Sevai-Scout server listening on http://localhost:${PORT}`);
  if (!getClaude() && !getGemini()) {
    console.log('    ⚠  No AI API Keys set — using local fallbacks for summaries & intent.');
  } else {
    if (getClaude()) console.log(`    ✓  Claude model: ${MODEL}`);
    if (getGemini()) console.log(`    ✓  Gemini Sandbox ready`);
  }
});
