async function supabaseRequest(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { skipped: true, data: null, count: null };

  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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

async function insertRow(table, row) {
  return supabaseRequest(table, {
    method: 'POST',
    body: JSON.stringify(row),
    prefer: 'return=minimal'
  });
}

async function countRewriteEvents(identityHash, sinceIso) {
  const query = `rewrite_events?select=id&identity_hash=eq.${encodeURIComponent(identityHash)}&created_at=gte.${encodeURIComponent(sinceIso)}`;
  const result = await supabaseRequest(query, {
    method: 'GET',
    headers: { Range: '0-0', Prefer: 'count=exact' }
  });
  return result.count || 0;
}

module.exports = { supabaseRequest, insertRow, countRewriteEvents };
