const authMiddleware = require('../../middleware/authMiddleware');
const jwt = require('jsonwebtoken');

jest.mock('jsonwebtoken');

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

    it('should return 401 if token is invalid', () => {
      req.headers['authorization'] = 'Bearer invalidtoken';
      jwt.verify.mockImplementation((token, secret, callback) => callback(new Error('Invalid token')));

      authMiddleware.verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Failed to authenticate token.' });
    });

    it('should call next if token is valid', () => {
      req.headers['authorization'] = 'Bearer validtoken';
      const decodedUser = { id: 1, role: 'Admin', username: 'admin1' };
      jwt.verify.mockImplementation((token, secret, callback) => callback(null, decodedUser));

      authMiddleware.verifyToken(req, res, next);
      expect(req.user).toEqual({ userId: 1, role: 'Admin', username: 'admin1' });
      expect(next).toHaveBeenCalled();
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
