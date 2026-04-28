// Placeholder auth middleware for future admin/operator dashboard
// Currently passes all requests through

function authMiddleware(req, res, next) {
  // TODO: Implement JWT-based authentication
  // - EV Driver role
  // - Station Operator role
  // - System Administrator role
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    // TODO: Check user role from JWT token
    // if (req.user?.role !== role) {
    //   return res.status(403).json({ error: 'Forbidden' });
    // }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
