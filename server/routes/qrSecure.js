import { Router } from 'express';
import QRCode from 'qrcode';
import crypto from 'crypto';
import db from '../db/schema.js';
import { MODEL } from '../middleware/geminiClient.js';

const router = Router();

// [NEW] API to generate a manual QR token (for testing/frontend integration)
router.post('/generate', (req, res) => {
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ error: "Phone number required" });
    }

    try {
        const token = crypto.randomBytes(4).toString('hex').toUpperCase();
        // Ensure user exists or handle FK loosely for demo
        db.prepare("INSERT OR IGNORE INTO users (phone, onboarding_complete) VALUES (?, 0)").run(phone);
        db.prepare("INSERT INTO access_tokens (user_phone, token, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))").run(phone, token);
        
        res.json({ 
            success: true, 
            token: token, 
            view_url: `/api/secure/qr/${token}` 
        });
    } catch (e) {
        console.error("Token Generation Error:", e);
        res.status(500).json({ error: "Failed to generate token" });
    }
});

// /api/secure/qr/:token
router.get('/:token', async (req, res) => {
    const { token } = req.params;

    // Check if token exists, is not revoked, and is not expired
    const row = db.prepare(`SELECT * FROM access_tokens WHERE token = ? AND is_revoked = 0 AND expires_at > datetime('now')`).get(token);

    if (!row) {
        // Return a broken/expired placeholder image or 404
        return res.status(404).send('Token expired or revoked.');
    }

    try {
        console.log(`Generating QR for token: ${token} using model: ${MODEL}`);
        const qrBuffer = await QRCode.toBuffer(token, {
            type: 'png',
            width: 300,
            color: {
                dark: '#2C5F2D', 
                light: '#FFFFFF'
            }
        });
        
        res.type('image/png').send(qrBuffer);
    } catch (e) {
        console.error("QR Code Error:", e);
        res.status(500).send('Internal Server Error');
    }
});

export default router;
