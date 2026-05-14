const { sendJson } = require('../lib/http');

module.exports = function handler(req, res) {
  return sendJson(res, 501, {
    error: 'Voice generation is not enabled in production yet. Use ElevenLabs, OpenAI TTS, or a storage-backed worker before enabling this feature.'
  });
};
