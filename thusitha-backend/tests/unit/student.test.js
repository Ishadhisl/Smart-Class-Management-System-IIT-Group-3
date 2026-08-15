const studentController = require('../../controllers/studentController');
const db = require('../../db');
const auditService = require('../../utils/auditService');

jest.mock('../../db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));
jest.mock('../../utils/auditService');

describe('StudentController Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { userId: 1, role: 'Admin' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('getAllStudents', () => {
    it('should fetch all students', async () => {
      const mockStudents = [{ student_id: 1, student_name: 'John' }];
      db.pool.query
        .mockResolvedValueOnce({ rows: mockStudents }) // Get students
        .mockResolvedValueOnce({ rows: [] }); // Get enrollments

      await studentController.getAllStudents(req, res);

      expect(db.pool.query).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled(); // Should be called with formatted students
    });

    it('should filter by course_id if provided', async () => {
      req.query = { course_id: '2' };
      const mockStudents = [{ student_id: 1, student_name: 'John' }];
      db.pool.query
        .mockResolvedValueOnce({ rows: mockStudents }) // Get students filtered
        .mockResolvedValueOnce({ rows: [] }); // Get enrollments

      await studentController.getAllStudents(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('deleteStudent', () => {
    it('should delete student successfully', async () => {
      req.params = { id: 1 };
      
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ user_id: 2 }] }) // SELECT user_id
          .mockResolvedValueOnce({ rows: [] }) // DELETE Students
          .mockResolvedValueOnce({ rows: [] }) // DELETE Users
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };
      db.pool.connect.mockResolvedValue(mockClient);
      
      await studentController.deleteStudent(req, res);

      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM Users WHERE user_id = $1'), [2]);
      expect(auditService.logAction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'ශිෂ්‍යයා පද්ධතියෙන් ඉවත් කළා.' });
    });
  });
});
