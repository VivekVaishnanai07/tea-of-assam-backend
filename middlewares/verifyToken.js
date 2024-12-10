const jwt = require('jsonwebtoken');

// Middleware to verify token
const verifyToken = (requiredRole = null) => (req, res, next) => {
  const tokenWithBearer = req.headers['authorization'];
  const token = tokenWithBearer && tokenWithBearer.startsWith("Bearer ")
    ? tokenWithBearer.substring(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: 'Token not provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' });
    }

    if (requiredRole && decoded.role !== requiredRole) {
      return res.status(403).json({ message: 'Access denied' });
    }

    req.user = decoded;
    next();
  });
};

module.exports = verifyToken;