const config = require('../config');

function authMiddleware(req, res, next) {
  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== config.internalApiSecret) {
    return res.status(403).json({ detail: 'Invalid or missing internal API secret' });
  }
  next();
}

module.exports = { authMiddleware };
