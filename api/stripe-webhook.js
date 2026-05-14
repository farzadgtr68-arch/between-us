const crypto = require('crypto');
const { insertRow } = require('../lib/supabase');
const { sendJson } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const raw = await readRaw(req);
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (secret && !verifyStripeSignature(raw, req.headers['stripe-signature'], secret)) {
      return sendJson(res, 400, { error: 'Invalid Stripe signature' });
    }

    const event = JSON.parse(raw || '{}');

    if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
      await insertRow('stripe_events', {
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event
      }).catch(error => {
        if (!String(error.message).includes('23505')) throw error;
      });
    }

    return sendJson(res, 200, { received: true });
  } catch (error) {
    console.error(error);
    return sendJson(res, 400, { error: 'Webhook error' });
  }
};

function readRaw(req, limit = 500_000) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > limit) {
        const err = new Error('Payload too large');
        err.status = 413;
        req.destroy(err);
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function verifyStripeSignature(payload, header, secret) {
  if (!header) return false;
  const parts = Object.fromEntries(String(header).split(',').map(part => part.split('=')));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
