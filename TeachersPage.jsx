import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../../services/api';

const TeachersPage = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Professional Palette
  const PRIMARY_NAVY = '#070D59';
  const SECONDARY_BLUE = '#1F3C88';
  const LIGHT_ACCENT_BLUE = '#5893D4';
  const BACKGROUND_BLUE = '#CEDDEF';
  const [isBackHovered, setIsBackHovered] = useState(false); // Hover state for back button

  useEffect(() => {
    // Reset scroll and root styles
    window.scrollTo(0, 0);
    const root = document.getElementById('root');
    if (root) {
      root.style.maxWidth = 'none';
      root.style.padding = '0';
      root.style.margin = '0';
      root.style.width = '100%';
    }

    request('/teachers/public')
  .then(data => {
    setTeachers(data || []);
    setLoading(false);
  })
  .catch(err => {
    console.error("Error fetching teachers:", err);
    setLoading(false);
  });
  }, []);

  // 🔍 Filter Logic based on Specialization or Name
  const filteredTeachers = teachers.filter(t => 
    t.lecturer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.specialization?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ fontFamily: "'Noto Sans Sinhala', sans-serif", minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'white', padding: '20px 5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 100 }}>
        <button
          type="button"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
            background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
            color: 'inherit' // Ensure text color is inherited
          }}
          onClick={() => navigate('/')}
        >
          <img src="/Project%20LOGO.png" alt="Logo" style={{ width: '40px' }} />
          <h2 style={{ margin: 0, color: PRIMARY_NAVY, fontSize: '20px' }}>Thusitha Smart Academy</h2>
        </button>
        <button 
          onClick={() => navigate('/')} 
          onMouseEnter={() => setIsBackHovered(true)}
          onMouseLeave={() => setIsBackHovered(false)}
          style={{ 
            background: isBackHovered ? PRIMARY_NAVY : 'none', 
            border: `1px solid ${PRIMARY_NAVY}`, 
            padding: '8px 20px', 
            borderRadius: '5px', 
            cursor: 'pointer', 
            fontWeight: 'bold', 
            color: isBackHovered ? 'white' : PRIMARY_NAVY, transition: 'all 0.3s ease' }}
        >
          ආපසු (Back)
        </button>
      </header>

      <main style={{ padding: '60px 5%' }}>
        {/* Navigation Path (Breadcrumbs) */}
        <div style={{ marginBottom: '20px', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: SECONDARY_BLUE, fontWeight: '500', fontFamily: 'inherit', fontSize: 'inherit' }}
            aria-label="Go to Home Page"
          >
            මුල් පිටුව
          </button>
          <span>&gt;</span>
          <span style={{ color: PRIMARY_NAVY, fontWeight: 'bold' }}>ගුරු මඩුල්ල</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{ color: PRIMARY_NAVY, fontSize: '36px', marginBottom: '15px' }}>දිවයිනේ ප්‍රමුඛතම ගුරු මඩුල්ල</h1>
          <p style={{ color: '#666', maxWidth: '700px', margin: '0 auto' }}>ඔබේ අධ්‍යාපන සිහින සැබෑ කර දෙන, වසර ගණනාවක පළපුරුද්දක් සහිත අපගේ දක්ෂ දේශක මඩුල්ල සමඟ අදම එක්වන්න.</p>
        </div>

        {/* 🔎 Search & Filter Bar */}
        <div style={{ maxWidth: '600px', margin: '0 auto 50px', position: 'relative' }}>
          <input 
            type="text"
            placeholder="විෂය (Physics, IT...) හෝ දේශකයාගේ නම සොයන්න..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', padding: '15px 25px', borderRadius: '50px', border: `2px solid ${BACKGROUND_BLUE}`,
              fontSize: '16px', outline: 'none', transition: 'all 0.3s ease', boxShadow: '0 10px 20px rgba(0,0,0,0.03)',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: SECONDARY_BLUE }}>පූරණය වෙමින් පවතී...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '40px', justifyContent: 'center' }}>
            {filteredTeachers.length > 0 ? filteredTeachers.map(teacher => (
              <div
                key={teacher.lecturer_id}
                onClick={() => navigate('/courses')}
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '20px', 
                  padding: '40px 25px', 
                  textAlign: 'center',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
                  border: `1px solid #f0f0f0`,
                  transition: 'transform 0.3s ease',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-10px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: BACKGROUND_BLUE, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `4px solid ${LIGHT_ACCENT_BLUE}`, overflow: 'hidden' }}>
                   <img 
                    src={teacher.profile_photo_path ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${teacher.profile_photo_path.replace(/\\/g, '/')}` : "/Project%20LOGO.png"} 
                    alt={teacher.lecturer_name} 
                    style={{ width: teacher.profile_photo_path ? '100%' : '70%', height: '100%', objectFit: 'cover', opacity: 0.9 }} 
                   />
                </div>
                
                <h3 style={{ margin: '0 0 10px 0', color: PRIMARY_NAVY, fontSize: '22px' }}>{teacher.lecturer_name}</h3>
                <div style={{ color: LIGHT_ACCENT_BLUE, fontWeight: 'bold', fontSize: '14px', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {teacher.specialization}
                </div>
                
                <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                  {teacher.bio || "අධ්‍යාපන ක්ෂේත්‍රයේ ප්‍රවීණ දේශකයෙක්."}
                </p>
                
                <div style={{ display: 'inline-block', border: `1px solid ${SECONDARY_BLUE}`, color: SECONDARY_BLUE, padding: '8px 20px', borderRadius: '50px', fontSize: '13px', fontWeight: 'bold' }}>
                  පන්ති කාලසටහන බලන්න
                </div>
              </div>
            )) : (
              <p style={{ textAlign: 'center', gridColumn: '1 / -1', color: '#999' }}>දේශකයන්ගේ විස්තර සොයාගත නොහැක.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default TeachersPage;