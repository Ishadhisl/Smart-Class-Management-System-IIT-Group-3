/**
 * One-off / idempotent: creates the "SCMS Material Uploader" role in a LOCAL (XAMPP)
 * Moodle that shares this machine's PostgreSQL. Counter Persons are enrolled into a
 * course with this role when they open it from ඉගෙනුම් ද්‍රව්‍ය, so they can add
 * files/folders/pages/URLs but cannot change course settings, enrolments, grades or
 * create assignments/quizzes.
 *
 *   node scripts/moodle_create_uploader_role.js
 *
 * Prints the role id - put it in .env as MOODLE_UPLOADER_ROLE_ID. On MoodleCloud /
 * a hosted Moodle (no DB access) create the same role by hand: Site administration →
 * Users → Permissions → Define roles → Add a new role, short name `scmsuploader`,
 * context types "Course" + "Activity module", and allow the capabilities listed below.
 */
require('dotenv').config();
const { Client } = require('pg');

const SHORTNAME = 'scmsuploader';
const NAME = 'SCMS Material Uploader';
const DESCRIPTION = 'Counter staff: can upload learning materials (files, folders, pages, URLs) into a course. No course settings, enrolments, grades, assignments or quizzes.';

// Everything a person needs to switch on Edit mode and add/organise material-type
// activities - and nothing that touches settings, people or grading.
const CAPABILITIES = [
  'moodle/course:manageactivities',
  'moodle/course:activityvisibility',
  'moodle/course:viewhiddenactivities',
  'moodle/course:viewhiddensections',
  'moodle/course:sectionvisibility',
  'moodle/course:movesections',
  'moodle/course:managefiles',
  'moodle/course:viewparticipants',
  'mod/resource:addinstance', 'mod/resource:view',
  'mod/folder:addinstance', 'mod/folder:view', 'mod/folder:managefiles',
  'mod/url:addinstance', 'mod/url:view',
  'mod/page:addinstance', 'mod/page:view',
  'mod/label:addinstance', 'mod/label:view',
  'mod/book:addinstance', 'mod/book:view', 'mod/book:edit',
  'mod/forum:viewdiscussion', 'mod/assign:view', 'mod/quiz:view',
  'repository/upload:view', 'repository/url:view', 'repository/user:view',
  'moodle/user:manageownfiles',
];

(async () => {
  const client = new Client({
    user: process.env.MOODLE_DB_USER || process.env.DB_USER,
    password: process.env.MOODLE_DB_PASSWORD || process.env.DB_PASSWORD,
    host: process.env.MOODLE_DB_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MOODLE_DB_PORT || process.env.DB_PORT || 5432),
    database: process.env.MOODLE_DB_NAME || 'moodle',
  });
  await client.connect();
  const now = Math.floor(Date.now() / 1000);

  let role = (await client.query('SELECT id FROM mdl_role WHERE shortname = $1', [SHORTNAME])).rows[0];
  if (!role) {
    const sort = (await client.query('SELECT COALESCE(MAX(sortorder), 0) + 1 AS s FROM mdl_role')).rows[0].s;
    role = (await client.query(
      'INSERT INTO mdl_role (name, shortname, description, sortorder, archetype) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [NAME, SHORTNAME, DESCRIPTION, sort, '']
    )).rows[0];
    console.log(`✅ created role ${SHORTNAME} (id ${role.id})`);
  } else {
    console.log(`ℹ️  role ${SHORTNAME} already exists (id ${role.id}) - syncing capabilities`);
  }

  // Assignable in course + activity-module contexts.
  for (const level of [50, 70]) {
    await client.query(
      'INSERT INTO mdl_role_context_levels (roleid, contextlevel) SELECT $1::bigint, $2::bigint WHERE NOT EXISTS (SELECT 1 FROM mdl_role_context_levels WHERE roleid = $1::bigint AND contextlevel = $2::bigint)',
      [role.id, level]
    );
  }

  // Grant each capability at the system context (id 1) - only ones this Moodle defines.
  const known = new Set((await client.query('SELECT name FROM mdl_capabilities')).rows.map((r) => r.name));
  let added = 0;
  for (const cap of CAPABILITIES) {
    if (!known.has(cap)) { console.warn(`   ⚠️  capability not defined here, skipped: ${cap}`); continue; }
    const r = await client.query(
      `INSERT INTO mdl_role_capabilities (contextid, roleid, capability, permission, timemodified, modifierid)
       SELECT 1, $1::bigint, $2::varchar, 1, $3::bigint, 2
       WHERE NOT EXISTS (SELECT 1 FROM mdl_role_capabilities WHERE contextid = 1 AND roleid = $1::bigint AND capability = $2::varchar)`,
      [role.id, cap, now]
    );
    added += r.rowCount;
  }
  console.log(`✅ capabilities in place (${added} newly added)`);

  // Let managers / editing teachers see & assign this role in their courses too.
  for (const table of ['mdl_role_allow_assign', 'mdl_role_allow_override', 'mdl_role_allow_view']) {
    for (const parent of [1, 3]) {
      await client.query(
        `INSERT INTO ${table} (roleid, allow${table.split('_').pop()}) SELECT $1::bigint, $2::bigint WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE roleid = $1::bigint AND allow${table.split('_').pop()} = $2::bigint)`,
        [parent, role.id]
      );
    }
  }

  // Moodle caches role definitions - bump the cache so the new role is live immediately.
  await client.query("UPDATE mdl_config SET value = $1 WHERE name = 'rolesactive'", [String(now)]).catch(() => {});
  await client.end();
  console.log(`\nMOODLE_UPLOADER_ROLE_ID=${role.id}`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
