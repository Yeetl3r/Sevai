import { Router } from 'express';
import twilio from 'twilio';
import axios from 'axios';
import { processMessage } from '../services/botFlow.js';

const router = Router();
const { MessagingResponse } = twilio.twiml;

router.get('/webhook', (req, res) => {
  res.send('🌾 Sevai-Scout WhatsApp Webhook is active and waiting for Twilio POST events.');
});

router.post('/webhook', async (req, res) => {
  const { Body, From, NumMedia, MediaUrl0, MediaContentType0 } = req.body;
  const phone = From.replace('whatsapp:', '');
  
  console.log(`[WhatsApp] Message from ${phone}: ${Body || '(Media)'}`);

  let mediaPayload = null;

  if (NumMedia && parseInt(NumMedia) > 0) {
      try {
          console.log(`[WhatsApp] Downloading media from ${MediaUrl0}`);
          const response = await axios.get(MediaUrl0, { responseType: 'arraybuffer' });
          mediaPayload = {
              buffer: Buffer.from(response.data),
              mimeType: MediaContentType0
          };
      } catch (e) {
          console.error("Failed to download Twilio media", e);
      }
  }

  const response = await processMessage(phone, Body, 'whatsapp', mediaPayload);
  
  const twiml = new MessagingResponse();
  let bodyText = response.text;
  
  // Basic Text fallback for WhatsApp options (Twilio Sandbox constraints)
  if (response.options && response.options.length > 0) {
    const optionsText = response.options.map((opt, i) => `\n${i + 1}. ${opt}`).join('');
    bodyText += '\n' + optionsText;
  }
  
  const msg = twiml.message(bodyText);

  // If a QR token was generated, send the ephemeral image via Twilio Media
  if (response.qrToken) {
    const publicUrl = process.env.PUBLIC_URL || 'https://localhost:5001';
    msg.media(`${publicUrl}/api/secure/qr/${response.qrToken}`);
  }

  res.type('text/xml').send(twiml.toString());
});

export default router;
