const { auth } = require('../services/firebase');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    if (!auth) {
        // Fallback for dev mode if Firebase isn't configured yet
        // In production, this should block.
        console.warn('Firebase Auth not initialized. Skipping verification (DEV ONLY).');
        req.user = { uid: 'dev-user-123', email: 'dev@example.com' }; 
        return next();
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(403).json({ error: 'Unauthorized: Invalid token' });
  }
};

module.exports = verifyToken;
