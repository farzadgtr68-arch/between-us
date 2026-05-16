const { sendJson } = require('../lib/http');

module.exports = function handler(req, res) {
  return sendJson(res, 200, {
    ok: true,
    service: 'between-us',
    openai: Boolean(process.env.OPENAI_API_KEY),
    supabase: Boolean(process.env.SUPABASE_URL),
    googleAuth: String(process.env.GOOGLE_AUTH_ENABLED || '').toLowerCase() === 'true',
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    resend: Boolean(process.env.RESEND_API_KEY)
  });
};
