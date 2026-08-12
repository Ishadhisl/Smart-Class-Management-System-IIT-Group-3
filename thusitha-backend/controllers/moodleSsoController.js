const moodleService = require('../utils/moodleService');

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
    const embedUrl = `${toRelativeMoodleUrl(response.loginurl)}&wantsurl=${encodeURIComponent(targetUrl)}`;
    
    res.json({ embedUrl, targetUrl });
  } catch (error) {
    console.error("❌ Embed SSO Error:", error.message);
    res.status(500).json({ error: "Failed to generate Moodle Embed link." });
  }
};
