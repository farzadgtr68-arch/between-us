const { sendJson, readJson } = require('../lib/http');
const { getSession } = require('../lib/auth');
const { updateRows, getProfileByUserId } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(req, 10_000).catch(() => ({}));
    const session = await getSession(req);
    if (!session.user) {
      return sendJson(res, 401, { error: 'Log in before upgrading.', login_required: true });
    }

    const email = normalizeEmail(session.user.email || body.email);
    const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
    const price = String(process.env.STRIPE_PRICE_FAMILY_PLUS || '').trim();

    if (!key || !price) {
      return sendJson(res, 501, {
        error: 'Stripe is not configured yet.',
        setup_required: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_FAMILY_PLUS'],
        optional: ['STRIPE_WEBHOOK_SECRET']
      });
    }

    if (!key.startsWith('sk_')) return sendJson(res, 500, { error: 'Stripe secret key must start with sk_.' });
    if (!price.startsWith('price_')) return sendJson(res, 500, { error: 'Stripe price id must start with price_.' });

    const profile = session.profile || await getProfileByUserId(session.user.id).catch(() => null);
    const customerId = profile?.stripe_customer_id || await createStripeCustomer({ key, email, userId: session.user.id });

    if (!profile?.stripe_customer_id && customerId) {
      await updateRows('user_profiles', {
        stripe_customer_id: customerId,
        email,
        updated_at: new Date().toISOString()
      }, `user_id=eq.${encodeURIComponent(session.user.id)}`).catch(error => console.error('Could not save Stripe customer:', error.message));
    }

    const origin = String(process.env.PUBLIC_SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
    const params = new URLSearchParams({
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      allow_promotion_codes: 'true',
      billing_address_collection: 'auto',
      client_reference_id: session.user.id,
      'metadata[product]': 'family_plus',
      'metadata[user_id]': session.user.id,
      'subscription_data[metadata][product]': 'family_plus',
      'subscription_data[metadata][user_id]': session.user.id
    });

    const response = await stripeRequest(key, 'checkout/sessions', params);
    if (!response.ok) return sendJson(res, response.status, { error: response.data.error?.message || 'Stripe checkout failed.' });

    return sendJson(res, 200, { url: response.data.url, id: response.data.id, mode: 'checkout_session' });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: 'Could not start checkout.' });
  }
};

async function createStripeCustomer({ key, email, userId }) {
  const params = new URLSearchParams({
    email,
    'metadata[user_id]': userId,
    'metadata[product]': 'between_us'
  });
  const response = await stripeRequest(key, 'customers', params);
  if (!response.ok) throw new Error(response.data.error?.message || 'Could not create Stripe customer.');
  return response.data.id;
}

async function stripeRequest(key, path, params) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) console.error('Stripe error:', response.status, data.error?.message || data);
  return { ok: response.ok, status: response.status, data };
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 240) : '';
}
