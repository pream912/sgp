const { auth } = require('../services/firebase');

const verifyAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    if (!auth) {
      console.warn('Firebase Auth not initialized. Blocking admin access.');
      return res.status(503).json({ error: 'Auth service unavailable' });
    }

    const decodedToken = await auth.verifyIdToken(token);

    if (decodedToken.admin !== true) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Admin token verification failed:', error);
    res.status(403).json({ error: 'Unauthorized: Invalid token' });
  }
};

module.exports = verifyAdmin;
