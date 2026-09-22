const authController = require('../../controllers/authController');
const db = require('../../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auditService = require('../../utils/auditService');
const whatsappService = require('../../utils/whatsappService');

// Mock dependencies
jest.mock('../../db', () => ({
  pool: {
    query: jest.fn(),
  },
}));
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../utils/auditService');
jest.mock('../../utils/whatsappService');

describe('AuthController Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return 401 if user not found', async () => {
      req.body = { username: 'testuser', password: 'password123' };
      db.pool.query.mockResolvedValueOnce({ rows: [] });

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'පරිශීලකයා හමුවුනේ නැත.' });
    });

    it('should return 401 if password does not match', async () => {
      req.body = { username: 'testuser', password: 'wrongpassword' };
      db.pool.query.mockResolvedValueOnce({ 
        rows: [{ user_id: 1, username: 'testuser', password_hash: 'hash', role: 'Student' }] 
      });
      bcrypt.compare.mockResolvedValueOnce(false);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('මුරපදය වැරදියි.') });
    });

    it('should login successfully and return token', async () => {
      req.body = { username: 'testuser', password: 'password123' };
      req.headers = { 'user-agent': 'jest-test-agent' };
      req.ip = '127.0.0.1';
      const user = { user_id: 1, username: 'testuser', password_hash: 'hash', role: 'Teacher' };
      db.pool.query
        .mockResolvedValueOnce({ rows: [user] }) // user lookup
        .mockResolvedValueOnce({}); // Sessions insert
      bcrypt.compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValue('mocked-token');

      await authController.login(req, res);

      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 1, username: 'testuser', role: 'Teacher', jti: expect.any(String) },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      expect(db.pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO Sessions'),
        expect.arrayContaining([1, expect.any(String), 'jest-test-agent', '127.0.0.1'])
      );
      expect(auditService.logAction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        token: 'mocked-token'
      }));
    });
  });

  describe('forgotPassword', () => {
    it('should return 404 if user not found', async () => {
      req.body = { username: 'nonexistent' };
      db.pool.query.mockResolvedValueOnce({ rows: [] });

      await authController.forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'පරිශීලකයා හමුවුනේ නැත.' });
    });

    it('should generate OTP and send WhatsApp message', async () => {
      req.body = { username: 'student1' };
      db.pool.query
        .mockResolvedValueOnce({ rows: [{ user_id: 1, username: 'student1', role: 'Student', parent_phone: '0712345678' }] }) // User lookup
        .mockResolvedValueOnce({}) // Delete old OTP
        .mockResolvedValueOnce({}); // Insert new OTP
      
      whatsappService.sendWhatsAppMessage.mockResolvedValueOnce({ success: true });

      await authController.forgotPassword(req, res);

      expect(whatsappService.sendWhatsAppMessage).toHaveBeenCalledWith('0712345678', expect.any(String));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });
  });
});
