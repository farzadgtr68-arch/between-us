const { getUserByAccessToken, ensureProfile, getProfileByUserId, isPaidProfile } = require('./supabase');

function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function getSession(req) {
  const accessToken = getBearerToken(req);
  if (!accessToken) return { accessToken: '', user: null, profile: null, paid: false };

  const user = await getUserByAccessToken(accessToken).catch(error => {
    console.error('Auth verify failed:', error.message);
    return null;
  });

  if (!user?.id) return { accessToken, user: null, profile: null, paid: false };

  let profile = await ensureProfile(user).catch(error => {
    console.error('Profile upsert failed:', error.message);
    return null;
  });

  if (!profile) {
    profile = await getProfileByUserId(user.id).catch(() => null);
  }

  return { accessToken, user, profile, paid: isPaidProfile(profile) };
}

module.exports = { getBearerToken, getSession };
