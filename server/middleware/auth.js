const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '未授权：缺少 Token' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key', (err, user) => {
    if (err) {
      console.error('JWT Verification Error:', err.message);
      return res.status(401).json({ 
        message: 'Token 无效或已过期，请重新登录', 
        error: err.message 
      });
    }
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;
