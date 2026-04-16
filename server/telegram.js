import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import { processMessage } from './services/botFlow.js';
import db from './db/schema.js';

let bot = null;

export function initTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.log("    ⚠  No TELEGRAM_BOT_TOKEN set — Telegram bot not enabled.");
        return;
    }

    bot = new Telegraf(token);

    // Initial greeting
    bot.start((ctx) => handleIncoming(ctx));

    // Listen for text
    bot.on('text', (ctx) => handleIncoming(ctx));

    // Listen to button clicks (Interactive UI)
    bot.on('callback_query', (ctx) => handleIncoming(ctx, ctx.callbackQuery.data));

    // Listen for Voice / Audio notes
    bot.on('voice', async (ctx) => handleIncomingMedia(ctx, ctx.message.voice.file_id, ctx.message.voice.mime_type));
    
    // Listen for Photos (Aadhaar / Documents)
    bot.on('photo', async (ctx) => {
        // Photos arrive as an array of resolutions. We grab the highest res.
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        handleIncomingMedia(ctx, fileId, 'image/jpeg');
    });

    bot.launch();
    console.log("    ✓  Telegram Bot configured and polling");

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

async function handleIncomingMedia(ctx, fileId, mimeType) {
    const phone = ctx.from.id.toString(); // Use Telegram user ID as 'phone'
    try {
        ctx.reply('Processing your file securely... 🔒');
        
        // Fetch file URL from Telegram servers
        const fileUrl = await ctx.telegram.getFileLink(fileId);
        
        // Download into memory Buffer (Sandbox mode)
        const response = await axios.get(fileUrl.href, { responseType: 'arraybuffer' });
        const mediaPayload = {
            buffer: Buffer.from(response.data),
            mimeType: mimeType
        };

        const result = await processMessage(phone, "Analyzed Media", 'telegram', mediaPayload);
        sendResponse(ctx, result);
    } catch (e) {
        console.error("Telegram Media Error:", e);
        ctx.reply("Sorry, I had trouble processing that file.");
    }
}

async function handleIncoming(ctx, callbackData = null) {
    const text = callbackData || ctx.message?.text || '';
    const phone = ctx.from.id.toString();

    // Revocation command manually typed or via callback
    if (text.toLowerCase() === 'revoke access') {
        db.prepare(`UPDATE access_tokens SET is_revoked = 1 WHERE user_phone = ?`).run(phone);
        return ctx.reply("Your data access and QR code have been permanently revoked.");
    }

    const result = await processMessage(phone, text, 'telegram');
    sendResponse(ctx, result);

    if (callbackData) {
        ctx.answerCbQuery();
    }
}

function sendResponse(ctx, result) {
    let extraData = {};
    if (result.options && result.options.length > 0) {
        // Create interactive inline keyboard options matching the result
        const buttons = result.options.map((opt, index) => {
            // For simple step parsing like age/language we pass the 1-indexed number just like WhatsApp SMS does
            // Or we just pass the text. Since botFlow handles numbered and exact text matches we pass index+1.
            const idx = (index + 1).toString();
            // We pass the string exactly as it is for text match, or just use the option itself
            return [Markup.button.callback(opt, opt === 'Revoke Access' ? 'Revoke Access' : idx)];
        });
        extraData = Markup.inlineKeyboard(buttons);
    }

    ctx.reply(result.text, extraData).then(() => {
        if (result.qrToken) {
            // For hackathon local testing, we send the QR if there's a public URL hook or just display the ID
            const publicUrl = process.env.PUBLIC_URL || 'https://localhost:5001';
            ctx.replyWithPhoto(`${publicUrl}/api/secure/qr/${result.qrToken}`);
        }
    });
}
