import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../../services/api';

const CoursesPage = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Colors from our professional palette
  const PRIMARY_NAVY = '#070D59';
  const SECONDARY_BLUE = '#1F3C88';
  const LIGHT_ACCENT_BLUE = '#5893D4';
  const [isBackHovered, setIsBackHovered] = useState(false); // Hover state for back button
  
  // Teacher Registration State
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [teacherRegistering, setTeacherRegistering] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    name: '',
    phone: '',
    email: '',
    subject: '',
    qualifications: '',
    bio: ''
  });

  const handleTeacherRegisterSubmit = async (e) => {
    e.preventDefault();
    setTeacherRegistering(true);
    try {
      const messageText = `දේශක ලියාපදිංචි වීමේ අයදුම්පත:\n` +
                          `නම: ${teacherForm.name}\n` +
                          `දුරකථනය: ${teacherForm.phone}\n` +
                          `ඊමේල්: ${teacherForm.email || 'නැත'}\n` +
                          `උගන්වන විෂය: ${teacherForm.subject}\n` +
                          `සුදුසුකම්: ${teacherForm.qualifications}\n` +
                          `හැඳින්වීම: ${teacherForm.bio}`;
      
      await request('/contact/submit', {
        method: 'POST',
        body: {
          sender_name: teacherForm.name,
          sender_email: teacherForm.email || `${teacherForm.phone}@thusitha.edu.lk`,
          sender_phone: teacherForm.phone,
          subject: `[Teacher Registration] ${teacherForm.name}`,
          message_text: messageText
        }
      });
      alert('දේශක ලියාපදිංචි වීමේ අයදුම්පත සාර්ථකව ඉදිරිපත් කරන ලදී! පාලක මඩුල්ල විසින් ඉක්මනින් ඔබව සම්බන්ධ කරගනු ඇත.');
      setIsTeacherModalOpen(false);
      setTeacherForm({ name: '', phone: '', email: '', subject: '', qualifications: '', bio: '' });
    } catch (err) {
      console.error('Teacher registration submit error:', err);
      alert(err.message || 'ඉදිරිපත් කිරීමට නොහැකි විය. නැවත උත්සාහ කරන්න.');
    } finally {
      setTeacherRegistering(false);
    }
  };

  useEffect(() => {
    // Ensure full screen width
    const root = document.getElementById('root');
    if (root) {
      root.style.maxWidth = 'none';
      root.style.padding = '0';
      root.style.margin = '0';
      root.style.width = '100%';
    }

    request('/courses/public') // Use request helper for public route
      .then(data => { // request helper handles response.ok and JSON parsing
        setCourses(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching courses:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ fontFamily: "'Noto Sans Sinhala', sans-serif", minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Simple Header */}
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
          <span style={{ color: PRIMARY_NAVY, fontWeight: 'bold' }}>අපගේ පන්ති</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h1 style={{ color: PRIMARY_NAVY, fontSize: '36px', marginBottom: '15px' }}>අපගේ පන්ති සහ කාලසටහන්</h1>
          <p style={{ color: '#666' }}>ඔබට ගැලපෙන විෂය සහ වේලාව තෝරාගන්න. ලියාපදිංචි වීමට පන්තිය මත ක්ලික් කරන්න.</p>
          <button
            onClick={() => setIsTeacherModalOpen(true)}
            style={{
              marginTop: '15px',
              padding: '10px 25px',
              backgroundColor: '#2e7d32',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '15px',
              transition: 'background-color 0.3s ease',
              boxShadow: '0 4px 10px rgba(46,125,50,0.2)'
            }}
            onMouseEnter={e => e.target.style.backgroundColor = '#1b5e20'}
            onMouseLeave={e => e.target.style.backgroundColor = '#2e7d32'}
          >
            👨‍🏫 දේශකයා (Teacher) ලියාපදිංචි වන්න
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>පූරණය වෙමින්...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' }}>
            {courses.length > 0 ? courses.map(course => (
              <div 
                key={course.course_id}
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '15px', 
                  overflow: 'hidden', 
                  boxShadow: '0 10px 20px rgba(0,0,0,0.05)',
                  transition: 'transform 0.3s ease',
                  border: '1px solid #eee',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ backgroundColor: PRIMARY_NAVY, padding: '20px', color: 'white' }}>
                  <h3 style={{ margin: 0, fontSize: '20px' }}>{course.course_name}</h3>
                  <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '5px' }}>{course.subject_name}</div>
                </div>
                
                <div style={{ padding: '25px', flexGrow: 1 }}>
                  <div style={{ marginBottom: '15px' }}>
                    <small style={{ color: '#888', fontWeight: 'bold', display: 'block' }}>දේශකයා (Teacher)</small>
                    <div style={{ color: SECONDARY_BLUE, fontSize: '18px', fontWeight: 'bold' }}>{course.lecturer_name || 'විස්තර ලබා ගත නොහැක'}</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                    <div>
                      <small style={{ color: '#888', fontWeight: 'bold', display: 'block' }}>මාසික ගාස්තුව</small>
                      <div style={{ color: '#2e7d32', fontSize: '20px', fontWeight: '800' }}>Rs. {course.monthly_fee}</div>
                    </div>
                    <button 
                      onClick={() => navigate('/', { state: { openRegister: true, courseId: course.course_id } })}
                      style={{ backgroundColor: LIGHT_ACCENT_BLUE, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      ලියාපදිංචි වන්න
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', gridColumn: '1 / -1' }}>පන්ති දත්ත සොයාගත නොහැක.</div>
            )}
          </div>
        )}
      {/* Teacher Registration Modal */}
      {isTeacherModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '15px', maxWidth: '500px', width: '100%', position: 'relative', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', boxSizing: 'border-box' }}>
            <button onClick={() => setIsTeacherModalOpen(false)} style={{ position: 'absolute', top: '15px', right: '15px', border: 'none', background: 'none', fontSize: '28px', cursor: 'pointer', color: '#666' }}>&times;</button>
            <h2 style={{ color: PRIMARY_NAVY, marginBottom: '10px', textAlign: 'center', fontSize: '22px', fontWeight: 'bold' }}>දේශකයා (Teacher) ලියාපදිංචිය</h2>
            <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px', fontSize: '13px' }}>ඔබේ තොරතුරු ඇතුළත් කර අයදුම්පත ඉදිරිපත් කරන්න.</p>
            
            <form onSubmit={handleTeacherRegisterSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>නම *</label>
                <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} value={teacherForm.name} onChange={e => setTeacherForm({...teacherForm, name: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>දුරකථනය *</label>
                  <input type="tel" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} value={teacherForm.phone} onChange={e => setTeacherForm({...teacherForm, phone: e.target.value})} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>විෂයය *</label>
                  <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} value={teacherForm.subject} onChange={e => setTeacherForm({...teacherForm, subject: e.target.value})} required />
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>ඊමේල් ලිපිනය</label>
                <input type="email" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} value={teacherForm.email} onChange={e => setTeacherForm({...teacherForm, email: e.target.value})} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>සුදුසුකම් *</label>
                <input type="text" placeholder="BSc, PhD, A/L Physics..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} value={teacherForm.qualifications} onChange={e => setTeacherForm({...teacherForm, qualifications: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>දේශක විස්තරය (Bio) *</label>
                <textarea rows={4} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', fontFamily: 'inherit' }} value={teacherForm.bio} onChange={e => setTeacherForm({...teacherForm, bio: e.target.value})} required />
              </div>
              
              <button type="submit" disabled={teacherRegistering} style={{ width: '100%', padding: '14px', backgroundColor: PRIMARY_NAVY, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', opacity: teacherRegistering ? 0.7 : 1 }}>
                {teacherRegistering ? 'යවමින් පවතී...' : 'අයදුම්පත ඉදිරිපත් කරන්න'}
              </button>
            </form>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

export default CoursesPage;