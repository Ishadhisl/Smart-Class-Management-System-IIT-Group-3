const request = require('supertest');
const express = require('express');
const courseRoutes = require('../../routes/courseRoutes');
const db = require('../../db');

// Mock DB and Auth
jest.mock('../../db', () => ({
  pool: { query: jest.fn() }
}));

// Create a test app
const app = express();
app.use(express.json());

// Mock Auth Middleware
jest.mock('../../middleware/authMiddleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { userId: 1, role: 'Admin' };
    next();
  },
  checkRole: () => (req, res, next) => next()
}));

// Remount routes after mocking middleware
app.use('/courses', require('../../routes/courseRoutes'));

describe('Course API System Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /courses - should return list of active courses', async () => {
    const mockCourses = [{ course_id: 1, course_name: 'Science', is_active: true }];
    db.pool.query.mockResolvedValueOnce({ rows: mockCourses });

    const res = await request(app).get('/courses');

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual(mockCourses);
    expect(db.pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE c.is_active = true')
    );
  });

  it('POST /courses - should create course with valid data', async () => {
    db.pool.query.mockResolvedValueOnce({ rows: [] }); // duplicate-name check
    db.pool.query.mockResolvedValueOnce({ 
      rows: [{ course_id: 1, course_name: 'Math', monthly_fee: 1000 }] 
    });
    
    // Mock audit service which is used inside the controller
    jest.spyOn(require('../../utils/auditService'), 'logAction').mockResolvedValue(true);

    const res = await request(app)
      .post('/courses')
      .send({ course_name: 'Math', monthly_fee: 1000 });

    expect(res.statusCode).toEqual(201);
    expect(res.body.message).toEqual('පාඨමාලාව සාර්ථකව එකතු කළා!');
    expect(res.body.course).toHaveProperty('course_name', 'Math');
  });

  it('POST /courses - should reject a duplicate course name (case-insensitive)', async () => {
    db.pool.query.mockResolvedValueOnce({ rows: [{ course_id: 7 }] }); // duplicate-name check hits
    const res = await request(app)
      .post('/courses')
      .send({ course_name: 'math', monthly_fee: 1000 });
    expect(res.statusCode).toEqual(409);
    expect(res.body.message).toMatch(/දැනටමත් ඇත/);
  });

  it('DELETE /courses/:id - should soft delete course', async () => {
    db.pool.query
      .mockResolvedValueOnce({ rows: [{ course_id: 1, course_name: 'Math' }] }) // check
      .mockResolvedValueOnce({ rows: [] }); // update is_active = false
      
    jest.spyOn(require('../../utils/auditService'), 'logAction').mockResolvedValue(true);

    const res = await request(app).delete('/courses/1');

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual('පාඨමාලාව සාර්ථකව අක්‍රිය කළා!');
    expect(db.pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE Courses SET is_active = false'),
      ['1']
    );
  });
});
