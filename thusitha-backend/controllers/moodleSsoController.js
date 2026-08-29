const moodleService = require('../utils/moodleService');

// Moodle runs as a local XAMPP instance and is deliberately NOT part of the hosted
// deployment (deploy/DEPLOY.md). On a host where MOODLE_URL is unset or still points at
// localhost, short-circuit with a calm "local only" response instead of a 500 from a
// failed localhost HTTP call.
const moodleUnavailable = () => {
  const url = process.env.MOODLE_URL || '';
  return process.env.NODE_ENV === 'production' && (!url || url.includes('localhost') || url.includes('127.0.0.1'));
};
const MOODLE_LOCAL_ONLY = {
  moodle_disabled: true,
  message: 'Moodle ඉගෙනුම් කළමනාකරණ පද්ධතිය දේශීය install එකේ පමණක් ලබා ගත හැක (hosted අනුවාදයේ සක්‍රිය නැත).',
};

// Moodle's own URLs are absolute (http://localhost/moodle/...). The frontend embeds them
// in an iframe served from a different origin/port, and browsers drop Moodle's session
// cookie there as a cross-origin cookie. Stripping the scheme+host makes them root-relative
// so they resolve against the frontend's own origin instead, where Vite proxies /moodle
// through to the real Moodle server, keeping everything same-origin.
const toRelativeMoodleUrl = (absoluteUrl) => {
  try {
    const parsed = new URL(absoluteUrl);
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return absoluteUrl;
  }
};

exports.getSsoUrl = async (req, res) => {
  if (moodleUnavailable()) return res.status(503).json(MOODLE_LOCAL_ONLY);
  try {
    const rawUsername = req.user.username;
    if (!rawUsername) {
      return res.status(400).json({ message: "Username is missing from token." });
    }
    let username = rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '');

    // If the user is a staff member, map them to Moodle admin for SSO access
    // This allows Counter Persons and Admins to manage Moodle directly
    if (['Admin', 'Counter Person', 'Staff', 'Director'].includes(req.user.role)) {
      username = 'admin';
    }

    const response = await moodleService.getSSOToken(username);
    
    if (response.loginurl) {
      res.json({ ssoUrl: toRelativeMoodleUrl(response.loginurl) });
    } else {
      res.status(400).json({ message: "Moodle SSO URL not generated.", details: response });
    }
  } catch (error) {
    console.error("❌ SSO Error:", error.message);
    res.status(500).json({ error: "Failed to generate Moodle SSO link." });
  }
};

exports.getEmbedUrl = async (req, res) => {
  if (moodleUnavailable()) return res.status(503).json(MOODLE_LOCAL_ONLY);
  try {
    const { page, course_id, course_name } = req.query;
    const rawUsername = req.user.username;
    if (!rawUsername) {
      return res.status(400).json({ message: "Username is missing from token." });
    }
    let username = rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (['Admin', 'Counter Person', 'Staff', 'Director'].includes(req.user.role)) {
      username = 'admin';
    }

    const response = await moodleService.getSSOToken(username);
    
    if (!response.loginurl) {
      return res.status(400).json({ message: "Moodle SSO URL not generated." });
    }

    let targetUrl = '';
    const moodleBase = '/moodle';

    if (page === 'course' && course_id) {
      const moodleCourse = await moodleService.findOrCreateCourse(course_id, course_name);
      if (moodleCourse && moodleCourse.id) {
        // A Teacher landing on their course page still can't upload anything unless they
        // actually hold the Teacher (editingteacher) role *in that Moodle course* - having
        // a Moodle account and the course existing isn't enough. Nothing else in this app
        // ever enrols a teacher into their own course (only students get auto-enrolled), so
        // do it here, best-effort: if it fails or they're already enrolled, don't block the
        // page load over it - just log it, same pattern used for every other Moodle sync.
        if (req.user.role === 'Teacher') {
          try {
            const moodleTeacher = await moodleService.getUserByUsername(username);
            if (moodleTeacher && moodleTeacher.id) {
              await moodleService.enrollUser(moodleTeacher.id, moodleCourse.id, 3); // 3 = Teacher (editingteacher)
            } else {
              console.warn(`⚠️ [Moodle] No Moodle account found for teacher username "${username}" - cannot grant course edit rights.`);
            }
          } catch (enrolErr) {
            console.warn(`⚠️ [Moodle] Teacher enrolment into course ${moodleCourse.id} skipped:`, enrolErr.message);
          }
        }

        // Land directly on the course page (not the generic Dashboard) - this shows the
        // section/file list (covers "review uploaded materials") and, once "Turn editing on"
        // is toggled, the "+ Add an activity or resource" links for uploading new ones.
        targetUrl = `${moodleBase}/course/view.php?id=${moodleCourse.id}`;
      } else {
        // Don't silently land on the Dashboard - that looks like a working page but isn't
        // the course, which is exactly the confusing dead-end this is meant to avoid.
        // moodleService already logs the real Moodle API error to the server console.
        return res.status(502).json({
          message: 'Moodle හි මෙම පන්තිය සකස් කිරීමට නොහැකි විය. කරුණාකර Admin අමතන්න.'
        });
      }
    } else if (page === 'grades' && course_id) {
      const moodleCourse = await moodleService.getCourseByIdnumber(course_id);
      if (moodleCourse && moodleCourse.id) {
        targetUrl = `${moodleBase}/grade/report/index.php?id=${moodleCourse.id}`;
      } else {
        targetUrl = `${moodleBase}/my/`; 
      }
    } else if (page === 'calendar') {
      targetUrl = `${moodleBase}/calendar/view.php?view=month`;
    } else {
      targetUrl = `${moodleBase}/my/`;
    }

    // Pass wantsurl parameter to the SSO login url
    const relativeLoginUrl = toRelativeMoodleUrl(response.loginurl);
    if (!relativeLoginUrl || typeof relativeLoginUrl !== 'string' || !relativeLoginUrl.startsWith('/')) {
      console.error('❌ Moodle SSO returned an invalid login URL:', response.loginurl);
      return res.status(502).json({ message: 'Moodle SSO login URL is invalid.' });
    }
    const embedUrl = `${relativeLoginUrl}&wantsurl=${encodeURIComponent(targetUrl)}`;
    
    res.json({ embedUrl, targetUrl });
  } catch (error) {
    console.error("❌ Embed SSO Error:", error.message);
    res.status(500).json({ error: "Failed to generate Moodle Embed link." });
  }
};
