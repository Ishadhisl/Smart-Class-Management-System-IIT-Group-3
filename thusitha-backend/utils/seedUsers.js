const db = require('../db');
const { defaultPasswordFor } = require('./authDefaults');

// Ensures the four standard demo logins always exist:
//   admin / Admin@123      counter / Counter@123
//   teacher / Teacher@123  student / Student@123
//
// - Account missing        -> created with the role default (+ a minimal profile row).
// - Account already exists  -> left alone, UNLESS RESET_DEMO_PASSWORDS=true, in which
//                              case its password is forced back to the role default.
//
// So personalised passwords (set via Forgot-Password) survive redeploys by default;
// set RESET_DEMO_PASSWORDS=true for one deploy when you want a clean slate for a demo.

const DEMO_USERS = [
  { username: 'admin', role: 'Admin' },
  { username: 'counter', role: 'Counter Person' },
  { username: 'teacher', role: 'Teacher' },
  { username: 'student', role: 'Student' },
];

async function ensureProfile(client, role, userId, username) {
  if (role === 'Counter Person') {
    await client.query(
      `INSERT INTO Counter_Person (user_id, staff_name)
       SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM Counter_Person WHERE user_id = $1)`,
      [userId, 'Demo Counter Staff']
    );
  } else if (role === 'Teacher') {
    await client.query(
      `INSERT INTO Teachers (user_id, teacher_name)
       SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM Teachers WHERE user_id = $1)`,
      [userId, 'Demo Teacher']
    );
  } else if (role === 'Student') {
    await client.query(
      `INSERT INTO Students (user_id, student_name, qr_code_key)
       SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM Students WHERE user_id = $1)`,
      [userId, 'Demo Student', `DEMO-${username}`]
    );
  }
}

async function seedDemoUsers() {
  const bcrypt = require('bcryptjs');
  const forceReset = process.env.RESET_DEMO_PASSWORDS === 'true';
  const client = await db.pool.connect();
  try {
    for (const { username, role } of DEMO_USERS) {
      const existing = await client.query('SELECT user_id FROM Users WHERE username = $1', [username]);
      const hash = await bcrypt.hash(defaultPasswordFor(role), 10);

      if (existing.rows.length === 0) {
        await client.query('BEGIN');
        const ins = await client.query(
          'INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id',
          [username, hash, role]
        );
        await ensureProfile(client, role, ins.rows[0].user_id, username);
        await client.query('COMMIT');
        console.log(`👤 seedUsers: created "${username}" (${role}) with default password`);
      } else if (forceReset) {
        await client.query('UPDATE Users SET password_hash = $1 WHERE username = $2', [hash, username]);
        await ensureProfile(client, role, existing.rows[0].user_id, username);
        console.log(`👤 seedUsers: reset "${username}" to default password (RESET_DEMO_PASSWORDS=true)`);
      }
    }
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('⚠️  seedUsers failed:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { seedDemoUsers };
