const { verifyToken } = require('../services/auth');

module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const claims = verifyToken(token);
    req.user = {
      uid: claims.uid,
      email: claims.email,
      is_admin: !!claims.is_admin,
    };
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(403).json({ error: 'Unauthorized: Invalid token' });
  }
};
