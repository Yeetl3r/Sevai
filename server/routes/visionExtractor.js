import { Router } from 'express';
import { getGemini, MODEL } from '../middleware/geminiClient.js';

const router = Router();

router.post('/extract-document', async (req, res) => {
    const { image, field, lang } = req.body;
    
    if (!image) {
        return res.status(400).json({ error: "No image provided" });
    }

    const gemini = getGemini();
    if (!gemini) {
        return res.status(503).json({ error: "AI services are currently offline. Please use manual options." });
    }

    try {
        let base64Data = image;
        let mimeType = 'image/jpeg';
        if (image.includes(';base64,')) {
            const parts = image.split(';base64,');
            mimeType = parts[0].replace('data:', '');
            base64Data = parts[1];
        }

        // Catch empty/corrupt base64 captures (e.g., from an uninitialized canvas creating 'data:,')
        if (!base64Data || base64Data === 'data:,') {
            return res.status(400).json({ error: "Corrupted image data captured. Please wait for camera to focus and try again." });
        }

        const prompt = `
You are a strict, secure document verification agent for a government Tamil Nadu platform.
The user was asked to provide a document to extract information for the EXACT field: "${field}".

YOUR TASK:
1. First, verify whether the provided image is a valid, relevant document that would logically contain information about the field "${field}". 
For example:
- If field="age" or "gender" or "name", an Aadhaar card, PAN card, or birth certificate is valid.
- If field="annual_income", an Aadhaar card is INVALID. We need an Income Certificate or pay stub.
- If the image is just a picture of a floor, keyboard, or completely irrelevant, it is INVALID.

2. If it is INVALID: Return exactly this JSON: { "error": "This document does not match the requested field. Please try again or use the buttons." }
3. If it is VALID: Extract the specific value corresponding to "${field}" from the document.
Return exact JSON format: { "value": "<the_extracted_value>" }

DO NOT include markdown block formatting like \`\`\`json. Return exclusively raw JSON.
`;

        const result = await gemini.models.generateContent({
            model: MODEL,
            contents: [
                prompt,
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                }
            ]
        });

        const responseText = result.text || (result.candidates && result.candidates[0]?.content?.parts[0]?.text) || "";
        const textResponse = responseText.trim().replace(/```json/g, '').replace(/```/g, '');
        
        try {
            const parsed = JSON.parse(textResponse);
            if (parsed.error) {
                // Meaning Gemini specifically rejected it as an invalid document type
                return res.status(422).json({ error: parsed.error });
            }
            return res.json(parsed);
        } catch (jsonErr) {
            console.error("Gemini didn't return valid JSON", textResponse);
            return res.status(500).json({ error: "Failed to parse document data." });
        }

    } catch (err) {
        console.error("Vision Extractor Error:", err.message, err.stack);
        return res.status(500).json({ 
            error: "An internal AI error occurred during processing.",
            details: err.message
        });
    }
});

export default router;
