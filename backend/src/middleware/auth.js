/**
 * JWT Auth Middleware
 * Verifies Bearer token on protected routes.
 */

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dealbot-admin-secret-2024';

module.exports = function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — token required' });
  }

  try {
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
