const { Pool } = require('pg');
require('dotenv').config();

// DATABASE_URL (single connection string, e.g. Neon/Render Postgres) takes priority;
// falls back to discrete DB_* vars for local dev. DB_SSL opts discrete-var connections
// into SSL too, for cloud Postgres providers that hand out host/user/password separately.
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
);

// Add listeners to know when the database is working
pool.on('connect', () => {
  console.log('✅ Database Connection Pool established');
});

// Immediate connection test to diagnose ECONNREFUSED on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed on startup:', err.message);
    process.exit(1); // Exit the application if initial connection fails
  } else {
    console.log('🚀 Database is reachable at:', res.rows[0].now);
  }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle database client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};