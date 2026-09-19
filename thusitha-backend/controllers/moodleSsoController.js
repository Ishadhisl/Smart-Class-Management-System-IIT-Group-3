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

const moodleUsernameFor = (req) => {
  let username = (req.user.username || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['Admin', 'Counter Person', 'Staff', 'Director'].includes(req.user.role)) username = 'admin';
  return username;
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

    const hosted = moodleService.isHosted();
    const base = hosted ? moodleService.getBaseUrl() : '/moodle';

    // Resolve the target page (relative path under the Moodle base).
    let targetPath = '/my/';
    if (page === 'course' && course_id) {
      const moodleCourse = await moodleService.findOrCreateCourse(course_id, course_name);
      if (!moodleCourse || !moodleCourse.id) {
        return res.status(502).json({ message: 'Moodle හි මෙම පන්තිය සකස් කිරීමට නොහැකි විය. කරුණාකර Admin අමතන්න.' });
      }
      if (req.user.role === 'Teacher') {
        try {
          const moodleTeacher = await moodleService.getUserByUsername(username);
          if (moodleTeacher && moodleTeacher.id) {
            await moodleService.enrollUser(moodleTeacher.id, moodleCourse.id, 3); // editingteacher
          }
        } catch (enrolErr) {
          console.warn(`⚠️ [Moodle] Teacher enrolment into course ${moodleCourse.id} skipped:`, enrolErr.message);
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
