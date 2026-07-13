const { verifyToken } = require('../services/auth');

module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const claims = verifyToken(token);
    if (!claims.is_admin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    req.user = {
      uid: claims.uid,
      email: claims.email,
      is_admin: true,
    };
    next();
  } catch (err) {
    console.error('Admin token verification failed:', err.message);
    return res.status(403).json({ error: 'Unauthorized: Invalid token' });
  }
};
