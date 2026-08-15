const paymentController = require('../../controllers/paymentController');
const db = require('../../db');
const auditService = require('../../utils/auditService');

jest.mock('../../db', () => ({
  pool: {
    query: jest.fn(),
  },
}));
jest.mock('../../utils/auditService');

describe('PaymentController Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { userId: 1, role: 'Admin' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('recordPayment', () => {
    it('should return 400 if required fields are missing', async () => {
      req.body = { student_id: 1, course_id: 2 }; // Missing amount and month
      await paymentController.recordPayment(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining("අත්‍යවශ්‍ය") });
    });

    it('should return 400 for duplicate payment in same month', async () => {
      req.body = { student_id: 1, course_id: 2, amount_paid: 1000, for_month: 'August' };
      db.pool.query.mockResolvedValueOnce({ rows: [{ payment_id: 1 }] }); // dupCheck returns a row

      await paymentController.recordPayment(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "මෙම මාසය සඳහා අදාළ පන්තියට දැනටමත් ගෙවීමක් කර ඇත." });
    });

    it('should record payment and auto-generate receipt successfully', async () => {
      req.body = { student_id: 1, course_id: 2, amount_paid: 1000, for_month: 'August' };
      
      db.pool.query
        .mockResolvedValueOnce({ rows: [] }) // dupCheck empty
        .mockResolvedValueOnce({ rows: [{ cnt: 5 }] }) // seqResult (5 payments today)
        .mockResolvedValueOnce({ rows: [{ payment_id: 10, receipt_number: 'RCP-xxx' }] }); // insert

      await paymentController.recordPayment(req, res);
      
      expect(db.pool.query).toHaveBeenCalledTimes(3);
      // The insert query values check
      const insertCallArgs = db.pool.query.mock.calls[2];
      expect(insertCallArgs[1][6]).toMatch(/^RCP-\d{8}-00006$/); // Expected receipt number format
      
      expect(auditService.logAction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'ගෙවීම සාර්ථකව සටහන් කරන ලදී.'
      }));
    });
  });
});
