// src/middleware/auth.js
function apiKeyAuth(req, res, next) {
  const clientKey = req.header('x-api-key');
  const serverKey = process.env.API_KEY;

  if (!serverKey) {
    console.warn('⚠️ API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  if (!clientKey || clientKey !== serverKey) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  next();
}

module.exports = apiKeyAuth;
