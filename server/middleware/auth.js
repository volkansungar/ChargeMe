const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'chargeme_fallback_secret_key';

/**
 * Auth middleware — verifies JWT token from Authorization header.
 * Attaches req.user = { id, username, role } on success.
 * Returns 401 if token is missing or invalid.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, username: decoded.username, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

/**
 * Role-based access control.
 * Must be used AFTER authMiddleware.
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

/**
 * Optional auth — tries to verify JWT but doesn't block if missing.
 * Useful for public routes that behave differently when logged in.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, username: decoded.username, role: decoded.role };
  } catch (err) {
    req.user = null;
  }
  next();
}

module.exports = { authMiddleware, requireRole, optionalAuth, JWT_SECRET };
