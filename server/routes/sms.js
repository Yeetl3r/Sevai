import { Router } from 'express';
import twilio from 'twilio';
import { processMessage } from '../services/botFlow.js';

const router = Router();
const { MessagingResponse } = twilio.twiml;

router.post('/webhook', async (req, res) => {
  const { Body, From } = req.body;
  const phone = From; 
  
  console.log(`[SMS] Message from ${phone}: ${Body}`);

  const response = await processMessage(phone, Body, 'sms');
  
  const twiml = new MessagingResponse();
  
  let bodyText = response.text;
  if (response.options && response.options.length > 0) {
    const optionsText = response.options.map((opt, i) => `\n${i + 1}. ${opt}`).join('');
    bodyText += '\n' + optionsText;
  }
  
  twiml.message(bodyText);

  res.type('text/xml').send(twiml.toString());
});

export default router;
