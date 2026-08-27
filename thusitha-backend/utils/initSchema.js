const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');

// The DB has no migration framework. Historically that meant the hosted (Neon) database
// silently drifted from the code whenever a column was added via a local manual ALTER
// (Students.address, Courses.is_active, Student_Achievements.image_url all hit this),
// producing "column does not exist" 500s across the dashboards.
//
// This runs the canonical schema plus every migration on every startup. Everything in
// database/*.sql is written to be idempotent — CREATE TABLE IF NOT EXISTS,
// ALTER TABLE ... ADD COLUMN IF NOT EXISTS, guarded DO $$ blocks, and one UPDATE that is
// a no-op on a second run — so re-running the whole set each boot is safe and cheap.

const DB_DIR = path.resolve(__dirname, '..', '..', 'database');

// schema.sql first (creates base tables), then remaining migrations. Order among the
// migrations doesn't matter (all idempotent), but deploy_fixups goes last so its
// ALTERs always land after any CREATE TABLE that a migration might (re)define.
function orderedSqlFiles() {
  let files;
  try {
    files = fs.readdirSync(DB_DIR).filter((f) => f.endsWith('.sql'));
  } catch (err) {
    console.error('⚠️  initSchema: cannot read database/ dir:', err.message);
    return [];
  }
  const schema = files.filter((f) => f === 'schema.sql');
  const fixups = files.filter((f) => f === 'migration_deploy_fixups.sql');
  const migrations = files
    .filter((f) => f.startsWith('migration_') && f !== 'migration_deploy_fixups.sql')
    .sort();
  return [...schema, ...migrations, ...fixups];
}

async function initSchema() {
  const files = orderedSqlFiles();
  if (files.length === 0) {
    console.warn('⚠️  initSchema: no .sql files found, skipping schema sync');
    return;
  }

  console.log('🗄️  initSchema: syncing database schema...');
  let ok = 0;
  let failed = 0;

  for (const file of files) {
    const sql = fs.readFileSync(path.join(DB_DIR, file), 'utf8').trim();
    if (!sql) continue;
    try {
      await db.pool.query(sql);
      ok++;
    } catch (err) {
      // Don't abort startup — a single bad statement must never take the site down.
      failed++;
      console.error(`   ✗ ${file}: ${err.message}`);
    }
  }

  console.log(`🗄️  initSchema: schema sync complete (${ok} file(s) applied${failed ? `, ${failed} failed` : ''}).`);
}

module.exports = { initSchema };
