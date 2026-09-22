const authMiddleware = require('../../middleware/authMiddleware');
const jwt = require('jsonwebtoken');
const db = require('../../db');

jest.mock('jsonwebtoken');
jest.mock('../../db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe('AuthMiddleware Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('verifyToken', () => {
    it('should return 403 if no authorization header', () => {
      authMiddleware.verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'No token provided.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      req.headers['authorization'] = 'Bearer invalidtoken';
      jwt.verify.mockImplementation(() => { throw new Error('Invalid token'); });

      await authMiddleware.verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Failed to authenticate token.' });
    });

    it('should call next if token is valid', async () => {
      req.headers['authorization'] = 'Bearer validtoken';
      // No jti - simulates a token issued before session tracking existed, which skips the
      // DB-backed session check entirely (see authMiddleware.js backward-compat comment).
      const decodedUser = { id: 1, role: 'Admin', username: 'admin1' };
      jwt.verify.mockReturnValue(decodedUser);

      await authMiddleware.verifyToken(req, res, next);
      expect(req.user).toEqual({ userId: 1, role: 'Admin', username: 'admin1', jti: undefined });
      expect(next).toHaveBeenCalled();
    });

    it('should call next and refresh last_active_at if the session is still active', async () => {
      req.headers['authorization'] = 'Bearer validtoken';
      const decodedUser = { id: 1, role: 'Admin', username: 'admin1', jti: 'session-jti-1' };
      jwt.verify.mockReturnValue(decodedUser);
      db.pool.query.mockResolvedValueOnce({ rows: [{ session_id: 5 }] });

      await authMiddleware.verifyToken(req, res, next);
      expect(db.pool.query).toHaveBeenCalledWith(expect.any(String), ['session-jti-1']);
      expect(req.user).toEqual({ userId: 1, role: 'Admin', username: 'admin1', jti: 'session-jti-1' });
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 if the session has been revoked or expired', async () => {
      req.headers['authorization'] = 'Bearer validtoken';
      const decodedUser = { id: 1, role: 'Admin', username: 'admin1', jti: 'session-jti-2' };
      jwt.verify.mockReturnValue(decodedUser);
      db.pool.query.mockResolvedValueOnce({ rows: [] });

      await authMiddleware.verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('checkRole', () => {
    it('should return 403 if user or role is missing', () => {
      const middleware = authMiddleware.checkRole(['Admin']);
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('ප්‍රවේශය තහනම්') });
    });

    it('should return 403 if user role is not in allowed roles', () => {
      req.user = { role: 'Student' };
      const middleware = authMiddleware.checkRole(['Admin', 'Teacher']);
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should call next if user role is allowed', () => {
      req.user = { role: 'Admin' };
      const middleware = authMiddleware.checkRole(['Admin', 'Teacher']);
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
