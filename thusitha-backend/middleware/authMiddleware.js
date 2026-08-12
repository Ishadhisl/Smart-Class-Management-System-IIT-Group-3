const jwt = require('jsonwebtoken');

/**
 * Middleware to verify the JWT token sent in the request header.
 */
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ message: 'No token provided.' });

  const token = authHeader.split(' ')[1]; // Expects "Bearer TOKEN"
  
  if (!token) return res.status(403).json({ message: 'No token provided.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Failed to authenticate token.' });
    req.user = {
      userId: decoded.id,
      role: decoded.role,
      username: decoded.username
    };
    next();
  });
};

/**
 * Middleware factory to check if the logged-in user has the required roles.
 */
exports.checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ 
        message: `ප්‍රවේශය තහනම්: මෙම ක්‍රියාව සඳහා ${roles.join(' හෝ ')} අවසරය අවශ්‍ය වේ.` 
      });
    }

    const userRoleLower = req.user.role.trim().toLowerCase();
    const allowedRolesLower = roles.map(r => r.trim().toLowerCase());

    if (!allowedRolesLower.includes(userRoleLower)) {
      return res.status(403).json({ 
        message: `ප්‍රවේශය තහනම්: මෙම ක්‍රියාව සඳහා ${roles.join(' හෝ ')} අවසරය අවශ්‍ය වේ.` 
      });
    }
    next();
  };
};