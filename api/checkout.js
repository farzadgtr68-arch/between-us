const { sendJson, readJson } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(req, 10_000).catch(() => ({}));
    const email = normalizeEmail(body.email);
    const paymentLink = String(process.env.STRIPE_PAYMENT_LINK_URL || '').trim();
    const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
    const price = String(process.env.STRIPE_PRICE_FAMILY_PLUS || '').trim();

    // Fastest no-code fallback: if Farzad creates a Stripe Payment Link in the dashboard,
    // we can use it immediately without server-side Checkout Sessions.
    if (paymentLink && !key) {
      return sendJson(res, 200, { url: withPrefilledEmail(paymentLink, email), mode: 'payment_link' });
    }

    if (!key || !price) {
      return sendJson(res, 501, {
        error: 'Stripe is not configured yet.',
        setup_required: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_FAMILY_PLUS'],
        optional: ['STRIPE_WEBHOOK_SECRET', 'STRIPE_PAYMENT_LINK_URL']
      });
    }

    if (!key.startsWith('sk_')) {
      return sendJson(res, 500, { error: 'Stripe secret key must start with sk_.' });
    }

    if (!price.startsWith('price_')) {
      return sendJson(res, 500, { error: 'Stripe price id must start with price_.' });
    }

    const origin = String(process.env.PUBLIC_SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      allow_promotion_codes: 'true',
      billing_address_collection: 'auto',
      'metadata[product]': 'family_plus',
      'subscription_data[metadata][product]': 'family_plus'
    });

    if (email) params.set('customer_email', email);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Stripe checkout error:', response.status, data.error?.message || data);
      return sendJson(res, response.status, { error: data.error?.message || 'Stripe checkout failed.' });
    }

    return sendJson(res, 200, { url: data.url, id: data.id, mode: 'checkout_session' });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: 'Could not start checkout.' });
  }
};

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 240) : '';
}

function withPrefilledEmail(url, email) {
  if (!email) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('prefilled_email', email);
    return parsed.toString();
  } catch {
    return url;
  }
}
