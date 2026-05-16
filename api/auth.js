const { sendJson, readJson } = require('../lib/http');
const { getSupabaseConfig, supabaseAuthRequest, ensureProfile } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(req, 20_000).catch(() => ({}));
    const action = String(body.action || '').toLowerCase();

    const { url, anonKey } = getSupabaseConfig();
    if (!url || !anonKey) {
      return sendJson(res, 501, { error: 'Login is not configured yet.', setup_required: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] });
    }

    if (action === 'google') return startGoogleLogin(req, res, url, anonKey);
    if (action === 'signup') return signUp(req, res, body);
    if (action === 'login') return signIn(req, res, body);

    return sendJson(res, 400, { error: 'Choose signup, login, or google.' });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: friendlyAuthError(error) });
  }
};

async function signUp(req, res, body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const name = normalizeName(body.name);
  if (!name) return sendJson(res, 400, { error: 'Enter your name.' });
  if (!email) return sendJson(res, 400, { error: 'Enter a valid email.' });
  if (password.length < 6) return sendJson(res, 400, { error: 'Password must be at least 6 characters.' });

  const origin = getOrigin(req);
  let result;
  try {
    result = await supabaseAuthRequest('signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        data: { name, full_name: name },
        options: { email_redirect_to: `${origin}/?auth=callback` }
      })
    });
  } catch (error) {
    if (/user_already_exists|user already registered|already been registered/i.test(String(error?.data?.error_code || error?.data?.msg || error?.message || ''))) {
      try {
        const existing = await signInWithPassword(email, password);
        if (existing.user) await ensureProfile({ ...existing.user, email, user_metadata: { ...(existing.user.user_metadata || {}), name, full_name: name } }).catch(profileError => console.error('ensureProfile existing signup failed:', profileError.message));
        return sendJson(res, 200, {
          ok: true,
          user: publicUser(existing.user, name),
          session: existing.session,
          message: 'This account already exists, so we logged you in.'
        });
      } catch {
        return sendJson(res, 409, { error: 'This email already has an account. Switch to Log in and use the original password.' });
      }
    }
    throw error;
  }

  let user = result.data?.user || null;
  let session = result.data?.session || null;

  // Some Supabase projects return no session on signup even when the account is usable.
  // Immediately logging in makes the UI behave like a normal “create account” flow.
  if (user && !session) {
    const loginResult = await signInWithPassword(email, password);
    user = loginResult.user || user;
    session = loginResult.session || null;
  }

  if (user) await ensureProfile({ ...user, email, user_metadata: { ...(user.user_metadata || {}), name, full_name: name } }).catch(error => console.error('ensureProfile signup failed:', error.message));

  return sendJson(res, 200, {
    ok: true,
    user: publicUser(user, name),
    session,
    message: session ? 'Account created. You are logged in.' : 'Account created. Please confirm your email once, then log in with your password.'
  });
}

async function signIn(req, res, body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email) return sendJson(res, 400, { error: 'Enter a valid email.' });
  if (!password) return sendJson(res, 400, { error: 'Enter your password.' });

  const { user, session } = await signInWithPassword(email, password);
  if (user) await ensureProfile(user).catch(error => console.error('ensureProfile login failed:', error.message));

  return sendJson(res, 200, {
    ok: true,
    user: publicUser(user),
    session,
    message: 'Logged in.'
  });
}

async function signInWithPassword(email, password) {
  const result = await supabaseAuthRequest('token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  return {
    user: result.data?.user || null,
    session: {
      access_token: result.data?.access_token,
      refresh_token: result.data?.refresh_token,
      expires_in: result.data?.expires_in,
      token_type: result.data?.token_type
    }
  };
}

async function startGoogleLogin(req, res, url, anonKey) {
  if (!isGoogleAuthEnabled()) {
    return sendJson(res, 501, {
      error: 'Google sign-up is temporarily unavailable. Please create your account with email + password for now.',
      setup_required: 'Set GOOGLE_AUTH_ENABLED=true only after a valid Google OAuth client is configured in Supabase.'
    });
  }

  const redirectTo = `${getOrigin(req)}/?auth=callback`;
  const authorizeUrl = new URL(`${url}/auth/v1/authorize`);
  authorizeUrl.searchParams.set('provider', 'google');
  authorizeUrl.searchParams.set('redirect_to', redirectTo);
  authorizeUrl.searchParams.set('apikey', anonKey);

  const check = await fetch(authorizeUrl, { method: 'GET', redirect: 'manual' }).catch(() => null);
  if (check && check.status >= 400) {
    let data = {};
    try { data = await check.json(); } catch {}
    return sendJson(res, 400, {
      error: friendlyAuthError({ data }),
      setup_required: 'Enable Google provider in Supabase Auth Providers.'
    });
  }

  return sendJson(res, 200, { ok: true, url: authorizeUrl.toString() });
}

function isGoogleAuthEnabled() {
  return String(process.env.GOOGLE_AUTH_ENABLED || '').toLowerCase() === 'true';
}

function getOrigin(req) {
  return String(process.env.PUBLIC_SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^\S+@\S+\.\S+$/.test(email) ? email.slice(0, 240) : '';
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function publicUser(user, fallbackName = '') {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email,
    name: metadata.full_name || metadata.name || fallbackName || ''
  };
}

function friendlyAuthError(error) {
  const message = String(error?.data?.msg || error?.data?.message || error?.message || 'Authentication failed.');
  if (/unsupported provider|provider is not enabled/i.test(message)) return 'Google login is not enabled yet. Please use email + password for now.';
  if (/invalid login credentials/i.test(message)) return 'Email or password is wrong.';
  if (/email_address_invalid|email address .* invalid/i.test(message)) return 'Use a real email address, like your Gmail.';
  if (/over_email_send_rate_limit|email rate limit/i.test(message)) return 'Signup emails are rate-limited right now. Try again in a minute, or use a different email.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email once, then log in with your password.';
  if (/user already registered|already been registered/i.test(message)) return 'This email already has an account. Switch to Log in.';
  if (/password/i.test(message) && /weak|short|length/i.test(message)) return 'Password must be at least 6 characters.';
  return 'Authentication failed. Please try again.';
}
