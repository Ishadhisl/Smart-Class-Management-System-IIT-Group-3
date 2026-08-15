const courseController = require('../../controllers/courseController');
const db = require('../../db');
const auditService = require('../../utils/auditService');

jest.mock('../../db', () => ({
  pool: {
    query: jest.fn(),
  },
}));
jest.mock('../../utils/auditService');

describe('CourseController Unit Tests', () => {
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

  describe('getAllCourses', () => {
    it('should fetch only active courses by default', async () => {
      const mockCourses = [{ course_id: 1, course_name: 'Math', is_active: true }];
      db.pool.query.mockResolvedValueOnce({ rows: mockCourses });

      await courseController.getAllCourses(req, res);

      expect(db.pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = true')
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockCourses);
    });

    it('should fetch all courses if include_inactive is true', async () => {
      req.query.include_inactive = 'true';
      db.pool.query.mockResolvedValueOnce({ rows: [] });

      await courseController.getAllCourses(req, res);

      expect(db.pool.query).not.toHaveBeenCalledWith(
        expect.stringContaining('is_active = true')
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('createCourse', () => {
    it('should return 400 if course_name is missing', async () => {
      req.body = { monthly_fee: 1000 };
      
      await courseController.createCourse(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'පාඨමාලා නම අවශ්‍ය වේ.' });
    });

    it('should return 400 if monthly_fee is invalid', async () => {
      req.body = { course_name: 'Science', monthly_fee: -100 };
      
      await courseController.createCourse(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'මාසික ගාස්තුව ධන සංඛ්‍යාවක් විය යුතුය.' });
    });

    it('should create course successfully', async () => {
      req.body = { course_name: 'Science', monthly_fee: 1000, teacher_id: 1, subject_id: 2 };
      db.pool.query.mockResolvedValueOnce({ rows: [{ course_id: 1, course_name: 'Science' }] });

      await courseController.createCourse(req, res);

      expect(db.pool.query).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'පාඨමාලාව සාර්ථකව එකතු කළා!'
      }));
    });
  });

  describe('deleteCourse', () => {
    it('should return 404 if course not found', async () => {
      req.params = { id: 999 };
      db.pool.query.mockResolvedValueOnce({ rows: [] }); // Check exists

      await courseController.deleteCourse(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should soft delete course successfully', async () => {
      req.params = { id: 1 };
      db.pool.query
        .mockResolvedValueOnce({ rows: [{ course_id: 1, course_name: 'Math' }] }) // Check
        .mockResolvedValueOnce({ rows: [] }); // Update

      await courseController.deleteCourse(req, res);

      expect(db.pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE Courses SET is_active = false'),
        [1]
      );
      expect(auditService.logAction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'පාඨමාලාව සාර්ථකව අක්‍රිය කළා!' });
    });
  });
});
