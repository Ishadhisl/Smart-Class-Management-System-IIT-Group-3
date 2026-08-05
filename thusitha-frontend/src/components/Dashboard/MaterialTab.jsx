import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { Loader2 } from 'lucide-react';

const MaterialTab = ({ courses }) => {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();

  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;
  const isStudent = user?.role === 'Student';

  useEffect(() => {
    const fetchEmbedUrl = async () => {
      if (!selectedCourse) {
        setEmbedUrl('');
        return;
      }

      setLoading(true);
      try {
        const data = await request(`/moodle-sso/embed-url?page=course&course_id=${selectedCourse}`);
        if (data && data.embedUrl) {
          setEmbedUrl(data.embedUrl);
        } else {
          showNotification('Moodle සම්බන්ධතාවය අසාර්ථක විය.', 'error');
        }
      } catch (err) {
        console.error('Failed to fetch Moodle embed URL:', err);
        showNotification('Moodle වෙත ප්‍රවේශ වීමේදී දෝෂයක් ඇති විය.', 'error');
        // Fallback generic Moodle URL
        setEmbedUrl('http://localhost/moodle/my/');
      } finally {
        setLoading(false);
      }
    };

    fetchEmbedUrl();
  }, [selectedCourse, showNotification]);

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