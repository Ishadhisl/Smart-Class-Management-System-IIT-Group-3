import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';
import { FaSpinner, FaExclamationTriangle, FaExternalLinkAlt, FaClipboardList } from 'react-icons/fa';

const TimetableTab = ({ schedules, role }) => {
  const [embedUrl, setEmbedUrl] = useState('');
  // Set when the backend reports mode:'newtab' (a hosted/MoodleCloud instance, which can't
  // be same-origin iframed) - a Moodle-hosted, non-local install has no proxy to embed
  // through, so we open it in a new tab instead of trying to load it in the iframe below.
  const [newTabUrl, setNewTabUrl] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  // Upcoming exams come straight from SCMS's own Exams table - unlike the Moodle Calendar
  // above, these were never something Moodle knew about, so they need their own fetch
  // rather than living inside the embed/new-tab link.
  const [upcomingExams, setUpcomingExams] = useState([]);

  useEffect(() => {
    // Same single-use-SSO-key race as MaterialTab: StrictMode (or an unmount mid-fetch when
    // the user switches tabs away) can leave a stale response to apply itself after a newer
    // one already has, or after this tab isn't even showing anymore. `ignore` discards it.
    let ignore = false;

    const fetchEmbedUrl = async () => {
      setLoadError('');
      try {
        const data = await request(`/moodle-sso/embed-url?page=calendar`);
        if (ignore) return;
        if (data && data.mode === 'newtab' && typeof data.url === 'string') {
          setNewTabUrl(data.url);
          setEmbedUrl('');
        } else if (data && data.embedUrl && typeof data.embedUrl === 'string' && data.embedUrl.startsWith('/')) {
          setEmbedUrl(data.embedUrl);
          setNewTabUrl('');
        } else {
          setEmbedUrl('');
          setNewTabUrl('');
          setLoadError('Moodle Calendar සම්බන්ධතාවය අසාර්ථක විය.');
        }
      } catch (err) {
        if (ignore) return;
        console.error('Failed to fetch Moodle calendar URL:', err);
        const msg = err.message || 'Moodle වෙත ප්‍රවේශ වීමේදී දෝෂයක් ඇති විය.';
        setEmbedUrl('');
        setLoadError(msg);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchEmbedUrl();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await request('/exams/upcoming');
        if (!ignore && Array.isArray(data)) setUpcomingExams(data);
      } catch (err) {
        console.warn('Failed to fetch upcoming exams:', err.message);
      }
    })();
    return () => { ignore = true; };
  }, []);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-glass flex flex-col min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-2">📅 මගේ කාලසටහන (My Timetable)</h2>
          <p className="text-gray-500">Moodle Calendar හරහා ක්‍රියාත්මක වේ (Powered by Moodle)</p>
        </div>
      </div>

      <div className="w-full h-[600px] mb-8 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 relative flex items-center justify-center">
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-primary">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <p className="font-semibold animate-pulse">Moodle වෙත පිවිසෙමින් පවතී...</p>
          </div>
        )}

        {!loading && loadError && (
          <div className="text-center px-6">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-700">{loadError}</p>
          </div>
        )}

        {embedUrl ? (
          <iframe
            src={embedUrl}
            title="Moodle Calendar"
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
            allow="fullscreen"
          />
        ) : newTabUrl ? (
          <div className="text-center px-6">
            <div className="text-6xl mb-4">📅</div>
            <p className="text-lg font-medium text-gray-700 mb-4">
              Moodle Calendar එක වෙනම tab එකකින් විවෘත වේ.
            </p>
            <a
              href={newTabUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-dark transition"
            >
              <ExternalLink className="w-5 h-5" /> Moodle Calendar විවෘත කරන්න
            </a>
          </div>
        ) : !loading && !loadError && (
          <div className="text-gray-400 flex flex-col items-center">
            <div className="text-6xl mb-4">📅</div>
            <p className="text-lg font-medium">Moodle Calendar ලබා ගැනීමට නොහැකි විය.</p>
          </div>
        )}
      </div>

      {/* Local SCMS Timetable Fallback */}
      <h3 className="text-xl font-bold text-gray-700 mb-4">දිනපතා පන්ති කාලසටහන (Daily Classes)</h3>
      <div className="bg-white rounded-xl shadow-glass border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-primary text-white text-left">
                <th className="p-4 border-b-2 border-indigo-400">දිනය (Day)</th>
                <th className="p-4 border-b-2 border-indigo-400">වේලාව (Time)</th>
                <th className="p-4 border-b-2 border-indigo-400">විෂය සහ පන්තිය (Subject/Class)</th>
                <th className="p-4 border-b-2 border-indigo-400">ශාලාව (Hall)</th>
                <th className="p-4 border-b-2 border-indigo-400">දේශකයා (Lecturer)</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length > 0 ? (
                schedules.map((item, index) => (
                  <tr key={item.schedule_id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-indigo-50 transition-colors`}>
                    <td className="p-4 font-bold text-gray-700">{item.day_of_week}</td>
                    <td className="p-4">
                      <span className="bg-indigo-100 text-indigo-800 py-1 px-3 rounded-lg text-sm font-medium">
                        {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-gray-800">{item.course_name}</div>
                      <div className="text-xs text-gray-500">{item.subject_name}</div>
                    </td>
                    <td className="p-4 text-gray-700">{item.hall_name}</td>
                    <td className="p-4 text-gray-700">{item.lecturer_name || 'අදාළ නොවේ'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400 font-medium">ඔබ සඳහා වෙන්වූ කාලසටහනක් හමුවුනේ නැත.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming Exams - straight from SCMS's own Exams table, not Moodle */}
      <h3 className="text-xl font-bold text-gray-700 mb-4 mt-8 flex items-center gap-2">
        <ClipboardList className="w-5 h-5" /> ඉදිරි විභාග (Upcoming Exams)
      </h3>
      <div className="bg-white rounded-xl shadow-glass border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-danger text-white text-left">
                <th className="p-4 border-b-2 border-red-400">දිනය (Date)</th>
                <th className="p-4 border-b-2 border-red-400">විභාගය (Exam)</th>
                <th className="p-4 border-b-2 border-red-400">පන්තිය (Course)</th>
                <th className="p-4 border-b-2 border-red-400">සම්පූර්ණ ලකුණු (Marks)</th>
              </tr>
            </thead>
            <tbody>
              {upcomingExams.length > 0 ? (
                upcomingExams.map((exam, index) => (
                  <tr key={exam.exam_id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-red-50 transition-colors`}>
                    <td className="p-4 font-bold text-gray-700">{new Date(exam.exam_date).toLocaleDateString('en-GB')}</td>
                    <td className="p-4 text-gray-800">{exam.exam_name}</td>
                    <td className="p-4 text-gray-700">{exam.course_name}</td>
                    <td className="p-4 text-gray-700">{exam.total_marks}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400 font-medium">ඉදිරි විභාග හමුවුනේ නැත.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

TimetableTab.propTypes = {
  schedules: PropTypes.array.isRequired,
  role: PropTypes.string.isRequired,
};

export default TimetableTab;