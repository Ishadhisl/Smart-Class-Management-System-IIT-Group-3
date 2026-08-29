import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { Loader2, AlertTriangle } from 'lucide-react';

const MaterialTab = ({ courses }) => {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [loadError, setLoadError] = useState('');
  const [moodleDisabled, setMoodleDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();

  const userData = sessionStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;
  const isStudent = user?.role === 'Student';

  useEffect(() => {
    // Each call below asks Moodle for a fresh single-use SSO login key. StrictMode (and any
    // unrelated re-render that changes the `courses` reference) re-runs this effect, which
    // would otherwise fire a second request and load a second iframe src for the same
    // selection - two overlapping logins race on the same Moodle PHP session and it errors
    // out ("session mutated after it was closed"). `ignore` discards any response that isn't
    // from the most recent invocation, so only one embed URL is ever actually navigated to.
    let ignore = false;

    const fetchEmbedUrl = async () => {
      if (!selectedCourse) {
        setEmbedUrl('');
        setLoadError('');
        return;
      }

      setLoading(true);
      setLoadError('');
      try {
        const courseName = courses.find(c => String(c.course_id) === String(selectedCourse))?.course_name || '';
        const data = await request(`/moodle-sso/embed-url?page=course&course_id=${selectedCourse}&course_name=${encodeURIComponent(courseName)}`);
        if (ignore) return;
        if (data && data.embedUrl && typeof data.embedUrl === 'string' && data.embedUrl.startsWith('/')) {
          setEmbedUrl(data.embedUrl);
        } else {
          setEmbedUrl('');
          setLoadError('Moodle සම්බන්ධතාවය අසාර්ථක විය.');
          showNotification('Moodle සම්බන්ධතාවය අසාර්ථක විය.', 'error');
        }
      } catch (err) {
        if (ignore) return;
        console.error('Failed to fetch Moodle embed URL:', err);
        const msg = err.message || 'Moodle වෙත ප්‍රවේශ වීමේදී දෝෂයක් ඇති විය.';
        setEmbedUrl('');
        // Moodle is local-XAMPP-only and not part of the hosted deploy — show a calm
        // "local only" panel, not a red error toast.
        if (msg.includes('දේශීය install') || msg.toLowerCase().includes('moodle')) {
          setMoodleDisabled(true);
          setLoadError('');
        } else {
          setLoadError(msg);
          showNotification(msg, 'error');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchEmbedUrl();
    return () => { ignore = true; };
  }, [selectedCourse, showNotification, courses]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-glass flex flex-col h-[calc(100vh-120px)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h3 className="text-2xl font-bold text-primary mb-2">📁 {isStudent ? 'මගේ ඉගෙනුම් ද්‍රව්‍ය' : 'ඉගෙනුම් ද්‍රව්‍ය කළමනාකරණය'}</h3>
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
        {!selectedCourse && (
          <div className="text-gray-400 flex flex-col items-center">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-lg font-medium">ඉගෙනුම් ද්‍රව්‍ය බැලීම සඳහා පන්තියක් තෝරන්න</p>
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
            <div className="text-6xl mb-4">🖥️</div>
            <p className="text-lg font-semibold text-gray-700 mb-2">Moodle ඉගෙනුම් ද්‍රව්‍ය මොඩියුලය දේශීය install එකේ පමණයි</p>
            <p className="text-sm text-gray-500">
              මෙම විශේෂාංගය XAMPP හරහා ධාවනය වන local Moodle සේවාදායකයට සම්බන්ධ වේ.
              Hosted (Vercel/Render) අනුවාදයේ එය සක්‍රිය නැත. අනෙකුත් සියලු පද්ධති කොටස් සාමාන්‍ය පරිදි ක්‍රියා කරයි.
            </p>
          </div>
        )}

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
};

export default MaterialTab;