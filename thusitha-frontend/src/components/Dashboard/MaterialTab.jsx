import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { Loader2, AlertTriangle, ExternalLink, BookOpen, Monitor, GraduationCap } from 'lucide-react';

const MaterialTab = ({ courses, autoSelect = false, preferredCourseId = '' }) => {
  // Students/teachers land straight in their (first) class - or the class they clicked on
  // the home page - instead of an empty picker.
  const [selectedCourse, setSelectedCourse] = useState(() => preferredCourseId || (autoSelect && courses[0] ? String(courses[0].course_id) : ''));
  const [embedUrl, setEmbedUrl] = useState('');       // local (iframe) mode
  const [openUrl, setOpenUrl] = useState('');          // hosted (new-tab) mode
  const [ssoActive, setSsoActive] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [moodleDisabled, setMoodleDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();

  const userData = sessionStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;
  const isStudent = user?.role === 'Student';
  const isTeacher = user?.role === 'Teacher';

  // Courses can arrive after first render (dashboard fetch) - pick the first one once they do.
  useEffect(() => {
    if (!autoSelect || selectedCourse || !courses.length) return undefined;
    const timer = setTimeout(() => setSelectedCourse(String(courses[0].course_id)), 0);
    return () => clearTimeout(timer);
  }, [autoSelect, courses, selectedCourse]);

  useEffect(() => {
    let ignore = false;

    const fetchLink = async () => {
      if (!selectedCourse) {
        setEmbedUrl(''); setOpenUrl(''); setLoadError(''); setMoodleDisabled(false);
        return;
      }
      setLoading(true);
      setLoadError('');
      setMoodleDisabled(false);
      setEmbedUrl('');
      setOpenUrl('');
      try {
        const courseName = courses.find(c => String(c.course_id) === String(selectedCourse))?.course_name || '';
        const data = await request(`/moodle-sso/embed-url?page=course&course_id=${selectedCourse}&course_name=${encodeURIComponent(courseName)}`);
        if (ignore) return;
        if (data?.mode === 'newtab' && data.url) {
          setOpenUrl(data.url);
          setSsoActive(data.sso !== false);
        } else if (data?.embedUrl && data.embedUrl.startsWith('/')) {
          setEmbedUrl(data.embedUrl);
        } else {
          setLoadError('Moodle සම්බන්ධතාවය අසාර්ථක විය.');
          showNotification('Moodle සම්බන්ධතාවය අසාර්ථක විය.', 'error');
        }
      } catch (err) {
        if (ignore) return;
        const msg = err.message || 'Moodle වෙත ප්‍රවේශ වීමේදී දෝෂයක් ඇති විය.';
        if (msg.includes('සකසා නැත') || msg.includes('දේශීය install')) {
          setMoodleDisabled(true);
        } else {
          setLoadError(msg);
          showNotification(msg, 'error');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchLink();
    return () => { ignore = true; };
  }, [selectedCourse, showNotification, courses]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-glass flex flex-col h-[calc(100vh-120px)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h3 className="text-2xl font-bold text-primary mb-2">{isStudent ? 'මගේ ඉගෙනුම් ද්‍රව්‍ය' : 'ඉගෙනුම් ද්‍රව්‍ය කළමනාකරණය'}</h3>
          <p className="text-gray-500">Moodle හරහා ක්‍රියාත්මක වේ (Powered by Moodle)</p>
        </div>

        <div className="w-full md:w-72 mt-4 md:mt-0">
          <label htmlFor="course-select" className="block text-sm font-bold text-gray-700 mb-2">පන්තිය තෝරන්න (Select Class)</label>
          <select
            id="course-select"
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
          >
            <option value="">-- පන්තිය තෝරන්න --</option>
            {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 relative flex items-center justify-center">
        {!selectedCourse && !moodleDisabled && (
          <div className="text-gray-400 flex flex-col items-center">
            <BookOpen className="w-14 h-14 mb-4 text-gray-300" />
            <p className="text-lg font-medium">
              {autoSelect && courses.length === 0
                ? (isTeacher ? 'ඔබට තවම පන්ති නියම කර නැත. කරුණාකර Admin අමතන්න.' : 'ඔබ තවම කිසිදු පන්තියකට ලියාපදිංචි වී නැත.')
                : 'ඉගෙනුම් ද්‍රව්‍ය බැලීම සඳහා පන්තියක් තෝරන්න'}
            </p>
          </div>
        )}

        {selectedCourse && loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-primary">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <p className="font-semibold animate-pulse">Moodle වෙත පිවිසෙමින් පවතී...</p>
          </div>
        )}

        {selectedCourse && !loading && loadError && (
          <div className="text-center px-6">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-700">{loadError}</p>
          </div>
        )}

        {moodleDisabled && (
          <div className="text-center px-6 max-w-md">
            <Monitor className="w-14 h-14 mb-4 text-gray-300" />
            <p className="text-lg font-semibold text-gray-700 mb-2">Moodle මොඩියුලය මෙම deployment එකේ සකසා නැත</p>
            <p className="text-sm text-gray-500">
              පරිපාලක <code>MOODLE_URL</code> සහ <code>MOODLE_TOKEN</code> environment variables සැකසූ පසු
              මෙම විශේෂාංගය ක්‍රියාත්මක වේ. අනෙකුත් සියලු පද්ධති කොටස් සාමාන්‍ය පරිදි ක්‍රියා කරයි.
            </p>
          </div>
        )}

        {/* Hosted Moodle — open in a new tab */}
        {selectedCourse && !loading && openUrl && (
          <div className="text-center px-6 max-w-md">
            <GraduationCap className="w-14 h-14 mb-4 text-gray-300" />
            <p className="text-lg font-semibold text-gray-700 mb-3">
              {courses.find(c => String(c.course_id) === String(selectedCourse))?.course_name}
            </p>
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
            >
              <ExternalLink size={18} /> Moodle හි විවෘත කරන්න
            </a>
            <p className="text-xs text-gray-400 mt-3">
              {ssoActive
                ? 'නව tab එකක Moodle ස්වයංක්‍රීයව විවෘත වේ.'
                : 'නව tab එකක Moodle විවෘත වේ — ඔබගේ Moodle username එය ඔබගේ පද්ධති username එකමයි.'}
            </p>
          </div>
        )}

        {/* Local Moodle — same-origin iframe */}
        {selectedCourse && embedUrl && (
          <iframe
            src={embedUrl}
            title="Moodle Course"
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
            allow="fullscreen"
          />
        )}
      </div>
    </div>
  );
};

MaterialTab.propTypes = {
  courses: PropTypes.arrayOf(PropTypes.object).isRequired,
  autoSelect: PropTypes.bool,
  preferredCourseId: PropTypes.string,
};

export default MaterialTab;
