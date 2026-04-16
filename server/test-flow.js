import db, { initDB } from './db/schema.js';
import { processMessage } from './services/botFlow.js';

async function test() {
  console.log('Testing botFlow processMessage directly...');
  try {
    const r1 = await processMessage('testphone999', '/start', 'telegram');
    console.log('R1:', r1);

    const r2 = await processMessage('testphone999', '1', 'telegram');
    console.log('R2:', r2);
  } catch(e) {
    console.error('Test Failed:', e);
  }
}
test();
