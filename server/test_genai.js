import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();
const key = process.env.GEMINI_API_KEY;
const gemini = new GoogleGenAI({ apiKey: key });

const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; // 1x1 pixel png
const mimeType = "image/png";

async function test() {
    try {
        const result = await gemini.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: ["What is this?", {inlineData: { data: base64Data, mimeType }}]
        });
        console.log("Success!", result.text);
    } catch(e) {
        console.error("FAIL", e);
    }
}
test();
