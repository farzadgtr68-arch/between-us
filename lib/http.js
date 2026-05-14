function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  Object.entries({ 'Content-Type': 'application/json; charset=utf-8', ...headers }).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(data));
}

function readJson(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > limit) {
        const err = new Error('Payload too large');
        err.status = 413;
        req.destroy(err);
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function getClientIdentity(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const ua = String(req.headers['user-agent'] || 'unknown').slice(0, 240);
  return `${ip}:${ua}`;
}

module.exports = { sendJson, readJson, getClientIdentity };
