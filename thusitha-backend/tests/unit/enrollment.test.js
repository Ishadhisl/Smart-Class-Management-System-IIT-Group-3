const enrollmentController = require('../../controllers/enrollmentController');
const db = require('../../db');
const auditService = require('../../utils/auditService');

jest.mock('../../db', () => ({
  pool: {
    query: jest.fn(),
  },
}));
jest.mock('../../utils/auditService');
// The post-enrollment Moodle mirror (syncEnrollmentToMoodle) is fire-and-forget and runs
// its own student/course lookups - keep it out of these query-count assertions.
jest.mock('../../utils/moodleService', () => ({
  findOrCreateUser: jest.fn().mockResolvedValue(null),
  findOrCreateCourse: jest.fn().mockResolvedValue(null),
  enrollUser: jest.fn().mockResolvedValue(null),
}));

describe('EnrollmentController Unit Tests', () => {
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

  describe('enrollStudent', () => {
    it('should return 400 if student_id or course_id is missing', async () => {
      req.body = { student_id: 1 }; // missing course_id
      await enrollmentController.enrollStudent(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: expect.any(String) });
    });

    it('should return 400 if student is already enrolled', async () => {
      req.body = { student_id: 1, course_id: 2 };
      db.pool.query.mockResolvedValueOnce({ rows: [{ enrollment_id: 1 }] }); // existing check

      await enrollmentController.enrollStudent(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "මෙම ශිෂ්‍යයා දැනටමත් මෙම පන්තියට ඇතුළත් කර ඇත." });
    });

    it('should allow enrollment but return a warning if hall capacity is exceeded', async () => {
      req.body = { student_id: 1, course_id: 2 };
      db.pool.query
        .mockResolvedValueOnce({ rows: [] }) // existing check (not enrolled)
        .mockResolvedValueOnce({ rows: [{ capacity: 30, current_count: 30 }] }) // capacity check (exceeded)
        .mockResolvedValueOnce({ rows: [{ enrollment_id: 1 }] }); // insert

      await enrollmentController.enrollStudent(req, res);
      
      expect(db.pool.query.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(db.pool.query.mock.calls[2][0]).toMatch(/INSERT INTO Course_Enrollments/i);
      expect(auditService.logAction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('අවධානයට'),
        warning: expect.any(String)
      }));
    });

    it('should enroll student successfully when capacity is available without warning', async () => {
      req.body = { student_id: 1, course_id: 2 };
      db.pool.query
        .mockResolvedValueOnce({ rows: [] }) // existing check (not enrolled)
        .mockResolvedValueOnce({ rows: [{ capacity: 30, current_count: 20 }] }) // capacity check
        .mockResolvedValueOnce({ rows: [{ enrollment_id: 1 }] }); // insert

      await enrollmentController.enrollStudent(req, res);
      expect(db.pool.query.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(db.pool.query.mock.calls[2][0]).toMatch(/INSERT INTO Course_Enrollments/i);
      expect(auditService.logAction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Student enrolled successfully'
      }));
    });
  });
});
