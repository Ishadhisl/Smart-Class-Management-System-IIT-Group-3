import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';
import { Loader2 } from 'lucide-react';

const TimetableTab = ({ schedules, role }) => {
  const [embedUrl, setEmbedUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmbedUrl = async () => {
      try {
        const data = await request(`/moodle-sso/embed-url?page=calendar`);
        if (data && data.embedUrl) {
          setEmbedUrl(data.embedUrl);
        }
      } catch (err) {
        console.error('Failed to fetch Moodle calendar URL:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmbedUrl();
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

        {embedUrl ? (
          <iframe 
            src={embedUrl} 
            title="Moodle Calendar"
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
            allow="fullscreen"
          />
        ) : !loading && (
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
    </div>
  );
};

TimetableTab.propTypes = {
  schedules: PropTypes.array.isRequired,
  role: PropTypes.string.isRequired,
};

export default TimetableTab;