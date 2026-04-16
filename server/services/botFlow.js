import db from '../db/schema.js';
import { t, tf } from '../data/strings.js';
import { DISTRICTS } from '../data/districts.js';
import { processMultimodal } from '../middleware/geminiClient.js';
import { evaluateAll, totalBenefitValue } from './eligibilityEngine.js';

const STEPS = [
  { key: 'language', prompt: 'bot_greet' },
  { key: 'age', prompt: 'bot_age' },
  { key: 'occupation', prompt: 'bot_occupation' },
  { key: 'district', prompt: 'bot_district' },
  { key: 'annual_income', prompt: 'bot_income' },
  { key: 'caste', prompt: 'bot_caste' },
  { key: 'gender', prompt: 'bot_gender' },
];

export async function processMessage(phone, text, platform = 'whatsapp', media = null) {
  text = text || ''; // Safeguard against bare media without captions
  // 1. Get user session or user
  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  let session = db.prepare('SELECT * FROM sessions WHERE phone = ?').get(phone);

  // If user already fully onboarded but messaging us, they might be asking for schemes or resetting
  if (user && user.onboarding_complete) {
    if (text.toLowerCase().includes('reset') || text === '/start') {
      db.prepare('DELETE FROM users WHERE phone = ?').run(phone);
      db.prepare('DELETE FROM sessions WHERE phone = ?').run(phone);
      return { text: 'Session reset. Reply with anything to start again.', options: [] };
    }
    // Return feed summary
    const { eligible } = evaluateAll(user);
    const count = eligible.length;
    const value = totalBenefitValue(eligible);
    const lang = user.language || 'ta';
    
    let msg = tf('wow_qualify_for', lang, { N: count }) + '\n' + t('wow_total_value', lang) + ': ₹' + value + '\n\n';
    msg += eligible.slice(0, 3).map((e, i) => `${i+1}. ${e.scheme.name_plain}`).join('\n');
    
    return { text: msg, options: ['Reset'] };
  }

  // Define logic for extracting value based on step
  const currentStepKey = session ? session.current_step : 'language';
  const data = session ? JSON.parse(session.data_json) : {};
  const lang = data.language || 'ta';

  // Handle first contact OR if user typed /start mid-session
  if (!session || text === '/start') {
    if (session) db.prepare('DELETE FROM sessions WHERE phone = ?').run(phone);
    db.prepare('INSERT INTO sessions (phone, current_step, data_json) VALUES (?, ?, ?)').run(
      phone,
      'language',
      JSON.stringify({ language: 'ta' })
    );
    return { 
      text: t('bot_greet', 'ta'), 
      options: ['தமிழ்', 'English'] 
    };
  }

  // Process current step answer
  try {
    const extracted = await extractValue(currentStepKey, text, lang, media);
    if (extracted.error) {
      return { text: "I didn't quite catch that. Please upload a clear photo/voice note or pick an option.", options: getOptionsForStep(currentStepKey, lang) };
    }

    data[currentStepKey] = extracted.value;
    if (currentStepKey === 'language') data.language = extracted.value;

    // Move to next step
    const currentIndex = STEPS.findIndex(s => s.key === currentStepKey);
    if (currentIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentIndex + 1];
      db.prepare('UPDATE sessions SET current_step = ?, data_json = ? WHERE phone = ?').run(
        nextStep.key,
        JSON.stringify(data),
        phone
      );
      return { 
        text: t(nextStep.prompt, data.language), 
        options: getOptionsForStep(nextStep.key, data.language) 
      };
    } else {
      // Completed onboarding
      db.prepare('INSERT INTO users (phone, language, age, occupation, district, annual_income, caste, gender, onboarding_complete) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)').run(
        phone,
        data.language,
        data.age,
        data.occupation,
        data.district,
        data.annual_income,
        data.caste,
        data.gender
      );
      db.prepare('DELETE FROM sessions WHERE phone = ?').run(phone);

      const { eligible } = evaluateAll(data);
      const count = eligible.length;
      const value = totalBenefitValue(eligible);
      
      const crypto = await import('crypto');
      const token = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 char unique code
      db.prepare("INSERT INTO access_tokens (user_phone, token, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))").run(phone, token);

      let msg = t('bot_finishing', data.language) + '\n\n';
      msg += tf('wow_qualify_for', data.language, { N: count }) + '\n';
      msg += t('wow_total_value', data.language) + ': ₹' + value + '\n\n';
      msg += `🔑 Unique ID: ${token}\n(Valid for 15 mins)`;

      return { text: msg, options: ['View Schemes', 'Revoke Access'], qrToken: token };
    }
  } catch (err) {
    console.error('Bot flow error:', err);
    return { text: 'Technical error. Please try later.', options: [] };
  }
}

async function extractValue(stepKey, text, lang, media) {
  const options = getOptionsForStep(stepKey, lang);
  const numericChoice = parseInt(text);
  if (!isNaN(numericChoice) && numericChoice > 0 && numericChoice <= options.length) {
    const selected = options[numericChoice - 1];
    // Special handling for language
    if (stepKey === 'language') return { value: selected === 'தமிழ்' ? 'ta' : 'en' };
    // Map back to key if needed, or just return the text
    return { value: selected };
  }

  // Language step: simple check
  if (stepKey === 'language') {
    if (text.toLowerCase().includes('tamil') || text.includes('தமிழ்')) return { value: 'ta' };
    if (text.toLowerCase().includes('english')) return { value: 'en' };
    return { error: true };
  }

  // For others, use Claude or simple matching
  // In a real app, I'd use the same intentExtraction route logic
  if (stepKey === 'gender') {
    const lower = text.toLowerCase();
    if (lower.includes('yes') || lower.includes('ஆம்') || lower.includes('female') || lower.includes('பெண்')) return { value: 'female' };
    return { value: 'male' };
  }

  // Pass to Gemini (Text or Multimodal)
  const SYSTEM_PROMPT = `Extract ${stepKey} from the user's reply or document. User is speaking/typing ${lang === 'ta' ? 'Tamil' : 'English'}. Return ONLY a JSON block: { "value": ... }`;
  try {
    let raw;
    if (media) {
         raw = await processMultimodal({ system: SYSTEM_PROMPT, user: "Extract the required information from this file/audio.", mediaBuffer: media.buffer, mimeType: media.mimeType, maxTokens: 100 });
    } else {
         raw = await processMultimodal({ system: SYSTEM_PROMPT, user: text, maxTokens: 100 });
    }
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");
    const json = JSON.parse(match[0]);
    return { value: json.value };
  } catch (e) {
    if (media) return { error: true }; // Require retry for bad media
    // Basic heuristic fallbacks

    if (stepKey === 'age') return { value: parseInt(text) || 30 };
    if (stepKey === 'annual_income') return { value: parseInt(text.replace(/[^0-9]/g, '')) || 50000 };
    return { value: text };
  }
}

function getOptionsForStep(stepKey, lang) {
  switch (stepKey) {
    case 'language': return ['தமிழ்', 'English'];
    case 'age': return ['18-25', '26-40', '41-60', '60+'];
    case 'occupation': return ['Farmer', 'Student', 'Worker', 'Business', 'Homemaker'];
    case 'district': return DISTRICTS.slice(0, 5).map(d => lang === 'ta' ? d.ta : d.en);
    case 'caste': return ['General', 'OBC', 'SC', 'ST'];
    case 'gender': return [t('yes', lang), t('no', lang)];
    default: return [];
  }
}
