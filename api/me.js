const { sendJson } = require('../lib/http');
const { getSession } = require('../lib/auth');
const { hasSupabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  if (!hasSupabase()) {
    return sendJson(res, 200, { authenticated: false, configured: false, paid: false });
  }

  const session = await getSession(req);
  if (!session.user) {
    return sendJson(res, 200, { authenticated: false, configured: true, paid: false });
  }

  return sendJson(res, 200, {
    authenticated: true,
    configured: true,
    paid: session.paid,
    user: { id: session.user.id, email: session.user.email },
    profile: {
      plan: session.profile?.plan || 'free',
      subscription_status: session.profile?.subscription_status || 'none',
      stripe_customer_id: session.profile?.stripe_customer_id || null
    }
  });
};
