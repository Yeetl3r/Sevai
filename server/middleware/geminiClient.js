import { GoogleGenAI } from '@google/genai';

// Singleton Gemini client
let client = null;

export const getGemini = () => {
    if (client) return client;
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    client = new GoogleGenAI({ apiKey: key });
    return client;
};

export const MODEL = 'gemini-2.0-flash';

/**
 * 
 * @param {Object} params 
 * @param {Buffer} [params.mediaBuffer] - The raw multimodal buffer (audio or image)
 * @param {string} [params.mimeType] - The mimetype (e.g. 'audio/ogg', 'image/jpeg')
 * @returns {Promise<string>}
 */
export async function processMultimodal({ system, user, mediaBuffer, mimeType, maxTokens = 400 }) {
    const c = getGemini();
    if (!c) {
        const err = new Error('no_api_key');
        err.code = 'no_api_key';
        throw err;
    }

    const contents = [];
    
    // Add text parts
    if (user) {
        contents.push(user);
    }

    // Add media parts securely from buffer (In-Memory Sandbox)
    if (mediaBuffer && mimeType) {
        contents.push({
            inlineData: {
                data: mediaBuffer.toString("base64"),
                mimeType: mimeType
            }
        });
    }

    const result = await c.models.generateContent({
        model: MODEL,
        contents: contents,
        config: {
            systemInstruction: system,
            maxOutputTokens: maxTokens,
            temperature: 0.2 // Low temp for extraction tasks
        }
    });

    const responseText = result.text || (result.candidates && result.candidates[0]?.content?.parts[0]?.text) || "";
    const textResponse = responseText.trim().replace(/```json/g, '').replace(/```/g, '');
    return textResponse;
}
