const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * Middleware to verify the JWT token sent in the request header, and (for tokens issued
 * after session tracking was added) confirm the session behind it hasn't been revoked
 * (logout, password change, admin force-logout) or expired server-side.
 */
exports.verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ message: 'No token provided.' });

  const token = authHeader.split(' ')[1]; // Expects "Bearer TOKEN"

  if (!token) return res.status(403).json({ message: 'No token provided.' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Failed to authenticate token.' });
  }

  try {
    // Tokens signed before session tracking existed carry no jti - let those through on
    // JWT validity alone so a deploy doesn't instantly log out every already-signed-in user.
    if (decoded.jti) {
      const result = await db.pool.query(
        `UPDATE Sessions SET last_active_at = NOW()
         WHERE jti = $1 AND revoked_at IS NULL AND expires_at > NOW()
         RETURNING session_id`,
        [decoded.jti]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'සැසිය අවලංගු වී ඇත. නැවත පිවිසෙන්න.' });
      }
    }
  } catch (err) {
    console.error('❌ Session Check Error:', err.message);
    return res.status(500).json({ message: 'Session verification failed.' });
  }

  req.user = {
    userId: decoded.id,
    role: decoded.role,
    username: decoded.username,
    jti: decoded.jti
  };
  next();
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
