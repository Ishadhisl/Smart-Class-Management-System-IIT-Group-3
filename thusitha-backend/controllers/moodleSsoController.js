const moodleService = require('../utils/moodleService');

// Moodle can run three ways:
//   1. local XAMPP  (MOODLE_URL points at localhost)  — iframe-embed via the Vite /moodle proxy
//   2. hosted        (MoodleCloud / deployed instance) — open in a new tab (no proxy, and
//                     MoodleCloud can't install the auth_userkey SSO plugin / blocks iframes)
//   3. not configured (MOODLE_URL unset in production) — a calm "not available" response
const moodleNotConfigured = () => {
  const url = process.env.MOODLE_URL || '';
  return process.env.NODE_ENV === 'production' && (!url || url.includes('localhost') || url.includes('127.0.0.1'));
};
const MOODLE_LOCAL_ONLY = {
  moodle_disabled: true,
  message: 'Moodle ඉගෙනුම් කළමනාකරණ පද්ධතිය මෙම deployment එකේ සකසා නැත.',
};

// Local iframe embed: strip scheme+host so the URL resolves against the frontend origin,
// where Vite proxies /moodle to the real (localhost) Moodle — keeps the session cookie same-origin.
const toRelativeMoodleUrl = (absoluteUrl) => {
  try {
    const parsed = new URL(absoluteUrl);
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return absoluteUrl;
  }
};

// Moodle role ids: 3 = editingteacher (Teachers, full course editing), 5 = student (view only).
// Counter Persons get a purpose-built "SCMS Material Uploader" role - can add files/folders/
// pages/URLs but not touch settings, enrolments, grades or assignments/quizzes. Created by
// scripts/moodle_create_uploader_role.js; the id lives in .env. Falls back to non-editing
// teacher (4 - read only) rather than silently handing out editing rights.
const MOODLE_ROLE = {
  editingTeacher: 3,
  student: 5,
  uploader: Number(process.env.MOODLE_UPLOADER_ROLE_ID) || 4,
};

const moodleUsernameFor = (req) => {
  let username = (req.user.username || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Admin (and legacy staff roles) use Moodle's site admin. Counter Persons get their OWN
  // Moodle account so they can be enrolled with the limited uploader role.
  if (['Admin', 'Staff', 'Director'].includes(req.user.role)) username = 'admin';
  return username;
};

// Make sure a Moodle account exists for the SCMS user (students/teachers are created by the
// registration sync; counter staff only reach Moodle through here).
const ensureMoodleUser = async (req, username) => {
  if (username === 'admin') return null;
  try {
    return await moodleService.findOrCreateUser({
      username,
      firstname: req.user.role === 'Counter Person' ? 'Counter' : (req.user.username || username),
      lastname: req.user.role === 'Counter Person' ? (req.user.username || 'Staff') : 'User',
      email: `${username}@thusitha.edu.lk`,
    });
  } catch (err) {
    console.warn(`⚠️ [Moodle] could not ensure user ${username}:`, err.message);
    return null;
  }
};

// Best-effort one-click login URL via the auth_userkey plugin. Returns null (not throw)
// when the plugin isn't installed (MoodleCloud) so callers can fall back to a plain link.
const trySsoLoginUrl = async (username) => {
  try {
    const response = await moodleService.getSSOToken(username);
    return response && response.loginurl ? response.loginurl : null;
  } catch (err) {
    console.warn('⚠️ Moodle SSO (auth_userkey) unavailable, falling back to plain link:', err.message);
    return null;
  }
};

exports.getSsoUrl = async (req, res) => {
  if (moodleNotConfigured()) return res.status(503).json(MOODLE_LOCAL_ONLY);
  try {
    const username = moodleUsernameFor(req);
    if (!username) return res.status(400).json({ message: "Username is missing from token." });
    await ensureMoodleUser(req, username);

    const loginUrl = await trySsoLoginUrl(username);
    if (moodleService.isHosted()) {
      // Absolute URL, opened in a new tab by the frontend.
      return res.json({ url: loginUrl || `${moodleService.getBaseUrl()}/login/index.php`, mode: 'newtab', sso: !!loginUrl });
    }
    if (loginUrl) return res.json({ ssoUrl: toRelativeMoodleUrl(loginUrl), mode: 'embed' });
    return res.status(400).json({ message: "Moodle SSO URL not generated." });
  } catch (error) {
    console.error("❌ SSO Error:", error.message);
    res.status(500).json({ error: "Failed to generate Moodle SSO link." });
  }
};

exports.getEmbedUrl = async (req, res) => {
  if (moodleNotConfigured()) return res.status(503).json(MOODLE_LOCAL_ONLY);
  try {
    const { page, course_id, course_name } = req.query;
    const username = moodleUsernameFor(req);
    if (!username) return res.status(400).json({ message: "Username is missing from token." });
    const moodleUser = await ensureMoodleUser(req, username);

    const hosted = moodleService.isHosted();
    const base = hosted ? moodleService.getBaseUrl() : '/moodle';

    // Resolve the target page (relative path under the Moodle base).
    let targetPath = '/my/';
    if (page === 'course' && course_id) {
      const moodleCourse = await moodleService.findOrCreateCourse(course_id, course_name);
      if (!moodleCourse || !moodleCourse.id) {
        return res.status(502).json({ message: 'Moodle හි මෙම පන්තිය සකස් කිරීමට නොහැකි විය. කරුණාකර Admin අමතන්න.' });
      }
      // Enrol the opener with the role their SCMS role maps to (students are enrolled by the
      // registration/enrolment sync and just view).
      const roleForOpener = req.user.role === 'Teacher' ? MOODLE_ROLE.editingTeacher
        : req.user.role === 'Counter Person' ? MOODLE_ROLE.uploader
          : null;
      if (roleForOpener) {
        try {
          const opener = moodleUser || await moodleService.getUserByUsername(username);
          if (opener && opener.id) {
            await moodleService.enrollUser(opener.id, moodleCourse.id, roleForOpener);
          }
        } catch (enrolErr) {
          console.warn(`⚠️ [Moodle] ${req.user.role} enrolment into course ${moodleCourse.id} skipped:`, enrolErr.message);
        }
      }
      targetPath = `/course/view.php?id=${moodleCourse.id}`;
    } else if (page === 'grades' && course_id) {
      const moodleCourse = await moodleService.getCourseByIdnumber(course_id);
      targetPath = (moodleCourse && moodleCourse.id) ? `/grade/report/index.php?id=${moodleCourse.id}` : '/my/';
    } else if (page === 'calendar') {
      targetPath = '/calendar/view.php?view=month';
    }

    const loginUrl = await trySsoLoginUrl(username);

    if (hosted) {
      // Open in a new browser tab. Use the SSO login URL with wantsurl when available,
      // otherwise just the target page (the user logs into Moodle themselves — their
      // Moodle username is their SCMS username).
      const openUrl = loginUrl
        ? `${loginUrl}&wantsurl=${encodeURIComponent(base + targetPath)}`
        : `${base}${targetPath}`;
      return res.json({ url: openUrl, mode: 'newtab', sso: !!loginUrl });
    }

    // Local: same-origin iframe via the Vite proxy.
    if (!loginUrl) return res.status(400).json({ message: "Moodle SSO URL not generated." });
    const relativeLoginUrl = toRelativeMoodleUrl(loginUrl);
    if (!relativeLoginUrl.startsWith('/')) {
      return res.status(502).json({ message: 'Moodle SSO login URL is invalid.' });
    }
    const embedUrl = `${relativeLoginUrl}&wantsurl=${encodeURIComponent('/moodle' + targetPath)}`;
    res.json({ embedUrl, mode: 'embed' });
  } catch (error) {
    console.error("❌ Embed SSO Error:", error.message);
    res.status(500).json({ error: "Failed to generate Moodle link." });
  }
};
