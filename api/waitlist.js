const { insertRow } = require('../lib/supabase');
const { sendJson, readJson } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(req, 20_000);
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || '').slice(0, 80);
    const source = String(body.source || 'landing').slice(0, 80);

    if (!/^\S+@\S+\.\S+$/.test(email)) return sendJson(res, 400, { error: 'Enter a valid email.' });

    if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
      await insertRow('waitlist_signups', { email, role, source }).catch(error => {
        if (!String(error.message).includes('23505')) throw error;
      });
    }

    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
      await sendResendEmail({
        to: email,
        subject: 'You’re on the Between Us early list',
        html: `<p>You’re on the early access list for <strong>Between Us</strong>.</p><p>We’ll send access when the next build is ready.</p>`
      }).catch(error => console.error('Resend user email failed:', error.message));

      if (process.env.WAITLIST_NOTIFY_EMAIL) {
        await sendResendEmail({
          to: process.env.WAITLIST_NOTIFY_EMAIL,
          subject: 'New Between Us waitlist signup',
          html: `<p>New signup: <strong>${escapeHtml(email)}</strong></p><p>Role: ${escapeHtml(role || 'unknown')}</p><p>Source: ${escapeHtml(source)}</p>`
        }).catch(error => console.error('Resend notify email failed:', error.message));
      }
    }

    return sendJson(res, 200, { ok: true, message: 'You’re on the list. We’ll send early access soon.' });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: 'Could not join the waitlist. Please try again.' });
  }
};

async function sendResendEmail({ to, subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to, subject, html })
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
