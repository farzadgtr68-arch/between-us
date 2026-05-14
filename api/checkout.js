const { sendJson, readJson } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    await readJson(req, 10_000).catch(() => ({}));
    const key = process.env.STRIPE_SECRET_KEY;
    const price = process.env.STRIPE_PRICE_FAMILY_PLUS;
    if (!key || !price) return sendJson(res, 501, { error: 'Stripe is not configured yet.' });

    const origin = process.env.PUBLIC_SITE_URL || `https://${req.headers.host}`;
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      allow_promotion_codes: 'true',
      billing_address_collection: 'auto'
    });

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const data = await response.json();
    if (!response.ok) return sendJson(res, response.status, { error: data.error?.message || 'Stripe checkout failed.' });
    return sendJson(res, 200, { url: data.url, id: data.id });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: 'Could not start checkout.' });
  }
};
