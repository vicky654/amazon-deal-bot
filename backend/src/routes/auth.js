/**
 * Auth Routes
 *
 * POST /api/auth/login  → returns JWT
 * GET  /api/auth/me     → verify token (used by frontend to check session)
 */

const router = require('express').Router();
const jwt    = require('jsonwebtoken');

const SECRET         = process.env.JWT_SECRET         || 'dealbot-admin-secret-2024';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL         || 'admin@dealbot.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD      || '123456';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  if (email.trim() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { email: ADMIN_EMAIL, role: 'admin' },
      SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ token, email: ADMIN_EMAIL });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

// GET /api/auth/me — lightweight token check (frontend uses on mount)
router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json({ ok: true, admin: req.admin });
});

module.exports = router;
