const http = require('http');
const rewrite = require('../api/rewrite');
const waitlist = require('../api/waitlist');
const checkout = require('../api/checkout');
const health = require('../api/health');
const authStart = require('../api/auth-start');
const me = require('../api/me');

const routes = { '/api/rewrite': rewrite, '/api/waitlist': waitlist, '/api/checkout': checkout, '/api/health': health, '/api/auth-start': authStart, '/api/me': me };
const server = http.createServer((req, res) => {
  const handler = routes[req.url.split('?')[0]];
  if (!handler) {
    res.statusCode = 404;
    return res.end('not found');
  }
  return handler(req, res);
});

server.listen(4599, async () => {
  try {
    const healthRes = await fetch('http://localhost:4599/api/health');
    console.log('health', healthRes.status, await healthRes.text());

    const rewriteRes = await fetch('http://localhost:4599/api/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'You never listen to me.', role: 'A teen / young adult', target: 'My mom' })
    });
    const rewriteJson = await rewriteRes.json();
    console.log('rewrite', rewriteRes.status, rewriteJson.text_message_version ? 'ok' : rewriteJson);

    const waitlistRes = await fetch('http://localhost:4599/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', source: 'test' })
    });
    console.log('waitlist', waitlistRes.status, await waitlistRes.text());

    const checkoutRes = await fetch('http://localhost:4599/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    console.log('checkout', checkoutRes.status, await checkoutRes.text());
  } finally {
    server.close();
  }
});
