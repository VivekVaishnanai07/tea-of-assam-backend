const jwt = require('jsonwebtoken');

const verifyAdmin = (req, res, next) => {
  const tokenWithBearer = req.headers['authorization'];
  const token = tokenWithBearer ? tokenWithBearer.substring(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token not provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied, admin only' });
    }

    req.user = decoded;
    next();
  });
};

module.exports = verifyAdmin;