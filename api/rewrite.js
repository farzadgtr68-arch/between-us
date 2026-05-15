const { rewriteMessage, normalizeInput, hashIdentity } = require('../lib/between-us');
const { countRewriteEvents, insertRow } = require('../lib/supabase');
const { getSession } = require('../lib/auth');
const { sendJson, readJson, getClientIdentity } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(req);
    const payload = normalizeInput(body);
    if (!payload.raw_message.trim()) return sendJson(res, 400, { error: 'Write the raw message first.' });

    const session = await getSession(req).catch(error => {
      console.error('Session lookup failed:', error.message);
      return { user: null, profile: null, paid: false };
    });

    const identityHash = hashIdentity(session.user?.id || getClientIdentity(req));
    const freeLimit = Number(process.env.FREE_REWRITES_PER_DAY || 3);
    const hasSupabase = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));

    if (!session.paid && hasSupabase && freeLimit > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const used = await countRewriteEvents(identityHash, since, session.user?.id).catch(error => {
        console.error('Rate limit count failed:', error.message);
        return 0;
      });
      if (used >= freeLimit) {
        return sendJson(res, 429, {
          error: session.user
            ? `Free limit reached (${freeLimit}/day). Upgrade to Family Plus for unlimited repairs.`
            : `Free limit reached (${freeLimit}/day). Log in and upgrade to Family Plus for unlimited repairs.`,
          upgrade_required: true,
          login_required: !session.user
        });
      }
    }

    const result = await rewriteMessage(payload);

    if (hasSupabase) {
      insertRow('rewrite_events', {
        user_id: session.user?.id || null,
        identity_hash: identityHash,
        speaker_role: payload.speaker_role,
        target_role: payload.target_role,
        topic: payload.topic,
        desired_tone: payload.desired_tone,
        safety_classification: result.safety_classification,
        input_chars: payload.raw_message.length
      }).catch(error => console.error('Rewrite log failed:', error.message));
    }

    return sendJson(res, 200, { ...result, account: { authenticated: Boolean(session.user), paid: Boolean(session.paid) } });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.status === 413 ? 'Payload too large' : 'Something went wrong. Please try again.' });
  }
};
