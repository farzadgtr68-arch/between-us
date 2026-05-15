function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, anonKey, serviceKey, serverKey: serviceKey || anonKey };
}

function hasSupabase() {
  const { url, serverKey } = getSupabaseConfig();
  return Boolean(url && serverKey);
}

async function supabaseRequest(path, options = {}) {
  const { url, serverKey } = getSupabaseConfig();
  if (!url || !serverKey) return { skipped: true, data: null, count: null };

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serverKey,
      Authorization: `Bearer ${serverKey}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const err = new Error(`Supabase ${response.status}: ${text}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  const contentRange = response.headers.get('content-range');
  const count = contentRange && contentRange.includes('/') ? Number(contentRange.split('/').pop()) : null;
  return { skipped: false, data, count };
}

async function supabaseAuthRequest(path, options = {}, accessToken = null) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return { skipped: true, data: null };

  const response = await fetch(`${url}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken || anonKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const err = new Error(`Supabase Auth ${response.status}: ${text}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return { skipped: false, data };
}

async function insertRow(table, row) {
  return supabaseRequest(table, {
    method: 'POST',
    body: JSON.stringify(row),
    prefer: 'return=minimal'
  });
}

async function upsertRows(table, rows, conflictTarget = 'id') {
  return supabaseRequest(`${table}?on_conflict=${encodeURIComponent(conflictTarget)}`, {
    method: 'POST',
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
    prefer: 'resolution=merge-duplicates,return=representation'
  });
}

async function updateRows(table, row, filters) {
  return supabaseRequest(`${table}?${filters}`, {
    method: 'PATCH',
    body: JSON.stringify(row),
    prefer: 'return=representation'
  });
}

async function getUserByAccessToken(accessToken) {
  if (!accessToken) return null;
  const result = await supabaseAuthRequest('user', { method: 'GET' }, accessToken);
  return result.data || null;
}

async function getProfileByUserId(userId) {
  if (!userId || !hasSupabase()) return null;
  const result = await supabaseRequest(`user_profiles?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`, { method: 'GET' });
  return Array.isArray(result.data) ? result.data[0] || null : null;
}

async function getProfileByEmail(email) {
  if (!email || !hasSupabase()) return null;
  const result = await supabaseRequest(`user_profiles?select=*&email=eq.${encodeURIComponent(email)}&limit=1`, { method: 'GET' });
  return Array.isArray(result.data) ? result.data[0] || null : null;
}

async function getProfileByStripeCustomerId(customerId) {
  if (!customerId || !hasSupabase()) return null;
  const result = await supabaseRequest(`user_profiles?select=*&stripe_customer_id=eq.${encodeURIComponent(customerId)}&limit=1`, { method: 'GET' });
  return Array.isArray(result.data) ? result.data[0] || null : null;
}

async function ensureProfile(user) {
  if (!user || !hasSupabase()) return null;
  const email = String(user.email || '').toLowerCase();
  const profile = {
    user_id: user.id,
    email,
    updated_at: new Date().toISOString()
  };
  const result = await upsertRows('user_profiles', profile, 'user_id');
  return Array.isArray(result.data) ? result.data[0] || null : null;
}

async function countRewriteEvents(identityHash, sinceIso, userId = null) {
  const base = userId
    ? `rewrite_events?select=id&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(sinceIso)}`
    : `rewrite_events?select=id&identity_hash=eq.${encodeURIComponent(identityHash)}&created_at=gte.${encodeURIComponent(sinceIso)}`;
  const result = await supabaseRequest(base, {
    method: 'GET',
    headers: { Range: '0-0', Prefer: 'count=exact' }
  });
  return result.count || 0;
}

function isPaidProfile(profile) {
  return ['family_plus', 'pro', 'paid'].includes(String(profile?.plan || '').toLowerCase()) &&
    ['active', 'trialing', 'paid'].includes(String(profile?.subscription_status || 'active').toLowerCase());
}

module.exports = {
  getSupabaseConfig,
  hasSupabase,
  supabaseRequest,
  supabaseAuthRequest,
  insertRow,
  upsertRows,
  updateRows,
  getUserByAccessToken,
  getProfileByUserId,
  getProfileByEmail,
  getProfileByStripeCustomerId,
  ensureProfile,
  countRewriteEvents,
  isPaidProfile
};
