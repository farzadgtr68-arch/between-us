const { sendJson, readJson } = require('../lib/http');
const { getSupabaseConfig, supabaseAuthRequest } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(req, 10_000).catch(() => ({}));
    const email = normalizeEmail(body.email);
    if (!email) return sendJson(res, 400, { error: 'Enter a valid email.' });

    const { url, anonKey } = getSupabaseConfig();
    if (!url || !anonKey) {
      return sendJson(res, 501, { error: 'Login is not configured yet.', setup_required: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] });
    }

    const origin = String(process.env.PUBLIC_SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
    await supabaseAuthRequest('otp', {
      method: 'POST',
      body: JSON.stringify({
        email,
        create_user: true,
        options: {
          email_redirect_to: `${origin}/?auth=callback`
        }
      })
    });

    return sendJson(res, 200, { ok: true, message: 'Check your email for a login link.' });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: 'Could not send login link.' });
  }
};

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^\S+@\S+\.\S+$/.test(email) ? email.slice(0, 240) : '';
}
