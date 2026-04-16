import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

async function listModels() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("No GEMINI_API_KEY");
    return;
  }
  const ai = new GoogleGenAI({ apiKey: key });
  try {
    const models = await ai.models.list();
    console.log(JSON.stringify(models, null, 2));
  } catch (e) {
    console.error("List Models Error:", e.message);
  }
}

listModels();
