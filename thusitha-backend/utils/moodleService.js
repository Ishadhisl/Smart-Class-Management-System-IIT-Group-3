const axios = require('axios');

class MoodleService {
  constructor() {
    this.moodleUrl = process.env.MOODLE_URL || 'http://localhost/moodle/webservice/rest/server.php';
    this.token = process.env.MOODLE_TOKEN || 'DUMMY_TOKEN_FOR_DEV';
  }

  // The site root, derived from MOODLE_URL. e.g.
  //   https://scms.moodlecloud.com/webservice/rest/server.php -> https://scms.moodlecloud.com
  //   http://localhost/moodle/webservice/rest/server.php       -> http://localhost/moodle
  getBaseUrl() {
    return this.moodleUrl.replace(/\/webservice\/rest\/server\.php.*$/i, '').replace(/\/+$/, '');
  }

  // True for a real hosted Moodle (MoodleCloud / a deployed instance) as opposed to the
  // local XAMPP one the iframe-embed + Vite proxy was built for.
  isHosted() {
    const b = this.getBaseUrl();
    return !!b && !b.includes('localhost') && !b.includes('127.0.0.1');
  }

  async makeRequest(functionName, params = {}) {
    try {
      const urlParams = new URLSearchParams({
        wstoken: this.token,
        wsfunction: functionName,
        moodlewsrestformat: 'json',
        ...params
      });

      const response = await axios.post(this.moodleUrl, urlParams.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Several Moodle webservice functions (e.g. enrol_manual_enrol_users) are declared
      // void and return a literal null body on success - not an object - so this must be
      // checked before touching .exception, or every successful void call throws here.
      if (response.data && response.data.exception) {
        throw new Error(`Moodle API Error: ${response.data.message}`);
      }

      return response.data;
    } catch (error) {
      console.error(`❌ Moodle API Request Failed (${functionName}):`, error.message);
      throw error;
    }
  }

  async createUser(student) {
    const params = {
      'users[0][username]': student.username,
      'users[0][password]': student.password,
      'users[0][firstname]': student.firstname,
      'users[0][lastname]': student.lastname,
      'users[0][email]': student.email || `${student.username}@thusitha.edu.lk`
    };

    return this.makeRequest('core_user_create_users', params);
  }

  async createCourse(course) {
    const params = {
      'courses[0][fullname]': course.course_name,
      'courses[0][shortname]': course.course_name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + course.course_id,
      'courses[0][categoryid]': 1,
      'courses[0][idnumber]': course.course_id
    };

    return this.makeRequest('core_course_create_courses', params);
  }

  async getCourseByIdnumber(idnumber) {
    try {
      const params = {
        field: 'idnumber',
        value: idnumber
      };
      const response = await this.makeRequest('core_course_get_courses_by_field', params);
      if (response && response.courses && response.courses.length > 0) {
        return response.courses[0];
      }
      return null;
    } catch (err) {
      console.error(`❌ [Moodle] getCourseByIdnumber(${idnumber}) failed:`, err.message);
      return null;
    }
  }

  // SCMS courses aren't created in Moodle up front, so most lookups by idnumber miss.
  // Centralized here so every caller (SSO embed, enrollment sync, registration) provisions
  // courses the same way instead of each reimplementing its own lookup-or-create logic.
  async findOrCreateCourse(courseId, courseName) {
    const existing = await this.getCourseByIdnumber(courseId);
    if (existing && existing.id) {
      return existing;
    }
    try {
      const created = await this.createCourse({ course_id: courseId, course_name: courseName || `SCMS Course ${courseId}` });
      return Array.isArray(created) && created[0] && created[0].id ? created[0] : null;
    } catch (err) {
      console.error(`❌ [Moodle] createCourse(${courseId}) failed:`, err.message);
      return null;
    }
  }

  // Some students already have a real Moodle account whose id was never saved back onto
  // the SCMS side (the create succeeded but the DB write after it didn't). Look up by
  // username first rather than assuming a missing local moodle_user_id means no account exists.
  async findOrCreateUser({ username, firstname, lastname, email, password }) {
    const existing = await this.getUserByUsername(username);
    if (existing && existing.id) {
      return existing;
    }
    try {
      const created = await this.createUser({ username, firstname, lastname, email, password: password || 'ChangeMe@123' });
      return Array.isArray(created) && created[0] && created[0].id ? created[0] : null;
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('already')) {
        return this.getUserByUsername(username);
      }
      throw err;
    }
  }

  async enrollUser(moodleUserId, moodleCourseId, roleId = 5) { // 5 is default student role in Moodle
    const params = {
      'enrolments[0][roleid]': roleId,
      'enrolments[0][userid]': moodleUserId,
      'enrolments[0][courseid]': moodleCourseId
    };

    return this.makeRequest('enrol_manual_enrol_users', params);
  }

  async getSSOToken(username) {
    // Requires a custom local plugin or auth_userkey plugin in Moodle
    const params = {
      'user[username]': username
    };
    return this.makeRequest('auth_userkey_request_login_url', params);
  }

  async createCalendarEvent(event) {
    const params = {
      'events[0][name]': event.name,
      'events[0][description]': event.description || '',
      'events[0][courseid]': event.moodleCourseId,
      'events[0][eventtype]': 'course',
      'events[0][timestart]': event.timestart,
      'events[0][timeduration]': event.timeduration || 7200
    };
    return this.makeRequest('core_calendar_create_calendar_events', params);
  }
  async getUserByUsername(username) {
    try {
      const params = {
        field: 'username',
        'values[0]': username
      };
      const response = await this.makeRequest('core_user_get_users_by_field', params);
      if (response && response.length > 0) {
        return response[0];
      }
      return null;
    } catch (err) {
      console.error('Error fetching user by username from Moodle:', err.message);
      return null;
    }
  }

  async updateStudentGrade(moodleCourseId, moodleUserId, gradeValue) {
    // Requires core_grades_update_grades in Moodle Web Service
    const params = {
      source: 'SCMS_Integration',
      courseid: moodleCourseId,
      component: 'moodle',
      activityid: moodleCourseId, 
      itemnumber: 0,
      'grades[0][userid]': moodleUserId,
      'grades[0][grade]': gradeValue
    };
    return this.makeRequest('core_grades_update_grades', params);
  }
}
module.exports = new MoodleService();
