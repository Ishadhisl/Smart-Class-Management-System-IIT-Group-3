/**
 * Security regression tests: SQL injection, HTML/script injection (stored XSS) and the
 * request-hardening middleware. These run against the real Express routing/middleware
 * with the database mocked, so they prove what the server DOES with hostile input
 * (rejects it, or stores an inert version) without needing Postgres.
 */
const request = require('supertest');
const express = require('express');

jest.mock('../../db', () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));
jest.mock('../../utils/auditService', () => ({ logAction: jest.fn().mockResolvedValue(true) }));
jest.mock('../../utils/moodleService', () => ({
  findOrCreateUser: jest.fn().mockResolvedValue(null),
  findOrCreateCourse: jest.fn().mockResolvedValue(null),
  enrollUser: jest.fn().mockResolvedValue(null),
  getUserByUsername: jest.fn().mockResolvedValue(null),
}));

const db = require('../../db');
const sanitizeBody = require('../../middleware/sanitizeBody');
const { sanitizeText, isValidName, passwordPolicyError } = require('../../utils/validators');

const buildApp = () => {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(sanitizeBody);
  app.use('/api/auth', require('../../routes/authRoutes'));
  app.use('/api/contact', require('../../routes/contactRoutes'));
  app.use('/api/students', require('../../routes/studentRoutes'));
  return app;
};

const SQLI_PAYLOADS = [
  "' OR '1'='1",
  "admin' --",
  "'; DROP TABLE Users; --",
  "1; SELECT pg_sleep(5) --",
  "\" OR 1=1 /*",
];
const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '"><iframe src=javascript:alert(1)>',
];

describe('SQL injection', () => {
  let app;
  beforeEach(() => { app = buildApp(); jest.clearAllMocks(); });

  test.each(SQLI_PAYLOADS)('login with username %j is parameterised, never concatenated', async (payload) => {
    db.pool.query.mockResolvedValue({ rows: [] }); // no such user
    const res = await request(app).post('/api/auth/login').send({ username: payload, password: 'x' });
    expect([400, 401]).toContain(res.status);
    // The payload must travel as a bound parameter ($1), and no query text may contain it.
    for (const [sql, params] of db.pool.query.mock.calls) {
      expect(sql).not.toContain(payload);
      expect(sql).toMatch(/\$1/);
      expect(params).toBeDefined();
    }
  });

  test('public registration passes hostile phone through validation, not the database', async () => {
    const res = await request(app).post('/api/students/register-public')
      .send({ student_name: 'Kamal Perera', parent_phone: "0771234567' OR 1=1 --", grade: '11' });
    expect(res.status).toBe(400);
    expect(db.pool.query).not.toHaveBeenCalled();
  });
});

describe('HTML / script injection (stored XSS)', () => {
  test.each(XSS_PAYLOADS)('sanitizeText() strips %j', (payload) => {
    const cleaned = sanitizeText(`Hello ${payload} world`);
    expect(cleaned).not.toMatch(/[<>]/);
    expect(cleaned.toLowerCase()).not.toContain('script');
    expect(cleaned.toLowerCase()).not.toContain('onerror');
  });

  test.each(XSS_PAYLOADS)('a person name containing %j is rejected outright', (payload) => {
    expect(isValidName(`Kamal ${payload}`)).toBe(false);
  });

  test('contact form: script in the message is stored inert, script in the name is refused', async () => {
    const app = buildApp();
    let res = await request(app).post('/api/contact/submit').send({
      sender_name: '<script>x</script>', sender_email: 'a@b.com', message_text: 'hello',
    });
    expect(res.status).toBe(400);

    db.pool.query.mockResolvedValue({ rows: [{ message_id: 1, sender_name: 'Kamal', message_text: 'x' }] });
    res = await request(app).post('/api/contact/submit').send({
      sender_name: 'Kamal Perera', sender_email: 'a@b.com', message_text: 'hi <img src=x onerror=alert(1)> there',
    });
    expect(res.status).toBe(201);
    const [, params] = db.pool.query.mock.calls.at(-1);
    const storedMessage = params.find((p) => typeof p === 'string' && p.startsWith('hi'));
    expect(storedMessage).toBe('hi  there');
  });

  test('sanitizeBody middleware cleans nested bodies but leaves passwords untouched', async () => {
    const app = express();
    app.use(express.json());
    app.use(sanitizeBody);
    app.post('/echo', (req, res) => res.json(req.body));
    const res = await request(app).post('/echo').send({
      title: 'Hi <b>there</b>', nested: { note: '<script>1</script>ok', list: ['<i>a</i>', 'b'] },
      password: 'P<ss>w0rd!', newPassword: 'A<b>c1!xyz',
    });
    expect(res.body).toEqual({
      title: 'Hi there', nested: { note: '1ok', list: ['a', 'b'] },
      password: 'P<ss>w0rd!', newPassword: 'A<b>c1!xyz',
    });
  });
});

describe('Password policy', () => {
  test.each([
    ['Shrt1!A', 'අවම වශයෙන් අකුරු 8'],
    ['alllowercase1!', 'Capital'],
    ['ALLUPPER1!', 'simple'],
    ['NoDigits!!', 'ඉලක්කම'],
    ['NoSymbol123', 'සංකේත'],
    ['Has Space1!', 'space'],
  ])('%j is rejected (%s)', (pw, fragment) => {
    expect(passwordPolicyError(pw)).toContain(fragment);
  });
  test('role default passwords cannot be re-used as the "new" password', () => {
    expect(passwordPolicyError('Student@123', { role: 'Student' })).toMatch(/default/);
  });
  test('a compliant password is accepted', () => {
    expect(passwordPolicyError('Nimal@2026')).toBe('');
  });
});
